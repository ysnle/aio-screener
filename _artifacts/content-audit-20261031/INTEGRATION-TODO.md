# Integration to-do (lead, after the area agents)

## From area H (one source per figure)

- **Gates to update:**
  - scripts/ci-esm-core-unit-check.mjs:4274. The market-flow fixture history needs
    `[{date:'2026-10-21',tnx:4.17,smh:100},{date:session,fg:19.8,tnx:4.00,smh:94}]`; `macro: {dgs10Delta…}` (:4273/:4275)
    is no longer read.
  - scripts/ci-fiscal-quality-fixture.mjs:358-363 and :390-392. `scenario` becomes
    `crossroads: {available:true, leadId:'aibust', tiedIds:[], items:[{id:'aibust', title:'AI 투자 꺾임 — …', fit:'조건 충족 3/4'}]}`.
    The stale case becomes `{...crossroads, held:true}` and expects `now === null`. Add a tie case: `tied.length === 2`,
    with no single lead.
  - scripts/fixtures/pipeline-semantics/market.mjs:99. Drop the unused `macro` argument.
- **Producer:** scripts/build-scenario-state.mjs:144/148.
  - Persist `crossroads.tiedIds` and `guide.tiedIds`.
  - In diffSnapshots, skip the 'lead' record when the old and new leads are both in tiedIds.
- **Files no area owns** (lead edits them): switch these to `scenarioLead` (src/domain/market/macro-crossroads.js).
  - src/domain/briefing/event-guide.js:29 (선두/대안 roles)
  - src/domain/scenarios/theme-criteria.js:198
  - src/domain/guide/lessons.js:21
  - src/domain/interpretation/market-interpretation.js:98: drop the `macro` argument to buildMarketFlow.
- **Forwarded to areas:**
  - E: stock-lens-cards.js:50,74,81; stock-chart-coach.js:43-47
  - F: portfolio-read.js:83-88; research-shell.js:23; briefing-read.js:308
  - C: macro-crossroads UI :270/:129-135/:116; macro-board.js:790; macro-next-release.js; Fisher and term-premium shown in the fold only
  - D: theme-playbook.js:144/269; theme-playbook-view.js:207/448/487
  - G: ai-answer-visuals.js:182/186 should read (동률)
  - Check each one landed.
- **Known failing from other areas, as of H's run:**
  - architecture contract (route-owners surfaces)
  - pipeline-semantics R1-02 (`criteriaSlot` declared twice)

## From area A (navigation and boot)

- After ALL areas' inline-script edits: `node scripts/ci-csp-meta-check.mjs --write` (index.html CSP meta line 5 +
  _headers pin each inline script by sha256). A already ran it once.
- Follow-up (not this batch): on slow 3G the classic aio-core/aio-data/aio-ui (~1 MB) execute at ~165 s because ~300
  module requests starve them; a download-priority change (preload the classic core before the module graph) would cut
  the wait. Measure on the deployed bundle first (A's claim that Pages is minified/preloaded is unverified).

## From area C (macro, fxbond, sentiment, breadth)

- Gate pins: ci-esm-core-unit-check.mjs:4103-4107 ('hy' card → only 'composite'), :4109 (breadth leads 'b50,hl,spx' →
  'b50,hl,dd'); ci-architecture-contract-check.mjs:275 ('function overviewTiles' → drop); ci-architecture-browser-check
  ~297 (macroRoute.tiles !== 6 → 0/drop); ci-structural-check.mjs:56 (id="macro-next-release" → #macro-board-basis);
  architecture/route-owners.json:226 (#page-macro #macro-next-release → remove); .claude/skills/verify-aio/scripts/
  features/macro.mjs:10-11 (#macro-next-release → #macro-board-basis), :21 (#rates-fx-grid > * 4 → 3), rates-yields
  step (tenor values now in a closed fold). Then `node scripts/sync-agent-skills.mjs` for the .agents mirror.
- Dead code to delete: macro-next-release.js renderMacroNextRelease + market.js:297 call + legacy-screen-bridges.js:24
  (keep renderKrMacroFreshnessBadges); CSS .macro-tile (v2-market.css:227-229, soft-ui.css:181/228/230,
  responsive.css:171/220), .mk-rsum*, .mk-rates-top (v2-market.css:284-285/321/340/444).
- Unowned: src/domain/.../page-flow.js sentimentFlow reads cards.hy (card cut) — read the regime credit axis instead.
- index-earnings.js (unowned): no visual, long reading + footnote — fold them.
- renderCrossroadsCompact (home, area B) still uses model.leadId — check B moved it to scenarioLead or it left home.
- Runtime noise C saw: inline-script CSP hash errors (expected until csp --write at the end) and
  `_cfWorkerUrl is not defined` in aio-data.js — investigate (possibly an inline script blocked by CSP).

## Done by lead so far
- C pins (esm sentiment/breadth, arch contract overviewTiles, browser tiles, structural next-release, route-owners,
  verify-aio macro.mjs — still run sync-agent-skills). H market-flow fixture. G pins (chat reliability order, 답변 맞춤
  켜짐, fxbond curve lesson + one-route-per-lesson assertion). event-guide/theme-criteria/lessons → scenarioLead;
  market-interpretation drops macro; page-flow sentimentFlow → credit axis evidence.
- E pins done: runtime fundamental-search, research-flow (invalid + SEC frames retirement), route-owners chips,
  arch-browser factorFolded/chips, entity-quality (company block), conditional-evidence + screener-auto-refresh
  (backtest tab). analysis.js chips writer deleted. Restored the 'AI로 기업 분석' primer button E had deleted (unique
  AI hand-off, not a duplicate) — now the first child of #ticker-company-analysis.
- D pins done: cycle pill retired (arch contract + route-owners + responsive.css + index CSS), arch-browser
  cycle/summaryText, theme-research tooltip → injected fixture tooltip.
- H done: fiscal-quality fixture → crossroads + tie case (+ fake DOM querySelectorAll/classList.toggle);
  build-scenario-state persists tiedIds, diffSnapshots skips a swap inside a tie (RUN6-TIE-01 in producers.mjs).
- index-earnings.js: face = headline + revision gauge (gaugeBar), fold = numbers/reading/sectors/method; sector-map
  fallback host deleted (static host on 거시).
- esm-core now stops at P1527 `trendPoints` (home-kpi-trend.js, area B) — wait for B.
- scenario-guidance fails P1743 semis soft-landing tailwind ('none' vs 'tail') — theme-playbook (area D) — wait for D.

## From area G
- Dead CSS .ai-ph-badge (soft-ui.css:428, responsive.css:235). Lesson card background v2-market.css:413-414 scoped to
  four market routes → make global. staged-entry lesson on portfolio (F's call). "질문은 보관됩니다" in
  responsive-shell.js could shorten. Suggested gate: every TERM_MARKS target resolves in the glossary.

## From area E
- Pins: ci-runtime-contract-check.mjs:913 (fundamental-search is selection only, no provider calls);
  ci-research-flow-contract-check.mjs:72-76 (invalid input neither selects nor dispatches); route-owners
  #tech-regime-chips surface remove; ci-architecture-browser-check :466 factorFolded drop, :625-626 chip counts;
  ci-entity-quality-browser-check.mjs:148-153 (.company-analysis-expanded → #ticker-hero-valuation);
  ci-conditional-evidence-contract.mjs:119 + ci-screener-auto-refresh-browser-check.mjs:30 (#scr-tab-button-evidence →
  #scr-tab-button-backtest).
- Dead code: aio-ui.js _renderFund*, _aioRenderFundamentalRadar; aio-core.js:2018 _aioFundSearchFill, :2087, :17212;
  legacy-screen-bridges.js:12,51-52 + bootstrap.js:803 ticker-overview bridge (+ ticker-overview.js); analysis.js
  renderTechnicalHealth chips writer. Dead CSS: company-analysis.css, .company-analysis-* (entity-quality.css,
  v2-stock.css), #fund-search-input, .ticker-ov (legacy-ui.css, shell-static.css), .scr-banner-text.
- Not done: domain/entity/stock-read.js hero headline stacks numbers (unowned); route-hubs.js:157 still writes recent
  searches (no reader). Glossary gaps listed in E's report (EMA etc.; G added EMA, FY, SPY, XLK).

## From area F
- Verify F's deletions are true duplicates (two-layer rule): hero tiles exposure band / 실질 종목 수 / 베타, cost donut
  + sector list, per-holding mini charts, AI workbench. Restore into a fold anything with no other home.
- Pins: aio-tests.js 6902 (pf-ai-notes-fold), 6932-6934 (pf-exposure-*), 6940 (guide ≥4 chapters + screen cards → 3,
  none), 6949-6953 (order entry, table, pf-read, pf-checks), 7011 (pf-allocation-section → pf-holdings-table-section);
  runtime-contract 418-420 (pf-ai-workbench etc), 846 (pf-cash-hero only), 1655 (aioPortfolioChartRenderer), 871 label;
  route-owners 380-382 + 24/61/396 (pf-position-donut); arch-contract 544/552/559; arch-browser 580-583;
  review-integrity 145 (미국 시장은 '혼조'), 148 (아직 방향이 뚜렷하지 않습니다); portfolio-vault-e2e 1042;
  user-journey 38; aio-qa-audits.js 4390.
- F saw esm-core "v58.75 event guide" fail on xr shape — probably my liveBranches → scenarioLead (needs available).
- Not done: #16 double-submit in aio-workspace.js addPortfolioPosition (in-flight guard; reload persistence needs
  owner consent — skip); atlas industry-view.js:350 main.prepend(layers); paintHomeBriefs kept until B lands
  (daily-loop.js:639-641). Dead code: domain/content/guide-screens.js; aio-workspace.js holding charts/journal/AI
  workbench fns; aio-pages.js drawPositionDonut; CSS v2-screener.css #pf-reading 334-349, responsive.css
  .pf-allocation-*, v2-today.css .news-reading-guide, portfolio-page.css pf-learn-links, v2-research.css
  guide-steps/guide-screen, shell-static.css sh-guide-strategies-*.

## Status 2026-10-31 (lead, after all areas)
- Gate pins for B + F delegated to a gate agent (scripts/, aio-tests.js, aio-qa-audits.js, route-owners.json).
- Done by lead: dead CSS (77 places, scratchpad dead_css.py), macro next-release renderer, chips writer, paintHomeBriefs,
  SEC EDGAR block in aio-kr-data.js, guide-screens.js, home aliases, operator-note duplicate verdict, CARD_GRIDS,
  CSP --write, shared-primitive --write (123), regression cases RUN6-SMH-01/10Y-01/TIE-01/TIE-02 (fail on HEAD),
  v59.51 bump, record-fix P2168–P2177 + change-only (ledger/ in this folder).
- Left after the gate agent: dead JS still named by gates (aio-ui.js _renderFund*/_aioRenderFundamentalRadar,
  aio-core.js _aioFundSearchFill/:2087/:17212, ticker-overview bridge + ticker-overview.js, aio-pages.js
  drawPositionDonut, aio-workspace.js holding charts/journal/AI workbench) — remove with their gate pins; then
  generate-workspace-state --write, ledger gates, text budget, full QA, commit, push, live check.
- Not this batch (owner or follow-up): #16 portfolio double-submit (aio-workspace.js in-flight guard; reload
  persistence needs owner consent), slow-3G classic-core download priority, TERM_MARKS-resolve gate, signal table
  "판정이 바뀌는 조건" column, atlas visual-first, domain stock-read hero headline wording.

## Lead's own

- R724 scanner widened (쪽이 맞습니다 / 기다리는 / 관망). After D lands, run
  `node scripts/ci-instruction-text-ratchet-check.mjs`; theme-playbook.js must be 0.
- After all areas: bump v59.51, record-fix entries, full QA, commit, push, live check (owner authorised commit + push
  2026-10-31; no run-7).
