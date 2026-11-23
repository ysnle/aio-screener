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
