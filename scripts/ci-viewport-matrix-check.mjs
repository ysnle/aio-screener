// FABLE-UIUX-DEEP-AUDIT-2026-07-08 Phase V3-1
// Route x viewport surface check. Screenshots are opt-in via AIO_VIEWPORT_SCREENSHOTS=1.

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..');
const PORT = Number(process.env.CI_VIEWPORT_PORT || 8892);
const BASE_URL = `http://127.0.0.1:${PORT}/index.html`;
const SCREENSHOTS = process.env.AIO_VIEWPORT_SCREENSHOTS === '1';
const FULL_INIT = process.env.AIO_VIEWPORT_FULL_INIT === '1';
const OUT_DIR = resolve(root, '_artifacts', 'viewport-matrix');

const ROUTES = [
  'home','signal','breadth','sentiment','briefing','market-news','technical','screener',
  'ticker','portfolio','themes','theme-detail','macro','fxbond','fundamental','options',
  'kr-home','kr-supply','kr-themes','kr-macro','kr-technical','guide'
];

const VIEWPORTS = [
  { name: 'mobile390', width: 390, height: 844 },
  { name: 'tablet768', width: 768, height: 1024 },
  { name: 'laptop1024', width: 1024, height: 768 },
  { name: 'desktop1440', width: 1440, height: 900 },
];

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
    setTimeout(onReady, 2000);
  });
}

async function auditRoute(page, routeId) {
  return page.evaluate((id) => {
    const targetPageId = id === 'theme-detail' ? 'themes' : id;
    const targetPage = document.getElementById('page-' + targetPageId);
    if (!targetPage) return { routeId: id, fatal: 'page element missing' };
    if (window.__AIO_VIEWPORT_FULL_INIT__ && typeof window.showPage === 'function') {
      try { window.showPage(id, null); } catch (e) { return { routeId: id, fatal: 'showPage: ' + (e && e.message || e) }; }
    } else {
      document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
      targetPage.classList.add('active');
    }
    const pageEl = targetPage;
    const ownText = (el) => (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || el.value || '').trim();
    const badTextRe = /\[번역 대기\]|SNAPSHOT\s*·\s*reference|\bundefined\b|\bNaN\b|\[object Object\]/;
    const docEl = document.documentElement;
    const body = document.body;
    const activeRoot = pageEl || document.querySelector('.page.active') || body;

    const controls = Array.from(activeRoot.querySelectorAll('button,[role="button"],a[href],input,select,textarea'))
      .slice(0, 800)
      .filter((el) => !ownText(el));
    const activeText = (activeRoot.textContent || '').replace(/\s+/g, ' ').trim();
    const badTextNodes = badTextRe.test(activeText)
      ? Array.from(activeText.match(new RegExp(badTextRe.source, 'g')) || []).slice(0, 3)
      : [];
    // v52.5x/WO-4 (F-02): this array was declared but never populated — the zeroCanvasCount
    // field below always silently reported 0 regardless of actual canvas render state. A
    // canvas that's in the DOM, visible (offsetParent set), but rendered at 0x0 (a common
    // symptom of a chart-init function running before its container has real layout, or
    // erroring before the first draw call) went completely undetected.
    const zeroCanvases = Array.from(activeRoot.querySelectorAll('canvas'))
      .filter((cv) => cv.offsetParent !== null || cv.getClientRects().length > 0)
      .filter((cv) => cv.clientWidth === 0 || cv.clientHeight === 0 || cv.width === 0 || cv.height === 0);
    const brokenImages = Array.from(activeRoot.querySelectorAll('img'))
      .filter((img) => img.complete && img.naturalWidth === 0);
    // v52.5x/WO-4: small-text 정책 결정 — 9px는 관찰만(기존 코드베이스에 이미 34곳가량 존재하는
    // 출처/타임스탬프류 라벨, 한 세션의 QA 게이트 작업 범위에서 전면 재설계 없이 강제하면 다수
    // 페이지를 동시에 깨뜨림) 하되, 8px 이하는 실패 조건으로 승격 — index.html 정적 스캔 결과
    // 7px 1건·8px 0건으로 사실상 존재하지 않아 이 임계값을 게이트로 걸어도 즉시 깨질 페이지가
    // 없다(안전한 첫 단계). 9px를 포함한 강제는 별도 UX 패스로 남김.
    const tinyTextCritical = Array.from(activeRoot.querySelectorAll('[style*="font-size:8px"],[style*="font-size:7px"],[style*="font-size:6px"],[style*="font-size:5px"]')).slice(0, 50);
    const tinyText = Array.from(activeRoot.querySelectorAll('[style*="font-size:9px"],[style*="font-size:8px"],[style*="font-size:7px"]')).slice(0, 50);
    const clipsViewport = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && (r.left < -1 || r.right > window.innerWidth + 1 || r.top < -1 || r.bottom > window.innerHeight + 1);
    };
    const topbarEls = Array.from(document.querySelectorAll('.topbar-actions-right,#live-quote-ts,#topbar-ai-btn,#topbar-refresh-btn'))
      .filter((el) => el.offsetParent !== null || el.getClientRects().length > 0);
    const topbarClips = topbarEls.filter(clipsViewport);

    const svgTextIssues = [];
    const svgTinyText = [];
    Array.from(activeRoot.querySelectorAll('svg')).slice(0, 80).forEach((svg) => {
      if (!(svg.offsetParent !== null || svg.getClientRects().length > 0)) return;
      const texts = Array.from(svg.querySelectorAll('text')).filter((el) => {
        const txt = (el.textContent || '').trim();
        if (!txt) return false;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        const fs = parseFloat(cs.fontSize || el.getAttribute('font-size') || '0');
        if (fs > 0 && fs < 10) svgTinyText.push({ text: txt.slice(0, 40), fontSize: fs });
        return true;
      });
      const boxes = texts.map((el) => {
        try {
          const b = el.getBBox();
          return { el, text: (el.textContent || '').trim().slice(0, 40), x:b.x, y:b.y, w:b.width, h:b.height };
        } catch (_) { return null; }
      }).filter(Boolean).filter((b) => b.w > 0 && b.h > 0);
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i], b = boxes[j];
          const separated = a.x + a.w <= b.x + 1 || b.x + b.w <= a.x + 1 || a.y + a.h <= b.y + 1 || b.y + b.h <= a.y + 1;
          if (!separated) svgTextIssues.push({ a: a.text, b: b.text });
        }
      }
    });
    const wordBagKey = (text) => String(text || '')
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !/^\d+$/.test(w))
      .sort()
      .join(' ');
    const duplicateScope = /^(market-news|briefing)$/.test(id);
    const candidateCards = duplicateScope
      ? Array.from(activeRoot.querySelectorAll('.news-card,.briefing-section,.ai-briefing-content,.aio-news-card,[data-news-id],[data-article-id]'))
        .filter((el) => el.offsetParent !== null || el.getClientRects().length > 0)
        .slice(0, 120)
      : [];
    const seenCards = new Map();
    const duplicateCards = [];
    for (const card of candidateCards) {
      const text = (card.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length < 30) continue;
      const key = wordBagKey(text).slice(0, 260);
      if (!key || key.length < 20) continue;
      if (seenCards.has(key)) duplicateCards.push({ first: seenCards.get(key).slice(0, 100), duplicate: text.slice(0, 100) });
      else seenCards.set(key, text);
    }

    return {
      routeId: id,
      activeFound: !!pageEl,
      docOverflowX: Math.max(docEl.scrollWidth - docEl.clientWidth, body.scrollWidth - body.clientWidth),
      badTextCount: badTextNodes.length,
      namelessControlCount: controls.length,
      zeroCanvasCount: zeroCanvases.length,
      brokenImageCount: brokenImages.length,
      topbarClipCount: topbarClips.length,
      svgTextOverlapCount: svgTextIssues.length,
      svgTinyTextCount: svgTinyText.length,
      duplicateCardCount: duplicateCards.length,
      tinyTextCount: tinyText.length,
      tinyTextCriticalCount: tinyTextCritical.length,
      samples: {
        badText: badTextNodes.slice(0, 3),
        nameless: controls.slice(0, 3).map((el) => el.outerHTML.slice(0, 160)),
        topbarClips: topbarClips.slice(0, 3).map((el) => el.outerHTML.slice(0, 160)),
        zeroCanvases: zeroCanvases.slice(0, 3).map((el) => (el.id ? '#' + el.id : el.className ? '.' + String(el.className).split(' ')[0] : 'canvas')),
        svgTextIssues: svgTextIssues.slice(0, 3),
        svgTinyText: svgTinyText.slice(0, 3),
        duplicateCards: duplicateCards.slice(0, 3),
        tinyText: tinyText.slice(0, 3).map((el) => ({ text: (el.textContent || '').trim().slice(0, 60), style: el.getAttribute('style') || '' })),
        tinyTextCritical: tinyTextCritical.slice(0, 3).map((el) => ({ text: (el.textContent || '').trim().slice(0, 60), style: el.getAttribute('style') || '' }))
      }
    };
  }, routeId);
}

async function main() {
  if (SCREENSHOTS) mkdirSync(OUT_DIR, { recursive: true });
  console.log(`[ci-viewport-matrix] starting local server on ${PORT}`);
  const server = await startServer();
  console.log('[ci-viewport-matrix] launching chromium');
  const browser = await chromium.launch();
  const failures = [];
  const reports = [];

  // v52.5x/WO-4 (F-02): the route matrix previously collected zero pageerror/console.error
  // signal — a route could throw on every single visit and still report a clean PASS. Attach
  // per-page listeners and attribute each error to whichever route was active when it fired
  // (best-effort — a small settle delay after showPage() in FULL_INIT mode narrows the window
  // where an error could be misattributed to the next route instead of the one that caused it).
  const ERR_ALLOWLIST = /net::ERR_FAILED|Failed to load resource/; // expected: all external fetches are aborted by design below
  const jsErrors = [];

  try {
    for (const vp of VIEWPORTS) {
      console.log(`[ci-viewport-matrix] viewport ${vp.name} begin`);
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      let currentRouteId = null;
      page.on('pageerror', (err) => {
        jsErrors.push({ viewport: vp.name, routeId: currentRouteId, kind: 'pageerror', message: String(err && err.message || err) });
      });
      page.on('console', (msg) => {
        if (msg.type() !== 'error') return;
        const text = msg.text();
        if (ERR_ALLOWLIST.test(text)) return;
        jsErrors.push({ viewport: vp.name, routeId: currentRouteId, kind: 'console.error', message: text.slice(0, 300) });
      });
      await page.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith(`http://127.0.0.1:${PORT}/`)) return route.continue();
        return route.abort();
      });
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForFunction(() => typeof window.showPage === 'function', { timeout: 15000 });
      await page.evaluate((fullInit) => { window.__AIO_VIEWPORT_FULL_INIT__ = !!fullInit; }, FULL_INIT);

      for (const routeId of ROUTES) {
        const errCountBefore = jsErrors.length;
        currentRouteId = routeId;
        const r = await auditRoute(page, routeId);
        if (FULL_INIT) await page.waitForTimeout(150); // let async post-showPage errors surface before attributing to the next route
        r.viewport = vp.name;
        r.jsErrorCount = jsErrors.length - errCountBefore;
        reports.push(r);
        if (SCREENSHOTS) await page.screenshot({ path: resolve(OUT_DIR, `${vp.name}-${routeId}.png`), fullPage: false });
        const routeFailures = [];
        if (r.fatal) routeFailures.push(r.fatal);
        if (!r.activeFound) routeFailures.push('active page missing');
        if (r.jsErrorCount) routeFailures.push(`unhandled pageerror/console.error ${r.jsErrorCount}`);
        if (r.docOverflowX > 3) routeFailures.push(`horizontal overflow ${r.docOverflowX}px`);
        if (r.badTextCount) routeFailures.push(`bad visible text ${r.badTextCount}`);
        if (r.namelessControlCount) routeFailures.push(`nameless controls ${r.namelessControlCount}`);
        if (r.zeroCanvasCount) routeFailures.push(`zero-size canvases ${r.zeroCanvasCount}`);
        if (r.brokenImageCount) routeFailures.push(`broken images ${r.brokenImageCount}`);
        if (r.topbarClipCount) routeFailures.push(`topbar clipped controls ${r.topbarClipCount}`);
        if (r.svgTextOverlapCount) routeFailures.push(`svg text overlaps ${r.svgTextOverlapCount}`);
        if (r.svgTinyTextCount) routeFailures.push(`svg text below 10px ${r.svgTinyTextCount}`);
        if (r.tinyTextCriticalCount) routeFailures.push(`html text at/below 8px ${r.tinyTextCriticalCount}`);
        if (r.duplicateCardCount) routeFailures.push(`duplicate news/briefing cards ${r.duplicateCardCount}`);
        if (routeFailures.length) {
          const routeJsErrors = jsErrors.filter((e) => e.viewport === vp.name && e.routeId === routeId).slice(0, 3);
          failures.push({ viewport: vp.name, routeId, routeFailures, samples: { ...r.samples, jsErrors: routeJsErrors } });
        }
      }
      console.log(`[ci-viewport-matrix] ${vp.name} checked (${ROUTES.length} routes)`);
      await page.close();
    }

    const worstOverflow = Math.max(...reports.map((r) => r.docOverflowX || 0));
    const totalTiny = reports.reduce((n, r) => n + (r.tinyTextCount || 0), 0);
    console.log(`[ci-viewport-matrix] routes=${ROUTES.length}, viewports=${VIEWPORTS.length}, combos=${reports.length}, worstOverflow=${worstOverflow}px, tinyTextObservations=${totalTiny}, jsErrors=${jsErrors.length}${FULL_INIT ? '' : ' (FULL_INIT=0 — showPage()/chart-init paths not exercised, so this is not a meaningful signal in default mode)'}`);
    if (failures.length) {
      console.error(`[ci-viewport-matrix] ❌ ${failures.length} failing route/viewport combo(s)`);
      for (const f of failures.slice(0, 20)) {
        console.error(` - ${f.viewport}/${f.routeId}: ${f.routeFailures.join(', ')}`);
        if (f.samples && f.samples.badText?.length) console.error(`   badText: ${JSON.stringify(f.samples.badText)}`);
        if (f.samples && f.samples.nameless?.length) console.error(`   nameless: ${JSON.stringify(f.samples.nameless)}`);
        if (f.samples && f.samples.topbarClips?.length) console.error(`   topbarClips: ${JSON.stringify(f.samples.topbarClips)}`);
        if (f.samples && f.samples.zeroCanvases?.length) console.error(`   zeroCanvases: ${JSON.stringify(f.samples.zeroCanvases)}`);
        if (f.samples && f.samples.svgTextIssues?.length) console.error(`   svgTextIssues: ${JSON.stringify(f.samples.svgTextIssues)}`);
        if (f.samples && f.samples.svgTinyText?.length) console.error(`   svgTinyText: ${JSON.stringify(f.samples.svgTinyText)}`);
        if (f.samples && f.samples.duplicateCards?.length) console.error(`   duplicateCards: ${JSON.stringify(f.samples.duplicateCards)}`);
        if (f.samples && f.samples.jsErrors?.length) console.error(`   jsErrors: ${JSON.stringify(f.samples.jsErrors)}`);
      }
      process.exitCode = 1;
    } else {
      console.log('[ci-viewport-matrix] ✅ route x viewport surface checks passed');
    }
  } finally {
    await browser.close();
    server.kill();
  }
}

main().catch((e) => {
  console.error(`[ci-viewport-matrix] 실행 오류: ${e.stack || e.message}`);
  process.exit(1);
});
