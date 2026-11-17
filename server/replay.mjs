import {
  ApiError,
  short
} from './model.mjs';
import {
  safeLink
} from '../shared/domain.mjs';

async function rpcResult(response, id) {
  if (!response.ok) throw new Error('HTTP ' + response.status);
  if (!response.headers.get('content-type')?.includes('text/event-stream')) {
    const msg = await response.json();
    if (msg.id !== id || msg.error) throw new Error('MCP RPC');
    return msg.result;
  }
  const stream = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  try {
    for (;;) {
      const {
        value,
        done
      } = await stream.read();
      if (value) buffer += value;
      if (buffer.length > 2_000_000) throw new Error('MCP response too large');
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop();
      if (done && buffer.trim()) {
        blocks.push(buffer);
        buffer = '';
      }
      for (const block of blocks) {
        const payload = block.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (!payload) continue;
        const msg = JSON.parse(payload);
        if (msg.id !== id) continue;
        if (msg.error) throw new Error('MCP RPC');
        return msg.result;
      }
      if (done) throw new Error('MCP stream ended');
    }
  } finally {
    await stream.cancel().catch(() => {});
  }
}

async function queryMcp(code, env, fetcher) {
  const url = env.OW_MCP_URL;
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream'
  };
  if (env.OW_MCP_TOKEN) headers.Authorization = 'Bearer ' + env.OW_MCP_TOKEN;
  const post = payload => fetcher(url, {
    method: 'POST',
    headers: {
      ...headers
    },
    redirect: 'error',
    signal: AbortSignal.timeout(45000),
    body: JSON.stringify({
      jsonrpc: '2.0',
      ...payload
    })
  });
  try {
    const first = await post({
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: {
          name: 'overwatch-guide',
          version: '1.0.0'
        }
      }
    });
    const session = first.headers.get('mcp-session-id');
    if (session) headers['Mcp-Session-Id'] = session;
    const init = await rpcResult(first, 1);
    if (!['2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25'].includes(init?.protocolVersion)) throw new Error('MCP version');
    headers['MCP-Protocol-Version'] = init.protocolVersion;
    const ready = await post({
      method: 'notifications/initialized'
    });
    if (!ready.ok) throw new Error('MCP initialize');
    await ready.body?.cancel();
    const call = await rpcResult(await post({
      id: 2,
      method: 'tools/call',
      params: {
        name: 'ow_replay_get',
        arguments: {
          code
        }
      }
    }), 2);
    if (call?.isError) throw new Error('MCP tool');
    const payload = call.structuredContent ?? JSON.parse(call.content.find(x => x.type === 'text').text);
    if (payload.status === 'error') throw new Error('MCP lookup');
    const record = payload.data;
    if (!record) return {
      code,
      status: 'empty'
    };
    if (String(record.code).toUpperCase() !== code) throw new Error('MCP code mismatch');
    return {
      code,
      status: 'metadata',
      map: short(record.map || record.map_name, 100),
      heroes: Array.isArray(record.heroes) ? record.heroes.slice(0, 12).map(h => short(h, 50)).filter(Boolean) : [],
      verification: short(record.replay_status, 50),
      source: safeLink(record.source_url || payload.source_url),
      videoUrl: safeLink(record.video_url || record.vod_url),
      warnings: (Array.isArray(payload.warnings) ? payload.warnings : []).slice(0, 4).map(w => short(w, 180))
    };
  } finally {
    if (headers['Mcp-Session-Id']) await fetcher(url, {
      method: 'DELETE',
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(3500)
    }).then(r => r.body?.cancel()).catch(() => {});
  }
}

export async function lookupReplay(body, env, services = {}) {
  const code = short(body.code, 30).toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) throw new ApiError(400, '回放代码需要 6 位英文字母或数字。');
  if (services.captureByCode && await services.captureByCode(code)) return {
    code,
    status: 'capture',
    videoUrl: '/api/captures/' + code
  };
  if (!env.OW_MCP_URL) return {
    code,
    status: 'unconfigured'
  };
  try {
    return await queryMcp(code, env, services.fetcher || fetch);
  } catch {
    throw new ApiError(502, '回放 MCP 暂时不可用。可直接关联第一视角录像，或检查服务地址与授权。');
  }
}
