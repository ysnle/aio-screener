import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Resolve the sole version currently serving 100% of traffic from Wrangler's
 * `deployments list --json` response. Refuse split deployments because picking
 * one side would not restore the known pre-deploy state.
 */
export function resolveActiveWorkerVersionId(payload) {
  const response = payload?.result ?? payload;
  const deployments = Array.isArray(response) ? response : response?.deployments;
  if (!Array.isArray(deployments) || deployments.length === 0) {
    throw new Error('Cloudflare returned no active Worker deployment; automatic rollback baseline is unavailable');
  }

  // P1335: Wrangler lists deployments oldest-first, so deployments[0] rolled a Worker back to a
  // July version. The active deployment is the newest one by created_on.
  // P1351: an undated record cannot be ordered safely against the active deployment.
  const dated = deployments.map((deployment) => {
    const created = Date.parse(deployment?.created_on || deployment?.createdOn || '');
    if (!Number.isFinite(created)) throw new Error('Worker rollback baseline has a missing or invalid deployment date');
    return { deployment, created };
  });
  const newest = Math.max(...dated.map((entry) => entry.created));
  const latest = dated.filter((entry) => entry.created === newest);
  if (latest.length !== 1) throw new Error('Worker rollback baseline has an ambiguous latest deployment date');
  const active = latest[0].deployment;
  if (!Array.isArray(active?.versions) || active.versions.length !== 1 || active.versions[0]?.percentage !== 100) {
    throw new Error('active Worker deployment is split or malformed; automatic rollback requires one version at 100%');
  }

  const versionId = active.versions[0].version_id;
  if (typeof versionId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(versionId)) {
    throw new Error('active Worker deployment has no valid version_id; refusing deployment without a rollback target');
  }
  return versionId;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const inputPath = process.argv[2];
  if (!inputPath) throw new Error('usage: node scripts/resolve-worker-rollback-version.mjs <wrangler-deployments-json>');
  const payload = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  process.stdout.write(`${resolveActiveWorkerVersionId(payload)}\n`);
}
