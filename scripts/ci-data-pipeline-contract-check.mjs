import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const exists = (path) => existsSync(join(root, path));

const errors = [];
const check = (label, condition, detail = '') => {
  if (!condition) errors.push(label + (detail ? ': ' + detail : ''));
};
const extractNodeHeredocs = (text) => {
  const blocks = [];
  const re = /node - <<'NODE'\r?\n([\s\S]*?)\r?\n\s*NODE/g;
  let match;
  while ((match = re.exec(text))) {
    blocks.push(match[1].replace(/^\s{10}/gm, ''));
  }
  return blocks;
};
const checkNodeHeredocSyntax = (label, text) => {
  const blocks = extractNodeHeredocs(text);
  check(`${label} has Node heredoc blocks`, blocks.length > 0);
  blocks.forEach((block, index) => {
    try {
      new Function('require', 'process', block);
    } catch (error) {
      check(`${label} Node heredoc ${index + 1} parses`, false, error.message);
    }
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
const watchdog = read('.github/workflows/data-watchdog.yml');
const ci = read('.github/workflows/ci.yml');
const fetchData = read('scripts/fetch-data.mjs');
const fetchTelegram = read('scripts/fetch-telegram-digest.mjs');
const core = read('js/aio-core.js');
const data = read('js/aio-data.js');
const chat = read('js/aio-chat.js');
const tests = read('js/aio-tests.js');
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
check('refresh workflow fetches market data with required optional secrets', /node scripts\/fetch-data\.mjs/.test(refresh) && /FRED_API_KEY/.test(refresh) && /FMP_API_KEY/.test(refresh) && /ANTHROPIC_API_KEY/.test(refresh));
check('refresh workflow fetches Telegram digest artifact', /node scripts\/fetch-telegram-digest\.mjs --days=(?:7|14) --out=public-data\/telegram-digest\.json/.test(refresh));
check('refresh workflow commits all public-data artifacts', /git add public-data\/data\.json public-data\/history\.json/.test(refresh) && /public-data\/screener\.json/.test(refresh) && /public-data\/telegram-digest\.json/.test(refresh) && /public-data\/backtest-history\.json/.test(refresh));
check('refresh workflow publishes status summary', /GITHUB_STEP_SUMMARY/.test(refresh) && /fearGreedOk/.test(refresh) && /fredFetchOk/.test(refresh) && /marketAnalysisOk/.test(refresh));
checkNodeHeredocSyntax('refresh-data workflow', refresh);

check('watchdog checks data and telegram freshness', /data\.json meta\.generatedAt/.test(watchdog) && /telegram-digest\.json generatedAt/.test(watchdog));
check('watchdog freshness threshold tolerates transient Actions lag', /default:\s*'240'/.test(watchdog) && /MAX_AGE_MIN:\s*\$\{\{ github\.event\.inputs\.max_age_minutes \|\| '240' \}\}/.test(watchdog));
check('watchdog has core quality floors for public data', /symbolsOk[\s\S]{0,200}<\s*70/.test(watchdog) && /newsCount[\s\S]{0,200}<\s*10/.test(watchdog) && /telegramCount[\s\S]{0,240}<\s*100/.test(watchdog));
check('watchdog reports optional degraded services', /FRED_API_KEY/.test(watchdog) && /fredFetchOk/.test(watchdog) && /marketAnalysisOk/.test(watchdog));
check('watchdog checks screener artifact health', /screener\.json/.test(watchdog) && /scrAge/.test(watchdog) && /ok=\$\{scr\.ok\}/.test(watchdog));
checkNodeHeredocSyntax('data-watchdog workflow', watchdog);

check('fetch-data writes data/history/screener artifacts', /public-data\/data\.json/.test(fetchData) && /public-data\/history\.json/.test(fetchData) && /public-data\/screener\.json/.test(fetchData));
check('fetch-data collects quotes, F&G, FRED, news, LLM analysis', /fetchQuote/.test(fetchData) && /fetchFearGreed/.test(fetchData) && /fetchFred/.test(fetchData) && /fetchNews/.test(fetchData) && /genMarketAnalysis/.test(fetchData));
check('fetch-data separates FRED configured vs fetched', /fredHasKey/.test(fetchData) && /fredFetchOk/.test(fetchData) && /macroKeyCount/.test(fetchData));
check('fetch-data exposes marketAnalysisOk', /marketAnalysisOk/.test(fetchData));
check('fetch-data ranks backstop news by market-impact score', /scoreServerNewsItem/.test(fetchData) && /SERVER_NEWS_PRIORITY_RULES/.test(fetchData) && /selectionReason/.test(fetchData) && /serverNewsScored/.test(fetchData) && /newsScoreMax/.test(fetchData));
check('fetch-data ranks news by actual article source tier, not Google feed tier', /getServerNewsSourceTier/.test(fetchData) && /SERVER_NEWS_LOW_QUALITY_SOURCE_RE/.test(fetchData) && /source-tier/.test(fetchData) && /low-quality-source-8/.test(fetchData) && /feedTier/.test(fetchData));
check('fetch-data queries current Korea AI/semi market movers', /KOSPI Samsung Electronics SK Hynix AI semiconductor selloff rebound Micron/.test(fetchData));
check('fetch-data enforces KST 08:00 completed 24h news cycle', /NEWS_CYCLE_POLICY\s*=\s*'kst-0800-completed-24h'/.test(fetchData) && /getKst0800NewsCycle/.test(fetchData) && /newsCycleStart/.test(fetchData) && /newsCycleEnd/.test(fetchData) && /newsCycleLabel/.test(fetchData));
check('screener Kalman factor uses comparable log percent scale', /Math\.log\(v\)/.test(fetchData) && /Math\.expm1\(s1\)\s*\*\s*100/.test(fetchData) && /scale:\s*'log_pct_day'/.test(fetchData) && /kalmanScale/.test(fetchData) && /kalmanScale:\s*'log_pct_day'/.test(fetchData));
// P586/C2: backtest must self-disclose that it does not cover the live model's size/value/quality
// factors or its regime-adaptive weights, and the client panel must actually surface that disclosure
// rather than implying the full live composite rank is validated.
check('server backtest discloses its excluded factors and fixed weight regime', /excludedFactors/.test(fetchData) && /weightRegime:\s*'NEUTRAL'/.test(fetchData) && /excludedFactorsReason/.test(fetchData));
check('server backtest accumulates an IC time series artifact', /updateBacktestHistory/.test(fetchData) && /public-data\/backtest-history\.json/.test(fetchData));
check('client backtest panel surfaces the excluded-factors/weight-regime disclosure, not a blanket "validated" claim', /bt\.excludedFactors/.test(data) && /bt\.weightRegime/.test(data) && !/종합 랭크가 검증 기반/.test(data));

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
check('telegram digest script extracts topics, tickers, topItems', /topicCounts/.test(fetchTelegram) && /tickerCounts/.test(fetchTelegram) && /topItems/.test(fetchTelegram) && /telegram-public-mirror/.test(fetchTelegram));

check('app loads server data artifact', /public-data\/data\.json/.test(data) && /_aioLoadServerData/.test(data));
check('app applies quotes, macro, F&G, news, telegram, LLM, screener', /applyLiveQuotes\(d\.quotes\)/.test(data) && /DATA_SNAPSHOT/.test(data) && /_applyFearGreedScore/.test(data) && /_aioApplyNewsBackstop/.test(data) && /_aioLoadServerTelegramDigest/.test(data) && /_serverMarketAnalysis/.test(data) && /_aioApplyServerScreener/.test(data));
check('app only merges versioned log-scale Kalman screener fields', /f\.kalmanScale\s*===\s*'log_pct_day'/.test(data) && /sd\.backtest\.kalmanScale\s*===\s*'log_pct_day'/.test(data) && /legacy_kalman_scale/.test(data) && /kalmanVelConf/.test(data) && /kalmanInnovZ/.test(data));
check('app exposes public-data operational meta', /window\._serverDataMeta/.test(data) && /fredHasKey/.test(data) && /marketAnalysisOk/.test(data) && /telegramMemoOverlay/.test(data));
check('core data pipeline audit exposes publicData', /getDataPipelineAudit/.test(core) && /publicData/.test(core) && /server FRED_API_KEY not configured/.test(core) && /server LLM market analysis unavailable/.test(core));
check('operational health includes data pipeline', /getOperationalHealth/.test(core) && /dataPipeline/.test(core));

check('chat consumes news context and screener memo', /_buildNewsContext/.test(chat) && /newsCache/.test(chat) && /SCREENER_DB Memo/.test(chat) && /_aioGetMemoForTicker/.test(chat));
check('news Korean translation and local insight fallback are wired', /_aioBuildNewsLocalKoreanInsight/.test(data) && /_aioGetNewsTranslation/.test(data) && /ko_explain/.test(data) && /getNewsTranslationQualityAudit/.test(data));
check('news Korean rewrite brief is wired to market news surface', /_aioBuildNewsKoreanRewriteBrief/.test(data) && /_aioRenderNewsKoreanRewriteBrief/.test(data) && /ko_rewrite/.test(data) && /ko_section/.test(data) && /ko_market/.test(data) && /news-korean-rewrite-brief/.test(read('index.html')));
check('market news visible fallback avoids raw English titles', /_aioBuildNewsVisibleFallbackTitle/.test(data) && !/\[EN\]\s*'\s*\+/.test(data) && !/\[번역 중\]\s*'\s*\+\s*\(item\.title/.test(data));
check('market news rewrite surface consumes server/RSS items before Telegram fallback', /_aioRenderMarketNewsRewriteSurfaces/.test(data) && /_aioRenderNewsKoreanRewriteBrief\(items \|\| \[\], 'news-korean-rewrite-brief'\)/.test(data));
check('news selection audit exposes score criteria and surface eligibility', /getNewsSelectionAudit/.test(data) && /scoreBuckets/.test(data) && /scoreReasons/.test(data) && /homeEligible/.test(data) && /marketNewsEligible/.test(data) && /unverified=-8/.test(data));
check('server news backstop preserves score tier and news-cycle metadata', /newsCycleStart/.test(data) && /newsCycleEnd/.test(data) && /serverCycleTrusted/.test(data) && /isFinite\(Number\(n\.score\)\)/.test(data));
check('all primary news surfaces use KST 08:00 completed 24h cycle', /home:\s*\{[\s\S]{0,260}newsCyclePolicy:\s*'kst-0800-completed-24h'[\s\S]{0,120}windowHours:\s*24/.test(data) && /market-news'[\s\S]{0,320}newsCyclePolicy:\s*'kst-0800-completed-24h'[\s\S]{0,120}windowHours:\s*24/.test(data) && /filterByKst0800NewsCycle/.test(data) && /newsCycle:\s*cycleWindow/.test(data));
check('market-news UI labels match KST 08:00 completed 24h contract', /08:00 KST 완료 24h/.test(marketNewsHtml) && /08:00~08:00 KST 완료 24h/.test(marketNewsHtml) && !/최근 48시간|48시간 이내|필터:\s*48시간/.test(marketNewsHtml));
check('market-news empty state uses 24h completed-cycle wording', /08:00 KST 완료 24h/.test(newsEmptyBlock) && !/최근 48시간/.test(newsEmptyBlock));
check('news consumers do not directly reuse rolling 48h newsCache filters', !/filterByAge\(newsCache,\s*48\)/.test(data) && !/48시간 이내 한국 관련 뉴스|뉴스 피드 자동 추출[\s\S]{0,80}48시간/.test(html));
check('chat consumes Korean news translation context', /_aioGetNewsTranslation/.test(chat) && /ko_rewrite/.test(chat) && /ko_market/.test(chat) && /ko_explain/.test(chat) && /ko_impact/.test(chat) && /ko_action/.test(chat));
check('Telegram digest reaches SCREENER_DB memo', /_aioApplyTelegramDigestToScreenerDb/.test(data) && /_telegramMemoOverlay/.test(data) && /memoOverlay/.test(data));
check('browser tests cover Telegram memo injection', /T831[\s\S]{0,2400}SCREENER_DB memo/.test(tests));

check('data pipeline contract is wired into CI', /ci-data-pipeline-contract-check\.mjs/.test(ci));
check('data pipeline contract documented in QA/rules/postmortem', /P517/.test(qa) && /R222/.test(rules) && /P517/.test(postmortem) && /P531/.test(qa) && /R230/.test(rules) && /P531/.test(postmortem) && /P535/.test(qa) && /R232/.test(rules) && /P535/.test(postmortem));
check('workflow governance doc exists', exists('_context/WORKFLOW-GOVERNANCE.md'));

if (errors.length) {
  console.error('Data pipeline contract check failed:');
  errors.forEach((error) => console.error(' - ' + error));
  process.exit(1);
}

console.log('Data pipeline contract check OK: Actions -> public-data -> runtime audit -> chat/memo consumers are structurally wired.');
