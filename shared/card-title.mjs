import {
  normalizeLibraryRole
} from './domain.mjs';

const HERO_ROLES = new Set(['重装', '输出', '辅助']);

/** Author display name before " · " (e.g. 孤雪 · OA-Guxue8 → 孤雪). */
export function upName(author = '') {
  const text = String(author || '').trim();
  if (!text) return '未署名';
  const cut = text.split(/\s*·\s*/)[0].trim();
  return cut || text;
}

function firstHero(card = {}) {
  const heroes = Array.isArray(card.heroes) ? card.heroes : [];
  const hero = String(heroes[0] || '').trim();
  return hero || '';
}

/** Build unified title for tank/dps/support hero cards; otherwise keep title. */
export function cardTitle(card = {}) {
  const role = normalizeLibraryRole(card.role) || card.role || '';
  const title = String(card.title || '').trim();
  if (!HERO_ROLES.has(role)) return title;
  const hero = firstHero(card);
  if (!hero) return title;
  const up = upName(card.author);
  const prefix = up + '-' + hero + '-';
  if (title.startsWith(prefix)) return title;
  return prefix + title;
}

/**
 * Hero-role cards without heroes become 综合 (title unchanged).
 * Hero-role cards with heroes get unified titles.
 * 综合 / 版本 unchanged.
 */
export function normalizeCardNaming(card = {}) {
  if (!card || typeof card !== 'object') return card;
  const role = normalizeLibraryRole(card.role) || card.role || '';
  if (!HERO_ROLES.has(role)) return {
    ...card,
    title: String(card.title || '').trim()
  };
  const hero = firstHero(card);
  if (!hero) {
    return {
      ...card,
      role: '综合',
      title: String(card.title || '').trim()
    };
  }
  return {
    ...card,
    role,
    title: cardTitle(card)
  };
}

/** Group cards by up主 name (author before " · "), largest group first. */
export function groupCardsByUp(cards = []) {
  const groups = new Map();
  for (const card of Array.isArray(cards) ? cards : []) {
    if (!card) continue;
    const up = upName(card.author);
    if (!groups.has(up)) groups.set(up, []);
    groups.get(up).push(card);
  }
  return [...groups.entries()].map(([up, list]) => ({
    up,
    cards: list
  })).sort((a, b) => b.cards.length - a.cards.length || a.up.localeCompare(b.up, 'zh'));
}
