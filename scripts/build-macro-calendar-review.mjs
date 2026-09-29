#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function escapeCell(value) {
  return String(value ?? '—').replaceAll('|', '\\|').replace(/[\r\n]+/g, ' ');
}

function safeDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '—';
}

function scheduleDates(value) {
  return Array.isArray(value) ? [...new Set(value.map(safeDate).filter((date) => date !== '—'))].sort() : [];
}

function hasTentativeEvidence(evidence) {
  return evidence?.tentative === true
    || (Array.isArray(evidence?.years) && evidence.years.some((year) => year?.tentative === true));
}

/**
 * Format a preview-only source report. This module never applies a candidate
 * or writes files, and its stable digest excludes run timestamps and asOf.
 */
export function buildMacroCalendarReview(preview) {
  if (!isRecord(preview)
    || preview.schema !== 'aio-macro-calendar-preview.v1'
    || preview.mode !== 'preview-only'
    || !/^\d{4}-\d{2}-\d{2}$/.test(preview.asOf || '')
    || preview.networkRequests !== 0
    || preview.filesWritten !== 0
    || !isRecord(preview.summary)
    || !Array.isArray(preview.candidates)) {
    throw new Error('A valid preview-only macro calendar artifact is required');
  }

  const candidates = preview.candidates.filter((candidate) => candidate?.provided === true);
  if (candidates.some((candidate) => !isRecord(candidate.current) || !isRecord(candidate.proposed))) {
    throw new Error('Provided candidates must contain current and proposed schedule states');
  }
  const missingFiles = Array.isArray(preview.coverage?.annualOfficialFilesMissing)
    ? [...preview.coverage.annualOfficialFilesMissing].sort((a, b) =>
      `${a.calendarId}:${a.year}`.localeCompare(`${b.calendarId}:${b.year}`))
    : [];
  const reviewNeeded = Number(preview.summary.changedCandidates || 0) > 0
    || missingFiles.length > 0
    || candidates.some((candidate) => candidate.sourceEvidence?.status === 'partial-annual-coverage'
      || hasTentativeEvidence(candidate.sourceEvidence))
    || Number(preview.summary.candidatesWithoutFutureDate || 0) > 0
    || Number(preview.summary.omittedEntries || 0) > 0
    || Number(preview.summary.unknownFixtureIds || 0) > 0;

  const stableDigestInput = {
    candidates: candidates.map((candidate) => ({
      id: candidate.id,
      currentNextRelease: safeDate(candidate.current.nextRelease),
      currentLastRelease: safeDate(candidate.current.lastRelease),
      currentScheduleDates: scheduleDates(candidate.current.scheduleDates),
      proposedNextRelease: safeDate(candidate.proposed.nextRelease),
      proposedLastRelease: safeDate(candidate.proposed.lastRelease),
      proposedScheduleDates: scheduleDates(candidate.proposed.scheduleDates),
      changed: candidate.changed === true,
      evidenceStatus: candidate.sourceEvidence?.status || null,
      years: (candidate.sourceEvidence?.years || []).map((year) => ({
        year: Number(year.year),
        status: year.status || null,
        tentative: year.tentative === true
      }))
    })),
    missingFiles: missingFiles.map(({ calendarId, year }) => ({ calendarId, year: Number(year) })).sort((a, b) =>
      `${a.calendarId}:${a.year}`.localeCompare(`${b.calendarId}:${b.year}`)),
    changedCandidates: Number(preview.summary.changedCandidates || 0),
    candidatesWithoutFutureDate: Number(preview.summary.candidatesWithoutFutureDate || 0),
    omittedEntries: Number(preview.summary.omittedEntries || 0),
    unknownFixtureIds: Number(preview.summary.unknownFixtureIds || 0)
  };
  const digest = createHash('sha256').update(JSON.stringify(stableDigestInput)).digest('hex').slice(0, 16);
  const month = preview.asOf.slice(0, 7);
  const sourceTimestamp = preview.sourceEvidence?.collectedAt || 'unavailable';
  const rows = candidates.map((candidate) => {
    const sourceEvidence = candidate.sourceEvidence || {};
    const source = sourceEvidence.sourceUrl || candidate.sourceUrl || candidate.source || 'not provided';
    const currentSchedule = scheduleDates(candidate.current.scheduleDates);
    const proposedSchedule = scheduleDates(candidate.proposed.scheduleDates);
    const addedDates = proposedSchedule.filter((date) => !currentSchedule.includes(date));
    const removedDates = currentSchedule.filter((date) => !proposedSchedule.includes(date));
    const scheduleDiff = [
      addedDates.length ? `added: ${addedDates.join(', ')}` : null,
      removedDates.length ? `removed: ${removedDates.join(', ')}` : null
    ].filter(Boolean).join('; ') || 'no date changes';
    const status = [sourceEvidence.status || 'evidence status unavailable', hasTentativeEvidence(sourceEvidence) ? 'tentative' : null]
      .filter(Boolean).join(', ');
    return `| ${escapeCell(candidate.id)} | ${safeDate(candidate.current.nextRelease)} | ${safeDate(candidate.proposed.nextRelease)} | ${escapeCell(currentSchedule.join(', ') || '—')} | ${escapeCell(proposedSchedule.join(', ') || '—')} (${escapeCell(scheduleDiff)}) | ${candidate.changed ? 'yes' : 'no'} | ${escapeCell(status)} ([source](${escapeCell(source)})) |`;
  });
  const missingRows = missingFiles.length
    ? missingFiles.map(({ calendarId, year }) => {
      const sourceUrl = preview.sourceEvidence?.byCalendarId?.[calendarId]?.sourceUrl;
      const source = sourceUrl ? ` ([official source](${escapeCell(sourceUrl)}))` : '';
      return `- ${escapeCell(calendarId)} ${Number(year)}: annual official calendar file is missing; no date was inferred.${source}`;
    })
    : ['- No annual official calendar files are missing in the requested horizon.'];
  const omitted = preview.candidates.filter((candidate) => candidate?.provided !== true)
    .map((candidate) => `- ${escapeCell(candidate.id)}: no candidate input was supplied; current schedule was retained.`);

  const markdown = [
    `<!-- aio-macro-calendar-review:${month} -->`,
    `<!-- aio-macro-calendar-candidate-hash:${digest} -->`,
    `<!-- aio-macro-calendar-needs-review:${reviewNeeded ? 'true' : 'false'} -->`,
    `## Official macro-calendar candidate review — ${preview.asOf} UTC`,
    '',
    `Candidate collection timestamp: **${escapeCell(sourceTimestamp)}**. This report is a review aid; it makes no runtime or source-file changes.`,
    '',
    `- Candidate differences: **${Number(preview.summary.changedCandidates || 0)}**`,
    `- Calendars without a future date: **${Number(preview.summary.candidatesWithoutFutureDate || 0)}**`,
    `- Omitted runtime calendars: **${Number(preview.summary.omittedEntries || 0)}**`,
    `- Unknown candidate IDs: **${Number(preview.summary.unknownFixtureIds || 0)}**`,
    '',
    '| Calendar | Current nextRelease | Candidate next date | Current schedule dates | Candidate schedule dates and changes | Differs | Source evidence |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
    '### Missing annual official calendars',
    '',
    ...missingRows,
    '',
    '### Omitted calendars',
    '',
    ...(omitted.length ? omitted : ['- None.']),
    '',
    '### Required review before any edit',
    '',
    'Verify each proposed date against its linked primary source. If accepted, update the canonical runtime calendar and regenerate its derived outputs in a separate reviewed code change. A scheduled date is not evidence that a release occurred: preserve `lastRelease` unless the published result or policy decision is independently verified.',
    '',
    '**No automatic apply is enabled.** This report does not update `AIO_MACRO_CALENDAR`, `AIO_MACRO_OFFICIAL_SCHEDULES`, annual calendar files, or the hard `static-db-expiry` gate. Missing or tentative calendar evidence remains explicit; the existing expiry gate continues to fail closed.',
    ''
  ].join('\n');

  return { markdown, digest, month, reviewNeeded, stableDigestInput };
}

async function main(argv = process.argv.slice(2)) {
  if (argv.length !== 2 || argv[0] !== '--preview') {
    throw new Error('Usage: node scripts/build-macro-calendar-review.mjs --preview <preview.json>');
  }
  const previewPath = path.resolve(argv[1]);
  const preview = JSON.parse(await readFile(previewPath, 'utf8'));
  const result = buildMacroCalendarReview(preview);
  process.stdout.write(`${result.markdown}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    process.stderr.write(`[build-macro-calendar-review] ${error.message}\n`);
    process.exitCode = 1;
  });
}
