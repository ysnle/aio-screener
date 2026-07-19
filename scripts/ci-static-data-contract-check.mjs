import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));
const core = read('js/aio-core.js');
const dataCode = read('js/aio-data.js');
const ui = read('js/aio-ui.js');
const index = read('index.html');
const chat = read('js/aio-chat.js');
const runtime = `${core}\n${dataCode}\n${ui}\n${index}\n${chat}`;
const data = json('public-data/data.json');
const screener = json('public-data/screener.json');
const history = json('public-data/history.json');
const failures = [];

function assert(ok, message) { if (!ok) failures.push(message); }
function hasNumber(value) { return value != null && value !== '' && Number.isFinite(Number(value)); }
function segment(id) { return screener?.breadth?.segments?.[id] || {}; }
function historyHas(...keys) { return history.length >= 3 && keys.every((key) => history.some((row) => hasNumber(row?.[key]))); }

const snapshotStart = core.indexOf('const DATA_SNAPSHOT = {');
const snapshotEnd = core.indexOf('\n};', snapshotStart);
assert(snapshotStart >= 0 && snapshotEnd > snapshotStart, 'DATA_SNAPSHOT contract block missing');
const snapshot = snapshotStart >= 0 && snapshotEnd > snapshotStart ? core.slice(snapshotStart, snapshotEnd) : '';
const volatileKeys = ['spx','nasdaq','dow','rut','vix','vvix','skew','move','tnx','tyx','fvx','irx','dxy','wti','brent','gold','silver','btc','kospi','kosdaq','krw','fg','pcr','aaiiBear','breadth5sma','breadth20sma','breadth50sma','breadth200sma'];
volatileKeys.forEach((key) => assert(new RegExp(`\\b${key}\\s*:\\s*null\\b`).test(snapshot), `volatile DATA_SNAPSHOT field must initialize null: ${key}`));

const prohibited = [
  [/const\s+FALLBACK_QUOTES\s*=|var\s+FALLBACK_QUOTES\s*=/, 'legacy hardcoded quote table'],
  [/var\s+fallbackSeries\s*=\s*\{/, 'hardcoded FRED time series'],
  [/_sectorRRGSeed\s*=/, 'static RRG seed'],
  [/var\s+staticEvents\s*=\s*\[/, 'static risk event list'],
  [/_SENT_COMMON\.labels20|labels20\s*:\s*\[/, 'static sentiment labels'],
  [/var\s+vixData\s*=\s*\[/, 'static VIX series'],
  [/\bcurrentTopic\s*:\s*['"]|\bspacexIpoStatus\s*:/, 'current narrative embedded in snapshot'],
  [/SCREENER_DB\s*=\s*\[[\s\S]*?\{\s*sym:[^\n]*,\s*signal:[^\n]*,\s*memo:/, 'volatile signal/memo embedded in static screener universe'],
  [/var\s+_tgMemoOverlay\s*=\s*\{/, 'static Telegram memo overlay'],
  [/FRED_FALLBACK|chart-runtime-fallback['"]\s*,\s*data\s*:/, 'synthetic chart data fallback'],
  [/S\.bokRate\s*\|\|\s*2\.75|DATA_SNAPSHOT\.bokRate[^\n]*:\s*2\.75/, 'BOK decision fallback'],
  [/window\._live2Y\s*\|\|\s*4\.28/, '2Y yield decision fallback'],
  [/mcap:'[^']*',\s*price:\d+/, 'KR static price/market-cap row'],
  [/\{code:'\d{6}',w:\d+/, 'KR static theme weight'],
  [/AIO_SCENARIO_REGISTRY\s*=\s*\{[\s\S]{0,2000}?probability\s*:/, 'embedded current scenario probability'],
  [/function\s+updateDynamicScenarios\b|var\s+probA\s*=\s*\d+/, 'embedded heuristic scenario probability calculator'],
  [/\b(?:weeklyEvents|monthlyHighlights|pinnedEvents20\d{2})\s*=|dayRange\s*:\s*['"](?:last-week|6-weeks|\d+-\d+)/, 'mechanically generated economic calendar'],
  [/_macroStoryNum\s*\(|(?:vix|tnx|dxy|wti|gold)\s*=\s*_macroStoryNum/, 'numeric macro-story fallback'],
  [/scheduleStatus\s*=\s*['"]estimated['"]|기존 주기를 기계적으로 연장한 추정일/, 'estimated calendar mutation'],
  [/<td><b>05\/16<\/b><\/td>|기존 05\/12~05\/16 정적 스냅샷/, 'embedded KR weekly supply snapshot'],
  [/주택가격지수[\s\S]{0,500}?107\.4|선행종합지수[\s\S]{0,500}?99\.4/, 'embedded current KR macro snapshot'],
  [/정적 스냅샷 즉시 폴백|스냅샷 폴백[^\n]{0,80}현재 판단/, 'decision-facing static snapshot fallback'],
  [/HOME_WEEKLY_NEWS\s*=\s*\[\s*\{/, 'embedded current news digest'],
  [/function\s+live\(sym,\s*key,\s*fallback\)|live\(['"][^'"]+['"],\s*['"](?:price|pct)['"],\s*\d/, 'numeric briefing market fallback'],
  [/_ldSafe\(['"][^'"]+['"],\s*['"](?:price|pct)['"]\)\s*\|\|\s*(?:_fb\w*\.[A-Za-z0-9_]+\s*\|\|\s*)?(?:20|50|80|100|104|145|1485|4\.3)/, 'numeric live-market observation fallback'],
  [/AIO_EVENT_FRESHNESS_REGISTRY\s*=\s*\{[\s\S]{0,2000}?(result|marketReaction)\s*:/, 'embedded current event narrative'],
  [/var\s+AIO_EVENT_RISK_CONTEXT\s*=\s*\{[\s\S]{0,2000}?(headlineYoY|releaseDate|tone\s*:)\s*:/, 'embedded current event-risk timeline'],
  [/AIO_GEOPOLITICAL_CONTEXT_REGISTRY\s*=\s*\{[\s\S]{0,2000}?currentPriceSignal\s*:/, 'embedded geopolitical current claim'],
  [/\b(inputPerMTok|outputPerMTok|exchangeRate|costPerQuery)\s*:/, 'embedded provider price or FX rate'],
  [/\bmodelPrice\s*=|var\s+pricing\s*=\s*\{[\s\S]{0,500}?input\s*:\s*\d/, 'embedded AI provider pricing table'],
  [/BASELINE_SURFACE\s*=\s*\{\s*home\s*:/, 'stale hardcoded page-surface baseline'],
  [/var\s+HISTORICAL_PRECEDENTS\s*=|lockoutRally\s*:\s*\{/, 'unused embedded historical precedent registry'],
  [/DATA_SNAPSHOT\.(?:spx|nasdaq|gold)\s*\/\s*(?:10|45)/, 'synthetic cross-symbol quote approximation'],
  [/<[^>]+\b(?:data-live-(?:price|chg|pct|field)|data-snap)="[^"]+"[^>]*>[\s+\-▲▼$₩%.,()]*\d[\d\s+\-▲▼$₩%.,()]*<\//, 'numeric DOM seed in runtime value slot'],
  // P721: data-live-kr-change 래퍼의 직접 텍스트에 숫자 리터럴 금지 — kr-home KOSPI "▲ 200.86"이
  // 위 패턴(속성명 불일치 + 중첩 태그)을 빠져나가 미수신 시 현재값처럼 노출된 회귀의 재발 방지.
  [/<[a-z]+[^>]*\bdata-live-kr-change="[^"$]*"[^>]*>[^<]*\d/, 'numeric literal in kr-change runtime slot']
];
prohibited.forEach(([pattern, label]) => {
  const match = runtime.match(pattern);
  const sample = match ? match[0].replace(/\s+/g, ' ').slice(0, 180) : '';
  assert(!match, `prohibited ${label}${sample ? `: ${sample}` : ''}`);
});

assert(/AIO_MANUAL_REFERENCE/.test(core), 'manual reference registry missing');
['source:', 'sourceUrl:', 'asOf:', 'operationalUse:'].forEach((token) => assert(core.includes(token), `manual reference provenance missing ${token}`));
assert(/data-operational-use['"],\s*['"]blocked['"]/.test(runtime) || /data-operational-use="blocked"/.test(runtime), 'blocked unavailable-state contract missing');

const macro = data.macro || {};
const us = segment('us');
const kr = segment('kr');
const categories = [
  ['market-quotes', historyHas('spx','nasdaq','dow') || data.meta?.quotesPublished === true, 'runtime/history artifact'],
  ['volatility', historyHas('vix'), 'history.json / live quote'],
  ['fear-greed', hasNumber(data.fearGreed?.score), 'server artifact'],
  ['put-call', hasNumber(data.putCall?.totalPutCall) && !!data.putCall?.asOf, 'Cboe delayed artifact'],
  ['aaii', /aaiiBear:null/.test(snapshot), 'explicit unavailable'],
  ['naaim', /naaimExposure:null/.test(snapshot), 'explicit unavailable'],
  ['investors-intelligence', /iiBull:null/.test(snapshot), 'explicit unavailable'],
  ['us-breadth', hasNumber(us.above20) && us.coveragePct >= 85, 'screener artifact'],
  ['kr-breadth', hasNumber(kr.above20) && kr.coveragePct >= 85, 'screener artifact'],
  ['breadth-history', /시계열 미수신/.test(ui + core), 'explicit unavailable'],
  ['treasury-curve', ['fedRate'].some((k) => hasNumber(macro[k])) && /getUsTreasuryCurveEvidence/.test(core), 'FRED/runtime evidence'],
  ['hy-oas', (hasNumber(macro.hyOAS) && /_serverHySpreadBp|_hySpreadBp/.test(dataCode)) || /hyOAS:null/.test(snapshot), 'FRED server artifact or explicit unavailable'],
  ['cpi-pce', hasNumber(macro.cpi) && hasNumber(macro.pce), 'FRED/BLS artifact'],
  ['employment-wages', hasNumber(macro.unemployment) && hasNumber(macro.usWageGrowth), 'FRED/BLS artifact'],
  ['retail-housing-ism', hasNumber(macro.retailSales) && hasNumber(macro.housingStarts) && /ism-mfg/.test(core), 'artifact + official calendar'],
  ['central-bank-policy', /fedPolicy:[\s\S]*?sourceUrl:/.test(core) && /bokPolicy:[\s\S]*?sourceUrl:/.test(core), 'official manual reference'],
  ['macro-calendar', /AIO_MACRO_CALENDAR/.test(core) && /2026-08-12/.test(core) && /2026-08-27/.test(core), 'official release calendar'],
  ['news', Array.isArray(data.news) && data.news.length > 0, 'server news artifact'],
  ['commodities-fx', historyHas('wti','gold','dxy'), 'history/live artifact'],
  ['global-indices', historyHas('spx','kospi','kosdaq'), 'history/live artifact'],
  ['crypto', historyHas('btc'), 'history/live artifact'],
  ['kr-macro-vkospi-supply', /bokPolicy:[\s\S]*?official/.test(core) && /VKOSPI 시계열 미수신/.test(core) && /수급.*판단을 보류/.test(index), 'official reference + explicit unavailable']
];

assert(categories.length === 22, `audit category count must be 22, got ${categories.length}`);
categories.forEach(([name, ok, source], i) => {
  assert(ok, `category ${name} has neither current evidence nor explicit unavailable contract`);
  console.log(`${String(i + 1).padStart(2, '0')}\t${ok ? 'PASS' : 'FAIL'}\t${name}\t${source}`);
});

if (failures.length) {
  console.error(`\nStatic-data contract FAIL (${failures.length})`);
  failures.forEach((message) => console.error(`- ${message}`));
  process.exit(1);
}
console.log('\nStatic-data contract PASS (22/22 categories; volatile values are runtime/official-reference/explicit-unavailable).');
