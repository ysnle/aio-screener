import { normalizeAnalysis } from '../normalize/analysis.js';

export function createAnalysisOrchestrator({ provider, commands } = {}) {
  if (!provider?.readCurrent || !commands?.setData) throw new Error('ANALYSIS_ORCHESTRATOR_DEPENDENCY_INVALID');
  function sync() { const normalized = normalizeAnalysis(provider.readCurrent()); commands.setData(normalized, { updatedAt: normalized.updatedAt }); return normalized; }
  return Object.freeze({ sync });
}
