// CHART-CORE-01: dependency-free chart boundary extracted from the supplied
// Vela architecture. The app may keep Chart.js as a renderer, but every chart
// input must have one canonical time representation and an explicit update
// state before it crosses into a renderer.
import { finiteNumber as finite } from '../shared/number.js';

export const CHART_UPDATE_CAUSES = Object.freeze(['history', 'tick', 'bar', 'inputs', 'viewport', 'market']);

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

