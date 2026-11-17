import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRosters
} from '../shared/domain.mjs';
import {
  handleApi
} from '../server/api.mjs';
import {
  readMatch
} from '../server/read-match.mjs';
import {
  reviewFight
} from '../server/fight.mjs';
import {
  writeCoachV2
} from '../server/coach.mjs';

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

test('normalizeRosters keeps mirror hero on enemies when not POV', () => {
  assert.deepEqual(normalizeRosters({
    allies: ['温斯顿', '源氏'],
    enemies: ['温斯顿', '西拉']
  }, '源氏'), {
    allies: ['源氏', '温斯顿'],
    enemies: ['温斯顿', '西拉']
  });
});

test('readMatch mock returns handoff 200', async () => {
  const handoff = {
    source: '国王大道片段',
    player: '玩家A',
    rounds: [{
      id: 'R1',
      map: '国王大道'
    }],
    lineups: [{
      player_hero: '源氏',
      allies: ['温斯顿', '源氏'],
      enemies: ['西拉', '温斯顿']
    }],
    swaps: [],
    evidence: [{
      id: 'E1',
      start_s: 8,
      end_s: 8,
      frame_ids: ['f0']
    }],
    fights: [{
      id: 'F1',
      evidence_ids: ['E1'],
      start_s: 8,
      end_s: 10
    }],
    playstyle: []
  };
  const result = await readMatch({
    frames: [{
      time: 8,
      image: jpeg
    }],
    settings,
    context: {
      hero: '温斯顿'
    }
  }, env, async () => modelOk(handoff));
  assert.equal(result.source, handoff.source);
  assert.equal(result.fights[0].id, 'F1');
  assert.equal(result.lineups[0].enemies.includes('温斯顿'), true);
  assert.equal(result.skill.stage, 'read-match');

  const res = await handleApi(new Request('http://guide.invalid/api/v2/match/read', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      frames: [{
        time: 4,
        image: jpeg
      }],
      settings
    })
  }), env, {
    fetcher: async () => modelOk(handoff)
  });
  assert.equal(res.status, 200);
});

test('invalid handoff without needs_frames returns 502', async () => {
  await assert.rejects(() => readMatch({
    frames: [{
      time: 1,
      image: jpeg
    }],
    settings
  }, env, async () => modelOk({
    source: 'x',
    player: '',
    rounds: [],
    lineups: [],
    evidence: [],
    fights: [{
      id: 'F1',
      evidence_ids: ['E_MISSING']
    }]
  })), err => {
    assert.equal(err.status, 502);
    return true;
  });
});

test('reviewFight mock returns fight review', async () => {
  const review = {
    fight_id: 'F1',
    trigger: '西格玛开大起手',
    action: '温斯顿继续贴脸输出',
    result: '被引力乱流抬起后阵亡',
    keep: '先手逼退辅助',
    next: '听见语音时横向跳离范围',
    basis: 'model_inference',
    citations: [{
      kind: 'match',
      evidence_id: 'E1'
    }, {
      kind: 'teaching',
      card_id: 'winston-kings-row'
    }]
  };
  const out = await reviewFight({
    fight_id: 'F1',
    fight: {
      id: 'F1',
      ally_action: '贴脸'
    },
    evidence: [{
      id: 'E1'
    }],
    cards: [{
      id: 'winston-kings-row',
      title: '落点',
      kind: '教练笔记'
    }],
    settings
  }, env, async () => modelOk(review));
  assert.equal(out.fight_id, 'F1');
  assert.equal(out.citations.length, 2);
  assert.equal(out.skill.stage, 'fight');
});

test('writeCoachV2 mock returns two sections', async () => {
  const payload = {
    title: '国王大道进攻温斯顿',
    sections: [{
      heading: '一、先明确这局应该怎么打',
      body: '己方推进 A 点，温斯顿负责开视野与占高台。',
      decisionIds: ['F1']
    }, {
      heading: '二、逐波执行',
      body: '二楼处理西拉后再决定是否压双辅。'
    }],
    closing: '下局先数清能跳的撤离窗口。',
    citations: [{
      kind: 'match',
      evidence_id: 'E1',
      time: 67
    }]
  };
  const out = await writeCoachV2({
    settings,
    context: {
      hero: '温斯顿',
      map: '国王大道'
    },
    handoff: {
      lineups: [{
        allies: ['温斯顿', '源氏'],
        enemies: ['西拉']
      }]
    },
    fightReviews: [{
      fight_id: 'F1',
      next: '二楼施压后再进场'
    }]
  }, env, async () => modelOk(payload));
  assert.equal(out.sections.length, 2);
  assert.match(out.sections[0].heading, /应该怎么打/);
  assert.equal(out.skill.stage, 'coach');
});