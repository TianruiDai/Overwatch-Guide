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
    model: 'deepseek-v4',
    base: 'https://api.deepseek.com/v1'
  },
  custom: {
    name: '自定义 · OpenAI 兼容',
    model: '',
    base: ''
  }
};

export const roles = ['重装', '输出', '支援', '通用'];
export const categories = ['落位', '技能', '集火', '团战', '撤退', '视野'];
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

export function selectNotes(cards, context, limit = 5) {
  const norm = s => String(s || '').replace(/\s+/g, '').toLowerCase();
  const hero = norm(context.hero);
  const map = norm(context.map);
  const derivedRole = hero && cards.find(c => (c.heroes || []).some(name => norm(name) === hero))?.role;
  const role = context.role && context.role !== '通用' ? context.role : derivedRole;
  const topic = norm([context.map, context.focus, context.hero, context.side].join(' '));
  return cards.map((card, order) => {
    const names = (card.heroes || []).map(norm);
    const matchesHero = hero && names.includes(hero);
    if (names.length && !matchesHero) return null;
    if (card.maps?.length && !card.maps.some(m => map && map.includes(norm(m)))) return null;
    if (card.role !== '通用' && card.role !== role && !matchesHero) return null;
    let score = matchesHero ? 10 : 0;
    if (role === card.role && card.role !== '通用') score += 4;
    if (card.role === '通用') score += 2;
    for (const tag of card.tags || [])
      if (topic.includes(norm(tag))) score += 3;
    if (card.kind === '观摩索引') score -= 1;
    return {
      card,
      score,
      order
    };
  }).filter(Boolean).sort((a, b) => b.score - a.score || a.order - b.order).slice(0, limit).map(x => x.card);
}

export function safeLink(value) {
  try {
    const u = new URL(value);
    return ['https:', 'http:'].includes(u.protocol) ? u.href : '';
  } catch {
    return '';
  }
}
