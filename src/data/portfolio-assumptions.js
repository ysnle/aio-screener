/**
 * Portfolio declaration inputs (E3/E4).
 *
 * A currency, a cash return, a risk-free rate, the measured exposure path and the
 * strategy rebalance policy are *inputs*, not defaults. The risk/performance
 * surfaces may only use them when the user declared them, and a blank declaration
 * must stay blank — never inferred from ticker, live quote or locale (11 §23,
 * R628). The keys live in one place so the writer (classic-shell form) and the
 * reader (runtime-readers) cannot drift apart: P1187 showed what happens when only
 * one end of a declaration exists (R632).
 */

export const PORTFOLIO_ASSUMPTION_KEYS = Object.freeze({
  baseCurrency: 'aio_portfolio_base_currency',
  cashCurrency: 'aio_portfolio_cash_currency',
  cashReturn: 'aio_portfolio_cash_return',
  riskFreeRate: 'aio_portfolio_rf',
  exposurePath: 'aio_portfolio_risk_path',
  rebalancePolicy: 'aio_portfolio_rebalance_policy'
});

export const EXPOSURE_PATHS = Object.freeze(['current_composition_retrospective', 'fixed_target_weight_strategy']);
export const REBALANCE_POLICIES = Object.freeze(['daily', 'monthly', 'quarterly', 'buy-and-hold']);

export function normalizeCurrencyCode(value) {
  const text = String(value == null ? '' : value).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(text) ? text : null;
}

// Rates are typed as annual percent and stored as percent; consumers receive a
// decimal. Blank, non-numeric or out-of-range stays null — never 0, so a
// withheld input can never masquerade as an observed 0% assumption.
export function normalizeAnnualRate(value) {
  if (value == null || String(value).trim() === '') return null;
  const percent = Number(value);
  if (!Number.isFinite(percent) || percent < -100 || percent > 100) return null;
  return percent / 100;
}

// P1198: 열거형도 다른 선언과 같은 규칙을 따른다 — 미선언(빈 값)과 인식할 수 없는 값은 **null**이고
// 기본값을 지어내지 않는다. 예전에는 둘 다 기본값('daily'·'retrospective')이 되어, 정책을 한 번도
// 선언하지 않은 사용자에게 'daily'가 선언으로 게시됐고 정책 오타는 조용히 daily 리밸런싱이 됐다.
// 인식 불가 여부는 caller가 말할 수 있도록 readPortfolioAssumptions가 `unrecognized`로 발행한다.
export function normalizeExposurePath(value) {
  const text = String(value == null ? '' : value).trim();
  return EXPOSURE_PATHS.includes(text) ? text : null;
}

export function normalizeRebalancePolicy(value) {
  const text = String(value == null ? '' : value).trim();
  return REBALANCE_POLICIES.includes(text) ? text : null;
}

function unrecognizedDeclaration(raw, allowed) {
  const text = String(raw == null ? '' : raw).trim();
  return text !== '' && !allowed.includes(text);
}

export function readPortfolioAssumptions(storage) {
  const get = (key) => {
    try { return storage && typeof storage.getItem === 'function' ? storage.getItem(key) : null; } catch (_) { return null; }
  };
  const rawExposurePath = get(PORTFOLIO_ASSUMPTION_KEYS.exposurePath);
  const rawRebalancePolicy = get(PORTFOLIO_ASSUMPTION_KEYS.rebalancePolicy);
  return Object.freeze({
    baseCurrency: normalizeCurrencyCode(get(PORTFOLIO_ASSUMPTION_KEYS.baseCurrency)),
    cashCurrency: normalizeCurrencyCode(get(PORTFOLIO_ASSUMPTION_KEYS.cashCurrency)),
    cashReturn: normalizeAnnualRate(get(PORTFOLIO_ASSUMPTION_KEYS.cashReturn)),
    riskFreeRate: normalizeAnnualRate(get(PORTFOLIO_ASSUMPTION_KEYS.riskFreeRate)),
    exposurePath: normalizeExposurePath(rawExposurePath),
    rebalancePolicy: normalizeRebalancePolicy(rawRebalancePolicy),
    // 선언은 있었으나 인식할 수 없었던 경우 — 화면·게이트가 "미선언"과 구분해 말할 수 있어야 한다.
    unrecognized: Object.freeze({
      exposurePath: unrecognizedDeclaration(rawExposurePath, EXPOSURE_PATHS),
      rebalancePolicy: unrecognizedDeclaration(rawRebalancePolicy, REBALANCE_POLICIES)
    })
  });
}
