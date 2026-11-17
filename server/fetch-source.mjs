import {
  safeLink
} from '../shared/domain.mjs';

export class SourceError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function decodeEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function stripTags(html) {
  return decodeEntities(String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

function meta(html, names) {
  for (const name of names) {
    const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i');
    const alt = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`, 'i');
    const hit = html.match(re) || html.match(alt);
    if (hit?.[1]) return decodeEntities(hit[1]).trim();
  }
  return '';
}

function titleOf(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return decodeEntities(m?.[1] || '').replace(/\s+/g, ' ').trim();
}

export async function fetchSourcePage(url, fetcher = fetch) {
  const href = safeLink(url);
  if (!href) throw new SourceError(400, '请输入 http 或 https 开头的课程链接。');
  let response;
  try {
    response = await fetcher(href, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'overwatch-guide/1.0 (+local knowledge ingest)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(20000)
    });
  } catch {
    throw new SourceError(502, '无法抓取该链接。可粘贴标题、简介或字幕后再提炼。');
  }
  if (!response.ok) throw new SourceError(502, '抓取失败：HTTP ' + response.status + '。可粘贴标题、简介或字幕后再提炼。');
  const html = await response.text();
  const title = titleOf(html) || meta(html, ['og:title', 'twitter:title']);
  const description = meta(html, ['description', 'og:description', 'twitter:description']);
  let body = '';
  const article = html.match(/<article[\s\S]*?<\/article>/i)?.[0]
    || html.match(/<main[\s\S]*?<\/main>/i)?.[0]
    || '';
  body = stripTags(article || html).slice(0, 14000);
  if (href.includes('overwatch.blizzard.com') && /patch|Patch Notes|英雄|Hero/i.test(html + title)) {
    const patchChunks = [...html.matchAll(/<(?:h[2-4]|li|p)[^>]*>[\s\S]*?<\/(?:h[2-4]|li|p)>/gi)]
      .map(m => stripTags(m[0]))
      .filter(t => t.length > 12 && /damage|armor|cooldown|health|伤害|护甲|冷却|生命|increased|reduced|从|至/i.test(t));
    if (patchChunks.length) body = patchChunks.slice(0, 80).join('\n').slice(0, 12000);
  }
  const author = meta(html, ['author', 'og:site_name']) || (href.includes('bilibili.com') ? '哔哩哔哩' : '');
  const text = [title, description, body].filter(Boolean).join('\n\n').trim();
  if (text.length < 20) throw new SourceError(422, '页面可读正文太少。请粘贴标题、简介或字幕后再提炼。');
  return {
    url: href,
    title: title.slice(0, 150),
    description: description.slice(0, 500),
    author: author.slice(0, 70),
    text: text.slice(0, 12000)
  };
}
