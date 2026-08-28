#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = JSON.parse(readFileSync(join(root, 'architecture', 'agent-profiles.json'), 'utf8'));
const checkOnly = process.argv.includes('--check');

const instructionBody = (profile) => {
  const reads = source.common.requiredReads.map((value) => `- \`${value}\``).join('\n');
  const boundaries = source.common.boundaries.map((value) => `- ${value}`).join('\n');
  const checks = profile.checks.map((value, index) => `${index + 1}. ${value}`).join('\n');
  return `# ${profile.purpose}\n\n## Required reads\n\n${reads}\n\n## Boundaries\n\n${boundaries}\n\n## Workflow\n\n${checks}\n\n## Report\n\nReturn PASS/WARN/FAIL, exact evidence commands, findings with file/line references, and separate blocked or unverified surfaces.\n`;
};

const markdown = (name, profile) => `---\nname: ${name}\ndescription: ${profile.description}\ntools:\n  - Read\n  - Grep\n  - Glob\n  - Bash\n---\n\n${instructionBody(profile)}`;
const tomlString = (value) => JSON.stringify(value);
const toml = (name, profile) => `name = ${tomlString(name)}\ndescription = ${tomlString(profile.description)}\ndeveloper_instructions = '''\n${instructionBody(profile).replace(/'''/g, "' ''")}'''\n`;

const errors = [];
for (const [name, profile] of Object.entries(source.profiles)) {
  const targets = [
    [join(root, '.claude', 'agents', `${name}.md`), markdown(name, profile)],
    [join(root, '.codex', 'agents', `${name}.toml`), toml(name, profile)]
  ];
  for (const [path, expected] of targets) {
    if (checkOnly) {
      let actual = '';
      try { actual = readFileSync(path, 'utf8'); } catch { errors.push(`missing generated agent profile: ${path}`); continue; }
      if (actual !== expected) errors.push(`stale generated agent profile: ${path}`);
    } else {
      writeFileSync(path, expected, 'utf8');
    }
  }
}

if (errors.length) {
  console.error('Agent profile synchronization failed:');
  errors.forEach((error) => console.error(` - ${error}`));
  console.error('Run: node scripts/sync-agent-profiles.mjs');
  process.exit(1);
}
console.log(`Agent profiles ${checkOnly ? 'verified' : 'generated'}: ${Object.keys(source.profiles).length} profile(s), Claude and Codex surfaces.`);
