#!/usr/bin/env node
// scripts/ci-shared-primitive-ratchet-check.mjs — v59.46 structure pilot
//
// The ten defect classes of the v59.45 pipeline review share one cause: every module re-implemented "is this a reading"
// and "is this a session date" itself. v57.60 moved `finite` into src/domain/shared/number.js, yet 70 files kept or
// re-grew a local copy (some read '' or false as 0), and the YYYY-MM-DD check was copied 130+ times. Fixing each copy
// does not stop the next one, so the copies are counted per file here and may only shrink:
//   localFinite — a local `finite` definition (const finite = (…) / v => …, function finite(…)); an alias of a shared
//                 reader (`const finite = finiteFact;`) is not a copy
//   dateRegex   — a literal \d{4}-\d{2}-\d{2} pattern outside src/domain/shared/session-date.js
//   rawRowRead  — (v59.46 boundary contract) `row.<field>`, `r.<field>`, `member.<field>` … in src/domain, src/ui and
//                 src/ai for a numeric field the screener readiness registry defines (src/data/contracts/screener.js).
//                 Such a read skips fieldValueForPurpose, so a STALE, BLOCKED or rights-limited value reads as current;
//                 new code calls readRowNumber(row, key, purpose). src/data owns the rows and is not counted.
// New code imports finiteNumber / readNumber / isFiniteNumber (shared/number.js) and isoDay / isIsoDay /
// hasLeadingIsoDay / stampDay / latestSessionRows (shared/session-date.js). After the v59.46 migration src/ holds no
// local reader and only parsers (patterns that capture or strip a date inside text) plus the import-free exchange
// calendar (P1533) keep a date pattern; they are the baseline, and every other file is held at zero.
//
// v59.50 (recurrence audit 2026-10-31): P2164 found Number(null)=0 in scripts/lib after src/ reached zero copies, so the
// count also covers scripts/ (producers and their libs; CI gates and fixtures are not product code), and a fourth metric
// counts the P715 trap itself:
//   nullAsZero  — `Number.isFinite(Number(x))`, which is true for null, '' and false; use isFiniteNumber/readNumber.
// A scope the prior baseline did not scan is recorded as measured once, like a new metric.
//
// Usage:
//   node scripts/ci-shared-primitive-ratchet-check.mjs           # verify
//   node scripts/ci-shared-primitive-ratchet-check.mjs --write   # record shrinks (growth is refused)

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = 'architecture/shared-primitive-baseline.json';
const DEFINITION_FILES = new Set(['src/domain/shared/number.js', 'src/domain/shared/session-date.js']);

const FINITE_RE = /^\s*(?:export\s+)?(?:function\s+finite\s*\(|const\s+finite\s*=\s*(?:\(|[A-Za-z_]\w*\s*=>))/gm;
const DATE_RE = /\\d\{4\}-\\d\{2\}-\\d\{2\}/g;
const NULL_AS_ZERO_RE = /Number\.isFinite\(Number\(/g;
const METRICS = ['localFinite', 'dateRegex', 'rawRowRead', 'nullAsZero'];
const SCOPES = ['src', 'scripts'];
const scopeOf = (file) => file.split('/')[0];
const ROW_READ_SCOPES = ['src/domain/', 'src/ui/', 'src/ai/'];
const { SCREENER_FIELD_REGISTRY } = await import(pathToFileURL(join(root, 'src/data/contracts/screener.js')).href);
const ROW_KEYS = [...new Set(SCREENER_FIELD_REGISTRY.fields.filter((field) => field.type === 'number' && field.rowKey).map((field) => field.rowKey))];
const ROW_READ_RE = new RegExp(String.raw`\b(?:row|r|member|stock|item|entry)\??\.(?:${ROW_KEYS.join('|')})\b`, 'g');

export function countCopies(source, { rowReads = true } = {}) {
  const text = String(source);
  return { localFinite: (text.match(FINITE_RE) || []).length, dateRegex: (text.match(DATE_RE) || []).length, rawRowRead: rowReads ? (text.match(ROW_READ_RE) || []).length : 0, nullAsZero: (text.match(NULL_AS_ZERO_RE) || []).length };
}

function productFiles() {
  const walk = (dir) => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return walk(path);
    return /\.m?js$/.test(entry.name) ? [path] : [];
  });
  const scripts = walk('scripts').filter((file) => !file.startsWith('scripts/fixtures/') && !/^scripts\/ci-[^/]+$/.test(file));
  return [...walk('src'), ...scripts].filter((file) => !DEFINITION_FILES.has(file)).sort();
}

function measure() {
  const counts = {};
  for (const file of productFiles()) {
    const result = countCopies(readFileSync(join(root, file), 'utf8'), { rowReads: ROW_READ_SCOPES.some((scope) => file.startsWith(scope)) });
    if (METRICS.some((metric) => result[metric])) counts[file] = result;
  }
  return counts;
}

export function compareToBaseline(counts, baseline) {
  const failures = [];
  for (const [file, now] of Object.entries(counts)) {
    const allowed = { localFinite: 0, dateRegex: 0, rawRowRead: 0, nullAsZero: 0, ...(baseline[file] || {}) };
    if ((now.nullAsZero || 0) > allowed.nullAsZero) failures.push(`${file}: Number.isFinite(Number(x)) grew ${allowed.nullAsZero} → ${now.nullAsZero} — it reads null and '' as 0; use isFiniteNumber/readNumber from src/domain/shared/number.js`);
    if (now.rawRowRead > allowed.rawRowRead) failures.push(`${file}: raw screener row reads grew ${allowed.rawRowRead} → ${now.rawRowRead} — call readRowNumber(row, key, purpose) from src/data/contracts/screener.js`);
    if (now.localFinite > allowed.localFinite) failures.push(`${file}: local finite copies grew ${allowed.localFinite} → ${now.localFinite} — import finiteNumber/readNumber from src/domain/shared/number.js`);
    if (now.dateRegex > allowed.dateRegex) failures.push(`${file}: date regex copies grew ${allowed.dateRegex} → ${now.dateRegex} — use isoDay/stampDay/latestSessionRows from src/domain/shared/session-date.js`);
  }
  return failures;
}

const totals = (counts) => Object.fromEntries(METRICS.map((metric) => [metric, Object.values(counts).reduce((sum, item) => sum + (item[metric] || 0), 0)]));

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const probe = countCopies([
    'const finite = (value) => (value == null ? null : Number(value));',
    '  function finite(value) { return value; }',
    'const finite = v => v;',
    'const finite = finiteFact;',
    String.raw`if (/^\d{4}-\d{2}-\d{2}$/.test(x)) return x;`,
    'const a = row.ret1m + row?.pctSma50 + quote.price + readRowNumber(row, "ret3m");',
    'if (Number.isFinite(Number(value.changePct))) keep(value);',
  ].join('\n'));
  const selfTest = [
    probe.localFinite === 3 && probe.dateRegex === 1 && probe.rawRowRead === 2 && probe.nullAsZero === 1,
    compareToBaseline({ 'scripts/lib/a.mjs': { localFinite: 0, dateRegex: 0, rawRowRead: 0, nullAsZero: 1 } }, {}).length === 1,
    compareToBaseline({ 'src/ui/a.js': { localFinite: 0, dateRegex: 0, rawRowRead: 3 } }, { 'src/ui/a.js': { localFinite: 0, dateRegex: 0, rawRowRead: 2 } }).length === 1,
    compareToBaseline({ 'src/a.js': { localFinite: 2, dateRegex: 0 } }, { 'src/a.js': { localFinite: 1, dateRegex: 0 } }).length === 1,
    compareToBaseline({ 'src/a.js': { localFinite: 1, dateRegex: 1 } }, { 'src/a.js': { localFinite: 1, dateRegex: 2 } }).length === 0,
    compareToBaseline({ 'src/new.js': { localFinite: 0, dateRegex: 1 } }, {}).length === 1,
  ];
  if (selfTest.includes(false)) {
    console.error(`FAIL shared-primitive ratchet self-test: ${JSON.stringify(selfTest)}`);
    process.exit(1);
  }
  const counts = measure();
  const total = totals(counts);
  const prior = existsSync(join(root, BASELINE_PATH)) ? JSON.parse(readFileSync(join(root, BASELINE_PATH), 'utf8')) : null;
  if (process.argv.includes('--write')) {
    // A metric the prior baseline never recorded (rawRowRead before v59.46) is recorded as measured, once.
    const unrecorded = METRICS.filter((metric) => prior && prior.totals?.[metric] === undefined);
    const priorScopes = prior?.scopes || ['src'];
    const priorCounts = Object.fromEntries(Object.keys({ ...(prior?.counts || {}), ...counts }).map((file) => [file, priorScopes.includes(scopeOf(file))
      ? { ...(prior?.counts?.[file] || {}), ...Object.fromEntries(unrecorded.map((metric) => [metric, counts[file]?.[metric] || 0])) }
      : { ...(counts[file] || {}) }]));
    const growth = prior ? compareToBaseline(counts, priorCounts) : compareToBaseline(counts, counts);
    if (growth.length) {
      for (const line of growth) console.error(`REFUSED ${line}`);
      console.error('Refusing to record growth; --write records shrinks only.');
      process.exit(1);
    }
    writeFileSync(join(root, BASELINE_PATH), `${JSON.stringify({
      schemaVersion: 'aio-shared-primitive-baseline.v1',
      generatedBy: relative(root, fileURLToPath(import.meta.url)).split('\\').join('/'),
      note: 'Per-file counts in src/ and scripts/ (not ci-* gates or fixtures) of local finite readers, YYYY-MM-DD regex copies, Number.isFinite(Number(x)) null-as-zero checks and (src domain/ui/ai) raw screener row field reads. Shrink only; never raise a count or add a file.',
      scopes: SCOPES,
      totals: total,
      counts,
    }, null, 2)}\n`);
    console.log(`Shared-primitive baseline written: ${Object.keys(counts).length} files, ${total.localFinite} local finite, ${total.dateRegex} date regex, ${total.rawRowRead} raw row reads, ${total.nullAsZero} null-as-zero.`);
  } else {
    if (!prior) {
      console.error(`FAIL ${BASELINE_PATH} missing — run with --write once.`);
      process.exit(1);
    }
    const failures = compareToBaseline(counts, prior.counts || {});
    if (failures.length) {
      for (const failure of failures) console.error(`FAIL ${failure}`);
      process.exit(1);
    }
    const before = { localFinite: 0, dateRegex: 0, rawRowRead: 0, nullAsZero: 0, ...(prior.totals || {}) };
    const shrank = METRICS.some((metric) => total[metric] < before[metric]);
    console.log(`Shared-primitive ratchet OK: ${total.localFinite} local finite, ${total.dateRegex} date regex, ${total.rawRowRead} raw row reads, ${total.nullAsZero} null-as-zero${shrank ? ` (shrank from ${METRICS.map((metric) => before[metric]).join('/')} — run --write to lock in)` : ''}.`);
  }
}
