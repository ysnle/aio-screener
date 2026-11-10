// One definition of the Pages deploy bundle, shared by the deploy step (scripts/build-pages-bundle.mjs) and the
// boot-budget gate (scripts/ci-boot-bundle-budget-check.mjs), so the gate measures exactly what ships.
import fs from 'node:fs';
import path from 'node:path';
export const GLOBAL_SCRIPTS = ['aio-workspace', 'aio-kr-data', 'aio-pages', 'aio-core', 'aio-data', 'aio-ui', 'aio-chat', 'aio-glossary'].map((name) => `js/${name}.js`);
// v59.70 (2nd batch A, P0): the classic scripts index.html runs at boot. js/aio-chat.js loads with the AI panel
// (src/app/chat-loader.js), so it ships but is not part of the boot budget.
export const CLASSIC_BOOT_SCRIPTS = GLOBAL_SCRIPTS.filter((file) => file !== 'js/aio-chat.js');
// The files .github/workflows/pages-deploy.yml copies into the Pages artifact (its "Stage explicit public artifact
// allowlist" step) and the public-data paths it leaves out. ci-boot-bundle-budget-check.mjs fails when the workflow and
// these lists differ, so a measurement staged from them is the deploy's layout.
export const PAGES_ROOT_FILES = ['index.html', 'sw.js', 'version.json', 'og-image.svg', 'robots.txt', 'sitemap.xml', 'public-artifact-manifest.json', 'public-config.json', '_headers'];
export const PAGES_DATA_EXCLUDES = ['sec-fundamentals.json', 'sec-fundamentals-extended.json', 'telegram-observed.json', 'screener-extended-universe.json', 'score-backtest-history.json', 'score-backtest-longrun.json', 'operations-slo-window.json', 'telegram-reference-window.json', 'masters/holdings.json', 'masters/history-holdings.json', 'masters/issuer-aggregates.json', 'masters/managers/', 'masters/managers-store.json', 'knowledge/research-dossiers.json', 'knowledge/research-dossiers/', 'knowledge/coverage-matrix.json', 'knowledge/integrated-market-ai-frameworks.json', 'masters/cusip-ticker-map.json', 'knowledge/domain-dossiers.json', 'knowledge/domain-dossiers/', 'knowledge/learning-graph.json', 'knowledge/research-facts.json', 'knowledge/research-source-seeds.json'];

// Copies the deploy's code layout (root files, the classic scripts, src/) into `dest`, ready for build-pages-bundle.mjs.
// public-data is left out on purpose: a measurement serves it from the repository (or a fixture overlay) instead of
// copying ~100 MB per run.
export function stagePagesCode(repoRoot, dest) {
  fs.mkdirSync(path.join(dest, 'js'), { recursive: true });
  for (const file of PAGES_ROOT_FILES) {
    const from = path.join(repoRoot, file);
    if (fs.existsSync(from)) fs.copyFileSync(from, path.join(dest, file));
  }
  for (const file of GLOBAL_SCRIPTS) fs.copyFileSync(path.join(repoRoot, file), path.join(dest, file));
  fs.cpSync(path.join(repoRoot, 'src'), path.join(dest, 'src'), { recursive: true });
  return dest;
}
export const ESM_ENTRY = 'src/app/bootstrap.js';
// index.html links one stylesheet; it @imports the rest of src/ui/styles. Shipped as is, the browser finds those
// imports only after the first file arrives (a second round trip before the page can paint); the deploy inlines them.
export const STYLE_ENTRY = 'src/ui/styles/responsive.css';
// Classic scripts already require ES2020 (optional chaining); the module graph already requires ES2021 (||=).
// Pinning the targets keeps the minifier from introducing newer syntax than the source ships today.
export const GLOBAL_TARGET = 'es2020';
export const ESM_TARGET = 'es2021';

export function esmBundleOptions({ absWorkingDir, outdir }) {
  return {
    absWorkingDir,
    entryPoints: { 'app/bootstrap': ESM_ENTRY },
    outdir,
    bundle: true,
    splitting: true,
    format: 'esm',
    minify: true,
    charset: 'utf8',
    legalComments: 'none',
    target: ESM_TARGET,
    chunkNames: 'chunks/[name]-[hash]',
    metafile: true,
    logLevel: 'error'
  };
}

// Output files the entry reaches through static imports: the set the browser fetches before first paint. Lazy
// page chunks (dynamic import()) load on navigation and are excluded. Paths are metafile output keys.
export function bootOutputs(metafile) {
  const outputs = metafile.outputs;
  const entry = Object.keys(outputs).find((file) => outputs[file].entryPoint === ESM_ENTRY);
  if (!entry) throw new Error(`metafile has no output for ${ESM_ENTRY}`);
  const seen = new Set();
  const queue = [entry];
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const item of outputs[file]?.imports || []) if (item.kind === 'import-statement') queue.push(item.path);
  }
  return [...seen];
}

export function styleBundleOptions({ absWorkingDir, outfile }) {
  return {
    absWorkingDir,
    entryPoints: [STYLE_ENTRY],
    outfile,
    bundle: true,
    minify: true,
    charset: 'utf8',
    legalComments: 'none',
    metafile: true,
    logLevel: 'error'
  };
}
