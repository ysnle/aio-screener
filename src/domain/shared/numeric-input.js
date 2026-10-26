import { withObjectParticle, withSubjectParticle, withTopicParticle } from '../content/korean-particle.js';

// v58.80 (first-users bundle 6): one reader for every typed number (cash, simulation amount and years, plan prices).
// The breaker persona typed -100, 1e309 and 99999999999999999999: cash silently emptied to $0, the simulation ran on
// with a negative amount, and a 20-digit balance was accepted as "$100,000,000,000,000,000,000". Each field now says
// what was wrong and keeps the typed text; nothing is saved from a refused value.

/**
 * @param {string|number} raw  the typed text (commas and spaces allowed)
 * @param {{ label?: string, min?: number, max?: number, integer?: boolean, allowEmpty?: boolean, badInput?: boolean }} spec
 * @returns {{ ok: true, value: number|null, empty: boolean } | { ok: false, reason: string }}
 */
export function readNumericInput(raw, { label = '값', min = -Infinity, max = Infinity, integer = false, allowEmpty = true, badInput = false } = {}) {
  // A number field drops text it cannot read (value ''), and the browser marks it badInput; that is not an empty field.
  if (badInput) return { ok: false, reason: `${withObjectParticle(label)} 숫자로 읽을 수 없습니다. 숫자만 입력하세요.` };
  const text = String(raw ?? '').replace(/[,\s]/g, '');
  if (!text) return allowEmpty ? { ok: true, value: null, empty: true } : { ok: false, reason: `${withObjectParticle(label)} 입력하세요.` };
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(text)) return { ok: false, reason: `${withObjectParticle(label)} 숫자로 읽을 수 없습니다. 숫자만 입력하세요.` };
  const value = Number(text);
  if (!Number.isFinite(value)) return { ok: false, reason: `${withSubjectParticle(label)} 너무 큽니다.` };
  if (integer && !Number.isInteger(value)) return { ok: false, reason: `${withTopicParticle(label)} 정수로 입력하세요.` };
  if (value < min) return { ok: false, reason: min === 0 ? `${withTopicParticle(label)} 0 이상이어야 합니다.` : `${withTopicParticle(label)} ${min.toLocaleString('en-US')} 이상이어야 합니다.` };
  if (value > max) return { ok: false, reason: `${withTopicParticle(label)} ${max.toLocaleString('en-US')} 이하로 입력하세요.` };
  return { ok: true, value, empty: false };
}

// Plausible ceilings: a household or fund balance, not a typo of twenty digits.
export const NUMERIC_LIMITS = Object.freeze({
  cash: Object.freeze({ USD: 1e11, KRW: 1e14 }),
  amount: 1e12
});
