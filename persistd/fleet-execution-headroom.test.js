const test = require('node:test');
const assert = require('node:assert/strict');
const { eligibleNodes, executionHeadroom, MIN_EXECUTION_HEADROOM_BYTES } = require('./src/fleet/eligibility');
const GiB = 1024 ** 3;

const node = { id: 'desktop-primary', capabilities: ['node', 'git'], concurrencyLimit: 1 };
const heartbeat = (free) => ({ freeDiskBytes: free, totalDiskBytes: 240 * GiB,
  freeMemoryBytes: GiB, totalMemoryBytes: 8 * GiB, cpuPercent: 20, activeJobs: 0 });
const eligible = (free, scratch = 0, fresh = true, extra = {}) => eligibleNodes({
  config: { nodes: [node] },
  snapshot: { nodes: [{ nodeId: 'desktop-primary', fresh,
    heartbeat: { ...heartbeat(free), ...extra } }] },
  intent: { requiredCapabilities: ['node'], estimatedScratchBytes: scratch },
});

test('Pichau accepts small jobs below the cache-only 50GiB threshold', () => {
  assert.equal(eligible(20 * GiB).length, 1);
  assert.equal(eligible(20 * GiB, 2 * GiB).length, 1);
});
test('estimated scratch and filesystem emergency headroom remain enforced', () => {
  assert.equal(executionHeadroom(240 * GiB), Math.ceil(2.4 * GiB));
  assert.equal(executionHeadroom(100 * GiB), MIN_EXECUTION_HEADROOM_BYTES);
  assert.equal(eligible(3 * GiB, 1 * GiB).length, 0);
  assert.equal(eligible(4 * GiB, 1 * GiB).length, 1);
  assert.equal(eligible(GiB).length, 0);
});
test('stale or invalid heartbeats and concurrent jobs remain excluded', () => {
  assert.equal(eligible(20 * GiB, 0, false).length, 0);
  assert.equal(eligible(Number.NaN).length, 0);
  assert.equal(eligible(20 * GiB, 0, true, { activeJobs: 1 }).length, 0);
});
