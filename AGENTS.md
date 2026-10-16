# AIO Screener — Agent Guide

AIO Screener는 GitHub Pages의 하이브리드 정적 셸 + native ESM 투자 리서치 터미널이다. 버전·라우트·파일 크기·지식 상태는 이 문서에 복사하지 않고 [`_context/CURRENT-STATE.md`](./_context/CURRENT-STATE.md)와 원본 레지스트리에서 파생한다.

## Mandatory preflight

1. `git status --short`와 `version.json`으로 작업 트리 경계를 확인한다. 기존 dirty 변경은 사용자 소유다. 수정 전 `node scripts/qa-runner.mjs session-start --session <task-id>`로 기준선을 잡는다.
2. `CURRENT-STATE.md`는 시작 시 한 번 읽는다. `_context/INDEX.md`(위치 탐색)와 `_context/WORKFLOW-GOVERNANCE.md`(QA·권한 상세)는 필요할 때만, 읽은 문서는 반복 로드하지 않는다.
3. 스킬은 참조 문서이지 트리거 체인이 아니다. 도움이 될 때만 `SKILL.md`와 필요한 reference를 읽는다. 라우팅의 단일 트리거는 아래 Task routing 표이고, 강제는 게이트 실행과 보고 형식에만 둔다(R618).
4. `RULES.md`(맨 앞 핵심 규칙 색인부터), `BUG-POSTMORTEM.md`, `QA-CHECKLIST.md`, `KNOWLEDGE-BASE.md`는 관련 ID·키워드로 검색한 범위만 읽는다.
5. `index.html`은 `_context/CODE-MAP.md`에서 담당 구간을 찾아 그 범위만 수정한다.

## Working agreement

- 현재 지시와 승인된 범위를 따른다. “할 수 있나”, “원한다”, “도와줘”는 실행 요청이고, 일상적인 선택은 직접 결정한다. 사용자 지시가 스킬 지침보다 우선하며, 스킬 때문에 멈출 때는 파일·문구·적용 이유를 밝힌다.
- 완료 = 구현 + 필요한 실행 + 결과 확인 + 발견된 관련 실패 수정. 중간 질문에 답한 뒤에도 원래 목표를 유지한다. 넓은 범위는 항목별 미검증 상태를 남기고, 자동 PASS를 의미 검수로 바꾸지 않는다. 로컬 수정·생성·격리 테스트에는 중복 확인을 요구하지 않는다.
- 큰 작업의 독립 조사·리뷰는 범위가 명확한 서브에이전트(읽기 전용은 low/medium effort)에 위임하고, 파일 소유권을 나누며 결과는 주 담당자가 통합 검증한다.
- 한국어로 결과와 근거를 간결하게 설명한다(에이전트 간 메시지도 정상 문장). 통과한 검사는 새 변경·실패·위험이 있을 때만 다시 돌린다.
- **코딩 규율 (owner 2026-10-12):** ① 가정·해석 후보를 먼저 밝히고 더 단순한 방법이 있으면 말한다. 큰 작업·이미지 참조 작업은 기존 화면부터 찾고 3줄 계획을 밝힌다. 작은 수정은 묻지 않는다(2026-10-14). ② 요청을 푸는 최소 코드만 쓴다 — 추측성 기능, 한 번 쓰는 추상화, 요청 없는 옵션, 일어날 수 없는 오류 처리 금지. ③ 필요한 줄만 고치고 주변 스타일을 따른다. 자기 변경이 만든 미사용 코드만 지우고 무관한 죽은 코드는 보고만 한다. ④ 검증 가능한 목표로 바꾼다(버그는 재현 게이트 먼저, 여러 단계면 단계별 확인 방법). 사소한 변경은 판단껏 줄인다.
- **협업 원칙 (owner 2026-10-01):** 소유자는 개발·운영 비전문가이며 함께 판단하는 관계를 원한다. 요청·기존 설계·이전 작업을 무조건 옳다고 보지 않는다. 데이터 무결성·비용·권리·사용자 가치와 충돌하면 근거(실측·공식 문서)와 함께 반대 의견과 대안을 먼저 내고, 틀린 전제는 바로잡는다. 기능을 없애거나 합치는 결정은 제안 후 승인받는다.

## Product decisions (fixed)

Owner decisions every agent applies without re-asking; change only when the user says so.

- **Audience:** the operator's family and friends (~5 users, 2–4 concurrent); free, one operator, automated. No public-SaaS features (sign-up, billing, multi-tenant).
- **Budget (2026-10-11):** prefer free public sources. Shared AI ≤ $20/month including conditional web search. Paid data needs a demonstrated gap and owner approval. Discoverability ≠ reuse rights or data quality. Request-count limits are not billing caps; only AI routed through the shared Worker shares its reservation ledger (personal data-provider accounts are outside it).
- **Scores** describe the market on the **latest completed US regular-session close** ("직전 미국장 종가 기준", R670), labelled with that basis, never decision-grade; missing inputs hold the score and are never guessed.
- **Responsive (2026-10-11):** desktop, phone and iPad share routes and data; layout adapts; keep desktop density and test compact navigation, tables, charts, theme and AI input.
- The options route is retired (`#options` → `sentiment`).
- **Screen design (2026-10-02~03):** conclusion first (one line) → chart → evidence; short organised text, a visual understood in 3 seconds, narrated visuals. Trends are charts with labelled axes. No developer copy on user surfaces.
- **No grades or trade instructions:** no composite/letter scores without predictive evidence (0–100 market score retired; stock charts show evidence + a setup state). No entry/stop/target/pyramid/trim; show facts such as the pivot, invalidation price and extension. Possibility and opportunity cost are expected (2026-10-12/13): screens and AI look forward — each scenario is a branch from upcoming official events and current conditions with its cause→effect chain, what to check/watch/ignore, general choices (wait, stage in, hold, defend) with the conditions under which each costs or helps and, per branch, the relatively favoured one with its reason — conditional reasoning, never an instruction and never addressed to the reader's own holdings (R698). Evidence for a branch is limited to met-condition count (shown as a count, never called a likelihood), market-implied direction (e.g. 2-year yield vs the policy range) and past frequency in our own history with sample size — never a price, size, timing or invented probability (R697; v57.84 review). Past frequencies count non-overlapping cases using only data available at each case date; below 10 cases show counts only (no rate or "mostly" claim), 10–29 carry a small-sample note, and a rate is shown next to the base rate of the same history. Structural-theme views combine curated structure tags, measured strength/pullback and AI prose with evidence. Stock selection stays with the user.
- **Freshness (2026-10-12; cadence-relative 2026-10-15):** data, readings and AI text follow the latest artifacts automatically. Staleness is judged against each source's own publication cadence — a value is stale once a newer publication should already exist (intraday quotes: minutes in session; daily closes: the next session; macro releases: the next scheduled release; 13F: once the next filing deadline, 45 days after quarter end, passes — holdings are up to ~4.5 months old by design and always show their quarter-end date). A stale value shows its date and is never presented as current. New features state their producer and cadence.
- **No ticker guessing:** names resolve only by exact registry match; a ticker-shaped input is never rewritten to another issuer (P1339).
- **Producers** — scripts that fetch external data or write `public-data/` artifacts (`fetch-*`, the data `build-*`/`refresh-*`, `sync-screener-universe`, `sync-data-release-manifests`) — run only in GitHub Actions; locally, read artifacts and run gates. Workspace generators (`generate-workspace-state`, `sync-agent-*`, `bump-version`, `record-fix`) are not producers and run locally (v57.84: judged by effect, not by name prefix).
- **Markets:** US first; Korean themes and Korean-market content are real user features, labelled '한국' and secondary.
- **Batches:** implement several items, run one code-reviewer subagent on the batch diff, then verify and record once.
- **Information architecture (2026-10-01; names as of v57.76):** 8 screens — 오늘(home+briefing+market-news), 시장 상태(signal+breadth+sentiment), 거시 · 금리(macro+fxbond), 종목(ticker+fundamental+technical "종목 · 차트"), 테마 · 섹터(themes+theme-detail), 스크리너, 포트폴리오, 리서치 라이브러리(principles+masters+atlas+guide); 용어 사전 is a modal. Each merge moves legacy `js/` ownership to `src/` and deletes the replaced code; old ids stay as aliases.
- **Honesty without clutter:** one status per card (최신/지연/참고/없음), details on demand, one global disclaimer. Remove widgets that have no data source by design; a designed source that failed stays visible as 없음 with its last date, never silently hidden; remove uncalibrated grades/scores; a reference score always shows its basis.
- **Slow data is static:** 13F, knowledge base, principles and glossary are versioned static JSON updated when the source changes; content-addressed artifacts hash content only (P1370). 13D/G keeps its light daily poll (P1309/R654).
- **Filling gaps (2026-10-11):** existing artifacts and official free sources first (FRED, Treasury, BLS, BEA, SEC, CBOE, BOK/ECOS, KOSIS, KRX); cited OpenAI web search when they cannot answer or to corroborate. Search never supplies numeric inputs to scores, tables or charts; citations do not certify freshness and collection time never replaces publication time.
- **AI (2026-10-11/12; Workers AI 2026-10-14):** generation uses OpenAI `gpt-6-luna` via the shared Worker, except headline translation, which tries the Worker's free Workers AI binding first and falls back to it; `OPENAI_API_KEY` stays in Worker Secrets. Chat, translation, Actions analysis and web search share one atomic UTC-month budget ≤ $20; personal keys or other paid providers never bypass it. No per-user search allowance; optimise existing evidence first. Hosted search ≤ 2 calls per response; completed responses (text or searched) may settle with validated usage plus one fee per web_search_call item (v57.62), incomplete attempts keep the reservation, and reservations are not an invoice. AI is always on, search is automatic, one top AI panel (no per-page chat). Per-connection cap 200/day; the month's last 20% answers without search (P1759). Production changes need explicit commit/push/deploy; local gates do not certify the deployed service.

## Task routing

| Task | Skill / evidence |
|---|---|
| Defect or failed gate | `bug-fix` → matching P/R/QA entries → regression gate |
| Code, UI, workflow or skill verification | `post-edit-qa` → risk-derived tiers |
| Data freshness or generated artifacts | `data-refresh` |
| Supplied research or market framework | `integrate` |
| Docs, skills, agents, hooks or knowledge drift | `knowledge-lint` |
| Skill experiments and eval design | `autoresearch` |
| Delegation, assumptions, post-batch trim, weekly retro | `.agents/skills/_shared/agent-prompt-anatomy.md`; `.claude/commands/{restate,assumptions,trim-pr,retro}.md` apply as written |
| Recording a fix (P/R/QA/CHANGELOG/status) | `node scripts/record-fix.mjs <entry.json>` after `bump-version`, then `generate-workspace-state --write` |

## Non-negotiable boundaries

- Automatic commit, push and deployment are forbidden; run them only on an explicit user request. Ask once at each batch end whether to push. “Finish”, “fix all”, QA completion or a passing gate imply no commit or deploy.
- Versioned changes use `node scripts/bump-version.mjs <version>` (R1, every version surface; verified by `ci-version-check.mjs`).
- Bug fixes get a new P entry; features/cleanups a change-only `record-fix` entry. Recurring defect classes become RULES/QA plus a gate. New assertions cite the P/R entry or the introducing release (`vNN.NN` with a CHANGELOG heading) — `ci-assertion-trace-check.mjs`; `ci-ledger-integrity-check.mjs` freezes the R gap set and requires `verify_by:` on new open QA items. New text pins on product source are frozen by `ci-text-pin-ratchet-check.mjs` — test behaviour instead.
- Generated workspace files are never hand-edited: `generate-workspace-state.mjs --write`, `sync-agent-profiles.mjs`, `sync-agent-skills.mjs`.
- Static, headless, browser and live evidence are separate; never promote a lower level to a higher one.
- Change flow (2026-09-30): work on `main`; local QA (`qa-runner affected`; `npm run qa:full` for release/shared-shell certification, see Closeout) → commit → push only when asked. CI on main is the release gate (Pages and Workers deploy only the CI-attested SHA). No PR step for routine work.
- Before pushing, `git fetch origin` then `git merge origin/main` (or `git pull --no-rebase origin main`); on generated-manifest conflicts run `node scripts/resolve-generated-conflicts.mjs` and the gates it prints. Push only after `git diff --name-only --diff-filter=U` is empty and no conflict markers remain, as its own command — never at the end of a `;`/pipe chain that can swallow a failure (v57.82).
- Branches only for parallel agents or risky experiments: one worktree per agent (`git worktree add <dir> -b <agent>/<topic> main`), disjoint files; the main agent merges and gates once.
- LF line endings everywhere (`.gitattributes`, P1344) except `*.cmd`/`*.ps1`.

## Closeout

Run `node scripts/qa-runner.mjs affected --session <task-id>` (pipeline: `architecture/qa-pipeline.json`); without a baseline pass the task-owned list via `--files <paths>` so unrelated dirty files never widen the run. Fix the whole failure batch, then `rerun-failed`. `full --no-cache` is for release/shared-shell certification (never two at once — they collide on `_artifacts/`), `external --no-cache` for deployed claims. Workspace-facing changes also run:

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

Add the code/data/browser gates the touched surface selects. Final reports separate verified, blocked and unverified work and state whether commit/deploy occurred.
