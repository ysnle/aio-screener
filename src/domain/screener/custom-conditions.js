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

const finite = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const VCP_CONTRACTING = new Set(['contracting', 'near_pivot']);

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
  { id: 'vcp', group: '패턴', label: 'VCP 수렴 중 (흔들림이 2번 이상 줄어듦 · 피벗 근처 포함)', fields: ['vcpStage'],
    test: ({ vcpStage }) => VCP_CONTRACTING.has(vcpStage) },
  { id: 'vcp-breakout', group: '패턴', label: 'VCP 돌파 (피벗 위 · 거래량 평소의 1.4배 이상)', fields: ['vcpStage'],
    test: ({ vcpStage }) => vcpStage === 'breakout' },
  { id: 'tight', group: '패턴', label: '하루 변동폭(ADR) {n}% 이하', value: 3, unit: '%', fields: ['adrPct'],
    test: ({ adrPct: a }, n) => a <= n },
  { id: 'rvol', group: '패턴', label: '거래량 20일 평균의 {n}배 이상', value: 1.5, unit: '배', fields: ['rvol20'],
    test: ({ rvol20: a }, n) => a >= n },
  { id: 'pe-max', group: '밸류에이션', label: 'PER {n}배 이하 (최근 회계연도 이익 · 적자 제외)', value: 20, unit: '배', fields: ['pe'],
    test: ({ pe }, n) => pe > 0 && pe <= n },
  { id: 'fwdpe-max', group: '밸류에이션', label: 'Forward PER {n}배 이하 (컨센서스 · 미국)', value: 25, unit: '배', fields: ['fwdPe'],
    test: ({ fwdPe }, n) => fwdPe > 0 && fwdPe <= n },
  { id: 'pb-max', group: '밸류에이션', label: 'PBR {n}배 이하', value: 3, unit: '배', fields: ['pb'],
    test: ({ pb }, n) => pb > 0 && pb <= n },
  { id: 'roe-min', group: '수익성·성장', label: 'ROE {n}% 이상', value: 15, unit: '%', fields: ['roe'],
    test: ({ roe }, n) => roe >= n },
  { id: 'margin-min', group: '수익성·성장', label: '순이익률 {n}% 이상', value: 10, unit: '%', fields: ['margin'],
    test: ({ margin }, n) => margin >= n },
  { id: 'growth-min', group: '수익성·성장', label: '매출 성장률 {n}% 이상 (최근 회계연도)', value: 10, unit: '%', fields: ['revGrowth'],
    test: ({ revGrowth }, n) => revGrowth >= n },
  { id: 'liquidity-min', group: '거래', label: '하루 거래대금 ${n}백만 이상 (30일 평균)', value: 20, unit: '$M', fields: ['dollarVolume30d'],
    test: ({ dollarVolume30d: a }, n) => a >= n * 1e6 }
].map((item) => Object.freeze(item)));

const BY_ID = new Map(CUSTOM_CONDITIONS.map((item) => [item.id, item]));

// One-click combinations for the examples readers ask for most.
export const CUSTOM_RECIPES = Object.freeze([
  ['단기 정배열 + 신고가', [{ id: 'ma-short' }, { id: 'new-high' }]],
  ['VCP 수렴 + 중기 정배열', [{ id: 'vcp' }, { id: 'ma-long' }]],
  ['거래량 실린 신고가', [{ id: 'new-high' }, { id: 'rvol', value: 1.5 }]],
  ['이익 대비 싼 우량주', [{ id: 'pe-max', value: 20 }, { id: 'roe-min', value: 15 }]],
  ['성장 + 적정 Forward PER', [{ id: 'growth-min', value: 15 }, { id: 'fwdpe-max', value: 30 }]]
].map(([label, conditions]) => Object.freeze({ label, conditions: Object.freeze(conditions) })));

export function conditionLabel(condition) {
  const template = BY_ID.get(condition?.id);
  if (!template) return '';
  const n = finite(condition.value) ?? template.value;
  return template.label.replace('{n}', n == null ? '' : String(n));
}

/** Keeps known ids with a finite threshold where one is needed; drops duplicates (the later one wins). */
export function normalizeConditions(list) {
  const out = new Map();
  for (const item of Array.isArray(list) ? list : []) {
    const template = BY_ID.get(item?.id);
    if (!template) continue;
    const raw = item.value === '' || item.value == null ? null : Number(item.value);
    const value = template.value == null ? undefined : (finite(raw) ?? template.value);
    out.set(template.id, value === undefined ? { id: template.id } : { id: template.id, value });
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
  return template.test(values, finite(condition.value) ?? template.value) === true;
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

// Sentence → conditions. Rules run longest-phrase first and consume what they match; the rest is reported back
// so a reader sees what was not understood instead of a silently wider result.
const NUM = '(\\d+(?:\\.\\d+)?)';
const PARSE_RULES = [
  [new RegExp(`(?:forward|포워드|선행)\\s*per\\s*${NUM}\\s*배?\\s*(?:이하|미만|아래)?`, 'i'), (m) => ({ id: 'fwdpe-max', value: +m[1] })],
  [new RegExp(`per\\s*${NUM}\\s*배?\\s*(?:이하|미만|아래)?`, 'i'), (m) => ({ id: 'pe-max', value: +m[1] })],
  [/저\s*per|저평가/i, () => ({ id: 'pe-max', value: 15 })],
  [new RegExp(`pbr\\s*${NUM}\\s*배?\\s*(?:이하|미만|아래)?`, 'i'), (m) => ({ id: 'pb-max', value: +m[1] })],
  [new RegExp(`roe\\s*${NUM}\\s*%?\\s*(?:이상|초과|넘는)?`, 'i'), (m) => ({ id: 'roe-min', value: +m[1] })],
  [new RegExp(`(?:매출\\s*)?성장(?:률)?\\s*${NUM}\\s*%?\\s*(?:이상|초과|넘는)?`), (m) => ({ id: 'growth-min', value: +m[1] })],
  [new RegExp(`(?:순?이익률|마진)\\s*${NUM}\\s*%?\\s*(?:이상|초과)?`), (m) => ({ id: 'margin-min', value: +m[1] })],
  [new RegExp(`거래대금\\s*\\$?${NUM}\\s*(?:백만|m)?\\s*(?:달러)?\\s*(?:이상)?`, 'i'), (m) => ({ id: 'liquidity-min', value: +m[1] })],
  [new RegExp(`거래량\\s*${NUM}\\s*배\\s*(?:이상)?`), (m) => ({ id: 'rvol', value: +m[1] })],
  [/거래량\s*(?:급증|증가|실린|터진|많은)/, () => ({ id: 'rvol', value: 1.5 })],
  [new RegExp(`(?:adr|변동폭)\\s*${NUM}\\s*%?\\s*(?:이하|미만)?`, 'i'), (m) => ({ id: 'tight', value: +m[1] })],
  [/vcp\s*돌파|피벗\s*돌파/i, () => ({ id: 'vcp-breakout' })],
  [/vcp(?:\s*패턴)?|수렴|변동성\s*(?:축소|수축)/i, () => ({ id: 'vcp' })],
  [new RegExp(`(?:52\\s*주\\s*)?(?:신고가|고점)\\s*(?:근처|부근|대비)\\s*${NUM}\\s*%?\\s*(?:이내)?`), (m) => ({ id: 'near-high', value: +m[1] })],
  [/(?:52\s*주\s*)?(?:신고가|고점)\s*(?:근처|부근)/, () => ({ id: 'near-high', value: 5 })],
  [/(?:52\s*주\s*)?신고가/, () => ({ id: 'new-high' })],
  [/(?:50\s*일?선?\s*[/·,\s]*\s*200\s*일?선?|중기|장기)\s*(?:이동평균\s*)?(?:일선?\s*)?정배열/, () => ({ id: 'ma-long' })],
  [/(?:5\s*[/·,]\s*10\s*[/·,]\s*20|단기)\s*(?:일선?\s*)?(?:이동평균\s*)?정배열|(?:\d+\s*일선?\s*)*정배열/, () => ({ id: 'ma-short' })]
];
const FILLER = /(?:이면서|이고|이며|면서|그리고|및|또는|하는|하고|있는|중인|종목들?|주식|찾아\s*줘|보여\s*줘|[,·/+&]|\s)+/g;
const STOP_WORDS = /^(?:[을를이가은는의에도로와과인한]|으로|보여주고|보여주는|보이는|나타나는|나타내는|만족하는|있고|하고|중|등|등등|패턴을?|조건)$/;

export function parseConditionText(text) {
  let rest = ` ${String(text || '')} `;
  const conditions = [];
  for (const [pattern, build] of PARSE_RULES) {
    let match = rest.match(pattern);
    while (match) {
      conditions.push(build(match));
      rest = `${rest.slice(0, match.index)} ${rest.slice(match.index + match[0].length)}`;
      match = rest.match(pattern);
    }
  }
  const unknown = rest.replace(FILLER, ' ').split(' ').filter((word) => word && !STOP_WORDS.test(word)).join(' ');
  return { conditions: normalizeConditions(conditions), unknown };
}
