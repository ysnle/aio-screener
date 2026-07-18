export const REVISION_FIELDS = Object.freeze(['appRevision', 'dataRevision', 'evidenceRevision']);

export function createRevisionManifest(input = {}) {
  const manifest = {
    schemaVersion: String(input.schemaVersion || 'revision-v1'),
    appRevision: String(input.appRevision || 'unknown'),
    dataRevision: String(input.dataRevision || 'unknown'),
    evidenceRevision: String(input.evidenceRevision || 'unknown'),
    generatedAt: input.generatedAt || null,
    source: String(input.source || 'local')
  };
  return Object.freeze(manifest);
}

export function validateRevisionManifest(manifest) {
  const errors = [];
  for (const field of REVISION_FIELDS) {
    if (!manifest?.[field] || manifest[field] === 'unknown') errors.push(`${field}_missing`);
  }
  if (manifest?.generatedAt && Number.isNaN(Date.parse(manifest.generatedAt))) errors.push('generatedAt_invalid');
  return Object.freeze({ ok: errors.length === 0, errors });
}
