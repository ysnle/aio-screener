import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
