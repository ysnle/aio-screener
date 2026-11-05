#!/usr/bin/env node
// v59.70 (wave 2 A′): the browser gates of a source push read one pinned data snapshot instead of whatever the data
// bot committed last. Live data moved under them: the home text budget failed on brief text (10-30), scenario
// guidance on a playbook value, the 테마 detail triggers on a lagging rotation artifact. Live data is still tested,
// by watchdog-browser.yml twice a day, where a failure alerts instead of blocking a release.
//
// architecture/browser-data-fixture.json pins one commit: every file the Pages deploy ships from public-data at that
// commit (PAGES_DATA_EXCLUDES left out), each with its git blob id and, for JSON, the id of its key structure
// (scripts/lib/schema-fingerprint.mjs). The structures are stored once each under "shapes".
//
//   node scripts/browser-data-fixture.mjs pin [--sha <rev>]   pin <rev> (default: the last commit that changed public-data)
//   node scripts/browser-data-fixture.mjs check               fail when a current artifact's structure left the pinned one
//   node scripts/browser-data-fixture.mjs materialize --out <dir>        write the pinned files (needs the commit locally:
//                                                                         git fetch --no-tags --depth=1 origin <sha>)
//   node scripts/browser-data-fixture.mjs install --from <dir> --overwrite-public-data   copy a materialized snapshot over
//                                                                         public-data/ after checking every blob id (CI checkouts)
//   node scripts/browser-data-fixture.mjs sha | clock         print the pinned commit / its commit time (the browser clock)
//
// The browser clock: start-local-node.mjs shifts the page's Date to AIO_BROWSER_CLOCK_AT (the pinned commit time), so
// "today", market sessions and freshness labels read as they did when the snapshot was current.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CliArgsError, parseCliArgs } from './lib/cli-args.mjs';
import { PAGES_DATA_EXCLUDES } from './lib/pages-bundle-config.mjs';
import { schemaDrift, schemaShape, SCHEMA_DEPTH } from './lib/schema-fingerprint.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const MANIFEST = 'architecture/browser-data-fixture.json';
const DATA_DIR = 'public-data';
export const PIN_HINT = 'node scripts/browser-data-fixture.mjs pin';

export const USAGE = [
  'usage: node scripts/browser-data-fixture.mjs <command>',
  '  pin [--sha <rev>]                         pin <rev> (default: the last commit that changed public-data)',
  '  check                                     fail when a current artifact\'s key structure left the pinned one',
  '  materialize --out <dir>                   write the pinned files into <dir>',
  '  install --from <dir> --overwrite-public-data   copy a materialized snapshot over public-data/ (CI checkouts)',
  '  sha | clock                               print the pinned commit / its commit time'
].join('\n');

export const isDeployed = (rel) => !PAGES_DATA_EXCLUDES.some((entry) => entry.endsWith('/') ? rel.startsWith(entry) : rel === entry);
const shapeId = (shape) => createHash('sha256').update(JSON.stringify(shape)).digest('hex').slice(0, 16);
export const gitBlobId = (buffer) => createHash('sha1').update(`blob ${buffer.length}\0`).update(buffer).digest('hex');

function git(args, { input, encoding = 'utf8' } = {}) {
  const result = spawnSync('git', args, { cwd: root, input: input == null ? undefined : Buffer.from(input), ...(encoding === 'buffer' ? {} : { encoding }), maxBuffer: 1 << 30 });
  if (result.status !== 0) throw new Error(`git ${args[0]} failed: ${String(result.stderr || '').trim()}`);
  return result.stdout;
}

// Every deployed public-data file at <sha>: [{ path: 'public-data/x.json', blob }].
function deployedFiles(sha) {
  return git(['ls-tree', '-r', '-z', '--full-tree', sha, '--', DATA_DIR]).split('\0').filter(Boolean).map((line) => {
    const [meta, path] = line.split('\t');
    return { path, blob: meta.split(' ')[2], type: meta.split(' ')[1] };
  }).filter((entry) => entry.type === 'blob' && isDeployed(entry.path.slice(DATA_DIR.length + 1)));
}

// Reads many blobs in one git process: Map(blob -> Buffer).
function readBlobs(blobs) {
  const unique = [...new Set(blobs)];
  const out = new Map();
  if (!unique.length) return out;
  const buffer = git(['cat-file', '--batch'], { input: unique.join('\n') + '\n', encoding: 'buffer' });
  let offset = 0;
  for (const blob of unique) {
    const headerEnd = buffer.indexOf(0x0a, offset);
    const header = buffer.subarray(offset, headerEnd).toString('utf8');
    if (header.endsWith(' missing')) throw new Error(`blob ${blob} is not in this clone`);
    const size = Number(header.split(' ')[2]);
    out.set(blob, buffer.subarray(headerEnd + 1, headerEnd + 1 + size));
    offset = headerEnd + 1 + size + 1;
  }
  return out;
}

function parseJson(buffer) {
  try { return { ok: true, value: JSON.parse(buffer.toString('utf8')) }; } catch (_) { return { ok: false }; }
}

export function readManifest(file = join(root, MANIFEST)) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function pin(rev) {
  const sha = git(['rev-parse', '--verify', `${rev || git(['log', '-1', '--format=%H', '--', DATA_DIR]).trim()}^{commit}`]).trim();
  const committedAt = git(['show', '-s', '--format=%cI', sha]).trim();
  const files = deployedFiles(sha);
  const blobs = readBlobs(files.filter((file) => file.path.endsWith('.json')).map((file) => file.blob));
  const shapes = {};
  const entries = {};
  for (const file of files) {
    const entry = { blob: file.blob };
    if (file.path.endsWith('.json')) {
      const parsed = parseJson(blobs.get(file.blob));
      if (parsed.ok) {
        const shape = schemaShape(parsed.value);
        const id = shapeId(shape);
        shapes[id] = shape;
        entry.shape = id;
      }
    }
    entries[file.path] = entry;
  }
  const manifest = {
    schemaVersion: 1,
    note: `Pinned browser-gate data (scripts/browser-data-fixture.mjs). Re-pin with \`${PIN_HINT}\` after a producer changes an artifact's structure; check fails until then.`,
    sha,
    committedAt,
    schemaDepth: SCHEMA_DEPTH,
    fileCount: files.length,
    files: entries,
    shapes
  };
  // One line per file and per structure: a re-pin's diff shows which artifacts moved.
  const block = (object) => `{\n${Object.keys(object).sort().map((key) => `  ${JSON.stringify(key)}: ${JSON.stringify(object[key])}`).join(',\n')}\n }`;
  const head = Object.entries(manifest).filter(([key]) => key !== 'files' && key !== 'shapes').map(([key, value]) => ` ${JSON.stringify(key)}: ${JSON.stringify(value)}`);
  writeFileSync(join(root, MANIFEST), `{\n${[...head, ` "files": ${block(entries)}`, ` "shapes": ${block(shapes)}`].join(',\n')}\n}\n`);
  console.log(`pinned ${sha} (${committedAt}): ${files.length} deployed files, ${Object.keys(shapes).length} distinct JSON structures -> ${MANIFEST}`);
  return 0;
}

// The gate. Every pinned JSON artifact is compared with the working tree's copy; a new deployed JSON artifact that
// the pin does not have fails too (its consumers would read live data in the fixture run).
export function checkFixture({ manifest = readManifest(), dataRoot = root, listCurrent = currentDeployedJson } = {}) {
  const problems = [];
  for (const [path, entry] of Object.entries(manifest.files)) {
    if (!entry.shape) continue;
    const file = join(dataRoot, path);
    if (!existsSync(file)) continue; // retired artifacts stay in the snapshot harmlessly
    const parsed = parseJson(readFileSync(file));
    if (!parsed.ok) continue; // a half-written file is the data gates' finding, not a structure change
    const drift = schemaDrift(manifest.shapes[entry.shape], schemaShape(parsed.value, { maxDepth: manifest.schemaDepth || SCHEMA_DEPTH }));
    if (drift.length) problems.push(`${path}: ${drift.slice(0, 8).join(' ')}${drift.length > 8 ? ` (+${drift.length - 8})` : ''}`);
  }
  for (const path of listCurrent(dataRoot)) if (!manifest.files[path]) problems.push(`${path}: new deployed artifact, not in the pinned snapshot`);
  return problems;
}

export function formatCheckFailure(manifest, problems) {
  return [
    `browser data fixture: ${problems.length} artifact(s) no longer match the snapshot pinned at ${String(manifest.sha).slice(0, 12)} (${manifest.committedAt}):`,
    ...problems.slice(0, 40).map((line) => `  ${line}`),
    'A producer changed what it writes, so the browser gates\' pinned data no longer looks like production.',
    'Re-pin on a commit whose public-data has the new structure (pushed, so CI can fetch it):',
    `  ${PIN_HINT} [--sha <data commit>]`,
    `then commit ${MANIFEST}.`
  ].join('\n');
}

function currentDeployedJson(dataRoot) {
  return git(['ls-files', '-z', '--', DATA_DIR]).split('\0').filter((path) => path.endsWith('.json') && isDeployed(path.slice(DATA_DIR.length + 1)) && existsSync(join(dataRoot, path)));
}

function materialize(outDir) {
  const manifest = readManifest();
  try { git(['cat-file', '-e', `${manifest.sha}^{commit}`]); } catch (_) {
    console.error(`pinned commit ${manifest.sha} is not in this clone; fetch it first:\n  git fetch --no-tags --depth=1 origin ${manifest.sha}`);
    return 1;
  }
  const blobs = readBlobs(Object.values(manifest.files).map((entry) => entry.blob));
  const out = resolve(outDir);
  for (const [path, entry] of Object.entries(manifest.files)) {
    const target = join(out, path.slice(DATA_DIR.length + 1));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, blobs.get(entry.blob));
  }
  writeFileSync(join(out, '.browser-data-fixture'), `${manifest.sha}\n`);
  console.log(`materialized ${Object.keys(manifest.files).length} files of ${manifest.sha} into ${relative(root, out) || out}`);
  return 0;
}

function install(fromDir) {
  const manifest = readManifest();
  const from = resolve(fromDir);
  const marker = join(from, '.browser-data-fixture');
  if (!existsSync(marker) || readFileSync(marker, 'utf8').trim() !== manifest.sha) {
    console.error(`${fromDir} is not a materialized snapshot of ${manifest.sha}`);
    return 1;
  }
  const bad = [];
  for (const [path, entry] of Object.entries(manifest.files)) {
    const source = join(from, path.slice(DATA_DIR.length + 1));
    if (!existsSync(source) || gitBlobId(readFileSync(source)) !== entry.blob) bad.push(path);
  }
  if (bad.length) { console.error(`snapshot files do not match their pinned blob ids: ${bad.slice(0, 5).join(', ')}${bad.length > 5 ? ` (+${bad.length - 5})` : ''}`); return 1; }
  for (const path of Object.keys(manifest.files)) {
    const target = join(root, ...path.split('/'));
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(from, path.slice(DATA_DIR.length + 1)), target);
  }
  console.log(`installed ${Object.keys(manifest.files).length} pinned files of ${manifest.sha} over ${DATA_DIR}${sep}`);
  return 0;
}

function main(argv) {
  let args;
  try {
    args = parseCliArgs(argv, { usage: USAGE, flags: ['--overwrite-public-data'], options: ['--sha', '--out', '--from'], positional: { min: 0, max: 1 } });
  } catch (error) {
    if (error instanceof CliArgsError) { console.error(error.message); return 2; }
    throw error;
  }
  if (args.help) { console.log(USAGE); return 0; }
  const [command] = args.positional;
  const allowed = { pin: ['--sha'], check: [], materialize: ['--out'], install: ['--from', '--overwrite-public-data'], sha: [], clock: [] };
  if (!command || !allowed[command]) { console.error(`${command ? `unknown command ${command}` : 'a command is needed'}\n${USAGE}`); return 2; }
  const given = [...args.flags, ...Object.keys(args.options)];
  const stray = given.filter((name) => !allowed[command].includes(name));
  if (stray.length) { console.error(`${stray.join(', ')} does not apply to ${command}\n${USAGE}`); return 2; }
  if (command === 'pin') return pin(args.options['--sha']);
  if (command === 'sha') { console.log(readManifest().sha); return 0; }
  if (command === 'clock') { console.log(readManifest().committedAt); return 0; }
  if (command === 'materialize') {
    if (!args.options['--out']) { console.error(`materialize needs --out <dir>\n${USAGE}`); return 2; }
    return materialize(args.options['--out']);
  }
  if (command === 'install') {
    if (!args.options['--from'] || !args.flags.has('--overwrite-public-data')) { console.error(`install needs --from <dir> and --overwrite-public-data\n${USAGE}`); return 2; }
    return install(args.options['--from']);
  }
  const manifest = readManifest();
  const problems = checkFixture({ manifest });
  if (problems.length) { console.error(formatCheckFailure(manifest, problems)); return 1; }
  console.log(`browser data fixture OK: ${Object.keys(manifest.files).length} pinned files at ${manifest.sha.slice(0, 12)} (${manifest.committedAt}), structures match`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) process.exitCode = main(process.argv.slice(2));
