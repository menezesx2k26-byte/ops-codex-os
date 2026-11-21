import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRuns } from './src/metrics.mjs';
const baseline = { taskId: 'public-lookup', mode: 'baseline', replicate: 1, durationMs: 100, workerTokens: 1000, jevCalls: 0, servedModel: 'model-A', testsPassed: true, blockingDefects: 0, reviewerApproved: true };
const adaptive = { ...baseline, mode: 'adaptive', durationMs: 70, workerTokens: 800, jevCalls: 1, servedModel: 'model-B' };
const result = (b=baseline,a=adaptive) => compareRuns([b,a]);

test('computes transparent paired token and elapsed savings', () => {
  assert.deepEqual(result(), {
    comparable: true,
    byTask: { 'public-lookup': { replicates: 1, baselineWorkerTokens: 1000, adaptiveWorkerTokens: 800, baselineDurationMs: 100, adaptiveDurationMs: 70 } },
    tokenSavingPercent: 20,
    elapsedSavingPercent: 30,
    qualityPassed: true,
    gaps: [],
  });
});

test('missing token value is unknown, not zero or a claimed saving', () => {
  const r=result(baseline,{...adaptive,workerTokens:null});
  assert.equal(r.comparable,false); assert.equal(r.tokenSavingPercent,null);
  assert.ok(r.gaps.some(x=>x.includes('MISSING_WORKER_TOKENS')));
});

test('unknown served model prevents labeling result comparable', () => {
  const r=result(baseline,{...adaptive,servedModel:null});
  assert.equal(r.comparable,false); assert.ok(r.gaps.some(x=>x.includes('UNKNOWN_SERVED_MODEL')));
});

test('zero denominator does not produce infinity or fake savings', () => {
  const r=result({...baseline, workerTokens:0},{...adaptive,workerTokens:0});
  assert.equal(r.tokenSavingPercent,null); assert.ok(r.gaps.some(x=>x.includes('ZERO_BASELINE_TOKENS')));
});

test('rejects orphan and uneven variant replicates', () => {
  const r=compareRuns([baseline]); assert.equal(r.comparable,false);
  assert.ok(r.gaps.some(x=>x.includes('UNPAIRED_RUN')));
  const q=compareRuns([baseline,adaptive,{...baseline,replicate:2}]);
  assert.equal(q.comparable,false);
});

test('rejects duplicate run identity and negative metrics without hiding invalid input', () => {
  assert.equal(compareRuns([baseline,baseline,adaptive]).comparable,false);
  assert.ok(compareRuns([baseline,baseline,adaptive]).gaps.some(x=>x.includes('DUPLICATE_RUN')));
  assert.equal(result(baseline,{...adaptive,workerTokens:-1}).comparable,false);
  assert.ok(result(baseline,{...adaptive,durationMs:-2}).gaps.some(x=>x.includes('INVALID_DURATION')));
});

test('better latency cannot hide failed tests, rejected review or defects', () => {
  for(const patch of [{testsPassed:false},{reviewerApproved:false},{blockingDefects:1}]) {
    const r=result(baseline,{...adaptive,...patch});
    assert.equal(r.qualityPassed,false);
  }
});

test('aggregate compares multiple paired tasks without changing pairing', () => {
  const items=[baseline,adaptive,{...baseline,taskId:'fix',replicate:1,workerTokens:2000,durationMs:200}, {...adaptive,taskId:'fix',replicate:1,workerTokens:1000,durationMs:100}];
  const r=compareRuns(items);
  assert.equal(r.comparable,true); assert.equal(r.tokenSavingPercent,40); assert.equal(r.elapsedSavingPercent,43.333333333333336);
});

test('task names cannot mutate the result object prototype', () => {
  const r=compareRuns([{...baseline,taskId:'__proto__'},{...adaptive,taskId:'__proto__'}]);
  assert.equal(r.comparable,true);
  assert.equal(Object.getPrototypeOf(r.byTask),Object.prototype);
  assert.equal(Object.hasOwn(r.byTask,'__proto__'),true);
  assert.equal(r.byTask.__proto__.replicates,1);
});
