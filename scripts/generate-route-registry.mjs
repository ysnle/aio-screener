// Canonical route registry generator (P1137/R623).
//
// WHY THIS EXISTS: the same 20 route ids were hand-listed in five places, in five different
// orders — `js/aio-core.js ROUTE_PAGE_IDS`, `src/app/routes.js ROUTE_IDS`,
// `architecture/route-owners.json counts.*`, `architecture/golden-routes.json routes`, and the
// `AIO_ROUTE_REGISTRY` classes. A count-only gate cannot see a reorder, so the orders silently
// diverged and every "are these the same routes?" question had a different answer depending on
// which list you read. This generator makes ONE hand-written list the source and derives the
// rest, the same way R1 keeps the seven version surfaces synchronized.
//
// SINGLE SOURCE: `js/aio-core.js` → `var ROUTE_PAGE_IDS = [...]` (the operational/nav grouping
// order; its first fifteen entries are the critical5/analysis5/workflow5 slices).
//
// GENERATED: src/app/routes.js, architecture/route-owners.json `counts`.
// CHECKED (never rewritten): golden-routes.json set, breadcrumbMap coverage, the
// AIO_ROUTE_REGISTRY class partition, and the group slices.
//
// Usage: node scripts/generate-route-registry.mjs --write | --check

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const write = (p, value) => writeFileSync(join(root, p), value, 'utf8');
const mode = process.argv.includes('--write') ? 'write' : 'check';

const core = read('js/aio-core.js');
const errors = [];
const fail = (message) => errors.push(message);

// ── 1. the single source ─────────────────────────────────────────────────────────────────────
const block = core.match(/var ROUTE_PAGE_IDS = \[([\s\S]*?)\];/);
if (!block) {
  console.error('[route-registry] canonical `var ROUTE_PAGE_IDS = [...]` not found in js/aio-core.js');
  process.exit(1);
}
const canonical = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const canonicalSet = new Set(canonical);
if (canonical.length !== canonicalSet.size) fail(`canonical list has duplicates: ${canonical.join(', ')}`);

// The three 5-route groups must stay slices, never re-listed (that re-listing is what drifted).
for (const [name, a, b] of [['CRITICAL_5', 0, 5], ['ANALYSIS_5', 5, 10], ['WORKFLOW_5', 10, 15]]) {
  if (!new RegExp(`var ${name} = ROUTE_PAGE_IDS\\.slice\\(${a}, ${b}\\);`).test(core)) {
    fail(`${name} must be derived as ROUTE_PAGE_IDS.slice(${a}, ${b}) — re-listing the ids is the drift this gate exists to stop`);
  }
}

// ── 2. the in-core registry must partition the canonical list exactly ────────────────────────
const listOf = (key) => {
  const m = core.match(new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`));
  return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : null;
};
const derivedView = listOf('DERIVED_VIEW');
const reference = listOf('REFERENCE');
const overlay = listOf('OVERLAY');
const removed = listOf('REMOVED');
if (!derivedView || !reference || !overlay || !removed) fail('AIO_ROUTE_REGISTRY classes are not readable');
if (!/classes\.NAV_ROUTE = \(window\.AIO_ALL_ROUTE_PAGE_IDS \|\| \[\]\)\.filter/.test(core)) {
  fail('NAV_ROUTE must be derived from the canonical list, not re-listed');
}
const classified = [...(derivedView || []), ...(reference || [])];
const nav = canonical.filter((id) => !classified.includes(id));
const union = [...nav, ...classified];
if (union.length !== canonical.length || new Set(union).size !== canonical.length) {
  fail(`registry classes do not partition the canonical list: ${union.join(', ')}`);
}
for (const id of [...overlay, ...removed]) {
  if (canonicalSet.has(id)) fail(`${id} is both a canonical route and a non-route class member`);
}

// ── 3. surfaces that are pinned, not rewritten ──────────────────────────────────────────────
const breadcrumb = core.match(/var breadcrumbMap = \{([\s\S]*?)\n\};/);
if (!breadcrumb) fail('var breadcrumbMap block not found');
else {
  const keys = new Set([...breadcrumb[1].matchAll(/(?:^|[\s{,])(?:'([^']+)'|([A-Za-z][\w-]*)):\s*\[/gm)].map((m) => m[1] || m[2]));
  const missing = canonical.filter((id) => !keys.has(id));
  if (missing.length) fail(`breadcrumbMap lacks a label for: ${missing.join(', ')} (the fallback renders the raw id: "AIO / ${missing[0]}")`);
  const extra = [...keys].filter((k) => !canonicalSet.has(k) && k !== 'glossary');
  if (extra.length) fail(`breadcrumbMap has non-route keys: ${extra.join(', ')}`);
}
const education = listOf('EDUCATION');
if (education) {
  const stray = education.filter((id) => id !== 'glossary' && !canonicalSet.has(id));
  if (stray.length) fail(`EDUCATION contains non-route ids: ${stray.join(', ')}`);
}
const golden = JSON.parse(read('architecture/golden-routes.json'));
const goldenSet = new Set(golden.routes);
if (goldenSet.size !== canonicalSet.size || canonical.some((id) => !goldenSet.has(id))) {
  fail('architecture/golden-routes.json routes differ from the canonical set');
}

// ── 4. generated surface: src/app/routes.js ─────────────────────────────────────────────────
const chunk = (list, per) => {
  const lines = [];
  for (let i = 0; i < list.length; i += per) lines.push('  ' + list.slice(i, i + per).map((id) => `'${id}'`).join(', '));
  return lines.join(',\n');
};
const routesJs = [
  '// GENERATED FILE — do not edit by hand (P1137/R623).',
  '// Source of truth: `var ROUTE_PAGE_IDS` in js/aio-core.js.',
  '// Regenerate: node scripts/generate-route-registry.mjs --write',
  '// Verify:     node scripts/generate-route-registry.mjs --check',
  'export const ROUTE_IDS = Object.freeze([',
  chunk(canonical, 5),
  ']);',
  '',
  'export function isRouteId(value) {',
  '  return ROUTE_IDS.includes(value);',
  '}',
  '',
].join('\n');
// Compare with line endings normalised: a Windows checkout is CRLF and a Linux CI checkout is LF,
// and a gate that only fails on one of them is a gate that lies to whoever runs it locally.
const routesJsCurrent = read('src/app/routes.js').replace(/\r\n/g, '\n');
if (routesJsCurrent !== routesJs) {
  if (mode === 'write') { write('src/app/routes.js', routesJs); console.log('[route-registry] wrote src/app/routes.js'); }
  else fail('src/app/routes.js is stale - run: node scripts/generate-route-registry.mjs --write');
}

// ── 5. generated surface: route-owners.json counts ──────────────────────────────────────────
const ownersRawIn = read('architecture/route-owners.json');
// This file is CRLF; every boundary search here is EOL-agnostic on purpose. An earlier version used
// indexOf('\n  },\n  "counts"'), which returned -1 on CRLF, silently widened the region to the whole
// tail of the file (picking up `counts` as a 21st route) and wrote a broken document.
const EOL = ownersRawIn.includes('\r\n') ? '\r\n' : '\n';
// indexOf returns the START of the header, so the opening brace must be added back explicitly —
// slicing at the raw index dropped it and closed the document one level early.
const routesHeader = '  "routes": {';
const routesRegionStart = ownersRawIn.indexOf(routesHeader) + routesHeader.length;
const regionEndMatch = /\r?\n  \},\r?\n  "counts"/.exec(ownersRawIn);
const routesRegionEnd = regionEndMatch ? regionEndMatch.index : -1;
if (routesRegionStart < 0 || routesRegionEnd <= routesRegionStart) fail('route-owners.json routes region not found');

// The `routes` object key order is load-bearing: ci-architecture-contract-check.mjs derives the
// expected counts.* array order from it. So the generator owns the key order too - otherwise the
// counts order and the key order disagree and the gate reports a drift that is really a reorder.
const region = ownersRawIn.slice(routesRegionStart, routesRegionEnd);
const keyRe = /\r?\n(\s*)"([a-z-]+)":\s*\{/g;
const blocks = [];
for (const m of region.matchAll(keyRe)) blocks.push({ id: m[2], start: m.index });
if (blocks.length !== canonical.length) fail(`route-owners.json routes region has ${blocks.length} entries, canonical has ${canonical.length}`);
const documented = blocks.map((b) => b.id);
for (const id of documented) if (!canonicalSet.has(id)) fail(`route-owners.json documents a non-canonical route: ${id}`);
const missingDocs = canonical.filter((id) => !documented.includes(id));
if (missingDocs.length) fail(`route-owners.json lacks route sections for: ${missingDocs.join(', ')}`);

let ownersRaw = ownersRawIn;
if (documented.join(',') !== canonical.join(',')) {
  if (mode === 'write') {
    // Every block is kept verbatim except for its own leading newline and its trailing comma: the
    // original last entry has no comma, so a naive move produces "}," followed by the closing "},".
    // Separators are re-emitted uniformly, which is what makes the reorder lossless.
    const byId = new Map(blocks.map((b, i) => [b.id, region.slice(b.start, i + 1 < blocks.length ? blocks[i + 1].start : region.length)
      .replace(/^\r?\n/, '').replace(/,\s*$/, '')]));
    const reordered = EOL + canonical.map((id) => byId.get(id)).join(',' + EOL);
    ownersRaw = ownersRawIn.slice(0, routesRegionStart) + reordered + ownersRawIn.slice(routesRegionEnd);
    write('architecture/route-owners.json', ownersRaw);
    console.log('[route-registry] reordered architecture/route-owners.json routes to canonical order');
  } else {
    fail('architecture/route-owners.json routes are not in canonical order - run: node scripts/generate-route-registry.mjs --write');
  }
}
const owners = JSON.parse(ownersRaw);
const routes = owners.routes || {};
const byOrder = canonical.filter((id) => routes[id]);

const withOwner = (field, value) => byOrder.filter((id) => routes[id][field] === value);
// Multi-line arrays must use the file's own EOL. Hardcoding `\n` here made `--check` report
// "counts are stale" on every Windows checkout while the content was in fact identical.
const arr = (list) => (list.length > 4
  ? `[${EOL}${list.map((id) => `      "${id}"`).join(',' + EOL)}${EOL}    ]`
  : `[${list.map((id) => `"${id}"`).join(', ')}]`);
const fullNative = byOrder.filter((id) => {
  const r = routes[id];
  const dims = ['chartOwner', 'narrativeOwner'];
  const ok = (v) => v === 'native' || v === 'not-applicable';
  return r.lifecycleOwner === 'native' && r.rendererOwner === 'native' && r.dataOwner === 'native'
    && dims.every((d) => ok(r[d])) && r.loadingStrategy === 'route-dynamic-import';
});
const counts = {
  totalRoutes: byOrder.length,
  lifecycleNative: withOwner('lifecycleOwner', 'native').length,
  rendererNative: withOwner('rendererOwner', 'native').length,
  rendererNativeRoutes: withOwner('rendererOwner', 'native'),
  rendererLegacyRoutes: withOwner('rendererOwner', 'legacy'),
  dataNative: withOwner('dataOwner', 'native').length,
  dataNativeRoutes: withOwner('dataOwner', 'native'),
  chartNative: withOwner('chartOwner', 'native').length,
  chartNativeRoutes: withOwner('chartOwner', 'native'),
  narrativeNative: withOwner('narrativeOwner', 'native').length,
  narrativeNativeRoutes: withOwner('narrativeOwner', 'native'),
  lazyLoadedRoutes: byOrder.filter((id) => routes[id].loadingStrategy === 'route-dynamic-import'),
  fullNativeOwner: fullNative,
};
const countsText = '  "counts": {' + EOL + Object.entries(counts).map(([k, v]) => typeof v === 'number'
  ? `    "${k}": ${v}`
  : `    "${k}": ${arr(v)}`).join(',' + EOL) + EOL + '  },';
const start = ownersRaw.indexOf('  "counts": {');
const endMatch = /\r?\n  \},/.exec(ownersRaw.slice(start));
const end = endMatch ? start + endMatch.index + endMatch[0].length : -1;
if (start < 0 || end <= start) fail('route-owners.json counts block not found');
else {
  const ownersNext = ownersRaw.slice(0, start) + countsText + ownersRaw.slice(end);
  if (ownersNext !== ownersRaw) {
    if (mode === 'write') { write('architecture/route-owners.json', ownersNext); console.log('[route-registry] wrote architecture/route-owners.json counts'); }
    else fail('architecture/route-owners.json counts are stale - run: node scripts/generate-route-registry.mjs --write');
  }
}

if (errors.length) {
  console.error(`Route registry single-source check failed (${errors.length})`);
  errors.forEach((e) => console.error(` - ${e}`));
  process.exit(1);
}
console.log(`Route registry single-source OK: ${canonical.length} canonical routes, ${nav.length} nav / ${classified.length} derived+reference / ${overlay.length} overlay / ${removed.length} removed; generated surfaces in sync (${mode}).`);
