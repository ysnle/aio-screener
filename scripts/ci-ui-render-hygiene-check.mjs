#!/usr/bin/env node
// v57.54: render-level UI hygiene on every route at desktop and phone width, against the local server (external
// requests aborted, no paid AI):
//   (a) target size — every visible button, <summary>, [role=button] and link in the sidebar, topbar, hub tabs and
//       active page renders at least 24×24 CSS px (WCAG 2.2 SC 2.5.8). Inline targets inside a sentence (text links,
//       inline term buttons) are exempt, as the criterion allows.
//   (b) empty structure — no h1–h4 without text and no <summary> without text (an empty heading or disclosure
//       is announced with no name).
//   (c) shell — at 360 px the phone topbar does not overflow, the quote time is not cut, and the version badge,
//       help and AI buttons stay visible (the v57.54 topbar fix; hard requirement, no baseline).
// (a)/(b) offenders that existed when the gate was introduced live in architecture/ui-render-baseline.json; only
// offender kinds missing from it fail. Offenders are keyed by viewport, route and a structural signature (tag, id,
// classes, data-action, nearest id'd ancestor — digits folded), never by data text, so daily data does not churn it.
//
//   node scripts/ci-ui-render-hygiene-check.mjs                    verify
//   node scripts/ci-ui-render-hygiene-check.mjs --prune-baseline   drop fixed entries (shrink only)
//   node scripts/ci-ui-render-hygiene-check.mjs --write-baseline   record every current offender (deliberate)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROUTE_IDS } from '../src/app/routes.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.CI_UI_RENDER_PORT || 8951);
const base = `http://127.0.0.1:${port}`;
const out = resolve(root, '_artifacts', 'ui-render-hygiene');
const BASELINE = resolve(root, 'architecture/ui-render-baseline.json');
const writeBaseline = process.argv.includes('--write-baseline');
const pruneBaseline = process.argv.includes('--prune-baseline');
const VIEWPORTS = [{ name: 'desktop1440', width: 1440, height: 900 }, { name: 'phone390', width: 390, height: 844 }];
const MIN_TARGET = 24;
const failures = [];
const offenders = [];
const shell = [];
mkdirSync(out, { recursive: true });

function collect(minTarget) {
  const visible = (el) => {
    if (el.closest('[hidden],[aria-hidden="true"],[inert]')) return false;
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true })) return false;
    return el.getClientRects().length > 0;
  };
  const fold = (value) => String(value || '').replace(/\d+/g, '#').replace(/\b[A-Z]{2,5}\b/g, 'SYM').slice(0, 60);
  const signature = (el) => {
    const classes = [...el.classList].filter((name) => !/^(?:active|open|is-|selected|on$|current)/.test(name)).sort().slice(0, 3);
    const action = el.getAttribute('data-action');
    let host = el.parentElement;
    while (host && !host.id) host = host.parentElement;
    return `${el.tagName.toLowerCase()}${el.id ? '#' + fold(el.id) : ''}${classes.length ? '.' + classes.join('.') : ''}${action ? `[action=${action}]` : ''}@${host ? fold(host.id) : 'root'}`;
  };
  const inSentence = (el) => {
    if (getComputedStyle(el).display !== 'inline') return false;
    const parent = el.parentElement;
    if (!parent) return false;
    const own = (el.textContent || '').trim().length;
    return (parent.textContent || '').trim().length > own + 8;
  };
  const page = document.querySelector('.page.active');
  const scope = [document.querySelector('nav.sidebar'), document.querySelector('header.topbar'), document.getElementById('aio-hub-tabs'), page].filter(Boolean);
  const targets = [];
  const empty = [];
  for (const host of scope) {
    for (const el of host.querySelectorAll('button, summary, [role="button"], a[href]')) {
      if (!visible(el) || el.disabled) continue;
      const box = el.getBoundingClientRect();
      if (box.width <= 2 && box.height <= 2) continue; // visually-hidden helpers
      if ((box.width < minTarget || box.height < minTarget) && !inSentence(el)) {
        targets.push({ signature: signature(el), size: `${Math.round(box.width)}x${Math.round(box.height)}`, text: (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40) });
      }
    }
    for (const el of host.querySelectorAll('h1, h2, h3, h4, summary')) {
      if (el.closest('[hidden],[aria-hidden="true"]')) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkVisibilityCSS: true }) && !el.closest('details')) continue;
      const name = (el.textContent || '').trim() || el.getAttribute('aria-label') || el.querySelector('img[alt]')?.getAttribute('alt') || '';
      if (!name.trim()) empty.push({ signature: signature(el), text: '' });
    }
  }
  return { targets, empty };
}

let server, browser;
try {
  server = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolveReady, reject) => {
    const timeout = setTimeout(() => reject(new Error('UI render local server did not start')), 15000);
    server.stdout.on('data', (data) => { if (String(data).includes('AIO local server')) { clearTimeout(timeout); resolveReady(); } });
    server.on('error', reject); server.on('exit', (code) => { clearTimeout(timeout); reject(new Error(`UI render server exited ${code}`)); });
  });
  browser = await chromium.launch({ headless: true });
  const open = async (viewport) => {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1, hasTouch: viewport.width < 700 });
    page.on('pageerror', (error) => failures.push({ message: `${viewport.name}: runtime error`, detail: error.message }));
    await page.route('**/*', (route) => route.request().url().startsWith(base) || route.request().url().startsWith('data:') ? route.continue() : route.abort());
    await page.goto(`${base}/index.html#home`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.showPage === 'function' && document.querySelector('.page.active'), { timeout: 30000 });
    await page.waitForTimeout(600);
    return page;
  };
  await Promise.all(VIEWPORTS.map(async (viewport) => { try {
    const page = await open(viewport);
    for (const route of ROUTE_IDS) {
      await page.evaluate((id) => window.showPage(id, null), route);
      await page.waitForTimeout(450);
      const found = await page.evaluate(collect, MIN_TARGET);
      found.targets.forEach((entry) => offenders.push({ kind: 'target-size', viewport: viewport.name, route, ...entry }));
      found.empty.forEach((entry) => offenders.push({ kind: 'empty-structure', viewport: viewport.name, route, ...entry }));
    }
    // Canary: the detector must see a 12px button and an empty heading/summary, and exempt a link inside a sentence.
    const canary = await page.evaluate((minTarget) => {
      const host = document.createElement('div');
      host.id = 'ui-render-canary';
      host.innerHTML = '<button type="button" style="all:unset;display:inline-block;width:12px;height:12px">x</button><h3></h3><details><summary></summary></details><p>문장 안의 <a href="#guide">링크</a>는 크기 예외입니다.</p>';
      document.querySelector('.page.active').appendChild(host);
      return host.id;
    }, MIN_TARGET);
    const probe = await page.evaluate(collect, MIN_TARGET);
    await page.evaluate((id) => document.getElementById(id)?.remove(), canary);
    const mine = (list) => list.filter((entry) => entry.signature.endsWith('@ui-render-canary'));
    if (mine(probe.targets).length !== 1 || mine(probe.empty).length !== 2 || mine(probe.targets).some((entry) => entry.signature.startsWith('a'))) {
      failures.push({ message: `${viewport.name}: render hygiene detector canary failed (v57.54)`, detail: { targets: mine(probe.targets), empty: mine(probe.empty) } });
    }
    await page.close();
  } catch (error) { failures.push({ message: `${viewport.name}: ${error.message}`, stack: error.stack }); } }));

  // (c) the 360 px phone topbar — the narrowest supported phone width.
  const phone = await open({ name: 'phone360', width: 360, height: 780 });
  await phone.waitForFunction(() => (document.getElementById('live-quote-ts')?.dataset.compact || '') !== '', { timeout: 15000 }).catch(() => {});
  const top = await phone.evaluate(() => {
    const bar = document.querySelector('header.topbar');
    const ts = document.getElementById('live-quote-ts');
    const shown = (id) => { const el = document.getElementById(id); if (!el) return false; const box = el.getBoundingClientRect(); return box.width > 0 && box.height > 0 && box.right <= innerWidth + 1 && getComputedStyle(el).visibility !== 'hidden'; };
    const after = ts ? getComputedStyle(ts, '::after').content : '';
    return { docOverflow: document.documentElement.scrollWidth - innerWidth, barOverflow: bar.scrollWidth - bar.clientWidth, compact: ts?.dataset.compact || '', after, tsCut: ts ? ts.scrollWidth > ts.clientWidth + 1 : null, tsText: ts?.textContent || '', version: shown('app-version-badge'), help: shown('topbar-help-btn'), ai: shown('topbar-ai-btn') };
  });
  shell.push(top);
  const check = (ok, message) => { if (!ok) failures.push({ message, detail: top }); };
  check(top.docOverflow <= 2 && top.barOverflow <= 2, 'phone360: topbar overflows horizontally (v57.54)');
  check(top.version && top.help && top.ai, 'phone360: version badge, help and AI buttons must stay visible (v57.54)');
  check(!top.compact || (top.after.includes(top.compact) && !/서버|기준/.test(top.compact)), 'phone360: quote time is not the compact "MM/DD HH:MM" form (v57.54)');
  check(top.tsCut === false, 'phone360: quote time is cut with an ellipsis (v57.54)');
  await phone.screenshot({ path: resolve(out, 'phone360-topbar.png'), clip: { x: 0, y: 0, width: 360, height: 140 } });
  await phone.close();
} catch (error) { failures.push({ message: error.message, stack: error.stack }); }
finally { await browser?.close(); server?.kill(); }

const keyOf = (entry) => `${entry.kind}|${entry.viewport}|${entry.route}|${entry.signature}`;
const current = [...new Set(offenders.map(keyOf))].sort();
const baselineDoc = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
const baseline = new Set(baselineDoc.render?.offenders || []);
if ((writeBaseline || pruneBaseline) && !failures.length) {
  const next = writeBaseline ? current : [...baseline].filter((key) => current.includes(key)).sort();
  const doc = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
  doc.render = { note: 'v57.54 target-size (<24px) and empty heading/summary offenders accepted at introduction; key = kind|viewport|route|signature. Shrink with --prune-baseline.', offenders: next };
  writeFileSync(BASELINE, JSON.stringify(doc, null, 2) + '\n');
  console.log(`UI render baseline ${writeBaseline ? 'written' : 'pruned'}: ${next.length} offender kind(s).`);
}
const fresh = offenders.filter((entry) => !baseline.has(keyOf(entry)));
const fixed = [...baseline].filter((key) => !current.includes(key));
const count = (kind, viewport) => offenders.filter((entry) => entry.kind === kind && (!viewport || entry.viewport === viewport)).length;
const counts = Object.fromEntries(VIEWPORTS.flatMap((vp) => [[`${vp.name}.target-size`, count('target-size', vp.name)], [`${vp.name}.empty-structure`, count('empty-structure', vp.name)]]));
const status = failures.length || (!writeBaseline && !pruneBaseline && fresh.length) ? 'FAIL' : 'PASS';
writeFileSync(resolve(out, 'report.json'), JSON.stringify({ gate: 'v57.54 ui-render-hygiene', status, minTarget: MIN_TARGET, counts, offenderKinds: current.length, baseline: baseline.size, fixedSinceBaseline: fixed, fresh, shell, failures, offenders }, null, 2) + '\n');
const summary = Object.entries(counts).map(([name, value]) => `${name} ${value}`).join(', ');
if (failures.length) { console.error(`v57.54 UI render hygiene FAIL (${failures.length} check failure(s))`); failures.forEach((failure) => console.error(JSON.stringify(failure).slice(0, 600))); process.exit(1); }
if (writeBaseline || pruneBaseline) process.exit(0);
if (fresh.length) {
  console.error(`v57.54 UI render hygiene FAIL: ${fresh.length} new offender(s) not in architecture/ui-render-baseline.json (${summary})`);
  fresh.slice(0, 40).forEach((entry) => console.error(`- ${entry.kind} ${entry.viewport}/${entry.route} ${entry.signature} ${entry.size || ''} "${entry.text}"`));
  process.exit(1);
}
console.log(`v57.54 UI render hygiene PASS: ${ROUTE_IDS.length} routes × ${VIEWPORTS.length} viewports + 360px topbar; no new offenders (current: ${summary}; ${current.length} kinds, baseline ${baseline.size}, fixed since baseline ${fixed.length}).`);
