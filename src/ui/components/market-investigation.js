// The market investigation on the face (src/data/server-investigation.js admits it). 오늘 owns it: the verdict first, then
// the model's few short paragraphs; the leads it followed and the documents behind each cause sit in one fold as raw
// evidence. 시장 상태 carries the verdict line and a link to 오늘. Shown only for the close the screen shows; otherwise the
// host is emptied and hidden (an empty place, no stand-in text). Text goes in as text.
import { serverInvestigation } from '../../data/server-investigation.js';

const md = (iso) => { const [, m, d] = String(iso || '').split('-').map(Number); return m && d ? `${m}/${d}` : ''; };
const KIND_LABEL = Object.freeze({ price: '가격 자료', official: '공식 발표', news: '보도', inference: '추론' });

function el(doc, tag, className, textContent) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (textContent != null) node.textContent = textContent;
  return node;
}

function head(doc, investigation) {
  const row = el(doc, 'p', 'screen-reading__head');
  row.append(el(doc, 'span', 'screen-reading__tag', 'AI 조사'), el(doc, 'span', 'screen-reading__basis', `${md(investigation.session.us)} 종가 기준${investigation.retained ? ' · 직전 검증본' : ''}`));
  return row;
}

function evidenceFold(doc, investigation) {
  const fold = el(doc, 'details', 'aio-note-fold investigation__evidence');
  fold.append(el(doc, 'summary', null, '조사한 단서와 출처'));
  const list = el(doc, 'ul', 'aio-note-fold__text investigation__list');
  for (const lead of investigation.leads) list.append(el(doc, 'li', null, `단서: ${lead}`));
  for (const cause of investigation.causes) {
    const item = el(doc, 'li', null, `${KIND_LABEL[cause.kind]}${cause.outlet ? ` · ${cause.outlet}` : ''}${cause.date ? ` ${md(cause.date)}` : ''}: ${cause.claim}`);
    if (cause.url) {
      const link = el(doc, 'a', null, ' 원문');
      link.href = cause.url;
      link.rel = 'noopener noreferrer';
      link.target = '_blank';
      item.append(link);
    }
    list.append(item);
  }
  for (const unknown of investigation.unknowns) list.append(el(doc, 'li', null, `확인하지 못함: ${unknown}`));
  fold.append(list);
  return fold;
}

/**
 * Paints `#home-investigation` (mode 'full') or `#signal-investigation` (mode 'line') for the close `basis`.
 * Returns whether something is shown.
 */
export function renderMarketInvestigation({ documentRef: doc, root, basis = null, mode = 'full' } = {}) {
  const host = doc?.getElementById?.(mode === 'line' ? 'signal-investigation' : 'home-investigation');
  if (!host) return false;
  const investigation = basis ? serverInvestigation(root, { basis }) : null;
  if (!investigation || (mode === 'line' && investigation.status !== 'verified')) {
    host.replaceChildren();
    host.hidden = true;
    return false;
  }
  if (investigation.status === 'quiet') {
    host.replaceChildren(head(doc, investigation), el(doc, 'p', 'screen-reading__text', `${md(investigation.session.us)} 미국 종가에서는 평소 변동 범위를 벗어난 움직임이나 바뀐 판정이 없어 따로 조사하지 않았습니다.`));
  } else if (mode === 'line') {
    const more = el(doc, 'button', 'flow-next-link investigation__more', '왜 그런지 → 오늘');
    more.type = 'button';
    more.dataset.action = 'showPage';
    more.dataset.arg = 'home';
    host.replaceChildren(head(doc, investigation), el(doc, 'p', 'screen-reading__text investigation__verdict', investigation.verdict), more);
  } else {
    host.replaceChildren(head(doc, investigation), el(doc, 'p', 'screen-reading__text investigation__verdict', investigation.verdict),
      ...investigation.paragraphs.map((text) => el(doc, 'p', 'screen-reading__text investigation__paragraph', text)), evidenceFold(doc, investigation));
  }
  host.hidden = false;
  return true;
}
