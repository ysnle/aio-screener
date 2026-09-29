# AIO Screener — Knowledge/Atlas/Principles/13F-Masters Audit

Scope: read-only. Repo root C:\projects\AIO (audited via /c/projects/AIO). All line numbers
are as of the commit checked out at audit time (HEAD ~65dd6aa0, 2026-09-27).

## Headline numbers (verified)

- `public-data` total: 596M. `masters` (314M) + `objects` (235M) = 549M = **92% of all
  public-data**, vs the core screener's live payload `data.json`+`history.json`+`screener.json`
  = **3.4M combined** (161x smaller). `.git` is already 1.7G after ~1 month of this subsystem.
- `public-data/masters/managers/` has **37 manager shard files** (not 13 — 13 was the
  original MVP set; catalog has since grown to 37), largest `blackrock-inc.json` = 62M.
- `public-data/objects/masters` object count by commit (git ls-tree, verified):
  44e65a22 (09-10): 333 → 65dd6aa0 (09-25): 1036, i.e. **+703 objects / 15 days ≈ 37/day**,
  which is exactly the manager count (37). **No day shows a drop** — nothing is ever pruned.

## Critical

### C1. Content-addressed store has no dedup or pruning; grows unbounded on pure timestamp churn
`scripts/build-masters-runtime-artifacts.mjs:96-121` builds one `BOUNDED_WEB_PROJECTION` JSON
per manager, hashes it (`createHash('sha256')`) and writes it to
`public-data/objects/masters/{sha256}.json`. The hashed payload embeds
`generatedAt` (line ~99, `holdings.generatedAt`) which is stamped fresh via
`new Date().toISOString()` in `scripts/collect-13f-reference.mjs` **every run**, whether or not
any manager's actual SEC filing changed. The refresh workflow
(`.github/workflows/refresh-data.yml:9` `cron: '13 7 * * *'`) runs this **daily**. Result: even
on a day with zero new 13F filings, all 37 projection JSONs get a new `generatedAt` → new
SHA-256 → new orphan file in `objects/masters`, and the old file is never deleted (no
`prune`/`gc`/`delete` logic exists anywhere in `scripts/*.mjs` — grepped, zero matches besides
an unrelated Durable-Object test). The full per-manager shards in
`public-data/masters/managers/*.json` are rewritten (and re-committed, since they carry the
same `reviewedAt`/`generatedAt` fields) on the same cadence, so both the working tree and every
git blob in history grow daily regardless of real data change.
- Root cause: content-addressing was implemented for integrity, not for its actual
  purpose (dedup by content); embedding a monotonically-changing timestamp field inside the
  hashed payload defeats dedup entirely.
- Projected growth: at steady state (~37 objects/day, current average object ≈ 227KB) that is
  roughly **+3GB/year to `objects/masters` alone**, plus equivalent daily full-file rewrites of
  the 314M `managers/` directory, forever, with no corresponding increase in useful information
  (SEC only publishes new 13F data quarterly, 45 days after quarter-end).
- Fix: (a) hash only the content that matters (rows/values/verification), keep `generatedAt`
  outside the hashed/stored object or in a separate small manifest; (b) skip writing a manager's
  shard/projection/commit at all when its `accession`/rows are unchanged from the last published
  version; (c) add a prune step that deletes `objects/masters/*.json` files no longer referenced
  by any current `managerShards[*].sha256` (simple mark-and-sweep against `holdings-summary.json`
  + `history-index.json`), run every refresh before commit.

### C2. Full 62MB (and other multi-MB) per-manager shard files are committed to git in full every refresh, for data the browser never fetches
Traced the actual runtime fetch path: `src/ui/pages/masters.js:9` sets
`HOLDINGS_URL = './public-data/masters/holdings-summary.json'` (the compact bootstrap), and
`loadManagerRows` (masters.js ~1163-1183) fetches `state.holdings.managerShards[managerId].url`,
which — per `build-masters-runtime-artifacts.mjs:118-122` — points at the **bounded projection**
in `public-data/objects/masters/{hash}.json` (≤512KB, top-200 rows, enforced by
`MANAGER_PROJECTION_MAX_BYTES` at line 32/109-110 which throws if exceeded). The 62MB
`public-data/masters/managers/blackrock-inc.json` full shard is **not referenced by any URL the
web app fetches** — it exists purely as (1) the source `build-masters-runtime-artifacts.mjs`
reads back to build the projection, and (2) the input to
`scripts/recover-masters-holdings-from-shards.mjs` (a disaster-recovery re-hydration path).
Both uses need the data to exist somewhere, but neither needs it to be a permanently-growing,
fully-duplicated-every-day git-tracked file.
- Fix: move the full per-manager row store out of the GitHub Pages repo entirely (R2/S3/a
  build-cache artifact outside git, or at minimum a single git-ignored build cache regenerated
  from `holdings.json`'s already-committed `allHoldings`/`comparisons` for the 7
  `embeddedManagerIds` — see `collect-13f-reference.mjs:225`). For the other 30 managers, only
  `holdings.json`'s per-manager `verification` block plus the bounded projection need to survive
  in the repo; the full raw shard should be reproducible on demand from SEC (it already is, that's
  what `collect-13f-reference.mjs` does) rather than stored as 314MB of committed history.

## High

### H1. No unit-scale validation for the SEC's Jan-3-2023 13F value-reporting change (dollars vs thousands)
Confirmed via web search: SEC required 13F values to be reported to the nearest **dollar**
starting with filings on/after 2023-01-03 (previously nearest **thousand dollars**), applying
retroactively to all periods filed on/after that date. `collect-13f-reference.mjs:341` hardcodes
`valueUnit: 'USD as reported by Form 13F information table'` and `numberValue()` (lines 41-44 in
both `collect-13f-reference.mjs` and `collect-13f-history-rows.mjs`) does no scale detection —
it just strips `$,` and parses. This is **not currently wrong**: `history-index.json`'s
`historyDepthTarget: 12` (quarters) from a 2026-06-30 latest period reaches back only to
~2023-Q3, safely inside the whole-dollar era. But there is **no guard** — no check that
`filedAt >= 2023-01-03`, no sanity check comparing `tableValueTotal` magnitude against
plausible AUM for the manager, no assertion in `ci-13f-currentness-check.mjs`. If
`historyDepthTarget` is ever raised past ~13 quarters (a one-line config change some future
session will plausibly make), pre-2023 filings will silently be treated as whole dollars,
under-counting reported value by **1000x** with no error, no CI failure, and no visible
anomaly (the reconciliation check `valueReconciliationStatus` in
`collect-13f-reference.mjs:~255` only compares parsed row sum to the filing's own
`tableValueTotal`, which would also be in thousands for old filings — internally consistent,
externally wrong by 1000x, so this check would not catch it).
- Fix: assert `periodOfReport >= '2023-01-01'` (or filedAt) before treating `value` as dollars;
  fail loudly (in the style already used for unsupported amendment types,
  `collect-13f-reference.mjs:214`) if history depth ever crosses the boundary, rather than
  silently mis-scaling.

## Medium

### M1. Generated-content literals embedded directly in JS source
`scripts/build-principles-lessons.mjs` is 102,834 bytes; lines 23-151 are a single
`const drafts = [...]` array of ~110 hardcoded Korean-language lesson objects (title,
definition, mechanism, example, counterScenario, verificationQuestion, diagram — all literal
strings), i.e. the file is ~95% authored content wearing a `.mjs` extension, not build logic.
Same pattern likely in `build-nathan-framework-knowledge.mjs`,
`build-integrated-market-ai-framework-knowledge.mjs` (smaller, but same shape: content should
outlive the script). Content itself is original/paraphrased (see "copyright" section below —
no verbatim third-party text found), so this is a maintainability, not legal, issue: content
reviewers must read JS to review copy, diffs mix content edits with code changes, and the script
can't be content-linted independently of being executed.
- Fix: move the lesson literals to `public-data/principles/lesson-drafts/*.json` or per-lesson
  YAML/Markdown with front-matter (id, chapter, sourceIds), and have the `.mjs` script be a thin
  loader/validator (this also directly enables the "reviewed markdown + provenance front-matter"
  target model described below).

### M2. Daily cron for a quarterly, 45-day-lagged data source
`.github/workflows/refresh-data.yml:10` runs the masters lane once/day
(`cron: '13 7 * * *'`, gated further at line 57 to only fire on that specific schedule slot).
13F-HR filings are quarterly with a regulatory 45-day-after-quarter-end deadline; daily polling
buys essentially nothing (new filings appear in bursts around the 45-day deadline, not
continuously) while being the direct cause of C1's daily churn. A weekly cadence (or daily only
in the 10-day window around each quarter's 45-day deadline: ~Feb 14, May 15, Aug 14, Nov 14)
would cut object/shard churn by ~7x-30x with no loss of freshness, since `freshnessStatus` /
`latestAvailablePeriod` labeling (collect-13f-reference.mjs ~370-380) already correctly tracks
"CURRENT_REFERENCE vs STALE_REFERENCE" regardless of how often the job runs.

### M3. sha256 re-verification in-browser has low marginal value versus its cost
`src/data/artifact-cache.js:29-38` (`decodeResponse`) recomputes SHA-256 over the full response
text via WebCrypto for any fetch called with `integrity` (used only for manager projections,
`masters.js:1181`). Since projections are served same-origin over HTTPS from GitHub Pages (TLS
already guarantees transport integrity, and content-addressed filenames mean a
same-origin path collision would require a build-time bug, not network tampering), the
practical failure mode this catches is a **build determinism bug** (non-deterministic
JSON.stringify key order producing a filename/content mismatch) — which is exactly what the
existing throw-on-mismatch logic in `build-masters-runtime-artifacts.mjs:83-84` and
`masters.js:1183` (`manager shard integrity mismatch`) already checks for, redundantly, in two
places (build time and every user's browser, every load). It is not "unnecessary" (defense in
depth against a real, previously-relevant class of bug per the LC-30 comment at
`masters.js:1195-1197`), but doing it client-side on every session is the more expensive of the
two checks for a bug class better caught once, in CI (`ci-masters-contract-check.mjs` already
runs on every commit). Recommend keeping the CI-time check as the primary gate and treating the
browser-side recompute as optional defense-in-depth rather than something to keep expanding to
more artifact types.

### M4. Confidential-treatment (13F-CT) omissions are undocumented as a source of false "NEW" labels
No handling or comment anywhere in `scripts/collect-13f-*.mjs` or `sec-edgar.mjs` for SEC
Confidential Treatment orders (a manager can get temporary non-disclosure for specific
positions, which later appear in a subsequent public filing). This is a fundamental SEC-data
limitation, not fixable from public filings, but the UI's `action: 'NEW'` label
(`collect-13f-reference.mjs` `compareRows`, ~line 90-105) and its Korean UI copy give no caveat
that "NEW" can mean "newly disclosed" rather than "newly purchased." Low engineering cost, real
research-integrity gap: add one line to `verification.policy`/`displayPolicy` and the "근거"
badge copy noting CT-driven appearances are indistinguishable from new purchases in public data.

## Low / Verified-good (do not change)

- **SEC fair-access compliance is solid**: `scripts/lib/sec-edgar.mjs` `requireSecUserAgent()`
  (lines 5-11) rejects placeholder/example contact emails; `createSecClient` (lines 82-113)
  serializes all requests through a single queue with `minIntervalMs: 125` (8 req/s, under SEC's
  10 req/s guidance) and exponential backoff on 403/429/5xx. `ci-13f-currentness-check.mjs`
  enforces both the User-Agent requirement and request serialization at CI time (lines 8-9, 43).
  History collection intentionally throttles further (`collect-13f-history-rows.mjs:15`,
  `minIntervalMs: 1100`).
- **Amendment semantics are handled correctly and conservatively**: `composePeriodFilings`
  (`collect-13f-reference.mjs:190-221`) distinguishes RESTATEMENT (replace) from NEW HOLDINGS
  (additive) amendment types by parsing the SEC cover page's checkbox text
  (`parse13fAmendmentMetadata` in `sec-edgar.mjs:128-142`), and **throws** on any
  unrecognized amendment type rather than guessing (`collect-13f-reference.mjs:214`) — good
  fail-loud design.
- **CUSIP/ticker/sector are deliberately NOT fabricated.** `security-master-reference.json` is a
  53-record, manually-curated mega-cap crosswalk, every record explicitly flagged
  `tickerVerified: false, sectorVerified: false, classificationStatus: 'REFERENCE_ONLY'`.
  `build-13f-issuer-aggregates.mjs` and `build-13f-reference-ticker-index.mjs` only aggregate by
  raw CUSIP/manager/share-type/put-call, flag `ISSUER_NAME_VARIATION`/`CUSIP_FORMAT_REVIEW` for
  human review, and never promote raw issuer text to a verified ticker/sector. This directly
  matches memory principle #29 ("티커 추정 금지" — don't guess tickers).
- **Copyright/licensing risk in the knowledge corpus is low, contrary to the audit's working
  hypothesis.** Scanned `articles.json` (160 units), `research-dossiers.json` (2.1MB),
  `nathan-frameworks.json`, `integrated-market-ai-frameworks.json`, `domain-dossiers.json` for
  any string field >200 characters (a proxy for verbatim-copied passages): found **zero** long
  verbatim text blocks except one 219-char boundary-policy sentence. Content is short,
  structured, paraphrased (definition/mechanism/example/counterScenario fields, each 1-3
  sentences) — consistent with LLM-authored/paraphrased educational material, not scraped
  third-party text.
- **`rosy-license-circumvention` (src/domain/research/supplied-materials.js:115) is a positive
  finding, not a risk**: it is a `status: 'BLOCKED'` entry recording that a supplied X/Twitter
  packet (`0x1Rosy`) contained software-license-circumvention/keygen material, with
  `persistedContent: 'none', integration: 'none'` — the pipeline identified and refused to store
  or use it. `ci-research-flow-contract-check.mjs:138` enforces this stays blocked in CI. Good
  governance; the wider `supplied-materials.js` (953 lines) shows a consistent pattern of
  tracking source rights/read-status per packet (`sourceAudit`, `readableSources`,
  `blockedCount`) rather than blanket-ingesting supplied links.
- **Unreviewed content is honestly labeled to end users, contrary to the audit's working
  hypothesis.** `public-data/knowledge/status-summary.json` (`humanReviewComplete: false,
  publicationReady: false`, 138/455 units `research.required`) is surfaced in the UI, not
  hidden: `src/ui/pages/principles.js:616-628` renders "사람 의미·출처 검수 완료/미완료" (human
  review complete/incomplete) directly under the reading-progress header, and
  `src/ui/pages/atlas.js:1482-1487` renders the same plus an explicit disclaimer that
  "structured drafts and automated validation are not a substitute for independent
  meaning/source review." Per-unit badges (`principles.js:335-354`, `sourceBadge`/
  `researchStatusLabel`) show one of NEEDS_REVIEW/PARTIAL/EDUCATIONAL_REFERENCE_ONLY/etc. per
  lesson with a source link or explicit "no linked source" label — this is granular, not just a
  global banner.

## Value vs. cost (question 5)

- Governance/CI footprint: 23 of 129 `ci-*.mjs` scripts (18%) and ~2,150 of 23,562 CI lines (9%)
  are masters/knowledge/atlas/principles-specific; UI code adds another 4,677 lines across
  `masters.js`/`principles.js`/`atlas.js`/`guide.js`.
- Repo footprint: these subsystems' data (549M masters+objects, plus 11M knowledge, 0.95M
  atlas+principles) is **~161x the size of the core screener's live payload** (3.4M) and is the
  dominant driver of the 2.5G working tree / 1.7G `.git`.
- Given the masters UI only ever serves ≤512KB bounded projections at runtime (verified above),
  essentially all of the 314M+235M cost is **pure audit-trail/build-artifact overhead that
  provides no runtime value to a user** and grows daily without bound (C1/C2). This is the
  single highest-leverage cleanup: fixing C1 (stop hashing volatile timestamps) and moving the
  full shards out of git (C2) would eliminate the great majority of this subsystem's ongoing
  repo-growth cost without touching product behavior at all.
- The knowledge/atlas/principles side is comparatively cheap (11M + <1M, doesn't grow unboundedly
  the way masters does) and is well-governed for what it claims to be (reference-only,
  unreviewed-labeled, no fabricated tickers/sectors, no verbatim third-party text found). Its
  main cost is developer/reviewer friction from content-in-JS (M1), not repo bloat.

## How I would build it vs. current, with migration steps

**13F/masters:**
1. Store one row-level table (manager, cik, cusip, period, value, shares, shareType, putCall,
   accession) in Parquet or SQLite, partitioned by `reportPeriod`, in an object store outside
   git (R2/S3) — not one 62MB JSON blob per manager re-committed daily. The web app already only
   needs bounded top-N views; those can be pre-materialized per manager+period as today's
   `objects/masters` projections, but content-hashed on the **row data only** (exclude
   `generatedAt`) so a no-change quarter produces byte-identical output and zero new commits.
2. Cut the refresh cadence to weekly, with a denser daily check only inside each quarter's 45-day
   filing-deadline window (a simple date-range gate in the workflow's `if:`).
3. Add a prune step (mark-and-sweep against `managerShards`/`historyManagerShards`) before every
   commit so `objects/masters` never holds more live files than the current index references.
4. Add an explicit unit-scale guard (`periodOfReport >= 2023-01-01` before treating `value` as
   dollars) so historyDepthTarget can safely grow later without silently reintroducing the
   thousands-vs-dollars bug.
5. Migration: (a) ship the prune+skip-unchanged logic first (stops the bleeding, no data model
   change); (b) backfill existing `objects/masters` and `managers/*.json` history into the
   external store once, then switch `git add` in the workflow to stop tracking
   `public-data/masters/managers` and `public-data/objects/masters` as full-history git content
   (keep only the current pointer files); (c) add the value-unit guard; (d) lengthen history
   depth only after (c) lands.

**Knowledge/atlas/principles:**
1. Current design (short, paraphrased, per-unit-reviewed-status content in JSON, honestly
   labeled unreviewed in the UI) is largely fine as data modeling; the main change I'd make is
   moving `build-principles-lessons.mjs`'s embedded literals (and equivalents in the
   nathan/integrated-framework builders) into per-lesson Markdown files with YAML front-matter
   (id, chapter, sourceIds, reviewStatus, reviewedAt) so content review doesn't require reading
   JS, and a "publish gate" CI check can diff front-matter status transitions (e.g. block
   `NEEDS_REVIEW → publishable` without a human-set `reviewedBy` field) rather than only checking
   structural JSON shape as today's `ci-knowledge-*`/`ci-principles-*` scripts do.
2. Migration is additive and low-risk: introduce the Markdown+front-matter source alongside the
   existing `.mjs` literals, convert one chapter at a time, keep the JSON output schema
   unchanged so `src/ui/pages/principles.js` needs no changes.

## Unverified / not independently confirmed
- Exact SEC 13F XML schema version history beyond the Jan-2023 dollar-rounding change (confirmed
  via web search, not by reading SEC's XSD directly).
- Whether `ci-masters-browser-check.mjs` / `ci-masters-contract-check.mjs` actually execute in CI
  on every PR (read the scripts' assertions, did not execute them, per the read-only/no-build
  constraint).
- Whether other `build-*-knowledge.mjs` files besides `build-principles-lessons.mjs` have
  comparably large embedded-literal sections (spot-checked `build-nathan-framework-knowledge.mjs`
  at 946 bytes — small; `build-integrated-market-ai-framework-knowledge.mjs` at 6,455 bytes — not
  fully read line-by-line).
- The precise average object size / exact byte-growth rate for `objects/masters` is a computed
  estimate (235MB / 1,036 files), not a per-file audit.
