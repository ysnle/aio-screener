import { marketInterpretation } from '../../data/selectors/interpretation.js';

export function themePlaybookForRoot(root, store = null, { nowMs = Date.now() } = {}) {
  const { crossroads, playbook } = marketInterpretation(root, { store, nowMs });
  return { crossroads, playbook: playbook || { available: false, themes: [], highlights: {}, rotation: null } };
}
