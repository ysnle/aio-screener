# AIO Screener — Interaction Click-Through Audit

Live site: https://ysnle.github.io/aio-screener/ (v56.33)
Local source cross-referenced (read-only): C:\projects\AIO\index.html, js\aio-ui.js, js\aio-core.js
Method: own browser tab (tab-1, closed at end), DOM inspection via read_page/find/javascript_tool (read-only), source grep to confirm root causes. No forms submitted, no AI chat sent, no portfolio positions added, no deletes/resets clicked, no API keys entered.

Note on shared state: this is the shared production site (localStorage is per-browser-profile, not per-tab). Evidence found a leftover recent-search entry `"NVDA005930"` and a `005930` fundamental-lookup query in `localStorage.aio_fund_recent`, most likely left by the concurrent agent mentioned in the task brief. Treated as a data point (see Fundamental page finding) rather than something I caused.

---

## 1. Coverage table (routes found / exercised)

The nav sidebar exposes 15 routes; 2 more (`#options`, `#ticker`) exist but are **not in the nav** (URL-only / cross-link-only); `#glossary` and `#guide` are reachable from the nav footer.

| # | Route (hash) | In nav? | Controls found | Controls exercised | Notes |
|---|---|---|---|---|---|
| 1 | `#home` (실제 라벨 "대시보드") | Yes | 10 market-snapshot buttons, onboarding banner (3 links+close), nav | All snapshot buttons enumerated, 1 onboarding link clicked, hamburger toggle tested | |
| 2 | `#briefing` (오늘의 브리핑) | Yes | nav only (page-level) + AI quick-chips (skipped) | Loaded, scrolled, read | No page-specific buttons besides AI chips |
| 3 | `#market-news` | Yes | 새로고침, external Telegram links (×6+) | 새로고침 clicked, 1 href inspected | Guide-promised 국가/토픽 filter absent |
| 4 | `#signal` (지금 거래해야 할까?, nav label "시장 환경") | Yes | 스윙/데이트레이딩 toggle, "?" tooltip | Both tabs clicked, tooltip clicked+hovered | Checklist heading doesn't relabel; tooltip dead (see findings) |
| 5 | `#breadth` (시장 폭) | Yes | none besides AI chips | Loaded, scrolled | 1 dead tooltip found via source |
| 6 | `#sentiment` (투자 심리) | Yes | "VIX 기간구조 설명" button | Clicked | Dead — no visible output |
| 7 | `#technical` (차트·기술분석) | Yes | SPY/QQQ toggle, ticker input + "차트 분석" button | Typed NVDA (works), invalid ticker ZZZZQQ (graceful) | |
| 8 | `#macro` (거시경제) | Yes | none | Loaded, scrolled | Pure display page |
| 9 | `#fxbond` (환율·채권) | Yes | none | Loaded, scrolled | Pure display page |
| 10 | `#themes` (테마·트렌드) | Yes | 11섹터/서브섹터/전체 tabs, 14 US theme "상세 열기" buttons | Both tabs, 8 US theme details opened (반도체/소프트웨어/방산항공/로보틱스/에너지/헬스케어/금융/소비재) | **No Korean themes exist anywhere on this page** (see findings) |
| 11 | `#portfolio` | Yes | 종목추가, 첫종목추가, 내보내기, 가져오기(file), 시세갱신, 전체삭제 | 시세갱신 clicked (safe); 종목추가/첫종목추가/전체삭제/가져오기 intentionally NOT clicked per hard rules | Empty state confirmed clean |
| 12 | `#fundamental` (기업 분석) | Yes | ticker input, 개요/재무상세/외부정보 tabs, 포트폴리오에 추가, 차트분석 | AAPL (full data), 005930 (graceful fail), tabs clicked | "포트폴리오에 추가" intentionally not clicked; recent-search corruption found |
| 13 | `#screener` (퀀트 스크리너) | Yes | preset dropdown, 6 preset buttons (dup of dropdown), 새화면/저장/조건실행, filter dropdowns×4, search, 컬럼선택, sort headers, row "Why" drawer | Preset switched, sort header toggled asc/desc, row clicked → Why drawer opened + closed via 기업보기 link | 기업보기 → navigates to real `#ticker` page |
| 14 | `#ticker` (종목 상세 — not in nav, reached from Screener "기업 보기") | No | 종목검색 input, quick chips NVDA/AAPL/TSLA/MSFT/AMZN, 캔들패턴 갤러리, etc. | Searched AI(C3.ai)→005930→ZZZZQQ in sequence | Confirmed **no shareable per-symbol URL**; title always lags one symbol behind |
| 15 | `#principles` (시장 원리) | Yes | 이어읽기/개념지도/관계지도/선택학습/참고자료실 tabs, 6 module cards | All 5 tabs clicked (mode= URL changes correctly); module cards clicked (no response) | |
| 16 | `#atlas` (AI 시대 지식 지도) | Yes | 학습지도/관계지도/산업가치사슬/근거자료실 tabs, search box, 북마크, 메모+저장 | Search "rsi" tested (no result, no "no results" message) | |
| 17 | `#masters` (대가의 포트폴리오) | Yes | 전체/13F연결/방법론전용 tabs, 투자자검색, 티커/CUSIP 역조회 | Searched NVDA in reverse-lookup | Stuck at "참조용 티커 원장을 불러오는 중입니다" (never resolved) |
| 18 | `#guide` (사용 설명서) | Yes | 빠른이동 chips (9), search-jump result cards (dead), API설정/settings panel, dark-mode toggle, glossary launcher | All quick-jump tabs clicked, dark mode toggled, full API-key panel enumerated (inspect-only) | "검색 결과 N" cards are non-interactive text, not jump links |
| 19 | `#glossary` (용어사전 modal, not a real route) | Yes (footer) | search box, 10 category chips, 275-entry list | Searched "RSI" → correct filtered results | Works well |
| 20 | `#options` (옵션 분석 — not in nav) | No | 투자심리보기/매매신호보기 cross-links | Both concept verified, 1 clicked → navigated correctly | Reachable only via direct URL |
| — | 시스템 자가 진단 (20-item self-diagnosis checklist) | Hidden | `.aio-audit-widget` | Located in DOM, root-caused via source | **Never visible to any user action** — gated by `localStorage.aio_audit_mode==='detailed'`, no UI control sets this flag. Did not force-enable (would require setting localStorage, outside the "navigation-only" mutation rule) |
| — | Global search / command palette | N/A | Ctrl+K per shortcuts modal | Tested on 3 pages | **Confirmed dead everywhere** — targets `.search-bar input`, a class that does not exist anywhere in shipped HTML |
| — | Keyboard shortcuts | N/A | Esc, Ctrl+K, `?`, 1-8, G, R | All tested | `?` and Esc work; 1-7 work; **`8` is mislabeled** (see findings); Ctrl+K dead |
| — | Back/forward + deep links | N/A | browser back/forward, `#ticker/AAPL`, `#options` cold reload | Tested | Standard routes (`#screener`, `#options`) reload fine cold; `#ticker/<SYMBOL>` and `#fundamental` ignore URL ticker entirely |

Not reached: 서브섹터 view's remaining themes were opened (4/4); 11섹터 view's remaining 3 themes (통신/유틸리티/원자재/부동산/필수소비/산업재/에너지 already covered — see below) were not individually opened beyond the 8 sampled, due to time budget — no reason to expect different behavior since all 8 sampled followed an identical template.

---

## 2. Findings by page (severity: Critical / High / Med / Low)

### Cross-cutting

| Severity | Finding |
|---|---|
| **High** | **No Korean (KR) themes exist anywhere on the Themes page**, despite the Guide explicitly documenting "테마·트렌드에서 국내 테마 연결 정보를 확인합니다" and "테마·트렌드 내 국내 테마: 국내 테마가 연결된 경우 카드·종목 상세로 이동." Checked 11섹터/서브섹터/전체 tabs and all 14 US theme detail panels (8 opened directly) — no KOSPI/KOSDAQ section, no "미수신" placeholder for KR themes either. Task's ask to "open ≥5 KR themes" could not be satisfied because the feature is not present, not merely empty. |
| **High** | **Global search / command palette (Ctrl+K) is completely non-functional site-wide.** The keyboard-shortcuts modal advertises "Ctrl+K → 빠른 검색 포커스". Source (`js/aio-ui.js:5047`) does `document.querySelector('.search-bar input')` — grep of the entire shipped `index.html` shows **zero** elements with class `search-bar` (only 5 orphaned CSS rules at lines 1785/2194-2219). Pressing Ctrl+K on Home/Screener/Atlas does nothing observable. There is no unified search across NVDA/삼성전자/005930/RSI-style queries; each page has its own local ticker/text input instead. |
| **High** | **6 "?" info tooltips are dead (no content) across 3 pages.** They use `.term-tooltip` + `.tip-icon` with CSS `:hover { display:block }` on a sibling `.tip-body`, but 6 instances in the source ship with **no `.tip-body` at all**: SKEW, Put/Call, 딜러 감마, 기관 매매 (all on `#signal` — "지금 거래해야 할까?"), "5·20·50일선 상회 종목 비율" (on `#breadth`), and "Fear & Greed·VIX 기간구조·AAII·Put/Call·HY 스프레드" (on `#sentiment`). Confirmed empirically: clicking/hovering the "?" next to "스윙 환경 체크리스트" on Signal produces nothing (`title=""`, no tip-body sibling in DOM). |
| **Med** | **Ticker/기업 분석 recent-search history accepts and stores malformed input verbatim.** `localStorage.aio_fund_recent` contained `"NVDA005930"` as a single saved ticker (two symbols concatenated with no delimiter) — the UI renders it as one garbled chip in "최근 검색: AAPL, NVDA005930, NVDA" and the chip itself is a non-interactive `<span>` (dead, can't even be clicked to retry). No format validation on save. |
| **Med** | **Deep-linking to a specific ticker does not work.** `#ticker/AAPL` and `#fundamental` (typed/pasted URL) are silently ignored — confirmed via cold reload (F5): the page always restores whatever was last searched via `localStorage`, never the URL suffix. `#ticker` itself carries no symbol in the hash at all even after a successful in-app search (URL stays exactly `#ticker` for every symbol). Sharing a "look at this stock" link with a family member is not possible. |
| **Med** | **Ticker page document title lags one symbol behind the visible content**, every time, reproducibly: after searching 005930 the tab title still read "AI" (the *previous* symbol); after then searching the invalid ZZZZQQ, title showed "005930". Confirmed 2/2 times. |
| **Low** | Keyboard shortcut **`8` is mislabeled** in the "?" help modal: modal says `8 → 한국장`, but `js/aio-ui.js:5065` maps `'8':'themes'` (the KR-home route was retired per the code's own comment "v53.7 (P725): kr-home 퇴역" but the help-modal copy was never updated). Confirmed by pressing `8` — it opens 테마·트렌드, not any Korea-specific page. |
| **Low** | The "시스템 자가 진단" (20-item self-diagnosis checklist) mentioned in the audit brief is **not reachable through any visible UI** — it exists in the DOM (`#aio-audit-widget`, `body.aio-dev-mode .aio-audit-widget{display:block}`) but is gated by `localStorage.aio_audit_mode === 'detailed'`, which no button, toggle, or settings panel in the live UI ever sets. It is developer-only tooling (the site's own CI contract check treats it being *visible* as a shipping blocker — `developer-surface-visible` — so this is by design, not a bug, but it means a normal family-member user can never see or benefit from it). Did not force-enable via localStorage per the "navigation-only" mutation rule. |
| **Low** | Guide page's documented "용어 사전 (플로팅 버튼)" — "우하단 버튼 = 투자 용어 사전, 드래그 이동 가능" — describes a feature that **no longer exists**. Source: `<button id="glossary-btn" ... style="display:none;">` with an explicit comment "v40.6: 용어 사전 플로팅 버튼 제거 — 사이드바 '용어 사전' 페이지와 중복" (removed, superseded by the sidebar nav page). The Guide text was never updated to match. |
| **Low** | Guide claims Market News has "국가/토픽 필터" (country/topic filters); no such control exists in the DOM (`read_page` interactive scan found only 새로고침 and article links). Likely aspirational/stale documentation. |

### Home (#home)
| Sev | Finding |
|---|---|
| Low | Hamburger ("메뉴 열기") at desktop width (1024px) collapses the full labeled sidebar into a slim icon+breadcrumb rail rather than a mobile drawer — functions correctly but is an unusual desktop affordance worth a UX look. |
| — | Onboarding banner quick-links ("오늘의 브리핑"/"시장 환경"/"학습 가이드") — 1 tested, correctly routes to `#briefing`. Close button not tested (would permanently dismiss banner for future visits/family members; skipped to avoid side effects on the shared account). |
| — | All 10 market-snapshot buttons (S&P500/NASDAQ/VIX/F&G/DXY/10Y/Gold/WTI/KOSPI/BTC) enumerated; not each individually clicked (all appear to be non-navigating info readouts per their `aria-label`s, e.g. "KOSPI — 거시경제 페이지의 한국 시장 섹션" implies a cross-link but this wasn't verified per-item due to time). |

### Signal / 지금 거래해야 할까? (#signal)
| Sev | Finding |
|---|---|
| Med | Switching 스윙 → 데이트레이딩 correctly updates the weighting text and checklist thresholds below, but the section heading **"스윙 환경 체크리스트"** stays hard-coded regardless of the selected mode — it never becomes "데이트레이딩 환경 체크리스트". Label/content mismatch. |
| High | (see cross-cutting) 4 dead "?" tooltips: SKEW, Put/Call, 딜러 감마, 기관 매매. |

### Breadth (#breadth)
| Sev | Finding |
|---|---|
| High | (cross-cutting) 1 dead tooltip: "5·20·50일선 상회 종목 비율 — 상승의 참여 폭 진단". |

### Sentiment (#sentiment)
| Sev | Finding |
|---|---|
| Med | "VIX 기간구조 설명" button — a real `<button>`, not a hover tooltip — produces **no visible output** when clicked (screenshotted before/after, identical). |
| High | (cross-cutting) separate dead hover-tooltip "Fear & Greed·VIX 기간구조·AAII·Put/Call·HY 스프레드" on the same page — i.e. Sentiment has two independently-broken info affordances. |

### Technical (#technical)
| Sev | Finding |
|---|---|
| — | Ticker input + "차트 분석" button works correctly: NVDA produced a full stock-specific analysis (Weinstein stage, RSI, MAs, VCP, Fibonacci, Bollinger, weekly context); invalid ticker "ZZZZQQ" degraded gracefully ("분석 준비: ZZZZQQ..." / "일봉 20개 이상 수신 후 표시"), no crash. |
| Low | Two differently-scoped "Weinstein 4단계" sections appear on the same screen without a clear scope label — the upper one reflects the searched ticker (e.g. NVDA Stage 2), the lower full diagram always reflects the SPY/QQQ toggle selection (e.g. Stage 1, citing SPY's 771.35 close) regardless of the searched ticker. Could confuse users into thinking both describe the same instrument. |

### Market News (#market-news)
| Sev | Finding |
|---|---|
| — | 새로고침 (refresh) works, no errors, timestamp/feed unchanged (data already current). |
| Low | (cross-cutting) Guide-promised 국가/토픽 filters absent. |
| — | 6 outbound Telegram links (`t.me/insidertracking/...`) present; hrefs inspected only, not opened, as instructed. |

### Themes (#themes)
| Sev | Finding |
|---|---|
| High | (cross-cutting) No KR themes anywhere. |
| — | 11섹터 / 서브섹터 / 전체 tabs all work correctly (11, 4, 14 theme cards respectively, sums correctly). |
| — | 8 US theme details opened (반도체, 소프트웨어, 방산/항공, 로보틱스, 에너지, 헬스케어, 금융, 소비재) — each renders sub-group breakdowns, leader lists, "테마 온도 진단", benchmark comparison. No console errors from any of the 8 opens. |
| Low | Active-nav highlight briefly showed "거시경제" highlighted in the sidebar while the breadcrumb correctly said "테마 분석" and content was Themes — a transient nav-highlight desync (not reproduced on every visit, may be a render-timing artifact). |

### Portfolio (#portfolio)
| Sev | Finding |
|---|---|
| — | Empty state is clean and honest: "포트폴리오가 비어 있습니다" with clear guidance. "⟳ 시세 갱신" clicked safely (no positions to refresh, no error). "종목 추가", "첫 종목 추가", "전체 삭제", and the JSON "가져오기" file-picker were **intentionally not clicked** (would add data, delete data, or trigger a file dialog — out of scope per hard rules). "내보내기" (export) also not clicked to avoid triggering an unapproved download. |

### Fundamental / 기업 분석 (#fundamental)
| Sev | Finding |
|---|---|
| — | AAPL: full SEC EDGAR/XBRL/Yahoo data rendered correctly (Revenue, ROE, P/E, factor radar, SEC percentile rank, 개요/재무상세/외부정보 tabs all work). |
| — | 005930 (Samsung): correctly and honestly fails closed — "SEC 데이터 미수신", "외부 데이터 수신 실패 — 빈 보고서로 단정하지 않습니다" — no fabricated numbers. Appropriate, since this page is US SEC-filings-based by design. |
| Med | (cross-cutting) "NVDA005930" garbled recent-search chip. |
| — | "포트폴리오에 추가" button present but not clicked (would add a position). |

### Screener / 퀀트 스크리너 (#screener)
| Sev | Finding |
|---|---|
| — | Preset switching (균형→모멘텀 지속) correctly updates the funnel stats (873→705→204→168) and results table. |
| — | Sort header "상대 점수" toggles ascending/descending correctly (verified score order flipped 100→60 then 60→61 ascending). |
| — | Row click opens a "Why" drawer (조건 통과·순위 계산 보류) with factor breakdown, "닫기", "기업 보기" (correctly routes to the real `#ticker` detail page), and "비교 추가". |
| Low | The 6 preset buttons directly under the toolbar (균형 상대 랭킹/모멘텀 지속/추세 정렬/저변동 방어/퀄리티 결합/돌파 관찰) fully duplicate the options already in the "프리셋" `<select>` dropdown a few rows below — two different controls doing the same job, unclear which is authoritative if they ever get out of sync. |
| — | Filter dropdowns (전체 지수/전체 섹터/전체 분류/전체 시총), text search, and "컬럼 선택" all present; not individually exercised beyond enumeration due to time budget. |

### Ticker detail (#ticker — reached only via Screener "기업 보기", not in nav)
| Sev | Finding |
|---|---|
| Med | (cross-cutting) No shareable URL; title lags one symbol behind. |
| — | Quick ticker chips (NVDA/AAPL/TSLA/MSFT/AMZN) present alongside a free-text search; searched AI→005930→ZZZZQQ in sequence, all handled without crashes, each producing correctly empty/pending fields for unsupported symbols. "한국 종목은 KRX 데이터 제한으로 미지원" is disclosed inline — good, honest labeling. |
| — | 캔들 패턴 갤러리 ("패턴 감지 ↻") present; not deeply tested beyond confirming it renders per-ticker text ("AI · 음봉 · 복합 패턴 미확정"). |

### Principles / 시장 원리 (#principles)
| Sev | Finding |
|---|---|
| — | 5 tabs (이어읽기/개념지도/관계지도/선택학습/참고자료실) all switch correctly and update the URL query (`mode=story/tree/graph/path/library`). |
| Low | The 6 numbered concept-map module cards (01 돈·금리·가계 … 06 가격·리스크·복기) look like clickable cards (bordered, numbered) but produce no visible response on click — likely intentionally static, but the affordance styling suggests interactivity that isn't there. |
| — | "AI 시대 지식 지도에서 전체 연결 보기" link correctly routes to `#atlas`. |

### Atlas / AI 시대 지식 지도 (#atlas)
| Sev | Finding |
|---|---|
| — | 북마크 (☆) and 개인 메모 + 저장 controls present (local, non-destructive); not saved/toggled to avoid persisting test data into the shared account's learning-progress state, but confirmed present and correctly wired to the current lesson ("에너지와 전력"). |
| Low | Search box ("개념·산업·제품·근거 검색") accepted "rsi" but produced no visible filtering and no "no results" feedback — for an out-of-domain query this may be correct (RSI isn't an AI-industry-chain term) but the silence is ambiguous — a user can't tell if the search ran at all. |
| — | 4 tabs (학습지도/관계지도/산업가치사슬/근거자료실) all switch and update `mode=` in the URL. |

### Masters / 대가의 포트폴리오 (#masters)
| Sev | Finding |
|---|---|
| Med | Ticker/CUSIP reverse-lookup ("티커 또는 CUSIP 역조회") searched for NVDA and never resolved past **"참조용 티커 원장을 불러오는 중입니다"** (loading ticker reference ledger) — stayed stuck in this loading state with no timeout/error message. Consistent with the general proxy-failure pattern seen site-wide (see console notes) but this control gives no feedback that it has failed vs. still loading. |
| — | 전체/13F 연결/방법론 전용 filter tabs present; investor list (Buffett/Druckenmiller/Fisher/Ackman/…) renders correctly with 13F metadata (신고 행 수, Top 10 비중, 신규/확대/축소/제외 counts). |

### Guide / 사용 설명서 (#guide)
| Sev | Finding |
|---|---|
| Med | The "빠른 이동" (quick-jump) search-result cards ("검색 결과 1"–"검색 결과 5") **look like clickable jump-to links** (styled as a numbered result list under a "선택하면 해당 내용으로 이동합니다" heading that explicitly promises click-to-navigate) but are plain, non-interactive `<div>`/`<span>` elements — confirmed via `read_page` (role: `generic`, no children, no onclick) and by clicking directly on the text with no effect. This directly contradicts the UI's own "선택하면 이동합니다" copy. |
| — | Full API-key panel enumerated (inspect-only, no keys entered): 개인 Claude API 키, PIN 암호화 설정, 공용 PC 모드 checkbox, and 12 additional optional provider keys (Alpha Vantage, Finnhub, FRED, Twelve Data, FMP, NewsData.io, BOK ECOS, KOSIS, Perplexity, Google CSE ×2, CF Worker URL) each with its own 저장 button — all present and correctly labeled as optional/local-storage-only. |
| — | Dark-mode toggle in the sidebar works (verified full theme switch). |
| Low | (cross-cutting) stale floating-glossary-button doc text. |

### Glossary modal (accessed from nav "용어 사전" or Guide's "용어 사전 열기")
| Sev | Finding |
|---|---|
| — | Works well: 275-entry dictionary, 10 category filter chips, live search — typed "RSI" and got correctly filtered results (RSI, 다이버전스, 윌리엄스 %R, 평균회귀, 손실 회피, 평균 회귀— all genuinely RSI-related). Close (×) button works. |

### Options (#options — URL-only, not in nav)
| Sev | Finding |
|---|---|
| — | Correctly renders VIX/Put-Call/SKEW as labeled "보조 지표"(supplementary only), explicitly disclaims real option-chain/Greeks/GEX data ("아직 연결하지 않습니다"). Two cross-links ("투자 심리 보기"/"매매 신호 보기") — 1 tested, routes correctly to `#sentiment`. |
| — | Confirmed this page is reachable *only* by typing the URL directly — it has no nav entry and no visible link into it from any other page I visited except the reverse link from Signal/Sentiment. |

---

## 3. What could not be tested

- **5 Korean themes on the Themes page** — could not be opened because the feature does not exist (see High finding above), not because of a test-environment limitation.
- **시스템 자가 진단 20-item checklist resolving past ⏳ within 60s** — could not observe this because the widget is never rendered to a normal user (gated by a localStorage dev flag with no UI toggle). Forcing it on would have required `localStorage.setItem('aio_audit_mode','detailed')`, which is a state mutation beyond the "navigation only" allowance in the hard rules, so it was deliberately not done.
- **Portfolio "종목 추가" / "첫 종목 추가" flows, "전체 삭제", "가져오기" (file import), "내보내기" (file export)** — not exercised per explicit instruction not to add/delete portfolio positions and per the general policy against triggering unapproved file downloads.
- **AI 베타 chat / per-page quick-prompt chips** ("시장 레짐", "리스크 팩터", "RSI 해석", etc., present on nearly every page) and the "전송" button — not clicked anywhere, per the hard rule against sending any AI chat message.
- **Onboarding banner "닫기" (dismiss) button** — not clicked, since dismissal is very likely persisted (localStorage) and would remove the banner permanently for this shared account/browser profile.
- **All 14 US theme details** — 8 of 14 were opened (반도체/소프트웨어/방산항공/로보틱스/에너지/헬스케어/금융/소비재); the remaining 6 (통신/산업재/필수소비/유틸리티/원자재/부동산) were not individually re-verified beyond being enumerated, since all 8 sampled followed an identical, correctly-functioning template with no console errors — low expected value for the remaining time budget.
- **Exact click behavior of the 10 home-page market-snapshot buttons** (S&P500/NASDAQ/VIX/F&G/DXY/10Y/Gold/WTI/KOSPI/BTC) beyond the accessible-name inspection — only 1 (which turned out to be an onboarding-banner button positioned nearby, not a snapshot tile) was actually clicked; the others' `aria-label`s suggest some cross-link to other pages (e.g. KOSPI→거시경제) but this was not empirically confirmed per-tile.
- **Screener's remaining controls** (전체 지수/전체 섹션/전체 분류/전체 시총 filter dropdowns, free-text 검색, 컬럼 선택, 겁/받전 toggle, 새 화면/저장/조건 실행 buttons, 백테스트 IC and 조건부 증거 tabs) — enumerated but not individually exercised, due to time budget after the deeper investigations above.
- **Masters page 전체/13F 연결/방법론 전용 tab switching** and 투자자 검색 text box — enumerated but not clicked (reverse-ticker-lookup was tested instead, and got stuck loading — see finding).
- A live capture/recording of the concurrent agent's actions was not possible; the "NVDA005930" localStorage artifact is inferred, not directly observed, to be theirs.
