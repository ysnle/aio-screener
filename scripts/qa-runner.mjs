#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const manifestPath = process.env.AIO_QA_MANIFEST_PATH ? resolve(process.env.AIO_QA_MANIFEST_PATH) : join(root, 'architecture', 'qa-pipeline.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const cacheDir = process.env.AIO_QA_CACHE_DIR ? resolve(process.env.AIO_QA_CACHE_DIR) : join(root, '.cache', 'aio-qa');
const cachePath = join(cacheDir, 'success-cache.json');
const reportPath = join(cacheDir, 'last-run.json');
const sessionDir = join(cacheDir, 'sessions');
mkdirSync(cacheDir, { recursive: true });
mkdirSync(sessionDir, { recursive: true });

const argv = process.argv.slice(2);
const option = (name) => {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : null;
};
const has = (name) => argv.includes(name);
const requestedGroup = option('--group');
const profile = argv[0] && !argv[0].startsWith('-') ? argv[0] : (requestedGroup ? 'group' : 'affected');
const explicitFilesOption = option('--files');
const sinceRef = option('--since');
const sessionName = option('--session');
const noCache = has('--no-cache') || process.env.CI === 'true';
const listOnly = has('--list');
const explain = has('--explain');
const maxStaticJobs = Math.max(1, Number(option('--jobs') || process.env.AIO_QA_JOBS || 4));

function globRegex(pattern) {
  const escaped = String(pattern)
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replaceAll('**', '\u0000')
    .replaceAll('*', '[^/]*')
    .replaceAll('?', '[^/]')
    .replaceAll('\u0000', '.*');
  return new RegExp(`^${escaped}$`);
}

const matches = (file, patterns = []) => patterns.some((pattern) => globRegex(pattern).test(file));

function gitList(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) return [];
  return String(result.stdout || '').split(/\r?\n/).map((value) => value.trim()).filter(Boolean).map((value) => value.replaceAll('\\', '/'));
}

function changedFiles() {
  return [...new Set([
    ...gitList(['diff', '--name-only', 'HEAD']),
    ...gitList(['ls-files', '--others', '--exclude-standard'])
  ])].sort();
}

function repositoryFiles() {
  return gitList(['ls-files', '--cached', '--others', '--exclude-standard']);
}

function readJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; }
}

const allFiles = repositoryFiles();
const normalizeFile = (value) => String(value || '').trim().replaceAll('\\', '/').replace(/^\.\//, '');
const validateSelectedFiles = (files, label) => {
  const invalid = files.filter((file) => !file || file.startsWith('/') || /^[A-Za-z]:\//.test(file) || file.split('/').includes('..'));
  if (invalid.length) {
    console.error(`Invalid ${label} path(s): ${invalid.join(', ')}`);
    process.exit(2);
  }
  return [...new Set(files)].sort();
};
const fileDigest = (file) => {
  try { return createHash('sha256').update(readFileSync(join(root, file))).digest('hex'); } catch { return null; }
};
const sessionId = String(sessionName || 'current').replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 80) || 'current';
const sessionPath = join(sessionDir, `${sessionId}.json`);

if (profile === 'session-start') {
  const baseline = Object.fromEntries(allFiles.map((file) => [file, fileDigest(file)]));
  writeFileSync(sessionPath, `${JSON.stringify({ schemaVersion: 'aio-qa-session.v1', sessionId, createdAt: new Date().toISOString(), gitHead: gitList(['rev-parse', 'HEAD'])[0] || null, files: baseline }, null, 2)}\n`);
  console.log(`[qa] SESSION ${sessionId} captured ${Object.keys(baseline).length} files at ${sessionPath}`);
  process.exit(0);
}

function changedFromSession(path) {
  if (!existsSync(path)) {
    console.error(`QA session baseline not found: ${path}. Run: node scripts/qa-runner.mjs session-start --session ${sessionId}`);
    process.exit(2);
  }
  const baseline = readJson(path, null);
  if (baseline?.schemaVersion !== 'aio-qa-session.v1' || !baseline.files) {
    console.error(`Invalid QA session baseline: ${path}`);
    process.exit(2);
  }
  const current = Object.fromEntries(allFiles.map((file) => [file, fileDigest(file)]));
  return [...new Set([...Object.keys(baseline.files), ...Object.keys(current)])]
    .filter((file) => baseline.files[file] !== current[file])
    .sort();
}

let changed;
let changeSource = 'working-tree-vs-head';
if (explicitFilesOption != null) {
  changed = validateSelectedFiles(explicitFilesOption.split(',').map(normalizeFile).filter(Boolean), '--files');
  changeSource = 'explicit-files';
} else if (sinceRef) {
  const verified = spawnSync('git', ['rev-parse', '--verify', `${sinceRef}^{commit}`], { cwd: root, encoding: 'utf8' });
  if (verified.status !== 0) {
    console.error(`Invalid --since git reference: ${sinceRef}`);
    process.exit(2);
  }
  changed = [...new Set([...gitList(['diff', '--name-only', sinceRef, '--']), ...gitList(['ls-files', '--others', '--exclude-standard'])])].sort();
  changeSource = `git-since:${sinceRef}`;
} else if (sessionName) {
  changed = changedFromSession(sessionPath);
  changeSource = `session:${sessionId}`;
} else {
  changed = changedFiles();
}

let selectedGroups = [];
let requestedGateIds = null;
let previousReport = null;

if (requestedGroup) {
  selectedGroups = [requestedGroup];
} else if (profile === 'affected') {
  const impacted = manifest.impactRules
    .filter((rule) => changed.some((file) => matches(file, rule.patterns)))
    .flatMap((rule) => rule.groups)
    .filter((group) => group !== 'external');
  selectedGroups = ['preflight', ...impacted];
} else if (profile === 'rerun-failed') {
  previousReport = readJson(reportPath, {});
  requestedGateIds = (previousReport.results || []).filter((result) => result.status === 'FAIL').map((result) => result.id);
  selectedGroups = (previousReport.results || []).filter((result) => requestedGateIds.includes(result.id)).map((result) => result.group);
} else {
  selectedGroups = manifest.profiles[profile] || [];
}

selectedGroups = [...new Set(selectedGroups)];
const invalidGroups = selectedGroups.filter((group) => !manifest.groups[group]);
if (!selectedGroups.length || invalidGroups.length) {
  console.error(`Unknown QA profile/group: profile=${profile}, groups=${invalidGroups.join(',') || 'none'}`);
  process.exit(2);
}

let selectedGates = selectedGroups.flatMap((groupName) => {
  const group = manifest.groups[groupName];
  return group.gates.map((gate) => ({
    ...gate,
    group: groupName,
    phase: Number(group.phase || 0),
    kind: group.kind || 'static',
    cache: gate.cache ?? group.cache ?? true,
    inputs: gate.inputs || group.inputs || []
  }));
});

if (requestedGateIds) {
  const allManifestGates = Object.entries(manifest.groups || {}).flatMap(([groupName, group]) => (group.gates || []).map((gate) => ({ ...gate, group: groupName })));
  const byId = new Map(allManifestGates.map((gate) => [gate.id, gate]));
  const expanded = new Set();
  const visit = (id) => {
    if (expanded.has(id)) return;
    const gate = byId.get(id);
    if (!gate) return;
    for (const dependency of gate.dependsOn || []) visit(dependency);
    expanded.add(id);
  };
  requestedGateIds.forEach(visit);
  selectedGroups = [...new Set([...expanded].map((id) => byId.get(id)?.group).filter(Boolean))];
  selectedGates = selectedGroups.flatMap((groupName) => {
    const group = manifest.groups[groupName];
    return group.gates.filter((gate) => expanded.has(gate.id)).map((gate) => ({
      ...gate,
      group: groupName,
      phase: Number(group.phase || 0),
      kind: group.kind || 'static',
      cache: gate.cache ?? group.cache ?? true,
      inputs: gate.inputs || group.inputs || []
    }));
  });
  const previousById = new Map((previousReport?.results || []).map((result) => [result.id, result]));
  selectedGates = selectedGates.map((gate) => {
    if (gate.script !== 'scripts/ci-headless-tests.mjs') return gate;
    const previous = previousById.get(gate.id);
    const priorOutput = `${previous?.output || ''}\n${previous?.error || ''}`;
    const failedGroups = priorOutput.match(/AIO_FAILED_GROUPS=(G\d{3}(?:,G\d{3})*)/)?.[1];
    if (!failedGroups) return gate;
    return { ...gate, args: [...(gate.args || []).filter((arg) => !String(arg).startsWith('--shard=') && !String(arg).startsWith('--groups=')), `--groups=${failedGroups}`] };
  });
}

const duplicateIds = selectedGates.map((gate) => gate.id).filter((id, index, ids) => ids.indexOf(id) !== index);
if (duplicateIds.length) {
  console.error(`Duplicate selected gate IDs: ${[...new Set(duplicateIds)].join(', ')}`);
  process.exit(2);
}

if (listOnly || explain) {
  console.log(JSON.stringify({ profile, groups: selectedGroups, changeSource, changedFiles: changed, gates: selectedGates.map(({ id, group, phase, kind, script }) => ({ id, group, phase, kind, script })) }, null, 2));
  process.exit(0);
}

const successCache = readJson(cachePath, { schemaVersion: manifest.schemaVersion, cacheVersion: manifest.cacheVersion, gates: {} });
if (successCache.schemaVersion !== manifest.schemaVersion || successCache.cacheVersion !== manifest.cacheVersion) successCache.gates = {};
successCache.schemaVersion = manifest.schemaVersion;
successCache.cacheVersion = manifest.cacheVersion;

const inputDigestCache = new Map();
function inputFingerprint(patterns) {
  const key = JSON.stringify([...(patterns || [])].sort());
  if (inputDigestCache.has(key)) return inputDigestCache.get(key);
  const hash = createHash('sha256');
  for (const file of allFiles.filter((path) => matches(path, patterns)).sort()) {
    hash.update(`\0${file}\0`);
    try { hash.update(readFileSync(join(root, file))); } catch { hash.update('MISSING'); }
  }
  const digest = hash.digest('hex');
  inputDigestCache.set(key, digest);
  return digest;
}

function gateFingerprint(gate) {
  const hash = createHash('sha256');
  hash.update(JSON.stringify({ cacheVersion: manifest.cacheVersion, id: gate.id, script: gate.script, args: gate.args || [], env: gate.env || {}, platform: process.platform, node: process.versions.node.split('.')[0] }));
  hash.update(`\0${gate.script}\0`);
  try { hash.update(readFileSync(join(root, gate.script))); } catch { hash.update('MISSING'); }
  hash.update(inputFingerprint(gate.inputs));
  return hash.digest('hex');
}

const outputLimit = 200_000;
function terminateChildTree(child) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore'
    });
    killer.on('error', () => { try { child.kill('SIGTERM'); } catch {} });
    setTimeout(() => { if (child.exitCode == null) { try { child.kill('SIGTERM'); } catch {} } }, 2000).unref();
    return;
  }
  try { child.kill('SIGTERM'); } catch {}
  setTimeout(() => { if (child.exitCode == null) { try { child.kill('SIGKILL'); } catch {} } }, 2000).unref();
}

function runGate(gate) {
  return new Promise((resolveResult) => {
    const fingerprint = gateFingerprint(gate);
    const cached = gate.cache && !noCache && successCache.gates[gate.id]?.fingerprint === fingerprint;
    if (cached) {
      const durationMs = Number(successCache.gates[gate.id]?.durationMs || 0);
      console.log(`[qa] CACHED ${gate.id} (${durationMs}ms prior)`);
      resolveResult({ id: gate.id, group: gate.group, phase: gate.phase, kind: gate.kind, status: 'CACHED', durationMs, fingerprint });
      return;
    }

    const args = [gate.script, ...(gate.args || []).map((value) => String(value).replaceAll('{cacheDir}', cacheDir))];
    const started = Date.now();
    console.log(`[qa] RUN ${gate.id}`);
    const child = spawn(process.execPath, args, {
      cwd: root,
      env: { ...process.env, ...(gate.env || {}) },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    const append = (current, chunk) => (current + chunk).slice(-outputLimit);
    child.stdout.on('data', (chunk) => {
      stdout = append(stdout, chunk);
      for (const line of String(chunk).split(/\r?\n/).filter((value) => value.includes('[qa-progress]'))) console.log(`[qa] ${line.trim()}`);
    });
    child.stderr.on('data', (chunk) => { stderr = append(stderr, chunk); });
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      terminateChildTree(child);
    }, Number(gate.timeoutMs || 120_000));
    child.on('error', (error) => { stderr = append(stderr, error.stack || error.message); });
    child.on('close', (code, signal) => {
      clearTimeout(timeout);
      const durationMs = Date.now() - started;
      const status = code === 0 && !timedOut ? 'PASS' : 'FAIL';
      const result = {
        id: gate.id,
        group: gate.group,
        phase: gate.phase,
        kind: gate.kind,
        status,
        durationMs,
        fingerprint,
        exitCode: code,
        signal,
        timedOut,
        output: stdout.trim(),
        error: stderr.trim()
      };
      if (status === 'PASS') {
        successCache.gates[gate.id] = { fingerprint, passedAt: new Date().toISOString(), durationMs };
        writeFileSync(cachePath, `${JSON.stringify(successCache, null, 2)}\n`);
        console.log(`[qa] PASS ${gate.id} (${durationMs}ms)`);
      } else {
        console.error(`[qa] FAIL ${gate.id} (${durationMs}ms${timedOut ? ', timeout' : ''})`);
        const detail = [stderr, stdout].filter(Boolean).join('\n').split(/\r?\n/).slice(-30).join('\n');
        if (detail) console.error(detail);
      }
      resolveResult(result);
    });
  });
}

async function runPool(gates, concurrency) {
  const results = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, gates.length) }, async () => {
    while (cursor < gates.length) {
      const gate = gates[cursor++];
      results.push(await runGate(gate));
    }
  });
  await Promise.all(workers);
  return results;
}

const startedAt = new Date().toISOString();
const startedMs = Date.now();
const results = [];
const phases = [...new Set(selectedGates.map((gate) => gate.phase))].sort((a, b) => a - b);
let blockedBy = [];

for (const phase of phases) {
  const gates = selectedGates.filter((gate) => gate.phase === phase);
  if (blockedBy.length) {
    for (const gate of gates) results.push({ id: gate.id, group: gate.group, phase, kind: gate.kind, status: 'SKIP', durationMs: 0, blockedBy });
    continue;
  }
  const browserPhase = gates.some((gate) => gate.kind === 'browser');
  const externalPhase = gates.some((gate) => gate.kind === 'external');
  const phaseResults = await runPool(gates, browserPhase ? 1 : (externalPhase ? 2 : maxStaticJobs));
  results.push(...phaseResults);
  blockedBy = phaseResults.filter((result) => result.status === 'FAIL').map((result) => result.id);
}

const counts = results.reduce((acc, result) => ({ ...acc, [result.status]: (acc[result.status] || 0) + 1 }), {});
const report = {
  schemaVersion: 'aio-qa-run.v1',
  manifestVersion: manifest.schemaVersion,
  profile,
  groups: selectedGroups,
  changeSource,
  changedFiles: changed,
  startedAt,
  completedAt: new Date().toISOString(),
  durationMs: Date.now() - startedMs,
  noCache,
  counts,
  results
};
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`[qa] SUMMARY profile=${profile} groups=${selectedGroups.join(',')} pass=${counts.PASS || 0} cached=${counts.CACHED || 0} fail=${counts.FAIL || 0} skip=${counts.SKIP || 0} duration=${Math.round(report.durationMs / 100) / 10}s`);
console.log(`[qa] REPORT ${reportPath}`);
if (counts.FAIL) process.exit(1);
