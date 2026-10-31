# v59.51 work order — content audit + first-users run-6, by area (2026-10-31)

## The owner's goal (in their words, 2026-10-31)

- "Run-6에서 나온 모든 결과들 확인해서 구조적으로 개선하고 보강하자. 각 페이지/탭마다 너무 텍스트 위주거나 복잡하면
  직관성/편리성이 떨어지니 이점도 유의해줘."
- "각 페이지/탭에 있는 모든 내용과 콘텐츠, 텍스트/시각적 자료 등등 각각의 존재 이유와 의도까지 의심하고 분석하면서."
- "코드 덧붙이기식이 아니라 근본적으로 해결하고 리팩토링."
- Home: "홈 결론은 내가 아래로 내렸는데 … 다시 위로 올려. 너무 텍스트가 많아서 맨 위에 있으면 거부감이 들까봐" — so the
  verdict goes back to the top as a **compact** card (verdict word, one sentence, axis chips, what would change it), not
  a wall of prose.

## Two layers (owner, 2026-10-31, added mid-batch — this overrides "cut" for analysis content)

"각각의 요소들과 텍스트까지 같이 개선 … 접힘 섹션도 자세하고 상세한, 원초적인/전문적인 분석과 해설을 제공하는거고 평소에는
초보 사용자들도 쉽게 이해하고 직관적으로 시황 파악할 수 있도록."
- **Face (always visible): for a beginner.** Plain Korean, short, the conclusion first, one visual. Rewrite the visible
  text itself (not just shorten it): no jargon without a term mark, no stacked numbers in a sentence, one idea per line.
- **Fold: for an expert.** Detailed, raw and professional: the underlying numbers, the method, thresholds, history,
  the cause chain, caveats. Analysis text that leaves the face moves INTO the fold and may be deepened there with data
  the page already has — it is not deleted. Only true duplicates (the same fact shown twice) and how-to prose ("이
  화면은 이렇게 보세요") are deleted.
- Still R724, still no provider text beside numbers, still no invented facts — deepen only from data already loaded.

## Rules for every area

1. **Subtract first.** When an element is cut, delete its renderer code, its markup and its CSS — do not hide it.
   When it moves, move the call, do not copy it. No new wrapper layers, no flags to keep the old path.
2. **Owner-requested elements are folded, shortened or moved, never deleted.** They are marked "owner" in the audit
   files. Everything else may be deleted when the audit says cut.
3. Each section: one visual + a short reading (3-5 lines, ~130-230 chars) + details folded. Folds start closed.
4. No provider/URL text beside numbers (dates stay; sources live in the folded 데이터 출처). No emoji. R724: never
   propose a price, weight, timing or stock — say what a cost depends on, map levels, teach how experts choose.
   US leads, Korea secondary ('한국').
5. Edit JS with the Edit tool (never sed/heredoc on JS), then `node --check <file>` for every touched JS file.
   Korean text only through the Edit/Write tools.
6. **Own only your files** (listed per area). Read anything; edit nothing else. `index.html`: edit only inside your own
   `<div class="page" id="page-…">` block(s) (and the listed exceptions); Read the region again right before each Edit
   (other agents edit other regions of the same file). Never edit `scripts/` (gates are updated centrally): instead
   list every gate assertion your change breaks (file:line, what it pins, what it should pin now). Find them with
   `grep -rn "<removed id or text>" scripts/`.
7. Do not run browser QA or `qa-runner` (eight agents share the ports). You may run single non-browser checks:
   `node scripts/ci-esm-core-unit-check.mjs`, `node scripts/ci-pipeline-semantics-check.mjs`,
   `node scripts/ci-architecture-contract-check.mjs`, `node scripts/ci-runtime-contract-check.mjs`,
   `node scripts/ci-instruction-text-ratchet-check.mjs`, `node scripts/ci-regex-term-ratchet-check.mjs`,
   `node scripts/ci-shared-primitive-ratchet-check.mjs` — report failures you caused, do not "fix" the gate.
   A local app runs at http://localhost:8765 (do not stop it); you may look with headless Playwright
   (C:\Projects\AIO\node_modules) using scripts under your own scratchpad folder.
8. No commit, no push, no version bump, no record-fix, no ledger edits.

## Report (return as text, <= 900 words)

- Files changed. For each element: before → after (cut / folded / merged into X / moved to Y / shortened), with an
  estimated visible-character change.
- Defects fixed: cause (file:line) → fix.
- Gate assertions that now need updating (file:line, old pin, new pin).
- `index.html` regions you edited.
- Not done, and why (including anything that needs the owner).

## Sources

- Audits: `_artifacts/content-audit-20261031/{home,market,themes,stock-screener,portfolio-news-library-ai}.md`.
- First users: `_artifacts/first-users/run-6/MERGED.md` (numbers below are its rows).

## Areas and file ownership

**A. Navigation and boot** — js/aio-core.js (only the click dispatch, ~1700-1800), src/app/router.js,
src/ui/navigation/route-hubs.js, src/app/bootstrap.js (boot order only), index.html: the inline boot script
(~3520-3560) and the tab bar (~3739-3745).
- MERGED #0 (blocker): on a phone (slow 3G, CPU 4x) taps on 시장 before `load` are dropped for up to 168 s. The run-5
  fix holds taps only until aio-core's dispatcher exists; something after that still drops them. Reproduce with
  Playwright + CDP (Network.emulateNetworkConditions slow 3G, Emulation.setCPUThrottlingRate 4) and find the drop point
  before changing anything. Fix the cause: a tap is never silently lost; it runs once its route can run, with visible
  feedback meanwhile.
- MERGED #12: hub tabs drop `sym` (route-hubs.js:107-108 showPage(tab.id); router.js:107 ENTITY_ROUTES excludes
  technical; :144, :171, :196). One rule: every entity route keeps `sym` in the hash.
- MERGED #18: "SPY 일봉" under an NVDA header — route-hubs.js:127-128 restores the subject without firing
  aio:subjectChanged (stock-chart.js:670 only re-targets on it). Fire the event from the one place that sets the subject.
- MERGED #20: the 요약/차트/재무 hub segment exposes no role=tab.

**B. 오늘 + 시장 상태 (signal)** — src/ui/components/daily-loop.js, market-regime.js, session-lean.js,
home-index-strip.js, home-kpi-trend.js, ai-chain-flow.js, regime-choices.js (delete), leadership-verdict.js,
src/ui/pages/analysis.js (home/signal parts), index.html `#page-home` and `#page-signal`.
- home.md entirely: compact verdict at the top; event briefs leave home (area F keeps them on 뉴스; you remove home's
  call and markup and leave one line "이번 주 발표 n건 →" linking to 뉴스); overnight → one link to 뉴스; schedule → next
  1-2 events inside the flips tile; one price surface (index strip + one chip row; cut 지금 시세 heading, BTC, gold);
  cut 오늘 확인할 3가지; 오늘의 질문 (owner) becomes the hero lede; leaders prose (owner) → one line, numbers folded, the
  AI chain bars (owner) are its visual; 매수·매도 우위 (owner) folded and renamed away from 매수·매도; Korea line + session
  bridge (owner) → one Korea line, bridge folded; fix the futures contradiction (bridge "-1.81% 14시간 전" vs tile
  "주말 휴장" — one rule for weekend futures); remove "채널 글" source text beside numbers; depth fold (crossroads +
  guide) moves to 시장 상태; dead hidden DOM in #page-home (~3893-3935) goes if no gate needs it (list the gates).
- market.md signal part: all axis rows closed by default (market-regime.js:226 OPEN_FIRST, :482); delete
  regime-choices (duplicate of macro's scenario costs); 주도 영역 one line, 자금 흐름 splits go to 테마 (one line
  stays); 분배일 strip into the trend row; 세 가지 흐름 → one line; combination/next check 2 + 2 lines.
- MERGED #1, #10 (chart link lands two screens above the chart), #19 (radar fold position; first paint "판정 대기"
  contradicting home's 혼조).

**C. 거시 · 금리와 환율 · 투자 심리 · 시장 폭** — src/ui/components/macro-board.js, src/ui/components/macro-crossroads.js
(UI), sentiment-board.js, breadth components, index.html `#page-macro`, `#page-fxbond`, `#page-sentiment`,
`#page-breadth`, and the one CSS rule at index.html ~3118-3120.
- market.md macro/fxbond/sentiment/breadth parts: close default-open folds (macro-board.js:813-815, :1195;
  macro-crossroads.js:209; fxbond lessons); 금리/유가/신용 factor rows become one-line links to signal; move the rate
  strip (macro-board.js:325-385) to fxbond folded; scenario cards closed, the 3 conditions folded; cut #rates-summary
  tiles, #rates-credit-link, 그 밖의 통화, the fxbond 10Y 6-month chart; fold the asset table; sentiment: cut the HY card,
  fold put/call while stale, components, temperature body, principle prose; breadth: cut the index-confirmation chart.
- Mount `#index-earnings` (S&P 500 이익 전망) on 거시 using src/ui/components/index-earnings.js's export (area D removes it
  from 테마; do not edit index-earnings.js).
- MERGED #14: 데이터 출처 hidden on signal/breadth/sentiment by `body:not(.aio-dev-mode) #page-{signal,breadth,sentiment}
  > details {display:none}` (index.html ~3118-3120) — exclude `.page-sources`.

**D. 테마** — src/ui/pages/themes.js, src/ui/components/theme-playbook-view.js, src/domain/scenarios/theme-playbook.js,
src/ui/components/market-guide.js, index.html `#page-themes` (incl. the detail panel ~4852 and sector map ~4837).
- themes.md entirely. Biggest items: make theme-detail a standalone view (list hidden while the panel is open); fold the
  46-row stage table, US only by default (Korean rows to #kr-integrated-themes); one 3-5 line detail reading replacing
  why + flow + playbook headline; cut provenance line, sub-theme fold and the same-day fold; links and AI chips at the
  end; remove #index-earnings from 테마 (area C mounts it on 거시); fold/move the S&P map; sector bars as a tab of the
  verdict; capex flow into the AI-chain fold; cut the .mg-guide principles card; fix the paint-order race
  (themes.js:1803).
- R724: theme-playbook.js:64 "원인이 확인될 때까지 기다리는 쪽이 맞습니다" and theme-playbook-view.js:707 "50일선 위
  종목(45%)부터 차트·재무로 확인합니다" — rewrite as conditional criteria.
- Absorb 자금 흐름 theme splits from area B if they add anything not already on 테마 (read market-regime.js, do not
  edit it).

**E. 종목 + 스크리너** — src/ui/pages/entity.js, src/ui/pages/screener.js, src/ui/components/company-analysis.js,
stock-read.js, fiscal-read.js, company-story.js, fundamental-search.js, ticker-overview.js, stock-chart.js (not the
subject event — area A), stock-chart-coach.js, stock-chart-compare.js, screener-read.js, screener-validation.js,
index.html `#page-ticker`, `#page-technical`, `#page-fundamental`, `#page-screener`.
- stock-screener.md entirely: one summary per fact across the three tabs; cut #ticker-company-analysis (PER row to the
  hero); move DuPont + reverse DCF into 재무 공시's 투자 논지 틀; price flow up as the hero sparkline; cut the factor fold;
  company story → one-liner + money-flow visual; one search (cut #fund-search-input); #ticker-context into
  #ticker-read; #ticker-setup to 차트; chart evidence aside → reading + template visual, rest folded; #tech-regime-summary
  one line; move #kr-integrated-technical off 차트; cut #fund-legacy-fold and the dead .insight-box; quarters as a
  toggle of the annual bars; screener head one line + the validation chip; merge the three status lines.
- MERGED #6 (bar labels overlap/clip), #11 (FB/AAP half-empty page instead of "no match"; recent searches keep
  unresolved), #15 ("회계연도 말로부터 399일" — say what it means), glossary-unmarked terms on these routes (mark with the
  existing term-mark mechanism if the term exists in the glossary; list missing terms for area G).

**F. 포트폴리오 · 뉴스 · 브리핑 · 라이브러리 · 안내** — src/ui/pages/portfolio.js, portfolio-read.js,
portfolio-checklist.js, src/ui/panels/portfolio-trade-journal.js, src/ui/pages/news.js, src/ui/components/event-briefs.js,
market-timeline.js, briefing-read.js, src/ui/knowledge/research-shell.js, concepts-view.js, src/ui/pages/guide.js,
masters.js, atlas.js, principles.js, index.html `#page-portfolio`, `#page-market-news`, `#page-briefing`, library and
guide page blocks.
- portfolio-news-library-ai.md (all but the AI panel): portfolio collapsed to totals → table → one reading → "내 기록 ·
  도구" folds; event briefs painted on 뉴스 only (keep paintNewsBriefs; remove the home paint path in event-briefs.js once
  area B stops calling it); briefing timeline → 뉴스, translated; merge briefing checks + events, fold schedule;
  lessons on one of 뉴스/브리핑; library: fold the concept list, 서가 on principles only, atlas visual first, masters
  change table folded; guide: cut steps and menu map, rules folded, 7 folds → 3.
- MERGED #9 (portfolio "0%는 오르는 흐름" lead; 내 수익률 = 3개월 수익률; bare "—"), #16 (double-click add asks to
  replace what was just added; form loses typed values on reload), #20 (portfolio submit under the fixed tab bar).
- R724 (guessed in the audit): "앱 내부 구간 25% 이하" weight bound and the staging lesson beside holdings — decide with
  R724 and say what you did.

**G. AI 패널 · 용어 표시 · 화면 교훈 공통** — js/aio-chat.js, src/ai/orchestrator/answer-orchestrator.js,
src/app/chat-loader.js, src/ui/components/ai-chip-fold.js, ai-profile.js, src/ui/components/term-marks.js,
src/ui/components/screen-lessons.js, the glossary source (find where term-mark terms come from), index.html: the AI panel
markup (~6782) only.
- AI: echo bug (aio-chat.js:3901 → render user bubbles with textContent); double send (lock and clear the input
  synchronously before execute; chat-loader.js:54 queue must not run a draft twice); a length cap with a visible count;
  header shorter on a phone; fold the basis line; chips visible before the first question on a phone; the panel must not
  squeeze the page (MERGED #7) — overlay instead of shrinking the content at narrow widths; 답변 범위 and 맞춤 targets
  >= 44 px with clear labels (MERGED #17, #20).
- Glossary: add plain-Korean entries for the unmarked terms in MERGED #5 (혼조, VIX, PCE, FOMC, GAAP/비GAAP, 희석 EPS, bp,
  SMH, ETF, 하이일드 스프레드, 50/200일선, 풋/콜, RSI, FY, Forward PER, 듀폰 분해, 역 DCF, 셋업, 10-K, EMA, 피벗, 허핀달,
  CAPM 베타, Markowitz …) if missing, in the glossary's own format; term marks >= 44 px tap area on touch (MERGED #20).
- Screen lessons: every route's lesson card starts as one closed line (they are how-to text; owner 2026-10-19 made
  them, so fold, do not delete); a lesson repeated on two routes appears on one.

**H. 같은 숫자 하나의 원천** — src/domain/fundamental/stock-lens.js, src/domain/market/macro-crossroads.js,
src/domain/market/scenario-outlook.js, src/domain/guide/market-guide.js, src/ui/components/market-flow.js,
src/domain/briefing/* next-event selection (read first; edit only the selector), src/domain/macro/* 10Y readers.
- MERGED #2: the leading scenario differs by screen (ticker/fundamental/portfolio read scenario-state's crossroads;
  signal recomputes in the browser) and ties (2/4 vs 2/4) are shown as a single lead. One crossroads source per page
  load, and a tie is shown as a tie everywhere (tiedIds), never as one lead.
- MERGED #3: SMH -7.0% vs -8.4% — market-flow.js:27/44 reads rotation-history dailyPct from a bar fetched 21 min after
  the close; read the history close (leadership-verdict.js:17 path) so one move has one number.
- MERGED #13 + market.md: 10Y shows 4.93/4.94/4.98/5.00 on three routes; next release has three answers (11/6 고용,
  11/10 CPI, 11/3 ISM); FOMC 12/9 vs 12/10(목). One reader per figure (same series, same as-of), one next-event
  selector, dates shown in one time zone with the zone named.
- macro-crossroads.js changeLog (domain :578): the macro auto-log records theme-stage and 함정 transitions — keep it to
  macro events.
