/**
 * v58.71 (owner 2026-10-23): research-channel signals joined to screener rows. The Telegram digest publishes
 * `signals` (scripts/lib/telegram-signals.mjs): target-price and rating actions and reported quarters against
 * estimates, each with the ticker the post itself wrote. A row reads only what was reported about its own symbol in
 * the digest's 14-day window; a row the channels never mentioned has no value (자료 없음), never zero.
 *
 * These are relayed observations, not this app's measurement — conditions built on them narrow the table only.
 */

export const CHANNEL_SIGNAL_KEYS = Object.freeze(['tgPtRaises', 'tgPtCuts', 'tgUpgrades', 'tgEarnings']);

let cache = { source: null, index: new Map() };

/** symbol → { tgPtRaises, tgPtCuts, tgUpgrades, tgEarnings, latestPt } from the digest signals. */
export function channelSignalIndex(signals) {
  if (cache.source === signals) return cache.index;
  const index = new Map();
  const entry = (sym) => {
    if (!index.has(sym)) index.set(sym, { tgPtRaises: 0, tgPtCuts: 0, tgUpgrades: 0, tgEarnings: null, latestPt: null, earningsDate: null });
    return index.get(sym);
  };
  for (const signal of Array.isArray(signals) ? signals : []) {
    const sym = String(signal?.ticker || '').toUpperCase();
    if (!sym) continue;
    if (signal.kind === 'pt') {
      const row = entry(sym);
      // A new coverage with a buy-side rating counts as a raise from nothing; a cut is a cut whatever the rating.
      if (signal.direction === 'raise' || (signal.direction === 'initiate' && signal.rating === 'buy')) row.tgPtRaises += 1;
      if (signal.direction === 'cut') row.tgPtCuts += 1;
      if (signal.ratingAction === 'upgrade') row.tgUpgrades += 1;
      if (!row.latestPt || String(signal.date || '') > String(row.latestPt.date || '')) row.latestPt = signal;
    } else if (signal.kind === 'earnings') {
      const row = entry(sym);
      if (row.earningsDate && String(signal.date || '') <= row.earningsDate) continue;
      const parts = [signal.revenue, signal.eps].filter(Boolean);
      row.tgEarnings = parts.includes('miss') ? 'miss' : parts.includes('beat') ? 'beat' : parts.length ? 'inline' : null;
      row.earningsDate = String(signal.date || '');
    }
  }
  cache = { source: signals, index };
  return index;
}

/** The value a custom condition reads, or null when the channels reported nothing about this row's symbol. */
export function channelSignalValue(signals, row, key) {
  const sym = String(row?.sym || row?.symbol || '').toUpperCase();
  const entry = sym ? channelSignalIndex(signals).get(sym) : null;
  return entry ? entry[key] ?? null : null;
}
