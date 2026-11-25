// A screen's tie to the market story: the opening's lines that screen reads (screen-story.js SCREEN_STORY), right above
// its AI reading — the session its figures belong to, where the move gathered, what the bond market prices. The lines are
// the ones 오늘 and 시장 상태 open with, painted by the same painters, so no screen tells a different day.
import { SCREEN_STORY } from '../../domain/market/story/screen-story.js';
import { marketInterpretation } from '../../data/selectors/interpretation.js';
import { crossBlock, openingLine, readMarketOpening } from './market-story.js';
import { el } from './dom.js';

// The 금리 row brings the policy-path row with it.
const CROSS_KEYS = Object.freeze({ rates: ['rates', 'rates-path'] });

/** The opening lines a screen's story ids pick: its own face lines, and the other-market rows by key. */
export function tieLines(lines, ids) {
  return {
    own: lines.filter((line) => ids.includes(line.id)),
    cross: lines.filter((line) => line.id === 'cross' && ids.some((id) => (CROSS_KEYS[id] || [id]).includes(line.key)))
  };
}

/** Paints `#<screen>-story` (made on first use, before `#<screen>-screen-reading`). Returns whether any line is shown. */
export function renderStoryTie({ documentRef: doc, root, screen }) {
  const ids = SCREEN_STORY[screen];
  const anchor = doc?.getElementById?.(`${screen}-screen-reading`);
  if (!ids || !anchor) return false;
  let host = doc.getElementById(`${screen}-story`);
  if (!host) {
    host = el(doc, 'section', null, 'story-tie');
    host.id = `${screen}-story`;
    host.setAttribute('aria-label', '시장 이야기');
    anchor.insertAdjacentElement('beforebegin', host);
  }
  let interpretation = null;
  try { interpretation = marketInterpretation(root); } catch (_) { interpretation = null; }
  const opening = readMarketOpening(root, interpretation, () => renderStoryTie({ documentRef: doc, root, screen }));
  const { own, cross } = tieLines(opening?.available ? opening.lines : [], ids);
  host.replaceChildren(...own.map((line) => openingLine(doc, line)), ...crossBlock(doc, cross));
  host.hidden = !host.childElementCount;
  return !host.hidden;
}
