// the one counter line under the 시장 상태 verdict. The six US axes lean to the side with
// more axes (양호 against 부담); the counter is every axis on the other side, or — when no axis is there — the neutral axis
// nearest to that side in typical moves (its flipDistances, the rule's own thresholds). Facts only: which axis, its state
// and that threshold; what it means is the screen's AI reading. Nothing here changes a state or the verdict.
export function counterAxes(regime) {
  if (!regime?.available) return null;
  const axes = (regime.axes || []).filter((row) => row.id !== 'korea' && row.state !== 'unknown');
  const { favorable = 0, burden = 0 } = regime.counts || {};
  const against = favorable > burden ? 'burden' : burden > favorable ? 'favorable' : null;
  if (!against) return null;
  const opposite = axes.filter((row) => row.state === against);
  if (opposite.length) return { kind: 'opposite', against, items: opposite.map((row) => ({ row, distance: null })) };
  const near = axes.filter((row) => row.state === 'neutral')
    .flatMap((row) => (row.flipDistances || []).filter((distance) => distance.toward === against && !distance.needsMore).map((distance) => ({ row, distance })))
    .sort((a, b) => (a.distance.sessions ?? Infinity) - (b.distance.sessions ?? Infinity));
  return near.length ? { kind: 'nearest', against, items: near.slice(0, 1) } : null;
}
