#!/usr/bin/env node
// v59.70 (S12): the screener's setup row is one bar — 표에서 찾기, 시장, 섹터, + 조건, 보기 — plus the two view tabs.
// Owner decision D3 cut about 30 always-visible controls to that set and moved the ScreenDefinition JSON drawer to
// 개발자 모드. This gate counts what a reader actually sees above the ranking table on the real route, so a control
// added back to the bar (or a panel that stops folding) fails here instead of drifting in.
//
// Checks per viewport (desktop 1440, tablet 820, phone 390):
//   1. visible interactive controls above #screener-results-table on the 순위 view <= 10, each with an accessible name;
//   2. #scr-developer-drawer is not rendered without body.aio-dev-mode and is rendered with it;
//   3. `/` moves focus to 표에서 찾기 (not inside a text field, no modifier); Escape closes an open panel and returns
//      focus to the button that opened it.
import { chromium } from 'playwright';
import { closeAll, freePort, startLocalServer } from './lib/browser-gate.mjs';

const port = (Number(process.env.CI_SCREENER_CONTROLS_PORT) || await freePort());
const base = `http://127.0.0.1:${port}/`;
const MAX_TOP_LEVEL_CONTROLS = 10;
const viewports = [{ id: 'desktop', width: 1440, height: 1000 }, { id: 'tablet', width: 820, height: 1180 }, { id: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true }];
const failures = [];
const fail = (viewport, message) => failures.push(`[${viewport}] ${message}`);

const server = await startLocalServer(port, { label: 'screener-controls/server' });
let browser;
try {
  browser = await chromium.launch();
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, isMobile: !!viewport.isMobile, hasTouch: !!viewport.hasTouch, serviceWorkers: 'block' });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.route('**/*', (route) => (route.request().url().startsWith(base) ? route.continue() : route.abort()));
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => typeof window.showPage === 'function', null, { timeout: 30000 });
    await page.evaluate(() => window.showPage('screener'));
    await page.waitForFunction(() => document.querySelectorAll('#screener-results-body [data-aio-screener-ticker]').length > 0, null, { timeout: 45000 });

    const top = await page.evaluate(() => {
      const pageNode = document.getElementById('page-screener');
      // The setup area ends at the result status line; what follows (status actions, folds of excluded names, the
      // table and its scroll region) is the result, not setup.
      const table = document.getElementById('scr-table-status') || document.getElementById('screener-results-table');
      const selector = 'button, select, input:not([type="hidden"]), textarea, a[href], summary, [role="tab"], [role="button"], [tabindex]:not([tabindex="-1"])';
      const visible = (node) => {
        if (!node.getClientRects().length) return false;
        const style = getComputedStyle(node);
        return style.visibility !== 'hidden' && style.display !== 'none';
      };
      const name = (node) => (node.getAttribute('aria-label') || (node.labels && node.labels[0]?.textContent) || node.getAttribute('title') || node.textContent || node.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim();
      const nodes = [...pageNode.querySelectorAll(selector)].filter((node) => {
        if (!table || !(node.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING)) return false;
        if (node.closest('#scr-active-filter-chips')) return false; // chips are applied state, each removable; not setup controls
        return visible(node);
      });
      const unique = [...new Set(nodes.map((node) => node.closest('label') && node.tagName === 'INPUT' ? node : node))];
      return unique.map((node) => ({ tag: node.tagName.toLowerCase(), id: node.id || '', name: name(node).slice(0, 40) }));
    });
    if (top.length > MAX_TOP_LEVEL_CONTROLS) fail(viewport.id, `${top.length} visible setup controls (limit ${MAX_TOP_LEVEL_CONTROLS}): ${top.map((item) => item.id || `${item.tag}:${item.name}`).join(', ')}`);
    const unnamed = top.filter((item) => !item.name);
    if (unnamed.length) fail(viewport.id, `controls without an accessible name: ${unnamed.map((item) => item.id || item.tag).join(', ')}`);

    const drawer = await page.evaluate(() => {
      const node = document.getElementById('scr-developer-drawer');
      if (!node) return { exists: false };
      const off = getComputedStyle(node).display;
      document.body.classList.add('aio-dev-mode');
      const on = getComputedStyle(node).display;
      document.body.classList.remove('aio-dev-mode');
      return { exists: true, off, on, holdsEditor: !!node.querySelector('#scr-definition-editor') };
    });
    if (!drawer.exists) fail(viewport.id, '#scr-developer-drawer is missing');
    else {
      if (drawer.off !== 'none') fail(viewport.id, `developer drawer renders without 개발자 모드 (display ${drawer.off})`);
      if (drawer.on === 'none') fail(viewport.id, 'developer drawer stays hidden in 개발자 모드');
      if (!drawer.holdsEditor) fail(viewport.id, 'the ScreenDefinition editor is outside the developer drawer');
    }
    const editorVisible = await page.evaluate(() => { const node = document.getElementById('scr-definition-editor'); return !!node && node.getClientRects().length > 0; });
    if (editorVisible) fail(viewport.id, 'the ScreenDefinition JSON editor is visible to a reader');

    // Keyboard: `/` focuses 표에서 찾기; inside a text field it types.
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press('/');
    const searchFocused = await page.evaluate(() => document.activeElement?.id === 'scr-text-search' && document.getElementById('scr-text-search').value === '');
    if (!searchFocused) fail(viewport.id, '`/` did not move focus to 표에서 찾기');
    await page.keyboard.press('Escape');

    // + 조건 and 보기 open a panel; Escape closes it and returns focus to the opener.
    for (const [buttonId, panelId] of [['scr-add-condition', 'scr-condition-panel'], ['scr-view-button', 'scr-view-panel']]) {
      const button = page.locator(`#${buttonId}`);
      if (!(await button.count())) { fail(viewport.id, `#${buttonId} is missing`); continue; }
      await button.click();
      const opened = await page.evaluate(([b, p]) => document.getElementById(p)?.hidden === false && document.getElementById(b).getAttribute('aria-expanded') === 'true', [buttonId, panelId]);
      if (!opened) { fail(viewport.id, `#${buttonId} did not open #${panelId}`); continue; }
      await page.keyboard.press('Escape');
      const closed = await page.evaluate(([b, p]) => ({ hidden: document.getElementById(p)?.hidden === true, expanded: document.getElementById(b).getAttribute('aria-expanded'), focus: document.activeElement?.id }), [buttonId, panelId]);
      if (!closed.hidden || closed.expanded !== 'false' || closed.focus !== buttonId) fail(viewport.id, `Escape on #${panelId} left ${JSON.stringify(closed)}`);
    }
    if (pageErrors.length) fail(viewport.id, `page errors: ${pageErrors.slice(0, 3).join(' | ')}`);
    console.log(`[screener-controls] ${viewport.id}: ${top.length} top-level controls (${top.map((item) => item.id || item.tag).join(', ')})`);
    await context.close();
  }
} finally {
  await closeAll({ browser, server });
}

if (failures.length) {
  console.error('Screener controls contract failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`Screener controls contract OK: <= ${MAX_TOP_LEVEL_CONTROLS} top-level controls, developer drawer only in 개발자 모드, / and Escape keys, at ${viewports.length} viewports.`);
