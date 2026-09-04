// CHART-CORE-01: dependency-free chart boundary extracted from the supplied
// Vela architecture. The app may keep Chart.js as a renderer, but every chart
// input must have one canonical time representation and an explicit update
// state before it crosses into a renderer.

export const CHART_CORE_CONTRACT_VERSION = 'chart-core.v1';
export const CHART_UPDATE_CAUSES = Object.freeze(['history', 'tick', 'bar', 'inputs', 'viewport', 'market']);

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function canonicalEpochMs(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const milliseconds = Math.abs(value) < 1e12 ? value * 1000 : value;
    return Number.isFinite(milliseconds) ? Math.trunc(milliseconds) : null;
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeChartBar(row = {}) {
  const time = row?.time ?? row?.date ?? row?.timestamp ?? null;
  const epochMs = canonicalEpochMs(time);
  return Object.freeze({
    time: time == null ? null : String(time),
    epochMs,
    open: finite(row?.open),
    high: finite(row?.high),
    low: finite(row?.low),
    close: finite(row?.close),
    volume: finite(row?.volume),
    source: row?.source || row?.sourceKind || null,
    provisional: row?.provisional === true || row?.updateCause === 'tick',
    updateCause: CHART_UPDATE_CAUSES.includes(row?.updateCause) ? row.updateCause : 'history'
  });
}

export function classifyChartUpdate({ cause = 'history', settled = false } = {}) {
  const updateCause = CHART_UPDATE_CAUSES.includes(cause) ? cause : 'history';
  const recordable = updateCause === 'bar' && settled === true;
  return Object.freeze({
    updateCause,
    provisional: updateCause === 'tick' || !recordable,
    recordable,
    exportable: recordable
  });
}

export function negotiateChartRenderer({ renderer = null, required = [] } = {}) {
  const capabilities = renderer?.capabilities && typeof renderer.capabilities === 'object' ? renderer.capabilities : {};
  const missing = (Array.isArray(required) ? required : []).filter((capability) => capabilities[capability] !== true);
  return Object.freeze({
    available: typeof renderer?.render === 'function' && missing.length === 0,
    missing: Object.freeze([...missing]),
    failSoft: true
  });
}
