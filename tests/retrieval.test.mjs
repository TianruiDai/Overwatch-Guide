import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readFile
} from 'node:fs/promises';
import {
  selectNotes,
  sampleWindows
} from '../shared/domain.mjs';
const cards = JSON.parse(await readFile(new URL('../shared/knowledge.json', import.meta.url)));
test('unidentified footage gets general coaching and a known map does not borrow another map’s opening', () => {
  assert.ok(selectNotes(cards, {}).every(c => c.role === '通用'));
  const chosen = selectNotes(cards, {
    hero: '温斯顿',
    map: '多拉多',
    role: '通用'
  });
  assert.ok(chosen.every(c => ['重装', '通用'].includes(c.role)));
  assert.ok(!chosen.some(c => c.id === 'winston-kings-row'));
  assert.ok(selectNotes(cards, {
    hero: '温斯顿',
    map: '国王大道',
    role: '重装'
  })[0].id === 'winston-kings-row');
});
test('short and long ranges sample only the selected time range, with unique timestamps and at most eight images per request', () => {
  for (const [start, end, step] of [
      [6, 6.3, 4],
      [18.5, 125.2, 2],
      [0, 9, 4],
      [1, 63, 1]
    ]) {
    const windows = sampleWindows(start, end, step),
      times = windows.flat();
    assert.equal(times[0], start);
    assert.ok(windows.every(w => w.length > 0 && w.length <= 8));
    assert.ok(times.every((t, i) => t >= start && t < end && (!i || t > times[i - 1])));
  }
});
