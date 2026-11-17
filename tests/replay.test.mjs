import test from 'node:test';
import assert from 'node:assert/strict';
import {
  handleApi
} from '../server/api.mjs';

const query = code => new Request('https://test.invalid/api/replay', {
  method: 'POST',
  headers: {
    'content-type': 'application/json'
  },
  body: JSON.stringify({
    code
  })
});
test('an unconfigured code opens the recording handoff without fabricating a match', async () => {
  const res = await handleApi(query(' abC123 '));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    code: 'ABC123',
    status: 'unconfigured'
  });
});
