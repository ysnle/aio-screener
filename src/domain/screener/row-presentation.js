// v57.62 structure: pure row-presentation helpers for the screener table (labels, visible rank, size bucket,
// staleness and held-ranking copy). No DOM, network or storage — src/ui/pages/screener.js re-exports these names
// for the gates that import them from the page.
import { readRowNumber } from '../../data/contracts/screener.js';
import { latestCompletedSession } from '../market/session/market-calendar.js';
import { finiteNumber as finite } from '../shared/number.js';
import { fiscalYearLabel } from '../fundamental/period.js';


export const FACTOR_LABELS = Object.freeze({
  momentum: { label: '모멘텀', color: 'var(--color-text-success)', description: '최근 1개월을 뺀 12개월 수익률(12-1)' },
  trend: { label: '추세', color: 'var(--color-text-success)', description: '50일선 거리 60%·200일선 거리 40%' },
  lowvol: { label: '저변동', color: 'var(--color-text-primary)', description: '실현 변동성의 역순' },
  size: { label: '규모', color: 'var(--color-text-secondary)', description: '시가총액의 역순(작을수록 높음)' },
  // PBR's equity is the latest filed balance sheet (a quarter when one was filed after the fiscal year).
  value: { label: '밸류', color: 'var(--color-text-warning)', description: '저PER·저PBR — PER은 최근 4개 분기(TTM) 순이익, PBR은 가장 최근에 공시된 재무상태표(분기 포함)의 자본 기준' },
  quality: { label: '퀄리티', color: 'var(--color-text-warning)', description: 'ROE·순이익률 — ROE는 최근 연간(FY), 순이익률은 최근 4개 분기(없으면 최근 연간) 공시 기준' },
  // 2026-10-17 audit: kalmanVelConf is the filter's daily trend velocity discounted by its own uncertainty, and the discount
  // is 1~9% (median 2%) because the state covariance is in log units — it reads as a speed, not a confidence.
  kalman: { label: '추세 속도', color: 'var(--color-accent)', description: '칼만 필터로 추정한 최근 90거래일 추세의 하루 속도(불확실성만큼 소폭 할인)' }
});

// P1318/R664: size-bucket value in USD billions — decision-grade live cap first, else the
// plausibility-checked SEC reference cap; null means "size unknown" (never a zero).
export function capFilterValue(row = {}) {
  return capReading(row)?.billions ?? null;
}
/** The size value with its basis: 'live' (decision-grade quote cap) or 'reference' (SEC shares × completed close). */
export function capReading(row = {}) {
  // v59.46 boundary contract: the live cap is read through the readiness contract (calculation purpose).
  const mcap = readRowNumber(row, 'mcap', 'calculation');
  if (mcap != null && mcap > 0) return { billions: mcap, basis: 'live' };
  const reference = finite(row.referenceMarketCap?.billions);
  return reference != null && reference > 0 ? { billions: reference, basis: 'reference' } : null;
}
// The 시가총액 filter's buckets (USD billions, lower bound inclusive), shared by the screener table and the chat's
// screen tool. Unknown size belongs to no bucket.
export const CAP_BUCKETS = Object.freeze({ MEGA: '초대형($1T 이상)', LARGE: '대형($10B~1T)', MID: '중형($2~10B)', SMALL: '소형($2B 미만)' });
export function capBucketOf(row = {}) {
  const value = capFilterValue(row);
  return value == null ? null : value >= 1000 ? 'MEGA' : value >= 10 ? 'LARGE' : value >= 2 ? 'MID' : 'SMALL';
}

export function numberText(value, digits = 1, suffix = '') {
  return finite(value) == null ? '—' : `${Number(value).toFixed(digits)}${suffix}`;
}

export function visibleRank(row) {
  return row?.screenStatus === 'unavailable' || row?.screenStatus === 'rejected' ? null : finite(row?.rank);
}

// Single source of truth for the displayed position. A rejected row keeps its raw
// rank, so the cell must read the same visible rank the rank cell shows —
// otherwise a row labelled 조건 미충족 displays a position (P1078).
// P1419 (Codex review / owner decision): the rank is a tie-aware percentile among eligible rows
// under the chosen criteria; an A-F letter cut those percentiles at uncalibrated bands and read as
// a quality grade. The position itself is shown instead.
export function rankGrade(rank) {
  const value = finite(rank);
  return value == null ? null : `상위 ${Math.max(1, Math.round(100 - value))}%`;
}

export function vcpStageLabel(stage) {
  // v57.50 C19: the producer's gate is a moving-average order (price > 150 > 200-day line, above the 50-day line, within
  // 30% of the 52-week high) — not a Weinstein stage and not the 50·200-day position the stock summary calls 상승 추세.
  // v57.81: a close above the pivot on heavy volume that closed down is not a breakout (price-factors.js).
  return ({ not_stage2: '이동평균 배열 미충족', breakout: '피벗 돌파', pivot_down: '피벗 위 하락(거래량 증가)', extended: '피벗에서 확장(+5% 초과)', near_pivot: '피벗 근접', contracting: '변동폭 수축', basing: '기반 형성', stage2_only: '이동평균 배열 충족' })[stage] || '관측';
}

// P1319/N12: one honest statement of staleness per table instead of one per cell.
export function describeStaleDates(dates = []) {
  const unique = [...new Set(dates.filter(Boolean))].sort();
  if (!unique.length) return '';
  const span = unique.length === 1 ? unique[0] : `${unique[0]} ~ ${unique[unique.length - 1]}`;
  return `흐리게 표시된 값은 ${span} 기준 관측값으로 최신이 아닙니다(참고용). 셀을 누르거나 마우스를 올리면 출처·관측 시각이 보입니다.`;
}

// 2026-10-13 review S01: a weight profile whose computable share is under the model's 80% floor can only
// produce a held ranking. Measure it from the ranking's own per-factor coverage so the button can say so.
export function profileComputability(weights, factorCoverage) {
  const entries = Object.entries(weights || {}).filter(([, value]) => Number.isFinite(Number(value)) && Number(value) > 0);
  const total = entries.reduce((sum, [, value]) => sum + Number(value), 0);
  if (!(total > 0) || !factorCoverage || !Object.keys(factorCoverage).length) return null;
  const missing = entries.filter(([key]) => factorCoverage[key]?.active !== true).map(([key]) => key);
  const covered = entries.filter(([key]) => factorCoverage[key]?.active === true).reduce((sum, [, value]) => sum + Number(value), 0);
  const pct = Math.round(covered / total * 1000) / 10;
  return { pct, available: pct >= 80, missing };
}

// P1449: user copy for a held re-rank — the same vocabulary as the model's own fail-closed
// semantics (결측은 중립 취급하지 않음, W07-A/P1146).
// Codex structure review 2026-10-12 (UI): the selected market's own factor session versus that market's
// latest completed session. KR closes 15:30 KST, so after the close a 10/08 KR factor file is behind even
// while the US file is current — the hold copy and the population note must name the market that is late.
export function factorSessionLag(market, factorSessionDate, now = Date.now()) {
  const session = String(factorSessionDate || '').slice(0, 10);
  const latest = latestCompletedSession(market, now);
  if (!session || !latest?.date || session >= latest.date) return null;
  return { session, latest: latest.date, label: market === 'KR' ? '한국장' : '미국장' };
}

// When no row of the selected market carries a rank because that market's factor session is behind its latest
// completed session, the header and the table say so instead of a bare 0 or '조건에 맞는 종목이 없습니다'. The header's
// close-basis stamp already names the market and the close date, so neither line repeats them: the header carries the
// reason once, the table a short notice for the unranked list it shows.
export function sessionHoldLine(market, { rankedCount = 0, factorSessionDate = null, now = Date.now() } = {}) {
  if (rankedCount > 0) return null;
  return factorSessionLag(market, factorSessionDate, now)
    ? { header: '순위 보류(최신 거래일 종가 대기)', table: '순위 보류 — 최신 거래일 종가가 들어오면 순위를 매깁니다' }
    : null;
}

// Why a row is outside the ranked population (factor-ranks populationExclusion): a short label for the counts and the
// sentence for the rank cell's hover. 'pinned' — a price held by a pending acquisition.
export const POPULATION_EXCLUSION_TEXT = Object.freeze({
  fund: Object.freeze({ short: 'ETF·펀드', long: 'ETF·펀드는 기업 주식과 같은 기준으로 비교하지 않아 순위에서 뺐습니다.' }),
  spac: Object.freeze({ short: 'SPAC', long: '기업인수목적회사(SPAC)는 신탁 현금이라 주가가 거의 움직이지 않아 순위에서 뺐습니다.' }),
  illiquid: Object.freeze({ short: '하루 거래대금 100만 달러 미만', long: '하루 평균 거래대금이 100만 달러 미만이라 확장 순위에서 뺐습니다.' }),
  foreign: Object.freeze({ short: '해외 상장', long: '도쿄·대만 상장 종목은 거래일과 통화가 달라 미국 종목과 같은 순위로 비교하지 않습니다.' }),
  pinned: Object.freeze({ short: '가격 고정', long: '인수 진행 등으로 가격이 고정돼 순위에서 제외' })
});

export function describeRankingHold(hold, { factorSessionDate = null, market = 'US', now = Date.now() } = {}) {
  if (!hold || !hold.reason) return null;
  // Codex review 2026-10-05: when the price inputs are simply one session behind, say that — not a
  // generic coverage failure that reads as if the screener were broken.
  const lag = factorSessionLag(market, factorSessionDate, now);
  if (/coverage|eligible/.test(hold.reason) && lag) {
    return `순위 보류 — 가격 자료가 ${lag.session.slice(5).replace('-', '/')} 종가 기준이고, 그 뒤 ${lag.latest.slice(5).replace('-', '/')} ${lag.label}이 끝났습니다. 다음 자료 갱신으로 최신 종가가 들어오면 순위를 다시 계산합니다(지난 값으로 순위를 매기지 않습니다).`;
  }
  const coverage = hold.requestedWeightCoveragePct != null ? `${hold.requestedWeightCoveragePct}%` : null;
  const requested = hold.requestedFactorWeights && Object.keys(hold.requestedFactorWeights).length
    ? Object.entries(hold.requestedFactorWeights).map(([key, value]) => `${FACTOR_LABELS[key]?.label || key} ${((Number(value) || 0) * 100).toFixed(0)}%`).join(', ')
    : null;
  if (hold.reason === 'requested-factor-coverage-below-threshold') {
    return `순위 보류 — "${hold.requestedProfile || '선택한 프로필'}"의 요청 가중(${requested || '가중치 확인 필요'}) 중 계산 가능 비중이 ${coverage ?? '확인 필요'}로 80% 미만입니다(결측 팩터는 중립값으로 대체하지 않습니다). 이전 계산은 폐기됐습니다 — 표의 순위·점수 칸은 비워 둡니다.`;
  }
  if (/coverage/.test(hold.reason)) return `순위 보류 — 팩터 커버리지가 최소 기준(80%)에 못 미칩니다(결측 팩터는 중립값으로 대체하지 않습니다). 이전 계산은 폐기됐습니다.`;
  return `순위 보류 — 요청한 조건에서 팩터 계산 기준을 충족하지 못해 순위를 매기지 않았습니다(결측 팩터는 중립값으로 대체하지 않습니다). 이전 계산은 폐기됐습니다.`;
}

// v57.87 (owner X-bookmark read 2026-10-16): the follow-through evidence of one row in short words, plus a longer title.
// Order: base number → pocket pivot → down-day resilience → heavy down days → climax signs. Missing pieces are left out;
// a row with none of them reads '—'. Words only — no entry, exit or target.
export const CLIMAX_SIGN_LABELS = Object.freeze({ 'run-up-days': '10일 중 8일 이상 상승', 'largest-gain': '연중 최대 상승폭', 'largest-volume': '연중 최대 거래량 상승일', 'stretch-200': '200일선 +70% 이상' });
export function followThroughSummary(row = {}) {
  const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
  const parts = [];
  const details = [];
  const base = num(row.baseCount);
  if (base != null) {
    // No trend restart inside the fetched history: earlier bases are unseen, so the count is a floor.
    const open = row.baseCountLowerBound === true;
    parts.push(base === 0 && !open ? '베이스 전' : `베이스 ${base}번째${open ? ' 이상' : ''}${row.baseForming ? '(형성 중)' : ''}`);
    if (open) details.push('받은 기간 안에 추세가 다시 시작된 지점이 없어 그 전 베이스는 세지 못함');
    details.push(base === 0 ? '추세가 다시 시작된 뒤 아직 8% 이상 조정을 거친 베이스가 없음' : `추세가 다시 시작된 뒤 ${base}번째 베이스${row.baseForming ? ` — 지금 고점 대비 -${num(row.baseDepthPct) ?? '?'}% 조정 중` : ''}, 3번째 이후는 실패가 잦다는 것이 오닐 계열의 관찰`);
  }
  const pocket = num(row.pocketPivotAgo);
  if (pocket != null) { parts.push(pocket === 0 ? '포켓 피벗 오늘' : `포켓 피벗 ${pocket}일 전`); details.push('10일선이나 50일선 위에서 오른 날 가운데, 거래량이 직전 10일의 가장 큰 하락일 거래량보다 많았던 날'); }
  const hold = num(row.downDayHoldPct);
  if (hold != null) { parts.push(`하락일 버팀 ${hold}%`); details.push(`최근 60거래일 지수 하락일 ${num(row.downDayCount) ?? '?'}일 중 지수보다 덜 빠진 비율 ${hold}%, 평균 초과 ${num(row.downDayExcessPp) ?? '?'}%p`); }
  const heavy = num(row.heavyDownDays25);
  if (heavy != null && heavy >= 5) { parts.push(`거래량 실린 하락 ${heavy}일`); details.push(`최근 25거래일 중 50일 평균보다 거래량이 많은 1% 이상 하락 ${heavy}일`); }
  const signs = Array.isArray(row.climaxSigns) ? row.climaxSigns.filter((sign) => CLIMAX_SIGN_LABELS[sign]) : [];
  if (signs.length) { parts.push(`클라이맥스 징후 ${signs.length}`); details.push(`긴 상승 뒤 징후: ${signs.map((sign) => CLIMAX_SIGN_LABELS[sign]).join(', ')}`); }
  return { text: parts.length ? parts.join(', ') : '—', title: details.join('\n'), climax: signs.length };
}

// 2026-11-18: the time basis of a row's filing figures, for the cell titles and the inspector. A row without a basis field
// (artifacts before 2026-11-18) is the fiscal year. ROE is always the fiscal year (equity is annual in the store).
const basisField = (row, field) => row?.[`_${field}Basis`] ?? row?.[`${field}Basis`] ?? null;
const throughField = (row, field) => row?.[`_${field}Through`] ?? row?.[`${field}Through`] ?? null;
const fyText = (periodEnd) => fiscalYearLabel(periodEnd) || '최근 회계연도';
export function filingBasisLabel(row = {}, field) {
  const periodEnd = row._fundamentalPeriodEnd ?? row.fundamentalPeriodEnd ?? null;
  if (field === 'pe') {
    const through = row._valuationPeEarningsThrough ?? row.peEarningsThrough ?? null;
    return (row._valuationPeEarningsBasis ?? row.peEarningsBasis) === 'ttm' ? `최근 4개 분기${through ? `(${String(through).slice(0, 7)} 분기까지)` : ''}` : fyText(through || periodEnd);
  }
  if (field === 'margin' || field === 'revGrowth') {
    const through = throughField(row, field);
    return basisField(row, field) === 'ttm' ? `최근 4개 분기${through ? `(${String(through).slice(0, 7)} 분기까지)` : ''}` : fyText(through || periodEnd);
  }
  return fyText(periodEnd);
}
const sameBasis = (row, field) => {
  const peTtm = (row._valuationPeEarningsBasis ?? row.peEarningsBasis) === 'ttm';
  const fieldTtm = basisField(row, field) === 'ttm';
  const peThrough = String(row._valuationPeEarningsThrough ?? row.peEarningsThrough ?? '').slice(0, 10);
  return peTtm === fieldTtm && (!peTtm || peThrough === String(throughField(row, field) || '').slice(0, 10));
};
// One short line when the P/E's earnings and the margin beside it disagree in sign on different periods (a TTM profit beside
// a fiscal-year loss, or the reverse); null when they agree or share one period.
export function filingBasisMismatch(row = {}) {
  const margin = readRowNumber(row, 'margin');
  const pe = readRowNumber(row, 'pe');
  const loss = row._valuationPeLoss === true || row.peLoss === true;
  if (margin == null || sameBasis(row, 'margin')) return null;
  if (pe != null && pe > 0 && margin < 0) return `PER은 ${filingBasisLabel(row, 'pe')} 흑자 기준, 순이익률은 ${filingBasisLabel(row, 'margin')} 적자`;
  if (pe == null && loss && margin > 0) return `${filingBasisLabel(row, 'pe')} 순손실로 PER 없음, 순이익률은 ${filingBasisLabel(row, 'margin')} 흑자`;
  return null;
}
// The filing figures' periods in one line (the inspector's hover title).
export function filingBasisSummary(row = {}) {
  const parts = [];
  if (readRowNumber(row, 'pe') != null || row._valuationPeLoss === true || row.peLoss === true) parts.push(`PER ${filingBasisLabel(row, 'pe')}`);
  if (readRowNumber(row, 'margin') != null) parts.push(`순이익률 ${filingBasisLabel(row, 'margin')}`);
  if (readRowNumber(row, 'revGrowth') != null) parts.push(`매출 성장 ${filingBasisLabel(row, 'revGrowth')}${basisField(row, 'revGrowth') === 'ttm' ? '(직전 4개 분기 대비)' : '(전년 대비)'}`);
  if (readRowNumber(row, 'roe') != null) parts.push(`ROE ${filingBasisLabel(row, 'roe')}`);
  return parts.join(', ');
}

// 2026-11-18 (owner: 배당수익률): the dividend token lives in a leaf module the ticker header reads too.
export { dividendYieldText } from './dividend-text.js';
