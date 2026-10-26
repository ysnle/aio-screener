/**
 * Custom screener conditions (owner request 2026-10-14: "5/10/20 정배열이면서 신고가", "VCP 수렴", 밸류에이션 조건).
 *
 * A reader picks conditions (or writes them as a sentence) and the table keeps only the rows that meet every one.
 * Each condition reads fields the screener artifact already publishes on the same completed-close series; a row
 * without the field does not pass (it is counted as "자료 없음", never guessed). These narrow the table only —
 * they are not a rank, a recommendation or a backtested signal.
 *
 * Moving-average order is read from the published distances (pctSmaN = close ÷ N-day average − 1, in %), so no
 * raw price is needed: close > SMA5 > SMA10 > SMA20 ⇔ 0 < pctSma5 < pctSma10 < pctSma20.
 */

import { extensionMultiple } from '../technical/definitions.js';
import { RULES } from '../rules/thresholds.js';

const finite = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

// [id, group, label (with {n} for the threshold), default threshold or null, unit, fields read, test]
export const CUSTOM_CONDITIONS = Object.freeze([
  { id: 'ma-short', group: '추세', label: '단기 정배열 (종가 > 5 > 10 > 20일선)', fields: ['pctSma5', 'pctSma10', 'pctSma20'],
    test: ({ pctSma5: a, pctSma10: b, pctSma20: c }) => a > 0 && a < b && b < c },
  { id: 'ma-long', group: '추세', label: '중기 정배열 (종가 > 50 > 200일선)', fields: ['pctSma50', 'pctSma200'],
    test: ({ pctSma50: a, pctSma200: b }) => a > 0 && a < b },
  { id: 'new-high', group: '추세', label: '52주 신고가 (오늘 종가가 1년 최고 종가)', fields: ['pctFromCloseHigh52w'],
    test: ({ pctFromCloseHigh52w: a }) => a >= 0 },
  { id: 'near-high', group: '추세', label: '52주 고점 대비 {n}% 이내', value: 5, unit: '%', fields: ['pctFrom52wHigh'],
    test: ({ pctFrom52wHigh: a }, n) => a >= -n },
  // v57.59 review: "near pivot" alone is not contraction — it counts only while the latest swing is smaller than the one
  // before (vcpShrinking true; null when fewer than two swings). Rows from before these fields existed keep the old reading.
  { id: 'vcp', group: '패턴', label: 'VCP 수렴 중 (흔들림이 2번 이상 줄어듦, 피벗 근처는 마지막 흔들림이 직전보다 작을 때만)', fields: ['vcpStage'], optional: ['vcpShrinking', 'vcpContractions'],
    test: ({ vcpStage, vcpShrinking, vcpContractions }) => vcpStage === 'contracting'
      || (vcpStage === 'near_pivot' && (vcpShrinking === true || (vcpShrinking == null && vcpContractions == null))) },
  { id: 'vcp-breakout', group: '패턴', label: 'VCP 돌파 (피벗 위, 거래량 평소의 1.4배 이상)', fields: ['vcpStage'],
    test: ({ vcpStage }) => vcpStage === 'breakout' },
  { id: 'tight', group: '패턴', label: '하루 평균 변동폭 {n}% 이하', value: 3, unit: '%', fields: ['adrPct'],
    test: ({ adrPct: a }, n) => a <= n },
  { id: 'rvol', group: '패턴', label: '거래량 20일 평균의 {n}배 이상', value: 1.5, unit: '배', fields: ['rvol20'],
    test: ({ rvol20: a }, n) => a >= n },
  // v57.87 (owner X-bookmark read 2026-10-16): follow-through evidence from technical/follow-through.js and two readings
  // of fields already published (ADR floor, 50-day extension in ADR units). Conditions, not entry or exit rules.
  { id: 'adr-min', group: '패턴', label: '하루 평균 변동폭 {n}% 이상 (충분히 움직이는 종목)', value: 3, unit: '%', fields: ['adrPct'],
    test: ({ adrPct: a }, n) => a >= n },
  // v57.88 (review): a stock far below its 50-day line passed as "before extension"; the floor is the 부근 band.
  { id: 'not-extended', group: '패턴', label: '50일선 부근~위 변동폭의 {n}배 이내 (확장 전)', value: 4, unit: '배', fields: ['pctSma50', 'adrPct'],
    test: ({ pctSma50, adrPct }, n) => { const multiple = extensionMultiple(pctSma50, adrPct); return multiple != null && multiple >= -RULES.technical.nearLineAdr && multiple <= n; } },
  // 2026-10-18 bookmarks (snapback-vs-bottom): a stock stretched far below its 50-day line in ADR units. An observation for
  // a mean-reversion read, not a bottom or an entry — the frame keeps the reversal low as the invalidation point.
  { id: 'down-extended', group: '패턴', label: '50일선 아래로 변동폭의 {n}배 이상 (하방 과확장, 바닥 신호 아님)', value: 4, unit: '배', fields: ['pctSma50', 'adrPct'],
    test: ({ pctSma50, adrPct }, n) => { const multiple = extensionMultiple(pctSma50, adrPct); return multiple != null && multiple <= -n; } },
  { id: 'pocket-pivot', group: '후속·회복', label: '최근 10거래일 안 포켓 피벗 (상승일 거래량이 직전 10일의 가장 큰 하락일 거래량보다 많음)', fields: ['pocketPivots10'],
    test: ({ pocketPivots10: a }) => a >= 1 },
  { id: 'early-base', group: '후속·회복', label: '초기 베이스 (추세가 다시 시작된 뒤 {n}번째 베이스 이하)', value: 2, unit: '번째', fields: ['baseCount'],
    test: ({ baseCount: a }, n) => a >= 1 && a <= n },
  { id: 'few-heavy-down', group: '후속·회복', label: '최근 25거래일 거래량 실린 하락일 {n}일 이하', value: 4, unit: '일', fields: ['heavyDownDays25'],
    test: ({ heavyDownDays25: a }, n) => a <= n },
  { id: 'down-day-hold', group: '후속·회복', label: '지수 하락일에 지수보다 덜 빠진 날 {n}% 이상 (최근 60거래일)', value: 60, unit: '%', fields: ['downDayHoldPct'],
    test: ({ downDayHoldPct: a }, n) => a >= n },
  { id: 'no-climax', group: '후속·회복', label: '클라이맥스 징후 없음 (긴 상승 뒤 연속 급등·연중 최대 상승폭·최대 거래량·200일선 +70%)', fields: ['climaxSigns'],
    test: ({ climaxSigns }) => Array.isArray(climaxSigns) && climaxSigns.length === 0 },
  { id: 'pe-max', group: '밸류에이션', label: 'PER {n}배 이하 (최근 4개 분기 공시 이익, 없으면 회계연도, 적자 제외, 미국)', value: 20, unit: '배', fields: ['pe'],
    test: ({ pe }, n) => pe > 0 && pe <= n },
  { id: 'fwdpe-max', group: '밸류에이션', label: 'Forward PER {n}배 이하 (컨센서스, 미국)', value: 25, unit: '배', fields: ['fwdPe'],
    test: ({ fwdPe }, n) => fwdPe > 0 && fwdPe <= n },
  { id: 'pb-max', group: '밸류에이션', label: 'PBR {n}배 이하 (미국)', value: 3, unit: '배', fields: ['pb'],
    test: ({ pb }, n) => pb > 0 && pb <= n },
  { id: 'roe-min', group: '수익성·성장', label: 'ROE {n}% 이상 (미국)', value: 15, unit: '%', fields: ['roe'],
    test: ({ roe }, n) => roe >= n },
  { id: 'margin-min', group: '수익성·성장', label: '순이익률 {n}% 이상 (미국)', value: 10, unit: '%', fields: ['margin'],
    test: ({ margin }, n) => margin >= n },
  { id: 'growth-min', group: '수익성·성장', label: '매출 성장률 {n}% 이상 (최근 회계연도, 미국)', value: 10, unit: '%', fields: ['revGrowth'],
    test: ({ revGrowth }, n) => revGrowth >= n },
  { id: 'liquidity-min', group: '거래', label: '하루 거래대금 ${n}백만 이상 (30일 평균)', value: 20, unit: '$M', fields: ['dollarVolume30d'],
    test: ({ dollarVolume30d: a }, n) => a >= n * 1e6 },
  // v58.80 (first-users F34): "RSI 30 이하" and "3개월 수익률 20% 이상" were not understood. The same RSI(14) and
  // completed-close returns the table columns show; a narrowing filter, not an oversold or momentum signal.
  { id: 'rsi-max', group: '가격 흐름', label: 'RSI(14일) {n} 이하', value: 30, unit: '', fields: ['rsi'],
    test: ({ rsi: a }, n) => a <= n },
  { id: 'rsi-min', group: '가격 흐름', label: 'RSI(14일) {n} 이상', value: 70, unit: '', fields: ['rsi'],
    test: ({ rsi: a }, n) => a >= n },
  { id: 'ret1m-min', group: '가격 흐름', label: '1개월 수익률 {n}% 이상', value: 10, unit: '%', fields: ['ret1m'],
    test: ({ ret1m: a }, n) => a >= n },
  { id: 'ret1m-max', group: '가격 흐름', label: '1개월 수익률 {n}% 이하', value: -10, unit: '%', fields: ['ret1m'],
    test: ({ ret1m: a }, n) => a <= n },
  { id: 'ret3m-min', group: '가격 흐름', label: '3개월 수익률 {n}% 이상', value: 20, unit: '%', fields: ['ret3m'],
    test: ({ ret3m: a }, n) => a >= n },
  { id: 'ret3m-max', group: '가격 흐름', label: '3개월 수익률 {n}% 이하', value: -10, unit: '%', fields: ['ret3m'],
    test: ({ ret3m: a }, n) => a <= n },
  // v58.71 (owner 2026-10-23): what the research channels reported in the last 14 days (domain/screener/channel-signals.js).
  // A stock the channels never mentioned has no data here, so these conditions only keep reported names.
  { id: 'tg-pt-raise', group: '리서치 채널', label: '최근 14일 목표주가 상향 {n}건 이상, 하향 없음 (채널 보도)', value: 1, unit: '건', fields: ['tgPtRaises', 'tgPtCuts'],
    test: ({ tgPtRaises: a, tgPtCuts: b }, n) => a >= n && b === 0 },
  { id: 'tg-upgrade', group: '리서치 채널', label: '최근 14일 투자의견 상향 (채널 보도)', fields: ['tgUpgrades'],
    test: ({ tgUpgrades: a }) => a >= 1 },
  { id: 'tg-earnings-beat', group: '리서치 채널', label: '최근 실적이 예상 상회, 하회 항목 없음 (매출·EPS, 채널 보도)', fields: ['tgEarnings'],
    test: ({ tgEarnings }) => tgEarnings === 'beat' }
].map((item) => Object.freeze(item)));

const BY_ID = new Map(CUSTOM_CONDITIONS.map((item) => [item.id, item]));

// v58.63 (architecture audit SCR04): "PER 20 미만" became "PER 20 이하" and "ROE 15 초과" became "15 이상", so a row exactly
// at the threshold passed a strict request. Each one-field threshold names the field it bounds and its direction; a
// strict condition ({ strict: true }) excludes the boundary value, and its label says 미만/초과.
export const CONDITION_BOUNDS = Object.freeze({
  tight: ['adrPct', 'max'], 'adr-min': ['adrPct', 'min'], rvol: ['rvol20', 'min'], 'few-heavy-down': ['heavyDownDays25', 'max'],
  'early-base': ['baseCount', 'max'], 'down-day-hold': ['downDayHoldPct', 'min'], 'pe-max': ['pe', 'max'], 'fwdpe-max': ['fwdPe', 'max'],
  'pb-max': ['pb', 'max'], 'roe-min': ['roe', 'min'], 'margin-min': ['margin', 'min'], 'growth-min': ['revGrowth', 'min'],
  'liquidity-min': ['dollarVolume30d', 'min', 1e6],
  'rsi-max': ['rsi', 'max'], 'rsi-min': ['rsi', 'min'], 'ret1m-min': ['ret1m', 'min'], 'ret1m-max': ['ret1m', 'max'],
  'ret3m-min': ['ret3m', 'min'], 'ret3m-max': ['ret3m', 'max']
});
const BOUNDS = CONDITION_BOUNDS;

// One-click combinations for the examples readers ask for most.
export const CUSTOM_RECIPES = Object.freeze([
  ['단기 정배열 + 신고가', [{ id: 'ma-short' }, { id: 'new-high' }]],
  ['VCP 수렴 + 중기 정배열', [{ id: 'vcp' }, { id: 'ma-long' }]],
  ['거래량 실린 신고가', [{ id: 'new-high' }, { id: 'rvol', value: 1.5 }]],
  ['이익 대비 싼 우량주', [{ id: 'pe-max', value: 20 }, { id: 'roe-min', value: 15 }]],
  ['성장 + 적정 Forward PER', [{ id: 'growth-min', value: 15 }, { id: 'fwdpe-max', value: 30 }]],
  ['초기 베이스의 수축', [{ id: 'vcp' }, { id: 'early-base', value: 2 }]],
  ['지수 하락일에 버틴 추세주', [{ id: 'down-day-hold', value: 60 }, { id: 'ma-long' }]],
  ['포켓 피벗 + 확장 전', [{ id: 'pocket-pivot' }, { id: 'not-extended', value: 4 }, { id: 'no-climax' }]]
].map(([label, conditions]) => Object.freeze({ label, conditions: Object.freeze(conditions) })));

/** The template label with 이하/이상 turned into 미만/초과 for a strict condition ({n} left in place). */
export function conditionTemplate(condition) {
  const template = BY_ID.get(condition?.id);
  if (!template) return '';
  return condition.strict === true && BOUNDS[template.id] ? template.label.replace(/이하|이상/, (word) => (word === '이하' ? '미만' : '초과')) : template.label;
}

export function conditionLabel(condition) {
  const template = BY_ID.get(condition?.id);
  if (!template) return '';
  const n = finite(condition.value) ?? template.value;
  return conditionTemplate(condition).replace('{n}', n == null ? '' : String(n));
}

/** Keeps known ids with a finite threshold where one is needed; drops duplicates (the later one wins). */
export function normalizeConditions(list) {
  const out = new Map();
  for (const item of Array.isArray(list) ? list : []) {
    const template = BY_ID.get(item?.id);
    if (!template) continue;
    const raw = item.value === '' || item.value == null ? null : Number(item.value);
    const value = template.value == null ? undefined : (finite(raw) ?? template.value);
    const strict = item.strict === true && BOUNDS[template.id] ? { strict: true } : {};
    out.set(template.id, value === undefined ? { id: template.id } : { id: template.id, value, ...strict });
  }
  return [...out.values()];
}

export function parseConditionValue(text) {
  try { return normalizeConditions(JSON.parse(String(text || '[]'))); } catch { return []; }
}

/** true / false, or null when the row lacks a field the condition reads. */
export function evaluateCondition(condition, row, read) {
  const template = BY_ID.get(condition?.id);
  if (!template) return null;
  const values = {};
  for (const key of template.fields) {
    const value = read(row, key);
    if (value == null || value === '') return null;
    values[key] = value;
  }
  for (const key of template.optional || []) values[key] = read(row, key);
  const n = finite(condition.value) ?? template.value;
  const bound = condition.strict === true ? BOUNDS[template.id] : null;
  if (bound && Number(values[bound[0]]) === n * (bound[2] || 1)) return false;
  return template.test(values, n) === true;
}

/** Ids of conditions that at least one row can be judged on (a market without the data greys them out). */
export function availableConditionIds(rows, read) {
  return new Set(CUSTOM_CONDITIONS.filter((template) => rows.some((row) => template.fields.every((key) => {
    const value = read(row, key);
    return value != null && value !== '';
  }))).map((template) => template.id));
}

export function matchesConditions(row, conditions, read) {
  return conditions.every((condition) => evaluateCondition(condition, row, read) === true);
}

/** Per condition: rows that pass it and rows that carry its data (so "0종목" can say why). */
export function conditionCoverage(rows, conditions, read) {
  return conditions.map((condition) => {
    let pass = 0;
    let withData = 0;
    for (const row of rows) {
      const result = evaluateCondition(condition, row, read);
      if (result != null) withData += 1;
      if (result === true) pass += 1;
    }
    return { id: condition.id, pass, withData };
  });
}
