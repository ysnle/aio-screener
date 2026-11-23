// A cyclical company's P/E is lowest at its earnings peak (MU on 2026-11-20: P/E 7.9 on a 63.8% net margin against a
// 21.2% median over its five prior fiscal years).
//
// The fact: the row's net margin is at least PEAK_MARGIN_MULTIPLE times the median net margin of the company's prior
// fiscal years, at least PEAK_MARGIN_MIN_GAP_PP points above it, the median is positive and at least
// PEAK_MARGIN_MIN_PRIOR_YEARS prior years are known. It is a contrary check (technical/bands.js modelContraryEvidence),
// not a score input: the value factor still scores the P/E. Leaving the P/E out of the score waits for a research
// backtest — measured 2026-11-23 it flagged 62 rows, secular margin-expanders (AMZN, APP, WDAY) among them, and moved
// 20 percentiles by more than 5 points. The gap floor keeps a thin-margin business (1% -> 2.5%) from reading as a peak;
// a loss-making norm is left out (it flagged 59 more rows, nearly all newly profitable growers).
//
// The prior-year norm comes from the SEC fiscal history; the screener producer publishes it per row as
// marginPriorFyMedian / marginPriorFyYears from priorFiscalMarginNorm. P/E and margin go through the screener row contract.
import { finiteNumber as finite } from '../shared/number.js';
import { readRowNumber } from '../../data/contracts/screener.js';

export const PEAK_MARGIN_MULTIPLE = 2;
export const PEAK_MARGIN_MIN_GAP_PP = 5;
export const PEAK_MARGIN_MIN_PRIOR_YEARS = 3;
export const PEAK_MARGIN_MAX_PRIOR_YEARS = 5;
// A fiscal year ending within this many days of the margin's own end date overlaps the trailing window it measures.
const PRIOR_YEAR_MIN_GAP_DAYS = 330;
const DAY_MS = 86_400_000;

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * The company's own margin norm: the median net margin (%) of up to five fiscal years that end at least 330 days before
 * `through` (the margin's end date), from parsed fiscal years [{ periodEnd, revenue, netIncome }]. Years without a
 * positive revenue or a net income are skipped. Returns { median, years } (median rounded to 0.1) or null.
 */
export function priorFiscalMarginNorm(history, through) {
  const end = Date.parse(String(through || '').slice(0, 10));
  if (!Number.isFinite(end)) return null;
  const margins = (Array.isArray(history) ? history : [])
    .filter((year) => Number.isFinite(Date.parse(year?.periodEnd)) && Date.parse(year.periodEnd) <= end - PRIOR_YEAR_MIN_GAP_DAYS * DAY_MS)
    .filter((year) => finite(year.revenue) > 0 && finite(year.netIncome) != null)
    .sort((a, b) => String(a.periodEnd).localeCompare(String(b.periodEnd)))
    .slice(-PEAK_MARGIN_MAX_PRIOR_YEARS)
    .map((year) => (year.netIncome / year.revenue) * 100);
  return margins.length ? Object.freeze({ median: Math.round(median(margins) * 10) / 10, years: margins.length }) : null;
}

/**
 * Whether the row's P/E sits on a margin far above its own norm. Returns { peak, checked, pe, margin, priorMedian,
 * priorYears, multiple }; `checked` is false when the row has a P/E but no published norm (the check could not run).
 */
export function peakEarningsPe(row) {
  const pe = readRowNumber(row, 'pe', 'calculation');
  const margin = readRowNumber(row, 'margin', 'calculation');
  const priorMedian = finite(row?._marginPriorFyMedian ?? row?.marginPriorFyMedian);
  const priorYears = finite(row?._marginPriorFyYears ?? row?.marginPriorFyYears);
  const peak = pe != null && pe > 0 && margin != null && priorMedian != null && priorMedian > 0 && priorYears != null
    && priorYears >= PEAK_MARGIN_MIN_PRIOR_YEARS && margin >= PEAK_MARGIN_MULTIPLE * priorMedian && margin - priorMedian >= PEAK_MARGIN_MIN_GAP_PP;
  const checked = !(pe != null && pe > 0) || (margin != null && priorMedian != null && priorYears != null);
  return Object.freeze({ peak, checked, pe, margin, priorMedian, priorYears, multiple: peak ? margin / priorMedian : null });
}

/** The contrary-check line, or '' when the P/E is not on a peak margin. */
export function peakEarningsNote(row) {
  const read = peakEarningsPe(row);
  return read.peak
    ? `PER ${read.pe.toFixed(1)}배의 순이익률 ${read.margin.toFixed(1)}%가 이전 ${read.priorYears}개 회계연도 중앙값 ${read.priorMedian.toFixed(1)}%의 ${read.multiple.toFixed(1)}배 — 낮은 PER이 이익 정점일 수 있음`
    : '';
}
