#!/usr/bin/env node
// v57.54: retired user-facing vocabulary gate (static). The dictionary is architecture/ui-vocabulary.json (banned term,
// preferred term, allowed contexts); offenders that existed when the gate was introduced are listed in
// architecture/ui-render-baseline.json under "vocabulary" and only NEW offenders fail. Visible strings are markup text
// nodes and visible attributes of index.html (no <script>/<style>/comments) and string/template literals of src/ui
// (no comments).
//
//   node scripts/ci-ui-vocabulary-check.mjs                    verify (fails on offenders not in the baseline)
//   node scripts/ci-ui-vocabulary-check.mjs --prune-baseline   drop baseline entries that are fixed (shrink only)
//   node scripts/ci-ui-vocabulary-check.mjs --write-baseline   record every current offender (deliberate re-baseline)
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DICTIONARY = resolve(root, 'architecture/ui-vocabulary.json');
const BASELINE = resolve(root, 'architecture/ui-render-baseline.json');
const writeBaseline = process.argv.includes('--write-baseline');
const pruneBaseline = process.argv.includes('--prune-baseline');
const dictionary = JSON.parse(readFileSync(DICTIONARY, 'utf8'));
const terms = dictionary.terms.map((term) => ({ ...term, re: new RegExp(term.pattern, 'u'), unless: term.unlessPattern ? new RegExp(term.unlessPattern, 'u') : null,
  allowed: (term.allowedContexts || []).map((ctx) => ({ file: ctx.file || null, re: ctx.pattern ? new RegExp(ctx.pattern, 'u') : null })) }));
const HANGUL = /[가-힣]/u;
const normalize = (text) => String(text).replace(/\s+/g, ' ').trim();
const decode = (text) => text.replace(/&nbsp;/g, ' ').replace(/&middot;/g, '·').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

// ── index.html: text nodes and visible attributes ────────────────────────────────────────────────
function markupStrings(source) {
  const stripped = source.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ');
  const out = [];
  for (const match of stripped.matchAll(/>([^<>]+)</g)) out.push(decode(match[1]));
  const attrs = (dictionary.scope?.visibleAttributes || ['title', 'aria-label', 'placeholder', 'alt']).join('|');
  for (const match of stripped.matchAll(new RegExp(`\\s(?:${attrs})\\s*=\\s*("([^"]*)"|'([^']*)')`, 'g'))) out.push(decode(match[2] ?? match[3] ?? ''));
  return out;
}

// ── JS: string literals and template text, comments skipped (regex literals detected heuristically) ──
const REGEX_PREFIX = /[(,=:[!&|?{};+\-*%<>~^]$/;
const REGEX_KEYWORDS = /(?:^|[^\w$])(?:return|typeof|case|do|else|in|of|void|yield|await|delete|throw|new)$/;
function scriptStrings(source) {
  const out = [];
  let i = 0;
  let lastSignificant = '';
  const prefix = () => source.slice(Math.max(0, i - 12), i).replace(/\s+$/, '');
  function readQuoted(quote) {
    let text = '';
    i += 1;
    while (i < source.length && source[i] !== quote) {
      if (source[i] === '\\') { text += source[i + 1] === 'n' ? ' ' : source[i + 1]; i += 2; continue; }
      if (source[i] === '\n') break;
      text += source[i]; i += 1;
    }
    i += 1;
    return text;
  }
  function readTemplate() {
    // Static chunks are joined with a placeholder so "${n}건" still reads as one string; expressions are scanned too.
    let text = '';
    i += 1;
    while (i < source.length && source[i] !== '`') {
      if (source[i] === '\\') { text += source[i + 1]; i += 2; continue; }
      if (source[i] === '$' && source[i + 1] === '{') {
        let depth = 1; i += 2;
        while (i < source.length && depth > 0) {
          const ch = source[i];
          if (ch === '{') depth += 1; else if (ch === '}') depth -= 1;
          else if (ch === '\'' || ch === '"') { out.push(readQuoted(ch)); continue; }
          else if (ch === '`') { out.push(readTemplate()); continue; }
          i += 1;
        }
        text += ' '; // a value sits here
        continue;
      }
      text += source[i]; i += 1;
    }
    i += 1;
    return text;
  }
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '/' && next === '/') { while (i < source.length && source[i] !== '\n') i += 1; continue; }
    if (ch === '/' && next === '*') { const end = source.indexOf('*/', i + 2); i = end < 0 ? source.length : end + 2; continue; }
    if (ch === '\'' || ch === '"') { out.push(readQuoted(ch)); lastSignificant = 'a'; continue; }
    if (ch === '`') { out.push(readTemplate()); lastSignificant = 'a'; continue; }
    if (ch === '/' && (lastSignificant === '' || REGEX_PREFIX.test(lastSignificant) || REGEX_KEYWORDS.test(prefix()))) {
      // regex literal: skip it (patterns are code, not visible text)
      i += 1; let inClass = false;
      while (i < source.length && source[i] !== '\n') {
        if (source[i] === '\\') { i += 2; continue; }
        if (source[i] === '[') inClass = true; else if (source[i] === ']') inClass = false;
        else if (source[i] === '/' && !inClass) { i += 1; break; }
        i += 1;
      }
      while (/[a-z]/i.test(source[i] || '')) i += 1;
      lastSignificant = 'a';
      continue;
    }
    if (!/\s/.test(ch)) lastSignificant = /[\w$)\]]/.test(ch) ? 'a' : ch;
    i += 1;
  }
  return out;
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);
}

const sources = [{ file: 'index.html', strings: markupStrings(readFileSync(resolve(root, 'index.html'), 'utf8')) }];
for (const file of walk(resolve(root, 'src/ui')).filter((path) => path.endsWith('.js')).sort()) {
  sources.push({ file: relative(root, file).replace(/\\/g, '/'), strings: scriptStrings(readFileSync(file, 'utf8')) });
}

const offenders = [];
for (const { file, strings } of sources) {
  for (const raw of strings) {
    const text = normalize(raw);
    if (!text) continue;
    for (const term of terms) {
      if (term.id !== 'kalman-untranslated' && !HANGUL.test(text)) continue;
      if (!term.re.test(text) || (term.unless && term.unless.test(text))) continue;
      if (term.allowed.some((ctx) => (!ctx.file || ctx.file === file) && (!ctx.re || ctx.re.test(text)))) continue;
      offenders.push({ key: `${file}|${term.id}|${text.slice(0, 120)}`, file, term: term.id, preferred: term.preferred, text: text.slice(0, 160) });
    }
  }
}

const baselineDoc = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
const baseline = new Set(baselineDoc.vocabulary?.offenders || []);
const current = [...new Set(offenders.map((entry) => entry.key))].sort();
const fresh = offenders.filter((entry) => !baseline.has(entry.key));
const fixed = [...baseline].filter((key) => !current.includes(key));
const counts = offenders.reduce((acc, entry) => ({ ...acc, [entry.term]: (acc[entry.term] || 0) + 1 }), {});

if (writeBaseline || pruneBaseline) {
  const next = writeBaseline ? current : [...baseline].filter((key) => current.includes(key)).sort();
  const doc = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
  doc.vocabulary = { note: 'v57.54 offenders accepted at introduction; shrink with --prune-baseline as pages are fixed.', offenders: next };
  writeFileSync(BASELINE, JSON.stringify(doc, null, 2) + '\n');
  console.log(`UI vocabulary baseline ${writeBaseline ? 'written' : 'pruned'}: ${next.length} offender(s)${pruneBaseline ? ` (${fixed.length} fixed removed)` : ''}.`);
  process.exit(0);
}

const out = resolve(root, '_artifacts', 'ui-vocabulary');
mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, 'report.json'), JSON.stringify({ gate: 'v57.54 ui-vocabulary', status: fresh.length ? 'FAIL' : 'PASS', counts, total: offenders.length, baseline: baseline.size, fixedSinceBaseline: fixed, fresh, offenders }, null, 2) + '\n');
const summary = Object.entries(counts).map(([term, count]) => `${term} ${count}`).join(', ') || 'none';
if (fresh.length) {
  console.error(`v57.54 UI vocabulary FAIL: ${fresh.length} new retired-term string(s) (dictionary architecture/ui-vocabulary.json)`);
  fresh.slice(0, 40).forEach((entry) => console.error(`- ${entry.file} [${entry.term} → ${entry.preferred}] ${entry.text}`));
  process.exit(1);
}
console.log(`v57.54 UI vocabulary PASS: no new retired terms in ${sources.length} files (current offenders ${offenders.length}: ${summary}; baseline ${baseline.size}, fixed since baseline ${fixed.length}).`);
