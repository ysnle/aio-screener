#!/usr/bin/env node
// v59.70 (screen review 2026-11-04 #2, #4, #25, #26): every route in light and dark at 1440px, all folds open.
//   contrast — text against the background it is painted on (ancestor colours composited) meets WCAG AA: 4.5, or 3 for
//              large text (24px, or 18.66px bold). Text over an image or gradient is skipped (not measurable here).
//   links    — no link keeps the browser's default blue or purple (뉴스 시간대별 시황 headlines were UA blue in dark, 1.85).
//   labels   — no heading, fold row, section label, button or tab names the screen '거시' (owner: 매크로).
//   folds    — every fold row (details > summary) shows that it opens: list marker, drawn or glyph chevron, or 펼치기·접기.
//   focus    — a keyboard-focused term mark, fold summary, button or link shows an outline or a ring (box-shadow).
//   busy     — the shared busy spinner on every visible button (and the AI panel's) neither covers the label nor overflows.
// Report: _artifacts/contrast-focus/report.json. `--routes a,b` and `--schemes light` narrow a run.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeAll, startLocalServer } from './lib/browser-gate.mjs';
import { ROUTE_IDS } from '../src/app/routes.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.CI_CONTRAST_PORT || 8911);
const arg = (name) => { const at = process.argv.indexOf(`--${name}`); return at > 0 ? process.argv[at + 1] : null; };
const routes = (arg('routes') || ROUTE_IDS.join(',')).split(',').filter(Boolean);
const schemes = (arg('schemes') || 'light,dark').split(',');
const outPath = resolve(root, '_artifacts', 'contrast-focus', 'report.json');

function audit() {
  const parse = (c) => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [r, g, b, a]; };
  const over = (top, bottom) => { const a = top[3]; return [0, 1, 2].map((k) => top[k] * a + bottom[k] * (1 - a)).concat(1); };
  const lum = (c) => c.slice(0, 3).map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, k) => s + v * [0.2126, 0.7152, 0.0722][k], 0);
  const ratio = (a, b) => { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const visible = (el) => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const s = getComputedStyle(n); if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) < 0.4) return false; if (n.getAttribute('aria-hidden') === 'true') return false; } return !/rect\(0/.test(getComputedStyle(el).clip); };
  const background = (el) => {
    const layers = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.backgroundImage && s.backgroundImage !== 'none') return null;
      const c = parse(s.backgroundColor);
      if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break; }
    }
    let base = [255, 255, 255, 1];
    const bodyBg = parse(getComputedStyle(document.body).backgroundColor);
    if (bodyBg && bodyBg[3] >= 1) base = bodyBg;
    return layers.reverse().reduce((acc, layer) => over(layer, acc), base);
  };
  const sig = (el) => `${el.tagName.toLowerCase()}${el.classList.length ? `.${[...el.classList].slice(0, 2).join('.')}` : ''}${el.id ? `#${el.id}` : ''}`;
  const page = document.querySelector('.page.active');
  const scopes = [page, document.querySelector('.topbar')].filter(Boolean);
  const contrast = new Map();
  const links = [];
  for (const scope of scopes) {
    for (const el of scope.querySelectorAll('*')) {
      if (el.closest('svg, canvas, [data-contrast-exempt]')) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
      if (el.tagName === 'A' && visible(el)) { const c = getComputedStyle(el).color; if (/^rgb\((0, 0, 238|85, 26, 139)\)$/.test(c)) links.push({ sig: sig(el), text: el.textContent.trim().slice(0, 40) }); }
      if (!own || !visible(el) || el.closest('[disabled], [aria-disabled="true"]')) continue;
      const s = getComputedStyle(el);
      const fgRaw = parse(s.color); const bg = background(el);
      if (!fgRaw || !bg) continue;
      const fg = over(fgRaw, bg);
      const size = parseFloat(s.fontSize); const bold = Number(s.fontWeight) >= 700;
      const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
      const r = ratio(fg, bg);
      if (r + 0.005 < need) {
        const key = sig(el);
        const prev = contrast.get(key);
        if (!prev || r < prev.ratio) contrast.set(key, { sig: key, ratio: Math.round(r * 100) / 100, need, text: el.textContent.trim().slice(0, 40), count: (prev?.count || 0) + 1 });
        else prev.count += 1;
      }
    }
  }
  // A fold row shows that it opens: the list marker, a drawn or glyph ::before/::after on the row or inside it, or the word.
  const marked = (summary) => {
    const cs = getComputedStyle(summary);
    if (cs.display === 'list-item' && cs.listStyleType !== 'none') return true;
    if (/펼치|접기/.test(summary.textContent)) return true;
    for (const n of [summary, ...summary.querySelectorAll('*')]) {
      for (const pe of ['::after', '::before']) {
        const ps = getComputedStyle(n, pe);
        if (!ps.content || ps.content === 'none' || ps.content === 'normal') continue;
        if (ps.content.replace(/^"|"$/g, '').trim()) return true;
        const drawn = parseFloat(ps.borderRightWidth) > 0 || parseFloat(ps.borderBottomWidth) > 0 || (ps.maskImage && ps.maskImage !== 'none');
        if (drawn && parseFloat(ps.width) > 0 && parseFloat(ps.width) < 30) return true;
      }
    }
    return false;
  };
  const folds = [...page.querySelectorAll('details > summary')]
    .filter((s) => s.parentElement.firstElementChild === s && visible(s) && !marked(s))
    .map((s) => ({ sig: sig(s.parentElement), text: s.textContent.trim().slice(0, 30) }));
  // Owner decision (screen review #36): the screen, its tabs and its labels are 매크로; '거시' stays only in body sentences.
  const labels = [...page.querySelectorAll('h1, h2, h3, h4, summary, .aio-section-label, button, [role="tab"], .lu-gl-tag')]
    .filter((node) => visible(node) && /거시/.test(node.textContent))
    .map((node) => ({ sig: sig(node), text: node.textContent.trim().slice(0, 40) }));
  // Screen review #35: one date format on chart axes and ends — "26년 1월" / "7월", or "M/D" for a window under two months
  // (the sparkline ends read "25.10" beside trend charts reading "26년 1월").
  for (const node of page.querySelectorAll('.macro-spark-dates span, .trend-chart text.trend-chart-axis[text-anchor="middle"]')) {
    const text = node.textContent.trim();
    if (text && !/^(?:\d{2}년 )?\d{1,2}월$|^\d{1,2}\/\d{1,2}$/.test(text)) labels.push({ sig: `${sig(node)} (date axis)`, text });
  }
  // Screen review #32: the page title carries no generated word above it (the hub name floated between date and title).
  const title = page.querySelector('.page-title');
  const before = title ? getComputedStyle(title, '::before').content : 'none';
  if (title && before && before !== 'none' && before !== 'normal' && before !== '""') labels.push({ sig: `${sig(title)}::before`, text: before.slice(0, 40) });
  return { contrast: [...contrast.values()], links, folds, labels };
}

function focusCandidates() {
  const page = document.querySelector('.page.active');
  if (!page) return [];
  const pick = [];
  const add = (sel, limit) => { [...page.querySelectorAll(sel)].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).slice(0, limit).forEach((el) => pick.push(el)); };
  add('.aio-term[tabindex]', 4); add('summary', 6); add('button:not([disabled])', 8); add('a[href]', 4); add('[tabindex="0"]:not(.aio-term)', 3);
  [...new Set(pick)].forEach((el, k) => el.setAttribute('data-focus-probe', String(k)));
  return [...new Set(pick)].length;
}

function focusShown(k) {
  const el = document.querySelector(`[data-focus-probe="${k}"]`);
  if (!el) return null;
  el.focus({ preventScroll: true });
  if (document.activeElement !== el) return { skip: true };
  const s = getComputedStyle(el);
  const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1 && !/rgba\(0, 0, 0, 0\)|transparent/.test(s.outlineColor);
  const ring = s.boxShadow && s.boxShadow !== 'none';
  const sig = `${el.tagName.toLowerCase()}${el.classList.length ? `.${[...el.classList].slice(0, 2).join('.')}` : ''}`;
  return { ok: outline || ring, sig, text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30) };
}

// v59.70 (integration review): the shared busy spinner (ui-states.css button[aria-busy]::after) on every visible button of the
// route and the AI panel's buttons. An absolutely placed spinner must not cross the label; one in the flow must keep the
// button's content inside the button (no overflow past its edge).
function busyOverlap() {
  const page = document.querySelector('.page.active');
  // A visually hidden button (1x1, clipped: the skip-to-basis button until it is focused) draws nothing to overlap.
  const shown = (b) => { const r = b.getBoundingClientRect(); return r.width > 2 && r.height > 2 && !/rect\(0/.test(getComputedStyle(b).clip); };
  const buttons = [...new Set([...(page ? page.querySelectorAll('button') : []), ...document.querySelectorAll('#ai-panel button, .topbar button')])].filter(shown).slice(0, 80);
  const bad = [];
  for (const b of buttons) {
    const range = document.createRange();
    const rects = [];
    const walker = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) { if (!n.textContent.trim()) continue; range.selectNodeContents(n); rects.push(...range.getClientRects()); }
    const had = b.getAttribute('aria-busy');
    b.setAttribute('aria-busy', 'true');
    const s = getComputedStyle(b, '::after');
    const sig = `${b.tagName.toLowerCase()}${b.id ? `#${b.id}` : ''}${b.classList.length ? `.${[...b.classList].slice(0, 2).join('.')}` : ''}`;
    const text = (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 30);
    if (s.content && s.content !== 'none' && s.content !== 'normal') {
      if (s.position === 'absolute' || s.position === 'fixed') {
        const br = b.getBoundingClientRect(); const bs = getComputedStyle(b);
        const w = parseFloat(s.width) || 0; const h = parseFloat(s.height) || 0;
        const left = s.right !== 'auto' ? br.right - parseFloat(bs.borderRightWidth) - parseFloat(s.right) - w - (parseFloat(s.marginRight) || 0) : br.left + parseFloat(bs.borderLeftWidth) + parseFloat(s.left) + (parseFloat(s.marginLeft) || 0);
        const top = br.top + parseFloat(bs.borderTopWidth) + parseFloat(s.top) + (parseFloat(s.marginTop) || 0);
        const hit = rects.some((r) => r.width > 0 && left < r.right && left + w > r.left && top < r.bottom && top + h > r.top);
        if (hit) bad.push({ sig, text, why: 'spinner covers the label' });
      } else if (b.scrollWidth > b.clientWidth + 1) bad.push({ sig, text, why: `content ${b.scrollWidth}px overflows the ${b.clientWidth}px button` });
    }
    if (had === null) b.removeAttribute('aria-busy'); else b.setAttribute('aria-busy', had);
  }
  return bad;
}

async function main() {
  mkdirSync(dirname(outPath), { recursive: true });
  const server = await startLocalServer(port, { label: 'contrast-focus/server' });
  const browser = await chromium.launch().catch(async (error) => { await closeAll({ server }); throw error; });
  const report = { schemaVersion: 'aio-contrast-focus.v1', observedAt: new Date().toISOString(), runs: [] };
  const failures = [];
  try {
    for (const scheme of schemes) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme, serviceWorkers: 'block', reducedMotion: 'reduce' });
      await context.addInitScript((dark) => { try { localStorage.setItem('aio_disclaimer_ack_v1', '1'); localStorage.setItem('aio_theme', dark ? 'dark' : 'light'); } catch (_) { /* storage blocked */ } }, scheme === 'dark');
      const page = await context.newPage();
      for (const route of routes) {
        await page.goto(`http://127.0.0.1:${port}/index.html#${route}`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.querySelector('.page.active'), null, { timeout: 30000 });
        await page.waitForTimeout(4000);
        await page.evaluate(() => document.querySelectorAll('.page.active details').forEach((d) => { d.open = true; }));
        await page.waitForTimeout(400);
        const found = await page.evaluate(audit);
        // Keyboard modality first, so focus() matches :focus-visible like a Tab press would.
        await page.keyboard.press('Shift');
        const count = await page.evaluate(focusCandidates);
        const focusMissing = [];
        for (let k = 0; k < count; k += 1) {
          await page.keyboard.press('Shift');
          const shown = await page.evaluate(focusShown, k);
          if (shown && !shown.skip && !shown.ok) focusMissing.push({ sig: shown.sig, text: shown.text });
        }
        const busy = await page.evaluate(busyOverlap);
        if (route === routes[0]) { // the AI panel is shared: opened once per scheme, measured, closed
          await page.evaluate(() => document.querySelector('#topbar-ai-btn')?.click());
          await page.waitForTimeout(600);
          for (const b of await page.evaluate(busyOverlap)) if (!busy.some((x) => x.sig === b.sig)) busy.push(b);
          await page.evaluate(() => document.querySelector('#topbar-ai-btn')?.click());
          await page.waitForTimeout(300);
        }
        const run = { route, scheme, contrast: found.contrast, links: found.links, folds: found.folds, labels: found.labels, focusMissing, busy };
        report.runs.push(run);
        for (const c of found.contrast) failures.push(`${scheme}/${route}: contrast ${c.ratio} < ${c.need} on ${c.sig} "${c.text}" (${c.count}x)`);
        for (const l of found.links) failures.push(`${scheme}/${route}: link in the browser's default colour ${l.sig} "${l.text}"`);
        for (const l of found.labels) failures.push(`${scheme}/${route}: label check — '거시' where the screen is 매크로, or a generated word above the title: ${l.sig} "${l.text}"`);
        for (const f of found.folds) failures.push(`${scheme}/${route}: fold row with no open marker ${f.sig} "${f.text}"`);
        for (const f of focusMissing) failures.push(`${scheme}/${route}: no visible focus on ${f.sig} "${f.text}"`);
        for (const b of busy) failures.push(`${scheme}/${route}: busy spinner — ${b.why} on ${b.sig} "${b.text}"`);
      }
      await context.close();
    }
  } finally {
    await closeAll({ browser, server });
  }
  report.failures = failures.length;
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  if (failures.length) {
    console.error(`Contrast/focus browser check FAILED (${failures.length}) — report ${outPath}\n- ${[...new Set(failures)].slice(0, 80).join('\n- ')}`);
    process.exit(1);
  }
  console.log(`Contrast/focus browser check OK: ${routes.length} routes x ${schemes.join('/')} — AA text contrast, themed links, visible focus.`);
}

main().catch((error) => { console.error(error); process.exit(1); });
