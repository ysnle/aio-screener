// v57.81 (owner 2026-10-15: "단순 내부 데이터베이스에 등록만 한다고 끝이 아니야"): a US-listed symbol outside the published
// screener universe is read on demand with the producer's own functions — the 1y daily chart through the same
// completed-session rows and factor row (src/domain/screener/price-factors.js), the SEC annual record through the same
// normalizer and row fields (src/domain/fundamental/sec-normalize.js, sec-row-fields.js), the same screener provider
// normalization, and the same factor-rank model placed against the current published universe. Nothing here runs at
// boot: consumers ask for one symbol, results are cached for the session, at most two symbols load at once, and a
// symbol that is neither a registered name nor in the US listing directory is never fetched. A missing input stays
// missing (no estimate); the placement is labelled as computed at its own time, outside the published ranking.
import { isListedUsSymbol } from './us-listings.js';
import { dailyRowsFromYahooChart, priceHistoryFromRows, priceFactorRow } from '../domain/screener/price-factors.js';
import { normalizeSecCompanyFacts } from '../domain/fundamental/sec-normalize.js';
import { reconcileSecRecord } from '../domain/fundamental/sec-report.js';
import { secFundamentalRowFields } from '../domain/fundamental/sec-row-fields.js';
import { createScreenerProvider } from './providers/screener.js';
import { computeFactorRanks } from '../domain/screener/factor-ranks.js';
import { SIC_SECTOR_SOURCE, secClassification } from '../domain/fundamental/sic-sector.js';

export const ON_DEMAND_MODEL_VERSION = 'out-of-universe-read.v1';
export const ON_DEMAND_MAX_CONCURRENT = 2;
const MAX_ENTRIES = 40;
const RETRY_AFTER_MS = 60_000;
const SEC_FACTS_BASE = 'https://data.sec.gov/api/xbrl/companyfacts/CIK';
const SEC_SUBMISSIONS_BASE = 'https://data.sec.gov/submissions/CIK';

// The factor families of the ranking model and the row inputs each one reads (factor-ranks.js momRaw … kalmanRaw).
export const FACTOR_INPUTS = Object.freeze({
  momentum: Object.freeze({ label: '모멘텀', fields: ['ret1m', 'ret3m', 'ret6m'] }),
  trend: Object.freeze({ label: '추세', fields: ['pctSma50', 'pctSma200'] }),
  lowvol: Object.freeze({ label: '낮은 변동성', fields: ['vol'] }),
  size: Object.freeze({ label: '규모', fields: ['mcap'] }),
  value: Object.freeze({ label: '가치', fields: ['pe', 'pb'] }),
  quality: Object.freeze({ label: '수익성', fields: ['roe', 'margin', 'revGrowth'] }),
  kalman: Object.freeze({ label: '추세 속도', fields: ['kalmanVelConf', 'kalmanVel'] })
});

/** A US listing symbol shape this reader may fetch (not a KRX code, index, FX pair or crypto pair). */
export function onDemandEligibleSymbol(symbol) {
  const id = String(symbol || '').trim().toUpperCase();
  return /^[A-Z][A-Z0-9.\-]{0,9}$/.test(id) && !/\.(KS|KQ|T|TW|TWO)$/.test(id) && !/-USD$/.test(id) ? id : null;
}

// The chart transport returns parallel arrays; the producer's row builder reads the provider's chart.result shape.
export function chartResultFromTransport(response) {
  if (!response || !response.meta || !Array.isArray(response.timestamps)) return null;
  return { meta: response.meta, timestamp: response.timestamps,
    indicators: { quote: [{ close: response.closes, high: response.highs, low: response.lows, volume: response.volumes, open: response.opens }],
      ...(Array.isArray(response.adjCloses || response.adjustedCloses) ? { adjclose: [{ adjclose: response.adjCloses || response.adjustedCloses }] } : {}) } };
}

/** The published-artifact factor row for one symbol from its chart (and SEC record when one is supplied). */
export function buildOnDemandArtifactRow(symbol, chartResult, { secFacts = null, secSubmissions = null, etf = false, nowMs = Date.now() } = {}) {
  const id = onDemandEligibleSymbol(symbol);
  if (!id || !chartResult || String(chartResult.meta?.symbol || '').toUpperCase() !== id) return { raw: null, sec: null, secStatus: 'not-read' };
  const computedAt = new Date(nowMs).toISOString();
  const fetched = dailyRowsFromYahooChart(chartResult, { fetchedAt: computedAt });
  const history = priceHistoryFromRows(id, fetched, { providerMeta: fetched.meta, nullCloseDates: fetched.nullCloseDates, market: 'us', nowMs });
  const raw = priceFactorRow(history, { computedAt });
  if (!raw) return { raw: null, sec: null, secStatus: 'not-read', history };
  if (etf) return { raw, sec: null, secStatus: 'not-applicable', history };
  if (!secFacts) return { raw, sec: null, secStatus: 'not-read', history };
  // The producer's price hint: the last adjusted close of the same series (raw close when no adjusted series).
  const series = Array.isArray(history.adjCloses) && history.adjCloses.length ? history.adjCloses : history.closes;
  const last = Array.isArray(series) ? series[series.length - 1] : null;
  const price = typeof last === 'number' && Number.isFinite(last) && last > 0 ? last : null;
  const record = normalizeSecCompanyFacts(id, secFacts, price, secSubmissions);
  if (!record) return { raw, sec: null, secStatus: 'no-annual-facts', history };
  const reconciled = reconcileSecRecord(record);
  const fields = secFundamentalRowFields(reconciled, { price, dollarVolume30d: raw.dollarVolume30d, factorSessionDate: raw.factorSessionDate, nowMs });
  return { raw: fields ? { ...raw, ...fields } : raw, sec: reconciled, secStatus: fields ? 'ready' : 'no-current-fields', history };
}

// The record the 재무 공시 views read (the runtime summary's shape): point-in-time observations stay out.
export function secSummaryRecord(record) {
  if (!record) return null;
  const { pit, ...rest } = record;
  return { ...rest, ...(pit && typeof pit === 'object' ? { pit: Object.fromEntries(Object.entries(pit).filter(([key]) => key !== 'observations')) } : {}) };
}

/** Canonical screener row for the candidate through the same provider normalization the published rows use. */
export async function canonicalOnDemandRow(symbol, raw, { name = null, classification = null, computedAt, readLiveData = () => ({}), now = () => Date.now() } = {}) {
  const id = onDemandEligibleSymbol(symbol);
  if (!id || !raw) return null;
  // v57.83: the SEC SIC classification (when it maps) is the row's sector, through the same identity field the
  // published universe uses, so the sector read and the in-sector placement work like a published row.
  const sector = classification?.sector || null;
  const httpClient = { async requestJson(url) {
    if (/screener-universe\.json/.test(url)) return { ok: true, data: { universe: [{ sym: id, name: name || id, ...(sector ? { sector } : {}) }] } };
    if (/screener\.json/.test(url)) return { ok: true, data: { asOf: computedAt, factorObservedAt: raw.factorObservedAt || null, data: { [id]: raw } } };
    return { ok: false, error: 'NOT_REQUESTED' };
  } };
  const provider = createScreenerProvider({ httpClient, readLiveData, clock: { now, iso: () => new Date(now()).toISOString() }, yieldImpl: () => Promise.resolve() });
  const state = await provider.readCurrent({ refresh: true });
  const row = (state?.rows || []).find((item) => item?.sym === id);
  return row ? { ...row, ...(classification ? { sic: classification.sic, sector: sector || row.sector || null, ...(sector ? { sectorSource: SIC_SECTOR_SOURCE } : {}), industry:classification.description ? `${classification.description} (SEC SIC ${classification.sic})` : `SEC SIC ${classification.sic}`, classification } : {}),
    identitySource: 'on-demand:us-listing', onDemand: Object.freeze({ model: ON_DEMAND_MODEL_VERSION, computedAt }) } : null;
}

/** Where the candidate would sit in the current universe, by the same ranking model and inputs. */
export function placeAgainstUniverse(candidate, universeRows, { weights = null, weightsPolicy = null, regimeLabel = null, fundamentalCoveragePct = 0, fmpOk = false, nowMs = Date.now() } = {}) {
  const id = String(candidate?.sym || '').toUpperCase();
  if (!id) return null;
  const peers = (Array.isArray(universeRows) ? universeRows : []).filter((row) => String(row?.sym || row?.symbol || '').toUpperCase() !== id);
  const result = computeFactorRanks({ rows: [...peers, candidate], weights, weightsPolicy, regimeLabel, fundamentalCoveragePct, fmpOk, now: nowMs, inputVersion: `${ON_DEMAND_MODEL_VERSION}:${id}` });
  const own = (result?.rows || []).find((row) => row.sym === id) || null;
  const population = result?.byMarket?.US || result;
  const evidence = own?.factorEvidence || {};
  const inputs = Object.entries(FACTOR_INPUTS).map(([key, spec]) => {
    const present = spec.fields.filter((field) => typeof candidate[field] === 'number' && Number.isFinite(candidate[field]));
    const active = (population?.activeFactors || []).includes(key);
    const usable = own?.factorScores?.[key] != null;
    // v59.45 (pipeline review P25-READ-02): the model's own reason a family is off (coverage floor vs. weight 0) and why
    // no rank came out travel with the placement, so the reading does not name one cause for all of them.
    return Object.freeze({ key, label: spec.label, active, usable, present, missing: spec.fields.filter((field) => !present.includes(field)),
      blockedReasons: evidence[key]?.blockedReasons ? [...evidence[key].blockedReasons] : [],
      inactiveReason: active ? null : population?.inactiveFactorReasons?.[key] || result?.inactiveFactorReasons?.[key] || null });
  });
  const rank = own?.rank ?? null;
  return Object.freeze({
    available: !!(result?.available && own),
    rank,
    unavailableReason: rank != null ? null : !result?.available ? 'model-unavailable' : !own ? 'not-ranked' : own.rankingEligibility || 'not-ranked',
    quantSignal: own?.quantSignal || null,
    rankingEligibility: own?.rankingEligibility || null,
    factorScores: own?.factorScores || null,
    missingFactors: own?.missingFactors || [],
    factorCoverage: own?.factorCoverage ?? null,
    ranked: population?.ranked ?? null,
    activeFactors: population?.activeFactors || [],
    appliedFactorWeights: population?.appliedFactorWeights || null,
    modelVersion: result?.modelVersion || null,
    inputs: Object.freeze(inputs),
    computedAt: new Date(nowMs).toISOString(),
    sessionDate: candidate.factorSessionDate || null
  });
}

const universeBound = (status) => status === 'ready' || status === 'in-universe';
const fnv = (text, hash = 0x811c9dc5) => {
  for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return hash;
};
const FINGERPRINT_FIELDS = Object.freeze(['factorSessionDate', 'price', ...new Set(Object.values(FACTOR_INPUTS).flatMap((spec) => spec.fields))]);
/** Identity of the published universe a read is placed against: every row's symbol, session and ranking inputs. */
export function universeFingerprint(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const lines = list.map((row) => [String(row?.sym || row?.symbol || '').toUpperCase(), ...FINGERPRINT_FIELDS.map((field) => row?.[field] ?? '')].join(':')).sort();
  let hash;
  for (const line of lines) hash = fnv(`${line}\n`, hash);
  return `${list.length}:${(hash ?? 0).toString(36)}`;
}
function inputsFingerprint(inputs) {
  try { return fnv(JSON.stringify(inputs ?? {})).toString(36); } catch (_) { return 'unreadable'; }
}

function queueFor(state) {
  return (task) => new Promise((resolve, reject) => {
    const run = () => { state.active += 1; Promise.resolve().then(task).then(resolve, reject).finally(() => { state.active -= 1; const next = state.waiting.shift(); if (next) next(); }); };
    if (state.active < ON_DEMAND_MAX_CONCURRENT) run(); else state.waiting.push(run);
  });
}

/**
 * One session reader per root. `fetchChart(id)` returns the chart transport object, `fetchJson(url)` parsed JSON
 * through the established relay, `universeRows()` the canonical published rows, `rankInputs()` the ranking inputs
 * the screener uses, `isKnown(id)` the registered-name check. All are injected so the reader is testable.
 */
export function createOnDemandSymbolReader({ fetchChart, fetchJson = null, isListed = isListedUsSymbol, isKnown = () => false, universeRows = () => [], rankInputs = () => ({}), readLiveData = () => ({}), now = () => Date.now(), onRecord = () => {} } = {}) {
  const entries = new Map();
  const queueState = { active: 0, waiting: [] };
  const enqueue = queueFor(queueState);
  // v58.63 (architecture audit D3): a ready / in-universe record was kept for the whole session, so after the next
  // published close or universe refresh a symbol kept its old row, SEC summary and placement against the old peers.
  // Records carry the universe they were read against and are read again once that changes.
  // v59.45 (pipeline review P25-CACHE-01/P3-RUNTIME-02): the key was row count + latest session, so a same-size
  // membership swap or a same-day correction kept the old in-universe answer and placement. It is now a fingerprint
  // of every row's symbol, session and ranking inputs (plus the ranking weights for a placed record), taken from the
  // rows the read itself used, so a universe that changes mid-read does not label the old result as current.
  const currentRows = () => { try { return universeRows() || []; } catch (_) { return []; } };
  const currentInputs = () => { try { return rankInputs() || {}; } catch (_) { return {}; } };
  const keyFor = (status, rows, inputs) => `${universeFingerprint(rows)}${status === 'ready' ? `|${inputsFingerprint(inputs)}` : ''}`;
  const isCurrent = (saved) => saved?.universe != null && saved.universe === keyFor(saved.record?.status, currentRows(), currentInputs());
  const remember = (id, record, universe = null) => {
    entries.delete(id);
    entries.set(id, { at: now(), record, promise: null, universe });
    while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value);
    try { onRecord(record); } catch (_) { /* a consumer's render error does not poison the cache */ }
    return record;
  };
  async function read(id) {
    const rows = currentRows();
    const inputs = currentInputs();
    const record = await readAgainst(id, rows, inputs);
    return { record, universe: keyFor(record?.status, rows, inputs) };
  }
  async function readAgainst(id, rows, inputs) {
    const base = { symbol: id, model: ON_DEMAND_MODEL_VERSION };
    // Without the published universe there is nothing to place against; asked again once it has loaded.
    if (!rows.length) return { ...base, status: 'universe-unavailable' };
    if (rows.some((row) => String(row?.sym || row?.symbol || '').toUpperCase() === id)) return { ...base, status: 'in-universe' };
    const listing = await Promise.resolve(isListed(id)).catch(() => ({ listed: false }));
    const known = (() => { try { return !!isKnown(id); } catch (_) { return false; } })();
    if (!listing?.listed && !known) return { ...base, status: 'not-listed', checkedAt: new Date(now()).toISOString() };
    const response = await Promise.resolve(fetchChart(id)).catch(() => null);
    const chartResult = chartResultFromTransport(response);
    if (!chartResult) return { ...base, status: 'unavailable', reason: 'chart-unavailable', listing };
    const etf = listing?.etf === true || String(chartResult.meta?.instrumentType || '').toUpperCase() === 'ETF';
    const cik = listing?.cik || null;
    let secFacts = null, secSubmissions = null, secStatus = etf ? 'not-applicable' : cik ? 'not-read' : 'no-cik';
    if (!etf && cik && typeof fetchJson === 'function') {
      [secFacts, secSubmissions] = await Promise.all([
        Promise.resolve(fetchJson(`${SEC_FACTS_BASE}${cik}.json`)).catch(() => null),
        Promise.resolve(fetchJson(`${SEC_SUBMISSIONS_BASE}${cik}.json`)).catch(() => null)
      ]);
      if (!secFacts) secStatus = 'unavailable';
    }
    const nowMs = now();
    const built = buildOnDemandArtifactRow(id, chartResult, { secFacts, secSubmissions, etf, nowMs });
    if (!built.raw) return { ...base, status: 'unavailable', reason: 'too-few-completed-sessions', listing };
    const computedAt = new Date(nowMs).toISOString();
    // The directory's security name carries the share description ("… - Common Stock"); the issuer name is shown.
    const name = String(listing?.name || chartResult.meta?.longName || chartResult.meta?.shortName || '')
      .replace(/\s*-?\s*(Common Stock|Common Shares|Ordinary Shares|Class [A-C] Common Stock)\s*$/i, '').trim() || null;
    const classification = etf ? null : secClassification(secSubmissions);
    const row = await canonicalOnDemandRow(id, built.raw, { name, classification, computedAt, readLiveData, now });
    if (!row) return { ...base, status: 'unavailable', reason: 'normalization-failed', listing };
    let placement = null;
    try { placement = placeAgainstUniverse(row, rows, { ...inputs, nowMs }); } catch (_) { placement = null; }
    return Object.freeze({ ...base, status: 'ready', computedAt, listing: listing?.listed ? listing : null, registeredName: known, classification,
      name, etf, row, placement, sec: secSummaryRecord(built.sec), secStatus: built.sec ? built.secStatus : secStatus,
      sessionDate: row.factorSessionDate || null, barCount: built.history?.closes?.length || 0,
      // The factor row's own last completed close (not a live price), for holdings valued at the close while a quote waits.
      lastClose: Number.isFinite(built.raw.price) && built.raw.price > 0 && built.raw.factorSessionDate ? Object.freeze({ price: built.raw.price, date: built.raw.factorSessionDate }) : null });
  }
  return Object.freeze({
    // A ready / in-universe record read against an earlier universe is not handed out; the caller's load reads it again.
    peek(symbol) {
      const id = onDemandEligibleSymbol(symbol);
      const saved = id ? entries.get(id) : null;
      if (!saved?.record) return null;
      return universeBound(saved.record.status) && !saved.promise && !isCurrent(saved) ? null : saved.record;
    },
    load(symbol) {
      const id = onDemandEligibleSymbol(symbol);
      if (!id) return Promise.resolve(null);
      const saved = entries.get(id);
      if (saved?.promise) return saved.promise;
      if (saved?.record && ((universeBound(saved.record.status) && isCurrent(saved))
        || (saved.record.status !== 'universe-unavailable' && !universeBound(saved.record.status) && now() - saved.at < RETRY_AFTER_MS))) return Promise.resolve(saved.record);
      const promise = enqueue(() => read(id)).catch(() => ({ record: { symbol: id, model: ON_DEMAND_MODEL_VERSION, status: 'unavailable', reason: 'read-failed' }, universe: null }))
        .then(({ record, universe }) => remember(id, record, universe));
      entries.set(id, { at: now(), record: saved?.record || null, promise });
      return promise;
    },
    stats() { return { entries: entries.size, active: queueState.active, waiting: queueState.waiting.length }; }
  });
}
