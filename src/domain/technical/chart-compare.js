// v58.79 (owner 2026-10-25, chart review): compare a stock's price path with other symbols on its own chart. Each other
// symbol is rebased to the stock's close on the first shared day of the window, so the lines start together and the gap
// between them is the relative return; the table gives the same comparison as plain period returns. Pure functions on
// completed daily bars — no DOM, no network.

export const COMPARE_WINDOW = 130; // about six months of sessions on the daily chart
export const COMPARE_PERIODS = Object.freeze([['1개월', 21], ['3개월', 63], ['6개월', 126], ['1년', 252]]);
export const COMPARE_MAX = 3;

const norm = (value) => String(value || '').trim().toUpperCase();

/** Same-theme symbols for the compare chips: the smallest sub-theme holding the symbol first, then the theme leaders. */
export function chartPeers(themes, symbol, max = 5) {
  const sym = norm(symbol);
  const subs = [];
  let theme = null;
  for (const item of Array.isArray(themes) ? themes : []) {
    for (const sub of item?.subThemes || []) if ((sub.tickers || []).some((ticker) => norm(ticker) === sym)) { subs.push(sub); theme ||= item; }
    if (!theme && (item?.leaders || []).some((ticker) => norm(ticker) === sym)) theme = item;
  }
  if (!theme) return { theme: null, peers: [] };
  subs.sort((a, b) => (a.tickers || []).length - (b.tickers || []).length);
  const ordered = [...new Set([...subs.flatMap((sub) => (sub.tickers || []).map(norm)), ...(theme.leaders || []).map(norm)])].filter((ticker) => ticker && ticker !== sym);
  return { theme: theme.name || theme.id || null, peers: ordered.slice(0, max) };
}

/** The other symbol's closes on the stock's dates (same day, else the latest earlier close within 3 days). */
export function alignCloses(bars, otherBars) {
  const other = (Array.isArray(otherBars) ? otherBars : []).filter((bar) => bar?.close > 0).sort((a, b) => (a.time < b.time ? -1 : 1));
  let j = 0;
  return (Array.isArray(bars) ? bars : []).map((bar) => {
    while (j + 1 < other.length && other[j + 1].time <= bar.time) j++;
    const hit = other[j];
    if (!hit || hit.time > bar.time) return null;
    const gapDays = (Date.parse(bar.time) - Date.parse(hit.time)) / 86400000;
    return gapDays <= 3 ? hit.close : null;
  });
}

/** Line points for the overlay: the other symbol rebased to the stock's close at the window start. */
export function rebasedLine(bars, otherBars, window = COMPARE_WINDOW) {
  const aligned = alignCloses(bars, otherBars);
  const start = Math.max(0, bars.length - window);
  let base = -1;
  for (let k = start; k < bars.length; k++) if (aligned[k] > 0) { base = k; break; }
  if (base < 0) return null;
  const scale = bars[base].close / aligned[base];
  const points = [];
  for (let k = base; k < bars.length; k++) if (aligned[k] > 0) points.push({ time: bars[k].time, value: aligned[k] * scale });
  return points.length >= 2 ? { points, start: bars[base].time, endPct: (aligned.at(-1) > 0 ? aligned.at(-1) / aligned[base] - 1 : null) } : null;
}

/** Period returns (%) from completed closes, newest close against the close `n` sessions earlier. */
export function periodReturns(bars) {
  const closes = (Array.isArray(bars) ? bars : []).map((bar) => bar?.close).filter((value) => value > 0);
  const last = closes.at(-1);
  return Object.fromEntries(COMPARE_PERIODS.map(([label, n]) => [label, closes.length > n && last > 0 ? (last / closes[closes.length - 1 - n] - 1) * 100 : null]));
}

/**
 * v59.49: another symbol's period returns on the stock's dates (alignCloses), so every row of the table covers the same
 * calendar span. Counting the other series' own sessions put a KR listing (Chuseok closures) and SPY on different
 * start dates, and a cached series that ended days earlier was compared as if current; an unaligned end is null.
 */
export function alignedPeriodReturns(bars, otherBars) {
  const list = Array.isArray(bars) ? bars : [];
  const aligned = alignCloses(list, otherBars);
  const last = aligned.at(-1);
  return Object.fromEntries(COMPARE_PERIODS.map(([label, n]) => {
    const start = aligned[list.length - 1 - n];
    return [label, list.length > n && last > 0 && start > 0 ? (last / start - 1) * 100 : null];
  }));
}
