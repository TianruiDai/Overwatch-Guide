import test from 'node:test';
import assert from 'node:assert/strict';
import {
  skillForStage,
  stageMessages
} from '../server/skills.mjs';
import {
  COACH_SKILL
} from '../shared/coach-skill.mjs';

test('skillForStage distill has body', () => {
  const skill = skillForStage('distill');
  assert.ok(skill.body && skill.body.length > 20);
});

test('stageMessages coach includes COACH_SKILL phrase or length>2 messages', () => {
  const messages = stageMessages('coach');
  const text = messages.map(m => m.content).join('\n');
  assert.ok(text.includes('先明确这局应该怎么打') || messages.length > 2);
  assert.match(COACH_SKILL, /先明确这局应该怎么打/);
});

test('unknown stage throws', () => {
  assert.throws(() => skillForStage('not-a-stage'), /未知技能阶段/);
});