// v59.74: the volatility complex (매크로 › 주제별로 보기 › 변동성, and the MOVE card on 금리와 환율). Kept out of
// macro-chapters.js so the rates board can read it without loading every chapter.
import { signedText } from '../shared/number.js';
import { buildCloseSeries, closeBasis } from '../market/session/close-series.js';
import { MARKET_WINDOWS, closeChange } from '../market/session/market-windows.js';
import { RULES } from '../rules/thresholds.js';
import { formatKstWhen, releaseAtMs } from '../briefing/schedule.js';
import { dayLabel } from '../market/story/market-story.js';
import { vixBandRow } from '../market/sentiment/narrative.js';

const signed = (value, digits = 2, unit = '%') => signedText(value, digits, unit);
const historySpan = (history, field) => { const change = closeChange(history, field, MARKET_WINDOWS.rule); return change ? { from: change.from.value, to: change.to.value, pct: change.pct } : null; };
const nextOf = (events, ids) => (events || []).find((event) => ids.includes(event.id)) || null;
const whenOf = (event) => {
  if (!event) return '';
  const at = releaseAtMs(event.id, event.date);
  return Number.isFinite(at) ? `${formatKstWhen(at).label} KST ${event.name}` : `${dayLabel(event.date)} ${event.name}`;
};

// v59.74 (owner 11/7: "VIX, VVIX, MOVE … 채권시장과 환율시장 모두 반영"): the volatility complex. VIX9D, VIX3M, VVIX, MOVE and
// SKEW were collected into history.json and shown nowhere. VIX keeps the 시장 상태 volatility edges (RULES.volatility);
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

export function volatilityChapter(history = [], events = []) {
  const basis = closeBasis(history);
  const vixRows = buildCloseSeries(history, 'vix', { through: basis });
  const vix = vixRows.at(-1);
  if (!vix) return null;
  const sameDay = (field) => { const row = buildCloseSeries(history, field, { through: basis }).at(-1); return row && row.date === vix.date ? row.value : null; };
  const vix3m = sameDay('vix3m'); const vix9d = sameDay('vix9d');
  const V = RULES.volatility;
  const ratio = vix3m ? vix.value / vix3m : null;
  const ranges = VOL_TIERS.map(([field, label]) => closeRange(history, field, label, basis)).filter(Boolean);
  const byId = Object.fromEntries(ranges.map((range) => [range.id, range]));
  const span = (field) => historySpan(history, field);
  const vix20 = span('vix'); const vvix20 = span('vvix'); const move20 = span('move');
  // the shared VIX band names — '18~25 주의 구간' here read 통상 범위
  // [안정] in the AI header for the same VIX 21.
  const row = vixBandRow(vix.value);
  const band = `${row.to == null ? `${row.from} 이상` : row.from == null ? `${row.to} 아래` : `${row.from}~${row.to}`} ${row.label}`;
  const parts = [];
  // 1. Equity volatility and its term structure (the 시장 상태 lines).
  const term = ratio == null ? '' : ratio >= V.invertedRatioAt ? `이고, 3개월 VIX보다 높아 기간 구조가 역전됐습니다(${ratio.toFixed(2)})`
    : ratio < V.calmRatioBelow ? `이고, 기간 구조는 정상입니다(VIX ÷ 3개월 VIX ${ratio.toFixed(2)})` : `이고, 3개월 VIX에 가까워 기간 구조가 평평합니다(${ratio.toFixed(2)})`;
  const front = vix9d != null && vix9d > vix.value && ratio != null && ratio >= V.invertedRatioAt ? ` 9일 VIX(${vix9d.toFixed(1)})가 더 높아 불안이 바로 앞 날짜에 몰려 있습니다.` : '';
  parts.push(`VIX(${vix.value.toFixed(1)})는 ${band}${term || '입니다'}.${front}`);
  // 2. VVIX: the price of insurance on VIX itself.
  const vv = byId.vvix;
  if (vv) {
    if (vv.pct >= 75 && vix.value < V.calmBelow) parts.push(`VIX는 낮은데 VVIX(${vv.now.toFixed(0)})가 1년 기록의 ${place(vv.pct)}이라, 겉은 조용하지만 급변에 대비한 옵션 수요가 큽니다.`);
    else if (vv.pct >= 75) parts.push(`VVIX(${vv.now.toFixed(0)}, 1년 기록의 ${vv.pct}% 위치)는 변동성이 더 튈 수 있다는 데 값을 매겨, 큰 반등과 급락이 번갈아 나오기 쉽습니다.`);
    else if (vv.pct <= 25 && vix.value >= V.stressAt) parts.push(`VIX는 높지만 VVIX(${vv.now.toFixed(0)})는 1년 기록의 ${place(vv.pct)}이라, 불안이 더 커질 쪽보다 고점 근처에서 굳는 쪽에 값이 매겨져 있습니다.`);
  }
  // 3. MOVE against VIX: which market the shaking comes from.
  const mv = byId.move; const vx = byId.vix;
  const beforeMove = parts.length;
  if (mv && vx) {
    const gap = mv.pct - vx.pct;
    if (gap >= 30) parts.push(`채권 변동성(MOVE ${mv.now.toFixed(0)}, 1년 ${mv.pct}% 위치)이 주식 변동성(${vx.pct}% 위치)보다 높은 자리에 있어, 흔들림의 출처는 금리 쪽입니다 — CPI·FOMC 같은 금리 발표 날 주가가 크게 반응하기 쉬운 구성입니다.`);
    else if (gap <= -30) parts.push(`채권 변동성(MOVE ${mv.now.toFixed(0)}, 1년 ${mv.pct}% 위치)은 조용한데 주식 변동성(${vx.pct}% 위치)만 높아, 금리보다 이익·업종 같은 주식 고유의 걱정입니다.`);
    else if (mv.pct >= 75 && vx.pct >= 75) {
      // Both high: the 20-session direction tells whether they feed each other or bond volatility is already easing.
      const easing = move20 && vix20 && move20.pct <= -5 && vix20.pct >= 5;
      parts.push(easing ? `채권 변동성(MOVE ${mv.now.toFixed(0)})도 1년 기록의 높은 쪽이지만 20거래일 ${signed(move20.pct, 1)}로 가라앉는 중이고, 이번 흔들림은 주식 쪽(VIX ${signed(vix20.pct, 1)})에서 커졌습니다 — 금리보다 이익·업종 걱정이 앞섭니다.`
        : `채권(MOVE ${mv.now.toFixed(0)})과 주식 변동성이 함께 1년 기록의 높은 쪽이라, 금리와 주가 불안이 서로를 키우는 국면입니다.`);
    }
    else parts.push(`채권 변동성(MOVE ${mv.now.toFixed(0)})은 1년 기록의 ${place(mv.pct)}입니다.`);
  }
  const bondRead = parts.length > beforeMove ? parts.at(-1) : null;
  const next = nextOf(events, ['us-cpi', 'us-fed-rate', 'us-nfp']);
  const fmtPct = (move) => (move ? signed(move.pct, 1) : '—');
  return {
    bond: mv ? { ...mv, change20: move20 ? move20.pct : null, read: bondRead } : null,
    id: 'volatility', title: '변동성 — 주식 · 채권 · 변동성의 변동성', question: '흔들림의 크기와 출처, 주식인지 금리인지',
    viz: { caption: '20거래일 등락 (%)', unit: '%', points: [vix20 ? { x: 'VIX', value: vix20.pct, hot: true } : null, vvix20 ? { x: 'VVIX', value: vvix20.pct } : null, move20 ? { x: 'MOVE', value: move20.pct } : null].filter(Boolean) },
    now: [`VIX ${vix.value.toFixed(1)}${vix20 ? ` (${fmtPct(vix20)})` : ''}`, ratio != null ? `3개월 대비 ${ratio.toFixed(2)}` : null, vv ? `VVIX ${vv.now.toFixed(1)}` : null, mv ? `MOVE ${mv.now.toFixed(1)}${move20 ? ` (${fmtPct(move20)})` : ''}` : null].filter(Boolean).join(' · '),
    mean: parts.join(' '),
    next: whenOf(next) || '매일',
    flip: `VIX가 3개월 VIX의 ${V.calmRatioBelow}배 아래로 내려오고 VVIX가 1년 중앙값${vv ? `(${vv.p50.toFixed(0)})` : ''} 아래로 오면 진정으로, MOVE가 1년 상위 10%${mv ? `(${mv.p90.toFixed(0)})` : ''}를 넘으면 금리발 불안으로 읽습니다.`,
    ranges: ranges.length ? { ranges, label: '변동성 지수 기록 범위', since: `최근 ${ranges[0].n}거래일`, line: ranges.map((range) => `${range.label} ${range.now.toFixed(1)}(${range.pct}%)`).join(' · ') + ' — 각자의 최근 1년 기록 안 위치입니다.' } : null,
    detail: [['9일 VIX', vix9d != null ? vix9d.toFixed(2) : '—'], ['3개월 VIX', vix3m != null ? vix3m.toFixed(2) : '—'],
      ['VIX가 말하는 S&P 500 하루 변동', `약 ±${(vix.value / Math.sqrt(252)).toFixed(1)}% (1표준편차)`],
      ['MOVE ÷ VIX', mv ? (mv.now / vix.value).toFixed(1) : '—'], ['SKEW (급락 대비 수요)', byId.skew ? `${byId.skew.now.toFixed(0)} · 1년 ${byId.skew.pct}% 위치` : '—']]
  };
}

