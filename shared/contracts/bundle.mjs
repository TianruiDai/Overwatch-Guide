const CARD_STATUSES = new Set(['ready', 'needs_review', 'draft']);

function push(errors, message) {
  errors.push(message);
}

function isArray(value) {
  return Array.isArray(value);
}

function collectCardEvidenceIds(card) {
  const ids = [];
  if (isArray(card.evidence_ids)) ids.push(...card.evidence_ids);
  if (isArray(card.claims)) {
    for (const claim of card.claims) {
      if (claim && isArray(claim.evidence_ids)) ids.push(...claim.evidence_ids);
    }
  }
  return ids;
}

export function validateBundle(data) {
  const errors = [];
  if (!data || typeof data !== 'object') {
    return { ok: false, errors: ['bundle: expected an object'] };
  }
  for (const key of ['sources', 'evidence', 'cards']) {
    if (!isArray(data[key])) push(errors, `bundle: ${key} must be an array`);
  }
  if (errors.length) return { ok: false, errors };

  const evidenceIds = new Set();
  for (let i = 0; i < data.evidence.length; i++) {
    const ev = data.evidence[i];
    if (!ev || typeof ev !== 'object' || typeof ev.id !== 'string') {
      push(errors, `evidence[${i}]: id required`);
      continue;
    }
    if (evidenceIds.has(ev.id)) push(errors, `evidence: duplicate id ${ev.id}`);
    evidenceIds.add(ev.id);
  }

  for (let i = 0; i < data.cards.length; i++) {
    const card = data.cards[i];
    if (!card || typeof card !== 'object') {
      push(errors, `cards[${i}]: expected object`);
      continue;
    }
    if (typeof card.id !== 'string' || !card.id) push(errors, `cards[${i}]: id required`);
    if (typeof card.title !== 'string' || !card.title) push(errors, `cards[${i}]: title required`);
    if (card.status !== undefined && card.status !== null && !CARD_STATUSES.has(card.status)) {
      push(errors, `cards[${card.id || i}]: invalid status ${card.status}`);
    }
    for (const eid of collectCardEvidenceIds(card)) {
      if (typeof eid !== 'string' || !eid) {
        push(errors, `cards[${card.id || i}]: invalid evidence reference`);
        continue;
      }
      if (!evidenceIds.has(eid)) {
        push(errors, `cards[${card.id || i}]: unknown evidence ${eid}`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}