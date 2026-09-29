#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// scripts/record-fix.mjs — one-shot ledger recorder for a code fix.
//
// Every fix touches the same six surfaces by hand (BUG-POSTMORTEM P entry, RULES
// R entry, QA-CHECKLIST rows, CHANGELOG bullets, version.json note, EXECUTION-STATUS
// entry). Doing that manually drifts. This tool computes every edit in memory,
// validates it, and only then writes all files atomically (tmp file + rename).
//
// Usage:
//   node scripts/record-fix.mjs <entry.json> [--root DIR] [--dry-run]
//
// entry.json:
//   { "version": "v56.80", "date": "2026-09-29",
//     "p": { "id"?: 1322, "title", "symptom", "root_cause", "fix",
//            "violated_rule", "prevention", "verification" },
//     "r": { "id"?: 667, "title", "rule", "validation" } | null,
//     "qa": [ { "id": "QA-UX-05", "text", "verify_by", "done"?: true } ],
//     "qa_section": "short title",
//     "changelog": [ "**Lead (P…/R…):** text" ],
//     "note": "version.json note",
//     "status": { "time": "10:40 KST", "title", "agent"?, "bullets": [] } | null }
//   Any text may contain {P} / {R}; they become the allocated ids (e.g. P1322).
//
// The tool never reads or writes ledger frontmatter counters (latest_P_number,
// next_P_number, current_total_entries, ...). It only bumps `last_verified`
// when that field exists. Ids are always derived from the ledger bodies.
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PATHS = {
  postmortem: '_context/BUG-POSTMORTEM.md',
  rules: '_context/RULES.md',
  qa: '_context/QA-CHECKLIST.md',
  changelog: 'CHANGELOG.md',
  versionJson: 'version.json',
  status: '_artifacts/full-audit-20260927/EXECUTION-STATUS.md',
  gapManifest: '_context/rule-gap-manifest.json',
};
export const CHANGELOG_PLACEHOLDER = '- <!-- 변경 내용을 이곳에 기록하세요 -->';

export class RecordFixError extends Error {
  constructor(messages) {
    const list = Array.isArray(messages) ? messages : [messages];
    super(list.join('\n'));
    this.messages = list;
  }
}

const escapeRe = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
const nonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;

// ── document helpers (BOM + per-file line endings) ──────────────────────────
function readDoc(root, rel) {
  const path = join(root, rel);
  if (!existsSync(path)) return null;
  let raw = readFileSync(path, 'utf8');
  const bom = raw.charCodeAt(0) === 0xfeff;
  if (bom) raw = raw.slice(1);
  const crlf = (raw.match(/\r\n/g) || []).length;
  const bareLf = (raw.match(/(?<!\r)\n/g) || []).length;
  return {
    rel,
    path,
    bom,
    eol: crlf > bareLf ? '\r\n' : '\n',
    mixed: crlf > 0 && bareLf > 0,
    original: raw,
    text: raw.replace(/\r\n/g, '\n'),
  };
}

function serialize(doc) {
  const body = doc.eol === '\r\n' ? doc.text.replace(/\n/g, '\r\n') : doc.text;
  return (doc.bom ? '﻿' : '') + body;
}

function splitFrontmatter(text) {
  if (!text.startsWith('---\n')) return { front: '', body: text };
  const end = text.indexOf('\n---\n', 3);
  if (end < 0) return { front: '', body: text };
  return { front: text.slice(0, end + 5), body: text.slice(end + 5) };
}

function touchLastVerified(text, date) {
  const { front, body } = splitFrontmatter(text);
  if (!front) return text;
  const next = front.replace(/^(last_verified:\s*)(\d{4}-\d{2}-\d{2})(\s*)$/m, (all, lead, old, tail) => `${lead}${old > date ? old : date}${tail}`);
  return next + body;
}

function insertAtHeading(text, headingRe, block, label) {
  const match = headingRe.exec(text);
  if (!match) throw new RecordFixError(`${label}: no existing entry heading found to anchor the insertion`);
  return text.slice(0, match.index) + block + text.slice(match.index);
}

// ── validation ──────────────────────────────────────────────────────────────
// C0 (except tab/LF/CR) + C1 + replacement char: the mojibake signature that
// ci-control-char-check guards against.
const badChar = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f�]/;
function scanControlChars(value, path, errors) {
  if (typeof value === 'string') {
    if (badChar.test(value)) errors.push(`${path}: contains a control or replacement character`);
  } else if (Array.isArray(value)) value.forEach((item, i) => scanControlChars(item, `${path}[${i}]`, errors));
  else if (isObject(value)) for (const [k, v] of Object.entries(value)) scanControlChars(v, `${path}.${k}`, errors);
}

function validateEntry(entry) {
  const errors = [];
  if (!isObject(entry)) return ['entry.json must be a JSON object'];
  scanControlChars(entry, 'entry', errors);
  if (!/^v\d+\.\d+$/.test(entry.version || '')) errors.push('version must look like "v56.80"');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date || '')) errors.push('date must be YYYY-MM-DD');
  if (!isObject(entry.p)) errors.push('p is required (title, symptom, root_cause, fix, violated_rule, prevention, verification)');
  else {
    for (const key of ['title', 'symptom', 'root_cause', 'fix', 'violated_rule', 'prevention', 'verification']) {
      if (!nonEmpty(entry.p[key])) errors.push(`p.${key} is required`);
    }
    if (entry.p.id != null && !/^P?\d+$/.test(String(entry.p.id))) errors.push('p.id must be a number or "P<number>"');
  }
  if (entry.r != null) {
    if (!isObject(entry.r)) errors.push('r must be an object or null');
    else {
      for (const key of ['title', 'rule', 'validation']) if (!nonEmpty(entry.r[key])) errors.push(`r.${key} is required`);
      if (entry.r.id != null && !/^R?\d+$/.test(String(entry.r.id))) errors.push('r.id must be a number or "R<number>"');
    }
  }
  const qa = entry.qa == null ? [] : entry.qa;
  if (!Array.isArray(qa)) errors.push('qa must be an array');
  else {
    const seen = new Set();
    qa.forEach((row, i) => {
      const at = `qa[${i}]`;
      if (!isObject(row)) { errors.push(`${at} must be an object`); return; }
      if (!/^QA-[A-Za-z0-9][A-Za-z0-9-]*$/.test(row.id || '')) errors.push(`${at}.id must look like QA-UX-05`);
      else if (seen.has(row.id)) errors.push(`${at}.id ${row.id} is repeated inside this entry`);
      else seen.add(row.id);
      if (!nonEmpty(row.text)) errors.push(`${at}.text is required`);
      if (!nonEmpty(row.verify_by)) errors.push(`${at}.verify_by is required (every QA row must say how it is re-verified)`);
    });
    if (qa.length && !nonEmpty(entry.qa_section)) errors.push('qa_section is required when qa rows are given (used for the "## <version> <qa_section> (<date>)" heading)');
  }
  if (!Array.isArray(entry.changelog) || !entry.changelog.length || !entry.changelog.every(nonEmpty)) errors.push('changelog must be a non-empty array of non-empty strings');
  if (!nonEmpty(entry.note)) errors.push('note (version.json note) is required');
  if (entry.status != null) {
    if (!isObject(entry.status)) errors.push('status must be an object or null');
    else {
      if (!nonEmpty(entry.status.time)) errors.push('status.time is required (e.g. "10:40 KST")');
      if (!nonEmpty(entry.status.title)) errors.push('status.title is required');
      if (!Array.isArray(entry.status.bullets) || !entry.status.bullets.length || !entry.status.bullets.every(nonEmpty)) errors.push('status.bullets must be a non-empty array of strings');
    }
  }
  return errors;
}

// ── main computation (pure: returns new contents, writes nothing) ────────────
export function computeRecord(root, entry) {
  const errors = validateEntry(entry);
  if (errors.length) throw new RecordFixError(errors.map((e) => `entry: ${e}`));

  const docs = {};
  const need = (key) => {
    const doc = readDoc(root, PATHS[key]);
    if (!doc) throw new RecordFixError(`${PATHS[key]} not found under ${root}`);
    docs[key] = doc;
    return doc;
  };
  const inserts = [];
  const record = (rel, text) => inserts.push({ rel, text });
  const changed = new Map(); // key -> new doc text

  // ids ---------------------------------------------------------------------
  const pm = need('postmortem');
  const pIds = [...pm.text.matchAll(/^##\s+P(\d+)\b/gm)].map((m) => Number(m[1]));
  if (!pIds.length) throw new RecordFixError(`${PATHS.postmortem}: no "## P<n>" headings found; parser cannot allocate an id`);
  const maxP = Math.max(...pIds);
  const pNum = entry.p.id != null ? Number(String(entry.p.id).replace(/^P/, '')) : maxP + 1;
  if (pIds.includes(pNum)) throw new RecordFixError(`P${pNum} already exists in ${PATHS.postmortem}; refusing duplicate`);
  const pId = `P${pNum}`;

  let rId = null;
  let rules = null;
  let maxR = null;
  if (entry.r) {
    rules = need('rules');
    const defined = [...rules.text.matchAll(/^## R(\d+)\./gm)].map((m) => Number(m[1]));
    if (!defined.length) throw new RecordFixError(`${PATHS.rules}: no "## R<n>." headings found; parser cannot allocate an id`);
    maxR = Math.max(...defined);
    const rNum = entry.r.id != null ? Number(String(entry.r.id).replace(/^R/, '')) : maxR + 1;
    if (defined.includes(rNum)) throw new RecordFixError(`R${rNum} already exists in ${PATHS.rules}; refusing duplicate`);
    // Gap policy (ci-ledger-integrity-check): a number absent from RULES.md must be in the frozen manifest.
    const manifestDoc = readDoc(root, PATHS.gapManifest);
    let frozen = new Set();
    if (manifestDoc) {
      try { frozen = new Set(JSON.parse(manifestDoc.text).absentR || []); } catch { throw new RecordFixError(`${PATHS.gapManifest} is not valid JSON`); }
    }
    // Only gaps introduced by this insert matter: numbers skipped between the old max and the new id.
    const introduced = [];
    for (let n = maxR + 1; n < rNum; n += 1) if (!frozen.has(n)) introduced.push(n);
    if (introduced.length) throw new RecordFixError(`R${rNum} would leave R number gap(s) not in ${PATHS.gapManifest}: ${introduced.map((n) => `R${n}`).join(', ')}`);
    rId = `R${rNum}`;
  }

  const sub = (value) => {
    let out = String(value);
    if (/\{P\}/.test(out)) out = out.replace(/\{P\}/g, pId);
    if (/\{R\}/.test(out)) {
      if (!rId) throw new RecordFixError('a text field uses {R} but "r" is null');
      out = out.replace(/\{R\}/g, rId);
    }
    return out;
  };
  const one = (value) => sub(value).replace(/\s*\n\s*/g, ' ').trim();
  const many = (value) => sub(value).replace(/\r\n/g, '\n').trim();
  const { version, date } = entry;

  // P entry -----------------------------------------------------------------
  {
    const p = entry.p;
    const block = [
      `## ${pId} - ${version} - ${one(p.title)} (${date})`,
      '',
      `- symptom/reproduction: ${one(p.symptom)}`,
      `- root_cause: ${one(p.root_cause)}`,
      `- fix: ${one(p.fix)}`,
      `- violated_rule: ${one(p.violated_rule)}`,
      `- prevention: ${one(p.prevention)}`,
      `- verification/residual: ${one(p.verification)}`,
      '',
      '',
    ].join('\n');
    pm.text = touchLastVerified(insertAtHeading(pm.text, /^##\s+P\d+\b/m, block, PATHS.postmortem), date);
    record(PATHS.postmortem, block);
    changed.set('postmortem', pm);
  }

  // R entry -----------------------------------------------------------------
  if (entry.r) {
    const r = entry.r;
    const block = [
      `## ${rId}. ${one(r.title)} (${version}, ${pId})`,
      '',
      `**Rule**: ${many(r.rule)}`,
      '',
      `**Validation**: ${many(r.validation)}`,
      '',
      '',
    ].join('\n');
    rules.text = touchLastVerified(insertAtHeading(rules.text, /^## R\d+\./m, block, PATHS.rules), date);
    record(PATHS.rules, block);
    changed.set('rules', rules);
  }

  // QA rows -----------------------------------------------------------------
  const qaRows = entry.qa || [];
  if (qaRows.length) {
    const qa = need('qa');
    const existing = new Set([...qa.text.matchAll(/^- \[[ xX]\]\s+(QA-[^:\s]+)\s*:/gm)].map((m) => m[1]));
    const dup = qaRows.filter((row) => existing.has(row.id)).map((row) => row.id);
    if (dup.length) throw new RecordFixError(`QA id(s) already exist in ${PATHS.qa}: ${dup.join(', ')}; refusing duplicate`);
    const rows = qaRows.map((row) => {
      let text = one(row.text);
      if (!/[.!?)。]$/.test(text)) text += '.';
      return `- [${row.done === false ? ' ' : 'x'}] ${row.id}: ${text} verify_by: ${one(row.verify_by)}`;
    });
    const lines = qa.text.split('\n');
    const { front } = splitFrontmatter(qa.text);
    const bodyStart = front ? front.split('\n').length - 1 : 0;
    const sectionIdx = lines.findIndex((line, i) => i >= bodyStart && line.startsWith(`## ${version} `));
    if (sectionIdx >= 0) {
      let end = lines.length;
      for (let i = sectionIdx + 1; i < lines.length; i += 1) if (lines[i].startsWith('## ')) { end = i; break; }
      let last = end - 1;
      while (last > sectionIdx && lines[last].trim() === '') last -= 1;
      lines.splice(last + 1, 0, ...rows);
      record(PATHS.qa, `${rows.join('\n')}\n  (appended to existing section "${lines[sectionIdx]}")\n`);
    } else {
      const firstH2 = lines.findIndex((line, i) => i >= bodyStart && line.startsWith('## '));
      const at = firstH2 >= 0 ? firstH2 : lines.length;
      const section = [`## ${version} ${one(entry.qa_section)} (${date})`, '', ...rows, ''];
      lines.splice(at, 0, ...section);
      record(PATHS.qa, `${section.join('\n')}\n`);
    }
    qa.text = touchLastVerified(lines.join('\n'), date);
    changed.set('qa', qa);
  }

  // CHANGELOG ---------------------------------------------------------------
  {
    const cl = need('changelog');
    const lines = cl.text.split('\n');
    const headIdx = lines.findIndex((line) => line.startsWith(`## ${version} (`));
    if (headIdx < 0) throw new RecordFixError(`${PATHS.changelog} has no "## ${version} (YYYY-MM-DD)" heading; run \`node scripts/bump-version.mjs ${version}\` first`);
    let end = lines.length;
    for (let i = headIdx + 1; i < lines.length; i += 1) if (lines[i].startsWith('## ')) { end = i; break; }
    const bullets = entry.changelog.map((item) => { const t = one(item); return t.startsWith('- ') ? t : `- ${t}`; });
    let placeholderIdx = -1;
    for (let i = headIdx + 1; i < end; i += 1) if (lines[i].trim() === CHANGELOG_PLACEHOLDER) { placeholderIdx = i; break; }
    if (placeholderIdx >= 0) lines.splice(placeholderIdx, 1, ...bullets);
    else {
      // A later record for the same version appends after earlier bullets, keeping any
      // "**Verification:**" summary and the bump's "R1" line last.
      let at = headIdx + 1;
      while (at < end && lines[at].startsWith('- ') && !/^- (\*\*Verification:\*\*|R1 )/.test(lines[at])) at += 1;
      lines.splice(at, 0, ...bullets);
    }
    cl.text = lines.join('\n');
    record(PATHS.changelog, `${bullets.join('\n')}\n  (${placeholderIdx >= 0 ? 'replaces bump-version placeholder' : 'inserted under heading; no placeholder found'})\n`);
    changed.set('changelog', cl);
  }

  // version.json ------------------------------------------------------------
  {
    const vj = need('versionJson');
    let parsed;
    try { parsed = JSON.parse(vj.text); } catch { throw new RecordFixError(`${PATHS.versionJson} is not valid JSON`); }
    if (parsed.version !== version) throw new RecordFixError(`${PATHS.versionJson} version is ${parsed.version}, expected ${version}; run \`node scripts/bump-version.mjs ${version}\` first`);
    const note = one(entry.note);
    parsed.note = note;
    const pretty = /\n\s+"/.test(vj.text);
    vj.text = JSON.stringify(parsed, null, pretty ? 2 : 0) + (vj.text.endsWith('\n') ? '\n' : '');
    record(PATHS.versionJson, `"note": ${JSON.stringify(note)}\n`);
    changed.set('versionJson', vj);
  }

  // EXECUTION-STATUS --------------------------------------------------------
  if (entry.status) {
    const st = need('status');
    const s = entry.status;
    const title = one(s.title);
    const suffix = title.includes(`(${version}`) ? '' : ` (${version}${nonEmpty(s.agent) ? `, ${one(s.agent)}` : ''})`;
    const block = [`### ${date} ${one(s.time)} ${title}${suffix}`, '', ...s.bullets.map((b) => { const t = one(b); return t.startsWith('- ') ? t : `- ${t}`; }), '', ''].join('\n');
    const match = /^### /m.exec(st.text);
    st.text = match ? st.text.slice(0, match.index) + block + st.text.slice(match.index) : `${st.text.replace(/\n*$/, '\n')}\n${block}`;
    record(PATHS.status, block);
    changed.set('status', st);
  }

  // assemble ----------------------------------------------------------------
  const leftovers = [...changed.values()].filter((doc) => /\{[PR]\}/.test(doc.text) && !/\{[PR]\}/.test(doc.original));
  if (leftovers.length) throw new RecordFixError(`unreplaced {P}/{R} placeholder in ${leftovers.map((d) => d.rel).join(', ')}`);
  const files = [...changed.values()]
    .map((doc) => ({ rel: doc.rel, path: doc.path, content: serialize(doc), unchanged: serialize(doc) === (doc.bom ? '﻿' : '') + doc.original, eol: doc.eol, mixed: doc.mixed }));
  return { pId, rId, maxP, maxR, files, inserts };
}

// ── atomic write ────────────────────────────────────────────────────────────
export function writeAtomically(files) {
  const todo = files.filter((f) => !f.unchanged);
  const originals = new Map();
  const tmps = [];
  try {
    for (const f of todo) {
      originals.set(f.path, readFileSync(f.path));
      const tmp = `${f.path}.tmp`;
      writeFileSync(tmp, f.content, 'utf8');
      tmps.push(tmp);
    }
  } catch (error) {
    for (const tmp of tmps) try { unlinkSync(tmp); } catch { /* best effort */ }
    throw new RecordFixError(`write phase failed before any rename; nothing changed: ${error.message}`);
  }
  const renamed = [];
  try {
    for (const f of todo) { renameSync(`${f.path}.tmp`, f.path); renamed.push(f); }
  } catch (error) {
    for (const f of renamed) try { writeFileSync(f.path, originals.get(f.path)); } catch { /* best effort */ }
    for (const tmp of tmps) try { unlinkSync(tmp); } catch { /* already renamed */ }
    throw new RecordFixError(`rename failed, rolled back: ${error.message}`);
  }
  return todo.map((f) => f.rel);
}

// ── CLI ─────────────────────────────────────────────────────────────────────
function main(argv) {
  const args = argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const rootIdx = args.indexOf('--root');
  const rootArg = rootIdx >= 0 ? args[rootIdx + 1] : null;
  if (rootIdx >= 0 && !rootArg) throw new RecordFixError('--root requires a directory');
  const positional = args.filter((a, i) => !a.startsWith('--') && !(rootIdx >= 0 && i === rootIdx + 1));
  if (positional.length !== 1) throw new RecordFixError('usage: node scripts/record-fix.mjs <entry.json> [--root DIR] [--dry-run]');
  const root = rootArg ? resolve(rootArg) : resolve(dirname(fileURLToPath(import.meta.url)), '..');
  let raw;
  try { raw = readFileSync(resolve(positional[0]), 'utf8').replace(/^﻿/, ''); } catch (error) { throw new RecordFixError(`cannot read ${positional[0]}: ${error.message}`); }
  let entry;
  try { entry = JSON.parse(raw); } catch (error) { throw new RecordFixError(`${positional[0]} is not valid JSON: ${error.message}`); }

  const result = computeRecord(root, entry);
  for (const f of result.files) if (f.mixed) console.warn(`[record-fix] warning: ${f.rel} has mixed line endings; wrote back using ${f.eol === '\r\n' ? 'CRLF' : 'LF'}`);
  console.log(`[record-fix] root: ${root}`);
  console.log(`[record-fix] allocated: ${result.pId}${result.rId ? `, ${result.rId}` : ''} (previous max P${result.maxP}${result.maxR != null ? `, R${result.maxR}` : ''})`);
  if (dryRun) {
    for (const ins of result.inserts) {
      console.log(`\n--- ${ins.rel}`);
      for (const line of ins.text.replace(/\n+$/, '').split('\n')) console.log(`+ ${line}`);
    }
    console.log('\n[record-fix] dry run: no files written.');
    return;
  }
  const written = writeAtomically(result.files);
  console.log(`[record-fix] wrote ${written.length} file(s): ${written.join(', ')}`);
  console.log('[record-fix] next: run `node scripts/generate-workspace-state.mjs --write` (or bump-version/the gates), then ci-ledger-integrity-check, ci-knowledge-lint-check, ci-version-check, ci-workspace-contract-check.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv); } catch (error) {
    if (error instanceof RecordFixError) {
      console.error('record-fix failed; no files changed:');
      for (const message of error.messages) console.error(` - ${message}`);
      process.exit(1);
    }
    throw error;
  }
}
