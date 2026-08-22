import { loadJsonArtifact } from '../artifact-cache.js';

export async function loadKnowledgeCapabilities(fetchFn, definitions = [], { signal } = {}) {
  const entries = definitions.map((definition) => Object.freeze({ key: definition.key, url: definition.url, validate: definition.validate }));
  const settled = await Promise.allSettled(entries.map(async ({ url, validate }) => {
    const value = await loadJsonArtifact(fetchFn, url, { signal });
    if (typeof validate === 'function' && !validate(value)) throw new Error(`artifact validation failed: ${url}`);
    return value;
  }));
  return Object.freeze(Object.fromEntries(entries.map((entry, index) => {
    const result = settled[index];
    return [entry.key, Object.freeze(result.status === 'fulfilled'
      ? { status: 'connected', value: result.value, error: null }
      : { status: 'fallback', value: null, error: String(result.reason?.message || result.reason || 'unknown error') })];
  })));
}
