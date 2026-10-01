// P1355: imported producer artifacts retain their data identity and observation timestamps.
export const GENERATED_VERSION_FILES = Object.freeze([
  'architecture/asset-manifest.json', 'architecture/release-manifest.json', 'public-data/operations-status.json'
]);
export function alignGeneratedVersion(documents, { version, snapshotRevision } = {}) {
  const parsed = (value) => /^v\d+\.\d+$/.test(value || '') ? value.slice(1).split('.').map(Number) : null;
  const target = parsed(version);
  if (!target || typeof snapshotRevision !== 'string' || !snapshotRevision.startsWith('market-snapshot:')) throw new Error('invalid generated alignment identity');
  if (Object.keys(documents || {}).length !== GENERATED_VERSION_FILES.length) throw new Error('exact generated version surfaces required');
  const aligned = {};
  for (const path of GENERATED_VERSION_FILES) {
    const original = documents[path];
    const prior = parsed(original?.appRevision);
    if (!prior || prior[0] > target[0] || prior[0] === target[0] && prior[1] > target[1]) throw new Error(`invalid or newer generated revision: ${path}`);
    if (original.dataRevision !== snapshotRevision) throw new Error(`producer batch mismatch: ${path}`);
    const next = structuredClone(original);
    next.appRevision = version;
    if (path !== 'public-data/operations-status.json') {
      if (!/^sw:v\d+\.\d+$/.test(next.workerRevision || '')) throw new Error(`invalid cache revision: ${path}`);
      next.workerRevision = `sw:${version}`;
    } else {
      if (!parsed(next.planes?.browser?.revision)) throw new Error('invalid browser metadata revision');
      next.planes.browser.revision = version;
    }
    // Do not change generatedAt, dataRevision, sourceSha or observed live Worker revisions.
    aligned[path] = next;
  }
  return aligned;
}
