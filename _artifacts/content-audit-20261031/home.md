# 오늘 (home) content audit — 2026-10-31 (local, 10/30 close data)

Measured with Playwright at 1440x900 and 390x844. Folds closed: 8,171 visible characters; the phone page is ~9,400 px.
The 오늘 hub already has 브리핑 and 뉴스 tabs, so most cuts are moves there. Evidence and screenshots:
scratchpad/audit-home (session-local).

## Verdicts (visual order)

| element | chars | verdict | reason |
|---|---|---|---|
| #home-score-hero | ~100 | keep, top, compact | the conclusion (owner 2026-10-31: move back up) |
| .page-head subtitle (date, 10/30 종가 기준) | 29 | keep | basis of the verdict; delete the four repeated date chips elsewhere |
| #home-index-strip (4 ETF intraday cards) | 226 | keep | the page's one market visual (owner 2026-10-25) |
| #home-quote-basis 지금 시세 | 22 | cut | repeats the subtitle |
| #home-kpi-strip (futures, 10Y, WTI) | 186 | merge into one chip row | second price surface; on weekends repeats the strip |
| #home-cross-assets (VIX, F&G, DXY, gold, 코스피, BTC) | 113 | merge with KPI chips; drop BTC, gold | 코스피 appears 3 times on the page |
| #home-overnight 밤사이 핵심 | 386 | move to 뉴스, one link | same pickImportantNews as 뉴스 |
| #home-event-briefs 주요 발표 요약 | 3,453 | move to 브리핑, one line "이번 주 발표 n건" | 42% of page text; content owner-requested 10/29-30, placement not |
| #home-schedule 다가오는 일정 | 345 | shorten to next 1-2, into the flips tile | first row repeated in 오늘 확인할 |
| #home-ai-chain AI 공급망 흐름 | 575 | keep as the leaders visual; top 5 bars, sentence <=2 lines | owner 2026-10-30; replaces leaders prose |
| #home-checks 오늘 확인할 3가지 | 220 | cut | all three repeat other blocks |
| #home-my-names 내 종목 | 84 | keep; empty state = one CTA | returning users |
| #home-operator-note 오늘의 질문 | 73 | merge into hero lede | owner 2026-10-15; a question next to its answer |
| #home-hero-leaders | 717 | one line "주도 영역 이탈", numbers folded | duplicates AI chain, strip, KPI |
| #home-lean 매수·매도 우위 | 162 | fold under hero, rename (R724 risk) | owner 2026-10-26; title reads as timing |
| #home-kr-line + #home-session-bridge | 78 + 515 | one Korea line on the face, bridge folded | futures "-1.81% 14시간 전" beside tile "선물 주말 휴장"; WTI shown 3x; "채널 글" source text beside numbers |
| #home-hero-components, chart link, why fold, flips | 53/17/7/207 | keep (one link only); flips gains the next event | what would change the verdict (owner 2026-10-20) |
| #home-daily-changes | 64 | merge as arrows on changed chips | one-line delta |
| #home-participation | 288 | keep as section 2, drop "6개 축 근거" row | best "why" visual |
| #home-depth-fold (crossroads + guide, 9.1k folded) | 21 | move to 시장 상태, one link | guide line "유리하다고 가장 많이 적힌 선택은 '관망'" reads as timing (R724) |
| .home-ask-row | 35 | keep or cut | not a flow item |
| hidden dead DOM (public-readiness, pipeline toggle, action card, market-analysis card) | 0 | cut once tests T226/T816/T820 retire | index.html ~3893-3935 |

## Flow

Now: index charts, the same prices twice more, news, earnings write-ups, calendar, AI chain, a to-do list repeating them,
a question, the verdict in six prose blocks, a change line, participation chart, a 9k guide fold.

Should be: verdict, why in one picture (index + participation + AI leaders bars), what would change it and the next
event, your names; news, releases and the guide one tap away (브리핑, 뉴스, 시장 상태).

## Code pointers

- event-briefs.js:202 paintHomeBriefs; daily-loop.js:339 renderOvernight, :257 renderSchedule, :425-460 renderTodayChecks,
  :534 renderHeroFlips, :603 foldHomeDepth, :616-648 renderDailyLoop; index.html ~3825-3935.
- market-regime.js:579 paintLeadershipLine, :608 paintKoreaLine, :665-705 renderHomeRegime, :791-793 crossroads/guide.
- session-lean.js:57 bridge, :92 lean, :133 paintHome; home-index-strip.js:170; home-kpi-trend.js:89-98; ai-chain-flow.js:19.
- operator note: js/aio-data.js:3283, src/app/bootstrap.js:270.
