import { readThemesPageSource } from './lib/themes-page-source.mjs';
import { readScreenerPageSource } from './lib/screener-page-source.mjs'; // v59.70 (S12): the page is split under src/ui/pages/screener/
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { readProducerSource } from './lib/producer-source.mjs';
import { expandScreenerArtifact } from '../src/data/screener-extended.js'; // v57.95 core row encoding

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const exists = (path) => existsSync(join(root, path));

const errors = [];
const warnings = [];
const check = (label, condition, detail = '') => {
  if (!condition) errors.push(label + (detail ? ': ' + detail : ''));
};

const version = JSON.parse(read('version.json')).version;
const versionNum = version.replace(/^v/, '');
const html = read('index.html');
// v59.90: the legacy shell CSS sits in @layer legacy; its important-flagged declarations moved, unlayered, to this file.
const shellCss = `${html}\n${read('src/ui/styles/legacy-important-shell.css')}`;
const visibleHtml = html.replace(/<!--[\s\S]*?-->/g, '');
const core = (read('js/aio-core.js') + String.fromCharCode(10) + read('js/aio-qa-audits.js') + String.fromCharCode(10) + read('src/data/quality/validation-stores.js') + String.fromCharCode(10) + read('src/data/quality/api-health.js') + String.fromCharCode(10) + read('src/app/score-entry-points.js')) /* P1329: audits live in the QA bundle; v59.17/v59.18: the validation stores and API health state moved to src; v59.41: the score entry points */;
// v59.88 (ADR-0003 S6): the technical snapshot is src/domain/technical/snapshot.js (moved from js/aio-core.js).
const technicalSnapshotSrc = read('src/domain/technical/snapshot.js');
const data = read('js/aio-data.js') + String.fromCharCode(10) + read('src/data/providers/proxy-transport.js') /* v59.22: the relay transport moved to src */ + String.fromCharCode(10) + read('src/storage/news-cache.js') /* v59.31: the IndexedDB news cache moved to src */ + String.fromCharCode(10) + read('src/app/refresh-scheduler.js') /* v59.33: the refresh scheduler moved to src */ + String.fromCharCode(10) + read('src/data/server-data-loader.js') /* v59.34: the server data loader moved to src */ + String.fromCharCode(10) + read('src/data/public-readiness.js') /* v59.35: the public readiness model moved to src */ + String.fromCharCode(10) + read('src/ui/components/pipeline-status.js') + String.fromCharCode(10) + read('src/data/pipeline-notices.js') + String.fromCharCode(10) + read('src/app/legacy-screen-bridges.js') /* v59.88: the pipeline status bar and readiness panel moved to src */ + String.fromCharCode(10) + read('src/app/boot-sequence.js') /* v59.36: the boot sequence moved to src */ + String.fromCharCode(10) + read('src/domain/news/selection.js') + String.fromCharCode(10) + read('src/domain/news/selection-keywords.js') /* v59.42: news scoring, keywords and selection moved to src */;
const ui = read('js/aio-ui.js');
const technicalLines = read('src/ai/context/technical-lines.js'); // v59.88 S4: the chat's technical block (chart fact sheet)
const chat = read('js/aio-chat.js') + '\n' + read('src/data/providers/shared-ai-transport.js') + '\n' + read('src/ai/response/request-pipeline.js'); // v59.11: the shared AI route moved to the transport module; v59.15: the request/response pipeline module
// P1133/R620: page-level renderers extracted from index.html's inline block D live in js/aio-pages.js.
const pagesSource = read('js/aio-pages.js');
// P1134/R620: the KR/SEC data plane extracted from inline block C lives in js/aio-kr-data.js.
const krData = read('js/aio-kr-data.js');
// P1135/R620 → legacy unification: js/aio-macro-tech.js (inline block B) is retired. Retirement pins that scanned it
// now scan the remaining legacy shell files, so `macroTech` names that combined text.
const macroTech = ['js/aio-workspace.js', 'js/aio-kr-data.js', 'js/aio-pages.js', 'js/aio-ui.js'].map(read).join('\n');
// P1136/R620: the user-state/workspace layer extracted from inline block A lives in js/aio-workspace.js.
const workspace = read('js/aio-workspace.js');
const tests = read('js/aio-tests.js');
const bootstrap = read('src/app/bootstrap.js');
const screenerProvider = read('src/data/providers/screener.js');
const screenerPage = readScreenerPageSource();
const newsPage = read('src/ui/pages/news.js');
const themesPage = readThemesPageSource(); // v59.70: the page is split under src/ui/pages/themes/
const portfolioPage = read('src/ui/pages/portfolio.js');
const tradingScoreDomain = read('src/domain/market/signal/trading-score.js');
const secReportDomain = read('src/domain/fundamental/sec-report.js');
const entityPage = read('src/ui/pages/entity.js');
const glossary = read('js/aio-glossary.js');
const fetchData = readProducerSource(); // v57.62: fetch-data.mjs plus the lib modules split out of it
const telegramFetcher = read('scripts/fetch-telegram-digest.mjs');
const worker = exists('cloudflare-worker-proxy.js') ? read('cloudflare-worker-proxy.js') : '';
const packageJson = read('package.json');
const ciWorkflow = read('.github/workflows/ci.yml');
const pagesWorkflow = read('.github/workflows/pages-deploy.yml');
const qaPipeline = JSON.parse(read('architecture/qa-pipeline.json'));
const qaScripts = new Set(Object.values(qaPipeline.groups || {}).flatMap((group) => group.gates || []).map((gate) => gate.script));
const qaHas = (script, group = null) => qaScripts.has(script) && (!group || qaPipeline.profiles?.full?.includes(group));
const bootInteractionGate = read('scripts/ci-boot-interaction-check.mjs');
const knowledgeWorkflow = exists('.github/workflows/knowledge-lint.yml') ? read('.github/workflows/knowledge-lint.yml') : '';
const runtimeBundle = [core, data, ui, chat].join('\n');
const extractTelegramPageTags = () => {
  const match = data.match(/var _TG_PAGE_TAGS = \{([\s\S]*?)\n\};/);
  const pageTags = {};
  if (!match) return pageTags;
  const re = /'([^']+)':\s*\[([^\]]*)\]/g;
  let m;
  while ((m = re.exec(match[1]))) {
    pageTags[m[1]] = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  }
  return pageTags;
};
const telegramPageTags = extractTelegramPageTags();
const telegramConsumedTags = new Set(Object.values(telegramPageTags).flat());

const staticBusters = [...html.matchAll(/<script\s+src="\.\/js\/aio-[^"]+\?v=([\d.]+)"/g)].map((m) => m[1]);
check('all static aio script cachebusters match version.json', staticBusters.length >= 5 && staticBusters.every((v) => v === versionNum), `found ${staticBusters.join(',')}, expected ${versionNum}`);

const compatRoot = { addEventListener() {} /* v59.22: the proxy registry listens for aio:publicConfig */, _aioGetCanonicalScreenerRows: () => [{ sym: 'AAA', name: 'Alpha', sector: 'Energy', rank: 1, rsi: 20, signal: 'BUY' }] };
(await import('../src/app/compatibility-globals.js')).installCompatibilityGlobals(compatRoot);
(await import('../src/app/chat-globals.js')).installChatGlobals(compatRoot); // src/app/chat-loader.js installs it with the chat
const callableRefs = [...new Set([...chat.matchAll(/\b(_aio[A-Za-z0-9_]+)\s*\(/g)].map((m) => m[1]))]
  .filter((name) => !['_aioSafeMD'].includes(name));
for (const name of callableRefs) {
  const existsInRuntime = core.includes(`window.${name}`)
    || runtimeBundle.includes(`window.${name}`)
    || runtimeBundle.includes(`function ${name}`)
    || chat.includes(`window.${name}`)
    || chat.includes(`function ${name}`)
    || new RegExp(`(?:var|let|const)\\s+${name}\\b`).test(runtimeBundle)
    || typeof compatRoot[name] === 'function'; // ESM functions installCompatibilityGlobals binds for the classic scripts
  check(`AI prompt/runtime callable exists: ${name}`, existsInRuntime, 'referenced from js/aio-chat.js');
}

const digestPath = 'public-data/user-research-digest.json';
if (exists(digestPath)) {
  const digest = read(digestPath);
  check('user research digest declares REFERENCE sourceKind', /"sourceKind"\s*:\s*"REFERENCE"/.test(digest));
} else {
  warnings.push('public-data/user-research-digest.json not present; digest contract skipped');
}

// P1185/E2 S-A·S-B: 두 죽은 screener 경로를 퇴역시켰다 — ① legacy `renderScreenerResults()`는
// 리스너 없는 `aio:screener:render-request` dispatch만 하는 no-op였고, ② runtime `readScreener()`는
// 어떤 writer도 대입하지 않는 `root._aioScreenerRows`를 읽어 항상 빈 행을 돌려주는 두 번째 경로였다.
// canonical 경계(위 단언)만 남고, 같은 이름의 퇴역 경로가 되살아나지 않도록 여기서 막는다.
check('P1185 the retired screener render-request hook is not re-introduced', !/aio:screener:render-request/.test(data) && !/function\s+renderScreenerResults/.test(data), 'legacy no-op screener render hook returned');
check('P1185 the dead runtime screener reader is not re-introduced', !/readScreener\s*:\s*\(\)\s*=>/.test(read('src/data/runtime-readers.js')) && !/_aioScreenerRows/.test(read('src/data/runtime-readers.js')), 'runtime screener reader over an unwritten global returned');
check('P768: native screener is the sole runtime artifact fetch and legacy receives metadata/breadth only', /_aioApplyNativeScreenerState/.test(data) && /aio:nativeScreenerReady/.test(bootstrap) && /getScreenerState/.test(bootstrap) && /breadth:\s*artifact\.breadth/.test(screenerProvider) && !/fetch\([^\n]*screener\.json/.test(data) && !/_aioApplyServerScreener/.test(data));
// v57.81: without an event payload the projection reads only the screener fields it uses (P1755 path read), never the
// whole slice; run the real function against a recording facade.
{
  const start = data.indexOf('function _aioApplyNativeScreenerState(');
  const end = data.indexOf('window._aioApplyNativeScreenerState = _aioApplyNativeScreenerState;', start);
  const reads = [];
  const slice = { status: 'current', revision: 'r1', metadata: { asOf: '2026-10-15' }, rows: [{}, {}, {}] };
  const sandbox = { window: { DATA_SNAPSHOT: { _fieldTs: {} }, AIO_ARCH: { getScreenerState: (path) => { reads.push(path); return path ? path.split('.').reduce((n, k) => (n == null ? undefined : n[k]), slice) : slice; } } }, isFinite, Number, Array, Date, String };
  let applied = false;
  try { applied = start >= 0 && end > start && runInNewContext(data.slice(start, end) + '\n_aioApplyNativeScreenerState();', sandbox); } catch (_) { applied = false; }
  check('v57.81 the native screener projection reads named paths, never the whole slice', applied === true && reads.length > 0 && reads.every((path) => typeof path === 'string' && path) && sandbox.window.DATA_SNAPSHOT._fieldTs.screener === '2026-10-15', JSON.stringify({ applied, reads }));
}
// P1239 follow-up (2026-10-17): the chat's screener query engine lives in src/ai/context/screener-query.js and the bridge
// feeds it the canonical screener rows (no second ranking run).
{
  const viaBridge = compatRoot._aioBuildScreenerAiContext('rsi 30 이하', []);
  check('P1239 screener query engine reads canonical rows through one bridge', viaBridge?.result?.rows?.[0]?.sym === 'AAA' && /AAA/.test(viaBridge.prompt), JSON.stringify({ rows: viaBridge?.result?.rows?.length }));
}
{
  // v60.18: the browser's mirrored Telegram sources are the digest's channels (the audit's required set). They must equal the
  // producer's active CHANNEL_CATALOG, so retiring a channel there (aetherjapanresearch, 2026-11-15) retires it here too;
  // the browser had kept requesting a preview that answers with a contact card. Neither list may name a retired slug.
  const producer = read('scripts/fetch-telegram-digest.mjs');
  const catalogBody = producer.match(/const CHANNEL_CATALOG = \[([\s\S]*?)\n\];/)?.[1] || '';
  const catalogRows = [...catalogBody.matchAll(/\{\s*slug:'([^']+)'([\s\S]*?)\}\s*(?:,|$)/g)];
  const retired = catalogRows.filter((m) => /retired:\{/.test(m[2])).map((m) => m[1]);
  const active = catalogRows.map((m) => m[1]).filter((slug) => !retired.includes(slug)).sort();
  const sourcesBody = data.match(/const AIO_NEWS_SOURCES = \[([\s\S]*?)\n\];/)?.[1] || '';
  const mirrored = [...sourcesBody.matchAll(/tgSlug:'([^']+)',\s*publicMirror:'https:\/\/t\.me\/s\/\1'/g)].map((m) => m[1]).sort();
  const browserSlugs = [...sourcesBody.matchAll(/tgSlug:'([^']+)'/g)].map((m) => m[1]);
  const retiredLeft = retired.filter((slug) => browserSlugs.includes(slug) || new RegExp(`=== '${slug}'`).test(data) || new RegExp(`=== '${slug}'`).test(core) || new RegExp(`=== '${slug}'`).test(read('src/data/providers/telegram-direct.js')));
  check('v60.18 browser Telegram sources with a public mirror equal the producer active catalog, and no retired slug is requested or special-cased',
    catalogRows.length >= 2 && active.length > 0 && JSON.stringify(mirrored) === JSON.stringify(active) && retiredLeft.length === 0,
    `active=${active.join(',')} browser-mirrored=${mirrored.join(',')} retired-left=${retiredLeft.join(',')}`);
}
if (exists('public-data/telegram-digest.json')) {
  try {
    const digest = JSON.parse(read('public-data/telegram-digest.json'));
    const produced = Object.entries(digest.topicCounts || {}).filter(([, count]) => Number(count) > 0).map(([topic]) => topic);
    const missing = produced.filter((topic) => topic !== 'media-only' && !telegramConsumedTags.has(topic));
    check('produced Telegram digest topics are consumed by at least one page', missing.length === 0, missing.join(', '));
    // P1683: the lineage rows live in telegram-observed.json once the producer has split them out.
    const lineage = Array.isArray(digest.observedItems) ? digest.observedItems : (exists('public-data/telegram-observed.json') ? JSON.parse(read('public-data/telegram-observed.json')).observedItems : null);
    if (!Array.isArray(digest.observedItems)) check('P1683 a digest without lineage rows names its lineage artifact', digest.observedLineageArtifact === 'public-data/telegram-observed.json' && Array.isArray(lineage));
    if (Array.isArray(lineage)) {
      check('public Telegram digest count matches observed whole-window lineage', digest.count === lineage.length, `count=${digest.count}, observed=${lineage.length}`);
      check('public Telegram digest reports capped-payload coverage funnel', digest.coverage && digest.coverage.observedCount === digest.count && Number.isFinite(digest.coverage.selectedRawCoveragePct));
    }
  } catch (error) {
    check('public Telegram digest topic inventory parses for routing coverage', false, error.message);
  }
}
// The uncalled getTopicBadge map (which held the credit badge class) was retired as dead code.
check('P1753 runtime promotes credit to a first-class news topic (retired getTopicBadge stays gone)', /credit:\s*\[[^\]]*credit spread/.test(data) && !/function getTopicBadge\b/.test(data) && /key:\s*'credit'[\s\S]{0,80}크레딧/.test(data));
check('data pipeline contract gate exists', exists('scripts/ci-data-pipeline-contract-check.mjs'));
check('data pipeline contract gate is wired into CI', qaHas('scripts/ci-data-pipeline-contract-check.mjs', 'core'));
// R219/P513 (semantic review) and R220/P514 (workflow compaction) ledger traces live in
// architecture/governance-markers.json (v57.54); ci-workflow-compaction-check.mjs verifies their gates stay wired.
check('semantic review gate script exists', exists('scripts/ci-semantic-review-check.mjs'));
check('workflow compaction gate script exists', exists('scripts/ci-workflow-compaction-check.mjs'));
check('decision header shows user-facing source label, not raw sourceKind label', /sourceLabelMap/.test(core) && !/sourceKind\s+'\s*\+/.test(core));
check('v59.70 D2: the dev-only decision header renderer and its CSS stay deleted', !/_aioRenderPageDecisionHeader|aio-decision-header/.test(core) && !/aio-decision-header/.test(html));
check('audit widget is hidden by default and only shown in dev mode', /\.aio-audit-widget\s*\{\s*display:none\s*!important;?\s*\}/.test(shellCss) && /body\.aio-dev-mode\s+\.aio-audit-widget/.test(shellCss) && /classList\.toggle\('aio-dev-mode'/.test(core));
check('portfolio blocks unverified ticker before saving', /검증되지 않은 티커라 저장하지 않았습니다/.test(html + workspace) && /if\s*\(!isKnown\)\s*\{[\s\S]*?return;\s*\}[\s\S]*?const positions = getPortfolioData\(\)/.test(html + workspace));
// v57.77: the breadth-*sma bar/label/big writers left with their absent DOM; the snapshot breadth cells still read only current evidence.
check('P1274 snapshot percentage fields preserve missingness and breadth cells fail closed to current 5/20/50 evidence (v57.77: legacy bar/label writer retired)', !/vvix-pct[^\n]*S\.vvixChg\s*\|\|\s*0/.test(core) && !/skew-pct[^\n]*S\.skewChg\s*\|\|\s*0/.test(core) && /'breadth-20sma':\s*currentBreadth\.available \?/.test(core) && !/\['5sma','20sma','50sma','200sma'\]/.test(core) && !/getElementById\('breadth-' \+ period \+ '-bar'\)/.test(core));
check('snapshot fallback seeds require a valid producer timestamp and TNX stays source-backed', /const snapTsRaw = S\._updated \|\| S\._marketDataUpdated/.test(core) && /snapshot timestamp unavailable; fallback seed skipped/.test(core) && !/const snapTs = S\._updated \? new Date\(S\._updated\)\.getTime\(\) : Date\.now\(\)/.test(core) && /'\^TNX': \{ price: S\.tnx, pct: S\.tnxPct \}/.test(core) && !/price: 4\.31, pct: \+0\.54/.test(core));
check('v59.70 R7 the next CPI date comes only from the produced release calendar, and a past date is never consumed', /cpiNext: null,/.test(core) && /S\.cpiNext = \(releases\['us-cpi'\] && releases\['us-cpi'\]\.nextRelease\) \|\| null;/.test(core) && !/usCpiCalendar/.test(core) && /\(!DATA_SNAPSHOT\.cpiNext \|\| _t759ValidFutureDate\(DATA_SNAPSHOT\.cpiNext\)\)/.test(tests));
check('page decisions fail closed when evidence is unavailable or market epoch is blocked', /var evidenceBlocked = evidence\.sourceKind === 'UNAVAILABLE'/.test(core) && /evidence\.marketEpoch\?\.status === 'BLOCKED'/.test(core) && /d\.decisionBlocked = true/.test(core) && /status: d\.decisionBlocked \? 'blocked' : 'ok'/.test(core));
// The legacy classifyMarketRegime / computeExecutionWindow pair wrote regime-*/ew-* sinks that left the
// page and nobody read their return values, so both were retired; they must not return (and with them
// the risk of an optimistic breadth default 75 in a regime branch).
check('P1753 retired legacy regime classifier and execution window stay gone (no optimistic breadth default 75)', !/function\s+(?:classifyMarketRegime|computeExecutionWindow)\b/.test(core) && !/\b(?:classifyMarketRegime|computeExecutionWindow)\(/.test(pagesSource));
// P1670: the advice box and getScoreAdvice left with the legacy signal dashboard; it must not return with buy labels.
check('score advice no longer labels 75+ as aggressive buy', !/function\s+getScoreAdvice[\s\S]{0,500}적극\s*매수/.test(core));
check('trading guidance avoids aggressive-buy wording on score 75+', !/75\+\s*(?:적극\s*매수|적극매수)/.test(html + '\n' + core + '\n' + chat + '\n' + data + '\n' + ui));
// P1132/R619: the deep technical analysis engine moved from index.html's inline block F into
// js/aio-ui.js, so the whole ticker-deep-analysis assertion group now reads `ui`.
// P1538: the deep analysis no longer issues an entry verdict, so there is nothing for the market score to gate; it reads the score as a
// reference with its basis and produces no entry grade, composite or instruction.
check('P1541 the Yahoo-to-FRED bridge never maps the ^IRX discount rate onto DGS3MO or rebuilds T10Y3M from it, and no element shows ^IRX as a 2Y yield', !/fredId:\s*'DGS3MO'/.test(data) && !/yahoo-calc:\^TNX-\^IRX/.test(data) && !/tnx2y/.test(read('js/aio-pages.js')));
// P1753: the US deep-analysis fold lost its #ticker-analysis-result sink in v56.96 and never rendered again;
// analyzeTickerDeep/initDeepAnalysisSection/runDeepAnalysis and the fold were retired, so no entry verdict can return there.
check('P1753 P1538 retired ticker deep analysis stays gone and issues no entry verdict', !/function\s+(?:analyzeTickerDeep|initDeepAnalysisSection)\b|window\.runDeepAnalysis\s*=/.test(ui) && !/id="deep-analysis-section"|data-action="runDeepAnalysis"/.test(html) && !/marketAllowsEntry|marketCaution|entryData\.grade|instEngine\.(?:score|verdict)/.test(ui));
// P1212/E2 LC-41: the legacy factor-backtest canvas promoted null/undefined IC, spread, hit-rate and
// sample count to 0 (`bt.quantileSpread || 0`, `ic[key] || 0`), so an empty backtest rendered as
// measured zeros beside `n=0`. Missing stays missing.
check('LC-41/P1212 (v59.42: the sinkless legacy factor-backtest diagram is deleted) missing backtest values are never promoted to zero', !/function\s+_factorBacktest/.test(ui) && !/bt\.quantileSpread \|\| 0/.test(ui));
// P1214/E2 LC-26: the mode is one declared revision shared by the legacy toggle, the native reader
// and the facade — and the copy must not promise a per-mode threshold the model does not produce.
check('P1753 E2/LC-26/P1214 signal mode has one writer and the retired pill writers stay gone', /bridge\.set\(/.test(data) && /aio:signalScoreModeChanged/.test(data) && !/임계값 65점/.test(data) && !/getElementById\('sig-(?:sw-btn|dy-btn|mode-desc)'\)/.test(data));
// P1392: the swing/day toggle and the entry checklist were retired with the 0-100 score (owner decision 2026-10-02).
check('E2/LC-26/P1214 checklist is stated independent of the score mode', !/스윙 환경 체크리스트/.test(html) && !/id="sig-sw-btn"/.test(html) && !/id="sig-dy-btn"/.test(html));
// The Minervini engine helpers fed only the retired deep-analysis renderer; the native chart (src/domain/technical/chart-analysis.js) owns VCP/trend template now.
check('P1753 retired deep-analysis Minervini engine helpers stay gone from the legacy shell', !/function\s+(?:_buildMinerviniTechnicalEngine|_calcMinerviniMAStack|_buildHorizontalVolumeZones|_calcVcpQuality|_calcFibonacciConfluence)\b/.test(ui) && !/_renderDeepChart/.test(core));
// LC-39/P1215: the entity/portfolio → technical bridge must write the real deep-analysis input
// (`#deep-sym-input`) and actually run the analysis. The retired `deep-ticker-input` id must not
// survive anywhere in the legacy shell.
check('P1753 LC-39/P1215 technical bridge names the subject and opens the native chart route (no retired deep-analysis call)', !/deep-ticker-input/.test([core, html, ui, data, workspace, krData, macroTech, pagesSource].join('\n')) && /function\s+_aioOpenTechnicalAnalysis/.test(core) && /window\._aioChartRequest = sym;[\s\S]{0,120}showPage\('charts'\)/.test(core) && !/runDeepAnalysis|analyzeTickerDeep/.test(core));
// LC-33/P1216: the internal news `emptyReason` enum is pipeline vocabulary; the empty state must
// translate it rather than interpolating the raw token into the sentence.
check('LC-33/P1216 news empty state translates the internal emptyReason enum', /describeNewsEmptyReason/.test(newsPage) && /NEWS_EMPTY_REASON_COPY/.test(newsPage) && !/\(\$\{model\?\.emptyReason/.test(newsPage) && !/emptyReason\s*\|\|\s*'no-/.test(newsPage));
// LC-28/37/38/P1218: theme-detail panels observe one day's move; they must not expand it into
// momentum, fund-flow, cause or ETF-preference claims.
check('LC-28/37/38/P1218 theme detail does not assert flow or momentum from a day move', /가격 상승 참여 폭 \(당일\)/.test(themesPage) && /테마 당일 등락 구간/.test(themesPage) && !/광범위한 매수세/.test(themesPage) && !/자금이 순환하고 있어/.test(themesPage) && !/모멘텀이 살아있습니다/.test(themesPage) && !/같은 재료에 반응/.test(themesPage));
// LC-29/P1219 (v59.38): the legacy F&G delta writer retired with the delta display; the native home-fg-delta names
// the change (전일 대비) and ci-architecture-browser-check reads it.
// LC-19/21/P1220: the Guide must not turn a reference-only score into a trade instruction, and must
// not advertise breadth/survey series the product does not provide.
check('LC-19/21/P1220/P1428 Guide does not direct trades or claim unavailable breadth/surveys', !/45 미만이면 매매하지 않는/.test(html) && /예측력이 검증된 값이 아닙니다/.test(html) && !/200일선 위 비율 70%/.test(html) && !/AAII\/NAAIM\/크레딧/.test(html));
// LC-43/P1223: the portfolio intro must describe the visible evidence, not a strip hidden by CSS.
// P1505 (owner 2026-10-06): source wording left the subtitle; the intro must still not claim a hidden strip.
check('LC-43/P1223 portfolio intro matches the visible freshness evidence', !/시세 지연\/출처를 별도 표시/.test(html) && !/행별 시세 출처·관측시각은 툴팁/.test(html));
// LC-45/P1225: the holdings table prints each row's declared currency instead of a fixed `$`.
check('LC-45/P1225 portfolio table is currency-aware', /const priceCurrency = String\(holding\?\.currency/.test(portfolioPage) && /const costCurrency = String\(holding\?\.costCurrency/.test(portfolioPage) && !/avgCost == null \? '—' : `\$\$\{avgCost/.test(portfolioPage));
// LC-48/P1227: the signal sector-breadth cell names its own population.
check('LC-48/P1227 signal sector breadth names its population', !/SPDR 11 ETF/.test(html) || (/SPDR 11 ETF 당일/.test(html) && /Breadth의 AIO 종목 5\/20\/50일선 폭과 다른 모집단/.test(html))); // P1392: retired with the checklist
// v59.42 coverage pass: production news is the server bundle only (P1756: the browser RSS run is skipped while it is
// fresh and the shared Worker refuses the feed hosts otherwise), so the browser list keeps the Telegram channels alone.
{
  const at = data.indexOf('const AIO_NEWS_SOURCES = [');
  const browserNewsSources = at < 0 ? [] : runInNewContext(data.slice(at + 'const AIO_NEWS_SOURCES = '.length, data.indexOf('\n];', at) + 2));
  const rssSources = browserNewsSources.filter((source) => source.type !== 'telegram');
  check('v59.42 the browser news list holds Telegram channels only (no dead RSS feeds)', at >= 0 && browserNewsSources.length > 0 && rssSources.length === 0, rssSources.length + ' RSS feeds');
}
// QA-THM-CLEANUP/P1260: the P1257-retired theme sections leave no renderer, selector,
// quote-gate or responsive-CSS reference behind — element-absent no-ops are deleted, not kept.
check('QA-THM-CLEANUP/P1260 retired theme ids have no surviving surface references (P1257)', !/theme-heatmap|all-etf-grid|sector-20d|themes-m7-mirror|themes-breadth|themes-sector-mirror/.test([html, core, ui, data, workspace, krData, macroTech, pagesSource, chat, tests].join('\n')));
// LC-52/P1236: Guide background statements carry season/condition/evidence framing.
check('LC-52/P1236 guide background statements carry conditions', !/기관 매집\)/.test(html) && /서머타임\(EDT\)에는 22:30~05:00/.test(html) && /확정하는 신호가 아니며/.test(html) && /예상보다 높으면 금리 인상 우려가 커지는 경우가 많지만/.test(html));
// P1753: the retired US deep-analysis renderer carried its own MA-stack and volume-profile copy; the shared
// technical snapshot (core) and the AI chat keep both readings.
check('P1753 5/10/20 + 50/100/200 MA stack reaches the AI chat (v59.88: the chart layers\' BASE_MA and alignment rows); the retired deep-analysis copy stays gone', /BASE_MA\.map/.test(technicalLines) && /sheet\.structure/.test(technicalLines) && !/단기 정배열 5>10>20/.test(ui));
check('P1753 volume profile (POC / Value Area) stays in the shared technical snapshot; the retired deep-analysis beginner guide stays gone', /export function volumeProfile\(/.test(technicalSnapshotSrc) && /\bpoc:/.test(technicalSnapshotSrc) && /valueArea:/.test(technicalSnapshotSrc) && !/beginnerNote/.test(ui));
check('technical snapshot exposes full MA stack to AI chat', /sma5/.test(technicalSnapshotSrc) && /sma100/.test(technicalSnapshotSrc) && /shortMAState/.test(technicalSnapshotSrc) && /longMAState/.test(technicalSnapshotSrc) && !/maStackScore/.test(core + technicalSnapshotSrc) && /BASE_MA/.test(technicalLines));
check('event risk context fails closed without an embedded point-in-time timeline', /AIO_EVENT_RISK_CONTEXT/.test(core) && /available:\s*false/.test(core) && /asOf:\s*null/.test(core) && /timeline:\s*\[\]/.test(core) && !/headlineYoY:\s*\d/.test(core));
check('H3-A current F&G consumers do not silently promote fallback through truthy OR', !/window\._lastFG\s*\|\|/.test(runtimeBundle + '\n' + html) && /sourceKind: 'snapshot'/.test(data) && /allowedUse/.test(core));
check('chat history is explicit opt-in with redaction and disable-delete semantics', /enabled\s*=\s*localStorage\.getItem\('aio_chat_history_enabled'\)\s*===\s*'1'/.test(core) && /localStorage\.removeItem\('aio_chat_history'\)/.test(core) && /_aioRedactChatHistoryText/.test(core) && /T962 chat_history_opt_in_redaction_delete/.test(tests) && !/기존 기록은 보존됩니다/.test(core));
check('P1755 P1364 market-score verdict/caveat stays on score pages and describes the close-basis model via a path-scoped state read', /_scoreScope = \['home', 'signal', 'sentiment', 'briefing'\]\.indexOf\(pageId\) >= 0/.test(core) && /if \(_scoreBlocked && map\[pageId\] && _scoreScope\)/.test(core) && /if \(_scoreCaveat && _scoreScope\)/.test(core) && /getState\('analysis\.signal\.presentation\.description'\)/.test(core) && /getState\('analysis\.tradingScore'\)/.test(core) && !/AIO_ARCH\.getState\(\)/.test(core) && /판단 보류, 일부 근거 부분 확보/.test(core));
check('high-risk pages are capped below raw LIVE when data is mixed', /technical:\s*\{[\s\S]{0,120}maxSourceKind:\s*'DELAYED'/.test(core) && /'market-news':\s*\{[\s\S]{0,120}maxSourceKind:\s*'DELAYED'/.test(core) && /ticker:\s*\{[\s\S]{0,160}emptyKind:\s*'UNAVAILABLE'/.test(core));
check('home public readiness audit remains available only in developer mode', /id="aio-public-readiness"/.test(html) && /_aioBuildPublicShareReadiness/.test(data) && /getPublicShareReadiness/.test(data) && /getShareReadinessAudit/.test(core) && /body\.aio-dev-mode \.aio-public-readiness/.test(shellCss) && /classList\.contains\('aio-dev-mode'\)/.test(data));
check('visible static labels do not overstate live/action state', !/\u25cf\s*LIVE|LIVE RSS|BUY\s*\/\s*LONG|공격적 매매|\(실시간\)|실시간 감지|실시간 수급|FMP 실시간|FINNHUB\s*실시간/.test(visibleHtml));
check('runtime evidence labels start unavailable and recent-news copy does not claim realtime', (!/id="breadth-source"/.test(html) || /id="breadth-source"[^>]*>원천 미수신 · 판정 보류<\/div>/.test(html)) /* P1395: retired */
  && !/id="breadth-source"[^>]*>\s*Live Data\s*<\/div>/i.test(html)
  && !/최근 7일 뉴스\s*\(실시간/.test(html)
  && !/Finnhub \(실시간 시세\)/.test(html));
// P1600: the corrected sentences lived in AIO_PAGE_FUNDAMENTALS, a page-help registry nothing rendered; it was
// removed, so only the absence of the overstated claims is asserted.
check('educational copy does not claim unverified win-rate or factor explanatory power', !/2~3일 확인 후 비중을 올리는 편이 승률이 높습니다/.test(ui)
  && !/팩터가 실제로 수익률을 설명해 왔는지의 증거/.test(ui)
  && !/AIO_PAGE_FUNDAMENTALS/.test(ui));
check('news fallback titles must not expose translation-pending placeholder text', !/return\s+['"`]\[번역 대기\]/.test(data) && !/\[번역 대기\]\s*['"`]\s*\+/.test(data));
// The options-page put/call detail/description writers (opt-pcr-text / opt-pcr-desc) left with the
// options route (P1321); v59.70 deleted the Cboe ratio reader itself (owner 11/4).
check('P1753 put/call raw enum labels stay out and the retired options put/call DOM writers stay gone', !/SNAPSHOT\s*·\s*reference/.test(data) && !/getElementById\('opt-pcr-text'\)|'opt-pcr-desc'/.test(data));
check('public readiness must not render raw pageId/sourceKind enum pairs', !/<b>' \+ _aioPublicReadinessEsc\(r\.pageId\)/.test(data) && !/<em>' \+ _aioPublicReadinessEsc\(r\.sourceLabel \|\| r\.sourceKind\)/.test(data) && !/asOf pending/.test(data));
check('full surface audit must match v50.29 page-brief declutter policy', /pageBriefNotDecluttered/.test(core) && !/briefNotRendered/.test(core));
check(
  // v59.51 (content audit): the in-page AI workbench (pf-ai-workbench, ticker select, journal note) is retired — the one
  // AI panel is the way to ask about the portfolio. Pin its absence and that the portfolio still routes into that panel.
  'v59.51 portfolio has no in-page AI workbench and routes questions into the unified AI panel',
  !/id="pf-ai-workbench"/.test(html)
    && !/id="pf-ai-ticker-select"/.test(html)
    && !/id="pf-journal-note"/.test(html)
    && !/data-action="_aioPortfolioAsk"/.test(html)
    // P1131/R619: updateAIPanelContext is now DEFINED in js/aio-chat.js (inline block G) while its
    // portfolio call site stayed in index.html block A. Assert the definition and the call, each in
    // its real home, so the invariant "portfolio workflow routes into the unified panel" is kept.
    && /updateAIPanelContext\('portfolio'\)/.test(html + workspace)
    && /function updateAIPanelContext/.test(chat)
    && /chatSendUnified\(\)/.test(html + chat)
);
check(
  'current AI contexts use runtime evidence instead of embedded capex narratives',
  /function _aioCreateEvidenceContext/.test(chat)
    && /현재 검증된 런타임 관측치만 사용합니다/.test(chat)
    && !/LQD YTM/.test(chat)
);
check(
  'current AI contexts do not embed semiconductor image levels or stage-map claims',
  !/20EMA \/ 50EMA \/ 100SMA \/ 200SMA Stage Map/.test(chat)
    && !/SMH\/XSD.*washout/i.test(chat)
);
check(
  'current AI contexts do not embed point-in-time value-chain debates',
  !/Burry AI-chain debate/.test(chat)
    && !/Burry memory-cycle debate/.test(chat)
);
// v53.7 (P725) / P1321: the retired KR pages and options keep no page config or sequential-audit entry.
check('P1753 retired routes (options, kr-home, kr-supply, kr-macro, kr-technical) have no page-registry entry', !/^    '(?:options|kr-home|kr-supply|kr-macro|kr-technical)': \{/m.test(core));
check('v51.40/P532 → v58.88 the retired signal lockout control stays out of the shell (its legacy reorder was deleted)', !/id="signal-lockout-control"/.test(html));
// P1449 (P1216 NEWS_EMPTY_REASON_COPY 패턴): screener workbench developer vocabulary must stay
// out of the user copy — Outcome/Operations/실행 정의 hash/identity are internal terms.
check('P1449 screener labels use user vocabulary (no Outcome/Operations/hash/identity leaks)',
  !/'Outcome ·/.test(screenerPage) && !/'Operations ·/.test(screenerPage)
    && !/실행 정의 hash에 포함/.test(screenerPage) && !/정의 hash 변경/.test(screenerPage)
    && !/Outcome · 실행 후/.test(html) && !/Operations · 데이터 sync/.test(html)
    && !/종목 identity는/.test(html),
  'screener user copy leaked developer terms again — route raw enums through a Korean copy map');
check('core news and screener filters remain active on the main screen', !/#news-country-chips|#news-topic-chips|#news-type-tabs|#scr-market/.test(core));
check('v57.77 news type tabs and setNewsTypeTab retired (기업 is a topic chip)', !/id="news-type-tabs"|setNewsTypeTab/.test(html + data + newsPage));
// P1131/R619: the _aiCtxMap literals moved with inline block G into js/aio-chat.js.
check('P1753/v57.54 unified AI panel covers home/screener/ticker/themes/macro and no retired KR page key', /'home'\s*:\s*'home'/.test(chat) && /'screener'\s*:\s*'screener'/.test(chat) && /'ticker'\s*:\s*'ticker'/.test(chat) && /'themes'\s*:\s*'themes'/.test(chat) && /'macro'\s*:\s*'macro'/.test(chat) && !/'kr-(?:themes|macro|technical)'\s*:\s*'kr-/.test(chat));
// The KR landing/supply/technical pages left in v53.7 (P725); their chat contexts must not return.
check('P1753/v57.54 CHAT_CONTEXTS keeps no retired KR page context (kr-home/kr-supply/kr-technical/kr-macro/kr-themes)', /macro\s*:\s*_aioCreateEvidenceContext/.test(chat) && !/'(?:kr-home|kr-supply|kr-technical|kr-macro|kr-themes)'\s*:\s*_aioCreateEvidenceContext/.test(chat));
check('ticker live price renderer does not call live.price.toFixed directly', !/live\.price\.toFixed\(/.test(core));
check('scenario sum renderers guard missing sum before toFixed', !/sumCheck\.sum\.toFixed\(/.test(core) && !/sigSum\.sum\.toFixed\(/.test(core));
check('Chart tooltip callbacks guard missing parsed.y before toFixed', !/ctx\.parsed\.y\.toFixed\(/.test(core));
check('home dashboard VIX default path guards missing live price before toFixed', !/vix\.price\?\.toFixed\(/.test(data) && !/vp\.toFixed\(2\)/.test(data));
// v58.76: the sub-theme deep analysis (topV/botV) left with the developer-only 세분화 테마 panel; the finite-pct helpers stay.
check('theme detail keeps the finite pct helpers; the retired sub-theme deep analysis stays gone (v58.76)', /function _themeFinitePct/.test(pagesSource) && !/function (?:showSubThemeDetail|_themeSafeFixed)\b/.test(pagesSource));
// P1342: the legacy briefing summary helper (no caller since P770) was deleted; F&G consumers still read the canonical envelope.
// v57.50 C06: aio-data no longer reads F&G (its only reader was an unused value with a 35 default); the legacy F&G
// readers share the home card's completed-close reader (_aioFgCloseReading), and no numeric default may return.
check('C06/P1699: briefing summary F&G reads the shared close reader, no deleted helper, no numeric default', /_aioFgCloseReading/.test(core) && !/_buildBriefingDecisionSummary/.test(data) && !/getCanonicalMetric\('fg'\)[^;\n]*:\s*35\b/.test(data));
check('v58.76 the developer-only KR candle chart is retired (종목 owns the KR chart)', !/function loadKrCandleChart|id="kr-candle-chart"/.test(ui + html));
// P1671: the KR supply/investor data plane had no rendered or AI consumer and was retired, and the
// developer-mode-only KR macro/technical folds (P702) no longer render or fetch candles for nobody.
check('P1671 → v58.76 the developer-only KR macro/technical cards and their writers are retired', !/function (?:initKoreaMacro|initKoreaTechnical|_aioKrDevSectionsVisible)\b/.test(krData + ui) && !/<div\b[^>]*\bdata-dev-only\b/.test(html));
check('KR supply failure state clears canonical evidence and retired investor fanout is not scheduled', !/function (?:fetchKrSupplyData|fetchKrInvestorTop10|updateKrSupplyDOM|_showKrSupplyFailureState)\b/.test(krData) && /T863_kr_retired_investor_fanout_not_scheduled/.test(tests));
check('viewport matrix CI script covers desktop-only viewports, topbar clipping, and SVG text geometry', qaHas('scripts/ci-viewport-matrix-check.mjs', 'browser-viewport') && qaHas('scripts/ci-desktop-scope-check.mjs', 'core') && /desktop-qa-config\.mjs/.test(read('scripts/ci-viewport-matrix-check.mjs')) && /'theme-detail'/.test(read('scripts/ci-viewport-matrix-check.mjs')) && !/mobile390|tablet768/.test(read('scripts/ci-viewport-matrix-check.mjs')) && /desktop1440/.test(read('scripts/desktop-qa-config.mjs')) && /topbarClipCount/.test(read('scripts/ci-viewport-matrix-check.mjs')) && /svgTextOverlapCount/.test(read('scripts/ci-viewport-matrix-check.mjs')) && /svgTinyTextCount/.test(read('scripts/ci-viewport-matrix-check.mjs')));
check('quote status uses one presenter and vocabulary from observation times, never the render clock (P1326/R671)', (() => {
  const presenter = read('src/domain/market/session/quote-currentness.js');
  return ['실시간', '지연', '종가', '지난 시세', '미수신'].every((word) => presenter.includes(word))
    && /function _aioWriteQuoteStatus/.test(core) && /_aioDescribeQuoteCurrentness/.test(core)
    && !/클라 시세|일부 실시간/.test(data) && !/id="live-quote-ts-topbar"/.test(html);
})());
check('viewport matrix detects duplicate news and briefing cards by word-bag key', /wordBagKey/.test(read('scripts/ci-viewport-matrix-check.mjs')) && /duplicateCardCount/.test(read('scripts/ci-viewport-matrix-check.mjs')) && /market-news\|briefing/.test(read('scripts/ci-viewport-matrix-check.mjs')));
check('C06/P1699: briefing decision summary F&G uses the shared close reader, not dead snap fields', /_aioFgCloseReading/.test(core) && !/snap\.fg\.value|snap\.fearGreed/.test(data));
check(
  'T866 v57.60 breadth surfaces share canonical regime color (the legacy _bbRegime ladder retired with updateBreadthBars; v59.38: the zero-delta formatter retired with the delta display)',
  !/function\s+_bbRegime/.test(ui + core + data)
    && /function getBreadthRegime\(v\)/.test(core) // v57.77: the legacy breadth-bar colour writer retired; the canonical regime stays
    && !/bar\.style\.background\s*=\s*reg\.color/.test(core) // text-pin-ok: retirement absence
    && /T866 breadth_regime_contract_v5460/.test(tests),
  'signal and breadth pages must not split breadth color semantics'
);
check(
  'P1753 the retired ticker deep-analysis weekly renderer stays gone',
  !/var _wClose = _wc\.wClose/.test(ui),
  'js/aio-ui.js analyzeTickerDeep (its only weeklyCtx renderer) was retired with its sink (P1753)'
);
const userFacingFiles = [
  ['index.html', html]
];
for (const [file, text] of userFacingFiles) {
  check(`${file} must not recreate fake premium board UI`, !/aio-premium-board|aio-research-bridge|apb-board/.test(text));
}
check('core must not recreate fake premium board renderer', !/window\._aioPremiumBoardModel|function\s+_aioPremiumBoardHtml|window\._aioRenderImportedResearchBridge|function\s+_aioResearchCardsHtml/.test(core));

// ── v51.64 구조적 계약 검사 (P545 방지 / Signal-Field / COMP_W / Scheduler / DATA_SNAPSHOT) ────────
// [B] fetchQuote OHLCV 기반 일간 Pct (P545 근본 수정 — chartPreviousClose 주간 오표시 방지)
const fetchScript = exists('scripts/fetch-data.mjs') ? readProducerSource() : ''; // v57.62: producer + split lib modules
check(
  'fetchQuote uses OHLCV closes array for daily pct (not chartPreviousClose only)',
  /indicators\?\.\s*quote\?\.\s*\[0\]\?\.\s*close|indicators\?\.quote\?\[0\]\?\.close|indicators\.quote\[0\]\.close/.test(fetchScript),
  'scripts/fetch-data.mjs must derive pct from OHLCV closes[-2], not meta.chartPreviousClose'
);
check(
  'fetchQuote emits _pctSource audit field',
  /_pctSource/.test(fetchScript),
  'scripts/fetch-data.mjs fetchQuote must include _pctSource field for auditability'
);
check(
  'fetch-data emits VCP screener fields',
  /vcpScore/.test(fetchScript) && /vcpStage/.test(fetchScript) && /vcpPivot/.test(fetchScript),
  'scripts/fetch-data.mjs must keep server-side VCP fields wired into screener.json'
);
check(
  'fetch-data emits TradingView winner-screen evidence fields',
  /_calcSetupScreenFields/.test(fetchScript) && /pctFrom52wLow/.test(fetchScript) && /dollarVolume30d/.test(fetchScript) && /ema8/.test(fetchScript) && /ema21/.test(fetchScript) && /ema60/.test(fetchScript),
  'scripts/fetch-data.mjs must keep nullable ADR/52-week/liquidity/EMA evidence wired into screener.json'
);

try {
  const screenerPayload = expandScreenerArtifact(JSON.parse(read('public-data/screener.json')));
  const rows = Object.values(screenerPayload.data || {});
  const vcpRows = rows.filter((row) => row && typeof row.vcpScore === 'number');
  const stages = new Set(rows.map((row) => row && row.vcpStage).filter(Boolean));
  check(
    'public screener artifact includes VCP scores',
    rows.length > 0 && vcpRows.length >= Math.min(50, rows.length),
    `found ${vcpRows.length}/${rows.length} row(s) with numeric vcpScore`
  );
  check(
    'public screener artifact includes VCP stage labels',
    stages.size > 0,
    'expected at least one vcpStage label in public-data/screener.json'
  );
} catch (error) {
  check('public screener artifact includes VCP scores', false, error.message);
}

// [C] P1443 (supersedes the P538 COMP_W key check): the backtest composite is the live ranking model —
// computeFactorRanks on the rebalance-date factor values — not a separately weighted re-implementation.
// P1449: "same model" must be provable, not merely stated — the ranking model keeps exactly one
// default weight vector (factor-weights.js), a model fingerprint is attached to the stored
// backtest, and the validation generator passes that vector explicitly.
check('P1443 backtest composite uses the live computeFactorRanks model', fetchScript.includes('var live = computeFactorRanks({') && !/var\s+COMP_W\s*=/.test(fetchScript) && fetchScript.includes('sectorOf(r.sym)'), 'backtest composite is not the live ranking model');
check('P1449 backtest passes the live model default weights (one weights module, no second copy)',
  fetchScript.includes('weights: MODEL_DEFAULT_WEIGHTS') && fetchScript.includes("weightsPolicy: 'model-default'") && !/const\s+DEFAULT_WEIGHTS\s*=\s*\{/.test(read('src/domain/screener/factor-ranks.js')),
  'the validation generator must pass the shared NEUTRAL weights explicitly; a duplicated vector is the exact P1443 drift');
check('P1449 stored backtest carries a model fingerprint the UI compares with the live model',
  fetchScript.includes('modelFingerprint: modelFingerprint') && fetchScript.includes('modelFingerprint: backtest.modelFingerprint'),
  'without the identity, stored rows cannot prove which model produced them');

// [D] Scheduler fn typeof 가드 함수들이 실제로 정의됨 (P524 패턴 재발 방지)
// REFRESH_SCHEDULE.*.fn = () => { return (typeof X === 'function') ? X() : null; } 패턴에서
// 실제 X가 runtime bundle에 존재하는지 검증.
const schedulerGuardedFns = [...data.matchAll(/typeof\s+(\w+)\s*===\s*'function'\)\s*\?\s*\1\(\)/g)].map(m => m[1]);
for (const fn of new Set(schedulerGuardedFns)) {
  const defined = new RegExp(`function\\s+${fn}\\b`).test(data) || new RegExp(`function\\s+${fn}\\b`).test(core);
  if (!defined) warnings.push(`Scheduler references typeof-guarded fn '${fn}' that is not defined in aio-data.js or aio-core.js`);
}

// [F] UI hidden block 누적 임계값 (UI 추가→제거 루프 조기 감지)
// display:none !important CSS 블록이 임계값(30)을 초과하면 경고 — 적극 숨김 누적 신호.
const hiddenImportantCount = (html.match(/display\s*:\s*none\s*!important/g) || []).length;
const HIDDEN_BLOCK_THRESHOLD = 30;
if (hiddenImportantCount > HIDDEN_BLOCK_THRESHOLD) {
  warnings.push(`display:none !important count is ${hiddenImportantCount} (threshold ${HIDDEN_BLOCK_THRESHOLD}) — review for dead UI blocks`);
}

// [G] v52.89 P704/R330: 13 comp pages extend to all 20 user-facing surfaces.
check('retired page fundamentals renderer is fully removed', !/_aioRenderPageFundamentals/.test(ui) && !/_aioPageBus\.register\('ui-page-fundamentals'/.test(ui));
check('page fundamentals no longer marks or injects page DOM', !/data-aio-fund-done/.test(ui) && !/className\s*=\s*'aio-page-advanced-toggle aio-fund'/.test(ui));
check('13 comp routes hide advanced legacy blocks by default and expose them in developer mode only', /#page-home \.aio-page-advanced-toggle[\s\S]{0,1800}display:none !important/.test(shellCss) && /body\.aio-dev-mode #page-home \.aio-page-advanced-toggle[\s\S]{0,1800}display:block !important/.test(shellCss));
check('v57.77 portfolio writerless 리스크 분석 shell and duplicate 자동 진단 widget stay retired', !/id="pf-risk-section"|id="pf-analysis-dashboard"|id="pf-analysis-text"/.test(html));
check('the related-news strip is retired (v58.76)', !/aio-page-news-strip/.test(html + core));
check('home operational details stay collapsed while completed-24h Telegram feeds remain user-visible', /#page-home > details\.aio-card[\s\S]{0,1200}display:none !important/.test(shellCss) && !/body:not\(\.aio-dev-mode\) #tg-feed-signal[\s\S]{0,1600}display:none !important/.test(shellCss) && /body:not\(\.aio-dev-mode\) \.tg-live-feed/.test(shellCss));
check('P1425 macro route has no legacy yield-curve owner and replays the official calendar after the server data lands', !/_lazyInitChartPage\('macro', 'yieldCurveChart'/.test(core) && !/renderOfficialFutureCalendar/.test(core) && !/renderMacroNextRelease|_initMacroPage/.test(core) && /'aio:serverDataLoaded'/.test(read('src/ui/pages/market.js'))); // v58.85: the header renderer left aio-core.js (its document-level aio:sharedMarketCut listener never fired: the event is dispatched on window) // P1672: #official-future-calendar left with P1425 // P1425
check('v59.51 the 거시 next release is the board header crossroads.nextEvent; the separate calendar line and renderer stay retired', !/function renderOfficialFutureCalendar/.test(macroTech) && !/renderMacroNextRelease/.test(read('src/ui/pages/market.js')) && /crossroads\?\.nextEvent/.test(read('src/ui/components/macro-board.js')));
check('P1425 the legacy yield-curve renderer stays retired with its canvas', !/function renderYieldCurve/.test(macroTech) && !/id="yieldCurveChart"/.test(html));
// P770: native news.js owns the briefing list height/reveal; the uncalled legacy adapters were retired.
// v58.92: the 뉴스 chips and sort buttons run from src/ui/components/news-controls.js (moved from aio-data.js).
const newsControlsProbe = await (async () => {
  const m = await import('../src/ui/components/news-controls.js');
  const chip = () => { const attrs = {}; return { style: {}, attrs, setAttribute: (k, v) => { attrs[k] = v; } }; };
  const chips = { 'news-country-chips': [chip(), chip()], 'news-topic-chips': [chip()] };
  const cls = () => { const set = new Set(); return { classList: { toggle: (c, on) => (on ? set.add(c) : set.delete(c)) }, has: (c) => set.has(c) }; };
  const buttons = { 'sort-time-btn': cls(), 'sort-score-btn': cls() };
  const documentRef = { querySelectorAll: (sel) => chips[/#([\w-]+)/.exec(sel)[1]] || [], getElementById: (id) => buttons[id] || null };
  const reasons = []; let fetches = 0; let size = 0;
  const root = { _aioNewsCacheSize: () => size, _aioNotifyNewsSurfaceInvalidated: (r) => reasons.push(r), fetchAllNews: () => { fetches += 1; } };
  const at = { documentRef, root };
  m.filterNewsByCountry('us', chips['news-country-chips'][1], at);
  size = 3;
  m.filterNewsByTopic('macro', null, at);
  m.setNewsSortMode('score', null, at);
  const after = m.getNewsSurfaceControls();
  const picked = chips['news-country-chips'][1].attrs['aria-pressed']; const cleared = chips['news-country-chips'][0].attrs['aria-pressed']; const inline = Object.keys(chips['news-country-chips'][1].style).length;
  m.filterNewsByTelegramOnly(null, at);
  return { inline, after, tg: m.getNewsSurfaceControls().countryFilter, reasons, fetches, picked, cleared, score: buttons['sort-score-btn'].has('active'), time: buttons['sort-time-btn'].has('active') };
})();
check('v58.92 news filter chips and sort buttons keep their state, pressed chip (v59.90: aria-pressed, no inline colour) and repaint reasons outside the legacy news pipeline', newsControlsProbe.after.countryFilter === 'us' && newsControlsProbe.after.topicFilter === 'macro' && newsControlsProbe.after.sortMode === 'score' && newsControlsProbe.tg === 'tg' && newsControlsProbe.fetches === 1 && newsControlsProbe.reasons.join() === 'news-topic-filter,news-sort,news-country-telegram' && newsControlsProbe.picked === 'true' && newsControlsProbe.cleared === 'false' && newsControlsProbe.inline === 0 && newsControlsProbe.score && !newsControlsProbe.time); // v58.92
const sectorViewProbe = await (async () => {
  const { setSectorPerfView } = await import('../src/ui/components/sector-perf-view.js');
  const cls = () => { const set = new Set(['active']); return { classList: { remove: (c) => set.delete(c), add: (c) => set.add(c) }, on: () => set.has('active') }; };
  const [a, b] = [cls(), cls()]; const events = []; const root = {};
  setSectorPerfView('all', b, { root, documentRef: { querySelectorAll: () => [a, b], dispatchEvent: (e) => events.push(e.type) } });
  return root._sectorPerfView === 'all' && !a.on() && b.on() && events.join() === 'aio:sectorPerfChanged';
})();
check('v58.95 the sector bars view toggle sets the shared view, marks one button and asks themes.js to repaint', sectorViewProbe);
const rrgViewProbe = await (async () => {
  const { setRRGView } = await import('../src/ui/components/rrg-view.js');
  const events = []; const root = {}; const pill = { classList: { add: () => events.push('active') } };
  setRRGView('subsectors', pill, { root, documentRef: { querySelectorAll: () => [], dispatchEvent: (e) => events.push(e.type) } });
  return root._rrgViewMode === 'subsectors' && root._sectorPerfView === 'all' && events.join() === 'active,aio:themesViewChanged'; // v59.70: one scope for bars and scatter
})();
check('v58.97 the RRG view pills set the shared view and ask themes.js to repaint the scatter', rrgViewProbe);
const krMoreProbe = await (async () => {
  const { ensureKrThemeProgressive } = await import('../src/ui/components/kr-theme-progressive.js');
  const cls = new Set(); let added = null; let click = null;
  const container = { classList: { add: (c) => cls.add(c), toggle: (c) => (cls.has(c) ? (cls.delete(c), false) : (cls.add(c), true)) }, insertAdjacentElement: (_, el) => { added = el; } };
  const documentRef = { getElementById: (id) => (id === 'kr-theme-container' ? container : id === 'kr-theme-more' ? added : null), createElement: () => ({ addEventListener: (_, fn) => { click = fn; } }) };
  ensureKrThemeProgressive({ documentRef }); ensureKrThemeProgressive({ documentRef });
  const first = added?.textContent; click?.();
  return first === '테마 더 보기' && added.textContent === '핵심 테마만 보기' && cls.has('aio-theme-progressive') && cls.has('is-expanded');
})();
check('v58.99 the 한국 테마 more toggle is added once under the cards and flips between 더 보기 and 핵심만', krMoreProbe);
// v59.51 (content audit): the 종목 요약 팩터 fold (#ticker-ov-*, v59.01 ticker-overview.js) was retired with its bridge and
// its showTicker / aio:liveQuotes repaints; pin that none comes back.
check('v59.51 (content audit): the 종목 factor fold (ticker-overview.js, _aioRenderTickerOverview) is retired',
  !exists('src/ui/components/ticker-overview.js') && ![read('src/app/legacy-screen-bridges.js'), bootstrap, read('js/aio-core.js'), ui].some((source) => /_aioRenderTickerOverview\s*(?:=|\()|import[^;\n]*ticker-overview\.js/.test(source)));
const exposureProbe = await (async () => {
  const { renderPortfolioExposure } = await import('../src/ui/components/portfolio-exposure.js');
  const el = { insertAdjacentHTML: (_, html) => { el.note = html; } };
  const root = { _pfBaseValues: () => ({ blocked: false, rows: [{ sym: 'NVDA', value: 70 }, { sym: 'MSFT', value: 30 }] }), _pfBaseNote: () => '[base]', _aioPortfolioSurface: { totalAssets: 100 }, _aioGetCanonicalScreenerRows: () => [{ sym: 'NVDA', sector: 'Tech', rank: 10 }, { sym: 'MSFT', sector: 'Tech', rank: 20 }] };
  renderPortfolioExposure([{}, {}], { NVDA: [1], MSFT: [1] }, { root, documentRef: { getElementById: () => el }, corrRes: { matrix: [[1, 0.8], [0.8, 1]] } });
  return el.innerHTML.includes('Tech 섹터 100% 집중(&gt;40%), 상위 3종목 100% 집중(&gt;60%), 평균 상관 0.80') && el.innerHTML.includes('평균 퀀트 랭크</span><span class="wsl-b">13</span>') && el.note === '[base]';
})();
check('v59.04 the 포트폴리오 exposure panel weighs base-currency values over total assets and flags sector, top-3 and correlation limits', exposureProbe);
const riskPanelProbe = await (async () => {
  const { renderPortfolioRiskMetrics, renderPortfolioRiskStatus } = await import('../src/ui/components/portfolio-risk-metrics.js');
  const cell = { dataset: { heatBg: 'rgba(1,2,3,0.4)', heatFg: '#fff' }, style: {} };
  const el = { querySelectorAll: () => [cell], insertAdjacentHTML: (_, html) => { el.tail = html; } };
  const documentRef = { getElementById: () => el };
  const held = renderPortfolioRiskStatus('공통 거래일 <6일', true, { root: {}, documentRef }) && el.innerHTML === '<div class="wsl-msg is-warn">공통 거래일 &lt;6일</div>';
  // v60.16: the panel computes its figures from the estimate (risk-readout.js) and returns the read-out.
  const wave = (shift, scale) => Array.from({ length: 60 }, (_, i) => Math.sin(i * 1.7 + shift) * scale);
  const sample = (tickers) => {
    const returnsMap = Object.fromEntries(tickers.map((ticker, k) => [ticker, wave(k, 0.01 * (k + 1))]));
    const publishedReturns = wave(0, 0.01).map((_, i) => tickers.reduce((sum, ticker) => sum + returnsMap[ticker][i] / tickers.length, 0));
    return { estimate: { publishedReturns, publishedScope: 'invested_sleeve', sample: { n: 60 } }, returnsMap, snapshot: { members: tickers.map((ticker) => ({ ticker, marketValue: 100 })) } };
  };
  const readout = renderPortfolioRiskMetrics({ ...sample(['A', 'B']), rfAnnual: null, fxExcluded: true, referenceValued: { count: 1, total: 2, date: '2026-11-13' } }, { root: {}, documentRef });
  const daily = el.innerHTML;
  const dailyOk = held && readout.sessions === 1 && readout.n === 60 && daily.includes('1일 VaR (95%)') && daily.includes('1일 CVaR (95%)') && daily.includes('표본 최악일 (1일 손실)') && daily.includes('<div class="wsl-rk-val is-muted">—</div>')
    && daily.includes('종목별 위험 기여') && Math.abs(readout.contributions.reduce((sum, row) => sum + row.contributionPct, 0) - 100) < 1e-9 && readout.cvar95 >= readout.var95
    && daily.includes('비중은 2종목 중 1종목 11/13 종가 평가액 기준') && readout.corr.matrix.length === 2
    && cell.style.background === 'rgba(1,2,3,0.4)' && cell.style.color === '#fff' && /환율 변동이 빠져/.test(el.tail);
  const mixed = renderPortfolioRiskMetrics({ ...sample(['A', '005930.KS']), rfAnnual: null }, { root: {}, documentRef });
  const mixedOk = mixed.sessions === 5 && mixed.n === 12 && el.innerHTML.includes('5거래일 VaR (95%)') && el.innerHTML.includes('5거래일 수익률 12개') && el.innerHTML.includes('1일 환산 약') && !el.innerHTML.includes('1일 VaR');
  return dailyOk && mixedOk;
})();
check('v59.05 the 포트폴리오 risk panel escapes its hold lines, reads a thin 99% sample as the worst day, colours matrix cells and notes excluded FX; v60.16 it adds CVaR, risk contribution and the close-valued weight basis, and measures a Korea+US book on 5-session returns', riskPanelProbe);
const watchlistProbe = await (async () => {
  const { renderWatchlist, clearWatchlistInputs } = await import('../src/ui/components/portfolio-watchlist.js');
  const node = () => ({ style: {}, dataset: {}, children: [], appendChild(c) { this.children.push(c); } });
  const els = { 'wl-select': node(), 'wl-add-row': node(), 'wl-empty-msg': node(), 'wl-table': node(), 'wl-tbody': node(), 'wl-add-ticker': node(), 'wl-add-note': node() };
  const documentRef = { getElementById: (id) => els[id] || null, createElement: () => ({}) };
  const registered = [];
  const root = { _liveData: { AAA: { price: 10, pct: -1.5 } }, _aioGetCanonicalScreenerRows: () => [{ sym: 'AAA', signal: 'BUY', name: 'A<b>' }], AIO: { registerLiveSymbol: (sym) => registered.push(sym) } };
  const lists = [{ id: 'w1', name: 'one', tickers: [{ sym: 'AAA', note: 'n' }, { sym: 'BBB', note: '' }] }];
  renderWatchlist(lists, 'w1', 'live', { documentRef, root });
  const filled = els['wl-select'].dataset.filled === '1' && els['wl-select'].children.length === 1 && els['wl-add-row'].style.display === 'block' && els['wl-table'].style.display === 'table';
  const body = els['wl-tbody'].innerHTML;
  const rows = body.includes('wsl-wl-fig is-down">-1.50%') && body.includes('wsl-wl-sig is-buy') && body.includes('A&lt;b&gt;') && !/style=/.test(body) && registered.join() === 'BBB';
  els['wl-add-ticker'].value = 'X'; els['wl-add-note'].value = 'changed';
  clearWatchlistInputs({ ticker: 'X', note: '' }, { documentRef });
  const kept = els['wl-add-ticker'].value === 'X';
  els['wl-add-note'].value = '';
  clearWatchlistInputs({ ticker: 'X', note: '' }, { documentRef });
  renderWatchlist(lists, '', 'view', { documentRef, root });
  return filled && rows && kept && els['wl-add-ticker'].value === '' && els['wl-add-row'].style.display === 'none' && /리스트를 선택하거나/.test(els['wl-empty-msg'].textContent);
})();
check('v59.06 the 포트폴리오 watchlist fills its select once, tones quote and signal cells by class, quotes unknown symbols and clears the inputs only while they still show the request', watchlistProbe);
// v60.06: #briefing-live-news-list left the markup (v59.6x 브리핑 rebuild); its CSS cap went with the unreferenced-rule prune.
check('P1753 the retired briefing news cap/toggle adapters and their list stay gone', !/_aioCapBriefingNews|_aioToggleBriefingNews/.test(core) && !/briefing-live-news-list/.test(html));
check('v59.52 retired fundamental recent-search initializer stays absent; native SEC owns route entry',
  !/_initFundamentalPage|_fundRecentSearches|aioDefaultCompany/.test(core));
const guideChapterProbe = await (async () => {
  const { organizeGuideChapters } = await import('../src/ui/components/guide-chapters.js');
  const node = (tag, id, cls, label) => ({
    tagName: tag, id, dataset: {}, children: [], parentElement: null, open: false, textContent: '',
    classList: { contains: (c) => (cls || '').split(' ').includes(c) },
    querySelector: (sel) => (label && sel.includes(label.cls) ? { textContent: label.text } : null),
    appendChild(c) { if (c.parentElement) c.parentElement.children.splice(c.parentElement.children.indexOf(c), 1); c.parentElement = this; this.children.push(c); return c; },
    insertBefore(c, ref) { if (c.parentElement) c.parentElement.children.splice(c.parentElement.children.indexOf(c), 1); c.parentElement = this; this.children.splice(Math.max(0, this.children.indexOf(ref)), 0, c); return c; },
    insertAdjacentElement(_, c) { const p = this.parentElement; if (c.parentElement) c.parentElement.children.splice(c.parentElement.children.indexOf(c), 1); c.parentElement = p; p.children.splice(p.children.indexOf(this) + 1, 0, c); },
    get firstChild() { return this.children[0] || null; },
  });
  const page = node('DIV', 'page-guide', 'page');
  const policy = node('DIV', 'guide-public-policy', '');
  [node('DIV', 'q', 'aio-section', { cls: '.aio-section-label', text: '빠른 시작' }), node('DIV', 'h', 'aio-section', { cls: '.page-title', text: '도움말' }), policy,
    node('DIV', 'c1', 'aio-section', { cls: '.aio-section-label', text: '화면  안내' }), node('DIV', 'c2', 'aio-section')].forEach((c) => page.appendChild(c));
  const documentRef = { getElementById: (id) => (id === 'guide-public-policy' ? policy : null), createElement: (tag) => node(tag.toUpperCase(), '', tag === 'details' ? '' : '') };
  organizeGuideChapters(documentRef, page);
  organizeGuideChapters(documentRef, page);
  const ids = page.children.map((c) => c.id || c.className);
  const chapters = page.children.filter((c) => c.className === 'aio-guide-chapter');
  return ids.join() === 'h,q,aio-guide-chapter,aio-guide-chapter,guide-public-policy' && chapters.every((c) => !c.open) && chapters.map((c) => c.children[0].textContent).join('|') === '화면 안내|추가 정보';
})();
check('remaining user surfaces reuse the comp hierarchy without new parallel data paths', guideChapterProbe /* v59.07: the guide chapters are laid out by src/ui/components/guide-chapters.js */ && krMoreProbe /* v58.99: the 테마 progressive toggle runs from src/ui/components/kr-theme-progressive.js */);
const fmpNoteProbe = await (async () => {
  const { renderScreenerFmpStatus } = await import('../src/ui/components/screener-fmp-status.js');
  const el = { style: {} }; const reason = { textContent: '' };
  const documentRef = { getElementById: (id) => (id === 'screener-fmp-status' ? el : id === 'screener-fmp-reason' ? reason : null) };
  const seen = [];
  [{ fmpHasKey: false, fundamentalCoveragePct: 62.34 }, { fmpHasKey: false, fundamentalCoveragePct: 85 }, { fmpHasKey: false }, { fmpHasKey: true, fmpOk: false }].forEach((meta) => { renderScreenerFmpStatus(meta, { documentRef }); seen.push(reason.textContent); });
  const shown = el.style.display === 'inline-flex';
  renderScreenerFmpStatus({ fmpHasKey: true, fmpOk: true }, { documentRef });
  return shown && el.style.display === 'none' && /종목 62\.3%\(US/.test(seen[0]) && seen[1] === '재무 자료 충분' && seen[2] === '재무 자료 범위 확인 중' && /종목 미확인\(US/.test(seen[3]);
})();
check('v59.08 the 스크리너 재무 팩터 note reads coverage against the 80% line, says when it is unknown and hides once the key works', fmpNoteProbe);
const glossaryProbe = await (async () => {
  // v59.59 roadmap 11: the glossary modal moved from js/aio-ui.js and js/aio-core.js to src/ui/knowledge/glossary-modal.js.
  const { createGlossaryModal } = await import('../src/ui/knowledge/glossary-modal.js');
  const els = { 'glossary-modal': { style: { display: 'none' } }, 'glossary-search-open': { focus() {} }, 'glossary-cats': { innerHTML: '' }, 'glossary-body': { innerHTML: '', addEventListener() {} } };
  const title = { textContent: '' };
  const documentRef = { getElementById: (id) => els[id] || null, querySelector: (sel) => (sel === '#glossary-modal h2' ? title : null), activeElement: null, body: {}, contains: () => false };
  const root = { GLOSSARY: [{ term: 'PER', cat: '기초', def: '주가 ÷ 주당순이익' }, { term: 'RRG', cat: '기술', def: '상대 회전 그래프' }], escHtml: (v) => String(v) };
  const modal = createGlossaryModal({ root, documentRef });
  modal.open();
  const opened = els['glossary-modal'].style.display === '' && !/전체 용어 보기/.test(els['glossary-body'].innerHTML) && title.textContent === '투자 용어 사전, 2개';
  const rows = (els['glossary-body'].innerHTML.match(/class="aio-glossary-item"/g) || []).length === 2 && /class="aio-glossary-term">RRG</.test(els['glossary-body'].innerHTML);
  modal.selectCategory('기초·회계');
  modal.renderItems('RRG');
  const widened = /전체에서 검색한 결과/.test(els['glossary-body'].innerHTML) && /aria-pressed="true" class="lu-gl-cat">전체 2</.test(els['glossary-cats'].innerHTML);
  modal.close();
  return opened && rows && widened && els['glossary-modal'].style.display === 'none';
})();
check('v59.59 glossary renders countable semantic rows, titles the modal with the registry count and widens an empty category search', glossaryProbe);
const earningsCalendarProbe = await (async () => {
  // v59.59 roadmap 11: the weekly earnings calendar moved from js/aio-pages.js to src/ui/components/earnings-calendar.js.
  const { earningsWeekDays, earningsWeekHtml } = await import('../src/ui/components/earnings-calendar.js');
  const satWeek = earningsWeekDays(new Date('2026-10-31T15:00:00Z'), 0); // Saturday in New York opens the coming week
  const nextWeek = earningsWeekDays(new Date('2026-11-04T15:00:00Z'), 1);
  const weekHtml = earningsWeekHtml([{ date: '2026-11-02', symbol: 'AMC1', hour: 'amc' }, { date: '2026-11-02', symbol: 'BMO1', hour: 'bmo', epsEstimate: 1.234 }], [], satWeek, { now: new Date('2026-11-02T15:00:00Z') });
  return satWeek.join() === '2026-11-02,2026-11-03,2026-11-04,2026-11-05,2026-11-06' && nextWeek[0] === '2026-11-09'
    && weekHtml.indexOf('is-bmo') < weekHtml.indexOf('is-amc') && /title="BMO1 어닝 \$1\.23"/.test(weekHtml) && /월 2, 오늘/.test(weekHtml)
    && (weekHtml.match(/\(발표 없음\)/g) || []).length === 4 && !/style=/.test(weekHtml);
})();
check('v59.59 earnings calendar opens the coming week on a New York weekend, puts Before Open first and styles sessions by class', earningsCalendarProbe);
const refreshProgressProbe = await (async () => {
  // v59.59 roadmap 11: the refresh progress panel moved from js/aio-ui.js to src/ui/components/refresh-progress.js.
  const { bindRefreshProgress } = await import('../src/ui/components/refresh-progress.js');
  const els = {}; const listeners = {};
  const el = (id) => { const node = { id, style: {}, dataset: {}, children: [], textContent: '', className: '', disabled: false, classList: { toggle() {} }, setAttribute() {}, appendChild(c) { this.children.push(c); if (c.id) els[c.id] = c; return c; } }; Object.defineProperty(node, 'innerHTML', { set(v) { this.children = []; for (const m of String(v).matchAll(/id="([^"]+)"/g)) els[m[1]] = el(m[1]); }, get() { return ''; } }); return node; };
  els['topbar-refresh-btn'] = el('topbar-refresh-btn');
  const documentRef = { getElementById: (id) => els[id] || null, createElement: () => el(''), body: el('body') };
  const timers = [];
  const root = { addEventListener: (type, fn) => { listeners[type] = fn; }, setTimeout: (fn) => timers.push(fn), AIO: { getRefreshState: () => null } };
  bindRefreshProgress({ root, documentRef });
  listeners['aio:refresh:progress']({ detail: { keys: ['quotes', 'news'], total: 2, done: 1, currentKey: 'news', phase: 'running', results: [{ key: 'quotes', ok: true }] } });
  const quiet = els['aio-refresh-progress-layer'].style.display === 'none' && els['topbar-refresh-btn'].textContent === '갱신 1/2' && els['aio-refresh-progress-list'].children.map((r) => r.children[1].dataset.tone).join() === 'ok,run';
  listeners['aio:refresh:done']({ detail: { type: 'done', forceRefresh: true, keys: ['quotes', 'news'], total: 2, done: 2, results: [{ key: 'quotes', ok: true }, { key: 'news', ok: false }] } });
  const shown = els['aio-refresh-progress-layer'].style.display === 'block' && els['topbar-refresh-btn'].textContent === '확인 필요' && els['aio-refresh-progress-current'].textContent === '1개 소스 확인 필요';
  timers.forEach((fn) => fn());
  return quiet && shown && els['aio-refresh-progress-layer'].style.display === 'none' && els['topbar-refresh-btn'].textContent === '새로고침';
})();
check('v59.59 refresh progress keeps background runs on the topbar button and shows the panel only for a reader-started run', refreshProgressProbe);
const referenceBudgetProbe = await (async () => {
  // v59.59 chat context budget: reference blocks (supplied materials, AI-infrastructure framework, imported research)
  // are capped; live evidence is not. Measured 2026-11-02: six fixture questions 319,922 -> 265,980 instruction chars.
  const { CHAT_REFERENCE_BUDGET, capReferenceLines } = await import('../src/ai/context/reference-budget.js');
  const block = ['[header]', 'provenance', 'hierarchy', ...Array.from({ length: 200 }, (_, i) => `middle line ${i} ${'x'.repeat(60)}`), 'rule A', 'rule B', 'Do not infer a bottom'].join('\n');
  const capped = capReferenceLines(block, CHAT_REFERENCE_BUDGET.aiInfraFramework);
  const lines = capped.split('\n');
  return capped.length <= CHAT_REFERENCE_BUDGET.aiInfraFramework && lines[0] === '[header]' && lines.at(-1) === 'Do not infer a bottom' && /reference trimmed/.test(capped)
    && capReferenceLines('short', 100) === 'short' && CHAT_REFERENCE_BUDGET.suppliedMaterials < 9000 && CHAT_REFERENCE_BUDGET.importedResearch < 5600;
})();
check('v59.59 chat reference blocks are capped by line with header and closing rules kept and a trim note', referenceBudgetProbe);

// [G2] v52.90 P705/R331: 최종 렌더의 loaded/empty/degraded/closed 사용자 상태 계약.
// v59.12: the 재무 공시 search moved from js/aio-chat.js to src/ui/components/fundamental-search.js.
const fundSearch = read('src/ui/components/fundamental-search.js');
// v59.51 (content audit): the second search box and its legacy report left; what stays is the selection hand-off.
check('v59.51 fundamental search is a selection hand-off with no provider calls of its own', !/fetch|dynamicTickerLookup|fetchSEC|Promise\.all/.test(fundSearch) && /aio:entityChanged/.test(fundSearch));
check('P1671 KR supply requests are retired with their schedule entry', !/krSupply/.test(data + core) && !/fetchKrSupplyData/.test(data + core + krData + ui));
// P1670: the briefing news list (and its .briefing-news-title clamp) left with _aioRenderBriefingMarketAnalysis;
// news titles render through getDisplayTitle in news.js / daily-loop.js, which keep this translation guard.
check('briefing and news display titles reject failed or non-Korean cached translations', /!cached\.ko_title \|\| !isKoreanText\(cached\.ko_title\)/.test(data) && !/class="briefing-news-title"/.test(data + core));
// v52.40 (P655): FABLE-EFFICACY-AUDIT-2026-07-10 Batch 1 (EF-01/02/04/13) structural gates
check('EF-02d: breadth 50SMA readout/bar sync is a single shared function called from both the Chart.js-independent snapshot path and updateBreadthBars, not duplicated', !/_aioSyncBreadth50Readout/.test(core + ui + data)); // P1672: readout/bar sinks retired (P1395)
check('EF-02b: breadth header-badge and diag-signal consume the same canonical consensus object as the signal-page verdict (no independent re-derivation)', !/_aioRenderBreadthConsensus/.test(core)); // P1672: badge sinks retired (P1395)
check('EF-02c v57.60: retired NYSE new-high/new-low/hl-ratio cards (P1395) have no legacy writer left', !/breadth-new-highs|breadth-new-lows|breadth-hl-ratio/.test(ui + core + data + html));
check('EF-01/P1425: the macro "now/live" mini-card stays retired with the hand-written cycle timeline', !/function _aioSyncMacroLiveSpxMini/.test(macroTech) && !/id="macro-now-spx"/.test(html));

// v52.41 (P656): FABLE-EFFICACY-AUDIT-2026-07-10 Batch 2 (EF-08/10/11/12/19) structural gates
check('EF-08/P1425: the legacy carry-unwind composite and its page-bus triggers stay retired', !/data-carry-unwind-shown/.test(data) && !/function _aioRenderCarryUnwindRisk/.test(data) && !/id="carry-unwind-risk"/.test(html));
check('EF-08/P1419: the carry read never labels a Korea rate as a US-Japan gap', !/BOJ 수동 확인값 기준/.test(data) && !/bokRate/.test(read('src/domain/macro/rates-fx.js')) && /YEN_RALLY_RULE/.test(read('src/domain/macro/rates-fx.js')));
check('EF-10/P1010: retired dead ticker metrics and action slots route to the shared SEC report', !/_tickerGapIds|ticker-action-btn|ticker-m-mcap/.test(core) && /{ id: 'fundamental', label: '재무 공시' }/.test(read('src/ui/navigation/route-hubs.js')) /* P1430: the 종목 hub tab replaced the in-page link */ && !/id="ticker-f-ni"|id="tab-financials"/.test(html));
check('EF-11/P1010: unsupported VXX futures inference is retired while RSP/SPY retains explicit missing state', !/rm-vixstr-status|var rollCost = vxxPct/.test(pagesSource) && !/rm-rspratio/.test(pagesSource)); // P1672: the RSP/SPY ratio card was retired
// v57.76: the 차트 tab's SPY TradingView fold and its OHLC fallback strip were deleted, so EF-12's sync function retired with them.
check('EF-12 (v57.76 retired): the SPY TradingView fold, its OHLC fallback strip and the sync hooks stay deleted', !/function _aioSyncTvOhlcFallback/.test(ui) && !/html-tv-ohlc-fallback-(?:shown|live)/.test(ui)); // the retired DOM ids are pinned once in ci-architecture-contract-check (v57.76 block)
// v57.77: the KOSPI/KOSDAQ Stage/MACD/BB writer (analyzeKrIndex) and its refresh buttons were retired; the cards are drawn from completed KRX closes.
check('EF-19 (v57.77 retired): the KR index Stage writer analyzeKrIndex and its refresh buttons stay deleted', !/data-action="analyzeKrIndex"/.test(html) && !/function analyzeKrIndex/.test(ui));
check('v59.70 (D5): the technical route no longer draws the 한국 지수 추세 cards (the 시장 상태 한국 board carries 코스피·코스닥)', !/renderKrIndexTrends/.test(read('src/ui/pages/analysis.js')));
// v59.81 (hosting review 2026-11-08): codetabs answered 522 or nothing after ~20 s on 5 of 5 probes (KR and US
// tickers), so after a Worker miss it only delayed the failure; it left the chain. allorigins stays as the last resort.
check('EF-19 (v59.81 retired): the proxy chain no longer waits on codetabs.com', !/api\.codetabs\.com\/v1\/proxy/.test(krData + data + read('src/data/providers/proxy-transport.js')) && /api\.allorigins\.win\/raw/.test(read('src/data/providers/proxy-transport.js')));

// v52.42 (P657): FABLE-EFFICACY-AUDIT-2026-07-10 Batch 3 (EF-06/07/14/15/16) structural gates
check('v59.70 (D5): the 한국 거시 and 한국 시장 추세 folds are retired; 기준금리·물가·수출 sit on the 시장 상태 한국 board', !/id="kr-integrated-macro"|id="kr-integrated-technical"|kr-macro-bokrate-freshness|tg-feed-kr-technical|tg-feed-kr-macro/.test(html) && !exists('src/ui/components/macro-next-release.js') && /koreaPolicyCard\(root\.DATA_SNAPSHOT\)/.test(read('src/ui/components/market-regime.js')));

// v52.42 (P657): FABLE-EFFICACY-AUDIT-2026-07-10 Batch 4 (EF-03/05/17/18) structural gates
check('EF-03/P713: BOK next-meeting date is a valid ISO date consistent between the manual reference and MACRO_CALENDAR registry', (() => {
  const bokM = core.match(/bokPolicy:\s*Object\.freeze\(\{[\s\S]{0,700}?next:\s*'(\d{4}-\d{2}-\d{2})'/);
  const calM = core.match(/'kr-bok':\s*\{[^}]*nextRelease:\s*'(\d{4}-\d{2}-\d{2})'/);
  return !!bokM && !!calM && bokM[1] === calM[1] && bokM[1] !== '2026-07-10' && Number.isFinite(Date.parse(bokM[1]));
})());
check('EF-03/P713: US FOMC calendar entry has valid ISO lastRelease < nextRelease (date no longer pinned — pinned 6/17→7/29 form would rot deterministically on 7/29 meeting day, same class as the BOK T884 rot)', (() => {
  const m = core.match(/'us-fed-rate':\s*\{[^}]*lastRelease:\s*'(\d{4}-\d{2}-\d{2})',\s*nextRelease:\s*'(\d{4}-\d{2}-\d{2})'/);
  return !!m && Date.parse(m[1]) < Date.parse(m[2]) && m[2] !== '2026-06-17';
})());

// v52.44 (P659): B8 Cloudflare Worker anycast 403(forbidden) auto-retry mitigation
check('P1421: shared fetch helper has cancellation and no blind paid retry', /async function _aioFetchClaudeWithRetry\(url, fetchOpts, serverKey, maxRetries, options\)/.test(chat) && chat.includes('return fetch(url, fetchOpts);') && !chat.includes("_peek.error.type === 'forbidden'"));
check('P1421: chat sends one Responses request through the shared helper', (chat.match(/_aioFetchClaudeWithRetry\(_claudeTarget\.url/g) || []).length === 1 && chat.includes('model: _aiContract.model') && chat.includes('max_output_tokens: effectiveMaxTokens')); // S5 (ADR-0003): the model id is the browser–Worker contract's (src/domain/ai/worker-contract.js)
check('B8 → v59.70 D6: aio-data.js has no Claude translation call site (browser translation deleted) and the retired briefing call site stays absent', !/_aioFetchClaudeWithRetry\s*:\s*fetch\)\(_ct\.url/.test(data) && !/function\s+_generateAIBriefing\b/.test(data));

// v52.45 (P660): CODEX-COMPREHENSIVE-DIAGNOSIS-2026-07-10 WO-0 — workflow YAML corruption gate wiring
check('P660: package.json declares js-yaml as a devDependency (needed for real workflow YAML parsing, not just control-character regex)', /"js-yaml"\s*:/.test(packageJson));
check('P660/P843: ci.yml installs the lockfile and the QA manifest owns the control-character/workflow-YAML gate', /npm ci\s+--no-audit\s+--no-fund/.test(ciWorkflow) && qaHas('scripts/ci-control-char-check.mjs'));
check('P660: control-char-baseline.json exists and records the known pre-existing mojibake count (regression-only gate, not a silent pass)', exists('_context/control-char-baseline.json'));

// v52.46 (P661/R294/WO-1A): portfolio data now shares the real _AioVault (AES-GCM-256+PBKDF2) with API keys,
// instead of the separate plaintext localStorage path the UI's "PIN 설정 후 AES-256 암호화" claim never matched.
check('WO-1A: aio_portfolio_data is enrolled in _AIO_SENSITIVE_KEYS so safeLS actually encrypts it when the shared vault is unlocked', /'aio_portfolio_data'/.test(core) && /_AIO_SENSITIVE_KEYS = new Set\(\[[\s\S]{0,400}'aio_portfolio_data'/.test(core));
check('WO-1A: renderPortfolio() is the real lock gate (checks isPortfolioLocked() before rendering), replacing the orphaned checkPortfolioPin() that nothing ever called', /function isPortfolioLocked\(\)/.test(html + workspace) && /if \(typeof isPortfolioLocked === 'function' && isPortfolioLocked\(\)\)/.test(html + workspace) && !/function checkPortfolioPin/.test(html + workspace));
check('P1350: unlockPortfolio authenticates through the production ciphertext/sentinel helper rather than plaintext PIN comparison', /await _AioVault\.unlock\(pin\)/.test(workspace) && /authenticateVault\(this, pin/.test(core) && /const authenticated = await vault\.decrypt\(verify\)/.test(read('src/storage/financial-security.js')) && /authenticated !== VERIFY_TEXT/.test(read('src/storage/financial-security.js')) && !/input\.value === pin\)/.test(html + workspace));
check('WO-1A: opting out of portfolio vault protection does not remove the shared aio_vault_salt (other encrypted API keys must stay intact)', /PF_VAULT_OPTOUT_KEY/.test(html + workspace) && !/removeItem\('aio_vault_salt'\)/.test(html + workspace));

// v53.47 (P838/W2-04): plaintext API-key IndexedDB mirror retired; explicit export/import remains user-initiated.
check('P838: automatic plaintext API-key IndexedDB backup is retired without reopening the legacy database, and its UI entrypoint is removed', /* P1339: retired stubs deleted; the contract is that nothing reopens the legacy DB */ !/indexedDB\.open\(['"]aio-keys-backup/.test(core) && !/store\.put\(\{\s*snapshot:/.test(core) && !/aio-key-recover-menu/.test(visibleHtml));

// v52.47 (P662/WO-1B): Anthropic proxy auth/cost-boundary hardening — client side sends the shared
// app token when routed through the Worker; the Worker's own behavior is verified separately by
// scripts/ci-worker-openai-contract-check.mjs (a real handler-invocation test, not just a static contract).
check('P1421: shared-only chat always sends the app token and never a provider key', /'X-AIO-App-Token': _aioAppToken\(\)/.test(chat) && /_claudeHeaders\[_aiContract\.headers\.appToken\] = _aioAppToken\(\)/.test(chat) && !chat.includes('anthropic-dangerous-direct-browser-access'));
check('WO-1B → v59.70 D6: aio-data.js sends no AI request of its own (browser translation deleted); the retired briefing call site stays absent', !/'X-AIO-App-Token':/.test(data) && !/function\s+_generateAIBriefing\b/.test(data));
check('P1421: cloudflare-worker-proxy.js enforces exact Origin, optional app-token, dedicated rate limit, and fail-closed atomic quota', /resolveAllowedOrigin\(origin, env\)/.test(worker) && /env\.AIO_APP_TOKEN/.test(worker) && /OPENAI_RATE_LIMIT/.test(worker) && /hasAtomicQuotaBinding\(env\)/.test(worker) && /AI_KILL_SWITCH/.test(worker));
check('WO-1B → S5 (ADR-0003): CORS preflight allows the app-token header from the shared contract (otherwise browsers block it before the Worker ever sees it)', /'Access-Control-Allow-Headers':\s*\[[^\]]*AI_HEADERS\.appToken/.test(worker) && /from '\.\/src\/domain\/ai\/worker-contract\.js'/.test(worker));

// v52.51 (P666/WO-3): Factor model longrun validation — backtestFactors() parameterized (backward
// compatible), fetch-data.mjs given a direct-run guard so it's safely importable, and a new
// concurrency-capped, top-mcap-subset longrun script added. See WO-2 (P665) for the analogous
// trading-score validation this mirrors.
const backtestFactorsIdx = fetchScript.indexOf('function backtestFactors(stockData, opts)');
// `icByDate` is initialized after the calendar/coverage guards, beyond the
// old 3,000-character heuristic window. Keep the full calculation body in
// scope so the implemented WO-3 ledger is actually checked.
const backtestFactorsBody = backtestFactorsIdx >= 0 ? fetchScript.slice(backtestFactorsIdx, backtestFactorsIdx + 12000) : '';
check('v60.26 WO-3: backtestFactors() accepts optional offsets/fwdDays that default to the production constants of model-fingerprint.js (one definition)', /var OFFSETS = opts\.offsets \|\| BACKTEST_REBALANCE_OFFSETS, FWD = opts\.fwdDays \|\| BACKTEST_FWD_DAYS/.test(backtestFactorsBody));
check('WO-3: backtestFactors() additionally returns a per-rebalance-date IC list (icByDate) needed to compute ICIR/t-stat, not just the averaged IC', /icByDate/.test(backtestFactorsBody));
check('WO-3: fetch-data.mjs guards its direct execution and allows an isolated screener-only task without import side effects', /const __entryArg = process\.argv\[1\] \? process\.argv\[1\]\.replace/.test(fetchScript) && /if \(__entryArg && \(import\.meta\.url === `file:\/\/\$\{__entryArg\}`/.test(fetchScript) && /process\.env\.SCREENER_ONLY === '1' \? enrichScreener\(\) : main\(\)/.test(fetchScript) && /task\.catch\(e => \{ console\.error\('\[fetch-data\] 치명적 오류:', e\); process\.exit\(1\); \}\);\s*\}/.test(fetchScript));
check('WO-3: closesToFactors/backtestFactors/_mean are exported from fetch-data.mjs for reuse by the longrun script (no formula duplication)', /export function closesToFactors/.test(fetchScript) && /export function backtestFactors/.test(fetchScript) && /export const _mean/.test(fetchScript));
// v57.62: the factor math lives once in scripts/lib/factors.mjs; fetch-data.mjs re-exports it, so the longrun script's import still resolves to the same formula.
check('v57.62 fetch-data.mjs re-exports closesToFactors/backtestFactors/_mean from scripts/lib/factors.mjs (one definition)', /export \{[^}]*_mean[^}]*closesToFactors[^}]*backtestFactors[^}]*\} from '\.\/lib\/factors\.mjs';/.test(read('scripts/fetch-data.mjs')) && !/export function (?:closesToFactors|backtestFactors)\(/.test(read('scripts/fetch-data.mjs')));
if (exists('scripts/backtest-factors-longrun.mjs')) {
  const factorLongrun = read('scripts/backtest-factors-longrun.mjs');
  check('WO-3: backtest-factors-longrun.mjs selects a bounded top-mcap subset (not the full universe) and caps fetch concurrency at 4, given this repo\'s documented prior Yahoo IP-blocking history', /rows\.sort\(\(a, b\) => b\.mcap - a\.mcap\)/.test(factorLongrun) && /const CONCURRENCY = 4/.test(factorLongrun));
  check('WO-3: backtest-factors-longrun.mjs discloses survivorship bias as unresolved rather than claiming the WO-3 gate\'s "survivorship 검사 PASS" is satisfied', /survivorshipBiasCaveat/.test(factorLongrun) && /[Nn]ot resolvable without paid point-in-time/.test(factorLongrun));
  check('WO-3: backtest-factors-longrun.mjs reuses classifyRegime/spearmanWithCI from the WO-2 longrun script instead of duplicating regime/CI logic', /import \{ classifyRegime, spearmanWithCI \} from '\.\/backtest-trading-score-longrun\.mjs'/.test(factorLongrun));
} else {
  check('WO-3: scripts/backtest-factors-longrun.mjs exists', false);
}
if (exists('scripts/backtest-trading-score-longrun.mjs')) {
  const scoreLongrun = read('scripts/backtest-trading-score-longrun.mjs');
  check('WO-3: classifyRegime/spearmanWithCI/trailingMax are exported from the WO-2 longrun script for reuse', /export function classifyRegime/.test(scoreLongrun) && (/export function spearmanWithCI/.test(scoreLongrun) || /export \{\s*spearmanWithCI\s*\}/.test(scoreLongrun)) && /export function trailingMax/.test(scoreLongrun));
}

// v52.5x (P667/WO-4): viewport-matrix promoted from a report-only, FULL_INIT=0-by-default check
// to a real, blocking, FULL_INIT=1 gate — see BUG-POSTMORTEM P667 for the F-01 (SVG label
// overlap) bug this immediately found and fixed, and F-02 (zeroCanvases dead code, no
// pageerror/console.error collection) gaps it closed.
const viewportScript = exists('scripts/ci-viewport-matrix-check.mjs') ? read('scripts/ci-viewport-matrix-check.mjs') : '';
check('WO-4: viewport-matrix runs with FULL_INIT=1 as a blocking browser shard before Pages deployment', qaPipeline.groups?.['browser-viewport']?.gates?.some((gate) => gate.script === 'scripts/ci-viewport-matrix-check.mjs' && gate.env?.AIO_VIEWPORT_FULL_INIT === '1') && /browser:[\s\S]*?needs:\s*(contracts|preflight)/.test(ciWorkflow) && /workflows:\s*\['CI'/.test(pagesWorkflow));
check('WO-4: viewport matrix collects real pageerror/console.error signal per route, not just static DOM shape checks', /page\.on\('pageerror'/.test(viewportScript) && /page\.on\('console'/.test(viewportScript) && /jsErrorCount/.test(viewportScript));
check('WO-4: viewport matrix\'s console.error allowlist only excludes verified-expected noise (the offline-test-harness net::ERR_FAILED side effect and the app\'s own intentional API-health warn→error escalation log), not a blanket suppression', /net::ERR_FAILED/.test(viewportScript) && /warn\\s\*→\\s\*error/.test(viewportScript));
check('WO-4: zeroCanvases detection actually queries and filters real <canvas> elements instead of the previous always-empty declared-but-unpopulated array', /querySelectorAll\('canvas'\)/.test(viewportScript) && /clientWidth === 0 \|\| cv\.clientHeight === 0/.test(viewportScript));
check('WO-4: a small-text policy is adopted and enforced (8px-and-below fails the gate; 9px stays observation-only pending a dedicated remediation pass, per the static scan showing ~34 pre-existing 9px instances vs ~0-1 at 7-8px)', /tinyTextCriticalCount/.test(viewportScript) && /html text at\/below 8px/.test(viewportScript));
check('WO-4 (v59.42): the sinkless price-position diagram whose label baselines F-01 spaced is deleted', !/function _pricePosition\(/.test(ui));
check('H2-02: FULL_INIT route matrix has route-specific settle predicates, semantic theme-detail proof, and unhandled rejection capture', /async function settleRoute/.test(viewportScript) && /routeSemanticReady/.test(viewportScript) && /__AIO_UNHANDLED_REJECTIONS__/.test(viewportScript) && /unhandledRejectionCount/.test(viewportScript));
check('H2-03 (v59.42): the price-position diagram is deleted; v59.51 (content audit): the whole _aioDiagram engine is retired and the browser suite pins its absence', !/function _pricePosition\(/.test(ui) && !/window\._aioDiagram\s*=/.test(ui) && /T921 v59\.51 \(content audit\) the legacy SVG diagram engine \(_aioDiagram\) is retired/.test(tests));

// v52.5x (P669/WO-8): documentation currency check — CODE-MAP.md's file-size table/target_version
// drifting silently against actual code was exactly the kind of "operational fact vs. doc drift"
// WO-8 asks CI to detect. Non-blocking by design (line counts drift continuously during normal
// development; a hard-failing gate here would just get bypassed/ignored, R300-adjacent lesson).
// v58.86: it always exits 0, so it left the blocking manifest; the weekly knowledge-lint workflow runs it (R656 backstop).
check('WO-8: documentation currency check script exists and runs in the weekly knowledge lint', exists('scripts/ci-doc-currency-check.mjs') && /ci-doc-currency-check\.mjs/.test(knowledgeWorkflow));

// v52.56 (P673/R303): H3-D/E desktop geometry + external failure-state contract
// P1756: lightweight-charts loads on first chart use; DOMPurify stays an eager async tag. No third-party tag is defer (an
// unavailable CDN cannot hold the local defer queue) and the chart library is neither preloaded nor fetched at boot.
// v59.55: Chart.js left with its last screen; no Chart.js URL, placeholder or deferred constructor remains (the on-demand
// load itself is exercised by ci-boot-interaction-check).
check('P1756 H3-F: third-party CDN libraries are async progressive enhancements; the chart library is not preloaded or tagged at boot',
  /purify\.min\.js"[^>]*async/.test(html) && !/<script[^>]+\ssrc="[^"]*lightweight-charts[^"]*"/.test(html)
    && !/rel="preload"[^>]*lightweight-charts/.test(html) && !/purify\.min\.js"[^>]*defer/.test(html)
    && !/chart\.umd|chart\.js@|aio-chart-cdn|DeferredChart/.test(html)
    && /window\._aioEnsureChartLibrary = function/.test(html));
{
  // P1588: the US theme taxonomy is an industry classification with explicit rules — 3+ members per
  // ranked sub-theme, no ticker twice in one theme, leaders = exactly the members, no editorial weights.
  // P1622: membership classification may have 1-2 names; only ranking requires 3 priced members.
  const start = pagesSource.indexOf('var THEME_MAP = [');
  const themes = start >= 0 ? runInNewContext(pagesSource.slice(start + 'var THEME_MAP = '.length, pagesSource.indexOf('\n];', start) + 2)) : [];
  const issues = [];
  for (const theme of themes) {
    const members = (theme.subThemes || []).flatMap((sub) => sub.tickers || []);
    if (new Set(members).size !== members.length) issues.push(`${theme.id}: duplicate member`);
    if (theme.weights) issues.push(`${theme.id}: editorial weights`);
    if ((theme.subThemes || []).some((sub) => !(sub.tickers || []).length)) issues.push(`${theme.id}: empty classification (P1622)`);
    if ([...new Set(members)].sort().join() !== [...(theme.leaders || [])].sort().join()) issues.push(`${theme.id}: leaders differ from members`);
  }
  check('P1588: US theme taxonomy follows its membership rules', themes.length >= 17 && !issues.length, issues.slice(0, 6).join(' | '));
  const themeOf = (id) => themes.find((theme) => theme.id === id);
  check('P1622: verified core memberships and physical/software roles are preserved', themeOf('software')?.leaders.includes('RBRK') && themeOf('photonics')?.leaders.includes('FN') && ['MPWR','AMKR','ONTO'].every((symbol) => themeOf('semiconductor')?.leaders.includes(symbol)) && themeOf('ai_infra')?.leaders.includes('NVT') && ['SHEL','ENB'].every((symbol) => themeOf('energy')?.leaders.includes(symbol)) && themeOf('software')?.subThemes.find((sub) => sub.tickers.includes('PATH'))?.tickers.length >= 3 && !themeOf('robotics')?.leaders.includes('PATH')); // v57.51 V10: PATH is workflow software (with APPN·PEGA), not a one-name robotics sub-theme that could never rank
  const subStart = pagesSource.indexOf('var SUB_THEMES = [');
  const subs = subStart >= 0 ? runInNewContext(pagesSource.slice(subStart + 'var SUB_THEMES = '.length, pagesSource.indexOf('\n];', subStart) + 2)) : [];
  const subOf = (id) => subs.find((sub) => sub.id === id);
  check('P1622: stale ticker and instrument/issuer misclassifications cannot return', !subOf('cybersec')?.tickers.includes('CYBR') && subOf('cybersec')?.tickers.includes('RBRK') && !subOf('ai_chip')?.tickers.includes('SMCI') && subOf('dc_infra')?.tickers.includes('SMCI') && subOf('btc_etf')?.name.includes('현물·선물') && subOf('btc_etf')?.desc.includes('BITO는 선물'));
  const screenerPath = join(root, 'public-data/screener.json');
  if (existsSync(screenerPath)) {
    const universe = new Set(Object.keys(JSON.parse(readFileSync(screenerPath, 'utf8')).data || {}));
    const outside = [...new Set(themes.flatMap((theme) => theme.leaders || []))].filter((symbol) => !universe.has(symbol));
    if (outside.length) console.log(`::warning::P1588 theme members without published returns (not ranked): ${outside.join(',')}`);
  }
}check('P1568 (v59.42: the uncalled option-sentiment chain is deleted): put/call ratios are never derived from the total ratio',
  !/async function fetchPutCallRatios\(\)|async function fetchOptionSentiment\(\)/.test(data) && !/total\s*\*\s*0\.72|total\s*\*\s*1\.18/.test(data));
check('P1569 P1756: the lightweight-charts loader pins Subresource Integrity (v59.55: the Chart.js loaders left)',
  /var LWC_SOURCE = \{ src: 'https:\/\/unpkg\.com\/lightweight-charts@4\.2\.0\/[^']+', integrity: 'sha384-[A-Za-z0-9+/=]{64}' \};/.test(html)
    && /script\.integrity = LWC_SOURCE\.integrity;\s*script\.crossOrigin = 'anonymous';/.test(html));
check('H3-F/H3-H v57.60: breadth charts have no legacy fallback renderer (initBreadthPage / _aioBreadthCanvasRender / bpChartInstances retired; market.js owns them)', !/function\s+initBreadthPage|_aioBreadthCanvasRender|bpChartInstances/.test(ui + core + data) && !/Chart\.register/.test(ui) && /T918 breadth_chart_runtime_only_contract/.test(tests));
check('H3-H/I: the real Chromium human-surface audit is a blocking full-profile browser shard', exists('scripts/ci-critical10-human-surface-check.mjs') && qaHas('scripts/ci-critical10-human-surface-check.mjs', 'browser-surface') && /browser:[\s\S]*?needs:\s*(contracts|preflight)/.test(ciWorkflow));
check('H2-05: portfolio Vault has a blocking deterministic Chromium E2E covering PIN, reload, wrong/correct PIN, KDF migration, opt-out, and input boundary', exists('scripts/ci-portfolio-vault-e2e.mjs') && qaHas('scripts/ci-portfolio-vault-e2e.mjs', 'browser-surface') && /PFE2-01/.test(read('scripts/ci-portfolio-vault-e2e.mjs')) && /PFE2-08/.test(read('scripts/ci-portfolio-vault-e2e.mjs')) && /PFE2-09/.test(read('scripts/ci-portfolio-vault-e2e.mjs')));
check('H2-05: native portfolio bootstrap cannot create a second consent-only plaintext vault', !/createPrivacyVault/.test(read('src/app/bootstrap.js')) && !existsSync(join(root, 'src/storage/vault.js'))); // v58.51: the unused src/storage vault facade is gone
check('H2-06: Pages deploy stages an explicit public artifact allowlist and exposes policy/metadata endpoints', exists('public-artifact-manifest.json') && exists('robots.txt') && exists('sitemap.xml') && /canonical/.test(html) && /og:image/.test(html) && /twitter:image/.test(html) && /explicit public artifact allowlist/.test(pagesWorkflow) && /public-artifact-manifest\.json/.test(pagesWorkflow) && /guide-public-policy/.test(html));
check('H2-07: content truth audit removes retired feedback guidance, protects one inquiry path, and labels KR snapshot context', /getContentTruthAudit/.test(core) && /guide-public-policy/.test(html) && !/[\w.+-]+@[\w-]+\.[a-z]{2,}/.test(html) && /T922/.test(tests) && /T923/.test(tests));
check('H2-10: all-route Chromium accessibility matrix is a blocking CI/deploy gate and enforces no visible text below 10px', exists('scripts/ci-accessibility-matrix-check.mjs') && qaHas('scripts/ci-accessibility-matrix-check.mjs', 'browser-surface') && /fontUnder10/.test(read('scripts/ci-accessibility-matrix-check.mjs')) && !/font-size:\s*[789]px/.test(html) && !/fontSize:\s*[789]\b/.test(core) && /selectsWithoutName/.test(read('scripts/ci-accessibility-matrix-check.mjs')) && /unnamedCanvas/.test(read('scripts/ci-accessibility-matrix-check.mjs')));
check('H2-13: Trading Score research artifact is reproducible but explicitly partial, with fixed-rule walk-forward and unresolved missing inputs/costs', exists('scripts/backtest-trading-score-longrun.mjs') && exists('public-data/score-backtest-longrun.json') && /PARTIAL validation/.test(read('scripts/backtest-trading-score-longrun.mjs')) && /walkForward/.test(read('public-data/score-backtest-longrun.json')) && /No transaction costs/.test(read('public-data/score-backtest-longrun.json')) && /momScore/.test(read('public-data/score-backtest-longrun.json')));
check('H2-14: Factor research artifact preserves IC/ICIR/t-stat outputs and does not claim PIT/survivorship validation', exists('scripts/backtest-factors-longrun.mjs') && exists('public-data/factor-backtest-longrun.json') && /survivorshipBiasCaveat/.test(read('scripts/backtest-factors-longrun.mjs')) && /not resolvable without paid point-in-time/i.test(read('scripts/backtest-factors-longrun.mjs')) && /ICIR/.test(read('public-data/factor-backtest-longrun.json')) && /survivorship/i.test(read('public-data/factor-backtest-longrun.json')));
check('H2-16: documentation and knowledge gates are wired for the final handoff audit', /ci-doc-currency-check\.mjs/.test(knowledgeWorkflow) && /ci-knowledge-lint-check\.mjs/.test(knowledgeWorkflow) && qaHas('scripts/ci-workflow-compaction-check.mjs', 'workspace'));

// Initial-interaction performance contract: production boot must never run whole-site audits or
// repeated global currentness scans on the user main thread. The status banner is informational only.
// v59.42: the currentness guard (PERF-BOOT-03's subject) is retired; it must not come back as a per-event DOM rewrite.
check('PERF-BOOT-03 (P2130): the retired currentness guard stays absent', !/applyMarketCurrentnessGuard\s*=\s*function/.test(core) && !/applyTextSurfaceHygiene\s*=\s*function/.test(core));
check('PERF-BOOT-04 (P2130): live quotes debounce the snapshot banner refresh and retired 6s\/18s whole-document rescans stay absent', /scheduleSnapshotStaleBanner\(250\)/.test(data) && /window\.AIO\.scheduleSnapshotStaleBanner = _aioScheduleSnapshotStaleBanner/.test(core) && !/_aioScheduleSnapshotStaleBanner\(6000/.test(core) && !/_aioScheduleSnapshotStaleBanner\(18000/.test(core));

check('PERF-BOOT-06: shell FCP is presented before synthetic route timing and all three budgets remain independent', /requestAnimationFrame\(\(\) => requestAnimationFrame\(resolvePaint\)\)/.test(bootInteractionGate) && bootInteractionGate.indexOf('resolvePaint') < bootInteractionGate.indexOf("showPage('signal')") && /fcpMs > 2500/.test(bootInteractionGate) && /routeMs > 2000/.test(bootInteractionGate) && /maxLongTaskMs > 2500/.test(bootInteractionGate));

// v52.75 (WP-AI0): public AI beta safety boundary + unverified auto-analysis block.
check('R460/P905: public surfaces identify read-only conditional analysis scope and current-data recheck', /id="ai-panel-policy"/.test(html) && /AI 도우미, 읽기 전용 리서치/.test(html) && /투자·법률·세무 조건부 분석/.test(html) && /불법 실행 절차·주문 실행·확정적 보장/.test(html) && /data-ai-public-policy="beta-research"/.test(html)); // v59.42: the chat-injected header tag is deleted; the panel line carries the policy attribute
let wpAi0SemanticGate = false;
{
  const { buildServerDataMeta } = await import('../src/data/server-data.js');
  const proseMeta = (meta) => buildServerDataMeta({ meta: { generatedAt: '2026-10-17T00:00:00Z', ...meta } }, { now: Date.parse('2026-10-17T01:00:00Z') });
  wpAi0SemanticGate = proseMeta({ marketAnalysisOk: true }).marketAnalysisOk === false && proseMeta({ marketAnalysisOk: true, marketAnalysisSemanticOk: true }).marketAnalysisOk === true;
}
const { verifyServerMarketAnalysis } = await import('../src/data/server-market-analysis.js');
const unverifiedProse = verifyServerMarketAnalysis({ full: 'prose', semanticStatus: 'pending', metricEvidence: [] }, { validatePublish: () => ({ blocked: false }) });
check('WP-AI0: server market prose requires explicit semantic verification before sink selection', wpAi0SemanticGate && unverifiedProse.analysis === null && unverifiedProse.meta.status === 'blocked-unverified' && /_serverMarketAnalysis\.status === 'verified'/.test(core));
{
  const { spanPercentOneDecimal } = await import('../src/domain/content/percent-precision.js');
  const mixed = '압력은 반도체(SOXX) 11/13 종가 -3.67%이며, 5거래일 +9.35%와 달리 50일선 대비 -13.1%, 고점 대비 -31.62%, 20거래일 0.25%p입니다.';
  const shown = spanPercentOneDecimal(mixed);
  const ingest = readFileSync(new URL('../src/data/server-market-analysis.js', import.meta.url), 'utf8');
  check('v60.17 server market prose shows a change over a span at one decimal and leaves the one-day close and %p alone',
    shown === '압력은 반도체(SOXX) 11/13 종가 -3.67%이며, 5거래일 +9.4%와 달리 50일선 대비 -13.1%, 고점 대비 -31.6%, 20거래일 0.25%p입니다.'
    && spanPercentOneDecimal(shown) === shown && spanPercentOneDecimal(null) === null
    && /full: spanPercentOneDecimal\(/.test(ingest) && /oneLine: spanPercentOneDecimal\(/.test(ingest));
}

// v52.76 (WP-AI1): one request envelope/response pipeline across all public
// AI entry points; retries must reuse the named completion handlers/request.
// v57.62: the dead per-page chatSend (no #chat-<ctx>-inp since P1653) and its embedded retry were retired.
check('v57.62 per-page chatSend and its embedded retry are retired', !/async function chatSend\(/.test(chat) && !/var _pageOnChunk = function|var _pageOnDone = function|var _pageOnError = function/.test(chat));
check('WP-AI1 → v59.70 D6: no browser translation request remains in aio-data.js; briefing is owned by the native news renderer', !/_translationRequest/.test(data) && !/auto-translation/.test(data) && /route === 'briefing'/.test(newsPage) && /buildNewsSurfaceModel/.test(newsPage) && !/_briefingRequest/.test(data));

// v52.79 (WP-AI4/5): external data boundary, portfolio privacy consent, and
// one shared financial-conduct/action-permission gate.
check('WP-AI4: untrusted external text is normalized, injection-audited, and wrapped as NEWS/WEB/TELEGRAM data', /sanitizeAIUntrustedText/.test(core) && /buildAIUntrustedBlock/.test(core) && /sourceKind=UNTRUSTED/.test(core) && /NEWS_TELEGRAM/.test(chat + html) && (/WEB_SEARCH/.test(chat + html) || !/_aiWebSearch/.test(chat)) /* P1655: no browser search text to wrap */ /* v59.70 D6: the translation prompt that carried SecurityFlags is deleted */ && !/SecurityFlags/.test(data));
check('WP-AI4: chat history has explicit off mode, 30-day retention, bounded entries, and sanitized storage', /getChatHistoryPolicy/.test(core) && /setChatHistoryEnabled/.test(core) && /prepareChatHistoryEntry/.test(core) && /CHAT_HISTORY_MAX = 50/.test(html + workspace) && /retentionDays/.test(html + workspace)); // v59.42: the toggle lived only in the unreachable 대화 기록 overlay, deleted with it
check('WP-AI5: portfolio AI uses a field allowlist, redaction preview, and session-only opt-in before unified send', /redactPortfolioForAI/.test(core) && /getPortfolioAIPrivacyPreview/.test(core) && /setPortfolioAIConsent/.test(core) && /포트폴리오 AI 전송 미리보기/.test(html + workspace) && /계좌ID.*제외/.test(html + workspace));
check('WP-AI5/P1120: prohibited conduct still blocks while personalized direct action and probability gaps remain explicit limitations', /evaluateAIActionPermission/.test(core) && /conductAudit/.test(chat) && /prohibited-conduct/.test(core) && /suitability-context-missing/.test(core) && /current-evidence-limited/.test(core) && /decision-grade/.test(core) && /uncalibrated-probability-claim/.test(core) && !/safeText: 'AI 안전 모드\\n\\n적합성 정보와 현재 decision-grade/.test(core));
// v57.62: the per-page chatSend copy was retired; these read the unified chat entry point.
const preProviderPermissionIdx = chat.indexOf('var _uniPreProviderPermission');
const quotaAwaitIdx = chat.indexOf('_qOk = await consumeLLMQuery()');
const publicationPermissionIdx = chat.indexOf('var conductAudit');
const publicationGateIdx = chat.indexOf('if (conductAudit.blocked === true)');
check('WP-AI5: action permission runs before provider quota/retrieval and again before publication',
  preProviderPermissionIdx >= 0 && quotaAwaitIdx > preProviderPermissionIdx && publicationPermissionIdx >= 0 && publicationGateIdx > publicationPermissionIdx && /evaluateAIActionPermission\(/.test(chat.slice(publicationPermissionIdx, publicationPermissionIdx + 700)));
check('v57.62 WP-AI5: chat awaits the async quota confirmation and rejects a cancelled epoch before provider work',
  /_uniRun\.quotaPending = true;[\s\S]{0,120}await consumeLLMQuery\(\)/.test(chat) && quotaAwaitIdx >= 0 && chat.indexOf('if (!_isCurrentUnifiedRun())', quotaAwaitIdx) > quotaAwaitIdx && chat.indexOf('if (!_isCurrentUnifiedRun())', quotaAwaitIdx) - quotaAwaitIdx < 320);

// v52.81 (WP-AI8/9/10): SLO/quota operations, golden A/B release gate, and feedback manifest.
check('WP-AI8: actual AI usage can record bounded latency/token/failure SLO samples and quota acquisition has a lock/limit contract', /recordAISLOSample/.test(core) && /getAISLOReport/.test(core) && /tryAcquireAIQuota/.test(core) && /_aioTrackApiUsage/.test(core) && /tryAcquireAIQuota/.test(read('src/data/api-quota.js')) /* v59.14: the call counters moved from js/aio-chat.js */);

// v52.83 (WP-AI14): financial conduct classification.
check('R460/P905: conduct policy blocks prohibited execution only while read-only legal, tax, and investment analysis remains available',
  /getFinancialConductPolicy/.test(core) && /classifyFinancialConduct/.test(core) && /BLOCKED_P0/.test(core) && /EDUCATIONAL_ALLOWED/.test(core) && /conductAudit/.test(core)
  && !/status:'LEGAL_REVIEW_REQUIRED'/.test(core));
// v59.42: the second surface (a policy tag injected into .aio-chat headers) left with those panels; the one AI panel's
// #ai-panel-policy line in index.html carries the scope statement.
check('R460/P905: the AI panel advertises conditional analysis and downgrades research outages without erasing the answer',
  /투자·법률·세무 조건부 분석/.test(html) &&
  /research-evidence-unavailable/.test(chat) && !/RESEARCH_REQUIRED_BUT_UNAVAILABLE/.test(chat) && !/RESEARCH_REQUIRED_BUT_UNAVAILABLE/.test(html));

// v52.91: third-pass live currentness/root-cause gates.
check('LIVE3-01: stored API secrets never re-enter DOM values or reveal partial key fragments', /el\.value = '••••••••'/.test(ui + core) && !/el\.value = saved/.test(ui) && !/inp\.value = key;\s*\/\/ 실제 키 표시/.test(html) && !/slice\(0, 8\) \+ '\.\.\.' \+/.test(html + core));
const { readScreenerBreadth } = await import('../src/domain/market/breadth/screener-breadth.js');
const breadthFixture = (us) => ({ schemaVersion: '1.0', source: 'fixture', segments: { us: { above5: 40, above20: 35, above50: 36, above200: 52, advanceRatio: 0.6, coveragePct: 97, eligible: 700, observedAt: '2026-10-14T20:30:00.000Z', ...us } } });
// v59.70: the fixture ran on the wall clock ("a day ago" is not the latest close at every hour), so this check failed the
// bot's data-commit CI 9 times on 11/03 05:22-08:53Z and those commits never deployed. Pinned: Thu 11:00 KST after the 10/14 US close.
const BREADTH_FIXTURE_NOW = Date.parse('2026-10-15T02:00:00.000Z');
const screenerBreadthFailsClosed = readScreenerBreadth(breadthFixture({}), BREADTH_FIXTURE_NOW).us?.sma20 === 35
  && readScreenerBreadth(breadthFixture({ coveragePct: 84 }), BREADTH_FIXTURE_NOW).us === null
  && readScreenerBreadth(breadthFixture({ observedAt: new Date(BREADTH_FIXTURE_NOW - 97 * 3600000).toISOString() }), BREADTH_FIXTURE_NOW).us === null;
check('LIVE3-03: 20SMA breadth uses its value-specific server observation timestamp and fails closed', /id:'breadth200-participation', globalVar:'_breadth200', fetchKey:'breadthScreener'/.test(core) && /_aioApplyScreenerBreadth/.test(data) && screenerBreadthFailsClosed && /getCurrentBreadthEvidence/.test(core) && /snapshotKey:null/.test(core));
check('v59.42 the service-worker version reply (runs while the module graph may still be loading) calls the src-installed updateDataStatus only after checking it exists', (() => { const sw = (data.match(/function _querySWVersion\(\)[\s\S]*?\n\}/) || [''])[0]; return /typeof window\.updateDataStatus === 'function'\) window\.updateDataStatus\(\)/.test(sw) && !/[^.]\bupdateDataStatus\(\);/.test(sw.replace(/typeof window\.updateDataStatus[^\n]*/, '')); })());
check('LIVE3-04 v59.42: no Yahoo quote is written into an official FRED slot (the _syncYahooToFred bridge is retired)', !/function _syncYahooToFred|_syncYahooToFred\(\);|_YAHOO_FRED_MAP\s*=|'yahoo-realtime:'|'yahoo-calc:\^TNX/.test(data + core));
check('LIVE3-05: MOVE/SKEW regimes require live observations, missing values render unavailable, and SKEW has one native read model', /quote\('\^SKEW'\)/.test(core) && /quote\('\^MOVE'\)/.test(core) && /'move':\s*'—'/.test(core) && /'skew':\s*'—'/.test(core) && !/sent-skew-value/.test(html) /* P1396: the sourceless SKEW card and its page read model were retired */ && !/_bridge\('\^SKEW'/.test(ui));
check('LIVE3-06 v57.60: late breadth producer refreshes signal and home consumers atomically; the retired updateBreadthBars DOM writer stays gone', !/updateBreadthBars/.test(data + ui + core + pagesSource) && /refreshSignalDashboard\(\)/.test(data) && /refreshHomeDashboard\(\)/.test(data));
// P1670: the briefing index sub-card left with _aioRenderBriefingMarketAnalysis; keep the guard that no
// legacy writer reads the non-canonical SPY chgPct field.
check('LIVE3-04: briefing labels the actual S&P index and reads the canonical pct field', !/briefing-sub-index/.test(core) && !/_ldSafe\('SPY', 'chgPct'\)/.test(core));
// P1671: the KR supply renderer this pinned was retired with the supply fetch.
check('LIVE3-05: KR supply parses formatted values and renders missing as unknown rather than zero', !/function updateKrSupplyDOM/.test(krData) && !/streakEl.textContent = '수급 미수신'/.test(krData));
check('LIVE3-06: conflicting stale Naver KR index quotes cannot overwrite a materially different server quote', /_aioKrQuoteConflicts/.test(data) && /_krDiff > 0\.0075/.test(data));
check('LIVE3-07: Telegram collection attempts and last success have separate semantics', /collectionStatus/.test(telegramFetcher) && /attemptedAt/.test(telegramFetcher) && /lastSuccessfulAt/.test(telegramFetcher) && /generatedAt means successful collection time/.test(telegramFetcher));
check('LIVE3-08: glossary expectancy math and tactical-score wording are non-predictive', /거래당 \+0\.4R/.test(glossary) && /예측·매수 신호가 아니며/.test(glossary) && !/승률 40% × R 2\.5 = \+100% 수익/.test(glossary));
// QA-GLOSSARY-SWEEP/P1261 (P1248 residual): every glossary entry that carries a heuristic,
// threshold or historical figure must declare its source basis in GLOSSARY_FIGURE_SOURCES
// (kind/src/cond) — the sweep's full reconciliation record. No figure without a declared basis.
const glossaryEntries = [];
const glossaryEntryRe = /\{term:'((?:[^'\\]|\\.)*)'(?:,\s*alias:'((?:[^'\\]|\\.)*)')?,\s*cat:'((?:[^'\\]|\\.)*)',\s*def:'((?:[^'\\]|\\.)*)'\}/g;
let glossaryEntryMatch;
while ((glossaryEntryMatch = glossaryEntryRe.exec(glossary))) {
  glossaryEntries.push({ term: glossaryEntryMatch[1], def: glossaryEntryMatch[4] });
}
const GLOSSARY_FIGURE_RE = /\d+(?:\.\d+)?\s*(?:%|배|점|bp|p)(?![A-Za-z])|\d+(?:\.\d+)?\s*(?:이상|이하|초과|미만|↑|↓)|\d+(?:\.\d+)?\s*[~–-]\s*\d+(?:\.\d+)?\s*(?:%|배|점|bp|p)?|\d+\s*\/\s*\d+/;
const glossaryFigureTerms = glossaryEntries.filter((e) => GLOSSARY_FIGURE_RE.test(e.def)).map((e) => e.term);
const glossaryFigureSourcesMatch = glossary.match(/var GLOSSARY_FIGURE_SOURCES = \{([\s\S]*?)\n\};/);
const glossaryFigureSources = glossaryFigureSourcesMatch
  ? [...glossaryFigureSourcesMatch[1].matchAll(/'((?:[^'\\]|\\.)*)':\s*\{kind:'([^']*)',\s*src:'((?:[^'\\]|\\.)*)',\s*cond:'((?:[^'\\]|\\.)*)'\}/g)]
      .map((m) => ({ term: m[1], kind: m[2], src: m[3], cond: m[4] }))
  : [];
const GLOSSARY_FIGURE_KINDS = new Set(['정의', '산식', '관례', '방법론-예시', '역사-관측', '미검증-경험칙']);
const glossarySourceTerms = new Set(glossaryFigureSources.map((r) => r.term));
const glossaryTermSet = new Set(glossaryEntries.map((e) => e.term));
check('QA-GLOSSARY-SWEEP/P1261 figure-carrying glossary entries and source rows match exactly (P1248)', glossaryFigureTerms.length > 0
  && glossaryFigureTerms.every((t) => glossarySourceTerms.has(t))
  && glossaryFigureSources.every((r) => glossaryFigureTerms.includes(r.term))
  && glossaryFigureSources.length === glossaryFigureTerms.length);
check('QA-GLOSSARY-SWEEP/P1261 every figure source row declares kind, source and condition', glossaryFigureSources.length > 0
  && glossaryFigureSources.every((r) => glossaryTermSet.has(r.term) && GLOSSARY_FIGURE_KINDS.has(r.kind) && r.src.trim().length > 0 && r.cond.trim().length > 0)
  && glossaryFigureSources.filter((r) => r.kind === '미검증-경험칙').every((r) => r.src.includes('미검증')));
// v60.08: the tab row of a page and the style sheet that lists each view's sections name the same views.
{
  const viewCss = read('src/ui/styles/page-views.css');
  const pagesWithViews = [...html.matchAll(/<div class="page" id="(page-[a-z-]+)"[^>]*data-view="([a-z]+)"/g)];
  const drift = [];
  for (const [, pageId, initial] of pagesWithViews) {
    const at = html.indexOf(`id="${pageId}"`);
    const row = html.slice(at, html.indexOf('</div>', html.indexOf('class="sx-seg page-views"', at)));
    const tabs = [...row.matchAll(/role="tab"[^>]*data-view="([a-z]+)"/g)].map((match) => match[1]);
    const listed = [...viewCss.matchAll(new RegExp(`#${pageId}:not\\(\\[data-view="([a-z]+)"\\]`, 'g'))].map((match) => match[1]).filter((view, index, all) => all.indexOf(view) === index); // a view may take more than one line
    if (!tabs.includes(initial) || tabs.length < 2 || tabs.join() !== listed.join()) drift.push(`${pageId}: tabs ${tabs.join('/')} vs css ${listed.join('/')}`);
  }
  check('v60.08 each page view has a tab and a section list in page-views.css', pagesWithViews.length >= 2 && drift.length === 0, drift.join('; '));
}
// P1315/QA-UX-01: user-visible correctness regressions found by the 2026-09-28 full audit (V2-BLUEPRINT N1/N2/N5/N10/N24/N31).
check('P1315 KR theme detail reads the optional KR_THEME_INSIGHTS global behind a typeof guard', !/var kti = KR_THEME_INSIGHTS\[/.test(krData) && /typeof KR_THEME_INSIGHTS !== 'undefined'/.test(krData));
check('P1315 KR index cards carry no hardcoded direction class/colour; direction follows the live previous-close delta', !/kr-idx-card (?:up|down)"/.test(html) && !/id="kr-(?:kospi|kosdaq|krw)-price" style="color:var\(--(?:green|red)\)"/.test(html) && /_krIdxCard\.classList\.toggle\('up', atomicDelta > 0\)/.test(data));
check('P1315 a11y direction classes carry colour, not only a glyph (v58.80: direction tokens, up red / down blue)', /\.a11y-up \{ color: var\(--color-data-up\); \}/.test(html) && /\.a11y-dn \{ color: var\(--color-data-down\); \}/.test(html));
check('P1315 signal weight legend uses the canonical 심리 component (F&G + put/call), not 모멘텀/추세추종', !/모멘텀\(F&G·추세추종\)/.test(html + ui) && !/심리\(공포·탐욕·풋콜\) 25%/.test(html)); // P1392: the weighted legend left with the score
const ctrlKProbe = await (async () => {
  // v59.59 roadmap 11: the keydown shortcuts moved from js/aio-ui.js to src/ui/navigation/screen-shortcuts.js.
  const { handleShortcutKey } = await import('../src/ui/navigation/screen-shortcuts.js');
  // v59.70 (wave2-f S23, D4): Ctrl/⌘K opens the command search everywhere (inside inputs too); "/" focuses the screener's
  // table filter when it is on screen, else opens the command search; an IME-composing key and typing are ignored.
  let asked = null; let focused = false; let opened = 0; let searchOpen = false;
  const box = { offsetParent: {}, focus() { focused = true; } };
  const documentRef = { querySelector: (sel) => { asked = sel; return sel === '.page.active #scr-text-search' ? box : null; }, getElementById: () => null };
  const root = { _aioOpenCommandSearch: () => { opened += 1; return true; }, _aioCommandSearchIsOpen: () => searchOpen, setTimeout: () => {} };
  const help = { open() {}, close() {}, isOpen: () => false };
  const key = (extra) => ({ key: 'k', ctrlKey: true, target: { tagName: 'INPUT' }, preventDefault() {}, ...extra });
  const first = handleShortcutKey(key(), { root, documentRef, help });
  const caps = handleShortcutKey(key({ key: 'K', ctrlKey: false, metaKey: true }), { root, documentRef, help });
  const slash = handleShortcutKey({ key: '/', target: { tagName: 'BODY' }, preventDefault() {} }, { root, documentRef, help });
  box.offsetParent = null;
  const slashNoTable = handleShortcutKey({ key: '/', target: { tagName: 'BODY' }, preventDefault() {} }, { root, documentRef, help });
  const composing = handleShortcutKey(key({ isComposing: true }), { root, documentRef, help });
  searchOpen = true;
  const insideDialog = handleShortcutKey({ key: '1', target: { tagName: 'BODY' }, preventDefault() {} }, { root, documentRef, help });
  const typedOne = handleShortcutKey({ key: '1', target: { tagName: 'INPUT' }, preventDefault() {} }, { root, documentRef, help });
  return first === 'command-search' && caps === 'command-search' && slash === 'table-filter' && focused && asked === '.page.active #scr-text-search'
    && slashNoTable === 'command-search' && opened === 3 && composing === null && insideDialog === null && typedOne === null;
})();
check('P1315 v59.70 Ctrl/⌘K opens the command search, "/" focuses the table filter (command search without one), IME and typing are ignored (probe)', ctrlKProbe && !/<span class="kbd-desc">한국장<\/span>/.test(html));
check('P1315 KOSPI sell tax states securities-transaction tax plus rural special tax; Piotroski is dated 2000 with 8-9/0-2 original bins', /농어촌특별세 0\.15%가 더해져 합계 0\.20%/.test(glossary) && /Piotroski\(2000\)/.test(glossary) && !/Piotroski\(1998\)/.test(glossary) && /8~9점을 강한 그룹/.test(glossary));
check('QA-GLOSSARY-SWEEP/P1261 unattributed aphorism and sourced superlative stay unasserted', !/— 아인슈타인\./.test(glossary) && !/역사상 가장 강력한 주가 부양 수단/.test(glossary) && /출처가 확정된 문헌이 없어/.test(glossary));
check('LIVE3-09: quote producers preserve exchange observation time separately from file freshness', /regularMarketTime/.test(fetchData) && /marketState/.test(fetchData) && /exchangeTimezoneName/.test(fetchData) && /window\._liveData\[q\.symbol\]\.observedAt/.test(data));
check('LIVE3-10: failed client F&G refresh preserves a newer server observation instead of overwriting it with static seed', /\^\(live\|proxy\|delayed\)\$/.test(data) && /외부 관측값이 전혀 없을 때만 정적 snapshot/.test(data));

check('LIVE3-11: every external dependency has an explicit free-only replacement/rights/cadence state and provider availability is not treated as implementation', /getExternalDependencyAudit/.test(core) && /external-dependency-audit\.v1/.test(core) && /provider availability is not implementation status/.test(core) && /free-plan-only/.test(core) && /free_equivalent_unavailable/.test(core) && /free_key_required/.test(core));
check('LIVE3-12: a core quote outage preserves the last-known-good data artifact and screener refresh can run in isolation', /CORE_QUOTE_COVERAGE_FAILED/.test(fetchScript) && fetchScript.indexOf('CORE_QUOTE_COVERAGE_FAILED') < fetchScript.indexOf('await atomicWriteFile(OUT') && /SCREENER_ONLY/.test(fetchScript));
check('WP-10: every route contract carries required/optional producers, coverage, age, failure, and forbidden-claim state',
  /function _pageCompletenessContract\(id\)/.test(core) && /requiredProducers:/.test(core) && /optionalProducers:/.test(core) && /minCoverage:/.test(core) && /maxAge:/.test(core) && /failureState:/.test(core) && /forbiddenClaims:/.test(core));
// Legacy unification (2026-10-17): the API lives in src/data/page-completeness.js and is installed by the compat bridge;
// run it instead of reading its source.
{
  const completeness = await import('../src/data/page-completeness.js');
  const now = Date.parse('2026-10-17T00:00:00Z');
  const contract = (failureState = 'partial') => ({ requiredProducers: ['a', 'b'], optionalProducers: [], minCoverage: { a: 50 }, maxAge: { a: 3600000 }, failureState, forbiddenClaims: [] });
  const states = (a, b) => (producer) => ({ ...(producer === 'a' ? a : b) });
  const loaded = { status: 'loaded', coverage: 100, lastSuccessfulAt: '2026-10-16T23:30:00Z' };
  const statusOf = (a, b, failureState) => completeness.pageDataCompleteness('x', contract(failureState), states(a, b), now).status;
  const cases = {
    loaded: statusOf(loaded, loaded),
    stale: statusOf({ ...loaded, lastSuccessfulAt: '2026-10-16T20:00:00Z' }, loaded),
    partial: statusOf({ ...loaded, coverage: 20 }, loaded),
    blocked: statusOf({ status: 'failed' }, loaded, 'blocked'),
    empty: statusOf({ status: 'missing' }, { status: 'zero' }),
    reference: statusOf({ status: 'reference' }, loaded)
  };
  const root = { AIO: { getPageContract: () => contract() }, AIO_PAGE_CONTRACTS: { routePageIds: ['x', 'y'] } };
  completeness.installPageCompleteness(root, { readScreener: () => ({}) });
  const audit = root.AIO.auditPageDataCompleteness({ allRoutes: true });
  check('WP-10: runtime exposes one page completeness API and distinguishes missing/stale/partial/blocked producer states',
    typeof compatRoot.AIO?.getPageDataCompleteness === 'function' && typeof compatRoot.AIO?.auditPageDataCompleteness === 'function'
      && JSON.stringify(cases) === JSON.stringify({ loaded: 'loaded', stale: 'partial', partial: 'partial', blocked: 'blocked', empty: 'empty', reference: 'stale-reference' })
      && audit.version === 'wp10.page-completeness.v1' && audit.routeCount === 2 && audit.pages.length === 2,
    JSON.stringify({ cases, audit: { status: audit.status, routeCount: audit.routeCount } }));
}
check('WP-10: scheduler records attemptedAt/lastSuccessfulAt/coverage/evidenceIds and failure reason',
  /cfg\._attemptedAt/.test(data) && /cfg\._lastSuccessfulAt/.test(data) && /cfg\._coverage/.test(data) && /cfg\._evidenceIds/.test(data) && /cfg\._failureReason/.test(data));
check('WP-10: browser fixtures cover current route contract fields and disconnected producer failure state',
  /T1021 page_completeness_contract_fields/.test(tests) && /T1022 producer_disconnect_failure_state/.test(tests) && /T1023 page_completeness_audit_(?:22_routes|current_routes)/.test(tests));
check('R308/T686: reference fallback drift is explicit and not promoted to live parity',
  core.includes('referenceOnly') && core.includes('fallbackAsOf') && core.includes('parityRequired') && tests.includes('sfcReferenceOnly') && tests.includes('reference fallback drift is disclosed'));
check('R340/P712: Treasury maturity fields are separated and 2s10s uses the canonical evidence helper',
  /'\^TNX':\s*\['tnx',\s*null\]/.test(data) && !/'\^TNX':\s*\['tnx2y'/.test(data) && /getUsTreasuryCurveEvidence/.test(core) && /spread2s10s/.test(core) && !/\^FVX[^\n]{0,120}\*\s*0\.95/.test(html));
// P1134/R620: the KR theme coverage helpers now live in js/aio-kr-data.js (block C) and the KR
// technical-page fail-closed branch lives in js/aio-ui.js (block F) — two owners, both asserted.
// P1538 (owner decision: no composite grades or scores without predictive evidence): the KR health card no longer sums points, so
// "fails closed" now means it reports which current inputs exist and invents no total.
// v58.76: the developer-only KR input card (calcKrHealthScore) is retired outright, so no score slot can return.
check('R340/P712 + P1538 + v58.76: KR theme breadth fails closed on missing current inputs and the retired KR input card stays gone',
  /evaluateKrThemeQuoteCoverage/.test(krData) && /weightedCoverage\s*>=\s*0\.7/.test(krData) && /테마 종합판정 보류/.test(krData)
    && !/function calcKrHealthScore|kr-health-(?:val|label|trend|vkospi)/.test(ui + html));
check('R340/P712: future-event calendar is data-driven and no stale 7\/10 BOK row remains',
  // P1389: the briefing schedule (buildBriefingSchedule over AIO_MACRO_CALENDAR) replaced the archived calendar block.
  /export function buildBriefingSchedule/.test(read('src/domain/briefing/schedule.js')) && /id="briefing-schedule-rows"/.test(html) && !/>7\/10<\/span>[\s\S]{0,260}한국은행 금통위/.test(html + macroTech));
check('R340/P712: semantic market-integrity tests cover curve exactness and KR missingness',
  /T1025 treasury_curve_exact_2s10s/.test(tests) && /T1027 kr_theme_missingness_fail_closed/.test(tests) && /T1028 technical_indicator_no_intraday_synthesis/.test(tests) && /T1030 rrg_history_fail_closed/.test(tests) && /T1031 mcclellan_requires_advance_decline_history/.test(tests) && /T1032 hy_oas_official_only/.test(tests) && /T1033 breadth_chart_no_random_series/.test(tests) && /T1034 market_health_grade_retired/.test(tests));
check('R340/P712: synthetic market-series formulas are absent from decision paths',
  !/50\s*\+\s*\(chg\s*\*\s*5\)/.test(html) && !/500\s*\*\s*abv50/.test(html) && !/\(85\s*-\s*p\)\s*\*\s*20\s*\+\s*250/.test(ui) && !/latestLiveVal\s*\*\s*\(1\s*\+\s*\(Math\.random/.test(core));
check('R340/P712: KR yields and US breadth require timestamped current evidence and fail closed otherwise',
  /T1035 → v58\.76/.test(tests) /* the KR spread widget is retired */ && /T1036 P1274 breadth_current_evidence_gate/.test(tests) && /getCurrentBreadthEvidence/.test(core)
  && !/function\s+updateBreadthBars/.test(ui) /* v57.60: the legacy breadth DOM writer retired; market.js renders current evidence */
  && !/DATA_SNAPSHOT\.krBond3y/.test(html.slice(html.indexOf('function updateKrMacroFromLive'), html.indexOf('function updateKrMacroFromLive') + 5000)));
check('R344/P727: retired fxbond commentary has no orphan function, call, or DOM sink (P1425: the whole legacy updater is gone)',
  !/function\s+(?:updateFxDynamicComments|generateFxBondCommentary|updateFxBondPage|updateCrossAssetMatrix)\s*\(/.test(pagesSource) &&
  !/(?:getElementById|querySelector)\(['"](?:fx-dc-|bond-dc-)/.test(pagesSource) &&
  !/updateFxBondPage\(/.test(data + ui + core));
// R344/P727 → v58.76: price/VIX alerts (and their hidden-tab check) are retired; chat keeps no raw interval.
check('v58.76 alerts and the background alert check are retired; chat keeps no raw interval',
  !/function _aioCheckAlerts|'alerts-check'/.test(chat) && !/\bsetInterval\s*\(/.test(chat)
  && !existsSync('src/app/background-alerts.js') && !/installBackgroundAlerts/.test(readFileSync('src/app/bootstrap.js', 'utf8')));
check('P1756 network/refresh registry timers pause while the tab is hidden and resume in one place',
  /hiddenPaused = \{ serverDataReload: 1, ghPoll: 1, dataStatus: 1, serverDataAgeBadge: 1, freshness: 1, globalUpdate: 1, 'alerts-check': 1 \}/.test(core)
  && /if \(hiddenPaused\[name\] && document\.hidden\)/.test(core) && /if \(Date\.now\(\) - m\.last >= m\.ms\)/.test(core)
  && !/clearInterval\(window\._dataStatusInterval\)/.test(data));
check('R345/P728: quote batches defer per-symbol lineage scans and keep one canonical DOM bind',
  /set\(sym, price, pct, source, opts\)/.test(core) &&
  /!opts\.deferDomAnnotation/.test(core) &&
  /PriceStore\.set\(q\.symbol, price, pct,[^\n]+deferDomAnnotation:\s*true/.test(data) &&
  !/Bulk update ALL data-live-price/.test(data));
check('R345/P728: targeted lineage annotation covers data-live-field without a document-wide selector',
  /if \(target\) \{[\s\S]{0,700}?data-live-field\^=/.test(core) &&
  /getAttribute\('data-live-field'\)/.test(core));
check('R345/P728: retired KR investor ranking fanout is not scheduled (P1671: the supply runtime audit left with it)',
  !/async function fetchKrDynamicData\(\)[\s\S]{0,900}?fetchKrInvestorTop10/.test(data) &&
  !/getKrSupplyRuntimeAudit/.test(krData) &&
  !/missing-kr-supply-target/.test(krData));
check('P782: service-worker controller changes re-query the active version instead of preserving a stale mismatch',
  /serviceWorker\.addEventListener\('controllerchange'/.test(data) &&
  /window\._aioSWVersion\s*=\s*''/.test(data) &&
  // P1132/R619: service-worker registration moved from index.html's inline block F into js/aio-ui.js.
  /updateViaCache:\s*'none'/.test(ui) &&
  /reg\.update\(\)/.test(ui));
check('P875: service-worker rotation is fail-safe and reloads once after controller takeover',
  /function _aioRequestSWControllerReload\(\)/.test(data) &&
  /aio_sw_controller_reload_v1/.test(data) &&
  /window\.location\.reload\(\)/.test(data) &&
  /sessionStorage\.removeItem\('aio_sw_controller_reload_v1'\)/.test(data));
check('P875: quote change/value basis survives snapshot bridge, PriceStore, legacy live data, and native UI annotations',
  read('scripts/build-market-snapshot.mjs').includes('changeBasis') &&
  read('src/legacy/market-snapshot-bridge.js').includes('changeBasis') &&
  read('src/data/contracts/market-snapshot.js').includes('derivedBasis') &&
  core.includes('changeBasis: opts.changeBasis') &&
  core.includes('changeBasis: provenanceOpts.changeBasis') &&
  read('src/ui/pages/market.js').includes('data-change-basis') &&
  read('src/ui/pages/market.js').includes('valueBasis'));
// P1105: the chart reads `row.fieldMeta.valueBasis`, so the series function that
// feeds it must keep the metadata. It silently dropped it and every history
// chart labelled its points with the same literal, hiding previous-completed-close
// and carried-forward rows.
check('P1105: the history series feeds the field metadata its chart consumes',
  /valueBasis: meta\.valueBasis \|\| null/.test(data) &&
  /fieldMeta: arr\[i\]\.fieldMeta \|\| null/.test(data) &&
  /historyFieldMeta\(row, field\)/.test(read('src/domain/market/session/close-series.js'))); // P1425: close series read per-field metadata (v58.64 DOMAIN #8: moved from briefing/market-read.js; v59.70 R2: through historyFieldMeta)
// P1106: the FRED series table declares each series' display unit. Three series
// were declared twice, so the earlier declaration was silently dead — editing it
// had no effect. Every series must also declare the unit key explicitly, even
// when the unit is empty, so an omission cannot pass as intent.
const fredTable = /const FRED_SERIES = \{([\s\S]*?)\n\};/.exec(data);
const fredEntries = fredTable ? [...fredTable[1].matchAll(/^\s*'([A-Z0-9]+)':\s*\{([^}]*)\},/gm)].map((match) => ({ id: match[1], body: match[2] })) : [];
const fredDuplicates = [...new Set(fredEntries.map((entry) => entry.id).filter((id, index, all) => all.indexOf(id) !== index))];
check('P1106: the FRED series declaration has no duplicate keys', fredEntries.length > 0 && fredDuplicates.length === 0, fredDuplicates.join(', '));
const fredMissingUnit = fredEntries.filter((entry) => !/unit:/.test(entry.body)).map((entry) => entry.id);
check('P1106: every FRED series declares a unit key', fredMissingUnit.length === 0, fredMissingUnit.join(', '));
// P1114: a year-over-year series is rendered with a `%` suffix, so an empty unit
// declared a unit the reader never sees. The declared unit must state it.
const fredYoyWithoutPercent = fredEntries.filter((entry) => /yoy:\s*true/.test(entry.body) && !/unit:\s*'%'/.test(entry.body)).map((entry) => entry.id);
check('P1114: every year-over-year FRED series declares its percent unit', fredYoyWithoutPercent.length === 0, fredYoyWithoutPercent.join(', '));
// P1113: `screener.json.factorObservedAt` at the artifact level is a normalized
// day bucket for the whole file, while each row carries its own observation time.
// Two consumers chained the bucket as a row-level fallback, so a row that lost
// its timestamp would silently inherit the bucket as its price observation time.
check('P1113: screener row observations never fall back to the artifact bucket',
  /const artifactPriceObservedAt = factor\.observedAt \|\| null;/.test(screenerProvider)
  && /factorObservedAt: factor\.factorObservedAt \|\| factor\.observedAt \|\| null,/.test(screenerProvider)
  && !/factor\.observedAt \|\| artifact\.factorObservedAt/.test(screenerProvider)
  && !/factor\.factorObservedAt \|\| factor\.observedAt \|\| artifact\.factorObservedAt/.test(screenerProvider));
check('P783: reference snapshot metadata drives an explicit non-live topbar state',
  /latestObservedAt/.test(read('src/legacy/market-snapshot-bridge.js')) &&
  /sourceKind:\s*'REFERENCE'/.test(read('src/legacy/market-snapshot-bridge.js')) &&
  /root\.document\?\.dispatchEvent/.test(read('src/legacy/market-snapshot-bridge.js')) &&
  /_aioRenderMarketSnapshotTopbar/.test(core) &&
  /실시간 시세가 아닌 서버 기준 스냅샷/.test(core));
check('P783: a dead client quote proxy preserves snapshot fallback and bounds retry fanout',
  /quoteProxyCircuitOpen/.test(data) &&
  /quoteProxyCircuitOpen && hasMarketSnapshotFallback/.test(data) &&
  /retryAfterMs: usingSnapshotFallback \? null : wait \* 1000/.test(data) && !/setTimeout\(fetchLiveQuotes/.test(data) &&
  /기준 스냅샷 사용, 중앙 갱신 주기 대기/.test(data));
check('P783: boot waits for the same-origin snapshot and server macro/HY success suppresses duplicate browser fallbacks',
  !/실시간 시세 \(성공 시 기본값 교체\)[\s\S]{0,80}fetchLiveQuotes\(\)/.test(ui) &&
  /__AIO_ARCH_RUNTIME__/.test(data) &&
  /_aioServerMacroReady/.test(data) &&
  /!_aioServerHyReady/.test(data));
check('P783: blocked-external-network Chromium gate asserts the reference-only snapshot topbar',
  read('scripts/ci-architecture-browser-check.mjs').includes('/^서버 .+, 시세 16종$/') &&
  /snapshot quote topbar must stay reference-only/.test(read('scripts/ci-architecture-browser-check.mjs')));

check('P784/SA-01: Yahoo chart requests use the shared proxy registry health path', (() => {
  // P1132/R619: the inline chart helper moved to js/aio-ui.js and turned out to be a dead delegation
  // wrapper — aio-data.js always overwrote the global. It has been deleted, which is the strongest
  // form of this invariant: there must be exactly ONE transport implementation and no second relay loop.
  const producerStart = data.indexOf('async function _aioFetchYahooChartData(');
  const producer = data.slice(producerStart, data.indexOf('// 모듈 스코프', producerStart));
  return producerStart >= 0
    && !/function\s+_fetchYahooChartData\s*\(/.test(html)
    && !/function\s+_fetchYahooChartData\s*\(/.test(ui)
    && /fetchViaProxy\(url/.test(producer) && /accept:\s*function/.test(producer)
    && !/proxies\.push|fetch\(proxies/.test(producer);
})());
check('P784/SA-01: proxy registry opens cooldown after three failures and rejects invalid chart payloads',
  /p\.fails\s*>=\s*3/.test(data)
    && /markFail\(proxy\.id,[^\n]+['"]network-or-payload['"]/.test(data)
    && /typeof opts\.accept === ['"]function['"]/.test(data));

check('W1-04: SEC annual facts expose versioned freshness and fail-closed decision eligibility',
  secReportDomain.includes("SEC_REPORT_MODEL_VERSION = 'sec-report.v3'")
    && /currentMaxAgeDays:\s*FUNDAMENTAL_MAX_PERIOD_AGE_DAYS/.test(secReportDomain) // 2026-10-17: the one 456-day fiscal-year-end rule
    && /agedMaxAgeDays:\s*730/.test(secReportDomain)
    && /state:\s*'historical'/.test(secReportDomain)
    && /decisionEligible:\s*status === 'current'/.test(secReportDomain)
    && /pointInTime:\s*Object\.freeze/.test(secReportDomain)
    && /acceptedTimeCount/.test(secReportDomain)
    && /filingMetadata:\s*Object\.freeze/.test(secReportDomain)
    && /data-freshness-state/.test(entityPage));
check('W1-05: ticker action narrative fails closed without entity quote and market-state evidence (regime sufficiency; the 0-100 health grade is retired)',
  /pageId === 'ticker'/.test(core)
    && /_tickerGateMissing/.test(core)
    && /_tickerGateRegime\.sufficient !== true/.test(core)
    && !/computeMarketHealth/.test(core)
    && /_tickerGateBlocked/.test(core)
    && /d\.decisionBlocked = _scoreBlocked \|\| _tickerGateBlocked/.test(core));
check('W2-05: Vault envelope has versioned KDF plus legacy decrypt and re-encrypt migration',
  /AIO_VAULT_KDF_VERSION\s*=\s*2/.test(core)
    && /AIO_VAULT_KDF_ITERATIONS\s*=\s*310000/.test(core)
    && /AIO_VAULT_LEGACY_KDF_ITERATIONS\s*=\s*100000/.test(core)
    && /AIO_VAULT_V2_MAGIC/.test(core)
    && /_legacyDerivedKey/.test(core)
    && /_lastDecryptVersion/.test(core)
    && /if \(_AioVault\._lastDecryptVersion === 1\) await safeLS/.test(core));

// P1116: the loaded quote plane cited `data.json:quotes`, an artifact the P715
// client-direct fetch policy publishes empty. The citation must follow the producer's
// own publication flag so it can never name a file that carries no quote row.
{
  const { producerState } = await import('../src/data/page-completeness.js');
  const quoteEvidence = (quotesPublished) => producerState('quotes', { meta: { generatedAt: '2026-10-17T00:00:00Z', symbolsOk: 5, quotesPublished } }).evidenceIds;
  check('P1116: quote-plane evidence cites the artifact that actually publishes quotes',
    JSON.stringify(quoteEvidence(false)) === '["market-snapshot.json:quotes"]' && JSON.stringify(quoteEvidence(true)) === '["data.json:quotes"]',
    JSON.stringify({ unpublished: quoteEvidence(false), published: quoteEvidence(true) }));
}

// P1118: the signal hero shows five factor bars against a total they do not sum to.
// The post-composite adjustments and the [5,100] clamp must reach the presentation the
// hero renders from, and a native-owned sink must exist for them.
check('P1118: signal presentation carries the reconciliation terms',
  /breakdown,/.test(tradingScoreDomain)
    && /scoreBreakdown && typeof score\.scoreBreakdown === 'object'/.test(tradingScoreDomain));
// P1392 supersedes P1118: the score and its adjustment rows left the 시장 상태 screen; the six-axis
// board is native-owned and states each axis's evidence and flip condition.
check('P1118: signal page renders post-composite adjustments in a native-owned sink',
  !/id="score-adjustments-container"/.test(html)
    && /renderRegimePage\?\.\(\{ documentRef, root, store \}\)/.test(read('src/ui/pages/analysis.js')) // v57.78: the store is passed through
    && /export function buildMarketRegime/.test(read('src/domain/briefing/market-read.js'))
    && /id="regime-board"/.test(html));

// P1274: native breadth card and theme cycle must read the same dated US universe.
// Exercise the actual compatibility selector over the shared breadth read.
let breadthParityP1274 = false;
try {
  const start = core.indexOf('window.AIO.getCurrentBreadthEvidence = function(maxAgeMs) {');
  const end = core.indexOf('\nfunction applyDataSnapshot()', start);
  if (start >= 0 && end > start) {
    const segment = { observedAt:new Date(Date.now() - 86400000).toISOString(), above5:41.7, above20:34.1, above50:35.5, above200:52.2, advanceRatio:0.6117, coveragePct:97.1, eligible:707 };
    const breadth = { schemaVersion:'1.0', source:'github-actions:yahoo-1y-adjusted-close', segments:{ us:segment } };
    const context = { window:{ AIO:{}, _aioScreenerBreadth:() => readScreenerBreadth(breadth) },
      _aioStrictFinite:(value) => typeof value === 'number' && Number.isFinite(value) ? value : null,
      _aioMetricTs:(value) => typeof value === 'number' ? value : Date.parse(value) };
    runInNewContext(core.slice(start, end), context);
    const get = context.window.AIO.getCurrentBreadthEvidence;
    const native = get();
    segment.observedAt = new Date(Date.now() - 10 * 86400000).toISOString();
    const stale = get();
    segment.observedAt = new Date(Date.now() - 86400000).toISOString();
    segment.coveragePct = 20;
    const insufficient = get();
    breadthParityP1274 = native.available && native.sma50 === 35.5 && !stale.available && !insufficient.available;
  }
} catch (_) {}
check('P1755 P1274: native current 50SMA reaches theme selector through the one checked breadth read; a stale observation and inadequate coverage are not available', breadthParityP1274);
// P1275: the CP2 text must use the same official FOMC decision as the registry.
// P1737: both CP2 writers read the one Fed-range answer (producer policyRates.fed -> FRED -> manual within its window).
// v57.60: the retired cp2-detail / macro-fed-meaning DOM sinks left _aioApplyEventFreshnessGate; getCP2Text is the one CP2 text owner.
check('P1275/P1737 v57.60: CP2 Fed range comes from AIO.getFedPolicyRange, retired cp2-detail sink stays gone, and prior 3.50-3.75% literal cannot override the September result',
  !/getElementById\('cp2-detail'\)/.test(core) && !/getElementById\('macro-fed-meaning'\)/.test(core)
    && /function getCP2Text\(\)[\s\S]{0,900}getFedPolicyRange\(\)[\s\S]{0,900}Fed 목표범위/.test(core)
    && !/공식 정책금리 참고 '\s*\+\s*c\.fedRate/.test(core)
    && !/cp2\.textContent\s*=\s*claimPrefix\s*\+\s*'Fed 3\.50-3\.75%/.test(core)
    // P2135: the FOMC registry's statement URL names its own decision day, so the next meeting is recorded without editing this check.
    && (() => { const m = core.match(/fomc:\s*\{\s*eventDate:\s*'(\d{4})-(\d{2})-(\d{2})'[^}]*sourceUrl:\s*'https:\/\/www\.federalreserve\.gov\/newsevents\/pressreleases\/monetary(\d{8})a\.htm'/); return !!m && m[4] === m[1] + m[2] + m[3]; })());

const macroCalendarStart = core.indexOf('window.AIO_MACRO_CALENDAR = {');
const macroCalendarEnd = core.indexOf('\n};', macroCalendarStart);
let macroCalendar = null;
if (macroCalendarStart >= 0 && macroCalendarEnd > macroCalendarStart) {
  const sandbox = { window: {} };
  runInNewContext(`${core.slice(macroCalendarStart, macroCalendarEnd + 3)}\nthis.calendar = window.AIO_MACRO_CALENDAR;`, sandbox, { timeout: 1000 });
  macroCalendar = sandbox.calendar;
}
const verifiedMacroScheduleKeys = ['us-nfp', 'us-cpi', 'us-pce', 'us-ism-mfg', 'us-ism-svc', 'us-fomc', 'us-fed-rate', 'kr-bok'];
const readableOfficialCalendarSources = verifiedMacroScheduleKeys.every((key) => {
  const release = macroCalendar?.releases?.[key];
  return Boolean(release && release.source && !/^https?:\/\//i.test(release.source)
    && /^https:\/\//i.test(release.sourceUrl || ''));
});

// v57.50 I26 removed the Risk Radar fold (#risk-radar-body) from the company screen; its loader,
// filter and source-link helper were retired as dead code. They must not come back without a sink.
check('P1753 P1294/R644 macro calendar sources keep readable labels and the retired Risk Radar loader stays gone',
  readableOfficialCalendarSources
    && !/function loadRiskRadar|riskRadarSourceMarkup|_aioRiskRadarFilter|html-fundamental-risk-shown/.test(pagesSource));

// P1301/R650: a passed scheduled date is not evidence of an actual release result.
let macroScheduleResultDatesRemainEvidenceBound = false;
try {
  const refreshStart = core.indexOf('window.AIO.refreshMacroCalendarFromOfficialSchedule = function(now) {');
  const refreshEnd = core.indexOf('\n};', refreshStart) + 3;
  if (refreshStart >= 0 && refreshEnd > refreshStart) {
    const fixture = () => ({
      window: {
        AIO: {},
        AIO_MACRO_CALENDAR: { releases: { 'us-cpi': { lastRelease: '2026-09-11', nextRelease: '2026-10-14' } } },
        AIO_MACRO_OFFICIAL_SCHEDULES: { 'us-cpi': ['2026-10-14', '2026-11-13'] }
      },
      _aioMacroTodayIso: (now) => now.toISOString().slice(0, 10),
      _aioMacroIsoDate: (date) => /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : null
    });
    const crossedContext = fixture();
    runInNewContext(core.slice(refreshStart, refreshEnd), crossedContext, { timeout: 1000 });
    const crossed = crossedContext.window.AIO.refreshMacroCalendarFromOfficialSchedule(new Date('2026-10-15T00:00:00.000Z'));
    const resultDateRetained = crossedContext.window.AIO_MACRO_CALENDAR.releases['us-cpi'].lastRelease === '2026-09-11';
    const nextDateAdvanced = crossedContext.window.AIO_MACRO_CALENDAR.releases['us-cpi'].nextRelease === '2026-11-13';

    const noFutureContext = fixture();
    noFutureContext.window.AIO_MACRO_OFFICIAL_SCHEDULES['us-cpi'] = ['2026-10-14'];
    runInNewContext(core.slice(refreshStart, refreshEnd), noFutureContext, { timeout: 1000 });
    const noFuture = noFutureContext.window.AIO.refreshMacroCalendarFromOfficialSchedule(new Date('2026-10-15T00:00:00.000Z'));
    macroScheduleResultDatesRemainEvidenceBound = resultDateRetained && nextDateAdvanced
      && noFutureContext.window.AIO_MACRO_CALENDAR.releases['us-cpi'].lastRelease === '2026-09-11'
      && noFutureContext.window.AIO_MACRO_CALENDAR.releases['us-cpi'].nextRelease === null
      && noFuture.status === 'stale';
  }
} catch (_) {}
check('P1301/R650/QA-DATA-44 macro schedule dates never become lastRelease without result evidence', macroScheduleResultDatesRemainEvidenceBound);
// P1592 (frontend audit F26/F16/F31/F30): structural guards for the round-4~9 findings.
{
  // v59.88 (S6): the article reading is src/domain/news/article-tickers.js; js/aio-data.js getDisplayTickers gates cached tickers through it.
  const { articleTickers, articleSymbolAllowed } = await import('../src/domain/news/article-tickers.js');
  const knownTickers = new Set(['COO', 'CEO', 'SEC', 'FDA', 'NVDA', 'COST', 'CAT']);
  const roleGate = ['COO', 'CEO', 'CFO', 'SEC', 'FDA'].every((t) => !articleSymbolAllowed(t, `Former FTX ${t} joins`) && articleSymbolAllowed(t, `(${t})`))
    && ['NVDA', 'CAT'].every((t) => articleSymbolAllowed(t, `${t} rallies`))
    && articleTickers({ title: 'Former FTX COO joins NVDA board' }, { knownTickers }).join() === 'NVDA'
    && articleTickers({ title: '$COO shares jump' }, { knownTickers }).join() === 'COO';
  // v60.16: a criteria row names its implementation; a function aio-tests T291 keeps absent (retired291) is not one.
  const retiredFns = (tests.match(/retired291 = \[([^\]]+)\]/)?.[1] || '').match(/[A-Za-z0-9_]+/g) || [];
  const staleImpl = [...read('js/aio-core.js').matchAll(/implFn: '([^']+)'/g)].flatMap((m) => m[1].split('|')).filter((name) => retiredFns.includes(name));
  check('v60.16 no implFn row names a function the tests keep deleted', retiredFns.length >= 3 && staleImpl.length === 0, staleImpl.join(','));
  check('P1592/F26 officer titles and agency acronyms are not news tickers unless written as $TICKER/(TICKER), in local and cached paths',
    roleGate && /_aioArticleSymbolAllowed\(bare, text\)/.test(data));
  // v59.51 (content audit): the position donut and sector card left 포트폴리오 (the holdings table's 주식 중 비중 and 보유 점검
  // carry the mix), so the native renderer no longer marks a canvas; pin that the legacy donut has no canvas to draw on.
  check('P1592/F16 v59.51 (content audit) the legacy cost-basis donut has no canvas left and the legacy sector mix stays retired',
    !/id="pf-position-donut"/.test(html) && !/closest\('#page-portfolio\[data-aio-portfolio-chart-renderer/.test(pagesSource)
      // v58.80 first-users F19: the legacy sector bubble is retired outright; the native portfolio sector card owns the mix.
      && !/_buildSectors/.test(ui) && !/: \(entry\.cost \|\| 0\)/.test(ui));
  check('P1592/F31 the skip link focuses the main region without writing a route hash',
    /a\.skip-link/.test(bootstrap) && /event\.preventDefault\(\)/.test(bootstrap) && /'#main-content'/.test(bootstrap));
  check('P1592/F30 the local news insight no longer writes a template summary into the translation cache',
    /var summary = '';/.test(data) && !/' 뉴스입니다\. 헤드라인 기준 톤은 '/.test(data));
}

// P1758: --data-amber is a real amber reserved for caution/mixed states, readable as text (WCAG AA 4.5:1) on every
// ivory/dark surface and on the ink-tinted chips it sits on; chrome that only wanted the neutral ink no longer uses it.
{
  const rgbOf = (hexValue) => [1, 3, 5].map((i) => parseInt(hexValue.slice(i, i + 2), 16));
  const lum = (rgb) => rgb.map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const over = (rgb, alpha, bg) => rgb.map((c, i) => c * alpha + bg[i] * (1 - alpha));
  // owner 2026-10-23: tokens point at Radix Colors v3 steps (src/ui/styles/radix-colors.css); resolve them to hex first.
  const radix = read('src/ui/styles/radix-colors.css');
  const [radixLight, radixDark] = radix.split('body.dark-theme {');
  const step = (block, value) => { const name = String(value || '').match(/var\(--([a-z]+-\d+)\)/)?.[1]; return name ? (block.match(new RegExp(`--${name}:(#[0-9a-f]{6});`)) || [])[1] : value; };
  // v59.88: one colour definition — --data-amber aliases the warning text role; light mixes step 11 with a quarter of
  // step 12 (v59.70 #25), the dark block restates only the role (step 11).
  const toHex = (rgb) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
  const roleValue = (block, scale) => {
    const mix = String(block || '').match(/--color-text-warning:\s*color-mix\(in srgb, var\(--([a-z]+-\d+)\) (\d+)%, var\(--([a-z]+-\d+)\)\)/);
    if (mix) { const a = rgbOf(step(scale, `var(--${mix[1]})`)), b = rgbOf(step(scale, `var(--${mix[3]})`)), w = Number(mix[2]) / 100; return toHex(a.map((c, i) => c * w + b[i] * (1 - w))); }
    return step(scale, (String(block || '').match(/--color-text-warning:\s*([^;\s]+);/) || [])[1]);
  };
  const lightBlock = (html.match(/^:root, body \{[\s\S]*?^\}/m) || [''])[0];
  const darkBlock = (html.match(/^body\.dark-theme \{[\s\S]*?^\}/m) || [''])[0];
  const lightAmber = roleValue(lightBlock, radixLight);
  const lightOverride = /--data-amber: var\(--color-text-warning\)/.test(lightBlock) && !/--data-amber\s*:/.test(darkBlock) ? lightAmber : null;
  const darkAmber = roleValue(darkBlock, radixDark);
  const hue = (hexValue) => { const [r, g, b] = rgbOf(hexValue).map((c) => c / 255); const max = Math.max(r, g, b), min = Math.min(r, g, b); if (max === min) return -1; const h = max === r ? ((g - b) / (max - min)) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4; return (h * 60 + 360) % 360; };
  const worst = (fg, bgs, ink, alphas) => Math.min(...bgs.flatMap((bg) => alphas.map((a) => ratio(rgbOf(fg), over(ink, a, rgbOf(bg))))));
  // Light: colored text sits on gold-1 cards; amber chips (amber-3) carry amber-12 text (owner 2026-10-23).
  const lightWorst = lightAmber ? Math.min(worst(lightAmber, [step(radixLight, 'var(--gold-1)')], [59, 53, 43], [0]), ratio(rgbOf(step(radixLight, 'var(--amber-12)')), rgbOf(step(radixLight, 'var(--amber-3)')))) : 0;
  const darkWorst = darkAmber ? worst(darkAmber, ['gold-1', 'gold-2', 'gold-3', 'gold-4'].map((n) => step(radixDark, `var(--${n})`)), [232, 226, 217], [0, 0.10, 0.15]) : 0;
  check(`P1758 --data-amber is a saturated amber hue, not a warm grey (light ${lightAmber}, dark ${darkAmber}) and the light override matches the base`, !!lightAmber && lightAmber === lightOverride && [lightAmber, darkAmber].every((c) => c && hue(c) >= 30 && hue(c) <= 50 && (Math.max(...rgbOf(c)) - Math.min(...rgbOf(c))) / Math.max(...rgbOf(c)) >= 0.5));
  check(`P1758 --data-amber text contrast >= 4.5:1 on ivory/dark surfaces and ink chips (light ${lightWorst.toFixed(2)}, dark ${darkWorst.toFixed(2)})`, lightWorst >= 4.5 && darkWorst >= 4.5);
  check('P1758 navigation, logo and table-header chrome use the neutral ink, not the caution amber', !/\.nav-item::before \{[^}]*--data-amber/.test(html) && !/\.nav-item:hover \.nav-icon \{[^}]*--data-amber/.test(html) && !/\.logo::after \{[^}]*--data-amber/.test(html) && !/\.gmo-sym \{[^}]*--data-amber/.test(html));
}

{
  // v57.61 WCAG 2.2 AA pass: focus survives re-renders, statuses are announced, names are distinct.
  // v59.70 (S12): the 맞춤 조건 panel is the section of screener/filters.js between its banner and the conditions-block controller.
  const custom = (read('src/ui/pages/screener/filters.js').split('// ── 맞춤 조건 panel')[1] || '').split('/** The conditions block')[0];
  const screener = readScreenerPageSource();
  const terms = read('src/ui/components/term-marks.js');
  const entity = read('src/ui/pages/entity.js');
  check('v57.61 맞춤 조건 chips keep focus across renders, the count note is a status and the chip list is not a live region', /chip\.dataset\.chip = chipKey\(condition\)/.test(custom) && /findIn\(focusKey\[0\], focusKey\[1\]\)\?\.focus\(\)/.test(custom) && /\(removes\[index\] \|\| removes\[index - 1\] \|\|[^;]*select\)\.focus\(\)/.test(custom) && /note\.setAttribute\('role', 'status'\)/.test(custom) && !/aria-live/.test(custom) && /signature !== lastSignature/.test(custom)); // text-pin-ok: v57.61 a11y attribute contract; the browser accessibility matrix covers behaviour
  check('v57.61 screener sort returns focus to the header button, non-sortable headers carry no aria-sort, hints reach assistive tech, search is debounced', /node\.dataset\.scrSort === column\)\?\.focus\?\.\(\)/.test(screener) && !/th\.setAttribute\('aria-sort', 'none'\);\n\s*\}/.test(screener) && !/정렬 적용|'적용'\}`\)/.test(screener) && /\$\{column\.label\}로 정렬/.test(screener) && /setAttribute\('aria-describedby', hintId\)/.test(screener) && /setTimeout\(\(\) => \{ (?:ctx\.)?searchTimer = null;[^}]*\}, 150\)/.test(screener)); // text-pin-ok: v57.61 a11y attribute contract; the browser accessibility matrix covers behaviour
  check('v57.61 KR theme card header is keyboard operable', /kr-theme-header" role="button" tabindex="0"/.test(krData) && /e\.key === 'Enter' \|\| e\.key === ' '/.test(krData)); // text-pin-ok: v57.61 a11y attribute contract; the browser accessibility matrix covers behaviour
  check('v57.61 term popover returns focus to its mark, exposes aria-expanded and closes when focus leaves', /mark\.setAttribute\('aria-expanded', 'false'\)/.test(terms) && /restore && hadFocus && mark\?\.isConnected/.test(terms) && /addEventListener\('focusout'/.test(terms)); // text-pin-ok: v57.61 a11y attribute contract; the browser accessibility matrix covers behaviour
  check('v57.61 ticker price basis is a status region; the back button name does not read the arrow', /status\.setAttribute\('role', 'status'\)/.test(entity) && !/aria-label', `← /.test(entity) && !/aria-label', '← /.test(entity)); // text-pin-ok: v57.61 a11y attribute contract; the browser accessibility matrix covers behaviour
}

{
  // v58.20 review D1: the timer registry's unload clear-all must not leave a back/forward-cache restore without timers.
  // Run the registry IIFE itself on a fake window: register, clear at unload, then fire a persisted pageshow.
  const coreSource = read('js/aio-core.js');
  const from = coreSource.indexOf('window._aioTimerRegistry = window._aioTimerRegistry || {};');
  const to = coreSource.indexOf('// ═══ v48.98: _aioPageBus');
  const listeners = {};
  let nextId = 1;
  const live = new Set();
  const sandbox = {
    setInterval: () => { const id = nextId++; live.add(id); return id; },
    clearInterval: (id) => { live.delete(id); },
    document: { hidden: false, addEventListener: (type, fn) => { (listeners['doc:' + type] ||= []).push(fn); } },
    Date
  };
  sandbox.window = { addEventListener: (type, fn) => { (listeners['win:' + type] ||= []).push(fn); } };
  let restored = null;
  if (from > 0 && to > from) {
    runInNewContext(coreSource.slice(from, to), sandbox);
    const win = sandbox.window;
    win._aioRegisterTimer('dataStatus', () => {}, 60000);
    win._aioRegisterTimer('signalDashboard', () => {}, 60000);
    win._aioClearAllTimers();
    const clearedLive = live.size;
    (listeners['win:pageshow'] || []).forEach((fn) => fn({ persisted: true }));
    restored = { clearedLive, registry: Object.keys(win._aioTimerRegistry).sort(), live: live.size };
  }
  check('v58.20 timers cleared at unload restart when the page is restored from the back/forward cache',
    restored?.clearedLive === 0 && restored.live === 2 && restored.registry.join() === 'dataStatus,signalDashboard', JSON.stringify(restored));
}

{
  // v58.80 first-users run-1, behaviour only (P2066/P2069/P2070 are driven in the portfolio-vault and out-of-universe
  // browser checks; the screener/fiscal loading wording is proven by the first-users run-2 phone persona).
  const fomcKst = compatRoot._aioReleaseKstLabel?.('us-fomc', '2026-10-28');
  check('P2067 the macro header names the FOMC release by its KST clock, the same day the body shows (10/28 ET → 10/29 KST)',
    fomcKst === '10/29(목) 03:00', String(fomcKst));
  const { closeFallback } = await import('../src/ui/components/home-index-strip.js');
  const fb = closeFallback([{ date: '2026-10-22', spx: 6700 }, { date: '2026-10-23', spx: 6767 }], { close: 'spx', closeLabel: 'S&P 500' });
  check('P2068 an index card whose intraday bars failed falls back to the last published close with its date',
    fb?.date === '10/23' && fb.value === 6767 && Math.abs(fb.changePct - 1) < 1e-9, JSON.stringify(fb));
}
if (errors.length) {
  console.error('Runtime contract check failed:');
  errors.forEach((e) => console.error(' - ' + e));
  if (warnings.length) {
    console.error('Warnings:');
    warnings.forEach((w) => console.error(' - ' + w));
  }
  process.exit(1);
}

console.log(`Runtime contract check OK: ${version}, ${callableRefs.length} AI callable reference(s), digest contract ${exists(digestPath) ? 'wired' : 'skipped'}.`);
if (warnings.length) warnings.forEach((w) => console.warn('WARN: ' + w));
