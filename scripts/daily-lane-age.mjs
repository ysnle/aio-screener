#!/usr/bin/env node
// Prints the age in whole hours of the newest known 13D/G·13F poll, or "unknown"; "backoff" while a failed lane waits.
// Used by refresh-data.yml "Decide daily lane": the lane is due when this is > 20 h or unknown.
// Sources: the Actions-cache marker written after a published poll (.cache/daily-lane/last-poll.json),
// and the artifact's own clock fields (they move only when the SEC evidence changes, so they are a
// lower bound, not the poll time).
// v58.87 (P2093 follow-up): a failed lane used to be retried on every 30-minute cycle, so a failure that repeats (an
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

const writeMarker = (value) => { fs.mkdirSync('.cache/daily-lane', { recursive: true }); fs.writeFileSync(MARKER, JSON.stringify(value) + '\n'); };

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  if (process.argv.includes('--write-marker')) {
    writeMarker({ polledAt: new Date().toISOString() });
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
