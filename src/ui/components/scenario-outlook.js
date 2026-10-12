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

function outlookThemes(root) {
  let rows = [];
  try { rows = root?.AIO?.store?.getState?.()?.screener?.rows || root?._aioGetCanonicalScreenerRows?.() || []; } catch (_) { rows = []; }
  const typed = rows.map((row) => row?.fieldReadiness ? { ...row, ...Object.fromEntries(['ret1m', 'ret3m', 'ret6m', 'pctSma50'].map((key) => [key, finite(fieldValueForPurpose(row, `price.${key}`, 'display'))])) } : row);
  try {
    const model = buildGroupStrength({ themes: root?.THEME_MAP || [], rows: typed, sortKey: 'ret3m' });
    return (model.groups || []).filter((group) => group.ret3m != null && group.rankable !== false).map((group) => ({ name: group.name || group.subTheme || group.id, ret3m: group.ret3m }));
  } catch (_) { return []; }
}

export function outlookForRoot(root, { scenarios, regime, nowMs = Date.now() } = {}) {
  return buildScenarioOutlook({ scenarios, regime, sectors: outlookSectors(root, nowMs), themes: outlookThemes(root) });
}
