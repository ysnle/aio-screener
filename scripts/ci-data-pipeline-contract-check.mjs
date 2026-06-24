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

const refresh = read('.github/workflows/refresh-data.yml');
const watchdog = read('.github/workflows/data-watchdog.yml');
const ci = read('.github/workflows/ci.yml');
const fetchData = read('scripts/fetch-data.mjs');
const fetchTelegram = read('scripts/fetch-telegram-digest.mjs');
const core = read('js/aio-core.js');
const data = read('js/aio-data.js');
const chat = read('js/aio-chat.js');
const tests = read('js/aio-tests.js');
const qa = read('_context/QA-CHECKLIST.md');
const rules = read('_context/RULES.md');
const postmortem = read('_context/BUG-POSTMORTEM.md');

check('refresh workflow runs twice hourly', /cron:\s*'17,47 \* \* \* \*'/.test(refresh));
check('refresh workflow has write permission and no cancel-in-progress', /contents:\s*write/.test(refresh) && /cancel-in-progress:\s*false/.test(refresh));
check('refresh workflow fetches market data with required optional secrets', /node scripts\/fetch-data\.mjs/.test(refresh) && /FRED_API_KEY/.test(refresh) && /FMP_API_KEY/.test(refresh) && /ANTHROPIC_API_KEY/.test(refresh));
check('refresh workflow fetches Telegram digest artifact', /node scripts\/fetch-telegram-digest\.mjs --days=7 --out=public-data\/telegram-digest\.json/.test(refresh));
check('refresh workflow commits all public-data artifacts', /git add public-data\/data\.json public-data\/history\.json/.test(refresh) && /public-data\/screener\.json/.test(refresh) && /public-data\/telegram-digest\.json/.test(refresh));
check('refresh workflow publishes status summary', /GITHUB_STEP_SUMMARY/.test(refresh) && /fearGreedOk/.test(refresh) && /fredFetchOk/.test(refresh) && /marketAnalysisOk/.test(refresh));
checkNodeHeredocSyntax('refresh-data workflow', refresh);

check('watchdog checks data and telegram freshness', /data\.json meta\.generatedAt/.test(watchdog) && /telegram-digest\.json generatedAt/.test(watchdog));
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
check('telegram digest script extracts topics, tickers, topItems', /topicCounts/.test(fetchTelegram) && /tickerCounts/.test(fetchTelegram) && /topItems/.test(fetchTelegram) && /telegram-public-mirror/.test(fetchTelegram));

check('app loads server data artifact', /public-data\/data\.json/.test(data) && /_aioLoadServerData/.test(data));
check('app applies quotes, macro, F&G, news, telegram, LLM, screener', /applyLiveQuotes\(d\.quotes\)/.test(data) && /DATA_SNAPSHOT/.test(data) && /_applyFearGreedScore/.test(data) && /_aioApplyNewsBackstop/.test(data) && /_aioLoadServerTelegramDigest/.test(data) && /_serverMarketAnalysis/.test(data) && /_aioApplyServerScreener/.test(data));
check('app exposes public-data operational meta', /window\._serverDataMeta/.test(data) && /fredHasKey/.test(data) && /marketAnalysisOk/.test(data) && /telegramMemoOverlay/.test(data));
check('core data pipeline audit exposes publicData', /getDataPipelineAudit/.test(core) && /publicData/.test(core) && /server FRED_API_KEY not configured/.test(core) && /server LLM market analysis unavailable/.test(core));
check('operational health includes data pipeline', /getOperationalHealth/.test(core) && /dataPipeline/.test(core));

check('chat consumes news context and screener memo', /_buildNewsContext/.test(chat) && /newsCache/.test(chat) && /SCREENER_DB Memo/.test(chat) && /_aioGetMemoForTicker/.test(chat));
check('news Korean translation and local insight fallback are wired', /_aioBuildNewsLocalKoreanInsight/.test(data) && /_aioGetNewsTranslation/.test(data) && /ko_explain/.test(data) && /getNewsTranslationQualityAudit/.test(data));
check('news Korean rewrite brief is wired to market news surface', /_aioBuildNewsKoreanRewriteBrief/.test(data) && /_aioRenderNewsKoreanRewriteBrief/.test(data) && /ko_rewrite/.test(data) && /ko_section/.test(data) && /ko_market/.test(data) && /news-korean-rewrite-brief/.test(read('index.html')));
check('news selection audit exposes score criteria and surface eligibility', /getNewsSelectionAudit/.test(data) && /scoreBuckets/.test(data) && /scoreReasons/.test(data) && /homeEligible/.test(data) && /marketNewsEligible/.test(data) && /unverified=-8/.test(data));
check('home news surface uses a fresh 30h decision window', /home:\s*\{[\s\S]{0,240}windowHours:\s*30/.test(data) && /homeFallbackWindowHours/.test(data));
check('chat consumes Korean news translation context', /_aioGetNewsTranslation/.test(chat) && /ko_rewrite/.test(chat) && /ko_market/.test(chat) && /ko_explain/.test(chat) && /ko_impact/.test(chat) && /ko_action/.test(chat));
check('Telegram digest reaches SCREENER_DB memo', /_aioApplyTelegramDigestToScreenerDb/.test(data) && /_telegramMemoOverlay/.test(data) && /memoOverlay/.test(data));
check('browser tests cover Telegram memo injection', /T831[\s\S]{0,2400}SCREENER_DB memo/.test(tests));

check('data pipeline contract is wired into CI', /ci-data-pipeline-contract-check\.mjs/.test(ci));
check('data pipeline contract documented in QA/rules/postmortem', /P517/.test(qa) && /R222/.test(rules) && /P517/.test(postmortem) && /P531/.test(qa) && /R230/.test(rules) && /P531/.test(postmortem));
check('workflow governance doc exists', exists('_context/WORKFLOW-GOVERNANCE.md'));

if (errors.length) {
  console.error('Data pipeline contract check failed:');
  errors.forEach((error) => console.error(' - ' + error));
  process.exit(1);
}

console.log('Data pipeline contract check OK: Actions -> public-data -> runtime audit -> chat/memo consumers are structurally wired.');
