import {
  containsVague
} from '../shared/domain.mjs';
import {
  humanizeCoachText
} from '../shared/humanize-coach.mjs';
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

function vagueHit(...parts) {
  for (const part of parts) {
    const hit = containsVague(part);
    if (hit) return hit;
  }
  return '';
}

function normalizeCitation(cite) {
  if (!cite || typeof cite !== 'object') return null;
  const out = {
    kind: short(cite.kind, 20)
  };
  const cardId = short(cite.card_id || cite.cardId, 80);
  const evidenceId = short(cite.evidence_id || cite.evidenceId, 80);
  const fightId = short(cite.fight_id || cite.fightId, 80);
  if (cardId) out.card_id = cardId;
  if (evidenceId) out.evidence_id = evidenceId;
  if (fightId) out.fight_id = fightId;
  if (Number.isFinite(cite.time)) out.time = cite.time;
  return out.kind ? out : null;
}

export async function writeCoachV2(body, env, fetcher) {
  const reviews = (Array.isArray(body.fightReviews) ? body.fightReviews : Array.isArray(body.reviews) ? body.reviews : []).slice(0, 24);
  const handoff = body.handoff && typeof body.handoff === 'object' ? body.handoff : {};
  const lineups = Array.isArray(handoff.lineups) ? handoff.lineups : Array.isArray(body.lineups) ? body.lineups : [];
  if (!reviews.length && !lineups.length) {
    throw new ApiError(400, '缺少逐波复盘或阵容记录。');
  }

  const prompt = [
    '根据逐波复盘与阵容记录撰写教练报告。首段必须先说明这局应该怎么打（阵容、目标与基本思路）。',
    '返回 JSON：title、sections[{heading,body,decisionIds?}]（至少 2 段）、closing、citations[{kind, fight_id?, evidence_id?, card_id?, time?}]。',
    '玩家信息 ' + JSON.stringify(body.context || {}),
    '阵容 ' + JSON.stringify(lineups.slice(0, 8)),
    '逐波复盘 ' + JSON.stringify(reviews)
  ].join('\n');

  const data = await askStage('coach', body.settings, env, [{
    role: 'user',
    content: prompt
  }], fetcher, payload => {
    if (!short(payload?.title) || !Array.isArray(payload?.sections) || payload.sections.length < 2) {
      return '缺少 title 或 sections（至少 2 段）。';
    }
    const first = short(payload.sections[0]?.heading, 120);
    if (first && !first.includes('应该怎么打')) {
      return 'sections[0] 必须先明确这局应该怎么打。';
    }
    for (const s of payload.sections.slice(0, 12)) {
      if (!short(s?.heading) || !short(s?.body)) return '章节缺少 heading 或 body。';
      const hit = vagueHit(s.heading, s.body);
      if (hit) return '文案含空泛词「' + hit + '」。';
    }
    return '';
  });

  if (!data || typeof data !== 'object' || Array.isArray(data)) invalid();
  if (!short(data.title) || !Array.isArray(data.sections) || data.sections.length < 2) invalid();

  const firstHeading = short(data.sections[0]?.heading, 120);
  if (firstHeading && !firstHeading.includes('应该怎么打')) invalid();

  return {
    title: humanizeCoachText(short(data.title, 100)),
    sections: data.sections.slice(0, 12).map(s => ({
      heading: humanizeCoachText(short(s.heading, 120)),
      body: humanizeCoachText(short(s.body, 4000)),
      ...(Array.isArray(s.decisionIds) && s.decisionIds.length ? {
        decisionIds: s.decisionIds.slice(0, 24).map(id => short(id, 80)).filter(Boolean)
      } : {})
    })),
    closing: humanizeCoachText(short(data.closing, 500)),
    citations: (Array.isArray(data.citations) ? data.citations : []).map(normalizeCitation).filter(Boolean),
    skill: skillMeta('coach')
  };
}