// One way from another screen to an axis on 시장 상태. The axis is asked for before the route renders
// (root.__aioOpenAxis, which the regime page keeps), then the view lands on what was asked: the axis's chart in the one
// 지표 추이 card for a chart link, the axis row otherwise. It retries while 시장 상태 paints. Kept apart from
// market-regime.js so a caller does not load that renderer.
const LAND_TRIES = 30; // 3 s of 100 ms waits for the route to paint
export function openSignalAxis(doc, root, axisId, { chart = false } = {}) {
  root.__aioOpenAxis = axisId;
  root.showPage?.('signal');
  let triesLeft = LAND_TRIES;
  const land = () => {
    const axis = doc.querySelector?.(`:is(#regime-board, #regime-board-watch) .ind-row[data-axis="${axisId}"]`);
    if (!axis) { triesLeft -= 1; if (triesLeft) setTimeout(land, 100); return; }
    root._aioShowViewOf?.(axis);
    const pick = chart ? doc.querySelector?.(`#regime-history-host .regime-history-axes > button[data-axis="${axisId}"]`) : null;
    pick?.click();
    (pick ? doc.getElementById('regime-history') || axis : axis).scrollIntoView?.({ block: 'start' });
  };
  setTimeout(land, 60);
}
