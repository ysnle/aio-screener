import { loadKnowledgeCapabilities } from '../../data/knowledge/load-capabilities.js';

export function createKnowledgeCapabilityBatchLoader({
  fetchFn,
  state,
  dataset,
  datasetMap = {},
  signal,
  isActive = () => true,
  validators = {},
  loadCapabilities = loadKnowledgeCapabilities
} = {}) {
  if (typeof fetchFn !== 'function' || !state || typeof state !== 'object' || typeof loadCapabilities !== 'function') {
    throw new Error('KNOWLEDGE_CAPABILITY_LOADER_DEPENDENCY_INVALID');
  }
  const loading = new Set();

  async function load(definitions = []) {
    const pending = (Array.isArray(definitions) ? definitions : [])
      .filter(({ key }) => key && state[key] == null && !loading.has(key))
      .map((definition) => definition.validate || typeof validators[definition.key] !== 'function'
        ? definition
        : { ...definition, validate: validators[definition.key] });
    if (!pending.length) return false;

    pending.forEach(({ key }) => loading.add(key));
    let capabilities;
    try {
      capabilities = await loadCapabilities(fetchFn, pending, { signal });
    } finally {
      pending.forEach(({ key }) => loading.delete(key));
    }
    if (!isActive()) return false;

    for (const [key, result] of Object.entries(capabilities || {})) {
      state[key] = result?.value ?? null;
      state[`${key}Error`] = result?.status !== 'connected';
      const datasetKey = datasetMap[key];
      if (dataset && datasetKey) dataset[datasetKey] = result?.status || 'fallback';
    }
    return true;
  }

  return Object.freeze({ load, isLoading: (key) => loading.has(key) });
}
