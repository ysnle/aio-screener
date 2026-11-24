// The one renderer of src/domain/scenarios/decision-frame.js for every scenario-like card — the
// 매크로 branch cards and the story cards on 시장 상태, the theme cards on 테마. Face: 가능성 (and 이익·손실 폭 where
// payoffOnFace), then the favoured side and its reason, 기회비용 and 틀렸을 때 (conditions as a list, the past cost on its
// own line); one raw-table fold: the sample note, a folded spread, the ground kind and the method. Loads with the screens that draw these cards, never at boot. The wording lives in the domain (decisionFrameText), shared with the AI.
import { el } from './dom.js';
import { kindFold, rawTable } from './indicator-face.js';
import { decisionFrameText } from '../../domain/scenarios/decision-frame.js';

// A frame with no past record is not drawn; the card says why in its own line and keeps its favoured side. Today's cash
// over the window is the same on every card, so it alone does not make a frame (v60.52: the window now comes from the
// scenario when the record has none, so record-less frames carry a cash return).
const RECORD_LEGS = Object.freeze(['likelihood', 'payoff', 'wrong']);
export const frameHasNoLegs = (frame) => RECORD_LEGS.every((leg) => frame?.missing?.includes(leg)) && frame?.opportunity?.pastCashMedian == null;

// The one face/fold split: the payoff spread earns the face only when the record says something its base does not —
// the up-share or the drawdown share is distinct from the ordinary day. Otherwise it is the record behind the verdict.
export const payoffOnFace = (frame) => frame?.likelihood?.distinct === true || frame?.wrong?.cost?.distinct === true;

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
  const spreadOnFace = payoffOnFace(frame);
  box.append(el(doc, 'p', text.likelihood, 'df-line'));
  if (text.payoff && spreadOnFace) box.append(el(doc, 'p', text.payoff, 'df-line'));
  const sideLine = side ? favouredLine(doc, frame) : null;
  if (sideLine) box.append(sideLine);
  if (text.conflict) box.append(el(doc, 'p', text.conflict, 'df-line is-conflict'));
  // (owner 2026-11-20, face never folded) 기회비용, 틀렸을 때 and 맞바꾸는 것 are the reading — on the face; the
  // sample, a spread that adds nothing to its base, the ground kind and the method are the record behind it — one fold.
  const legs = el(doc, 'dl', null, 'df-legs');
  const wrong = el(doc, 'dd');
  if (text.wrong.conditions.length) {
    const list = el(doc, 'ul', null, 'df-conds');
    for (const condition of text.wrong.conditions) list.append(el(doc, 'li', condition));
    wrong.append(el(doc, 'span', '빗나가는 조건', 'df-sub'), list);
  } else wrong.append(el(doc, 'p', text.wrong.conditionsLine, 'df-cost'));
  wrong.append(el(doc, 'p', text.wrong.cost, 'df-cost'));
  legs.append(el(doc, 'dt', '기회비용'), el(doc, 'dd', text.opportunity.join(' · ')), el(doc, 'dt', '틀렸을 때'), wrong);
  if (text.tradeoff) legs.append(el(doc, 'dt', '맞바꾸는 것'), el(doc, 'dd', text.tradeoff));
  const folded = [['표본', text.sample], ...(text.payoff && !spreadOnFace ? [['이익·손실 폭', text.payoff.replace(/^이익·손실 폭: /, '')]] : []),
    ['근거 종류', text.ground || '선택지 비교 없음'], ['표본과 방법', method]];
  box.append(legs, kindFold(doc, 'raw-table', '표본과 근거 종류', rawTable(doc, folded)));
  return box;
}
