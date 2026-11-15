const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { FileAuthorityStore, digestClaimSecret } = require('./src/persistflow/authority-store');

function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-lock-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('create, update and claim fail closed while another writer holds the run lock', (t) => {
  const dir = tempDir(t);
  const store = new FileAuthorityStore(dir);
  store.create({ runId: 'locked', generation: 1, successor: {
    generation: 2, claimNonceDigest: digestClaimSecret('handoff'),
  } });
  const lockPath = store.filePath('locked') + '.lock';
  fs.mkdirSync(lockPath);
  assert.throws(() => store.create({ runId: 'locked' }), /AUTHORITY_LOCKED/);
  assert.throws(() => store.update('locked', state => ({ ...state, progress: 'invalid' })), /AUTHORITY_LOCKED/);
  assert.throws(() => store.claimSuccessor({ runId: 'locked', expectedGeneration: 1, generation: 2, claimSecret: 'handoff' }), /AUTHORITY_LOCKED/);
  assert.equal(store.get('locked').generation, 1);
  fs.rmdirSync(lockPath);
  assert.equal(store.claimSuccessor({ runId: 'locked', expectedGeneration: 1, generation: 2, claimSecret: 'handoff' }).generation, 2);
  assert.equal(fs.existsSync(lockPath), false);
});

test('competing OS processes cannot both promote the same successor', async (t) => {
  const dir = tempDir(t);
  const store = new FileAuthorityStore(dir);
  store.create({ runId: 'race', generation: 1, successor: {
    generation: 2, claimNonceDigest: digestClaimSecret('handoff'),
  } });
  const gate = path.join(dir, 'release-workers');
  const worker = `
    const fs = require('node:fs');
    const { FileAuthorityStore } = require(process.argv[1]);
    const store = new FileAuthorityStore(process.argv[2]);
    const gate = process.argv[3];
    const poll = setInterval(() => {
      if (!fs.existsSync(gate)) return;
      clearInterval(poll);
      try {
        store.claimSuccessor({ runId: 'race', expectedGeneration: 1, generation: 2, claimSecret: 'handoff' });
        process.stdout.write('CLAIMED');
      } catch (error) {
        process.stdout.write(error.message);
      }
    }, 5);
  `;
  const run = () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', worker, path.join(__dirname, 'src/persistflow/authority-store.js'), dir, gate], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(stdout) : reject(new Error(stderr || 'WORKER_EXIT_' + code)));
  });
  const attempts = Array.from({ length: 6 }, run);
  await new Promise(resolve => setTimeout(resolve, 150));
  fs.writeFileSync(gate, 'go');
  const results = await Promise.all(attempts);
  assert.equal(results.filter(value => value === 'CLAIMED').length, 1);
  assert.ok(results.every(value => value === 'CLAIMED' || value === 'AUTHORITY_LOCKED' || value === 'STALE_GENERATION'));
  assert.equal(store.get('race').generation, 2);
  assert.equal(fs.existsSync(store.filePath('race') + '.lock'), false);
});
