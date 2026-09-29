#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

function usage() {
  return [
    'Usage: node scripts/preview-macro-calendar.mjs --fixture <json|-> [--source <js>] [--as-of YYYY-MM-DD]',
    '',
    'Reads a schedule fixture and the current macro calendar source, then prints a candidate diff.',
    'This command performs no network requests and writes no files.'
  ].join('\n');
}

function parseArgs(argv) {
  const args = { fixture: null, source: path.join(repoRoot, 'js', 'aio-core.js'), asOf: null };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--help' || key === '-h') return { ...args, help: true };
    if (!['--fixture', '--source', '--as-of'].includes(key)) throw new Error(`Unknown argument: ${key}`);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
    i += 1;
    if (key === '--fixture') args.fixture = value;
    if (key === '--source') args.source = value;
    if (key === '--as-of') args.asOf = value;
  }
  if (!args.fixture) throw new Error('--fixture is required');
  return args;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseIsoDate(value, label) {
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

function findObjectLiteral(source, globalName) {
  const marker = `window.${globalName}`;
  const assignment = new RegExp(`\\bwindow\\.${globalName}\\s*=\\s*`).exec(source);
  if (!assignment) throw new Error(`Could not find object assignment for ${marker}`);
  const open = source.indexOf('{', assignment.index + assignment[0].length);
  if (open < 0) throw new Error(`Could not find object literal for ${marker}`);

  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = open; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (lineComment) {
      if (char === '\n' || char === '\r') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      i += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      i += 1;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  throw new Error(`Unterminated object literal for ${marker}`);
}

function readObjectLiteral(source, globalName) {
  const literal = findObjectLiteral(source, globalName);
  const context = vm.createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false } });
  const value = vm.runInContext(`(${literal})`, context, { timeout: 1000 });
  if (!isRecord(value)) throw new Error(`${globalName} must be an object literal`);
  return value;
}

function normalizedDates(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array of dates`);
  return [...new Set(value.map((date, index) => parseIsoDate(date, `${label}[${index}]`)))].sort();
}

function earliestOnOrAfter(dates, asOf) {
  return dates.find((date) => date >= asOf) || null;
}

function createPreview({ registry, currentSchedules, fixture, asOf }) {
  if (!isRecord(registry) || !isRecord(registry.releases)) throw new Error('AIO_MACRO_CALENDAR.releases is missing or invalid');
  if (!isRecord(currentSchedules)) throw new Error('AIO_MACRO_OFFICIAL_SCHEDULES is missing or invalid');
  if (!isRecord(fixture.schedules)) throw new Error('fixture.schedules must be an object keyed by calendar ID');

  for (const [id, dates] of Object.entries(fixture.schedules)) {
    normalizedDates(dates, `fixture.schedules.${id}`);
  }

  const ids = Object.keys(registry.releases).sort();
  const candidates = ids.map((id) => {
    const entry = registry.releases[id];
    if (!isRecord(entry)) throw new Error(`Current release entry ${id} is invalid`);
    const currentDates = normalizedDates(currentSchedules[id] || [], `current schedule ${id}`);
    const currentLast = entry.lastRelease == null ? null : parseIsoDate(entry.lastRelease, `current release ${id}.lastRelease`);
    const currentNext = entry.nextRelease == null ? null : parseIsoDate(entry.nextRelease, `current release ${id}.nextRelease`);
    const hasCandidate = Object.hasOwn(fixture.schedules, id);
    if (!hasCandidate) {
      return {
        id,
        provided: false,
        sourceEvidence: fixture.sourceEvidence?.byCalendarId?.[id] || null,
        current: { scheduleDates: currentDates, lastRelease: currentLast, nextRelease: currentNext },
        proposed: null,
        changed: false,
        eligibleToApply: false,
        review: 'candidate fixture omitted this calendar; retain current values'
      };
    }

    const proposedDates = normalizedDates(fixture.schedules[id], `fixture.schedules.${id}`);
    // A scheduled date passing is not proof the event actually occurred.
    // Only a separate observation/result feed may update lastRelease.
    const proposedLast = currentLast;
    const nextScheduledDate = earliestOnOrAfter(proposedDates, asOf);
    const proposedNext = nextScheduledDate;
    const proposed = {
      scheduleDates: proposedDates,
      lastRelease: proposedLast,
      nextRelease: proposedNext,
      nextScheduledDate,
      state: proposedNext ? 'candidate-current' : 'candidate-has-no-future-date'
    };
    const current = {
      scheduleDates: currentDates,
      lastRelease: currentLast,
      nextRelease: currentNext
    };
    const changed = JSON.stringify(current) !== JSON.stringify({
      scheduleDates: proposed.scheduleDates,
      lastRelease: proposed.lastRelease,
      nextRelease: proposed.nextRelease
    });
    return {
      id,
      name: entry.name || id,
      source: entry.source || null,
      sourceUrl: entry.sourceUrl || null,
      sourceEvidence: fixture.sourceEvidence?.byCalendarId?.[id] || null,
      provided: true,
      current,
      proposed,
      changed,
      eligibleToApply: false,
      review: proposedNext ? 'preview only; verify candidate against its primary source before use' : 'no future date in fixture; do not replace the existing calendar entry'
    };
  });
  const unknownIds = Object.keys(fixture.schedules).filter((id) => !Object.hasOwn(registry.releases, id)).sort();
  const providedIds = ids.filter((id) => Object.hasOwn(fixture.schedules, id));
  const noFutureDateIds = candidates.filter((item) => item.proposed && !item.proposed.nextRelease).map((item) => item.id);

  return {
    schema: 'aio-macro-calendar-preview.v1',
    mode: 'preview-only',
    asOf,
    networkRequests: 0,
    filesWritten: 0,
    sourceEvidence: fixture.sourceEvidence || null,
    coverage: fixture.coverage || null,
    summary: {
      registryEntries: ids.length,
      providedEntries: providedIds.length,
      omittedEntries: ids.length - providedIds.length,
      unknownFixtureIds: unknownIds.length,
      changedCandidates: candidates.filter((item) => item.changed).length,
      candidatesWithoutFutureDate: noFutureDateIds.length
    },
    unknownIds,
    candidates
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const fixturePath = path.resolve(args.fixture);
  const sourcePath = path.resolve(args.source);
  const [fixtureText, sourceText] = await Promise.all([
    args.fixture === '-' ? readStdin() : readFile(fixturePath, 'utf8'),
    readFile(sourcePath, 'utf8')
  ]);
  const fixture = JSON.parse(fixtureText);
  if (!isRecord(fixture)) throw new Error('fixture must be a JSON object');
  const asOf = parseIsoDate(args.asOf || fixture.asOf, 'asOf');
  const registryObject = readObjectLiteral(sourceText, 'AIO_MACRO_CALENDAR');
  const currentSchedules = readObjectLiteral(sourceText, 'AIO_MACRO_OFFICIAL_SCHEDULES');
  const result = createPreview({ registry: registryObject, currentSchedules, fixture, asOf });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

main().catch((error) => {
  process.stderr.write(`[preview-macro-calendar] ${error.message}\n${usage()}\n`);
  process.exitCode = 1;
});
