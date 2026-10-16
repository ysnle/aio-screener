// v57.54 (owner 2026-10-14): the forward view of a US listing — analyst consensus EPS for the next four fiscal quarters
// (public-data/consensus-estimates.json, reference only). Consensus EPS is an adjusted figure (one-offs excluded), so
// the growth and the PER beside it use the last four reported quarters on that same basis, never the SEC net income.
// The price is the screener artifact's close (valuationPrice). Nothing here enters a score.

export const CONSENSUS_MAX_AGE_DAYS = 21;
export const CONSENSUS_THIN_ESTIMATES = 3;
/** A close more than 10 calendar days old (about a week of sessions plus a holiday weekend) is not the current price. */
export const CONSENSUS_PRICE_MAX_AGE_DAYS = 10;
/** Net 4-week revisions (up − down) needed before the tone leans either way. */
export const CONSENSUS_NET_REVISION_FLOOR = 2;
// v57.70 (2026-10-15 audit): GOOGL read "직전 4개 분기 PER 17.8배 · 예상 이익 -35%" — the trailing sum (19.91) carried
// what the forward consensus (12.94) leaves out, so a "same adjusted basis" comparison was not one. A forward sum 30%
// or more below the trailing sum is not compared: both sums are shown, the trailing PER and the growth are not.
export const CONSENSUS_BASIS_GAP = -30;
const DAY_MS = 86400000;

const finite = (value) => (value != null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null);
const signed = (value) => `${value >= 0 ? '+' : ''}${Math.round(value)}%`;
const usd = (value) => `${value < 0 ? '−' : ''}$${Math.abs(value).toFixed(2)}`;

/** Numbers only: null when there is no fresh consensus row or no close for this listing. */
export function consensusView(row, estimate, { now = Date.now() } = {}) {
  if (!estimate || estimate.unavailable || !estimate.fwd || !estimate.trailing) return null;
  const asOf = Date.parse(estimate.asOf || '');
  if (!Number.isFinite(asOf) || now - asOf > CONSENSUS_MAX_AGE_DAYS * DAY_MS || asOf - now > DAY_MS) return null;
  const price = finite(row?._valuationPrice) ?? finite(row?.valuationPrice) ?? finite(row?._valuationPePrice) ?? finite(row?.pePrice);
  const fwdEps = finite(estimate.fwd.eps);
  const trailingEps = finite(estimate.trailing.eps);
  if (price == null || price <= 0 || fwdEps == null || trailingEps == null) return null;
  // Codex audit F29 (2026-10-15): the estimate's age was checked but the close's was not — a 2020 close beside a 2026
  // consensus produced a "current" Forward PER. A dated close older than CONSENSUS_PRICE_MAX_AGE_DAYS is not used.
  const priceDate = String(row?.factorSessionDate || '').slice(0, 10) || null;
  const priceMs = priceDate ? Date.parse(`${priceDate}T00:00:00Z`) : NaN;
  if (!priceDate || !Number.isFinite(priceMs) || now - priceMs > CONSENSUS_PRICE_MAX_AGE_DAYS * DAY_MS) return null; // v57.84: an undated close fails closed
  return {
    price, priceDate, asOf: new Date(asOf).toISOString().slice(0, 10),
    fwdEps, trailingEps, fwdFrom: estimate.fwd.from, fwdTo: estimate.fwd.to,
    fwdPe: fwdEps > 0 ? price / fwdEps : null,
    ...(() => {
      const growth = trailingEps > 0 ? (fwdEps / trailingEps - 1) * 100 : null;
      const basisGap = growth != null && growth <= CONSENSUS_BASIS_GAP;
      return { trailingPe: trailingEps > 0 && !basisGap ? price / trailingEps : null, growth: basisGap ? null : growth, basisGap };
    })(),
    minEstimates: finite(estimate.fwd.minEstimates), up4w: finite(estimate.fwd.up4w) || 0, down4w: finite(estimate.fwd.down4w) || 0,
    spread: finite(estimate.fwd.hi) != null && finite(estimate.fwd.lo) != null && fwdEps > 0 ? (estimate.fwd.hi - estimate.fwd.lo) / fwdEps * 100 : null
  };
}

/** The reading for the stock page's 재무 흐름 list (same shape as buildFiscalRead points). */
export function buildConsensusPoint(row, estimate, options = {}) {
  const view = consensusView(row, estimate, options);
  if (!view) return null;
  // v57.55 review (E1/8j): the window is the next four quarters not yet reported (the usual forward-EPS convention). When the
  // first of them has already ended — results due, not yet out — that is said, so '향후' does not read as all-future quarters.
  const [fy, fm] = String(view.fwdFrom || '').split('-').map(Number);
  const firstEnded = Number.isFinite(fy) && Number.isFinite(fm) && Date.UTC(fy, fm, 1) <= Date.parse(`${view.priceDate || view.asOf}T00:00:00Z`);
  const range = `${view.fwdFrom}~${view.fwdTo}${firstEnded ? `, 첫 분기 ${view.fwdFrom}는 끝났고 실적 발표 전` : ''}`;
  // The visible line leads with the multiple; the stock page folds everything after the first ' — '.
  const lead = view.fwdPe != null
    ? `Forward PER 약 ${view.fwdPe.toFixed(1)}배${view.trailingPe != null ? ` · 직전 4개 분기 조정 기준 ${view.trailingPe.toFixed(1)}배` : ''}${view.growth != null ? ` · 예상 이익 ${signed(view.growth)}` : ''}`
    : '향후 4개 분기 적자 예상';
  const basis = `종가 ${usd(view.price)}${view.priceDate ? `(${view.priceDate})` : ''} ÷ 실적 발표 전 4개 분기(${range}) 예상 EPS 합 ${usd(view.fwdEps)}`
    + (view.growth != null ? `, 직전 4개 분기 실적 ${usd(view.trailingEps)}과 같은 조정 EPS 기준으로 비교했습니다`
      : view.basisGap ? `. 직전 4개 분기 실적 합 ${usd(view.trailingEps)}보다 30% 이상 낮아, 일회성 항목 포함 여부 등 같은 기준인지 확인되지 않으므로 성장률과 직전 PER은 표시하지 않습니다` : '');
  const revisions = view.up4w || view.down4w ? `최근 4주 추정치 상향 ${view.up4w} · 하향 ${view.down4w}` : '최근 4주 추정치 변경 없음';
  const cautions = [];
  if (view.minEstimates != null && view.minEstimates < CONSENSUS_THIN_ESTIMATES) cautions.push(`추정 애널리스트가 ${view.minEstimates}명뿐이라 흔들리기 쉽습니다`);
  if (view.spread != null && view.spread >= 30) cautions.push(`최고·최저 추정 차이가 ${Math.round(view.spread)}%로 넓습니다`);
  // A large expected jump is exactly where a forward multiple flatters: at a cyclical earnings peak it reads cheapest.
  if (view.growth != null && view.growth >= 50) cautions.push('큰 이익 증가가 전제라, 경기에 따라 이익이 크게 오르내리는 업종이면 정점 근처에서 Forward PER이 가장 낮게 보입니다');
  const text = `${lead} — ` + [basis, `애널리스트 최소 ${view.minEstimates ?? '?'}명 · ${revisions}`, ...cautions].join('. ')
    + `. 예상치는 계속 바뀌는 참고값이라 점수에는 쓰지 않습니다(${view.asOf} 수집).`;
  // v57.81: one revision either way is not a direction — the net count (up − down) must reach the floor.
  const net = view.up4w - view.down4w;
  const clears = Math.abs(net) >= CONSENSUS_NET_REVISION_FLOOR;
  const tone = !clears ? 'neutral' : net > 0 ? 'favorable' : 'burden';
  return { id: 'consensus', tone, title: '시장 기대(컨센서스)', text, ...view };
}
