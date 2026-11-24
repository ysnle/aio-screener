import { readNumber as finite } from '../../domain/shared/number.js';
import { regimeMarketInput } from '../../domain/market/interpretation/inputs.js';

// One input reader for the briefing read and the 시장 상태 regime board, so the two
// screens judge the same closes, credit and rate changes.
// Every value travels with its observation date; the domain aligns them to one basis.
// P28-INTERPRETATION-01: `now` is the caller's clock (the interpretation's nowMs), so regime and KRX admission read
// the same instant as the events and theme groups built from the same input.
export function collectMarketInputs(root, { now = Date.now() } = {}) {
  const snapshot = root.DATA_SNAPSHOT || {};
  const fieldTs = snapshot._fieldTs || {};
  let fgMetric = null;
  try { fgMetric = root.AIO?.getCanonicalMetric?.('fg') || null; } catch (_) {}
  const fg = finite(fgMetric?.value);
  // The runtime reads below override the published macro block inside the shared builder
  // (src/domain/market/interpretation/inputs.js); a runtime value that is missing falls back to the same data.json field the
  // producers read, so the two adapters differ only where the browser holds a fresher observation.
  const credit = {
    hyBp: finite(root._hySpreadBp) ?? finite(snapshot.hySpread),
    hyAsOf: root._hySpreadDate || fieldTs.hySpread || null,
    fg: fg != null ? fg : finite(snapshot.fearGreedValue),
    fgAsOf: fg != null ? fgMetric?.asOf || null : fieldTs.fg || null,
    hyDelta5Bp: finite(snapshot._hySpreadDelta5Bp),
    aaiiAsOf: fieldTs.aaii || null
  };
  // FRED one-week changes (producer-published); a missing series keeps its rule silent.
  const rates = Object.fromEntries(['realYield10', 'realYield10Delta5', 'breakeven10Delta5', 'dgs2Delta5', 'dgs10Delta5']
    .map((key) => [key, finite(key.endsWith('Delta5') ? snapshot[`_${key}`] : snapshot[key])]));
  rates.asOf = fieldTs.macro_realYield10 || fieldTs.macro_dgs10 || null;
  // Nominal ≈ real + breakeven holds only on one date; TIPS (10/1) and breakeven
  // (10/2) from different days are not split against each other.
  rates.realAsOf = fieldTs.macro_realYield10 || null;
  rates.breakevenAsOf = fieldTs.macro_breakeven10 || null;
  // The 2-year change carries its own date so the curve rule reads the 10-year close series over the same window.
  rates.dgs2AsOf = fieldTs.macro_dgs2 || null;
  // The 20-session HY widening comes from macro-history; every screen that reads these inputs gets it.
  // The narrow-tape read prefers the S&P 500 member segment (same lookup as breadth-board) over the AIO universe.
  // Perf: a dot-path read snapshots only this segment; the bare call deep-cloned and froze all screener rows.
  const breadthSp500 = root?.AIO_ARCH?.getScreenerState?.('metadata.breadth.segments.sp500') || null;
  const aaii = { bullish: snapshot.aaiiBull, bearish: snapshot.aaiiBear, observedAt: fieldTs.aaii || null }; // server-macro.js copies data.json marketSurveys.aaii here
  return regimeMarketInput({ macro: root._aioServerMacro || null, history: root._aioHistory || [], macroHistory: root._aioMacroHistory || null, breadthSp500, aaii, credit, rates, nowMs: now }); // M05: admit only a current basis
}
