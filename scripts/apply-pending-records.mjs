#!/usr/bin/env node
// Deferred ledger records for parallel threads (v59.56).
//
// Parallel threads that each ran bump-version and record-fix claimed the same "next" version and the same P ids
// (2026-10-26: PRs #78-#80 all wrote v58.81-v58.83 and two wrote P2093), and the integrator renumbered by hand.
// A thread working beside others therefore leaves the version alone and writes its record-fix entries to
//   _artifacts/pending-records/<thread>/<NN-name>.json
// (same shape as record-fix entries; "version" and "date" may be omitted, and any text may say {VERSION}).
// At integration, on the merged tip, one command assigns the release and records every entry in order:
//   node scripts/apply-pending-records.mjs [v59.57] [--dry-run] [--dir <path>]   (default: the next release)
// It runs bump-version once (skipped when version.json already says that version), then record-fix --no-regen per
// entry (ids are allocated from the ledger bodies one entry at a time, so they cannot collide), deletes each applied
// entry, and regenerates the workspace state once. A failing entry stops the run; entries applied before it are
// already recorded and deleted, so fixing the entry and rerunning continues where it stopped.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeRecord, PATHS, RecordFixError } from './record-fix.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const PENDING_DIR = '_artifacts/pending-records';

// The release an integration assigns when none is given: the next patch, and after .99 the next major's .01
// (v58.99 -> v59.01, as bump-version history does). Pending work cites this release in its assertion labels.
export function nextRelease(version) {
  const match = /^v(\d+)(?:\.(\d{1,2}))?$/.exec(String(version || ''));
  if (!match) throw new Error(`unusable version: ${version}`);
  const major = Number(match[1]);
  const patch = Number(match[2] || 0);
  return patch >= 99 ? `v${major + 1}.01` : `v${major}.${String(patch + 1).padStart(2, '0')}`;
}

export function listPendingEntries(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  const visit = (current) => {
    for (const name of readdirSync(current).sort()) {
      const full = join(current, name);
      if (statSync(full).isDirectory()) visit(full);
      else if (name.endsWith('.json')) out.push(full);
    }
  };
  visit(dir);
  return out;
}

// Pure: fill version/date and substitute {VERSION} in every string of the entry.
export function materializeEntry(entry, version, date) {
  const fill = (value) => {
    if (typeof value === 'string') return value.split('{VERSION}').join(version);
    if (Array.isArray(value)) return value.map(fill);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fill(v)]));
    return value;
  };
  return { ...fill(entry), version, date: entry.date || date };
}

function kstDate(now = new Date()) {
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function run(script, args) {
  const result = spawnSync(process.execPath, [join(root, 'scripts', script), ...args], { cwd: root, stdio: 'inherit' });
  return result.status === 0;
}

// --dry-run: replay every entry against scratch copies of the ledgers (with the release heading bump-version would
// add), so a bad entry is found before the real bump and the allocated ids are printed. Nothing in the repo changes.
function simulate(entries, version, date) {
  const scratch = mkdtempSync(join(tmpdir(), 'aio-pending-'));
  try {
    for (const rel of Object.values(PATHS)) {
      const from = join(root, rel);
      if (!existsSync(from)) continue;
      mkdirSync(dirname(join(scratch, rel)), { recursive: true });
      cpSync(from, join(scratch, rel));
    }
    const changelog = join(scratch, PATHS.changelog);
    const text = readFileSync(changelog, 'utf8');
    if (!text.includes(`## ${version} (`)) writeFileSync(changelog, text.replace(/^## v/m, `## ${version} (${date})\n- <!-- 변경 내용을 이곳에 기록하세요 -->\n\n## v`));
    const versionFile = join(scratch, PATHS.versionJson);
    writeFileSync(versionFile, JSON.stringify({ ...JSON.parse(readFileSync(versionFile, 'utf8')), version }, null, 2));
    for (const { file, entry } of entries) {
      const result = computeRecord(scratch, entry);
      for (const f of result.files) if (!f.unchanged) writeFileSync(f.path, f.content, 'utf8');
      console.log(`ok ${relative(root, file)}${result.changeOnly ? ' (change-only)' : ` ${result.pId}${result.rId ? ` ${result.rId}` : ''}`}`);
    }
    return 0;
  } catch (error) {
    console.error(error instanceof RecordFixError ? error.messages.join('\n') : error.stack);
    return 1;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

function main(argv) {
  const version = argv.find((arg) => /^v\d+\.\d+$/.test(arg)) || nextRelease(JSON.parse(readFileSync(join(root, 'version.json'), 'utf8')).version);
  const dryRun = argv.includes('--dry-run');
  const dirIndex = argv.indexOf('--dir');
  const dir = dirIndex >= 0 ? argv[dirIndex + 1] : join(root, PENDING_DIR);
  const files = listPendingEntries(dir);
  if (!files.length) { console.log(`no pending records under ${relative(root, dir) || dir}`); return 0; }
  const date = kstDate();
  const entries = [];
  for (const file of files) {
    try { entries.push({ file, entry: materializeEntry(JSON.parse(readFileSync(file, 'utf8')), version, date) }); }
    catch (error) { console.error(`${relative(root, file)}: ${error.message}`); return 1; }
  }
  console.log(`${entries.length} pending record(s) -> ${version}:\n${entries.map(({ file }) => '  ' + relative(root, file)).join('\n')}`);
  if (dryRun) return simulate(entries, version, date);
  const current = JSON.parse(readFileSync(join(root, 'version.json'), 'utf8')).version;
  if (current !== version && !run('bump-version.mjs', [version])) return 1;
  const scratch = mkdtempSync(join(tmpdir(), 'aio-pending-'));
  for (const [index, { file, entry }] of entries.entries()) {
    const temp = join(scratch, `${index}.json`);
    writeFileSync(temp, JSON.stringify(entry, null, 2));
    if (!run('record-fix.mjs', [temp, '--no-regen'])) { console.error(`stopped at ${relative(root, file)}; earlier entries are recorded`); return 1; }
    rmSync(file);
  }
  return run('generate-workspace-state.mjs', ['--write']) ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = main(process.argv.slice(2));
