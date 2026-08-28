import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  'post-edit-qa'
];
const commandForSkill = {
  autoresearch: 'autoresearch.md',
  'bug-fix': 'bug-fix.md',
  'data-refresh': 'data-refresh.md',
  integrate: 'integrate.md',
  'knowledge-lint': 'knowledge-lint.md',
  'post-edit-qa': 'qa.md'
};
const referencesForSkill = {
  autoresearch: ['references/workflow.md', 'references/eval-guide.md'],
  'bug-fix': ['references/workflow.md'],
  'data-refresh': ['references/inventory.md', 'references/workflow.md', 'references/source-policy.md'],
  integrate: ['references/workflow.md', 'references/framework-extraction.md'],
  'knowledge-lint': ['references/workflow.md'],
  'post-edit-qa': ['references/tiers.md', 'references/report-contract.md', 'references/scope-matrix.md']
};

check('skill directory is .claude/skills', exists('.claude/skills'));
check('shared operating contract exists', exists('.claude/skills/_shared/operating-contract.md'));
check('command directory exists', exists('.claude/commands'));
check('agent mirror sync script exists', exists('scripts/sync-agent-skills.mjs'));
check('generated current state exists', exists('_context/CURRENT-STATE.md'));
check('skill eval fixture exists', exists('architecture/skill-eval-cases.json'));
check('skill eval fixture gate exists', exists('scripts/ci-skill-eval-fixture-check.mjs'));

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
  check(`skill links workflow governance: ${skill}`, /_context\/WORKFLOW-GOVERNANCE\.md/.test(text));
  check(`skill links context index: ${skill}`, /_context\/INDEX\.md/.test(text));
  check(`skill links generated current state: ${skill}`, /_context\/CURRENT-STATE\.md/.test(text));
  check(`skill links shared contract: ${skill}`, /\.claude\/skills\/_shared\/operating-contract\.md/.test(text));
  check(`skill uses R1 7-surface wording: ${skill}`, /R1 7/.test(text) || /7 surfaces/.test(text));
  check(`skill mentions skill contract gate: ${skill}`, /ci-skill-contract-check\.mjs/.test(text));
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
