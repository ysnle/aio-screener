# Next session handoff — 2026-09-30 (Claude → Codex)

> 2026-10-01: 현재 작업 인계는 [Codex → Claude / v56.87](../codex-semantic-audit-20260930/NEXT-SESSION-20261001.md)로 이동했다. 아래 내용은 이전 v56.85 시점의 이력이며 현재 dirty 상태·운영 버전·미완료 항목은 새 인계와 REPORT를 확인한다. 커밋·push·배포는 아직 하지 않았다.

Read `AGENTS.md` first. The "Product decisions (fixed)" section and the main-direct change flow are the owner's decisions (R676, P1344).

## Where things stand
- **Local `main`:** at v56.85, 16 commits ahead of `origin/main`, **not pushed** (owner: commit/deploy only on request).
- **Uncommitted local changes:** the P1344 ledger entries, AGENTS.md/CLAUDE.md main-flow text, `.gitattributes` LF policy (staged), and this file.
- **Live:** v56.83 (Pages and AI proxy).
- **Data-plane Worker:** still the July build (no `sourceSha`).
  - After v56.84+ reaches main, run `gh workflow run deploy-data-plane.yml --ref main -f ci_run_id=<green main CI run id>` once. P1341 makes that path work; the automatic path refuses an identity-less Worker by design.
- **PR #15:** superseded. Its commits are on local `main`. Close it after `main` is pushed.
- **Dependabot PRs #7, #8, #13:** deliberate maintenance batch, monthly (P1342/P1343). #7 re-pins SHAs that the release gates assert.

## Top priority: QA-UX-11, the briefing summary card (owner: "the most important content of the briefing page")
The native briefing (`src/ui/pages/news.js`, route=briefing, P770) never rendered the old "시장 상황 요약 (6-축) / 오늘 행동" card.
- The legacy helper is in `git show 76f18c53:js/aio-data.js` (function `_buildBriefingDecisionSummary`). Use it as a reference for the axes only.

Build it natively:
1. **Model:** a pure `src/domain/briefing/decision-summary.js`. Input: the close-basis quotes (`readTradingScoreInputs` / close-basis evidence, R670), canonical F&G, and the day's normalized news items.
   - Output six axes: market (SPX/VIX/F&G), rates and dollar (10Y, DXY), oil (WTI), yen (USD/JPY + BOJ news), AI·semis (NVDA/SOX + news), Korea (KOSPI + flow news).
   - Each axis carries a tone, the values, and a basis label (e.g. "9/29 미국 정규장 종가 기준").
   - A missing input gives "보류", never a guess.
2. **"오늘 행동":** a short list of checks, e.g. "금리 민감주 노출 확인", "유가 반응 확인". It must not be buy/sell instructions or "분할 진입". Scores are reference descriptions, never decision-grade.
3. **Render:** at the top of `#page-briefing`, from `news.js` route=briefing, re-rendered on the same events as the analysis slice (`aio:historyLoaded`, `aio:sentimentUpdated`, `aio:serverDataLoaded`, `aio:liveQuotes`).
4. **Gates:** an esm fixture in `scripts/ci-esm-core-unit-check.mjs` covering all six axes, one missing axis, and the basis label; a browser check that `#briefing` shows both headings. Record with `record-fix` (close QA-UX-11).

## Other open items (in order)
- Push `main` when asked, dispatch the data plane once, and verify `/health` sourceSha plus the live `deployment.json`.
- The dead-code report (`node scripts/dead-code.mjs report`) still lists test/gate-pinned legacy APIs; handle them per R675 (delete code and test together, or leave them when a RULE names them).
  - Mixed tests hold `AIO.refreshAllComprehensivePages`, `AIO.getHistoryDataAudit` and `AIO.getComprehensivePageDataFreshnessAudit`.
  - A runtime gate pins `getTopicBadge`.
- **Watchdog:** GitHub runs the 30-minute refresh cron only about 5 times a day (gaps up to 7.7 h against a 360-minute threshold). Decide between raising the threshold honestly and adding a dispatch trigger.
- **Owner inputs:** `BOK_API_KEY` and `KOSIS_API_KEY` (optional); `settings.local.json` still pre-allows `git push`.

## Tools added this session
- `scripts/resolve-generated-conflicts.mjs`: resolves the manifest conflicts that come from merging main.
- `scripts/dead-code.mjs report|remove|self-test`: reachability tooling. It marks RULES-named and side-effect statements as keep.
- `scripts/record-fix.mjs`: ledger writes. See `/version-up` for the entry format.
