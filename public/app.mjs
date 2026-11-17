import {
  providers,
  formatTime,
  safeLink,
  roles
} from '/shared/domain.mjs';
import {
  icon,
  hydrateIcons,
  escapeHTML as h,
  api,
  modal,
  toast,
  errorText,
  localPrefs
} from './ui.mjs';
import {
  all,
  get,
  saveImport
} from './storage.mjs';
import {
  openVideo,
  capture
} from './media.mjs';
import {
  dashboard,
  historyPage,
  examplePage,
  pageIntro
} from './dashboard.mjs';
import {
  examples
} from './examples.mjs';
import {
  knowledgePage,
  bindKnowledge,
  showNote
} from './library.mjs';
import {
  settingsPage,
  bindSettings
} from './settings.mjs';
import {
  matchPage,
  bindMatch
} from './match.mjs';
import {
  runReview
} from './review.mjs';

const main = document.getElementById('main'),
  fileInput = document.getElementById('video-file');
const nav = [
  ['workspace', 'grid', '复盘工作台'],
  ['history', 'history', '对局记录'],
  ['knowledge', 'book', '教练知识库']
];
document.getElementById('navigation').innerHTML = nav.map(([id, i, t]) => `<a class="nav-item" data-page="${id}" href="#${id}">${icon(i)}<span>${t}</span></a>`).join('');
hydrateIcons();
document.querySelector('.skip').onclick = e => {
  e.preventDefault();
  main.focus();
};
const prefs = localPrefs(),
  secrets = new Map();
let selected = prefs.selected || 'openai',
  verified = false,
  builtins = [],
  pinnedNotes = [],
  uploadTab = 'video',
  pendingLookup = null,
  fileTicket = 0;
const current = () => location.hash.slice(1) || 'workspace';

function statusLabel() {
  const ready = app.hasModel(),
    el = document.getElementById('model-status');
  el.classList.toggle('ready', ready);
  el.querySelector('span:nth-child(2)').textContent = verified ? '视觉模型已连接' : ready ? '视觉模型已配置' : '模型待配置';
}
const app = {
  cards: [],
  status: {},
  renderToken: 0,
  activeRun: null,
  playerUrl: null,
  lastIssue: null,
  profileFor(id) {
    return {
      provider: id,
      base: id === 'server' ? '' : (providers[id]?.base || prefs.bases?.[id] || ''),
      model: id === 'server' ? (this.status.serverModel || '') : (prefs.models?.[id] || providers[id]?.model || ''),
      key: secrets.get(id) || ''
    };
  },
  settings() {
    return this.profileFor(selected);
  },
  hasModel() {
    const s = this.settings();
    if (s.provider === 'server') return !!this.status.serverModel;
    if (!s.model) return false;
    if (s.provider === 'custom') return !!s.base;
    return !!s.key;
  },
  saveProfile(v, tested) {
    selected = v.provider;
    secrets.set(v.provider, v.key);
    prefs.selected = selected;
    prefs.models = {
      ...prefs.models,
      [selected]: v.model
    };
    prefs.bases = {
      ...prefs.bases,
      [selected]: v.base || ''
    };
    verified = tested;
    try {
      localStorage.setItem('owg:model', JSON.stringify(prefs));
    } catch {}
    statusLabel();
  },
  async refresh() {
    return render();
  },
  async startRun(match, options) {
    const controller = new AbortController();
    this.activeRun = {
      id: match.id,
      controller,
      line: '正在准备录像…'
    };
    this.lastIssue = null;
    const settings = this.settings();
    const buttons = document.getElementById('run-actions');
    if (buttons) {
      buttons.innerHTML = `<button class="secondary" type="button" id="stop-run">${icon('stop',13)} 暂停</button>`;
      buttons.firstChild.onclick = () => controller.abort();
    }
    const update = (stage, count, total) => {
      this.activeRun.line = stage + ' · ' + count + ' / ' + total + ' 已完成';
      if (current() === 'review/' + match.id) {
        const el = document.getElementById('job-status');
        if (el) el.textContent = this.activeRun.line;
      }
    };
    try {
      await runReview(match.id, options, settings, this.cards, controller.signal, update);
      toast('对局复盘已完成');
    } catch (e) {
      const message = controller.signal.aborted ? '已暂停，完成的分析会保留。' : errorText(e);
      this.lastIssue = {
        id: match.id,
        message
      };
      toast(message);
    } finally {
      this.activeRun = null;
      if (current() === 'review/' + match.id) await render();
    }
  }
};

function stopPlayer() {
  const player = document.getElementById('player');
  if (player) player.pause();
  if (app.playerUrl) {
    URL.revokeObjectURL(app.playerUrl);
    app.playerUrl = null;
  }
}

function closeMenu() {
  document.getElementById('rail').classList.remove('open');
  document.getElementById('menu').setAttribute('aria-expanded', 'false');
}
document.getElementById('menu').onclick = () => {
  const open = document.getElementById('rail').classList.toggle('open');
  document.getElementById('menu').setAttribute('aria-expanded', String(open));
};
main.addEventListener('pointerdown', closeMenu);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeMenu();
});
let initialized = false;
async function render() {
  if (!initialized) return;
  const token = ++app.renderToken;
  stopPlayer();
  pinnedNotes = [];
  const route = current(),
    [page, id] = route.split('/');
  const active = page === 'review' ? 'history' : page === 'example' ? 'workspace' : page;
  const names = {
    workspace: '复盘工作台',
    history: '对局记录',
    knowledge: '教练知识库',
    settings: '模型设置',
    review: '对局复盘',
    example: '示例复盘'
  };
  document.getElementById('crumb').textContent = names[page] || '工作台';
  document.title = (names[page] || '工作台') + ' · Overwatch Guide';
  for (const el of document.querySelectorAll('[data-page]')) {
    const yes = el.dataset.page === active;
    el.classList.toggle('active', yes);
    if (yes) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  }
  try {
    const [own, matches] = await Promise.all([all('cards'), all('shelf')]);
    if (token !== app.renderToken) return;
    app.cards = [...builtins, ...own];
    matches.sort((a, b) => b.created - a.created);
    if (page === 'workspace') {
      main.innerHTML = dashboard(app.cards, matches, uploadTab);
      bindIntake();
    } else if (page === 'history') {
      main.innerHTML = historyPage(matches);
    } else if (page === 'knowledge') {
      main.innerHTML = knowledgePage(app.cards);
      bindKnowledge(app.cards, app);
    } else if (page === 'settings') {
      main.innerHTML = settingsPage(app);
      bindSettings(app);
      if (app.returnTo && matches.some(m => 'review/' + m.id === app.returnTo)) {
        const a = document.createElement('a');
        a.className = 'back';
        a.href = '#' + app.returnTo;
        a.textContent = '← 返回当前对局';
        main.prepend(a);
      }
    } else if (page === 'example') {
      const ex = examples.find(x => x.id === id);
      main.innerHTML = ex ? examplePage(ex, app.cards) : missing();
    } else if (page === 'review') {
      const match = await get('matches', id);
      if (token !== app.renderToken) return;
      if (!match) {
        main.innerHTML = missing();
        return;
      }
      app.returnTo = route;
      pinnedNotes = match.report?.notes || match.job?.notes || [];
      main.innerHTML = matchPage(match, app);
      await bindMatch(match, app, token);
    } else main.innerHTML = missing();
  } catch (e) {
    main.innerHTML = pageIntro('无法打开工作区', '请检查浏览器是否允许当前站点使用本机存储。') + `<p class="error-box">${h(errorText(e))}</p><button class="secondary action-line" id="retry">重试</button>`;
    document.getElementById('retry').onclick = render;
  }
}

function missing() {
  return pageIntro('找不到这份内容', '可能已经从本机删除。', '<a class="secondary" href="#workspace">返回工作台</a>');
}

function bindIntake() {
  main.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
    uploadTab = b.dataset.tab;
    render();
  });
  const drop = document.getElementById('dropzone');
  if (drop) {
    for (const ev of ['dragenter', 'dragover']) drop.addEventListener(ev, e => {
      e.preventDefault();
      drop.classList.add('over');
    });
    drop.addEventListener('dragleave', e => {
      if (!drop.contains(e.relatedTarget)) drop.classList.remove('over');
    });
    drop.addEventListener('drop', e => {
      e.preventDefault();
      drop.classList.remove('over');
      const file = e.dataTransfer.files[0];
      if (file) openImport(file, null);
    });
  }
  const form = document.getElementById('code-form');
  if (form) form.onsubmit = async e => {
    e.preventDefault();
    const code = document.getElementById('code-input').value.toUpperCase();
    const btn = form.querySelector('button');
    btn.disabled = true;
    form.querySelector('small').textContent = '正在查询回放资料…';
    try {
      const result = await api('replay', {
        code
      });
      if (form.isConnected) showReplay(result);
    } catch (err) {
      if (form.isConnected) showReplay({
        code,
        status: 'failed',
        message: errorText(err)
      });
    } finally {
      btn.disabled = false;
      form.querySelector('small').textContent = '可关联本地录屏或通过 MCP 查询回放资料。';
    }
  };
}
main.addEventListener('click', e => {
  const file = e.target.closest('[data-file]');
  if (file) {
    chooseFile(null);
    return;
  }
  const btn = e.target.closest('[data-card]');
  if (btn) {
    const c = [...pinnedNotes, ...app.cards].find(c => c.id === btn.dataset.card);
    if (c) showNote(c, pinnedNotes.includes(c) ? null : app);
  }
});

function chooseFile(lookup) {
  pendingLookup = lookup;
  fileInput.value = '';
  fileInput.click();
}
fileInput.onchange = () => {
  const f = fileInput.files[0],
    lookup = pendingLookup;
  pendingLookup = null;
  if (f) openImport(f, lookup);
};

function showReplay(result) {
  const reasons = {
    unconfigured: '当前服务尚未连接回放 MCP。可从游戏客户端录制并关联这个代码。',
    empty: '已查询 MCP，未找到这个代码的资料。仍可在游戏客户端尝试导入。',
    failed: result.message,
    metadata: '已取得回放资料。逐波分析需要玩家第一视角录像。',
    capture: '已在本机录屏目录找到与此代码对应的视频。'
  };
  const states = {
    unverified: '未经客户端核验',
    client_verified: '已有客户端核验记录',
    source_reports_expired: '来源标记为过期',
    needs_recheck: '需要重新核验',
    user_reported_working: '玩家反馈可用'
  };
  const src = safeLink(result.source),
    vod = safeLink(result.videoUrl);
  modal('回放代码 ' + result.code, `<div class="fields"><p class="info-box">${h(reasons[result.status]||'请关联对局录像。')}</p>
  ${result.status==='metadata'?`<p>${h([result.map,...(result.heroes||[]),states[result.verification]].filter(Boolean).join(' · '))}</p>${src?`<a href="${h(src)}" target="_blank" rel="noopener noreferrer" class="source-out">查看回放资料 ${icon('upRight',14)}</a>`:''}${vod?`<a href="${h(vod)}" target="_blank" rel="noopener noreferrer" class="source-out">打开关联视频 ${icon('upRight',14)}</a>`:''}${(result.warnings||[]).length?`<details><summary>来源备注</summary><ul class="simple-list">${result.warnings.map(w=>`<li>${h(w)}</li>`).join('')}</ul></details>`:''}`:''}
  ${result.status!=='capture'?'<p class="input-help">在游戏中打开「生涯概况 → 历史记录 → 回放 → 导入」，切到玩家第一视角录制需要复盘的时段。</p>':''}
  <p class="error-box" role="alert"></p><div class="actions">${result.status==='capture'?'<button class="primary" id="load-capture">使用已关联的录像</button>':''}<button class="secondary" id="attach-video">选择本地录像</button></div></div>`, d => {
    d.querySelector('#attach-video').onclick = () => chooseFile(result);
    const load = d.querySelector('#load-capture');
    if (load) load.onclick = async () => {
      load.disabled = true;
      try {
        const res = await fetch(result.videoUrl);
        if (!res.ok) throw new Error('录屏文件已移走，请重新选择。');
        const b = await res.blob();
        await openImport(new File([b], result.code + '.' + (b.type.includes('webm') ? 'webm' : b.type.includes('quicktime') ? 'mov' : 'mp4'), {
          type: b.type
        }), result);
      } catch (e) {
        d.querySelector('.error-box').textContent = errorText(e);
        load.disabled = false;
      }
    };
  });
}
async function openImport(file, lookup) {
  if (!file.size) {
    toast('这份视频文件是空的。');
    return;
  }
  const ticket = ++fileTicket;
  const wait = modal('读取录像', '<p class="muted">正在本机读取时长与预览画面…</p>');
  let reader, cover, duration;
  try {
    reader = await openVideo(file);
    duration = reader.duration;
    cover = await capture(reader, Math.min(1, duration / 3), 480);
  } catch (e) {
    if (ticket === fileTicket && wait.open) modal('录像无法导入', '<p class="error-box">' + h(errorText(e)) + '</p>');
    return;
  } finally {
    reader?.close();
  }
  if (ticket !== fileTicket || !wait.open || !wait.textContent.includes('正在本机读取')) return;
  const title = file.name.replace(/\.[a-z0-9]{2,6}$/i, '');
  const heroes = ['温斯顿', '安娜', '猎空', '士兵：76', '莱因哈特', 'D.Va', '查莉娅', '源氏', '雾子', '卢西奥', '布丽吉塔', '禅雅塔', '艾什', '卡西迪', '西格玛', '拉玛刹', '末日铁拳', '骇灾', '无漾', '索杰恩'];
  const maps = ['国王大道', '多拉多', '漓江塔', '直布罗陀监测站', '努巴尼', '好莱坞', '伊利奥斯', '里阿尔托', '艾兴瓦尔德', '香巴里寺院'];
  const hero = heroes.find(x => title.includes(x)) || '',
    map = maps.find(x => title.includes(x)) || lookup?.map || '';
  modal('导入对局录像', `<div class="file-preview"><img src="${h(cover)}" alt="录像预览"><div><b>${h(file.name)}</b><small>${formatTime(duration)} · ${(file.size/1048576).toFixed(1)} MB${lookup?' · 回放码 '+h(lookup.code):''}</small></div></div>
  <form id="import-form" class="fields"><label>对局名称<input name="title" maxlength="120" value="${h(title)}" required></label>
  <div class="field-grid"><label>玩家英雄<input name="hero" list="heroes" value="${h(hero)}" placeholder="可选，如温斯顿"><datalist id="heroes">${heroes.map(x=>`<option value="${h(x)}">`).join('')}</datalist></label>
  <label>地图<input name="map" list="maps" value="${h(map)}" placeholder="可选，如国王大道"><datalist id="maps">${maps.map(x=>`<option value="${h(x)}">`).join('')}</datalist></label></div>
  <div class="field-grid"><label>职责<select name="role">${['通用',...roles.filter(r=>r!=='通用')].map(r=>`<option>${r}</option>`).join('')}</select></label><label>攻防<select name="side"><option>未指定</option><option>进攻</option><option>防守</option><option>攻防双方</option><option>控制 / 推进</option></select></label></div>
  <label>本局关注点<textarea name="focus" maxlength="500" placeholder="例如：分析 A 点每一轮进场的落位，以及屏障该何时交。"></textarea></label>
  <p class="input-help">原录像保存在当前浏览器。点击「开始复盘」时才会发送采样帧。</p><p class="error-box" role="alert"></p>
  <div class="actions end"><button class="primary" type="submit">保存并打开对局 ${icon('arrow',15)}</button></div></form>`, d => {
    const f = d.querySelector('form');
    f.onsubmit = async e => {
      e.preventDefault();
      const vals = Object.fromEntries(new FormData(f)),
        btn = f.querySelector('[type=submit]'),
        err = f.querySelector('.error-box');
      if (!vals.title.trim()) {
        err.textContent = '请填写对局名称。';
        return;
      }
      const item = {
        id: crypto.randomUUID(),
        title: vals.title.trim(),
        filename: file.name,
        context: {
          hero: vals.hero.trim(),
          map: vals.map.trim(),
          role: vals.role,
          side: vals.side,
          focus: vals.focus.trim()
        },
        created: Date.now(),
        duration,
        cover,
        code: lookup?.code || ''
      };
      btn.disabled = true;
      try {
        await saveImport(item, file);
        d.close();
        location.hash = 'review/' + item.id;
        toast('录像已保存在本机');
      } catch (error) {
        err.textContent = errorText(error);
        btn.disabled = false;
      }
    };
  });
}
window.addEventListener('hashchange', () => {
  const d = document.getElementById('dialog');
  if (d.open) d.close();
  closeMenu();
  window.scrollTo(0, 0);
  render();
});
window.addEventListener('beforeunload', e => {
  if (app.activeRun) {
    e.preventDefault();
    e.returnValue = '';
  }
});
async function boot() {
  try {
    const [seeds, status] = await Promise.all([fetch('/shared/knowledge.json').then(r => {
      if (!r.ok) throw Error('教学资料无法加载');
      return r.json();
    }), api('status')]);
    builtins = seeds;
    app.status = status;
    if ((!prefs.selected && status.serverModel) || (selected === 'server' && !status.serverModel)) selected = status.serverModel ? 'server' : 'openai';
    if (selected !== 'server' && !providers[selected]) selected = 'openai';
    initialized = true;
    statusLabel();
    await render();
  } catch (e) {
    main.innerHTML = '<div class="panel empty"><h2>无法加载工作台</h2><p>' + h(errorText(e)) + '</p><button class="secondary" id="retry-boot">重试</button></div>';
    document.getElementById('retry-boot').onclick = boot;
  }
}
boot();
