import { createResourceBag } from '../../app/lifecycle.js';
import { consumeResearchHandoff } from '../../app/research-handoff.js';
import { loadJsonArtifact, stableFetcher } from '../../data/artifact-cache.js';
import { renderScreenerValidation, readValidationState, renderValidationHero } from '../components/screener-validation.js';
import { buildPopulationRankingIdentity, liveScreenerModelFingerprint } from '../../domain/screener/model-fingerprint.js';
import { measuredCandidateEntries, summarizeCandidateArchive } from '../../domain/screener/candidate-record.js';
import { renderScreenLessons } from '../components/screen-lessons.js';
import { compileScreenDefinition } from '../../domain/screener/screen-engine.js';
import { PRESET_LESSONS, presetMarketLine } from '../../domain/screener/preset-lessons.js';
import { readMarketRegime } from '../components/market-regime.js';
import { setStockSubject } from '../navigation/route-hubs.js';
import { measureFactorOverlap, overlapSentence } from '../../domain/screener/factor-overlap.js';

// Row arrays from the store and the workbench are replaced, never edited in place, so one market's slice is cut once
// per array. Handing renderBacktest the same slice also lets the factor-overlap cache below hit (a fresh filter result
// every render re-measured the overlap on each keystroke).
const marketRowsCache = new WeakMap();
function scopedRows(rows, market) {
  if (!Array.isArray(rows)) return marketRows(rows, market);
  let byMarket = marketRowsCache.get(rows);
  if (!byMarket) marketRowsCache.set(rows, (byMarket = new Map()));
  if (!byMarket.has(market)) byMarket.set(market, marketRows(rows, market));
  return byMarket.get(market);
}
// P1468: factor overlap measured once per ranked row set (the Why drawer and the 검증 view share it).
// 2026-10-17 audit: z-scores are per market (P1625), so a `market` measures that market's rows against that market's
// active factors; the Why drawer used to pool US and KR rows under the US factor list.
const overlapCache = new WeakMap();
function currentOverlap(rows, ranking, market = null) {
  if (!Array.isArray(rows) || !rows.length) return null;
  if (!overlapCache.has(rows)) overlapCache.set(rows, new Map());
  const byMarket = overlapCache.get(rows);
  const key = market || '*';
  if (!byMarket.has(key)) byMarket.set(key, measureFactorOverlap(market ? marketRows(rows, market) : rows, ranking?.activeFactors || []));
  return byMarket.get(key);
}
import { renderScreenerRead, syncScreenerNextLead, reapplyScreenerNextLead } from '../components/screener-read.js';
import { selectScreenerState } from '../../state/selectors/screener.js';
import { subscribeToSlices } from '../../state/memoize.js';
import { createSavedScreen, exportSavedScreen, importSavedScreen } from '../../domain/screener/saved-screens.js';
import { createSuppliedMaterialBridge } from '../knowledge/supplied-material-bridge.js';
import { SCREENER_FIELD_REGISTRY, createScreenDefinition, fieldValueForPurpose } from '../../data/contracts/screener.js';
import { FACTOR_LABELS, capFilterValue, numberText, visibleRank, rankGrade, vcpStageLabel, describeStaleDates, profileComputability, factorSessionLag, describeRankingHold, followThroughSummary } from '../../domain/screener/row-presentation.js';
export { capFilterValue, visibleRank, rankGrade, vcpStageLabel, describeStaleDates, profileComputability, factorSessionLag, describeRankingHold };
import { CONDITIONAL_EVIDENCE_DISCLAIMER, CONDITIONAL_EVIDENCE_VERSION } from '../../domain/screener/conditional-evidence.js';
import { EVIDENCE_LINEAGE_VERSION } from '../../domain/screener/evidence-lineage.js';
import { withTopicParticle } from '../../domain/content/korean-particle.js';
import { MARKET_LABELS, screenerMarket, marketRows, marketRankingMetadata, formatScreenerPrice } from '../../domain/screener/market-scope.js';
import { EXTENSION_BANDS } from '../../domain/screener/setup-profile.js';
import { bufferedTrend, trendHeldWithMargin, modelContraryEvidence } from '../../domain/technical/bands.js';
import { RULES } from '../../domain/rules/thresholds.js';
import { sectorsForEtf } from '../../domain/entity/stock-read.js';
import { consensusView, PE_MEANINGFUL_MAX } from '../../domain/fundamental/consensus-read.js';
import { parseConditionValue, matchesConditions, conditionCoverage, availableConditionIds, conditionLabel } from '../../domain/screener/custom-conditions.js';
import { installCustomConditions } from '../components/screener-custom.js';
import { requestConsensusEstimates, consensusRowFor, CONSENSUS_KEY } from '../../data/consensus-estimates.js';
import { CHANNEL_SIGNAL_KEYS, channelSignalValue } from '../../domain/screener/channel-signals.js';
import { sectorLabel } from '../../domain/screener/screener-read.js';
import { themeStagesFor, scenarioStateCurrent } from '../../domain/scenarios/theme-stage.js';
import { refreshSharedArtifact, screenerRowsState, SCENARIO_STATE } from '../../data/shared-artifacts.js';
import { dataStateText } from '../../domain/content/data-state.js';
import { koreanThemeGroups } from '../../domain/market/korea-participation.js';
// v57.81: universe scope (기본/확장) and the ranking contract labels.
import { RANKING_CONTRACTS, readUniverseScope, rememberExtendedCount, writeUniverseScope } from '../../data/screener-extended.js';

// 2026-10-14 audit #18: index keys as the artifact writes them → the names a Korean reader uses.
const INDEX_LABELS = Object.freeze({ SP500: 'S&P 500', SP400: 'S&P 400', NASDAQ100: '나스닥100', NASDAQ: '나스닥', RUSSELL2000: '러셀2000' });
// v57.54: exchange codes read as jargon in the 지수 filter — Korean name first, the code kept in brackets, a short
// explanation on hover.
const INDEX_CODE_LABELS = Object.freeze({
  NYSE: ['뉴욕증권거래소(NYSE)', '미국 뉴욕증권거래소 상장 종목'],
  ADR: ['미국예탁증서(ADR)', '해외 기업 주식을 미국 시장에서 거래하도록 만든 예탁증서'],
  OTC: ['장외 거래(OTC)', '거래소 정규 상장이 아닌 장외 시장에서 거래되는 종목'],
  TSE: ['도쿄 상장(TSE)', '도쿄증권거래소 상장 — 미국에서는 예탁증서 등으로 거래'],
  TWSE: ['대만 상장(TWSE)', '대만증권거래소 상장 — 미국에서는 예탁증서 등으로 거래']
});

// 2026-10-14 audit #5: each ranked row carries its themes' stages (same rows as 테마 시나리오) so the reading can count
// the top fifth by stage. Nothing is attached when the per-refresh scenario state is not current.
function withThemeStages(root, rows) {
  if (!scenarioStateCurrent(root?._aioScenarioState)) return rows; // v57.81: the producer's 'current' (theme-stage.js)
  const membership = themeMembership(root, rows); // v58.75: shared with the 테마 단계 column
  return rows.map((row) => {
    const ids = membership.get(String(row?.sym || '').toUpperCase());
    return ids && Number.isFinite(row?.screenRank) ? { ...row, themeStages: themeStagesFor(root, { symbol: row.sym, themeIds: [...ids] }) } : row;
  });
}
import { renderKnowledgeArrival } from '../components/knowledge-arrival.js';
import { renderNextSteps } from '../components/page-flow.js';
import { signedText, usdKoreanText } from '../../domain/shared/number.js';

const FIELD_BY_COLUMN = new Map(SCREENER_FIELD_REGISTRY.fields.map(field => [field.rowKey, field.fieldId]));

const PROFILE_DESCRIPTIONS = {
  // v57.77: one line — where the weights and the validation live is the tabs' job, not this label's.
  balanced: '기본 균형 비중으로 합산',
  momentum: '단기 추세·모멘텀 중심',
  swing: '중기 기술적 매매',
  value: '저평가·장기 보유',
  lowrisk: '방어적·저변동성 우선'
};

const REGIME_DESCRIPTIONS = {
  '중립 · 균형 가중': '시장 신호가 혼재된 구간입니다. 사후 검증에 쓰는 기본(중립) 고정 가중치를 유지합니다.',
  '위험회피 · 저변동·퀄리티 가중': '시장 불안 구간의 방어 틸트 후보입니다. 검증·승인 전에는 실제 순위에 적용하지 않습니다.',
  '위험선호 · 모멘텀·추세·칼만 가중': '시장 위험선호 구간의 공격 틸트 후보입니다. 검증·승인 전에는 실제 순위에 적용하지 않습니다.'
};

// SCR-UX-00/02: the table header, cell renderer, sorting contract and visual
// presets all read this registry. Keeping the user label next to the row key
// prevents the old header/cell drift (for example, VCP under the wrong label).
export const SCREENER_COLUMN_REGISTRY = Object.freeze([
  // v58.56 (#12): the row keeps the ☆ only — 비교 is one button in the inspector/sheet, where the stock is being read.
  { key: 'watchlist', label: '관심', sortable: false, align: 'center', width: 48, group: 'utility' },
  // v58.56 (#3): the first column of the default view numbers the rows by market cap (1 = largest of the rows shown). The
  // default order is market cap (v57.55), so it reads 1, 2, 3…; 전체 순위 moved beside 백분위. Its header sorts by 시총.
  // v58.80 (first-users F21): the header read '#' beside 전체 순위 and 백분위 and was taken for a rank; it is the row order.
  { key: 'capOrder', label: '순서', headerLabel: '순서', sortAs: 'mcap', hint: '지금 정렬 기준에서의 순서 — 기본 정렬(시총 큰 순)에서는 시가총액 순서(1 = 가장 큼), 누르면 시총 순으로 정렬합니다', sortable: true, align: 'left', width: 44, group: 'identity' },
  // 개편 v2 (3c): the ordinal among ranked rows (the same number the inspector and the stock summary quote).
  { key: 'screenRank', label: '전체 순위', hint: '같은 시장에서 순위가 매겨진 종목 사이의 순서 — 조건 화면과 표시 필터는 이 순서를 바꾸지 않습니다', sortable: true, align: 'left', width: 72, group: 'ranking' },
  // P1464: the value is a percentile among rows that pass the criteria — "점수 100" read as a perfect
  // score, so the header names what it is.
  { key: 'rank', label: '백분위', sortable: true, align: 'center', width: 72, group: 'ranking' },
  // P1419: the column shows the percentile position the rank already is (상위 N%), not a letter grade.
  { key: 'grade', label: '상위', sortable: false, align: 'center', width: 56, group: 'ranking' },
  { key: 'sym', label: '종목', sortable: true, align: 'left', width: 142, group: 'identity', sticky: true },
  { key: 'sector', label: '섹터', sortable: true, align: 'left', width: 116, group: 'identity' },
  { key: 'momentum', label: '모멘텀', sortable: true, align: 'right', width: 74, group: 'factor' },
  { key: 'trend', label: '추세', sortable: true, align: 'right', width: 74, group: 'factor' },
  { key: 'lowvol', label: '저변동', sortable: true, align: 'right', width: 78, group: 'factor' },
  { key: 'value', label: '밸류', sortable: true, align: 'right', width: 70, group: 'factor' },
  { key: 'quality', label: '퀄리티', sortable: true, align: 'right', width: 78, group: 'factor' },
  // v58.75 (persona review): the raw filing figures behind 밸류·퀄리티 — a fundamental reader sorts by the number itself.
  { key: 'pe', label: 'PER', hint: '시가총액 ÷ 순이익(SEC 공시, 최근 4개 분기 합 또는 최근 회계연도) — 적자·비정상 값은 비움, 칸에 기간 표시', sortable: true, align: 'right', width: 70, group: 'fundamental' },
  { key: 'pb', label: 'PBR', hint: '시가총액 ÷ 자기자본(SEC 공시, 최근 회계연도) — 자본잠식·비정상 값은 비움', sortable: true, align: 'right', width: 66, group: 'fundamental' },
  { key: 'roe', label: 'ROE', hint: '순이익 ÷ 자기자본(SEC 공시, 최근 회계연도)', sortable: true, align: 'right', width: 66, group: 'fundamental' },
  { key: 'margin', label: '순이익률', hint: '순이익 ÷ 매출(SEC 공시, 최근 회계연도)', sortable: true, align: 'right', width: 78, group: 'fundamental' },
  { key: 'revGrowth', label: '매출 성장', hint: '최근 회계연도 매출의 전년 대비 증가율(SEC 공시)', sortable: true, align: 'right', width: 80, group: 'fundamental' },
  // v57.54: forward multiple on analyst consensus (reference only; the 밸류 factor stays on reported earnings).
  { key: 'fwdPe', label: 'Forward PER', hint: '종가 ÷ 아직 실적이 발표되지 않은 4개 분기 컨센서스 EPS 합(조정 EPS) — 점수에 쓰지 않는 참고값, 미국 종목만', sortable: true, align: 'right', width: 92, group: 'market' },
  { key: 'price', label: '가격', sortable: true, align: 'right', width: 86, group: 'market' },
  { key: 'pctFrom52wHigh', label: '52주 고점 대비', sortable: true, align: 'right', width: 96, group: 'market' },
  // 개편 v2 (3c): where the last close sits between the 52-week low and high (both distances come from the artifact).
  { key: 'range52', label: '52주 위치', hint: '52주 저점(왼쪽)과 고점(오른쪽) 사이에서 마지막 종가의 위치 — 같은 산출물의 저점·고점 대비 거리로 계산', sortable: true, align: 'left', width: 120, group: 'market' },
  // v58.75 (persona review): one week — the move a swing trader checks first (ret5d is already in the artifact).
  { key: 'ret5d', label: '1주', hint: '최근 5거래일 수익률, 완료된 종가 기준', sortable: true, align: 'right', width: 64, group: 'market' },
  { key: 'ret1m', label: '1개월', sortable: true, align: 'right', width: 70, group: 'market' },
  { key: 'ret3m', label: '3개월', sortable: true, align: 'right', width: 70, group: 'market' },
  { key: 'ret6m', label: '6M', sortable: true, align: 'right', width: 70, group: 'market' },
  // v58.75 (persona review): market-wide relative strength — the percentile of the plain return among every row of the same
  // market loaded now (before the display filters). One fact's percentile, not a score; 모멘텀 is ranked inside the sector.
  { key: 'rs6m', label: 'RS 백분위(6개월)', hint: '같은 시장에서 지금 불러온 종목 전체(표시 필터 적용 전, ETF·SPAC 등 순위 제외 종목 빼고) 중 6개월 수익률의 백분위 — 99는 상위 1%. 섹터 안에서 비교하는 모멘텀 점수와 달리 시장 전체와 비교한 한 가지 사실값이며 앞으로의 수익을 뜻하지 않습니다', sortable: true, align: 'right', width: 96, group: 'market' },
  { key: 'rs12m', label: 'RS 백분위(12개월)', hint: '같은 시장에서 지금 불러온 종목 전체(표시 필터 적용 전, ETF·SPAC 등 순위 제외 종목 빼고) 중 12개월 수익률의 백분위 — 99는 상위 1%. 섹터 안에서 비교하는 모멘텀 점수와 다른 시장 전체 기준이며 앞으로의 수익을 뜻하지 않습니다', sortable: true, align: 'right', width: 100, group: 'market' },
  { key: 'rsi', label: 'RSI', sortable: true, align: 'right', width: 64, group: 'market' },
  { key: 'pctSma50', label: 'vs 50MA', sortable: true, align: 'right', width: 82, group: 'market' },
  // v58.75 (persona review): volume, range and liquidity as plain facts — "which names traded heavily today" could not be sorted.
  { key: 'rvol20', label: '거래량 배수', hint: '마지막 거래일 거래량 ÷ 그 직전 20거래일 평균 거래량 — 1.0이 평소 수준, 1.4는 평소보다 40% 많음, 0.7은 30% 적음', sortable: true, align: 'right', width: 84, group: 'market' },
  { key: 'adrPct', label: '일평균 변동폭', hint: '최근 20거래일 하루 변동폭((고가 − 저가) ÷ 종가)의 평균 — 이 종목이 하루에 보통 얼마나 움직이는지', sortable: true, align: 'right', width: 92, group: 'market' },
  { key: 'dollarVolume30d', label: '거래대금(30일)', hint: '최근 30거래일 하루 거래대금(종가 × 거래량)의 평균 — 유동성, 한국 종목은 각 거래일 환율로 달러 환산(환산값이 없으면 원화)', sortable: true, align: 'right', width: 98, group: 'market' },
  // P1507: the same 50-day distance in units of the stock's own average daily range — how late an entry would be.
  { key: 'extension', label: '50일선 거리(변동폭 배수)', sortable: true, align: 'right', width: 118, group: 'setup' },
  { key: 'kalman', label: '추세 속도', hint: '칼만 필터로 잡음을 걸러 낸 최근 추세의 하루 속도(같은 섹터 안 정규화 점수) — 확신도가 아니며, 연구 지표·매매 신호 아님', sortable: true, align: 'right', width: 102, group: 'market', researchOnly: true },
  { key: 'vcpScore', label: '수축 구조(VCP)·충족도', hint: 'VCP(변동성 수축 패턴): 조정 폭이 차례로 줄며 바닥을 다지는 가격 구조 — 충족도는 그 조건을 얼마나 채웠는지', sortable: true, align: 'right', width: 96, group: 'setup', researchOnly: true },
  // v58.75 (persona review): where the last close sits against the pivot — the number a breakout watch list is sorted by.
  { key: 'pivotDist', label: '피벗 대비', hint: '마지막 확정 종가 ÷ 피벗(마지막 수축 구간의 고점) − 1 — 음수는 피벗 아래, 양수는 위. 피벗이 계산되지 않은 종목은 비움', sortable: true, align: 'right', width: 84, group: 'setup' },
  { key: 'mcap', label: '시총', sortable: true, align: 'right', width: 82, group: 'market' },
  { key: 'entry', label: '상대 상태', sortable: false, align: 'center', width: 118, group: 'setup', researchOnly: true },
  // v57.87: base number, pocket pivot, index down-day resilience, heavy down days and climax signs (technical/follow-through.js).
  { key: 'followThrough', label: '후속 확인', hint: '베이스 순번·포켓 피벗·지수 하락일 버팀·거래량 실린 하락·클라이맥스 징후 — 종가 기준 관찰, 매매 신호 아님', sortable: false, align: 'left', width: 176, group: 'setup', researchOnly: true },
  // v58.75 (persona review): the stage of the stock's themes, the same rows the 테마 시나리오 and the stock summary read.
  { key: 'themeStage', label: '테마 단계', hint: '이 종목이 속한 테마의 지금 단계 — 테마 시나리오·종목 요약과 같은 값. 테마 상태 자료가 최신일 때만 표시', sortable: false, align: 'left', width: 150, group: 'evidence' },
  { key: 'news', label: '최신뉴스·근거', sortable: false, align: 'left', width: 190, group: 'evidence' }
]);

// P1429: 가격 comes only from the visible-row live quote (P715: the artifact publishes no per-symbol
// price), and on 2026-10-04 the live site showed 미수신 on 10 of 12 rows while the Worker deploy was
// blocked. 52주 고점 대비 comes from the artifact itself, so the default presets always carry a
// price-position reading even when the quote is missing.
// v57.54: the '상위 N%' column repeated the percentile beside it as emphasis ("100 · 상위 1%") while the post-check
// above says the ranking does not yet distinguish later returns. The presets show the percentile once; 'grade'
// stays in the registry for the 전체/직접 고른 컬럼.
const COLUMN_PRESETS = Object.freeze({
  // 개편 v2 (3c): the first screen — order, name, close, 1·3-month returns, 52-week position, percentile; 관심·비교 last.
  // v58.56 (#3): 시총 순서 first (the default order), 전체 순위 beside 백분위.
  overview: ['capOrder', 'sym', 'price', 'ret1m', 'ret3m', 'range52', 'screenRank', 'rank', 'watchlist'],
  // v58.75 (persona review): the chart-trader views lead with pivot distance, the volume multiple, a one-week move and
  // market-wide RS (RSI, 1-month and the research-only 추세 속도 move to 전체/직접 고른 컬럼); the fundamental view shows the
  // filing figures themselves; 위험 adds the daily range and liquidity; 이벤트 adds the theme stage.
  discovery: ['watchlist', 'rank', 'sym', 'price', 'pivotDist', 'rvol20', 'pctFrom52wHigh', 'ret5d', 'ret3m', 'rs6m', 'extension', 'vcpScore', 'followThrough'],
  fundamentals: ['watchlist', 'rank', 'sym', 'value', 'quality', 'pe', 'pb', 'roe', 'margin', 'revGrowth', 'fwdPe', 'price', 'pctFrom52wHigh', 'news'],
  trend: ['watchlist', 'rank', 'sym', 'momentum', 'trend', 'rs6m', 'rs12m', 'ret1m', 'ret3m', 'pctSma50', 'extension', 'rvol20', 'dollarVolume30d', 'followThrough', 'entry'],
  risk: ['watchlist', 'rank', 'sym', 'lowvol', 'adrPct', 'dollarVolume30d', 'rsi', 'pctSma50', 'mcap', 'entry', 'news'],
  events: ['watchlist', 'rank', 'sym', 'entry', 'themeStage', 'vcpScore', 'followThrough', 'news'],
  all: SCREENER_COLUMN_REGISTRY.map((column) => column.key)
});

const PRESET_SHORT_LABELS = Object.freeze({ 'preset-balanced': '균형', 'preset-momentum': '모멘텀', 'preset-trend': '추세', 'preset-lowvol': '저변동', 'preset-quality': '퀄리티', 'preset-pivot-quiet': '피벗', 'preset-breakout-volume': '돌파' });

const FILTER_LABELS = Object.freeze({
  'scr-market': '지수',
  'scr-sector': '섹터',
  'scr-cap': '시총',
  'scr-text-search': '검색',
  'scr-setup': '차트 패턴',
  'scr-min-rank': '최소 백분위',
  'scr-rsi-min': 'RSI 하한',
  'scr-rsi-max': 'RSI 상한',
  'scr-min-mom': '3개월 수익률 하한',
  'scr-watchlist-only': '워치리스트',
  'scr-passed-only': '실행 통과만'
});

const BUILDER_FIELDS = Object.freeze([
  { value: 'sector', label: '섹터', target: 'scr-sector' },
  { value: 'setup', label: '차트 패턴', target: 'scr-setup' },
  { value: 'rank', label: '최소 백분위', target: 'scr-min-rank' },
  { value: 'rsi', label: 'RSI 하한', target: 'scr-rsi-min' },
  { value: 'momentum', label: '3개월 수익률 하한', target: 'scr-min-mom' },
  { value: 'query', label: '티커·이름 검색', target: 'scr-text-search' }
]);

// LC-64: 빌더 필드 중 실행 정의(filtersAST/definitionHash)에 실제로 들어가는 필드다.
// 섹터·분류·구조·검색은 표 표시 범위만 바꾸므로 실행 정의에 넣지 않는다 — 이전에는 이런
// 값도 빌더 조건 칩으로 올라와 실행 조건처럼 읽히다가 buildVisualDefinition에서 조용히
// 버려져, 칩이 있는데 preview hash·통과 집합이 그대로인 상태가 됐다. 이제 실행 조건과
// 표시 필터는 칩 위치·라벨·삭제 동작이 다르고, 표시 전용 값은 상태 줄이 그 사실을 말한다.
const RUN_CONDITION_FIELDS = Object.freeze(['rank', 'rsi', 'momentum']);

function finite(value) { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
function text(documentRef, value) {
  const node = documentRef.createElement('span');
  node.textContent = value == null || value === '' ? '—' : String(value);
  return node;
}
function cell(documentRef, value, className = '') {
  const node = documentRef.createElement('td');
  if (className) node.className = className;
  if (value && value.nodeType) node.appendChild(value);
  else node.appendChild(text(documentRef, value));
  return node;
}
function returnText(value) { return finite(value) == null ? '—' : `${signedText(value, 1)}%`; }
function returnColor(value) { return finite(value) == null ? 'var(--text-muted)' : value >= 0 ? 'var(--dir-up)' : 'var(--dir-down)'; }
// v57.81: momentum and trend scores are z-scores inside the sector, so a sector-wide selloff leaves its best names high.
// Green needs the absolute check too (bands.js bufferedTrend 'up'); otherwise a high score is shown in the neutral colour.
const SECTOR_RELATIVE_PRICE_FACTORS = new Set(['momentum', 'trend']);
export function factorScoreColor(key, value, row, neutral = 'var(--text-primary)') {
  const score = finite(value);
  if (score == null) return 'var(--text-muted)';
  if (score >= 66) return !SECTOR_RELATIVE_PRICE_FACTORS.has(key) || bufferedTrend(row)?.id === 'up' ? 'var(--data-green)' : neutral;
  return score >= 40 ? 'var(--data-amber)' : 'var(--data-red)';
}
export function entryTiming(row) {
  const rank = finite(row.rank);
  const rsi = finite(row.rsi);
  const momentum = finite(row.ret1m) ?? (finite(row.ret3m) == null ? null : row.ret3m / 3);
  const setup = row.setupProfile || {};
  if (rank == null) return ['—', 'entry-wait'];
  if (setup.climaxRisk === 'watch') return [setup.label || '과열 정점 주의', 'entry-wait'];
  if (rank < 30) return ['하위권', 'entry-avoid'];
  // v57.50 C16: the same RSI table as the stock summary (70/30; 80 = the climax watch above). The old 78/22 edges
  // were labelled 과열/침체 while the summary called 70 과열 — one stock read differently on two screens.
  if (rsi != null && rsi >= RULES.technical.rsi.overbought) return [`RSI 과열권(${RULES.technical.rsi.overbought} 이상)`, 'entry-wait'];
  if (rsi != null && rsi <= RULES.technical.rsi.oversold) return [`RSI 과매도권(${RULES.technical.rsi.oversold} 이하)`, 'entry-wait'];
  if (setup.relativeStrengthPullback === 'candidate') return ['상대강도 눌림', 'entry-watch'];
  if (setup.support200 === 'near') return ['200일선 부근', 'entry-watch'];
  // v57.55 review (E1-12): '추세 양호' beside a price 6% under its 50-day line — the label now needs the price above that line.
  // v57.81: and above it by one daily range (ADR), above the 200-day line, with no five-session break (technical/bands.js,
  // the stock page's own trend states). A missing value fails: PYPL at +0.01% and MRVL after -13.8% in five sessions
  // fall back to 중상위권.
  if (rank >= 65 && trendHeldWithMargin(row) && rsi != null && rsi >= 38 && rsi <= 68 && momentum != null && momentum > 0) return ['상위권·추세 양호', 'entry-ready'];
  if (rank >= 48 && (rsi == null || (rsi >= 30 && rsi <= 74))) return ['중상위권', 'entry-watch'];
  return ['중립권', 'entry-wait'];
}

export function liveRow(row, readLiveData) {
  const live = readLiveData?.()?.[row.sym] || {};
  const rowCurrency = String(row.instrumentRef?.currency || row.currency || '').trim().toUpperCase() || null;
  const liveCurrency = String(live.currency || '').trim().toUpperCase() || null;
  const marketCapCurrency = String(live.marketCapCurrency || liveCurrency || '').trim().toUpperCase() || null;
  // `_liveData[sym]` is keyed by symbol, so a live entry that does not declare a
  // currency is still this instrument's own quote. Only an explicitly
  // conflicting currency keeps the price out of the row (P1074).
  const currencyConflict = !!liveCurrency && !!rowCurrency && liveCurrency !== rowCurrency;
  const livePrice = rowCurrency && !currencyConflict ? finite(live.price) : null;
  const liveMcap = marketCapCurrency === 'USD' && finite(live.marketCap) != null ? Math.round(live.marketCap / 1e9) : null;
  // A live quote is quoted evidence in its own right, so it carries the basis the
  // price cell renders in its title. Without this the overlay would show a value
  // whose observation time and source read as unknown (P1074).
  const liveBasis = livePrice != null
    ? { priceObservedAt: live.observedAt || live.ts || null, priceSource: live.source || null, priceRevision: live.revision || null }
    : null;
  // v57.54 review: without a live quote the price column read "—" on every row and price sorting dropped those rows.
  // The completed close the valuation already uses (valuationPrice, already in the public artifact) fills it, dated.
  const closePrice = livePrice == null ? finite(row._valuationPePrice ?? row._valuationPbPrice ?? row.valuationPrice) : null;
  const closeBasis = closePrice != null && closePrice > 0 ? { price: closePrice, priceCloseDate: row.factorSessionDate || null } : null;

  if (row.fieldReadiness) {
    const display = { ...row };
    for (const definition of SCREENER_FIELD_REGISTRY.fields) {
      if (!definition.fieldId.startsWith('identity.')) display[definition.rowKey] = fieldValueForPurpose(row, definition.fieldId, 'display');
    }
    // The field-readiness contract gates what a row may display; it does not own
    // the live quote projection. Without this overlay the price column has no
    // owner at all between the narrowed legacy updater (mcap only) and native
    // state, so every row would read 미수신 forever (P1074).
    if (display.price == null && livePrice != null) Object.assign(display, { price: livePrice }, liveBasis);
    else if (display.price == null && closeBasis) Object.assign(display, closeBasis);
    if (display.mcap == null && liveMcap != null) display.mcap = liveMcap;
    return display;
  }
  return {
    ...row,
    price: livePrice ?? row.price ?? closeBasis?.price ?? null,
    mcap: liveMcap ?? row.mcap,
    ...(livePrice != null && row.price == null ? liveBasis : {}),
    ...(livePrice == null && row.price == null && closeBasis ? { priceCloseDate: closeBasis.priceCloseDate } : {})
  };
}

function selectedValue(documentRef, id) { return documentRef.getElementById(id)?.value || ''; }

// v57.50 I10: a theme word typed in the search (방산, 우주/위성, defense) finds that theme's curated constituents.
// The manual keyword aliases stay; theme members are added to them (union), never substituted.
export function mergeThemeAliases(aliases = {}, themes = []) {
  const merged = {};
  for (const [key, list] of Object.entries(aliases || {})) if (Array.isArray(list)) merged[key] = [...list];
  const add = (word, symbols) => {
    const keys = new Set([String(word || '').trim().toLowerCase()].flatMap((value) => [value, value.replace(/\s+/g, '')]).filter((value) => value.length >= 2));
    for (const key of keys) merged[key] = [...new Set([...(merged[key] || []), ...symbols])];
  };
  for (const theme of Array.isArray(themes) ? themes : []) {
    const subs = Array.isArray(theme?.subThemes) ? theme.subThemes : [];
    const members = [...new Set([...(theme?.leaders || []), ...subs.flatMap((sub) => sub?.tickers || [])].map((symbol) => String(symbol || '').toUpperCase()).filter(Boolean))];
    if (!members.length) continue;
    const name = String(theme?.nameKr || '');
    [theme?.id, name, ...name.split('/')].forEach((word) => add(word, members));
    for (const sub of subs) {
      const tickers = (sub?.tickers || []).map((symbol) => String(symbol || '').toUpperCase()).filter(Boolean);
      if (tickers.length) [sub?.name, ...String(sub?.name || '').split('/')].forEach((word) => add(word, tickers));
    }
  }
  return merged;
}

export function filterRows(rows, documentRef, { readWatchlist, readAliases } = {}) {
  const listingMarket = selectedValue(documentRef, 'scr-listing-market') || 'US';
  const market = selectedValue(documentRef, 'scr-market');
  const sector = selectedValue(documentRef, 'scr-sector');
  const cap = selectedValue(documentRef, 'scr-cap');
  const query = selectedValue(documentRef, 'scr-text-search').trim().toLowerCase();
  // Screen audit 2026-10-20: 'MS' matched Morgan Stanley's symbol exactly and showed only that row — hidden by the other
  // filters, so the table said nothing was found while MSFT sat in it; 'NV' matched MSFT·MU·AMD through letters inside
  // their names. A short Latin query is a ticker prefix (or the start of a word in the name), not a substring.
  const tickerQuery = /^[a-z][a-z.\-]{0,4}$/.test(query);
  const minRank = Number.parseInt(selectedValue(documentRef, 'scr-min-rank'), 10) || 0;
  const rsiMin = Number.parseFloat(selectedValue(documentRef, 'scr-rsi-min'));
  const rsiMax = Number.parseFloat(selectedValue(documentRef, 'scr-rsi-max'));
  const minMomentum = Number.parseFloat(selectedValue(documentRef, 'scr-min-mom'));
  const setupFilter = selectedValue(documentRef, 'scr-setup');
  const custom = parseConditionValue(selectedValue(documentRef, 'scr-custom-conditions'));
  const watchlistOnly = !!documentRef.getElementById('scr-watchlist-only')?.checked;
  // Codex browser audit H44: after a run the table mixed rejected rows into "the result". 실행 통과만 keeps
  // the table on the run's passed set; it is switched on when a run completes and can be turned off.
  const passedOnly = !!documentRef.getElementById('scr-passed-only')?.checked;
  const watchlist = watchlistOnly ? new Set(readWatchlist?.() || []) : null;
  const aliases = readAliases?.() || {};
  const words = query ? query.split(/[\s,;·+&]+/).filter(Boolean) : [];
  const matchedSymbols = new Set();
  // 2026-10-13 review S03: structure-class aliases (매수 -> BUY) are retired with the column; only symbol-list
  // aliases remain, and any other word is matched as text.
  words.forEach((word) => {
    const alias = aliases[word];
    if (Array.isArray(alias)) alias.forEach((symbol) => matchedSymbols.add(symbol));
  });

  return rows.filter((row) => {
    if (screenerMarket(row) !== listingMarket) return false;
    // v57.81: in the 확장 view a stock can belong to several lists (S&P 500 and Nasdaq, Russell 2000 and Nasdaq).
    if (market && row.index !== market && !(Array.isArray(row.membership) && row.membership.includes(market))) return false;
    if (sector && row.sector !== sector) return false;
    // P1318/R664: a size bucket is a reference filter — use the decision-grade live value when it
    // exists, otherwise the plausibility-checked SEC reference value; unknown size stays excluded.
    const capValue = capFilterValue(row);
    if (cap && capValue == null) return false;
    if (cap === 'MEGA' && !(capValue >= 1000)) return false;
    if (cap === 'LARGE' && !(capValue >= 10 && capValue < 1000)) return false;
    if (cap === 'MID' && !(capValue >= 2 && capValue < 10)) return false;
    if (cap === 'SMALL' && !(capValue < 2)) return false;
    if (minRank > 0 && !(row.screenStatus === 'passed' && finite(row.rank) != null && row.rank >= minRank)) return false;
    const rsi = row.fieldReadiness ? fieldValueForPurpose(row, 'price.rsi14', 'calculation') : finite(row.rsi);
    const momentum = row.fieldReadiness ? fieldValueForPurpose(row, 'price.ret3m', 'calculation') : finite(row.ret3m);
    if (Number.isFinite(rsiMin) && !(rsi != null && rsi >= rsiMin)) return false;
    if (Number.isFinite(rsiMax) && !(rsi != null && rsi <= rsiMax)) return false;
    if (Number.isFinite(minMomentum) && !(momentum != null && momentum >= minMomentum)) return false;
    if (setupFilter === 'WINNER' && row.setupProfile?.winnerFilter !== 'candidate') return false;
    if (setupFilter === 'RSPULLBACK' && row.setupProfile?.relativeStrengthPullback !== 'candidate') return false;
    if (setupFilter === 'SUPPORT200' && row.setupProfile?.support200 !== 'near') return false;
    if (setupFilter === 'CLIMAX' && row.setupProfile?.climaxRisk !== 'watch') return false;
    if (watchlist && !watchlist.has(row.sym)) return false;
    if (passedOnly && row.screenStatus !== 'passed') return false;
    if (custom.length && !matchesConditions(row, custom, customRead)) return false;
    if (!query) return true;
    // v57.84 review: 'ai' is both C3.ai's ticker and a theme alias of 21 names — an exact ticker joins the alias group
    // instead of hiding it (low, now, all, key, it, bio … collide the same way).
    if (tickerQuery) {
      const sym = String(row.sym || '').toLowerCase();
      const wordStart = (text) => String(text || '').toLowerCase().split(/[^a-z0-9]+/).some((word) => word.startsWith(query));
      return sym.startsWith(query) || wordStart(row.name) || wordStart(row.sector) || matchedSymbols.has(row.sym); // 'tech' still finds Technology
    }
    const setupText = Array.isArray(row.setupProfile?.tags) ? row.setupProfile.tags.join(' ') : '';
    // 2026-10-13 news audit N03: the headline memo is not searchable — a word in another company's headline (or in
    // this company's) is not a property of the stock, and it made searches return unrelated rows.
    // v57.55 review (S1-F11): '엔비디아' found nothing — the registered Korean name joins the searchable text (a list
    // filter the reader scans, not an automatic pick).
    const koName = globalThis.AIO_TICKER_NAME_REGISTRY?.entries?.[row.sym]?.kr || globalThis.KR_STOCK_DB?.[String(row.sym || '').replace(/\.K[SQ]$/, '')]?.name || '';
    const haystack = `${row.sym} ${row.name} ${koName} ${row.memo || ''} ${row.sector || ''} ${setupText}`.toLowerCase();
    const direct = haystack.includes(query);
    const residualWords = words.filter((word) => !Array.isArray(aliases[word]));
    const allWords = residualWords.length > 0 && residualWords.every((word) => haystack.includes(word));
    return direct || allWords || matchedSymbols.has(row.sym);
  });
}


// The rank filter used to label thresholds with a different grade scale than the
// grade column (60 → "B" while the column renders C). Derive the labels from
// rankGrade so the page cannot offer two definitions of the same grade (P1078).
export function syncRankFilterLabels(documentRef) {
  const select = documentRef?.getElementById?.('scr-min-rank');
  if (!select || !select.options) return false;
  Array.prototype.slice.call(select.options).forEach((option) => {
    const threshold = Number(option.value || 0);
    if (!Number.isFinite(threshold) || threshold <= 0) return;
    const position = rankGrade(threshold);
    if (position) option.textContent = `${threshold} 이상 (${position})`;
  });
  return true;
}

// P1507: 50-day distance ÷ average daily range (ADR stands in for ATR). Null when either input is missing.
export function extensionMultiple(row) {
  const pct = finite(row?.pctSma50);
  const adr = finite(row?.adrPct);
  return pct != null && adr != null && adr > 0 ? pct / adr : null;
}

// v58.75 (persona review): the last completed close on the VCP pivot's own series. dollarVolume ÷ lastVolume is that raw
// close (both come from the same bar in price-factors); a non-USD listing falls back to the valuation close in its own
// currency. Only the percentage is shown — no price is republished (P715).
function lastCloseOf(row) {
  const currency = String(row?.instrumentRef?.currency || row?.currency || '').trim().toUpperCase();
  const dollarVolume = finite(row?.dollarVolume);
  const lastVolume = finite(row?.lastVolume);
  if (currency === 'USD' && !row?.dollarVolumeFx && dollarVolume > 0 && lastVolume > 0) return dollarVolume / lastVolume;
  const valuation = finite(row?._valuationPePrice ?? row?._valuationPbPrice ?? row?._valuationPrice ?? row?.valuationPrice);
  return valuation > 0 ? valuation : null;
}
export function pivotDistancePct(row) {
  const pivot = finite(row?.vcpPivot);
  const close = lastCloseOf(row);
  return pivot > 0 && close > 0 ? (close / pivot - 1) * 100 : null;
}

// v58.75 (persona review): market-wide return percentiles over every row of the same market handed to render (before the
// display filters). Rows the ranking excludes (funds, SPACs, thin or foreign listings) are left out; a stale return
// (not CALCULABLE) is not compared with current ones. Fewer than 20 comparable rows → no percentile.
const RS_RETURN_FIELDS = Object.freeze({ rs6m: ['ret6m', 'price.ret6m'], rs12m: ['ret12m', 'price.ret12m'] });
const rsPercentileCache = new WeakMap();
let currentRsPercentiles = new Map();
export function marketReturnPercentiles(rows) {
  if (!Array.isArray(rows)) return new Map();
  if (rsPercentileCache.has(rows)) return rsPercentileCache.get(rows);
  const out = new Map();
  for (const [key, [rowKey, fieldId]] of Object.entries(RS_RETURN_FIELDS)) {
    const byMarket = new Map();
    for (const row of rows) {
      const symbol = row?.sym || row?.symbol;
      if (!symbol || row?.populationExclusion) continue;
      const value = row.fieldReadiness ? fieldValueForPurpose(row, fieldId, 'calculation') : finite(row[rowKey]);
      if (finite(value) == null) continue;
      const market = screenerMarket(row);
      if (!byMarket.has(market)) byMarket.set(market, []);
      byMarket.get(market).push({ symbol, value });
    }
    for (const list of byMarket.values()) {
      if (list.length < 20) continue;
      list.sort((a, b) => a.value - b.value);
      let start = 0;
      while (start < list.length) {
        let end = start;
        while (end + 1 < list.length && list[end + 1].value === list[start].value) end += 1;
        // Equal returns share the midpoint of their positions; 0 = lowest, 100 = highest.
        const pct = Math.round(((start + end) / 2) / (list.length - 1) * 100);
        for (let i = start; i <= end; i++) {
          const entry = out.get(list[i].symbol) || {};
          entry[key] = pct;
          entry[`${key}Count`] = list.length;
          out.set(list[i].symbol, entry);
        }
        start = end + 1;
      }
    }
  }
  rsPercentileCache.set(rows, out);
  return out;
}

// v58.75 (persona review): theme membership as withThemeStages builds it, cached per rows array and scenario state, so the
// 테마 단계 column shows the same stages as the reading and the stock summary.
let themeMembershipCache = { rows: null, scenario: null, map: null };
function themeMembership(root, rows) {
  const scenario = root?._aioScenarioState || null;
  if (themeMembershipCache.rows === rows && themeMembershipCache.scenario === scenario && themeMembershipCache.map) return themeMembershipCache.map;
  const membership = new Map();
  const add = (sym, id) => { if (!sym || !id) return; const key = String(sym).toUpperCase(); if (!membership.has(key)) membership.set(key, new Set()); membership.get(key).add(id); };
  for (const theme of Array.isArray(root?.THEME_MAP) ? root.THEME_MAP : []) {
    for (const sym of theme.leaders || []) add(sym, theme.id);
    for (const sub of theme.subThemes || []) for (const sym of sub.tickers || []) add(sym, theme.id);
  }
  for (const group of koreanThemeGroups(root?.KR_THEME_MAP || {}, Array.isArray(rows) ? rows : [])) for (const sub of group.subThemes) for (const sym of sub.tickers) add(sym, group.id);
  themeMembershipCache = { rows, scenario, map: membership };
  return membership;
}
let themeStageRoot = null;
let themeStageRows = null;
function rowThemeStages(row) {
  if (!themeStageRoot || !scenarioStateCurrent(themeStageRoot._aioScenarioState)) return null;
  const ids = themeMembership(themeStageRoot, themeStageRows).get(String(row?.sym || row?.symbol || '').toUpperCase());
  return ids ? themeStagesFor(themeStageRoot, { symbol: row.sym || row.symbol, themeIds: [...ids] }) : [];
}

// v58.75 (teach-and-check D5): one folded block under the screen buttons — why this screen's condition is used, where it
// tends to work and not, its common failure, the columns that show it (their header hints carry the formulas), and one
// line on today's shared market state. The open/closed state survives re-renders.
function renderPresetLesson(documentRef, root, presetsHost, screenId, screenName) {
  const lesson = PRESET_LESSONS[screenId];
  let block = documentRef.getElementById('scr-preset-lesson');
  if (!lesson) { if (block) block.hidden = true; return; }
  if (!block) {
    block = documentRef.createElement('details');
    block.id = 'scr-preset-lesson';
    block.className = 'sx-disclosure scr-preset-lesson';
    presetsHost.insertAdjacentElement('afterend', block);
  }
  block.hidden = false;
  const open = block.open;
  const name = screenName || '이 조건';
  const summary = documentRef.createElement('summary');
  summary.textContent = `${name}: 이 조건을 왜 보나 — ${lesson.principle}`;
  const columnLabels = lesson.columns.map((key) => SCREENER_COLUMN_REGISTRY.find((column) => column.key === key)?.label).filter(Boolean);
  const rows = [
    ['잘 통하는 환경', lesson.works],
    ['잘 안 통하는 환경', lesson.fails],
    ['흔한 실패', lesson.failure],
    ['표에서 볼 컬럼', `${columnLabels.join(' · ')} — 머리글을 누르거나 마우스를 올리면 계산 기준이 나옵니다(컬럼 선택에서 켤 수 있습니다).`],
    ['지금 시장', presetMarketLine(lesson, readMarketRegime(root))]
  ];
  const list = documentRef.createElement('dl');
  list.className = 'regime-evidence';
  rows.forEach(([label, value]) => { const dt = documentRef.createElement('dt'); dt.textContent = label; const dd = documentRef.createElement('dd'); dd.textContent = value; list.append(dt, dd); });
  const note = documentRef.createElement('p');
  note.className = 'theme-strength-basis';
  note.textContent = '조건을 고르는 기준과 원리를 적은 것이며, 이 조건으로 고른 종목이 오른다는 뜻이 아닙니다.';
  block.replaceChildren(summary, list, note);
  block.open = open;
}

// v58.75 (teach-and-check D7): the chosen screen's own conditions against one row — each range/enum condition with the
// row's value, and the ones whose value sits within a field-sized margin of the threshold ('아슬아슬'), so the Why panel
// says not only that a stock passed but how close it was to dropping out (or getting in).
const NEAR_MARGIN_BY_UNIT = Object.freeze({ percent: 2, score: 5, ratio: 0.15, multiple: 1, USD: 0, USD_bn: 1 });
export function conditionMargins(definition, row) {
  const out = [];
  const walk = (node, negated = false) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'and' || node.type === 'or') { (node.children || []).forEach((child) => walk(child, negated)); return; }
    if (node.type === 'not') { walk(node.child, !negated); return; }
    // The market/listing scope is the table's own selection, not a screening condition worth a margin.
    if ((node.type !== 'range' && node.type !== 'enum') || String(node.field || '').startsWith('identity.')) return;
    const field = SCREENER_FIELD_REGISTRY.get(node.field);
    const label = node.field === 'rank' ? '팩터 백분위' : field?.label || node.field;
    const raw = node.field === 'rank' ? finite(row?.rank) : field ? (row?.fieldReadiness ? fieldValueForPurpose(row, node.field, 'calculation') : row?.[field.rowKey]) : null;
    if (node.type === 'enum') {
      const value = raw == null ? null : String(raw);
      const shown = node.field === 'technical.vcpStage' ? (value ? vcpStageLabel(value) : null) : value;
      const wanted = node.values.map((item) => (node.field === 'technical.vcpStage' ? vcpStageLabel(item) : item)).join('·');
      out.push({ label, rule: `${wanted}${negated ? ' 아님' : ''}`, value: shown, pass: value == null ? null : node.values.map(String).includes(value) !== negated, near: false, distance: null });
      return;
    }
    const value = finite(raw);
    const unit = node.field === 'rank' ? 'score' : field?.unit;
    const margin = NEAR_MARGIN_BY_UNIT[unit] ?? 0;
    const bounds = [node.min != null ? ['min', node.min] : null, node.max != null ? ['max', node.max] : null].filter(Boolean);
    const rule = bounds.map(([side, bound]) => `${bound}${side === 'min' ? ' 이상' : ' 이하'}`).join(', ');
    const pass = value == null ? null : bounds.every(([side, bound]) => (side === 'min' ? value >= bound : value <= bound)) !== negated;
    const distance = value == null || !bounds.length ? null : Math.min(...bounds.map(([, bound]) => Math.abs(value - bound)));
    out.push({ label, rule: `${rule}${negated ? ' 아님' : ''}`, value, unit, pass, near: distance != null && margin > 0 && distance <= margin, distance });
  };
  walk(definition?.filtersAST);
  return out;
}
function conditionMarginText(items) {
  if (!items.length) return '이 화면은 별도 조건 없이 순위만 매깁니다.';
  const show = (item) => (item.value == null ? '값 없음' : typeof item.value === 'number' ? (item.unit === 'percent' ? returnText(item.value) : numberText(item.value, item.unit === 'ratio' ? 2 : 1)) : item.value);
  const line = (item) => `${item.label} ${item.rule}(현재 ${show(item)}${item.distance != null ? `, 경계까지 ${numberText(item.distance, item.unit === 'ratio' ? 2 : 1)}` : ''})`;
  const passed = items.filter((item) => item.pass === true);
  const failed = items.filter((item) => item.pass === false);
  const unknown = items.filter((item) => item.pass == null);
  const near = items.filter((item) => item.near);
  return [
    passed.length ? `통과한 조건: ${passed.map(line).join(', ')}.` : null,
    failed.length ? `못 넘은 조건: ${failed.map(line).join(', ')}.` : null,
    unknown.length ? `값이 없어 판정 못 한 조건: ${unknown.map((item) => item.label).join(', ')}.` : null,
    near.length ? `경계에 가까운 조건(아슬아슬): ${near.map((item) => `${item.label}(경계까지 ${numberText(item.distance, item.unit === 'ratio' ? 2 : 1)})`).join(', ')} — 다음 갱신에서 결과가 바뀔 수 있습니다.` : '경계에 아슬아슬하게 걸친 조건은 없습니다.'
  ].filter(Boolean).join(' ');
}

// 개편 v2 (3c): 0 = at the 52-week low, 1 = at the high. pctFrom52wHigh ≤ 0 and pctFrom52wLow ≥ 0 are distances from the
// last close, so low/close = 1/(1+L) and high/close = 1/(1+H); no price is needed. Missing or inconsistent → null.
export function range52Position(row) {
  const high = finite(row?.pctFrom52wHigh);
  const low = finite(row?.pctFrom52wLow);
  if (high == null || low == null || high > 0.05 || low < -0.05 || high <= -100 || low <= -100) return null;
  const highRatio = 1 / (1 + high / 100);
  const lowRatio = 1 / (1 + low / 100);
  const span = highRatio - lowRatio;
  return span > 0 ? Math.max(0, Math.min(1, (1 - lowRatio) / span)) : null;
}

let consensusRoot = globalThis;
export function forwardPe(row) { return consensusView(row, consensusRowFor(consensusRoot, row?.sym || row?.symbol))?.fwdPe ?? null; }
// 2026-10-14 custom conditions: a registered field is read through its readiness (as the factor columns are); the new
// distance fields read straight from the row; Forward PER from the consensus view.
const FILING_KEYS = new Set(['pe', 'pb', 'roe', 'margin', 'revGrowth']);
const FILING_STATUSES = new Set(['CURRENT', 'DELAYED', 'INFERRED', 'STALE', 'LAST_GOOD']);
const FIELD_BY_ROW_KEY = new Map(SCREENER_FIELD_REGISTRY.fields.map((definition) => [definition.rowKey, definition.fieldId]));
export function customRead(row, key) {
  if (key === 'fwdPe') return forwardPe(row);
  if (CHANNEL_SIGNAL_KEYS.includes(key)) return channelSignalValue(consensusRoot?.AIO_TELEGRAM_SIGNALS, row, key); // v58.71 (js/aio-data.js sets it)
  const fieldId = FIELD_BY_ROW_KEY.get(key);
  // Annual filing figures (PER·PBR·ROE·이익률·성장률) share the rank's 456-day budget (2026-10-16); a filter labelled
  // '최근 회계연도' still reads an older STALE figure as the table displays it, but never a CONFLICT value.
  if (row?.fieldReadiness && fieldId && FILING_KEYS.has(key)) return FILING_STATUSES.has(row.fieldReadiness.fields?.[fieldId]?.status) ? finite(row[key]) : null;
  if (row?.fieldReadiness && fieldId) return fieldValueForPurpose(row, fieldId, 'calculation');
  return typeof row?.[key] === 'string' || typeof row?.[key] === 'boolean' || Array.isArray(row?.[key]) ? row[key] : finite(row?.[key]);
}
let customPanel = null;
let availableCache = {};

// The value a sort column reads from the display row (liveRow) — the registry gates registered fields for display.
// Only price and 시총 take the live overlay, so only they build the whole display row; the other columns read the one
// value they need. Keys are computed once per row instead of once per comparison.
const FACTOR_SORT_COLUMNS = new Set(['momentum', 'trend', 'lowvol', 'value', 'quality', 'kalman']);
const DISPLAY_FIELD_BY_ROW_KEY = new Map(SCREENER_FIELD_REGISTRY.fields.filter((definition) => !definition.fieldId.startsWith('identity.')).map((definition) => [definition.rowKey, definition.fieldId]));
function displayValue(row, key) {
  const fieldId = row.fieldReadiness ? DISPLAY_FIELD_BY_ROW_KEY.get(key) : null;
  return fieldId ? fieldValueForPurpose(row, fieldId, 'display') : row[key];
}
function sortKey(row, sortColumn, readLiveData) {
  if (sortColumn === 'price') return liveRow(row, readLiveData).price;
  if (sortColumn === 'mcap') return capFilterValue(liveRow(row, readLiveData)); // v57.55 (8n): the same value the cap filter uses (reference cap when no live cap)
  if (sortColumn === 'extension') return extensionMultiple({ pctSma50: displayValue(row, 'pctSma50'), adrPct: displayValue(row, 'adrPct') });
  if (sortColumn === 'fwdPe') return forwardPe({ sym: displayValue(row, 'sym'), symbol: displayValue(row, 'symbol') });
  if (sortColumn === 'rank') return visibleRank({ screenStatus: displayValue(row, 'screenStatus'), rank: displayValue(row, 'rank') });
  if (sortColumn === 'range52') return range52Position({ pctFrom52wHigh: displayValue(row, 'pctFrom52wHigh'), pctFrom52wLow: displayValue(row, 'pctFrom52wLow') });
  if (FACTOR_SORT_COLUMNS.has(sortColumn)) return displayValue(row, 'factorScores')?.[sortColumn];
  // v58.75 (persona review): the computed fact columns sort by the value their cell shows.
  if (sortColumn === 'pivotDist') return pivotDistancePct(row);
  if (sortColumn === 'rs6m' || sortColumn === 'rs12m') return currentRsPercentiles.get(row.sym || row.symbol)?.[sortColumn];
  if (sortColumn === 'dollarVolume30d') return displayValue(row, 'dollarVolume30d') ?? finite(row.tradedValue30d);
  return displayValue(row, sortColumn);
}

export function sortRows(rows, sortColumn, ascending, readLiveData) {
  const missing = (value) => value == null || value === '' || (typeof value === 'number' && !Number.isFinite(value));
  return rows.map((row) => {
    const key = sortKey(row, sortColumn, readLiveData);
    const absent = missing(key);
    return { row, absent, key: !absent && typeof key === 'string' ? key.toUpperCase() : key };
  }).sort((a, b) => {
    if (a.absent || b.absent) return a.absent === b.absent ? 0 : a.absent ? 1 : -1;
    const comparison = a.key > b.key ? 1 : a.key < b.key ? -1 : 0;
    return ascending ? comparison : -comparison;
  }).map((entry) => entry.row);
}

function createRankNode(documentRef, row, hold = null) {
  const wrap = documentRef.createElement('div');
  // P1452: when the current epoch's re-rank is held, the previous run's relative score and
  // rank must not stay on the table as if they answered the new selection — the row cell
  // says 순위 보류 with the reason, matching the banner on the same screen.
  if (hold) {
    const rankCellHold = documentRef.createElement('span');
    rankCellHold.textContent = '순위 보류';
    rankCellHold.className = 'scr-rank-hold';
    rankCellHold.title = `지금 선택에 대한 순위 계산이 보류 중입니다(${hold.reason || '사유 미확인'}). 남아 있던 숫자는 이전 계산의 결과라 표시하지 않습니다.`;
    wrap.appendChild(rankCellHold);
    return wrap;
  }
  if (row.screenStatus === 'unavailable' || row.screenStatus === 'rejected') {
    wrap.textContent = row.screenStatus === 'rejected' ? '조건 미충족' : '근거 부족';
    wrap.title = '필수 데이터가 모두 준비되기 전에는 순위를 표시하지 않습니다.';
    wrap.className = 'scr-rank-unranked';
    return wrap;
  }
  const rank = visibleRank(row);
  if (rank == null) {
    wrap.appendChild(text(documentRef, '—'));
    // 2026-10-16: a fund, a SPAC or a thinly traded 확장 name is shown but not compared with operating companies.
    const excluded = { fund: 'ETF·펀드는 기업 주식과 같은 기준으로 비교하지 않아 순위에서 뺐습니다.', spac: '기업인수목적회사(SPAC)는 신탁 현금이라 주가가 거의 움직이지 않아 순위에서 뺐습니다.', illiquid: '하루 평균 거래대금이 100만 달러 미만이라 확장 순위에서 뺐습니다.', foreign: '도쿄·대만 상장 종목은 거래일과 통화가 달라 미국 종목과 같은 순위로 비교하지 않습니다.' }[row.populationExclusion];
    if (excluded) wrap.title = excluded;
  } else {
    const value = documentRef.createElement('div');
    value.textContent = String(rank);
    // v57.81: the percentile names its population — the core universe, or core + Russell 2000·Nasdaq (확장).
    const contract = RANKING_CONTRACTS[row.rankingUniverse === 'extended' ? 'extended' : 'core'];
    wrap.dataset.rankingContract = contract.id;
    wrap.title = `${MARKET_LABELS[screenerMarket(row)]} 시장의 계산 가능한 종목 중 백분위 ${rank}, ${contract.label} — 만점이나 상승 확률이 아닙니다. 조건을 선택해도 팩터 백분위의 모집단은 바뀌지 않습니다.`;
    // v57.54: a descriptive position, not a verdict — one neutral colour, no green/red judgement.
    value.className = 'scr-rank-value';
    const bar = documentRef.createElement('div');
    bar.className = 'scr-rank-bar';
    const fill = documentRef.createElement('div');
    fill.className = 'scr-rank-fill';
    fill.style.width = `${Math.max(0, Math.min(100, rank))}%`;
    bar.appendChild(fill);
    wrap.append(value, bar);
  }
  return wrap;
}

function createColumnContent(documentRef, row, key, { readLiveData, readWatchlist, onWatchlistToggle, onExplain, onCompare, compareSymbols, rankHold, capOrder } = {}) {
  const live = liveRow(row, readLiveData);
  row = live;
  const inWatchlist = (readWatchlist?.() || []).includes(row.sym);
  if (key === 'watchlist') {
    const wrap = documentRef.createElement('div');
    wrap.className = 'scr-row-actions';
    const star = documentRef.createElement('button');
    star.type = 'button';
    star.dataset.aioScreenerWatchlist = row.sym;
    star.className = `scr-star${inWatchlist ? ' active' : ''}`;
    star.textContent = inWatchlist ? '★' : '☆';
    star.title = inWatchlist ? '관심 종목에서 빼기' : '관심 종목에 추가'; // one name with the 포트폴리오 list (run 4 breaker #19)
    star.setAttribute('aria-label', `워치리스트 ${inWatchlist ? '제거' : '추가'} ${row.sym}`);
    star.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); onWatchlistToggle?.(row.sym); });
    wrap.append(star);
    return wrap;
  }
  if (key === 'capOrder') {
    const order = capOrder?.get(row.sym || row.symbol) ?? null;
    const node = text(documentRef, order == null ? '—' : String(order));
    node.className = 'scr-ordinal scr-cap-order';
    if (order == null) node.title = '시가총액 자료가 없어 시총 순서에서 빠졌습니다(표 맨 아래).'; // only under the 시총 sort
    return node;
  }
  if (key === 'rank') return createRankNode(documentRef, row, rankHold);
  if (key === 'screenRank') {
    const ordinal = rankHold || row.screenStatus !== 'passed' ? null : finite(row.screenRank);
    const node = text(documentRef, ordinal == null ? '—' : String(ordinal));
    node.className = 'scr-ordinal';
    return node;
  }
  if (key === 'range52') {
    const position = range52Position(row);
    if (position == null) return '—';
    const wrap = documentRef.createElement('span');
    wrap.className = 'scr-range52';
    wrap.title = `52주 저점 대비 ${returnText(row.pctFrom52wLow)}, 고점 대비 ${returnText(row.pctFrom52wHigh)} — 저점과 고점 사이 ${Math.round(position * 100)}% 지점`;
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', `52주 범위의 ${Math.round(position * 100)}% 지점`);
    const dot = documentRef.createElement('span');
    dot.className = 'scr-range52-dot';
    dot.style.left = `${(position * 100).toFixed(1)}%`;
    wrap.append(dot);
    return wrap;
  }
  if (key === 'grade') return rankGrade(visibleRank(row)) || '—';
  if (key === 'sym') {
    const identity = documentRef.createElement('div');
    const symbol = documentRef.createElement('div');
    symbol.textContent = row.sym || row.symbol || '—';
    symbol.className = 'scr-sym-code';
    const name = documentRef.createElement('div');
    name.textContent = row.name || '이름 미수신';
    name.className = 'scr-sym-name';
    identity.append(symbol, name);
    return identity;
  }
  if (key === 'sector') {
    if (row.sectorSource !== 'sec-sic' || !row.sector) return row.sector;
    // 2026-10-17: a sector translated from the SEC SIC code (no curated sector) says so beside the value.
    const cell = documentRef.createElement('span');
    const tag = documentRef.createElement('small');
    tag.textContent = ' SIC';
    tag.className = 'scr-sic-tag';
    cell.append(documentRef.createTextNode(row.sector), tag);
    cell.title = `SEC 산업분류${row.sic ? `(SIC ${row.sic})` : ''}에서 옮긴 섹터`;
    return cell;
  }
  if (['momentum', 'trend', 'lowvol', 'value', 'quality', 'kalman'].includes(key)) {
    if (row.screenStatus === 'unavailable') return '—';
    const value = row.factorScores?.[key];
    const node = documentRef.createElement('span');
    node.textContent = value == null ? '—' : Number(value).toFixed(0);
    node.style.color = factorScoreColor(key, value, row);
    if (SECTOR_RELATIVE_PRICE_FACTORS.has(key)) node.title = '같은 섹터 안에서 비교한 값 — 섹터 전체가 내릴 때도 높게 나올 수 있어, 50·200일선과 최근 5거래일 확인을 통과할 때만 초록으로 표시';
    return node;
  }
  if (key === 'price') {
    const price = finite(live.price);
    if (price == null) {
      // P1499: raw prices are not republished (P715); an uncovered row shows a quiet dash, not a word on every line.
      const missing = text(documentRef, '—');
      missing.style.color = 'var(--text-muted)';
      missing.title = '실시간 시세가 연결되지 않은 종목 — 공개 데이터에는 종목별 가격을 싣지 않습니다.';
      return missing;
    }
    const currency = String(row.instrumentRef?.currency || row.currency || '').trim().toUpperCase() || null;
    if (row.priceCloseDate !== undefined && row.priceObservedAt == null) {
      const cell = documentRef.createElement('span');
      const date = String(row.priceCloseDate || '');
      const md = /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}` : '';
      cell.appendChild(text(documentRef, formatScreenerPrice(price, currency)));
      const note = documentRef.createElement('small');
      note.textContent = md ? `${md} 종가` : '종가';
      note.className = 'scr-close-note';
      note.dataset.closeDay = md;
      cell.appendChild(note);
      cell.title = `${currency || '통화 미확인'}, ${md ? `${md} ` : ''}확정 종가(수정 종가), 실시간 시세가 아닙니다`;
      return cell;
    }
    const observedAt = row.priceObservedAt || row.priceObserved || null;
    const source = row.priceSource || null;
    const stamp = observedAt ? `관측 ${String(observedAt).slice(0, 16).replace('T', ' ')}` : '관측 시각 미확인';
    // LC-42: an overlay quote with no observation time is not a confirmed 현재가. Bind currency/
    // observedAt/source/freshness to the row itself and do not inherit the global LIVE badge,
    // which counts topbar coverage rather than this instrument's quote.
    const wrap = documentRef.createElement('span');
    // P1599 (F06): won prices have no minor unit — show them as whole numbers with the ₩ sign instead of '161500.00 KRW'.
    const value = text(documentRef, formatScreenerPrice(price, currency));
    value.dataset.quoteFreshness = observedAt ? 'observed' : 'unverified';
    value.title = `${currency || '통화 미확인'}, ${stamp}, ${source || '출처 미확인'}, ${observedAt ? '행 자체 관측' : '현재성 미확인 — 전역 LIVE에 상속하지 않음'}`;
    if (!observedAt) value.style.color = 'var(--text-muted)';
    wrap.appendChild(value);
    if (!observedAt) {
      const note = documentRef.createElement('small');
      note.textContent = '관측시각 미확인, 참고';
      note.className = 'scr-cell-note';
      wrap.appendChild(note);
    }
    return wrap;
  }
  // UI review 2026-10-18: returns read at a glance in the app's rise/fall colours (returnColor was defined but unused);
  // 52주 고점 대비 is never positive, so it stays in the text colour rather than a column of red.
  if (['ret1m', 'ret3m', 'ret6m', 'pctSma50'].includes(key)) {
    const node = documentRef.createElement('span');
    node.textContent = returnText(row[key]);
    node.style.color = finite(row[key]) == null ? 'var(--text-muted)' : returnColor(row[key]);
    return node;
  }
  if (key === 'rsi') return numberText(row.rsi, 1);
  if (key === 'extension') {
    const multiple = extensionMultiple(row);
    const node = documentRef.createElement('span');
    node.textContent = multiple == null ? '—' : `${multiple.toFixed(1)}배`;
    node.title = multiple == null ? '50일선 거리 또는 일평균 변동폭 자료 없음' : `50일선 대비 ${Number(row.pctSma50).toFixed(1)}% ÷ 일평균 변동폭 ${Number(row.adrPct).toFixed(1)}% — ${EXTENSION_BANDS.nearBase}배 이하는 기준선 가까이, ${EXTENSION_BANDS.extended}배 이상은 확장, ${EXTENSION_BANDS.stretched}배 이상은 크게 확장된 구간(참고 구간)`;
    node.style.color = multiple == null ? 'var(--text-muted)' : multiple >= EXTENSION_BANDS.stretched ? 'var(--data-red)' : multiple >= EXTENSION_BANDS.extended ? 'var(--data-amber)' : 'var(--text-primary)';
    return node;
  }
  if (key === 'pctFrom52wHigh') return returnText(row.pctFrom52wHigh);
  // v58.75 (persona review): trader and fundamental fact columns. Each cell says what it was computed from on hover.
  if (key === 'ret5d') {
    const node = text(documentRef, returnText(row.ret5d));
    node.style.color = returnColor(row.ret5d);
    return node;
  }
  if (key === 'rvol20') {
    const value = finite(row.rvol20);
    const node = text(documentRef, value == null ? '—' : `${value.toFixed(2)}배`);
    node.title = value == null ? '거래량 자료 없음' : `마지막 거래일 거래량이 직전 20거래일 평균의 ${value.toFixed(2)}배${row.factorSessionDate ? ` (${row.factorSessionDate} 종가 기준)` : ''}`;
    if (value == null) node.style.color = 'var(--text-muted)';
    return node;
  }
  if (key === 'adrPct') {
    const value = finite(row.adrPct);
    const node = text(documentRef, value == null ? '—' : `${value.toFixed(1)}%`);
    if (value == null) node.style.color = 'var(--text-muted)';
    return node;
  }
  if (key === 'dollarVolume30d') {
    const usd = finite(row.dollarVolume30d);
    const native = usd == null ? finite(row.tradedValue30d) : null;
    const nativeCurrency = String(row.tradedValueCurrency || '').toUpperCase();
    const label = usd != null ? usdKoreanText(usd)
      : native != null && nativeCurrency === 'KRW' ? `${Math.round(native / 1e8).toLocaleString('ko-KR')}억원` : '—';
    const node = text(documentRef, label);
    if (label === '—') node.style.color = 'var(--text-muted)';
    return node;
  }
  if (key === 'pivotDist') {
    const pct = pivotDistancePct(row);
    const node = text(documentRef, pct == null ? '—' : returnText(pct));
    node.title = pct == null ? '피벗이 계산되지 않았거나 종가 자료가 없는 종목' : `마지막 확정 종가가 피벗(마지막 수축 구간의 고점)보다 ${Math.abs(pct).toFixed(1)}% ${pct >= 0 ? '위' : '아래'}${row.vcpStage ? `, 구조: ${vcpStageLabel(row.vcpStage)}` : ''} — 관찰 위치이며 매수 지점이 아닙니다`;
    node.style.color = pct == null ? 'var(--text-muted)' : 'var(--text-primary)';
    return node;
  }
  if (key === 'rs6m' || key === 'rs12m') {
    const entry = currentRsPercentiles.get(row.sym || row.symbol);
    const pct = finite(entry?.[key]);
    const node = text(documentRef, pct == null ? '—' : String(pct));
    const months = key === 'rs6m' ? 6 : 12;
    const ret = finite(row[key === 'rs6m' ? 'ret6m' : 'ret12m']);
    node.title = pct == null ? `${months}개월 수익률이 없거나 순위 비교 대상이 아닌 종목` : `${months}개월 수익률 ${returnText(ret)} — 같은 시장 ${entry[`${key}Count`]}종목 중 백분위 ${pct}`;
    if (pct == null) node.style.color = 'var(--text-muted)';
    return node;
  }
  if (FILING_KEYS.has(key)) {
    const value = finite(row[key]);
    const multiple = key === 'pe' || key === 'pb';
    const label = value == null ? '—' : key === 'pe' && value > PE_MEANINGFUL_MAX ? `${PE_MEANINGFUL_MAX}배 초과` : multiple ? `${numberText(value, 1)}배` : key === 'revGrowth' ? returnText(value) : numberText(value, 1, '%');
    const node = text(documentRef, label);
    const period = row._fundamentalPeriodEnd || null;
    const filed = row._fundamentalFiledAt ? String(row._fundamentalFiledAt).slice(0, 10) : null;
    const earnings = key === 'pe' && row._valuationPeEarningsThrough ? `, 이익 ${row._valuationPeEarningsBasis === 'ttm' ? '최근 4개 분기 합' : '최근 회계연도'}(${row._valuationPeEarningsThrough}까지)` : '';
    node.title = value == null ? '공시 자료가 없거나 비정상 값이라 비움' : `${period ? `회계기간 종료 ${period}` : '회계기간 미확인'}${filed ? `, 공시 ${filed}` : ''}${earnings}`;
    if (value == null) node.style.color = 'var(--text-muted)';
    return node;
  }
  if (key === 'themeStage') {
    const stages = rowThemeStages(row);
    if (!stages?.length) {
      const node = text(documentRef, '—');
      node.style.color = 'var(--text-muted)';
      node.title = stages == null ? '테마 상태 자료가 최신이 아니라 표시하지 않습니다' : '추적하는 테마에 들어 있지 않은 종목';
      return node;
    }
    const node = text(documentRef, `${stages[0].label}, ${stages[0].stateLabel}${stages.length > 1 ? ` 외 ${stages.length - 1}` : ''}`);
    node.title = stages.map((stage) => `${stage.label}: ${stage.stateLabel}`).join('\n');
    return node;
  }
  if (key === 'vcpScore') {
    const node = documentRef.createElement('span');
    // Codex browser audit H46: a green/red 0–100 number read as a validated buy score. The structure stage comes
    // first; the number is labelled as how many contraction rules are met, in a neutral colour.
    node.textContent = row.vcpScore == null ? '—' : `${vcpStageLabel(row.vcpStage)}, 충족도 ${row.vcpScore}`;
    node.title = '변동성 수축(VCP) 규칙 — 수축 횟수, 수축 깊이 감소, 거래량 감소 — 을 얼마나 충족하는지 0~100으로 합친 값입니다. 과거 성과로 검증된 매수 점수가 아닙니다.';
    node.style.color = row.vcpScore == null ? 'var(--text-muted)' : 'var(--text-secondary)';
    return node;
  }
  if (key === 'fwdPe') {
    const view = consensusView(row, consensusRowFor(consensusRoot, row.sym || row.symbol));
    // v57.55 review (E1-01): the estimates arrive in batches (214/904 on the first runs), so a missing value before full
    // coverage is "not collected yet", not "no estimate".
    const coverage = consensusRoot?._aioConsensusEstimates?.coverage;
    const partial = !view && /^[A-Z.-]+$/.test(String(row.sym || '')) && finite(coverage?.covered) != null && coverage.covered < coverage.universeUs;
    const node = text(documentRef, view?.fwdPe != null ? (view.fwdPe > PE_MEANINGFUL_MAX ? `${PE_MEANINGFUL_MAX}배 초과` : `${numberText(view.fwdPe, 1)}배`) : view ? '적자 예상' : partial ? '수집 전' : '—');
    if (partial) node.title = `컨센서스는 실행마다 일부 종목씩 수집합니다(지금 ${coverage.covered}/${coverage.universeUs}종목). 다음 수집 차례에 채워집니다.`;
    else node.title = view ? `종가 ${view.price}${view.priceDate ? ` (${view.priceDate})` : ''} ÷ 아직 실적이 발표되지 않은 4개 분기(${view.fwdFrom}~${view.fwdTo}) 컨센서스 EPS 합 ${view.fwdEps}, 애널리스트 최소 ${view.minEstimates ?? '?'}명, ${view.asOf} 수집 — 참고값` : '컨센서스 자료 없음(미국 종목만, 애널리스트 추정이 있는 경우)';
    if (!view) node.style.color = 'var(--text-muted)';
    return node;
  }
  if (key === 'mcap') {
    if (live.mcap != null) return usdKoreanText(live.mcap * 1e9);
    const native = row.nativeMarketCap;
    const reference = row.referenceMarketCap;
    if ((finite(native?.value) == null || ['BLOCKED', 'DENIED'].includes(native.rightsId)) && finite(reference?.billions) != null) {
      const node = text(documentRef, `${usdKoreanText(reference.billions * 1e9)}, 참고`);
      node.title = `참고 시총 = SEC 발행주식수(${reference.sharesObservedAt || '기준일 미상'}) × 산출물 종가 — 크기 구간 필터에만 쓰고 팩터·판단에는 쓰지 않음 (P1318)`;
      return node;
    }
    if (finite(native?.value) == null || ['BLOCKED', 'DENIED'].includes(native.rightsId)) return '—';
    const billions = native.value / 1e9;
    const amount = billions >= 1000 ? `${numberText(billions / 1000, 1)}T` : `${numberText(billions, 2)}B`;
    const node = text(documentRef, `${native.currency} ${amount}, 참고`);
    node.title = `${native.source || '출처 미확인'}, 관측 ${native.observedAt || '시각 미확인'}, USD 환산값이 없어 USD 시총 필터/팩터에는 사용하지 않음`;
    return node;
  }
  if (key === 'followThrough') {
    const summary = followThroughSummary(row);
    const node = documentRef.createElement('span');
    node.className = 'scr-follow-through';
    node.textContent = summary.text;
    if (summary.title) node.title = summary.title;
    if (summary.climax) node.style.color = 'var(--data-red)';
    return node;
  }
  if (key === 'entry') {
    if (row.screenStatus === 'unavailable') return '판정 보류';
    const entry = entryTiming(row);
    const entryNode = documentRef.createElement('span');
    entryNode.className = `scr-entry-chip ${entry[1]}`;
    entryNode.textContent = entry[0];
    entryNode.title = row.setupProfile?.explanation || 'RSI·랭크·모멘텀 기반 설명형 분류';
    return entryNode;
  }
  if (key === 'news') {
    const provenance = documentRef.createElement('div');
    provenance.className = 'scr-evidence-cell';
    const memo = documentRef.createElement('span');
    // N21: an empty cell says why — waiting for its rotation turn, fetch failed, no headline that names the
    // company, or not collected for this market. Sources stay in the hover only.
    const newsEmpty = { 'rotation-pending': '순환 대기', 'fetch-failed': '수신 실패', 'no-verified-article': '확인된 기사 없음', 'not-covered': '수집 대상 아님' };
    // v57.55 review (E1-10): an empty memo is a quiet dash (its reason in the hover), not a word repeated down the column.
    memo.textContent = row.newsMemo ? row.newsMemo.slice(0, 70) : '—';
    if (!row.newsMemo) memo.style.color = 'var(--text-muted)';
    const newsSources = Array.isArray(row.newsMemoSources) ? row.newsMemoSources.filter(Boolean) : [];
    if (row.newsMemo) memo.title = `${row.newsMemo}${newsSources.length ? `\n출처: ${newsSources.join(', ')}` : ''}`;
    else if (row.newsStatus === 'rotation-pending') memo.title = '종목 뉴스는 실행마다 일부 종목씩 돌아가며 수집합니다. 다음 차례에 갱신됩니다.';
    else memo.title = newsEmpty[row.newsStatus] || '근거 미수신';
    const why = documentRef.createElement('button');
    why.type = 'button';
    why.textContent = '근거';
    why.className = 'scr-why-btn';
    why.title = '이 순위가 나온 이유와 각 값의 출처 보기';
    why.setAttribute('aria-label', `${row.sym} 순위·탈락 근거 보기`);
    why.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); onExplain?.(row); });
    provenance.append(memo, why);
    return provenance;
  }
  return row[key] ?? '—';
}

const MONO_COLUMNS = new Set(['price', 'pctFrom52wHigh', 'rank', 'momentum', 'trend', 'lowvol', 'value', 'quality', 'ret1m', 'ret3m', 'ret6m', 'rsi', 'pctSma50', 'kalman', 'vcpScore', 'mcap', 'fwdPe',
  'ret5d', 'rs6m', 'rs12m', 'rvol20', 'adrPct', 'dollarVolume30d', 'pivotDist', 'pe', 'pb', 'roe', 'margin', 'revGrowth']); // v58.75: the new fact columns
function createTableRow(documentRef, row, { readLiveData, readWatchlist, onWatchlistToggle, onExplain, onCompare, selectedSymbols, compareSymbols, visibleColumns, rankHold, capOrder } = {}) {
  const tr = documentRef.createElement('tr');
  const symbol = row.sym || row.symbol;
  tr.className = `aio-hover-row${selectedSymbols?.has(symbol) ? ' is-selected' : ''}`;
  tr.tabIndex = 0;
  tr.dataset.aioScreenerTicker = symbol || '';
  tr.dataset.aioScreenerWhy = row.screenStatus || 'unavailable';
  tr.setAttribute('aria-selected', selectedSymbols?.has(symbol) ? 'true' : 'false');
  tr.setAttribute('aria-label', `${symbol || '종목'} ${row.screenStatus === 'passed' ? '선정' : row.screenStatus === 'rejected' ? '탈락' : '데이터 부족'} 행. Enter로 Why 보기`);
  tr.addEventListener('click', (event) => {
    if (event.target.closest('button, input, a, select')) return;
    onExplain?.(row);
  });
  tr.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onExplain?.(row); }
  });
  let stickyLeft = 0;
  visibleColumns.forEach((column) => {
    const td = documentRef.createElement('td');
    td.dataset.columnKey = column.key;
    td.dataset.label = column.label; // v57.79: the phone card row (<600px) names each value without the header row
    td.className = `scr-column-cell scr-column-${column.key}${column.sticky ? ' scr-column-sticky' : ''}`;
    td.style.textAlign = column.align;
    td.style.minWidth = `${column.width}px`;
    if (column.sticky) td.style.left = `${stickyLeft}px`;
    if (MONO_COLUMNS.has(column.key)) {
      td.style.fontFamily = 'var(--font-mono)';
      td.style.fontVariantNumeric = 'tabular-nums';
    }
    const content = createColumnContent(documentRef, row, column.key, { readLiveData, readWatchlist, onWatchlistToggle, onExplain, onCompare, compareSymbols, rankHold, capOrder });
    td.appendChild(content && content.nodeType ? content : text(documentRef, content));
    const fieldId = FIELD_BY_COLUMN.get(column.key);
    const field = fieldId && row.fieldReadiness?.fields?.[fieldId];
    if (field) {
      td.dataset.fieldStatus = field.status;
      // P1599 (F06): reader words for the field state; the raw code stays in data-field-status for tools.
      const STATUS_WORDS = { CURRENT: '최신', INFERRED: '다른 값에서 계산', UNSUPPORTED: '이 종목에는 없는 항목', BLOCKED_RIGHTS: '사용 권리 확인 전', DELAYED: '지연된 종가 기준', STALE: '오래된 값', LAST_GOOD: '마지막 정상값', MISSING: '관측 시각 미확인', CONFLICT: '출처 간 값이 다름', UNAVAILABLE: '값 없음' };
      td.title = `${field.sourceId || '출처 미확인'}, 관측 ${field.observedAt ? String(field.observedAt).slice(0, 10) : '시각 미확인'}, ${STATUS_WORDS[field.status] || field.status}`;
      if (field.status === 'CONFLICT' && fieldValueForPurpose(row, fieldId) != null) {
        const note = documentRef.createElement('small');
        note.textContent = '값 충돌, 참고';
        note.className = 'scr-cell-note';
        td.appendChild(note);
      } else if (['STALE', 'LAST_GOOD'].includes(field.status) && fieldValueForPurpose(row, fieldId) != null) {
        // P1319/N12: every stale cell used to repeat "YYYY-MM-DD · 참고", burying the numbers.
        // The cell is muted and marked; one table-level note states the date(s) once (renderStaleNote).
        td.dataset.staleAsOf = field.observedAt ? String(field.observedAt).slice(0, 10) : '시각 미확인';
        td.style.color = 'var(--text-muted)';
      }
    }
    tr.appendChild(td);
    if (column.sticky) stickyLeft += column.width;
  });
  return tr;
}

// S01/S04/S16: a control whose input is not published for the selected market is disabled (or hidden) with
// its reason instead of offering a choice that always returns 0 rows or a held ranking.
const SETUP_OPTION_EVIDENCE = Object.freeze({
  WINNER: (setup) => setup?.winnerFilter && setup.winnerFilter !== 'unavailable',
  RSPULLBACK: (setup) => setup?.relativeStrengthPullback && setup.relativeStrengthPullback !== 'unavailable',
  SUPPORT200: (setup) => setup?.support200 && setup.support200 !== 'unavailable',
  CLIMAX: (setup) => setup?.climaxRisk && setup.climaxRisk !== 'unavailable'
});
export function syncScreenerControlAvailability(documentRef, { rows = [], listingMarket = 'US', ranking = {}, profiles = null } = {}) {
  const marketList = scopedRows(rows, listingMarket);
  const cap = documentRef?.getElementById?.('scr-cap');
  if (cap) {
    const capAvailable = marketList.some((row) => capFilterValue(row) != null);
    cap.hidden = !capAvailable;
    if (!capAvailable) cap.value = '';
  }
  const setup = documentRef?.getElementById?.('scr-setup');
  if (setup?.options) {
    Array.prototype.slice.call(setup.options).forEach((option) => {
      const hasEvidence = SETUP_OPTION_EVIDENCE[option.value];
      if (!hasEvidence) return;
      if (!option.dataset.baseLabel) option.dataset.baseLabel = option.textContent;
      const available = marketList.some((row) => hasEvidence(row.setupProfile));
      option.disabled = !available;
      option.textContent = available ? option.dataset.baseLabel : `${option.dataset.baseLabel} — 자료 미발행`;
      if (!available && setup.value === option.value) setup.value = '';
    });
  }
  const notes = [];
  const anyActive = Object.values(ranking?.factorCoverage || {}).some((entry) => entry?.active === true);
  documentRef?.querySelectorAll?.('[data-aio-screener-action="profile"]').forEach((button) => {
    const key = button.dataset.aioScreenerArg;
    const weights = profiles?.[key]?.weights;
    if (key === 'balanced' || !weights) { button.disabled = false; button.removeAttribute('title'); return; }
    const measured = profileComputability(weights, ranking?.factorCoverage);
    const blocked = !!measured && !measured.available;
    button.disabled = blocked;
    button.setAttribute('aria-disabled', String(blocked));
    if (!blocked) { button.removeAttribute('title'); return; }
    const missing = measured.missing.map((factor) => FACTOR_LABELS[factor]?.label || factor).join('·');
    const reason = anyActive ? `요청 비중 중 계산 가능 ${measured.pct}%(기준 80%) — ${missing} 자료 부족` : '이 시장의 팩터 자료가 최신 종가 기준이 아니어서 계산 대기';
    button.title = `${button.textContent.trim()}: ${reason}`;
    notes.push({ label: button.textContent.trim(), pct: measured.pct, missing });
  });
  const fold = documentRef?.getElementById?.('scr-weight-profiles');
  if (fold) {
    let note = documentRef.getElementById('scr-profile-availability');
    if (!note && notes.length) {
      note = documentRef.createElement('p');
      note.id = 'scr-profile-availability';
      note.className = 'scr-profile-note';
      fold.appendChild(note);
    }
    if (note) {
      note.hidden = !notes.length;
      const missingAll = [...new Set(notes.flatMap((entry) => entry.missing))].map((factor) => FACTOR_LABELS[factor]?.label || factor).join('·');
      note.textContent = !notes.length ? '' : anyActive
        ? `${withTopicParticle(notes.map((entry) => entry.label).join('·'))} 지금 계산할 수 없습니다 — 요청 비중 중 계산 가능한 몫이 ${notes.map((entry) => `${entry.pct}%`).join('·')}로 기준 80%에 못 미칩니다(${missingAll} 자료 부족).`
        : `${MARKET_LABELS[listingMarket] || listingMarket} 팩터 자료가 최신 종가 기준이 아니어서 가중치 프로필을 계산하지 않습니다.`;
    }
  }
}

// 개편 v2 (3c): author·year evidence for the factors the score weights. Only the listed studies; a factor without one
// (추세, 추세 속도, 밸류) shows its definition and weight only.
const FACTOR_EVIDENCE = Object.freeze({
  momentum: '중기(3~12개월) 승자가 이후에도 앞서던 경향(Jegadeesh·Titman 1993) — 여기서는 1·3·6개월 수익률을 섞어 씁니다',
  lowvol: '변동성이 낮은 종목의 위험 대비 수익이 더 높던 저변동 이상 현상(Ang 외 2006, Frazzini·Pedersen 2014)',
  quality: '수익성이 높은 기업이 장기 초과수익을 내던 경향(Novy-Marx 2013, 매출총이익 기준) — 여기서는 ROE·마진·매출성장'
});

// 개편 v2 (3c): the row's 1·3·6-month returns beside SPY's on the same close — one diverging scale, the gap on the right.
// v58.56 (4b): the 52-week position in the inspector/sheet — the phone row shows only order, name, 1개월 and 백분위.
function renderWhyRange(documentRef, row) {
  const section = documentRef.getElementById('scr-why-range');
  const host = documentRef.getElementById('scr-why-range-body');
  if (!section || !host) return;
  const position = range52Position(row);
  section.hidden = position == null;
  if (position == null) { host.replaceChildren(); return; }
  const bar = documentRef.createElement('span');
  bar.className = 'scr-range52 scr-why-range-bar';
  bar.setAttribute('role', 'img');
  bar.setAttribute('aria-label', `52주 저점과 고점 사이 ${Math.round(position * 100)}% 지점`);
  const dot = documentRef.createElement('span');
  dot.className = 'scr-range52-dot';
  dot.style.left = `${(position * 100).toFixed(1)}%`;
  bar.append(dot);
  const legend = documentRef.createElement('div');
  legend.className = 'scr-why-range-legend sx-meta';
  const part = (value) => { const node = documentRef.createElement('span'); node.textContent = value; return node; };
  legend.append(part(`저점 대비 ${returnText(row.pctFrom52wLow)}`), part(`${Math.round(position * 100)}% 지점`), part(`고점 대비 ${returnText(row.pctFrom52wHigh)}`));
  host.replaceChildren(bar, legend);
}

function renderExcessBars(documentRef, row, benchmark) {
  const section = documentRef.getElementById('scr-why-excess');
  const host = documentRef.getElementById('scr-why-excess-bars');
  if (!section || !host) return;
  const windows = [['ret1m', '1개월'], ['ret3m', '3개월'], ['ret6m', '6개월']]
    .map(([key, label]) => ({ key, label, stock: finite(row?.[key]), index: finite(benchmark?.[key]) }))
    .filter((item) => item.stock != null && item.index != null);
  section.hidden = !windows.length;
  host.replaceChildren();
  if (!windows.length) return;
  // Review fix: a gap is drawn only when the row and SPY close on the same session; otherwise both dates are named.
  const md = (value) => { const day = String(value || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(day) ? `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}` : null; };
  const rowDay = md(row?.factorSessionDate);
  const indexDay = md(benchmark?.factorSessionDate);
  if (!rowDay || !indexDay || rowDay !== indexDay) {
    const note = documentRef.createElement('p');
    note.className = 'sx-meta scr-excess-legend';
    note.textContent = `종목 종가(${rowDay || '날짜 미확인'})와 S&P 500(SPY) 종가(${indexDay || '날짜 미확인'})의 기준일이 같지 않아 차이를 그리지 않습니다.`;
    host.append(note);
    return;
  }
  const max = Math.max(1, ...windows.flatMap((item) => [Math.abs(item.stock), Math.abs(item.index)]));
  const bar = (value, kind) => {
    const track = documentRef.createElement('span');
    track.className = `scr-excess-track is-${kind}`;
    const fill = documentRef.createElement('span');
    fill.className = 'scr-excess-fill';
    fill.style.width = `${Math.min(50, Math.abs(value) / max * 50).toFixed(1)}%`;
    fill.style[value >= 0 ? 'left' : 'right'] = '50%';
    track.append(fill);
    return track;
  };
  for (const item of windows) {
    const gap = item.stock - item.index;
    const line = documentRef.createElement('div');
    line.className = 'scr-excess-row';
    line.title = `${item.label} 종목 ${returnText(item.stock)}, S&P 500(SPY) ${returnText(item.index)}`;
    const label = documentRef.createElement('span');
    label.className = 'scr-excess-label';
    label.textContent = item.label;
    const bars = documentRef.createElement('span');
    bars.className = 'scr-excess-bars';
    bars.append(bar(item.stock, 'stock'), bar(item.index, 'index'));
    const value = documentRef.createElement('span');
    value.className = `scr-excess-value ${gap >= 0 ? 'scr-tone-up' : 'scr-tone-burden'}`;
    value.textContent = signedText(gap, 1, '%p');
    line.append(label, bars, value);
    host.append(line);
  }
  const legend = documentRef.createElement('p');
  legend.className = 'sx-meta scr-excess-legend';
  legend.textContent = `진한 막대 = 종목, 옅은 막대 = S&P 500(SPY), 오른쪽 = 차이, 둘 다 ${rowDay} 종가`;
  host.append(legend);
}

// 개편 v2 (3c/5h): the validation state before the table (amber banner) and the 사후 검증 summary. One reading of the
// same back-test the 과거 검증 panel details: the gate file's status, the net top-minus-bottom spread, the net count of
// rebalances the top fifth led, and whether the sample can decide (12 rebalances and |t| ≥ 2).
function renderValidationState(documentRef, root, metadata, listingMarket) {
  const banner = documentRef.getElementById('scr-validation-banner');
  const read = readValidationState({ metadata, root, listingMarket });
  if (banner) {
    banner.hidden = false;
    banner.dataset.validationState = read.state;
    const chips = documentRef.createElement('span');
    chips.className = 'sx-chips scr-banner-chips';
    for (const label of read.chips) {
      const chip = documentRef.createElement('span');
      chip.className = 'sx-chip sx-chip--sm sx-chip--warn';
      chip.textContent = label;
      chips.append(chip);
    }
    const textNode = documentRef.createElement('span');
    textNode.className = 'scr-banner-text';
    textNode.textContent = read.sentence;
    const link = documentRef.createElement('button');
    link.type = 'button';
    link.className = 'sx-link scr-banner-link';
    link.dataset.aioScreenerAction = 'tab';
    link.dataset.aioScreenerArg = 'backtest';
    link.textContent = '검증 보기 ›';
    // v58.56 (4b): the phone shows one line — the state words and what the ranking is — and the line itself opens 사후 검증.
    const short = documentRef.createElement('button');
    short.type = 'button';
    short.className = 'scr-banner-short';
    short.dataset.aioScreenerAction = 'tab';
    short.dataset.aioScreenerArg = 'backtest';
    short.textContent = `${read.chips.length ? `${read.chips.join(', ')} — ` : ''}순위는 확인할 후보 목록 ›`;
    short.title = read.sentence;
    banner.replaceChildren(chips, textNode, link, short);
  }
  renderValidationHero({ documentRef, read });
  const compact = documentRef.getElementById('scr-backtest-summary-compact');
  if (compact) compact.textContent = read.chips.join(', ') || '사후 검증 보기';
}

// 개편 v2 (5i): what is left after each chosen condition, in order (판정 가능 = rows that carry the condition's data).
let customSummarySignature = '';
function renderCustomSummary(documentRef, { scopeRows = [], custom = [], coverage = [], shown = 0, listingMarket = 'US' } = {}) {
  const host = documentRef.getElementById('scr-custom-summary');
  if (!host) return;
  const total = scopeRows.length;
  const steps = [];
  let remaining = scopeRows;
  custom.forEach((condition, index) => {
    remaining = remaining.filter((row) => matchesConditions(row, [condition], customRead));
    const withData = coverage.find((item) => item.id === condition.id)?.withData;
    steps.push({ label: `${index ? '+ ' : ''}${conditionLabel(condition)}${withData != null && withData < total ? ` (판정 가능 ${withData})` : ''}`, count: remaining.length });
  });
  const signature = JSON.stringify([listingMarket, total, steps, shown]);
  if (signature === customSummarySignature && host.childNodes.length) return;
  customSummarySignature = signature;
  const make = (tag, textValue, className) => { const node = documentRef.createElement(tag); if (textValue != null) node.textContent = textValue; if (className) node.className = className; return node; };
  const nodes = [make('span', steps.length ? '조건을 모두 충족' : '조건 없음, 전체 종목', 'sx-meta'), make('strong', `${steps.length ? remaining.length : total}종목`, 'scr-custom-total')];
  const bars = make('div', null, 'scr-custom-funnel');
  for (const step of [{ label: `전체 유니버스, ${MARKET_LABELS[listingMarket] || listingMarket}`, count: total }, ...steps]) {
    const line = make('div', null, 'scr-custom-step');
    const head = make('div', null, 'scr-custom-step-head');
    head.append(make('span', step.label), make('b', String(step.count)));
    const track = make('div', null, 'sx-factor__bar');
    const fill = make('span');
    fill.style.width = `${total ? Math.max(step.count ? 1 : 0, step.count / total * 100).toFixed(1) : 0}%`;
    track.append(fill);
    line.append(head, track);
    bars.append(line);
  }
  nodes.push(bars);
  nodes.push(make('p', steps.length ? `지금 표에 남는 종목 ${shown}개 — 실행 통과·섹터·검색 같은 다른 필터까지 적용한 수입니다(결과 보기는 실행 통과만을 끄고 전체에서 찾습니다). 겹친 조건은 과거 성과로 검증한 규칙이 아닙니다.` : '조건을 고르면 조건마다 남는 종목 수가 여기에 쌓입니다.', 'sx-meta scr-custom-foot'));
  const go = make('button', '결과 보기', 'sx-btn sx-btn--primary scr-custom-go');
  go.type = 'button';
  go.dataset.aioScreenerAction = 'view';
  go.dataset.aioScreenerArg = 'rank';
  nodes.push(go);
  host.replaceChildren(...nodes);
}

function renderStaleNote(documentRef, body) {
  const table = body?.closest?.('table');
  if (!table) return;
  let note = documentRef.getElementById('scr-stale-note');
  const message = describeStaleDates([...body.querySelectorAll('[data-stale-as-of]')].map((cell) => cell.dataset.staleAsOf));
  if (!message) { if (note) note.hidden = true; return; }
  if (!note) {
    note = documentRef.createElement('div');
    note.id = 'scr-stale-note';
    note.setAttribute('role', 'note');
    note.className = 'scr-stale-note';
    const anchor = table.parentElement && table.parentElement !== body.ownerDocument?.body ? table.parentElement : table;
    anchor.parentElement?.insertBefore(note, anchor);
  }
  note.hidden = false;
  note.textContent = message;
}

function renderFactorTab(documentRef, metadata) {
  const ranking = metadata?.ranking || {};
  const bars = documentRef.getElementById('scr-factor-bars');
  const weights = ranking.appliedFactorWeights || ranking.activeFactorWeights || {};
  const factors = ranking.activeFactors || [];
  if (bars) {
    bars.replaceChildren();
    const maxWeight = Math.max(1, ...factors.map((key) => Number(weights[key]) || 0));
    factors.forEach((key) => {
      const item = FACTOR_LABELS[key] || { label: key, color: 'var(--text-secondary)', description: '' };
      const row = documentRef.createElement('div');
      row.className = 'scr-factor-row';
      row.title = item.description;
      const label = documentRef.createElement('span');
      label.textContent = item.label;
      label.className = 'scr-factor-label';
      label.style.color = item.color;
      const track = documentRef.createElement('div');
       track.className = 'scr-factor-track';
      const fill = documentRef.createElement('div');
      fill.className = 'scr-factor-fill';
      fill.style.background = item.color;
      fill.style.width = `${Math.round((Number(weights[key]) || 0) / maxWeight * 100)}%`;
      track.appendChild(fill);
      const value = documentRef.createElement('span');
      value.textContent = `${Math.round((Number(weights[key]) || 0) * 100)}%`;
      value.className = 'scr-factor-value';
      row.append(label, track, value);
      bars.appendChild(row);
    });
    if (!factors.length) bars.appendChild(text(documentRef, '활성 팩터 없음 — 서버 산출물 미수신'));
  }
  const regime = ranking.activeFactorRegime || '중립';
  const regimeNode = documentRef.getElementById('screener-regime-note');
  if (regimeNode) regimeNode.textContent = regime;
  const desc = documentRef.getElementById('scr-regime-desc');
  if (desc) desc.textContent = REGIME_DESCRIPTIONS[regime] || '검증·승인 전에는 중립 고정 가중치를 적용하고 국면 틸트는 후보 진단으로만 표시합니다.';
  const confidenceNode = documentRef.getElementById('screener-factor-confidence');
  if (confidenceNode) {
    const confidence = finite(ranking.confidence);
    const composite = finite(ranking.compositeConfidence);
    // D9 (2026-10-17 audit): the run's input status in words, not the model's enum.
    const status = ({ ready: '정상', partial: '일부 제한', unavailable: '계산 불가' })[ranking.qualityStatus] || '계산 불가';
    confidenceNode.textContent = confidence == null
      ? '입력 신뢰도 산출 불가 — 미래 수익률 확률이 아닙니다.'
      : `행 근거 평균 ${Math.round(confidence * 100)}%, 횡단면 진단 ${composite == null ? '—' : `${Math.round(composite * 100)}%`}, 품질 ${status}, 미래 수익률 확률 아님`;
  }
  const diagnosticsNode = documentRef.getElementById('screener-factor-diagnostics');
  if (diagnosticsNode) {
    const sector = ranking.sectorNeutrality || {};
    const outliers = ranking.outlierDiagnostics || {};
    const turnover = ranking.turnoverStability || {};
    const regimeStability = ranking.regimeStability || {};
    // LC-41: Number(null) === 0 and Number.isFinite(0) === true, so a missing diagnostic rendered
    // as a measured zero ("상위군 회전 null%", "(0개 그룹)"). A count is only a count when the
    // producer actually sent a number — null/'' stay unmeasured.
    const countOrNull = (value) => (value == null || value === '' || typeof value === 'boolean') ? null : finite(Number(value));
    const sectorGroups = countOrNull(sector.groups);
    const sectorUnknown = countOrNull(sector.unknownRows);
    const outlierCount = countOrNull(outliers.totalOutliers);
    const turnoverPct = countOrNull(turnover.turnoverPct);
    const parts = [
      `섹터 중립 ${({ observed: '적용', partial: '일부 적용', unavailable: '확인 불가' })[sector.status] || '미확인'}${sectorGroups != null ? ` (${sectorGroups}개 그룹${sectorUnknown ? `, 미분류 ${sectorUnknown}` : ''})` : ''}`,
      `극단치 완화 ${outlierCount != null ? `${outlierCount}건` : '미확인'}`,
      // D10 (2026-10-17 audit): no caller supplies a prior ranking or regime snapshot, so these two read
      // '이전 스냅샷 없음' on every visit. They appear only when they were actually measured.
      turnover.status === 'observed' && turnoverPct != null ? `상위군 회전 ${turnoverPct}%` : null,
      ['stable', 'transition'].includes(regimeStability.status) ? `국면 안정성 ${regimeStability.status === 'stable' ? '유지' : '전환'}` : null
    ].filter(Boolean);
    diagnosticsNode.textContent = `${parts.join(', ')}, 연구용 상대 순위이며 매매 신호/자동 가중 승격에 사용하지 않습니다.`;
    diagnosticsNode.dataset.decisionEligible = String(ranking.researchBoundary?.decisionEligible === true);
  }
}

// P1443 (review 2026-10-04): one validation view. The legacy SVG under this panel read '계산 불가' while
// the same artifact carried ICs; it is removed. Shown here: per-factor and composite IC (Spearman rank
// correlation between the ranking and the next 21 sessions' return), the top-minus-bottom quintile spread
// gross and net of cost on the same ±1 exposure, how many rebalances the top quintile actually beat the
// bottom (not a per-stock direction accuracy), the 10-year 120-stock study, and what the result means.
function renderBacktest(documentRef, metadata, root = globalThis, rows = null) {
  const panel = documentRef.getElementById('screener-backtest-panel');
  if (!panel) return;
  panel.replaceChildren();
  const el = (tag, text, className) => { const node = documentRef.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
  if (metadata?.selectionMarket === 'KR') {
    panel.append(el('p', '한국 시장 전용 사후 검증은 아직 없습니다. 미국/혼합 시장의 검증 수치를 한국 순위의 검증으로 표시하지 않습니다.', 'scr-empty-state'));
    return;
  }
  const backtest = metadata?.backtest;
  const hasObservedIC = backtest?.ic && Object.values(backtest.ic).some((value) => finite(value) != null);
  if (!hasObservedIC) {
    const message = el('div', '검증 데이터 없음', 'scr-empty-state');
    message.dataset.statusCode = 'NO_BACKTEST_DATA';
    message.appendChild(el('div', metadata?.detail || '백테스트 artifact가 수신되면 IC와 표본 수를 표시합니다. 현재 0을 관측값으로 해석하지 않습니다.', 'scr-empty-detail'));
    panel.appendChild(message);
    return;
  }
  const ic = backtest.ic || {};
  // P1449: the "same calculation" claim must be proven by the stored model fingerprint, not by
  // prose — a hand-written parity sentence drifted from the applied weights once (37.0/27.4/
  // 21.9/13.7 vs 39.0/28.0/22.0/11.0 renormalized) while both claimed one model.
  const fingerprintMatches = backtest.modelFingerprint != null ? backtest.modelFingerprint === liveScreenerModelFingerprint(metadata?.ranking?.appliedFactorWeights) : false;
  const composite = finite(ic.composite);
  const net = finite(backtest.quantileSpreadNet);
  const gross = finite(backtest.quantileSpread);
  const rebalances = finite(backtest.rebalancesCounted) ?? (Array.isArray(backtest.rebalanceDates) ? backtest.rebalanceDates.length : null);
  // v57.81: one count basis with the reading above (summarizeValidation uses netHitRate) — net of cost, named as such.
  // A record without the net rate shows the gross count labelled 비용 전, never unlabelled.
  const netWinRate = finite(backtest.netHitRate);
  const winBasis = netWinRate != null ? '비용 후' : '비용 전';
  const winRate = netWinRate ?? finite(backtest.hitRate);
  const wins = winRate != null && rebalances ? Math.round(winRate / 100 * rebalances) : null;
  // 2026-10-13 review S05: the fingerprint proves the factor definition and weights; the IC/spread sample itself
  // pools the US and KR rows (n=986), so the sentence names the pooled sample instead of claiming one population.
  const parity = fingerprintMatches ? `현재 화면 순위와 같은 모델(같은 팩터 정의, 같은 가중 지문)로 과거 시점을 다시 매긴 결과입니다 — 순위는 시장별로 매기지만 IC·분위 수익률은 미국·한국 합산 표본(${backtest.n ?? '—'}종목)입니다`
    : backtest.modelFingerprint == null ? '이 검증 기록은 계산 방식 기록이 생기기 전에 만들어져 지금 화면 순위와 같은 모델인지 확인할 수 없습니다 — 지금 순위의 검증으로 읽지 않습니다(다음 데이터 갱신부터 지문이 붙습니다)'
      : '저장된 검증 기록의 계산 방식이 지금 화면 순위와 다릅니다(다른 가중치 프로필이거나 이전 모델) — 이 기록은 지금 순위의 검증으로 읽지 않습니다';
  const verdict = composite == null ? '종합 IC가 계산되지 않았습니다.'
    : composite > 0.03 && net != null && net > 0 ? `최근 ${rebalances ?? '—'}번의 시점에서 순위가 다음 21거래일 수익률과 약하게 같은 방향(IC ${composite.toFixed(3)})이었고 상위 20%가 하위보다 비용 후 ${net.toFixed(2)}% 앞섰습니다. 표본이 작아 우연과 구분되지는 않습니다.`
      : `최근 ${rebalances ?? '—'}번의 시점에서 순위와 이후 수익률의 관계가 확인되지 않았습니다(종합 IC ${composite.toFixed(3)}, 상위−하위 비용 후 ${net == null ? '—' : `${net.toFixed(2)}%`}). 이 실험에서 순위의 우월성이 보이지 않았다는 뜻이며, 전략이 영구히 무효라는 증명은 아닙니다.`;
  panel.append(el('p', verdict, 'briefing-read-headline'), el('p', parity, 'theme-strength-basis'));
  const labels = { momentum: '모멘텀', trend: '추세', lowvol: '저변동', kalman: '추세 속도', composite: '종합 순위' };
  const bars = el('div', null, 'scr-ic-bars');
  for (const [key, label] of Object.entries(labels)) {
    const value = finite(ic[key]);
    const line = el('div', null, 'scr-ic-row');
    const track = el('div', null, 'scr-ic-track');
    const fill = el('span', null, `scr-ic-fill ${value == null ? '' : value >= 0 ? 'is-up' : 'is-down'}`);
    if (value != null) { fill.style.width = `${Math.min(50, Math.abs(value) / 0.2 * 50).toFixed(1)}%`; fill.style[value >= 0 ? 'left' : 'right'] = '50%'; }
    track.append(fill);
    line.append(el('span', label, 'scr-ic-label'), track, el('span', value == null ? '—' : value.toFixed(3), 'scr-ic-value'));
    bars.append(line);
  }
  panel.append(bars);
  const facts = el('dl', null, 'regime-evidence');
  const add = (k, v) => facts.append(el('dt', k), el('dd', v));
  add('상위−하위 20% (21거래일)', `비용 전 ${gross == null ? '—' : `${gross.toFixed(2)}%`}, 비용 후 ${net == null ? '—' : `${net.toFixed(2)}%`} (같은 ±1 노출 기준)`);
  add('상위가 하위를 앞선 횟수', wins == null ? '—' : `${winBasis} 기준 ${rebalances}번 중 ${wins}번 — 종목별 방향 적중률이 아니라 분위 수익률 차이가 양수였던 리밸런스의 비율입니다`);
  add('표본', `미국·한국 합산 ${backtest.n ?? '—'}종목, 리밸런스 ${rebalances ?? '—'}회, 현재 종목 구성(생존 편향), 거래비용은 가정값`);
  add('검증하지 않은 요인', (backtest.modelParity?.notValidated || backtest.excludedFactors || ['size', 'value, quality']).join(', '));
  add('가중치', `${backtest.weightRegime || 'NEUTRAL'} 고정 — 국면 틸트 후보는 검증·적용되지 않음`);
  add('겹치는 근거', `${overlapSentence(currentOverlap(rows, metadata?.ranking))} 가중치는 바꾸지 않았습니다 — 겹침을 줄인 모델은 다른 모델이라 실제 순위 기록으로 따로 검증해야 합니다.`);
  panel.append(facts);
  const longrun = root?._aioFactorLongrun;
  const ref = longrun?.walkForward?.referencePeriod?.ic?.composite;
  const hold = longrun?.walkForward?.holdout?.ic?.composite ?? longrun?.walkForward?.holdoutPeriod?.ic?.composite;
  const fwd21 = longrun?.overallByHorizon?.fwd21d?.ic?.composite;
  if (longrun) {
    panel.append(el('p', `10년 연구(시가총액 상위 현재 생존 ${longrun.universe?.fullUniverseSize ?? 120}종목, 이전 모델): 21거래일 종합 IC ${fwd21 == null ? '—' : Number(fwd21).toFixed(3)}, 기준 기간 ${ref == null ? '—' : Number(ref).toFixed(3)}, 검증 기간(holdout) ${hold == null ? '—' : Number(hold).toFixed(3)}. 기간이 길어도 현재 살아남은 대형주만 담은 실험이라 검증된 전략이라고 부를 수 없습니다.`, 'theme-strength-basis'));
  }
  renderCandidateRecord(panel, el, root?._aioCandidateArchive, metadata?.populationRanking || metadata?.ranking);
}

// P1465: the forward record — what the default ranking listed each session, measured 21 of each
// stock's own sessions later. Unlike the back-test, the list was written before the outcome existed.
function renderCandidateRecord(panel, el, archive, populationRanking) {
  const box = el('section', null, 'scr-candidate-record');
  box.append(el('h3', '실제 순위 기록 — 앞으로 쌓이는 검증', 'stock-read-vis-title'));
  if (!archive || !Array.isArray(archive.entries)) { box.append(el('p', '기록 파일을 아직 받지 못했습니다.', 'theme-strength-basis')); panel.append(box); return; }
  const summary = summarizeCandidateArchive(archive);
  const measured = measuredCandidateEntries(archive, 30);
  // The record pools both markets under one identity of every market's model; compare it with the same population.
  const liveIdentity = populationRanking?.appliedFactorWeights || populationRanking?.byMarket ? buildPopulationRankingIdentity(populationRanking) : null;
  const sameModel = summary.identity && liveIdentity ? summary.identity === liveIdentity : null;
  if (!summary.recorded) {
    box.append(el('p', '첫 기록은 다음 스크리너 갱신에서 시작됩니다. 매 거래일 기본 순위의 상위·하위 20%를 먼저 적어 두고, 21거래일 뒤 실제 수익률을 채웁니다.', 'theme-strength-basis'));
  } else if (!summary.measured) {
    box.append(el('p', `${summary.firstDate}부터 ${summary.recorded}일 기록 중 — 아직 21거래일이 지난 기록이 없어 결과가 없습니다. 첫 결과는 첫 기록 후 21거래일(약 한 달) 뒤에 나옵니다.`, 'briefing-read-headline'));
  } else {
    const spread = summary.meanSpreadPct;
    const vsAll = summary.meanTopVsUniversePct;
    const ind = summary.independent;
    if (ind) {
      const ic = (stat) => (stat?.mean == null ? '—' : `${signedText(stat.mean, 3)}${stat.t != null ? ` (t ${stat.t.toFixed(1)})` : ''}`);
      const verdict = ind.decision === 'supported' ? '미국 순위가 다음 21거래일 수익률과 통계적으로 같은 방향이었습니다.'
        : ind.decision === 'not-supported' && ind.icUS?.mean < 0 && ind.icUS?.t <= -2 ? `겹치지 않는 기록 ${ind.icUS.n ?? ind.n}개로 보면 미국 순위가 이후 수익률과 오히려 반대 방향이었습니다 — 순위를 매수 후보 근거로 쓰지 마세요.`
        : ind.decision === 'not-supported' ? `겹치지 않는 기록 ${ind.icUS?.n ?? ind.n}개로 보면 미국 순위와 이후 수익률의 관계가 우연과 구분되지 않습니다 — 순위를 매수 후보 근거로 쓰지 마세요.`
          : `기간이 겹치지 않는 기록이 ${Math.min(ind.n || 0, ind.icUS?.n ?? ind.n ?? 0)}개라 판단하지 않습니다(${ind.min}개부터 판단, 약 1년).`;
      box.append(el('p', `검증 판정: ${verdict} 순위 정보계수(IC, 순위와 이후 수익률의 순위상관) — 미국 ${ic(ind.icUS)}, 한국 ${ic(ind.icKR)}.`, 'briefing-read-headline'));
    }
    box.append(el('p', `결과가 나온 ${summary.measured}일 평균: 상위 20%가 하위 20%보다 ${signedText(spread, 2)}%p, 전체 평균보다 ${signedText(vsAll, 2)}%p(21거래일, 비용 제외). 상위가 전체를 앞선 날은 ${summary.measured}일 중 ${summary.topBeatUniverse}일입니다.${summary.measured < 20 ? ' 아직 날 수가 적고 이어지는 날끼리 기간이 겹쳐, 우연과 구분할 수 없습니다.' : ' 이어지는 날끼리 21거래일 기간이 겹쳐 독립된 표본 수는 날 수보다 훨씬 적습니다.'}`, 'briefing-read-headline'));
    const bars = el('div', null, 'scr-ic-bars');
    const max = Math.max(1, ...measured.map((entry) => Math.abs(entry.outcome.topVsUniversePct || 0)));
    for (const entry of measured.slice(-12)) {
      const value = entry.outcome.topVsUniversePct;
      const line = el('div', null, 'scr-ic-row');
      const track = el('div', null, 'scr-ic-track');
      const fill = el('span', null, `scr-ic-fill ${value >= 0 ? 'is-up' : 'is-down'}`);
      fill.style.width = `${Math.min(50, Math.abs(value) / max * 50).toFixed(1)}%`;
      fill.style[value >= 0 ? 'left' : 'right'] = '50%';
      track.append(fill);
      line.append(el('span', entry.date.slice(5), 'scr-ic-label'), track, el('span', `${signedText(value, 2)}%p`, 'scr-ic-value'));
      bars.append(line);
    }
    box.append(bars, el('p', '막대 = 그날 기록한 상위 20%의 21거래일 수익률 − 같은 날 순위가 매겨진 전체 평균', 'theme-strength-basis'));
  }
  const notes = ['기본 가중 순위로 기록합니다'];
  if (sameModel === false) notes.push('지금 화면의 순위 모델(선택한 프로필의 가중치나 계산에 들어간 팩터)이 기록한 모델과 달라, 이 기록은 지금 화면 순위의 검증이 아닙니다');
  if (summary.sameModelRecorded < summary.recorded) notes.push(`모델이 바뀐 뒤의 ${summary.sameModelRecorded}일만 평균에 넣었습니다`);
  notes.push('종목마다 자기 시장의 거래일로 21일을 세고, 수정주가 기준·같은 비중·거래비용 제외입니다');
  box.append(el('p', `${notes.join(', ')}.`, 'theme-strength-basis'));
  panel.append(box);
}

function renderConditionalEvidence(documentRef, metadata) {
  const panel = documentRef.getElementById('screener-conditional-evidence-panel');
  if (!panel) return;
  panel.replaceChildren();
  const evidence = metadata?.conditionalEvidence;
  const researchContext = metadata?.researchContext || {};
  const evidenceContractValid = evidence && typeof evidence === 'object'
    && evidence.version === CONDITIONAL_EVIDENCE_VERSION
    && evidence.lineageVersion === EVIDENCE_LINEAGE_VERSION
    && evidence.decisionEligible === false
    && evidence.sample && typeof evidence.sample === 'object'
    && (evidence.lineage?.status === 'CURRENT_CANDIDATE' || evidence.status === 'NO_DATA');
  const statusLabels = {
    READY: '연구용 표시 가능',
    LOW_SAMPLE: '표본 경고',
    LOW_SAMPLE_BLOCKED: '표본 부족으로 보류',
    BLOCKED: '출처·이용 권리·거래 세션 확인 안 됨',
    NO_DATA: '검증 자료 없음'
  };
  const status = statusLabels[evidenceContractValid ? evidence.status : evidence ? 'BLOCKED' : 'NO_DATA'] || '조건별 통계 미수신';
  panel.dataset.statusCode = evidenceContractValid ? evidence.status : evidence ? 'BLOCKED' : 'NO_CONDITIONAL_EVIDENCE';
  const header = documentRef.createElement('div');
  header.className = 'scr-evidence-header';
  const title = documentRef.createElement('strong');
  title.textContent = evidence?.conditionLabel || '이 조건의 검증 자료';
  title.style.color = 'var(--text-secondary)';
  const badge = documentRef.createElement('span');
  badge.textContent = status;
  badge.className = `scr-evidence-badge ${evidence?.status === 'READY' ? 'scr-tone-up' : 'scr-tone-warn'}`;
  header.append(title, badge);
  panel.appendChild(header);
  if (!evidenceContractValid) {
    const message = documentRef.createElement('div');
    message.className = 'scr-empty-state';
    message.dataset.statusCode = evidence ? 'BLOCKED' : 'NO_CONDITIONAL_EVIDENCE';
    // Codex browser audit H47: the empty state spoke in pipeline terms (artifact, lineage, PIT). The reader is told
    // what this tab would show and why it is empty; pipeline identifiers move to the hover title.
    message.textContent = evidence ? '이 조건의 과거 통계가 검증을 통과하지 못해 표시하지 않습니다' : '이 조건의 과거 발생 빈도 통계는 아직 제공하지 않습니다';
    const detail = documentRef.createElement('div');
    detail.className = 'scr-empty-detail';
    detail.title = `파이프라인 ${researchContext.pipelineVersion || 'market-evidence-pipeline.v1'}`;
    detail.textContent = evidence
      ? '자료 버전·출처·이용 권리·거래 세션 정보가 모두 맞을 때만 통계를 보여 줍니다. 지금 스크리너 값으로 대신 계산하지 않습니다.'
      : '분 단위 가격과 거래 세션 자료가 연결되면, 같은 조건이 과거에 몇 번 나타나 몇 번 맞았는지를 표본 수와 신뢰 구간으로 보여 줍니다. 지금 스크리너 값으로 확률을 대신 계산하지 않습니다.';
    detail.title += `, lineage ${researchContext.evidenceLineageVersion || EVIDENCE_LINEAGE_VERSION}`;
    message.appendChild(detail);
    panel.appendChild(message);
    return;
  }
  const query = documentRef.createElement('div');
  query.className = 'scr-evidence-query';
  // v57.77: plain words on screen; the source ids move to the hover title (sources stay off the numbers).
  query.textContent = `조건: ${evidence.queryEcho || '조건 내용 미수신'}, 마지막 관측: ${evidence.lastObservedAt ? String(evidence.lastObservedAt).slice(0, 16).replace('T', ' ') : '—'}`;
  query.title = `자료 출처 ${evidence.lineage?.sourceIds?.join(', ') || '—'}`;
  panel.appendChild(query);
  const grid = documentRef.createElement('div');
  grid.className = 'scr-evidence-grid';
  const sample = evidence.sample || {};
  const ci = sample.confidenceInterval;
  const metricValues = [
    ['나타난 횟수', sample.trials ?? '—'],
    ['맞은 횟수', sample.successes ?? '—'],
    ['맞은 비율', sample.estimate == null ? '—' : `${(sample.estimate * 100).toFixed(1)}%`],
    ['95% 범위', ci ?`${(ci.low * 100).toFixed(1)}~${(ci.high * 100).toFixed(1)}%` : '—']
  ];
  metricValues.forEach(([label, value]) => {
    const card = documentRef.createElement('div');
    card.className = 'scr-evidence-card';
    const name = documentRef.createElement('div');
    name.textContent = label;
    name.className = 'scr-evidence-label';
    const result = documentRef.createElement('strong');
    result.textContent = String(value);
    result.className = 'scr-evidence-result';
    card.append(name, result);
    grid.appendChild(card);
  });
  panel.appendChild(grid);
  const details = documentRef.createElement('div');
  details.className = 'scr-evidence-details';
  const stability = evidence.stability || {};
  const recency = evidence.recency || {};
  const distribution = evidence.distribution || {};
  // v57.77: plain Korean on screen; the pipeline identifiers (lineage status, rights/calendar ids, allowed use) go to the hover title.
  details.textContent = `앞·뒤 절반 기간의 결과가 비슷한지 ${stability.status || '—'}${stability.intervalOverlap == null ? '' : `, 두 기간의 범위 겹침 ${stability.intervalOverlap ? '예' : '아니오'}`}, 최근 나타난 횟수 ${recency.trials ?? '—'}, 최근 맞은 비율 ${recency.estimate == null ? '—' : `${(recency.estimate * 100).toFixed(1)}%`}, 맞은 경우의 결과 하위 25%/중앙/상위 25% ${[distribution.p25, distribution.median, distribution.p75].map((value) => value == null ? '—' : Number(value).toFixed(3)).join(' / ')}, 제외 ${evidence.excludedObservationCount ?? 0}건`;
  panel.appendChild(details);
  const boundary = documentRef.createElement('div');
  boundary.className = 'scr-evidence-boundary';
  boundary.textContent = `참고용 통계, ${evidence.blockedReasons?.length ? `보류 사유 ${evidence.blockedReasons.length}건` : evidence.lineage?.status === 'CURRENT_CANDIDATE' ? '자료 출처·이용 권리·거래 세션 확인됨' : '자료 출처 확인 전'}`;
  // v57.79: lineage tokens are machine metadata, not reader text ([title] becomes a visible basis card).
  boundary.dataset.aioLineage = `${evidence.lineage?.status || 'LINEAGE_UNCONFIRMED'}, 권리 ${evidence.lineage?.rightsIds?.join(', ') || '미확인'}, 캘린더 ${evidence.lineage?.calendarIds?.join(', ') || '미확인'}, ${evidence.allowedUse || 'reference-only'}${evidence.blockedReasons?.length ? `, ${evidence.blockedReasons.join(', ')}` : ''}`;
  panel.appendChild(boundary);
  const disclaimer = documentRef.createElement('div');
  disclaimer.className = 'scr-evidence-disclaimer';
  disclaimer.textContent = evidence.disclaimer || CONDITIONAL_EVIDENCE_DISCLAIMER;
  panel.appendChild(disclaimer);
}

function getVisibleColumns(columnPreset, customColumns = []) {
  const keys = columnPreset === 'custom' ? customColumns : (COLUMN_PRESETS[columnPreset] || COLUMN_PRESETS.discovery);
  const byKey = new Map(SCREENER_COLUMN_REGISTRY.map((column) => [column.key, column]));
  return keys.map((key) => byKey.get(key)).filter(Boolean);
}

// UI review 2026-10-18: every row repeated "10/16 종가" under its price. The day most rows share moves to the 가격 header
// (and the phone card label); a row whose close is from another day keeps its own note, so a stale price still shows its date.
function shareCloseDay(documentRef, table, body) {
  const notes = [...body.querySelectorAll('.scr-close-note')];
  const counts = new Map();
  notes.forEach((note) => { if (note.dataset.closeDay) counts.set(note.dataset.closeDay, (counts.get(note.dataset.closeDay) || 0) + 1); });
  const common = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  notes.forEach((note) => { note.hidden = !!common && note.dataset.closeDay === common; });
  body.querySelectorAll('td[data-column-key="price"]').forEach((td) => { td.dataset.label = common ? `가격, ${common} 종가` : '가격'; });
  const header = table?.querySelector('th[data-column-key="price"]');
  if (!header) return;
  let tag = header.querySelector('.scr-head-note');
  if (!common) { tag?.remove(); return; }
  if (!tag) {
    tag = documentRef.createElement('small');
    tag.className = 'scr-head-note';
    header.querySelector('.scr-sort-btn')?.after(tag);
  }
  tag.textContent = `${common} 종가`;
}

function renderTableHeader(documentRef, table, visibleColumns, sortState) {
  const thead = table?.querySelector('thead');
  if (!thead) return;
  const row = documentRef.createElement('tr');
  row.className = 'scr-registry-header';
  let stickyLeft = 0;
  visibleColumns.forEach((column) => {
    const th = documentRef.createElement('th');
    th.scope = 'col';
    th.dataset.columnKey = column.key;
    th.className = `scr-column-header${column.sticky ? ' scr-column-sticky' : ''}`;
    th.style.textAlign = column.align;
    th.style.minWidth = `${column.width}px`;
    // v57.54: jargon columns carry a one-line explanation on hover.
    if (column.hint) th.title = column.hint;
    const fwdCoverage = column.key === 'fwdPe' ? consensusRoot?._aioConsensusEstimates?.coverage : null; // v57.55 E1-01
    if (fwdCoverage?.universeUs) th.title = `${th.title}, 수집 ${fwdCoverage.covered}/${fwdCoverage.universeUs}종목`;
    // v57.61 WCAG 1.3.1: hover-only hints are also exposed to keyboard and screen-reader users via aria-describedby.
    let hintId = '';
    if (th.title) {
      hintId = `scr-col-hint-${column.key}`;
      const hint = documentRef.createElement('span');
      hint.id = hintId;
      // hidden: not part of the header's own name (cells stay short), still read as the description it is pointed at.
      hint.hidden = true;
      hint.textContent = th.title;
      th.appendChild(hint);
    }
    if (column.sticky) th.style.left = `${stickyLeft}px`;
    if (column.sortable) {
      const button = documentRef.createElement('button');
      button.type = 'button';
      // v58.56: a column can sort by another key (시총 순서 → mcap) and show a short header ('#') while its name stays whole.
      const sortKeyName = column.sortAs || column.key;
      button.dataset.scrSort = sortKeyName;
      button.className = 'scr-sort-btn';
      button.textContent = column.headerLabel || column.label;
      button.dataset.sortLabel = column.label;
      const arrow = documentRef.createElement('span');
      arrow.className = 'scr-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      button.appendChild(arrow);
      const active = sortState.column === sortKeyName;
      button.setAttribute('aria-label', active ? `${column.label} 정렬 ${sortState.ascending ? '오름차순' : '내림차순'}` : `${column.label}로 정렬`);
      if (hintId) button.setAttribute('aria-describedby', hintId);
      th.setAttribute('aria-sort', active ? (sortState.ascending ? 'ascending' : 'descending') : 'none');
      th.prepend(button);
    } else {
      th.prepend(column.label);
      if (hintId) th.setAttribute('aria-describedby', hintId);
    }
    if (column.researchOnly) {
      const note = documentRef.createElement('span');
      note.className = 'scr-research-mark';
      note.textContent = ' 연구';
      th.appendChild(note);
    }
    row.appendChild(th);
    if (column.sticky) stickyLeft += column.width;
  });
  thead.replaceChildren(row);
  table.dataset.aioColumnRegistry = 'screener-column-registry.v1';
  table.dataset.aioVisibleColumnCount = String(visibleColumns.length);
}

function renderColumnChooser(documentRef, page, columnPreset, customColumns, onChange) {
  const chooser = documentRef.getElementById('scr-column-chooser');
  if (!chooser) return;
  const list = documentRef.getElementById('scr-column-chooser-list');
  if (!list) return;
  list.replaceChildren();
  SCREENER_COLUMN_REGISTRY.forEach((column) => {
    const label = documentRef.createElement('label');
    label.className = 'scr-column-choice';
    const checkbox = documentRef.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = (columnPreset === 'custom' ? customColumns : getVisibleColumns(columnPreset).map((item) => item.key)).includes(column.key);
    checkbox.dataset.aioScreenerColumn = column.key;
    checkbox.addEventListener('change', () => {
      const next = new Set(columnPreset === 'custom' ? customColumns : getVisibleColumns(columnPreset).map((item) => item.key));
      if (checkbox.checked) next.add(column.key); else next.delete(column.key);
      if (!next.has('sym')) next.add('sym');
      onChange?.([...next]);
    });
    const name = documentRef.createElement('span');
    name.textContent = column.label;
    label.append(checkbox, name);
    list.appendChild(label);
  });
  if (chooser.dataset.aioInitialized !== 'true') {
    chooser.hidden = true;
    chooser.dataset.aioInitialized = 'true';
  }
}

// v58.56 (4b): the phone's 필터 button names how many display filters are set ('실행 통과만' counts only when switched off).
function syncFilterCount(documentRef) {
  const badge = documentRef.getElementById('scr-filter-count');
  if (!badge) return;
  const active = Object.keys(FILTER_LABELS).filter((id) => {
    const control = documentRef.getElementById(id);
    if (!control) return false;
    if (id === 'scr-passed-only') return !control.checked;
    if (control.type === 'checkbox') return control.checked;
    const value = String(control.value || '').trim();
    return !!value && !(id === 'scr-min-rank' && value === '0');
  }).length;
  badge.hidden = !active;
  badge.textContent = active ? ` ${active}` : '';
  badge.closest('button')?.setAttribute('aria-label', active ? `필터 ${active}개 적용됨 — 필터 열기` : '필터 열기');
}

function renderFilterChips(documentRef) {
  const container = documentRef.getElementById('scr-active-filter-chips');
  if (!container) return;
  container.replaceChildren();
  const controls = Object.keys(FILTER_LABELS).map((id) => documentRef.getElementById(id)).filter(Boolean);
  const active = controls.flatMap((control) => {
    const rawValue = control.type === 'checkbox' ? (control.checked ? '적용' : '') : String(control.value || '').trim();
    const value = control.id === 'scr-min-rank' && rawValue === '0' ? '' : rawValue;
    if (!value) return [];
    return [{ id: control.id, label: FILTER_LABELS[control.id], value }];
  });
  if (!active.length) {
    const empty = documentRef.createElement('span');
    empty.className = 'scr-chip-empty';
    empty.textContent = '표시 필터 없음 — 표는 전체 범위를 보여줍니다';
    container.appendChild(empty);
  } else {
    active.forEach(({ id, label, value }) => {
      const chip = documentRef.createElement('button');
      chip.type = 'button';
      chip.className = 'scr-filter-chip';
      chip.dataset.aioScreenerAction = 'clear-filter';
      chip.dataset.aioScreenerArg = id;
      chip.setAttribute('aria-label', `표시 필터 ${label} ${value} 제거 (표 범위만)`);
      chip.textContent = `${label}: ${value} ×`;
      container.appendChild(chip);
    });
  }
  const count = documentRef.getElementById('scr-active-filter-count');
  if (count) count.textContent = String(active.length);
}

function renderBuilderConditions(documentRef, conditions = []) {
  const list = documentRef.getElementById('scr-builder-condition-list');
  if (!list) return;
  list.replaceChildren();
  if (!conditions.length) {
    const empty = documentRef.createElement('span');
    empty.className = 'scr-builder-empty';
    empty.textContent = '실행 조건(순위·RSI·3개월 수익률)을 추가하면 이곳에 표시되고 실행 정의에 포함됩니다. 섹터·분류·검색은 표시 필터로만 표 범위를 바꿉니다.';
    list.appendChild(empty);
    return;
  }
  conditions.forEach((condition, index) => {
    const chip = documentRef.createElement('button');
    chip.type = 'button';
    chip.className = 'scr-filter-chip';
    chip.dataset.aioScreenerAction = 'remove-builder-condition';
    chip.dataset.aioScreenerArg = String(index);
    chip.setAttribute('aria-label', `실행 조건 ${condition.label} ${condition.value} 제거 (실행 정의 변경)`);
    chip.textContent = `${condition.label}: ${condition.value} ×`;
    list.appendChild(chip);
  });
}

// P1165 (12 W12-A / 19 작업 카드): 선택된 정의의 내장 조건과 사용자가 추가한 조건을 같은 계약으로
// 읽는다. 프리셋은 filtersAST에 조건을 내장하므로 DOM 컨트롤만 세면 '활성조건 없음'으로 오표시된다.
const FILTER_FIELD_LABELS = new Map(SCREENER_FIELD_REGISTRY.fields.map(field => [field.fieldId, field.label || field.fieldId]));
function describeFilterAst(definition) {
  const ast = definition?.filtersAST;
  if (!ast) return { builtin: [], user: [] };
  const nodes = ast.type === 'and' || ast.type === 'or' ? (ast.children || []) : [ast];
  const described = nodes.map((node) => {
    if (!node || typeof node !== 'object') return null;
    const label = FILTER_FIELD_LABELS.get(node.field) || node.field || node.type;
    let text;
    if (node.type === 'range') {
      const parts = [];
      if (node.min != null) parts.push(`≥ ${node.min}`);
      if (node.max != null) parts.push(`≤ ${node.max}`);
      text = `${label} ${parts.join(', ') || '범위 미지정'}`;
    } else if (node.type === 'enum') text = `${label} ∈ ${(node.values || []).join('·')}`;
    else if (node.type === 'exists') text = `${label} 존재`;
    // v58.64 (SCR01 class): a NOT node carries `child`, not `children`, so it read "NOT 하위 조건 0개".
    else if (node.type === 'not') text = node.child && typeof node.child === 'object' ? `제외: ${FILTER_FIELD_LABELS.get(node.child.field) || node.child.field || node.child.type} 조건` : '제외 조건(내용 없음)';
    else if (node.type === 'and' || node.type === 'or') text = `${String(node.type).toUpperCase()} 하위 조건 ${(node.children ? node.children.length : 0)}개`;
    else text = `${label} (${node.type})`;
    return { label, text, origin: node.origin || null };
  }).filter(Boolean);
  return {
    builtin: described.filter(item => item.origin !== 'visual-builder'),
    user: described.filter(item => item.origin === 'visual-builder')
  };
}

// LC-25: the funnel used to stack two different populations side by side with no denominator:
// the executed judgment ("조건 통과 342 / 데이터 부족 29", out of the run's rowCount) and the
// table's display scope ("현재 필터 결과 873", the current UI filter). Users read 342 and 873 as
// one set. Both denominators are now explicit and bound to the run that produced them.
function renderFunnel(documentRef, { universe = 0, ready = 0, passed = 0, unavailable = 0, filtered = 0, runRowCount = null, runId = null, origin = null, passedOnly = false } = {}) {
  const values = { 'scr-funnel-universe': universe, 'scr-funnel-ready': ready, 'scr-funnel-passed': passed, 'scr-funnel-unavailable': unavailable, 'scr-funnel-filtered': filtered };
  Object.entries(values).forEach(([id, value]) => {
    const node = documentRef.getElementById(id);
    if (node) node.textContent = String(value ?? 0);
  });
  const runRow = finite(runRowCount);
  const denominator = runRow != null && runRow > 0 ? `/${runRow}` : '';
  const setText = (id, text) => { const node = documentRef.getElementById(id); if (node) node.textContent = text; };
  setText('scr-funnel-passed-denom', denominator);
  setText('scr-funnel-unavailable-denom', denominator);
  const readyLabel = documentRef.getElementById('scr-funnel-ready')?.previousElementSibling;
  if (readyLabel) readyLabel.textContent = '필수 자료 있는 종목';
  const executed = !!runId;
  const originLabel = origin === 'user' ? '사용자 실행'
    : origin === 'pipeline' ? '파이프라인 실행'
      : origin === 'preview' ? '미리보기(아직 고정 전)' : null;
  setText('scr-funnel-runid', executed
    ? `실행 기록${originLabel ? `, ${originLabel}` : ''}`
    : '실행 전');
  const runNode = documentRef.getElementById('scr-funnel-runid'); // v57.55 review (S1-F8): the run id stays in the hover, off the face
  if (runNode) runNode.title = executed ? `실행 ID ${String(runId)}` : '';
  const scope = documentRef.getElementById('scr-funnel-scope-note');
  if (scope) {
    scope.textContent = executed
      // Codex browser audit H43: one line says why the table count differs from the run's pass count.
      ? `실행 조건 통과 ${passed}종목(대상 ${runRow != null ? runRow : '미확인'}, 조건 판단 자료 부족 ${unavailable}) — 저장·재실행·검증은 이 ${passed}종목 기준입니다. ${passedOnly ? `표에는 그중 ${filtered}행이 보입니다${filtered < passed ? '(섹터·검색 같은 표시 필터 적용)' : ''}.` : `표에는 탈락·데이터 부족 종목까지 포함한 ${filtered}행이 보입니다 — 통과 종목만 보려면 ‘실행 통과만’을 켭니다.`}`
      : '실행 전 — 조건을 실행하면 비교 기준 종목 수가 정해집니다. 표시 범위는 현재 필터 결과입니다.';
  }
}

// v57.81: 종목 범위 control text and the one-line notes for what stays core-only. The option counts come from the rows
// that arrived (기본 = this market's core rows; 확장 = the shard's rows, remembered from the last load).
function syncUniverseScopeControl(documentRef, root, state, listingMarket) {
  const select = documentRef.getElementById('scr-universe-scope');
  if (!select) return;
  const metadata = state?.metadata || {};
  const extended = metadata.extended || null;
  const rows = Array.isArray(state?.rows) ? state.rows : [];
  const coreCount = rows.filter((row) => screenerMarket(row) === 'US' && row.universeTier !== 'extended').length;
  const extendedCount = extended?.status === 'loaded' ? rememberExtendedCount(root, extended.rows) : rememberExtendedCount(root);
  const [coreOption, extendedOption] = select.options;
  if (coreOption) coreOption.textContent = coreCount ? `기본 (${coreCount}종목)` : '기본';
  if (extendedOption) extendedOption.textContent = `확장 — 러셀2000·나스닥 전체${extendedCount ? ` (+${extendedCount})` : ''}`;
  const wrap = select.closest('label');
  if (wrap) wrap.hidden = listingMarket !== 'US';
  // The select is the reader's request; metadata says what has arrived (it lags while the shard downloads).
  const requested = select.value;
  const status = documentRef.getElementById('scr-universe-status');
  if (status) {
    const session = extended?.factorSessionDateByMarket?.US;
    status.textContent = requested !== 'extended' || listingMarket !== 'US' ? ''
      : extended?.status === 'loaded' ? `확장 ${extended.rows}종목 포함, 가격 자료 ${session ? `${session.slice(5).replace('-', '/')} 종가` : '세션 미확인'}${extended.unfetched ? `, 가격 미수신 ${extended.unfetched}` : ''}${Number.isFinite(extended.fundamentalCoveragePct) ? `, 재무 자료 ${extended.fundamentalCoveragePct}%` : ''}`
        : extended?.status === 'deferred' || !extended ? '확장 종목을 불러오는 중입니다'
          : '확장 종목 파일을 받지 못해 기본 범위로 표시합니다';
    status.hidden = !status.textContent;
  }
  const coreOnly = metadata.universeScope === 'extended';
  for (const tabId of ['scr-tab-backtest', 'scr-tab-evidence']) {
    const tab = documentRef.getElementById(tabId);
    if (!tab) continue;
    let note = tab.querySelector(':scope > .scr-core-only-note');
    if (!note && coreOnly) {
      note = documentRef.createElement('p');
      note.className = 'scr-core-only-note';
      tab.prepend(note);
    }
    if (note) {
      note.textContent = coreOnly ? `확장 범위를 골라도 이 탭의 검증·기록은 기본 유니버스(${metadata.coreUniverseRows || '—'}종목)만 다룹니다.` : '';
      note.hidden = !coreOnly;
    }
  }
}

// Filter and sort results are reused while their inputs stay the same: the same row array, the same control values and
// sort order. A text search (it also reads the name registries) and a Forward PER condition or column (estimates load
// later) are not tracked here, so those always recompute; price and 시총 sorts read live quotes and do too.
const FILTER_CONTROL_IDS = ['scr-listing-market', 'scr-market', 'scr-sector', 'scr-cap', 'scr-text-search', 'scr-min-rank', 'scr-rsi-min', 'scr-rsi-max', 'scr-min-mom', 'scr-setup', 'scr-custom-conditions'];
const LIVE_SORT_COLUMNS = new Set(['price', 'mcap', 'fwdPe']);
let filterCache = null;
let sortCache = null;
function filterAndSortRows(rows, documentRef, { readWatchlist, readAliases, sortState, readLiveData }) {
  const values = FILTER_CONTROL_IDS.map((id) => selectedValue(documentRef, id));
  const watchlistOnly = !!documentRef.getElementById('scr-watchlist-only')?.checked;
  const passedOnly = !!documentRef.getElementById('scr-passed-only')?.checked;
  const trackedFilter = !values[4].trim() && !parseConditionValue(values[10]).some((item) => item.id === 'fwdpe-max');
  const filterKey = [...values, watchlistOnly, passedOnly, watchlistOnly ? (readWatchlist?.() || []).join(',') : ''].join('\u0001');
  let filtered;
  if (trackedFilter && filterCache?.rows === rows && filterCache.key === filterKey) filtered = filterCache.result;
  else {
    filtered = filterRows(rows, documentRef, { readWatchlist, readAliases });
    filterCache = trackedFilter ? { rows, key: filterKey, result: filtered } : null;
  }
  const { column, ascending } = sortState;
  if (!LIVE_SORT_COLUMNS.has(column) && sortCache?.filtered === filtered && sortCache.column === column && sortCache.ascending === ascending) return sortCache.result;
  const sorted = sortRows(filtered, column, ascending, readLiveData);
  sortCache = LIVE_SORT_COLUMNS.has(column) ? null : { filtered, column, ascending, result: sorted };
  return sorted;
}

// A table row keeps its node while everything it shows is unchanged: the same row object, columns, selection, compare
// and watchlist marks, rank hold, live quote fields and (with the Forward PER column) estimate. A re-render that changes
// nothing then leaves the table alone, so focus, hover and a click in flight are not lost to a rebuilt row.
const tableRowCache = new WeakMap();
function tableRowInputs(row, { readLiveData, readWatchlist, selectedSymbols, compareSymbols, visibleColumns, rankHold, capOrder }, columnsKey) {
  const symbol = row.sym || row.symbol;
  const live = readLiveData?.()?.[row.sym] || {};
  const inputs = [row, columnsKey, !!selectedSymbols?.has(symbol), !!compareSymbols?.has(row.sym), (readWatchlist?.() || []).includes(row.sym), rankHold ? `hold:${rankHold.reason}` : '',
    live.currency, live.marketCapCurrency, live.price, live.marketCap, live.observedAt, live.ts, live.source, live.revision, capOrder?.get(symbol) ?? null];
  if (visibleColumns.some((column) => column.key === 'fwdPe')) {
    const estimates = consensusRoot?.[CONSENSUS_KEY];
    inputs.push(estimates, consensusRowFor(consensusRoot, symbol), estimates?.coverage?.covered, estimates?.coverage?.universeUs);
  }
  // v58.75: the RS percentiles come from the whole dataset and the theme stages from the scenario state, not the row.
  if (visibleColumns.some((column) => column.key === 'rs6m' || column.key === 'rs12m')) inputs.push(currentRsPercentiles.get(symbol));
  if (visibleColumns.some((column) => column.key === 'themeStage')) inputs.push(themeStageRoot?._aioScenarioState, themeStageRows);
  return inputs;
}
function tableRowNodes(documentRef, body, rows, options) {
  const columnsKey = options.visibleColumns.map((column) => `${column.key}:${column.label}:${column.align}:${column.width}:${column.sticky ? 1 : 0}`).join('|');
  let cache = tableRowCache.get(body);
  // A new mount brings new handlers; rows built with the old ones are not reused.
  if (!cache || cache.owner !== options.onExplain) cache = { owner: options.onExplain, bySymbol: new Map() };
  const next = new Map();
  const nodes = rows.map((row) => {
    const inputs = tableRowInputs(row, options, columnsKey);
    const key = row.sym || row.symbol || '';
    const kept = cache.bySymbol.get(key);
    const node = kept && !next.has(key) && kept.inputs.length === inputs.length && kept.inputs.every((value, index) => Object.is(value, inputs[index]))
      ? kept.node
      : createTableRow(documentRef, row, options);
    if (!next.has(key)) next.set(key, { node, inputs });
    return node;
  });
  tableRowCache.set(body, { owner: cache.owner, bySymbol: next });
  return nodes;
}

// v58.56 (#3): the market-cap order of the rows the table holds (1 = largest). Rows without a cap get no number.
function capOrderMap(rows, readLiveData) {
  const order = new Map();
  rows.map((row) => ({ symbol: row.sym || row.symbol, cap: capFilterValue(liveRow(row, readLiveData)) }))
    .filter((entry) => entry.symbol && entry.cap != null)
    .sort((left, right) => right.cap - left.cap)
    .forEach((entry, index) => order.set(entry.symbol, index + 1));
  return order;
}

// v58.56 (#3): AMZN·GOOGL·META were silently absent because they failed the chosen screen. The line above the table
// names the screen, the count and the order, and lists the largest caps the screen left out with the condition each
// failed (the row's own value against the threshold — no new numbers).
const DROPPED_CAP_POOL = 20;
function screenLeaves(node) {
  if (!node || typeof node !== 'object') return [];
  if (node.type === 'and' || node.type === 'or') return (node.children || []).flatMap(screenLeaves);
  return node.type === 'not' ? [] : [node];
}
function screenFieldValue(row, field) {
  if (field === 'rank' || field === 'score') return row?.[field] ?? null;
  const rowKey = SCREENER_FIELD_REGISTRY.get(field)?.rowKey;
  if (rowKey && row?.[rowKey] != null) return row[rowKey];
  return row?.fieldReadiness?.fields?.[field]?.value ?? null;
}
function screenFieldLabel(field) {
  return field === 'rank' ? '백분위' : FILTER_FIELD_LABELS.get(field) || field;
}
function failedConditionText(row, definition, compiled) {
  if (row.screenStatus === 'unavailable') {
    const missing = [...new Set((row.rankExplanation?.missingEvidence || []).map(screenFieldLabel))];
    return missing.length ? `판단 자료 부족 — ${missing.slice(0, 3).join('·')}` : '판단 자료 부족';
  }
  const leaves = [...(definition?.hardGates || []), ...screenLeaves(definition?.filtersAST)];
  const failed = compiled ? leaves.filter((node) => compiled.evaluateGate(row, node).state === 'fail') : [];
  if (!failed.length) return '조건 미충족';
  return failed.map((node) => {
    const label = screenFieldLabel(node.field);
    const value = screenFieldValue(row, node.field);
    const unit = ({ percent: '%', ratio: '배', multiple: '배' })[SCREENER_FIELD_REGISTRY.get(node.field)?.unit] || '';
    const word = (item) => (node.field === 'technical.vcpStage' ? vcpStageLabel(item) : item);
    const shown = finite(value) != null ? `${numberText(value, Number.isInteger(value) ? 0 : 1)}${unit}` : value != null ? word(value) : '—';
    if (node.type === 'enum') return `${label} ${shown} — 기준 ${(node.values || []).map(word).join('·')}`;
    const bounds = [node.min != null ? `${node.min}${unit} 이상` : null, node.max != null ? `${node.max}${unit} 이하` : null].filter(Boolean).join(', ');
    return `${label} ${shown} — 기준 ${bounds || '범위'}`;
  }).join(' / ');
}
function sortOrderText(sortState) {
  const { column, ascending } = sortState || {};
  if (column === 'mcap') return ascending ? '시총 작은 순' : '시총 큰 순';
  if (column === 'screenRank') return '조건 순위 순';
  if (column === 'sym' || column === 'sector') return `${column === 'sym' ? '종목' : '섹터'} 이름 순`;
  const label = SCREENER_COLUMN_REGISTRY.find((item) => item.key === column)?.label || column;
  return `${label} ${ascending ? '낮은 순' : '높은 순'}`;
}
let tableStatusCompiled = { definition: null, compiled: null };
function renderTableStatus(documentRef, { status, scopeRows, filtered, definition, sortState, passedOnly, readLiveData, onExplain }) {
  const host = documentRef.getElementById('scr-table-status');
  if (!host) return;
  if (status === 'unavailable' || !scopeRows.length) { host.hidden = true; return; }
  host.hidden = false;
  const passed = scopeRows.filter((row) => row.screenStatus === 'passed').length;
  // The phone line uses the screen's one-word name (균형) so the line and its 빠진 대형주 link fit one row.
  const leadFor = (name, conditionWord) => (passedOnly
    ? `${name}${conditionWord} 통과 ${passed}종목${filtered.length !== passed ? ` 중 ${filtered.length}종목 표시` : ''}`
    : `${name} 기준 ${scopeRows.length}종목 전체(통과 ${passed})${filtered.length !== scopeRows.length ? ` 중 ${filtered.length}종목 표시` : ''}`);
  const fullName = definition?.name || '선택 조건';
  const shortName = PRESET_SHORT_LABELS[definition?.screenId] || fullName;
  let textNode = host.querySelector('.scr-table-status-text');
  if (!textNode) {
    textNode = documentRef.createElement('span');
    textNode.className = 'scr-table-status-text';
    const full = documentRef.createElement('span');
    full.className = 'scr-status-full';
    const short = documentRef.createElement('span');
    short.className = 'scr-status-short';
    short.setAttribute('aria-hidden', 'true');
    textNode.append(full, short);
    host.prepend(textNode);
  }
  // A market-cap order over rows without caps (the Korean listing has none in the artifact) says so instead of '시총 큰 순'.
  let order = sortOrderText(sortState);
  let shortOrder = order;
  if (sortState?.column === 'mcap') {
    const withCap = filtered.filter((row) => capFilterValue(liveRow(row, readLiveData)) != null).length;
    if (!withCap) order = shortOrder = '시총 자료 없음, 조건 순위 순';
    else if (withCap < filtered.length) order = `${order}(시총 확인 ${withCap}종목 먼저)`;
    // v58.80 (first-users F21, owner-delegated 2026-10-26): the default stays market cap — leading with an order the
    // back-test cannot yet tell from chance would read as a recommendation — and the line now says so.
    const validation = documentRef.getElementById('scr-validation-banner')?.dataset?.validationState;
    if (withCap && !sortState.ascending && validation !== 'favorable') order = `${order} — 순위가 우연과 구별되지 않아 기본은 시총 순, 전체 순위 머리글을 누르면 순위 순`;
  }
  // v58.56 review: quote refreshes re-render the table, so the text is written only when it changes.
  const fullText = `${leadFor(fullName, ' 조건')}, ${order}`;
  const shortText = `${leadFor(shortName, '')}, ${shortOrder}`;
  if (textNode.firstChild.textContent !== fullText) textNode.firstChild.textContent = fullText;
  if (textNode.lastChild.textContent !== shortText) textNode.lastChild.textContent = shortText;
  // The largest caps of this market (funds and SPACs aside) that the screen left out — only while the table hides them.
  let dropped = [];
  if (passedOnly && definition) {
    if (tableStatusCompiled.definition !== definition) {
      let compiled = null;
      try { compiled = compileScreenDefinition(definition); } catch (_) { compiled = null; }
      tableStatusCompiled = { definition, compiled };
    }
    dropped = scopeRows
      .filter((row) => !['fund', 'spac'].includes(row?.populationExclusion) && row?.assetType !== 'ETF' && row?.index !== 'ETF')
      .map((row) => ({ row, cap: capFilterValue(liveRow(row, readLiveData)) }))
      .filter((entry) => entry.cap != null)
      .sort((left, right) => right.cap - left.cap)
      .slice(0, DROPPED_CAP_POOL)
      .filter((entry) => entry.row.screenStatus !== 'passed')
      .map((entry) => ({ row: entry.row, reason: failedConditionText(entry.row, definition, tableStatusCompiled.compiled) }));
  }
  let back = host.querySelector('.scr-passed-back');
  if (!passedOnly && definition) {
    if (!back) {
      back = documentRef.createElement('button');
      back.type = 'button';
      back.className = 'sx-link scr-passed-back';
      back.dataset.aioScreenerAction = 'passed-only';
      back.textContent = '통과 종목만 보기';
      host.append(back);
    }
  } else back?.remove();
  let fold = host.querySelector('.scr-dropped');
  if (!dropped.length) { fold?.remove(); return; }
  if (!fold) {
    fold = documentRef.createElement('details');
    fold.className = 'scr-dropped';
    fold.append(documentRef.createElement('summary'), documentRef.createElement('ul'), documentRef.createElement('p'));
    host.append(fold);
  }
  const summary = fold.querySelector('summary');
  if (summary.dataset.count !== String(dropped.length)) {
    summary.dataset.count = String(dropped.length);
    const summaryFull = documentRef.createElement('span');
    summaryFull.className = 'scr-status-full';
    summaryFull.textContent = `조건에서 빠진 대형주 ${dropped.length}개 보기`;
    const summaryShort = documentRef.createElement('span');
    summaryShort.className = 'scr-status-short';
    summaryShort.setAttribute('aria-hidden', 'true');
    summaryShort.textContent = `빠진 대형주 ${dropped.length}개`;
    summary.replaceChildren(summaryFull, summaryShort);
  }
  const signature = JSON.stringify(dropped.map((entry) => [entry.row.sym || entry.row.symbol, entry.reason]));
  if (fold.dataset.signature === signature && fold._aioOwner === onExplain) return;
  fold.dataset.signature = signature;
  fold._aioOwner = onExplain;
  const list = fold.querySelector('ul');
  list.className = 'scr-dropped-list';
  list.replaceChildren(...dropped.map(({ row, reason }) => {
    const item = documentRef.createElement('li');
    const open = documentRef.createElement('button');
    open.type = 'button';
    open.className = 'scr-dropped-sym';
    const code = documentRef.createElement('b');
    code.textContent = row.sym || row.symbol;
    const label = documentRef.createElement('span');
    label.textContent = row.name || '';
    open.append(code, label);
    open.setAttribute('aria-label', `${row.sym || row.symbol} 근거 보기`);
    open.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); onExplain?.(row); });
    const why = documentRef.createElement('span');
    why.className = 'scr-dropped-why';
    why.textContent = reason;
    item.append(open, why);
    return item;
  }));
  const note = fold.querySelector('p');
  note.className = 'scr-dropped-note';
  const showAll = documentRef.createElement('button');
  showAll.type = 'button';
  showAll.className = 'sx-link scr-dropped-all';
  showAll.dataset.aioScreenerAction = 'clear-filter';
  showAll.dataset.aioScreenerArg = 'scr-passed-only';
  showAll.textContent = '통과 못 한 종목도 표에 함께 보기';
  note.replaceChildren(documentRef.createTextNode(`이 시장 시총 상위 ${DROPPED_CAP_POOL}개 중 지금 조건 화면을 통과하지 못한 종목입니다. `), showAll);
}

function render({ documentRef, root = globalThis, store, readLiveData, readWatchlist, readAliases, sortState, visibleLimit, onWatchlistToggle, onExplain, onCompare, onVisibleSymbols, selectedSymbols, compareSymbols, columnPreset = 'discovery', customColumns = [], rowsOverride = null, workbenchResult = null, previewResult = null, onDataChange = null }) {
  const rawState = selectScreenerState(store?.getState?.() || {});
  const listingMarket = selectedValue(documentRef, 'scr-listing-market') || 'US';
  const currentState = { ...rawState, metadata: { ...rawState?.metadata, populationRanking: rawState?.metadata?.ranking || null, ranking: marketRankingMetadata(rawState?.metadata, listingMarket) } };
  const sourceState = workbenchResult?.run ? { ...currentState, metadata: workbenchResult.snapshotMetadata || {}, status: 'partial', lastRun: workbenchResult.run, readiness: workbenchResult.readiness } : currentState;
  const state = { ...sourceState, metadata: { ...sourceState.metadata, selectionMarket: listingMarket, ranking: marketRankingMetadata(sourceState.metadata, listingMarket) } };
  // P1165: 실행 전에는 파이프라인 기본 결과가 아니라 **선택한 정의**의 미리보기를 표시한다.
  const preview = workbenchResult?.run ? null : previewResult;
  const page = documentRef?.getElementById('page-screener');
  if (!page) return;
  const rows = rowsOverride || state?.rows || [];
  syncScreenerControlAvailability(documentRef, { rows: currentState.rows || [], listingMarket, ranking: currentState.metadata.ranking, profiles: root?.AIO_TRADER_PROFILES || null });
  // v58.75 (persona review): RS percentiles over the whole loaded set (before display filters) and the theme-stage inputs.
  currentRsPercentiles = marketReturnPercentiles(rows);
  themeStageRoot = root;
  themeStageRows = currentState.rows || rows;
  const filtered = filterAndSortRows(rows, documentRef, { readWatchlist, readAliases, sortState, readLiveData });
  const chosenDefinition = workbenchResult?.definition || preview?.definition || state?.screenDefinition;
  const presetOrder = documentRef.getElementById('scr-order')?.querySelector('option[value="screenRank"]');
  if (presetOrder && chosenDefinition?.ranking) {
    const ranking = chosenDefinition.ranking;
    const field = SCREENER_FIELD_REGISTRY.get(ranking.field);
    presetOrder.textContent = `조건 순위, ${field?.label || field?.name || (ranking.field === 'rank' ? '선택 비중의 팩터 백분위' : ranking.field)} ${ranking.direction === 'asc' ? '낮은 순' : '높은 순'}`;
  }
  // v57.55 review (E1-06): 밸류·퀄리티 stay switched off until fundamentals cover enough of the universe, so the columns were
  // '—' on every row. A factor column with no score in any row is left out instead of shown empty.
  const scored = (key) => rows.some((row) => finite(row?.factorScores?.[key]) != null);
  const visibleColumns = getVisibleColumns(columnPreset, customColumns).filter((column) => !['value', 'quality'].includes(column.key) || scored(column.key));
  consensusRoot = root;
  const custom = parseConditionValue(selectedValue(documentRef, 'scr-custom-conditions'));
  const scopeRows = scopedRows(rows, listingMarket);
  // v57.59: a condition the market has no data for (e.g. SEC financials for 한국) is greyed out instead of returning 0.
  // Forward PER loads on demand, so it stays offered for 미국 even before the estimates arrive.
  if (availableCache.rows !== scopeRows.length || availableCache.market !== listingMarket || availableCache.source !== rows || availableCache.signals !== root?.AIO_TELEGRAM_SIGNALS) {
    availableCache = { rows: scopeRows.length, market: listingMarket, source: rows, signals: root?.AIO_TELEGRAM_SIGNALS, ids: availableConditionIds(scopeRows, customRead) };
    if (listingMarket === 'US') availableCache.ids.add('fwdpe-max');
  }
  const coverageCounts = conditionCoverage(scopeRows, custom, customRead);
  customPanel?.update(coverageCounts, filtered.length, availableCache.ids);
  renderCustomSummary(documentRef, { scopeRows, custom, coverage: coverageCounts, shown: filtered.length, listingMarket });
  {
    // 개편 v2 (3c): the sector select reads as a chip; a chosen sector shows its clear button.
    const sectorValue = selectedValue(documentRef, 'scr-sector');
    const chip = page.querySelector('.scr-sector-chip');
    if (chip) chip.classList.toggle('is-set', !!sectorValue);
    const clear = page.querySelector('.scr-chip-clear');
    if (clear) clear.hidden = !sectorValue;
  }
  if (visibleColumns.some((column) => column.key === 'fwdPe') || sortState.column === 'fwdPe' || custom.some((item) => item.id === 'fwdpe-max')) requestConsensusEstimates(root, onDataChange);
  const table = documentRef.getElementById('screener-results-table');
  renderTableHeader(documentRef, table, visibleColumns, sortState);
  // v58.56 (4b): the phone's one-line rows apply to the default columns only (screener-quality.css).
  if (table) table.dataset.columnPreset = columnPreset;
  const body = documentRef.getElementById('screener-results-body');
  if (body) {
    const focusedRow = documentRef.activeElement?.closest?.('[data-aio-screener-ticker]');
    const focusedSymbol = body.contains(focusedRow) ? focusedRow.dataset.aioScreenerTicker : null;
    const focusedAction = focusedSymbol && documentRef.activeElement?.getAttribute('aria-label');
    const visible = filtered.slice(0, visibleLimit.value);
    {
      const lead = filtered.find((row) => row.screenStatus === 'passed') || null;
      syncScreenerNextLead(documentRef, lead, { scoped: filtered.length !== rows.length || sortState.column !== 'rank' });
    }
    if (!workbenchResult?.run) onVisibleSymbols?.(visible.map((row) => row.sym || row.symbol).filter(Boolean));
    if (!visible.length) {
      body.replaceChildren();
      tableRowCache.delete(body);
      const empty = documentRef.createElement('tr');
      // LC-73: 필터 0건의 "거절"과 "데이터 미상으로 판정 보류"를 분리해 말한다 — 시총 필터가
      // 걸려 있는데 시총이 없는 행을 조용히 제외하면 0건이 '조건 미달 0건'으로만 읽힌다.
      const capFilter = selectedValue(documentRef, 'scr-cap');
      let capHeld = 0;
      if (capFilter) {
        rows.forEach((row) => {
          if (capFilterValue(row) == null) capHeld += 1;
        });
      }
      const capLabel = { MEGA: '초대형($1T+)', LARGE: '대형($10B~1T)', MID: '중형($2~10B)', SMALL: '소형(<$2B)' }[capFilter] || capFilter;
      // P1673: when every row of the chosen market is held because its price indicators are older than the
      // latest session, the table is empty for lack of current data, not because no stock met the conditions.
      const listingRows = (state?.rows || []).filter((row) => screenerMarket(row) === listingMarket);
      const heldForData = listingRows.length > 0 && listingRows.every((row) => row.screenStatus === 'unavailable');
      // v58.80 (first-users F02): on a slow phone the factor file had not arrived yet, every row read 'unavailable', and the
      // table said all 904 were "not on the latest session" — a final verdict for a load still in progress.
      const factorsPending = heldForData && !state?.metadata?.asOf;
      const emptyMessage = state?.status === 'unavailable'
        ? `${dataStateText(screenerRowsState(root) === 'failed' ? 'failed' : 'loading', '스크리너 자료')}` // v58.80 bundle 3: was '미수신' for both
        : factorsPending
          ? '종목 지표를 불러오는 중입니다 — 도착하면 순위가 표시됩니다'
        : heldForData
          ? `${MARKET_LABELS[listingMarket] || listingMarket} ${listingRows.length}종목 모두 필수 지표가 최신 거래일 기준이 아니어서 순위 판정을 보류했습니다 — 데이터 갱신 후 표시됩니다`
          : capFilter && capHeld > 0
          ? `조건을 충족한 0건 / 시총 정보가 없어 판정 보류 ${capHeld}건 — 시총 적격 ${rows.length - capHeld}/${rows.length}, 적용 컷 ${capLabel}`
          : '조건에 맞는 종목이 없습니다';
      // P1592 (F02): say what the search ran over and offer the way back, instead of one dead sentence.
      const searchRaw = selectedValue(documentRef, 'scr-text-search').trim();
      const searchText = searchRaw.length > 40 ? `${searchRaw.slice(0, 40)}…` : searchRaw; // first-users run 4 (breaker #16): a 5,000-char query ran off-screen
      const scopedMessage = state?.status !== 'unavailable' && !(capFilter && capHeld > 0) && searchText
        ? `'${searchText}' — 지금 조건과 표시 필터(시장·섹터·분류 등) 안에서는 찾지 못했습니다. 전체 종목에서 찾으려면 필터를 지우세요.`
        : emptyMessage;
      empty.appendChild(cell(documentRef, scopedMessage, 'scr-empty-cell'));
      empty.firstChild.colSpan = visibleColumns.length;
      // v58.80 first-users run-2: while the factor file is still arriving, "clear the filters" is not the way out.
      if (state?.status !== 'unavailable' && !factorsPending) {
        const actions = documentRef.createElement('div');
        actions.className = 'scr-empty-actions';
        const action = (label, name, arg) => {
          const button = documentRef.createElement('button');
          button.type = 'button';
          button.className = 'aio-btn-table';
          button.textContent = label;
          button.dataset.aioScreenerAction = name;
          if (arg) button.dataset.aioScreenerArg = arg;
          return button;
        };
        if (searchText) actions.appendChild(action('검색어 지우기', 'clear-filter', 'scr-text-search'));
        // v58.80 run-5 (breaker #1): 'RSI 30 이하' matched 68 stocks, the table showed 0 inside 실행 통과만, and the only way out
        // ('모두 지우기') also deleted the condition. The narrower scope is offered first and keeps the condition.
        if (documentRef.getElementById('scr-passed-only')?.checked) actions.appendChild(action("'실행 통과만' 끄고 전체에서 찾기", 'clear-filter', 'scr-passed-only'));
        actions.appendChild(action('표시 필터 모두 지우기', 'reset-all-filters'));
        empty.firstChild.appendChild(actions);
      }
      body.appendChild(empty);
    } else {
      // v58.56 review: under another sort (a preset sorts by 조건 순위) a market-cap number in the first column read as the
      // rank, so "#" is the row's place in the order the table is sorted by; under the default 시총 sort that is the cap order.
      const capOrder = !visibleColumns.some((column) => column.key === 'capOrder') ? null
        : sortState.column === 'mcap' ? capOrderMap(filtered, readLiveData) : new Map(filtered.map((row, index) => [row.sym || row.symbol, index + 1]));
      const nodes = tableRowNodes(documentRef, body, visible, { readLiveData, readWatchlist, onWatchlistToggle, onExplain, onCompare, selectedSymbols, compareSymbols, visibleColumns, capOrder, rankHold: currentState.metadata.ranking.available === false ? { reason: currentState.metadata.ranking.rankingUnavailableReason } : root._aioRankingHold || null });
      const children = body.children;
      if (children.length !== nodes.length || nodes.some((node, index) => children[index] !== node)) body.replaceChildren(...nodes);
      shareCloseDay(documentRef, table, body);
    }
    if (focusedSymbol) {
      const row = [...body.querySelectorAll('[data-aio-screener-ticker]')].find((node) => node.dataset.aioScreenerTicker === focusedSymbol);
      const action = row && [...row.querySelectorAll('button')].find((node) => node.getAttribute('aria-label') === focusedAction);
      (action || row)?.focus({ preventScroll: true });
    }
  }
  const count = documentRef.getElementById('screener-result-count');
  if (count) count.textContent = String(filtered.length);
  renderTableStatus(documentRef, { status: state?.status, scopeRows, filtered, definition: chosenDefinition, sortState, passedOnly: !!documentRef.getElementById('scr-passed-only')?.checked, readLiveData, onExplain });
  syncFilterCount(documentRef);
  const filterDone = documentRef.querySelector('#scr-filter-sheet .scr-filter-done');
  if (filterDone) filterDone.textContent = `${filtered.length}종목 보기`;
  const summary = documentRef.getElementById('scr-visible-summary');
  if (summary) summary.textContent = `${MARKET_LABELS[listingMarket]}, ${filtered.length}종목 중 ${Math.min(visibleLimit.value, filtered.length)}개 표시`;
  renderStaleNote(documentRef, body);
  const loadMore = documentRef.getElementById('scr-load-more-wrap');
  if (loadMore) {
    // P1592 (F03): the button names how many rows it will actually add; the summary confirms the end.
    loadMore.hidden = visibleLimit.value >= filtered.length;
    const moreButton = loadMore.querySelector('[data-aio-screener-action="load-more"]');
    if (moreButton) moreButton.textContent = `${Math.min(12, Math.max(0, filtered.length - visibleLimit.value))}개 더 보기`;
  }
  if (summary && filtered.length && visibleLimit.value >= filtered.length) summary.textContent = `${MARKET_LABELS[listingMarket]}, ${filtered.length}종목 모두 표시`;
  const diagnostics = documentRef.getElementById('scr-population-note');
  if (diagnostics) {
    const ranking = currentState.metadata.ranking;
    const weights = ranking.appliedFactorWeights || {};
    const order = documentRef.getElementById('scr-order')?.selectedOptions?.[0]?.textContent || SCREENER_COLUMN_REGISTRY.find(column => column.key === sortState.column)?.label || '조건 순위';
    // 2026-10-14 audit #3: one denominator on this screen — the rows the ranking actually ranked (the same set the
    // reading's top 20% and the stock summary's rank use). Why the rest of the population is not ranked is folded.
    const population = scopedRows(currentState.rows || [], listingMarket);
    const screened = population.filter((row) => finite(row?.screenRank) != null).length;
    const rankedCount = screened || ranking.ranked || 0;
    // v57.81: which population the percentiles come from — the core universe or the extended one.
    const contract = RANKING_CONTRACTS[rawState?.metadata?.universeScope === 'extended' ? 'extended' : 'core'];
    // v58.79: the counts stay on screen; the order (already in its select) and the weights are the line's hover.
    diagnostics.textContent = `${MARKET_LABELS[listingMarket]} 순위 계산 ${rankedCount}종목(${contract.label}), 표시 ${filtered.length}개`;
    diagnostics.title = `${order}, 비중 ${Object.entries(weights).map(([key, value]) => `${FACTOR_LABELS[key]?.label || key} ${Math.round(value * 100)}%`).join(' / ') || '계산 보류'}`;
    diagnostics.dataset.rankingContract = contract.id;
    const excluded = documentRef.getElementById('scr-population-excluded');
    if (excluded) {
      const left = population.length - rankedCount;
      const missing = population.filter((row) => row?.screenStatus === 'unavailable').length;
      const rejected = population.filter((row) => row?.screenStatus === 'rejected').length;
      // 2026-10-16: funds, SPACs and sub-$1M 확장 names are left out of the ranked population by design.
      const outside = (reason) => population.filter((row) => row?.screenStatus === 'passed' && row?.populationExclusion === reason).length;
      const funds = outside('fund');
      const spacs = outside('spac');
      const illiquid = outside('illiquid');
      const foreign = outside('foreign');
      const thin = population.filter((row) => row?.screenStatus === 'passed' && row?.rankingEligibility === 'insufficient-row-factor-coverage').length;
      const unscored = population.filter((row) => row?.screenStatus === 'passed' && finite(row?.screenRank) == null && !row?.populationExclusion && row?.rankingEligibility !== 'insufficient-row-factor-coverage').length;
      excluded.hidden = !(screened && left > 0);
      excluded.querySelector('summary').textContent = `순위 밖 ${left}종목`;
      excluded.querySelector('p').textContent = `${MARKET_LABELS[listingMarket]} 모집단 ${population.length}종목 중 ${left}종목은 순위를 매기지 않습니다 — ${[funds ? `ETF·펀드 ${funds}` : null, spacs ? `SPAC ${spacs}` : null, illiquid ? `하루 거래대금 100만 달러 미만 ${illiquid}` : null, foreign ? `해외 상장 ${foreign}` : null, thin ? `공시 재무 등 팩터 근거 부족 ${thin}` : null, missing ? `필수 자료 부족 ${missing}` : null, rejected ? `조건 미통과 ${rejected}` : null, unscored ? `점수 계산 불가 ${unscored}` : null].filter(Boolean).join(', ') || '사유 미확인'}.`;
    }
    const sessionLag = !(ranking.ranked > 0) ? factorSessionLag(listingMarket, currentState.metadata.factorSessionDateByMarket?.[listingMarket], Date.now()) : null;
    if (sessionLag) diagnostics.textContent += `, 가격 자료 ${sessionLag.session.slice(5).replace('-', '/')} 종가 기준, ${sessionLag.latest.slice(5).replace('-', '/')} ${sessionLag.label} 반영 대기`;
    diagnostics.title = '백분위는 같은 시장의 계산 가능한 종목끼리 비교합니다. 정렬과 조건, 표시 필터는 서로 다른 역할입니다. 데이터가 없거나 조건을 통과하지 못한 종목은 순위에서 제외합니다.';
  }
  const allRows = scopedRows(rows, listingMarket);
  const total = documentRef.getElementById('scr-kpi-total');
  const top = documentRef.getElementById('scr-kpi-top');
  const factorCount = documentRef.getElementById('scr-kpi-factors');
  if (total) total.textContent = String(allRows.length);
  const ranked = documentRef.getElementById('scr-kpi-ranked');
  if (ranked) ranked.textContent = String(allRows.filter((row) => row.screenStatus === 'passed').length);
  if (top) {
    top.textContent = String(allRows.filter((row) => row.screenStatus === 'passed' && finite(row.rank) != null && row.rank >= 80).length);
    // 2026-10-14 audit #3: this count is the factor percentile ≥ 80, not a rank — name it so (index.html label follows).
    // v57.88 (screen audit): the percentile is rounded (79.5 counts as 80), so this reads slightly above the reading's
    // 상위 20% by screen rank — a different order (selected screen, all markets). The label says which one it is.
    const lead = top.parentElement?.firstChild;
    if (lead?.nodeType === 3 && /^(?:그중\s*)?(?:랭크|백분위) 80 이상\s*$/.test(lead.textContent)) lead.textContent = lead.textContent.replace(/(?:랭크|백분위) 80 이상\s*$/, '팩터 백분위 80 이상(반올림) ');
  }
  if (factorCount) factorCount.textContent = String(state?.metadata?.ranking?.activeFactors?.length || '—');
  const asOf = page.querySelector('[data-factor-asof]');
  const marketFactorSession = state?.metadata?.factorSessionDateByMarket?.[listingMarket] || state?.metadata?.factorObservedAt;
  // v57.91 (wording audit): '미국 10/15 종가 기준 · 10/16 계산' instead of '미국 팩터 세션 2026-10-15 · 생성 2026-10-16'.
  const kstDay = (value) => { const at = Date.parse(value || ''); return Number.isFinite(at) && /T/.test(String(value)) ? new Date(at + 9 * 3600000).toISOString().slice(0, 10) : value; }; // v58.74: 계산일 in KST
  const monthDay = (value) => { const day = String(value || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(day) ? `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}` : day || '—'; };
  if (asOf) asOf.textContent = marketFactorSession ? `${MARKET_LABELS[listingMarket] || ''} ${monthDay(marketFactorSession)} 종가 기준, ${state?.metadata?.asOf ? `${monthDay(kstDay(state.metadata.asOf))} 계산` : '계산일 미확인'}` : state?.metadata?.asOf ? `${monthDay(kstDay(state.metadata.asOf))} 계산` : '팩터 데이터 대기';
  const provenance = page.querySelector('[data-screener-provenance]');
  if (provenance) {
    const metadata = state?.metadata || {};
    // v58.74 (audit): the ISO stamps are UTC; '수집 2026-10-23 21:49' beside '10/23 종가 기준' read as a KST time before the US open.
    const fmtDate = (value) => { const at = Date.parse(value || ''); return Number.isFinite(at) ? `${new Date(at + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ')} 한국 시간` : value ? String(value).slice(0, 16).replace('T', ' ') : '—'; };
    const sec = metadata.secFundamentalsEligible > 0
      ? `SEC 연간 재무 ${metadata.secFundamentalsStored || 0}/${metadata.secFundamentalsEligible}종목`
      : 'SEC 연간 재무 확인 대기';
    const universeNote = metadata.universeFreshnessStatus === 'stale'
      ? `종목 목록 갱신 필요 (${fmtDate(metadata.universeLastBulkUpdate)})`
      : metadata.universeFreshnessStatus === 'unknown' ? '종목 목록 최신성 미확인' : '종목 목록 최신';
    const research = metadata.researchContext || {};
    const researchNote = research.referenceId
      ? `연구 근거 연결(프레임 ${research.frameworkIds?.length || 0}개, 시계열 ${research.timeSeriesIds?.length || 0}개, 주장 ${research.claimIds?.length || 0}개, 참고용)`
      : '연구 프레임 연결 대기';
    const validation = metadata.modelValidation || {};
    const validationNote = validation.status === 'READY'
      ? '모델 검증 통과(거래 판단에 쓰려면 별도 승인 필요)'
      : '모델 검증 미통과 — 거래 판단에 쓰지 않습니다';
    // P1167 (15 D04): `metadata.factorObservedAt`는 Yahoo 일봉 timestamp, 즉 그 세션 **바의 시작**이다.
    // 종가로 계산한 팩터를 '관측 시각'으로 표시하면 그날 개장 시점에 이미 알 수 있었다는 의미가 된다.
    // 세션 기준일과 수집·생성 시각을 분리하고, 바 시작 시각을 관측시각으로 승격하지 않는다.
    // R24-03/P1179: P1170의 시장별 세션 맵이 provider를 통과하면 그 값을 쓴다 — 혼합 시장의
    // 세션일은 하나의 스칼라로 합칠 수 없고, 없을 때만 호환 바 시작 날짜로 폴백한다.
    const sessionByMarket = metadata.factorSessionDateByMarket && typeof metadata.factorSessionDateByMarket === 'object' ? metadata.factorSessionDateByMarket : null;
    const factorSessionDate = sessionByMarket
      ? (sessionByMarket[listingMarket] ? `${MARKET_LABELS[listingMarket] || listingMarket} ${String(sessionByMarket[listingMarket]).slice(0, 10)}` : '')
      : String(metadata.factorSessionDate || metadata.factorObservedAt || '').slice(0, 10);
    const factorSessionLabel = factorSessionDate ? `팩터 ${factorSessionDate} 세션 종가 기준(일봉 바 시작 ${fmtDate(metadata.factorObservedAt)}, 관측시각 아님)` : '팩터 기준 세션 미확인';
    // v58.74 (text audit): raw tokens (BLOCKED, n blockers, basis bar-start) and the provider name left the visible line;
    // the provider and the blocker count sit in the hover title.
    provenance.textContent = `연구용 스냅샷, ${factorSessionLabel}, 수집 ${fmtDate(metadata.factorFetchedAt || metadata.asOf)}, 생성 ${fmtDate(metadata.asOf)}, ${sec}, ${universeNote}, ${researchNote}, ${validationNote}. 거래소 공식 집계가 아닙니다.`;
    provenance.title = `${metadata.source ? `출처: ${metadata.source}. ` : ''}${validation.blockers?.length ? `검증 미충족 요건 ${validation.blockers.length}개. ` : ''}${metadata.fundamentalCoverageScope ? `${metadata.fundamentalCoverageScope}, ` : ''}일봉 timestamp는 바 시작이며 종가 기반 팩터의 관측시각이 아닙니다. 세션 기준일·수집시각·생성시각을 분리해 표시합니다.`;
    provenance.dataset.sourceKind = 'reference';
    provenance.dataset.operationalUse = 'reference-only';
  }
  const readiness = documentRef.getElementById('screener-readiness-note');
  const run = workbenchResult?.run || preview?.run || state?.lastRun || {};
  const readinessResult = workbenchResult?.readiness || preview?.readiness || state?.readiness;
  const readyCount = Array.isArray(readinessResult?.records) ? readinessResult.records.filter(row => screenerMarket(row) === listingMarket && row.eligible).length : readinessResult?.eligibleCount ?? 0;
  const passedCount = allRows.filter(row => row.screenStatus === 'passed').length;
  const unavailableCount = allRows.filter(row => row.screenStatus === 'unavailable').length;
  const previewConditions = preview?.definition ? describeFilterAst(preview.definition) : null;
  // 개편 v2 (3c): the kicker states the collected and computable counts once, before the close basis.
  const kickerCounts = documentRef.getElementById('scr-kicker-counts');
  if (kickerCounts) kickerCounts.textContent = state?.status === 'unavailable' || !allRows.length ? '' : `대상 ${allRows.length}종목 중 ${readyCount}종목 필수 필드 충족`;
  // P1167 (15 D05): 정적 유니버스가 MIC·assetType을 발행하지 않으면 식별 미확인 행이 남는다. 가격 조회
  // 성공과 식별 metadata 확인을 같은 것으로 읽지 않도록 미확인 수와 누락 필드를 함께 표시한다.
  // v58.74 (owner decision INTL, resolved on the recommended option): Tokyo/Taiwan listings stay in the table for their
  // theme context but are outside the US ranking population (factor-ranks 'foreign'); the count line says so.
  const foreignRows = allRows.filter((row) => row.populationExclusion === 'foreign' || /\.(T|TWO?)$/i.test(String(row.sym || '')));
  const foreignNote = foreignRows.length ? `해외 상장 ${foreignRows.length}개(${foreignRows.slice(0, 4).map((row) => row.sym).join(', ')})는 표에 남기되 미국 순위에서는 뺍니다. ` : '';
  const identityGaps = allRows.filter((row) => row.identityValidation && row.identityValidation.ok === false);
  const identityMissingFields = [...new Set(identityGaps.flatMap((row) => row.identityValidation.missing || []))];
  const IDENTITY_FIELD_NAMES = { mic_missing: '거래소', asset_type_missing: '자산 유형', currency_missing: '통화' };
  const identityNote = identityGaps.length
    ? `식별 정보(${identityMissingFields.map((field) => IDENTITY_FIELD_NAMES[field] || field).join('·')}) 미확인 ${identityGaps.length}개 — 가격 조회 성공은 식별 확인이 아닙니다. `
    : '';
  const previewNote = previewConditions
    ? `미리보기 정의 ${preview.definition?.screenId || '—'}(${String(preview.definition?.definitionHash || '').slice(0, 8)}), 조건 내장 ${previewConditions.builtin.length}개${previewConditions.builtin.length ? `: ${previewConditions.builtin.slice(0, 2).map(item => item.text).join(', ')}` : ''}${previewConditions.user.length ? `, 사용자 추가 ${previewConditions.user.length}개` : ''}, `
    : '';
  if (readiness) readiness.title = [previewNote ? previewNote.replace(/, $/, '') : null, previewConditions ? `내장 조건: ${previewConditions.builtin.map(item => item.text).join(', ') || '없음'} | 사용자 추가: ${previewConditions.user.map(item => item.text).join(', ') || '없음'}` : null, run?.runId ? `실행 ${String(run.runId).slice(0, 12)}` : null].filter(Boolean).join(' | ');
  if (readiness) readiness.textContent = state?.status === 'unavailable'
    ? '데이터 상태: 산출물 미수신, 결과와 검증 수치를 표시하지 않습니다.'
    : `${state?.metadata?.artifactFreshnessStatus === 'stale' || state?.metadata?.factorFreshnessStatus === 'stale' ? '갱신 지연: 원자료는 기준일과 함께 표시하고 계산은 필드별로 확인합니다. ' : ''}${state?.metadata?.universeFreshnessStatus === 'stale' ? '종목 목록 최신성 확인 필요, ' : ''}종목 ${allRows.length}개 중 필수 자료 충족 ${readyCount}개, 조건 통과 ${passedCount}개, 자료 부족 ${unavailableCount}개(${MARKET_LABELS[listingMarket]} 범위), 지금 필터로 보이는 행 ${filtered.length}개. ${foreignNote}${identityNote}상대 순위는 연구용이며 매매 지시가 아닙니다.`;
  // LC-25: bind the executed judgment to the run that produced it and keep the table's display
  // scope separate. A preview is an unfixed run and is labeled as such; the pipeline entry and a
  // user run are different origins over the same artifact.
  const runOrigin = workbenchResult?.run ? 'user'
    : preview?.run ? 'preview'
      : state?.lastRun ? 'pipeline' : null;
  renderFunnel(documentRef, {
    universe: allRows.length,
    ready: readyCount,
    passed: passedCount,
    unavailable: unavailableCount,
    filtered: filtered.length,
    runRowCount: allRows.length,
    runId: run?.runId,
    origin: runOrigin,
    passedOnly: !!documentRef.getElementById('scr-passed-only')?.checked
  });
  renderFilterChips(documentRef);
  syncUniverseScopeControl(documentRef, root, rawState, listingMarket);
  const coverage = documentRef.getElementById('screener-factor-coverage');
  const holdEl = documentRef.getElementById('screener-rank-hold');
  const hold = currentState.metadata.ranking.available === false ? { reason: currentState.metadata.ranking.rankingUnavailableReason } : root?._aioRankingHold || null;
  if (coverage) {
    const ranking = state?.metadata?.ranking || {};
    const active = ranking.activeFactors || [];
    const reasons = ranking.inactiveFactorReasons || {};
    const omitted = ['size', 'value', 'quality'].filter((key) => !active.includes(key));
    // 2026-10-13 review S15: reader labels and one short reason per excluded factor; the model's full reason
    // (coverage %, gate list) stays in the hover title.
    const label = (key) => FACTOR_LABELS[key]?.label || key;
    const shortReason = (key) => key === 'size' ? '시가총액 미수신' : ['value', 'quality'].includes(key) ? `재무 자료 커버리지 ${finite(ranking.factorCoverage?.[key]?.coveragePct) ?? '—'}%(기준 80%)` : '자료 부족';
    coverage.textContent = active.length ? `활성 팩터 ${active.length}개: ${active.map(label).join(', ')}${omitted.length ? ` | 제외: ${omitted.map((key) => `${label(key)}(${shortReason(key)})`).join(', ')}` : ''}` : '활성 팩터 없음 — 서버 팩터 파일 미수신';
    coverage.title = [omitted.map((key) => reasons[key] ? `${label(key)}: ${reasons[key]}` : '').filter(Boolean).join(' / '), hold ? `순위 보류 사유: ${hold.reason} — 이전 계산은 폐기됐습니다` : ''].filter(Boolean).join(' | ');
  }
  if (holdEl) {
    // LC-73 style (P1449): when a re-rank is held, the visible summary (not just a tooltip)
    // discloses that the previous calculation was discarded and why.
    const holdCopy = describeRankingHold(hold, { market: listingMarket, factorSessionDate: state?.metadata?.factorSessionDateByMarket?.[listingMarket] || state?.metadata?.factorSessionDate || state?.metadata?.asOf || state?.revision || null });
    holdEl.hidden = !holdCopy;
    if (holdCopy) {
      holdEl.textContent = holdCopy;
      holdEl.dataset.rankHoldReason = hold.reason || '';
      holdEl.dataset.rankHoldAt = String(hold.at || '');
    }
  }
  const rankingState = state?.metadata?.ranking || {};
  renderFactorTab(documentRef, state?.metadata);
  renderBacktest(documentRef, state?.metadata, root, scopedRows(state?.rows || [], listingMarket));
  renderConditionalEvidence(documentRef, state?.metadata);
  renderValidationState(documentRef, root, state?.metadata, listingMarket);
  page.querySelectorAll('[data-scr-sort]').forEach((header) => {
    const arrow = header.querySelector('.scr-arrow');
    const active = header.dataset.scrSort === sortState.column;
    if (arrow) arrow.textContent = active ? (sortState.ascending ? ' ▲' : ' ▼') : '';
    if (active) header.setAttribute('aria-label', `${header.dataset.sortLabel || header.textContent.replace(/[▲▼]/g, '').trim()} 정렬 ${sortState.ascending ? '오름차순' : '내림차순'}`);
  });
  page.dataset.aioArchitectureRoute = 'screener';
  page.dataset.aioArchitectureSlice = 'screener';
  page.dataset.aioArchitectureRenderer = 'native';
  page.dataset.aioArchitectureStatus = state?.status || 'unavailable';
  if (rankingState.activeFactorRegime && documentRef.getElementById('screener-regime-note')) documentRef.getElementById('screener-regime-note').textContent = rankingState.activeFactorRegime;
}

export function createScreenerPage({ documentRef, store, root = globalThis, workbench = {}, onProfileChange, onUniverseScopeChange, onTicker, onWatchlistToggle, readWatchlist, readAliases, readLiveData } = {}) {
  // P1625: use the selected screen's declared order until the user selects another metric.
  // v57.55 review (8n, 3-person consult): the first view is ordered by market cap. The preset's own rank lost its validation
  // check (GME·AMC led the list), so it is applied when a reader picks a preset, not as the default reading.
  const sortState = { column: 'mcap', ascending: false };
  const visibleLimit = { value: 12 };
  const columnState = { preset: 'overview', custom: [] };
  const selectedSymbols = new Set();
  const compareSymbols = new Set();
  // Controls own the visual conditions. A second mutable chip array drifted
  // from the filters and could keep removed conditions active on the next run.
  // LC-64: 빌더 조건 칩은 **실행 정의에 들어가는 조건**만 표시한다. 표시 필터(섹터·분류·
  // 구조·검색)는 renderFilterChips의 "표시 필터" 행에만 나타나며, 두 행의 라벨·삭제 의미가 다르다.
  const readBuilderConditions = () => BUILDER_FIELDS.flatMap(definition => {
    if (!RUN_CONDITION_FIELDS.includes(definition.value)) return [];
    const value = String(documentRef?.getElementById(definition.target)?.value || '').trim();
    if (!value || (definition.value === 'rank' && value === '0')) return [];
    return [{ field: definition.value, label: definition.label, value, target: definition.target }];
  });
  let mounted = false;
  let renderNow = () => {};
  let activeRows = null;
  let activeResult = null;
  // P1165: 실행 전 미리보기 결과(선택한 정의, 같은 snapshot). 실행하면 activeResult가 대신한다.
  let activePreview = null;
  let activePreviewKey = null;
  let activeDefinition = null;
  let activeScreenId = null;
  let activeRow = null;
  let returnView = null;
  return {
    route: 'screener',
    mount() {
      const bag = createResourceBag();
      let mountActive = true;
      bag.add(() => { mountActive = false; });
      const page = documentRef?.getElementById('page-screener');
      if (!page) return () => {};
      customPanel = installCustomConditions(documentRef);
      bag.add(() => { customPanel?.dispose(); customPanel = null; });
      let marketControls = documentRef.getElementById('scr-market-scope');
      if (!marketControls) {
        marketControls = documentRef.createElement('div'); marketControls.id = 'scr-market-scope'; marketControls.className = 'scr-market-scope';
        for (const [id, label, entries] of [
          ['scr-listing-market', '주식 시장', Object.entries(MARKET_LABELS)],
          ['scr-order', '정렬 기준', [['mcap','시가총액 큰 순(시총 확인된 종목 먼저)'], ['screenRank','선택 조건의 순위'], ['rank','선택 비중의 팩터 백분위'], ['trend','추세 팩터'], ['ret3m','3개월 수익률'], ['momentum','모멘텀 팩터'], ['lowvol','저변동 팩터']]]
        ]) {
          const holder = documentRef.createElement('label'); holder.textContent = label;
          const select = documentRef.createElement('select'); select.id = id; select.setAttribute('aria-label', label);
          for (const [value, title] of entries) { const option = documentRef.createElement('option'); option.value = value; option.textContent = title; select.append(option); }
          holder.append(select); marketControls.append(holder);
        }
        const note = documentRef.createElement('p'); note.id = 'scr-population-note'; note.setAttribute('aria-live','polite'); marketControls.append(note);
        const method = documentRef.createElement('details'); method.className = 'scr-ranking-method';
        const summary = documentRef.createElement('summary'); summary.textContent = '순위가 계산되는 방식';
        const explanation = documentRef.createElement('p'); explanation.textContent = '모멘텀은 1개월·3개월·6개월 수익률을 40%·40%·20%로, 추세는 50일선·200일선 대비 거리를 60%·40%로 묶습니다. 각 팩터를 같은 시장의 업종 내 분포로 조정한 뒤 선택한 비중으로 합산합니다. 표본이 작은 업종은 같은 시장 전체 분포를 함께 씁니다. 높은 추세 값은 이동평균에서 멀다는 뜻도 있으므로 과열·변동폭과 함께 읽습니다. 3개월 수익률 정렬은 이 합산과 별도로 실제 수익률을 비교합니다. 필수 자료가 없거나 선택 조건을 통과하지 못하면 순위를 보류합니다.';
        method.append(summary, explanation); marketControls.append(method);
        // 2026-10-14 audit #17 → 개편 v2 (3c): the market/sort selectors lead the 순위 view's secondary toolbar under the filter bar.
        const toolbar = documentRef.getElementById('scr-toolbar');
        const header = page.querySelector('.page-title')?.parentElement?.parentElement;
        if (toolbar) toolbar.prepend(marketControls);
        else if (header && page.contains(header) && header !== page) header.after(marketControls); else page.prepend(marketControls);
      }
      // audit #3: why some of the population is not ranked — one folded line under the universe line.
      if (!documentRef.getElementById('scr-population-excluded')) {
        const excluded = documentRef.createElement('details'); excluded.id = 'scr-population-excluded'; excluded.className = 'scr-ranking-method'; excluded.hidden = true;
        excluded.append(documentRef.createElement('summary'), documentRef.createElement('p'));
        documentRef.getElementById('scr-population-note')?.after(excluded);
      }
      // v57.81: 종목 범위 — 기본 (core universe) by default; 확장 adds every Russell 2000 member and Nasdaq-listed common
      // stock from a separate shard that is downloaded only after this choice. The choice is remembered per reader.
      if (!documentRef.getElementById('scr-universe-scope')) {
        const holder = documentRef.createElement('label'); holder.textContent = '종목 범위';
        const select = documentRef.createElement('select'); select.id = 'scr-universe-scope'; select.setAttribute('aria-label', '종목 범위');
        for (const [value, title] of [['core', '기본'], ['extended', '확장 — 러셀2000·나스닥 전체']]) { const option = documentRef.createElement('option'); option.value = value; option.textContent = title; select.append(option); }
        holder.append(select);
        const listing = documentRef.getElementById('scr-listing-market')?.closest('label');
        if (listing) listing.after(holder); else marketControls.prepend(holder);
        const status = documentRef.createElement('p'); status.id = 'scr-universe-status'; status.setAttribute('aria-live', 'polite'); status.hidden = true;
        documentRef.getElementById('scr-population-note')?.before(status);
      }
      // 개편 v2 (3c): the selects stay in the toolbar; the population lines and the method fold move under the table so the
      // table is on the first screen (same nodes, same ids).
      const populationHolder = documentRef.getElementById('scr-population-holder');
      if (populationHolder) populationHolder.append(...['scr-universe-status', 'scr-population-note', 'scr-population-excluded'].map((id) => documentRef.getElementById(id)).filter(Boolean), ...marketControls.querySelectorAll(':scope > .scr-ranking-method:not(#scr-population-excluded)'));
      documentRef.getElementById('scr-universe-scope').value = readUniverseScope(root);
      // P1449 (검토판 9): a link that came here with its own 조사 맥락 (e.g. 같은 섹터에서 비교)
      // fills the display search/scope from that context once, instead of surfacing whatever
      // query/sector chips the previous visit left behind.
      const handoff = consumeResearchHandoff({ root, routeId: 'screener' });
      // v57.50 I01: a KRX ticker's sector is a Korean-market sector — compare it inside the KR listing.
      if (/\.K[SQ]$/i.test(String(handoff?.context?.ticker || '')) && handoff?.context?.sector) root._aioScreenerListingMarket = 'KR';
      documentRef.getElementById('scr-listing-market').value = root._aioScreenerListingMarket === 'KR' ? 'KR' : 'US';
      // v57.50 I01: the sector arrives as the artifact's own value (Technology) or a sector ETF code (XLK); it is
      // applied to the 섹터 select once that select has been filled with this market's sectors (fillControls).
      let pendingSector = handoff?.context?.sector ? String(handoff.context.sector) : null;
      if (handoff?.context) {
        const scopeMap = [['q', 'scr-text-search']];
        for (const [key, targetId] of scopeMap) {
          const value = handoff.context[key];
          const field = value != null && value !== '' ? documentRef?.getElementById(targetId) : null;
          if (field) field.value = String(value);
        }
        // A sector comparison starts from that sector alone, not from the previous visit's search word.
        const search = pendingSector && handoff.context.q == null ? documentRef.getElementById('scr-text-search') : null;
        if (search) search.value = '';
        // v58.75 (persona review): '이 테마 종목을 스크리너에서 보기' asks for the theme's members — with 실행 통과만 on, 3 of 33
        // semiconductor rows showed. A search handoff opens on every matching row; the status line says how many passed.
        const passedOnly = handoff.context.q ? documentRef.getElementById('scr-passed-only') : null;
        if (passedOnly) passedOnly.checked = false;
      }
      // v57.50 I05: what a research document sent the reader here to check, and the way back.
      renderKnowledgeArrival({ documentRef, root, routeId: 'screener' });
      // P1437: the lead reading of the ranking — recomputed only when the ranked set or validation changes.
      let readSignature = '';
      // v58.63 (architecture audit UI-03): the signature samples only the first five ranks, so new rows with the same top
      // five (other top-quintile trend/high data changed) kept the old reading. The store replaces the rows array on
      // every update; a different array is a different input.
      let readRowsRef = null;
      const renderRead = () => {
        const sourceRows = selectScreenerState(store?.getState?.() || {})?.rows || [];
        const rows = scopedRows(sourceRows, selectedValue(documentRef, 'scr-listing-market') || 'US');
        const signature = `${selectedValue(documentRef, 'scr-listing-market')}|${root?._aioScenarioState?.status || ''}:${root?._aioScenarioState?.generatedAt || ''}|${rows.length}|${rows.slice(0, 5).map((row) => `${row?.sym}:${row?.screenRank}`).join(',')}|${(root?._aioScreenerBacktestHistory || []).length}|${(root?._aioHistory || []).length}|${Object.keys(root?._serverDataMeta?.rotationHistory?.items || {}).length}`;
        if (signature === readSignature && sourceRows === readRowsRef) return;
        readSignature = signature;
        readRowsRef = sourceRows;
        const listingMarket = selectedValue(documentRef, 'scr-listing-market') || 'US';
        const validation = documentRef.getElementById('screener-validation');
        if (validation) validation.hidden = listingMarket === 'KR';
        if (listingMarket === 'KR') {
          const host = documentRef.getElementById('screener-read');
          if (host) {
            const heading = documentRef.createElement('h2'); heading.className = 'briefing-h2'; heading.textContent = '한국 종목끼리 비교하는 순위';
            const note = documentRef.createElement('p'); note.textContent = `한국 상장 ${rows.length}종목을 독립 비교합니다. 팩터 비중·데이터 범위는 아래에 표시하며 미국 업종 회전과 과거 검증을 이 순위의 근거로 섞지 않습니다.`;
            host.replaceChildren(heading, note);
          }
          // v58.80 (first-users bundle 8): the 순위 view kept the US reading ("순위 계산 810종목 … 기술·산업재 쏠림") over the KR table.
          const rankRead = documentRef.getElementById('screener-rank-read');
          if (rankRead) { rankRead.hidden = true; rankRead.textContent = ''; }
          // v57.50 I22: the KR ranking also continues somewhere — the Korean themes it sits in and its first name
          // (the table-lead sync below re-points the ticker link to the filtered table's first row).
          const ranked = rows.filter((row) => finite(row?.screenRank) != null).sort((a, b) => a.screenRank - b.screenRank);
          const lead = ranked[0] || null;
          renderNextSteps(documentRef, documentRef.getElementById('screener-next'), [
            { route: 'themes', label: '한국 테마', why: '상위권 한국 종목이 몰린 테마가 확정 종가 기준으로 어떻게 움직였는지', ctx: { anchor: 'kr-integrated-themes' } },
            ...(lead ? [{ action: 'showTicker', arg: lead.sym, route: 'ticker', label: `순위 맨 앞 ${lead.sym}`, why: `${lead.name || lead.sym} — 한국 순위 맨 앞 종목을 요약·차트·재무로 확인(검증 전이라 후보로 읽음)` }] : [])
          ]);
          reapplyScreenerNextLead(documentRef);
        } else {
          const next = documentRef.getElementById('screener-next'); if (next) next.hidden = false;
          renderScreenerRead({ documentRef, root, rows: withThemeStages(root, rows) });
        }
      };
      // 2026-10-14 audit #5: theme stage rows for the reading's "상위권의 테마 단계" (nothing renders until status is ok).
      // v58.75: the table's 테마 단계 column reads the same state, so the table redraws too.
      refreshSharedArtifact(root, SCENARIO_STATE).then(({ changed }) => { if (changed && mountActive) { readSignature = ''; renderRead(); renderNow(); } }).catch(() => {});
      // P1419: post-hoc validation of the default ranking (small daily artifacts, read once per mount).
      renderScreenerValidation({ documentRef, root });
      {
        const fetchFn = root?.fetch || globalThis.fetch;
        if (typeof fetchFn === 'function') {
          Promise.all([
            loadJsonArtifact(stableFetcher(root), './public-data/backtest-history.json', { maxAgeMs: 60 * 60 * 1000, maxBytes: 2 * 1024 * 1024 }).catch(() => null),
            loadJsonArtifact(stableFetcher(root), './public-data/model-validation-status.json', { maxAgeMs: 60 * 60 * 1000, maxBytes: 256 * 1024 }).catch(() => null),
            loadJsonArtifact(stableFetcher(root), './public-data/factor-backtest-longrun.json', { maxAgeMs: 6 * 60 * 60 * 1000, maxBytes: 2 * 1024 * 1024 }).catch(() => null),
            loadJsonArtifact(stableFetcher(root), './public-data/screener-candidate-archive.json', { maxAgeMs: 60 * 60 * 1000, maxBytes: 2 * 1024 * 1024 }).catch(() => null),
            // 개편 v2 (3c/5h): the validation gate's status and blockers drive the banner before the table.
            loadJsonArtifact(stableFetcher(root), './public-data/screener-validation-gate.json', { maxAgeMs: 6 * 60 * 60 * 1000, maxBytes: 64 * 1024 }).catch(() => null)
          ]).then(([history, status, longrun, candidates, gate]) => {
            if (gate && typeof gate === 'object') root._aioScreenerValidationGate = gate;
            if (candidates && typeof candidates === 'object') root._aioCandidateArchive = candidates; // P1465: forward candidate record
            if (Array.isArray(history)) root._aioScreenerBacktestHistory = history;
            if (status && typeof status === 'object') root._aioModelValidationStatus = status;
            if (longrun && typeof longrun === 'object') root._aioFactorLongrun = longrun; // P1443: 10-year study shown with its limits
            if (mountActive) {
              renderScreenerValidation({ documentRef, root }); readSignature = ''; renderRead();
              // The ranking principle quotes this record's verdict (screen lessons render before it arrives).
              if (candidates) renderScreenLessons({ documentRef, root, routeId: 'screener' });
              // The 10-year study and the candidate record arrive after the first render of the 검증 view.
              const latest = selectScreenerState(store?.getState?.() || {});
              renderBacktest(documentRef, { ...latest?.metadata, populationRanking: latest?.metadata?.ranking || null, selectionMarket: selectedValue(documentRef, 'scr-listing-market') || 'US', ranking: marketRankingMetadata(latest?.metadata, selectedValue(documentRef, 'scr-listing-market') || 'US') }, root, scopedRows(latest?.rows || [], selectedValue(documentRef, 'scr-listing-market') || 'US'));
              renderValidationState(documentRef, root, latest?.metadata, selectedValue(documentRef, 'scr-listing-market') || 'US');
            }
          });
        }
      }
      let suppliedMaterialBridge = page.querySelector('[data-aio-supplied-material-route="screener"]');
      if (!suppliedMaterialBridge) {
        suppliedMaterialBridge = createSuppliedMaterialBridge(documentRef, {
          routeId: 'screener',
          heading: '스크리너, 시장 확인·구조·노출·AI 용량 정렬'
        });
        page.appendChild(suppliedMaterialBridge);
        bag.add(() => suppliedMaterialBridge.remove());
      }
      const liveReader = readLiveData || (() => root?._liveData || {});
      syncRankFilterLabels(documentRef);
      const watchlistReader = readWatchlist || (() => root?._aioWatchlistGet?.() || []);
      // v57.50 I10: the hand-written keyword aliases plus every THEME_MAP theme's constituents (union, aliases kept).
      let themeAliasCache = { themes: null, aliases: null, merged: {} };
      const aliasReader = readAliases || (() => {
        const aliases = root?.SCR_KEYWORD_ALIASES || {};
        const themes = Array.isArray(root?.THEME_MAP) ? root.THEME_MAP : [];
        if (themeAliasCache.themes !== themes || themeAliasCache.aliases !== aliases) themeAliasCache = { themes, aliases, merged: mergeThemeAliases(aliases, themes) };
        return themeAliasCache.merged;
      });
      const profileReader = () => root?._aioGetActiveProfile?.() || 'balanced';
      let visibleQuoteSignature = '';
      let visibleQuoteRequestedAt = 0;
      // v57.86 (live review): a run that met another quotes run in flight (skipped, or fetchLiveQuotes returned at once) left
      // the rows unquoted behind the 55-second throttle; while most requested rows still lack a quote it retries.
      const requestVisibleQuotes = (symbols, attempt = 0) => {
        const requested = [...new Set((Array.isArray(symbols) ? symbols : []).map((symbol) => String(symbol || '').trim().toUpperCase()).filter(Boolean))].slice(0, 120);
        if (!requested.length) return;
        requested.forEach((symbol) => root?.AIO?.registerLiveSymbol?.(symbol, { reason: 'screener-visible-row' }));
        const signature = requested.join('|');
        const nowMs = Date.now();
        if (!attempt && signature === visibleQuoteSignature && nowMs - visibleQuoteRequestedAt < 55_000) return; // only a retry passes the throttle
        if (root?._aioBootPhase?.quoteReady === false || typeof root?.AIO?.runScheduledRefresh !== 'function') return;
        visibleQuoteSignature = signature;
        visibleQuoteRequestedAt = nowMs;
        Promise.resolve(root.AIO.runScheduledRefresh({
          keys: ['quotes'],
          symbols: requested,
          pageId: 'screener',
          reason: 'screener-visible-quotes'
        })).then(() => {
          if (attempt < 3 && requested.filter((symbol) => !(Number(root?._liveData?.[symbol]?.price) > 0)).length > requested.length / 2) {
            setTimeout(() => { if (mountActive) requestVisibleQuotes(requested, attempt + 1); }, 4000); // v57.88: not after leaving the page
          }
        }).catch(() => {});
      };
      const workbenchStatus = documentRef.getElementById('scr-workbench-status');
      const definitionEditor = documentRef.getElementById('scr-definition-editor');
      const workbenchPresets = documentRef.getElementById('scr-workbench-presets');
      const readinessPreview = documentRef.getElementById('scr-readiness-preview');
      const whyPreview = documentRef.getElementById('scr-why-preview');
      const runHistory = documentRef.getElementById('scr-run-history');
      const outcomeLab = documentRef.getElementById('scr-outcome-lab');
      const operationsState = documentRef.getElementById('scr-ops-state');
       const defaultScreens = () => {
         const stored = selectScreenerState(store.getState())?.savedScreens;
         return Array.isArray(stored) && stored.length ? stored : (workbench.getDefaultScreens?.() || []);
       };
       const setText = (id, value) => {
         const node = documentRef.getElementById(id);
         if (node) node.textContent = value == null || value === '' ? '—' : String(value);
         return node;
       };
      const syncDefinitionEditor = () => {
        if (definitionEditor && activeDefinition) definitionEditor.value = exportSavedScreen({ definition: activeDefinition });
      };
       const renderWhyDrawer = (row) => {
         const drawer = documentRef.getElementById('scr-why-drawer');
         if (!drawer || !row) return;
         const explanation = row.rankExplanation || {};
         const readiness = row.fieldReadiness?.coverage || {};
          // P1164/B04(12:W12-B): screenStatus=passed만으로 'WhyRanked'라 부르지 않는다.
          // 도메인이 분리한 필터/순위/설명 상태를 renderer도 그대로 사용한다.
          // LC-40: 엔진 어휘는 'ranked'/'unavailable'/'not-requested'다. 이전 비교('available')는
          // 절대 참이 될 수 없어 순위가 계산돼도 제목이 항상 '순위 계산 보류'로 고정됐다.
          const filterState = row.screenFilterState || row.screenStatus;
          const rankingState = row.screenRankingState || (row.screenRank != null ? 'ranked' : 'unavailable');
          const ordinalRank = finite(row.screenRank);
          const rawFactorRank = finite(explanation.contributions?.rank);
          const filterLabel = filterState === 'passed' ? '필터 통과'
            : filterState === 'rejected' ? '필터 미충족' : '필터 판정 보류';
          const rankingLabel = rankingState === 'ranked' ? '순위 계산됨'
            : rankingState === 'not-requested' ? '순위 미요청(필터 미통과)' : '순위 계산 불가';
          const title = filterState === 'passed'
            ? (rankingState === 'ranked' && ordinalRank != null ? '조건 통과, 순위 계산 가능' : '조건 통과, 순위 계산 보류')
            : (filterState === 'rejected' ? '조건 미충족' : '데이터 부족 — 판정 보류');
         const missing = explanation.missingEvidence || row.setupProfile?.missingEvidence || [];
         // v57.81: model-level contrary checks (five-session break, under the 20/50/200-day line, RSI regime) run on every
         // row, independent of the user's filters — MRVL after -13.8% in five sessions read "걸린 반대 조건 없음".
         const filterContrary = explanation.contraryEvidence || [];
         const modelContrary = modelContraryEvidence(row);
         const contrary = [...modelContrary.hits.map((hit) => `모델 점검: ${hit}`), ...filterContrary.map((hit) => `등록 조건: ${hit}`)];
         // 개편 v2 (3c): the inspector leads with the ticker, its order among ranked rows and the last close.
         setText('scr-why-title', row.sym || row.symbol || '종목');
         setText('scr-why-subtitle', row.name || '연구용 상대 순위 설명');
         const inspectState = selectScreenerState(store.getState()) || {};
         const rowMarket = screenerMarket(row);
         const rankedInMarket = scopedRows(inspectState.rows || [], rowMarket).filter((item) => finite(item?.screenRank) != null).length;
         // Review fix: the same guard as the table's 전체 순위 column (held ranking or a row that did not pass shows no order).
         const rankHoldNow = marketRankingMetadata(inspectState.metadata, rowMarket)?.available === false || !!root?._aioRankingHold;
         const ordinalForLine = rankHoldNow || row.screenStatus !== 'passed' ? null : finite(row.screenRank);
         setText('scr-why-rankline', ordinalForLine == null ? '순위 계산 보류' : `전체 ${ordinalForLine}위 / ${rankedInMarket || '—'}`);
         const inspectLive = liveRow(row, liveReader);
         const inspectPrice = finite(inspectLive.price);
         setText('scr-why-price', inspectPrice == null ? '—' : formatScreenerPrice(inspectPrice, String(row.instrumentRef?.currency || row.currency || '').trim().toUpperCase() || null));
         const moveNode = documentRef.getElementById('scr-why-move');
         if (moveNode) moveNode.textContent = finite(row.ret1m) == null ? '' : `1개월 ${returnText(row.ret1m)}`;
         if (moveNode) moveNode.className = `scr-why-move ${finite(row.ret1m) == null ? '' : row.ret1m >= 0 ? 'sx-up' : 'sx-down'}`;
         const benchmark = rowMarket === 'US' ? (inspectState.rows || []).find((item) => item?.sym === 'SPY') || null : null;
         const sameSession = !!benchmark && !!row.factorSessionDate && String(benchmark.factorSessionDate || '').slice(0, 10) === String(row.factorSessionDate).slice(0, 10);
         const excessOf = (key) => sameSession && finite(row[key]) != null && finite(benchmark[key]) != null ? row[key] - benchmark[key] : null;
          const factorConfidence = finite(row.confidence);
           // LC-40: 두 rank를 이름으로 분리한다 — 표시 순위는 통과 행의 서수, 팩터 원값은 순위
           // 입력(0~100)이다. 둘 다 'rank'라 부르면 서로 다른 숫자를 같은 값으로 오해한다.
           const rankText = `표시 순위 ${ordinalRank == null ? '—' : ordinalRank}, 팩터 원값 ${rawFactorRank == null ? '—' : rawFactorRank.toFixed(2)}`;
          // P1592 (F10): one reader line — rank, percentile, data completeness. The ledger detail
          // (filter/ranking states, raw factor input, factor confidence) stays on hover.
          const percentileValue = finite(row.rank);
          const statusEl = documentRef.getElementById('scr-why-status');
          setText('scr-why-status', [
            title,
            ordinalRank == null ? '순위 계산 보류' : `조건 통과 종목 중 ${ordinalRank}위`,
            percentileValue == null ? null : `전체 백분위 ${percentileValue.toFixed(0)}`,
            readiness.coveragePct == null ? null : `표시 항목 자료 ${readiness.coveragePct}% 수신`
          ].filter(Boolean).join(', '));
          if (statusEl) statusEl.title = `${filterLabel}, ${rankingLabel}, ${rankText}, 팩터 근거 ${factorConfidence == null ? '—' : `${Math.round(factorConfidence * 100)}%`} (수익확률 아님)`;
         const uncheckedNote = modelContrary.unchecked.length ? ` 자료가 없어 점검하지 못한 항목: ${modelContrary.unchecked.join(', ')}.` : '';
         setText('scr-why-contrary', `${contrary.length ? contrary.join(', ') : row.screenStatus === 'unavailable' ? '필수 근거 미수신으로 등록 조건 판단을 보류했고, 모델 점검(5거래일 낙폭, 20·50·200일선, RSI)에는 걸리지 않았습니다.' : '모델 점검(5거래일 낙폭, 20·50·200일선, RSI)과 등록된 반대 조건 모두에 걸리지 않았습니다 — 위험이 없다는 뜻은 아닙니다.'}${uncheckedNote}`);
          // v58.75 (teach-and-check D7): the chosen screen's conditions with this row's values and the near-threshold ones.
          {
            let conditionDefinition = activeResult?.definition || activeDefinition;
            try { conditionDefinition = activeResult?.definition || buildVisualDefinition() || activeDefinition; } catch (_) {}
            const contraryNode = documentRef.getElementById('scr-why-contrary');
            let conditionNode = documentRef.getElementById('scr-why-conditions');
            if (!conditionNode && contraryNode?.parentElement) {
              const heading = documentRef.createElement('h4');
              heading.textContent = '조건과 경계';
              conditionNode = documentRef.createElement('p');
              conditionNode.id = 'scr-why-conditions';
              const firstHeading = contraryNode.parentElement.querySelector('h4');
              contraryNode.parentElement.insertBefore(heading, firstHeading);
              contraryNode.parentElement.insertBefore(conditionNode, firstHeading);
            }
            if (conditionNode) conditionNode.textContent = `${conditionDefinition?.name ? `${conditionDefinition.name} — ` : ''}${conditionMarginText(conditionMargins(conditionDefinition, row))}`;
          }
          const structureEvidence = row.setupProfile?.structureEvidence || {};
          const structureNote = structureEvidence.postEarningsBreakout === 'unavailable'
            ? '선택 근거 — 실적 후 돌파 확인 자료는 아직 받지 못했습니다'
            : `선택 근거 — 실적 후 돌파: ${structureEvidence.postEarningsBreakout}`;
          // Codex review 2026-10-05: the table showed a dimmed past value while this list called the same
          // field missing. A field with an older observation says so; only a field with no value is "없음".
          const describeMissing = (fieldId) => {
            if (fieldId === 'relative-rank' || fieldId === 'rank') return '상대 순위(이번 계산 보류)';
            const label = SCREENER_FIELD_REGISTRY.get(fieldId)?.label || fieldId;
            const field = row.fieldReadiness?.fields?.[fieldId];
            if (field && ['STALE', 'LAST_GOOD'].includes(field.status) && field.value != null) return `${label}(${String(field.observedAt || '').slice(5, 10).replace('-', '/') || '이전'} 값만 있음, 최신 아님)`;
            return `${label}(값 없음)`;
          };
          setText('scr-why-missing', `순위 필수값 — ${missing.length ? missing.map(describeMissing).join(', ') : '모두 있습니다'}. ${structureNote}.`);
         setText('scr-why-provenance', row.factorSessionDate ? `가격 기준 ${String(row.factorSessionDate).slice(0, 10)} 종가` : '가격 기준일 확인 필요');
         // 개편 v2 (3c): one plain reading from the row's own closes — trend position, then the 3-month gap to the S&P 500
         // (SPY on the same close), then the completeness line that used to stand alone.
         const above50 = finite(row.pctSma50);
         const above200 = finite(row.pctSma200);
         const trendWords = above50 == null || above200 == null ? null
           : above50 >= 0 && above200 >= 0 ? '50일선과 200일선 위' : above50 < 0 && above200 < 0 ? '50일선과 200일선 아래'
             : above50 >= 0 ? '50일선 위, 200일선 아래' : '50일선 아래, 200일선 위';
         const excess3m = excessOf('ret3m');
         setText('scr-why-preview', [
           trendWords ? `종가가 ${trendWords}에 있습니다.` : null,
           excess3m == null ? null : `3개월 수익률(${returnText(row.ret3m)})은 S&P 500보다 ${Math.abs(excess3m).toFixed(1)}%p ${excess3m >= 0 ? '높습니다' : '낮습니다'}.`,
           `${missing.length ? `빠진 필수값 ${missing.length}개` : '빠진 필수값 없음'}, ${contrary.length ? `걸린 반대 조건 ${contrary.length}개` : row.screenStatus === 'unavailable' ? '판정 보류' : '걸린 반대 조건 없음'}.`
         ].filter(Boolean).join(' '));
         renderExcessBars(documentRef, row, benchmark);
         renderWhyRange(documentRef, row);
         const factorList = documentRef.getElementById('scr-why-factor-list');
         if (factorList) {
           factorList.replaceChildren();
           const factors = Object.entries(row.factorScores || {}).filter(([, value]) => finite(value) != null);
           // P1165 (12 W12-B): 막대는 '정규화 점수'다. 적용 가중치와 가중 기여를 같은 줄에서 분리해
           // 보여주고, 랭킹 합성이 실제로 무엇을 평균했는지(원값)도 이 자리에서 밝힌다.
           const appliedWeights = marketRankingMetadata(selectScreenerState(store.getState())?.metadata, screenerMarket(row)).appliedFactorWeights || {};
           const weightSum = factors.reduce((sum, [key]) => sum + (finite(appliedWeights[key]) == null ? 0 : Number(appliedWeights[key])), 0);
           if (!factors.length) factorList.appendChild(text(documentRef, '팩터 점수 미수신'));
           // 개편 v2 (3c): heaviest weight first; the author·year line appears only for a factor the score actually weights.
           const weightOf = (key) => finite(appliedWeights[key]) ?? 0;
           [...factors].sort((a, b) => weightOf(b[0]) - weightOf(a[0])).slice(0, 8).forEach(([key, value]) => {
             const item = documentRef.createElement('div');
             item.className = 'sx-factor scr-why-factor';
             const head = documentRef.createElement('div');
             head.className = 'sx-factor__head';
             const label = documentRef.createElement('span');
             label.textContent = FACTOR_LABELS[key]?.label || key; if (FACTOR_LABELS[key]?.description) { const desc = documentRef.createElement('span'); desc.className = 'sx-factor__desc'; desc.textContent = FACTOR_LABELS[key].description; label.append(desc); }
             const valueNode = documentRef.createElement('b');
             valueNode.textContent = Number(value).toFixed(0);
             head.append(label, valueNode);
             const track = documentRef.createElement('div');
             track.className = 'sx-factor__bar';
             const fill = documentRef.createElement('span');
             fill.style.width = `${Math.max(0, Math.min(100, Number(value)))}%`;
             track.appendChild(fill);
             const weight = finite(appliedWeights[key]);
             const share = weight != null && weightSum > 0 ? weight / weightSum : null;
             const contribution = share == null ? null : Number(value) * share;
             const note = documentRef.createElement('p');
             note.className = 'scr-why-factor-evidence';
             const evidence = share > 0 ? FACTOR_EVIDENCE[key] : null;
             note.textContent = `${share == null ? '비중 미수신 — 순위 합산에 쓰이지 않았습니다' : `비중 ${Math.round(share * 100)}%${contribution == null ? '' : `, 기여 ${contribution.toFixed(1)}`}`}${evidence ? ` — ${evidence}` : ''}`;
             item.title = `${FACTOR_LABELS[key]?.description || key}, 정규화 점수 ${Number(value).toFixed(1)}, 적용 가중치 ${weight == null ? '미수신' : Number(weight).toFixed(3)}, 가중 기여 ${contribution == null ? '계산 불가' : contribution.toFixed(2)}`;
             item.append(head, track, note);
             factorList.appendChild(item);
           });
           // P1443 (review 2026-10-04): name the chain instead of calling different numbers '합성' —
           // the weighted sum of the bars is an intermediate value; the score shown is that sum's
           // percentile among computable stocks, and the displayed rank is the order among passing rows.
           const weightedSum = factors.reduce((sum, [key, value]) => {
             const weight = finite(appliedWeights[key]);
             return weight == null || !(weightSum > 0) ? sum : sum + Number(value) * weight / weightSum;
           }, 0);
           const percentile = finite(row.rank);
           const rankLine = documentRef.createElement('div');
           rankLine.className = 'scr-why-factor-note';
           rankLine.textContent = factors.length
             ? `계산 순서: ① 팩터마다 같은 섹터 안에서 정규화(막대, 0~100 환산) → ② 가중 합 ${weightedSum.toFixed(1)} → ③ 계산 가능한 종목들 사이에서 그 합의 백분위 ${percentile == null ? '—' : percentile.toFixed(0)}(100 = 맨 위, 만점이라는 뜻이 아님) → ④ 조건을 통과한 종목 중 ${ordinalRank == null ? '—' : `${ordinalRank}위`}. 가중 합과 백분위가 다른 것은 ③에서 다시 줄을 세우기 때문입니다.`
             : '팩터 점수 미수신 — 순위를 해석하지 않습니다.';
           // 개편 v2 (3c): the calculation chain and the factor overlap fold under the bars so the inspector stays short.
           const calc = documentRef.createElement('details');
           calc.className = 'scr-why-calc';
           const calcSummary = documentRef.createElement('summary');
           calcSummary.textContent = '점수 계산 순서, 요인 겹침';
           calc.append(calcSummary, rankLine);
           factorList.appendChild(calc);
           const overlap = documentRef.createElement('div');
           overlap.className = 'scr-why-factor-note';
           const screenState = selectScreenerState(store?.getState?.() || {});
           const overlapMarket = screenerMarket(row);
           overlap.textContent = `${overlapSentence(currentOverlap(screenState?.rows, marketRankingMetadata(screenState?.metadata, overlapMarket), overlapMarket))} 백분위는 기업의 질이나 상승 확률을 뜻하지 않습니다.`;
           calc.appendChild(overlap);
         }
         const ticker = documentRef.querySelector('[data-aio-screener-action="open-ticker"]');
         if (ticker) ticker.dataset.aioScreenerArg = row.sym || row.symbol || '';
         // v58.75 (teach-and-check D6): the next step of the top-down flow — this stock's chart, level map and plan check.
         if (ticker && !documentRef.querySelector('[data-aio-screener-action="open-chart-levels"]')) {
           const levelsButton = documentRef.createElement('button');
           levelsButton.type = 'button';
           levelsButton.className = 'sx-btn';
           levelsButton.dataset.aioScreenerAction = 'open-chart-levels';
           levelsButton.textContent = '차트·가격 레벨·내 계획 점검';
           ticker.insertAdjacentElement('afterend', levelsButton);
         }
         const levelsLink = documentRef.querySelector('[data-aio-screener-action="open-chart-levels"]');
         if (levelsLink) levelsLink.dataset.aioScreenerArg = row.sym || row.symbol || '';
         syncWhyCompare(row.sym || row.symbol || '');
         syncWhyWatchlist(row.sym || row.symbol || '');
         drawer.hidden = false;
       };
       // 개편 v2 (3c/4b/4c): the Why drawer is the inspector beside the table (≥1024px: 400px, iPad landscape 360px) and a
       // bottom sheet at 1023px and below (iPad portrait, phone). Focus moves into it on a tap and returns to the row on close.
       const whyDrawerNode = documentRef.getElementById('scr-why-drawer');
       const NARROW_WHY = '(max-width: 1023px)';
       const narrowWhy = () => Boolean(root?.matchMedia?.(NARROW_WHY)?.matches);
       const selectedResultRow = () => {
         const symbol = activeRow?.sym || activeRow?.symbol;
         const body = documentRef.getElementById('screener-results-body');
         return symbol && body ? [...body.querySelectorAll('tr[data-aio-screener-ticker]')].find((node) => node.dataset.aioScreenerTicker === symbol) || null : null;
       };
       let sheetScrim = null;
       let sheetFrame = null;
       // Review fix: only a reader's tap opens the sheet — an inspector the wide layout opened by itself closes when the
       // screen narrows (iPad rotation) instead of turning into a sheet with a scrim nobody asked for.
       let whyUserOpened = false;
       const syncWhyMode = () => {
         if (!whyDrawerNode) return;
         const sheet = narrowWhy();
         if (sheet && !whyDrawerNode.hidden && !whyUserOpened) whyDrawerNode.hidden = true;
         whyDrawerNode.classList.toggle('sx-sheet', sheet);
         whyDrawerNode.classList.toggle('sx-inspector', !sheet);
         const open = sheet && !whyDrawerNode.hidden && page.dataset.scrView === 'rank';
         // In sheet mode the drawer is a modal dialog (Tab stays inside, see onWhyKeydown); beside the table it is an aside.
         if (open) { whyDrawerNode.setAttribute('role', 'dialog'); whyDrawerNode.setAttribute('aria-modal', 'true'); }
         else { whyDrawerNode.removeAttribute('role'); whyDrawerNode.removeAttribute('aria-modal'); }
         if (open && !sheetScrim) {
           sheetScrim = documentRef.createElement('div');
           sheetScrim.className = 'scr-sheet-scrim';
           sheetScrim.addEventListener('click', () => closeWhyDrawer());
           page.append(sheetScrim);
         }
         if (sheetScrim) sheetScrim.hidden = !open;
         if (!open) { whyDrawerNode.classList.remove('is-open'); return; }
         if (whyDrawerNode.classList.contains('is-open')) return;
         const raise = () => { sheetFrame = null; if (!whyDrawerNode.hidden) whyDrawerNode.classList.add('is-open'); };
         sheetFrame = root?.requestAnimationFrame ? root.requestAnimationFrame(raise) : (raise(), null);
       };
       const placeWhyDrawer = () => { syncWhyMode(); return selectedResultRow(); };
       const revealWhyDrawer = (row) => {
         if (!whyDrawerNode || whyDrawerNode.hidden) return;
         if (!whyDrawerNode.hasAttribute('tabindex')) whyDrawerNode.tabIndex = -1;
         whyDrawerNode.focus?.({ preventScroll: true });
         if (narrowWhy()) return; // the sheet is fixed to the bottom of the screen
         const view = root?.innerHeight || 0;
         const top = whyDrawerNode.getBoundingClientRect?.().top ?? 0;
         if (view && top >= -8 && top <= view * 0.6) return;
         const smooth = !root?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
         whyDrawerNode.scrollIntoView?.({ block: 'nearest', behavior: smooth ? 'smooth' : 'auto' });
         void row;
       };
       const closeWhyDrawer = () => {
         if (!whyDrawerNode) return;
         whyDrawerNode.hidden = true;
         syncWhyMode();
         selectedResultRow()?.focus?.();
       };
       const onWhyKeydown = (event) => {
         if (event.key === 'Escape') { event.preventDefault(); closeWhyDrawer(); return; }
         if (event.key !== 'Tab' || whyDrawerNode.getAttribute('aria-modal') !== 'true') return;
         // Focus trap while the sheet is a modal dialog: Tab cycles inside it instead of reaching the page behind the scrim.
         const focusables = [...whyDrawerNode.querySelectorAll('button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')]
           .filter((node) => !node.disabled && node.getClientRects().length);
         if (!focusables.length) { event.preventDefault(); return; }
         const first = focusables[0];
         const last = focusables[focusables.length - 1];
         const active = documentRef.activeElement;
         if (event.shiftKey && (active === first || active === whyDrawerNode)) { event.preventDefault(); last.focus(); }
         else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
       };
       if (whyDrawerNode) {
         whyDrawerNode.addEventListener('keydown', onWhyKeydown);
         const narrowQuery = root?.matchMedia?.(NARROW_WHY);
         const onNarrowChange = () => syncWhyMode();
         narrowQuery?.addEventListener?.('change', onNarrowChange);
         bag.add(() => {
           narrowQuery?.removeEventListener?.('change', onNarrowChange);
           whyDrawerNode.removeEventListener('keydown', onWhyKeydown);
           if (sheetFrame != null) root?.cancelAnimationFrame?.(sheetFrame);
           whyDrawerNode.classList.remove('is-open');
           sheetScrim?.remove(); sheetScrim = null;
         });
       }
       // v58.56 (4b): on a phone (≤743px) the filter controls are a bottom sheet behind the 필터 button, so the first screen is
       // the screen chips, one validation line and the rows. Wider layouts keep them inline (the wrapper is display:contents).
       const filterSheet = documentRef.getElementById('scr-filter-sheet');
       const filterOpenButton = documentRef.getElementById('scr-filter-open');
       const NARROW_FILTERS = '(max-width: 743px)';
       let filterScrim = null;
       const setFilterSheet = (open, { returnFocus = true } = {}) => {
         if (!filterSheet) return;
         const on = !!open && Boolean(root?.matchMedia?.(NARROW_FILTERS)?.matches);
         const wasOpen = filterSheet.classList.contains('is-open');
         filterSheet.classList.toggle('is-open', on);
         if (on) { filterSheet.setAttribute('role', 'dialog'); filterSheet.setAttribute('aria-modal', 'true'); filterSheet.setAttribute('aria-label', '필터'); }
         else { filterSheet.removeAttribute('role'); filterSheet.removeAttribute('aria-modal'); filterSheet.removeAttribute('aria-label'); }
         filterOpenButton?.setAttribute('aria-expanded', on ? 'true' : 'false');
         if (on && !filterScrim) {
           filterScrim = documentRef.createElement('div');
           filterScrim.className = 'scr-sheet-scrim scr-filter-scrim';
           filterScrim.addEventListener('click', () => setFilterSheet(false));
           page.append(filterScrim);
         }
         if (filterScrim) filterScrim.hidden = !on;
         if (on) { if (!filterSheet.hasAttribute('tabindex')) filterSheet.tabIndex = -1; filterSheet.focus?.({ preventScroll: true }); }
         else if (wasOpen && returnFocus) filterOpenButton?.focus?.({ preventScroll: true });
       };
       const onFilterKeydown = (event) => {
         if (!filterSheet.classList.contains('is-open')) return;
         if (event.key === 'Escape') { event.preventDefault(); setFilterSheet(false); return; }
         if (event.key !== 'Tab') return;
         const focusables = [...filterSheet.querySelectorAll('button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')]
           .filter((node) => !node.disabled && node.getClientRects().length);
         if (!focusables.length) { event.preventDefault(); return; }
         const first = focusables[0];
         const last = focusables[focusables.length - 1];
         const active = documentRef.activeElement;
         if (event.shiftKey && (active === first || active === filterSheet)) { event.preventDefault(); last.focus(); }
         else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
       };
       if (filterSheet) {
         filterSheet.addEventListener('keydown', onFilterKeydown);
         const filterQuery = root?.matchMedia?.(NARROW_FILTERS);
         const onFilterMedia = () => { if (!filterQuery?.matches) setFilterSheet(false, { returnFocus: false }); };
         filterQuery?.addEventListener?.('change', onFilterMedia);
         bag.add(() => {
           filterQuery?.removeEventListener?.('change', onFilterMedia);
           filterSheet.removeEventListener('keydown', onFilterKeydown);
           setFilterSheet(false, { returnFocus: false });
           filterScrim?.remove(); filterScrim = null;
         });
       }
       // v58.56 (#12): 비교 lives only here (the row keeps ☆); the button names its state like the watchlist one.
       const syncWhyCompare = (symbol) => {
         const button = documentRef.querySelector('[data-aio-screener-action="why-compare"]');
         if (!button) return;
         const inCompare = !!symbol && compareSymbols.has(symbol);
         button.dataset.aioScreenerArg = symbol || '';
         button.setAttribute('aria-pressed', inCompare ? 'true' : 'false');
         button.textContent = inCompare ? '비교에서 빼기' : `비교 추가${compareSymbols.size ? ` (${compareSymbols.size}/5)` : ''}`;
       };
       const syncWhyWatchlist = (symbol) => {
         const button = documentRef.querySelector('[data-aio-screener-action="why-watchlist"]');
         if (!button) return;
         const inList = !!symbol && watchlistReader().includes(symbol);
         button.dataset.aioScreenerArg = symbol || '';
         button.setAttribute('aria-pressed', inList ? 'true' : 'false');
         button.textContent = inList ? '관심 종목에서 빼기' : '관심 종목 추가';
       };
       const explainRow = (row) => {
         whyUserOpened = true;
         activeRow = row;
         selectedSymbols.clear();
         if (row?.sym || row?.symbol) selectedSymbols.add(row.sym || row.symbol);
         renderWhyDrawer(row);
         renderNow();
         revealWhyDrawer(placeWhyDrawer());
       };
       // 개편 v2 (3c): on a wide screen the inspector starts on the table's first row (no focus move, no scroll), as the
       // design shows one row selected; a phone or iPad portrait opens the sheet only on a tap.
       let autoInspected = false;
       const autoInspect = () => {
         if (autoInspected || activeRow || !whyDrawerNode || narrowWhy() || page.dataset.scrView !== 'rank') return false;
         const first = documentRef.querySelector('#screener-results-body tr[data-aio-screener-ticker]');
         const symbol = first?.dataset.aioScreenerTicker;
         const pool = activeRows || activePreview?.rows || selectScreenerState(store.getState())?.rows || [];
         const row = symbol ? pool.find((item) => (item.sym || item.symbol) === symbol) : null;
         if (!row) return false;
         autoInspected = true;
         whyUserOpened = false;
         activeRow = row;
         selectedSymbols.clear();
         selectedSymbols.add(symbol);
         renderWhyDrawer(row);
         return true;
       };
       // v58.63 (architecture audit A12): the inspector shows the selected symbol's row from the CURRENT result. A preset,
       // run or data refresh replaces the row objects, so the held row is re-read by symbol on every render (NVDA stayed at
       // 308위 beside a table that said 249위 until the row was clicked again). A symbol that left the result releases the
       // selection: wide screens fall back to the first row, an open phone/tablet sheet closes.
       const refreshInspector = () => {
         if (!activeRow || !whyDrawerNode) return false;
         const symbol = activeRow.sym || activeRow.symbol;
         const pool = activeRows || activePreview?.rows || selectScreenerState(store.getState())?.rows || [];
         const fresh = symbol ? pool.find((item) => (item.sym || item.symbol) === symbol) : null;
         // v58.80 (first-users bundle 8): a filter that left the table empty kept the last stock's explanation beside it,
         // as if it were one of zero results. With no row on the table the inspector is put away until rows return.
         const tableRows = documentRef.getElementById('screener-results-body')?.querySelector('tr[data-aio-screener-ticker]');
         if (!tableRows && fresh) { activeRow = null; autoInspected = false; selectedSymbols.clear(); whyDrawerNode.hidden = true; syncWhyMode(); return false; }
         if (fresh === activeRow) return false;
         if (fresh) { activeRow = fresh; renderWhyDrawer(fresh); return false; }
         activeRow = null; autoInspected = false; selectedSymbols.clear();
         if (narrowWhy() && !whyDrawerNode.hidden) closeWhyDrawer();
         return true;
       };
       // 개편 v2: one route, three views (순위 · 사후 검증 · 맞춤 조건) on #page-screener[data-scr-view]. The tab panels keep
       // their ids and hidden state, so a link to 과거 검증 or 조건별 과거 통계 still lands on its panel.
       const VIEW_PANELS = Object.freeze({ rank: ['ranking'], validation: ['factors', 'backtest', 'evidence'], custom: [] });
       const VIEW_TABS = [['scr-tab-button-ranking', 'rank'], ['scr-tab-button-backtest', 'validation'], ['scr-view-button-custom', 'custom']];
       const setView = (view, { focusTab = false } = {}) => {
         const next = VIEW_PANELS[view] ? view : 'rank';
         page.dataset.scrView = next;
         ['ranking', 'factors', 'backtest', 'evidence'].forEach((tab) => {
           const panel = documentRef.getElementById(`scr-tab-${tab}`);
           if (panel) panel.hidden = !VIEW_PANELS[next].includes(tab);
         });
         const workbenchNode = documentRef.getElementById('screener-workbench');
         if (workbenchNode) workbenchNode.hidden = next !== 'custom';
         for (const [id, value] of VIEW_TABS) {
           const button = documentRef.getElementById(id);
           if (!button) continue;
           const on = value === next;
           button.setAttribute('aria-selected', on ? 'true' : 'false');
           button.tabIndex = on ? 0 : -1;
           button.classList.toggle('is-active', on);
           if (on && focusTab) button.focus();
         }
         syncWhyMode();
       };
       const onViewKeydown = (event) => {
         const current = event.target.closest?.('.scr-view-seg [role="tab"]');
         if (!current || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
         event.preventDefault();
         const ids = VIEW_TABS.map(([id]) => id);
         const index = ids.indexOf(current.id);
         const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? ids.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length;
         setView(VIEW_TABS[nextIndex][1], { focusTab: true });
       };
       // The folded builder (조건 직접 조합 · 실행 기록) belongs to 맞춤 조건; opening it from anywhere shows that view.
       const onFoldToggle = (event) => {
         if (event.target?.id === 'scr-workbench-advanced' && event.target.open && page.dataset.scrView !== 'custom') setView('custom');
       };
       page.addEventListener('keydown', onViewKeydown);
       page.addEventListener('toggle', onFoldToggle, true);
       bag.add(() => { page.removeEventListener('keydown', onViewKeydown); page.removeEventListener('toggle', onFoldToggle, true); });
       const scrollToTop = () => {
         const content = documentRef.querySelector('.content');
         if (content && typeof content.scrollTo === 'function') content.scrollTo({ top: 0 });
         else if (content) content.scrollTop = 0;
         if (typeof root?.scrollTo === 'function' && (root.scrollY || 0) > 0) root.scrollTo(0, 0);
       };
       // v57.81 (phone/iPad parity audit): the "+" gave no sign near the row and the tray sits far below on a phone.
       // One status line pinned to the bottom of the screen says what changed and links to the tray.
       let compareNoticeTimer = null;
       const showCompareNotice = (message) => {
         let notice = documentRef.getElementById('scr-compare-feedback');
         if (!notice) {
           notice = documentRef.createElement('div');
           notice.id = 'scr-compare-feedback';
           notice.className = 'scr-compare-feedback';
           notice.setAttribute('role', 'status');
           const textNode = documentRef.createElement('span');
           const go = documentRef.createElement('button');
           go.type = 'button';
           go.className = 'aio-btn-table';
           go.textContent = '비교 보기';
           go.setAttribute('aria-controls', 'scr-compare-tray');
           go.dataset.aioScreenerAction = 'show-compare';
           notice.append(textNode, go);
           page.append(notice);
         }
         notice.firstElementChild.textContent = message;
         notice.lastElementChild.hidden = compareSymbols.size === 0;
         notice.hidden = false;
         if (compareNoticeTimer) clearTimeout(compareNoticeTimer);
         compareNoticeTimer = setTimeout(() => { compareNoticeTimer = null; notice.hidden = true; }, 6000);
       };
       bag.add(() => { if (compareNoticeTimer) clearTimeout(compareNoticeTimer); compareNoticeTimer = null; documentRef.getElementById('scr-compare-feedback')?.remove(); });
       const toggleCompare = (symbol) => {
         if (!symbol) return;
         let message;
         if (compareSymbols.has(symbol)) { compareSymbols.delete(symbol); message = `${symbol} 비교에서 뺌, ${compareSymbols.size}개`; }
         else if (compareSymbols.size < 5) { compareSymbols.add(symbol); message = `${symbol} 비교에 추가됨, ${compareSymbols.size}개`; }
         else message = '비교는 5개까지입니다, 하나를 빼고 다시 넣으세요';
         renderCompareTray();
         renderNow();
         showCompareNotice(message);
       };
       let runGeneration = 0;
       let archiveGeneration = 0;
       const refreshRunArchive = async () => {
         if (!runHistory) return;
         const generation = ++archiveGeneration;
         runHistory.dataset.archiveLoaded = 'loading';
         try {
           if (typeof workbench.list !== 'function') throw new Error('SCREEN_ARCHIVE_UNAVAILABLE');
           const entries = await workbench.list();
           if (!mountActive || generation !== archiveGeneration) return;
           runHistory.replaceChildren();
           runHistory.dataset.archiveLoaded = 'true';
           if (!entries.length) runHistory.textContent = '보관한 사용자 실행 없음, 실행하면 입력을 이 브라우저에 최대 5개 보관합니다.';
           for (const entry of entries) {
             const item = documentRef.createElement('div');
             const label = documentRef.createElement('span');
             label.textContent = `${entry.name}, ${entry.savedAt.slice(0, 16)} `;
             const replay = documentRef.createElement('button');
             replay.type = 'button'; replay.className = 'aio-btn-table'; replay.textContent = '저장 입력으로 재현';
             replay.addEventListener('click', async () => {
               const run = ++runGeneration;
               try {
                 const result = await workbench.replay(entry.id);
                 if (!mountActive || run !== runGeneration) return;
                 activeDefinition = result.definition; activeScreenId = activeDefinition.screenId;
                 activeResult = result; activeRows = result.rows;
                 selectedSymbols.clear(); visibleLimit.value = 12;
                 // Codex browser audit H113: the replay header names which run, when, and on what data; the previous
                 // preview (another preset's definition and hash) is dropped so no label or accessible name keeps it.
                 activePreview = null; activePreviewKey = null;
                 { const passedOnly = documentRef.getElementById('scr-passed-only'); if (passedOnly) passedOnly.checked = true; }
                 const replayMeta = result.snapshotMetadata || {};
                 const dataDate = replayMeta.factorSessionDateByMarket?.US || String(replayMeta.factorSessionDate || replayMeta.asOf || '').slice(0, 10) || '확인 필요';
                 if (workbenchStatus) workbenchStatus.textContent = `보관 실행 재현, ${entry.name}, 실행 ${entry.savedAt.slice(0, 16)}, 자료 기준 ${dataDate} — 현재 시장이 아닌 당시 결과입니다. 지금 자료로 보려면 조건을 다시 실행합니다.`;
                 syncDefinitionEditor(); renderWorkbench(); renderNow();
               } catch (_) { if (mountActive && run === runGeneration && workbenchStatus) workbenchStatus.textContent = '재현 불가, 모델 버전 또는 보관 데이터가 일치하지 않습니다.'; }
             });
             const remove = documentRef.createElement('button');
             remove.type = 'button'; remove.className = 'aio-btn-table'; remove.textContent = '보관 삭제';
             remove.addEventListener('click', async () => {
               try { await workbench.remove(entry.id); if (mountActive) refreshRunArchive(); }
               catch (_) { if (mountActive && workbenchStatus) workbenchStatus.textContent = '로컬 보관 삭제 실패'; }
             });
             item.append(label, replay, remove); runHistory.appendChild(item);
           }
         } catch (_) {
           if (!mountActive || generation !== archiveGeneration) return;
           runHistory.dataset.archiveLoaded = 'unavailable';
           runHistory.textContent = '이 브라우저에서는 실행 입력을 보관할 수 없습니다.';
         }
       };
       const runDefinition = async (definition) => {
         const generation = ++runGeneration;
         try {
           const saved = createSavedScreen({ definition });
           activeDefinition = saved.definition;
           activeScreenId = activeDefinition.screenId;
           if (typeof workbench.run !== 'function') throw new Error('SCREEN_ENGINE_UNAVAILABLE');
           const result = await workbench.run(activeDefinition);
           if (generation !== runGeneration || !mountActive) return;
           if (result?.rows) {
             activeResult = result;
             activeRows = result.rows;
             { const passedOnly = documentRef.getElementById('scr-passed-only'); if (passedOnly) passedOnly.checked = true; }
             selectedSymbols.clear();
             visibleLimit.value = 12;
              // LC-25: name the run and its denominator so the executed judgment is not confused
              // with the table's separate display scope.
              const runRowCount = Number.isFinite(Number(result.run?.rowCount)) ? ` / ${result.run.rowCount}` : '';
              const runIdText = result.run?.runId ? `, run ${String(result.run.runId).slice(0, 12)}` : '';
              if (workbenchStatus) workbenchStatus.textContent = `실행 완료, ${result.persistence?.status === 'persisted' ? '입력 로컬 보관됨' : '입력 보관 실패: 이 화면에서만 유지'}${runIdText}, 실행 판정 ${result.run?.passed || 0} 통과 / ${result.run?.unavailable || 0} 데이터 부족${runRowCount}`;
             syncDefinitionEditor();
             renderWorkbench();
             renderNow();
             refreshRunArchive();
           }
         } catch (error) {
           if (generation !== runGeneration || !mountActive) return;
           if (workbenchStatus) workbenchStatus.textContent = `실행할 수 없습니다, 정의를 확인하세요.`;
           const detail = documentRef.getElementById('scr-definition-error-detail');
           if (detail) { detail.hidden = false; detail.textContent = error?.message || 'invalid_definition'; }
         }
       };
       const renderWorkbench = () => {
         const state = selectScreenerState(store.getState()) || {};
         if (workbenchStatus) {
           workbenchStatus.dataset.runId = activeResult?.run?.runId || '';
           workbenchStatus.dataset.resultHash = activeResult?.resultHash || '';
           workbenchStatus.dataset.explanationsHash = activeResult?.explanationsHash || '';
           workbenchStatus.dataset.snapshotId = activeResult?.run?.snapshotId || '';
           workbenchStatus.dataset.rowCount = String(activeResult?.run?.rowCount || 0);
           workbenchStatus.dataset.persistence = activeResult?.persistence?.status || '';
         }
         const screens = defaultScreens();
         if (workbenchPresets) {
           workbenchPresets.replaceChildren();
           screens.forEach((screen) => {
             const button = documentRef.createElement('button');
             button.type = 'button';
             button.className = 'aio-btn-table';
             button.className += ` scr-screen-chip${screen.definition.screenId === activeScreenId ? ' active' : ''}`;
             button.setAttribute('aria-pressed', screen.definition.screenId === activeScreenId ? 'true' : 'false');
             button.dataset.aioScreenerAction = 'screen-preset';
             button.dataset.aioScreenerArg = screen.definition.screenId;
             // v58.56 (4b): a phone shows the one-word name (균형 · 모멘텀 · 추세 · 저변동) so the row of screens fits; the full
             // name stays the button's accessible name and the wider layouts' label.
             const full = documentRef.createElement('span');
             full.className = 'scr-preset-full';
             full.textContent = screen.label;
             button.append(full);
             const short = PRESET_SHORT_LABELS[screen.definition.screenId];
             if (short) {
               const compact = documentRef.createElement('span');
               compact.className = 'scr-preset-short';
               compact.setAttribute('aria-hidden', 'true');
               compact.textContent = short;
               button.append(compact);
               button.classList.add('has-short');
             }
             workbenchPresets.appendChild(button);
           });
           { const lessonId = activeScreenId || activeDefinition?.screenId || screens[0]?.definition?.screenId || null; renderPresetLesson(documentRef, root, workbenchPresets, lessonId, screens.find((screen) => screen.definition.screenId === lessonId)?.label); }
         }
         const screenSelect = documentRef.getElementById('scr-screen-select');
         if (screenSelect) {
           const currentValue = activeScreenId || activeDefinition?.screenId || screens[0]?.definition?.screenId || '';
           if (screenSelect.dataset.aioScreenSignature !== screens.map((screen) => screen.definition.screenId).join('|')) {
             screenSelect.replaceChildren();
             screens.forEach((screen) => {
               const option = documentRef.createElement('option');
               option.value = screen.definition.screenId;
               option.textContent = screen.label;
               screenSelect.appendChild(option);
             });
             screenSelect.dataset.aioScreenSignature = screens.map((screen) => screen.definition.screenId).join('|');
           }
           screenSelect.value = currentValue;
         }
         if (!activeDefinition && screens[0]?.definition) {
           activeDefinition = screens[0].definition;
           activeScreenId = activeDefinition.screenId;
         }
         syncDefinitionEditor();
         renderBuilderConditions(documentRef, readBuilderConditions());
         renderFilterChips(documentRef);
         syncColumnControls();
         const readiness = activeResult?.readiness || state.readiness;
         const collectedCount = Number.isFinite(state?.metadata?.artifactRows) ? state.metadata.artifactRows : null;
         const collectedUniverse = Number.isFinite(state?.metadata?.universe) ? state.metadata.universe : (readiness?.rowCount ?? null);
         const collectedNote = collectedCount > 0 && collectedUniverse > 0 ? `수집 성공 ${collectedCount}/${collectedUniverse}, ` : '';
         if (readinessPreview) readinessPreview.textContent = readiness ? `${collectedNote}필수 자료 있는 종목 ${readiness.eligibleCount}/${readiness.rowCount}, ${readiness.coveragePct}%, 필수: ${(readiness.requiredFields || []).map((field) => field.split('.').pop()).join(', ') || '없음'}` : '필드 준비도 미리보기 대기';
          // P1164/B04(12:U01): 실행 전 카운트는 '선택한 정의의 통과'가 아니다 — 빈 조건 파이프라인
          // 미리보기 결과다. '조건 적용 전 계산 가능'으로 부르고 어떤 정의·해시인지 밝힌다.
          if (workbenchStatus && !activeResult) {
            const pipelineRun = state.lastRun;
            const pipelineId = pipelineRun?.screenId ? String(pipelineRun.screenId) : null;
            workbenchStatus.textContent = pipelineRun
              ? `조건 적용 전 계산 가능 ${pipelineRun.passed}개 (조건 없는 미리보기 정의 ${pipelineId || '—'}), 실행하면 선택한 정의로 다시 계산합니다`
              : '실행 전 미리보기';
          }
         if (runHistory && !runHistory.dataset.archiveLoaded) refreshRunArchive();
         if (outcomeLab) outcomeLab.textContent = state.outcomes?.length ? `실행 후 결과, ${state.outcomes.length}개 관측, 1/5/21/63거래일 후` : '실행 후 결과, 자동 추적 미연결, 보관 입력 재현만 지원';
         if (operationsState) operationsState.textContent = state.refreshPlan ? `데이터 갱신, 대기 ${state.refreshPlan.queued?.length || 0}건, 한도 차단 체크됨` : `데이터 갱신, ${state?.metadata?.asOf ? `${String(state.metadata.asOf).slice(0, 10)} 생성` : '미수신'}, 사용자 실행과 분리`;
       };
       const renderCompareTray = () => {
         const tray = documentRef.getElementById('scr-compare-tray');
         if (!tray) return;
         tray.hidden = compareSymbols.size === 0;
         const list = documentRef.getElementById('scr-compare-list');
         if (list) {
           list.replaceChildren();
           if (compareSymbols.size) {
             // P1599 (F08): the tray reads the same rows as the table (the preview carries price-derived fields).
             const rows = activeRows || activePreview?.rows || selectScreenerState(store.getState())?.rows || [];
             // v57.81: a US listing outside the universe compares on its on-demand row (same formulas, computed at request
             // time); its rank cell stays empty — it is not in the published ranking. Not yet read → requested once.
             const onDemandRow = (symbol) => {
               const record = root?._aioOnDemandSymbol?.(symbol);
               if (!record) { root?._aioRequestOnDemandSymbol?.(symbol)?.then?.(() => { if (compareSymbols.has(symbol)) renderCompareTray(); }); return null; }
               return record.status === 'ready' && record.row ? { ...record.row, rank: null, screenRank: null, screenStatus: 'on-demand', onDemandComputedAt: record.computedAt } : null;
             };
             const compared = [...compareSymbols].map((symbol) => rows.find((row) => (row.sym || row.symbol) === symbol) || onDemandRow(symbol) || { sym: symbol, screenStatus: 'unavailable' });
             const table = documentRef.createElement('table');
             table.setAttribute('aria-label', '선택 종목 비교');
             table.className = 'scr-compare-table';
             const heading = documentRef.createElement('tr');
             const label = documentRef.createElement('th');
             label.scope = 'col'; label.textContent = '동일 기준 비교'; heading.append(label);
             for (const row of compared) {
               const th = documentRef.createElement('th');
               th.scope = 'col';
               const button = documentRef.createElement('button');
               button.type = 'button'; button.className = 'aio-btn-table'; button.textContent = row.sym;
               button.setAttribute('aria-label', `${row.sym}${row.name ? ` ${row.name}` : ''} 종목 상세`);
               button.addEventListener('click', () => tickerHandler(row.sym));
               th.append(button);
               // P1599 (F08): the company name under the ticker — a six-digit KRX code alone is not a name.
               if (row.name) { const name = documentRef.createElement('div'); name.textContent = row.name; name.className = 'scr-compare-name'; th.append(name); }
               heading.append(th);
             }
             const head = documentRef.createElement('thead'); head.append(heading); table.append(head);
             const body = documentRef.createElement('tbody');
             // P1599 (F08): a comparison row where no compared stock has a value is dropped and named once below.
             const emptyRows = [];
             for (const key of ['rank', 'price', 'ret1m', 'ret3m', 'rsi', 'vcpScore', 'value', 'quality']) {
               const contents = compared.map((row) => createColumnContent(documentRef, row, key, { readLiveData: liveReader }));
               if (key !== 'price' && contents.every((node) => /^[\s—-]*$/.test(typeof node === 'string' || typeof node === 'number' ? String(node) : node?.textContent || ''))) { emptyRows.push(SCREENER_COLUMN_REGISTRY.find((column) => column.key === key).label); continue; }
               const tr = documentRef.createElement('tr');
               const th = documentRef.createElement('th');
               th.scope = 'row'; th.textContent = SCREENER_COLUMN_REGISTRY.find((column) => column.key === key).label;
               tr.append(th);
               contents.forEach((content) => tr.append(cell(documentRef, content)));
               body.append(tr);
             }
             table.append(body); list.append(table);
             if (emptyRows.length) { const note = documentRef.createElement('p'); note.className = 'scr-compare-note'; note.textContent = `비교 종목 모두 값이 없어 뺀 항목: ${emptyRows.join(', ')}`; list.append(note); }
             const outside = compared.filter((row) => row.screenStatus === 'on-demand');
             if (outside.length) { const note = documentRef.createElement('p'); note.className = 'scr-compare-on-demand'; note.textContent = `${outside.map((row) => row.sym).join(', ')}: 랭킹 대상 밖 종목 — 순위 칸은 비우고, 다른 값은 ${String(outside[0].onDemandComputedAt || '').slice(0, 10)} 요청 시 같은 공식으로 계산했습니다.`; list.append(note); }
           }
         }
         const count = documentRef.getElementById('scr-compare-count');
         if (count) count.textContent = String(compareSymbols.size);
       };
       const saveCurrentScreen = () => {
         if (!activeDefinition || typeof workbench.setSavedScreens !== 'function') return;
         const state = selectScreenerState(store.getState()) || {};
         const saved = createSavedScreen({ definition: activeDefinition });
         const current = Array.isArray(state.savedScreens) ? state.savedScreens : defaultScreens();
         const next = [...current.filter((screen) => screen.definition?.screenId !== saved.definition.screenId), saved];
         workbench.setSavedScreens(next);
         if (workbenchStatus) workbenchStatus.textContent = `이번 세션에 조건 저장, ${saved.label}, 영구 보관은 실행 입력 보관 또는 JSON 내보내기`;
       };
       // P1592 (F11): the value hint follows the chosen field — a fixed 'Technology, 70, 40' offered 70 for
       // a percentile select that only accepts its listed steps.
       const syncBuilderHint = () => {
         const field = documentRef.getElementById('scr-builder-field');
         const value = documentRef.getElementById('scr-builder-value');
         const definition = BUILDER_FIELDS.find((item) => item.value === field?.value);
         if (!definition || !value) return;
         const target = documentRef.getElementById(definition.target);
         const options = target?.options ? Array.prototype.slice.call(target.options).map((option) => option.value).filter((optionValue) => optionValue && optionValue !== '0') : null;
         value.placeholder = options?.length
           ? `허용값: ${options.slice(0, 6).join(', ')}${options.length > 6 ? ' …' : ''}`
           : ({ sector: '섹터 이름 (예: Technology)', setup: '구조·근거 이름', rank: '허용값: 40, 50, 65, 80', rsi: 'RSI 하한 (예: 40)', momentum: '3개월 수익률 하한 % (예: 10)', query: '티커 또는 이름' }[definition.value] || '값');
       };
       syncBuilderHint();
       const readVisualCondition = () => {
         const field = documentRef.getElementById('scr-builder-field');
         const value = documentRef.getElementById('scr-builder-value');
         const definition = BUILDER_FIELDS.find((item) => item.value === field?.value);
         const raw = value?.value?.trim();
         if (!definition || !raw) return null;
         // LC-65: 허용 범위 밖 입력을 조용히 버리지 않는다 — 셀렉트는 허용값 목록과 함께
         // 명시적으로 거부하고, 숫자 필드는 숫자 검증을 같은 parser로 통과한다.
         const target = documentRef.getElementById(definition.target);
         if (target && target.options) {
           const allowed = Array.prototype.slice.call(target.options).map((option) => option.value).filter((optionValue) => optionValue && optionValue !== '0');
           const matched = allowed.find((optionValue) => optionValue.toLowerCase() === raw.toLowerCase());
           if (!matched) return { error: `“${raw}”는 지원하지 않는 값입니다 — 허용값: ${allowed.join(', ')}` };
           return { field: definition.value, label: definition.label, value: matched, target: definition.target };
         }
         if (RUN_CONDITION_FIELDS.includes(definition.value)) {
           const numeric = Number(raw);
           if (!Number.isFinite(numeric)) return { error: `“${raw}”는 숫자가 아닙니다 — ${withTopicParticle(definition.label)} 숫자만 허용합니다` };
           if (numeric < 0) return { error: `“${raw}”는 허용 범위 밖입니다 — ${withTopicParticle(definition.label)} 0 이상만 허용합니다` };
         }
         return { field: definition.value, label: definition.label, value: raw, target: definition.target };
       };
       const buildVisualDefinition = () => {
         if (!activeDefinition) return null;
         const nodes = readBuilderConditions().flatMap((condition) => {
           const numeric = Number(condition.value);
           if (condition.field === 'rank' && Number.isFinite(numeric)) return [{ type: 'range', field: 'rank', min: numeric, nullPolicy: 'unknown' }];
           if (condition.field === 'rsi' && Number.isFinite(numeric)) return [{ type: 'range', field: 'price.rsi14', min: numeric, nullPolicy: 'unknown' }];
           if (condition.field === 'momentum' && Number.isFinite(numeric)) return [{ type: 'range', field: 'price.ret3m', min: numeric, nullPolicy: 'unknown' }];
           return [];
         });
         const current = activeDefinition.filtersAST?.type === 'and' ? activeDefinition.filtersAST.children || [] : [activeDefinition.filtersAST];
         return createScreenDefinition({ ...activeDefinition, filtersAST: { type: 'and', children: [
           ...current.filter(node => node?.origin !== 'visual-builder' && node?.origin !== 'market-scope'),
           ...nodes.map(node => ({ ...node, origin: 'visual-builder' })),
           { type: 'enum', field: 'identity.market', values: [selectedValue(documentRef, 'scr-listing-market') || 'US'], origin: 'market-scope', nullPolicy: 'unknown' }
         ] } });
       };
       const setProfileButtons = () => {
        const active = profileReader();
        page.querySelectorAll('[data-aio-screener-action="profile"]').forEach((button) => {
          button.classList.toggle('active', button.dataset.aioScreenerArg === active);
        });
        const description = documentRef.getElementById('scr-profile-desc');
        if (description) description.textContent = PROFILE_DESCRIPTIONS[active] || PROFILE_DESCRIPTIONS.balanced;
      };
        // P1165 (19 작업 카드): 실행 전 미리보기는 선택한 정의 + 현재 snapshot으로 계산한다.
        // 조건(내장/사용자)이 바뀌면 definitionHash가 바뀌므로 같은 키에서만 캐시한다.
        const ensurePreview = () => {
          if (activeResult) { activePreview = null; activePreviewKey = null; return null; }
          const definition = buildVisualDefinition() || activeDefinition;
          if (!definition || typeof workbench.preview !== 'function') return null;
          const current = selectScreenerState(store.getState());
          const key = `${definition.definitionHash || definition.screenId}|${current?.snapshotId || 'unknown'}|${current?.workbenchHash || ''}`;
          if (key === activePreviewKey && activePreview) return activePreview;
          try { activePreview = workbench.preview(definition); activePreviewKey = key; }
          catch (_) { activePreview = null; activePreviewKey = null; }
          return activePreview;
        };
        const rerender = () => { setProfileButtons(); renderNow(); };
        const tickerHandler = (symbol) => {
          returnView = { symbol, scrollTop: documentRef.querySelector('.content')?.scrollTop || 0 };
         return (onTicker || ((value) => root?.showTicker?.(value)))?.(symbol);
       };
       // P1592 (F09): the preset select, the column checklist and the table read one state. The checklist
       // used to be drawn only on the slow path, so after a preset change it still showed the old columns
       // and one tick rebuilt the table from the stale set. Custom picks name themselves in the select.
       function syncColumnControls() {
         const presetSelect = documentRef.getElementById('scr-column-preset');
         if (presetSelect) {
           let customOption = presetSelect.querySelector('option[value="custom"]');
           if (columnState.preset === 'custom' && !customOption) {
             customOption = documentRef.createElement('option');
             customOption.value = 'custom';
             customOption.textContent = '직접 선택';
             presetSelect.appendChild(customOption);
           }
           if (customOption) customOption.hidden = columnState.preset !== 'custom';
           presetSelect.value = columnState.preset;
         }
         renderColumnChooser(documentRef, page, columnState.preset, columnState.custom, (columns) => {
           columnState.preset = 'custom';
           columnState.custom = columns;
           renderNow();
         });
       }
       renderNow = () => {
         const whyFocus = whyDrawerNode?.contains(documentRef.activeElement) ? documentRef.activeElement : null;
         const preview = ensurePreview();
         syncColumnControls();
         syncBuilderHint();
         renderBuilderConditions(documentRef, readBuilderConditions());
         const renderArgs = { documentRef, root, store, readLiveData: liveReader, readWatchlist: watchlistReader, readAliases: aliasReader, sortState, visibleLimit, onExplain: explainRow, onCompare: (row) => toggleCompare(row?.sym || row?.symbol), onVisibleSymbols: requestVisibleQuotes, selectedSymbols, compareSymbols, columnPreset: columnState.preset, customColumns: columnState.custom, onWatchlistToggle: (symbol) => { (onWatchlistToggle || root?._aioWLToggle)?.(symbol); rerender(); syncWhyWatchlist(activeRow?.sym || activeRow?.symbol || ''); }, rowsOverride: activeRows || preview?.rows || null, workbenchResult: activeResult, previewResult: preview, onDataChange: () => renderNow() };
         render(renderArgs);
         const released = refreshInspector();
         // 개편 v2 (3c): the first wide render selects the first row for the inspector, then marks it in the table once.
         if (autoInspect() || released) render(renderArgs);
         // P1165 (12 U01): 실행 전 상태 줄도 선택한 정의의 미리보기를 인용한다 — 파이프라인 기본
         // 수치를 '선택한 정의의 통과'로 읽히게 두지 않는다. 실행하면 activeResult가 대신한다.
         if (!activeResult && preview && workbenchStatus) {
           // P1431: plain status; the definition id/hash stay on the element for audit, not in the sentence.
           const screenLabel = documentRef.getElementById('scr-screen-select')?.selectedOptions?.[0]?.textContent || preview.definition?.screenId || '선택한 조건';
           workbenchStatus.textContent = `${screenLabel} 미리보기, 대상 ${scopedRows(preview.rows || [], selectedValue(documentRef, 'scr-listing-market') || 'US').length}종목 중 조건 통과 ${scopedRows(preview.rows || [], selectedValue(documentRef, 'scr-listing-market') || 'US').filter(row => row.screenStatus === 'passed').length}, 조건 판단 자료 부족 ${scopedRows(preview.rows || [], selectedValue(documentRef, 'scr-listing-market') || 'US').filter(row => row.screenStatus === 'unavailable').length}`;
           workbenchStatus.title = `${preview.definition?.screenId || '—'}, ${String(preview.definition?.definitionHash || '').slice(0, 8)}, 조건 실행을 누르면 이 입력으로 고정합니다`;
         }
         renderCompareTray();
         syncWhyCompare(activeRow?.sym || activeRow?.symbol || '');
         placeWhyDrawer();
         if (whyFocus && documentRef.activeElement !== whyFocus && whyDrawerNode?.contains(whyFocus)) whyFocus.focus?.({ preventScroll: true });
       };
       // v57.81: the 종목 screen hands an out-of-universe listing to this tray (queued while the screener is not mounted).
       const addCompare = (symbol) => {
         const id = String(symbol || '').trim().toUpperCase();
         if (!id || compareSymbols.has(id) || compareSymbols.size >= 5) return compareSymbols.has(id);
         compareSymbols.add(id); renderCompareTray(); renderNow(); return true;
       };
       root._aioAddScreenerCompare = addCompare;
       (Array.isArray(root._aioPendingCompare) ? root._aioPendingCompare.splice(0) : []).forEach(addCompare);
       bag.add(() => { if (root._aioAddScreenerCompare === addCompare) delete root._aioAddScreenerCompare; });
       const selectDefinition = (screenId) => {
         const screen = defaultScreens().find(item => item.definition.screenId === screenId);
         if (!screen) return;
         ++runGeneration;
         activeDefinition = screen.definition;
         activeScreenId = screen.definition.screenId;
         activeResult = null;
         activeRows = null;
         // v58.56: '실행 통과만' is the table's scope, not a filter of the previous screen — switching screens used to clear it,
         // so the first preset tap showed every rejected row (904 instead of 243) after the first view had shown passes only.
         Object.keys(FILTER_LABELS).filter((id) => id !== 'scr-passed-only').forEach(id => {
           const control = documentRef.getElementById(id);
           if (control?.type === 'checkbox') control.checked = false;
           else if (control) control.value = id === 'scr-min-rank' ? '0' : '';
         });
         visibleLimit.value = 12;
         sortState.column = 'screenRank'; sortState.ascending = true;
         documentRef.getElementById('scr-order').value = 'screenRank';
         syncDefinitionEditor(); renderWorkbench(); renderNow();
       };
       const handleClick = (event) => {
         const actionNode = event.target.closest?.('[data-aio-screener-action]');
         const header = event.target.closest?.('[data-scr-sort]');
        if (!actionNode && !header) return;
        event.preventDefault();
        event.stopPropagation();
         if (header) {
           const column = header.dataset.scrSort;
           if (sortState.column === column) sortState.ascending = !sortState.ascending;
           else { sortState.column = column; sortState.ascending = column === 'sym' || column === 'sector' || column === 'fwdPe'; }
           const orderSelect = documentRef.getElementById('scr-order');
           if (orderSelect) {
             let option = [...orderSelect.options].find(item => item.value === column);
             if (!option) { option = documentRef.createElement('option'); option.value = column; orderSelect.append(option); }
             option.textContent = `${SCREENER_COLUMN_REGISTRY.find(item => item.key === column)?.label || column} ${sortState.ascending ? '오름차순' : '내림차순'}`; orderSelect.value = column;
           }
          // P1592 (F03): sorting reorders the same rows — keep what the reader already expanded.
          renderNow();
          // v57.61 WCAG 2.4.3: the header row is rebuilt on render — return focus to the same column's sort button.
          [...page.querySelectorAll('[data-scr-sort]')].find((node) => node.dataset.scrSort === column)?.focus?.();
          return;
        }
         const action = actionNode.dataset.aioScreenerAction;
         const argument = actionNode.dataset.aioScreenerArg;
         if (action === 'open-filters') { setFilterSheet(true); return; }
         if (action === 'close-filters') { setFilterSheet(false); return; }
         // A control in the sheet that leaves the 순위 view (+ 조건 추가 → 맞춤 조건) closes the sheet first.
         if ((action === 'view' || action === 'tab') && filterSheet?.contains(actionNode)) setFilterSheet(false, { returnFocus: false });
         if (action === 'screen-preset' || action === 'screen-select') {
           selectDefinition(argument);
         } else if (action === 'screen-new') {
           ++runGeneration;
           activeDefinition = defaultScreens()[0]?.definition || null;
           activeScreenId = null;
           activeResult = null;
           activeRows = null;
           syncDefinitionEditor();
           if (workbenchStatus) workbenchStatus.textContent = '새 화면 초안, 조건을 추가한 뒤 실행하세요.';
           renderNow();
         } else if (action === 'screen-save') {
           saveCurrentScreen();
         } else if (action === 'screen-run-visual') {
           try {
             const visualDefinition = buildVisualDefinition();
             if (!visualDefinition) throw new Error('SCREEN_DRAFT_EMPTY');
             runDefinition(visualDefinition);
             if (workbenchStatus && readBuilderConditions().some((condition) => ['query', 'setup', 'sector'].includes(condition.field))) workbenchStatus.textContent += ', 검색/구조/섹터는 현재 표 필터이며 저장 실행 조건에는 포함되지 않음';
           } catch (error) {
             if (workbenchStatus) workbenchStatus.textContent = '실행할 수 없습니다, 조건을 확인하세요.';
             const detail = documentRef.getElementById('scr-definition-error-detail');
             if (detail) { detail.hidden = false; detail.textContent = error?.message || 'invalid_visual_definition'; }
           }
         } else if (action === 'screen-run') {
           try {
             const parsed = JSON.parse(definitionEditor?.value || '');
             const saved = parsed.definition ? importSavedScreen(JSON.stringify(parsed)) : createSavedScreen({ definition: parsed });
             runDefinition(saved.definition);
           } catch (error) {
             if (workbenchStatus) workbenchStatus.textContent = '실행할 수 없습니다, JSON 형식 또는 화면 조건을 확인하세요.';
             const detail = documentRef.getElementById('scr-definition-error-detail');
             if (detail) { detail.hidden = false; detail.textContent = error?.message || 'invalid_json'; }
           }
         } else if (action === 'screen-import') {
           try {
             const parsed = JSON.parse(definitionEditor?.value || '');
             const saved = parsed.definition ? importSavedScreen(JSON.stringify(parsed)) : createSavedScreen({ definition: parsed });
             ++runGeneration;
             activeDefinition = saved.definition;
             activeScreenId = activeDefinition.screenId;
             activeResult = null;
             activeRows = null;
             if (workbenchStatus) workbenchStatus.textContent = '화면 정의를 불러왔습니다, 실행 전 미리보기 상태입니다.';
             const detail = documentRef.getElementById('scr-definition-error-detail');
             if (detail) detail.hidden = true;
             renderWorkbench();
             renderNow();
           } catch (error) {
             if (workbenchStatus) workbenchStatus.textContent = '가져올 수 없습니다, JSON 형식을 확인하세요.';
             const detail = documentRef.getElementById('scr-definition-error-detail');
             if (detail) { detail.hidden = false; detail.textContent = error?.message || 'invalid_json'; }
           }
         } else if (action === 'screen-export') {
           if (!activeDefinition) activeDefinition = defaultScreens()[0]?.definition || null;
           syncDefinitionEditor();
           documentRef.getElementById('scr-developer-drawer')?.setAttribute('open', '');
           if (workbenchStatus) workbenchStatus.textContent = '개발자 영역에 ScreenDefinition을 내보냈습니다.';
         } else if (action === 'profile') {
          ++runGeneration; activeResult = null; activeRows = null; activePreview = null; activePreviewKey = null;
          root?._aioSetProfile?.(argument);
          Promise.resolve(onProfileChange?.(argument)).finally(rerender);
         } else if (action === 'toggle-filters') {
           documentRef.getElementById('scr-adv-filter-row')?.classList.toggle('active');
         } else if (action === 'toggle-columns') {
           columnState.preset = columnState.preset === 'all' ? 'discovery' : 'all';
           const presetSelect = documentRef.getElementById('scr-column-preset');
           if (presetSelect) presetSelect.value = columnState.preset;
           renderNow();
         } else if (action === 'column-preset') {
           columnState.preset = argument || 'discovery';
           columnState.custom = [];
           renderNow();
         } else if (action === 'column-chooser') {
           const chooser = documentRef.getElementById('scr-column-chooser');
           if (chooser) chooser.hidden = !chooser.hidden;
         } else if (action === 'tab') {
           // 개편 v2: 랭킹 is the 순위 view; 팩터·과거 검증·조건별 통계 are sections of the one 사후 검증 view.
           const fromSeg = !!actionNode.closest('.scr-view-seg');
           setView(argument === 'ranking' ? 'rank' : 'validation', { focusTab: fromSeg });
           if (argument === 'factors' || argument === 'evidence') {
             const smooth = !root?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
             documentRef.getElementById(`scr-tab-${argument}`)?.scrollIntoView?.({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
           } else if (!fromSeg) scrollToTop();
         } else if (action === 'view') {
           const fromSeg = !!actionNode.closest('.scr-view-seg');
           // v58.80 run-5 (breaker #1): 결과 보기 under the 맞춤 조건 count shows that count — the conditions search every stock,
           // as a theme handoff does (v58.75), instead of only the last run's passed set.
           if (actionNode.classList.contains('scr-custom-go')) { const passedOnly = documentRef.getElementById('scr-passed-only'); if (passedOnly) passedOnly.checked = false; visibleLimit.value = 12; renderNow(); }
           setView(argument, { focusTab: fromSeg });
           if (!fromSeg) scrollToTop();
           if (argument === 'custom' && !fromSeg) documentRef.querySelector('#scr-custom select')?.focus?.({ preventScroll: true });
         } else if (action === 'why-watchlist') {
           const symbol = argument || activeRow?.sym || activeRow?.symbol;
           if (symbol) { (onWatchlistToggle || root?._aioWLToggle)?.(symbol); rerender(); syncWhyWatchlist(symbol); }
         } else if (action === 'load-more') {
           visibleLimit.value += 12;
           renderNow();
         } else if (action === 'add-builder-condition') {
           const valueInput = documentRef.getElementById('scr-builder-value');
           const condition = readVisualCondition();
           if (condition && condition.error) {
             // LC-65: 무효 입력은 필드·상태줄·접근성을 함께 물린다 — 이전 preview/run이
             // 그대로 남아 "95를 실행했다"고 읽히지 않도록 명시적으로 거부한다.
             if (workbenchStatus) workbenchStatus.textContent = condition.error;
             if (valueInput) { valueInput.setAttribute('aria-invalid', 'true'); valueInput.focus(); }
             return;
           }
           if (!condition) {
             if (workbenchStatus) workbenchStatus.textContent = '조건을 선택하고 값을 입력하세요.';
             return;
           }
           if (valueInput) valueInput.removeAttribute('aria-invalid');
           const target = documentRef.getElementById(condition.target);
           if (target) target.value = condition.value;
           if (workbenchStatus) {
             workbenchStatus.textContent = RUN_CONDITION_FIELDS.includes(condition.field)
               ? `${condition.label}: ${condition.value} — 실행 조건으로 추가됨 (실행 정의 변경, 미리보기 갱신)`
               : `${condition.label}: ${condition.value} — 표시 필터로만 적용 (표 범위만, 실행 정의 미포함)`;
           }
           renderNow();
         } else if (action === 'remove-builder-condition') {
           const condition = readBuilderConditions()[Number(argument)];
           const target = condition && documentRef.getElementById(condition.target);
           if (target) target.value = condition.field === 'rank' ? '0' : '';
           visibleLimit.value = 12;
           renderNow();
         } else if (action === 'passed-only') {
           const passedOnly = documentRef.getElementById('scr-passed-only');
           if (passedOnly) passedOnly.checked = true;
           visibleLimit.value = 12;
           renderNow();
         } else if (action === 'clear-filter') {
           const target = documentRef.getElementById(argument);
           if (target) { if (target.type === 'checkbox') target.checked = false; else target.value = ''; }
           visibleLimit.value = 12;
           renderNow();
         } else if (action === 'reset-all-filters') {
           ['scr-market', 'scr-sector', 'scr-cap', 'scr-text-search', 'scr-setup', 'scr-rsi-min', 'scr-rsi-max', 'scr-min-mom', 'scr-custom-conditions'].forEach((id) => { const field = documentRef.getElementById(id); if (field) field.value = ''; });
           const rank = documentRef.getElementById('scr-min-rank'); if (rank) rank.value = '0';
           const watchlist = documentRef.getElementById('scr-watchlist-only'); if (watchlist) watchlist.checked = false;
           const passedOnly = documentRef.getElementById('scr-passed-only'); if (passedOnly) passedOnly.checked = true;
           visibleLimit.value = 12;
           renderNow();
         } else if (action === 'reset-filters') {
          ['scr-min-rank', 'scr-rsi-min', 'scr-rsi-max', 'scr-min-mom'].forEach((id) => { const field = documentRef.getElementById(id); if (field) field.value = id === 'scr-min-rank' ? '0' : ''; });
          const setup = documentRef.getElementById('scr-setup');
          if (setup) setup.value = '';
          const watchlist = documentRef.getElementById('scr-watchlist-only');
          if (watchlist) watchlist.checked = false;
           visibleLimit.value = 12;
           renderNow();
         } else if (action === 'open-ticker') {
           tickerHandler(argument || activeRow?.sym || activeRow?.symbol);
         } else if (action === 'open-chart-levels') {
           // v58.75 (D6): name the 종목 screen's company, open its chart and land on the level map.
           const symbol = argument || activeRow?.sym || activeRow?.symbol;
           if (symbol) {
             setStockSubject({ root, documentRef, symbol });
             root.__aioChartScrollTo = 'chart-levels';
             root.showPage?.('technical');
           }
         } else if (action === 'why-compare') {
           const symbol = argument || activeRow?.sym || activeRow?.symbol;
           toggleCompare(symbol);
         } else if (action === 'close-why') {
           closeWhyDrawer();
         } else if (action === 'show-compare') {
           const tray = documentRef.getElementById('scr-compare-tray');
           if (tray && !tray.hidden) {
             if (!tray.hasAttribute('tabindex')) tray.tabIndex = -1;
             tray.focus({ preventScroll: true });
             tray.scrollIntoView?.({ block: 'start', behavior: root?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 'auto' : 'smooth' });
           }
           const notice = documentRef.getElementById('scr-compare-feedback');
           if (notice) notice.hidden = true;
         } else if (action === 'clear-compare') {
           compareSymbols.clear(); renderCompareTray(); renderNow();
         } else if (action === 'focus-mode') {
           documentRef.body.classList.toggle('aio-screener-focus');
           actionNode.setAttribute('aria-pressed', documentRef.body.classList.contains('aio-screener-focus') ? 'true' : 'false');
          }
       };
       const handleInput = (event) => {
         if (!event.target.closest?.('#page-screener')) return;
         if (event.target.matches?.('#scr-listing-market')) {
           root._aioScreenerListingMarket = event.target.value;
           activeRow = null; autoInspected = false; // 개편 v2: the inspector restarts on the new market's first row
           if (whyDrawerNode) whyDrawerNode.hidden = true;
           ++runGeneration; activeResult = null; activeRows = null; activePreview = null; activePreviewKey = null;
           selectedSymbols.clear(); compareSymbols.clear(); visibleLimit.value = 12; readSignature = '';
           for (const id of ['scr-market', 'scr-sector']) { const field = documentRef.getElementById(id); if (field) { field.value = ''; delete field.dataset.aioValues; } }
           fillControls(); rerender(); renderRead();
         } else if (event.target.matches?.('#scr-universe-scope')) {
           if (event.type !== 'change') return;
           writeUniverseScope(root, event.target.value);
           ++runGeneration; activeResult = null; activeRows = null; activePreview = null; activePreviewKey = null;
           selectedSymbols.clear(); compareSymbols.clear(); visibleLimit.value = 12; readSignature = '';
           for (const id of ['scr-market', 'scr-sector']) { const field = documentRef.getElementById(id); if (field) delete field.dataset.aioValues; }
           renderNow();
           Promise.resolve(onUniverseScopeChange?.(event.target.value)).catch(() => {});
         } else if (event.target.matches?.('#scr-order')) {
           sortState.column = event.target.value; sortState.ascending = event.target.value === 'screenRank';
           visibleLimit.value = 12; renderNow();
         } else if (event.target.matches?.('#scr-screen-select')) {
           selectDefinition(event.target.value);
         } else if (event.target.matches?.('#scr-builder-field')) {
           syncBuilderHint();
         } else if (event.target.matches?.('#scr-column-preset')) {
           columnState.preset = event.target.value || 'discovery';
           columnState.custom = [];
           renderNow();
         } else if (event.target.matches?.('#scr-market, #scr-sector, #scr-cap, #scr-setup, #scr-min-rank, #scr-rsi-min, #scr-rsi-max, #scr-min-mom, #scr-text-search, #scr-watchlist-only, #scr-passed-only, #scr-custom-conditions')) {
           event.stopPropagation();
           // v57.81: the search box's blur-time change must not re-render a table the pause already rendered, or the
           // first tap on a row button (비교 +, 관심) after typing lands on a node that the re-render just replaced.
           if (event.type === 'change' && event.target.id === 'scr-text-search' && !searchTimer) return;
           // v57.61: typing in the name·sector search re-renders at most once per pause (150ms); change renders at once.
           if (searchTimer) { clearTimeout(searchTimer); searchTimer = null; }
           if (event.type === 'input' && event.target.id === 'scr-text-search') {
             searchTimer = setTimeout(() => { searchTimer = null; visibleLimit.value = 12; renderNow(); }, 150);
             return;
           }
           visibleLimit.value = 12;
           renderNow();
         }
       };
       let searchTimer = null;
       bag.add(() => { if (searchTimer) clearTimeout(searchTimer); searchTimer = null; });
       // LC-65: 키보드 Enter도 클릭과 같은 parser/validator를 통과한다.
       const handleBuilderKeydown = (event) => {
         if (event.key !== 'Enter') return;
         if (!event.target.matches?.('#scr-builder-value, #scr-builder-field')) return;
         event.preventDefault();
         const add = event.target.closest?.('#page-screener')?.querySelector('[data-aio-screener-action="add-builder-condition"]');
         add?.click();
       };
      const fillSelect = (id, key, label) => {
        const select = documentRef.getElementById(id);
        if (!select) return;
        const values = [...new Set(scopedRows(selectScreenerState(store.getState())?.rows || [], selectedValue(documentRef, 'scr-listing-market') || 'US').map((row) => row[key]).filter(Boolean))].sort();
        const signature = `${selectedValue(documentRef, 'scr-listing-market')}|${values.join('|')}`;
        if (select.dataset.aioValues === signature) return;
        const current = select.value;
        const options = [documentRef.createElement('option'), ...values.map(() => documentRef.createElement('option'))];
        options[0].value = '';
        options[0].textContent = label;
        values.forEach((value, index) => {
          options[index + 1].value = value;
          // 2026-10-14 audit #18: Korean option names; the value stays the artifact's own key.
          options[index + 1].textContent = key === 'index' ? (INDEX_LABELS[value] || INDEX_CODE_LABELS[value]?.[0] || value) : key === 'sector' ? sectorLabel(value) : value;
          if (key === 'index' && INDEX_CODE_LABELS[value]) options[index + 1].title = INDEX_CODE_LABELS[value][1];
        });
        select.replaceChildren(...options);
        select.value = values.includes(current) ? current : '';
        select.dataset.aioValues = signature;
      };
      const fillControls = () => {
        fillSelect('scr-market', 'index', '전체 지수'); fillSelect('scr-sector', 'sector', '전체 섹터');
        // v57.50 I01: apply a handed-over sector once its option exists (rows may arrive after mount).
        const sectorSelect = pendingSector ? documentRef.getElementById('scr-sector') : null;
        if (sectorSelect) {
          const options = [...sectorSelect.options].map((option) => option.value).filter(Boolean);
          const match = options.includes(pendingSector) ? pendingSector : sectorsForEtf(pendingSector).find((name) => options.includes(name));
          if (match) { sectorSelect.value = match; pendingSector = null; visibleLimit.value = 12; }
        }
      };
      const renderWithControls = () => { fillControls(); renderWorkbench(); rerender(); renderRead(); };
      page.addEventListener('click', handleClick);
      page.addEventListener('input', handleInput);
      page.addEventListener('change', handleInput);
      page.addEventListener('keydown', handleBuilderKeydown);
      bag.add(() => page.removeEventListener('click', handleClick));
      bag.add(() => page.removeEventListener('input', handleInput));
      bag.add(() => page.removeEventListener('change', handleInput));
      bag.add(() => page.removeEventListener('keydown', handleBuilderKeydown));
      bag.add(subscribeToSlices(store, ['screener'], renderWithControls));
      const eventTarget = documentRef || root;
      const onDataEvent = (event) => {
        if (event?.type === 'aio:historyLoaded') readSignature = '';
        renderWithControls();
      };
      ['aio:refresh:done', 'aio:liveQuotes', 'aio:historyLoaded'].forEach((eventName) => {
        eventTarget?.addEventListener?.(eventName, onDataEvent);
        bag.add(() => eventTarget?.removeEventListener?.(eventName, onDataEvent));
      });
      const windowTarget = root && root !== eventTarget ? root : null;
      if (windowTarget?.addEventListener) {
        windowTarget.addEventListener('aio:historyLoaded', onDataEvent);
        bag.add(() => windowTarget.removeEventListener?.('aio:historyLoaded', onDataEvent));
      }
      mounted = true;
      setView('rank');
      renderWithControls();
      renderCompareTray();
      if (returnView) {
        const view = returnView;
        returnView = null;
        const restore = () => {
          if (!mounted) return;
          const row = [...page.querySelectorAll('[data-aio-screener-ticker]')].find((node) => node.dataset.aioScreenerTicker === view.symbol);
          row?.focus?.({ preventScroll: true });
          const content = documentRef.querySelector('.content');
          if (content) content.scrollTop = view.scrollTop;
        };
        if (root?.requestAnimationFrame) {
          const frame = root.requestAnimationFrame(restore);
          bag.add(() => root.cancelAnimationFrame?.(frame));
        } else restore();
      }
      return () => {
        if (!mounted) return;
        mounted = false;
        bag.dispose();
        if (page.dataset.aioArchitectureRoute === 'screener') delete page.dataset.aioArchitectureRoute;
        if (page.dataset.aioArchitectureSlice === 'screener') delete page.dataset.aioArchitectureSlice;
        if (page.dataset.aioArchitectureRenderer === 'native') delete page.dataset.aioArchitectureRenderer;
      };
    }
  };
}
