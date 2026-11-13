# 048 — Universe review from the repository's own listings; registry junk; stale names; one flaky gate

Priority P2 · Effort M · Risk MED · Label `v60.02`

Read `plans/_executor-rules.md` in the main checkout first (C:\Projects\AIO\plans\_executor-rules.md). It applies in
full with these overrides: use the base commit your brief names, new assertion labels cite **`v60.02`**, pending
records go to `_artifacts/pending-records/plan-048/` with `"version": "v60.02"` and date `2026-11-13`; and for this
plan only you **may** run `node scripts/sync-screener-universe.mjs` (an offline rebuild of the mirror from
`js/aio-data.js`; it fetches nothing) and edit `public-data/screener-universe.json` through it, and you may edit
the prose of `_context/RULES.md` and `_context/QA-CHECKLIST.md` in Part C only.

Five independent parts, one commit each. A part that hits its STOP is reported and skipped.

## Part A — the overdue universe review, from evidence in the repository

`SCREENER_DB` in `js/aio-data.js` (meta at the top: `lastBulkUpdate:'2026-10-13', staleAfterDays:30`) is the curated
universe (1,159 rows). Its review is 31+ days old; the screens now show a notice. Repository rule: **no ticker
guessing** — a change needs a source in the repository's published data.

1. Write a read-only script `scripts/universe-review-evidence.mjs` (keep it: the monthly review workflow can use
   it later) that prints a JSON report from files already in `public-data/`:
   - US rows whose symbol is absent from `public-data/us-listings.json` (the exchange listing directory; read its
     shape and its as-of date first) → candidates for removal (delisted/renamed);
   - S&P 500 constituents in `public-data/sp500-weights.json` (IVV holdings: ticker, name, GICS sector, weight)
     that are not in the universe → candidates for addition, with name and sector from that file;
   - universe rows marked `index: 'SP500'` that are not in the weights file → index label candidates;
   - KR rows absent from `public-data/kr-index-weights.json` are **information only** (that file is not a full
     listing).
   Handle share-class spellings (`BRK.B` / `BRK-B`) by reading how each file spells them; never fuzzy-match names.
2. Apply only what the evidence decides, in `js/aio-data.js`:
   - remove a US row absent from the listings file **and** absent from the weights file;
   - add a missing S&P 500 constituent with `sym`, name and sector taken from the weights file and the row shape
     of its neighbours (read 5 existing SP500 rows; fields the source cannot fill stay as the neighbours leave them
     for an unknown — do not invent a memo, signal or Korean name; if the row shape requires a Korean name, leave
     the English name and say so);
   - fix an `index` label only when the weights file contradicts it.
   Then set `lastBulkUpdate` to `2026-11-13`, run `node scripts/sync-screener-universe.mjs`, and add the report
   summary (counts, the as-of dates of the two source files) to your pending record.
3. Run every gate that reads the universe (`git grep -ln "screener-universe\|SCREENER_DB" -- scripts/ci-*.mjs`),
   `node scripts/ci-static-db-expiry-check.mjs` and `node scripts/ci-data-pipeline-contract-check.mjs`. A gate that
   pins the old count is changed only in that assertion, labelled `v60.02`.

STOP: more than 25 changes in total, or the listings file is older than 10 days, or a gate requires fields the
sources cannot provide — apply nothing, commit the script and the report (`_artifacts/universe-review-20261113/
report.json`), and say what a human must decide.

## Part B — registry entries the repository cannot stand behind

`AIO_TICKER_NAME_REGISTRY` in `js/aio-core.js`: 352700.KQ and 403870.KQ both carry the name "HPSP"; only 403870.KQ
is named HPSP anywhere else in the repository (js/aio-data.js, public-data/screener-universe.json,
public-data/kr-index-weights.json, js/aio-kr-data.js). 413640.KQ has en 'Hyundai Mobis Test' and kr 'NEXTIN'.
For each of 352700.KQ and 413640.KQ: search the repository's data (`KR_STOCK_DB`, universe, weights, theme maps,
`public-data/**`) for the code. If no data file names the code, delete the registry entry (an identity no source
supports) — a search for that name then offers candidates instead of opening a wrong issuer. If a data file names
it, set the registry name to that file's name. Add a `v60.02` check to the gate that owns the registry
(`git grep -ln "AIO_TICKER_NAME_REGISTRY" -- scripts/ci-*.mjs`): no two entries share an `en` or a `kr` name — only
if it passes for the whole registry after your fix; otherwise list the remaining duplicates and do not add it.

## Part C — names that no longer exist

- `scripts/ci-worker-anthropic-check.mjs` was renamed `scripts/ci-worker-openai-contract-check.mjs` (v59.97).
  In `_context/RULES.md` and `_context/QA-CHECKLIST.md` replace the old script name with the new one wherever it
  is a gate reference or a `verify_by` (the lines the 028 report listed: QA-CHECKLIST ~913, ~935, ~1011, ~1189,
  ~2581, ~2658; RULES ~1712–1771, ~2022, ~2145 — locate by grep). Leave dated handoff documents and
  BUG-POSTMORTEM history alone. Run `ci-ledger-integrity-check`, `ci-knowledge-lint-check`,
  `ci-workspace-contract-check`.
- `worker/README.md` line ~9 says the month budget is "at most $20"; the deployed mode is a target
  (`AI_MONTHLY_BUDGET_MODE = "target"` in `worker/wrangler.proxy.toml`; AGENTS.md: a target that warns, not a
  cap). Reword to what the toml and code do.

## Part D — BLS footnotes

`scripts/lib/macro-sources.mjs` `normalizeBlsSeriesResponse`: footnotes arrive as `[{}]`; `filter(Boolean)` keeps
the empty object, so every series reads `observationStatus: 'footnote-present'`. Keep a footnote only when it has
a non-empty `code` or `text`. Test in `scripts/ci-data-pipeline-contract-check.mjs` (`v60.02`): `[{}]` → no
footnote status; `[{ code: 'P', text: 'Preliminary' }]` → footnote present. Check who reads `observationStatus`
(`git grep -n "footnote-present" -- src scripts js`) and report whether any screen changes.

## Part E — one flaky browser check

`scripts/ci-theme-research-browser-check.mjs:93` asserts the Korean theme detail is in view right after a jump
(`top` between −4 and 400) and failed once in a full run with `top 2948` while passing alone: the scroll had not
finished. Replace the immediate read with a bounded wait for the same condition
(`page.waitForFunction` on the element's `getBoundingClientRect().top`, timeout 5 s), then assert; keep the bounds.
Run the gate three times in a row; report the three results.

## Finish

`node --check`; `qa-runner contracts --keep-going` (expected failures only: generated-state, knowledge-lint and
refresh-origin-live-data for that cause, browser-data-pin-drift — also expected after Part A changes the mirror —
publish-data-commit, syntax / narrative-lifecycle-model timeouts, re-run alone); pending records (A change-only
with the report summary, B defect, C change-only, D defect, E change-only); `apply-pending-records --dry-run`
exits 0; committed.
