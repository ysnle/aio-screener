// v52.58 H3-H/H3-I: real Chromium first-viewport, keyboard, and accessible-name audit.
// This is intentionally separate from the 22x4 geometry matrix: it exercises the
// route's real showPage() lifecycle and records the human-surface contract per page.

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..');
const PORT = Number(process.env.CI_HUMAN_SURFACE_PORT || 8893);
const BASE_URL = `http://127.0.0.1:${PORT}/index.html`;
const OUT_PATH = resolve(root, '_artifacts', 'critical10-human-surface-audit.json');
const ROUTES = ['home','signal','breadth','sentiment','briefing','technical','macro','fxbond','fundamental','themes'];

function startServer() {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(PORT)], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let started = false;
    const ready = () => { if (!started) { started = true; resolvePromise(child); } };
    child.stdout.on('data', (data) => { if (String(data).includes('AIO local server')) ready(); });
    child.stderr.on('data', (data) => process.stderr.write(`[server] ${data}`));
    child.on('error', reject);
    child.on('exit', (code) => { if (!started) reject(new Error(`server exited early (code ${code})`)); });
    setTimeout(ready, 2000);
  });
}

async function main() {
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch();
  const result = { version: null, viewport: null, routes: [], consoleErrors: [], generatedAt: new Date().toISOString() };
  let exitCode = 0;
  try {
    const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
    result.viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
    page.on('pageerror', (error) => result.consoleErrors.push(`[pageerror] ${error.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !/net::ERR_FAILED/.test(msg.text()) && !/\[AIO:api\].*warn\s*→\s*error/.test(msg.text()) && !/\[AIO:fetch\]\s*TG .*모든 프록시\(6개\) 실패 Failed to fetch/.test(msg.text())) {
        result.consoleErrors.push(`[console.error] ${msg.text()}`);
      }
    });
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith(`http://127.0.0.1:${PORT}/`)) return route.continue();
      return route.abort();
    });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => window.AIO && typeof window.showPage === 'function', { timeout: 30000 });
    result.version = await page.evaluate(() => window.APP_VERSION || (window.AIO && window.AIO.version) || null);

    for (const routeId of ROUTES) {
      await page.evaluate((id) => window.showPage(id, null), routeId);
      await page.waitForTimeout(250);
      const surface = await page.evaluate((id) => {
        const audit = window.AIO.getCritical10HumanSurfaceAudit({ pages: [id], viewportHeight: window.innerHeight });
        const root = document.getElementById('page-' + id);
        const focusables = root ? Array.from(root.querySelectorAll('button,a[href],input,select,textarea,[role="button"],[data-action]')).filter((el) => {
          const cs = getComputedStyle(el);
          return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getClientRects().length && !el.disabled;
        }) : [];
        return {
          audit,
          focusableCount: focusables.length,
          pageTitle: root && (root.querySelector('.page-title')?.textContent || '').trim().slice(0, 120)
        };
      }, routeId);

      await page.evaluate(() => { if (document.body && document.body.focus) document.body.focus(); });
      const tabSequence = [];
      for (let i = 0; i < 36; i++) {
        await page.keyboard.press('Tab');
        const focus = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          return { tag: el.tagName, id: el.id || '', name: (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100), tabindex: el.getAttribute('tabindex') || '' };
        });
        if (focus) tabSequence.push(focus);
      }
      const row = { routeId, status: surface.audit.status, focusableCount: surface.focusableCount, pageTitle: surface.pageTitle, audit: surface.audit, tabSequence: tabSequence.slice(0, 24) };
      result.routes.push(row);
      if (surface.audit.status === 'fail' || tabSequence.length === 0) exitCode = 1;
    }
    if (result.consoleErrors.length) exitCode = 1;
    result.status = exitCode ? 'fail' : 'pass';
    writeFileSync(OUT_PATH, JSON.stringify(result, null, 2) + '\n', 'utf8');
    console.log(`[ci-critical10-human-surface] routes=${result.routes.length}, status=${result.status}, consoleErrors=${result.consoleErrors.length}, artifact=${OUT_PATH}`);
    if (exitCode) {
      for (const row of result.routes.filter((item) => item.status === 'fail')) console.error(` - ${row.routeId}: ${JSON.stringify(row.audit)}`);
      for (const error of result.consoleErrors.slice(0, 10)) console.error(` - ${error}`);
    }
  } catch (error) {
    result.status = 'fail';
    result.error = error.stack || error.message;
    writeFileSync(OUT_PATH, JSON.stringify(result, null, 2) + '\n', 'utf8');
    console.error(`[ci-critical10-human-surface] ${result.error}`);
    exitCode = 1;
  } finally {
    await browser.close();
    server.kill();
  }
  process.exitCode = exitCode;
}

main();
