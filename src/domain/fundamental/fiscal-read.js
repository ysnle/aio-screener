import { withObjectParticle } from '../content/korean-particle.js';
import { finiteFact, isPriorAnnualPeriod, annualFilingStatus, fiscalYearLabel } from './period.js';
import { signedText, usdKoreanText } from '../shared/number.js';
import { isIsoDay, hasLeadingIsoDay } from '../shared/session-date.js';
import { readRowNumber } from '../../data/contracts/screener.js';
import { claim, say, sayJoin, NOTHING, periodId, periodOf } from '../shared/claim.js';
export const FISCAL_FLAT_BAND = 2;
/** v60.50 (C): above this net income growth (%) a PEG is near zero whatever the price, so it is withheld. */
export const PEG_MAX_GROWTH = 100;
import { financialKind } from './financial-kind.js';
import { debtLabel } from './sec-earnings.js';
export { financialKind, isLendingFinancial } from './financial-kind.js';

const finite = finiteFact;
const signed = (value, digits = 1, unit = '%') => signedText(value, digits, unit);

// Every figure this read prints is a claim on the filer (src/domain/shared/claim.js): its unit, its period and,
// for a change, the period it changed from. A claim is dated by the newest period it prints.
const fig = (value, unit, basis, label, period = null, more = {}) => ({ value, unit, basis, label, period, ...more });
export function filerClaim(symbol) {
  const subject = `filer:${symbol}`;
  const newest = (figures) => figures.map((figure) => periodOf(figure.period)?.end).filter(Boolean).sort().at(-1) || null;
  return (measure, figures, more = {}) => claim({ subject, measure, asOf: newest(figures), figures, ...more });
}
const fyOf = (year) => periodId('FY', year?.periodEnd);
const point = (id, tone, title, said, more = {}) => ({ id, tone, title, text: said.text, claims: said.claims, ...more });

export function formatUsdShort(value) {
  return usdKoreanText(value);
}

const CAPITAL_COLUMNS = ['grossProfit', 'operatingIncome', 'cash', 'shortTermInvestments', 'shareBasedCompensation', 'buybacks', 'dividends'];
// public-data/sec-fiscal-history.json `data[symbol]`, USD millions:
// periodEnd:revenue:netIncome:equity:operatingCashFlow:capex:longTermDebt:sharesMillions[:totalAssets:researchAndDevelopment]
// [:seven capital columns]. The asset/R&D pair is present once the issuer was read with those concepts (assetChain); a row
// without them was written before, so its assets/R&D are "not yet collected", not "not reported". The capital columns
// sit on the latest two years once read with them (absent = not yet collected).
export function parseFiscalHistory(text) {
  const num = (value) => (finite(value) == null ? null : finite(value) * 1e6);
  return String(text || '').split(';').map((part) => part.split(':')).filter((cells) => isIsoDay(cells[0] || ''))
    .map(([periodEnd, revenue, netIncome, equity, operatingCashFlow, capex, longTermDebt, shares, ...rest]) => ({
      periodEnd, revenue: num(revenue), netIncome: num(netIncome), equity: num(equity), operatingCashFlow: num(operatingCashFlow),
      capex: num(capex), longTermDebt: num(longTermDebt), shares: num(shares),
      ...(rest.length >= 2 ? { assetChain: true, totalAssets: num(rest[0]), researchAndDevelopment: num(rest[1]) } : {}),
      ...(rest.length >= 9 ? { capitalChain: true, ...Object.fromEntries(CAPITAL_COLUMNS.map((field, i) => [field, num(rest[2 + i])])) } : {})
    }));
}

export function reconcileFiscalHistory(history = [], fundamentals = null, symbol = '') {
  const rows = (Array.isArray(history) ? history : []).map((year) => ({ ...year })).sort((a, b) => String(a.periodEnd).localeCompare(String(b.periodEnd)));
  const latest = rows[rows.length - 1];
  if (!latest || fundamentals?.periodType !== 'FY' || latest.periodEnd !== fundamentals?.observedAt
    || (fundamentals?.symbol && String(fundamentals.symbol).toUpperCase() !== String(symbol).toUpperCase())) return rows;
  for (const field of ['revenue', 'netIncome', 'equity', 'operatingCashFlow', 'capex', 'longTermDebt']) {
    if (finite(fundamentals[field]) != null) latest[field] = finite(fundamentals[field]);
  }
  latest.preciseAnnual = true;
  if (finite(fundamentals.revGrowth) != null && isPriorAnnualPeriod(latest, rows[rows.length - 2])) latest.verifiedRevGrowth = finite(fundamentals.revGrowth);
  const sharesDelay = (Date.parse(fundamentals.sharesObservedAt || '') - Date.parse(latest.periodEnd)) / 86400000;
  if (finite(fundamentals.sharesOutstanding) != null && sharesDelay >= 0 && sharesDelay <= 150) {
    latest.shares = finite(fundamentals.sharesOutstanding);
    latest.sharesObservedAt = fundamentals.sharesObservedAt;
  }
  return rows;
}

export { trailingQuarters } from './trailing-year.js';
import { trailingQuarters } from './trailing-year.js';

export function shareSplitBreaks(history = []) {
  const years = (Array.isArray(history) ? history : []).filter((year) => finite(year?.shares) > 0);
  const breaks = [];
  const nearSplit = (x) => x >= 1.9 && Math.abs(x - Math.round(x)) / Math.round(x) < 0.06;
  for (let k = 1; k < years.length; k += 1) {
    const ratio = years[k].shares / years[k - 1].shares;
    if (nearSplit(ratio) || nearSplit(1 / ratio)) breaks.push(years[k].periodEnd);
  }
  return breaks;
}

// debtBasis: the issuer's sec-fiscal-history.json debtBasis ('lease-inclusive' names finance leases in the debt figure).
export function buildFiscalRead({ symbol, fundamentals = null, row = null, quarters = [], now = null, sic = null, debtBasis = null } = {}) {
  if (fundamentals?.symbol && String(fundamentals.symbol).toUpperCase() !== String(symbol).toUpperCase()) fundamentals = null;
  // Before the runtime summary carries fiscalHistory, the latest FY facts still give a one-year reading.
  const series = Array.isArray(fundamentals?.fiscalHistory) && fundamentals.fiscalHistory.length ? fundamentals.fiscalHistory
    : fundamentals?.periodType === 'FY' && finite(fundamentals?.revenue) != null ? [{ periodEnd: fundamentals.observedAt || '', revenue: fundamentals.revenue, netIncome: fundamentals.netIncome, equity: fundamentals.equity }] : [];
  const history = reconcileFiscalHistory(series, fundamentals, symbol)
    .filter((year) => finite(year?.revenue) != null)
    .map((year) => ({ ...year, revenue: finite(year.revenue), netIncome: finite(year.netIncome), equity: finite(year.equity),
      margin: finite(year.revenue) && finite(year.netIncome) != null ? finite(year.netIncome) / finite(year.revenue) * 100 : null }));
  const latest = history[history.length - 1] || null;
  const prevYear = history.length >= 2 ? history[history.length - 2] : null;
  const annualPair = isPriorAnnualPeriod(latest, prevYear);
  const lastGrowth = annualPair && prevYear?.revenue > 0 ? latest.verifiedRevGrowth ?? (latest.revenue / prevYear.revenue - 1) * 100 : null;
  const points = [];
  const filed = filerClaim(symbol);
  const fyNow = fyOf(latest);
  const fyPrev = fyOf(prevYear);
  const growthClaim = lastGrowth == null ? null : filed('revenue', [fig(latest.revenue, 'usd', 'revenue', '매출', fyNow), fig(lastGrowth, 'pct', 'revenue', '매출', fyNow, { against: fyPrev })]);
  const marginClaim = latest?.margin == null ? null : filed('margin', [fig(latest.margin, 'share', 'margin', '순이익률', fyNow, { digits: 1 })]);
  if (history.length >= 2) {
    const first = history[0];
    const years = (Date.parse(latest.periodEnd) - Date.parse(first.periodEnd)) / (365.25 * 86400000);
    const cagr = years > 0 && first.revenue > 0 && latest.revenue > 0 ? ((latest.revenue / first.revenue) ** (1 / years) - 1) * 100 : null;
    let streak = 0;
    for (let i = history.length - 1; i > 0 && isPriorAnnualPeriod(history[i], history[i - 1]) && history[i].revenue > history[i - 1].revenue; i--) streak += 1;
    const whole = periodId('SPAN', latest.periodEnd, first.periodEnd);
    const pace = cagr == null ? NOTHING : say(', 약 {pace} 연평균 {pace.1}', { pace: filed('revenueCagr', [fig(Math.round(years), 'years', 'spanYears', '연평균', whole), fig(cagr, 'pct', 'revenueCagr', '연평균', whole)]) });
    const run = streak >= 2 ? say('{run} 연속 증가입니다', { run: filed('growthRun', [fig(streak, 'years', 'growthRun', '연속 증가', fyNow)]) })
      : streak === 1 ? '직전 해보다 늘었습니다' : lastGrowth < 0 ? '직전 해보다 줄었습니다' : '직전 해와 같습니다'; /* v59.45 (P19-FISCAL-01): +0% is not a decline */
    const pacing = cagr != null && lastGrowth > cagr + 10 ? ' — 성장이 최근에 빨라졌습니다' : cagr != null && lastGrowth < cagr - 10 ? ' — 최근 성장은 평균보다 느립니다' : '';
    if (lastGrowth != null) points.push(point('growth', Math.abs(lastGrowth) < FISCAL_FLAT_BAND ? 'neutral' : lastGrowth > 0 ? 'favorable' : 'burden', '매출 흐름',
      say('최근 회계연도 매출 {revenue}({revenue.1}){pace}. {run}{pacing}.', { revenue: growthClaim, pace, run, pacing })));
    const marginNow = latest.margin;
    const thenYear = history[Math.max(0, history.length - 4)];
    const marginThen = thenYear.margin;
    if (marginNow != null && marginThen != null) {
      const delta = marginNow - marginThen;
      const fyThen = fyOf(thenYear);
      // The two years and the change between them: a declared comparison of two fiscal years.
      const m = filed('marginChange', [fig(marginNow, 'share', 'margin', '순이익률', fyNow, { digits: 1 }), fig(marginThen, 'share', 'margin', '회계연도', fyThen, { digits: 1 }),
        fig(delta, 'pp', 'margin', '순이익률', fyNow, { against: fyThen })], { compare: { across: [fyNow, fyThen] } });
      const flipYear = (profit) => { const i = history.findLastIndex((year) => year.margin == null || (profit ? year.margin < 0 : year.margin > 0)); return history[i + 1] || null; };
      const turned = (profit) => annualPair && prevYear?.margin != null && (profit ? prevYear.margin < 0 : prevYear.margin > 0);
      const since = (profit) => { const year = flipYear(profit); const label = year ? fiscalYearLabel(year.periodEnd) : null; return label ? `${label.replace(/^FY/, '')} 회계연도` : '최근 회계연도'; };
      const verdict = Math.abs(delta) < FISCAL_FLAT_BAND ? '수익성이 비슷하게 유지됩니다'
        : delta > 0 ? (marginNow < 0 ? say('적자 폭이 {m.2} 줄었습니다(아직 순손실)', { m }) : marginThen < 0
          ? (turned(true) ? say('적자에서 흑자로 돌아섰습니다(+{m.2})', { m }) : say('{m.2} 높아졌습니다(흑자는 {fy}부터)', { m, fy: since(true) })) : say('{m.2} 높아졌습니다', { m }))
          : marginThen > 0 && marginNow < 0 ? (turned(false) ? '흑자에서 적자로 돌아섰습니다 — 비용·가격 압력을 확인할 지점입니다' : say('{m.2} 낮아졌습니다(적자는 {fy}부터)', { m, fy: since(false) }))
            : marginNow < 0 ? say('적자 폭이 {m.2} 커졌습니다', { m }) : '매출 대비 남는 이익이 줄었습니다 — 비용·가격 압력을 확인할 지점입니다';
      points.push(point('margin', Math.abs(delta) < FISCAL_FLAT_BAND ? 'neutral' : delta > 0 ? 'favorable' : 'burden', '수익성',
        say('순이익률 {m}({then} 회계연도 {m.1}) — {verdict}. 순이익 기준이라 세금·이자·일회성 효과는 나누지 않았습니다.', { m, then: (fiscalYearLabel(thenYear.periodEnd) || String(thenYear.periodEnd).slice(0, 4)).replace(/^FY/, ''), verdict })));
    }
    const niNow = latest.netIncome;
    const niPrev = history[history.length - 2].netIncome;
    if (annualPair && niNow != null && niPrev != null && niPrev > 0) {
      const niGrowth = (niNow / niPrev - 1) * 100;
      const pe = readRowNumber(row, 'pe', 'calculation');
      const commonBasis = row?._valuationPeEarningsConcept === 'common';
      const peg = pe != null && pe > 0 && niGrowth > 0 && row?._valuationPeEarningsBasis !== 'ttm' && !commonBasis ? pe / niGrowth : null;
      const earningsEnd = String(row?._fundamentalPeriodEnd || latest.periodEnd || '').slice(0, 10);
      const sessionEnd = String(row?.factorSessionDate || '').slice(0, 10);
      const monthsSince = isIsoDay(earningsEnd) && isIsoDay(sessionEnd)
        ? (Number(sessionEnd.slice(0, 4)) - Number(earningsEnd.slice(0, 4))) * 12 + Number(sessionEnd.slice(5, 7)) - Number(earningsEnd.slice(5, 7)) - (Number(sessionEnd.slice(8, 10)) < Number(earningsEnd.slice(8, 10)) ? 1 : 0)
        : null;
      const fyLabel = fiscalYearLabel(earningsEnd);
      const elapsed = monthsSince != null && monthsSince >= 0 ? say(', 경과 {elapsed}', { elapsed: filed('monthsSince', [fig(monthsSince, 'months', 'monthsSince', '경과', periodId('AT', sessionEnd))]) }) : NOTHING;
      const earningsBasis = fyLabel ? say('{fy} {concept} 기준, {end} 마감{elapsed}', { fy: fyLabel, concept: commonBasis ? '보통주 귀속 순이익' : '순이익', end: earningsEnd.slice(0, 7), elapsed }) : '공시 이익 기준';
      const rowTtm = row?._valuationPeEarningsBasis === 'ttm' && hasLeadingIsoDay(String(row?._valuationPeEarningsThrough || ''));
      const ttm = pe != null && pe > 0 && (rowTtm || earningsEnd === String(latest.periodEnd || '').slice(0, 10)) ? trailingQuarters(quarters, 4) : null;
      const ttmIncome = ttm && ttm[ttm.length - 1].periodEnd > earningsEnd ? ttm.reduce((sum, q) => sum + q.netIncome, 0) : null;
      const peTtm = rowTtm ? pe : !commonBasis && ttmIncome != null && ttmIncome > 0 ? pe * niNow / ttmIncome : null;
      const prior = peTtm != null ? trailingQuarters(quarters, 8) : null;
      const priorIncome = prior ? prior.slice(0, 4).reduce((sum, q) => sum + q.netIncome, 0) : null;
      const ttmGrowth = priorIncome != null && priorIncome > 0 ? (ttmIncome / priorIncome - 1) * 100 : null;
      const pegTtm = !commonBasis && peTtm != null && ttmGrowth != null && ttmGrowth > 0 ? peTtm / ttmGrowth : null;
      const ttmThrough = rowTtm ? String(row._valuationPeEarningsThrough).slice(0, 10) : ttm?.[ttm.length - 1]?.periodEnd;
      // A one-off gain inside the PER's earnings (sec-valuation-basis secEarningsOneOff) is named beside the multiple it lowers.
      const oneOffEnds = (Array.isArray(fundamentals?.earningsOneOff) ? fundamentals.earningsOneOff : []).filter((end) => isIsoDay(String(end)));
      const oneOff = oneOffEnds.length ? say(', {ends} 분기 일회성 이익 포함', { ends: oneOffEnds.map((end) => end.slice(0, 7)).join('·') }) : NOTHING;
      const lag = String(fundamentals?.peEarningsLag?.laterQuarter || row?._valuationPeEarningsLaterQuarter || '');
      const laterQuarter = isIsoDay(lag) && lag > earningsEnd ? lag : null;
      const ttmPeriod = periodId('TTM', ttmThrough);
      const fyEarnings = periodId('FY', earningsEnd);
      // The row's own PER on its earnings period ('pe'); the same price re-read over the latest four quarters ('peRepriced').
      const peOn = (value, period, basis = 'pe') => filed('pe', [fig(value, 'x', basis, 'PER', period)]);
      const peText = pe == null ? NOTHING : rowTtm
        ? say(', PER {pe}(최근 4개 분기 {concept}순이익 합, {through} 분기까지{oneOff})', { pe: peOn(pe, ttmPeriod), concept: commonBasis ? '보통주 귀속 ' : '공시 ', through: ttmThrough.slice(0, 7), oneOff })
        : peTtm != null
          ? say(', PER 약 {ttm}(최근 4개 분기 합, {through} 분기까지{oneOff}), {fy} 기준 {pe}({basis})', { ttm: peOn(peTtm, ttmPeriod, 'peRepriced'), through: ttmThrough.slice(0, 7), oneOff, fy: fyLabel || '연간', pe: peOn(pe, fyEarnings), basis: earningsBasis })
          // A newer quarter is on file than the earnings this PER is priced on (sec-valuation-basis secPeEarningsLag).
          : say(', PER {pe}({basis}{oneOff}{later})', { pe: peOn(pe, fyEarnings), basis: earningsBasis, oneOff, later: laterQuarter ? `, ${laterQuarter.slice(0, 7)} 분기 공시는 미반영` : '' });
      const pegShown = (value, growth) => (value != null && growth <= PEG_MAX_GROWTH ? value : null);
      const pegFy = pegShown(peg, niGrowth);
      const pegTtmShown = pegShown(pegTtm, ttmGrowth);
      const pegHeldOn = pegFy == null && pegTtmShown == null ? (pegTtm != null ? filed('netIncome', [fig(ttmGrowth, 'pct', 'netIncome', '순이익', ttmPeriod, { against: periodId('TTM', prior?.[3]?.periodEnd) })], { word: 'over-line', compare: { threshold: PEG_MAX_GROWTH, relation: 'above', digits: 0 } })
        : peg != null ? filed('netIncome', [fig(niGrowth, 'pct', 'netIncome', '순이익', fyNow, { against: fyPrev })], { word: 'over-line', compare: { threshold: PEG_MAX_GROWTH, relation: 'above', digits: 0 } }) : null) : null;
      const pegTtmClaim = pegTtmShown == null ? null : filed('peg', [fig(pegTtmShown, 'ratio', 'peg', 'PEG', ttmPeriod)]);
      const pegText = pegFy != null
        ? say(', PEG {peg}({fy}PER ÷ {fyGrowth}순이익 성장률){ttm}', { peg: filed('peg', [fig(pegFy, 'ratio', 'peg', 'PEG', fyEarnings)]), fy: fyLabel ? `${fyLabel} ` : '', fyGrowth: fyLabel ? `${fyLabel} ` : '그 회계연도 ',
          ttm: pegTtmClaim ? say(', 최근 4개 분기 합 기준 약 {peg}', { peg: pegTtmClaim }) : NOTHING })
        : pegTtmClaim ? say(', PEG 약 {peg}(최근 4개 분기 PER ÷ 그 전 4개 분기 대비 순이익 성장률)', { peg: pegTtmClaim }) : NOTHING;
      const pegHeld = pegHeldOn ? say('. PEG는 적지 않습니다 — 순이익 성장({g})이 {g.threshold}를 넘으면 PEG가 0에 가까워져 뜻이 없습니다', { g: pegHeldOn }) : NOTHING;
      const income = filed('netIncome', [fig(niNow, 'usd', 'netIncome', '순이익', fyNow), fig(niGrowth, 'pct', 'netIncome', '순이익', fyNow, { against: fyPrev })]);
      points.push(point('earnings', niGrowth > FISCAL_FLAT_BAND ? 'favorable' : niGrowth < -FISCAL_FLAT_BAND ? 'burden' : 'neutral', '이익과 가격', /* v57.84: the same flat band as revenue and margin */
        say('순이익 {income}({income.1}){pe}{peg}{held}.{tail}', { income, pe: peText, peg: pegText, held: pegHeld, tail: pegText.text ? ' PEG는 지난 성장률로 계산한 값이라, 앞으로의 성장이 다르면 같은 숫자도 뜻이 달라집니다.' : '' }),
        peTtm != null ? { peTtm, ttmThrough } : {}));
    }
  } else if (latest) {
    const growth = finite(fundamentals?.revGrowth);
    // The one-year reading's growth is the filing's own year-over-year figure; its prior year is not on file here.
    const single = filed('revenue', [fig(latest.revenue, 'usd', 'revenue', '매출', fyNow), ...(growth != null ? [fig(growth, 'pct', 'revGrowth', '전년 대비', fyNow)] : [])]);
    points.push(point('single', growth == null || Math.abs(growth) < FISCAL_FLAT_BAND ? 'neutral' : growth > 0 ? 'favorable' : 'burden', '공시 기록',
      say('회계연도 {end} 매출 {single}{growth}{margin}. 여러 해 추이 그래프는 다음 재무 데이터 갱신 뒤 표시됩니다.', { end: latest.periodEnd || '최근', single,
        growth: growth != null ? say('(전년 대비 {single.1})', { single }) : NOTHING, margin: marginClaim ? say(', 순이익률 {margin}', { margin: marginClaim }) : NOTHING })));
  }
  const avgEquity = annualPair && latest?.equity > 0 && prevYear?.equity > 0 ? (latest.equity + prevYear.equity) / 2 : null;
  const roeAvg = avgEquity && latest?.netIncome != null ? latest.netIncome / avgEquity * 100 : null;
  const alignedLatest = latest?.periodEnd && latest.periodEnd === fundamentals?.observedAt && (!fundamentals?.symbol || String(fundamentals.symbol).toUpperCase() === String(symbol).toUpperCase());
  const roe = roeAvg ?? (alignedLatest ? finite(fundamentals?.roe) : null);
  const kind = financialKind(symbol, row?.sector, sic ?? row?.sic);
  const financial = kind === 'lending';
  const insurer = kind === 'insurer';
  // "전년보다": only the fiscal year before (isPriorAnnualPeriod), never an older row across a gap.
  const equityChange = annualPair && latest?.equity > 0 && prevYear?.equity > 0 ? (latest.equity / prevYear.equity - 1) * 100 : null;
  const roeBasis = roeAvg != null ? '평균 자기자본 기준' : '기말 자기자본 기준';
  const roeClaim = roe == null ? null : filed('roe', [fig(roe, 'share', roeAvg != null ? 'roeAvg' : 'roeEnd', 'ROE', fyNow, { digits: 1 })]);
  if (roe != null) {
    const equity = equityChange == null ? null : filed('equity', [fig(equityChange, 'pct', 'equity', '자기자본', fyNow, { against: fyPrev })]);
    const equityNote = equity && roe > 0 ? say(equityChange > 0 ? '. 자기자본이 전년보다 {equity} 늘었는데도 나온 수준입니다' : '. 자기자본이 전년보다 {equity} 줄어든 효과가 섞여 있습니다', { equity }) : NOTHING;
    const high = roe >= 40 ? say(' 이 수준에서는 순이익률{margin}·자산 회전·재무 레버리지 중 무엇이 끌어올렸는지 나눠 봐야 합니다. {dupont}{equityNote}.', { margin: marginClaim ? say('({margin})', { margin: marginClaim }) : NOTHING,
      dupont: finite(latest?.totalAssets) > 0 ? '종목 개요의 듀폰 분해 카드가 세 요인을 나눠 보여 줍니다' : latest?.assetChain ? '총자산이 공시 수집본에 없어 그 분해는 하지 않습니다' : '총자산 수집이 끝나면 종목 개요의 듀폰 분해 카드에서 나눠 봅니다', equityNote }) : NOTHING;
    const verdict = roe < 0 ? (equityChange != null && equityChange < 0 ? '순손실로 자본이 줄어든 해' : latest?.equity > 0 && (equityChange > 0 || !(prevYear?.equity > 0)) ? '순손실을 냈지만 증자 등으로 자기자본은 늘어난 해' : '순손실을 낸 해') /* v58.74 (audit): BE/CRWV equity grew in the loss year */
      : roe >= 20 ? '자기자본 대비 높은 이익' : roe >= 10 ? '평균적인 자본 효율' : '자본 대비 이익이 낮은 편';
    points.push(point('roe', roe >= 20 ? 'favorable' : roe < 5 ? 'burden' : 'neutral', '자본 효율', /* v57.84: green only where the text says 높은 (≥20) */
      say('ROE {roe}({basis}) — {verdict}입니다.{high}', { roe: roeClaim, basis: roeBasis, verdict, high })));
  }
  const ocf = finite(latest?.operatingCashFlow);
  const capex = finite(latest?.capex);
  if (financial && history.length) {
    points.push({ id: 'bank', tone: 'neutral', title: '금융사 재무',
      text: '은행·금융사는 순이자이익과 순이자마진(NIM), 예금 조달 비용, 대손비용, 자본비율(CET1)이 핵심입니다. 이 화면의 공시 수집본에는 이 항목들이 없어 판단하지 않으며, 분기 실적 자료와 10-K·10-Q 원문에서 확인합니다. 아래 영업현금흐름은 예금·대출 변화가 섞여 일반 기업처럼 읽지 않습니다.' });
  }
  if (insurer && history.length) {
    points.push({ id: 'insurer', tone: 'neutral', title: '보험사 재무',
      text: '보험사는 합산비율(손해율+사업비율), 보험료 성장, 투자수익, 준비금이 핵심입니다. 이 화면의 공시 수집본에는 이 항목들이 없어 판단하지 않으며, 분기 실적 자료와 10-K·10-Q 원문에서 확인합니다. 아래 영업현금흐름은 먼저 받은 보험료와 나중에 나가는 보험금의 시차가 섞여 일반 기업처럼 읽지 않습니다.' });
  }
  const cashPair = ocf != null && latest?.netIncome != null
    ? filed('cash', [fig(ocf, 'usd', 'operatingCashFlow', '영업현금흐름', fyNow), fig(latest.netIncome, 'usd', 'netIncome', '순이익', fyNow)]) : null;
  const cashNote = (reading) => point('cash', 'neutral', '현금흐름(참고)', say('영업현금흐름 {cash}, 순이익 {cash.1} — {reading}', { cash: cashPair, reading }));
  if (cashPair && financial) {
    points.push(cashNote('금융사의 영업현금흐름은 예금·대출·트레이딩 자산 증감이 섞여, 마이너스여도 현금이 부족하다는 뜻이 아닙니다.'));
  } else if (cashPair && insurer) {
    points.push(cashNote('보험사의 영업현금흐름은 보험료 수입과 보험금 지급의 시차, 준비금 증감이 섞여 순이익 대비 비율로 읽지 않습니다.'));
  } else if (cashPair && kind === 'reit') {
    // A REIT buys buildings through investing cash flow, not PP&E capex, and depreciation depresses its net income.
    points.push(cashNote('리츠는 건물 매입이 설비투자가 아닌 투자활동으로 잡혀 잉여현금흐름을 계산하지 않습니다. 배당 여력은 FFO·AFFO로 확인합니다.'));
  } else if (cashPair) {
    const creditableConversion = latest.netIncome > 0 && ocf > 0;
    const conversion = creditableConversion ? ocf / latest.netIncome : null;
    const fcf = capex != null ? ocf - capex : null;
    const tone = creditableConversion && conversion >= 0.8 && (fcf == null || fcf > 0) ? 'favorable' : 'neutral';
    if (!creditableConversion) {
      const reading = latest.netIncome < 0 && ocf > 0 ? '장부상 순손실이지만 영업에서는 현금이 들어왔습니다. 비현금 비용(감가상각·주식 보상)이 손실을 키웠는지 현금흐름표에서 확인합니다' : latest.netIncome > 0 && ocf < 0 ? '장부상 이익이지만 영업현금은 빠져나갔습니다. 매출채권·재고가 늘었는지 확인합니다' : latest.netIncome < 0 && ocf < 0 ? '순손실과 영업현금 유출이 함께 나타났습니다. 현금 잔고와 조달 계획을 확인합니다'
        : `${latest.netIncome === 0 ? '순이익 0(손익분기)' : latest.netIncome < 0 ? '순손실' : '장부상 이익'}, ${ocf === 0 ? '영업현금흐름 0' : ocf < 0 ? '영업현금 유출' : '영업현금 유입'}입니다`;
      points.push(point('cash', tone, '현금 전환', say('영업현금흐름 {cash}, 순이익 {cash.1} — {reading}. {side} 순이익 대비 현금 비율은 쓰지 않습니다.', { cash: cashPair, reading, side: latest.netIncome === 0 || ocf === 0 ? '한쪽이 0이라' : '한쪽이 마이너스라' })));
    } else {
      const converted = filed('cashConversion', [fig(ocf, 'usd', 'operatingCashFlow', '영업현금흐름', fyNow), fig(conversion * 100, 'share', 'cashConversion', '순이익의', fyNow)]);
      const capexAmount = fcf == null ? null : filed('fcf', [fig(capex, 'usd', 'capex', '설비투자', fyNow), fig(fcf, 'usd', 'fcf', '잉여현금흐름', fyNow), fig(fcf / latest.revenue * 100, 'share', 'fcfMargin', '매출의', fyNow, { digits: 1 })]);
      const free = capexAmount ? say(', 설비투자 {free}{particle} 뺀 잉여현금흐름 {free.1}(매출의 {free.2})', { free: capexAmount, particle: withObjectParticle(formatUsdShort(capex)).slice(formatUsdShort(capex).length) }) : NOTHING;
      points.push(point('cash', tone, '현금 전환', say('영업현금흐름 {cash}(순이익의 {cash.1}){free} — {reading}.', { cash: converted, free,
        reading: conversion >= 0.8 ? (conversion >= 1 ? '이익이 현금으로 들어오고 있습니다' : '이익의 대부분이 현금으로 들어왔습니다') : '장부 이익보다 들어온 현금이 적어 운전자본·회계 이익을 확인할 지점입니다' })));
    }
  }
  if (ocf == null && history.length) points.push({ id: 'cash', tone: 'neutral', title: '현금 전환', text: '이 회사의 공시 수집본에는 영업현금흐름·설비투자가 없어 잉여현금흐름과 ROIC(투하자본 대비 이익)는 이 화면에서 계산하지 않습니다. 10-K 현금흐름표에서 확인하며, 다른 출처의 FCF 값과 기간을 섞어 쓰지 않습니다.' });
  const debtNow = finite(latest?.longTermDebt);
  const debtPrev = finite(prevYear?.longTermDebt);
  if (annualPair && debtNow != null && debtPrev != null && debtPrev > 0 && !financial && !insurer) {
    const change = (debtNow / debtPrev - 1) * 100;
    const label = debtLabel(debtBasis);
    const debt = filed('debt', [fig(debtNow, 'usd', 'longTermDebt', label, fyNow), fig(change, 'pct', 'longTermDebt', label, fyNow, { against: fyPrev }),
      ...(latest?.equity > 0 ? [fig(debtNow / latest.equity * 100, 'share', 'debtToEquity', '자기자본 대비', fyNow)] : [])]);
    points.push(point('debt', change > 25 ? 'burden' : 'neutral', '부채',
      say('{label} {debt}(전년 대비 {debt.1}){equity}.', { label, debt, equity: latest?.equity > 0 ? say(', 자기자본 대비 {debt.2}', { debt }) : NOTHING })));
  }
  // Share count across years, skipping year-over-year jumps that look like splits (near-integer ratios ≥ 1.9).
  const shareYears = history.filter((year) => finite(year.shares) > 0);
  if (shareYears.length >= 2) {
    let factor = 1;
    let splitSeen = false;
    for (let k = 1; k < shareYears.length; k += 1) {
      const ratio = shareYears[k].shares / shareYears[k - 1].shares;
      const inverse = 1 / ratio;
      const nearSplit = (x) => x >= 1.9 && Math.abs(x - Math.round(x)) / Math.round(x) < 0.06; // buybacks between cover dates blur exact ratios
      if (nearSplit(ratio) || nearSplit(inverse)) { splitSeen = true; continue; }
      factor *= ratio;
    }
    const change = (factor - 1) * 100;
    const span = Math.max(1, Math.round((Date.parse(shareYears.at(-1).periodEnd) - Date.parse(shareYears[0].periodEnd)) / (365.25 * 86400000))) || shareYears.length - 1;
    const held = periodId('SPAN', shareYears.at(-1).periodEnd, shareYears[0].periodEnd);
    const shares = filed('shares', [fig(span, 'years', 'spanYears', '동안', held), fig(change, 'pct', 'sharesSplitAdjusted', '발행 주식 수', held)]);
    points.push(point('shares', change <= -1 ? 'favorable' : change >= 3 ? 'burden' : 'neutral', '주식 수',
      say('{shares} 동안 발행 주식 수 {shares.1}{split} — {reading}.', { shares, split: splitSeen ? '(주식 분할로 보이는 변화는 제외)' : '',
        reading: change <= -1 ? '남은 주주의 지분 비율이 커졌습니다(주당 가치가 커졌는지는 매입 가격과 쓴 현금에 달림)' : change >= 3 ? '신주 발행·보상 주식으로 기존 주주의 지분 비율이 줄었습니다' : '거의 변하지 않았습니다' })));
  }

  const ret6 = readRowNumber(row, 'ret6m', 'display');
  if (ret6 != null && lastGrowth != null) {
    const fy = String(latest.periodEnd || '').slice(0, 7);
    // Two claims, two periods, not compared: six months of prices to the session and the last fiscal year.
    const price = filed('ret6m', [fig(ret6, 'pct', 'ret6m', '주가', periodId('M6', row?.factorSessionDate))]);
    points.push(point('agree', 'neutral', '주가와 실적의 기간',
      say('주가는 최근 6개월 {price}, 매출은 {fy}회계연도에 {revenue.1}입니다. 두 숫자는 기간이 달라 직접 비교하지 않습니다 — 주가가 반영하는 것은 앞으로의 실적이고, 다음 분기 공시가 그 기대를 확인합니다.', { price, fy: fy ? `${fy}에 끝난 ` : '', revenue: growthClaim })));
  }
  const filing = latest ? annualFilingStatus(latest.periodEnd, now ?? (row?.factorSessionDate || Date.now())) : null;
  const lead = !history.length ? null : sayJoin([filing ? say('{fy}', { fy: filing.fyLabel }) : NOTHING,
    sayJoin([growthClaim ? say('매출 {revenue.1}', { revenue: growthClaim }) : NOTHING, marginClaim ? say('순이익률 {margin}', { margin: marginClaim }) : NOTHING,
      roeClaim ? say('ROE {roe}({basis})', { roe: roeClaim, basis: roeBasis }) : NOTHING, filing?.overdue ? say('다음 연간 공시 예정 지남') : NOTHING], ', ')], ' ');
  return { available: history.length > 0, symbol, history, latest, headline: lead ? lead.text : null, headlineClaims: lead ? lead.claims : [], points, roe, roeBasis, lastGrowth, filing };
}
