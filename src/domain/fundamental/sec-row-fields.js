// v57.81: the screener row's SEC fields (P/E, P/B, ROE, margin, revenue growth, the reference-cap share basis and the
// fundamental lineage) from one reconciled annual record and the row's own completed close. Moved out of
// scripts/fetch-data.mjs enrichSecFundamentals so the browser's out-of-universe read builds the same fields; the
// producer calls this per symbol. Returns null when nothing usable remains (the producer then skips the symbol).
import { secSharesTrust } from './sec-report.js';
import { FUNDAMENTAL_MAX_PERIOD_AGE_DAYS } from './period.js';

export function secFundamentalRowFields(row, { price = null, dollarVolume30d = null, factorSessionDate = null, payloadModel = null, nowMs = Date.now() } = {}) {
  if (!row) return null;
  const rec = {};
  const px = price;
  // F04/F10: only a share count matched to EPS by the producer, or (older/unchecked records) one whose implied
  // daily turnover is plausible, may price P/E, P/B or the reference market cap. PKG's stored 1000x cover count
  // (P/E 26,255) fails the turnover band; a stale-period or scale-mismatched count is never used.
  const trust = secSharesTrust(row, { price: px, dollarVolume30d });
  ['roe','margin','revGrowth'].forEach(key => {
    if (typeof row[key] === 'number' && Number.isFinite(row[key])) rec[key] = row[key];
  });
  // 2026-10-17 (logic audit): P/E and P/B are priced only on the close passed here. A ratio stored in the ledger was priced on the
  // close of its fetch day (up to 28 days earlier) and carried no pePrice, so it is never copied through.
  if (Number.isFinite(px) && px > 0 && trust.shares) {
    const shares = trust.shares;
    // 2026-10-17 (logic audit D1/D7): the numerator is the last four quarters when they end after the fiscal year
    // (TTM), and earnings available to common when the filer tags them; the basis travels with the row.
    const earnings = row.peEarnings && Number.isFinite(Number(row.peEarnings.value)) ? row.peEarnings : null;
    const netIncome = earnings ? Number(earnings.value) : Number(row.netIncome);
    const equity = Number(row.equity);
    const mcap = px * shares;
    if (Number.isFinite(netIncome) && netIncome > 0) {
      rec.pe = Math.round(mcap / netIncome * 100) / 100;
      rec.pePrice = px;
      rec.pePriceBasis = 'adjusted-close';
      rec.peEarningsBasis = earnings?.basis || 'fy';
      rec.peEarningsThrough = earnings?.through || row.observedAt || null;
      if (earnings?.concept === 'common') rec.peEarningsConcept = 'common';
    }
    if (Number.isFinite(equity) && equity > 0) {
      rec.pb = Math.round(mcap / equity * 100) / 100;
      rec.pbPrice = px;
      rec.pbPriceBasis = 'adjusted-close';
    }
    // F10: the reference market cap needs only a close and a verified count, not positive earnings or equity.
    rec.valuationPrice = px;
    rec.valuationPriceBasis = 'adjusted-close';
    rec.valuationSharesOutstanding = shares;
    rec.valuationSharesObservedAt = row.sharesObservedAt || null;
    rec.valuationSharesCheck = trust.check;
    rec.valuationSharesBasis = row.sharesBasis || 'dei-cover';
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
  if (rec.pe != null && !(rec.pe >= 2)) ['pe', 'pePrice', 'pePriceBasis', 'peEarningsBasis', 'peEarningsThrough', 'peEarningsConcept'].forEach((key) => delete rec[key]);
  if (rec.pb != null && !(rec.pb >= 0.1)) { delete rec.pb; delete rec.pbPrice; delete rec.pbPriceBasis; }
  if (shareBasisMismatch) {
    ['valuationPrice', 'valuationPriceBasis', 'valuationSharesOutstanding', 'valuationSharesObservedAt', 'valuationSharesCheck', 'valuationSharesBasis'].forEach((key) => delete rec[key]);
    rec.valuationHeldReason = 'share-class-or-unit-mismatch';
  }
  if (!trust.shares) rec.valuationHeldReason = trust.reason;
  if (!['pe', 'pb', 'roe', 'margin', 'revGrowth', 'valuationSharesOutstanding'].some((key) => rec[key] != null)) return null;
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
      status: !(row.availableAt || row.acceptedAt || row.filedAt) ? 'MISSING' : reportAgeDays != null && reportAgeDays <= FUNDAMENTAL_MAX_PERIOD_AGE_DAYS ? 'CURRENT' : 'STALE',
      stale: !(row.availableAt || row.acceptedAt || row.filedAt) || !(reportAgeDays != null && reportAgeDays <= FUNDAMENTAL_MAX_PERIOD_AGE_DAYS),
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
