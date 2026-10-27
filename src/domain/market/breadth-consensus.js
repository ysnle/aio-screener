// v59.41 (roadmap 11, layer 5 score): moved out of js/aio-core.js (AIO.diagnoseBreadthConsensus) unchanged,
// except that the threshold registry is passed in rather than read from the global root; src/app/score-entry-points.js
// passes AIO_THRESHOLD_REGISTRY on every call, as the legacy function read it.
// ─────────────────────────────────────────────────────────────────
// v49.25 L3 근본 수정: diagnoseBreadthConsensus
// 다중 신호(5SMA/20SMA/50SMA/McClellan/Weinstein/Golden Cross)를 가중 평균하여
// 합의된 단일 판정을 도출. 모순 시그널 자동 가중치 조정.
// ─────────────────────────────────────────────────────────────────
export function diagnoseBreadthConsensus(signals, reg) {
  signals = signals || {};
  if (!reg || !reg.BREADTH) return { verdict: '—', score: null, conflict: null };

  var weights = { sma5: 0.10, sma20: 0.20, sma50: 0.30, mcclellan: 0.20, weinstein: 0.10, goldenCross: 0.10 };
  var totalWeight = 0, totalScore = 0;
  var details = [];
  // signal bands: bullish=+1, mixed=0, bearish=-1, capitulation=+0.5, overbought=-0.5
  var bandScoreMap = { 'capitulation': 0.5, 'bearish': -1, 'mixed': 0, 'bullish': 1, 'overbought': -0.5 };

  ['sma5', 'sma20', 'sma50'].forEach(function(k) {
    var v = Number(signals[k]);
    if (isNaN(v)) return;
    var label = reg.BREADTH.getLabel(v);
    var score = bandScoreMap[label.signal] != null ? bandScoreMap[label.signal] : 0;
    totalScore += score * weights[k];
    totalWeight += weights[k];
    details.push({ key: k, value: v, label: label.label, score: score });
  });

  // 추가 신호: 'bullish' | 'bearish' | 'neutral' 직접 입력
  ['mcclellan', 'weinstein', 'goldenCross'].forEach(function(k) {
    if (signals[k] == null) return;
    var s = signals[k];
    var score = s === 'bullish' ? 1 : s === 'bearish' ? -1 : 0;
    totalScore += score * weights[k];
    totalWeight += weights[k];
    details.push({ key: k, signal: s, score: score });
  });

  if (totalWeight === 0) return { verdict: '—', score: null, conflict: null };
  var consensus = totalScore / totalWeight;
  var verdict;
  if (consensus > 0.4) verdict = '강세 합의';
  else if (consensus > 0.1) verdict = '강세 우위';   // v50.20: 부호 버그 시정 — 양의 합의(0.1~0.4)는 강세 우위 (이전 '약세 우위'는 결론 반대)
  else if (consensus > -0.1) verdict = '혼조 (모순 신호 존재)';
  else if (consensus > -0.4) verdict = '약세 우위';
  else verdict = '약세 합의';

  // 모순 탐지: 각 시그널의 부호가 다를 때
  var positives = details.filter(function(d) { return d.score > 0; }).length;
  var negatives = details.filter(function(d) { return d.score < 0; }).length;
  var conflict = positives > 0 && negatives > 0
    ? { positiveCount: positives, negativeCount: negatives, note: positives + '개 강세 vs ' + negatives + '개 약세 신호 공존' }
    : null;

  return {
    verdict: verdict,
    consensus: consensus,
    details: details,
    conflict: conflict
  };
}
