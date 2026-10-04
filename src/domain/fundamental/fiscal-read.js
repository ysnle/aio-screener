// P1436 (재무 공시 redesign): read the company's own annual filings as a trend — is revenue growing,
// is the business getting more profitable, and does the stock's price move agree with it — instead of
// one year's raw numbers. Inputs: the SEC FY series in the runtime summary (fiscalHistory) and the
// screener row for price context (returns, P/E). A missing year or field drops its sentence.

const finite = (value) => (value != null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null);
const signed = (value, digits = 1, unit = '%') => `${value >= 0 ? '+' : ''}${value.toFixed(digits)}${unit}`;

export function formatUsdShort(value) {
  const v = finite(value);
  if (v == null) return '—';
  const abs = Math.abs(v);
  return abs >= 1e12 ? `$${(v / 1e12).toFixed(2)}조` : abs >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : abs >= 1e6 ? `$${(v / 1e6).toFixed(0)}M` : `$${v.toFixed(0)}`;
}

export function buildFiscalRead({ symbol, fundamentals = null, row = null } = {}) {
  // Before the runtime summary carries fiscalHistory, the latest FY facts still give a one-year reading.
  const series = Array.isArray(fundamentals?.fiscalHistory) && fundamentals.fiscalHistory.length ? fundamentals.fiscalHistory
    : finite(fundamentals?.revenue) != null ? [{ periodEnd: fundamentals.observedAt || '', revenue: fundamentals.revenue, netIncome: fundamentals.netIncome, equity: fundamentals.equity }] : [];
  const history = series
    .filter((year) => finite(year?.revenue) != null)
    .map((year) => ({ ...year, revenue: finite(year.revenue), netIncome: finite(year.netIncome), equity: finite(year.equity),
      margin: finite(year.revenue) && finite(year.netIncome) != null ? finite(year.netIncome) / finite(year.revenue) * 100 : null }));
  const latest = history[history.length - 1] || null;
  const points = [];
  if (history.length >= 2) {
    const first = history[0];
    const years = history.length - 1;
    const cagr = first.revenue > 0 && latest.revenue > 0 ? ((latest.revenue / first.revenue) ** (1 / years) - 1) * 100 : null;
    let streak = 0;
    for (let i = history.length - 1; i > 0 && history[i].revenue > history[i - 1].revenue; i--) streak += 1;
    const lastGrowth = (latest.revenue / history[history.length - 2].revenue - 1) * 100;
    const pace = cagr == null ? '' : ` · ${years}년 연평균 ${signed(cagr)}`;
    points.push({ id: 'growth', tone: lastGrowth >= 0 ? 'favorable' : 'burden', title: '매출 흐름',
      text: `최근 회계연도 매출 ${formatUsdShort(latest.revenue)}(${signed(lastGrowth)})${pace}. ${streak >= 2 ? `${streak}년 연속 증가입니다` : streak === 1 ? '직전 해보다 늘었습니다' : '직전 해보다 줄었습니다'}${cagr != null && lastGrowth > cagr + 10 ? ' — 성장이 최근에 빨라졌습니다' : cagr != null && lastGrowth < cagr - 10 ? ' — 최근 성장은 평균보다 느립니다' : ''}.` });
    const marginNow = latest.margin;
    const marginThen = history[Math.max(0, history.length - 4)].margin;
    if (marginNow != null && marginThen != null) {
      const delta = marginNow - marginThen;
      points.push({ id: 'margin', tone: delta >= 0 ? 'favorable' : 'burden', title: '수익성',
        text: `순이익률 ${marginNow.toFixed(1)}%(${history.length >= 4 ? '3년 전' : '첫 해'} ${marginThen.toFixed(1)}%) — ${Math.abs(delta) < 2 ? '수익성이 비슷하게 유지됩니다' : delta > 0 ? '매출이 늘수록 이익이 더 크게 남는 구조로 바뀌었습니다(영업 레버리지)' : '매출 대비 남는 이익이 줄었습니다 — 비용·가격 압력을 확인할 지점입니다'}.` });
    }
    const niNow = latest.netIncome;
    const niPrev = history[history.length - 2].netIncome;
    if (niNow != null && niPrev != null && niPrev > 0) {
      const niGrowth = (niNow / niPrev - 1) * 100;
      const pe = finite(row?.pe);
      const peg = pe != null && pe > 0 && niGrowth > 0 ? pe / niGrowth : null;
      points.push({ id: 'earnings', tone: niGrowth >= 0 ? 'favorable' : 'burden', title: '이익과 가격',
        text: `순이익 ${formatUsdShort(niNow)}(${signed(niGrowth)})${pe != null ? `, 공시 이익 기준 PER ${pe.toFixed(1)}배` : ''}${peg != null ? ` — 이익 성장률 대비 PER(PEG) ${peg.toFixed(2)}: ${peg < 1 ? '성장 속도에 비해 가격 부담이 크지 않은 편' : peg < 2 ? '성장을 어느 정도 가격에 반영' : '성장보다 가격이 앞서 있음'}` : ''}. PEG는 지난 1년 성장률로 계산한 참고값입니다.` });
    }
  } else if (latest) {
    const growth = finite(fundamentals?.revGrowth);
    points.push({ id: 'single', tone: growth == null ? 'neutral' : growth >= 0 ? 'favorable' : 'burden', title: '공시 기록', text: `회계연도 ${latest.periodEnd || '최근'} 매출 ${formatUsdShort(latest.revenue)}${growth != null ? `(전년 대비 ${signed(growth)})` : ''}${latest.margin != null ? `, 순이익률 ${latest.margin.toFixed(1)}%` : ''}. 여러 해 추이 그래프는 다음 재무 데이터 갱신 뒤 표시됩니다.` });
  }
  const roe = finite(fundamentals?.roe);
  if (roe != null) points.push({ id: 'roe', tone: roe >= 15 ? 'favorable' : roe < 5 ? 'burden' : 'neutral', title: '자본 효율', text: `ROE ${roe.toFixed(1)}% — ${roe >= 20 ? '자기자본으로 높은 이익을 내는 회사' : roe >= 10 ? '평균적인 자본 효율' : '자본 대비 이익이 낮은 편'}입니다.${roe >= 60 ? ' 다만 이 정도로 높으면 자사주 매입으로 자본이 줄어 수치가 커진 경우가 많아, 순이익률과 함께 봐야 합니다.' : ''}` });

  const ret6 = finite(row?.ret6m);
  const lastGrowth = history.length >= 2 ? (latest.revenue / history[history.length - 2].revenue - 1) * 100 : null;
  if (ret6 != null && lastGrowth != null) {
    const priceUp = ret6 > 0;
    const salesUp = lastGrowth > 0;
    points.push({ id: 'agree', tone: priceUp === salesUp ? 'favorable' : 'neutral', title: '주가와 실적',
      text: priceUp && salesUp && ret6 > lastGrowth * 2 + 10 ? `주가 6개월 ${signed(ret6)}와 매출 성장 ${signed(lastGrowth)}가 같은 방향이지만, 주가가 실적보다 훨씬 빨리 올라 기대(밸류에이션)가 앞서 있습니다 — 다음 실적이 그 기대를 채우는지가 관건입니다.`
        : priceUp && salesUp ? `주가 6개월 ${signed(ret6)}와 매출 성장 ${signed(lastGrowth)}가 같은 방향입니다 — 가격 추세를 실적이 뒷받침합니다.`
        : priceUp && !salesUp ? `주가는 6개월 ${signed(ret6)} 올랐지만 최근 매출은 ${signed(lastGrowth)} — 가격이 실적 회복을 미리 반영하고 있는지 다음 공시가 확인합니다.`
          : !priceUp && salesUp ? `매출은 ${signed(lastGrowth)} 늘었지만 주가는 6개월 ${signed(ret6)} — 실적과 가격이 엇갈립니다(기대 하향 또는 밸류에이션 조정).`
            : `주가(6개월 ${signed(ret6)})와 매출(${signed(lastGrowth)})이 함께 약합니다.` });
  }
  const headline = !history.length ? null
    : [history.length >= 2 ? `매출 ${signed(lastGrowth)}` : null, latest.margin != null ? `순이익률 ${latest.margin.toFixed(1)}%` : null, roe != null ? `ROE ${roe.toFixed(1)}%` : null].filter(Boolean).join(' · ');
  return { available: history.length > 0, symbol, history, latest, headline, points };
}
