// v53.91: research-only setup labels and TradingView evidence derived from the published screener factors.
// This is deliberately not a trading signal. It exposes the user's relative-strength
// pullback and climax-top framework without inventing benchmark, volume, or intraday data.
export const SCREENER_SETUP_MODEL_VERSION = 'screener-setup.v1';

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * @param {object} row normalized screener row, optionally after factor ranking
 * @returns {object} fail-closed, research-only setup profile
 */
export function deriveScreenerSetupProfile(row = {}) {
  const rank = finite(row.rank);
  const ret1m = finite(row.ret1m);
  const ret3m = finite(row.ret3m);
  const ret6m = finite(row.ret6m);
  const pctSma50 = finite(row.pctSma50);
  const pctSma200 = finite(row.pctSma200);
  const rsi = finite(row.rsi);
  const rvol20 = finite(row.rvol20 ?? row.rvol);
  const price = finite(row.price);
  const dollarPrice = row.instrumentRef?.currency === 'USD' ? price : null;
  const adrPct = finite(row.adrPct);
  const pctFrom52wLow = finite(row.pctFrom52wLow);
  const dollarVolume30d = finite(row.dollarVolume30d);
  const dollarVolume = finite(row.dollarVolume);
  const ema8 = finite(row.ema8);
  const ema21 = finite(row.ema21);
  const ema60 = finite(row.ema60);

  const support200 = pctSma200 == null ? 'unavailable'
    : pctSma200 >= -3 && pctSma200 <= 3 ? 'near'
      : pctSma200 > 3 ? 'above' : 'below';
  const mediumTrendPositive = (ret3m != null && ret3m > 0) || (ret6m != null && ret6m > 0);
  const relativeStrengthPullback = rank != null && rank >= 60 && ret1m != null && ret1m <= 0
    && mediumTrendPositive && pctSma200 != null && pctSma200 >= -5
    && pctSma50 != null && pctSma50 <= 5;
  const stretch200 = pctSma200 != null && pctSma200 >= 70;
  const rsiOverheat = rsi != null && rsi >= 80;
  const climaxRisk = stretch200 || rsiOverheat;
  const relativeStrengthEvidenceAvailable = rank != null && ret1m != null
    && (ret3m != null || ret6m != null) && pctSma200 != null && pctSma50 != null;
  const volumeEvidence = rvol20 == null ? 'unavailable'
    : rvol20 >= 2.5 ? 'surge'
      : rvol20 >= 1.5 ? 'elevated' : 'normal';

  // TradingView image #1 is represented as a transparent evidence gate.
  // It must never silently pass on missing ADR, 52-week, liquidity, or EMA data.
  const winnerChecks = {
    priceAbove1: dollarPrice != null ? dollarPrice > 1 : null,
    adrAtLeast4_5: adrPct != null ? adrPct >= 4.5 : null,
    above52wLow70: pctFrom52wLow != null ? pctFrom52wLow >= 70 : null,
    dollarVolume30d10m: dollarVolume30d != null ? dollarVolume30d > 10_000_000 : null,
    dollarVolume7m: dollarVolume != null ? dollarVolume > 7_000_000 : null,
    ema8Above21: ema8 != null && ema21 != null ? ema8 > ema21 : null,
    priceAboveEma60: price != null && ema60 != null ? price > ema60 : null
  };
  const winnerMissing = Object.entries(winnerChecks)
    .filter(([, value]) => value == null)
    .map(([key]) => key);
  const winnerFilter = winnerMissing.length ? 'unavailable'
    : Object.values(winnerChecks).every(Boolean) ? 'candidate' : 'not-confirmed';

  const missingEvidence = [];
  if (rank == null) missingEvidence.push('relative-rank');
  if (pctSma200 == null) missingEvidence.push('200SMA-distance');
  if (rvol20 == null) missingEvidence.push('RVOL');
  if (row.benchmarkRet == null && row.benchmarkRelativeStrength == null) missingEvidence.push('benchmark-relative-strength');
  winnerMissing.forEach((key) => missingEvidence.push(`winner-filter:${key}`));

  const tags = [];
  if (relativeStrengthPullback) tags.push('상대강도 눌림 후보');
  if (support200 === 'near') tags.push('200일선 부근');
  if (climaxRisk) tags.push('클라이맥스 관찰');
  if (volumeEvidence === 'unavailable') tags.push('거래량 확인 필요');
  if (!relativeStrengthPullback && support200 !== 'near' && !climaxRisk) tags.push('추가 셋업 근거 필요');

  const label = climaxRisk ? '클라이맥스 관찰'
    : relativeStrengthPullback ? '상대강도 눌림'
      : support200 === 'near' ? '200일선 부근' : '관찰';
  if (winnerFilter === 'candidate') tags.push('TradingView winner filter candidate');
  if (winnerFilter === 'unavailable') tags.push('TradingView filter evidence unavailable');

  const explanation = relativeStrengthPullback
    ? '중기 수익률·상대 랭크는 유지되지만 최근 수익률이 눌린 후보입니다. 지지/리클레임과 거래량 확인이 필요합니다.'
    : climaxRisk
      ? '200일선 대비 장기 신장 또는 RSI 과열이 감지됐습니다. 고점·거래량·종가 위치의 동시 확인 없이는 천장으로 확정하지 않습니다.'
      : support200 === 'near'
        ? '200일선 부근의 구조 위치입니다. 실제 지지·반등·실패 리테스트는 일봉 이력과 거래량이 있어야 판정합니다.'
        : '현재 제공된 팩터만으로 별도 셋업을 확정할 수 없습니다.';

  return Object.freeze({
    modelVersion: SCREENER_SETUP_MODEL_VERSION,
    status: row.observedAt || Object.keys(row).length ? 'partial' : 'unavailable',
    allowedUse: 'research-relative-ranking-only',
    support200,
    relativeStrengthPullback: !relativeStrengthEvidenceAvailable ? 'unavailable'
      : relativeStrengthPullback ? 'candidate' : 'not-confirmed',
    climaxRisk: climaxRisk ? 'watch' : (pctSma200 == null && rsi == null ? 'unavailable' : 'none'),
    stretch200,
    rsiOverheat,
    volumeEvidence,
    winnerFilter,
    winnerChecks: Object.freeze(winnerChecks),
    winnerMissing: Object.freeze(winnerMissing),
    tags: Object.freeze(tags),
    missingEvidence: Object.freeze(missingEvidence),
    label,
    explanation,
    observedAt: row.observedAt || null
  });
}
