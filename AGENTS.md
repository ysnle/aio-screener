# AIO Screener — Agent Guide

AIO Screener는 GitHub Pages에서 제공되는 하이브리드 정적 셸 + native ESM 투자 리서치 터미널이다. 현재 버전·라우트·파일 크기·지식 상태는 사람이 이 문서에 복사하지 않는다. 항상 [`_context/CURRENT-STATE.md`](./_context/CURRENT-STATE.md)와 원본 레지스트리에서 파생한다.

## Mandatory preflight

1. `git status --short`와 `version.json`으로 작업 트리 경계를 확인한다. 기존 dirty 변경은 사용자 소유다. 수정 전에 `node scripts/qa-runner.mjs session-start --session <task-id>`로 content-hash 기준선을 잡는다.
2. `_context/CURRENT-STATE.md`, `_context/WORKFLOW-GOVERNANCE.md`, `_context/INDEX.md`만 공통으로 읽는다.
3. 작업과 일치하는 스킬의 `SKILL.md`를 완전히 읽고, 그 스킬이 직접 지정한 reference만 추가로 읽는다.
4. `RULES.md`, `BUG-POSTMORTEM.md`, `QA-CHECKLIST.md`, `KNOWLEDGE-BASE.md`는 전체 로드하지 않는다. 관련 함수·R/P/QA ID·키워드로 검색한 범위만 읽는다.
5. `index.html`은 `_context/CODE-MAP.md`에서 담당 구간을 찾은 뒤 필요한 범위만 수정한다.

## Task routing

| Task | Skill / evidence |
|---|---|
| Defect or failed gate | `bug-fix` → matching P/R/QA entries → regression gate |
| Code, UI, workflow or skill verification | `post-edit-qa` → risk-derived tiers |
| Data freshness or generated artifacts | `data-refresh` |
| Supplied research or market framework | `integrate` |
| Docs, skills, agents, hooks or knowledge drift | `knowledge-lint` |
| Skill experiments and eval design | `autoresearch` |

## Non-negotiable boundaries

- Automatic commit, push and deployment are forbidden. Run them only after an explicit user request for that action.
- Use `node scripts/bump-version.mjs <version>` for versioned changes. R1 remains the existing seven synchronized surface groups and is verified by `ci-version-check.mjs`.
- Bug fixes require a new P entry. Promote recurring classes to RULES/QA and an executable gate.
- Generated workspace files are never hand-edited: run `node scripts/generate-workspace-state.mjs --write`, `node scripts/sync-agent-profiles.mjs`, and `node scripts/sync-agent-skills.mjs` as applicable.
- Static, runtime/headless, browser and live evidence are separate. Never promote a lower evidence level to a higher one.
- No commit or deployment is implied by “finish”, “fix all”, QA completion, or a passing local gate.

## Closeout

Use `architecture/qa-pipeline.json` through `node scripts/qa-runner.mjs affected --session <task-id>` for normal closeout. If no baseline was captured, pass the exact task-owned list with `--files <comma-separated-paths>`; never let unrelated pre-existing dirty files silently widen the run. Fix the complete failure batch, then use `rerun-failed`, which rechecks the exact failed gates and declared dependencies. Reserve `full --no-cache` for release/shared-shell certification and `external --no-cache` for deployed claims.

For workspace-facing changes run at minimum:

```text
node scripts/generate-workspace-state.mjs --check
node scripts/ci-workspace-contract-check.mjs
node scripts/ci-knowledge-lint-check.mjs
node scripts/ci-skill-contract-check.mjs
node scripts/ci-skill-eval-fixture-check.mjs
node scripts/sync-agent-profiles.mjs --check
node scripts/sync-agent-skills.mjs --check
git diff --check
```

Add the code/data/browser gates selected by the touched surface. Final reports must separate verified, blocked and unverified work and state whether commit/deploy occurred.
