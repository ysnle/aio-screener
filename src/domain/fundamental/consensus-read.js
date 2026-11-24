// The forward view of a US listing — analyst consensus EPS for the next four fiscal quarters
// (public-data/consensus-estimates.json, reference only). Consensus EPS is an adjusted figure (one-offs excluded), so
// the growth and the PER beside it use the last four reported quarters on that same basis, never the SEC net income.
// The price is the screener artifact's close (valuationPrice). Nothing here enters a score.
import { readNumber as finite } from '../shared/number.js';
import { readRowNumber } from '../../data/contracts/screener.js';
import { claim, say, sayJoin, NOTHING } from '../shared/claim.js';

export const CONSENSUS_MAX_AGE_DAYS = 21;
export const CONSENSUS_THIN_ESTIMATES = 3;
/** A close more than 10 calendar days old (about a week of sessions plus a holiday weekend) is not the current price. */
export const CONSENSUS_PRICE_MAX_AGE_DAYS = 10;
/** Net 4-week revisions (up − down) needed before the tone leans either way. */
export const CONSENSUS_NET_REVISION_FLOOR = 2;
/** A one-month move this large either way is a price direction for the revisions comparison. */
export const CONSENSUS_PRICE_MOVE_PCT = 5;
// GOOGL read "직전 4개 분기 PER 17.8배 · 예상 이익 -35%" — the trailing sum (19.91) carried
// what the forward consensus (12.94) leaves out, so a "same adjusted basis" comparison was not one. A forward sum 30%
// or more below the trailing sum is not compared: both sums are shown, the trailing PER and the growth are not.
export const CONSENSUS_BASIS_GAP = -30;
// A reported quarter at least twice its own estimate with the forward sum 15% or more below the trailing sum is the same
// mismatch at a smaller gap (GOOGL -29.4% with one quarter at 9.11 against an estimate of 2.88).
export const CONSENSUS_ONE_OFF_GAP = -15;
export const CONSENSUS_ONE_OFF_MULTIPLE = 2;
// Only the quarters summed into the trailing EPS can put a one-off into it: `hist` keeps up to eight reported quarters
// (newest first), so an older spike outside trailing.from…trailing.to says nothing about this comparison. Without the
// window the newest four stand in for it (the producer sums the newest four).
const oneOffQuarter = (hist, { from, to } = {}) => String(hist || '').split(';').map((part) => part.split(':'))
  .filter(([month], index) => (from && to ? month >= from && month <= to : index < 4))
  .find(([, actual, estimate]) => finite(estimate) > 0 && finite(actual) >= CONSENSUS_ONE_OFF_MULTIPLE * finite(estimate)) || null;
const DAY_MS = 86400000;
// The consensus figures read from the screener row, dated by its price session rather than by the estimate.
const ROW_MEASURES = Object.freeze(['ret1m', 'pctFrom52wHigh', 'reportedPe']);

// CRWD showed "직전 4개 분기 PER 2073.6배 · Forward PER 2851.3배" (EPS $0.08) and the screener
// TSLA 454.4배 with nothing saying the multiple no longer measures price against profit. Above this a multiple is shown
// as not meaningful (the sort still uses the number).
export const PE_MEANINGFUL_MAX = 200;
// SNDK printed "Forward PER 약 0.4배" — four quarters' EPS at or above the close means the price and the EPS
// are not on the same share basis (a split, a share class); no multiple is printed from them, and the reason is.
export const PE_PLAUSIBLE_MIN = 1;
// Expected earnings growth at or above this is where a forward multiple flatters at a cyclical peak. One
// condition for the 이 주가가 반영하는 것 reading (priced-in.js) and the 투자 논지 valuation path (stock-lens.js buildThesisFrame).
export const PEAK_EARNINGS_GROWTH = 50;
export const peakEarningsCaution = (view) => view?.growth != null && view.growth >= PEAK_EARNINGS_GROWTH;
export const peMultipleText =(pe, digits = 1) => (Number.isFinite(pe) ? (pe > PE_MEANINGFUL_MAX ? `${PE_MEANINGFUL_MAX}배 초과(이익이 작아 의미 낮음)` : `${pe.toFixed(digits)}배`) : '—');

/** Numbers only: null when there is no fresh consensus row or no close for this listing. */
export function consensusView(row, estimate, { now = Date.now() } = {}) {
  if (!estimate || estimate.unavailable || !estimate.fwd || !estimate.trailing) return null;
  const asOf = Date.parse(estimate.asOf || '');
  if (!Number.isFinite(asOf) || now - asOf > CONSENSUS_MAX_AGE_DAYS * DAY_MS || asOf - now > DAY_MS) return null;
  const price = finite(row?._valuationPrice) ?? finite(row?.valuationPrice) ?? finite(row?._valuationPePrice) ?? finite(row?.pePrice);
  const fwdEps = finite(estimate.fwd.eps);
  const trailingEps = finite(estimate.trailing.eps);
  if (price == null || price <= 0 || fwdEps == null || trailingEps == null) return null;
  // Codex audit F29: the estimate's age was checked but the close's was not — a 2020 close beside a 2026
  // consensus produced a "current" Forward PER. A dated close older than CONSENSUS_PRICE_MAX_AGE_DAYS is not used.
  const priceDate = String(row?.factorSessionDate || '').slice(0, 10) || null;
  const priceMs = priceDate ? Date.parse(`${priceDate}T00:00:00Z`) : NaN;
  if (!priceDate || !Number.isFinite(priceMs) || now - priceMs > CONSENSUS_PRICE_MAX_AGE_DAYS * DAY_MS || priceMs > now) return null; // An undated close fails closed
  const basisHeld = Math.max(fwdEps, trailingEps) * PE_PLAUSIBLE_MIN >= price;
  return {
    price, priceDate, asOf: new Date(asOf).toISOString().slice(0, 10),
    fwdEps, trailingEps, fwdFrom: estimate.fwd.from, fwdTo: estimate.fwd.to, priceBasisHeld: basisHeld,
    fwdPe: fwdEps > 0 && !basisHeld ? price / fwdEps : null,
    ...(() => {
      const growth = trailingEps > 0 ? (fwdEps / trailingEps - 1) * 100 : null;
      const oneOff = growth != null && growth <= CONSENSUS_ONE_OFF_GAP ? oneOffQuarter(estimate.hist, estimate.trailing) : null;
      const basisGap = growth != null && (growth <= CONSENSUS_BASIS_GAP || oneOff != null);
      return { trailingPe: trailingEps > 0 && !basisGap && !basisHeld ? price / trailingEps : null, growth: basisGap ? null : growth, rawGrowth: growth, basisGap,
        oneOffQuarter: oneOff?.[0] || null, oneOffMultiple: oneOff ? finite(oneOff[1]) / finite(oneOff[2]) : null };
    })(),
    minEstimates: finite(estimate.fwd.minEstimates), up4w: finite(estimate.fwd.up4w) || 0, down4w: finite(estimate.fwd.down4w) || 0,
    // Both counts absent is "not collected", not "no change".
    revisionsKnown: finite(estimate.fwd.up4w) != null || finite(estimate.fwd.down4w) != null,
    spread: finite(estimate.fwd.hi) != null && finite(estimate.fwd.lo) != null && fwdEps > 0 ? (estimate.fwd.hi - estimate.fwd.lo) / fwdEps * 100 : null
  };
}

/** The reading for the stock page's 재무 흐름 list (same shape as buildFiscalRead points). */
export function buildConsensusPoint(row, estimate, options = {}) {
  const view = consensusView(row, estimate, options);
  if (!view) return null;
  // Review (E1/8j): the window is the next four quarters not yet reported (the usual forward-EPS convention). When the
  // first of them has already ended — results due, not yet out — that is said, so '향후' does not read as all-future quarters.
  const [fy, fm] = String(view.fwdFrom || '').split('-').map(Number);
  const firstEnded = Number.isFinite(fy) && Number.isFinite(fm) && Date.UTC(fy, fm, 1) <= Date.parse(`${view.priceDate || view.asOf}T00:00:00Z`);
  const ym = (text) => { const [y, m] = String(text || '').split('-').map(Number); return Number.isFinite(y) && Number.isFinite(m) ? `${y}년 ${m}월` : String(text || ''); };
  const range = `${ym(view.fwdFrom)}~${ym(view.fwdTo)} 분기${firstEnded ? `, 첫 분기(${ym(view.fwdFrom)})는 끝났고 실적 발표 전` : ''}`;
  // Every figure is a claim on the listing's consensus row (subject `consensus:<symbol>`, dated by the estimate) or on its
  // screener row (dated by the price session); a multiple past PE_MEANINGFUL_MAX prints that line instead of itself.
  const subject = `consensus:${String(estimate.sym || row?.sym || row?.symbol || '').toUpperCase()}`;
  const on = (measure, figures, more = {}) => claim({ subject, measure, asOf: ROW_MEASURES.includes(measure) ? view.priceDate : view.asOf, figures, ...more });
  const multiple = (value, basis, label) => (value > PE_MEANINGFUL_MAX
    ? say('{pe.threshold} 초과(이익이 작아 의미 낮음)', { pe: on(basis, [{ value, unit: 'x', basis, label }], { word: 'over-line', compare: { threshold: PE_MEANINGFUL_MAX, relation: 'above', digits: 0 } }) })
    : say('{pe}', { pe: on(basis, [{ value, unit: 'x', basis, label }]) }));
  // The visible line leads with the multiple; the stock page folds everything after the first ' — '.
  const lead = view.priceBasisHeld ? say('Forward PER 보류')
    : view.fwdPe != null
    ? say('Forward PER {about}{fwd}{trailing}{growth}', { about: view.fwdPe > PE_MEANINGFUL_MAX ? '' : '약 ', fwd: multiple(view.fwdPe, 'fwdPe', 'Forward PER'),
      trailing: view.trailingPe != null ? say(', 직전 4개 분기 조정 기준 {pe}', { pe: multiple(view.trailingPe, 'trailingPe', '조정 기준') }) : NOTHING,
      growth: view.growth != null ? say(', 예상 이익 {growth}', { growth: on('growth', [{ value: view.growth, unit: 'pct', digits: 0, basis: 'growth', label: '예상 이익' }]) }) : NOTHING })
    : say('향후 4개 분기 적자 예상');
  const eps = on('eps', [{ value: view.price, unit: 'perShare', basis: 'price', label: '종가' }, { value: view.fwdEps, unit: 'perShare', basis: 'fwdEps', label: '예상 EPS 합' },
    { value: view.trailingEps, unit: 'perShare', basis: 'trailingEps', label: '실적' }]);
  const gapReason = view.oneOffQuarter
    ? say('크게 낮고 {q} 분기 실적이 당시 예상의 {beat.threshold}를 넘어', { q: view.oneOffQuarter,
      beat: on('oneOff', [{ value: view.oneOffMultiple, unit: 'x', basis: `beat:${view.oneOffQuarter}`, label: '당시 예상' }], { word: 'at-least', compare: { threshold: CONSENSUS_ONE_OFF_MULTIPLE, relation: 'atLeast', digits: 0 } }) })
    : say('{drop.threshold} 이상 낮아', { drop: on('basisGap', [{ value: -view.rawGrowth, unit: 'share', basis: 'drop', label: '직전 4개 분기 실적 합' }], { word: 'at-least', compare: { threshold: -CONSENSUS_BASIS_GAP, relation: 'atLeast' } }) });
  const trailingOver = view.trailingEps >= view.price;
  const basis = view.priceBasisHeld
    ? say('{side} {held.1}가 종가 {held}{date} 이상이라, 가격과 EPS가 같은 주식 기준(분할·주식 종류)인지 확인되지 않아 배수를 적지 않습니다', { date: view.priceDate ? `(${view.priceDate})` : '',
      side: trailingOver ? '직전 4개 분기 실적 EPS 합' : '향후 4개 분기 예상 EPS 합',
      held: on('eps', [{ value: view.price, unit: 'perShare', basis: 'price', label: '종가' },
        trailingOver ? { value: view.trailingEps, unit: 'perShare', basis: 'trailingEps', label: '실적' } : { value: view.fwdEps, unit: 'perShare', basis: 'fwdEps', label: '예상 EPS 합' }]) })
    : say('종가 {eps}{date} ÷ 아직 실적이 발표되지 않은 4개 분기({range}) 예상 EPS 합 {eps.1}{compared}', { eps, date: view.priceDate ? `(${view.priceDate})` : '', range,
    compared: view.growth != null ? say(', 직전 4개 분기 실적 {eps.2}와 같은 조정 EPS 기준으로 비교했습니다', { eps })
      : view.basisGap ? say('. 직전 4개 분기 실적 합 {eps.2}보다 {gap}, 일회성 항목 포함 여부 등 같은 기준인지 확인되지 않으므로 성장률과 직전 PER은 표시하지 않습니다', { eps, gap: gapReason }) : NOTHING });
  const revisions = !view.revisionsKnown ? '최근 4주 추정치 변경 자료 없음' : view.up4w || view.down4w ? `최근 4주 추정치 상향 ${view.up4w}, 하향 ${view.down4w}(향후 4개 분기 건수 합계)` /* v58.74: 32 up from 9 analysts read as impossible */ : '최근 4주 추정치 변경 없음';
  const cautions = [];
  if (view.minEstimates != null && view.minEstimates < CONSENSUS_THIN_ESTIMATES) cautions.push(say('추정 애널리스트가 {n}명뿐이라 흔들리기 쉽습니다', { n: String(view.minEstimates) }));
  if (view.spread != null && view.spread >= 30) cautions.push(say('최고·최저 추정 차이가 {spread}로 넓습니다', { spread: on('spread', [{ value: view.spread, unit: 'share', basis: 'spread', label: '최고·최저 추정 차이' }]) }));
  // The peak-earnings caution is part of the 이 주가가 반영하는 것 condition (priced-in.js), not a separate warning here.
  // v58.74 (text audit 종목 C6): price against expectations — where the price sits against its 52-week high beside the net
  // revision direction, and a reported (GAAP) PER below the adjusted one, which points at one-off items.
  // v59.45 (pipeline review P19-CONSENSUS-01): the distance from the 52-week high is a position, not a direction — a
  // stock 20% under its high and up 20% this month read "반대 방향" beside upward revisions. The price direction is the
  // last month's move (the revisions' four weeks); the high stays as context.
  const fromHigh = finite(row?.pctFrom52wHigh);
  // Boundary contract: the price direction and the PER gap are judged on calculable screener values.
  const month = readRowNumber(row, 'ret1m', 'calculation');
  const netRev = view.up4w - view.down4w;
  const revDir = Math.abs(netRev) >= CONSENSUS_NET_REVISION_FLOOR ? (netRev > 0 ? 'up' : 'down') : null;
  const priceDir = month == null ? null : month >= CONSENSUS_PRICE_MOVE_PCT ? 'up' : month <= -CONSENSUS_PRICE_MOVE_PCT ? 'down' : null;
  const versus = revDir && priceDir ? say('주가는 최근 1개월 {move}{high}이고 최근 4주 추정치는 {dir}이 많습니다 — 가격과 이익 전망이 {same} 방향입니다', {
    move: on('ret1m', [{ value: month, unit: 'pct', digits: 0, basis: 'ret1m', label: '최근 1개월' }]),
    high: fromHigh != null ? say('(52주 고점 대비 {high})', { high: on('pctFrom52wHigh', [{ value: fromHigh, unit: 'pct', digits: 0, basis: 'pctFrom52wHigh', label: '52주 고점 대비' }]) }) : '',
    dir: revDir === 'up' ? '상향' : '하향', same: revDir === priceDir ? '같은' : '반대' }) : NOTHING;
  const reportedPe = readRowNumber(row, 'pe', 'calculation');
  const gaapGap = reportedPe != null && view.trailingPe != null && reportedPe > 0 && reportedPe < view.trailingPe * 0.9
    ? say('공시 기준 PER({pe})이 조정 기준보다 낮아, 공시 이익에 일회성 이익이 섞였는지 10-Q에서 확인합니다', { pe: multiple(reportedPe, 'reportedPe', '공시 기준 PER') }) : NOTHING;
  const said = say('{lead} — {body}. 예상치는 계속 바뀌는 참고값이라 점수에는 쓰지 않습니다({asOf} 수집).', { lead, asOf: view.asOf,
    body: sayJoin([basis, say('애널리스트 최소 {n}명, {revisions}', { n: String(view.minEstimates ?? '?'), revisions }), versus, gaapGap, ...cautions], '. ') });
  const text = said.text;
  // One revision either way is not a direction — the net count (up − down) must reach the floor.
  const net = view.up4w - view.down4w;
  const clears = Math.abs(net) >= CONSENSUS_NET_REVISION_FLOOR;
  const tone = !clears ? 'neutral' : net > 0 ? 'favorable' : 'burden';
  return { id: 'consensus', tone, title: '시장 기대(컨센서스)', text, claims: said.claims, ...view };
}
