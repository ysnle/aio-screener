#!/usr/bin/env node
// Prints the age in whole hours of the newest known 13D/G·13F poll, or "unknown".
// Used by refresh-data.yml "Decide daily lane": the lane is due when this is > 20 h or unknown.
// Sources: the Actions-cache marker written after a published poll (.cache/daily-lane/last-poll.json),
// and the artifact's own clock fields (they move only when the SEC evidence changes, so they are a
// lower bound, not the poll time).
import fs from 'node:fs';

const read = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; } };

export function lastPollAgeHours({ marker = {}, discovery = {}, now = Date.now() } = {}) {
  const times = [marker.polledAt, discovery.generatedAt, discovery.ownershipCheckedAt]
    .map((value) => Date.parse(value || ''))
    .filter(Number.isFinite);
  return times.length ? Math.floor((now - Math.max(...times)) / 3600000) : null;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  if (process.argv.includes('--write-marker')) {
    fs.mkdirSync('.cache/daily-lane', { recursive: true });
    fs.writeFileSync('.cache/daily-lane/last-poll.json', JSON.stringify({ polledAt: new Date().toISOString() }) + '\n');
  } else {
    const age = lastPollAgeHours({ marker: read('.cache/daily-lane/last-poll.json'), discovery: read('public-data/masters/filing-discovery.json') });
    process.stdout.write(age === null ? 'unknown' : String(age));
  }
}
