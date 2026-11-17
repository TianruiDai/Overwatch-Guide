import test from 'node:test';
import assert from 'node:assert/strict';
import {
  reportMarkdown
} from '../shared/report-markdown.mjs';

test('reportMarkdown includes coach title and a section heading', () => {
  const md = reportMarkdown({
    context: {
      map: '国王大道',
      hero: '温斯顿',
      role: '重装',
      side: '进攻'
    },
    coach: {
      title: '国王大道温斯顿复盘',
      sections: [{
        heading: '开局落位',
        body: '先占二楼视野再跳。'
      }],
      closing: '下一局优先记撤离窗口。'
    },
    waves: [],
    notes: []
  });
  assert.ok(md.includes('# 国王大道温斯顿复盘'));
  assert.ok(md.includes('## 开局落位'));
  assert.ok(md.includes('先占二楼视野再跳。'));
});

test('reportMarkdown includes wave verdict when present', () => {
  const md = reportMarkdown({
    context: {},
    coach: {
      title: '测试',
      sections: []
    },
    waves: [{
      title: 'A点团战',
      verdict: '跳得太深，没等到集火。',
      nextTime: '看到辅助开大再进。',
      sources: ['winston-cover']
    }],
    notes: [{
      id: 'winston-cover',
      author: '老王',
      title: '温斯顿掩体'
    }]
  });
  assert.ok(md.includes('### 逐波 · A点团战'));
  assert.ok(md.includes('跳得太深，没等到集火。'));
  assert.ok(md.includes('老王 · 温斯顿掩体'));
});