import {
  ApiError,
  identifyMatch,
  identifyRosters,
  reviewWindow,
  synthesize,
  reviewWave,
  distill,
  ingestUrl,
  writeCoachReview,
  testProfile,
  catalog
} from './model.mjs';

import {
  lookupReplay
} from './replay.mjs';
import {
  createTeachingSource,
  getTeachingSource,
  distillUnits,
  versionCheck
} from './teaching.mjs';
import {
  readMatch
} from './read-match.mjs';
import {
  identifyMatchV2
} from './identify.mjs';
import {
  reviewFight
} from './fight.mjs';
import {
  writeCoachV2
} from './coach.mjs';

const v2PostRoutes = new Map([
  ['/api/v2/teaching/sources', createTeachingSource],
  ['/api/v2/knowledge/distill', distillUnits],
  ['/api/v2/knowledge/version-check', versionCheck],
  ['/api/v2/match/identify', identifyMatchV2],
  ['/api/v2/match/read', readMatch],
  ['/api/v2/review/fight', reviewFight],
  ['/api/v2/review/coach', writeCoachV2]
]);

const routes = new Map([
  ['/api/review/identify', identifyMatch],
  ['/api/review/roster', identifyRosters],
  ['/api/review/window', reviewWindow],
  ['/api/review/synthesize', synthesize],
  ['/api/review/wave', reviewWave],
  ['/api/review/coach', writeCoachReview],
  ['/api/knowledge/distill', distill],
  ['/api/knowledge/ingest-url', ingestUrl],
  ['/api/model/test', testProfile],
  ['/api/model/catalog', catalog]
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
  const drainCap = 64 * 1024 * 1024;
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, '缺少请求内容。');
  const chunks = [];
  let total = 0,
    oversized = false;
  for (;;) {
    const {
      value,
      done
    } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) oversized = true;
    if (!oversized) chunks.push(value);
    else if (total > drainCap) {
      await reader.cancel().catch(() => {});
      break;
    }
  }
  if (oversized) throw new ApiError(413, '采样包过大。');
  const data = await new Response(new Blob(chunks)).json().catch(() => {
    throw new ApiError(400, 'JSON 格式无效。');
  });
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ApiError(400, '请求格式无效。');
  return data;
}

export async function handleApi(request, env = {}, services = {}) {
  try {
    const url = new URL(request.url);
    if (url.pathname === '/api/status' && request.method === 'GET') {
      const {
        CONTRACT_VERSION
      } = await import('../shared/skills-manifest.mjs');
      // Worker cannot probe ffmpeg; Node may set OW_FFMPEG=1 or OW_MEDIA_SERVICE_URL.
      const audio = Boolean(env.OW_MEDIA_SERVICE_URL) || env.OW_FFMPEG === '1' || env.OW_FFMPEG === 'true' ||
        (typeof process !== 'undefined' && process.versions?.node && services.ffmpeg !== false);
      return json({
        serverModel: env.OW_MODEL_BASE_URL && env.OW_MODEL_ID ? env.OW_MODEL_ID : null,
        replayMcp: !!env.OW_MCP_URL,
        sourceDownload: !!services.sourceDownload,
        captureDirectory: !!services.captureByCode,
        captions: true,
        audio,
        vision: true,
        skills: true,
        contractVersion: CONTRACT_VERSION
      });
    }
    const teachingSourceMatch = url.pathname.match(/^\/api\/v2\/teaching\/sources\/([^/]+)$/);
    if (teachingSourceMatch && request.method === 'GET') {
      return json(getTeachingSource(teachingSourceMatch[1]));
    }
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
    const v2Action = v2PostRoutes.get(url.pathname);
    if (v2Action) return json(await v2Action(await readJson(request), env, services.fetcher || fetch));
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
