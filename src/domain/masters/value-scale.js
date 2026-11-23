import { readNumber as finite } from '../shared/number.js';

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const comparable = (row) => row && row.shareType === 'SH' && !row.putCall && finite(row.value) > 0 && finite(row.shares) > 0;
const periodOf = (row, fallback = null) => row?.reportPeriod || fallback || null;
const cusipOf = (row) => String(row?.cusipNormalized || row?.cusip || '').toUpperCase();

/**
 * @param {Array<object>} rows holdings rows from several filers (managerId, reportPeriod, cusip, value, shares)
 * A row is compared only when at least `minPeers` other filers report the same CUSIP and period.
 * @returns {Map<string, {ratio:number, comparedRows:number}>} keyed by `${managerId}|${period}`
 */
export function detectValueScaleSuspects(rows = [], { minRows = 2, minPeers = 2, low = 1 / 200, high = 200 } = {}) {
  const byKey = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!comparable(row) || !cusipOf(row) || !periodOf(row)) continue;
    const key = `${cusipOf(row)}|${periodOf(row)}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push({ managerId: row.managerId, price: row.value / row.shares });
  }
  const ratios = new Map();
  for (const [key, list] of byKey) {
    const period = key.split('|')[1];
    for (const item of list) {
      const peers = list.filter((other) => other.managerId !== item.managerId).map((other) => other.price);
      if (peers.length < minPeers) continue;
      if (peers.length === 2 && Math.max(...peers) / Math.min(...peers) > 2) continue;
      const managerKey = `${item.managerId}|${period}`;
      if (!ratios.has(managerKey)) ratios.set(managerKey, []);
      ratios.get(managerKey).push(item.price / median(peers));
    }
  }
  const suspects = new Map();
  for (const [managerKey, list] of ratios) {
    if (list.length < minRows) continue;
    const ratio = median(list);
    const off = list.filter((value) => value < low || value > high).length;
    // Most of the filing's comparable rows must be off by the same order of magnitude, not one odd line.
    if ((ratio < low || ratio > high) && off / list.length >= 0.6) suspects.set(managerKey, { ratio, comparedRows: list.length });
  }
  return suspects;
}

/** The published reviews of a runtime summary, in the same `${managerId}|${period}` map detectValueScaleSuspects returns. */
export function valueScaleReviewsOf(summary) {
  const reviews = new Map();
  for (const manager of Array.isArray(summary?.managers) ? summary.managers : []) {
    const review = manager?.verification?.valueScaleReview;
    const period = manager?.verification?.reportPeriod;
    if (manager?.id && period && finite(review?.ratio) > 0) reviews.set(`${manager.id}|${period}`, { ratio: review.ratio, comparedRows: finite(review.comparedRows) || 0 });
  }
  return reviews;
}

/** Withhold dollar amounts of rows that belong to a filing under scale review. Shares stay as filed. */
export function withholdSuspectValues(rows = [], suspects = new Map(), { period = null, managerId = null } = {}) {
  if (!suspects?.size || !Array.isArray(rows)) return rows;
  return rows.map((row) => {
    const review = suspects.get(`${row?.managerId || managerId}|${periodOf(row, period)}`);
    // Idempotent: a shard that finished before detection is withheld again, and must keep its first as-filed memo.
    if (!review || row?.valueScaleStatus === 'SCALE_REVIEW') return row;
    return { ...row, reportedValueAsFiled: row.value ?? null, value: null, priorValue: null, valueDelta: null, valueScaleStatus: 'SCALE_REVIEW' };
  });
}

/**
 * Managers with at least one filing under review. Detection needs same-CUSIP peers in the same period, which only
 * the current quarter has on the page, but a filer keeps its unit across quarters: the same ~1,000x ratio appears in
 * every earlier quarter of the same manager in history-holdings.json. Dollar amounts of those managers are withheld
 * wherever a prior quarter, a reverse-lookup index row or an issuer aggregate would otherwise show them.
 */
export function managersUnderScaleReview(suspects = new Map()) {
  return new Set([...(suspects?.keys?.() || [])].map((key) => String(key).split('|')[0]).filter(Boolean));
}

/** Withhold dollar amounts of every row that belongs to a manager under scale review, whatever its period. */
export function withholdManagerValues(rows = [], managers = new Set()) {
  if (!managers?.size || !Array.isArray(rows)) return rows;
  return rows.map((row) => (managers.has(row?.managerId) && row.valueScaleStatus !== 'SCALE_REVIEW'
    ? { ...row, reportedValueAsFiled: row.value ?? null, value: null, priorValue: null, valueDelta: null, valueScaleStatus: 'SCALE_REVIEW' }
    : row));
}

export function describeValueScaleCarryover() {
  return '이 운용사의 최신 신고는 금액 단위가 다른 신고와 어긋나 있어 금액을 보류 중입니다. 같은 운용사의 이전 분기도 같은 단위일 수 있어 금액·합계를 표시하지 않습니다. 주식 수와 행 수는 신고한 그대로입니다.';
}

export function describeValueScaleReview(review) {
  if (!review) return null;
  const factor = review.ratio < 1 ? Math.round(1 / review.ratio) : Math.round(review.ratio);
  const magnitude = factor >= 500 && factor <= 2000 ? '약 1,000배' : `약 ${factor.toLocaleString('en-US')}배`;
  return `이 신고의 금액은 같은 종목·같은 분기의 다른 신고와 비교해 주당 가격이 ${magnitude} ${review.ratio < 1 ? '작게' : '크게'} 계산됩니다(비교 가능 ${review.comparedRows}개 종목). 신고 원문의 금액 단위를 확인하기 전까지 금액·비중·합계를 표시하지 않습니다. 주식 수는 신고한 그대로입니다.`;
}
