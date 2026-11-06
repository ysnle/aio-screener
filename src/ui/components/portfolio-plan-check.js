// v59.70 (S16/L6): 점검 › 내 계획 점검 — moved from js/aio-ui.js calculateRR (v58.75 owner 2026-10-24: the app proposes no
// price or size; it states the risk width, the reward-to-risk multiple when a target is given, the loss at the stop and its
// share of capital). The rules are unchanged: a refused input hides the previous result (P2071), values above 1e12 are
// refused. The position select that fills the entry price stays with js/aio-core.js (_aioRRFillFromPosition).
export function planCheckLines({ entry, stop, target = null, amount = null, total = null } = {}) {
  const ok = (value) => (Number.isFinite(value) && value > 0 ? value : null);
  [entry, stop, target, amount, total] = [entry, stop, target, amount, total].map(ok);
  if (entry == null || stop == null || stop >= entry) return { refused: '가정 진입가와 그보다 낮은 손절 가격을 넣으세요' };
  if (target != null && target <= entry) return { refused: '목표 가격은 진입가보다 높게 넣거나 비워 두세요' };
  if ([entry, stop, target, amount, total].some((value) => value != null && value > 1e12)) return { refused: '1조보다 큰 값은 계산하지 않습니다. 단위를 확인해 주세요' };
  const fmt = (value, digits = 2) => Number(value).toLocaleString('en-US', { maximumFractionDigits: digits });
  const riskPct = (entry - stop) / entry * 100;
  const lines = [`위험 폭: 진입가에서 손절 가격까지 -${riskPct.toFixed(1)}% (${fmt(entry - stop)})`];
  if (target != null) lines.push(`보상 폭: 목표 가격까지 +${((target - entry) / entry * 100).toFixed(1)}%, 위험 1 대비 보상 ${((target - entry) / (entry - stop)).toFixed(2)}배`);
  else lines.push('목표 가격을 넣지 않아 위험 대비 보상 배수는 계산하지 않았습니다.');
  if (amount != null) {
    const loss = amount * (entry - stop) / entry;
    lines.push(`손절 가격에 닿으면 손실액: ${fmt(loss, 0)}${total != null ? ` (전체 자본의 ${(loss / total * 100).toFixed(1)}%)` : ''}`);
    if (total != null) lines.push(`투입 금액은 전체 자본의 ${(amount / total * 100).toFixed(1)}%입니다.`);
  } else lines.push('투입 금액을 넣으면 손절 시 손실액을 계산합니다.');
  return { lines };
}

/** Binds the 점검 button; returns the disposer. */
export function installPlanCheck({ documentRef: doc, root = globalThis }) {
  const button = doc?.querySelector?.('#page-portfolio [data-plan-check]');
  if (!button) return () => {};
  const num = (id) => { const value = parseFloat(doc.getElementById(id)?.value); return Number.isFinite(value) ? value : null; };
  const run = () => {
    const result = planCheckLines({ entry: num('rr-entry'), stop: num('rr-stop'), target: num('rr-target'), amount: num('rr-capital'), total: num('rr-total') });
    const box = doc.getElementById('rr-result');
    if (result.refused) {
      if (box) box.hidden = true;
      if (typeof root.showToast === 'function') root.showToast(result.refused);
      return;
    }
    const list = doc.getElementById('rr-lines');
    if (list) list.replaceChildren(...result.lines.map((text) => { const li = doc.createElement('li'); li.textContent = text; return li; }));
    if (box) box.hidden = false;
  };
  button.addEventListener('click', run);
  return () => button.removeEventListener('click', run);
}
