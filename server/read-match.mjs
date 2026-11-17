import {
  normalizeRosters
} from '../shared/domain.mjs';
import {
  validateHandoff
} from '../shared/contracts/handoff.mjs';
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
  let previous = -1;
  const frames = [];
  const seenIds = new Set();
  for (let i = 0; i < raw.length; i++) {
    const frame = raw[i];
    if (!Number.isFinite(frame?.time) || frame.time < 0 || frame.time <= previous ||
      typeof frame.image !== 'string' || frame.image.length > 800000 ||
      !/^data:image\/jpeg;base64,\/9j\/[a-zA-Z0-9+/]*={0,2}$/.test(frame.image)) {
      bad('采样画面或时间戳无效。');
    }
    previous = frame.time;
    const id = short(frame.id, 40) || 'f' + i;
    if (seenIds.has(id)) bad('采样画面 ID 重复：' + id);
    seenIds.add(id);
    frames.push({
      id,
      time: frame.time,
      image: frame.image
    });
  }
  return frames;
}

function imageParts(instructions, frames) {
  const parts = [textPart(instructions)];
  for (const f of frames) {
    parts.push(textPart('图片 ' + f.id + '，录像 ' + f.time + ' 秒'), {
      type: 'image_url',
      image_url: {
        url: f.image
      }
    });
  }
  return parts;
}

function contextHints(body = {}) {
  const bits = [];
  const ctx = body.context && typeof body.context === 'object' ? body.context : {};
  const player = short(body.player || ctx.pov || ctx.hero, 80);
  const source = short(body.source || ctx.source, 200);
  if (source) bits.push('片名/来源：' + source);
  if (player) bits.push('被复盘玩家：' + player);
  const extra = short(ctx.extra || body.extra, 800);
  if (extra) bits.push('玩家补充：' + extra);
  if (ctx.hero || ctx.map || ctx.side) bits.push('线索 ' + JSON.stringify({
    hero: short(ctx.hero, 60),
    map: short(ctx.map, 80),
    side: short(ctx.side, 20)
  }));
  return bits.join('\n');
}

function needsFramesOk(data) {
  if (!data || typeof data !== 'object') return false;
  const frames = data.needs_frames;
  if (!Array.isArray(frames) || !frames.length) return false;
  return frames.every(f => f && typeof f === 'object' &&
    typeof f.start_s === 'number' && !Number.isNaN(f.start_s) &&
    typeof f.end_s === 'number' && !Number.isNaN(f.end_s));
}

function frameIdsFromEvidence(evidence, known) {
  const errors = [];
  if (!Array.isArray(evidence)) return errors;
  for (let i = 0; i < evidence.length; i++) {
    const ev = evidence[i];
    if (!ev || typeof ev !== 'object') continue;
    const label = ev.id ? 'evidence[' + ev.id + ']' : 'evidence[' + i + ']';
    const ids = [];
    if (Array.isArray(ev.frame_ids)) ids.push(...ev.frame_ids);
    else if (typeof ev.frame_id === 'string' && ev.frame_id) ids.push(ev.frame_id);
    for (const fid of ids) {
      if (typeof fid !== 'string' || !fid) {
        errors.push(label + ': invalid frame id');
        continue;
      }
      if (!known.has(fid)) errors.push(label + ': unknown frame ' + fid);
    }
  }
  return errors;
}

export async function readMatch(body, env, fetcher) {
  const frames = prepareFrames(body.frames);
  const frameIds = new Set(frames.map(f => f.id));
  const pov = short(body.context?.hero || body.player, 60);
  const prompt = [
    '判读本段玩家录像，输出交接 JSON（相对上传起点的秒数）。',
    '字段：source、player、rounds[]、lineups[]、swaps[]、evidence[]、fights[]、playstyle[]（均可按需为空数组）。',
    'evidence 每条含 id、start_s、end_s、source_kind、detail；若引用本批画面，用 frame_ids 列出本批图片 ID。',
    'fights 含 id、round_id、start_s、end_s、ally_action、enemy_response、evidence_ids。',
    'lineups 允许镜像对局：双方可出现同名英雄；第一人称玩家必须在 allies，不得写入 enemies。',
    '看不清的关键区间可返回 needs_frames:[{start_s,end_s}]，此时其他字段尽量填写已确认部分。',
    '本批画面 ID：' + [...frameIds].join('、') + '。',
    contextHints(body)
  ].filter(Boolean).join('\n');

  const data = await askStage('read-match', body.settings, env, [{
    role: 'user',
    content: imageParts(prompt, frames)
  }], fetcher);

  if (!data || typeof data !== 'object' || Array.isArray(data)) invalid();

  if (needsFramesOk(data)) {
    return {
      source: short(data.source, 200) || '',
      player: short(data.player, 80) || '',
      rounds: Array.isArray(data.rounds) ? data.rounds : [],
      lineups: Array.isArray(data.lineups) ? data.lineups : [],
      swaps: Array.isArray(data.swaps) ? data.swaps : [],
      evidence: Array.isArray(data.evidence) ? data.evidence : [],
      fights: Array.isArray(data.fights) ? data.fights : [],
      playstyle: Array.isArray(data.playstyle) ? data.playstyle : [],
      needs_frames: data.needs_frames,
      skill: skillMeta('read-match')
    };
  }

  const handoff = {
    source: short(data.source, 200) || '',
    player: short(data.player, 80) || '',
    rounds: Array.isArray(data.rounds) ? data.rounds : [],
    lineups: Array.isArray(data.lineups) ? data.lineups : [],
    swaps: Array.isArray(data.swaps) ? data.swaps : [],
    evidence: Array.isArray(data.evidence) ? data.evidence : [],
    fights: Array.isArray(data.fights) ? data.fights : [],
    playstyle: Array.isArray(data.playstyle) ? data.playstyle : []
  };

  const validated = validateHandoff(handoff);
  if (!validated.ok) invalid();

  const frameErrors = frameIdsFromEvidence(handoff.evidence, frameIds);
  if (frameErrors.length) {
    throw new ApiError(502, frameErrors.join('；'));
  }

  for (const lineup of handoff.lineups) {
    if (!lineup || typeof lineup !== 'object') continue;
    const normalized = normalizeRosters({
      allies: lineup.allies,
      enemies: lineup.enemies,
      swaps: lineup.swaps,
      hero: lineup.player_hero || pov
    }, lineup.player_hero || pov);
    lineup.allies = normalized.allies;
    lineup.enemies = normalized.enemies;
    if (normalized.swaps?.length) lineup.swaps = normalized.swaps;
  }

  return {
    ...handoff,
    skill: skillMeta('read-match')
  };
}