# 테마 (themes / theme-detail) content audit — 2026-10-31

**Root cause of theme-detail's text count (verified):** theme-detail is not a page; the detail panel (index.html:4852)
is inserted inside #page-themes after the clicked section (themes.js:1962, P1599), and the whole list stays rendered
around it: 16,349 characters, ~25,600 px on a phone with the panel open (secondary 1,354 = list 860 + panel 494).

## themes — verdicts

- keep, shorten: page-head tabs (cut the counts line); #themes-ai-chain (owner 2026-10-30; cut its sector sentence);
  #themes-verdict rotation scatter (core visual; reading to 3 lines); playbook lead (owner P1743); momentum map (side
  text to 2 lines); #theme-strength-board (top 10, rest folded); #kr-integrated-themes fold owns Korea; links only.
- **fold, US only by default: .tp-table-scroll 단계 × 테마 46 rows** — 6,397 chars, 5,612 px desktop, section
  14,216 px on a phone; the owner's P1743 note says per-stage cards should be folded.
- merge: sector RS bars into the verdict as a tab; #ai-capex-flow into the AI-chain fold.
- move: #index-earnings (nothing about themes) to 시장/거시; #sector-map fold or move to 시장.
- cut: .tp-rrg-fold conflict list; .mg-guide principles card (how-to).
- bug: #themes-ai-chain and #themes-verdict swap order between runs (late paint, themes.js:1803 — cause guessed).

## theme-detail — verdicts

- keep: back link, header (cut the leaders line), ETF vs SPY chart (the visual; cut the caption's how-to clause),
  criteria headline (rest folded), member table (merge its two text lines), roles fold, catalyst dates only.
- merge into one 3-5 line reading: 이 흐름의 이유 (287 chars, largest secondary block) + flow + playbook headline;
  removes three duplicates (revisions twice, rotation twice, scenario three times).
- cut: provenance line (provider text), sub-theme fold, the same-day fold with 6 micro-panels (876 chars open).
- move links and AI chips to the end (they sit mid-panel before the members).
- **make theme-detail a standalone view**: hide the list sections while the panel is open.

## R724 (verified, missed by the v59.50 instruction scanner)

- src/domain/scenarios/theme-playbook.js:64 "원인이 확인될 때까지 기다리는 쪽이 맞습니다" (timing).
- src/ui/components/theme-playbook-view.js:707 "50일선 위 종목(45%)부터 차트·재무로 확인합니다" (steers which stocks first).

## Code pointers

theme-playbook-view.js:561-570 stage rows, :638 table, :663 host.replaceChildren, :707; themes.js:910
renderThemeDetailTeach, :987-1126 renderThemeDetailSummary (provenance 1030, why 1036, flow 1057, links 1083,
criteria 1094, AI 1109), :1258 sub-theme fold, :1383 themeCatalysts, :1462-1708 day fold, :1802-1806 section paints,
:1870 open/close, :1962 placement; index-earnings.js:22; market-guide.js; index.html:4837 sector-map, 4852 panel.
