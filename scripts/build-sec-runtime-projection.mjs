import { createHash } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';

const SOURCE = new URL('../public-data/sec-fundamentals.json', import.meta.url);
const OUTPUT = new URL('../public-data/sec-fundamentals-summary.json', import.meta.url);
const MANIFEST = new URL('../public-data/sec-fundamentals-summary.manifest.json', import.meta.url);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

async function writeAtomic(url, value) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  const temporary = new URL(`${url.pathname}.tmp`, url);
  await writeFile(temporary, text, 'utf8');
  await rename(temporary, url);
  return text;
}

const sourceText = await readFile(SOURCE, 'utf8');
const source = JSON.parse(sourceText);
const data = Object.fromEntries(Object.entries(source.data || {}).map(([symbol, record]) => {
  const pit = record?.pit && typeof record.pit === 'object'
    ? Object.fromEntries(Object.entries(record.pit).filter(([key]) => key !== 'observations'))
    : null;
  return [symbol, { ...record, ...(pit ? { pit } : {}) }];
}));
const projection = {
  schemaVersion: 'sec-fundamentals-runtime-summary.v1',
  sourceSchemaVersion: source.schemaVersion,
  artifactRole: 'BOUNDED_PAGE_PROJECTION',
  projectionPolicy: 'Latest normalized annual facts plus PIT coverage counters; append-only PIT observations remain producer-side and are not shipped on the interactive path.',
  generatedAt: source.generatedAt,
  source: source.source,
  sourceUrl: source.sourceUrl,
  licenseClass: source.licenseClass,
  allowedUse: source.allowedUse,
  model: source.model,
  eligible: source.eligible,
  stored: source.stored,
  data
};
const projectionText = await writeAtomic(OUTPUT, projection);
const manifest = {
  schemaVersion: 'runtime-projection-manifest.v1',
  logicalArtifact: 'public-data/sec-fundamentals.json',
  runtimeArtifact: 'public-data/sec-fundamentals-summary.json',
  artifactRole: projection.artifactRole,
  sourceSha256: sha256(sourceText),
  runtimeSha256: sha256(projectionText),
  sourceBytes: Buffer.byteLength(sourceText),
  runtimeBytes: Buffer.byteLength(projectionText),
  records: Object.keys(data).length,
  generatedAt: projection.generatedAt
};
await writeAtomic(MANIFEST, manifest);
console.log(JSON.stringify({ ok: true, ...manifest }));
