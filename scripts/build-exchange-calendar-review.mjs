#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MARKET_CALENDAR_REGISTRY } from '../src/ai/time/market-session.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const calendarSourcePath = path.join(root, 'src/ai/time/market-session.js');

function parseYear(argv) {
  if (argv.length !== 2 || argv[0] !== '--year' || !/^\d{4}$/.test(argv[1])) {
    throw new Error('Usage: node scripts/build-exchange-calendar-review.mjs --year <YYYY>');
  }
  const year = Number(argv[1]);
  if (year < 2000 || year > 9999) throw new Error(`Review year is out of range: ${argv[1]}`);
  return year;
}

function verifiedCheckoutSha() {
  const expectedSha = process.env.AIO_SOURCE_SHA || '';
  if (!expectedSha) return null;
  if (!/^[0-9a-f]{40}$/.test(expectedSha)) throw new Error('AIO_SOURCE_SHA must be a full lowercase commit SHA.');

  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  if (head.status !== 0 || String(head.stdout || '').trim() !== expectedSha) {
    throw new Error('AIO_SOURCE_SHA must match the checked-out HEAD commit.');
  }
  const status = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  if (status.status !== 0 || String(status.stdout || '').trim()) {
    throw new Error('AIO_SOURCE_SHA can only be asserted for a clean checkout.');
  }
  return expectedSha;
}

function extractOfficialSources(source) {
  const matches = [...source.matchAll(/^\/\/\s*(NYSE|KRX) source[^\r\n]*\r?\n\/\/\s*(https:\/\/\S+)[ \t]*$/gm)];
  const sources = Object.fromEntries(matches.map((match) => [match[1], match[2]]));
  for (const market of ['NYSE', 'KRX']) {
    if (!sources[market]) throw new Error(`Official ${market} calendar source URL was not found in ${path.relative(root, calendarSourcePath)}.`);
  }
  return { NYSE: sources.NYSE, KRX: sources.KRX };
}

function extractRegisteredYears(registry, market) {
  const calendars = registry?.[market];
  if (!calendars || typeof calendars !== 'object') throw new Error(`${market} calendar registry was not found.`);
  const years = Object.keys(calendars).map(Number).sort((left, right) => left - right);
  if (!years.length || years.some((year) => !Number.isInteger(year) || Number(calendars[year]?.year) !== year)) {
    throw new Error(`${market} calendar registry has no valid explicit years or contains a year mismatch.`);
  }
  return years;
}

function buildExchangeCalendarReview({ year, source, registry, checkoutSha }) {
  const officialSources = extractOfficialSources(source);
  const registeredYears = {
    NYSE: extractRegisteredYears(registry, 'NYSE'),
    KRX: extractRegisteredYears(registry, 'KRX')
  };
  const stableDigestInput = { year, officialSources, registeredYears, checkoutSha };
  const digest = createHash('sha256').update(JSON.stringify(stableDigestInput)).digest('hex').slice(0, 16);
  const checkout = checkoutSha || 'Not asserted (local report generation without AIO_SOURCE_SHA).';
  const rows = ['NYSE', 'KRX'].map((market) => {
    const years = registeredYears[market];
    const targetStatus = years.includes(year)
      ? 'registered in this checkout; verify against the official publication'
      : 'not registered; runtime remains unknown and fail-closed';
    const sourceLabel = market === 'NYSE' ? 'NYSE / ICE holiday and early-close calendar' : 'KRX official holiday calendar';
    return `| ${market} | ${years.join(', ')} | ${targetStatus} | [${sourceLabel}](${officialSources[market]}) |`;
  });
  const markdown = [
    `<!-- aio-exchange-calendar-review:${year} -->`,
    `<!-- aio-exchange-calendar-review-hash:${digest} -->`,
    `## Annual exchange calendar review — ${year}`,
    '',
    'This is a human review reminder only. It does not fetch dates, infer weekday openings, or change canonical calendar data.',
    '',
    `Checked-out source SHA: **${checkout}**. Registry coverage below describes this checkout only; it is not live deployment evidence.`,
    '',
    '| Exchange | Explicitly registered years | Target-year status | Official source |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
    '### Review checklist',
    '',
    `- Verify the full ${year} holiday schedule against the linked official publication; for NYSE, include early closes as well as full-day closures.`,
    '- For KRX, verify the announced closure dates and any announced exceptional closure or session changes.',
    '- Record the publication or confirmation date and the reviewer. If an official calendar is not yet published, leave it unresolved.',
    '- If accepted, update the canonical native and legacy calendar through a separate reviewed code change and its normal QA/release flow.',
    '',
    '**Runtime boundary:** an unregistered market/year remains `unknown` and fail-closed. Do not use “weekday means open” estimates or fall back to another year. This workflow only creates or updates this review issue; it never edits the runtime registry, generates dates, commits, or deploys.',
    ''
  ].join('\n');
  return { markdown, digest };
}

function main(argv = process.argv.slice(2)) {
  const year = parseYear(argv);
  const source = readFileSync(calendarSourcePath, 'utf8');
  const result = buildExchangeCalendarReview({ year, source, registry: MARKET_CALENDAR_REGISTRY, checkoutSha: verifiedCheckoutSha() });
  process.stdout.write(`${result.markdown}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`[build-exchange-calendar-review] ${error.message}\n`);
    process.exitCode = 1;
  }
}
