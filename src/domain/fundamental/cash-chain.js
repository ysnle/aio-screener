// 현금 사슬 (재무 공시 ② 이익의 질 카드): the annual filings read as one chain — operating cash → capital spending → free
// cash → share count → cash left. Three rule readings, each one fixed state word with its figures as claims on the filer:
//   fcfBridge — the change in free cash flow from the adjacent fiscal year split into its operating-cash part and its
//               capital-spending part, named by the larger part: a capex cut at least as large as the improvement is
//               always "투자 삭감" (2019218761770045646); read the other way, a fall carried by more spending (2115574525718860249).
//   dilution  — the split-adjusted share count's yearly pace beside revenue per share's: shares growing faster than revenue
//               (revenue per share falling) is dilution outrunning growth (2025626195421749605); a pace past
//               CASH_CHAIN.heavyDilutionPct is weighed even when revenue per share rises (2049101366602146031).
//   runway    — a filer with a net loss and negative free cash flow: cash (and short-term investments when reported) ÷ that
//               year's free-cash outflow, in years (2016227595788939473). No cash column, no runway.
// Facts, words and claims only; the sentence reading them is the AI's.
import { finiteFact as finite, isPriorAnnualPeriod } from './period.js';
import { periodId } from '../shared/claim.js';
import { filerClaim, shareSplitBreaks } from './fiscal-read.js';

export const CASH_CHAIN = Object.freeze({
  /** 2049101366602146031: a share count growing more than this a year (CAGR, %) is dilution to weigh. */
  heavyDilutionPct: 5,
  /** A yearly share-count pace inside this band (%) reads as unchanged. */
  flatSharesPct: 0.5
});
export const FCF_BRIDGE_STATES = Object.freeze({ 'capex-cut': '주로 투자 삭감으로 개선', operating: '주로 영업현금 증가로 개선', 'capex-up': '주로 투자 확대로 감소',
  'operating-down': '주로 영업현금 감소로 감소', flat: '변화 없음' });
export const DILUTION_STATES = Object.freeze({ shrinking: '주식 수 감소', flat: '주식 수 거의 그대로', outpaced: '희석이 성장보다 빠름',
  heavy: '성장이 앞서지만 희석이 큼', covered: '성장이 희석보다 빠름' });
export const RUNWAY_STATE = '적자에 잉여현금 유출';
const TONE = Object.freeze({ 'capex-cut': 'neutral', operating: 'favorable', 'capex-up': 'neutral', 'operating-down': 'burden', flat: 'neutral',
  shrinking: 'favorable', outpaced: 'burden', heavy: 'burden', covered: 'neutral' });

/** The three rules as written conventions, for the method fold. */
export function cashChainMethod() {
  const C = CASH_CHAIN;
  return [`잉여현금흐름 변화는 직전 회계연도 대비 영업현금흐름 변화와 설비투자 변화로 나누고, 둘 중 큰 쪽으로 이름을 붙입니다. 설비투자 감소액이 개선액 이상이면 언제나 '${FCF_BRIDGE_STATES['capex-cut']}'입니다.`,
    `희석은 분할로 보이는 해를 뺀 주식 수의 연평균 변화와 주당 매출의 연평균 변화를 나란히 봅니다. 주당 매출이 줄면 '${DILUTION_STATES.outpaced}', 주식 수가 연 ${C.heavyDilutionPct}%를 넘게 늘면 '${DILUTION_STATES.heavy}', 연 ±${C.flatSharesPct}% 안이면 '${DILUTION_STATES.flat}'입니다.`,
    '현금이 버티는 기간은 순손실이면서 잉여현금흐름이 마이너스인 해에만 계산합니다. 그 해 말의 현금(단기투자가 공시되면 더함) ÷ 그 해의 잉여현금 유출이며, 새 조달·차입은 넣지 않습니다.'];
}

const fig = (value, unit, basis, label, period, more = {}) => ({ value, unit, basis, label, period, ...more });
const fy = (year) => periodId('FY', year.periodEnd);

/** { state, label, tone, fcf, fcfPrior, ocfChange, capexChange, fcfChange, claim } or null without two adjacent years of both flows. */
export function fcfBridge(history = [], symbol = '') {
  const latest = history.at(-1); const prior = history.at(-2);
  if (!isPriorAnnualPeriod(latest, prior)) return null;
  const [ocf, capex, ocfPrior, capexPrior] = [finite(latest.operatingCashFlow), finite(latest.capex), finite(prior.operatingCashFlow), finite(prior.capex)];
  if ([ocf, capex, ocfPrior, capexPrior].some((value) => value == null)) return null;
  const fcf = ocf - capex; const fcfPrior = ocfPrior - capexPrior;
  const ocfChange = ocf - ocfPrior; const capexChange = capex - capexPrior; const fcfChange = fcf - fcfPrior;
  // The larger of the two parts names the change: a cut at least as large as the improvement (the post's line) always is.
  const state = fcfChange > 0 ? (-capexChange >= ocfChange ? 'capex-cut' : 'operating') : fcfChange < 0 ? (capexChange >= -ocfChange ? 'capex-up' : 'operating-down') : 'flat';
  const now = fy(latest); const then = fy(prior);
  const said = filerClaim(symbol)('fcfBridge', [fig(fcf, 'usd', 'fcf', '잉여현금흐름', now), fig(fcfPrior, 'usd', 'fcf', '전년', then),
    fig(ocfChange, 'usdChange', 'ocfChange', '영업현금흐름', now, { against: then }), fig(capexChange, 'usdChange', 'capexChange', '설비투자', now, { against: then })], { compare: { across: [now, then] } });
  return { state, label: FCF_BRIDGE_STATES[state], tone: TONE[state], fcf, fcfPrior, ocfChange, capexChange, fcfChange, claim: said };
}

/** { state, label, tone, span, change, sharesCagr, perShareCagr, claim } over the years with revenue and a share count, split steps left out. */
export function dilutionRead(history = [], symbol = '') {
  const years = history.filter((year) => finite(year?.shares) > 0 && finite(year?.revenue) > 0);
  if (years.length < 2) return null;
  const breaks = new Set(shareSplitBreaks(years));
  const factor = years.slice(1).reduce((product, year, k) => (breaks.has(year.periodEnd) ? product : product * year.shares / years[k].shares), 1);
  const first = years[0]; const last = years.at(-1);
  const exact = (Date.parse(last.periodEnd) - Date.parse(first.periodEnd)) / (365.25 * 86400000);
  const span = Math.round(exact);
  if (!(span >= 1)) return null;
  const sharesCagr = (factor ** (1 / exact) - 1) * 100;
  const perShareCagr = (((last.revenue / first.revenue) / factor) ** (1 / exact) - 1) * 100;
  const C = CASH_CHAIN;
  const state = sharesCagr <= -C.flatSharesPct ? 'shrinking' : sharesCagr < C.flatSharesPct ? 'flat'
    : perShareCagr < 0 ? 'outpaced' : sharesCagr > C.heavyDilutionPct ? 'heavy' : 'covered';
  const held = periodId('SPAN', last.periodEnd, first.periodEnd);
  const said = filerClaim(symbol)('shares', [fig(span, 'years', 'spanYears', '동안', held), fig((factor - 1) * 100, 'pct', 'sharesSplitAdjusted', '발행 주식 수', held),
    fig(sharesCagr, 'pct', 'sharesCagr', '연', held), fig(perShareCagr, 'pct', 'revenuePerShareCagr', '주당 매출', held)]);
  return { state, label: DILUTION_STATES[state], tone: TONE[state] || 'neutral', span, change: (factor - 1) * 100, sharesCagr, perShareCagr, splitSeen: breaks.size > 0, claim: said };
}

/** { label, years, liquid, burn, claim } for a latest year with a net loss and negative free cash flow and a cash figure; else null. */
export function runwayRead(history = [], symbol = '') {
  const latest = history.at(-1);
  const [ocf, capex, cash] = [finite(latest?.operatingCashFlow), finite(latest?.capex), finite(latest?.cash)];
  if (!(finite(latest?.netIncome) < 0) || ocf == null || capex == null || cash == null || !(ocf - capex < 0)) return null;
  const investments = finite(latest.shortTermInvestments);
  const liquid = cash + (investments ?? 0);
  const burn = capex - ocf;
  const now = fy(latest);
  const said = filerClaim(symbol)('runway', [fig(liquid, 'usd', investments == null ? 'cash' : 'cashAndInvestments', investments == null ? '현금' : '현금·단기투자', now),
    fig(burn, 'usd', 'fcfOutflow', '잉여현금 유출', now), fig(liquid / burn, 'years', 'runwayYears', '약', now, { digits: 1 })]);
  return { label: RUNWAY_STATE, years: liquid / burn, liquid, burn, claim: said };
}
