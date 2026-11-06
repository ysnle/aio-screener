// S17~S19 (D8, v59.70): research prose has one source, content/research/*.json.
//  1. Generated screen artifacts equal a fresh build from that source (scripts/build-research-content.mjs).
//  2. Content invariance: the source carries the same strings, in the same order, as the pre-move code
//     (architecture/research-content-baseline.json). A deliberate content edit updates the baseline in the same change.
//  3. The research page modules hold renderers, not copy: at most five plain Korean prose literals (≥40 chars) each,
//     no inline catalog/story tables, and no JavaScript copy module next to the JSON source.
// Negative control: on integration-20261104 (before the move) checks 1–3 all fail — content/research does not exist,
// principles.js holds 104 prose literals and src/domain/knowledge still has the story modules.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fingerprint } from './lib/research-content-fingerprint.mjs';
import { ATLAS_COPY_SOURCE, CONCEPT_STORIES_SOURCE, INDUSTRY_STORIES_SOURCE, PRINCIPLES_CATALOG_SOURCE, readAtlasCopySource, readConceptStories, readIndustryStories, readPrinciplesCatalogSource, repoRoot, researchContentArtifacts, serializeResearchArtifact } from './lib/research-content.mjs';

const errors = [];
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8');
const SOURCES = [PRINCIPLES_CATALOG_SOURCE, ATLAS_COPY_SOURCE, INDUSTRY_STORIES_SOURCE, CONCEPT_STORIES_SOURCE];
const missing = SOURCES.filter((path) => !existsSync(resolve(repoRoot, path)));
if (missing.length) {
  console.error(JSON.stringify({ ok: false, errors: [`research source missing: ${missing.join(', ')}`] }, null, 2));
  process.exit(1);
}

for (const [path, value] of researchContentArtifacts()) {
  if (!existsSync(resolve(repoRoot, path)) || read(path) !== serializeResearchArtifact(value)) errors.push(`stale generated artifact ${path} — run node scripts/build-research-content.mjs`);
}

const baseline = JSON.parse(read('architecture/research-content-baseline.json')).kinds;
const catalog = readPrinciplesCatalogSource();
const industry = readIndustryStories();
const atlasCopy = readAtlasCopySource();
const current = {
  'principles-catalog': fingerprint({ nodes: catalog.nodes, edges: catalog.edges, lessons: catalog.lessons, paths: catalog.paths }),
  'atlas-page-copy': fingerprint(Object.fromEntries(Object.entries(atlasCopy).filter(([key]) => /^[A-Z_]+$/.test(key)))),
  'industry-stories': fingerprint({ nodes: industry.INDUSTRY_NODE_STORIES, domains: industry.INDUSTRY_DOMAIN_STORIES }),
  'concept-stories': fingerprint(readConceptStories())
};
for (const [kind, expected] of Object.entries(baseline)) {
  const got = current[kind];
  if (!got || got.sha256 !== expected.sha256) errors.push(`content changed: ${kind} (${expected.strings} strings/${expected.chars} chars → ${got?.strings}/${got?.chars}); update architecture/research-content-baseline.json only for a deliberate, recorded content edit`);
}

// Plain '…' / "…" literals only: interpolated templates are rendering logic (numbers, labels), not stored copy.
const proseLiterals = (source) => [...source.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g)]
  .map((match) => match[1] ?? match[2]).filter((text) => text.length >= 40 && (text.match(/[가-힣]/g) || []).length >= 10);
const PAGE_LIMIT = 5;
for (const page of ['src/ui/pages/principles.js', 'src/ui/pages/atlas.js']) {
  const count = proseLiterals(read(page)).length;
  if (count > PAGE_LIMIT) errors.push(`${page} holds ${count} prose literals (limit ${PAGE_LIMIT}) — move copy to content/research`);
}
// The page module carries no catalog of its own: before the fetch it knows no nodes.
const principlesModule = await import('../src/ui/pages/principles.js');
if (principlesModule.MARKET_PRINCIPLES_CATALOG?.nodes?.length || typeof principlesModule.loadPrinciplesCatalog !== 'function') errors.push('principles.js must fetch its catalog (loadPrinciplesCatalog), not carry it');
for (const module of ['industry-node-stories', 'industry-node-stories-1', 'industry-node-stories-2', 'industry-node-stories-3', 'industry-domain-stories', 'concept-stories']) {
  if (existsSync(resolve(repoRoot, `src/domain/knowledge/${module}.js`))) errors.push(`src/domain/knowledge/${module}.js duplicates content/research — the JSON is the only source`);
}
// The command search (S23) and the glossary share one ranker that answers from the index it is given and nothing
// else: an empty index finds no analysis note, even one whose title is the query.
const { searchKnowledgeIndex, loadKnowledgeIndex } = await import('../src/ui/knowledge/knowledge-search.js');
const generatedIndex = JSON.parse(read('public-data/knowledge/search-index.json'));
if (typeof loadKnowledgeIndex !== 'function') errors.push('knowledge-search.js must export loadKnowledgeIndex');
if (searchKnowledgeIndex({ entries: [] }, '산술평균 수익률').length) errors.push('knowledge-search.js answers from outside the index it was given');
if (!searchKnowledgeIndex(generatedIndex, '산술평균 수익률').some((row) => row.surface === 'frame')) errors.push('knowledge-search.js cannot reach analysis notes from the generated index');

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, artifacts: researchContentArtifacts().length, kinds: Object.keys(current), pageLimit: PAGE_LIMIT }));
