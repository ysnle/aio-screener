# AIO Screener — Agent Guide

AIO Screener는 GitHub Pages에서 제공되는 하이브리드 정적 셸 + native ESM 투자 리서치 터미널이다. 현재 버전·라우트·파일 크기·지식 상태는 사람이 이 문서에 복사하지 않는다. 항상 [`_context/CURRENT-STATE.md`](./_context/CURRENT-STATE.md)와 원본 레지스트리에서 파생한다.

## Mandatory preflight

1. `git status --short`와 `version.json`으로 작업 트리 경계를 확인한다. 기존 dirty 변경은 사용자 소유다. 수정 전에 `node scripts/qa-runner.mjs session-start --session <task-id>`로 content-hash 기준선을 잡는다.
2. `_context/CURRENT-STATE.md`는 작업 시작에 한 번 확인한다. `_context/INDEX.md`는 위치 탐색이 필요할 때, `_context/WORKFLOW-GOVERNANCE.md`는 QA·권한·워크플로 상세가 필요할 때만 읽는다. 이미 읽은 변경 없는 문서는 반복 로드하지 않는다.
3. 작업 판단에 실제로 도움이 되는 스킬만 사용한다. 사용할 `SKILL.md`를 읽고 현재 작업에 필요한 reference만 선택한다. 키워드 일치만으로 스킬이나 전체 절차를 강제하지 않는다. **스킬은 참조 문서이며 트리거 체인이 아니다** — 라우팅의 단일 트리거는 아래 Task routing 표이고, 스킬 발동이 작업 범위를 좁히거나 넓히지 않는다. 강제는 게이트 실행과 보고 형식에만 둔다(R618).
4. `RULES.md`, `BUG-POSTMORTEM.md`, `QA-CHECKLIST.md`, `KNOWLEDGE-BASE.md`는 전체 로드하지 않는다. 관련 함수·R/P/QA ID·키워드로 검색한 범위만 읽는다.
5. `index.html`은 `_context/CODE-MAP.md`에서 담당 구간을 찾은 뒤 필요한 범위만 수정한다.

## Working agreement

- 사용자의 현재 지시와 이전에 승인된 범위를 따른다. “할 수 있나”, “원한다”, “도와줘”는 실행 요청으로 해석하고, 합리적인 일상 선택은 직접 결정한다.
- 완료는 요청한 변경의 구현·필요한 실행·결과 확인·발견된 관련 실패 수정까지다. 중간 질문에 답한 뒤에도 원래 목표를 유지한다. 범위가 넓으면 항목별 미검증 상태를 남기고 자동 PASS를 의미 검수 완료로 바꾸지 않는다.
- 사용자 지시가 스킬 지침보다 우선한다. 스킬 때문에 멈출 때는 정확한 파일과 해당 문구, 실제 적용 이유를 밝힌다. 로컬 수정·생성·격리 테스트에는 중복 확인을 요구하지 않는다. 아래 commit/push/deploy 경계는 유지한다.
- 독립적인 조사·리뷰를 병렬 위임하면 실제로 도움이 되는 큰 작업에서는 범위가 명확한 서브에이전트를 사용한다. 파일 소유권을 분리하고 기존 변경을 보존하며, 작은 일이나 같은 조사에는 위임을 늘리지 않는다. 결과는 주 담당자가 통합 검증한다.
- 한국어로 결과와 근거를 간결하게 설명한다. 에이전트 간 메시지도 정상적인 문장과 띄어쓰기를 사용한다. 통과한 검사는 새 변경·실패·미해결 위험이 있을 때만 다시 실행한다.
- **협업 원칙 (owner 2026-10-01):** 소유자는 스크리너 개발·운영 비전문가이며 명령-수행 관계가 아니라 함께 판단하는 관계를 원한다. 요청·기존 설계·이전 에이전트 작업을 무조건 옳다고 가정하지 않는다. 데이터 무결성·비용·권리·사용자 가치와 충돌하면 근거(실측·공식 문서)와 함께 반대 의견과 대안을 먼저 제시하고, 소유자 전제가 사실과 다르면 바로잡는다(예: 13D는 분기 공시가 아니라 수시 공시). 기능을 없애거나 합치는 제품 결정은 제안 후 승인받아 진행한다.

## Product decisions (fixed)

Owner decisions that every agent (Claude, Codex, subagents) applies without re-asking. Change them only when the user says so.

- Audience: the operator's family and friends (~5 users, 2–4 concurrent). Free to run, operated by one person, automated. No public-SaaS features (sign-up, billing, multi-tenant).
- Budget: prefer free public sources; target total operating spend $10/month, ceiling $20/month. AI API allocation is at most $10/month; data/source spending is at most $10/month and requires a demonstrated quality or coverage gap. Public discoverability does not establish automated reuse rights or historical-data quality. Request-count limits are not billing caps; shared Worker reservations do not cover personal-key or GitHub Actions calls.
- Scores are reference descriptions of the market on the **latest completed US regular-session close** ("직전 미국장 종가 기준", R670), labelled with that basis and never decision-grade. Missing inputs hold the score; they are never guessed.
- Desktop only. Mobile layouts and code were removed on purpose; do not add breakpoints or mobile handling back.
- The options route is retired (`#options` aliases to `sentiment`). Do not revive it.
- No ticker guessing: company names resolve only by exact registry match, and a ticker-shaped input is never rewritten to another issuer (P1339).
- Data producers (`scripts/fetch-*`, `build-*`, `sync-*`, `refresh-*`) run only in GitHub Actions; locally, read artifacts and run gates.
- Korean themes and Korean-market content are user-facing features, not experiments.
- Work in large batches: implement several items, then verify and record once. Use scoped parallel subagents for independent areas.
- **Information architecture (2026-10-01):** consolidate the 19 routes into 8 screens — 오늘(home+briefing+market-news), 시장 상태(signal+breadth+sentiment), 거시(macro+fxbond), 종목(ticker+fundamental+technical), 테마(themes+theme-detail), 스크리너, 포트폴리오, 배우기(principles+masters+atlas+guide+glossary). Each merge also moves that page's legacy `js/` ownership to `src/` and deletes the replaced legacy code; old route ids stay as aliases. Plan and progress: `_artifacts/claude-continuation-20261001/STRUCTURE-PROPOSAL.md`.
- **Screen honesty without clutter:** keep evidence status, but as one status per card (최신/지연/참고/없음) with details on demand and one global disclaimer — not repeated caveats. Hide widgets whose source does not exist instead of showing a permanent "—". Remove grades/scores that have no calibration or source (e.g. letter grades derived from the reference score, uncalibrated composite "n/100" readings); a reference score is shown only with its basis.
- **Slow-changing data is static:** 13F (quarterly, filing-season import), knowledge base, principles and glossary are versioned static JSON updated only when the source changes. Content-addressed artifacts hash content only, never build/review timestamps (P1370). 13D/G is event-driven, so its light daily ownership poll stays (P1309/R654).
- **Filling data gaps (agent recommendation 2026-10-01, awaiting owner confirmation; the owner asked whether a daily web-search fill would be better):** prefer official free structured sources (FRED, Treasury, BLS, BEA, SEC, CBOE, BOK/ECOS, KOSIS, KRX) over scraping. LLM web search may add cited qualitative context only; it never supplies numeric inputs to scores, tables or charts (hallucination, missing observation time, unclear reuse rights, ~$10 per 1,000 searches against a ≤$10/month AI budget).
- **AI provider/budget (open):** the shared-Worker budget settlement and translation cap are implemented but held (`_artifacts/claude-continuation-20261001/held-ai-budget-settlement.patch`). Model/provider choice (current Haiku 4.5 + Sonnet 4.6; Sonnet 5.5 is cheaper than 4.6; GPT-6 Luna was proposed) is undecided — do not switch providers or apply the held patch without an explicit owner decision.

## Task routing

| Task | Skill / evidence |
|---|---|
| Defect or failed gate | `bug-fix` → matching P/R/QA entries → regression gate |
| Code, UI, workflow or skill verification | `post-edit-qa` → risk-derived tiers |
| Data freshness or generated artifacts | `data-refresh` |
| Supplied research or market framework | `integrate` |
| Docs, skills, agents, hooks or knowledge drift | `knowledge-lint` |
| Skill experiments and eval design | `autoresearch` |
| Delegation, assumption check, post-PR trim | `.agents/skills/_shared/agent-prompt-anatomy.md`; the routines in `.claude/commands/{restate,assumptions,trim-pr}.md` apply as written |
| Recording a fix (P/R/QA/CHANGELOG/status) | `node scripts/record-fix.mjs <entry.json>` after `bump-version`, then `generate-workspace-state --write` |

## Non-negotiable boundaries

- Automatic commit, push and deployment are forbidden. Run them only after an explicit user request for that action.
- Use `node scripts/bump-version.mjs <version>` for versioned changes. R1 covers every version surface patched by `scripts/bump-version.mjs` (it also regenerates `_context/CURRENT-STATE.md`) and is verified by `ci-version-check.mjs`.
- Bug fixes require a new P entry. Promote recurring classes to RULES/QA and an executable gate. The gate must cite the entry it prevents a regression of — `ci-assertion-trace-check.mjs` enforces that for new assertions, and `ci-ledger-integrity-check.mjs` freezes the R-number gap set and requires new open QA items to declare `verify_by:`.
- Generated workspace files are never hand-edited: run `node scripts/generate-workspace-state.mjs --write`, `node scripts/sync-agent-profiles.mjs`, and `node scripts/sync-agent-skills.mjs` as applicable.
- Static, runtime/headless, browser and live evidence are separate. Never promote a lower evidence level to a higher one.
- No commit or deployment is implied by “finish”, “fix all”, QA completion, or a passing local gate.
- Change flow (owner decision 2026-09-30): work on `main` directly. Local full QA (`npm run qa:full`) → commit on `main` → push `main` only when the user asks. CI on main is the release gate: Pages and the Workers deploy only the CI-attested SHA, so a red CI never ships. No PR step for routine work.
- Before pushing, `git pull --no-rebase origin main`; the data bot's commits conflict on the generated release manifests, so run `node scripts/resolve-generated-conflicts.mjs` and the release gates it prints instead of hand-editing.
- Branches are only for parallel agents or risky experiments: one worktree per agent (`git worktree add <dir> -b <agent>/<topic> main`), disjoint file ownership; the main agent merges them back into `main` and runs the gates once.
- Line endings are LF everywhere (`.gitattributes`, P1344); do not add CRLF files except `*.cmd`/`*.ps1`.

## Closeout

Use `architecture/qa-pipeline.json` through `node scripts/qa-runner.mjs affected --session <task-id>` for normal closeout. If no baseline was captured, pass the exact task-owned list with `--files <comma-separated-paths>`; never let unrelated pre-existing dirty files silently widen the run. Fix the complete failure batch, then use `rerun-failed`, which rechecks the exact failed gates and declared dependencies. Reserve `full --no-cache` for release/shared-shell certification and `external --no-cache` for deployed claims.

For workspace-facing changes run at minimum:

```text
node scripts/generate-workspace-state.mjs --check
node scripts/ci-workspace-contract-check.mjs
node scripts/ci-knowledge-lint-check.mjs
node scripts/ci-skill-contract-check.mjs
node scripts/ci-skill-eval-fixture-check.mjs
node scripts/ci-ledger-integrity-check.mjs
node scripts/ci-assertion-trace-check.mjs
node scripts/sync-agent-profiles.mjs --check
node scripts/sync-agent-skills.mjs --check
git diff --check
```

Add the code/data/browser gates selected by the touched surface. Final reports must separate verified, blocked and unverified work and state whether commit/deploy occurred.
