# Desktop user-flow remediation — 2026-08-30

Status: PARTIAL — the bounded code-remediation batch is verified; the whole-product request remains open. This is not all-row, provider, or release certification.
Task baseline: `holistic-user-remediation-20260830` (v54.69, pre-existing dirty work preserved).

## Browser findings before changes

- Home: missing total alongside fabricated zero component values; Fear & Greed 54 alongside “갱신 대기”.
- Screener → NVDA → detail: back target changes to fundamental instead of screener. Stored return context has no reader.
- Screener: unavailable ranks are hidden but still participate in rank sorting; missing values sort first in ascending order.
- Signal: static “LOW · 18” survives; legacy risk composite substitutes VIX for absent independent inputs.
- Quote rendering: null/blank API numeric fields can become zero in the shared DOM adapter.
- Broad walkthrough: historical/source warnings, numerous missing quote/history inputs, inconsistent labels and reference/current narratives remain. Initial route reading does not certify every collapsed section or data row.

## DELETE-LEDGER (recorded before editing)

| Boundary | Remove | New sole owner / evidence |
|---|---|---|
| Home score | `_aioRenderHomeHero` duplicate band/score/component implementation + callers/export | canonical trading-score components → normalized analysis → native home renderer |
| Home sentiment | legacy F&G score/label writes | native score and label from one sentiment input |
| Ticker navigation | `showTicker` back-target and breadcrumb writer | native entity renderer, explicit originating route retained across entity switches |
| Screener return | write-only sessionStorage context | cached route instance retains view state and restores row focus/scroll on return |
| Risk composite | hardcoded LOW/18 and VIX-as-HY/TNX substitution formula | individual observed risk metrics; no duplicate composite score |
| VIX futures inference | VXX/spot daily-return heuristic, dead option-spread/strategy writers and fake futures status card | link to observed sentiment indicators; actual futures curve remains unavailable |
| Ticker dead financial panels | nine unconnected metrics, WATCH button/support placeholders, duplicate Financials tab and placeholder-based evidence probe | selected ticker → existing SEC fundamental report; no second financial calculation |
| Rank ordering | sort by undisplayed/unavailable rank and direction-dependent null position | visible-rank selector shared by rendering and sorting; missing last in both directions |

## Fixed and verified behavior

- Home: score components come from the same canonical presentation as the total; missing remains `—`, observed zero remains zero. Fear & Greed 54 now reads “중립”, not “갱신 대기”. Late snapshot hydration fills useful quotes without a route round trip.
- Discovery: unavailable/rejected ranks are excluded from rank ordering; missing values sort last in either direction. Two selected tickers produce eight metric rows with the same field renderer as the results table. VCP enum labels are Korean.
- Continuity: NVDA search → Why → detail → “← 스크리너” retains NVDA filter, content scroll (observed 528px) and focus on `NVDA 선정 행. Enter로 Why 보기`. Subsequent table refresh preserves row/action focus. Visible and accessible back labels agree.
- Research: `NVDA SEC 재무 보기` opens the existing NVIDIA SEC annual report with period/filing identity. No duplicate financial calculation or provider fetch was introduced for the retired slots.
- Simplification: removed the LOW/18 composite, VXX/spot-return futures inference, nine unconnected financial values, inert WATCH action, duplicate Financials tab, write-only return storage, and duplicate home writer/callers. Useful partial observations remain visible.
- Actual paint: the first new comparison screenshot revealed the old chip-tray flex layout compressing columns. Replaced that layout with a full-width table and explicit hidden-state rule; final 1280×720 screenshot showed separate, readable columns with missingness intact. Mobile work was not performed.

The financial inference deletion follows the distinction between maturity-specific futures prices and spot/ETP returns. Primary references: [Cboe futures term structure](https://www.cboe.com/insights/posts/inside-volatility-trading-is-vix-backwardation-necessarily-a-sign-of-a-future-down-market) and [Cboe VXX product index description](https://www.cboe.com/us/equities/listings/listed_products/symbols/VXX/). These do not certify any displayed current market value.

## Route coverage ledger

Derived from `src/app/routes.js`. Walkthrough used the local running workspace across v54.69→v54.70, then repeated changed flows on v54.70. “Initial read” means visible entry content, not every row, chapter or collapsed section.

| Route | Actual browser scope | Remaining boundary |
|---|---|---|
| home | Initial read + hydration/score/sentiment before/after | All charts/narratives and current numerical truth |
| signal | Initial read; composite/futures writer removal contract | Every expanded risk/cycle section |
| breadth | Initial read | Missing inputs, denominators and all historical series |
| sentiment | Initial read | Full index-horizon/curve narrative semantics |
| briefing | Initial read | Reference/current/LIVE labels and dated calendar narrative |
| technical | Initial read | Usable native OHLCV blocked intermittently by provider errors |
| macro | Initial read | Every transmission/calendar/card conclusion |
| fxbond | Initial read | Every derived spread/carry interpretation |
| themes | Initial read + related-theme navigation | RRG unavailable without relative-price history |
| theme-detail | Inline semiconductor detail: composition/leader buttons and metadata read | Every theme and all derived detail sections |
| ticker | NVDA detail, back, related theme, SEC report link | Other symbols, all chart periods and pattern sections |
| fundamental | Initial read + selected NVDA SEC report | Every company, period/mapping and multi-source detail |
| options | Direct `#options` entry; delayed metric/source/date hydration read | No options-chain feed; not a full options product |
| portfolio | Initial read, empty-state/read-only inspection | No private holdings changes; vault/edit/risk full journey untested here |
| market-news | Initial read | Full article meaning, every filter and live translation |
| screener | Exact search, Why, two-symbol comparison, filter removal, return focus/scroll, final paint | Every saved-screen/editor/export/backtest control and all 873 rows |
| principles | Initial read | Every lesson/node and reference→current application |
| masters | Initial read | Every manager/filing, current ownership inference |
| atlas | Initial read | Every knowledge article/source and relationship |
| guide | Initial read | All instructions vs actual product behavior |

Additional surfaces: glossary opened and VIX search executed; not all 275 definitions validated. Unified AI panel opened, question submitted with no personal key; it terminated with shared-Worker-not-ready guidance, not a successful model answer. No paid key was entered or subscription enabled.

## System-level evidence

| Layer | Verified in this batch | Not certified |
|---|---|---|
| Architecture/state/ownership | Route/module contracts, bounded sole-owner cutovers and removed-writer negative controls | Complete legacy-shell replacement; all charts/narratives are not native |
| Data/analytics | Contract/VM coverage for null/zero, sorting, source/time continuity, pipeline and research model | Every current source value, independent quote reconciliation, all financial assumptions |
| Automation | Refresh/workflow/worker source contracts pass | Scheduler runs, deployed secrets/origins, exact deployed revision |
| AI/research/knowledge | Offline policy/retrieval/chat-continuity and knowledge contracts | Live model/WebSearch result quality and all article semantics |
| UX/accessibility/performance | Actual changed interactions, keyboard return, comparison paint; source budgets/lifecycle gates | Recruited-user testing, assistive technology and full browser performance matrix |

## Gates and tiers

- Baseline: `node scripts/qa-runner.mjs session-start --session holistic-user-remediation-20260830` before changes.
- Impact: `node scripts/qa-runner.mjs affected --session holistic-user-remediation-20260830 --explain`; selects all shared-shell browser groups as well as source groups.
- `node scripts/qa-runner.mjs contracts --no-cache`: **93 PASS, 0 FAIL, 21.0s**.
- After final code/layout/owner changes: `node scripts/qa-runner.mjs contracts --session holistic-user-remediation-20260830`: **90 PASS + 3 content-cache PASS, 0 FAIL, 19.6s**. Report: `.cache/aio-qa/last-run.json` (ephemeral; exact source/VM evidence, not browser certification).
- `node scripts/ci-desktop-continuity-check.mjs`, `node scripts/ci-runtime-contract-check.mjs`: PASS. Two old static expectations requiring the retired fake/dead surfaces were updated to assert deletion and the functional replacement, not weakened to accept both.
- `node scripts/generate-workspace-state.mjs --check`, workspace/knowledge/skill/eval/mirror gates: PASS (included in contracts; mirror commands also run directly).
- `git -c core.safecrlf=false diff --check`: PASS. This command-only setting suppresses line-ending warnings; no Git configuration was changed.
- Final documentation-only closeout regenerated workspace state and passed workspace/knowledge/skill/eval/profile/mirror checks. Knowledge lint retains three historical warnings: encoding damage in the two 2026-07-19 architecture handoff/plan documents and a 49-day-old 2026-07-10 second-pass handoff. These historical documents were not repaired or promoted to current evidence.
- Tiers 1/3/5/7/8/9/10/11/12: source and bounded VM evidence. Tiers 2/4/6/13: actual local desktop inspection of the scope above, **partial**, not full certification. Browser screenshots and DOM/log observations were inspected through the connected in-app Browser, not substituted with static tests.
- `affected` execution / `full --no-cache` browser shards were **not run** in this batch. Source-contract audit plus connected Browser interactions are reported separately; they do not close the full shared-shell release requirement. `external --no-cache` was not run; no deployment claim.

## Open issues — do not lose or call complete

1. **P1 provider continuity**: final browser logs still contain Yahoo batch `Failed to fetch`, proxy cooldowns and `proxy-primary` errors. Some selected quotes recovered during the session, then were missing after fresh load; native chart history/RRG remained incomplete. This is intermittent/partial availability, not a guaranteed working feed.
2. **P1 AI availability**: the tested unauthenticated local chat displays “공유 AI Worker가 준비되지 않았습니다.” Local source PASS does not prove public Worker health, configured origin, quota or successful model/WebSearch response.
3. **P1 semantics/freshness**: initial reads exposed dated reference narrative under current-looking labels. SEC annual-reference freshness must not be confused with latest-quarter completeness. Reconcile these throughout briefing, market, guide and chat rather than hiding observations.
4. **P1 education**: glossary includes unreviewed date-sensitive tax statements, absolute/simplified investment claims and unsourced attributions. All definitions/Principles/Atlas content need source-backed semantic review; registry/article contract PASS is not that review.
5. **P2 product architecture**: large hybrid shell and legacy chart/narrative paths remain. Continue cutover by sole owner and deletion ledger, not metadata-only native promotion or another explanatory rail.
6. **P2 interaction breadth**: exhaustive saved-screen, export, portfolio-vault, chapter/graph, keyboard and historical-chart coverage remains open. One rapid route-switch→input-clear attempt did not retain the clear; explicit filter-chip removal worked. A focused mount/history-input race reproduction is still needed before declaring every input lifecycle closed.
7. **Release**: full local browser matrix, production exact-revision checks and actual-user study remain unverified. No commit, push, Pages/Worker deployment, paid subscription or mobile rebuild occurred.
