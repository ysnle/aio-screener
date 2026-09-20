// RM-03 continued (2026-07-21, P757): extracted from js/aio-core.js's AIO.getUsTreasuryCurveEvidence
// (~20746-20776). Pure function: no global/DOM access — every value the legacy function read
// directly off its own module-scope globals (live quote cache, FRED cache, raw maturity
// variables, the server data snapshot) is now an explicit parameter. The multi-source fallback
// priority PER FIELD is transcribed unchanged,
// including two easy-to-miss legacy quirks a plain golden-fixture dump caught (do not "clean
// these up" — see architecture/fixtures/macro-curve-golden.json for the exact cases):
//   1. `twoY` has only two fallback sources (a raw live 2Y variable, then FRED DGS2) — unlike
//      threeM/fiveY/tenY/thirtyY it has NO server-snapshot fallback at all.
//   2. `source`/`available` do NOT recognize every pathway that can still fill `tenY`/`thirtyY` —
//      specifically, resolving tenY via a live10Y raw variable (rather than a live ^TNX quote or
//      FRED DGS10) does not make `source` anything other than 'partial', even though tenY/twoY may
//      both be genuinely non-null and spread2s10s computes a real number. Replicated as-is.
export const TREASURY_CURVE_MODEL_VERSION = 'treasury-curve.v1';
export const TREASURY_CURVE_SPREAD_VERSION = 'treasury-curve-spread.v1';
// Two legs observed more than 36h apart are different market observations, not one curve.
const DEFAULT_MAX_LEG_GAP_MS = 36 * 60 * 60 * 1000;

function finiteOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseObservedMs(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * W08-B/P1147 (H02): a 2s10s curve has two legs, and a spread is only meaningful when the legs
 * share an observation date. Each leg keeps its own instrument, tenor, unit, observation time,
 * session and provider; the result states which kind of spread it is — the official same-date
 * FRED spread, an aligned same-date calculation, or a mixed-date reference calculation that must
 * not be presented as a live curve.
 */
export function buildTreasuryCurveSpread({ twoY = null, tenY = null, officialSpread = null, legs = {}, maxLegGapMs = DEFAULT_MAX_LEG_GAP_MS } = {}) {
  const legOf = (value, tenor, meta) => Object.freeze({
    instrumentId: meta?.instrumentId || null,
    tenor,
    unit: 'percent',
    value: finiteOrNull(value),
    observedAt: meta?.observedAt || null,
    session: meta?.session || null,
    provider: meta?.provider || null
  });
  const twoLeg = legOf(twoY, '2Y', legs.twoY);
  const tenLeg = legOf(tenY, '10Y', legs.tenY);
  const official = finiteOrNull(officialSpread);
  if (official != null) {
    return Object.freeze({ modelVersion: TREASURY_CURVE_SPREAD_VERSION, mode: 'official-same-date', spread: official, legs: Object.freeze([twoLeg, tenLeg]), legGapMs: null, mixedDates: false, label: '2s10s · FRED 동일자 스프레드' });
  }
  if (twoLeg.value == null || tenLeg.value == null) {
    return Object.freeze({ modelVersion: TREASURY_CURVE_SPREAD_VERSION, mode: 'unavailable', spread: null, legs: Object.freeze([twoLeg, tenLeg]), legGapMs: null, mixedDates: false, label: '2s10s · 판정 보류 (한쪽 만기 미수신)' });
  }
  const twoMs = parseObservedMs(twoLeg.observedAt);
  const tenMs = parseObservedMs(tenLeg.observedAt);
  const legGapMs = twoMs != null && tenMs != null ? Math.abs(tenMs - twoMs) : null;
  const aligned = legGapMs != null && legGapMs <= maxLegGapMs;
  const label = aligned
    ? '2s10s · 동일 관측일 계산'
    : legGapMs == null
      ? '2s10s · 혼합 시점 참고 계산 (leg 관측시각 미확인) — 실시간 곡선 아님'
      : `2s10s · 혼합 시점 참고 계산 (leg 시차 ${Math.round(legGapMs / 3600000)}h) — 실시간 곡선 아님`;
  return Object.freeze({
    modelVersion: TREASURY_CURVE_SPREAD_VERSION,
    mode: aligned ? 'aligned-legs' : 'mixed-date-reference',
    spread: Number((tenLeg.value - twoLeg.value).toFixed(2)),
    legs: Object.freeze([twoLeg, tenLeg]),
    legGapMs,
    mixedDates: !aligned,
    label
  });
}

function clampYield(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > -5 && n < 25 ? n : null;
}

function firstNonNull(values) {
  for (const value of values) if (value != null) return value;
  return null;
}

/**
 * @param {object} input
 * @param {object} input.live      { irx, twoY, fvx, tnx, tenYRaw, tyx, thirtyYRaw } — irx/fvx/tnx/tyx
 *   are live quote prices (legacy live-quote-cache['^IRX'|'^FVX'|'^TNX'|'^TYX'].price); twoY is
 *   the raw legacy 2Y variable (not a quote symbol); tenYRaw/thirtyYRaw are the raw legacy 10Y/30Y
 *   variables (secondary fallback, distinct from the tnx/tyx live quotes).
 * @param {object} input.fred      { dgs3mo, dgs2, dgs5, dgs10, dgs30, t10y2y } — legacy FRED cache[id].value
 * @param {object} input.snapshot  { irx, fvx, tnx, tyx, t10y2y } — legacy server-data-snapshot fields
 * @param {string|null} input.asOf
 */
export function deriveTreasuryCurveEvidence({ live = {}, fred = {}, snapshot = {}, asOf = null, inputVersion = 'unknown' } = {}) {
  const liveIrx = clampYield(live.irx);
  const liveTwoY = clampYield(live.twoY);
  const liveFvx = clampYield(live.fvx);
  const liveTnx = clampYield(live.tnx);
  const liveTenYRaw = clampYield(live.tenYRaw);
  const liveTyx = clampYield(live.tyx);
  const liveThirtyYRaw = clampYield(live.thirtyYRaw);
  const fredDgs3mo = clampYield(fred.dgs3mo);
  const fredDgs2 = clampYield(fred.dgs2);
  const fredDgs5 = clampYield(fred.dgs5);
  const fredDgs10 = clampYield(fred.dgs10);
  const fredDgs30 = clampYield(fred.dgs30);
  const fredT10y2y = clampYield(fred.t10y2y);
  const snapIrx = clampYield(snapshot.irx);
  const snapFvx = clampYield(snapshot.fvx);
  const snapTnx = clampYield(snapshot.tnx);
  const snapTyx = clampYield(snapshot.tyx);
  const snapT10y2y = clampYield(snapshot.t10y2y);

  const threeM = firstNonNull([liveIrx, fredDgs3mo, snapIrx]);
  const twoY = firstNonNull([liveTwoY, fredDgs2]);
  const fiveY = firstNonNull([liveFvx, fredDgs5, snapFvx]);
  const tenY = firstNonNull([liveTnx, liveTenYRaw, fredDgs10, snapTnx]);
  const thirtyY = firstNonNull([liveTyx, liveThirtyYRaw, fredDgs30, snapTyx]);

  const liveDerivedSpread = liveTwoY != null && liveTnx != null ? Number((liveTnx - liveTwoY).toFixed(2)) : null;
  const directSpread = firstNonNull([fredT10y2y, liveDerivedSpread, snapT10y2y]);
  const spread2s10s = directSpread != null ? directSpread : (twoY != null && tenY != null ? Number((tenY - twoY).toFixed(2)) : null);

  const source = fredT10y2y != null ? 'FRED T10Y2Y'
    : liveDerivedSpread != null ? 'live maturities'
    : snapT10y2y != null ? 'server snapshot'
    : ((liveTwoY != null || fredDgs2 != null) && (liveTnx != null || fredDgs10 != null)) ? 'live/FRED maturities'
    : 'partial';
  const available = spread2s10s != null && source !== 'partial';
  const complete = [threeM, twoY, fiveY, tenY, thirtyY].every((value) => value != null);

  return Object.freeze({
    modelVersion: TREASURY_CURVE_MODEL_VERSION,
    inputVersion,
    threeM, twoY, fiveY, tenY, thirtyY,
    spread2s10s, available, complete, source, asOf
  });
}
