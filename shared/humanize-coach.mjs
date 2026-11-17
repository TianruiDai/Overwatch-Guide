/** Layer-1 AI-tell cleanup for coach cards (game teaching voice, not academic prose). */

const FILLERS = [
  [/近年来[，,]?/g, ''],
  [/在当今(?:版本|环境)下[，,]?/g, ''],
  [/至关重要/g, '要紧'],
  [/具有重要意义/g, '有用'],
  [/深度剖析/g, '拆开看'],
  [/赋能/g, '帮助'],
  [/无缝衔接/g, '接得上'],
  [/充分利用/g, '用好'],
  [/有效提升/g, '提高'],
  [/全面提升/g, '提高'],
  [/显著提升/g, '提高'],
  [/值得注意的是[，,]?/g, ''],
  [/需要注意的是[，,]?/g, ''],
  [/不难发现[，,]?/g, ''],
  [/总而言之[，,]?/g, ''],
  [/综上所述[，,]?/g, ''],
  [/不仅(?:仅)?[^\n。！？]{0,24}(?:，|,)?\s*更/g, '还'],
  [/打通了?新的可能性/g, '多了选择'],
  [/革命性/g, ''],
  [/颠覆性/g, ''],
  [/优雅地/g, ''],
  [/巧妙地/g, ''],
  [/delve|underscore|intricate|tapestry|leverage|seamless|pivotal|showcase|foster|realm/gi, ''],
  [/—|–|―/g, '，'],
  [/\s{2,}/g, ' ']
];

export function humanizeCoachText(input = '') {
  let text = String(input || '').trim();
  if (!text) return '';
  for (const [pattern, repl] of FILLERS) text = text.replace(pattern, repl);
  text = text
    .replace(/，{2,}/g, '，')
    .replace(/。{2,}/g, '。')
    .replace(/\s+([，。！？])/g, '$1')
    .replace(/^[\s，,。]+/, '')
    .trim();
  return text;
}

export function humanizeCoachCard(card = {}) {
  return {
    ...card,
    title: humanizeCoachText(card.title || ''),
    principle: humanizeCoachText(card.principle || ''),
    application: humanizeCoachText(card.application || '')
  };
}
