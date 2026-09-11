# AIO performance hunt — 2026-09-06

Final version v54.81 (v54.80 first pass, v54.81 continuation). Local Chromium, 1440×900, external requests aborted. Existing dirty changes preserved; QA session perf-hunt-20260906.

## Implemented

- Seven native page modules observe only dependent state slices; explicit legacy data/control events and disposal remain.
- Canonical screener observation WeakMap cache invalidates on row replacement, clock rollback, future activation and exact inclusive freshness expiry. Standalone mutable inputs remain uncached.
- Native breadth reads its store instead of cloning the complete screener state for metadata.
- News ticker extraction rejects absent literal symbols before regex cache access; ordering/context checks remain.
- Market-cut formatting reuses Intl formatter; freshness still recalculates on every read.
- Browser QA found 48 screener date/reference notes at 9px after hydration; increased to 11px (P1036).
- Shared-script preload URLs now match executed versioned URLs (P1037).
- Screener preparation yields after 32 rows; incremental UTF-16/FNV hashing yields in bounded work chunks and preserves legacy identifiers. Primitive quote projections are captured before yielding, cancellation suppresses partial publication, and a bounded string-only ISO cache removes repeated date conversion (P1038).
- Startup no longer refetches/rebuilds an already prepared screener universe (P1038).
- Canonical state facade reads reuse the last deep-frozen defensive copy when its native reference is unchanged. Temporal and mutable legacy readers remain uncached (P1039).

## Measurements

P1037 additionally matches all four shared-script preload URLs to executed versioned URLs. The version gate enforces parity. final-preload.json records the corrected request set.

Verified shared JS requests: 8 → 4. Decoded local response bytes avoided: 3,520,294 (about 3.52 MB). This is not compressed public-CDN transfer size. The final-preload diagnostic overlapped the start of QA, so use its request counts rather than its timing for performance comparisons.

Raw samples: baseline.json, profile.json, after-subscriptions.json, after-cache.json, final.json. Profiling starts at profile.json. These are diagnostic samples, not production percentiles. paintMs measures two animation frames after showPage, not async data/module completion.

Ten unrelated sentiment updates: baseline 59.4 ms / 1100 screener mutations; after subscriptions 1.3 ms / 20 mutations. Remaining changes include shared completeness markers.

Observation coverage self CPU in a 20-route sequence: 5619.875 ms before cache, 9.366 ms after cache. Sampling noise, background hydration and warm-up apply.

First-pass final sample: unrelated updates 1.5 ms / 20 mutations; observation CPU 9.483 ms; shared market-cut CPU 13.872 ms versus 357.754 ms in profile.json. Regex lookup/LRU churn no longer appears among the top 45 self-time frames.

Continuation evidence: boot-profile.json → after-cooperative.json has maximum observed boot task 937 → 97 ms; final-v5481.json records 110 ms in a second profiled sample. Initial screener artifact requests fell from two to one. These profiled samples are independent of the production-style boot gate.

Hash experiment on 873 prepared rows: legacy serialization+hash median 643 ms versus incremental traversal 329 ms (Node diagnostic). 500 deterministic cases and a complete provider snapshot match the old identifier contract; cancellation and mutation-isolation fixtures pass. Profiling and Node timings are not public-site performance guarantees.

| Route | Before paint opportunity ms | v54.81 ms |
|---|---:|---:|
| home | 227 | 18 |
| signal | 280 | 64 |
| breadth | 243 | 23 |
| sentiment | 530 | 34 |
| briefing | 615 | 292 |
| technical | 322 | 38 |
| macro | 241 | 22 |
| fxbond | 232 | 32 |
| themes | 411 | 38 |
| theme-detail redirect | 443 | 50 |
| ticker | 472 | 56 |
| fundamental | 394 | 34 |
| options | 426 | 23 |
| portfolio | 271 | 37 |
| market-news | 251 | 49 |
| screener shell (module still loading) | 317 | 53 |
| principles | 228 | 50 |
| masters | 215 | 19 |
| atlas | 202 | 33 |
| guide | 267 | 80 |

This single before/after sequence establishes directional evidence only. The screener row must not be described as data-ready latency. Module readiness and functional flows are verified separately by existing browser gates.

First-pass boot gates still missed the strict long-task SLO (756–823 ms maximum). That prompted the v54.81 cooperative preparation changes. Final gate evidence is recorded below; performance budgets were not relaxed.

## Structural assessment and remaining work

| Surface | Assessment |
|---|---|
| home, signal, technical | Selective analysis/sentiment invalidation applied. Legacy chart/narrative ownership still prevents independent bundle retirement. |
| breadth, macro, fxbond | Common observation scans eliminated; explicit data/history events preserved. |
| sentiment | Already slice-subscribed; shared timeline cache reduces route overhead. |
| briefing, market-news | Feed depends on news slice; ticker matching avoids regex cache churn. |
| themes, theme-detail | Themes has about 3800 descendants. Detail is a compatibility redirect into themes; its standalone inactive node is not a certified separate page. Progressive card/detail rendering needs search/accessibility parity first. |
| ticker, fundamental, options | Entity and portfolio dependency updates retained; unrelated store writes no longer redraw. |
| portfolio | Only portfolio slice triggers native table/chart state updates. Existing vault gate verifies its workflows. |
| screener | Unrelated work and duplicate startup hydration eliminated; readiness/hash preparation now yields with coherent inputs and cancellation. Worker extraction is conditional on future measured scale, not required solely because JSON is used. |
| principles, masters, atlas, guide | No demonstrated local hotspot justified speculative changes to content or selection semantics. Browser lifecycle coverage is not human research certification. |
| Initial shell | About 1.89 MB HTML, 1.65 MB core JS and 1.00 MB data JS remain. Route modules are lazy, but bootstrap statically imports broad domain/provider/AI dependencies. Staged compatibility-owner and route-fragment extraction remains necessary for large cold-load reductions. |
| Public facade | Unchanged canonical reads now reuse frozen snapshots. Future narrow projections can further reduce retained/copied bytes; globally removing defensive copies exposes canonical state to mutation. |
| Delivery | Local no-store server does not measure public CDN compression, cold WAN, service-worker rollout or real-user percentiles. |

Recommended implementation order for deeper reconstruction:

1. Split bootstrap work by actual capability ownership, then extract static route fragments. Preserve cold deep links, offline upgrade behavior, error fallbacks and single DOM writers. Acceptance: lower cold transferred/parsed bytes and the existing 200 ms long-task target, with no route missing content.
2. Extend narrow read-only projections where consumers need only metadata. Repeated unchanged full-state copies are already addressed in v54.81. Acceptance: equal output plus mutation-isolation tests and fewer retained/cloned bytes.
3. Render themes progressively using the selected view. Acceptance: full search/filter universe, keyboard focus, detail restoration and screen-reader semantics retained; reduced active DOM, not merely hidden content.
4. Consider a worker only if larger real universes exceed the budget after cooperative processing. v54.81 already preserves snapshot hashes, pre-yield quotes and cancellation while reducing long tasks; extra worker serialization needs measurable justification.

These are unresolved structural opportunities, not implemented migrations. The measurements justify removing repeated work now; they do not establish that every research article or every dynamic provider path is correct.

## Validation

Targeted ESM unit and observation/decision gates passed. Final affected run: 77 PASS, 8 CACHED, 1 FAIL, 0 SKIP (121 seconds). The sole failure was a Windows UNKNOWN error writing the accessibility evidence file; rerun-failed then passed that gate (1 PASS, 0 FAIL, 7.3 seconds; qa-final.json). Thus all 86 selected gates have passing or cached passing evidence across the run and targeted retry. Headless executed 109 groups; browser checks cover architecture, vertical flows, route soak, resilience, viewport, critical surfaces, vault and accessibility. Static/contract checks are not manual content review.

Final v54.81 boot gate: PASS / TARGET_COMPLIANT, FCP 268 ms, maximum long task 100 ms, total long tasks 208 ms in the 2000 ms observation window, route 97 ms. Evidence: ../boot-interaction-report.json (2026-09-06T07:31:51.700Z). This is local Chromium evidence, not deployed field performance. git diff --check passed. No commit/push/deployment. Full semantic content certification and live performance remain unverified.

## Product and structural quality review — scope clarification

The requested outcome includes page usefulness, content quality, functional completeness, data meaning, correctness, maintainability and runtime efficiency. This pass was weighted toward runtime work; it does not constitute exhaustive improvement of all those dimensions.

| Quality dimension | Concrete work/evidence in this pass | Remaining acceptance work |
|---|---|---|
| Function correctness | Hash parity against the previous algorithm, freshness boundary and clock rollback tests, mutable Date handling | Independently validate each research formula and its financial assumptions; parity alone cannot prove a model correct |
| Data consistency | Provider captures quote primitives before yielding; cancelled/superseded work cannot publish partial data | Cross-provider reconciliation and period/unit comparability across all content |
| State integrity | Frozen defensive facade snapshots and reference invalidation; dependent page subscriptions preserve explicit legacy events | Complete route ownership migration so native and legacy code do not share presentation responsibilities |
| User experience | Screener reference text enlarged; route, refresh and lifecycle checks; reduced update disruption | Manual task-based review of search, comparison, explanation, keyboard use and decision flow on each page |
| Research content | Existing semantic/research-flow contracts exercised; no unsupported claim of editorial validation | Article-by-article review of accuracy, duplication, provenance, usefulness and consistency between narrative and metrics |
| System maintainability | Shared slice subscription helper, bounded caches, injectable hash scheduler and explicit cancellation | Split bootstrap and shell by capability; each module needs a single owner and clear failure/loading contracts |

Reconciliation was regenerated from existing inputs without changing their observation timestamps. Its result remains PARTIAL: 6 MATCH, 14 PARTIAL and 2 BLOCKED categories. Passing the reconciliation gate certifies truthful status reporting, not complete data quality. Provider diversity, permitted data access and missing specialized fields remain real product limitations.

The field registry currently names quality.margin as “영업/순이익률” and the provider passes factor.margin into that shared field. This is a concrete semantic ambiguity to resolve before claiming uniform cross-company comparability: trace the producer, identify the numerator and reporting period, then expose a consistent definition or distinct fields. This review has not established that every stored value mixes definitions, and did not relabel values without that evidence.

For page-specific reconstruction, the structural table above gives the route scope. The highest-value next quality work is (1) a source/period/unit contract for comparable financial fields, (2) a complete user task and explanation review for each route, and (3) separation of native/legacy presentation ownership with preserved loading, empty, error and restore states. These are pending work, not completed migrations.
