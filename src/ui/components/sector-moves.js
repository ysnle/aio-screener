// P1641: 오늘 — the eleven US sector ETFs on the last completed session, largest gain to largest loss
// (owner reference: a daily report's sector bar). Read from the produced rotation artifact; a sector
// whose row is not current for that session is left out rather than shown with an old number.
import { selectProducedRotation } from '../../domain/themes/produced-rotation.js';
import { SECTOR_ETF_LABELS } from '../../domain/market/scenario-outlook.js';

const el = (doc, tag, text, className) => { const node = doc.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
const particle = (word) => { const code = word.charCodeAt(word.length - 1) - 0xac00; return code >= 0 && code < 11172 && code % 28 ? '이' : '가'; };
const QUADRANT = { Leading: '선도', Improving: '개선', Weakening: '약화', Lagging: '후행' };

export function sectorMoves(artifact, nowMs = Date.now()) {
  const rows = Object.entries(SECTOR_ETF_LABELS).map(([symbol, label]) => {
    const row = selectProducedRotation(artifact, symbol, nowMs);
    const daily = typeof row?.dailyPct === 'number' && Number.isFinite(row.dailyPct) ? row.dailyPct : null;
    return daily == null ? null : { symbol, label, daily, weekly: Number.isFinite(row.weeklyPct) ? row.weeklyPct : null, quadrant: QUADRANT[row.quadrant] || null, session: row.sessionDate };
  }).filter(Boolean).sort((a, b) => b.daily - a.daily);
  return { rows, session: rows[0]?.session || null };
}

export function renderSectorMoves({ documentRef: doc, root, anchor, nowMs = Date.now() }) {
  if (!doc || !anchor) return null;
  doc.getElementById('home-sector-moves')?.remove();
  const model = sectorMoves(root?._serverDataMeta?.rotationHistory, nowMs);
  if (model.rows.length < 6) return null;
  const section = el(doc, 'section', null, 'home-sector-moves');
  section.id = 'home-sector-moves';
  section.setAttribute('data-observed-at', model.session); // P1643: the basis card dates each bar.
  const head = el(doc, 'div', null, 'home-sector-head');
  head.append(el(doc, 'h3', '섹터 등락', 'briefing-h2'), el(doc, 'span', `${model.session} 종가 · 미국 섹터 ETF ${model.rows.length === 11 ? '11개' : `${model.rows.length}/11개 확인`}`, 'briefing-h2-note'));
  const top = model.rows[0], bottom = model.rows.at(-1);
  const lead = el(doc, 'p', `${top.label}(${top.daily >= 0 ? '+' : ''}${top.daily.toFixed(2)}%)${particle(top.label)} 가장 강했고 ${bottom.label}(${bottom.daily >= 0 ? '+' : ''}${bottom.daily.toFixed(2)}%)${particle(bottom.label)} 가장 약했습니다. ${model.rows.filter((row) => row.daily > 0).length}개 섹터가 올랐습니다.`, 'home-sector-lead');
  const max = Math.max(0.5, ...model.rows.map((row) => Math.abs(row.daily)));
  const list = el(doc, 'ul', null, 'home-sector-bars');
  for (const row of model.rows) {
    const li = el(doc, 'li', null, row.daily >= 0 ? 'is-up' : 'is-down');
    li.tabIndex = 0; // U01: the basis card opens from the keyboard too
    li.title = `${row.label} (${row.symbol}) · 1일 ${row.daily.toFixed(2)}%${row.weekly == null ? '' : ` · 1주 ${row.weekly.toFixed(2)}%`}${row.quadrant ? ` · 회전 ${row.quadrant}` : ''} · 섹터 ETF 일봉 종가로 계산`;
    const bar = el(doc, 'span', null, 'home-sector-bar');
    const fill = el(doc, 'span');
    fill.style.width = `${(Math.abs(row.daily) / max * 50).toFixed(1)}%`;
    fill.style.left = row.daily >= 0 ? '50%' : `${(50 - Math.abs(row.daily) / max * 50).toFixed(1)}%`;
    bar.append(fill);
    li.append(el(doc, 'span', row.label, 'home-sector-name'), bar, el(doc, 'span', `${row.daily >= 0 ? '+' : ''}${row.daily.toFixed(2)}%`, 'home-sector-value'), el(doc, 'span', row.quadrant || '', 'home-sector-quadrant'));
    list.append(li);
  }
  section.append(head, lead, list, el(doc, 'p', '오른쪽 표시는 S&P 500 대비 상대강도 회전(선도·개선·약화·후행)입니다. 하루 등락은 잡음이 크므로 회전 위치와 함께 봅니다.', 'theme-strength-basis'));
  anchor.insertAdjacentElement('afterend', section);
  return model;
}
