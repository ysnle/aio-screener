// The fall bars — falls from a closing high on one scale with the 조정 and 약세장 lines (the model is the domain's
// fallFrame, src/domain/market/story/fall-frame.js). One painter for 오늘 and 시장 상태 (indexes), 기술적 분석 (past
// episodes), 시장 폭 (stocks) and 테마와 섹터 (theme members). Styles: the .fall-bars rules beside the opening's.
import { el } from './dom.js';

const pctOf = (depth, scale) => `${(Math.min(100, Math.max(0, depth / scale * 100))).toFixed(2)}%`;

/**
 * One bar per row on one scale, with the frame's lines. Each row's name, small word and value are text (the list reads
 * as a table to a screen reader); the tracks are decoration. `caption` heads the bars and names the list.
 */
export function fallBars(doc, model, caption) {
  const box = el(doc, 'div', null, 'fall-bars');
  const head = el(doc, 'div', caption, 'fall-bars__caption');
  // Under the bars: the two dashed lines, each its level over its stage word.
  const foot = el(doc, 'div', null, 'fall-bars__foot');
  foot.setAttribute('aria-hidden', 'true');
  const axis = el(doc, 'span', null, 'fall-bars__axis');
  for (const mark of model.marks) {
    const tick = el(doc, 'span', null, 'fall-bars__tick');
    tick.append(el(doc, 'b', `-${mark.at}%`), el(doc, 'span', mark.word));
    tick.style.left = pctOf(mark.at, model.scale);
    axis.append(tick);
  }
  foot.append(el(doc, 'span'), axis);
  const list = el(doc, 'ul', null, 'fall-bars__list');
  list.setAttribute('aria-label', caption);
  for (const bar of model.bars) {
    const row = el(doc, 'li', null, 'fall-bars__row');
    row.dataset.part = bar.part;
    row.dataset.index = bar.id;
    const name = el(doc, 'span', null, 'fall-bars__name');
    name.append(el(doc, 'b', bar.label));
    if (bar.stage) name.append(el(doc, 'span', bar.stage, 'fall-bars__stage'));
    const track = el(doc, 'span', null, 'fall-bars__track');
    const fill = el(doc, 'span', null, 'fall-bars__fill');
    fill.style.width = pctOf(-bar.value, model.scale);
    track.setAttribute('aria-hidden', 'true');
    track.append(fill, ...model.marks.map((mark) => { const line = el(doc, 'span', null, 'fall-bars__mark'); line.style.left = pctOf(mark.at, model.scale); return line; }));
    const value = el(doc, 'span', bar.valueText, 'fall-bars__value');
    value.style.left = pctOf(-bar.value, model.scale);
    track.append(value);
    // The value sits at the bar's end; a copy for assistive technology stays in the row's text.
    value.setAttribute('aria-hidden', 'true');
    row.append(name, track, el(doc, 'span', bar.valueText, 'sr-only'));
    list.append(row);
  }
  box.append(head, list, foot);
  return box;
}
