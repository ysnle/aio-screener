// P1389: one native owner for the briefing page — 일정 → 오늘의 해석 → 자산별 흐름 → 다음 확인.
// Replaces the six-axis summary, the market strip, the checklist, the legacy analysis block, the
// August research bridge and the news list (news now lives on the news screen).
import { releaseZoneBar } from './release-zone-bar.js';
import { releaseZones } from '../../domain/macro/release-zones.js';
import { alignInput } from '../../domain/briefing/market-read.js';
import { buildBriefingSchedule } from '../../domain/briefing/schedule.js';
import { ensureResearchSnapshots } from './research-snapshots.js';
import { refreshSharedArtifact, sharedArtifactIsStale } from '../../data/shared-artifacts.js';
import { briefingFlow } from '../../domain/market/page-flow.js';
import { renderNextSteps } from './page-flow.js';
import { crossroadsForRoot, themeLinkRow } from './macro-crossroads.js';
import { el } from './dom.js';
import { signedFill, signedScale, signedTrack } from './signed-bar.js';
import { asOfChip } from './section-frame.js';
import { moveNewsList, moveNewsRows, symbolNames } from './market-timeline.js';
import { renderSectorMoves } from './sector-moves.js';
import { shortDate } from '../../domain/content/date-labels.js';
// v57.60: the market-input reader moved to the data layer (the AI context imported it from this ui file);
// re-exported here so existing importers keep working.
export { collectMarketInputs } from '../../data/selectors/market-inputs.js';
import { marketInterpretation, screenerRowsForRoot } from '../../data/selectors/interpretation.js';
import { buildEarningsWeek, eventPreviews } from '../../domain/briefing/event-guide.js';
import { historyWaitText } from './data-state.js';
import { MACRO_HISTORY } from '../../data/artifact-registry.js';

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

// v58.75 (persona review): "왜 움직였나" — after the sector bars, the session's named movers (the stocks and themes 오늘
// shows) with the headline that named each the same day, or '같은 날 관련 보도 없음'. No movers, no section.
// v59.51 (content audit): the movers' headlines are a fold under the sector bars (one visual, one section) instead of a
// section of their own — the bars say what moved, the fold says which names moved and what was reported the same day.
export function renderMoveNews(doc, root, store, flow) {
  const sector = doc.getElementById('briefing-sector-moves');
  if (!sector) return;
  const rows = moveNewsRows(root, store, flow);
  let fold = doc.getElementById('briefing-move-news');
  if (!rows.length) { if (fold) fold.hidden = true; return; }
  const matched = rows.filter((row) => row.headline).length;
  if (!fold) {
    fold = el(doc, 'details', null, 'sx-disclosure briefing-move-news');
    fold.id = 'briefing-move-news';
    sector.append(fold);
  }
  let summary = fold.querySelector(':scope > summary');
  if (!summary) { summary = el(doc, 'summary'); fold.append(summary); }
  let body = fold.querySelector(':scope > .briefing-move-news-body');
  if (!body) { body = el(doc, 'div', null, 'briefing-move-news-body'); fold.append(body); }
  summary.replaceChildren(doc.createTextNode(`움직인 이유, 종목·테마 ${rows.length}곳 `));
  // v58.79: date chip; what the list compares is its hover.
  summary.append(asOfChip(doc, `${shortDate(flow.session)} 종가`, '미국 종가, 같은 업종·테마 안에서 갈린 종목과 테마'));
  const lead = el(doc, 'p', matched
    ? `${rows.length}곳 중 ${matched}곳은 같은 날 이름이 나온 보도나 채널 글이 있습니다. 보도는 같은 날 나왔다는 사실이며 원인을 확정하지는 않습니다.`
    : `${rows.length}곳 모두 같은 날 이름이 나온 보도를 찾지 못했습니다.`, 'briefing-read-reading');
  // The matched rows first, then the movers without a same-day headline.
  body.replaceChildren(lead, ...[moveNewsList(doc, root, rows), moveNewsList(doc, root, rows.filter((row) => !row.headline), { showMissing: true, missingText: matched ? '같은 날 관련 보도 없음' : '' })].filter(Boolean));
  fold.hidden = false;
}

// v59.55 (visual review): 다음 확인 포인트's picture — the next 7 Korean days as columns, each naming its official releases
// (FOMC, CPI, jobs…) and how many of the listed reports fall on it. The same schedule rows as the folded 7-day list below;
// the strip only places them in time. Today is marked; a passed time is dimmed.
export function weekStripDays(schedule = [], nowMs = Date.now(), days = 7) {
  const kstDay = (ms) => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);
  const start = Date.parse(`${kstDay(nowMs)}T00:00:00Z`);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start + index * 86400000).toISOString().slice(0, 10);
    const rows = schedule.filter((row) => Number.isFinite(row?.atMs) && kstDay(row.atMs) === date);
    return {
      date,
      today: index === 0,
      weekday: new Date(`${date}T00:00:00Z`).getUTCDay(),
      events: rows.filter((row) => row.kind !== 'earnings').map((row) => ({ label: row.label, major: !!row.major || row.kind === 'macro', passed: !!row.passed })),
      earnings: rows.filter((row) => row.kind === 'earnings').length
    };
  });
}

function renderWeekStrip(doc, schedule, nowMs) {
  const anchor = doc.getElementById('briefing-check-list');
  if (!anchor) return;
  let strip = doc.getElementById('briefing-week');
  if (!strip) {
    strip = el(doc, 'ol', null, 'briefing-week');
    strip.id = 'briefing-week';
    strip.setAttribute('aria-label', '앞으로 7일 공식 일정, 한국 시간');
    anchor.insertAdjacentElement('afterend', strip);
  }
  // v59.56 (screen review): a Saturday or Sunday with no release and no report was a blank '—' column; it is left out.
  const days = weekStripDays(schedule, nowMs).filter((day) => !((day.weekday === 0 || day.weekday === 6) && !day.today && !day.events.length && !day.earnings));
  strip.hidden = !days.some((day) => day.events.length || day.earnings);
  strip.replaceChildren(...days.map((day) => {
    const li = el(doc, 'li', null, `briefing-week-day${day.today ? ' is-today' : ''}${day.weekday === 0 || day.weekday === 6 ? ' is-weekend' : ''}`);
    li.append(el(doc, 'span', `${kstMd(day.date)} ${WEEKDAY[day.weekday]}${day.today ? ', 오늘' : ''}`, 'briefing-week-date'));
    for (const event of day.events) li.append(el(doc, 'span', event.label, `briefing-week-event${event.major ? ' is-major' : ''}${event.passed ? ' is-passed' : ''}`));
    // The schedule keeps each date's heaviest S&P 500 reports (perDay), so this counts those, not every report.
    if (day.earnings) li.append(Object.assign(el(doc, 'span', `주요 실적 ${day.earnings}곳`, 'briefing-week-earnings'), { title: 'S&P 500 비중이 큰 실적 발표만 셉니다. 전체 건수는 아래 날짜별 실적 목록에 있습니다.' }));
    if (!day.events.length && !day.earnings) li.append(el(doc, 'span', '일정 없음', 'briefing-week-none'));
    return li;
  }));
}

const kstMd = (iso) => { const [, m, d] = String(iso || '').split('-').map(Number); return m && d ? `${m}/${d}` : ''; };
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
function mySymbols(root, store) {
  let watched = [];
  try { watched = typeof root?._aioWatchlistGet === 'function' ? root._aioWatchlistGet() || [] : []; } catch (_) { watched = []; }
  const holdings = store?.getState?.()?.portfolio?.holdings;
  const norm = (list) => new Set(list.map((symbol) => String(symbol || '').trim().toUpperCase()).filter(Boolean));
  return { watched: norm(Array.isArray(watched) ? watched : []), held: norm(Array.isArray(holdings) ? holdings.map((row) => row?.symbol || row?.sym) : []) };
}

// v58.75 (persona review): the collected earnings week (1,000+ reports) was visible only in the 재무 공시 developer grid.
// The 7-day schedule now says how many reports the week holds and opens a native list — per US date and session, largest
// market value first, consensus EPS and revenue, watched and held names marked. The legacy grid stays as it is.
function renderEarningsWeek(doc, root, store, snapshot) {
  const section = doc.getElementById('briefing-schedule');
  if (!section) return;
  let box = doc.getElementById('briefing-earnings-week');
  const earnings = Array.isArray(snapshot?.earnings) ? snapshot.earnings : [];
  if (!earnings.length) { if (box) box.hidden = true; return; }
  const { watched, held } = mySymbols(root, store);
  const week = buildEarningsWeek({ earnings, weekStart: snapshot.weekStart, weekEnd: snapshot.weekEnd, rows: screenerRowsForRoot(root, store),
    names: symbolNames(root), watched, held });
  if (!week.total) { if (box) box.hidden = true; return; }
  if (!box) {
    box = el(doc, 'div', null, 'briefing-earnings-week');
    box.id = 'briefing-earnings-week';
    section.insertAdjacentElement('afterend', box); // v59.55: beside the schedule fold, not a fold inside it
  }
  const wasOpen = !!box.querySelector('details')?.open;
  const range = week.weekStart && week.weekEnd ? `${kstMd(week.weekStart)}~${kstMd(week.weekEnd)} ` : '';
  const lead = el(doc, 'p', `${range ? range : '이번 주 '}실적 발표 ${week.total.toLocaleString('en-US')}건, 그중 S&P 500 ${week.sp500}건${watched.size || held.size ? `, 관심·보유 ${week.mine.length}건` : ''}`, 'briefing-earnings-lead');
  const fold = el(doc, 'details', null, 'sx-disclosure briefing-earnings-fold');
  fold.open = wasOpen;
  fold.append(el(doc, 'summary', '날짜별 실적 발표, 큰 기업 순'));
  for (const day of week.days) {
    const weekday = WEEKDAY[new Date(`${day.date}T12:00:00Z`).getUTCDay()];
    // v59.55 (flow 7): a day is a label inside the one fold, not one of eight page headings.
    fold.append(el(doc, 'p', `${kstMd(day.date)}(${weekday}) 미국, ${day.count}건`, 'briefing-earnings-day'));
    for (const session of day.sessions) {
      const group = el(doc, 'div', null, 'briefing-earnings-session');
      group.append(el(doc, 'div', `${session.label} ${session.count}건${session.hidden > 0 ? `, 큰 순 ${session.rows.length}건 표시` : ''}`, 'briefing-earnings-session-head'));
      const ul = el(doc, 'ul', null, 'briefing-earnings-list');
      for (const row of session.rows) {
        const li = el(doc, 'li', null, `briefing-earnings-row${row.watched || row.held ? ' is-mine' : ''}`);
        li.append(el(doc, 'b', row.symbol, 'briefing-earnings-sym'));
        const facts = [row.name, row.eps != null ? `EPS 예상 ${row.eps.toFixed(2)}` : null, row.revenue ? `매출 예상 ${row.revenue}` : null, row.reported ? '발표 완료' : null].filter(Boolean).join(', ');
        li.append(el(doc, 'span', facts, 'briefing-earnings-facts'));
        if (row.held || row.watched) li.append(el(doc, 'span', row.held ? '보유' : '관심', 'briefing-earnings-tag'));
        ul.append(li);
      }
      group.append(ul);
      fold.append(group);
    }
  }
  fold.append(el(doc, 'p', '예상치는 수집한 실적 일정 자료의 컨센서스이며, 발표 시각은 회사가 알린 장 전·장 마감 후 구분만 있습니다.', 'briefing-event-meta'));
  if (snapshot.source) fold.title = `일정·예상치: ${snapshot.source}`;
  box.replaceChildren(lead, fold);
  box.hidden = false;
}

// v58.75 ('고르는 법' E2·E3): the next market events — what is priced (where collected), what each live scenario needs from
// the result — and, folded, how to read a result against the price, with the latest recorded reactions.
// v59.51 (content audit): merged into 다음 확인 포인트 — the next release was named there, here and in the schedule. The
// face keeps the one check line (xr.nextEvent and what each scenario needs from it); the previews, the result guide and
// the recent cases were this closed fold; v59.69 keeps only the previews.
function renderEventPreview(doc, root, store, { xr, schedule, flow, nowMs }) {
  const anchor = doc.getElementById('briefing-checks');
  if (!anchor) return;
  let section = doc.getElementById('briefing-events');
  const previews = eventPreviews({ xr, schedule, earnings: root._aioEarningsSnapshot?.earnings || [], names: universeNames(root), themeMap: root.THEME_MAP, nowMs });
  if (!previews.length) { if (section) section.hidden = true; return; }
  if (!section) {
    section = el(doc, 'details', null, 'sx-disclosure briefing-events');
    section.id = 'briefing-events';
    anchor.append(section);
  }
  const heading = el(doc, 'summary', `다음 이벤트 ${previews.length}건, 예상과 결과 갈래`);
  heading.id = 'briefing-events-title';
  heading.title = '시장이 예상하는 것, 결과 갈래, 지금 시나리오와의 연결';
  // v59.69: the nearest release is the fork on the face (forkNode); the fold no longer repeats it as a sentence.
  const list = el(doc, 'div', null, 'briefing-events-list');
  for (const preview of previews) {
    const card = el(doc, 'div', null, 'briefing-event-preview');
    card.dataset.kind = preview.kind;
    card.append(el(doc, 'div', `${preview.when}, ${preview.title}`, 'briefing-event-preview-title'));
    if (preview.expect.length) card.append(el(doc, 'div', `예상: ${preview.expect.join(', ')}`, 'briefing-event-preview-line'));
    for (const branch of preview.branches) card.append(el(doc, 'div', branch, 'briefing-event-preview-line is-branch'));
    if (preview.note) card.title = preview.note;
    list.append(card);
  }
  // v59.69 (owner 2026-11-04): the rule paragraphs and sample cases left; each earnings card reads its own move.
  section.replaceChildren(heading, list);
  section.hidden = false;
}

// v59.69: the next release as a fork — the release on top, one branch per leading scenario.
function forkNode(doc, split) {
  const li = el(doc, 'li', null, 'briefing-check-fork');
  const node = el(doc, 'div', null, 'briefing-check-fork__node');
  node.append(el(doc, 'span', split.when, 'briefing-check-fork__when'), el(doc, 'span', split.name, 'briefing-check-fork__name'));
  li.append(node);
  if (split.zone?.latest) li.append(releaseZoneBar(doc, split.zone, { compact: true }));
  if (split.sides.length) {
    const list = el(doc, 'ul', null, 'briefing-check-fork__branches');
    list.append(...split.sides.map((side) => {
      const row = el(doc, 'li', null, 'briefing-check-fork__branch');
      row.append(el(doc, 'strong', side.title), doc.createTextNode(` 쪽이면 ${side.text}`));
      return row;
    }));
    li.append(list);
  }
  return li;
}

export function renderBriefingRead({ documentRef: doc, root, store = null, nowMs = Date.now() }) {
  const page = doc?.getElementById('page-briefing');
  if (!page) return;
  const snapshot = root.DATA_SNAPSHOT || {};
  // T05/P1685: the credit axis needs the 20-session HY change; load it like 시장 상태 does and redraw once it lands.
  if (sharedArtifactIsStale(root, MACRO_HISTORY.key, MACRO_HISTORY)) {
    refreshSharedArtifact(root, MACRO_HISTORY).then(({ changed }) => {
      if (changed && page.classList?.contains('active')) renderBriefingRead({ documentRef: doc, root, store });
    }).catch(() => {});
  }
  const interpretation = marketInterpretation(root);
  const read = interpretation.marketRead || { available: false, statements: [], drivers: [] }; // owner 2026-10-19: the shared read
  ensureResearchSnapshots({ documentRef: doc, root, host: page, kind: 'briefing', collect: () => ({
    kind: 'briefing', sessionDate: read.asOf, publishedAt: root._serverDataMeta?.generatedAt || null,
    version: root.AIO?.version || null, headline: read.headline || (read.available ? '두드러진 교차 신호 없음' : null),
    interpretation: read.headlineReading, facts: read.facts || [],
    checks: read.checks || [], source: 'AIO 종가 기록, 정규화된 신용·금리 관측', sourceRevision: root._serverDataMeta?.cycleId || null
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
      if (root._aioEarningsSnapshot && page.classList?.contains('active')) renderBriefingRead({ documentRef: doc, root, store });
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
    nowMs,
    perDay: 2 // v58.75 (persona review): each US date keeps its two heaviest reports (home's KO was missing here)
  });
  renderWeekStrip(doc, schedule, nowMs);
  const scheduleRows = doc.getElementById('briefing-schedule-rows');
  if (scheduleRows) {
    scheduleRows.replaceChildren(...(schedule.length ? schedule.map((row) => {
      const item = el(doc, 'div', null, `briefing-event${row.today ? ' is-today' : ''}${row.passed ? ' is-passed' : ''}`);
      item.dataset.kind = row.kind;
      item.dataset.eventId = row.id;
      if (row.sourceTitle) item.title = row.sourceTitle;
      const when = el(doc, 'span', row.status === 'received' ? `${row.when}, 발표 완료` : row.status === 'time-passed' ? `${row.when}, 예정 시각 지남` : row.when, 'briefing-event-when');
      const body = el(doc, 'div', null, 'briefing-event-body');
      body.append(el(doc, 'span', row.label, 'briefing-event-label'));
      const meta = [row.why && !String(row.when || '').includes(row.why) ? row.why : null, row.comparisonBasis, row.last].filter(Boolean).join(', ');
      if (meta) body.append(el(doc, 'span', meta, 'briefing-event-meta'));
      item.append(when, body);
      return item;
    }) : [el(doc, 'div', '7일 안에 예정된 주요 일정이 없습니다.', 'briefing-empty')]));
    // v58.52: say how many reports the S&P-weight cut left out, instead of dropping them silently.
    if (schedule.omittedEarnings > 0) scheduleRows.append(Object.assign(el(doc, 'div', `나머지 실적 발표 ${schedule.omittedEarnings}건은 아래 이번 주 실적 목록에 있습니다.`, 'briefing-event-meta'), { title: '실적 발표는 S&P 500 비중이 큰 것(날짜마다 상위 2곳 포함)만 시간순으로 보여 줍니다.' }));
  }
  renderEarningsWeek(doc, root, store, root._aioEarningsSnapshot);

  // 2. Read
  const headline = doc.getElementById('briefing-read-headline');
  if (headline) headline.textContent = read.available ? (read.headline || '눈에 띄는 신호가 없는 평범한 하루입니다.') : historyWaitText(root);
  const headlineReading = doc.getElementById('briefing-read-reading');
  if (headlineReading) headlineReading.replaceChildren(...(read.headlineReading ? [el(doc, 'span', '해석', 'briefing-hypothesis-tag'), doc.createTextNode(` ${read.headlineReading}`)] : []));
  const points = doc.getElementById('briefing-read-points');
  if (points) points.replaceChildren(...(read.points || []).map((row) => statementNode(doc, 'li', row)));

  // 2b. 2026-10-19 cadence: six-hour market slots beside the 24h read; v58.53 (5a) the day's sector bars sit beside them.
  renderSectorMoves({ documentRef: doc, root, host: doc.getElementById('briefing-sector-moves'), nowMs });
  renderMoveNews(doc, root, store, interpretation?.flow);

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
        pair.append(el(doc, 'span', label, 'briefing-driver-key'), doc.createTextNode(` ${value}${ownDay ? `, ${ownDay} 기준` : ''}`));
        values.append(pair);
      }
      box.append(values);
      if (row.context) box.append(el(doc, 'div', row.context, 'briefing-driver-context'));
      for (const statement of row.reads || []) box.append(statementNode(doc, 'p', statement, 'briefing-driver-read'));
      return box;
    }));
  }

  // 4. Next checks — what the tape itself asks to confirm, then the next release drawn as a fork.
  const checks = doc.getElementById('briefing-check-list');
  if (checks) {
    // P1599 (H06): dated releases live in the schedule right below (with their 'why'); repeating them here read
    // the same CPI line twice. Checks are what the tape itself asks to confirm, plus one pointer to the next release.
    // v59.51 (area H): the next release has one selector, the scenario model's nextEvent (the screen's own pick from the
    // schedule could name another release). It is named with what each of the two leading branches needs from it.
    const items = [...(read.checks || [])];
    let split = null;
    let xr = null;
    try {
      xr = interpretation?.crossroads || crossroadsForRoot(root, { nowMs });
      const event = xr?.nextEvent;
      const sideOf = (item) => { const trigger = item.triggers.find((row) => row.id === event.id); return trigger ? { title: item.title.split(' — ')[0], text: trigger.text } : null; };
      let sides = event ? (xr.items || []).filter((item) => item.id === xr.leadId || item.id === xr.altId).map(sideOf).filter(Boolean) : [];
      // v59.74: the next release may test branches other than the lead and the alternative (11/10 CPI vs a growth/AI tie);
      // its own branches are named then, at most three.
      if (event && !sides.length) sides = (xr.items || []).map(sideOf).filter(Boolean).slice(0, 3);
      const [, m, d] = String(event?.date || '').split('-').map(Number);
      if (event) split = { when: event.when || (m && d ? `${m}/${d}` : ''), name: event.name, sides, zone: releaseZones(event.id, root._aioMacroHistory || null) };
    } catch (_) { split = null; }
    const lines = items.map((text) => el(doc, 'li', text));
    if (split) lines.push(forkNode(doc, split));
    checks.replaceChildren(...(lines.length ? lines : [el(doc, 'li', '특별히 확인할 변화가 없습니다.')]));
    renderEventPreview(doc, root, store, { xr: interpretation?.crossroads, schedule, flow: interpretation?.flow, nowMs });
    // v57.54 audit (13): the two paths the next release splits link to the themes each one favours.
    // v59.51 (two layers): the theme links sit at the end of the event fold, not on the face.
    doc.getElementById('briefing-xr-themes')?.remove();
    const rows = split && xr ? (xr.items || []).filter((item) => item.id === xr.leadId || item.id === xr.altId).map((item) => themeLinkRow(doc, root, item)).filter(Boolean) : [];
    if (rows.length) {
      const box = el(doc, 'div', null, 'briefing-xr-themes');
      box.id = 'briefing-xr-themes';
      box.append(...rows);
      const fold = doc.getElementById('briefing-events');
      if (fold && !fold.hidden) fold.append(box); else checks.insertAdjacentElement('afterend', box);
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
  // v58.53 (5a): the driver rows sit in a fold; the bars go before the fold, on the face of the section.
  const before = anchor?.closest?.('details') || anchor;
  const host = before?.parentElement;
  if (!host) return;
  host.querySelector('.briefing-move-chart')?.remove();
  if (!moves.length) return;
  const wrap = el(doc, 'div', null, 'briefing-move-chart');
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', `자산별 1일·5일 등락: ${moves.map((row) => `${row.label} 1일 ${fmtMove(row.d1, row.unit)}, 5일 ${fmtMove(row.d5, row.unit)}`).join('; ')}`);
  for (const unit of ['%', 'bp']) {
    const rows = moves.filter((row) => row.unit === unit);
    if (!rows.length) continue;
    const max = signedScale(rows.flatMap((row) => [row.d1, row.d5]), unit === '%' ? 0.5 : 2);
    const block = el(doc, 'div', null, 'briefing-move-block');
    // v59.55 (owner 11/1): the legend is the head itself; why 달러·환율 are grey moves to its hover.
    const moveHead = el(doc, 'div', unit === '%' ? '등락(%), 진한 막대 1일 · 옅은 막대 5일' : '금리 변화(bp)', 'briefing-move-head');
    if (unit === '%') moveHead.title = '달러·환율 막대는 회색입니다. 오르고 내림에 좋고 나쁨이 없어서입니다.';
    block.append(moveHead);
    // v58.71: a row closed on another date than the S&P 500 (the first row) names its date.
    const baseDate = moves[0]?.asOf || null;
    for (const row of rows) {
      const line = el(doc, 'div', null, 'briefing-move-row');
      const [, mm, dd] = String(row.asOf || '').split('-').map(Number);
      line.append(el(doc, 'span', row.asOf && baseDate && row.asOf !== baseDate && mm && dd ? `${row.label}, ${mm}/${dd}` : row.label, 'briefing-move-label'));
      // v59.45 (R1-05): the colour follows the printed one-decimal sign; a move printed 0.0% is grey, not falling.
      // v59.55 (C3): the shared two-sided bar (signed-bar.js); bp rows and the dollar are 'flat' (no good or bad side).
      const fills = [['d5', 'is-5d'], ['d1', 'is-1d']].filter(([key]) => Number.isFinite(row[key]))
        .map(([key, cls]) => signedFill(doc, row[key], max, { tone: row.unit === 'bp' || row.neutral ? 'flat' : 'dir', className: cls }));
      const track = signedTrack(doc, fills, 'briefing-move-track');
      line.append(track, el(doc, 'span', `${fmtMove(row.d1, row.unit)}, ${fmtMove(row.d5, row.unit)}`, 'briefing-move-value'));
      block.append(line);
    }
    wrap.append(block);
  }
  host.insertBefore(wrap, before);
}

function fmtMove(value, unit) {
  if (!Number.isFinite(value)) return '—';
  const digits = unit === 'bp' ? 0 : 1;
  // v58.69: 원/달러 -0.03% printed "-0.0%"; a move that rounds to zero is printed unsigned.
  const text = value.toFixed(digits);
  if (Number(text) === 0) return `${(0).toFixed(digits)}${unit}`;
  return `${value > 0 ? '+' : ''}${text}${unit}`;
}
