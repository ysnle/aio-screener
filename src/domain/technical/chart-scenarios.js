// P1626: conditional readings from observed bars. No price targets or probabilities.
import { formatScreenerPrice } from '../screener/market-scope.js';
const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null;

export function buildVolumeByPrice(bars = [], { lookback = 130, binCount = 24 } = {}) {
  const recent = bars.slice(-lookback);
  if (recent.length < 40 || recent.some(bar => finite(bar.volume) == null || bar.volume < 0 || !(bar.high >= bar.low) || !(bar.low > 0))) return { available: false, reason: 'volume-history-incomplete' };
  const low = Math.min(...recent.map(bar => bar.low)), high = Math.max(...recent.map(bar => bar.high));
  if (!(high > low)) return { available: false, reason: 'price-range-flat' };
  const count = Math.min(48, Math.max(8, Math.round(binCount)));
  const width = (high - low) / count;
  const bins = Array.from({ length: count }, (_, index) => ({ low: low + index * width, high: low + (index + 1) * width, volume: 0 }));
  for (const bar of recent) {
    if (bar.high === bar.low) { bins[Math.min(count - 1, Math.floor((bar.low - low) / width))].volume += bar.volume; continue; }
    for (const bin of bins) {
      const overlap = Math.max(0, Math.min(bin.high, bar.high) - Math.max(bin.low, bar.low));
      bin.volume += bar.volume * overlap / (bar.high - bar.low);
    }
  }
  const totalVolume = recent.reduce((total, bar) => total + bar.volume, 0);
  if (!(totalVolume > 0)) return { available: false, reason: 'volume-empty' };
  const zones = [];
  for (const index of bins.map((bin, index) => ({ index, volume: bin.volume })).sort((a, b) => b.volume - a.volume).map(item => item.index)) {
    if (!zones.some(zone => Math.abs(zone.index - index) <= 1)) zones.push({ ...bins[index], index, share: bins[index].volume / totalVolume * 100 });
    if (zones.length === 3) break;
  }
  return { available: true, bins, zones, totalVolume, sessions: recent.length, start: recent[0].time, end: recent.at(-1).time, method: 'daily-range-uniform-volume' };
}

export function buildChartScenarios(analysis, { currency = null } = {}) {
  if (!analysis?.available || analysis.bars?.length < 20) return { available: false, scenarios: [] };
  const recent = analysis.bars.slice(-20), last = analysis.last;
  const rangeHigh = Math.max(...recent.map(bar => bar.high)), rangeLow = Math.min(...recent.map(bar => bar.low));
  const pivot = finite(analysis.pivot);
  const contractionLow = finite(analysis.vcp?.contractions?.at(-1)?.low);
  const resistance = pivot != null && pivot > last.close ? pivot : rangeHigh;
  const support = contractionLow != null && contractionLow < last.close ? contractionLow : rangeLow;
  const price = value => (currency ? formatScreenerPrice(value, currency) : value.toLocaleString('en-US', { maximumFractionDigits: 2 }));
  const scenarios = [
    { id: 'recovery', title: '회복·확장 조건', level: resistance, text: `${pivot === resistance ? '수축 고점' : '최근 20거래일 고점'} ${price(resistance)} 위 종가와 이후 유지 여부를 확인합니다. 거래량이 함께 증가하면 가격과 참여가 같은 방향이라는 근거가 보강됩니다. 다시 이 가격 아래로 마감하면 회복 해석은 약해집니다.` },
    { id: 'range', title: '범위 안 흐름', text: `${price(support)}~${price(resistance)} 안에서 머무르면 방향보다 범위와 거래량 변화를 살펴봅니다. 고점·저점이 함께 높아지는지, 하락일 거래량이 늘어나는지가 다음 구분 기준입니다.` },
    { id: 'weakness', title: '약화 조건', level: support, text: `${contractionLow === support ? '마지막 수축 저점' : '최근 20거래일 저점'} ${price(support)} 아래 종가가 이어지면 기존 가격 구조가 약해집니다. 이후 같은 가격을 회복하는지에 따라 이탈 지속과 범위 복귀를 구분합니다.` }
  ];
  // v58.74 (text audit): the expert's first question about three paths — which trigger the close is nearer to.
  const toWeak = last.close > 0 && support > 0 ? (last.close / support - 1) * 100 : null;
  const toRecover = last.close > 0 && resistance > 0 ? (resistance / last.close - 1) * 100 : null;
  const nearest = toWeak != null && toRecover != null && toWeak >= 0 && toRecover >= 0
    ? `종가는 약화 기준(${price(support)})보다 ${toWeak.toFixed(1)}% 위, 회복 기준(${price(resistance)})보다 ${toRecover.toFixed(1)}% 아래입니다 — ${Math.abs(toWeak - toRecover) < 0.5 ? '두 기준과의 거리가 비슷합니다' : toWeak < toRecover ? '약화 기준이 더 가깝습니다' : '회복 기준이 더 가깝습니다'}.`
    : null;
  return { available: true, scenarios, resistance, support, nearest, asOf: analysis.asOf };
}
