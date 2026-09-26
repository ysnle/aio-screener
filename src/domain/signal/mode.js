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
    // QA-SIG-27 (P1263) 제품 결정(2026-09-26): 진입 체크리스트 5조건은 시장건강 기반이며
    // 모드 독립이다 — 모드는 변동성 구성만 바꾸므로 모드별 판정 임계값은 도입하지 않는다.
    // 추후 제품이 모드별 임계값을 도입하기로 바꾸면 이 revision의 decisionThreshold를 채우고,
    // 체크리스트 집계 결과가 그 revision을 실어 나르게 결속한다(아래 summarizeEntryChecklist).
    // 지금의 null은 "임계값 없음"의 선언이지 미구현이 아니다.
    checklistPolicy: Object.freeze({
      basis: 'market-health',
      modeIndependent: true,
      decisionThreshold: null,
    }),
    note: isDay
      ? '변동성 구성에서 18≤VIX<30 구간을 +12 보정합니다. 별도 데이 판정 임계값은 사용하지 않습니다.'
      : '변동성 구성을 기본 가중으로 계산합니다. 별도 스윙 판정 임계값은 사용하지 않습니다.'
  });
}

// QA-SIG-27 (P1263): 체크리스트 3상 집계의 단일 소유자. 각 조건의 ok가 true/false/null이면
// 각각 통과/미충족/대기다 — 보고되지 않은(ok 없는) 조건도 대기로 센다(미보고를 통과나
// 미충족으로 만들지 않는다). 집계 결과는 언제나 자기 모드 revision과 decisionThreshold를
// 함께 발행한다 — 소비자가 라벨에서 임계값을 지어내지 못하게 하는 결속이다.
export function summarizeEntryChecklist(states, descriptor) {
  const rows = Array.isArray(states) ? states : [];
  let passed = 0;
  let failed = 0;
  let pending = 0;
  for (const row of rows) {
    const ok = row ? row.ok : null;
    if (ok === true) passed += 1;
    else if (ok === false) failed += 1;
    else pending += 1;
  }
  const total = rows.length;
  const label = pending > 0
    ? '일부 조건 미수신'
    : passed >= 4 ? '조건 대부분 충족' : passed >= 3 ? '조건 일부 충족' : '조건 미충족 다수';
  const desc = descriptor && typeof descriptor === 'object' && typeof descriptor.revision === 'string'
    ? descriptor
    : describeSignalScoreMode(typeof descriptor === 'string' ? descriptor : null);
  return Object.freeze({
    passed,
    failed,
    pending,
    total,
    label,
    modeRevision: desc.revision,
    decisionThreshold: desc.decisionThreshold == null ? null : desc.decisionThreshold,
  });
}
