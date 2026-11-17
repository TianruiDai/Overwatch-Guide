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
  const exact = await call('review/synthesize', input, {
    summary: '按时间回看落点',
    fights: [{
      title: '进场',
      eventIds: [0, 1]
    }],
    drills: ['检查落点再压']
  });
  assert.equal(exact.status, 200);
  assert.deepEqual((await exact.json()).fights[0].eventIds, [0, 1]);
});
test('synthesize repairs missing or duplicate eventIds instead of failing', async () => {
  const input = {
    settings,
    events: [event, {
      ...event,
      time: 43
    }]
  };
  for (const ids of [
      [0],
      [0, 0],
      [2]
    ]) {
    const res = await call('review/synthesize', input, {
      summary: '按时间回看落点',
      fights: [{
        title: '进场',
        eventIds: ids
      }],
      drills: ['检查落点再压']
    });
    assert.equal(res.status, 200, 'ids=' + ids.join());
    const covered = (await res.json()).fights.flatMap(f => f.eventIds).sort((a, b) => a - b);
    assert.deepEqual(covered, [0, 1]);
  }
});
test('more than eight notes are accepted and soft-capped in the prompt', async () => {
  const notes = Array.from({
    length: 20
  }, (_, i) => ({
    id: 'note-' + i,
    title: '资料' + i,
    principle: '原则' + i,
    application: '应用' + i,
    kind: '教练笔记'
  }));
  let prompt = '';
  const res = await handleApi(new Request('http://guide.invalid/api/review/synthesize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      settings,
      events: [event],
      notes
    })
  }), env, {
    fetcher: async (url, options) => {
      assert.equal(url, 'http://local-model.invalid/v1/chat/completions');
      const payload = JSON.parse(options.body);
      prompt = payload.messages.at(-1).content;
      assert.equal(payload.max_tokens, 8000);
      assert.equal(payload.response_format?.type, 'json_object');
      return Response.json({
        choices: [{
          message: {
            content: JSON.stringify({
              summary: '先找掩体再压',
              fights: [{
                title: '连续片段',
                eventIds: [0]
              }],
              drills: ['落点先确认掩体']
            })
          }
        }]
      });
    }
  });
  assert.equal(res.status, 200);
  assert.ok(prompt.includes('note-15'));
  assert.ok(!prompt.includes('note-16'));
  assert.ok(!prompt.includes('note-19'));
});
test('match page places the agent terminal under the video', async () => {
  const {
    readFile
  } = await import('node:fs/promises');
  const src = await readFile(new URL('../public/match.mjs', import.meta.url), 'utf8');
  const stack = src.indexOf('player-stack');
  const player = src.indexOf('id="player"');
  const thread = src.indexOf('id="agent-thread"');
  const panel = src.indexOf('class="panel agent-panel"');
  assert.ok(stack >= 0);
  assert.ok(player > stack);
  assert.ok(thread > player);
  assert.ok(panel > thread);
  assert.ok(src.slice(stack, panel).includes('agent-terminal'));
  assert.ok(!src.slice(panel).includes('id="agent-thread"'));
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
test('an oversized sample batch is rejected as JSON so the browser can read the reason', async () => {
  const res = await call('review/window', {
    settings,
    context: {},
    notes: [],
    frames: [{
      time: 1,
      image
    }],
    pad: 'x'.repeat(7 * 1024 * 1024 + 4096)
  }, {});
  assert.equal(res.status, 413);
  assert.equal((await res.json()).error, '采样包过大。');
});
test('a model that wraps JSON in prose or fences is still understood', async () => {
  const replies = ['好的，我按约定输出：\n```json\n{"observations":[]}\n```\n以上。', '思考完毕。{"observations":[]}'];
  for (const content of replies) {
    const res = await handleApi(new Request('http://guide.invalid/api/review/window', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }), env, {
      fetcher: async () => Response.json({
        choices: [{
          message: {
            content
          }
        }]
      })
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      observations: []
    });
  }
});
test('an unusable model reply reports what came back instead of a fixed guess', async () => {
  const res = await handleApi(new Request('http://guide.invalid/api/review/window', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  }), env, {
    fetcher: async () => Response.json({
      choices: [{
        message: {
          content: '抱歉，我无法分析这段录像。'
        }
      }]
    })
  });
  assert.equal(res.status, 502);
  const text = (await res.json()).error;
  assert.match(text, /没有返回约定的 JSON/);
  assert.match(text, /无法分析这段录像/);
});
test('extra observations beyond three are trimmed instead of discarding the whole batch', async () => {
  const many = {
    observations: [0, 1, 2, 3, 4].map(frame => ({
      frame,
      title: '动作' + frame,
      observation: '画面' + frame,
      decision: '下次这样做',
      category: '落位',
      confidence: '清晰',
      sources: []
    }))
  };
  const res = await call('review/window', {
    settings,
    context: {},
    notes: [],
    frames: [0, 1, 2, 3, 4].map((n) => ({
      time: n + 1,
      image
    }))
  }, many);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.observations.length, 3);
  assert.deepEqual(body.observations.map(o => o.time), [1, 2, 3]);
});
test('a DeepSeek request disables thinking so the reply is plain JSON', async () => {
  let sent;
  await handleApi(new Request('http://guide.invalid/api/model/test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      settings: {
        provider: 'deepseek',
        key: 'test-only'
      }
    })
  }), {}, {
    fetcher: async (url, options) => {
      sent = JSON.parse(options.body);
      return Response.json({
        choices: [{
          message: {
            content: '{"ok":true}'
          }
        }]
      });
    }
  });
  assert.deepEqual(sent.thinking, {
    type: 'disabled'
  });
});
test('wave deep-dive keeps concrete skill alternatives and coach sources', async () => {
  const note = {
    id: 'winston-kings-row',
    title: '国王大道 A 点的第一处落位',
    author: '17173',
    kind: '教练笔记',
    stage: '落位',
    principle: '从雕像附近读防守站位。',
    application: '停在过拱门前再决定跳不跳。'
  };
  const reply = {
    verdict: '跳得太早，落在开阔处。',
    positioning: {
      spot: '雕像前开阔地',
      cover: '没有借到雕像侧面',
      exposedTo: '公交车后与雕像方向的敌人'
    },
    skills: [{
      name: '喷射背包',
      frame: 0,
      judgement: '交早了',
      alternative: '等队友过拱门后再跳到雕像侧'
    }],
    enemyRead: '雕像后方有人观察门口。',
    nextTime: '停在拱门前对比步行与跳入。',
    sources: ['winston-kings-row', 'made-up']
  };
  const res = await call('review/wave', {
    settings,
    context: {
      hero: '温斯顿',
      map: '国王大道'
    },
    notes: [note],
    events: [{
      time: 8,
      title: '雕像前暴露',
      observation: '推进到雕像开阔处',
      decision: '先停在拱门前',
      category: '落位',
      skills: [{
        name: '喷射背包',
        state: '已交',
        timing: '落地前'
      }]
    }]
  }, reply);
  assert.equal(res.status, 200);
  const wave = await res.json();
  assert.deepEqual(wave.sources, ['winston-kings-row']);
  assert.equal(wave.skills[0].alternative, '等队友过拱门后再跳到雕像侧');
});
test('wave deep-dive rejects missing skill alternatives', async () => {
  const res = await call('review/wave', {
    settings,
    context: {},
    notes: [{
      id: 'spilo-tank-engage',
      title: '等队友',
      author: 'Spilo',
      kind: '教练笔记',
      principle: '同步施压',
      application: '找一名能跟枪的队友'
    }],
    events: [{
      time: 4,
      title: '压进',
      observation: '越过掩体',
      decision: '等队友',
      category: '团战'
    }]
  }, {
    verdict: '进得太早',
    positioning: {
      spot: '掩体外',
      cover: '无',
      exposedTo: '正面'
    },
    skills: [{
      name: '屏障',
      frame: 0,
      judgement: '交晚了',
      alternative: ''
    }],
    enemyRead: '对面集火',
    nextTime: '等队友射线再压',
    sources: ['spilo-tank-engage']
  });
  assert.equal(res.status, 502);
});
test('coach review returns timed sections in coach voice', async () => {
  const res = await call('review/coach', {
    settings,
    context: {
      hero: '温斯顿',
      map: '国王大道',
      role: '重装',
      extra: '重点抠屏障时机'
    },
    notes: [{
      id: 'version-ability-winston',
      title: '温斯顿技能',
      author: '暴雪娱乐',
      kind: '官方机制',
      stage: '技能',
      principle: '屏障发射器投放球形护盾。',
      application: '交罩前后两秒核对枪线。'
    }],
    sections: [{
      summary: '先占二楼再压',
      fights: [{
        title: '首跳',
        eventIds: [0]
      }],
      drills: ['先找掩体再跳']
    }],
    waves: [{
      title: '首跳',
      verdict: '落点靠雕像但收益低',
      positioning: {
        spot: '雕像旁',
        cover: '雕像',
        exposedTo: '西格玛'
      },
      skills: [],
      nextTime: '借雕像上二楼',
      enemyRead: '',
      sources: ['version-ability-winston']
    }],
    events: [{
      time: 10,
      title: '交罩电坦',
      observation: '雕像旁对西格玛',
      decision: '改侧面落点',
      category: '落位',
      skills: [],
      sources: []
    }]
  }, {
    title: '国王大道温斯顿复盘',
    sections: [{
      heading: '一、先明确这局应该怎么打',
      body: '优先抢能威胁后排的位置，西格玛用来牵制，不要让他决定你的交战位置。'
    }, {
      heading: '二、第一阶段：00:08–00:41',
      body: '00:10 在雕像旁交罩。做得好的是有实体掩体可退；收益不高，因为主要只电到坦克。'
    }],
    closing: '下一局先借雕像过渡上二楼，再决定是否交跳。'
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.sections.length, 2);
  assert.match(data.sections[1].body, /00:10/);
  assert.ok(data.title);
});
test('unknown hero identification does not create a confident character or map', async () => {
  assert.deepEqual(await (await call('review/identify', body, {})).json(), {});
  assert.deepEqual(await (await call('review/identify', body, {
    hero: '安娜',
    role: '辅助',
    map: '国王大道',
    side: '进攻',
    frame: 0
  })).json(), {
    hero: '安娜',
    role: '辅助',
    map: '国王大道',
    side: '进攻',
    time: 42,
    team: 'unknown',
    evidence: ''
  });
});
test('identifyMatch whitelists names and derives role from the hero', async () => {
  assert.deepEqual(await (await call('review/identify', body, {
    hero: '虚构坦克',
    role: '重装',
    map: '虚构地图',
    frame: 0
  })).json(), {});
  assert.deepEqual(await (await call('review/identify', body, {
    hero: '猎空',
    role: '重装',
    map: '多拉多',
    side: '防守',
    frame: 0
  })).json(), {
    hero: '猎空',
    map: '多拉多',
    role: '输出',
    side: '防守',
    time: 42,
    team: 'unknown',
    evidence: ''
  });
  assert.deepEqual(await (await call('review/identify', body, {
    hero: '不是英雄',
    role: '辅助',
    map: '国王大道',
    frame: 0
  })).json(), {
    map: '国王大道',
    role: '辅助',
    side: '未指定',
    time: 42,
    team: 'unknown',
    evidence: ''
  });
});
test('identifyRosters whitelists heroes and excludes POV from enemies', async () => {
  const res = await call('review/roster', {
    settings,
    hero: '温斯顿',
    frames: body.frames
  }, {
    allies: ['温斯顿', '源氏', '假人'],
    enemies: ['西拉', '索杰恩', '温斯顿'],
    swaps: ['卡西迪']
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    allies: ['温斯顿', '源氏'],
    enemies: ['西拉', '索杰恩'],
    swaps: ['卡西迪']
  });
});
test('writeCoachReview prompt includes the default coach skill', async () => {
  let prompt = '';
  const res = await handleApi(new Request('http://guide.invalid/api/review/coach', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      settings,
      context: {
        hero: '温斯顿',
        map: '国王大道',
        role: '重装',
        allies: ['温斯顿', '源氏'],
        enemies: ['西格玛', '西拉']
      },
      notes: [],
      sections: [{
        summary: '先占二楼',
        fights: [{
          title: '首跳',
          eventIds: [0]
        }],
        drills: ['借雕像过渡']
      }],
      waves: [{
        title: '首跳',
        verdict: '落点可靠近雕像',
        positioning: {
          spot: '雕像旁',
          cover: '雕像',
          exposedTo: '西格玛'
        },
        skills: [],
        nextTime: '先借雕像再决定起跳',
        enemyRead: '',
        sources: []
      }],
      events: [{
        time: 10,
        title: '交罩',
        observation: '雕像旁对西格玛',
        decision: '改侧面落点',
        category: '落位',
        skills: [],
        sources: []
      }]
    })
  }), env, {
    fetcher: async (url, options) => {
      prompt = JSON.parse(options.body).messages.at(-1).content;
      return Response.json({
        choices: [{
          message: {
            content: JSON.stringify({
              title: '国王大道温斯顿复盘',
              sections: [{
                heading: '一、先明确这局应该怎么打',
                body: '对面西格玛西拉，先争能威胁脆皮的位置。'
              }, {
                heading: '二、第一阶段：00:08–00:41',
                body: '00:10 在雕像旁交罩。'
              }],
              closing: '先读枪线再起跳。'
            })
          }
        }]
      });
    }
  });
  assert.equal(res.status, 200);
  assert.match(prompt, /先明确这局应该怎么打/);
  assert.match(prompt, /西拉≠索杰恩/);
  assert.match(prompt, /enemies/);
});
test('review auto-accepts complete vision identity before note selection', async () => {
  const {
    readFile
  } = await import('node:fs/promises');
  const src = await readFile(new URL('../public/review.mjs', import.meta.url), 'utf8');
  const identifyAt = src.indexOf("api('review/identify'");
  const rosterAt = src.indexOf("api('review/roster'");
  const autoAt = src.indexOf('Vision + read-match skill already filled identity');
  const confirmAt = src.indexOf('await waitIdentityConfirm');
  const notesAt = src.indexOf('selectNotes(pool, context');
  assert.ok(identifyAt > 0 && rosterAt > identifyAt);
  assert.ok(autoAt > rosterAt && confirmAt > autoAt);
  assert.ok(notesAt > confirmAt);
  assert.ok(src.includes('function identityComplete'));
  assert.ok(src.includes('请补全英雄、地图与职责后再开始观察'));
  assert.ok(!src.includes('if (!context.hero || !context.map'));
  const importSrc = await readFile(new URL('../public/app.mjs', import.meta.url), 'utf8');
  assert.ok(!importSrc.includes('name="hero"'));
  assert.ok(!importSrc.includes('name="role"'));
  assert.ok(importSrc.includes('name="knowledge"'));
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
