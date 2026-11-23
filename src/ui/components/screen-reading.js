import { serverScreenReading } from '../../data/server-screen-readings.js';
import { marketInterpretation } from '../../data/selectors/interpretation.js';

const md = (iso) => { const [, m, d] = String(iso || '').split('-').map(Number); return m && d ? `${m}/${d}` : ''; };

/** Paints `#<screen>-screen-reading`. `shownBasis` defaults to the close the shared interpretation is on (the 시장 상태,
 * 시장 폭 and 매크로 verdicts all read that regime's asOf). Returns whether a reading is shown. */
export function renderScreenReading({ documentRef: doc, root, screen, shownBasis = undefined } = {}) {
  const host = doc?.getElementById?.(`${screen}-screen-reading`);
  if (!host) return false;
  const reading = serverScreenReading(root, screen);
  let basis = shownBasis;
  if (basis === undefined && reading) { try { basis = marketInterpretation(root).regime?.asOf || null; } catch (_) { basis = null; } }
  if (!reading || !basis || reading.basis !== basis) {
    host.replaceChildren();
    host.hidden = true;
    return false;
  }
  const head = doc.createElement('p');
  head.className = 'screen-reading__head';
  const tag = doc.createElement('span');
  tag.className = 'screen-reading__tag';
  tag.textContent = 'AI 읽기';
  const when = doc.createElement('span');
  when.className = 'screen-reading__basis';
  when.textContent = `${md(reading.basis)} 종가 기준`;
  head.append(tag, when);
  const body = doc.createElement('p');
  body.className = 'screen-reading__text';
  body.textContent = reading.text;
  host.replaceChildren(head, body);
  host.hidden = false;
  return true;
}
