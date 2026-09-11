# AIO Screener — Agent Guide

AIO Screener는 GitHub Pages에서 제공되는 하이브리드 정적 셸 + native ESM 투자 리서치 터미널이다. 현재 버전·라우트·파일 크기·지식 상태는 사람이 이 문서에 복사하지 않는다. 항상 [`_context/CURRENT-STATE.md`](./_context/CURRENT-STATE.md)와 원본 레지스트리에서 파생한다.

## Mandatory preflight

1. `git status --short`와 `version.json`으로 작업 트리 경계를 확인한다. 기존 dirty 변경은 사용자 소유다. 수정 전에 `node scripts/qa-runner.mjs session-start --session <task-id>`로 content-hash 기준선을 잡는다.
2. `_context/CURRENT-STATE.md`는 작업 시작에 한 번 확인한다. `_context/INDEX.md`는 위치 탐색이 필요할 때, `_context/WORKFLOW-GOVERNANCE.md`는 QA·권한·워크플로 상세가 필요할 때만 읽는다. 이미 읽은 변경 없는 문서는 반복 로드하지 않는다.
3. 작업 판단에 실제로 도움이 되는 스킬만 사용한다. 사용할 `SKILL.md`를 읽고 현재 작업에 필요한 reference만 선택한다. 키워드 일치만으로 스킬이나 전체 절차를 강제하지 않는다.
4. `RULES.md`, `BUG-POSTMORTEM.md`, `QA-CHECKLIST.md`, `KNOWLEDGE-BASE.md`는 전체 로드하지 않는다. 관련 함수·R/P/QA ID·키워드로 검색한 범위만 읽는다.
5. `index.html`은 `_context/CODE-MAP.md`에서 담당 구간을 찾은 뒤 필요한 범위만 수정한다.

## Working agreement

- 사용자의 현재 지시와 이전에 승인된 범위를 따른다. “할 수 있나”, “원한다”, “도와줘”는 실행 요청으로 해석하고, 합리적인 일상 선택은 직접 결정한다.
- 완료는 요청한 변경의 구현·필요한 실행·결과 확인·발견된 관련 실패 수정까지다. 중간 질문에 답한 뒤에도 원래 목표를 유지한다. 범위가 넓으면 항목별 미검증 상태를 남기고 자동 PASS를 의미 검수 완료로 바꾸지 않는다.
- 사용자 지시가 스킬 지침보다 우선한다. 스킬 때문에 멈출 때는 정확한 파일과 해당 문구, 실제 적용 이유를 밝힌다. 로컬 수정·생성·격리 테스트에는 중복 확인을 요구하지 않는다. 아래 commit/push/deploy 경계는 유지한다.
- 독립적인 조사·리뷰를 병렬 위임하면 실제로 도움이 되는 큰 작업에서는 범위가 명확한 서브에이전트를 사용한다. 파일 소유권을 분리하고 기존 변경을 보존하며, 작은 일이나 같은 조사에는 위임을 늘리지 않는다. 결과는 주 담당자가 통합 검증한다.
- 한국어로 결과와 근거를 간결하게 설명한다. 에이전트 간 메시지도 정상적인 문장과 띄어쓰기를 사용한다. 통과한 검사는 새 변경·실패·미해결 위험이 있을 때만 다시 실행한다.

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
