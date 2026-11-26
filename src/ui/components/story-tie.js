// A screen's tie to the market story, right above its AI reading: ONE line answering that screen's own question
// (domain/market/story/screen-story.js SCREEN_FACE — the screen's own sentence from screen-tie.js, or an opening line the
// screen owns). The full reading lives on 오늘 and 시장 상태; a screen with none of its lines today shows the session's
// one-line summary and a link to 오늘, never the paragraph.
import { screenFaceLine } from '../../domain/market/story/screen-story.js';
import { screenTieOf } from '../../domain/market/story/screen-tie.js';
import { marketInterpretation } from '../../data/selectors/interpretation.js';
import { openingLine, readMarketOpening } from './market-story.js';
import { el } from './dom.js';

/**
 * Paints `#<screen>-story` (made on first use, before `#<screen>-screen-reading`). Returns whether any line is shown.
 * `context`: what only the page holds — `playbook` (테마와 섹터, 한국), `readings` (the index cards 기술적 분석 draws), `extra`
 * (lines of the screen's own, { id, label, said }, painted after its line: 한국's US-to-KOSPI link).
 */
export function renderStoryTie({ documentRef: doc, root, screen, context = {} }) {
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
  const inputs = interpretation?.inputs || {};
  const tie = screenTieOf(screen, { opening, regime: interpretation?.regime || null, history: inputs.history || root?._aioHistory || [],
    macroHistory: inputs.macroHistory || root?._aioMacroHistory || null, playbook: context.playbook || null, readings: context.readings || null });
  const face = screenFaceLine(screen, { opening, tie });
  const first = face ? openingLine(doc, face.line) : null;
  if (first && face.summary) {
    const link = el(doc, 'button', '오늘에서 보기', 'flow-next-link');
    link.type = 'button';
    link.dataset.action = 'showPage';
    link.dataset.arg = 'home';
    first.append(doc.createTextNode(' '), link);
  }
  host.replaceChildren(...(first ? [first] : []), ...(context.extra || []).map((line) => openingLine(doc, line)));
  host.hidden = !host.childElementCount;
  return !host.hidden;
}
