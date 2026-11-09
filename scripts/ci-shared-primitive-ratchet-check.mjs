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
// v59.87 (ADR-0003 S0, layered single owner): three more copies the 2026-11-09 audit found are held here:
//   localEscape    — a local `esc`/`escHtml`/`escapeHtml` definition in src/ (8 found); the canonical escape is
//                    src/ui/html.js once it exists. An alias (`const esc = escHtml;`) is not a copy.
//   localIndicator — a local SMA/EMA/RSI definition (`function sma…(`, `const rsi… = (…) =>`) in src/ outside
//                    src/domain/technical/definitions.js, the canonical indicator owner.
//   publicDataPath — a './public-data/' path literal in src/domain, src/ui or src/ai. Artifact locations belong to
//                    src/data; screens and AI ask the data layer for an artifact instead of naming its file.
// ci-architecture-contract-check already forbids fetch/storage in those layers outright; these three only shrink.
//
// v59.87 (ADR-0003 S2+S3, data boundary): two more, so the registry and the session rule stay the only owners:
//   dataPathLiteral — a './public-data/' literal in src/data or src/app outside src/data/artifact-registry.js (the one
//                     table of artifact locations and load budgets; readers use artifactUrl/loadArtifact or a descriptor).
//   sessionBranch   — a `… ? latestCompletedKrSession(…) : latestCompletedUsSession(…)` market branch anywhere in src/;
//                     latestCompletedSession(market, now) in src/domain/market/market-calendar.js is the one branch.
//
// v59.88 (ADR-0003 S4, verdicts in domain): one more, so screens and the AI stop judging by their own lines:
//   verdictLiteral  — in src/ui and src/ai, a comparison against a numeric literal other than 0 and ±1 (`pct > 40`,
//                     `rsi >= 70`, `share > 0.25`), unless the left side is a length/size/width/height/count/index. Such a
//                     number is a threshold the screen or the AI applies itself; the line belongs in
//                     src/domain/rules/thresholds.js (or the domain reading that owns it) and the screen renders the result.
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
const ESCAPE_RE = /^\s*(?:export\s+)?(?:function\s+(?:esc|escHtml|escapeHtml|escapeHTML)\s*\(|const\s+(?:esc|escHtml|escapeHtml|escapeHTML)\s*=\s*(?:\(|[A-Za-z_]\w*\s*=>|function\b))/gm;
const INDICATOR_RE = /^\s*(?:export\s+)?(?:function\s+(?:rsi|sma|ema)(?:[A-Z]\w*)?\s*\(|const\s+(?:rsi|sma|ema)(?:[A-Z]\w*)?\s*=\s*(?:\(|[A-Za-z_]\w*\s*=>|function\b))/gm;
const PUBLIC_DATA_RE = /['"`]\.\/public-data\//g;
const VERDICT_LITERAL_RE = /(?<!(?:length|size|[wW]idth|[hH]eight|[cC]ount|[iI]ndex)\)?\s*)(?<![=<>!])[<>]=?\s*-?(?:\d*\.\d+|[2-9]|\d{2,})(?![\w.])/g;
const SESSION_BRANCH_RE = /latestCompletedKrSession\([^()]*(?:\([^()]*\))?[^()]*\)(?:\?\.date)?\s*:\s*(?:market\s*===\s*'US'\s*\?\s*)?latestCompletedUsSession\(/g;
const REGISTRY_OWNER = 'src/data/artifact-registry.js';
const SESSION_OWNER = 'src/domain/market/market-calendar.js';
const METRICS = ['localFinite', 'dateRegex', 'rawRowRead', 'nullAsZero', 'localEscape', 'localIndicator', 'publicDataPath', 'dataPathLiteral', 'sessionBranch', 'verdictLiteral'];
const VERDICT_SCOPES = ['src/ui/', 'src/ai/'];
const METRIC_WORDS = { localEscape: 'local HTML escape copies', localIndicator: 'local SMA/EMA/RSI copies', publicDataPath: "'./public-data/' literals", dataPathLiteral: "'./public-data/' literals outside the artifact registry", sessionBranch: 'KR/US latest-session branches', verdictLiteral: 'threshold comparisons against numeric literals' };
const METRIC_REMEDY = {
  localEscape: 'import the shared escape (src/ui/html.js; legacy escHtml until it lands) instead of defining esc',
  localIndicator: 'import smaSeries/emaSeries/rsiWilder from src/domain/technical/definitions.js',
  publicDataPath: 'request the artifact through src/data (loader descriptor owned there), not by path',
  dataPathLiteral: 'register the file in src/data/artifact-registry.js and read artifactUrl(id) / loadArtifact(root, id)',
  sessionBranch: 'call latestCompletedSession(market, now) from src/domain/market/market-calendar.js',
  verdictLiteral: 'put the line in src/domain/rules/thresholds.js or the domain reading that owns it, and render its result',
};
const INDICATOR_OWNER = 'src/domain/technical/definitions.js';
const ESCAPE_OWNER = 'src/ui/html.js';
const SCOPES = ['src', 'scripts'];
const scopeOf = (file) => file.split('/')[0];
const ROW_READ_SCOPES = ['src/domain/', 'src/ui/', 'src/ai/'];
const { SCREENER_FIELD_REGISTRY } = await import(pathToFileURL(join(root, 'src/data/contracts/screener.js')).href);
const ROW_KEYS = [...new Set(SCREENER_FIELD_REGISTRY.fields.filter((field) => field.type === 'number' && field.rowKey).map((field) => field.rowKey))];
const ROW_READ_RE = new RegExp(String.raw`\b(?:row|r|member|stock|item|entry)\??\.(?:${ROW_KEYS.join('|')})\b`, 'g');

export function countCopies(source, { rowReads = true, layered = rowReads, src = true, indicatorOwner = false, escapeOwner = false, dataLayer = false, sessionOwner = false, verdictScope = false } = {}) {
  const text = String(source);
  const n = (re) => (text.match(re) || []).length;
  return {
    localFinite: n(FINITE_RE), dateRegex: n(DATE_RE), rawRowRead: rowReads ? n(ROW_READ_RE) : 0, nullAsZero: n(NULL_AS_ZERO_RE),
    localEscape: src && !escapeOwner ? n(ESCAPE_RE) : 0,
    localIndicator: src && !indicatorOwner ? n(INDICATOR_RE) : 0,
    publicDataPath: layered ? n(PUBLIC_DATA_RE) : 0,
    dataPathLiteral: dataLayer ? n(PUBLIC_DATA_RE) : 0,
    sessionBranch: src && !sessionOwner ? n(SESSION_BRANCH_RE) : 0,
    verdictLiteral: verdictScope ? n(VERDICT_LITERAL_RE) : 0,
  };
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
    const layered = ROW_READ_SCOPES.some((scope) => file.startsWith(scope));
    const dataLayer = (file.startsWith('src/data/') || file.startsWith('src/app/')) && file !== REGISTRY_OWNER;
    const result = countCopies(readFileSync(join(root, file), 'utf8'), { rowReads: layered, layered, src: file.startsWith('src/'), indicatorOwner: file === INDICATOR_OWNER, escapeOwner: file === ESCAPE_OWNER, dataLayer, sessionOwner: file === SESSION_OWNER, verdictScope: VERDICT_SCOPES.some((scope) => file.startsWith(scope)) });
    if (METRICS.some((metric) => result[metric])) counts[file] = result;
  }
  return counts;
}

export function compareToBaseline(counts, baseline) {
  const failures = [];
  for (const [file, now] of Object.entries(counts)) {
    const allowed = { ...Object.fromEntries(METRICS.map((metric) => [metric, 0])), ...(baseline[file] || {}) };
    if ((now.nullAsZero || 0) > allowed.nullAsZero) failures.push(`${file}: Number.isFinite(Number(x)) grew ${allowed.nullAsZero} → ${now.nullAsZero} — it reads null and '' as 0; use isFiniteNumber/readNumber from src/domain/shared/number.js`);
    if (now.rawRowRead > allowed.rawRowRead) failures.push(`${file}: raw screener row reads grew ${allowed.rawRowRead} → ${now.rawRowRead} — call readRowNumber(row, key, purpose) from src/data/contracts/screener.js`);
    if (now.localFinite > allowed.localFinite) failures.push(`${file}: local finite copies grew ${allowed.localFinite} → ${now.localFinite} — import finiteNumber/readNumber from src/domain/shared/number.js`);
    if (now.dateRegex > allowed.dateRegex) failures.push(`${file}: date regex copies grew ${allowed.dateRegex} → ${now.dateRegex} — use isoDay/stampDay/latestSessionRows from src/domain/shared/session-date.js`);
    for (const metric of Object.keys(METRIC_WORDS)) {
      if ((now[metric] || 0) > allowed[metric]) failures.push(`${file}: ${METRIC_WORDS[metric]} grew ${allowed[metric]} → ${now[metric]} — ${METRIC_REMEDY[metric]}`);
    }
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
    'const esc = (value) => String(value);',
    'const escHtml = root.escHtml;',
    'function smaOf(values, n) { return values; }',
    'const ema = emaSeries;',
    'const small = (text) => text;',
    "const URL = './public-data/history.json';",
  ].join('\n'));
  const selfTest = [
    probe.localFinite === 3 && probe.dateRegex === 1 && probe.rawRowRead === 2 && probe.nullAsZero === 1,
    probe.localEscape === 1 && probe.localIndicator === 1 && probe.publicDataPath === 1,
    countCopies('function rsiWilder(c) {}', { indicatorOwner: true }).localIndicator === 0,
    countCopies("const u = './public-data/x.json';", { rowReads: false, layered: false }).publicDataPath === 0,
    countCopies("const u = './public-data/x.json';", { rowReads: false, layered: false, dataLayer: true }).dataPathLiteral === 1,
    countCopies("const a = market === 'KR' ? latestCompletedKrSession(now) : latestCompletedUsSession(now, { requirePrevious: false });\nconst b = (market === 'KR' ? latestCompletedKrSession(Number(now))?.date : latestCompletedUsSession(Number(now)))?.date;").sessionBranch === 2,
    countCopies("return isKr ? latestCompletedKrSession(now) : latestCompletedUsSession(now);", { sessionOwner: true }).sessionBranch === 0,
    countCopies("if (pct > 40 || rsi >= 70 || share > 0.25 || x <= -2) go();\nif (rows.length >= 6 || size > 3 || n > 0 || d < 1 || v >= -1) go();\nconst f = (v) => 60;", { verdictScope: true }).verdictLiteral === 4,
    countCopies('if (pct > 40) go();').verdictLiteral === 0,
    compareToBaseline({ 'src/ui/b.js': { localEscape: 1 } }, {}).length === 1,
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
      note: "Per-file counts in src/ and scripts/ (not ci-* gates or fixtures) of local finite readers, YYYY-MM-DD regex copies, Number.isFinite(Number(x)) null-as-zero checks, (src) local HTML escape and SMA/EMA/RSI copies, and (src domain/ui/ai) raw screener row field reads and './public-data/' literals, and (src ui/ai) threshold comparisons against numeric literals. Shrink only; never raise a count or add a file.",
      scopes: SCOPES,
      totals: total,
      counts,
    }, null, 2)}\n`);
    console.log(`Shared-primitive baseline written: ${Object.keys(counts).length} files, ${METRICS.map((metric) => `${metric}=${total[metric]}`).join(', ')}.`);
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
    const before = { ...Object.fromEntries(METRICS.map((metric) => [metric, 0])), ...(prior.totals || {}) };
    const shrank = METRICS.some((metric) => total[metric] < before[metric]);
    console.log(`Shared-primitive ratchet OK: ${METRICS.map((metric) => `${metric}=${total[metric]}`).join(', ')}${shrank ? ` (shrank from ${METRICS.map((metric) => before[metric]).join('/')} — run --write to lock in)` : ''}.`);
  }
}
