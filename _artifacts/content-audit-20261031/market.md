# 시장 상태 (signal) + 거시 (macro) + 금리·환율 (fxbond) + 심리 (sentiment) + 시장 폭 (breadth) audit — 2026-10-31

Totals (default fold state): signal 5,065 chars / 9.0 phone screens; macro 5,124 / 12.0; fxbond 2,710 / 7.8;
sentiment 1,682 / 4.6; breadth 939 / 3.0. **Main cause: folds open by default** (~3,900 chars): signal 추세 axis row
1,504; macro 물가 factor row 923 and 유가 충격 scenario card 843; fxbond asset table 412 and lessons 239.

## Verdicts

signal: keep head, hero verdict (owner P1392), tally; 주도 영역 to one line (evidence folded; owner 2026-10-23);
자금 흐름 splits move to 테마 (one line stays); 분배일 strip merges into the trend row; 6-axis table is the core
visual, **all rows closed** (market-regime.js:226 OPEN_FIRST, :482 openId); **cut #regime-choices** (verbatim duplicate
of the macro lead-scenario 대응별 득실, and its next release clashes); combination/next check to 2 + 2 lines; radar
folded; 세 가지 흐름 (870 chars) to one line; Korea fold and lessons stay folded.

macro: keep header lede, release cards (owner 2026-10-30), quadrant (owner P1426, main visual); 6 factors with no row
open, 금리/유가/신용 as one-line links to signal; move the Fisher/10y-3m/Taylor strip to fxbond folded; scenarios
(owner P1742; 2,510 chars) all cards closed and the 3 conditions folded; 자동 기록 folded and filtered to macro events
(it logs theme stages and 함정 lessons); board stays as reference.

fxbond: keep the curve and its reading (fold the 11 tenor tiles), real rate / BEI / term premium; cut #rates-summary
tiles (원/달러 shown 4x, 2y-FFR 3x across routes), #rates-credit-link, 그 밖의 통화, the 10Y 6-month chart; merge the
won/yen axis card into the FX charts; asset table folded (chart + reading stay); close lessons by default; links bare.

sentiment: keep synthesis + F&G (owner P1396), AAII; bridge to one line; cut the HY card (duplicate of signal);
fold put/call while stale, F&G components, the price-temperature body (tiles stay), the principle prose.

breadth: already close to the target flow; cut the index-confirmation S&P chart (one sentence stays).

## Bugs and causes (verified unless marked)

- **데이터 출처 hidden on signal, breadth, sentiment** (run-6 #14): index.html:3118-3120
  `body:not(.aio-dev-mode) #page-{signal,breadth,sentiment} > details {display:none}` matches the fold
  renderPageSources appends; fix with `:not(.page-sources)`.
- **SMH -7.0% vs -8.4%** (run-6 #3): -7.0% = leadership-verdict.js:17 sessionMove(history,'smh') (close 522.49 vs
  561.67, fetched 23:51 UTC); -8.4% = market-flow.js:27/44 selectProducedRotation(...).dailyPct from
  scripts/lib/rotation-history.mjs:116 returnAt(1) on adjusted bars fetched 20:21 UTC, 21 min after the close — the
  back-solved last close ~514.45, a not-yet-final bar (guessed). Fix: money-flow reads the history close.
- **10Y shows 4 values**: 4.93 signal and fxbond chart, 4.94 curve, 4.98 macro Fisher (10/29), 5.00 term premium
  (10/23) — different series and dates (cause guessed).
- **Next release, three answers**: signal 다음에 확인할 것 11/6 고용; signal choices 11/10 CPI; macro header 11/6 고용
  and 11/3 ISM. **FOMC** "12/9" vs timeline "12/10(목)" (ET vs KST guessed).

## Cross-route overlap (keep in brackets)

HY 326bp on 4 routes [signal]; VIX/VIX3M [signal]; 2y-FFR [macro factor]; 10y-3m [fxbond]; 원/달러 [fxbond chart];
분배일 7회 [signal trend row]; index levels [signal]; "반도체 -17.1%, 장기채 +5.6%" paragraph [fxbond]; lead-scenario
choice costs [macro].

## Code pointers

market-regime.js:226, :463 distribution strip, :476-478 regime-choices import, :482, :579-607 paintLeadershipLine;
macro-board.js:325-385 rate strip, :813-815 openId, :1195 asset fold open, :1244, :1280, :1315; macro-crossroads.js:209
card.open, :268-290 changeLog, domain macro-crossroads.js:578; market-flow.js:27/44; leadership-verdict.js:17;
sentiment-board.js; page-sources.js; index.html:3118-3120, .mk-principle.
