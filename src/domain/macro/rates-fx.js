// P1425 (owner review 2026-10-03, 거시 screen rebuild): the 금리 · 환율 tab reads the official
// Treasury par-yield cut, FRED real yield / breakeven / HY spread, and the dollar, won and yen on
// the same completed-close basis as 시장 상태. It replaces fixed level verdicts (DXY >= 107 or
// 10Y >= 5% = '높은 수준', 10Y >= 4.7% = '주식 압박') and the four-axis bull/bear count with the
// observed level, its change and its date. The only rule shown is the one 시장 상태 already uses:
// a yen rally of 3% or more in 20 sessions marks the FX axis as a burden.
import { buildCloseSeries, closeBasis, sessionPointBack as closeSessionPointBack } from '../briefing/market-read.js';
import { resolveMarketCalendarSession } from '../market/market-calendar.js';
import { RULES } from '../rules/thresholds.js';

export const YEN_RALLY_RULE = RULES.fx.yenRally20dPct; // % in 20 sessions — the 시장 상태 FX-axis rule (P1428 registry)
const CHART_SESSIONS = 126; // about six months of completed sessions

export const TREASURY_TENORS = Object.freeze([
  Object.freeze({ id: 'dgs2', label: '2년', years: 2 }),
  Object.freeze({ id: 'dgs5', label: '5년', years: 5 }),
  Object.freeze({ id: 'dgs10', label: '10년', years: 10 }),
  Object.freeze({ id: 'dgs20', label: '20년', years: 20 }),
  Object.freeze({ id: 'dgs30', label: '30년', years: 30 })
]);

// v57.50 (W1 request): the completed-close series on this tab (FX cards, ^TNX) count sessions with the 시장 상태 helper
// `closeSessionPointBack` (market-read.js), so a "5일/20일" here is the same point as there — verified identical on every
// close field × 1/5/20/63 sessions × 60 cut-offs of public-data/history.json (1,920 cases, 0 differences). This local
// helper stays for series that are not completed-close rows (FRED daily observations, weekend-row inputs: on a Sunday
// row the market-read helper returns that row, this one the Friday — the M01 fixture).
// Expert review M01 (2026-10-13): a close series can carry a weekend row, so "20일" counted as 20 rows covered fewer
// sessions. A change span is counted in exchange sessions instead: the point is the last observation on or before
// the day that lies `sessions` open sessions before the latest observation (registered calendar; weekdays when unknown).
export function sessionPointBack(series, sessions, market = 'US') {
  const last = series?.[series.length - 1];
  if (!last || !(sessions > 0)) return null;
  let cursor = Date.parse(`${last.date}T12:00:00Z`);
  let left = sessions;
  for (let guard = 0; left > 0 && guard < sessions * 3 + 20; guard += 1) {
    cursor -= 86400000;
    const date = new Date(cursor).toISOString().slice(0, 10);
    const day = resolveMarketCalendarSession({ market, date });
    if (day.status === 'open' || (day.status === 'unknown' && ![0, 6].includes(new Date(cursor).getUTCDay()))) left -= 1;
  }
  if (left > 0) return null;
  const target = new Date(cursor).toISOString().slice(0, 10);
  let found = null;
  for (const row of series) { if (row.date <= target) found = row; else break; }
  return found;
}

// v58.56 (re-audit #9): the curve's short and middle tenors. Today's points come from the same official Treasury cut as
// the five core tenors (macro._treasury.values, parsed from the same XML entry), or else from FRED's H.15 series of the
// same name on exactly that date; a tenor with neither is left out of the line rather than borrowed from another day.
export const TREASURY_EXTRA_TENORS = Object.freeze([
  Object.freeze({ id: 'dgs1mo', label: '1개월', years: 1 / 12 }),
  Object.freeze({ id: 'dgs3mo', label: '3개월', years: 0.25 }),
  Object.freeze({ id: 'dgs6mo', label: '6개월', years: 0.5 }),
  Object.freeze({ id: 'dgs1', label: '1년', years: 1 }),
  Object.freeze({ id: 'dgs3', label: '3년', years: 3 }),
  Object.freeze({ id: 'dgs7', label: '7년', years: 7 })
]);
export function extraTenorPoints(macro, macroHistory, asOf) {
  if (!asOf) return [];
  const official = macro?._treasury && macro._treasury.observedAt === asOf ? macro._treasury : null;
  const earlier = (official?.series || []).filter((entry) => entry?.observedAt < asOf).sort((a, b) => String(b.observedAt).localeCompare(String(a.observedAt)));
  const change = (field, current, back) => {
    const prior = finite(earlier[back - 1]?.values?.[field]);
    return current != null && prior != null && earlier.length >= back ? Math.round((current - prior) * 1000) / 1000 : null;
  };
  return TREASURY_EXTRA_TENORS.map((tenor) => {
    const fromFeed = finite(official?.values?.[tenor.id]);
    if (fromFeed != null) return { ...tenor, value: fromFeed, day: change(tenor.id, fromFeed, 1), week: change(tenor.id, fromFeed, 5), asOf, source: 'treasury' };
    const row = (macroHistory?.series?.[tenor.id]?.observations || []).find(([date]) => date === asOf);
    const value = row ? finite(row[1]) : null;
    return value == null ? null : { ...tenor, value, day: null, week: null, asOf, source: 'fred' };
  }).filter(Boolean);
}

// Expert review M22: no 3-month bill yield is collected, but T10Y3M (10-year minus 3-month, same H.15 constant-maturity
// basis) is. On a day the official curve and that spread share, 3-month = 10-year - spread; on any other day no point.
export function derivedThreeMonth(macroHistory, tenYear) {
  if (!tenYear?.asOf || tenYear.value == null) return null;
  const row = (macroHistory?.series?.t10y3m?.observations || []).find(([date]) => date === tenYear.asOf);
  const spread = row ? finite(row[1]) : null;
  return spread == null ? null : { id: 'dgs3mo', label: '3개월', years: 0.25, value: Math.round((tenYear.value - spread) * 100) / 100, day: null, week: null, asOf: tenYear.asOf, derived: true };
}

// v58.55 (개편 v2 5e): the curve about one month (21 US sessions) before the official cut, drawn dashed behind it. The
// Treasury XML feed keeps only the current month, so the earlier curve is read from FRED's H.15 constant-maturity series
// (the same Treasury par yields) — on one common date, and only for tenors that exist on both dates. The 3-month point is
// derived the same way as today's (10-year − T10Y3M on that date). A tenor whose history is not collected yet is listed
// in `pending` instead of being guessed.
export const CURVE_COMPARE_SESSIONS = 21;
export function curveMonthAgo(macroHistory, yields = [], asOf = null) {
  if (!asOf) return null;
  const obs = (key) => new Map((macroHistory?.series?.[key]?.observations || []).filter(([date, value]) => date < asOf && Number.isFinite(value)));
  const ten = obs('dgs10');
  const spread3m = obs('t10y3m');
  const valueOn = (row, date) => {
    const map = obs(row.id);
    // v58.56: DGS3MO is collected now; the T10Y3M derivation stays only for history written before it.
    if (row.id === 'dgs3mo' && !map.has(date)) return ten.has(date) && spread3m.has(date) ? Math.round((ten.get(date) - spread3m.get(date)) * 100) / 100 : null;
    return map.has(date) ? map.get(date) : null;
  };
  const dates = [...ten.keys()].sort().map((date) => ({ date }));
  const target = sessionPointBack([...dates, { date: asOf }], CURVE_COMPARE_SESSIONS);
  if (!target || target.date === asOf) return null;
  const current = yields.filter((row) => row.value != null);
  const points = current.map((row) => ({ id: row.id, label: row.label, years: row.years, value: valueOn(row, target.date) })).filter((row) => row.value != null);
  const pending = current.filter((row) => !points.some((point) => point.id === row.id)).map((row) => row.label);
  return points.length >= 2 ? { date: target.date, points, pending } : null;
}

// Expertise review 2026-10-19: the page said only whether 2s10s was inverted. A rates desk reads which leg moved the
// spread (bull = yields falling, bear = rising) and whether an inversion has just ended — the curve has typically
// re-steepened out of inversion, often bull-led as the Fed is expected to cut, shortly before past U.S. recessions.
// Both legs come from the FRED daily history paired by date; the span counts paired observations (one per session).
// An un-inversion counts only after a sustained inversion (20+ consecutive sessions below zero; a one-day dip is noise) that
// ended within the last ~6 months of sessions.
export const CURVE_DYNAMICS_RULE = Object.freeze({ sessions: 20, minSpreadMoveBp: 10, minInvertedRun: 20, uninvertWithin: 130 });

// The most recent sustained inversion that has ended: { start, end } where end is the first session back at or above zero.
function endedInversion(points, rule) {
  let runEnd = null;
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (points[index].value >= 0) continue;
    if (runEnd == null) {
      if (index === points.length - 1) return null; // still inverted
      runEnd = index;
    }
    if (index > 0 && points[index - 1].value < 0) continue; // the run goes on further back
    const end = runEnd + 1;
    if (points.length - 1 - end >= rule.uninvertWithin) return null; // ended too long ago
    // A run that reaches the first observation began before the history does: its start is unknown, and its length
    // is at least what is visible, so the brief-dip rule does not apply.
    if (index === 0) return { start: null, firstObserved: points[0].date, end: points[end].date };
    if (runEnd - index + 1 >= rule.minInvertedRun) return { start: points[index].date, end: points[end].date };
    runEnd = null; // a brief dip: look for a sustained run before it
  }
  return null;
}

function pairedObservations(macroHistory, shortKey, longKey) {
  const short = new Map((macroHistory?.series?.[shortKey]?.observations || []).map(([date, value]) => [date, finite(value)]));
  return (macroHistory?.series?.[longKey]?.observations || [])
    .map(([date, value]) => ({ date, long: finite(value), short: short.get(date) ?? null }))
    .filter((row) => isoDate(row.date) && row.long != null && row.short != null);
}

export function curveDynamics(macroHistory, rule = CURVE_DYNAMICS_RULE) {
  const rows = pairedObservations(macroHistory, 'dgs2', 'dgs10');
  if (rows.length <= rule.sessions) return null;
  const last = rows[rows.length - 1];
  const from = rows[rows.length - 1 - rule.sessions];
  const shortBp = Math.round((last.short - from.short) * 100);
  const longBp = Math.round((last.long - from.long) * 100);
  const spreadBp = longBp - shortBp;
  let kind = null;
  if (Math.abs(spreadBp) >= rule.minSpreadMoveBp) {
    // Both legs the same way: the leg that moved more names the move (bull when it fell, bear when it rose).
    // Legs in opposite directions are a twist — neither a bull nor a bear move.
    const lead = Math.abs(shortBp) >= Math.abs(longBp) ? shortBp : longBp;
    const twist = shortBp * longBp < 0;
    kind = `${twist ? 'twist' : lead < 0 ? 'bull' : 'bear'}-${spreadBp > 0 ? 'steepening' : 'flattening'}`;
  }
  const ended = endedInversion(rows.map((row) => ({ date: row.date, value: row.long - row.short })), rule);
  // The New York Fed's model reads 10-year minus 3-month; its own un-inversion is reported beside the 2s10s one.
  const ended3m = endedInversion((macroHistory?.series?.t10y3m?.observations || []).map(([date, value]) => ({ date, value: finite(value) })).filter((row) => row.value != null), rule);
  const LABEL = {
    'bull-steepening': '불 스티프닝 — 단기금리가 더 많이 내려 기울기가 가팔라졌습니다',
    'bear-steepening': '베어 스티프닝 — 장기금리가 더 많이 올라 기울기가 가팔라졌습니다',
    'bull-flattening': '불 플래트닝 — 장기금리가 더 많이 내려 기울기가 완만해졌습니다',
    'bear-flattening': '베어 플래트닝 — 단기금리가 더 많이 올라 기울기가 완만해졌습니다',
    'twist-steepening': '트위스트 스티프닝 — 단기금리는 내리고 장기금리는 올랐습니다',
    'twist-flattening': '트위스트 플래트닝 — 단기금리는 오르고 장기금리는 내렸습니다'
  };
  const READING = {
    'bull-steepening': '시장이 정책금리 인하를 앞당겨 반영하는 모양입니다. 성장 둔화 우려로 생기면 경기 방어 신호이고, 물가 안정으로 생기면 완화 기대입니다 — 성장 지표와 함께 봐야 합니다.',
    'bear-steepening': '장기 요인(기간 프리미엄·재정 공급·성장·물가 기대)이 금리를 밀어 올리는 모양입니다. 주식 밸류에이션에는 부담입니다.',
    'bull-flattening': '장기 성장·물가 기대가 낮아지거나 안전자산 수요가 커지는 모양입니다.',
    'bear-flattening': '추가 긴축 기대가 단기금리를 끌어올리는 모양입니다.',
    'twist-steepening': '완화 기대(단기)와 장기 요인(기간 프리미엄·재정·물가 기대)이 동시에 작용하는 모양입니다.',
    'twist-flattening': '긴축 기대가 단기금리를 올리는 가운데 장기 성장·물가 기대는 낮아지는 모양입니다.'
  };
  const fact = `${shortDate(from.date)}→${shortDate(last.date)} ${rule.sessions}거래일: 2년 ${signed(shortBp, 0, 'bp')}, 10년 ${signed(longBp, 0, 'bp')}, 2년–10년 금리차 ${signed(spreadBp, 0, 'bp')}.`;
  return {
    asOf: last.date,
    from: from.date,
    shortBp,
    longBp,
    spreadBp,
    kind,
    label: kind ? LABEL[kind] : `기울기 변화가 ${rule.minSpreadMoveBp}bp 미만이라 방향을 붙이지 않습니다`,
    fact,
    reading: kind ? READING[kind] : null,
    uninverted: !!ended,
    inversion: ended,
    uninverted3m: !!ended3m,
    inversion3m: ended3m,
    uninversion3mText: ended3m ? `뉴욕 연준 모형이 쓰는 10년–3개월 금리차는 ${inversionSince(ended3m)} 역전돼 있다가 ${longDate(ended3m.end)}에 양(+)으로 돌아섰습니다.` : null,
    uninversionReading: ended ? `2년–10년 금리차가 ${inversionSince(ended)} 역전돼 있다가 ${longDate(ended.end)}에 양(+)으로 돌아섰습니다. 과거 미국 경기침체는 역전 자체보다 역전이 풀리며 다시 가팔라지는 시점과 더 가까웠습니다. 시차가 일정하지 않아 시점 판단에는 쓰지 않습니다.` : null
  };
}

const inversionSince = (run) => (run.start ? `${longDate(run.start)}부터` : `자료가 시작되는 ${longDate(run.firstObserved)} 이전부터`);

function longDate(date) {
  const [year, month, day] = String(date || '').split('-').map(Number);
  return year && month && day ? `${year}년 ${month}월 ${day}일` : String(date || '');
}

function shortDate(date) {
  const [, month, day] = String(date || '').split('-').map(Number);
  return month && day ? `${month}/${day}` : String(date || '');
}

export const FX_SERIES = Object.freeze([
  Object.freeze({ id: 'dxy', label: '달러 인덱스 (DXY)', digits: 2, unit: '' }),
  Object.freeze({ id: 'usdkrw', label: '원/달러', digits: 1, unit: '원' }),
  Object.freeze({ id: 'usdjpy', label: '엔/달러', digits: 2, unit: '엔' })
]);

function finite(value) {
  const number = Number(value);
  return value != null && value !== '' && Number.isFinite(number) ? number : null;
}

function isoDate(value) {
  const text = String(value ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

export function signed(value, digits = 2, suffix = '') {
  if (value == null) return '—';
  return `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(value).toFixed(digits)}${suffix}`;
}

function bp(value) {
  return value == null ? null : Math.round(value * 100);
}

// Codex review 2026-10-05: a Treasury level can be newer than the FRED change published beside it
// (10/2 level with the 10/1−9/30 change). A change is used only when the producer stamped it with the
// level's own date, or when level and change both come from FRED.
export function alignedRateDelta(macro, key, suffix = 'Delta') {
  const value = finite(macro?.[`${key}${suffix}`]);
  if (value == null) return null;
  if (macro?.[`_source_${key}`] !== 'us-treasury-official-primary') return value;
  return isoDate(macro?.[`_deltaAsOf_${key}`]) && isoDate(macro[`_deltaAsOf_${key}`]) === isoDate(macro[`_asOf_${key}`]) ? value : null;
}

function treasury(macro) {
  const yields = TREASURY_TENORS.map((tenor) => ({
    ...tenor,
    value: finite(macro[tenor.id]),
    day: alignedRateDelta(macro, tenor.id, 'Delta'),
    week: alignedRateDelta(macro, tenor.id, 'Delta5'),
    asOf: isoDate(macro[`_asOf_${tenor.id}`])
  }));
  const dates = [...new Set(yields.map((row) => row.asOf).filter(Boolean))];
  const sameCut = dates.length === 1 && yields.every((row) => row.value != null);
  const by = Object.fromEntries(yields.map((row) => [row.id, row]));
  const official2s10s = finite(macro.t10y2y);
  const spread2s10s = official2s10s ?? (sameCut ? by.dgs10.value - by.dgs2.value : null);
  const spread5s30s = sameCut ? by.dgs30.value - by.dgs5.value : null;
  const curve = [
    { id: '2s10s', label: '2년–10년', value: spread2s10s, legs: '10년 − 2년' },
    { id: '5s30s', label: '5년–30년', value: spread5s30s, legs: '30년 − 5년' }
  ];
  const inverted = spread2s10s != null && spread2s10s < 0;
  const fact = spread2s10s == null
    ? '같은 날짜의 2년·10년 금리가 아직 없습니다.'
    : inverted
      ? `2년물이 10년물보다 ${Math.abs(spread2s10s).toFixed(2)}%p 높습니다 (역전).`
      : `10년물이 2년물보다 ${spread2s10s.toFixed(2)}%p 높습니다 (양의 기울기).`;
  // The New York Fed's term-spread research: inversions preceded most U.S. recessions since the
  // 1960s, with a variable lead. It is a hypothesis about the economy, not a market timing rule.
  // Macro audit 2026-10-17: the New York Fed's recession model reads 10-year minus 3-month, not this 2-year spread, so the
  // sentence names the spread its research uses instead of lending it to 2s10s.
  const reading = inverted ? '과거 미국 경기침체 대부분에 앞서 장단기 금리 역전이 나타났습니다. 뉴욕 연준의 침체 확률 모형은 10년−3개월 금리차를 쓰며, 2년–10년 역전도 대부분의 침체에 앞섰습니다. 다만 시차가 일정하지 않아 시점 판단에는 쓰지 않습니다.' : null;
  const asOf = dates.length === 1 ? dates[0] : dates.sort().pop() || null;
  // v57.50 C10: the curve's levels and 1-day/1-week changes are the Treasury's official cut on its own date, which can be
  // a session or more behind the ^TNX close the 시장 상태 10-year "5일" change reads. The label carries the source and date.
  const [, month, day] = String(asOf || '').split('-').map(Number);
  const basisLabel = asOf ? `공식 국채 곡선 · ${month}/${day} 기준` : null; // provider name lives in the sources fold
  return { yields, asOf, sameCut, curve, fact, reading, basisLabel, source: '미 재무부 공식 수익률 곡선' };
}

function fredLevel(macro, key, label, { toBp = false, note }) {
  const value = finite(macro[key]);
  const week = finite(macro[`${key}Delta5`]);
  return {
    id: key,
    label,
    value,
    valueText: value == null ? '—' : toBp ? `${bp(value)}bp` : `${value.toFixed(2)}%`,
    weekText: week == null ? null : toBp ? `5거래일 ${signed(bp(week), 0, 'bp')}` : `5거래일 ${signed(week, 2, '%p')}`,
    asOf: isoDate(macro[`_asOf_${key}`]),
    stale: macro[`_freshness_${key}`] != null && macro[`_freshness_${key}`] !== 'observed',
    note
  };
}

function fxCard(history, basis, spec) {
  const series = buildCloseSeries(history, spec.id, { through: basis });
  if (!series.length) return { ...spec, available: false, series: [] };
  const last = series[series.length - 1];
  const prior = closeSessionPointBack(series, 1);
  const back20 = closeSessionPointBack(series, 20);
  const change20 = back20 ? (last.value / back20.value - 1) * 100 : null;
  return {
    ...spec,
    available: true,
    value: last.value,
    asOf: last.date,
    valueText: `${last.value.toLocaleString('en-US', { minimumFractionDigits: spec.digits, maximumFractionDigits: spec.digits })}${spec.unit}`,
    day: prior ? (last.value / prior.value - 1) * 100 : null,
    change20,
    series: series.slice(-CHART_SESSIONS)
  };
}

export function buildRatesFx({ macro = null, history = [], macroHistory = null } = {}) {
  const m = macro && typeof macro === 'object' ? macro : {};
  const curve = treasury(m);
  curve.dynamics = curveDynamics(macroHistory);
  // v58.56 (re-audit #9): 1개월·3개월·6개월·1년·3년·7년 join the curve on the official cut's date (sorted by maturity).
  // The 3-month point is derived from T10Y3M only when neither the feed nor DGS3MO has it for that date.
  const extras = curve.sameCut ? extraTenorPoints(m, macroHistory, curve.asOf) : [];
  const threeMonth = extras.some((row) => row.id === 'dgs3mo') ? null : derivedThreeMonth(macroHistory, curve.yields.find((row) => row.id === 'dgs10'));
  curve.yields = [...extras, ...(threeMonth ? [threeMonth] : []), ...curve.yields].sort((a, b) => a.years - b.years);
  curve.pendingTenors = TREASURY_EXTRA_TENORS.filter((tenor) => !curve.yields.some((row) => row.id === tenor.id)).map((tenor) => tenor.label);
  if (threeMonth) curve.fact = `${curve.fact} 3개월물은 같은 날 10년물에서 10년–3개월 금리차를 빼서 구한 값입니다.`;
  curve.previous = curveMonthAgo(macroHistory, curve.yields, curve.asOf);
  const basis = closeBasis(history);
  const fx = FX_SERIES.map((spec) => fxCard(history, basis, spec));
  const yen = fx.find((card) => card.id === 'usdjpy');
  // A falling USD/JPY is a stronger yen.
  const yenStrength = yen?.change20 == null ? null : -yen.change20;
  const carry = yenStrength == null
    ? { available: false, text: '엔/달러 20거래일 기록이 쌓이면 표시합니다.' }
    : {
      available: true,
      yenStrength,
      burden: yenStrength >= YEN_RALLY_RULE,
      // v57.70 (2026-10-15 audit): "20거래일 +1.5%" (USD/JPY) above "엔화 20일 −1.5%" read as a sign error; the second is the
      // yen's own value, and that is now said.
      text: `엔화 가치 기준 20일 ${signed(yenStrength, 1, '%')} (${yenStrength >= 0 ? '엔 강세' : '엔 약세'} — 위 엔/달러 환율과 부호가 반대) — 엔화 가치가 ${YEN_RALLY_RULE}% 이상 오르면 시장 상태의 환율 참고 지표(6개 지표 합계에는 넣지 않음)이 '부담'으로 바뀝니다.`
    };
  const tnxAll = buildCloseSeries(history, 'tnx', { through: basis });
  const tnx = tnxAll.slice(-CHART_SESSIONS);
  // v57.50 C10: the 10-year "5일/20일" change on this tab is the ^TNX completed-close series — the same series and session
  // count as the 시장 상태 rates axis — so the two screens print the same number for the same day.
  const tnxLast = tnxAll[tnxAll.length - 1] || null;
  const tnxBack5 = closeSessionPointBack(tnxAll, 5);
  const tnxBack20 = closeSessionPointBack(tnxAll, 20);
  const tnxChange = {
    date: tnxLast?.date || null,
    d5Bp: tnxLast && tnxBack5 ? Math.round((tnxLast.value - tnxBack5.value) * 10000) / 100 : null,
    d20Bp: tnxLast && tnxBack20 ? Math.round((tnxLast.value - tnxBack20.value) * 10000) / 100 : null
  };
  // Codex browser audit H17: TIPS read 10/5 while the breakeven and nominal yields read 10/6, and the cards sat
  // side by side as if "명목 = 실질 + 기대물가" held on one date. A date mismatch is stated on both cards.
  const real = [
    fredLevel(m, 'realYield10', '10년 실질금리 (TIPS)', { note: '물가를 뺀 금리입니다. 높을수록 미래 이익의 현재 가치가 낮아집니다.' }),
    fredLevel(m, 'breakeven10', '10년 기대인플레이션', { note: '국채와 물가연동채 금리 차이로 본 시장의 물가 예상입니다.' })
  ];
  const [realCard, beiCard] = real;
  if (realCard?.asOf && beiCard?.asOf && realCard.asOf !== beiCard.asOf) {
    const gap = ` 실질금리(${realCard.asOf})와 기대인플레이션(${beiCard.asOf})의 기준일이 달라, 두 값을 더해 같은 날의 명목금리로 맞춰 보지 않습니다.`;
    // P1599 (A08): the full sentence once (on the second card); the first card carries a short pointer.
    realCard.note = `${realCard.note || ''} 기준일 ${realCard.asOf} — 옆 카드와 날짜가 다릅니다.`;
    beiCard.note = `${beiCard.note || ''}${gap}`;
  }
  return {
    basis,
    treasury: curve,
    real,
    credit: fredLevel(m, 'hyOAS', '하이일드 스프레드', { toBp: true, note: '투기등급 회사채가 국채보다 더 받는 금리입니다. 넓어질수록 신용 위험을 크게 봅니다.' }),
    tnx,
    tnxChange,
    fx,
    carry
  };
}
