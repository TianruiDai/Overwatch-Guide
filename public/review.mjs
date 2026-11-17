import {
  sampleWindows,
  selectNotes,
  selectNotesForDecision,
  knowledgePool,
  matchRoles,
  normalizeIdentity,
  normalizeRosters,
  normalizeTeamColor
} from '/shared/domain.mjs';
import {
  identityCrops,
  regionBox
} from '/shared/identify-regions.mjs';
import {
  get,
  put
} from './storage.mjs';
import {
  openVideo,
  capture
} from './media.mjs';
import {
  api,
  escapeHTML as h
} from './ui.mjs';
import {
  agentReportHTML,
  identityConfirmHTML,
  bindIdentityGate
} from './match.mjs';

async function appendAgent(match, progress, role, text, html, stage = '', count = 0, total = 0) {
  const entry = {
    role,
    text,
    html,
    at: Date.now()
  };
  match.agentLog = match.agentLog || [];
  match.agentLog.push(entry);
  await put('matches', match);
  progress?.(stage || text, count, total, {
    role,
    agentHtml: html || `<p>${h(text || '')}</p>`
  });
}

function applyExtra(context, extraPrompt) {
  if (!extraPrompt) return context;
  return {
    ...context,
    extra: extraPrompt
  };
}

function trackSkill(job, payload) {
  if (!payload?.skill) return;
  job.skillsUsed = job.skillsUsed || [];
  job.skillsUsed.push(payload.skill);
}

function teachingSources(citations) {
  if (!Array.isArray(citations)) return [];
  return [...new Set(citations.filter(c => c?.kind === 'teaching' && c.card_id).map(c => c.card_id))];
}

function waveFromFightReview(fight, events, review) {
  const verdict = [review.action, review.result].filter(Boolean).join(' — ') || review.trigger || fight.title;
  return {
    title: fight.title,
    eventIds: fight.eventIds,
    fight_id: review.fight_id || fight.title,
    trigger: review.trigger,
    action: review.action,
    result: review.result,
    keep: review.keep,
    verdict,
    positioning: {
      spot: review.keep || '',
      cover: '',
      exposedTo: review.trigger || ''
    },
    skills: (events[0]?.skills || []),
    enemyRead: review.trigger || '',
    nextTime: review.next || '',
    sources: teachingSources(review.citations),
    citations: review.citations,
    ...(review.train ? {
      train: review.train
    } : {})
  };
}

function identifyFrameIndexes(count) {
  if (count <= 0) return [];
  if (count === 1) return [0];
  return [...new Set([
    0,
    Math.floor((count - 1) * 0.25),
    Math.floor((count - 1) * 0.5),
    Math.floor((count - 1) * 0.75),
    count - 1
  ])];
}

function identityComplete(detected = {}) {
  const id = normalizeIdentity(detected);
  // Hero + map + role is enough to continue; team color is preferred but not blocking.
  return !!(id.hero && id.map && matchRoles.includes(id.role));
}

async function waitIdentityConfirm(match, detected, imported, progress, signal) {
  const html = identityConfirmHTML(detected, imported);
  const last = match.agentLog?.at(-1);
  if (last?.role !== 'identity') {
    await appendAgent(match, null, 'identity', '确认对局身份', html);
  } else {
    last.html = html;
    last.text = '确认对局身份';
    last.at = Date.now();
    await put('matches', match);
  }
  return new Promise((resolve, reject) => {
    const fail = () => reject(signal.reason || new DOMException('Aborted', 'AbortError'));
    if (signal.aborted) {
      fail();
      return;
    }
    signal.addEventListener('abort', fail, {
      once: true
    });
    progress('确认对局身份', 0, 1, {
      role: 'identity',
      agentHtml: html,
      bindIdentity: root => bindIdentityGate(root, {
        signal,
        onConfirm: identity => {
          signal.removeEventListener('abort', fail);
          resolve(identity);
        }
      })
    });
  });
}

export async function runReview(id, options, settings, cards, signal, progress) {
  const work = async lock => {
    if (!lock) throw new Error('这个对局正在另一个标签页复盘。');
    const match = await get('matches', id);
    if (!match) throw new Error('找不到这份录像。');
    if (match.report) return;
    const profile = [settings.provider, settings.model, settings.provider === 'custom' ? settings.base : ''].filter(Boolean).join('/');
    if (match.job && match.job.profile !== profile) throw new Error('继续分析需要使用原来的模型。也可重置进度后更换模型。');
    const pool = knowledgePool(cards, match);
    const job = match.job || {
      ...options,
      profile,
      notes: [],
      done: 0,
      events: [],
      sections: [],
      summarized: 0,
      waves: [],
      waved: 0
    };
    match.job = job;
    job.waves ||= [];
    job.waved ||= 0;
    job.skillsUsed = job.skillsUsed || [];
    if (options.extraPrompt) {
      match.focusExtra = options.extraPrompt;
      if (job.context) job.context = applyExtra(job.context, options.extraPrompt);
    }
    const windows = sampleWindows(job.start, job.end, job.step);
    await put('matches', match);
    const media = await get('videos', id);
    if (!media?.file) throw new Error('此设备上找不到原录像。请重新导入。');
    const reader = await openVideo(media.file);
    let identifyFramesWithIds = null;
    const noteProgress = async (stage, count, total) => {
      const line = stage + ' · ' + count + ' / ' + total + ' 已完成';
      await appendAgent(match, progress, 'status', line, `<p>${h(line)}</p>`, stage, count, total);
    };
    try {
      if (!job.context) {
        const imported = {
          ...(match.context || {})
        };
        if (!job.detected && !job.awaitingIdentity) {
          await noteProgress('辨认身份与地图', 0, 1);
          const times = windows.flat();
          const indexTimes = identifyFrameIndexes(times.length).map(pos => times[pos]);
          const plan = identityCrops(indexTimes);
          const frames = [];
          for (const item of plan) {
            signal.throwIfAborted();
            const box = regionBox(item.region);
            frames.push({
              id: item.id,
              time: item.time,
              region: item.region,
              image: await capture(reader, item.time, {
                region: box,
                cropMaxWidth: 960
              })
            });
          }
          identifyFramesWithIds = frames.map(({
            id,
            time,
            image,
            region
          }) => ({
            id,
            time,
            image,
            region
          }));
          let detected = null;
          try {
            const raw = frames.length ? await api('v2/match/identify', {
              settings,
              frames
            }, signal) : {};
            if (raw?.skill) trackSkill(job, raw);
            if (raw && !raw.error && !raw.softFail) {
              const identity = normalizeIdentity(raw);
              const roster = normalizeRosters({
                allies: raw.allies || raw.teams?.allies,
                enemies: raw.enemies || raw.teams?.enemies,
                hero: identity.hero
              }, identity.hero);
              detected = {
                ...identity,
                ...roster,
                team: normalizeTeamColor(raw.team || raw.pov?.team),
                teamKnown: raw.teamKnown === true || raw.teams?.teamKnown === true,
                evidence: raw.evidence || {},
                frameEvidence: raw.frameEvidence || {}
              };
            }
          } catch (err) {
            if (err?.name === 'AbortError') throw err;
          }
          if (!detected || (!detected.hero && !detected.map)) {
            try {
              const fullFrames = frames.filter(f => f.region === 'full').slice(0, 2);
              const fallbackFrames = (fullFrames.length ? fullFrames : frames.slice(0, 2)).map(({
                time,
                image
              }, i) => ({
                time,
                image,
                id: 'f' + i
              }));
              const rawId = fallbackFrames.length ? await api('review/identify', {
                settings,
                frames: fallbackFrames
              }, signal) : {};
              const identity = normalizeIdentity(rawId || {});
              await noteProgress('辨认双方阵容', 0, 1);
              let roster = {
                allies: detected?.allies || [],
                enemies: detected?.enemies || []
              };
              try {
                const rawRoster = fallbackFrames.length ? await api('review/roster', {
                  settings,
                  frames: fallbackFrames,
                  hero: identity.hero || '',
                  team: rawId?.team
                }, signal) : {
                  allies: [],
                  enemies: []
                };
                roster = normalizeRosters(rawRoster || {}, identity.hero);
              } catch (err) {
                if (err?.name === 'AbortError') throw err;
              }
              detected = {
                ...identity,
                ...roster,
                team: normalizeTeamColor(rawId?.team || detected?.team),
                teamKnown: normalizeTeamColor(rawId?.team) !== 'unknown',
                evidence: {
                  pov: rawId?.evidence || detected?.evidence?.pov || ''
                }
              };
            } catch (err) {
              if (err?.name === 'AbortError') throw err;
              detected = detected || {};
            }
          }
          job.detected = detected || {};
          await put('matches', match);
        }
        // Vision + read-match skill already filled identity; only ask the user when incomplete.
        let confirmed = {
          ...normalizeIdentity(job.detected || {}),
          team: normalizeTeamColor(job.detected?.team),
          teamKnown: job.detected?.teamKnown === true,
          evidence: job.detected?.evidence
        };
        let roster = normalizeRosters(job.detected || {}, confirmed.hero);
        if (identityComplete({
            ...confirmed,
            ...roster,
            team: confirmed.team,
            teamKnown: confirmed.teamKnown
          })) {
          confirmed = {
            ...confirmed,
            side: confirmed.side || '未指定',
            allies: roster.allies,
            enemies: roster.enemies,
            swaps: roster.swaps
          };
          job.awaitingIdentity = false;
        } else {
          job.awaitingIdentity = true;
          await put('matches', match);
          confirmed = await waitIdentityConfirm(match, job.detected || {}, imported, progress, signal);
          signal.throwIfAborted();
          if (!identityComplete(confirmed)) {
            throw new Error('请补全英雄、地图与职责后再开始观察。');
          }
          roster = normalizeRosters(confirmed, confirmed.hero);
          job.awaitingIdentity = false;
        }
        const team = normalizeTeamColor(confirmed.team);
        const context = applyExtra({
          ...imported,
          hero: confirmed.hero,
          map: confirmed.map,
          role: confirmed.role,
          side: confirmed.side || '未指定',
          team,
          allies: roster.allies,
          enemies: roster.enemies,
          ...(roster.swaps?.length ? {
            swaps: roster.swaps
          } : {})
        }, options.extraPrompt || match.focusExtra);
        context.knowledgeIds = match.context?.knowledgeIds || pool.map(c => c.id);
        match.context = {
          ...match.context,
          hero: confirmed.hero,
          map: confirmed.map,
          role: confirmed.role,
          side: confirmed.side || '未指定',
          team,
          allies: roster.allies,
          enemies: roster.enemies,
          ...(roster.swaps?.length ? {
            swaps: roster.swaps
          } : {})
        };
        job.context = context;
        job.notes = selectNotes(pool, context, Math.max(pool.length, 1)).map(({
          excerpt,
          ...card
        }) => card);
        await put('matches', match);
        const teamLabel = team === 'blue' ? '蓝队' : team === 'red' ? '红队' : '';
        const rosterLine = [
          confirmed.map,
          confirmed.hero,
          confirmed.role,
          teamLabel,
          confirmed.side && confirmed.side !== '未指定' ? confirmed.side : ''
        ].filter(Boolean).join(' · ');
        const teams = [
          roster.allies.length ? '我方 ' + roster.allies.join('、') : '',
          roster.enemies.length ? '敌方 ' + roster.enemies.join('、') : ''
        ].filter(Boolean).join('；');
        await appendAgent(match, progress, 'status', '身份已识别', `<p>模型已识别：${h(rosterLine)}${teams ? '。' + h(teams) : ''}。开始按知识库观察画面。</p>`, '身份已识别', 1, 1);
      }
      if (!job.matchRead && identifyFramesWithIds?.length) {
        try {
          const read = await api('v2/match/read', {
            settings,
            frames: identifyFramesWithIds,
            context: job.context,
            player: job.context?.hero
          }, signal);
          if (read && typeof read === 'object' && !read.error) {
            job.matchRead = read;
            trackSkill(job, read);
          }
        } catch (err) {
          if (err?.name === 'AbortError') throw err;
        }
        await put('matches', match);
      }
      while (job.done < windows.length) {
        signal.throwIfAborted();
        await noteProgress('观察画面', job.done, windows.length);
        const frames = [];
        for (const time of windows[job.done]) {
          signal.throwIfAborted();
          frames.push({
            time,
            image: await capture(reader, time)
          });
        }
        const output = await api('review/window', {
          context: job.context,
          notes: job.notes,
          settings,
          frames
        }, signal);
        for (const event of output.observations) {
          job.events.push({
            ...event,
            still: await capture(reader, event.time, 400)
          });
        }
        job.done++;
        await put('matches', match);
      }
    } finally {
      reader.close();
    }
    const groupSize = 72;
    while (job.summarized < job.events.length) {
      signal.throwIfAborted();
      await noteProgress('归纳团战', job.summarized, job.events.length);
      const slice = job.events.slice(job.summarized, job.summarized + groupSize);
      const events = slice.map(({
        time,
        observation,
        decision,
        category,
        skills
      }) => ({
        time,
        observation,
        decision,
        category,
        skills
      }));
      const output = await api('review/synthesize', {
        events,
        notes: job.notes,
        context: job.context,
        settings
      }, signal);
      job.sections.push({
        ...output,
        fights: output.fights.map(f => ({
          ...f,
          eventIds: f.eventIds.map(n => n + job.summarized)
        }))
      });
      job.summarized += slice.length;
      await put('matches', match);
    }
    const fights = job.sections.flatMap(section => section.fights);
    while (job.waved < fights.length) {
      signal.throwIfAborted();
      const fight = fights[job.waved];
      await noteProgress('深挖第 ' + (job.waved + 1) + ' / ' + fights.length + ' 波', job.waved, fights.length);
      const events = fight.eventIds.map(n => job.events[n]).filter(Boolean);
      if (events.length < 2) {
        job.waves[job.waved] = {
          title: fight.title,
          eventIds: fight.eventIds,
          light: true,
          verdict: events[0]?.decision || fight.title,
          positioning: {
            spot: events[0]?.observation || '',
            cover: '',
            exposedTo: ''
          },
          skills: events[0]?.skills || [],
          enemyRead: '',
          nextTime: events[0]?.decision || '',
          sources: events[0]?.sources || []
        };
      } else {
        const eventPayload = events.map(({
          time,
          title,
          observation,
          decision,
          category,
          skills
        }) => ({
          time,
          title,
          observation,
          decision,
          category,
          skills
        }));
        const notes = selectNotesForDecision(job.notes.length ? job.notes : pool, {
          hero: job.context.hero,
          map: job.context.map,
          role: job.context.role,
          action: events.map(e => e.decision).filter(Boolean).join(' '),
          threat: events.map(e => e.observation).filter(Boolean).join(' '),
          stage: events.map(e => e.category).filter(Boolean).join(' '),
          focus: [job.context.focus, fight.title].filter(Boolean).join(' ')
        }).map(({
          excerpt,
          ...card
        }) => card);
        const noteList = notes.length ? notes : job.notes;
        let wave;
        try {
          const v2 = await api('v2/review/fight', {
            settings,
            context: job.context,
            notes: noteList,
            events: eventPayload,
            fight: {
              id: fight.title,
              title: fight.title
            }
          }, signal);
          if (v2?.needs_frames?.length) {
            throw new Error('needs_frames');
          }
          trackSkill(job, v2);
          wave = waveFromFightReview(fight, events, v2);
        } catch (err) {
          if (err?.name === 'AbortError') throw err;
          const legacy = await api('review/wave', {
            context: job.context,
            notes: noteList,
            events: eventPayload,
            settings
          }, signal);
          trackSkill(job, legacy);
          wave = {
            title: fight.title,
            eventIds: fight.eventIds,
            ...legacy
          };
        }
        job.waves[job.waved] = wave;
      }
      job.waved++;
      await put('matches', match);
    }
    await noteProgress('撰写教练长文', 0, 1);
    const eventSummary = job.events.map(({
      time,
      title,
      observation,
      decision,
      category,
      skills,
      sources
    }) => ({
      time,
      title,
      observation,
      decision,
      category,
      skills,
      sources
    }));
    const fightReviews = job.waves.map(w => ({
      fight_id: w.fight_id || w.title,
      trigger: w.trigger,
      action: w.action || w.verdict,
      result: w.result,
      keep: w.keep,
      next: w.nextTime || w.next
    })).filter(r => r.fight_id);
    const handoff = job.matchRead ? {
      source: job.matchRead.source,
      player: job.matchRead.player,
      rounds: job.matchRead.rounds,
      lineups: job.matchRead.lineups,
      swaps: job.matchRead.swaps,
      evidence: job.matchRead.evidence,
      fights: job.matchRead.fights,
      playstyle: job.matchRead.playstyle
    } : undefined;
    let coach;
    try {
      coach = await api('v2/review/coach', {
        settings,
        context: job.context,
        notes: job.notes,
        handoff,
        fightReviews,
        sections: job.sections,
        waves: job.waves,
        events: eventSummary
      }, signal);
      trackSkill(job, coach);
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      coach = await api('review/coach', {
        context: job.context,
        notes: job.notes,
        sections: job.sections,
        waves: job.waves,
        events: eventSummary,
        settings
      }, signal);
      trackSkill(job, coach);
    }
    match.report = {
      profile,
      created: Date.now(),
      start: job.start,
      end: job.end,
      step: job.step,
      context: job.context,
      detected: job.detected,
      matchRead: job.matchRead,
      sections: job.sections,
      events: job.events,
      waves: job.waves,
      notes: job.notes,
      coach,
      skillsUsed: [...(job.skillsUsed || [])],
      frameCount: windows.reduce((n, w) => n + w.length, 0)
    };
    delete match.job;
    await put('matches', match);
    const html = agentReportHTML(match.report);
    await appendAgent(match, progress, 'report', coach.title || '复盘完成', html, '复盘完成', 1, 1);
    return match;
  };
  if (!navigator.locks) throw new Error('请在 HTTPS 或 localhost 中打开工作台，并使用支持 Web Locks 的浏览器。');
  return navigator.locks.request('owg-run-' + id, {
    ifAvailable: true
  }, work);
}
