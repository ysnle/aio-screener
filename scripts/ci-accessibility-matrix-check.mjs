// H2-10: all-route Chromium accessibility contract.  This is a deterministic
// structural/keyboard audit; screen-reader/NVDA evidence remains manual.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DESKTOP_PRIMARY_VIEWPORT, DESKTOP_QA_SCOPE } from './desktop-qa-config.mjs';
import { closeAll, startLocalServer } from './lib/browser-gate.mjs';
import { ROUTE_IDS } from '../src/app/routes.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.CI_A11Y_PORT || 8901);
const baseUrl = `http://127.0.0.1:${port}/index.html`;
const routes = ROUTE_IDS;
const appRevision = JSON.parse(readFileSync(resolve(root, 'version.json'), 'utf8')).version;
const gitHead = (() => { try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch (_) { return null; } })();
const outPath = process.env.CI_A11Y_OUT
  ? resolve(root, process.env.CI_A11Y_OUT)
  : resolve(root, '_artifacts', 'accessibility-matrix-audit.json');

async function main() {
  mkdirSync(dirname(outPath), { recursive: true });
  const server = await startLocalServer(port, { label: 'accessibility-matrix/server' }); // v57.62 shared lifecycle
  const browser = await chromium.launch().catch(async (error) => { await closeAll({ server }); throw error; });
  const result = {
    schemaVersion: 'aio-accessibility-evidence.v2',
    observedAt: new Date().toISOString(),
    appRevision,
    gitHead,
    scope: DESKTOP_QA_SCOPE,
    viewport: DESKTOP_PRIMARY_VIEWPORT,
    routes: [],
    manualBoundaries: [
      { id: 'screen-reader', status: 'UNVERIFIED', requiredEvidence: 'NVDA or equivalent screen-reader task flow' },
      { id: 'contrast', status: 'UNVERIFIED', requiredEvidence: 'computed foreground/background contrast including state variants' },
      { id: 'zoom-reflow', status: 'UNVERIFIED', requiredEvidence: '200% zoom and keyboard flow at supported desktop width' },
      { id: 'dialog-focus', status: 'UNVERIFIED', requiredEvidence: 'open/close/focus-trap/focus-return for every dialog branch' }
    ],
    consoleErrors: []
  };
  try {
    const page = await browser.newPage({ viewport: result.viewport });
    page.on('pageerror', (e) => result.consoleErrors.push(`[pageerror] ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR_FAILED|\[AIO:api\].*warn\s*→\s*error/.test(m.text())) result.consoleErrors.push(`[console.error] ${m.text()}`); });
    await page.route('**/*', (route) => route.request().url().startsWith(`http://127.0.0.1:${port}/`) ? route.continue() : route.abort());
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => window.AIO && typeof window.showPage === 'function', { timeout: 30000 });
    for (const routeKey of routes) {
      await page.evaluate((id) => window.showPage(id, null), routeKey);
      await page.waitForTimeout(150);
      const audit = await page.evaluate((id) => {
        const target = id === 'theme-detail' ? 'themes' : id;
        const root = document.getElementById('page-' + target);
        const visible = (el) => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getClientRects().length > 0; };
        const name = (el) => (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || el.value || '').replace(/\s+/g, ' ').trim();
        const controls = root ? Array.from(root.querySelectorAll('button,a[href],input,select,textarea,[role="button"],[data-action]')).filter(visible) : [];
        const nameless = controls.filter((el) => !name(el)).map((el) => el.outerHTML.slice(0, 180));
        const selectsWithoutName = controls.filter((el) => el.tagName === 'SELECT' && !name(el)).map((el) => el.id || el.outerHTML.slice(0, 120));
        const positiveTabindex = controls.filter((el) => Number(el.getAttribute('tabindex')) > 0).map((el) => el.id || el.outerHTML.slice(0, 120));
        const canvases = root ? Array.from(root.querySelectorAll('canvas')).filter(visible) : [];
        const unnamedCanvas = canvases.filter((el) => !name(el) && !el.getAttribute('aria-describedby')).map((el) => el.id || 'canvas');
        const textNodes = root ? Array.from(root.querySelectorAll('*')).filter((el) => visible(el) && (el.children.length === 0) && (el.textContent || '').trim()) : [];
        const fontUnder10 = textNodes.filter((el) => parseFloat(getComputedStyle(el).fontSize || '0') < 10).map((el) => ({ id:el.id || '', text:(el.textContent || '').trim().slice(0, 70), fontSize:getComputedStyle(el).fontSize, html:el.outerHTML.slice(0, 220) })).slice(0, 50);
        // v58.50: a 24px min-height box at a fractional y reads 23.9999 from getBoundingClientRect (1/64px layout units), so compare with a sub-pixel tolerance.
        const under24 = (v) => v < 24 - 0.01;
        const smallTargets = controls.filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (under24(r.width) || under24(r.height)); }).map((el) => {
          const r = el.getBoundingClientRect();
          const parentText = (el.parentElement?.textContent || '').replace(/\s+/g, ' ').trim();
          const inlineTextException = (el.tagName === 'A' || el.classList.contains('aio-term')) && getComputedStyle(el).display === 'inline' && parentText.length > name(el).length;
          // P1658: a clipped keyboard-only control is not a pointer target until focus, when it renders full size.
          const focusOnlyException = /rect\(0(px)?,? 0(px)?,? 0(px)?,? 0(px)?\)/.test(getComputedStyle(el).clip) && el.classList.contains('aio-basis-btn');
          return { id:el.id || '', text:name(el).slice(0, 60), width:Math.round(r.width), height:Math.round(r.height), exception:inlineTextException ? 'wcag-inline-text' : focusOnlyException ? 'keyboard-focus-only' : null };
        }).slice(0, 80);
        const smallTargetViolations = smallTargets.filter((row) => !row.exception);
        const smallTargetExceptions = smallTargets.filter((row) => !!row.exception);
        const modalContracts = Array.from(document.querySelectorAll('[role="dialog"],.modal,[id*="modal"]')).filter(visible).map((el) => ({ id:el.id || '', labelled:!!(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) }));
        return { routeId:id, active:!!root && (id === 'theme-detail' ? !!document.getElementById('page-themes')?.classList.contains('active') : root.classList.contains('active')), nameless, selectCount:controls.filter((el) => el.tagName === 'SELECT').length, selectsWithoutName, positiveTabindex, canvasCount:canvases.length, unnamedCanvas, fontUnder10Count:fontUnder10.length, fontUnder10, smallTargetViolationCount:smallTargetViolations.length, smallTargetViolations, smallTargetExceptionCount:smallTargetExceptions.length, smallTargetExceptions, skipLink:!!document.querySelector('.skip-link[href="#main-content"]'), modalContracts };
      }, routeKey);
      result.routes.push(audit);
    }
    result.status = result.routes.some((r) => !r.active || !r.skipLink || r.nameless.length || r.selectsWithoutName.length || r.positiveTabindex.length || r.unnamedCanvas.length || r.fontUnder10.length || r.smallTargetViolationCount || r.modalContracts.some((modal) => !modal.labelled)) || result.consoleErrors.length ? 'fail' : 'pass';
    // P1277: a passing report without a revision cannot be tied to the tested source.
    if (!result.appRevision || !result.gitHead) result.status = 'fail';
    result.certificationStatus = result.status === 'pass' ? 'PARTIAL_AUTOMATED' : 'FAILED_AUTOMATED';
  } catch (error) {
    result.status = 'fail';
    result.error = error.stack || error.message;
  } finally {
    writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
    await closeAll({ browser, server });
  }
  console.log(`[ci-accessibility-matrix] routes=${result.routes.length}, status=${result.status}, consoleErrors=${result.consoleErrors.length}, artifact=${outPath}`);
  if (result.status === 'fail') {
    // P1333: CI keeps only stdout, so name the failing route and the failing items there.
    const failing = result.routes.filter((r) => !r.active || !r.skipLink || r.nameless.length || r.selectsWithoutName.length || r.positiveTabindex.length || r.unnamedCanvas.length || r.fontUnder10.length || r.smallTargetViolationCount || r.modalContracts.some((modal) => !modal.labelled))
      .map((r) => ({ route: r.routeId, active: r.active, skipLink: r.skipLink, nameless: r.nameless.slice(0, 3), selects: r.selectsWithoutName.length, tabindex: r.positiveTabindex.length, canvas: r.unnamedCanvas.slice(0, 3), fontUnder10: r.fontUnder10.slice(0, 3), smallTargets: (r.smallTargetViolations || []).slice(0, 3) }));
    console.log('[ci-accessibility-matrix] FAILING ' + JSON.stringify({ error: result.error || null, revision: result.appRevision || null, gitHead: result.gitHead || null, consoleErrors: result.consoleErrors.slice(0, 3), routes: failing }).slice(0, 4000));
    process.exitCode = 1;
  }
}

main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
