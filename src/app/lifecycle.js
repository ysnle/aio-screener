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

export function createDeferredTaskQueue({
  setTimeoutImpl = globalThis.setTimeout?.bind(globalThis),
  clearTimeoutImpl = globalThis.clearTimeout?.bind(globalThis)
} = {}) {
  if (typeof setTimeoutImpl !== 'function' || typeof clearTimeoutImpl !== 'function') {
    throw new Error('DEFERRED_TASK_TIMER_INVALID');
  }
  const timers = new Set();
  let stopped = false;

  function defer(task, delay = 0) {
    if (typeof task !== 'function') throw new Error('DEFERRED_TASK_INVALID');
    if (stopped) return null;
    let timer = null;
    timer = setTimeoutImpl(() => {
      if (timer != null) timers.delete(timer);
      if (!stopped) task();
    }, Math.max(0, Number(delay) || 0));
    timers.add(timer);
    return timer;
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    for (const timer of timers) clearTimeoutImpl(timer);
    timers.clear();
  }

  return Object.freeze({
    defer,
    stop,
    size: () => timers.size,
    get stopped() { return stopped; }
  });
}

export function coalesceMicrotask(fn, {
  isActive = () => true,
  queueMicrotaskImpl = globalThis.queueMicrotask?.bind(globalThis)
} = {}) {
  if (typeof fn !== 'function' || typeof isActive !== 'function' || typeof queueMicrotaskImpl !== 'function') {
    throw new Error('COALESCED_MICROTASK_INVALID');
  }
  let scheduled = false;
  let latestArgs = [];
  return (...args) => {
    latestArgs = args;
    if (scheduled) return;
    scheduled = true;
    queueMicrotaskImpl(() => {
      scheduled = false;
      const callArgs = latestArgs;
      latestArgs = [];
      if (isActive()) fn(...callArgs);
    });
  };
}

function chartFor(entry) {
  return entry?.chart && typeof entry.chart.destroy === 'function' ? entry.chart : entry;
}

function canvasFor(entry) {
  return entry?.canvas || chartFor(entry)?.canvas || null;
}

export function createChartRegistry({ maxCanvasHeight = 480 } = {}) {
  const entries = new Map();
  const originalMaxHeights = new Map();
  let disposed = false;

  function restoreCanvas(id, entry) {
    const canvas = canvasFor(entry);
    if (!canvas) return;
    const original = originalMaxHeights.get(id);
    if (original != null && canvas.style) canvas.style.maxHeight = original;
    if (canvas.dataset?.aioChartRegistry === id) delete canvas.dataset.aioChartRegistry;
    originalMaxHeights.delete(id);
  }

  function deleteEntry(id) {
    const entry = entries.get(id);
    if (!entry) return false;
    entries.delete(id);
    restoreCanvas(id, entry);
    return true;
  }

  function destroy(id) {
    const entry = entries.get(id);
    if (!entry) return false;
    deleteEntry(id);
    try { chartFor(entry)?.destroy?.(); } catch (_) {}
    return true;
  }

  function set(id, entry) {
    if (disposed) {
      try { chartFor(entry)?.destroy?.(); } catch (_) {}
      return registry;
    }
    destroy(id);
    entries.set(id, entry);
    const canvas = canvasFor(entry);
    if (canvas?.style) {
      originalMaxHeights.set(id, canvas.style.maxHeight || '');
      if (Number.isFinite(maxCanvasHeight) && maxCanvasHeight > 0) canvas.style.maxHeight = `${maxCanvasHeight}px`;
      if (canvas.dataset) canvas.dataset.aioChartRegistry = id;
    }
    return registry;
  }

  function clear() {
    [...entries.keys()].forEach(destroy);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    clear();
  }

  const registry = Object.freeze({
    get: (id) => entries.get(id),
    set,
    delete: deleteEntry,
    destroy,
    clear,
    dispose,
    forEach: (callback) => entries.forEach(callback),
    size: () => entries.size,
    get disposed() { return disposed; }
  });
  return registry;
}
