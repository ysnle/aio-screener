// The one renderer of src/domain/scenarios/decision-frame.js for every scenario-like card — the
// 매크로 branch cards and the story cards on 시장 상태, the theme cards on 테마. Face: 가능성 and 이익·손실 폭 (two lines),
// then the favoured side and its reason; one fold: 기회비용, 틀렸을 때, the sample note and the ground kind — the reading is
// the face, its grounds are the fold. Loads with the screens that draw these cards, never at boot. The wording lives in the domain (decisionFrameText), shared with the AI.
import { el } from './dom.js';
import { decisionFrameText } from '../../domain/scenarios/decision-frame.js';

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
  if (!text) return null;
  const box = el(doc, 'div', null, 'df-frame');
  box.dataset.ground = frame.favoured.ground;
  for (const line of text.face) box.append(el(doc, 'p', line, 'df-line'));
  const sideLine = side ? favouredLine(doc, frame) : null;
  if (sideLine) box.append(sideLine);
  if (text.conflict) box.append(el(doc, 'p', text.conflict, 'df-line is-conflict'));
  const fold = el(doc, 'details', null, 'sx-disclosure df-more');
  fold.append(el(doc, 'summary', '기회비용 · 틀렸을 때 · 표본'));
  const list = el(doc, 'dl', null, 'df-legs');
  list.append(el(doc, 'dt', '기회비용'), el(doc, 'dd', text.opportunity.join(' · ')), el(doc, 'dt', '틀렸을 때'), el(doc, 'dd', text.wrong.join(' · ')));
  if (text.tradeoff) list.append(el(doc, 'dt', '맞바꾸는 것'), el(doc, 'dd', text.tradeoff));
  if (text.sample) list.append(el(doc, 'dt', '표본'), el(doc, 'dd', text.sample));
  list.append(el(doc, 'dt', '근거 종류'), el(doc, 'dd', text.ground || '선택지 비교 없음'));
  if (method) list.append(el(doc, 'dt', '표본과 방법'), el(doc, 'dd', method));
  fold.append(list);
  box.append(fold);
  return box;
}
