import {
  formatTime,
  parseTime,
  sampleWindows,
  knowledgePool,
  heroes,
  maps,
  matchRoles,
  matchSides,
  normalizeIdentity,
  normalizeRosters,
  normalizeTeamColor,
  parseHeroField
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
import {
  reportMarkdown
} from '/shared/report-markdown.mjs';

function notesText(ids, cards) {
  return ids.map(id => cards.find(c => c.id === id)).filter(Boolean);
}

function matchReadTimelineHTML(matchRead, context) {
  if (!matchRead || typeof matchRead !== 'object') return '';
  const rosterBits = [];
  if (context?.allies?.length) rosterBits.push('我方 ' + context.allies.join('、'));
  if (context?.enemies?.length) rosterBits.push('敌方 ' + context.enemies.join('、'));
  const headingExtra = rosterBits.length ? `<p class="input-help">${h(rosterBits.join('；'))}</p>` : '';
  const rounds = (matchRead.rounds || []).map((r, i) => {
    const title = r?.map || r?.id || r?.label || ('回合 ' + (i + 1));
    const side = r?.side || r?.attack || '';
    return `<li>${h(String(title))}${side ? ` <span class="tag">${h(String(side))}</span>` : ''}</li>`;
  }).join('');
  const lineups = (matchRead.lineups || []).slice(0, 6).map((lu, i) => {
    const hero = lu?.player_hero || lu?.hero || '';
    const allies = (lu?.allies || []).join('、');
    const enemies = (lu?.enemies || []).join('、');
    return `<li>${h(hero || '阵容 ' + (i + 1))}：我方 ${h(allies || '—')}；敌方 ${h(enemies || '—')}</li>`;
  }).join('');
  const fights = (matchRead.fights || []).map(f => {
    const title = f?.id || f?.title || '交战';
    const start = Number.isFinite(f?.start_s) ? f.start_s : null;
    const end = Number.isFinite(f?.end_s) ? f.end_s : null;
    const range = start != null ?
      (end != null && end > start ? `${formatTime(start)} – ${formatTime(end)}` : formatTime(start)) :
      '';
    const side = [f?.ally_action, f?.enemy_response].filter(Boolean).join(' · ');
    const seek = start != null ? ` <button class="ghost" data-seek="${start}" type="button">▶ ${formatTime(start)}</button>` : '';
    return `<li><b>${h(String(title))}</b>${range ? ` <span class="muted">${h(range)}</span>` : ''}${side ? `<br><span class="input-help">${h(side)}</span>` : ''}${seek}</li>`;
  }).join('');
  if (!rounds && !lineups && !fights) return '';
  return `<details class="fold report-section"><summary class="fold-summary"><span>${icon('clock',16)} 对局时间轴</span><span class="tag">${(matchRead.fights||[]).length||'—'}</span></summary><div class="fold-body">${headingExtra}
  ${rounds?`<h4>回合</h4><ul class="match-timeline-list">${rounds}</ul>`:''}
  ${lineups?`<h4>阵容</h4><ul class="match-timeline-list">${lineups}</ul>`:''}
  ${fights?`<h4>交战</h4><ul class="match-timeline-list">${fights}</ul>`:''}
  </div></details>`;
}

function waveOf(report, fight) {
  return (report.waves || []).find(w => w.title === fight.title && JSON.stringify(w.eventIds) === JSON.stringify(fight.eventIds)) ||
    (report.waves || []).find(w => JSON.stringify(w.eventIds) === JSON.stringify(fight.eventIds));
}

function waveHTML(wave, report) {
  if (!wave || wave.light) return '';
  const skills = (wave.skills || []).map(s => `<tr><td><button class="ghost" data-seek="${s.time ?? report.events[s.frame]?.time ?? 0}" type="button">${h(s.name)}</button></td><td>${h(s.judgement || '')}</td><td>${h(s.alternative || '')}</td></tr>`).join('');
  return `<div class="wave-box"><p class="formatted"><b>这波结论</b> ${h(wave.verdict || '')}</p>
  <div class="field-grid wave-grid"><div><span class="detail-label">落点</span><p>${h(wave.positioning?.spot || '')}</p></div><div><span class="detail-label">掩体</span><p>${h(wave.positioning?.cover || '')}</p></div><div><span class="detail-label">暴露给</span><p>${h(wave.positioning?.exposedTo || '')}</p></div></div>
  ${skills?`<table class="skill-table"><thead><tr><th>技能</th><th>判断</th><th>下次怎么做</th></tr></thead><tbody>${skills}</tbody></table>`:''}
  ${wave.enemyRead?`<p class="formatted"><b>对手读牌</b> ${h(wave.enemyRead)}</p>`:''}
  <p class="formatted"><b>下一手</b> ${h(wave.nextTime || '')}</p>
  <div class="actions">${notesText(wave.sources||[],report.notes).map(c=>`<button class="source-chip" data-card="${h(c.id)}">${icon('book',13)} ${h(c.author)} · ${h(c.title)}</button>`).join('')}</div></div>`;
}

function evidenceHTML(report) {
  if (!report.sections.length) return `<div class="panel pad"><h3>未观察到可复盘操作</h3><p class="formatted">该时段共检查 ${report.frameCount} 帧。可换到交战时段或缩短采样间隔再分析。</p></div>`;
  return report.sections.map(s => `<div class="timeline">${s.fights.map(f=>{
    const wave = waveOf(report, f);
    return `<article class="moment"><span class="timeline-mark"></span><h3>${h(f.title)}</h3>${waveHTML(wave, report)}${f.eventIds.map(n=>{const e=report.events[n];return `<div class="event"><button class="event-img" data-seek="${e.time}" aria-label="回看 ${formatTime(e.time)}"><img src="${h(e.still)}" alt="录像证据帧"><span>▶ ${formatTime(e.time)}</span></button><div><h4>${h(e.title)} <span class="tag">${h(e.category)}</span> ${e.confidence==='有限'?'<span class="tag">画面有限</span>':''}</h4><p class="formatted"><b>画面观察</b> ${h(e.observation)}</p><p class="formatted"><b>下一次</b> ${h(e.decision)}</p>${(e.skills||[]).length?`<p class="input-help">${e.skills.map(sk=>h(sk.name)+(sk.state?' · '+h(sk.state):'')+(sk.timing?' · '+h(sk.timing):'')).join('；')}</p>`:''}${notesText(e.sources,report.notes).map(c=>`<button class="source-chip" data-card="${h(c.id)}">${icon('book',13)} ${h(c.author)} · ${h(c.title)}</button>`).join('')}</div></div>`;}).join('')}</article>`;
  }).join('')}</div>`).join('');
}

function linkTimes(text = '') {
  return h(text).replace(/(\d{1,2}:\d{2}(?:\.\d+)?)/g, (m) => {
    const parts = m.split(':');
    const sec = Number(parts[0]) * 60 + Number(parts[1]);
    if (!Number.isFinite(sec)) return m;
    return `<button class="ghost seek-inline" data-seek="${sec}" type="button">${m}</button>`;
  });
}

export function linkTyped(text = '') {
  return linkTimes(text).replace(/\[teaching:([^\]]+)\]/g, (_m, id) => {
    const card = String(id || '').trim();
    return card ? `<button class="simple" data-card="${h(card)}" type="button">${h(card)}</button>` : '';
  });
}

export function agentReportHTML(report) {
  const coach = report?.coach;
  if (coach?.sections?.length) {
    const sections = coach.sections.map(s => `<section class="coach-section"><h3>${h(s.heading || '')}</h3><div class="coach-body">${linkTyped(s.body || '')}</div></section>`).join('');
    return `<div class="agent-report coach-report"><h2>${h(coach.title || '教练复盘')}</h2>${sections}${coach.closing?`<p class="coach-closing">${linkTyped(coach.closing)}</p>`:''}</div>`;
  }
  if (!report?.sections?.length) {
    return `<div class="agent-report"><h3>未观察到可复盘操作</h3><p>该时段共检查 ${report?.frameCount || 0} 帧。可换到交战时段或缩短采样间隔再分析。</p></div>`;
  }
  return report.sections.map(s => {
    const waves = s.fights.map(f => {
      const wave = waveOf(report, f);
      if (!wave || wave.light) {
        const first = report.events[f.eventIds[0]];
        return `<div class="agent-wave"><h4>${h(f.title)}</h4><p>${h(wave?.verdict || first?.decision || '')}</p>${first?`<button class="ghost" data-seek="${first.time}" type="button">▶ ${formatTime(first.time)}</button>`:''}</div>`;
      }
      const skills = (wave.skills || []).map(sk => `<li><button class="ghost" data-seek="${sk.time ?? report.events[sk.frame]?.time ?? 0}" type="button">${h(sk.name)}</button> · ${h(sk.judgement || '')} → ${h(sk.alternative || '')}</li>`).join('');
      const t0 = report.events[f.eventIds[0]]?.time;
      return `<div class="agent-wave"><h4>${h(f.title)}${t0!=null?` <button class="ghost" data-seek="${t0}" type="button">▶ ${formatTime(t0)}</button>`:''}</h4>
        <p><b>结论</b> ${h(wave.verdict || '')}</p>
        <p><b>落位</b> ${h(wave.positioning?.spot || '')}${wave.positioning?.cover?' · 掩体 '+h(wave.positioning.cover):''}${wave.positioning?.exposedTo?' · 暴露给 '+h(wave.positioning.exposedTo):''}</p>
        ${skills?`<ul class="agent-skills">${skills}</ul>`:''}
        ${wave.enemyRead?`<p><b>对手</b> ${h(wave.enemyRead)}</p>`:''}
        <p><b>下一手</b> ${h(wave.nextTime || '')}</p></div>`;
    }).join('');
    return `<div class="agent-report"><h3>教练点评</h3><p>${h(s.summary)}</p>${waves}${s.drills?.length?`<div class="agent-drills"><h4>下一局练习</h4><ul>${s.drills.map(d=>`<li>${h(d)}</li>`).join('')}</ul></div>`:''}</div>`;
  }).join('');
}

function threadHTML(log) {
  if (!log?.length) {
    return `<div class="agent-msg status"><p class="muted">可在上方分析设置填写额外提示（可空），然后开始复盘。进度与结果会出现在这里。</p></div>`;
  }
  return log.map(m => `<div class="agent-msg ${h(m.role)}">${m.html || `<p>${h(m.text || '')}</p>`}</div>`).join('');
}

export function identityConfirmHTML(detected = {}, imported = {}) {
  const id = normalizeIdentity(detected);
  const team = normalizeTeamColor(detected.team);
  const roster = normalizeRosters({
    allies: detected.allies || imported.allies,
    enemies: detected.enemies || imported.enemies,
    swaps: detected.swaps || imported.swaps,
    hero: id.hero
  }, id.hero);
  const timeHint = Number.isFinite(id.time) ? `依据约 ${formatTime(id.time)} 的画面。` : '未能从画面稳定辨认时请手填。';
  const roleOptions = `<option value="" ${id.role ? '' : 'selected'} disabled>请选择</option>` +
    matchRoles.map(r => `<option value="${h(r)}" ${id.role === r ? 'selected' : ''}>${h(r)}</option>`).join('');
  const sideVal = id.side || '未指定';
  const sideOptions = matchSides.map(s => `<option value="${h(s)}" ${sideVal === s ? 'selected' : ''}>${h(s)}</option>`).join('');
  const teamOptions = [['unknown', '未识别'], ['blue', '蓝色'], ['red', '红色']]
    .map(([v, label]) => `<option value="${v}" ${team === v ? 'selected' : ''}>${label}</option>`).join('');
  const evidence = detected.evidence || {};
  const evidenceLines = [
    evidence.pov ? '英雄：' + evidence.pov : '',
    evidence.team ? '队伍：' + evidence.team : '',
    evidence.bars ? '阵容：' + evidence.bars : '',
    evidence.map ? '地图：' + evidence.map : ''
  ].filter(Boolean);
  const evidenceHtml = evidenceLines.length ?
    `<details class="fold"><summary class="fold-summary"><span>识别依据</span></summary><div class="fold-body"><ul class="muted">${evidenceLines.map(line => `<li>${h(line)}</li>`).join('')}</ul></div></details>` :
    '';
  return `<div class="identity-card" data-identity-gate>
  <h3>确认对局身份与阵容</h3>
  <p class="input-help">${h(timeHint)} 玩家英雄只认第一视角武器/技能；队伍色看左下角；阵容看顶部英雄条。</p>
  ${evidenceHtml}
  <form class="fields identity-form">
    <div class="field-grid">
      <label>英雄<input name="hero" list="identity-heroes" value="${h(id.hero || '')}" placeholder="如温斯顿" required autocomplete="off"></label>
      <label>地图<input name="map" list="identity-maps" value="${h(id.map || '')}" placeholder="如国王大道" required autocomplete="off"></label>
    </div>
    <div class="field-grid">
      <label>职责<select name="role" required>${roleOptions}</select></label>
      <label>攻防<select name="side">${sideOptions}</select></label>
    </div>
    <div class="field-grid">
      <label>队伍色<select name="team">${teamOptions}</select></label>
      <label class="input-help">本人颜色 = 我方</label>
    </div>
    <label>我方英雄<input name="allies" list="identity-heroes" value="${h(roster.allies.join('、'))}" placeholder="逗号分隔，含自己" autocomplete="off"></label>
    <label>敌方英雄<input name="enemies" list="identity-heroes" value="${h(roster.enemies.join('、'))}" placeholder="逗号分隔，如西格玛、西拉" autocomplete="off"></label>
    <label>换人（可选）<input name="swaps" list="identity-heroes" value="${h((roster.swaps || []).join('、'))}" placeholder="如黑百合→卡西迪" autocomplete="off"></label>
    <datalist id="identity-heroes">${heroes.map(x => `<option value="${h(x)}">`).join('')}</datalist>
    <datalist id="identity-maps">${maps.map(x => `<option value="${h(x)}">`).join('')}</datalist>
    <p class="error-box identity-error" role="alert" hidden></p>
    <div class="actions action-line">
      <button class="primary" type="submit" data-confirm-identity>${icon('play', 13)} 确认并开始观察</button>
    </div>
  </form>
</div>`;
}

export function bindIdentityGate(root, {
  onConfirm,
  signal
}) {
  const form = root.querySelector('.identity-form');
  if (!form) return;
  const err = form.querySelector('.identity-error');
  const syncRole = () => {
    const n = normalizeIdentity({
      hero: form.elements.hero?.value
    });
    if (n.role && form.elements.role) form.elements.role.value = n.role;
  };
  form.elements.hero?.addEventListener('change', syncRole);
  form.elements.hero?.addEventListener('blur', syncRole);
  form.onsubmit = e => {
    e.preventDefault();
    if (signal?.aborted) return;
    const vals = Object.fromEntries(new FormData(form));
    const normalized = normalizeIdentity({
      hero: String(vals.hero || '').trim(),
      map: String(vals.map || '').trim(),
      role: String(vals.role || '').trim(),
      side: String(vals.side || '').trim()
    });
    const team = normalizeTeamColor(vals.team);
    const roster = normalizeRosters({
      allies: parseHeroField(vals.allies),
      enemies: parseHeroField(vals.enemies),
      swaps: parseHeroField(vals.swaps),
      hero: normalized.hero
    }, normalized.hero);
    if (!normalized.hero || !normalized.map || !matchRoles.includes(normalized.role)) {
      if (err) {
        err.hidden = false;
        err.textContent = '请填写白名单内的英雄、地图，并选择职责（重装 / 输出 / 辅助）。';
      }
      return;
    }
    form.querySelectorAll('input, select, button').forEach(el => {
      el.disabled = true;
    });
    onConfirm?.({
      ...normalized,
      ...roster,
      team,
      teamKnown: team !== 'unknown'
    });
  };
}

export function matchPage(match, app) {
  const {
    report: r,
    job
  } = match;
  const c = r?.context || job?.context || match.context;
  const matchRead = r?.matchRead || job?.matchRead;
  const scope = r || job;
  const timeInput = seconds => {
    const ms = Math.round(seconds * 1000);
    const fraction = String(ms % 1000).padStart(3, '0').replace(/0+$/, '');
    return formatTime(ms / 1000) + (fraction ? '.' + fraction : '');
  };
  const running = app.activeRun?.id === match.id;
  const pool = knowledgePool(app.cards, match);
  const notes = job?.notes || r?.notes || pool.slice(0, 24);
  const log = match.agentLog?.length ? match.agentLog : (r ? [{
    role: 'report',
    text: r.coach?.title || '复盘完成',
    html: agentReportHTML(r),
    at: r.created || Date.now()
  }] : []);
  const settingsBody = r ?
    `<p class="formatted">${formatTime(r.start)} – ${formatTime(r.end)} · 每 ${r.step} 秒采样</p><p class="formatted">${r.frameCount} 张采样帧 · ${r.events.length} 个画面观察</p><p class="input-help">模型 ${h(r.profile)}</p><div class="actions action-line"><button class="ghost" id="reset-job" type="button">重新分析</button></div>` :
    `<form id="review-form" class="fields"><div class="field-grid"><label>开始时间<input name="start" value="${timeInput(scope?.start??0)}" ${job?'readonly':''}></label><label>结束时间<input name="end" value="${timeInput(scope?.end??match.duration)}" ${job?'readonly':''}></label></div>
  <label>采样间隔<select name="step" ${job?'disabled':''}>${[4,2,1].map(v=>`<option value="${v}" ${v===(scope?.step||4)?'selected':''}>每 ${v} 秒 · ${{4:'常规复盘',2:'团战细看',1:'技能细看'}[v]}</option>`).join('')}</select></label>
  <label>额外提示词<textarea id="agent-input" name="extra" rows="3" placeholder="例如：调用版本技能卡重点抠屏障时机；按时间段拆开讲" ${running||job?'readonly':''}>${h(match.focusExtra||'')}</textarea></label>
  <p class="input-help" id="estimate"></p>
  ${job?`<p class="info-box" id="job-status" role="status">${job.awaitingIdentity&&!job.context?'等待确认身份与双方阵容。':`已保存 ${job.done} 批画面观察。`}</p><div class="actions"><button id="reidentify" class="ghost" type="button">重新辨认</button><button id="reset-job" class="ghost" type="button">重置进度</button></div>`:`<p class="info-box" id="job-status" role="status" hidden></p>`}
  </form>`;
  const rosterHeading = (c?.allies?.length || c?.enemies?.length) ?
    `<p class="input-help">${h([(c.allies?.length ? '我方 ' + c.allies.join('、') : ''), (c.enemies?.length ? '敌方 ' + c.enemies.join('、') : '')].filter(Boolean).join('；'))}</p>` :
    '';
  return `<a class="back" href="#history">← 对局记录</a><div class="review-heading"><div><h1>${h(match.title)}</h1><p>${h([c.map,c.hero,c.role,c.side].filter(x=>x&&x!=='未指定').join(' · ')||'第一视角录像')} · ${formatTime(match.duration)} ${match.code?' · '+h(match.code):''}</p>${rosterHeading}</div><div class="actions">${r?`<button class="ghost" id="export-md" type="button">导出 Markdown</button>`:''}<button class="icon-button" id="delete-match" aria-label="删除对局" title="删除对局">${icon('trash')}</button></div></div>
  <div class="review-grid">
  <div class="player-stack">
    <div class="panel player-panel"><video id="player" class="player" controls playsinline preload="metadata" poster="${h(match.cover)}"></video></div>
    <div class="panel agent-terminal">
      <div class="agent-shell">
        <div id="agent-thread" class="agent-thread">${threadHTML(log)}</div>
        <p class="error-box" id="run-error" role="alert"></p>
      </div>
    </div>
  </div>
  <aside class="panel agent-panel">
    <details class="fold"${r?'':' open'}><summary class="fold-summary"><span>${icon(r?'note':'crosshair',16)} 分析设置</span>${r?`<span class="tag">已完成</span>`:job?`<span class="tag">进行中</span>`:''}</summary><div class="fold-body">${settingsBody}</div></details>
    <div class="agent-composer agent-composer-bar-only">
      <p id="agent-status-line" class="agent-status" role="status">${running&&app.activeRun?.line?h(app.activeRun.line):r?'复盘已完成':''}</p>
      <div class="agent-composer-actions">
        ${running?`<button class="secondary" type="button" id="agent-stop">${icon('stop',13)} 暂停</button>`:
          r?``:`<button class="primary" type="button" id="agent-send">${icon('play',13)} ${job?'继续分析':'开始复盘'}</button>`}
      </div>
    </div>
  </aside></div>
  <details class="fold report-section"><summary class="fold-summary"><span>${icon('book',16)} 本局知识库</span><span class="tag">${notes.length}</span></summary><div class="fold-body actions">${notes.map(n=>`<button class="source-chip" data-card="${h(n.id)}">${icon('book',14)} ${h(n.title)}</button>`).join('')||'<span class="muted">未选择知识库卡片。</span>'}</div></details>
  ${matchReadTimelineHTML(matchRead, c)}
  ${r?`<details class="fold report-section"><summary class="fold-summary"><span>${icon('layers',16)} 画面证据</span><span class="tag">${r.events.length}</span></summary><div class="fold-body">${evidenceHTML(r)}</div></details>`:''}`;
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
  const bindSeek = root => {
    root.querySelectorAll('[data-seek]').forEach(btn => btn.onclick = () => {
      player.currentTime = Number(btn.dataset.seek);
      player.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
      player.focus();
    });
  };
  bindSeek(document.getElementById('main') || document);
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
  const exportMd = document.getElementById('export-md');
  if (exportMd && match.report) {
    exportMd.onclick = () => {
      const body = reportMarkdown(match.report);
      const blob = new Blob([body], {
        type: 'text/markdown;charset=utf-8'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const base = (match.title || 'report').trim().replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_').slice(0, 120) || 'report';
      a.href = url;
      a.download = base + '.md';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2500);
    };
  }
  document.getElementById('delete-match').onclick = () => modal('删除这份对局', `<p>本机保存的《${h(match.title)}》录像与报告将一并删除。</p><div class="actions end action-line"><button class="secondary" data-no>取消</button><button class="danger" data-yes>删除对局</button></div>`, d => {
    d.querySelector('[data-no]').onclick = () => d.close();
    d.querySelector('[data-yes]').onclick = () => guard(async () => {
      await deleteMatch(match.id);
      d.close();
      location.hash = 'history';
    });
  });
  const reset = document.getElementById('reset-job');
  if (reset) reset.onclick = () => modal('重新选择复盘范围', `<p>清除本次分析的已保存进度与报告，保留原录像和对局信息。Agent 对话记录会一并清空。</p><div class="actions end action-line"><button class="secondary" data-no>取消</button><button class="primary" data-yes>重置分析</button></div>`, d => {
    d.querySelector('[data-no]').onclick = () => d.close();
    d.querySelector('[data-yes]').onclick = () => guard(async () => {
      const saved = await get('matches', match.id);
      if (!saved) return;
      delete saved.job;
      delete saved.report;
      delete saved.agentLog;
      delete saved.focusExtra;
      await put('matches', saved);
      d.close();
      await app.refresh();
    });
  });
  const reidentify = document.getElementById('reidentify');
  if (reidentify) reidentify.onclick = () => modal('重新辨认身份', `<p>清除已确认的英雄/地图与已观察进度，保留时间范围，下次开始会重新视觉辨认并请你确认。</p><div class="actions end action-line"><button class="secondary" data-no>取消</button><button class="primary" data-yes>重新辨认</button></div>`, d => {
    d.querySelector('[data-no]').onclick = () => d.close();
    d.querySelector('[data-yes]').onclick = () => guard(async () => {
      const saved = await get('matches', match.id);
      if (!saved?.job) return;
      const {
        start,
        end,
        step,
        profile
      } = saved.job;
      saved.job = {
        start,
        end,
        step,
        profile,
        notes: [],
        done: 0,
        events: [],
        sections: [],
        summarized: 0,
        waves: [],
        waved: 0
      };
      saved.agentLog = (saved.agentLog || []).filter(m => m.role !== 'identity');
      await put('matches', saved);
      d.close();
      await app.refresh();
    });
  });
  const error = document.getElementById('run-error');
  const form = document.getElementById('review-form');
  const optionsFromForm = () => {
    if (!form) {
      return {
        start: match.job?.start ?? 0,
        end: match.job?.end ?? match.duration,
        step: match.job?.step || 4,
        windows: sampleWindows(match.job?.start ?? 0, match.job?.end ?? match.duration, match.job?.step || 4)
      };
    }
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
  if (form) {
    const update = () => {
      try {
        const p = optionsFromForm();
        form.querySelector('#estimate').textContent = (!match.job || match.job.awaitingIdentity && !match.job.context ? '先辨认第一人称身份与双方阵容，确认后再观察。' : '') + p.windows.reduce((s, w) => s + w.length, 0) + ' 张画面，分 ' + p.windows.length + ' 批发送给当前模型，再写教练长文。时间支持秒数或 mm:ss。';
      } catch (e) {
        form.querySelector('#estimate').textContent = e.message;
      }
    };
    form.oninput = update;
    update();
    form.onsubmit = e => {
      e.preventDefault();
      document.getElementById('agent-send')?.click();
    };
  }
  const stop = document.getElementById('agent-stop');
  if (stop) stop.onclick = () => app.activeRun?.controller.abort();
  const send = document.getElementById('agent-send');
  if (send) send.onclick = async () => {
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
      } = optionsFromForm();
      const extra = (document.getElementById('agent-input')?.value || '').trim();
      if (extra) {
        const saved = await get('matches', match.id);
        saved.focusExtra = extra;
        saved.agentLog = saved.agentLog || [];
        saved.agentLog.push({
          role: 'user',
          text: extra,
          at: Date.now()
        });
        await put('matches', saved);
        const thread = document.getElementById('agent-thread');
        if (thread) {
          const node = document.createElement('div');
          node.className = 'agent-msg user';
          node.innerHTML = `<p>${h(extra)}</p>`;
          thread.appendChild(node);
          thread.scrollTop = thread.scrollHeight;
        }
      }
      await app.startRun(match, {
        ...p,
        extraPrompt: extra
      });
    } catch (err) {
      error.textContent = errorText(err);
    }
  };
  if (app.lastIssue?.id === match.id) error.textContent = app.lastIssue.message;
  if (app.activeRun?.id === match.id && app.activeRun.line) {
    const status = document.getElementById('agent-status-line');
    if (status) status.textContent = app.activeRun.line;
    const jobStatus = document.getElementById('job-status');
    if (jobStatus) jobStatus.textContent = app.activeRun.line;
  }
}
