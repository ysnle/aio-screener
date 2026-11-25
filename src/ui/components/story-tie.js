// A screen's tie to the market story, right above its AI reading. It leads with the screen's own sentence — what this
// screen's reading says beside what the latest session did (domain/market/story/screen-tie.js) — and under it, smaller,
// the opening's lines that screen reads (screen-story.js SCREEN_STORY): the session its figures belong to, where the move
// gathered, what the bond market prices. Those lines are the ones 오늘 and 시장 상태 open with, painted by the same
// painters, so no screen tells a different day.
import { SCREEN_STORY } from '../../domain/market/story/screen-story.js';
import { screenTieOf } from '../../domain/market/story/screen-tie.js';
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

/**
 * Paints `#<screen>-story` (made on first use, before `#<screen>-screen-reading`). Returns whether any line is shown.
 * `context`: what only the page holds — `playbook` (테마와 섹터, 한국), `readings` (the index cards 기술적 분석 draws), `extra`
 * (lines of the screen's own, { id, label, said }, painted right after its sentence: 한국's US-to-KOSPI link).
 */
export function renderStoryTie({ documentRef: doc, root, screen, context = {} }) {
  const ids = SCREEN_STORY[screen] || [];
  const anchor = doc?.getElementById?.(`${screen}-screen-reading`);
  if (!anchor) return false;
  let host = doc.getElementById(`${screen}-story`);
  if (!host) {
    host = el(doc, 'section', null, 'story-tie');
    host.id = `${screen}-story`;
    host.setAttribute('aria-label', '시장 이야기');
    anchor.insertAdjacentElement('beforebegin', host);
  }
  let interpretation = null;
  try { interpretation = marketInterpretation(root); } catch (_) { interpretation = null; }
  const opening = readMarketOpening(root, interpretation, () => renderStoryTie({ documentRef: doc, root, screen, context }));
  const { own, cross } = tieLines(opening?.available ? opening.lines : [], ids);
  const inputs = interpretation?.inputs || {};
  const tie = screenTieOf(screen, { opening, regime: interpretation?.regime || null, history: inputs.history || root?._aioHistory || [],
    macroHistory: inputs.macroHistory || root?._aioMacroHistory || null, playbook: context.playbook || null, readings: context.readings || null });
  host.replaceChildren(...(tie ? [openingLine(doc, { id: 'tie', label: '', said: tie.said })] : []), ...(context.extra || []).map((line) => openingLine(doc, line)), ...own.map((line) => openingLine(doc, line)), ...crossBlock(doc, cross));
  host.hidden = !host.childElementCount;
  return !host.hidden;
}
