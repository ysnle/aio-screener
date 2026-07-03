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
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..');
const PORT = Number(process.env.CI_TEST_PORT || 8891);
const BASE_URL = `http://127.0.0.1:${PORT}/index.html`;
const SKIP_LIST_PATH = resolve(root, '_context/gate-baseline-skip-list.json');

function loadSkipList() {
  try {
    const raw = JSON.parse(readFileSync(SKIP_LIST_PATH, 'utf8'));
    return new Set((raw.knownFailures || []).map((entry) => entry.id));
  } catch (e) {
    console.error(`[ci-headless-tests] skip-list 로드 실패 (${SKIP_LIST_PATH}): ${e.message}`);
    return new Set();
  }
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
  const server = await startServer();
  const browser = await chromium.launch();
  let exitCode = 0;

  try {
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('pageerror', (err) => consoleErrors.push(`[pageerror] ${err.message}`));
    page.on('console', (msg) => {
      // net::ERR_FAILED noise is the expected side-effect of the route.abort() below
      // (blocked external fetches) — not a real regression, so don't report it.
      if (msg.type() === 'error' && !/net::ERR_FAILED/.test(msg.text())) consoleErrors.push(`[console.error] ${msg.text()}`);
    });

    // 외부 fetch 전부 차단 — 앱을 offline/seed-fallback 경로로 강제해 결정론적으로 측정.
    // (127.0.0.1은 로컬 정적 서버이므로 허용)
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith(`http://127.0.0.1:${PORT}/`)) return route.continue();
      return route.abort();
    });

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(
      () => typeof window.AIO === 'object' && typeof window.AIO.loadTests === 'function',
      { timeout: 30000 }
    );

    const result = await page.evaluate(async () => {
      await window.AIO.loadTests();
      return window.AIO.runTests();
    });

    console.log(`\n[ci-headless-tests] ${result.summary}`);

    const unexpected = [];
    const expectedSkipped = [];
    for (const entry of result.results) {
      if (entry.ok) continue;
      const idMatch = entry.label.match(/^T\d+/);
      const testId = idMatch ? idMatch[0] : entry.label;
      if (skipList.has(testId)) expectedSkipped.push(entry);
      else unexpected.push(entry);
    }

    if (expectedSkipped.length) {
      console.log(`\n[ci-headless-tests] 환경 의존 실패 ${expectedSkipped.length}건 (skip-list, 비차단):`);
      for (const e of expectedSkipped) console.log(`  - ${e.label} | ${e.detail}`);
    }

    if (consoleErrors.length) {
      console.log(`\n[ci-headless-tests] 브라우저 콘솔 에러 ${consoleErrors.length}건:`);
      for (const e of consoleErrors.slice(0, 20)) console.log(`  - ${e}`);
    }

    if (unexpected.length) {
      console.error(`\n[ci-headless-tests] ❌ 예상 밖 실패 ${unexpected.length}건 (skip-list에 없음):`);
      for (const e of unexpected) console.error(`  - ${e.label} | ${e.detail}`);
      exitCode = 1;
    } else {
      console.log('\n[ci-headless-tests] ✅ skip-list 밖 실패 없음');
    }
  } catch (e) {
    console.error(`[ci-headless-tests] 실행 오류: ${e.stack || e.message}`);
    exitCode = 1;
  } finally {
    await browser.close();
    server.kill();
  }

  process.exit(exitCode);
}

main();
