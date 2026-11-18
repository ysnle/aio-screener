// The 무위험(RF) 연수익률 box's one-click fill. A route-only panel (src/ui/pages/portfolio.js paints it), kept out of
// the boot set that portfolio-declarations.js belongs to.
import { readNumber } from '../../domain/shared/number.js';
import { stampDay } from '../../domain/shared/session-date.js';

const element = (documentRef, id) => (documentRef && typeof documentRef.getElementById === 'function' ? documentRef.getElementById(id) : null);

/**
 * The risk-free box offers the short rate the app already publishes (SOFR, the macro reading's cash rate:
 * data/selectors/interpretation.js marketInterpretation().crossroads.cash = { value: percent, date }). One click writes
 * it into the box as the reader's own entry through the same save path; nothing is applied without that click.
 */
export function riskFreeFill(cash) {
  const value = readNumber(cash?.value);
  const date = stampDay(cash?.date);
  if (value == null || !date) return null;
  const md = `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
  return { value: value.toFixed(2), date, label: `SOFR ${value.toFixed(2)}%(${md}) 넣기` };
}

export function paintRiskFreeFill({ documentRef, cash, save } = {}) {
  const button = element(documentRef, 'pf-rf-fill');
  if (!button) return null;
  const fill = riskFreeFill(cash);
  button.hidden = !fill;
  if (!fill) return null;
  button.textContent = fill.label;
  button.title = `${fill.date} SOFR(미국 담보 익일물 금리)를 무위험 수익률 칸에 넣습니다`;
  button.dataset.rate = fill.value;
  if (!button.dataset.bound) {
    button.dataset.bound = '1';
    button.addEventListener('click', () => {
      const input = element(documentRef, 'pf-rf-input');
      if (!input || !button.dataset.rate) return;
      input.value = button.dataset.rate;
      if (typeof save === 'function') save('pf-rf-input', input.value);
    });
  }
  return fill;
}
