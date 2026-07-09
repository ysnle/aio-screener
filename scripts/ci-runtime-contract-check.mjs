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
const worker = exists('cloudflare-worker-proxy.js') ? read('cloudflare-worker-proxy.js') : '';
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
check('tests cover Telegram digest memo injection', /T831[\s\S]{0,2200}SCREENER_DB memo/.test(tests) && /_telegramMemoOverlay/.test(tests));
check('Telegram page feeds cover fundamental/themes/KR technical pages', /id="tg-feed-fundamental"/.test(html) && /id="tg-feed-themes"/.test(html) && /id="tg-feed-theme-detail"/.test(html) && /id="tg-feed-kr-technical"/.test(html));
check('Telegram page routing includes credit and AI infrastructure tags by page', /'fundamental':\s*\[[^\]]*'semi'[^\]]*'credit'/.test(data) && /'themes':\s*\[[^\]]*'power'[^\]]*'credit'/.test(data) && /'fxbond':\s*\[[^\]]*'credit'/.test(data) && /'kr-technical':\s*\[[^\]]*'semi'/.test(data) && /'credit':\s*\{\s*label:/.test(data));
check('Telegram market-note digest tag is consumed by briefing and market-news pages', /'briefing':\s*\[[^\]]*'market-note'/.test(data) && /'market-news':\s*\[[^\]]*'market-note'/.test(data));
if (exists('public-data/telegram-digest.json')) {
  try {
    const digest = JSON.parse(read('public-data/telegram-digest.json'));
    const produced = Object.entries(digest.topicCounts || {}).filter(([, count]) => Number(count) > 0).map(([topic]) => topic);
    const missing = produced.filter((topic) => !telegramConsumedTags.has(topic));
    check('produced Telegram digest topics are consumed by at least one page', missing.length === 0, missing.join(', '));
  } catch (error) {
    check('public Telegram digest topic inventory parses for routing coverage', false, error.message);
  }
}
check('runtime promotes credit to a first-class news topic', /credit:\s*\[[^\]]*credit spread/.test(data) && /credit:\s*\{\s*cls:\s*'nit-warn'/.test(data) && /key:\s*'credit'[\s\S]{0,80}크레딧/.test(data));
check('analysis news surfaces subscribe to credit/funding risk', /macro:\s*\{[\s\S]{0,360}topics:\s*\[[^\]]*'credit'/.test(data) && /fxbond:\s*\{[\s\S]{0,380}topics:\s*\[[^\]]*'credit'[^\]]*'fxbond'/.test(data) && /fundamental:\s*\{[\s\S]{0,420}topics:\s*\[[^\]]*'credit'/.test(data) && /themes:\s*\{[\s\S]{0,420}topics:\s*\[[^\]]*'credit'/.test(data) && /breadth:\s*\{[\s\S]{0,360}topics:\s*\[[^\]]*'credit'/.test(data));
check('Telegram long-form reports survive on analysis pages', /allowLongReport/.test(data) && /'fundamental','themes','theme-detail','kr-macro'/.test(data));
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
check('event risk context is refreshed to post-FOMC 2026-06-19', /AIO_EVENT_RISK_CONTEXT/.test(core) && /asOf:\s*'2026-06-19'/.test(core) && /Post-FOMC hawkish hold/.test(core) && /Hormuz\/oil reopening watch/.test(core));
check('page body redesign hub registry exists', /AIO_PAGE_ACTION_HUBS/.test(core) && /_aioApplyPageBodyRedesign/.test(core) && /getPageRedesignAudit/.test(core));
check('page evidence currentness contract exists', /AIO_PAGE_EVIDENCE_CONTRACT/.test(core) && /getPageEvidenceState/.test(core) && /getPageEvidenceCurrentnessAudit/.test(core));
check('decision header renders page evidence caveat', /aio-decision-caveat/.test(core) && /d\.caveat/.test(core));
check('high-risk pages are capped below raw LIVE when data is mixed', /technical:\s*\{[\s\S]{0,120}maxSourceKind:\s*'DELAYED'/.test(core) && /'market-news':\s*\{[\s\S]{0,120}maxSourceKind:\s*'DELAYED'/.test(core) && /ticker:\s*\{[\s\S]{0,160}emptyKind:\s*'UNAVAILABLE'/.test(core));
check('home public readiness panel is wired to runtime audits', /id="aio-public-readiness"/.test(html) && /_aioBuildPublicShareReadiness/.test(data) && /getPublicShareReadiness/.test(data) && /getShareReadinessAudit/.test(core));
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
    && /getPortfolioContextForAI[\s\S]{0,1800}_lastPortfolioBacktestLab/.test(html)
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
    && /복기 노트를 먼저 입력하세요/.test(html)
    && /updateAIPanelContext\('portfolio'\)/.test(html)
    && /chatSendUnified\(\)/.test(html)
    && /매매 복기·학습 코치 모드/.test(chat)
    && /사실\/감정\/추정 분리/.test(chat)
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
const knowledgeBase = read('_context/KNOWLEDGE-BASE.md');
check(
  'v52.35 AI capex funding pulse framework feeds AI chat, keywords, and knowledge base',
  /AI CAPEX 자금조달 맥박/.test(chat)
    && /LQD YTM/.test(chat)
    && /IG OAS/.test(chat)
    && /AI capex funding/.test(data)
    && /capital funding pulse/.test(data)
    && /AI Capex Funding Pulse/.test(knowledgeBase),
  'macro/signal answers must evaluate AI capex through funding cost and credit evidence, not demand headlines only'
);
check(
  'v52.35 semiconductor breadth washout framework feeds AI chat, keywords, and knowledge base',
  /20EMA \/ 50EMA \/ 100SMA \/ 200SMA Stage Map/.test(chat)
    && /SMH\/XSD 반도체 브레드쓰 워시아웃/.test(chat)
    && /sourceKind=REFERENCE/.test(chat)
    && /SMH breadth washout/.test(data)
    && /XSD breadth washout/.test(data)
    && /Semi Breadth Washout/.test(knowledgeBase),
  'semi breadth image levels must stay reference-only and MA layers must remain distinct'
);
check(
  'v52.35 AI value-chain long-short framework feeds fundamental chat and screener overlays',
  /AI 밸류체인 포지션 구분/.test(chat)
    && /인프라 판매자/.test(chat)
    && /monetization layer|수익화/.test(chat)
    && /Burry AI-chain debate/.test(data)
    && /AI monetization-layer test case/.test(data)
    && /Burry memory-cycle debate/.test(data),
  'fundamental AI answers must distinguish infra seller risk from monetization platform evidence'
);
for (const pageId of ['home','signal','market-news','technical','screener','ticker','portfolio','macro','fxbond','fundamental','kr-home','kr-supply','kr-themes','kr-macro','kr-technical']) {
  check(`page redesign config exists for ${pageId}`, new RegExp(`${pageId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`).test(core) || core.includes(`'${pageId}':`));
}
check('non-primary market-news/screener/signal controls are folded behind advanced details', /_aioFoldDensePageControls/.test(core) && /market-news/.test(core) && /screener-backtest-panel/.test(core) && /signal-lockout-control/.test(core));
check('core news and screener filters remain active on the main screen', !/#news-country-chips|#news-topic-chips|#news-type-tabs|#scr-market/.test(core));
check('unified AI panel covers home/screener/ticker/KR pages', /'home'\s*:\s*'home'/.test(html) && /'screener'\s*:\s*'screener'/.test(html) && /'ticker'\s*:\s*'ticker'/.test(html) && /'kr-home'\s*:\s*'kr-home'/.test(html) && /'kr-supply'\s*:\s*'kr-supply'/.test(html));
check('CHAT_CONTEXTS includes kr-home for unified KR landing AI', /'kr-home'\s*:\s*\{/.test(chat));
check('safe numeric formatter is available for live/default-path renderers', /window\._aioSafeFixed\s*=\s*function/.test(core));
check('ticker live price renderer does not call live.price.toFixed directly', !/live\.price\.toFixed\(/.test(core));
check('scenario sum renderers guard missing sum before toFixed', !/sumCheck\.sum\.toFixed\(/.test(core) && !/sigSum\.sum\.toFixed\(/.test(core));
check('Chart tooltip callbacks guard missing parsed.y before toFixed', !/ctx\.parsed\.y\.toFixed\(/.test(core));
check('home dashboard VIX default path guards missing live price before toFixed', !/vix\.price\?\.toFixed\(/.test(data) && !/vp\.toFixed\(2\)/.test(data));
check('theme detail deep analysis filters finite pct values before toFixed', /topV\s*=\s*-Infinity/.test(html) && /botV\s*=\s*Infinity/.test(html) && /pctVal\s*=\s*d\s*&&\s*_themeFinitePct\(d\.pct\)/.test(html) && /_themeSafeFixed\(topV,\s*2/.test(html));
check('theme-detail route resolves to themes inline detail surface', /id === 'theme-detail'/.test(core) && /_aioOpenThemeDetailOnThemes/.test(core) && /showThemeDetail\(themeId\)/.test(core));
check('briefing summary F&G reads _lastFG before snapshot fallback', /var fgLive = Number\(window\._lastFG\)/.test(data) && /Number\.isFinite\(fgLive\)\s*\?\s*fgLive/.test(data));
check('KR candle chart auto-loads from canvas and avoids zero-baseline compression', /krCandleCanvas/.test(html) && /loadKrCandleChart\(krCode \|\| '005930'\)/.test(html) && /beginAtZero:\s*false/.test(html) && /suggestedMin:\s*ySuggestedMin/.test(html) && /suggestedMax:\s*ySuggestedMax/.test(html));
check('headless tests cover all-theme detail and route redirect regressions', /T860 theme_detail_all_themes_no_throw_v5227/.test(tests) && /T861 theme_detail_route_redirect_v5227/.test(tests));
check('proxy layer rejects HTML block pages for JSON endpoints before caching success', /_aioProxyUrlExpectsJson/.test(data) && /_aioValidateProxyResponse/.test(data) && /aioProxyBlockedHtml/.test(data) && /proxy returned HTML for JSON endpoint/.test(data));
check('KR supply failure state clears waiting UI instead of leaving 수신 대기', /function _showKrSupplyFailureState/.test(html) && /kr-investor-top10-date/.test(html) && /\/로딩 중\|수신 대기\//.test(html) && /T863 kr_supply_failure_state_clears_waiting_v5228/.test(tests));
check('Cloudflare worker handles Naver JSON endpoints with browser-like headers and HTML block guard', /targetExpectsJson/.test(worker) && /m\.stock\.naver\.com/.test(worker) && /Upstream returned HTML block page for JSON endpoint/.test(worker) && /Referer = 'https:\/\/m\.stock\.naver\.com\/'/.test(worker));
check('viewport matrix CI script covers 22 routes, four viewport widths, topbar clipping, and SVG text geometry', /ci-viewport-matrix-check\.mjs/.test(read('.github/workflows/ci.yml')) && /const ROUTES = \[/.test(read('scripts/ci-viewport-matrix-check.mjs')) && /'theme-detail'/.test(read('scripts/ci-viewport-matrix-check.mjs')) && /mobile390/.test(read('scripts/ci-viewport-matrix-check.mjs')) && /desktop1440/.test(read('scripts/ci-viewport-matrix-check.mjs')) && /topbarClipCount/.test(read('scripts/ci-viewport-matrix-check.mjs')) && /svgTextOverlapCount/.test(read('scripts/ci-viewport-matrix-check.mjs')) && /svgTinyTextCount/.test(read('scripts/ci-viewport-matrix-check.mjs')));
check('proxy registry ranks active proxies by success-rate score, not only static order', /okCount/.test(data) && /failCount/.test(data) && /getScore:\s*function/.test(data) && /self\.getScore\(b\)\s*-\s*self\.getScore\(a\)/.test(data));
check('quote count labels distinguish client live quotes from server snapshot quotes', /클라 시세/.test(data) && /서버 스냅샷 시세/.test(data));
check('viewport matrix detects duplicate news and briefing cards by word-bag key', /wordBagKey/.test(read('scripts/ci-viewport-matrix-check.mjs')) && /duplicateCardCount/.test(read('scripts/ci-viewport-matrix-check.mjs')) && /market-news\|briefing/.test(read('scripts/ci-viewport-matrix-check.mjs')));
check('value slot renderer encodes value/pending/failed/na states and touched market-pulse/VIX term surfaces', /_aioRenderValueSlot/.test(core) && /data-value-state/.test(core) && /state === 'failed'/.test(core) && /state === 'na'/.test(core) && /_aioRenderValueSlot\(elM/.test(html) && /_aioRenderValueSlot\(el,\s*\(v9dLive \|\| v3mLive\)/.test(core));
check('briefing decision summary F&G uses live-first source, not dead snap.fg.value/snap.fearGreed fields', (data.match(/var fgLive = Number\(window\._lastFG\)/g) || []).length >= 2 && !/snap\.fg\.value|snap\.fearGreed/.test(data) && /T867 briefing_decision_summary_fg_live_first_v5234/.test(tests));
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

// [G] v52.39 P654/R291: page fundamentals education layer (AIO_PAGE_FUNDAMENTALS) contract.
// §1 audit found E1(concept)/E2(why)/E5(action) missing across 20 of 22 route pages; this
// component is the single registry+renderer that closes that gap. theme-detail/guide are
// intentionally excluded (orphan redirect surface / already-complete hub page, see design doc §4).
const pageFundStart = ui.indexOf('var AIO_PAGE_FUNDAMENTALS = {');
const pageFundEnd = ui.indexOf("_aioPageBus.register('ui-page-fundamentals'");
const pageFundBlock = pageFundStart >= 0 && pageFundEnd >= 0 ? ui.slice(pageFundStart, pageFundEnd) : '';
const pageFundKeys = [...pageFundBlock.matchAll(/^\s*'([a-z-]+)':\s*\{$/gm)].map((m) => m[1]);
check('AIO_PAGE_FUNDAMENTALS registry exists with at least 20 page entries', pageFundKeys.length >= 20, `found ${pageFundKeys.length} keys`);
check('AIO_PAGE_FUNDAMENTALS excludes theme-detail/guide (orphan redirect / already-complete hub)', !pageFundKeys.includes('theme-detail') && !pageFundKeys.includes('guide'));
check('_aioRenderPageFundamentals renderer is defined and wired to aio:pageShown', /function\s+_aioRenderPageFundamentals\(pageId\)/.test(ui) && /_aioPageBus\.register\('ui-page-fundamentals',\s*'aio:pageShown'/.test(ui));
check('page fundamentals renderer is idempotent across repeated page visits', /data-aio-fund-done/.test(ui));
check('page fundamentals component must not reuse the declutter-flagged .aio-page-brief class (R291/v50.29)', !/aio-page-brief/.test(pageFundBlock));
check('page fundamentals component does not add new aria-live regions (R291 scarcity gate)', !/aria-live/.test(pageFundBlock));
check('headless tests cover the page fundamentals registry+render contract', /T869 page_fundamentals_registry_and_render_v5239/.test(tests));
// P654 follow-up: initFromHash() (aio-ui.js, fires the first aio:pageShown for a hash-loaded page,
// and 'home' never calls showPage() at all on a bare load) runs earlier in this same file than the
// 'ui-page-fundamentals' registration above — without a one-time catch-up render for whatever page
// is already .active by then, the very first page a visitor lands on never gets the block until
// they navigate away and back. Guard this so the catch-up call cannot be silently deleted later.
check('page fundamentals renderer catches up on the page already active at script-load time (initFromHash ordering)', /querySelector\('\.page\.active'\)[\s\S]{0,200}_aioRenderPageFundamentals\(/.test(ui));

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
check('EF-08: carry-unwind rate-diff label discloses the BOJ side is a fixed constant, not a live feed', /BOJ 정책금리 고정값 기준/.test(data));
check('EF-10: ticker page Key Metrics + Quarterly Results dead slots render an honest na state pointing to the fundamental page instead of a silent permanent dash', /_tickerGapIds/.test(core) && /ticker-m-mcap/.test(core) && /ticker-f-ni/.test(core) && /펀더멘탈.*이동 후/.test(core));
check('EF-11: risk-monitor VXX-term-structure and RSP/SPY-ratio status slots fall back to an explicit pending state when live inputs are missing', /VXX 또는 VIX 라이브 시세 미수신/.test(html) && /RSP 또는 SPY 라이브 시세 미수신/.test(html));
check('EF-12: TV OHLC fallback strip sync is extracted into a standalone function reachable from page-shown/live-quotes, not only as a loadTVChart side effect', /function _aioSyncTvOhlcFallback/.test(html) && /html-tv-ohlc-fallback-shown/.test(html) && /html-tv-ohlc-fallback-live/.test(html));
check('EF-19: kr-technical KOSPI/KOSDAQ refresh buttons call analyzeKrIndex with the correct target ids, and the analyzeKrTickerDeep mis-wiring is gone', /data-action="analyzeKrIndex"\s+data-arg="\^KS11"\s+data-arg2="kr-kospi-tech-result"/.test(html) && /data-action="analyzeKrIndex"\s+data-arg="\^KQ11"\s+data-arg2="kr-kosdaq-tech-result"/.test(html) && !/data-action="analyzeKrTickerDeep"\s+data-arg="\^K[SQ]11"/.test(html));
check('EF-19: _fetchYahooChartData proxy chain includes codetabs.com fallback (live network audit showed corsproxy.io/allorigins alone failing repeatedly for KR tickers)', /api\.codetabs\.com\/v1\/proxy/.test(html));
check('headless tests cover Batch 2 efficacy fixes (EF-08/10/11/12/19)', /_testV5241Batch2Efficacy/.test(tests) && /T874/.test(tests) && /T875/.test(tests) && /T876/.test(tests) && /T877/.test(tests) && /T878/.test(tests));

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
