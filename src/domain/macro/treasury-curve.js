export const TREASURY_CURVE_MODEL_VERSION = 'treasury-curve.v2';
export const TREASURY_CURVE_SPREAD_VERSION = 'treasury-curve-spread.v2';

function finiteOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function observation(value) {
  if (value == null) return null;
  const row = value && typeof value === 'object' ? value : { value };
  const rawNumber = finiteOrNull(row.value ?? row.price);
  const number = clampYield(rawNumber);
  if (number == null) return null;
  return Object.freeze({
    value: number,
    observedAt: row.observedAt || row.date || row.asOf || null,
    cutId: row.cutId || null,
    source: row.source || row._source || row.provider || null,
    sourceKind: row.sourceKind || null,
    session: row.session || row.marketState || null,
    provider: row.provider || null
  });
}

function firstObservation(values) {
  for (const value of values) {
    const row = observation(value);
    if (row) return row;
  }
  return null;
}

function curveCutId(treasury) {
  if (!treasury || typeof treasury !== 'object') return null;
  return treasury.cutId || (treasury.observedAt ? `us-treasury-daily:${treasury.observedAt}` : null);
}

export function buildTreasuryCurveSpread({ twoY = null, tenY = null, officialSpread = null, officialSpreadMeta = {}, legs = {} } = {}) {
  const legOf = (value, tenor, meta) => Object.freeze({
    instrumentId: meta?.instrumentId || null,
    tenor,
    unit: 'percent',
    value: finiteOrNull(value),
    observedAt: meta?.observedAt || meta?.date || null,
    cutId: meta?.cutId || null,
    source: meta?.source || meta?.provider || null,
    sourceKind: meta?.sourceKind || null,
    session: meta?.session || null,
    provider: meta?.provider || null
  });
  const twoLeg = legOf(twoY, '2Y', legs.twoY);
  const tenLeg = legOf(tenY, '10Y', legs.tenY);
  const official = finiteOrNull(officialSpread);
  const spreadObservedAt = officialSpreadMeta?.observedAt || officialSpreadMeta?.date || null;
  const spreadCutId = officialSpreadMeta?.cutId || null;
  const legCutIds = [twoLeg.cutId, tenLeg.cutId].filter(Boolean);
  const sameLegCut = legCutIds.length === 2 && new Set(legCutIds).size === 1;
  const explicitConflict = (legCutIds.length === 2 && !sameLegCut)
    || (!!spreadCutId && !!twoLeg.cutId && spreadCutId !== twoLeg.cutId);
  const sameObservedCut = !explicitConflict
    && twoLeg.observedAt != null
    && tenLeg.observedAt === twoLeg.observedAt
    && (official == null || spreadObservedAt === twoLeg.observedAt);
  const comparable = !explicitConflict && (sameLegCut || sameObservedCut);
  const selectedCutId = explicitConflict ? null : (spreadCutId || twoLeg.cutId || tenLeg.cutId || null);

  if (official != null) {
    const mode = comparable ? 'official-same-date' : explicitConflict ? 'mixed-cut-reference' : 'official-unverified-cut';
    return Object.freeze({
      modelVersion: TREASURY_CURVE_SPREAD_VERSION,
      mode,
      spread: comparable ? official : null,
      referenceSpread: official,
      unit: 'percentage-point',
      spreadObservedAt: comparable ? spreadObservedAt : null,
      spreadSource: officialSpreadMeta?.source || officialSpreadMeta?.provider || null,
      spreadCutId,
      legs: Object.freeze([twoLeg, tenLeg]),
      mixedDates: !comparable,
      curveCutId: selectedCutId,
      comparable,
      label: comparable
        ? `2s10s · ${officialSpreadMeta?.source || '공식'} 동일자 스프레드`
        : explicitConflict ? '2s10s · 공식 스프레드와 2Y·10Y cut 불일치 — 비교 판정 보류' : '2s10s · 공식 스프레드 cut 미확인 — 비교 판정 보류'
    });
  }

  if (twoLeg.value == null || tenLeg.value == null) {
    return Object.freeze({
      modelVersion: TREASURY_CURVE_SPREAD_VERSION,
      mode: 'unavailable',
      spread: null,
      referenceSpread: null,
      unit: 'percentage-point',
      spreadObservedAt: null,
      spreadSource: null,
      spreadCutId: null,
      legs: Object.freeze([twoLeg, tenLeg]),
      mixedDates: false,
      curveCutId: selectedCutId,
      comparable: false,
      label: '2s10s · 판정 보류 (한쪽 만기 미수신)'
    });
  }

  return Object.freeze({
    modelVersion: TREASURY_CURVE_SPREAD_VERSION,
    mode: comparable ? 'aligned-legs' : 'mixed-cut-reference',
    spread: comparable ? Number((tenLeg.value - twoLeg.value).toFixed(2)) : null,
    referenceSpread: null,
    unit: 'percentage-point',
    spreadObservedAt: comparable ? twoLeg.observedAt : null,
    spreadSource: comparable ? (twoLeg.source || tenLeg.source || null) : null,
    spreadCutId: null,
    legs: Object.freeze([twoLeg, tenLeg]),
    mixedDates: !comparable,
    curveCutId: selectedCutId,
    comparable,
    label: comparable
      ? '2s10s · 동일 cut 계산'
      : explicitConflict ? '2s10s · 2Y·10Y cut 불일치 — 비교 판정 보류' : '2s10s · 관측 cut 미확인 또는 비동일 — 비교 판정 보류'
  });
}

function clampYield(value) {
  const number = finiteOrNull(value);
  return number != null && number > -5 && number < 25 ? number : null;
}

export function deriveTreasuryCurveEvidence({ live = {}, fred = {}, snapshot = {}, treasury = null, asOf = null, inputVersion = 'unknown' } = {}) {
  const treasuryValues = treasury && typeof treasury.values === 'object' ? treasury.values : {};
  const cutId = curveCutId(treasury);
  const treasuryMeta = {
    observedAt: treasury?.observedAt || null,
    cutId,
    source: treasury?.source || null,
    sourceKind: treasury?.sourceKind || null,
    session: 'official-daily-close',
    provider: treasury?.source || null
  };
  const atomicTwo = treasuryValues.dgs2 == null ? null : { value: treasuryValues.dgs2, ...treasuryMeta };
  const atomicTen = treasuryValues.dgs10 == null ? null : { value: treasuryValues.dgs10, ...treasuryMeta };
  const atomicSpread = treasuryValues.t10y2y == null ? null : { value: treasuryValues.t10y2y, ...treasuryMeta };
  const atomicPoints = [
    ['2Y', treasuryValues.dgs2],
    ['5Y', treasuryValues.dgs5],
    ['10Y', treasuryValues.dgs10],
    ['20Y', treasuryValues.dgs20],
    ['30Y', treasuryValues.dgs30]
  ].filter(([, value]) => Number.isFinite(Number(value))).map(([tenor, value]) => Object.freeze({
    tenor,
    value: Number(value),
    unit: 'percent',
    observedAt: treasuryMeta.observedAt,
    cutId,
    source: treasuryMeta.source,
    sourceKind: treasuryMeta.sourceKind,
    session: treasuryMeta.session
  }));

  const threeMObservation = firstObservation([live.irx, fred.dgs3mo, snapshot.irx]);
  const twoYearObservation = firstObservation([atomicTwo, live.twoY, fred.dgs2]);
  const fiveYearObservation = firstObservation([live.fvx, fred.dgs5, snapshot.fvx]);
  const tenYearObservation = firstObservation([atomicTen, live.tnx, live.tenYRaw, fred.dgs10, snapshot.tnx]);
  const thirtyYearObservation = firstObservation([live.tyx, live.thirtyYRaw, fred.dgs30, snapshot.tyx]);

  const fredSpreadObservation = observation(fred.t10y2y);
  const directSpread = atomicSpread || (fredSpreadObservation && !String(fredSpreadObservation.source || '').startsWith('yahoo-calc') ? fredSpreadObservation : null);
  const curve = buildTreasuryCurveSpread({
    twoY: twoYearObservation?.value ?? null,
    tenY: tenYearObservation?.value ?? null,
    officialSpread: directSpread?.value ?? null,
    officialSpreadMeta: directSpread || {},
    legs: {
      twoY: { instrumentId: 'DGS2', ...(twoYearObservation || {}) },
      tenY: { instrumentId: 'DGS10', ...(tenYearObservation || {}) }
    }
  });

  const complete = [threeMObservation, twoYearObservation, fiveYearObservation, tenYearObservation, thirtyYearObservation]
    .every((row) => row?.value != null);
  const curveWithPoints = Object.freeze({ ...curve, points: Object.freeze(atomicPoints) });
  const source = curveWithPoints.spreadSource || twoYearObservation?.source || 'partial';

  return Object.freeze({
    modelVersion: TREASURY_CURVE_MODEL_VERSION,
    inputVersion,
    threeM: threeMObservation?.value ?? null,
    twoY: twoYearObservation?.value ?? null,
    fiveY: fiveYearObservation?.value ?? null,
    tenY: tenYearObservation?.value ?? null,
    thirtyY: thirtyYearObservation?.value ?? null,
    values: Object.freeze({ y3: threeMObservation?.value ?? null, y2: twoYearObservation?.value ?? null, y5: fiveYearObservation?.value ?? null, y10: tenYearObservation?.value ?? null, y30: thirtyYearObservation?.value ?? null }),
    spread2s10s: curveWithPoints.spread,
    available: curveWithPoints.spread != null,
    complete,
    source,
    asOf: curveWithPoints.spreadObservedAt || treasury?.observedAt || asOf,
    curve: curveWithPoints
  });
}
