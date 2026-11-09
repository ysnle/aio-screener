// The 원화 · 달러 현금 boxes (v59.92). Two writers share each box: the reader typing and the portfolio render painting the
// stored balance. Which one owns a box is said on the box itself, in data-cash-entry, and only the save path writes it:
//   'saving'  — set by the shell's change handler before any wait (src/app/compatibility-globals.js), so a render that
//               lands while this module loads cannot refill the box;
//   'refused' — the typed text and its note stay until that box is saved again;
//   absent    — the render paints the stored amount (a focused box is typing not yet saved and is left alone too).
// The handler lives in the shell because the boxes take input before the lazy portfolio page loads, and it writes the
// checked amount through the shell's cash bridge (src/data/portfolio-cash.js). This module is lazy: the page imports
// it, the handler loads it on first save.
import { checkNumericField, NUMERIC_LIMITS } from '../components/input-check.js';

const LABELS = Object.freeze({ KRW: '원화 현금', USD: '달러 현금' });

// The render's only way into a box.
export function paintCashBox(input, amount) {
  if (!input || input.dataset?.cashEntry || input.ownerDocument?.activeElement === input) return false;
  input.value = amount == null ? '' : String(amount);
  return true;
}

// typed: { value, badInput } as the box held them when the save was asked for (P2106). Settles the box's owner and
// returns the number reader's result ({ ok, empty, value } or { ok: false, reason }).
export function checkCashEntry(input, typed) {
  const currency = input?.dataset?.currency;
  // -100 and 1e309 emptied the field to $0 without a word, and twenty digits were kept (v58.80).
  const read = checkNumericField(input, { label: LABELS[currency] || `${currency} 현금`, min: 0, max: NUMERIC_LIMITS.cash[currency] ?? NUMERIC_LIMITS.amount, ...typed });
  if (read.ok) delete input.dataset.cashEntry;
  else input.dataset.cashEntry = 'refused';
  return read;
}
