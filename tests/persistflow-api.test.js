const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server');
const { MemoryAuthorityStore, FileAuthorityStore, digestClaimSecret } = require('../persistd/src/persistflow/authority-store');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

async function withServer(store, fn) {
  const server = createServer({ store, mcpToken: 'test-owner-token', mcpTokenDigest: '', clock: () => new Date('2026-09-15T20:00:00Z') });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function post(base, path, body) {
  return fetch(`${base}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer test-owner-token' }, body: JSON.stringify(body),
  });
}
test('creates and inspects a run through the semantic API', async () => {
  const store = new MemoryAuthorityStore();
  await withServer(store, async (base) => {
    const created = await post(base, '/v1/runs', { runId: 'run-api', generation: 1, status: 'ACTIVE' });
    assert.equal(created.status, 201);
    const createdBody = await created.json();
    assert.equal(createdBody.run.runId, 'run-api');
    assert.equal(createdBody.run.generation, 1);

    const inspected = await fetch(`${base}/v1/runs/run-api`, { headers: { authorization: 'Bearer test-owner-token' } });
    assert.equal(inspected.status, 200);
    assert.equal((await inspected.json()).run.runId, 'run-api');
  });
});

test('heartbeat and checkpoint are fenced by the current generation', async () => {
  const store = new MemoryAuthorityStore();
  await withServer(store, async (base) => {
    await post(base, '/v1/runs', { runId: 'run-fence', generation: 2, status: 'ACTIVE' });
    const heartbeat = await post(base, '/v1/runs/run-fence/heartbeat', { generation: 2, progress: { task: 8 } });
    assert.equal(heartbeat.status, 200);
    const heartbeatRun = (await heartbeat.json()).run;
    assert.equal(heartbeatRun.controllerHeartbeatAt, '2026-09-15T20:00:00.000Z');
    assert.deepEqual(heartbeatRun.progress, { task: 8 });

    const stale = await post(base, '/v1/runs/run-fence/checkpoints', { generation: 1, nextSafeAction: { type: 'noop' } });
    assert.equal(stale.status, 409);
    const checkpoint = await post(base, '/v1/runs/run-fence/checkpoints', {
      generation: 2, nextSafeAction: { type: 'verify', task: 8 }, evidence: { tests: 'green' },
    });
    assert.equal(checkpoint.status, 200);
    const checkpointRun = (await checkpoint.json()).run;
    assert.equal(checkpointRun.checkpoints.length, 1);
    assert.deepEqual(checkpointRun.nextSafeAction, { type: 'verify', task: 8 });
  });
});

test('claim endpoint CAS-promotes only the prepared successor secret', async () => {
  const store = new MemoryAuthorityStore();
  await withServer(store, async (base) => {
    await post(base, '/v1/runs', {
      runId: 'run-claim', generation: 3, status: 'ACTIVE',
      successor: { generation: 4, chatId: 'chat-4', claimNonceDigest: digestClaimSecret('secret-4') },
    });
    const wrong = await post(base, '/v1/runs/run-claim/claim', {
      expectedGeneration: 3, generation: 4, claimSecret: 'wrong',
    });
    assert.equal(wrong.status, 409);

    const claimed = await post(base, '/v1/runs/run-claim/claim', {
      expectedGeneration: 3, generation: 4, claimSecret: 'secret-4',
    });
    assert.equal(claimed.status, 200);
    const run = (await claimed.json()).run;
    assert.equal(run.generation, 4);
    assert.equal(run.successor, null);
  });
});


test('all semantic run routes reject anonymous and incorrect bearer before accessing state', async () => {
  const store = new MemoryAuthorityStore();
  await withServer(store, async (base) => {
    const unauthenticated = [
      ['POST', '/v1/runs', { runId: 'unauthorized-run' }],
      ['GET', '/v1/runs/private-run'],
      ['POST', '/v1/runs/private-run/heartbeat', { generation: 1 }],
      ['POST', '/v1/runs/private-run/checkpoints', { generation: 1 }],
      ['POST', '/v1/runs/private-run/claim', { expectedGeneration: 1, generation: 2, claimSecret: 'x' }],
      ['POST', '/v1/runs/private-run/bridge/sync', { expectedGeneration: 1, generation: 2 }],
    ];
    for (const [method, path, body] of unauthenticated) {
      for (const authorization of [undefined, 'Bearer wrong-token']) {
        const response = await fetch(base + path, {
          method,
          headers: { ...(authorization ? { authorization } : {}), 'content-type': 'application/json' },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        assert.equal(response.status, 401, method + ' ' + path);
        assert.deepEqual(await response.json(), { error: 'unauthorized' });
        assert.equal(response.headers.get('cache-control'), 'no-store');
      }
    }
    assert.equal(store.get('unauthorized-run'), null);
  });
});


test('an existing file-store writer lock returns 409 and preserves run state', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-http-lock-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const store = new FileAuthorityStore(dir);
  store.create({ runId: 'busy-run', generation: 1 });
  const lockPath = store.filePath('busy-run') + '.lock';
  fs.mkdirSync(lockPath);
  await withServer(store, async (base) => {
    const response = await post(base, '/v1/runs/busy-run/checkpoints', { generation: 1, nextSafeAction: 'wait' });
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: 'authority_locked' });
  });
  assert.deepEqual(store.get('busy-run').checkpoints, undefined);
  fs.rmdirSync(lockPath);
});
