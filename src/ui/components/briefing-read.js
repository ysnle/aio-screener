// One native owner for the briefing page — 일정 → 오늘의 해석 → 섹터와 움직인 이유 → 자산별 흐름 → 다음 확인.
// Replaces the six-axis summary, the market strip, the checklist, the legacy analysis block, the
// August research bridge and the news list (news now lives on the news screen).
import { releaseZoneBar } from './release-zone-bar.js';
import { releaseZones } from '../../domain/macro/release-zones.js';
import { alignInput } from '../../domain/briefing/market-read.js';
import { buildBriefingSchedule } from '../../domain/briefing/schedule.js';
import { ensureResearchSnapshots } from './research-snapshots.js';
import { refreshSharedArtifact, sharedArtifactIsStale } from '../../data/shared-artifacts.js';
import { briefingFlow } from '../../domain/market/story/page-flow.js';
import { renderNextSteps } from './page-flow.js';
import { crossroadsForRoot, themeLinkRow } from './macro-crossroads.js';
import { el } from './dom.js';
import { asOfChip } from './section-frame.js';
import { moveNewsList, moveNewsRows, symbolNames } from './market-timeline.js';
import { renderSectorMoves } from './sector-moves.js';
import { shortDate } from '../../domain/content/date-labels.js';
export { collectMarketInputs } from '../../data/selectors/market-inputs.js';
import { marketInterpretation, screenerRowsForRoot } from '../../data/selectors/interpretation.js';
import { buildEarningsWeek, eventPreviews } from '../../domain/briefing/event-guide.js';
import { historyWaitText } from './data-state.js';
import { MACRO_HISTORY } from '../../data/artifact-registry.js';
import { createTrendChart } from './trend-chart.js';
import { buildCloseSeries } from '../../domain/market/session/close-series.js';
import { signedText } from '../../domain/shared/number.js';

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

// The observation and its interpretation are shown apart; the interpretation is tagged.
function statementNode(doc, tag, { text, reading }, className) {
  const node = el(doc, tag, null, className);
  node.append(doc.createTextNode(text));
  // The observation stays on the first line and its reading sits under it in the secondary colour; one
  // '해석' tag on the headline labels the convention instead of a tag on every line.
  if (reading) node.append(el(doc, 'span', `→ ${reading}`, 'briefing-hypothesis is-line'));
  return node;
}

// v58.75 (persona review): "왜 움직였나" — after the sector line, the session's named movers (the stocks and themes 오늘
// shows) with the headline that named each the same day. No movers, no block.
// The face is never folded: the block is on the face — the movers with a same-day headline
// (at most five), then the rest in one line.
export function renderMoveNews(doc, root, store, flow) {
  const sector = doc.getElementById('briefing-sector-moves');
  if (!sector) return;
  const rows = moveNewsRows(root, store, flow);
  let block = doc.getElementById('briefing-move-news');
  if (!rows.length) { if (block) block.hidden = true; return; }
  if (!block) {
    block = el(doc, 'div', null, 'briefing-move-news');
    block.id = 'briefing-move-news';
    sector.append(block);
  }
  const head = el(doc, 'h3', `움직인 이유, 종목·테마 ${rows.length}곳 `, 'briefing-move-news-title');
  // Date chip; what the list compares is its hover.
  head.append(asOfChip(doc, `${shortDate(flow.session)} 종가`, '미국 종가, 같은 업종·테마 안에서 갈린 종목과 테마. 보도는 같은 날 나왔다는 사실이며 원인을 확정하지는 않습니다.'));
  const missing = rows.filter((row) => !row.headline);
  const rest = missing.length ? el(doc, 'p', `같은 날 관련 보도 없음: ${missing.map((row) => `${row.label} ${signedText(row.move, 1, '%')}`).join(', ')}`, 'briefing-read-reading') : null;
  block.replaceChildren(head, ...[moveNewsList(doc, root, rows, { max: 5 }), rest].filter(Boolean));
  block.hidden = false;
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
  // A Saturday or Sunday with no release and no report was a blank '—' column; it is left out.
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
    section.insertAdjacentElement('afterend', box); // Beside the schedule fold, not a fold inside it
  }
  const wasOpen = !!box.querySelector('details')?.open;
  const range = week.weekStart && week.weekEnd ? `${kstMd(week.weekStart)}~${kstMd(week.weekEnd)} ` : '';
  const lead = el(doc, 'p', `${range ? range : '이번 주 '}실적 발표 ${week.total.toLocaleString('en-US')}건, 그중 S&P 500 ${week.sp500}건${watched.size || held.size ? `, 관심·보유 ${week.mine.length}건` : ''}`, 'briefing-earnings-lead');
  const fold = el(doc, 'details', null, 'sx-disclosure briefing-earnings-fold');
  fold.dataset.foldKind = 'raw-table';
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
// the result, under 다음 확인 포인트. The face is never folded: the previews are on the face under the
// fork, the nearest three.
const EVENT_PREVIEWS_SHOWN = 3;
function renderEventPreview(doc, root, store, { xr, schedule, flow, nowMs }) {
  const anchor = doc.getElementById('briefing-checks');
  if (!anchor) return;
  let section = doc.getElementById('briefing-events');
  const previews = eventPreviews({ xr, schedule, earnings: root._aioEarningsSnapshot?.earnings || [], names: universeNames(root), themeMap: root.THEME_MAP, nowMs }).slice(0, EVENT_PREVIEWS_SHOWN);
  if (!previews.length) { if (section) section.hidden = true; return; }
  if (!section) {
    section = el(doc, 'div', null, 'briefing-events');
    section.id = 'briefing-events';
    anchor.append(section);
  }
  const heading = el(doc, 'h3', '다음 이벤트, 예상과 결과 갈래', 'briefing-events-title');
  heading.id = 'briefing-events-title';
  heading.title = '시장이 예상하는 것, 결과 갈래, 지금 시나리오와의 연결';
  // The nearest release is the fork above (forkNode); the previews do not repeat it as a sentence.
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
  // The rule paragraphs and sample cases left; each earnings card reads its own move.
  section.replaceChildren(heading, list);
  section.hidden = false;
}

// The next release as a fork — the release on top, one branch per leading scenario.
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

// The week sentence compares the 10-year yield with the S&P 500; the two paths it compares sit under it.
const WEEK_FIGURE_SESSIONS = 21;
function renderWeekFigure(doc, root, anchor, read) {
  if (!anchor) return;
  let host = doc.getElementById('briefing-read-figure');
  const panels = !read.available ? [] : [['S&P 500', 'spx', (value) => value.toLocaleString('en-US', { maximumFractionDigits: 0 }), (to, from) => signedText((to / from - 1) * 100, 1, '%')], ['미 10년물 금리', 'tnx', (value) => `${value.toFixed(2)}%`, (to, from) => signedText((to - from) * 100, 0, 'bp')]]
    .map(([title, field, format, change]) => ({ title, format, change, series: buildCloseSeries(root._aioHistory || [], field, { through: read.asOf || null }).slice(-WEEK_FIGURE_SESSIONS) }))
    .filter((panel) => panel.series.length >= 5);
  if (panels.length < 2) { host?.remove(); return; }
  if (!host) { host = el(doc, 'div', null, 'fig-group briefing-read-figure'); host.id = 'briefing-read-figure'; anchor.after(host); }
  host.replaceChildren(...panels.map((panel) => {
    const figure = el(doc, 'figure', null, 'fig');
    // The sentence above is about the last 5 sessions; the caption gives that change on the month the chart draws.
    const last = panel.series.at(-1), weekAgo = panel.series.at(-6);
    figure.append(el(doc, 'figcaption', `${panel.title} ${panel.format(last.value)}, 최근 5거래일 ${weekAgo ? panel.change(last.value, weekAgo.value) : '—'} (그림은 ${panel.series.length}거래일)`, 'fig__title'), createTrendChart(doc, { series: panel.series, format: panel.format, label: panel.title }));
    return figure;
  }));
}

export function renderBriefingRead({ documentRef: doc, root, store = null, nowMs = Date.now() }) {
  const page = doc?.getElementById('page-briefing');
  if (!page) return;
  const snapshot = root.DATA_SNAPSHOT || {};
  // The credit axis needs the 20-session HY change; load it like 시장 상태 does and redraw once it lands.
  if (sharedArtifactIsStale(root, MACRO_HISTORY.key, MACRO_HISTORY)) {
    refreshSharedArtifact(root, MACRO_HISTORY).then(({ changed }) => {
      if (changed && page.classList?.contains('active')) renderBriefingRead({ documentRef: doc, root, store });
    }).catch(() => {});
  }
  const interpretation = marketInterpretation(root);
  const read = interpretation.marketRead || { available: false, statements: [], drivers: [] }; // The shared read
  ensureResearchSnapshots({ documentRef: doc, root, host: page, kind: 'briefing', collect: () => ({
    kind: 'briefing', sessionDate: read.asOf, publishedAt: root._serverDataMeta?.generatedAt || null,
    version: root.AIO?.version || null, headline: read.headline || (read.available ? '두드러진 교차 신호 없음' : null),
    interpretation: read.headlineReading, facts: read.facts || [],
    checks: read.checks || [], source: 'AIO 종가 기록, 정규화된 신용·금리 관측', sourceRevision: root._serverDataMeta?.cycleId || null
  }) });

  // 1. Schedule
  // One request at a time; a failed or empty response clears the flag so a later render can
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
    // One Fed-range answer (producer -> FRED -> manual within its window; null once the manual value expired).
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
    // Say how many reports the S&P-weight cut left out, instead of dropping them silently.
    if (schedule.omittedEarnings > 0) scheduleRows.append(Object.assign(el(doc, 'div', `나머지 실적 발표 ${schedule.omittedEarnings}건은 아래 이번 주 실적 목록에 있습니다.`, 'briefing-event-meta'), { title: '실적 발표는 S&P 500 비중이 큰 것(날짜마다 상위 2곳 포함)만 시간순으로 보여 줍니다.' }));
  }
  renderEarningsWeek(doc, root, store, root._aioEarningsSnapshot);

  // 2. Read
  const headline = doc.getElementById('briefing-read-headline');
  if (headline) headline.textContent = read.available ? (read.headline || '눈에 띄는 신호가 없는 평범한 하루입니다.') : historyWaitText(root);
  const headlineReading = doc.getElementById('briefing-read-reading');
  if (headlineReading) headlineReading.replaceChildren(...(read.headlineReading ? [el(doc, 'span', '해석', 'briefing-hypothesis-tag'), doc.createTextNode(` ${read.headlineReading}`)] : []));
  renderWeekFigure(doc, root, headlineReading, read);
  const points = doc.getElementById('briefing-read-points');
  if (points) points.replaceChildren(...(read.points || []).map((row) => statementNode(doc, 'li', row)));

  // 2b. The day's sectors as one line with a link to 테마와 섹터, then the named movers and their same-day headlines.
  renderSectorMoves({ documentRef: doc, root, host: doc.getElementById('briefing-sector-moves'), nowMs });
  renderMoveNews(doc, root, store, interpretation?.flow);

  // 3. Drivers — one line and a link to 매크로 (bars here repeated the price rows of 오늘 and 매크로); the
  // per-asset numbers are the raw table. The axis readings left with the bars: 시장 상태 and 매크로 own them.
  renderMovesLine(doc, doc.getElementById('briefing-drivers-line'), read.moves || []);
  const drivers = doc.getElementById('briefing-driver-rows');
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
      return box;
    }));
  }

  // 4. Next checks — what the tape itself asks to confirm, then the next release drawn as a fork.
  const checks = doc.getElementById('briefing-check-list');
  if (checks) {
    // Dated releases live in the schedule right below (with their 'why'); repeating them here read
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
      // The next release may test branches other than the lead and the alternative (11/10 CPI vs a growth/AI tie);
      // its own branches are named then, at most three.
      if (event && !sides.length) sides = (xr.items || []).map(sideOf).filter(Boolean).slice(0, 3);
      const [, m, d] = String(event?.date || '').split('-').map(Number);
      if (event) split = { when: event.when || (m && d ? `${m}/${d}` : ''), name: event.name, sides, zone: releaseZones(event.id, root._aioMacroHistory || null) };
    } catch (_) { split = null; }
    const lines = items.map((text) => el(doc, 'li', text));
    if (split) lines.push(forkNode(doc, split));
    checks.replaceChildren(...(lines.length ? lines : [el(doc, 'li', '특별히 확인할 변화가 없습니다.')]));
    renderEventPreview(doc, root, store, { xr: interpretation?.crossroads, schedule, flow: interpretation?.flow, nowMs });
    // The two paths the next release splits link to the themes each one favours.
    // The theme links close the event previews.
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

// One owner per fact: 1·5-day bars here repeated the price rows of 오늘 and 매크로. The section
// says the session's strongest and weakest priced asset (the dollar and the won have no good or bad side and stay out)
// and the 10-year yield's move, each dated, then links to 매크로.
export function movesLine(moves = []) {
  const base = moves[0]?.asOf || null;
  const name = (row) => `${row.label}${row.asOf && base && row.asOf !== base ? `(${shortDate(row.asOf)})` : ''}`; // A row closed on another date names it
  const priced = moves.filter((row) => row.unit === '%' && !row.neutral && Number.isFinite(row.d1)).sort((a, b) => b.d1 - a.d1);
  const rate = moves.find((row) => row.unit === 'bp' && Number.isFinite(row.d1));
  const parts = priced.length > 1 ? [`가장 강한 ${name(priced[0])} ${fmtMove(priced[0].d1, '%')}`, `가장 약한 ${name(priced.at(-1))} ${fmtMove(priced.at(-1).d1, '%')}`]
    : priced.map((row) => `${name(row)} ${fmtMove(row.d1, '%')}`);
  if (rate) parts.push(`${name(rate)} ${fmtMove(rate.d1, 'bp')}`);
  return parts.length ? `${base ? `${shortDate(base)} 종가` : '최근 종가'} 1일, ${parts.join(', ')}.` : '';
}

function renderMovesLine(doc, node, moves) {
  if (!node) return;
  const text = movesLine(moves);
  node.hidden = !text;
  if (!text) { node.replaceChildren(); return; }
  const link = el(doc, 'button', '매크로에서 보기', 'flow-next-link');
  link.type = 'button';
  link.dataset.action = 'showPage';
  link.dataset.arg = 'macro';
  node.replaceChildren(doc.createTextNode(`${text} `), link);
}

function fmtMove(value, unit) {
  if (!Number.isFinite(value)) return '—';
  // A move that rounds to zero is printed unsigned (원/달러 -0.03% once read "-0.0%"); the shared formatter owns that rule.
  return signedText(value, unit === 'bp' ? 0 : 1, unit);
}
