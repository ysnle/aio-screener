// Pages deploy-time bundle/minify step. It rewrites a staged Pages directory in place and never touches the
// repository layout: CI, local serving and every source gate keep reading the unbundled js/ and src/ files.
//
//   node scripts/build-pages-bundle.mjs <staged-pages-dir> [--manifest <out.json>]
//
// - js/aio-*.js classic scripts: each file is minified on its own (no bundling, no format wrapper), so their
//   shared global scope, defer order and every top-level name stay exactly as authored. The build fails if any
//   top-level function name of the source is missing from the output.
// - src/: one ESM bundle from src/app/bootstrap.js with code splitting, so the lazy-page import() calls become
//   hashed chunks under src/chunks/. The entry keeps its path (index.html and sw.js name it). Every other src/**/*.js
//   is removed from the staged copy: no browser code path reaches them (they serve Node CI scripts and the
//   undeployed test harness). src/**/*.css is left as is.
// - The manifest records the sha256 of every rewritten JS file plus index.html, so the live invariant check can
//   prove the served bytes are exactly this build (R280 live re-check; the cross-file name scan cannot read
//   minified files).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import * as esbuild from 'esbuild';

const GLOBAL_SCRIPTS = ['aio-workspace', 'aio-kr-data', 'aio-pages', 'aio-core', 'aio-data', 'aio-ui', 'aio-chat', 'aio-glossary'].map((name) => `js/${name}.js`);
const ESM_ENTRY = 'src/app/bootstrap.js';
// Classic scripts already require ES2020 (optional chaining); the module graph already requires ES2021 (||=).
// Pinning the targets keeps the minifier from introducing newer syntax than the source ships today.
const GLOBAL_TARGET = 'es2020';
const ESM_TARGET = 'es2021';
const TOP_LEVEL_FN_RE = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm;

const args = process.argv.slice(2);
const distArg = args.find((value) => !value.startsWith('--'));
const manifestIndex = args.indexOf('--manifest');
const manifestPath = manifestIndex >= 0 ? args[manifestIndex + 1] : null;
if (!distArg) {
  console.error('usage: node scripts/build-pages-bundle.mjs <staged-pages-dir> [--manifest <out.json>]');
  process.exit(2);
}
const dist = path.resolve(distArg);
const rel = (file) => path.relative(dist, file).split(path.sep).join('/');
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const gzipSize = (buffer) => zlib.gzipSync(buffer, { level: 9 }).length;
const listFiles = (dir, filter) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? listFiles(full, filter) : (filter(full) ? [full] : []);
});
const sizeOf = (files) => files.reduce((sum, file) => {
  const buffer = fs.readFileSync(file);
  return { files: sum.files + 1, raw: sum.raw + buffer.length, gzip: sum.gzip + gzipSize(buffer) };
}, { files: 0, raw: 0, gzip: 0 });

for (const file of [...GLOBAL_SCRIPTS, ESM_ENTRY, 'index.html']) {
  if (!fs.existsSync(path.join(dist, file))) throw new Error(`staged Pages dir is missing ${file}`);
}
const srcDir = path.join(dist, 'src');
const before = {
  globals: sizeOf(GLOBAL_SCRIPTS.map((file) => path.join(dist, file))),
  modules: sizeOf(listFiles(srcDir, (file) => file.endsWith('.js')))
};

// 1. Classic global scripts.
for (const file of GLOBAL_SCRIPTS) {
  const full = path.join(dist, file);
  const source = fs.readFileSync(full, 'utf8');
  const result = await esbuild.transform(source, {
    loader: 'js',
    minify: true,
    charset: 'utf8',
    legalComments: 'none',
    target: GLOBAL_TARGET,
    sourcefile: file,
    logLevel: 'error'
  });
  const outputFunctions = new Set([...result.code.matchAll(/(?:^|[^\w$.])function ([A-Za-z_$][\w$]*)\(/g)].map((match) => match[1]));
  const missing = [...new Set([...source.matchAll(TOP_LEVEL_FN_RE)].map((match) => match[1]))]
    .filter((name) => !outputFunctions.has(name));
  if (missing.length) throw new Error(`${file}: minified output lost top-level function names: ${missing.slice(0, 10).join(', ')}`);
  fs.writeFileSync(full, result.code);
}

// 2. Native ESM graph. Bundle from the pristine staged sources into a temp dir, then swap it in.
const bundleOut = fs.mkdtempSync(path.join(path.dirname(dist), '.aio-esm-bundle-'));
const build = await esbuild.build({
  // Input paths resolve relative to the staged dir, so chunk hashes depend only on the shipped code (a data-only
  // deploy keeps the same bytes and the service worker's code hash), not on where the runner staged it.
  absWorkingDir: dist,
  entryPoints: { 'app/bootstrap': ESM_ENTRY },
  outdir: bundleOut,
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
});
if (build.errors.length) throw new Error(`esbuild bundle failed with ${build.errors.length} errors`);
for (const file of listFiles(srcDir, (full) => full.endsWith('.js'))) fs.rmSync(file);
for (const file of listFiles(bundleOut, () => true)) {
  const target = path.join(srcDir, path.relative(bundleOut, file));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(file, target);
}
fs.rmSync(bundleOut, { recursive: true, force: true });
// Drop directories the removal left empty (css-only directories stay).
const pruneEmpty = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) if (entry.isDirectory()) pruneEmpty(path.join(dir, entry.name));
  if (dir !== srcDir && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
};
pruneEmpty(srcDir);

// 3. Boot set = entry plus the chunks it imports statically (lazy page chunks load on navigation).
const outputs = Object.fromEntries(Object.entries(build.metafile.outputs).map(([file, value]) => [rel(path.join(srcDir, path.relative(bundleOut, path.resolve(dist, file)))), value]));
const bootModules = new Set();
const queue = [ESM_ENTRY];
while (queue.length) {
  const file = queue.shift();
  if (bootModules.has(file)) continue;
  bootModules.add(file);
  for (const item of outputs[file]?.imports || []) {
    if (item.kind === 'import-statement') queue.push(rel(path.join(srcDir, path.relative(bundleOut, path.resolve(dist, item.path)))));
  }
}

const builtFiles = [...GLOBAL_SCRIPTS, ...Object.keys(outputs).filter((file) => file.endsWith('.js')).sort(), 'index.html'];
const manifest = {
  schemaVersion: 'aio-pages-bundle.v1',
  tool: `esbuild@${esbuild.version}`,
  entry: ESM_ENTRY,
  bootModules: [...bootModules].sort(),
  files: Object.fromEntries(builtFiles.map((file) => [file, sha256(fs.readFileSync(path.join(dist, file)))]))
};
if (manifestPath) fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

const after = {
  globals: sizeOf(GLOBAL_SCRIPTS.map((file) => path.join(dist, file))),
  modules: sizeOf(listFiles(srcDir, (file) => file.endsWith('.js'))),
  bootModules: sizeOf(manifest.bootModules.map((file) => path.join(dist, file)))
};
const kb = (value) => `${Math.round(value / 1024)} KB`;
const line = (label, value) => `${label}: ${value.files} files, ${kb(value.raw)} raw, ${kb(value.gzip)} gzip`;
console.log(`AIO Pages bundle (${manifest.tool})`);
console.log('  ' + line('global scripts before', before.globals));
console.log('  ' + line('global scripts after ', after.globals));
console.log('  ' + line('src modules before   ', before.modules));
console.log('  ' + line('src modules after    ', after.modules));
console.log('  ' + line('boot module set after', after.bootModules));
