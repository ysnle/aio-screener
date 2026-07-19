import { createThemesDataAction, THEMES_DATA_CLEAR } from '../../state/slices/themes.js';

export function createThemesCommands({ store } = {}) {
  if (!store?.dispatch) throw new Error('THEMES_COMMAND_STORE_INVALID');
  return Object.freeze({
    setData(payload, meta = {}) {
      return store.dispatch(createThemesDataAction(payload, meta));
    },
    clear() {
      return store.dispatch({ type: THEMES_DATA_CLEAR });
    }
  });
}
