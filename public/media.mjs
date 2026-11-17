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
export async function capture(reader, time, maxWidth = 1120) {
  const {
    video,
    duration
  } = reader;
  const target = Math.max(0, Math.min(time, duration - .005));
  if (Math.abs(video.currentTime - target) > .001 || video.readyState < 2)
    await waitFor(video, 'seeked', () => {
      video.currentTime = target;
    });
  const scale = Math.min(1, maxWidth / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  canvas.getContext('2d', {
    alpha: false
  }).drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.72);
}
