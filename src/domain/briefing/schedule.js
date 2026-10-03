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

/**
 * @returns {Array<{ id, kind, atMs, when, label, why, last, today, passed, status }>} the next `days` days
 */
export function buildBriefingSchedule({ releases = {}, snapshot = {}, policyRange = null, earnings = [], names = {}, nowMs = Date.now(), days = 7, maxEarnings = 6 } = {}) {
  const rows = [];
  const today = kstParts(nowMs).date;
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
    rows.push({ id: `earnings-${row.symbol}`, kind: 'earnings', atMs, when: when.label, label: `${names[row.symbol]} (${row.symbol}) 실적`,
      why: session, last: estimate, today: when.date === today, passed: atMs < nowMs, status: actual != null ? 'received' : atMs < nowMs ? 'time-passed' : 'upcoming' });
  }
  return rows.sort((a, b) => a.atMs - b.atMs);
}
