import { createAnalysisDataAction, ANALYSIS_DATA_CLEAR } from '../../state/slices/analysis.js';

export function createAnalysisCommands({ store } = {}) {
  if (!store?.dispatch) throw new Error('ANALYSIS_COMMAND_STORE_INVALID');
  return Object.freeze({
    setData(payload, meta = {}) { return store.dispatch(createAnalysisDataAction(payload, meta)); },
    clear() { return store.dispatch({ type: ANALYSIS_DATA_CLEAR }); }
  });
}
