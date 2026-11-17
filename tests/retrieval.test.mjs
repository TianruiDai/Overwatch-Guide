import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readFile
} from 'node:fs/promises';
import {
  selectNotes,
  selectNotesForDecision,
  selectNotesForWave,
  knowledgeCoverage,
  knowledgePool,
  sampleWindows,
  stages,
  heroes,
  normalizeIdentity,
  normalizeRosters
} from '../shared/domain.mjs';
import {
  COACH_SKILL
} from '../shared/coach-skill.mjs';
const cards = JSON.parse(await readFile(new URL('../shared/knowledge.json', import.meta.url)));
test('normalizeIdentity whitelists hero and map and derives role from hero', () => {
  assert.deepEqual(normalizeIdentity({
    hero: '安娜',
    role: '重装',
    map: '国王大道',
    side: '进攻',
    time: 12
  }), {
    hero: '安娜',
    map: '国王大道',
    role: '辅助',
    side: '进攻',
    time: 12
  });
  assert.equal(normalizeIdentity({
    hero: '虚构英雄',
    map: '国王大道'
  }).hero, undefined);
  assert.equal(normalizeIdentity({
    hero: '安娜',
    map: '不存在的地图'
  }).map, undefined);
  assert.deepEqual(normalizeIdentity({
    hero: '不是英雄',
    map: '也不是地图'
  }), {
    side: '未指定'
  });
});
test('normalizeRosters whitelists heroes and keeps POV out of enemies', () => {
  assert.deepEqual(normalizeRosters({
    allies: ['温斯顿', '虚构'],
    enemies: ['西拉', '索杰恩', '温斯顿', '不是英雄'],
    swaps: ['卡西迪']
  }, '温斯顿'), {
    allies: ['温斯顿'],
    enemies: ['西拉', '索杰恩'],
    swaps: ['卡西迪']
  });
  assert.deepEqual(normalizeRosters({
    allies: ['温斯顿', '源氏'],
    enemies: ['温斯顿', '西拉']
  }, '温斯顿'), {
    allies: ['温斯顿', '源氏'],
    enemies: ['西拉']
  });
  assert.deepEqual(normalizeRosters({
    allies: ['温斯顿', '源氏'],
    enemies: ['温斯顿', '西拉']
  }, '源氏'), {
    allies: ['源氏', '温斯顿'],
    enemies: ['温斯顿', '西拉']
  });
});
test('default coach skill requires two-part essay structure', () => {
  assert.match(COACH_SKILL, /先明确这局应该怎么打/);
  assert.match(COACH_SKILL, /逐段分析/);
  assert.match(COACH_SKILL, /西拉≠索杰恩/);
});
test('unidentified footage gets general coaching and a known map does not borrow another map’s opening', () => {
  assert.ok(selectNotes(cards, {}).every(c => c.role === '综合'));
  const chosen = selectNotes(cards, {
    hero: '温斯顿',
    map: '多拉多',
    role: '综合'
  });
  assert.ok(chosen.every(c => ['重装', '综合', '版本'].includes(c.role)));
  assert.ok(!chosen.some(c => c.id === 'winston-kings-row'));
  assert.ok(selectNotes(cards, {
    hero: '温斯顿',
    map: '国王大道',
    role: '重装'
  })[0].id === 'winston-kings-row');
});
test('version cards only appear when the hero or map matches or focus asks for patches', () => {
  assert.ok(heroes.includes('西拉'));
  assert.ok(cards.some(c => c.id === 'version-ability-sierra'));
  const silent = selectNotes(cards, {
    hero: '安娜',
    role: '辅助'
  });
  assert.ok(!silent.some(c => c.role === '版本' && (c.heroes || []).includes('破坏球')));
  const byHero = selectNotes(cards, {
    hero: '破坏球',
    role: '重装'
  });
  assert.ok(byHero.some(c => c.role === '版本' && c.id === 'patch-2026-11-05-ball'));
  assert.ok(byHero.some(c => c.id === 'version-ability-wrecking-ball'));
  const byMap = selectNotes(cards, {
    hero: '安娜',
    map: '国王大道',
    role: '辅助'
  });
  assert.ok(byMap.some(c => String(c.id).startsWith('version-map-') && (c.maps || []).includes('国王大道')));
  const byFocus = selectNotes(cards, {
    hero: '安娜',
    role: '辅助',
    focus: '看看版本补丁改动'
  });
  assert.ok(byFocus.some(c => c.role === '版本'));
});
test('knowledgePool respects import knowledgeIds and falls back to version cards', () => {
  const ids = ['version-ability-sierra', 'spilo-tank-engage'];
  const pool = knowledgePool(cards, {
    context: {
      knowledgeIds: ids
    }
  });
  assert.equal(pool.length, 2);
  assert.ok(pool.every(c => ids.includes(c.id)));
  const fallback = knowledgePool(cards, {
    context: {}
  });
  assert.ok(fallback.length > 10);
  assert.ok(fallback.every(c => c.role === '版本'));
});
test('selectNotesForDecision falls back like rankedNotes without action tokens', () => {
  const ctx = {
    hero: '温斯顿',
    map: '国王大道',
    role: '重装'
  };
  const baseline = selectNotes(cards, ctx, 8).map(c => c.id);
  const silent = selectNotesForDecision(cards, ctx, 8).map(c => c.id);
  assert.deepEqual(silent, baseline);
  const focused = selectNotesForDecision(cards, {
    ...ctx,
    action: '国王大道',
    threat: '落位',
    stage: '团战',
    focus: '推进'
  }, 8);
  assert.ok(focused.length >= 1);
  assert.ok(focused.length <= 8);
});
test('wave retrieval covers priority stages when cards exist', () => {
  const picked = selectNotesForWave(cards, {
    hero: '温斯顿',
    map: '国王大道',
    role: '重装'
  });
  assert.ok(picked.length >= 4);
  assert.ok(picked.some(c => c.stage === '落位'));
  assert.ok(picked.some(c => c.stage === '团战'));
  assert.equal(new Set(picked.map(c => c.id)).size, picked.length);
});
test('knowledge coverage reports missing hero-stage pairs and skips version cards', () => {
  const coverage = knowledgeCoverage(cards, ['温斯顿', '猎空']);
  assert.equal(coverage.total, 2 * stages.length);
  assert.ok(coverage.filled > 0);
  assert.ok(coverage.missing.every(item => stages.includes(item.stage)));
  assert.ok(coverage.matrix.find(row => row.hero === '温斯顿').stages.includes('落位'));
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
