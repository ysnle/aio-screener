#!/usr/bin/env node
// Producer dry run (pipeline redesign, 2026-10-19). The data producer's run order (scripts/fetch-data.mjs main) had no
// executable test: the gates import its pure helpers and read its source text, so a renamed variable or a missing
// import inside main() surfaced only in the scheduled refresh. This gate runs main() end to end in a scratch copy of
// the repository with the network stubbed (scripts/lib/producer-dry-run-fetch.mjs): Yahoo answers synthetic charts,
// every other provider fails. It asserts the run completes, takes each plane's failure path without aborting, and
// writes a data.json that keeps the published contract. No credentials are passed and the working tree is untouched.
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const check = (label, ok, detail = '') => { if (!ok) failures.push(`${label}${detail ? ` :: ${detail}` : ''}`); };

const scratch = mkdtempSync(path.join(tmpdir(), 'aio-producer-dry-run-'));
try {
  for (const dir of ['scripts', 'src', 'architecture']) cpSync(path.join(root, dir), path.join(scratch, dir), { recursive: true });
  for (const file of ['package.json', 'public-config.json', 'version.json']) {
    try { cpSync(path.join(root, file), path.join(scratch, file)); } catch { /* optional */ }
  }
  try { symlinkSync(path.join(root, 'node_modules'), path.join(scratch, 'node_modules'), 'dir'); } catch { /* not needed by the producer */ }
  // Top-level artifacts are copied (the run rewrites them); the large knowledge trees are linked read-only.
  mkdirSync(path.join(scratch, 'public-data'));
  for (const entry of readdirSync(path.join(root, 'public-data'))) {
    const from = path.join(root, 'public-data', entry);
    // v58.51: Windows needs admin rights for a 'dir' symlink; a junction links a local directory without them.
    if (statSync(from).isDirectory()) symlinkSync(from, path.join(scratch, 'public-data', entry), process.platform === 'win32' ? 'junction' : 'dir');
    else cpSync(from, path.join(scratch, 'public-data', entry));
  }
  const before = JSON.parse(readFileSync(path.join(scratch, 'public-data/data.json'), 'utf8'));
  // The shared AI Worker is configured with an unreachable host (the stub answers 404), so every AI step runs its
  // request, failure and fallback path and the run's AI usage receipt has something to count.
  const env = { PATH: process.env.PATH, HOME: process.env.HOME, TZ: 'UTC', NODE_ENV: 'test', GITHUB_RUN_ID: 'dry-run',
    AI_PROXY_URL: 'https://ai-proxy.dry-run.invalid/', AIO_AUTOMATION_TOKEN: 'dry-run-automation-token-'.padEnd(40, 'x') };
  const started = Date.now();
  const run = spawnSync(process.execPath, ['--import', './scripts/lib/producer-dry-run-fetch.mjs', 'scripts/fetch-data.mjs'], {
    cwd: scratch, env, encoding: 'utf8', timeout: 240000, maxBuffer: 64 * 1024 * 1024
  });
  const log = `${run.stdout || ''}\n${run.stderr || ''}`;
  check('P1262 the producer run completes', run.status === 0, `exit=${run.status} signal=${run.signal || ''} :: ${log.slice(-1600)}`);
  check('P1262 the producer run reports completion', /\[fetch-data\] 완료:/.test(log), log.slice(-600));
  check('P1262 no plane aborted the run with a programming error', !/(ReferenceError|TypeError|SyntaxError)\b/.test(log), (log.match(/.*(ReferenceError|TypeError|SyntaxError).*/) || [''])[0]);
  if (run.status === 0) {
    const data = JSON.parse(readFileSync(path.join(scratch, 'public-data/data.json'), 'utf8'));
    const meta = data.meta || {};
    check('P1256 data.json was rewritten by this run', Date.parse(meta.generatedAt) >= started - 1000, meta.generatedAt);
    check('P715/P719 the published quote contract holds', Array.isArray(data.quotes) && data.quotes.length === 0 && meta.quotesPublished === false);
    // The synthetic charts are not market-shaped, so a few quotes may fail the sanity band; the watchdog floor is 70.
    check('P1256 every quote plane symbol is accounted for', Number(meta.symbolsOk) >= 70 && Number(meta.symbolsOk) + Number(meta.symbolsFail) === meta.domainReceipts?.['market-quotes']?.counts?.eligible, `${meta.symbolsOk}/${meta.symbolsFail}`);
    for (const key of ['macro', 'fearGreed', 'putCall', 'marketSurveys', 'news', 'newsIntraday', 'providerCrossChecks', 'policyRates', 'rotationHistory']) check(`P1256 data.json keeps ${key}`, key in data);
    const receipts = meta.domainReceipts || {};
    for (const domain of ['market-quotes', 'news', 'macro-fred', 'macro-bls', 'macro-bea', 'treasury-curve', 'surveys-aaii', 'options-put-call']) check(`P1256 domain receipt ${domain} is published`, !!receipts[domain]);
    check('P1256 a failed news plane keeps the previous bundle', Array.isArray(data.news) && data.news.length === (Array.isArray(before.news) ? before.news.length : 0), `${data.news?.length} vs ${before.news?.length}`);
    check('P565 the FRED plane reports its missing key instead of a fresh cycle', meta.fredHasKey === false && meta.fredFetchOk === false);
    // A provider failure either keeps the last verified reading (P1719, with the reason) or publishes the blocked reason.
    check('P1594 the market analysis records why it did not run', (meta.marketAnalysisOk === false && typeof meta.marketAnalysisReason === 'string' && meta.marketAnalysisReason.length > 0) || (meta.marketAnalysisOk === true && typeof meta.marketAnalysisRetained?.reason === 'string'), JSON.stringify({ ok: meta.marketAnalysisOk, reason: meta.marketAnalysisReason, retained: meta.marketAnalysisRetained, ai: meta.aiUsage?.purposes?.['market-analysis'] }));
    const ai = meta.aiUsage || {};
    const reading = ai.purposes?.['market-analysis'] || {};
    check('P1256/P1594 the run publishes its AI usage receipt', ai.schemaVersion === 'aio-pipeline-ai-usage.v1' && ai.configured === true, JSON.stringify(ai).slice(0, 300));
    check('P1256/P1594 the market reading counts its requests and failure reasons', reading.requests >= 1 && reading.ok === 0 && reading.failures?.['provider-http-404'] === reading.requests && ai.sharedRequests >= reading.requests, JSON.stringify(reading));
    check('P1256/P1594 every AI step records an outcome', ['market-analysis', 'headline-translation', 'slot-summary'].every((purpose) => typeof ai.purposes?.[purpose]?.outcome === 'string'), JSON.stringify(ai.purposes || {}).slice(0, 400));
    check('P1256 the cycle status is derived', typeof meta.cycleStatus === 'string' && meta.cycleStatus !== 'PENDING', meta.cycleStatus);
    const ops = JSON.parse(readFileSync(path.join(scratch, 'public-data/operations-status.json'), 'utf8'));
    check('P1256 operations-status.json was rebuilt for this run', JSON.stringify(ops).includes(meta.generatedAt), 'generatedAt not referenced');
  }

  // The screener lanes (refresh-screener.yml) run the same entry point with SCREENER_ONLY / SCREENER_EXTENDED. The
  // scratch universes are cut to a sample so the lanes run in seconds; the code path is the full one.
  const sampleUniverse = (file, size) => {
    const full = path.join(scratch, 'public-data', file);
    const parsed = JSON.parse(readFileSync(full, 'utf8'));
    const universe = Array.isArray(parsed.universe) ? parsed.universe : [];
    const korea = universe.filter((row) => /\.(KS|KQ)$/.test(String(row?.sym || row?.symbol || ''))).slice(0, 3);
    parsed.universe = [...universe.filter((row) => !korea.includes(row)).slice(0, size), ...korea];
    writeFileSync(full, JSON.stringify(parsed));
    return parsed.universe.length;
  };
  const coreSample = sampleUniverse('screener-universe.json', 40);
  const extendedSample = sampleUniverse('screener-extended-universe.json', 40);
  for (const [lane, laneEnv, artifact] of [
    ['screener', { SCREENER_ONLY: '1', SCREENER_ENRICH: '1' }, 'screener.json'],
    ['screener-extended', { SCREENER_EXTENDED: '1', SCREENER_EXTENDED_FORCE: '1' }, 'screener-extended.json']
  ]) {
    const laneStarted = Date.now();
    const laneRun = spawnSync(process.execPath, ['--import', './scripts/lib/producer-dry-run-fetch.mjs', 'scripts/fetch-data.mjs'], {
      cwd: scratch, env: { ...env, ...laneEnv }, encoding: 'utf8', timeout: 240000, maxBuffer: 64 * 1024 * 1024
    });
    const laneLog = `${laneRun.stdout || ''}\n${laneRun.stderr || ''}`;
    check(`P1262 the ${lane} lane completes`, laneRun.status === 0, `exit=${laneRun.status} :: ${laneLog.slice(-1200)}`);
    check(`P1262 the ${lane} lane raises no programming error`, !/(ReferenceError|TypeError|SyntaxError)\b/.test(laneLog), (laneLog.match(/.*(ReferenceError|TypeError|SyntaxError).*/) || [''])[0]);
    if (laneRun.status === 0) {
      const written = JSON.parse(readFileSync(path.join(scratch, 'public-data', artifact), 'utf8'));
      const stamp = Date.parse(written.asOf || written.computedAt || written.generatedAt || '');
      check(`P1256 the ${lane} lane rewrote ${artifact}`, stamp >= laneStarted - 1000, `${written.asOf || written.computedAt || written.generatedAt} (sample ${lane === 'screener' ? coreSample : extendedSample})`);
      // P1256 (pipeline redesign 1): lane modules live one folder deeper than fetch-data.mjs, so a module-relative
      // '../public-data' path resolved to scripts/public-data and the S&P weights and candidate archive went missing silently.
      if (lane === 'screener') check('P1256 the screener lane reads the S&P 500 weights from public-data', !!written.indexWeights && !!written.breadth?.segments?.sp500, `indexWeights=${!!written.indexWeights} sp500=${!!written.breadth?.segments?.sp500}`);
      check(`P1256 the ${lane} lane writes nothing under scripts/public-data`, !existsSync(path.join(scratch, 'scripts', 'public-data')));
    }
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

if (failures.length) {
  console.error('Producer dry run failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('Producer dry run passed: the market, screener and extended lanes complete on a stubbed network and keep their artifact contracts.');
