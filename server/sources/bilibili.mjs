import {
  safeLink
} from '../../shared/domain.mjs';

const BVID_RE = /BV1[\w]{9}/i;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function bilibiliHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  return h.includes('bilibili.com') || h === 'b23.tv' || h.endsWith('.b23.tv');
}

export function parseBilibiliUrl(url) {
  const href = safeLink(url);
  if (!href) return null;
  let host;
  try {
    host = new URL(href).hostname;
  } catch {
    return null;
  }
  if (!bilibiliHost(host)) return null;
  const hit = href.match(BVID_RE);
  if (!hit) {
    if (host.includes('b23.tv')) return {
      bvid: null,
      page: 1,
      href
    };
    return null;
  }
  let page = 1;
  try {
    page = Math.max(1, parseInt(new URL(href).searchParams.get('p') || '1', 10) || 1);
  } catch {}
  return {
    bvid: hit[0],
    page
  };
}

function clockToSeconds(raw) {
  const normalized = String(raw || '').trim().replace(',', '.');
  const bits = normalized.split(':').map(p => parseFloat(p));
  if (bits.some(n => Number.isNaN(n))) return 0;
  if (bits.length === 3) return bits[0] * 3600 + bits[1] * 60 + bits[2];
  if (bits.length === 2) return bits[0] * 60 + bits[1];
  return bits[0] || 0;
}

async function fetchJson(url, fetcher) {
  try {
    const response = await fetcher(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': UA,
        Accept: 'application/json'
      },
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) return null;
    const json = await response.json().catch(() => null);
    if (!json || json.code !== 0) return null;
    return json.data;
  } catch {
    return null;
  }
}

async function resolveBvid(parsed, url, fetcher) {
  if (parsed?.bvid) return parsed.bvid;
  const href = parsed?.href || safeLink(url);
  if (!href) return '';
  try {
    const response = await fetcher(href, {
      redirect: 'follow',
      headers: {
        'User-Agent': UA
      },
      signal: AbortSignal.timeout(20000)
    });
    const finalUrl = response.url || href;
    const hit = finalUrl.match(BVID_RE);
    return hit ? hit[0] : '';
  } catch {
    return '';
  }
}

function cuesFromSubtitleBody(body) {
  const list = Array.isArray(body) ? body : body?.body;
  if (!Array.isArray(list)) return [];
  return list.map((row, index) => ({
    cueId: String(index + 1),
    start_s: Number(row.from ?? row.start ?? 0),
    end_s: Number(row.to ?? row.end ?? row.from ?? 0),
    text: String(row.content ?? row.m ?? row.text ?? '').trim()
  })).filter(c => c.text);
}

async function fetchSubtitleCues(bvid, cid, fetcher) {
  const player = await fetchJson(`https://api.bilibili.com/x/player/v2?bvid=${encodeURIComponent(bvid)}&cid=${cid}`, fetcher);
  const subs = player?.subtitle?.subtitles;
  if (!Array.isArray(subs) || !subs.length) return [];
  const track = subs.find(s => /zh|cn|chi/i.test(s.lan_doc || s.lan || '')) || subs[0];
  const subUrl = track?.subtitle_url;
  if (!subUrl) return [];
  const href = subUrl.startsWith('http') ? subUrl : 'https:' + subUrl;
  try {
    const response = await fetcher(href, {
      headers: {
        'User-Agent': UA,
        Accept: 'application/json'
      },
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) return [];
    const json = await response.json().catch(() => null);
    return cuesFromSubtitleBody(json);
  } catch {
    return [];
  }
}

export async function fetchBilibiliSource(url, fetcher = fetch) {
  const parsed = parseBilibiliUrl(url);
  const href = safeLink(url) || parsed?.href || '';
  const missing = [];
  const bvid = await resolveBvid(parsed, url, fetcher);
  const pageNum = parsed?.page || 1;
  if (!bvid) {
    return {
      url: href,
      platform: 'bilibili',
      bvid: '',
      page: pageNum,
      title: '',
      description: '',
      author: '',
      pages: [],
      cues: [],
      channels: {
        html: false,
        captions: false,
        audio: false,
        frames: false
      },
      coverage: {
        captions: false
      },
      missing: ['metadata', 'captions']
    };
  }
  const canonical = `https://www.bilibili.com/video/${bvid}${pageNum > 1 ? '?p=' + pageNum : ''}`;
  let pages = [];
  const pagelist = await fetchJson(`https://api.bilibili.com/x/player/pagelist?bvid=${encodeURIComponent(bvid)}`, fetcher);
  if (pagelist) {
    pages = pagelist.map(row => ({
      page: Number(row.page) || 1,
      cid: Number(row.cid) || 0,
      part: String(row.part || row.title || '').slice(0, 120)
    })).filter(p => p.cid);
  } else {
    missing.push('pagelist');
  }
  let title = '';
  let description = '';
  let author = '';
  const view = await fetchJson(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`, fetcher);
  if (view) {
    title = String(view.title || '').slice(0, 150);
    description = String(view.desc || view.description || '').slice(0, 2000);
    author = String(view.owner?.name || '').slice(0, 70);
    if (!pages.length && Array.isArray(view.pages)) {
      pages = view.pages.map(row => ({
        page: Number(row.page) || 1,
        cid: Number(row.cid) || 0,
        part: String(row.part || '').slice(0, 120)
      })).filter(p => p.cid);
    }
  } else {
    missing.push('metadata');
  }
  const active = pages.find(p => p.page === pageNum) || pages[0];
  let cues = [];
  if (active?.cid) {
    cues = await fetchSubtitleCues(bvid, active.cid, fetcher);
    if (!cues.length) missing.push('captions');
  } else if (!missing.includes('captions')) {
    missing.push('captions');
  }
  return {
    url: canonical,
    platform: 'bilibili',
    bvid,
    page: active?.page || pageNum,
    title,
    description,
    author,
    pages,
    cues,
    channels: {
      html: !!view,
      captions: cues.length > 0,
      audio: false,
      frames: false
    },
    coverage: {
      captions: cues.length > 0
    },
    missing
  };
}