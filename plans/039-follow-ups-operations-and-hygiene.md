# 039 — Follow-ups: operations and hygiene left after round 3

Priority P2 · Effort M · Risk LOW–MED · Base `2ce167d91` · Label `v59.98`

Read `plans/_executor-rules.md` in the main checkout first (C:\Projects\AIO\plans\_executor-rules.md). It applies in
full, with three overrides: the base commit is **`2ce167d91`** (use `git reset --keep 2ce167d91`), new assertion
labels cite **`v59.98`**, and pending records go to `_artifacts/pending-records/plan-039/` with `"version": "v59.98"`
and today's date `2026-11-11`.

One more rule for this plan: **do not edit anything under `.github/workflows/`.** If a part can only be fixed in a
workflow file, write down the exact change (file, lines, before/after) in your report and leave the file alone.
Read-only `gh` commands (`gh run list`, `gh run view --log`, `gh issue view`) are allowed in parts B and C; nothing
that writes (no `gh issue close`, no `gh workflow run`).

Six independent parts, one commit per part. If a part hits its STOP condition, report it and continue.

## A. The service worker's precache is actually served, or is removed (test)

Finding from plan 027: `index.html` requests the classic scripts as `./js/aio-*.js?v=<version>`, while `sw.js`
precaches `CRITICAL_SHELL_ASSETS` without `?v=`. `cache.match(request)` compares the query string, so the precached
script entries are probably never served; three boot scripts (`aio-workspace`, `aio-kr-data`, `aio-pages`) are not
precached at all.

1. Establish the facts first by reading `sw.js` end to end: which handler serves a `./js/…?v=` request, what it
   matches against, and what happens offline on a first visit versus a later visit (the runtime handler stores
   versioned responses after the first fetch). Write the result down in your report as a short table: request →
   handler → cache key → served from precache? (yes/no).
2. Decide by what you found, in this order of preference:
   - If the precached script entries are never served: remove the script entries from `CRITICAL_SHELL_ASSETS`
     (keep `./`, `./index.html`, `./version.json`, `./src/app/bootstrap.js` and anything that *is* served) and rely
     on the runtime handler, which already caches versioned shell responses. Fewer bytes at install, same behaviour.
   - If they are served through some path you can show: leave them and add the three missing boot scripts only if
     the same path would serve them.
   Do not add `ignoreSearch` matching: it would serve an old script for a new version.
3. Update `scripts/ci-service-worker-cache-policy-check.mjs` and `scripts/ci-release-revision-check.mjs` assertions
   that name the removed entries (change only the assertions that fail; label them `v59.98`). If a model-check gate
   covers the artifact cache (`git grep -ln "sw.js" -- scripts | head -30`), run it.

STOP: a gate or comment states a reason the scripts must be precached (offline first open) and your table shows the
precache does serve that case.

## B. Why four BLS price series fail in every refresh

`public-data/data.json` `meta.blsFailedSeries` is `["cpi","cpiSa","coreCpi","coreCpiSa"]` in the latest cycles while
FRED succeeds. Find out why, from code and logs only:
1. `git grep -n "blsFailedSeries\|coreCpiSa" -- scripts src | head -40` → the BLS fetch and its series ids.
2. `gh run list --workflow "Refresh market data" --limit 5` (find the exact workflow name with `gh workflow list`)
   and `gh run view <id> --log | grep -i "bls" | head -40` for the failure text.
3. `git log --oneline -8 -- <the BLS fetch file>` and `git log -S"blsFailedSeries" --oneline | tail -3` to see since
   when; check earlier `data:` commits (`git show <sha>:public-data/data.json | node -e …`) for the first cycle that
   lists them.
Then: if the cause is in this repository (a wrong series id, a parser that rejects a valid response, a missing
fallback that exists for other series), fix it with a test that drives the parser with a fixture of the real
response shape from the log. If the cause is outside (the BLS API refusing unauthenticated requests, a daily quota,
an outage, a scheduled release gap), change nothing and report the evidence and what the screen shows meanwhile.

STOP: fixing it needs a secret, a workflow edit or a live call to BLS.

## C. Why the operations alert issues #6 and #14 stay open after the workflow recovered

"Refresh screener and SEC fundamentals" and "Deploy AI proxy" both succeeded on 2026-11-11 after failing; their
alert issues are still open. Read `.github/workflows/operations-alert.yml` (name may differ:
`ls .github/workflows | grep -i "alert\|escalat"`) and the script it runs (`git grep -ln "is failure" -- scripts`),
plus `gh issue view 6` and `gh issue view 14` (comments included) and the "Operations failure escalation" runs after
the successes (`gh run list --workflow "<name>" --limit 6`, `gh run view <id> --log | tail -60`).
Answer: under what condition does an alert issue close, and why did it not happen here?
- If the closing logic lives in a script under `scripts/` and has a defect, fix it with a test (drive the script's
  exported decision function with a fixture: failure → success must yield a close action).
- If the defect is in the workflow YAML, or closing was never implemented, report the exact change needed and stop.

## D. `worker/README.md` matches the deployed per-client cap

The README says `AI_PER_CLIENT_DAILY_CAP` is deployed as 200; `worker/wrangler.proxy.toml` sets it to "1000".
Correct the README to what the toml and the Worker code say (read both; quote the lines in your report). Check the
rest of that README section against the toml for the same kind of mismatch and fix what you can prove.

## E. Two registry entries share the name HPSP

`AIO_TICKER_NAME_REGISTRY` in `js/aio-core.js` gives 352700.KQ and 403870.KQ the same `en`/`kr` name "HPSP", so a
name search always opens the first. Do **not** guess which issuer is which (repository rule: no ticker inference).
Look for evidence inside the repository only: `public-data/` listing or screener artifacts
(`git grep -n "352700\|403870" -- public-data js src | head -30`), KR stock DB names, theme maps.
- If the repository's own listing data names both codes differently, set each registry name to that listed name and
  add a `v59.98` check to the gate that owns the registry (find with `git grep -ln "AIO_TICKER_NAME_REGISTRY" --
  scripts`) that no two entries share an `en` or `kr` name — only if the check passes for the whole registry after
  your fix; otherwise report the other duplicates and do not add the check.
- If the repository cannot tell them apart, change nothing and report what you found.

## F. Four source-text pins that cannot detect the regression they cite

`plans/013-audit-gates-and-producers.md` and the round-1 audit named four assertions that match source text and
would still pass if the behaviour regressed. Find them: read the plan's findings section, and
`git log --all --oneline --grep="013" | head`; if the four are not named there, search the gates the audit covered
for `includes(` / regex checks on `read('src/…')` text whose label cites a behaviour (not a structure), and pick at
most four clear cases. For each: replace the text match with a behavioural assertion (import the module and call
it) labelled `v59.98`, and show it fails when the behaviour is broken (copy the source aside, break it, run, restore
— never `git stash`). Run `node scripts/ci-text-pin-ratchet-check.mjs`; the pin count may only go down (do not run
`--write`).

STOP for a pin: the behaviour cannot be exercised without a browser or network — leave that pin and say so.

## Finish

- `node --check` on every touched file; the gates named in each part exit 0.
- `node scripts/qa-runner.mjs contracts --keep-going`; expected failures only: `generated-state`, `knowledge-lint`
  (generated current state), `refresh-origin-live-data` (same cause), `publish-data-commit` (Windows stub), and
  `syntax` / `narrative-lifecycle-model` timeouts under load (re-run those alone).
- One pending record per part that changed code or docs (defect with `p` where a reader or operator saw a wrong
  result; change-only otherwise). `node scripts/apply-pending-records.mjs --dry-run` exits 0.
- `git diff --check 2ce167d91` clean; everything committed.
- Your report must answer B and C in plain sentences even when nothing was changed.
