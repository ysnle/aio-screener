# AIO fast quote plane

`data-plane.js` is the AR-07 Batch 1 Cloudflare Worker. Its scheduled handler
fetches the bounded Tier 0 allowlist every five minutes, validates the shared
`src/data/contracts/market-snapshot.js` contract, and writes `quotes:current`
only after QG-01 reaches 100% and the semantic revision changes. An unchanged
snapshot is a successful observation but a KV no-op; the heartbeat is throttled
to one liveness write per 15 minutes (or an immediate status change). The
normal upper bound is 384 successful KV writes/day and the status-flapping
worst case is 576/day, both below the 1,000/day free-tier limit and its 500/day
warning target. Heartbeats distinguish `checkedAt` (the run observation),
`publishedAt` (a changed `quotes:current` snapshot), and `writtenAt` (the last
heartbeat KV write), so liveness cannot masquerade as a snapshot publication.
Failed runs write a heartbeat and retain the last-known-good KV object. This
deployment is intentionally KV-only; R2 is not required or configured.

Required operator setup:

1. Create a dedicated KV namespace for this Worker, for example
   `aio-quotes-prod`. Do not reuse the existing `aio-quota-prod` namespace:
   the `aio-proxy` Worker uses it for `AIO_QUOTA` counters.
2. Configure repository secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
   and `AIO_QUOTES_KV_ID`.
3. Configure Worker secret `AIO_CRON_SECRET`; verify provider terms/rights and
   set the public `AIO_FAST_QUOTES_URL` repository variable to
   `https://aio-screener-data-plane.zmfhd007.workers.dev` (the currently observed
   deployed data-plane endpoint). Do not point it at the existing
   `https://aio-proxy.zmfhd007.workers.dev` API/Anthropic proxy; the value must
   serve this Worker's `/health` and `/quotes` routes and must not include either
   path suffix.
4. Run the manual `Deploy fast data plane` workflow, then run its smoke check.
5. Keep the watchdog green for seven days. The soak evidence must show at least
   99% scheduled runs, no silent LKG overwrite, and freshness within the Tier 0
   session budget before AR-07 can be marked `VERIFIED_LIVE`.

The repository intentionally contains no Cloudflare credentials, cron secret, or
KV resource ID. Runtime evidence currently confirms the data-plane endpoint's
`/health` and `/quotes` responses with 16/16 Tier-0 coverage, but the release
posture remains `OPERATOR_REQUIRED` until the GitHub variable/secret bindings and
seven-day watchdog soak are evidenced. The endpoint/proxy roles and this evidence
are recorded in `architecture/worker-endpoints.json`.

For a read-only live contract check against the currently configured endpoint,
run `node scripts/ci-fast-plane-live-check.mjs`. It validates only `/health` and
`/quotes`; it cannot manufacture GitHub secret configuration, provider rights, or
the seven-day soak requirement.
