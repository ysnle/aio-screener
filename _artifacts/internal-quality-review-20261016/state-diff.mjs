// Read-only diagnosis of global generated-state drift; no regeneration.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildWorkspaceState, renderCurrentState } from '../../scripts/workspace-state-lib.mjs';
const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../..');
const current = fs.readFileSync(path.join(root, '_context/CURRENT-STATE.md'), 'utf8').split(/\r?\n/);
const expected = renderCurrentState(buildWorkspaceState(root)).split(/\r?\n/);
const baseline = JSON.parse(fs.readFileSync(path.join(root, '.cache/aio-qa/sessions/internal-quality-20261016.json'), 'utf8'));
const rows = Array.from({ length: Math.max(current.length, expected.length) }, (_, i) => ({ line: i + 1, actual: current[i] || '', expected: expected[i] || '' })).filter(r => r.actual !== r.expected);
const paths = ['_context/CURRENT-STATE.md', '_context/QA-CHECKLIST.md', '_context/BUG-POSTMORTEM.md', 'index.html', 'version.json', 'architecture/qa-pipeline.json'];
const hashes = paths.map(file => {
  const now = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
  return { file, baseline: baseline.files[file] || null, current: now, unchangedSinceTaskStart: baseline.files[file] === now };
});
const result = { observedAt: new Date().toISOString(), boundary: 'Global workspace drift diagnosis. Files are read-only and are not owned or fixed by this audit.', rows, hashes };
fs.writeFileSync(path.join(dir, 'state-diff.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
