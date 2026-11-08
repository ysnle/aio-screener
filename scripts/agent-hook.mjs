#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
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
    // P1340: the shared working tree belongs to the user; whole-tree discards are as destructive as reset --hard.
    [/\bgit\s+(?:checkout|restore)\b(?:\s+-{1,2}[a-z-]+(?:\s+\S+)?)*\s+(?:--\s+)?\.(?:\s|$)/i, 'Discarding the whole working tree can destroy uncommitted work.'],
    [/\bgit\s+checkout\s+(?:-f|--force)\b/i, 'Forced checkout discards local changes.'],
    [/\bgit\s+clean\b[^\n]*\s(?:-[a-z]*f[a-z]*|--force)\b/i, 'git clean -f deletes untracked files permanently.'],
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

// Progressive-disclosure handoff pointer (claude-mem idea without its worker):
// name the newest HANDOFF/RESPONSE docs under _artifacts so a new session reads
// the latest cross-harness (Claude/Codex/Command Code) state instead of a
// hand-pinned path that goes stale.
function latestHandoffs(limit = 3) {
  const base = join(root, '_artifacts');
  const found = [];
  const visit = (dir, depth) => {
    let entries = [];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) { if (depth < 2) visit(full, depth + 1); continue; }
      if (!/(HANDOFF|RESPONSE|IMPLEMENTATION-REPORT)[^/\\]*\.md$/i.test(entry.name)) continue;
      try { found.push({ path: relative(root, full).replace(/\\/g, '/'), mtime: statSync(full).mtimeMs }); } catch { /* unreadable */ }
    }
  };
  visit(base, 0);
  // v59.56: a fresh clone (every cloud session) stamps all files with the clone time, so mtime ordering picked an
  // arbitrary handoff. Order by the last commit that touched each file; mtime stays for files not yet committed.
  const committed = new Map();
  try {
    let at = 0;
    const log = execFileSync('git', ['log', '-n', '400', '--format=%x00%ct', '--name-only', '--', '_artifacts'], { cwd: root, encoding: 'utf8', timeout: 4000, maxBuffer: 8 * 1024 * 1024 });
    for (const line of log.split(/\r?\n/)) {
      if (line.startsWith('\u0000')) at = Number(line.slice(1)) * 1000;
      else if (line && !committed.has(line)) committed.set(line, at);
    }
  } catch { /* no git history: keep mtimes */ }
  for (const item of found) if (committed.has(item.path)) item.mtime = committed.get(item.path);
  return found.sort((a, b) => b.mtime - a.mtime).slice(0, limit)
    .map((item) => `${item.path} (${new Date(item.mtime).toISOString().slice(0, 10)})`);
}

// v59.56: a cloud container starts without node_modules and with a Chromium revision that can lag the pinned
// Playwright; say so up front instead of letting the first browser gate fail with "Executable doesn't exist".
function cloudSetupNote() {
  if (process.env.CLAUDE_CODE_REMOTE !== 'true') return '';
  try {
    execFileSync(process.execPath, [join(root, 'scripts', 'cloud-session-setup.mjs'), '--check'], { cwd: root, stdio: 'ignore', timeout: 5000 });
    return ' Cloud session: dependencies and browser ready.';
  } catch {
    return ' Cloud session: run `node scripts/cloud-session-setup.mjs` once before qa-runner or any browser gate (npm ci + Playwright browser revision links).';
  }
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
        additionalContext: `AIO preflight: ${version}; working tree ${dirty.length ? `dirty (${dirty.length} paths)` : 'clean'}.${cloudSetupNote()} Read _context/CURRENT-STATE.md once; consult governance/index only when relevant and reuse unchanged context. Search large ledgers only for matching terms. Existing dirty changes belong to the user. Automatic commit/deploy is forbidden. Current-state bytes loaded=${Buffer.byteLength(text, 'utf8')}.${(() => { const items = latestHandoffs(); return items.length ? ` Latest handoffs (read only when continuing prior work): ${items.join('; ')}.` : ''; })()}`
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
  // v59.70 (owner 2026-11-04): advisory only — a control character in the edited file is reported, never blocked. A
  // heredoc ate `\b` into U+0008 in reaction-read.js (v59.69) and CI preflight held every release until it was found.
  const controlWarnings = [];
  const { controlCharSites } = await import('./lib/control-chars.mjs');
  for (const target of editTargets.split('\n').filter(Boolean)) {
    const file = resolve(root, target);
    try {
      if (!existsSync(file) || statSync(file).size > 8 * 1024 * 1024) continue;
      const sites = controlCharSites(readFileSync(file, 'utf8'));
      const shown = relative(root, file);
      if (sites.length) controlWarnings.push(`${shown && !shown.startsWith('..') ? shown : file}:${sites.map((site) => `line ${site.line} ${site.code}`).join(', ')}`);
    } catch { /* unreadable target: nothing to report */ }
  }
  // v59.84 (recurrence analysis S3): the first edit of a code file in a session shows the ledger entries that fixed it
  // before (scripts/prior-fixes.mjs), so a change starts from the earlier fixes instead of adding one more branch.
  let priorNote = '';
  try {
    const { priorFixes, priorFixesText } = await import('./prior-fixes.mjs');
    const { tmpdir } = await import('node:os');
    const { writeFileSync, mkdirSync } = await import('node:fs');
    const seenDir = join(tmpdir(), 'aio-prior-fixes');
    const seenFile = join(seenDir, `${String(input.session_id || 'session').replace(/[^\w-]/g, '')}.json`);
    let seen = [];
    try { seen = JSON.parse(readFileSync(seenFile, 'utf8')); } catch { seen = []; }
    const fresh = editTargets.split('\n').filter(Boolean).map((target) => relative(root, resolve(root, target)).replace(/\\/g, '/'))
      .filter((file) => /^(?:src|js|scripts)\/.+\.m?js$/.test(file) && !/^scripts\/ci-/.test(file) && !seen.includes(file));
    if (fresh.length) {
      priorNote = priorFixesText(priorFixes(fresh, { root, limit: 5 }));
      mkdirSync(seenDir, { recursive: true });
      writeFileSync(seenFile, JSON.stringify([...seen, ...fresh].slice(-500)));
    }
  } catch { /* advisory only: a missing ledger or tmpdir never blocks an edit */ }
  const messages = [];
  if (priorNote) messages.push(`AIO prior fixes for the file you just edited — read them before adding a branch (node scripts/prior-fixes.mjs <file>): ${priorNote}`);
  if (controlWarnings.length) messages.push(`AIO control-character warning (same rule as ci-control-char-check; a regex \\b written through a shell heredoc becomes U+0008): ${controlWarnings.join('; ')}. Fix with the Edit tool, then node --check.`);
  if (touchesWorkspace || touchesVersion) messages.push('AIO closeout reminder: run qa-runner.mjs affected with the task session or explicit owned files after the edit batch. Intermediate edit state is allowed; reuse matching PASS evidence.');
  if (messages.length) emit({
    systemMessage: messages.join(' '),
    ...(controlWarnings.length || priorNote ? { hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: messages.filter((text) => !/closeout reminder/.test(text)).join(' ') } } : {})
  });
  process.exit(0);
}

process.exit(0);
