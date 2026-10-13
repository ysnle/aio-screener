import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const worktreeRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(worktreeRoot, path), 'utf8');
const exists = (path) => existsSync(join(worktreeRoot, path));

const errors = [];
const warnings = [];
const check = (label, condition, detail = '') => {
  if (!condition) errors.push(label + (detail ? ': ' + detail : ''));
};

const version = JSON.parse(read('version.json')).version;
// v57.54: RULES.md is read for its "## R<n>." headings only (ledger structure). The prose markers this
// gate and its siblings used to grep ("R220 ... Workflow memory must be compacted", "P514-Q1", "v50.89
// workflow compaction") moved to architecture/governance-markers.json, so compressing a ledger no longer
// breaks CI. What must not silently disappear is the enforcing gate, and that is what is checked below.
const rules = read('_context/RULES.md');
const index = read('_context/INDEX.md');
const governanceMarkers = JSON.parse(read('architecture/governance-markers.json'));
const qaPipeline = JSON.parse(read('architecture/qa-pipeline.json'));
const contextCatalog = JSON.parse(read('_context/CONTEXT-CATALOG.json'));

function findProjectRoot(start) {
  let dir = resolve(start);
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(dir, '.claude', 'skills'))) return dir;
    const next = dirname(dir);
    if (next === dir) break;
    dir = next;
  }
  return null;
}

function walkFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

const contextFiles = walkFiles(join(worktreeRoot, '_context')).filter((file) => file.endsWith('.md'));
const contextStats = contextFiles.map((file) => ({
  name: basename(file),
  bytes: statSync(file).size,
  lines: readFileSync(file, 'utf8').split(/\r?\n/).length
})).sort((a, b) => b.bytes - a.bytes);

const projectRoot = findProjectRoot(worktreeRoot);
const skillFiles = projectRoot
  ? walkFiles(join(projectRoot, '.claude', 'skills')).filter((file) => basename(file) === 'SKILL.md')
  : [];
const skillStats = skillFiles.map((file) => ({
  name: file.replace(projectRoot + '\\', '').replace(projectRoot + '/', ''),
  bytes: statSync(file).size,
  lines: readFileSync(file, 'utf8').split(/\r?\n/).length,
  hasReferences: existsSync(join(dirname(file), 'references')),
  hasScripts: existsSync(join(dirname(file), 'scripts'))
})).sort((a, b) => b.bytes - a.bytes);

const governedLargeContextNames = new Set([
  'BUG-POSTMORTEM.md',
  'RULES.md',
  'QA-CHECKLIST.md',
  'KNOWLEDGE-BASE.md'
]);
const defaultLoadedNames = new Set(contextCatalog.documents.filter((doc) => doc.readPolicy === 'required').map((doc) => basename(doc.path)));
const oversizedContext = contextStats.filter((item) => item.bytes > 100_000 && defaultLoadedNames.has(item.name));
const governedLargeContext = contextStats.filter((item) => item.bytes > 100_000 && governedLargeContextNames.has(item.name));
const oversizedSkills = skillStats.filter((item) => item.lines > 300 || item.bytes > 15_000);
const preflightBytes = ['AGENTS.md', '_context/CURRENT-STATE.md']
  .reduce((sum, path) => sum + statSync(join(worktreeRoot, path)).size, 0);

// v57.54 governance markers: each policy keeps its ledger trace (rule/postmortem/QA ids) in JSON, and
// the check is on what enforces it — the gate scripts exist and run in a qa-pipeline group.
const wiredGateScripts = new Set(Object.values(qaPipeline.groups || {}).flatMap((group) => (group.gates || []).map((gate) => gate.script)));
const ruleHeadings = new Set([...rules.matchAll(/^## (R\d+)\./gm)].map((match) => match[1]));
const markerPolicies = Array.isArray(governanceMarkers.policies) ? governanceMarkers.policies : [];
const requiredMarkerPolicies = ['semantic-review', 'workflow-compaction', 'data-pipeline-contract', 'default-path-ux', 'generated-current-state', 'hook-authority'];
check('v57.54 governance-markers.json keeps every migrated policy', requiredMarkerPolicies.every((id) => markerPolicies.some((policy) => policy.id === id)), requiredMarkerPolicies.filter((id) => !markerPolicies.some((policy) => policy.id === id)).join(', '));
for (const policy of markerPolicies) {
  const enforcers = Array.isArray(policy.enforcedBy) ? policy.enforcedBy : [];
  const unwired = enforcers.filter((script) => !exists(script) || !wiredGateScripts.has(script));
  check(`v57.54 governance marker ${policy.id} is enforced by existing, qa-pipeline-wired gates`, enforcers.length > 0 && unwired.length === 0, unwired.join(', ') || 'enforcedBy is empty');
  const missingRules = (policy.rules || []).filter((id) => !ruleHeadings.has(id));
  check(`v57.54 governance marker ${policy.id} rule ids are RULES.md headings`, missingRules.length === 0, missingRules.join(', '));
}
check('context index acknowledges compaction policy', /Workflow Compaction|Context lifecycle/.test(index));
check('generated state and catalog define progressive disclosure', exists('_context/CURRENT-STATE.md') && /Read Policy/.test(read('_context/CURRENT-STATE.md')) && /explicit-only/.test(read('_context/INDEX.md')));
check('default preflight remains under 64 KiB', preflightBytes <= 65_536, `${preflightBytes} bytes`);
check('semantic gate remains present', exists('scripts/ci-semantic-review-check.mjs') && wiredGateScripts.has('scripts/ci-semantic-review-check.mjs'));
check('governed large context files are routed through INDEX and gates', governedLargeContext.every((item) => index.includes('`' + item.name + '`')) && wiredGateScripts.has('scripts/ci-workflow-compaction-check.mjs') && /Postmortem-To-Gate Rule/.test(read('_context/WORKFLOW-GOVERNANCE.md')));

if (oversizedContext.length) {
  warnings.push('Oversized context files: ' + oversizedContext.map((item) => `${item.name}:${item.bytes}`).join(', '));
}
if (oversizedSkills.length) {
  warnings.push('Oversized skills: ' + oversizedSkills.map((item) => `${item.name}:${item.lines}l`).join(', '));
}
if (!projectRoot) warnings.push('No project-level .claude/skills directory found from worktree root');

if (errors.length) {
  console.error('Workflow compaction check failed:');
  errors.forEach((error) => console.error(' - ' + error));
  console.error('Context stats:');
  contextStats.slice(0, 10).forEach((item) => console.error(` - ${item.name}: ${item.lines} lines, ${item.bytes} bytes`));
  console.error('Skill stats:');
  skillStats.forEach((item) => console.error(` - ${item.name}: ${item.lines} lines, ${item.bytes} bytes, refs=${item.hasReferences}`));
  if (warnings.length) warnings.forEach((warning) => console.error('WARN: ' + warning));
  process.exit(1);
}

console.log(`Workflow compaction check OK: ${version}.`);
console.log(`Default preflight: ${preflightBytes} bytes (limit 65536).`);
console.log('Largest context files:');
contextStats.slice(0, 5).forEach((item) => console.log(` - ${item.name}: ${item.lines} lines, ${item.bytes} bytes`));
console.log('Skill compaction candidates:');
skillStats.filter((item) => item.lines > 250 || item.bytes > 10_000).forEach((item) => {
  console.log(` - ${item.name}: ${item.lines} lines, ${item.bytes} bytes, refs=${item.hasReferences}, scripts=${item.hasScripts}`);
});
if (warnings.length) warnings.forEach((warning) => console.warn('WARN: ' + warning));
if (governedLargeContext.length) {
  console.log('Governed large context files:');
  governedLargeContext.forEach((item) => console.log(` - ${item.name}: ${item.lines} lines, ${item.bytes} bytes, routed=true`));
}
