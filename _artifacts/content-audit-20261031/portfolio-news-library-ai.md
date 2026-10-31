# 포트폴리오 · 뉴스/브리핑 · 리서치 라이브러리 · 안내 · AI 패널 audit — 2026-10-31

Sizes (folds closed / open, desktop): portfolio (3 holdings) 3,605 / 6,015; market-news 7,404 / 42,426 (107 details,
7,924 px desktop, 12,222 px phone); briefing 4,284 / 13,738; principles 3,666; masters 2,309; atlas 1,318; guide 1,545.
Most elements came from agent persona/expert reviews (v58.53, v58.75), not the owner, unless marked.

## portfolio — the same five facts are said 3-5 times

hero 8 tiles → total, P&L, today (VIX tile and beta out); cut #pf-exposure-rule + #pf-learn-links; table stays (anchor);
merge #pf-reading's 4 cards into #pf-checks; #pf-read keeps one visual + lead, the 4 prose points go; cut
#pf-allocation-section (weights shown 3x); #pf-checks second section, shorter; #pf-benchmark-section into the backtest
fold; cut #pf-holdings-analysis-section (link per row); cut pf-ai-notes-fold (the panel does it); 매매일지 and 논지 점검
fold under "내 기록"; tool folds grouped into one "도구" fold (내 계획 점검 is owner/AGENTS 2026-10-24); fold lessons
(the staging lesson beside holdings is close to R724 — guessed); "앱 내부 구간 25% 이하" weight bound reads close to
R724 (guessed).

## market-news / briefing — split: 브리핑 = what the close means, 뉴스 = what was said

뉴스: status to one line + filter fold; #news-intraday stays, translated; event briefs tier 1 (owner 2026-10-29/30) on
ONE screen only (home and 뉴스 both paint them via event-briefs.js:200/:211); tier 2 folded; #news-important keeps 5
items, the chain line becomes a tag; cut "뉴스 읽는 기준" how-to; full feed and Telegram folded; lessons identical to
briefing's — keep on one route.
브리핑: reading to 3-5 lines; sector bars stay, #briefing-timeline moves to 뉴스 (same items as #news-intraday);
#briefing-move-news merges into the sector visual; #briefing-drivers is the one visual; merge #briefing-checks with
#briefing-events (jobs report shown 3x); fold #briefing-schedule.

## Library and guide

All pages reachable (guide only from the topbar 도움말; not in 더보기). Fold the principles 개념 지도 list (~100 titles);
서가 only on principles; masters change table folded (duplicates the bars), picker as a select (guessed); atlas
value-chain visual first; guide: cut #guide-steps and #guide-screens (how-to, duplicates navigation), keep the rules
table folded, merge 7 folds into 3 (셋업 방법론 duplicates principles; 용어 사전 tab duplicates the modal).

## AI panel

Header 101 px on a phone; fold the basis line ("맥락 기준, 시세 …"; aio-chat.js:3818); chips are not visible at 390 px
before the first question (height 0; cause guessed).
- **Echo bug (verified):** _appendAIMsg (js/aio-chat.js:3901) passes already-escaped user text through window.safeHtml
  (js/aio-core.js:140); its on-handler regex deletes " onerror=alert(1)&gt;" because &gt; has no ">". Fix: user bubbles
  via textContent.
- **Double send (code reading):** chatSendUnified checks state._activeRequest (aio-chat.js:3936), then
  answer-orchestrator.js execute awaits beforeDispatch up to 4 s (:41-47); _aioBeginChatRequest (:3996 → :863) sets the
  lock and the input clears later (~:4056); chat-loader.js:54 queues both calls before the bundle loads. Fix: lock and
  clear synchronously before execute.

## Code pointers

portfolio.js render :780-835 (:830, :883, :834); portfolio-read.js :113 renderPortfolioRead, :332 renderPortfolioLens;
portfolio-checklist.js :70; index.html :5031, :5194, :5223, :5237; market-timeline.js:143; news.js :554, :762;
event-briefs.js :200/:211; briefing-read.js:140, :92; index.html :4137, :4142; screen-lessons.js:44; concepts-view.js;
research-shell.js ~:335-348; guide.js; ai-chip-fold.js; route-hubs.js:15.
