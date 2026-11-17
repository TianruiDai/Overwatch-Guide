function waitFor(el, event, action, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const clear = () => {
      clearTimeout(timer);
      el.removeEventListener(event, success);
      el.removeEventListener('error', failure);
    };
    const success = () => {
      clear();
      resolve();
    };
    const failure = () => {
      clear();
      reject(new Error('浏览器无法解码这段录像。可使用 H.264 MP4 或 VP8/VP9 WebM 重新导入。'));
    };
    const timer = setTimeout(failure, timeout);
    el.addEventListener(event, success, {
      once: true
    });
    el.addEventListener('error', failure, {
      once: true
    });
    try {
      action?.();
    } catch (e) {
      clear();
      reject(e);
    }
  });
}

export async function openVideo(file) {
  const video = document.createElement('video'),
    url = URL.createObjectURL(file);
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  const close = () => {
    video.pause();
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  };
  try {
    await waitFor(video, 'loadeddata', () => {
      video.src = url;
    });
    if (!Number.isFinite(video.duration)) {
      await waitFor(video, 'seeked', () => {
        video.currentTime = 1e9;
      });
      await waitFor(video, 'seeked', () => {
        video.currentTime = 0;
      });
    }
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('读取不到录像时长，请重新封装为 MP4。');
    return {
      video,
      duration,
      close
    };
  } catch (e) {
    close();
    throw e;
  }
}
/**
 * Capture a frame. Pass a number as 3rd arg for legacy maxWidth,
 * or `{ maxWidth, region: {x0,y0,x1,y1} }` for native-resolution crops.
 */
export async function capture(reader, time, opts = 1120) {
  const options = typeof opts === 'number' ? {
    maxWidth: opts
  } : (opts || {});
  const maxWidth = Number.isFinite(options.maxWidth) ? options.maxWidth : 1120;
  const region = options.region;
  const {
    video,
    duration
  } = reader;
  const target = Math.max(0, Math.min(time, duration - .005));
  if (Math.abs(video.currentTime - target) > .001 || video.readyState < 2)
    await waitFor(video, 'seeked', () => {
      video.currentTime = target;
    });
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', {
    alpha: false
  });
  if (region && Number.isFinite(region.x0) && Number.isFinite(region.y0) &&
    Number.isFinite(region.x1) && Number.isFinite(region.y1)) {
    const sx = Math.max(0, Math.floor(vw * Math.min(region.x0, region.x1)));
    const sy = Math.max(0, Math.floor(vh * Math.min(region.y0, region.y1)));
    const sw = Math.max(1, Math.ceil(vw * Math.abs(region.x1 - region.x0)));
    const sh = Math.max(1, Math.ceil(vh * Math.abs(region.y1 - region.y0)));
    const cropCap = Number.isFinite(options.cropMaxWidth) ? options.cropMaxWidth : 1400;
    const scale = Math.min(1, cropCap / Math.max(sw, sh));
    canvas.width = Math.max(1, Math.round(sw * scale));
    canvas.height = Math.max(1, Math.round(sh * scale));
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  }
  const scale = Math.min(1, maxWidth / Math.max(vw, vh));
  canvas.width = Math.max(1, Math.round(vw * scale));
  canvas.height = Math.max(1, Math.round(vh * scale));
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.72);
}
