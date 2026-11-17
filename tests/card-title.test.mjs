import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readFile
} from 'node:fs/promises';
import {
  upName,
  cardTitle,
  normalizeCardNaming,
  groupCardsByUp
} from '../shared/card-title.mjs';

test('upName strips · suffix', () => {
  assert.equal(upName('孤雪 · OA-Guxue8'), '孤雪');
  assert.equal(upName('人上人老王'), '人上人老王');
  assert.equal(upName(''), '未署名');
});

test('hero-role cards get up-hero-title', () => {
  assert.equal(cardTitle({
    title: '矩阵朝向敌方来火',
    author: '暴雪娱乐',
    role: '重装',
    heroes: ['D.Va']
  }), '暴雪娱乐-D.Va-矩阵朝向敌方来火');
  assert.equal(cardTitle({
    title: '猎空闪现留给交火，不拿来赶路',
    author: '人上人老王',
    role: '输出',
    heroes: ['猎空']
  }), '人上人老王-猎空-猎空闪现留给交火，不拿来赶路');
  assert.equal(cardTitle({
    title: '多拉多温斯顿优先抢斜角高台压力',
    author: '孤雪 · OA-Guxue8',
    role: '重装',
    heroes: ['温斯顿']
  }), '孤雪-温斯顿-多拉多温斯顿优先抢斜角高台压力');
});

test('综合 and 版本 titles stay unchanged', () => {
  assert.equal(cardTitle({
    title: 'T位进场看队友枪线是否就位',
    author: '孤雪 · OA-Guxue8',
    role: '综合',
    heroes: []
  }), 'T位进场看队友枪线是否就位');
  assert.equal(cardTitle({
    title: '国王大道·地图落位要点',
    author: '暴雪娱乐',
    role: '版本',
    maps: ['国王大道']
  }), '国王大道·地图落位要点');
});

test('hero-role without heroes becomes 综合', () => {
  const next = normalizeCardNaming({
    id: 'spilo-tank-engage',
    title: '等队友能出手再压进去',
    author: 'Spilo',
    role: '重装',
    heroes: []
  });
  assert.equal(next.role, '综合');
  assert.equal(next.title, '等队友能出手再压进去');
});

test('normalizeCardNaming is idempotent', () => {
  const once = normalizeCardNaming({
    title: '破坏球先选落点再甩钩',
    author: '人上人老王',
    role: '重装',
    heroes: ['破坏球']
  });
  const twice = normalizeCardNaming(once);
  assert.deepEqual(twice, once);
  assert.equal(once.title, '人上人老王-破坏球-破坏球先选落点再甩钩');
});

test('knowledge.json hero-role cards follow naming invariant', async () => {
  const cards = JSON.parse(await readFile(new URL('../shared/knowledge.json', import.meta.url), 'utf8'));
  assert.ok(Array.isArray(cards) && cards.length > 0);
  for (const card of cards) {
    if (!['重装', '输出', '辅助'].includes(card.role)) continue;
    assert.ok(Array.isArray(card.heroes) && card.heroes[0], card.id + ' missing hero');
    const prefix = upName(card.author) + '-' + card.heroes[0] + '-';
    assert.ok(card.title.startsWith(prefix), card.id + ' title=' + card.title);
  }
});

test('groupCardsByUp groups by up主 and sorts by size', () => {
  const groups = groupCardsByUp([{
    id: 'a',
    author: '孤雪 · OA-Guxue8'
  }, {
    id: 'b',
    author: '人上人老王'
  }, {
    id: 'c',
    author: '人上人老王'
  }, {
    id: 'd',
    author: '孤雪 · OA-Guxue8'
  }, {
    id: 'e',
    author: '人上人老王'
  }]);
  assert.equal(groups[0].up, '人上人老王');
  assert.equal(groups[0].cards.length, 3);
  assert.equal(groups[1].up, '孤雪');
  assert.deepEqual(groups[1].cards.map(c => c.id), ['a', 'd']);
});

test('review import picker groups cards by up主 with select-all', async () => {
  const src = await readFile(new URL('../public/app.mjs', import.meta.url), 'utf8');
  assert.match(src, /groupCardsByUp/);
  assert.match(src, /data-all-group/);
  assert.match(src, /data-bulk="all"/);
  assert.match(src, /name="knowledge"/);
});
