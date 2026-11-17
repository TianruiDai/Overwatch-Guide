import test from 'node:test';
import assert from 'node:assert/strict';
import {
  splitTranscript,
  stripTranscript
} from '../shared/domain.mjs';
import {
  handleApi
} from '../server/api.mjs';

test('transcript cleaning strips SRT clocks without cutting Chinese sentences', () => {
  const raw = `1
00:00:01,000 --> 00:00:04,000
坦克先停在拱门前看队友。

2
00:00:04,500 --> 00:00:08,000
确认雕像右侧没有人再跳。`;
  const clean = stripTranscript(raw);
  assert.ok(!clean.includes('-->'));
  assert.ok(clean.includes('坦克先停在拱门前看队友。'));
  assert.ok(clean.includes('确认雕像右侧没有人再跳。'));
});

test('splitTranscript keeps sentence boundaries under the size budget', () => {
  const text = Array.from({
    length: 40
  }, (_, i) => '这是第' + i + '句关于落位和喷射背包的教学。').join('');
  const chunks = splitTranscript(text, 120);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every(c => c.length <= 160));
  assert.ok(chunks.every(c => text.includes(c)));
});

test('distilled quotes must appear in the supplied excerpt', async () => {
  const excerpt = '坦克在进场前看一眼队友能否跟上，对照掩体和目标位置再决定。';
  const request = body => new Request('http://guide.invalid/api/knowledge/distill', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const ok = await handleApi(request({
    settings: {
      provider: 'server'
    },
    excerpt
  }), {
    OW_MODEL_BASE_URL: 'http://local-model.invalid/v1',
    OW_MODEL_ID: 'vision-local',
    OW_MODEL_API_KEY: 'fixture-secret'
  }, {
    fetcher: async () => Response.json({
      choices: [{
        message: {
          content: JSON.stringify({
            title: '开团时机',
            quote: '队友能否跟上',
            principle: '先看队友位置。',
            application: '在进场前暂停。',
            heroes: ['温斯顿'],
            maps: [],
            stage: '团战',
            tags: ['进场']
          })
        }
      }]
    })
  });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).stage, '团战');
  const bad = await handleApi(request({
    settings: {
      provider: 'server'
    },
    excerpt
  }), {
    OW_MODEL_BASE_URL: 'http://local-model.invalid/v1',
    OW_MODEL_ID: 'vision-local',
    OW_MODEL_API_KEY: 'fixture-secret'
  }, {
    fetcher: async () => Response.json({
      choices: [{
        message: {
          content: JSON.stringify({
            title: '开团时机',
            quote: '杜撰片段',
            principle: '先看队友位置。',
            application: '在进场前暂停。',
            stage: '团战'
          })
        }
      }]
    })
  });
  assert.equal(bad.status, 502);
});

test('ingest-url uses the user-selected role and keeps quotes inside fetched text', async () => {
  const html = `<html><head><title>温斯顿教学局</title><meta name="description" content="先看队友枪线再进场。"></head><body><article><p>坦克在进场前看一眼队友能否跟上，对照掩体和目标位置再决定。</p></article></body></html>`;
  const res = await handleApi(new Request('http://guide.invalid/api/knowledge/ingest-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: 'https://example.com/winston-vod',
      role: '重装',
      settings: {
        provider: 'server'
      }
    })
  }), {
    OW_MODEL_BASE_URL: 'http://local-model.invalid/v1',
    OW_MODEL_ID: 'vision-local',
    OW_MODEL_API_KEY: 'fixture-secret'
  }, {
    fetcher: async url => {
      if (String(url).includes('example.com')) return new Response(html, {
        headers: {
          'Content-Type': 'text/html'
        }
      });
      return Response.json({
        choices: [{
          message: {
            content: JSON.stringify({
              title: '开团时机',
              quote: '队友能否跟上',
              principle: '先看队友位置。',
              application: '在进场前暂停。',
              heroes: ['温斯顿'],
              maps: [],
              stage: '团战',
              role: '综合',
              tags: ['进场']
            })
          }
        }]
      });
    }
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.role, '重装');
  assert.equal(data.suggestedRole, '综合');
  assert.ok(data.excerpt.includes(data.quote));
  assert.equal(data.kind, '教练笔记');
});

test('ingest-url rejects missing library role', async () => {
  const res = await handleApi(new Request('http://guide.invalid/api/knowledge/ingest-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: 'https://example.com/x',
      settings: {
        provider: 'server'
      }
    })
  }), {}, {
    fetcher: async () => new Response('ok')
  });
  assert.equal(res.status, 400);
});
