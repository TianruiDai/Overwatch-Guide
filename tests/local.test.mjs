import test from 'node:test';
import assert from 'node:assert/strict';
import {
  spawn
} from 'node:child_process';
import {
  once
} from 'node:events';
import {
  mkdtemp,
  writeFile,
  rm
} from 'node:fs/promises';
import path from 'node:path';
import {
  tmpdir
} from 'node:os';
import {
  fileURLToPath
} from 'node:url';

test('the local entry point serves the workspace and a range-readable recording linked to a replay code', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'owg-test-'));
  const recording = Buffer.from('fixture-recording');
  await writeFile(path.join(dir, 'ABC123.mp4'), recording);
  const proc = spawn(process.execPath, [fileURLToPath(new URL('../server/local.mjs', import.meta.url))], {
    env: {
      ...process.env,
      PORT: '0',
      HOST: '127.0.0.1',
      OW_CAPTURE_DIR: dir,
      OW_MCP_URL: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const stop = once(proc, 'exit');
  try {
    const ready = await Promise.race([once(proc.stdout, 'data').then(([bytes]) => bytes.toString()), stop.then(() => {
      throw Error('server failed to start');
    })]);
    const base = ready.match(/http:\/\/127\.0\.0\.1:\d+/)[0];
    assert.equal((await fetch(base)).status, 200);
    const status = await (await fetch(base + '/api/status')).json();
    assert.equal(status.captureDirectory, true);
    const request = await fetch(base + '/api/replay', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code: 'abc123'
      })
    });
    const replay = await request.json();
    assert.equal(replay.status, 'capture');
    assert.equal(replay.code, 'ABC123');
    const slice = await fetch(base + replay.videoUrl, {
      headers: {
        Range: 'bytes=2-5'
      }
    });
    assert.equal(slice.status, 206);
    assert.equal(slice.headers.get('Content-Range'), 'bytes 2-5/17');
    assert.equal(await slice.text(), 'xtur');
    assert.equal((await fetch(base + replay.videoUrl, {
      headers: {
        Range: 'bytes=100-'
      }
    })).status, 416);
    assert.equal((await fetch(base + '/.env')).status, 404);
  } finally {
    proc.kill();
    await stop;
    await rm(dir, {
      recursive: true,
      force: true
    });
  }
});
