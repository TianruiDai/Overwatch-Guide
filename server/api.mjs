import {
  ApiError,
  identifyMatch,
  reviewWindow,
  synthesize,
  distill,
  testProfile
} from './model.mjs';

import {
  lookupReplay
} from './replay.mjs';

const routes = new Map([
  ['/api/review/identify', identifyMatch],
  ['/api/review/window', reviewWindow],
  ['/api/review/synthesize', synthesize],
  ['/api/knowledge/distill', distill],
  ['/api/model/test', testProfile]
]);

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
async function readJson(request) {
  const limit = 7 * 1024 * 1024;
  if (Number(request.headers.get('content-length')) > limit) throw new ApiError(413, '采样包过大。');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, '缺少请求内容。');
  const chunks = [];
  let total = 0;
  for (;;) {
    const {
      value,
      done
    } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel();
      throw new ApiError(413, '采样包过大。');
    }
    chunks.push(value);
  }
  const data = await new Response(new Blob(chunks)).json().catch(() => {
    throw new ApiError(400, 'JSON 格式无效。');
  });
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ApiError(400, '请求格式无效。');
  return data;
}

export async function handleApi(request, env = {}, services = {}) {
  try {
    const url = new URL(request.url);
    if (url.pathname === '/api/status' && request.method === 'GET')
      return json({
        serverModel: env.OW_MODEL_BASE_URL && env.OW_MODEL_ID ? env.OW_MODEL_ID : null,
        replayMcp: !!env.OW_MCP_URL,
        sourceDownload: !!services.sourceDownload,
        captureDirectory: !!services.captureByCode
      });
    if (request.method !== 'POST') return json({
      error: '此接口需要 POST 请求。'
    }, 405);
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) return json({
      error: '请求来源与工作台不匹配。'
    }, 403);
    if (!request.headers.get('content-type')?.includes('application/json')) return json({
      error: '需要 JSON 请求。'
    }, 415);
    if (url.pathname === '/api/replay') return json(await lookupReplay(await readJson(request), env, services));
    const action = routes.get(url.pathname);
    if (!action) return json({
      error: '接口不存在。'
    }, 404);
    const result = await action(await readJson(request), env, services.fetcher || fetch);
    return json(result);
  } catch (error) {
    return json({
      error: error instanceof ApiError ? error.message : '复盘服务暂时无法处理这次请求。'
    }, error instanceof ApiError ? error.status : 500);
  }
}
