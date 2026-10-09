// P1432 (stage 5, owner direction 2026-10-04): 오늘 is the screen a trader opens every morning, so it
// answers "what changed since the last session" and "what happened to my names" before anything else.
// Pure functions over the completed-close history and the published screener rows — no live quote is
// promoted to a close, and a measure missing on either session is left out rather than read as zero.
import { buildCloseSeries, buildMarketRegime, closeBasis } from './market-read.js';
import { openSessionDatesBetween } from '../market/market-calendar.js';

// Codex browser audit H02: "어제와 달라진 점" compared 10/2 with 10/6 because the 10/5 record was missing, and
// still read as a one-day change. US trading sessions strictly between the two compared dates are listed so the
// title can say the comparison spans a gap.
// P1533: the walk is the shared holiday-aware one; an unregistered year yields no session (a gap is never claimed unverified).
export function missingSessionsBetween(fromDate, toDate) {
  return openSessionDatesBetween(fromDate, toDate, { market: 'US', includeEnd: false, unknownYear: 'closed', maxDays: 15 });
}

const finite = (value) => (value != null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null);
const signed = (value, digits = 1, unit = '') => `${value >= 0 ? '+' : ''}${value.toFixed(digits)}${unit}`;

function completedRows(history = []) {
  return (Array.isArray(history) ? history : []).filter((row) => row && /^\d{4}-\d{2}-\d{2}$/.test(String(row.date || '')) && finite(row.spx) != null);
}

const MEASURES = Object.freeze([
  { key: 'spx', label: 'S&P 500', kind: 'pct' },
  { key: 'nasdaq', label: '나스닥', kind: 'pct' },
  { key: 'vix', label: 'VIX', kind: 'level', digits: 1 },
  { key: 'tnx', label: '미 10년물', kind: 'bp' },
  { key: 'dxy', label: '달러 인덱스', kind: 'pct' },
  { key: 'wti', label: 'WTI', kind: 'pct' },
  { key: 'breadth50', label: '50일선 위 종목', kind: 'pp' },
  { key: 'fg', label: '공포·탐욕', kind: 'level', digits: 0 },
  { key: 'kospi', label: '코스피', kind: 'pct' },
  { key: 'usdkrw', label: '원/달러', kind: 'pct' }
]);

function measureChange(measure, history, basis, prevDate) {
  // One value per NY trading date (buildCloseSeries): carried-forward weekend rows are not sessions.
  const series = buildCloseSeries(history, measure.key, { through: basis });
  const now = series.length ? series[series.length - 1] : null;
  const prev = [...series].reverse().find((point) => point.date <= prevDate) || null;
  if (!now || !prev || now.date !== basis || prev.date === now.date || prev.value === 0) return null;
  const a = prev.value;
  const b = now.value;
  // A breadth share may be stored as a fraction (0-1) or a percent; %p is always in percent points.
  const scale = measure.kind === 'pp' && b <= 1 && a <= 1 ? 100 : 1;
  const value = measure.kind === 'pct' ? (b / a - 1) * 100 : measure.kind === 'bp' ? (b - a) * 100 : (b - a) * scale;
  const text = measure.kind === 'pct' ? signed(value, 2, '%') : measure.kind === 'bp' ? signed(value, 0, 'bp')
    : measure.kind === 'pp' ? signed(value, 1, '%p') : signed(value, measure.digits ?? 1);
  const level = measure.kind === 'pp' ? `${(b * scale).toFixed(0)}%` : measure.kind === 'bp' ? `${b.toFixed(2)}%`
    : measure.kind === 'level' ? b.toFixed(measure.digits ?? 1) : null;
  return { key: measure.key, label: measure.label, value, text, level };
}

// "어제와 달라진 점": the last completed session against the one before it (by S&P 500 trading date).
export function buildDailyChanges(history = []) {
  const rows = completedRows(history);
  const sessions = buildCloseSeries(rows, 'spx');
  if (sessions.length < 2) return { available: false, reason: '비교할 두 거래일의 종가 기록이 없습니다.' };
  const basis = closeBasis(rows);
  const prevDate = sessions[sessions.length - 2].date;
  const moves = MEASURES.map((measure) => measureChange(measure, rows, basis, prevDate)).filter(Boolean);
  // Axis flips are compared on the same inputs (closes only) so a credit or rate input that exists only
  // today cannot read as a change; an axis unknown on either session is left out.
  const regimeNow = buildMarketRegime({ history: rows });
  const sessionOf = (row) => buildCloseSeries([row], 'spx')[0]?.date || row.date;
  const regimePrev = buildMarketRegime({ history: rows.filter((row) => sessionOf(row) <= prevDate) });
  const before = Object.fromEntries((regimePrev.axes || []).map((axis) => [axis.id, axis]));
  const flips = (regimeNow.axes || [])
    .filter((axis) => axis.id !== 'korea' && axis.state !== 'unknown' && before[axis.id] && before[axis.id].state !== 'unknown' && before[axis.id].state !== axis.state)
    .map((axis) => ({ id: axis.id, title: axis.title, from: before[axis.id].stateLabel, to: axis.stateLabel, toState: axis.state }));
  const big = moves.filter((move) => (move.key === 'spx' || move.key === 'nasdaq' || move.key === 'kospi') ? Math.abs(move.value) >= 1
    : move.key === 'vix' ? Math.abs(move.value) >= 2 : move.key === 'tnx' ? Math.abs(move.value) >= 8
      : move.key === 'breadth50' ? Math.abs(move.value) >= 5 : move.key === 'fg' ? Math.abs(move.value) >= 8
        : Math.abs(move.value) >= 1.5);
  const headline = flips.length
    ? `${flips.map((flip) => `${flip.title} ${flip.from} → ${flip.to}`).join(' · ')} — 시장 상태 판정에 들어가는 축이 바뀌었습니다.`
    : big.length ? `축 판정은 그대로이고, 크게 움직인 것은 ${big.map((move) => `${move.label} ${move.text}`).join(' · ')}입니다.`
      : '축 판정이 바뀌지 않았고 크게 움직인 지표도 없습니다 — 어제의 판단이 그대로 유효한 날입니다.';
  return { available: true, date: basis, prevDate, missing: missingSessionsBetween(prevDate, basis), moves, flips, big: big.map((move) => move.key), headline };
}

// "내 종목": watchlist and holdings, with what moved and what crossed a level worth knowing.
export function buildMyNames({ symbols = [], rows = [], live = {}, holdings = [], breadthState = null } = {}) {
  const held = new Set((holdings || []).map((row) => String(row?.symbol || row?.sym || '').toUpperCase()).filter(Boolean));
  const wanted = [...new Set([...held, ...(symbols || []).map((symbol) => String(symbol || '').toUpperCase())].filter(Boolean))];
  const bySymbol = new Map((rows || []).map((row) => [String(row?.sym || row?.symbol || '').toUpperCase(), row]));
  const names = wanted.map((symbol) => {
    const row = bySymbol.get(symbol) || null;
    const quote = live?.[symbol] || null;
    const dayPct = finite(quote?.pct ?? quote?.changePercent);
    const sma50 = finite(row?.pctSma50);
    const high = finite(row?.pctFrom52wHigh);
    const rsi = finite(row?.rsi);
    const notes = [];
    if (sma50 != null) notes.push(sma50 < 0 ? `50일선 아래(${signed(sma50, 1, '%')})` : `50일선 위(${signed(sma50, 1, '%')})`);
    if (high != null && high > -3) notes.push(`52주 고점 근처(${signed(high, 1, '%')})`);
    else if (high != null && high <= -25) notes.push(`52주 고점 대비 ${signed(high, 0, '%')}`);
    if (rsi != null && rsi >= 70) notes.push(`RSI ${rsi.toFixed(0)} 과열권`);
    else if (rsi != null && rsi <= 30) notes.push(`RSI ${rsi.toFixed(0)} 과매도권`);
    const attention = (dayPct != null && Math.abs(dayPct) >= 3 ? 2 : 0) + (rsi != null && (rsi >= 70 || rsi <= 30) ? 1 : 0) + (sma50 != null && sma50 < 0 ? 1 : 0);
    return {
      symbol, name: row?.name || '', held: held.has(symbol), dayPct,
      ret1m: finite(row?.ret1m), notes, attention, known: !!row || dayPct != null
    };
  });
  names.sort((a, b) => b.attention - a.attention || Math.abs(b.dayPct ?? 0) - Math.abs(a.dayPct ?? 0) || a.symbol.localeCompare(b.symbol));
  const below = names.filter((row) => row.notes.some((note) => note.startsWith('50일선 아래'))).length;
  const measured = names.filter((row) => row.notes.length).length;
  const summary = !names.length ? null
    : measured ? `내 종목 ${names.length}개 중 ${below}개가 50일선 아래${below && below * 2 >= measured && breadthState === 'burden' ? ' — 시장 폭이 좁아진 흐름이 내 종목에도 와 있습니다' : below * 2 < measured && breadthState === 'burden' ? ' — 시장 폭은 좁아졌지만 내 종목 대부분은 아직 50일선 위입니다' : ''}.`
      : `내 종목 ${names.length}개 — 팩터 기록이 아직 없어 위치를 읽지 못했습니다.`;
  return { names, summary };
}
