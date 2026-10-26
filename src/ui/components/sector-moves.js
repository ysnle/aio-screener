// P1641: 오늘 — the eleven US sector ETFs on the last completed session, largest gain to largest loss
// (owner reference: a daily report's sector bar). Read from the produced rotation artifact; a sector
// whose row is not current for that session is left out rather than shown with an old number.
import { selectProducedRotation } from '../../domain/themes/produced-rotation.js';
import { SECTOR_ETF_LABELS, sectorRecentCheck, leaderFading } from '../../domain/market/scenario-outlook.js';
import { rrgSettledQuadrant } from '../../domain/themes/recent-check.js';
import { el } from './dom.js';
import { signedText, directionOf } from '../../domain/shared/number.js';

const particle = (word) => { const code = word.charCodeAt(word.length - 1) - 0xac00; return code >= 0 && code < 11172 && code % 28 ? '이' : '가'; };
// Audit 2026-10-14: one date format on 오늘 (M/D), and the block is an h2 like its sibling sections.
const md = (date) => { const [, m, d] = String(date || '').split('-').map(Number); return m && d ? `${m}/${d}` : String(date || ''); };
const QUADRANT = { Leading: '선도', Improving: '개선', Weakening: '약화', Lagging: '후행', Border: '기준선 부근' };
const quadrantLabel = (key) => QUADRANT[key] || null;

export function sectorMoves(artifact, nowMs = Date.now()) {
  const rows = Object.entries(SECTOR_ETF_LABELS).map(([symbol, label]) => {
    const row = selectProducedRotation(artifact, symbol, nowMs);
    const daily = typeof row?.dailyPct === 'number' && Number.isFinite(row.dailyPct) ? row.dailyPct : null;
    // v57.81 (audit 2026-10-15): "기술 -2.98% 선도" — RRG trails price by weeks; a 선도 sector whose relative strength fell by
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
  return { rows, session: rows[0]?.session || null };
}

// v58.53 개편 v2 (5a): the bars moved from 오늘 to 브리핑 ("섹터 하루 등락", beside 시간대별 시황). With `host` the block
// renders into that static section (hidden when fewer than six sectors are current); `anchor` keeps the old placement.
export function renderSectorMoves({ documentRef: doc, root, anchor = null, host = null, nowMs = Date.now() }) {
  if (!doc || (!anchor && !host)) return null;
  if (!host) doc.getElementById('home-sector-moves')?.remove();
  const model = sectorMoves(root?._serverDataMeta?.rotationHistory, nowMs);
  if (model.rows.length < 6) { if (host) { host.hidden = true; host.replaceChildren(); } return null; }
  const section = host || el(doc, 'section', null, 'home-sector-moves');
  if (!host) section.id = 'home-sector-moves';
  section.classList.add('sector-moves');
  section.setAttribute('data-observed-at', model.session); // P1643: the basis card dates each bar.
  const head = el(doc, 'div', null, 'home-sector-head sx-card__head');
  const title = el(doc, 'h2', '섹터 하루 등락', 'briefing-h2 sx-card__title');
  title.id = `${section.id || 'home-sector-moves'}-title`;
  if (host) section.setAttribute('aria-labelledby', title.id);
  head.append(title, el(doc, 'span', `${md(model.session)} 종가, 미국 섹터 ETF ${model.rows.length === 11 ? '11개' : `${model.rows.length}/11개 확인`}`, 'briefing-h2-note sx-card__meta'));
  const top = model.rows[0], bottom = model.rows.at(-1);
  const lead = el(doc, 'p', `${top.label}(${signedText(top.daily, 2)}%)${particle(top.label)} 가장 강했고 ${bottom.label}(${signedText(bottom.daily, 2)}%)${particle(bottom.label)} 가장 약했습니다. ${model.rows.filter((row) => row.daily > 0).length}개 섹터가 올랐습니다.`, 'home-sector-lead');
  const max = Math.max(0.5, ...model.rows.map((row) => Math.abs(row.daily)));
  const list = el(doc, 'ul', null, 'home-sector-bars');
  for (const row of model.rows) {
    const li = el(doc, 'li', null, ({ up: 'is-up', down: 'is-down' }[directionOf(row.daily)] || ''));
    li.tabIndex = 0; // U01: the basis card opens from the keyboard too
    li.title = `${row.label} (${row.symbol}), 1일 ${row.daily.toFixed(2)}%${row.weekly == null ? '' : `, 1주 ${row.weekly.toFixed(2)}%`}${row.fading ? ', 회전 선도(약 50일 기준)지만 최근 5거래일 S&P 500보다 약함' : row.quadrant ? `, 회전 ${row.quadrant}(약 50일 기준)` : ''}, 섹터 ETF 일봉 종가로 계산`;
    const bar = el(doc, 'span', null, 'home-sector-bar');
    const fill = el(doc, 'span');
    fill.style.width = `${(Math.abs(row.daily) / max * 50).toFixed(1)}%`;
    fill.style.left = row.daily >= 0 ? '50%' : `${(50 - Math.abs(row.daily) / max * 50).toFixed(1)}%`;
    bar.append(fill);
    li.append(el(doc, 'span', row.label, 'home-sector-name'), bar, el(doc, 'span', `${signedText(row.daily, 2)}%`, 'home-sector-value'), el(doc, 'span', row.quadrant ? (row.fading ? row.quadrant : `50일 ${row.quadrant}`) : '', 'home-sector-quadrant')); // v58.80 (first-users F12): "선도" beside -1.92% read as today's; the cell names its ~50-day window
    list.append(li);
  }
  // The reading rule for the right-hand label folds under the bars (conclusion first, method on request).
  const basis = el(doc, 'details', null, 'sector-moves-basis');
  basis.append(el(doc, 'summary', '오른쪽 표시 읽는 법'), el(doc, 'p', `오른쪽 표시는 S&P 500 대비 상대강도 회전(선도·개선·약화·후행, 약 50일 기준)이며, 기준선(100) 근처는 '기준선 부근'으로 적습니다. 선도 섹터의 최근 5거래일 상대강도가 평소 5일 움직임의 2배 넘게 꺾였으면 회전 위치 대신 5일 상대 변화를 적습니다. 테마 단계는 1개월과 3~6개월 수익률로 따로 판정하므로 같은 섹터가 다르게 불릴 수 있습니다.`, 'theme-strength-basis'));
  section.replaceChildren(head, lead, list, basis);
  section.hidden = false;
  if (!host) anchor.insertAdjacentElement('afterend', section);
  return model;
}
