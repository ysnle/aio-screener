// Expertise review 2026-10-19: the chart marks power gaps, volatility squeezes and 8-day EMA reclaims/losses as if
// their meaning were known. A desk asks first what followed the same signal before. This reads, on the stock's own
// loaded history, each past occurrence's next SIGNAL_HORIZON sessions: the return and, when a benchmark is loaded, the
// return against it (the RS line's change). Occurrences whose windows overlap an earlier counted one are skipped, so
// a cluster of signals in one move counts once. Below SIGNAL_MIN_COUNT the figures are withheld. One stock's past is a
// small sample, not a probability; the text says so.
export const SIGNAL_HORIZON = 21;
export const SIGNAL_MIN_COUNT = 5;
export const SIGNAL_KINDS = Object.freeze({ 'power-gap': '거래량 동반 갭 상승', squeeze: '변동성 압축', 'ema8-reclaim': '8일 EMA 회복', 'ema8-lost': '8일 EMA 이탈' });

const median = (values) => {
  const list = [...values].sort((a, b) => a - b);
  const mid = list.length >> 1;
  return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2;
};

export function signalHistory({ events = [], closes = [], rsLine = [], horizon = SIGNAL_HORIZON } = {}) {
  const out = {};
  for (const kind of Object.keys(SIGNAL_KINDS)) {
    const indexes = events.filter((event) => event.kind === kind).map((event) => event.index).sort((a, b) => a - b);
    const returns = []; const excess = [];
    let nextFree = -1;
    for (const i of indexes) {
      if (i < nextFree || i + horizon >= closes.length || !(closes[i] > 0)) continue;
      nextFree = i + horizon;
      returns.push((closes[i + horizon] / closes[i] - 1) * 100);
      const a = rsLine?.[i]; const b = rsLine?.[i + horizon];
      if (a > 0 && b > 0) excess.push((b / a - 1) * 100);
    }
    const enough = returns.length >= SIGNAL_MIN_COUNT;
    out[kind] = {
      count: returns.length,
      medianPct: enough ? median(returns) : null,
      upShare: enough ? returns.filter((value) => value > 0).length / returns.length : null,
      medianExcessPct: excess.length >= SIGNAL_MIN_COUNT ? median(excess) : null,
      beatShare: excess.length >= SIGNAL_MIN_COUNT ? excess.filter((value) => value > 0).length / excess.length : null,
      measuredExcess: excess.length
    };
  }
  return { horizon, kinds: out };
}

export function signalHistoryText(signals, benchmarkLabel = '지수') {
  const signed = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  const parts = [];
  for (const [kind, label] of Object.entries(SIGNAL_KINDS)) {
    const row = signals?.kinds?.[kind];
    if (!row?.count) continue;
    if (row.medianPct == null) { parts.push(`${label} ${row.count}회(${SIGNAL_MIN_COUNT}회 미만이라 생략)`); continue; }
    const vs = row.medianExcessPct == null ? '' : `, ${benchmarkLabel} 대비 중앙값 ${signed(row.medianExcessPct)}·${Math.round(row.beatShare * row.measuredExcess)}/${row.measuredExcess}회 앞섬`;
    parts.push(`${label} ${row.count}회: 중앙값 ${signed(row.medianPct)}, 상승 ${Math.round(row.upShare * row.count)}/${row.count}회${vs}`);
  }
  return parts.length ? `${parts.join(' · ')} — 겹치는 기간은 한 번만 셈. 이 종목 한 개의 과거라 확률이 아닙니다.` : '해당 신호 없음';
}
