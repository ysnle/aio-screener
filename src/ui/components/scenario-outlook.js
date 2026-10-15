// P1633: one reader for the scenario outlook, shared by 시장 상태 and 오늘. It reads only existing
// current-session artifacts (produced sector rotation, screener rows, theme map); no provider calls.
import { buildScenarioOutlook, SECTOR_ETF_LABELS } from '../../domain/market/scenario-outlook.js';
import { selectProducedRotation } from '../../domain/themes/produced-rotation.js';
import { buildGroupStrength } from '../../domain/themes/group-strength.js';
import { fieldValueForPurpose } from '../../data/contracts/screener.js';

const finite = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null;

function outlookSectors(root, nowMs) {
  const artifact = root?._serverDataMeta?.rotationHistory;
  return Object.entries(SECTOR_ETF_LABELS).map(([symbol, label]) => {
    const row = selectProducedRotation(artifact, symbol, nowMs);
    return row ? { symbol, label, quadrant: row.quadrant } : null;
  }).filter(Boolean);
}

// v57.77 perf: a caller that holds the native store passes it, and the rows are read in place (read-only here:
// rows are only mapped into new objects and grouped). `root.AIO.store` was never assigned, so every call went
// through the legacy bridge, which deep-clones and freezes the whole row set after each screener change.
function outlookThemes(root, store) {
  let rows = [];
  try {
    const nativeRows = store?.getState?.()?.screener?.rows;
    // An empty native set defers to the bridge, which owns the pre-publication fallback rule (screener-row-policy).
    rows = (Array.isArray(nativeRows) && nativeRows.length ? nativeRows : root?._aioGetCanonicalScreenerRows?.()) || [];
  } catch (_) { rows = []; }
  const typed = rows.map((row) => row?.fieldReadiness ? { ...row, ...Object.fromEntries(['ret1m', 'ret3m', 'ret6m', 'pctSma50'].map((key) => [key, finite(fieldValueForPurpose(row, `price.${key}`, 'display'))])) } : row);
  try {
    // X03 (2026-10-13): "현재 주도" may name only themes measured on the latest completed session.
    const model = buildGroupStrength({ themes: root?.THEME_MAP || [], rows: typed, sortKey: 'ret3m', now: Date.now() });
    return (model.groups || []).filter((group) => group.ret3m != null && group.rankable !== false && group.current).map((group) => ({ name: group.name || group.subTheme || group.id, ret3m: group.ret3m, themeId: group.themeId || null })); // I03: chips open the theme
  } catch (_) { return []; }
}

export function outlookForRoot(root, { scenarios, regime, nowMs = Date.now(), store = null } = {}) {
  return buildScenarioOutlook({ scenarios, regime, sectors: outlookSectors(root, nowMs), themes: outlookThemes(root, store) });
}
