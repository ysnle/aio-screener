import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const failures = [];
const check = (label, condition) => {
  if (!condition) failures.push(label);
};

const core = read('js/aio-core.js');
const ui = read('js/aio-ui.js');
const data = read('js/aio-data.js');
const chat = read('js/aio-chat.js');
const glossary = read('js/aio-glossary.js');
const tests = read('js/aio-tests.js');
const html = read('index.html');

const routeBlock = core.match(/var ROUTE_PAGE_IDS = \[([\s\S]*?)\];/);
const routeIds = routeBlock ? [...routeBlock[1].matchAll(/'([^']+)'/g)].map((match) => match[1]) : [];
const expectedMatch = core.match(/expectedRoutePageCount:\s*(\d+)/);
const expectedCount = expectedMatch ? Number(expectedMatch[1]) : NaN;

check('ROUTE_PAGE_IDS must be readable', routeIds.length > 0);
check('route count must match expectedRoutePageCount', routeIds.length === expectedCount);
check('deployment gate must compare against expectedRoutePageCount', /contracts\.routePageCount !== expectedRoutePageCount/.test(core));
check('legacy hardcoded 21-page gate must be absent', !/routePageCount !== 21|21-page contract\/profile/.test(core));
check('T743 must assert route-count equality', /routePageCount === gate\.pageContracts\.expectedRoutePageCount/.test(tests));

check('KST formatter must use Asia/Seoul', /function _aioGetKstDateParts[\s\S]*timeZone:\s*'Asia\/Seoul'/.test(ui));
check(
  'KST formatter must be declared before every call site',
  ui.indexOf('function _aioGetKstDateParts') >= 0
    && ui.indexOf('function _aioGetKstDateParts') < ui.indexOf('_aioGetKstDateParts(new Date())')
);
check('date label must not use shifted Date.getDay()', !/kst\.getDay\(\)/.test(ui));
check('home date bootstrap must use KST formatter', /todayDisp = _aioGetKstDateParts/.test(ui));

check('KOSPI previous-close sink must exist', /data-live-prev-close="\^KS11"/.test(html));
check('KOSDAQ previous-close sink must exist', /data-live-prev-close="\^KQ11"/.test(html));
check('KOSDAQ snapshot previous-close mapping must exist', /'kosdaq-prev':\s+_snap\.localeFull\(S\.kosdaqPrev\)/.test(core));
check('KR change sink must preserve date-reference child', /data-live-kr-change="\^KS11"/.test(html));
check('quote pipeline must update previous-close sinks', /data-live-prev-close/.test(data) && /previousClose\.toLocaleString/.test(data));
check('KR change sink must derive delta from the same price and previous close', /atomicDelta = price - previousClose/.test(data));
check('T823 KST/KR regression test must exist', /T823 v5056_kst_kr_index_contract/.test(tests));
check('T823 must validate numeric KR index consistency', /expectedDelta823 = price823 - prev823/.test(tests));
check('official NFP/CPI schedule must replace mechanical monthly dates', /'us-nfp': \['2026-06-05', '2026-07-02'\]/.test(core) && /'us-cpi': \['2026-06-10', '2026-07-14'\]/.test(core));
check('macro page must expose the next official release', /id="macro-next-release"/.test(html) && /renderMacroNextRelease/.test(core));
check('VVIX live snapshot and fallback mirror must update together', /DATA_SNAPSHOT\._fallback\.vvix = price/.test(data));
check('known KR ticker mappings must be corrected', /sym:'011200\.KS', name:'HMM'/.test(data) && /sym:'041510\.KQ', name:'SM엔터테인먼트'/.test(data) && /'403870\.KQ': \{ en: 'HPSP'/.test(core));
check('known KR ticker mapping regressions must be absent', !/sym:'011200\.KS', name:'HJ중공업'|sym:'041510\.KS'|'403870\.KQ': \{ en: 'HJ Sci'/.test(data + core));
check('KR composite cards must keep live bindings on value children', !/class="kr-(?:etf|screen)-card"[^>]*data-live-price=/.test(html));
check('KR composite cards must expose stable symbol ownership', /class="kr-etf-card" data-live-symbol=/.test(html) && /class="kr-screen-card" data-live-symbol=/.test(html));
check('dynamic KR theme pills must keep live bindings on value children', /class="kr-ticker-pill" data-live-symbol=/.test(html) && !/class="kr-ticker-pill" data-live-price=/.test(html));
check('KRW-denominated equity prices must use a KR-specific sanity range', /if \(\/\\\.\(KS\|KQ\)\$\/\.test\(sym\)\) return \[1, 10000000\]/.test(core));
check('reference-only unavailable values must warn rather than block deployment', /truth-blocked-reference-only[\s\S]*status: row\.operationalUse === 'reference-only' \? 'warn' : 'block'/.test(core));
check('text audit must distinguish ratios and MA periods from calendar dates', /var slashFormula =/.test(core) && /!slashFormula &&/.test(core));
check('long news refresh must switch to an honest background status', /백그라운드 갱신/.test(data) && /Date\.now\(\) - _fetchStartTime > 12000/.test(data));

// R280 (P605): index.html and the js/*.js modules are all classic (non-module) <script>s sharing
// one global scope. A top-level `function name(){}`/`async function name(){}` declared in more
// than one of these files silently loses all but the last-to-execute definition — no error, no
// warning, and (per <script defer> spec ordering) the external module always wins over an inline
// index.html block, regardless of which copy looks more current in the source. P605 found exactly
// this for `fetchKrDynamicData` (index.html's 6-fetcher version silently overridden by
// js/aio-data.js's unrelated 3-fetcher version, since ~v51.08) and it went undetected for dozens of
// versions. This check makes that whole hazard class mechanically unrepeatable instead of relying on
// a human to grep before adding a new top-level function.
const RUNTIME_SCRIPT_FILES = {
  'index.html': html,
  'js/aio-core.js': core,
  'js/aio-data.js': data,
  'js/aio-ui.js': ui,
  'js/aio-chat.js': chat,
  'js/aio-glossary.js': glossary,
};
// Column-0-anchored on purpose: only true top-level declarations share the global scope this way.
// Functions nested inside an IIFE/closure (indented, not column 0) are scoped to that closure and
// cannot collide with another file's global, so they must not trip this check.
const TOP_LEVEL_FN_RE = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
// P605 follow-up (v52.19) removed index.html's dead `fetchKrDynamicData` copy and judged the 5
// orphaned KR fetchers it alone called — zero cross-file shadows remain as of that cleanup.
// Add future confirmed-intentional exceptions here only after they're actually verified (the
// second check below fails loudly if an entry here turns out not to be shadowed at all).
const KNOWN_SHADOW_ALLOWLIST = new Set([]);

const fnOwners = new Map();
for (const [file, src] of Object.entries(RUNTIME_SCRIPT_FILES)) {
  const namesInFile = new Set();
  for (const m of src.matchAll(TOP_LEVEL_FN_RE)) namesInFile.add(m[1]);
  for (const name of namesInFile) {
    if (!fnOwners.has(name)) fnOwners.set(name, []);
    fnOwners.get(name).push(file);
  }
}
const shadowed = [...fnOwners.entries()].filter(([name, files]) => files.length > 1 && !KNOWN_SHADOW_ALLOWLIST.has(name));

check(
  'no top-level function name may be declared in more than one runtime <script> file (R280)'
    + (shadowed.length ? ': ' + shadowed.map(([name, files]) => `${name} in [${files.join(', ')}]`).join('; ') : ''),
  shadowed.length === 0
);
check(
  'R280 allowlist must only contain names that are actually still shadowed',
  [...KNOWN_SHADOW_ALLOWLIST].every((name) => (fnOwners.get(name) || []).length > 1)
);

if (failures.length) {
  console.error('Structural regression check failed:');
  failures.forEach((failure) => console.error(' - ' + failure));
  process.exit(1);
}

console.log(`Structural regression check OK: ${routeIds.length} internal routes (19 primary + 2 derived + 1 reference; glossary overlay separate), KST date contract, KR previous-close contract.`);
