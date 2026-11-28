// The rebound tracker (domain/market/story/rebound-track.js) as one block: the head (the low, which session after it,
// the state word), one row per session with each index's move since the low's close, then the confirm and fail
// conditions. 시장 상태 owns it (under the session lines); 기술적 분석's 시장 지수 tab paints the same block.
import { el } from './dom.js';
import { say } from '../../domain/shared/claim.js';
import { shortDate } from '../../domain/content/date-labels.js';
import { directionOf } from '../../domain/shared/number.js';
import { REBOUND_TRACK_WORDS as W } from '../../domain/market/story/rebound-track.js';

/** The block for `track`, or null without one. */
export function reboundTrackBlock(doc, track) {
  if (!track?.rows?.length) return null;
  const box = el(doc, 'div', null, 'rebound-track');
  box.dataset.part = 'track';
  box.dataset.state = track.state;
  const head = el(doc, 'p', null, 'rebound-track__head');
  const word = el(doc, 'span', track.word, 'rebound-track__state');
  word.dataset.state = track.state;
  head.append(el(doc, 'b', W.title), doc.createTextNode(` — ${track.head.text} `), word);
  const table = el(doc, 'table', null, 'rebound-track__table');
  table.append(el(doc, 'caption', say('{d} 종가 대비 등락', { d: shortDate(track.low.date) }).text, 'rebound-track__caption'));
  const top = el(doc, 'tr');
  top.append(el(doc, 'th', '세션'), ...track.columns.map((column) => el(doc, 'th', column.label)));
  const thead = el(doc, 'thead');
  thead.append(top);
  const body = el(doc, 'tbody');
  for (const row of track.rows) {
    const tr = el(doc, 'tr');
    tr.dataset.date = row.date;
    const day = el(doc, 'th', say('{d} · {k}일째', { d: shortDate(row.date), k: String(row.day) }).text);
    day.setAttribute('scope', 'row');
    tr.append(day, ...row.cells.map((cell) => {
      const td = el(doc, 'td', cell.said.text);
      td.dataset.index = cell.id;
      const way = cell.value == null ? 'missing' : directionOf(cell.value, 1);
      if (way === 'up' || way === 'down' || way === 'missing') td.className = `is-${way}`;
      return td;
    }));
    body.append(tr);
  }
  table.append(thead, body);
  const scroll = el(doc, 'div', null, 'rebound-track__scroll');
  scroll.append(table);
  const conds = el(doc, 'ul', null, 'rebound-track__conds');
  for (const [id, cond] of [['confirm', track.confirm], ['fail', track.fail]]) {
    if (!cond?.said?.text) continue;
    const item = el(doc, 'li', null, 'rebound-track__cond');
    item.dataset.cond = id;
    item.dataset.met = String(cond.met);
    const mark = cond.met ? ` (${id === 'confirm' ? W.met : W.broke})` : '';
    item.append(el(doc, 'b', `${W[id]}${mark}`), doc.createTextNode(` ${cond.said.text}`));
    conds.append(item);
  }
  // The last retest of the S&P 500 low against its VIX spike, a dated fact under the conditions.
  if (track.retest?.said?.text) {
    const item = el(doc, 'li', null, 'rebound-track__cond');
    item.dataset.cond = 'retest';
    item.dataset.state = track.retest.state;
    item.append(el(doc, 'b', W.retest), doc.createTextNode(` ${track.retest.said.text}`));
    conds.append(item);
  }
  box.append(head, scroll, conds);
  return box;
}
