// 13F share counts are as filed: a stock split multiplies every filer's count and a CUSIP change moves a holding
// to a new row key. Both read as trading in a share-delta comparison. One row cannot tell a split from a purchase
// (value / shares is the security's price move, the same for every filer), so a split is decided across the filers
// of one CUSIP and period, and a CUSIP change is paired inside one manager's filing. Pure; no DOM, no I/O.
import { readNumber as finite } from '../shared/number.js';

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const cusipOf = (row) => String(row?.cusipNormalized || row?.cusip || '').replace(/\s+/g, '').toUpperCase();
const securityPeriodKey = (row) => `${cusipOf(row)}|${row?.reportPeriod || ''}`;
const isShareRow = (row) => row && !row.putCall && String(row.shareType || 'SH').toUpperCase() === 'SH';

export const SPLIT_SHARE_RATIO = Object.freeze({ up: 1.5, down: 0.67 });
export const SPLIT_PRICE_RATIO = Object.freeze({ down: 0.6, up: 1.67 });

/**
 * Securities whose share count moved together across filers while the price per share moved the other way.
 * @param {Array<object>} comparisons comparison rows of several managers (shares, priorShares, value, priorValue)
 * @returns {Map<string, {shareRatio:number, priceRatio:number, filers:number}>} keyed by `${cusip}|${reportPeriod}`
 */
export function detectSplitSuspects(comparisons = [], { minFilers = 3 } = {}) {
  const bySecurity = new Map();
  for (const row of Array.isArray(comparisons) ? comparisons : []) {
    if (!isShareRow(row) || !cusipOf(row) || !row.reportPeriod) continue;
    const shares = finite(row.shares), priorShares = finite(row.priorShares), value = finite(row.value), priorValue = finite(row.priorValue);
    if (!(shares > 0 && priorShares > 0 && value > 0 && priorValue > 0)) continue;
    const key = securityPeriodKey(row);
    if (!bySecurity.has(key)) bySecurity.set(key, new Map());
    // One vote per manager: a manager split across row keys must not outvote the others.
    bySecurity.get(key).set(row.managerId, { shareRatio: shares / priorShares, priceRatio: (value / priorValue) / (shares / priorShares) });
  }
  const suspects = new Map();
  for (const [key, byManager] of bySecurity) {
    if (byManager.size < minFilers) continue;
    const list = [...byManager.values()];
    const shareRatio = median(list.map((item) => item.shareRatio));
    const priceRatio = median(list.map((item) => item.priceRatio));
    const forward = shareRatio >= SPLIT_SHARE_RATIO.up && priceRatio <= SPLIT_PRICE_RATIO.down;
    const reverse = shareRatio <= SPLIT_SHARE_RATIO.down && priceRatio >= SPLIT_PRICE_RATIO.up;
    if (forward || reverse) suspects.set(key, { shareRatio, priceRatio, filers: byManager.size });
  }
  return suspects;
}

const NAME_NOISE = /\b(INCORPORATED|INC|CORPORATION|CORP|COMPANY|CO|LIMITED|LTD|PLC|HOLDINGS|HOLDING|HLDGS|HLDG|GROUP|GRP|INTERNATIONAL|INTL|NEW|DEL|THE|N V|NV|S A|SA|AG)\b/g;
export function normalizeIssuerName(name) {
  return String(name || '').toUpperCase().replace(/\s*\/[A-Z]{2,3}\/?\s*$/, '').replace(/[^A-Z0-9 ]+/g, ' ').replace(NAME_NOISE, ' ').replace(/\s+/g, ' ').trim();
}

// Common stock is filed as COM, COMMON STOCK, COMMON SHARES, SHS, ORD; any other class keeps its own text.
export function normalizeShareClass(title) {
  const text = String(title || '').toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  return /^(COM|COMMON|COMMON STOCK|COMMON SHARES|COM STK|COM SHS|SHS|ORD|ORD SHS|ORDINARY SHARES|COM NEW|CAP STK)$/.test(text) ? 'COM' : text;
}

/**
 * Inside one manager and period: a non-option EXITED row and a NEW row of the same issuer name and share class,
 * each the only such row on its side, are one holding under two CUSIPs.
 * @returns {Map<string, object>} row key → the counterpart row (both directions)
 */
export function pairCusipChanges(comparisons = []) {
  const groups = new Map();
  for (const row of Array.isArray(comparisons) ? comparisons : []) {
    const stock = row && !row.putCall;
    if (!stock || (row.action !== 'NEW' && row.action !== 'EXITED')) continue;
    const name = normalizeIssuerName(row.issuer);
    if (!name || !cusipOf(row)) continue;
    const key = [row.managerId || '', row.reportPeriod || '', String(row.shareType || '').toUpperCase(), name, normalizeShareClass(row.titleOfClass)].join('|');
    if (!groups.has(key)) groups.set(key, { NEW: [], EXITED: [] });
    groups.get(key)[row.action].push(row);
  }
  const pairs = new Map();
  for (const { NEW, EXITED } of groups.values()) {
    if (NEW.length !== 1 || EXITED.length !== 1 || cusipOf(NEW[0]) === cusipOf(EXITED[0])) continue;
    pairs.set(NEW[0].key, EXITED[0]);
    pairs.set(EXITED[0].key, NEW[0]);
  }
  return pairs;
}

/**
 * Stamp one manager's comparison rows. `corporateAction` is 'SPLIT_SUSPECT' (every share comparison of a security the
 * filers agree was split) or 'CUSIP_CHANGE' (a paired exit and entry, with the other row's CUSIP and share count).
 */
export function annotateCorporateActions(comparisons = [], splitSuspects = new Map()) {
  const pairs = pairCusipChanges(comparisons);
  return (Array.isArray(comparisons) ? comparisons : []).map((row) => {
    const counterpart = pairs.get(row?.key);
    if (counterpart) {
      const exited = row.action === 'EXITED';
      return { ...row, corporateAction: 'CUSIP_CHANGE', counterpartCusip: cusipOf(counterpart), counterpartShares: exited ? counterpart.shares : counterpart.priorShares };
    }
    if (splitSuspects.has(securityPeriodKey(row)) && finite(row.shares) > 0 && finite(row.priorShares) > 0 && String(row.shareType || 'SH').toUpperCase() === 'SH') {
      return { ...row, corporateAction: 'SPLIT_SUSPECT' };
    }
    return row;
  });
}

/** A stamp only counts on the action it explains; anything else falls back to the filed action. */
export function corporateActionOf(row) {
  const stamp = row?.corporateAction;
  if (stamp === 'CUSIP_CHANGE') return row.action === 'NEW' || row.action === 'EXITED' ? stamp : null;
  if (stamp === 'SPLIT_SUSPECT') return row.action === 'INCREASED' || row.action === 'REDUCED' || row.action === 'UNCHANGED' ? stamp : null;
  return null;
}
