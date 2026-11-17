import {
  sampleWindows,
  selectNotes
} from '/shared/domain.mjs';
import {
  get,
  put
} from './storage.mjs';
import {
  openVideo,
  capture
} from './media.mjs';
import {
  api
} from './ui.mjs';

export async function runReview(id, options, settings, cards, signal, progress) {
  const work = async lock => {
    if (!lock) throw new Error('这个对局正在另一个标签页复盘。');
    const match = await get('matches', id);
    if (!match) throw new Error('找不到这份录像。');
    if (match.report) return;
    const profile = [settings.provider, settings.model, settings.provider === 'custom' ? settings.base : ''].filter(Boolean).join('/');
    if (match.job && match.job.profile !== profile) throw new Error('继续分析需要使用原来的模型。也可重置进度后更换模型。');
    const job = match.job || {
      ...options,
      profile,
      notes: [],
      done: 0,
      events: [],
      sections: [],
      summarized: 0
    };
    match.job = job;
    const windows = sampleWindows(job.start, job.end, job.step);
    await put('matches', match);
    const media = await get('videos', id);
    if (!media?.file) throw new Error('此设备上找不到原录像。请重新导入。');
    const reader = await openVideo(media.file);
    try {
      if (!job.context) {
        const context = {
          ...match.context
        };
        let detected = {};
        if (!context.hero || !context.map || context.role === '通用') {
          progress('辨认英雄和地图', 0, 1, match);
          const times = windows.flat();
          const positions = [...new Set([0, Math.floor(times.length / 2), times.length - 1])];
          const frames = [];
          for (const pos of positions) {
            signal.throwIfAborted();
            frames.push({
              time: times[pos],
              image: await capture(reader, times[pos])
            });
          }
          detected = await api('review/identify', {
            settings,
            frames
          }, signal);
          if (!context.hero) context.hero = detected.hero || '';
          if (!context.map) context.map = detected.map || '';
          if (context.role === '通用' && (!match.context.hero || !detected.hero || detected.hero === match.context.hero)) context.role = detected.role || '通用';
        }
        job.context = context;
        job.detected = detected;
        job.notes = selectNotes(cards, context).map(({
          excerpt,
          ...card
        }) => card);
        await put('matches', match);
      }
      while (job.done < windows.length) {
        signal.throwIfAborted();
        progress('观察画面', job.done, windows.length, match);
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
      progress('归纳团战', job.summarized, job.events.length, match);
      const slice = job.events.slice(job.summarized, job.summarized + groupSize);
      const events = slice.map(({
        time,
        observation,
        decision
      }) => ({
        time,
        observation,
        decision
      }));
      const output = await api('review/synthesize', {
        events,
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
    match.report = {
      profile,
      created: Date.now(),
      start: job.start,
      end: job.end,
      step: job.step,
      context: job.context,
      detected: job.detected,
      sections: job.sections,
      events: job.events,
      notes: job.notes,
      frameCount: windows.reduce((n, w) => n + w.length, 0)
    };
    delete match.job;
    await put('matches', match);
    return match;
  };
  if (!navigator.locks) throw new Error('请在 HTTPS 或 localhost 中打开工作台，并使用支持 Web Locks 的浏览器。');
  return navigator.locks.request('owg-run-' + id, {
    ifAvailable: true
  }, work);
}
