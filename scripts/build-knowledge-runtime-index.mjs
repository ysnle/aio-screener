import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const knowledgeDir = path.join(root, 'public-data', 'knowledge');
const readJson = async (name) => JSON.parse(await fs.readFile(path.join(knowledgeDir, name), 'utf8'));

const [coverage, research, domains, articles] = await Promise.all([
  readJson('coverage-matrix.json'),
  readJson('research-dossiers.json'),
  readJson('domain-dossiers.json'),
  readJson('articles.json')
]);
const generatedAt = [coverage.generatedAt, research.generatedAt, domains.generatedAt, articles.generatedAt].filter(Boolean).sort().at(-1) || '1970-01-01T00:00:00.000Z';

const output = {
  schemaVersion: 'knowledge-runtime-status.v1',
  generatedAt,
  status: 'REFERENCE_PROGRESS_ONLY',
  boundary: 'Compact runtime counts only. Read the canonical artifacts for unit-level evidence and never infer completion from this summary.',
  coverage: {
    units: coverage.counts?.units || 0,
    coreLessons: coverage.counts?.coreLessons || 0,
    foundationLessons: coverage.counts?.foundationLessons || 0,
    taxonomyNodes: coverage.counts?.taxonomyNodes || 0
  },
  research: {
    total: research.counts?.total || 0,
    researched: research.counts?.researched || 0,
    inProgress: research.counts?.researchInProgress || 0,
    required: research.counts?.researchRequired || 0
  },
  domains: {
    total: domains.counts?.domains || 0,
    taxonomyNodes: domains.counts?.taxonomyNodes || 0,
    deepBranches: domains.counts?.deepBranches || 0
  },
  articles: {
    total: articles.counts?.total || 0,
    principles: articles.counts?.principles || 0,
    atlasFoundations: articles.counts?.atlasFoundations || 0
  },
  humanReviewComplete: false,
  publicationReady: false
};

const target = path.join(knowledgeDir, 'status-summary.json');
const temp = `${target}.tmp`;
await fs.writeFile(temp, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
await fs.rename(temp, target);
console.log(JSON.stringify({ target: path.relative(root, target), bytes: Buffer.byteLength(JSON.stringify(output)), counts: output }, null, 2));
