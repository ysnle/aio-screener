# AIO Screener — Deep Audit: #themes / #theme-detail / #fundamental / #ticker

Live site audited: https://ysnle.github.io/aio-screener/ — **version v56.33** (built 2026-09-24T22:44 KST), read from `/version.json`.
Local code root: `C:\projects\AIO`. Local `_context/CODE-MAP.md` frontmatter claims local is ~18 versions ahead of live and undeployed (per user memory `project_current_state.md` v48.97 note) — this audit found at least one concrete confirmation (theme-temperature copy, see 2.6) where live still shows older wording that local `themes.js` has already replaced. Everything below is about the **live v56.33 behavior** unless marked "local code only."

Audit method: live site via `mcp__Claude_Browser__*` (one dedicated tab, `tabId=seed`); local source via Read/Grep/Bash. Screenshot rendering was unreliable for this session (repeated "pane hidden/minimized" timeouts after the first few captures), so most of the deep-dive after the first screenshots relied on `get_page_text`, `read_page`, `find`, and read-only `javascript_tool` DOM/state inspection (never used to alter app state, only to read `window._liveData`, call the app's own already-bound handlers such as `showTicker()`, or diagnose a thrown error) — flagged inline as "(JS-inspected)" wherever a screenshot could not confirm it visually. Two mobile screenshots (themes, ticker) did succeed and are reported normally.

---

## 0. Route map reality check (route-owners.json vs. what's on screen)

`architecture/route-owners.json` (generated 2026-08-22) claims 20/20 routes are renderer-native and data-native, and lists `themes`/`theme-detail`/`fundamental`/`ticker` as native-owned with only chart/narrative left legacy in most cases. **This is materially misleading for `themes` and `ticker`:**

- The **#themes** page is actually two independent systems bolted together in one route: a native ESM RRG/GICS-sector system (`src/ui/pages/themes.js`, US sector ETFs + 14 US sub-sector ETFs) **and** a completely separate, unlisted-in-route-owners legacy system for Korean themes (`js/aio-kr-data.js`, `initKoreaThemes()` / `KR_THEME_MAP`, 28 KR theme cards with ~180 KR stocks). The KR half is not mentioned anywhere in `route-owners.json`'s `themes` entry, uses a different data model (JS-computed weighted-average card, not RRG quadrants), and — critically — **its detail-panel feature is completely broken in production** (see 2.7).
- The **#ticker** route's native primary surface (`entity.js`) is confirmed native for US tickers, but for Korean tickers it silently fails to resolve identity or price even when the underlying live quote is present and valid in memory (see 4.5). `route-owners.json` has no KR-specific caveat for `ticker`.

---

## 1. Task (a) — "지금 강한 테마가 뭔지 보고, 반도체 테마 안의 대장주 확인"

- **11섹터 tab** (default view) at audit time: 선도(Leading) 2 · 개선(Improving) 1 · 약화(Weakening) 1 · 후행(Lagging) 7 → pill reads "RRG 전환 약세 · 방어 주도" (risk-off). Leading = XLK 기술 +0.80%, **XLE 에너지 −0.90%**. Improving = XLC 통신 −0.90%.
  - **Correctness spot-check (verified in code):** `src/domain/themes/rrg.js:classifyRRG` — quadrant is purely a function of `rsRatio`/`rsMom` (price ratio to SPY vs. its own trailing average) crossing 100, **not** of the day's raw % change or its sign. That's a legitimate RRG definition, but the UI displays the day's raw `%` next to the quadrant chip with red/green coloring by that same day change, so a user sees a green-labeled "Leading" quadrant containing a chip colored **red** (XLE −0.90%). This is a real, verifiable source of beginner confusion — the chip's color and the quadrant's meaning use two unrelated signals with no on-screen explanation of the difference.
  - So: "지금 강한 테마" answer from the tool = **기술(Tech, XLK)**, with 에너지(Energy) also structurally "Leading" but currently down on the day — a nuance the UI does not explain.
- **서브섹터 tab**: 14 US sub-sector ETFs listed (SMH, IGV, XBI, ITA, OIH, AMLP, URA, XOP, HACK, GDX, CIBR, BOTZ, ICLN, LIT). **13 of 14 show "—" (no live quote at all)**; only SMH (반도체) had a price (+1.01%). RRG quadrant classification is entirely withheld here too ("RRG 판정 보류 · 상대강도·모멘텀 증거 부족"). Only 4 of the 14 sub-sector chips are clickable for detail (반도체/소프트웨어/방산·항공/로보틱스 — the other 10, including the 13 with no quote, have no detail panel wired at all). This "서브섹터" tab is close to non-functional for a real user today: one usable data point out of fourteen.
- **반도체(Semiconductor/SMH) theme detail** (clicked from 서브섹터 tab):
  - 대표 리더 (headline leaders): NVDA · AVGO · ARM · AMAT.
  - Sub-theme breakdown (AI 칩/GPU, 메모리, 장비/소재, 아날로그/RF, 파운드리/성숙공정) lists 14 constituent tickers with correct sector groupings (spot-checked against known reality: correct).
  - **대장주 상세 (14 stocks) — only 2 of 14 (NVDA, ARM) have a live price/%; the other 12 (AMD, AVGO, QCOM, MRVL, ADI, AMAT, LRCX, MU, TER, KLAC, TSM, ASML) show "가격 대기 / 등락률 대기" (price/% pending) for every single row.** For a task literally asking "who's the leader inside semiconductors," the tool can only actually answer for NVDA and ARM; AVGO — the #2 name it lists as a "대표 리더" — has no price at all in the very next section. This is a meaningful, verified gap between the summary line's promise and the detail table's data.
  - "테마 온도 진진단" (temperature) text on the **live** site read: *"강세 — 모멘텀이 살아있습니다. 자금 유입 가능성과 추세 지속 여부를 함께 확인하세요."* ("momentum is alive, check possible fund inflows"). This is a forward-looking/causal claim from a single day's ETF % change. **Local `themes.js` (`renderThemeDetailTemperature`, lines ~580-598) has already replaced this exact copy** with day-window-scoped language ("당일 +1% 이상 — 관측된 당일 등락 구간입니다. 시계열 모멘텀·자금 유입은 별도 근거가 필요합니다.") specifically because — per the code's own `LC-38` comment — the old wording overclaimed momentum/fund-flow from one day of ETF return. **This is concrete, in-repo evidence that the fix exists locally but is not yet deployed to v56.33.**
  - Answer to the task: NVDA is the semiconductor theme's clearest "대장주" by the tool's own labeling (listed first, has live price+return); AVGO/AMAT are named as leaders but have no live data to back that up today.

---

## 2. Task (b) — 2 US themes + 2 KR themes' detail

### 2.1–2.3 US: 반도체 (semiconductor) — see §1. Second US theme spot-checked: **로보틱스 (Robotics)** and **소프트웨어 (Software)** and **방산/항공** buttons exist (`반도체 테마 상세 열기`, `소프트웨어 테마 상세 열기`, `방산/항공 테마 상세 열기`, `로보틱스 테마 상세 열기` — confirmed via `read_page` interactive-element listing) but only 반도체 was opened in depth for this audit given time budget; the other three are presumed to share the same rendering pipeline (`renderThemeDetail*` family in `themes.js`) and therefore the same "temperature copy is stale on live" and "most leader rows have no price" issues, but this is **not directly re-verified per-theme** — flagged unverified for 로보틱스/소프트웨어/방산항공 specifically.

### 2.4 KR theme section exists but is a separate legacy system
Scrolling (JS-inspected via `innerText`, screenshot unreliable) past the native RRG blocks reveals: **"한국 시장 — 국내 테마 분석 (KRX 28개 테마 · 등락률 · 대장주)"**, rendered by `js/aio-kr-data.js:initKoreaThemes()`/`renderKrThemeCardsFromMap()` into `#kr-theme-container`, driven by `KR_THEME_MAP` (~28 curated KR themes, `js/aio-kr-data.js:1551`). Data is genuinely live and rich — e.g. the "반도체/HBM" card showed real prices: 삼성전자 286,500 (+3.62%), SK하이닉스 1,863,000 (+1.25%), 한미반도체 243,000 (+1.25%), etc., each with a live/stale dot indicator.

**Formatting bug (verified, JS-inspected):** each constituent's weight is rendered as a raw unrounded JS float, e.g. `"012450 한화에어로스페이스 14.285714285714286% 1,031,000 -2.46%"` — the `100/7` weight is displayed with 15 decimal digits instead of being formatted (`toFixed(1)` or similar). This appears on every KR theme card, for every constituent, i.e. dozens of visible instances of unformatted numbers on the page today.

### 2.5–2.6 Two KR themes attempted: **반도체/HBM (semi)** and **K-방산/항공우주 (defense)**

### 2.7 **Critical, reproducible bug: KR theme detail panel is completely broken on live v56.33**
Clicking either KR theme card (verified for both `semi` and `defense`, and by code inspection this is themeId-independent) throws an uncaught `ReferenceError` and the detail panel **never opens** — no error is shown to the user, it just silently does nothing:
```
ReferenceError: KR_THEME_INSIGHTS is not defined
  at _buildKrThemeDeepAnalysis (js/aio-kr-data.js?v=56.33:514:13)
  at showKrThemeDetail (js/aio-kr-data.js?v=56.33:445:5)
```
Root cause (confirmed in both live JS and local source, `js/aio-kr-data.js:510`): `var kti = KR_THEME_INSIGHTS[themeId];` reads the global `KR_THEME_INSIGHTS` **without a `typeof` guard**, but `window.KR_THEME_INSIGHTS` is `undefined` everywhere in the shipped bundle — `grep -rn "KR_THEME_INSIGHTS"` across `js/*.js` shows only 2 other call sites (`aio-core.js:9335`, `aio-workspace.js:2925`) and both correctly guard with `typeof KR_THEME_INSIGHTS !== 'undefined'`; the object itself is never declared/assigned anywhere in the codebase (it was very likely renamed/retired in a refactor and this one call site was missed). **Net effect: all 28 KR theme "detail" experiences on the #themes page are 100% non-functional today** — a user cannot get to KR theme composition, leaders, or insights from this page at all, even though the underlying KR_THEME_MAP/live-quote data clearly exists and is rich (see 2.4). This single one-line fix (guard the reference, or define/restore `KR_THEME_INSIGHTS`) would unblock the entire KR theme-detail feature.

This directly blocks the audit's task (b) requirement to inspect 2 KR theme details — both attempts (semi, defense) failed identically with this error, confirmed via runtime exception, not inferred.

---

## 3. #fundamental ("기업 분석") — task (c), NVDA

- **First screen**: empty state — a heading, a short data-source line ("SEC EDGAR · FMP · Yahoo Finance 데이터 기반 딥 다이브"), a status pill ("○ SEC 데이터 미수신"), and a ticker search box (placeholder "예: NVDA, AAPL, TSLA, MSFT") plus a "최근 검색" (recent searches) row. Purpose is reasonably clear (SEC/FMP/Yahoo-based deep-dive per ticker) but there is **no sidebar entry point that pre-loads anything** — a first-time user lands on a blank page and must already know to type a ticker. No suggested/trending tickers beyond the placeholder example text.
- **NVDA search result** (typed + Enter): loads correctly, with real SEC EDGAR data:
  - SEC 기본 보고: 10-K, 기준일 2026-01-25, "신선도 current (245일)", 제출일 2026-02-25, PIT 137건.
  - Revenue $215,938,000,000 · Net income $120,067,000,000 · Equity $157,293,000,000 · Shares outstanding 24,300,000,000 · Revenue growth 65.5% · Net margin 55.6% · ROE 76.3%.
  - 팩터 레이더: 모멘텀/추세/저변동/RSI bars shown, 퀄리티 "—" and 밸류 "—" (both unpopulated), 랭크 69.
  - 핵심 재무 하이라이트: 시가총액 $5.47T · **P/E (TTM) 45.9x** ("고평가 영역"/overvalued-zone label) · ROE 76.3% ("우수") · EPS (TTM) $4.90 · 매출 $215.94B (FY2026) · 순이익 $120.07B · Gross Margin 71.1% · FCF Yield **−0.0%** (an odd value — negative-zero formatting for what is presumably ~0%, worth a formatting cleanup) · EV/EBITDA "N/A" · P/B 34.78x · 부채비율 0.05x ("안정") · 배당수익률 "미수신."
  - Additional SEC-XBRL-only panels: R&D 강도 8.6%, SBC 희석 3.0%, SG&A 비중 2.1%, 현금 포지션 $10.61B, 재고 $21.40B, 매출채권 $38.47B, 유동부채 $999.0M, plus a sector-percentile panel (Revenues CY2026Q2 $96.22B → "상위 0.4%, Rank 1645/1651"; Net Income CY2026Q2 $59.69B → "상위 0.0%, Rank 4916/4918"). This percentile section mixes an **annual** headline (FY2026 revenue/net income) with a **quarterly** percentile stat (CY2026Q2) on the same screen without a visual separator calling out the different period — a subtle but real "which period is this?" trap for a careful reader, even though each individual number is correctly labeled.
  - "기업 설명 데이터 없음 (FMP profile.description 미제공)" and "가격 포지션 데이터 없음" — both openly labeled as missing rather than guessed. Good fail-closed behavior, consistent with the rest of the app's stated design philosophy (see route-owners.json's repeated "fail-closed" pattern).
- **005930 (Samsung) on #fundamental**: fails gracefully and transparently — "외부 데이터 수신 실패 — 빈 보고서로 단정하지 않습니다" / "확보된 데이터가 없어 현재 분석은 참고용으로도 생성하지 않습니다" with itemized reasons (Yahoo Finance 응답 없음, SEC 공시 시간 제한, SEC XBRL 시간 제한, FMP API 키 미설정). This is honest, well-designed failure messaging — no fabricated numbers. But it also means **#fundamental provides literally zero value for any Korean stock** (expected, since Samsung doesn't file 10-Ks with SEC EDGAR under this code) — for a screener whose stated identity is KR+US all-in-one, this route is US-only in practice, and nothing on the page tells a KR-focused user that up front (the empty-state copy doesn't scope the feature to US/SEC-covered names).
- **Minor bug (JS-inspected via `get_page_text`):** the "최근:" recent-search row rendered as `"NVDA005930"` — two ticker chips concatenated with no separating space/comma in the extracted text, i.e. likely missing whitespace/margin between adjacent recent-search chip elements. Not confirmed visually (screenshot unreliable at that moment) — flagged as text-extraction-confirmed only.

---

## 4. #ticker — task (d), 005930, and cross-route consistency (task e)

- **Not in the sidebar** (confirmed — sidebar list captured via `read_page` has 15 entries: 데일리/대시보드/시장 뉴스/시장 환경/시장 폭/투자 심리/차트·기술 분석/거시경제/환율·채권/테마·트렌드/포트폴리오/기업 분석/퀀트 스크리너/시장 원리/대가의 포트폴리오 — no "종목 상세"/ticker entry), reachable only via search or by clicking a symbol elsewhere (screener row, theme-detail leader chip, etc.), matching the task brief.
- **NVDA** (`showTicker('NVDA')`, JS-inspected/simulated-click equivalent since screenshot/click tooling was unreliable this session — text output otherwise matches what a real click would render):
  - Hero: NVDA / NVIDIA Corporation / **$225.07** / ▲ +0.22% / "Your P&L: 내 포트폴리오 외 종목" (not held).
  - SR 69 · TPR B · RSI 55.3 · 3M +17.0% · MOM 54 · SIG "—".
  - "종목·시장 관측": 1/2 conditions met (RSI 55.3 in 30–70 OK; "시그널: — DB 미등록"; "시장 건강도: 미수신 — 필수 시세 미수신 · 판정 보류"). Reasonably transparent about what's missing and why.
  - 가격 정보: 전일 종가 $224.58 · 52주 범위 $164.27–$236.54 · 1개월 +7.5% · 3개월 +17.0% · 6개월 +31.7%.
  - 관련 테마: "반도체 · AI 칩/GPU, AI 인프라/데이터센터 · AI 칩/가속기" — correctly cross-links to the theme taxonomy from §1/§2.
  - 팩터 프로파일: 모멘텀 54 · 추세 52 · 저변동성 66 · 칼만추세 51, each with an explicit "z-score, not a percentile, not a return predictor (10-year backtest found no predictive power)" disclaimer — this is a genuinely good, honest piece of UX copy that most retail tools wouldn't bother to add.
  - **No P/E, EV/EBITDA, or any valuation multiple anywhere on the ticker page.** A user doing "실적·밸류·재무 확인" (task c's actual phrasing) on the ticker page alone gets none of that — they must separately navigate to #fundamental. This is a real coherence/flow gap: the two most closely-related "look at this stock" routes (ticker vs. fundamental) don't share even a one-line valuation summary, so a user bounces between two different pages, two different data pipelines (Yahoo-proxy/screener-artifact vs. SEC EDGAR/FMP), and — per the browser tab title bug below — two pages that don't even agree on what's currently loaded.
  - **Bug (verified twice, reproducible): `document.title` does not update on ticker navigation.** After `showTicker('NVDA')`, the browser tab title stayed `"종목 선택 대기 · AIO Screener"` ("waiting for ticker selection") even though the page was fully populated with NVDA's hero/SR/RSI/etc. Re-confirmed on a **second, independent navigation** (`#screener` right after) where the tab title was still stuck on the *previous* ticker's stale title ("종목 선택 대기"). This is a real, user-visible defect (browser tab / history / bookmark title never reflects the actual open ticker), not a one-off race — seen deterministically on both attempts.
- **005930 (Samsung) — task (d), confirmed broken:**
  - `showTicker('005930')` and `showTicker('005930.KS')` both produce: hero name **"005930"** (raw code, no Korean/English company-name resolution at all — "005930 / 005930" as both symbol and name lines), price **"—"**, 52-week range **"—"**, all return windows **"—"**, "SCREENER_DB 미등록" (not in screener DB), "테마맵 미등록 종목" (not in theme map), "0/1 관측 조건 충족."
  - **This is confirmed NOT a data-availability problem.** Direct inspection of `window._liveData['005930.KS']` (JS-inspected) shows a fully valid, current quote object: `price: 286500, pct: 3.62, source: "live:naver", fetchedAt: 2026-09-27T18:27:12Z`, matching exactly the price shown in the KR theme card for 삼성전자 in §2.4. **The live quote for Samsung is present and correct in the app's in-memory store; the native `#ticker`/`entity.js` route simply never reads or displays it for a 6-digit KRX-style symbol.** This is a genuine, high-severity gap for the stated user base (KR+US real trading decisions): a Korean user cannot open ticker detail for domestic holdings like Samsung Electronics through the normal ticker flow — the one route explicitly designed for "종목 상세 보기" (per the task's own Korean phrasing) does not work for Korean stocks at all.
  - Task (d)'s literal ask — "삼성전자(005930) 종목 상세 보기" — **cannot currently be fulfilled by this route.** A user would have to fall back to the KR theme card price display (§2.4) or a screener row to see any real number for Samsung.

### 4.x Cross-route consistency check (task e) — NVDA
| Field | Theme-detail (SMH leader) | #fundamental hero | #ticker hero | Screener-adjacent holdings table |
|---|---|---|---|---|
| Price | $225.07 | $225.07 | $225.07 | 225.07 |
| Day % | +0.22% | **+0.2%** (1 decimal) | +0.22% | (blank, "—") |
| P/E | not shown | 45.9x (TTM) | **not shown** | not shown (that table only has Ticker/Price/YTD%/1Y%/Holdings columns, all blank for NVDA) |
| Returns | n/a | n/a (no return field) | 1M +7.5% / 3M +17.0% / 6M +31.7% | YTD/1Y both "—" |

**Verdict:** price is genuinely consistent across all 4 surfaces (good — single underlying live-quote source, as expected from the app's stated single-fetch architecture). Day-% has a trivial 1-vs-2-decimal display inconsistency between #fundamental and the other two. **P/E and returns are each shown on only one of the four surfaces and never cross-referenced** — there is no single place a user can see price + P/E + return together for the same stock; they must mentally merge #fundamental (P/E, no returns) and #ticker (returns, no P/E). This is the single biggest coherence gap of the whole "stock research" journey.

---

## 5. Mobile spot-check (resize_window, mobile preset 375×812 → desktop)

- **#themes**: renders cleanly — single-column cards, RRG status pill wraps to two lines but stays legible, tab bar (11섹터/서브섹터/전체) has adequate touch targets, quadrant cards stack vertically with no overflow. No horizontal scroll observed. **Verdict: good.**
- **#ticker (NVDA)**: also renders cleanly — hero price/name stack correctly, SR/TPR/RSI/3M/MOM/SIG chips wrap into a tidy 2-row flex layout, "종목·시장 관측" checklist readable with good spacing. **Verdict: good.**
- Top-bar status text ("일부 실시간 오후...") gets clipped/truncated on both mobile screenshots — cosmetic only, not investigated further.
- #fundamental and 005930-on-#ticker were not re-tested at mobile width specifically (time-boxed); given both are mostly the same card/grid primitives as #ticker, low risk, but unverified.

---

## 6. Element inventory (representative; not exhaustive — themes.js alone is 1177 lines)

| Element | Shows | Source | Logic/threshold | Freshness | Correct? | Meaning clear? | Coherent w/ rest | Beginner-OK | Trader-OK | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| RRG 섹터 로테이션 quadrant cards | 4 quadrants × sector ETF chips | `src/ui/pages/themes.js:289-361` (`renderThemes`) | `classifyRRG` in `src/domain/themes/rrg.js`: ratio/mom vs 100 crossing, needs >20-day history | live (audit-time snapshot) | Spot-check OK vs. known XLK/XLE relative trend | Partially — quadrant vs. daily-% color mismatch unexplained (§1) | Consistent within page | No (RS-ratio concept unexplained on-page) | Yes, if they know RRG | **KEEP, add a 1-line legend distinguishing quadrant (relative trend) from chip color (today's %)** |
| 서브섹터 14-ETF grid | US thematic ETFs SMH/IGV/XBI/... | `themes.js` `viewItems`/`renderThemes` | same RRG engine, `view==='subsecors'` filter | 13/14 = no quote at audit time | Not verifiable — no data | Confusing: 13 "—" rows | Weak — most of tab is empty | No | No (nothing actionable) | **FIX data coverage or CUT the tab until ≥half the ETFs have quotes** |
| Theme-detail 대표 리더 vs 대장주 상세 | 4-name summary vs 14-row table | `themes.js:363-568` | leaders array from theme catalog; quote lookup per symbol | Only 2/14 (NVDA, ARM) had quotes at audit time | Leader list itself correct; price coverage poor | Mismatch between "these are the leaders" and "most have no data" not flagged to user | Weak | Misleading (looks complete) | Misleading | **FIX: show explicit N/14 coverage count next to "대장주 상세" heading (like the `detailCount` legend already used elsewhere in this same file)** |
| 테마 온도 진단 | 1-line diagnosis from day % | `themes.js:570-598` | Bucketed by `pct` thresholds (≥3/≥1/≥0/≥-2/else) | **Live text is the pre-LC-38 version; local code already fixed it (§1)** | N/A (copy issue, not data issue) | Live copy overclaims causality ("모멘텀이 살아있다") | Inconsistent with the fail-closed tone used everywhere else on the same page | Actively misleading for a beginner | Actively misleading for a trader | **FIX: deploy the already-written local fix** |
| KR 테마 카드 grid (28 themes) | KR theme name, heat label, weighted avg %, constituent pills w/ price/% | `js/aio-kr-data.js` `renderKrThemeCardsFromMap`/`initKoreaThemes` | JS weighted-avg of `KR_THEME_MAP` weights × live pct | live, real prices (Samsung 286,500 +3.62% etc.) | Weight formatting bug: raw float % (`14.285714285714286%`) shown unrounded | Numerically correct but visually broken | Totally disconnected from the native RRG system above it on the same page (different UI language, no shared filter) | No (unformatted numbers, no RRG framing) | Workable if they ignore the decimals | **FIX formatting; consider whether KR themes belong in the native RRG model instead of a second bolted-on legacy system** |
| KR 테마 상세 패널 (`kr-theme-detail-panel`) | Should show theme deep-dive on card click | `js/aio-kr-data.js:363-`, `_buildKrThemeDeepAnalysis:514` | reads `KR_THEME_INSIGHTS[themeId]` | N/A — **throws before rendering anything** | **Broken — confirmed `ReferenceError`, 0/28 themes openable** | N/A | N/A | No | No | **FIX (one-line guard/restore missing global) — currently CUT in all but name** |
| #fundamental SEC 핵심 재무 | Revenue/NI/Equity/Shares/Growth/Margin/ROE | `src/domain/fundamental/sec-report.js` + `entity.js` | SEC EDGAR companyfacts, PIT-tagged | 10-K, FY ending 2026-01-25, filed 2026-02-25, "current (245일)" | Numbers internally consistent (NI/Rev margin = 55.6% checks out: 120.067/215.938=55.6%) | Clear, well-labeled | Not cross-linked to #ticker's valuation-free view (§4.x) | Reasonably — has labels | Yes | **KEEP** |
| #fundamental P/E · EV/EBITDA · P/B · FCF Yield block | Valuation multiples | `entity.js` (fund-native-sec + legacy mixed-source block) | Mixed SEC/derived; EV/EBITDA "N/A", FCF Yield "-0.0%" | live-ish (uses current price × SEC shares) | FCF Yield formatting bug (negative zero) | Mostly clear; "고평가 영역"/"우수" labels are nice touches | **Not shown anywhere on #ticker** (§4.x) | Yes | Yes | **KEEP, fix -0.0% formatting, and surface at least P/E on #ticker hero too** |
| #ticker 팩터 프로파일 (모멘텀/추세/저변동성/칼만추세) | z-scored factor bars + explicit "not predictive" disclaimer | `entity.js` | sector-relative z-score, screener artifact | live | Can't independently verify z-score math, but disclaimer is honest | Self-consistent, good practice | Good | Yes, disclaimer helps | Yes | **KEEP** — a model for how other panels should disclose limits |
| #ticker hero (KR symbol input) | Name/price/52w/returns | `entity.js` native primary surface | reads `window._liveData[symbol]` | 005930 case: **data exists in `_liveData['005930.KS']` but hero shows all blanks** | **Broken for KR tickers** | N/A | N/A | No | No (unusable for domestic KR holdings) | **FIX — high priority given KR+US mandate** |
| Browser tab title on ticker nav | e.g. "NVDA · AIO Screener" | app router / `document.title` writer | — | Confirmed stale twice (stuck on "종목 선택 대기") | Broken | Minor but real (breaks tab-switching/history/bookmarking workflows) | — | — | — | **FIX** |

---

## 7. Route verdicts + redesign notes

**#themes**: Ambitious and mostly honest (fail-closed everywhere, no synthetic RRG data, LC-38 already fixing overclaiming copy locally) but currently ships **two disconnected products in one route** (native US RRG + legacy KR cards) with a **fully broken KR detail feature** and a **13/14-empty subsector tab**. Redesign direction: (1) ship the `KR_THEME_INSIGHTS` fix immediately — it's one guard clause; (2) either fold KR themes into the same RRG/quadrant visual language (even a simplified 2-axis "vs KOSPI" version) or clearly separate them into their own tab/section with its own explanation, instead of silently stacking two different mental models on one scroll; (3) hide or clearly badge the 10 sub-sector ETFs that never get quotes, rather than showing 10 "—" rows.

**#theme-detail** (derived panel, not its own route): Genuinely good bones — per-metric fail-closed language (온도/스프레드/브레드스/벤치마크 all explicitly say "시세 대기" when data is missing rather than guessing), but the promise ("대표 리더: X·Y·Z·W") outruns what the detail table can actually show (2/14 priced). Needs an explicit coverage indicator, and the live temperature-diagnosis copy needs the LC-38 deploy.

**#fundamental**: Solid, well-labeled SEC-first design for **US** tickers; honestly and transparently non-functional for KR tickers (which is arguably fine if scoped, but the empty state doesn't say "US/SEC-listed names only" up front, so a KR-focused user wastes a search finding this out). No P/E/valuation shown on the sibling #ticker route, forcing a two-page hop for "밸류 확인."

**#ticker**: Best-designed single screen of the four (good factor-disclaimer copy, clean fail states, sensible tab structure per `route-owners.json`'s P834 candle/tab work) for **US** tickers, but **completely non-functional for Korean tickers** despite the live quote data existing in memory — this is the most consequential bug found in this audit given the stated KR+US dual-market use case. Also has a real (twice-confirmed) tab-title staleness bug.

**How themes/fundamental/ticker/screener should relate as one "stock research" flow:** Today a user's path is disjointed — themes → (leader chip) → ticker (price/returns/factors, no valuation) → manually re-search the same symbol on fundamental (SEC valuation, no returns/factors) → manually re-search again on screener (rank/backtest context, largely blank in the table we sampled). Each hop re-types or re-clicks the same ticker into a differently-scoped tool with no shared "you are now researching NVDA" header/breadcrumb carrying price+P/E+return+rank together. A coherent redesign would give the entity (ticker) page a persistent lightweight strip — price / day% / P/E / 1-3-6M return / factor rank — that stays visible whichever of themes→ticker→fundamental→screener a user is currently on for that symbol, so "확인" tasks like (c) and (e) don't require mentally reconciling four separately-fetched, separately-formatted views of the same company.

---

## Open / unverified items
- 소프트웨어/방산·항공/로보틱스 theme-detail leader-coverage and temperature-copy staleness — presumed same pattern as 반도체 by code inspection, not independently re-opened.
- KR theme detail panel's *intended* content (headings, insight structure) could only be read from source (`showKrThemeDetail`/`_buildKrThemeDeepAnalysis` in `js/aio-kr-data.js`), never seen rendered, because it throws before producing DOM — so its own internal quality (beyond "does it load") is unassessed.
- Recent-search chip concatenation ("NVDA005930") confirmed only via `get_page_text` extraction, not a visual screenshot.
- Mobile check limited to #themes and #ticker(NVDA); #fundamental and #ticker(KR) not verified at mobile width.
- Screenshot tool was unreliable for most of this session (repeated timeouts describing the pane as hidden/minimized) — all findings from that portion rely on DOM text/state reads rather than visual confirmation; flagged inline throughout.
