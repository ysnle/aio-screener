export async function loadKnowledgeCapabilities(fetchFn, definitions = []) {
  const entries = definitions.map((definition) => Object.freeze({ key: definition.key, url: definition.url }));
  const settled = await Promise.allSettled(entries.map(async ({ url }) => {
    const response = await fetchFn(url);
    if (!response.ok) throw new Error(`Knowledge artifact ${response.status}: ${url}`);
    return response.json();
  }));
  return Object.freeze(Object.fromEntries(entries.map((entry, index) => {
    const result = settled[index];
    return [entry.key, Object.freeze(result.status === 'fulfilled'
      ? { status: 'connected', value: result.value, error: null }
      : { status: 'fallback', value: null, error: String(result.reason?.message || result.reason || 'unknown error') })];
  })));
}
