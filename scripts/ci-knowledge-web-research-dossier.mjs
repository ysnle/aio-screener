#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const matrix = read('public-data/knowledge/coverage-matrix.json');
const index = read('public-data/knowledge/research-dossiers.json');
const sources = new Set(read('public-data/knowledge/sources.json').sources.map((source) => source.id));
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
assert(index.schemaVersion === 'knowledge-research-dossiers.v1', 'index schemaVersion');
assert(index.dossiers.length === matrix.units.length, `dossier count ${index.dossiers.length} !== coverage units ${matrix.units.length}`);
// v58.63 (architecture audit A22/GV01): a matching row count let one unit lose its dossier while another unit had two.
// Every coverage unit must have exactly one dossier, and every dossier must name a coverage unit.
const unitIds = new Set(matrix.units.map((unit) => unit.unitId));
const dossierUnits = index.dossiers.map((dossier) => dossier.contentUnitId);
const seenUnits = new Set();
for (const unitId of dossierUnits) {
  assert(unitIds.has(unitId), `dossier names unknown coverage unit ${unitId}`);
  assert(!seenUnits.has(unitId), `coverage unit ${unitId} has more than one dossier`);
  seenUnits.add(unitId);
}
for (const unitId of unitIds) assert(seenUnits.has(unitId), `coverage unit ${unitId} has no dossier`);
const ids = new Set();
for (const dossier of index.dossiers) {
  assert(!ids.has(dossier.dossierId), `duplicate dossier ${dossier.dossierId}`);
  ids.add(dossier.dossierId);
  for (const field of ['contentUnitId', 'researchQuestions', 'queries', 'candidateSources', 'selectedSources', 'rejectedSources', 'sourceTiers', 'claimCoverage', 'consensus', 'disagreement', 'invalidation', 'currentnessBoundary', 'q1Thesis', 'q2ParadigmShift', 'q3DisconfirmingVariable', 'q4StructuralMechanism', 'q5AdjacentImpact', 'status']) assert(dossier[field] !== undefined, `${dossier.dossierId}: missing ${field}`);
  for (const source of [...dossier.candidateSources, ...dossier.selectedSources]) if (!source.unresolved) assert(sources.has(source.sourceId), `${dossier.dossierId}: unknown source ${source.sourceId}`);
  assert(dossier.status !== 'RESEARCHED' || dossier.selectedSources.length > 0, `${dossier.dossierId}: researched without selected source`);
  assert(dossier.currentnessBoundary.includes('asOf'), `${dossier.dossierId}: missing currentness boundary`);
}
const report = {
  status: failures.length ? 'FAIL' : 'PASS_WITH_BOUNDARY',
  total: index.dossiers.length,
  researched: index.dossiers.filter((d) => d.status === 'RESEARCHED').length,
  inProgress: index.dossiers.filter((d) => d.status === 'RESEARCH_IN_PROGRESS').length,
  researchRequired: index.dossiers.filter((d) => d.status === 'RESEARCH_REQUIRED').length,
  completionReady: false,
  failures
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
