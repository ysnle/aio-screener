// Blob transition tracing, not semantic credit for an entire change/commit.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const dir = '_artifacts/exhaustive-audit-20260831';
const manifest = JSON.parse(fs.readFileSync(`${dir}/manifest.json`, 'utf8'));
const parsed = JSON.parse(fs.readFileSync(`${dir}/static-audit.json`, 'utf8')).history;
const triage = JSON.parse(fs.readFileSync(`${dir}/history-failure-triage.json`, 'utf8')).results;
const triaged = new Map(triage.map(row => [row.blob, row]));
const confirmed = parsed.filter(row => row.status === 'parse-failed' && (!row.path.endsWith('.html') || triaged.get(row.blob)?.disposition === 'inert-html-parse-confirmed'));
const bad = new Set(confirmed.map(row => row.blob));
const info = sha => execFileSync('git', ['show', '-s', '--format=%h %aI %s', sha], { encoding: 'utf8' }).trim();
const traces = confirmed.map(row => ({
  path: row.path, blob: row.blob, error: triaged.get(row.blob)?.failures || row.error,
  introducedBy: manifest.commits.filter(commit => commit.changes.some(change => change.path === row.path && change.after === row.blob)).map(commit => ({ sha: commit.sha, subject: info(commit.sha) })),
  replacedBy: manifest.commits.flatMap(commit => commit.changes.filter(change => change.path === row.path && change.before === row.blob).map(change => ({ sha: commit.sha, subject: info(commit.sha), after: change.after, nextBlobHasConfirmedSyntaxFailure: bad.has(change.after) })))
}));
fs.writeFileSync(`${dir}/history-lineage.json`, JSON.stringify({ at: new Date().toISOString(), boundary: 'All incoming/outgoing blob transitions including merges. Parser status of a replacement is not proof of complete runtime repair or deployment.', traces }, null, 2) + '\n');
console.log(JSON.stringify(traces.map(row => ({ path: row.path, blob: row.blob.slice(0, 8), introducedBy: row.introducedBy.map(c=>c.subject), replacedBy: row.replacedBy.map(c=>({ subject:c.subject, stillBad:c.nextBlobHasConfirmedSyntaxFailure })) })), null, 2));
