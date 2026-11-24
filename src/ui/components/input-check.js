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
  return markFields([input], result, input?.closest?.('label') || input);
}

// A min~max pair is one answer: both fields carry aria-invalid and point to one note placed after the box holding them.
export function markRange(minInput, maxInput, result) {
  return markFields([minInput, maxInput], result, maxInput?.parentElement || maxInput);
}

function markFields(inputs, result, anchor) {
  const fields = inputs.filter(Boolean);
  if (!fields.length) return result;
  const doc = fields[0].ownerDocument;
  const id = `${fields[0].id || 'num'}-error`;
  let note = doc?.getElementById?.(id) || null;
  if (result.ok) {
    for (const input of fields) {
      input.removeAttribute('aria-invalid');
      if (input.getAttribute('aria-describedby') === id) input.removeAttribute('aria-describedby');
    }
    if (note) note.remove();
    return result;
  }
  if (!note && doc) {
    note = doc.createElement('span');
    note.id = id;
    note.className = 'input-check-error';
    note.setAttribute('role', 'alert');
    anchor.insertAdjacentElement('afterend', note);
  }
  for (const input of fields) {
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', id);
  }
  if (note && note.textContent !== result.reason) note.textContent = result.reason;
  return result;
}

// v59.70 (ui-states): a submit button says what its form is doing — 'busy' disables it and sets aria-busy, 'done' and
// 'fail' write one line into the form's status node (role=status) and re-enable it, 'idle' clears both. The status node
// is the button's data-status target, or one created right after the button.
export function setSubmitState(button, state, message = '') {
  if (!button) return null;
  const doc = button.ownerDocument;
  let status = button.dataset.status ? doc?.getElementById(button.dataset.status) : null;
  if (!status && doc && state !== 'idle') {
    status = doc.createElement('span');
    status.id = `${button.id || 'submit'}-status`;
    status.className = 'aio-submit-status';
    status.setAttribute('role', 'status');
    button.insertAdjacentElement('afterend', status);
    button.dataset.status = status.id;
  }
  const busy = state === 'busy';
  button.disabled = busy;
  if (busy) button.setAttribute('aria-busy', 'true');
  else button.removeAttribute('aria-busy');
  if (status) {
    status.classList.toggle('is-done', state === 'done');
    status.classList.toggle('is-fail', state === 'fail');
    status.textContent = state === 'idle' ? '' : message;
  }
  return status;
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
// The first refused field takes focus and keeps the typed text; nothing is saved.
// `snapshot` holds the values read at the moment of submit (snapshotHoldingInputs), so a field edited while this module
// loads is not read in place of what was submitted.
export const HOLDING_FIELDS = Object.freeze(['pf-add-ticker', 'pf-add-qty', 'pf-add-cost']);
export function snapshotHoldingInputs(doc) {
  return Object.fromEntries(HOLDING_FIELDS.map((id) => { const input = doc?.getElementById(id); return [id, { value: input?.value ?? '', badInput: !!input?.validity?.badInput }]; }));
}
// Every refusal of a form goes one way: the field is marked with its reason and takes focus; the typed text stays.
// A field inside a closed fold (the holding form's 선택 입력: 통화, 목표가) cannot take focus, so its folds open first.
export function refuseField(input, result) {
  markField(input, result);
  for (let node = input?.parentElement; node; node = node.parentElement) if (String(node.tagName).toUpperCase() === 'DETAILS' && !node.open) node.open = true;
  input?.focus?.();
  return result;
}
// The 보유 종목 추가 refusals the legacy form raises after the numbers pass (window._aioRefuseField names them by key).
export const HOLDING_REFUSALS = Object.freeze({
  ticker: '종목 목록에 없는 심볼입니다 — 거래소 심볼(예: AAPL, 005930)이나 회사 이름으로 입력하세요.',
  currency: '3자리 통화 코드(예: USD, KRW)로 입력하거나 비워 두세요.',
  target: '목표가는 0보다 큰 숫자로 입력하거나 비워 두세요.'
});
export function readHoldingInputs(doc, snapshot = snapshotHoldingInputs(doc)) {
  const refuse = refuseField;
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
