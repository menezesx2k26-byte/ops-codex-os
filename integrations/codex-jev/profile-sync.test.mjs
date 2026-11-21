import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { planProfileSync, applyProfileSync, rollbackProfileSync } from './src/profile-sync.mjs';

const profile = { filename: 'gabriel-routine.json', description: 'Read public files', model: 'available-small', reasoning_effort: 'low' };
const payload = JSON.stringify({ description: profile.description, model: profile.model, reasoning_effort: profile.reasoning_effort }, null, 2) + '\n';
async function withPilot(fn) {
  const pilotHome = await fs.mkdtemp(path.join(os.tmpdir(), 'codex-jev-pilot-'));
  try { await fs.mkdir(path.join(pilotHome, 'subagent-router')); await fn(pilotHome); }
  finally { await fs.rm(pilotHome, { recursive: true, force: true }); }
}

test('writes only owned profile and preserves foreign profile', async () => withPilot(async (pilotHome) => {
  const dir = path.join(pilotHome, 'subagent-router');
  await fs.writeFile(path.join(dir, 'third-party.json'), 'KEEP');
  const plan = planProfileSync({ pilotHome, profiles: [profile], existingFiles: { 'third-party.json': 'KEEP' } });
  assert.equal(plan.conflicts.length, 0);
  assert.deepEqual(plan.writes.map(row => path.basename(row.path)), ['gabriel-routine.json']);
  const receipt = await applyProfileSync({ plan });
  assert.deepEqual(receipt.written, [path.join(dir, 'gabriel-routine.json')]);
  assert.equal(await fs.readFile(path.join(dir, 'gabriel-routine.json'), 'utf8'), payload);
  assert.equal(await fs.readFile(path.join(dir, 'third-party.json'), 'utf8'), 'KEEP');
  await rollbackProfileSync({ pilotHome, receipt });
  await assert.rejects(fs.access(path.join(dir, 'gabriel-routine.json')), { code: 'ENOENT' });
  assert.equal(await fs.readFile(path.join(dir, 'third-party.json'), 'utf8'), 'KEEP');
}));

test('preserves exact existing owned contents on overwrite and restore', async () => withPilot(async (pilotHome) => {
  const dir = path.join(pilotHome, 'subagent-router');
  const target = path.join(dir, 'gabriel-routine.json');
  await fs.writeFile(target, 'OLD\n');
  const plan = planProfileSync({ pilotHome, profiles: [profile], existingFiles: { 'gabriel-routine.json': 'OLD\n' } });
  const receipt = await applyProfileSync({ plan });
  assert.equal(await fs.readFile(target, 'utf8'), payload);
  await rollbackProfileSync({ pilotHome, receipt });
  assert.equal(await fs.readFile(target, 'utf8'), 'OLD\n');
}));

test('identical profile results in no writes and reports skipped', async () => withPilot(async (pilotHome) => {
  const target = path.join(pilotHome, 'subagent-router', profile.filename);
  await fs.writeFile(target, payload);
  const plan = planProfileSync({ pilotHome, profiles: [profile], existingFiles: { [profile.filename]: payload } });
  assert.deepEqual(plan.writes, []);
  assert.deepEqual(plan.skipped, [profile.filename]);
  const receipt = await applyProfileSync({ plan });
  assert.deepEqual(receipt.written, []);
}));

test('rejects path traversal, foreign names, duplicates and nonisolated target', async () => withPilot(async (pilotHome) => {
  for (const filename of ['../escape.json', 'foreign.json', 'gabriel-foo/../../x.json']) {
    assert.ok(planProfileSync({ pilotHome, profiles: [{ ...profile, filename }], existingFiles: {} }).conflicts.length);
  }
  assert.ok(planProfileSync({ pilotHome, profiles: [profile, profile], existingFiles: {} }).conflicts.length);
  assert.ok(planProfileSync({ pilotHome: path.join(os.homedir(), '.codex'), profiles: [profile], existingFiles: {} }).conflicts.length);
}));

test('refuses changed target between planning and apply', async () => withPilot(async (pilotHome) => {
  const target = path.join(pilotHome, 'subagent-router', profile.filename);
  const plan = planProfileSync({ pilotHome, profiles: [profile], existingFiles: {} });
  await fs.writeFile(target, 'EXTERNAL-EDIT');
  await assert.rejects(applyProfileSync({ plan }), /SYNC_CONFLICT/);
  assert.equal(await fs.readFile(target, 'utf8'), 'EXTERNAL-EDIT');
}));

test('rejects symlinked profile directory and protects external destination', async () => withPilot(async (pilotHome) => {
  const external = await fs.mkdtemp(path.join(os.tmpdir(), 'outside-jevrouting-'));
  try {
    await fs.rm(path.join(pilotHome, 'subagent-router'), { recursive: true });
    await fs.symlink(external, path.join(pilotHome, 'subagent-router'), process.platform === 'win32' ? 'junction' : 'dir');
    const plan = planProfileSync({ pilotHome, profiles: [profile], existingFiles: {} });
    await assert.rejects(applyProfileSync({ plan }), /SYNC_UNSAFE_PATH/);
    assert.deepEqual(await fs.readdir(external), []);
  } finally { await fs.rm(external, { recursive: true, force: true }); }
}));

test('rejects forged rollback paths and refuses to overwrite third-party edits', async () => withPilot(async (pilotHome) => {
  const target = path.join(pilotHome, 'subagent-router', profile.filename);
  const plan = planProfileSync({ pilotHome, profiles: [profile], existingFiles: {} });
  const receipt = await applyProfileSync({ plan });
  await assert.rejects(rollbackProfileSync({ pilotHome, receipt: { ...receipt, written: ['/tmp/other.json'] } }), /ROLLBACK_UNSAFE_RECEIPT/);
  await fs.writeFile(target, 'NEW-EXTERNAL-EDIT');
  await assert.rejects(rollbackProfileSync({ pilotHome, receipt }), /ROLLBACK_CONFLICT/);
  assert.equal(await fs.readFile(target, 'utf8'), 'NEW-EXTERNAL-EDIT');
}));
