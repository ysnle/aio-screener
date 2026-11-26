// 포트폴리오: under a held stock's row, the one line that says why it moved — its ledger move on the basis session with
// the report about that move, by the rule the 종목 header uses (move-news.js). No report about the move, no line: a
// move with an unrelated headline beside it reads as a cause it is not. Holdings never leave this call: nothing is
// logged, cached or written.
import { el } from './dom.js';
import { companyMoveRow, moveNewsList } from './move-news.js';

/** The table row for `move` (holding-moves.js) of `symbol`, or null when no report is about it. */
export function holdingCauseRow(doc, root, store, { symbol, move, colSpan }) {
  if (!doc || !symbol || !move) return null;
  const row = companyMoveRow(root, store, { symbol, name: move.label, move: move.change, session: move.date });
  if (!row.headline) return null;
  const list = moveNewsList(doc, root, [row], { listClass: 'pfp-cause-list', timeClass: 'pfp-cause-move', titleClass: 'pfp-cause-title' });
  if (!list) return null;
  const tr = el(doc, 'tr', null, 'pfp-cause');
  tr.dataset.causeFor = symbol;
  const cell = el(doc, 'td');
  cell.colSpan = colSpan;
  cell.append(el(doc, 'span', '움직인 이유', 'pfp-cause-label'), list);
  tr.append(cell);
  return tr;
}
