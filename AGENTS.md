# AIO Screener — Agent Guide

AIO Screener는 GitHub Pages의 하이브리드 정적 셸 + native ESM 투자 리서치 터미널이다. 버전·라우트·파일 크기·지식 상태는 이 문서에 복사하지 않고 `_context/CURRENT-STATE.md`와 원본 레지스트리에서 파생한다.

## Mandatory preflight

1. `git status --short`와 `version.json`으로 작업 트리 경계를 확인한다. 기존 dirty 변경은 사용자 소유다. 수정 전 `node scripts/qa-runner.mjs session-start --session <task-id>`로 기준선을 잡는다.
2. `CURRENT-STATE.md`는 시작 시 한 번 읽는다. `_context/INDEX.md`(위치 탐색)와 `_context/WORKFLOW-GOVERNANCE.md`(QA·권한 상세)는 필요할 때만, 읽은 문서는 반복 로드하지 않는다.
3. 스킬은 트리거 체인이 아닌 참조 문서다. 도움이 될 때만 `SKILL.md`와 필요한 reference를 읽는다. 라우팅은 아래 Task routing 표만 따르고, 강제는 게이트 실행·보고 형식에만 둔다(R618).
4. `RULES.md`(핵심 규칙 색인 C1~C18부터), `BUG-POSTMORTEM.md`, `QA-CHECKLIST.md`, `KNOWLEDGE-BASE.md`는 관련 ID·키워드로 검색한 범위만 읽는다.
5. `index.html`은 `_context/CODE-MAP.md`에서 담당 구간을 찾아 그 범위만 수정한다.
6. 문서(CODE-MAP·스킬·핸드오프·메모리)가 지금 코드와 어긋나면 코드 관례를 따르고 어긋난 곳을 최종 답변에 모두 적는다. 제품 결정·RULES 정책과 다른 코드는 결함이다(2026-10-25).

## Working agreement

- 현재 지시와 승인 범위를 따른다. “할 수 있나”·“원한다”·“도와줘”는 실행 요청이다. 사용자 지시가 스킬보다 우선하고, 스킬 때문에 멈추면 파일·문구·이유를 밝힌다.
- 완료 = 구현 + 실행 + 결과 확인 + 발견된 관련 실패 수정. 중간 질문 뒤에도 원래 목표를 유지하고, 넓은 범위는 항목별 미검증을 남기며 자동 PASS를 의미 검수로 바꾸지 않는다. 로컬 수정·격리 테스트는 중복 확인하지 않는다.
- 큰 작업의 독립 조사·리뷰는 범위가 명확한 서브에이전트(Sonnet 5.5, owner 2026-11-01; 읽기 전용은 low/medium effort)에 위임하고, 파일 소유권을 나누며 결과는 주 담당자가 통합 검증한다.
- 한국어로 결과와 근거를 간결하게 설명한다(에이전트 간 메시지도 정상 문장). 통과한 검사는 새 변경·실패·위험이 있을 때만 다시 돌린다.
- **Architecture first (owner 2026-11-09, verbatim):** "Always build code cleanly, modularly, and with proper architecture and separation of concerns. Never simply bolt on a feature because I asked for it. If you can’t find an easy way to build it naturally, and you'd recommend a refactor to make the whole thing cleanly, stop your work ahead of time and say so." — 아래 '최소 코드'·'부분 패치'보다 우선: 기능은 담당 계층(데이터·판정·렌더·AI)에 놓고, 자리가 없으면 착수 전에 멈춰 리팩토링안을 보고한다.
- **코딩 규율 (owner 2026-10-12):** ① 가정·해석 후보를 먼저 밝히고 더 단순한 방법이 있으면 말한다. 큰 작업·이미지 참조 작업은 기존 화면부터 찾고 3줄 계획을 밝힌다. 작은 수정은 묻지 않는다(2026-10-14). ② 요청을 푸는 최소 코드만 쓴다 — 추측성 기능, 한 번 쓰는 추상화, 요청 없는 옵션, 일어날 수 없는 오류 처리 금지(드문 경합·보안 사례는 실패 양상·가능성·비용을 밝히고 동의받은 뒤). ③ 필요한 줄만 고치고 주변 스타일을 따른다. 자기 변경이 만든 미사용 코드만 지우고 무관한 죽은 코드는 보고만 한다. ④ 검증 가능한 목표로 바꾼다(버그는 재현 게이트 먼저, 여러 단계면 단계별 확인 방법). 사소한 변경은 판단껏 줄인다.
- **협업 원칙 (owner 2026-10-01):** 소유자는 개발·운영 비전문가이며 함께 판단하는 관계를 원한다. 요청·기존 설계·이전 작업을 무조건 옳다고 보지 않는다. 데이터 무결성·비용·권리·사용자 가치와 충돌하면 근거(실측·공식 문서)와 함께 반대 의견과 대안을 먼저 내고, 틀린 전제는 바로잡는다. 판단이 필요한 선택(기능 제거·통합 포함)은 권장안으로 진행해 보고하고, 되돌릴 수 없는 운영 변경만 묻는다(2026-11-01).
- **사용자 가치 우선 (owner 2026-10-20, 반복 지시):** 이 저장소의 규칙·게이트·기준·과거 결정은 소유자와 이전 에이전트가 만든 작업물이지 정답이 아니다. 판단 순서는 ① 여러 사용자 입장에서 무엇이 좋고 편리한가 → ② 그것을 최대한 구현 → ③ 규칙·게이트가 막으면 그 규칙이 지금도 맞는지 다시 따져 틀렸으면 규칙·게이트를 근거와 함께 고친다(기록은 record-fix) → ④ 실제 한계(데이터 권리·비용·기술·데이터 정직성)가 있을 때만 버리고 이유를 밝힌다. "기존 데이터가 없다"는 버릴 이유가 아니다 — 무료 공식 출처로 수집·자동화할 수 있는지 먼저 검토한다. 비밀정보·AI 예산 원장과 경고·지어낸 숫자 금지·티커 추정 금지·매매 지시 금지는 사용자 보호 장치라 이 항목으로 완화하지 않는다.

## Product decisions (fixed)

Owner decisions applied without re-asking; changed only by the user.

- **Audience:** the operator's family and friends (~5 users, 2–4 concurrent); free, one operator, automated; no public-SaaS features (sign-up, billing, multi-tenant).
- **Compliance scope (owner 2026-10-17):** a free tool for family and friends, not a licensed or paid advisory service. Public-paid-service procedures (formal user studies, beta sign-off, SLO certification, per-provider license audits) are advisory, never blockers; provider terms are respected (attribution, no bulk redistribution, no paywall bypass). Kept regardless: secrets and the AI budget ledger with its alerts, data honesty (dates, stale/missing states, no invented numbers), no ticker guessing, no personal trade instructions, and no unvalidated score shown as a verdict. The site and repo are public: anything published is visible beyond the family.
- **Budget (2026-10-11):** prefer free public sources. Shared AI targets $20/month incl. search — it warns, never blocks (owner 2026-10-27). Paid data needs a demonstrated gap and owner approval.- **Scores** describe the market on the **latest completed US regular-session close** ("직전 미국장 종가 기준", R670), labelled with that basis, never decision-grade; missing inputs hold the score and are never guessed.
- **Responsive (2026-10-11):** desktop, phone and iPad share routes and data; layout adapts, desktop density kept; test nav, tables, charts, theme, AI input.
- The options route is retired (`#options` → `sentiment`).
- **Screen design (2026-10-02~03):** conclusion first (one line) → chart → evidence, in two layers (2026-10-31): a beginner's conclusion up front, the expert reading folded; short text, 3-second narrated visuals; trends are charts with labelled axes. No developer copy on user surfaces. Questions only in long prose; labels, chips, cards are statements; no quizzes (2026-11-07).
- **No grades or trade instructions:** no composite/letter scores without predictive evidence (0–100 market score retired). The app never picks the stock, price, size or timing (no entry/stop/target/pyramid/trim) but teaches the choosing (2026-10-24): level maps (support/resistance candidates, volume zones, MAs, ATR distance), how professionals pick themes, stocks, stops and targets, met-criteria counts with values, data-backed cause chains, and fact checks of the user's own plan. Screens and AI look forward (2026-10-12/13) — each scenario is a branch from upcoming official events and current conditions with its cause→effect chain, what to check/watch/ignore, general choices (wait, stage in, hold, defend) with the conditions under which each costs or helps and, per branch, the relatively favoured one with its reason — conditional reasoning, never an instruction and never addressed to the reader's own holdings (R698). Evidence for a branch is limited to met-condition count (shown as a count, never called a likelihood), market-implied direction (e.g. 2-year yield vs policy range) and past frequency in our own history with sample size — never a price, size, timing or invented probability (R697). Past frequencies count non-overlapping cases with only data available at each case date; below 10 cases counts only, 10–29 a small-sample note, a rate always beside its base rate. Lean labels: `market-lean.js` (2026-10-26).
- **Freshness (2026-10-12; cadence-relative 2026-10-15):** data, readings and AI text follow the latest artifacts. Staleness follows each source's cadence — stale once a newer publication should exist (intraday: minutes in session; daily closes: next session; macro: next scheduled release; 13F: the next 45-day filing deadline, quarter-end date always shown). A stale value shows its date, never as current. New features state producer and cadence.
- **No ticker guessing:** names resolve only by exact registry match; a ticker-shaped input is never rewritten to another issuer (P1339).
- **Producers** — scripts that fetch external data or write `public-data/` artifacts (`fetch-*`, the data `build-*`/`refresh-*`, `sync-screener-universe`, `sync-data-release-manifests`) — run only in GitHub Actions; locally, read artifacts and run gates. Workspace generators (`generate-workspace-state`, `sync-agent-*`, `bump-version`, `record-fix`) are not producers and run locally (v57.84: judged by effect, not by name prefix).
- **Markets:** US first; Korean themes and Korean-market content are real user features, labelled '한국' and secondary.
- **Batches:** implement several items, one code-reviewer on the batch diff per `REVIEW.md`, then verify and record once.
- **Information architecture (2026-10-01; 9 screens 2026-11-03):** 오늘(home: indexes, key prices and stocks, top news; briefing: the last 24h linked and explained; market-news), 시장 상태(objective diagnosis, scenarios, what to check; breadth and sentiment woven into each section as evidence, never a block of their own), 매크로(macro+fxbond; each asset read and tied to the market), 기술적 분석(index and core-stock charts), 테마 · 섹터, 스크리너, 종목(ticker+fundamental+technical), 포트폴리오, 리서치 라이브러리; 용어 사전 is a modal. Merges move legacy `js/` to `src/`, deleting replaced code; old ids stay aliases.
- **Materiality (2026-11-03):** facts come from one ledger (`market-day.json`) ranked by market weight — move against its own volatility, index weight, what it explains, source tier. The important lead where they belong, minor ones support, noise is dropped; never show a trivial item as important or bury a key one.
- **Honesty without clutter:** one status per card (최신/지연/참고/없음), details on demand, one global disclaimer. Remove widgets with no designed source; a designed source that failed stays visible as 없음 with its last date, never hidden; remove uncalibrated grades/scores; a reference score always shows its basis.
- **Slow data is static:** 13F, knowledge base, principles and glossary are versioned static JSON, updated on source change; content-addressed artifacts hash content only (P1370). 13D/G keeps its light daily poll (P1309/R654).
- **Filling gaps (2026-10-11):** existing artifacts and official free sources first (FRED, Treasury, BLS, BEA, SEC, BOK/ECOS, KOSIS, KRX); cited OpenAI web search when they cannot answer or to corroborate. Search never feeds numbers to scores, tables or charts; citations don't certify freshness; collection time never replaces publication time.
- **AI (2026-10-11/12; Workers AI 2026-10-14):** generation uses OpenAI `gpt-6-luna` via the shared Worker, except headline translation, which tries the Worker's free Workers AI binding first and falls back to it; `OPENAI_API_KEY` stays in Worker Secrets. Chat, translation, Actions analysis and web search share one atomic UTC-month ledger, $20 target (R681 v59.27); personal keys or other paid providers never bypass it. No per-user search allowance. Hosted search ≤ 2 calls/response; completed responses settle validated usage plus one fee per web_search_call (v57.62); incomplete ones keep the reservation. AI is always on, search automatic, one top AI panel. Daily/request counts are runaway backstops, not billing caps.

## Task routing

| Task | Skill / evidence |
|---|---|
| Defect or failed gate | `bug-fix` → matching P/R/QA entries → regression gate |
| Code, UI, workflow or skill verification | `post-edit-qa` → risk-derived tiers |
| Data freshness or generated artifacts | `data-refresh` |
| Supplied research or market framework | `integrate` |
| Docs, skills, agents, hooks or knowledge drift | `knowledge-lint` |
| Skill experiments and eval design | `autoresearch` |
| Delegation and working commands | `.agents/skills/_shared/agent-prompt-anatomy.md`; `.claude/commands/{restate,assumptions,why,prototype,first-users,trim-pr,retro}.md` |

## Non-negotiable boundaries

- Automatic commit, push and deployment are forbidden; only on explicit user request. Standing authority (owner 2026-11-01): when the batch and all its threads finish, integrate safely and commit/push `main` once; never mid-batch. A passing gate implies no commit or deploy.
- Versioned changes use `node scripts/bump-version.mjs <version>` (R1, all version surfaces; `ci-version-check.mjs`).
- Bug fixes get a new P entry; features/cleanups a change-only `record-fix` entry (after `bump-version`, then `generate-workspace-state --write`). Recurring defect classes become RULES/QA plus a gate. New assertions cite the P/R entry or the introducing release (`vNN.NN` with a CHANGELOG heading) — `ci-assertion-trace-check.mjs`; `ci-ledger-integrity-check.mjs` freezes the R gap set and requires `verify_by:` on new open QA items. New text pins on product source are frozen by `ci-text-pin-ratchet-check.mjs` — test behaviour instead.
- Generated workspace files are never hand-edited (`generate-workspace-state.mjs --write`, `sync-agent-profiles.mjs`, `sync-agent-skills.mjs`).
- Static, headless, browser and live evidence are separate levels; never promote one upward.
- Change flow (2026-09-30): work on `main`; local QA (`qa-runner affected`; `qa:full` certifies releases) → commit → push per the authority above. CI on main is the release gate (Pages/Workers deploy only the CI-attested SHA). No PR for routine work.
- Before pushing: `git fetch origin` + `git merge origin/main`; generated-manifest conflicts → `node scripts/resolve-generated-conflicts.mjs` and its gates. Push only once `git diff --name-only --diff-filter=U` is empty with no conflict markers, as its own command, never at the end of a `;`/pipe chain (v57.82).
- Branches for parallel threads (routine since 2026-10-26) or risky experiments: disjoint files; no bump or record-fix on the branch — entries go to `_artifacts/pending-records/<thread>/` for `apply-pending-records.mjs` at merge.
- LF line endings (`.gitattributes`, P1344) except `*.cmd`/`*.ps1`.

## Closeout

Run `node scripts/qa-runner.mjs affected --session <task-id>` (pipeline `architecture/qa-pipeline.json`; without a baseline use `--files <a,b>`), fix the whole failure batch, then `rerun-failed`. `full --no-cache` certifies a release/shared shell (one at a time — they share `_artifacts/`), `external --no-cache` deployed claims. Workspace changes add `--group preflight`, `--group workspace` (v57.61) and `git diff --check`; add the gates the touched surface selects. Final reports separate verified, blocked and unverified work and say whether commit/deploy occurred.
