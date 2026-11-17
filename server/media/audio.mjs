import {
  spawn
} from 'node:child_process';
import {
  createReadStream
} from 'node:fs';
import {
  ApiError
} from '../model.mjs';

function ffmpegAvailable() {
  return new Promise(resolve => {
    const proc = spawn('ffmpeg', ['-version'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let seen = false;
    const mark = () => {
      seen = true;
    };
    proc.stdout?.on('data', mark);
    proc.stderr?.on('data', mark);
    proc.on('error', () => resolve(false));
    proc.on('close', code => resolve(code === 0 || seen));
  });
}

export async function probeAudioCapability() {
  const ffmpeg = await ffmpegAvailable();
  return {
    ffmpeg,
    transcription: ffmpeg
  };
}

export async function transcribeAudio(filePath, settings, fetcher = fetch) {
  const {
    ffmpeg
  } = await probeAudioCapability();
  if (!ffmpeg) {
    throw new ApiError(501, '本机未检测到 ffmpeg，无法处理音频。请安装 ffmpeg 或配置 OW_MEDIA_SERVICE_URL。');
  }
  if (!settings?.base) {
    throw new ApiError(400, '转写需要配置模型 base URL。');
  }
  const model = settings.transcriptionModel || settings.model || 'whisper-1';
  const base = String(settings.base).replace(/\/$/, '');
  const url = /\/audio\/transcriptions\/?$/.test(base) ? base : base + '/audio/transcriptions';
  const headers = {};
  if (settings.apiKey) headers.Authorization = 'Bearer ' + settings.apiKey;
  const form = new FormData();
  form.append('file', createReadStream(filePath), 'audio');
  form.append('model', model);
  const response = await fetcher(url, {
    method: 'POST',
    headers,
    body: form,
    duplex: 'half'
  }).catch(() => {
    throw new ApiError(502, '无法连接转写服务。请检查端点与网络。');
  });
  if (!response.ok) {
    throw new ApiError(502, '转写服务返回 HTTP ' + response.status + '。');
  }
  const data = await response.json().catch(() => ({}));
  return typeof data.text === 'string' ? data.text : '';
}