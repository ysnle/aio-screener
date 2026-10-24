import { MARKET_CALENDAR_REGISTRY, MARKET_HOLIDAY_NAMES } from '../market/market-calendar.js';

// P1389: the briefing opens with what is coming. Official release dates come from
// AIO_MACRO_CALENDAR (advanced by AIO_MACRO_OFFICIAL_SCHEDULES); release clock times are the
// agencies' standing times (BLS/BEA/Census 08:30 ET, ISM 10:00 ET, FOMC statement 14:00 ET).
// No consensus figure is shown — none is collected, and an invented one would be worse than none.
// P1399 (Codex review 2026-10-03): a passed clock time is not a received result. status is
// 'received' only when the result itself is in hand (an EPS actual); otherwise 'time-passed'.

// T04 (expert review 2026-10-13): "직전 +${nfp}천 명" printed "+-15천 명" for a job loss. Payrolls arrive in thousands and are
// shown signed in 만 명 (29 -> +2.9만 명, -15 -> -1.5만 명).
export function formatPayrollChange(thousands) {
  const value = thousands == null || thousands === '' ? NaN : Number(thousands);
  if (!Number.isFinite(value)) return null;
  if (value === 0) return '0명';
  return `${value > 0 ? '+' : value < 0 ? '-' : ''}${Number((Math.abs(value) / 10).toFixed(1)).toLocaleString('en-US')}만 명`;
}

const RELEASE_PROFILES = Object.freeze({
  'us-nfp': { label: '미국 고용보고서 (비농업 고용·실업률)', et: [8, 30], why: '고용이 강하면 금리 인하 기대가 줄어 금리·달러 상승 요인', last: (snap) => formatPayrollChange(snap.nfp) != null && snap.unemployment != null ? `직전 ${formatPayrollChange(snap.nfp)}, 실업률 ${snap.unemployment}%` : null },
  'us-cpi': { label: '미국 소비자물가 (CPI)', et: [8, 30], why: '예상보다 높으면 금리 상승·성장주 부담', last: (snap) => snap.cpi != null ? `직전 ${snap.cpi}%, 근원 ${snap.coreCpi ?? '—'}%` : null },
  'us-pce': { label: '미국 PCE 물가', et: [8, 30], why: '연준이 가장 중시하는 물가 지표', last: (snap) => snap.pce != null ? `직전 ${snap.pce}%, 근원 ${snap.corePce ?? '—'}%` : null },
  'us-ism-mfg': { label: 'ISM 제조업 지수', et: [10, 0], why: '50 위면 제조업 확장, 경기 방향 확인', last: (snap) => snap.ismPmi != null ? `직전 ${snap.ismPmi}` : null },
  'us-ism-svc': { label: 'ISM 서비스업 지수', et: [10, 0], why: '미국 경제의 대부분인 서비스 경기 확인', last: (snap) => snap.ismSvc != null ? `직전 ${snap.ismSvc}` : null },
  'us-retail': { label: '미국 소매판매', et: [8, 30], why: '소비 경기 확인', last: (snap) => snap.retailSales != null ? `직전 ${snap.retailSales}%` : null },
  'us-fomc': { label: 'FOMC 금리 결정', et: [14, 0], why: '정책금리와 향후 경로 — 모든 자산 가격의 기준', last: (_snap, extra) => extra.policyRange ? `현재 ${extra.policyRange}` : null },
  'kr-bok': { label: '한국은행 기준금리 결정', kst: [10, 0], why: '원화·한국 금리의 기준', last: () => null }
});

// v57.91 (performance audit): toLocaleString built a new formatter per call — 1.2s of a phone boot. One cached
// formatter and a (date, time) memo give the same instant.
let NY_HOUR_FORMAT = null;
const ET_WALL_MEMO = new Map();
function etWallClockToMs(date, [hour, minute]) {
  const key = `${date}|${hour}|${minute}`;
  const memo = ET_WALL_MEMO.get(key);
  if (memo !== undefined) return memo;
  const [y, m, d] = String(date).split('-').map(Number);
  NY_HOUR_FORMAT ||= new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false });
  let out = Date.UTC(y, m - 1, d, hour + 4, minute);
  if (!Number.isFinite(out)) return out; // Intl format throws on an invalid date; toLocaleString read it as NaN
  for (const offset of [4, 5]) {
    const ms = Date.UTC(y, m - 1, d, hour + offset, minute);
    const nyHour = Number(NY_HOUR_FORMAT.format(new Date(ms)));
    if (nyHour % 24 === hour) { out = ms; break; }
  }
  if (ET_WALL_MEMO.size >= 4000) ET_WALL_MEMO.clear();
  ET_WALL_MEMO.set(key, out);
  return out;
}

/** When a scheduled release becomes public (ms), or null for an id without a known release time. Codex audit F07: a
 *  release whose time has passed is not "다음" any more, while one later today still is (date >= today was both). */
export function releaseAtMs(id, date) {
  const profile = RELEASE_PROFILES[id === 'us-fed-rate' ? 'us-fomc' : id];
  if (!profile || !/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return null;
  return profile.kst
    ? Date.parse(`${date}T${String(profile.kst[0]).padStart(2, '0')}:${String(profile.kst[1]).padStart(2, '0')}:00+09:00`)
    : etWallClockToMs(date, profile.et);
}
/** The release clock the legacy calendar mirrors (scripts gate the copy). */
export const RELEASE_CLOCKS = Object.freeze(Object.fromEntries(Object.entries(RELEASE_PROFILES).map(([id, p]) => [id, p.kst ? { kst: p.kst } : { et: p.et }])));

function kstParts(ms) {
  const text = new Date(ms).toLocaleString('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  const [date, time] = text.split(', ');
  return { date, time: time.replace(/^24/, '00') };
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function formatKstWhen(ms) {
  const { date, time } = kstParts(ms);
  const [, month, day] = date.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(`${date}T12:00:00+09:00`).getUTCDay()];
  return { date, label: `${month}/${day}(${weekday}) ${time}` };
}

// P1501 (owner materials 2026-10-06): the week of 10/6 carried FOMC minutes, the KRX option expiry and a
// KRX holiday, yet the schedule read "no events" — it listed only data releases. These dates follow fixed
// rules, so they are derived rather than collected:
// - FOMC minutes: three weeks after each decision day, 14:00 ET (Federal Reserve practice since 2005).
// - KRX index futures/options expiry: the second Thursday of each month (the business day before when it is
//   a holiday); March/June/September/December are the quarterly simultaneous expiry.
// - US monthly listed options expiry: the third Friday (quarterly months: index futures expire the same day).
// - Exchange holidays: every registered KRX and NYSE closure (P1735: read from the one exchange calendar in
//   src/domain/market/market-calendar.js — this file kept a 2026-only copy that would have shown no 2027 holiday).
const QUARTER_MONTHS = new Set([3, 6, 9, 12]);
const registeredHolidays = (calendarKey) => Object.values(MARKET_CALENDAR_REGISTRY[calendarKey] || {}).flatMap((calendar) => calendar.holidays);
const isKrxHoliday = (iso) => (MARKET_CALENDAR_REGISTRY.KRX?.[iso.slice(0, 4)]?.holidays || []).includes(iso);
const holidayLabel = (prefix, calendarKey, date) => (MARKET_HOLIDAY_NAMES[calendarKey]?.[date] ? `${prefix} (${MARKET_HOLIDAY_NAMES[calendarKey][date]})` : prefix);

function isoDate(y, m, d) { return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
function nthWeekday(y, m, weekday, n) {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
}
function previousKrxBusinessDay(date) {
  let ms = Date.parse(`${date}T12:00:00Z`);
  for (;;) {
    const day = new Date(ms).getUTCDay();
    const iso = new Date(ms).toISOString().slice(0, 10);
    if (day !== 0 && day !== 6 && !isKrxHoliday(iso)) return iso;
    ms -= 86400000;
  }
}

// v58.74 (owner review 10/24): the week of the Israeli election showed no political event. Elections fixed by law are
// listed with the official source and the review date; a moved date is corrected here (the row leaves the window after).
// Times are when the polls close (results and exit polls follow), in KST. Sources, reviewed 2026-10-24: Israel Central
// Elections Committee (26th Knesset, 2026-10-27); 2 U.S.C. 7 (U.S. general election, 2026-11-03).
export const POLITICAL_EVENTS = Object.freeze([
  Object.freeze({ id: 'il-knesset-2026', atKst: '2026-10-28T05:00:00+09:00', label: '이스라엘 총선 (투표 마감, 출구조사)',
    why: '연정 구성에 따라 이란·중동 정책 기대가 바뀌어 유가 위험 프리미엄이 움직일 수 있음' }),
  Object.freeze({ id: 'us-midterm-2026', atKst: '2026-11-04T09:00:00+09:00', label: '미국 중간선거 (동부 투표 마감)',
    why: '의회 다수당에 따라 재정·관세·규제 기대가 바뀌어 금리·업종별 흐름이 갈릴 수 있음' })
]);

export function marketStructureEvents({ fomcDecisions = [], nowMs = Date.now(), days = 7 } = {}) {
  const rows = [];
  const push = (id, atMs, label, why) => {
    if (!Number.isFinite(atMs) || atMs < nowMs - 6 * 3600000 || atMs > nowMs + days * 86400000) return;
    rows.push({ id, kind: 'structure', atMs, label, why, last: null });
  };
  for (const decision of fomcDecisions || []) {
    const minutes = new Date(Date.parse(`${decision}T12:00:00Z`) + 21 * 86400000).toISOString().slice(0, 10);
    push(`fomc-minutes-${minutes}`, etWallClockToMs(minutes, [14, 0]), `FOMC 의사록 (${Number(decision.slice(5, 7))}/${Number(decision.slice(8, 10))} 회의)`, '위원들의 금리 경로 논의 — 다음 결정 기대가 바뀌면 금리·달러가 먼저 움직임');
  }
  const start = new Date(nowMs);
  for (let offset = 0; offset < 2; offset += 1) {
    const y = start.getUTCFullYear() + Math.floor((start.getUTCMonth() + offset) / 12);
    const m = ((start.getUTCMonth() + offset) % 12) + 1;
    const krx = previousKrxBusinessDay(isoDate(y, m, nthWeekday(y, m, 4, 2)));
    push(`krx-expiry-${krx}`, Date.parse(`${krx}T15:20:00+09:00`), QUARTER_MONTHS.has(m) ? '한국 선물·옵션 동시 만기' : '한국 옵션 만기',
      '만기 정산과 지수 추종 자금의 리밸런싱이 장 마감 무렵 대형주 수급을 흔들 수 있음');
    const us = isoDate(y, m, nthWeekday(y, m, 5, 3));
    push(`us-expiry-${us}`, etWallClockToMs(us, [16, 0]), QUARTER_MONTHS.has(m) ? '미국 지수 선물·옵션 분기 만기' : '미국 월물 옵션 만기',
      '대규모 옵션 포지션이 정리되며 만기 주간 지수 변동이 커지거나 오히려 줄 수 있음');
  }
  for (const date of registeredHolidays('KRX')) push(`krx-holiday-${date}`, Date.parse(`${date}T09:00:00+09:00`), holidayLabel('한국 증시 휴장', 'KRX', date), '한국 거래가 없는 날 — 해외 시장 변화는 다음 거래일에 한꺼번에 반영');
  for (const event of POLITICAL_EVENTS) push(event.id, Date.parse(event.atKst), event.label, event.why);
  for (const date of registeredHolidays('NYSE')) push(`nyse-holiday-${date}`, etWallClockToMs(date, [9, 30]), holidayLabel('미국 증시 휴장', 'NYSE', date), '미국 거래가 없는 날 — 다음 거래일 갭에 유의');
  return rows;
}

/**
 * @returns {Array<{ id, kind, atMs, when, label, why, last, today, passed, status }>} the next `days` days
 */
// T16: the briefing and the home schedule filter earnings to the same S&P 500 names.
export function sp500NameMap(rows = []) {
  const names = {};
  for (const row of Array.isArray(rows) ? rows : []) if (row?.sym && row?.name && row.index === 'SP500') names[row.sym] = row.name;
  return names;
}

export function buildBriefingSchedule({ releases = {}, snapshot = {}, policyRange = null, earnings = [], earningsMeta = {}, names = {}, nowMs = Date.now(), days = 7, maxEarnings = 8, fomcDecisions = null } = {}) {
  const rows = [];
  const today = kstParts(nowMs).date;
  if (Array.isArray(fomcDecisions)) {
    for (const event of marketStructureEvents({ fomcDecisions, nowMs, days })) {
      const when = formatKstWhen(event.atMs);
      rows.push({ ...event, when: `${when.label} KST`, today: when.date === today, passed: event.atMs < nowMs, status: event.atMs < nowMs ? 'time-passed' : 'upcoming' });
    }
  }
  const seenDates = new Set();
  for (const [key, release] of Object.entries(releases || {})) {
    const profile = RELEASE_PROFILES[key === 'us-fed-rate' ? 'us-fomc' : key];
    const date = release?.nextRelease || release?.next;
    if (!profile || !date) continue;
    const dedupeKey = `${profile.label}|${date}`;
    if (seenDates.has(dedupeKey)) continue;
    seenDates.add(dedupeKey);
    const atMs = profile.kst
      ? Date.parse(`${date}T${String(profile.kst[0]).padStart(2, '0')}:${String(profile.kst[1]).padStart(2, '0')}:00+09:00`)
      : etWallClockToMs(date, profile.et);
    if (!Number.isFinite(atMs) || atMs < nowMs - 6 * 3600000 || atMs > nowMs + days * 86400000) continue;
    const when = formatKstWhen(atMs);
    // P1737: the economic-projection flag is shown only when the Fed calendar the producer read marks this meeting.
    const label = profile === RELEASE_PROFILES['us-fomc'] && release?.sepMeeting === true ? `${profile.label}, 경제전망 발표` : profile.label;
    rows.push({ id: `macro:${key === 'us-fed-rate' ? 'us-fomc' : key}:${date}`, kind: 'macro', atMs, when: `${when.label} KST`, label, why: profile.why,
      originalTimeZone: profile.kst ? 'Asia/Seoul' : 'America/New_York', source: release.source || null,
      comparisonBasis: ['us-cpi', 'us-pce'].includes(key) ? '전년 동월 대비(%)' : key === 'us-retail' ? '전월 대비(%)' : null,
      last: profile.last(snapshot || {}, { policyRange }), today: when.date === today, passed: atMs < nowMs, status: atMs < nowMs ? 'time-passed' : 'upcoming' });
  }
  const uniqueEarnings = new Map();
  for (const row of Array.isArray(earnings) ? earnings : []) {
    const key = `earnings:${row?.symbol}:${row?.date}:${row?.hour || 'unknown'}`;
    const prior = uniqueEarnings.get(key);
    // A received result takes precedence over a duplicate pending row, not over a different event.
    if (!prior || (prior.epsActual == null && row?.epsActual != null)) uniqueEarnings.set(key, row);
  }
  const earningRows = [...uniqueEarnings.values()]
    .filter((row) => row?.symbol && names[row.symbol] && row.date)
    .map((row) => {
      const hour = row.hour === 'bmo' ? [8, 0] : row.hour === 'amc' ? [16, 5] : [16, 5];
      const atMs = etWallClockToMs(row.date, hour);
      return { row, atMs };
    })
    .filter(({ atMs }) => atMs >= nowMs - 6 * 3600000 && atMs <= nowMs + days * 86400000);
  // v58.52: an earnings-season session carries dozens of S&P 500 reports. Keep the most market-moving ones (index weight,
  // else the quarter's revenue estimate) and list them by time — the clock-then-name cut kept EFX·GM·GPC·HAL·HAS·KEY and
  // dropped 3M, Netflix, Meta and Tesla on 10/20.
  const weightOf = ({ row }) => (Number.isFinite(Number(row.indexWeight)) && Number(row.indexWeight) > 0 ? Number(row.indexWeight) : 0);
  const revenueOf = ({ row }) => Number(row.revenueEstimate) || 0;
  const keptEarnings = [...earningRows].sort((a, b) => weightOf(b) - weightOf(a) || revenueOf(b) - revenueOf(a) || a.atMs - b.atMs).slice(0, maxEarnings);
  rows.omittedEarnings = Math.max(0, earningRows.length - keptEarnings.length);
  earningRows.length = 0;
  earningRows.push(...keptEarnings.sort((a, b) => a.atMs - b.atMs));
  for (const { row, atMs } of earningRows) {
    const when = formatKstWhen(atMs);
    const session = row.hour === 'bmo' ? '장 전' : row.hour === 'amc' ? '장 마감 후' : '시간 미정';
    const estimateSource = row.estimateSource || earningsMeta.source || null;
    const est = estimateSource && row.epsEstimate != null && Number.isFinite(Number(row.epsEstimate)) ? Number(row.epsEstimate) : null;
    const actual = row.epsActual != null && Number.isFinite(Number(row.epsActual)) ? Number(row.epsActual) : null;
    const estimate = actual != null ? `EPS ${actual.toFixed(2)}${est != null ? ` (예상 ${est.toFixed(2)})` : ''}` : est != null ? `EPS 예상 ${est.toFixed(2)}` : null;
    // T15: the provider name moves to the hover (sourceTitle) and a missing currency or period is left out, not printed
    // as '미제공'; the fiscal period is already the row's comparisonBasis.
    const epsContext = estimate ? [estimate, row.currency ? `주당 ${row.currency}` : null].filter(Boolean).join(', ') : null;
    // Codex browser audit H20: the calendar only says before-open / after-close; "21:00" was our placeholder hour
    // shown as if the company had announced it. Earnings rows show the US date and session, not a clock time.
    const usDate = `${Number(row.date.slice(5, 7))}/${Number(row.date.slice(8, 10))}`;
    const whenLabel = row.hour === 'bmo' || row.hour === 'amc' ? `${usDate} 미국 ${session} (시각 미정)` : `${usDate} 미국, 발표 시각 미정`;
    void when;
    // v57.88 (screen audit): '장 전' has no announced clock time — the 08:00 ET placeholder made it read '예정 시각 지남' at
    // 08:10 ET. It is past only once the regular session has opened (09:30 ET).
    const passed = (row.hour === 'bmo' ? etWallClockToMs(row.date, [9, 30]) : atMs) < nowMs;
    rows.push({ id: `earnings:${row.symbol}:${row.date}:${row.hour || 'unknown'}`, kind: 'earnings', atMs, when: whenLabel, label: `${names[row.symbol]} (${row.symbol}) 실적`,
      originalTimeZone: 'America/New_York', source: earningsMeta.source || null, sourceUrl: earningsMeta.sourceUrl || null,
      sourceTitle: [earningsMeta.source ? `일정: ${earningsMeta.source}` : null, est != null && estimateSource ? `예상치: ${estimateSource}` : null].filter(Boolean).join(', ') || null,
      observedAt: earningsMeta.generatedAt || null, comparisonBasis: row.fiscalPeriod || null,
      why: session, last: epsContext, today: when.date === today, passed, status: actual != null ? 'received' : passed ? 'time-passed' : 'upcoming' });
  }
  return rows.sort((a, b) => a.atMs - b.atMs);
}
