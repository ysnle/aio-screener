#!/usr/bin/env node
// v59.43: rebuilds public-data/company-profiles/index.json from the story files beside it. With a source directory
// argument it first copies researched stories in (e.g. _artifacts/company-profile-pilot-20261028/profiles-v2).
// A workspace generator, not a producer: it reads local files only and fetches nothing.
// Usage: node scripts/sync-company-profiles.mjs [source-dir]
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCompanyGraph } from '../src/domain/entity/company-graph.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = join(root, 'public-data', 'company-profiles');
const source = process.argv[2] ? resolve(root, process.argv[2]) : null;
mkdirSync(dir, { recursive: true });
// v59.74: graph.json (the company graph) sits beside the stories and is written from them.
const NON_STORY = new Set(['index.json', 'graph.json']);
if (source) {
  if (!existsSync(source)) throw new Error(`source directory not found: ${source}`);
  for (const file of readdirSync(source).filter((name) => name.endsWith('.json'))) copyFileSync(join(source, file), join(dir, file));
}
const stories = [];
const profiles = readdirSync(dir).filter((name) => name.endsWith('.json') && !NON_STORY.has(name)).sort().map((file) => {
  const story = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  stories.push(story);
  if (`${story.symbol}.json` !== file) throw new Error(`${file}: symbol ${story.symbol} does not match the file name`);
  return { symbol: story.symbol, name: story.name, file, researchedAt: story.researchedAt || null, period: story.earnings?.period || null, layer: story.aiChain?.layer || null };
});
// Content-addressed (P1370): the revision hashes the rows only, so an unchanged set rewrites byte-identical JSON.
const revision = createHash('sha256').update(JSON.stringify(profiles)).digest('hex').slice(0, 16);
const index = { schemaVersion: 'company-profiles-index.v1', revision, count: profiles.length, schema: '_artifacts/company-profile-pilot-20261028/SCHEMA-v2.md', cadence: 'researched once per quarterly report; a story older than the company\'s latest report is shown as stale', profiles };
writeFileSync(join(dir, 'index.json'), `${JSON.stringify(index, null, 1)}\n`);
// v59.74: who pays whom, who works with whom and who competes, across the stories (src/domain/entity/company-graph.js).
const graph = buildCompanyGraph(stories);
writeFileSync(join(dir, 'graph.json'), `${JSON.stringify({ ...graph, revision: createHash('sha256').update(JSON.stringify(graph)).digest('hex').slice(0, 16) })}\n`);
console.log(`company profiles: ${profiles.length} stories, revision ${revision}; graph ${graph.edges.length} links`);
