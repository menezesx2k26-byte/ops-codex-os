import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProfiles } from './src/catalog.mjs';

const host = {
  supportsSpawnAgent: true,
  supportsPreToolUse: true,
  models: [
    { id: 'model-small', reasoningEfforts: ['low', 'medium'] },
    { id: 'model-strong', reasoningEfforts: ['high', 'xhigh'] },
  ],
};
const valid = { name: 'Routine', description: 'Read a public repository', model: 'model-small', reasoning_effort: 'low' };

function codes(result) { return result.errors.map(error => error.code); }

test('accepts a host-supported profile with canonical filename and no secret fields', () => {
  assert.deepEqual(validateProfiles(host, [valid]), {
    ok: true,
    profiles: [{ filename: 'gabriel-routine.json', description: valid.description, model: 'model-small', reasoning_effort: 'low' }],
    errors: [],
  });
});

test('refuses unsupported model and reasoning effort rather than guessing fallbacks', () => {
  assert.ok(codes(validateProfiles(host, [{ ...valid, model: 'model-ghost' }])).includes('UNSUPPORTED_MODEL'));
  assert.ok(codes(validateProfiles(host, [{ ...valid, reasoning_effort: 'max' }])).includes('UNSUPPORTED_EFFORT'));
});

test('rejects absent native hook or spawn capability and unknown model manifest', () => {
  assert.ok(codes(validateProfiles({ ...host, supportsSpawnAgent: false }, [valid])).includes('HOST_CAPABILITIES_UNAVAILABLE'));
  assert.ok(codes(validateProfiles({ ...host, supportsPreToolUse: false }, [valid])).includes('HOST_CAPABILITIES_UNAVAILABLE'));
  assert.ok(codes(validateProfiles({ ...host, models: [] }, [valid])).includes('HOST_MODELS_UNAVAILABLE'));
});

test('rejects malformed names, reserved defer, empty descriptions and normalized collisions', () => {
  assert.ok(codes(validateProfiles(host, [{ ...valid, name: '../traverse' }])).includes('INVALID_PROFILE_NAME'));
  assert.ok(codes(validateProfiles(host, [{ ...valid, name: 'defer' }])).includes('RESERVED_PROFILE_NAME'));
  assert.ok(codes(validateProfiles(host, [{ ...valid, description: '  ' }])).includes('INVALID_DESCRIPTION'));
  assert.ok(codes(validateProfiles(host, [{ ...valid, name: 'Routine' }, { ...valid, name: 'routine' }])).includes('DUPLICATE_PROFILE'));
});

test('rejects empty and oversized catalogs and invalid entry types', () => {
  assert.ok(codes(validateProfiles(host, [])).includes('INVALID_CATALOG_SIZE'));
  assert.ok(codes(validateProfiles(host, Array.from({ length: 255 }, (_, i) => ({ ...valid, name: 'n' + i })))).includes('INVALID_CATALOG_SIZE'));
  assert.ok(codes(validateProfiles(host, [null])).includes('INVALID_PROFILE'));
});

test('canonical output does not depend on input order or expose submitted credentials', () => {
  const withSecret = { ...valid, apiKey: 'TOP-SECRET' };
  const another = { ...valid, name: 'Review', description: 'Review public code', model: 'model-strong', reasoning_effort: 'high' };
  const a = validateProfiles(host, [another, withSecret]);
  const b = validateProfiles(host, [withSecret, another]);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(a).includes('TOP-SECRET'), false);
});
