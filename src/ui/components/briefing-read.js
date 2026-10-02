// P1389: one native owner for the briefing page — 일정 → 오늘의 해석 → 자산별 흐름 → 다음 확인.
// Replaces the six-axis summary, the market strip, the checklist, the legacy analysis block, the
// August research bridge and the news list (news now lives on the news screen).
import { buildMarketRead } from '../../domain/briefing/market-read.js';
import { buildBriefingSchedule } from '../../domain/briefing/schedule.js';

function el(doc, tag, text, className) {
  const node = doc.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function finite(value) {
  const number = Number(value);
  return value != null && value !== '' && Number.isFinite(number) ? number : null;
}

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

function shortDate(date) {
  const [, month, day] = String(date || '').split('-').map(Number);
  return month && day ? `${month}/${day}` : '';
}

export function renderBriefingRead({ documentRef: doc, root, nowMs = Date.now() }) {
  const page = doc?.getElementById('page-briefing');
  if (!page) return;
  const snapshot = root.DATA_SNAPSHOT || {};
  let fg = null;
  try { fg = finite(root.AIO?.getCanonicalMetric?.('fg')?.value); } catch (_) {}
  const credit = {
    hyBp: finite(root._hySpreadBp) ?? finite(snapshot.hySpread),
    pcr: finite(root._lastPutCallPayload?.totalPutCall) ?? finite(snapshot.pcr),
    fg: fg > 0 ? fg : finite(snapshot.fearGreedValue),
    hyDelta5Bp: finite(snapshot._hySpreadDelta5Bp)
  };
  // P1390: FRED one-week changes (producer-published); a missing series keeps its rule silent.
  const rates = Object.fromEntries(['realYield10', 'realYield10Delta5', 'breakeven10Delta5', 'dgs2Delta5', 'dgs10Delta5']
    .map((key) => [key, finite(key.endsWith('Delta5') ? snapshot[`_${key}`] : snapshot[key])]));
  const read = buildMarketRead({ history: root._aioHistory || [], credit, rates });

  // 1. Schedule
  if (!root._aioEarningsSnapshot && typeof root._fetchEarningsCalendarSnapshot === 'function' && !root._aioBriefingEarningsRequested) {
    root._aioBriefingEarningsRequested = true;
    Promise.resolve(root._fetchEarningsCalendarSnapshot()).then((snap) => {
      if (snap && !root._aioEarningsSnapshot) root._aioEarningsSnapshot = snap;
      renderBriefingRead({ documentRef: doc, root });
    }).catch(() => {});
  }
  const schedule = buildBriefingSchedule({
    releases: root.AIO_MACRO_CALENDAR?.releases || {},
    snapshot,
    policyRange: root.AIO_EVENT_FRESHNESS_REGISTRY?.fomc?.policyRange || null,
    earnings: root._aioEarningsSnapshot?.earnings || [],
    names: universeNames(root),
    nowMs
  });
  const scheduleRows = doc.getElementById('briefing-schedule-rows');
  if (scheduleRows) {
    scheduleRows.replaceChildren(...(schedule.length ? schedule.map((row) => {
      const item = el(doc, 'div', null, `briefing-event${row.today ? ' is-today' : ''}${row.passed ? ' is-passed' : ''}`);
      item.dataset.kind = row.kind;
      const when = el(doc, 'span', row.passed ? `${row.when} · 발표됨` : row.when, 'briefing-event-when');
      const body = el(doc, 'div', null, 'briefing-event-body');
      body.append(el(doc, 'span', row.label, 'briefing-event-label'));
      const meta = [row.why, row.last].filter(Boolean).join(' · ');
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
  const points = doc.getElementById('briefing-read-points');
  if (points) points.replaceChildren(...(read.points || []).map((text) => el(doc, 'li', text)));

  // 3. Drivers
  const drivers = doc.getElementById('briefing-driver-rows');
  if (drivers) {
    drivers.replaceChildren(...(read.drivers || []).filter((row) => row.values.length).map((row) => {
      const box = el(doc, 'div', null, 'briefing-driver');
      box.dataset.axis = row.id;
      box.append(el(doc, 'div', row.title, 'briefing-driver-title'));
      const values = el(doc, 'div', null, 'briefing-driver-values');
      for (const [label, value] of row.values) {
        const pair = el(doc, 'span', null, 'briefing-driver-value');
        pair.append(el(doc, 'span', label, 'briefing-driver-key'), doc.createTextNode(` ${value}`));
        values.append(pair);
      }
      box.append(values);
      if (row.context) box.append(el(doc, 'div', row.context, 'briefing-driver-context'));
      for (const text of row.reads || []) box.append(el(doc, 'p', text, 'briefing-driver-read'));
      return box;
    }));
  }

  // 4. Next checks — dated events first, then what the tape itself asks to confirm.
  const checks = doc.getElementById('briefing-check-list');
  if (checks) {
    const upcoming = schedule.filter((row) => !row.passed && row.kind === 'macro').slice(0, 2).map((row) => `${row.when} ${row.label} — ${row.why}`);
    const items = [...upcoming, ...(read.checks || [])];
    checks.replaceChildren(...(items.length ? items.map((text) => el(doc, 'li', text)) : [el(doc, 'li', '특별히 확인할 변곡 신호가 없습니다.')]));
  }
  page.dataset.aioBriefingRenderer = 'native-read';
  if (typeof root._aioRenderMarketAnalysisSinks === 'function') {
    try { root._aioRenderMarketAnalysisSinks(); } catch (_) {}
  }
}
