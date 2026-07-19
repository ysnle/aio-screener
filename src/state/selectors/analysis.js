export function selectAnalysisState(state) { return state?.analysis || null; }
export function selectTechnical(state) { return selectAnalysisState(state)?.technical || null; }
export function selectSignal(state) { return selectAnalysisState(state)?.signal || null; }
export function selectHomeSummary(state) { return selectAnalysisState(state)?.home || null; }
