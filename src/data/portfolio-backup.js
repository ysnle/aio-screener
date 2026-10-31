import { legacyCashCurrency, normalizeCashBalances } from './portfolio-cash.js';
import { normalizeJournal } from '../domain/portfolio/trade-journal.js';

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
export const BACKUP_SECTIONS = Object.freeze(['positions', 'ledger', 'fxLegs', 'cash', 'cashBalances', 'assumptions', 'journal', 'trades', 'watchlists', 'activeWatchlistId']);

const TICKER_RE = /^[A-Z0-9.\-^=]{1,12}$/i;
const MAX_JOURNAL = 80;
const CURRENCY_RE = /^[A-Z]{3}$/i;

// Same acceptance rule as the pre-P1316 import (v46.9 schema + XSS trimming).
export function sanitizePositions(raw) {
  return (Array.isArray(raw) ? raw : [])
    .filter((p) => p && typeof p.ticker === 'string' && TICKER_RE.test(p.ticker.trim()))
    .map((p) => {
      const out = { ...p, ticker: p.ticker.trim().toUpperCase() };
      if (out.memo) out.memo = String(out.memo).slice(0, 200);
      if (out.note) out.note = String(out.note).slice(0, 200);
      out.qty = Number.isFinite(Number(out.qty)) ? Number(out.qty) : 0;
      // v59.45 (PASS27 P27-IMPORT-01): an unreadable or empty cost is unknown, not a ₩0 purchase — 'nonsense' became cost 0
      // and the P&L read +100%. The field is left absent (the readers already treat an absent cost as missing); a number,
      // 0 included, is kept as written.
      if (out.cost == null || String(out.cost).trim() === '' || !Number.isFinite(Number(out.cost))) delete out.cost;
      else out.cost = Number(out.cost);
      // v58.82: a currency is a three-letter code or absent — the legacy table renders it as markup.
      for (const field of ['costCurrency', 'currency']) {
        if (field in out && !(typeof out[field] === 'string' && CURRENCY_RE.test(out[field].trim()))) delete out[field];
        else if (field in out) out[field] = out[field].trim().toUpperCase();
      }
      return out;
    })
    // v58.82: the add form refuses qty <= 0 and a negative cost; an imported file is held to the same rule.
    .filter((p) => p.qty > 0 && !(p.cost < 0));
}

function sanitizeJournal(raw) {
  return (Array.isArray(raw) ? raw : [])
    // v59.45 (PASS27): a finite ts outside the Date range (1e20) threw from toISOString and escaped the parser.
    .filter((e) => e && typeof e.note === 'string' && e.note.trim() && Number.isFinite(new Date(Number(e.ts)).getTime()))
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

// v57.81: cash is one balance per currency. A bundle written before v57.81 carries one `cash` value; it becomes one
// balance in the currency that bundle declared (cash currency, else base, else USD — the same rule as the storage
// migration). Neither present stays null, so a restore clears cash exactly as the old restore removed the key.
function sanitizeCashBalances(raw) {
  if (Array.isArray(raw.cashBalances) || (raw.cashBalances && typeof raw.cashBalances === 'object')) return normalizeCashBalances(raw.cashBalances);
  const legacy = sanitizeCash(raw.cash);
  if (legacy == null) return null;
  const assumptions = raw.assumptions && typeof raw.assumptions === 'object' ? raw.assumptions : {};
  return normalizeCashBalances([{ currency: legacyCashCurrency({ cashCurrency: assumptions.cashCurrency, baseCurrency: assumptions.baseCurrency }), amount: legacy }]);
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
    cash: (contents.cashBalances || []).length || (contents.cash != null ? 1 : 0),
    assumptions: Object.keys(contents.assumptions || {}).length,
    journal: (contents.journal || []).length,
    // v58.52 매매일지: trades plus one for a declared rule set (rules alone are worth keeping). A bundle without the section
    // leaves the stored journal as it is (js/aio-workspace.js restore).
    trades: (contents.trades?.trades || []).length + (Object.values(contents.trades?.rules || {}).some((value) => value != null) ? 1 : 0),
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
    `현금 ${counts.cash ? `${counts.cash}개 통화` : '없음'}`,
    `가정 ${counts.assumptions}`,
    `일지 ${counts.journal}`,
    ...(counts.trades ? [`매매일지 ${counts.trades}`] : []),
    `관심목록 ${counts.watchlists}`
  ].join(' · ');
}

// v58.84: remind once there is something to lose and no backup within 30 days; an unreadable time counts as never.
export const BACKUP_REMINDER_DAYS = 30;
export function backupReminder({ lastBackupAt, holdingCount, now = Date.now() } = {}) {
  if (!(holdingCount > 0)) return null;
  const last = Date.parse(lastBackupAt || '');
  if (!Number.isFinite(last) || last > now) return { days: null, text: '아직 백업이 없습니다. 기록을 지우면 사라지니 \'내보내기\'로 저장해 두세요.' };
  const days = Math.floor((now - last) / 86_400_000);
  return days >= BACKUP_REMINDER_DAYS ? { days, text: `마지막 백업이 ${days}일 전입니다. '내보내기'로 저장해 두세요.` } : null;
}

export function buildPortfolioBackup(snapshot = {}, meta = {}) {
  const contents = {
    positions: Array.isArray(snapshot.positions) ? snapshot.positions : [],
    ledger: snapshot.ledger && typeof snapshot.ledger === 'object' ? snapshot.ledger : null,
    fxLegs: Array.isArray(snapshot.fxLegs) ? snapshot.fxLegs : [],
    cash: snapshot.cash == null ? null : String(snapshot.cash),
    cashBalances: Array.isArray(snapshot.cashBalances) ? normalizeCashBalances(snapshot.cashBalances).map((row) => ({ ...row })) : null,
    assumptions: snapshot.assumptions && typeof snapshot.assumptions === 'object' ? { ...snapshot.assumptions } : {},
    journal: Array.isArray(snapshot.journal) ? snapshot.journal : [],
    trades: snapshot.trades && typeof snapshot.trades === 'object' ? normalizeJournal(snapshot.trades) : null,
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
  // v59.45 (PASS27): a well-formed file whose contents a normalizer cannot handle is a refused file, not an exception.
  try { return parseBackupData(data, deps); } catch (_) { return { ok: false, reason: 'invalid-contents' }; }
}

// v59.45 (PASS27 P27-IMPORT-01): what the import changed on the way in — rows dropped or a cost left unknown — so the
// confirmation can name it instead of showing only the counts that survived.
function positionAdjustments(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const kept = sanitizePositions(list);
  const costUnknown = kept.filter((p) => !('cost' in p)).length;
  return { positionsDropped: list.length - kept.length, positionsCostUnknown: costUnknown };
}

// The shell (js/aio-workspace.js importPortfolio) names these in the confirmation.
function parseBackupData(data, deps) {
  if (Array.isArray(data)) {
    const positions = sanitizePositions(data);
    if (!positions.length) return { ok: false, reason: 'no-valid-positions' };
    return { ok: true, kind: 'positions', contents: { positions }, counts: countBackupContents({ positions }), adjustments: positionAdjustments(data) };
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
    cashBalances: sanitizeCashBalances(raw),
    assumptions: sanitizeAssumptions(raw.assumptions, deps),
    journal: sanitizeJournal(raw.journal),
    trades: raw.trades && typeof raw.trades === 'object' ? normalizeJournal(raw.trades) : null,
    watchlists,
    activeWatchlistId: activeId
  };
  const counts = countBackupContents(contents);
  if (counts.total === 0) return { ok: false, reason: 'empty-bundle' };
  const rawLedgerRows = raw.ledger && typeof raw.ledger === 'object'
    ? (Array.isArray(raw.ledger.transactions) ? raw.ledger.transactions.length : 0) + (Array.isArray(raw.ledger.valuations) ? raw.ledger.valuations.length : 0) : 0;
  const adjustments = { ...positionAdjustments(raw.positions), ledgerDropped: Math.max(0, rawLedgerRows - counts.ledgerEntries) };
  return { ok: true, kind: 'bundle', contents, counts, adjustments, exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : null };
}
