// The eleven US sector ETFs on the last completed session, largest gain to largest loss. Read from the produced
// rotation artifact; a sector whose row is not current for that session is left out rather than shown with an old number.
import { selectProducedRotation } from '../../domain/themes/produced-rotation.js';
import { SECTOR_ETF_LABELS, sectorRecentCheck, leaderFading } from '../../domain/market/regime/scenario-outlook.js';
import { rrgSettledQuadrant } from '../../domain/themes/recent-check.js';
import { RRG_BORDER_WORD, RRG_QUADRANT_WORDS } from '../../domain/themes/rrg.js';
import { el } from './dom.js';
import { signedText, directionOf } from '../../domain/shared/number.js';

// One date format on 오늘 (M/D), and the block is an h2 like its sibling sections.
const md = (date) => { const [, m, d] = String(date || '').split('-').map(Number); return m && d ? `${m}/${d}` : String(date || ''); };
const QUADRANT = { ...RRG_QUADRANT_WORDS, Border: RRG_BORDER_WORD }; // the RRG chart's short words; the long border label ran past the card's text edge
const quadrantLabel = (key) => QUADRANT[key] || null;

export function sectorMoves(artifact, nowMs = Date.now()) {
  const rows = Object.entries(SECTOR_ETF_LABELS).map(([symbol, label]) => {
    const row = selectProducedRotation(artifact, symbol, nowMs);
    const daily = typeof row?.dailyPct === 'number' && Number.isFinite(row.dailyPct) ? row.dailyPct : null;
    // "기술 -2.98% 선도" — RRG trails price by weeks; a 선도 sector whose relative strength fell by
    // more than twice its own typical five-session move (the themes screen's rsRecentCheck) shows that change instead.
    if (daily == null) return null;
    const recent = sectorRecentCheck(row);
    const rel5 = recent?.rel5 ?? null;
    const fading = leaderFading({ quadrant: row.quadrant, ...(recent || {}) });
    return { symbol, label, daily, weekly: Number.isFinite(row.weeklyPct) ? row.weeklyPct : null, rel5, fading,
      // The settled quadrant (the row's own 5-session band + hysteresis from its trail), the one 테마·섹터 shows. A fixed ±1 band
      // on the last point alone read XLB·XLY·XLF 기준선 부근 and XLU 선도 here while 테마·섹터 read 개선.
      quadrant: fading ? `상대강도 5일 ${rel5.toFixed(1)}%` : quadrantLabel(rrgSettledQuadrant(row) ?? row.quadrant), session: row.sessionDate };
  }).filter(Boolean).sort((a, b) => b.daily - a.daily);
  // A sector counts as up only when its printed two-decimal move is above zero (+0.003 reads +0.00%).
  return { rows, session: rows[0]?.session || null, upCount: rows.filter((row) => directionOf(row.daily, 2) === 'up').length };
}

// One owner per fact: the eleven bars on 브리핑 repeated 테마와 섹터 › 요약. 브리핑 carries one
// line — the session, how many sectors rose, the strongest and the weakest with their moves — and a link to that screen.
export function sectorMovesLine(model) {
  if (!model || model.rows.length < 6) return '';
  const top = model.rows[0], bottom = model.rows.at(-1);
  return `${md(model.session)} 종가, 미국 섹터 ETF ${model.rows.length}개 중 ${model.upCount}개 상승. 가장 강한 ${top.label} ${signedText(top.daily, 2)}%, 가장 약한 ${bottom.label} ${signedText(bottom.daily, 2)}%.`;
}

/**
 * One tick per item on a centre zero line, placed by its one-session move on a scale of the largest absolute move, with
 * the weakest and the strongest named under their ticks. `items`: [{ label, value }]; `digits`: the printed precision.
 */
export function moveStrip(doc, items = [], { digits = 1, name = '' } = {}) {
  const rows = items.filter((item) => Number.isFinite(item?.value));
  const strip = el(doc, 'div', null, 'br-strip');
  if (!rows.length) return strip;
  const max = Math.max(...rows.map((item) => Math.abs(item.value)), 10 ** -digits);
  const left = (value) => 50 + (value / max) * 46; // 4% kept at each end so an extreme tick is not cut by the edge
  const said = (item) => `${item.label} ${signedText(item.value, digits)}%`;
  strip.setAttribute('role', 'img');
  strip.setAttribute('aria-label', `${name} 1일 등락: ${rows.map(said).join(', ')}`);
  for (const item of rows) {
    const tick = el(doc, 'span', null, `br-strip__tick is-${directionOf(item.value, digits) || 'flat'}`);
    tick.style.left = `${left(item.value).toFixed(2)}%`;
    tick.title = said(item);
    strip.append(tick);
  }
  const low = rows.reduce((a, b) => (b.value < a.value ? b : a)), high = rows.reduce((a, b) => (b.value > a.value ? b : a));
  for (const [item, side] of low === high ? [[high, 'high']] : [[low, 'low'], [high, 'high']]) {
    // The name starts at its tick and runs toward the middle, so it never leaves the strip at either end.
    const tag = el(doc, 'span', said(item), `br-strip__label is-${side}`);
    const at = left(item.value);
    if (item.value <= 0) tag.style.left = `${at.toFixed(2)}%`; else tag.style.right = `${(100 - at).toFixed(2)}%`;
    strip.append(tag);
  }
  return strip;
}

// One row of 브리핑's 섹터와 자산 (hidden when fewer than six sectors are current): the label, one tick per sector, the
// line and its link; 움직인 이유 (briefing-read.js renderMoveNews) follows in the same host.
export function renderSectorMoves({ documentRef: doc, root, host = null, nowMs = Date.now() }) {
  if (!doc || !host) return null;
  const model = sectorMoves(root?._serverDataMeta?.rotationHistory, nowMs);
  let content = host.querySelector(':scope > .sector-moves-content');
  if (!content) { content = el(doc, 'div', null, 'sector-moves-content'); host.prepend(content); }
  const text = sectorMovesLine(model);
  if (!text) { host.hidden = true; content.replaceChildren(); return null; }
  host.setAttribute('data-observed-at', model.session); // The basis card dates the line.
  content.className = 'sector-moves-content br-row';
  const line = el(doc, 'p', `${text} `, 'br-row__text');
  const link = el(doc, 'button', '테마와 섹터에서 보기', 'flow-next-link');
  link.type = 'button';
  link.dataset.action = 'showPage';
  link.dataset.arg = 'themes';
  link.dataset.view = 'summary';
  line.append(link);
  content.replaceChildren(el(doc, 'span', '섹터', 'br-row__label'), moveStrip(doc, model.rows.map((row) => ({ label: row.label, value: row.daily })), { digits: 2, name: '미국 섹터 ETF' }), line);
  host.hidden = false;
  return model;
}
