/** Normalized crop boxes for first-person identity reading (x0,y0,x1,y1 in 0–1). */
export const IDENTIFY_REGIONS = {
  full: {
    x0: 0,
    y0: 0,
    x1: 1,
    y1: 1
  },
  hud: {
    x0: 0,
    y0: 0.72,
    x1: 0.36,
    y1: 1
  },
  weapon: {
    x0: 0.30,
    y0: 0.55,
    x1: 0.70,
    y1: 1
  },
  abilities: {
    x0: 0.62,
    y0: 0.66,
    x1: 1,
    y1: 1
  },
  bars: {
    x0: 0,
    y0: 0,
    x1: 1,
    y1: 0.32
  }
};

/**
 * Plan identity crops for one primary timestamp (max 5 images).
 * Prefer mid-range stamp so HUD/hero bars are usually visible.
 */
export function identityCrops(times = []) {
  const stamps = [...new Set((Array.isArray(times) ? times : []).filter(t => Number.isFinite(t) && t >= 0))]
    .sort((a, b) => a - b);
  if (!stamps.length) return [];
  const time = stamps[Math.min(1, stamps.length - 1)] ?? stamps[0];
  return ['full', 'hud', 'bars', 'weapon', 'abilities'].map(region => ({
    id: 't0-' + region,
    time,
    region
  }));
}

export function regionBox(name) {
  return IDENTIFY_REGIONS[name] || null;
}
