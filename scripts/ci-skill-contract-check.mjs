#!/usr/bin/env node
// Skill contract and skill eval fixtures. v58.86 gate consolidation: the sections below were separate gates until v58.86. They check one subject, so one gate
// runs them in order; every section runs even when an earlier one fails, and the failure names the section.
import { runSections } from './lib/gate-sections.mjs';

await runSections('skill-contract', [
// ── section skill-contract (was ci-skill-contract-check.mjs) ──
['skill-contract', async () => {
const { existsSync, readdirSync, readFileSync } = await import('node:fs');
const { dirname, join, relative } = await import('node:path');
const { fileURLToPath } = await import('node:url');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const exists = (path) => existsSync(join(root, path));
const walk = (dir) => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
};

const errors = [];
const check = (label, condition, detail = '') => {
  if (!condition) errors.push(label + (detail ? ': ' + detail : ''));
};

const skills = [
  'autoresearch',
  'bug-fix',
  'data-refresh',
  'integrate',
  'knowledge-lint',
  'post-edit-qa',
  'create-verification-skill',
  'maintain-verification-skill',
  'verify-aio'
];
const commandForSkill = {
  autoresearch: 'autoresearch.md',
  'bug-fix': 'bug-fix.md',
  'data-refresh': 'data-refresh.md',
  integrate: 'integrate.md',
  'knowledge-lint': 'knowledge-lint.md',
  'post-edit-qa': 'qa.md',
  'create-verification-skill': 'create-verification-skill.md',
  'maintain-verification-skill': 'maintain-verification-skill.md',
  'verify-aio': 'verify-aio.md'
};
const referencesForSkill = {
  autoresearch: ['references/workflow.md', 'references/eval-guide.md'],
  'bug-fix': ['references/workflow.md'],
  'data-refresh': ['references/inventory.md', 'references/workflow.md', 'references/source-policy.md'],
  integrate: ['references/workflow.md', 'references/framework-extraction.md'],
  'knowledge-lint': ['references/workflow.md'],
  'post-edit-qa': ['references/tiers.md', 'references/report-contract.md', 'references/scope-matrix.md', 'references/design-review.md'],
  'create-verification-skill': ['references/feature-map-example/README.md'],
  'verify-aio': ['features/README.md', 'scripts/verify-aio.mjs']
};

check('skill directory is .claude/skills', exists('.claude/skills'));
check('shared operating contract exists', exists('.claude/skills/_shared/operating-contract.md'));
check('command directory exists', exists('.claude/commands'));
check('agent mirror sync script exists', exists('scripts/sync-agent-skills.mjs'));
check('generated current state exists', exists('_context/CURRENT-STATE.md'));
check('skill eval fixture exists', exists('architecture/skill-eval-cases.json'));
check('skill eval fixture gate exists', read('scripts/ci-skill-contract-check.mjs').includes("['skill-evals'"));

const sharedContract = read('.claude/skills/_shared/operating-contract.md');
check('shared contract links governance', sharedContract.includes('_context/WORKFLOW-GOVERNANCE.md'));
check('shared contract links index', sharedContract.includes('_context/INDEX.md'));
check('shared contract links generated state', sharedContract.includes('_context/CURRENT-STATE.md'));
check('shared contract owns R1 seven surfaces', /R1 as 7 synchronized surfaces/.test(sharedContract));
check('shared contract owns skill gates', sharedContract.includes('ci-skill-contract-check.mjs') && sharedContract.includes('ci-workflow-compaction-check.mjs'));

for (const skill of skills) {
  const skillPath = `.claude/skills/${skill}/SKILL.md`;
  check(`skill exists: ${skill}`, exists(skillPath));
  if (!exists(skillPath)) continue;

  const text = read(skillPath);
  const lineCount = text.split(/\r?\n/).length;
  const byteCount = Buffer.byteLength(text, 'utf8');
  check(`skill frontmatter name matches: ${skill}`, new RegExp(`^name:\\s*${skill}\\s*$`, 'm').test(text));
  check(`skill frontmatter description exists: ${skill}`, /^description:\s*.+$/m.test(text));
  check(`skill has AIO operating contract: ${skill}`, /AIO Skill Operating Contract/.test(text));
  check(`skill has no frozen contract version: ${skill}`, !/AIO Skill Operating Contract v\d/.test(text));
  check(`skill links shared contract: ${skill}`, /\.claude\/skills\/_shared\/operating-contract\.md/.test(text));
  check(`skill is a concise router: ${skill}`, lineCount <= 90, `${lineCount} lines`);
  check(`skill stays below compaction threshold: ${skill}`, byteCount <= 12000, `${byteCount} bytes`);
  check(`skill has reference loading map: ${skill}`, /Reference Loading Map/.test(text));

  for (const ref of referencesForSkill[skill] || []) {
    const refPath = `.claude/skills/${skill}/${ref}`;
    check(`skill reference exists: ${skill}/${ref}`, exists(refPath));
    check(`skill router points to reference: ${skill}/${ref}`, text.includes(ref));
  }
}

for (const [skill, command] of Object.entries(commandForSkill)) {
  const commandPath = `.claude/commands/${command}`;
  check(`command wrapper exists: ${command}`, exists(commandPath));
  if (!exists(commandPath)) continue;

  const text = read(commandPath);
  check(`command wrapper points to skill: ${command}`, text.includes(`.claude/skills/${skill}/SKILL.md`));
  check(`command wrapper has operating contract: ${command}`, /AIO Skill Operating Contract/.test(text));
  check(`command wrapper has no frozen contract version: ${command}`, !/AIO Skill Operating Contract v\d/.test(text));
  check(`command wrapper links shared contract: ${command}`, /\.claude\/skills\/_shared\/operating-contract\.md/.test(text));
}

const skillAndCommandFiles = [
  ...skills.map((skill) => `.claude/skills/${skill}/SKILL.md`),
  ...Object.values(commandForSkill).map((command) => `.claude/commands/${command}`)
];
for (const file of skillAndCommandFiles) {
  if (!exists(file)) continue;
  const text = read(file);
  check(`${file} must not use stale R1 six-surface wording`, !/(버전\s*6곳|6곳\s*동기화|version\s+6|R1\s+6)/i.test(text));
  check(`${file} must not treat .agents/skills as canonical`, !/(treat|use)\s+`?\.agents[\\/]+skills`?\s+as\s+(the\s+)?(active|canonical)/i.test(text));
}

const workflow = read('_context/WORKFLOW-GOVERNANCE.md');
const index = read('_context/INDEX.md');
check('workflow governance documents skill matrix', /AIO Skill Matrix/.test(workflow));
check('workflow governance points to .claude/skills', /\.claude\/skills/.test(workflow) || /\.claude\\skills/.test(workflow));
check('context index points to .claude/skills', /\.claude\/skills/.test(index) || /\.claude\\skills/.test(index));
check('workflow governance separates deterministic fixtures from behavioral runs', /fixture PASS is not behavioral-model PASS|fixture.*behavioral/i.test(workflow));
check('context index routes through generated current state', /CURRENT-STATE\.md/.test(index));

const evalCases = JSON.parse(read('architecture/skill-eval-cases.json'));
for (const skill of skills) {
  check(`skill has at least three stable eval task prompts: ${skill}`, Array.isArray(evalCases.skills?.[skill]) && evalCases.skills[skill].length >= 3);
}

const evalGuide = read('.claude/skills/autoresearch/references/eval-guide.md');
check('eval guide encoding sentinel is intact', /Eval Guide \(AIO 스킬용\)/.test(evalGuide));
check('eval guide contains no replacement characters', !evalGuide.includes('\uFFFD'));

const canonicalRoot = join(root, '.claude', 'skills');
const mirrorRoot = join(root, '.agents', 'skills');
if (existsSync(mirrorRoot)) {
  const canonicalFiles = walk(canonicalRoot);
  const mirrorFiles = walk(mirrorRoot);
  const canonicalRelative = canonicalFiles.map((path) => relative(canonicalRoot, path)).sort();
  const mirrorRelative = mirrorFiles.map((path) => relative(mirrorRoot, path)).sort();
  check('agent mirror file inventory matches canonical skills',
    JSON.stringify(mirrorRelative) === JSON.stringify(canonicalRelative),
    `${mirrorRelative.length} mirror vs ${canonicalRelative.length} canonical`);
  for (const rel of canonicalRelative) {
    const mirrorPath = join(mirrorRoot, rel);
    if (!existsSync(mirrorPath)) continue;
    check(`agent mirror content matches: ${rel}`,
      readFileSync(join(canonicalRoot, rel)).equals(readFileSync(mirrorPath)));
  }
}

const skillDirs = readdirSync(join(root, '.claude', 'skills'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
for (const skill of skills) {
  check(`tracked skill directory listed: ${skill}`, skillDirs.includes(skill));
}

if (errors.length) {
  console.error('Skill contract check failed:');
  errors.forEach((error) => console.error(' - ' + error));
  process.exit(1);
}

console.log(`Skill contract check OK: ${skills.length} skill(s), ${Object.keys(commandForSkill).length} command wrapper(s).`);
}],
// ── section skill-evals (was ci-skill-eval-fixture-check.mjs) ──
['skill-evals', async () => {
const { existsSync, readFileSync, readdirSync } = await import('node:fs');
const { dirname, join } = await import('node:path');
const { fileURLToPath } = await import('node:url');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = join(root, 'architecture', 'skill-eval-cases.json');
const errors = [];
if (!existsSync(path)) errors.push('architecture/skill-eval-cases.json is missing');
const data = errors.length ? null : JSON.parse(readFileSync(path, 'utf8'));
if (data) {
  if (!/do not by themselves prove model output quality/i.test(data.boundary || '')) errors.push('fixture boundary must reject behavioral overclaim');
  const minimum = Number(data.minimumCasesPerSkill || 0);
  if (minimum < 3) errors.push('minimumCasesPerSkill must be at least 3');
  for (const [skill, cases] of Object.entries(data.skills || {})) {
    if (!Array.isArray(cases) || cases.length < minimum) errors.push(`${skill} has fewer than ${minimum} cases`);
    for (const [index, item] of (cases || []).entries()) {
      if (!item.prompt || !Array.isArray(item.mustInclude) || item.mustInclude.length < 3) errors.push(`${skill}[${index}] lacks prompt or observable mustInclude evidence`);
      if (!Array.isArray(item.mustNotClaim) || item.mustNotClaim.length < 1) errors.push(`${skill}[${index}] lacks a negative-control claim`);
    }
  }
  // v57.92 (internal review G08): the required list was a frozen six of nine skills, so deleting the
  // verify/create/maintain fixtures still passed. Every skill directory with a SKILL.md now needs cases.
  const skillsDir = join(root, '.claude', 'skills');
  const canonicalSkills = readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_') && existsSync(join(skillsDir, entry.name, 'SKILL.md')))
    .map((entry) => entry.name);
  if (canonicalSkills.length < 9) errors.push(`expected at least 9 canonical skills under .claude/skills, found ${canonicalSkills.length}`);
  for (const skill of canonicalSkills) if (!data.skills?.[skill]) errors.push(`missing eval cases for ${skill}`);
}
if (errors.length) {
  console.error('Skill eval fixture check failed:');
  errors.forEach((error) => console.error(` - ${error}`));
  process.exit(1);
}
const caseCount = Object.values(data.skills).reduce((sum, cases) => sum + cases.length, 0);
console.log(`Skill eval fixtures OK: ${Object.keys(data.skills).length} skills, ${caseCount} cases; behavioral execution remains a separate evidence level.`);
}],
]);
