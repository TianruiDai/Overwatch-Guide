import {
  formatTime,
  parseTime,
  sampleWindows,
  selectNotes
} from '/shared/domain.mjs';
import {
  icon,
  escapeHTML as h,
  modal,
  toast,
  errorText
} from './ui.mjs';
import {
  get,
  put,
  deleteMatch
} from './storage.mjs';

function notesText(ids, cards) {
  return ids.map(id => cards.find(c => c.id === id)).filter(Boolean);
}

function reportHTML(report) {
  if (!report.sections.length) return `<div class="panel pad"><h3>未观察到可复盘操作</h3><p class="formatted">该时段共检查 ${report.frameCount} 帧。可换到交战时段或缩短采样间隔再分析。</p></div>`;
  return report.sections.map(s => `<div class="summary"><h3>教练点评</h3><p>${h(s.summary)}</p></div><div class="timeline">${s.fights.map(f=>`<article class="moment"><span class="timeline-mark"></span><h3>${h(f.title)}</h3>${f.eventIds.map(n=>{const e=report.events[n];return `<div class="event"><button class="event-img" data-seek="${e.time}" aria-label="回看 ${formatTime(e.time)}"><img src="${h(e.still)}" alt="录像证据帧"><span>▶ ${formatTime(e.time)}</span></button><div><h4>${h(e.title)} <span class="tag">${h(e.category)}</span> ${e.confidence==='有限'?'<span class="tag">画面有限</span>':''}</h4><p class="formatted"><b>画面观察</b> ${h(e.observation)}</p><p class="formatted"><b>下一次</b> ${h(e.decision)}</p>${notesText(e.sources,report.notes).map(c=>`<button class="source-chip" data-card="${h(c.id)}">${icon('book',13)} ${h(c.author)} · ${h(c.title)}</button>`).join('')}</div></div>`;}).join('')}</article>`).join('')}</div>${s.drills.length?`<div class="panel pad"><h3>下一局练习</h3><ul class="simple-list">${s.drills.map(d=>`<li>${h(d)}</li>`).join('')}</ul></div>`:''}`).join('');
}

export function matchPage(match, app) {
  const {
    report: r,
    job
  } = match;
  const c = r?.context || job?.context || match.context;
  const scope = r || job;
  const timeInput = seconds => {
    const ms = Math.round(seconds * 1000);
    const fraction = String(ms % 1000).padStart(3, '0').replace(/0+$/, '');
    return formatTime(ms / 1000) + (fraction ? '.' + fraction : '');
  };
  const running = app.activeRun?.id === match.id;
  return `<a class="back" href="#history">← 对局记录</a><div class="review-heading"><div><h1>${h(match.title)}</h1><p>${h([c.map,c.hero,c.role,c.side].filter(x=>x&&x!=='未指定').join(' · ')||'第一视角录像')} · ${formatTime(match.duration)} ${match.code?' · '+h(match.code):''}</p></div><div class="actions"><button class="icon-button" id="delete-match" aria-label="删除对局" title="删除对局">${icon('trash')}</button></div></div>
  <div class="review-grid"><div class="panel player-panel"><video id="player" class="player" controls playsinline preload="metadata" poster="${h(match.cover)}"></video></div>
  <aside class="panel pad sticky-none"><h2 class="panel-title">${icon(r?'note':'crosshair',20)} ${r?'本次复盘':'分析设置'}</h2>
  ${r?`<p class="formatted">${formatTime(r.start)} – ${formatTime(r.end)} · 每 ${r.step} 秒采样</p><p class="formatted">${r.frameCount} 张采样帧 · ${r.events.length} 个画面观察</p><p class="input-help">模型 ${h(r.profile)}</p><div class="actions action-line"><button class="primary" id="export-report">${icon('export',15)} 导出 Markdown</button><button class="ghost" id="reset-job">重新分析</button></div>`:
  `<form id="review-form" class="fields"><div class="field-grid"><label>开始时间<input name="start" value="${timeInput(scope?.start??0)}" ${job?'readonly':''}></label><label>结束时间<input name="end" value="${timeInput(scope?.end??match.duration)}" ${job?'readonly':''}></label></div>
  <label>采样间隔<select name="step" ${job?'disabled':''}>${[4,2,1].map(v=>`<option value="${v}" ${v===(scope?.step||4)?'selected':''}>每 ${v} 秒 · ${{4:'常规复盘',2:'团战细看',1:'技能细看'}[v]}</option>`).join('')}</select></label>
  <p class="input-help" id="estimate"></p><p class="info-box" id="job-status" role="status">${job?'已保存 '+job.done+' 批画面观察。':''}</p>
  <div class="actions" id="run-actions">${running?`<button class="secondary" type="button" id="stop-run">${icon('stop',14)} 暂停</button>`:
    `<button class="primary" type="submit">${icon('play',14)} ${job?'继续分析':'开始复盘'}</button>${job?'<button id="reset-job" class="ghost" type="button">重置进度</button>':''}`}</div>
  <p class="error-box" id="run-error" role="alert"></p></form>`}
  </aside></div>
  ${c.focus?`<div class="help-box info-box"><b>本局关注</b>　${h(c.focus)}</div>`:''}
  ${r?`<section class="report-section"><div class="section-head"><h2><span class="head-icon">${icon('layers',20)}</span>逐波复盘</h2></div>${reportHTML(r)}</section>`:
  `<section class="report-section"><div class="section-head"><h2><span class="head-icon">${icon('book',19)}</span>匹配到的教学资料</h2></div><div class="actions">${(job?.notes || selectNotes(app.cards,c)).map(n=>`<button class="source-chip" data-card="${h(n.id)}">${icon('book',14)} ${h(n.title)}</button>`).join('')||'<span class="muted">暂无匹配资料，仍可进行画面分析。</span>'}</div></section>`}`;
}

export async function bindMatch(match, app, routeToken) {
  const c = match.context;
  const media = await get('videos', match.id);
  if (routeToken !== app.renderToken) return;
  const player = document.getElementById('player');
  if (media?.file) {
    app.playerUrl = URL.createObjectURL(media.file);
    player.src = app.playerUrl;
  }
  document.querySelectorAll('[data-seek]').forEach(btn => btn.onclick = () => {
    player.currentTime = Number(btn.dataset.seek);
    player.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
    player.focus();
  });
  const guard = async task => {
    if (!navigator.locks) {
      toast('请通过 HTTPS 或 localhost 打开工作台。');
      return;
    }
    await navigator.locks.request('owg-run-' + match.id, {
      ifAvailable: true
    }, async lock => {
      if (lock) await task();
      else toast('请先暂停正在运行的复盘。');
    });
  };
  document.getElementById('delete-match').onclick = () => modal('删除这份对局', `<p>本机保存的《${h(match.title)}》录像与报告将一并删除。</p><div class="actions end action-line"><button class="secondary" data-no>取消</button><button class="danger" data-yes>删除对局</button></div>`, d => {
    d.querySelector('[data-no]').onclick = () => d.close();
    d.querySelector('[data-yes]').onclick = () => guard(async () => {
      await deleteMatch(match.id);
      d.close();
      location.hash = 'history';
    });
  });
  const reset = document.getElementById('reset-job');
  if (reset) reset.onclick = () => modal('重新选择复盘范围', `<p>清除本次分析的已保存进度与报告，保留原录像和对局信息。</p><div class="actions end action-line"><button class="secondary" data-no>取消</button><button class="primary" data-yes>重置分析</button></div>`, d => {
    d.querySelector('[data-no]').onclick = () => d.close();
    d.querySelector('[data-yes]').onclick = () => guard(async () => {
      const saved = await get('matches', match.id);
      if (!saved) return;
      delete saved.job;
      delete saved.report;
      await put('matches', saved);
      d.close();
      await app.refresh();
    });
  });
  if (match.report) {
    document.getElementById('export-report').onclick = () => downloadReport(match);
    return;
  }
  const form = document.getElementById('review-form'),
    error = form.querySelector('#run-error');
  const options = () => {
    const start = parseTime(form.elements.start.value),
      rawEnd = parseTime(form.elements.end.value),
      end = Math.min(match.duration, rawEnd),
      step = Number(form.elements.step.value);
    if (rawEnd > match.duration + .002 || end - start < .04) throw new Error('请将分析范围设在录像时长内，结束时间应晚于开始时间。');
    return {
      start,
      end,
      step,
      windows: sampleWindows(start, end, step)
    };
  };
  const update = () => {
    try {
      const p = options();
      form.querySelector('#estimate').textContent = (!match.job && (!c.hero || !c.map || c.role === '通用') ? '先用最多 3 帧辨认英雄与地图。' : '') + p.windows.reduce((s, w) => s + w.length, 0) + ' 张画面，分 ' + p.windows.length + ' 批发送给当前模型，再归纳团战。时间支持秒数或 mm:ss。';
    } catch (e) {
      form.querySelector('#estimate').textContent = e.message;
    }
  };
  form.oninput = update;
  update();
  const stop = document.getElementById('stop-run');
  if (stop) stop.onclick = () => app.activeRun?.controller.abort();
  form.onsubmit = async e => {
    e.preventDefault();
    error.textContent = '';
    if (app.activeRun) {
      error.textContent = '已有对局正在分析，请先暂停或等待完成。';
      return;
    }
    if (!app.hasModel()) {
      error.innerHTML = '需要先配置视觉模型。 <a class="source-out" href="#settings">打开模型设置 →</a>';
      return;
    }
    try {
      const {
        windows,
        ...p
      } = options();
      await app.startRun(match, p);
    } catch (err) {
      error.textContent = errorText(err);
    }
  };
  if (app.lastIssue?.id === match.id) error.textContent = app.lastIssue.message;
  if (app.activeRun?.id === match.id && app.activeRun.line) form.querySelector('#job-status').textContent = app.activeRun.line;
}

function downloadReport(match) {
  const r = match.report,
    c = r.context || match.context;
  const mdText = s => String(s ?? '').replace(/[\r\n]+/g, ' ').replace(/([\\`*_[\]<>])/g, '\\$1');
  const lines = ['# ' + mdText(match.title), '', mdText([c.map, c.hero, c.side].filter(Boolean).join(' · ')),
    '', formatTime(r.start) + '–' + formatTime(r.end) + ' · 每 ' + r.step + ' 秒采样 · ' + mdText(r.profile), ''
  ];
  if (!r.sections.length) lines.push('所选时段内未观察到可复盘操作。');
  for (const s of r.sections) {
    lines.push('## 教练点评', '', mdText(s.summary), '');
    for (const fight of s.fights) {
      lines.push('### ' + mdText(fight.title), '');
      for (const n of fight.eventIds) {
        const e = r.events[n];
        lines.push('**' + formatTime(e.time) + ' · ' + mdText(e.title) + '**（' + mdText(e.confidence) + '）', '', mdText(e.observation), '', '下一次：' + mdText(e.decision), '');
        for (const c of notesText(e.sources, r.notes)) lines.push('- ' + mdText(c.author) + ' · ' + mdText(c.title) + ' <' + c.url.replace(/[<>\s]/g, '') + '>');
        lines.push('');
      }
    }
    if (s.drills.length) lines.push('### 下一局练习', '', ...s.drills.map(d => '- ' + mdText(d)), '');
  }
  const url = URL.createObjectURL(new Blob([lines.join('\n')], {
    type: 'text/markdown;charset=utf-8'
  }));
  const link = document.createElement('a');
  link.href = url;
  link.download = match.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 90) + '-复盘.md';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}
