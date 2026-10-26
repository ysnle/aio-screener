// v58.80 (first-users bundle 6): a refused number says so beside its field (aria-invalid + a polite message) and keeps
// the typed text; a valid one clears the message. Pairs with domain/shared/numeric-input.js.
import { readNumericInput, NUMERIC_LIMITS } from '../../domain/shared/numeric-input.js';
import { withTopicParticle } from '../../domain/content/korean-particle.js';

export { NUMERIC_LIMITS };

export function checkNumericField(input, spec = {}) {
  if (!input) return { ok: false, reason: '입력 칸이 없습니다.' };
  const read = readNumericInput(spec.value ?? input.value, { ...spec, badInput: spec.badInput ?? !!input.validity?.badInput });
  // A field that must be above zero (a quantity, a price) says so in the same words as the other refusals.
  const result = read.ok && spec.positive && !(read.value > 0) ? { ok: false, reason: `${withTopicParticle(spec.label || '값')} 0보다 커야 합니다.` } : read;
  return markField(input, result);
}

// Marks one field with the result: aria-invalid plus a polite note after it, or clears both.
export function markField(input, result) {
  if (!input) return result;
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

// The 보유 종목 추가 form (legacy js/aio-workspace.js addPortfolioPosition reads it through window._aioReadHoldingInputs).
// v58.80 (first-users F06/F25): the first refused field takes focus and keeps the typed text; nothing is saved.
// `snapshot` holds the values read at the moment of submit (snapshotHoldingInputs), so a field edited while this module
// loads is not read in place of what was submitted.
export const HOLDING_FIELDS = Object.freeze(['pf-add-ticker', 'pf-add-qty', 'pf-add-cost']);
export function snapshotHoldingInputs(doc) {
  return Object.fromEntries(HOLDING_FIELDS.map((id) => { const input = doc?.getElementById(id); return [id, { value: input?.value ?? '', badInput: !!input?.validity?.badInput }]; }));
}
export function readHoldingInputs(doc, snapshot = snapshotHoldingInputs(doc)) {
  const refuse = (input, result) => { markField(input, result); input?.focus?.(); return result; };
  const ticker = doc?.getElementById('pf-add-ticker');
  if (!String(snapshot['pf-add-ticker']?.value || '').trim()) return refuse(ticker, { ok: false, reason: '종목(티커 또는 이름)을 입력하세요.' });
  markField(ticker, { ok: true });
  const qtyInput = doc?.getElementById('pf-add-qty');
  const qty = checkNumericField(qtyInput, { label: '수량', max: 1e9, allowEmpty: false, positive: true, ...snapshot['pf-add-qty'] });
  if (!qty.ok) return refuse(qtyInput, qty);
  const costInput = doc?.getElementById('pf-add-cost');
  const cost = checkNumericField(costInput, { label: '매수 단가', max: 1e9, allowEmpty: false, positive: true, ...snapshot['pf-add-cost'] });
  if (!cost.ok) return refuse(costInput, cost);
  return { ok: true, qty: qty.value, cost: cost.value };
}
