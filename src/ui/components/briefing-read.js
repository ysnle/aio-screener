// P1389: one native owner for the briefing page — 일정 → 오늘의 해석 → 자산별 흐름 → 다음 확인.
// Replaces the six-axis summary, the market strip, the checklist, the legacy analysis block, the
// August research bridge and the news list (news now lives on the news screen).
import { alignInput, buildMarketRead } from '../../domain/briefing/market-read.js';
import { buildBriefingSchedule } from '../../domain/briefing/schedule.js';
import { ensureResearchSnapshots } from './research-snapshots.js';
import { MACRO_HISTORY, refreshSharedArtifact, sharedArtifactIsStale } from '../../data/shared-artifacts.js';
import { briefingFlow } from '../../domain/market/page-flow.js';
import { renderNextSteps } from './page-flow.js';
import { crossroadsForRoot, themeLinkRow } from './macro-crossroads.js';
import { el } from './dom.js';
import { shortDate } from '../../domain/content/date-labels.js';
// v57.60: the market-input reader moved to the data layer (the AI context imported it from this ui file);
// re-exported here so existing importers keep working.
export { collectMarketInputs } from '../../data/selectors/market-inputs.js';
import { collectMarketInputs } from '../../data/selectors/market-inputs.js';

// Only S&P 500 members: the weekly calendar lists hundreds of micro-caps.
function universeNames(root) {
  if (root._aioSp500Names) return root._aioSp500Names;
  const names = {};
  for (const row of Array.isArray(root.SCREENER_DB) ? root.SCREENER_DB : []) {
    if (row?.sym && row?.name && row.index === 'SP500') names[row.sym] = row.name;
  }
  if (Object.keys(names).length) root._aioSp500Names = names;
  return names;
}

// P1399: the observation and its interpretation are shown apart; the interpretation is tagged.
function statementNode(doc, tag, { text, reading }, className) {
  const node = el(doc, tag, null, className);
  node.append(doc.createTextNode(text));
  // P1505: the observation stays on the first line and its reading sits under it in the secondary colour; one
  // '해석' tag on the headline labels the convention instead of a tag on every line.
  if (reading) node.append(el(doc, 'span', `→ ${reading}`, 'briefing-hypothesis is-line'));
  return node;
}

export function renderBriefingRead({ documentRef: doc, root, nowMs = Date.now() }) {
  const page = doc?.getElementById('page-briefing');
  if (!page) return;
  const snapshot = root.DATA_SNAPSHOT || {};
  // T05/P1685: the credit axis needs the 20-session HY change; load it like 시장 상태 does and redraw once it lands.
  if (sharedArtifactIsStale(root, MACRO_HISTORY.key, MACRO_HISTORY)) {
    refreshSharedArtifact(root, MACRO_HISTORY).then(({ changed }) => {
      if (changed && page.classList?.contains('active')) renderBriefingRead({ documentRef: doc, root });
    }).catch(() => {});
  }
  const read = buildMarketRead(collectMarketInputs(root));
  ensureResearchSnapshots({ documentRef: doc, root, host: page, kind: 'briefing', collect: () => ({
    kind: 'briefing', sessionDate: read.asOf, publishedAt: root._serverDataMeta?.generatedAt || null,
    version: root.AIO?.version || null, headline: read.headline || (read.available ? '두드러진 교차 신호 없음' : null),
    interpretation: read.headlineReading, facts: read.facts || [],
    checks: read.checks || [], source: 'AIO 종가 기록 · 정규화된 신용·금리 관측', sourceRevision: root._serverDataMeta?.cycleId || null
  }) });

  // 1. Schedule
  // P1408: one request at a time; a failed or empty response clears the flag so a later render can
  // retry (after a minute), and a late response re-renders only while the briefing is the open page.
  const lastTry = Number(root._aioBriefingEarningsRequestedAt) || 0;
  if (!root._aioEarningsSnapshot && typeof root._fetchEarningsCalendarSnapshot === 'function' && !root._aioBriefingEarningsRequested && nowMs - lastTry >= 60000) {
    root._aioBriefingEarningsRequested = true;
    root._aioBriefingEarningsRequestedAt = nowMs;
    Promise.resolve(root._fetchEarningsCalendarSnapshot()).then((snap) => {
      if (snap && !root._aioEarningsSnapshot) root._aioEarningsSnapshot = snap;
    }).catch(() => {}).finally(() => {
      root._aioBriefingEarningsRequested = false;
      if (root._aioEarningsSnapshot && page.classList?.contains('active')) renderBriefingRead({ documentRef: doc, root });
    });
  }
  const schedule = buildBriefingSchedule({
    fomcDecisions: Array.isArray(root.AIO_MACRO_OFFICIAL_SCHEDULES?.['us-fomc']) ? root.AIO_MACRO_OFFICIAL_SCHEDULES['us-fomc'] : [],
    releases: root.AIO_MACRO_CALENDAR?.releases || {},
    snapshot,
    // P1737: one Fed-range answer (producer -> FRED -> manual within its window; null once the manual value expired).
    policyRange: typeof root.AIO?.getFedPolicyRange === 'function' ? root.AIO.getFedPolicyRange()?.range || null : root.AIO_EVENT_FRESHNESS_REGISTRY?.fomc?.policyRange || null,
    earnings: root._aioEarningsSnapshot?.earnings || [],
    earningsMeta: root._aioEarningsSnapshot || {},
    names: universeNames(root),
    nowMs
  });
  const scheduleRows = doc.getElementById('briefing-schedule-rows');
  if (scheduleRows) {
    scheduleRows.replaceChildren(...(schedule.length ? schedule.map((row) => {
      const item = el(doc, 'div', null, `briefing-event${row.today ? ' is-today' : ''}${row.passed ? ' is-passed' : ''}`);
      item.dataset.kind = row.kind;
      item.dataset.eventId = row.id;
      if (row.sourceTitle) item.title = row.sourceTitle;
      const when = el(doc, 'span', row.status === 'received' ? `${row.when} · 발표됨` : row.status === 'time-passed' ? `${row.when} · 예정 시각 지남` : row.when, 'briefing-event-when');
      const body = el(doc, 'div', null, 'briefing-event-body');
      body.append(el(doc, 'span', row.label, 'briefing-event-label'));
      const meta = [row.why, row.comparisonBasis, row.last].filter(Boolean).join(' · ');
      if (meta) body.append(el(doc, 'span', meta, 'briefing-event-meta'));
      item.append(when, body);
      return item;
    }) : [el(doc, 'div', '7일 안에 예정된 주요 일정이 없습니다.', 'briefing-empty')]));
  }

  // 2. Read
  const basis = doc.getElementById('briefing-read-basis');
  if (basis) basis.textContent = read.available ? `${shortDate(read.asOf)} 미국 종가 기준 · 자동 해석` : '';
  const headline = doc.getElementById('briefing-read-headline');
  if (headline) headline.textContent = read.available ? (read.headline || '두드러진 교차 신호가 없는 평이한 장세입니다.') : '종가 기록을 불러오는 중입니다.';
  const headlineReading = doc.getElementById('briefing-read-reading');
  if (headlineReading) headlineReading.replaceChildren(...(read.headlineReading ? [el(doc, 'span', '해석', 'briefing-hypothesis-tag'), doc.createTextNode(` ${read.headlineReading}`)] : []));
  const points = doc.getElementById('briefing-read-points');
  if (points) points.replaceChildren(...(read.points || []).map((row) => statementNode(doc, 'li', row)));

  // 3. Drivers
  const drivers = doc.getElementById('briefing-driver-rows');
  renderMoveChart(doc, drivers, read.moves || []);
  const observedOn = Object.fromEntries((read.facts || []).map((fact) => {
    const alignment = fact.observedAt ? alignInput(fact.observedAt, read.asOf) : null;
    return [fact.label, alignment && alignment.status !== 'aligned' ? shortDate(alignment.date) : null];
  }));
  if (drivers) {
    drivers.replaceChildren(...(read.drivers || []).filter((row) => row.values.length).map((row) => {
      const box = el(doc, 'div', null, 'briefing-driver');
      box.dataset.axis = row.id;
      box.append(el(doc, 'div', row.title, 'briefing-driver-title'));
      const values = el(doc, 'div', null, 'briefing-driver-values');
      for (const [label, value] of row.values) {
        const pair = el(doc, 'span', null, 'briefing-driver-value');
        const ownDay = observedOn[label];
        pair.append(el(doc, 'span', label, 'briefing-driver-key'), doc.createTextNode(` ${value}${ownDay ? ` · ${ownDay} 기준` : ''}`));
        values.append(pair);
      }
      box.append(values);
      if (row.context) box.append(el(doc, 'div', row.context, 'briefing-driver-context'));
      for (const statement of row.reads || []) box.append(statementNode(doc, 'p', statement, 'briefing-driver-read'));
      return box;
    }));
  }

  // 4. Next checks — dated events first, then what the tape itself asks to confirm.
  const checks = doc.getElementById('briefing-check-list');
  if (checks) {
    // P1599 (H06): dated releases live in the schedule right below (with their 'why'); repeating them here read
    // the same CPI line twice. Checks are what the tape itself asks to confirm, plus one pointer to the next release.
    const nextRelease = schedule.find((row) => !row.passed && row.kind === 'macro');
    const items = [...(read.checks || [])];
    // Audit 2026-10-14: the next release is named with what each of the two leading branches needs from it, so the
    // check is a threshold to compare against, not only a date.
    let split = null;
    let xr = null;
    try {
      xr = crossroadsForRoot(root, { nowMs });
      const event = xr?.nextEvent;
      const sides = event ? (xr.items || []).filter((item) => item.id === xr.leadId || item.id === xr.altId)
        .map((item) => { const trigger = item.triggers.find((row) => row.id === event.id); return trigger ? `'${item.title.split(' — ')[0]}' 쪽이면 ${trigger.text}` : null; }).filter(Boolean) : [];
      if (event && sides.length) { const [, m, d] = String(event.date || '').split('-').map(Number); split = `다음 분기점: ${m && d ? `${m}/${d} ` : ''}${event.name} — ${sides.join(', ')}`; }
    } catch (_) { split = null; }
    if (split) items.push(split);
    else if (nextRelease) items.push(`다음 주요 발표: ${nextRelease.when} ${nextRelease.label} (아래 일정에서 무엇을 볼지 확인)`);
    checks.replaceChildren(...(items.length ? items.map((text) => el(doc, 'li', text)) : [el(doc, 'li', '특별히 확인할 변곡 신호가 없습니다.')]));
    // v57.54 audit (13): the two paths the next release splits link to the themes each one favours.
    doc.getElementById('briefing-xr-themes')?.remove();
    const rows = split && xr ? (xr.items || []).filter((item) => item.id === xr.leadId || item.id === xr.altId).map((item) => themeLinkRow(doc, root, item)).filter(Boolean) : [];
    if (rows.length) {
      const box = el(doc, 'div', null, 'briefing-xr-themes');
      box.id = 'briefing-xr-themes';
      box.append(...rows);
      checks.insertAdjacentElement('afterend', box);
    }
  }
  // I21: the checks and asset groups continue to the screens that explain them (#briefing-next, hidden while empty).
  renderNextSteps(doc, doc.getElementById('briefing-next'), briefingFlow({ read }).next);
  page.dataset.aioBriefingRenderer = 'native-read';
  if (typeof root._aioRenderMarketAnalysisSinks === 'function') {
    try { root._aioRenderMarketAnalysisSinks(); } catch (_) {}
  }
}

// P1599 (F101): 1-day and 5-day moves as bars from a zero line, so which asset moved most is visible before
// reading the numbers. Percent rows share one scale; basis-point rows get their own block and scale.
function renderMoveChart(doc, anchor, moves) {
  const host = anchor?.parentElement;
  if (!host) return;
  host.querySelector('.briefing-move-chart')?.remove();
  if (!moves.length) return;
  const wrap = el(doc, 'div', null, 'briefing-move-chart');
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', `자산별 1일·5일 등락: ${moves.map((row) => `${row.label} 1일 ${fmtMove(row.d1, row.unit)}, 5일 ${fmtMove(row.d5, row.unit)}`).join('; ')}`);
  for (const unit of ['%', 'bp']) {
    const rows = moves.filter((row) => row.unit === unit);
    if (!rows.length) continue;
    const max = Math.max(...rows.flatMap((row) => [Math.abs(row.d1 || 0), Math.abs(row.d5 || 0)]), unit === '%' ? 0.5 : 2);
    const block = el(doc, 'div', null, 'briefing-move-block');
    block.append(el(doc, 'div', unit === '%' ? '가격 등락(%) — 막대 = 1일(진하게) · 5일(옅게), 0 기준 양쪽 · 달러·환율은 오르내림에 좋고 나쁨이 없어 회색' : '금리 변화(bp) — 다른 단위라 따로 표시', 'briefing-move-head'));
    for (const row of rows) {
      const line = el(doc, 'div', null, 'briefing-move-row');
      line.append(el(doc, 'span', row.label, 'briefing-move-label'));
      const track = el(doc, 'span', null, 'briefing-move-track');
      for (const [key, cls] of [['d5', 'is-5d'], ['d1', 'is-1d']]) {
        const value = row[key];
        if (!Number.isFinite(value)) continue;
        const bar = el(doc, 'span', null, `briefing-move-bar ${cls} ${row.unit === 'bp' || row.neutral ? 'is-rate' : value >= 0 ? 'is-up' : 'is-down'}`);
        const width = Math.abs(value) / max * 50;
        bar.style.width = `${Math.max(0.6, width).toFixed(1)}%`;
        bar.style.left = value >= 0 ? '50%' : `${(50 - width).toFixed(1)}%`;
        track.append(bar);
      }
      line.append(track, el(doc, 'span', `${fmtMove(row.d1, row.unit)} · ${fmtMove(row.d5, row.unit)}`, 'briefing-move-value'));
      block.append(line);
    }
    wrap.append(block);
  }
  host.insertBefore(wrap, anchor);
}

function fmtMove(value, unit) {
  if (!Number.isFinite(value)) return '—';
  const digits = unit === 'bp' ? 0 : 1;
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}${unit}`;
}
