#!/usr/bin/env node
// v59.70 (data audit R2): history.json has one reader. Its stored shape is history.v2 (field dictionary + checkedAt,
// src/domain/market/indices/history-rows.js); every consumer expands it through readHistoryRows(), which returns the v1 rows.
// This gate fails (1) a script, module or classic script that reads the file without that expander — a reader that
// parses it itself would see the compact rows — and (2) a round trip that does not give back the rows exactly, for the
// published file and for a v1-shaped copy of it.
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import { readHistoryRows, compactHistoryRows, HISTORY_SCHEMA_V2 } from '../src/domain/market/indices/history-rows.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const check = (label, ok, detail = '') => { if (!ok) failures.push(`${label}${detail ? ` — ${detail}` : ''}`); };

// (1) Every read of the artifact goes through the expander.
const READ = /(?:readFile(?:Sync)?|JSON\.parse|readJson|readIf|json|artifact|read|fetch)\s*\([^)\n]*(?:history\.json|\bHIST\b|INPUT_PATHS\.history|historyPath\b|HISTORY_PATH)/;
const URL_READ = /url\s*=\s*['"]\.\/public-data\/history\.json['"]/;
const EXPANDS = /readHistoryRows|expandHistoryRows|__aioReadHistoryRows/;
const SKIP = new Set(['src/domain/market/indices/history-rows.js', 'scripts/ci-history-access-check.mjs']);
const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
  const rel = `${dir}/${entry.name}`;
  if (entry.isDirectory()) return entry.name === 'node_modules' || entry.name === 'fixtures' ? [] : walk(rel);
  return /\.(?:m?js)$/.test(entry.name) ? [rel] : [];
});
const readers = [];
for (const rel of [...walk('scripts'), ...walk('src'), ...walk('js')]) {
  if (SKIP.has(rel)) continue;
  const code = fs.readFileSync(path.join(root, rel), 'utf8').split('\n').filter((line) => !/^\s*(?:\/\/|\*)/.test(line)).join('\n');
  // A path variable (historyPath, HIST, INPUT_PATHS.history) counts only in a file that names this artifact.
  const namesArtifact = /public-data\/history\.json|\bHIST\b[^\n]*from '\.\/paths\.mjs'/.test(code);
  const hit = code.split('\n').find((line) => (READ.test(line) && (/history\.json/.test(line) || namesArtifact)
    && !/macro-history|rotation-history|score-backtest-history|backtest-history|theme-stage-history|sec-fiscal-history/.test(line)) || URL_READ.test(line));
  if (!hit) continue;
  readers.push(rel);
  check(`v59.70 R2 ${rel} reads history.json through readHistoryRows`, EXPANDS.test(code), hit.trim().slice(0, 140));
  // v59.70 (integration review 89e8c881): a reader that expands and then still falls back to `payload.rows` reads the
  // stored history.v2 shape (compact fieldMeta) whenever the expander's answer is not an array. A variable that holds
  // what a history.json read returned must not be read as `.rows`.
  const payloadVars = [...code.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[^\n;]*history\.json/g)].map((match) => match[1]);
  for (const name of new Set(payloadVars)) {
    const stored = code.split('\n').find((line) => new RegExp(`(?<![\\w$.])${name.replace(/\$/g, '\\$')}\\??\\.rows\\b`).test(line));
    check(`v59.70 R2 ${rel} does not read the stored history shape (${name}.rows)`, !stored, stored?.trim().slice(0, 140));
  }
}
{
  // Replay: the fallback the review found (scenario guidance, crash replay) is caught; the expanded form is not.
  const scan = (code) => [...code.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[^\n;]*history\.json/g)].map((match) => match[1])
    .some((name) => new RegExp(`(?<![\\w$.])${name}\\??\\.rows\\b`).test(code));
  check('v59.70 R2 replay: `Array.isArray(history) ? history : history.rows` after a history.json read fails', scan("const history = readHistoryRows(JSON.parse(readFileSync('../public-data/history.json')));\nconst rows = Array.isArray(history) ? history : history.rows || [];"));
  check('v59.70 R2 replay: rows straight from readHistoryRows pass', !scan("const rows = readHistoryRows(JSON.parse(readFileSync('../public-data/history.json')));\nconst n = rows.length;"));
}
check('v59.70 R2 the reader scan found the known readers (producers, gates, the browser loader)', readers.length >= 15 && readers.includes('js/aio-data.js') && readers.includes('scripts/producer/history.mjs'), readers.join(', '));

// (2) Both shapes read the same rows; the compact file round-trips exactly.
const published = JSON.parse(fs.readFileSync(path.join(root, 'public-data/history.json'), 'utf8'));
const rows = readHistoryRows(published);
check('v59.70 R2 the published history has rows', Array.isArray(rows) && rows.length > 100, String(rows?.length));
const v2 = compactHistoryRows(rows);
check('v59.70 R2 the compact shape is history.v2 with a field dictionary', v2.schemaVersion === HISTORY_SCHEMA_V2 && Object.keys(v2.fieldDictionary).length > 10);
check('v59.70 R2 history.v2 expands back to the exact v1 rows', isDeepStrictEqual(readHistoryRows(JSON.parse(JSON.stringify(v2))), rows));
check('v59.70 R2 a v1 array is read as it is', readHistoryRows(rows) === rows);
check('v59.70 R2 an unknown shape is no rows, not a guess', readHistoryRows({ rows }).length === 0 && readHistoryRows(null).length === 0);
const v1Bytes = JSON.stringify(rows).length; const v2Bytes = JSON.stringify(v2).length;
check('v59.70 R2 the compact shape is at least 25% smaller', v2Bytes < v1Bytes * 0.75, `${v1Bytes} → ${v2Bytes}`);
const lastMeta = v2.rows.at(-1)?.fieldMeta?.spx || {};
check('v59.70 R2 a field keeps one checkedAt instead of fetchedAt + lastSuccessfulAt when they agree', 'checkedAt' in lastMeta && !('fetchedAt' in lastMeta) && !('lastSuccessfulAt' in lastMeta) && 'observedAt' in lastMeta, JSON.stringify(lastMeta));
{
  const differs = [{ date: '2026-11-02', spx: 1, fieldMeta: { spx: { observedAt: 'a', fetchedAt: 'b', lastSuccessfulAt: 'c', source: 's', sourceKind: 'k', allowedUse: 'u' } } },
    { date: '2026-11-03', spx: 2, fieldMeta: { spx: { observedAt: 'd', fetchedAt: 'e', lastSuccessfulAt: 'e', sourceKind: 'k', allowedUse: 'v' } } }];
  check('v59.70 R2 a row that differs from the dictionary (or lacks a key) round-trips', isDeepStrictEqual(readHistoryRows(compactHistoryRows(differs)), differs));
}

if (failures.length) {
  console.error(`History access FAIL (${failures.length})`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`History access OK: ${readers.length} reader(s) expand through readHistoryRows; history.v2 ${v1Bytes} → ${v2Bytes} bytes, exact round trip.`);
