// P1602/ST-11/12: explicit local immutable captures. Positions/accounts never cross this allowlist.
export const RESEARCH_SNAPSHOT_KEY = 'aio:research-snapshots:v1';
const stores = new WeakMap();
export function researchSnapshotStore(root) {
  if (!stores.has(root)) {
    let storage = null;
    try { storage = root.localStorage; } catch (_) {}
    stores.set(root, createResearchSnapshots({ storage }));
  }
  return stores.get(root);
}
const clone = (value) => JSON.parse(JSON.stringify(value));
const freeze = (value) => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const text = (value, max = 4000) => typeof value === 'string' ? value.slice(0, max) : null;
export function projectResearchSnapshot(raw) {
  if (raw?.kind === 'briefing' && /^\d{4}-\d{2}-\d{2}$/.test(raw.sessionDate || '')) return {
    kind: 'briefing', sessionDate: raw.sessionDate, version: text(raw.version, 40),
    headline: text(raw.headline), interpretation: text(raw.interpretation),
    facts: (Array.isArray(raw.facts) ? raw.facts : []).slice(0, 30).map((row) => ({ label: text(row.label, 100), value: text(row.value), observedAt: text(row.observedAt), source: text(row.source), basis: text(row.basis) })),
    checks: (Array.isArray(raw.checks) ? raw.checks : []).slice(0, 10).map((row) => text(row)),
    source: text(raw.source), note: text(raw.note, 2000)
  };
  if (raw?.kind === 'stock' && /^[A-Z0-9.^=-]{1,20}$/.test(raw.symbol || '')) {
    const quote = raw.quote || {};
    return { kind: 'stock', symbol: raw.symbol, name: text(raw.name, 160), note: text(raw.note, 2000),
      quote: { value: typeof quote.value === 'number' && Number.isFinite(quote.value) ? quote.value : null,
        currency: text(quote.currency, 10), observedAt: text(quote.observedAt), source: text(quote.source),
        basis: text(quote.basis), revision: text(quote.revision) } };
  }
  throw Error('저장할 종목 또는 미국장 기준일을 확인할 수 없습니다.');
}
export function createResearchSnapshots({ storage, now = () => new Date().toISOString(), digest = async (value) => {
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
} } = {}) {
  let records = [], deleted = null, state = storage ? 'persistent' : 'memory';
  try {
    const raw = storage?.getItem(RESEARCH_SNAPSHOT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.schemaVersion !== 'aio-research-snapshots.v1' || !Array.isArray(parsed.records) || parsed.records.length > 60) throw Error('invalid');
      records = parsed.records.map((row) => {
        if (!/^[a-f0-9]{64}$/.test(row?.id || '') || !Number.isFinite(Date.parse(row.savedAt))) throw Error('invalid');
        return freeze({ id: row.id, savedAt: row.savedAt, publishedAt: text(row.publishedAt), sourceRevision: text(row.sourceRevision), content: projectResearchSnapshot(row.content) });
      });
    }
  } catch (_) { state = 'unreadable'; }
  const persist = () => {
    try {
      if (!storage) state = 'memory';
      else { storage.setItem(RESEARCH_SNAPSHOT_KEY, JSON.stringify({ schemaVersion: 'aio-research-snapshots.v1', records })); state = 'persistent'; }
    } catch (_) { state = 'memory'; }
  };
  return {
    status: () => state,
    list: (kind) => records.filter((row) => !kind || row.content.kind === kind).map((row) => freeze(clone(row))),
    remove(id) {
      if (state === 'unreadable') throw Error('기존 자료를 읽지 못해 삭제를 보류합니다.');
      const record = records.find((row) => row.id === id);
      if (!record) return false;
      deleted = record; records = records.filter((row) => row.id !== id); persist(); return true;
    },
    undoRemove() {
      if (!deleted || records.length >= 60) return false;
      if (!records.some((row) => row.id === deleted.id)) records = [deleted, ...records];
      deleted = null; persist(); return true;
    },
    async capture(raw) {
      if (state === 'unreadable') throw Error('기존 저장본을 읽지 못했습니다. 기존 자료를 보존하기 위해 새 저장을 보류합니다.');
      const content = projectResearchSnapshot(raw);
      const id = await digest(JSON.stringify(content)); // save/build/review clocks do not affect content identity.
      const existing = records.find((row) => row.id === id);
      if (existing) return existing;
      if (records.length >= 60) throw Error('저장본 60개에 도달했습니다. 기존 저장본은 자동 삭제하지 않습니다.');
      const record = freeze({ id, savedAt: now(), publishedAt: text(raw.publishedAt), sourceRevision: text(raw.sourceRevision), content: freeze(clone(content)) });
      records = [record, ...records];
      persist();
      return record;
    }
  };
}
