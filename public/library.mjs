import {
  escapeHTML as h,
  icon,
  modal,
  api,
  toast,
  errorText
} from './ui.mjs';
import {
  roles,
  safeLink
} from '/shared/domain.mjs';
import {
  pageIntro,
  avatar
} from './dashboard.mjs';
import {
  put,
  removeCard
} from './storage.mjs';

export function knowledgePage(cards) {
  return pageIntro('教练知识库', '检索教学原则、观摩课程和英雄机制。每条资料都保留出处。', `<button class="primary" id="new-note">${icon('plus',16)} 添加教学资料</button>`) +
    `<div class="filterbar"><label class="search-input">${icon('search',16)}<input id="note-search" placeholder="搜索英雄、教练或知识点" aria-label="搜索知识库"></label><div class="pills" id="role-filter">${['全部',...roles].map((r,i)=>`<button data-role="${r}" aria-pressed="${i===0}">${r}</button>`).join('')}</div></div><div class="knowledge-grid" id="note-grid">${noteGrid(cards)}</div>`;
}

function noteGrid(cards) {
  if (!cards.length) return '<div class="panel empty">没有符合条件的教学资料。</div>';
  return cards.map(c => `<button class="note-card" data-card="${h(c.id)}"><div class="card-by">${avatar(c.author)}<span>${h(c.author)}</span><span class="tag">${h(c.kind)}</span></div><h3>${h(c.title)}</h3><p>${h(c.principle)}</p><div class="card-tags"><span class="tag">${h(c.role)}</span>${(c.tags||[]).slice(0,2).map(tag=>`<span class="tag">${h(tag)}</span>`).join('')}</div></button>`).join('');
}
export function bindKnowledge(cards, app) {
  let role = '全部';
  const input = document.getElementById('note-search');
  const update = () => {
    const q = input.value.trim().toLowerCase();
    const filtered = cards.filter(c => (role === '全部' || c.role === role) && [c.title, c.author, c.principle, c.application, ...(c.tags || []), ...(c.heroes || [])].join(' ').toLowerCase().includes(q));
    document.getElementById('note-grid').innerHTML = noteGrid(filtered);
  };
  input.oninput = update;
  document.getElementById('role-filter').onclick = e => {
    const b = e.target.closest('[data-role]');
    if (!b) return;
    role = b.dataset.role;
    for (const btn of b.parentElement.children) btn.setAttribute('aria-pressed', String(btn === b));
    update();
  };
  document.getElementById('new-note').onclick = () => editNote(null, app);
}

export function showNote(c, app) {
  if (!c) return;
  const link = safeLink(c.url);
  modal(c.title, `<div class="card-by">${avatar(c.author)}<span>${h(c.author)}</span><span class="tag">${h(c.kind)}</span></div><div class="detail-label">${c.kind==='观摩索引'?'课程主题':'教学要点'}</div><p>${h(c.principle)}</p><div class="detail-label">复盘时怎么用</div><p>${h(c.application)}</p>${c.quote?`<div class="detail-label">核对摘录</div><p>“${h(c.quote)}”</p>`:''}<div class="detail-label">资料来源</div>${link?`<a class="source-out" href="${h(link)}" target="_blank" rel="noopener noreferrer">${h(c.sourceTitle||c.author)} ${icon('upRight',14)}</a>`:h(c.sourceTitle||'本机笔记')}<div class="card-tags action-line"><span class="tag">${h(c.role||'通用')}</span>${(c.tags||[]).map(t=>`<span class="tag">${h(t)}</span>`).join('')}</div>${c.id.startsWith('user-')&&app?'<div class="actions action-line"><button class="secondary" id="edit-note">编辑资料</button><button class="danger" id="remove-note">删除</button></div>':''}`,
    d => {
      const edit = d.querySelector('#edit-note');
      if (edit) edit.onclick = () => editNote(c, app);
      const del = d.querySelector('#remove-note');
      if (del) del.onclick = () => {
        modal('删除教学资料', `<p>删除本机资料《${h(c.title)}》？已生成的报告会保留当时的引用。</p><div class="actions end action-line"><button class="secondary" id="back-note">取消</button><button class="danger" id="yes-note">删除资料</button></div>`, dlg => {
          dlg.querySelector('#back-note').onclick = () => showNote(c, app);
          dlg.querySelector('#yes-note').onclick = async () => {
            await removeCard(c.id);
            dlg.close();
            await app.refresh();
            toast('已删除教学资料');
          };
        });
      };
    });
}

function editNote(card, app) {
  const c = card || {};
  modal(card ? '编辑教学资料' : '添加教学资料', `<form id="note-form" class="fields">
    <div class="field-grid"><label>教练或作者<input name="author" maxlength="70" value="${h(c.author)}" placeholder="如 Spilo" required></label><label>适用职责<select name="role">${roles.map(r=>`<option ${r===(c.role||'通用')?'selected':''}>${r}</option>`).join('')}</select></label></div>
    <label>来源标题<input name="sourceTitle" maxlength="150" value="${h(c.sourceTitle)}" placeholder="课程、文章或视频标题" required></label>
    <label>来源链接<input type="url" name="url" value="${h(c.url)}" placeholder="https://…" required></label>
    <label>原文、字幕或自己的听课笔记<textarea name="excerpt" maxlength="12000" placeholder="粘贴要提炼的片段，可手工整理或交给模型。">${h(c.excerpt)}</textarea></label>
    <div class="actions"><button type="button" class="secondary" id="distill">${icon('cpu',15)} 从原文提炼</button><span class="input-help">使用当前模型，仅发送上方文本。</span></div>
    <label>知识点标题<input name="title" maxlength="80" value="${h(c.title)}" required></label>
    <label>教学要点<textarea name="principle" maxlength="600" required>${h(c.principle)}</textarea></label>
    <label>复盘时怎么用<textarea name="application" maxlength="600" required>${h(c.application)}</textarea></label>
    <div class="field-grid"><label>适用英雄<input name="heroes" maxlength="160" value="${h((c.heroes||[]).join('，'))}" placeholder="多个用逗号分隔"></label><label>检索标签<input name="tags" maxlength="160" value="${h((c.tags||[]).join('，'))}" placeholder="如 落位，视野"></label></div>
    <p class="info-box" id="quote-preview" ${c.quote?'':'hidden'}>${h(c.quote)}</p><p class="error-box" role="alert"></p>
    <div class="actions end"><button class="primary" type="submit">保存到知识库</button></div></form>`, d => {
    const f = d.querySelector('form'),
      err = d.querySelector('.error-box'),
      ai = d.querySelector('#distill');
    let quote = c.quote || '';
    const field = name => f.elements.namedItem(name);
    ai.onclick = async () => {
      err.textContent = '';
      if (!app.hasModel()) {
        err.textContent = '请先配置视觉模型，或手工填写下方教学要点。';
        return;
      }
      ai.disabled = true;
      ai.textContent = '正在提炼…';
      try {
        const result = await api('knowledge/distill', {
          excerpt: field('excerpt').value,
          settings: app.settings()
        });
        for (const k of ['title', 'principle', 'application']) field(k).value = result[k];
        quote = result.quote;
        d.querySelector('#quote-preview').hidden = false;
        d.querySelector('#quote-preview').textContent = '依据原文：“' + quote + '”';
      } catch (e) {
        err.textContent = errorText(e);
      } finally {
        ai.disabled = false;
        ai.textContent = '从原文提炼';
      }
    };
    f.onsubmit = async e => {
      e.preventDefault();
      err.textContent = '';
      const vals = Object.fromEntries(new FormData(f));
      const url = safeLink(vals.url);
      if (!url) {
        err.textContent = '请输入 http 或 https 开头的来源链接。';
        return;
      }
      const list = s => [...new Set(s.split(/[,，、]/).map(x => x.trim()).filter(Boolean))].slice(0, 12);
      const note = {
        ...vals,
        id: c.id || 'user-' + crypto.randomUUID(),
        title: vals.title.trim(),
        author: vals.author.trim(),
        url,
        kind: '教练笔记',
        quote: vals.excerpt.includes(quote) ? quote : '',
        heroes: list(vals.heroes),
        tags: list(vals.tags)
      };
      if (!note.title || !note.author || !note.principle.trim() || !note.application.trim()) {
        err.textContent = '请填写标题、作者、原则和复盘用法。';
        return;
      }
      try {
        await put('cards', note);
        d.close();
        await app.refresh();
        toast('教学资料已保存');
      } catch (error) {
        err.textContent = errorText(error);
      }
    };
  });
}
