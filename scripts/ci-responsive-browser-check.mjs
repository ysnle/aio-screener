// P1618: real route lifecycle, local overflow, drawer, theme and AI input acceptance.
// This gate uses local artifacts and aborts external requests; no paid AI is called.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { atomicWriteFile } from './lib/atomic-write.mjs';
import { closeAll, startLocalServer } from './lib/browser-gate.mjs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROUTE_IDS } from '../src/app/routes.js';
import { RESPONSIVE_QA_VIEWPORTS } from './desktop-qa-config.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.CI_RESPONSIVE_PORT || 8934);
const base = `http://127.0.0.1:${port}`;
const out = resolve(root, '_artifacts', 'responsive-browser');
const isolatedInjection = process.env.AIO_RESPONSIVE_INJECT === '1';
const version = JSON.parse(readFileSync(resolve(root, 'version.json'), 'utf8')).version;
const failures = [];
const observations = [];
const check = (condition, message, detail) => { if (!condition) failures.push({ message, detail }); };
// v57.60: screenshots are captured as buffers and written atomically so a Windows file lock
// (viewer/indexer holding the previous PNG) retries instead of failing the viewport.
const snap = async (page, name, options = {}) => atomicWriteFile(resolve(out, name), await page.screenshot(options));
// v57.60: wait for the state the next check reads instead of a fixed sleep; on timeout the check reports it.
const settle = (page, predicate, arg) => page.waitForFunction(predicate, arg, { timeout: 5000 }).catch(() => {});
mkdirSync(out, { recursive: true });
let server, browser;
try {
  server = await startLocalServer(port, { label: 'responsive/server' });
  browser = await chromium.launch({ headless: true });
  // Viewports are independent pages (own context), so they run together; one failure no longer hides the others.
  await Promise.all(RESPONSIVE_QA_VIEWPORTS.map(async (viewport) => { try {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1, hasTouch: true });
    page.on('pageerror', (error) => failures.push({ message: `${viewport.name}: runtime error (P1618)`, detail: error.message }));
    await page.route('**/*', (route) => route.request().url().startsWith(base) || route.request().url().startsWith('data:') ? route.continue() : route.abort());
    await page.goto(`${base}/index.html#home`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.showPage === 'function' && document.querySelector('.page.active'), { timeout: 30000 });
    if (isolatedInjection) {
      await page.addStyleTag({ content: readFileSync(resolve(root, 'src/ui/styles/responsive.css'), 'utf8') });
      await page.evaluate(async () => {
        const { installResponsiveShell } = await import('./src/ui/components/responsive-shell.js');
        window.__responsiveFixtureCleanup = installResponsiveShell(window, document);
      });
    }
    await page.waitForTimeout(350);
    if (!isolatedInjection) {
      // P1619: actual production hooks expose app identity and one visible futures value.
      check(await page.locator('#app-version-badge').isVisible() && (await page.locator('#app-version-badge').innerText()).trim() === version, `${viewport.name}: app version is not visible/current`);
      check(!/VIX/.test(await page.locator('#app-version-badge').innerText()), `${viewport.name}: VIX overwrites app identity`);
      check(!/베타/.test(await page.locator('#topbar-ai-btn').innerText()) && (await page.locator('#ai-panel-title').innerText()).trim() === 'AI 도우미', `${viewport.name}: stale AI beta label`);
      check(await page.locator('.kpi-fallback[hidden]').evaluateAll((elements) => elements.every((el) => getComputedStyle(el).display === 'none')), `${viewport.name}: hidden futures fallback is visibly duplicated`);
    }
    for (const route of ROUTE_IDS) {
      await page.evaluate((id) => window.showPage(id, null), route);
      await page.waitForTimeout(140);
      const state = await page.evaluate(() => {
        const page = document.querySelector('.page.active');
        const rect = page.getBoundingClientRect();
        const content = document.getElementById('main-content');
        const localScroll = (el) => {
          for (let ancestor = el.parentElement; ancestor && ancestor !== content; ancestor = ancestor.parentElement) {
            const style = getComputedStyle(ancestor);
            if (/auto|scroll/.test(style.overflowX)) return true;
          }
          return false;
        };
        const clipped = [...page.querySelectorAll('*')].filter((el) => {
          if (el.closest('[aria-hidden="true"],[hidden]') || !el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') return false;
          const box = el.getBoundingClientRect();
          return box.width > 0 && box.height > 0 && box.right > innerWidth + 2 && !localScroll(el);
        }).slice(0, 15).map((el) => ({ tag: el.tagName, id: el.id, className: String(el.className).slice(0, 80), right: Math.round(el.getBoundingClientRect().right), style: el.getAttribute('style')?.slice(0, 150) }));
        return { active: page.id, width: rect.width, docOverflow: document.documentElement.scrollWidth - innerWidth, clipped, textLength: page.innerText.length,
          zeroCharts: [...page.querySelectorAll('canvas')].filter((el) => el.getClientRects().length && (el.clientWidth === 0 || el.clientHeight === 0)).map((el) => el.id) };
      });
      observations.push({ viewport: viewport.name, route, ...state });
      check(state.docOverflow <= 2 && state.width <= viewport.width + 2, `${viewport.name}/${route}: page overflow`, state);
      check(state.clipped.length === 0, `${viewport.name}/${route}: content clipped outside local scroll`, state.clipped);
      check(state.textLength > 0, `${viewport.name}/${route}: content unavailable`, state);
      check(state.zeroCharts.length === 0, `${viewport.name}/${route}: zero-size chart`, state.zeroCharts);
    }
    // v57.81 (phone/iPad audit): a tap fired pointerout right after pointerup and closed the basis card inside the
    // same tap, so no [title]/data-basis explanation was readable on touch. A tap on a non-focusable explained element
    // inside .page (and on the topbar quote status) must leave #aio-basis-card open, inside the viewport.
    // v58.53: a folded element is not a visible target — Chromium keeps a box size for closed <details> content
    // (::details-content is content-visibility:hidden), so the size check alone picked cards inside a closed fold.
    await page.evaluate(() => window.showPage('macro', null));
    await settle(page, () => !!document.querySelector('#page-macro.active [title], #page-macro.active [data-basis]'));
    const basisTarget = await page.evaluate(() => {
      const focusable = 'a,button,input,select,textarea,[tabindex],summary,label';
      const el = [...document.querySelectorAll('.page.active [title], .page.active [data-basis]')].find((node) => !node.matches(focusable) && !node.closest(focusable) && !node.closest('details:not([open])') && !node.querySelector(focusable) && node.getBoundingClientRect().width > 8 && node.getBoundingClientRect().height > 8);
      el?.scrollIntoView({ block: 'center' });
      return !!el;
    });
    check(basisTarget, `${viewport.name}: no explained element to tap on #macro (v57.81)`);
    if (basisTarget) {
      await page.waitForTimeout(150);
      const point = await page.evaluate(() => {
        const focusable = 'a,button,input,select,textarea,[tabindex],summary,label';
        const el = [...document.querySelectorAll('.page.active [title], .page.active [data-basis]')].find((node) => !node.matches(focusable) && !node.closest(focusable) && !node.closest('details:not([open])') && !node.querySelector(focusable) && node.getBoundingClientRect().width > 8 && node.getBoundingClientRect().height > 8);
        const box = el.getBoundingClientRect();
        return { x: box.left + Math.min(box.width / 2, 20), y: box.top + box.height / 2 };
      });
      for (const [name, at] of [['page', point], ['topbar', null]]) {
        const target = at || await page.locator('#live-quote-ts').boundingBox().then((box) => box && { x: box.x + box.width / 2, y: box.y + box.height / 2 });
        if (!target) { check(false, `${viewport.name}: topbar quote status not visible (v57.81)`); continue; }
        await page.touchscreen.tap(target.x, target.y);
        await page.waitForTimeout(300);
        const card = await page.evaluate(() => { const el = document.getElementById('aio-basis-card'); const box = el?.getBoundingClientRect(); return el && { visible: !el.hidden && box.width > 0, left: box.left, right: box.right, top: box.top, bottom: box.bottom, text: el.textContent.slice(0, 60) }; });
        check(!!card?.visible && card.left >= 0 && card.right <= viewport.width + 1 && card.top >= 0 && card.bottom <= viewport.height + 1, `${viewport.name}: a tap on an explained ${name} element must leave #aio-basis-card visible in the viewport (v57.81)`, card);
        // v58.75: the bottom-left corner sits on the sidebar's 단축키 button on tablet1024 (CI fonts are taller), so the
        // outside tap goes to the first corner whose hit target is not interactive and not the card.
        const outside = await page.evaluate(({ w, h }) => [[4, h - 4], [w - 4, h - 4], [w / 2, h - 4], [w - 4, 80]].find(([x, y]) => {
          const hit = document.elementFromPoint(x, y);
          return hit && !hit.closest('a,button,input,select,textarea,summary,label,[role="button"],[tabindex],#aio-basis-card');
        }) || [4, h - 4], { w: viewport.width, h: viewport.height });
        await page.touchscreen.tap(outside[0], outside[1]);
        await page.waitForTimeout(150);
        check(await page.evaluate(() => document.getElementById('aio-basis-card')?.hidden === true), `${viewport.name}: a tap outside must close the basis card (v57.81)`);
      }
    }
    await page.evaluate(() => window.showPage('signal', null));
    await page.waitForSelector('#regime-board .regime-axis');
    check(await page.locator('#regime-board .regime-axis').count() === 6, `${viewport.name}: six meaningful market axes absent (P1628)`);
    check(await page.locator('#regime-board .regime-axis-history svg').count() >= 4, `${viewport.name}: dated market charts absent (P1628)`);
    check(await page.locator('.regime-scenario-card').count() === 3, `${viewport.name}: conditional market paths absent (P1628)`);
    check(!await page.locator('#regime-positioning').count(), `${viewport.name}: retired weekly positioning widget remains (P1628)`);
    // v58.56 (re-audit #16): the 한국 시장 참고 card is a one-line fold (summary = latest KOSPI close); the consumers are
    // rendered inside it and shown once it opens.
    await page.evaluate(() => { const fold = document.getElementById('regime-kr-fold'); if (fold) fold.open = true; });
    check(await page.locator('#regime-kr-summary').isVisible() && await page.locator('#regime-board-kr [data-market="KR"]').count() >= 2 && await page.locator('#regime-kr-participation').isVisible(), `${viewport.name}: Korean index and participation consumers absent (P1628)`);
    await page.evaluate(() => { const fold = document.getElementById('regime-kr-fold'); if (fold) fold.open = false; });
    check(await page.locator('.regime-scenario-card .regime-scenario-more[open]').count() === 0, `${viewport.name}: scenario conditions are not folded behind the reading (P1630)`);
    await snap(page, `${viewport.name}-market-regime.png`, { fullPage: true });
    const overlayRoute = await page.evaluate(async () => { window.showPage('glossary', null); await new Promise(r => setTimeout(r, 50)); const state = { active: document.querySelector('.page.active')?.id || null, modal: document.getElementById('glossary-modal')?.style.display !== 'none' }; window._aioCloseGlossary?.(); return state; });
    check(overlayRoute.active === 'page-guide' && overlayRoute.modal, `${viewport.name}: #glossary overlay route left a blank screen (P1630)`, overlayRoute);
    await page.evaluate(() => window.showPage('home', null));
    // v58.54 (design 4a, owner user-first): the drawer is for iPad portrait and phones (<1024); iPad landscape keeps a
    // fixed, operable sidebar and no menu button. openNav() opens the drawer only where one exists.
    const drawer = viewport.width < 1024;
    const openNav = async () => { if (drawer) await page.locator('#sidebar-toggle-btn').click(); };
    const navReturn = drawer ? '#sidebar-toggle-btn' : '.sidebar [data-action="openGlossary"]';
    if (!drawer) {
      check(await page.locator('.sidebar').evaluate((el) => { const box = el.getBoundingClientRect(); return !el.inert && el.getAttribute('aria-hidden') !== 'true' && box.left >= 0 && box.width >= 180 && getComputedStyle(el).visibility !== 'hidden'; }), `${viewport.name}: iPad-landscape sidebar is not a fixed, operable sidebar (v58.54)`);
      check(!await page.locator('#sidebar-toggle-btn').isVisible(), `${viewport.name}: iPad landscape shows a drawer button beside a fixed sidebar (v58.54)`);
    }
    if (drawer) {
    await page.locator('#sidebar-toggle-btn').click();
    check(await page.locator('.sidebar').evaluate((el) => el.getAttribute('aria-modal') === 'true' && !el.inert), `${viewport.name}: navigation drawer did not open`);
    check(await page.locator('.main').evaluate((el) => el.inert), `${viewport.name}: background is interactive under drawer`);
    await page.keyboard.press('Shift+Tab');
    check(await page.evaluate(() => document.querySelector('.sidebar').contains(document.activeElement)), `${viewport.name}: drawer focus escaped`);
    await page.keyboard.press('Escape');
    check(await page.locator('#sidebar-toggle-btn').evaluate((el) => document.activeElement === el && el.getAttribute('aria-expanded') === 'false'), `${viewport.name}: Escape did not restore focus`);
    await page.locator('#sidebar-toggle-btn').click();
    await page.locator('.aio-navigation-backdrop').click({ position: { x: viewport.width - 10, y: 20 }, force: true });
    check(!await page.locator('body').evaluate((el) => el.classList.contains('aio-navigation-open')), `${viewport.name}: backdrop failed to close drawer`);
    }
    // Theme uses the existing product control; no separate responsive theme state.
    await openNav();
    await page.locator('#sidebar-theme-btn').click();
    await page.keyboard.press('Escape');
    const firstTheme = await page.locator('body').evaluate((el) => el.classList.contains('dark-theme'));
    await snap(page, `${viewport.name}-theme-1.png`);
    await openNav(); await page.locator('#sidebar-theme-btn').click(); await page.keyboard.press('Escape');
    const secondTheme = await page.locator('body').evaluate((el) => el.classList.contains('dark-theme'));
    check(firstTheme !== secondTheme, `${viewport.name}: theme did not change`, { firstTheme, secondTheme });
    // P1620: the actual glossary renderer must remain readable in both themes and close the drawer.
    for (const dark of [false, true]) {
      await openNav();
      if (await page.locator('body').evaluate((el) => el.classList.contains('dark-theme')) !== dark) await page.locator('#sidebar-theme-btn').click();
      await page.locator('.sidebar [data-action="openGlossary"]').click();
      await settle(page, () => { const modal = document.getElementById('glossary-modal'); return !!modal && getComputedStyle(modal).display !== 'none' && modal.contains(document.activeElement) && !document.body.classList.contains('aio-navigation-open'); });
      const glossary = await page.locator('#glossary-modal').evaluate((modal) => {
        const rgb = (color) => color.match(/[\d.]+/g).slice(0, 3).map(Number);
        const luminance = (color) => rgb(color).map((value) => value / 255).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
        const background = luminance(getComputedStyle(modal.firstElementChild).backgroundColor);
        const ratios = ['h2', '.aio-glossary-term', '.aio-glossary-item > div:last-child', '#glossary-search', '#glossary-cats [aria-pressed="true"]'].map((selector) => {
          const element = modal.querySelector(selector), foreground = luminance(getComputedStyle(element).color);
          return { selector, ratio: (Math.max(background, foreground) + .05) / (Math.min(background, foreground) + .05) };
        });
        const rect = modal.firstElementChild.getBoundingClientRect();
        return { ratios, right: rect.right, left: rect.left, bottom: rect.bottom, focused: modal.contains(document.activeElement), drawer: document.body.classList.contains('aio-navigation-open') };
      });
      check(glossary.ratios.every((entry) => entry.ratio >= 4.5), `${viewport.name}: glossary text contrast in ${dark ? 'dark' : 'light'} theme (P1620)`, glossary);
      check(glossary.left >= 0 && glossary.right <= viewport.width && glossary.bottom <= viewport.height && glossary.focused && !glossary.drawer, `${viewport.name}: glossary modal conflicts with compact navigation (P1620)`, glossary);
      await page.locator('#glossary-search').fill('RRG');
      check(await page.locator('.aio-glossary-item').count() > 0, `${viewport.name}: glossary search unavailable (P1620)`);
      await snap(page, `${viewport.name}-glossary-${dark ? 'dark' : 'light'}.png`);
      await page.keyboard.press('Escape');
      check(!await page.locator('#glossary-modal').isVisible() && await page.locator(navReturn).evaluate((el) => document.activeElement === el), `${viewport.name}: glossary Escape failed to restore a visible focus (P1620)`);
    }
    await page.evaluate(() => window.showPage('themes', null));
    await settle(page, () => !!document.querySelector('.theme-strength-table > tbody > tr[data-group]'));
    const constituents = await page.evaluate(async () => {
      const { buildGroupStrength } = await import('./src/domain/themes/group-strength.js');
      const model = buildGroupStrength({ themes: window.THEME_MAP || [], rows: window.AIO_ARCH?.getScreenerState?.()?.rows || [], sortKey: window._aioThemeStrengthSort || 'ret3m' });
      return [...document.querySelectorAll('.theme-strength-table > tbody > tr[data-group]')].map((row) => ({ id: row.dataset.group, actual: [...row.querySelectorAll('.theme-strength-constituents button')].map((node) => node.textContent), expected: model.groups.find((group) => group.id === row.dataset.group)?.constituents.map((entry) => entry.sym) }));
    });
    check(constituents.length > 0 && constituents.every((row) => JSON.stringify(row.actual) === JSON.stringify(row.expected)), `${viewport.name}: theme table omits listed members (P1620)`, constituents);
    // P1622: expanding constituent comparison must preserve members, missingness and focus.
    await page.locator('[data-compare-group]').first().click();
    check(await page.locator('.theme-member-table tbody tr').count() === constituents[0].expected?.length, `${viewport.name}: intra-theme comparison loses constituents (P1622)`);
    check(await page.locator('[data-compare-group]').first().evaluate((el) => el.getAttribute('aria-expanded') === 'true' && document.activeElement === el), `${viewport.name}: comparison expansion loses focus (P1622)`);
    await snap(page, `${viewport.name}-theme-comparison.png`);
    await page.evaluate(() => window.showPage('home', null));
    // v57.76: the five home breadth cards are replaced by one link to the 시장 폭 screen.
    check(await page.locator('.home-breadth-cards').count() === 0 && await page.locator('#home-participation .home-breadth-link[data-action="showPage"][data-arg="breadth"]').count() === 1, `${viewport.name}: home must link to 시장 폭 instead of repeating its breadth cards (v57.76)`);
    await page.locator('#topbar-ai-btn').click();
    await settle(page, () => { const panel = document.getElementById('ai-panel'); return !!panel?.classList.contains('open') && !!document.querySelector('.app')?.inert && !panel.getAnimations().some((animation) => animation.playState === 'running'); });
    const ai = await page.locator('#ai-panel').evaluate((el) => {
      const panel = el.getBoundingClientRect(), input = document.getElementById('ai-panel-inp').getBoundingClientRect();
      return { open: el.classList.contains('open'), panel: { left: panel.left, right: panel.right, bottom: panel.bottom }, input: { left: input.left, right: input.right, bottom: input.bottom }, mainWidth: document.querySelector('.app').getBoundingClientRect().width, height: innerHeight };
    });
    check(ai.open && ai.panel.left >= -1 && ai.panel.right <= viewport.width + 1 && ai.input.right <= viewport.width + 1 && ai.input.bottom <= ai.height + 1, `${viewport.name}: AI panel/input clipped`, ai);
    check(ai.mainWidth >= viewport.width - 2, `${viewport.name}: AI opening shrank page to desktop split view`, ai);
    check(await page.locator('.app').evaluate((el) => el.inert), `${viewport.name}: AI overlay background is still interactive`);
    await page.locator('#ai-panel-inp').focus();
    await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
    check(await page.locator('#ai-panel').evaluate((el) => el.contains(document.activeElement)), `${viewport.name}: AI focus escaped overlay`);
    await page.locator('#ai-panel-inp').fill('화면 검증용 질문');
    await snap(page, `${viewport.name}-ai.png`);
    // A shortened viewport models keyboard space without claiming real iOS keyboard evidence.
    await page.setViewportSize({ width: viewport.width, height: Math.max(360, Math.round(viewport.height * .6)) });
    await settle(page, () => { const input = document.getElementById('ai-panel-inp'); return !!input && input.getBoundingClientRect().bottom <= innerHeight + 2; });
    check(await page.locator('#ai-panel-inp').evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight + 2), `${viewport.name}: input disappears in shortened keyboard viewport`);
    await page.locator('.ai-ph-close').click();
    await settle(page, () => document.activeElement === document.getElementById('topbar-ai-btn') && !document.querySelector('.app').inert);
    check(await page.locator('#topbar-ai-btn').evaluate((el) => document.activeElement === el && !document.querySelector('.app').inert), `${viewport.name}: AI close did not release modal background and restore focus (P1618)`);
    await page.setViewportSize(viewport);
    await openNav();
    await page.setViewportSize({ width: 1280, height: 900 });
    await settle(page, () => { const active = document.activeElement; return !document.querySelector('.main').inert && active !== document.body && active.getClientRects().length > 0 && getComputedStyle(active).display !== 'none'; });
    check(await page.evaluate(() => { const active = document.activeElement; return !document.querySelector('.main').inert && active !== document.body && active.getClientRects().length > 0 && getComputedStyle(active).display !== 'none'; }), `${viewport.name}: compact-to-desktop transition lost visible focus (P1618)`);
    await page.close();
  } catch (error) { failures.push({ message: `${viewport.name}: ${error.message}`, stack: error.stack }); } }));
} catch (error) { failures.push({ message: error.message, stack: error.stack }); }
finally {
  await closeAll({ browser, server });
  await atomicWriteFile(resolve(out, 'report.json'), JSON.stringify({ postmortem: 'P1618', isolatedInjection, status: failures.length ? 'FAIL' : 'PASS', observations, failures }, null, 2) + '\n');
}
if (failures.length) { console.error(`Responsive browser check FAIL (${failures.length})`); failures.forEach((failure) => console.error(JSON.stringify(failure))); process.exit(1); }
console.log(`Responsive browser check PASS: ${ROUTE_IDS.length} routes × ${RESPONSIVE_QA_VIEWPORTS.length} viewports; drawer, themes, AI input and local overflow verified${isolatedInjection ? ' (isolated stylesheet/module injection)' : ''}.`);
