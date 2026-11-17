import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBundle } from '../shared/contracts/bundle.mjs';
import { validateHandoff } from '../shared/contracts/handoff.mjs';
import { validateFightReview } from '../shared/contracts/fight.mjs';

const minimalBundle = {
  sources: [{ id: 'S1', title: 'demo' }],
  evidence: [{ id: 'E1', source_id: 'S1' }],
  cards: [{
    id: 'C1',
    title: 'First jump',
    status: 'ready',
    claims: [{ evidence_ids: ['E1'] }]
  }]
};

test('validateBundle accepts minimal consistent bundle', () => {
  const result = validateBundle(minimalBundle);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('validateBundle rejects duplicate evidence ids', () => {
  const result = validateBundle({
    sources: [],
    evidence: [{ id: 'E1' }, { id: 'E1' }],
    cards: [{ id: 'C1', title: 'x' }]
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('duplicate')));
});

const minimalHandoff = {
  source: '国王大道片段',
  player: '',
  rounds: [],
  lineups: [],
  evidence: [{ id: 'E1', start_s: 1, end_s: 2 }],
  fights: [{ id: 'F1', evidence_ids: ['E1'], start_s: null, end_s: null }]
};

test('validateHandoff accepts empty player and linked fights', () => {
  const result = validateHandoff(minimalHandoff);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('validateHandoff rejects fight evidence outside pool', () => {
  const result = validateHandoff({
    ...minimalHandoff,
    fights: [{ id: 'F1', evidence_ids: ['E_MISSING'] }]
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('unknown evidence')));
});

const minimalFightReview = {
  fight_id: 'F1',
  citations: [
    { kind: 'match', evidence_id: 'E1' },
    { kind: 'teaching', card_id: 'C1', claim_id: 'CL1' }
  ]
};

test('validateFightReview accepts citations without needs_frames', () => {
  const result = validateFightReview(minimalFightReview);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('validateFightReview rejects invalid needs_frames', () => {
  const result = validateFightReview({
    ...minimalFightReview,
    needs_frames: [{ start_s: 'bad', end_s: 2 }]
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('start_s')));
});