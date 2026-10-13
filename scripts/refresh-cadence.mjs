#!/usr/bin/env node
// P1757: refresh-data cadence decision (owner decision 2026-10-14). When the US and KRX markets are both closed over
// the weekend no new prices exist, so the 30-minute refresh skips and only a news cycle runs, at most every 2 hours.
// Used by the `cadence` job of refresh-data.yml before any install; it reads only the exchange calendar (the one
// holiday/half-day source, src/domain/market/market-calendar.js) and the published data.json clock.
//
// Quiet window (all must hold, otherwise the cycle runs in full):
//   1. Seoul wall clock is Saturday, Sunday, or Monday before 07:00 KST (the owner's weekend frame);
//   2. no NYSE or KRX regular session is in progress, and the latest completed session of each closed at least
//      FINAL_CLOSE_GRACE_MIN earlier (the Friday US close is final: 16:00 ET + 60 min = Sat 06:00 KST under EDT);
//   3. the next NYSE or KRX regular open is more than PRE_OPEN_LEAD_MIN away (KRX 09:00 - 120 min = Mon 07:00 KST).
// Sessions come from MARKET_CALENDAR_REGISTRY, so half days and holidays adjacent to a weekend move the edges. A weekday
// holiday is never quiet: index futures, FX and the other market keep printing. An unregistered calendar year fails
// open (full cadence), and so does any error in this script.
//
// Modes: full (every lane), news (weekend news cycle; the producer still runs end to end), skip (no producer job).
// Operator workflow_dispatch and the daily '33 7 * * *' cron are always full; a Worker scheduler dispatch
// (trigger=scheduler, P1377) and the :17/:47 cron follow the weekend rule.
import fs from 'node:fs';
import { resolveMarketCalendarSession, MARKET_CALENDAR_ADAPTERS, dateInTimezone } from '../src/domain/market/market-calendar.js';

export const FINAL_CLOSE_GRACE_MIN = 60;
export const PRE_OPEN_LEAD_MIN = 120;
// Slots arrive every ~30 min (cron :17/:47 plus the Worker dispatcher), so "due at >= 105 min" yields one news cycle
// per 2 hours without drifting to 2.5 h when a slot lands a few minutes early.
export const WEEKEND_NEWS_INTERVAL_MIN = 120;
export const WEEKEND_NEWS_DUE_MIN = 105;
export const DAILY_LANE_CRON = '33 7 * * *';
const SESSION_SCAN_DAYS = 6;
const MINUTE = 60000;
const DAY = 86400000;

const WALL_FORMATTERS = new Map();
function wallParts(ms, timeZone) {
  let formatter = WALL_FORMATTERS.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' });
    WALL_FORMATTERS.set(timeZone, formatter);
  }
  const p = Object.fromEntries(formatter.formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hhmm: `${p.hour}:${p.minute}`, minute: Number(p.hour) * 60 + Number(p.minute), weekday: p.weekday };
}

// Wall-clock date + HH:MM in a time zone -> UTC instant (DST aware; two correction passes cover any offset).
export function zonedInstant(date, hhmm, timeZone) {
  const target = Date.parse(`${date}T${hhmm}:00Z`);
  let guess = target;
  for (let i = 0; i < 2; i += 1) {
    const seen = wallParts(guess, timeZone);
    guess -= Date.parse(`${seen.date}T${seen.hhmm}:00Z`) - target;
  }
  return guess;
}

const shiftDate = (date, days) => new Date(Date.parse(`${date}T12:00:00Z`) + days * DAY).toISOString().slice(0, 10);

// Regular sessions of one exchange around `nowMs`, or null when a date in the scan falls in an unregistered year.
export function sessionsAround(market, nowMs, days = SESSION_SCAN_DAYS) {
  const adapter = MARKET_CALENDAR_ADAPTERS[market === 'KR' ? 'KRX' : 'NYSE'];
  const today = dateInTimezone(nowMs, adapter.timezone);
  if (!today) return null;
  const sessions = [];
  for (let offset = -days; offset <= days; offset += 1) {
    const date = shiftDate(today, offset);
    const session = resolveMarketCalendarSession({ market, date });
    if (session.status === 'unknown') return null;
    if (session.status !== 'open') continue;
    sessions.push({ market, date, openMs: zonedInstant(date, session.open, adapter.timezone), closeMs: zonedInstant(date, session.close, adapter.timezone) });
  }
  return sessions;
}

export function marketQuietWindow(nowMs = Date.now()) {
  const now = Number(nowMs);
  if (!Number.isFinite(now)) return { quiet: false, reason: 'invalid-clock' };
  const seoul = wallParts(now, 'Asia/Seoul');
  const weekendFrame = seoul.weekday === 'Sat' || seoul.weekday === 'Sun' || (seoul.weekday === 'Mon' && seoul.minute < 7 * 60);
  if (!weekendFrame) return { quiet: false, reason: 'weekday', seoul: `${seoul.date} ${seoul.hhmm} ${seoul.weekday}` };
  const markets = {};
  for (const market of ['US', 'KR']) {
    const sessions = sessionsAround(market, now);
    if (!sessions) return { quiet: false, reason: `calendar-unregistered-${market}` };
    const inSession = sessions.find((s) => s.openMs <= now && now < s.closeMs) || null;
    const lastClose = sessions.filter((s) => s.closeMs <= now).map((s) => s.closeMs).sort((a, b) => b - a)[0] ?? null;
    const nextOpen = sessions.filter((s) => s.openMs > now).map((s) => s.openMs).sort((a, b) => a - b)[0] ?? null;
    markets[market] = {
      inSession: Boolean(inSession),
      minutesSinceClose: lastClose == null ? null : Math.floor((now - lastClose) / MINUTE),
      minutesToOpen: nextOpen == null ? null : Math.floor((nextOpen - now) / MINUTE)
    };
    if (inSession) return { quiet: false, reason: `${market}-in-session`, markets };
    if (lastClose == null || now - lastClose < FINAL_CLOSE_GRACE_MIN * MINUTE) return { quiet: false, reason: `${market}-close-not-final`, markets };
    if (nextOpen == null || nextOpen - now <= PRE_OPEN_LEAD_MIN * MINUTE) return { quiet: false, reason: `${market}-open-approaching`, markets };
  }
  return { quiet: true, reason: 'both-markets-closed-weekend', seoul: `${seoul.date} ${seoul.hhmm} ${seoul.weekday}`, markets };
}

export function decideRefreshCadence({ nowMs = Date.now(), eventName = '', schedule = '', trigger = '', lastNewsAt = null } = {}) {
  if (eventName === 'workflow_dispatch' && trigger !== 'scheduler') return { mode: 'full', reason: 'operator-dispatch' };
  if (eventName === 'schedule' && schedule === DAILY_LANE_CRON) return { mode: 'full', reason: 'daily-cron' };
  const window = marketQuietWindow(nowMs);
  if (!window.quiet) return { mode: 'full', reason: window.reason, window };
  const lastMs = Date.parse(lastNewsAt || '');
  const ageMin = Number.isFinite(lastMs) ? Math.floor((Number(nowMs) - lastMs) / MINUTE) : null;
  if (ageMin == null || ageMin < 0 || ageMin >= WEEKEND_NEWS_DUE_MIN) return { mode: 'news', reason: `weekend-news-due-age-${ageMin ?? 'unknown'}m`, window };
  return { mode: 'skip', reason: `weekend-news-not-due-age-${ageMin}m`, window };
}

const entry = process.argv[1] ? process.argv[1].replace(/\\/g, '/') : '';
if (entry && (import.meta.url === `file://${entry}` || import.meta.url === `file:///${entry}`)) {
  let decision;
  try {
    let lastNewsAt = null;
    try { lastNewsAt = JSON.parse(fs.readFileSync('public-data/data.json', 'utf8'))?.meta?.generatedAt || null; } catch { lastNewsAt = null; }
    decision = decideRefreshCadence({
      nowMs: process.env.AIO_CADENCE_NOW ? Date.parse(process.env.AIO_CADENCE_NOW) : Date.now(),
      eventName: process.env.EVENT_NAME || '',
      schedule: process.env.EVENT_SCHEDULE || '',
      trigger: process.env.DISPATCH_TRIGGER || '',
      lastNewsAt
    });
  } catch (error) {
    decision = { mode: 'full', reason: `decider-error-fail-open: ${String(error?.message || error).slice(0, 200)}` };
  }
  console.log(JSON.stringify(decision));
  if (process.argv.includes('--github-output') && process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `mode=${decision.mode}\nreason=${decision.reason.replace(/[\r\n]/g, ' ')}\n`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Refresh cadence\n\n- mode: **${decision.mode}**\n- reason: ${decision.reason}\n`);
  }
}
