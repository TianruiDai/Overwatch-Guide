import test from 'node:test';
import assert from 'node:assert/strict';
import {
  handleApi
} from '../server/api.mjs';
import {
  createTeachingSource,
  distillUnits,
  getTeachingSource
} from '../server/teaching.mjs';

function bilibiliFetcher() {
  return async url => {
    const href = String(url);
    if (href.includes('pagelist')) {
      return Response.json({
        code: 0,
        data: [{
          page: 1,
          cid: 4242,
          part: '正片'
        }]
      });
    }
    if (href.includes('web-interface/view')) {
      return Response.json({
        code: 0,
        data: {
          title: '温斯顿落位课',
          desc: '先看队友能否跟上。',
          owner: {
            name: '讲师老王'
          }
        }
      });
    }
    if (href.includes('player/v2')) {
      return Response.json({
        code: 0,
        data: {
          subtitle: {
            subtitles: []
          }
        }
      });
    }
    return new Response('missing', {
      status: 404
    });
  };
}

test('createTeachingSource with bilibili URL stores page', async () => {
  const page = await createTeachingSource({
    url: 'https://www.bilibili.com/video/BV1Td4y1w7qM/?p=1'
  }, {}, bilibiliFetcher());
  assert.equal(page.platform, 'bilibili');
  assert.equal(page.bvid, 'BV1Td4y1w7qM');
  assert.equal(page.title, '温斯顿落位课');
  assert.ok(page.id);
  assert.ok(page.missing.includes('captions'));
  assert.equal(getTeachingSource(page.id).url, page.url);
});

test('GET source by id via API', async () => {
  const page = await createTeachingSource({
    url: 'https://www.bilibili.com/video/BV1Td4y1w7qM/'
  }, {}, bilibiliFetcher());
  const res = await handleApi(new Request(`http://guide.invalid/api/v2/teaching/sources/${page.id}`, {
    method: 'GET'
  }), {}, {
    fetcher: bilibiliFetcher()
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.id, page.id);
  assert.equal(data.author, '讲师老王');
});

test('distillUnits with excerpt returns multiple units', async () => {
  const excerpt = '坦克在进场前看一眼队友能否跟上，对照掩体和目标位置再决定。';
  const result = await distillUnits({
    excerpt,
    settings: {
      provider: 'server'
    }
  }, {
    OW_MODEL_BASE_URL: 'http://local-model.invalid/v1',
    OW_MODEL_ID: 'vision-local',
    OW_MODEL_API_KEY: 'fixture-secret'
  }, async () => Response.json({
    choices: [{
      message: {
        content: JSON.stringify({
          units: [{
              title: '开团时机',
              quote: '队友能否跟上',
              principle: '先看队友位置。',
              application: '在进场前暂停。',
              heroes: ['温斯顿'],
              maps: [],
              stage: '团战',
              role: 'tank',
              tags: ['进场'],
              basis: 'source_statement'
            }, {
              title: '掩体对照',
              quote: '对照掩体和目标位置',
              principle: '落点要对准掩体与目标。',
              application: '起跳前扫一眼地形。',
              heroes: ['温斯顿'],
              maps: [],
              stage: '落位',
              role: '重装',
              tags: [],
              basis: 'source_statement'
            }]
        })
      }
    }]
  }));
  assert.equal(result.units.length, 2);
  assert.equal(result.units[0].role, '重装');
  assert.equal(result.skill.stage, 'distill');
});

test('distillUnits rejects quote not in excerpt with 502', async () => {
  const excerpt = '坦克在进场前看一眼队友能否跟上，进场前必须对照掩体与目标。';
  await assert.rejects(() => distillUnits({
    excerpt,
    settings: {
      provider: 'server'
    }
  }, {
    OW_MODEL_BASE_URL: 'http://local-model.invalid/v1',
    OW_MODEL_ID: 'vision-local',
    OW_MODEL_API_KEY: 'fixture-secret'
  }, async () => Response.json({
    choices: [{
      message: {
        content: JSON.stringify({
          units: [{
              title: '开团时机',
              quote: '杜撰片段',
              principle: '先看队友位置。',
              application: '在进场前暂停。',
              stage: '团战',
              role: '综合',
              basis: 'model_inference'
            }]
        })
      }
    }]
  })), error => {
    assert.equal(error.status, 502);
    return true;
  });
});

test('v2 distill route preserves invalid quote status', async () => {
  const excerpt = '坦克在进场前看一眼队友能否跟上，进场前必须对照掩体与目标。';
  const res = await handleApi(new Request('http://guide.invalid/api/v2/knowledge/distill', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      excerpt,
      settings: {
        provider: 'server'
      }
    })
  }), {
    OW_MODEL_BASE_URL: 'http://local-model.invalid/v1',
    OW_MODEL_ID: 'vision-local',
    OW_MODEL_API_KEY: 'fixture-secret'
  }, {
    fetcher: async () => Response.json({
      choices: [{
        message: {
          content: JSON.stringify({
            units: [{
              title: '开团时机',
              quote: '杜撰片段',
              principle: '先看队友位置。',
              application: '在进场前暂停。',
              stage: '团战',
              role: '综合'
            }]
          })
        }
      }]
    })
  });
  assert.equal(res.status, 502);
});