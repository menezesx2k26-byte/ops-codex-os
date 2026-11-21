import fsDefault from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const ownedName = /^gabriel-[a-z0-9][a-z0-9_-]*\.json$/;

function pilotRoot(home) {
  if (typeof home !== 'string' || !path.isAbsolute(home) || !/^codex-jev-pilot-[a-z0-9_-]+$/i.test(path.basename(home))) {
    throw new Error('SYNC_UNSAFE_HOME');
  }
  return path.resolve(home);
}

function ownedPath(root, candidate) {
  const base = path.basename(candidate);
  if (!ownedName.test(base) || candidate !== base) throw new Error('SYNC_UNSAFE_PATH');
  return path.join(root, 'subagent-router', base);
}

function jsonContent(profile) {
  return JSON.stringify({
    description: profile.description,
    model: profile.model,
    reasoning_effort: profile.reasoning_effort,
  }, null, 2) + '\n';
}

export function planProfileSync({ pilotHome, profiles, existingFiles = {} }) {
  let root;
  try { root = pilotRoot(pilotHome); }
  catch { return { pilotHome, writes: [], skipped: [], conflicts: ['SYNC_UNSAFE_HOME'] }; }
  const writes = [], skipped = [], conflicts = [], names = new Set();
  if (!Array.isArray(profiles) || !existingFiles || typeof existingFiles !== 'object' || Array.isArray(existingFiles)) {
    return { pilotHome: root, writes, skipped, conflicts: ['SYNC_INVALID_INPUT'] };
  }
  for (const profile of profiles) {
    try {
      const filename = profile?.filename;
      const target = ownedPath(root, filename);
      if (names.has(filename)) throw new Error('SYNC_DUPLICATE');
      names.add(filename);
      if (typeof profile.description !== 'string' || !profile.description.trim()
        || typeof profile.model !== 'string' || !profile.model.trim()
        || typeof profile.reasoning_effort !== 'string' || !profile.reasoning_effort.trim()) {
        throw new Error('SYNC_INVALID_PROFILE');
      }
      const content = jsonContent(profile);
      const existing = Object.prototype.hasOwnProperty.call(existingFiles, filename) ? existingFiles[filename] : null;
      if (existing !== null && typeof existing !== 'string') throw new Error('SYNC_INVALID_EXISTING');
      if (existing === content) skipped.push(filename);
      else writes.push({ path: target, content, expectedOriginal: existing });
    } catch (err) { conflicts.push(String(err.message || err)); }
  }
  return { pilotHome: root, writes, skipped, conflicts };
}

async function secureFolder(root, fsp) {
  const homeStat = await fsp.lstat(root);
  if (!homeStat.isDirectory() || homeStat.isSymbolicLink()) throw new Error('SYNC_UNSAFE_PATH');
  const canonical = await fsp.realpath(root);
  if (path.normalize(canonical).toLowerCase() !== path.normalize(root).toLowerCase()) throw new Error('SYNC_UNSAFE_PATH');
  const dir = path.join(root, 'subagent-router');
  const stat = await fsp.lstat(dir);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('SYNC_UNSAFE_PATH');
  return dir;
}

async function currentText(target, fsp) {
  try {
    const stat = await fsp.lstat(target);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('SYNC_UNSAFE_PATH');
    return await fsp.readFile(target, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function atomicWrite(target, text, fsp) {
  const temporary = path.join(path.dirname(target), '.' + path.basename(target) + '.' + randomUUID() + '.tmp');
  try {
    await fsp.writeFile(temporary, text, { flag: 'wx', mode: 0o600 });
    await fsp.rename(temporary, target);
  } finally {
    await fsp.rm(temporary, { force: true });
  }
}

export async function applyProfileSync({ plan, fs = fsDefault }) {
  if (!plan || plan.conflicts?.length || !Array.isArray(plan.writes)) throw new Error('SYNC_CONFLICT');
  const root = pilotRoot(plan.pilotHome);
  await secureFolder(root, fs);
  const targets = new Set();
  for (const row of plan.writes) {
    if (!row || ownedPath(root, path.basename(row.path)) !== row.path || targets.has(row.path)) throw new Error('SYNC_UNSAFE_PATH');
    targets.add(row.path);
    if (typeof row.content !== 'string' || row.content.length > 8192 || (row.expectedOriginal !== null && typeof row.expectedOriginal !== 'string')) {
      throw new Error('SYNC_INVALID_INPUT');
    }
    const observed = await currentText(row.path, fs);
    if (observed !== row.expectedOriginal) throw new Error('SYNC_CONFLICT');
  }
  const receipt = { written: [], originalContents: {}, writtenContents: {} };
  try {
    for (const row of plan.writes) {
      const observed = await currentText(row.path, fs);
      if (observed !== row.expectedOriginal) throw new Error('SYNC_CONFLICT');
      await atomicWrite(row.path, row.content, fs);
      receipt.written.push(row.path);
      receipt.originalContents[row.path] = row.expectedOriginal;
      receipt.writtenContents[row.path] = row.content;
    }
  } catch (err) {
    try { await rollbackProfileSync({ pilotHome: root, receipt, fs }); }
    catch (rollbackErr) { throw new AggregateError([err, rollbackErr], 'SYNC_PARTIAL_ROLLBACK_FAILED'); }
    throw err;
  }
  return receipt;
}

export async function rollbackProfileSync({ pilotHome, receipt, fs = fsDefault }) {
  const root = pilotRoot(pilotHome);
  await secureFolder(root, fs);
  if (!receipt || !Array.isArray(receipt.written) || !receipt.originalContents || !receipt.writtenContents) {
    throw new Error('ROLLBACK_UNSAFE_RECEIPT');
  }
  const targets = new Set();
  for (const target of receipt.written) {
    let expectedPath;
    try { expectedPath = typeof target === 'string' ? ownedPath(root, path.basename(target)) : null; }
    catch { throw new Error('ROLLBACK_UNSAFE_RECEIPT'); }
    if (expectedPath !== target || targets.has(target)
      || !Object.prototype.hasOwnProperty.call(receipt.originalContents, target)
      || !Object.prototype.hasOwnProperty.call(receipt.writtenContents, target)) throw new Error('ROLLBACK_UNSAFE_RECEIPT');
    targets.add(target);
    const now = await currentText(target, fs);
    if (now !== receipt.writtenContents[target]) throw new Error('ROLLBACK_CONFLICT');
  }
  for (const target of [...receipt.written].reverse()) {
    const previous = receipt.originalContents[target];
    if (previous === null) await fs.unlink(target);
    else if (typeof previous === 'string') await atomicWrite(target, previous, fs);
    else throw new Error('ROLLBACK_UNSAFE_RECEIPT');
  }
}
