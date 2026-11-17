function push(errors, message) {
  errors.push(message);
}

function isArray(value) {
  return Array.isArray(value);
}

function assertTime(errors, label, value) {
  if (value === undefined) return;
  if (value !== null && (typeof value !== 'number' || Number.isNaN(value))) {
    push(errors, `${label}: expected number or null`);
  }
}

function checkEvidenceIds(errors, prefix, ids, known) {
  if (ids === undefined) return;
  if (!isArray(ids)) {
    push(errors, `${prefix}: evidence_ids must be an array`);
    return;
  }
  for (const eid of ids) {
    if (typeof eid !== 'string' || !eid) {
      push(errors, `${prefix}: invalid evidence_ids entry`);
      continue;
    }
    if (!known.has(eid)) push(errors, `${prefix}: unknown evidence ${eid}`);
  }
}

export function validateHandoff(data) {
  const errors = [];
  if (!data || typeof data !== 'object') {
    return { ok: false, errors: ['handoff: expected an object'] };
  }
  if (typeof data.source !== 'string' || !data.source) {
    push(errors, 'handoff: source required');
  }
  if (!Object.prototype.hasOwnProperty.call(data, 'player') || typeof data.player !== 'string') {
    push(errors, 'handoff: player required (string, may be empty)');
  }
  for (const key of ['rounds', 'lineups', 'evidence', 'fights']) {
    if (!isArray(data[key])) push(errors, `handoff: ${key} must be an array`);
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
    assertTime(errors, `evidence[${ev.id}].start_s`, ev.start_s);
    assertTime(errors, `evidence[${ev.id}].end_s`, ev.end_s);
  }

  for (let i = 0; i < data.fights.length; i++) {
    const fight = data.fights[i];
    const label = fight?.id ? `fights[${fight.id}]` : `fights[${i}]`;
    if (!fight || typeof fight !== 'object') {
      push(errors, `${label}: expected object`);
      continue;
    }
    assertTime(errors, `${label}.start_s`, fight.start_s);
    assertTime(errors, `${label}.end_s`, fight.end_s);
    checkEvidenceIds(errors, label, fight.evidence_ids, evidenceIds);
  }

  return { ok: errors.length === 0, errors };
}