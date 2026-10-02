// P1389: the briefing's "connected read". Owner review 2026-10-02: the briefing restated numbers
// (S&P x, VIX y, WTI z) in five places and never connected them. This pure module turns the
// completed-close history into cross-asset statements — rates vs equities, index vs breadth,
// fear gauge vs credit, dollar vs gold, oil vs yields, Korea vs the US — each citing its numbers.
// Rules are descriptive (what the tape shows), never a trade instruction, and a rule whose
// inputs are missing stays silent instead of guessing.

const DAY_MS = 86400000;

function finite(value) {
  if (value == null || typeof value === 'boolean') return null; // Number(null) is 0, not a reading
  const number = typeof value === 'string' && value.trim() === '' ? NaN : Number(value);
  return Number.isFinite(number) ? number : null;
}

function nyDate(iso) {
  const ms = Date.parse(String(iso || ''));
  return Number.isFinite(ms) ? new Date(ms).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) : null;
}

// One value per trading date. The producer stamps a close either near the bell or at its bar start,
// and a later row can carry a late-settling bar (DXY/WTI); key by the observation's own NY date and
// let the later row win. Carried-forward weekend copies are not observations.
export function buildCloseSeries(history = [], field) {
  const byDate = new Map();
  const rows = [...(Array.isArray(history) ? history : [])].sort((a, b) => String(a?.date || '').localeCompare(String(b?.date || '')));
  for (const row of rows) {
    const value = finite(row?.[field]);
    if (value == null || (value <= 0 && !field.startsWith('breadth'))) continue; // a 0 yield/price is a producer gap, not a close
    const meta = row.fieldMeta?.[field];
    if (meta?.observationRelation === 'carried-forward') continue;
    const date = meta?.observedAt ? nyDate(meta.observedAt) : row.date;
    if (date) byDate.set(date, value);
  }
  return [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, value]) => ({ date, value }));
}

function stats(series) {
  if (!series.length) return null;
  const last = series[series.length - 1];
  const back = (n) => series.length > n ? series[series.length - 1 - n].value : null;
  const year = series.filter((point) => Date.parse(point.date) >= Date.parse(last.date) - 365 * DAY_MS).map((point) => point.value);
  const mean = (n) => series.length >= n ? series.slice(-n).reduce((sum, point) => sum + point.value, 0) / n : null;
  const max = Math.max(...year);
  const min = Math.min(...year);
  return {
    date: last.date, value: last.value, d1: back(1), d5: back(5), d20: back(20),
    yearMax: max, yearMin: min, yearPosition: max > min ? (last.value - min) / (max - min) : null,
    ma50: mean(50), ma200: mean(200)
  };
}

const pct = (now, then) => now != null && then ? (now / then - 1) * 100 : null;
const bp = (now, then) => now != null && then != null ? (now - then) * 100 : null;
const signed = (value, digits = 1, unit = '%') => value == null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(digits)}${unit}`;
const fmt = (value, digits = 2) => value == null ? '—' : value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/**
 * @param {object} input
 * @param {Array} input.history  public-data/history.json rows
 * @param {object} [input.credit] { hyBp, pcr, fg, hyDelta5Bp } latest published daily readings
 * @param {object} [input.rates] FRED one-week changes in percent: { realYield10, realYield10Delta5, breakeven10Delta5, dgs2Delta5, dgs10Delta5 }
 */
export function buildMarketRead({ history = [], credit = {}, rates = {} } = {}) {
  const s = Object.fromEntries(['spx', 'nasdaq', 'rut', 'vix', 'vix3m', 'tnx', 'dxy', 'wti', 'gold', 'kospi', 'usdkrw', 'breadth50', 'breadth20', 'advanceRatio']
    .map((field) => [field, stats(buildCloseSeries(history, field))]));
  const spx = s.spx;
  if (!spx) return { available: false, reason: 'history-missing', statements: [], drivers: [] };
  const hyBp = finite(credit.hyBp);
  const pcr = finite(credit.pcr);
  const fgSeries = buildCloseSeries(history, 'fg');
  const fg = fgSeries.length ? fgSeries[fgSeries.length - 1].value : finite(credit.fg);
  const statements = [];
  const add = (id, weight, text, axis, check = null) => statements.push({ id, weight, text, axis, check });

  const spx5 = pct(spx.value, spx.d5);
  const spx20 = pct(spx.value, spx.d20);
  const spxFromHigh = pct(spx.value, spx.yearMax);
  const tnx = s.tnx;
  const tnx5 = tnx ? bp(tnx.value, tnx.d5) : null;
  const tnx20 = tnx ? bp(tnx.value, tnx.d20) : null;

  // 1. Rates vs equities over a week — which force is winning.
  if (tnx5 != null && spx5 != null && Math.abs(tnx5) >= 8) {
    const atHigh = tnx.yearPosition != null && tnx.yearPosition >= 0.95;
    const rateText = `10년물 금리 5일 ${signed(tnx5, 0, 'bp')}(${fmt(tnx.value)}%${atHigh ? ', 1년 최고권' : ''})`;
    if (tnx5 > 0 && spx5 >= 0) add('rates-up-stocks-up', Math.min(95, 40 + tnx5 * 2), `${rateText}에도 S&P 500은 ${signed(spx5)} — 금리 부담을 실적·성장 기대가 이기고 있는 구간입니다.`, 'rates', `금리가 더 오를 때도 주가가 버티는지(10년물 ${fmt(tnx.value)}% 기준)`);
    else if (tnx5 > 0) add('rates-up-stocks-down', Math.min(95, 45 + tnx5 * 2), `${rateText}와 함께 S&P 500 ${signed(spx5)} — 금리 상승이 주가 할인율 부담으로 작용하는 구간입니다.`, 'rates', `10년물이 ${fmt(tnx.value)}% 위에서 굳는지, S&P 500이 50일선(${fmt(spx.ma50, 0)})을 지키는지`);
    else if (spx5 < 0) add('rates-down-stocks-down', Math.min(95, 45 - tnx5 * 2), `${rateText}에도 S&P 500 ${signed(spx5)} — 금리보다 성장 둔화 우려가 앞서는 신호입니다.`, 'rates', '다음 경기 지표(고용·ISM)가 둔화를 확인하는지');
    else add('rates-down-stocks-up', Math.min(90, 35 - tnx5 * 2), `${rateText} 속에 S&P 500 ${signed(spx5)} — 금리 하락이 주가를 받치는 구간입니다.`, 'rates');
  }
  if (tnx?.yearPosition != null && tnx.yearPosition >= 0.95 && !statements.some((row) => row.axis === 'rates')) add('rates-year-high', 70, `10년물 금리 ${fmt(tnx.value)}%는 최근 1년 범위의 최상단입니다(1년 최저 ${fmt(tnx.yearMin)}%).`, 'rates');

  // P1390 (frameworks from owner-supplied material 2026-09-28~30: 윤지호/인포맥스, @laylaperfume daily recaps):
  // (a) what drives the nominal move — real yield (multiple compression) or inflation compensation;
  const real5 = finite(rates.realYield10Delta5) == null ? null : rates.realYield10Delta5 * 100;
  const bei5 = finite(rates.breakeven10Delta5) == null ? null : rates.breakeven10Delta5 * 100;
  if (real5 != null && bei5 != null && Math.abs(real5 + bei5) >= 8) {
    const realLed = Math.abs(real5) >= Math.abs(bei5);
    add(realLed ? 'real-yield-led' : 'breakeven-led', 78, realLed
      ? `10년물 5일 변화 중 실질금리 ${signed(real5, 0, 'bp')}·기대인플레 ${signed(bei5, 0, 'bp')} — 물가보다 실질금리가 금리를 움직여 주식 밸류에이션(PER)에 더 직접적인 부담입니다${finite(rates.realYield10) != null ? `(실질금리 ${fmt(rates.realYield10)}%)` : ''}.`
      : `10년물 5일 변화 중 기대인플레 ${signed(bei5, 0, 'bp')}·실질금리 ${signed(real5, 0, 'bp')} — 유가·물가 기대가 금리를 움직이는 구간입니다.`, 'rates',
      realLed ? '실질금리 상승이 멈추는지 — 멈추지 않으면 성장주 밸류에이션 부담 지속' : '유가와 다음 물가 지표가 기대인플레를 더 밀어 올리는지');
  }
  // (b) short vs long end — policy expectations or the long end itself;
  const two5 = finite(rates.dgs2Delta5) == null ? null : rates.dgs2Delta5 * 100;
  const ten5 = finite(rates.dgs10Delta5) == null ? null : rates.dgs10Delta5 * 100;
  if (two5 != null && ten5 != null) {
    if (ten5 >= 8 && ten5 - two5 >= 8) add('bear-steepening', 72, `장기금리(10년 ${signed(ten5, 0, 'bp')})가 단기금리(2년 ${signed(two5, 0, 'bp')})보다 크게 올랐습니다 — 연준 기대보다 장기 요인(기간 프리미엄·성장·국채 수급)이 주도해, 단기 금리가 안정돼도 위험선호 회복을 막을 수 있습니다.`, 'rates');
    else if (two5 >= 8 && two5 - ten5 >= 8) add('bear-flattening', 72, `단기금리(2년 ${signed(two5, 0, 'bp')})가 장기금리(10년 ${signed(ten5, 0, 'bp')})보다 더 올랐습니다 — 추가 긴축 기대가 금리를 끌어올리는 구간입니다.`, 'rates');
  }
  // (c) a weaker dollar with higher long rates points inward (inflation, growth, supply), not to FX.
  const dxyWeek = s.dxy ? pct(s.dxy.value, s.dxy.d5) : null;
  if (dxyWeek != null && tnx5 != null && dxyWeek <= -0.3 && tnx5 >= 8) add('weak-dollar-higher-rates', 55, `달러가 약해졌는데도(5일 ${signed(dxyWeek)}) 10년물은 ${signed(tnx5, 0, 'bp')} — 해외 요인보다 미국 내부 요인(물가·성장·국채 공급)이 장기금리를 밀어 올립니다.`, 'rates');

  // 2. Index vs participation.
  const b50 = s.breadth50?.value ?? null;
  if (b50 != null && spxFromHigh != null) {
    if (spxFromHigh > -3 && b50 < 40) add('narrow-rally', 85, `S&P 500은 1년 고점 대비 ${signed(spxFromHigh)}로 고점권인데 50일선 위 종목은 ${fmt(b50, 0)}%뿐 — 소수 대형주가 지수를 떠받치는 좁은 장세입니다.`, 'index', `50일선 위 종목 비율이 40% 위로 회복되는지(현재 ${fmt(b50, 0)}%) — 회복 없이 대형주가 꺾이면 지수 하락 폭이 커질 수 있음`);
    else if (b50 >= 60 && spx20 != null && spx20 > 0) add('broad-rally', 55, `50일선 위 종목 ${fmt(b50, 0)}% — 상승이 대형주에 그치지 않고 넓게 퍼져 있습니다.`, 'index');
    else if (b50 < 30 && spx20 != null && spx20 < 0) add('broad-weakness', 70, `50일선 위 종목 ${fmt(b50, 0)}%, S&P 500 20일 ${signed(spx20)} — 약세가 시장 전반에 퍼져 있습니다.`, 'index');
  }
  // 3. Leadership: tech and small caps relative to the S&P over a month.
  const ndx20 = s.nasdaq ? pct(s.nasdaq.value, s.nasdaq.d20) : null;
  const rut20 = s.rut ? pct(s.rut.value, s.rut.d20) : null;
  if (ndx20 != null && spx20 != null && Math.abs(ndx20 - spx20) >= 2) add(ndx20 > spx20 ? 'tech-leads' : 'tech-lags', 50, `나스닥 20일 ${signed(ndx20)} vs S&P 500 ${signed(spx20)} — ${ndx20 > spx20 ? '기술주가 상승을 주도' : '기술주가 시장보다 약함'}.`, 'index');
  const hyBpEarly = finite(credit.hyBp);
  const hyWeek = finite(credit.hyDelta5Bp);
  const creditCalm = hyBpEarly != null && (hyWeek != null ? hyWeek <= 5 : hyBpEarly < 350);
  if (rut20 != null && spx20 != null && Math.abs(rut20 - spx20) >= 3) add(rut20 < spx20 ? 'smallcap-lags' : 'smallcap-leads', rut20 < spx20 && creditCalm ? 55 : 45, `러셀 2000 20일 ${signed(rut20)} vs S&P 500 ${signed(spx20)} — ${rut20 < spx20 ? (creditCalm ? `중소형주 소외. HY 스프레드(${fmt(hyBpEarly, 0)}bp)는 안정적이라 원인은 신용 위험보다 금리 부담입니다` : '금리에 민감한 중소형주가 소외') : '중소형주까지 위험선호가 확산'}.`, 'index');
  const adv = s.advanceRatio?.value ?? null;
  const spxDay = pct(spx.value, spx.d1);
  if (adv != null && spxDay != null) {
    const advPct = adv <= 1 ? adv * 100 : adv;
    if (spxDay <= -0.8 && advPct < 30) add('broad-derisking', 65, `S&P 500 ${signed(spxDay)}, 상승 종목 ${fmt(advPct, 0)}% — 특정 섹터가 아닌 시장 전반의 고른 위험 축소입니다.`, 'index');
    else if (spxDay >= -0.3 && advPct < 45) add('index-defended', 62, `S&P 500 ${signed(spxDay)}인데 상승 종목은 ${fmt(advPct, 0)}% — 대형 기술주가 지수를 방어하는 동안 다수 종목은 하락했습니다.`, 'index');
  }

  // 4. Fear gauge vs credit: is the fear priced in credit too?
  const vix = s.vix;
  if (fg != null && fg < 35 && hyBp != null && hyBp < 380 && vix && vix.value < 20) {
    add('fear-without-credit-stress', 80, `F&G는 ${fmt(fg, 0)}(공포)인데 HY 신용 스프레드 ${fmt(hyBp, 0)}bp·VIX ${fmt(vix.value)}는 안정 — 공포 지수는 시장 폭·모멘텀 약세를 반영한 것이고 신용 위험으로 번지지는 않았습니다${hyBp >= 300 ? '(다만 3%대 스프레드는 자금 조달이 쉽지 않은 수준)' : ''}${hyWeek != null ? `. HY 5일 ${signed(hyWeek, 0, 'bp')}` : ''}.`, 'risk', `HY 스프레드가 350bp를 넘는지(현재 ${fmt(hyBp, 0)}bp) — 넘으면 공포가 신용 시장으로 번지는 신호`);
  } else if (fg != null && fg > 70 && vix && vix.value < 14) {
    add('complacency', 60, `F&G ${fmt(fg, 0)}(탐욕)·VIX ${fmt(vix.value)} — 낙관이 강하고 변동성 대비가 얇은 상태입니다.`, 'risk');
  }
  if (hyWeek != null && hyWeek >= 15 && hyBp != null && hyBp < 450) add('credit-widening', 72, `HY 신용 스프레드 5일 ${signed(hyWeek, 0, 'bp')} 확대(${fmt(hyBp, 0)}bp) — 자금 조달 여건이 빠듯해지고 있습니다.`, 'risk', 'HY 스프레드 확대가 이어지는지 — 이어지면 주식보다 신용이 먼저 위험을 반영');
  if (hyBp != null && hyBp >= 450) add('credit-stress', 85, `HY 신용 스프레드 ${fmt(hyBp, 0)}bp — 신용 시장이 위험을 가격에 반영하기 시작했습니다.`, 'risk');
  if (vix && s.vix3m && s.vix3m.value && vix.value / s.vix3m.value > 1) add('vix-inversion', 75, `VIX(${fmt(vix.value)})가 3개월 VIX(${fmt(s.vix3m.value)})보다 높음 — 단기 스트레스가 중기 기대보다 큰 역전 상태입니다.`, 'risk');
  if (tnx?.yearPosition != null && tnx.yearPosition >= 0.95 && vix && vix.value < 20) add('orderly-at-rate-high', 58, `금리가 1년 최고권인데 VIX는 ${fmt(vix.value)} — 패닉이 아닌 질서 있는 조정·위험 축소입니다.`, 'risk');
  const vix5 = vix ? pct(vix.value, vix.d5) : null;
  if (vix5 != null && vix5 >= 25) add('vix-spike', 75, `VIX 5일 ${signed(vix5, 0)} 급등(${fmt(vix.value)}).`, 'risk');

  // 5. Dollar and gold.
  const dxy5 = s.dxy ? pct(s.dxy.value, s.dxy.d5) : null;
  const gold20 = s.gold ? pct(s.gold.value, s.gold.d20) : null;
  if (s.gold?.yearPosition != null && s.gold.yearPosition >= 0.95) add('gold-high', 55, `금 ${fmt(s.gold.value, 0)}달러로 1년 최고권(20일 ${signed(gold20)})${dxy5 != null && dxy5 > 0.5 ? ' — 달러 강세에도 오르는 안전자산 수요' : ''}.`, 'commodities');
  else if (dxy5 != null && gold20 != null && dxy5 > 1 && gold20 > 3) add('haven-demand', 55, `달러(5일 ${signed(dxy5)})와 금(20일 ${signed(gold20)})이 함께 상승 — 안전자산 선호 신호입니다.`, 'commodities');

  if (gold20 != null && tnx20 != null && gold20 <= -3 && tnx20 >= 10 && !statements.some((row) => row.id === 'gold-high')) add('gold-down-rates-up', 60, `금 20일 ${signed(gold20)}·10년물 ${signed(tnx20, 0, 'bp')} — 안전자산 수요보다 긴축(실질금리) 공포가 앞서는 구간입니다.`, 'commodities');
  // 6. Oil and yields — the inflation channel.
  const wti20 = s.wti ? pct(s.wti.value, s.wti.d20) : null;
  if (wti20 != null && tnx20 != null && wti20 >= 8 && tnx20 >= 15) add('oil-rates-inflation', 80, `WTI 20일 ${signed(wti20)}·10년물 ${signed(tnx20, 0, 'bp')} 동반 상승 — 유가가 물가 기대를 거쳐 금리를 밀어 올리는 경로입니다.`, 'commodities');
  else if (s.wti && s.wti.value >= 90) add('oil-high', 50, `WTI ${fmt(s.wti.value)}달러 — 90달러대 유가는 물가와 금리 부담 요인입니다.`, 'commodities', 'WTI가 90달러 위를 유지하는지 — 유지되면 다음 물가 지표 부담');

  // 7. Korea relative to the US, with the currency.
  const kospi5 = s.kospi ? pct(s.kospi.value, s.kospi.d5) : null;
  const krw5 = s.usdkrw ? pct(s.usdkrw.value, s.usdkrw.d5) : null;
  if (kospi5 != null && spx5 != null && Math.abs(kospi5 - spx5) >= 2) {
    add('korea-relative', 45, `코스피 5일 ${signed(kospi5)}로 미국(${signed(spx5)})보다 ${kospi5 > spx5 ? '강함' : '약함'}${krw5 != null ? ` · 원/달러 5일 ${signed(krw5)}(${krw5 > 0 ? '원화 약세' : '원화 강세'})` : ''}.`, 'korea');
  }

  const kospi1 = s.kospi ? pct(s.kospi.value, s.kospi.d1) : null;
  const spx1 = pct(spx.value, spx.d1);
  if (!statements.some((row) => row.axis === 'korea') && kospi1 != null && spx1 != null && Math.abs(kospi1 - spx1) >= 1.5) {
    add('korea-day', 40, `코스피 ${signed(kospi1)}로 직전 미국장(S&P 500 ${signed(spx1)})과 다르게 움직였습니다${krw5 != null && Math.abs(krw5) >= 0.3 ? ` · 원/달러 5일 ${signed(krw5)}` : ''}.`, 'korea');
  }

  statements.sort((a, b) => b.weight - a.weight);
  // The lead block shows the four strongest statements; driver rows add only the rest, so no
  // sentence appears twice on the page.
  const lead = statements.slice(0, 4);
  const restFor = (axis) => statements.filter((row) => row.axis === axis && !lead.includes(row)).map((row) => row.text);
  const ma = (stat, label) => stat?.ma50 && stat?.ma200 ? `${label} 50일선 ${stat.value > stat.ma50 ? '위' : '아래'} · 200일선 ${stat.value > stat.ma200 ? '위' : '아래'}` : null;
  const change = (stat, digits = 2) => stat ? `${fmt(stat.value, digits)} (1일 ${signed(pct(stat.value, stat.d1))}, 5일 ${signed(pct(stat.value, stat.d5))})` : null;
  const drivers = [
    { id: 'index', title: '지수 · 시장 폭', values: [['S&P 500', change(spx)], ['나스닥', change(s.nasdaq)], ['50일선 위 종목', b50 == null ? null : `${fmt(b50, 0)}%`]], context: ma(spx, 'S&P 500'), reads: restFor('index') },
    { id: 'rates', title: '금리 · 달러', values: [['미 10년물', tnx ? `${fmt(tnx.value)}% (1일 ${signed(bp(tnx.value, tnx.d1), 1, 'bp')}, 5일 ${signed(tnx5, 0, 'bp')})` : null], ['달러 인덱스', change(s.dxy)]], context: null, reads: restFor('rates') },
    { id: 'commodities', title: '원자재', values: [['WTI', change(s.wti)], ['금', change(s.gold, 0)]], context: null, reads: restFor('commodities') },
    { id: 'risk', title: '변동성 · 위험선호', values: [['VIX', vix ? `${fmt(vix.value)} (5일 ${signed(vix5, 0)})` : null], ['HY 스프레드', hyBp == null ? null : `${fmt(hyBp, 0)}bp`], ['풋/콜', pcr == null ? null : fmt(pcr)], ['F&G', fg == null ? null : fmt(fg, 0)]], context: null, reads: restFor('risk') },
    { id: 'korea', title: '한국', values: [['코스피', change(s.kospi)], ['원/달러', change(s.usdkrw, 1)]], context: null, reads: restFor('korea') }
  ].map((row) => ({ ...row, values: row.values.filter(([, value]) => value) }));
  const headline = statements[0] || null;
  return {
    available: true,
    asOf: spx.date,
    headline: headline?.text || null,
    points: lead.slice(1).map((row) => row.text),
    checks: [...new Set(statements.filter((row) => row.check).map((row) => row.check))].slice(0, 3),
    statements,
    drivers
  };
}
