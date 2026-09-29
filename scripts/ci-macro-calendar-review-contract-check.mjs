#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { buildMacroCalendarReview } from './build-macro-calendar-review.mjs';

const workflow = readFileSync('.github/workflows/macro-calendar-review.yml', 'utf8');
const fetcher = readFileSync('scripts/fetch-fred-calendar-candidates.mjs', 'utf8');
const previewBuilder = readFileSync('scripts/preview-macro-calendar.mjs', 'utf8');
const errors = [];
let assertions = 0;
const check = (label, ok) => { assertions += 1; if (!ok) errors.push(label); };

const fixture = {
  schema: 'aio-macro-calendar-preview.v1',
  mode: 'preview-only',
  asOf: '2026-09-28',
  networkRequests: 0,
  filesWritten: 0,
  sourceEvidence: {
    collectedAt: '2026-09-28T10:00:00.000Z',
    byCalendarId: {
      'us-pce': { status: 'source-dates-found', sourceUrl: 'https://api.stlouisfed.org/fred/release/dates' },
      'us-fomc': {
        status: 'partial-annual-coverage',
        sourceUrl: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
        years: [{ year: 2027, status: 'official-calendar-current', tentative: true }]
      },
      'kr-bok': { status: 'partial-annual-coverage', sourceUrl: 'https://www.bok.or.kr/eng/main/contents.do?menuNo=400020' }
    }
  },
  coverage: { annualOfficialFilesMissing: [{ calendarId: 'kr-bok', year: 2027 }] },
  summary: {
    registryEntries: 2,
    providedEntries: 2,
    omittedEntries: 0,
    unknownFixtureIds: 0,
    changedCandidates: 1,
    candidatesWithoutFutureDate: 0
  },
  candidates: [
    {
      id: 'us-pce',
      provided: true,
      changed: true,
      current: { scheduleDates: ['2026-09-30', '2026-10-30'], nextRelease: '2026-09-30', lastRelease: '2026-07-30' },
      proposed: { scheduleDates: ['2026-09-30', '2026-11-02'], nextRelease: '2026-09-30', lastRelease: '2026-07-30' },
      sourceEvidence: { status: 'source-dates-found', sourceUrl: 'https://api.stlouisfed.org/fred/release/dates' }
    },
    {
      id: 'us-fomc',
      provided: true,
      changed: false,
      current: { scheduleDates: ['2026-10-28', '2026-12-09'], nextRelease: '2026-10-28', lastRelease: '2026-09-17' },
      proposed: { scheduleDates: ['2026-10-28', '2026-12-09'], nextRelease: '2026-10-28', lastRelease: '2026-09-17' },
      sourceEvidence: {
        status: 'partial-annual-coverage',
        sourceUrl: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
        years: [{ year: 2027, status: 'official-calendar-current', tentative: true }]
      }
    }
  ]
};

const report = buildMacroCalendarReview(fixture);
const laterRun = buildMacroCalendarReview({
  ...fixture,
  asOf: '2026-09-29',
  sourceEvidence: { ...fixture.sourceEvidence, collectedAt: '2026-09-29T10:00:00.000Z' }
});
const changedDate = structuredClone(fixture);
changedDate.candidates[0].proposed.nextRelease = '2026-10-30';
const changedReport = buildMacroCalendarReview(changedDate);
const changedLaterSchedule = structuredClone(fixture);
const fomcCandidate = changedLaterSchedule.candidates.find((candidate) => candidate.id === 'us-fomc');
fomcCandidate.proposed.scheduleDates = ['2026-10-28', '2026-12-16'];
fomcCandidate.changed = true;
changedLaterSchedule.summary.changedCandidates = 2;
const changedLaterScheduleReport = buildMacroCalendarReview(changedLaterSchedule);
const tentativeOnly = structuredClone(fixture);
tentativeOnly.summary.changedCandidates = 0;
tentativeOnly.coverage = { annualOfficialFilesMissing: [] };
tentativeOnly.candidates = [structuredClone(fomcCandidate)];
tentativeOnly.candidates[0].changed = false;
tentativeOnly.candidates[0].sourceEvidence = {
  status: 'official-calendar-current',
  sourceUrl: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
  years: [{ year: 2027, status: 'official-calendar-current', tentative: true }]
};
tentativeOnly.candidates[0].current.scheduleDates = [...tentativeOnly.candidates[0].proposed.scheduleDates];
tentativeOnly.candidates[0].proposed.scheduleDates = [...tentativeOnly.candidates[0].current.scheduleDates];
const tentativeOnlyReport = buildMacroCalendarReview(tentativeOnly);
const partialCoverageOnly = structuredClone(tentativeOnly);
partialCoverageOnly.candidates[0].sourceEvidence = {
  status: 'partial-annual-coverage',
  sourceUrl: 'https://www.bok.or.kr/eng/main/contents.do?menuNo=400020'
};
const partialCoverageOnlyReport = buildMacroCalendarReview(partialCoverageOnly);
const collectorStep = workflow.slice(workflow.indexOf('- name: Collect official FRED and annual-calendar candidates'))
  .split('\n      - name:')[0];
const issueStep = workflow.slice(workflow.indexOf('- name: Update or create this month’s review issue'));

check('P1304/R605/QA-DATA-48 review report records proposed and configured release dates',
  report.reviewNeeded && report.markdown.includes('2026-09-30') && report.markdown.includes('us-pce'));
check('P1304/R605/QA-DATA-48 report keeps missing and tentative calendar evidence explicit',
  report.markdown.includes('kr-bok 2027') && report.markdown.includes('tentative')
    && report.markdown.includes('https://www.bok.or.kr/eng/main/contents.do?menuNo=400020')
    && report.markdown.includes('No automatic apply is enabled'));
check('P1304/R605/QA-DATA-48 digest ignores collection time but changes with candidate dates',
  report.digest === laterRun.digest && report.digest !== changedReport.digest);
check('P1305/R605/QA-DATA-48 later schedule changes appear in the report and stable digest even when nextRelease is unchanged',
  report.digest !== changedLaterScheduleReport.digest
    && changedLaterScheduleReport.markdown.includes('2026-12-16')
    && changedLaterScheduleReport.markdown.includes('removed: 2026-12-09')
    && changedLaterScheduleReport.markdown.includes('added: 2026-12-16'));
check('P1305/R605/QA-DATA-48 tentative-only annual evidence still requests human review',
  tentativeOnlyReport.reviewNeeded && tentativeOnlyReport.markdown.includes('tentative'));
check('P1305/R605/QA-DATA-48 partial annual coverage still requests human review without other differences',
  partialCoverageOnlyReport.reviewNeeded);
check('P1304/R605/QA-DATA-48 report preserves lastRelease and static hard expiry boundary',
  report.markdown.includes('preserve `lastRelease`') && report.markdown.includes('hard `static-db-expiry` gate'));
check('P1304/R605/QA-DATA-48 candidate table has the same number of cells as its header',
  report.markdown.split('\n').filter((line) => line.startsWith('|')).slice(0, 4)
    .every((line) => line.split('|').length === 9));
check('P1304/R605/QA-DATA-48 report refuses any fixture that claims network or file writes',
  (() => {
    try { buildMacroCalendarReview({ ...fixture, filesWritten: 1 }); return false; } catch { return true; }
  })()
  && (() => {
    try { buildMacroCalendarReview({ ...fixture, networkRequests: 1 }); return false; } catch { return true; }
  })());
check('P1304/R605/QA-DATA-48 collector requires FRED secret before its first request and discloses no key',
  fetcher.includes("if (!/^[a-z0-9]{32}$/.test(apiKey))")
    && fetcher.includes('FRED_API_KEY is missing or invalid; no request was made')
    && !/console\.(?:log|error)\([^\n]*apiKey|console\.(?:log|error)\([^\n]*url\.href/.test(fetcher));
check('P1304/R605/QA-DATA-48 preview exposes missing annual-file coverage without applying candidates',
  previewBuilder.includes('coverage: fixture.coverage || null')
    && previewBuilder.includes('eligibleToApply: false'));

check('P1304/R605/QA-DATA-48 workflow is weekly, main-only, least-privilege and concurrency-safe',
  workflow.includes("cron: '7 10 * * 1'")
    && workflow.includes("if: github.ref == 'refs/heads/main'")
    && workflow.includes('contents: read')
    && workflow.includes('issues: write')
    && !workflow.includes('contents: write')
    && workflow.includes('group: weekly-macro-calendar-review')
    && workflow.includes('cancel-in-progress: false'));
check('P1305/R605/QA-DATA-48 secrets are scoped to the collector and issue steps that consume them',
  collectorStep.includes('FRED_API_KEY: ${{ secrets.FRED_API_KEY }}')
    && !collectorStep.includes('GH_TOKEN:')
    && issueStep.includes('GH_TOKEN: ${{ github.token }}')
    && !issueStep.includes('FRED_API_KEY:')
    && !/^      (?:GH_TOKEN|FRED_API_KEY):/m.test(workflow)
    && workflow.includes('workflow_dispatch:')
    && workflow.includes('review_date:')
    && !/echo[^\n]*FRED_API_KEY/.test(workflow));
check('P1304/R605/QA-DATA-48 workflow supports fixed-date dispatch without disclosing FRED credentials',
  workflow.includes('workflow_dispatch:')
    && workflow.includes('review_date:'));
check('P1304/R605/QA-DATA-48 workflow collects, previews and formats before publishing review evidence',
  workflow.indexOf('scripts/fetch-fred-calendar-candidates.mjs') >= 0
    && workflow.indexOf('scripts/preview-macro-calendar.mjs') > workflow.indexOf('scripts/fetch-fred-calendar-candidates.mjs')
    && workflow.indexOf('scripts/build-macro-calendar-review.mjs') > workflow.indexOf('scripts/preview-macro-calendar.mjs')
    && workflow.indexOf('Upload review evidence') > workflow.indexOf('Build monthly human-review report'));
check('P1304/R605/QA-DATA-48 workflow uses pinned actions and bounded artifact retention',
  /actions\/checkout@[0-9a-f]{40}/.test(workflow)
    && /actions\/setup-node@[0-9a-f]{40}/.test(workflow)
    && /actions\/upload-artifact@[0-9a-f]{40}/.test(workflow)
    && workflow.includes('retention-days: 30'));
check('P1304/R605/QA-DATA-48 workflow upserts by month and digest without reopening unchanged closed reviews',
  workflow.includes('aio-macro-calendar-review:${REVIEW_MONTH}')
    && workflow.includes('aio-macro-calendar-candidate-hash:${CANDIDATE_DIGEST}')
    && workflow.includes('gh issue edit')
    && workflow.includes('gh issue create')
    && workflow.includes('matching candidate review is already closed; leaving it closed'));
check('P1305/R605/QA-DATA-48 issue lookup falls back to an exact month-title match when body markers are not indexed',
  workflow.includes('in:title \\"Official macro calendar review: ${REVIEW_MONTH}\\"')
    && workflow.includes('select(.title == $title)'));
check('P1304/R605/QA-DATA-48 candidate workflow cannot edit runtime calendars or stage/deploy code',
  !/git\s+(?:add|commit|push)\b/.test(workflow)
    && !/scripts\/apply-macro-calendar|write.*AIO_MACRO_(?:CALENDAR|OFFICIAL_SCHEDULES)/i.test(workflow));

if (errors.length) {
  console.error(`Macro calendar review contract failed (${errors.length}):`);
  errors.forEach((error) => console.error(` - ${error}`));
  process.exit(1);
}
console.log(`Macro calendar review contract OK: ${assertions} assertions, source-only candidates, no auto-apply.`);
