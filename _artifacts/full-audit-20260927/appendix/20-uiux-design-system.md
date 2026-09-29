# AIO Screener — Holistic UI/UX & Design-System Review

Live site audited: https://ysnle.github.io/aio-screener/ — **live version.json = v56.33** (built 2026-09-24T22:44 KST).
Repo/local (`/c/projects/AIO`) is at **v56.58** per `_context/CURRENT-STATE.md` (generated 2026-09-27) — repo is 25 versions ahead of what's actually deployed; live may be mid-redeploy by another session. All findings below are against the **live v56.33** build unless marked `[code]` (static inspection of the local repo).

Context that shapes every finding: `_context/CURRENT-STATE.md` self-reports `Public stage: RESEARCH_BETA_CONDITIONAL; promotion decision: BLOCKED_UNTIL_OPERATOR_CRITERIA_CLOSE`. The operator already knows this is not "done." That governance caution is visible everywhere in the UI as hedge language (판정 보류/BLOCKED/연구용/claim) — a deliberate epistemic-honesty choice, but currently implemented as raw internal-audit vocabulary shown directly to family users, which reads as *broken* rather than *careful*. This tension is the throughline of this review.

---

## 0. Snapshot of live conditions at audit time

Console on first load (`#home`): ~20+ `403` resource failures, one `422`, one `503`; proxy chain degrading live:
```
[AIO:proxy] proxy cf-worker disabled (level 1, cooldown 61s) {fails: 3}
[AIO:proxy] proxy corsproxy disabled (level 1, cooldown 77s) {fails: 3}
[AIO:proxy] proxy allorigins-raw disabled (level 1, cooldown 72s) {fails: 3}
[AIO:proxy] proxy allorigins-get disabled (level 1, cooldown 71s) {fails: 3}
[AIO:debug] 이슈: 시세 20/20 stale
[AIO 운영 점검] 3개 항목 주의 — fallback snapshot older than 24h · core live quote coverage incomplete · 20 stale live price(s)
```
Net effect on the page a real user sees: the homepage's headline "시장 환경 점수" (market environment score — the single number the whole app organizes around) renders as **`— /100`** with **"판정 보류 — 필수 입력 미수신"** (verdict withheld — required inputs not received). This isn't a one-page glitch: the same blank/dash pattern recurs on 차트·기술분석 ("시장 건강도 판정 보류", Stochastic %K —, ADX —), 투자 심리 (VIX9D —, VIX6M —, SKEW —), and 포트폴리오 ("노출 규칙: VIX 확인 중"). This is systemic, not cosmetic, and it directly collides with Task 1 below.

---

## 1. Information architecture

### Current sitemap (20 routes, live sidebar order)

```
AIO Screener
├─ 데일리
│  ├─ 오늘의 브리핑   (#briefing)
│  ├─ 대시보드        (#dashboard)
│  └─ 시장 뉴스        (#news)
├─ 시장 분석
│  ├─ 시장 환경        (#? — market "environment" score, distinct from home)
│  ├─ 시장 폭          (breadth)
│  ├─ 투자 심리        (#sentiment — Fear&Greed, VIX term structure, AAII, Put/Call, SKEW)
│  ├─ 차트 · 기술 분석  (#technical)
│  ├─ 거시경제         (macro)
│  ├─ 환율 · 채권       (FX/bonds)
│  └─ 테마 · 트렌드     (themes/trends)
├─ 내 투자 · 도구
│  ├─ 포트폴리오        (#portfolio)
│  ├─ 기업 분석         (#fundamental)
│  └─ 퀀트 스크리너     (#screener)
├─ 학습
│  ├─ 시장 원리
│  ├─ 대가의 포트폴리오  (guru portfolios — NOT the user's own; name collides with "포트폴리오" above)
│  ├─ AI 시대 지식 지도
│  ├─ 사용 설명서
│  └─ 용어 사전         (275-term glossary, searchable — genuinely good)
└─ (unlabeled, bottom of same sidebar, no group heading)
   ├─ 라이트 모드 toggle
   ├─ AI 도우미 ON/OFF + Anthropic API key field (password input, "저장")
   ├─ GitHub repo field ("설정")
   ├─ RSS2JSON key field ("저장")
   └─ Vault PIN ("_vaultSetPin", "설정")
```
Plus: `#home` (the entry/default view, "시장 현황") is **not itself a sidebar item** — it's whatever loads before a route is picked, and it duplicates content from 오늘의 브리핑, 대시보드, and 시장 환경 (all four show S&P/NASDAQ/VIX/F&G/KOSPI + a narrative paragraph in slightly different wording). A newcomer cannot tell these four apart by name alone.

### Findings

- **[Critical] Operator-only configuration lives inside the primary navigation.** `[code confirmed]` DOM inspection of the sidebar shows real settings controls sitting in the same list a family member scrolls through to find "포트폴리오": `data-action="saveGhRepo"`, `data-action="saveRss2jsonKey"`, `data-action="_vaultSetPin"`, plus a masked Anthropic API-key field (`placeholder="sk-ant-api03-…"`). None of this is behind an "설정"/admin affordance — it's flush against "용어 사전" with only whitespace separating them, no group label. A single operator running this for 5 people should not require every viewer to scroll past a GitHub-repo field and a PIN-vault control to reach the glossary.
- **[High] Four pages compete to answer "what's the market doing today."** 오늘의 브리핑, 대시보드, 시장 환경, and the unlabeled `#home` landing view all show overlapping SPY/QQQ/VIX/F&G/KOSPI + prose. Evidence: 오늘의 브리핑's "시장 분석" paragraph and 홈의 지표 strip cover the same six data points with near-identical numbers. A newcomer has no way to predict which one is "the" daily-mood page — this directly hurts Task 1 (see below).
- **[High] "포트폴리오" vs "대가의 포트폴리오" naming collision.** Both labels contain "포트폴리오"; only "대가의" (master's/guru's) distinguishes "read about famous investors' holdings" from "my own holdings," and they sit in different groups (내 투자·도구 vs 학습) far enough apart that the shared word is the first thing a scanning eye catches, not the qualifier.
- **[Medium] Sector taxonomy has no "반도체" (semiconductor) node** — see Task 2 below; only broad GICS-style buckets (Technology, Healthcare, …) exist in 퀀트 스크리너's 섹터 filter, so a common Korean-investor ask ("반도체주") has no direct filter.
- **[Low] Group labels are functional-Korean but inconsistent register**: "내 투자 · 도구" mixes possessive ("내") with a category noun ("도구") differently from "시장 분석"/"학습," which are plain nouns — minor, but a copy-consistency smell across 4 groups.

---

## 2. Task-based usability tests

| Task | Persona | Result | Notes |
|---|---|---|---|
| **T1** 오늘 시장 분위기 30초 파악 | Beginner | **Fails as designed on this snapshot.** Landing page's headline number is `—/100` with "판정 보류." A beginner has no plain-language explanation of *why* — the only text is "변동성·심리·추세·시장 폭·거시 입력 부족·수신된 개별 지표는 아래에서 확인할 수 있습니다," itself somewhat technical. Individual tiles (S&P/VIX/F&G) *do* render with real numbers, so a patient user can piece together mood from the raw tiles — but the one widget built to answer this exact task is blank. | Even setting aside the live outage, structurally the same info is split across 4 pages (see IA §1), so "30 seconds" assumes the user already knows 오늘의 브리핑 is the right page. |
| **T2** 반도체 종목 중 추세 좋은 종목 찾기 | Active trader | **Possible but effortful, not "find."** 퀀트 스크리너 has a 섹터 filter with only broad buckets (no 반도체 sub-industry) — user must know to pick "Technology" and manually recognize semiconductor tickers (AMD, DELL etc. appear mixed with non-semi names like GME, MRNA, BE in the unfiltered top-12 view). The page opens with a dense jargon wall before any table is visible (see §3). | A ticker/name search box exists ("티커·이름 검색") as a workaround but requires knowing tickers already — circular for a discovery task. |
| **T3** NVDA / 삼성전자 상태 확인 | All personas | **NVDA: straightforward** — 기업 분석 has a labeled input with US-ticker examples ("예: NVDA, AAPL, TSLA, MSFT"). **삼성전자: not obviously supported** — the only placeholder/example text is US tickers; there's no visible hint that Korean names or `005930.KS`-style codes work, and no example. A beginner typing "삼성전자" in Korean has no on-page confirmation this will resolve. (Not submitted — form submission is out of scope for this audit.) | |
| **T4** VIX가 무엇인지 배우기 | Beginner | **Split result.** The reference content is excellent once found: 용어 사전 → search "VIX" returns a clear, nuanced definition ("15·20~25·30 같은 구간은 교육용 대략적 밴드일 뿐... 절대 신호가 아님"). But the *natural* discovery path — clicking the "VIX · 공포지수" stat tile on the home page — routes to 투자 심리, a dense VIX-term-structure page (VIX9D/VIX/VIX3M/VIX6M grid, mostly showing `—` at capture time) with no plain-language definition inline; a "(?)" icon exists next to the section header but did not visibly respond to a click in testing. | The glossary itself is a strong asset that's under-surfaced. |
| **T5** 포트폴리오 위험 확인 (빈 상태) | Beginner | **Good.** Clear empty state: "포트폴리오가 비어 있습니다 / 티커·수량·매수 단가를 입력하면 보유 현황과 리스크 분석이 시작됩니다" + a single "첫 종목 추가" CTA. Privacy copy is explicit and reassuring: "데이터는 브라우저에만 저장되며 서버로 전송되지 않습니다. PIN 설정 후 저장 시 AES-256 암호화." One odd note: a "노출 규칙: VIX 확인 중" risk label appears stuck loading even in the empty state, before any holdings exist — unclear what it's computing against. | Best empty-state on the site; other pages should copy this pattern. |
| **T6** 데이터가 최신인지 확인 | All personas | **Signals exist but are cryptic.** Header badges show "부분 LIVE," "일부 실시간 오후 10:25 (16개)" — the "(16개)" / "(27개)" count changes page to page with no stated denominator ("16 of how many total tickers?"), so freshness is *gestured at* but not actually legible. Console-level detail ("시세 20/20 stale") that would make this precise is invisible to end users. | |

---

## 3. Visual design

- **Color convention: US-style (green=up / red=down), applied via `.pos`/`.neg` + `a11y-up`/`a11y-dn` classes**, e.g. `rgb(34,117,76)` green / `rgb(177,58,48)` red — not the Korean brokerage convention (red=up/blue=down) that the target audience (Korean family members trading US+KR stocks) will have muscle memory for from Korean MTS apps. This is a **deliberate-looking but unstated choice** worth flagging explicitly to the operator: is it intentional (to match US-ticker-heavy content) or an oversight?
- **[High] Color-coding is inconsistently applied even within the chosen convention.** `[measured via computed styles, live #briefing]`: identical percentage values (`+0.51%`, `-5.11%`, `-2.33%`) render in real green/red (`rgb(34,117,76)`/`rgb(177,58,48)`) inside `<b>` and `<td class="gmo-chg gmo-pos/neg">` elements, but the *same values*, same `.pos`/`.neg a11y-up/a11y-dn` classes, in `<div>`/`<span>` wrappers elsewhere on the identical page render as plain neutral text `rgb(87,81,63)` — no color at all. This is a CSS-cascade/specificity bug, not a design choice: the semantic-color token is defined and even class-flagged correctly, but a later, more specific rule (or inline style) is silently overriding it in roughly half of the instances sampled.
- **[Critical for T2 persona, High generally] Jargon/warning fatigue on 퀀트 스크리너.** Before any results table is visible, the page shows: "밸류·퀄리티 팩터 비활성," "모델 검증 BLOCKED," "거래용 승격 금지," "공식 거래소 breadth 아님," "식별 metadata 미확인 873개(mic_missing·asset_type_missing·currency_missing)," "basis bar-start," "claim 9개 (REFERENCE)." This is internal QA/governance vocabulary (the same register as `_context/CURRENT-STATE.md`) leaking directly into the consumer UI. For a family member this reads as "the tool is broken"; for the trader persona it's a wall to read through before reaching the actual ranked list.
- **Number formatting** is generally clean and consistent where data loads (₩/$/%, 1-2 decimal places), but the pervasive `—` placeholder (dozens of instances per page during this outage) has no visual distinction from "this field doesn't apply here" vs. "this field failed to load" — both render as the same em-dash.
- **Badge/pill density**: the top bar alone carries 3-4 status pills simultaneously ("부분 LIVE," "일부 실시간 …(N개)," VIX value chip, "AI 베타"), plus page-level badges ("고점 대비 -0.7%," "판정 보류"), plus a persistent disclaimer bar at the bottom of every page. Badge overload is real and compounds the warning-fatigue problem above.
- **Contrast [measured]**: core text tokens pass comfortably — body text `rgb(87,81,63)` on ivory background ≈ **7.45:1** (AAA), green `rgb(34,117,76)` ≈ **5.32:1**, red `rgb(177,58,48)` ≈ **5.62:1** (both pass AA 4.5:1 for normal text). Contrast is *not* a problem in the light theme where tested — a genuine strength worth preserving in any redesign.

---

## 4. Consistency across pages

- The "판정 보류 / BLOCKED / 확인 중 / 필수 입력 미수신" hedge pattern recurs near-verbatim on 홈, 차트·기술분석, 투자 심리, 포트폴리오, and 퀀트 스크리너 — consistent in *presence*, but each page phrases it slightly differently ("판정 보류," "판정 제외," "BLOCKED," "확인 중"), so it doesn't yet read as one system-wide "data not ready" component — it reads as N different developers' error states.
- Every page carries the same footer disclaimer block verbatim ("투자 면책 고지 — …") with its own "확인했습니다" dismiss button — but it reappears on every route rather than being dismissed once per session, which is the single biggest consumer of vertical space on mobile (see §5).
- 오늘 브리핑/대시보드/시장 환경 header strips (S&P/NASDAQ/VIX/F&G/KOSPI) are near-duplicated markup with different component names in the DOM (`gmo-*` vs `stk-*` vs `mfx-*` class prefixes seen in the color-audit sample above) — three different one-off implementations of what is visually the same "index ticker strip" component.

---

## 5. Mobile (375×812 emulated)

- **[High] Two hamburger icons render side-by-side at the top-left** on every mobile page (one opens the full sidebar drawer; the second sits next to the breadcrumb "AIO/대시보드" and its function was not distinguishable from the first in testing). This is visually redundant and, for a first-time mobile visitor, ambiguous about which one is "the menu."
- **[High] The disclaimer footer is a fixed/sticky block that consumes roughly 20-25% of the 812px mobile viewport height** on every single page (title + 3 lines of legal copy + a full-width button), pushing real content further down and making the already-long pages feel longer. It does not appear to persist a "seen it" state across route changes within the visit.
- The sidebar drawer opens **mid-scroll** (landed on "투자 심리" rather than the top of the list in one test), which will disorient anyone who expects a freshly-opened drawer to start at the top.
- Where content did render, mobile type sizes and spacing were legible; no horizontal overflow was observed on the two pages tested.

---

## 6. Accessibility basics

- **Headings**: only **9** real `<h1>-<h4>` elements exist in the entire live DOM at any moment (`[measured]`), despite dozens of page/section titles being visually presented as headings (e.g., "시장 현황," "투자 심리," "포트폴리오" are not `<h1>`/`<h2>` — they're styled `<div>`s). Screen-reader users navigating by heading (a primary strategy) will not find most page titles. Notably, the 9 real headings found belong to *several different routes at once* ("세상을 움직이는 원리," "대가의 포트폴리오," "AI 시대 지식 지도," the keyboard-shortcuts panel, the glossary modal) — confirming the SPA keeps most/all route content mounted in the DOM simultaneously rather than mounting only the active route (see §7 architecture note).
- **Focus visibility**: a "메인 콘텐츠로 건너뛰기" (skip-to-content) link **does** show a clear visible focus box on first Tab — a genuine accessibility positive, and evidence the team has thought about keyboard users at least once. However, a spot-check on an unstyled generic `<button>` showed `outline: none` / `box-shadow: none` with no visible focus replacement; coverage across the ~286 buttons on the page was not exhaustively verified and should be spot-checked further by the operator using actual Tab-through, not assumed uniform from one sample.
- **Icon buttons**: a DOM sweep found **0 of 287 buttons** lacking both text content and an `aria-label` — i.e., no bare unlabeled icon buttons were detected by this heuristic. Positive finding.
- **Contrast**: passes AA where sampled (§3).

---

## 7. Front-end design system (developer perspective)

`[code, local repo @ v56.58]`

- **index.html**: 13,357 lines / 1,009,233 bytes. A single `<style>` block spans roughly **lines 51–10,392 — ~718KB, ~71% of the entire file** is one inline stylesheet. Three smaller `<style>` blocks appear later (component-local overrides).
- **Inline `style="..."` attributes: 3,377 occurrences** in index.html alone — i.e., the codebase simultaneously maintains a 718KB class-based stylesheet *and* thousands of one-off inline styles, which is two competing styling systems rather than one. This is the direct mechanical cause of the color-application bug found in §3 (inline/later rules beat the `.pos`/`.neg` class rules unpredictably).
- **Design tokens**: **150 CSS custom properties defined**, but only **105 distinct token names are ever referenced** via `var(--x)` (5,438 total usages) — **~45 tokens (30%) are dead**, never consumed anywhere. Meanwhile **36 distinct hardcoded hex colors** (`#211d16`, `#b13a30`, `#57513f`, `#22754c`, …) and **874 `rgba(...)` literals** are used directly in the stylesheet/inline styles, bypassing the token system entirely — so the token layer exists but is optional in practice, not enforced.
- **Typography scale**: no real scale. `font-size` appears as **30+ distinct literal pixel values** in the file, including near-duplicate steps that can't be intentional design decisions (`10px, 10.5px(?), 11px, 11.5px, 12px, 12.5px, 13px, 13.5px, 14px, 14.5px, 15px, 16px, 17px, 18px, 19px, 20px, 22px, 24px, 26px, 28px, 30px, 32px, 36px, 44px`), most written as raw `Npx` rather than a `var(--font-size-*)` token. This is the clearest single piece of evidence that "a new page/card built today" has no enforced scale to follow — every contributor (or every Claude session) has been free to pick a number.
- **Rendering approach is mixed across `src/` (193 files)**: `innerHTML` string-templating used in 10 files, imperative `createElement` DOM-building in 28 files, raw template-literal HTML in 4 files — three different construction styles coexist with no dominant pattern, confirmed by the three different class-name prefixes found for what is visually one "index ticker strip" component (`gmo-*`, `stk-*`, `mfx-*` — §4).
- **Charting**: both **Chart.js** (5 files) and **lightweight-charts** (3 files) are in active use simultaneously, plus both libraries are `<link rel=preload>`'d on every page load regardless of which page actually needs them (console warned both preloads went unused on pages that didn't chart) — a real (if small) perf/consistency cost repeated on every route.
- **Architecture note relevant to §6**: heading/DOM evidence indicates most or all of the 20 routes' markup is mounted in the DOM at once and shown/hidden via CSS/JS state rather than the active route alone being rendered — worth the operator confirming, since it inflates DOM size, duplicate-ID risk, and is why a heading search returns fragments from unrelated pages.
- **How would a new card get built today?** Given the above, a contributor has at least four legitimate-looking paths already in the codebase (styled `<div>` + inline `style=`, styled `<div>` + a new one-off class in the giant stylesheet, a `gmo-*`/`stk-*`/`mfx-*`-style component class, or a fresh `createElement` builder) and 150 tokens to *optionally* pull from — there is no single obvious "the AIO way," which is exactly the kind of gap that produces the inconsistent color-application bug and the 30-value type scale.

---

## 8. Proposed IA / sitemap for the family-trader + learner purpose

Primary daily flow to design around: **glance (10s) → drill into what moved → check my names → (occasionally) learn a term.**

```
AIO
├─ 오늘 (single entry point — merges current 홈+오늘의브리핑+대시보드+시장환경 into ONE page)
│    Hero: one score, one verdict, one "based on: X/Y indicators loaded" line in plain Korean
│    Below: index strip (one shared component, not 3 reimplementations) + top movers + news
├─ 내 종목                        (was 포트폴리오 — rename to avoid the guru collision)
├─ 종목 찾기                      (merges 퀀트 스크리너 + 기업 분석 + 테마·트렌드 — one search/filter
│                                   surface with a "무엇을 찾으세요?" mode switch: 종목명/티커 검색 ↔
│                                   조건으로 찾기 (factor screener) ↔ 테마로 찾기; add sub-industry
│                                   facets incl. 반도체 under Technology)
├─ 시장 분석 (그룹)
│   ├─ 심리·변동성                (투자 심리 + VIX)
│   ├─ 기술적 분석                (차트·기술분석)
│   ├─ 거시·환율·채권             (merge 3 related pages)
│   └─ 시장 폭
├─ 배우기 (그룹, unchanged names but promoted — glossary is the strongest asset on the site)
│   ├─ 용어 사전 (surface inline via "?" tooltips everywhere a term appears, not just here)
│   ├─ 시장 원리
│   ├─ 대가의 투자 아이디어        (renamed from "대가의 포트폴리오")
│   └─ 사용 설명서
└─ 설정 (NEW, gear icon, separate from nav — houses AI key, GitHub repo, RSS key, vault PIN;
          not visible in the scrolling nav list at all)
```
This cuts 20 routes' worth of nav surface to ~14 visible items in 4 groups + a settings affordance, removes the 4-way homepage duplication, and gives "반도체" and similar sub-industry searches a real home.

---

## 9. Proposed design-system foundation

- **Tokens**: cut 150 → ~40-50 actually-used tokens organized as `--color-*` (semantic: `--color-up`, `--color-down`, `--color-text`, `--color-text-muted`, `--color-surface`, `--color-border`, `--color-accent`), `--space-*` (4/8/12/16/24/32px scale), `--font-size-*` (a real 6-8 step scale: 11/12/13/14/16/18/22/28px replacing the 30+ ad hoc values), `--radius-*`. Enforce via a lint rule (grep for raw hex/px in new diffs) rather than convention alone, since convention alone has clearly not held.
- **Color convention decision**: pick one explicitly and document it site-wide — recommend keeping US green-up/red-down *if* the audience is expected to primarily read US tickers, but add a one-time onboarding note ("이 앱은 미국식 색상 규칙(상승=초록)을 사용합니다") since the target users are Korean and will default to red=up mentally. Whatever is chosen, fix the cascade bug so it's actually applied 100% of the time, not ~50%.
- **Components** (single implementation, reused everywhere): `IndexTickerStrip` (collapses gmo-*/stk-*/mfx-* into one), `ScoreCard` (headline number + verdict + "N/M inputs loaded" line — used by 홈/기술분석/심리 instead of each page inventing its own blocked-state copy), `DataStateBadge` (one visual treatment for "loading / stale / blocked / n/a" instead of four different phrasings of the same idea), `EmptyState` (formalize the pattern already used well on 포트폴리오 and reuse it on 기업분석/스크리너-no-results), `GlossaryTerm` (inline "?" that opens the existing 275-term glossary popover from anywhere a term is used, not just the dedicated page).
- **Page templates**: a "list/screener" template (filters left/top, funnel counts, results table — 퀀트 스크리너 already has the right bones, just needs the jargon translated to a progressive-disclosure "고급" panel) and a "detail" template (기업분석/종목 상세) so new pages inherit structure instead of being built from scratch each time.
- **State patterns**: standardize on exactly one wording per state (loading / partial / stale / blocked-by-governance / empty / error) and route all the internal QA vocabulary (BLOCKED, claim, basis bar-start, REFERENCE) behind a single "연구용 상세 보기" disclosure rather than inline in the primary view — preserves the operator's epistemic honesty without frightening a beginner on first look.

---

## 10. What to borrow from Finviz / TradingView / Koyfin / Korean MTS apps

- **Finviz**: the heatmap-first "scan the whole market in one glance" pattern directly serves T1/T2 — AIO's screener is powerful but text/table-only; a simple sector/factor heatmap on the "오늘" page would answer T1 in the literal 30 seconds asked for, replacing the current blank score.
- **TradingView**: symbol search with instant fuzzy matching (ticker *or* company name, any market) is the direct fix for the NVDA-works/삼성전자-unclear gap in T3 — a single unified search box with live suggestions, not a plain text input with only US-ticker placeholder examples.
- **Koyfin**: dashboard customization (user picks which widgets appear on their home) would resolve the "4 pages all show the same thing" problem by letting each of the 5 real users configure their own 오늘 view once, rather than the operator guessing one layout fits a beginner, a trader, and the operator equally.
- **Korean MTS apps (토스증권, 키움 영웅문 등)**: red=up/blue=down convention (if the operator decides to switch), and their aggressive collapsing of disclaimers into a single one-time interstitial rather than a persistent footer block on every screen — directly addresses the mobile space problem in §5. Also worth copying: Korean MTS apps typically surface "펀드멘털 한 줄 요약" (one-line plain-language summary) above any dense table, which is the single most transferable pattern for turning 퀀트 스크리너's jargon wall into something the beginner persona can read.

---

## Prioritized problem list

**Critical**
1. Homepage headline score renders `—/100` with no plain-language "why" a beginner can act on (T1 failure). [live, may be outage-dependent but the UX gap in explaining it is structural]
2. Operator-only settings (API keys, GitHub repo, vault PIN) embedded directly in the primary nav sidebar with no separation from content routes.
3. 퀀트 스크리너's pre-table content is internal QA/governance jargon, not user-facing copy — blocks T2 for the intended family/beginner audience.

**High**
4. Semantic up/down color is applied inconsistently (~50% of sampled instances lose their color due to a CSS cascade bug) — undermines the one visual-hierarchy signal used across every numeric page.
5. Four different pages (홈/오늘의 브리핑/대시보드/시장 환경) duplicate the "market mood" content with no clear differentiation.
6. Mobile: duplicate hamburger icons + a disclaimer footer consuming ~20-25% of viewport height on every page.
7. Only 9 real heading elements exist across the whole app; most page titles aren't semantic headings, breaking screen-reader navigation.
8. Design tokens exist (150) but are optional in practice — 30% dead, and 36 hex colors / 874 rgba literals / 30+ raw font-size values bypass them, making consistent new-page authoring effectively unenforced.

**Medium**
9. No sub-industry (e.g., 반도체) filter in the screener; only broad sectors.
10. "포트폴리오" vs "대가의 포트폴리오" naming collision.
11. Freshness badges ("일부 실시간 (16개)") show a count with no stated denominator, so "is this current?" (T6) is gestured at, not actually answerable at a glance.
12. Three different one-off component implementations (`gmo-*`/`stk-*`/`mfx-*`) for the same visual "index ticker" pattern.
13. Both Chart.js and lightweight-charts preloaded on every page regardless of need.

**Low**
14. Sidebar group-label register is slightly inconsistent ("내 투자 · 도구" vs plain-noun groups).
15. VIX "(?)" tooltip icon on 투자 심리 did not visibly respond to a click in testing — worth a direct check outside this audit.

**Positives worth preserving**
- 포트폴리오's empty state (clear CTA + explicit local-only/AES-256 privacy copy) is the best pattern on the site — replicate it elsewhere.
- The 275-term glossary with live search is high quality, accurate, and appropriately hedged (e.g., its VIX entry) — it's under-surfaced, not under-built.
- Light-theme contrast ratios measured (7.45:1 body text, 5.3-5.6:1 semantic colors) comfortably pass WCAG AA.
- Skip-to-content link has a genuinely visible focus state — accessibility hasn't been ignored entirely.
- No bare unlabeled icon buttons detected (0/287 in DOM sweep).
