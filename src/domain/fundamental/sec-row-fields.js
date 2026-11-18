// v57.81: the screener row's SEC fields (P/E, P/B, ROE, margin, revenue growth, the reference-cap share basis and the
// fundamental lineage) from one reconciled annual record and the row's own completed close. Moved out of
// scripts/fetch-data.mjs enrichSecFundamentals so the browser's out-of-universe read builds the same fields; the
// producer calls this per symbol. Returns null when nothing usable remains (the producer then skips the symbol).
import { secSharesTrust } from './sec-report.js';
import { FUNDAMENTAL_MAX_PERIOD_AGE_DAYS, finiteFact } from './period.js';
import { trailingRowFundamentals } from './trailing-year.js';

/**
 * v59.70 (Sandisk 8:1, trading adjusted from 2026-11-20): the close is split-adjusted, but the share count is the last
 * filing's cover count, so until the next 10-Q the count is on the pre-split basis — P/E reads 1/8 (then withheld as a
 * unit mismatch) and P/B stays 1/8 on screen. A split dated after the count's observation date, up to the factor
 * session, scales the count; a count already filed after the split (dei-cover-post-split) has nothing to scale.
 */
export function splitAdjustedShares(row, splits = [], factorSessionDate = null) {
  const observed = String(row?.sharesObservedAt || '').slice(0, 10);
  const session = String(factorSessionDate || '').slice(0, 10);
  const shares = Number(row?.sharesOutstanding);
  if (!observed || !(shares > 0) || !Array.isArray(splits)) return null;
  const after = splits.filter((split) => split?.date > observed && (!session || split.date <= session) && Number(split.ratio) > 0);
  if (!after.length) return null;
  const ratio = after.reduce((product, split) => product * Number(split.ratio), 1);
  return ratio === 1 ? null : { shares: Math.round(shares * ratio), ratio: Math.round(ratio * 1000) / 1000, since: after.at(-1).date };
}

export function secFundamentalRowFields(row, { price = null, dollarVolume30d = null, factorSessionDate = null, payloadModel = null, nowMs = Date.now(), splits = [], quarters = [] } = {}) {
  if (!row) return null;
  const split = splitAdjustedShares(row, splits, factorSessionDate);
  if (split) row = { ...row, sharesOutstanding: split.shares };
  const rec = {};
  const px = price;
  // F04/F10: only a share count matched to EPS by the producer, or (older/unchecked records) one whose implied
  // daily turnover is plausible, may price P/E, P/B or the reference market cap. PKG's stored 1000x cover count
  // (P/E 26,255) fails the turnover band; a stale-period or scale-mismatched count is never used.
  const trust = secSharesTrust(row, { price: px, dollarVolume30d });
  // `row` is an SEC ledger record here, not a screener row: its annual figures are read once.
  const { roe: fyRoe, margin: fyMargin, revGrowth: fyRevGrowth } = row;
  if (typeof fyRoe === 'number' && Number.isFinite(fyRoe)) rec.roe = fyRoe;
  // 2026-11-18: margin and revenue growth on the P/E's basis — the latest four quarters (vs the four before them) when the
  // issuer's quarter series carries them, else the fiscal year — each with its basis and end date (trailing-year.js).
  // ROE stays on the fiscal year (fundamentalPeriod/fundamentalPeriodEnd): equity is annual in the store.
  Object.assign(rec, trailingRowFundamentals(row.reportingCurrency && row.reportingCurrency !== 'USD' ? [] : quarters, {
    margin: fyMargin, revGrowth: fyRevGrowth, observedAt: row.observedAt, heldRevenue: !!(row.marginHeld || row.revGrowthHeld) }));
  // 2026-10-17 (logic audit): P/E and P/B are priced only on the close passed here. A ratio stored in the ledger was priced on the
  // close of its fetch day (up to 28 days earlier) and carried no pePrice, so it is never copied through.
  if (Number.isFinite(px) && px > 0 && trust.shares) {
    const shares = trust.shares;
    // 2026-10-17 (logic audit D1/D7): the numerator is the last four quarters when they end after the fiscal year
    // (TTM), and earnings available to common when the filer tags them; the basis travels with the row.
    const earnings = row.peEarnings && Number.isFinite(Number(row.peEarnings.value)) ? row.peEarnings : null;
    const netIncome = earnings ? Number(earnings.value) : Number(row.netIncome);
    // P/B is priced on the latest reported common equity when the record carries it (sec-valuation-basis secPbEquity).
    const pbEquity = row.pbEquity && finiteFact(row.pbEquity.value) != null ? row.pbEquity : null;
    const equity = pbEquity ? Number(pbEquity.value) : Number(row.equity);
    const mcap = px * shares;
    if (Number.isFinite(netIncome) && netIncome > 0) {
      rec.pe = Math.round(mcap / netIncome * 100) / 100;
      rec.pePrice = px;
      rec.pePriceBasis = 'adjusted-close';
      rec.peEarningsBasis = earnings?.basis || 'fy';
      rec.peEarningsThrough = earnings?.through || row.observedAt || null;
      if (earnings?.concept === 'common') rec.peEarningsConcept = 'common';
      // The P/E numerator carries a one-off gain (sec-valuation-basis secEarningsOneOff): the row says so.
      if (Array.isArray(row.earningsOneOff) && row.earningsOneOff.length) rec.peOneOff = true;
      // A newer quarter is on file than the earnings this P/E is priced on (sec-valuation-basis secPeEarningsLag).
      if (row.peEarningsLag?.laterQuarter > rec.peEarningsThrough) rec.peEarningsLaterQuarter = row.peEarningsLag.laterQuarter;
    }
    if (Number.isFinite(equity) && equity > 0) {
      rec.pb = Math.round(mcap / equity * 100) / 100;
      rec.pbPrice = px;
      rec.pbPriceBasis = 'adjusted-close';
      rec.pbEquityThrough = pbEquity?.periodEnd || row.observedAt || null;
      if (pbEquity?.preferred > 0) rec.pbEquityBasis = 'common';
    }
    // F10: the reference market cap needs only a close and a verified count, not positive earnings or equity.
    rec.valuationPrice = px;
    rec.valuationPriceBasis = 'adjusted-close';
    rec.valuationSharesOutstanding = shares;
    rec.valuationSharesObservedAt = row.sharesObservedAt || null;
    rec.valuationSharesCheck = trust.check;
    rec.valuationSharesBasis = split ? 'dei-cover-split-adjusted' : (row.sharesBasis || 'dei-cover');
    if (split) { rec.valuationSplitRatio = split.ratio; rec.valuationSplitDate = split.since; }
  }
  // P1652: a filing whose period ended over 15 months ago is not current fundamentals (companyfacts concept gaps
  // left WFC on FY2019 and NEE on FY2012); the fields stay missing rather than ranking on a stale year.
  // F15: the same 456-day fiscal-year-end age (period.js FUNDAMENTAL_MAX_PERIOD_AGE_DAYS) sets the quality label.
  const sessionMs = Date.parse(String(factorSessionDate || '').slice(0, 10));
  const reportAgeDays = row.observedAt ? Math.floor(((Number.isFinite(sessionMs) ? sessionMs : nowMs) - Date.parse(row.observedAt)) / 86400000) : null;
  if (row.observedAt && (nowMs - Date.parse(row.observedAt)) / 86400000 > FUNDAMENTAL_MAX_PERIOD_AGE_DAYS) return null;
  // P1652: P/E under 2 or P/B under 0.1 is a share-class/unit mismatch (BRK-B, IBKR), not a valuation — and the
  // same share basis cannot size a reference market cap either.
  const shareBasisMismatch = (rec.pe != null && !(rec.pe >= 2)) || (rec.pb != null && !(rec.pb >= 0.1));
  if (rec.pe != null && !(rec.pe >= 2)) ['pe', 'pePrice', 'pePriceBasis', 'peEarningsBasis', 'peEarningsThrough', 'peEarningsConcept', 'peOneOff', 'peEarningsLaterQuarter'].forEach((key) => delete rec[key]);
  if (rec.pb != null && !(rec.pb >= 0.1)) ['pb', 'pbPrice', 'pbPriceBasis', 'pbEquityThrough', 'pbEquityBasis'].forEach((key) => delete rec[key]);
  if (shareBasisMismatch) {
    ['valuationPrice', 'valuationPriceBasis', 'valuationSharesOutstanding', 'valuationSharesObservedAt', 'valuationSharesCheck', 'valuationSharesBasis'].forEach((key) => delete rec[key]);
    rec.valuationHeldReason = 'share-class-or-unit-mismatch';
  }
  if (!trust.shares) rec.valuationHeldReason = trust.reason;
  // Why a multiple is absent, on the same numerator and denominator that would have priced it: a loss in the P/E
  // earnings (the last four quarters when they are the basis, not the fiscal-year margin) and non-positive common
  // equity. The value factor scores both terms 0 from these markers; neither needs a price or a share count.
  const peNumerator = finiteFact(row.peEarnings?.value) ?? finiteFact(row.netIncome);
  if (peNumerator != null && peNumerator <= 0) rec.peLoss = true;
  const pbDenominator = finiteFact(row.pbEquity?.value) ?? finiteFact(row.equity);
  if (pbDenominator != null && pbDenominator <= 0) rec.pbDeficit = true;
  if (!['pe', 'pb', 'roe', 'margin', 'revGrowth', 'valuationSharesOutstanding'].some((key) => rec[key] != null)) return null;
  // v59.45 (pipeline review P19 future rows): a fiscal year ending after the session, or a filing time after now, is not a
  // current observation (2099/2100 read CURRENT); the report freshness gate (sec-report) already refuses them.
  const availableMs = Date.parse(row.availableAt || row.acceptedAt || row.filedAt || '');
  const future = (reportAgeDays != null && reportAgeDays < 0) || (Number.isFinite(availableMs) && availableMs > nowMs);
  const current = !future && reportAgeDays != null && reportAgeDays <= FUNDAMENTAL_MAX_PERIOD_AGE_DAYS;
  Object.assign(rec, {
    fundamentalSource: 'SEC EDGAR companyfacts',
    fundamentalModel: row.model || payloadModel || 'sec-fy-normalized-v2',
    fundamentalPeriod: row.periodType || 'FY',
    // Period end is not availability. Ranking may use only the first time
    // the filing was public; retain period end separately for display.
    fundamentalPeriodEnd: row.observedAt || null,
    fundamentalObservedAt: row.availableAt || row.acceptedAt || row.filedAt || null,
    fundamentalFiledAt: row.filedAt || null,
    fundamentalFetchedAt: row.fetchedAt,
    fundamentalAccession: row.accession || null,
    fundamentalSourceKind: 'T1_OFFICIAL',
    fundamentalAllowedUse: 'research-relative-ranking-only',
    // F15: CURRENT meant "has a filing date" (624/624 rows). The label now follows the fiscal-year-end age
    // against the factor session (456-day rule); rows past it are not merged at all (above).
    fundamentalQuality: {
      status: !(row.availableAt || row.acceptedAt || row.filedAt) ? 'MISSING' : current ? 'CURRENT' : 'STALE',
      stale: !(row.availableAt || row.acceptedAt || row.filedAt) || !current,
      ...(future ? { future: true } : {}),
      basis: 'fiscal-year-end-age',
      period: 'FY',
      reportAgeDays,
      maxAgeDays: FUNDAMENTAL_MAX_PERIOD_AGE_DAYS,
      decisionUse: false,
      allowedUse: 'reference'
    },
    fundamentalRightsId: 'PUBLIC_REFERENCE'
  });
  return rec;
}
