// P1389: the briefing opens with what is coming. Official release dates come from
// AIO_MACRO_CALENDAR (advanced by AIO_MACRO_OFFICIAL_SCHEDULES); release clock times are the
// agencies' standing times (BLS/BEA/Census 08:30 ET, ISM 10:00 ET, FOMC statement 14:00 ET).
// No consensus figure is shown — none is collected, and an invented one would be worse than none.
// P1399 (Codex review 2026-10-03): a passed clock time is not a received result. status is
// 'received' only when the result itself is in hand (an EPS actual); otherwise 'time-passed'.

const RELEASE_PROFILES = Object.freeze({
  'us-nfp': { label: '미국 고용보고서 (비농업 고용·실업률)', et: [8, 30], why: '고용이 강하면 금리 인하 기대가 줄어 금리·달러 상승 요인', last: (snap) => snap.nfp != null && snap.unemployment != null ? `직전 +${snap.nfp}천 명 · 실업률 ${snap.unemployment}%` : null },
  'us-cpi': { label: '미국 소비자물가 (CPI)', et: [8, 30], why: '예상보다 높으면 금리 상승·성장주 부담', last: (snap) => snap.cpi != null ? `직전 ${snap.cpi}% · 근원 ${snap.coreCpi ?? '—'}%` : null },
  'us-pce': { label: '미국 PCE 물가', et: [8, 30], why: '연준이 가장 중시하는 물가 지표', last: (snap) => snap.pce != null ? `직전 ${snap.pce}% · 근원 ${snap.corePce ?? '—'}%` : null },
  'us-ism-mfg': { label: 'ISM 제조업 지수', et: [10, 0], why: '50 위면 제조업 확장 · 경기 방향 확인', last: (snap) => snap.ismPmi != null ? `직전 ${snap.ismPmi}` : null },
  'us-ism-svc': { label: 'ISM 서비스업 지수', et: [10, 0], why: '미국 경제의 대부분인 서비스 경기 확인', last: (snap) => snap.ismSvc != null ? `직전 ${snap.ismSvc}` : null },
  'us-retail': { label: '미국 소매판매', et: [8, 30], why: '소비 경기 확인', last: (snap) => snap.retailSales != null ? `직전 ${snap.retailSales}%` : null },
  'us-fomc': { label: 'FOMC 금리 결정', et: [14, 0], why: '정책금리와 향후 경로 — 모든 자산 가격의 기준', last: (_snap, extra) => extra.policyRange ? `현재 ${extra.policyRange}` : null },
  'kr-bok': { label: '한국은행 기준금리 결정', kst: [10, 0], why: '원화·국내 금리의 기준', last: () => null }
});

function etWallClockToMs(date, [hour, minute]) {
  const [y, m, d] = String(date).split('-').map(Number);
  for (const offset of [4, 5]) {
    const ms = Date.UTC(y, m - 1, d, hour + offset, minute);
    const nyHour = Number(new Date(ms).toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }));
    if (nyHour % 24 === hour) return ms;
  }
  return Date.UTC(y, m - 1, d, hour + 4, minute);
}

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
// - Exchange holidays: the published 2026 KRX and NYSE closures still ahead.
const KRX_HOLIDAYS_2026 = Object.freeze({ '2026-10-09': '한글날', '2026-12-25': '성탄절', '2026-12-31': '연말 휴장' });
const NYSE_HOLIDAYS_2026 = Object.freeze({ '2026-11-26': '추수감사절', '2026-12-25': '성탄절' });
const QUARTER_MONTHS = new Set([3, 6, 9, 12]);

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
    if (day !== 0 && day !== 6 && !KRX_HOLIDAYS_2026[iso]) return iso;
    ms -= 86400000;
  }
}

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
    push(`krx-expiry-${krx}`, Date.parse(`${krx}T15:20:00+09:00`), QUARTER_MONTHS.has(m) ? '국내 선물·옵션 동시 만기' : '국내 옵션 만기',
      '만기 정산과 지수 추종 자금의 리밸런싱이 장 마감 무렵 대형주 수급을 흔들 수 있음');
    const us = isoDate(y, m, nthWeekday(y, m, 5, 3));
    push(`us-expiry-${us}`, etWallClockToMs(us, [16, 0]), QUARTER_MONTHS.has(m) ? '미국 지수 선물·옵션 분기 만기' : '미국 월물 옵션 만기',
      '대규모 옵션 포지션이 정리되며 만기 주간 지수 변동이 커지거나 눌릴 수 있음');
  }
  for (const [date, name] of Object.entries(KRX_HOLIDAYS_2026)) push(`krx-holiday-${date}`, Date.parse(`${date}T09:00:00+09:00`), `한국 증시 휴장 (${name})`, '국내 거래가 없는 날 — 해외 시장 변화는 다음 거래일에 한꺼번에 반영');
  for (const [date, name] of Object.entries(NYSE_HOLIDAYS_2026)) push(`nyse-holiday-${date}`, etWallClockToMs(date, [9, 30]), `미국 증시 휴장 (${name})`, '미국 거래가 없는 날 — 다음 거래일 갭에 유의');
  return rows;
}

/**
 * @returns {Array<{ id, kind, atMs, when, label, why, last, today, passed, status }>} the next `days` days
 */
export function buildBriefingSchedule({ releases = {}, snapshot = {}, policyRange = null, earnings = [], names = {}, nowMs = Date.now(), days = 7, maxEarnings = 6, fomcDecisions = null } = {}) {
  const rows = [];
  const today = kstParts(nowMs).date;
  if (Array.isArray(fomcDecisions)) {
    for (const event of marketStructureEvents({ fomcDecisions, nowMs, days })) {
      const when = formatKstWhen(event.atMs);
      rows.push({ ...event, when: when.label, today: when.date === today, passed: event.atMs < nowMs, status: event.atMs < nowMs ? 'time-passed' : 'upcoming' });
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
    rows.push({ id: key, kind: 'macro', atMs, when: when.label, label: profile.label, why: profile.why,
      last: profile.last(snapshot || {}, { policyRange }), today: when.date === today, passed: atMs < nowMs, status: atMs < nowMs ? 'time-passed' : 'upcoming' });
  }
  const earningRows = (Array.isArray(earnings) ? earnings : [])
    .filter((row) => row?.symbol && names[row.symbol] && row.date)
    .map((row) => {
      const hour = row.hour === 'bmo' ? [8, 0] : row.hour === 'amc' ? [16, 5] : [16, 5];
      const atMs = etWallClockToMs(row.date, hour);
      return { row, atMs };
    })
    .filter(({ atMs }) => atMs >= nowMs - 6 * 3600000 && atMs <= nowMs + days * 86400000)
    .sort((a, b) => a.atMs - b.atMs)
    .slice(0, maxEarnings);
  for (const { row, atMs } of earningRows) {
    const when = formatKstWhen(atMs);
    const session = row.hour === 'bmo' ? '장 전' : row.hour === 'amc' ? '장 마감 후' : '시간 미정';
    const est = row.epsEstimate != null && Number.isFinite(Number(row.epsEstimate)) ? Number(row.epsEstimate) : null;
    const actual = row.epsActual != null && Number.isFinite(Number(row.epsActual)) ? Number(row.epsActual) : null;
    const estimate = actual != null ? `EPS ${actual.toFixed(2)}${est != null ? ` (예상 ${est.toFixed(2)})` : ''}` : est != null ? `EPS 예상 ${est.toFixed(2)}` : null;
    // Codex browser audit H20: the calendar only says before-open / after-close; "21:00" was our placeholder hour
    // shown as if the company had announced it. Earnings rows show the US date and session, not a clock time.
    const usDate = `${Number(row.date.slice(5, 7))}/${Number(row.date.slice(8, 10))}`;
    const whenLabel = row.hour === 'bmo' || row.hour === 'amc' ? `${usDate} 미국 ${session} · 정확한 시각은 회사 발표 확인` : `${usDate} 미국 · 발표 시각 미정`;
    void when;
    rows.push({ id: `earnings-${row.symbol}`, kind: 'earnings', atMs, when: whenLabel, label: `${names[row.symbol]} (${row.symbol}) 실적`,
      why: session, last: estimate, today: when.date === today, passed: atMs < nowMs, status: actual != null ? 'received' : atMs < nowMs ? 'time-passed' : 'upcoming' });
  }
  return rows.sort((a, b) => a.atMs - b.atMs);
}
