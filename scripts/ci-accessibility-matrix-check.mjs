// H2-10: all-route Chromium accessibility contract.  This is a deterministic
// structural/keyboard audit; screen-reader/NVDA evidence remains manual.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.CI_A11Y_PORT || 8901);
const baseUrl = `http://127.0.0.1:${port}/index.html`;
const routes = ['home','signal','breadth','sentiment','briefing','market-news','technical','screener','ticker','portfolio','themes','theme-detail','macro','fxbond','fundamental','options','principles','masters','atlas','guide']; // v53.72: atlas reference route added
const outPath = process.env.CI_A11Y_OUT
  ? resolve(root, process.env.CI_A11Y_OUT)
  : resolve(root, '_artifacts', 'accessibility-matrix-audit.json');

function startServer() {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let ready = false;
    const onReady = () => { if (!ready) { ready = true; resolvePromise(child); } };
    child.stdout.on('data', (data) => { if (String(data).includes('AIO local server')) onReady(); });
    child.stderr.on('data', (data) => process.stderr.write(`[server] ${data}`));
    child.on('error', reject);
    child.on('exit', (code) => { if (!ready) reject(new Error(`server exited early (${code})`)); });
    setTimeout(onReady, 2000);
  });
}

async function main() {
  mkdirSync(dirname(outPath), { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch();
  const result = { viewport: { width: 390, height: 844 }, routes: [], manualEvidence: ['NVDA/screen-reader path not automated'], consoleErrors: [] };
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
        const smallTargets = controls.filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24); }).map((el) => ({ id:el.id || '', text:name(el).slice(0, 60), width:Math.round(el.getBoundingClientRect().width), height:Math.round(el.getBoundingClientRect().height) })).slice(0, 80);
        const modalContracts = Array.from(document.querySelectorAll('[role="dialog"],.modal,[id*="modal"]')).filter(visible).map((el) => ({ id:el.id || '', labelled:!!(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) }));
        return { routeId:id, active:!!root && (id === 'theme-detail' ? !!document.getElementById('page-themes')?.classList.contains('active') : root.classList.contains('active')), nameless, selectCount:controls.filter((el) => el.tagName === 'SELECT').length, selectsWithoutName, positiveTabindex, canvasCount:canvases.length, unnamedCanvas, fontUnder10Count:fontUnder10.length, fontUnder10, smallTargetCount:smallTargets.length, smallTargets, skipLink:!!document.querySelector('.skip-link[href="#main-content"]'), modalContracts };
      }, routeKey);
      result.routes.push(audit);
    }
    result.status = result.routes.some((r) => !r.active || r.nameless.length || r.selectsWithoutName.length || r.positiveTabindex.length || r.unnamedCanvas.length || r.fontUnder10.length || r.smallTargetCount > 0) || result.consoleErrors.length ? 'fail' : 'pass';
  } catch (error) {
    result.status = 'fail';
    result.error = error.stack || error.message;
  } finally {
    writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
    await browser.close();
    server.kill();
  }
  console.log(`[ci-accessibility-matrix] routes=${result.routes.length}, status=${result.status}, consoleErrors=${result.consoleErrors.length}, artifact=${outPath}`);
  if (result.status === 'fail') process.exitCode = 1;
}

main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
