// 이익의 질 (재무 공시 ② 현금흐름과 발생액): operating cash flow against net income for each filed year, the Sloan (1996)
// accrual ratio (analysis-read buildAccrualRead, passed in), the latest free-cash-flow margin and the one-year share count
// change. Every printed figure is a claim on the filer (src/domain/shared/claim.js); the card renders these texts only.
import { say, sayJoin, NOTHING, periodId } from '../shared/claim.js';
import { readNumber } from '../shared/number.js';
import { fiscalYearLabel } from './period.js';
import { filerClaim, shareSplitBreaks } from './fiscal-read.js';

const fig = (value, unit, basis, label, period, more = {}) => ({ value, unit, basis, label, period, ...more });
/** Operating cash flow ÷ net income when both are positive; otherwise the ratio does not read as earnings quality. */
export const cashRatioOf = (year) => (year.netIncome > 0 && year.operatingCashFlow > 0 ? year.operatingCashFlow / year.netIncome : null);

/**
 * history: the reconciled fiscal series (fiscal-read buildFiscalRead `history`); accrual: buildAccrualRead(history), or
 * { state: 'loading' } until the analysis chunk arrives. Null when the latest year has no operating cash flow.
 */
export function buildEarningsQuality({ symbol, history = [], accrual = { state: 'loading' } } = {}) {
  const latest = history.at(-1);
  if (!latest || readNumber(latest.operatingCashFlow) == null) return null;
  const filed = filerClaim(symbol);
  const fy = (year) => periodId('FY', year.periodEnd);
  const ratioClaim = (year, label) => filed('cashRatio', [fig(cashRatioOf(year), 'ratio', 'cashRatio', label, fy(year))]);
  const years = history.filter((year) => readNumber(year.operatingCashFlow) != null && readNumber(year.netIncome) != null).slice(-5);
  const trend = years.map((year) => ({ periodEnd: year.periodEnd, ratio: cashRatioOf(year), label: fiscalYearLabel(year.periodEnd), claim: cashRatioOf(year) == null ? null : ratioClaim(year, fiscalYearLabel(year.periodEnd)) }));
  const plotted = trend.filter((item) => item.ratio != null).length >= 2 ? trend : [];
  const trendLabel = plotted.length ? say('영업현금흐름 ÷ 순이익 {n}개 회계연도: {years}', { n: String(plotted.length),
    years: sayJoin(plotted.map((item) => (item.claim ? say('{label} {ratio}', { label: item.label, ratio: item.claim }) : say('{label} 해당 없음', { label: item.label }))), ', ') }) : NOTHING;
  const ratio = cashRatioOf(latest);
  const now = ratio == null ? null : ratioClaim(latest, '영업현금흐름 ÷ 순이익');
  const rows = [{ id: 'cash-ratio', name: '영업현금흐름 ÷ 순이익',
    detail: ratio == null ? '순이익·현금흐름 중 하나가 마이너스 — 비율 해석 보류' : ratio >= 1 ? '1 이상 — 이익이 현금으로 들어옴' : ratio >= 0.8 ? '0.8~1 — 이익 대부분이 현금으로 들어옴' : '1보다 낮음 — 장부 이익보다 현금이 적음',
    value: now ? say('{ratio}', { ratio: now }) : say('해당 없음') }];
  // The accrual ratio of each year: (net income − operating cash flow) ÷ average (or year-end) total assets.
  const accrualClaim = (year, label = '발생액 비율') => filed('accrual', [fig(year.ratio * 100, 'pct', year.basis === 'average' ? 'accrualAvg' : 'accrualEnd', label, periodId('FY', year.periodEnd))]);
  const accrualLatest = accrual.state === 'ready' ? accrual.latest : null;
  if (accrual.state === 'pending') rows.push({ id: 'accrual', name: '이익 중 현금이 아닌 몫 (발생액 비율)', detail: null, pending: true, value: say('대기') });
  else if (accrual.state === 'unreported') rows.push({ id: 'accrual', name: '이익 중 현금이 아닌 몫 (발생액 비율)', detail: '총자산이 공시 수집본에 없어 계산하지 않음', value: say('해당 없음') });
  else if (accrualLatest) {
    const value = accrualLatest.ratio;
    const word = value > -0.01 && value < 0.01 ? '장부 이익과 현금이 거의 같음' : value < 0 ? '현금이 장부 이익보다 많이 들어옴' : value < 0.05 ? '장부 이익 일부가 아직 현금이 아님' : '장부 이익 중 현금이 아닌 부분이 자산 대비 큼';
    // The row reads in words; the formula and each year's ratio are the hover.
    rows.push({ id: 'accrual', name: '이익 중 현금이 아닌 몫 (발생액 비율)', burden: value >= 0.05,
      detail: `순이익에서 실제 들어온 영업 현금을 뺀 값을 총자산으로 나눔, ${accrualLatest.label}${accrual.latestIsNewest ? '' : ' (최근 연도 자료 없음)'} — ${word}`,
      value: say('{accrual}', { accrual: accrualClaim(accrualLatest) }),
      hover: say('(순이익 − 영업현금흐름) ÷ {basis} 총자산 (Sloan 1996). {years}', { basis: accrualLatest.basis === 'average' ? '평균' : '기말',
        years: sayJoin(accrual.years.map((year) => say('{label} {accrual}{end}', { label: year.label, accrual: accrualClaim(year, year.label), end: year.basis === 'average' ? '' : '(기말)' })), ', ') }) });
  }
  const capex = readNumber(latest.capex);
  if (capex != null && latest.revenue > 0) {
    rows.push({ id: 'fcf-margin', name: '잉여현금흐름 마진', detail: '매출 중 설비투자까지 쓰고 남은 현금의 비율',
      value: say('{margin}', { margin: filed('fcfMargin', [fig((latest.operatingCashFlow - capex) / latest.revenue * 100, 'share', 'fcfMargin', '잉여현금흐름 마진', fy(latest), { digits: 1 })]) }) });
  }
  const prev = history.at(-2);
  if (readNumber(latest.shares) > 0 && readNumber(prev?.shares) > 0) {
    const split = shareSplitBreaks(history).includes(latest.periodEnd);
    const change = (latest.shares / prev.shares - 1) * 100;
    rows.push({ id: 'shares', name: '주식 수 변화 (1년)', detail: split ? '주식 분할 해 — 분할 전후라 비교 보류' : change <= -0.5 ? '자사주 매입이 보상 주식 발행보다 많음' : change >= 0.5 ? '신주·보상 주식으로 주식 수 증가' : '거의 변하지 않음',
      value: split ? say('분할') : say('{shares}', { shares: filed('shares', [fig(change, 'pct', 'shares', '주식 수', fy(latest), { against: fy(prev) })]) }) });
  }
  // The two signals can disagree (cash 0.86 of income, yet accruals +10.9% of assets): both are said, with what to check.
  const reconcile = ratio != null && ratio >= 0.8 && accrualLatest && accrualLatest.ratio >= 0.05 && latest.netIncome > latest.operatingCashFlow
    ? say('이익의 {cash}는 현금으로 들어왔지만, 현금이 아닌 이익({cash.1})이 자산 대비 큽니다(발생액 비율 {accrual}). 매출이 빠르게 늘 때는 매출채권·재고가 함께 느는 경우가 많아, 다음 분기 현금 전환을 확인합니다.', {
      cash: filed('cashConversion', [fig(ratio * 100, 'share', 'cashConversion', '이익의', fy(latest)), fig(latest.netIncome - latest.operatingCashFlow, 'usd', 'nonCashIncome', '현금이 아닌 이익', fy(latest))]),
      accrual: accrualClaim(accrualLatest) })
    : null;
  const reading = sayJoin([ratio == null ? say('{end} 회계연도는 순이익이나 영업현금흐름이 마이너스라 비율로 읽지 않고 두 금액을 따로 봅니다.', { end: latest.periodEnd })
    : say('{end} 회계연도 영업현금흐름은 순이익의 {cash}입니다{bars}.', { end: latest.periodEnd, cash: filed('cashConversion', [fig(ratio * 100, 'share', 'cashConversion', '순이익의', fy(latest))]),
      bars: plotted.length >= 2 ? say(' — 위 막대는 공시된 {n}개 회계연도의 같은 비율입니다', { n: String(plotted.length) }) : '' }),
  accrualLatest ? say(' 발생액 비율은 {label} {accrual}로, 마이너스일수록 현금이 이익보다 많이 들어왔다는 뜻입니다.', { label: accrualLatest.label, accrual: accrualClaim(accrualLatest) }) : NOTHING], '');
  return { latest, ratio, trend: plotted, trendLabel, rows, reconcile, reading, accrualState: accrual.state };
}
