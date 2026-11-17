import {
  escapeHTML as h,
  icon,
  modal,
  api,
  toast,
  errorText
} from './ui.mjs';
import {
  heroes,
  knowledgeCoverage,
  roles,
  safeLink,
  splitTranscript,
  stages
} from '/shared/domain.mjs';
import {
  normalizeCardNaming
} from '/shared/card-title.mjs';
import {
  pageIntro,
  avatar
} from './dashboard.mjs';
import {
  put,
  removeCard,
  hideCard,
  clearHidden
} from './storage.mjs';

export function knowledgePage(cards) {
  const coverage = knowledgeCoverage(cards, heroes.slice(0, 12));
  return pageIntro('教练知识库', '检索教学原则、观摩课程和英雄机制。每条资料都保留出处。') +
    `<details class="fold" open><summary class="fold-summary"><span>${icon('panels',16)} 资料操作</span><span class="tag">4</span></summary><div class="actions fold-body"><button class="secondary" id="import-notes">${icon('upload',16)} 链接导入</button><button class="secondary" id="export-pack">${icon('export',16)} 导出内置包</button><button class="ghost" id="restore-notes">恢复默认资料</button><button class="primary" id="new-note">${icon('plus',16)} 添加教学资料</button></div></details>
    <div class="panel pad"><div class="section-head"><h2><span class="head-icon">${icon('bars',18)}</span>资料覆盖</h2><span class="section-caption">${coverage.filled} / ${coverage.total} 个英雄×阶段</span></div>
    <p class="input-help">缺口表示该英雄在对应阶段还没有可引用的卡片。导入课程字幕后优先补这些空位。</p>
    <div class="coverage-grid">${coverage.matrix.filter(row=>row.missing.length).slice(0,12).map(row=>`<div class="coverage-card"><b>${h(row.hero)}</b><div class="card-tags">${row.missing.map(stage=>`<span class="tag">${h(stage)}</span>`).join('')||'<span class="tag">已齐</span>'}</div></div>`).join('')||'<p class="muted">当前抽样英雄的阶段资料已齐。</p>'}</div></div>
    <div class="filterbar"><label class="search-input">${icon('search',16)}<input id="note-search" placeholder="搜索英雄、教练或知识点" aria-label="搜索知识库"></label><div class="pills" id="role-filter">${['全部',...roles].map((r,i)=>`<button data-role="${r}" aria-pressed="${i===0}">${r}</button>`).join('')}</div></div><div class="knowledge-grid" id="note-grid">${noteGrid(cards)}</div>`;
}

function noteGrid(cards) {
  if (!cards.length) return '<div class="panel empty">没有符合条件的教学资料。</div>';
  return cards.map(c => `<button class="note-card" data-card="${h(c.id)}"><div class="card-by">${avatar(c.author)}<span>${h(c.author)}</span><span class="tag">${h(c.kind)}</span>${c.stage?`<span class="tag">${h(c.stage)}</span>`:''}</div><h3>${h(c.title)}</h3><p>${h(c.principle)}</p><div class="card-tags"><span class="tag">${h(c.role)}</span>${(c.tags||[]).slice(0,2).map(tag=>`<span class="tag">${h(tag)}</span>`).join('')}</div></button>`).join('');
}
export function bindKnowledge(cards, app) {
  let role = '全部';
  const input = document.getElementById('note-search');
  const update = () => {
    const q = input.value.trim().toLowerCase();
    const filtered = cards.filter(c => (role === '全部' || c.role === role) && [c.title, c.author, c.principle, c.application, c.stage, ...(c.tags || []), ...(c.heroes || [])].join(' ').toLowerCase().includes(q));
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
  document.getElementById('import-notes').onclick = () => importNotes(app);
  document.getElementById('export-pack').onclick = () => exportPack(cards);
  document.getElementById('restore-notes').onclick = () => modal('恢复默认资料', '<p>清除本机对内置卡片的隐藏记录，已自建的资料不受影响。</p><div class="actions end action-line"><button class="secondary" data-no>取消</button><button class="primary" data-yes>恢复默认</button></div>', d => {
    d.querySelector('[data-no]').onclick = () => d.close();
    d.querySelector('[data-yes]').onclick = async () => {
      await clearHidden();
      d.close();
      await app.refresh();
      toast('已恢复默认资料');
    };
  });
}

export function showNote(c, app) {
  if (!c) return;
  const link = safeLink(c.url);
  const custom = c.id.startsWith('user-');
  modal(c.title, `<div class="card-by">${avatar(c.author)}<span>${h(c.author)}</span><span class="tag">${h(c.kind)}</span>${c.stage?`<span class="tag">${h(c.stage)}</span>`:''}</div><div class="detail-label">${c.kind==='观摩索引'?'课程主题':'教学要点'}</div><p>${h(c.principle)}</p><div class="detail-label">复盘时怎么用</div><p>${h(c.application)}</p>${c.quote?`<div class="detail-label">核对摘录</div><p>“${h(c.quote)}”</p>`:''}<div class="detail-label">资料来源</div>${link?`<a class="source-out" href="${h(link)}" target="_blank" rel="noopener noreferrer">${h(c.sourceTitle||c.author)} ${icon('upRight',14)}</a>`:h(c.sourceTitle||'本机笔记')}<div class="card-tags action-line"><span class="tag">${h(c.role||'综合')}</span>${(c.tags||[]).map(t=>`<span class="tag">${h(t)}</span>`).join('')}</div>${app?`<div class="actions action-line">${custom?'<button class="secondary" id="edit-note">编辑资料</button>':''}<button class="danger" id="remove-note">删除</button></div>`:''}`,
    d => {
      const edit = d.querySelector('#edit-note');
      if (edit) edit.onclick = () => editNote(c, app);
      const del = d.querySelector('#remove-note');
      if (del) del.onclick = () => {
        modal('删除教学资料', `<p>${custom?'删除本机资料':'从本机工作区隐藏内置资料'}《${h(c.title)}》？已生成的报告会保留当时的引用。</p><div class="actions end action-line"><button class="secondary" id="back-note">取消</button><button class="danger" id="yes-note">删除资料</button></div>`, dlg => {
          dlg.querySelector('#back-note').onclick = () => showNote(c, app);
          dlg.querySelector('#yes-note').onclick = async () => {
            if (custom) await removeCard(c.id);
            else await hideCard(c.id);
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
    <div class="field-grid"><label>分类<select name="role">${roles.map(r=>`<option ${r===(c.role||'综合')?'selected':''}>${r}</option>`).join('')}</select></label><label>教练或作者<input name="author" maxlength="70" value="${h(c.author)}" placeholder="可空，链接提炼后自动填"></label></div>
    <label>来源标题<input name="sourceTitle" maxlength="150" value="${h(c.sourceTitle)}" placeholder="可空，链接提炼后自动填"></label>
    <label>来源链接<input type="url" name="url" value="${h(c.url)}" placeholder="https://…" required></label>
    <label>补充字幕或笔记（可选）<textarea name="excerpt" maxlength="12000" placeholder="抓取失败时粘贴标题、简介或字幕。有正文时也可只点「从原文提炼」。">${h(c.excerpt)}</textarea></label>
    <div class="actions"><button type="button" class="secondary" id="distill-url">${icon('cpu',15)} 从链接提炼</button><button type="button" class="ghost" id="distill">${icon('cpu',15)} 从原文提炼</button></div>
    <label>知识点标题<input name="title" maxlength="80" value="${h(c.title)}" required></label>
    <label>教学要点<textarea name="principle" maxlength="600" required>${h(c.principle)}</textarea></label>
    <label>复盘时怎么用<textarea name="application" maxlength="600" required>${h(c.application)}</textarea></label>
    <div class="field-grid"><label>适用英雄<input name="heroes" maxlength="160" value="${h((c.heroes||[]).join('，'))}" placeholder="多个用逗号分隔"></label><label>检索标签<input name="tags" maxlength="160" value="${h((c.tags||[]).join('，'))}" placeholder="如 落位，视野"></label></div>
    <div class="field-grid"><label>阶段<select name="stage">${stages.map(s=>`<option ${s===(c.stage||'团战')?'selected':''}>${s}</option>`).join('')}</select></label><label>适用地图<input name="maps" maxlength="160" value="${h((c.maps||[]).join('，'))}" placeholder="多个用逗号分隔"></label></div>
    <p class="info-box" id="quote-preview" ${c.quote?'':'hidden'}>${h(c.quote)}</p><p class="error-box" role="alert"></p>
    <div class="actions end"><button class="primary" type="submit">保存到知识库</button></div></form>`, d => {
    const f = d.querySelector('form'),
      err = d.querySelector('.error-box'),
      ai = d.querySelector('#distill'),
      aiUrl = d.querySelector('#distill-url');
    let quote = c.quote || '';
    const field = name => f.elements.namedItem(name);
    const applyDraft = result => {
      for (const k of ['title', 'principle', 'application']) if (result[k]) field(k).value = result[k];
      if (result.author && !field('author').value.trim()) field('author').value = result.author;
      if (result.sourceTitle && !field('sourceTitle').value.trim()) field('sourceTitle').value = result.sourceTitle;
      if (result.stage) field('stage').value = result.stage;
      if (result.role) field('role').value = result.role;
      if (result.heroes?.length) field('heroes').value = result.heroes.join('，');
      if (result.maps?.length) field('maps').value = result.maps.join('，');
      if (result.tags?.length) field('tags').value = result.tags.join('，');
      if (result.excerpt && !field('excerpt').value.trim()) field('excerpt').value = result.excerpt.slice(0, 4000);
      quote = result.quote || '';
      d.querySelector('#quote-preview').hidden = !quote;
      d.querySelector('#quote-preview').textContent = quote ? '依据原文：“' + quote + '”' : '';
    };
    aiUrl.onclick = async () => {
      err.textContent = '';
      if (!app.hasModel()) {
        err.textContent = '请先配置模型，或手工填写下方教学要点。';
        return;
      }
      const url = safeLink(field('url').value);
      if (!url) {
        err.textContent = '请先填写有效链接。';
        return;
      }
      aiUrl.disabled = true;
      aiUrl.textContent = '正在抓取提炼…';
      try {
        applyDraft(await api('knowledge/ingest-url', {
          url,
          role: field('role').value,
          author: field('author').value,
          sourceTitle: field('sourceTitle').value,
          excerpt: field('excerpt').value,
          settings: app.settings()
        }));
      } catch (e) {
        err.textContent = errorText(e);
      } finally {
        aiUrl.disabled = false;
        aiUrl.textContent = '从链接提炼';
      }
    };
    ai.onclick = async () => {
      err.textContent = '';
      if (!app.hasModel()) {
        err.textContent = '请先配置视觉模型，或手工填写下方教学要点。';
        return;
      }
      ai.disabled = true;
      ai.textContent = '正在提炼…';
      try {
        applyDraft(await api('knowledge/distill', {
          excerpt: field('excerpt').value,
          role: field('role').value,
          settings: app.settings()
        }));
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
      const note = normalizeCardNaming({
        ...vals,
        id: c.id || 'user-' + crypto.randomUUID(),
        title: vals.title.trim(),
        author: vals.author.trim() || '未署名',
        url,
        kind: '教练笔记',
        stage: stages.includes(vals.stage) ? vals.stage : '团战',
        quote: vals.excerpt.includes(quote) ? quote : '',
        heroes: list(vals.heroes),
        maps: list(vals.maps),
        tags: list(vals.tags)
      });
      note.sourceTitle = (vals.sourceTitle || '').trim() || note.title;
      note.kind = note.role === '版本' ? '官方机制' : '教练笔记';
      if (!note.title || !note.principle.trim() || !note.application.trim()) {
        err.textContent = '请填写标题、原则和复盘用法。';
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

function exportPack(cards) {
  const pack = cards.filter(c => c.id.startsWith('user-') || c.kind === '教练笔记' || c.kind === '官方机制').map(({
    excerpt,
    ...card
  }) => card);
  const blob = new Blob([JSON.stringify(pack, null, 2)], {
    type: 'application/json;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'knowledge-pack.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
  toast('已导出 ' + pack.length + ' 张卡片');
}

function importNotes(app) {
  modal('导入教学资料', `<form id="import-form" class="fields">
    <div class="field-grid"><label>分类<select name="role">${roles.map(r=>`<option ${r==='综合'?'selected':''}>${r}</option>`).join('')}</select></label><label>教练或作者<input name="author" maxlength="70" placeholder="可空"></label></div>
    <label>来源标题<input name="sourceTitle" maxlength="150" placeholder="可空，抓取后自动填"></label>
    <label>课程链接<input type="url" name="url" required placeholder="https://…"></label>
    <label>补充字幕或笔记（可选）<textarea name="excerpt" maxlength="120000" placeholder="默认只交链接+分类。抓取失败或要分段提炼时，再粘贴字幕/简介。SRT 时间戳会自动清理。"></textarea></label>
    <p class="input-help" id="import-status">v2：可先解析链接再多卡蒸馏（POST /api/v2/teaching/sources）。默认抓取链接并蒸馏；有长字幕时按约 2000 字分段。分类可留空，将默认归入综合。确认后才写入本机知识库。</p>
    <p class="error-box" role="alert"></p>
    <div class="actions end"><button class="secondary" type="button" id="cancel-import">取消</button><button class="primary" type="submit">开始提炼</button></div>
  </form><div id="review-box" hidden></div>`, d => {
    const form = d.querySelector('#import-form'),
      err = d.querySelector('.error-box'),
      status = d.querySelector('#import-status'),
      box = d.querySelector('#review-box');
    let cancelled = false;
    d.querySelector('#cancel-import').onclick = () => {
      cancelled = true;
      d.close();
    };
    form.onsubmit = async e => {
      e.preventDefault();
      err.textContent = '';
      if (!app.hasModel()) {
        err.textContent = '请先配置模型，再提炼。';
        return;
      }
      const vals = Object.fromEntries(new FormData(form));
      const role = String(vals.role || '').trim() || '综合';
      const url = safeLink(vals.url);
      if (!url) {
        err.textContent = '请输入 http 或 https 开头的课程链接。';
        return;
      }
      const btn = form.querySelector('[type=submit]');
      btn.disabled = true;
      const drafts = [];
      try {
        const chunks = splitTranscript(vals.excerpt || '');
        if (chunks.length > 1) {
          for (let i = 0; i < chunks.length; i++) {
            if (cancelled) return;
            status.textContent = '正在提炼第 ' + (i + 1) + ' / ' + chunks.length + ' 段…';
            try {
              const result = await api('knowledge/distill', {
                excerpt: chunks[i],
                role,
                settings: app.settings()
              });
              drafts.push({
                ...result,
                excerpt: chunks[i],
                author: vals.author.trim() || '未署名',
                role,
                sourceTitle: vals.sourceTitle.trim() || result.title,
                url,
                kind: role === '版本' ? '官方机制' : '教练笔记',
                selected: true
              });
            } catch (error) {
              drafts.push({
                failed: true,
                message: errorText(error),
                excerpt: chunks[i],
                selected: false
              });
            }
          }
        } else {
          status.textContent = '正在抓取链接并蒸馏…';
          const result = await api('knowledge/ingest-url', {
            url,
            role,
            author: vals.author.trim(),
            sourceTitle: vals.sourceTitle.trim(),
            excerpt: vals.excerpt || '',
            settings: app.settings()
          });
          drafts.push({
            ...result,
            selected: true
          });
        }
        form.hidden = true;
        box.hidden = false;
        box.innerHTML = `<p class="info-box">提炼完成。勾选要通过审核的条目，可改标题和阶段后入库。</p><div class="ingest-list">${drafts.map((item,i)=>item.failed?`<div class="ingest-item"><p class="error-box">${h(item.message)}</p><details><summary>原文片段</summary><p class="formatted">${h((item.excerpt||'').slice(0,500))}</p></details></div>`:`<div class="ingest-item" data-i="${i}"><label class="actions"><input type="checkbox" ${item.selected?'checked':''} data-pick> 入库</label>
          <label>标题<input data-k="title" value="${h(item.title||'')}"></label>
          <label>阶段<select data-k="stage">${stages.map(s=>`<option ${s===(item.stage||'团战')?'selected':''}>${s}</option>`).join('')}</select></label>
          <p class="formatted"><b>原则</b> ${h(item.principle||'')}</p>
          <p class="formatted"><b>用法</b> ${h(item.application||'')}</p>
          <p class="input-help">摘录：“${h(item.quote||'')}”</p></div>`).join('')}</div>
          <div class="actions end action-line"><button class="secondary" type="button" id="back-import">返回</button><button class="primary" type="button" id="save-import">保存选中条目</button></div>`;
        box.querySelector('#back-import').onclick = () => {
          box.hidden = true;
          form.hidden = false;
          btn.disabled = false;
          status.textContent = 'v2：可先解析链接再多卡蒸馏（POST /api/v2/teaching/sources）。默认抓取链接并蒸馏；有长字幕时按约 2000 字分段。分类可留空，将默认归入综合。确认后才写入本机知识库。';
        };
        box.querySelector('#save-import').onclick = async () => {
          const chosen = [];
          box.querySelectorAll('.ingest-item[data-i]').forEach(el => {
            const i = Number(el.dataset.i);
            const item = drafts[i];
            if (!item || item.failed || !el.querySelector('[data-pick]')?.checked) return;
            chosen.push(normalizeCardNaming({
              id: 'user-' + crypto.randomUUID(),
              title: el.querySelector('[data-k=title]').value.trim() || item.title,
              author: item.author || '未署名',
              role: item.role || '综合',
              sourceTitle: item.sourceTitle || item.title,
              url: item.url,
              kind: item.kind || ((item.role || '综合') === '版本' ? '官方机制' : '教练笔记'),
              stage: el.querySelector('[data-k=stage]').value,
              principle: item.principle,
              application: item.application,
              quote: item.quote,
              heroes: item.heroes || [],
              maps: item.maps || [],
              tags: item.tags || [],
              excerpt: item.excerpt
            }));
          });
          if (!chosen.length) {
            toast('请至少勾选一条资料');
            return;
          }
          for (const note of chosen) await put('cards', note);
          d.close();
          await app.refresh();
          toast('已入库 ' + chosen.length + ' 张教学资料');
        };
      } catch (error) {
        err.textContent = errorText(error);
        btn.disabled = false;
      }
    };
  });
}
