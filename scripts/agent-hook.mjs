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
// P1084: this hook used to read only `tool_input.command`. That is the Codex
// apply_patch shape; Claude Code's Edit/Write tools pass `file_path` (and
// NotebookEdit passes `notebook_path`) with no `command` key at all, so
// guard-edit and post-edit were evaluated against an empty string and were
// silently inert on Claude for as long as both clients existed. Inspect every
// documented target field instead of assuming one client's payload.
const editTargets = [toolInput.file_path, toolInput.notebook_path, toolInput.path]
  .filter((value) => typeof value === 'string' && value.trim())
  .join('\n');
const editText = [command, editTargets].filter(Boolean).join('\n') || command;
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
  const match = editText.match(/(?:^|[^A-Za-z0-9_-])((?:_backup|_archive)[\\/][^\s"']*)/i);
  if (match) {
    deny(`Backup/archive evidence is read-only (${match[1]}). Create a new current document instead of mutating history.`);
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
        additionalContext: `AIO preflight: ${version}; working tree ${dirty.length ? `dirty (${dirty.length} paths)` : 'clean'}. Read _context/CURRENT-STATE.md once; consult governance/index only when relevant and reuse unchanged context. Search large ledgers only for matching terms. Existing dirty changes belong to the user. Automatic commit/deploy is forbidden. Current-state bytes loaded=${Buffer.byteLength(text, 'utf8')}.`
      }
    };
  } catch (error) {
    state = { systemMessage: `AIO SessionStart preflight unavailable: ${error.message}` };
  }
  emit(state);
  process.exit(0);
}

if (mode === 'post-edit') {
  const touchesWorkspace = /(AGENTS\.md|CLAUDE\.md|_context|\.claude|\.codex|\.agents|\.github[\\/]workflows|scripts[\\/](?:ci-|generate-workspace|sync-agent|agent-hook))/.test(editText);
  const touchesVersion = /(index\.html|version\.json|sw\.js|js[\\/]aio-core\.js|CHANGELOG\.md)/.test(editText);
  if (touchesWorkspace || touchesVersion) emit({ systemMessage: 'AIO closeout reminder: run qa-runner.mjs affected with the task session or explicit owned files after the edit batch. Intermediate edit state is allowed; reuse matching PASS evidence.' });
  process.exit(0);
}

process.exit(0);
