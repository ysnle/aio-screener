// Shared drive helpers and the per-feature runner for verify-aio.
// Every assertion waits for an observable state; a step never passes on loading placeholders.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { evidenceRoot, repoVersion } from './instance.mjs';

export const NAV = (label) => `.sidebar .nav-item[role="button"]:has(.label:text-is("${label}"))`;
export const TAB = (label) => `#aio-hub-tabs button.aio-hub-tab:text-is("${label}")`;
// Loading/placeholder copy the shell prints before data arrives. A text check must never accept these.
export const PLACEHOLDER = /^(—|-|판정 대기|불러오는 중|.*불러오는 중입니다\.?|기록을 불러오는 중입니다\.?|종가 기록을 불러오는 중입니다\.?|순위 자료를 불러오는 중입니다\.?)$/;
// Cross-origin provider calls are CORS-blocked from 127.0.0.1 (the Worker allows the Pages origin only).
export const NETWORK_NOISE = /CORS policy|Failed to load resource|net::ERR_|\[AIO:api\]/;

export const activePage = (page) => page.evaluate(() => document.querySelector('.page.active')?.id || null);
export const visibleText = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  return el && el.offsetParent !== null ? el.innerText.trim() : '';
}, sel);

export async function expectActive(page, pageId, timeout = 20000) {
  await page.waitForFunction((id) => document.querySelector('.page.active')?.id === id, pageId, { timeout });
  return { activePage: await activePage(page), hash: await page.evaluate(() => location.hash) };
}

// Wait until `sel` holds real content: visible, not a placeholder, optionally matching `pattern`.
export async function expectText(page, sel, { pattern = null, min = 1, timeout = 25000 } = {}) {
  await page.waitForFunction(({ s, p, m, ph }) => {
    const el = document.querySelector(s);
    if (!el) return false;
    const t = el.innerText.trim();
    if (t.length < m || new RegExp(ph).test(t)) return false;
    return p ? new RegExp(p).test(t) : true;
  }, { s: sel, p: pattern ? pattern.source : null, m: min, ph: PLACEHOLDER.source }, { timeout }).catch(async (e) => {
    const seen = await page.evaluate((s) => document.querySelector(s)?.innerText.trim().slice(0, 120) ?? '(missing)', sel);
    throw new Error(`${sel} never showed real content${pattern ? ` matching ${pattern}` : ''} (saw "${seen}")`);
  });
  return { [sel]: (await visibleText(page, sel)).slice(0, 160) };
}

export async function expectCount(page, sel, min = 1, timeout = 25000) {
  await page.waitForFunction(({ s, m }) => document.querySelectorAll(s).length >= m, { s: sel, m: min }, { timeout }).catch(async () => {
    throw new Error(`${sel} count < ${min} (saw ${await page.$$eval(sel, (n) => n.length)})`);
  });
  return { [sel]: await page.$$eval(sel, (n) => n.length) };
}

export const hubTabs = (page) => page.$$eval('#aio-hub-tabs button.aio-hub-tab', (b) => b.map((x) => x.textContent.trim()));

export async function openFromNav(page, label, pageId) {
  await page.click(NAV(label));
  return { ...(await expectActive(page, pageId)), tabs: await hubTabs(page) };
}

export async function tabTo(page, label, pageId) {
  await page.click(TAB(label));
  return expectActive(page, pageId);
}

export async function expectTabs(page, expected) {
  const tabs = await hubTabs(page);
  if (JSON.stringify(tabs) !== JSON.stringify(expected)) throw new Error(`hub tabs ${JSON.stringify(tabs)} != ${JSON.stringify(expected)}`);
  return { tabs };
}

export async function bootPage(context, baseUrl, viewport) {
  const page = await context.newPage();
  await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.showPage === 'function' && document.querySelector('.page.active'), null, { timeout: 30000 });
  if (viewport !== 'desktop') {
    // Phone and iPad-portrait layouts (<= 1100px) hide the sidebar behind the menu toggle; open it before each sidebar click.
    const orig = page.click.bind(page);
    page.click = async (sel, o) => {
      if (String(sel).startsWith('.sidebar')) {
        const open = await page.evaluate(() => { const s = document.querySelector('.sidebar'); if (!s) return false; const r = s.getBoundingClientRect(); return r.right > 0 && r.left >= 0 && getComputedStyle(s).visibility !== 'hidden'; });
        if (!open) await orig('.hamburger-btn:visible, #sidebar-toggle-btn:visible', o).catch(() => {});
      }
      return orig(sel, o);
    };
  }
  return page;
}

// tablet: iPad portrait (820x1180) — the desktop and phone runs alone do not show the one-column tablet layout (R669).
export const VIEWPORTS = { desktop: { width: 1440, height: 1000 }, tablet: { width: 820, height: 1180 }, phone: { width: 390, height: 844 } };

export async function driveOne(browser, id, spec, { baseUrl, run, viewport, sendAi }) {
  const dir = join(evidenceRoot, run, `${id}-${viewport}`);
  mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({ viewport: VIEWPORTS[viewport] || VIEWPORTS.desktop, locale: 'ko-KR', serviceWorkers: 'block' });
  const consoleErrors = [];
  const pageErrors = [];
  const failedLocal = [];
  // Classify on the full text: a long CORS message is truncated before its 'CORS policy' clause.
  context.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  context.on('weberror', (e) => pageErrors.push(String(e.error()?.message || e.error()).slice(0, 300)));
  context.on('response', (r) => { if (r.url().startsWith(baseUrl) && r.status() >= 400) failedLocal.push(`${r.status()} ${r.url().slice(baseUrl.length)}`); });
  const steps = [];
  let ok = true;
  let page = null;
  try {
    page = await bootPage(context, baseUrl, viewport);
    for (const [label, fn] of spec.steps) {
      const started = Date.now();
      try {
        const observed = await fn(page, { sendAi, baseUrl, viewport, context });
        steps.push({ step: label, ok: true, ms: Date.now() - started, observed });
      } catch (e) {
        ok = false;
        steps.push({ step: label, ok: false, ms: Date.now() - started, error: String(e.message).split('\n')[0].slice(0, 400), activePage: await activePage(page).catch(() => null) });
      } finally {
        await page.screenshot({ path: join(dir, `${String(steps.length).padStart(2, '0')}.png`) }).catch(() => {});
      }
      if (!ok) break;
    }
    const aria = await page.locator('.page.active').ariaSnapshot().catch((e) => `aria snapshot failed: ${e.message}`);
    writeFileSync(join(dir, 'final.aria.yml'), aria);
  } catch (e) {
    ok = false;
    steps.push({ step: 'boot', ok: false, error: String(e.message).split('\n')[0].slice(0, 400) });
  } finally {
    await context.close();
  }
  if (failedLocal.length || pageErrors.length) ok = false;
  const unexpectedConsoleErrors = consoleErrors.filter((e) => !NETWORK_NOISE.test(e)).map((e) => e.slice(0, 300));
  const report = {
    feature: id, title: spec.title, viewport, ok, url: baseUrl, version: repoVersion(), finishedAt: new Date().toISOString(),
    steps, pageErrors, unexpectedConsoleErrors, networkNoiseCount: consoleErrors.length - unexpectedConsoleErrors.length, failedLocalRequests: failedLocal
  };
  writeFileSync(join(dir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id} [${viewport}] — ${steps.filter((s) => s.ok).length}/${spec.steps.length} steps, uncaught ${pageErrors.length}, unexpected console ${unexpectedConsoleErrors.length} (+${report.networkNoiseCount} CORS/network noise), local 4xx/5xx ${failedLocal.length} → ${dir}`);
  steps.filter((s) => !s.ok).forEach((s) => console.log(`      x ${s.step}: ${s.error}`));
  if (pageErrors.length) console.log(`      x uncaught: ${pageErrors.slice(0, 3).join(' | ')}`);
  if (unexpectedConsoleErrors.length) console.log(`      ! console: ${unexpectedConsoleErrors.slice(0, 3).join(' | ')}`);
  if (failedLocal.length) console.log(`      x local failures: ${failedLocal.slice(0, 5).join(' | ')}`);
  return report;
}
