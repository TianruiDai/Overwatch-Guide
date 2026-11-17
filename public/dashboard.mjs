import {
  icon,
  escapeHTML as h,
  roleIcon
} from './ui.mjs';
import {
  formatTime
} from '/shared/domain.mjs';
import {
  examples
} from './examples.mjs';

export const sectionTitle = (symbol, title, action = '') => `<div class="section-head"><h2><span class="head-icon">${icon(symbol,21)}</span>${title}</h2>${action}</div>`;
export const pageIntro = (title, description, action = '') => `<div class="page-intro"><div><h1>${title}</h1><p>${description}</p></div>${action}</div>`;
const avatarNames = {
  '人上人老王': ['王', 'orange'],
  'Guxue · 杭州闪电队': ['G', 'violet'],
  'Spilo': ['S', 'blue'],
  'mL7': ['m', 'green'],
  '暴雪娱乐': ['B', 'blue'],
  'Kajor': ['K', 'green']
};
export function avatar(author) {
  const [name, color] = avatarNames[author] || [String(author || '教').slice(0, 1), 'slate'];
  return `<span class="avatar ${color}" aria-hidden="true">${h(name)}</span>`;
}
export function examplesHTML() {
  return `<section class="example-section">${sectionTitle('layers','示例复盘','<span class="section-caption">战术情境演示</span>')}
  <div class="example-grid">${examples.map(ex=>`<a class="example" href="#example/${ex.id}"><div class="example-art" style="background-image:url('/art/${ex.art}.webp')"><span class="role-chip">${icon(roleIcon(ex.role),13)} ${ex.role}</span><span class="round-link">${icon('upRight',16)}</span></div><div class="example-body"><h3>${ex.map}</h3><p><b>${ex.hero}</b><span>·</span>${ex.topic}</p></div></a>`).join('')}</div></section>`;
}
export function featuredCoachHTML(cards) {
  const picks = ['wang-winston-replay', 'guxue-winston-matchups', 'spilo-dps-angles'].map(id => cards.find(c => c.id === id)).filter(Boolean);
  return `<section class="panel coach-preview">${sectionTitle('book','教练知识库',`<span class="count">${cards.length} 条</span>`)}
  <div class="coach-items">${picks.map(c=>`<button class="coach-item" data-card="${h(c.id)}">${avatar(c.author)}<span><b>${h(c.author.split(' · ')[0])}</b><small>${h(c.title)}</small></span>${icon('chevron',15)}</button>`).join('')}</div>
  <a class="panel-foot" href="#knowledge">浏览全部教学资料 ${icon('arrow',16)}</a></section>`;
}
export function uploadPanel(tab = 'video') {
  return `<section class="panel intake">${sectionTitle('film','导入对局')}
  <div class="tabbar" role="tablist" aria-label="导入方式"><button role="tab" aria-selected="${tab==='video'}" data-tab="video">${icon('video',16)} 视频文件</button><button role="tab" aria-selected="${tab==='code'}" data-tab="code">${icon('code',16)} 回放代码</button></div>
  ${tab==='video'?`<div class="dropzone" id="dropzone"><div class="upload-emblem">${icon('upload',23)}</div><div><b>将对局视频拖到这里</b><small>支持 MP4、WebM、MOV</small></div><button type="button" class="select-video" data-file>选择视频 ${icon('arrow',14)}</button></div>`:
  `<form class="code-form" id="code-form"><label for="code-input">输入 6 位游戏回放代码</label><div class="input-action"><input id="code-input" maxlength="6" minlength="6" pattern="[A-Za-z0-9]{6}" autocomplete="off" placeholder="如 ABC123" required><button class="primary" type="submit">查询代码 ${icon('arrow',15)}</button></div><small id="code-status" role="status">可关联本地录屏或通过 MCP 查询回放资料。</small></form>`}
  </section>`;
}
export function matchList(matches) {
  return `<div class="match-list">${matches.map(m=>`<a class="match-row" href="#review/${h(m.id)}">${m.cover?`<img src="${h(m.cover)}" alt="">`:icon('film',28)}<span class="row-name"><b>${h(m.title)}</b><small>${h(m.context.hero||'未指定英雄')} · ${formatTime(m.duration)} · ${new Date(m.created).toLocaleDateString('zh-CN')}</small></span><span class="state-chip ${m.report?'complete':''}">${m.report?'已复盘':m.job?'可继续':'待复盘'}</span>${icon('chevron',16)}</a>`).join('')}</div>`;
}
export function dashboard(cards, matches, tab) {
  return `<section class="hero-banner"><div class="hero-map"></div><div class="hero-shade"></div><div class="hero-lines"></div><img class="hero-character" src="/art/winston.webp" alt=""><div class="hero-copy"><div class="eyebrow"><span></span>VOD REVIEW STUDIO</div><h1>复盘工作台</h1><p>从第一视角回看每一波团战的站位、技能与决策。</p><a class="hero-action" href="#example/kings-row">${icon('playCircle',16)} 查看示例复盘 ${icon('arrow',14)}</a></div><span class="map-caption">${icon('map',12)} 国王大道</span></section>
  <div class="workspace-grid">${uploadPanel(tab)}${featuredCoachHTML(cards)}</div>
  ${matches.length?`<section class="recent">${sectionTitle('history','最近复盘','<a class="text-link" href="#history">全部记录 →</a>')}${matchList(matches.slice(0,3))}</section>`:''}
  ${examplesHTML()}`;
}
export function historyPage(matches) {
  return pageIntro('对局记录', '回到本机保存的录像、分析进度和复盘报告。', `<button class="primary" data-file>${icon('plus',16)} 导入录像</button>`) +
    (matches.length ? matchList(matches) : `<section class="empty panel"><span>${icon('history',36)}</span><h2>还没有对局记录</h2><p>导入一段第一视角录像后，就能在这里继续复盘。</p><button class="secondary" data-file>${icon('upload',16)} 选择视频</button></section>`);
}
export function examplePage(ex, cards) {
  return `<a class="back" href="#workspace">← 返回工作台</a><div class="example-cover" style="background-image:linear-gradient(90deg,#111720f5,#1418203b),url('/art/${ex.art}.webp')"><div class="eyebrow"><span></span>教学示例</div><h1>${ex.map} · ${ex.hero}</h1><p>${ex.topic}</p></div>
  <div class="page-intro compact"><div><h2>战术情境</h2><p>${ex.intro}</p></div></div><div class="timeline">${ex.moments.map(m=>{const c=cards.find(x=>x.id===m.note);return `<article class="moment"><span class="timeline-mark"></span><h3>${m.title}</h3><p class="formatted"><b>局面</b> ${m.situation}</p><p class="formatted"><b>下一步</b> ${m.action}</p>${c?`<button class="source-chip" data-card="${c.id}">${icon('book',14)} ${h(c.author)} · ${h(c.title)}</button>`:''}</article>`;}).join('')}</div><p class="muted"><small>此页为手工编写的训练情境。导入真实录像后可查看画面证据与时间戳。</small></p>`;
}
