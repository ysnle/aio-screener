import { normalizeChartBar } from '../../domain/chart/contract.js';

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function normalizeEntity(raw = {}) {
  const quote = raw.quote ? Object.freeze({
    value: finite(raw.quote.value),
    pct: finite(raw.quote.pct),
    directionValue: finite(raw.quote.directionValue ?? raw.quote.pct),
    observedAt: raw.quote.observedAt || null,
    fetchedAt: raw.quote.fetchedAt || null,
    source: raw.quote.source || 'entity-provider',
    sourceKind: raw.quote.sourceKind || 'runtime-quote',
    revision: raw.quote.revision || null,
    changeBasis: raw.quote.changeBasis || 'unknown',
    directionCompatible: raw.quote.directionCompatible === true
  }) : null;
  const history = Array.isArray(raw.history)
    ? raw.history.map((row) => {
      const bar = normalizeChartBar(row);
      return Object.freeze({
        time: bar.time,
        epochMs: bar.epochMs,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume
      });
    }).filter((row) => row.time && row.close != null)
    : [];
  const fundamentalsWatchlist = Array.isArray(raw.fundamentalsWatchlist)
    ? raw.fundamentalsWatchlist.filter((row) => row && typeof row === 'object').map((row) => Object.freeze({ ...row }))
    : [];
  return Object.freeze({
    id: raw.id ? String(raw.id).toUpperCase() : null,
    name: raw.name ? String(raw.name) : null,
    quote,
    history: Object.freeze(history),
    fundamentals: raw.fundamentals && typeof raw.fundamentals === 'object' ? Object.freeze({ ...raw.fundamentals }) : null,
    fundamentalsWatchlist: Object.freeze(fundamentalsWatchlist),
    fundamentalsMeta: raw.fundamentalsMeta && typeof raw.fundamentalsMeta === 'object' ? { ...raw.fundamentalsMeta } : null,
    options: raw.options && typeof raw.options === 'object' ? Object.freeze({ ...raw.options }) : null,
    updatedAt: raw.updatedAt || null
  });
}
