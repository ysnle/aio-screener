#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const repoRoot = path.resolve(scriptDir, '..');
const FRED_API_BASE = 'https://api.stlouisfed.org/fred';
const FRED_API_DOC = 'https://fred.stlouisfed.org/docs/api/fred/release_dates.html';
const LOOKBACK_DAYS = 45;
const LOOKAHEAD_DAYS = 400;

// The IDs and names are taken from FRED's release catalogue. FOMC, BOK, ISM,
// and non-release events use separately sourced annual official calendars.
const RELEASES = [
  { calendarId: 'us-retail', releaseId: 9, releaseName: 'Advance Monthly Sales for Retail and Food Services' },
  { calendarId: 'us-cpi', releaseId: 10, releaseName: 'Consumer Price Index' },
  { calendarId: 'us-nfp', releaseId: 50, releaseName: 'Employment Situation' },
  { calendarId: 'us-pce', releaseId: 54, releaseName: 'Personal Income and Outlays' }
];
const ANNUAL_CALENDARS = [
  {
    filePrefix: 'us-ism-mfg',
    calendarId: 'us-ism-mfg',
    sourceUrl: 'https://www.ismworld.org/supply-management-news-and-reports/reports/rob-report-calendar/'
  },
  {
    filePrefix: 'us-ism-svc',
    calendarId: 'us-ism-svc',
    sourceUrl: 'https://www.ismworld.org/supply-management-news-and-reports/reports/rob-report-calendar/'
  },
  {
    filePrefix: 'us-fomc',
    calendarId: 'us-fomc',
    sourceUrl: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'
  },
  {
    filePrefix: 'kr-bok',
    calendarId: 'kr-bok',
    sourceUrl: 'https://www.bok.or.kr/eng/main/contents.do?menuNo=400020'
  }
];

function usage() {
  return [
    'Usage: FRED_API_KEY=<registered-key> node scripts/fetch-fred-calendar-candidates.mjs [--as-of YYYY-MM-DD]',
    '',
    'Fetches official FRED release dates and reads annual official calendars into a preview fixture on stdout.',
    'No files are written. Non-release events without a configured official calendar are omitted.'
  ].join('\n');
}

function parseArgs(argv) {
  const args = { asOf: new Date().toISOString().slice(0, 10), help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    if (arg !== '--as-of') throw new Error(`Unknown argument: ${arg}`);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error('Missing value for --as-of');
    args.asOf = value;
    i += 1;
  }
  assertIsoDate(args.asOf, 'asOf');
  return args;
}

function assertIsoDate(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be an ISO date (YYYY-MM-DD)`);
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`${label} is not a real calendar date: ${value}`);
  }
  return value;
}

function shiftDate(isoDate, offsetDays) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

async function getJson(endpoint, params, apiKey) {
  const url = new URL(`${FRED_API_BASE}/${endpoint}`);
  for (const [key, value] of Object.entries({ ...params, api_key: apiKey, file_type: 'json' })) {
    url.searchParams.set(key, String(value));
  }
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new Error(`FRED request failed for ${endpoint}; check network and try again`);
  }
  if (!response.ok) throw new Error(`FRED request failed for ${endpoint} (HTTP ${response.status})`);
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`FRED returned invalid JSON for ${endpoint}`);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(`FRED returned an invalid response for ${endpoint}`);
  }
  return payload;
}

async function loadAnnualOfficialCalendar(calendar, year, asOf) {
  const filePath = path.join(repoRoot, 'content', 'calendar', `${calendar.filePrefix}-${year}.json`);
  let fileText;
  try {
    fileText = await readFile(filePath, 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    return {
      schedule: null,
      evidence: {
        status: 'official-calendar-file-missing',
        sourceKind: 'OFFICIAL',
        source: 'annual official calendar file',
        sourceUrl: calendar.sourceUrl,
        year
      }
    };
  }

  let data;
  try {
    data = JSON.parse(fileText);
  } catch {
    throw new Error(`Invalid JSON in ${path.relative(repoRoot, filePath)}`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)
    || data.schemaVersion !== 'aio-official-schedule.v1'
    || data.calendarId !== calendar.calendarId
    || data.year !== year
    || data.sourceKind !== 'OFFICIAL'
    || data.sourceUrl !== calendar.sourceUrl
    || !Array.isArray(data.dates)
    || (data.tentative != null && typeof data.tentative !== 'boolean')
    || typeof data.dateMeaning !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(data.verifiedAt || '')) {
    throw new Error(`Invalid official calendar contract in ${path.relative(repoRoot, filePath)}`);
  }
  assertIsoDate(data.verifiedAt, `${calendar.calendarId}.verifiedAt`);
  if (data.verifiedAt > asOf) throw new Error(`Official calendar verification date is after asOf: ${path.relative(repoRoot, filePath)}`);
  const dates = data.dates.map((date, index) => assertIsoDate(date, `${calendar.calendarId}.dates[${index}]`));
  if (!dates.length || dates.some((date) => date.slice(0, 4) !== String(year))) {
    throw new Error(`Official calendar dates must be non-empty and belong to ${year}: ${path.relative(repoRoot, filePath)}`);
  }
  if (new Set(dates).size !== dates.length || dates.some((date, index) => index > 0 && date <= dates[index - 1])) {
    throw new Error(`Official calendar dates must be unique and sorted: ${path.relative(repoRoot, filePath)}`);
  }
  return {
    schedule: dates,
    evidence: {
      status: dates.some((date) => date >= asOf) ? 'official-calendar-current' : 'official-calendar-year-elapsed',
      sourceKind: data.sourceKind,
      source: 'annual official calendar file',
      sourceUrl: data.sourceUrl,
      dateMeaning: data.dateMeaning,
      tentative: data.tentative === true,
      year: data.year,
      verifiedAt: data.verifiedAt,
      file: path.relative(repoRoot, filePath),
      firstDate: dates[0],
      lastDate: dates.at(-1)
    }
  };
}

export async function collectAnnualOfficialSchedules(asOf) {
  const firstYear = Number(asOf.slice(0, 4));
  const lastYear = Number(shiftDate(asOf, LOOKAHEAD_DAYS).slice(0, 4));
  const schedules = {};
  const byCalendarId = {};
  const presentFiles = [];
  const missingFiles = [];

  for (const calendar of ANNUAL_CALENDARS) {
    const dates = [];
    const years = [];
    for (let year = firstYear; year <= lastYear; year += 1) {
      const { schedule, evidence } = await loadAnnualOfficialCalendar(calendar, year, asOf);
      if (schedule) {
        dates.push(...schedule);
        years.push(evidence);
        presentFiles.push({ calendarId: calendar.calendarId, year });
      } else {
        missingFiles.push({ calendarId: calendar.calendarId, year });
      }
    }
    if (dates.length) schedules[calendar.calendarId] = [...new Set(dates)].sort();
    byCalendarId[calendar.calendarId] = {
      status: years.length && years.length === lastYear - firstYear + 1 ? 'official-calendar-current' : 'partial-annual-coverage',
      sourceKind: 'OFFICIAL',
      source: 'annual official calendar files',
      sourceUrl: calendar.sourceUrl,
      years
    };
    if (calendar.calendarId === 'us-fomc') {
      byCalendarId['us-fed-rate'] = { ...byCalendarId[calendar.calendarId], calendarId: 'us-fed-rate', derivedFrom: 'us-fomc' };
      if (schedules['us-fomc']) schedules['us-fed-rate'] = schedules['us-fomc'];
    }
  }
  return {
    schedules,
    byCalendarId,
    requestedYears: Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index),
    presentFiles,
    missingFiles
  };
}

function normalizeReleaseDates(rows, expectedReleaseId) {
  if (!Array.isArray(rows)) throw new Error(`FRED release ${expectedReleaseId} has no release_dates array`);
  const dates = [];
  for (const row of rows) {
    if (!row || Number(row.release_id) !== expectedReleaseId) {
      throw new Error(`FRED response contains a row outside release ${expectedReleaseId}`);
    }
    dates.push(assertIsoDate(row.date, `FRED release ${expectedReleaseId} date`));
  }
  return [...new Set(dates)].sort();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const apiKey = process.env.FRED_API_KEY || '';
  if (!/^[a-z0-9]{32}$/.test(apiKey)) {
    throw new Error('FRED_API_KEY is missing or invalid; no request was made');
  }

  const catalog = await getJson('releases', { limit: 1000, order_by: 'release_id', sort_order: 'asc' }, apiKey);
  if (!Array.isArray(catalog.releases)) throw new Error('FRED release catalogue has no releases array');
  const releaseById = new Map(catalog.releases.map((release) => [Number(release.id), release]));
  for (const expected of RELEASES) {
    const observed = releaseById.get(expected.releaseId);
    if (!observed || observed.name !== expected.releaseName) {
      throw new Error(`FRED release catalogue mismatch for ${expected.calendarId}; verify its release ID before updating the mapping`);
    }
  }

  const startDate = shiftDate(args.asOf, -LOOKBACK_DAYS);
  const endDate = shiftDate(args.asOf, LOOKAHEAD_DAYS);
  const schedules = {};
  const byCalendarId = {};

  for (const release of RELEASES) {
    const payload = await getJson('release/dates', {
      release_id: release.releaseId,
      limit: 10000,
      sort_order: 'desc',
      include_release_dates_with_no_data: 'true'
    }, apiKey);
    const fetchedAt = new Date().toISOString();
    const dates = normalizeReleaseDates(payload.release_dates, release.releaseId)
      .filter((date) => date >= startDate && date <= endDate);
    const hasFutureDate = dates.some((date) => date >= args.asOf);
    schedules[release.calendarId] = dates;
    byCalendarId[release.calendarId] = {
      status: hasFutureDate ? 'source-dates-found' : 'no-future-date-in-source',
      sourceKind: 'LIVE',
      source: 'FRED API release/dates',
      sourceUrl: `${FRED_API_BASE}/release/dates`,
      documentationUrl: FRED_API_DOC,
      releaseId: release.releaseId,
      releaseName: release.releaseName,
      fetchedAt,
      firstDate: dates[0] || null,
      lastDate: dates.at(-1) || null,
      futureDateCount: dates.filter((date) => date >= args.asOf).length
    };
  }

  const annual = await collectAnnualOfficialSchedules(args.asOf);
  Object.assign(schedules, annual.schedules);
  Object.assign(byCalendarId, annual.byCalendarId);

  const collectedAt = new Date().toISOString();
  const result = {
    schema: 'aio-macro-calendar-candidate-input.v1',
    asOf: args.asOf,
    sourceEvidence: {
      sourceKind: 'LIVE',
      providers: ['FRED', 'annual official calendar files'],
      documentationUrls: [
        FRED_API_DOC,
        'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
        'https://www.bok.or.kr/eng/main/contents.do?menuNo=400020',
        'https://www.ismworld.org/supply-management-news-and-reports/reports/rob-report-calendar/'
      ],
      collectedAt,
      fredForwardHorizonDays: LOOKAHEAD_DAYS,
      annualCalendarYearsRequested: annual.requestedYears,
      byCalendarId
    },
    coverage: {
      fetchedCalendarIds: RELEASES.map((release) => release.calendarId),
      annualOfficialFilesPresent: annual.presentFiles,
      annualOfficialFilesMissing: annual.missingFiles,
      notConfiguredCalendarIds: ['conf-gtc-dc']
    },
    schedules
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    process.stderr.write(`[fetch-fred-calendar-candidates] ${error.message}\n${usage()}\n`);
    process.exitCode = 1;
  });
}
