import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const mode = args[args.indexOf('--mode') + 1] || 'observe';
const localVersion = JSON.parse(readFileSync(join(root, 'version.json'), 'utf8')).version;
const endpoints = JSON.parse(readFileSync(join(root, 'architecture', 'worker-endpoints.json'), 'utf8'));
const proxyToml = readFileSync(join(root, 'worker', 'wrangler.proxy.toml'), 'utf8');
const proxyExpectedRevision = proxyToml.match(/^AIO_APP_REVISION\s*=\s*"([^"]+)"/m)?.[1] || null;
const pagesBase = String(process.env.AIO_LIVE_BASE || 'https://ysnle.github.io/aio-screener').replace(/\/$/, '');
const maxAgeMinutes = Number(process.env.AIO_LIVE_MAX_AGE_MIN || 360);
const attempts = mode === 'release' ? 12 : 1;
const delayMs = Number(process.env.AIO_EXTERNAL_RETRY_MS || 5000);
const reportPath = join(root, '.cache', 'aio-qa', 'external-pipeline-status.json');
mkdirSync(dirname(reportPath), { recursive: true });

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { accept: 'application/json', 'cache-control': 'no-cache', ...(options.headers || {}) },
    signal: AbortSignal.timeout(20_000)
  });
  let body = null;
  try { body = await response.json(); } catch {}
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
  return { status: response.status, body, headers: Object.fromEntries(response.headers.entries()) };
}

const ageMinutes = (value) => value ? Math.round((Date.now() - new Date(value).getTime()) / 60000) : null;
const result = { schemaVersion: 'aio-external-pipeline.v1', observedAt: null, mode, localVersion, pagesBase, status: 'UNKNOWN', checks: [], warnings: [] };
const check = (id, ok, detail, severity = 'error') => {
  result.checks.push({ id, ok: !!ok, severity, detail });
  return !!ok;
};
const compactRun = (run) => run ? { id: run.id, conclusion: run.conclusion, status: run.status, headSha: run.head_sha, url: run.html_url, updatedAt: run.updated_at } : null;

async function observeOnce() {
  result.checks = [];
  result.warnings = [];
  result.observedAt = new Date().toISOString();
  const pagesPromise = Promise.all([
    fetchJson(`${pagesBase}/version.json`),
    fetchJson(`${pagesBase}/deployment.json`),
    fetchJson(`${pagesBase}/public-config.json`),
    fetchJson(`${pagesBase}/public-data/data.json`),
    fetchJson(`${pagesBase}/public-data/screener.json`),
    fetchJson(`${pagesBase}/public-data/telegram-digest.json`),
    fetchJson(`${pagesBase}/public-data/market-snapshot.json`),
    fetchJson(`${pagesBase}/public-data/operations-status.json`),
    fetchJson(`${pagesBase}/public-data/reconciliation-status.json`)
  ]);
  const proxyPromise = fetchJson(`${String(endpoints.proxy.baseUrl).replace(/\/$/, '')}${endpoints.proxy.healthPath || '/health'}`, { headers: { Origin: 'https://ysnle.github.io' } });
  const fastPromise = fetchJson(`${String(endpoints.fastQuotes.baseUrl).replace(/\/$/, '')}${endpoints.fastQuotes.healthPath || '/health'}`);
  const githubWorkflows = {
    ci: 'ci.yml',
    pages: 'pages-deploy.yml',
    refreshMarket: 'refresh-data.yml',
    refreshScreener: 'refresh-screener.yml',
    deployProxy: 'deploy-ai-proxy.yml',
    deployFast: 'deploy-data-plane.yml'
  };
  const githubHeaders = { 'User-Agent': 'AIO-external-pipeline', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) };
  const githubPromise = Promise.allSettled(Object.entries(githubWorkflows).map(async ([id, file]) => {
    const response = await fetchJson(`https://api.github.com/repos/ysnle/aio-screener/actions/workflows/${file}/runs?per_page=5`, { headers: githubHeaders });
    const runs = response.body?.workflow_runs || [];
    return [id, { latest: runs[0] || null, completed: runs.find((run) => run.status === 'completed') || null, runs }];
  }));
  const [pages, proxy, fast, github] = await Promise.allSettled([pagesPromise, proxyPromise, fastPromise, githubPromise]);

  if (pages.status === 'fulfilled') {
    const [version, deployment, config, data, screener, telegram, snapshot, operations, reconciliation] = pages.value.map((entry) => entry.body);
    const dataAge = ageMinutes(data?.meta?.generatedAt);
    const screenerAge = ageMinutes(screener?.asOf);
    const telegramAge = ageMinutes(telegram?.generatedAt);
    result.pages = { version: version?.version || null, sourceSha: deployment?.sourceSha || null, attestationRunId: deployment?.attestationRunId || null, deploymentRunId: deployment?.deploymentRunId || null, configRevision: config?.appRevision || null, dataAgeMinutes: dataAge, screenerAgeMinutes: screenerAge, telegramAgeMinutes: telegramAge, snapshotRevision: snapshot?.revision || null };
    check('pages-deployment-identity', deployment?.schemaVersion === 'aio-deployment.v1' && /^[0-9a-f]{40}$/.test(deployment?.sourceSha || '') && deployment?.appRevision === version?.version && Number.isInteger(deployment?.attestationRunId) && Number.isInteger(deployment?.deploymentRunId), JSON.stringify(result.pages));
    if (mode === 'release') check('pages-exact-expected-sha', !!process.env.AIO_EXPECTED_SHA && deployment?.sourceSha === process.env.AIO_EXPECTED_SHA, `live=${deployment?.sourceSha || 'missing'} expected=${process.env.AIO_EXPECTED_SHA || 'missing'}`);
    check('pages-version-config', version?.version && config?.appRevision === version.version, `version=${version?.version || 'missing'} config=${config?.appRevision || 'missing'}`);
    check('pages-repository-revision', version?.version === localVersion, `live=${version?.version || 'missing'} local=${localVersion}`);
    if (mode !== 'refresh-deploy') {
      check('pages-data-freshness', Number.isFinite(dataAge) && dataAge <= maxAgeMinutes, `age=${dataAge}m max=${maxAgeMinutes}m`);
      check('pages-data-quality', Number(data?.meta?.symbolsOk) >= 70 && data?.meta?.newsOk === true && Number(data?.meta?.newsCount) >= 10, `symbols=${data?.meta?.symbolsOk || 0} news=${data?.meta?.newsCount || 0}`);
      check('pages-screener-freshness', Number.isFinite(screenerAge) && screenerAge <= 48 * 60 && Number(screener?.ok) > 0 && Number(screener?.universe) >= Number(screener?.ok), `age=${screenerAge}m ok=${screener?.ok || 0}/${screener?.universe || 0}`);
      check('pages-telegram-freshness', Number.isFinite(telegramAge) && telegramAge <= maxAgeMinutes, `age=${telegramAge}m max=${maxAgeMinutes}m`);
      check('pages-market-snapshot', snapshot?.status === 'published' && snapshot?.coverage?.tier0Required === 16 && snapshot?.coverage?.tier0Observed === 16, `status=${snapshot?.status} coverage=${snapshot?.coverage?.tier0Observed}/${snapshot?.coverage?.tier0Required}`);
      check('pages-operations', !!operations?.generatedAt && !!operations?.planes?.durable?.status && operations?.reconciliation?.categoryCount === 22, `overall=${operations?.overall || 'missing'}`);
      check('pages-reconciliation', reconciliation?.categories?.length === 22 && !!reconciliation?.revision, `categories=${reconciliation?.categories?.length || 0}`);
      check('pages-telegram-coverage', Number(telegram?.count) >= 100 && Array.isArray(telegram?.channels) && telegram.channels.length >= 3 && !telegram.channels.some((channel) => channel.error || !Number.isFinite(Number(channel.lastPostId))), `count=${telegram?.count || 0} channels=${telegram?.channels?.length || 0}`);
      if (!data?.meta?.fearGreedOk) result.warnings.push('live Fear & Greed provider is degraded; static fallback is active');
      if (!data?.meta?.fredHasKey || !data?.meta?.fredFetchOk) result.warnings.push('live FRED enrichment is unavailable or degraded');
      if (!data?.meta?.marketAnalysisOk) result.warnings.push('live LLM market analysis is unavailable; typed fallback is active');
    }
  } else {
    check('pages-fetch', false, pages.reason?.message || String(pages.reason));
  }

  if (mode !== 'refresh-deploy') {
    if (proxy.status === 'fulfilled') {
      const health = proxy.value.body;
      result.proxy = { revision: health?.revision || null, sourceSha: health?.sourceSha || null, ready: health?.ai?.ready === true, authority: health?.ai?.authorityJurisdiction || null };
      check('proxy-health', health?.ok === true && health?.ai?.configured === true && health?.ai?.quotaConfigured === true && health?.ai?.authorityReady === true && health?.ai?.authorityJurisdiction === 'us' && health?.ai?.ready === true, JSON.stringify(result.proxy));
      check('proxy-exact-source-identity', /^[0-9a-f]{40}$/.test(health?.sourceSha || ''), `sourceSha=${health?.sourceSha || 'missing'}`);
      check('proxy-source-revision', !proxyExpectedRevision || health?.revision === proxyExpectedRevision, `live=${health?.revision || 'missing'} source=${proxyExpectedRevision || 'missing'}`);
    } else check('proxy-fetch', false, proxy.reason?.message || String(proxy.reason));

    if (fast.status === 'fulfilled') {
      const health = fast.value.body;
      const coverage = health?.coverage || health?.heartbeat?.coverage || {};
      const required = Number(coverage.tier0Required ?? coverage.required);
      const observed = Number(coverage.tier0Observed ?? coverage.observed);
      result.fast = { revision: health?.revision || null, sourceSha: health?.sourceSha || null, coverage: `${observed}/${required}` };
      check('fast-plane-health', health?.ok === true && required === 16 && observed === required, JSON.stringify(result.fast));
      check('fast-plane-exact-source-identity', /^[0-9a-f]{40}$/.test(health?.sourceSha || ''), `sourceSha=${health?.sourceSha || 'missing'}`);
    } else check('fast-plane-fetch', false, fast.reason?.message || String(fast.reason));

    if (github.status === 'fulfilled') {
      result.github = {};
      const observedWorkflowRuns = {};
      github.value.forEach((entry, index) => {
        const workflowId = Object.keys(githubWorkflows)[index];
        if (entry.status !== 'fulfilled') {
          result.warnings.push(`GitHub ${workflowId} observation unavailable: ${entry.reason?.message || String(entry.reason)}`);
          return;
        }
        const [id, workflowRuns] = entry.value;
        observedWorkflowRuns[id] = workflowRuns;
        const latest = workflowRuns.latest;
        const run = workflowRuns.completed;
        result.github[id] = {
          latest: compactRun(latest),
          lastCompleted: compactRun(run)
        };
        const isCurrentReleaseRun = mode === 'release' && id === 'pages' && latest?.status === 'in_progress' && (!process.env.GITHUB_RUN_ID || String(latest.id) === String(process.env.GITHUB_RUN_ID));
        const severity = mode === 'release' && !['ci', 'pages'].includes(id) ? 'warning' : 'error';
        check(`github-${id}-latest-completed`, run?.conclusion === 'success' || isCurrentReleaseRun, run ? `conclusion=${run.conclusion} run=${run.html_url}${latest?.status === 'in_progress' ? ` active=${latest.html_url}` : ''}` : (isCurrentReleaseRun ? `current release=${latest.html_url}` : 'no completed workflow run'), severity);
      });
      if (result.pages?.sourceSha && result.pages?.attestationRunId) {
        const attestedCi = observedWorkflowRuns.ci?.runs?.find?.((run) => Number(run.id) === Number(result.pages.attestationRunId));
        check('pages-source-matches-attested-ci', attestedCi?.conclusion === 'success' && attestedCi?.head_sha === result.pages.sourceSha, `deployment=${result.pages.sourceSha} attestationRun=${result.pages.attestationRunId} observed=${attestedCi?.head_sha || 'missing'} conclusion=${attestedCi?.conclusion || 'missing'}`);
        const deploymentRun = observedWorkflowRuns.pages?.runs?.find?.((run) => Number(run.id) === Number(result.pages.deploymentRunId));
        const currentDeploymentRun = mode === 'release' && deploymentRun?.status === 'in_progress' && (!process.env.GITHUB_RUN_ID || String(deploymentRun.id) === String(process.env.GITHUB_RUN_ID));
        check('pages-deployment-run-provenance', deploymentRun?.conclusion === 'success' || currentDeploymentRun, `deploymentRun=${result.pages.deploymentRunId} conclusion=${deploymentRun?.conclusion || 'missing'} status=${deploymentRun?.status || 'missing'}`);
      }
    } else result.warnings.push(`GitHub Actions observation unavailable: ${github.reason?.message || String(github.reason)}`);
  } else if (github.status === 'fulfilled') {
    const ciEntry = github.value[0];
    if (ciEntry?.status === 'fulfilled') {
      const [, workflowRuns] = ciEntry.value;
      const completed = workflowRuns.completed;
      result.github = { ci: { latest: compactRun(workflowRuns.latest), lastCompleted: compactRun(completed) } };
      check('github-ci-latest-completed', completed?.conclusion === 'success', completed ? `conclusion=${completed.conclusion} run=${completed.html_url}` : 'no completed CI run');
    } else result.warnings.push(`GitHub CI observation unavailable: ${ciEntry?.reason?.message || String(ciEntry?.reason || 'unknown')}`);
  }

  const failed = result.checks.filter((item) => !item.ok && item.severity === 'error');
  result.status = failed.length ? 'FAIL' : 'PASS';
  return failed;
}

let failures = [];
for (let attempt = 1; attempt <= attempts; attempt += 1) {
  failures = await observeOnce();
  result.attempt = attempt;
  if (!failures.length) break;
  if (attempt < attempts) await sleep(delayMs);
}
writeFileSync(reportPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
console.log(`[external-pipeline] report=${reportPath}`);
if (failures.length && mode !== 'observe') process.exit(1);
