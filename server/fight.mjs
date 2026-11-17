import {
  containsVague,
  stages
} from '../shared/domain.mjs';
import {
  validateFightReview
} from '../shared/contracts/fight.mjs';
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

function bad(message) {
  throw new ApiError(400, message);
}

const NOTES_CAP = 16;

function cardsOf(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, NOTES_CAP).map(c => ({
    id: short(c?.id, 80),
    title: short(c?.title, 90),
    kind: short(c?.kind, 20),
    stage: stages.includes(c?.stage) ? c.stage : '',
    principle: short(c?.principle, 600),
    application: short(c?.application, 600)
  })).filter(c => c.id);
}

function needsFramesOk(data) {
  if (!data || typeof data !== 'object') return false;
  const frames = data.needs_frames;
  if (!Array.isArray(frames) || !frames.length) return false;
  return frames.every(f => f && typeof f === 'object' &&
    typeof f.start_s === 'number' && !Number.isNaN(f.start_s) &&
    typeof f.end_s === 'number' && !Number.isNaN(f.end_s));
}

function normalizeCitation(cite) {
  if (!cite || typeof cite !== 'object') return null;
  const kind = short(cite.kind, 20);
  const out = {
    kind
  };
  const cardId = short(cite.card_id || cite.cardId, 80);
  const evidenceId = short(cite.evidence_id || cite.evidenceId, 80);
  const claimId = short(cite.claim_id || cite.claimId, 80);
  if (cardId) out.card_id = cardId;
  if (evidenceId) out.evidence_id = evidenceId;
  if (claimId) out.claim_id = claimId;
  if (Number.isFinite(cite.time)) out.time = cite.time;
  return out;
}

function teachingCitationsOk(citations, cardIds, evidenceIds) {
  const errors = [];
  if (!Array.isArray(citations)) return errors;
  for (let i = 0; i < citations.length; i++) {
    const cite = normalizeCitation(citations[i]);
    if (!cite) continue;
    const label = 'citations[' + i + ']';
    if (cite.kind === 'teaching' && cardIds.size) {
      if (!cite.card_id || !cardIds.has(cite.card_id)) {
        errors.push(label + ': teaching 引用须使用候选卡 id');
      }
    }
    if (cite.kind === 'match' && evidenceIds.size && cite.evidence_id) {
      if (!evidenceIds.has(cite.evidence_id)) {
        errors.push(label + ': unknown evidence ' + cite.evidence_id);
      }
    }
  }
  return errors;
}

function vagueHit(...parts) {
  for (const part of parts) {
    const hit = containsVague(part);
    if (hit) return hit;
  }
  return '';
}

export async function reviewFight(body, env, fetcher) {
  const fight = body.fight && typeof body.fight === 'object' ? body.fight : body.facts;
  if (!fight || typeof fight !== 'object') bad('缺少本波交战事实。');
  const cards = cardsOf(body.cards || body.notes);
  const cardIds = new Set(cards.map(c => c.id));
  const evidence = Array.isArray(body.evidence) ? body.evidence : [];
  const evidenceIds = new Set(evidence.map(e => short(e?.id, 80)).filter(Boolean));
  const fightId = short(fight.id || fight.fight_id || body.fight_id, 80);
  if (!fightId) bad('缺少 fight_id。');

  const prompt = [
    '逐波复盘一次交战中的关键决策。只依据给出的本波事实、证据与候选教学卡。',
    '输出 JSON：fight_id、trigger、action、result、keep、next、basis、citations[{kind:"match"|"teaching",evidence_id?,card_id?,claim_id?,time?}]。',
    '可选 needs_frames:[{start_s,end_s}] 请求补帧；可选 train 为一条可计数练习。',
    'teaching 引用必须来自候选卡 id；match 引用使用本波 evidence id。',
    '玩家信息 ' + JSON.stringify(body.context || {}),
    '本波事实 ' + JSON.stringify(fight),
    '本波证据 ' + JSON.stringify(evidence.slice(0, 12)),
    '候选卡 ' + JSON.stringify(cards)
  ].join('\n');

  const data = await askStage('fight', body.settings, env, [{
    role: 'user',
    content: prompt
  }], fetcher, payload => {
    const hit = vagueHit(payload?.trigger, payload?.action, payload?.result, payload?.keep, payload?.next);
    if (hit) return '文案含空泛词「' + hit + '」，请改成具体位置、技能名或时间点。';
    return '';
  });

  if (!data || typeof data !== 'object' || Array.isArray(data)) invalid();

  if (needsFramesOk(data)) {
    return {
      fight_id: short(data.fight_id || fightId, 80),
      needs_frames: data.needs_frames,
      skill: skillMeta('fight')
    };
  }

  const review = {
    fight_id: short(data.fight_id || data.id || fightId, 80),
    trigger: short(data.trigger, 400),
    action: short(data.action, 400),
    result: short(data.result, 400),
    keep: short(data.keep, 400),
    next: short(data.next, 400),
    basis: short(data.basis, 40) || 'model_inference',
    citations: (Array.isArray(data.citations) ? data.citations : []).map(normalizeCitation).filter(Boolean)
  };
  if (short(data.train, 300)) review.train = short(data.train, 300);

  const validated = validateFightReview(review);
  if (!validated.ok) invalid();

  const citeErrors = teachingCitationsOk(review.citations, cardIds, evidenceIds);
  if (citeErrors.length) {
    throw new ApiError(502, citeErrors.join('；'));
  }

  return {
    ...review,
    skill: skillMeta('fight')
  };
}