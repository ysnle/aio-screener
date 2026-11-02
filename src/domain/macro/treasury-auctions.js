// v59.57 (X bookmarks 11/02, MrMarket89 10/27 follow-up): US Treasury coupon auction results. The 10/27 schedule
// brief read the 5-year auction (and the 2-year tail the day before) as the demand test for long rates; AIO had the
// release calendar and a "bond auction" headline class but no auction result. TreasuryDirect's public auction query
// (TA_WS securities/auctioned, keyless) publishes each result within minutes of the close: high yield, bid-to-cover,
// and the competitive par awarded to indirect bidders (foreign and domestic investors bidding through dealers),
// direct bidders and primary dealers. A tail (high yield minus the when-issued yield at the deadline) needs the
// when-issued quote, which no free source carries — so the reading compares each auction with the same tenor's own
// previous six instead, and says so. Nominal notes and bonds only (TIPS and FRN are other instruments).
// Pure: TA_WS rows in, rows and sentences out.

import { readNumber } from '../shared/number.js';
import { stampDay } from '../shared/session-date.js';

export const TREASURY_AUCTIONS_SCHEMA = 'treasury-auctions.v1';
export const AUCTION_TENORS = Object.freeze([2, 3, 5, 7, 10, 20, 30]);
// The comparison window: the same tenor's previous six results (about half a year of monthly auctions).
export const AUCTION_LOOKBACK = 6;
// A bid-to-cover 0.1 below the tenor's own recent mean, or an indirect share 5 points below it, is the line the
// reading calls weak (and the mirror image strong). Both are references, never a scenario condition.
export const AUCTION_RULES = Object.freeze({ btcGap: 0.1, indirectGapPp: 5, minPrior: 3 });

const num = (value) => { const n = readNumber(value); return Number.isFinite(n) ? n : null; };
const round = (value, digits) => (value == null ? null : Number(value.toFixed(digits)));

/** "9-Year 10-Month" → 10; "2-Year" → 2; a term that is not a coupon tenor → null. */
export function auctionTenor(term) {
  const match = String(term || '').match(/(\d+)-Year(?:\s+(\d+)-Month)?/i);
  if (!match) return null;
  const years = Number(match[1]) + (match[2] ? Number(match[2]) / 12 : 0);
  let best = null;
  for (const tenor of AUCTION_TENORS) if (best == null || Math.abs(tenor - years) < Math.abs(best - years)) best = tenor;
  return best != null && Math.abs(best - years) <= 0.5 ? best : null;
}

/** One TA_WS row → a compact result row, or null for a non-nominal, unpriced or unreadable row. */
export function auctionRow(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const kind = String(raw.type || raw.securityType || '');
  if (!/^(Note|Bond)$/.test(kind) || /yes/i.test(String(raw.floatingRate || '')) || /yes/i.test(String(raw.tips || raw.inflationIndexSecurity || ''))) return null;
  const date = stampDay(raw.competitiveAuctionCloseDate || raw.auctionDate);
  const tenor = auctionTenor(raw.securityTerm);
  const highYield = num(raw.highYield);
  const btc = num(raw.bidToCoverRatio);
  if (!date || tenor == null || highYield == null || btc == null) return null;
  const indirect = num(raw.indirectBiddersCompetitiveParAwarded);
  const direct = num(raw.directBiddersCompetitiveParAwarded);
  const dealers = num(raw.primaryDealersCompetitiveParAwarded);
  const competitive = [indirect, direct, dealers].every((value) => value != null) ? indirect + direct + dealers : null;
  const share = (value) => (competitive > 0 && value != null ? round(value / competitive * 100, 1) : null);
  return {
    date, tenor, term: String(raw.securityTerm || ''), cusip: String(raw.cusip || '') || null,
    reopening: /yes/i.test(String(raw.reopening || '')),
    offeringBn: num(raw.offeringAmount) == null ? null : round(num(raw.offeringAmount) / 1e9, 1),
    highYield: round(highYield, 3), bidToCover: round(btc, 2),
    allottedAtHighPct: round(num(raw.allottedAtHighYieldPercentage), 2),
    indirectPct: share(indirect), directPct: share(direct), dealerPct: share(dealers)
  };
}

const mean = (values) => { const list = values.filter((value) => value != null); return list.length ? list.reduce((a, b) => a + b, 0) / list.length : null; };

/** Every result against the same tenor's previous AUCTION_LOOKBACK results (newest first in, newest first out). */
export function compareAuctions(rows = []) {
  const sorted = rows.filter(Boolean).slice().sort((a, b) => (a.date === b.date ? a.tenor - b.tenor : a.date < b.date ? 1 : -1));
  return sorted.map((row) => {
    const prior = sorted.filter((other) => other.tenor === row.tenor && other.date < row.date).slice(0, AUCTION_LOOKBACK);
    if (prior.length < AUCTION_RULES.minPrior) return { ...row, prior: prior.length, read: 'thin' };
    const btcMean = mean(prior.map((other) => other.bidToCover));
    const indirectMean = mean(prior.map((other) => other.indirectPct));
    const btcGap = btcMean == null ? null : round(row.bidToCover - btcMean, 2);
    const indirectGap = indirectMean == null || row.indirectPct == null ? null : round(row.indirectPct - indirectMean, 1);
    const weak = (btcGap != null && btcGap <= -AUCTION_RULES.btcGap) || (indirectGap != null && indirectGap <= -AUCTION_RULES.indirectGapPp);
    const strong = (btcGap != null && btcGap >= AUCTION_RULES.btcGap) || (indirectGap != null && indirectGap >= AUCTION_RULES.indirectGapPp);
    return { ...row, prior: prior.length, btcMean: round(btcMean, 2), indirectMean: round(indirectMean, 1), btcGap, indirectGap,
      read: weak && !strong ? 'weak' : strong && !weak ? 'strong' : weak && strong ? 'mixed' : 'usual' };
  });
}

const READ_WORDS = Object.freeze({ weak: '평소보다 약한 수요', strong: '평소보다 강한 수요', mixed: '지표가 엇갈림', usual: '평소 수준', thin: '비교할 과거 입찰이 적음' });
const md = (date) => { const [, m, d] = String(date || '').split('-').map(Number); return m && d ? `${m}/${d}` : ''; };
const signed = (value, digits) => `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(value).toFixed(digits)}`;

/** One result in one Korean line: "10/29 7년물 4.894%: 응찰률 2.46배(직전 6회 평균 2.48), 간접 낙찰 57.6%(평균 63.1) — 평소 수준". */
export function auctionLine(row) {
  if (!row) return '';
  const parts = [`응찰률 ${row.bidToCover.toFixed(2)}배${row.btcMean != null ? `(직전 ${row.prior}회 평균 ${row.btcMean.toFixed(2)})` : ''}`];
  if (row.indirectPct != null) parts.push(`간접 낙찰 ${row.indirectPct.toFixed(1)}%${row.indirectMean != null ? `(평균 ${row.indirectMean.toFixed(1)}%)` : ''}`);
  return `${md(row.date)} ${row.tenor}년물${row.reopening ? '(재발행)' : ''} 낙찰 금리 ${row.highYield.toFixed(3)}%: ${parts.join(', ')} — ${READ_WORDS[row.read] || READ_WORDS.usual}`;
}

/** The newest result of each tenor inside `days` of the newest auction, newest first. */
export function latestByTenor(compared = [], { days = 21 } = {}) {
  const newest = compared[0]?.date;
  if (!newest) return [];
  const floor = Date.parse(newest) - days * 86400000;
  const seen = new Set();
  return compared.filter((row) => {
    if (Date.parse(row.date) < floor || seen.has(row.tenor)) return false;
    seen.add(row.tenor);
    return true;
  });
}

/** The face sentence for 거시: how the latest coupon auctions cleared against their own recent record. */
export function auctionSummary(compared = []) {
  const recent = latestByTenor(compared);
  if (!recent.length) return '';
  const weak = recent.filter((row) => row.read === 'weak').map((row) => `${row.tenor}년물`);
  const strong = recent.filter((row) => row.read === 'strong').map((row) => `${row.tenor}년물`);
  const head = `최근 3주 ${recent.length}건(${recent.map((row) => `${row.tenor}년`).join('·')})`;
  const why = '입찰 수요가 약하면 재무부가 더 높은 금리를 줘야 팔려 장기 금리를 밀어 올립니다.';
  if (weak.length && !strong.length) return `${head} 중 ${weak.join('·')}이 같은 만기 직전 입찰보다 약하게 팔렸습니다. ${why}`;
  if (strong.length && !weak.length) return `${head} 중 ${strong.join('·')}이 같은 만기 직전 입찰보다 강하게 팔렸습니다. 높은 금리에서 사려는 수요가 있다는 뜻입니다.`;
  if (weak.length && strong.length) return `${head}: ${weak.join('·')}은 평소보다 약하게, ${strong.join('·')}은 강하게 팔려 만기마다 엇갈렸습니다. ${why}`;
  return `${head} 모두 같은 만기 직전 입찰과 비슷하게 팔렸습니다. 입찰 수요가 금리를 밀어 올린 흔적은 아직 없습니다.`;
}

export const AUCTION_METHOD = '미 재무부 TreasuryDirect 경매 결과(명목 이표채, TIPS·변동금리채 제외). 응찰률 = 응찰 총액 ÷ 발행액. 간접 낙찰 = 경쟁 낙찰액 중 간접 응찰자(딜러를 거친 해외·국내 기관) 비중. 같은 만기의 직전 6회 평균과 비교하며(응찰률 ±0.1배, 간접 낙찰 ±5%p), 발행 직전 거래 금리(when-issued)가 없어 테일은 계산하지 않습니다.';

/** Pure builder for the artifact: TA_WS rows (notes and bonds) → schema rows, comparisons and the face sentence. */
export function buildTreasuryAuctions(rawRows = [], { nowMs = Date.now(), source = 'TreasuryDirect TA_WS securities/auctioned' } = {}) {
  const seen = new Set();
  const rows = [];
  for (const raw of rawRows) {
    const row = auctionRow(raw);
    if (!row) continue;
    const key = `${row.date}|${row.cusip || row.term}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }
  const compared = compareAuctions(rows);
  return {
    schemaVersion: TREASURY_AUCTIONS_SCHEMA,
    generatedAt: new Date(nowMs).toISOString(),
    source, method: AUCTION_METHOD,
    latestAuction: compared[0]?.date || null,
    rows: compared,
    summary: auctionSummary(compared)
  };
}
