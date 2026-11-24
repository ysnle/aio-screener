// The one renderer of src/domain/scenarios/decision-frame.js for every scenario-like card — the
// 매크로 branch cards and the story cards on 시장 상태, the theme cards on 테마. Face: 가능성 and 이익·손실 폭 (two lines),
// then the favoured side and its reason, 기회비용 and 틀렸을 때; one raw-table fold: the sample note, the ground kind and the
// method. Loads with the screens that draw these cards, never at boot. The wording lives in the domain (decisionFrameText), shared with the AI.
import { el } from './dom.js';
import { kindFold, rawTable } from './indicator-face.js';
import { decisionFrameText } from '../../domain/scenarios/decision-frame.js';

// A frame none of whose legs has a source is not drawn; the card says why in its own line and keeps its favoured side.
const SOURCED_LEGS = Object.freeze(['likelihood', 'payoff', 'opportunity', 'wrong']);
export const frameHasNoLegs = (frame) => SOURCED_LEGS.every((leg) => frame?.missing?.includes(leg));

/** The favoured side and its reason (ground kind on hover), for cards that print it after their own choice table. */
export function favouredLine(doc, frame) {
  const text = decisionFrameText(frame);
  if (!text?.tag) return null;
  const line = el(doc, 'p', null, 'xr-reading df-side');
  line.append(el(doc, 'b', text.tag), doc.createTextNode(text.reason ? ` — ${text.reason}` : ''));
  line.title = text.ground;
  return line;
}

/**
 * @param {Document} doc
 * @param {object} frame buildDecisionFrame() result
 * @param {object} [options]
 * @param {string} [options.method] the full past-frequency sentence (sample span, definition) for the fold
 * @param {boolean} [options.side] print the favoured side (false where the card prints it already)
 */
export function decisionFrameBlock(doc, frame, { method = '', side = true } = {}) {
  const text = decisionFrameText(frame);
  if (!text || frameHasNoLegs(frame)) return null;
  const box = el(doc, 'div', null, 'df-frame');
  box.dataset.ground = frame.favoured.ground;
  for (const line of text.face) box.append(el(doc, 'p', line, 'df-line'));
  const sideLine = side ? favouredLine(doc, frame) : null;
  if (sideLine) box.append(sideLine);
  if (text.conflict) box.append(el(doc, 'p', text.conflict, 'df-line is-conflict'));
  const legs = el(doc, 'dl', null, 'df-legs');
  legs.append(el(doc, 'dt', '기회비용'), el(doc, 'dd', text.opportunity.join(' · ')), el(doc, 'dt', '틀렸을 때'), el(doc, 'dd', text.wrong.join(' · ')));
  if (text.tradeoff) legs.append(el(doc, 'dt', '맞바꾸는 것'), el(doc, 'dd', text.tradeoff));
  box.append(legs, kindFold(doc, 'raw-table', '표본과 근거 종류', rawTable(doc, [['표본', text.sample], ['근거 종류', text.ground || '선택지 비교 없음'], ['표본과 방법', method]])));
  return box;
}
