// v59.56 (handoff item 3): 금리와 환율's analysis block — why the won moved, split into the dollar's share and Korea's share
// (domain/macro/krw-decomposition.js). One picture (three two-sided bars on one scale), a short read, one fold with the
// method and how well the dollar relation fit. It sits at the head of the 달러 · 원화 · 엔화 section, above the charts.
import { buildKrwDecomposition } from '../../domain/macro/krw-decomposition.js';
import { signedBar, signedScale } from './signed-bar.js';
import { el } from './dom.js';
import { signedText } from '../../domain/shared/number.js';

const signed = (value) => signedText(value, 1, '%');

export function renderKrwRead({ documentRef: doc, root }) {
  const grid = doc?.getElementById('rates-fx-grid');
  if (!grid) return null;
  let block = doc.getElementById('rates-krw-read');
  const model = buildKrwDecomposition(root?._aioHistory || []);
  if (!model.available) { block?.remove(); return null; }
  if (!block) {
    block = el(doc, 'article', null, 'fx-krw');
    block.id = 'rates-krw-read';
    grid.before(block);
  }
  const wasOpen = !!block.querySelector('details')?.open;
  const figure = el(doc, 'figure', null, 'fx-krw__viz');
  const rows = [['원/달러 전체', model.krwMove], ['달러 흐름 몫', model.dollarPart], ['달러 밖 요인', model.koreaPart]];
  const max = signedScale(rows.map(([, value]) => value), 1);
  figure.setAttribute('role', 'img');
  figure.setAttribute('aria-label', `원/달러 ${model.sessions}거래일 변화 나누기: ${rows.map(([label, value]) => `${label} ${signed(value)}`).join(', ')}`);
  for (const [label, value] of rows) {
    const row = el(doc, 'div', null, 'fx-krw__row');
    row.append(el(doc, 'span', label, 'fx-krw__label'), signedBar(doc, value, max, { tone: 'flat' }), el(doc, 'span', signed(value), 'fx-krw__val'));
    figure.append(row);
  }
  figure.append(el(doc, 'figcaption', '오른쪽(+)이 원화 약세, 왼쪽(−)이 원화 강세', 'fx-krw__cap'));
  const text = el(doc, 'div', null, 'fx-krw__text');
  text.append(el(doc, 'p', model.lead, 'fx-krw__now'), el(doc, 'p', [model.why, model.stocks].filter(Boolean).join(' '), 'fx-krw__mean'));
  const body = el(doc, 'div', null, 'fx-krw__body');
  body.append(figure, text);
  const fold = el(doc, 'details', null, 'sx-disclosure fx-krw__more');
  fold.open = wasOpen;
  fold.append(el(doc, 'summary', '계산 방법과 신뢰도'), el(doc, 'p', model.method));
  block.replaceChildren(el(doc, 'h3', '원화가 움직인 이유 — 달러 요인과 원화 고유 요인', 'fx-krw__title'), body, fold);
  return block;
}
