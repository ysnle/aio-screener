// E2/LC-26: one revision for the signal score mode.
//
// Before this the mode was cosmetic on one side and invisible on the other: the legacy
// toggle only rewrote the description copy, the legacy facade hardcoded `mode: 'swing'`,
// and the native runtime reader dropped the mode entirely. The result was a mode pill
// that promised "임계값 65점 (더 엄격)" while `trading-score.js` produced no such threshold,
// and a score hero that could disagree with the pill the user clicked.
//
// The knob is real: `computeTradingScoreModel` recomputes only the volatility component
// for `mode === 'day'` (18 <= VIX < 30 → +12). Every other component, band and the
// reference-only decision gate is shared, so there is no separate day decision cutoff and
// this descriptor refuses to advertise one.
export const SIGNAL_SCORE_MODES = Object.freeze(['swing', 'day']);
export const DEFAULT_SIGNAL_SCORE_MODE = 'swing';
export const SIGNAL_SCORE_MODE_STORAGE_KEY = 'aio_signal_score_mode';

export function normalizeSignalScoreMode(mode) {
  const value = String(mode == null ? '' : mode).trim().toLowerCase();
  return SIGNAL_SCORE_MODES.includes(value) ? value : DEFAULT_SIGNAL_SCORE_MODE;
}

const SIGNAL_SCORE_MODE_LABELS = Object.freeze({ swing: '스윙', day: '데이트레이딩' });

export function describeSignalScoreMode(mode) {
  const normalized = normalizeSignalScoreMode(mode);
  const isDay = normalized === 'day';
  return Object.freeze({
    mode: normalized,
    revision: `signal-score-mode.${normalized}`,
    label: SIGNAL_SCORE_MODE_LABELS[normalized],
    // The exact mode-dependent term the model applies; `none` means the score is
    // identical to the default weighting.
    volatilityAdjustment: isDay ? 'day-vix-18-30-plus-12' : 'none',
    // No mode-specific decision cutoff exists; keep the field so a consumer cannot
    // invent one from a label.
    decisionThreshold: null,
    note: isDay
      ? '변동성 구성에서 18≤VIX<30 구간을 +12 보정합니다. 별도 데이 판정 임계값은 사용하지 않습니다.'
      : '변동성 구성을 기본 가중으로 계산합니다. 별도 스윙 판정 임계값은 사용하지 않습니다.'
  });
}
