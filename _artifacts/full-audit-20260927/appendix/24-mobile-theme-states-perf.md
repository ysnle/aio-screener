# AIO Screener — Mobile / Theme / State / Performance Audit

Audited live: https://ysnle.github.io/aio-screener/ (v56.33), 2026-09-28 (Mon), via built-in browser tools in an isolated tab (tab-2). Local source read-only at C:\projects\AIO. No forms submitted, no writes, no destructive actions.

Routes confirmed from nav (17 total, via `[data-action="showPage"]`):
`briefing, home, market-news, signal, breadth, sentiment, technical, macro, fxbond, themes, portfolio, fundamental, screener, principles, masters, atlas, guide`

Architecture note relevant to all tasks: the SPA keeps **all 17 page DOMs mounted simultaneously** (`.page` elements toggled via `display:none`), inside one scroll container `#main-content .content` (NOT `document.body`). Measurements below are scoped to the active page + persistent chrome; anything scoped to `document.documentElement` alone (naive `scrollHeight`) would be wrong (always reads 812/vh) — noted as a pitfall for future QA scripts.

---

## TASK A — Mobile pass (375×812) on all 17 routes

Method: `showPage(route)` via JS (equivalent to tapping nav), then measured `document.documentElement.scrollWidth` vs `innerWidth`, `#main-content.scrollHeight/clientHeight` (screens-to-bottom), tap targets <40px via `getBoundingClientRect`, font-size <12px sampling scoped to the active page, sticky/fixed elements, and table horizontal-scroll containment. Screenshots taken for home, screener, masters; header zoomed.

| Route | H-overflow | Screens to bottom (vh=812) | Small tap targets (<40px) | Small font (<12px) count (active page only) | Notes |
|---|---|---|---|---|---|
| home | No | 2.2 | 11 (global chrome, see below) | 22 | Onboarding "처음 오셨나요?" card is the primary above-the-fold content, fine |
| briefing | No | 9.1 | 11 | 107 | Long — pipeline status widgets add length |
| market-news | No | 6.1 | 28 (news list buttons — expected, list items) | 41 | "최신순/중요도순" sort chips also 36px tall, OK |
| signal | No | 3.2 | 12 | 157 | Ticker strip (SPX/NASDAQ figures) drives font count |
| breadth | No | 3.0 | 11 | 3 | |
| sentiment | No | 2.1 | 12 | 18 | |
| technical | No | 3.9 | 11 | 10 | |
| macro | No | 6.3 | 11 | 35 | KR index cards here — see Task C, critical bug |
| fxbond | No | 3.5 | 11 | 81 | 1 table, in scrollable container |
| themes | No | 2.3 | 14 | 352 (RRG chart labels) | Heaviest active-page DOM (3,782 nodes) of any route |
| portfolio | No | 1.5 | 12 | 11 | Empty/first-run state ("첫 종목 추가") — see Task D |
| fundamental | No | 0.9 | 11 | 13 | Single screen because no ticker selected by default — see Task D |
| screener | No (doc-level) | 5.1 | 11 | 31 | **Table needs horizontal scroll**: table 837px wide inside 329px container. Only 4 of many columns visible (관심·비교/상대 점수/등급/종목); company names truncated ("Advanced M…", "Bloom Energ…"); no visible scroll affordance/shadow hint. Also 21 sticky `<th>`/`<td>` elements pinned during scroll. |
| principles | No | 4.9 | 12 | 40 | |
| masters | No (doc-level) | 16.5 | 14 | 1 | **13F holdings table cut off on the right** — SHARES column value truncated mid-number ("227,917…"), further columns (% of portfolio, value change) require horizontal swipe with no visible scrollbar/affordance. Very long page (16.5 screens). |
| atlas | No | 18.6 | 11 | 52 | Longest page (18.6 screens) |
| guide | No | 14.5 | 8 | 3 | Sticky footer-nav block at bottom (272px tall sticky element) |

**Global tap-target issues (present on every route, part of persistent header/chrome):**
- Secondary "☰" icon (in-page menu, distinct from the main 56×56 hamburger): **25×26px** — below the 44×44 (iOS HIG) / 48×48 (Material) and even the 40×40 threshold used here.
- "×" dismiss button (onboarding/welcome card close): **27×29px** — same issue.
- "AI 베타" badge/button: **~34–50px wide but only 34px tall** — under the 40px height threshold.
These three repeat on all 17 routes since they're global chrome, so every single page has at least 2–3 sub-40px tap targets clustered in the top header, a high-traffic area for a phone-first audience.

**Text truncation (header, all routes):** breadcrumb-style page title, "부분 LIVE" badge, and "일부 실시간 오…" status text are all clipped with "…" in the 375px header — confirmed via screenshot on `home`, `guide`, `screener`, `masters` and matches the `screensToBottom`/DOM sampling on the rest.

**Horizontal overflow:** No route showed `document.documentElement.scrollWidth > innerWidth` — i.e., no page-level horizontal scroll/bleed. The only horizontal-scroll problem is **inside** specific tables (screener, masters), which is contained scroll, not a page bug, but is a usability problem on a touchscreen because there's no scroll-shadow/chevron hint.

**Fixed-element check:** every route reports a "fixed, 812px tall" element — this is `#ai-panel` (the AI chat drawer), positioned `fixed` but pushed off-screen via `transform: translateX(100%)`. This is **not** an overlay bug (verified via computed style: `opacity:1`, `pointer-events:auto`, `transform: matrix(1,0,0,1,400,0)` = fully off-canvas at x=400 on a 375px viewport). No content is actually being hidden by it. Flagging only so it isn't mistaken for a real bug in future QA.

### Tablet (768×1024) — 5 key routes
| Route | H-overflow | Screens to bottom | Table note |
|---|---|---|---|
| home | No | 0.9 | — |
| screener | No (doc-level) | 2.7 | Table still 837px in a 731px container → still needs ~106px horizontal scroll, less severe than mobile but not fixed by the wider viewport |
| technical | No | 1.6 | — |
| portfolio | No | 0.9 | Table fits (710px in 768px container) |
| fundamental | No | 0.9 | Empty state, same as mobile |

**Untested on mobile/tablet:** did not test with a screen reader, did not test real touch gestures (pinch-zoom, momentum scroll) — only measured layout geometry and simulated clicks; did not test the AI chat panel's actual open state (kept read-only, did not open drawer since typing/sending was out of scope); did not test every modal/tooltip popover on every route (spot-checked a few `?` tooltips only).

---

## TASK B — Dark / light mode

- Dark mode **exists** but is a **manual toggle only** (`toggleTheme()` in `js/aio-ui.js:7467`, persisted to `localStorage.aio_theme`). It is **not** wired to `prefers-color-scheme` / `matchMedia` — setting the browser/OS color scheme to dark via `resize_window({colorScheme:'dark'})` had **no effect** on the page; the class only changes via the in-app toggle button (`#theme-toggle`, in the hamburger/sidebar menu). For a phone-first family audience, this means a user with an OS-level dark mode preference gets no automatic dark theme — they must know the in-app toggle exists.
- When manually toggled, dark mode works globally (`body.dark-theme`), background/text contrast looked good in the screenshot (near-black bg, white/light-gray text, readable headings).
- **Contrast/color bug found in dark mode (and also present in light mode, so not dark-mode-specific but discovered via the dark-mode pass):** elements carrying classes `pos.a11y-up` / `neg.a11y-dn` (used for the S&P 500 / NASDAQ change badges on the home page top strip and the `stk-c` ticker-strip items) have **no matching color CSS rule** — only `.pnl.pos { color: var(--data-green) }` exists, which doesn't match plain `.pos`. Verified via computed style:
  - Dark mode: `.pos.a11y-up` renders `rgb(163,164,158)` (neutral gray) instead of green, even for `+0.51%`/`+0.48%`.
  - Light mode: `.pos.a11y-up` (+0.51%, +0.43%, +0.71%) and `.neg.a11y-dn` (-5.11%, -1.42%, -0.70%) **all render the identical gray `rgb(87,81,63)`** — up and down are visually indistinguishable by color; the only differentiator is the `▲`/`▼` prefix glyph injected by `.a11y-up::before`/`.a11y-dn::before` (index.html:4322).
  - This is a genuine, theme-independent CSS coverage gap, not just a dark-mode contrast issue. Elsewhere in the app (`.gmo-chg.gmo-pos`, inline `style="color:var(--green)"` set by JS in `aio-workspace.js`/`aio-kr-data.js`) color coding works correctly and dynamically.
- Charts/canvases: `body.dark-theme canvas { filter:none; }` — i.e., charts are explicitly exempted from any dark-mode filter, so they should render with their own dark-aware palette rather than being auto-inverted; did not load a chart with live data to visually confirm since data is currently stale/pending (see Task D) and charts mostly showed empty/placeholder state during this pass.
- No hardcoded `background:#fff`/`color:#000` style literals were spotted in the CSS sampled (colors are consistently themed via CSS custom properties `--green`/`--red`/`--text-*`/`--bg-*`), except the two `.pos`/`.neg` gaps above which aren't "hardcoded wrong colors" but "no color rule at all."

**Untested:** did not systematically screenshot all 17 routes in dark mode (spot-checked `home` only) — given the CSS is variable-driven and the only concrete color-coverage bug found is theme-independent, this is a reasonable scope cut, but a full per-route dark screenshot pass was not done.

---

## TASK C — Up/down color convention

**Overall intended convention:** green = up, red = down (`--green:#22754c`, `--red:#b13a30`, mirrored in `--data-green`/`--data-red`) — i.e., the **US/international convention**, applied uniformly to both US and Korean instruments. This does **not** match the Korean domestic convention (red = up/상승, blue = down/하락) that family members likely see in Korean brokerage apps and financial news. This is a **design/localization mismatch** worth a product decision (not a code bug, since it is at least applied consistently by design) — but it is a real risk of habitual misreading for a Korean, non-technical, real-money-trading audience, especially at a glance on mobile.

**Critical live bug found (index.html lines 9286–9313, macro page → "한국 시장 통합" → "핵심 지수" grid):** the 4 KR summary cards (KOSPI/KOSDAQ/KRW·USD/VKOSPI) have their `up`/`down` CSS class and inline `color:var(--green)`/`color:var(--red)` **hardcoded in the static HTML markup** and are **never updated by JavaScript** (confirmed: zero matches for `kr-idx-card` in any `.js` file — only the numeric text inside nested `data-live-*` spans is live-updated, the color/class wrapper is not).

Live-observed right now (2026-09-28, market data from 9/23 last close):
| Card | Hardcoded class/color | Actual live value | Correct? |
|---|---|---|---|
| KOSPI | `up` / green | ▼ 103.34 (**-1.46%**) | **Wrong — shown green (up-color) while actually down** |
| KOSDAQ | `down` / red | ▲ 13.79 (**+1.63%**) | **Wrong — shown red (down-color) while actually up** |
| KRW/USD | `down` / red | ▲ 2.9 (+0.21%) | Ambiguous (won weakening framed as "down"); text itself is muted gray, only the price figure is hardcoded red |
| VKOSPI | `up` / green | 수신 실패 (no data) | N/A currently, but class is still permanently "up" regardless of value once it does load |

This means the color (border-left accent + price/change text color) for these four cards is **essentially a coin flip against reality** — currently 2 of 2 populated cards are showing the opposite of their actual direction. The ▼/▲ arrow glyphs and numeric percentages are correct; only the color styling is stale/hardcoded. This is the single most user-facing, misleading finding in the whole audit, because it's exactly the kind of "glance and trust the color" moment a family member would rely on for a quick market check, and it's currently showing backwards.

**Secondary finding:** `.pos.a11y-up`/`.neg.a11y-dn` elements (home page S&P/NASDAQ tiles, ticker-strip stock items) carry no color at all in either theme (see Task B) — direction is conveyed only by the arrow glyph, inconsistent with the rest of the app's color-coded convention.

**Consistent/correct elsewhere:** portfolio P&L (`aio-workspace.js`), watchlist YTD/1Y (`aio-ui.js`), bond spreads, KR foreign/institutional net-buy tables (`aio-kr-data.js`) — all dynamically compute `val >= 0 ? green : red` per render and were internally consistent wherever checked.

**Untested:** did not check chart candlestick colors (charts were not rendering with live series during this pass, see Task D) or the RRG/heatmap sector-rotation color scale in detail beyond the label text ("녹색↑=강세, 적색↓=약세" — consistent with the green=up convention).

---

## TASK D — Failure / empty / loading states

Cross-referenced code (`js/aio-data.js`, `js/aio-ui.js`, `js/aio-kr-data.js`) with live console/network observation.

**1. Server `data.json` is stale (confirmed live: `generatedAt: 2026-09-26T01:35:13Z`, ~2 days old as of audit time, spanning the weekend):**
- Home page shows: 시장 환경 점수 "**—/100**", "**판정 보류 — 필수 입력 미수신**" (judgment withheld — required inputs not received), and lists each sub-score (변동성 —/25, 추세 —/20, 심리 —/25, 시장 폭 —/20) as dashes.
- Console emits structured warnings: `[AIO 운영 점검] 2개 항목 주의 · core live quote coverage incomplete · 20 stale live price(s)`, and `[AIO:debug] 이슈: 시세 20/20 stale`.
- Message tone is honest about *not knowing* rather than fabricating a score — this is good practice (no silent stale number presented as fresh). However, the wording "필수 입력 미수신" is technical/operations jargon, not obviously actionable to a non-technical reader — it doesn't say "시장이 주말이라 그렇습니다, 월요일 개장 후 갱신됩니다" or similar plain-language reason.

**2. Proxy chain failures (observed live in console/network, this session):**
- Repeated `401`, `403`, `422`, `404`, `503 (offline)` from multiple CORS proxy providers (`api.codetabs.com`, `corsproxy`, `allorigins-raw`, `allorigins-get`, Cloudflare Worker `cf-worker`), each disabled after 3 fails with a cooldown (`proxy allorigins-raw disabled (level 1, cooldown 68s)` etc.), and `proxy-primary: ok → warn → error {errCount: 3}`.
- Several of these fetches that *do* succeed are extremely slow: slowest live resources during this session were `stooq.com` quote fetches at 6.5s each and a `codetabs` proxy call at **8.78s**, several `allorigins` RSS/Yahoo fetches at ~4.0s each (see Task E). This directly explains why score panels sit in "판정 보류" for a long time even when the network eventually succeeds.
- User-facing effect: **no visible toast/banner explaining "실시간 시세 연결 실패 — 이전 데이터 표시 중"** was observed on the routes visited; the failures are logged to console only (invisible to a non-technical user) while the UI quietly shows "—" or last-known values. A family member has no way to know from the UI *why* things say "판정 보류" versus a real outage versus their own network being down.

**3. Market closed (weekend/holiday) — no explicit awareness:** grepped for holiday/Chuseok-specific handling; found none. Generic fallback strings exist ("장 마감 후 또는 API 장애" — "after market close or API failure", `aio-kr-data.js:1163`) that **conflate two very different situations** (normal market closure vs. an actual bug/outage) into one message. There is no calendar-aware "오늘은 미국/한국 휴장일입니다" messaging distinguishing a holiday from a technical failure — this matters this week specifically since KR had Chuseok holidays and the server data is stale across that gap.

**4. Symbol has no data:** `fundamental` route (no ticker selected) shows a single-screen state "○ SEC 데이터 미수신" / "SEC 공식 연간 재무 스캔 (참고용) — 종목 선택 후 SEC 재무 보기" — clear, actionable ("select a ticker first"), good example of a well-written empty state.

**5. First visit / empty localStorage:**
- `portfolio` route shows "첫 종목 추가" (add your first holding) CTA — clear and actionable.
- `home` route shows a one-time onboarding card ("처음 오셨나요? — 어디서 시작할지 골라보세요") with 3 shortcut buttons (오늘 브리핑/시장 환경/학습 가이드) — good first-run UX, dismissible, marked "한 번만 표시됩니다" (shown once).

**Overall assessment for Task D:** messages are generally *honest* (no fabricated numbers presented as live) and in a couple of cases *actionable* (fundamental empty state, portfolio empty state), but they are **not consistent** in register — some are plain Korean ("첫 종목 추가"), others are technical/ops-toned ("필수 입력 미수신", "core live quote coverage incomplete" in console only), and the most common real-world cause of staleness this week (a holiday weekend) is never called out explicitly to the user, only implied by generic "장 마감 후" boilerplate. A non-technical family member seeing "판정 보류" for two days has no way to distinguish "the market was just closed" from "something is broken," which is a real trust/actionability gap for the target audience.

**Untested:** did not clear localStorage and do a true first-visit test (would have altered the shared browser profile mid-audit and risked interfering with the concurrent agent); relied on the visible "한 번만 표시됩니다" onboarding card and code inspection instead. Did not trigger a live 401/403 by blocking network myself — relied on naturally-occurring failures visible in this session's console.

---

## TASK E — Mobile performance

Captured via `performance.getEntriesByType('navigation'|'resource'|'paint')` and `performance.memory` on the `home` route, mobile viewport, light theme, single fresh navigation.

| Metric | Value |
|---|---|
| `domInteractive` | 80 ms |
| `responseEnd` (main document) | 76 ms |
| `domContentLoadedEventEnd` | 335 ms |
| `loadEventEnd` | 339 ms |
| Main document `transferSize` | **998,384 bytes (~975 KB)** for `index.html` alone |
| First Paint / First Contentful Paint | **10,768 ms** — but see caveat below |
| Resource count | 250 |
| Total resource transfer (measured) | 0 bytes (see caveat) |
| JS heap used / total / limit | 181.5 MB / 185.3 MB / 4,192 MB |
| DOM nodes (all 17 pages mounted) | 6,700–12,600 depending on route (see Task A table) |
| Long tasks observed | 0 (see caveat) |

**Slowest 10 network resources (this session, live):**
1. `api.codetabs.com` proxy → stooq CL.F (oil) — **8,782 ms**
2. `stooq.com` CL.F direct — 6,516 ms
3. `stooq.com` GC.F (gold) — 6,501 ms
4. `stooq.com` DX.F (dollar index) — 6,501 ms
5. `allorigins.win/raw` Business Insider RSS — 4,016 ms
6. `allorigins.win/raw` PR Newswire tech RSS — 4,015 ms
7. `allorigins.win/get` FT markets RSS — 4,014 ms
8. `allorigins.win/get` BBC business RSS — 4,014 ms
9. `allorigins.win/get` Dow Jones realtime RSS — 4,010 ms
10. `allorigins.win/raw` Yahoo Finance KRW=X chart — 4,007 ms

These 4–9 second stalls on third-party CORS-proxy relays are the direct mechanical cause of the "판정 보류"/stale states in Task D — even when a proxy eventually succeeds, it can take most of 10 seconds per symbol, and several fail outright (see Task D console log).

**Caveats on the numbers above (important — do not take at face value without these):**
- **FCP = 10.8s is very likely inflated by background-tab throttling**, not representative of a real user's experience: this tab was opened with `foreground:false` per the audit's own tooling constraint (must not interfere with a concurrently-used browser) and spent time backgrounded before being read; Chromium can defer actual paint/compositing for backgrounded tabs, which would show up as an inflated Paint Timing entry despite `domContentLoaded`/`loadEvent` both completing in ~340ms. **Recommend re-measuring FCP on a real foregrounded phone** rather than trusting this number.
- **Total resource transfer = 0 bytes is an artifact, not reality**: most of the slow/large fetches are cross-origin (proxies, Yahoo, stooq, RSS feeds) without a `Timing-Allow-Origin` header, so the Resource Timing API reports `transferSize: 0` for them per spec (opaque cross-origin timing). Real bytes transferred are non-zero and likely substantial given 250 resources; this number should not be quoted as "the page is free," it's a measurement blind spot.
- `longtask` count of 0 is likely an undercount: `performance.getEntriesByType('longtask')` without a `PerformanceObserver({buffered:true})` registered from page start can miss tasks that occurred before the audit script attached.
- 181.5 MB JS heap for a single mobile page (before even opening AI chat or loading chart libraries fully) is on the high side for a phone-class device; this is worth monitoring on older/lower-RAM iPhones, though it did not cause an observable crash in this session.
- The 975 KB single-file `index.html` transfer (consistent with project history of it being a large monolithic HTML file) is a meaningful fixed cost on a mobile connection before any data even starts loading.

**Untested:** did not repeat the performance capture across all 17 routes (only `home`); did not test on a throttled/slow-3G network profile; did not measure Largest Contentful Paint or Cumulative Layout Shift; did not test with the browser tab foregrounded the whole time (see FCP caveat) — a follow-up pass with `tabs_select` to foreground the tab before measuring FCP would give a trustworthy number.

---

## TASK F — iOS Safari / PWA / storage considerations (from code)

| Item | Finding |
|---|---|
| `navigator.storage.persist()` | **Not used anywhere** in the codebase (0 matches in `js/*.js`). Portfolio, watchlist, chat history, and API keys stored in `localStorage` (confirmed: `aio_watchlist`, `aio_trader_profile`, proxy cache entries, chat history, per `aio-data.js`/`aio-workspace.js`) have **no persistence request**, leaving them exposed to Safari ITP's ~7-day script-writable-storage eviction if a family member doesn't open the site for a week. |
| Backup/export reminder | A manual `exportPortfolio()` button ("내보내기") exists on the `portfolio` page (`index.html:11037`), and the 사용 설명서 (guide) page explicitly warns: *"모든 데이터는 브라우저 localStorage에 저장됩니다. 시크릿/프라이빗 모드, 브라우저 데이터 삭제, 다른 기기에서는 데이터가 없습니다. 포트폴리오는 JSON 내보내기로 정기 백업하세요."* — good, honest documentation, but it is a **passive, one-time-read warning**, not a proactive/periodic in-app nudge (e.g., no "N일째 백업 안 함" reminder banner was found). |
| API key backup | A `showToast` warning fires when chat-history localStorage nears capacity: *"채팅 기록 용량 초과 — 자동 정리 (50건 유지). 키 백업 권장 (AIO.exportApiKeys())"* — reactive, not proactive, and only console-logs a stronger warning (`console.error('...backup API keys NOW.')`) that a non-technical user would never see. |
| PWA manifest | **Explicitly disabled**: `index.html:25-26` — `<!-- v49.43 P310 hotfix: manifest.json 참조 제거 — GitHub UI에서 manifest.json 삭제됨. PWA 비활성. -->` (manifest link commented out, "PWA disabled"). No `apple-touch-icon` link tag found anywhere in `index.html`. |
| Add-to-Home-Screen | Still possible manually on iOS Safari (Share → Add to Home Screen always works), but **without a manifest or apple-touch-icon**, the resulting home-screen icon will be a generic auto-captured page-screenshot thumbnail rather than a proper app icon, and it will open inside Safari chrome rather than a standalone/full-screen window. |
| Service worker | **Registered and active**: `navigator.serviceWorker.register('./sw.js', {updateViaCache:'none'})` (`js/aio-ui.js:7510`). `sw.js` (`SW_VERSION 'v56.61'`) implements shell = Network-First with cache fallback, data = Network-First + cache fallback — gives some offline resilience for the app shell even though full PWA installability is off. |
| Viewport meta | Present and correct: `<meta name="viewport" content="width=device-width, initial-scale=1.0">` (`index.html:5`). |
| IndexedDB | Used only for a bounded news cache (`js/aio-data.js`, object store `'news'`), not for portfolio/critical user data — so the ITP eviction risk above applies specifically to the **localStorage-resident** portfolio/watchlist/keys, not to news cache (which is fine to lose). |

**Net assessment:** the single biggest real risk for the family-member/iOS-Safari use case is that **portfolio and watchlist data live only in localStorage with no `storage.persist()` call**, combined with a manual (not automatic, not periodic-reminder) export as the only backup path. Given usage is likely bursty (a person might not open the app for over a week during a busy stretch — as just happened over the Chuseok holiday), this is a plausible real-world data-loss scenario for real trading records, not a theoretical one.

**Untested:** did not actually leave the site untouched for 7 days to reproduce ITP eviction (not feasible in this session); did not test the manifest-disabled state's practical effect on an actual iOS device's "Add to Home Screen" flow (code-inspection only, no physical iPhone available); did not audit whether `AIO.exportApiKeys()`/`exportPortfolio()` produce correct/complete JSON (did not click "내보내기" since it could trigger a file download, which requires explicit user permission per this audit's rules — flagging as untested rather than downloading).

---

## Severity summary (top items)

| # | Finding | Task | Severity |
|---|---|---|---|
| 1 | KOSPI/KOSDAQ/KRW/VKOSPI summary cards on `macro` page have hardcoded up/down colors never synced to live data — currently showing **both populated cards backwards** (KOSPI down shown green, KOSDAQ up shown red) | C | **High** — actively misleading, live right now |
| 2 | Portfolio/watchlist/API-key data lives only in localStorage with no `storage.persist()`; backup is manual-only | F | **High** — real trading-record loss risk for a low-engagement family user |
| 3 | Proxy chain (CORS relays) frequently fails (401/403/422/503) or takes 4–9s per call, driving the persistent "판정 보류" stale states; failures are console-only, invisible to the user | D, E | **High** — core "live" value proposition is degraded and unexplained to non-technical users |
| 4 | `.pos.a11y-up`/`.neg.a11y-dn` elements have no color rule — up/down conveyed by arrow glyph only, in both themes | B, C | Medium |
| 5 | Screener and Masters (13F) tables require horizontal scroll on mobile with no scroll affordance; columns/names truncated | A | Medium |
| 6 | Global header has 2–3 tap targets under 40px (secondary ☰, ×, AI 베타 height) on every route | A | Medium |
| 7 | Dark mode is manual-only, not tied to OS `prefers-color-scheme` | B | Low–Medium |
| 8 | No PWA manifest / apple-touch-icon; "Add to Home Screen" gives a generic icon, no standalone mode | F | Low–Medium |
| 9 | Green=up/red=down applied uniformly instead of Korean red=up/blue=down convention | C | Low (design decision, flagged for product awareness) |
| 10 | No holiday-aware messaging; generic "장 마감 후 또는 API 장애" conflates normal closure with real failures | D | Low–Medium |
| 11 | Main `index.html` ~975 KB single-file transfer; FCP measurement likely skewed by background-tab throttling (needs re-test foregrounded) | E | Informational / needs re-test |

## Explicitly untested / out of scope this pass
- Full dark-mode screenshot sweep of all 17 routes (spot-checked `home` only)
- Real device testing (iOS Safari physical device, actual 7-day ITP reproduction)
- True empty-localStorage first-visit run (would require clearing storage on a shared/concurrent browser session — avoided)
- Network-throttled (slow 3G) performance run
- LCP/CLS metrics, per-route performance capture (only `home` measured)
- Screen-reader/assistive-tech pass
- Opening the AI chat panel, sending any message, or clicking "내보내기"/export downloads (avoided per no-form-submission / no-download-without-permission constraints)
- Candlestick/chart color-convention check (charts were not rendering live series during this stale-data window)
