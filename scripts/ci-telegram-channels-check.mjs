#!/usr/bin/env node
// v60.18 (weekly audit 2026-11-15): the Telegram digest was "partial (3 channels)" from 10/26 20:52Z to 11/15 because one
// channel's public preview became a contact card and every run threw "first page parsed no posts"; nothing bounded how long
// a channel may fail. This gate checks the status rule (retired channels are not expected) and bounds, over the published
// artifact, how long an active channel may keep failing before it is fixed or retired in the registry.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSections } from './lib/gate-sections.mjs';
import { activeTelegramChannels, telegramSourceCatalog, telegramCollectionStatus, channelFailingSince, overdueTelegramChannelFailures, TELEGRAM_CHANNEL_FAILING_MAX_MS } from './lib/telegram-channels.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const check = (label, fn) => { try { fn(); console.log(`  ok  ${label}`); } catch (error) { failures.push(label); console.log(`  FAIL ${label}\n       ${error.message.split('\n')[0]}`); } };
const report = () => {
  const failed = failures.splice(0);
  if (failed.length) { console.error(`telegram-channels: ${failed.length} failed`); process.exit(1); }
};

// v60.50: the status rule runs on fixtures (code); the bound on the published digest also runs in a data run.
await runSections('telegram-channels', [
['status-rule', async () => {
const catalog = [
  { slug: 'a', role: 'r', region: 'g', evidence: 'e', retired: { since: '2026-10-26', reason: 'gone' } },
  { slug: 'b', role: 'r', region: 'g', evidence: 'e' },
  { slug: 'c', role: 'r', region: 'g', evidence: 'e' }
];
check('v60.18 a retired channel is not fetched and not expected', () => {
  assert.deepEqual(activeTelegramChannels(catalog), ['b', 'c'], 'v60.18 a retired channel is not collected');
  assert.equal(telegramCollectionStatus([{ channel: 'b' }, { channel: 'c' }], activeTelegramChannels(catalog)).collectionStatus, 'ok', 'v60.18 every active channel collected is ok');
  assert.equal(telegramCollectionStatus([{ channel: 'b' }, { channel: 'c', error: 'x' }], ['b', 'c']).collectionStatus, 'partial', 'v60.18 one active channel failing is partial');
  assert.equal(telegramCollectionStatus([{ channel: 'b', error: 'x' }, { channel: 'c', error: 'x' }], ['b', 'c']).collectionStatus, 'failed', 'v60.18 every active channel failing is failed');
  assert.equal(telegramSourceCatalog(catalog)[0].retired.reason, 'gone', 'v60.18 the published catalog says why');
});
check('v60.18 failingSince carries the start of a failure streak and clears on success', () => {
  const previous = { channels: [{ channel: 'b', error: 'x', failingSince: '2026-11-01T00:00:00.000Z' }] };
  assert.equal(channelFailingSince({ channel: 'b', error: 'y' }, previous, '2026-11-15T00:00:00.000Z'), '2026-11-01T00:00:00.000Z', 'v60.18 a continuing failure keeps its start');
  assert.equal(channelFailingSince({ channel: 'c', error: 'y' }, previous, '2026-11-15T00:00:00.000Z'), '2026-11-15T00:00:00.000Z', 'v60.18 a new failure starts now');
  assert.equal(channelFailingSince({ channel: 'b' }, previous, '2026-11-15T00:00:00.000Z'), null, 'v60.18 a success clears the start');
});

report();
}, 'code'],
['published-digest', async () => {
// The registry's retired slugs, from the producer's own CHANNEL_CATALOG (the source of truth the next run publishes).
const producer = readFileSync(resolve(root, 'scripts/fetch-telegram-digest.mjs'), 'utf8');
const registryRetired = new Set([...producer.matchAll(/\{\s*slug:'([^']+)'[^}]*?retired:\{/g)].map((m) => m[1]));
check(`v60.18 no active channel in the published digest has failed for more than ${TELEGRAM_CHANNEL_FAILING_MAX_MS / 3600000}h`, () => {
  const digest = JSON.parse(readFileSync(resolve(root, process.env.AIO_TELEGRAM_DIGEST || 'public-data/telegram-digest.json'), 'utf8'));
  const nowMs = Date.parse(digest.attemptedAt || digest.generatedAt || '') || Date.now();
  const overdue = overdueTelegramChannelFailures(digest, nowMs).filter((row) => !registryRetired.has(row.channel));
  assert.deepEqual(overdue, [], `v60.18 fix the fetch or retire the channel in CHANNEL_CATALOG: ${JSON.stringify(overdue)}`);
});

report();
}, 'data'],
]);
console.log('telegram-channels: all checks passed');
