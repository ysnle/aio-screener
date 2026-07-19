import { createEntityDataAction, ENTITY_DATA_CLEAR } from '../../state/slices/entity.js';

export function createEntityCommands({ store } = {}) {
  if (!store?.dispatch) throw new Error('ENTITY_COMMAND_STORE_INVALID');
  return Object.freeze({
    setData(payload, meta = {}) {
      return store.dispatch(createEntityDataAction(payload, meta));
    },
    clear() {
      return store.dispatch({ type: ENTITY_DATA_CLEAR });
    }
  });
}
