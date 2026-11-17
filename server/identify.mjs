import {
  heroes,
  heroRoles,
  maps,
  matchListedName,
  matchRoles,
  normalizeIdentity,
  normalizeRosters,
  normalizeSide,
  normalizeTeamColor
} from '../shared/domain.mjs';
import {
  IDENTIFY_REGIONS
} from '../shared/identify-regions.mjs';
import {
  ApiError,
  askStage,
  short
} from './model.mjs';
import {
  skillMeta
} from './skills.mjs';

const invalid = () => {
  throw new ApiError(502, '模型没有返回约定的 JSON。已完成的片段会保留，可重试当前步骤。');
};

const textPart = text => ({
  type: 'text',
  text
});

function bad(message) {
  throw new ApiError(400, message);
}

function prepareFrames(raw) {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 8) bad('每次分析需要 1–8 张采样画面。');
  const frames = [];
  const seen = new Set();
  for (let i = 0; i < raw.length; i++) {
    const frame = raw[i];
    if (!Number.isFinite(frame?.time) || frame.time < 0 ||
      typeof frame.image !== 'string' || frame.image.length > 1200000 ||
      !/^data:image\/jpeg;base64,\/9j\/[a-zA-Z0-9+/]*={0,2}$/.test(frame.image)) {
      bad('采样画面或时间戳无效。');
    }
    const id = short(frame.id, 40) || 'f' + i;
    if (seen.has(id)) bad('采样画面 ID 重复：' + id);
    seen.add(id);
    const region = short(frame.region, 20) || 'full';
    if (!IDENTIFY_REGIONS[region]) bad('未知裁剪区域：' + region);
    frames.push({
      id,
      time: frame.time,
      region,
      image: frame.image
    });
  }
  return frames;
}

function imageParts(instructions, frames) {
  const parts = [textPart(instructions)];
  for (const f of frames) {
    parts.push(textPart('图片 ' + f.id + '，区域 ' + f.region + '，录像 ' + f.time + ' 秒'), {
      type: 'image_url',
      image_url: {
        url: f.image
      }
    });
  }
  return parts;
}

function needsFramesOk(data) {
  if (!Array.isArray(data?.needs_frames) || !data.needs_frames.length) return false;
  return data.needs_frames.every(f => f && typeof f === 'object' &&
    typeof f.start_s === 'number' && !Number.isNaN(f.start_s) &&
    typeof f.end_s === 'number' && !Number.isNaN(f.end_s));
}

function cleanHeroRow(list) {
  const seen = new Set();
  const out = [];
  for (const name of Array.isArray(list) ? list : []) {
    const h = matchListedName(name, heroes);
    if (!h || seen.has(h)) continue;
    seen.add(h);
    out.push(h);
    if (out.length >= 5) break;
  }
  return out;
}

function pickRow(team, blue, red, alliesGuess, enemiesGuess, pov) {
  const blueClean = cleanHeroRow(blue);
  const redClean = cleanHeroRow(red);
  if (team === 'blue') return {
    allies: blueClean,
    enemies: redClean,
    teamKnown: true
  };
  if (team === 'red') return {
    allies: redClean,
    enemies: blueClean,
    teamKnown: true
  };
  if (pov && blueClean.includes(pov)) return {
    allies: blueClean,
    enemies: redClean,
    teamKnown: false
  };
  if (pov && redClean.includes(pov)) return {
    allies: redClean,
    enemies: blueClean,
    teamKnown: false
  };
  return {
    allies: cleanHeroRow(alliesGuess),
    enemies: cleanHeroRow(enemiesGuess),
    teamKnown: false
  };
}

export function finalizeIdentity(raw = {}) {
  const povHero = matchListedName(raw.pov?.hero || raw.hero, heroes);
  const team = normalizeTeamColor(raw.pov?.team || raw.team);
  const role = povHero && heroRoles[povHero] ? heroRoles[povHero] :
    (matchRoles.includes(raw.pov?.role) ? raw.pov.role : '');
  const mapName = matchListedName(raw.map?.name || raw.map, maps);
  const side = normalizeSide(raw.side);
  const rows = pickRow(
    team,
    raw.teams?.blue || raw.blue,
    raw.teams?.red || raw.red,
    raw.teams?.allies || raw.allies,
    raw.teams?.enemies || raw.enemies,
    povHero
  );
  const roster = normalizeRosters({
    allies: rows.allies,
    enemies: rows.enemies,
    hero: povHero
  }, povHero);
  const identity = normalizeIdentity({
    hero: povHero,
    map: mapName,
    role,
    side,
    time: Number.isFinite(raw.time) ? raw.time : undefined
  });
  return {
    ...identity,
    team,
    allies: roster.allies,
    enemies: roster.enemies,
    ...(roster.swaps?.length ? {
      swaps: roster.swaps
    } : {}),
    teamKnown: rows.teamKnown && team !== 'unknown',
    evidence: {
      pov: short(raw.pov?.evidence || raw.evidence?.pov, 240),
      team: short(raw.pov?.teamEvidence || raw.evidence?.team, 240),
      bars: short(raw.teams?.evidence || raw.evidence?.bars, 240),
      map: short(raw.map?.evidence || raw.evidence?.map, 240)
    },
    frameEvidence: raw.frameEvidence && typeof raw.frameEvidence === 'object' ? raw.frameEvidence : {},
    confidence: {
      pov: short(raw.pov?.confidence, 20) || '',
      map: short(raw.map?.confidence, 20) || ''
    }
  };
}

function normalizeModelPayload(data = {}) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  // Accept both nested and flat model shapes.
  const pov = data.pov && typeof data.pov === 'object' ? data.pov : {
    hero: data.hero,
    team: data.team,
    role: data.role,
    confidence: data.confidence,
    evidence: data.evidence
  };
  const map = data.map && typeof data.map === 'object' ? data.map : {
    name: typeof data.map === 'string' ? data.map : data.mapName,
    confidence: data.mapConfidence,
    evidence: data.mapEvidence
  };
  const teams = data.teams && typeof data.teams === 'object' ? data.teams : {
    blue: data.blue,
    red: data.red,
    allies: data.allies,
    enemies: data.enemies,
    evidence: data.barsEvidence
  };
  return {
    ...data,
    pov,
    map,
    teams
  };
}

export async function identifyMatchV2(body, env, fetcher) {
  const frames = prepareFrames(body.frames);
  const byRegion = frames.map(f => f.id + '=' + f.region).join('、');
  const prompt = [
    '按固定顺序辨认本局身份与地图。读不清就留空，不要猜测，不要解释。',
    '1) 只有第一视角可作玩家英雄来源。',
    '2) 玩家英雄只读 weapon/abilities（武器与技能图标），禁止用英雄条反推。',
    '3) 队伍色只读 hud 左下角，team=blue|red|unknown。本人颜色=我方。',
    '4) 阵容只读 bars，给出 blue[] 与 red[]，每边最多 5 人。',
    '5) 地图/攻防读 full。',
    '易混：西拉≠索杰恩；D.Va≠D.Mon；巴蒂斯特≠雾子；卢西奥≠朱诺；卡西迪≠艾什；黑百合≠半藏。',
    '只输出一个 JSON 对象：{"pov":{"hero":"","team":"blue|red|unknown","role":"","evidence":""},"teams":{"blue":[],"red":[],"evidence":""},"map":{"name":"","evidence":""},"side":"","needs_frames":[]}',
    '本批画面：' + byRegion
  ].join('\n');

  let data = {};
  try {
    data = await askStage('read-match', body.settings, env, [{
      role: 'user',
      content: imageParts(prompt, frames)
    }], fetcher, payload => {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return '请返回 JSON 对象。';
      return '';
    });
  } catch (err) {
    // Soft-fail: let the client keep a confirm form instead of hard-stopping the run.
    if (err instanceof ApiError && err.status === 502) {
      const empty = finalizeIdentity({});
      return {
        ...empty,
        map: '',
        softFail: true,
        error: short(err.message, 240),
        teams: {
          allies: [],
          enemies: [],
          teamKnown: false,
          source: 'bars',
          evidence: ''
        },
        mapDetail: {
          name: '',
          confidence: '',
          evidence: ''
        },
        side: '未指定',
        frameEvidence: {},
        needs_frames: [],
        skill: skillMeta('read-match')
      };
    }
    throw err;
  }

  data = normalizeModelPayload(data);
  if (!data || typeof data !== 'object' || Array.isArray(data)) invalid();

  if (needsFramesOk(data) && !data.pov?.hero && !data.map?.name) {
    return {
      needs_frames: data.needs_frames,
      skill: skillMeta('read-match')
    };
  }

  const finalized = finalizeIdentity(data);
  return {
    ...finalized,
    map: finalized.map || '',
    pov: {
      hero: finalized.hero || '',
      team: finalized.team,
      role: finalized.role || '',
      confidence: finalized.confidence.pov,
      evidence: finalized.evidence.pov || ''
    },
    teams: {
      allies: finalized.allies,
      enemies: finalized.enemies,
      blue: Array.isArray(data.teams?.blue) ? data.teams.blue : undefined,
      red: Array.isArray(data.teams?.red) ? data.teams.red : undefined,
      teamKnown: finalized.teamKnown,
      source: 'bars',
      evidence: finalized.evidence.bars || ''
    },
    mapDetail: {
      name: finalized.map || '',
      confidence: finalized.confidence.map,
      evidence: finalized.evidence.map || ''
    },
    side: finalized.side || '未指定',
    frameEvidence: finalized.frameEvidence,
    needs_frames: Array.isArray(data.needs_frames) ? data.needs_frames : [],
    skill: skillMeta('read-match')
  };
}
