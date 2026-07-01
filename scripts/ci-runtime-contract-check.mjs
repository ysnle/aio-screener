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
const runtimeBundle = [core, data, ui, chat].join('\n');

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
check('computeTradingScore returns both total and score aliases for legacy consumers', /function\s+computeTradingScore/.test(html) && /\{\s*total\s*,\s*score\s*:\s*total/.test(html));
check('classifyMarketRegime does not use optimistic breadth default 75', /function\s+classifyMarketRegime/.test(html) && !/breadth200[\s\S]{0,220}:\s*75\)/.test(html));
check('score advice no longer labels 75+ as aggressive buy', /function\s+getScoreAdvice/.test(html) && !/function\s+getScoreAdvice[\s\S]{0,500}적극\s*매수/.test(html));
check('trading guidance avoids aggressive-buy wording on score 75+', !/75\+\s*(?:적극\s*매수|적극매수)/.test(html + '\n' + chat + '\n' + data + '\n' + ui));
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
check('public readiness exposes page-level source/asOf matrix', /pageEvidenceRows/.test(data) && /weakPages/.test(data) && /aio-public-readiness-pages/.test(data) && /aio-public-page-source/.test(html) && /asOf pending/.test(data));
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
