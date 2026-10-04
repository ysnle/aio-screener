// P1438 (포트폴리오 redesign): the holdings read against the market they sit in — how much of the money
// is in names still in an uptrend, in sectors the rotation favours, how the book did against the S&P 500,
// and whether the market regime makes the weakest positions the first to watch. Value-weighted on the
// surface's base-currency values; a holding without a value or a screener row is left out and counted.
import { SECTOR_ETF } from '../entity/stock-read.js';
import { sectorLabel } from '../screener/screener-read.js';

const finite = (value) => (value != null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null);
const signed = (value, digits = 1, unit = '%') => `${value >= 0 ? '+' : ''}${value.toFixed(digits)}${unit}`;
const QUADRANT = Object.freeze({ Leading: { label: '선도', tone: 'favorable' }, Improving: { label: '개선', tone: 'neutral' }, Weakening: { label: '약화', tone: 'neutral' }, Lagging: { label: '후행', tone: 'burden' } });

function trendState(row) {
  const s50 = finite(row?.pctSma50);
  const s200 = finite(row?.pctSma200);
  if (s50 == null || s200 == null) return null;
  return s50 >= 0 && s200 >= 0 ? 'up' : s50 < 0 && s200 >= 0 ? 'pullback' : s50 >= 0 ? 'rebound' : 'down';
}
export const TREND_LABEL = Object.freeze({ up: '상승 추세', pullback: '추세 속 조정', rebound: '장기 추세 아래 반등', down: '하락 추세' });

export function buildPortfolioRead({ surface = null, rows = [], benchmark = null, benchmarkFor = null, rotation = {}, regime = null } = {}) {
  const bySymbol = new Map((rows || []).map((row) => [String(row?.sym || '').toUpperCase(), row]));
  const holdings = (Array.isArray(surface?.rows) ? surface.rows : [])
    .map((row) => ({ symbol: String(row?.symbol || row?.ticker || '').toUpperCase(), value: finite(row?.value) }))
    .filter((row) => row.symbol && row.value != null && row.value > 0)
    .map((row) => ({ ...row, data: bySymbol.get(row.symbol) || null }));
  const total = holdings.reduce((sum, row) => sum + row.value, 0);
  if (!holdings.length || !(total > 0)) return { available: false, reason: '평가액이 있는 보유 종목이 없어 시장과 연결해 읽을 내용이 없습니다.' };
  const known = holdings.filter((row) => row.data);
  const knownValue = known.reduce((sum, row) => sum + row.value, 0);
  const points = [];

  const trends = { up: 0, pullback: 0, rebound: 0, down: 0 };
  for (const row of known) { const state = trendState(row.data); if (state) trends[state] += row.value; }
  const trendTotal = Object.values(trends).reduce((a, b) => a + b, 0);
  const trendMix = trendTotal > 0 ? Object.entries(trends).map(([state, value]) => ({ state, label: TREND_LABEL[state], pct: value / trendTotal * 100 })) : [];
  const weakest = known.filter((row) => trendState(row.data) === 'down').sort((a, b) => b.value - a.value);
  const breadth = regime?.axes?.find((axis) => axis.id === 'breadth');
  if (trendMix.length) {
    const up = trendMix.find((row) => row.state === 'up').pct;
    const down = trendMix.find((row) => row.state === 'down').pct;
    points.push({ id: 'trend', tone: up >= 60 ? 'favorable' : down >= 30 ? 'burden' : 'neutral', title: '보유 종목 추세',
      text: `평가액의 ${up.toFixed(0)}%가 상승 추세(50·200일선 위), ${down.toFixed(0)}%가 하락 추세에 있습니다${weakest.length ? ` — 하락 추세 중 가장 큰 비중은 ${weakest.slice(0, 2).map((row) => `${row.symbol}(${(row.value / total * 100).toFixed(0)}%)`).join(' · ')}` : ''}.${breadth?.state === 'burden' && down > 0 ? ' 시장 폭이 좁은 지금은 하락 추세 종목이 지수보다 먼저 흔들리기 쉬운 환경입니다.' : breadth?.state === 'burden' ? ' 시장 폭이 좁은 가운데 보유 종목은 추세를 지키는 쪽에 있습니다.' : ''}` });
  }

  const sectors = new Map();
  for (const row of known) {
    const sector = row.data.sector || '분류 없음';
    const entry = sectors.get(sector) || { sector, label: sectorLabel(sector), value: 0 };
    entry.value += row.value;
    sectors.set(sector, entry);
  }
  const sectorMix = [...sectors.values()].map((entry) => {
    const etf = SECTOR_ETF[entry.sector];
    const quadrant = etf && rotation[etf] ? QUADRANT[rotation[etf].quadrant] || null : null;
    return { ...entry, pct: entry.value / knownValue * 100, quadrant };
  }).sort((a, b) => b.value - a.value);
  const rated = sectorMix.filter((row) => row.quadrant);
  if (rated.length) {
    const favourable = rated.filter((row) => row.quadrant.tone === 'favorable').reduce((sum, row) => sum + row.pct, 0);
    const lagging = rated.filter((row) => row.quadrant.tone === 'burden').reduce((sum, row) => sum + row.pct, 0);
    points.push({ id: 'rotation', tone: favourable >= lagging ? 'favorable' : 'burden', title: '섹터 회전과',
      text: `보유 비중의 ${favourable.toFixed(0)}%가 시장보다 강해지는 '선도' 섹터, ${lagging.toFixed(0)}%가 '후행' 섹터에 있습니다 (${sectorMix.slice(0, 3).map((row) => `${row.label} ${row.pct.toFixed(0)}%${row.quadrant ? ` ${row.quadrant.label}` : ''}`).join(' · ')}).` });
  }

  const weighted = (key) => {
    const list = known.filter((row) => finite(row.data[key]) != null);
    const weight = list.reduce((sum, row) => sum + row.value, 0);
    return weight > 0 ? list.reduce((sum, row) => sum + row.value * row.data[key], 0) / weight : null;
  };
  const book3 = weighted('ret3m');
  // P1447: each holding against its own market's index at the same weight (S&P 500 for US, KOSPI/KOSDAQ
  // for KRX), so a mixed book is not judged against the S&P 500 alone.
  let bench3 = finite(benchmark?.ret3m);
  let benchLabel = 'S&P 500';
  if (typeof benchmarkFor === 'function') {
    const parts = known.map((row) => ({ value: row.value, bench: benchmarkFor(row.symbol) })).filter((part) => finite(part.bench?.ret3m) != null && finite(part.value) != null);
    const weight = parts.reduce((sum, part) => sum + part.value, 0);
    if (weight > 0) {
      bench3 = parts.reduce((sum, part) => sum + part.value * part.bench.ret3m, 0) / weight;
      const labels = [...new Set(parts.map((part) => part.bench.label))];
      benchLabel = labels.length > 1 ? `같은 비중의 ${labels.join('·')} 혼합` : labels[0];
    }
  }
  if (book3 != null && bench3 != null) {
    const gap = book3 - bench3;
    points.push({ id: 'relative', tone: gap >= 0 ? 'favorable' : 'burden', title: '지수 대비',
      text: `지금 비중으로 계산한 3개월 수익률 ${signed(book3)} vs ${benchLabel} ${signed(bench3)} — ${Math.abs(gap).toFixed(1)}%p ${gap >= 0 ? '앞섭니다' : '뒤처집니다'}. 실제 매매 시점과 다를 수 있는 현재 구성 기준 값입니다.` });
  }
  if (regime?.available) {
    points.push({ id: 'market', tone: regime.counts?.burden >= 4 ? 'burden' : 'neutral', title: '시장 환경',
      text: `시장은 ${regime.overall}(우호 ${regime.counts.favorable} · 부담 ${regime.counts.burden})입니다. ${regime.counts.burden >= 4 ? '부담 축이 많은 환경에서는 손절 기준과 현금 비중을 먼저 점검하는 편이 일반적입니다.' : '환경이 극단적이지 않아 종목별 추세가 더 중요한 국면입니다.'}` });
  }
  const excluded = holdings.length - known.length;
  const headline = [trendMix.length ? `상승 추세 비중 ${trendMix.find((row) => row.state === 'up').pct.toFixed(0)}%` : null,
    book3 != null && bench3 != null ? `3개월 지수 대비 ${signed(book3 - bench3, 1, '%p')}` : null,
    regime?.available ? `시장 ${regime.overall}` : null].filter(Boolean).join(' · ');
  const next = [];
  if (weakest[0]) next.push({ action: 'showTicker', arg: weakest[0].symbol, route: 'ticker', label: weakest[0].symbol, why: '하락 추세 중 비중이 가장 큰 종목의 요약·차트' });
  next.push({ route: 'themes', label: '테마 · 섹터', why: '보유 섹터가 회전의 어느 단계에 있는지' });
  next.push({ route: 'signal', label: '시장 상태', why: '부담 축이 무엇이고 무엇이 바뀌면 완화되는지' });
  return { available: true, headline, points, trendMix, sectorMix, excluded, next };
}
