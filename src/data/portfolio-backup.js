/**
 * Full personal-data backup bundle (P1316/R661).
 *
 * The old export wrote only the positions array. The account ledger, FX legs, cash,
 * declared assumptions, trade journal and watchlists live under separate keys and
 * were silently lost on a device change — and would all be lost on any origin move,
 * because browser storage does not follow a new address. One versioned bundle carries
 * every personal section; import replaces each section it declares.
 *
 * Pure: the classic shell supplies a snapshot (already-decrypted runtime values) and
 * the section normalizers, so this module is testable without a browser. It never
 * reads storage, never touches the Vault, and never exports API keys or PINs.
 */

export const BACKUP_FORMAT = 'aio-backup';
export const BACKUP_VERSION = 1;
export const BACKUP_SECTIONS = Object.freeze(['positions', 'ledger', 'fxLegs', 'cash', 'assumptions', 'journal', 'watchlists', 'activeWatchlistId']);

const TICKER_RE = /^[A-Z0-9.\-^=]{1,12}$/i;
const MAX_JOURNAL = 80;

// Same acceptance rule as the pre-P1316 import (v46.9 schema + XSS trimming).
export function sanitizePositions(raw) {
  return (Array.isArray(raw) ? raw : [])
    .filter((p) => p && typeof p.ticker === 'string' && TICKER_RE.test(p.ticker.trim()))
    .map((p) => {
      const out = { ...p, ticker: p.ticker.trim().toUpperCase() };
      if (out.memo) out.memo = String(out.memo).slice(0, 200);
      if (out.note) out.note = String(out.note).slice(0, 200);
      out.qty = Number.isFinite(Number(out.qty)) ? Number(out.qty) : 0;
      out.cost = Number.isFinite(Number(out.cost)) ? Number(out.cost) : 0;
      return out;
    });
}

function sanitizeJournal(raw) {
  return (Array.isArray(raw) ? raw : [])
    .filter((e) => e && typeof e.note === 'string' && e.note.trim() && Number.isFinite(Number(e.ts)))
    .slice(0, MAX_JOURNAL)
    .map((e) => ({
      ts: Number(e.ts),
      date: typeof e.date === 'string' ? e.date.slice(0, 40) : new Date(Number(e.ts)).toISOString(),
      note: e.note.slice(0, 2000),
      tickers: (Array.isArray(e.tickers) ? e.tickers : []).filter((t) => typeof t === 'string' && TICKER_RE.test(t)).slice(0, 50)
    }));
}

function sanitizeWatchlists(raw) {
  return (Array.isArray(raw) ? raw : [])
    .filter((l) => l && typeof l.id === 'string' && l.id.trim() && typeof l.name === 'string' && l.name.trim())
    .slice(0, 50)
    .map((l) => ({
      ...l,
      id: l.id.trim().slice(0, 64),
      name: l.name.trim().slice(0, 50),
      // P1350: the live owner stores {sym,note,addedAt}; legacy strings become that shape.
      tickers: (Array.isArray(l.tickers) ? l.tickers : []).map((t) => {
        const raw = typeof t === 'string' ? { sym: t } : t;
        if (!raw || typeof raw.sym !== 'string' || !TICKER_RE.test(raw.sym.trim())) return null;
        const item = { sym: raw.sym.trim().toUpperCase(), note: typeof raw.note === 'string' ? raw.note.slice(0, 200) : '' };
        if (typeof raw.addedAt === 'number' && Number.isFinite(raw.addedAt) && raw.addedAt >= 0) item.addedAt = raw.addedAt;
        return item;
      }).filter(Boolean).slice(0, 200)
    }));
}

function sanitizeCash(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? String(n) : null;
}

// Assumptions are stored as the raw declared text; keep only values the owning
// normalizer accepts, so an invalid declaration is never resurrected by a restore.
function sanitizeAssumptions(raw, deps) {
  const out = {};
  const kinds = deps.assumptionKinds || {};
  const src = raw && typeof raw === 'object' ? raw : {};
  Object.keys(kinds).forEach((name) => {
    const value = src[name];
    if (value == null || String(value).trim() === '') return;
    const normalize = deps.assumptionNormalizers && deps.assumptionNormalizers[kinds[name]];
    if (typeof normalize !== 'function' || normalize(value) == null) return;
    out[name] = kinds[name] === 'currency' ? normalize(value) : String(value).trim();
  });
  return out;
}

export function countBackupContents(contents = {}) {
  const ledger = contents.ledger;
  const ledgerEntries = ledger ? ((ledger.transactions || []).length + (ledger.valuations || []).length) : 0;
  const counts = {
    positions: (contents.positions || []).length,
    ledgerEntries,
    fxLegs: (contents.fxLegs || []).length,
    cash: contents.cash != null ? 1 : 0,
    assumptions: Object.keys(contents.assumptions || {}).length,
    journal: (contents.journal || []).length,
    watchlists: (contents.watchlists || []).length
  };
  // A declared ledger with coverage flags but no entries is still a declaration worth keeping.
  counts.total = Object.values(counts).reduce((sum, n) => sum + n, 0) + (ledger && !ledgerEntries ? 1 : 0);
  return counts;
}

export function describeBackupCounts(counts) {
  return [
    `포지션 ${counts.positions}`,
    `원장 ${counts.ledgerEntries}`,
    `환율 ${counts.fxLegs}`,
    `현금 ${counts.cash ? '있음' : '없음'}`,
    `가정 ${counts.assumptions}`,
    `일지 ${counts.journal}`,
    `관심목록 ${counts.watchlists}`
  ].join(' · ');
}

export function buildPortfolioBackup(snapshot = {}, meta = {}) {
  const contents = {
    positions: Array.isArray(snapshot.positions) ? snapshot.positions : [],
    ledger: snapshot.ledger && typeof snapshot.ledger === 'object' ? snapshot.ledger : null,
    fxLegs: Array.isArray(snapshot.fxLegs) ? snapshot.fxLegs : [],
    cash: snapshot.cash == null ? null : String(snapshot.cash),
    assumptions: snapshot.assumptions && typeof snapshot.assumptions === 'object' ? { ...snapshot.assumptions } : {},
    journal: Array.isArray(snapshot.journal) ? snapshot.journal : [],
    watchlists: Array.isArray(snapshot.watchlists) ? snapshot.watchlists : [],
    activeWatchlistId: typeof snapshot.activeWatchlistId === 'string' && snapshot.activeWatchlistId ? snapshot.activeWatchlistId : null
  };
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: meta.exportedAt || new Date().toISOString(),
    appVersion: meta.appVersion || null,
    origin: meta.origin || null,
    counts: countBackupContents(contents),
    contents
  };
}

/**
 * Parse an imported file. Accepts the pre-P1316 positions array (kind 'positions',
 * positions only — other sections untouched) or a v1 bundle (kind 'bundle', every
 * section replaced). deps: { normalizeLedger, normalizeFxLegs, assumptionKinds,
 * assumptionNormalizers }.
 */
export function parsePortfolioBackup(text, deps = {}) {
  let data;
  try { data = typeof text === 'string' ? JSON.parse(text) : text; } catch (_) { return { ok: false, reason: 'invalid-json' }; }
  if (Array.isArray(data)) {
    const positions = sanitizePositions(data);
    if (!positions.length) return { ok: false, reason: 'no-valid-positions' };
    return { ok: true, kind: 'positions', contents: { positions }, counts: countBackupContents({ positions }) };
  }
  if (!data || typeof data !== 'object' || data.format !== BACKUP_FORMAT) return { ok: false, reason: 'unknown-format' };
  if (data.version !== BACKUP_VERSION) return { ok: false, reason: 'unsupported-version' };
  const raw = data.contents && typeof data.contents === 'object' ? data.contents : {};
  const normalizeLedger = typeof deps.normalizeLedger === 'function' ? deps.normalizeLedger : () => null;
  const normalizeFxLegs = typeof deps.normalizeFxLegs === 'function' ? deps.normalizeFxLegs : () => [];
  const watchlists = sanitizeWatchlists(raw.watchlists);
  const activeId = typeof raw.activeWatchlistId === 'string' && watchlists.some((l) => l.id === raw.activeWatchlistId) ? raw.activeWatchlistId : null;
  const contents = {
    positions: sanitizePositions(raw.positions),
    ledger: normalizeLedger(raw.ledger),
    fxLegs: normalizeFxLegs(raw.fxLegs),
    cash: sanitizeCash(raw.cash),
    assumptions: sanitizeAssumptions(raw.assumptions, deps),
    journal: sanitizeJournal(raw.journal),
    watchlists,
    activeWatchlistId: activeId
  };
  const counts = countBackupContents(contents);
  if (counts.total === 0) return { ok: false, reason: 'empty-bundle' };
  return { ok: true, kind: 'bundle', contents, counts, exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : null };
}
