/**
 * Declared-input panels for the portfolio surface: the account ledger (E4/P1191) and the
 * declared FX legs (E3/P1194).
 *
 * The classic shell keeps what only it can own — the Vault storage path, the delegate entry
 * points, and the acknowledgement ordering (memory write, durable ack, repaint). The markup
 * and the wording of every acknowledgement live here, because that was the fastest-growing
 * part of a ratcheted file (P1191 +201, P1194 +65) and the two lists must not drift apart.
 */

function escapeMarkup(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function element(documentRef, id) {
  if (!documentRef || typeof documentRef.getElementById !== 'function') return null;
  return documentRef.getElementById(id);
}

export function readDeclaredFields(documentRef, ids) {
  const values = {};
  for (const id of Array.isArray(ids) ? ids : []) {
    const input = element(documentRef, id);
    values[id] = input ? input.value : '';
  }
  return values;
}

export function clearDeclaredFields(documentRef, ids) {
  for (const id of Array.isArray(ids) ? ids : []) {
    const input = element(documentRef, id);
    if (input) input.value = '';
  }
}

export function coverageMarkup(coverageState) {
  const inputs = coverageState && Array.isArray(coverageState.inputs) ? coverageState.inputs : [];
  return '<div class="pfp-decl-head">원장 포함 범위 선언</div>' +
    '<div class="pfp-decl-options">' + inputs.map((entry) => (
      '<label class="pfp-decl-option">' +
      '<input type="checkbox" aria-label="원장 포함 범위 ' + escapeMarkup(entry.label) + '" data-on-change="_aioSetLedgerCoverage" data-field="' + escapeMarkup(entry.id) + '"' +
      (entry.declared ? ' checked' : '') + '>' + escapeMarkup(entry.label) + '</label>'
    )).join('') + '</div>';
}

// Row classes: src/ui/styles/portfolio-page.css; the delete buttons take .aio-btn-table's 12px (index.html).
export function ledgerListMarkup(ledger) {
  if (!ledger || (!ledger.transactions.length && !ledger.valuations.length)) return '입출금 기록 없음';
  const row = (label, date, amount, action) => '<div class="pfp-decl-row">' +
    '<span class="pfp-figure">' + escapeMarkup(date) + '</span>' +
    '<span>' + label + '</span>' +
    '<span class="pfp-figure">' + escapeMarkup(String(amount)) + '</span>' +
    '<button class="aio-btn-table" data-action="_aioRemoveLedgerEntry" data-arg="' + action + '" aria-label="원장 항목 삭제">삭제</button></div>';
  return ledger.transactions.map((tx, index) => row(tx.kind === 'withdrawal' ? '출금' : '입금', tx.date, tx.amount, `transaction:${index}`))
    .concat(ledger.valuations.map((mark, index) => row('평가액', mark.date, mark.amount, `valuation:${index}`)))
    .join('');
}

export function fxLegListMarkup(legsState, { maxAgeMs = null } = {}) {
  const legs = legsState && Array.isArray(legsState.legs) ? legsState.legs : [];
  if (!legs.length) return '입력한 환율 없음 — 달러·원화가 섞인 합계는 환율을 입력해야 계산됩니다.'; // v57.55 review (B4-F10): plain words
  const budgetHours = maxAgeMs == null ? null : Math.round(maxAgeMs / 3600000);
  return legs.map((leg, index) => {
    const ageHours = Math.round(leg.ageMs / 3600000 * 10) / 10;
    const unusableReason = leg.usable ? '' : ', 지금은 쓰지 않음(입력한 지 ' + (budgetHours == null ? '오래됐거나' : budgetHours + '시간이 지났거나') + ' 기준 시각 이후 관측)';
    return '<div class="pfp-decl-row' + (leg.usable ? '' : ' is-unusable') + '">' +
      '<span class="pfp-figure">' + escapeMarkup(leg.from + '→' + leg.to) + '</span>' +
      '<span class="pfp-figure">' + escapeMarkup(String(leg.rate)) + '</span>' +
      '<span>' + escapeMarkup(String(leg.observedAt).slice(0, 10)) + ', ' + ageHours + 'h' + unusableReason + '</span>' +
      '<button class="aio-btn-table" data-action="_aioRemoveFxLeg" data-arg="' + index + '" aria-label="환율 기록 삭제">삭제</button></div>';
  }).join('');
}

export function applyLedgerPanel({ documentRef, ledger, coverageState } = {}) {
  const timingEl = element(documentRef, 'pf-ledger-flow-timing');
  const coverageEl = element(documentRef, 'pf-ledger-coverage');
  const listEl = element(documentRef, 'pf-ledger-list');
  if (!timingEl && !coverageEl && !listEl) return false;
  if (timingEl) timingEl.value = ledger ? ledger.flowTiming : 'end-of-period';
  if (coverageEl) coverageEl.innerHTML = coverageMarkup(coverageState);
  if (listEl) listEl.innerHTML = ledgerListMarkup(ledger);
  return true;
}

export function applyFxPanel({ documentRef, legsState, maxAgeMs = null } = {}) {
  const listEl = element(documentRef, 'pf-fx-list');
  if (!listEl) return false;
  listEl.innerHTML = fxLegListMarkup(legsState, { maxAgeMs });
  return true;
}

/**
 * The acknowledgement wording is part of what the user reads, so it is decided here rather
 * than inline: a rejected durable write must never read as success, and an invalid entry
 * must name what was missing instead of reporting a generic failure.
 */
export function declarationStatus({ kind, phase, result, okMessage } = {}) {
  if (result && result.ok === true) {
    return { text: okMessage || '선언을 저장했습니다.', tone: 'var(--text-muted)', ok: true };
  }
  if (phase === 'pending') return { text: '저장 중…', tone: 'var(--text-muted)', ok: null };
  if (phase === 'persist') {
    return { text: '영구 저장 실패 — 변경이 확정되지 않았습니다. 새로고침 시 이전 값으로 되돌아올 수 있습니다.', tone: 'var(--data-amber)', ok: false };
  }
  if (kind === 'fx') {
    return { text: 'FX leg는 통화 2개(3자리 코드)·0보다 큰 환율·관측 시각(YYYY-MM-DD)이 필요합니다.', tone: 'var(--data-amber)', ok: false };
  }
  return {
    text: result && result.reason === 'invalid-ledger-entry'
      ? '원장 항목은 날짜(YYYY-MM-DD)와 0보다 큰 금액이 필요합니다.'
      : '원장 변경을 적용하지 못했습니다: ' + ((result && result.reason) || 'unknown'),
    tone: 'var(--data-amber)',
    ok: false
  };
}

export function showDeclarationStatus({ documentRef, statusId, kind, phase, result, okMessage } = {}) {
  const statusEl = element(documentRef, statusId);
  if (!statusEl) return null;
  const described = declarationStatus({ kind, phase, result, okMessage });
  statusEl.textContent = described.text;
  statusEl.style.color = described.tone;
  return described;
}
