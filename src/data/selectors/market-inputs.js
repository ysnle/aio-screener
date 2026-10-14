// v57.60: moved from src/ui/components/briefing-read.js (pure data gathering from runtime globals, no DOM) so
// the AI context, bootstrap and the market boards read it without importing a ui component.

function finite(value) {
  const number = Number(value);
  return value != null && value !== '' && Number.isFinite(number) ? number : null;
}

// P1392: one input reader for the briefing read and the 시장 상태 regime board, so the two
// screens judge the same closes, credit and rate changes.
// P1399: every value travels with its observation date; the domain aligns them to one basis.
export function collectMarketInputs(root) {
  const snapshot = root.DATA_SNAPSHOT || {};
  const fieldTs = snapshot._fieldTs || {};
  let fgMetric = null;
  try { fgMetric = root.AIO?.getCanonicalMetric?.('fg') || null; } catch (_) {}
  const fg = finite(fgMetric?.value);
  const putCall = root._lastPutCallPayload || null;
  const credit = {
    hyBp: finite(root._hySpreadBp) ?? finite(snapshot.hySpread),
    hyAsOf: root._hySpreadDate || fieldTs.hySpread || null,
    pcr: finite(putCall?.totalPutCall) ?? finite(snapshot.pcr),
    pcrAsOf: putCall?.asOf || fieldTs.pcr || null,
    fg: fg != null ? fg : finite(snapshot.fearGreedValue),
    fgAsOf: fg != null ? fgMetric?.asOf || null : fieldTs.fg || null,
    hyDelta5Bp: finite(snapshot._hySpreadDelta5Bp),
    aaiiAsOf: fieldTs.aaii || null
  };
  // P1390: FRED one-week changes (producer-published); a missing series keeps its rule silent.
  const rates = Object.fromEntries(['realYield10', 'realYield10Delta5', 'breakeven10Delta5', 'dgs2Delta5', 'dgs10Delta5']
    .map((key) => [key, finite(key.endsWith('Delta5') ? snapshot[`_${key}`] : snapshot[key])]));
  rates.asOf = fieldTs.macro_realYield10 || fieldTs.macro_dgs10 || null;
  // Codex review 2026-10-05: nominal ≈ real + breakeven holds only on one date; TIPS (10/1) and breakeven
  // (10/2) from different days are not split against each other.
  rates.realAsOf = fieldTs.macro_realYield10 || null;
  rates.breakevenAsOf = fieldTs.macro_breakeven10 || null;
  // v57.50 C10: the 2-year change carries its own date so the curve rule reads the 10-year close series over the same window.
  rates.dgs2AsOf = fieldTs.macro_dgs2 || null;
  // T05/P1685: the 20-session HY widening comes from macro-history; every screen that reads these inputs gets it.
  // v57.59: the narrow-tape read prefers the S&P 500 member segment (same lookup as breadth-board) over the AIO universe.
  const breadthSp500 = root?.AIO_ARCH?.getScreenerState?.()?.metadata?.breadth?.segments?.sp500 || null;
  return { history: root._aioHistory || [], credit, rates, now: Date.now(), macroHistory: root._aioMacroHistory || null, breadthSp500 }; // M05: admit only a current basis
}
