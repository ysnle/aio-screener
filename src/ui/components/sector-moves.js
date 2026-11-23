import { selectProducedRotation } from '../../domain/themes/produced-rotation.js';
import { SECTOR_ETF_LABELS, sectorRecentCheck, leaderFading } from '../../domain/market/regime/scenario-outlook.js';
import { rrgSettledQuadrant } from '../../domain/themes/recent-check.js';
import { RRG_BORDER_WORD, RRG_QUADRANT_WORDS } from '../../domain/themes/rrg.js';
import { el } from './dom.js';
import { signedText, directionOf } from '../../domain/shared/number.js';

const md = (date) => { const [, m, d] = String(date || '').split('-').map(Number); return m && d ? `${m}/${d}` : String(date || ''); };
const QUADRANT = { ...RRG_QUADRANT_WORDS, Border: RRG_BORDER_WORD }; // the RRG chart's short words; the long border label ran past the card's text edge
const quadrantLabel = (key) => QUADRANT[key] || null;

export function sectorMoves(artifact, nowMs = Date.now()) {
  const rows = Object.entries(SECTOR_ETF_LABELS).map(([symbol, label]) => {
    const row = selectProducedRotation(artifact, symbol, nowMs);
    const daily = typeof row?.dailyPct === 'number' && Number.isFinite(row.dailyPct) ? row.dailyPct : null;
    if (daily == null) return null;
    const recent = sectorRecentCheck(row);
    const rel5 = recent?.rel5 ?? null;
    const fading = leaderFading({ quadrant: row.quadrant, ...(recent || {}) });
    return { symbol, label, daily, weekly: Number.isFinite(row.weeklyPct) ? row.weeklyPct : null, rel5, fading,
      // The settled quadrant (the row's own 5-session band + hysteresis from its trail), the one 테마·섹터 shows. A fixed ±1 band
      // on the last point alone read XLB·XLY·XLF 기준선 부근 and XLU 선도 here while 테마·섹터 read 개선.
      quadrant: fading ? `상대강도 5일 ${rel5.toFixed(1)}%` : quadrantLabel(rrgSettledQuadrant(row) ?? row.quadrant), session: row.sessionDate };
  }).filter(Boolean).sort((a, b) => b.daily - a.daily);
  return { rows, session: rows[0]?.session || null, upCount: rows.filter((row) => directionOf(row.daily, 2) === 'up').length };
}

export function sectorMovesLine(model) {
  if (!model || model.rows.length < 6) return '';
  const top = model.rows[0], bottom = model.rows.at(-1);
  return `${md(model.session)} 종가, 미국 섹터 ETF ${model.rows.length}개 중 ${model.upCount}개 상승. 가장 강한 ${top.label} ${signedText(top.daily, 2)}%, 가장 약한 ${bottom.label} ${signedText(bottom.daily, 2)}%.`;
}

// Renders the line into 브리핑's static section (hidden when fewer than six sectors are current); 움직인 이유
// (briefing-read.js renderMoveNews) follows it in the same section.
export function renderSectorMoves({ documentRef: doc, root, host = null, nowMs = Date.now() }) {
  if (!doc || !host) return null;
  const model = sectorMoves(root?._serverDataMeta?.rotationHistory, nowMs);
  let content = host.querySelector(':scope > .sector-moves-content');
  if (!content) { content = el(doc, 'div', null, 'sector-moves-content'); host.prepend(content); }
  const text = sectorMovesLine(model);
  if (!text) { host.hidden = true; content.replaceChildren(); return null; }
  host.setAttribute('data-observed-at', model.session);
  const title = el(doc, 'h2', '섹터와 움직인 이유', 'briefing-h2');
  title.id = 'briefing-sector-moves-title';
  host.setAttribute('aria-labelledby', title.id);
  const line = el(doc, 'p', `${text} `, 'briefing-read-reading');
  const link = el(doc, 'button', '테마와 섹터에서 보기', 'flow-next-link');
  link.type = 'button';
  link.dataset.action = 'showPage';
  link.dataset.arg = 'themes';
  link.dataset.view = 'summary';
  line.append(link);
  content.replaceChildren(title, line);
  host.hidden = false;
  return model;
}
