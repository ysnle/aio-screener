// v57.81: touch ergonomics on a phone (390x844, touch, mobile) and an iPad (820x1180, touch), every route.
// A phone/iPad parity audit found 36px phone buttons (a width rule outranked the coarse-pointer rule), 24px folds,
// 38px hub tabs, 33px drawer rows, a 13px-wide glossary close button and 11-14px inputs that make iOS zoom on focus.
// For every route in src/app/routes.js this gate asserts (v57.81):
//   (a) no visible input/select/textarea under 16px (iOS focus zoom);
//   (b) primary navigation (drawer rows, hub tabs, topbar buttons, page summaries) at least 44px tall;
//   (c) no visible interactive element under 24x24 CSS px, except inline links/terms inside running text (WCAG 2.5.8);
//   (d) no visible text under 11px outside SVG.
// The drawer, the glossary modal and the AI panel are opened once per device and held to the same rules.
// Local artifacts only; external requests are aborted and no AI call is made.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWriteFile } from './lib/atomic-write.mjs';
import { closeAll, startLocalServer } from './lib/browser-gate.mjs';
import { ROUTE_IDS } from '../src/app/routes.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.CI_TOUCH_ERGONOMICS_PORT || 8941);
const base = `http://127.0.0.1:${port}`;
const out = resolve(root, '_artifacts', 'touch-ergonomics');
const DEVICES = [
  { name: 'phone390', viewport: { width: 390, height: 844 }, isMobile: true },
  { name: 'ipad820', viewport: { width: 820, height: 1180 }, isMobile: false },
];
const failures = [];
const observations = [];

// Runs in the page. Returns offenders for the four rules inside the given scope selectors.
function measure({ scopes, navSelector }) {
  const roots = scopes.flatMap((selector) => [...document.querySelectorAll(selector)]);
  const within = (el) => roots.some((rootEl) => rootEl.contains(el));
  const shown = (el) => {
    if (!el.isConnected || !el.getClientRects().length) return false;
    if (el.closest('[hidden],[aria-hidden="true"],[inert]')) return false;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    for (let node = el; node && node !== document.body; node = node.parentElement) {
      const s = getComputedStyle(node);
      if (s.opacity === '0' || s.display === 'none') return false;
      if (s.clip === 'rect(0px, 0px, 0px, 0px)' || s.clipPath === 'inset(50%)') return false;
    }
    const box = el.getBoundingClientRect();
    return box.width > 2 && box.height > 2; // visually-hidden (1x1) skip/basis buttons are not visible targets
  };
  const label = (el) => {
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : '';
    const action = el.dataset?.action ? `[data-action=${el.dataset.action}]` : '';
    return `${el.tagName.toLowerCase()}${id}${cls}${action} "${(el.textContent || el.value || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 24)}"`;
  };
  const size = (el) => { const b = el.getBoundingClientRect(); return `${Math.round(b.width * 10) / 10}x${Math.round(b.height * 10) / 10}`; };
  const all = roots.flatMap((rootEl) => [rootEl, ...rootEl.querySelectorAll('*')]);
  const inputs = all.filter((el) => el.matches('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]):not([type=button]):not([type=submit]),select,textarea') && shown(el))
    .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
    .map((el) => `${label(el)} ${getComputedStyle(el).fontSize}`);
  // WCAG 2.5.8 inline exception: a link or term inside a sentence is sized by the line of text around it.
  const inlineInText = (el) => {
    if (getComputedStyle(el).display !== 'inline') return false;
    const parent = el.parentElement;
    if (!parent) return false;
    const own = (el.textContent || '').trim().length;
    return (parent.textContent || '').trim().length > own + 1;
  };
  const nav = [...new Set(roots.flatMap((rootEl) => [...rootEl.querySelectorAll(navSelector)]))]
    .filter((el) => shown(el) && !inlineInText(el) && el.getBoundingClientRect().height < 43.5)
    .map((el) => `${label(el)} ${size(el)}`);
  const interactive = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab],[role=link],[tabindex="0"]';
  const targets = all.filter((el) => el.matches(interactive) && !el.closest('svg') && shown(el) && !inlineInText(el))
    .filter((el) => { const b = el.getBoundingClientRect(); return b.width < 23.5 || b.height < 23.5; })
    .map((el) => `${label(el)} ${size(el)}`);
  const text = [];
  for (const rootEl of roots) {
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, { acceptNode: (node) => node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (!parent || parent.closest('svg,script,style,noscript,template')) continue;
      const fontSize = parseFloat(getComputedStyle(parent).fontSize);
      if (!(fontSize > 0 && fontSize < 10.95)) continue;
      const range = document.createRange(); range.selectNodeContents(node);
      const rect = range.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2 || !shown(parent)) continue;
      text.push(`${label(parent)} ${fontSize}px`);
    }
  }
  return { inputs, nav, targets: [...new Set(targets)], text: [...new Set(text)] };
}

// Primary controls: drawer rows, hub tabs, topbar buttons, page folds, and page buttons outside table cells (the
// v57.81 regression: a phone width rule held them at 36px while the iPad got 44px).
const NAV = ['.sidebar .nav-item', '.sidebar [data-action="showPage"]', '.sidebar [data-action="_aioNextSiblingToggle"]', '.sidebar summary', '#sidebar-theme-btn',
  '#aio-hub-tabs .aio-hub-tab', '.topbar button', '.page.active summary', '.page.active button:not(td button, th button, .aio-basis-btn, .aio-term)'].join(', ');
const record = (device, surface, result) => {
  observations.push({ device, surface, ...result });
  const rules = [
    ['inputs', 'input/select/textarea under 16px (iOS focus zoom)'],
    ['nav', 'primary navigation or page button under 44px tall'],
    ['targets', 'interactive element under 24x24'],
    ['text', 'text under 11px outside SVG'],
  ];
  for (const [key, message] of rules) if (result[key].length) failures.push({ message: `${device}/${surface}: ${message} (v57.81)`, detail: result[key].slice(0, 12), count: result[key].length });
};

mkdirSync(out, { recursive: true });
let server, browser;
const started = Date.now();
try {
  server = await startLocalServer(port, { label: 'touch-ergonomics/server' });
  browser = await chromium.launch({ headless: true });
  await Promise.all(DEVICES.map(async (device) => {
    const context = await browser.newContext({ viewport: device.viewport, deviceScaleFactor: 1, hasTouch: true, isMobile: device.isMobile });
    const page = await context.newPage();
    try {
      await page.route('**/*', (route) => route.request().url().startsWith(base) || route.request().url().startsWith('data:') ? route.continue() : route.abort());
      await page.addInitScript(() => { try { localStorage.setItem('aio_disclaimer_ack_v1', '1'); } catch { /* storage blocked */ } });
      await page.goto(`${base}/index.html#home`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => typeof window.showPage === 'function' && document.querySelector('.page.active'), { timeout: 30000 });
      const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
      if (!coarse) failures.push({ message: `${device.name}: emulation did not report (pointer: coarse) (v57.81)` });
      for (const route of ROUTE_IDS) {
        await page.evaluate((id) => window.showPage(id, null), route);
        await page.waitForFunction(() => (document.querySelector('.page.active')?.innerText || '').trim().length > 40, null, { timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(250);
        record(device.name, route, await page.evaluate(measure, { scopes: ['.topbar', '#aio-hub-tabs', '.page.active'], navSelector: NAV }));
      }
      // Drawer: navigation rows, theme button, folded settings rows and their inputs.
      await page.evaluate(() => window.showPage('home', null));
      await page.locator('#sidebar-toggle-btn').click();
      await page.waitForFunction(() => document.body.classList.contains('aio-navigation-open'), null, { timeout: 4000 }).catch(() => {});
      await page.evaluate(() => document.querySelectorAll('.sidebar details').forEach((d) => { d.open = true; }));
      await page.evaluate(() => document.querySelectorAll('.sidebar [data-action="_aioNextSiblingToggle"]').forEach((row) => { const next = row.nextElementSibling; if (next) next.style.display = ''; }));
      await page.waitForTimeout(150);
      record(device.name, 'drawer', await page.evaluate(measure, { scopes: ['.sidebar'], navSelector: NAV }));
      await page.keyboard.press('Escape');
      // Glossary modal: close button, category chips and search.
      await page.evaluate(() => window.openGlossary?.());
      await page.waitForFunction(() => { const m = document.getElementById('glossary-modal'); return m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(150);
      record(device.name, 'glossary', await page.evaluate(measure, { scopes: ['#glossary-modal'], navSelector: '#glossary-modal [data-action="_aioCloseGlossary"]' }));
      await page.evaluate(() => window._aioCloseGlossary?.());
      // AI panel input.
      await page.locator('#topbar-ai-btn').click();
      await page.waitForFunction(() => document.getElementById('ai-panel')?.classList.contains('open'), null, { timeout: 4000 }).catch(() => {});
      const ai = await page.evaluate(() => [...document.querySelectorAll('#ai-panel input, #ai-panel textarea, #ai-panel select')].filter((el) => el.getClientRects().length && parseFloat(getComputedStyle(el).fontSize) < 16).map((el) => `${el.tagName.toLowerCase()}#${el.id} ${getComputedStyle(el).fontSize}`));
      if (ai.length) failures.push({ message: `${device.name}/ai-panel: input under 16px (iOS focus zoom) (v57.81)`, detail: ai });
    } catch (error) {
      failures.push({ message: `${device.name}: ${error.message}`, stack: error.stack });
    } finally {
      await context.close();
    }
  }));
} catch (error) {
  failures.push({ message: error.message, stack: error.stack });
} finally {
  await closeAll({ browser, server });
  await atomicWriteFile(resolve(out, 'report.json'), JSON.stringify({ release: 'v57.81', status: failures.length ? 'FAIL' : 'PASS', seconds: Math.round((Date.now() - started) / 1000), observations, failures }, null, 2) + '\n');
}
if (failures.length) {
  console.error(`Touch ergonomics browser check FAIL (${failures.length}) — report: _artifacts/touch-ergonomics/report.json`);
  failures.forEach((failure) => console.error(JSON.stringify(failure)));
  process.exit(1);
}
console.log(`Touch ergonomics browser check PASS (v57.81): ${ROUTE_IDS.length} routes x ${DEVICES.length} touch devices plus drawer, glossary and AI panel; inputs >=16px, navigation >=44px, targets >=24px, text >=11px (${Math.round((Date.now() - started) / 1000)}s).`);
