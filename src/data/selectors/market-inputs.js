import { readNumber as finite } from '../../domain/shared/number.js';
import { regimeMarketInput } from '../../domain/market/interpretation/inputs.js';

export function collectMarketInputs(root, { now = Date.now() } = {}) {
  const snapshot = root.DATA_SNAPSHOT || {};
  const fieldTs = snapshot._fieldTs || {};
  let fgMetric = null;
  try { fgMetric = root.AIO?.getCanonicalMetric?.('fg') || null; } catch (_) {}
  const fg = finite(fgMetric?.value);
  const credit = {
    hyBp: finite(root._hySpreadBp) ?? finite(snapshot.hySpread),
    hyAsOf: root._hySpreadDate || fieldTs.hySpread || null,
    fg: fg != null ? fg : finite(snapshot.fearGreedValue),
    fgAsOf: fg != null ? fgMetric?.asOf || null : fieldTs.fg || null,
    hyDelta5Bp: finite(snapshot._hySpreadDelta5Bp),
    aaiiAsOf: fieldTs.aaii || null
  };
  const rates = Object.fromEntries(['realYield10', 'realYield10Delta5', 'breakeven10Delta5', 'dgs2Delta5', 'dgs10Delta5']
    .map((key) => [key, finite(key.endsWith('Delta5') ? snapshot[`_${key}`] : snapshot[key])]));
  rates.asOf = fieldTs.macro_realYield10 || fieldTs.macro_dgs10 || null;
  rates.realAsOf = fieldTs.macro_realYield10 || null;
  rates.breakevenAsOf = fieldTs.macro_breakeven10 || null;
  rates.dgs2AsOf = fieldTs.macro_dgs2 || null;
  const breadthSp500 = root?.AIO_ARCH?.getScreenerState?.('metadata.breadth.segments.sp500') || null;
  const aaii = { bullish: snapshot.aaiiBull, bearish: snapshot.aaiiBear, observedAt: fieldTs.aaii || null }; // server-macro.js copies data.json marketSurveys.aaii here
  return regimeMarketInput({ macro: root._aioServerMacro || null, history: root._aioHistory || [], macroHistory: root._aioMacroHistory || null, breadthSp500, aaii, credit, rates, nowMs: now }); // M05: admit only a current basis
}
