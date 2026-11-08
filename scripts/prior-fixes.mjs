#!/usr/bin/env node
// v59.84 (recurrence analysis S3, owner 2026-11-08 "기록하면 뭐해, 활용하지도 않고"): the postmortem ledger was read only to
// pick the next P number. 943 entries since 10/01 repeated the same classes (one fact two labels, a currency mix, an id
// left in prose) because nobody looked at what was already fixed in the file before changing it. This lists the ledger
// entries that name a file — its path, its basename or one of its exported names — so a fix starts from the earlier ones.
//   node scripts/prior-fixes.mjs src/domain/macro/macro-read.js [more files] [--limit 8] [--json]
// Read-only. The bug-fix skill runs it in phase 1; the post-edit hook prints it once per file per session.
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER = '_context/BUG-POSTMORTEM.md';
const MIN_SYMBOL = 7; // shorter exported names ("bp", "fmt", "state") match unrelated prose

/** Entries of the postmortem ledger: { id, version, title, body }. */
export function ledgerEntries(text) {
  const out = [];
  const parts = String(text || '').split(/^## (?=P\d+ - )/m).slice(1);
  for (const part of parts) {
    const head = part.split('\n')[0];
    const match = /^P(\d+) - (v[\d.]+) - (.*)$/.exec(head.trim());
    if (match) out.push({ id: `P${match[1]}`, version: match[2], title: match[3].replace(/\s*\([\d-]{10}\)\s*$/, '') /* the ledger heading's trailing (date) */, body: part });
  }
  return out;
}

/** The words that name a file in the ledger: its repo path, its basename and its exported names. */
export function fileTerms(root, file) {
  const abs = resolve(root, file);
  const rel = relative(root, abs).replace(/\\/g, '/');
  const terms = new Set([rel, basename(rel)]);
  try {
    const source = readFileSync(abs, 'utf8');
    for (const m of source.matchAll(/^export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) if (m[1].length >= MIN_SYMBOL) terms.add(m[1]);
  } catch { /* a deleted or unreadable file is named by its path only */ }
  return [...terms];
}

/** Ledger entries naming any of `files`, newest first, with the terms that matched. */
export function priorFixes(files, { root = ROOT, limit = 8, ledgerText = null } = {}) {
  const entries = ledgerEntries(ledgerText ?? (existsSync(join(root, LEDGER)) ? readFileSync(join(root, LEDGER), 'utf8') : ''));
  return files.map((file) => {
    const terms = fileTerms(root, file);
    const lower = terms.map((term) => term.toLowerCase()); // _aioStripEvidenceIds names stripEvidenceIds
    const hits = entries.map((entry) => { const body = entry.body.toLowerCase(); return { ...entry, matched: terms.filter((term, i) => body.includes(lower[i])) }; })
      .filter((entry) => entry.matched.length)
      .sort((a, b) => Number(b.id.slice(1)) - Number(a.id.slice(1)));
    return { file: relative(root, resolve(root, file)).replace(/\\/g, '/'), total: hits.length, entries: hits.slice(0, limit).map(({ id, version, title, matched }) => ({ id, version, title, matched })) };
  });
}

export function priorFixesText(reports) {
  return reports.filter((report) => report.total).map((report) => `${report.file}: 과거 결함 ${report.total}건 — ${report.entries.map((entry) => `${entry.id}(${entry.version}) ${entry.title.slice(0, 60)}`).join(' | ')}`).join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const at = args.indexOf('--limit');
  const limit = at >= 0 ? Number(args[at + 1]) : 8;
  const files = args.filter((arg, i) => !arg.startsWith('--') && args[i - 1] !== '--limit');
  if (!files.length) { console.error('usage: node scripts/prior-fixes.mjs <file> [...] [--limit N] [--json]'); process.exit(2); }
  const reports = priorFixes(files, { limit: Number.isFinite(limit) && limit > 0 ? limit : 8 });
  console.log(json ? JSON.stringify(reports, null, 2) : (priorFixesText(reports) || 'prior-fixes: no ledger entry names these files'));
}
