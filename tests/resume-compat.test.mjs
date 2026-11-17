import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readFile
} from 'node:fs/promises';
import {
  CONTRACT_VERSION
} from '../shared/skills-manifest.mjs';
import {
  validateHandoff
} from '../shared/contracts/handoff.mjs';
import {
  reportMarkdown
} from '../shared/report-markdown.mjs';

test('skills manifest contract version is stable for cache keys', () => {
  assert.equal(typeof CONTRACT_VERSION, 'string');
  assert.match(CONTRACT_VERSION, /^v2\./);
});

test('legacy report without matchRead still renders markdown', () => {
  const md = reportMarkdown({
    context: {
      hero: '温斯顿',
      map: '国王大道'
    },
    coach: {
      title: '旧格式报告',
      sections: [{
        heading: '一、先明确这局应该怎么打',
        body: '先读枪线。'
      }, {
        heading: '二、第一阶段：00:08–00:41',
        body: '00:10 交罩。'
      }],
      closing: '下一局再练。'
    },
    sections: [],
    waves: [],
    events: [],
    notes: []
  });
  assert.match(md, /旧格式报告/);
  assert.match(md, /先明确这局应该怎么打/);
});

test('empty fights handoff is valid and can end a segment', () => {
  const handoff = {
    source: '空片段',
    player: '上传者',
    rounds: [],
    lineups: [],
    swaps: [],
    evidence: [],
    fights: [],
    playstyle: []
  };
  const result = validateHandoff(handoff);
  assert.equal(result.ok, true);
});

test('review resume skips identity when job.context exists', async () => {
  const src = await readFile(new URL('../public/review.mjs', import.meta.url), 'utf8');
  assert.match(src, /if \(!job\.context\)/);
  assert.match(src, /v2\/match\/read/);
  assert.match(src, /v2\/review\/fight/);
  assert.match(src, /v2\/review\/coach/);
  assert.match(src, /skillsUsed/);
});

test('storage v4 stores are declared', async () => {
  const src = await readFile(new URL('../public/storage.mjs', import.meta.url), 'utf8');
  assert.match(src, /indexedDB\.open\('overwatch-guide', 4\)/);
  for (const store of ['sources', 'evidence', 'bundles', 'jobs', 'matchReads', 'fights']) {
    assert.match(src, new RegExp(store));
  }
  assert.match(src, /saveBundle|saveJobCheckpoint/);
});
