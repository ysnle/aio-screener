#!/usr/bin/env node
// v58.74 (text audit): rendered-copy lint on every route, against the local server (external requests aborted, no paid
// AI). The text audit found template faults that only show once a slot is filled: "시장 폭 부담 이 아직 빠짐",
// "'유가 충격'(으)로", "−0.0%" next to "-0.8%", "BLOCKED"/"run-b947bcc0" in a sentence, ", 3종목…" starting a line.
// Each route is opened with its folds expanded and its innerText is read line by line against the rules below.
// Offenders present when the gate was introduced live in architecture/rendered-copy-baseline.json; only new ones fail.
// A key is rule|route|line with digits and tickers folded, so daily data does not churn it.
//
//   node scripts/ci-rendered-copy-lint-check.mjs                    verify
//   node scripts/ci-rendered-copy-lint-check.mjs --prune-baseline   drop fixed entries (shrink only)
//   node scripts/ci-rendered-copy-lint-check.mjs --write-baseline   record every current offender (deliberate)
import { chromium } from 'playwright';
import { closeAll, startLocalServer } from './lib/browser-gate.mjs';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROUTE_IDS } from '../src/app/routes.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.CI_COPY_LINT_PORT || 8953);
const base = `http://127.0.0.1:${port}`;
const out = resolve(root, '_artifacts', 'rendered-copy-lint');
const BASELINE = resolve(root, 'architecture/rendered-copy-baseline.json');
const writeBaseline = process.argv.includes('--write-baseline');
const pruneBaseline = process.argv.includes('--prune-baseline');
// Long-form knowledge pages write arithmetic with the typographic minus ("1.10 ÷ 1.05 − 1", "−50%"); the sign rule is
// for generated market numbers, so those routes are exempt from it only.
const LONG_FORM_ROUTES = new Set(['principles', 'masters', 'atlas', 'guide']);
export const COPY_RULES = Object.freeze([
  ['placeholder-particle', /[가-힣A-Za-z0-9)'’]\((?:이|가|을|를|은|는|과|와|으|으로|로)\)/],
  ['empty-value', /\b(?:undefined|NaN)\b|\[object Object\]/],
  ['negative-zero', /(?:^|[^\d.,])[-−+]0(?:\.0+)?(?:%p|%|bp|pt)?(?![\d.])/],
  ['unicode-minus-number', /−\d/, (route) => !LONG_FORM_ROUTES.has(route)],
  ['raw-token', /\b(?:BLOCKED|UNKNOWN|PENDING|REFERENCE|T[1-4]_[A-Z_]+|[a-z]+_missing|run-[0-9a-f]{6,})\b/],
  ['empty-paren', /\(\s*\)/],
  ['leading-separator', /^\s*[,·]\s/],
  ['double-paren', /\)\(/],
  ['spaced-particle', /[가-힣] (?:이|가|을|를) (?:아직|빠져|빠짐)/]
]);
const failures = [];
const offenders = [];
mkdirSync(out, { recursive: true });

export function lintLines(text, route) {
  const found = [];
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    for (const [rule, pattern, applies] of COPY_RULES) {
      if (applies && !applies(route)) continue;
      if (pattern.test(line)) found.push({ rule, line: line.slice(0, 400) });
    }
  }
  return found;
}
// P2115: a signed number drawn in the rising/falling/flat colour must carry that sign as printed — 테마 coloured a
// printed +0.04% flat because the colour rounded to one decimal while the text showed two. Runs inside the page.
export function signColourMismatches(selector) {
  const out = [];
  for (const el of document.querySelectorAll(`${selector} [style*="color"]`)) {
    const colour = el.style.color || '';
    const got = /--dir-up/.test(colour) ? 'up' : /--dir-down/.test(colour) ? 'down' : /--text-primary/.test(colour) ? 'flat' : null;
    const text = (el.textContent || '').trim();
    const match = got && !el.children.length && text.match(/^([+\-−]?)\d[\d,]*(?:\.\d+)?\s*(?:%p|%|bp)?$/);
    if (!match) continue;
    const want = !/[1-9]/.test(text) ? 'flat' : match[1] === '+' ? 'up' : match[1] ? 'down' : null;
    if (want && want !== got) out.push(`${text} drawn ${got}`);
  }
  return out;
}
const fold = (line) => String(line).replace(/[+\-−]?\d[\d,.]*/g, '#').replace(/\b[A-Z]{2,5}\b/g, 'SYM').replace(/\s+/g, ' ').slice(0, 90);

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  let server, browser;
  try {
    server = await startLocalServer(port, { label: 'rendered-copy-lint/server' });
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    page.on('pageerror', (error) => failures.push({ message: 'runtime error', detail: error.message }));
    await page.route('**/*', (route) => route.request().url().startsWith(base) || route.request().url().startsWith('data:') ? route.continue() : route.abort());
    await page.goto(`${base}/index.html#home`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.showPage === 'function' && document.querySelector('.page.active'), { timeout: 30000 });
    await page.waitForTimeout(1500);
    for (const route of ROUTE_IDS) {
      await page.evaluate((id) => window.showPage(id, null), route);
      await page.waitForTimeout(700);
      const text = await page.evaluate(() => {
        const active = document.querySelector('.page.active');
        if (!active) return '';
        // The screener's custom-view toggle is a <details> that swaps the table; it stays as the user left it.
        for (const fold of active.querySelectorAll('details:not(#scr-workbench-advanced)')) fold.open = true;
        return active.innerText || '';
      });
      for (const hit of lintLines(text, route)) offenders.push({ route, ...hit });
      const mismatched = await page.evaluate(signColourMismatches, '.page.active');
      if (mismatched.length) failures.push({ message: `P2115 ${route}: a signed number's colour disagrees with its printed sign`, detail: mismatched.slice(0, 10) });
    }
    // Canary: the detector must see each rule in an injected paragraph, and leave a clean sentence alone.
    const canaryText = await page.evaluate(() => {
      const host = document.createElement('div');
      host.id = 'copy-lint-canary';
      host.innerText = "'유가 충격'(으)로 바뀌었습니다\n값 undefined\n10/23 -0.0%\n나스닥 100 −0.8%\n모델 검증 BLOCKED\n조건 ()\n, 3종목 세부 테마\n후행(약 50일 기준)(10/23)\n시장 폭 부담 이 아직 빠짐\n코스피 10/23 +0.3%, 원/달러 -0.2%입니다.";
      document.querySelector('.page.active').appendChild(host);
      const text = host.innerText;
      host.remove();
      return text;
    });
    const seen = new Set(lintLines(canaryText, 'canary').map((hit) => hit.rule));
    const clean = lintLines('코스피 10/23 +0.3%, 원/달러 -0.2%입니다. 2년물 − 기준금리 0.82%p', 'canary');
    const missing = COPY_RULES.map(([rule]) => rule).filter((rule) => !seen.has(rule));
    if (missing.length || clean.length) failures.push({ message: 'rendered copy lint canary failed (v58.74)', detail: { missing, clean } });
    await page.evaluate(() => {
      const host = document.createElement('div');
      host.id = 'sign-colour-canary';
      host.innerHTML = '<span style="color: var(--text-primary)">+0.04%</span><span style="color: var(--dir-up)">+0.04%</span><span style="color: var(--dir-down)">-1.2%p</span><span style="color: var(--text-primary)">0.00%</span>';
      document.querySelector('.page.active').appendChild(host);
    });
    const colourCanary = await page.evaluate(signColourMismatches, '#sign-colour-canary');
    await page.evaluate(() => document.getElementById('sign-colour-canary')?.remove());
    if (colourCanary.join('|') !== '+0.04% drawn flat') failures.push({ message: 'P2115 sign-colour canary failed', detail: colourCanary });
    // P2115: what 오늘 can show — five 90-point macro stories used to stop the home cascade at 90, and the one-per-topic
    // cap then left a single headline. The cascade must count what the cap leaves.
    const homeNews = await page.evaluate(() => {
      const now = Date.now(), at = new Date(now - 3 * 3600000).toISOString();
      const row = (topic, title, score, k) => ({ title, source: 'Reuters', tier: 1, country: 'us', topic, score, pubDate: at, link: `https://example.test/${topic}-${k}` });
      const items = ['Core prices ease for third month', 'Treasury yields jump after CPI', 'Powell signals patience on cuts', 'Payrolls beat forecasts in October', 'Dollar firms on hawkish Fed minutes'].map((title, k) => row('macro', title, 95 - k, k))
        .concat([['energy', 'Oil supply cut lifts crude'], ['geo', 'Border talks stall again'], ['earnings', 'Chipmaker beats revenue guide']].map(([topic, title], k) => row(topic, title, 80 - k, k)));
      return window.AIO.buildNewsSurfaceModel('home', items, { nowMs: now, windowStart: now - 24 * 3600000, windowEnd: now }).items.map((item) => item.topic);
    });
    if (homeNews.length !== 4 || new Set(homeNews).size !== 4) failures.push({ message: 'P2115 one crowded 90-point topic must still leave four home headlines', detail: homeNews });
    await page.close();
  } catch (error) { failures.push({ message: error.message, stack: error.stack }); }
  finally { await closeAll({ browser, server }); }

  const keyOf = (entry) => `${entry.rule}|${entry.route}|${fold(entry.line)}`;
  const current = [...new Set(offenders.map(keyOf))].sort();
  const baselineDoc = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
  const baseline = new Set(baselineDoc.offenders || []);
  if ((writeBaseline || pruneBaseline) && !failures.length) {
    const next = writeBaseline ? current : [...baseline].filter((key) => current.includes(key)).sort();
    writeFileSync(BASELINE, JSON.stringify({ note: 'v58.74 rendered-copy lint offenders accepted at introduction; key = rule|route|folded line. Shrink with --prune-baseline.', offenders: next }, null, 2) + '\n');
    console.log(`rendered copy baseline ${writeBaseline ? 'written' : 'pruned'}: ${next.length} offender kind(s).`);
  }
  const fresh = offenders.filter((entry) => !baseline.has(keyOf(entry)));
  const fixed = [...baseline].filter((key) => !current.includes(key));
  const counts = Object.fromEntries(COPY_RULES.map(([rule]) => [rule, offenders.filter((entry) => entry.rule === rule).length]));
  const status = failures.length || (!writeBaseline && !pruneBaseline && fresh.length) ? 'FAIL' : 'PASS';
  writeFileSync(resolve(out, 'report.json'), JSON.stringify({ gate: 'v58.74 rendered-copy-lint', status, routes: ROUTE_IDS.length, counts, offenderKinds: current.length, baseline: baseline.size, fixedSinceBaseline: fixed, fresh, failures, offenders }, null, 2) + '\n');
  const summary = Object.entries(counts).filter(([, n]) => n).map(([rule, n]) => `${rule} ${n}`).join(', ') || 'none';
  if (failures.length) { console.error(`v58.74 rendered copy lint FAIL (${failures.length} check failure(s))`); failures.forEach((failure) => console.error(JSON.stringify(failure).slice(0, 600))); process.exit(1); }
  if (writeBaseline || pruneBaseline) process.exit(0);
  if (fresh.length) {
    console.error(`v58.74 rendered copy lint FAIL: ${fresh.length} new offender(s) not in architecture/rendered-copy-baseline.json (${summary})`);
    fresh.slice(0, 40).forEach((entry) => console.error(`- ${entry.rule} ${entry.route}: ${entry.line}`));
    process.exit(1);
  }
  console.log(`v58.74 rendered copy lint PASS: ${ROUTE_IDS.length} routes, folds open; no new offenders (current: ${summary}; ${current.length} kinds, baseline ${baseline.size}, fixed since baseline ${fixed.length}).`);
}
