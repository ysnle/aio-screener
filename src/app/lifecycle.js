export function createResourceBag() {
  const disposers = new Set();
  let disposed = false;

  function add(disposer) {
    if (typeof disposer !== 'function') throw new Error('RESOURCE_DISPOSER_INVALID');
    if (disposed) {
      disposer();
      return disposer;
    }
    disposers.add(disposer);
    return () => {
      if (!disposers.delete(disposer)) return;
      disposer();
    };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    [...disposers].reverse().forEach((disposer) => {
      try { disposer(); } catch (_) {}
    });
    disposers.clear();
  }

  return Object.freeze({ add, dispose, size: () => disposers.size });
}
