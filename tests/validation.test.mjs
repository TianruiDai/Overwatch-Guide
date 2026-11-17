import test from 'node:test';
import assert from 'node:assert/strict';
import {
  handleApi
} from '../server/api.mjs';

const settings = {
  provider: 'server'
};
const env = {
  OW_MODEL_BASE_URL: 'http://local-model.invalid/v1/',
  OW_MODEL_ID: 'vision-local',
  OW_MODEL_API_KEY: 'fixture-secret'
};
const image = 'data:image/jpeg;base64,/9j/2Q==';
const body = {
  settings,
  context: {},
  frames: [{
    time: 42,
    image
  }],
  notes: []
};
const event = {
  time: 42,
  observation: '靠墙',
  decision: '检查支援视野'
};
async function call(route, input, reply, extraHeaders = {}) {
  const request = new Request('http://guide.invalid/api/' + route, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders
    },
    body: JSON.stringify(input)
  });
  return handleApi(request, env, {
    fetcher: async (url, options) => {
      assert.equal(url, 'http://local-model.invalid/v1/chat/completions');
      assert.equal(options.headers.Authorization, 'Bearer fixture-secret');
      return Response.json({
        choices: [{
          message: {
            content: JSON.stringify(reply)
          }
        }]
      });
    }
  });
}
test('a model cannot invent an observation timestamp', async () => {
  const res = await call('review/window', body, {
    observations: [{
      frame: 1,
      title: 'A',
      observation: 'B',
      decision: 'C'
    }]
  });
  assert.equal(res.status, 502);
});
test('unreadable footage can produce a valid empty review without a synthesis call', async () => {
  const a = await call('review/window', body, {
    observations: []
  });
  assert.deepEqual(await a.json(), {
    observations: []
  });
  const b = await call('review/synthesize', {
    settings,
    events: []
  }, {});
  assert.deepEqual((await b.json()).fights, []);
});
test('synthesis preserves every observed event exactly once', async () => {
  const input = {
    settings,
    events: [event, {
      ...event,
      time: 43
    }]
  };
  for (const ids of [
      [0, 1],
      [0, 0],
      [2],
      [0]
    ]) {
    const res = await call('review/synthesize', input, {
      summary: '按时间回看',
      fights: [{
        title: '进场',
        eventIds: ids
      }],
      drills: ['检查落点']
    });
    assert.equal(res.status, ids.join() === '0,1' ? 200 : 502);
  }
});
test('a proposed coaching card must retain an exact source excerpt', async () => {
  const excerpt = '坦克在进场前看一眼队友能否跟上，对照掩体和目标位置再决定。';
  const output = {
    title: '开团时机',
    principle: '先看队友位置。',
    application: '在进场前暂停。',
    quote: '队友能否跟上'
  };
  assert.equal((await call('knowledge/distill', {
    settings,
    excerpt
  }, output)).status, 200);
  assert.equal((await call('knowledge/distill', {
    settings,
    excerpt
  }, {
    ...output,
    quote: '杜撰片段'
  })).status, 502);
});
test('unknown hero identification does not create a confident character or map', async () => {
  assert.deepEqual(await (await call('review/identify', body, {})).json(), {});
  assert.deepEqual(await (await call('review/identify', body, {
    hero: '安娜',
    role: '支援',
    map: '国王大道',
    frame: 0
  })).json(), {
    hero: '安娜',
    role: '支援',
    map: '国王大道',
    time: 42
  });
});
test('cross-origin requests and malformed replay codes do not reach providers', async () => {
  assert.equal((await call('review/window', body, null, {
    Origin: 'https://other.invalid'
  })).status, 403);
  assert.equal((await call('replay', {
    code: '../../'
  }, null)).status, 400);
  const status = await handleApi(new Request('https://example.invalid/api/status'), env);
  const exposed = await status.text();
  assert.ok(exposed.includes('vision-local'));
  assert.ok(!exposed.includes('fixture-secret'));
  assert.ok(!exposed.includes('local-model.invalid'));
});
