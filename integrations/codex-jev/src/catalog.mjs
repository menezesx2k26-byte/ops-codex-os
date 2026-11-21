const MAX_PROFILES = 254;
const safeName = /^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/;

export function validateProfiles(host, declarations) {
  const errors = [];
  const error = (code) => errors.push({ code });
  if (!host?.supportsSpawnAgent || !host?.supportsPreToolUse) error('HOST_CAPABILITIES_UNAVAILABLE');
  if (!Array.isArray(host?.models) || host.models.length === 0) error('HOST_MODELS_UNAVAILABLE');
  if (!Array.isArray(declarations) || declarations.length === 0 || declarations.length > MAX_PROFILES) {
    error('INVALID_CATALOG_SIZE');
  }
  if (!Array.isArray(declarations)) return { ok: false, profiles: [], errors };

  const available = new Map((Array.isArray(host?.models) ? host.models : [])
    .filter(row => row && typeof row.id === 'string' && Array.isArray(row.reasoningEfforts))
    .map(row => [row.id, new Set(row.reasoningEfforts)]));
  const seen = new Set();
  const profiles = [];
  for (const item of declarations.slice(0, MAX_PROFILES)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      error('INVALID_PROFILE');
      continue;
    }
    const name = typeof item.name === 'string' ? item.name.toLowerCase() : '';
    if (!safeName.test(name) || item.name.trim() !== item.name) {
      error('INVALID_PROFILE_NAME');
      continue;
    }
    if (name === 'defer') {
      error('RESERVED_PROFILE_NAME');
      continue;
    }
    if (seen.has(name)) {
      error('DUPLICATE_PROFILE');
      continue;
    }
    seen.add(name);
    if (typeof item.description !== 'string' || !item.description.trim() || item.description.length > 2000) {
      error('INVALID_DESCRIPTION');
      continue;
    }
    if (typeof item.model !== 'string' || !available.has(item.model)) {
      error('UNSUPPORTED_MODEL');
      continue;
    }
    if (typeof item.reasoning_effort !== 'string' || !available.get(item.model).has(item.reasoning_effort)) {
      error('UNSUPPORTED_EFFORT');
      continue;
    }
    profiles.push({
      filename: 'gabriel-' + name + '.json',
      description: item.description.trim(),
      model: item.model,
      reasoning_effort: item.reasoning_effort,
    });
  }
  profiles.sort((a, b) => a.filename.localeCompare(b.filename, 'en'));
  return { ok: errors.length === 0, profiles: errors.length ? [] : profiles, errors };
}
