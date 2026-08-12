export function selectScreenerState(state) {
  return state?.screener || null;
}

export function selectScreenerRows(state) {
  return selectScreenerState(state)?.rows || [];
}

export function selectScreenerRevision(state) {
  return selectScreenerState(state)?.revision || null;
}

export function selectScreenerWorkbench(state) {
  const screener = selectScreenerState(state);
  return screener ? {
    snapshotId: screener.snapshotId,
    definition: screener.screenDefinition,
    run: screener.lastRun,
    runHistory: screener.runHistory || [],
    readiness: screener.readiness,
    savedScreens: screener.savedScreens || [],
    outcomes: screener.outcomes || [],
    refreshPlan: screener.refreshPlan || null,
    hash: screener.workbenchHash || null
  } : null;
}
