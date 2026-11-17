export const providers = {
  openai: {
    name: 'OpenAI',
    model: 'gpt-4.1-mini',
    base: 'https://api.openai.com/v1'
  },
  qwen: {
    name: '通义千问 · 北京',
    model: 'qwen3-vl-plus',
    base: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  },
  qwenIntl: {
    name: '通义千问 · 新加坡',
    model: 'qwen3-vl-plus',
    base: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
  },
  deepseek: {
    name: 'DeepSeek',
    model: 'deepseek-flash',
    base: 'https://api.deepseek.com/v1'
  },
  custom: {
    name: '自定义 · OpenAI 兼容',
    model: '',
    base: ''
  }
};

export const libraryRoles = ['重装', '输出', '辅助', '综合', '版本'];
export const matchRoles = ['重装', '输出', '辅助'];
export const matchSides = ['进攻', '防守', '攻防双方', '控制 / 推进', '未指定'];
/** @deprecated use libraryRoles; kept as alias for library filters */
export const roles = libraryRoles;
export const categories = ['落位', '技能', '集火', '团战', '撤退', '视野'];
export const stages = ['落位', '技能', '团战', '大招', '撤退', '视野'];
export const waveStages = ['落位', '技能', '团战', '大招'];
export const heroes = [
  '温斯顿', '破坏球', '莱因哈特', 'D.Va', 'D.Mon', '查莉娅', '西格玛', '路霸', '奥丽莎', '末日铁拳', '拉玛刹', '渣客女王', '毛加', '飞天猫',
  '猎空', '源氏', '士兵：76', '卡西迪', '艾什', '黑百合', '半藏', '狂鼠', '托比昂', '堡垒', '回声', '法老之鹰', '死神', '美', '探奇', '索杰恩', '骇灾', '弗蕾雅', '埃姆雷', '秩序之光', '西拉', '死怨', '斩仇', '安燃',
  '安娜', '雾子', '卢西奥', '布丽吉塔', '禅雅塔', '莫伊拉', '巴蒂斯特', '天使', '生命之梭', '伊拉锐', '朱诺', '黑影', '血律', '无漾'
];
export const maps = [
  '国王大道', '多拉多', '漓江塔', '监测站：直布罗陀', '直布罗陀监测站', '努巴尼', '好莱坞', '伊利奥斯', '里阿尔托', '艾兴瓦尔德', '香巴里寺院',
  '霓虹枢纽', '监测站：格里姆火山', '南极半岛', '斗兽场', '埃斯佩兰萨', '釜山', '绿洲城', '尼泊尔', '哈瓦那', '渣客镇', '暴雪世界', '帕拉伊苏', '阿德勒斯布鲁恩'
];
/** slug for official hero pages: overwatch.blizzard.com/en-us/heroes/<slug>/ */
export const heroSlugs = {
  '温斯顿': 'winston', '破坏球': 'wrecking-ball', '莱因哈特': 'reinhardt', 'D.Va': 'dva', 'D.Mon': 'dmon', '查莉娅': 'zarya', '西格玛': 'sigma', '路霸': 'roadhog', '奥丽莎': 'orisa', '末日铁拳': 'doomfist', '拉玛刹': 'ramattra', '渣客女王': 'junker-queen', '毛加': 'mauga', '飞天猫': 'jetpack-cat',
  '猎空': 'tracer', '源氏': 'genji', '士兵：76': 'soldier-76', '卡西迪': 'cassidy', '艾什': 'ashe', '黑百合': 'widowmaker', '半藏': 'hanzo', '狂鼠': 'junkrat', '托比昂': 'torbjorn', '堡垒': 'bastion', '回声': 'echo', '法老之鹰': 'pharah', '死神': 'reaper', '美': 'mei', '探奇': 'venture', '索杰恩': 'sojourn', '骇灾': 'hazard', '弗蕾雅': 'freja', '埃姆雷': 'emre', '秩序之光': 'symmetra', '西拉': 'sierra', '死怨': 'vengeance', '斩仇': 'vendetta', '安燃': 'anran',
  '安娜': 'ana', '雾子': 'kiriko', '卢西奥': 'lucio', '布丽吉塔': 'brigitte', '禅雅塔': 'zenyatta', '莫伊拉': 'moira', '巴蒂斯特': 'baptiste', '天使': 'mercy', '生命之梭': 'lifeweaver', '伊拉锐': 'illari', '朱诺': 'juno', '黑影': 'sombra', '血律': 'vendetta-blood', '无漾': 'wuyang'
};

export const heroRoles = {
  '温斯顿': '重装', '破坏球': '重装', '莱因哈特': '重装', 'D.Va': '重装', 'D.Mon': '重装', '查莉娅': '重装', '西格玛': '重装', '路霸': '重装', '奥丽莎': '重装', '末日铁拳': '重装', '拉玛刹': '重装', '渣客女王': '重装', '毛加': '重装', '飞天猫': '重装',
  '猎空': '输出', '源氏': '输出', '士兵：76': '输出', '卡西迪': '输出', '艾什': '输出', '黑百合': '输出', '半藏': '输出', '狂鼠': '输出', '托比昂': '输出', '堡垒': '输出', '回声': '输出', '法老之鹰': '输出', '死神': '输出', '美': '输出', '探奇': '输出', '索杰恩': '输出', '骇灾': '输出', '弗蕾雅': '输出', '埃姆雷': '输出', '秩序之光': '输出', '西拉': '输出', '死怨': '输出', '斩仇': '输出', '安燃': '输出',
  '安娜': '辅助', '雾子': '辅助', '卢西奥': '辅助', '布丽吉塔': '辅助', '禅雅塔': '辅助', '莫伊拉': '辅助', '巴蒂斯特': '辅助', '天使': '辅助', '生命之梭': '辅助', '伊拉锐': '辅助', '朱诺': '辅助', '黑影': '辅助', '血律': '辅助', '无漾': '辅助'
};
export const vaguePhrases = ['视情况', '根据实际', '多加注意', '提升意识', '尽量', '适当', '灵活', '看情况', '注意观察', '保持意识'];

export function normalizeLibraryRole(role) {
  if (role === '支援') return '辅助';
  if (role === '通用') return '综合';
  return libraryRoles.includes(role) ? role : '';
}

const norm = s => String(s || '').replace(/\s+/g, '').toLowerCase();

/** Match a free-text name against a whitelist (exact, then substring). */
export function matchListedName(value, list) {
  const n = norm(value);
  if (!n || !Array.isArray(list)) return '';
  const exact = list.find(x => norm(x) === n);
  if (exact) return exact;
  const hit = list.find(x => {
    const m = norm(x);
    return m && (n.includes(m) || m.includes(n));
  });
  return hit || '';
}

export function normalizeSide(side) {
  const raw = String(side || '').trim();
  if (matchSides.includes(raw)) return raw;
  const n = norm(raw);
  if (!n || n === '未指定' || n === 'unknown') return '未指定';
  if (n.includes('攻防') || n.includes('双方')) return '攻防双方';
  if (n.includes('控制') || n.includes('推进') || n.includes('占点')) return '控制 / 推进';
  if (n.includes('进攻') || n === 'attack' || n === 'offense') return '进攻';
  if (n.includes('防守') || n === 'defend' || n === 'defense') return '防守';
  return '未指定';
}

/** Player team color from left-bottom HUD: blue | red | unknown. */
export function normalizeTeamColor(value) {
  const n = norm(value);
  if (!n) return 'unknown';
  if (n === 'blue' || n === '蓝' || n === '蓝色' || n.includes('蓝')) return 'blue';
  if (n === 'red' || n === '红' || n === '红色' || n.includes('红')) return 'red';
  return 'unknown';
}

/** Whitelist hero/map and derive role from hero when possible. */
export function normalizeIdentity(detected = {}) {
  const hero = matchListedName(detected.hero, heroes);
  const map = matchListedName(detected.map, maps);
  let role = '';
  if (hero && heroRoles[hero]) role = heroRoles[hero];
  else {
    const raw = normalizeLibraryRole(detected.role) || detected.role;
    role = matchRoles.includes(raw) ? raw : '';
  }
  const out = {};
  if (hero) out.hero = hero;
  if (map) out.map = map;
  if (role) out.role = role;
  out.side = normalizeSide(detected.side);
  if (Number.isFinite(detected.time)) out.time = detected.time;
  return out;
}

/** Whitelist and dedupe a hero name list. */
export function normalizeHeroList(list, {
  exclude = [],
  max = 6
} = {}) {
  const out = [];
  const seen = new Set((Array.isArray(exclude) ? exclude : []).map(x => norm(matchListedName(x, heroes) || x)).filter(Boolean));
  for (const raw of Array.isArray(list) ? list : []) {
    const hero = matchListedName(raw, heroes);
    if (!hero || seen.has(norm(hero))) continue;
    seen.add(norm(hero));
    out.push(hero);
    if (out.length >= max) break;
  }
  return out;
}

/** Normalize ally/enemy/swap rosters; keep POV out of enemies. */
export function normalizeRosters(data = {}, povHero = '') {
  const pov = matchListedName(povHero || data.hero, heroes);
  let allies = normalizeHeroList(data.allies, {
    max: 5
  });
  if (pov) {
    allies = [pov, ...allies.filter(h => h !== pov)].slice(0, 5);
  }
  const enemies = normalizeHeroList(data.enemies, {
    exclude: pov ? [pov] : [],
    max: 5
  });
  const swaps = normalizeHeroList(data.swaps, {
    max: 5
  });
  const out = {
    allies,
    enemies
  };
  if (swaps.length) out.swaps = swaps;
  return out;
}

/** Parse comma/space/顿号 separated hero names from a form field. */
export function parseHeroField(value) {
  return String(value || '').split(/[,，、/\s]+/).map(s => s.trim()).filter(Boolean);
}

export const formatTime = value => {
  const secs = Math.max(0, Math.floor(Number(value) || 0));
  return Math.floor(secs / 60).toString().padStart(2, '0') + ':' + (secs % 60).toString().padStart(2, '0');
};

export function parseTime(value) {
  const s = String(value).trim();
  if (/^\d+(?:\.\d+)?$/.test(s)) return Number(s);
  if (!/^\d+:[0-5]\d(?:\.\d+)?$/.test(s)) return NaN;
  const [min, sec] = s.split(':').map(Number);
  return min * 60 + sec;
}

export function sampleWindows(start, end, step) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || ![1, 2, 4].includes(step))
    throw new Error('请填写有效的起止时间和采样间隔。');
  const times = [];
  const last = Math.max(start, end - Math.min(0.12, (end - start) / 2));
  for (let t = start; t < last; t += step) times.push(Number(t.toFixed(3)));
  if (!times.length || last - times.at(-1) >= Math.min(step / 2, 0.5)) times.push(Number(last.toFixed(3)));
  const windows = [];
  for (let i = 0; i < times.length; i += 8) windows.push(times.slice(i, i + 8));
  return windows;
}

function cardStage(card) {
  if (stages.includes(card?.stage)) return card.stage;
  for (const stage of stages)
    if ((card?.tags || []).some(tag => norm(tag) === norm(stage))) return stage;
  return '团战';
}

function rankedNotes(cards, context) {
  const hero = norm(context.hero);
  const map = norm(context.map);
  const topicRaw = [context.map, context.focus, context.hero, context.side, context.extra].join(' ');
  const topic = norm(topicRaw);
  const patchFocus = /版本|补丁|patch|改动|平衡|数值/.test(topicRaw);
  const derivedRole = hero && normalizeLibraryRole(cards.find(c => {
    const r = normalizeLibraryRole(c.role);
    return r && r !== '综合' && r !== '版本' && (c.heroes || []).some(name => norm(name) === hero);
  })?.role);
  const contextRole = normalizeLibraryRole(context.role);
  const role = contextRole && contextRole !== '综合' && contextRole !== '版本' ? contextRole : derivedRole;
  return cards.map((card, order) => {
    const cardRole = normalizeLibraryRole(card.role) || '综合';
    const names = (card.heroes || []).map(norm);
    const matchesHero = hero && names.includes(hero);
    const hasMapGate = (card.maps || []).length > 0;
    const matchesMap = hasMapGate && card.maps.some(m => map && (map.includes(norm(m)) || norm(m).includes(map)));
    if (cardRole === '版本') {
      const heroHit = names.length > 0 && matchesHero;
      const mapHit = hasMapGate && matchesMap;
      if (names.length || hasMapGate) {
        if (!heroHit && !mapHit && !patchFocus) return null;
      } else if (!patchFocus) {
        return null;
      }
    } else {
      if (names.length && !matchesHero) return null;
      if (hasMapGate && !matchesMap) return null;
      if (cardRole !== '综合' && cardRole !== role && !matchesHero) return null;
    }
    let score = matchesHero ? 12 : 0;
    if (role && cardRole === role && cardRole !== '综合') score += 5;
    if (cardRole === '综合') score += 2;
    if (cardRole === '版本') score += matchesHero ? 4 : 1;
    if (!names.length) score += 1;
    for (const tag of card.tags || [])
      if (topic.includes(norm(tag))) score += 3;
    if (stages.includes(card.stage) && topic.includes(norm(card.stage))) score += 2;
    if (card.kind === '观摩索引') score -= 1;
    return {
      card: {
        ...card,
        role: cardRole,
        stage: cardStage(card)
      },
      score,
      order
    };
  }).filter(Boolean).sort((a, b) => b.score - a.score || a.order - b.order);
}

export function selectNotes(cards, context, limit = 8) {
  return rankedNotes(cards, context).slice(0, limit).map(x => x.card);
}

/** Cards selected at import; empty/missing ids fall back to all version cards. */
export function knowledgePool(cards, match) {
  const list = Array.isArray(cards) ? cards : [];
  const ids = match?.context?.knowledgeIds;
  if (Array.isArray(ids) && ids.length) {
    const set = new Set(ids);
    const picked = list.filter(c => set.has(c.id));
    if (picked.length) return picked;
  }
  const version = list.filter(c => normalizeLibraryRole(c.role) === '版本');
  return version.length ? version : list;
}

function noteTokens(...parts) {
  const text = parts.filter(Boolean).join(' ');
  return [...new Set(text.split(/[\s,，、/]+/).map(t => norm(t)).filter(t => t.length >= 2))];
}

function cardHaystack(card) {
  return norm([
    ...(card.tags || []),
    card.principle,
    card.application
  ].join(' '));
}

/** Rank notes for a concrete decision query (action/threat/stage/focus). */
export function selectNotesForDecision(cards, query, limit = 8) {
  const context = {
    hero: query?.hero,
    map: query?.map,
    role: query?.role,
    focus: [query?.action, query?.threat, query?.stage, query?.focus].filter(Boolean).join(' ')
  };
  const ranked = rankedNotes(cards, context);
  const tokens = noteTokens(query?.action, query?.threat);
  if (!tokens.length) return ranked.slice(0, limit).map(x => x.card);
  const boosted = ranked.map(item => {
    const hay = cardHaystack(item.card);
    let bonus = 0;
    for (const tok of tokens)
      if (hay.includes(tok)) bonus += 4;
    return {
      ...item,
      score: item.score + bonus
    };
  }).sort((a, b) => b.score - a.score || a.order - b.order);
  return boosted.slice(0, limit).map(x => x.card);
}

export function selectNotesForWave(cards, context, limit = 6) {
  const ranked = rankedNotes(cards, context);
  const picked = [];
  const used = new Set();
  for (const stage of waveStages) {
    const hit = ranked.find(x => !used.has(x.card.id) && x.card.stage === stage);
    if (hit) {
      used.add(hit.card.id);
      picked.push(hit.card);
    }
  }
  for (const item of ranked) {
    if (picked.length >= limit) break;
    if (used.has(item.card.id)) continue;
    used.add(item.card.id);
    picked.push(item.card);
  }
  return picked;
}

export function knowledgeCoverage(cards, focusHeroes = heroes) {
  const list = (Array.isArray(cards) ? cards : []).filter(card => normalizeLibraryRole(card.role) !== '版本');
  const matrix = focusHeroes.map(hero => {
    const owned = stages.filter(stage => list.some(card => {
      const names = card.heroes || [];
      const matchesHero = !names.length || names.some(name => norm(name) === norm(hero));
      return matchesHero && cardStage(card) === stage;
    }));
    return {
      hero,
      stages: owned,
      missing: stages.filter(stage => !owned.includes(stage))
    };
  });
  const missing = matrix.flatMap(row => row.missing.map(stage => ({
    hero: row.hero,
    stage
  })));
  return {
    matrix,
    missing,
    filled: matrix.reduce((n, row) => n + row.stages.length, 0),
    total: focusHeroes.length * stages.length
  };
}

export function stripTranscript(text) {
  return String(text || '')
    .replace(/\ufeff/g, '')
    .replace(/^\s*\d+\s*$/gm, '')
    .replace(/^\s*\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?\s*-->\s*\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?\s*$/gm, '')
    .replace(/^\s*\[\d{1,2}:\d{2}(?::\d{2})?\]\s*/gm, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function splitTranscript(text, size = 2000) {
  const clean = stripTranscript(text);
  if (!clean) return [];
  if (clean.length <= size) return [clean];
  const chunks = [];
  let rest = clean;
  while (rest.length > size) {
    const window = rest.slice(0, size);
    let cut = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('\n'), window.lastIndexOf('。'), window.lastIndexOf('！'), window.lastIndexOf('？'), window.lastIndexOf('.'));
    if (cut < size * 0.4) cut = size;
    const piece = rest.slice(0, cut).trim();
    if (piece) chunks.push(piece);
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

export function containsVague(text) {
  const value = String(text || '');
  return vaguePhrases.find(phrase => value.includes(phrase)) || '';
}

export function safeLink(value) {
  try {
    const u = new URL(value);
    return ['https:', 'http:'].includes(u.protocol) ? u.href : '';
  } catch {
    return '';
  }
}
