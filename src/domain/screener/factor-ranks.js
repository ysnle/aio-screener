// RM-03 continued (2026-07-21, P759, Fable-advisor design review): extracted from
// js/aio-data.js's _aioComputeFactorRanks (~15947-16081). Pure function: takes plain row data and
// resolved weights/regime as explicit parameters instead of reading SCREENER_DB/window globals,
// and returns a NEW array of per-row results keyed by `sym` (NOT `.symbol` — verified against every
// legacy read site; `sym` is the real, deduped-by-convention field) instead of mutating its input.
//
// Deliberately does NOT extract `_aioFactorWeights` (js/aio-data.js:15871) this round — it has a
// single call site (this function), reads two more hidden globals of its own
// (the browser profile store + AIO_TRADER_PROFILES) beyond its `marketState` param, and
// extracting it unlocks no reuse. The wrapper calls legacy `_aioFactorWeights(marketState)` and
// passes the RESOLVED weights/regimeLabel in here instead (same boundary trading-score drew around
// its own dependencies).
//
// Legacy subtleties preserved as-is (do not "clean up" — see architecture/fixtures/
// factor-ranks-golden.json for the exact cases a plain dump caught):
//   1. `factorScores`/`_z_*` are SPARSE per inactive factor (the key is simply absent for every
//      row, not null/0) — this function only ever writes keys for factors in the active FACTORS
//      list, exactly like legacy.
//   2. wsum normalizes only over the ACTIVE factors' weight sum, never all 7.
//   3. A row's raw factor value can be NaN (typeof NaN === 'number' is true, so the `typeof`
//      guards inside each raw-factor function do not exclude it) — legacy relies on TWO separate
//      isFinite filters: once when collecting stats input (a NaN row's raw value is excluded from
//      the mean/stddev the whole sector uses), and again inside winz() (that same row still gets
//      z=0, not NaN, for its own score) — dropping either filter changes results for NaN inputs.
//   4. Sector grouping defaults to the literal string '_' for rows with no sector, so sectorless
//      rows get scored relative to each other once there are enough of them.
//   5. The final sort is `(a,b) => a._compositeZ - b._compositeZ` with NO secondary tiebreaker —
//      ties keep the input array's order (stable sort). Adding one (e.g. by sym) would silently
//      change .rank for tied rows relative to legacy.
export const FACTOR_RANKS_MODEL_VERSION = 'factor-ranks.v1';

const DEFAULT_WEIGHTS = { momentum: 0.32, trend: 0.23, lowvol: 0.18, size: 0.18, value: 0, quality: 0, kalman: 0.09 };

function avg(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function momRaw(row) {
  const parts = [];
  if (typeof row.ret1m === 'number') parts.push({ v: row.ret1m, w: 0.4 });
  if (typeof row.ret3m === 'number') parts.push({ v: row.ret3m, w: 0.4 });
  if (typeof row.ret6m === 'number') parts.push({ v: row.ret6m, w: 0.2 });
  const denom = parts.reduce((sum, p) => sum + p.w, 0);
  return denom > 0 ? parts.reduce((sum, p) => sum + p.v * p.w, 0) / denom : null;
}

function trendRaw(row) {
  const parts = [];
  if (typeof row.pctSma50 === 'number') parts.push({ v: row.pctSma50, w: 0.6 });
  if (typeof row.pctSma200 === 'number') parts.push({ v: row.pctSma200, w: 0.4 });
  const denom = parts.reduce((sum, p) => sum + p.w, 0);
  return denom > 0 ? parts.reduce((sum, p) => sum + p.v * p.w, 0) / denom : null;
}

function lowvolRaw(row) { return typeof row.vol === 'number' ? -row.vol : null; }
function sizeRaw(row) { return (typeof row.mcap === 'number' && row.mcap > 0) ? -Math.log(row.mcap) : null; }

function valueRaw(row) {
  const parts = [];
  const clampV = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  if (typeof row.pe === 'number' && row.pe > 0 && row.pe < 200) parts.push(clampV(1 / row.pe, 0, 0.20) / 0.20);
  if (typeof row.pb === 'number' && row.pb > 0 && row.pb < 50) parts.push(clampV(1 / row.pb, 0, 2.0) / 2.0);
  if (typeof row.evEbitda === 'number' && row.evEbitda > 0 && row.evEbitda < 100) parts.push(clampV(1 / row.evEbitda, 0, 0.20) / 0.20);
  return parts.length ? avg(parts) : null;
}

function qualityRaw(row) {
  const parts = [];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  if (typeof row.roe === 'number') parts.push(clamp(row.roe, -30, 60) / 60);
  if (typeof row.margin === 'number') parts.push(clamp(row.margin, -20, 40) / 40);
  if (typeof row.revGrowth === 'number') parts.push(clamp(row.revGrowth, -30, 60) / 60);
  return parts.length ? avg(parts) : null;
}

function kalmanRaw(row) { return typeof row.kalmanVelConf === 'number' ? row.kalmanVelConf : (typeof row.kalmanVel === 'number' ? row.kalmanVel : null); }

function stats(values) {
  if (!values.length) return { mu: 0, sd: 1 };
  const mu = avg(values);
  const sd = values.length > 1 ? Math.sqrt(values.reduce((sum, v) => sum + (v - mu) * (v - mu), 0) / (values.length - 1)) : 1;
  return { mu, sd: sd > 0 ? sd : 1 };
}

function winz(x, mu, sd) {
  if (typeof x !== 'number' || !isFinite(x)) return 0;
  const z = (x - mu) / sd;
  return Math.max(-3, Math.min(3, z));
}

function z2pct(z) { return Math.max(0, Math.min(100, Math.round(50 + z * 16.67))); }

/**
 * @param {object} input
 * @param {Array<object>} input.rows  SCREENER_DB-shaped rows (sym, sector, ret1m/ret3m/ret6m,
 *   pctSma50/pctSma200, vol, mcap, _mcapObservedAt, pe/pb/evEbitda, roe/margin/revGrowth,
 *   kalmanVelConf/kalmanVel) — read only, never mutated.
 * @param {object|null} input.weights       resolved regime-adaptive weights (caller already
 *   called legacy _aioFactorWeights(marketState) and is passing its .weights through)
 * @param {string|null} input.regimeLabel   resolved regime label from the same call
 * @param {number} input.fundamentalCoveragePct
 * @param {boolean} input.fmpOk
 * @param {number} input.now  Date.now()-equivalent, explicit for testability
 */
export function computeFactorRanks({ rows = [], weights = null, regimeLabel = null, fundamentalCoveragePct = 0, fmpOk = false, now = Date.now(), inputVersion = 'unknown' } = {}) {
  const items = (Array.isArray(rows) ? rows : []).filter((row) => row && (typeof row.ret3m === 'number' || typeof row.ret1m === 'number'));
  if (items.length < 5) {
    return Object.freeze({ modelVersion: FACTOR_RANKS_MODEL_VERSION, inputVersion, available: false, ranked: 0, activeFactors: Object.freeze([]), activeFactorRegime: regimeLabel || null, activeFactorWeights: Object.freeze(weights || DEFAULT_WEIGHTS), inactiveFactorReasons: Object.freeze({}), rows: Object.freeze([]) });
  }

  const FACTORS = [
    { key: 'momentum', fn: momRaw },
    { key: 'trend', fn: trendRaw },
    { key: 'lowvol', fn: lowvolRaw }
  ];
  const mcapCurrentCount = items.filter((row) => typeof row.mcap === 'number' && row._mcapObservedAt && (now - new Date(row._mcapObservedAt).getTime()) <= 4 * 86400000).length;
  const sizeActive = mcapCurrentCount >= Math.ceil(items.length * 0.8);
  if (sizeActive) FACTORS.push({ key: 'size', fn: sizeRaw });
  const fundamentalCurrentCount = items.filter((row) => {
    const observedMs = Date.parse(row._fundamentalObservedAt || '');
    const hasInput = valueRaw(row) != null || qualityRaw(row) != null;
    return hasInput && Number.isFinite(observedMs) && now - observedMs <= 180 * 86400000;
  }).length;
  const fundamentalCurrentPct = items.length ? fundamentalCurrentCount / items.length * 100 : 0;
  const fundamentalCurrent = fundamentalCurrentCount >= Math.ceil(items.length * 0.8);
  const valueActive = fundamentalCurrent && items.some((row) => valueRaw(row) != null);
  const qualityActive = fundamentalCurrent && items.some((row) => qualityRaw(row) != null);
  if (valueActive) FACTORS.push({ key: 'value', fn: valueRaw });
  if (qualityActive) FACTORS.push({ key: 'quality', fn: qualityRaw });
  if (items.some((row) => kalmanRaw(row) != null)) FACTORS.push({ key: 'kalman', fn: kalmanRaw });

  const activeWeights = weights || DEFAULT_WEIGHTS;
  const inactiveFactorReasons = Object.freeze({
    size: sizeActive ? null : '시가총액 관측시각·80% 커버리지 미확보',
    value: fundamentalCurrent ? null : `재무 관측시각·180일 신선도 커버리지 80% 미만 (${fundamentalCurrentPct.toFixed(1)}%; 산출물 ${fundamentalCoveragePct.toFixed(1)}%)`,
    quality: fundamentalCurrent ? null : `재무 관측시각·180일 신선도 커버리지 80% 미만 (${fundamentalCurrentPct.toFixed(1)}%; 산출물 ${fundamentalCoveragePct.toFixed(1)}%)`
  });

  // work on shallow copies so the caller's row objects/array are never mutated
  const working = items.map((row) => ({ ...row }));
  const bySector = {};
  working.forEach((row) => { const key = row.sector || '_'; (bySector[key] = bySector[key] || []).push(row); });

  FACTORS.forEach((factor) => {
    const allVals = working.map(factor.fn).filter((v) => typeof v === 'number' && isFinite(v));
    const uni = stats(allVals);
    Object.keys(bySector).forEach((sectorKey) => {
      const group = bySector[sectorKey];
      const vals = group.map(factor.fn).filter((v) => typeof v === 'number' && isFinite(v));
      let st;
      if (vals.length >= 6) {
        st = stats(vals);
      } else if (vals.length >= 2) {
        const sectorSt = stats(vals);
        const blend = vals.length / 6;
        st = { mu: blend * sectorSt.mu + (1 - blend) * uni.mu, sd: blend * sectorSt.sd + (1 - blend) * uni.sd };
      } else {
        st = uni;
      }
      group.forEach((row) => { row['_z_' + factor.key] = winz(factor.fn(row), st.mu, st.sd); });
    });
  });

  let wsum = 0;
  FACTORS.forEach((factor) => { wsum += (activeWeights[factor.key] || 0); });
  if (wsum <= 0) wsum = 1;
  working.forEach((row) => {
    let composite = 0;
    const factorScores = {};
    FACTORS.forEach((factor) => {
      const z = row['_z_' + factor.key] || 0;
      composite += z * (activeWeights[factor.key] || 0);
      factorScores[factor.key] = z2pct(z);
    });
    row._compositeZ = composite / wsum;
    row.factorScores = factorScores;
  });

  const sorted = working.slice().sort((a, b) => a._compositeZ - b._compositeZ);
  const n = sorted.length;
  sorted.forEach((row, index) => {
    row.rank = n > 1 ? Math.round((index / (n - 1)) * 100) : 50;
    row.quantSignal = row.rank >= 80 ? '상위 20%' : row.rank >= 60 ? '상위 40%' : row.rank >= 40 ? '중간 20%' : '하위 40%';
  });

  const resultRows = working.map((row) => {
    const out = { sym: row.sym, _compositeZ: row._compositeZ, factorScores: row.factorScores, rank: row.rank, quantSignal: row.quantSignal };
    FACTORS.forEach((factor) => { out['_z_' + factor.key] = row['_z_' + factor.key]; });
    return Object.freeze(out);
  });

  return Object.freeze({
    modelVersion: FACTOR_RANKS_MODEL_VERSION,
    inputVersion,
    available: true,
    ranked: n,
    activeFactors: Object.freeze(FACTORS.map((factor) => factor.key)),
    activeFactorRegime: regimeLabel || null,
    activeFactorWeights: Object.freeze({ ...activeWeights }),
    inactiveFactorReasons,
    rows: Object.freeze(resultRows)
  });
}
