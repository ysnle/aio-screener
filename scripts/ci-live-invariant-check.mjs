// R290: standing invariants re-verified against the LIVE deployed site on a schedule
// independent of new commits. Source gates (ci-structural-check.mjs, ci-runtime-contract-check.mjs)
// prove correctness of the repository at commit time; they cannot prove GitHub Pages/CDN is still
// *serving* that same correct state days later with zero new commits in between. P638/C1 (stale
// deployed Cloudflare Worker route) and P572/R263 (data commits landing while deploy silently
// stopped publishing) both had a fully correct repository while the live site diverged — no local
// gate could have caught either, because nothing in the files those gates read had changed.
//
// Keep this list small and grow it only for root causes a local gate structurally cannot see
// (deploy/CDN/cache/operator-config drift). Do not duplicate checks ci-runtime-contract-check.mjs
// or ci-structural-check.mjs already enforce at commit time — that would double-maintain the same
// fact against two independently-drifting lists. See _context/RULES.md R290.

import { evaluateLiveHeader, resolveLiveHeaderPolicy } from './live-header-policy.mjs';

const BASE = String(process.env.AIO_LIVE_BASE || 'https://ysnle.github.io/aio-screener').replace(/\/$/, '');
const errors = [];
const warnings = [];
const check = (label, condition, detail = '') => {
  if (!condition) errors.push(label + (detail ? ': ' + detail : ''));
};
const warn = (label, condition, detail = '') => {
  if (!condition) warnings.push(label + (detail ? ': ' + detail : ''));
};

async function fetchText(path) {
  const r = await fetch(`${BASE}/${path}`, { headers: { 'cache-control': 'no-cache' } });
  if (!r.ok) throw new Error(`${path} HTTP ${r.status}`);
  return r.text();
}

async function fetchResponse(path) {
  const r = await fetch(`${BASE}/${path}`, { headers: { 'cache-control': 'no-cache' } });
  if (!r.ok) throw new Error(`${path} HTTP ${r.status}`);
  return r;
}

async function main() {
  let html, core, data, ui, chat, glossary, versionJson, deployment, publicConfig, indexResponse;
  try {
    [indexResponse, core, data, ui, chat, glossary] = await Promise.all([
      fetchResponse('index.html'),
      fetchText('js/aio-core.js'),
      fetchText('js/aio-data.js'),
      fetchText('js/aio-ui.js'),
      fetchText('js/aio-chat.js'),
      fetchText('js/aio-glossary.js'),
    ]);
    html = await indexResponse.text();
    versionJson = JSON.parse(await fetchText('version.json'));
    deployment = JSON.parse(await fetchText('deployment.json'));
    publicConfig = JSON.parse(await fetchText('public-config.json'));
  } catch (e) {
    console.error(`live-invariant-check: could not fetch deployed site — ${e.message}`);
    process.exit(1);
    return;
  }

  // Predicate 1 (P572/R263 class): live index.html script cachebusters must match live
  // version.json. Catches a deploy that published some assets but not others, or a CDN edge
  // still serving an old index.html/js mix after a newer commit landed.
  const version = versionJson.version;
  check('live deployment exposes an exact source SHA', deployment?.schemaVersion === 'aio-deployment.v1' && /^[0-9a-f]{40}$/.test(deployment?.sourceSha || '') && deployment?.appRevision === version && Number.isInteger(deployment?.attestationRunId) && Number.isInteger(deployment?.deploymentRunId), JSON.stringify(deployment || {}));
  const versionNum = String(version).replace(/^v/, '');
  const staticBusters = [...html.matchAll(/<script\s+src="\.\/js\/aio-[^"]+\?v=([\d.]+)"/g)].map((m) => m[1]);
  check(
    'live index.html script cachebusters match live version.json',
    staticBusters.length >= 5 && staticBusters.every((v) => v === versionNum),
    `version.json=${version}, found busters=${staticBusters.join(',') || 'none'}`
  );

  // Public AI is a consumer outcome: a fresh browser must discover the exact
  // healthy Worker route from the deployed config. A healthy hidden Worker is
  // not a usable public chat path. When the live observation is unavailable,
  // the producer may intentionally publish an explicit personal-key-only
  // state; that is safer than leaving a stale shared route discoverable.
  check('live public AI config matches the live app revision', publicConfig?.appRevision === version, `config=${publicConfig?.appRevision}, version=${version}`);
  const liveWorkerUrl = String(publicConfig?.ai?.workerUrl || '').trim().replace(/\/+$/, '');
  const liveRoutePublished = /^https:\/\//i.test(liveWorkerUrl);
  const liveRouteDisabled = !liveWorkerUrl
    && publicConfig?.ai?.routeStatus === 'DISABLED'
    && publicConfig?.ai?.serverMode === 'personal-key-only'
    && publicConfig?.ai?.chatPolicy === 'personal-key-only'
    && typeof publicConfig?.ai?.routeReason === 'string'
    && publicConfig.ai.routeReason.length > 0
    && publicConfig?.ai?.routeEvidence?.status === 'OPERATOR_REQUIRED';
  check('live public AI config exposes an HTTPS shared fallback or an explicit disabled state', liveRoutePublished
    ? publicConfig?.ai?.routeStatus === 'PUBLISHED'
      && publicConfig?.ai?.routeEvidence?.status === 'CURRENT'
      && publicConfig?.ai?.serverMode === 'shared-worker-fallback'
      && publicConfig?.ai?.chatPolicy === 'personal-key-or-public-worker'
    : liveRouteDisabled, JSON.stringify(publicConfig?.ai || {}));
  if (liveRoutePublished) {
    try {
      const workerUrl = liveWorkerUrl;
      const healthResponse = await fetch(`${workerUrl}${publicConfig.ai.healthPath || '/health'}`, { headers: { Origin: 'https://ysnle.github.io', 'cache-control': 'no-cache' } });
      const health = await healthResponse.json();
      check('live public AI Worker deep health is ready', healthResponse.ok && health?.schemaVersion === 'aio-worker-health.v1' && health?.ai?.configured === true && health?.ai?.quotaConfigured === true && health?.ai?.authorityReady === true && health?.ai?.authorityJurisdiction === 'us' && health?.ai?.ready === true, `HTTP ${healthResponse.status} ${JSON.stringify(health?.ai || {})}`);
      check('live public AI Worker exposes its exact source SHA', /^[0-9a-f]{40}$/.test(health?.sourceSha || ''), `sourceSha=${health?.sourceSha || 'missing'}`);
      check('live public AI Worker advertises a positive output cap', Number(health?.ai?.maxTokens) > 0, `maxTokens=${health?.ai?.maxTokens}`);
      check('live public AI Worker CORS matches Pages origin', healthResponse.headers.get('access-control-allow-origin') === 'https://ysnle.github.io', `observed=${healthResponse.headers.get('access-control-allow-origin') || 'missing'}`);
    } catch (error) {
      check('live public AI Worker health request succeeds', false, error?.message || String(error));
    }
  }

  // Predicate 3: compatible edge headers must be observed on the actual response.
  // GitHub Pages does not consume repository `_headers`, so the current github.io
  // origin cannot satisfy this at source level. Keep that readiness criterion
  // OPERATOR_REQUIRED without making the independent data/deploy watchdog permanently
  // red. A custom edge can set LIVE_HEADER_POLICY=enforce to restore hard failure.
  const headerPolicy = resolveLiveHeaderPolicy(BASE, process.env.LIVE_HEADER_POLICY);
  const requiredLiveHeaders = {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'content-security-policy': 'frame-ancestors \'none\''
  };
  for (const [name, expected] of Object.entries(requiredLiveHeaders)) {
    const actual = indexResponse.headers.get(name) || '';
    const result = evaluateLiveHeader(headerPolicy, actual, expected);
    if (result.outcome === 'FAIL') check(`live response header ${name}`, false, `observed=${actual || 'missing'}`);
    else if (result.outcome === 'WARN') warn(`operator-required live response header ${name}`, false, `observed=${actual || 'missing'}; policy=${headerPolicy}`);
  }

  // Predicate 2 (P605/R280 class): re-run the exact same cross-file top-level function
  // shadow-declaration scan that ci-structural-check.mjs runs locally, against the LIVE
  // served bytes instead. A source-correct repo could still ship a stale/mixed bundle.
  // Mirrors ci-structural-check.mjs's RUNTIME_SCRIPT_FILES set and TOP_LEVEL_FN_RE exactly;
  // if that file's KNOWN_SHADOW_ALLOWLIST ever becomes non-empty, mirror it here too.
  const RUNTIME_SCRIPT_FILES = {
    'index.html': html,
    'js/aio-core.js': core,
    'js/aio-data.js': data,
    'js/aio-ui.js': ui,
    'js/aio-chat.js': chat,
    'js/aio-glossary.js': glossary,
  };
  const TOP_LEVEL_FN_RE = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
  const fnOwners = new Map();
  for (const [file, src] of Object.entries(RUNTIME_SCRIPT_FILES)) {
    const namesInFile = new Set();
    for (const m of src.matchAll(TOP_LEVEL_FN_RE)) namesInFile.add(m[1]);
    for (const name of namesInFile) {
      if (!fnOwners.has(name)) fnOwners.set(name, []);
      fnOwners.get(name).push(file);
    }
  }
  const shadowed = [...fnOwners.entries()].filter(([, files]) => files.length > 1);
  check(
    'no top-level function name is declared in more than one LIVE runtime script file (R280, live re-check)',
    shadowed.length === 0,
    shadowed.length ? shadowed.map(([name, files]) => `${name} in [${files.join(', ')}]`).join('; ') : ''
  );

  if (errors.length) {
    console.error('Live invariant check failed:');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
    return;
  }
  if (warnings.length) {
    console.warn('Live invariant operator warnings:');
    for (const warning of warnings) console.warn(`  - ${warning}`);
  }
  console.log(`Live invariant check OK (${BASE}, version=${version}, headerPolicy=${headerPolicy}, warnings=${warnings.length}).`);
}

main();
