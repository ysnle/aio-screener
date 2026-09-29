// Build a human-review summary from the generated screener universe mirror.
// The workflow verifies that mirror against canonical SCREENER_DB before invoking
// this file. Importing this module is side-effect free so policy edges can be
// covered by the static-database expiry gate.

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const UNIVERSE_PATH = resolve(ROOT, 'public-data/screener-universe.json');
const DAY_MS = 86400000;

function parseUtcDate(value, label) {
  const time = value instanceof Date
    ? value.getTime()
    : typeof value === 'number'
      ? value
      : Date.parse(String(value ?? ''));
  if (!Number.isFinite(time)) throw new Error(`${label} must be a parseable date`);
  return new Date(time);
}

function parseDateOnly(value) {
  const text = String(value ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error(`--date must use YYYY-MM-DD (received ${text || 'empty'})`);
  }
  const date = new Date(`${text}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw new Error(`--date is not a valid calendar date: ${text}`);
  }
  return date;
}

/**
 * Summarize the generated universe using the same strict age boundaries as
 * ci-static-db-expiry-check.mjs: review when age > staleAfterDays, and the
 * existing hard boundary when age > replaceAfterDays.
 *
 * @param {{meta?: object, universe?: Array<{sym?: string}>}} payload
 * @param {{now?: Date|string|number}} options
 */
export function buildUniverseReview(payload, { now = new Date() } = {}) {
  if (!payload || typeof payload !== 'object' || !payload.meta || typeof payload.meta !== 'object') {
    throw new Error('screener-universe payload.meta is required');
  }
  if (!Array.isArray(payload.universe)) throw new Error('screener-universe payload.universe must be an array');

  const meta = payload.meta;
  const lastBulkUpdate = String(meta.lastBulkUpdate ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lastBulkUpdate)) {
    throw new Error(`meta.lastBulkUpdate must use YYYY-MM-DD (received ${lastBulkUpdate || 'empty'})`);
  }
  const lastBulkDate = parseDateOnly(lastBulkUpdate);
  const nowDate = parseUtcDate(now, 'now');
  const staleAfterDays = Number(meta.staleAfterDays);
  const replaceAfterDays = Number(meta.replaceAfterDays);
  if (!Number.isFinite(staleAfterDays) || staleAfterDays < 0) {
    throw new Error(`meta.staleAfterDays must be a non-negative number (received ${meta.staleAfterDays})`);
  }
  if (!Number.isFinite(replaceAfterDays) || replaceAfterDays < 0) {
    throw new Error(`meta.replaceAfterDays must be a non-negative number (received ${meta.replaceAfterDays})`);
  }

  const symbols = payload.universe.map((row, index) => {
    if (!row || typeof row.sym !== 'string' || row.sym.length === 0) {
      throw new Error(`universe[${index}].sym must be a non-empty string`);
    }
    return row.sym;
  });
  const recordCount = payload.universe.length;
  const uniqueCount = new Set(symbols).size;
  const ageDays = (nowDate.getTime() - lastBulkDate.getTime()) / DAY_MS;

  return {
    asOf: nowDate.toISOString().slice(0, 10),
    lastBulkUpdate,
    ageDays,
    recordCount,
    uniqueCount,
    duplicateCount: recordCount - uniqueCount,
    staleAfterDays,
    replaceAfterDays,
    reviewThresholdPassed: ageDays > staleAfterDays,
    hardBoundaryPassed: ageDays > replaceAfterDays,
  };
}

export function formatUniverseReviewIssue(review) {
  const age = `${review.ageDays.toFixed(1)} days`;
  const reviewStatus = review.reviewThresholdPassed
    ? `**Review is due:** age is greater than ${review.staleAfterDays} days.`
    : `Review threshold not crossed: age is not greater than ${review.staleAfterDays} days.`;
  const hardStatus = review.hardBoundaryPassed
    ? `**Hard boundary exceeded:** age is greater than ${review.replaceAfterDays} days. The existing static-database expiry gate remains fail-closed.`
    : `Hard boundary not crossed: the existing gate still fails when age is greater than ${review.replaceAfterDays} days.`;

  return [
    `<!-- aio-screener-universe-review:${review.asOf.slice(0, 7)} -->`,
    `## Monthly screener universe review — ${review.asOf} UTC`,
    '',
    'This issue records the age and structural counts of the generated static screener universe. It does not change or recommend universe membership.',
    '',
    '| Measure | Value |',
    '| --- | ---: |',
    `| Canonical last bulk update | \`${review.lastBulkUpdate}\` |`,
    `| Age as of ${review.asOf} UTC | ${age} |`,
    `| Records | ${review.recordCount} |`,
    `| Unique symbols | ${review.uniqueCount} |`,
    `| Duplicate symbols | ${review.duplicateCount} |`,
    `| Review threshold | ${review.staleAfterDays} days |`,
    `| Hard boundary | ${review.replaceAfterDays} days |`,
    '',
    reviewStatus,
    '',
    hardStatus,
    '',
    '### Required human review',
    '',
    'A person must review official primary sources before editing the canonical `SCREENER_DB` in `js/aio-data.js`. If a membership change is warranted, make that human-reviewed change there and regenerate `public-data/screener-universe.json` with `scripts/sync-screener-universe.mjs`. This workflow does not fetch external values, suggest constituents, or alter membership. This reminder does not waive, satisfy, or soften the existing hard expiry gate.',
    '',
  ].join('\n');
}

function parseArgs(args) {
  let date = null;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--date') {
      date = args[i + 1];
      i += 1;
    } else if (arg.startsWith('--date=')) {
      date = arg.slice('--date='.length);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return date;
}

async function main(args = process.argv.slice(2)) {
  const dateArg = parseArgs(args);
  const now = dateArg == null ? new Date() : parseDateOnly(dateArg);
  const payload = JSON.parse(await readFile(UNIVERSE_PATH, 'utf8'));
  const review = buildUniverseReview(payload, { now });
  process.stdout.write(`${formatUniverseReviewIssue(review)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[build-universe-review] ${error?.message || error}`);
    process.exitCode = 1;
  });
}
