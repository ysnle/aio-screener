import { createRegimeState, stableHash } from '../../data/contracts/screener.js';

export const REGIME_MODEL_VERSION = 'regime.v2';
const STATES = Object.freeze(['RISK_ON', 'NEUTRAL', 'RISK_OFF', 'LOW_CONFIDENCE']);

function finite(value) { return typeof value === 'number' && Number.isFinite(value) ? value : null; }

function normalizeInput(value, low, high) {
  const numeric = finite(value);
  if (numeric == null) return null;
  return Math.max(-1, Math.min(1, (numeric - low) / (high - low) * 2 - 1));
}

export function deriveRegimeState({ inputs = {}, previous = null, now = Date.now(), minHoldMs = 2 * 86_400_000, enter = { riskOn: 0.35, riskOff: -0.35 }, exit = { riskOn: 0.1, riskOff: -0.1 }, liveBacktestParity = false } = {}) {
  const nowMs = typeof now === 'number' && Number.isFinite(now) ? now : Date.parse(now || '');
  if (!Number.isFinite(nowMs)) throw new Error('REGIME_NOW_INVALID');
  const holdMs = typeof minHoldMs === 'number' && Number.isFinite(minHoldMs) && minHoldMs >= 0 ? minHoldMs : 0;
  const normalized = {
    trend: normalizeInput(inputs.trendScore, -1, 1),
    breadth: normalizeInput(inputs.breadthScore, 0, 100),
    volatility: normalizeInput(inputs.volatilityScore, 0, 100),
    credit: normalizeInput(inputs.creditScore, -1, 1),
    rotation: normalizeInput(inputs.rotationScore, -1, 1)
  };
  const missingInputs = Object.entries(normalized).filter(([, value]) => value == null).map(([key]) => key);
  const values = Object.values(normalized).filter((value) => value != null);
  const score = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const confidence = values.length / Object.keys(normalized).length;
  const priorState = previous?.state && STATES.includes(previous.state) ? previous.state : 'NEUTRAL';
  const priorAt = previous?.observedAt ? Date.parse(previous.observedAt) : NaN;
  const held = Number.isFinite(priorAt) && priorAt <= nowMs && nowMs - priorAt < holdMs;
  let state = priorState;
  let transitionReason = 'hysteresis_hold';
  if (score == null || confidence < 0.6) {
    state = priorState === 'LOW_CONFIDENCE' ? 'LOW_CONFIDENCE' : priorState;
    transitionReason = 'missing_or_low_coverage';
  } else if (!held) {
    if (priorState === 'RISK_ON') state = score < exit.riskOn ? 'NEUTRAL' : 'RISK_ON';
    else if (priorState === 'RISK_OFF') state = score > exit.riskOff ? 'NEUTRAL' : 'RISK_OFF';
    else if (score >= enter.riskOn) state = 'RISK_ON';
    else if (score <= enter.riskOff) state = 'RISK_OFF';
    else state = 'NEUTRAL';
    transitionReason = state === priorState ? 'threshold_unchanged' : `threshold_transition:${priorState}->${state}`;
  }
  if (missingInputs.length || confidence < 1) state = state === 'NEUTRAL' ? 'LOW_CONFIDENCE' : state;
  return createRegimeState({
    regimeId: `regime-${stableHash({ normalized, state, now: new Date(nowMs).toISOString().slice(0, 10) })}`,
    observedAt: new Date(nowMs).toISOString(),
    inputs: { ...inputs, normalized, score },
    state,
    confidence,
    missingInputs,
    transitionReason,
    hysteresisState: held ? 'minimum-hold' : 'eligible-to-transition',
    allowedUse: 'reference-only',
    liveBacktestParity
  });
}

export function replayRegime({ history = [], initial = null, options = {} } = {}) {
  let previous = initial;
  const transitions = [];
  const states = [];
  for (const point of (Array.isArray(history) ? history : [])) {
    const pointNow = point.now ?? (point.observedAt ? Date.parse(point.observedAt) : null);
    const next = deriveRegimeState({ ...options, inputs: point.inputs || point, previous, now: pointNow });
    if (previous && previous.state !== next.state) transitions.push({ from: previous.state, to: next.state, at: next.observedAt, reason: next.transitionReason });
    states.push(next);
    previous = next;
  }
  const fixed = states.map((state) => state.state);
  const adaptive = states.map((state) => state.state === 'RISK_ON' ? 'MOMENTUM_TILT' : state.state === 'RISK_OFF' ? 'DEFENSIVE_TILT' : 'NEUTRAL_TILT');
  return Object.freeze({ modelVersion: REGIME_MODEL_VERSION, states: Object.freeze(states), transitions: Object.freeze(transitions), fixedVsAdaptiveDiff: Object.freeze(states.map((state, index) => ({ at: state.observedAt, fixed: fixed[index], adaptive: adaptive[index], changed: fixed[index] !== adaptive[index] }))), autoWeightPromotion: false, reason: 'performance-improvement-not-established' });
}
