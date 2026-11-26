// The trend template (Minervini's eight published criteria, the eighth replaced by "6-month return above the
// benchmark" — so every screen labels it a variant). One definition: the single-stock chart (chart-analysis.js) reads it
// on its own bars, and the screener-wide setup board (setup-board.js) on the distances each screener row publishes.
// A check whose input is missing is unknown (null), never unmet.
import { RULES } from '../rules/thresholds.js';

const TECH = RULES.technical;

export const TEMPLATE_CHECK_IDS = Object.freeze(['aboveLongLines', 'line150Over200', 'line200Rising', 'line50OverLong', 'above50', 'offLow', 'nearHigh', 'relativeStrength']);

const known = (...values) => values.every((value) => value != null && Number.isFinite(value));

/**
 * The eight checks as [{ id, label, ok }] (ok true | false | null).
 * @param {{ close:number, sma50?:number|null, sma150?:number|null, sma200?:number|null, sma200Then?:number|null, low52?:number|null, high52?:number|null, fullYear?:boolean, rs?:number|null }} levels
 *   `sma200Then` the 200-day average one month (21 sessions) earlier; `rs` the 6-month return minus the benchmark's, in %p.
 */
export function trendTemplateChecks({ close, sma50 = null, sma150 = null, sma200 = null, sma200Then = null, low52 = null, high52 = null, fullYear = false, rs = null }, { benchmarkLabel = 'S&P 500' } = {}) {
  const c = close;
  const rows = [
    ['aboveLongLines', '종가 > 150·200일선', known(c, sma150, sma200) ? c > sma150 && c > sma200 : null],
    ['line150Over200', '150일선 > 200일선', known(sma150, sma200) ? sma150 > sma200 : null],
    ['line200Rising', '200일선 1개월 이상 상승', known(sma200, sma200Then) ? sma200 > sma200Then : null],
    ['line50OverLong', '50일선 > 150·200일선', known(sma50, sma150, sma200) ? sma50 > sma150 && sma50 > sma200 : null],
    ['above50', '종가 > 50일선', known(c, sma50) ? c > sma50 : null],
    ['offLow', `52주 저점 대비 +${TECH.template.aboveLowPct}% 이상`, fullYear && known(c, low52) ? c >= low52 * (1 + TECH.template.aboveLowPct / 100) : null],
    ['nearHigh', `52주 고점 대비 -${TECH.template.nearHighPct}% 이내`, fullYear && known(c, high52) ? c >= high52 * (1 - TECH.template.nearHighPct / 100) : null],
    ['relativeStrength', `상대강도 (${benchmarkLabel} 대비 6개월 우위)`, known(rs) ? rs > 0 : null]
  ];
  return rows.map(([id, label, ok]) => Object.freeze({ id, label, ok }));
}

const level = (pct) => (pct == null || !Number.isFinite(pct) || pct <= -100 ? null : 1 / (1 + pct / 100));

/**
 * The same checks from a screener row's published distances (close set to 1): pctSma50/150/200 (close ÷ average − 1, %),
 * sma200Rise21Pct (the 200-day average against itself 21 sessions earlier, %), pctFrom52wLow/High (null below a full
 * year) and rs6m (%p). The distances are rounded at publish, so a check sitting on its line can differ from the chart.
 */
export function trendTemplateFromDistances({ pctSma50 = null, pctSma150 = null, pctSma200 = null, sma200Rise21Pct = null, pctFrom52wLow = null, pctFrom52wHigh = null, rs6m = null } = {}, options = {}) {
  const sma200 = level(pctSma200);
  const rise = sma200Rise21Pct != null && Number.isFinite(sma200Rise21Pct) && sma200Rise21Pct > -100 ? sma200Rise21Pct : null;
  return trendTemplateChecks({
    close: 1,
    sma50: level(pctSma50),
    sma150: level(pctSma150),
    sma200,
    sma200Then: sma200 != null && rise != null ? sma200 / (1 + rise / 100) : null,
    low52: level(pctFrom52wLow),
    high52: level(pctFrom52wHigh),
    fullYear: pctFrom52wLow != null && pctFrom52wHigh != null,
    rs: rs6m
  }, options);
}
