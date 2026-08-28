import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const exists = (path) => existsSync(join(root, path));

const errors = [];
const check = (label, condition, detail = '') => {
  if (!condition) errors.push(label + (detail ? ': ' + detail : ''));
};
const extractNodeHeredocs = (text) => {
  const blocks = [];
  const re = /node(\s+--input-type=module)? - <<'NODE'\r?\n([\s\S]*?)\r?\n\s*NODE/g;
  let match;
  while ((match = re.exec(text))) {
    blocks.push({ source: match[2].replace(/^\s{10}/gm, ''), module: Boolean(match[1]) });
  }
  return blocks;
};
const checkNodeHeredocSyntax = (label, text) => {
  const blocks = extractNodeHeredocs(text);
  check(`${label} has Node heredoc blocks`, blocks.length > 0);
  blocks.forEach((block, index) => {
    if (block.module) {
      check(`${label} Node heredoc ${index + 1} uses ESM imports, not CommonJS require`, !/\brequire\s*\(/.test(block.source), 'module heredocs must use import statements');
      const result = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: block.source, encoding: 'utf8' });
      check(`${label} Node heredoc ${index + 1} parses`, result.status === 0, (result.stderr || '').trim());
      return;
    }
    try { new Function('require', 'process', block.source); }
    catch (error) { check(`${label} Node heredoc ${index + 1} parses`, false, error.message); }
  });
};
// P584/R265/C1: extract a top-level `function NAME(...) { ... }` by brace-depth counting (not a
// regex bound) so nested control-flow braces inside the function don't truncate the extraction.
const extractFunctionSource = (text, name) => {
  const sig = `function ${name}(`;
  const start = text.indexOf(sig);
  if (start < 0) return null;
  const braceStart = text.indexOf('{', start);
  if (braceStart < 0) return null;
  let depth = 0;
  for (let i = braceStart; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
};

const refresh = read('.github/workflows/refresh-data.yml');
const screenerRefresh = read('.github/workflows/refresh-screener.yml');
const watchdog = read('.github/workflows/data-watchdog.yml');
const ci = read('.github/workflows/ci.yml');
const externalPipeline = read('scripts/ci-external-pipeline-check.mjs');
const qaPipeline = JSON.parse(read('architecture/qa-pipeline.json'));
const watchdogScripts = (qaPipeline.profiles?.watchdog || []).flatMap((group) => qaPipeline.groups?.[group]?.gates || []).map((gate) => gate.script);
const fetchData = read('scripts/fetch-data.mjs');
const fetchTelegram = read('scripts/fetch-telegram-digest.mjs');
const reconciliationBuilder = read('scripts/build-reconciliation-status.mjs');
const core = read('js/aio-core.js');
const data = read('js/aio-data.js');
const chat = read('js/aio-chat.js');
const tests = read('js/aio-tests.js');
const screenerPage = read('src/ui/pages/screener.js');
const screenerProvider = read('src/data/providers/screener.js');
const newsPage = read('src/ui/pages/news.js');
const marketPage = read('src/ui/pages/market.js');
const html = read('index.html');
const qa = read('_context/QA-CHECKLIST.md');
const rules = read('_context/RULES.md');
const postmortem = read('_context/BUG-POSTMORTEM.md');
const marketNewsStart = html.indexOf('id="page-market-news"');
const marketNewsEnd = marketNewsStart >= 0 ? html.indexOf('<!-- ═══════════════ PAGE:', marketNewsStart + 1) : -1;
const marketNewsHtml = marketNewsStart >= 0 ? html.slice(marketNewsStart, marketNewsEnd > marketNewsStart ? marketNewsEnd : marketNewsStart + 9000) : '';
const newsEmptyStart = data.indexOf('현재 조건에서');
const newsEmptyBlock = newsEmptyStart >= 0 ? data.slice(newsEmptyStart, newsEmptyStart + 1400) : '';

check('refresh workflow runs twice hourly', /cron:\s*'17,47 \* \* \* \*'/.test(refresh));
check('refresh workflow has write permission and no cancel-in-progress', /contents:\s*write/.test(refresh) && /cancel-in-progress:\s*false/.test(refresh));
check('refresh workflow fetches market data with free/official optional secrets', /node scripts\/fetch-data\.mjs/.test(refresh) && /FRED_API_KEY/.test(refresh) && !/FMP_API_KEY/.test(refresh) && /ANTHROPIC_API_KEY/.test(refresh));
check('refresh workflow fetches Telegram digest artifact', /node scripts\/fetch-telegram-digest\.mjs --days=(?:7|14) --out=public-data\/telegram-digest\.json/.test(refresh));
check('core refresh workflow commits core public-data artifacts', /git add public-data\/data\.json public-data\/history\.json/.test(refresh) && /public-data\/telegram-digest\.json/.test(refresh) && /public-data\/score-backtest-history\.json/.test(refresh));
check('Telegram producer atomically synchronizes and stages Atlas lineage', /atlasIndex\.telegramObservedLineage\s*=\s*lineageCount/.test(fetchTelegram) && /public-data\/atlas\/index\.json/.test(refresh));
check('screener refresh is an independent six-hour validated publish job', /cron:\s*'23 \*\/6 \* \* \*'/.test(screenerRefresh) && /SCREENER_ONLY:\s*'1'/.test(screenerRefresh) && /SCREENER_ENRICH:\s*'1'/.test(screenerRefresh) && /validate-screener-artifact\.mjs/.test(screenerRefresh));
check('screener producer never promotes filing-only records into the factor row map', /if \(!data\[sym\]\) continue;/.test(fetchData) && !/else data\[sym\] = fmpResult\.data\[sym\]/.test(fetchData));
check('screener workflow default automation uses only free SEC path', /fetch-sec-fundamentals\.mjs/.test(screenerRefresh) && /SEC_USER_AGENT/.test(screenerRefresh) && /sec-fundamentals\.json/.test(screenerRefresh) && !/FMP_API_KEY/.test(screenerRefresh));
check('trading-score backtest harness is wired into the refresh pipeline', /runBacktest as runTradingScoreBacktest/.test(read('scripts/fetch-data.mjs')) && exists('scripts/backtest-trading-score.mjs'));
check('refresh workflow publishes status summary', /GITHUB_STEP_SUMMARY/.test(refresh) && /fearGreedOk/.test(refresh) && /fredFetchOk/.test(refresh) && /marketAnalysisOk/.test(refresh));
check('refresh summary exposes automated AAII relay and same-date Treasury producer states', /AAII weekly/.test(refresh) && /aaiiRelayUsed/.test(refresh) && /Treasury curve/.test(refresh) && /treasuryObservedAt/.test(refresh));
check('core refresh validates evidence-derived reconciliation before commit', /ci-reconciliation-contract-check\.mjs/.test(refresh) && refresh.indexOf('ci-reconciliation-contract-check.mjs') < refresh.indexOf('Commit refreshed public data if changed'));
check('screener refresh atomically rebuilds and commits reconciliation and operations status', /build-reconciliation-status\.mjs/.test(screenerRefresh) && /build-operations-status\.mjs/.test(screenerRefresh) && /public-data\/reconciliation-status\.json/.test(screenerRefresh) && /public-data\/operations-status\.json/.test(screenerRefresh));
check('refresh workflow module summary uses ESM fs import', /node --input-type=module - <<'NODE'[\s\S]*import fs from 'node:fs';/.test(refresh) && !/node --input-type=module - <<'NODE'[\s\S]*const fs = require\(/.test(refresh));
checkNodeHeredocSyntax('refresh-data workflow', refresh);

check('watchdog runs the aggregate local+external profile', /qa-runner\.mjs watchdog --no-cache/.test(watchdog) && ['watchdog-local', 'external'].every((group) => qaPipeline.profiles?.watchdog?.includes(group)));
check('watchdog checks data and Telegram freshness', /pages-data-freshness/.test(externalPipeline) && /pages-telegram-freshness/.test(externalPipeline));
check('watchdog checks live Telegram channel coverage', /pages-telegram-coverage/.test(externalPipeline) && /lastPostId/.test(externalPipeline));
check('watchdog freshness threshold tolerates transient Actions lag', /default:\s*'360'/.test(watchdog) && /AIO_LIVE_MAX_AGE_MIN:/.test(watchdog));
check('watchdog has core quality floors for public data', /symbolsOk\)\s*>=\s*70/.test(externalPipeline) && /newsCount\)\s*>=\s*10/.test(externalPipeline) && /telegram\?\.count\)\s*>=\s*100/.test(externalPipeline));
check('watchdog reports optional degraded services', /fearGreedOk/.test(externalPipeline) && /fredFetchOk/.test(externalPipeline) && /marketAnalysisOk/.test(externalPipeline));
check('watchdog checks screener artifact health', /pages-screener-freshness/.test(externalPipeline) && /48 \* 60/.test(externalPipeline));
check('watchdog retains local data contracts', ['scripts/ci-market-snapshot-contract-check.mjs', 'scripts/ci-operations-status-check.mjs', 'scripts/ci-reconciliation-contract-check.mjs', 'scripts/ci-data-refresh-audit.mjs'].every((script) => watchdogScripts.includes(script)));

check('fetch-data writes data/history/screener artifacts', /public-data\/data\.json/.test(fetchData) && /public-data\/history\.json/.test(fetchData) && /public-data\/screener\.json/.test(fetchData));
check('fetch-data collects quotes, F&G, FRED, news, LLM analysis', /fetchQuote/.test(fetchData) && /fetchFearGreed/.test(fetchData) && /fetchFred/.test(fetchData) && /fetchNews/.test(fetchData) && /genMarketAnalysis/.test(fetchData));
check('fetch-data retries RSS and broadens provider window before canonical cycle filtering', /_fetchRssWithRetry/.test(fetchData) && /when%3A7d/.test(fetchData) && /ts >= cycle\.startMs/.test(fetchData) && /ts < cycle\.endMs/.test(fetchData));
check('fetch-data separates FRED configured vs fetched', /fredHasKey/.test(fetchData) && /fredFetchOk/.test(fetchData) && /macroKeyCount/.test(fetchData));
check('fetch-data exposes marketAnalysisOk', /marketAnalysisOk/.test(fetchData));
check('market analysis requires typed metric evidence and identity validation', /buildMarketAnalysisEvidence/.test(fetchData) && /metricEvidence/.test(fetchData) && /metric-identity-mismatch:vix-vs-fear-greed/.test(fetchData) && /metric-value-mismatch/.test(fetchData));
check('market analysis is structured, evidence-bound, and fail-closed with a typed fallback', /schemaVersion:\s*'market-analysis\.v2'/.test(fetchData) && /claims/.test(fetchData) && /evidenceIds/.test(fetchData) && /buildMarketAnalysisFallback/.test(fetchData) && /marketAnalysisOk\s*=\s*marketAnalysis\.status === 'verified'/.test(fetchData));
check('market analysis news selection uses independent clusters instead of a blind first-N slice', /buildMarketAnalysisNewsEvidence/.test(fetchData) && /independenceKey/.test(fetchData) && /clusters/.test(fetchData) && !/data\.news\)\.slice\(0, 8\)/.test(fetchData));
check('news artifacts expose source tier, content depth, event time, and independence lineage', /sourceTierLabel/.test(fetchData) && /contentDepth:\s*'headline-only'/.test(fetchData) && /eventTime:/.test(fetchData) && /independenceKey:/.test(fetchData));
check('market-analysis news evidence excludes headline-only rows and requires article content', /isMarketAnalysisNewsEligible/.test(fetchData) && /MARKET_ANALYSIS_NEWS_HEADLINE_DEPTHS/.test(fetchData) && /body\.length\s*>=\s*40/.test(fetchData) && /causalEvidence\s*=\s*buildMarketAnalysisNewsEvidence\(data\)/.test(fetchData));
check('server Treasury curve bridge projects every dated maturity to browser consumers', /AIO_SERVER_TREASURY_FIELDS/.test(data) && ['dgs2', 'dgs5', 'dgs10', 'dgs20', 'dgs30', 't10y2y'].every((field) => new RegExp(`field:\\s*'${field}'`).test(data)) && /window\._fredData\s*=\s*fred/.test(data) && /DATA_SNAPSHOT\[snapshotKey\]/.test(data) && /globalThis\[definition\.runtimeKey\]/.test(data) && /window\._live5Y/.test(data) && /window\._live20Y/.test(data) && /tnx20y/.test(data) && /treasuryProjectedFields/.test(data));
check('CPI contract keeps BLS NSA market-standard and SA analytical series explicitly separate', /CUUR0000SA0/.test(fetchData) && /CUSR0000SA0/.test(fetchData) && /seasonalAdjustment:\s*'NSA'/.test(fetchData) && /seasonalAdjustment:\s*'SA'/.test(fetchData) && /blsCpiSaYoY/.test(fetchData) && /blsCoreCpiSaYoY/.test(fetchData) && /CPIAUCNS/.test(fetchData) && /expectedAdjustment/.test(fetchData) && /_canonicalCpiDefinitionBlocked/.test(data));
check('screener validator exposes mixed revision and fundamental field lineage gates', /mixedRevision/.test(read('scripts/validate-screener-artifact.mjs')) && /fundamental rows require source\/model\/observedAt lineage/.test(read('scripts/validate-screener-artifact.mjs')) && /fieldCoverage/.test(read('scripts/validate-screener-artifact.mjs')));
check('fetch-data ranks backstop news by market-impact score', /scoreServerNewsItem/.test(fetchData) && /SERVER_NEWS_PRIORITY_RULES/.test(fetchData) && /selectionReason/.test(fetchData) && /serverNewsScored/.test(fetchData) && /newsScoreMax/.test(fetchData));
check('fetch-data has first-class credit/funding news backstop', /Google News - Credit\/Funding/.test(fetchData) && /topic:\s*'credit'/.test(fetchData) && /credit-funding/.test(fetchData) && /capex funding/.test(fetchData) && /data center financing/.test(fetchData));
check('fetch-data ranks news by actual article source tier, not Google feed tier', /getServerNewsSourceTier/.test(fetchData) && /SERVER_NEWS_LOW_QUALITY_SOURCE_RE/.test(fetchData) && /source-tier/.test(fetchData) && /low-quality-source-8/.test(fetchData) && /feedTier/.test(fetchData));
check('telegram classifier routes credit and capex funding risk', /add\('credit'\)/.test(fetchTelegram) && /lqd|LQD/.test(fetchTelegram) && /project finance|프로젝트/.test(fetchTelegram) && /capex funding|자금조달/.test(fetchTelegram));
check('fetch-data queries current Korea AI/semi market movers', /KOSPI Samsung Electronics SK Hynix AI semiconductor selloff rebound Micron/.test(fetchData));
check('fetch-data enforces KST 08:00 completed 24h news cycle', /NEWS_CYCLE_POLICY\s*=\s*'kst-0800-completed-24h'/.test(fetchData) && /getKst0800NewsCycle/.test(fetchData) && /newsCycleStart/.test(fetchData) && /newsCycleEnd/.test(fetchData) && /newsCycleLabel/.test(fetchData));
check('BEA PCE adapter is keyless official-primary evidence with observation/release/fetch separation', /parseBeaPceHtml/.test(fetchData) && /fetchBeaPce/.test(fetchData) && /www\.bea\.gov\/news\/current-releases/.test(fetchData) && /bea-official-primary/.test(fetchData) && /nextReleaseAt/.test(fetchData));
check('history stores completed closes and carries the shared market-cut revision', /completed-market-cut/.test(fetchData) && /previous-completed-close/.test(fetchData) && /deriveMarketSession/.test(fetchData) && /marketSnapshotRevision/.test(fetchData));
check('screener Kalman factor uses comparable log percent scale', /Math\.log\(v\)/.test(fetchData) && /Math\.expm1\(s1\)\s*\*\s*100/.test(fetchData) && /scale:\s*'log_pct_day'/.test(fetchData) && /kalmanScale/.test(fetchData) && /kalmanScale:\s*'log_pct_day'/.test(fetchData));
check('screener pipeline emits timestamped universe breadth and a research-only ranking contract', /computeScreenerBreadth/.test(fetchData) && /factorObservedAt/.test(fetchData) && /coveragePct/.test(fetchData) && /rankingContract/.test(fetchData) && /research-relative-ranking-only/.test(fetchData));
check('fetch-data preserves the last-known-good artifact on core quote outage', /CORE_QUOTE_COVERAGE_FAILED/.test(fetchData) && fetchData.indexOf('CORE_QUOTE_COVERAGE_FAILED') < fetchData.indexOf('await writeFile(OUT'));
check('22-category reconciliation is computed from executable artifact checks, not a static status table', /buildReconciliationStatus/.test(reconciliationBuilder) && /evidenceCheck/.test(reconciliationBuilder) && /runtimeBlockedCategories/.test(reconciliationBuilder) && /policyBlockedCategories/.test(reconciliationBuilder) && !/const CATEGORY_STATUS/.test(reconciliationBuilder));
check('browser reloads reconciliation with data polling and rejects market revision drift', /reconciliation-status\.json\?t=/.test(data) && /reconciliation-status-v2/.test(data) && /sourceRevisionMatches/.test(data) && /market snapshot revision mismatch/.test(data) && /getDataReconciliationStatus/.test(data));
check('all market-sensitive pages share one category-to-epoch contract', /PAGE_MARKET_EPOCH_CONTRACT/.test(core) && /getPageMarketEpochState/.test(core) && /applyPageMarketEpoch/.test(core) && /getPageMarketEpochAudit/.test(core));
check('page evidence is fail-closed by shared market epoch and revision state', /market-epoch-blocked/.test(core) && /market-epoch-partial/.test(core) && /data-market-revision/.test(core) && /data-market-cut-end/.test(core) && /aio:marketEpochUpdated/.test(core));
check('server quote rows emit explicit observation/fetch/delay/session/venue/use lineage', /observedAt:\s*Number\.isFinite\(m\.regularMarketTime\)/.test(fetchData) && /fetchedAt:\s*new Date\(\)\.toISOString\(\)/.test(fetchData) && /delayedByMs:/.test(fetchData) && /marketSession:/.test(fetchData) && /venue:/.test(fetchData) && /current-with-session-and-delay-gate/.test(fetchData));
check('fetch-data exposes an isolated screener-only refresh path', /SCREENER_ONLY/.test(fetchData) && /export async function enrichScreener/.test(fetchData));
check('screener rows retain per-symbol observation/source/use lineage', /f\.observedAt\s*=\s*r\.observedAt/.test(fetchData) && /f\.sourceKind\s*=\s*'delayed-eod'/.test(fetchData) && /f\.allowedUse\s*=\s*'research-relative-ranking-only'/.test(fetchData));
check('core refresh ingests official delayed Cboe statistics without a public CORS proxy', /parseCboePutCallHtml/.test(fetchData) && /Cboe Daily Market Statistics/.test(fetchData) && /sourceKind:\s*'delayed'/.test(fetchData) && /fetchCboePutCall\(\)/.test(fetchData));
check('client applies server Cboe data first and protects it from failed legacy proxy fallback', /d\.putCall\.totalPutCall/.test(data) && /sourceLabel:\s*'Cboe Daily Market Statistics'/.test(data) && /must not overwrite a fresher official/.test(data));
check('client preserves the server shared cycle and retries a saved personal FRED key when server FRED failed', /newsCycleStart:\s*d\.meta\.newsCycleStart/.test(data) && /marketSnapshotRevision:\s*d\.meta\.marketSnapshotRevision/.test(data) && /cycleManifestRevision:\s*d\.meta\.cycleManifestRevision/.test(data) && /marketCycleFreshnessSlaHours/.test(data) && /if \(!d\.meta\.fredFetchOk\)/.test(data) && /authentication:'VERIFIED'/.test(data));
check('cold server-data projection performs a bounded full-loader replay until DATA_SNAPSHOT exists', /_snapshotBridgeWait\s*<\s*60/.test(data) && /_aioServerDataBridgeAttempts\s*<=\s*5/.test(data) && /_aioLoadServerData\(\)/.test(data) && /waiting-for-snapshot/.test(data));
check('free SEC fundamentals use bounded batches and atomic persistence', exists('scripts/fetch-sec-fundamentals.mjs') && /SEC_BATCH_LIMIT/.test(read('scripts/fetch-sec-fundamentals.mjs')) && /SEC_USER_AGENT/.test(read('scripts/fetch-sec-fundamentals.mjs')) && /rename\(temp, path\)/.test(read('scripts/fetch-sec-fundamentals.mjs')));
check('BLS direct adapter is keyless, bounded, cadence-gated, and merged as typed official evidence',
  /BLS_SERIES/.test(fetchData) && /api\.bls\.gov\/publicAPI\/v1\/timeseries\/data/.test(fetchData) &&
  /method:\s*'POST'/.test(fetchData) && /BLS_CACHE_MAX_AGE_MS/.test(fetchData) && /12 \* 60 \* 60 \* 1000/.test(fetchData) &&
  /M\(\?:0\[1-9\]\|1\[0-2\]\)/.test(fetchData) && /releaseAt:\s*null/.test(fetchData) &&
  /macro\._bls/.test(fetchData) && /blsStatus/.test(fetchData) && /blsLastSuccessfulAt/.test(fetchData));
check('U.S. Treasury keyless adapter supplies an official same-date five-point curve and 10Y-2Y spread',
  /parseTreasuryYieldCurveXml/.test(fetchData) && /pages\/xml\?data=daily_treasury_yield_curve/.test(fetchData) && /fetchTreasuryYieldCurve/.test(fetchData) && /home\.treasury\.gov/.test(fetchData) &&
  /us-treasury-official-primary/.test(fetchData) && /same-date-spread/.test(fetchData) && /treasuryObservedAt/.test(fetchData));
check('AAII weekly reference refresh is automated with bounded publisher-direct/reader-relay paths and remains non-decision evidence',
  /fetchAaiiSentiment/.test(fetchData) && /parseAaiiSentimentText/.test(fetchData) && /AAII_READER_URL/.test(fetchData) &&
  /publisher-public-web-via-reader-relay/.test(fetchData) && /decisionUse:\s*false/.test(fetchData) && /aaiiRelayUsed/.test(fetchData));
check('HY OAS has a keyless official FRED public-download adapter with LKG and typed lineage',
  /parseFredHyOasCsv/.test(fetchData) && /fetchFredHyOasPublic/.test(fetchData) && /fredgraph\.csv\?id=BAMLH0A0HYM2/.test(fetchData) &&
  /FRED_HY_OAS_CACHE_MAX_AGE_MS/.test(fetchData) && /fred-official-public-csv/.test(fetchData) && /fredHyOasObservedAt/.test(fetchData));
{
  let ok = false;
  let detail = '';
  try {
    const { normalizeBlsSeriesResponse } = await import('./fetch-data.mjs');
    const monthly = (id, latest, priorMonth, priorYear = priorMonth, extra = []) => ({
      seriesID: id,
      data: [
        { year: '2026', period: 'M06', value: String(latest), footnotes: [] },
        { year: '2026', period: 'M05', value: String(priorMonth), footnotes: [] },
        { year: '2026', period: 'M13', value: '999999', footnotes: [] },
        { year: '2025', period: 'M06', value: String(priorYear), footnotes: extra }
      ]
    });
    const aheSeries = monthly('CES0500000003', 40, 39, 38);
    aheSeries.data[0].footnotes = [{ code: 'P', text: 'Preliminary' }];
    const payload = { Results: { series: [
      monthly('CUUR0000SA0', 300, 299, 285),
      monthly('CUSR0000SA0', 310, 309, 300),
      monthly('CUUR0000SA0L1E', 200, 199, 190),
      monthly('CUSR0000SA0L1E', 210, 209, 200),
      monthly('LNS14000000', 4.1, 4.0),
      monthly('LNS11300000', 62.5, 62.4),
      monthly('CES0000000001', 16000, 15900),
      aheSeries
    ] } };
    const result = normalizeBlsSeriesResponse(payload, '2026-07-15T00:00:00.000Z');
    const cpi = result.series.cpi;
    const cpiSa = result.series.cpiSa;
    const coreCpi = result.series.coreCpi;
    const coreCpiSa = result.series.coreCpiSa;
    const nfp = result.series.nonfarmPayroll;
    const ahe = result.series.averageHourlyEarnings;
    ok = result.status === 'ok' && result.values.blsCpiYoY === 5.3 && result.values.blsCpiSaYoY === 3.3 &&
      result.values.blsCoreCpiYoY === 5.3 && result.values.blsCoreCpiSaYoY === 5 && result.values.blsNfpMoM === 100 &&
      result.values.blsAverageHourlyEarningsYoY === 5.3 && cpi.unit === 'index' && cpi.releaseAt === null &&
      cpi.seasonalAdjustment === 'NSA' && cpi.displayRole === 'market-standard-headline' && cpi.definition.includes('not seasonally adjusted') &&
      cpiSa.seasonalAdjustment === 'SA' && cpiSa.displayRole === 'analytical-seasonally-adjusted' &&
      coreCpi.seasonalAdjustment === 'NSA' && coreCpiSa.seasonalAdjustment === 'SA' &&
      cpi.inputObservationPeriods.every(period => !period.endsWith('M13')) && ahe.observationStatus === 'footnote-present' &&
      nfp.unit === 'thousands' && nfp.observedAt === '2026-06-01';
    detail = JSON.stringify({ status: result.status, values: result.values, cpi, cpiSa, coreCpi, coreCpiSa, nfp });
  } catch (error) { detail = error.message; }
  check('BLS normalizer rejects M13, preserves units/observation periods, and derives YoY/MoM deterministically', ok, detail.slice(0, 1200));
}
{
  let ok = false;
  let detail = '';
  try {
    const { buildMarketAnalysisNewsEvidence, isMarketAnalysisNewsEligible, validateMarketAnalysisText } = await import('./fetch-data.mjs');
    const base = { source: 'Reuters', link: 'https://example.test/story', eventTime: '2026-08-12T12:00:00.000Z', score: 90, independenceKey: 'reuters' };
    const headline = { ...base, title: 'Headline-only market move', contentDepth: 'headline-only', content: 'This text is deliberately ignored because the source declares headline-only.' };
    const excerpt = { ...base, title: 'Article excerpt with a documented market catalyst', link: 'https://example.test/excerpt', independenceKey: 'ap-source', contentDepth: 'EXCERPT', excerpt: 'The article explains the catalyst, the reported transmission channel, and the observed response in sufficient detail for a cautious reference.' };
    const data = { meta: { generatedAt: '2026-08-12T12:01:00.000Z' }, news: [headline, excerpt] };
    const evidence = buildMarketAnalysisNewsEvidence(data);
    const semantic = validateMarketAnalysisText('Markets moved because the documented catalyst changed risk pricing.', { ...data, macro: {} });
    ok = !isMarketAnalysisNewsEligible(headline) && isMarketAnalysisNewsEligible(excerpt) && evidence.length === 1 && evidence[0].title === excerpt.title && semantic.causalEvidenceCount === 1;
    detail = JSON.stringify({ evidence, semantic });
  } catch (error) { detail = error.message; }
  check('market analysis rejects headline-only news as causal evidence while accepting a substantive excerpt', ok, detail.slice(0, 1600));
}
{
  let ok = false;
  let detail = '';
  try {
    const { normalizeSecCompanyFacts } = await import('./fetch-sec-fundamentals.mjs');
    const facts = {
      cik: 1,
      entityName: 'Fixture Corp',
      facts: {
        'us-gaap': {
          RevenueFromContractWithCustomerExcludingAssessedTax: { units: { USD: [
            { start:'2024-01-01', end:'2024-12-31', filed:'2025-02-01', form:'10-K', fp:'FY', val:800, accn:'a' },
            { start:'2025-01-01', end:'2025-12-31', filed:'2026-02-01', form:'10-K', fp:'FY', val:1000, accn:'b' }
          ] } },
          NetIncomeLoss: { units: { USD: [
            { start:'2024-01-01', end:'2024-12-31', filed:'2025-02-01', form:'10-K', fp:'FY', val:80, accn:'a' },
            { start:'2025-01-01', end:'2025-12-31', filed:'2026-02-01', form:'10-K', fp:'FY', val:100, accn:'b' }
          ] } },
          StockholdersEquity: { units: { USD: [
            { end:'2025-12-31', filed:'2026-02-01', form:'10-K', fp:'FY', val:500, accn:'b' }
          ] } }
        },
        dei: { EntityCommonStockSharesOutstanding: { units: { shares: [
          { end:'2025-12-31', filed:'2026-02-01', form:'10-K', fp:'FY', val:10, accn:'b' }
        ] } } }
      }
    };
    const submissions = { filings: { recent: {
      accessionNumber: ['a', 'b'],
      acceptanceDateTime: ['2025-02-01T18:00:00.000Z', '2026-02-01T18:00:00.000Z']
    } } };
    const row = normalizeSecCompanyFacts('FIX', facts, 100, submissions);
    ok = row && row.pe === 10 && row.pb === 2 && row.roe === 20 && row.margin === 10 && row.revGrowth === 25 &&
      row.model === 'sec-fy-normalized-v2' && row.acceptedAt === '2026-02-01T18:00:00.000Z' &&
      row.pit?.schemaVersion === 'sec-pit-facts.v1' && row.pit.observationCount >= 6 && row.pit.acceptedTimeCount >= 4;
    detail = JSON.stringify(row);
  } catch (error) { detail = error.message; }
  check('SEC companyfacts normalizer preserves annual period and computes bounded comparable ratios', ok, detail.slice(0, 500));
}
{
  let ok = false;
  let detail = '';
  try {
    const { parseTreasuryYieldCurveXml } = await import('./fetch-data.mjs');
    const entry = (date, values) => `<entry><content><m:properties><d:NEW_DATE m:type="Edm.DateTime">${date}T00:00:00</d:NEW_DATE>${Object.entries(values).map(([year, value]) => `<d:BC_${year}YEAR m:type="Edm.Double">${value}</d:BC_${year}YEAR>`).join('')}</m:properties></content></entry>`;
    const xml = `<feed>${entry('2026-08-11', { 2: 4.10, 5: 4.25, 10: 4.60, 20: 5.10, 30: 5.20 })}${entry('2026-08-12', { 2: 4.20, 5: 4.38, 10: 4.68, 20: 5.24, 30: 5.24 })}</feed>`;
    const curve = parseTreasuryYieldCurveXml(xml, '2026-08-13T00:00:00.000Z');
    ok = curve?.status === 'ok' && curve.observedAt === '2026-08-12' && curve.values.dgs2 === 4.2 && curve.values.dgs30 === 5.24 && curve.values.t10y2y === 0.48 && curve.sourceKind === 'official-primary';
    detail = JSON.stringify(curve);
  } catch (error) { detail = error.message; }
  check('Treasury curve parser selects the latest complete dated row and derives only a same-date spread', ok, detail);
}
{
  let ok = false;
  let detail = '';
  try {
    const { parseAaiiSentimentText } = await import('./fetch-data.mjs');
    const text = 'Reported Date Bullish Neutral Bearish\nAug 26 32.9%22.6%44.4%\nAug 19 35.5%24.6%39.9%';
    const result = parseAaiiSentimentText(text, '2026-08-28T03:00:00.000Z', 'https://r.jina.ai/https://www.aaii.com/sentimentsurvey/sent_results?adv=yes');
    ok = result?.status === 'current-reference' && result.observedAt === '2026-08-26' && result.bullish === 32.9 && result.neutral === 22.6 && result.bearish === 44.4 && result.spread === -11.5 && result.allowedUse === 'reference-only' && result.decisionUse === false && /relay/.test(result.sourceKind);
    detail = JSON.stringify(result);
  } catch (error) { detail = error.message; }
  check('AAII parser selects the latest complete official row, validates the 100% sum, and keeps relay evidence reference-only', ok, detail);
}
{
  let ok = false;
  let detail = '';
  try {
    const { parseFredHyOasCsv } = await import('./fetch-data.mjs');
    const csv = 'observation_date,BAMLH0A0HYM2\n2026-08-10,2.70\n2026-08-11,.\n2026-08-12,2.71\ninvalid,9.99\n';
    const result = parseFredHyOasCsv(csv, '2026-08-13T00:00:00.000Z');
    ok = result?.status === 'ok' && result.seriesId === 'BAMLH0A0HYM2' && result.observedAt === '2026-08-12' && result.value === 2.71 && result.unit === 'percent' && result.sourceKind === 'official-government-relay';
    detail = JSON.stringify(result);
  } catch (error) { detail = error.message; }
  check('FRED HY OAS CSV parser rejects missing/invalid rows and selects the latest dated observation', ok, detail);
}
{
  let ok = false;
  let detail = '';
  try {
    const { selectSecFundamentalsAsOf } = await import('../src/domain/fundamental/sec-report.js');
    const record = { symbol: 'FIX', pit: { observations: {
      revenue: [
        { value: 800, periodEnd: '2024-12-31', filedAt: '2025-02-01', acceptedAt: '2025-02-01T18:00:00.000Z', accession: 'a' },
        { value: 1000, periodEnd: '2025-12-31', filedAt: '2026-02-01', acceptedAt: '2026-02-01T18:00:00.000Z', accession: 'b' },
        { value: 1100, periodEnd: '2025-12-31', filedAt: '2026-03-01', acceptedAt: '2026-03-01T18:00:00.000Z', accession: 'b-amend' }
      ],
      netIncome: [
        { value: 80, periodEnd: '2024-12-31', filedAt: '2025-02-01', acceptedAt: '2025-02-01T18:00:00.000Z', accession: 'a' },
        { value: 100, periodEnd: '2025-12-31', filedAt: '2026-02-01', acceptedAt: '2026-02-01T18:00:00.000Z', accession: 'b' },
        { value: 105, periodEnd: '2025-12-31', filedAt: '2026-03-01', acceptedAt: '2026-03-01T18:00:00.000Z', accession: 'b-amend' }
      ],
      equity: [{ value: 500, periodEnd: '2025-12-31', filedAt: '2026-02-01', acceptedAt: '2026-02-01T18:00:00.000Z' }],
      sharesOutstanding: [{ value: 10, periodEnd: '2025-12-31', filedAt: '2026-02-01', acceptedAt: '2026-02-01T18:00:00.000Z' }]
    } } };
    const before = selectSecFundamentalsAsOf(record, '2026-02-15T00:00:00.000Z');
    const after = selectSecFundamentalsAsOf(record, '2026-03-15T00:00:00.000Z', { priceAsOf: 100 });
    ok = before?.revenue === 1000 && before.netIncome === 100 && before.pe == null &&
      after?.revenue === 1100 && after.netIncome === 105 && after.pe === 9.52 && after.accession === 'b-amend';
    detail = JSON.stringify({ before, after });
  } catch (error) { detail = error.message; }
  check('SEC PIT selector excludes future amendments and never backfills current price without an as-of price', ok, detail.slice(0, 1000));
}
{
  let ok = false;
  let detail = '';
  try {
    const { parseCboePutCallHtml } = await import('./fetch-data.mjs');
    const row = parseCboePutCallHtml('{\\"name\\":\\"TOTAL PUT/CALL RATIO\\",\\"value\\":\\"0.93\\"},{\\"name\\":\\"INDEX PUT/CALL RATIO\\",\\"value\\":\\"1.01\\"},{\\"name\\":\\"EQUITY PUT/CALL RATIO\\",\\"value\\":\\"0.62\\"},{\\"selectedDate\\":\\"2026-07-14\\"}');
    ok = row && row.totalPutCall === 0.93 && row.indexPutCall === 1.01 && row.equityPutCall === 0.62 && row.asOf === '2026-07-14' && row.sourceKind === 'delayed';
    detail = JSON.stringify(row);
  } catch (error) { detail = error.message; }
  check('Cboe official page parser binds total/equity/index ratios to selected trading date', ok, detail);
}
{
  let detail = '';
  let ok = false;
  try {
    const src = extractFunctionSource(fetchData, 'computeScreenerBreadth');
    const fn = new Function('round', '_mean', `${src}\nreturn computeScreenerBreadth;`)(
      (v, d) => Number(v.toFixed(d)),
      (a) => a.reduce((s, v) => s + v, 0) / a.length
    );
    const up = Array.from({ length: 220 }, (_, i) => 100 + i);
    const down = Array.from({ length: 220 }, (_, i) => 400 - i);
    const out = fn(['UP','DOWN','005930.KS'], [
      { sym:'UP', adjCloses:up, observedAt:'2026-07-13T20:00:00.000Z' },
      { sym:'DOWN', adjCloses:down, observedAt:'2026-07-13T20:00:00.000Z' },
      { sym:'005930.KS', adjCloses:up, observedAt:'2026-07-14T06:30:00.000Z' }
    ]);
    ok = out.segments.us.universe === 2 && out.segments.us.eligible === 2 && out.segments.us.above20 === 50 && out.segments.us.advanceRatio === 0.5 && out.segments.kr.above200 === 100;
    detail = JSON.stringify(out.segments);
  } catch (error) { detail = error.message; }
  check('screener breadth calculation separates US/KR and computes MA/advance ratios', ok, detail.slice(0, 400));
}
// P586/C2: backtest must self-disclose that it does not cover the live model's size/value/quality
// factors or its regime-adaptive weights, and the client panel must actually surface that disclosure
// rather than implying the full live composite rank is validated.
check('server backtest discloses its excluded factors and fixed weight regime', /excludedFactors/.test(fetchData) && /weightRegime:\s*'NEUTRAL'/.test(fetchData) && /excludedFactorsReason/.test(fetchData));
check('server backtest accumulates an IC time series artifact', /updateBacktestHistory/.test(fetchData) && /public-data\/backtest-history\.json/.test(fetchData));
check('client backtest panel surfaces the excluded-factors/weight-regime disclosure, not a blanket "validated" claim', /backtest\.excludedFactors/.test(screenerPage) && /backtest\.weightRegime/.test(screenerPage) && /실시간 적응형 종합 랭크 검증 아님/.test(screenerPage) && !/종합 랭크가 검증 기반/.test(data + screenerPage));

// P587/R265/C6: dividend-unadjusted close systematically understates momentum/trend for
// high-yield names (measured: KO 6m return understated by 1.56pp raw vs adjusted). Factor/backtest
// math must consume the adjusted series; VCP stays on raw OHLC (price-structure pattern, not return).
check('fetchHistory exposes adjusted close alongside raw OHLCV', /adjClose:/.test(fetchData) && /indicators\?\.adjclose\?\.\[0\]\?\.adjclose/.test(fetchData));
check('screener factor enrichment scores returns/trend/RSI/kalman on adjusted close, not raw', /adjCloses:/.test(fetchData) && /closesToFactors\(r\.adjCloses/.test(fetchData));
check('VCP pattern recognition stays on raw OHLC (not adjusted close)', /_calcVCPServer\(r\.closes, r\.highs, r\.lows, r\.volumes\)/.test(fetchData));
check('backtest cross-sectional scoring prefers adjusted close', /s\.adjCloses && s\.adjCloses\.length === s\.closes\.length\) \? s\.adjCloses : s\.closes/.test(fetchData));

// P584/R265/C1: server screener.json RSI and the client's own displayed RSI must agree —
// previously the server used Cutler's RSI (windowed simple average) while the client used
// Wilder's RSI (recursively smoothed), same label, different numbers. Recompute both against
// identical synthetic input rather than trusting that matching source comments mean matching math.
let rsiParityDetail = '';
const rsiParityOk = (() => {
  try {
    const serverSrc = extractFunctionSource(fetchData, '_rsi14');
    const clientRsiSrc = extractFunctionSource(core, '_calcRSILast');
    const cleanNumsSrc = extractFunctionSource(core, '_aioCleanNums');
    if (!serverSrc) { rsiParityDetail = 'could not extract _rsi14 from fetch-data.mjs'; return false; }
    if (!clientRsiSrc) { rsiParityDetail = 'could not extract _calcRSILast from aio-core.js'; return false; }
    if (!cleanNumsSrc) { rsiParityDetail = 'could not extract _aioCleanNums from aio-core.js'; return false; }
    const roundFn = (v, d) => (typeof v === 'number' && isFinite(v)) ? Number(v.toFixed(d)) : null;
    const serverRsi14 = new Function('round', `${serverSrc}\nreturn _rsi14;`)(roundFn);
    const clientCalcRsiLast = new Function(`${cleanNumsSrc}\n${clientRsiSrc}\nreturn _calcRSILast;`)();
    // Deterministic synthetic series long enough (300 bars) for Wilder's smoothing to be well
    // past its warm-up window, matching real usage (screener enrichment runs on ~1y of history).
    const closes = [];
    let p = 100;
    for (let i = 0; i < 300; i++) {
      p += Math.sin(i / 7) * 1.3 + (i % 23 === 0 ? 4 : 0) - (i % 31 === 0 ? 3 : 0) + 0.02;
      closes.push(Math.max(1, p));
    }
    const serverVal = serverRsi14(closes);
    const clientVal = roundFn(clientCalcRsiLast(closes, 14), 1);
    if (typeof serverVal !== 'number' || typeof clientVal !== 'number') {
      rsiParityDetail = `non-numeric result: server=${serverVal} client=${clientVal}`;
      return false;
    }
    const diff = Math.abs(serverVal - clientVal);
    if (diff > 0.5) {
      rsiParityDetail = `server=${serverVal} client=${clientVal} diff=${diff.toFixed(2)} (tolerance 0.5)`;
      return false;
    }
    return true;
  } catch (e) {
    rsiParityDetail = e.message;
    return false;
  }
})();
check('server _rsi14 and client _calcRSILast are numerically equivalent (P584/R265 parity)', rsiParityOk, rsiParityDetail);

// FABLE-ARCH-DIAGNOSIS-2026-07-06.md Phase 3 [D-VCP]: server `_calcVCPServer` (fetch-data.mjs) and
// client `_calcVCP` (aio-core.js) are two independently-maintained implementations of the same
// pattern-recognition logic (parallel to the RSI case above) — currently in parameter parity, but
// nothing previously caught it if one side's swing-detection window, base-length lookback, or
// contraction-depth band drifted from the other. Text-contract check (not full behavioral parity
// like RSI above — VCP's differing input shapes, {ok,vcpScore,vcpStage,...} vs separate
// closes/highs/lows/volumes arrays, make a synthetic-data equivalence test disproportionate to what
// this is guarding): confirm the same core numeric literals appear in both extracted function bodies.
let vcpParityDetail = '';
const vcpParityOk = (() => {
  try {
    const serverSrc = extractFunctionSource(fetchData, '_calcVCPServer');
    const clientSrc = extractFunctionSource(core, '_calcVCP');
    if (!serverSrc) { vcpParityDetail = 'could not extract _calcVCPServer from fetch-data.mjs'; return false; }
    if (!clientSrc) { vcpParityDetail = 'could not extract _calcVCP from aio-core.js'; return false; }
    // Anchored to the actual declaration/expression, not a bare number — a nearby Korean comment
    // documenting the same parameter (e.g. "좌우 N=4봉 기준") would otherwise satisfy a loose
    // `N\s*=\s*4` match on whichever side's comment happens to still say the old value, hiding a
    // real drift in the code itself. Verified by deliberately mutating just the code declaration
    // (not the comment) and confirming a loose pattern missed it before tightening to these.
    const params = [
      { label: 'minimum bar count (60)', re: /\bn\s*<\s*60\b/ },
      { label: 'base window length (min(65, n-10))', re: /Math\.min\(65,\s*n\s*-\s*10\)/ },
      { label: 'swing pivot half-window (N=4 declaration)', re: /\bN\s*=\s*4\s*[;,]\s*(?:const\s+)?sw[HL]\s*=\s*\[\]/ },
      { label: '52-week lookback cap (min(252, n))', re: /Math\.min\(252,\s*n\)/ },
      { label: 'stage-2 52w-off-high floor (-30)', re: /pct52\s*>=\s*-30/ },
      { label: 'contraction depth floor (>= 1)', re: /(?:d|dep)\s*>=\s*1\s*&&/ },
      { label: 'contraction depth ceiling (<= 45)', re: /<=\s*45\)\s*ctrs\.push/ },
    ];
    const mismatches = params.filter((p) => p.re.test(serverSrc) !== p.re.test(clientSrc));
    if (mismatches.length) {
      vcpParityDetail = mismatches.map((p) => `${p.label}: server=${p.re.test(serverSrc)} client=${p.re.test(clientSrc)}`).join('; ');
      return false;
    }
    return true;
  } catch (e) {
    vcpParityDetail = e.message;
    return false;
  }
})();
check('server _calcVCPServer and client _calcVCP share the same core parameters (Phase 3 D-VCP parity)', vcpParityOk, vcpParityDetail);
check('telegram digest script extracts topics, tickers, topItems', /topicCounts/.test(fetchTelegram) && /tickerCounts/.test(fetchTelegram) && /topItems/.test(fetchTelegram) && /telegram-public-mirror/.test(fetchTelegram));
check('telegram digest preserves honest rolling-window lineage separately from capped text payloads', /observedItems/.test(fetchTelegram) && /eligibleTextCount/.test(fetchTelegram) && /selectedRawCoveragePct/.test(fetchTelegram) && /retainedItemCount/.test(fetchTelegram));
check('telegram digest regenerates narrative and all-page routing from current artifact', /buildDynamicNarrative/.test(fetchTelegram) && /themes:dynamicNarrative\.themes/.test(fetchTelegram) && /pageMap:dynamicNarrative\.pageMap/.test(fetchTelegram) && /loadRequiredPageIds/.test(fetchTelegram) && /route-owners\.json/.test(fetchTelegram) && /guide:\[\]/.test(fetchTelegram));
check('telegram digest separates the completed 24h lane from the rolling research window', /windowKind:\s*'research-14d'/.test(fetchTelegram) && /current24hWindow/.test(fetchTelegram) && /current24hCoverage/.test(fetchTelegram) && /current24hItems/.test(fetchTelegram) && /14-day research window/.test(fetchTelegram));
check('telegram ticker extraction expands through SCREENER_DB aliases', /loadScreenerAliases/.test(fetchTelegram) && /SCREENER_ALIASES/.test(fetchTelegram) && /screener alias load failed/.test(fetchTelegram));
check('telegram digest registers four channels and fail-closed source catalog', /CHANNEL_CATALOG/.test(fetchTelegram) && /HANAchina/.test(fetchTelegram) && /sourceCatalog/.test(fetchTelegram) && /CHANNELS\.map\(slug/.test(fetchTelegram) && /collectionStatus:'failed'/.test(fetchTelegram));

check('app loads server data artifact', /public-data\/data\.json/.test(data) && /_aioLoadServerData/.test(data));
check('app applies quotes, macro, F&G, news, telegram, LLM, and native screener metadata', /applyLiveQuotes\(d\.quotes\)/.test(data) && /DATA_SNAPSHOT/.test(data) && /_applyFearGreedScore/.test(data) && /_aioApplyNewsBackstop/.test(data) && /_aioLoadServerTelegramDigest/.test(data) && /_serverMarketAnalysis/.test(data) && /_aioApplyNativeScreenerState/.test(data) && /aio:nativeScreenerReady/.test(data));
check('app gates and applies screener breadth with observation time and coverage', /_aioApplyScreenerBreadth/.test(data) && /breadthScreener/.test(data) && /coveragePct\s*>=\s*85/.test(data) && /ageHours\s*<=\s*96/.test(data));
check('quant readiness blocks trading claims until model parity and predictive validation pass', /getQuantReadinessAudit/.test(data) && /liveModelParity/.test(data) && /predictiveValidation/.test(data) && /research-relative-ranking-only/.test(data) && /매매 신호 아님/.test(data));
check('native screener only admits versioned log-scale Kalman fields and preserves stale backtest disclosure', /factor\.kalmanScale/.test(screenerProvider) && /kalmanVelConf/.test(screenerProvider) && /kalmanInnovZ/.test(screenerProvider) && /backtest:\s*artifact\.backtest/.test(screenerProvider) && /legacy_kalman_scale/.test(data));
check('app exposes public-data operational meta', /window\._serverDataMeta/.test(data) && /fredHasKey/.test(data) && /marketAnalysisOk/.test(data) && /telegramMemoOverlay/.test(data));
check('core data pipeline audit exposes publicData', /getDataPipelineAudit/.test(core) && /publicData/.test(core) && /server FRED_API_KEY not configured/.test(core) && /server LLM market analysis unavailable/.test(core));
check('operational health includes data pipeline', /getOperationalHealth/.test(core) && /dataPipeline/.test(core));

check('chat consumes news context and screener memo', /_buildNewsContext/.test(chat) && /newsCache/.test(chat) && /SCREENER_DB Memo/.test(chat) && /_aioGetMemoForTicker/.test(chat));
check('news Korean translation and local insight fallback are wired', /_aioBuildNewsLocalKoreanInsight/.test(data) && /_aioGetNewsTranslation/.test(data) && /ko_explain/.test(data) && /getNewsTranslationQualityAudit/.test(data));
check('news Korean rewrite brief is wired to market news surface', /_aioBuildNewsKoreanRewriteBrief/.test(data) && /_aioRenderNewsKoreanRewriteBrief/.test(data) && /ko_rewrite/.test(data) && /ko_section/.test(data) && /ko_market/.test(data) && /news-korean-rewrite-brief/.test(read('index.html')));
check('market news visible fallback avoids raw English titles', /_aioBuildNewsVisibleFallbackTitle/.test(data) && !/\[EN\]\s*'\s*\+/.test(data) && !/\[번역 중\]\s*'\s*\+\s*\(item\.title/.test(data));
check('market news native surface consumes normalized server/RSS items before Telegram fallback', /buildNewsSurfaceModel/.test(newsPage) && /selectNewsItems/.test(newsPage) && /_aioApplyNewsBackstop/.test(data) && /_aioApplyTelegramDigestToScreenerDb/.test(data) && /news-korean-rewrite-brief/.test(read('index.html')));
check('news selection audit exposes score criteria and surface eligibility', /getNewsSelectionAudit/.test(data) && /scoreBuckets/.test(data) && /scoreReasons/.test(data) && /homeEligible/.test(data) && /marketNewsEligible/.test(data) && /unverified=-8/.test(data));
check('server news backstop preserves score tier and news-cycle metadata', /newsCycleStart/.test(data) && /newsCycleEnd/.test(data) && /serverCycleTrusted/.test(data) && /isFinite\(Number\(n\.score\)\)/.test(data));
check('all primary news surfaces use KST 08:00 completed 24h cycle', /home:\s*\{[\s\S]{0,260}newsCyclePolicy:\s*'kst-0800-completed-24h'[\s\S]{0,120}windowHours:\s*24/.test(data) && /market-news'[\s\S]{0,320}newsCyclePolicy:\s*'kst-0800-completed-24h'[\s\S]{0,120}windowHours:\s*24/.test(data) && /filterByKst0800NewsCycle/.test(data) && /newsCycle:\s*cycleWindow/.test(data));
check('market-news UI labels match KST 08:00 completed 24h contract', /08:00 KST 완료 24h/.test(marketNewsHtml) && /08:00~08:00 KST 완료 24h/.test(marketNewsHtml) && !/최근 48시간|48시간 이내|필터:\s*48시간/.test(marketNewsHtml));
check('market-news empty state uses 24h completed-cycle wording', /08:00 KST 완료 24h/.test(newsPage) && !/48.?\uC2DC\uAC04/.test(newsPage));
check('briefing primary feed has a native owner and no legacy primary DOM writer', /route === 'briefing'/.test(newsPage) && /briefing-live-news-list/.test(newsPage) && /briefing-24h-count/.test(newsPage) && /briefing-24h-ts/.test(newsPage) && /aioBriefingRenderer/.test(newsPage) && !/briefing-live-news-list/.test(core) && !/briefing-live-news-list/.test(data));
check('macro primary quote/FRED surface has a native owner and legacy writers fence native elements', /renderLiveQuotes/.test(marketPage) && /renderSnapshotMetrics/.test(marketPage) && /aioMacroRenderer/.test(marketPage) && /_aioIsNativeMacroElement/.test(data) && /_aioIsNativeMacroElement\(el\)/.test(data) && /closest\('#page-macro\[data-aio-architecture-renderer="native"\]'\)/.test(data) && /closest\('#page-macro\[data-aio-architecture-renderer="native"\]'\)/.test(core));
check('fxbond primary quote/MOVE surface has a native owner and legacy writers fence native elements', /renderFxbond/.test(marketPage) && /aioFxbondRenderer/.test(marketPage) && /function _aioIsNativeFxbondElement/.test(data) && /page-fxbond\[data-aio-architecture-renderer="native"\]/.test(data) && /page-fxbond\[data-aio-architecture-renderer="native"\]/.test(core) && /page-fxbond\[data-aio-architecture-renderer="native"\]/.test(html));
check('breadth primary current-metric surface has a native artifact owner and legacy writers fence native elements', /renderBreadth/.test(marketPage) && /aioBreadthRenderer/.test(marketPage) && /getScreenerState/.test(marketPage) && /function _aioIsNativeBreadthElement/.test(data) && /_aioIsNativeBreadthElement\(el\)/.test(data) && /_aioIsNativeBreadthElement\(el\)/.test(read('js/aio-ui.js')) && /page-breadth\[data-aio-architecture-renderer="native"\]/.test(core));
check('news consumers do not directly reuse rolling 48h newsCache filters', !/filterByAge\(newsCache,\s*48\)/.test(data) && !/48시간 이내 한국 관련 뉴스|뉴스 피드 자동 추출[\s\S]{0,80}48시간/.test(html));
check('chat consumes Korean news translation context', /_aioGetNewsTranslation/.test(chat) && /ko_rewrite/.test(chat) && /ko_market/.test(chat) && /ko_explain/.test(chat) && /ko_impact/.test(chat) && /ko_action/.test(chat));
check('Telegram digest reaches SCREENER_DB memo', /_aioApplyTelegramDigestToScreenerDb/.test(data) && /_telegramMemoOverlay/.test(data) && /memoOverlay/.test(data));
check('Telegram runtime replaces stale static narrative with dynamic artifact fields', /themes:\s*Array\.isArray\(raw\.themes\)/.test(data) && /categories:\s*Array\.isArray\(raw\.categories\)/.test(data) && /pageMap:\s*raw\.pageMap/.test(data) && /getTelegramPageCoverageAudit/.test(data));
check('client current Telegram feed uses only the digest current24h lane', /rawCurrent24hItems/.test(data) && /AIO_TELEGRAM_CURRENT_ITEMS/.test(data) && /_aioRenderTelegramFeedHtml/.test(data));
check('news native summary projects count, source, risk, sentiment, and shared-cut status', /renderNewsSummary/.test(newsPage) && /news-24h-count/.test(newsPage) && /news-risk-count/.test(newsPage) && /news-sent-score/.test(newsPage) && /last-fetch-time/.test(newsPage));
check('browser tests cover Telegram memo injection', /T831[\s\S]{0,2400}SCREENER_DB memo/.test(tests));

// v51.94/Phase 2 [B6]: getScreenerSymbols() must read the JSON artifact, not regex-scrape
// js/aio-data.js source text (the old "\n];" boundary search was a fragile string-search bound).
check('getScreenerSymbols reads screener-universe.json, not source-text regex', /screener-universe\.json/.test(fetchData) && !/src\.indexOf\('\\n\];'/.test(fetchData));
// Drift check: public-data/screener-universe.json must be exactly what
// scripts/sync-screener-universe.mjs would regenerate from js/aio-data.js's current SCREENER_DB
// right now — catches "edited SCREENER_DB, forgot to re-run the sync script" before it ships.
{
  const sync = spawnSync(process.execPath, [join(root, 'scripts/sync-screener-universe.mjs'), '--check'], { encoding: 'utf8' });
  check('public-data/screener-universe.json is in sync with js/aio-data.js SCREENER_DB', sync.status === 0, (sync.stdout + sync.stderr).trim().slice(0, 400));
}

check('data pipeline contract is wired into CI', qaPipeline.profiles?.full?.includes('core') && Object.values(qaPipeline.groups || {}).flatMap((group) => group.gates || []).some((gate) => gate.script === 'scripts/ci-data-pipeline-contract-check.mjs'));
check('data pipeline contract documented in QA/rules/postmortem', /P517/.test(qa) && /R222/.test(rules) && /P517/.test(postmortem) && /P531/.test(qa) && /R230/.test(rules) && /P531/.test(postmortem) && /P535/.test(qa) && /R232/.test(rules) && /P535/.test(postmortem));
check('workflow governance doc exists', exists('_context/WORKFLOW-GOVERNANCE.md'));

if (errors.length) {
  console.error('Data pipeline contract check failed:');
  errors.forEach((error) => console.error(' - ' + error));
  process.exit(1);
}

console.log('Data pipeline contract check OK: Actions -> public-data -> runtime audit -> chat/memo consumers are structurally wired.');
