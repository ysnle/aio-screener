import { normalizeThemes } from '../normalize/themes.js';

export function createThemesOrchestrator({ provider, commands } = {}) {
  if (!provider?.readCurrent || !commands?.setData) throw new Error('THEMES_ORCHESTRATOR_DEPENDENCY_INVALID');
  function sync() {
    const normalized = normalizeThemes(provider.readCurrent());
    commands.setData(normalized, { updatedAt: normalized.updatedAt });
    return normalized;
  }
  return Object.freeze({ sync });
}
