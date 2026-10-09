import { readFileSync } from 'node:fs';
import {
  MARKET_CALENDAR_REGISTRY,
  KRX_REGULAR_CALENDAR_2026,
  KRX_REGULAR_CALENDAR_2027,
  MARKET_CALENDAR_ADAPTERS,
  US_REGULAR_CALENDAR_2026,
  US_REGULAR_CALENDAR_2027,
  createMarketSessionEvidence,
  createTemporalEvidence,
  resolveMarketCalendarSession,
  resolveMarketSessionSchedule
} from '../src/ai/time/market-session.js';

const errors = [];
const check = (label, condition, detail) => { if (!condition) errors.push(label + (detail ? ': ' + JSON.stringify(detail) : '')); };

const legacyCore = readFileSync(new URL('../js/aio-core.js', import.meta.url), 'utf8');
const legacyTests = readFileSync(new URL('../js/aio-tests.js', import.meta.url), 'utf8');
const readLegacyArray = (name) => {
  const body = legacyCore.match(new RegExp(`var ${name} = \\[([\\s\\S]*?)\\];`))?.[1] || '';
  return [...body.matchAll(/'(\d{4}-\d{2}-\d{2})'/g)].map((match) => match[1]);
};
const readLegacyHalfDays = (name) => {
  const body = legacyCore.match(new RegExp(`var ${name} = \\{([^}]+)\\}`))?.[1] || '';
  return Object.fromEntries([...body.matchAll(/'(\d{4}-\d{2}-\d{2})':\s*'([0-9:]+)'/g)].map((match) => [match[1], match[2]]));
};
for (const [market, year, calendar] of [
  ['KRX', 2026, KRX_REGULAR_CALENDAR_2026], ['KRX', 2027, KRX_REGULAR_CALENDAR_2027],
  ['US', 2026, US_REGULAR_CALENDAR_2026], ['US', 2027, US_REGULAR_CALENDAR_2027]
]) {
  const registryMarket = market === 'US' ? 'NYSE' : 'KRX';
  check(`P1302/R447/QA-DATA-46 ${market} ${year} exported calendar is the registered calendar`, MARKET_CALENDAR_REGISTRY[registryMarket]?.[String(year)] === calendar);
  const legacyDates = readLegacyArray(`${market === 'KRX' ? 'KR' : 'US'}_HOLIDAYS_${year}`);
  check(`P1302/R447/QA-DATA-46 legacy ${market} ${year} holiday data matches ESM registry`, JSON.stringify(legacyDates) === JSON.stringify(calendar.holidays));
  if (market === 'US') {
    const legacyHalfDays = readLegacyHalfDays(`US_HALF_DAYS_${year}`);
    check(`P1302/R447/QA-DATA-46 legacy NYSE ${year} half-days match ESM registry`, JSON.stringify(legacyHalfDays) === JSON.stringify(calendar.halfDays));
  }
}
check('P1302/R447/QA-DATA-46 legacy unknown years have no 2026 fallback', !/\b_(?:KR|US)_HOLIDAYS_MAP\[d\.getFullYear\(\)\]\s*\|\|\s*KR?_?HOLIDAYS_2026/.test(legacyCore));
check('P1302/R447/QA-DATA-46 legacy session clock uses IANA DST and annual close data', legacyCore.includes("timeZone: 'America/New_York'")
  && legacyCore.includes("DATE_ENGINE.marketCalendarStatus('US', et)")
  && legacyCore.includes("DATE_ENGINE.marketCloseMinute('US', et)")
  && legacyCore.includes("DATE_ENGINE.marketCalendarStatus('KR', kst)")
  && legacyTests.includes('T75 P1302/R447/QA-DATA-46: NYSE runtime early-closes at 13:00 ET'));

const nyse = MARKET_CALENDAR_ADAPTERS.NYSE;
const krx = MARKET_CALENDAR_ADAPTERS.KRX;
check('NYSE adapter is timezone/DST aware', nyse.timezone === 'America/New_York' && nyse.dstAware === true);
check('KRX adapter is timezone explicit', krx.timezone === 'Asia/Seoul' && krx.dstAware === false);
check('DST-adjacent NYSE fixtures remain regular sessions', resolveMarketCalendarSession({ market: 'US', date: '2026-03-09' }).status === 'open' && resolveMarketCalendarSession({ market: 'US', date: '2026-11-02' }).status === 'open');
check('NYSE holiday and half-day fixtures are deterministic', resolveMarketCalendarSession({ market: 'US', date: '2026-07-03' }).reason === 'holiday' && resolveMarketCalendarSession({ market: 'US', date: '2026-11-27' }).halfDay === true);
check('KRX weekend fixture is closed', resolveMarketCalendarSession({ market: 'KR', date: '2026-08-08' }).reason === 'weekend');
check('P1302/R447/QA-DATA-46 registered 2026 calendar resolves its date without an override', resolveMarketCalendarSession({ market: 'US', date: '2026-08-10' }).status === 'open');

// R447/P1045/P1302 and QA-MARKET-CALENDAR/QA-DATA-46: registered dates are exact,
// year-scoped, and sourced from the official NYSE/KRX calendar pages.
const exactHolidayFixtures = [
  ['NYSE 2027', 'US', US_REGULAR_CALENDAR_2027, ['2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31', '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24']],
  ['KRX 2026', 'KR', KRX_REGULAR_CALENDAR_2026, ['2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18', '2026-03-02', '2026-05-01', '2026-05-05', '2026-05-25', '2026-06-03', '2026-07-17', '2026-08-17', '2026-09-24', '2026-09-25', '2026-10-05', '2026-10-09', '2026-12-25', '2026-12-31']],
  ['KRX 2027', 'KR', KRX_REGULAR_CALENDAR_2027, ['2027-01-01', '2027-02-08', '2027-02-09', '2027-03-01', '2027-05-03', '2027-05-05', '2027-05-13', '2027-07-19', '2027-08-16', '2027-09-14', '2027-09-15', '2027-09-16', '2027-10-04', '2027-10-11', '2027-12-27', '2027-12-31']]
];
for (const [label, market, calendar, dates] of exactHolidayFixtures) {
  check(`R447/P1045/P1302 QA-MARKET-CALENDAR/QA-DATA-46 ${label} exact holiday list`, JSON.stringify(calendar.holidays) === JSON.stringify(dates));
  for (const date of dates) {
    const session = resolveMarketCalendarSession({ market, date });
    check(`R447/P1045/P1302 QA-MARKET-CALENDAR/QA-DATA-46 ${label} ${date} resolves as holiday`, session.status === 'closed' && session.reason === 'holiday');
  }
}
check('R447/P1045/P1302 QA-MARKET-CALENDAR/QA-DATA-46 NYSE 2027 half-day closes at 13:00 ET', resolveMarketCalendarSession({ market: 'US', date: '2027-11-26' }).close === '13:00' && resolveMarketCalendarSession({ market: 'US', date: '2027-11-26' }).halfDay === true);
check('R447/P1045/P1302 QA-MARKET-CALENDAR/QA-DATA-46 KRX calendars declare no unsupported half-days', Object.keys(KRX_REGULAR_CALENDAR_2026.halfDays).length === 0 && Object.keys(KRX_REGULAR_CALENDAR_2027.halfDays).length === 0);
check('R447/P1045/P1302 QA-MARKET-CALENDAR/QA-DATA-46 mismatched registered year fails closed', resolveMarketCalendarSession({ market: 'US', date: '2027-01-04', calendar: US_REGULAR_CALENDAR_2026 }).status === 'unknown' && resolveMarketCalendarSession({ market: 'US', date: '2027-01-04', calendar: US_REGULAR_CALENDAR_2026 }).reason === 'calendar-year-mismatch');
check('R447/P1045/P1302 QA-MARKET-CALENDAR/QA-DATA-46 missing 2028 calendar fails closed', resolveMarketCalendarSession({ market: 'US', date: '2028-01-03' }).status === 'unknown');
check('R447/P1045/P1302 QA-MARKET-CALENDAR/QA-DATA-46 real-time resolver fails closed in unregistered 2028', resolveMarketSessionSchedule({ market: 'US', now: '2028-01-03T21:00:00.000Z', root: { _getUsSession: () => 'open' } }) === null);
const holidayInstant = '2026-07-03T14:00:00.000Z';
const suppliedHolidayConflict = resolveMarketSessionSchedule({ market: 'US', now: holidayInstant, supplied: { status: 'open', session: 'regular' } });
const rootHolidayConflict = resolveMarketSessionSchedule({ market: 'US', now: holidayInstant, root: { AIO: { marketSession: { status: 'open', session: 'regular' } } } });
check('P1302/R447/QA-DATA-46 registered holiday defeats contradictory supplied open session', suppliedHolidayConflict?.status === 'closed' && suppliedHolidayConflict.source === 'registered-market-calendar');
check('P1302/R447/QA-DATA-46 registered holiday defeats contradictory root open session', rootHolidayConflict?.status === 'closed' && rootHolidayConflict.source === 'registered-market-calendar');
const holidayConflictEvidence = createMarketSessionEvidence({ market: 'US', now: holidayInstant, schedule: { status: 'open', session: 'regular', source: 'stale-runtime' } });
check('P1302/R447/QA-DATA-46 contradictory holiday schedule cannot become verified open evidence', holidayConflictEvidence.status === 'closed' && holidayConflictEvidence.verified === true && holidayConflictEvidence.source === 'registered-market-calendar');
const unsupportedScheduleEvidence = createMarketSessionEvidence({ market: 'US', now: '2028-01-03T15:00:00.000Z', schedule: { status: 'open', session: 'regular' } });
check('P1302/R447/QA-DATA-46 explicit open schedule remains unverified without a registered calendar', unsupportedScheduleEvidence.status === 'unknown' && unsupportedScheduleEvidence.verified === false);
const temporal = createTemporalEvidence({ eventAt: '2026-08-10T13:30:00Z', observedAt: '2026-08-10T14:00:00Z', collectedAt: '2026-08-10T14:01:00Z', publishedAt: '2026-08-10T14:02:00Z' });
check('temporal evidence separates event/observed/collected/published', temporal.eventAt && temporal.observedAt && temporal.collectedAt && temporal.publishedAt && temporal.eventAt !== temporal.collectedAt);

// P1533 (owner decision, agent-recommended): the pure exchange calendar lives in the domain layer, the AI module only
// re-exports it, domain code never imports from src/ai, and the two session counters share one holiday-aware count.
{
  const { readFileSync, readdirSync, statSync } = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const calendar = await import('../src/domain/market/market-calendar.js').catch((error) => ({ error }));
  check('P1533 src/domain/market/market-calendar.js exists', !calendar.error, String(calendar.error?.message || ''));
  if (!calendar.error) {
    check('P1533 market-session.js re-exports the very same calendar objects', calendar.MARKET_CALENDAR_REGISTRY === MARKET_CALENDAR_REGISTRY && calendar.MARKET_CALENDAR_ADAPTERS === MARKET_CALENDAR_ADAPTERS && calendar.resolveMarketCalendarSession === resolveMarketCalendarSession && calendar.US_REGULAR_CALENDAR_2026 === US_REGULAR_CALENDAR_2026);
    const calendarSource = readFileSync(new URL('../src/domain/market/market-calendar.js', import.meta.url), 'utf8');
    check('P1533 the official NYSE/KRX source lines moved with the calendar (the annual review script parses them)', /^\/\/\s*NYSE source[^\r\n]*\r?\n\/\/\s*https:\/\/\S+/m.test(calendarSource) && /^\/\/\s*KRX source[^\r\n]*\r?\n\/\/\s*https:\/\/\S+/m.test(calendarSource));
    check('P1533 the calendar module imports nothing', !/^\s*import\s/m.test(calendarSource));
    const count = calendar.countOpenSessionsBetween;
    check('P1533 a July 3 holiday is not a session between 7/1 and 7/6', count?.('2026-07-01', '2026-07-06') === 2, count?.('2026-07-01', '2026-07-06'));
    check('P1533 Labor Day is not a session between 9/4 and 9/7', count?.('2026-09-04', '2026-09-07') === 0);
    check('P1533 an ordinary Friday to Monday is one session', count?.('2026-10-02', '2026-10-05') === 1);
    check('P1533 an unregistered year counts weekdays so stale data never reads as aligned', count?.('2028-01-03', '2028-01-07') === 4);
    check('P1533 a reversed or invalid range counts nothing', count?.('2026-10-05', '2026-10-02') === 0 && count?.('x', '2026-10-02') === 0);
    const missing = (await import('../src/domain/briefing/daily-diff.js')).missingSessionsBetween;
    check('P1533 missing sessions skip a US holiday and list the real gap', JSON.stringify(missing('2026-09-04', '2026-09-09')) === JSON.stringify(['2026-09-08']), missing('2026-09-04', '2026-09-09'));
    check('P1533 missing sessions fail closed in an unregistered year', missing('2028-01-03', '2028-01-06').length === 0);
    const { alignInput } = await import('../src/domain/briefing/market-read.js');
    const holidayLag = alignInput('2026-07-01', '2026-07-06');
    check('P1533 an input one real session behind a holiday weekend is lagged, not stale', holidayLag.status === 'lagged' && holidayLag.lag === 2, holidayLag);
    check('P1533 the same input across Labor Day reads aligned', alignInput('2026-09-04', '2026-09-07').status === 'aligned');
    const kr = (iso) => calendar.latestCompletedKrSession(Date.parse(iso));
    check('P1533 KRX close is not end-of-day confirmed during the 30-minute grace window', kr('2026-07-16T06:45:00Z')?.date === '2026-07-16' && kr('2026-07-16T06:45:00Z')?.eodConfirmed === false && kr('2026-07-16T06:59:00Z')?.eodConfirmed === false);
    check('P1533 KRX close is end-of-day confirmed from 16:00 KST and for earlier sessions', kr('2026-07-16T07:00:00Z')?.eodConfirmed === true && kr('2026-07-17T01:00:00Z')?.date === '2026-07-16' && kr('2026-07-17T01:00:00Z')?.eodConfirmed === true);
  }
  const offenders = [];
  (function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.m?js$/.test(entry) && /^\s*(?:import|export)\b[^\n]*from\s+['"](?:\.\.\/)+ai\//m.test(readFileSync(full, 'utf8'))) offenders.push(path.relative(fileURLToPath(new URL('..', import.meta.url)), full));
    }
  })(fileURLToPath(new URL('../src/domain', import.meta.url)));
  check('P1533 src/domain must not import from src/ai (the domain layer sits below it)', offenders.length === 0, offenders);
}

if (errors.length) { errors.forEach(error => console.error(' - ' + error)); process.exit(1); }
console.log('Market session contract check OK: NYSE/KRX adapters, DST/holiday/half-day/weekend fixtures, and unknown fail-closed state passed.');
