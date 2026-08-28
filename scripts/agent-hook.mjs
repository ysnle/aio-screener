#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] || '';
const inputText = await new Promise((resolveInput) => {
  let value = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { value += chunk; });
  process.stdin.on('end', () => resolveInput(value));
});
let input = {};
try { input = inputText.trim() ? JSON.parse(inputText) : {}; } catch { input = {}; }

function findRoot(start) {
  let current = resolve(start || scriptRoot);
  while (true) {
    if (existsSync(join(current, '.git')) && existsSync(join(current, 'version.json'))) return current;
    const parent = dirname(current);
    if (parent === current) return scriptRoot;
    current = parent;
  }
}

const root = findRoot(input.cwd || process.cwd());
const toolInput = input.tool_input && typeof input.tool_input === 'object' ? input.tool_input : {};
const command = String(toolInput.command || '');
const emit = (value) => process.stdout.write(JSON.stringify(value));
const deny = (reason) => emit({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: reason
  }
});

if (mode === 'guard-command') {
  const normalized = command.replace(/\s+/g, ' ').trim();
  const blocked = [
    [/\bgit\s+reset\s+--hard\b/i, 'git reset --hard can destroy uncommitted work.'],
    [/\bgit\s+push\b[^\n]*\s--force(?:\s|$)/i, 'Force push is forbidden; use an explicitly reviewed safer workflow.'],
    [/(?:^|[;&|]\s*)rm\s+-[^\n]*r[^\n]*f\s+(?:~|\/|\$HOME|%USERPROFILE%)(?:\s|$)/i, 'Recursive deletion of a home/root target is forbidden.'],
    [/\b(?:Remove-Item|del|rmdir)\b[^\n]*(?:C:\\|%USERPROFILE%|\$HOME)[^\n]*(?:-Recurse|\/s)/i, 'Broad recursive deletion is forbidden.']
  ];
  const match = blocked.find(([pattern]) => pattern.test(normalized));
  if (match) deny(match[1]);
  process.exit(0);
}

if (mode === 'guard-edit') {
  if (/(?:^|[^A-Za-z0-9_-])(?:_backup|_archive)[\\/]/i.test(command)) {
    deny('Backup/archive evidence is read-only. Create a new current document instead of mutating history.');
  }
  process.exit(0);
}

if (mode === 'session-start') {
  let state = {};
  try {
    const text = readFileSync(join(root, '_context', 'CURRENT-STATE.md'), 'utf8');
    const version = JSON.parse(readFileSync(join(root, 'version.json'), 'utf8')).version;
    const dirty = execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
    state = {
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: `AIO preflight: ${version}; working tree ${dirty.length ? `dirty (${dirty.length} paths)` : 'clean'}. Read _context/CURRENT-STATE.md, _context/WORKFLOW-GOVERNANCE.md, and _context/INDEX.md. Search large ledgers only for matching terms. Existing dirty changes belong to the user. Automatic commit/deploy is forbidden. Current-state bytes loaded=${Buffer.byteLength(text, 'utf8')}.`
      }
    };
  } catch (error) {
    state = { systemMessage: `AIO SessionStart preflight unavailable: ${error.message}` };
  }
  emit(state);
  process.exit(0);
}

if (mode === 'post-edit') {
  const touchesWorkspace = /(AGENTS\.md|CLAUDE\.md|_context|\.claude|\.codex|\.agents|\.github[\\/]workflows|scripts[\\/](?:ci-|generate-workspace|sync-agent|agent-hook))/.test(command);
  const touchesVersion = /(index\.html|version\.json|sw\.js|js[\\/]aio-core\.js|CHANGELOG\.md)/.test(command);
  const failures = [];
  const configuredTimeout = Number(process.env.AIO_HOOK_GATE_TIMEOUT_MS);
  const gateTimeout = Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 15000;
  const run = (script) => {
    try { execFileSync(process.execPath, [join(root, 'scripts', script)], { cwd: root, encoding: 'utf8', stdio: 'pipe', timeout: gateTimeout }); }
    catch (error) { failures.push(`${script}: ${String(error.stderr || error.stdout || error.message).trim().split(/\r?\n/)[0]}`); }
  };
  if (touchesWorkspace) run('ci-workspace-contract-check.mjs');
  if (touchesVersion) run('ci-version-check.mjs');
  if (failures.length) emit({ systemMessage: `AIO advisory gate: ${failures.join(' | ')}. Intermediate edit state is allowed; resolve before closeout.` });
  process.exit(0);
}

process.exit(0);
