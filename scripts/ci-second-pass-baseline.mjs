// H2-00: freeze the local/origin/live boundary before second-pass work.
// This script is intentionally read-only with respect to source files.  It writes
// one disposable evidence artifact so a later deploy review cannot confuse local
// code, origin/main, GitHub Pages, and the separately deployed Worker.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifactPath = resolve(root, '_artifacts', 'second-pass-baseline.json');
const run = (command, args) => {
  try { return execFileSync(command, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
  catch (error) { return `UNAVAILABLE: ${error.message}`; }
};
const version = JSON.parse(readFileSync(resolve(root, 'version.json'), 'utf8'));
const statusLines = run('git', ['status', '--short']).split(/\r?\n/).filter(Boolean);
const changedFiles = statusLines.map((line) => line.slice(3).trim()).filter(Boolean);
const workerSource = readFileSync(resolve(root, 'cloudflare-worker-proxy.js'), 'utf8');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const liveUrl = process.env.AIO_BASELINE_LIVE_URL || 'https://ysnle.github.io/aio-screener/version.json';
let live = { status: 'UNVERIFIED', url: liveUrl, version: null, error: 'AIO_BASELINE_FETCH_LIVE=1 not supplied' };
if (process.env.AIO_BASELINE_FETCH_LIVE === '1') {
  try {
    const response = await fetch(liveUrl, { signal: AbortSignal.timeout(10000) });
    const body = await response.text();
    live = { status: response.ok ? 'FETCHED' : 'HTTP_ERROR', url: liveUrl, httpStatus: response.status, version: response.ok ? JSON.parse(body).version : null };
  } catch (error) {
    live = { status: 'UNAVAILABLE', url: liveUrl, version: null, error: String(error && error.message || error) };
  }
}
const baseline = {
  generatedAt: new Date().toISOString(),
  local: {
    branch: run('git', ['branch', '--show-current']),
    head: run('git', ['rev-parse', '--short', 'HEAD']),
    originMain: run('git', ['rev-parse', '--short', 'origin/main']),
    version: version.version,
    built: version.built,
    dirty: statusLines.length > 0,
    changedFiles,
  },
  live,
  worker: {
    sourceRoutePresent: /pathname === '\/anthropic'|handleAnthropic/.test(workerSource),
    sourceContract: /aioAiError/.test(workerSource),
    configuredUrlInPublicSource: (html.match(/https?:\/\/[^'"\s]+workers\.dev[^'"\s]*/g) || []).length > 0,
    deployedRevision: 'UNVERIFIED — Worker deployment is a separate operator action',
  },
  changedFileAllowlist: {
    policy: 'Only source/docs/scripts related to H2/H3 may be staged; debug.log and disposable _artifacts remain excluded unless explicitly needed.',
    files: changedFiles.filter((file) => file !== 'debug.log' && !file.startsWith('_artifacts/')),
  },
  preFixFailureRepro: {
    status: 'DOCUMENTED',
    evidence: '_context/BUG-POSTMORTEM.md P675: CDN-loss partial Chart fallback touched Chart.registry; original FULL_INIT technical SVG marker overlap reproduced across 4 viewports.',
    currentGate: 'scripts/ci-headless-tests.mjs and scripts/ci-viewport-matrix-check.mjs',
  },
  permissions: {
    pagesPush: 'not performed by this script',
    workerDeploy: 'not performed by this script',
    externalLiveEvidence: live.status === 'FETCHED' ? 'fetched' : 'pending operator/network evidence',
  },
};
mkdirSync(resolve(root, '_artifacts'), { recursive: true });
writeFileSync(artifactPath, JSON.stringify(baseline, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(baseline, null, 2));
