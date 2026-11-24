#!/usr/bin/env node
// Prints the age in whole hours of the newest known 13D/G·13F poll, or "unknown"; "backoff" while a failed lane waits.
// Used by refresh-data.yml "Decide daily lane": the lane is due when this is > 20 h or unknown.
// Sources: the Actions-cache marker written after a published poll (.cache/daily-lane/last-poll.json),
// and the artifact's own clock fields (they move only when the SEC evidence changes, so they are a
// lower bound, not the poll time).
// A failed lane used to be retried on every 30-minute cycle, so a failure that repeats (an
// over-budget file, a contract break) re-ran the whole SEC chain all day. --record-failure keeps the last good poll
// time and counts failures; the next attempts wait 1, 2, 4, then at most 8 hours. A published poll clears the count.
import fs from 'node:fs';

const MARKER = '.cache/daily-lane/last-poll.json';
export const RETRY_BACKOFF_MAX_HOURS = 8;
const read = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; } };

export function lastPollAgeHours({ marker = {}, discovery = {}, now = Date.now() } = {}) {
  const times = [marker.polledAt, discovery.generatedAt, discovery.ownershipCheckedAt]
    .map((value) => Date.parse(value || ''))
    .filter(Number.isFinite);
  return times.length ? Math.floor((now - Math.max(...times)) / 3600000) : null;
}

export function retryBackoffHours(failures) {
  const count = Math.floor(Number(failures) || 0);
  return count > 0 ? Math.min(2 ** (count - 1), RETRY_BACKOFF_MAX_HOURS) : 0;
}

export function inRetryBackoff({ marker = {}, now = Date.now() } = {}) {
  const failedAt = Date.parse(marker.failedAt || '');
  return Number.isFinite(failedAt) && now - failedAt < retryBackoffHours(marker.failures) * 3600000;
}

export function failureMarker(marker = {}, now = Date.now()) {
  return { ...(marker.polledAt ? { polledAt: marker.polledAt } : {}), failedAt: new Date(now).toISOString(), failures: Math.floor(Number(marker.failures) || 0) + 1 };
}

// The lane is degradable, so a failing cycle still publishes and ends green; with the backoff, the one warning per attempt
// was the only trace while the lane failed from 11/06 to 11/15 and no alert opened. From the third failure in a row an
// issue opens and stays open until a published poll clears the count (refresh-data.yml job daily-lane-alert).
// Review v60.19 B1: v60.18 ended every refresh run red instead, so the cron fallback guard (which stands down only for a
// running or successful dispatched run) ran a second full cycle after each Worker dispatch and the SLO window counted
// every slot as failed. The alert is now a signal beside the run; the run's conclusion stays the data cycle's.
export const PERSISTENT_FAILURES = 3;
export function persistentLaneFailure(marker = {}) {
  const failures = Math.floor(Number(marker.failures) || 0);
  return failures >= PERSISTENT_FAILURES ? { failures, failedAt: marker.failedAt || null, polledAt: marker.polledAt || null } : null;
}
/**
 * The issue state the marker asks for: 'open' from the third failure in a row; 'clear' once a published poll reset the
 * count (a marker with polledAt and no failures); 'unchanged' otherwise — a fresh streak under the edge, or no marker
 * (a cache miss must never close an open alert).
 */
export function laneAlertState(marker = {}) {
  const persistent = persistentLaneFailure(marker);
  if (persistent) return { state: 'open', ...persistent };
  const failures = Math.floor(Number(marker.failures) || 0);
  return { state: marker.polledAt && failures === 0 ? 'clear' : 'unchanged', failures, failedAt: marker.failedAt || null, polledAt: marker.polledAt || null };
}

const writeMarker = (value) => { fs.mkdirSync('.cache/daily-lane', { recursive: true }); fs.writeFileSync(MARKER, JSON.stringify(value) + '\n'); };

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  if (process.argv.includes('--write-marker')) {
    writeMarker({ polledAt: new Date().toISOString() });
  } else if (process.argv.includes('--alert-state')) {
    // Never fails the run: the state goes to $GITHUB_OUTPUT for the daily-lane-alert job, and an open state is also a
    // warning annotation on this run.
    const alert = laneAlertState(read(MARKER));
    if (alert.state === 'open') console.log(`::warning::13D/G·13F lane has failed ${alert.failures} times in a row (last ${alert.failedAt}; last published poll ${alert.polledAt || 'unknown'}); its files stay at the last publish.`);
    else console.log(`daily lane alert state: ${alert.state} (failures ${alert.failures})`);
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `state=${alert.state}\nfailures=${alert.failures}\nfailed_at=${alert.failedAt || ''}\npolled_at=${alert.polledAt || ''}\n`);
  } else if (process.argv.includes('--record-failure')) {
    const next = failureMarker(read(MARKER));
    writeMarker(next);
    console.log(`daily lane failure ${next.failures}; next attempt after ${retryBackoffHours(next.failures)} h`);
  } else {
    const marker = read(MARKER);
    const age = lastPollAgeHours({ marker, discovery: read('public-data/masters/filing-discovery.json') });
    process.stdout.write(inRetryBackoff({ marker }) ? 'backoff' : age === null ? 'unknown' : String(age));
  }
}
