const CITATION_KINDS = new Set(['match', 'teaching']);

function push(errors, message) {
  errors.push(message);
}

function isArray(value) {
  return Array.isArray(value);
}

export function validateFightReview(data) {
  const errors = [];
  if (!data || typeof data !== 'object') {
    return { ok: false, errors: ['fight_review: expected an object'] };
  }
  const fightId = data.fight_id ?? data.id;
  if (typeof fightId !== 'string' || !fightId) {
    push(errors, 'fight_review: fight_id or id required');
  }
  if (!isArray(data.citations)) {
    push(errors, 'fight_review: citations must be an array');
  } else {
    for (let i = 0; i < data.citations.length; i++) {
      const cite = data.citations[i];
      const label = `citations[${i}]`;
      if (!cite || typeof cite !== 'object') {
        push(errors, `${label}: expected object`);
        continue;
      }
      if (!CITATION_KINDS.has(cite.kind)) {
        push(errors, `${label}: kind must be match or teaching`);
      }
    }
  }
  if (Object.prototype.hasOwnProperty.call(data, 'needs_frames')) {
    const frames = data.needs_frames;
    if (!isArray(frames)) {
      push(errors, 'fight_review: needs_frames must be an array');
    } else {
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const label = `needs_frames[${i}]`;
        if (!frame || typeof frame !== 'object') {
          push(errors, `${label}: expected object`);
          continue;
        }
        if (typeof frame.start_s !== 'number' || Number.isNaN(frame.start_s)) {
          push(errors, `${label}: start_s must be a number`);
        }
        if (typeof frame.end_s !== 'number' || Number.isNaN(frame.end_s)) {
          push(errors, `${label}: end_s must be a number`);
        }
      }
    }
  }
  return { ok: errors.length === 0, errors };
}