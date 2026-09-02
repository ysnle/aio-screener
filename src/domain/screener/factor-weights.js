// P763/ARX-10 follow-up: the factor-weight regime/profile resolver is pure.
// Storage/profile lookup remains at the compatibility boundary; this module owns only the
// deterministic weight math so native and legacy screener consumers cannot diverge.
export const FACTOR_WEIGHTS_MODEL_VERSION = 'factor-weights.v2';

const NEUTRAL = Object.freeze({ momentum: 0.27, trend: 0.20, lowvol: 0.16, size: 0.08, value: 0.10, quality: 0.09, kalman: 0.10 });
const RISK_OFF = Object.freeze({ momentum: 0.12, trend: 0.18, lowvol: 0.28, size: 0.05, value: 0.10, quality: 0.18, kalman: 0.09 });
const RISK_ON = Object.freeze({ momentum: 0.33, trend: 0.24, lowvol: 0.09, size: 0.08, value: 0.07, quality: 0.07, kalman: 0.12 });

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

export function deriveFactorWeights({ marketState = null, profile = null } = {}) {
  if (profile?.weights && typeof profile.weights === 'object') {
    const weights = normalizeWeights(profile.weights);
    return Object.freeze({
      modelVersion: FACTOR_WEIGHTS_MODEL_VERSION,
      weights,
      regimeLabel: `${profile.label || '사용자 프로필'} — ${profile.desc || ''}`.trim()
    });
  }

  let weights = NEUTRAL;
  let regimeLabel = '중립 → 균형 가중';
  try {
    if (marketState) {
      const risk = typeof marketState.riskScore === 'number' && Number.isFinite(marketState.riskScore) ? marketState.riskScore : null;
      const fg = String(marketState.fgZone || '');
      const vixBand = String(marketState.vixBand || '');
      const riskLevel = String(marketState.riskLevel || '');
      const textOff = regimeMatches(`${vixBand} ${riskLevel}`, '패닉|경계|panic|caution|elevated') || regimeMatches(fg, '극단\\s*공포|공포|extreme fear');
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
      weights = blend >= 0 ? lerpWeights(NEUTRAL, RISK_OFF, blend) : lerpWeights(NEUTRAL, RISK_ON, -blend);
      regimeLabel = blend >= 0.7 ? '위험회피 → 저변동·퀄리티 가중↑' :
        blend >= 0.3 ? '경계 → 방어 틸트' :
        blend <= -0.7 ? '위험선호 → 모멘텀·추세·칼만 가중↑' :
        blend <= -0.3 ? '낙관 → 공격 틸트' : '중립 → 균형 가중';
      if (regimeMatches(String(marketState.cyclePhase || ''), 'late|후기|peak|침체|recession')) {
        const shift = Math.min(0.08, weights.value * 0.5);
        weights = { ...weights, value: weights.value + shift, momentum: Math.max(0.05, weights.momentum - shift) };
        regimeLabel += ' · 후기사이클 밸류↑';
      }
    }
  } catch (_) {}
  return Object.freeze({ modelVersion: FACTOR_WEIGHTS_MODEL_VERSION, weights: normalizeWeights(weights), regimeLabel });
}
