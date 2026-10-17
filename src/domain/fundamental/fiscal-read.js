// P1436 (재무 공시 redesign): read the company's own annual filings as a trend — is revenue growing,
// is the business getting more profitable, and does the stock's price move agree with it — instead of
// one year's raw numbers. Inputs: the SEC FY series in the runtime summary (fiscalHistory) and the
// screener row for price context (returns, P/E). A missing year or field drops its sentence.
import { withObjectParticle } from '../content/korean-particle.js';
import { finiteFact, isPriorAnnualPeriod, annualFilingStatus, fiscalYearLabel } from './period.js';
// v57.81: a change inside this many %p (margin) or % (revenue) reads as flat in the text, so its tone is neutral too.
export const FISCAL_FLAT_BAND = 2;
const NON_LENDING_FINANCIALS = new Set(['V', 'MA', 'PYPL', 'FI', 'FIS', 'GPN', 'CPAY', 'JKHY', 'CME', 'ICE', 'NDAQ', 'CBOE', 'SPGI', 'MCO', 'MSCI', 'FDS', 'BLK', 'BX', 'KKR', 'APO', 'ARES', 'TROW', 'BEN', 'IVZ', 'AMP', 'BR']);
export const isLendingFinancial = (symbol, sector) => /financ|bank/i.test(String(sector || '')) && !NON_LENDING_FINANCIALS.has(String(symbol || '').toUpperCase());

const finite = finiteFact;
const signed = (value, digits = 1, unit = '%') => `${value >= 0 ? '+' : ''}${value.toFixed(digits)}${unit}`;

export function formatUsdShort(value) {
  const v = finite(value);
  if (v == null) return '—';
  const abs = Math.abs(v);
  // 2026-10-13 review S18: the sign precedes the currency ("−$147.8B", not "$-147.8B").
  const sign = v < 0 ? '−' : '';
  return abs >= 1e12 ? `${sign}$${(abs / 1e12).toFixed(2)}T` : abs >= 1e9 ? `${sign}$${(abs / 1e9).toFixed(1)}B` : abs >= 1e6 ? `${sign}$${(abs / 1e6).toFixed(0)}M` : `${sign}$${abs.toFixed(0)}`;
}

// P1627: the compact history used to round every amount to a whole USD million.
// Replace only the matching annual period with the issuer's precise filed facts;
// never inject a later quarter, another issuer, or a cover-page share count into FY equity.
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

// 2026-10-14 audit #2: the four latest consecutive fiscal quarters (about 3 months apart, no gap), newest last, or null.
// A derived fourth quarter (FY − Q1..Q3) counts; nothing is estimated beyond the published quarters.
export function trailingQuarters(quarters = [], count = 4) {
  const rows = (Array.isArray(quarters) ? quarters : []).filter((q) => /^\d{4}-\d{2}-\d{2}$/.test(String(q?.periodEnd || '')))
    .slice().sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  if (rows.length < count) return null;
  const span = rows.slice(-count);
  for (let i = 1; i < span.length; i += 1) {
    const gapDays = (Date.parse(span[i].periodEnd) - Date.parse(span[i - 1].periodEnd)) / 86400000;
    if (!(gapDays >= 75 && gapDays <= 105)) return null;
  }
  return span.every((q) => finite(q.netIncome) != null) ? span : null;
}

// 2026-10-14 audit #21: year-over-year share counts that jump by a near-integer ratio (a split the cover-page count
// was not adjusted for). Returns the periodEnd of each year that starts a new split basis.
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

export function buildFiscalRead({ symbol, fundamentals = null, row = null, quarters = [], now = null } = {}) {
  // P1627: a previous issuer's transient receipt cannot become this issuer's one-year fallback.
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
  if (history.length >= 2) {
    const first = history[0];
    const years = (Date.parse(latest.periodEnd) - Date.parse(first.periodEnd)) / (365.25 * 86400000);
    const cagr = years > 0 && first.revenue > 0 && latest.revenue > 0 ? ((latest.revenue / first.revenue) ** (1 / years) - 1) * 100 : null;
    let streak = 0;
    for (let i = history.length - 1; i > 0 && isPriorAnnualPeriod(history[i], history[i - 1]) && history[i].revenue > history[i - 1].revenue; i--) streak += 1;
    const pace = cagr == null ? '' : ` · 약 ${Math.round(years)}년 연평균 ${signed(cagr)}`;
    if (lastGrowth != null) points.push({ id: 'growth', tone: Math.abs(lastGrowth) < FISCAL_FLAT_BAND ? 'neutral' : lastGrowth > 0 ? 'favorable' : 'burden', title: '매출 흐름',
      text: `최근 회계연도 매출 ${formatUsdShort(latest.revenue)}(${signed(lastGrowth)})${pace}. ${streak >= 2 ? `${streak}년 연속 증가입니다` : streak === 1 ? '직전 해보다 늘었습니다' : '직전 해보다 줄었습니다'}${cagr != null && lastGrowth > cagr + 10 ? ' — 성장이 최근에 빨라졌습니다' : cagr != null && lastGrowth < cagr - 10 ? ' — 최근 성장은 평균보다 느립니다' : ''}.` });
    const marginNow = latest.margin;
    const thenYear = history[Math.max(0, history.length - 4)];
    const marginThen = thenYear.margin;
    if (marginNow != null && marginThen != null) {
      const delta = marginNow - marginThen;
      // P1449: this read sees revenue and net income only. It cannot split interest, tax or
      // one-offs from operations, so attribution like "영업 레버리지" is withheld (P1441 family).
      points.push({ id: 'margin', tone: Math.abs(delta) < FISCAL_FLAT_BAND ? 'neutral' : delta > 0 ? 'favorable' : 'burden', title: '수익성',
        text: `순이익률 ${marginNow.toFixed(1)}%(${(fiscalYearLabel(thenYear.periodEnd) || String(thenYear.periodEnd).slice(0, 4)).replace(/^FY/, '')} 회계연도 ${marginThen.toFixed(1)}%) — ${Math.abs(delta) < FISCAL_FLAT_BAND ? '수익성이 비슷하게 유지됩니다' : delta > 0 ? `${Math.abs(delta).toFixed(1)}%p 높아졌습니다(순이익 기준 관측이며, 세금·이자·일회성 항목과 영업 효과의 구분은 이 화면의 자료로 검증하지 않습니다)` : '매출 대비 남는 이익이 줄었습니다 — 비용·가격 압력을 확인할 지점입니다'}.` });
    }
    const niNow = latest.netIncome;
    const niPrev = history[history.length - 2].netIncome;
    if (annualPair && niNow != null && niPrev != null && niPrev > 0) {
      const niGrowth = (niNow / niPrev - 1) * 100;
      const pe = finite(row?.pe);
      const peg = pe != null && pe > 0 && niGrowth > 0 ? pe / niGrowth : null;
      // 2026-10-13 review S06: the PER's earnings are the last filed fiscal year, which can be more than a year old.
      // Name that year and how many months have passed since it closed.
      const earningsEnd = String(row?._fundamentalPeriodEnd || latest.periodEnd || '').slice(0, 10);
      const sessionEnd = String(row?.factorSessionDate || '').slice(0, 10);
      const monthsSince = /^\d{4}-\d{2}-\d{2}$/.test(earningsEnd) && /^\d{4}-\d{2}-\d{2}$/.test(sessionEnd)
        ? (Number(sessionEnd.slice(0, 4)) - Number(earningsEnd.slice(0, 4))) * 12 + Number(sessionEnd.slice(5, 7)) - Number(earningsEnd.slice(5, 7)) - (Number(sessionEnd.slice(8, 10)) < Number(earningsEnd.slice(8, 10)) ? 1 : 0)
        : null;
      const fyLabel = fiscalYearLabel(earningsEnd);
      const earningsBasis = fyLabel ? `${fyLabel} 순이익 기준 · ${earningsEnd.slice(0, 7)} 마감${monthsSince != null && monthsSince >= 0 ? ` · 경과 ${monthsSince}개월` : ''}` : '공시 이익 기준';
      // 2026-10-14 audit #2: the PER method is unchanged (the last fiscal year's net income). When four newer
      // consecutive quarters are filed, the same price over their summed net income is shown beside it, labelled.
      // Valid only when the PER's own year is the latest annual row (so PER × FY income recovers the same market value).
      const ttm = pe != null && pe > 0 && earningsEnd === String(latest.periodEnd || '').slice(0, 10) ? trailingQuarters(quarters, 4) : null;
      const ttmIncome = ttm && ttm[ttm.length - 1].periodEnd > earningsEnd ? ttm.reduce((sum, q) => sum + q.netIncome, 0) : null;
      const peTtm = ttmIncome != null && ttmIncome > 0 ? pe * niNow / ttmIncome : null;
      const prior = peTtm != null ? trailingQuarters(quarters, 8) : null;
      const priorIncome = prior ? prior.slice(0, 4).reduce((sum, q) => sum + q.netIncome, 0) : null;
      const ttmGrowth = priorIncome != null && priorIncome > 0 ? (ttmIncome / priorIncome - 1) * 100 : null;
      const pegTtm = peTtm != null && ttmGrowth != null && ttmGrowth > 0 ? peTtm / ttmGrowth : null;
      // v57.54 review: the four-quarter figure is the more current one, so it leads when it exists; the fiscal-year
      // PER (the screener's value factor basis) stays beside it, labelled.
      const peText = pe == null ? '' : peTtm != null
        ? `, PER 약 ${peTtm.toFixed(1)}배(최근 4개 분기 합 · ${ttm[ttm.length - 1].periodEnd.slice(0, 7)} 분기까지) · ${fyLabel || '연간'} 기준 ${pe.toFixed(1)}배(${earningsBasis})`
        : `, PER ${pe.toFixed(1)}배(${earningsBasis})`;
      points.push({ id: 'earnings', tone: niGrowth > FISCAL_FLAT_BAND ? 'favorable' : niGrowth < -FISCAL_FLAT_BAND ? 'burden' : 'neutral', title: '이익과 가격', /* v57.84: the same flat band as revenue and margin */
        // Codex review 2026-10-05: a PEG from last year's income growth cannot say whether the price is a
        // burden — that needs the growth ahead. The number is shown with its basis, without a verdict.
        text: `순이익 ${formatUsdShort(niNow)}(${signed(niGrowth)})${peText}${peg != null ? `, PEG ${peg.toFixed(2)}(${fyLabel ? `${fyLabel} ` : ''}PER ÷ ${fyLabel ? `${fyLabel} ` : '그 회계연도 '}순이익 성장률)${pegTtm != null ? ` · 최근 4개 분기 합 기준 약 ${pegTtm.toFixed(2)}` : ''}` : ''}. PEG는 지난 성장률로 계산한 값이라, 앞으로의 성장이 다르면 같은 숫자도 뜻이 달라집니다.`,
        ...(peTtm != null ? { peTtm, ttmThrough: ttm[ttm.length - 1].periodEnd } : {}) });
    }
  } else if (latest) {
    const growth = finite(fundamentals?.revGrowth);
    points.push({ id: 'single', tone: growth == null ? 'neutral' : growth >= 0 ? 'favorable' : 'burden', title: '공시 기록', text: `회계연도 ${latest.periodEnd || '최근'} 매출 ${formatUsdShort(latest.revenue)}${growth != null ? `(전년 대비 ${signed(growth)})` : ''}${latest.margin != null ? `, 순이익률 ${latest.margin.toFixed(1)}%` : ''}. 여러 해 추이 그래프는 다음 재무 데이터 갱신 뒤 표시됩니다.` });
  }
  // P1446 (review 2026-10-04): ROE was net income ÷ year-end equity; with two year-ends it is now over the
  // average equity, and the basis is named. A very high value is read with the buyback/leverage caveat.
  const avgEquity = annualPair && latest?.equity > 0 && prevYear?.equity > 0 ? (latest.equity + prevYear.equity) / 2 : null;
  const roeAvg = avgEquity && latest?.netIncome != null ? latest.netIncome / avgEquity * 100 : null;
  const alignedLatest = latest?.periodEnd && latest.periodEnd === fundamentals?.observedAt && (!fundamentals?.symbol || String(fundamentals.symbol).toUpperCase() === String(symbol).toUpperCase());
  const roe = roeAvg ?? (alignedLatest ? finite(fundamentals?.roe) : null);
  // Codex browser audit H41: a bank's operating cash flow mixes deposit, loan and trading-asset swings, so the
  // industrial "earnings → cash" reading does not apply; the bank questions are named instead.
  // v57.70 (2026-10-15 audit): Visa read "은행·금융사는 순이자마진(NIM)…". Payment networks, exchanges, rating/data
  // houses and asset managers sit in the Financials sector but take no deposits and make no loans; their cash flow is
  // read like any other company's.
  const financial = isLendingFinancial(symbol, row?.sector);
  const equityChange = latest?.equity > 0 && prevYear?.equity > 0 ? (latest.equity / prevYear.equity - 1) * 100 : null;
  const roeBasis = roeAvg != null ? '평균 자기자본 기준' : '기말 자기자본 기준';
  if (roe != null) points.push({ id: 'roe', tone: roe >= 20 ? 'favorable' : roe < 5 ? 'burden' : 'neutral', title: '자본 효율', /* v57.84: green only where the text says 높은 (≥20) */
    // Codex browser audit H37: the generic "buybacks or debt" explanation read as this company's cause. The reading
    // now uses what is measured here (margin, equity change) and names what is not (assets, so no DuPont split).
    text: `ROE ${roe.toFixed(1)}%(${roeBasis}) — ${roe < 0 ? '순손실로 자본이 줄어든 해' : roe >= 20 ? '자기자본 대비 높은 이익' : roe >= 10 ? '평균적인 자본 효율' : '자본 대비 이익이 낮은 편'}입니다.${roe >= 40 ? ` 이 수준에서는 순이익률${latest?.margin != null ? `(${latest.margin.toFixed(1)}%)` : ''}·자산 회전·재무 레버리지 중 무엇이 끌어올렸는지 나눠 봐야 합니다. 이 화면에는 자산 총계가 없어 그 분해는 하지 않습니다${equityChange != null ? ` — 자기자본은 전년보다 ${signed(equityChange)} 변했습니다` : ''}.` : ''}` });
  // P1446: the cash chain — earnings → operating cash → capital spending → free cash → debt and share count.
  const ocf = finite(latest?.operatingCashFlow);
  const capex = finite(latest?.capex);
  if (financial && history.length) {
    points.push({ id: 'bank', tone: 'neutral', title: '금융사 읽는 법',
      text: '은행·금융사는 순이자이익과 순이자마진(NIM), 예금 조달 비용, 대손비용, 자본비율(CET1)이 핵심입니다. 이 화면의 공시 수집본에는 이 항목들이 없어 판단하지 않으며, 분기 실적 자료와 10-K·10-Q 원문에서 확인합니다. 아래 영업현금흐름은 예금·대출 변화가 섞여 일반 기업처럼 읽지 않습니다.' });
  }
  if (ocf != null && latest?.netIncome != null && financial) {
    points.push({ id: 'cash', tone: 'neutral', title: '현금흐름(참고)', text: `영업현금흐름 ${formatUsdShort(ocf)} · 순이익 ${formatUsdShort(latest.netIncome)} — 금융사의 영업현금흐름은 예금·대출·트레이딩 자산 증감이 섞여, 마이너스여도 현금이 부족하다는 뜻이 아닙니다.` });
  } else if (ocf != null && latest?.netIncome != null) {
    // P1449: the OCF/netIncome ratio only means "earnings arrive as cash" when BOTH numbers are
    // positive. A net loss with an operating-cash outflow (or either sign flipped) divides to a
    // positive ratio that means nothing of the sort — read the two facts separately there.
    const creditableConversion = latest.netIncome > 0 && ocf > 0;
    const conversion = creditableConversion ? ocf / latest.netIncome : null;
    const fcf = capex != null ? ocf - capex : null;
    points.push({
      id: 'cash',
      tone: creditableConversion && conversion >= 0.8 && (fcf == null || fcf > 0) ? 'favorable' : 'neutral',
      title: '현금 전환',
      text: !creditableConversion
        ? `영업현금흐름 ${formatUsdShort(ocf)} · 순이익 ${formatUsdShort(latest.netIncome)} — 둘 중 하나가 마이너스면 "순이익 대비 현금 %" 비율 해석은 성립하지 않아 적용하지 않고, 두 사실을 따로 봐야 합니다(순손실 구간과 영업현금 유출은 별개의 문제입니다).`
        : `영업현금흐름 ${formatUsdShort(ocf)}(순이익의 ${(conversion * 100).toFixed(0)}%)${fcf != null ? `, 설비투자 ${withObjectParticle(formatUsdShort(capex))} 뺀 잉여현금흐름 ${formatUsdShort(fcf)}(매출의 ${(fcf / latest.revenue * 100).toFixed(1)}%)` : ''} — ${conversion >= 0.8 ? '이익이 현금으로 들어오고 있습니다' : '장부 이익보다 들어온 현금이 적어 운전자본·회계 이익을 확인할 지점입니다'}.`
    });
  }
  // Codex browser audit H36: say up front that the cash chain (OCF → capex → FCF → ROIC) is not available here,
  // instead of letting a lesson link imply it can be checked on this screen.
  if (ocf == null && history.length) points.push({ id: 'cash', tone: 'neutral', title: '현금 전환', text: '이 회사의 공시 수집본에는 영업현금흐름·설비투자가 없어 잉여현금흐름과 ROIC(투하자본 대비 이익)는 이 화면에서 계산하지 않습니다. 10-K 현금흐름표에서 확인하며, 다른 출처의 FCF 값과 기간을 섞어 쓰지 않습니다.' });
  const debtNow = finite(latest?.longTermDebt);
  const debtPrev = finite(prevYear?.longTermDebt);
  if (annualPair && debtNow != null && debtPrev != null && debtPrev > 0) {
    const change = (debtNow / debtPrev - 1) * 100;
    points.push({ id: 'debt', tone: change > 25 ? 'burden' : 'neutral', title: '부채',
      text: `장기부채 ${formatUsdShort(debtNow)}(전년 대비 ${signed(change)})${latest?.equity > 0 ? ` · 자기자본 대비 ${(debtNow / latest.equity * 100).toFixed(0)}%` : ''}.` });
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
    points.push({ id: 'shares', tone: change <= -1 ? 'favorable' : change >= 3 ? 'burden' : 'neutral', title: '주식 수',
      text: `${shareYears.length - 1}년 동안 발행 주식 수 ${signed(change)}${splitSeen ? '(주식 분할로 보이는 변화는 제외)' : ''} — ${change <= -1 ? '남은 주주의 지분 비율이 커졌습니다(주당 가치가 커졌는지는 매입 가격과 쓴 현금에 달림)' : change >= 3 ? '신주 발행·보상 주식으로 기존 주주의 지분 비율이 줄었습니다' : '거의 변하지 않았습니다'}.` });
  }

  // Codex review 2026-10-05: a 6-month price move set against a fiscal-year revenue change compares
  // different periods (the fiscal year may have ended a year ago). Both are stated with their periods
  // and no conclusion ("실적이 뒷받침") is drawn from the pair.
  const ret6 = finite(row?.ret6m);
  if (ret6 != null && lastGrowth != null) {
    const fy = String(latest.periodEnd || '').slice(0, 7);
    points.push({ id: 'agree', tone: 'neutral', title: '주가와 실적의 기간',
      text: `주가는 최근 6개월 ${signed(ret6)}, 매출은 ${fy ? `${fy}에 끝난 ` : ''}회계연도에 ${signed(lastGrowth)}입니다. 두 숫자는 기간이 달라 직접 비교하지 않습니다 — 주가가 반영하는 것은 앞으로의 실적이고, 다음 분기 공시가 그 기대를 확인합니다.` });
  }
  // v57.81: the headline names its fiscal year, and flags a next annual filing past its longest deadline (as of the
  // price session when the row carries one). A flag only — no newer figure is guessed.
  const filing = latest ? annualFilingStatus(latest.periodEnd, now ?? (row?.factorSessionDate || Date.now())) : null;
  const headline = !history.length ? null
    : `${filing ? `${filing.fyLabel} ` : ''}${[lastGrowth != null ? `매출 ${signed(lastGrowth)}` : null, latest.margin != null ? `순이익률 ${latest.margin.toFixed(1)}%` : null, roe != null ? `ROE ${roe.toFixed(1)}%(${roeBasis})` : null,
      filing?.overdue ? '다음 연간 공시 예정 지남' : null].filter(Boolean).join(' · ')}`.trim();
  return { available: history.length > 0, symbol, history, latest, headline, points, roe, roeBasis, lastGrowth, filing };
}
