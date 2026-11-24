// Where the per-subject AI readings are kept (src/ui/components/subject-reading.js). A reading is keyed by its packet
// (kind, subject, close, facts hash): this tab's memory always; this browser's localStorage only for the public subjects
// (a stock, a chart). A portfolio reading is about the reader's private holdings and never leaves memory. The automatic
// readings this browser writes per day are counted here too.
export const PERSISTED_KINDS = Object.freeze(['stock', 'chart']);
const STORE_KEY = 'aio_subject_readings_v1';
const STORE_MAX = 80;
const AUTO_KEY = 'aio_subject_reading_auto_v1';
const memory = new Map();

const storage = (root) => { try { return root?.localStorage || null; } catch (_) { return null; } };
function stored(root) { try { return JSON.parse(storage(root)?.getItem(STORE_KEY) || '{}') || {}; } catch (_) { return {}; } }

/** The kept reading of a packet: this tab's memory, then (stock and chart) this browser's store. */
export function cachedSubjectReading(root, packet) {
  return memory.get(packet.key) || (PERSISTED_KINDS.includes(packet.kind) ? stored(root)[packet.key] || null : null);
}

/** Keeps a verified reading: in memory always, in localStorage only for the public subjects (never the portfolio). */
export function rememberSubjectReading(root, packet, reading) {
  memory.set(packet.key, reading);
  if (!PERSISTED_KINDS.includes(packet.kind)) return;
  try {
    const all = stored(root);
    all[packet.key] = reading;
    const keys = Object.keys(all);
    for (const key of keys.slice(0, Math.max(0, keys.length - STORE_MAX))) delete all[key];
    storage(root)?.setItem(STORE_KEY, JSON.stringify(all));
  } catch (_) { /* a full or blocked store keeps the reading in memory only */ }
}

/** Takes one automatic reading from today's allowance of `perDay`; false when it is spent or the store is unavailable. */
export function takeAutoReading(root, today, perDay) {
  try {
    const store = storage(root);
    if (!store) return false;
    const row = JSON.parse(store.getItem(AUTO_KEY) || 'null');
    const used = row?.day === today ? Number(row.used) || 0 : 0;
    if (used >= perDay) return false;
    store.setItem(AUTO_KEY, JSON.stringify({ day: today, used: used + 1 }));
    return true;
  } catch (_) { return false; }
}
