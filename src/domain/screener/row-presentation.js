// v57.62 structure: pure row-presentation helpers for the screener table (labels, visible rank, size bucket,
// staleness and held-ranking copy). No DOM, network or storage — src/ui/pages/screener.js re-exports these names
// for the gates that import them from the page.
import { fieldValueForPurpose } from '../../data/contracts/screener.js';
import { latestCompletedUsSession, latestCompletedKrSession } from '../market/market-calendar.js';

function finite(value) { return typeof value === 'number' && Number.isFinite(value) ? value : null; }

export const FACTOR_LABELS = Object.freeze({
  momentum: { label: '모멘텀', color: 'var(--data-green)', description: '1개월 40%·3개월 40%·6개월 20% 수익률' },
  trend: { label: '추세', color: 'var(--data-green)', description: '50일선 거리 60%·200일선 거리 40%' },
  lowvol: { label: '저변동', color: 'var(--data-cyan)', description: '실현 변동성의 역순' },
  size: { label: '사이즈', color: 'var(--text-muted)', description: '시가총액의 역순' },
  value: { label: '밸류', color: 'var(--data-amber)', description: '저PER·저PBR — 최근 연간(FY) 순이익·자본 기준' },
  quality: { label: '퀄리티', color: 'var(--data-amber)', description: 'ROE·마진·매출성장 — 최근 연간(FY) 공시 기준' },
  kalman: { label: '추세 속도', color: 'var(--accent)', description: '칼만 추세 신뢰도' }
});

// P1318/R664: size-bucket value in USD billions — decision-grade live cap first, else the
// plausibility-checked SEC reference cap; null means "size unknown" (never a zero).
export function capFilterValue(row = {}) {
  const live = finite(row.mcap) != null && row.mcap > 0 && (!row.fieldReadiness || fieldValueForPurpose(row, 'valuation.marketCap', 'calculation') != null) ? row.mcap : null;
  if (live != null) return live;
  const reference = finite(row.referenceMarketCap?.billions);
  return reference != null && reference > 0 ? reference : null;
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
  return ({ not_stage2: '이동평균 배열 미충족', breakout: '피벗 돌파', pivot_down: '피벗 위 하락(거래량 증가)', near_pivot: '피벗 근접', contracting: '변동폭 수축', basing: '기반 형성', stage2_only: '이동평균 배열 충족' })[stage] || '관측';
}

// P1319/N12: one honest statement of staleness per table instead of one per cell.
export function describeStaleDates(dates = []) {
  const unique = [...new Set(dates.filter(Boolean))].sort();
  if (!unique.length) return '';
  const span = unique.length === 1 ? unique[0] : `${unique[0]} ~ ${unique[unique.length - 1]}`;
  return `흐리게 표시된 값은 ${span} 기준 관측값으로 최신이 아닙니다(참고용). 셀에 마우스를 올리면 출처·관측 시각이 보입니다.`;
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
  const latest = market === 'KR' ? latestCompletedKrSession(now) : latestCompletedUsSession(now, { requirePrevious: false });
  if (!session || !latest?.date || session >= latest.date) return null;
  return { session, latest: latest.date, label: market === 'KR' ? '한국장' : '미국장' };
}

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
    ? Object.entries(hold.requestedFactorWeights).map(([key, value]) => `${FACTOR_LABELS[key]?.label || key} ${((Number(value) || 0) * 100).toFixed(0)}%`).join(' · ')
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
    parts.push(base === 0 ? '베이스 전' : `베이스 ${base}번째${row.baseForming ? '(형성 중)' : ''}`);
    details.push(base === 0 ? '추세가 다시 시작된 뒤 아직 8% 이상 조정을 거친 베이스가 없음' : `추세가 다시 시작된 뒤 ${base}번째 베이스${row.baseForming ? ` — 지금 고점 대비 −${num(row.baseDepthPct) ?? '?'}% 조정 중` : ''} · 3번째 이후는 실패가 잦다는 것이 오닐 계열의 관찰`);
  }
  const pocket = num(row.pocketPivotAgo);
  if (pocket != null) { parts.push(pocket === 0 ? '포켓 피벗 오늘' : `포켓 피벗 ${pocket}일 전`); details.push('상승일 거래량이 직전 10일의 가장 큰 하락일 거래량보다 많았던 날'); }
  const hold = num(row.downDayHoldPct);
  if (hold != null) { parts.push(`하락일 버팀 ${hold}%`); details.push(`최근 60거래일 지수 하락일 ${num(row.downDayCount) ?? '?'}일 중 지수보다 덜 빠진 비율 ${hold}% · 평균 초과 ${num(row.downDayExcessPp) ?? '?'}%p`); }
  const heavy = num(row.heavyDownDays25);
  if (heavy != null && heavy >= 5) { parts.push(`거래량 실린 하락 ${heavy}일`); details.push(`최근 25거래일 중 50일 평균보다 거래량이 많은 1% 이상 하락 ${heavy}일`); }
  const signs = Array.isArray(row.climaxSigns) ? row.climaxSigns.filter((sign) => CLIMAX_SIGN_LABELS[sign]) : [];
  if (signs.length) { parts.push(`클라이맥스 징후 ${signs.length}`); details.push(`긴 상승 뒤 징후: ${signs.map((sign) => CLIMAX_SIGN_LABELS[sign]).join(' · ')}`); }
  return { text: parts.length ? parts.join(' · ') : '—', title: details.join('\n'), climax: signs.length };
}
