#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const manifestPath = process.env.AIO_QA_MANIFEST_PATH ? resolve(process.env.AIO_QA_MANIFEST_PATH) : join(root, 'architecture', 'qa-pipeline.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const cacheDir = process.env.AIO_QA_CACHE_DIR ? resolve(process.env.AIO_QA_CACHE_DIR) : join(root, '.cache', 'aio-qa');
const cachePath = join(cacheDir, 'success-cache.json');
const reportPath = join(cacheDir, 'last-run.json');
const sessionDir = join(cacheDir, 'sessions');
const runsDir = join(cacheDir, 'runs');
const failedBatchPath = join(cacheDir, 'failed-batch.json');
const verifiedTreePath = join(cacheDir, 'verified-tree.json');
mkdirSync(cacheDir, { recursive: true });
mkdirSync(sessionDir, { recursive: true });
mkdirSync(runsDir, { recursive: true });

// P1265/E2-C6 P0: every cache/report write goes through tmp+rename so a reader can
// never observe a half-written file and a concurrent writer cannot interleave JSON.
function writeJsonAtomic(path, value) {
  const tmp = `${path}.${process.pid}.${Date.now().toString(36)}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  let lastError = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      renameSync(tmp, path);
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      // Windows can hold the destination briefly (AV/indexer/concurrent reader).
      // The observed EPERM class is retried here; a persistent failure is reported
      // with its cause instead of being swallowed.
      if ((error.code === 'EPERM' || error.code === 'EACCES' || error.code === 'EBUSY') && attempt < 3) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
        continue;
      }
      break;
    }
  }
  if (lastError) {
    try { unlinkSync(tmp); } catch { /* keep the original rename error */ }
    console.error(`[qa] WARN atomic write failed for ${path}: ${lastError.code || ''} ${lastError.message}`);
    throw lastError;
  }
}

// P1265/E2-C6 P0: a corrupt cache is an explicit re-run with a named cause, never a
// silent empty fallback that hides what happened. `strict` callers fail instead.
function readJsonLogged(path, fallback, label, { strict = false } = {}) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    if (strict) {
      console.error(`[qa] ${label} unreadable at ${path}: ${error.message} — fix or remove it; nothing is guessed from a damaged file`);
      process.exit(2);
    }
    console.error(`[qa] WARN ${label} unreadable at ${path}: ${error.message} — treating as empty; affected gates will re-run instead of trusting it`);
    return fallback;
  }
}

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
const positiveInteger = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 1 ? Math.floor(number) : fallback;
};
const maxStaticJobs = positiveInteger(option('--jobs') || process.env.AIO_QA_JOBS, 4);
// Browser gates own separate ports and processes. Timing measurements run alone;
// CI keeps one worker inside each existing matrix shard.
const maxBrowserJobs = Math.min(4, positiveInteger(option('--browser-jobs') || process.env.AIO_QA_BROWSER_JOBS, process.env.CI === 'true' ? 1 : 2));

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
  return readJsonLogged(path, fallback, path);
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
const fileDigests = new Map();
const fileDigest = (file) => {
  if (!fileDigests.has(file)) {
    try { fileDigests.set(file, createHash('sha256').update(readFileSync(join(root, file))).digest('hex')); }
    catch { fileDigests.set(file, null); }
  }
  return fileDigests.get(file);
};
const sessionId = String(sessionName || 'current').replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 80) || 'current';
const sessionPath = join(sessionDir, `${sessionId}.json`);
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const runReportPath = join(runsDir, `${runId}.json`);

if (profile === 'session-start') {
  const baseline = Object.fromEntries(allFiles.map((file) => [file, fileDigest(file)]));
  writeJsonAtomic(sessionPath, { schemaVersion: 'aio-qa-session.v1', sessionId, createdAt: new Date().toISOString(), gitHead: gitList(['rev-parse', 'HEAD'])[0] || null, files: baseline });
  console.log(`[qa] SESSION ${sessionId} captured ${Object.keys(baseline).length} files at ${sessionPath}`);
  process.exit(0);
}

// P1265/E2-C6 P0 — 커밋 후보 identity: 로컬 QA가 통과시킨 working tree와 실제로 커밋될
// staged tree가 같은지 결속한다. 일부만 staged됐거나 QA 뒤 파일이 바뀌면 출시 준비로
// 통과하지 않는다. CI는 push 뒤 exact commit을 다시 검증한다(그 경계는 유지).
if (profile === 'candidate') {
  const candidateRepo = process.env.AIO_QA_CANDIDATE_REPO ? resolve(process.env.AIO_QA_CANDIDATE_REPO) : root;
  const candidateGit = (args) => {
    const result = spawnSync('git', args, { cwd: candidateRepo, encoding: 'utf8' });
    return result.status === 0 ? String(result.stdout || '').split(/\r?\n/).map((value) => value.trim()).filter(Boolean).map((value) => value.replaceAll('\\', '/')) : [];
  };
  const candidateDigest = (file) => {
    try { return createHash('sha256').update(readFileSync(join(candidateRepo, file))).digest('hex'); } catch { return null; }
  };
  const stagedDigest = (file) => {
    const result = spawnSync('git', ['show', `:${file}`], { cwd: candidateRepo, encoding: 'buffer' });
    return result.status === 0 ? createHash('sha256').update(result.stdout).digest('hex') : null;
  };
  const verified = readJsonLogged(join(process.env.AIO_QA_CACHE_DIR ? resolve(process.env.AIO_QA_CACHE_DIR) : join(candidateRepo, '.cache', 'aio-qa'), 'verified-tree.json'), null, 'verified-tree', { strict: true });
  if (!verified || !verified.files) {
    console.error('[qa] CANDIDATE FAIL — QA 검증 트리(verified-tree.json)가 없습니다. 커밋 후보는 QA가 통과시킨 tree와만 결속됩니다 — 먼저 QA 런을 실행하세요.');
    process.exit(2);
  }
  const taskFiles = explicitFilesOption != null
    ? validateSelectedFiles(explicitFilesOption.split(',').map(normalizeFile).filter(Boolean), '--files')
    : Object.keys(verified.taskFiles || {});
  const staged = new Set(candidateGit(['diff', '--cached', '--name-only', 'HEAD']));
  const mismatches = [];
  for (const file of taskFiles) {
    const workDigest = candidateDigest(file);
    if (!staged.has(file)) {
      mismatches.push({ file, reason: 'missing-from-staged', detail: '작업 파일이 staged에 없습니다 — 커밋에서 누락됩니다' });
      continue;
    }
    const indexDigest = stagedDigest(file);
    if (indexDigest !== workDigest) {
      mismatches.push({ file, reason: 'staged-differs-from-worktree', detail: 'staged 내용이 working tree와 다릅니다(부분 staging)' });
      continue;
    }
    if (!verified.files || verified.files[file] !== workDigest) {
      mismatches.push({ file, reason: 'changed-after-qa-verification', detail: `QA 검증(${verified.runId || 'unknown'}) 이후 파일이 바뀌었습니다` });
    }
  }
  for (const file of staged) {
    if (taskFiles.includes(file)) continue;
    const workDigest = candidateDigest(file);
    if (!verified.files || verified.files[file] !== workDigest) {
      mismatches.push({ file, reason: 'staged-file-not-verified', detail: 'QA가 검증하지 않은 파일이 staged에 있습니다' });
    }
  }
  const candidateReport = {
    schemaVersion: 'aio-qa-candidate.v1',
    checkedAt: new Date().toISOString(),
    candidateRepo,
    qaRunId: verified.runId || null,
    qaSkips: verified.skips ?? null,
    taskFiles,
    stagedCount: staged.size,
    mismatches
  };
  writeJsonAtomic(join(cacheDir, 'candidate-report.json'), candidateReport);
  if (mismatches.length) {
    console.error('[qa] CANDIDATE FAIL — QA를 통과한 tree가 커밋 후보와 다릅니다:');
    for (const item of mismatches) console.error(`  - ${item.file}: ${item.reason} (${item.detail})`);
    console.error(`[qa] REPORT ${join(cacheDir, 'candidate-report.json')}`);
    process.exit(1);
  }
  console.log(`[qa] CANDIDATE OK — ${taskFiles.length} task file(s), ${staged.size} staged, QA run ${verified.runId || 'unknown'}${verified.skips ? ` (skips ${verified.skips})` : ''}`);
  console.log(`[qa] REPORT ${join(cacheDir, 'candidate-report.json')}`);
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

const allGates = Object.entries(manifest.groups).flatMap(([groupName, group]) =>
  group.gates.map((gate) => ({
    ...gate,
    group: groupName,
    phase: Number(group.phase || 0),
    kind: group.kind || 'static',
    cache: gate.cache ?? group.cache ?? true,
    inputs: gate.inputs || group.inputs || []
  }))
);
let selectedGroups = [];
let requestedGateIds = null;
let previousReport = null;
let changedGateIds = [];

if (requestedGroup) {
  selectedGroups = [requestedGroup];
} else if (profile === 'affected') {
  // A registered test edit selects that test, not every product surface it
  // inspects. Runner/manifest changes retain the infrastructure impact rules.
  const infrastructure = ['scripts/qa-runner.mjs', 'scripts/ci-qa-runner-behavior-check.mjs', 'scripts/ci-qa-pipeline-contract-check.mjs'];
  const directScripts = new Set(allGates.filter((gate) => changed.includes(gate.script) && gate.kind !== 'external' && gate.script.startsWith('scripts/ci-') && !infrastructure.includes(gate.script)).map((gate) => gate.script));
  changedGateIds = allGates.filter((gate) => gate.kind !== 'external' && directScripts.has(gate.script)).map((gate) => gate.id);
  if (changedGateIds.length && allGates.some((gate) => gate.id === 'qa-pipeline-contract')) changedGateIds.push('qa-pipeline-contract');
  const productChanges = changed.filter((file) => !directScripts.has(file));
  const impacted = manifest.impactRules
    .filter((rule) => productChanges.some((file) => matches(file, rule.patterns)))
    .flatMap((rule) => rule.groups)
    .filter((group) => group !== 'external');
  // P1265/E2-C6 P1: gate-level impact entries add specific gates without widening to
  // their whole group — this is how a single-owner gate stays reachable from sibling
  // surfaces (worker/** still pulls the data-plane contract after its duplicate
  // registration was removed). Additive only: nothing is excluded here.
  const impactedGateIds = manifest.impactRules
    .filter((rule) => productChanges.some((file) => matches(file, rule.patterns)))
    .flatMap((rule) => rule.gates || []);
  if (impactedGateIds.length) changedGateIds = [...new Set([...changedGateIds, ...impactedGateIds])];
  selectedGroups = ['preflight', ...impacted];
} else if (profile === 'rerun-failed') {
  // P1265/E2-C6 P0: rerun the EXACT failed batch. `failed-batch.json` preserves the
  // failure set even when an unrelated successful run overwrote last-run.json (the
  // observed loss), and `--report` selects a specific run report explicitly.
  const explicitReport = option('--report');
  if (explicitReport) {
    previousReport = readJsonLogged(resolve(explicitReport), null, 'report', { strict: true });
  } else if (existsSync(failedBatchPath)) {
    const batch = readJsonLogged(failedBatchPath, null, 'failed batch', { strict: true });
    const batchReport = batch.reportPath && existsSync(resolve(batch.reportPath))
      ? readJsonLogged(resolve(batch.reportPath), null, 'failed batch report', { strict: true })
      : readJson(reportPath, {});
    const batchIds = batch.gateIds || [];
    const kept = (batchReport?.results || []).filter((result) => batchIds.includes(result.id));
    for (const id of batchIds) {
      if (!kept.some((result) => result.id === id)) {
        const gate = allGates.find((item) => item.id === id);
        kept.push({ id, group: gate?.group || 'unknown', status: 'FAIL' });
      }
    }
    previousReport = { ...(batchReport || {}), results: kept };
    console.error(`[qa] rerun-failed: batch ${batch.runId || 'unknown'} (${batchIds.length} gate(s))`);
  } else {
    previousReport = readJson(reportPath, {});
  }
  requestedGateIds = (previousReport.results || []).filter((result) => result.status === 'FAIL').map((result) => result.id);
  if (!requestedGateIds.length) {
    console.error('[qa] rerun-failed: 선택된 리포트에 FAIL gate가 없습니다. 실패 배치(failed-batch.json)도 없고 last-run.json에도 FAIL이 없습니다 — --report <path>로 실패 배치 리포트를 지정하세요. 빈 배치를 PASS로 치환하지 않습니다.');
    process.exit(2);
  }
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

let selectedGates = allGates.filter((gate) => selectedGroups.includes(gate.group) || changedGateIds.includes(gate.id));

if (requestedGateIds || changedGateIds.length) {
  const byId = new Map(allGates.map((gate) => [gate.id, gate]));
  const expanded = new Set();
  const visit = (id) => {
    if (expanded.has(id)) return;
    const gate = byId.get(id);
    if (!gate) return;
    for (const dependency of gate.dependsOn || []) visit(dependency);
    expanded.add(id);
  };
  (requestedGateIds || selectedGates.map((gate) => gate.id)).forEach(visit);
  selectedGates = allGates.filter((gate) => expanded.has(gate.id));
}
selectedGroups = [...new Set(selectedGates.map((gate) => gate.group))];
if (requestedGateIds) {
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
    hash.update(fileDigest(file) || 'MISSING');
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
        // P1265/E2-C6 P0: merge-on-write + atomic replace — a concurrent runner's
        // entries are kept instead of being lost to a whole-file rewrite.
        const fresh = readJson(cachePath, null);
        if (fresh && fresh.gates) successCache.gates = { ...fresh.gates, ...successCache.gates };
        successCache.schemaVersion = manifest.schemaVersion;
        successCache.cacheVersion = manifest.cacheVersion;
        writeJsonAtomic(cachePath, successCache);
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
  const active = new Set();
  let cursor = 0;
  let exclusiveRunning = false;
  while (cursor < gates.length || active.size) {
    while (cursor < gates.length && active.size < concurrency && !exclusiveRunning) {
      const gate = gates[cursor];
      if (gate.exclusive && active.size) break;
      cursor++;
      exclusiveRunning = !!gate.exclusive;
      const task = runGate(gate).then((result) => results.push(result)).finally(() => {
        active.delete(task);
        if (gate.exclusive) exclusiveRunning = false;
      });
      active.add(task);
    }
    if (active.size) await Promise.race(active);
  }
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
  const phaseResults = await runPool(gates, browserPhase ? maxBrowserJobs : (externalPhase ? 2 : maxStaticJobs));
  results.push(...phaseResults);
  blockedBy = phaseResults.filter((result) => result.status === 'FAIL').map((result) => result.id);
}

const counts = results.reduce((acc, result) => ({ ...acc, [result.status]: (acc[result.status] || 0) + 1 }), {});
const report = {
  schemaVersion: 'aio-qa-run.v1',
  runId,
  manifestVersion: manifest.schemaVersion,
  profile,
  groups: selectedGroups,
  changeSource,
  changedFiles: changed,
  startedAt,
  completedAt: new Date().toISOString(),
  durationMs: Date.now() - startedMs,
  noCache,
  concurrency: { static: maxStaticJobs, browser: maxBrowserJobs, external: 2 },
  counts,
  results
};
// P1265/E2-C6 P0: per-run report + compat pointer, both atomic. The per-run copy
// survives any later run overwriting last-run.json.
writeJsonAtomic(runReportPath, report);
writeJsonAtomic(reportPath, report);

// P1265/E2-C6 P0 — 커밋 후보 결속: 이 런이 실제로 통과시킨 파일 hash를 남긴다.
// `candidate`는 커밋 후보가 이 검증 트리와 같은지 확인한다.
if (!counts.FAIL) {
  writeJsonAtomic(verifiedTreePath, {
    schemaVersion: 'aio-qa-verified-tree.v1',
    runId,
    verifiedAt: report.completedAt,
    profile,
    changeSource,
    counts,
    skips: counts.SKIP || 0,
    taskFiles: Object.fromEntries(changed.map((file) => [file, fileDigest(file)])),
    files: Object.fromEntries(allFiles.map((file) => [file, fileDigest(file)]))
  });
}

// P1265/E2-C6 P0 — 실패 배치 보존: 실패가 있으면 배치를 고정하고, 이 런이 그 배치의
// 모든 gate를 실제로 실행해 통과시켰을 때만 지운다(무관한 성공 런이 실패를 덮지 못함).
const failedIds = results.filter((result) => result.status === 'FAIL').map((result) => result.id);
const previousBatch = readJsonLogged(failedBatchPath, null, 'failed batch');
if (failedIds.length) {
  writeJsonAtomic(failedBatchPath, {
    schemaVersion: 'aio-qa-failed-batch.v1',
    runId,
    recordedAt: report.completedAt,
    profile,
    reportPath: runReportPath,
    gateIds: failedIds
  });
  console.log(`[qa] FAILED-BATCH preserved (${failedIds.length}): ${failedIds.join(', ')}`);
} else if (previousBatch) {
  const batchIds = previousBatch.gateIds || [];
  const covered = results.filter((result) => batchIds.includes(result.id));
  const resolved = batchIds.length > 0 && covered.length === batchIds.length && covered.every((result) => result.status === 'PASS' || result.status === 'CACHED');
  if (resolved) {
    try { unlinkSync(failedBatchPath); } catch { /* keep going; next rerun still sees it */ }
    console.log(`[qa] FAILED-BATCH resolved by this run (${previousBatch.runId || 'unknown'}) — cleared`);
  } else {
    console.log(`[qa] NOTE failed batch ${previousBatch.runId || 'unknown'} preserved: this run did not cover every gate in it`);
  }
}
console.log(`[qa] SUMMARY profile=${profile} run=${runId} groups=${selectedGroups.join(',')} pass=${counts.PASS || 0} cached=${counts.CACHED || 0} fail=${counts.FAIL || 0} skip=${counts.SKIP || 0} duration=${Math.round(report.durationMs / 100) / 10}s`);
console.log(`[qa] REPORT ${runReportPath}`);
console.log(`[qa] REPORT ${reportPath}`);
if (counts.FAIL) process.exit(1);
