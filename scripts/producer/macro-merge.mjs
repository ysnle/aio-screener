// Macro merge (split out of fetch-data.mjs main, pipeline redesign 2026-10-19): one place decides which source wins
// each canonical macro field. FRED (with per-field last-known-good) is the base; the official publishers then replace
// a field only with an observation at least as new as the one already there. Every promoted field records
// _asOf_<field> and _source_<field>, so a reader can tell where a number came from.
import { FRED_SERIES, mergeMacroLastKnownGood, officialTreasuryDeltas } from '../lib/macro-sources.mjs';
import { planeFresh } from './source-planes.mjs';

// v58.65 (live 2026-10-21 14:52Z–10-22 04:53Z): when FRED answered HTML, last-known-good marked every field
// `stale-reference`; BLS/BEA/Treasury then replaced the values and the source but left that marker, so the artifact
// semantics gate refused the refresh and no quote, close or reading was published for 14 hours. A promoted official
// observation is a fresh observation: value, date, source and freshness move together.
function promote(macro, field, value, observedAt, source) {
  macro[field] = value;
  macro[`_asOf_${field}`] = observedAt;
  macro[`_source_${field}`] = source;
  macro[`_freshness_${field}`] = 'observed';
  delete macro[`_originSource_${field}`];
}

const monthKey = (date) => String(date || '').slice(0, 7);
const nextMonthKey = (date) => {
  const [y, m] = monthKey(date).split('-').map(Number);
  return Number.isFinite(y) && Number.isFinite(m) ? `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}` : '';
};
// v58.77 (pipeline audit DATA-01): BLS/BEA can publish a month before FRED. The change beside the FRED value belongs to
// FRED's month, so a newer official month recomputes it from the value it replaces when that is the month just
// before, and otherwise drops it, instead of publishing last month's change beside the new print (the reading would
// call inflation rising or easing on it).
function promoteMonthly(macro, field, value, observedAt, source) {
  const priorAt = macro[`_asOf_${field}`];
  const prior = Number(macro[field]);
  if (priorAt && observedAt && monthKey(priorAt) !== monthKey(observedAt)) {
    if (nextMonthKey(priorAt) === monthKey(observedAt) && Number.isFinite(prior)) macro[`${field}Delta`] = Math.round((value - prior) * 10) / 10;
    else delete macro[`${field}Delta`];
  }
  promote(macro, field, value, observedAt, source);
}

export function mergeMacroPlanes({ macroRaw, previousMacro, bls, bea, treasury, fredHyOas }) {
  const macro = mergeMacroLastKnownGood(macroRaw, previousMacro);
  for (const field of Object.keys(FRED_SERIES)) {
    // DATA-02: a newer earlier-run observation the merge kept is not this run's FRED value.
    if (Number.isFinite(Number(macroRaw?.[field])) && String(macro[`_asOf_${field}`] || '') === String(macroRaw[`_asOf_${field}`] || '')) macro[`_source_${field}`] = 'fred-official-primary';
  }
  Object.assign(macro, bls.values || {});
  // Promote only the successful BLS headline/core fields to the canonical
  // `macro.cpi`/`macro.coreCpi` slots.  Those slots are consumed by the
  // market-standard CPI cards and therefore must be CPI-U NSA, while the
  // explicitly named `blsCpiSaYoY`/`blsCoreCpiSaYoY` values remain available
  // for SA analysis.  A stale BLS last-known-good payload is retained under
  // `_bls` but never silently promoted over the current FRED/previous value.
  const blsFieldPromotions = [
    ['cpi', 'blsCpiYoY'],
    ['coreCpi', 'blsCoreCpiYoY']
  ];
  if (planeFresh('bls', bls)) {
    for (const [macroField, blsField] of blsFieldPromotions) {
      const metricId = macroField;
      const seriesEvidence = bls.series?.[metricId];
      const value = Number(bls.values?.[blsField]);
      if (seriesEvidence?.status !== 'ok' || !Number.isFinite(value)) continue;
      // 2026-10-19 data audit: as for HY OAS below, an older BLS month never replaces a newer FRED month (release-day lag).
      if (macro[`_asOf_${macroField}`] && String(seriesEvidence.observedAt || '') < String(macro[`_asOf_${macroField}`])) continue;
      promoteMonthly(macro, macroField, value, seriesEvidence.observedAt || null, 'bls-official-primary');
    }
  }
  macro._bls = bls;
  macro._bea = bea;
  macro._treasury = treasury;
  macro._fredHyOas = fredHyOas;
  if (planeFresh('fredHyOas', fredHyOas) && Number.isFinite(Number(fredHyOas.value))) {
    const currentObservedAt = String(macro._asOf_hyOAS || '');
    if (!currentObservedAt || String(fredHyOas.observedAt || '') >= currentObservedAt) {
      promote(macro, 'hyOAS', Number(fredHyOas.value), fredHyOas.observedAt, 'fred-official-public-csv');
      // v58.71: a newer CSV date brings its own deltas; the API deltas belong to the older date and go.
      if (currentObservedAt !== String(fredHyOas.observedAt || '')) {
        for (const [suffix, value] of [['Delta', fredHyOas.delta], ['Delta5', fredHyOas.delta5]]) {
          if (value != null && Number.isFinite(Number(value))) macro[`hyOAS${suffix}`] = Number(value);
          else delete macro[`hyOAS${suffix}`];
        }
      }
    }
  }
  if (planeFresh('treasury', treasury) && treasury.values) {
    for (const field of ['dgs2', 'dgs5', 'dgs10', 'dgs20', 'dgs30', 't10y2y']) {
      if (!Number.isFinite(Number(treasury.values[field]))) continue;
      const fredAsOf = String(macro[`_asOf_${field}`] || '');
      // v58.71 (pipeline audit): like BLS and HY OAS above, an older official date never replaces a newer FRED one.
      if (fredAsOf && String(treasury.observedAt || '') < fredAsOf) continue;
      promote(macro, field, Number(treasury.values[field]), treasury.observedAt, 'us-treasury-official-primary');
      if (field === 't10y2y') continue;
      const official = officialTreasuryDeltas(treasury, field);
      const fredSameDate = fredAsOf === String(treasury.observedAt || '');
      for (const [suffix, value] of [['Delta', official.delta], ['Delta5', official.delta5]]) {
        if (value != null) macro[`${field}${suffix}`] = value;
        else if (!fredSameDate) delete macro[`${field}${suffix}`];
      }
      macro[`_deltaAsOf_${field}`] = official.delta != null || fredSameDate ? treasury.observedAt : null;
    }
  }
  // BEA promotes only a collection of this run (not 'cached-fresh'), as before the split.
  // v58.71: and only when its month is not older than the FRED month (the release page can still link the last month).
  const beaNotOlder = (field) => !macro[`_asOf_${field}`] || String(bea.observedAt || '') >= String(macro[`_asOf_${field}`]);
  if (bea.status === 'ok' && bea.values) {
    if (Number.isFinite(bea.values.pce) && beaNotOlder('pce')) {
      promoteMonthly(macro, 'pce', bea.values.pce, bea.observedAt, 'bea-official-primary');
    }
    if (Number.isFinite(bea.values.corePce) && beaNotOlder('corePce')) {
      promoteMonthly(macro, 'corePce', bea.values.corePce, bea.observedAt, 'bea-official-primary');
    }
  }
  return macro;
}

// Market surveys (AAII from its official table; subscriber-only surveys stay preserved/blocked, nothing synthesized).
// `checkedAt` means the live automated check; the carried editorial snapshot time keeps its own name (P1107).
// P1737 (2026-10-13): NAAIM is retired (undated three-month-delayed page number, not verifiable), so the carried
// snapshot no longer brings it forward; AAII and the Investors Intelligence boundary are unchanged.
export function buildMarketSurveys(previousMarketSurveys, aaii) {
  const surveyAttemptedAt = aaii.attemptedAt || new Date().toISOString();
  const { naaim: _retiredNaaim, ...carriedSurveys } = previousMarketSurveys || {};
  return {
    ...carriedSurveys,
    schemaVersion: 'web-research-surveys.v2',
    checkedAt: surveyAttemptedAt,
    automatedCheckedAt: surveyAttemptedAt,
    webResearchCheckedAt: previousMarketSurveys?.webResearchCheckedAt || previousMarketSurveys?.checkedAt || null,
    policy: previousMarketSurveys?.policy || 'official-publisher-public-web; bounded relay fallback; reference-only; no synthesis',
    aaii
  };
}
