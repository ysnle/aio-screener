// Deterministic coverage for the mechanical subset of the knowledge-lint skill.
// Semantic truth, source directness and human review remain separate evidence levels.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildContextCatalog, buildWorkspaceState, renderCurrentState, serializeJson } from './workspace-state-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const errors = [];
const warnings = [];
const check = (label, condition, detail = '') => { if (!condition) errors.push(label + (detail ? `: ${detail}` : '')); };
const warn = (label, condition, detail = '') => { if (!condition) warnings.push(label + (detail ? `: ${detail}` : '')); };

const catalog = buildContextCatalog(root);
const catalogText = serializeJson(catalog);
const state = buildWorkspaceState(root);
check('generated context catalog matches the filesystem in both directions', existsSync(join(root, '_context', 'CONTEXT-CATALOG.json')) && read('_context/CONTEXT-CATALOG.json') === catalogText);
check('generated current state matches repository registries', existsSync(join(root, '_context', 'CURRENT-STATE.md')) && read('_context/CURRENT-STATE.md') === renderCurrentState(state));

const STALE_DAYS = 45;
const now = Date.now();
for (const doc of catalog.documents) {
  if (!doc.path.endsWith('.md') || doc.generated) continue;
  const text = read(doc.path);
  if (text.startsWith('---')) check(`${doc.path} has closed YAML frontmatter`, /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.test(text));
  if (['preflight', 'ledger', 'targeted-map'].includes(doc.kind)) check(`${doc.path} has frontmatter`, /^---\r?\n/.test(text));
  if (doc.kind === 'current-handoff') {
    check(`${doc.path} current handoff declares last_verified`, /^\d{4}-\d{2}-\d{2}$/.test(doc.lastVerified || ''));
    if (/^\d{4}-\d{2}-\d{2}$/.test(doc.lastVerified || '')) {
      const ageDays = Math.floor((now - new Date(`${doc.lastVerified}T00:00:00Z`).getTime()) / 86400000);
      warn(`${doc.path} current handoff is ${ageDays}d old`, ageDays <= STALE_DAYS, `threshold=${STALE_DAYS}d; reclassify historical or refresh`);
    }
  }
  warn(`${doc.path} contains replacement-character encoding damage`, !text.includes('\uFFFD'), 'historical evidence remains explicit-only until recovered from Git history');
  if (!doc.autoRefresh) continue;
  check(`${doc.path} declares parseable last_verified with auto_refresh`, /^\d{4}-\d{2}-\d{2}$/.test(doc.lastVerified || ''));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(doc.lastVerified || '')) continue;
  const ageDays = Math.floor((now - new Date(`${doc.lastVerified}T00:00:00Z`).getTime()) / 86400000);
  warn(`${doc.path} last_verified is ${ageDays}d old`, ageDays <= STALE_DAYS, `threshold=${STALE_DAYS}d`);
}

const hotSurfaces = [
  'AGENTS.md', 'CLAUDE.md', '_context/CURRENT-STATE.md', '_context/INDEX.md', '_context/CLAUDE.md', '_context/WORKFLOW-GOVERNANCE.md',
  ...readdirSync(join(root, '.claude', 'commands')).filter((name) => name.endsWith('.md')).map((name) => `.claude/commands/${name}`),
  ...readdirSync(join(root, '.claude', 'skills'), { withFileTypes: true }).filter((entry) => entry.isDirectory() && entry.name !== '_shared').map((entry) => `.claude/skills/${entry.name}/SKILL.md`),
  ...readdirSync(join(root, '.claude', 'agents')).filter((name) => name.endsWith('.md')).map((name) => `.claude/agents/${name}`),
  ...readdirSync(join(root, '.codex', 'agents')).filter((name) => name.endsWith('.toml')).map((name) => `.codex/agents/${name}`)
];
const reasoningEcho = /(show|reveal|print|explain|narrate|echo).{0,30}(chain[- ]of[- ]thought|internal reasoning|hidden reasoning|사고 과정|내부 추론)/i;
const staleFacts = /(39,?000\+?|~32,?000|2\.2MB|21개 SPA|라우트 17개|R1~R18|204개 검증|버전 6곳)/i;
for (const path of hotSurfaces) {
  const text = read(path);
  check(`${path} does not request internal-reasoning disclosure`, !reasoningEcho.test(text));
  check(`${path} contains no frozen historical workspace count`, !staleFacts.test(text));
}

const rules = read('_context/RULES.md');
const qa = read('_context/QA-CHECKLIST.md');
const postmortem = read('_context/BUG-POSTMORTEM.md');
const governance = read('_context/WORKFLOW-GOVERNANCE.md');
check('postmortem-to-rule workflow is explicit', /Postmortem-To-Gate Rule/.test(governance));
check('generated-state rule is present', /R520/.test(rules) && /CURRENT-STATE/.test(rules));
check('hook authority rule is present', /R521/.test(rules) && /automatic commit|자동 커밋/i.test(rules));
check('workspace regression QA is present', /QA-WORKSPACE-01/.test(qa) && /ci-workspace-contract-check\.mjs/.test(qa));
check('workspace drift postmortem is present', /P964/.test(postmortem) && /workspace|작업환경/i.test(postmortem));
const defaultWorkingSet = read('_context/INDEX.md').match(/## Default working set([\s\S]*?)## Search-only ledgers/)?.[1] || '';
check('default working set does not route to the frozen v48 worktree audit', !/WORKTREE-AUDIT\.md/.test(defaultWorkingSet));
check('knowledge current-observations gate is reachable through the QA manifest', Object.values(JSON.parse(read('architecture/qa-pipeline.json')).groups || {}).some((group) => (group.gates || []).some((gate) => gate.script === 'scripts/ci-knowledge-current-observations-check.mjs')));

if (warnings.length) {
  console.warn('Knowledge lint warnings:');
  warnings.forEach((warning) => console.warn(` - ${warning}`));
}
if (errors.length) {
  console.error('Knowledge lint check failed:');
  errors.forEach((error) => console.error(` - ${error}`));
  process.exit(1);
}
console.log(`Knowledge lint OK: ${catalog.documentCount} context documents, ${hotSurfaces.length} prescriptive surfaces, ${warnings.length} warning(s). Mechanical PASS does not certify semantic truth.`);
