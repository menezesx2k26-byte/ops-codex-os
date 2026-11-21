const validNonnegative = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const validTokens = value => Number.isSafeInteger(value) && value >= 0;
const goodQuality = row => row.testsPassed === true && row.reviewerApproved === true
  && Number.isInteger(row.blockingDefects) && row.blockingDefects === 0;

export function compareRuns(records) {
  const gaps = [];
  const byTask = Object.create(null);
  let qualityPassed = true;
  const pairs = new Map();
  if (!Array.isArray(records) || records.length === 0) {
    return { comparable: false, byTask, tokenSavingPercent: null, elapsedSavingPercent: null, qualityPassed: false, gaps: ['NO_RUNS'] };
  }

  for (const row of records) {
    if (!row || typeof row.taskId !== 'string' || !row.taskId.trim() || !Number.isInteger(row.replicate) || row.replicate < 1
      || !['baseline', 'adaptive'].includes(row.mode)) {
      gaps.push('INVALID_RUN'); qualityPassed = false; continue;
    }
    const tag = row.taskId + '#' + row.replicate;
    if (!pairs.has(tag)) pairs.set(tag, {});
    const pair = pairs.get(tag);
    if (pair[row.mode]) { gaps.push('DUPLICATE_RUN:' + tag + ':' + row.mode); qualityPassed = false; continue; }
    pair[row.mode] = row;
    if (!goodQuality(row)) qualityPassed = false;
    if (!validNonnegative(row.durationMs)) gaps.push('INVALID_DURATION:' + tag + ':' + row.mode);
    if (row.workerTokens === null || row.workerTokens === undefined) gaps.push('MISSING_WORKER_TOKENS:' + tag + ':' + row.mode);
    else if (!validTokens(row.workerTokens)) gaps.push('INVALID_WORKER_TOKENS:' + tag + ':' + row.mode);
    if (!validNonnegative(row.jevCalls) || !Number.isInteger(row.jevCalls)) gaps.push('INVALID_JEV_CALLS:' + tag + ':' + row.mode);
    if (typeof row.servedModel !== 'string' || !row.servedModel.trim()) gaps.push('UNKNOWN_SERVED_MODEL:' + tag + ':' + row.mode);
  }

  let baseTokens = 0, adaptTokens = 0, baseDuration = 0, adaptDuration = 0;
  for (const [tag, pair] of pairs) {
    if (!pair.baseline || !pair.adaptive) { gaps.push('UNPAIRED_RUN:' + tag); continue; }
    const task = pair.baseline.taskId;
    if (!byTask[task]) byTask[task] = {
      replicates: 0, baselineWorkerTokens: 0, adaptiveWorkerTokens: 0,
      baselineDurationMs: 0, adaptiveDurationMs: 0,
    };
    const entry = byTask[task];
    entry.replicates += 1;
    for (const [source, field] of [
      [pair.baseline.workerTokens, 'baselineWorkerTokens'], [pair.adaptive.workerTokens, 'adaptiveWorkerTokens'],
      [pair.baseline.durationMs, 'baselineDurationMs'], [pair.adaptive.durationMs, 'adaptiveDurationMs'],
    ]) {
      if (entry[field] === null) continue;
      if ((field.endsWith('WorkerTokens') ? validTokens : validNonnegative)(source)) entry[field] += source;
      else entry[field] = null;
    }
    if (validTokens(pair.baseline.workerTokens)) baseTokens += pair.baseline.workerTokens;
    if (validTokens(pair.adaptive.workerTokens)) adaptTokens += pair.adaptive.workerTokens;
    if (validNonnegative(pair.baseline.durationMs)) baseDuration += pair.baseline.durationMs;
    if (validNonnegative(pair.adaptive.durationMs)) adaptDuration += pair.adaptive.durationMs;
  }
  if (baseTokens === 0) gaps.push('ZERO_BASELINE_TOKENS');
  if (baseDuration === 0) gaps.push('ZERO_BASELINE_DURATION');
  const comparable = gaps.length === 0 && pairs.size > 0;
  return {
    comparable,
    byTask: Object.fromEntries(Object.entries(byTask)),
    tokenSavingPercent: comparable && baseTokens > 0 ? ((baseTokens - adaptTokens) / baseTokens) * 100 : null,
    elapsedSavingPercent: comparable && baseDuration > 0 ? ((baseDuration - adaptDuration) / baseDuration) * 100 : null,
    qualityPassed: qualityPassed && comparable,
    gaps,
  };
}
