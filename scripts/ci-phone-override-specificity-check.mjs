#!/usr/bin/env node
// v59.70 (screen review 2026-11-04 #1): a phone rule (inside @media (max-width: ≤760px)) that re-lays an element out must
// win the cascade. responsive.css set the 1-column phone grid for 금리와 환율 '원화는 왜 움직였나' and 뉴스 '뉴스가 모이는 곳'
// with specificity (1,1,0) while the 2-column rule above it was (1,2,0), so on a 390px phone the read column was 4px wide
// and its text stacked one letter per line. This gate parses every stylesheet the app loads and fails when a phone
// rule's layout declaration is beaten, at that phone width, by a non-phone rule that can reach the same element (same
// subject compound) with a different value: higher specificity, equal specificity later in the same file, or !important
// on the other side only. `--css <file>` checks one file (the v59.69 responsive.css fails).
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const LAYOUT = new Set(['grid-template-columns', 'grid-template-areas', 'grid-column', 'flex-direction', 'flex-wrap', 'flex-basis', 'flex', 'display', 'width', 'max-width', 'min-width', 'columns']);
const PHONE_MAX = 760;

export function parseCss(text, file) {
  const css = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const rules = [];
  const stack = [];
  let i = 0; let start = 0; let order = 0;
  while (i < css.length) {
    const c = css[i];
    if (c === '{') {
      const head = css.slice(start, i).trim();
      if (head.startsWith('@')) {
        const max = head.match(/max-width:\s*(\d+)px/);
        const min = head.match(/min-width:\s*(\d+)px/);
        const skip = /^@media\s+print/.test(head) || /^@(?:keyframes|font-face|page)/.test(head);
        stack.push({ max: max ? Number(max[1]) : null, min: min ? Number(min[1]) : null, skip });
        start = i + 1;
      } else {
        const end = css.indexOf('}', i);
        const body = css.slice(i + 1, end);
        const max = stack.map((s) => s.max).filter((v) => v != null);
        const min = stack.map((s) => s.min).filter((v) => v != null);
        if (!stack.some((s) => s.skip)) {
          rules.push({ file, order: order++, line: css.slice(0, i).split('\n').length, selector: head, max: max.length ? Math.min(...max) : null, min: min.length ? Math.max(...min) : null, declarations: parseDeclarations(body) });
        }
        i = end; start = end + 1;
      }
    } else if (c === '}') {
      stack.pop(); start = i + 1;
    } else if (c === ';' && !stack.length) {
      start = i + 1; // @import / @charset
    }
    i += 1;
  }
  return rules;
}

function parseDeclarations(body) {
  const out = new Map();
  for (const part of body.split(';')) {
    const at = part.indexOf(':');
    if (at < 0) continue;
    const prop = part.slice(0, at).trim().toLowerCase();
    const value = part.slice(at + 1).trim();
    if (prop) out.set(prop, { value, important: /!important\s*$/.test(value) });
  }
  return out;
}

function splitTop(text, sep = ',') {
  const parts = []; let depth = 0; let cur = '';
  for (const ch of text) {
    if (ch === '(') depth += 1; else if (ch === ')') depth -= 1;
    if (ch === sep && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** `:is(a, b) c` → ['a c', 'b c']: each :is() branch is its own selector, counted at that branch's specificity. */
export function expandSelector(selector) {
  const match = selector.match(/:is\(/);
  if (!match) return [selector.replace(/\s+/g, ' ').trim()];
  const open = match.index + 4; let depth = 1; let j = open;
  while (j < selector.length && depth) { if (selector[j] === '(') depth += 1; if (selector[j] === ')') depth -= 1; j += 1; }
  return splitTop(selector.slice(open, j - 1)).flatMap((arg) => expandSelector(`${selector.slice(0, match.index)}${arg}${selector.slice(j)}`));
}

const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
export function specificity(selector) {
  let s = selector.replace(/:where\((?:[^()]|\([^()]*\))*\)/g, '');
  let extra = [0, 0, 0];
  s = s.replace(/:(?:not|has)\(((?:[^()]|\([^()]*\))*)\)/g, (m, arg) => {
    const best = splitTop(arg).map(specificity).sort(cmp).pop() || [0, 0, 0];
    extra = extra.map((v, k) => v + best[k]);
    return '';
  });
  const SIMPLE = /#[\w-]+|\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+(?:\([^)]*\))?/g;
  const ids = (s.match(/#[\w-]+/g) || []).length;
  const classLike = (s.match(SIMPLE) || []).length - ids;
  const types = (s.replace(SIMPLE, ' ').match(/(?:^|[\s>+~])[a-zA-Z][\w-]*|::[\w-]+/g) || []).length;
  return [ids + extra[0], classLike + extra[1], types + extra[2]];
}

const subject = (selector) => (splitTop(selector.replace(/\s*([>+~])\s*/g, ' '), ' ').pop() || '').trim();
const bare = (v) => v.replace(/\s*!important\s*$/, '').replace(/\s+/g, ' ').trim();
const typeOnly = (compound) => /^[a-z][\w-]*$/i.test(compound);
const names = (text) => new Set(text.match(/[#.][\w-]+/g) || []);
const isPhone = (rule) => rule.max != null && rule.max <= PHONE_MAX;

// Two selectors can reach one element when their subjects match; for a bare-type subject (button, input) they must also
// share an id or class elsewhere, and two different page scopes (#page-x, #page-y) never meet.
function canMeet(a, b) {
  if (a.subject !== b.subject) return false;
  const pages = (t) => (t.match(/#page-[\w-]+/g) || []).sort().join();
  if (pages(a.text) && pages(b.text) && pages(a.text) !== pages(b.text)) return false;
  if (typeOnly(a.subject)) { const mine = names(a.text); return [...names(b.text)].some((name) => mine.has(name)); }
  return true;
}

/** 1 when x wins over y, -1 when y wins, null when only the (unknown) load order between two files would decide. */
function cascade(x, y) {
  if (x.decl.important !== y.decl.important) return x.decl.important ? 1 : -1;
  const bySpec = cmp(x.entry.spec, y.entry.spec);
  if (bySpec) return Math.sign(bySpec);
  if (x.entry.rule.file !== y.entry.rule.file) return null;
  return Math.sign(x.entry.rule.order - y.entry.rule.order);
}

export function findConflicts(rules) {
  const entries = [];
  for (const rule of rules) for (const text of splitTop(rule.selector).flatMap(expandSelector)) entries.push({ rule, text, spec: specificity(text), subject: subject(text) });
  const bySubject = new Map();
  for (const entry of entries) { if (!bySubject.has(entry.subject)) bySubject.set(entry.subject, []); bySubject.get(entry.subject).push(entry); }
  const conflicts = [];
  for (const mine of entries.filter((e) => isPhone(e.rule) && e.rule.min == null)) {
    const width = mine.rule.max;
    for (const [prop, decl] of mine.rule.declarations) {
      if (!LAYOUT.has(prop)) continue;
      // Every declaration of this property that applies at this phone width and can reach the same element.
      const field = [{ entry: mine, decl }, ...(bySubject.get(mine.subject) || [])
        .filter((other) => other !== mine && canMeet(mine, other) && other.rule.declarations.has(prop))
        .filter((other) => (other.rule.max == null || other.rule.max >= width) && (other.rule.min == null || other.rule.min <= width))
        .map((other) => ({ entry: other, decl: other.rule.declarations.get(prop) }))];
      // The cascade winner(s): nothing in the field beats them.
      const winners = field.filter((x) => !field.some((y) => y !== x && (y.entry === mine || x.entry === mine || canMeet(y.entry, x.entry)) && cascade(y, x) === 1));
      const wrong = winners.filter((w) => !isPhone(w.entry.rule) && bare(w.decl.value) !== bare(decl.value) && cascade(w, { entry: mine, decl }) === 1);
      for (const w of wrong) {
        const other = w.entry;
        conflicts.push(`${mine.rule.file}:${mine.rule.line} phone ${prop}: ${bare(decl.value)} on "${mine.text}" (${mine.spec}) loses to ${other.rule.file}:${other.rule.line} "${other.text}" (${other.spec}${other.rule.max ? `, max-width ${other.rule.max}` : ''}) ${bare(w.decl.value)}${w.decl.important ? ' !important' : ''}`);
      }
    }
  }
  return [...new Set(conflicts)];
}

function appStylesheets() {
  const html = readFileSync(join(repo, 'index.html'), 'utf8');
  const files = [['index.html <style>', [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n')]];
  const dir = join(repo, 'src/ui/styles');
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.css')).sort()) files.push([`src/ui/styles/${name}`, readFileSync(join(dir, name), 'utf8')]);
  return files;
}

const at = process.argv.indexOf('--css');
const sources = at > 0 ? [[process.argv[at + 1], readFileSync(process.argv[at + 1], 'utf8')]] : appStylesheets();
const rules = sources.flatMap(([file, text]) => parseCss(text, file));
const conflicts = findConflicts(rules);
if (conflicts.length) {
  console.error(`Phone override specificity FAILED (${conflicts.length}):\n- ${conflicts.join('\n- ')}`);
  process.exit(1);
}
console.log(`Phone override specificity OK: ${rules.filter(isPhone).length} phone rules win the cascade over the ${rules.length} rules in the app's stylesheets.`);
