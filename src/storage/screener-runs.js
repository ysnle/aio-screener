// Local research inputs, stored only after an explicit workbench run. This is
// separate from personal holdings and never stores credentials or vault data.
export function createScreenerRunArchive({ indexedDB, limit = 5 } = {}) {
  let opening = null;
  const maximum = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 20) : 5;
  function open() {
    if (!indexedDB?.open) return Promise.reject(new Error('SCREEN_ARCHIVE_UNAVAILABLE'));
    if (!opening) opening = new Promise((resolve, reject) => {
      let abandoned = false;
      const request = indexedDB.open('aio-screener-runs', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('runs')) db.createObjectStore('runs', { keyPath: 'id' });
      };
      request.onerror = () => { abandoned = true; reject(request.error || new Error('SCREEN_ARCHIVE_OPEN_FAILED')); };
      request.onblocked = () => { abandoned = true; reject(new Error('SCREEN_ARCHIVE_BLOCKED')); };
      request.onsuccess = () => {
        const db = request.result;
        if (abandoned) { db.close(); return; }
        db.onversionchange = () => { db.close(); opening = null; };
        resolve(db);
      };
    }).catch(error => { opening = null; throw error; });
    return opening;
  }
  async function transact(mode, operation) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('runs', mode);
      let result;
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = transaction.onerror = () => reject(transaction.error || new Error('SCREEN_ARCHIVE_TRANSACTION_FAILED'));
      try { operation(transaction.objectStore('runs'), value => { result = value; }); }
      catch (error) { transaction.abort(); reject(error); }
    });
  }
  return Object.freeze({
    async put(record) {
      if (!record?.run?.runId || !record.contentHash) throw new Error('SCREEN_ARCHIVE_RECORD_INVALID');
      return transact('readwrite', (store, setResult) => {
        const savedAt = new Date().toISOString();
        const request = store.getAll();
        request.onsuccess = () => {
          const sequence = 1 + Math.max(0, ...request.result.map(entry => entry.sequence || 0));
          const sorted = request.result.filter(entry => entry.id !== record.run.runId)
            .sort((a, b) => (b.sequence || 0) - (a.sequence || 0) || b.savedAt.localeCompare(a.savedAt));
          sorted.slice(maximum - 1).forEach(entry => store.delete(entry.id));
          store.put({ id: record.run.runId, savedAt, sequence, record });
          setResult({ id: record.run.runId, savedAt, status: 'persisted' });
        };
      });
    },
    async get(id) {
      return transact('readonly', (store, setResult) => {
        const request = store.get(String(id));
        request.onsuccess = () => setResult(request.result?.record || null);
      });
    },
    async list() {
      return transact('readonly', (store, setResult) => {
        const request = store.getAll();
        request.onsuccess = () => setResult(request.result
          .sort((a, b) => (b.sequence || 0) - (a.sequence || 0) || b.savedAt.localeCompare(a.savedAt))
          .map(({ id, savedAt, record }) => ({ id, savedAt, name: record.definition.name, run: record.run })));
      });
    },
    async remove(id) { return transact('readwrite', store => { store.delete(String(id)); }); }
  });
}
