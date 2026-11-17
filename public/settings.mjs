import {
  providers
} from '/shared/domain.mjs';
import {
  icon,
  escapeHTML as h,
  api,
  toast,
  errorText
} from './ui.mjs';
import {
  pageIntro
} from './dashboard.mjs';

export function settingsPage(app) {
  const profile = app.settings(),
    available = {
      ...providers
    };
  if (app.status.serverModel) available.server = {
    name: '服务端预设',
    model: app.status.serverModel
  };
  return pageIntro('模型设置', '选择支持多图输入的视觉模型。复盘时会把所选时段的采样帧发给该服务。') +
    `<div class="settings-grid"><form class="panel pad fields" id="profile-form"><h2 class="panel-title">${icon('cpu',21)} 视觉模型</h2>
  <label>服务商<select name="provider">${Object.entries(available).map(([id,p])=>`<option value="${id}" ${id===profile.provider?'selected':''}>${p.name}</option>`).join('')}</select></label>
  <label id="base-field">接口地址<input name="base" value="${h(profile.base)}" placeholder="https://api.example.com/v1" autocomplete="off" spellcheck="false" maxlength="500"></label>
  <p class="input-help" id="base-help">填写到 /v1 为止的 OpenAI 兼容地址。本机可填 http://127.0.0.1:端口/v1，其他地址必须使用 https。</p>
  <label>模型 ID<input name="model" value="${h(profile.model)}" maxlength="160" required></label>
  <label id="key-field">API Key<input name="key" type="password" placeholder="输入服务商的 API Key" autocomplete="off" spellcheck="false" maxlength="2048"></label>
  <p class="input-help" id="key-help">密钥仅在当前页面内存中使用，刷新或关闭后需重新输入。</p>
  <p id="profile-msg" class="info-box" role="status"></p>
  <div class="actions"><button class="primary" type="submit">保存配置</button><button class="secondary" type="button" id="test-model">测试视觉连接</button><button class="ghost" type="button" id="list-models">查看可用模型</button></div>
  <p class="input-help" id="model-list" hidden></p>
  </form><aside class="panel pad"><h2 class="panel-title">${icon('code',20)} 本地与 MCP</h2><p class="formatted">自托管工作台支持 OpenAI 兼容的视觉端点，也能查询本机的回放 MCP。</p>
  <details class="help-box"><summary>配置服务端模型</summary><p class="input-help">在项目的 .env 中设置以下变量，重启后选择“服务端预设”。</p><pre>OW_MODEL_BASE_URL\nOW_MODEL_ID\nOW_MODEL_API_KEY</pre></details>
  <details class="help-box"><summary>配置回放代码查询</summary><p class="input-help">启动 Overwatch AIO 的 Streamable HTTP 服务，在 .env 中设置 OW_MCP_URL。已录制的视频可按代码命名并放入 OW_CAPTURE_DIR。</p></details>
  <div class="card-tags action-line"><span class="tag">回放 MCP · ${app.status.replayMcp?'已配置':'待配置'}</span><span class="tag">录屏目录 · ${app.status.captureDirectory?'已配置':'待配置'}</span></div>${app.status.sourceDownload?'<a class="source-out action-line" href="/downloads/overwatch-guide.zip" download>下载本地版源码 ↓</a>':''}</aside></div>`;
}
export function bindSettings(app) {
  const f = document.getElementById('profile-form'),
    provider = f.elements.provider,
    model = f.elements.model,
    base = f.elements.base,
    key = f.elements.key;
  const msg = document.getElementById('profile-msg'),
    test = document.getElementById('test-model');
  const show = () => {
    const id = provider.value,
      p = app.profileFor(id),
      server = id === 'server',
      custom = id === 'custom';
    model.value = p.model;
    base.value = p.base || '';
    key.value = p.key || '';
    model.readOnly = server;
    base.readOnly = !custom;
    f.querySelector('#base-field').hidden = !custom;
    f.querySelector('#base-help').hidden = !custom;
    key.required = !server && !custom;
    base.required = custom;
    f.querySelector('#key-field').hidden = server;
    f.querySelector('#key-help').textContent = server ? '密钥由服务端环境提供。' : custom ? '留空表示该端点无需鉴权，例如本机模型服务。' : '密钥仅在当前页面内存中使用，刷新或关闭后需重新输入。';
    msg.textContent = '';
  };
  provider.onchange = show;
  show();
  const values = () => ({
    provider: provider.value,
    base: base.value.trim(),
    model: model.value.trim(),
    key: key.value.trim()
  });
  f.onsubmit = e => {
    e.preventDefault();
    if (!f.reportValidity()) return;
    const v = values();
    app.saveProfile(v, false);
    msg.textContent = '配置已保存，视频复盘将使用此模型。';
    toast('模型配置已保存');
  };
  test.onclick = async () => {
    if (!f.reportValidity()) return;
    const valuesAtStart = values();
    test.disabled = true;
    msg.textContent = '正在发送一张测试图像…';
    try {
      await api('model/test', {
        settings: valuesAtStart
      });
      app.saveProfile(valuesAtStart, true);
      msg.textContent = '视觉连接成功，配置已保存。';
    } catch (e) {
      msg.textContent = errorText(e);
    } finally {
      test.disabled = false;
    }
  };
  const list = document.getElementById('list-models'),
    listOut = document.getElementById('model-list');
  list.onclick = async () => {
    if (!f.reportValidity()) return;
    list.disabled = true;
    listOut.hidden = false;
    listOut.textContent = '正在读取服务商的模型列表…';
    try {
      const result = await api('model/catalog', {
        settings: values()
      });
      listOut.textContent = (result.listed ? '当前模型在列表中：' : '当前模型不在列表中，请从下面选一个：') + result.models.join('、');
    } catch (e) {
      listOut.textContent = errorText(e);
    } finally {
      list.disabled = false;
    }
  };
}
