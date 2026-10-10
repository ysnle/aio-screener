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

// P1399: the observation and its interpretation are shown apart; the interpretation is tagged.
function statementNode(doc, tag, { text, reading }, className) {
  const node = el(doc, tag, null, className);
  node.append(doc.createTextNode(text));
  // P1505: the observation stays on the first line and its reading sits under it in the secondary colour; one
  // '해석' tag on the headline labels the convention instead of a tag on every line.
  if (reading) node.append(el(doc, 'span', `→ ${reading}`, 'briefing-hypothesis is-line'));
  return node;
}

function shortDate(date) {
  const [, month, day] = String(date || '').split('-').map(Number);
  return month && day ? `${month}/${day}` : '';
}

// P1392: one input reader for the briefing read and the 시장 상태 regime board, so the two
// screens judge the same closes, credit and rate changes.
// P1399: every value travels with its observation date; the domain aligns them to one basis.
export function collectMarketInputs(root) {
  const snapshot = root.DATA_SNAPSHOT || {};
  const fieldTs = snapshot._fieldTs || {};
  let fgMetric = null;
  try { fgMetric = root.AIO?.getCanonicalMetric?.('fg') || null; } catch (_) {}
  const fg = finite(fgMetric?.value);
  const putCall = root._lastPutCallPayload || null;
  const credit = {
    hyBp: finite(root._hySpreadBp) ?? finite(snapshot.hySpread),
    hyAsOf: root._hySpreadDate || fieldTs.hySpread || null,
    pcr: finite(putCall?.totalPutCall) ?? finite(snapshot.pcr),
    pcrAsOf: putCall?.asOf || fieldTs.pcr || null,
    fg: fg != null ? fg : finite(snapshot.fearGreedValue),
    fgAsOf: fg != null ? fgMetric?.asOf || null : fieldTs.fg || null,
    hyDelta5Bp: finite(snapshot._hySpreadDelta5Bp),
    aaiiAsOf: fieldTs.aaii || null
  };
  // P1390: FRED one-week changes (producer-published); a missing series keeps its rule silent.
  const rates = Object.fromEntries(['realYield10', 'realYield10Delta5', 'breakeven10Delta5', 'dgs2Delta5', 'dgs10Delta5']
    .map((key) => [key, finite(key.endsWith('Delta5') ? snapshot[`_${key}`] : snapshot[key])]));
  rates.asOf = fieldTs.macro_realYield10 || fieldTs.macro_dgs10 || null;
  // Codex review 2026-10-05: nominal ≈ real + breakeven holds only on one date; TIPS (10/1) and breakeven
  // (10/2) from different days are not split against each other.
  rates.realAsOf = fieldTs.macro_realYield10 || null;
  rates.breakevenAsOf = fieldTs.macro_breakeven10 || null;
  return { history: root._aioHistory || [], credit, rates };
}

export function renderBriefingRead({ documentRef: doc, root, nowMs = Date.now() }) {
  const page = doc?.getElementById('page-briefing');
  if (!page) return;
  const snapshot = root.DATA_SNAPSHOT || {};
  const read = buildMarketRead(collectMarketInputs(root));

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
      const when = el(doc, 'span', row.status === 'received' ? `${row.when} · 발표됨` : row.status === 'time-passed' ? `${row.when} · 예정 시각 지남` : row.when, 'briefing-event-when');
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
  const headlineReading = doc.getElementById('briefing-read-reading');
  if (headlineReading) headlineReading.replaceChildren(...(read.headlineReading ? [el(doc, 'span', '해석', 'briefing-hypothesis-tag'), doc.createTextNode(` ${read.headlineReading}`)] : []));
  const points = doc.getElementById('briefing-read-points');
  if (points) points.replaceChildren(...(read.points || []).map((row) => statementNode(doc, 'li', row)));

  // 3. Drivers
  const drivers = doc.getElementById('briefing-driver-rows');
  renderMoveChart(doc, drivers, read.moves || []);
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
    if (nextRelease) items.push(`다음 주요 발표: ${nextRelease.when} ${nextRelease.label} (아래 일정에서 무엇을 볼지 확인)`);
    checks.replaceChildren(...(items.length ? items.map((text) => el(doc, 'li', text)) : [el(doc, 'li', '특별히 확인할 변곡 신호가 없습니다.')]));
  }
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
