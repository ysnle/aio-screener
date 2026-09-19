import { fearGreedBand, vixTermStructure } from './metrics.js';

export const SENTIMENT_NARRATIVE_MODEL_VERSION = 'sentiment-narrative.v1';

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function putCallBand(value) {
  const ratio = finite(value);
  if (ratio == null || ratio < 0 || ratio > 10) return Object.freeze({ value: null, label: '판정 보류', blocked: true });
  if (ratio > 1.3) return Object.freeze({ value: ratio, label: '풋 거래 비중이 높은 구간', blocked: false });
  if (ratio > 1.0) return Object.freeze({ value: ratio, label: '풋 우세 구간', blocked: false });
  if (ratio > 0.7) return Object.freeze({ value: ratio, label: '균형 구간', blocked: false });
  return Object.freeze({ value: ratio, label: '콜 거래 비중이 높은 구간', blocked: false });
}

export function putCallNeedlePosition(value) {
  const ratio = finite(value);
  if (ratio == null) return '판정 보류';
  if (ratio >= 1.2) return '공포';
  if (ratio <= 0.7) return '탐욕';
  return '중립';
}

export function vixBand(value) {
  const vix = finite(value);
  if (vix == null || vix < 0) return Object.freeze({ value: null, label: '판정 보류', blocked: true });
  if (vix > 35) return Object.freeze({ value: vix, label: '고변동 구간', blocked: false });
  if (vix > 25) return Object.freeze({ value: vix, label: '변동성 경계 구간', blocked: false });
  if (vix > 16) return Object.freeze({ value: vix, label: '통상 범위', blocked: false });
  return Object.freeze({ value: vix, label: '저변동 구간', blocked: false });
}

export function spyMoveState(spyChg) {
  const move = finite(spyChg);
  if (move == null) return Object.freeze({ value: null, state: 'missing' });
  return Object.freeze({ value: move, state: 'observed' });
}

export function tradingScoreLink(total) {
  const score = total == null || typeof total === 'boolean' || (typeof total === 'string' && !total.trim()) ? null : Number(total);
  const value = score != null && Number.isFinite(score) ? score : null;
  if (value == null) return Object.freeze({ value: null, state: 'withheld', text: '트레이딩 스코어 근거 미수신 — 연동 판정 보류.' });
  return Object.freeze({ value, state: 'observed', text: null });
}

function narrative({ claimId, inputMetricIds, inputEvidenceIds, text, status }) {
  return Object.freeze({ claimId, inputMetricIds: Object.freeze(inputMetricIds.slice()), inputEvidenceIds: Object.freeze(inputEvidenceIds.slice()), text, status });
}

function metricPresentation({ metricId, value, unit, evidence }) {
  const evidenceId = evidence?.evidenceId || null;
  const observedAt = evidence?.observedAt || null;
  const sourceLabel = evidence?.source || evidence?.sourceLabel || 'sentiment-provider';
  const allowedRaw = evidence?.allowedUse || 'none';
  const allowedUse = allowedRaw === 'decision' ? 'decision' : allowedRaw === 'reference' ? 'reference' : 'none';
  const status = evidence?.status || null;
  const freshness = status === 'live' || status === 'fresh' || status === 'verified_current' ? 'current' : status === 'stale' ? 'stale' : 'unknown';
  const availability = value == null ? (status === 'missing' || status == null ? 'missing' : 'failed') : status === 'snapshot' ? 'partial' : 'ready';
  return Object.freeze({ metricId, value, unit, evidenceId, observedAt, sourceLabel, freshness, allowedUse, availability });
}

export function deriveSentimentViewModel({ values = {}, evidenceByMetric = {}, revision = null, now = null } = {}) {
  const fg = fearGreedBand(values.fearGreed);
  const term = vixTermStructure({ vix9d: values.vix9d, vix: values.vix, vix3m: values.vix3m, vix6m: values.vix6m });
  const pc = putCallBand(values.putCall);
  const vix = vixBand(values.vix);
  const spy = spyMoveState(values.spyChg ?? null);
  const trading = tradingScoreLink(values.tradingScoreTotal ?? null);
  const metrics = Object.freeze([
    metricPresentation({ metricId: 'fearGreed', value: fg.score, unit: 'score', evidence: evidenceByMetric.fearGreed || null }),
    metricPresentation({ metricId: 'vix', value: vix.value, unit: 'index', evidence: evidenceByMetric.vix || null }),
    metricPresentation({ metricId: 'putCall', value: pc.value, unit: 'ratio', evidence: evidenceByMetric.putCall || null })
  ]);
  const evidenceIds = (ids) => ids.map((id) => evidenceByMetric[id]?.evidenceId || null).filter(Boolean);
  const narratives = [];
  if (pc.blocked) {
    narratives.push(narrative({ claimId: 'sentiment.put-call', inputMetricIds: ['putCall'], inputEvidenceIds: evidenceIds(['putCall']), text: 'P/C 관측 미수신 — 풋·콜 비중 판정 보류.', status: 'withheld' }));
  } else {
    narratives.push(narrative({ claimId: 'sentiment.put-call', inputMetricIds: ['putCall'], inputEvidenceIds: evidenceIds(['putCall']), text: `P/C비율 ${pc.value.toFixed(2)} — ${pc.label}.`, status: 'reference' }));
  }
  if (fg.blocked || term.blocked) {
    narratives.push(narrative({ claimId: 'sentiment.composite', inputMetricIds: ['fearGreed', 'vix', 'vix9d', 'vix3m', 'vix6m'], inputEvidenceIds: evidenceIds(['fearGreed', 'vix']), text: '복합 판단 보류 — F&G 또는 VIX 기간구조 입력 미수신.', status: 'withheld' }));
  } else {
    narratives.push(narrative({ claimId: 'sentiment.composite', inputMetricIds: ['fearGreed', 'vix', 'vix9d', 'vix3m', 'vix6m'], inputEvidenceIds: evidenceIds(['fearGreed', 'vix']), text: `Fear & Greed ${fg.score} (${fg.label}) · VIX 기간구조 ${term.regime}.`, status: 'reference' }));
  }
  if (spy.state === 'missing') {
    narratives.push(narrative({ claimId: 'sentiment.spy-vix-divergence', inputMetricIds: ['spyChg', 'vix'], inputEvidenceIds: evidenceIds(['vix']), text: 'SPY 등락 미수신 — 공포지수 vs 주가 동행·역행 판정 보류.', status: 'withheld' }));
  } else {
    narratives.push(narrative({ claimId: 'sentiment.spy-vix-divergence', inputMetricIds: ['spyChg', 'vix'], inputEvidenceIds: evidenceIds(['vix']), text: `SPY ${spy.value >= 0 ? '+' : ''}${spy.value.toFixed(1)}% · VIX ${vix.value == null ? '미수신' : vix.value.toFixed(1)}.`, status: 'reference' }));
  }
  if (trading.state === 'withheld') {
    narratives.push(narrative({ claimId: 'sentiment.trading-score-link', inputMetricIds: ['tradingScoreTotal'], inputEvidenceIds: [], text: trading.text, status: 'withheld' }));
  } else {
    narratives.push(narrative({ claimId: 'sentiment.trading-score-link', inputMetricIds: ['tradingScoreTotal'], inputEvidenceIds: [], text: `트레이딩 스코어 ${trading.value}/100 — 참고값이며 진입 허가가 아닙니다.`, status: 'reference' }));
  }
  const fingerprintSource = JSON.stringify([values.fearGreed ?? null, values.vix9d ?? null, values.vix ?? null, values.vix3m ?? null, values.vix6m ?? null, values.putCall ?? null, values.spyChg ?? null, values.tradingScoreTotal ?? null, now ?? null]);
  let fingerprint = 0;
  for (let index = 0; index < fingerprintSource.length; index += 1) fingerprint = (fingerprint * 31 + fingerprintSource.charCodeAt(index)) >>> 0;
  return Object.freeze({ modelVersion: SENTIMENT_NARRATIVE_MODEL_VERSION, revision: revision || `sentiment:${fingerprint.toString(16)}`, metrics, narratives: Object.freeze(narratives) });
}
