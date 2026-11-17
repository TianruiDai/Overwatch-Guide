import {
  heroes,
  maps,
  normalizeLibraryRole,
  stages,
  stripTranscript
} from '../shared/domain.mjs';
import {
  humanizeCoachCard
} from '../shared/humanize-coach.mjs';
import {
  ApiError,
  askStage,
  short
} from './model.mjs';
import {
  skillMeta
} from './skills.mjs';
import {
  fetchSourcePage,
  SourceError
} from './fetch-source.mjs';
import {
  fetchBilibiliSource,
  parseBilibiliUrl
} from './sources/bilibili.mjs';

const sources = new Map();
const BASIS = new Set(['source_statement', 'observed_event', 'official_fact', 'model_inference']);
const ROLE_FROM_EN = {
  tank: '重装',
  damage: '输出',
  support: '辅助',
  general: '综合',
  version: '版本'
};

const bad = message => {
  throw new ApiError(400, message);
};
const invalid = () => {
  throw new ApiError(502, '模型没有返回约定的 JSON。已完成的片段会保留，可重试当前步骤。');
};

function normalizeTeachingRole(role) {
  const raw = String(role || '').trim();
  const fromEn = ROLE_FROM_EN[raw.toLowerCase()];
  if (fromEn) return fromEn;
  return normalizeLibraryRole(raw) || '综合';
}

function clockToSeconds(raw) {
  const normalized = String(raw || '').trim().replace(',', '.');
  const bits = normalized.split(':').map(p => parseFloat(p));
  if (bits.some(n => Number.isNaN(n))) return 0;
  if (bits.length === 3) return bits[0] * 3600 + bits[1] * 60 + bits[2];
  if (bits.length === 2) return bits[0] * 60 + bits[1];
  return bits[0] || 0;
}

export function parseExcerptCues(excerpt) {
  const text = String(excerpt || '');
  if (!text.trim()) return [];
  const cues = [];
  const blockRe = /(?:^|\n)(\d+)\s*\r?\n\s*(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?)\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?)\s*\r?\n([\s\S]*?)(?=\r?\n\d+\s*\r?\n|\s*$)/g;
  let match;
  while ((match = blockRe.exec(text)) !== null) {
    const body = match[4].replace(/\r?\n/g, ' ').trim();
    if (!body) continue;
    cues.push({
      cueId: match[1],
      start_s: clockToSeconds(match[2]),
      end_s: clockToSeconds(match[3]),
      text: body
    });
  }
  return cues;
}

function isBilibiliUrl(url) {
  return parseBilibiliUrl(url) !== null;
}

function evidenceFromSource(source, excerpt = '') {
  const parts = [];
  if (source.title) parts.push(source.title);
  if (source.description) parts.push(source.description);
  if (source.cues?.length) parts.push(source.cues.map(c => c.text).join('\n'));
  if (excerpt) parts.push(stripTranscript(excerpt));
  else if (source.text) parts.push(source.text);
  return parts.filter(Boolean).join('\n\n').slice(0, 12000);
}

function wrapGenericSource(page, excerpt, id) {
  const excerptText = short(excerpt, 120000);
  let cues = parseExcerptCues(excerptText);
  const missing = [];
  if (!cues.length && excerptText.trim()) {
    const clean = stripTranscript(excerptText);
    if (clean.length >= 8) {
      cues = [{
        cueId: '1',
        start_s: 0,
        end_s: 0,
        text: clean.slice(0, 4000)
      }];
    }
  }
  if (!cues.length) missing.push('captions');
  const text = [page.text, excerptText && excerptText !== page.text ? stripTranscript(excerptText) : ''].filter(Boolean).join('\n\n').slice(0, 12000);
  return {
    id,
    url: page.url,
    platform: 'web',
    bvid: '',
    page: 1,
    title: page.title,
    description: page.description,
    author: page.author,
    pages: [],
    cues,
    text,
    channels: {
      html: true,
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

function pick(list, allowed) {
  return [...new Set((Array.isArray(list) ? list : []).map(v => short(v, 40)).filter(v => allowed.includes(v) || !allowed.length))].slice(0, 8);
}

function normalizeUnit(raw, evidence) {
  const quote = short(raw?.quote, 500);
  if (!short(raw?.title) || !short(raw?.principle) || !short(raw?.application) || !quote) invalid();
  if (!evidence.includes(quote)) invalid();
  const basis = BASIS.has(raw?.basis) ? raw.basis : 'source_statement';
  return humanizeCoachCard({
    title: short(raw.title, 80),
    principle: short(raw.principle),
    application: short(raw.application),
    quote,
    heroes: pick(raw.heroes, heroes),
    maps: pick(raw.maps, maps),
    stage: stages.includes(raw.stage) ? raw.stage : '团战',
    role: normalizeTeachingRole(raw.role),
    tags: pick(raw.tags, []),
    basis
  });
}

function mergeExcerptIntoSource(source, excerpt) {
  if (!excerpt) return source;
  const extraCues = parseExcerptCues(excerpt);
  if (extraCues.length) {
    source.cues = extraCues;
  } else {
    const clean = stripTranscript(excerpt);
    if (clean.length >= 8) {
      source.cues = [{
        cueId: 'paste-1',
        start_s: 0,
        end_s: 0,
        text: clean.slice(0, 4000)
      }];
    }
  }
  if (source.cues?.length) {
    source.coverage = {
      ...source.coverage,
      captions: true
    };
    source.channels = {
      ...source.channels,
      captions: true
    };
    source.missing = (source.missing || []).filter(m => m !== 'captions');
  }
  return source;
}

export async function createTeachingSource(body, env, fetcher) {
  const href = short(body.url, 500);
  if (!href) bad('请提供课程链接。');
  const id = crypto.randomUUID();
  const excerpt = short(body.excerpt, 120000);
  let source;
  if (isBilibiliUrl(href)) {
    source = mergeExcerptIntoSource(await fetchBilibiliSource(href, fetcher), excerpt);
    source.id = id;
  } else {
    let page;
    try {
      if (excerpt.length >= 20 && !body.forceFetch) {
        page = {
          url: href,
          title: short(body.sourceTitle, 150),
          description: '',
          author: short(body.author, 70),
          text: stripTranscript(excerpt).slice(0, 12000)
        };
      } else {
        page = await fetchSourcePage(href, fetcher);
        if (excerpt) page.text = [page.text, stripTranscript(excerpt)].filter(Boolean).join('\n\n').slice(0, 12000);
      }
    } catch (error) {
      if (error instanceof SourceError) throw new ApiError(error.status, error.message);
      throw error;
    }
    source = wrapGenericSource(page, excerpt, id);
  }
  sources.set(id, source);
  return source;
}

export function getTeachingSource(id) {
  const source = sources.get(String(id || ''));
  if (!source) throw new ApiError(404, '找不到该教学来源。');
  return source;
}

export async function distillUnits(body, env, fetcher) {
  const excerptText = short(body.excerpt, 12000);
  const sourceId = short(body.sourceId, 80);
  let source = null;
  if (sourceId) {
    try {
      source = getTeachingSource(sourceId);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) throw error;
    }
  }
  const evidence = source ? evidenceFromSource(source, excerptText) : stripTranscript(excerptText);
  const hasCues = source?.cues?.length > 0;
  if (evidence.length < 20 || (!hasCues && excerptText.length < 20 && !source?.title)) {
    throw new ApiError(422, '缺少可用的字幕或笔记，请补充材料后再提炼。');
  }
  const prompt = [
    '从所给教学原文提炼多条可核对的知识单元（多张卡片）。用口语短句，禁止空泛套话。',
    'quote 必须是原文里连续的短摘录。资料不足就返回 {"insufficient":true}。',
    '否则输出 {"units":[{"title":"简短标题","quote":"连续原文","principle":"来源可支持的原则","application":"复盘时能检查的一个动作","heroes":["英雄"],"maps":["地图"],"stage":"落位/技能/团战/大招/撤退/视野中的一个","role":"tank/damage/support/general/version 或 重装/输出/辅助/综合/版本","tags":["标签"],"basis":"source_statement|observed_event|official_fact|model_inference"}]}。',
    '每个单元一条独立决策；units 至少 1 条。heroes 与 maps 只填原文明确出现的，否则用空数组。',
    JSON.stringify(evidence)
  ].join('\n');
  const data = await askStage('distill', body.settings, env, [{
    role: 'user',
    content: prompt
  }], fetcher);
  if (data?.insufficient) throw new ApiError(422, '这段材料缺少具体教学观点，请补充上下文。');
  const list = Array.isArray(data?.units) ? data.units : data?.title ? [data] : [];
  if (!list.length) invalid();
  const units = list.slice(0, 12).map(unit => normalizeUnit(unit, evidence));
  return {
    units,
    skill: skillMeta('distill')
  };
}

export async function versionCheck(body, env, fetcher) {
  void env;
  void fetcher;
  const units = Array.isArray(body?.units) ? body.units : [];
  if (!units.length) bad('请提供要核验的知识单元。');
  const officialText = short(body.officialText, 50000);
  const updated = units.map(unit => {
    const next = {
      ...unit
    };
    if (officialText) {
      const quote = short(unit.quote, 500);
      const principle = short(unit.principle, 2000);
      const inOfficial = quote && officialText.includes(quote) || principle && officialText.includes(principle);
      next.basis = inOfficial ? 'official_fact' : unit.basis || 'model_inference';
      next.status = inOfficial ? 'ready' : 'needs_review';
    } else if (!next.status) {
      next.status = 'ready';
    }
    return next;
  });
  return {
    units: updated
  };
}