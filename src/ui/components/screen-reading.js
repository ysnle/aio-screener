// The screen's AI reading (owner 2026-11-18, text architecture) — one or two open paragraphs right under its first verdict, with a small
// "AI 읽기" tag and the close it was written on. Shown only when the producer verified it and its basis is the close the
// screen shows now; otherwise the host is emptied and hidden (an empty place, no stand-in text). Text goes in as text.
import { serverScreenReading } from '../../data/server-screen-readings.js';
import { marketInterpretation } from '../../data/selectors/interpretation.js';

const md = (iso) => { const [, m, d] = String(iso || '').split('-').map(Number); return m && d ? `${m}/${d}` : ''; };

/** Paints `#<screen>-screen-reading`. `shownBasis` defaults to the close the shared interpretation is on (the 시장 상태,
 * 시장 폭 and 매크로 verdicts all read that regime's asOf). `basisLabel` names what the date is when it is not a close
 * (뉴스: the 08:00 cut). Returns whether a reading is shown. */
export function renderScreenReading({ documentRef: doc, root, screen, shownBasis = undefined, basisLabel = '종가 기준' } = {}) {
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
  when.textContent = `${md(reading.basis)} ${basisLabel}`;
  head.append(tag, when);
  const blocks = (reading.blocks || [reading.text]).map((text) => {
    const body = doc.createElement('p');
    body.className = 'screen-reading__text';
    body.textContent = text;
    return body;
  });
  host.replaceChildren(head, ...blocks);
  host.hidden = false;
  return true;
}
