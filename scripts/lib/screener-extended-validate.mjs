// v57.81: semantic contract of the extended screener shard (public-data/screener-extended.json). Used by the
// refresh workflow before commit (with freshness) and by the CI contract gate (structure only).
import { EXTENDED_ROW_ENCODING, EXTENDED_SHARD_SCHEMA, expandShardRows, shardIdentityRows } from '../../src/data/screener-extended.js';

// Row keys every factor row carries (core and extended alike): lineage, session and price basis.
export const EXTENDED_REQUIRED_ROW_KEYS = Object.freeze([
  'observedAt', 'source', 'sourceKind', 'allowedUse', 'factorObservedAt', 'factorBarStart', 'factorSessionDate', 'factorSessionTimezone',
  'factorTimeBasis', 'factorComputedAt', 'factorQuality', 'factorBarCompleteness', 'priceBasis', 'currency', 'listingMarket', 'newsStatus'
]);
const FUNDAMENTAL_FIELDS = ['pe', 'pb', 'roe', 'margin', 'revGrowth'];

// coreOverlap 'note' (the committed-shard CI check): a core expansion lands one job before the shard drops the moved
// symbols, and the provider already reads core symbols from the core (src/data/providers/screener.js), so the overlap
// is reported, not failed. The producer's own pre-commit validation keeps 'error'.
export function validateExtendedShard(shard, { coreData = null, now = Date.now(), freshness = true, coverageFloor = 0.6, coreOverlap = 'error' } = {}) {
  const errors = [];
  const notes = [];
  if (!shard || typeof shard !== 'object') return { ok: false, errors: ['shard missing or not an object'], rows: 0 };
  if (shard.schemaVersion !== EXTENDED_SHARD_SCHEMA) errors.push(`schemaVersion must be ${EXTENDED_SHARD_SCHEMA}`);
  if (shard.rowEncoding !== EXTENDED_ROW_ENCODING) errors.push(`rowEncoding must be ${EXTENDED_ROW_ENCODING}`);
  const data = expandShardRows(shard);
  const symbols = Object.keys(data);
  const identity = shardIdentityRows(shard);
  const identitySymbols = new Set(identity.map((row) => row.sym));
  const universe = Number(shard.universe);
  if (!Number.isInteger(universe) || universe !== identity.length) errors.push(`universe (${shard.universe}) must equal the identity row count (${identity.length})`);
  if (Number(shard.ok) !== symbols.length) errors.push(`ok must equal data row count (${shard.ok} != ${symbols.length})`);
  if (universe > 0 && symbols.length / universe < coverageFloor) errors.push(`price coverage below ${coverageFloor * 100}% (${symbols.length}/${universe})`);
  const orphan = symbols.filter((sym) => !identitySymbols.has(sym));
  if (orphan.length) errors.push(`data rows without an identity row: ${orphan.slice(0, 5).join(',')}`);
  const unfetched = Array.isArray(shard.unfetchedSymbols) ? shard.unfetchedSymbols : null;
  if (!unfetched || unfetched.length !== identity.length - symbols.length) errors.push('unfetchedSymbols must list every identity row without data');
  if (coreData && typeof coreData === 'object') {
    const duplicated = symbols.filter((sym) => Object.prototype.hasOwnProperty.call(coreData, sym));
    if (duplicated.length) (coreOverlap === 'note' ? notes : errors).push(`core symbols duplicated in the shard: ${duplicated.slice(0, 5).join(',')}`);
  }
  const membershipTags = new Set(['RUSSELL2000', 'NASDAQ']);
  const badMembership = identity.filter((row) => !Array.isArray(row.membership) || !row.membership.length || row.membership.some((tag) => !membershipTags.has(tag)));
  if (badMembership.length) errors.push(`identity rows need RUSSELL2000/NASDAQ membership: ${badMembership.slice(0, 5).map((row) => row.sym).join(',')}`);
  const contract = shard.rankingContract || {};
  if (contract.allowedUse !== 'research-relative-ranking-only' || contract.tradingSignal !== false || contract.contract !== 'extended-universe') errors.push('extended research-only ranking contract missing');
  if (!shard.factorSessionDateByMarket || typeof shard.factorSessionDateByMarket !== 'object') errors.push('factorSessionDateByMarket missing');
  if (shard.factorTimeBasis !== 'bar-start') errors.push('factorTimeBasis must be bar-start');
  if (!shard.membership?.asOf || !shard.membership?.status) errors.push('membership asOf/status missing');
  // Schema parity with the core artifact: no field the core row schema does not have; every lineage key present.
  const coreKeys = coreData ? new Set(Object.values(coreData).flatMap((row) => Object.keys(row || {}))) : null;
  for (const sym of symbols) {
    const row = data[sym];
    if ('price' in row) { errors.push(`row ${sym} publishes raw price (P715)`); break; }
    const missing = EXTENDED_REQUIRED_ROW_KEYS.filter((key) => !(key in row));
    if (missing.length) { errors.push(`row ${sym} lacks ${missing.join(',')}`); break; }
    if (!Number.isFinite(Number(row.ret1m)) && !Number.isFinite(Number(row.rsi))) { errors.push(`row ${sym} has no derived factors`); break; }
    if (coreKeys) {
      const extra = Object.keys(row).filter((key) => !coreKeys.has(key));
      if (extra.length) { errors.push(`row ${sym} has fields outside the core row schema: ${extra.join(',')}`); break; }
    }
    if (FUNDAMENTAL_FIELDS.some((key) => Number.isFinite(Number(row[key]))) && (!row.fundamentalSource || !row.fundamentalModel || !row.fundamentalObservedAt)) {
      errors.push(`row ${sym} fundamentals lack source/model/observedAt lineage`); break;
    }
  }
  if (freshness) {
    const generated = Date.parse(shard.asOf || '');
    if (!Number.isFinite(generated) || now - generated < -15 * 60 * 1000 || now - generated > 2 * 86400000) errors.push('asOf is outside the 2-day processing freshness budget');
    const session = shard.factorSessionDateByMarket?.US;
    if (!session || now - Date.parse(`${session}T00:00:00Z`) > 5 * 86400000) errors.push('US factor session is older than 5 days');
  }
  return { ok: errors.length === 0, errors, notes, rows: symbols.length, universe, identity: identity.length };
}
