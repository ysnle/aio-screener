// 기대인플레 고정 여부: a market gauge (5y5y forward or the 10-year breakeven) and a survey gauge (Michigan 5-10 years) rising
// together is 탈앵커링 감시; one of them alone is not (2044319524078662072 never judges on the survey alone,
// 2036961542709866701 reads the market forwards, 2042880481893716094 calls even its own two-leg reading tentative).
import { RULES } from '../rules/thresholds.js';
import { STATE_LABELS } from '../market/interpretation/concepts.js';
import { monthIndex, seriesOf } from './macro-read.js';
import { sessionPointBack } from './rates-fx.js';
import { MARKET_WINDOWS } from '../market/session/market-windows.js';

// The survey leg rises when its latest month is above the month before and above its own pre-pandemic range (the highest
// print of these months; 2044319524078662072: "팬데믹 이전 범위"). A market leg rises past the 20-session cross-asset rate
// line (RULES.crossAsset.rate20dBp), the line the oil chapter reads the breakeven on.
export const ANCHOR_RULES = Object.freeze({ prePandemicFrom: '2015-01', prePandemicTo: '2019-12' });
export const ANCHOR_WORDS = Object.freeze({ watch: '탈앵커링 감시', one: '한쪽만 상승', anchored: '고정', unknown: STATE_LABELS.unknown });

function marketLeg(macroHistory, id) {
  const rows = seriesOf(macroHistory, id);
  const end = rows.at(-1);
  const start = end ? sessionPointBack(rows, MARKET_WINDOWS.rule) : null;
  if (!start) return null;
  const bp = (end.value - start.value) * 100;
  return { id, from: start.date, date: end.date, level: end.value, bp, rises: bp >= RULES.crossAsset.rate20dBp };
}

function surveyLeg(macroHistory, id) {
  const rows = seriesOf(macroHistory, id);
  const [before, last] = rows.slice(-2);
  if (!last || !before || monthIndex(last.date) - monthIndex(before.date) !== 1) return null;
  const pre = rows.filter((row) => row.date.slice(0, 7) >= ANCHOR_RULES.prePandemicFrom && row.date.slice(0, 7) <= ANCHOR_RULES.prePandemicTo);
  const top = pre.length ? Math.max(...pre.map((row) => row.value)) : null;
  return { id, date: last.date, level: last.value, change: last.value - before.value, top, rises: top == null ? null : last.value > before.value && last.value > top };
}

/** { state, label, legs }: 탈앵커링 감시 only when a market leg and the survey leg both rise. */
export function expectationsAnchor(macroHistory) {
  const markets = ['fiveYearForward', 'breakeven10'].map((id) => marketLeg(macroHistory, id)).filter(Boolean);
  const survey = surveyLeg(macroHistory, 'michInflation5y');
  const oneYear = seriesOf(macroHistory, 'michInflation1y').at(-1) || null;
  const marketUp = markets.some((leg) => leg.rises);
  const state = !markets.length || !survey || survey.rises == null ? 'unknown'
    : marketUp && survey.rises ? 'watch' : marketUp || survey.rises ? 'one' : 'anchored';
  return { state, label: ANCHOR_WORDS[state], markets, survey, oneYear };
}
