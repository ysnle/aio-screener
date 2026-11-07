#!/usr/bin/env node
// v59.74: copies drafted 쟁점과 이면 (debate, underTheHood) from a drafts folder into the company stories beside them in
// public-data/company-profiles/, after the same checks the contract runs, then the caller re-runs
// scripts/sync-company-profiles.mjs. A workspace tool: local files only, nothing fetched.
// Usage: node scripts/merge-company-debates.mjs [drafts-dir]   (default _artifacts/company-debate-20261107/drafts)
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { debateIssues } from '../src/domain/entity/company-debate.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const drafts = resolve(root, process.argv[2] || '_artifacts/company-debate-20261107/drafts');
const dir = join(root, 'public-data', 'company-profiles');
let merged = 0;
const failures = [];
for (const file of readdirSync(drafts).filter((name) => name.endsWith('.json')).sort()) {
  const target = join(dir, file);
  if (!existsSync(target)) { failures.push(`${file}: no story`); continue; }
  const draft = JSON.parse(readFileSync(join(drafts, file), 'utf8'));
  const raw = readFileSync(target, 'utf8');
  const story = JSON.parse(raw);
  // Each story keeps its own layout (indent and final newline) so a merge diff shows only the new fields.
  const indent = raw.match(/^\{\n( +)"/)?.[1].length || 2;
  const tail = raw.endsWith('\n') ? '\n' : '';
  if (draft.symbol !== story.symbol) { failures.push(`${file}: symbol ${draft.symbol}`); continue; }
  const issues = debateIssues(draft, new Set((story.sources || []).map((s) => s.id)));
  if (issues.length) { failures.push(`${file}: ${issues.join('; ')}`); continue; }
  // The two fields go in right before the top-level 'trading' key as text, so every other line of the hand-formatted
  // story stays byte-identical (re-serialising reflowed compact source rows). A re-merge replaces the earlier insert.
  let base = raw;
  if ('debate' in story || 'underTheHood' in story) {
    const { debate, underTheHood, ...rest } = story;
    base = `${JSON.stringify(rest, null, indent)}${tail}`;
  }
  const at = base.search(new RegExp(`\\n {${indent}}"trading": `));
  if (at < 0) { failures.push(`${file}: no top-level trading key`); continue; }
  const pad = ' '.repeat(indent);
  const field = (key, value) => `${pad}"${key}": ${JSON.stringify(value, null, indent).replace(/\n/g, `\n${pad}`)},`;
  writeFileSync(target, `${base.slice(0, at + 1)}${field('debate', draft.debate)}\n${field('underTheHood', draft.underTheHood)}\n${base.slice(at + 1)}`);
  merged += 1;
}
if (failures.length) console.error(`not merged (${failures.length}):\n- ${failures.join('\n- ')}`);
console.log(`merged 쟁점과 이면 into ${merged} stories`);
if (failures.length) process.exit(1);
