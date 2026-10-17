// Server macro projection (public-data/data.json `macro`, `marketSurveys`, `officialWebReferences`). Legacy unification
// (2026-10-17): moved from js/aio-data.js _aioLoadServerData. It writes the macro fields onto the snapshot, the per-key
// evidence and the server metadata it is handed; the legacy loader keeps the window globals, the sentiment ingest and
// the Treasury projection.

// v51.97/Phase 2 [B2]: housingStarts/retailSales/usWageGrowth come from server FRED. consConf (Conference Board) stays
// out: FRED has no such series, and UMCSENT (Michigan) is a different indicator (P593).
export const SERVER_MACRO_KEYS = Object.freeze(['cpi', 'coreCpi', 'cpiSa', 'coreCpiSa', 'pce', 'corePce', 'fedRate', 'fedTargetLower', 'fedTargetUpper', 'unemployment', 'nfp', 'housingStarts', 'retailSales', 'usWageGrowth', 'dgs2', 'dgs5', 'dgs10', 'dgs20', 'dgs30', 't10y2y', 'realYield10', 'breakeven10']);

// BLS headline/core CPI fields are canonical only when the typed series explicitly says NSA. The SA companions stay
// namespaced for analysis and never overwrite the market-standard slots.
const BLS_CPI_PROMOTIONS = [
  { metricId: 'cpi', valueKey: 'blsCpiYoY', snapshotKey: 'cpi', saMetricId: 'cpiSa', saValueKey: 'blsCpiSaYoY', saSnapshotKey: 'cpiSa' },
  { metricId: 'coreCpi', valueKey: 'blsCoreCpiYoY', snapshotKey: 'coreCpi', saMetricId: 'coreCpiSa', saValueKey: 'blsCoreCpiSaYoY', saSnapshotKey: 'coreCpiSa' }
];

const finite = (value) => typeof value === 'number' && Number.isFinite(value);

function projectKey(k, { macro, meta, snapshot, evidence }) {
  const blsCanonicalCpi = macro._bls?.series?.[k];
  const cpiDefinitionBlocked = (k === 'cpi' || k === 'coreCpi') && blsCanonicalCpi && String(blsCanonicalCpi.seasonalAdjustment || '').toUpperCase() !== 'NSA';
  let source = null;
  if (!cpiDefinitionBlocked && finite(macro[k])) {
    snapshot[k] = macro[k];
    // Codex review 2026-10-05: no FRED change beside a newer Treasury level.
    const deltaAligned = macro[`_source_${k}`] !== 'us-treasury-official-primary' || (macro[`_deltaAsOf_${k}`] && macro[`_deltaAsOf_${k}`] === macro[`_asOf_${k}`]);
    if (deltaAligned && finite(macro[`${k}Delta5`])) snapshot[`_${k}Delta5`] = macro[`${k}Delta5`]; else delete snapshot[`_${k}Delta5`]; // P1390: one-week change for the briefing read
    // P1142: the declared snapshot field is `usUnemploy`; the server key is `unemployment`.
    if (k === 'unemployment') snapshot.usUnemploy = macro[k];
    source = macro[`_source_${k}`]
      || ((k === 'pce' || k === 'corePce') && macro._bea?.status === 'ok' ? 'bea-official-primary' : null)
      || (meta.fredFetchOk ? 'fred-official-primary' : 'last-known-good');
    snapshot[`_${k}_src`] = source;
    evidence[k] = {
      observedAt: macro[`_asOf_${k}`] || null,
      fetchedAt: source === 'bea-official-primary' ? macro._bea?.lastSuccessfulAt || null : meta.fredFetchOk ? meta.fredLastSuccessfulAt || meta.generatedAt || null : null,
      releasedAt: source === 'bea-official-primary' && macro._bea ? macro._bea.releasedAt || null : null,
      source,
      allowedUse: source === 'last-known-good' ? 'reference-only' : 'macro-evidence-with-observation-date'
    };
    if (snapshot._fieldTs && macro[`_asOf_${k}`]) snapshot._fieldTs[`macro_${k}`] = macro[`_asOf_${k}`];
  }
  // v51.67: FRED month-over-month delta.
  if (finite(macro[`${k}Delta`])) snapshot[`_${k}Delta`] = macro[`${k}Delta`];
  return source;
}

// AR-07 Batch 2: the durable FRED HY OAS value is the primary success path; it is never derived from HYG's price.
function projectHighYield({ macro, meta, snapshot, evidence, serverMeta }) {
  if (!finite(macro.hyOAS)) return null;
  const valueBp = Math.round(macro.hyOAS * 100);
  if (finite(macro.hyOASDelta5)) snapshot._hySpreadDelta5Bp = Math.round(macro.hyOASDelta5 * 100); // P1390
  const source = macro._source_hyOAS || 'last-known-good';
  const official = source === 'fred-official-public-csv' || source === 'fred-official-primary';
  const hy = {
    value: macro.hyOAS,
    valueBp,
    observedAt: macro._asOf_hyOAS || null,
    fetchedAt: official ? meta.generatedAt || null : null,
    source,
    sourceKind: official ? 'T1_OFFICIAL' : 'T3_PUBLIC_DELAYED',
    allowedUse: official ? 'reference-until-freshness-gate' : 'reference'
  };
  Object.assign(snapshot, { hyOAS: macro.hyOAS, hySpread: valueBp, _hySpreadSource: source });
  if (snapshot._fieldTs && macro._asOf_hyOAS) snapshot._fieldTs.hySpread = macro._asOf_hyOAS;
  evidence.hyOAS = hy;
  if (serverMeta) serverMeta.hyOAS = hy;
  return { evidence: hy, official };
}

// BLS stays a separate official evidence family: namespaced snapshot fields, never a silent replacement of the FRED
// values; the typed series keeps observation/release/fetch semantics.
function projectBls(bls, { snapshot, evidence }) {
  if (bls?.values) {
    for (const [k, value] of Object.entries(bls.values)) {
      if (!finite(value)) continue;
      snapshot[k] = value;
      snapshot[`_${k}_src`] = 'bls-official-primary';
    }
    if (snapshot._fieldTs && (bls.lastSuccessfulAt || bls.fetchedAt)) snapshot._fieldTs.macro_bls = bls.lastSuccessfulAt || bls.fetchedAt;
  }
  for (const definition of BLS_CPI_PROMOTIONS) {
    const standard = bls?.series?.[definition.metricId];
    const standardValue = bls?.values ? Number(bls.values[definition.valueKey]) : NaN;
    if (standard && standard.status === 'ok' && String(standard.seasonalAdjustment || '').toUpperCase() === 'NSA' && Number.isFinite(standardValue)) {
      snapshot[definition.snapshotKey] = standardValue;
      snapshot[`_${definition.snapshotKey}_src`] = standard.source || 'bls-official-primary';
      snapshot[`_${definition.snapshotKey}_definition`] = standard.definition || 'BLS CPI-U NSA';
      if (snapshot._fieldTs && standard.observedAt) snapshot._fieldTs[`macro_${definition.snapshotKey}`] = standard.observedAt;
      evidence[definition.snapshotKey] = {
        ...(evidence[definition.snapshotKey] || {}),
        value: standardValue,
        observedAt: standard.observedAt || null,
        source: standard.source || 'BLS Public Data API v1',
        sourceKind: standard.sourceKind || 'T1_OFFICIAL',
        seasonalAdjustment: 'NSA',
        definition: standard.definition || null,
        allowedUse: standard.allowedUse || 'macro-evidence-with-observation-date'
      };
    }
    const sa = bls?.series?.[definition.saMetricId];
    const saValue = bls?.values ? Number(bls.values[definition.saValueKey]) : NaN;
    if (sa && sa.status === 'ok' && String(sa.seasonalAdjustment || '').toUpperCase() === 'SA' && Number.isFinite(saValue)) {
      snapshot[definition.saSnapshotKey] = saValue;
      snapshot[`_${definition.saSnapshotKey}_src`] = sa.source || 'bls-official-primary';
      snapshot[`_${definition.saSnapshotKey}_definition`] = sa.definition || 'BLS CPI-U SA analytical companion';
      if (snapshot._fieldTs && sa.observedAt) snapshot._fieldTs[`macro_${definition.saSnapshotKey}`] = sa.observedAt;
    }
  }
}

function blsMeta(bls) {
  return bls ? {
    status: bls.status || 'unavailable',
    sourceKind: bls.sourceKind || 'T1_OFFICIAL',
    attemptedAt: bls.attemptedAt || null,
    fetchedAt: bls.fetchedAt || null,
    lastSuccessfulAt: bls.lastSuccessfulAt || null,
    releaseAt: bls.releaseAt || null,
    failures: Array.isArray(bls.failures) ? bls.failures.slice() : [],
    series: bls.series || {}
  } : null;
}

function beaMeta(bea) {
  return bea ? {
    status: bea.status || 'unavailable',
    sourceKind: bea.sourceKind || 'T1_OFFICIAL',
    attemptedAt: bea.attemptedAt || null,
    fetchedAt: bea.fetchedAt || null,
    lastSuccessfulAt: bea.lastSuccessfulAt || null,
    releasedAt: bea.releasedAt || null,
    nextReleaseAt: bea.nextReleaseAt || null,
    observedAt: bea.observedAt || null,
    releaseUrl: bea.releaseUrl || null,
    values: bea.values || {}
  } : null;
}

// Projects the server macro block. `snapshot` is DATA_SNAPSHOT, `evidence` the persistent per-key macro evidence,
// `serverMeta` the current _serverDataMeta. Returns the counts and the values the legacy loader still copies to globals.
export function applyServerMacro({ data, snapshot, evidence, serverMeta = null }) {
  const macro = data?.macro;
  const result = { applied: 0, fredApplied: 0, beaApplied: 0, highYield: null, aaiiBearish: null };
  if (!macro || !snapshot) return result;
  const meta = data.meta || {};
  const context = { macro, meta, snapshot, evidence, serverMeta };
  for (const k of SERVER_MACRO_KEYS) {
    const source = projectKey(k, context);
    if (!source) continue;
    if (source === 'fred-official-primary') result.fredApplied++;
    if (source === 'bea-official-primary') result.beaApplied++;
    result.applied++;
  }
  result.highYield = projectHighYield(context);
  if (result.highYield) result.applied++;
  const bls = macro._bls || null;
  const bea = macro._bea || null;
  if (serverMeta) {
    serverMeta.bls = blsMeta(bls);
    serverMeta.bea = beaMeta(bea);
  }
  projectBls(bls, context);
  if (bea && bea.status === 'ok' && snapshot._fieldTs && (bea.releasedAt || bea.lastSuccessfulAt)) snapshot._fieldTs.macro_bea = bea.releasedAt || bea.lastSuccessfulAt;
  // Publisher sentiment surveys are an operator-captured WebSearch artifact: dated values for reference UI only, never a
  // live trading input, and no replacement is manufactured when a source is stale.
  const surveys = data.marketSurveys || {};
  const webReferences = data.officialWebReferences || {};
  const aaii = surveys.aaii || null;
  if (aaii && finite(aaii.bearish)) {
    snapshot.aaiiBull = typeof aaii.bullish === 'number' ? aaii.bullish : null;
    snapshot.aaiiNeutral = typeof aaii.neutral === 'number' ? aaii.neutral : null;
    snapshot.aaiiBear = aaii.bearish;
    snapshot._aaiiSource = aaii.sourceUrl || null;
    if (snapshot._fieldTs && aaii.observedAt) snapshot._fieldTs.aaii = aaii.observedAt;
    result.aaiiBearish = aaii.bearish;
  }
  // P1737 (2026-10-13): NAAIM is retired (undated three-month-delayed number); DATA_SNAPSHOT.naaimExposure stays null.
  if (serverMeta) {
    serverMeta.marketSurveys = { status: surveys.policy || 'unavailable', checkedAt: surveys.checkedAt || null, aaii, investorsIntelligence: surveys.investorsIntelligence || null };
    serverMeta.officialWebReferences = webReferences;
  }
  if (webReferences.krExports) {
    snapshot.krExportReference = webReferences.krExports;
    if (snapshot._fieldTs && webReferences.krExports.observedAt) snapshot._fieldTs.krExportReference = webReferences.krExports.observedAt;
  }
  return result;
}
