function sourceArrays(catalogs) {
  return catalogs.flatMap((catalog) => {
    if (Array.isArray(catalog)) return catalog;
    if (Array.isArray(catalog?.sources)) return catalog.sources;
    if (Array.isArray(catalog?.sourceCatalog)) return catalog.sourceCatalog;
    if (Array.isArray(catalog?.packets)) return catalog.packets.flatMap((packet) => packet.sources || []);
    return [];
  });
}

export function createEvidenceRegistry(...catalogs) {
  const byId = new Map();
  const conflicts = [];
  for (const source of sourceArrays(catalogs)) {
    const id = String(source?.id || '').trim();
    if (!id) continue;
    const normalized = Object.freeze({
      id,
      publisher: source.publisher || source.sourceName || '출처 확인 필요',
      title: source.title || source.publisher || id,
      url: source.url || source.sourceUrl || null,
      sourceRole: source.sourceRole || source.role || 'REFERENCE',
      scope: source.scope || null
    });
    const existing = byId.get(id);
    if (existing && existing.url && normalized.url && existing.url !== normalized.url) {
      conflicts.push(Object.freeze({ id, existing, incoming: normalized }));
      continue;
    }
    if (!existing || (!existing.url && normalized.url)) byId.set(id, normalized);
  }
  return Object.freeze({
    sources: Object.freeze([...byId.values()]),
    byId,
    conflicts: Object.freeze(conflicts),
    resolve(sourceId) { return byId.get(sourceId) || null; }
  });
}

export function unresolvedEvidenceIds(registry, sourceIds = []) {
  return [...new Set(sourceIds)].filter((sourceId) => !registry?.resolve?.(sourceId));
}
