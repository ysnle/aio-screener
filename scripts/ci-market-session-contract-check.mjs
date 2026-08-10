import { MARKET_CALENDAR_ADAPTERS, createTemporalEvidence, resolveMarketCalendarSession } from '../src/ai/time/market-session.js';

const errors = [];
const check = (label, condition, detail) => { if (!condition) errors.push(label + (detail ? ': ' + JSON.stringify(detail) : '')); };

const nyse = MARKET_CALENDAR_ADAPTERS.NYSE;
const krx = MARKET_CALENDAR_ADAPTERS.KRX;
check('NYSE adapter is timezone/DST aware', nyse.timezone === 'America/New_York' && nyse.dstAware === true);
check('KRX adapter is timezone explicit', krx.timezone === 'Asia/Seoul' && krx.dstAware === false);
check('DST-adjacent NYSE fixtures remain regular sessions', resolveMarketCalendarSession({ market: 'US', date: '2026-03-09', calendar: {}, holidays: [] }).status === 'open' && resolveMarketCalendarSession({ market: 'US', date: '2026-11-02', calendar: {}, holidays: [] }).status === 'open');
check('NYSE holiday and half-day fixtures are deterministic', resolveMarketCalendarSession({ market: 'US', date: '2026-07-03', calendar: {}, holidays: ['2026-07-03'] }).reason === 'holiday' && resolveMarketCalendarSession({ market: 'US', date: '2026-11-27', calendar: {}, holidays: [], halfDays: { '2026-11-27': '13:00' } }).halfDay === true);
check('KRX weekend fixture is closed', resolveMarketCalendarSession({ market: 'KR', date: '2026-08-08', calendar: {}, holidays: [] }).reason === 'weekend');
check('missing calendar fails closed to UNKNOWN', resolveMarketCalendarSession({ market: 'US', date: '2026-08-10' }).status === 'unknown');
const temporal = createTemporalEvidence({ eventAt: '2026-08-10T13:30:00Z', observedAt: '2026-08-10T14:00:00Z', collectedAt: '2026-08-10T14:01:00Z', publishedAt: '2026-08-10T14:02:00Z' });
check('temporal evidence separates event/observed/collected/published', temporal.eventAt && temporal.observedAt && temporal.collectedAt && temporal.publishedAt && temporal.eventAt !== temporal.collectedAt);

if (errors.length) { errors.forEach(error => console.error(' - ' + error)); process.exit(1); }
console.log('Market session contract check OK: NYSE/KRX adapters, DST/holiday/half-day/weekend fixtures, and unknown fail-closed state passed.');
