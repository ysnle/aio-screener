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
export const shapeId = (shape) => createHash('sha256').update(JSON.stringify(shape)).digest('hex').slice(0, 16);
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
    note: `Pinned browser-gate data (scripts/browser-data-fixture.mjs). Re-pin with \`${PIN_HINT}\` after a producer changes an artifact's structure; until then the drift gate reports in CI and fails the data watchdog.`,
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

// v59.70 (integration review 89e8c881): the pin's own consistency, independent of what the producers write now. CI
// blocks on this (scripts/ci-browser-data-fixture-check.mjs); the drift below is live data and only reports in CI.
// When the pinned commit is in this clone its tree must give exactly the pinned blob ids and be an ancestor of HEAD
// (a squash or rebase would leave the pin unreachable on the remote); a shallow CI checkout leaves that to `install`,
// which checks every blob id of the fetched snapshot before the browser shards read it.
export function checkPinIntegrity(manifest = readManifest(), { head = 'HEAD' } = {}) {
  const problems = [];
  const files = Object.entries(manifest.files || {});
  if (!/^[0-9a-f]{40}$/.test(String(manifest.sha))) problems.push(`sha is not a full commit id: ${manifest.sha}`);
  if (!Number.isFinite(Date.parse(manifest.committedAt))) problems.push(`committedAt is not a time: ${manifest.committedAt}`);
  if (manifest.schemaDepth !== SCHEMA_DEPTH) problems.push(`schemaDepth ${manifest.schemaDepth} is not the fingerprint depth ${SCHEMA_DEPTH}`);
  if (manifest.fileCount !== files.length) problems.push(`fileCount ${manifest.fileCount} but ${files.length} files listed`);
  for (const [path, entry] of files) {
    if (!path.startsWith(`${DATA_DIR}/`) || !isDeployed(path.slice(DATA_DIR.length + 1))) problems.push(`${path}: not a deployed public-data path`);
    if (!/^[0-9a-f]{40}$/.test(String(entry.blob))) problems.push(`${path}: blob is not a git blob id`);
    if (entry.shape && !manifest.shapes?.[entry.shape]) problems.push(`${path}: structure ${entry.shape} is not stored`);
  }
  const used = new Set(files.map(([, entry]) => entry.shape).filter(Boolean));
  for (const [id, shape] of Object.entries(manifest.shapes || {})) {
    if (shapeId(shape) !== id) problems.push(`structure ${id} does not hash to its id`);
    if (!used.has(id)) problems.push(`structure ${id} is stored but no file uses it`);
  }
  let commit = 'absent';
  try { git(['cat-file', '-e', `${manifest.sha}^{commit}`]); commit = 'present'; } catch (_) { /* shallow clone: install checks blobs */ }
  if (commit === 'present') {
    const tree = new Map(deployedFiles(manifest.sha).map((file) => [file.path, file.blob]));
    const missing = [...tree.keys()].filter((path) => !manifest.files[path]);
    const extra = files.filter(([path]) => !tree.has(path)).map(([path]) => path);
    const wrong = files.filter(([path, entry]) => tree.has(path) && tree.get(path) !== entry.blob).map(([path]) => path);
    if (missing.length || extra.length || wrong.length) problems.push(`the pinned commit's deployed files differ from the manifest: missing ${missing.slice(0, 3).join(', ') || '0'}; extra ${extra.slice(0, 3).join(', ') || '0'}; other blob ${wrong.slice(0, 3).join(', ') || '0'}`);
    const ancestor = spawnSync('git', ['merge-base', '--is-ancestor', manifest.sha, head], { cwd: root });
    if (ancestor.status === 1) problems.push(`pinned commit ${manifest.sha.slice(0, 12)} is not in ${head}'s history (re-pin on a commit of this branch)`);
  }
  return { problems, commit };
}

// The drift check. Every pinned JSON artifact is compared with the working tree's copy; a new deployed JSON artifact
// that the pin does not have counts too (its consumers would read live data in the fixture run). This is live data:
// scripts/ci-browser-data-pin-drift-check.mjs reports it in a CI shard and fails in the watchdog and locally.
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
