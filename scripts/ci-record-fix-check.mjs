#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// scripts/ci-record-fix-check.mjs — gate for scripts/record-fix.mjs (QA-OPS-REC-*)
//
// Copies the real ledgers/CHANGELOG/version.json/EXECUTION-STATUS/rule-gap-manifest
// into an os.tmpdir() root, runs record-fix on fixture entries there and asserts
// the result parses under the same regexes the ledger gates use. The real files
// are hashed before/after and must stay byte-identical.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tool = join(repo, 'scripts', 'record-fix.mjs');
const FILES = [
  '_context/BUG-POSTMORTEM.md',
  '_context/RULES.md',
  '_context/QA-CHECKLIST.md',
  '_context/rule-gap-manifest.json',
  '_context/open-item-baseline.json',
  'CHANGELOG.md',
  'version.json',
  '_artifacts/full-audit-20260927/EXECUTION-STATUS.md',
];
const LEDGER_GATE = 'scripts/ci-ledger-integrity-check.mjs';

const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const hashReal = () => Object.fromEntries([...FILES, LEDGER_GATE, 'scripts/record-fix.mjs'].filter((f) => existsSync(join(repo, f))).map((f) => [f, sha(readFileSync(join(repo, f)))]));
const realBefore = hashReal();

let checks = 0;
const failures = [];
const check = (label, ok, detail = '') => { checks += 1; if (!ok) failures.push(detail ? `${label}: ${detail}` : label); };

const tmpRoots = [];
function makeRoot({ crlf = false, mutate } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'aio-record-fix-'));
  tmpRoots.push(dir);
  for (const rel of [...FILES, LEDGER_GATE]) {
    const src = join(repo, rel);
    if (!existsSync(src)) continue;
    const dst = join(dir, rel);
    mkdirSync(dirname(dst), { recursive: true });
    cpSync(src, dst);
  }
  // Emulate `bump-version.mjs vTEST`: version.json + CHANGELOG heading with the placeholder (same shape as bump-version.mjs).
  const vj = JSON.parse(readFileSync(join(dir, 'version.json'), 'utf8'));
  vj.version = 'v99.1';
  writeFileSync(join(dir, 'version.json'), `${JSON.stringify(vj)}\n`);
  const cl = readFileSync(join(dir, 'CHANGELOG.md'), 'utf8');
  writeFileSync(join(dir, 'CHANGELOG.md'), `## v99.1 (2026-10-01)\n- <!-- 변경 내용을 이곳에 기록하세요 -->\n- R1 7곳 v99.1\n\n${cl}`);
  if (mutate) mutate(dir);
  if (crlf) {
    for (const rel of FILES) {
      const p = join(dir, rel);
      writeFileSync(p, readFileSync(p, 'utf8').replace(/\r?\n/g, '\r\n'));
    }
  }
  return dir;
}
const snapshot = (dir) => Object.fromEntries(FILES.map((f) => [f, sha(readFileSync(join(dir, f)))]));
const read = (dir, rel) => readFileSync(join(dir, rel), 'utf8');
const lf = (text) => text.replace(/\r\n/g, '\n');

const baseEntry = () => ({
  version: 'v99.1',
  date: '2026-10-01',
  p: {
    title: 'fixture defect for the record-fix gate',
    symptom: 'Fixture symptom mentioning {P}.',
    root_cause: 'Fixture root cause.',
    fix: 'Fixture fix.',
    violated_rule: '{R} — fixture rule was violated.',
    prevention: 'QA-OPS-REC-99 — {P}/{R} record-fix gate.',
    verification: 'Fixture verification.',
  },
  r: { title: 'Fixture rule title', rule: 'Fixture rule body for {R}.', validation: 'Fixture validation for {P}.' },
  qa: [
    { id: 'QA-OPS-REC-98', text: 'Fixture done row', verify_by: '{P}/{R} ci-record-fix-check.mjs', done: true },
    { id: 'QA-OPS-REC-99', text: 'Fixture open row.', verify_by: 'next refresh', done: false },
  ],
  qa_section: 'record-fix fixture',
  changelog: ['**Fixture lead ({P}/{R}/QA-OPS-REC-98):** fixture text.', '**Second bullet:** more text.'],
  note: 'v99.1 — fixture note ({P}/{R}).',
  status: { time: '10:40 KST', title: 'record-fix fixture', bullets: ['Fixture bullet for {P}.'] },
});

function run(dir, entry, extra = []) {
  const entryPath = join(dir, 'entry.fixture.json');
  writeFileSync(entryPath, JSON.stringify(entry));
  const result = spawnSync(process.execPath, [tool, entryPath, '--root', dir, ...extra], { encoding: 'utf8' });
  return { code: result.status, out: result.stdout || '', err: result.stderr || '' };
}

try {
  // Expected ids come from the real files, using the same parsers the workspace gates use.
  const realPm = readFileSync(join(repo, FILES[0]), 'utf8');
  const realRules = readFileSync(join(repo, FILES[1]), 'utf8');
  const maxP = Math.max(...[...realPm.matchAll(/^##\s+P(\d+)\b/gm)].map((m) => Number(m[1])));
  const definedR = [...realRules.matchAll(/^## R(\d+)\./gm)].map((m) => Number(m[1]));
  const maxR = Math.max(...definedR);
  const topRHeading = /^## R\d+\..*$/m.exec(realRules)[0];
  const P = `P${maxP + 1}`;
  const R = `R${maxR + 1}`;

  // ── happy path (LF) ───────────────────────────────────────────────────────
  const dir = makeRoot();
  const before = snapshot(dir);
  const res = run(dir, baseEntry());
  check('record-fix succeeds on a fixture entry (QA-OPS-REC-01)', res.code === 0, res.err || res.out);
  const pm = read(dir, FILES[0]);
  const rules = read(dir, FILES[1]);
  const qa = read(dir, FILES[2]);
  const cl = read(dir, 'CHANGELOG.md');
  const vj = read(dir, 'version.json');
  const st = read(dir, FILES[7]);

  const newPHeads = [...pm.matchAll(/^##\s+P(\d+)\b/gm)].map((m) => Number(m[1]));
  check('P id allocated = max existing P + 1 and is the newest heading (QA-OPS-REC-01)', newPHeads[0] === maxP + 1 && Math.max(...newPHeads) === maxP + 1, `got ${newPHeads[0]}, expected ${maxP + 1}`);
  const newRHeads = [...rules.matchAll(/^## R(\d+)\./gm)].map((m) => Number(m[1]));
  check('R id allocated = max existing R + 1 and inserted above the previous top-most R (QA-OPS-REC-01)', newRHeads[0] === maxR + 1 && newRHeads[1] === Number(/^## R(\d+)\./.exec(topRHeading)[1]), `got ${newRHeads.slice(0, 2)}`);

  const pBlock = pm.slice(pm.indexOf(`## ${P} `));
  check('P entry heading matches `## P<n> - <version> - <title> (<date>)` (QA-OPS-REC-02)', new RegExp(`^## ${P} - v99\\.1 - fixture defect for the record-fix gate \\(2026-10-01\\)$`, 'm').test(pm));
  const pOrder = ['symptom/reproduction', 'root_cause', 'fix', 'violated_rule', 'prevention', 'verification/residual'];
  const pLines = pBlock.split('\n').slice(0, 10);
  check('P entry has a blank line then the six ordered bullets and a trailing blank (QA-OPS-REC-02)', pLines[1] === '' && pOrder.every((key, i) => pLines[2 + i].startsWith(`- ${key}: `)) && pLines[8] === '' && pBlock.split('\n')[9].startsWith('## P'), JSON.stringify(pLines));
  check('duplicate-P-heading lint regex sees no duplicate headings (QA-OPS-REC-02)', (() => {
    const heads = [...pm.matchAll(/^##\s+(P\d+\s+-[^\r\n]+)$/gm)].map((m) => m[1]);
    return new Set(heads).size === heads.length;
  })());

  check('R heading matches `## R<n>. <title> (<version>, <P>)` with Rule/Validation paragraphs (QA-OPS-REC-03)', new RegExp(`^## ${R}\\. Fixture rule title \\(v99\\.1, ${P}\\)\\n\\n\\*\\*Rule\\*\\*: Fixture rule body for ${R}\\.\\n\\n\\*\\*Validation\\*\\*: Fixture validation for ${P}\\.\\n\\n## R`, 'm').test(rules));
  check('R heading parses with the ledger-integrity regex and adds no gap outside the manifest (QA-OPS-REC-03)', (() => {
    const defined = new Set([...rules.matchAll(/^## R(\d+)\./gm)].map((m) => Number(m[1])));
    const frozen = new Set(JSON.parse(read(dir, FILES[3])).absentR);
    for (let n = 1; n <= Math.max(...defined); n += 1) if (!defined.has(n) && !frozen.has(n)) return false;
    return true;
  })());

  const qaBody = qa.replace(/^---\n[\s\S]*?\n---\n/, '');
  const qaLines = qaBody.split('\n');
  check('QA section is created at the top of the QA body with `## <version> <section> (<date>)` (QA-OPS-REC-04)', /^\n## v99\.1 record-fix fixture \(2026-10-01\)$/m.test(qaBody.slice(0, 80)) || qaLines.find((l) => l.startsWith('## ')) === '## v99.1 record-fix fixture (2026-10-01)');
  check('QA rows use `- [x]/[ ] QA-…: text verify_by: …` and satisfy the open-item verify_by rule (QA-OPS-REC-04)',
    qa.includes(`- [x] QA-OPS-REC-98: Fixture done row. verify_by: ${P}/${R} ci-record-fix-check.mjs\n`)
    && qa.includes('- [ ] QA-OPS-REC-99: Fixture open row. verify_by: next refresh\n'));
  check('QA row lint regex finds no duplicate rows (QA-OPS-REC-04)', (() => {
    const rows = qa.split('\n').map((l) => l.trim()).filter((l) => /^- \[[ x]\]\s+QA-[^:]+:/.test(l));
    return new Set(rows).size === rows.length;
  })());
  check('{P}/{R} placeholders are substituted everywhere (QA-OPS-REC-05)', ![pm, rules, qa, cl, vj, st].some((t) => /\{[PR]\}/.test(t)));
  check('substituted ids appear in violated_rule, prevention, changelog and status (QA-OPS-REC-05)', pm.includes(`- violated_rule: ${R} — fixture rule was violated.`) && pm.includes(`QA-OPS-REC-99 — ${P}/${R} record-fix gate.`) && cl.includes(`**Fixture lead (${P}/${R}/QA-OPS-REC-98):**`) && st.includes(`Fixture bullet for ${P}.`));

  check('CHANGELOG placeholder replaced by bullets under the version heading; following bump-version line kept (QA-OPS-REC-06)', cl.startsWith(`## v99.1 (2026-10-01)\n- **Fixture lead (${P}/${R}/QA-OPS-REC-98):** fixture text.\n- **Second bullet:** more text.\n- R1 7곳 v99.1\n\n`) && !cl.includes('변경 내용을 이곳에 기록하세요\n- R1 7곳 v99.1'));
  const vjObj = JSON.parse(vj);
  check('version.json note updated, version/built preserved, still valid one-line JSON (QA-OPS-REC-07)', vjObj.note === `v99.1 — fixture note (${P}/${R}).` && vjObj.version === 'v99.1' && typeof vjObj.built === 'string' && vj.endsWith('}\n') && !vj.slice(0, -1).includes('\n'));
  check('EXECUTION-STATUS entry is prepended with `### <date> <time> <title> (<version>)` before older entries (QA-OPS-REC-08)', new RegExp(`^# [^\\n]+\\n\\n### 2026-10-01 10:40 KST record-fix fixture \\(v99\\.1\\)\\n\\n- Fixture bullet for ${P}\\.\\n\\n### `).test(st));

  const frontOf = (t) => (/^---\n[\s\S]*?\n---\n/.exec(t) || [''])[0];
  const stripLv = (f) => f.replace(/^last_verified:.*$/m, '');
  check('frontmatter is untouched except `last_verified` (no counters written) (QA-OPS-REC-09)', [[FILES[0], pm], [FILES[1], rules], [FILES[2], qa]].every(([rel, text]) => {
    const beforeFront = frontOf(before[rel] && readFileSync(join(repo, rel), 'utf8'));
    return stripLv(frontOf(text)) === stripLv(beforeFront) && (!/^last_verified:/m.test(beforeFront) || /^last_verified: (2026-10-01|20\d\d-\d\d-\d\d)$/m.test(frontOf(text)));
  }));
  check('P1421/QA-OPS-REC-09 last_verified advances to the entry date without rewinding later verification', [[FILES[1], rules], [FILES[2], qa]].every(([rel, text]) => {
    const prior = /^last_verified:\s*(\d{4}-\d{2}-\d{2})$/m.exec(frontOf(lf(readFileSync(join(repo, rel), 'utf8'))))?.[1];
    const expected = prior && prior > '2026-10-01' ? prior : '2026-10-01';
    return /^last_verified:\s*(\d{4}-\d{2}-\d{2})$/m.exec(frontOf(lf(text)))?.[1] === expected;
  }));
  check('no .tmp files are left behind (QA-OPS-REC-10)', (() => {
    const leftovers = [];
    const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { if (e.isDirectory()) walk(join(d, e.name)); else if (e.name.endsWith('.tmp')) leftovers.push(e.name); } };
    walk(dir);
    return leftovers.length === 0;
  })());

  // The real ledger gate, copied next to the temp ledgers (it resolves its root from its own location).
  const gate = spawnSync(process.execPath, [join(dir, LEDGER_GATE)], { encoding: 'utf8' });
  check('ci-ledger-integrity-check passes against the recorded temp root (QA-OPS-REC-11)', gate.status === 0, `${gate.stdout}${gate.stderr}`);

  // Re-implemented knowledge-lint duplicate assertions.
  const ruleIds = [...rules.matchAll(/^##\s+(R\d+)\./gm)].map((m) => m[1]);
  const dupRules = ruleIds.filter((id, i) => ruleIds.indexOf(id) !== i && !/^R(?:230|301)$/.test(id));
  check('knowledge-lint duplicate rule-id assertion holds after recording (QA-OPS-REC-11)', dupRules.length === 0, dupRules.join(','));
  check('workspace-state max-heading parsers see the new ids (QA-OPS-REC-11)', Math.max(...[...pm.matchAll(/^##\s+P(\d+)\b/gm)].map((m) => Number(m[1]))) === maxP + 1 && Math.max(...[...rules.matchAll(/^##\s+R(\d+)\b/gm)].map((m) => Number(m[1]))) === maxR + 1);

  // ── dry-run ───────────────────────────────────────────────────────────────
  {
    const d = makeRoot();
    const snap = snapshot(d);
    const r = run(d, baseEntry(), ['--dry-run']);
    check('--dry-run exits 0, prints the inserts and writes nothing (QA-OPS-REC-12)', r.code === 0 && r.out.includes(`+ ## ${P} - v99.1`) && JSON.stringify(snapshot(d)) === JSON.stringify(snap), r.err);
  }

  // ── rejections leave every file unchanged ─────────────────────────────────
  const rejected = (label, mutateEntry, expectText, opts) => {
    const d = makeRoot(opts);
    const entry = baseEntry();
    mutateEntry(entry, d);
    const snap = snapshot(d);
    const r = run(d, entry);
    check(`${label}: nonzero exit (QA-OPS-REC-13)`, r.code !== 0, `exit ${r.code}`);
    check(`${label}: message names the problem (QA-OPS-REC-13)`, expectText.test(r.err), r.err);
    check(`${label}: no ledger file changed (QA-OPS-REC-13)`, JSON.stringify(snapshot(d)) === JSON.stringify(snap));
  };
  rejected('duplicate QA id', (e, d) => { const existing = /^- \[[ x]\] (QA-[^:]+):/m.exec(read(d, FILES[2]))[1]; e.qa[0].id = existing; }, /already exist/);
  // P1347: an explicit update closes one existing item, without creating duplicates.
  {
    const d = makeRoot();
    const id = /^- \[[ x]\] (QA-[^:]+):/m.exec(read(d, FILES[2]))[1];
    const entry = baseEntry();
    entry.qa = [{ id, update: true, text: 'Verified existing fixture', verify_by: 'P1347 ci-record-fix-check.mjs', done: true }];
    const result = run(d, entry);
    const rows = read(d, FILES[2]).split('\n').filter((line) => line.includes(` ${id}:`));
    check('P1347 explicit QA update changes exactly one existing row', result.code === 0 && rows.length === 1 && rows[0].startsWith(`- [x] ${id}: Verified existing fixture.`), result.err);
  }
  rejected('P1347 missing update target', (e) => { e.qa[0].id = 'QA-NONEXISTENT-999'; e.qa[0].update = true; }, /exactly one existing row/);
  rejected('P1347 ambiguous update target', (e, d) => {
    const row = /^- \[[ x]\] (QA-[^:]+):.*$/m.exec(read(d, FILES[2]));
    e.qa[0].id = row[1]; e.qa[0].update = true;
    writeFileSync(join(d, FILES[2]), `${read(d, FILES[2])}\n${row[0]}\n`);
  }, /exactly one existing row/);
  rejected('missing verify_by', (e) => { delete e.qa[1].verify_by; }, /verify_by is required/);
  rejected('missing version heading in CHANGELOG', (e) => { e.version = 'v99.2'; }, /bump-version/);
  rejected('version.json not bumped', (e, d) => { writeFileSync(join(d, 'version.json'), '{"version":"v98.0","built":"x","note":"y"}\n'); }, /bump-version/);
  rejected('duplicate forced P id', (e) => { e.p.id = maxP; }, /P\d+ already exists/);
  rejected('R id that skips numbers outside the gap manifest', (e) => { e.r.id = maxR + 5; }, /gap/);
  rejected('forced duplicate R id', (e) => { e.r.id = maxR; }, /R\d+ already exists/);
  rejected('{R} used while r is null', (e) => { e.r = null; }, /\{R\}/);
  rejected('control character in text', (e) => { e.p.fix = 'bad \u0080 char'; }, /control/);
  rejected('missing p field', (e) => { delete e.p.root_cause; }, /p\.root_cause/);

  // ── r:null, no status, no placeholder, existing QA section ────────────────
  {
    const d = makeRoot({ mutate: (root) => {
      const cl2 = read(root, 'CHANGELOG.md').replace('- <!-- 변경 내용을 이곳에 기록하세요 -->\n', '');
      writeFileSync(join(root, 'CHANGELOG.md'), cl2);
    } });
    const e = baseEntry();
    e.r = null; e.status = null;
    e.p.violated_rule = 'No new rule.'; e.p.prevention = 'None {P}.'; e.qa = e.qa.map((row) => ({ ...row, verify_by: 'gate {P}' }));
    e.changelog = ['**No rule ({P}):** text.'];
    e.note = 'v99.1 — note.';
    const before2 = read(d, FILES[1]);
    const first = run(d, e);
    check('r:null / status:null entry records without touching RULES or EXECUTION-STATUS (QA-OPS-REC-14)', first.code === 0 && read(d, FILES[1]) === before2, first.err);
    check('with no placeholder, bullets go right under the version heading (QA-OPS-REC-14)', read(d, 'CHANGELOG.md').startsWith(`## v99.1 (2026-10-01)\n- **No rule (${P}):** text.\n- R1 7곳 v99.1\n`));
    const e2 = baseEntry();
    e2.p.title = 'second fixture'; e2.r = null; e2.status = null; e2.p.violated_rule = 'x'; e2.p.prevention = 'y';
    e2.qa = [{ id: 'QA-OPS-REC-97', text: 'second row', verify_by: 'gate' }];
    e2.changelog = ['second']; e2.note = 'n';
    const second = run(d, e2);
    const qa2 = read(d, FILES[2]);
    check('a second entry for the same version appends to the existing QA section and gets the next P (QA-OPS-REC-14)', second.code === 0 && (qa2.match(/^## v99\.1 /gm) || []).length === 1 && qa2.indexOf('QA-OPS-REC-97') > qa2.indexOf('QA-OPS-REC-99') && qa2.indexOf('QA-OPS-REC-97') < qa2.indexOf('## v56.79') && read(d, FILES[0]).includes(`## P${maxP + 2} - v99.1 - second fixture`), second.err);
  }

  // ── independence from postmortem frontmatter fields ───────────────────────
  {
    const d = makeRoot({ mutate: (root) => {
      const p = join(root, FILES[0]);
      writeFileSync(p, readFileSync(p, 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '---\nconfidence: medium\n---\n'));
    } });
    const r = run(d, baseEntry());
    const pm3 = read(d, FILES[0]);
    check('works when BUG-POSTMORTEM frontmatter lacks every counter field and does not add them (QA-OPS-REC-15)', r.code === 0 && pm3.startsWith('---\nconfidence: medium\n---\n') && !/latest_P_number|next_P_number|current_total_entries|current_checkpoint|latest_version/.test(pm3.split('\n## P')[0]), r.err);
  }

  // ── CRLF preservation ─────────────────────────────────────────────────────
  {
    const d = makeRoot({ crlf: true });
    const r = run(d, baseEntry());
    const allCrlf = FILES.every((rel) => { const t = read(d, rel); return !/(?<!\r)\n/.test(t); });
    check('CRLF files stay CRLF (no bare LF) after recording (QA-OPS-REC-16)', r.code === 0 && allCrlf, r.err);
    const lfRoot = makeRoot();
    run(lfRoot, baseEntry());
    check('CRLF result equals the LF result once normalised (QA-OPS-REC-16)', FILES.filter((f) => f !== FILES[4] && f !== FILES[3]).every((rel) => lf(read(d, rel)) === lf(read(lfRoot, rel))));
    const gate2 = spawnSync(process.execPath, [join(d, LEDGER_GATE)], { encoding: 'utf8' });
    check('ci-ledger-integrity-check passes on the CRLF temp root (QA-OPS-REC-16)', gate2.status === 0, `${gate2.stdout}${gate2.stderr}`);
  }
  // BOM + mixed-file handling: BOM preserved.
  {
    const d = makeRoot({ mutate: (root) => { const p = join(root, 'CHANGELOG.md'); writeFileSync(p, `﻿${readFileSync(p, 'utf8')}`); } });
    const r = run(d, baseEntry());
    check('a UTF-8 BOM on a ledger file is preserved (QA-OPS-REC-16)', r.code === 0 && readFileSync(join(d, 'CHANGELOG.md')).slice(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), r.err);
  }
} finally {
  for (const dir of tmpRoots) rmSync(dir, { recursive: true, force: true });
}

const realAfter = hashReal();
check('real ledgers, CHANGELOG, version.json and EXECUTION-STATUS are byte-identical before and after the run (QA-OPS-REC-17)', JSON.stringify(realBefore) === JSON.stringify(realAfter));

if (failures.length) {
  console.error('Record-fix check failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`Record-fix check OK: ${checks} checks`);
