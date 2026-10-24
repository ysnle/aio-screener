// P1743 (owner 2026-10-13): "테마 시나리오" on 테마 — every US and KR theme read by one rule (src/domain/scenarios/
// theme-playbook.js), so a sector rally, a pullback inside a long uptrend or a bottleneck theme is never a hand-written
// note. One visual (the momentum map: 6-month trend × 1-month move, coloured by the macro wind), a short reading (where
// strength moved and which combinations stand out), then folded per-stage cards with each theme's choices, opportunity
// cost, evidence lines, structural hypothesis and what would break it. Stock selection stays on 테마 상세 and 스크리너.
// v58.75 (persona review): the view (renderThemePlaybook, renderThemeDetailPlaybook, the stage table and the teach
// helpers) lives in theme-playbook-view.js, loaded only by the lazy 테마 route; this module keeps the shared read.
import { marketInterpretation } from '../../data/selectors/interpretation.js';

// Owner 2026-10-19: the theme stages are a stage of the shared interpretation (same rows, same theme strength and the
// same branches as the outlook and 거시). `store` lets a caller pass its own row view (the AI chat).
export function themePlaybookForRoot(root, store = null, { nowMs = Date.now() } = {}) {
  const { crossroads, playbook } = marketInterpretation(root, { store, nowMs });
  return { crossroads, playbook: playbook || { available: false, themes: [], highlights: {}, rotation: null } };
}
