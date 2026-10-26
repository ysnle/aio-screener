// v58.80 (first-users bundle 6): a refused number says so beside its field (aria-invalid + a polite message) and keeps
// the typed text; a valid one clears the message. Pairs with domain/shared/numeric-input.js.
import { readNumericInput, NUMERIC_LIMITS } from '../../domain/shared/numeric-input.js';

export { NUMERIC_LIMITS };

export function checkNumericField(input, spec = {}) {
  if (!input) return { ok: false, reason: '입력 칸이 없습니다.' };
  const result = readNumericInput(input.value, { ...spec, badInput: !!input.validity?.badInput });
  const doc = input.ownerDocument;
  const id = `${input.id || 'num'}-error`;
  let note = doc?.getElementById?.(id) || null;
  if (result.ok) {
    input.removeAttribute('aria-invalid');
    if (note) note.remove();
    return result;
  }
  input.setAttribute('aria-invalid', 'true');
  if (!note && doc) {
    note = doc.createElement('span');
    note.id = id;
    note.className = 'input-check-error';
    note.setAttribute('role', 'alert');
    (input.closest('label') || input).insertAdjacentElement('afterend', note);
    input.setAttribute('aria-describedby', id);
  }
  if (note) note.textContent = result.reason;
  return result;
}

// The 과거 성과 시뮬레이션 form (legacy js/aio-workspace.js runPortfolioBacktestLab reads it through window._aioReadBacktestInputs).
export function readBacktestInputs(doc) {
  const initial = checkNumericField(doc?.getElementById('pf-bt-initial'), { label: '초기 금액', min: 100, max: 1e12 });
  if (!initial.ok) return initial;
  const year = checkNumericField(doc?.getElementById('pf-bt-start-year'), { label: '시작 연도', min: 1985, max: new Date().getFullYear() - 1, integer: true });
  if (!year.ok) return year;
  const benchmark = String(doc?.getElementById('pf-bt-benchmark')?.value || 'SPY').trim().toUpperCase();
  if (benchmark && !/^[A-Z0-9][A-Z0-9.^=-]{0,11}$/.test(benchmark)) return { ok: false, reason: '비교 지수는 티커로 입력하세요(예: SPY, QQQ).' };
  return { ok: true, initial: initial.value || 10000, startYear: year.value || 2017, rebalance: String(doc?.getElementById('pf-bt-rebalance')?.value || 'annual'), benchmark };
}
