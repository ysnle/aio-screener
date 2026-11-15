// How the Telegram digest (scripts/fetch-telegram-digest.mjs) treats its channel registry: which channels a run fetches,
// how the run's collection status is judged, and how long a channel has been failing. Pure, so the rules are testable
// without the network; the registry itself (CHANNEL_CATALOG) stays in the producer.
//
// v60.18 (weekly audit 2026-11-15): the digest read "partial" on every run from 10/26 20:52Z because one handle stopped
// serving a public preview — t.me/s/aetherjapanresearch answers with a contact card ("Send Message"), not a post list
// (checked 2026-11-15), so every run threw "first page parsed no posts" (lastPostId frozen at 26057) and the status could
// never be "ok" again; nothing said how long the channel had been failing. A channel that no longer publishes a preview is
// retired in the registry with the date and the reason (`retired: { since, reason }`): not fetched, not expected, still in
// the published catalog marked retired. Deleting `retired` re-enables it. A failing channel that is not retired keeps the
// run partial and now carries `failingSince`, which the artifact gate bounds (TELEGRAM_CHANNEL_FAILING_MAX_MS).

export const TELEGRAM_CHANNEL_FAILING_MAX_MS = 72 * 3600000;

/** Slugs the run fetches (retired channels excluded). */
export function activeTelegramChannels(catalog) {
  return (Array.isArray(catalog) ? catalog : []).filter((row) => row?.slug && !row.retired).map((row) => row.slug);
}

/** The published source catalog; a retired channel carries `retired` so readers and gates see why it is absent. */
export function telegramSourceCatalog(catalog) {
  return (Array.isArray(catalog) ? catalog : []).map((row) => ({ channel: row.slug, role: row.role, region: row.region, evidence: row.evidence,
    publicMirror: `https://t.me/s/${row.slug}`, ...(row.retired ? { retired: { since: row.retired.since, reason: row.retired.reason } } : {}) }));
}

/** ok when every active channel collected, partial when some did, failed when none did. */
export function telegramCollectionStatus(channelRows, active) {
  const expected = Array.isArray(active) ? active : [];
  const rows = (Array.isArray(channelRows) ? channelRows : []).filter((row) => expected.includes(row?.channel));
  const successfulChannelCount = rows.filter((row) => !row.error).length;
  const collectionStatus = expected.length > 0 && successfulChannelCount === expected.length ? 'ok' : successfulChannelCount > 0 ? 'partial' : 'failed';
  return { collectionStatus, successfulChannelCount, activeChannelCount: expected.length };
}

/**
 * The published digest read back by gates: the channel rows the run was expected to collect (rows and catalog entries
 * marked `retired` are published for lineage but not expected), and whether its collection fields agree with them.
 * Gates derive their counts from this instead of a channel-count literal, so retiring a channel needs no gate edit.
 */
export function telegramDigestBoundary(digest) {
  const catalog = Array.isArray(digest?.sourceCatalog) ? digest.sourceCatalog : [];
  const rows = Array.isArray(digest?.channels) ? digest.channels : [];
  const retired = new Set(catalog.filter((row) => row?.retired).map((row) => row.channel));
  const activeRows = rows.filter((row) => row?.channel && !row.retired && !retired.has(row.channel));
  const expected = catalog.length - retired.size;
  const errors = activeRows.filter((row) => row.error).length;
  const successful = Number(digest?.successfulChannelCount);
  const catalogMatchesRows = catalog.length > 0 && catalog.length === rows.length && catalog.every((source) => rows.some((row) => row?.channel === source.channel));
  const status = digest?.collectionStatus;
  const collectionConsistent = activeRows.length === expected && expected > 0 && (status === 'failed'
    || (status === 'ok' && successful === expected && errors === 0)
    || (status === 'partial' && successful > 0 && successful < expected && errors === expected - successful));
  return { catalogCount: catalog.length, expected, activeRows, retired: [...retired], errors, catalogMatchesRows, collectionConsistent };
}

/** When this channel's current failure streak began (carried from the previous digest), or null when it collected. */
export function channelFailingSince(row, previousDigest, attemptedAt) {
  if (!row?.error) return null;
  const prior = (Array.isArray(previousDigest?.channels) ? previousDigest.channels : []).find((ch) => ch?.channel === row.channel);
  return prior?.error && prior.failingSince ? prior.failingSince : attemptedAt;
}

/**
 * Artifact gate: active (not retired) channels that have failed for longer than `maxMs`. A failing row without
 * `failingSince` (digests before v60.18) has an unknown start and counts as over the bound. Retire the channel in the
 * registry or fix its fetch.
 */
export function overdueTelegramChannelFailures(digest, nowMs = Date.now(), maxMs = TELEGRAM_CHANNEL_FAILING_MAX_MS) {
  const retired = new Set((Array.isArray(digest?.sourceCatalog) ? digest.sourceCatalog : []).filter((row) => row?.retired).map((row) => row.channel));
  return (Array.isArray(digest?.channels) ? digest.channels : [])
    .filter((row) => row?.error && !retired.has(row.channel))
    .filter((row) => { const since = Date.parse(row.failingSince || ''); return !Number.isFinite(since) || nowMs - since > maxMs; })
    .map((row) => ({ channel: row.channel, error: row.error, failingSince: row.failingSince || null }));
}
