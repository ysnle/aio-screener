# AIO structural repairs — 2026-08-30

Status: WARN — local contracts PASS; browser verification PARTIAL/BLOCKED. No commit, push or deployment.

## Implemented

- Screener: every required field must be present; public delayed research data is usable without claiming certified redistribution rights. Exact ticker searches exclude unrelated memo matches. Boot-deferred quote requests are retried; missing quotes are labeled.
- Fundamentals: request epochs, old-report/radar reset, no automatic AI call, SEC duration quarters for revenue/net income. Comparison is not industry-neutral. [SEC API specification](https://www.sec.gov/search-filings/edgar-application-programming-interfaces).
- Technical: shared symbol for main/native/multi-timeframe views, late-response guards, actual Yahoo day/week/month intervals, empty-array handling and observed-date/source labels. Price reference lines use the selected ticker, not an unrelated index.
- Calculations: real OHLCV EMA/RSI/candle observations; synthetic market-cap ADR removed. Missing radar factors are not filled with 50. VIX sample rank is not ticker IV rank or a one-year distribution.
- UI: theme detail separated from hidden legacy wrapper; RRG-missing themes remain available for exploration; optional AI reference map and connection controls collapsed; Telegram repetition restricted to news/briefing; unsupported mobile compatibility claims removed. Existing desktop-only QA and defensive responsive CSS retained.
- Automation: new research-flow regression gate, P1004/R570/QA-FLOW prevention entries, partial version-sync recovery with explicit source/target versions (P1005).

## Data-refresh scope inventory

DEFERRED means not refreshed/re-certified here, not healthy/current. No market value or timestamp was invented or manually refreshed.

| # / category | Before / source | Action / target | Status |
|---|---|---|---|
| 1 Version | v54.67 local | v54.68 bump script | UPDATED |
| 2 DATA_SNAPSHOT | existing artifact | no headline refresh | DEFERRED |
| 3 Sentiment | existing artifact | no new values | DEFERRED |
| 4 Breadth | existing artifact | no new values | DEFERRED |
| 5 Macro/VIX series | display-date history | ISO observation dates | UPDATED |
| 6 Sector/rotation | directional prescriptions | relative comparison | UPDATED |
| 7 Index/ETF quotes | client fetch | preserve no-public-raw-quote boundary | DEFERRED |
| 8 Korea macro/index | existing artifacts | no refresh | DEFERRED |
| 9 News sources/keywords | existing registry | unchanged | DEFERRED |
| 10 Telegram allowlists | repeated consumers | news/briefing only; allowlist unchanged | UPDATED |
| 11 Ticker/aliases | alias all-match bug | exact ticker/alias filtering | UPDATED |
| 12 Themes | hidden detail wrapper | independent detail | UPDATED |
| 13 ETF/cross-asset | existing artifacts | unchanged | DEFERRED |
| 14 Fundamentals | instant flow frame; stale selection | duration frame and epochs | UPDATED |
| 15 Screener | 846/873 factors, 2026-08-28 | readiness/search repairs; no new artifact | UPDATED |
| 16 Chat numeric context | existing system | no fresh numerical claims | DEFERRED |
| 17 Technical | timeframe mismatch; synthetic inputs | exact intervals, observed calculations | UPDATED |
| 18 Options | invented rank/range | actual VIX sample only | UPDATED |
| 19 Portfolio presets | existing | unchanged | DEFERRED |
| 20 UI dates/values | render time as update | observed dates on changed surfaces | UPDATED |
| 21 Public generated data | existing snapshots | reconciliation status recomputed from unchanged source observations; no raw quote republication | UPDATED (derived audit only) |
| 22 Workflow/current docs | existing baseline | P/R/QA + generated state | UPDATED |

## Research integration

The first visible X bookmark page was reviewed as candidate material, not authoritative market evidence. Transient chart calls, secondary capex narratives and future-performance assertions were not imported as current facts. No private bookmark collection was copied into public artifacts. No paid source was enabled.

## Verification

- Focused PASS: syntax (354 JS/ESM files), screener-workbench contracts, 24 research-flow VM/static boundary assertions.
- Final source-contract run: 86 executed PASS + 3 content-keyed cached PASS, 0 FAIL, 0 SKIP, 19.5 seconds. Report: `.cache/aio-qa/last-run.json`. This is not a browser/release PASS.
- Initial affected run: 84 PASS + 3 cached, 2 FAIL, 15 browser gates skipped by phase barrier, 20.3 seconds. Failures were (1) stale derived reconciliation report and (2) a test extractor still expecting the old two-argument Yahoo helper. Both passed exact `rerun-failed` in 1.5 seconds; the final source-contract run passed again.
- Local desktop browser partial: exact NVDA query returns one result; 703/873 rows have every selected required field; explicit NVDA search shows SEC data; invalid input clears native identity; technical selection/title/price-reference placeholder move to NVDA. Secondary radar residue found during this check was subsequently fixed and covered by VM tests.
- Browser/provider blocked: direct Yahoo/proxy OHLCV calls failed/circuit breakers opened. Missing data remained visibly unavailable. Subsequently Browser URL policy rejected local-page reaccess. No alternate browser or indirect browser-control workaround was attempted. Theme-detail/final-radar/settings paint, options observation presentation and full route replay therefore remain unverified at the final revision.
- Not verified: all providers, fresh all-category data audit, predictive validity/profitability, recruited-user usability, mobile, shared-shell release certification or deployed exact-SHA parity.

## Commands and evidence boundaries

- `node scripts/qa-runner.mjs affected --session structural-rebuild-20260829 --explain`
- `node scripts/qa-runner.mjs affected --session structural-rebuild-20260829`
- `node scripts/build-reconciliation-status.mjs` — recomputed truth checks; did not refresh source prices/filings or their observation dates.
- `node scripts/qa-runner.mjs rerun-failed`
- `node scripts/qa-runner.mjs contracts --files <exact task-owned source paths>` — the report stores the complete explicit selection.
- `node scripts/bump-version.mjs v54.68 --resume-from v54.67` — repaired permission-interrupted synchronization without an extra version increment.
- `node scripts/generate-workspace-state.mjs --write` and the generated/workspace/knowledge/skill/mirror checks; task-owned `git diff --check` passed.

The bug-fix/data-refresh/integrate/post-edit-qa workflows drove source-to-screen provenance, explicit deferred data categories, conservative research promotion, regression tests and separate static/browser/external evidence. Existing dirty changes were preserved. No deployed claim, new paid dependency, external write or investment-performance claim was made.
