// Owner 2026-10-19: the browser adapter of the interpretation pipeline (src/domain/interpretation/market-interpretation.js).
// It gathers every input from the loaded runtime artifacts once and keeps the result until one of them changes, so
// 오늘, 시장 상태, 거시, 테마, 브리핑, the AI chat and each screen's lessons read the same regime, branches and guide.
import { collectMarketInputs } from './market-inputs.js';
import { buildMarketInterpretation } from '../../domain/interpretation/market-interpretation.js';
import { SCENARIO_OUTCOMES, SCENARIO_STATE } from '../shared-artifacts.js';

// The native store, registered once by bootstrap, so every caller reads the same typed rows in place (v57.77 perf: the
// legacy bridge snapshots them). A caller may still pass its own store (fixtures, the AI's row view). An empty native
// set defers to the bridge, which owns the pre-publication fallback rule (screener-row-policy).
const stores = new WeakMap();
export function registerInterpretationStore(root, store) {
  if (root && typeof root === 'object' && store) stores.set(root, store);
  return () => { if (stores.get(root) === store) stores.delete(root); };
}

export function screenerRowsForRoot(root, store = null) {
  try {
    const source = store || (root && typeof root === 'object' ? stores.get(root) : null);
    const nativeRows = source?.getState?.()?.screener?.rows;
    return (Array.isArray(nativeRows) && nativeRows.length ? nativeRows : root?._aioGetCanonicalScreenerRows?.()) || [];
  } catch (_) { return []; }
}

export function themeMapsForRoot(root) {
  const usThemes = Array.isArray(root?.THEME_MAP) ? root.THEME_MAP : [];
  return {
    usThemes,
    krThemeMap: root?.KR_THEME_MAP && typeof root.KR_THEME_MAP === 'object' ? root.KR_THEME_MAP : null,
    labels: Object.fromEntries(usThemes.map((theme) => [theme.id, theme.nameKr]))
  };
}

/** Every input the pipeline reads, from the runtime artifacts already loaded on `root`. */
export function collectInterpretationInputs(root, { store = null, nowMs = Date.now() } = {}) {
  return {
    market: collectMarketInputs(root),
    macro: root?._aioServerMacro || null,
    calendar: { releases: root?.AIO_MACRO_CALENDAR?.releases || {}, schedules: root?.AIO_MACRO_OFFICIAL_SCHEDULES || {} },
    outcomes: root?.[SCENARIO_OUTCOMES.key] || null,
    previous: root?.[SCENARIO_STATE.key] || null,
    screenerRows: screenerRowsForRoot(root, store),
    themeMaps: themeMapsForRoot(root),
    rotationHistory: root?._serverDataMeta?.rotationHistory || null,
    nowMs
  };
}

// The cached result is reused while every input is the same object (artifacts are replaced, never mutated, when they
// load) and the small derived values read the same; the clock is bucketed to the minute (session admission and the
// release horizon move on days, not milliseconds).
const MINUTE = 60 * 1000;
const cache = new WeakMap();
function signature(root, input) {
  const { market, macro, outcomes, previous, screenerRows, rotationHistory, nowMs } = input;
  // Raw artifact references from `root` (the collected input wraps a missing one in a fresh {} or []).
  return [market.history, market.macroHistory, JSON.stringify(market.credit), JSON.stringify(market.rates), JSON.stringify(market.breadthSp500 || null),
    macro, root.AIO_MACRO_CALENDAR, root.AIO_MACRO_OFFICIAL_SCHEDULES, outcomes, previous, screenerRows.length ? screenerRows : null, screenerRows.length,
    root.THEME_MAP, root.KR_THEME_MAP, rotationHistory, Math.floor(nowMs / MINUTE)];
}
const same = (a, b) => a.length === b.length && a.every((value, index) => Object.is(value, b[index]));

/** The shared interpretation for this page state; one build per input change. */
export function marketInterpretation(root, { store = null, nowMs = Date.now() } = {}) {
  const input = collectInterpretationInputs(root, { store, nowMs });
  if (!root || typeof root !== 'object') return buildMarketInterpretation(input);
  const key = signature(root, input);
  const hit = cache.get(root);
  if (hit && same(hit.key, key)) return hit.value;
  const value = buildMarketInterpretation(input);
  cache.set(root, { key, value });
  return value;
}
