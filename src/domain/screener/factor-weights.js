// P763/ARX-10 follow-up: the factor-weight regime/profile resolver is pure.
// Storage/profile lookup remains at the compatibility boundary; this module owns only the
// deterministic weight math so native and legacy screener consumers cannot diverge.
//
// Default: five equal axes (trend = price against averages 10% + trend speed 10%). The former default was 0.93
// correlated with momentum alone; it stays on record as the candidate-archive shadow model. Size has no input: 0.
export const FACTOR_WEIGHTS_MODEL_VERSION = 'factor-weights.v5';

const NEUTRAL = Object.freeze({ momentum: 0.20, trend: 0.10, lowvol: 0.20, size: 0, value: 0.20, quality: 0.20, kalman: 0.10 });
export const LEGACY_BLEND_WEIGHTS = Object.freeze({ momentum: 0.27, trend: 0.20, lowvol: 0.16, size: 0, value: 0.10, quality: 0.09, kalman: 0.10 });
const RISK_OFF = Object.freeze({ momentum: 0.10, trend: 0.08, lowvol: 0.30, size: 0, value: 0.18, quality: 0.27, kalman: 0.07 });
const RISK_ON = Object.freeze({ momentum: 0.28, trend: 0.14, lowvol: 0.10, size: 0, value: 0.16, quality: 0.18, kalman: 0.14 });
export const MODEL_DEFAULT_WEIGHTS = NEUTRAL;
// 12-1 momentum drops the latest month's reversal; quality is profitability (ROE, net margin), not growth.
export const MODEL_DEFAULT_DEFINITIONS = Object.freeze({ momentum: 'twelve-minus-one', value: 'positive-multiples', quality: 'profitability' });
export const LEGACY_BLEND_DEFINITIONS = Object.freeze({ momentum: 'blend-1-3-6', value: 'positive-multiples', quality: 'roe-margin-growth' });

function normalizeWeights(weights = {}) {
  const keys = Object.keys(weights);
  if (Array.isArray(weights) || !keys.length || keys.some(key => !Object.hasOwn(NEUTRAL, key) || typeof weights[key] !== 'number' || !Number.isFinite(weights[key]) || weights[key] < 0)) throw new Error('FACTOR_WEIGHTS_INVALID');
  const total = keys.reduce((sum, key) => sum + weights[key], 0);
  if (!(total > 0) || !Number.isFinite(total)) throw new Error('FACTOR_WEIGHTS_INVALID');
  if (total > 0 && Math.abs(total - 1) > 0.005) {
    return Object.freeze(Object.fromEntries(keys.map((key) => [key, weights[key] / total])));
  }
  return Object.freeze({ ...weights });
}

// JS \b only recognizes ASCII word characters; Korean labels need Unicode boundaries.
const regimeMatches = (text, alternatives) => new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${alternatives})(?![\\p{L}\\p{N}])`, 'iu').test(text);

function lerpWeights(base, target, t) {
  return Object.fromEntries(Object.keys(base).map((key) => [key, base[key] + t * ((target[key] || 0) - base[key])]));
}

export function deriveFactorWeights({ marketState = null, profile = null, promotion = null } = {}) {
  if (profile?.weights && typeof profile.weights === 'object') {
    const weights = normalizeWeights(profile.weights);
    return Object.freeze({
      modelVersion: FACTOR_WEIGHTS_MODEL_VERSION,
      weights,
      proposedWeights: weights,
      regimeLabel: `${profile.label || '사용자 프로필'} — ${profile.desc || ''}`.trim(),
      proposedRegimeLabel: `${profile.label || '사용자 프로필'} — ${profile.desc || ''}`.trim(),
      adaptiveApplied: false,
      source: 'explicit-user-profile'
    });
  }

  let proposedWeights = NEUTRAL;
  let proposedRegimeLabel = '중립 → 균형 가중';
  try {
    if (marketState) {
      const risk = typeof marketState.riskScore === 'number' && Number.isFinite(marketState.riskScore) ? marketState.riskScore : null;
      const fg = String(marketState.fgZone || '');
      const vixBand = String(marketState.vixBand || '');
      const riskLevel = String(marketState.riskLevel || '');
      const textOff = regimeMatches(`${vixBand} ${riskLevel}`, '패닉|경계|고변동|panic|caution|elevated') || regimeMatches(fg, '극단\\s*공포|공포|extreme fear');
      const textOn = regimeMatches(fg, '탐욕|극단\\s*탐욕|extreme greed');
      let blend = 0;
      if (risk != null) {
        if (risk >= 65) blend = 1.0;
        else if (risk >= 50) blend = (risk - 50) / 15;
        else if (risk <= 20) blend = -1.0;
        else if (risk <= 35) blend = -(35 - risk) / 15;
      }
      if (risk == null && textOff) blend = 1.0;
      else if (risk == null && textOn) blend = -1.0;
      if (textOff && blend < 0.7) blend = 0.7;
      if (textOn && blend > -0.5) blend = -0.5;
      proposedWeights = blend >= 0 ? lerpWeights(NEUTRAL, RISK_OFF, blend) : lerpWeights(NEUTRAL, RISK_ON, -blend);
      proposedRegimeLabel = blend >= 0.7 ? '위험회피 → 저변동·퀄리티 가중↑' :
        blend >= 0.3 ? '경계 → 방어 틸트' :
        blend <= -0.7 ? '위험선호 → 모멘텀·추세·칼만 가중↑' :
        blend <= -0.3 ? '낙관 → 공격 틸트' : '중립 → 균형 가중';
      if (regimeMatches(String(marketState.cyclePhase || ''), 'late|후기|peak|침체|recession')) {
        const shift = Math.min(0.08, proposedWeights.value * 0.5);
        proposedWeights = { ...proposedWeights, value: proposedWeights.value + shift, momentum: Math.max(0.05, proposedWeights.momentum - shift) };
        proposedRegimeLabel += ', 후기사이클 밸류↑';
      }
    }
  } catch (_) {}
  const normalizedProposal = normalizeWeights(proposedWeights);
  // An adaptive proposal may change production ranks only after an explicit
  // promotion record proves live/backtest definition parity and human review.
  // The current repository intentionally has no such promoted record.
  const adaptiveApplied = promotion?.status === 'PROMOTED'
    && promotion?.liveBacktestParity === true
    && promotion?.reviewApproved === true;
  const weights = adaptiveApplied ? normalizedProposal : NEUTRAL;
  return Object.freeze({
    modelVersion: FACTOR_WEIGHTS_MODEL_VERSION,
    weights,
    proposedWeights: normalizedProposal,
    regimeLabel: adaptiveApplied ? proposedRegimeLabel : proposedRegimeLabel === '중립 → 균형 가중'
      ? proposedRegimeLabel
      : `중립 고정, 미검증 후보: ${proposedRegimeLabel}`,
    proposedRegimeLabel,
    adaptiveApplied,
    source: adaptiveApplied ? 'reviewed-adaptive-promotion' : 'fixed-neutral-until-promotion'
  });
}
