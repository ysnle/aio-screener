// P1397 (owner review 2026-10-03): the stock chart reads its own evidence onto the price — VCP
// contractions, the pivot, prior-day pivots and the 52-week high — and states a setup state
// instead of a letter grade (owner decision: no composite grade without predictive evidence).
// Methods are the published ones: Minervini's volatility contraction pattern and trend template,
// O'Neil's pivot/breakout-on-volume, Wilder's ADX, relative strength versus the S&P 500, and
// Raschke's prior-day high/low pivots. Nothing here is a buy or sell instruction.
import { EXTENSION_BANDS } from '../screener/setup-profile.js';
import { RULES } from '../rules/thresholds.js';
import { signalHistory, signalHistoryText } from './signal-history.js';
// v57.84: moving averages, ATR, ADR, the 52-week range, the 50-day extension and the Weinstein stage come from the one
// definitions module the screener producer and the summary also use.
import { smaSeries, emaSeries, atrWilder, adrPctOf, rangeExtremesOf, extensionMultiple, extensionStateFor, weeklyCloses, weinsteinStage, detectContractions, isBreakoutDay } from './definitions.js';
import { signedText } from '../shared/number.js';
const TECH = RULES.technical;

function finite(value) {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function coveredAverage(values, period, minShare = 0.8) {
  return values.map((_, index) => {
    if (index + 1 < period) return null;
    let sum = 0; let count = 0;
    for (let k = index + 1 - period; k <= index; k++) if (values[k] != null) { sum += values[k]; count += 1; }
    return count >= Math.ceil(period * minShare) ? sum / count : null;
  });
}

export const sma = smaSeries;
export const ema = emaSeries;

// Wilder's ADX(14).
export function adx(bars, period = 14) {
  if (bars.length < period * 2 + 1) return null;
  const tr = []; const plus = []; const minus = [];
  for (let i = 1; i < bars.length; i++) {
    const up = bars[i].high - bars[i - 1].high;
    const down = bars[i - 1].low - bars[i].low;
    plus.push(up > down && up > 0 ? up : 0);
    minus.push(down > up && down > 0 ? down : 0);
    tr.push(Math.max(bars[i].high - bars[i].low, Math.abs(bars[i].high - bars[i - 1].close), Math.abs(bars[i].low - bars[i - 1].close)));
  }
  const smooth = (arr) => { const out = []; let s = arr.slice(0, period).reduce((a, b) => a + b, 0); out.push(s); for (let i = period; i < arr.length; i++) { s = s - s / period + arr[i]; out.push(s); } return out; };
  const trS = smooth(tr); const pS = smooth(plus); const mS = smooth(minus);
  const dx = trS.map((t, i) => { const pdi = t ? (pS[i] / t) * 100 : 0; const mdi = t ? (mS[i] / t) * 100 : 0; return pdi + mdi ? (Math.abs(pdi - mdi) / (pdi + mdi)) * 100 : 0; });
  let value = dx.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dx.length; i++) value = (value * (period - 1) + dx[i]) / period;
  const lastT = trS[trS.length - 1];
  return { adx: value, plusDI: lastT ? (pS[pS.length - 1] / lastT) * 100 : null, minusDI: lastT ? (mS[mS.length - 1] / lastT) * 100 : null };
}

// v57.84 (owner decision): the contraction detector lives in technical/definitions.js so the screener producer and the
// legacy snapshot find the same contractions and the same pivot as this chart.
export { detectContractions };

// v57.50 D23: the 8th check differs from the published RS-rating rule, so the name says 변형.
export const TEMPLATE_LABEL = '미너비니 템플릿(변형: 6개월 S&P 초과)';
const EXTENSION_NOTE = Object.freeze({ extended: `, 50일선에서 확장된 구간(${EXTENSION_BANDS.extended}배 이상)`, stretched: `, 50일선에서 크게 확장된 구간(${EXTENSION_BANDS.stretched}배 이상)` });

const STATE_LABELS = Object.freeze({
  breakout: '돌파 — 기준 고점(피벗) 위, 거래량 동반', failed: '돌파 실패 — 기준 고점 아래로 복귀', setup: '패턴 형성 중 — 변동폭 축소',
  extended: '기준 고점에서 많이 오른 상태', downtrend: '하락 추세 — 패턴 해당 없음', none: '뚜렷한 패턴 없음'
});

/**
 * @param {Array<{time:string,open:number,high:number,low:number,close:number,volume:number}>} input
 * @param {{ benchmark?: Array<{date:string,value:number}> }} [options]
 */
// v57.70 (2026-10-15 audit): the comparison index for a chart, or null for an index or a fund that tracks it (SPY read
// "S&P 500보다 0.0%p 높음").
export function benchmarkFieldFor(symbol) {
  const sym = String(symbol || '').toUpperCase();
  if (/^(\^GSPC|SPY|VOO|IVV|SPLG|\^KS11|\^KQ11)$/.test(sym)) return null;
  return /\.KQ$/.test(sym) ? 'kosdaq' : /\.KS$/.test(sym) ? 'kospi' : 'spx';
}

export function analyzeChart(input = [], { benchmark = [], benchmarkLabel = 'S&P 500' } = {}) {
  const bars = input.filter((bar) => [bar?.open, bar?.high, bar?.low, bar?.close].every((v) => finite(v) != null && v > 0));
  if (bars.length < 60) return { available: false, reason: 'bars-insufficient', bars };
  const closes = bars.map((bar) => bar.close);
  // E08: a missing volume stays missing — counting it as 0 invented a "거래 감소". Averages need 80% coverage.
  const volumes = bars.map((bar) => { const v = finite(bar.volume); return v != null && v > 0 ? v : null; });
  const ema8 = ema(closes, 8);
  const ema21 = ema(closes, 21);
  const sma150 = sma(closes, 150);
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);
  const vol50 = coveredAverage(volumes, 50);
  const vol10 = coveredAverage(volumes, 10);
  const n = bars.length - 1;
  const last = bars[n];
  const prev = bars[n - 1];
  const vcp = detectContractions(bars);
  // P1428 (Codex review): fewer than 252 sessions is not a 52-week range; the label says how long it is.
  const range = rangeExtremesOf(bars.map((bar) => bar.high), bars.map((bar) => bar.low));
  if (!range) return { available: false, reason: 'range-unavailable', bars }; // v57.88: no positive high/low — not a TypeError
  const fullYear = range.fullYear;
  const rangeLabel = fullYear ? '52주' : `최근 ${range.sessions}거래일`;
  const high52 = range.high;
  const fromHigh = (last.close / high52 - 1) * 100;
  const volRatio = vol50[n] && volumes[n] != null ? volumes[n] / vol50[n] : null;
  const dryUp = vol50[n] && vol10[n] ? vol10[n] / vol50[n] : null;
  const aligned = ema21[n] != null && sma50[n] != null && sma200[n] != null && last.close > ema21[n] && ema21[n] > sma50[n] && sma50[n] > sma200[n];
  // P1397 events (owner-supplied chart material 2026-10-03): descriptive chart events, not orders.
  const events = [];
  const from = Math.max(1, n - 80);
  const avg50 = (i) => vol50[i] || null;
  // (a) 8-day EMA lost / reclaimed — the short-term trend line most swing traders watch.
  // Expertise review 2026-10-19: events (a)–(c) are found over the whole history so their past outcomes can be read
  // (signal-history.js); the chart still marks only the last ~80 sessions.
  for (let i = 9; i <= n; i++) {
    if (ema8[i] == null || ema8[i - 1] == null) continue;
    if (closes[i - 1] >= ema8[i - 1] && closes[i] < ema8[i]) events.push({ index: i, kind: 'ema8-lost', text: '8일 EMA 이탈', position: 'aboveBar', tone: 'burden' });
    else if (closes[i - 1] < ema8[i - 1] && closes[i] >= ema8[i]) events.push({ index: i, kind: 'ema8-reclaim', text: '8일 EMA 회복', position: 'belowBar', tone: 'favorable' });
  }
  // (b) gap up on heavy volume (earnings/news gap; O'Neil/Minervini "power gap").
  for (let i = 1; i <= n; i++) {
    const gap = (bars[i].open / bars[i - 1].close - 1) * 100;
    if (gap >= 4 && avg50(i) && volumes[i] >= 2 * avg50(i) && closes[i] > bars[i - 1].close) events.push({ index: i, kind: 'power-gap', text: `갭 +${gap.toFixed(1)}% (거래량 ${(volumes[i] / avg50(i)).toFixed(1)}배)`, position: 'belowBar', tone: 'favorable' });
  }
  // (c) Bollinger squeeze: 20-day band width at its lowest in six months.
  const sd20 = closes.map((_, i) => { if (i < 19) return null; const slice = closes.slice(i - 19, i + 1); const m = slice.reduce((a, b) => a + b, 0) / 20; return Math.sqrt(slice.reduce((a, b) => a + (b - m) ** 2, 0) / 20); });
  const sma20 = sma(closes, 20);
  const width = closes.map((_, i) => sd20[i] && sma20[i] ? (4 * sd20[i]) / sma20[i] : null);
  let squeezeOn = false;
  for (let i = 145; i <= n; i++) {
    const past = width.slice(i - 125, i).filter((v) => v != null);
    const isLow = width[i] != null && past.length > 60 && width[i] <= Math.min(...past);
    if (isLow && !squeezeOn) events.push({ index: i, kind: 'squeeze', text: '변동성 압축', position: 'belowBar', tone: 'neutral' });
    squeezeOn = isLow;
  }
  // (d) extension above the 8-day EMA (overheating) — the latest stretch of >= RULES.technical.ema8.overheatPct, or of
  // >= overheatAdr average daily ranges (expertise review 2026-10-19: +10% is routine for a 7%-ADR stock and extreme for a 2% one).
  const extension = ema8[n] ? (closes[n] / ema8[n] - 1) * 100 : null;
  const adrNow = adrPctOf(bars.map((bar) => bar.high), bars.map((bar) => bar.low), closes);
  // Past markers use today's ADR too — an approximation for older bars; the latest bar, which the reading uses, is exact.
  const overheated = (pct) => pct >= TECH.ema8.overheatPct || (adrNow > 0 && pct / adrNow >= TECH.ema8.overheatAdr);
  for (let i = n; i >= from; i--) {
    if (ema8[i] && overheated((closes[i] / ema8[i] - 1) * 100)) { events.push({ index: i, kind: 'extended', text: `과열 +${((closes[i] / ema8[i] - 1) * 100).toFixed(0)}%`, position: 'aboveBar', tone: 'burden' }); break; }
  }
  // Keep the chart legible: the latest two of each kind within ~4 months.
  const byKind = new Map();
  for (const event of events.filter((item) => item.index >= from).sort((a, b) => b.index - a.index)) { const list = byKind.get(event.kind) || []; if (list.length < 2) list.push(event); byKind.set(event.kind, list); }
  const chartEvents = [...byKind.values()].flat().sort((a, b) => a.index - b.index);
  // Minervini trend template (8 published criteria). v57.50 D23: the published 8th criterion is an RS rating of 70+;
  // here it is replaced by "6-month return above the S&P 500", so the template is labelled as a variant wherever shown.
  const low52 = range.low;
  const sma200Then = sma200[n - 21];
  const templateChecks = [
    // P1428: a check whose moving average is not yet computable is unknown (null), never 'unmet'.
    ['종가 > 150·200일선', sma150[n] == null || sma200[n] == null ? null : last.close > sma150[n] && last.close > sma200[n]],
    ['150일선 > 200일선', sma150[n] == null || sma200[n] == null ? null : sma150[n] > sma200[n]],
    ['200일선 1개월 이상 상승', sma200[n] == null || sma200Then == null ? null : sma200[n] > sma200Then],
    ['50일선 > 150·200일선', sma50[n] == null || sma150[n] == null || sma200[n] == null ? null : sma50[n] > sma150[n] && sma50[n] > sma200[n]],
    ['종가 > 50일선', sma50[n] == null ? null : last.close > sma50[n]],
    [`52주 저점 대비 +${TECH.template.aboveLowPct}% 이상`, fullYear ? last.close >= low52 * (1 + TECH.template.aboveLowPct / 100) : null],
    [`52주 고점 대비 -${TECH.template.nearHighPct}% 이내`, fullYear ? last.close >= high52 * (1 - TECH.template.nearHighPct / 100) : null],
    [`상대강도 (${benchmarkLabel} 대비 6개월 우위)`, null]
  ];
  // Buy/sell pressure: volume on up days versus down days over 20 sessions.
  let upVol = 0; let downVol = 0; let seen = 0;
  for (let i = n - 19; i <= n; i++) { if (volumes[i] == null) continue; seen += 1; if (closes[i] > closes[i - 1]) upVol += volumes[i]; else if (closes[i] < closes[i - 1]) downVol += volumes[i]; }
  const pressure = downVol && seen >= 16 ? upVol / downVol : null;
  // Weekly trend from the last close of each ISO week, against 10- and 30-week averages.
  const wCloses = weeklyCloses(bars).map((row) => row.close);
  const w10 = sma(wCloses, 10); const w30 = sma(wCloses, 30);
  const wn = wCloses.length - 1;
  // P1435: Weinstein stage on this stock's own weekly closes (30-week average and its 4-week slope),
  // replacing the page's old SPY-only stage block.
  // v57.84: definitions.weinsteinStage (RULES.technical.weinstein: 30-week line, 4-week slope, ±1% flat, 26 weeks back).
  const weinstein = weinsteinStage(wCloses);
  const weeklyTrend = w10[wn] == null || w30[wn] == null ? null : wCloses[wn] > w10[wn] && w10[wn] > w30[wn] ? '정배열' : wCloses[wn] < w10[wn] && w10[wn] < w30[wn] ? '역배열' : '혼조';
  // Relative strength: 6-month return minus the S&P 500's over the same dates.
  // P1428: each end of the comparison uses the benchmark close on or just before the stock's date (≤ 3 days);
  // a missing date is no comparison, not the benchmark's latest value.
  const benchRows = (benchmark || []).filter((point) => point?.date && Number.isFinite(point.value)).sort((a, b) => a.date.localeCompare(b.date));
  const benchAt = (date) => { let hit = null; for (const point of benchRows) { if (point.date <= date) hit = point; else break; } return hit && (Date.parse(date) - Date.parse(hit.date)) <= 3 * 86400000 ? hit.value : null; };
  const ago = bars[Math.max(0, n - 126)];
  const ret6 = bars.length >= 127 ? (last.close / ago.close - 1) * 100 : null;
  const b0 = benchAt(ago.time); const b1 = benchAt(last.time);
  const rs = ret6 != null && b0 && b1 ? ret6 - (b1 / b0 - 1) * 100 : null;
  const strength = adx(bars);
  templateChecks[7][1] = rs == null ? null : rs > 0;
  // Expertise review 2026-10-19: the relative-strength line (close ÷ benchmark on the same date). A line at its own high
  // while price is still under its high is the classic leadership tell (O'Neil/Minervini: RS leads price).
  const rsLine = benchRows.length ? bars.map((bar) => { const b = benchAt(bar.time); return b ? bar.close / b : null; }) : [];
  const rsWindow = rsLine.slice(-TECH.rangeSessions).filter((value) => value != null);
  const rsNow = rsLine[n] ?? null;
  const rsHigh = rsWindow.length >= 60 ? Math.max(...rsWindow) : null;
  const rsFromHigh = rsNow != null && rsHigh ? (rsNow / rsHigh - 1) * 100 : null;
  const rsAtHigh = rsFromHigh != null && rsFromHigh >= -0.5;
  const rsLeadsPrice = rsAtHigh && fromHigh <= -TECH.nearHighPct;
  // v58.75 (persona review): the sessions where the RS line set a one-year high — at or above every value of the trailing
  // 252 sessions, counted only once the window holds a full year (240+ values); the chart marks them.
  const rsNewHighs = [];
  for (let i = 0; i <= n; i++) {
    if (rsLine[i] == null) continue;
    const trailing = rsLine.slice(Math.max(0, i - TECH.rangeSessions + 1), i).filter((value) => value != null);
    if (trailing.length + 1 >= TECH.fullYearSessions && rsLine[i] >= Math.max(...trailing)) rsNewHighs.push(i);
  }
  const signals = signalHistory({ events, closes, rsLine });
  const templatePass = templateChecks.filter(([, ok]) => ok === true).length;
  const lastContraction = vcp.contractions[vcp.contractions.length - 1] || null;
  // State.
  let state = 'none';
  const recent = bars.slice(-10);
  const pivot = vcp.pivot;
  // v57.84 review: 'failed' needs a breakout that counted — a volume-confirmed close above the pivot — and every pivot
  // state needs a valid contraction run; a pivot from an invalid pattern is only the latest swing high.
  // Audit 2026-10-17 (owner D6): the shared breakout day — volume against the prior 50 sessions, the day excluded.
  const heavyUpAbove = (i, ceiling = false) => isBreakoutDay({ closes, volumes, i, pivot, ceiling });
  const ceilingPct = 1 + TECH.breakout.maxAbovePct / 100;
  const brokeOut = pivot != null && vcp.valid && Array.from({ length: 10 }, (_, k) => n - 9 + k).some((i) => i > 0 && heavyUpAbove(i) && bars[i - 1].close <= pivot * ceilingPct);
  // v58.75 (teach-and-check D1): the latest counted breakout day of the last 10 sessions, for the setup life-cycle band.
  const breakoutIndex = brokeOut ? Array.from({ length: 10 }, (_, k) => n - k).find((i) => i > 0 && heavyUpAbove(i) && bars[i - 1].close <= pivot * ceilingPct) ?? null : null;
  if (sma200[n] != null && (last.close < sma200[n] || (sma50[n] < sma200[n] && last.close < sma50[n]))) state = 'downtrend';
  else if (pivot != null && brokeOut && last.close < pivot) state = 'failed';
  // P1428 (Codex review): the heavy-volume day must itself close up and above the pivot — a heavy sell-off
  // below the pivot two days earlier is not breakout volume.
  else if (vcp.valid && pivot != null && last.close > pivot && last.close <= pivot * ceilingPct && [n - 2, n - 1, n].some((i) => heavyUpAbove(i, true))) state = 'breakout';
  else if (vcp.valid && pivot != null && last.close > pivot * ceilingPct) state = 'extended';
  else if (vcp.valid && pivot != null && last.close >= pivot * 0.92 && last.close <= pivot) state = 'setup';
  // Expertise review 2026-10-19: the higher timeframe filters the lower — a daily setup or breakout against a weekly
  // downtrend (10<30-week order, or Weinstein stage 4) is flagged, not hidden.
  const timeframeConflict = ['setup', 'breakout'].includes(state) && (weeklyTrend === '역배열' || weinstein?.stage === 4);
  // P1639 (owner materials 2026-10-12): how far price has run from the 50-day line in units of its own
  // daily range (ATR 14), where it sits above the 52-week low, and the 5/20-day EMA order used to judge
  // whether a decline has stopped. Descriptive facts, not entries.
  // v57.84: the 50-day distance is in average daily ranges — the screener's adrPct and the summary's multiple, against the
  // same 2/4/7 bands. The chart used (close − 50-day) ÷ a 14-session simple ATR, a different unit on the same bands, so one
  // stock could read 확장 on the chart and 보통 in the screener. ATR stays as Wilder's (the published definition).
  const atr14 = atrWilder(bars);
  const adrPct = adrNow;
  const pctFrom50 = sma50[n] ? (last.close / sma50[n] - 1) * 100 : null;
  const adrFrom50 = extensionMultiple(pctFrom50, adrPct);
  const fromLow = (last.close / low52 - 1) * 100;
  const ema5 = ema(closes, 5), ema20 = ema(closes, 20);
  let crossAgo = null;
  for (let i = n; i > Math.max(0, n - 60); i -= 1) {
    if (ema5[i] == null || ema20[i] == null || ema5[i - 1] == null || ema20[i - 1] == null) break;
    if ((ema5[i] > ema20[i]) !== (ema5[i - 1] > ema20[i - 1])) { crossAgo = n - i; break; }
  }
  const fiveAbove = ema5[n] != null && ema20[n] != null ? ema5[n] > ema20[n] : null;
  const fmt = (value, digits = 2) => value == null ? '—' : value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const signed = (value, digits = 1, unit = '%') => value == null ? '—' : signedText(value, digits, unit);
  const evidence = [
    ['일봉 이동평균', aligned ? '정배열 (종가 > 21일 EMA > 50일 > 200일)' : ema21[n] && sma50[n] ? `혼조 (종가 ${last.close > sma50[n] ? '50일선 위' : '50일선 아래'})` : '기록 부족'],
    ['주봉 추세 (10·30주)', weeklyTrend || '기록 부족'],
    ['Weinstein 단계 (30주선)', weinstein ? `${weinstein.stage}단계, 30주선 4주 ${signedText(weinstein.slope, 1)}%` : '기록 부족'],
    [`${benchmarkLabel} 대비 6개월`, rs == null ? '—' : `${signed(rs)}p (종목 ${signed(ret6)})`],
    ['상대강도선 (종목 ÷ 지수)', rsFromHigh == null ? '—' : rsAtHigh ? (rsLeadsPrice ? `신고가 — 가격(고점 대비 ${signed(fromHigh)})보다 먼저` : '신고가 (가격도 고점권)') : `자체 고점 대비 ${signed(rsFromHigh)} (${rsWindow.length >= TECH.fullYearSessions ? '1년' : `${rsWindow.length}거래일`} 기준)`],
    ['추세 강도 ADX', strength ? `${fmt(strength.adx, 0)} ${strength.adx >= 25 ? '(추세 뚜렷)' : strength.adx < 20 ? '(추세 약함)' : '(보통)'}` : '—'],
    ['거래량 (50일 평균 대비)', volRatio == null ? '—' : `${fmt(volRatio * 100, 0)}%${dryUp != null ? `, 10일 평균 ${fmt(dryUp * 100, 0)}%${dryUp < 0.8 ? ' (거래 감소)' : ''}` : ''}`],
    [`${rangeLabel} 고점 대비`, signed(fromHigh)],
    [TEMPLATE_LABEL, `${templatePass}/8 충족${templateChecks.some(([, ok]) => ok === false) ? `, 미충족: ${templateChecks.filter(([, ok]) => ok === false).map(([label]) => label).join(', ')}` : ''}${templateChecks.some(([, ok]) => ok == null) ? `, 확인 불가 ${templateChecks.filter(([, ok]) => ok == null).length}개(기록 부족)` : ''}`],
    // v57.50 C20: one set of bands (setup-profile EXTENSION_BANDS 2/4/7) for the chart, the screener and the summary.
    ['50일선 대비 일평균 변동폭 배수', adrFrom50 == null ? '—' : `${signedText(adrFrom50, 1)}배 (ADR${TECH.adrPeriod} ${fmt(adrPct)}%)${EXTENSION_NOTE[extensionStateFor(adrFrom50)] || (adrFrom50 <= -TECH.nearLineAdr ? ', 50일선 아래(부근 범위 밖)' : '')}`],
    [`${rangeLabel} 저점 대비`, `${signed(fromLow)}${fromLow < 5 ? ' (저점 5% 이내 — 바닥 다지기 전)' : ''}`],
    ['5일·20일 EMA', fiveAbove == null ? '기록 부족' : `5일 EMA가 20일 EMA ${fiveAbove ? '위' : '아래'}${crossAgo != null ? `, ${crossAgo}거래일 전 ${fiveAbove ? '상향' : '하향'} 교차` : ''}`],
    ['8일 EMA 대비 거리', extension == null ? '—' : `${signed(extension)}${adrNow > 0 ? `, 일평균 변동폭 ${(extension / adrNow).toFixed(1)}배` : ''}${overheated(extension) ? ' (과열권)' : extension <= -TECH.ema8.breakBelowPct ? ' (8일선 아래 이탈)' : ''}`],
    ['상승일·하락일 거래량 (20일)', pressure == null ? '—' : `상승일/하락일 거래량 ${pressure.toFixed(2)}배 ${pressure >= 1.3 ? '(상승일 거래량 우위)' : pressure <= 0.77 ? '(하락일 거래량 우위)' : '(비슷함)'}`],
    ['변동성 수축 (VCP)', vcp.contractions.length ? `${vcp.contractions.map((row) => `-${row.depth.toFixed(1)}%`).join(' → ')}${vcp.valid ? '' : ' (수축 순서 불충분)'}` : '수축 구간 없음'],
    ['기준 고점(피벗, 마지막 조정의 고점)', pivot == null ? '—' : `${fmt(pivot)} (현재가 대비 ${signed((pivot / last.close - 1) * 100)})`],
    // 2026-10-13 review S14: an observed level, not an instruction ('무효화 가격' read as a stop to act on).
    ['마지막 수축 저점', lastContraction ? `${fmt(lastContraction.low)} (현재가 대비 ${signed((lastContraction.low / last.close - 1) * 100)})` : '—'],
    ['전일 고가 / 저가', `${fmt(prev.high)} / ${fmt(prev.low)}`],
    ['이 종목의 지난 신호 뒤 21거래일', signalHistoryText(signals, benchmarkLabel)]
  ];
  return {
    available: true,
    asOf: last.time,
    last, prev,
    bars,
    lines: { ema8, ema21, sma50, sma200 },
    events: chartEvents,
    templateChecks,
    templatePass,
    weinstein,
    weeklyTrend,
    rs,
    rsFromHigh,
    rsAtHigh,
    rsLeadsPrice,
    rsLine,
    rsNewHighs,
    brokeOut,
    breakoutIndex,
    volRatio,
    timeframeConflict,
    signals,
    benchmarkLabel,
    ret6,
    pressure,
    dryUp,
    rangeLabel,
    fromHigh,
    fromLow,
    atr14,
    adrPct,
    adrFrom50,
    fiveAbove,
    crossAgo,
    extension,
    vcp,
    pivot,
    high52,
    state,
    stateLabel: STATE_LABELS[state],
    evidence,
    flip: state === 'setup' ? `피벗 ${fmt(pivot)} 위(+${TECH.breakout.maxAbovePct}% 이내)로 직전 ${TECH.breakout.volumeSessions}일 평균의 ${TECH.breakout.volumeMultiple}배 이상 거래량과 함께 상승 마감하면 돌파` : state === 'breakout' ? `피벗 ${fmt(pivot)} 아래로 다시 마감하면 돌파 실패` : state === 'downtrend' ? '200일선 회복과 50일선 상향 여부 확인' : state === 'failed' ? `피벗 ${fmt(pivot)} 재돌파와 그 위 마감 여부 확인` : null
  };
}

// P1435: one connected reading of the chart — what state, why, what would change it, and how the market
// around it agrees — so the evidence list underneath is support, not the message.
export function chartReading(analysis, regime = null) {
  if (!analysis?.available) return null;
  const pct = (value, digits = 1) => signedText(value, digits, '%');
  const parts = [];
  const w = analysis.weinstein;
  if (w) parts.push(`주봉으로는 Weinstein ${w.stage}단계(${w.text.split(' — ')[0]})`);
  parts.push(`${TEMPLATE_LABEL} ${analysis.templatePass}/8`);
  if (analysis.rs != null) parts.push(`6개월 수익률이 ${analysis.benchmarkLabel || 'S&P 500'}보다 ${Math.abs(analysis.rs).toFixed(1)}%p ${analysis.rs >= 0 ? '높음' : '낮음'}`);
  if (analysis.rsLeadsPrice) parts.push('상대강도선이 가격보다 먼저 신고가');
  const why = parts.join(', ');
  const vcp = analysis.vcp?.contractions?.length ? `변동성 수축 ${analysis.vcp.contractions.map((row) => `-${row.depth.toFixed(0)}%`).join('→')}${analysis.dryUp != null && analysis.dryUp < 0.8 ? ', 거래량도 줄어드는 중' : ''}` : null;
  const state = {
    setup: `셋업이 만들어지는 중입니다 — ${vcp || '변동성 수축'}이고 피벗까지 ${analysis.pivot ? pct((analysis.pivot / analysis.last.close - 1) * 100) : '—'} 남았습니다`,
    breakout: '피벗을 거래량과 함께 넘었습니다 — 돌파 직후는 피벗 위에서 버티는지가 관건입니다',
    extended: `피벗에서 이미 ${analysis.pivot ? pct((analysis.last.close / analysis.pivot - 1) * 100) : '—'} 올라 기준점에서 멀어진 구간입니다 — 새 수축(쉬어 가기)이 생기는지 관찰할 자리입니다`,
    failed: '돌파 뒤 피벗 아래로 되돌아왔습니다 — 돌파한 가격 위에서 유지되지 못한 상태입니다',
    downtrend: '하락 추세(200일선 아래) 구간이라 VCP 셋업 조건이 성립하지 않습니다',
    // Codex browser audit H33: "상승 추세 · 템플릿 8/8 · 셋업 없음" read as a contradiction. Trend and setup answer
    // different questions; the sentence says which condition is missing and that no setup is not a negative.
    // v57.84: a valid contraction run with price more than 8% under the pivot is not 'no contraction'.
    none: analysis.vcp?.valid && analysis.pivot ? `변동성 수축은 확인되지만 가격이 피벗보다 ${((1 - analysis.last.close / analysis.pivot) * 100).toFixed(1)}% 아래라 아직 셋업 자리는 아닙니다`
      : analysis.templatePass >= 6
      ? `장기 추세는 상승(${TEMPLATE_LABEL} ${analysis.templatePass}/8)이지만, 최근 변동성이 차례로 줄어드는 수축${analysis.dryUp != null && analysis.dryUp >= 0.8 ? '과 거래량 감소' : ''}가 확인되지 않아 VCP 셋업은 성립하지 않습니다 — 셋업이 없다는 것이 악재라는 뜻은 아닙니다${vcp ? ` (${vcp})` : ''}`
      : `뚜렷한 셋업은 없습니다${vcp ? ` (${vcp})` : ''}`
  }[analysis.state];
  // v57.50 D23: no unsourced "weak markets fail more setups" claim — the market state is stated, not interpreted.
  const market = regime?.available ? `시장 상태: ${regime.overall}` : null;
  const conflict = analysis.timeframeConflict ? ` — 다만 주봉은 ${w?.stage === 4 ? 'Weinstein 4단계(하락)' : '10·30주 역배열'}이라 상위 시간대와 방향이 어긋납니다` : '';
  return { headline: `${state}${conflict}`, why, market, flip: analysis.flip };
}
