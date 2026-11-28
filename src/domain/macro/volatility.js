// The volatility complex (매크로 › 주제별로 보기 › 변동성, and the MOVE card on 금리와 환율). Kept out of
// macro-chapters.js so the rates board can read it without loading every chapter.
import { signedText } from '../shared/number.js';
import { buildCloseSeries, closeBasis } from '../market/session/close-series.js';
import { MARKET_WINDOWS, closeChange } from '../market/session/market-windows.js';
import { RULES } from '../rules/thresholds.js';
import { formatKstWhen, releaseAtMs } from '../briefing/schedule.js';
import { dayLabel } from '../market/story/market-story.js';
import { vixBandRow } from '../market/sentiment/narrative.js';
import { volatilityState } from '../market/sentiment/volatility-state.js';
import { shortDate } from '../content/date-labels.js';
import { AXIS_LABELS } from '../market/interpretation/concepts.js';

const signed = (value, digits = 2, unit = '%') => signedText(value, digits, unit);
const historySpan = (history, field) => { const change = closeChange(history, field, MARKET_WINDOWS.rule); return change ? { from: change.from.value, to: change.to.value, pct: change.pct } : null; };
const nextOf = (events, ids) => (events || []).find((event) => ids.includes(event.id)) || null;
const whenOf = (event) => {
  if (!event) return '';
  const at = releaseAtMs(event.id, event.date);
  return Number.isFinite(at) ? `${formatKstWhen(at).label} KST ${event.name}` : `${dayLabel(event.date)} ${event.name}`;
};

// The volatility complex (owner 11/7: "VIX, VVIX, MOVE … 채권시장과 환율시장 모두 반영"). VIX keeps the 시장 상태 volatility edges (RULES.volatility);
// VVIX, MOVE and SKEW have no validated fixed lines, so each is placed inside its own record (mid-rank percentile, the
// credit-tier method) and the read compares where bond volatility and equity volatility sit in theirs.
const VOL_RECORD_SESSIONS = 252; // one year of sessions
const VOL_TIERS = Object.freeze([['vix', 'VIX'], ['vvix', 'VVIX'], ['move', 'MOVE'], ['skew', 'SKEW']]);
function closeRange(history, field, label, basis) {
  const rows = buildCloseSeries(history, field, { through: basis });
  if (rows.length < 120) return null;
  const recent = rows.slice(-VOL_RECORD_SESSIONS);
  const sorted = recent.map((row) => row.value).sort((x, y) => x - y);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))];
  const now = recent.at(-1).value;
  const pct = Math.round((sorted.filter((value) => value < now).length + sorted.filter((value) => value === now).length / 2) / sorted.length * 100);
  return { id: field, label, now, p10: at(0.1), p50: at(0.5), p90: at(0.9), min: sorted[0], max: sorted.at(-1), pct, from: recent[0].date, to: recent.at(-1).date, n: recent.length, display: `${now.toFixed(1)} · ${pct}%` };
}
const place = (pct) => (pct >= 90 ? '상위 10% 안' : pct >= 75 ? '높은 편' : pct <= 10 ? '하위 10% 안' : pct <= 25 ? '낮은 편' : '중간쯤');

// Which market the shaking sits in, from MOVE's and VIX's places in their own records (fixed words; the reading is the AI's).
const SOURCE_WORDS = Object.freeze({ bond: '채권 변동성이 더 높은 자리', equity: '주식 변동성만 높은 자리', bothEasing: '함께 높음, 채권 쪽 20거래일 진정', both: '함께 높음' });
const VVIX_WORDS = Object.freeze({ quietHigh: 'VIX 낮은데 VVIX 높음', high: 'VVIX 높은 편', loudLow: 'VIX 높은데 VVIX 낮음' });
export function volatilitySource(mv, vx, move20 = null, vix20 = null) {
  if (!mv || !vx) return null;
  const gap = mv.pct - vx.pct;
  if (gap >= 30) return 'bond';
  if (gap <= -30) return 'equity';
  if (mv.pct >= 75 && vx.pct >= 75) return move20 && vix20 && move20.pct <= -5 && vix20.pct >= 5 ? 'bothEasing' : 'both';
  return null;
}

export function volatilityChapter(history = [], events = []) {
  const basis = closeBasis(history);
  // Level, band and term structure are the shared volatility state (투자 심리 and 시장 상태 read the same one).
  const state = volatilityState(history, { through: buildCloseSeries(history, 'vix', { through: basis }).at(-1)?.date || basis });
  if (!state) return null;
  const vix = state.level;
  const V = RULES.volatility;
  const ratio = state.term?.ratio ?? null;
  const ranges = VOL_TIERS.map(([field, label]) => closeRange(history, field, label, basis)).filter(Boolean);
  const byId = Object.fromEntries(ranges.map((range) => [range.id, range]));
  const span = (field) => historySpan(history, field);
  const vix20 = span('vix'); const vvix20 = span('vvix'); const move20 = span('move');
  const row = vixBandRow(vix.value);
  const band = `${row.to == null ? `${row.from} 이상` : row.from == null ? `${row.to} 아래` : `${row.from}~${row.to}`} ${row.label}`;
  const vv = byId.vvix;
  const vvWord = !vv ? null : vv.pct >= 75 && vix.value < V.calmBelow ? 'quietHigh' : vv.pct >= 75 ? 'high' : vv.pct <= 25 && vix.value >= V.stressAt ? 'loudLow' : null;
  const mv = byId.move; const vx = byId.vix;
  const source = volatilitySource(mv, vx, move20, vix20);
  // Numbers and fixed words only, one clause per measure.
  const parts = [
    `VIX ${vix.value.toFixed(1)} ${band}`,
    state.term ? `기간 구조 ${state.term.label}, VIX ÷ 3개월 ${ratio.toFixed(2)}${state.term.vix9d != null ? `, 9일 VIX ${state.term.vix9d.toFixed(1)}` : ''}` : null,
    vv ? `VVIX ${vv.now.toFixed(0)} 1년 ${vv.pct}% 위치${vvWord ? ` — ${VVIX_WORDS[vvWord]}` : ''}` : null,
    mv && vx ? `MOVE ${mv.now.toFixed(0)} 1년 ${mv.pct}% 위치, VIX ${vx.pct}% 위치${source ? ` — ${SOURCE_WORDS[source]}` : ` — MOVE ${place(mv.pct)}`}` : null
  ].filter(Boolean);
  const next = nextOf(events, ['us-cpi', 'us-fed-rate', 'us-nfp']);
  const fmtPct = (move) => (move ? signed(move.pct, 1) : '—');
  return {
    state, source,
    bond: mv ? { ...mv, change20: move20 ? move20.pct : null } : null,
    id: 'volatility', title: `${AXIS_LABELS.volatility} — 주식 · 채권 · 변동성의 변동성`, question: '흔들림의 크기와 출처, 주식인지 금리인지',
    viz: { caption: '20거래일 등락 (%)', unit: '%', points: [vix20 ? { x: 'VIX', value: vix20.pct, hot: true } : null, vvix20 ? { x: 'VVIX', value: vvix20.pct } : null, move20 ? { x: 'MOVE', value: move20.pct } : null].filter(Boolean) },
    now: [`VIX ${vix.value.toFixed(1)}${vix20 ? ` (${fmtPct(vix20)})` : ''}`, ratio != null ? `3개월 대비 ${ratio.toFixed(2)}` : null, vv ? `VVIX ${vv.now.toFixed(1)}` : null, mv ? `MOVE ${mv.now.toFixed(1)}${move20 ? ` (${fmtPct(move20)})` : ''}` : null].filter(Boolean).join(' · '),
    mean: `${parts.join(' · ')}.`,
    next: whenOf(next) || '매일',
    flip: `VIX가 3개월 VIX의 ${V.calmRatioBelow}배 아래로 내려오고 VVIX가 1년 중앙값${vv ? `(${vv.p50.toFixed(0)})` : ''} 아래로 오면 진정으로, MOVE가 1년 상위 10%${mv ? `(${mv.p90.toFixed(0)})` : ''}를 넘으면 금리발 불안으로 읽습니다.`,
    ranges: ranges.length ? { ranges, label: '변동성 지수 기록 범위', since: `최근 ${ranges[0].n}거래일`, line: ranges.map((range) => `${range.label} ${range.now.toFixed(1)}(${range.pct}%)`).join(' · ') + ' — 각자의 최근 1년 기록 안 위치입니다.' } : null,
    detail: [['9일 VIX', state.term?.vix9d != null ? state.term.vix9d.toFixed(2) : '—'], ['3개월 VIX', state.term?.vix3m != null ? state.term.vix3m.toFixed(2) : '—'],
      ['VIX가 말하는 S&P 500 하루 변동', `약 ±${(vix.value / Math.sqrt(252)).toFixed(1)}% (1표준편차)`],
      ['직전 세션 등락과 그 범위', state.range ? `${shortDate(state.range.date)} ${signed(state.range.move, 1)} · ${shortDate(state.range.priorDate)} VIX 기준 ±${state.range.sd.toFixed(1)}% ${state.range.label}` : '—'],
      ['MOVE ÷ VIX', mv ? (mv.now / vix.value).toFixed(1) : '—'], ['SKEW (급락 대비 수요)', byId.skew ? `${byId.skew.now.toFixed(0)} · 1년 ${byId.skew.pct}% 위치` : '—']]
  };
}
