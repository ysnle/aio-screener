// Phase 2 [B5] — headless run of the in-browser unit test suite (js/aio-tests.js, AIO.runTests()).
// 왜: 836개 브라우저 콘솔 전용 테스트가 push 시점에 전혀 실행되지 않아 런타임 회귀(P557 등)가
// 배포 게이트를 통과하고 라이브에서 발견됐다(FABLE-SYSTEM-DIAGNOSIS-2026-07-02.md §4 B5).
// 이 스크립트가 Playwright로 로컬 정적 서빙 → AIO.loadTests() → AIO.runTests()를 실행해
// 그 빈 칸을 메운다.
//
// 환경 의존 테스트(라이브 시세/키 필요)는 GATE-BASELINE-2026-06-04.md와 같은 방식으로
// _context/gate-baseline-skip-list.json에 분류해두고 skip 취급한다 — 이 목록에 없는
// 실패만 "예상 밖 회귀"로 보고한다. 외부 네트워크는 전부 차단(route abort)해 CI가
// Yahoo/FMP 등에 부하를 주지 않고 항상 동일한 offline/seed-fallback 상태로 측정되게 한다.

import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..');
const shardArg = process.argv.find((value) => /^--shard=\d+\/\d+$/.test(value)) || '--shard=1/1';
const groupsArg = process.argv.find((value) => value.startsWith('--groups=')) || null;
const GROUP_IDS = groupsArg
  ? [...new Set(groupsArg.slice('--groups='.length).split(',').map((value) => value.trim().toUpperCase()).filter(Boolean))]
  : [];
if (groupsArg && (!GROUP_IDS.length || GROUP_IDS.some((id) => !/^G\d{3}$/.test(id)))) throw new Error(`invalid headless groups: ${groupsArg}`);
if (groupsArg && process.argv.some((value) => value.startsWith('--shard=') && value !== '--shard=1/1')) throw new Error('--groups cannot be combined with a multi-shard selection');
const shardMatch = shardArg.match(/^--shard=(\d+)\/(\d+)$/);
const SHARD_INDEX = Number(shardMatch?.[1]);
const SHARD_COUNT = Number(shardMatch?.[2]);
if (!Number.isInteger(SHARD_INDEX) || !Number.isInteger(SHARD_COUNT) || SHARD_INDEX < 1 || SHARD_COUNT < 1 || SHARD_INDEX > SHARD_COUNT) {
  throw new Error(`invalid headless shard: ${shardArg}`);
}
const SHARD_LABEL = `${SHARD_INDEX}/${SHARD_COUNT}`;
const SELECTION_LABEL = GROUP_IDS.length ? GROUP_IDS.join(',') : `shard=${SHARD_LABEL}`;
const PORT = Number(process.env.CI_TEST_PORT || (8890 + SHARD_INDEX));
const BASE_URL = `http://127.0.0.1:${PORT}/index.html`;
const SKIP_LIST_PATH = resolve(root, '_context/gate-baseline-skip-list.json');
const RUNTIME_ALLOWLIST_PATH = resolve(root, 'architecture/browser-error-allowlist.json');
let activeServer = null;
let activeBrowser = null;
let cleanupPromise = null;

function stopServerTree(server) {
  if (!server?.pid) return;
  try { server.kill('SIGTERM'); } catch (_) {}
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
  }
}

function cleanup() {
  if (cleanupPromise) return cleanupPromise;
  cleanupPromise = (async () => {
    try { if (activeBrowser) await activeBrowser.close(); } catch (_) {}
    stopServerTree(activeServer);
    activeBrowser = null;
    activeServer = null;
  })();
  return cleanupPromise;
}

['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.once(signal, async () => {
    await cleanup();
    process.exit(signal === 'SIGINT' ? 130 : 143);
  });
});

function loadSkipList() {
  try {
    const raw = JSON.parse(readFileSync(SKIP_LIST_PATH, 'utf8'));
    return new Set((raw.knownFailures || []).map((entry) => entry.id));
  } catch (e) {
    console.error(`[ci-headless-tests] skip-list 로드 실패 (${SKIP_LIST_PATH}): ${e.message}`);
    return new Set();
  }
}

function loadRuntimeAllowlist() {
  let raw;
  try { raw = JSON.parse(readFileSync(RUNTIME_ALLOWLIST_PATH, 'utf8')); }
  catch (e) { throw new Error(`browser runtime allowlist load failed (${RUNTIME_ALLOWLIST_PATH}): ${e.message}`); }
  const entries = Array.isArray(raw?.entries) ? raw.entries : [];
  const now = Date.now();
  return entries.map((entry) => {
    const required = ['id', 'scope', 'pattern', 'reason', 'owner', 'expiresAt'];
    if (required.some((key) => typeof entry?.[key] !== 'string' || !entry[key].trim())) {
      throw new Error(`invalid browser runtime allowlist entry: ${JSON.stringify(entry)}`);
    }
    const expiresAt = Date.parse(entry.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= now) throw new Error(`expired browser runtime allowlist entry: ${entry.id}`);
    let pattern;
    try { pattern = new RegExp(entry.pattern, 'i'); }
    catch (e) { throw new Error(`invalid browser runtime allowlist pattern ${entry.id}: ${e.message}`); }
    return { ...entry, pattern };
  });
}

function matchesAllowlist(error, entry) {
  const scopeMatches = entry.scope === 'all' || entry.scope === error.kind || (entry.scope === 'console' && error.kind === 'console.error');
  return scopeMatches && entry.pattern.test(`${error.text} ${error.source || ''}`);
}

function startServer() {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(PORT)], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let started = false;
    const onReady = () => { if (!started) { started = true; resolvePromise(child); } };
    child.stdout.on('data', (d) => { if (String(d).includes('AIO local server')) onReady(); });
    child.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));
    child.on('error', reject);
    child.on('exit', (code) => { if (!started) reject(new Error(`server exited early (code ${code})`)); });
    setTimeout(onReady, 2000); // fallback if stdout match races
  });
}

async function main() {
  const skipList = loadSkipList();
  const runtimeAllowlist = loadRuntimeAllowlist();
  const server = await startServer();
  activeServer = server;
  const browser = await chromium.launch();
  activeBrowser = browser;
  let exitCode = 0;

  try {
    const page = await browser.newPage();
    const runtimeErrors = [];
    const expectedBlockedNetwork = [];
    const abortedExternalUrls = new Set();
    page.on('pageerror', (err) => runtimeErrors.push({ kind: 'pageerror', text: err.message, source: 'page' }));
    page.on('console', (msg) => {
      if (msg.text().startsWith('[AIO TEST PROGRESS]')) {
        console.log(`[qa-progress] headless ${msg.text().replace('[AIO TEST PROGRESS] ', '')}`);
        return;
      }
      if (msg.type() !== 'error') return;
      const location = msg.location?.() || {};
      const locationUrl = location.url || '';
      const embeddedUrl = (msg.text().match(/https?:\/\/[^\s'"\)]+/g) || []).find((url) => abortedExternalUrls.has(url));
      const expectedAbort = /net::ERR_FAILED|failed to load resource/i.test(msg.text())
        && (abortedExternalUrls.has(locationUrl) || !!embeddedUrl);
      if (!expectedAbort) runtimeErrors.push({ kind: 'console.error', text: msg.text(), source: locationUrl || 'console' });
    });
    page.on('requestfailed', (request) => {
      const url = request.url();
      const failure = request.failure()?.errorText || 'requestfailed';
      if (!url.startsWith(`http://127.0.0.1:${PORT}/`)) expectedBlockedNetwork.push({ url, failure });
      else runtimeErrors.push({ kind: 'requestfailed', text: `${failure} ${url}`, source: url });
    });

    // 외부 fetch 전부 차단 — 앱을 offline/seed-fallback 경로로 강제해 결정론적으로 측정.
    // (127.0.0.1은 로컬 정적 서버이므로 허용)
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith(`http://127.0.0.1:${PORT}/`)) return route.continue();
      abortedExternalUrls.add(url);
      return route.abort();
    });

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(
      () => typeof window.AIO === 'object' && typeof window.AIO.loadTests === 'function',
      { timeout: 30000 }
    );
    await page.waitForFunction(
      () => typeof window.AIO_ARCH === 'object' && typeof window.AIO_ARCH.classifyAIConduct === 'function',
      { timeout: 30000 }
    );
    // The Telegram/category contract is populated by the same asynchronous
    // localhost artifact pipeline as data.json.  Fast CI machines can reach
    // AIO.runTests() before that pipeline settles, so certify the completed
    // artifact state instead of racing the boot fetch.
    await page.waitForFunction(
      () => {
        const artifactState = window._serverDataMeta?.artifacts?.telegramDigest;
        const digestState = window._aioTelegramDigestMeta?.status;
        return Boolean(digestState && artifactState && artifactState !== 'pending');
      },
      { timeout: 30000 }
    );

    const heartbeatStartedAt = Date.now();
    const heartbeat = setInterval(() => console.log(`[qa-progress] headless selection=${SELECTION_LABEL} elapsed=${Math.round((Date.now() - heartbeatStartedAt) / 1000)}s`), 15000);
    let result;
    try {
      result = await page.evaluate(async ({ shardIndex, shardCount, groupIds }) => {
      await window.AIO.loadTests();
        return window.AIO.runTests({ shardIndex, shardCount, groupIds, progress: true });
      }, { shardIndex: SHARD_INDEX, shardCount: SHARD_COUNT, groupIds: GROUP_IDS });
    } finally {
      clearInterval(heartbeat);
    }

    if (result?.shard?.index !== SHARD_INDEX || result?.shard?.count !== SHARD_COUNT || result?.shard?.selectedGroups < 1) {
      throw new Error(`headless shard coverage mismatch: ${JSON.stringify(result?.shard || null)}`);
    }
    if (GROUP_IDS.length && (result?.selection?.mode !== 'groups' || result.shard.selectedGroups !== GROUP_IDS.length || GROUP_IDS.some((id) => !result.selection.requestedGroups.includes(id)))) {
      throw new Error(`headless group coverage mismatch: ${JSON.stringify(result?.selection || null)}`);
    }

    const sentinel = await page.evaluate(() => window.AIO.runGroupContractSelfTest?.() || null);

    console.log(`\n[ci-headless-tests] selection=${SELECTION_LABEL} groups=${result.shard.selectedGroups}/${result.shard.registryGroups} ${result.summary}`);

    const unexpected = [];
    const expectedSkipped = [];
    for (const entry of result.results) {
      if (entry.ok) continue;
      const idMatch = entry.label.match(/^T\d+/);
      const testId = idMatch ? idMatch[0] : entry.label;
      if (skipList.has(testId)) expectedSkipped.push(entry);
      else unexpected.push(entry);
    }

    if (!result.groups || result.groups.exceptionGroups !== 0 || result.groups.plannedGroups !== result.groups.completedGroups) {
      unexpected.push({ label: 'GROUP_REGISTRY', detail: JSON.stringify(result.groups || null) });
    }
    if (!sentinel || sentinel.plannedGroups !== 2 || sentinel.completedGroups !== 1 || sentinel.exceptionGroups !== 1 || sentinel.allPass !== false) {
      unexpected.push({ label: 'GROUP_SENTINEL', detail: JSON.stringify(sentinel) });
    }

    const allowlistedRuntime = runtimeErrors.filter((error) => runtimeAllowlist.some((entry) => matchesAllowlist(error, entry)));
    const unexpectedRuntime = runtimeErrors.filter((error) => !runtimeAllowlist.some((entry) => matchesAllowlist(error, entry)));
    const unusedRuntimeAllowlist = runtimeAllowlist.filter((entry) => !runtimeErrors.some((error) => matchesAllowlist(error, entry)));

    if (expectedSkipped.length) {
      console.log(`\n[ci-headless-tests] 환경 의존 실패 ${expectedSkipped.length}건 (skip-list, 비차단):`);
      for (const e of expectedSkipped) console.log(`  - ${e.label} | ${e.detail}`);
    }

    if (expectedBlockedNetwork.length) {
      console.log(`\n[ci-headless-tests] expected-blocked-network ${expectedBlockedNetwork.length}건:`);
      for (const entry of expectedBlockedNetwork.slice(0, 20)) console.log(`  - ${entry.failure} | ${entry.url}`);
    }
    if (allowlistedRuntime.length) {
      console.log(`\n[ci-headless-tests] allowlisted runtime errors ${allowlistedRuntime.length}건:`);
      for (const entry of allowlistedRuntime.slice(0, 20)) console.log(`  - ${entry.kind} | ${entry.text}`);
    }
    if (unusedRuntimeAllowlist.length) {
      console.error(`\n[ci-headless-tests] ❌ 미사용 runtime allowlist ${unusedRuntimeAllowlist.length}건:`);
      for (const entry of unusedRuntimeAllowlist) console.error(`  - ${entry.id}`);
      exitCode = 1;
    }
    if (unexpectedRuntime.length) {
      console.error(`\n[ci-headless-tests] ❌ unexpected browser runtime errors ${unexpectedRuntime.length}건:`);
      for (const e of unexpectedRuntime.slice(0, 20)) console.error(`  - ${e.kind} | ${e.text} | ${e.source}`);
      exitCode = 1;
    }

    if (unexpected.length) {
      const failedGroups = [...new Set([
        ...unexpected.map((entry) => entry.groupId).filter((id) => /^G\d{3}$/.test(id || '')),
        ...(result.groupResults || []).filter((group) => group.status === 'exception').map((group) => group.id).filter((id) => /^G\d{3}$/.test(id || ''))
      ])];
      if (failedGroups.length) console.error(`[ci-headless-tests] AIO_FAILED_GROUPS=${failedGroups.join(',')}`);
      console.error(`\n[ci-headless-tests] ❌ 예상 밖 실패 ${unexpected.length}건 (skip-list에 없음):`);
      for (const e of unexpected) console.error(`  - ${e.groupId || 'unscoped'} | ${e.label} | ${e.detail}`);
      exitCode = 1;
    } else {
      console.log('\n[ci-headless-tests] ✅ skip-list 밖 실패 없음');
    }
  } catch (e) {
    console.error(`[ci-headless-tests] 실행 오류: ${e.stack || e.message}`);
    exitCode = 1;
  } finally {
    await cleanup();
  }

  process.exit(exitCode);
}

main();
