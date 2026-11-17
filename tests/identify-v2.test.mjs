import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readFile
} from 'node:fs/promises';
import {
  normalizeRosters,
  normalizeTeamColor
} from '../shared/domain.mjs';
import {
  identityCrops,
  IDENTIFY_REGIONS
} from '../shared/identify-regions.mjs';
import {
  finalizeIdentity,
  identifyMatchV2
} from '../server/identify.mjs';
import {
  handleApi
} from '../server/api.mjs';

const jpeg = 'data:image/jpeg;base64,/9j/2Q==';
const settings = {
  provider: 'server'
};
const env = {
  OW_MODEL_BASE_URL: 'http://local-model.invalid/v1',
  OW_MODEL_ID: 'vision-local',
  OW_MODEL_API_KEY: 'fixture-secret'
};
const modelOk = body => Response.json({
  choices: [{
    message: {
      content: typeof body === 'string' ? body : JSON.stringify(body)
    }
  }]
});

const sampleFrames = [{
  id: 't0-full',
  time: 8,
  region: 'full',
  image: jpeg
}, {
  id: 't0-hud',
  time: 8,
  region: 'hud',
  image: jpeg
}, {
  id: 't0-bars',
  time: 8,
  region: 'bars',
  image: jpeg
}, {
  id: 't0-weapon',
  time: 8,
  region: 'weapon',
  image: jpeg
}, {
  id: 't0-abilities',
  time: 8,
  region: 'abilities',
  image: jpeg
}];

test('normalizeTeamColor maps blue/red aliases', () => {
  assert.equal(normalizeTeamColor('蓝色'), 'blue');
  assert.equal(normalizeTeamColor('red'), 'red');
  assert.equal(normalizeTeamColor(''), 'unknown');
});

test('identityCrops covers required regions within 5 frames', () => {
  const crops = identityCrops([12, 48]);
  assert.equal(crops.length, 5);
  const regions = new Set(crops.map(c => c.region));
  for (const name of ['full', 'hud', 'bars', 'weapon', 'abilities']) {
    assert.ok(regions.has(name), 'missing ' + name);
    assert.ok(IDENTIFY_REGIONS[name]);
  }
});

test('identifyMatchV2 soft-fails instead of throwing on bad model JSON', async () => {
  const result = await identifyMatchV2({
    settings,
    frames: sampleFrames
  }, env, async () => modelOk('not-json <<<'));
  assert.equal(result.softFail, true);
  assert.equal(result.hero || '', '');
  assert.ok(result.skill);
});

test('finalizeIdentity maps blue team row to allies', () => {
  const out = finalizeIdentity({
    pov: {
      hero: '巴蒂斯特',
      team: 'blue',
      evidence: 'abilities 不朽装置'
    },
    teams: {
      blue: ['奥丽莎', '巴蒂斯特', '卢西奥', '卡西迪', '源氏'],
      red: ['D.Va', '莱因哈特', '源氏', '卢西奥', '莫伊拉'],
      evidence: 'bars 顶部两行'
    },
    map: {
      name: '国王大道',
      evidence: 'full 地图标题'
    },
    side: '进攻'
  });
  assert.equal(out.hero, '巴蒂斯特');
  assert.equal(out.team, 'blue');
  assert.equal(out.teamKnown, true);
  assert.equal(out.map, '国王大道');
  assert.ok(out.allies.includes('巴蒂斯特'));
  assert.ok(!out.enemies.includes('巴蒂斯特'));
  assert.deepEqual(out.allies.slice(0, 5).sort(), ['卢西奥', '奥丽莎', '巴蒂斯特', '卡西迪', '源氏'].sort());
});

test('finalizeIdentity maps red team row to allies', () => {
  const out = finalizeIdentity({
    pov: {
      hero: '莫伊拉',
      team: 'red'
    },
    teams: {
      blue: ['奥丽莎', '巴蒂斯特', '卢西奥', '卡西迪', '源氏'],
      red: ['D.Va', '莱因哈特', '源氏', '卢西奥', '莫伊拉']
    },
    map: {
      name: '国王大道'
    },
    side: '防守'
  });
  assert.equal(out.team, 'red');
  assert.ok(out.allies.includes('莫伊拉'));
  assert.ok(out.allies.includes('D.Va'));
  assert.ok(out.enemies.includes('奥丽莎'));
});

test('normalizeRosters caps each side at 5 and keeps POV on allies', () => {
  const out = normalizeRosters({
    allies: ['奥丽莎', '巴蒂斯特', '卢西奥', '卡西迪', '源氏', '猎空'],
    enemies: ['D.Va', '莱因哈特', '源氏', '卢西奥', '莫伊拉', '雾子'],
    hero: '巴蒂斯特'
  }, '巴蒂斯特');
  assert.equal(out.allies.length, 5);
  assert.equal(out.enemies.length, 5);
  assert.equal(out.allies[0], '巴蒂斯特');
  assert.ok(!out.enemies.includes('巴蒂斯特'));
});

test('mirror lineups keep non-POV shared hero on both sides', () => {
  assert.deepEqual(normalizeRosters({
    allies: ['源氏', '巴蒂斯特'],
    enemies: ['源氏', '莫伊拉']
  }, '巴蒂斯特'), {
    allies: ['巴蒂斯特', '源氏'],
    enemies: ['源氏', '莫伊拉']
  });
});

test('identifyMatchV2 returns POV and teams from mock model', async () => {
  const result = await identifyMatchV2({
    settings,
    frames: sampleFrames
  }, env, async () => modelOk({
    pov: {
      hero: '巴蒂斯特',
      team: 'blue',
      role: '辅助',
      confidence: '清晰',
      evidence: 'abilities 不朽装置'
    },
    teams: {
      blue: ['奥丽莎', '巴蒂斯特', '卢西奥', '卡西迪', '源氏'],
      red: ['D.Va', '莱因哈特', '源氏', '卢西奥', '莫伊拉'],
      evidence: 'bars'
    },
    map: {
      name: '国王大道',
      confidence: '清晰',
      evidence: 'full'
    },
    side: '进攻',
    frameEvidence: {
      pov: 't0-abilities',
      team: 't0-hud',
      bars: 't0-bars',
      map: 't0-full'
    }
  }));
  assert.equal(result.hero, '巴蒂斯特');
  assert.equal(result.team, 'blue');
  assert.equal(result.map, '国王大道');
  assert.equal(result.teams.teamKnown, true);
  assert.equal(result.skill.stage, 'read-match');
});

test('POST /api/v2/match/identify returns 200', async () => {
  const res = await handleApi(new Request('https://example.invalid/api/v2/match/identify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      settings,
      frames: sampleFrames
    })
  }), env, {
    fetcher: async () => modelOk({
      pov: {
        hero: '巴蒂斯特',
        team: 'blue'
      },
      teams: {
        blue: ['巴蒂斯特'],
        red: ['莫伊拉']
      },
      map: {
        name: '国王大道'
      },
      side: '进攻'
    })
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.hero, '巴蒂斯特');
});

test('read-match skill anchors first-person, hud, and hero bars', async () => {
  const src = await readFile(new URL('../skills/overwatch-read-match/SKILL.md', import.meta.url), 'utf8');
  assert.match(src, /第一视角/);
  assert.match(src, /左下角/);
  assert.match(src, /英雄条/);
  assert.match(src, /weapon/);
  assert.match(src, /abilities/);
});
