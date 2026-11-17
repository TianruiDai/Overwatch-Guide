import {
  createServer
} from 'node:http';
import {
  createReadStream
} from 'node:fs';
import {
  stat,
  readFile
} from 'node:fs/promises';
import {
  fileURLToPath
} from 'node:url';
import path from 'node:path';
import {
  Readable
} from 'node:stream';
import {
  handleApi
} from './api.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.svg': 'image/svg+xml'
};
const captureDir = process.env.OW_CAPTURE_DIR;
async function captureByCode(code) {
  if (!captureDir || !/^[A-Z0-9]{6}$/.test(code)) return null;
  for (const name of new Set([code, code.toLowerCase()]))
    for (const extension of ['.mp4', '.webm', '.mov']) {
      const file = path.resolve(captureDir, name + extension);
      if ((await stat(file).catch(() => null))?.isFile()) return file;
    }
  return null;
}
async function serveCapture(code, req, res) {
  const file = await captureByCode(code);
  if (!file) {
    res.writeHead(404).end();
    return;
  }
  const {
    size
  } = await stat(file);
  const headers = {
    'Content-Type': types[path.extname(file)],
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store'
  };
  const range = req.headers.range;
  let start = 0,
    end = size - 1;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (m && m[1]) {
      start = Number(m[1]);
      end = m[2] ? Math.min(Number(m[2]), end) : end;
    } else if (m?.[2]) start = Math.max(0, size - Number(m[2]));
    if (!m || (!m[1] && !m[2]) || start > end || start >= size) {
      res.writeHead(416, {
        'Content-Range': 'bytes */' + size
      }).end();
      return;
    }
    headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + size;
  }
  res.writeHead(range ? 206 : 200, {
    ...headers,
    'Content-Length': end - start + 1
  });
  if (req.method === 'HEAD' || !size) {
    res.end();
    return;
  }
  const stream = createReadStream(file, {
    start,
    end
  });
  res.on('close', () => stream.destroy());
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}

const previewPort = process.argv.indexOf('--port');
const port = Number(process.env.PORT || (previewPort >= 0 ? process.argv[previewPort + 1] : 8787));
const previewHost = process.argv.indexOf('--host');
const host = process.env.HOST || (previewHost >= 0 ? process.argv[previewHost + 1] : '127.0.0.1');
const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
const drain = req => {
  if (!req.readableEnded && !req.destroyed) req.resume();
};
const server = createServer(async (req, res) => {
  req.on('error', () => {});
  res.on('error', () => {});
  try {
    const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
    if (host === '127.0.0.1' && !localHosts.has(url.hostname)) {
      drain(req);
      res.writeHead(403).end();
      return;
    }
    const capture = /^\/api\/captures\/([A-Z0-9]{6})$/.exec(url.pathname);
    if (capture && ['GET', 'HEAD'].includes(req.method)) return await serveCapture(capture[1], req, res);
    if (url.pathname.startsWith('/api/')) {
      const request = new Request(url, {
        method: req.method,
        headers: req.headers,
        ...(req.method === 'GET' || req.method === 'HEAD' ? {} : {
          body: Readable.toWeb(req),
          duplex: 'half'
        })
      });
      const result = await handleApi(request, process.env, {
        captureByCode: captureDir ? captureByCode : undefined,
        ffmpeg: true
      });
      res.writeHead(result.status, Object.fromEntries(result.headers));
      res.end(Buffer.from(await result.arrayBuffer()));
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      drain(req);
      res.writeHead(405).end();
      return;
    }
    let name = decodeURIComponent(url.pathname);
    if (name === '/') name = '/index.html';
    const shared = name.startsWith('/shared/');
    const base = path.join(root, shared ? 'shared' : 'public');
    const local = path.resolve(base, '.' + (shared ? name.slice(7) : name));
    if (!local.startsWith(base + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    const data = await readFile(local).catch(() => null);
    if (!data) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      'Content-Type': types[path.extname(local)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    drain(req);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
});
server.on('clientError', (error, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  else socket.destroy();
});
server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.error('端口 ' + port + ' 已被占用。多半是上一个 npm start 还在运行：回到那个终端按 Ctrl+C 停掉它，再重新启动。');
    console.error('想同时开第二个实例，就换个端口：PowerShell 用 $env:PORT=8790; npm start，cmd 用 set PORT=8790 && npm start，bash 用 PORT=8790 npm start。');
  } else {
    console.error('本地服务启动失败：' + error.message);
  }
  process.exitCode = 1;
});
server.listen(port, host, () => console.log('Overwatch Guide listening on http://' + host + ':' + server.address().port));
