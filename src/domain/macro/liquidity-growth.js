// P1654 (owner 2026-10-12: fill free official data gaps): three supporting groups for the 거시 screen built only from
// public-data/macro-history.json (FRED raw observations). Each card states a dated value, one change over a named
// period and one reading; a series that has not been produced yet is left out instead of shown as "—".

const seriesOf = (macroHistory, field) => (macroHistory?.series?.[field]?.observations || [])
  .map(([date, value]) => ({ date, value: Number(value) }))
  .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && Number.isFinite(row.value))
  .sort((a, b) => a.date.localeCompare(b.date));

const atOrBefore = (series, date) => {
  let found = null;
  for (const row of series) { if (row.date <= date) found = row; else break; }
  return found;
};

const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const pct = (now, then) => (then && then !== 0 ? (now / then - 1) * 100 : null);
const signed = (value, digits = 1, unit = '%') => (value == null || !Number.isFinite(value) ? null : `${value >= 0 ? '+' : ''}${value.toFixed(digits)}${unit}`);
const fmt = (value, digits = 0) => value.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });

// Change against the observation closest to `days` calendar days earlier (never a later one).
function changeOver(series, days) {
  const last = series.at(-1);
  if (!last) return null;
  const target = new Date(Date.parse(last.date) - days * 86400000).toISOString().slice(0, 10);
  const then = atOrBefore(series, target);
  return then ? { then, last } : null;
}

// Net liquidity in USD billions: Fed total assets minus the Treasury General Account minus overnight reverse repo,
// each taken on or before the Fed balance-sheet date (weekly Wednesday levels).
export function netLiquiditySeries(macroHistory) {
  const assets = seriesOf(macroHistory, 'fedBalanceSheet');
  const tga = seriesOf(macroHistory, 'treasuryAccount');
  const rrp = seriesOf(macroHistory, 'reverseRepo');
  if (!assets.length || !tga.length || !rrp.length) return [];
  return assets.map((row) => {
    const t = atOrBefore(tga, row.date);
    const r = atOrBefore(rrp, row.date);
    if (!t || !r || daysBetween(t.date, row.date) > 7 || daysBetween(r.date, row.date) > 7) return null;
    return { date: row.date, value: row.value / 1000 - t.value / 1000 - r.value };
  }).filter(Boolean);
}

function card({ id, label, series, valueText, changeText, reading, unit = '', asOf }) {
  return { id, label, series: series.slice(-104), valueText, changeText, reading, unit, asOf };
}

function liquidityGroup(macroHistory) {
  const items = [];
  const net = netLiquiditySeries(macroHistory);
  const netChange = changeOver(net, 28);
  if (net.length >= 6) {
    const d = netChange ? netChange.last.value - netChange.then.value : null;
    items.push(card({ id: 'netLiquidity', label: '순유동성 (연준 자산 − TGA − 역레포)', series: net, asOf: net.at(-1).date,
      valueText: `${fmt(net.at(-1).value / 1000, 2)}조 달러`,
      // d is in USD billions; 1 billion = 10억.
      changeText: d == null ? null : `4주 ${d >= 0 ? '+' : ''}${fmt(d * 10, 0)}억 달러`,
      reading: d == null ? '4주 비교 관측이 부족합니다.' : d > 0 ? '시장에 풀린 달러가 늘어난 구간입니다. 위험자산에 우호적인 배경이 되기 쉽지만 지수 방향을 단독으로 정하지는 않습니다.' : '시장에 풀린 달러가 줄어든 구간입니다. 유동성이 빠질 때는 고평가·고변동 종목이 먼저 흔들리는 경향이 있습니다.' }));
  }
  const nfci = seriesOf(macroHistory, 'financialConditions');
  if (nfci.length >= 6) {
    const last = nfci.at(-1); const c = changeOver(nfci, 28);
    items.push(card({ id: 'nfci', label: '금융여건지수 (시카고 연은)', series: nfci, asOf: last.date,
      valueText: fmt(last.value, 2), changeText: c ? `4주 ${signed(c.last.value - c.then.value, 2, '')}` : null,
      reading: last.value < 0 ? '0보다 낮아 평균보다 돈을 빌리기 쉬운 여건입니다. 값이 오르면 여건이 조여지는 방향입니다.' : '0보다 높아 평균보다 금융 여건이 빡빡합니다. 신용 스프레드와 함께 확인합니다.' }));
  }
  const sofr = seriesOf(macroHistory, 'sofr');
  if (sofr.length >= 6) {
    const last = sofr.at(-1);
    items.push(card({ id: 'sofr', label: 'SOFR 단기 자금 금리', series: sofr, asOf: last.date, unit: '%',
      valueText: `${fmt(last.value, 2)}%`, changeText: null,
      reading: '은행 간 하루짜리 담보 대출 금리입니다. 연준 목표 범위를 벗어나 튀면 단기 자금 시장의 긴장 신호로 봅니다.' }));
  }
  return { id: 'liquidity', title: '유동성 · 금융 여건', fact: '시장에 풀린 달러와 돈을 빌리는 조건 — 위험자산 가격의 배경입니다.', items };
}

function growthGroup(macroHistory) {
  const items = [];
  const gdp = seriesOf(macroHistory, 'realGdp');
  if (gdp.length >= 3) {
    const last = gdp.at(-1), prev = gdp.at(-2);
    const annualized = prev?.value > 0 ? ((last.value / prev.value) ** 4 - 1) * 100 : null;
    items.push(card({ id: 'realGdp', label: '실질 GDP 성장률 (전기 대비 연율)', series: gdp, asOf: last.date,
      valueText: annualized == null ? '—' : `${signed(annualized, 1)}`, changeText: `${last.date.slice(0, 7)} 분기`,
      reading: annualized == null ? '' : annualized >= 2 ? '잠재 성장(약 2%) 이상으로 경기가 견조합니다.' : annualized >= 0 ? '성장은 이어지지만 잠재 성장보다 느립니다.' : '분기 성장이 마이너스입니다 — 경기 둔화가 실제 생산으로 나타난 구간입니다.' }));
  }
  const jolts = seriesOf(macroHistory, 'jobOpenings');
  if (jolts.length >= 6) {
    const c = changeOver(jolts, 365);
    items.push(card({ id: 'jobOpenings', label: '구인 건수 (JOLTS)', series: jolts, asOf: jolts.at(-1).date,
      valueText: `${fmt(jolts.at(-1).value / 1000, 2)}백만 건`, changeText: c ? `1년 ${signed(pct(c.last.value, c.then.value))}` : null,
      reading: '기업이 채우려는 일자리 수입니다. 꾸준히 줄면 고용 둔화가 실업률보다 먼저 나타납니다.' }));
  }
  const sentiment = seriesOf(macroHistory, 'consumerSentiment');
  if (sentiment.length >= 6) {
    const c = changeOver(sentiment, 92);
    items.push(card({ id: 'consumerSentiment', label: '미시간대 소비자심리', series: sentiment, asOf: sentiment.at(-1).date,
      valueText: fmt(sentiment.at(-1).value, 1), changeText: c ? `3개월 ${signed(c.last.value - c.then.value, 1, '')}` : null,
      reading: '가계가 느끼는 경기와 물가 부담입니다. 심리는 실제 소비보다 먼저 움직이지만 소비와 어긋나는 때도 많습니다.' }));
  }
  const ppi = seriesOf(macroHistory, 'ppiFinalDemand');
  if (ppi.length >= 14) {
    const c = changeOver(ppi, 365);
    const yoy = c ? pct(c.last.value, c.then.value) : null;
    items.push(card({ id: 'ppiFinalDemand', label: '생산자물가 (최종수요, 전년 대비)', series: ppi, asOf: ppi.at(-1).date, unit: '%',
      valueText: signed(yoy, 1) || '—', changeText: null,
      reading: '기업이 받는 가격입니다. 생산자물가가 오르면 몇 달 뒤 소비자물가나 기업 마진에 압력이 됩니다.' }));
  }
  return { id: 'growth', title: '성장 · 고용 선행', fact: '분기 성장, 일자리 수요, 가계 심리, 기업 가격 — 경기의 다음 방향을 미리 보는 지표입니다.', items };
}

function commodityFxGroup(macroHistory) {
  const items = [];
  const add = (field, label, digits, unitText, reading) => {
    const s = seriesOf(macroHistory, field);
    if (s.length < 6) return;
    const c = changeOver(s, 30);
    items.push(card({ id: field, label, series: s, asOf: s.at(-1).date, valueText: `${fmt(s.at(-1).value, digits)}${unitText}`,
      changeText: c ? `1개월 ${signed(pct(c.last.value, c.then.value))}` : null, reading }));
  };
  add('brent', '브렌트유', 2, '달러', '국제 유가 기준입니다. WTI와 차이가 벌어지면 미국 밖 공급 차질을 반영하는 경우가 많습니다.');
  add('natGas', '천연가스 (헨리허브)', 2, '달러', '전기·난방·화학 원가입니다. 겨울철과 수출 수요에 크게 흔들립니다.');
  add('copper', '구리 (월평균)', 0, '달러/톤', '건설·전력망·전기차에 쓰여 경기 체력을 비추는 금속입니다. 데이터센터 전력 투자와도 연결됩니다.');
  add('usdCny', '위안 / 달러', 3, '위안', '오르면 위안화 약세입니다. 중국 경기와 아시아 통화(원화 포함)가 같은 방향으로 움직이는 경향이 있습니다.');
  return { id: 'commodities-fx', title: '원자재 · 아시아 통화', fact: '유가 외 에너지, 산업 금속, 위안화 — 물가와 한국 시장에 닿는 경로입니다.', items };
}

export function buildLiquidityGrowthGroups(macroHistory) {
  return [liquidityGroup(macroHistory), growthGroup(macroHistory), commodityFxGroup(macroHistory)].filter((group) => group.items.length);
}
