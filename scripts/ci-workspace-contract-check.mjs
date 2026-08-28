import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildContextCatalog, buildWorkspaceState, renderCurrentState, serializeJson } from './workspace-state-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const exists = (path) => existsSync(join(root, path));
const errors = [];
const check = (label, condition, detail = '') => {
  if (!condition) errors.push(label + (detail ? `: ${detail}` : ''));
};

const state = buildWorkspaceState(root);
const expectedState = renderCurrentState(state);
const expectedCatalog = serializeJson(buildContextCatalog(root));
check('generated current state is present and current', exists('_context/CURRENT-STATE.md') && read('_context/CURRENT-STATE.md') === expectedState);
check('generated context catalog is present and current', exists('_context/CONTEXT-CATALOG.json') && read('_context/CONTEXT-CATALOG.json') === expectedCatalog);

for (const guide of ['AGENTS.md', 'CLAUDE.md', '_context/INDEX.md', '_context/CLAUDE.md', '_context/WORKFLOW-GOVERNANCE.md']) {
  const text = read(guide);
  check(`${guide} points to generated current state`, /_context\/CURRENT-STATE\.md/.test(text));
  check(`${guide} avoids historical architecture constants`, !/(39,?000\+?|~32,?000|2\.2MB|21개 SPA|라우트 17개|R1~R18|204개 검증|버전 6곳)/i.test(text));
}
check('root AGENTS.md stays below the default project-instruction budget', Buffer.byteLength(read('AGENTS.md'), 'utf8') <= 16_000);
check('root CLAUDE.md stays compact', Buffer.byteLength(read('CLAUDE.md'), 'utf8') <= 16_000);
check('context index stays compact', Buffer.byteLength(read('_context/INDEX.md'), 'utf8') <= 24_000);
check('context guide stays compact', Buffer.byteLength(read('_context/CLAUDE.md'), 'utf8') <= 24_000);

const requiredFrontmatter = ['CURRENT-STATE.md', 'WORKFLOW-GOVERNANCE.md', 'INDEX.md', 'RULES.md', 'BUG-POSTMORTEM.md', 'QA-CHECKLIST.md', 'KNOWLEDGE-BASE.md', 'CODE-MAP.md'];
for (const file of requiredFrontmatter) {
  const text = read(`_context/${file}`);
  check(`${file} has closed YAML frontmatter`, /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.test(text));
}

const hookConfig = JSON.parse(read('.codex/hooks.json'));
const hookHandlers = Object.values(hookConfig.hooks || {}).flatMap((groups) => groups).flatMap((group) => group.hooks || []);
check('Codex hooks contain no Stop mutation path', !hookConfig.hooks?.Stop);
check('Codex hooks contain no automatic commit/deploy command', hookHandlers.every((handler) => !/(auto-commit|git\s+commit|git\s+push|\/deploy)/i.test(handler.command || '')));
check('Codex hooks use the cross-platform Node hook', hookHandlers.length >= 3 && hookHandlers.every((handler) => /scripts[\\/]agent-hook\.mjs/.test(handler.command || '')));
check('Codex hooks define Windows command overrides', hookHandlers.every((handler) => typeof handler.commandWindows === 'string' && /agent-hook\.mjs/.test(handler.commandWindows)));
check('Codex hooks do not invoke shell-only scripts', hookHandlers.every((handler) => !/\.sh(?:\s|$)/.test(handler.command || '') && !/\.sh(?:\s|$)/.test(handler.commandWindows || '')));
const hookScript = read('scripts/agent-hook.mjs');
check('agent hook parses one JSON object from stdin', /process\.stdin/.test(hookScript) && /JSON\.parse/.test(hookScript));
check('agent hook never commits or deploys', !/execFileSync\([^\n]*(?:commit|push|deploy)/i.test(hookScript));

const runHook = (mode, payload, environment = {}) => spawnSync(process.execPath, [join(root, 'scripts', 'agent-hook.mjs'), mode], {
  cwd: root,
  encoding: 'utf8',
  input: JSON.stringify(payload),
  env: { ...process.env, ...environment },
  timeout: 15_000
});
const safeHook = runHook('guard-command', { cwd: root, hook_event_name: 'PreToolUse', tool_input: { command: 'git status --short' } });
check('safe command hook fixture passes silently', safeHook.status === 0 && safeHook.stdout === '', safeHook.stderr);
const dangerousHook = runHook('guard-command', { cwd: root, hook_event_name: 'PreToolUse', tool_input: { command: 'git reset --hard HEAD' } });
let dangerousOutput = {};
try { dangerousOutput = JSON.parse(dangerousHook.stdout || '{}'); } catch { dangerousOutput = {}; }
check('destructive command hook fixture returns documented deny output', dangerousHook.status === 0 && dangerousOutput.hookSpecificOutput?.hookEventName === 'PreToolUse' && dangerousOutput.hookSpecificOutput?.permissionDecision === 'deny');
const archiveHook = runHook('guard-edit', { cwd: root, hook_event_name: 'PreToolUse', tool_input: { command: '*** Update File: _archive/evidence.md' } });
let archiveOutput = {};
try { archiveOutput = JSON.parse(archiveHook.stdout || '{}'); } catch { archiveOutput = {}; }
check('archive edit hook fixture returns documented deny output', archiveOutput.hookSpecificOutput?.permissionDecision === 'deny');
const sessionHook = runHook('session-start', { cwd: root, hook_event_name: 'SessionStart', source: 'startup' });
let sessionOutput = {};
try { sessionOutput = JSON.parse(sessionHook.stdout || '{}'); } catch { sessionOutput = {}; }
check('SessionStart hook fixture injects generated current state', sessionHook.status === 0 && sessionOutput.hookSpecificOutput?.hookEventName === 'SessionStart' && String(sessionOutput.hookSpecificOutput?.additionalContext || '').includes(state.application.version));
const unrelatedPostEdit = runHook('post-edit', { cwd: root, hook_event_name: 'PostToolUse', tool_input: { command: '*** Update File: notes.txt' } });
check('unrelated PostToolUse hook fixture passes silently', unrelatedPostEdit.status === 0 && unrelatedPostEdit.stdout === '', unrelatedPostEdit.stderr);
const advisoryPostEdit = runHook(
  'post-edit',
  { cwd: root, hook_event_name: 'PostToolUse', tool_input: { command: '*** Update File: AGENTS.md' } },
  { AIO_HOOK_GATE_TIMEOUT_MS: '1' }
);
let advisoryOutput = {};
try { advisoryOutput = JSON.parse(advisoryPostEdit.stdout || '{}'); } catch { advisoryOutput = {}; }
check('failing PostToolUse fixture returns valid advisory JSON without blocking the edit', advisoryPostEdit.status === 0 && /^AIO advisory gate:/.test(String(advisoryOutput.systemMessage || '')), advisoryPostEdit.stderr || advisoryPostEdit.stdout);

for (const dir of ['.codex/hooks', '.claude/hooks']) {
  const shellFiles = exists(dir) ? readdirSync(join(root, dir)).filter((name) => name.endsWith('.sh')) : [];
  check(`${dir} contains no legacy shell hooks`, shellFiles.length === 0, shellFiles.join(', '));
}

check('agent profile source exists', exists('architecture/agent-profiles.json'));
check('agent profile generator exists', exists('scripts/sync-agent-profiles.mjs'));
check('skill eval fixtures exist', exists('architecture/skill-eval-cases.json'));
check('skill eval fixture gate exists', exists('scripts/ci-skill-eval-fixture-check.mjs'));
check('portable Codex skill discovery surface is materialized', exists('.agents/skills/knowledge-lint/SKILL.md'));
for (const file of ['.codex/agents/accessibility-auditor.toml', '.codex/agents/code-reviewer.toml', '.codex/agents/performance-analyzer.toml', '.codex/agents/qa-auditor.toml', '.claude/agents/accessibility-auditor.md', '.claude/agents/code-reviewer.md', '.claude/agents/performance-analyzer.md', '.claude/agents/qa-auditor.md']) {
  const text = read(file);
  check(`${file} reads generated current state`, /_context\/CURRENT-STATE\.md/.test(text));
  check(`${file} has no frozen model or historical count`, !/(model:\s*sonnet|model\s*=|39,?000|21개|204개|R1~R18|버전 6곳)/i.test(text));
}

const ci = read('.github/workflows/ci.yml');
const qaPipeline = JSON.parse(read('architecture/qa-pipeline.json'));
const qaScripts = Object.values(qaPipeline.groups || {}).flatMap((group) => group.gates || []).map((gate) => gate.script);
check('push/PR CI runs the canonical QA manifest', /qa-runner\.mjs/.test(ci) && /--group preflight/.test(ci));
check('push/PR CI runs workspace contract', qaScripts.includes('scripts/ci-workspace-contract-check.mjs'));
check('push/PR CI runs knowledge lint', qaScripts.includes('scripts/ci-knowledge-lint-check.mjs'));
check('push/PR CI runs skill eval fixtures', qaScripts.includes('scripts/ci-skill-eval-fixture-check.mjs'));
check('push/PR CI runs reference curriculum boundary contract', qaScripts.includes('scripts/ci-reference-curriculum-contract-check.mjs'));
const weekly = read('.github/workflows/knowledge-lint.yml');
check('scheduled knowledge lint also checks workspace contract', /ci-workspace-contract-check\.mjs/.test(weekly));
check('failure escalation workflow exists', exists('.github/workflows/operations-alert.yml'));
const operationsAlert = read('.github/workflows/operations-alert.yml');
check('operations alert monitors each required workflow', ['CI', 'Data freshness watchdog', 'Knowledge base lint'].every((name) => operationsAlert.includes(`'${name}'`)));
check('operations alert deduplicates one issue by workflow marker', /aio-operations-alert:\$\{workflow\}/.test(operationsAlert) && /listForRepo/.test(operationsAlert) && /includes\(marker\)/.test(operationsAlert));
check('operations alert threshold matches the two-consecutive-failure SLO', /consecutiveFailures\s*=\s*1/.test(operationsAlert) && /consecutiveFailures\s*<\s*2/.test(operationsAlert) && /candidate\.conclusion === 'success'/.test(operationsAlert));
check('operations alert updates or reopens failures and closes matching recovery', /state:\s*'open'/.test(operationsAlert) && /Still failing:/.test(operationsAlert) && /state:\s*'closed'/.test(operationsAlert) && /if \(succeeded\)/.test(operationsAlert));
check('operations alert does not mutate source or dispatch deployments', !/(contents:\s*write|git\s+(?:commit|push)|createWorkflowDispatch|deploy-pages)/i.test(operationsAlert));
const liveInvariant = read('scripts/ci-live-invariant-check.mjs');
const watchdog = read('.github/workflows/data-watchdog.yml');
check('live invariant keeps an explicit strict header mode', /LIVE_HEADER_POLICY/.test(liveInvariant) && /enforce/.test(liveInvariant));
check('GitHub Pages default treats unavailable response headers as operator-owned', /resolveLiveHeaderPolicy/.test(liveInvariant) && exists('scripts/live-header-policy.mjs'));
check('data watchdog declares the GitHub Pages header policy', /LIVE_HEADER_POLICY:\s*operator-required/.test(watchdog));
check('header limitations cannot silently become publication-ready', /OPERATOR_REQUIRED|PUBLIC_DEPLOY.*OPERATOR_REQUIRED/s.test(liveInvariant));
check('live header policy has a deterministic behavior gate', exists('scripts/ci-live-header-policy-contract-check.mjs') && qaScripts.includes('scripts/ci-live-header-policy-contract-check.mjs'));

const noAutoCommitSurfaces = ['AGENTS.md', 'CLAUDE.md', '_context/WORKFLOW-GOVERNANCE.md', '.codex/hooks.json'];
for (const file of noAutoCommitSurfaces) {
  const text = read(file);
  check(`${file} forbids automatic commit/deploy`, /automatic commit|자동 커밋|auto-commit|never commit|commit.*explicit|커밋.*명시/i.test(text));
}

if (errors.length) {
  console.error('Workspace contract check failed:');
  errors.forEach((error) => console.error(` - ${error}`));
  process.exit(1);
}
console.log(`Workspace contract OK: ${state.application.version}, ${state.workspace.contextDocuments} context docs, ${state.workspace.skills} skills, ${state.workspace.agentProfiles} agent profiles, ${state.workspace.workflows} workflows.`);
