#!/usr/bin/env node
// Read-only evidence report for the monthly universe review. It compares the curated universe mirror
// (public-data/screener-universe.json, built from js/aio-data.js SCREENER_DB) with listing and index files the
// producers already publish, and prints a JSON report. It changes no file and fetches nothing.
//
//   node scripts/universe-review-evidence.mjs            — print the report
//   node scripts/universe-review-evidence.mjs --out F    — also write the report to F
//
// Symbols are compared exactly after one normalisation: a share-class separator ('.' or '/') becomes '-', which is
// how us-listings.json, sp500-weights.json and the universe spell class shares (BRK-B, BF-B). Names are never
// matched, so a renamed or reissued symbol is reported for a human to decide.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (rel) => JSON.parse(readFileSync(resolve(ROOT, rel), 'utf8'));

const NON_US_INDEX = new Set(['KOSPI', 'KOSDAQ', 'TSE', 'TWSE']);
const NON_US_SUFFIX = /\.(KS|KQ|T|TW)$/;
const KR_INDEX = new Set(['KOSPI', 'KOSDAQ']);

export function normalizeUsSymbol(sym) {
  return String(sym || '').trim().toUpperCase().replace(/[./]/g, '-');
}

export function isUsRow(row) {
  return !NON_US_INDEX.has(row.index) && !NON_US_SUFFIX.test(String(row.sym || ''));
}

export function buildUniverseReview({ universe, listings, weights, krWeights }) {
  const listingSyms = new Set((listings.columns?.sym || []).map(normalizeUsSymbol));
  const weightRows = Array.isArray(weights.rows) ? weights.rows : [];
  const weightBySym = new Map(weightRows.map((r) => [normalizeUsSymbol(r.sym), r]));
  const universeRows = Array.isArray(universe.universe) ? universe.universe : [];
  const universeSyms = new Set(universeRows.map((r) => normalizeUsSymbol(r.sym)));
  const usRows = universeRows.filter(isUsRow);
  const krRows = universeRows.filter((r) => KR_INDEX.has(r.index));

  const absentFromListings = usRows
    .filter((r) => !listingSyms.has(normalizeUsSymbol(r.sym)))
    .map((r) => ({ sym: r.sym, name: r.name, index: r.index, inSp500Weights: weightBySym.has(normalizeUsSymbol(r.sym)) }));
  const removalCandidates = absentFromListings.filter((r) => !r.inSp500Weights);

  const additionCandidates = weightRows
    .filter((r) => !universeSyms.has(normalizeUsSymbol(r.sym)))
    .map((r) => ({ sym: r.sym, name: r.name, sector: r.sector, weight: r.weight, inListings: listingSyms.has(normalizeUsSymbol(r.sym)) }));

  const sp500LabelNotInWeights = usRows
    .filter((r) => r.index === 'SP500' && !weightBySym.has(normalizeUsSymbol(r.sym)))
    .map((r) => ({ sym: r.sym, name: r.name, index: r.index, inListings: listingSyms.has(normalizeUsSymbol(r.sym)) }));
  const inWeightsLabelledOther = usRows
    .filter((r) => r.index !== 'SP500' && weightBySym.has(normalizeUsSymbol(r.sym)))
    .map((r) => ({ sym: r.sym, name: r.name, index: r.index }));

  const krCodes = new Set();
  for (const market of Object.values(krWeights.markets || {})) {
    for (const r of market?.rows || market?.constituents || []) {
      const code = String(r.code || r.sym || r.ticker || '').replace(/\.(KS|KQ)$/, '');
      if (code) krCodes.add(code);
    }
  }
  const krAbsentFromWeights = krRows
    .filter((r) => !krCodes.has(String(r.sym).replace(/\.(KS|KQ)$/, '')))
    .map((r) => ({ sym: r.sym, name: r.name, index: r.index }));

  return {
    schemaVersion: 'universe-review-evidence.v1',
    sources: {
      universe: { file: 'public-data/screener-universe.json', lastBulkUpdate: universe.meta?.lastBulkUpdate ?? null, rows: universeRows.length },
      listings: { file: 'public-data/us-listings.json', asOf: listings.asOf ?? null, source: listings.source ?? null, count: listings.count ?? listingSyms.size },
      sp500Weights: { file: 'public-data/sp500-weights.json', asOf: weights.asOf ?? null, source: weights.source ?? null, count: weightRows.length },
      krIndexWeights: {
        file: 'public-data/kr-index-weights.json',
        asOf: Object.fromEntries(Object.entries(krWeights.markets || {}).map(([m, v]) => [m, v?.asOf ?? null])),
        codes: krCodes.size,
        note: 'not a full listing; rows absent from it are information only',
      },
    },
    counts: {
      usRows: usRows.length,
      krRows: krRows.length,
      absentFromListings: absentFromListings.length,
      removalCandidates: removalCandidates.length,
      additionCandidates: additionCandidates.length,
      sp500LabelNotInWeights: sp500LabelNotInWeights.length,
      inWeightsLabelledOther: inWeightsLabelledOther.length,
      krAbsentFromWeightsInfoOnly: krAbsentFromWeights.length,
    },
    removalCandidates,
    absentFromListingsButInWeights: absentFromListings.filter((r) => r.inSp500Weights),
    additionCandidates,
    indexLabelCandidates: { sp500LabelNotInWeights, inWeightsLabelledOther },
    krAbsentFromWeightsInfoOnly: krAbsentFromWeights,
  };
}

function main(argv) {
  const report = buildUniverseReview({
    universe: readJson('public-data/screener-universe.json'),
    listings: readJson('public-data/us-listings.json'),
    weights: readJson('public-data/sp500-weights.json'),
    krWeights: readJson('public-data/kr-index-weights.json'),
  });
  const text = `${JSON.stringify(report, null, 2)}\n`;
  const outIdx = argv.indexOf('--out');
  if (outIdx >= 0 && argv[outIdx + 1]) {
    const out = resolve(process.cwd(), argv[outIdx + 1]);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, text);
  }
  process.stdout.write(text);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
