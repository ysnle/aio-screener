# v54.69 structural continuity repairs

Status: WARN — implemented code with local/offline evidence; current-revision browser/live/release certification unavailable. No commit, push, deployment, paid service, usage reset or private bookmark publication occurred. Existing dirty work preserved; baseline: `complete-remediation-20260830`.

## Implemented

- Shared proxy: full request cache identity, Yahoo ticker/interval validation, opt-in stale fallback retaining timestamps, bounded storage, sensitive-query exclusion, upstream-isolated circuit/single probe/Retry-After and body-read deadlines. Public market relay configuration is independent from AI health.
- Observation integrity: missing change/volume/ranges stay unknown. Removed HYG-derived HY spread, daily-gold→weekly overwrite, synthetic VIX distribution, FX visit-to-visit daily returns and Stooq open/volume substitutions. Actual source time precedes provider preference.
- Quote scope: removed historical 500+ catalogue fanout from Yahoo refresh; main quote refresh passes requested Korean symbols to Naver. Screener catalogue/data coverage was not deleted.
- Automation: source-plane failure isolation, real shared FRED partial-cycle classifier preserving last-success, atomic string/URL file writes, config-only regeneration without changing observed health/data timestamps. Atomicity is per file, not a multi-file transaction.
- AI: cancellable per-page request epochs/retries/stream callbacks; empty/timeout search fallback; bounded/retryable shared knowledge loading; object citations, safe HTTPS links, hostname validation and usable partial evidence. Both chat panels pass research state to suppress duplicate searches. Unified preparation timeout no longer dereferences null. One/few available quotes no longer cause a blanket price-answer blackout; timestamps are still required for current claims.
- Desktop: clear/recover values and lineage together, preserve null vs zero, inject documentRef through macro calls, use observational RRG labels. A proposed repeated global navigation rail was rejected and removed.

The bug-fix/data-refresh/post-edit-qa workflows required root-cause regressions, explicit unrefreshed categories and separate static/browser/live evidence. Three Luna agents stopped at usage limits; partial patches were reviewed and completed or rejected, not counted as completed independent audits.

## Prior 14-area judgment: remaining boundaries

| Area | Changed/retained here | Still open |
|---|---|---|
| Product intent | Free-source desktop research scope | Real-user trading usefulness/profitability not proven |
| System/trust planes | Separate AI and data route configuration | External availability/rights certification |
| Frontend/layers | Canonical chart/relay paths | Legacy shell/facade migration |
| UI/information flow | Missing/recovery and concise labels | All-page manual user walkthrough |
| Data/provenance | Identity, null, time and partial-success contracts | Current values/all-row semantic certification |
| AI/privacy/security | Search, evidence, per-page lifecycle, knowledge | Live providers; full unified clear/cancellation lifecycle not recertified |
| Performance/lifecycle | Less fanout, bounded failures | Browser boot/network P95 and real-device UX |
| Accessibility | Text alternatives preserved | Manual screen reader/focus/reflow |
| QA efficiency | Batch + exact failed-gate retry | Release browser certification |
| Internal automation | Producer/config/regression wiring | Remote scheduler execution not observed |
| Knowledge/workspace | Generated state and contracts | Every encyclopedia sentence not human-reviewed |
| GitHub/Pages | Existing CI contracts retained | No deploy/exact-SHA observation |
| Cloudflare/provider | Independent public data config | Worker implementation/deployment unchanged; live success unverified |
| Release/operations | Evidence boundaries preserved | 30-day SLO/operator promotion |

Route registry metadata currently marks 20 lifecycle, 20 renderer, 20 data, 8 chart and 1 narrative owners as native. These counts do not mean every route is fully native or functionally certified. Old charter prose counts are not used as current evidence.

## Data-refresh inventory — skill's 22 categories

UPDATED means code/contract changes, not refreshed market values. All existing source observations keep their previous dates. The source registry uses a separate 22-category taxonomy; its artifact-presence gate does not certify freshness.

| # / category | Surface/source | Before → target/action | State |
|---|---|---|---|
| 1 Version | version/SW/cachebusters | v54.68 → v54.69, bump script | UPDATED |
| 2 DATA_SNAPSHOT | local fallback/field bridge | Existing values retained; daily/weekly mixing removed | UPDATED code |
| 3 Sentiment | CNN/Cboe/AAII artifacts | Existing dates unchanged; LKG semantics | DEFERRED live |
| 4 Breadth | universe/history | Existing values and coverage retained | DEFERRED |
| 5 VIX/HY/rates/macro | Yahoo/FRED/Treasury | Synthetic/blank-zero paths → observed/null/partial | UPDATED |
| 6 Rotation | native themes | Prescriptions → descriptive relative strength | UPDATED |
| 7 Index/ETF fallback | transport/cache | Partial key/stale promotion → exact identity/time | UPDATED |
| 8 Korea macro/index | Naver/BOK/KOSIS | Main quote request scope; missing change not zero | UPDATED code; live deferred |
| 9 News sources/keywords | registry/RSS | Lists unchanged; common relay | UPDATED transport |
| 10 Telegram allowlists | public channels | Allowlist unchanged; common relay validation | UPDATED transport |
| 11 Ticker maps | existing registries | No new alias; request validation/deduplication | UPDATED request contract |
| 12 Themes/tables | native pages/dated rows | No source table refresh | DEFERRED data |
| 13 ETF/cross-asset | FX/Stooq/Yahoo | Unknown baseline → reference price/null daily change | UPDATED |
| 14 Fundamentals | SEC/optional-key adapters | Previous duration/selection fixes retained; no filings refreshed | DEFERRED |
| 15 Screener | SEC/price factors | Unknown OHLCV + atomic output; rows unchanged | UPDATED producer |
| 16 Chat numeric context | local observations | Count blackout/collection freshness → observation-based context | UPDATED |
| 17 Technical | canonical chart helper | Exact intervals/shared transport/unknown ranges | UPDATED |
| 18 Options | VIX/Cboe reference | Actual VIX sample, no new IV surface | UPDATED |
| 19 Portfolio presets | private local data | Unchanged; no holdings mutation | DEFERRED |
| 20 UI values/dates | native market/briefing | Clear stale lineage; preserve observation time | UPDATED |
| 21 Public generated files | config/producer output | Config-only generation; data observations unchanged | UPDATED config only |
| 22 Workflow/current docs | refresh/QA/state | Continuity gate, P1006–1009/R571, generated state | UPDATED |

No subscriber/paid/approved-exchange-only feeds enabled. Existing optional-key adapters were not claimed as newly working/free services.

## Verification

- Focused proxy VM: 45 PASS; research-flow: 24 VM/static assertions PASS; chat resilience and desktop renderer tests PASS. Data continuity: 52 PASS, including actual CSV/parser/atomic-file fixtures.
- Initial contracts: 88 executed PASS + 3 cached PASS, 2 FAIL, 0 skipped, 19.4 s. Removed an orphan timeout helper and updated the last-good-artifact assertion for the atomic writer. Exact rerun: 2 PASS, 0 FAIL, 0.5 s.
- Final contracts: 89 executed PASS + 4 content-keyed cached PASS, 0 FAIL, 0 skipped, 18.423 s. The additional shared-preparation assertion was updated for its AbortSignal argument and passed exact rerun (0.3 s) before this final batch. `git diff --check`: exit 0, no whitespace issues. `.cache/aio-qa/last-run.json` stores exact gates/fingerprints. Local contracts are not release certification.
- Tier 13/browser: blocked by prior local Browser URL policy denial; no alternate browser/headless/CDP bypass. Historical browser artifacts are not this revision's evidence.
- External/live: not run. Free relay/AI credentials, quotas/origins, deployed revision, scheduled refresh and current data values remain unverified.

Commands: `node scripts/qa-runner.mjs affected --session complete-remediation-20260830 --explain`; `node scripts/qa-runner.mjs contracts --session complete-remediation-20260830 --jobs 4`; `node scripts/qa-runner.mjs rerun-failed`; focused `ci-proxy-continuity-check`, `ci-data-continuity-check`, `ci-chat-resilience-check`, `ci-desktop-continuity-check`, `ci-research-flow-contract-check`; `node scripts/build-operations-status.mjs --config-only`; `node scripts/bump-version.mjs v54.69`; `node scripts/generate-workspace-state.mjs --write`; generated/workspace/knowledge/skill/mirror checks via contracts profile; `git diff --check`.

Technical references: [MDN Retry-After](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Retry-After), [MDN AbortController abort](https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort). Neither is market-data evidence.
