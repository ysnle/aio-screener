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
    // P30-LOAD-01: a key listed twice loads once (the first definition), instead of a last-wins merge of two results.
    const pending = (Array.isArray(definitions) ? definitions : [])
      .filter(({ key }, index, list) => key && state[key] == null && !loading.has(key) && list.findIndex((item) => item.key === key) === index)
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
