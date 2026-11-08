// P1626: conditional readings from observed bars. No price targets or probabilities.
import { formatScreenerPrice } from '../screener/market-scope.js';
import { finiteNumber as finite } from '../shared/number.js';

// One volume profile for the chart overlay, the 거래 집중 가격대 table, the price-level map
// and the AI context. They used to be two estimates (32 rows on the chart, 24 in the table, a different missing-volume
// rule), so the chart's 최대 매물대 and the table's first zone could name different prices on one screen.
// Method (TradingView VRVP / Market Profile conventions): each bar's volume spread evenly over its low~high range across
// `binCount` equal price rows; the point of control (POC) is the heaviest row; the value area is grown from the POC by
// adding, each step, whichever side's next two rows hold more volume until it holds VALUE_AREA_SHARE of the total (the
// CBOT rule). Bars without volume are left out — never counted as zero — and the profile needs MIN_VOLUME_COVERAGE
// of the window to carry volume. An estimate from daily ranges, not traded-at-price volume.
export const VOLUME_PROFILE_ROWS = 24;
export const VALUE_AREA_SHARE = 0.7;
export const MIN_VOLUME_COVERAGE = 0.9;

/** The value area (CBOT rule): rows grown from the POC by the heavier pair of neighbours until `share` of the volume. */
export function valueArea(bins, poc, share = VALUE_AREA_SHARE) {
  const total = bins.reduce((sum, bin) => sum + bin.volume, 0);
  if (!(total > 0) || poc < 0) return null;
  let lo = poc, hi = poc, held = bins[poc].volume;
  const pair = (from, step) => [from + step, from + 2 * step].filter((i) => i >= 0 && i < bins.length);
  while (held / total < share && (lo > 0 || hi < bins.length - 1)) {
    const up = pair(hi, 1), down = pair(lo, -1);
    const upVol = up.reduce((sum, i) => sum + bins[i].volume, 0), downVol = down.reduce((sum, i) => sum + bins[i].volume, 0);
    if (up.length && (!down.length || upVol >= downVol)) { hi = up.at(-1); held += upVol; } else { lo = down.at(-1); held += downVol; }
  }
  return { lowIndex: lo, highIndex: hi, low: bins[lo].low, high: bins[hi].high, share: held / total * 100 };
}

export function buildVolumeByPrice(bars = [], { lookback = 130, binCount = VOLUME_PROFILE_ROWS } = {}) {
  const recent = bars.slice(-lookback);
  if (recent.some(bar => !(bar?.high >= bar?.low) || !(bar.low > 0))) return { available: false, reason: 'price-range-invalid' };
  const covered = recent.filter(bar => finite(bar.volume) != null && bar.volume >= 0);
  if (recent.length < 40 || covered.length < Math.max(40, Math.ceil(recent.length * MIN_VOLUME_COVERAGE))) return { available: false, reason: 'volume-history-incomplete' };
  const low = Math.min(...recent.map(bar => bar.low)), high = Math.max(...recent.map(bar => bar.high));
  if (!(high > low)) return { available: false, reason: 'price-range-flat' };
  const count = Math.min(48, Math.max(8, Math.round(binCount)));
  const width = (high - low) / count;
  const bins = Array.from({ length: count }, (_, index) => ({ low: low + index * width, high: low + (index + 1) * width, volume: 0 }));
  for (const bar of covered) {
    if (bar.high === bar.low) { bins[Math.min(count - 1, Math.floor((bar.low - low) / width))].volume += bar.volume; continue; }
    const first = Math.max(0, Math.floor((bar.low - low) / width)), last = Math.min(count - 1, Math.floor((bar.high - low) / width));
    for (let index = first; index <= last; index++) {
      const bin = bins[index];
      const overlap = Math.max(0, Math.min(bin.high, bar.high) - Math.max(bin.low, bar.low));
      bin.volume += bar.volume * overlap / (bar.high - bar.low);
    }
  }
  const totalVolume = covered.reduce((total, bar) => total + bar.volume, 0);
  if (!(totalVolume > 0)) return { available: false, reason: 'volume-empty' };
  const zones = [];
  for (const index of bins.map((bin, index) => ({ index, volume: bin.volume })).sort((a, b) => b.volume - a.volume).map(item => item.index)) {
    if (!zones.some(zone => Math.abs(zone.index - index) <= 1)) zones.push({ ...bins[index], index, share: bins[index].volume / totalVolume * 100 });
    if (zones.length === 3) break;
  }
  const pocIndex = zones[0].index;
  const poc = { index: pocIndex, low: bins[pocIndex].low, high: bins[pocIndex].high, price: (bins[pocIndex].low + bins[pocIndex].high) / 2, share: zones[0].share };
  return { available: true, bins, zones, poc, valueArea: valueArea(bins, pocIndex), totalVolume, sessions: recent.length, coveredSessions: covered.length,
    start: recent[0].time, end: recent.at(-1).time, method: 'daily-range-uniform-volume' };
}

/** Where a price sits against the profile: above or below the value area, inside it, or on the POC row. */
export function profilePosition(profile, price) {
  if (!profile?.available || !(price > 0)) return null;
  if (price >= profile.poc.low && price <= profile.poc.high) return 'poc';
  const va = profile.valueArea;
  if (!va) return null;
  return price > va.high ? 'above' : price < va.low ? 'below' : 'inside';
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
  // v59.45 P24-DISTANCE-01: both distances are the move from today's close (one denominator). The old sentence put
  // resistance/close - 1 (the rise needed, 20% for 100 -> 120) after "기준보다 아래", where 100 is 16.7% under 120, and
  // measured support from the support price, so the two sides were compared on different bases.
  const toWeak = last.close > 0 && support > 0 ? (1 - support / last.close) * 100 : null;
  const toRecover = last.close > 0 && resistance > 0 ? (resistance / last.close - 1) * 100 : null;
  const nearest = toWeak != null && toRecover != null && toWeak >= 0 && toRecover >= 0
    ? `종가에서 약화 기준(${price(support)})까지는 ${toWeak.toFixed(1)}% 하락, 회복 기준(${price(resistance)})까지는 ${toRecover.toFixed(1)}% 상승 거리입니다 — ${Math.abs(toWeak - toRecover) < 0.5 ? '두 기준과의 거리가 비슷합니다' : toWeak < toRecover ? '약화 기준이 더 가깝습니다' : '회복 기준이 더 가깝습니다'}.`
    : null;
  return { available: true, scenarios, resistance, support, nearest, asOf: analysis.asOf };
}
