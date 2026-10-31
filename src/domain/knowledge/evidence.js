function sourceArrays(catalogs) {
  return catalogs.flatMap((catalog) => {
    if (Array.isArray(catalog)) return catalog;
    if (Array.isArray(catalog?.sources)) return catalog.sources;
    if (Array.isArray(catalog?.sourceCatalog)) return catalog.sourceCatalog;
    if (Array.isArray(catalog?.packets)) return catalog.packets.flatMap((packet) => packet.sources || []);
    return [];
  });
}

// The fields that say how a source may be used, as each catalog declared them (before defaults are filled in).
const USE_FIELDS = Object.freeze(['verification', 'allowedUse', 'sourceRole']);
const declaredUse = (source, field) => (field === 'sourceRole' ? source.sourceRole || source.role : source[field]) || null;

export function createEvidenceRegistry(...catalogs) {
  const byId = new Map();
  const declaredById = new Map();
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
      scope: source.scope || null,
      allowedUse: source.allowedUse || 'REFERENCE_ONLY',
      reviewedAt: source.reviewedAt || null,
      publishedAt: source.publishedAt || source.asOf || null,
      verification: source.verification || null,
      directness: source.directness || null,
      sourceTier: source.sourceTier || null
    });
    const existing = byId.get(id);
    if (existing && existing.url && normalized.url && existing.url !== normalized.url) {
      conflicts.push(Object.freeze({ id, existing, incoming: normalized }));
      continue;
    }
    if (!existing) {
      byId.set(id, normalized);
      declaredById.set(id, Object.fromEntries(USE_FIELDS.map((field) => [field, declaredUse(source, field)])));
    } else {
      // P29-EVIDENCE-01: the same id and URL can still disagree on what a source may be used for — a later catalog that
      // revokes a verification or narrows allowedUse. Catalog order must not decide that silently: each disagreeing
      // field is a conflict (the corpus gate requires none) and the first catalog's value stays until it is resolved.
      const declared = declaredById.get(id);
      for (const field of USE_FIELDS) {
        const value = declaredUse(source, field);
        if (declared[field] && value && declared[field] !== value) conflicts.push(Object.freeze({ id, field, existing, incoming: normalized }));
        else if (!declared[field] && value) declared[field] = value;
      }
      byId.set(id, Object.freeze({
        ...existing,
        url: existing.url || normalized.url,
        // A use declared only by a later catalog replaces the default, never a declared value.
        sourceRole: declared.sourceRole || existing.sourceRole,
        allowedUse: declared.allowedUse || existing.allowedUse,
        scope: existing.scope || normalized.scope,
        reviewedAt: existing.reviewedAt || normalized.reviewedAt,
        publishedAt: existing.publishedAt || normalized.publishedAt,
        verification: existing.verification || normalized.verification,
        directness: existing.directness || normalized.directness,
        sourceTier: existing.sourceTier || normalized.sourceTier
      }));
    }
  }
  return Object.freeze({
    sources: Object.freeze([...byId.values()]),
    conflicts: Object.freeze(conflicts),
    resolve(sourceId) { return byId.get(sourceId) || null; }
  });
}

export function createClaimRegistry(claims = [], evidenceRegistry = null) {
  const byId = new Map();
  const unresolved = [];
  const duplicates = [];
  // P29-EVIDENCE-01: a claim with no source id resolves trivially; it is listed apart so "no unresolved id" is not
  // read as "every claim is sourced".
  const unsourced = [];
  for (const claim of claims) {
    const id = String(claim?.claimId || claim?.id || '').trim();
    if (!id) continue;
    if (byId.has(id)) duplicates.push(id);
    const rawSourceIds = Array.isArray(claim.sourceIds) ? claim.sourceIds : Array.isArray(claim.evidence) ? claim.evidence : [];
    const sourceIds = Object.freeze([...new Set(rawSourceIds.map((sourceId) => String(sourceId || '').trim()).filter(Boolean))]);
    const missingSourceIds = unresolvedEvidenceIds(evidenceRegistry, sourceIds);
    if (!sourceIds.length) unsourced.push(id);
    if (missingSourceIds.length) unresolved.push(Object.freeze({ claimId: id, sourceIds: missingSourceIds }));
    byId.set(id, Object.freeze({ ...claim, claimId: id, sourceIds, missingSourceIds: Object.freeze(missingSourceIds) }));
  }
  return Object.freeze({
    claims: Object.freeze([...byId.values()]),
    unresolved: Object.freeze(unresolved),
    duplicates: Object.freeze(duplicates),
    unsourced: Object.freeze(unsourced),
    resolve(claimId) { return byId.get(claimId) || null; }
  });
}

export function unresolvedEvidenceIds(registry, sourceIds = []) {
  return [...new Set(sourceIds)].filter((sourceId) => !registry?.resolve?.(sourceId));
}
