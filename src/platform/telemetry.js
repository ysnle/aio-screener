export function createTelemetry({ maxEntries = 100, clock = { iso: () => new Date().toISOString() } } = {}) {
  const entries = [];
  function record(event, fields = {}) {
    entries.push(Object.freeze({ event: String(event), at: clock.iso(), fields: { ...fields } }));
    if (entries.length > maxEntries) entries.splice(0, entries.length - maxEntries);
  }
  return Object.freeze({ record, snapshot: () => entries.map((entry) => ({ ...entry, fields: { ...entry.fields } })) });
}
