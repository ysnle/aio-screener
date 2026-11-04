// Screener row model: column registry, presets, row readers and sort order (no DOM wiring).
import { measureFactorOverlap } from '../../../domain/screener/factor-overlap.js';
import { SCREENER_FIELD_REGISTRY, fieldValueForPurpose, readRowNumber } from '../../../data/contracts/screener.js';
import { capFilterValue, numberText, visibleRank, rankGrade, vcpStageLabel, describeStaleDates, profileComputability, factorSessionLag, describeRankingHold } from '../../../domain/screener/row-presentation.js';
import { screenerMarket, marketRows } from '../../../domain/screener/market-scope.js';
import { bufferedTrend, trendHeldWithMargin } from '../../../domain/technical/bands.js';
import { RULES } from '../../../domain/rules/thresholds.js';
import { consensusView } from '../../../domain/fundamental/consensus-read.js';
import { consensusRowFor } from '../../../data/consensus-estimates.js';
import { CHANNEL_SIGNAL_KEYS, channelSignalValue } from '../../../domain/screener/channel-signals.js';
import { themeStagesFor, scenarioStateCurrent } from '../../../domain/scenarios/theme-stage.js';
import { koreanThemeGroups } from '../../../domain/market/korea-participation.js';
import { signedText, finiteNumber as finite } from '../../../domain/shared/number.js';
// Row arrays from the store and the workbench are replaced, never edited in place, so one market's slice is cut once
// per array. Handing renderBacktest the same slice also lets the factor-overlap cache below hit (a fresh filter result
// every render re-measured the overlap on each keystroke).
const marketRowsCache = new WeakMap();
export function scopedRows(rows, market) {
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
export function currentOverlap(rows, ranking, market = null) {
  if (!Array.isArray(rows) || !rows.length) return null;
  if (!overlapCache.has(rows)) overlapCache.set(rows, new Map());
  const byMarket = overlapCache.get(rows);
  const key = market || '*';
  if (!byMarket.has(key)) byMarket.set(key, measureFactorOverlap(market ? marketRows(rows, market) : rows, ranking?.activeFactors || []));
  return byMarket.get(key);
}
export { capFilterValue, visibleRank, rankGrade, vcpStageLabel, describeStaleDates, profileComputability, factorSessionLag, describeRankingHold };
// v57.81: universe scope (기본/확장) and the ranking contract labels.

// 2026-10-14 audit #18: index keys as the artifact writes them → the names a Korean reader uses.
export const INDEX_LABELS = Object.freeze({ SP500: 'S&P 500', SP400: 'S&P 400', NASDAQ100: '나스닥100', NASDAQ: '나스닥', RUSSELL2000: '러셀2000' });
// v57.54: exchange codes read as jargon in the 지수 filter — Korean name first, the code kept in brackets, a short
// explanation on hover.
export const INDEX_CODE_LABELS = Object.freeze({
  NYSE: ['뉴욕증권거래소(NYSE)', '미국 뉴욕증권거래소 상장 종목'],
  ADR: ['미국예탁증서(ADR)', '해외 기업 주식을 미국 시장에서 거래하도록 만든 예탁증서'],
  OTC: ['장외 거래(OTC)', '거래소 정규 상장이 아닌 장외 시장에서 거래되는 종목'],
  TSE: ['도쿄 상장(TSE)', '도쿄증권거래소 상장 — 미국에서는 예탁증서 등으로 거래'],
  TWSE: ['대만 상장(TWSE)', '대만증권거래소 상장 — 미국에서는 예탁증서 등으로 거래']
});

// 2026-10-14 audit #5: each ranked row carries its themes' stages (same rows as 테마 시나리오) so the reading can count
// the top fifth by stage. Nothing is attached when the per-refresh scenario state is not current.
export function withThemeStages(root, rows) {
  if (!scenarioStateCurrent(root?._aioScenarioState)) return rows; // v57.81: the producer's 'current' (theme-stage.js)
  const membership = themeMembership(root, rows); // v58.75: shared with the 테마 단계 column
  return rows.map((row) => {
    const ids = membership.get(String(row?.sym || '').toUpperCase());
    return ids && Number.isFinite(row?.screenRank) ? { ...row, themeStages: themeStagesFor(root, { symbol: row.sym, themeIds: [...ids] }) } : row;
  });
}

export const FIELD_BY_COLUMN = new Map(SCREENER_FIELD_REGISTRY.fields.map(field => [field.rowKey, field.fieldId]));

export const PROFILE_DESCRIPTIONS = {
  // v57.77: one line — where the weights and the validation live is the tabs' job, not this label's.
  balanced: '기본 균형 비중으로 합산',
  momentum: '단기 추세·모멘텀 중심',
  swing: '중기 기술적 매매',
  value: '저평가·장기 보유',
  lowrisk: '방어적·저변동성 우선'
};

export const REGIME_DESCRIPTIONS = {
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
  { key: 'themeStage', label: '테마 단계', hint: '이 종목이 속한 테마의 지금 단계 — 테마 시나리오·종목 개요과 같은 값. 테마 상태 자료가 최신일 때만 표시', sortable: false, align: 'left', width: 150, group: 'evidence' },
  { key: 'news', label: '최신뉴스·근거', sortable: false, align: 'left', width: 190, group: 'evidence' }
]);

// P1429: 가격 comes only from the visible-row live quote (P715: the artifact publishes no per-symbol
// price), and on 2026-10-04 the live site showed 미수신 on 10 of 12 rows while the Worker deploy was
// blocked. 52주 고점 대비 comes from the artifact itself, so the default presets always carry a
// price-position reading even when the quote is missing.
// v57.54: the '상위 N%' column repeated the percentile beside it as emphasis ("100 · 상위 1%") while the post-check
// above says the ranking does not yet distinguish later returns. The presets show the percentile once; 'grade'
// stays in the registry for the 전체/직접 고른 컬럼.
export const COLUMN_PRESETS = Object.freeze({
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

export const PRESET_SHORT_LABELS = Object.freeze({ 'preset-balanced': '균형', 'preset-momentum': '모멘텀', 'preset-trend': '추세', 'preset-lowvol': '저변동', 'preset-quality': '퀄리티', 'preset-pivot-quiet': '피벗', 'preset-breakout-volume': '돌파' });

export const FILTER_LABELS = Object.freeze({
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

export const BUILDER_FIELDS = Object.freeze([
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
export const RUN_CONDITION_FIELDS = Object.freeze(['rank', 'rsi', 'momentum']);

export function text(documentRef, value) {
  const node = documentRef.createElement('span');
  node.textContent = value == null || value === '' ? '—' : String(value);
  return node;
}
export function cell(documentRef, value, className = '') {
  const node = documentRef.createElement('td');
  if (className) node.className = className;
  if (value && value.nodeType) node.appendChild(value);
  else node.appendChild(text(documentRef, value));
  return node;
}
export function returnText(value) { return finite(value) == null ? '—' : `${signedText(value, 1)}%`; }
export function returnColor(value) { return finite(value) == null ? 'var(--text-muted)' : value >= 0 ? 'var(--dir-up)' : 'var(--dir-down)'; }
// v57.81: momentum and trend scores are z-scores inside the sector, so a sector-wide selloff leaves its best names high.
// Green needs the absolute check too (bands.js bufferedTrend 'up'); otherwise a high score is shown in the neutral colour.
export const SECTOR_RELATIVE_PRICE_FACTORS = new Set(['momentum', 'trend']);
export function factorScoreColor(key, value, row, neutral = 'var(--text-primary)') {
  const score = finite(value);
  if (score == null) return 'var(--text-muted)';
  if (score >= 66) return !SECTOR_RELATIVE_PRICE_FACTORS.has(key) || bufferedTrend(row)?.id === 'up' ? 'var(--data-green)' : neutral;
  return score >= 40 ? 'var(--data-amber)' : 'var(--data-red)';
}
export function entryTiming(row) {
  const rank = finite(row.rank);
  const rsi = readRowNumber(row, 'rsi', 'display');
  const ret3m = readRowNumber(row, 'ret3m', 'display');
  const momentum = readRowNumber(row, 'ret1m', 'display') ?? (ret3m == null ? null : ret3m / 3);
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

export function selectedValue(documentRef, id) { return documentRef.getElementById(id)?.value || ''; }

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
// P1507: 50-day distance ÷ average daily range (ADR stands in for ATR). Null when either input is missing.
export function extensionMultiple(row) {
  const pct = readRowNumber(row, 'pctSma50', 'display');
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
export function rowThemeStages(row) {
  if (!screenerRuntime.themeStageRoot || !scenarioStateCurrent(screenerRuntime.themeStageRoot._aioScenarioState)) return null;
  const ids = themeMembership(screenerRuntime.themeStageRoot, screenerRuntime.themeStageRows).get(String(row?.sym || row?.symbol || '').toUpperCase());
  return ids ? themeStagesFor(screenerRuntime.themeStageRoot, { symbol: row.sym || row.symbol, themeIds: [...ids] }) : [];
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
export function conditionMarginText(items) {
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

export function forwardPe(row) { return consensusView(row, consensusRowFor(screenerRuntime.consensusRoot, row?.sym || row?.symbol))?.fwdPe ?? null; }
// 2026-10-14 custom conditions: a registered field is read through its readiness (as the factor columns are); the new
// distance fields read straight from the row; Forward PER from the consensus view.
export const FILING_KEYS = new Set(['pe', 'pb', 'roe', 'margin', 'revGrowth']);
const FILING_STATUSES = new Set(['CURRENT', 'DELAYED', 'INFERRED', 'STALE', 'LAST_GOOD']);
const FIELD_BY_ROW_KEY = new Map(SCREENER_FIELD_REGISTRY.fields.map((definition) => [definition.rowKey, definition.fieldId]));
// v59.44 (X bookmarks 10/30): FCF margin and capex ÷ revenue (src/ui/components/screener-cash.js, a lazy chunk loaded when a
// cash condition is chosen). Until the SEC fiscal history lands the condition counts no rows.
export const CASH_CONDITION_IDS = ['fcf-margin-min', 'capex-intensity-max'];
export function requestCashMetrics(root, onReady) {
  if (root?._aioScreenerCash || root?._aioScreenerCashRequested) return;
  root._aioScreenerCashRequested = true;
  import('../components/screener-cash.js').then((mod) => mod.requestCashMetrics(root, onReady)).catch(() => {}).finally(() => { root._aioScreenerCashRequested = false; });
}
export function customRead(row, key) {
  if (key === 'fwdPe') return forwardPe(row);
  if (key === 'fcfMargin' || key === 'capexIntensity') return screenerRuntime.consensusRoot?._aioScreenerCash?.map.get(String(row?.sym || row?.symbol || '').toUpperCase())?.[key] ?? null;
  if (CHANNEL_SIGNAL_KEYS.includes(key)) return channelSignalValue(screenerRuntime.consensusRoot?.AIO_TELEGRAM_SIGNALS, row, key); // v58.71 (js/aio-data.js sets it)
  const fieldId = FIELD_BY_ROW_KEY.get(key);
  // Annual filing figures (PER·PBR·ROE·이익률·성장률) share the rank's 456-day budget (2026-10-16); a filter labelled
  // '최근 회계연도' still reads an older STALE figure as the table displays it, but never a CONFLICT value.
  if (row?.fieldReadiness && fieldId && FILING_KEYS.has(key)) return FILING_STATUSES.has(row.fieldReadiness.fields?.[fieldId]?.status) ? finite(row[key]) : null;
  if (row?.fieldReadiness && fieldId) return fieldValueForPurpose(row, fieldId, 'calculation');
  return typeof row?.[key] === 'string' || typeof row?.[key] === 'boolean' || Array.isArray(row?.[key]) ? row[key] : finite(row?.[key]);
}

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
  if (sortColumn === 'rs6m' || sortColumn === 'rs12m') return screenerRuntime.currentRsPercentiles.get(row.sym || row.symbol)?.[sortColumn];
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

// Module state the table render writes and the column/consensus readers use (one object so sibling modules can write it).
export const screenerRuntime = { currentRsPercentiles: new Map(), themeStageRoot: null, themeStageRows: null, consensusRoot: globalThis, customPanel: null, availableCache: {} };
