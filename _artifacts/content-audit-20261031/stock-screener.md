# 종목 (ticker / technical / fundamental) + 스크리너 content audit — 2026-10-31

Folds closed: 요약 4,583 chars (7,835 px phone), 차트 686 (candles fail locally), 재무 공시 5,625 (8,257 px phone),
스크리너 3,860. Folds open: 요약 14,403, 재무 9,411, 스크리너 6,507.

## Repetition across the three stock tabs (verified)

The "FY2025 매출 +6.4%, 순이익률 26.9%, ROE 171.4%" headline 3x on 요약 and 2-3x on 재무; the same 5-point fundamentals
prose on both; next earnings 3x / 2x; 혼조 on 요약 twice and on 차트; VCP setup on 요약 and 차트; reverse DCF on 요약
overlaps 투자 논지 틀; screen lessons repeat across tabs.

## Verdicts

요약: keep hero (hide P&L line for non-holders), keep #ticker-read as the conclusion (drop duplicate 52주),
fold 함께 읽을 것, merge #ticker-context into #ticker-read, move #ticker-setup to 차트, keep #ticker-strength short,
shrink #ticker-business-profile to one-liner + money-flow visual, **cut #ticker-company-analysis** (second summary;
PER row moves to hero), move/raise #ticker-price-panel as the hero sparkline, **move DuPont + reverse DCF to 재무 공시**,
cut #ticker-ov-factor-fold (unvalidated by its own note), fold lessons, shorten #ticker-next to non-tab links, one search.

차트: cut dead .insight-box (index.html:4152), cut subtitle, keep candles (owner P1397), evidence aside = reading +
template visual, coach/plan check/scenarios folded (not rendered locally — guessed), shorten legend,
#tech-regime-summary to one line (owner 2026-10-18 chart leads), fold lessons, move #kr-integrated-technical off 차트.

재무 공시: cut #fund-search-input (second search), keep #fund-flow hero (one filing date), keep bars + 이익의 질,
fold R&D and 렌즈 table, keep margins/cash, EPS surprise, peers; merge quarters into the annual bars as a toggle;
fold 공시를 문장으로 읽기; 투자 논지 틀 absorbs the DCF; **cut #fund-legacy-fold** (index.html:4560, "Yahoo Finance 응답
없음" provider text); fold lessons; shorten #fund-next.

스크리너: shorten #screener-rank-read (355-char paragraph) to 1-2 lines + sector-mix bar; keep one validation sentence;
fold the preset lesson; merge #scr-table-status, .scr-stats-line, #scr-population-holder into one status; table +
inspector is the main visual; cut .scr-more-rows; fold lessons; shorten #screener-next.

## Known-bug code paths

- SPY title: static `<h2 id="stock-chart-title">SPY 일봉</h2>` index.html:4170; installStockChart falls back to 'SPY'
  (stock-chart.js:652,662); route-hubs.js:127-128 restores the subject without firing aio:subjectChanged, which is the
  only re-target trigger (stock-chart.js:670) — cause guessed.
- Hash drops sym: hub tabs call showPage(tab.id) (route-hubs.js:107-108); ENTITY_ROUTES excludes technical
  (router.js:107, parseRouteDeepLink :144); sym only written back on ticker via aio:tickerViewReset (router.js:196).

## Code pointers

entity.js:192-247 renderSummaryIdentity, :298 renderStockLens, :508 renderTickerChart, :776/:785 company/stock analysis;
company-analysis.js:54; stock-read.js:396; fiscal-read.js; company-story.js; fundamental-search.js; ticker-overview.js;
stock-chart.js:380-470; stock-chart-coach.js:86,350; screener-read.js; screener-validation.js; screener.js:~2153,2622;
screen-lessons.js (installed from bootstrap.js:31); index.html ~4185 tech-regime-summary, ~5590 valley overview, 5774.

Owner-requested (explicit): candle chart P1397 (2026-10-03), chart-first on 차트 (2026-10-18), research-note links on
chart marks (2026-10-25), R724 teach-how-to-choose. v58.75 additions came from a persona audit, not the owner.
