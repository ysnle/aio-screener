# AIO Cloudflare Workers

This directory holds both Worker deployments. Only the fast quote plane is described
below; the `aio-proxy` Worker (source: `../cloudflare-worker-proxy.js`, config:
`wrangler.proxy.toml`) serves the CORS data proxy, the optional `/anthropic`
server-key route, and — since v56 — the `/relay` server-side key relay.

## `/relay` — server-side operator-key relay (v56, P1151)

`GET /relay?provider=<fred|bok|kosis>&<params>` fetches a browser-blocked source with
an **operator-held key** so users need no key of their own. FRED blocks the browser by
CORS; BOK ECOS and KOSIS send no CORS headers at all — before `/relay`, all three were
configurable in the sidebar and unreachable in practice.

Design boundaries (all enforced by `node scripts/ci-worker-relay-check.mjs`):

- Upstream host and path are **hardcoded per provider**. The client cannot name a
  destination, so the route cannot be used as an SSRF relay.
- Keys come only from `env.FRED_API_KEY` / `env.BOK_API_KEY` / `env.KOSIS_API_KEY`.
  The browser never sends a key, and the key is redacted from any upstream body that
  echoes it. `/health` reports per-provider presence, never a value.
- Parameters pass a per-provider regex whitelist; anything else is a 400.
- Origin allowlist, optional `AIO_APP_TOKEN`, and a 60/min per-IP limit apply before
  the upstream call. A per-provider daily cap (`RELAY_DAILY_CAP`, default 2000) is
  reserved atomically through `AIO_QUOTA_DO`.
- A missing operator key, a missing quota binding, or a failed upstream returns
  503/502 for **that provider only** — the relay never falls back to a client key.

Deployment: `deploy-ai-proxy.yml` publishes the relay secrets with
`wrangler secret put` (FRED required, BOK/KOSIS optional and skipped when unset) and
smoke-tests `/relay` for a real FRED series, a refused non-allowlisted Origin, and an
unknown provider.

### What these gates are, and are not (v56, P1156)

Every route on this Worker — the `?url=` data proxy, `/anthropic`, `/relay` — now refuses a
request whose `Origin` is not in the allowlist. That is a *minimum* barrier, not
authentication: `Origin` is a request header that any non-browser client can set freely, and
`AIO_APP_TOKEN` (checked only when configured, and exported as a constant by the public
client bundle) is a speed bump against naive scraping. The per-IP rate limiter lives in
isolate-local `Map`s, so its real ceiling is `limit × distinct IPs × live isolates`.

The bounds that are *not* per-isolate:

- the **Workers Rate Limiting bindings** declared in `wrangler.proxy.toml`
  (`RATE_LIMIT_PROXY` 300/min, `RATE_LIMIT_ANTHROPIC` 20/min, `RATE_LIMIT_RELAY` 60/min,
  `period = 60`). These share counters across every isolate **within one Cloudflare location**,
  which is why they replaced the old advice to create a WAF rate limiting rule: `workers.dev`
  has no zone, so that rule was never available to this deployment. They are not global and are
  eventually consistent by design, and they are invisible in the dashboard — observe them as 429s
  in Workers Logs. A missing or throwing binding falls back to the in-isolate `Map`.
- the atomic Durable Object daily cap (`ANTHROPIC_DAILY_CAP`, `RELAY_DAILY_CAP`) — **volume,
  not identity**, and only on `/anthropic` and `/relay`; the generic `?url=` proxy has none.

Because `/relay` spends the operator's FRED/BOK/KOSIS quota, treat a forged-Origin client as
a quota-exhaustion risk up to the daily cap rather than as a blocked attacker.

The read surface of the fast plane is `GET`/`HEAD` only — a `POST /quotes` used to bypass the
CDN cache and perform a KV read per request. `/admin/run` keeps its own `POST` +
`X-AIO-Cron-Token` gate and is dispatched before that method guard.

## AIO fast quote plane

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
   `aio-quotes-prod`. Do not reuse the old `aio-quota-prod` namespace:
   the `aio-proxy` Worker no longer reads a KV `AIO_QUOTA` binding — its daily
   quota counters run on the `AIO_QUOTA_DO` Durable Object
   (`AIOQuotaDurableObject`, SQLite-backed; legacy KV is unsupported and
   fail-closed, per `architecture/worker-endpoints.json`).
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
