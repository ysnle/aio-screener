# AIO Screener — #screener Deep Audit (route group 3)

Live site tested: https://ysnle.github.io/aio-screener/#screener
Live version at test time: **v56.33** (built 2026-09-24T22:44:00+09:00) — from `/version.json`.
Local code inspected: `C:\projects\AIO` (per memory, local is ~18 versions ahead of last-known live v48.79; here live is already v56.33, so local/live gap should be re-checked — not verified in this session, out of scope).
Test date: 2026-09-27. All findings below are from live-site interaction + direct code reading, marked **[UNVERIFIED]** where inferred only from code.

---

## 1. Route purpose & first-screen clarity

`#screener` = "퀀트 스크리너" (Quant Screener), described in its own subtitle as "일봉 기반 멀티팩터 상대 랭킹 · 모멘텀 + 추세(Kalman) + 저변동 + VCP · 헤더 클릭으로 정렬" (daily-bar multi-factor relative ranking). First screen (`index.html` `page-screener` DOM, native renderer `src/ui/pages/screener.js`) is **not** a results table — it is, in order:
1. A large disclaimer block ("투자 면책 고지") + an acknowledgement gate (`확인했습니다` button) that must be dismissed every fresh load.
2. A dense provenance paragraph (session dates, SEC coverage counts, identity-metadata-missing counts, model-validation status) — reads like an internal audit log, not user-facing copy.
3. A "스크리너 작업공간" (workbench) block: saved-screen picker, definition editor, run button, result funnel (유니버스/필드 준비/조건 통과/데이터 부족).
4. A visual condition builder ("시각 조건 빌더").
5. Preset chips (굉형/모멘텀/스윙/가치/저리스크/고급 필터).
6. Only **then** the filter row (지수/섹터/분류/시총/검색/컬럼 preset) and the results table.

**Finding — first-screen clarity: FAIL for a family trader.** A user who wants "show me stocks" has to scroll past ~6 screens of workbench/provenance/funnel UI (confirmed by scroll-through, see §6 Mobile) before seeing a single ticker. None of steps 1–4 exist in Finviz, TradingView, or a Korean MTS 조건검색 — all of those open directly on a sortable results grid. This is symptomatic of the tool's real design center: a research/QA instrument (screen definitions, run provenance, field-readiness), not a screener a family member opens to find a trade idea.

---

## 2. Full element inventory (key elements; not exhaustive of all 22 columns)

### 2.1 Column registry (`src/ui/pages/screener.js:39-62`, `SCREENER_COLUMN_REGISTRY`)

| key | label | source | logic | verdict |
|---|---|---|---|---|
| watchlist | 관심·비교 | UI-only (star + compare buttons) | `readWatchlist`, `onCompare` | KEEP |
| rank | 상대 점수 | `computeFactorRanks` composite z → midrank percentile (`factor-ranks.js:609-621`) | tie-aware percentile 0–100 over **eligible** rows only; **not** a probability | KEEP but needs plain-language relabel ("상대 점수" reads like a trading score to a beginner) |
| grade | 등급 | `rankGrade()` (`screener.js:254-257`) | A≥80,B≥65,C≥50,D≥35,F<35 off the same visible rank | KEEP |
| sym/name | 종목 | universe identity | `identity.name` from `screener-universe.json`, falls back to "이름 미수신" | KEEP |
| sector | 섹터 | universe identity | free-text field, see §4 taxonomy bug | FIX (taxonomy) |
| momentum/trend/lowvol/value/quality | 모멘텀/추세/저변동/밸류/퀄리티 | `factorScores[key]`, `factor-ranks.js` z→0-100 (`zToNormalizedScore`) | sector-relative z-score scaled, **not** a percentile despite looking like one (0-100) | KEEP, but `factorScoreMeaning` disclosure exists only in the metadata string, not in a column tooltip a first-time user would see — FIX (surface it in-cell) |
| price | 가격 | live quote overlay if `priceEnvelopeComplete`, else artifact price | shows "미수신" until live overlay is admissible (see §5) | FIX — see §5 |
| ret1m/ret3m/ret6m | 1M/3M/6M | `factor.ret1m/3m/6m` from Yahoo 1y adjusted-close | simple return | KEEP |
| rsi | RSI | `factor.rsi` | Wilder RSI (per CODE-MAP) | KEEP |
| pctSma50 | vs 50MA | `factor.pctSma50` | KEEP |
| kalman | 추세 신뢰도 | `factorScores.kalman` | labeled `researchOnly: true` in registry but **no visible "연구" badge appears in the discovery preset** because the column isn't in the `discovery` preset — only in `trend`; when it *is* shown the header does append a "연구" mark (`screener.js:735-740`) | KEEP |
| vcpScore | VCP 구조 | `factor.vcpScore/vcpStage` | `researchOnly: true`, stage label via `vcpStageLabel()` | KEEP |
| mcap | 시총 | `live.mcap` (lenient, `liveRow()`) for **display**, but the **filter** uses a much stricter `baseRow.mcap` gated on `liveEvidenceEligible` (`providers/screener.js:399`) | **two different mcap computations disagree — see §5, critical bug** | FIX (critical) |
| entry | 상대 상태 | `entryTiming()` (`screener.js:132-147`) — rule cascade over rank/RSI/setupProfile | explanation-only heuristic labeled 연구 | KEEP but rename ("상대 상태" is unclear vs. "entry timing") |
| signal | 구조 분류 | `row.signal` (BUY/SELL/WATCH/HOLD) — **is always `null` in the provider** (`providers/screener.js:348`: `signal: null`) so this column is **dead** in the native path; it only gets a value through some other (legacy) path **[UNVERIFIED beyond code read]** | every row observed live showed "—" for 구조 분류 — CUT or wire it up |
| news | 최신뉴스·근거 | `row.newsMemo` + "Why" button | shows "근거 미수신" almost everywhere in this snapshot | KEEP (Why button is genuinely useful, see §3) |

### 2.2 Presets (`COLUMN_PRESETS`, `screener.js:64-71`) and filter presets (top preset chips)

- Column presets: discovery / fundamentals / trend / risk / events / all — reasonable segmentation, but **discovery (default) omits price-adjacent columns like value/quality**, so a beginner's very first view can't judge "is this cheap." MERGE candidate: default should probably be closer to `fundamentals` or a new hybrid.
- Filter preset chips (균형/모멘텀/스윙/가치/저리스크/돌파 관찰): these swap the **definition** (screen engine query), not just column sets — confirmed live (clicking them changes 활성 필터 and 조건 통과 counts). This dual "preset chips also filter, column dropdown also presets" is confusing: two unrelated "preset" concepts share the word 프리셋/컬럼 in adjacent UI.

### 2.3 Filters (`filterRows`, `screener.js:190-245`)

| filter | id | works live? | notes |
|---|---|---|---|
| 지수 (index) | scr-market | **Works** (tested: KOSPI → 103/873, matches universe count exactly) | KEEP |
| 섹터 | scr-sector | not deeply tested; dropdown lists both "Materials" and "Basic Materials", "Consumer"/"Consumer Cyclical"/"Consumer Defensive" — duplicated/inconsistent taxonomy from `screener-universe.json` (verified via local `node` count: Technology 187, Consumer 74, Consumer Defensive 40, Consumer Cyclical **1**, Materials 41, Basic Materials **3**) | FIX (data cleanup) |
| 구조 분류 (signal) | scr-signal | Filters on a field that's always null (see §2.1 `signal`) — **dead filter, returns nothing meaningful** [needs live confirm, but code shows `signal: null` unconditionally in provider] | FIX/CUT |
| 시총 (cap) | scr-cap | **BROKEN — confirmed live.** MEGA (≥$1T) → 0 results. LARGE ($10B~1T) → 0 results. Tested against a universe that includes AAPL/MSFT/AMZN-class names. Root cause in code: `filterRows` cap branch requires `finite(row.mcap) != null` where `row.mcap` is only set when `liveEvidenceEligible` (decision-grade quote with `rightsId`, `allowedUseCeiling==='decision'`, quality `decisionUse===true`, `priceEnvelopeComplete===true`, fresh ≤15min) — a bar the live quote pipeline essentially never clears in this session, since `nativeMarketCap` (the reference-only fallback) is explicitly excluded from the filter check (`providers/screener.js:399-400,412`). This is a **direct, more severe consequence of the previously-known "live price overlay never activates" bug**: it doesn't just make price cells show "미수신," it makes the entire market-cap filter non-functional for every tier. | **CRITICAL FIX** |
| RSI 하한/상한, 3M 수익률 하한 | scr-rsi-min/max, scr-min-mom | code looks correct (`finite()` guards); not exhaustively tested live | presumed OK |
| 워치리스트만 | scr-watchlist-only | not tested (no items in watchlist this session) | — |
| 검색 (free text) | scr-text-search | **Works well** — tested "semiconductor" → 22 results (AMD, INTC, MU, MRVL, SMH, SOXX, TSM, QCOM, NVDA...) via alias/keyword matching against memo/sector/tags, not just literal ticker/name match | KEEP — genuinely useful, closest thing to Finviz's industry filter |

---

## 3. Task walkthroughs (real-user simulation)

**T1 — "find US semiconductor stocks with strong momentum."**
Steps: type "semiconductor" in search → 22 results → click "3M" column header once (first click mis-hit due to page reflow after scroll; had to re-`find` the button and click by ref) → sorted correctly: AMD +20.9%, NVDA +17.0%, QCOM +7.2%, TSM +4.5%, SMH −0.8%. **Result: task succeeds and is genuinely useful.** Minor friction: no dedicated "industry" filter (GICS/sub-sector) — user must know to type "semiconductor" in the free-text box; a Finviz-style industry dropdown doesn't exist. Price populated correctly for these rows after the sort interaction (see §5 for why it didn't at first paint).

**T2 — "find cheap (low P/E) quality large caps."**
Steps: switch column preset to "fundamentals," set 시총 → 메가캡(≥$1T) → **0종목**. Tried 대형($10B~1T) → **0종목**. Tried 중형, 소형 — not tested but same code path, presumed also broken. **Result: task fails completely.** There is no way to filter by market-cap tier on the live site right now. A family trader doing exactly the use case the owner described (real investment decisions) would conclude the tool is broken and leave. This is the single most severe finding of this audit.
Workaround found: sort by "밸류" (value) column descending with no cap filter, manually scanning for recognizable large-cap names — works but defeats the purpose of a filter-based screener.

**T3 — "show KR stocks only."**
Steps: 지수 → KOSPI → 103종목 (== universe count, count logic correct). **But**: every single visible row (checked first 6, and the #1-by-rank row after sorting) shows 등급 = "근거 부족" (insufficient evidence) and 상대 점수 = "—". Samsung Electronics (005930.KS) — sorted to top by whatever ordering was active — is rendered as "데이터 부족 행" with tooltip "필수 데이터가 모두 준비되기 전에는 순위를 표시하지 않습니다." Factor columns (모멘텀/추세/저변동) also show "—" for KR rows. Return/RSI/vs-50MA data *do* populate, tagged "2026-09-23 · 참고" (reference-only, stale 4 days vs. the US session's 2026-09-25 bar and vs. today 2026-09-27).
**Result: the KR side of the screener does not rank or grade a single stock.** It shows raw returns as reference data but the core "quant screener" value proposition (rank/grade/signal) is entirely absent for Korea. Confirmed independently by reproducing the domain math (see §4) — the underlying `computeFactorRanks` **does** produce a rank for 005930.KS (rank 48) when fed the raw artifact rows directly, so the gap is not in the ranking formula but in a stricter downstream gate (screen-engine `screenStatus`/field-readiness check, tied to price/quote freshness) that the production pipeline applies before the UI ever sees a rank for KR names.

**T4 — "sort by 1-month return."** Works correctly (analogous to T1's 3M sort, same code path `sortRows`). Sort state persists across preset/column changes within the session. KEEP.

**T5 — "open one stock's detail."** Clicked AMD row → opened "Why" drawer (not the ticker page) → clicked "기업 보기" button inside the drawer → navigated to `#ticker` with AMD context correctly pre-loaded (price $630.63, SR 99, RSI 73, 3M +20.9%, TPR grade A carried over). **Works**, but the two-click path (row → Why drawer → "기업 보기") is one more click than a direct "open ticker" affordance would need; a first-time user might expect clicking the row to go straight to the ticker page, especially since the row's own `aria-label` says "Enter로 Why 보기" (opens Why, not ticker) with no visible affordance that a *second* click is needed to leave the drawer.
Also noted: the Why drawer's own title for AMD read "AMD · 조건 통과 · 순위 계산 보류" (rank calc pending) directly underneath a table row showing rank 99/grade A — an internal inconsistency between `row.rank` (used for the visible rank/grade) and `row.screenRank`/`screenRankingState` (used for the Why drawer's title logic, `screener.js:1155-1164`). A stock can simultaneously show "rank 99, Grade A" in the table and "rank 계산 보류" in its own detail explanation. **FIX — confusing/contradictory to any user who clicks through.**

---

## 4. Ranking reproduction (3 tickers, actual domain code)

Ran `computeFactorRanks` (`src/domain/screener/factor-ranks.js`) directly in Node against the live-fetched `public-data/screener.json` (asOf 2026-09-26T05:25:47Z, 846 artifact rows / universe 873) and `screener-universe.json`, with `weights: null` (→ internal `DEFAULT_WEIGHTS`) as a baseline sanity check (not the exact runtime weights, see §4.1):

```
ranked 846, available true, activeFactors: [momentum, trend, lowvol, kalman]   // size/value/quality inactive — coverage below 80% threshold
AMD        rank 100  factorScores {momentum:90, trend:89, lowvol:49, kalman:85}
005930.KS  rank  48  factorScores {momentum:49, trend:63, lowvol:31, kalman:56}
GME        rank  97  factorScores {momentum:74, trend:75, lowvol:52, kalman:94}
```

- AMD and GME's reproduced ranks (100, 97) are consistent with what the live UI showed (99, 100) within normal drift from live quote timing / weight differences — **verified match, model is internally coherent for US names.**
- **005930.KS reproduces to rank 48 from the pure model, but the live UI shows no rank at all ("데이터 부족").** This proves the KR ranking gap (T3) is a pipeline/gating issue downstream of `computeFactorRanks`, not a missing-factor-data issue — the factor math has everything it needs.
- `value` and `quality` factors were **inactive for the entire cross-section** in this snapshot (coverage below the 80% `MIN_CROSS_SECTION_COVERAGE` threshold) — meaning the "fundamentals" column preset and "가치" (value) filter preset are running on a screener where value/quality contribute **zero weight** to the rank right now. This matches the on-page banner text "밸류·퀄리티 팩터 비활성화 — 무료 SEC 재무 데이터 누적 중" so it is disclosed, but it means task T2 ("cheap, quality large caps") is doubly broken: even if the cap filter worked, the value/quality signal isn't live-active in the ranking this session.

### 4.1 Three different factor-weight vectors — confirmed still present

- `src/domain/screener/factor-ranks.js:45` `DEFAULT_WEIGHTS`: momentum .32 / trend .23 / lowvol .18 / size .18 / value 0 / quality 0 / kalman .09
- `src/domain/screener/factor-weights.js:6` `NEUTRAL`: momentum .27 / trend .20 / lowvol .16 / size .08 / value .10 / quality .09 / kalman .10
- Runtime wiring (`src/app/bootstrap.js:471-478`) calls `deriveFactorWeights()` (→ `NEUTRAL`, since no promotion record exists, confirmed by `adaptiveApplied` always `false` absent `promotion.status==='PROMOTED'`) and passes it into `computeFactorRanks` with `weightsPolicy: 'model-default'` — which routes through `sanitizeWeights()` (`factor-ranks.js:213-230`), **renormalizing `NEUTRAL` over only the active factors** (momentum/trend/lowvol/kalman this session), producing a **third, different-again** applied-weight vector shown in the "팩터·레짐" tab.
- **Confirmed: the previously-flagged "3 different factor weight vectors" issue is still present in current code** — `DEFAULT_WEIGHTS` (factor-ranks.js) is dead code for the runtime path (only used when `weights` is literally `null`, which bootstrap never passes), so it's a maintenance trap: an engineer reading `factor-ranks.js` alone would believe those are the production weights.

---

## 5. Live price / market-cap overlay (verified live, extends known finding)

The known finding "`PriceStore.set` drops `allowedUseCeiling`/`rightsId` so rows show pipeline prices" was **partially re-verified but the live behavior is more nuanced than "never activates":**

- On first paint, **every** visible row's 가격 cell shows "미수신" (not received), including top-ranked US mega/large names (GME, ILMN, AES, AMD...). This matches "overlay doesn't activate at page load."
- After interacting with the table (sorting, filtering to a subset), price cells **do** populate with real numbers (AMD $630.63, INTC $123.00, MU $1082.28, etc.), sourced per the accessibility tree as `runtime-quote` / `live:yahoo-proxy`, tagged "기준 2026-09-25T20:00:01Z." So the live overlay **does** eventually activate for at least some rows — likely tied to `requestVisibleQuotes()` (`screener.js:1108-1124`), which only requests quotes for the currently-rendered/visible row set, capped at 120 symbols, throttled to once per ~55s. This explains why cap/mcap (which needs `liveEvidenceEligible`, a stricter bar than the price cell's own display logic) still fails even after price cells resolve: **price display uses the lenient `liveRow()` path; the cap filter uses the strict `liveEvidenceEligible` provider-level path — these two code paths disagree**, and only the price display path was observed to succeed live in this session. The market-cap filter's stricter gate never resolved to non-null for any row tested (0 results at MEGA and LARGE tiers, retested after a 4s wait with no change).
- **Recommendation:** collapse to one admissibility check for "is this quote usable," used consistently by price display, sort-by-price/mcap, and the cap filter. Right now a user can *see* a price but *not* filter by the market cap that price implies.

---

## 6. Universe coverage & data freshness

- Universe: 873 symbols (`screener-universe.json`), meta says `"currentness": "STALE"`, `lastBulkUpdate: 2026-07-16`, `staleAfterDays: 30`. **At test time (2026-09-27) the universe is ~73 days old against a 30-day staleness budget — well past its own freshness policy**, and the UI does say so ("종목 유니버스 갱신 필요") in the provenance line, but that line is buried in a dense paragraph most users will never read (see §1).
- KR coverage: 145/873 (16.6%) — 103 KOSPI + 42 KOSDAQ. As shown in T3, **none of these 145 currently receive a rank/grade** in the live pipeline, only reference-only return/RSI figures 4 days stale relative to the US factor session. Effectively the screener is a **US-only ranking tool with a KR price-lookup side panel** right now, which is a significant gap against the "AIO for family, US+KR" mandate in the brief.
- Sector taxonomy has overlapping/duplicate categories (Materials vs Basic Materials: 41 vs 3 rows; Consumer vs Consumer Defensive vs Consumer Cyclical: 74 vs 40 vs 1 row) — likely leftover from a provider migration, should be normalized to one taxonomy.
- `fundamentalCoveragePct`/SEC coverage: banner shows "SEC FY sec-fy-normalized-v2 562/655" — i.e., fundamentals (feeding P/E, P/B, ROE, etc.) cover 562 of 655 eligible names; this is disclosed but again not prominent. Whether P/E uses last-FY vs TTM was **not independently re-verified this session** — `_valuationPePriceBasis`/`fundamentalPeriod` fields exist in the provider (`providers/screener.js:439,449`) suggesting per-field basis tracking now exists, but confirming TTM vs FY correctness would require reading `scripts/fetch-data.mjs`, which was out of scope here. **[UNVERIFIED — flagged for follow-up, not confirmed fixed or still-broken.]**
- Missing-value handling: generally good discipline in the code — em-dash "—" for nulls, explicit "미수신"/"근거 부족"/"판정 보류" states rather than silently substituting 0 or a stale value, and per-field tooltips showing source/observedAt/status. This is a real strength relative to typical hobby screeners, undermined by the fact that so much of the *actual* data currently is in one of these "missing" states (see §3, §5) that the honesty becomes the dominant experience rather than the exception.

---

## 7. Comparison to Finviz / TradingView Screener / Korean MTS 조건검색

| Capability | Finviz/TV/MTS | AIO Screener | Gap |
|---|---|---|---|
| Market-cap filter | Always works, instant | **Broken (0 results every tier)** | Critical — table-stakes feature missing |
| Industry/sub-sector filter | Dedicated dropdown (GICS-level) | Only via free-text search matching memo/keyword | Present but hidden; discoverability issue |
| P/E, dividend yield, other value screens | Standard, numeric range filters | Value/quality factor present as a *column* but **not directly filterable as a range**; no P/E range filter exists (only the `value` composite score) — and factor currently inactive for the whole cross-section | Missing granular fundamental filters |
| KR market support | MTS (Korean brokerage apps) obviously native for KR; Finviz/TV don't do KR well either | Present in universe but **non-functional for ranking** | Below MTS bar for KR users, roughly at parity with global tools' non-support |
| Speed to first result | Instant, filters-first layout | 6+ screens of workbench/disclaimer before table | Materially worse |
| Saved screens / conditions | Standard | Present (저장 화면, up to 5 local runs) — decent parity | OK |
| Explainability ("why is this ranked here") | Rare in Finviz/TV; MTS sometimes shows basic criteria | **"Why" drawer with factor contribution breakdown is a genuine differentiator** — better than the reference tools | Strength — but presentation is dense/jargon-heavy for a beginner audience |
| Provenance / data quality transparency | Not shown to users at all | Extremely detailed (freshness, rights, source, observedAt per field) | Unique strength for a trust-conscious build, but currently over-exposed as user-facing copy instead of a "researcher mode" toggle |

**Net comparison: the AIO screener has more integrity/transparency machinery than any of the reference tools, but currently delivers *less* usable screening than a free Finviz account**, because two of the most basic filters (market cap, KR ranking) don't work, and the useful stuff (Why drawer, provenance) is presented with the same visual weight as page furniture, drowning out the actual results.

---

## 8. Mobile (375×812, then reset to desktop)

- Confirmed the same "workbench-first" layout problem is **much worse on mobile**: from route load, the user must scroll through disclaimer → provenance paragraph → workbench (saved screen picker, run button, condition builder with an "AND 조건" free-text row) → preset chips → filter row → column selector before reaching row 1 of the table. Measured at roughly 3 full mobile screens of scrolling minimum (more if a Why drawer is open, which persisted open across a viewport resize in this session, adding another ~2 screens).
- The results table itself, once reached, renders acceptably on mobile for the sticky/leading columns (관심·비교, 상대 점수, 등급, 종목) with a horizontal-scroll region for the remaining columns — a reasonable, standard pattern, not broken.
- The Why drawer content (factor bars, provenance, contrary evidence) reflows to full-width single-column cards on mobile and stays legible — one of the better-adapted pieces of the page.
- Preset/filter controls (comboboxes) stack correctly, no overflow observed.
- **Overall mobile verdict:** functionally not broken, but the "wall of workbench" problem that hurts desktop is compounded by vertical scroll cost on mobile — for a family member checking a stock on their phone, this route is currently impractical as a quick-glance tool.

---

## 9. Route verdict

**FIX (major) — not fit for the "real trading decisions, family use, largely automatic" purpose stated in the brief.** The domain ranking math itself is sound and unusually well-engineered for correctness/provenance (verified: `computeFactorRanks` reproduces sane ranks, ties handled correctly, coverage gating documented). But the **delivery layer has at least one filter (market cap) that is completely non-functional for every tier**, the **KR market is present in the universe but effectively unranked**, and the **first-screen experience buries the actual screener under several screens of internal workbench/provenance UI** that reads like it was built for the developer's own QA, not for a family member picking a stock. A user attempting the two most natural first-time tasks (cap-filtered fundamentals screen, KR-only screen) will conclude the product is broken.

---

## 10. Concrete redesign proposal

### 10.1 Default view / information architecture
- **Split the page into two modes**, not one long scroll: **"둘러보기" (Browse, default)** — filters + table only, opens directly on the results grid with sensible defaults (e.g., US + KR toggle, 균형 preset, discovery+value columns merged) — and **"연구 모드" (Research/Workbench)** — the current definition editor, run funnel, saved screens, backtest IC, conditional evidence panels, provenance paragraph. Put a single toggle/tab at the top; Browse should never require scrolling past workbench content to reach row 1.
- Move the disclaimer to a one-line persistent footer/tooltip instead of a full-screen gate on every load (or remember dismissal — verify whether it currently persists across sessions; if not, that's an added friction point worth fixing).

### 10.2 Default columns
- Change the `discovery` default preset to include at least one value/quality signal (e.g., add `value`) so a first glance already answers "is this cheap," not just "is this moving."
- Fix or remove the `signal` (구조 분류) column — it is dead weight while `signal: null` is hardcoded in the provider.

### 10.3 Filters (priority fixes)
1. **Fix the market-cap filter** — use the same admissibility logic the price cell already uses successfully (or fall back to `nativeMarketCap`/artifact-derived mcap with a "reference" badge instead of returning zero results). Zero-result filters should never ship; at minimum, fall back with a visible "reference-only 시총 사용 중" note rather than an empty table.
2. **Add a real industry/sub-sector filter** — promote the free-text keyword-alias system (already working well for "semiconductor") into a visible dropdown, since it already has the underlying data (`SCR_KEYWORD_ALIASES`).
3. Normalize the sector taxonomy in `screener-universe.json` (merge Materials/Basic Materials, Consumer Cyclical into Consumer/Consumer Defensive) before shipping the sector dropdown again.
4. Wire up or remove the 구조 분류 filter.

### 10.4 KR handling
- Either (a) invest in getting KR names through the same field-readiness gate the US names pass (likely a quote-freshness/session-timing issue given the 4-day-stale KR bar vs. the US session), or (b) if that's not feasible soon, **explicitly relabel the KR rows** as "국내 종목 · 참고 데이터만 (순위 미제공)" in the filter itself (e.g., grey out KOSPI/KOSDAQ in the index dropdown with a note) so users don't waste time assuming a rank is coming. Silent "데이터 부족" on literally every KR row, with no aggregate explanation on the KOSPI/KOSDAQ filter itself, is worse than an honest "not supported yet" label.

### 10.5 Detail / Why drawer
- Fix the `row.rank` vs `row.screenRank` inconsistency so a stock never simultaneously shows "Grade A / rank 99" in the table and "순위 계산 보류" in its own explanation.
- Make the row click open the ticker page directly (primary action), and move "Why" to an explicit icon/button per row (secondary action) — matches user expectation better than requiring drawer → 기업 보기 → ticker page.

### 10.6 Data freshness display
- Surface universe staleness ("갱신 필요 — 73일 경과, 정책 30일") as a visible badge near the filter row, not only inside a long provenance sentence.
- Keep the excellent per-field provenance tooltips (source/observedAt/status) — this is a real strength — but gate the *page-level* wall of text behind the Research mode toggle proposed in §10.1.

### 10.7 Weights
- Delete or clearly mark `factor-ranks.js:DEFAULT_WEIGHTS` as dead/test-only code, since production never passes `weights: null`; document that `factor-weights.js:NEUTRAL` is the sole source of truth, and have the "팩터·레짐" tab show only the *final renormalized applied weights* (already does) plus a one-line note "표시된 가중치는 NEUTRAL을 활성 팩터에 맞춰 재정규화한 값입니다" to prevent an engineer or curious user from citing the wrong vector.

---

## Screenshots / evidence taken this session
(In-session only; not saved to disk — described inline above with exact UI strings quoted ≤15 words each.) Key states captured: initial screener load (disclaimer/provenance/workbench), semiconductor search + 3M sort (prices populated, correct sort), MEGA/LARGE cap filter (0종목, confirmed twice), KOSPI filter (103종목, all 근거 부족/데이터 부족), AMD Why drawer (rank inconsistency), AMD ticker-page handoff, mobile 375×812 scroll-through.

## Files referenced (all absolute)
- `C:\projects\AIO\src\ui\pages\screener.js` (1776 lines; table/filter/sort/Why-drawer/workbench renderer)
- `C:\projects\AIO\src\data\providers\screener.js` (screener artifact + universe join, field readiness, live-quote admissibility)
- `C:\projects\AIO\src\domain\screener\factor-ranks.js` (pure ranking model, `factor-ranks.v6`)
- `C:\projects\AIO\src\domain\screener\factor-weights.js` (regime/profile weight resolver, `factor-weights.v3`)
- `C:\projects\AIO\src\data\screener-row-policy.js` (native vs. bundled-DB row resolution)
- `C:\projects\AIO\src\app\bootstrap.js` (runtime wiring of `deriveFactorWeights` → `computeFactorRanks`, lines ~471-478, ~897-898)
- `C:\projects\AIO\public-data\screener.json`, `C:\projects\AIO\public-data\screener-universe.json` (live-fetched data used for local reproduction)
- `C:\projects\AIO\_context\CODE-MAP.md` (navigation)
