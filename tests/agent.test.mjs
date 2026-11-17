import test from 'node:test';
import assert from 'node:assert/strict';
import {
  handleApi
} from '../server/api.mjs';

const jpeg = 'data:image/jpeg;base64,/9j/2Q==';
const settings = {
  provider: 'openai',
  model: 'gpt-4.1-mini',
  key: 'test-only'
};
const request = (path, body) => new Request('https://test.invalid/api/' + path, {
  method: 'POST',
  headers: {
    'content-type': 'application/json'
  },
  body: JSON.stringify(body)
});

test('a review ties its advice to a supplied visual frame and a retrieved coaching note', async () => {
  const note = {
    id: 'winston-cover',
    title: '落点',
    principle: '落点选择掩体',
    application: '标出撤离方向',
    kind: '教练笔记'
  };
  const body = {
    settings,
    context: {
      hero: '温斯顿',
      role: '重装'
    },
    notes: [note],
    frames: [{
      time: 4,
      image: jpeg
    }, {
      time: 8,
      image: jpeg
    }]
  };
  let upstreamBody;
  const fetcher = async (url, options) => {
    assert.equal(String(url), 'https://api.openai.com/v1/chat/completions');
    upstreamBody = JSON.parse(options.body);
    const content = JSON.stringify({
      observations: [{
        frame: 1,
        title: '落在墙角',
        observation: '画面中身侧是墙面。',
        decision: '沿墙寻找下一处掩体。',
        category: '落位',
        confidence: '清晰',
        sources: ['winston-cover', 'made-up']
      }]
    });
    return Response.json({
      choices: [{
        message: {
          content
        }
      }]
    });
  };
  const res = await handleApi(request('review/window', body), {}, {
    fetcher
  });
  assert.equal(res.status, 200);
  const result = await res.json();
  assert.equal(upstreamBody.messages[1].content.filter(p => p.type === 'image_url').length, 2);
  assert.equal(result.observations[0].time, 8);
  assert.deepEqual(result.observations[0].sources, ['winston-cover']);
});

test('the DeepSeek preset posts to its OpenAI-compatible endpoint', async () => {
  let url, body;
  const fetcher = async (target, options) => {
    url = String(target);
    body = JSON.parse(options.body);
    return Response.json({
      choices: [{
        message: {
          content: '{"ok":true}'
        }
      }]
    });
  };
  const res = await handleApi(request('model/test', {
    settings: {
      provider: 'deepseek',
      model: 'deepseek-v4',
      key: 'test-only'
    }
  }), {}, {
    fetcher
  });
  assert.equal(res.status, 200);
  assert.equal(url, 'https://api.deepseek.com/v1/chat/completions');
  assert.equal(body.model, 'deepseek-v4');
});

test('a custom vision endpoint may be any https host or a local http server', async () => {
  let seen, authorization;
  const fetcher = async (url, options) => {
    seen = String(url);
    authorization = options.headers.Authorization;
    return Response.json({
      choices: [{
        message: {
          content: '{"ok":true}'
        }
      }]
    });
  };
  const custom = {
    provider: 'custom',
    base: 'https://model.example.com/v1/',
    model: 'deepseek-v4'
  };
  assert.equal((await handleApi(request('model/test', {
    settings: custom
  }), {}, {
    fetcher
  })).status, 200);
  assert.equal(seen, 'https://model.example.com/v1/chat/completions');
  assert.equal(authorization, undefined);
  assert.equal((await handleApi(request('model/test', {
    settings: {
      ...custom,
      base: 'http://127.0.0.1:11434/v1'
    }
  }), {}, {
    fetcher
  })).status, 200);
  assert.equal(seen, 'http://127.0.0.1:11434/v1/chat/completions');
  assert.equal((await handleApi(request('model/test', {
    settings: {
      ...custom,
      base: 'http://model.example.com/v1'
    }
  }), {}, {
    fetcher
  })).status, 400);
});
