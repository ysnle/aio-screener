import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
const visibleHtml = html.replace(/<!--[\s\S]*?-->/g, '');
const core = read('js/aio-core.js');
const data = read('js/aio-data.js');
const ui = read('js/aio-ui.js');
const chat = read('js/aio-chat.js');
const tests = read('js/aio-tests.js');
const bootstrap = read('src/app/bootstrap.js');
const sentimentPage = read('src/ui/pages/sentiment.js');
const sentimentDomain = read('src/domain/sentiment/metrics.js');
const themesPage = read('src/ui/pages/themes.js');
const glossary = read('js/aio-glossary.js');
const fetchData = read('scripts/fetch-data.mjs');
const telegramFetcher = read('scripts/fetch-telegram-digest.mjs');
const worker = exists('cloudflare-worker-proxy.js') ? read('cloudflare-worker-proxy.js') : '';
const packageJson = read('package.json');
const ciWorkflow = read('.github/workflows/ci.yml');
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

const callableRefs = [...new Set([...chat.matchAll(/\b(_aio[A-Za-z0-9_]+)\s*\(/g)].map((m) => m[1]))]
  .filter((name) => !['_aioSafeMD', '_aioAskAiFromPageDecision'].includes(name));
for (const name of callableRefs) {
  const existsInRuntime = core.includes(`window.${name}`)
    || runtimeBundle.includes(`window.${name}`)
    || runtimeBundle.includes(`function ${name}`)
    || chat.includes(`window.${name}`)
    || chat.includes(`function ${name}`)
    || new RegExp(`(?:var|let|const)\\s+${name}\\b`).test(runtimeBundle);
  check(`AI prompt/runtime callable exists: ${name}`, existsInRuntime, 'referenced from js/aio-chat.js');
}

const digestPath = 'public-data/user-research-digest.json';
if (exists(digestPath)) {
  const digest = read(digestPath);
  check('user research digest declares REFERENCE sourceKind', /"sourceKind"\s*:\s*"REFERENCE"/.test(digest));
  check('core consumes user research digest', /AIO_USER_RESEARCH_REFRESH_CONTRACT/.test(core) && /loadUserResearchDigest/.test(core) && /applyUserResearchDigestPayload/.test(core));
  check('core exposes user research pipeline audit', /getUserResearchPipelineAudit/.test(core));
  check('chat consumes user research digest context', /User supplied research digest/.test(chat) && /AIO_USER_RESEARCH_PAGE_MODULES/.test(chat));
  check('runtime contract tests cover digest consumption', /T842 v5078_user_research_digest_visual_report/.test(tests));
} else {
  warnings.push('public-data/user-research-digest.json not present; digest contract skipped');
}

check('runtime contract audit exists', /getRuntimeContractAudit/.test(core));
check('share readiness audit exists', /getShareReadinessAudit/.test(core));
check('deployment gate includes runtime contract', /runtimeContract/.test(core) && /runtime contract/.test(core));
check('tests cover runtime/share gate', /T844 v5079_runtime_contract_share_gate/.test(tests));
check('Telegram digest applies latest items into SCREENER_DB memo', /function\s+_aioApplyTelegramDigestToScreenerDb/.test(data) && /_aioApplyTelegramDigestToScreenerDb\(raw,\s*merged\)/.test(data));
check('Telegram memo overlay is exposed through audit', /_aioTelegramMemoOverlayAudit/.test(data) && /memoOverlay/.test(data) && /getTelegramPipelineAudit/.test(data));
check('Telegram dynamic artifact replaces static narrative and exposes honest coverage', /themes:\s*Array\.isArray\(raw\.themes\)/.test(data) && /pipelineNote:\s*String\(raw\.pipelineNote/.test(data) && /coverage:\s*raw\.coverage/.test(data));
check('Telegram page coverage audit spans all 17 routes (v53.7 P725)', /getTelegramPageCoverageAudit/.test(data) && /requiredPageCount/.test(data) && /'portfolio':\s*\[/.test(data) && /'ticker':\s*\[/.test(data) && /'screener':\s*\[/.test(data) && /'kr-macro':\s*\[/.test(data) && /'guide':\s*\[\]/.test(data));
check('tests cover Telegram digest memo injection', /T831[\s\S]{0,2200}SCREENER_DB memo/.test(tests) && /_telegramMemoOverlay/.test(tests));
check('Telegram page feeds cover fundamental/themes/KR technical pages', /id="tg-feed-fundamental"/.test(html) && /id="tg-feed-themes"/.test(html) && /id="tg-feed-theme-detail"/.test(html) && /id="tg-feed-kr-technical"/.test(html));
check('Telegram page routing includes credit and AI infrastructure tags by page', /'fundamental':\s*\[[^\]]*'semi'[^\]]*'credit'/.test(data) && /'themes':\s*\[[^\]]*'power'[^\]]*'credit'/.test(data) && /'fxbond':\s*\[[^\]]*'credit'/.test(data) && /'kr-technical':\s*\[[^\]]*'semi'/.test(data) && /'credit':\s*\{\s*label:/.test(data));
check('Telegram market-note digest tag is consumed by briefing and market-news pages', /'briefing':\s*\[[^\]]*'market-note'/.test(data) && /'market-news':\s*\[[^\]]*'market-note'/.test(data));
if (exists('public-data/telegram-digest.json')) {
  try {
    const digest = JSON.parse(read('public-data/telegram-digest.json'));
    const produced = Object.entries(digest.topicCounts || {}).filter(([, count]) => Number(count) > 0).map(([topic]) => topic);
    const missing = produced.filter((topic) => topic !== 'media-only' && !telegramConsumedTags.has(topic));
    check('produced Telegram digest topics are consumed by at least one page', missing.length === 0, missing.join(', '));
    if (Array.isArray(digest.observedItems)) {
      check('public Telegram digest count matches observed whole-window lineage', digest.count === digest.observedItems.length, `count=${digest.count}, observed=${digest.observedItems.length}`);
      check('public Telegram digest reports capped-payload coverage funnel', digest.coverage && digest.coverage.observedCount === digest.count && Number.isFinite(digest.coverage.selectedRawCoveragePct));
    }
  } catch (error) {
    check('public Telegram digest topic inventory parses for routing coverage', false, error.message);
  }
}
check('runtime promotes credit to a first-class news topic', /credit:\s*\[[^\]]*credit spread/.test(data) && /credit:\s*\{\s*cls:\s*'nit-warn'/.test(data) && /key:\s*'credit'[\s\S]{0,80}크레딧/.test(data));
check('analysis news surfaces subscribe to credit/funding risk', /macro:\s*\{[\s\S]{0,360}topics:\s*\[[^\]]*'credit'/.test(data) && /fxbond:\s*\{[\s\S]{0,380}topics:\s*\[[^\]]*'credit'[^\]]*'fxbond'/.test(data) && /fundamental:\s*\{[\s\S]{0,420}topics:\s*\[[^\]]*'credit'/.test(data) && /themes:\s*\{[\s\S]{0,420}topics:\s*\[[^\]]*'credit'/.test(data) && /breadth:\s*\{[\s\S]{0,360}topics:\s*\[[^\]]*'credit'/.test(data));
check('Telegram long-form reports survive on analysis pages', /allowLongReport/.test(data) && /'fundamental','themes','theme-detail'/.test(data));
check('data pipeline contract gate exists', exists('scripts/ci-data-pipeline-contract-check.mjs'));
check('data pipeline contract gate is wired into CI', /ci-data-pipeline-contract-check\.mjs/.test(read('.github/workflows/ci.yml')));
check('semantic review gate script exists', exists('scripts/ci-semantic-review-check.mjs'));
check('semantic review contract is documented', /R219/.test(read('_context/RULES.md')) && /P513-Q1/.test(read('_context/QA-CHECKLIST.md')) && /P513/.test(read('_context/BUG-POSTMORTEM.md')));
check('semantic review CI must be run with runtime contract changes', /ci-semantic-review-check\.mjs/.test(read('_context/QA-CHECKLIST.md')) && /semantic review/.test(read('CHANGELOG.md')));
check('workflow compaction gate script exists', exists('scripts/ci-workflow-compaction-check.mjs'));
check('workflow compaction contract is documented', /R220/.test(read('_context/RULES.md')) && /P514-Q1/.test(read('_context/QA-CHECKLIST.md')) && /P514/.test(read('_context/BUG-POSTMORTEM.md')));
check('decision header shows user-facing source label, not raw sourceKind label', /sourceLabelMap/.test(core) && !/sourceKind\s+'\s*\+/.test(core));
check('legacy conclusion bar is hidden when decision header exists', /has-aio-decision-header\s+\.page-conclusion-bar/.test(html) && /classList\.add\('has-aio-decision-header'\)/.test(core));
check('audit widget is hidden by default and only shown in dev mode', /\.aio-audit-widget\s*\{\s*display:none\s*!important;?\s*\}/.test(html) && /body\.aio-dev-mode\s+\.aio-audit-widget/.test(html) && /classList\.toggle\('aio-dev-mode'/.test(core));
check('portfolio blocks unverified ticker before saving', /검증되지 않은 티커라 저장하지 않았습니다/.test(html) && /if\s*\(!isKnown\)\s*\{[\s\S]*?return;\s*\}[\s\S]*?const positions = getPortfolioData\(\)/.test(html));
check('data-action accessibility normalizer is installed', /_aioNormalizeDataActionA11y/.test(core) && /setAttribute\('role', 'button'\)/.test(core) && /setAttribute\('tabindex', '0'\)/.test(core));
// P553: the returned object literal no longer has to sit directly after the `return` keyword
// (computeTradingScore now builds it into a variable first so it can be cached), so this only
// requires the `{ total, score: total` alias shape to exist somewhere in the function, not that
// it is the literal return expression.
// v51.98/Phase 3 [A3]: computeTradingScore/classifyMarketRegime/getScoreAdvice moved from index.html
// inline to js/aio-core.js (P594) — these three checks now search `core`, not `html`.
check('computeTradingScore returns both total and score aliases for legacy consumers', /function\s+computeTradingScore/.test(core) && /\{\s*total\s*,\s*score\s*:\s*total/.test(core));
// v51.98/Phase 3 [A3]: this used to search the whole `html`, where "breadth200...: 75)" only ever
// appeared (if at all) inside classifyMarketRegime itself. `core` is a much bigger file with
// unrelated breadth200 code elsewhere (e.g. a coincidental "...: 75)" ~150 chars after an
// unrelated breadth200 reference around line 2746), so the negative check must be scoped to
// classifyMarketRegime's own body, not a free-floating search across the whole module.
const classifyMarketRegimeIdx = core.search(/function\s+classifyMarketRegime/);
const classifyMarketRegimeBody = classifyMarketRegimeIdx >= 0 ? core.slice(classifyMarketRegimeIdx, classifyMarketRegimeIdx + 1500) : '';
check('classifyMarketRegime does not use optimistic breadth default 75', classifyMarketRegimeIdx >= 0 && !/breadth200[\s\S]{0,220}:\s*75\)/.test(classifyMarketRegimeBody));
check('score advice no longer labels 75+ as aggressive buy', /function\s+getScoreAdvice/.test(core) && !/function\s+getScoreAdvice[\s\S]{0,500}적극\s*매수/.test(core));
check('trading guidance avoids aggressive-buy wording on score 75+', !/75\+\s*(?:적극\s*매수|적극매수)/.test(html + '\n' + core + '\n' + chat + '\n' + data + '\n' + ui));
check('ticker deep analysis gates entry verdict with market score', /function\s+analyzeTickerDeep/.test(html) && /computeTradingScore\('swing'\)/.test(html) && /marketAllowsEntry/.test(html) && /marketCaution/.test(html));
check('ticker deep analysis includes institutional Minervini engine', /function\s+_buildMinerviniTechnicalEngine/.test(html) && /_calcMinerviniMAStack/.test(html) && /_buildHorizontalVolumeZones/.test(html) && /_calcVcpQuality/.test(html) && /_calcFibonacciConfluence/.test(html));
check('ticker deep analysis covers 5/10/20 short and 50/100/200 long MA stacks', /단기 정배열 5>10>20/.test(html) && /장기 정배열 50>100>200/.test(html) && /FULL_BULL_STACK_5_10_20_50_100_200/.test(core + '\n' + chat));
check('ticker deep analysis exposes horizontal volume profile beginner guidance', /Volume Profile/.test(html) && /POC/.test(html) && /Value Area/.test(html) && /beginnerNote/.test(html) && /수평 매물대/.test(html));
check('technical snapshot exposes full MA stack to AI chat', /sma5/.test(core) && /sma100/.test(core) && /shortMAState/.test(core) && /longMAState/.test(core) && /maStackScore/.test(core) && /5SMA/.test(chat) && /100SMA/.test(chat));
check('event risk context fails closed without an embedded point-in-time timeline', /AIO_EVENT_RISK_CONTEXT/.test(core) && /available:\s*false/.test(core) && /asOf:\s*null/.test(core) && /timeline:\s*\[\]/.test(core) && !/headlineYoY:\s*\d/.test(core));
check('page body redesign hub registry exists', /AIO_PAGE_ACTION_HUBS/.test(core) && /_aioApplyPageBodyRedesign/.test(core) && /getPageRedesignAudit/.test(core));
check('page evidence currentness contract exists', /AIO_PAGE_EVIDENCE_CONTRACT/.test(core) && /getPageEvidenceState/.test(core) && /getPageEvidenceCurrentnessAudit/.test(core));
check('H3-A canonical currentness selector exists and is shared by score/evidence paths', /getCanonicalMetric/.test(core) && /fgEvidenceAllowedUse/.test(core) && /id === 'fg-sentiment'/.test(core) && /_lastFGMeta/.test(data));
check('H3-A current F&G consumers do not silently promote fallback through truthy OR', !/window\._lastFG\s*\|\|/.test(runtimeBundle + '\n' + html) && /sourceKind: 'snapshot'/.test(data) && /allowedUse/.test(core));
check('H3-A selector tests cover live precedence, zero, snapshot reference, and stale blocking', /T901 canonical_prefers_live_over_snapshot/.test(tests) && /T902 canonical_preserves_zero/.test(tests) && /T903 snapshot_not_decision_use/.test(tests) && /T904 stale_current_is_blocked/.test(tests));
check('H3-B missing event claims fail closed and cannot drive current decisions', /getEventClaimState/.test(core) && /status: 'MISSING'/.test(core) && /_fomcState\.allowedUse/.test(core) && /T905 missing_event_claim_is_blocked/.test(tests));
check('H3-C derived decision gate blocks quorum-missing inputs instead of preserving a strong action band', /_scoreBlocked/.test(core) && /decisionBlocked/.test(core) && /핵심 입력 부족/.test(core) && /T906 derived_regime_quorum_gate/.test(tests));
check('decision header renders page evidence caveat', /aio-decision-caveat/.test(core) && /d\.caveat/.test(core));
check('high-risk pages are capped below raw LIVE when data is mixed', /technical:\s*\{[\s\S]{0,120}maxSourceKind:\s*'DELAYED'/.test(core) && /'market-news':\s*\{[\s\S]{0,120}maxSourceKind:\s*'DELAYED'/.test(core) && /ticker:\s*\{[\s\S]{0,160}emptyKind:\s*'UNAVAILABLE'/.test(core));
check('home public readiness audit remains available only in developer mode', /id="aio-public-readiness"/.test(html) && /_aioBuildPublicShareReadiness/.test(data) && /getPublicShareReadiness/.test(data) && /getShareReadinessAudit/.test(core) && /body\.aio-dev-mode \.aio-public-readiness/.test(html) && /classList\.contains\('aio-dev-mode'\)/.test(data));
check('visible static labels do not overstate live/action state', !/\u25cf\s*LIVE|LIVE RSS|BUY\s*\/\s*LONG|공격적 매매|\(실시간\)|실시간 감지|실시간 수급|FMP 실시간|FINNHUB\s*실시간/.test(visibleHtml));
check('news fallback titles must not expose translation-pending placeholder text', !/return\s+['"`]\[번역 대기\]/.test(data) && !/\[번역 대기\]\s*['"`]\s*\+/.test(data));
check('put/call badge renders localized source state instead of raw enum labels', /스냅샷\s*·\s*참고/.test(data) && !/SNAPSHOT\s*·\s*reference/.test(data));
check('public readiness exposes page-level source/asOf matrix with localized labels', /pageEvidenceRows/.test(data) && /weakPages/.test(data) && /aio-public-readiness-pages/.test(data) && /aio-public-page-source/.test(html) && /_aioPublicReadinessSourceText/.test(data) && /_aioPublicReadinessPageText/.test(data) && /시각 확인 중/.test(data));
check('public readiness must not render raw pageId/sourceKind enum pairs', !/<b>' \+ _aioPublicReadinessEsc\(r\.pageId\)/.test(data) && !/<em>' \+ _aioPublicReadinessEsc\(r\.sourceLabel \|\| r\.sourceKind\)/.test(data) && !/asOf pending/.test(data));
check('full surface audit must match v50.29 page-brief declutter policy', /pageBriefNotDecluttered/.test(core) && !/briefNotRendered/.test(core));
check(
  'portfolio backtest lab exposes Portfolio Visualizer-style monthly report contract',
  /id="pf-backtest-lab"/.test(html)
    && /runPortfolioBacktestLab/.test(html)
    && /pf-bt-rebalance/.test(html)
    && /pf-backtest-output/.test(html)
    && /Performance Summary/.test(html)
    && /Annual Returns/.test(html)
    && /Worst Drawdowns/.test(html)
    && /Return \/ Risk Attribution/.test(html)
    && /백테스트 Lab/.test(html)
    && /buildPortfolioBacktestLab/.test(core)
    && /AIO_PORTFOLIO_BACKTEST_LAB_MONTHLY_V1/.test(core)
    && /monthlyRows/.test(core)
    && /annualRows/.test(core)
    && /drawdowns/.test(core)
    && /trackingError/.test(core)
    && /informationRatio/.test(core)
    && /window\._lastPortfolioBacktestLab/.test(html)
    && /T845 v5179_portfolio_backtest_lab/.test(tests)
);
check(
  'portfolio page exposes direct AI workflow for analysis, journal review, and learning',
  /id="pf-ai-workbench"/.test(html)
    && /id="pf-ai-ticker-select"/.test(html)
    && /id="pf-journal-note"/.test(html)
    && /data-action="_aioPortfolioAsk"/.test(html)
    && /data-arg="overview"/.test(html)
    && /data-arg="ticker"/.test(html)
    && /data-arg="journal"/.test(html)
    && /function\s+_aioBuildPortfolioActionPrompt/.test(html)
    && /window\._aioPortfolioAsk/.test(html)
    && /window\._aioSavePortfolioJournal/.test(html)
    && /updateAIPanelContext\('portfolio'\)/.test(html)
    && /chatSendUnified\(\)/.test(html)
);
check(
  'trader tactical framework is centralized as REFERENCE and exposed through AIO',
  /AIO_TACTICAL_TRADER_FRAMEWORK/.test(core)
    && /sourceKind:\s*'REFERENCE'/.test(core)
    && /volume-backed-vs-short-cover/.test(core)
    && /igv-to-smh-rotation/.test(core)
    && /failed-breakdown-bear-trap/.test(core)
    && /getTacticalTraderFrameworkAudit/.test(core)
);
check(
  'trader tactical framework feeds page decisions, AI chat, and news keywords',
  /tacticalTraderFramework/.test(core)
    && /_aioTacticalTraderFrameworkContext/.test(chat)
    && /volume-backed buying vs low-volume short-cover rally/.test(chat)
    && /failed breakdown/.test(data)
    && /software to semi rotation/.test(data)
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
for (const pageId of ['home','signal','market-news','technical','screener','ticker','portfolio','macro','fxbond','fundamental','kr-home','kr-supply','kr-themes','kr-macro','kr-technical']) {
  check(`page redesign config exists for ${pageId}`, new RegExp(`${pageId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`).test(core) || core.includes(`'${pageId}':`));
}
check('non-primary market-news/screener/signal controls are folded behind advanced details', /_aioFoldDensePageControls/.test(core) && /market-news/.test(core) && /screener-backtest-panel/.test(core) && /signal-lockout-control/.test(core));
check('core news and screener filters remain active on the main screen', !/#news-country-chips|#news-topic-chips|#news-type-tabs|#scr-market/.test(core));
check('unified AI panel covers home/screener/ticker/KR contexts (v53.7 P725)', /'home'\s*:\s*'home'/.test(html) && /'screener'\s*:\s*'screener'/.test(html) && /'ticker'\s*:\s*'ticker'/.test(html) && /'kr-themes'\s*:\s*'kr-themes'/.test(html) && /'kr-macro'\s*:\s*'kr-macro'/.test(html));
check('CHAT_CONTEXTS includes kr-home for unified KR landing AI', /'kr-home'\s*:\s*_aioCreateEvidenceContext/.test(chat));
check('safe numeric formatter is available for live/default-path renderers', /window\._aioSafeFixed\s*=\s*function/.test(core));
check('ticker live price renderer does not call live.price.toFixed directly', !/live\.price\.toFixed\(/.test(core));
check('scenario sum renderers guard missing sum before toFixed', !/sumCheck\.sum\.toFixed\(/.test(core) && !/sigSum\.sum\.toFixed\(/.test(core));
check('Chart tooltip callbacks guard missing parsed.y before toFixed', !/ctx\.parsed\.y\.toFixed\(/.test(core));
check('home dashboard VIX default path guards missing live price before toFixed', !/vix\.price\?\.toFixed\(/.test(data) && !/vp\.toFixed\(2\)/.test(data));
check('theme detail deep analysis filters finite pct values before toFixed', /topV\s*=\s*-Infinity/.test(html) && /botV\s*=\s*Infinity/.test(html) && /pctVal\s*=\s*d\s*&&\s*_themeFinitePct\(d\.pct\)/.test(html) && /_themeSafeFixed\(topV,\s*2/.test(html));
check('theme-detail route resolves to themes inline detail surface',
  (/id === 'theme-detail'/.test(core) && /_aioOpenThemeDetailOnThemes/.test(core) && /showThemeDetail\(themeId\)/.test(core))
  || (/createThemesPage/.test(themesPage) && /createThemesPage\(\{[^}]*route:\s*'theme-detail'/.test(bootstrap) && /aioArchitectureSlice/.test(themesPage)));
check('briefing summary F&G reads canonical currentness envelope', /getCanonicalMetric\('fg'\)/.test(data) && /var fgMetric/.test(data));
check('KR candle chart auto-loads from canvas and avoids zero-baseline compression', /krCandleCanvas/.test(html) && /loadKrCandleChart\(krCode \|\| '005930'\)/.test(html) && /beginAtZero:\s*false/.test(html) && /suggestedMin:\s*ySuggestedMin/.test(html) && /suggestedMax:\s*ySuggestedMax/.test(html));
check('headless tests cover all-theme detail and route redirect regressions', /T860 theme_detail_all_themes_no_throw_v5227/.test(tests) && /T861 theme_detail_route_redirect_v5227/.test(tests));
check('proxy layer rejects HTML block pages for JSON endpoints before caching success', /_aioProxyUrlExpectsJson/.test(data) && /_aioValidateProxyResponse/.test(data) && /aioProxyBlockedHtml/.test(data) && /proxy returned HTML for JSON endpoint/.test(data));
check('KR supply failure state clears canonical evidence and retired investor fanout is not scheduled', /function _showKrSupplyFailureState[\s\S]{0,180}?_krCurrentSupplyEvidence\s*=\s*null/.test(html) && /T863_kr_retired_investor_fanout_not_scheduled/.test(tests));
check('Cloudflare worker handles Naver JSON endpoints with browser-like headers and HTML block guard', /targetExpectsJson/.test(worker) && /m\.stock\.naver\.com/.test(worker) && /Upstream returned HTML block page for JSON endpoint/.test(worker) && /Referer = 'https:\/\/m\.stock\.naver\.com\/'/.test(worker));
check('viewport matrix CI script covers 22 routes, four viewport widths, topbar clipping, and SVG text geometry', /ci-viewport-matrix-check\.mjs/.test(read('.github/workflows/ci.yml')) && /const ROUTES = \[/.test(read('scripts/ci-viewport-matrix-check.mjs')) && /'theme-detail'/.test(read('scripts/ci-viewport-matrix-check.mjs')) && /mobile390/.test(read('scripts/ci-viewport-matrix-check.mjs')) && /desktop1440/.test(read('scripts/ci-viewport-matrix-check.mjs')) && /topbarClipCount/.test(read('scripts/ci-viewport-matrix-check.mjs')) && /svgTextOverlapCount/.test(read('scripts/ci-viewport-matrix-check.mjs')) && /svgTinyTextCount/.test(read('scripts/ci-viewport-matrix-check.mjs')));
check('proxy registry ranks active proxies by success-rate score, not only static order', /okCount/.test(data) && /failCount/.test(data) && /getScore:\s*function/.test(data) && /self\.getScore\(b\)\s*-\s*self\.getScore\(a\)/.test(data));
check('quote count labels distinguish client live quotes from server snapshot quotes', /클라 시세/.test(data) && /서버 스냅샷 시세/.test(data));
check('viewport matrix detects duplicate news and briefing cards by word-bag key', /wordBagKey/.test(read('scripts/ci-viewport-matrix-check.mjs')) && /duplicateCardCount/.test(read('scripts/ci-viewport-matrix-check.mjs')) && /market-news\|briefing/.test(read('scripts/ci-viewport-matrix-check.mjs')));
check('value slot renderer encodes value/pending/failed/na states and touched market-pulse/VIX term surfaces', (() => {
  const valueSlotBase = core.includes('_aioRenderValueSlot') && core.includes('data-value-state') && core.includes("state === 'failed'") && core.includes("state === 'na'");
  const legacyTouched = html.includes('_aioRenderValueSlot(elM') && core.includes('_aioRenderValueSlot(el, (v9dLive || v3mLive)');
  const nativeTouched = sentimentPage.includes('renderCanvasStates') && sentimentPage.includes('state.vix9d, state.vix, state.vix3m, state.vix6m')
    && sentimentPage.includes('setMetric(documentRef') && sentimentPage.includes('^VIX9D') && sentimentPage.includes('sentiment.vix3m') && sentimentPage.includes('sentiment.vix6m');
  return (valueSlotBase && legacyTouched) || (valueSlotBase && nativeTouched);
})());
check('briefing decision summary F&G uses canonical currentness source, not dead snap fields', (data.match(/getCanonicalMetric\('fg'\)/g) || []).length >= 2 && !/snap\.fg\.value|snap\.fearGreed/.test(data) && /T867 briefing_decision_summary_fg_canonical_v5234/.test(tests));
check('VKOSPI failure state is surfaced after repeated failures and calcKrHealthScore does not overwrite it', /function _showVkospiFailureState/.test(html) && /function _vkospiIsFailedState/.test(html) && /_vkospiIsFailedState\(\)/.test(html.slice(html.indexOf('function calcKrHealthScore'), html.indexOf('function calcKrHealthScore') + 4000)) && /T868 vkospi_failure_state_contract_v5234/.test(tests));
check('AI chat key gates accept configured server-key route and disclose personal-key boundary', /function _aioHasClaudeRoute/.test(chat) && /window\._aioHasClaudeRoute/.test(chat) && /_aioHasClaudeRoute\(_chatApiKey\)/.test(chat) && /_aioHasClaudeRoute\(_uniClaudeKey\)/.test(html) && /브리핑\/번역은 운영자 서버키/.test(chat + html) && /T865 claude_chat_route_server_key_awareness_v5230/.test(tests));
check(
  'breadth surfaces share canonical regime color and zero delta renders neutral',
  /function\s+_bbRegime/.test(ui)
    && /NARRATIVE_ENGINE\.getBreadthRegime/.test(ui)
    && /bar\.style\.background\s*=\s*reg\.color/.test(core)
    && /text:\s*'0'\s*\+\s*suffix/.test(data)
    && !/text:\s*'±0'\s*\+\s*suffix/.test(data)
    && /T866 breadth_regime_color_and_zero_delta_v5231/.test(tests),
  'signal and breadth pages must not split breadth color semantics or show plus/minus zero deltas'
);
check(
  'technical snapshot weekly context exposes canonical and legacy aliases',
  /lastWeekClose\s*:\s*lastW\.close/.test(core) && /wClose\s*:\s*lastW\.close/.test(core) && /wRsi\s*:\s*wRsi/.test(core) && /wRsi14\s*:\s*wRsi/.test(core),
  '_calcWeeklyContext must return lastWeekClose/wClose and wRsi/wRsi14 together'
);
check(
  'ticker weekly context renderer consumes aliases with fallback',
  /_wc\.wClose\s*!=\s*null\s*\?\s*_wc\.wClose\s*:\s*_wc\.lastWeekClose/.test(html) && /_wc\.wRsi14\s*!=\s*null\s*\?\s*_wc\.wRsi14\s*:\s*_wc\.wRsi/.test(html),
  'index.html analyzeTickerDeep must not depend on one weeklyCtx field spelling'
);
check(
  'AI chat consumes calcTechnicalSnapshot VCP/Fib/Volume/RSI/weekly fields',
  /• VCP:/.test(chat) && /• 피보나치\/매물대:/.test(chat) && /• RSI 다이버전스:/.test(chat) && /주봉 컨텍스트/.test(chat),
  'js/aio-chat.js must surface new calcTechnicalSnapshot fields, not only compute them'
);

const userFacingFiles = [
  ['index.html', html]
];
for (const [file, text] of userFacingFiles) {
  check(`${file} must not recreate fake premium board UI`, !/aio-premium-board|aio-research-bridge|apb-board/.test(text));
}
check('core must not recreate fake premium board renderer', !/window\._aioPremiumBoardModel|function\s+_aioPremiumBoardHtml|window\._aioRenderImportedResearchBridge|function\s+_aioResearchCardsHtml/.test(core));

// ── v51.64 구조적 계약 검사 (P545 방지 / Signal-Field / COMP_W / Scheduler / DATA_SNAPSHOT) ────────
// [A] Signal/Field 계약: classifyTerminalCandle()의 snapshot.X 참조 → calcTechnicalSnapshot() 반환 필드 정합
// snapshot.failedRetest는 P537에서 추가됐지만 P545 수준의 회귀 방지를 위해 CI에서 명시적으로 검증.
check(
  'classifyTerminalCandle snapshot.failedRetest is produced by calcTechnicalSnapshot',
  /failedRetest\s*=\s*!!/.test(core) && /failedRetest\s*:/.test(core),
  'calcTechnicalSnapshot must assign failedRetest field before return'
);
// snapshot 참조 패턴 목록 — 추후 새 signal이 snapshot.X를 쓰면 여기에 추가
const snapshotSignalFields = ['failedRetest'];
for (const field of snapshotSignalFields) {
  check(
    `calcTechnicalSnapshot returns '${field}' used by classifyTerminalCandle`,
    new RegExp(`\\b${field}\\s*[=:]`).test(core),
    `field '${field}' declared in classifyTerminalCandle but not found in aio-core.js`
  );
}

// [B] fetchQuote OHLCV 기반 일간 Pct (P545 근본 수정 — chartPreviousClose 주간 오표시 방지)
const fetchScript = exists('scripts/fetch-data.mjs') ? read('scripts/fetch-data.mjs') : '';
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

try {
  const screenerPayload = JSON.parse(read('public-data/screener.json'));
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

// [C] COMP_W 가중치 키 vs wTotal 계산식 정합 (P538 패턴 재발 방지)
// COMP_W의 모든 키가 실제 r.comp 계산식에서 사용돼야 함.
const compWMatch = fetchScript.match(/var\s+COMP_W\s*=\s*\{([^}]+)\}/);
if (compWMatch) {
  const compWKeys = [...compWMatch[1].matchAll(/(\w+)\s*:/g)].map(m => m[1]);
  for (const key of compWKeys) {
    check(
      `COMP_W.${key} is used in wTotal formula`,
      new RegExp(`COMP_W\\.${key}`).test(fetchScript.slice(fetchScript.indexOf('var wTotal'))),
      `COMP_W.${key} declared but not used in wTotal computation — dead weight key`
    );
  }
} else {
  warnings.push('COMP_W not found in fetch-data.mjs — weight key validation skipped');
}

// [D] Scheduler fn typeof 가드 함수들이 실제로 정의됨 (P524 패턴 재발 방지)
// REFRESH_SCHEDULE.*.fn = () => { return (typeof X === 'function') ? X() : null; } 패턴에서
// 실제 X가 runtime bundle에 존재하는지 검증.
const schedulerGuardedFns = [...data.matchAll(/typeof\s+(\w+)\s*===\s*'function'\)\s*\?\s*\1\(\)/g)].map(m => m[1]);
for (const fn of new Set(schedulerGuardedFns)) {
  const defined = new RegExp(`function\\s+${fn}\\b`).test(data) || new RegExp(`function\\s+${fn}\\b`).test(core);
  if (!defined) warnings.push(`Scheduler references typeof-guarded fn '${fn}' that is not defined in aio-data.js or aio-core.js`);
}

// [E] DATA_SNAPSHOT 수동 편집 금지 원칙 명문화 확인 (P545 예방)
check(
  'DATA_SNAPSHOT comment declares manual price-field edit prohibition',
  /수동\s*편집\s*금지/.test(core) && /data\.json에서\s*자동\s*파생/.test(core),
  'aio-core.js DATA_SNAPSHOT must document the auto-derivation principle (added in v51.64)'
);

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
check('13 comp routes hide advanced legacy blocks by default and expose them in developer mode only', /#page-home \.aio-page-advanced-toggle[\s\S]{0,1800}display:none !important/.test(html) && /body\.aio-dev-mode #page-home \.aio-page-advanced-toggle[\s\S]{0,1800}display:block !important/.test(html));
check('portfolio comp order and CTA-gated entry form are wired', /id="pf-holdings-table-section"/.test(html) && /id="pf-risk-section"/.test(html) && /id="pf-entry-section"/.test(html) && /_aioTogglePortfolioEntry/.test(html));
check('screener comp default exposes 1M/3M/6M/RSI/vs50MA/trend confidence/VCP fields', /data-scr-sort="ret1m"/.test(html) && /data-scr-sort="ret3m"/.test(html) && /data-scr-sort="ret6m"/.test(html) && /data-scr-sort="pctSma50"/.test(html) && /_retText\(r\.ret1m\)/.test(data) && /_retText\(r\.ret6m\)/.test(data));
check('runtime-injected decision headers and related-news strips stay out of the 13-route default surface', /body:not\(\.aio-dev-mode\) \.page > \.aio-decision-header[\s\S]{0,160}display:none !important/.test(html) && /#page-signal > \.aio-page-news-strip[\s\S]{0,1200}display:none !important/.test(html));
check('home details and duplicate operational feeds are absent from the default surface', /#page-home > details\.aio-card[\s\S]{0,1200}display:none !important/.test(html) && /#tg-feed-signal[\s\S]{0,1600}display:none !important/.test(html));
check('news and screener use 12-row progressive reveal instead of unbounded first paint', /_aioNewsVisibleLimit\s*\|\|\s*12/.test(data) && /_scrVisibleLimit\s*=\s*12/.test(data) && /id="news-load-more-wrap"/.test(html) && /id="scr-load-more-wrap"/.test(html));
check('briefing news wall is capped and can be explicitly expanded', /#briefing-live-news-list\s*\{\s*max-height:820px/.test(html) && /_aioCapBriefingNews/.test(core) && /_aioToggleBriefingNews/.test(core));
check('portfolio summary exposes total P&L, cash, and exposure rule as three columns', /id="pf-hero-stats"/.test(html) && /id="pf-cash-hero"/.test(html) && /id="pf-exposure-rule"/.test(html) && /#pf-hero-stats\s*\{\s*grid-template-columns:repeat\(3/.test(html));
check('fundamental comp enters through the existing NVDA analysis pipeline', /(?:(?:function\s+_initFundamentalPage\(\))|(?:(?:var|let|const)\s+_initFundamentalPage\s*=\s*function\(\)))[\s\S]{0,900}aioDefaultCompany[\s\S]{0,500}fundamentalSearch/.test(core));
check('remaining user surfaces reuse the comp hierarchy without new parallel data paths', /(?:(?:function\s+_aioPolishRemainingPages\(pageId\))|(?:(?:var|let|const)\s+_aioPolishRemainingPages\s*=\s*function\(pageId\)))/.test(core) && /aio-guide-chapter/.test(core) && /aio-theme-progressive/.test(core) && /aio-comp-secondary-feed/.test(html));
check('route terminology separates 20 user surfaces from 22 internal QA routes', /NAV_ROUTE:\s*\[[^\]]+\]/.test(core) && /DERIVED_VIEW:\s*\['ticker','theme-detail'\]/.test(core) && /REFERENCE:\s*\['options'\]/.test(core) && /OVERLAY:\s*\['glossary'\]/.test(core));
check('guide chapters and KR secondary groups are explicit progressive-disclosure controls', /#kr-integrated-themes \.aio-theme-progressive \.kr-theme-card:nth-child\(n\+4\)/.test(html) && /\.aio-comp-secondary[\s\S]{0,1200}\.aio-guide-chapter/.test(html));
check('glossary renders countable semantic rows and a readable comp modal', /class="aio-glossary-item"/.test(html) && /class="aio-glossary-term"/.test(html) && /GLOSSARY\.length/.test(html));
check('headless tests cover the redesigned default path', /T869 redesign_default_path_v5289/.test(tests));

// [G2] v52.90 P705/R331: 최종 렌더의 loaded/empty/degraded/closed 사용자 상태 계약.
const newsMoreAt = html.indexOf('id="news-load-more-wrap"');
const marketNewsAt = html.indexOf('id="page-market-news"');
const optionsAt = html.indexOf('id="page-options"');
check('news progressive reveal belongs to the market-news page rather than screener', newsMoreAt > marketNewsAt && newsMoreAt < optionsAt && /id="live-news-feed"[\s\S]{0,800}id="news-load-more-wrap"/.test(html));
check('fundamental search has one bounded total deadline and parallel bounded primary providers', /var _fundDeadline = Date\.now\(\) \+ 8000/.test(chat) && /Promise\.all\(\[[\s\S]{0,500}dynamicTickerLookup[\s\S]{0,500}fetchSECFilings[\s\S]{0,500}fetchSECFinancials/.test(chat) && /_fundRemaining\(5200\)/.test(chat) && /_fundRemaining\(1400\)/.test(chat));
check('all news acquisition paths converge on one visible summary state updater', /function _aioUpdateNewsSummaryFromItems\(items, meta\)/.test(data) && (data.match(/_aioUpdateNewsSummaryFromItems\(/g) || []).length >= 4 && /kind: 'server-cache'/.test(data) && /kind: 'idb-cache'/.test(data) && /kind: 'direct'/.test(data));
check('closed AI panel is inert and its trigger owns expanded state and focus return', /id="topbar-ai-btn"[\s\S]{0,300}aria-expanded="false"[\s\S]{0,300}aria-controls="ai-panel"/.test(html) && /id="ai-panel"[\s\S]{0,220}aria-hidden="true" inert/.test(html) && /p\.setAttribute\('inert', ''\)/.test(html) && /p\.removeAttribute\('inert'\)/.test(html) && /btn\.focus\(\)/.test(html));
check('KR theme cards preserve progressive density after live updates', /stockIdx < 5/.test(html) && /kr-theme-card-more/.test(html) && /catalyst\.length > 260/.test(html) && /catFullEl\.textContent = catalyst/.test(html) && /closest\('\.kr-ticker-pill, details, summary, \[data-stop\]'\)/.test(html));
check('KR supply requests are bounded and failure copy has a single owner', /sorted\.slice\(0, 24\)/.test(html) && /종목별 공용 프록시 연쇄 호출 생략/.test(html) && !/top100\.slice\(0, 6\)/.test(html) && /_krInvestorFetchState/.test(html) && /_investorState\.inFlight/.test(html) && /10 \* 60 \* 1000/.test(html) && /querySelectorAll\('\.kr-supply-fallback-notice'\)[\s\S]{0,180}\.remove\(\)/.test(html));
check('empty portfolio hides non-computable panels and exposes one first-position CTA', /var _pfEmpty = positions\.length === 0/.test(html) && /el\.hidden = _pfEmpty/.test(html) && /class="pf-empty-state"/.test(html) && />첫 종목 추가</.test(html));
check('briefing and news display titles reject failed or non-Korean cached translations', /!cached\.ko_title \|\| !isKoreanText\(cached\.ko_title\)/.test(data) && /class="briefing-news-title"/.test(data + core) && /visibleTitle = \(typeof getDisplayTitle/.test(core) && /\.briefing-news-title\s*\{[\s\S]{0,500}-webkit-line-clamp:2/.test(html));
check('headless tests exercise the final human UX state contracts', /_testV5290HumanUXStateContracts/.test(tests) && /T1015/.test(tests) && /T1020/.test(tests));
// v52.40 (P655): FABLE-EFFICACY-AUDIT-2026-07-10 Batch 1 (EF-01/02/04/13) structural gates
check('EF-13: FOMC decision-header footnote prefixes the registry eventDate on every consuming page (previously date-less outside macro calendar table)', /_fomcFoot\.eventDate\s*\?\s*_fomcFoot\.eventDate\s*\+/.test(core) && /_fomcAsOfAge/.test(core));
check('EF-13: FOMC footnote auto-badges past 21 days and collapses past 30 days instead of asserting a dateless "today" frame forever', /_fomcAsOfAge\s*>\s*21/.test(core) && /_fomcTooStale/.test(core));
check('EF-04: briefing date-line is a named, mockable-`now` renderer instead of an unconditional new Date() write', /window\._aioRenderBriefingDateLine\s*=\s*function\(nowOverride\)/.test(html) && /isPreCutoff/.test(html));
check('EF-02d: breadth 50SMA readout/bar sync is a single shared function called from both the Chart.js-independent snapshot path and updateBreadthBars, not duplicated', (core.match(/_aioSyncBreadth50Readout\s*=\s*function/g) || []).length === 1 && /window\._aioSyncBreadth50Readout\(\)/.test(core) && /window\._aioSyncBreadth50Readout\(\)/.test(ui));
check('EF-02b: breadth header-badge and diag-signal consume the same canonical consensus object as the signal-page verdict (no independent re-derivation)', /_aioRenderBreadthConsensus\s*=\s*function/.test(core) && /breadth-header-badge/.test(core) && /breadth-diag-signal/.test(core));
check('EF-02b: home market-pulse breadth strip uses NARRATIVE_ENGINE.getBreadthRegime instead of an independent 60/30 threshold', /NARRATIVE_ENGINE\.getBreadthRegime\(bVal\)/.test(html));
check('EF-02c: NYSE new-high/new-low/hl-ratio cards render an explicit na state instead of a perpetual unstated dash', /breadth-new-highs.*breadth-new-lows.*breadth-hl-ratio|breadth-new-highs['"]\s*,\s*['"]breadth-new-lows/.test(ui.replace(/\s+/g, ' ')));
check('EF-01: macro "now/live" mini-card reads window._liveData first and falls back to the snapshot with an explicit fallback title, instead of an always-snapshot data-snap binding', /function _aioSyncMacroLiveSpxMini/.test(html) && /id="macro-now-spx"/.test(html) && !/id="macro-now-spx"\s+data-snap="spx"/.test(html));
check('headless tests cover Batch 1 efficacy fixes (EF-01/02/04/13)', /_testV5240Batch1Efficacy/.test(tests) && /T870/.test(tests) && /T871/.test(tests) && /T872/.test(tests) && /T873/.test(tests));

// v52.41 (P656): FABLE-EFFICACY-AUDIT-2026-07-10 Batch 2 (EF-08/10/11/12/19) structural gates
check('EF-08: carry-unwind-risk render function has an independent aio:pageShown/aio:liveQuotes trigger, not only the showPage-monkeypatch setTimeout path that live-audit proved unreliable on cold load', /data-carry-unwind-shown/.test(data) && /data-carry-unwind-live/.test(data) && /_aioPageBus\.register\('data-carry-unwind-shown'/.test(data));
check('EF-08: carry observation proxy discloses the manually verified BOJ input and holds instead of inventing a score when current inputs are absent', /BOJ 수동 확인값 기준/.test(data) && /관측 프록시 보류/.test(data) && /inputsComplete/.test(data));
check('EF-10: ticker page Key Metrics + Quarterly Results dead slots render an honest na state pointing to the fundamental page instead of a silent permanent dash', /_tickerGapIds/.test(core) && /ticker-m-mcap/.test(core) && /ticker-f-ni/.test(core) && /펀더멘탈.*이동 후/.test(core));
check('EF-11: risk-monitor VXX-term-structure and RSP/SPY-ratio status slots fall back to an explicit pending state when live inputs are missing', /VXX 또는 VIX 라이브 시세 미수신/.test(html) && /RSP 또는 SPY 라이브 시세 미수신/.test(html));
check('EF-12: TV OHLC fallback strip sync is extracted into a standalone function reachable from page-shown/live-quotes, not only as a loadTVChart side effect', /function _aioSyncTvOhlcFallback/.test(html) && /html-tv-ohlc-fallback-shown/.test(html) && /html-tv-ohlc-fallback-live/.test(html));
check('EF-19: kr-technical KOSPI/KOSDAQ refresh buttons call analyzeKrIndex with the correct target ids, and the analyzeKrTickerDeep mis-wiring is gone', /data-action="analyzeKrIndex"\s+data-arg="\^KS11"\s+data-arg2="kr-kospi-tech-result"/.test(html) && /data-action="analyzeKrIndex"\s+data-arg="\^KQ11"\s+data-arg2="kr-kosdaq-tech-result"/.test(html) && !/data-action="analyzeKrTickerDeep"\s+data-arg="\^K[SQ]11"/.test(html));
check('EF-19: _fetchYahooChartData proxy chain includes codetabs.com fallback (live network audit showed corsproxy.io/allorigins alone failing repeatedly for KR tickers)', /api\.codetabs\.com\/v1\/proxy/.test(html));
check('headless tests cover Batch 2 efficacy fixes (EF-08/10/11/12/19)', /_testV5241Batch2Efficacy/.test(tests) && /T874/.test(tests) && /T875/.test(tests) && /T876/.test(tests) && /T877/.test(tests) && /T878/.test(tests));

// v52.42 (P657): FABLE-EFFICACY-AUDIT-2026-07-10 Batch 3 (EF-06/07/14/15/16) structural gates
check('EF-06: VIX term-structure seed fallback values render a distinguishable na state instead of the same value state as a live number',
  (/_aioRenderVixTermRegime/.test(core) && /\(정적\)/.test(core) && /라이브 미수신 — DATA_SNAPSHOT 시드값/.test(core))
  || (sentimentDomain.includes('export function vixTermStructure') && sentimentDomain.includes('blocked: true') && sentimentDomain.includes('points: { short, spot, medium, long }') && sentimentPage.includes('summary.vixTermStructure.regime') && sentimentPage.includes('canvas.dataset.aioRenderer')));
check('EF-07: kr-home supply title dates are overridden to an honest fallback label when the failure state renders, instead of coexisting with a confident "N/D 기준" date next to the failure warning', /_showKrSupplyFailureState/.test(html) && /#page-kr-home \.kr-supply-title/.test(html) && /폴백 데이터/.test(html));
check('EF-14: news source names are guarded by a non-Latin/non-Hangul script check separate from the title translation guard, so an untranslated source name cannot leak raw', /function _aioSafeSourceLabel/.test(data) && /window\._aioSafeSourceLabel\(n\.source\)/.test(core));
check('EF-15: Fear & Greed delta surfaces are recomputed from the just-fetched CNN previous-day score instead of only a possibly stale server snapshot field', /_fgLiveDelta/.test(data) && /_aioSetDeltaEl\('sentiment-fg-delta', _fgLiveDelta/.test(data) && /_aioSetDeltaEl\('home-fg-delta', _fgLiveDelta/.test(data));
check('EF-16: kr-macro rate/CPI/PMI cards expose a shared _fieldTs-based freshness badge instead of inconsistent per-card date disclosure', /_aioRenderKrMacroFreshnessBadges/.test(core) && /kr-macro-bokrate-freshness/.test(html) && /kr-macro-cpi-freshness/.test(html) && /kr-macro-pmi-freshness/.test(html));
check('headless tests cover Batch 3 efficacy fixes (EF-06/07/14/16)', /_testV5242Batch3Efficacy/.test(tests) && /T879/.test(tests) && /T880/.test(tests) && /T881/.test(tests) && /T883/.test(tests));

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
check('EF-17 (user-approved scope addition): home GLOBAL MARKETS table includes ES=F/NQ=F futures rows with a regular-hours-aware highlight, and the underlying symbols are already part of the live-quote fetch set (no new fetch pipeline required)', /sym:\s*'ES=F',\s*label:\s*'S&P Futures',\s*isFutures:\s*true/.test(html) && /isRegularHours/.test(html));
check('EF-18: kr-supply fetch uses the confirmed-live /api/index/{market}/trend path (curl-verified 200) instead of the confirmed-404 /investorTrend path, with a response-shape adapter preserving net-flow semantics', /_aioAdaptKrTrendResponse/.test(html) && /api\/index\/KOSPI\/trend'/.test(html) && /api\/index\/KOSDAQ\/trend'/.test(html));
check('headless tests cover Batch 4 efficacy fixes (EF-03/17/18)', /_testV5243Batch4Efficacy/.test(tests) && /T884/.test(tests) && /T885/.test(tests) && /T886/.test(tests));

// v52.44 (P659): B8 Cloudflare Worker anycast 403(forbidden) auto-retry mitigation
check('B8: shared _aioFetchClaudeWithRetry helper exists with a server-key gate, a 403 status check, and Anthropic-native forbidden-shape detection before retrying', /async function _aioFetchClaudeWithRetry\(url, fetchOpts, serverKey, maxRetries\)/.test(chat) && /serverKey\s*&&\s*res\.status\s*===\s*403/.test(chat) && /_peek\.error\.type\s*===\s*'forbidden'/.test(chat));
check('B8: callClaude routes both its initial request and its 400-beta-header fallback retry through the shared helper instead of a bare fetch to the Worker/Anthropic endpoint', (chat.match(/_aioFetchClaudeWithRetry\(_claudeTarget\.url/g) || []).length === 2);
check('B8: both aio-data.js Claude call sites (news translation batch + AI briefing generation) route through the shared retry helper with a defensive typeof fallback to bare fetch', (data.match(/_aioFetchClaudeWithRetry\s*:\s*fetch\)\(_ct\.url/g) || []).length === 2);
check('headless tests cover the B8 Worker-retry mitigation', /_testV5244WorkerAnycastRetry/.test(tests) && /T887/.test(tests) && /T888/.test(tests) && /T889/.test(tests) && /T890/.test(tests));

// v52.45 (P660): CODEX-COMPREHENSIVE-DIAGNOSIS-2026-07-10 WO-0 — workflow YAML corruption gate wiring
check('P660: package.json declares js-yaml as a devDependency (needed for real workflow YAML parsing, not just control-character regex)', /"js-yaml"\s*:/.test(packageJson));
check('P660: ci.yml runs npm install before the new control-character/workflow-YAML gate, and actually invokes it in the validate job', /npm install/.test(ciWorkflow) && /ci-control-char-check\.mjs/.test(ciWorkflow));
check('P660: control-char-baseline.json exists and records the known pre-existing mojibake count (regression-only gate, not a silent pass)', exists('_context/control-char-baseline.json'));

// v52.46 (P661/R294/WO-1A): portfolio data now shares the real _AioVault (AES-GCM-256+PBKDF2) with API keys,
// instead of the separate plaintext localStorage path the UI's "PIN 설정 후 AES-256 암호화" claim never matched.
check('WO-1A: aio_portfolio_data is enrolled in _AIO_SENSITIVE_KEYS so safeLS actually encrypts it when the shared vault is unlocked', /'aio_portfolio_data'/.test(core) && /_AIO_SENSITIVE_KEYS = new Set\(\[[\s\S]{0,400}'aio_portfolio_data'/.test(core));
check('WO-1A: renderPortfolio() is the real lock gate (checks isPortfolioLocked() before rendering), replacing the orphaned checkPortfolioPin() that nothing ever called', /function isPortfolioLocked\(\)/.test(html) && /if \(typeof isPortfolioLocked === 'function' && isPortfolioLocked\(\)\)/.test(html) && !/function checkPortfolioPin/.test(html));
check('WO-1A: unlockPortfolio() detects a wrong PIN via a null decrypt result (AES-GCM auth failure) rather than the old plaintext input.value===pin comparison', /const dec = await _AioVault\.decrypt\(raw\)/.test(html) && /dec === null/.test(html) && !/input\.value === pin\)/.test(html));
check('WO-1A: opting out of portfolio vault protection does not remove the shared aio_vault_salt (other encrypted API keys must stay intact)', /PF_VAULT_OPTOUT_KEY/.test(html) && !/removeItem\('aio_vault_salt'\)/.test(html));
check('headless tests cover the WO-1A portfolio vault contract', /_testV5246PortfolioVault/.test(tests) && /T891/.test(tests) && /T892/.test(tests) && /T893/.test(tests) && /T894/.test(tests) && /T895/.test(tests));

// v52.47 (P662/WO-1B): Anthropic proxy auth/cost-boundary hardening — client side sends the shared
// app token when routed through the Worker; the Worker's own behavior is verified separately by
// scripts/ci-worker-anthropic-check.mjs (a real handler-invocation test, not just a static contract).
check('WO-1B: _aioAppToken() helper exists and is exposed for cross-file reuse', /function _aioAppToken\(\)/.test(chat) && /window\._aioAppToken = _aioAppToken/.test(chat));
check('WO-1B: callClaude() sends the app token header specifically on the server-key (Worker) branch, not the direct-personal-key branch', /_claudeHeaders\['X-AIO-App-Token'\] = _aioAppToken\(\)/.test(chat));
check('WO-1B: both aio-data.js Claude call sites (translation + briefing) send the app token when server-key routed, with a defensive typeof fallback', (data.match(/'X-AIO-App-Token':\s*\(typeof _aioAppToken === 'function' \? _aioAppToken\(\) : ''\)/g) || []).length === 2);
check('WO-1B: cloudflare-worker-proxy.js enforces server-side Origin allowlist, an optional app-token check, a dedicated /anthropic rate limit, and KV fail-closed on the daily cap', /ALLOWED_ORIGINS\.includes\(_normalizedOrigin\)/.test(worker) && /env\.AIO_APP_TOKEN/.test(worker) && /ANTHROPIC_RATE_LIMIT/.test(worker) && /서버 키 모드 일시 비활성화/.test(worker) && /ANTHROPIC_KILL_SWITCH/.test(worker));
check('WO-1B: CORS preflight allows the new X-AIO-App-Token header (otherwise browsers block it before the Worker ever sees it)', /Access-Control-Allow-Headers['"]?:\s*'[^']*X-AIO-App-Token/.test(worker));

// v52.49 (P664/WO-6): Trading Score provenance/freshness — computeTradingScore()'s own evidenceAudit
// (7 tracked inputs, never consumed anywhere) is extended to the 6 remaining score inputs and wired
// into the shared cross-page decision header, so the screen and the score now read the same
// provenance object instead of two disconnected ones (WO-6 completion-gate wording, scoped to this
// slice — see DEFERRED-BLOCKS.md for the literal "every value" remainder that is out of scope here).
check('WO-6: TRADING_DECISION_CRITICAL_INPUTS covers all 13 computeTradingScore() inputs (previously only 7 of ~13, silently missing F&G/breadth/PCR/HY-spread/AAII/VVIX)', /vvix-price/.test(core) && /fg-sentiment/.test(core) && /breadth200-participation/.test(core) && /pcr-putcall/.test(core) && /hy-spread-bp/.test(core) && /aaii-bearish/.test(core));
check('WO-6: evidence engine has a distinct globalVar-based path for non-quote inputs (F&G/breadth/PCR/HY-spread/AAII are window globals + _markFetch keys, not window._liveData[symbol] quotes)', /function _aioGlobalRuntimeEvidence\(input\)/.test(core) && /function _aioQuoteRuntimeEvidence\(input\)/.test(core));
check('WO-6: AAII is honestly marked decisionUse=reference (weekly manual snapshot, no live fetch path) so it cannot silently count against the trading-critical-missing gate', /id:'aaii-bearish'[\s\S]{0,200}decisionUse:'reference'/.test(core));
check('WO-6: fetchHYSpread records into the shared _markFetch freshness registry like its sibling fetch functions (previously only a module-local hyLastFetch invisible to the evidence engine)', /_markFetch\('hySpread'\)/.test(data));
check('WO-6: _aioDefaultDecision reads computeTradingScore()\'s full result (not just .total) and merges its evidenceAudit.criticalMissing count into the page sourceKind, bounded to DELAYED/SNAPSHOT so routine partial staleness cannot flip every page to a permanent SNAPSHOT badge', /_scResult\.evidenceAudit/.test(core) && /_aioMergeSourceKind\(sourceKind,\s*_scoreEvidenceKind\)/.test(core) && /_missing\.length\s*>=\s*3/.test(core));
check('WO-6: decision header caveat surfaces which specific score inputs are missing/stale, additively combined with (not overwritten by) the page\'s static evidence-contract caveat', /_scoreCaveat/.test(core) && /evidence\.caveat\s*&&\s*d\.caveat\s*&&\s*evidence\.caveat\s*!==\s*d\.caveat/.test(core));
check('headless tests cover the WO-6 score-provenance contract', /_testV5249ScoreProvenance/.test(tests) && /T896/.test(tests) && /T897/.test(tests) && /T898/.test(tests) && /T899/.test(tests) && /T900/.test(tests));

// v52.51 (P666/WO-3): Factor model longrun validation — backtestFactors() parameterized (backward
// compatible), fetch-data.mjs given a direct-run guard so it's safely importable, and a new
// concurrency-capped, top-mcap-subset longrun script added. See WO-2 (P665) for the analogous
// trading-score validation this mirrors.
const backtestFactorsIdx = fetchScript.indexOf('function backtestFactors(stockData, opts)');
const backtestFactorsBody = backtestFactorsIdx >= 0 ? fetchScript.slice(backtestFactorsIdx, backtestFactorsIdx + 3000) : '';
check('WO-3: backtestFactors() accepts optional offsets/fwdDays that default to the original production constants (backward compatible with the existing 30-min-cron call site)', /var OFFSETS = opts\.offsets \|\| \[147, 126, 105, 84, 63, 42\], FWD = opts\.fwdDays \|\| 21/.test(backtestFactorsBody));
check('WO-3: backtestFactors() additionally returns a per-rebalance-date IC list (icByDate) needed to compute ICIR/t-stat, not just the averaged IC', /icByDate/.test(backtestFactorsBody));
check('WO-3: fetch-data.mjs guards its direct execution and allows an isolated screener-only task without import side effects', /const __entryArg = process\.argv\[1\] \? process\.argv\[1\]\.replace/.test(fetchScript) && /if \(__entryArg && \(import\.meta\.url === `file:\/\/\$\{__entryArg\}`/.test(fetchScript) && /process\.env\.SCREENER_ONLY === '1' \? enrichScreener\(\) : main\(\)/.test(fetchScript) && /task\.catch\(e => \{ console\.error\('\[fetch-data\] 치명적 오류:', e\); process\.exit\(1\); \}\);\s*\}/.test(fetchScript));
check('WO-3: closesToFactors/backtestFactors/_mean are exported from fetch-data.mjs for reuse by the longrun script (no formula duplication)', /export function closesToFactors/.test(fetchScript) && /export function backtestFactors/.test(fetchScript) && /export const _mean/.test(fetchScript));
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
  check('WO-3: classifyRegime/spearmanWithCI/trailingMax are exported from the WO-2 longrun script for reuse', /export function classifyRegime/.test(scoreLongrun) && /export function spearmanWithCI/.test(scoreLongrun) && /export function trailingMax/.test(scoreLongrun));
}

// v52.5x (P667/WO-4): viewport-matrix promoted from a report-only, FULL_INIT=0-by-default check
// to a real, blocking, FULL_INIT=1 gate — see BUG-POSTMORTEM P667 for the F-01 (SVG label
// overlap) bug this immediately found and fixed, and F-02 (zeroCanvases dead code, no
// pageerror/console.error collection) gaps it closed.
const viewportScript = exists('scripts/ci-viewport-matrix-check.mjs') ? read('scripts/ci-viewport-matrix-check.mjs') : '';
check('WO-4: ci.yml runs viewport-matrix with AIO_VIEWPORT_FULL_INIT=1 and viewport-matrix is a real deploy blocker (not continue-on-error, and included in deploy\'s needs:)', /AIO_VIEWPORT_FULL_INIT:\s*'1'/.test(ciWorkflow) && /needs:\s*\[[^\]]*viewport-matrix[^\]]*\]/.test(ciWorkflow) && !/continue-on-error: true[\s\S]{0,400}ci-viewport-matrix-check\.mjs/.test(ciWorkflow));
check('WO-4: viewport matrix collects real pageerror/console.error signal per route, not just static DOM shape checks', /page\.on\('pageerror'/.test(viewportScript) && /page\.on\('console'/.test(viewportScript) && /jsErrorCount/.test(viewportScript));
check('WO-4: viewport matrix\'s console.error allowlist only excludes verified-expected noise (the offline-test-harness net::ERR_FAILED side effect and the app\'s own intentional API-health warn→error escalation log), not a blanket suppression', /net::ERR_FAILED/.test(viewportScript) && /warn\\s\*→\\s\*error/.test(viewportScript));
check('WO-4: zeroCanvases detection actually queries and filters real <canvas> elements instead of the previous always-empty declared-but-unpopulated array', /querySelectorAll\('canvas'\)/.test(viewportScript) && /clientWidth === 0 \|\| cv\.clientHeight === 0/.test(viewportScript));
check('WO-4: a small-text policy is adopted and enforced (8px-and-below fails the gate; 9px stays observation-only pending a dedicated remediation pass, per the static scan showing ~34 pre-existing 9px instances vs ~0-1 at 7-8px)', /tinyTextCriticalCount/.test(viewportScript) && /html text at\/below 8px/.test(viewportScript));
check('WO-4: js/aio-ui.js _pricePosition() label/value SVG text baselines are spaced enough to not collide (F-01 fix — was 10px apart at 10px font, now 14px)', /slY \+ 35/.test(ui) && /slY \+ 21/.test(ui));
check('H2-02: FULL_INIT route matrix has route-specific settle predicates, semantic theme-detail proof, and unhandled rejection capture', /async function settleRoute/.test(viewportScript) && /routeSemanticReady/.test(viewportScript) && /__AIO_UNHANDLED_REJECTIONS__/.test(viewportScript) && /unhandledRejectionCount/.test(viewportScript));
check('H2-03: price-position markers clamp both SVG edges and have a browser fixture regression', /Math\.max\(0, Math\.min\(\(\(v - lo\) \/ range\) \* 366, 366\)\)/.test(ui) && /T921 price_position_svg_marker_fixture/.test(tests));

// v52.5x (P669/WO-8): documentation currency check — CODE-MAP.md's file-size table/target_version
// drifting silently against actual code was exactly the kind of "operational fact vs. doc drift"
// WO-8 asks CI to detect. Non-blocking by design (line counts drift continuously during normal
// development; a hard-failing gate here would just get bypassed/ignored, R300-adjacent lesson).
check('WO-8: documentation currency check script exists and is wired into CI', exists('scripts/ci-doc-currency-check.mjs') && /ci-doc-currency-check\.mjs/.test(ciWorkflow));

// v52.56 (P673/R303): H3-D/E desktop geometry + external failure-state contract
check('H3-D: sentiment and macro canvases are constrained to their actual laptop grid parent, preventing Chart.js 300px intrinsic-width clipping', /#page-sentiment canvas[\s\S]{0,260}width:\s*100%\s*!important/.test(html) && /#page-macro canvas[\s\S]{0,260}width:\s*100%\s*!important/.test(html));
check('H3-D: screener ranking table exposes a keyboard/screen-reader horizontal-scroll region', /class="aio-table-scroll"[^>]*role="region"[^>]*tabindex="0"[^>]*aria-label="스크리너 결과 표 가로 스크롤 영역"/.test(html));
check('H3-E: external source state normalizer covers success/partial/timeout/malformed and stores a shared registry', /normalizeExternalSourceState/.test(core) && /partial:\s*\{/.test(core) && /timeout:\s*\{/.test(core) && /malformed:\s*\{/.test(core) && /AIO_EXTERNAL_STATES/.test(core));
check('H3-E: Telegram feeds render an explicit external-feed state instead of silently leaving page slots blank', /tg-source-state/.test(data) && /setExternalSourceState/.test(core) && /statusMarkup/.test(data) && /_rssMarkFail/.test(data));
check('headless tests cover H3-D/E deterministic state fixtures and scroll affordance', /_testV5256ExternalSourceState/.test(tests) && /T907/.test(tests) && /T908/.test(tests) && /T909/.test(tests) && /T910/.test(tests) && /T911/.test(tests));
check('H3-F: third-party CDN libraries are async progressive enhancements, so an unavailable CDN cannot block the local app defer queue on reload', /chart\.umd\.min\.js"[^>]*async/.test(html) && /purify\.min\.js"[^>]*async/.test(html) && /lightweight-charts\.standalone\.production\.js"[^>]*async/.test(html) && !/chart\.umd\.min\.js"[^>]*defer/.test(html));
check('H3-G: 22-route contracts and cell-level data-lineage audit stay executable with zero broken/orphan sink condition', /getPageContractAudit/.test(core) && /expectedRoutePageCount:\s*17/.test(core) && /getDataLineageAudit/.test(core) && /totalOrphans/.test(core));
check('headless tests cover H3-F/G boot-queue and route/lineage runtime contracts', /T912/.test(tests) && /T913/.test(tests));
// v52.58 H3-G/H3-H/H3-I: close the handoff's element-level and human-surface gaps
// with executable contracts. The handoff calls this a 12-field inventory but lists
// 13 required names; the full listed set is intentionally enforced here.
check('H3-G: element lineage inventory exposes the full listed field set and is attached to the category audit', /getElementLineageInventory/.test(core) && /elementIdOrSelector/.test(core) && /sourceEndpointOrFile/.test(core) && /failureAndFallback/.test(core) && /elementLevel/.test(core));
check('H3-H: Critical-10 content hierarchy audit requires decision header, evidence/status, action affordance, and hidden developer surfaces', /getCritical10ContentHierarchyAudit/.test(core) && /evidenceAndStatus/.test(core) && /developerSurfaceVisible/.test(core) && /decision-not-first-visible-block/.test(core));
check('H3-I: Critical-10 accessibility audit covers accessible names, keyboard reachability, positive tabindex, and canvas names', /getCritical10AccessibilityAudit/.test(core) && /nameless-controls/.test(core) && /unfocusable-controls/.test(core) && /positive-tabindex/.test(core) && /unnamed-canvas/.test(core));
check('headless tests cover H3-G element lineage and H3-H/I surface contracts', /_testV5258HumanSurfaceContracts/.test(tests) && /T914/.test(tests) && /T915/.test(tests) && /T916/.test(tests) && /T917/.test(tests));
check('H3-F/H3-H: breadth route blocks synthetic chart fallbacks and uses history artifacts only', /data-operational-use/.test(ui) && /_aioHistorySeries\(['"]spx/.test(ui) && !/Chart\.register/.test(ui) && /T918 breadth_chart_runtime_only_contract/.test(tests));
check('H3-H/I: the real Chromium human-surface audit is wired as a deploy dependency', exists('scripts/ci-critical10-human-surface-check.mjs') && /ci-critical10-human-surface-check\.mjs/.test(ciWorkflow) && /needs:\s*\[[^\]]*human-surface/.test(ciWorkflow));
check('H2-04: one normalized AI error contract is shared by browser AI surfaces and Worker failures', /normalizeAiError/.test(core) && /_aioChatError/.test(chat) && /_aioSetLastAiError/.test(data) && /aioAiError/.test(worker) && /T919/.test(tests) && /T920/.test(tests));
check('H2-05: portfolio Vault has a blocking deterministic Chromium E2E covering PIN, reload, wrong/correct PIN, migration, opt-out, and input boundary', exists('scripts/ci-portfolio-vault-e2e.mjs') && /ci-portfolio-vault-e2e\.mjs/.test(ciWorkflow) && /portfolio-vault/.test(ciWorkflow) && /PFE2-01/.test(read('scripts/ci-portfolio-vault-e2e.mjs')) && /PFE2-08/.test(read('scripts/ci-portfolio-vault-e2e.mjs')));
check('H2-06: Pages deploy stages an explicit public artifact allowlist and exposes policy/metadata endpoints', exists('public-artifact-manifest.json') && exists('robots.txt') && exists('sitemap.xml') && /canonical/.test(html) && /og:image/.test(html) && /twitter:image/.test(html) && /explicit artifact allowlist/.test(ciWorkflow) && /public-artifact-manifest\.json/.test(ciWorkflow) && /guide-public-policy/.test(html));
check('H2-07: content truth audit removes retired feedback guidance, protects one inquiry path, and labels KR snapshot context', /getContentTruthAudit/.test(core) && /guide-public-policy/.test(html) && !/dydyd007@naver\.com/.test(html + '\n' + ui) && /T922/.test(tests) && /T923/.test(tests));
check('H2-08: route IA registry classifies 19 NAV_ROUTE + 2 DERIVED_VIEW + 1 REFERENCE and audits PAGES/contracts/history/hash', /AIO_ROUTE_REGISTRY/.test(core) && /getRouteIAAudit/.test(core) && /NAV_ROUTE/.test(core) && /DERIVED_VIEW/.test(core) && /T924/.test(tests) && /T925/.test(tests));
check('H2-09: declutter policy gives every route a first-screen intent/scenario and records priority visual review routes', /AIO_PAGE_DECLUTTER_POLICY/.test(core) && /getPageDeclutterAudit/.test(core) && /priorityRoutes/.test(core) && /T926/.test(tests) && /T927/.test(tests));
check('H2-10: all-route Chromium accessibility matrix is a blocking CI/deploy gate and enforces no visible text below 10px', exists('scripts/ci-accessibility-matrix-check.mjs') && /ci-accessibility-matrix-check\.mjs/.test(ciWorkflow) && /a11y-matrix/.test(ciWorkflow) && /fontUnder10/.test(read('scripts/ci-accessibility-matrix-check.mjs')) && !/font-size:\s*[789]px/.test(html) && !/fontSize:\s*[789]\b/.test(core) && /selectsWithoutName/.test(read('scripts/ci-accessibility-matrix-check.mjs')) && /unnamedCanvas/.test(read('scripts/ci-accessibility-matrix-check.mjs')));
check('H2-12: typed provenance links decision UI/score/AI through one runtime-derived evidence bundle and weakens action for missing/future/stale/manual evidence', /createTypedEvidence/.test(core) && /getDecisionEvidenceBundle/.test(core) && /getDecisionEvidencePromptContext/.test(core) && /buildPageDecisionAiPrompt/.test(core) && /provenanceBundle/.test(core) && /data-evidence-id/.test(core) && /evidenceId/.test(core) && /T930/.test(tests));
check('H2-13: Trading Score research artifact is reproducible but explicitly partial, with fixed-rule walk-forward and unresolved missing inputs/costs', exists('scripts/backtest-trading-score-longrun.mjs') && exists('public-data/score-backtest-longrun.json') && /PARTIAL validation/.test(read('scripts/backtest-trading-score-longrun.mjs')) && /walkForward/.test(read('public-data/score-backtest-longrun.json')) && /No transaction costs/.test(read('public-data/score-backtest-longrun.json')) && /momScore/.test(read('public-data/score-backtest-longrun.json')));
check('H2-14: Factor research artifact preserves IC/ICIR/t-stat outputs and does not claim PIT/survivorship validation', exists('scripts/backtest-factors-longrun.mjs') && exists('public-data/factor-backtest-longrun.json') && /survivorshipBiasCaveat/.test(read('scripts/backtest-factors-longrun.mjs')) && /not resolvable without paid point-in-time/i.test(read('scripts/backtest-factors-longrun.mjs')) && /ICIR/.test(read('public-data/factor-backtest-longrun.json')) && /survivorship/i.test(read('public-data/factor-backtest-longrun.json')));
check('H2-15: portfolio storage adapter slice is adopted while snapshot/global legacy migration remains explicit', /getArchitectureGovernanceAudit/.test(core) && /readSnapshotField/.test(core) && /storageAdapter/.test(core) && /completedSlices/.test(core) && /incompleteSlices/.test(core) && /storageAdapter/.test(html) && /adapter\.get\(PF_STORAGE_KEY/.test(html) && /adapter\.set\(PF_STORAGE_KEY/.test(html) && /T931/.test(tests));
check('H2-16: documentation and knowledge gates are wired for the final handoff audit', /ci-doc-currency-check\.mjs/.test(ciWorkflow) && /ci-knowledge-lint-check\.mjs/.test(knowledgeWorkflow) && /ci-workflow-compaction-check\.mjs/.test(ciWorkflow));

// Initial-interaction performance contract: production boot must never run whole-site audits or
// repeated global currentness scans on the user main thread. The status banner is informational only.
check('PERF-BOOT-01: boot status banner is nonblocking and has a 3s hard timeout', /id="aio-boot-loader"/.test(html) && /#aio-boot-loader[\s\S]{0,500}pointer-events:\s*none/.test(html) && /closeBootLoader\('화면 준비 완료'\); \}, 3000/.test(html));
check('PERF-BOOT-02: automatic ops push uses light mode by default and reserves getAutoOpsReadiness for explicit/detailed audit mode', /var full = opts\.full === true \|\| \(A\.isDetailedAuditMode/.test(core) && /if \(full && A\.getAutoOpsReadiness\)/.test(core) && /mode: full \? 'full' : 'light'/.test(core));
check('PERF-BOOT-03: currentness guard defaults to the active route and batches DOM reads before writes', /document\.querySelector\('\.page\.active'\)/.test(core) && /var liveRows =[\s\S]{0,500}\.map\(function\(el\)/.test(core) && /liveRows\.forEach\(function\(row\)/.test(core));
check('PERF-BOOT-04: live quotes debounce the scoped guard and retired 6s\/18s whole-document rescans stay absent', /scheduleMarketCurrentnessGuard\(250, 'live-quotes'\)/.test(data) && /window\.AIO\.scheduleMarketCurrentnessGuard = _aioScheduleMarketCurrentnessGuard/.test(core) && !/_aioScheduleMarketCurrentnessGuard\(6000/.test(core) && !/_aioScheduleMarketCurrentnessGuard\(18000/.test(core));

check('PERF-BOOT-05: public readiness uses materialized runtime state while full share audits remain explicit/dev-only', /var detailed = opts\.full === true/.test(data) && /if \(detailed\) \{[\s\S]{0,500}getShareReadinessAudit/.test(data) && /_aioBuildPublicShareReadiness\(\{ full: false \}\)/.test(data) && /_aioSchedulePublicReadiness/.test(data) && exists('scripts/ci-boot-interaction-check.mjs') && /ci-boot-interaction-check\.mjs/.test(ciWorkflow));

// v52.75 (WP-AI0): public AI beta safety boundary + unverified auto-analysis block.
check('WP-AI0: one shared public AI policy exposes beta/research wording, action gate, and Evidence/as-of disclosure helpers', /_AIO_PUBLIC_AI_POLICY/.test(chat) && /_aioPublicAIActionPolicyPrompt/.test(chat) && /_aioApplyAIActionGate/.test(chat) && /_aioBuildAIResponseDisclosure/.test(chat) && /_aioAppendAIPublicDisclosure/.test(chat));
check('WP-AI0: embedded and unified chat paths gate streaming/final output and persist gated text only', (/_publicChunkGate|_pageChunkResult/.test(chat)) && (/_publicGate|_pageDoneResult/.test(chat)) && /state\.messages\.push\(\{ role: 'assistant', content: visible \}\)/.test(chat) && /state\.messages\.push\(\{ role: 'assistant', content: visible \}\)/.test(html) && /extractChips\(visible\)/.test(chat) && /extractChips\(visible\)/.test(html));
check('WP-AI0: public surfaces visibly identify AI beta education/research assistance and disclose current-data recheck', /id="ai-panel-policy"/.test(html) && /BETA · 교육\/리서치 보조/.test(html) && /구체적 매매 지시는 제공하지 않습니다/.test(html) && /data-ai-public-policy="beta-research"/.test(chat));
check('WP-AI0: server market prose requires explicit semantic verification before sink selection', /marketAnalysisSemanticOk/.test(data) && /status: _serverMarketAnalysisVerified \? 'verified' : 'blocked-unverified'/.test(data) && /_serverMarketAnalysis\.status === 'verified'/.test(core));
check('WP-AI0: regression fixtures cover action block, educational pass, strong wording, disclosure metadata, and unverified market prose', /_testV5275PublicAIContract/.test(tests) && /T932/.test(tests) && /T933/.test(tests) && /T934/.test(tests) && /T935/.test(tests) && /T936/.test(tests));

// v52.76 (WP-AI1): one request envelope/response pipeline across all public
// AI entry points; retries must reuse the named completion handlers/request.
check('WP-AI1: shared request envelope records pipeline, validator, block-policy versions and bounded audit metadata', /_AIO_AI_PIPELINE_VERSION/.test(chat) && /_aioCreateAIRequestObject/.test(chat) && /_aioBeginAIRequestAttempt/.test(chat) && /_aioRunAIResponsePipeline/.test(chat) && /getAIResponsePipelineAudit/.test(chat));
check('WP-AI1: embedded retry reuses one completion callback contract and request object', /var _pageOnChunk = function/.test(chat) && /var _pageOnDone = function/.test(chat) && /callClaude\(systemPrompt, state\.messages, _pageOnChunk, _pageOnDone/.test(chat) && /_aioBeginAIRequestAttempt\(_pageAIRequest, nextModel\)/.test(chat));
check('WP-AI1: unified retry reuses one completion callback contract and request object', /var _uniOnChunk = function/.test(html) && /var _uniOnDone = function/.test(html) && /callClaude\(sysPrompt, state\.messages, _uniOnChunk, _uniOnDone/.test(html) && /_aioBeginAIRequestAttempt\(_uniAIRequest, nextModel\)/.test(html));
check('WP-AI1: translation and briefing use the same response pipeline and fail closed to local/deterministic fallback', /_translationRequest/.test(data) && /_aioRunAIResponsePipeline/.test(data) && /auto-translation/.test(data) && /_briefingRequest/.test(data) && /auto-briefing/.test(data) && /AI response pipeline unavailable/.test(data));
check('WP-AI1: briefing route is defined in the unified context map and regression tests cover all entry points', /briefing:\s*_aioCreateEvidenceContext/.test(chat) && /T937/.test(tests) && /T938/.test(tests) && /T939/.test(tests) && /T940/.test(tests));

// v52.77 (WP-AI2): typed claim schema and fail-closed claim/evidence validation.
check('WP-AI2: typed claim schema exposes metric/unit/scale/direction/asOf/source/evidenceId fields', /_AIO_CLAIM_SCHEMA_VERSION/.test(core) && /createTypedClaim/.test(core) && /validateTypedClaim/.test(core) && /getAIClaimSchemaPrompt/.test(core));
check('WP-AI2: structured claim envelopes are parsed and validated by the shared response pipeline', /extractAIClaimEnvelope/.test(core) && /validateAIClaimEnvelope/.test(core) && /validateAIResponseClaims/.test(core) && /claimAudit/.test(chat) && /typed-claim-validation/.test(chat));
check('WP-AI2: per-page and unified AI responses pass injected evidence rows into the shared typed-claim audit', /evidence: \(chatFreshPreflight && chatFreshPreflight\.after/.test(chat) && /evidence: \(_uniFreshPreflight && _uniFreshPreflight\.after/.test(html));
check('WP-AI2: counterexample fixtures cover F&G/VIX, NFP 10x, bp/percent, sign, FX inversion, missing evidence, parser, and pipeline block', /_testV5277TypedClaimContract/.test(tests) && /T941/.test(tests) && /T942/.test(tests) && /T943/.test(tests) && /T944/.test(tests) && /T945/.test(tests) && /T946/.test(tests) && /T947/.test(tests) && /T948/.test(tests) && /T949/.test(tests));

// v52.78 (WP-AI3): intent-aware reference retrieval, deterministic compaction,
// and input-token budget observability. Live evidence remains a separate path.
check('WP-AI3: shared retriever exposes intent classification, required evidence, route aliases, and bounded top-k reference retrieval', /classifyAIQueryIntent/.test(core) && /retrieveImportedResearch/.test(core) && /requiredEvidence/.test(core) && /topK/.test(core) && /sourceKind: 'REFERENCE'/.test(core));
check('WP-AI3: reference context is deterministically compacted within the 2K-6K token contract and preserves the reference-only rule', /compactAIContext/.test(core) && /budgetTokens/.test(core) && /deterministic line trim/.test(core) && /sourceKind policy=REFERENCE/.test(core) && /estimatedInputTokens/.test(core));
check('WP-AI3: P95 input-token and cost measurement audit is exposed with a stated +/-10 percent target', /recordAIContextBudget/.test(core) && /p95InputTokens/.test(core) && /targetErrorPct: 10/.test(core));
check('WP-AI3: page and unified entry points bind the active query and carry retrieval/context audits through the shared response pipeline', /_aioActiveAIQuery = q/.test(chat) && /_aioActiveAIQuery = q/.test(html) && /retrievalAudit: _pageRetrievalAudit/.test(chat) && /retrievalAudit: _uniRetrievalAudit/.test(html) && /contextBudgetAudit/.test(chat + html));
check('WP-AI3: regression fixtures cover intent, relevance, deterministic order, live/reference separation, recall, trim, P95 meter, and pipeline audit', /_testV5278AIRetrievalCompression/.test(tests) && /T950/.test(tests) && /T951/.test(tests) && /T952/.test(tests) && /T953/.test(tests) && /T954/.test(tests) && /T955/.test(tests) && /T956/.test(tests) && /T957/.test(tests));

// v52.79 (WP-AI4/5): external data boundary, portfolio privacy consent, and
// one shared financial-conduct/action-permission gate.
check('WP-AI4: untrusted external text is normalized, injection-audited, and wrapped as NEWS/WEB/TELEGRAM data', /sanitizeAIUntrustedText/.test(core) && /buildAIUntrustedBlock/.test(core) && /sourceKind=UNTRUSTED/.test(core) && /NEWS_TELEGRAM/.test(chat + html) && /WEB_SEARCH/.test(chat + html) && /SecurityFlags/.test(data));
check('WP-AI4: chat history has explicit off mode, 30-day retention, bounded entries, and sanitized storage', /getChatHistoryPolicy/.test(core) && /setChatHistoryEnabled/.test(core) && /prepareChatHistoryEntry/.test(core) && /CHAT_HISTORY_MAX = 50/.test(html) && /retentionDays/.test(html) && /_aioChatHistoryToggle/.test(core));
check('WP-AI5: portfolio AI uses a field allowlist, redaction preview, and session-only opt-in before unified send', /redactPortfolioForAI/.test(core) && /getPortfolioAIPrivacyPreview/.test(core) && /setPortfolioAIConsent/.test(core) && /포트폴리오 AI 전송 미리보기/.test(html) && /계좌ID.*제외/.test(html));
check('WP-AI5: conduct, suitability, evidence/sourceKind, and probability gates run inside the shared response pipeline', /evaluateAIActionPermission/.test(core) && /conductAudit/.test(chat) && /prohibited-conduct/.test(core) && /evidence-action-permission/.test(core) && /uncalibrated-probability/.test(core));
check('WP-AI4/5: page and unified entry points pass the active query to the common policy and untrusted wrappers', /query: q/.test(chat) && /query: q/.test(html) && /buildAIUntrustedBlock/.test(chat) && /buildAIUntrustedBlock/.test(html));
check('WP-AI4/5: deterministic regression fixtures cover injection, redaction, consent, history off, conduct, evidence, pipeline, and calibration', /_testAIUntrustedSecurityAndConduct/.test(tests) && /T958/.test(tests) && /T959/.test(tests) && /T960/.test(tests) && /T961/.test(tests) && /T962/.test(tests) && /T963/.test(tests) && /T964/.test(tests) && /T965/.test(tests) && /T966/.test(tests));

// v52.80 (WP-AI6/7): automated publish fallback and derived 22-route AI page contracts.
check('WP-AI6: automated translation/briefing/market-analysis outputs expose structured publish validation and deterministic fallback labels', /validateAIAutomatedPublish/.test(core) && /buildDeterministicEvidenceSummary/.test(core) && /getAIOutputSourceLabel/.test(core) && /publishAudit/.test(chat) && /requiresStructuredClaims/.test(data) && /fallback: 'AIO.synthesizeMarketAnalysis'/.test(data));
check('WP-AI7: the existing AIO_PAGE_CONTRACTS registry projects required/optional/forbidden AI page contracts without a parallel registry', /_aiPageContract/.test(core) && /ai: _aiPageContract/.test(core) && /getPageAIContract/.test(core) && /auditPageAIContracts/.test(core) && /kr-technical/.test(core) && /kr-tech/.test(core));
check('WP-AI6/7: regression fixtures cover structured publish blocking, fallback audit, 22-route coverage, answer modes, and source labels', /_testV5280PublishAndPageContracts/.test(tests) && /T967/.test(tests) && /T968/.test(tests) && /T969/.test(tests) && /T970/.test(tests) && /T971/.test(tests));

// v52.81 (WP-AI8/9/10): SLO/quota operations, golden A/B release gate, and feedback manifest.
check('WP-AI8: actual AI usage can record bounded latency/token/failure SLO samples and quota acquisition has a lock/limit contract', /recordAISLOSample/.test(core) && /getAISLOReport/.test(core) && /tryAcquireAIQuota/.test(core) && /_aioTrackApiUsage/.test(core) && /tryAcquireAIQuota/.test(chat));
check('WP-AI9: deterministic golden corpus and A/B release gate prevent unsupported regression or P0 release', /getAIGoldenCorpus/.test(core) && /runAIGoldenBenchmark/.test(core) && /evaluateAIGoldenABGate/.test(core) && /p0-errors/.test(core));
check('WP-AI10: feedback samples retain request/model/prompt/evidence/validator metadata', /createAIFeedbackSample/.test(core) && /createAIFeedbackSample/.test(html) && /feedbackId/.test(core) && /evidenceStatus/.test(core));
check('WP-AI8/9/10: regression fixtures cover SLO P95, quota race, golden corpus, A/B gate, and feedback manifest', /_testV5281OpsGoldenFeedback/.test(tests) && /T972/.test(tests) && /T973/.test(tests) && /T974/.test(tests) && /T975/.test(tests) && /T976/.test(tests));

// v52.82 (WP-AI11/12): conversation lifecycle and deterministic calculation evidence.
check('WP-AI11: request envelope and shared helpers carry session/turn/route/entity lifecycle, trim audit, and late-response rejection', /createAIConversationState/.test(core) && /beginAIConversationTurn/.test(core) && /transitionAIConversationState/.test(core) && /isCurrentAIResponse/.test(core) && /trimAIConversationContext/.test(core) && /conversationState/.test(chat) && /conversationAudit/.test(chat));
check('WP-AI12: approved deterministic calculators emit CalculationEvidence and fail closed on mutation/invariant errors', /createCalculationEvidence/.test(core) && /validateCalculationEvidence/.test(core) && /checkCalculationInvariant/.test(core) && /runApprovedCalculation/.test(core) && /percent-change.v1/.test(core) && /decisionUse: false/.test(core));
check('WP-AI11/12: regression fixtures cover route/entity race, request envelope, trim, arithmetic, invariant, unknown calculator, and portfolio weight', /_testV5282ConversationAndCalculation/.test(tests) && /T977/.test(tests) && /T978/.test(tests) && /T979/.test(tests) && /T980/.test(tests) && /T981/.test(tests) && /T982/.test(tests));

// v52.83 (WP-AI13/14): retrieval poisoning/quality gates and financial conduct
// classification with jurisdictional legal-review routing.
check('WP-AI13: retrieval documents carry version/chunk/time metadata and quarantine poisoned, retracted, or superseded material', /indexAIRetrievalDocuments/.test(core) && /quarantineAIRetrievalDocument/.test(core) && /documentVersion/.test(core) && /publishedAt/.test(core) && /poisoned-content/.test(core) && /superseded/.test(core));
check('WP-AI13: retrieval quality exposes recall/precision/source-tier/temporal metrics and blocks poisoned current action use', /evaluateAIRetrievalQuality/.test(core) && /recallAtK/.test(core) && /precisionAtK/.test(core) && /sourceTierCoverage/.test(core) && /temporalRelevance/.test(core) && /BLOCKED_POISONED_ACTION_USE/.test(core) && /row\.quarantined !== true/.test(core));
check('WP-AI14: conduct policy exposes a prohibited/legal-review/educational matrix and shared permission gate consumes the classifier', /getFinancialConductPolicy/.test(core) && /classifyFinancialConduct/.test(core) && /BLOCKED_P0/.test(core) && /LEGAL_REVIEW_REQUIRED/.test(core) && /EDUCATIONAL_ALLOWED/.test(core) && /conductAudit/.test(core));
check('WP-AI13/14: regression fixtures cover retrieval index, metrics, manual quarantine, poison filter, conduct matrix, legal review, and shared pipeline', /_testV5283RetrievalQualityAndConduct/.test(tests) && /T983/.test(tests) && /T984/.test(tests) && /T985/.test(tests) && /T986/.test(tests) && /T987/.test(tests) && /T988/.test(tests) && /T989/.test(tests) && /T990/.test(tests));

// v52.84 (WP-AI15/16): model-risk replay/release evidence and cache,
// isolation, idempotency, and stream-finalization boundaries.
check('WP-AI15: replay manifests retain revision/model/prompt/retriever/validator/evidence/output provenance and replay rejects drift', /createAIReplayManifest/.test(core) && /recordAIReplayManifest/.test(core) && /replayAIResponseSample/.test(core) && /evidenceSnapshotHash/.test(core) && /outputHash/.test(core));
check('WP-AI15: approval/canary/rollback release gate is fail-closed and pipeline records replay manifests', /evaluateAIModelRelease/.test(core) && /rollback-triggered/.test(core) && /recordAIReplayManifest/.test(chat) && /replayManifest/.test(chat));
check('WP-AI16: isolation cache key, idempotency state, and stream finalization are exposed and wired to the request/pipeline envelope', /buildAIIsolationCacheKey/.test(core) && /beginAIIdempotentRequest/.test(core) && /finalizeAIIdempotentRequest/.test(core) && /finalizeAIStream/.test(core) && /idempotencyKey/.test(chat) && /isolationKey/.test(chat) && /streamAudit/.test(chat));
check('WP-AI15/16: regression fixtures cover provenance, replay pass/fail, release approval/rollback, tenant isolation, idempotency, stream states, and shared pipeline wiring', /_testV5284ModelRiskIsolation/.test(tests) && /T991/.test(tests) && /T992/.test(tests) && /T993/.test(tests) && /T994/.test(tests) && /T995/.test(tests) && /T996/.test(tests) && /T997/.test(tests) && /T998/.test(tests));

// v52.85 (WP-AI17/18): coverage/exposure bias audit and signed human-chat
// certification evidence across assistive, keyboard, mobile, novice, and expert paths.
check('WP-AI17: coverage/exposure report measures region/sector/cap/liquidity/source coverage and neutralizes missingness', /buildAICoverageExposureReport/.test(core) && /evaluateAICoverageBias/.test(core) && /missingness/.test(core) && /BLOCKED_MISSINGNESS_PROMOTION/.test(core) && /sourceKind/.test(core));
check('WP-AI18: human chat certification exposes required SR/keyboard/mobile/novice/expert/task dimensions and signed evidence', /getHumanChatCertificationMatrix/.test(core) && /createHumanChatCertification/.test(core) && /evaluateHumanChatCertification/.test(core) && /screenReader/.test(core) && /signedBy/.test(core) && /signedAt/.test(core));
check('WP-AI17/18: regression fixtures cover exposure, missingness promotion, bias gate, certification matrix, complete/split/unsigned/incomplete human evidence', /_testV5285CoverageAndHumanCertification/.test(tests) && /T999/.test(tests) && /T1000/.test(tests) && /T1001/.test(tests) && /T1002/.test(tests) && /T1003/.test(tests) && /T1004/.test(tests) && /T1005/.test(tests) && /T1006/.test(tests));

// v52.86 (WP-AI19/20): non-agentic capability boundary and explicit
// provider/data/output rights, retention, and region registry.
check('WP-AI19: tool capability registry is read-only by default, denies unknown/mutation operations, and exposes an audit summary', /getAIToolCapabilityRegistry/.test(core) && /evaluateAIToolPermission/.test(core) && /BLOCKED_MUTATION/.test(core) && /BLOCKED_UNKNOWN_CAPABILITY/.test(core) && /DENY_BY_DEFAULT/.test(core) && /auditAIToolCapabilities/.test(core));
check('WP-AI20: rights registry retains provider/data/output/retention/region/training/redistribution fields and blocks unverified entries', /getAIRightsRegistry/.test(core) && /evaluateAIDataRights/.test(core) && /auditAIRightsRegistry/.test(core) && /trainingAllowed/.test(core) && /redistributionAllowed/.test(core) && /UNVERIFIED_LIVE/.test(core) && /rightsAudit/.test(chat));
check('WP-AI19/20: shared pipeline carries tool and rights audits and denies mutation intent', /toolAudit/.test(chat) && /non-agentic-boundary/.test(chat + core) && /T1009/.test(tests) && /T1014/.test(tests) && /_testV5286ToolBoundaryAndRights/.test(tests) && /T1007/.test(tests) && /T1008/.test(tests) && /T1010/.test(tests) && /T1011/.test(tests) && /T1012/.test(tests) && /T1013/.test(tests));

// v52.91: third-pass live currentness/root-cause gates.
check('LIVE3-01: stored API secrets never re-enter DOM values or reveal partial key fragments', /el\.value = '••••••••'/.test(ui + core) && !/el\.value = saved/.test(ui) && !/inp\.value = key;\s*\/\/ 실제 키 표시/.test(html) && !/slice\(0, 8\) \+ '\.\.\.' \+/.test(html + core));
check('LIVE3-02: early snapshot-date rendering uses the post-initialization window bridge and avoids DATA_SNAPSHOT TDZ', /var snap = window\.DATA_SNAPSHOT \|\| null/.test(core));
check('LIVE3-03: 20SMA breadth uses its value-specific server observation timestamp and fails closed', /id:'breadth200-participation', globalVar:'_breadth200', fetchKey:'breadthScreener'/.test(core) && /_aioApplyScreenerBreadth/.test(data) && /coveragePct\s*>=\s*85/.test(data) && /ageHours\s*<=\s*96/.test(data) && /window\._breadthLiveData\s*=/.test(data) && /getCurrentBreadthEvidence/.test(core) && /snapshotKey:null/.test(core));
check('LIVE3-04: Yahoo/FRED bridge never fabricates a missing 2Y or overwrites official T10Y2Y', !/:\s*4\.0\s*\)/.test(String((data.match(/function _syncYahooToFred\([\s\S]*?\n\}/) || [''])[0])) && /!fd\['T10Y2Y'\]/.test(data) && /Number\(window\._live2Y\)/.test(data));
check('LIVE3-05: MOVE/SKEW regimes require live observations and missing values render unavailable', /quote\('\^SKEW'\)/.test(core) && /quote\('\^MOVE'\)/.test(core) && /'move':\s*'—'/.test(core) && /'skew':\s*'—'/.test(core));
check('LIVE3-06: late breadth producer refreshes breadth, signal, and home consumers atomically', /updateBreadthBars\(\)/.test(data) && /refreshSignalDashboard\(\)/.test(data) && /refreshHomeDashboard\(\)/.test(data));
check('LIVE3-04: briefing labels the actual S&P index and reads the canonical pct field', /var spx = _ldSafe\('\^GSPC', 'price'\), spxChg = _ldSafe\('\^GSPC', 'pct'\)/.test(core) && /S&amp;P 500 지수/.test(core) && !/_ldSafe\('SPY', 'chgPct'\)/.test(core));
check('LIVE3-05: KR supply parses formatted values and renders missing as unknown rather than zero', /String\(v\)\.replace\(\/\[,\+\\s\]\/g/.test(html) && /streakEl\.textContent = '수급 미수신'/.test(html) && /미수신을 0원\/매도 우위로 해석하지 않는다/.test(html) && /기관 세부 수급 미수신/.test(html) && /프로그램 매매 미수신/.test(html));
check('LIVE3-06: conflicting stale Naver KR index quotes cannot overwrite a materially different server quote', /_aioKrQuoteConflicts/.test(data) && /_krDiff > 0\.0075/.test(data));
check('LIVE3-07: Telegram collection attempts and last success have separate semantics', /collectionStatus/.test(telegramFetcher) && /attemptedAt/.test(telegramFetcher) && /lastSuccessfulAt/.test(telegramFetcher) && /generatedAt means successful collection time/.test(telegramFetcher));
check('LIVE3-08: glossary expectancy math and tactical-score wording are non-predictive', /거래당 \+0\.4R/.test(glossary) && /예측·매수 신호가 아니며/.test(glossary) && !/승률 40% × R 2\.5 = \+100% 수익/.test(glossary));
check('LIVE3-09: quote producers preserve exchange observation time separately from file freshness', /regularMarketTime/.test(fetchData) && /marketState/.test(fetchData) && /exchangeTimezoneName/.test(fetchData) && /window\._liveData\[q\.symbol\]\.observedAt/.test(data));
check('LIVE3-10: failed client F&G refresh preserves a newer server observation instead of overwriting it with static seed', /\^\(live\|proxy\|delayed\)\$/.test(data) && /외부 관측값이 전혀 없을 때만 정적 snapshot/.test(data));

check('LIVE3-11: every external dependency has an explicit free-only replacement/rights/cadence state and provider availability is not treated as implementation', /getExternalDependencyAudit/.test(core) && /external-dependency-audit\.v1/.test(core) && /provider availability is not implementation status/.test(core) && /free-plan-only/.test(core) && /free_equivalent_unavailable/.test(core) && /free_key_required/.test(core));
check('LIVE3-12: a core quote outage preserves the last-known-good data artifact and screener refresh can run in isolation', /CORE_QUOTE_COVERAGE_FAILED/.test(fetchScript) && fetchScript.indexOf('CORE_QUOTE_COVERAGE_FAILED') < fetchScript.indexOf('await writeFile(OUT') && /SCREENER_ONLY/.test(fetchScript));
check('WP-10: every route contract carries required/optional producers, coverage, age, failure, and forbidden-claim state',
  /function _pageCompletenessContract\(id\)/.test(core) && /requiredProducers:/.test(core) && /optionalProducers:/.test(core) && /minCoverage:/.test(core) && /maxAge:/.test(core) && /failureState:/.test(core) && /forbiddenClaims:/.test(core));
check('WP-10: runtime exposes one page completeness API and distinguishes missing/stale/partial/blocked producer states',
  core.includes('getPageDataCompleteness') && core.includes('auditPageDataCompleteness') && core.includes('wp10.page-completeness.v1') && core.includes('stale-reference') && core.includes('empty') && core.includes('partial') && core.includes('blocked'));
check('WP-10: scheduler records attemptedAt/lastSuccessfulAt/coverage/evidenceIds and failure reason',
  /cfg\._attemptedAt/.test(data) && /cfg\._lastSuccessfulAt/.test(data) && /cfg\._coverage/.test(data) && /cfg\._evidenceIds/.test(data) && /cfg\._failureReason/.test(data));
check('WP-10: browser fixtures cover 22-route contract fields and disconnected producer failure state',
  /T1021 page_completeness_contract_fields/.test(tests) && /T1022 producer_disconnect_failure_state/.test(tests) && /T1023 page_completeness_audit_22_routes/.test(tests));
check('R308/T686: reference fallback drift is explicit and not promoted to live parity',
  core.includes('referenceOnly') && core.includes('fallbackAsOf') && core.includes('parityRequired') && tests.includes('sfcReferenceOnly') && tests.includes('reference fallback drift is disclosed'));
check('R340/P712: Treasury maturity fields are separated and 2s10s uses the canonical evidence helper',
  /'\^TNX':\s*\['tnx',\s*null\]/.test(data) && !/'\^TNX':\s*\['tnx2y'/.test(data) && /getUsTreasuryCurveEvidence/.test(core) && /spread2s10s/.test(core) && !/\^FVX[^\n]{0,120}\*\s*0\.95/.test(html));
check('R340/P712: KR theme breadth and market-health claims fail closed on missing current inputs',
  /evaluateKrThemeQuoteCoverage/.test(html) && /weightedCoverage\s*>=\s*0\.7/.test(html) && /테마 종합판정 보류/.test(html) && /currentInputs\s*<\s*4/.test(html) && /판정 보류 · 현재 입력/.test(html));
check('R340/P712: future-event calendar is data-driven and no stale 7\/10 BOK row remains',
  /renderOfficialFutureCalendar/.test(html) && /id="official-future-calendar"/.test(html) && !/>7\/10<\/span>[\s\S]{0,260}한국은행 금통위/.test(html));
check('R340/P712: semantic market-integrity tests cover curve exactness and KR missingness',
  /T1025 treasury_curve_exact_2s10s/.test(tests) && /T1027 kr_theme_missingness_fail_closed/.test(tests) && /T1028 technical_indicator_no_intraday_synthesis/.test(tests) && /T1029 ticker_chart_no_random_history/.test(tests) && /T1030 rrg_history_fail_closed/.test(tests) && /T1031 mcclellan_requires_advance_decline_history/.test(tests) && /T1032 hy_oas_official_only/.test(tests) && /T1033 breadth_chart_no_random_series/.test(tests) && /T1034 market_health_required_inputs_fail_closed/.test(tests));
check('R340/P712: synthetic market-series formulas are absent from decision paths',
  !/50\s*\+\s*\(chg\s*\*\s*5\)/.test(html) && !/500\s*\*\s*abv50/.test(html) && !/\(85\s*-\s*p\)\s*\*\s*20\s*\+\s*250/.test(ui) && !/latestLiveVal\s*\*\s*\(1\s*\+\s*\(Math\.random/.test(core));
check('R340/P712: KR yields and US breadth require timestamped current evidence and fail closed otherwise',
  /T1035 kr_yield_current_source_fail_closed/.test(tests) && /T1036 breadth_current_evidence_gate/.test(tests) && /getCurrentBreadthEvidence/.test(core)
  && (/_breadthSeriesReferenceAsOf\s*=\s*null/.test(ui) || (/getCurrentBreadthEvidence/.test(ui) && /if\s*\(!currentBreadth\.available\)/.test(ui) && /현재 원천 미수신/.test(ui)))
  && !/DATA_SNAPSHOT\.krBond3y/.test(html.slice(html.indexOf('function updateKrMacroFromLive'), html.indexOf('function updateKrMacroFromLive') + 5000)));
check('R344/P727: retired fxbond commentary has no orphan function, call, or DOM sink while live status stays in the canonical updater',
  !/function\s+(?:updateFxDynamicComments|generateFxBondCommentary)\s*\(/.test(html) &&
  !/(?:getElementById|querySelector)\(['"](?:fx-dc-|bond-dc-)/.test(html) &&
  /function\s+updateFxBondPage\([\s\S]{0,9000}?fxbond-risk-pill[\s\S]{0,3000}?yc-inversion-badge[\s\S]{0,3000}?updateCrossAssetMatrix\(\)/.test(html));
check('R344/P727: alert polling has no unregistered raw interval fallback',
  /_aioRegisterTimer\('alerts-check'/.test(chat) && !/\bsetInterval\s*\(/.test(chat));
check('R345/P728: quote batches defer per-symbol lineage scans and keep one canonical DOM bind',
  /set\(sym, price, pct, source, opts\)/.test(core) &&
  /!opts\.deferDomAnnotation/.test(core) &&
  /PriceStore\.set\(q\.symbol, price, pct,[^\n]+deferDomAnnotation:\s*true/.test(data) &&
  !/Bulk update ALL data-live-price/.test(data));
check('R345/P728: targeted lineage annotation covers data-live-field without a document-wide selector',
  /if \(target\) \{[\s\S]{0,700}?data-live-field\^=/.test(core) &&
  /getAttribute\('data-live-field'\)/.test(core));
check('R345/P728: retired KR investor ranking fanout is not scheduled and the runtime audit follows evidence',
  !/async function fetchKrDynamicData\(\)[\s\S]{0,900}?fetchKrInvestorTop10/.test(data) &&
  /evidenceAvailable:\s*valid/.test(html) &&
  !/missing-kr-supply-target/.test(html));

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
