// v59.70 DOM1 (legacy core wave 2): a closed fold builds its body the first time it opens. The big folds of 시장 상태,
// 매크로, 테마 and 뉴스 (the indicator groups, the stage tables, the release-summary lists) held 600 to 2,900 nodes each
// while closed, and every repaint rebuilt them. The summary stays on the face; an open fold (restored by the caller
// before this runs) is filled at once.
export function fillOnOpen(fold, build) {
  let filled = false;
  const fill = () => {
    if (filled) return;
    filled = true;
    fold.append(...build());
  };
  if (fold.open) fill();
  else fold.addEventListener('toggle', () => { if (fold.open) fill(); });
  return fold;
}
