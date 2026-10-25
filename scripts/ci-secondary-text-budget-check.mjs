#!/usr/bin/env node
// v58.79 (owner 2026-10-25, "cut taglines, helper text and secondary labels; let the layout do the explaining"):
// a per-route budget for secondary text, against the local server (external requests aborted, no paid AI).
// Each route opens as a reader first sees it (folds closed). The gate counts the visible characters of lines whose own
// class, or a near ancestor's, names them secondary (basis, caption, kicker, hint, meta, note, ... — SECONDARY_TEXT_WORDS
// in src/ui/components/section-frame.js); a frame's reading slot is not counted. The class words are a proxy, so the
// numbers are a ratchet, not a target: architecture/secondary-text-budget.json holds each route's ceiling and a route may
// only shrink. It also checks the section-frame contract on every route: a frame head holds only its title, one as-of
// chip and actions; the chip stays short; a frame has at most one reading of at most READING_MAX characters.
// _artifacts/secondary-text-budget/report.json lists each route's longest secondary lines and its frames by name, so the
// next pass (human or agent) starts from the worst lines.
//
//   node scripts/ci-secondary-text-budget-check.mjs             verify
//   node scripts/ci-secondary-text-budget-check.mjs --tighten   lower ceilings to what is measured now (shrink only)
//   node scripts/ci-secondary-text-budget-check.mjs --write     record every route's ceiling (deliberate; owner-approved growth)
import { chromium } from 'playwright';
import { closeAll, startLocalServer } from './lib/browser-gate.mjs';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROUTE_IDS } from '../src/app/routes.js';
import { SECONDARY_TEXT_PATTERN, READING_MAX, ASOF_MAX } from '../src/ui/components/section-frame.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.CI_TEXT_BUDGET_PORT || 8954);
const base = `http://127.0.0.1:${port}`;
const out = resolve(root, '_artifacts', 'secondary-text-budget');
const BUDGET = resolve(root, 'architecture/secondary-text-budget.json');
const write = process.argv.includes('--write');
const tighten = process.argv.includes('--tighten');
// Dates, counts and headlines in secondary lines move with each refresh; a ceiling keeps this much room over the
// measured value so a data day does not fail the gate, and still catches a new caption line.
export const headroom = (chars) => Math.ceil(chars * 1.1) + 40;
const failures = [];
mkdirSync(out, { recursive: true });

// Runs in the page: secondary characters and frame contract for the active route.
function measure({ pattern, readingMax, asofMax }) {
  const secondary = new RegExp(pattern, 'i');
  const page = document.querySelector('.page.active');
  if (!page) return null;
  const visible = (node) => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden';
  const closedFold = (node) => { const fold = node.closest('details:not([open])'); return !!fold && !node.closest('summary'); };
  const classChain = (node) => { const parts = []; let cursor = node; for (let i = 0; cursor && i < 3 && cursor !== page; i += 1, cursor = cursor.parentElement) { parts.push(String(cursor.className?.baseVal ?? cursor.className ?? '')); if (cursor.matches?.('section,[data-frame]')) break; } return parts.join(' '); };
  const blocks = new Map();
  let total = 0;
  const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const text = walker.currentNode.textContent.replace(/\s+/g, ' ').trim();
    const node = walker.currentNode.parentElement;
    if (!text || !node || node.closest('svg,script,style,.sr-only') || !visible(node) || closedFold(node)) continue;
    total += text.length;
    if (node.closest('.aio-frame-reading') || !secondary.test(classChain(node))) continue;
    const block = node.closest('p,li,div,span,summary,h2,h3,td') || node;
    const entry = blocks.get(block) || { text: '', classes: classChain(node).trim().slice(0, 120) };
    entry.text += (entry.text ? ' ' : '') + text;
    blocks.set(block, entry);
  }
  const lines = [...blocks.values()];
  const frames = [...page.querySelectorAll('[data-frame]')].filter(visible).map((frame) => {
    const head = frame.querySelector(':scope > .aio-frame-head');
    const stray = head ? [...head.children].filter((child) => !child.matches('.sx-card__title,h1,h2,h3,h4,.aio-asof,.aio-frame-actions')).map((child) => child.className || child.tagName) : [];
    const asof = head?.querySelector(':scope > .aio-asof')?.textContent.trim() || '';
    const readings = [...frame.querySelectorAll('.aio-frame-reading')].filter((node) => node.closest('[data-frame]') === frame).map((node) => node.textContent.trim().length);
    const problems = [];
    if (stray.length) problems.push(`head holds ${stray.join(', ')}`);
    if (asof.length > asofMax) problems.push(`as-of chip ${asof.length} chars`);
    if (readings.length > 1) problems.push(`${readings.length} readings`);
    if (readings.some((n) => n > readingMax)) problems.push(`reading ${Math.max(...readings)} chars`);
    return { frame: frame.dataset.frame, hasHead: !!head, asof, readings, problems };
  });
  return { total, secondary: lines.reduce((sum, line) => sum + line.text.length, 0), lines: lines.sort((a, b) => b.text.length - a.text.length).slice(0, 12).map((line) => ({ chars: line.text.length, classes: line.classes, text: line.text.slice(0, 160) })), frames };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const results = {};
  let server, browser;
  try {
    server = await startLocalServer(port, { label: 'secondary-text-budget/server' });
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    page.on('pageerror', (error) => failures.push({ message: 'runtime error', detail: error.message }));
    await page.route('**/*', (route) => route.request().url().startsWith(base) || route.request().url().startsWith('data:') ? route.continue() : route.abort());
    await page.goto(`${base}/index.html#home`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.showPage === 'function' && document.querySelector('.page.active'), { timeout: 30000 });
    await page.waitForTimeout(1500);
    const args = { pattern: SECONDARY_TEXT_PATTERN, readingMax: READING_MAX, asofMax: ASOF_MAX };
    for (const route of ROUTE_IDS) {
      await page.evaluate((id) => window.showPage(id, null), route);
      await page.waitForTimeout(900);
      results[route] = await page.evaluate(measure, args);
    }
    // Canary: an injected frame with a stray caption, a long chip and two long readings must trip every frame rule,
    // and an injected basis line must count as secondary.
    const before = await page.evaluate(measure, args);
    await page.evaluate(() => {
      const host = document.createElement('section');
      host.id = 'text-budget-canary';
      host.dataset.frame = 'canary.frame';
      host.innerHTML = `<div class="sx-card__head aio-frame-head"><h2 class="sx-card__title">제목</h2><span class="sx-card__meta">기준 설명 한 줄</span><span class="aio-asof">${'가'.repeat(40)}</span></div><p class="aio-frame-reading">${'나'.repeat(300)}</p><p class="aio-frame-reading">다</p><p class="canary-basis">${'라'.repeat(50)}</p>`;
      document.querySelector('.page.active').appendChild(host);
    });
    const after = await page.evaluate(measure, args);
    await page.evaluate(() => document.getElementById('text-budget-canary')?.remove());
    const canary = { problems: after.frames.find((frame) => frame.frame === 'canary.frame')?.problems || [], added: after.secondary - before.secondary };
    const expected = ['head holds', 'as-of chip', 'readings', 'reading 300'];
    const missing = expected.filter((word) => !canary.problems.some((problem) => problem.includes(word)));
    if (missing.length || canary.added < 50) failures.push({ message: 'secondary text budget canary failed (v58.79)', detail: { canary, missing } });
    await page.close();
  } catch (error) { failures.push({ message: error.message, stack: error.stack }); }
  finally { await closeAll({ browser, server }); }

  const doc = existsSync(BUDGET) ? JSON.parse(readFileSync(BUDGET, 'utf8')) : { routes: {} };
  const ceilings = doc.routes || {};
  const over = [];
  const frameProblems = [];
  for (const route of ROUTE_IDS) {
    const result = results[route];
    if (!result) { if (!failures.length) failures.push({ message: `route ${route} not measured` }); continue; }
    if (Number.isFinite(ceilings[route]) && result.secondary > ceilings[route]) over.push({ route, secondary: result.secondary, ceiling: ceilings[route], lines: result.lines.slice(0, 5) });
    if (!Number.isFinite(ceilings[route]) && !write) over.push({ route, secondary: result.secondary, ceiling: null, lines: [] });
    for (const frame of result.frames) if (frame.problems.length) frameProblems.push({ route, ...frame });
  }
  if ((write || tighten) && !failures.length) {
    const next = {};
    for (const route of ROUTE_IDS) {
      const measured = headroom(results[route].secondary);
      next[route] = write || !Number.isFinite(ceilings[route]) ? measured : Math.min(ceilings[route], measured);
    }
    writeFileSync(BUDGET, JSON.stringify({ note: 'v58.79 secondary-text ceilings per route (visible characters under secondary class words, folds closed; scripts/ci-secondary-text-budget-check.mjs). Shrink with --tighten; growth needs --write and an owner reason.', routes: next }, null, 2) + '\n');
    console.log(`secondary text budget ${write ? 'written' : 'tightened'}: ${ROUTE_IDS.map((route) => `${route} ${next[route]}`).join(', ')}`);
  }
  const status = failures.length || (!write && !tighten && (over.length || frameProblems.length)) ? 'FAIL' : 'PASS';
  writeFileSync(resolve(out, 'report.json'), JSON.stringify({ gate: 'v58.79 secondary-text-budget', status, ceilings, over, frameProblems, failures, routes: results }, null, 2) + '\n');
  const summary = ROUTE_IDS.filter((route) => results[route]).map((route) => `${route} ${results[route].secondary}/${ceilings[route] ?? '?'}`).join(', ');
  if (failures.length) { console.error(`v58.79 secondary text budget FAIL (${failures.length} check failure(s))`); failures.forEach((failure) => console.error(JSON.stringify(failure).slice(0, 600))); process.exit(1); }
  if (write || tighten) process.exit(0);
  if (over.length || frameProblems.length) {
    console.error(`v58.79 secondary text budget FAIL: ${over.length} route(s) over ceiling, ${frameProblems.length} frame contract problem(s)`);
    over.forEach((row) => console.error(`- ${row.route}: ${row.secondary} > ${row.ceiling ?? 'no ceiling'}; longest: ${row.lines.map((line) => `[${line.chars}] ${line.text.slice(0, 60)}`).join(' | ')}`));
    frameProblems.forEach((row) => console.error(`- frame ${row.frame} (${row.route}): ${row.problems.join('; ')}`));
    process.exit(1);
  }
  const frames = ROUTE_IDS.reduce((sum, route) => sum + (results[route]?.frames.length || 0), 0);
  console.log(`v58.79 secondary text budget PASS: ${ROUTE_IDS.length} routes within ceilings, ${frames} frame(s) keep the contract (${summary}).`);
}
