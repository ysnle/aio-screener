---
verified_by: local source review + ledger structure gates (ci-ledger-integrity, ci-record-fix, ci-workflow-compaction); live facts in CURRENT-STATE.md
last_verified: 2026-10-31
confidence: medium
target_version: v57.79
# 규칙 원장 — 원칙 18개(C1~C18)와 그 아래 R 규칙 (2026-10-31 v59.48 재구성)
# 2026-10-31 기준 R 규칙 727건(비활성 Retired/Superseded 46건), 빈 번호 5건은 _context/rule-gap-manifest.json. 각 규칙은 `## R<n>.` 헤딩 + 원칙이 말하지 않는 요구 한 줄 + 게이트·퇴역 줄만 남긴다.
# 축약 전 전문(규칙 본문·v48 레거시 체크리스트·P31~P60 블록·validate-edit.sh 훅 표)은 git 46bad2f6 의 _context/RULES.md 에 있다. R 번호는 재번호 없이 전량 보존.
---

## 수신함 — 새 규칙은 여기 들어온다

`node scripts/record-fix.mjs`는 새 규칙을 `## R<max+1>.` 헤딩으로 이 파일의 맨 위 `## R` 헤딩 바로 위에 넣는다. 그래서 이 수신함이 파일에서 첫 `## R` 헤딩을 가진다(가장 최근 규칙 하나는 앵커로 남긴다). 새 결함은 먼저 아래 원칙 중 어느 불변식을 어겼는지 보고, 그 원칙의 게이트에 케이스를 더해 막을 수 있으면 새 규칙을 만들지 않는다. 다음 정리 때 수신함 규칙을 해당 원칙 아래로 옮긴다. 핵심 규칙 색인은 수신함 바로 아래다.

## R733. 시간 경계를 다루는 분류기와 그 게이트는 벽시계·그날 자료가 아니라 고정 시계와 시간표 전수 검사로 증명한다 (v59.49, P2162)

**Rule**: 장 시작·마감·주말·재개장·서머타임 경계를 판정하는 코드(세션 분류, 뉴스 주기, 단계 창)와 그것을 검사하는 게이트는 실행 시각이나 그날의 공개 자료에 따라 결과가 달라지면 안 된다. 테스트는 고정 시계와 고정 입력으로 돌리고, 세션 분류기는 시장 시간표에서 따로 유도한 기대값과 일주일 이상을 10분 간격으로 전수 비교한다. 데이터 전용 커밋을 만드는 생산자는 CI를 데이터 출처(origin)로 호출해 자료 내용에 반응하는 브라우저 예산 게이트로 데이터 반영이 멈추지 않게 한다.

**Validation**: node scripts/ci-market-snapshot-contract-check.mjs(시간표 전수 검사, scripts/lib/market-session-sweep.mjs), node scripts/ci-esm-core-unit-check.mjs(뉴스 점검 07:00·12:00 KST 고정 시계), node scripts/ci-qa-pipeline-contract-check.mjs(event-briefs 데이터 출처).

## R732. 의미 검토에서 찾은 결함은 결함 id를 단 실제 함수 케이스로 남긴다 (v59.45, P2141)

**Rule**: 파이프라인 의미·정합성 검토(외부 리뷰어 포함)에서 확인된 결함을 고칠 때는 scripts/fixtures/pipeline-semantics/<영역>.mjs에 그 finding id를 단 케이스를 추가한다. 케이스는 실제 도메인·생산자 함수를 작은 고정 입력으로 부르고, 결함 조건이 돌아오면 실패해야 한다. 소스 문자열 고정(regex pin)으로 대신하지 않는다.

**Validation**: node scripts/ci-pipeline-semantics-check.mjs (qa-pipeline core 그룹 pipeline-semantics 게이트, 중복 id+name 거부).

**원칙**: C3 검증은 실제 결과를 증명한다.

## 핵심 규칙 색인 — 원칙 C1~C18 (먼저 읽기)

각 원칙은 불변식 하나와 그것을 실행하는 게이트를 가진다. 규칙(R)은 그 불변식을 어긴 사례에서 나온 구체 요구이고, 원칙 본문에는 원칙이 말하지 않는 요구 한 줄과 게이트·퇴역 줄만 남긴다. `**Retired**`/`**Superseded by**` 줄이 있는 규칙은 살아 있지 않다. 축약 전 전문은 frontmatter의 커밋에 있다.

| 원칙 | 불변식 (한 줄) | 정본 | 게이트 | 규칙 수 |
|---|---|---|---|---|
| C1 기록·버전·원장은 스크립트가 쓴다 | 버전 표면·결함 기록·규칙 번호는 손으로 맞추지 않는다. | R618 | `ci-version-check` 외 4 | 16 (비활성 2) |
| C2 작업 공간 사실은 생성되고, 도구는 정본 하나에서 나온다 | 변하는 작업 공간 사실은 생성된 `CURRENT-STATE.md`에서만 읽고, 큰 원장은 검색 전용이다. | R520 | `ci-knowledge-lint-check` 외 3 | 19 (비활성 0) |
| C3 검증은 실제 결과를 증명한다 | 게이트 PASS는 의미 검토가 아니다. | R219 | `ci-semantic-review-check` 외 4 | 63 (비활성 1) |
| C4 한 의미에는 한 구현 | 같은 의미의 함수·전역·집합은 한 곳에서만 구현하고 나머지는 그것을 읽는다. | R619 | `ci-structural-check` 외 4 | 41 (비활성 0) |
| C5 화면은 라우트가 소유한다 | 사용자 화면은 8화면 정보구조(`architecture/route-owners.json`)이고, 각 화면의 마운트·데이터 적재·타이머·리스너·입력 처리는 그 라우트의 owner 하나가 가진다. | R704 | `ci-architecture-contract-check` 외 4 | 50 (비활성 1) |
| C6 표시는 기기에 적응하고 접근성을 지킨다 | 데스크톱·휴대폰·아이패드는 같은 라우트·데이터를 쓰고 레이아웃만 적응한다. | R669 | `ci-accessibility-matrix-check` 외 3 | 23 (비활성 4) |
| C7 읽는 문장은 관측과 근거만 말한다 | 화면 문장은 측정한 조건과 그 근거를 말하고, 등급·검증 안 된 합산·행동 지시·근거 없는 확률·내부 코드·개발자 마커를 쓰지 않는다. | R697 | `ci-rendered-copy-lint-check` 외 2 | 14 (비활성 1) |
| C8 결측은 값이 아니다 | 없는 관측은 0도, 중립값도, 조건 충족도 아니다. | R628 | `ci-esm-core-unit-check` 외 3 | 22 (비활성 0) |
| C9 현재성은 관측 시각과 달력에서 나온다 | 사건·관측·수집·발행 시각은 서로 대신하지 않는다. | R671 | `ci-data-refresh-audit` 외 4 | 57 (비활성 4) |
| C10 한 지표에는 한 원천과 한 표시 owner | 같은 지표·라벨·임계값은 하나의 selector·상수·resolver에서 읽고, 여러 화면·미러·AI 문맥은 그 값을 공유한다. | R301 | `ci-domain-parity-check` 외 3 | 45 (비활성 1) |
| C11 판단은 근거 게이트와 검증된 방법을 거친다 | 파생 결론은 필수 입력의 의미·기준일·coverage가 갖춰질 때만 보인다. | R340 | `ci-crash-replay-check` 외 4 | 39 (비활성 0) |
| C12 종목과 공시는 정확한 등록으로만 식별한다 | 종목은 정확한 등록(심볼·발행사·주식 종류) 일치로만 해석하고 추측하지 않는다. | R663 | `ci-sec-runtime-projection-check` 외 4 | 27 (비활성 1) |
| C13 생산자는 수집→산출물→소비→감사를 닫는다 | 데이터는 GitHub Actions 생산자만 만들고 클라이언트는 발행된 산출물만 읽는다. | R217 | `ci-data-pipeline-contract-check` 외 4 | 53 (비활성 1) |
| C14 뉴스와 외부 정성 자료는 출처를 지닌 참고 입력이다 | 뉴스·텔레그램·북마크·사용자 제공 자료는 출처·관측 시각·원본 식별을 보존한 참고(REFERENCE) 입력이고, 현재 수치로 승격하지 않는다. | R510 | `ci-expect-output-check` 외 3 | 31 (비활성 0) |
| C15 지식·학습 자료는 구조와 의미를 따로 인증한다 | 학습·지식 corpus는 구조적 완성과 의미 인증을 다른 상태로 둔다. | R524 | `ci-knowledge-corpus-check` 외 4 | 30 (비활성 0) |
| C16 AI는 공용 Worker 한 경로와 근거 계약을 쓴다 | 모든 AI는 공용 Worker 한 경로(웹검색 포함 월 $20 예산)를 함께 쓴다. | R681 | `ci-ai-intelligence-contract-check` 외 3 | 103 (비활성 6) |
| C17 운영·배포·보안은 증거로 닫힌 쪽에 선다 | 배포는 정확한 CI 증거(SHA)와 롤백 대상이 있어야 하고, 운영 상태는 주장하는 능력의 실제 증거에서 파생하며, 알림은 증거를 남기고 닫힌 쪽으로 실패한다. | R652 | `ci-operations-contract-check` 외 4 | 71 (비활성 5) |
| C18 퇴역한 기능은 흔적 없이 걷어낸다 | 퇴역 기능은 inert stub로 남기지 않고 라우트·writer·타이머·리스너·공개 산출물까지 수직으로 제거한다. | R341 | `ci-retirement-contract` 외 2 | 23 (비활성 19) |

## 원칙 C1 — 기록·버전·원장은 스크립트가 쓴다

**불변식**: 버전 표면·결함 기록·규칙 번호는 손으로 맞추지 않는다. 버전은 `bump-version`, 결함과 규칙은 `record-fix`로만 쓰고, R 번호 하나는 규칙 하나를 가리키며 인용한 id는 실제로 있어야 한다. QA 증명은 실제로 실행한 검사 범위와 커밋 index에 묶인다.

**게이트**: `scripts/ci-version-check.mjs` · `scripts/ci-record-fix-check.mjs` · `scripts/ci-ledger-integrity-check.mjs` · `scripts/ci-assertion-trace-check.mjs` · `scripts/ci-release-revision-check.mjs`

**정본**: R618 · 핵심: R1, R3, R618, R690 · 규칙 16건 (비활성 2건)

## R711. 규칙 번호 하나는 규칙 하나를 가리키고, 원장 게이트는 실제 헤딩 형태를 모두 읽는다 (v57.84, P1855)
원장 게이트는 원장에 실제로 쓰이는 헤딩 형태(`## R<n>.`, `### R<n>.`, 범위 섹션의 인라인 `R<n> —`)를 모두 읽는다. 같은 번호를 두 규칙에 쓰지 않는다 — 인용이 어느 규칙인지 알 수 없게 된다. 충돌하면 나중에 생긴 쪽을 다음 빈 번호로 옮기고 옛 번호를 본문에 남긴다. 게이트: `ci-ledger-integrity-check`.

## R699. A cited ledger id must exist (v57.30, P1545)
A test label that cites only P/R ids passes the trace gate only if each id resolves to a ledger entry; other evidence kinds (T, QA, workstream ids) are unchanged. 게이트: `ci-assertion-trace-check`.

## R690. QA 증명은 실제 검사 범위·내용과 커밋 전체 index에 결속 (v57.29, P1518)
fast/affected/실패 재검사 PASS로 전체 출시 증명을 새로 만들거나 덮지 않는다. candidate는 full --no-cache 전체 PASS 증명의 gate 집합·manifest·runner와 모든 tracked index 의존 내용 및 추가 staged bytes를 대조한다. 게이트: `ci-qa-runner-behavior-check`, `ci-qa-pipeline-contract-check`.

## R667. Ledger frontmatter is metadata, not an evidence log (v56.79)
`_context/*.md` YAML frontmatter carries only durable metadata (`last_verified`, `confidence`, `target_version`, pointers). 게이트: `ci-knowledge-lint-check`.

## R618. 원장 루프는 서술이 아니라 기계로 닫는다 (v55.06, P1123~P1125)
기록은 다음 세션이 참조할 수 있을 때만 자가 개선이 된다. 참조할 수 있게 만드는 것은 문서 규율이 아니라 실행되는 검사다. (1) 단언은 근거를 인용한다: 게이트·테스트의 각 단언은 그것이 재발을 막는 P/R/QA 항목을 이름으로 가리킨다. 게이트: `ci-assertion-trace-check`, `ci-ledger-integrity-check`, `ci-knowledge-lint-check`.

## R598. 완료한 작업은 표준 진입점에서 발견 가능한 핸드오프 기록을 남긴다 (v54.98, P1074)
여러 에이전트가 교대하는 저장소에서 CHANGELOG·BUG-POSTMORTEM·RULES·QA-CHECKLIST 갱신만으로는 충분하지 않다.

## R542. 버전 범프는 revision-bound 실행 증거를 자동 승격하지 않고 무효화한다 (v54.60, P976)
R1 source revision 변경은 과거 boot·route soak·live parity를 새 revision의 PASS로 치환하지 않는다. 게이트: `ci-operations-contract-check`.

## R487. Selective releases validate R1 surfaces from the staged tree (v54.22)
When an R1/version surface contains unrelated unstaged work, a local working-tree pass is insufficient. 게이트: `ci-version-check`.

## R475. Release versions use canonical major or two-digit patch notation (v54.17)
Version identifiers use `v<major>` for a major rollover and `v<major>.<patch>` with exactly two patch digits thereafter. 게이트: `ci-version-check`, `ci-release-revision-check`, `ci-operations-contract-check`.

## R419. 릴리스 아키텍처 매니페스트는 R1 버전과 함께 동기화해야 한다 (v53.64, P864)
`version.json`, `sw.js`, `architecture/asset-manifest.json`, `architecture/release-manifest.json`, `architecture/visual-state-matrix.json`… 게이트: `ci-architecture-contract-check`, `ci-operations-contract-check`, `ci-release-revision-check` (구 ci-release-manifest-contract 통합).

## R246. Version-bump commits must land atomically; never leave main in a partially-synced state (v51.82)

## R202. Runtime version uses one or two decimal digits only (v50.1 added)
**Superseded by R475 (v59.48)**: 한두 자리 소수 허용은 R475의 정본 표기(major 또는 두 자리 patch)로 대체됐다.

## R25. 버그 역참조 체계 (v41.6 추가)
BUG-POSTMORTEM.md 각 버그 항목에 `violated_rule: R{N}` 태그 필수 기록

## R3. 버그 수정 시 사후 분석 필수
결함 수정은 `bump-version` 뒤 `node scripts/record-fix.mjs <entry.json>`으로 P/R/QA/CHANGELOG를 한 번에 기록한다.

## R2. 버전 체계
**Superseded by R475 (v57.79)**: versions use canonical major or two-digit patch notation.

## R1. 버전 동기화 — 표면 목록은 ci-version-check가 소유 (v57.79 개정)
모든 버전 표면(`ci-version-check`가 열거)은 `node scripts/bump-version.mjs <버전>`으로만 바꾼다. R1-A: 배포된 버전은 명시적 배포 뒤 `ci-live-invariant-check`가 인증한다. 게이트: `ci-version-check`, `ci-live-invariant-check`.

## 원칙 C2 — 작업 공간 사실은 생성되고, 도구는 정본 하나에서 나온다

**불변식**: 변하는 작업 공간 사실은 생성된 `CURRENT-STATE.md`에서만 읽고, 큰 원장은 검색 전용이다. 스킬·명령 wrapper·에이전트 프로필은 정본 하나에서 생성하고, 훅은 파괴 명령 차단과 권고만 한다. 소유자 결정과 변경 흐름은 저장소(`AGENTS.md`)에 둔다.

**게이트**: `scripts/ci-knowledge-lint-check.mjs` · `scripts/ci-workspace-contract-check.mjs` · `scripts/ci-workflow-compaction-check.mjs` · `scripts/ci-skill-contract-check.mjs`

**정본**: R520 · 핵심: R27 · 규칙 19건 (비활성 0건)

## R676. Owner decisions and the change flow are shared repository state (v56.85, P1343)
Fixed product decisions (scope, score basis, platform, retired routes, no ticker guessing, where producers run, how changes ship) are written in AGENTS.md, which every… 게이트: `ci-workspace-contract-check`.

## R611. 클라이언트별 훅 페이로드는 각각 픽스처로 고정한다 (v54.99, P1084)
하나의 훅 구현을 여러 에이전트 클라이언트가 공유하면 페이로드 스키마가 클라이언트마다 다르다는 전제를 명시적으로 다룬다. 게이트: `ci-workspace-contract-check`.

## R565. 텍스트 projection manifest의 digest·bytes는 checkout 줄바꿈에 독립적이어야 한다 (v54.63, P999)
GitHub Pages에 배포되는 JSON 텍스트의 manifest digest와 bytes는 CRLF/LF checkout 파일을 직접 해시하지 않고 LF 정규화된 UTF-8 직렬화를 기준으로 계산한다.

## R564. 생성 상태의 텍스트 크기는 checkout 줄바꿈과 무관해야 한다 (v54.63, P998)
`CURRENT-STATE`·`CONTEXT-CATALOG`의 텍스트 바이트 집계는 CRLF/LF 물리 표현을 직접 세지 않고 LF 정규화된 UTF-8 크기를 사용한다.

## R535. 제품 범위·non-goal·trust plane은 구현보다 먼저 계약한다 (v54.59, P972)
AIO의 제품 정체성은 자기주도 투자 연구·의사결정 보조이며 주문 실행, 무조건적 개인화 행동 지시, 라이선스 전문 실시간 단말 parity, 공개 best-effort 자료의 real-time 주장은 non-goal이다. 게이트: `ci-product-charter-contract-check`.

## R523. Workspace and knowledge drift are push gates with deduplicated operational escalation (v54.57, P964)
workspace contract and knowledge lint run on every push/PR that can deploy and on the scheduled knowledge workflow. 게이트: `ci-workspace-contract-check`.

## R522. Skills and agent profiles require generated parity plus observable eval inputs (v54.57, P964)
`.claude/skills` is the canonical skill tree and tracked `.agents/skills` is its generated byte mirror and portable Codex discovery surface. 게이트: `ci-skill-contract-check` (구 ci-skill-eval-fixture-check 통합).

## R521. Agent hooks are portable guardrails and never mutate repository authority state (v54.57, P964)
project hooks must consume one JSON object from stdin, resolve scripts from the Git root, support Windows commands and emit only documented event output. 게이트: `ci-workspace-contract-check`.

## R520. Current workspace facts are generated once and historical ledgers are search-only (v54.57, P964)
version, route count, code size, context inventory, skill/agent/workflow counts and knowledge readiness must be derived from repository registries into… 게이트: `ci-workspace-contract-check`, `ci-knowledge-lint-check`, `ci-workflow-compaction-check`.

## R309. Bulk text-replacement scripts must not run blindly across JS string literals — check for characters doing double duty as logic markers before a global find-replace (v52.62, P678 root)
Any script that mechanically strips or remaps literal characters/colors across an entire source file (not just HTML display text) can hit JS string literals where that…

## R296. A session-scoped automation hook must not hardcode an absolute environment fact, and must scope its side effects to what changed during its own session, not whatever it finds lying around (v52.47, WO-5/P663 root)
Hooks use repo-relative paths and never stage or commit; a session's own changed paths come from the session-start baseline (`qa-runner session-start`).

## R237. Skills must use one canonical router-plus-reference tree; assistant-specific roots are generated mirrors, never independent instructions (v53.96, P894)

## R236. Skills, command wrappers, references, encoding sentinels, and any materialized local mirror must be contract-gated (v53.96, P894)

## R220. Workflow memory must be compacted before it is extended (v50.89, P514 root)
`_context`, `CLAUDE.md`, QA checklists, postmortems, and `.claude/skills/*/SKILL.md` are operating surfaces, not infinite append-only logs. 게이트: `ci-workflow-compaction-check`.

## R46. HTML 외 JS 파일까지 sed 치환 범위 확대 (v48.61 추가)

## R27. Commands ↔ Skills 동기화 (v46.2 추가, P69 교훈)
새 스킬(`skills/xxx/SKILL.md`) 추가 시 반드시 `commands/xxx.md` wrapper도 동시 생성

## R26. 기술 인사이트 환류 (v41.6 추가)
대화/작업 중 발견한 기술적 인사이트(API 동작, 브라우저 quirks, 라이브러리 패턴)는 `_context/KNOWLEDGE-BASE.md`에 축적

## R24. _context/ 인덱스 자동 관리 (v41.6 추가)
`_context/INDEX.md`는 지식 베이스 전체 문서의 역할, 상태, 연결 관계를 기록하는 자동 인덱스

## R19. _context/ 지식 정합성 린팅 (v40.4 추가)

## 원칙 C3 — 검증은 실제 결과를 증명한다

**불변식**: 게이트 PASS는 의미 검토가 아니다. 검사는 렌더된 화면이나 실제 함수 호출 결과를 단언하고, 막으려는 결함을 재현한 입력에서 실패함을 보인 뒤에야 근거가 된다. 검사 범위는 변경에서 파생하고, 검사·감사 장치는 사용자 런타임에 들어가지 않는다.

**게이트**: `scripts/ci-semantic-review-check.mjs` · `scripts/ci-pipeline-semantics-check.mjs` · `scripts/ci-qa-pipeline-contract-check.mjs` · `scripts/ci-qa-runner-behavior-check.mjs` · `scripts/ci-headless-tests.mjs`

**정본**: R219 · 수신함: R732 · 규칙 63건 (비활성 1건)

## R720. 게이트는 자신이 막는 결함을 재현한 입력에서 실패함을 보인 뒤에만 통과 근거가 된다 (v58.63, P1966)
새 게이트·단언이나 게이트 수정은 (1) 막으려는 결함을 재현한 입력(또는 수정 전 코드)에서 실패하고 (2) 올바른 입력에서 통과함을 함께 보인다. 측정 대상 집합이 비었거나 일부만 읽히면(0개 파일, 0개 필수 항목, 잘린 표본) 통과가 아니라 실패다. 게이트: `ci-qa-runner-behavior-check`, `ci-record-fix-check`, `ci-architecture-audit-regression-fixture`.

## R716. 세션 수 하한은 생산자가 받는 실제 길이로 검사한다 (v57.86, P1876)
52주·1년 같은 세션 수 하한을 정하거나 바꿀 때는 생산자가 실제로 받는 봉 수(Yahoo range=1y: 미국 251, 한국 245, 미완성 세션 제거 시 1 적음)를 고정 테스트에 넣는다. 달력상 거래일 수(252)를 그대로 하한으로 쓰지 않는다. 게이트: `ci-chart-scenarios-fixture`, `ci-data-pipeline-contract-check`.

## R712. 게이트 지표는 서식 변경으로 만족되지 않고, 예외 통로도 래칫한다 (v57.84, P1858)
크기·핀 게이트는 줄바꿈·병합 같은 서식 변경으로 바뀌지 않는 지표를 함께 잰다. 예외 표시(text-pin-ok 등)와 기준선 재기록(--write)은 그 자체로 증가할 수 없다 — 증가는 --allow-growth와 커밋 사유로만 기록한다. 게이트: `ci-decomp-hotspot-check`, `ci-text-pin-ratchet-check`.

## R710. 일반 사용자 부팅 경로에서는 배포·공유·전수 Evidence 감사를 실행하지 않는다 (v52.74; v57.84 중복 R301에서 재번호)
부팅 및 페이지 이동 이벤트가 호출하는 함수는 활성 페이지와 이미 수집된 런타임 상태만 읽어야 한다.

## R673. QA and self-audit machinery stays out of the user runtime (v56.82, P1329)
Self-audit, QA registries and operator diagnostics live in js/aio-qa-audits.js (or tests/scripts), load only through `AIO.loadQaAudits()` (automation, ?qa=1, detailed… 게이트: `ci-decomp-hotspot-check`.

## R656. CI meta-gate downgrades require a complete weekly backstop (v56.72)
Keep the six CI meta gates (`doc-currency`, `ledger-integrity`, `assertion-trace`, `six-doc-coverage`, `workspace-contract`, `knowledge-lint`) in blocking CI until a… 게이트: `ci-qa-pipeline-contract-check`.

## R636. 실패한 QA 출력은 비밀을 마스킹한 run별 전체 증거로 보존한다 (v56.57, P1286)
CI에서 실패한 검증은 원인 줄이 tail/console 한도에 잘려도 조사 가능해야 한다. QA runner는 stdout/stderr 전체를 run별 sidecar로 보존하고, 설정된 secret 값은 sidecar·report·console 전에 마스킹한다. 성공 실행의 출력 spool은 제거한다. 게이트: `ci-qa-runner-behavior-check`, `ci-qa-pipeline-contract-check`.

## R625. 픽스처가 검출기의 언어를 대신 맞춰주면 그 검사는 아무것도 검사하지 않는다 (v55.20, P1139)
탐지기(정규식·어휘 목록)를 검사하는 픽스처는 제품이 실제로 쓰는 입력을 그대로 넣어야 한다. 게이트: `ci-data-pipeline-contract-check`.

## R601. 사용자 출력 계약은 렌더된 결과로 단언한다 (v54.98, P1077)
"그 화면/브리지가 X를 보여준다"는 계약은 렌더된 노드·상태를 단언해야 하며, 소스 파일에 특정 문자열이 존재하는지를 출력 증거로 쓰지 않는다. 그 문자열이 호출되지 않는 함수 안에 있으면 게이트는 아무것도 증명하지 못한 채 통과한다.

## R600. 감사는 자기 부작용을 검증하지 않는다 (v54.98, P1076)
감사·게이트가 검사하는 레지스트리를 다른 단계가 자동으로 채우는 구조라면, 감사는 채워진 뒤의 상태를 검사해서는 안 된다. 파생/자동 생성 여부는 생성 시점에 기록하고(합성한 주체가 id를 남긴다), 감사는 "작성된 계약"과 "관례로 채워진 계약"을 구분해 보고한다.

## R594. 자동 PASS와 line-by-line semantic coverage는 서로 다른 증거다 (v54.96, P1072)
AST·문자열·fixture·browser gate의 PASS는 실행 계약의 증거일 뿐이며 현재 코드와 역사 전환의 사람 검토를 완료로 승격하지 않는다.

## R589. QA gate의 실제 읽기·쓰기 범위는 manifest 입력·영향 규칙·격리 경로와 일치해야 한다 (v54.95, P1067)
cacheable gate가 읽는 파일은 gate-level `inputs` 또는 정확한 그룹 입력에 포함하고, 그 파일의 변경은 해당 gate가 속한 그룹을 선택해야 한다.

## R583. 브라우저 QA는 canonical route·제품 viewport·settled paint를 검사하고 실행 자원을 분리한다 (v54.76 working tree, P1032)
all-route gate는 `ROUTE_IDS`를 직접 소비하고 공유 viewport matrix(데스크톱 + compact 390/768/1024, R669)를 사용한다. geometry/canvas/overflow는 route lifecycle과 paint settle 뒤에 측정한다. 게이트: `ci-viewport-matrix-check`, `ci-desktop-scope-check`, `ci-qa-pipeline-contract-check`.

## R574. 집합 충족률·개별 유효성·표시·보관 재현을 서로 대신하지 않는다 (v54.74, P1013~P1016)
coverage는 입력 충족률이며 정확도·수익확률이 아니다. stale 참고값은 관측일과 함께 표시할 수 있지만 개별 계산 사용은 별도 판단한다. 집합 기준을 통과해도 부적합 행은 peer 통계를 바꾸지 못한다. native null을 legacy 값으로 덮지 않는다. 게이트: `ci-esm-core-unit-check`, `ci-screener-workbench-contract`, `ci-screener-auto-refresh-browser-check`.

## R573. 계산 계약은 경계값·시점·상태 전이를 실제 실행으로 검증한다 (v54.73, P1011/P1012)
같은 증거의 순위는 입력 순서에 따라 달라지지 않는다. 해시가 있는 정의는 내부 변경으로 의미가 바뀌지 않는다. 결측 설정/기준값/지연은 0이나 관측 증거가 아니다. PIT는 availableAt과 모든 관측 시각을 asOf에 비교하며, 거래일·가격 경로가 없으면 exit 일정·MDD를 합성하지 않는다. 게이트: `ci-screener-workbench-contract`, `ci-research-model-contract-check`, `ci-native-decision-evidence-check`.

## R544. 최초 browser lifecycle과 실패 group 재검사는 서로 다른 실행 단위다 (v54.61, P978)
최초 release headless는 shared boot 비용을 한 번만 지불하는 ordered lifecycle로 실행한다. 실패 수정 뒤에는 stable group ID와 그 dependency만 exact selector로 재검사하고 성공 group 전체를 반복하지 않는다. 게이트: `ci-headless-tests`, `ci-qa-pipeline-contract-check`, `ci-qa-runner-behavior-check` (구 ci-headless-group-lifecycle-check 통합).

## R541. 런타임 상태 요약과 릴리스 전수 감사는 실행 경계와 비용 예산을 공유하지 않는다 (v54.60, P975)
UI/runtime readiness는 bounded sample과 필수 계약만 계산한다. release deep audit는 explicit `mode:full`에서만 실행하고 같은 run의 consumer는 immutable 결과를 주입·공유한다. 게이트: `ci-headless-tests`.

## R534. QA 영향 범위는 task baseline 또는 명시적 파일 목록으로 결정한다 (v54.59, P971)
기존 dirty tree에서 작업할 때 수정 전 `session-start --session <task-id>`를 실행한다. 기준선이 없으면 이번 작업이 소유한 정확한 `--files` 목록을 사용한다. 게이트: `ci-qa-runner-behavior-check`.

## R533. 성능·운영 측정은 revision·commit·환경·명령·artifact에 묶는다 (v54.59, P970)
측정값의 상단 appRevision 문자열을 기계적으로 올려 현재 증거로 만들 수 없다. 게이트: `ci-boot-interaction-check`, `ci-route-soak-check`, `ci-operations-contract-check`.

## R529. 모든 CI script는 실행 경로 또는 명시적 퇴역 원장을 가져야 한다 (v54.59, P966)
`scripts/ci-*.mjs`는 `architecture/qa-pipeline.json` group/profile/workflow contract에서 도달 가능하거나 replacement·reason을 가진 `retiredGateScripts`에 있어야 한다. 게이트: `ci-qa-pipeline-contract-check`.

## R525. QA는 영향 기반 manifest와 단계별 전수 실패 수집을 사용한다 (v54.58, P965)
`architecture/qa-pipeline.json`이 로컬·CI gate, input scope, phase, timeout, cache policy의 단일 원본이다. 게이트: `ci-qa-runner-behavior-check`, `ci-qa-pipeline-contract-check`.

## R519. Browser network assertions must correlate to the initiating user action (v54.55, P963)
In a page with asynchronous background work, a browser gate must not assert against a mutable “last request” slot. 게이트: `ci-ai-chat-public-route-browser-check`, `ci-boot-interaction-check`.

## R513. Currentness, cancellation, source semantics and stale disclosure share one negative-control gate (v54.47, P957)
visible data must remain `REFERENCE`/unavailable until its source and observation basis are known; initial labels may not claim `LIVE` or `SOURCE 확인` before a successful… 게이트: `ci-architecture-contract-check`, `ci-static-data-contract-check`, `ci-runtime-contract-check`.

## R491. Browser goldens and renderers are certified from the same committed tree (v54.22)
A browser golden must describe the implementation and generated inputs present in the release commit, not a newer unstaged overlay. 게이트: `ci-atlas-browser-check`.

## R490. Asynchronous artifact tests wait on runtime-owned settled state (v54.22)
A browser test that asserts data loaded through an asynchronous boot pipeline must wait for that pipeline's explicit runtime state to leave `pending` before running… 게이트: `ci-headless-tests`.

## R484. Factor fixtures carry the same field-family observation epochs as production rows (v54.22)
A synthetic quant fixture that claims current market-cap or fundamental coverage must include the corresponding row-level `_mcapObservedAt` or `_fundamentalObservedAt`. 게이트: `ci-domain-parity-check`, `ci-esm-core-unit-check`, `ci-screener-workbench-contract`.

## R483. Versioned domain-contract changes update every independent golden gate atomically (v54.22)
When a domain model version or response shape changes, all independent unit, pipeline, browser, and consumer golden assertions that intentionally pin that contract must… 게이트: `ci-esm-core-unit-check`, `ci-data-pipeline-contract-check`.

## R472. Browser lifecycle gates must stabilize known boot-delayed timers before leak comparison (v54.12)
A route resource-leak gate must wait for every known boot-delayed named timer that can register during its measurement window before taking the first lap snapshot. 게이트: `ci-architecture-browser-check`.

## R454. Service-worker takeover fixture는 1회 reload 전후 상태를 보존해 검증한다 (v54.0, P899)
`controllerchange` fixture는 현재 runtime이 요구하는 guarded reload를 navigation failure로 취급하거나 navigation마다 가짜 controller를 구버전으로 초기화해서는 안 된다. 게이트: `ci-sa-03-sw-controller-fixture`.

## R443. 예상 외 브라우저 runtime 오류와 차단된 외부 네트워크는 서로 다른 상태로 분류한다 (v53.96, P895)
broad `net::ERR_FAILED` ignore는 금지한다. 외부 차단 요청은 request URL과 함께 expected-blocked-network로만 기록하고, pageerror·local requestfailed·예상 밖 console.error는 release-blocking… 게이트: `ci-headless-tests`.

## R442. 브라우저 테스트 그룹은 registry·예외·planned/completed invariant를 하나의 release gate로 기록한다 (v53.96, P895)
모든 그룹은 고유 ID registry를 통해 실행하며, 예외는 synthetic assertion failure로 승격하고 registry count invariant가 깨지면 CI를 중단한다. 게이트: `ci-headless-tests`.

## R386. Route/resource stability must be proven by a repeated blocking soak (v53.51, P843)
A route can be considered operationally stable only after repeated traversal proves one visible route surface, bounded chart/canvas resources, zero unexpected browser… 게이트: `ci-route-soak-check`.

## R337. Runtime fixture override와 reference fallback drift의 의미를 테스트 계약에 고정한다 (v52.94, P709)
명시적인 `_aioScreenerLoadState.status` fixture/operator 상태는 실제 artifact metadata보다 우선하여 producer 장애를 재현해야 한다.

## R300. When turning on new error/warning signal collection inside a test harness that deliberately blocks network access, expect the app's own legitimate failure-detection code to surface through that same channel — trace it to source before allowlisting or failing on it (v52.52)
Adding `page.on('pageerror')`/`page.on('console')` collection to `scripts/ci-viewport-matrix-check.mjs` (which had never collected either before — a route could throw on… 게이트: `ci-viewport-matrix-check`, `ci-headless-tests`.

## R284. Proxy responses, visible value slots, and browser QA matrices must be typed and executable (v52.28, P643 root)

## R281. Live/browser QA must cover rendered route surfaces, not only prior static findings (v52.23, P633 root)

## R279. A regression test must assert the structural property a value is supposed to satisfy, not the specific value/date/count observed when the test was written — that literal will itself go stale (v52.7, broadened v52.20)
Originally (v52.7): a frequency string embedding a required weekday (e.g.

## R273. A value that's supposed to mirror or track another value must be verified equal by evaluating both, not by eyeballing the diff — and duplicate/mirror fields must be named to be found (v51.96)

## R269. A CI job that whitelists known-failing tests must classify each entry by cause, and adding to the whitelist is only valid right after a fresh, real measurement (v51.91)

## R239. External-share readiness must be visible on the default home path (v51.76, P551)
**Superseded by R301 (v57.79)**: share readiness audits run only in CI or developer mode.

## R227. Recommendation verification must exercise the no-ticker screener path (v51.30, P526 root)

## R219. Audit/gate is not semantic review (v50.89, P513 root)
A task is not complete just because an audit function exists, an object has the expected shape, a coverage percentage is high, or a sidebar row/DOM marker is present. 게이트: `ci-semantic-review-check`, `ci-runtime-contract-check`.

## R199. Critical-10 content checks must use a full evidence matrix, not representative samples (v49.112 added, P475 root)
**IA 갱신 (v59.48)**: 제목의 종합 5·Critical-10 페이지 묶음은 8화면 이전 이름이다 — 대상은 지금 8화면(`architecture/route-owners.json`) 전체다.

## R194. Critical-10 refresh success must be followed by DOM binding verification (v49.107 added, P470 root)
**IA 갱신 (v59.48)**: 제목의 종합 5·Critical-10 페이지 묶음은 8화면 이전 이름이다 — 대상은 지금 8화면(`architecture/route-owners.json`) 전체다.

## R185. 재발방지 audit은 pull이 아닌 push — 지속 운영 중 자동 surfacing 의무 (v49.96 added, P461 root)

## R181. 데이터 검증은 카테고리 + cell-level(개별 sink→source) 둘 다 (v49.90 added, P451 root)

## R178. audit failure status sticky top + pulse 의무 (v49.83)
Audit rows, including failure ordering, render only in developer/QA mode; user surfaces show none. 이력: ✗ failure rows는 자동 top sort + 빨간 border + 2s pulse animation.

## R177. 사이드바 audit 일반/개발자 mode 토글 의무 (v49.83)
Audit rows render only in developer/QA mode (`body.aio-dev-mode`, `?aioAudit=1` or detailed mode); user surfaces show none and have no web_search toggle.

## R135. 4/5차는 감사 함수만으로 완료 금지
A 4th/5th-pass (data and purpose-fit) audit is not complete because its audit function passes; it also needs a rendered-screen and source comparison (same principle as…

## R125. Second/third-pass text, function, and data meaning audit required (v49.67 added, P359 root prevention)

## R124. DOM-first full surface audit required (v49.67 added, P358 root prevention)

## R123. 사이드바 Audit row 의미 분리 표시 의무 (v49.67 추가, P357 근본)
Audit rows render only in developer/QA mode (`body.aio-dev-mode`, `?aioAudit=1` or detailed mode); user surfaces show none and have no web_search toggle.

## R120. 초보자 초기 상태 문구는 보이는 DOM 기준으로만 감사 (v49.65 추가, P347 근본)

## R119. 3대 본질 정렬 감사 의무 (v49.65 추가, P346 근본)

## R118. REGISTRY coveragePct와 실등록 카운트 분리 감사 의무 (v49.65 추가, P339 근본)

## R114. 외부 워크트리 통합 시 함수 존재 vs 페이지 실행 검증 분리 의무 (v49.63 추가, P331 근본)

## R108. Audit 함수 추가 시 사이드바 위젯에도 노출 의무 (v49.58 추가, P322 근본)
Audit rows render only in developer/QA mode (`body.aio-dev-mode`, `?aioAudit=1` or detailed mode); user surfaces show none and have no web_search toggle.

## R102. 페이지 cell-level audit 의무 (v49.48 추가, P318 근본)

## R93. 페이지 sequential audit 의무 (v49.37 추가, P282 메타 근본)

## R42. Agent 결과 실측 교차검증 의무 (v48.59 추가, Agent 오판 5회 누적)

## R28. 실제 클릭 테스트 필수 (v46.5 추가, P82 교훈)

## R20. 에이전트 산출물 검증 상태 관리 (v40.4 추가)

## 원칙 C4 — 한 의미에는 한 구현

**불변식**: 같은 의미의 함수·전역·집합은 한 곳에서만 구현하고 나머지는 그것을 읽는다. 로드 순서는 계약이고, 레거시를 옮길 때는 실행 owner를 넘기며 레거시 결합은 래칫으로 줄기만 한다. 한 표면에 넣은 방어는 같은 종류의 표면 전체에 넣는다.

**게이트**: `scripts/ci-structural-check.mjs` · `scripts/ci-architecture-contract-check.mjs` · `scripts/ci-architecture-browser-check.mjs` · `scripts/ci-decomp-hotspot-check.mjs` · `scripts/ci-text-pin-ratchet-check.mjs`

**정본**: R619 · 핵심: R619, R620, R624, R352 · 규칙 41건 (비활성 0건)

## R731. src가 설치하는 window 전역을 js/가 부팅 경로에서 부를 때는 존재를 먼저 확인한다 (v59.42, P2120)
js/의 classic 스크립트는 src/ 모듈이 window에 설치하는 함수(compatibility-globals.js 등)를 로드 즉시 실행되는 코드나 그 콜백(서비스 워커 메시지, 타이머, 초기 fetch)에서 부를 때 typeof 확인을 거친다. 게이트: `ci-runtime-contract-check`.

## R694. The domain layer sits below the AI layer, and one calendar answers every session count (v57.30, P1533)
src/domain never imports from src/ai. Shared pure facts (the exchange calendar) live in the domain layer and the AI layer re-exports them. 게이트: `ci-market-session-contract-check`.

## R624. 전역은 하나의 구현만 가진다 — 그리고 로드 순서는 계약이다 (v55.19, P1138)
클래식 스크립트에서 최상위 `function X`와 `window.X =`는 같은 전역을 두 번 정의한다. 게이트: `ci-structural-check`.

## R623. 같은 집합을 여러 곳에 손으로 적지 않는다 — 순서까지 파생시킨다 (v55.18, P1137)
같은 식별자 집합이 여러 표면에 등장하면 한 곳만 손으로 적고 나머지는 파생시킨다. 게이트: `ci-architecture-contract-check`, `ci-structural-check`, `ci-esm-core-unit-check`.

## R622. 인라인 코드의 추출은 실행 "위치"를 보존한다 (v55.16, P1135)
`index.html`의 인라인 `<script>`는 파싱 시점에 실행되므로 `defer` 스크립트(core·data·ui·chat·glossary)보다 항상 먼저 돈다. 게이트: `ci-architecture-browser-check`, `ci-headless-tests`, `ci-structural-check`.

## R620. 분해 압력은 벽이 아니라 래칫이다 (v55.08, P1127)
크기 상한은 여유가 있을 때만 작동한다. 파일이 상한에 닿는 순간 그 장치는 성장을 막는 가드가 아니라 변경을 금지하는 벽이 되고, 통과 방법은 두 가지뿐이다 — 주석을 압축해 지표를 게임하거나, 상수를 수정해 조용히 재기준하는 것. 둘 다 실제 분해를 하지 않으면서 위반만 숨긴다. 게이트: `ci-decomp-hotspot-check`.

## R619. 같은 의미의 구현은 하나만 둔다 (v55.07, P1126)
같은 일을 하는 순수 함수가 두 벌 있으면 반드시 한쪽이 썩는다. 둘 다 "동작하는" 동안에는 차이가 드러나지 않으므로, 갈라진 사실은 실제 사용자 피해(값이 틀리거나 이스케이프가 빠짐)로 나타난 뒤에야 발견된다. 게이트: `ci-headless-tests`, `ci-runtime-contract-check`, `ci-decomp-hotspot-check`.

## R599. 가드의 스위치는 guard 대상 콘텐츠에서 파생한다 (v54.98, P1075)
답변의 수치·현재성·권리 가드를 켜고 끄는 조건은 그 가드가 실제로 검사하는 콘텐츠(응답에 근거가 결속되지 않은 수치가 있는가)에서 파생해야 하며, 질문 문면의 대리 변수(라틴 티커 존재, 특정 인용 패턴)에만 의존하지 않는다.

## R596. 바이트 계약·정본 어휘·단위 환산은 손 목록과 체크아웃 설정에 의존하지 않는다 (v54.98, P1074)
내용 주소로 이름 붙는 아티팩트처럼 바이트 자체가 계약인 파일은 `.gitattributes`로 개행·인코딩 변환을 금지하고, 그 digest는 프로듀서가 실제로 기록한 바이트로 계산한다.

## R588. 레거시 이벤트와 파생 route는 native 경계에서 한 번만 정규화한다 (v54.95, P1066)
window/document로 분열된 동일 논리 이벤트는 공통 호환 adapter가 양쪽을 수신하고 반대 타깃의 mirror만 bounded dedupe한다. 소비자마다 별도 이중 listener를 만들지 않는다.

## R585. 저장소 불변성과 구독 알림은 바깥 객체 상태나 한 구독자 실패에 의존하지 않는다 (v54.95, P1062)
개발 모드의 deep-freeze는 바깥 객체가 이미 frozen이어도 모든 own data-property 자식을 순환해 동결한다. dispatch는 reducer 결과를 먼저 커밋하고 dispatch 시작 시점의 구독자 스냅샷 전체를 통지한다.

## R578. private index 전환은 모든 consumer를 resolver 또는 read-only adapter로 함께 이관한다 (v54.76, P1027)
mutable `Map`/`Set`을 public contract에서 제거할 때 producer만 바꾸지 않는다. 모든 runtime consumer가 canonical `resolve()`나 mutation API가 없는 read-only `get` adapter를 사용하도록 같은 변경에서 이관한다. 게이트: `ci-knowledge-corpus-check`, `ci-atlas-contract-check`, `ci-atlas-browser-check` (구 ci-knowledge-core-semantic-check 통합).

## R559. 새 화면 지표는 sink·source alias·발표 일정까지 같은 변경으로 닫는다 (v54.63, P993)
data-snap 지표를 추가할 때 producer/runtime 값만 연결하고 끝내지 않는다. 정적 seed/alias audit와 보이는 정의를 함께 등록한다. 공식 발표가 수신되면 해당 날짜를 lastRelease로 승격하고 다음 공식 일정이 미래인지 검증한다.

## R539. Compatibility facade의 현재 표면과 목표 표면을 구분하고 확장을 ratchet한다 (v54.59, P972)
`architecture/retirement-manifest.json.currentFacadeApi`는 `AIO_ARCH`의 실제 노출 전체와 정확히 일치해야 하며 `approvedFacadeApi`는 migration 이후 목표로만 해석한다. 게이트: `ci-retirement-contract`.

## R413. Native chart ownership requires a registry, marker, and legacy fence (v53.63, P834-P835)
A route chart can be promoted only when the native module owns its Chart.js instance through a disposable registry, renders an explicit unavailable state when…

## R393. Compatibility exports must preserve global call contracts (v53.54, P846)
A classic/deferred script must not shadow an existing global entrypoint with a different arity or return contract. 게이트: `ci-ai-chat-reliability-contract-check`.

## R392. Compatibility entrypoints must be safe during initialization races (v53.53, P845)
Legacy route entrypoints callable by the native compatibility facade must not directly read or write top-level lexical state that may still be in its temporal dead zone…

## R374. Portfolio summary cutovers must transfer the pure model and fence every legacy writer (v53.40, P831)
A portfolio summary/allocation/exposure surface may move to native ownership only when one finite-safe domain model derives its values from normalized Vault state plus… 게이트: `ci-architecture-contract-check`, `ci-architecture-browser-check`.

## R369. Technical candle text and legacy canvas lifecycle must remain separate (v53.34, P822)
Technical candle title/meta text comes only from normalized analysis input and stays waiting when OHLCV is absent.

## R367. Theme-detail benchmark narrative must use normalized theme/benchmark evidence and fence the legacy section (v53.30, P795)
The theme-detail benchmark narrative must be rendered by the native child `#theme-detail-native-benchmark` from normalized theme performance and the selected… 게이트: `ci-architecture-contract-check`, `ci-architecture-browser-check`.

## R366. Theme-detail subtheme-gap narrative must use normalized subtheme quote evidence and fence the legacy section (v53.29, P794)
The theme-detail subtheme-gap narrative must be rendered by the native child `#theme-detail-native-subtheme-gap` from normalized `detail.subThemes` and quote evidence. 게이트: `ci-architecture-contract-check`, `ci-architecture-browser-check`.

## R365. Theme-detail breadth-health narrative must use normalized breadth and fence the legacy section (v53.28, P793)
The theme-detail breadth-health narrative must be rendered by the native child `#theme-detail-native-breadth-health` from normalized `detail.breadth`. 게이트: `ci-architecture-contract-check`, `ci-architecture-browser-check`.

## R363. Theme-detail temperature narrative must derive from canonical performance and fence the legacy section (v53.26, P791)
The theme-temperature diagnosis may move to native only when it derives directly from the normalized selected-theme performance, uses an explicit child, and displays… 게이트: `ci-architecture-contract-check`, `ci-architecture-browser-check`.

## R362. Theme-detail leader cards must have one native writer and fail-closed quote display (v53.25, P790)
Detailed theme leaders may move to native ownership only through a dedicated child fed by the normalized selection quote payload. 게이트: `ci-architecture-contract-check`, `ci-architecture-browser-check`.

## R361. Theme-detail composition/breadth must use normalized quote evidence and a fenced legacy writer (v53.24, P789)
A derived theme-detail composition packet may move subtheme composition, constituent chips, and breadth only into a dedicated native child fed by the explicit selection… 게이트: `ci-architecture-contract-check`, `ci-architecture-browser-check`.

## R352. Architecture migration must transfer an executable owner and monotonically retire legacy coupling (v53.15, P736)
새 `src/` 모듈·CI 스크립트·manifest를 추가한 것만으로 route 재구축을 완료 처리하지 않는다. 게이트: `ci-architecture-contract-check`, `ci-architecture-browser-check`.

## R346. Legacy event adapters must normalize the actual EventTarget and payload shape at the boundary (v53.9, P729)
A compatibility observer must subscribe to the same `EventTarget` that emits the legacy event and normalize its real `CustomEvent.detail` shape before routing or state… 게이트: `ci-architecture-browser-check`.

## R280. A global function declared in more than one non-module `<script>` (inline or external) silently loses all but the last-loaded definition — with no error, no warning (v52.8, mechanically gated v52.19)
Classic (non-module) `<script>` tags share one global scope. 게이트: `ci-structural-check`.

## R275. A shared global object populated by multiple files must always be merged, never plainly overwritten — even if today's load order happens to make it safe (v51.99)

## R260. A function must never be redefined more than once at the same scope in the same file (v51.83)

## R258. A hardening measure added to one surface must be checked against equivalent surfaces (v51.83)

## R247. CDN/script load-failure detection must not race against `defer` (v51.82)

## R210. 런타임 scope·sink 소유권·증거 게이트 의미를 함께 검증 (v50.56 added, P502 root)

## R169. 동일 함수 내 var/const/let 이름 충돌 금지 + 신규 코드 let/const 우선 (v49.81 added, P438 root prevention, P311 패턴 재발 방지)

## R116. 새 분석 관점 추가 시 4축 동시 갱신 의무 (v49.65 추가, P340 근본)

## R98. JS 함수 내 var X + const/let X 충돌 자동 탐지 (v49.44 추가, P311 근본)

## R96. data-action 핸들러 등록 검증 (v49.39 추가, P291 근본)

## R73. 인프라 추가 시 페이지 적용 동반 의무 (v49.28 추가, P239 메타 근본)
신규 `*_REGISTRY` 객체나 `AIO.get*Audit()`/`AIO.applyXxxToElement()` 함수를 추가할 때 반드시 같은 버전에서 해당 인프라를 실제 페이지에 적용해야 한다.

## R44. setTimeout 무한 재귀 종료 카운터 필수 (v48.59 추가, renderAllEtfGrid 교훈)

## R38. `on*` 인라인 이벤트 핸들러 금지 — 전체 확장 (R32 확장, v48.54 추가)

## R32. Event Delegation 의무화 — onclick 인라인 핸들러 금지 (v48.35 추가, P132 교훈)

## 원칙 C5 — 화면은 라우트가 소유한다

**불변식**: 사용자 화면은 8화면 정보구조(`architecture/route-owners.json`)이고, 각 화면의 마운트·데이터 적재·타이머·리스너·입력 처리는 그 라우트의 owner 하나가 가진다. 선언된 표면은 실제로 있어야 하고, 기본 경로에는 접힌 잡음·숨은 호출·검증 안 된 블록이 없다.

**게이트**: `scripts/ci-architecture-contract-check.mjs` · `scripts/ci-architecture-browser-check.mjs` · `scripts/ci-ux-default-path-check.mjs` · `scripts/ci-boot-interaction-check.mjs` · `scripts/ci-vertical-slice-browser-check.mjs`

**정본**: R704 · 핵심: R704, R703 · 규칙 50건 (비활성 1건)

## R728. 늦게 오는 데이터의 다시 그리기는 최신 상태로 그린다 (v58.80, P2088)
나중에 도착하는 산출물·요청을 기다려 화면을 다시 그리는 콜백은 첫 렌더의 인자를 클로저로 붙잡지 않고, 렌더러가 매 호출 갱신하는 최신 인자(호스트 노드나 상태 저장소)로 다시 그린다.
**경로 갱신 (v59.48)**: 검증은 `node .claude/skills/verify-aio/scripts/verify-aio.mjs drive stock`다 (`scripts/verify-aio.mjs`는 없다).

## R704. Declared native surfaces must exist (v57.47, P1667)
Every #id in architecture/route-owners.json nativePrimarySurface/nativeSecondarySurface must exist in index.html or be created by src/ (id assignment). 게이트: `ci-architecture-contract-check`.
**경로 갱신 (v59.48)**: 라이브 검사는 `node .claude/skills/verify-aio/scripts/verify-aio.mjs registry`다 (`scripts/verify-aio.mjs`는 없다).

## R703. 작은 UI 조작과 색 테마의 실행 계약 (v57.34, P1604)
동일 사용자 입력은 하나의 owner가 활성화한다. 설명 버튼은 element/event 인자와 aria-expanded를 함께 연결한다. 색 테마는 storage 실패에 독립적이며 현재 차트 색을 갱신하되 데이터·viewport를 바꾸지 않는다. 게이트: `ci-theme-research-browser-check`.

## R675. Initializers are reachable from a route or event, not only from tests (v56.84, P1339)
Every runtime initializer or renderer has a production caller (route event, page bus, bootstrap).

## R668. First screen shows values before summaries; blocked summaries collapse and name the cause (v56.80, P1322)
On every viewport's first screen, observed values (indices, key indicators) come before any derived summary. 게이트: `ci-runtime-contract-check`, `ci-esm-core-unit-check`.

## R582. 비동기 fallback·delegated action·route scheduler는 하나의 epoch와 owner를 사용한다 (v54.76 working tree, P1031)
primary/secondary CDN은 한 coordinator가 error/timeout 전환을 결정하고 늦은 응답이 확정된 runtime을 덮지 못하게 한다. 중첩 `data-action`은 ancestor open-url보다 우선한다.

## R569. 독립 hydration 경로는 각자의 완성 조건을 기다린다 (v54.65, P1003)
reconciliation, screener, history, knowledge처럼 독립적으로 hydrate되는 producer를 통합 브라우저 검사할 때 한 producer의 ready 신호를 전체 준비 완료로 간주하지 않는다. 게이트: `ci-page-market-epoch-browser-check`.

## R553. 기본 route와 정적 카드는 숨은 provider 호출·시점 없는 투자 숫자를 만들지 않는다 (v54.63, P987)
페이지 진입이나 reference card 선택만으로 유료/외부 provider 검색을 실행하지 않는다. 재무 숫자는 공식 bounded artifact의 source/observed/filed/fetched 시각과 허용 용도를 함께 전달하고, 공시·현재 시세·추정치를 동일 시계로 섞지 않는다.

## R552. lazy mount 전 headless 상태 보존과 mount 후 브라우저 가시성을 분리한다 (v54.62, P986)
lazy native renderer가 아직 mount되지 않은 동기 headless 구간은 선택·pending state 보존을 검증하고, renderer marker 이후에는 실제 native panel 가시성을 검증한다.

## R550. derived route의 선택 state는 owning lazy renderer가 소비할 때까지 보존한다 (v54.62, P984)
다른 route에서 inline/derived surface를 열 때 숨은 DOM 존재를 mount 증거로 사용하지 않는다. owning page active 상태와 native renderer marker를 확인하고, 선택 ID는 listener/mount 완료 뒤 정확히 한 번 소비·삭제한다.

## R543. native ownership, lazy delivery, bulk retention은 독립적으로 증명한다 (v54.61, P977)
route가 lifecycle/renderer native라는 사실만으로 lazy chunk나 legacy 완전 퇴역을 선언하지 않는다.

## R516. Direct entity routes must start from neutral, accessible empty state (v54.50, P960)
a direct ticker/entity route may not seed a concrete symbol, portfolio relationship or stale breadcrumb before the user selects an entity or a provider returns one.

## R515. Page hydration must follow route ownership (v54.49, P959)
a `pageShown` listener that can read a provider, normalize a large artifact or start network-backed hydration must declare its owning route set.

## R514. Cancellation, focus return and coverage denominators are one boundary (v54.48, P958)
a caller-provided `AbortSignal` must be composed with every internal timeout controller and must be distinguishable from a timeout. 게이트: `ci-esm-core-unit-check`.

## R506. Detail artifacts belong to the narrowest interaction and retain honest failure state (v54.40, P950)
route entry and profile selection may consume summaries but must not fetch full manager rows or long-form detail artifacts. 게이트: `ci-artifact-cache-check`, `ci-masters-browser-check`, `ci-principles-browser-check`.

## R504. Browser runtime data uses bounded shards and shared request coalescing (v54.39, P949)
canonical full-resolution holdings, history, aggregates and long-form corpora remain rebuild/research artifacts; browser routes consume a compact index and fetch only… 게이트: `ci-artifact-cache-check`, `ci-masters-contract-check`, `ci-three-page-artifact-budget-check`.

## R486. Initial paint and synthetic route latency require a browser presentation boundary (v54.22)
A boot performance gate that reports both first contentful paint and a synthetic page transition must allow the parsed application shell to reach an actual presentation… 게이트: `ci-boot-interaction-check`.

## R471. Screener Workbench contracts must be the single lifecycle boundary (v54.12)
Screener identity, observations, field readiness, AST definitions, ScreenRun explanations must cross one versioned contract boundary (refresh-demand… 게이트: `ci-screener-workbench-contract`, `ci-data-pipeline-contract-check`, `ci-runtime-contract-check`.

## R446. route ownership은 native/legacy/not-applicable를 구분하고 revision lanes를 혼합하지 않는다 (v53.96, P895)
static reference route의 chart/narrative 부재를 legacy owner로 표시하지 않는다. 게이트: `ci-architecture-contract-check` (구 ci-baseline-contract-check 통합).

## R426. Decision headers must be explicit mounted route elements (v53.67, P871)
`_aioRenderPageDecisionHeader()` must emit a balanced, discoverable `.aio-decision-header` wrapper for every route, carrying `data-aio-decision-page`…

## R412. Native data readers are the only route-provider boundary (v53.63, P833)
Route providers must read through `src/data/runtime-readers.js` or an explicit native provider, never through `legacy.read*` projections. 게이트: `ci-architecture-contract-check`, `ci-architecture-browser-check`, `ci-operations-status-check` (구 ci-operator-readiness-check 통합).

## R411. Secondary producers must declare a post-boot phase boundary (v53.62, P858)
Translation, news enrichment, compatibility diagrams, market-state narrative synthesis, pixel-level fallbacks, and other non-critical producers must not execute… 게이트: `ci-boot-interaction-check`, `ci-operations-contract-check`.

## R385. Vertical slices must be executable route contracts (v53.50, P841)
Vertical slices declared in `src/app/vertical-slices.js` must cover every route in `src/app/routes.js` exactly once (counts derived, never constants), bind lifecycle… 게이트: `ci-architecture-contract-check`, `ci-vertical-slice-browser-check` (구 ci-vertical-slice-contract-check 통합).

## R382. Route resources and sensitive-key persistence must be scope-owned (v53.48, P839)
A route/entity mount must invalidate its previous async and chart resources on transition, and API keys must not be automatically mirrored in plaintext IndexedDB. 게이트: `ci-runtime-contract-check`.

## R373. Derived routes must replay through their canonical mount in compatibility navigation (v53.38, P826)
When a legacy navigation call canonicalizes a derived view such as `theme-detail` to an inline owner page such as `themes`, the architecture compatibility facade must… 게이트: `ci-viewport-matrix-check`.

## R360. Derived theme-detail summary must use an explicit event/child boundary (v53.23, P788)
A derived inline panel may add a native summary only when the selection enters through an explicit `aio:themeDetailShown` boundary, the native module owns a dedicated… 게이트: `ci-architecture-contract-check`, `ci-architecture-browser-check`.

## R353. route ownership 요약은 route별 선언에서 재계산한다 (v53.18, P781)
`architecture/route-owners.json`의 counts/native/legacy/full-native 요약을 독립 사실로 수동 관리하지 않는다. 게이트: `ci-architecture-contract-check`.

## R345. 고빈도 데이터 batch는 Store 기록과 DOM 반영을 분리하고 전역 scan·rewrite를 batch당 한 번만 수행한다 (v53.9, P728)
quote처럼 여러 레코드를 한 묶음으로 적용하는 경로에서 각 `Store.set()`이 전체 문서를 스캔하지 않는다. 게이트: `ci-runtime-contract-check`.

## R331. 시안의 최종 렌더 계약은 loaded/empty/degraded/closed 상태 전환과 종료 시간까지 포함한다 (v52.90, P705 root)
섹션의 존재·순서·기본 노출만 맞아도 사용자 여정이 완료된 것으로 보지 않는다. 비동기 공급자 무응답, 캐시 폴백, 결과 0건, 접힌 상세, 닫힌 오프스크린 패널에서도 화면은 유한 시간 안에 읽을 수 있는 한 상태로 수렴해야 하며 같은 정보의 본문·요약·상태 소유자가 분리돼서는 안 된다.

## R330. 사용자 표면 수와 내부 QA 라우트 수를 분리하고, 시안 정보 위계를 모든 사용자 표면에 적용한다 (v52.89, P704 root)
**Superseded by R676 (v57.79)**: AGENTS.md Information architecture defines 8 user screens; legacy ids are aliases or QA routes.

## R329. 시안 기본 경로 계약은 초기 HTML이 아니라 런타임 주입이 끝난 최종 화면에 적용한다 (v52.88, P703 root)
승인 시안의 순서·밀도·중복 제거 계약은 페이지 진입 이벤트, 비동기 데이터 렌더, 공통 헤더/뉴스 삽입, 기존 재배치 함수가 모두 실행된 뒤에도 유지되어야 한다. 자동 생성된 패널이라는 이유로 시안 밖 콘텐츠를 일반 사용자 화면에 되살리지 않는다.

## R328. 승인된 화면 시안은 장식층이 아니라 기본 정보구조이며, 접힌 레거시는 통합으로 간주하지 않는다 (v52.87, P702 root)
시안에 없는 기존 섹션을 `<details>`로 접거나 시안 앞뒤에 그대로 붙이는 방식은 이식 완료가 아니다. 기본 사용자 경로는 시안의 순서·밀도·텍스트 계층을 우선하고, 중복 설명·교육·운영 진단은 삭제하거나 전용 도움말/개발자 모드로 이관해야 한다.

## R305. Partial third-party chart stubs must be treated as unavailable before registry access (v52.58, P675 root)
A truthy global library symbol is not proof that the required API surface loaded.

## R304. Third-party libraries are progressive enhancements and must never block the local route boot queue (v52.57, H3-F/P674 root)
A CDN-only library may improve charts, sanitization, or visualization, but it must not sit ahead of local application modules in a blocking ordered load queue.

## R259. Re-registerable event listeners must guard against duplicate registration consistently across sibling elements (v51.83)

## R250. A shared cross-page renderer must resolve each page's own parameters, not one hardcoded default (v51.83)

## R243. Portfolio UX must close input -> AI analysis -> journal reflection -> learning loop (v51.80)

## R234. 신규 UI 블록은 검증 전까지 기본값 hidden (v51.64, P545 예방)

## R228. Default-route UX must remove collapsed noise and avoid empty grid tracks (v51.30, P529)
Collapsed `<details>` is not a sufficient cleanup for explanation-only or advanced-framework content on a default route. 게이트: `ci-ux-default-path-check`.

## R200. v50 페이지 계약/데이터 증거/AI 답변/배포 게이트 4원칙 (v50.0 added, P476 root)

## R186. 첫 접속/새로고침 시 진행률 로더 + 정적 콘텐츠 만료 시 동적 폴스루 의무 (v49.97 added, P462 root)

## R163. 멀티탭 localStorage storage 이벤트 리스너 의무 (v49.79)

## R161. localStorage QuotaExceededError 강화 처리 + 사용자 toast 의무 (v49.79)

## R71. 이론 vs 실행 비율 audit — getPagePurposeRatioAudit (v49.27 추가, E5 근본)

## R70. 페이지 목적 단일 정의 — PAGE_PURPOSE_REGISTRY (v49.27 추가, E3/E4 근본)

## R54. `data-aio-archive` 마킹 원칙 (v49.21 추가)

## R49. 새 페이지 추가 시 결론 바 의무 (v48.62 추가)

## R45. 페이지 전환 active 설정은 `dataset.arg` 기반 (v48.59 추가, v48.32 onclick 0건 후 잔존 버그)

## R9. Dead Page 방지 — 페이지 3종 세트 + init 가드 리셋 필수 (v31.10 추가, v42.1 강화)
새 페이지(`page-xxx`) 추가 시 반드시 3종 세트 구현: 1. init 함수 (`initXxxPage()`) — 데이터 로드 + DOM 업데이트 2. `aio:pageShown` 리스너 — 페이지 진입 시 init 호출 3.

## R4. 동적 DOM 삽입 주의

## 원칙 C6 — 표시는 기기에 적응하고 접근성을 지킨다

**불변식**: 데스크톱·휴대폰·아이패드는 같은 라우트·데이터를 쓰고 레이아웃만 적응한다. 색은 토큰에서 오고, 글자 크기·대비·터치 영역·접근 이름은 WCAG AA를 지킨다. 가격 방향(오르면 빨강·내리면 파랑)과 판정(초록·앰버·빨강)은 다른 색 체계다.

**게이트**: `scripts/ci-accessibility-matrix-check.mjs` · `scripts/ci-viewport-matrix-check.mjs` · `scripts/ci-responsive-browser-check.mjs` · `scripts/ci-desktop-scope-check.mjs`

**정본**: R669 · 핵심: R669 · 규칙 23건 (비활성 4건)

## R727. 가격 방향과 판정은 다른 색이다: 방향은 오르면 빨강·내리면 파랑, 판정은 초록·앰버·빨강 (v58.80, P2082)
가격·수익률·손익의 방향은 --dir-up/--dir-down 토큰(한국 증권사 관례, 캔들과 같음)으로만 칠하고, 양호/부담·통과/실패·좋아짐/나빠짐 같은 판정은 --data-green/--data-amber/--data-red로 칠한다. 판정 표시가 방향 클래스를 빌려 쓰지 않는다. 게이트: `ci-esm-core-unit-check`, `ci-runtime-contract-check`.

## R669. Responsive scope follows the current owner decision (v57.38, P1618)
The owner reopened mobile and iPad support on 2026-10-11. Keep the existing desktop matrix and add compact 390×844, 768×1024 and 1024×768 coverage. 게이트: `ci-desktop-scope-check`, `ci-responsive-browser-check`.

## R665. Explanations are reachable by pointer and keyboard, fully on screen (v56.78, P1320)
Every "?"/term explanation opens by hover, focus, click and Enter/Space, closes by Escape or an outside click, carries an accessible name, and stays fully inside the… 게이트: `ci-esm-core-unit-check`.

## R537. 자동 접근성 PASS는 수동 접근성 인증을 대신하지 않는다 (v54.59, P972)
자동 route matrix는 이름·키보드 구조·canvas·font·target·dialog·skip-link 위반만 인증한다. 24px 미만 target은 WCAG inline-text 예외와 실제 위반을 구분한다. 게이트: `ci-accessibility-matrix-check`.

## R502. Every golden route belongs to shared viewport and accessibility coverage (v54.38, P948)
Every route in `architecture/golden-routes.json` (the 8 screens plus their legacy aliases) is in the shared viewport, accessibility and lifecycle inventories. 게이트: `ci-viewport-matrix-check`.

## R488. Scope gates validate their direct inputs from the committed tree (v54.22)
**Superseded by R669 (v57.79)**: the desktop-only scope this rule protected was reversed by P1618.

## R476. Retired mobile touch-target checks do not block desktop-only releases (v54.17)
**Superseded by R669 (v57.79)**: responsive scope was reopened (P1618) and small-target violations block again in ci-accessibility-matrix-check.

## R474. Owner-approved desktop, mobile and tablet scope (v57.38, P1618)
**Superseded by R669 (v57.79)**: R669 records the same owner decision (P1618) and is the canonical responsive-scope rule.

## R406. Accessibility target warnings are blocking (v53.58, P852)
Any audited mobile interactive target below 24px is a release failure unless it is removed or given a measured hit-area exception recorded in the audit. 게이트: `ci-accessibility-matrix-check`.

## R372. Dynamic detail panels must keep aria-live announcements intentionally scarce (v53.37, P825)
A multi-panel native detail surface must expose at most one coordinated `aria-live` summary unless each additional region represents an independent user action. 게이트: `ci-ux-default-path-check`, `ci-accessibility-matrix-check`.

## R307. Full-route accessibility is a blocking local gate; assistive technology remains separate (v52.59, P676 root)
Every registered route must be checked at the mobile viewport for computed font sizes, control naming, select/canvas naming, positive tabindex, skip-link behavior, and… 게이트: `ci-accessibility-matrix-check`, `ci-runtime-contract-check`, `ci-critical10-human-surface-check`.

## R288. Route x viewport audits must include topbar clipping and SVG text geometry, not only page overflow (v52.32, P647 root)

## R231. Visual hierarchy must not be locked to the old Bloomberg-terminal premise (v51.43, P534)
A page is not clean just because the runtime works and the default-route noise is hidden.

## R207. 접근성 WCAG AA 유지 — 접근 이름·최소 폰트·tap target (v50.14 added)

## R168. vendor-prefix CSS 속성은 표준 속성과 동시 선언 + inline hover: 금지 (v49.81 added, P436~P437 root prevention)

## R152. 모바일 채팅 레이아웃 100vw 비율 의무 (v49.76)

## R51. 콘텐츠 카드 본문 폰트 최소 12px (v48.62 추가)
콘텐츠 카드 본문은 12px 이상을 기준으로 하고, 계산된 글자 크기가 10px 미만인 텍스트는 없어야 한다 — `ci-accessibility-matrix-check.mjs`의 fontUnder10 차단. 게이트: `ci-accessibility-matrix-check`.

## R47. CSS 변수 자기순환 참조 금지 (v48.61 추가, surface-1~5 교훈)

## R43. Canvas context는 CSS var 미해석 (R34 예외, v48.59 추가)
**Superseded by R34 (v57.79)**: R34 states the Canvas exception.

## R34. CSS 색상 토큰 우선 — rgba 하드코딩 금지 (v48.54 추가)
투명 화이트 오버레이 `rgba(255,255,255,0.0X)` 패턴은 CSS 변수(`--surface-1~5`)로만 사용.

## R8. 차트 카드 텍스트 폴백 필수 (v31.9 추가)

## R7. 한국어 텍스트 레이아웃 검증 (v31.9 추가)

## R5. CSS overflow 3중 방어

## 원칙 C7 — 읽는 문장은 관측과 근거만 말한다

**불변식**: 화면 문장은 측정한 조건과 그 근거를 말하고, 등급·검증 안 된 합산·행동 지시·근거 없는 확률·내부 코드·개발자 마커를 쓰지 않는다. 관측과 해석은 문장 안에서 구분하고, 숫자·조사·단위는 공용 헬퍼로 만든다.

**게이트**: `scripts/ci-rendered-copy-lint-check.mjs` · `scripts/ci-control-char-check.mjs` · `scripts/ci-ux-default-path-check.mjs`

**정본**: R697 · 핵심: R697 · 규칙 14건 (비활성 1건)

## R723. 화면 숫자·조사·단위는 공용 헬퍼로 만들고, 렌더된 문구 린트가 지킨다 (v58.74, P2025)
화면에 나가는 부호 있는 숫자는 signedText(반올림 뒤 부호, ASCII 마이너스, 0은 부호 없음), 사람 수는 peopleText, 조사는 korean-particle.js 헬퍼로 만든다. '(으)로'·'이(가)' 같은 자리표시자와 숫자 앞 U+2212를 화면 문장에 남기지 않는다. 게이트: `ci-rendered-copy-lint-check`, `ci-esm-core-unit-check`.

## R700. 템플릿 슬롯 뒤 조사는 받침으로 고른다 (v57.31, P1592)
보간된 명사 뒤의 을/를, 은/는, 으로/로는 src/domain/content/korean-particle.js 헬퍼로 고른다. 템플릿에 고정 조사를 붙이지 않는다. 게이트: `ci-esm-core-unit-check`.

## R697. A reader sees measured conditions, never a grade, an unvalidated sum or an instruction (v57.30, P1538)
Every surface that summarises a technical, fundamental or portfolio state lists the measured conditions and their basis. 게이트: `ci-control-char-check`, `ci-runtime-contract-check`.

## R696. An internal code is not reader text (v57.30, P1535)
Engine enums, flag ids and reference percentages are mapped to a reader label before rendering; a renderer must not pass an engine action to a badge or sentence, and a… 게이트: `ci-control-char-check`.

## R693. Visible text states the observed condition, not an instruction or an unsourced probability (v57.30, P1523)
Copy, chips, labels and help in index.html and js/src describe what is observed and what would change the reading; they carry no buy/sell/size instruction and no… 게이트: `ci-control-char-check`, `ci-runtime-contract-check`.

## R689. 관측 사실과 해석을 문장 안에서 분리 (v57.28, P1516)
화면 문장은 먼저 측정한 대상·범위를 말하고, 해석은 "가능한 설명·확인할 조건"으로 따로 쓴다. 한 지표의 분류를 다른 지표에 옮기지 않고, 자기 자신과의 비교나 내용 없는 대기 카드를 결론처럼 보이지 않게 한다.

## R679. Presentation cannot strengthen evidence meaning (v56.87, P1352)
A descriptive score never grants buying permission. A held score stays held in sibling summaries; zero is not missing. 게이트: `ci-esm-core-unit-check`, `ci-architecture-browser-check`.

## R579. producer 상태 vocabulary와 사용자 문구를 같은 실제 렌더에서 검증한다 (v54.76, P1028)
producer가 발행하는 enum을 UI가 임의의 동의어로 다시 해석하지 않는다. `ok | partial | failed`처럼 운영 상태가 있는 경우 요약·배지·상세 문구가 모두 같은 canonical 값을 소비해야 한다. 게이트: `ci-atlas-contract-check`, `ci-atlas-browser-check`.

## R291. Static page-education content must state invariant mechanisms only, never a current level/date/verdict, and must inherit the existing declutter/accessibility gates (v52.39, P654 root)
**Superseded by R328 (v57.79)**: R328 replaced per-page education blocks with the guide (it says so itself).

## R206. 사용자 가시 텍스트에 개발자/버전 마커 금지 (v50.14 added, v50.13 UX audit root)

## R204. User-facing market text must pass the text surface contract (v50.3 added, P479 root)

## R115. 사용자 가시 placeholder 텍스트 표준 의무 (v49.64 추가, P334 근본)

## R68. 페이지 placeholder 표준 — 동적 검색 가이드 (v49.26 추가, I5/I6 근본)

## R66. 중복 콘텐츠 자동 감사 — getDuplicateContentAudit (v49.26 추가, I4 근본)

## 원칙 C8 — 결측은 값이 아니다

**불변식**: 없는 관측은 0도, 중립값도, 조건 충족도 아니다. 경계에서 `Number(null)===0`부터 막고, 부분 결과는 부분으로 두며, 실패는 원인과 함께 보이게 닫힌 쪽으로 처리한다. 정적 시드나 추정으로 빈칸을 메우지 않는다.

**게이트**: `scripts/ci-esm-core-unit-check.mjs` · `scripts/ci-runtime-contract-check.mjs` · `scripts/ci-static-data-contract-check.mjs` · `scripts/ci-data-continuity-check.mjs`

**정본**: R628 · 핵심: R628 · 규칙 22건 (비활성 0건)

## R709. Default-path numeric renderers must be partial-data safe (v51.42, P533; renumbered from a duplicated R230 in v57.84)
Live/default-path renderers must not call `.toFixed()` directly on nested live, scenario, chart, or event-context fields. 게이트: `ci-runtime-contract-check`.

## R629. 미설정 입력을 0으로 직렬화하지 않는다 — 0이 값을 뜻하는 필드와 미설정 필드를 타입으로 구분한다 (v56.14, P1176)
`parseFloat(x) || 0`·`Number(x) || 0`은 "빈 입력"과 "0"을 같은 값으로 만든다. 게이트: `ci-esm-core-unit-check`, `ci-portfolio-vault-e2e`.

## R628. 결측은 조건도 구간도 관측값도 만족시키지 않는다 — 경계에서 `Number(null)===0`을 먼저 막는다 (v56.02, P1164)
결측을 '관측된 0'으로 바꾸는 경로는 한 곳이 아니라 클래스였다. `Number(null)===0`(그리고 `Number('')===0`)이 `isNaN()` 검사를 통과해, (a) `null < 73`이 true가 되어 위기 조건을 만족시킨 뒤 `.toFixed`가 TypeError를 던지고… 게이트: `ci-headless-tests`, `ci-screener-workbench-contract`.

## R586. 결측 팩터는 중립값이 아니며 순위 분모를 희석하지 않는다 (v54.95, P1063)
개별 행의 결측·stale·비유한 factor는 z=0 또는 score=50으로 대치하지 않는다. 관측된 양의 가중치만 합산해 그 가중치로 재정규화하고, 유효 가중치가 0인 행은 `composite/rank/quantSignal=null`로 유지해 percentile·turnover 분모에서 제외한다.

## R584. 사용자 표면은 결측·선택·통화·렌더러 소유권을 producer 계약 그대로 보존한다 (v54.76 working tree, P1033)
`null`/blank를 0으로 바꾸거나 이전 needle·선택·상세를 남기지 않는다. 검색은 원래 step/index를 재번호화하지 않고 필터 밖 entity를 상세에 유지하지 않는다. 가격과 손익은 provider currency를 소비자까지 보존하며 통화가 없으면 `$`를 추정하지 않는다.

## R576. 앱·지식·금융 계산의 경계는 종료·관계 의미·결측·비용 의미를 보존한다 (v54.76, P1023~P1025)
app stop은 queued timer/microtask와 late snapshot publication을 취소하며 disposed router는 다시 transition하지 않는다. 게이트: `ci-esm-core-unit-check`, `ci-domain-parity-check`, `ci-screener-workbench-contract` (구 ci-knowledge-core-semantic-check 통합, 구 ci-knowledge-learning-state-contract 통합).

## R575. 금액·관측·근거 계약은 추정으로 빈칸을 채우지 않고 실제 소비 경계를 밝힌다 (v54.75, P1018~P1022)
통화·단위·instrument·field·observedAt가 호환된 관측만 같은 값으로 reconcile한다. 원통화 금액은 환율과 변환 관측시각 없이 USD 계산·필터·팩터로 승격하지 않는다. null/blank 금융 입력은 0이 아니다. 게이트: `ci-screener-workbench-contract`, `ci-native-decision-evidence-check`, `ci-esm-core-unit-check` (구 ci-knowledge-core-semantic-check 통합).

## R518. Portfolio financial values and cross-route detail controls fail closed (v54.54, P962)
prices and valuations in the portfolio domain must be strictly positive; a stored/runtime zero or negative placeholder may not override a valid quote, and…

## R512. Missing numeric observations, news topic suppression and chart observers fail closed together (v54.45, P956)
`null`, empty and non-finite numeric inputs must remain unavailable; a finite zero is a valid observation and must not be discarded. 게이트: `ci-architecture-contract-check`.

## R511. Missing macro transmission variables are blocked, not inferred from proxies (v54.44, P955)
a causal macro lens may consume connected 2Y/10Y/30Y, FRED HY OAS, VIX, breadth and cross-asset quotes, but term premium, Treasury/corporate issuance, dealer…

## R455. 변동 데이터 게이트는 실제 관측과 완전한 unavailable 튜플을 모두 실행 검증한다 (v54.1, P900)
뉴스처럼 외부 공급자 실패가 정상적으로 발생할 수 있는 카테고리는 비어 있다는 사실만으로 통과시키지 않는다. 실제 관측 배열이 존재하거나, producer가 정의한 성공 플래그·건수·배열이 모두 명시적 unavailable 튜플로 일치할 때만 통과한다. 게이트: `ci-static-data-contract-check`, `ci-atlas-contract-check`, `ci-six-doc-coverage-check` (구 ci-knowledge-core-semantic-check 통합).

## R416. Partial portfolio aggregates must remain partial (v53.64, P862)
When any holding lacks the value/cost/current-change evidence required by an aggregate, the derived total remains unavailable unless an explicit canonical total exists. 게이트: `ci-esm-core-unit-check`.

## R370. Theme-detail comparison formatters must reject non-finite quote percentages (v53.35, P823)
Any legacy or native theme-detail comparison that ranks or formats constituent quote percentages must first normalize and filter finite numeric values. 게이트: `ci-runtime-contract-check`.

## R364. Theme-detail performance spread must rank only observed quote changes (v53.27, P792)
The leader performance-spread narrative may move to native only when it uses the normalized quote payload, requires at least two observed constituent changes, and keeps… 게이트: `ci-architecture-contract-check`, `ci-architecture-browser-check`.

## R350. Protected portfolio reloads and RSS backstops must fail closed at the visible boundary (v53.13, P734)
An encrypted portfolio must render its lock screen after a hard reload before any sensitive data surface is shown. 게이트: `ci-portfolio-vault-e2e`, `ci-data-pipeline-contract-check`.

## R342. 변동 데이터와 현재형 서술은 런타임 증거만 사용하고 결측을 정적 시드로 메우지 않는다 (v53.4, P717)
시세·심리·거시·시장폭·수급·차트·시나리오 확률·이벤트 결과·현재 narrative·공급자 가격은 코드나 HTML의 고정 수치/문장으로 현재 상태를 만들지 않는다. 게이트: `ci-static-data-contract-check`, `ci-runtime-contract-check`.
코드 식별자(`dead-code.mjs` keep): `AIO_STATIC_DATA_POLICY`.

## R336. 모든 route의 page completeness는 producer failure와 reference fallback을 종결 상태로 노출한다 (v52.94)
`loading`을 최종 상태로 남기지 말고 `loaded | partial | empty | blocked | stale-reference` 중 하나로 종료한다.

## R324. Coverage and exposure audits must neutralize missingness before recommendations (v52.85, P700)
Region/sector/cap/liquidity/source coverage and exposure must be reported explicitly.
코드 식별자(`dead-code.mjs` keep): `evaluateAICoverageBias`.

## R303. PC geometry and external-source failures must be explicit, bounded, and user-visible (v52.56, H3-D/E/P673 root)
A canvas must never keep an intrinsic width larger than its actual desktop grid parent; an intentionally wide table must be contained by an explicit, keyboard-accessible…

## R159. ticker / options context는 _currentTickerId null + _liveData 미수신 양쪽 가드 의무 (v49.79)
Ticker context guards both a null `_currentTickerId` and not-yet-received `_liveData` (options retired).

## R149. 외부 fetch 실패는 사용자 ❌ 라벨로 surfacing 의무 (Pattern C 일반화) (v49.75)
A fetch failure surfaces as the card's 없음/지연 status with details on demand; no ❌ label.

## R15. 데이터 미수신 vs 진짜 0% 구분 필수 (v38.3 추가, P25, v42.1 강화)
`d.pct || 0` 패턴은 데이터 없음과 진짜 0% 변동을 구분할 수 없으므로 금지

## 원칙 C9 — 현재성은 관측 시각과 달력에서 나온다

**불변식**: 사건·관측·수집·발행 시각은 서로 대신하지 않는다. 최신·지연·참고 라벨은 관측과 거래소 달력에서 한 presenter로 만들고, 미래·잘못된 타임스탬프나 휴장 유예로 stale을 통과시키지 않는다. 지난 일정 날짜는 발표 완료의 증거가 아니다.

**게이트**: `scripts/ci-data-refresh-audit.mjs` · `scripts/ci-data-lineage-audit.mjs` · `scripts/ci-history-field-time-contract-check.mjs` · `scripts/ci-page-data-timeline-contract-check.mjs` · `scripts/ci-operations-status-check.mjs`

**정본**: R671 · 핵심: R671, R447, R650, R634, R641 · 규칙 57건 (비활성 4건)

## R677. Observation identity precedes collection chronology (v56.87, P1349)
Price history windows count distinct eligible market observation sessions, never collection buckets. Conflicting recent observations hold the derived result. 게이트: `ci-esm-core-unit-check`, `ci-native-decision-evidence-check`.

## R671. Currentness labels come from observations and the calendar, via one presenter (v56.81, P1326)
Price currentness uses exactly five states — 실시간, 지연, 종가, 지난 시세, 미수신 — derived from observation times and the exchange calendar, never from the render clock or the… 게이트: `ci-esm-core-unit-check`, `ci-runtime-contract-check`.

## R650. A passed macro schedule date is not evidence of a completed release (v56.62, P1301)
Official schedules may advance `nextRelease` after a scheduled date passes, but `lastRelease` records only a separately verified publication or decision result. 게이트: `ci-runtime-contract-check`, `ci-static-db-expiry-check`.

## R649. refresh freshness requires the published snapshot's own generatedAt (v56.61, P1300)
A status sidecar's `lastSuccessfulAt` cannot substitute for a missing or malformed `market-snapshot.generatedAt`. 게이트: `ci-data-refresh-audit`.

## R648. FOMC schedule alignment requires the canonical official Fed calendar source (v56.61, P1298)
E3/E4 may treat the visible FOMC result and release dates as aligned only when both the `us-fomc` and `us-fed-rate` schedule entries cite the canonical Federal Reserve… 게이트: `ci-data-refresh-audit`.

## R647. future and malformed timestamps outrank forced refresh audit statuses (v56.61, P1297)
A future publication timestamp must report `FUTURE` regardless of the forced audit status. 게이트: `ci-data-refresh-audit`.

## R646. live-core freshness uses a fixed millisecond-precision 12-hour budget (v56.61, P1296)
The 12-hour live-core limit is a producer-liveness SLA: the artifact itself was regenerated within 12 hours, compared in unrounded milliseconds (exactly 12h passes; 12h… 게이트: `ci-data-pipeline-contract-check`, `ci-operations-status-check`.

## R645. future generatedAt never makes browser market data fresh (v56.61, P1295)
**Superseded by R646 (v57.79)**: R646 treats any future artifact timestamp as stale.

## R644. macro calendar source labels are separate from safe official links (v56.61, P1294)
A calendar's human-readable source name and its destination URL are distinct fields. 게이트: `ci-runtime-contract-check`.

## R643. central-bank policy audit requires current Fed and BOK evidence together (v56.61, P1293)
E3/E4 are not OK unless the visible FOMC result, official Fed release calendar, and official current Bank of Korea policy record align. 게이트: `ci-data-refresh-audit`.

## R642. future snapshot timestamps never report current or pass promotion (v56.61, P1292)
**Superseded by R647 (v57.79)**: R647 classifies future and malformed timestamps before any forced status and rejects promotion.

## R641. browser decisions and operations status use the same strict live-core freshness boundary (v56.61, P1291)
A complete weekend/holiday market cycle does not waive the live artifact's wall-clock freshness SLA. 게이트: `ci-data-pipeline-contract-check`, `ci-operations-status-check`.

## R637. live-core freshness는 시장 휴장으로 SLA를 넘겨 통과하지 않는다 (v56.58, P1287)
**Superseded by R641 (v57.79)**: R641 applies the same no-closure-grace live-core boundary to browser decisions and operations status.

## R634. live-core 신선도 감사에는 stale 데이터를 통과시키는 실행 모드가 없어야 한다 (v56.56, P1283)
`data.json`·`market-snapshot.json` freshness는 실제 사용·배포 주장의 일부다. CLI 인수, 환경변수, qa-runner 옵션 또는 attestation caller가 live-core SLA 초과를 `WARN`으로 낮추어서는 안 된다. 게이트: `ci-data-lineage-audit`, `ci-data-pipeline-contract-check`.

## R608. 캐시 폴백은 읽기 시점에 스스로 나이를 판정한다 (v54.99, P1086)
캐시 TTL을 쓰기 시점 정리로만 강제하지 않는다. 폴백 읽기 경로는 캐시 항목의 나이를 판정해 상한을 넘긴 항목을 "현재 값"으로 반환하지 않고, 오래된 응답임을 응답 본문에서 구분 가능하게 표시한다. 게이트: `ci-service-worker-cache-policy-check`.

## R587. 출처 등급·관측시각·수집시각·revision은 서로 대신할 수 없다 (v54.95, P1064/P1065)
provider별 `sourceKind`는 중앙 정규화 계약으로 T1~T4 authority tier를 판정하며 알 수 없는 값은 null/invalid로 fail closed한다. 더 늦게 도착하거나 더 최근에 fetch됐다는 이유로 오래된 관측, 낮은 권한 출처, 권리 철회 상태를 덮지 않는다.

## R568. 출처 세부표시와 공식 발표 일정은 의미를 보존하며 함께 전진한다 (v54.65, P1002)
날짜가 붙은 reference memo는 provenance kind 뒤의 제한된 단일행 출처명을 허용하되 날짜·kind·닫힘 문법을 강제한다.

## R558. 주간 데이터 freshness는 다음 공식 발표 가능 시각 전까지 release-aware로 계산한다 (v54.63, P992)
주간 설문을 단순 UTC 7일/8일 경계로 stale 처리하지 않는다. 공식 집계 종료·발표 timezone을 반영한 bounded grace를 사용하되, 완전한 공식 값과 관측일이 없으면 적용하지 않고 다음 공개 관측을 추정하거나 날짜를 바꾸지 않는다. 게이트: `ci-data-refresh-audit`.

## R551. 보이는 투자 숫자는 기준일·출처·허용 용도를 같은 표면에 둔다 (v54.62, P985)
투자 화면의 수치가 DOM data attribute에만 provenance를 가질 수 없다. 사용자가 값과 함께 observedAt/source/reference·decision 경계를 읽을 수 있어야 한다.

## R548. freshness·LKG·readiness는 producer에서 UI까지 단조롭게 강등된다 (v54.62, P982)
생성·publish·coverage 성공만으로 current를 선언하지 않고 artifact cadence SLA와 market-session grace를 함께 확인한다. 이전 관측을 유지할 때 source/asOf를 보존하되 current fetch 성공처럼 라벨링하지 않는다. 게이트: `ci-data-lineage-audit`, `ci-operations-contract-check`.

## R545. 관측 생략·실패·유효기간 내 LKG를 서로 다른 운영 상태로 보존한다 (v54.61, P979)
로컬 생성이 live 관측을 요청하지 않았다는 이유로 마지막 유효 증거를 삭제하지 않는다. 명시적 관측 실패는 이전 성공으로 숨기지 않고, 재사용 증거는 원래 observedAt/source/revision/sourceSha를 유지하며 TTL 이후 `STALE`로 강등한다. 게이트: `ci-operations-status-check`, `ci-deployment-convergence-check`.

## R517. Freshness, source precedence and missingness must remain visible across compatibility boundaries (v54.50, P961)
a runtime observation must not be overwritten by a reference snapshot; a stale identity universe or expired news cycle may not be labeled current; and missing numeric…

## R492. Official static release calendars must be date-advanced and source-verified (v54.23)
A desktop macro release registry may retain scheduled dates as reference data, but every `nextRelease` must be checked against the publisher's current official calendar… 게이트: `ci-static-data-contract-check`, `ci-data-refresh-audit`.

## R479. Quant rows and rankings preserve separate source epochs and rendered-symbol refresh demand (v54.20)
A quant row must not project one generic timestamp across live price, market cap, EOD technical/factor data, filing-derived fundamentals, identity, breadth/regime, and… 게이트: `ci-screener-workbench-contract`, `ci-page-data-timeline-contract-check`, `ci-screener-auto-refresh-browser-check`.

## R478. Market-sensitive fields retain one machine-checkable timeline and direction basis (v54.19)
On every market route in the current route registry and at every responsive viewport, every decision-relevant field must preserve its value, source, `observedAt`… 게이트: `ci-page-data-timeline-contract-check`, `ci-page-market-epoch-browser-check`.

## R477. Market-sensitive routes consume one evidence-derived market epoch (v54.18)
Reconciliation status must be computed from current source artifacts and executable category checks, never assigned from a static status table. 게이트: `ci-reconciliation-contract-check`, `ci-data-pipeline-contract-check`, `ci-page-market-epoch-browser-check`.

## R447. 시장 시간은 event/observed/collected/published와 exchange calendar를 분리하며 calendar 누락은 UNKNOWN이다 (v53.96, P895)
NYSE/KRX timezone/DST adapter와 holiday/half-day/weekend fixture 없이 session을 추론하지 않는다. calendar가 없으면 current/open/closed claim을 만들지 않는다. 게이트: `ci-market-session-contract-check`.

## R436. 시장 휴장일 freshness 유예는 완전한 Tier-0 snapshot에만 허용한다 (v53.86, P889)
**Superseded by R641 (v57.79)**: live-core freshness has no market-closure grace (R637/R641) and ci-data-lineage-audit no longer has a market-closed predicate; observation currentness on closed sessions is judged by cadence and calendar (R646, R671).

## R427. Provider session hints must be reconciled with venue schedules (v53.68, P872)
A provider `REGULAR`/`CLOSED` hint cannot override the instrument venue calendar. 게이트: `ci-market-snapshot-contract-check`.

## R424. 모든 라우트의 현재시장 문맥은 하나의 서버 24시간 컷을 사용한다 (v53.65, P869)
페이지별 브라우저 시계로 독립적인 “오늘/최근” 구간을 만들지 않는다. `architecture/route-owners.json`의 모든 라우트는 `_serverDataMeta.newsCycleStart/newsCycleEnd/marketSnapshotRevision`을 공통 시장 문맥으로 사용하고…

## R423. 일별 시계열에는 완료된 시장 세션 값만 저장한다 (v53.65, P868)
같은 날짜 행에 미국 전일 종가와 한국/원자재/가상자산 장중값을 섞어 일별 종가처럼 저장하지 않는다. `CURRENT_SESSION` 또는 `DELAYED_IN_SESSION` 값은 라이브 스냅샷에서만 사용하고, 일별 차트 행에는 해당 시장의 직전 완료 종가와 원 관측일, 원 세션, 값 기준을 기록한다. 게이트: `ci-history-field-time-contract-check`.

## R422. LKG 값은 개인 공급자 재시도나 최신 성공시각으로 간주하지 않는다 (v53.65, P867)
서버 아티팩트의 last-known-good 매크로 값은 원 관측일과 원 출처를 유지하며, 현재 FRED 수신 성공으로 카운트하거나 `macro_fred`의 현재시각을 찍지 않는다. 저장 상태, 인증 상태, 연결 상태는 서로 다른 필드로 표시한다(개인 FRED 키 경로 없음). 게이트: `ci-data-pipeline-contract-check`.

## R420. 공식 일정의 완료 이벤트는 nextRelease로 남기지 않는다 (v53.64, P865)
A calendar registry must promote the next official future scheduled event after an event boundary.

## R351. History bucket dates must not replace field-level observation provenance (v53.14, P735)
`history.json`의 행 `date`는 기존 차트 호환용 calendar bucket일 뿐, 각 값의 관측시각이 아니다. 게이트: `ci-history-field-time-contract-check`.

## R332. 데이터 파일 갱신시각·외부 관측시각·마지막 수집 성공시각을 분리하고 missing을 판단값으로 승격하지 않는다 (v52.91, P706 root)
`generatedAt`은 파일 생성 또는 실제 성공 중 문서화된 한 의미만 가져야 하며, 가격의 거래소 관측시각과 공급자 요청시각을 대신하지 않는다. 값이 없거나 원천이 실패한 상태를 `0`, 중립, 현재값, 또는 새 성공시각으로 변환하지 않는다.

## R308. Fallback/reference freshness must not be forced into live parity (v52.60, P677 root)
A static `DATA_SNAPSHOT` marked `_isFallback=true` is reference-only and may lag a dynamically refreshed digest or source artifact.

## R302. Historical event context must expire before it can influence a current action; derived regimes need a missing-input quorum gate (v52.55, H3-B/C/P672 root)
Event/result narratives are reusable context, not perpetual current signals.

## R267. "Current"-labeled rolling aggregations must anchor windows to the newest observation (v51.88)

## R241. Public readiness must expose page-level source/asOf, not only aggregate status (v51.78)

## R238. Page currentness must be source-capped before visible decisions (v51.74, P549)

## R224. Currentness and fallback data must be visible at the consumer surface (v50.96)

## R216. Data/news refresh must separate collection freshness from consumption coverage (v50.62 added, P508 root)

## R205. Static market calendars must separate official releases from source-dependent topics (v50.4 added, P480 root)

## R197. Critical-10 freshness must audit visible market surface, not only refresh schedules (v49.110 added, P473 root)
**IA 갱신 (v59.48)**: 제목의 종합 5·Critical-10 페이지 묶음은 8화면 이전 이름이다 — 대상은 지금 8화면(`architecture/route-owners.json`) 전체다.

## R190. 보이는 차트/지표/시세/수치/수식/텍스트 표면은 최신화 감사에 자동 편입한다 (v49.103 added, P466 root)

## R189. 5개 종합 페이지 개별 데이터는 page profile 심볼/태스크 union으로 최신화한다 (v49.102 added, P465 root)
On entry, each of the 8 screens reloads the latest published artifacts and labels anything stale; it never produces data.
**IA 갱신 (v59.48)**: 제목의 종합 5·Critical-10 페이지 묶음은 8화면 이전 이름이다 — 대상은 지금 8화면(`architecture/route-owners.json`) 전체다.

## R188. 전체 데이터 최신화 진행률은 중앙 refresh state를 단일 진실 원천으로 표시한다 (v49.101 added, P464 root)

## R187. 매매 핵심 페이지(종합 5)는 진입 시 stale하면 즉시 재fetch 의무 (v49.98 added, P463 root)
On entry, each of the 8 screens reloads the latest published artifacts and labels anything stale; it never produces data.
**IA 갱신 (v59.48)**: 제목의 종합 5·Critical-10 페이지 묶음은 8화면 이전 이름이다 — 대상은 지금 8화면(`architecture/route-owners.json`) 전체다.

## R172. MACRO_CALENDAR auto-advance 의무 (v49.83)
발표 캘린더 entry는 일자 경과 시 자동 next event compute. `AIO._aioRecomputeMacroCalendar({ dryRun: true })` 사이드바 18축 노출 의무.

## R160. kr-macro 정적 데이터 / 시점 토큰 진입부 staleness 경고 의무 (v49.79)

## R109. fxbond 한국 금리 스냅샷 시점 명시 의무 (v49.59 추가, P326 근본)

## R81. 정기 발표 데이터 사용자 가시 마커 (v49.31 추가, H4 근본)

## R78. KR 거시 KR_MACRO_RELEASE 등록 + 발표 캘린더 의무 (v49.30 추가, P255/M5 근본)

## R77. 거시지표 MACRO_CALENDAR 등록 + 자동 stale (v49.30 추가, P254/M4 근본)

## R75. 정적 콘텐츠 lifecycle 메타 필수 (v49.30 추가, P253/M2 근본)
정적 콘텐츠는 `createdAt`·`archiveAfterDays`·`replaceAfterDays` 메타를 단다. R75 보강(v49.48, P316): `data-lifecycle-id` 마커와 `_aioStaticContentLifecycleHook()`을 모든 화면 진입에서 호출한다.

## R57. 정적 테이블 stale 감지 의무 (v49.24 추가, P217 근본)

## R33. 데이터 Freshness 추적 의무화 — FRESHNESS_ENGINE + _markFetch + _aioFeedHealth (v48.39 추가, P133 교훈)

## 원칙 C10 — 한 지표에는 한 원천과 한 표시 owner

**불변식**: 같은 지표·라벨·임계값은 하나의 selector·상수·resolver에서 읽고, 여러 화면·미러·AI 문맥은 그 값을 공유한다. 값의 표시 owner는 하나이고, 같은 이름은 같은 정의·집합·반올림을 뜻한다.

**게이트**: `scripts/ci-domain-parity-check.mjs` · `scripts/ci-runtime-contract-check.mjs` · `scripts/ci-data-pipeline-contract-check.mjs` · `scripts/ci-architecture-browser-check.mjs`

**정본**: R301 · 규칙 45건 (비활성 1건)

## R726. 한 이름은 한 길이, 한 집합, 한 번의 반올림 (v58.80, P2074)
화면의 기간 이름(1개월·3개월·20거래일 등)은 src/domain/market/market-windows.js가 정한 길이 하나만 가리키고 sessionPointBack으로 잰다(행 개수 금지). 게이트: `ci-esm-core-unit-check`, `ci-fiscal-quality-fixture`, `ci-scenario-guidance-fixture`.

## R715. 한 필드의 사용 가능 기한은 한 상수에서 읽고, 순위 모집단은 비교 가능한 보통주로 한정한다 (v57.85, P1872)
같은 데이터의 계산 사용 기한을 두 곳(필드 레지스트리, 순위 모델)에 따로 두지 않는다. 연간 공시 수치는 FUNDAMENTAL_MAX_PERIOD_AGE_DAYS를 읽는다. 게이트: `ci-screener-workbench-contract`, `ci-candidate-archive-check`.

## R714. 기술 지표 정의는 technical/definitions.js 한 곳에서, RRG 사분면은 themes/rrg.js 한 곳에서 읽는다 (v57.85, P1871)
SMA·EMA·ATR(Wilder)·ADR%·52주 범위(252봉 요건)·50일선 거리 배수와 구간·주봉·Weinstein 단계는 src/domain/technical/definitions.js의 함수를, 기간·구간·과열/돌파 배수는 RULES.technical을 사용한다. 게이트: `ci-chart-scenarios-fixture`, `ci-scenario-guidance-fixture`, `ci-data-pipeline-contract-check`.

## R695. A threshold that drives an alert has one owner and pinned copies (v57.30, P1534)
VIX and Fear & Greed band edges are owned by src/domain/rules/thresholds.js. 게이트: `ci-domain-parity-check`.

## R692. A figure that is withheld is withheld at every consumer (v57.30, P1522)
When a filing's dollar amounts are withheld, every path that can show or sum them applies the same withholding: ingress arrays, index rows, earlier-period totals… 게이트: `ci-masters-contract-check`, `ci-masters-browser-check`.

## R685. 한 화면의 결과 수·표·다음 링크는 같은 집합 (v57.28, P1512)
실행 결과 수, 기본 표, "다음에 볼 종목" 링크는 같은 조건·같은 집합을 따른다. 다른 집합을 보여야 하면 그 범위와 이유를 숫자 옆 한 줄로 말한다.

## R683. 기간·기준일 라벨은 계산에서 파생 (v57.28, P1510)
'N일·N거래일·어제·M/D 종가·실시간' 같은 라벨은 실제 계산 창(세션 수)과 관측 세션·값 기준(valueBasis)에서 만든다. 수집 행 수, 생성 시각, 바 시작 시각, 시장이 다른 세션 날짜를 라벨로 쓰지 않으며, 비교 사이 누락 세션은 숨기지 않고 표기한다.

## R662. Visible facts are derived from their owner, not restated in static copy (v56.77, P1315)
Market direction colour/class, score-component names, keyboard-shortcut targets and route names, statutory rates and literature citations shown to users must come from… 게이트: `ci-runtime-contract-check`.

## R616. 정합은 화면이 실제로 읽는 경로에서 성립한다 (v55.04, P1116~P1119)
산출물이 스스로 정합적이라는 것만으로는 부족하다. 그 산출물이 어느 경로로 소비자에게 도달하는지가 정합의 일부다. (1) 화면 정합은 렌더 경로에서 검사한다: UI가 A에서 렌더하고 정합 게이트가 B에서 검증하면, B가 맞아도 화면은 설명되지 않는다. 게이트: `ci-artifact-semantics-check`, `ci-runtime-contract-check`, `ci-history-field-time-contract-check`.

## R602. 같은 라벨이 두 정의를 가리키면 정의나 라벨을 하나로 만든다 (v54.98, P1078)
한 화면 안에서 같은 이름(등급, 시장 폭 시그널, MACD, 시장 참여도)이 서로 다른 기준·단위·기저로 계산되면 사용자는 어느 쪽이 참인지 판단할 수 없다.

## R597. 값의 표시 소유자는 하나여야 하고, 소유권 이전은 승계 확인을 요구한다 (v54.98, P1074)
어떤 값을 화면에 쓰는 책임을 legacy 경로에서 native 경로로 옮길 때는, 옮긴 쪽이 그 값을 실제로 생성·투영하는지 gate나 fixture로 확인한다.

## R580. 검색·필터는 렌더러와 동일한 canonical 관계 필드를 사용한다 (v54.76, P1029)
동일 artifact의 관계 필드를 검색용으로 별도 이름 추정하지 않는다. 화면 카드가 `taxonomyNodeIds`를 통해 player/product를 연결하면 검색 haystack도 같은 필드를 사용하고, 존재하지 않는 `nodeIds` 같은 shadow alias를 만들지 않는다. 게이트: `ci-atlas-contract-check`, `ci-atlas-browser-check`.

## R572. 표시·정렬·비교·복귀는 같은 관측과 실제 사용자 문맥을 사용한다 (v54.70, P1010)
총점과 기여도는 단일 모델에서 파생하며 결측을 0이나 중립점수로 채우지 않는다. 숨긴 점수로 정렬하지 않고 결측은 양방향 정렬 모두 뒤로 보낸다. 비교는 같은 정의의 필드와 기준을 표시한다. 엔티티 이동은 실제 origin·필터·스크롤·포커스를 보존하고 접근성 이름도 갱신한다. 게이트: `ci-desktop-continuity-check`, `ci-runtime-contract-check`.

## R570. 관측의 종목·주기·출처와 사용 범위를 소비자까지 보존한다 (v54.68, P1004)
종목 선택 변경은 기존 결과를 초기화하고 모든 비동기 결과를 선택 epoch로 검증한다. 월/주/일봉 fallback은 실제 요청 주기를 유지하고 빈 배열을 성공으로 취급하지 않는다. 관측값 없는 지표를 시총·현재가 상수로 만들지 않는다. 게이트: `ci-research-flow-contract-check`, `ci-screener-workbench-contract`.

## R555. 같은 지표명의 계절조정·비계절조정과 field별 권한을 합치지 않는다 (v54.63, P989)
CPI 공식 보도 canonical은 BLS CPI-U NSA headline/core이고 SA 전년비는 분석 companion으로 별도 전달한다. Treasury maturity/spread는 같은 관측일·출처를 유지한다.

## R417. Native secondary theme performance surfaces need one scoped writer (v53.64, P859)
A native themes performance surface must read normalized current/weekly evidence, render an explicit pending state when the selected period is unavailable, and fence the…

## R371. Shared currentness sanitizers must not rewrite native renderer-owned narrative sinks (v53.36, P824)
Cross-cutting stale/loading text normalization may annotate legacy or unowned narrative sinks, but must leave elements marked with a native renderer ownership marker… 게이트: `ci-headless-tests`, `ci-architecture-browser-check`.

## R301. A current market metric must have one canonical selector and an explicit provenance state; a snapshot may render as reference but must never silently drive a decision (v52.55, H3-A/P671 root)
A metric shown in multiple pages (especially Fear & Greed) must be selected through one canonical currentness envelope containing value, source, as-of/fetched-at… 게이트: `ci-runtime-contract-check`.

## R289. Live quote bridges must keep DATA_SNAPSHOT and `_fallback` mirrors synchronized (v52.33, P648 root)

## R287. Market breadth color, label, and gauge bars must share the canonical breadth regime (v52.31, P646 root)

## R283. Interactive detail surfaces must be canonical, all registry entries must render, and same-screen metrics must share the same source (v52.27, P642 root)

## R276. New code needing current market/risk/regime/breadth/cycle condition must consume `window.AIO.marketState`, not re-derive it independently (v52.3)
`window.AIO.computeMarketState()` (js/aio-core.js:2728-2823) is the single synthesis point for derived market condition — it composes `_aioRegimeNow()` +…

## R274. A live-fetch binding introduced for an existing labeled/thresholded field must fetch the exact same named indicator the label represents — not a same-topic substitute (v51.97)

## R266. When a measured value and a proxy heuristic coexist, consumers must prefer the measurement — and fetchers must store measurements consumably (v51.88)

## R261. A "single responsibility" canonical updater must include every DOM sink for its metric (v51.83)
When a function is documented as the single canonical place that updates all DOM sinks for a metric, any new sibling element added later to display that same metric must…

## R253. Multiple DOM bindings for the same metric must share one resolver, not independently-ordered fallback chains (v51.83)

## R252. A static/curated list overlaid with live per-item data must flag contradictions, not silently keep them (v51.83)

## R244. A live-state value shown in multiple UI surfaces must not be computed independently per surface (v51.82)

## R209. 계약 수·시간대·복합 가격 카드는 단일 진실 원천에서 파생 (v50.56 added, P501 root)

## R208. 분석 UI 상태·수량·정밀 주장·향후 일정은 증거 원천에서 파생 (v50.55 added, P500 root)

## R184. 동일 지표가 2개 저장소(DATA_SNAPSHOT 본체 + _fallback 미러)에 존재 시 정합 의무 (v49.96 added, P459 root)
**Superseded by R289 (v57.79)**: R289 keeps DATA_SNAPSHOT and the _fallback mirror synchronized.

## R182. cell-level은 연결 + 값 정확성 둘 다 / 텍스트 수치는 동적 참조 (v49.91 added, P452 root)

## R97. data-snap 키 vs DATA_SNAPSHOT 시드 정합 (v49.41 추가, P301 근본)

## R95. 페이지 간 동일 ticker 정합 의무 (v49.39 추가, P290 근본)

## R94. 페이지 인라인 임계값 표 REGISTRY 정합 의무 (v49.38 추가, P286 근본)

## R76. 정치/관료 이름 NAMED_ENTITY_REGISTRY 경유 의무 (v49.30 추가, P254/M3 근본)

## R74. DOM 인라인 폴백 vs DATA_SNAPSHOT 동시 갱신 의무 (v49.30 추가, P252/M1 근본)

## R69. Action Item 단일 출처 — ACTION_RULES (v49.27 추가, E1/E2 근본)
ACTION_RULES is the single source of VIX/F&G band observation text (edges owned by R695); it never emits position size or trade directives.

## R67. 동적 판정 함수 단일화 — getCycleFromMacro (v49.26 추가, I7 근본)

## R63. 라벨 인라인 사용 자동 audit — getThresholdLabelAudit (v49.25 추가, R56 자동화)

## R58. DOM 인라인 vs DATA_SNAPSHOT 3-way 정합 (v49.24 추가, P213 근본)

## R56. 임계값·라벨 단일 출처 — THRESHOLD_REGISTRY (v49.24 추가, P219 근본)

## R55. 동일 지표 multi-sink 단일화 (v49.24 추가, P216/P218 근본)

## R37. data-snap 신규 추가 → 자동 렌더러 참여 (v48.54 추가, P108 교훈)

## R30. 지표 라벨/임계값 전역 통일 (v46.8 추가, P83~P104 교훈)

## 원칙 C11 — 판단은 근거 게이트와 검증된 방법을 거친다

**불변식**: 파생 결론은 필수 입력의 의미·기준일·coverage가 갖춰질 때만 보인다. 판정 이름은 그것을 정의하는 조건이 있을 때만 붙이고, 과거 빈도는 겹치지 않는 사례로 세며(10건 미만은 건수만), 판정 규칙은 급변 구간 재생을 통과한다. 앱은 종목·가격·비중·시점을 고르지 않는다.

**게이트**: `scripts/ci-crash-replay-check.mjs` · `scripts/ci-esm-core-unit-check.mjs` · `scripts/ci-scenario-guidance-fixture.mjs` · `scripts/ci-native-decision-evidence-check.mjs` · `scripts/ci-pipeline-semantics-check.mjs`

**정본**: R340 · 핵심: R340, R670, R706, R265 · 규칙 39건 (비활성 0건)

## R725. 과거 판정·소급 계산은 그날 이후 자료가 바뀌어도 같아야 한다 (v58.80, P2064) (v58.80, P2064)
과거 날짜의 판정·빈도·소급 계산은 그 날짜까지 관측된 자료만으로 정해진다. 그날 이후 값을 지우거나 바꿔도 결과가 같아야 하고, 오늘 판정은 파일이 보관하는 창 밖 이력 길이와 무관해야 한다. 수집 버킷이 아니라 관측일로 자른다. 종가 밖의 사후 정보(지금 구성 종목·지금 규칙)를 쓰면 화면에 밝힌다. 게이트: `ci-lookahead-check`.

## R724. 앱은 종목·가격·비중·시점을 고르지 않고, 고르는 법을 가르친다 (v58.75, P2037)
화면과 AI는 매수가·손절가·목표가·비중·시점·종목을 제안하지 않는다. 대신 레벨 지도(지지·저항 후보, 거래 집중 가격대, 이동평균, 변동폭 거리), 전문가가 테마·종목·손절·목표를 고르는 방법과 장단점, 기준별 충족 개수와 값(가능성·등급 아님), 데이터로 확인되는 원인 사슬, 사용자가 입력한 자기… 게이트: `ci-ai-intelligence-contract-check`, `ci-fiscal-quality-fixture`, `ci-scenario-guidance-fixture`.

## R719. 원인 지지는 방향 일치만 (v57.93, P1907)
AI 원인 귀속에서 교차자산은 그 원인이 예측하는 방향으로 움직였을 때만 지지 근거다. 반대 방향은 반대 근거, 방향 정보가 없으면 시간 일치일 뿐이다. 같은 시간 창의 다른 원인 후보는 지지가 아니라 경쟁 설명이며, 있으면 단일 원인으로 단정하지 않는다. 게이트: `ci-ai-intelligence-contract-check`.

## R713. 판정 이름은 그 이름을 정의하는 조건이 있을 때만 붙이고, 임계값은 공용 상수에서 읽는다 (v57.84, P1859)
확장·약세·재가속·경색처럼 이름이 붙는 판정은 그 이름을 정의하는 핵심 조건이 충족될 때만 쓴다. 보조 조건 개수가 많다는 이유로 이름을 붙이지 않는다. 충족 조건 수는 가능성이 아니라 개수로 표시한다. 화면 문장과 판정이 쓰는 임계값은 RULES 상수에서 읽고, 화면에 숫자를 따로 적지 않는다. 게이트: `ci-scenario-guidance-fixture`, `ci-esm-core-unit-check`.

## R708. 판정 규칙은 급변 구간 재생을 통과한다 (v57.83, P1853)
이 검사는 회귀·정합 검사이지 예측력 검증이 아니다 — 기준점 재생 구간은 공개 종가 기준점 사이를 지어낸 경로로 잇는 합성 스트레스이고, 2026년 구간만 실제 관측 기록이다. 통과가 판정의 정확도·수익성을 뜻하지 않으며(R697 예측 검증은 별개), 검사 출력도 두 종류를 구분해 표시한다. 게이트: `ci-crash-replay-check`.

## R707. A judgement needs a noise buffer, a recent-move check and its window (v57.81, P1829)
A label (양호/부담, 주도/선도, 상승 추세, entry-ready) is decided with a buffer sized from the series' own noise (ADR or its own n-period change distribution) and hysteresis where… 게이트: `ci-scenario-guidance-fixture`, `ci-esm-core-unit-check`.

## R706. Past frequencies need non-overlapping cases and a sample floor (v57.79, P1824)
A past-frequency statement counts non-overlapping cases using only data available at each case date (no look-ahead, no outcome-selected samples). 게이트: `ci-scenario-guidance-fixture`.

## R670. Reference descriptions use the latest completed US regular close and say so (v56.81, P1328)
Descriptive (non-decision) scores always describe the latest completed US regular-session close, including during the next session. 게이트: `ci-esm-core-unit-check`.

## R664. Reference-only filters use plausibility-checked reference values, not decision-grade gates (v56.78, P1318)
A filter that only buckets or narrows (e.g. market-cap size) must not require decision-grade live evidence. 게이트: `ci-esm-core-unit-check`.

## R631. 성과·위험 결과는 측정 경로·분모·현금·RF·표본을 선언하지 않으면 인증하지 않는다 (v56.17, P1182)
선언 없는 지표 표는 그 숫자가 어떤 계좌의 어떤 범위·기간·정책으로 계산됐는지를 말하지 않는다. 게이트: `ci-esm-core-unit-check`.

## R556. 팩터 순위의 confidence는 입력 근거 진단이며 수익확률·매매신호가 아니다 (v54.63, P990)
관측시점·identity·최소 coverage를 통과하지 못한 팩터는 종합점수에서 제외한다. 섹터 중립·극단치 완화·결측·turnover/regime 안정성을 기록하고 confidence의 의미를 UI에 표시한다.

## R530. Evidence allowedUse는 생성 이후 오직 더 제한적으로만 바뀐다 (v54.59, P967)
`none < reference < decision` 순서에서 source rights ceiling, explicit use, freshness/status의 교집합만 허용한다. freshness 평가나 consumer가 reference/snapshot 값을 decision으로 승격할 수 없다. 게이트: `ci-source-registry-contract-check`.

## R498. Screener factor rows cannot be created by fundamentals alone (v54.37, P945)
`public-data/screener.json.data` contains only symbols with a successfully derived price-factor row. 게이트: `ci-screener-workbench-contract`, `ci-data-pipeline-contract-check`.

## R449. 연구 모델은 PIT/walk-forward/holdout/cost/liquidity/parity 상태를 함께 공개하고 검증 전 research-only다 (v53.96, P895)
present-day universe backtest를 live predictive proof로 부르지 않는다. 게이트: `ci-research-model-contract-check`.

## R414. Current decision scores require a typed decision-use grant (v53.64, P860)
A numeric value is not decision evidence merely because it is finite. 게이트: `ci-native-decision-evidence-check`.

## R399. Domain analysis engines must be deterministic and evidence-bounded (v53.55, P849)
Sector, company, technical, macro, and FX analysis may calculate only from supplied typed inputs.

## R397. Research-relative rankings must not become confirmed recommendations (v53.55, P848)
Screener rank thresholds are research-relative evidence only. 게이트: `ci-ai-intelligence-contract-check`.

## R383. Ticker action narratives require entity evidence (v53.49, P840)
the premise that action language becomes allowed once evidence exists is retired — AGENTS bars entry/stop/target/trim language on every route (R697/R698).

## R381. Decision models must consume normalized decision evidence (v53.47, P838)
Values marked `reference` or `none` must never contribute to a trading, health, ranking, or other decision score, even when a numeric value is present in a legacy… 게이트: `ci-esm-core-unit-check`.

## R343. 신용 판정은 HYG 등 듀레이션 오염 가격이 아니라 FRED HY OAS(bp) 실측만 사용하고, 결측 시 null 사전 차단으로 0을 방지한다 (v53.7, P726)
신용 수준은 FRED HY OAS(BAMLH0A0HYM2, bp) 실측만 사용해 bp 값과 변화폭으로 보여 준다. 구간 경계(`src/domain/rules/thresholds.js`)는 참고 라벨이지 등급이 아니며, 문구는 관측형으로 쓴다(P714).

## R340. 파생 시장 결론은 필수 관측 입력의 의미·기준일·coverage가 충족될 때만 표시한다 (v52.99, P712)
금리 스프레드, 기술지표, Stage, RRG, 시장폭, McClellan, HY OAS, 테마처럼 여러 값을 결합하는 결론은 각 필수 입력의 instrument/maturity/unit/source/asOf/coverage를 검증해야 한다. 게이트: `ci-runtime-contract-check`.

## R306. Typed provenance must separate evidence state from action strength (v52.59, P676 root)
Missing, neutral, future-dated, stale, delayed, snapshot, manual, seed, fallback, and proxy evidence are not interchangeable.

## R299. A factor backtest's universe composition and lookback window can flip the sign of a well-known factor — don't compare against academic-literature factor performance without matching sample characteristics (v52.51)
A 10-year (2016-2026), 120-large-cap-ticker, monthly-rebalanced backtest of the live factor ranking model's `lowvol` sub-factor (`-annualizedVol`, computed over a…

## R298. A hand-tuned score using fixed absolute-level thresholds on a macro indicator must be re-validated against realized outcomes across a regime-shifting window before trusting its sign, not just its shape (v52.49)
Absolute macro thresholds must be validated across regimes using non-overlapping windows or HAC/block-bootstrap inference, reporting the effective sample size; the…

## R297. A score's evidence/provenance registry must list every input the score function actually reads — not just the subset registered when the registry was first built (v52.49)
`computeTradingScore()` reads ~13 distinct inputs (spx/spy/vix/tnx/hyg/dxy/oil plus vvix/fg/breadth200/pcr/aaiiBear/hyBp), but `TRADING_DECISION_CRITICAL_INPUTS` (the…

## R282. Assertive market-verdict/interpretation text must gate on live-sourced inputs — fallback/snapshot/blocked data may show numbers, but must not assert a directional or confidence-implying verdict (v52.24, P634/P635 root)

## R268. Combining sub-signals of different natural scale into one factor requires normalizing each first (v51.89)

## R265. Code that claims parity with a named external tool/methodology must match that source's exact definition, verified by recomputation (v51.86)
Rule (body restored v57.92 from the pre-2026-07-18 ledger): a feature described as matching a named source (Portfolio Visualizer, a published formula, an index…

## R242. Portfolio backtests must expose assumptions, monthly construction, drawdown recovery, and active risk (v51.79)

## R233. Ticker technical analysis must prioritize Minervini price/MA/volume/supply logic (v51.45, P536)

## R232. Cross-asset trading factors must use comparable scales (v51.44, P535)
Screener, rank, and backtest factors that compare stocks across currencies, nominal price levels, or split histories must use returns, log prices, ratios, z-scores, or… 게이트: `ci-data-pipeline-contract-check`, `ci-runtime-contract-check`.

## R201. Trading decision logic must pass current evidence gate (v50.1 added, P477 root)

## R198. Critical-10 page content must be compared with current market reference/regime before being trusted (v49.111 added, P474 root)
**IA 갱신 (v59.48)**: 제목의 종합 5·Critical-10 페이지 묶음은 8화면 이전 이름이다 — 대상은 지금 8화면(`architecture/route-owners.json`) 전체다.

## R195. Trading-use market data must pass DataTruthGate before decision use (v49.108 added, P471 root)

## R92. 페이지 표시 분석 기준 100% 커버 의무 (v49.36 추가, P278 근본)

## R91. 페이지 표시 분석 기준 registry 등록 + 가용성 가시화 의무 (v49.35 추가, P275 근본)

## R62. 정량 지표 자동 채점 — PIOTROSKI_CHECKLIST (v49.25 추가, L7 근본)

## R61. 다중 신호 합의 알고리즘 — diagnoseBreadthConsensus (v49.25 추가, L3 근본)

## R59. 점수 스케일 단일 정의 — SCORE_SCALES (v49.25 추가, L1 근본)
Any reference score shows one declared scale and its basis (직전 미국장 종가, R670); no 0–100 composite or letter scale.

## 원칙 C12 — 종목과 공시는 정확한 등록으로만 식별한다

**불변식**: 종목은 정확한 등록(심볼·발행사·주식 종류) 일치로만 해석하고 추측하지 않는다. 한 종목은 라우트·시세 요청·스크리너에서 한 정본 심볼이고, 공시 값은 같은 증권의 단위·기간끼리 대조한다. 한국 테마는 사용자 콘텐츠이며 라벨 owner는 하나다.

**게이트**: `scripts/ci-sec-runtime-projection-check.mjs` · `scripts/ci-13f-currentness-check.mjs` · `scripts/ci-masters-contract-check.mjs` · `scripts/ci-korea-participation-fixture.mjs` · `scripts/ci-data-pipeline-contract-check.mjs`

**정본**: R663 · 핵심: R663, R672, R654 · 규칙 27건 (비활성 1건)

## R686. 공시 금액은 동일 증권 간 단위를 대조하고, 미연결은 0이 아니다 (v57.28, P1513)
여러 신고자의 같은 증권·같은 기간 금액은 주당 가격 등 동일 단위로 대조하고, 어긋나면 금액 기반 해석(비중·합계·순위)을 보류한다. 자료를 불러오지 못한 상태는 "없음/0건"이 아니라 "미완료"로 표시한다.

## R672. Korean themes are user content with one label owner (v56.81, P1327)
Korean theme sections are never gated behind developer mode. 게이트: `ci-esm-core-unit-check`.

## R663. One instrument, one canonical symbol across route, quote request and screener (v56.78, P1317)
Ticker input (bare KRX code, exchange-suffixed code, or an exact/unambiguous registered Korean name) is normalized once to the Yahoo-style symbol before any lookup; the… 게이트: `ci-esm-core-unit-check`.

## R654. SEC ownership polling and 13F row imports use separate, semantic cadences (v56.71, P1309)
Daily SEC submissions polling may refresh Schedule 13D/G ownership events without rebuilding quarterly 13F rows. 게이트: `ci-13f-semantic-hash-check`, `ci-13f-currentness-check`, `ci-data-pipeline-contract-check`.

## R591. company-primary 출처는 registry 검증된 issuer identity 없이는 승격하지 않는다 (v54.96, P1068)
SEC registrant/issuer IR identity만 company-primary의 primary floor를 채울 수 있다.

## R499. Regulatory universes require discovery, fair access, amendment composition and last-known-good preservation (v54.38, P948)
a 13F/13D/G universe cannot be called current from a hand-maintained subset. 게이트: `ci-13f-currentness-check`.

## R493. SEC fallback concepts must be unioned before newest-observation selection (v54.24)
When a SEC fact field has multiple configured US-GAAP concepts, collect rows from every concept before deduplicating by period, filing date, accession, and form. 게이트: `ci-data-pipeline-contract-check`.

## R448. SEC fundamental anomaly는 quarantine하고 current/missing/not-applicable classification을 공개한다 (v53.96, P895)
filing metadata와 observed freshness가 없는 값을 decision evidence로 승격하지 않는다. 음수/비정상 metric 및 producer anomaly는 quarantined metrics로 격리하고 `decisionEligible=false`를 유지한다.

## R439. 분기 비교는 실제 인접 공시와 유한한 사용자 표면을 함께 검증한다 (v53.89, P892)
13F의 이전 보고분기는 단순히 최신 분기보다 과거이기만 해서는 안 되며, 연결된 filing history에서 확인되는 실제 직전 보고분기여야 한다. resolver는 결과를 stdout에만 남기지 않고 canonical filing artifact에 원자적으로 반영해야 한다. 게이트: `ci-masters-contract-check`, `ci-masters-browser-check`.

## R437. 최신 13F 없음과 지연 상태를 구분하는 SEC availability evidence를 기록한다 (v53.87, P890)
`STALE_REFERENCE` 13F는 공시 원문이 오래된 것인지 SEC에 더 최신 분기가 없는 것인지 독립적으로 확인해야 한다. SEC submissions feed의 최신 제출 시점·검증일·source URL·결과를 연결하고, 그 결과를 최신 보유 데이터로 승격하지 않는다. 게이트: `ci-masters-contract-check`, `ci-masters-browser-check`.

## R375. Official SEC report surfaces must use one finite-safe projection and keep mixed-source sections separate (v53.41, P832)
A fundamental route may present an official SEC report only through one pure projection that preserves filing identity, period/submission dates, coverage, source kind… 게이트: `ci-architecture-contract-check`, `ci-architecture-browser-check`.

## R271. After editing `SCREENER_DB` (js/aio-data.js), always re-run `scripts/sync-screener-universe.mjs` before committing (v51.94)

## R251. XBRL/multi-source financial data must resolve to the freshest tag and validated period, and refresh handlers must have a real data source (v51.83)

## R170. 외부 작업본 통합 시 KR/외국 ticker 매핑 다중 위치 cross-check 의무 (v49.82 added, P439~P441 root prevention)

## R166. AIO_THEME_SEMANTIC_EXCLUSION_RULES 의미적 misfit 배제 의무 (v49.80 Codex)

## R165. AIO_TICKER_NAME_REGISTRY 의미적 정확성 + 한글 별명 일관성 의무 (v49.80 Codex)

## R131. AI 채팅 거시 시나리오 동적 시뮬레이션 + 약어/별명 fuzzy 매칭 의무 (v49.69 추가, P368~P369 근본)
Korean names and nicknames resolve only through an exact alias registry; there is no similarity matching (P1339).

## R103. SCR_KEYWORD_ALIASES 신규 테마 추가 시 AIO_TICKER_NAME_REGISTRY 등록 의무 (v49.57 추가, P316 근본)

## R101. DOM ticker vs LIVE_SYMBOLS coverage 의무 (v49.48 추가, P317 근본)

## R88. Fundamental 15 분석 기준 데이터 출처 매핑 (v49.32 확장)

## R87. 종목별 데이터 무결성 통합 검증 (v49.32 확장, 사용자 추가 요청)

## R85. 종목명-티커 단일 출처 — TICKER_NAME_REGISTRY (v49.32 추가, P266 근본)

## R36. Themes 페이지 종목 추가 → LIVE_SYMBOLS 동시 등록 (v48.54 추가)

## R23. 외국 기업(ADR) 재무 파싱 (v40.4 추가, P33)

## R12. 유사 이름 모자회사 구분 (v35.6 추가)
검색 시 동일/유사 이름이 복수 나오면(예: 코스맥스/코스맥스BTI), 각각의 정식 종목명·코드·시총·사업내용을 대조하여 본사/자회사 구분 후 올바른 코드 선택 (P19 Parent-Sub Confusion).

## R11. 비상장 기업 코드 할당 금지 (v35.6 추가)
**Superseded by R10 (v57.79)**: R10 step 3 already forbids assigning a code to an unlisted company.

## R10. 종목코드 입력 시 3중 검증 필수 (v35.6 추가)
신규 종목 추가 시 반드시 아래 3단계 모두 통과해야 DB에 코드 입력 가능: 1. Yahoo Finance quote 페이지에서 공식 회사명 확인 — DB 등록명과 일치해야 함 (269620="Syswork" ≠ "레인보우로보틱스" 사례) 2.

## 원칙 C13 — 생산자는 수집→산출물→소비→감사를 닫는다

**불변식**: 데이터는 GitHub Actions 생산자만 만들고 클라이언트는 발행된 산출물만 읽는다. 산출물은 완성본 단위로 원자 교체하고, 실패한 수집은 마지막 정상본을 덮지 않으며, 새 산출물은 같은 변경에서 lineage·소비자·감사를 등록한다. 정적 DB는 갱신 주기에 맞추거나 명시적으로 보류한다.

**게이트**: `scripts/ci-data-pipeline-contract-check.mjs` · `scripts/ci-data-lineage-audit.mjs` · `scripts/ci-refresh-artifact-integrity-check.mjs` · `scripts/ci-artifact-semantics-check.mjs` · `scripts/ci-artifact-size-headroom-check.mjs`

**정본**: R217 · 핵심: R560, R605 · 규칙 53건 (비활성 1건)

## R717. main에 커밋되는 데이터 파일은 50MB 미만으로 설계한다 (v57.89, P1899)
프로듀서가 main에 커밋하는 public-data 파일은 GitHub 50MB 경고 아래여야 한다. 행 수가 늘어나는 원장은 크기 상한이 있는 분할 저장(색인 + 결정론적 part, 리더가 재조립·digest 검증)으로 쓰고, 단일 파일 원장은 main 밖(data-store 등)에 둔다. 게이트: `ci-masters-contract-check`, `ci-artifact-size-headroom-check` (구 ci-masters-manager-store-check 통합).

## R640. snapshot promotion requires a fresh published artifact in every market session (v56.60, P1290)
`market-snapshot` publication and promotion use the artifact's own `generatedAt` against the 12-hour wall-clock budget. 게이트: `ci-data-refresh-audit`.

## R639. 실패한 market-snapshot 주기는 비밀 없이 재진단 가능한 bounded artifact를 남긴다 (v56.59, P1289)
자동 market snapshot producer는 현재 주기 publication 실패, freshness 만료 또는 fetch 단계 실패를 성공 로그로 숨기지 않는다. 게이트: `ci-data-refresh-audit`.

## R632. 선언 입력에는 writer가 있어야 하고, 저장 경로는 durable ack를 버리지 않는다 (v56.19, P1187)
필드가 reader·normalizer·surface에 있다는 사실은 그 필드가 입력될 수 있음을 뜻하지 않는다. 게이트: `ci-esm-core-unit-check`, `ci-portfolio-vault-e2e`.

## R630. 식별자·정체성 해시는 그 대상의 입력에서 파생한다 — 표시·overlay 파생값을 넣지 않는다 (v56.15, P1177)
`snapshotId`처럼 "무엇을 관측했는가"를 식별하는 값은 그 관측 집합의 입력(artifact·universe의 revision과 그 필드)에서만 파생돼야 한다. 게이트: `ci-screener-workbench-contract`, `ci-screener-auto-refresh-browser-check`.

## R626. 생성 산출물의 병합은 필드 소유권으로 결정한다 (v55.21, P1141)
같은 생성 문서를 두 생산자가 서로 다른 필드로 갱신하면 충돌은 의미 충돌이 아니라 필드 소유권 충돌이다. 게이트: `ci-version-check`, `ci-release-revision-check` (구 ci-release-manifest-contract 통합).

## R615. 참조·측정면·퇴역은 발행 시점에 함께 닫는다 (v55.03, P1109~P1114)
발행물은 값이 맞는 것만으로 충분하지 않다. 그것이 가리키는 대상·그것을 세는 범위·그것을 만든 범위가 함께 닫혀야 한다. 게이트: `ci-artifact-semantics-check`, `ci-data-lineage-audit`, `ci-service-worker-cache-policy-check`.

## R614. 발행 산출물의 의미 계약은 소비자·계보·만료까지 닫는다 (v55.02, P1096~P1108)
값·단위·시각·어휘의 자기 정합(R613)만으로는 부족하다. 산출물이 발행되는 순간부터 소비자와 계보가 함께 닫혀야 하고, 전환 면제는 시한을 가져야 한다. 게이트: `ci-artifact-semantics-check`, `ci-history-field-time-contract-check`, `ci-runtime-contract-check`.

## R613. 발행 산출물은 값·단위·시각·어휘가 스스로 정합해야 한다 (v55.01, P1090~P1095)
발행되는 아티팩트는 스키마와 신선도만 맞으면 되는 것이 아니다. 같은 산출물 안에서 값과 라벨이 서로 모순되어서는 안 되며, 다음을 실행 가능한 게이트로 고정한다. 게이트: `ci-artifact-semantics-check`, `ci-domain-parity-check`.

## R605. 정적 DB는 data-refresh 주기에 맞춰 갱신하거나 명시적으로 보류한다 (v54.98, P1081)
`SCREENER_DB`·`KR_STOCK_DB`·`KR_THEME_MAP`·`AIO_MACRO_CALENDAR`·`AIO_MANUAL_REFERENCE`·채널 allowlist는 관측값이 아니라 구성이다. 게이트: `ci-static-data-contract-check`, `ci-static-db-expiry-check`, `ci-macro-calendar-review-contract-check`.

## R604. 정적 DB는 구성만 보관하고 시점 박힌 수치를 남기지 않는다 (v54.98, P1080)
`KR_THEME_MAP`·`SCREENER_DB`·`KR_STOCK_DB` 같은 정적 DB는 구성(코드·테마 소속·심볼·이름·섹터)만 보관한다. 시총·주도주 서술·가중치·가격 같은 시점 박힌 값은 주석을 포함해 남기지 않고 런타임 산출물로만 채운다. 주석의 수치도 현재값으로 오해되므로 제거 대상이다. 게이트: `ci-static-data-contract-check`.

## R603. 생성물은 고빈도 데이터 refresh가 바꾸는 휘발값을 고정하지 않는다 (v54.98, P1079)
생성된 현재 상태 문서(`_context/CURRENT-STATE.md`)는 매 리비전 byte-current여야 한다는 preflight와, generated workspace state를 고빈도 data promotion commit에 결합하지 않는다는 R595가 같은 값 위에서 충돌해서는 안…

## R581. 발행 상태는 완전한 cycle tuple과 유효한 관측시각에서만 current가 된다 (v54.76 working tree, P1030)
미래 관측은 현재 age 0으로 보정하지 않고 quarantine한다. snapshot `published`, operations freshness와 weekend grace는 Tier-0 full coverage, QG pass, row별 품질/session, news/history cycle 결과를…

## R571. 요청·캐시·수집 시도·실제 관측의 수명주기를 분리한다 (v54.69, P1006~P1009)
캐시는 전체 request identity와 source 시각을 보존한다. stale fallback은 명시적으로 요청하고 live로 승격하지 않는다. circuit은 upstream별 단일 회복 probe를 갖는다. 관측 결측은 0이나 다른 기간의 값으로 합성하지 않는다. 게이트: `ci-proxy-continuity-check`, `ci-data-continuity-check`, `ci-ai-chat-reliability-contract-check` (구 ci-chat-resilience-check 통합).

## R567. 자동 refresh는 producer가 바꾼 모든 readiness와 generated evidence를 같은 커밋에 수렴시킨다 (v54.64, P1001)
**Superseded by R603 (v57.79)**: refresh commits no longer regenerate workspace state (R595/R603).

## R563. 자동 데이터 merge의 마지막 생성물은 current workspace state다 (v54.63, P997)
main을 pull한 뒤 생성물 manifest 충돌이 나면 `node scripts/resolve-generated-conflicts.mjs`와 그것이 출력하는 게이트를 실행하고, `generate-workspace-state --write`는 마지막에 실행한다.

## R562. producer 자동화 상태와 lineage 회귀 계약은 같은 변경에서 이동한다 (v54.63, P996)
데이터 카테고리를 manual에서 scheduled/server-auto로 승격하거나 그 반대로 강등할 때 producer·source registry·runtime inventory만 수정하고 과거 상태를 고정한 headless/CI 기대값을 남겨두지 않는다.

## R561. 공개 주기 데이터는 수동 숫자가 아니라 release-aware producer와 실패 가시성으로 닫는다 (v54.63, P995)
무료 공개 최신치가 있는 항목은 operator-captured 숫자를 정기 pipeline의 truth로 보존하지 않는다. direct official adapter를 우선하고 필요한 relay는 명시적 provenance·bounded timeout·reference-only로 제한한다.

## R560. 병렬 검사에 노출된 generated JSON은 완성본 단위로 원자 교체한다 (v54.63, P994)
다른 gate/runtime이 동시에 읽을 수 있는 생성 JSON은 최종 경로를 직접 truncate-write하지 않는다. 동일 파일시스템·동일 디렉터리의 고유 임시 파일에 완성본을 기록하고 atomic rename으로 교체하며, 실패한 임시 파일은 정리한다.

## R549. 실패 결과는 성공 TTL cache가 아니며 모든 안전 제약은 cache identity다 (v54.62, P983)
aborted/non-2xx/malformed/empty-invalid fetch 결과를 정상 artifact로 장기 캐시하지 않는다.

## R507. Refresh audits distinguish observed, policy-blocked and runtime-derived categories (v54.41, P951)
a public current publisher observation must be audited from its dated artifact and may not be labeled `SKIPPED` merely because it is reference-only. 게이트: `ci-web-research-contract-check`, `ci-data-refresh-audit`.

## R505. Summary-only surfaces consume compact projections, not completion corpora (v54.39, P949)
a page that renders only counts or progress must consume a deterministic compact status projection and may not download article, coverage, claim or dossier monoliths. 게이트: `ci-three-page-artifact-budget-check`.

## R485. Keyless official downloads close critical single-series gaps without relabeling access (v54.22)
When a critical public indicator has an official, keyless, machine-readable download, the scheduled producer should use it as a bounded adapter instead of freezing the… 게이트: `ci-data-pipeline-contract-check`, `ci-source-registry-contract-check`, `ci-data-refresh-audit`.

## R481. Professional data capabilities are promoted only by artifact-backed partial scopes (v54.22)
A critical data gap may move from `BLOCKED` to `PARTIAL` only when its implemented scope, remaining limitation, allowed use, and executable validation gate are all… 게이트: `ci-professional-data-gap-check`, `ci-data-pipeline-contract-check`.

## R480. Every changing or hardcoded data category has a daily-audited source and limitation contract (v54.21)
Every one of the 22 reconciliation categories must declare its cadence, refresh mode, producer, generated artifacts, consuming desktop pages, exact origin URL… 게이트: `ci-source-registry-contract-check`.

## R473. New public-data artifacts require same-change lineage policy registration (v54.13)
Adding a tracked `public-data/*.json` artifact requires adding its explicit policy and timestamp selector to `ci-data-lineage-audit.mjs` in the same change. 게이트: `ci-data-lineage-audit`.

## R462. 다중 공급자 coverage 계약은 partial 상태를 성공·실패 lineage와 함께 보존한다 (v54.4, P907)
요청된 공급자/채널 topology와 이번 실행의 성공률을 분리한다. 모든 요청 행과 source catalog가 존재하고 실패 행에 원인이 있으면 `partial`을 구조적으로 유효한 저하 상태로 인정하되 `ok`로 승격하지 않는다. 게이트: `ci-six-doc-coverage-check`, `ci-atlas-contract-check`.

## R457. 변동 원본 artifact와 파생 인덱스는 producer가 원자적으로 발행하고 실제 Git index에서 검증한다 (v54.2, P902, v56.33 P1204)
자동 갱신 producer가 retained count·revision·collection status를 바꾸면 그 값을 참조하는 요약·인덱스 artifact를 같은 실행에서 재생성하고 같은 커밋에 stage해야 한다. 게이트: `ci-data-continuity-check`, `ci-masters-contract-check`, `ci-data-pipeline-contract-check`.

## R428. Data refresh and release manifests must publish one atomic revision tuple (v53.68, P873)
Any refresh that changes `public-data/market-snapshot.json.revision` must promote that revision, cycle ID, and data timestamp into both… 게이트: `ci-refresh-artifact-integrity-check`, `ci-operations-contract-check`.

## R421. 데이터 refresh 이후 릴리스 SSOT를 같은 revision tuple로 승격한다 (v53.64, P866)
A public-data refresh that changes `market-snapshot.revision` must also update the asset/release manifest `dataRevision` before the next deploy. 게이트: `ci-operations-contract-check`.

## R407. Quote price/change/previous-close fields must share one producer revision (v53.59, P853)
A quote is an atomic envelope. Do not apply a price, percentage, delta, previous close, observation time, or source field independently from a cumulative multi-producer…

## R394. Current-sensitive server prose requires typed metric and source evidence (v53.54, P847)
Automated market analysis must not become public verified prose from status metadata alone.

## R379. SEC refresh queues must rotate untried candidates before retrying known failures (v53.45, P836)
An SEC fundamentals refresh must not let repeatedly unavailable symbols starve eligible symbols that have never been attempted.

## R356. Yahoo chart proxy는 공통 health registry를 통해서만 실행해야 한다 (v53.19, P784)
Yahoo chart proxy attempts must use `_PROXY_REGISTRY` through `fetchViaProxy`; direct proxy arrays in chart-specific callers are prohibited. 게이트: `ci-runtime-contract-check`.

## R355. Durable snapshot은 reference readiness이며 client live enrichment의 outage gate다 (v53.18, P783)
published same-origin market snapshot은 부팅 시 먼저 적용하고 `sourceKind=REFERENCE`, 관측시각, `fb-static`을 유지한다. `_liveData`에 투영돼도 `live:` provenance가 아니면 실시간 개수·현재 시각 배지로 세지 않는다.

## R338. 데이터 artifact lineage는 정책별 timestamp와 반영 commit을 함께 검증하고, 다른 시각을 승격하지 않는다 (v52.96, P710)
live-core quote, incremental official reference, daily history, research horizon, editorial note, and universe reference have different freshness semantics. 게이트: `ci-data-lineage-audit`.

## R335. BLS 공식 macro evidence는 FRED 대체값이 아니라 typed primary producer로 보존한다 (v52.94)
BLS keyless API 값은 FRED 값과 별도의 sourceKind/evidence/series metadata로 보존한다. `releaseAt`은 API가 제공하지 않으면 null이어야 하며, fetch time을 release time으로 승격하지 않는다.

## R334. 데이터 대체 계획은 독립 실행·행 단위 lineage·publish 전 의미 검사로 닫는다 (v52.93, P708 root)
CLI 진입점이나 후보 API 문서만 존재하는 상태를 자동화 완료로 표시하지 않는다. 반복 artifact는 각 행의 관측시각·출처·허용 용도를 보존하고, publish 전에 커버리지·현재성·사용범위를 실행 가능한 validator로 검사한다.

## R333. 핵심 수집 실패는 마지막 정상 산출물을 덮어쓰지 않으며 공급자 가용성과 구현 완료를 분리한다 (v52.92, P707 root)
producer는 핵심 커버리지·스키마·관측시각 게이트를 통과하기 전에 공개 artifact를 쓰지 않는다. 독립 갱신 가능한 데이터군은 전체 파이프라인과 분리한다. 대체 API가 존재한다는 사실을 현재 연결·권리 승인·운영 준비 완료로 표시하지 않는다.
코드 식별자(`dead-code.mjs` keep): `getExternalDependencyAudit`.

## R316. Automated content must pass a publish audit and retain a deterministic fallback/source label (v52.80, P695)
Translation, briefing, and market-analysis output are publish surfaces, not merely chat responses.

## R270. A third-party data source's availability and symbol convention must be live-verified, never assumed from a report or general knowledge — and an integration must be scoped down to only the asset classes actually confirmed (v51.92)

## R262. Scheduled scrapers/fetchers hitting external feeds must self-throttle with a persisted cursor, not stateless full re-scans (v51.83)
Any scheduled fetch script that walks a paginated external feed (especially an unofficial one, like Telegram's public web mirror) must persist a cursor (last-seen…

## R256. Every external data source in the fetch pipeline must track per-unit failures, not just an aggregate ok flag (v51.83)

## R245. Prioritized/boosted content selection must guarantee its picks already ran through required enrichment (v51.82)
If a display surface reorders or filters a list by an importance/boost score, it must not assume the enrichment (translation, scoring, tagging) a normal reader would…

## R235. calcTechnicalSnapshot fields must close producer-consumer-artifact-gate together (v51.71, P548)

## R222. Public-data pipelines require an Actions-to-consumer contract gate (v50.94)
Market/news auto-refresh is complete only when the path is contract-tested end to end: GitHub Actions schedule -> fetch script -> committed `public-data/*.json` artifact… 게이트: `ci-data-pipeline-contract-check`.

## R217. Scheduled data sources must close the collect -> artifact -> consume -> audit loop (v50.63 added, P509 root)

## R196. Trading-use quotes require independent cross-source validation when available (v49.109 added, P472 root)

## R180. 데이터 lineage 5단계 연결 의무 + 자동 audit (v49.89 added, P450 root)

## R162. 외부 fetch 결과 schema 검증 + graceful degrade 의무 (v49.79)

## R156. 외부 fetch 폴백은 첫 번째 '유효한' 결과를 쓰고, 동시 요청은 비용·한도가 허락할 때만 (v49.78; v57.84 개정)
A fallback chain settles on the first *valid* result — a payload that passed validation (shape, finite values, observation time), not merely a fulfilled promise…

## R80. 정적 데이터베이스 메타 의무 — SCREENER_DB_META (v49.31 추가, H1 근본)

## R53. 독립 병렬 fetch는 단일 실패 격리 (v48.69 추가, P143 교훈, 구 R35 → R53 재번호)

## 원칙 C14 — 뉴스와 외부 정성 자료는 출처를 지닌 참고 입력이다

**불변식**: 뉴스·텔레그램·북마크·사용자 제공 자료는 출처·관측 시각·원본 식별을 보존한 참고(REFERENCE) 입력이고, 현재 수치로 승격하지 않는다. 선별은 한 키워드 규칙과 시장 영향 기준을 쓰고, 헤드라인은 발견 근거일 뿐 인과 근거가 아니며, 최소 표본 전에는 분석 결과로 발행하지 않는다.

**게이트**: `scripts/ci-expect-output-check.mjs` · `scripts/ci-data-pipeline-contract-check.mjs` · `scripts/ci-esm-core-unit-check.mjs` · `scripts/ci-reference-adoption-contract-check.mjs`

**정본**: R510 · 규칙 31건 (비활성 0건)

## R730. 뉴스 키워드 목록은 하나의 규칙(keyword-match.js)으로만 비교한다 (v59.42, P2117)
뉴스 채점·토픽·제외·관련성·텔레그램 필터의 키워드 목록은 src/domain/news/keyword-match.js(keywordHit/keywordMatcher/matchedKeywords/countKeywords)로만 비교한다. 게이트: `ci-expect-output-check`, `ci-esm-core-unit-check`.

## R722. 채널 글의 분류·선별은 글이 담은 수치를 기준으로도 판단한다 (v58.71, P1984)
텔레그램 분류 정규식에는 그 주제를 단독으로 가리키는 말만 둔다(통화 단위·기업 행위 일반어 금지). 목표주가·실적·경제지표·순매수 목록처럼 구조화된 수치를 담은 글은 문체와 상관없이 읽기 목록에 남기고, 그 수치는 signals로 따로 게시한다. 게이트: `ci-data-pipeline-contract-check`.

## R702. 뉴스 원본 식별·변경 이력 보존 (v57.33, P1601)
뉴스 중복 제거는 출처·원본 식별자·URL 쿼리·제목·내용·발행 시각·변경 관계가 같은 반복만 제거한다. 제목 유사도는 삭제 근거가 아니다. 사건 묶음은 동일 출처·issuer의 명시 사건 또는 정정 관계로 제한하며 원문 이력을 보존한다. 게이트: `ci-reference-adoption-contract-check`, `ci-reference-adoption-browser-check`.

## R684. 내용 분류의 근거는 본문 텍스트 (v57.28, P1511)
뉴스·게시물의 주제·종목·어조는 제목·본문에서 직접 찾은 근거로만 붙인다. 수집 피드의 주제 이름, 출처명, URL·도메인 텍스트는 분류 근거가 아니며, 적합한 근거가 없으면 기사를 싣지 않거나 태그를 생략한다.

## R638. legacy 뉴스 의사결정 소비자도 공통 최소 표본을 강제한다 (v56.58, P1288)
레거시 뉴스 집계·시장 상태·행동 요약·루프 감사는 모두 `AIO_ARCH.MIN_NEWS_ANALYSIS_SAMPLE`의 단일 기준을 사용한다. bootstrap 값은 compatibility facade가 그대로 전달해야 한다. 게이트: `ci-esm-core-unit-check`.

## R635. 저장 뉴스 점수 이력은 현재 모델의 충분한 표본 증거가 있어야 차트에 남는다 (v56.57, P1285)
localStorage 이력은 앱 버전을 넘어 보존되므로 저장 당시의 점수만으로 현재 분석 정책을 입증하지 않는다. 게이트: `ci-esm-core-unit-check`.

## R633. 뉴스 감성·위험은 최소 표본을 채우기 전 분석 결과로 발행하지 않는다 (v56.56, P1284)
기사 수준 검증을 통과한 항목만 분모로 삼되, 소수 표본은 대표성이 확인된 분석 결과가 아니다. 감성 점수와 위험 신호는 같은 선언된 시간 창의 적격 기사 수가 `MIN_NEWS_ANALYSIS_SAMPLE` 이상일 때만 발행한다. 게이트: `ci-esm-core-unit-check`.

## R554. 헤드라인은 발견 근거이지 기사 수준 분석·인과 근거가 아니다 (v54.63, P988)
본문 또는 의미 있는 요약이 없는 뉴스는 headline-only로 분류하고 AI evidence, 감성 집계, causal market analysis에서 제외한다. 목록 노출은 허용하되 사용 제한과 분석 보류를 사용자에게 표시한다.

## R510. User-supplied market commentary stays reference-only until a producer reconciles it (v54.44, P954)
X posts, screenshots, interviews, estimates, rumors and role-level deal maps may seed durable hypotheses, keywords, chat context and monitoring lenses, but they may not…

## R441. Telegram 다채널 discovery는 source catalog·신선도·실패 상태를 함께 보존한다 (v53.92)
Telegram 채널은 뉴스/자료의 원문이 아닌 secondary discovery 계층이다. 게이트: `ci-data-pipeline-contract-check`, `ci-runtime-contract-check`, `ci-knowledge-lint-check`.

## R440. 참고 자료의 셋업·전력·자료품질 프레임은 관찰용으로만 승격한다 (v53.91)
사용자 제공 자료에서 추출한 상대강도 눌림, 클라이막스 탑, AI 데이터센터 전력 품질, GPU 재가격, 메모리 LTA 주장은 `REFERENCE` 관찰·검증 질문으로만 연결한다. 게이트: `ci-esm-core-unit-check`, `ci-version-check`, `ci-runtime-contract-check`.

## R425. Current news and research lanes are separate (v53.66, P870)
Telegram/news artifacts must publish a rolling `research-14d` window and a separate `kst-0800-completed-24h` lane. 게이트: `ci-data-pipeline-contract-check`.

## R415. Freshness-scoped news models require observable event time (v53.64, P861)
News sentiment and cycle-risk models may include an item only when its publication timestamp is finite, not in the future, and inside the requested freshness window.

## R378. Reference market material must expose reusable chart, behavior, and communication protocols (v53.44, P835)
A source-labelled market-material integration is incomplete if it stores only thesis prose and raw observations.

## R377. 사용자 제공 시장자료는 하나의 REFERENCE 프레임으로 통합하되 현재성 수치와 분리한다 (v53.43, P834)
`/integrate`가 시장 텍스트, 외부 링크, 차트 이미지, 티커 프레임을 반영할 때는 `sourceKind=REFERENCE`, `asOf`, 원문/이미지 식별자, Q1~Q5 추출, 시계열 상태를 보존한다. 게이트: `ci-runtime-contract-check`, `ci-knowledge-lint-check`.

## R339. 증분 정성 피드는 전체 관측 lineage와 capped 소비 payload를 분리하고 현재 narrative를 재생성한다 (v52.97, P711)
Telegram 같은 증분 정성 피드의 `count`는 이번 fetch 수나 capped 본문 배열 길이로 가장하지 않는다. 게이트: `ci-data-pipeline-contract-check`, `ci-runtime-contract-check`.

## R254. External classification tags are not ground truth without independent keyword support, and AI prompts must verify tag-content consistency (v51.83)

## R240. User-supplied trader frameworks must be centralized as REFERENCE, not live levels (v51.77)

## R230. Dynamic news refresh must prove source quality and visible freshness (v51.30, P531 root)
News automation is not complete when RSS items are merely fetched or `public-data/data.json.newsCount` is nonzero. 게이트: `ci-data-pipeline-contract-check`.

## R226. Server news backstop must rank by market impact, not arrival order (v50.98)

## R225. News surfaces must provide Korean market rewrite, not translation-only headlines (v50.97)

## R223. News translation must degrade to Korean insight, not raw English-only context (v50.95)

## R221. Telegram/news auto-refresh must close the ticker memo consumer path (v50.93)

## R215. Telegram/외부 정성 소스는 digest -> 화면 -> 스크리너 -> 채팅 -> 테스트까지 환류해야 한다 (v50.61 added, P507 root)

## R203. News surfaces must use the shared evidence-style surface contract (v50.2 added, P478 root)

## R79. 지정학 시나리오 단일 출처 — GEOPOLITICAL_CONTEXT_REGISTRY (v49.31 추가, H3 근본)

## R22. 뉴스 3곳 계층적 선별 체계 (v40.4 추가, P32)
홈 정적 큐레이션(`HOME_WEEKLY_NEWS`)은 비어 있다. 시장 뉴스는 시간순으로 각 항목 날짜를 보이며, 갱신 주기보다 오래된 항목은 날짜가 붙은 참고로만 둔다.

## R18. 텔레그램 채널 관리 (v39.0 추가, P29)

## R17. 뉴스 키워드 추가 시 길이 제한 (v39.0 추가, P28, v42.1 강화, v42.5 재정의)
3글자 미만 단독 키워드 추가 금지 (오탐 원인 — `'S'` 한 글자로 모든 텍스트 매칭 사고 발생)

## R16. 뉴스 티커 표시 규칙 (v39.0 추가, P30)
매크로/지정학/정책/금리/무역 토픽(`macro`,`geopolitics`,`policy`,`fed`,`rates`,`trade`) 뉴스에는 티커 숨김

## R14. 뉴스 키워드 현행화 (v37.6 추가)

## 원칙 C15 — 지식·학습 자료는 구조와 의미를 따로 인증한다

**불변식**: 학습·지식 corpus는 구조적 완성과 의미 인증을 다른 상태로 둔다. 같은 개념은 레슨·노트·사전·도움말에서 한 정의이고, 지식 그래프·출처·산출물 상태는 실제 소비자와 같은 해석기로 인증하며, 현재 수치 overlay는 교육용 표시를 단다.

**게이트**: `scripts/ci-knowledge-corpus-check.mjs` · `scripts/ci-atlas-contract-check.mjs` · `scripts/ci-atlas-browser-check.mjs` · `scripts/ci-principles-contract-check.mjs` · `scripts/ci-knowledge-generated-parity-check.mjs`

**정본**: R524 · 규칙 30건 (비활성 0건)

## R718. 자동 근거 연결 토큰은 분야 고유어만 (v57.92, P1903)
research-facts.json의 appliesTo에는 그 사실의 분야에서만 쓰이는 토큰을 둔다. yield·quality·policy·memory·model·risk·ai처럼 여러 분야에서 다른 뜻으로 쓰이는 단어는 넣지 않고, 필요하면 글 id(예: memory-wall)를 직접 적는다. 게이트: `ci-review-integrity-unit-check`.

## R688. 같은 개념은 레슨·노트·사전·도움말에서 한 정의 (v57.28, P1515)
정의·부등식·임계값·인과 경로는 한 곳에서 정하고 레슨·노트·용어·도움말·계산이 같은 식을 쓴다. 복합 항목의 구성 용어는 동의어로 표시하지 않으며, 조건에 따라 갈리는 결과는 한 줄 화살표가 아니라 조건별 경로로 그린다.

## R660. Knowledge candidate builders cannot follow symlinks outside their isolated copy (v56.76, P1314)
Before snapshotting, copying, or running any generated-knowledge builder in candidate/parity mode, reject symlinks in the source workspace and the disposable copy with… 게이트: `ci-knowledge-generated-parity-check`, `ci-qa-pipeline-contract-check`.

## R655. Generated knowledge candidates preserve exact provenance and require human review (v56.72, P1310)
When knowledge sources or builder dependencies change, review candidates are built with the existing ordered builder/target inventory inside a disposable checkout. 게이트: `ci-knowledge-generated-parity-check`, `ci-qa-pipeline-contract-check`.

## R651. Generated knowledge builders run before their downstream consumers (v56.68, P1306)
When a registered producer changes an artifact consumed by later builders, execute the producer first and every direct consumer afterward in the same build pass. 게이트: `ci-qa-pipeline-contract-check`, `ci-knowledge-generated-parity-check`.

## R524. Structural knowledge completeness and semantic certification are separate state machines (v54.57, P964)
catalog parity, ontology connectivity, article counts and source-ledger shape may prove structural readiness only. 게이트: `ci-knowledge-lint-check`.

## R509. Learning pages require narrative order, destination consumption and filing-semantic labels (v54.43, P953)
a knowledge page must open on the authored causal story, keep each category explanation readable as a bounded passage, and place detailed maps/evidence behind the… 게이트: `ci-three-page-learning-flow-check`, `ci-three-page-artifact-budget-check`, `ci-masters-contract-check`.

## R508. Rendering, coverage, persistence and publication readiness are separate contracts (v54.42, P952)
a page may report data as complete only when its declared universe, current-period rows and required artifact groups are complete; otherwise it must expose an explicit… 게이트: `ci-masters-contract-check`, `ci-masters-browser-check`, `ci-principles-browser-check` (구 ci-knowledge-route-bridge-contract 통합).

## R503. reference-depth·currentness·provider-review는 서로 다른 승격 단계로 보존한다 (v54.36, P943)
1,200자 이상 원문, semantic field, worked example, dated fact 연결, current-evidence ledger, raw 13F CUSIP 집계는 각각 해당 구조와 출처 연결만 인증한다. 게이트: `ci-knowledge-corpus-check`, `ci-data-refresh-audit` (구 ci-knowledge-web-research-dossier 통합).

## R501. Structured knowledge depth is not human certification (v54.38, P948)
Principles and Atlas may publish structured long-form reference drafts only with an explicit review boundary. 게이트: `ci-knowledge-corpus-check` (구 ci-knowledge-route-bridge-contract 통합).

## R500. Knowledge routes load by route-owned capability and preserve interaction state (v54.38, P948)
heavy knowledge artifacts load only when their tab, search or selected module needs them.

## R496. Dated observations must be scoped to the selected knowledge node (v54.33)
Shared current-observation artifacts may target multiple pages, but a Principles, Atlas foundation, or Atlas relationship consumer must pass its selected… 게이트: `ci-knowledge-corpus-check`, `ci-principles-browser-check`, `ci-atlas-browser-check` (구 ci-knowledge-current-observations-check 통합).

## R495. Learner-first knowledge surfaces use declarative exploration, not quiz prompts (v54.33)
Principles, Atlas, and Masters may retain question-shaped fields in source artifacts for lineage and search, but user-facing pages must not render verification… 게이트: `ci-principles-contract-check`, `ci-atlas-contract-check`, `ci-principles-browser-check`.

## R494. 관측 불가능한 경제변수와 기업 목표는 관계 지도에서도 시점·추정·반증 경계를 보존한다 (v54.25, P937)
중립금리(r*)처럼 직접 관측할 수 없는 변수는 모델·기대값·오차 범위·데이터 vintage 없이 현재 단일값으로 용어집이나 판단층에 고정하지 않는다. 게이트: `ci-atlas-contract-check`, `ci-knowledge-corpus-check` (구 ci-knowledge-currentness-separation 통합, 구 ci-knowledge-article-contract 통합).

## R470. Knowledge research artifacts must preserve completion and currentness boundaries (v54.7)
Coverage inventories, research dossiers, structural domain dossiers and quantitative labs may expose structure and educational calculation only. 게이트: `ci-knowledge-corpus-check`, `ci-service-worker-cache-policy-check` (구 ci-knowledge-full-corpus-coverage 통합, 구 ci-knowledge-web-research-dossier 통합).

## R469. 주식·경제·금융·기술 백과사전은 전체 corpus와 Web Research를 별도 인증한다 (v54.6, P910)
ontology·schema·structured draft·renderer가 존재해도 백과사전 콘텐츠 완료로 판정하지 않는다.

## R468. Knowledge route state and partial capability loading must fail soft (v54.6)
Shareable route state must round-trip without destructive navigation, local learning state must be namespaced and recoverable, and a missing knowledge capability must… 게이트: `ci-knowledge-corpus-check` (구 ci-knowledge-core-semantic-check 통합).

## R467. Structured article drafts cannot be published as completed learning content (v54.6)
Generated article scaffolds must remain `STRUCTURED_REFERENCE_DRAFT` and `EDUCATIONAL_REFERENCE_ONLY` until semantic review, primary-source directness review, retrieval… 게이트: `ci-knowledge-corpus-check` (구 ci-knowledge-article-contract 통합).

## R466. Evidence directness is a claim-level boundary (v54.6)
CONTEXT, DISCOVERY, STRUCTURAL, and REVIEW_REQUIRED evidence cannot be treated as DIRECT support. 게이트: `ci-knowledge-corpus-check` (구 ci-knowledge-core-semantic-check 통합).

## R465. Knowledge graph edge metadata must be explicit before runtime consumption (v54.6)
A knowledge edge may not silently acquire type, direction, condition, or source metadata from a generic default. 게이트: `ci-knowledge-corpus-check` (구 ci-knowledge-core-semantic-check 통합).

## R464. Knowledge concepts require one canonical namespace and explicit overlap equivalence (v54.6)
Principles and Atlas concepts must be published through the canonical knowledge manifest. 게이트: `ci-knowledge-corpus-check` (구 ci-knowledge-ontology-contract 통합).

## R452. 지식 그래프·출처·artifact 상태는 실제 consumer와 같은 해석기로 인증한다 (v53.99, P897)
node/edge/source 개수와 필드 존재만으로 지식 페이지의 구조 연결을 인증하지 않는다. 게이트: `ci-knowledge-corpus-check`, `ci-principles-contract-check`, `ci-atlas-contract-check` (구 ci-knowledge-core-semantic-check 통합).

## R451. 학습 필드 존재와 백과사전급 깊이를 분리해 인증한다 (v53.98, P896)
짧은 definition/mechanism/example 필드가 모두 존재한다는 이유만으로 long-form 또는 백과사전 원고로 판정하지 않는다. 게이트: `ci-atlas-contract-check`, `ci-atlas-browser-check`.

## R438. 학습 지도는 의미 단위별 원고와 기본 공개 흐름을 함께 검증한다 (v53.88, P891)
교육용 지식 그래프는 카드 수나 구조 계약만으로 완료된 것으로 간주하지 않는다. 기본 화면은 대분류→하위 묶음→개념의 학습 순서를 먼저 보여야 하며, 선택한 개념에는 정의·중요성·작동 원리·확인할 지표·앞뒤 연결·실패 조건의 개별 원고가 있어야 한다. 게이트: `ci-principles-contract-check`, `ci-principles-browser-check`, `ci-atlas-browser-check`.

## R435. Reference currentness overlays must remain educational and status-labeled (v53.84, P888)
A source page check or structural player/product mapping cannot be rendered as verified production state, shipment, yield, revenue, or current investment fact.

## R434. Authored reference artifacts require renderer and coverage gates (v53.83, P884-P887)
Adding explanatory content is complete only when the artifact is connected to the route renderer, every required content unit resolves its related node/source IDs, and…

## R433. Educational player/product references require resolved evidence edges (v53.81, P881)
An Atlas player or product record is educational reference data, not a current company claim. 게이트: `ci-atlas-contract-check`, `ci-atlas-browser-check`.

## R432. Domain expansion must preserve publication and normalization boundaries (v53.80, P877)
Adding P1/P2 taxonomy domains or research lessons must extend the user-facing explanation contract and browser count gate without silently promoting current company… 게이트: `ci-atlas-contract-check`, `ci-atlas-browser-check`, `ci-masters-contract-check`.

## R431. Source-document coverage must be measured per content unit (v53.79, P876)
Connecting a route, schema, or aggregate artifact is not equivalent to completing the source document. 게이트: `ci-six-doc-coverage-check`, `ci-atlas-contract-check`, `ci-principles-contract-check`.

## R430. Reference learning surfaces must expose real state and freshness (v53.78, P875)
A reference page must not render a control as functional unless it changes the selected view or explicitly explains why the view is unavailable. 게이트: `ci-masters-contract-check`, `ci-masters-browser-check`, `ci-principles-browser-check`.

## 원칙 C16 — AI는 공용 Worker 한 경로와 근거 계약을 쓴다

**불변식**: 모든 AI는 공용 Worker 한 경로(웹검색 포함 월 $20 예산)를 함께 쓴다. 질문은 QuestionPlan→Evidence→AnswerPlan 하나로 흐르고, 현재 수치는 화면과 같은 기준의 주입 증거에서만 인용하며, 답변은 문장 단위로 걸러 개인화된 매매 지시를 확정하지 않는다.

**게이트**: `scripts/ci-ai-intelligence-contract-check.mjs` · `scripts/ci-ai-chat-reliability-contract-check.mjs` · `scripts/ci-ai-evidence-contract-check.mjs` · `scripts/ci-worker-anthropic-check.mjs`

**정본**: R681 · 핵심: R681 · 규칙 103건 (비활성 6건)

## R698. An AI answer is filtered by sentence, and a personalized directive is never confirmed (v57.30, P1539)
The AI action gate replaces the sentence that is an unmistakable directive and keeps the rest; the prompt forbids confirming a personalized single action whether or not… 게이트: `ci-ai-intelligence-contract-check`.

## R687. AI 문맥의 현재 수치는 화면과 같은 기준 (v57.28, P1514)
AI 답변에 쓰일 현재 시장 수치는 사용자가 보는 화면과 같은 스냅샷·기준일·대상에서 전달한다. 다른 시각의 값은 시각을 붙인 보조로만 넣고, 화면에 없는 산출물(진입가·점수)을 질문 버튼으로 약속하지 않는다.

## R681. All AIO AI shares one metered server credential boundary (v57.06, P1421)
Chat, translation, automated analysis and deployment smoke call only the shared GPT-6 Luna Worker. 게이트: `ci-ai-budget-scope-check`, `ci-worker-anthropic-check`, `ci-data-pipeline-contract-check`.

## R680. Budget scope, reservation and invoice remain distinct (v56.87, P1353)
**Superseded by R681 (v57.79)**: the $20 shared budget, reservation accounting and the single Worker boundary are stated in R681; the direct-key path no longer exists.

## R590. AI decision premise는 common evidence contract의 명시적 사용·권리·revision·freshness를 요구한다 (v54.96, P1068)
`status=verified/current`나 sourceKind만으로 전제를 VERIFIED로 승격하지 않는다.

## R577. AI의 분석·검색·응답은 입력 모양이 아니라 추적 가능한 사용 계약으로 승격한다 (v54.76, P1026)
`null`, blank, boolean, 비유한 값은 금융 숫자가 아니다. 인과 주 사건·대안·교차자산은 같은 관측 시간창과 sourceKind/evidenceId를 가져야 하며 reference/untrusted/unknown은 causal support가 아니다. 게이트: `ci-ai-intelligence-contract-check`, `ci-ai-evidence-contract-check`, `ci-ai-chat-reliability-contract-check` (구 ci-inference-contract-check 통합).

## R566. AI 안전·검색·지식 결손은 답변 전체가 아니라 실제 위험·주장 범위에서만 강등한다 (v54.64, P1000)
매수·매도·손절·비중 같은 어휘 자체를 개인화 행동으로 판정하지 않는다. 교육·조건부 시나리오·시장/규제 영향·법률/세무 분석은 전제·관할·기준일·근거 상태를 표시해 답하며, pre-provider 차단은 개인화 실행·실제 주문/계정 변경·불법 실행법으로 제한한다. 게이트: `ci-ai-intelligence-contract-check`, `ci-ai-chat-reliability-contract-check`, `ci-knowledge-generated-parity-check`.

## R557. 공개 AI 경로와 bootstrap payload는 동일한 readiness·byte evidence에서 생성한다 (v54.63, P991)
실패·stale·비 HTTPS Worker를 정적 설정만으로 공개하지 않는다. 공개 route는 관측된 health에서 생성하고 불확실하면 null/disabled로 단조 강등한다(개인 키 경로 없음).

## R547. AI 행동 권한은 모든 provider·quota·retrieval보다 앞선 단일 오케스트레이터 경계다 (v54.62, P981)
QuestionPlan의 action permission이 denied이면 provider runner를 절대 호출하지 않는다. UI는 안전한 교육·비교 대안만 표시할 수 있으며, 상단 AI 패널의 추가 gate는 단일 경계를 보강할 뿐 대체하지 않는다. 게이트: `ci-ai-intelligence-contract-check`.

## R532. AI quota reservation과 upstream 실행은 하나의 idempotency 경계를 가진다 (v54.59, P969)
동일한 명시 idempotency key는 최대 한 번만 upstream을 호출하고 중복은 호출 전에 거부한다. key가 없는 별도 요청은 body가 같아도 각각 quota를 소비한다. 게이트: `ci-worker-anthropic-check`.

## R497. Public AI chat is certified as a fresh-browser consumer outcome (v54.37, P944)
Public AI is certified only through the shared Worker route: one canonical route contract connects `public-config.json`, boot defaults, readiness, deep health, the… 게이트: `ci-ai-chat-public-route-browser-check`, `ci-ai-chat-reliability-contract-check`, `ci-runtime-contract-check`.

## R463. AI readiness는 저장된 credential이 아니라 실제 선택된 endpoint를 검증한다 (v54.5, P908)
AI readiness uses only the authentication and health of the endpoint the route resolver selected — the shared Worker route; no personal key path exists. 게이트: `ci-ai-chat-reliability-contract-check`.

## R461. 공급자·근거 장애는 답변 전체가 아니라 영향받는 주장 범위만 저하시킨다 (v54.4, P906)
Web Research, 시장 세션, current claim 구조화가 실패해도 불법 실행·mutation·typed claim 불일치가 아니라면 모델의 일반 원리, 기존 검증 근거, 정성 및 조건부 분석을 삭제하지 않는다. 게이트: `ci-ai-intelligence-contract-check`, `ci-runtime-contract-check`.

## R460. 소수 사용자용 금융 안전 경계는 답변 범위와 실제 실행 위험을 분리한다 (v54.4, P905)
옵션, 세법, 규제, 개인화, 어떻게 같은 단일 키워드나 그 조합으로 금융 질문 전체를 차단하지 않는다. 단일 ESM conduct policy가 request mode를 QuestionPlan과 최종 response gate에 함께 제공한다. 게이트: `ci-ai-intelligence-contract-check`.

## R459. Provider 허용 지역은 location hint가 아니라 관할권 실행 증거로 고정한다 (v54.4, P904)
Durable Object locationHint나 Worker placement는 best-effort/ingress 설정이므로 provider outbound 지역 보장으로 인증하지 않는다. 게이트: `ci-worker-anthropic-check`, `ci-operations-contract-check`.

## R458. AI edge Worker는 소스·배포·readiness를 하나의 릴리스 계약으로 닫는다 (v54.3, P903)
`cloudflare-worker-proxy.js`의 로컬 테스트나 Pages 배포만으로 공유 AI를 완료로 판정하지 않는다. 게이트: `ci-worker-anthropic-check`, `ci-operations-contract-check`.

## R456. AI 채팅은 단일 QuestionPlan→Evidence→AnswerPlan 계약으로 종단간 검증한다 (v54.2, P901)
모든 AI 표면은 같은 `QuestionPlan`의 의도·엔티티·현재성·필수 근거로 소스 fan-out과 Research를 결정하고, 모델은 하나의 `AI_ANSWER_PLAN` 계약을 생산한다. 게이트: `ci-ai-intelligence-contract-check`, `ci-ai-chat-reliability-contract-check`, `ci-headless-tests`.

## R453. AI Research는 하나의 실행 결과 계약과 관측된 capability 증거로만 공개한다 (v54.0, P898)
외부 검색 adapter와 단일 상단 AI 패널이 서로 다른 evidence shape·준비 경로·판정 로직을 가져서는 안 된다. 게이트: `ci-ai-intelligence-contract-check`, `ci-ai-chat-reliability-contract-check`, `ci-headless-tests`.

## R445. Worker quota는 atomic reserve/release와 idempotency를 제공해야 하며 legacy KV는 fail-closed다 (v53.96, P895)
KV get→put counter를 production quota authority로 사용하지 않는다. 게이트: `ci-worker-anthropic-check`.

## R444. AI 시장 분석은 claim마다 canonical evidence ID를 가지며 provider 실패도 동일 schema fallback을 낸다 (v53.96, P895)
first-N 뉴스 제목이나 검증되지 않은 oneLine을 게시하지 않는다. 게이트: `ci-data-pipeline-contract-check`.

## R408. AI quota must not imply route capability (v53.59, P855)
AI readiness and quota UI derive only from the shared Worker route's health and budget; no personal credential path exists.

## R405. Partial research results retain their original sub-query identity (v53.58, P852)
`Promise.allSettled` result normalization must retain each fulfilled row's original index before joining `queryId`, purpose, source tier, and content depth.

## R404. Question plans and observation provenance are request-bound (v53.58, P852)
An asynchronous chat request must carry its immutable QuestionPlan in its own request envelope; mutable global plan state is forbidden as a source of truth.

## R403. ResearchDecision/ResearchPlan must be the same evidence gate for every chat surface (v53.58, P852)
In the single top AI panel, REQUIRED current/causal questions must execute the same ResearchPlan and pass the same primary/independent/snippet-free evidence floor before…

## R402. Chat quote evidence must cross the typed-claim boundary without lossy field mapping (v53.57, P851)
The single top AI panel may keep broad educational/framework answers available, but any current numeric quote claim must receive one normalized evidence row with metric…

## R401. Research requirement and research capability must remain separate (v53.56, P850)
A question's `ResearchDecision` must be determined from the question and evidence policy, independently of provider keys, quota, Worker health, or user opt-out. 게이트: `ci-ai-intelligence-contract-check`, `ci-data-refresh-audit`.

## R400. Model benchmark and operations status must not be overstated (v53.55, P849)
A routing corpus score is not live model quality.
**게이트 갱신 (v59.48)**: 인용하던 `src/ai/eval/benchmark.js`·`src/ai/operations/control-plane.js`는 퇴역했다 — 지금은 `ci-ai-intelligence-contract-check`가 라우팅을 사례별로 검사하고, 화면·답변이 benchmark·canary·drift 상태를 주장하지 않는다.

## R398. AI post-processing must inherit the response policy (v53.55, P848)
If the shared AI response gate blocks or cannot validate a response, recommendation, chart, scenario, and other generated cards must not reintroduce actionable meaning…

## R396. Current-sensitive AI answers require MarketSessionEvidence and strict AnswerPlan/ClaimLedger (v53.55, P848)
A current-sensitive numeric answer cannot be displayed from free-form model text.

## R395. AI questions must enter through one typed QuestionPlan/Orchestrator (v53.55, P848)
The single top AI panel may retain legacy UI/provider code only as a guarded compatibility adapter. 게이트: `ci-ai-intelligence-contract-check`.

## R390. AI route readiness must be explicit and fail closed (v53.52, P844)
Chat, briefing, translation and market-analysis entrypoints resolve through the shared Worker route contract; AI readiness and quota UI derive only from that route's…

## R327. Provider/data/output rights, retention, training, redistribution, and region require explicit registry approval (v52.86, P701)
Availability of a provider or data source is not rights approval.
코드 식별자(`dead-code.mjs` keep): `auditAIRightsRegistry`, `getAIRightsRegistry`.

## R326. Tool capabilities are read-only by default and mutation/unknown operations are denied (v52.86, P701)
AI may inspect explicitly registered read-only data only.
코드 식별자(`dead-code.mjs` keep): `auditAIToolCapabilities`, `getAIToolCapabilityRegistry`.

## R325. Human chat claims require signed cross-mode evidence and explicit incomplete states (v52.85, P700)
Chat usability/accessibility claims require screen-reader, keyboard, mobile, novice, expert, and task-completion evidence with evidence ID, signer, and signed timestamp.
코드 식별자(`dead-code.mjs` keep): `evaluateHumanChatCertification`, `getHumanChatCertificationMatrix`.

## R323. AI cache identity, idempotency, and stream completion must be tenant-safe and auditable (v52.84, P699)
Response/context identity must include tenant/session/route/entity/evidence/model/prompt/retriever scope without raw identifier leakage.

## R322. Model releases require replay provenance, approval, canary, and rollback evidence (v52.84, P699)
A model response is replayable only when request/app/data/Worker revision, model, prompt, retriever, validator, evidence snapshot, sampling, and output hash are…
코드 식별자(`dead-code.mjs` keep): `evaluateAIModelRelease`, `replayAIResponseSample`.

## R321. Financial conduct classification must preserve P0, legal-review, and educational states (v52.83, P698)
Conduct policy must classify all matched categories, block executable prohibited conduct at P0, route actionable jurisdictional/legal/tax/regulatory advice to legal…
코드 식별자(`dead-code.mjs` keep): `getFinancialConductPolicy`.

## R320. Retrieval documents require lifecycle metadata and poisoning quarantine before AI use (v52.83, P698)
Imported research is untrusted reference material.

## R319. Conversation state and finance arithmetic must be deterministic, scoped, and auditable (v52.82, P697)
A response may render only for its current session/turn/route/entity. Route/entity changes, cancel, retry, timeout, and trim must invalidate stale ownership.
코드 식별자(`dead-code.mjs` keep): `transitionAIConversationState`, `checkCalculationInvariant`, `runApprovedCalculation`.

## R318. AI operations and release claims require measured SLO, deterministic benchmark, and manifest-linked feedback (v52.81, P696)
Provider usage, latency, token/cost, quota, model A/B, and user feedback must be observable through bounded local contracts.
코드 식별자(`dead-code.mjs` keep): `getAISLOReport`, `runAIGoldenBenchmark`, `evaluateAIGoldenABGate`.

## R317. AI page context contracts must be projected from the existing page registry (v52.80, P695)
Every route must declare required/optional/forbidden AI data, beginner/expert answer modes, decision policy, and explicit disabled-state behavior.

## R315. Personalized financial action permission must be evaluated once at the shared response boundary (v52.79, P694)
**Superseded by R698 (v57.79)**: personalized trade instructions are always denied; the shared boundary may present choices with opportunity cost and evidence only (R698 states this supersession).

## R314. External AI inputs must be explicitly untrusted and portfolio data must be allowlisted (v52.79, P694)
News, Telegram, web-search, and translation-source text are data, not instructions.

## R313. AI reference retrieval must be intent-aware, top-k bounded, source-separated, and deterministically compacted (v52.78, P693)
Imported research is `REFERENCE` material, not current market evidence.
코드 식별자(`dead-code.mjs` keep): `classifyAIQueryIntent`.

## R312. Structured current-sensitive AI claims must preserve typed Evidence identity and fail closed on mismatch (v52.77, P692)
A model-generated current-sensitive claim is not publishable merely because it contains a number.

## R311. 공개 AI의 모든 진입점은 동일 요청 envelope·응답 pipeline·validator/block-policy 버전을 기록하고 retry는 같은 completion contract를 재사용한다 (v52.76, P691)
상단 AI 패널/retry/translation/briefing/server-analysis는 `_aioCreateAIRequestObject`와 `_aioRunAIResponsePipeline`을 공유한다.

## R310. 공개 AI는 렌더 경계까지 베타·교육/리서치 보조 정책을 강제하고, 검증되지 않은 자동 문장을 공개하지 않는다 (v52.75, P690)
공개 AI 표면은 `AI 도우미 · 교육/리서치 보조`로 식별해야 하며, 독립 투자자문·검증 시스템·실시간 주문 도구처럼 보이는 문구를 사용하지 않는다. 게이트: `ci-runtime-contract-check`.

## R286. AI chat key gates must test the effective Claude route, not only the personal-key field (v52.30, P645 root)
**Superseded by R463 (v57.79)**: readiness verifies the endpoint the resolver selected; no personal-key field exists.

## R214. AI 채팅은 AIO 전용 통합 답변 계약까지 주입해야 한다 (v50.60 added, P506 root)

## R213. AI 채팅 데이터 기능은 자연어 라우팅과 출처 레지스트리까지 연결해야 한다 (v50.59 added, P505 root)

## R212. AI 채팅 정확성 가드는 사용자 의도별로 적용하고 답변력을 억제하지 않는다 (v50.58 added, P504 root)

## R211. 넓은 AI 종목 추천은 분산 후보군을 먼저 만들고 반복 앵커를 감점 (v50.57 added, P503 root)
Broad AI stock questions return a diversified, evidence-labelled candidate list for the user to research, never a recommendation.

## R193. AI chat must vary answer structure by intent and use only injected current data for current claims (v49.106 added, P469 root)

## R192. `forceFresh` for AI stock answers must bypass every local freshness shortcut (v49.105 added, P468 root)

## R191. AI 채팅의 종목 답변은 strict preflight 후 최신 시세/기업 데이터 블록만 인용한다 (v49.104 added, P467 root)

## R183. WebSearch 수치는 지표별 정상 band 검증 후 수용 (v49.92 added, P453 root)
Web-search figures may be cited as text with their source and date, but never feed scores, tables or charts.

## R176. AI 답변 시각 자료 의무 (v49.83)
답변 종목 detect 시 30일 mini sparkline SVG 자동 인라인 삽입. `_aioBuildSparklineSvg` 활용. 양수 green / 음수 red. 최대 3 종목.

## R174. AI 답변 정량 비율 측정 의무 (v49.83)
Answer quality is measured by typed claim/evidence coverage (R456), not by numeric-token ratio. 이력: 채팅 답변에서 정량 토큰 비율 7%+ 권장.

## R164. Claude API 호출 토큰 사용량 누적 추적 + 비용 가시화 의무 (v49.79)
**Superseded by R681 (v57.79)**: AI cost is the shared Worker budget ledger for gpt-6-luna, not a client token counter.

## R158. chatSend atomic streaming lock — 입력 검증 통과 직후 즉시 (v49.78)

## R155. 데이터 ✗ / 환각 검출 시 답변 위 액션 버튼 배너 의무 (v49.77)

## R154. callSharedAi 최종 실패 시 friendly 안내 + 자가 진단 가이드 (v49.77; v59.48 callClaude→callSharedAi)
AI 호출(`callSharedAi`, v57.81에 `callClaude`에서 개명)이 최종 실패하면 이유와 자가 진단 안내를 보인다.

## R153. chatSend silent return 모든 경로 사용자 피드백 의무 (v49.77)

## R151. 시세 데이터 ✗ 시 답변에 가격 수치 절대 금지 — HARD STOP (v49.76)

## R150. AI 답변에 등장한 날짜 토큰은 세션 시각 대비 stale 자동 검출 (Pattern D 일반화) (v49.75)

## R148. ABSOLUTE RULES는 system prompt 정의 + 답변 후처리 양쪽 의무 (Pattern B 일반화) (v49.75)

## R147. CHAT_CONTEXTS 등록은 DOM 패널과 항상 쌍 (Pattern A 일반화) (v49.75)
**Superseded by R317 (v57.79)**: route AI context is projected from AIO_PAGE_CONTRACTS and the page registry.

## R145. AI 답변에 학습 데이터 자기 인용 + 시점 환각 절대 금지 (v49.74 hotfix)

## R144. AI 채팅 멀티턴 윈도잉 + 요약 prepend 의무 (v49.74)

## R143. AI 답변 품질 audit는 8화면 전체 평가 의무 (한국 섹션 포함) (v49.74; v59.48 제목 갱신)
AI 답변 품질은 한국 섹션을 포함한 8화면 전체에서 평가한다 옛 제목의 11 페이지는 8화면 이전 구조다.

## R142. 모든 정량 인용 시 (출처 · 기준일) 괄호 필수 (v49.73)

## R141. AI 답변 표준 4 구조 강제 (결론/정량/시나리오/액션) (v49.73)
AI answers follow 결론 / 근거 / 시나리오(조건→결과) / 선택지와 기회비용; there is no 액션 section.

## R140. AI 답변에서 정성 표현 사용 시 정량 근거 1개 이상 괄호 동반 의무 (v49.73)

## R139. AI 채팅 답변에 종목 detect 시 "📊 차트 보기" 버튼 자동 삽입 의무 (v49.72)

## R134. AI 채팅 데이터 다운로드 + 금액/% 시뮬레이션 의무 (v49.70 추가, P373~P374 근본)

## R133. AI 채팅 알람/임계값 트리거 의무 (v49.70 추가, P372 근본)

## R132. AI 채팅 사용자 투자 프로필 메모리 의무 (v49.70 추가, P371 근본)

## R130. AI 채팅 자동 페이지 이동 + 포트폴리오 동적 시뮬레이션 의무 (v49.69 추가, P366~P367 근본)

## R129. AI 채팅 후속 질문 자동 제안 의무 (v49.69 추가, P365 근본)

## R128. AI 채팅 시각 단서 표준 + 데이터 소스 우선순위 + 출처 타임스탬프 (v49.68 추가, P361~P363 근본)

## R127. AI 채팅 Bull/Base/Bear 3 시나리오 분기 강제 (v49.68 추가, P361 근본)
**Superseded by R676 (v57.79)**: AGENTS.md (No grades or trade instructions) defines scenarios as branches from upcoming official events with cause→effect chains, not a fixed Bull/Base/Bear template.

## R126. AI 채팅 기관급 분석 프레임워크 8개 인용 의무 (v49.68 추가, P360 근본)

## R122. AI 채팅 사용자 체감 품질 의무 (v49.67 추가, P352~P356 근본)

## R121. AI 채팅 시스템 정의-호출 정합 의무 (v49.66 추가, P348~P351 근본)

## R117. dataConfidence:low 분야 환각 차단 알림 의무 (v49.65 추가, P340 근본)

## R112. 모든 CHAT_CONTEXTS는 _getChatRules() 호출 의무 (v49.59 추가, P327 근본)

## R110. signal/breadth/sentiment context는 라이브 수치 자동 주입 의무 (v49.59 추가, P324 근본)

## R107. 채팅 fetch는 반드시 Promise.allSettled + 개별 timeout 의무 (v49.58 추가, P321 근본)

## R106. 새 페이지 CHAT_CONTEXTS 신규 시 window._currentXxxId 자동 주입 의무 (v49.58 추가, P319 근본)

## R105. 테마 페이지 진입 시 채팅 컨텍스트에 활성 테마 ticker 라이브 가격 주입 의무 (v49.57 추가, P316/P317 근본)

## R104. _fetchTickerDataForChat 신규 fetch 추가 시 ABSOLUTE RULES 동기 확장 의무 (v49.57 추가, P317 근본)

## R90. 종목 정성 분석 출처 의무 — ANALYSIS_FRAMEWORK_REGISTRY (v49.34 추가, 사용자 지적)

## R89. AI 채팅 응답 자동 검증 통합 의무 (v49.33 추가, P269 근본)

## R86. 환각 패턴 자동 탐지 + 의심 점수 (v49.32 추가, P264 보강)

## R84. System 프롬프트 정량 수치 화이트리스트 (v49.32 추가, P262 근본)

## R83. 채팅 응답 post-hoc 가격 검증 의무 (v49.32 추가, P264 근본)

## R82. AI 채팅 가격 fetch 실패 시 Hard Guard 의무 (v49.32 추가, P263 근본)

## R40. CHAT_CONTEXTS system() = persona + 메서드론만 (v48.55 추가)

## R39. extractTickers → UI 노출 경로 필수 페어링 (v48.55 추가, P116/P121/P122/P125 교훈)

## R35. 신규 페이지 → CHAT_CONTEXTS 동시 생성 (v48.54 추가, P106 교훈)

## R29. AI 채팅 데이터 검증 태그 (v46.5 추가)

## R13. CHAT_CONTEXTS 이원화 필수 (v37.5 추가)

## R6. LLM 응답 렌더링 안전장치

## 원칙 C17 — 운영·배포·보안은 증거로 닫힌 쪽에 선다

**불변식**: 배포는 정확한 CI 증거(SHA)와 롤백 대상이 있어야 하고, 운영 상태는 주장하는 능력의 실제 증거에서 파생하며, 알림은 증거를 남기고 닫힌 쪽으로 실패한다. 외부 텍스트는 입구에서 이스케이프하고 비밀·자격증명은 등록된 경로로만 다룬다. 워크플로 job은 실행 상한과 명시적 체인을 가진다.

**게이트**: `scripts/ci-operations-contract-check.mjs` · `scripts/ci-cloudflare-deployment-contract-check.mjs` · `scripts/ci-operator-secrets-contract-check.mjs` · `scripts/ci-csp-ratchet-check.mjs` · `scripts/ci-live-invariant-check.mjs`

**정본**: R652 · 핵심: R652, R657, R701 · 규칙 71건 (비활성 5건)

## R729. 격리 레인의 크기 예산은 레인 안에서 검사 (v58.81, P2093)
refresh 워크플로에서 continue-on-error로 격리된 레인이 쓰는 산출물의 크기·계약 검사는 그 레인 단계 안에서 실행한다. 뒤쪽 공용 게이트에서만 잡히면 한 레인의 초과가 시장 데이터 공개 전체를 막는다(P2093). 게이트: `ci-artifact-size-headroom-check`.

## R721. 보조 레인 실패는 그 레인만 격리하고, 데이터 전용 커밋은 데이터 검사로 인증한다 (v58.70, P1983)
데이터 산출물 검사 중 뉴스·AI 해설·거시 신선도처럼 하나의 레인에 속한 항목은 레인을 붙이고, 실패하면 그 레인만 직전 게시본으로 되돌리거나 표시하고 data.meta.laneQuarantine과 해당 화면(뉴스 '갱신 보류 · 마지막 수집', AI 해설 '직전 검증본')에 낡음을 밝힌 뒤 나머지를… 게이트: `ci-data-pipeline-contract-check`, `ci-artifact-semantics-check`, `ci-qa-pipeline-contract-check`.

## R701. 운영 게이트와 전체 건강 상태 분리 (v57.32, P1596)
blocking gate PASS를 전체 서비스 정상으로 승격하지 않는다. 선택 소스/AI 저하, 예약 실행 관측 누락은 DEGRADED로 기록하고 구체적 원인과 관측 시각을 보존한다. 요청 접수·작업 완료·장기 SLO 인증은 별도 증거로 판단한다. 게이트: `ci-data-pipeline-contract-check`, `ci-external-pipeline-check`.

## R691. A newer main is stale for a Worker plane only when it changes that plane's deployment inputs (v57.30, P1520)
Worker deploy workflows judge a newer main per plane: equal to the tested SHA, or a descendant whose changed paths leave the plane's deployment inputs and the deploy… 게이트: `ci-cloudflare-deployment-contract-check`.

## R678. Financial security follows purpose and asynchronous lifetime (v56.87, P1350)
Positions, ledger and FX declarations share authentication, encryption, storage selection, lock invalidation and reload restoration. 게이트: `ci-portfolio-vault-e2e`, `ci-esm-core-unit-check`.

## R674. Privileged workflow_run deploys act only on pushes to this repository (v56.83, P1334)
A workflow_run-triggered job that holds deploy secrets must require the triggering run to be a push event from this repository (not only a branch name) in its job… 게이트: `ci-cloudflare-deployment-contract-check`.

## R661. A personal-data export carries every personal section, or says what it omits (v56.77, P1316)
Portfolio backup/export must include every personal section the app stores in the browser — positions, account ledger, FX legs, cash, declared assumptions, trade journal… 게이트: `ci-esm-core-unit-check`, `ci-portfolio-vault-e2e`.

## R659. Operator alert collectors preserve source, market, and privacy boundaries (v56.75, P1313)
Scheduled alert collectors must fetch only deployed public site/core artifacts and the protected AI usage endpoint when the separate operator token is present. 게이트: `ci-operations-alert-source-check`, `ci-qa-pipeline-contract-check`.

## R658. Operator AI usage evidence stays authenticated and private (v56.74, P1312)
The current UTC-day shared-Worker AI request count may be read only from the US quota Durable Object through `GET /_ops/ai-usage` with a separate `AIO_OPERATOR_TOKEN` of… 게이트: `ci-worker-anthropic-check`, `ci-worker-relay-check`, `ci-cloudflare-deployment-contract-check`.

## R657. Operator alerts preserve explicit evidence and fail closed (v56.73, P1311)
Evaluate a site outage only from explicit availability evidence and its continuous outage-start time; never infer one from deployment age. 게이트: `ci-operations-alert-policy-check`, `ci-qa-pipeline-contract-check`.

## R653. Worker auto-deploy must recover coalesced changes from the live source SHA (v56.70, P1308)
Main CI attestation explicitly uploads its hidden `.release` file. Each Worker change scope includes its complete local runtime import graph. 게이트: `ci-cloudflare-deployment-contract-check`.

## R652. Worker auto-deploys require exact CI evidence and a verified rollback target (v56.69, P1307)
A Worker source/config change may auto-deploy only from its exact successful main CI attestation. 게이트: `ci-cloudflare-deployment-contract-check`, `ci-data-plane-contract-check`.

## R627. 선언된 자격증명·기능은 도달 가능한 경로가 증명되기 전까지 제공된 것으로 취급하지 않는다 (v56, P1151~P1155)
목록에 있다는 사실은 동작의 증거가 아니다. (1) 사용자에게 보이는 자격증명 입력란·설정 토글은 그 값을 실제로 읽어 쓰는 런타임 경로와 짝을 이뤄야 하고, 경로가 브라우저에서 도달 불가(CORS·허용목록·필터 미통과)하면 입력란을 두지 않거나 경로를 만든다. 게이트: `ci-worker-relay-check`, `ci-fast-plane-consumer-gate`, `ci-operator-secrets-contract-check`.

## R621. 프리캐시는 부트 필수분만, 나머지는 요청 기반 런타임 캐시다 (v55.15, P1134)
서비스 워커가 `cache.addAll`로 원자적으로 설치하는 목록은 모든 라우트가 부팅에 실제로 필요로 하는 파일로 한정한다. 게이트: `ci-service-worker-cache-policy-check`, `ci-release-revision-check`.

## R617. 사설 도구의 경계는 결과를 막지 않고 밝힌다 (v55.05, P1120~P1122)
차단(block)은 반증 가능한 오류에만 쓴다. 그 밖의 경계는 결과를 유지한 채 이름을 붙인다(disclosure). 게이트: `ci-ai-intelligence-contract-check`, `ci-runtime-contract-check`, `ci-data-pipeline-contract-check`.

## R612. 운영자 프로비저닝 경계는 문서-계약으로 검사한다 (v54.99, P1089)
워크플로가 참조하는 모든 `secrets.*`/`vars.*`는 운영자 런북(`_context/OPERATOR-RUNBOOK.md`)에 이름·용도·결손 시 결과가 문서화되어야 하고, 그 일치를 CI가 검사한다. 수동 전용 배포 워크플로는 워크플로와 문서가 함께 움직여야 하며 한쪽만 바뀌면 실패한다. 게이트: `ci-operator-secrets-contract-check`.

## R610. 진단·요약 스텝은 셸 확장을 거치지 않는 파일에서 실행한다 (v54.99, P1083)
워크플로 스텝에서 JS 템플릿 리터럴(`${...}`)을 `node -e "..."`로 넘기지 않는다. bash가 `node` 실행 전에 확장을 시도해 스텝이 죽고, 그 결과 실패 상세가 Step Summary에 남지 않아 운영자가 원인을 파악할 수 없다. 게이트: `ci-qa-pipeline-contract-check`.

## R609. 레인 격리는 진단을 위한 것이고, 발행 경계는 fail-closed로 유지한다 (v54.99, P1085)
하나의 프로듀서 레인 실패가 다른 레인의 실행·게이트·요약·수렴을 스킵시키지 않도록 각 레인과 후속 검증을 `!cancelled()`로 실행한다. 그러나 발행(커밋·푸시)은 모든 프로듀서 레인이 성공했거나 정당하게 스킵됐을 때만 수행한다. 게이트: `ci-qa-pipeline-contract-check`.

## R607. 모든 워크플로 job은 실행 상한을 선언한다 (v54.99, P1088)
GitHub Actions job에 `timeout-minutes`를 선언한다. 기본 상한 360분은 행 걸린 fetch·install이 러너를 점유하게 두고, 같은 `concurrency` 그룹을 공유하는 스케줄 워크플로에서는 이후 주기를 직렬로 막아 데이터가 조용히 멈추는 경로가 된다. 게이트: `ci-qa-pipeline-contract-check`.

## R606. 봇이 유발한 이벤트는 워크플로 체인을 잇지 못한다 — 수렴을 명시적으로 구동한다 (v54.99, P1087)
기본 `GITHUB_TOKEN`으로 만든 `workflow_dispatch` 실행은 `workflow_run` 이벤트를 발생시키지 않는다. 따라서 "봇 커밋 → CI 검증 → attestation → Pages 배포"는 봇 경로에서 자동으로 성립하지 않는다. 게이트: `ci-qa-pipeline-contract-check`.

## R595. Refresh producer는 push 전 fail-closed gate와 exact-SHA attestation을 함께 요구한다 (v54.96, P1073)
data/screener producer workflow는 commit/push 전에 해당 artifact·continuity·ownership 계약을 `continue-on-error` 없이 통과시켜야 한다.

## R593. 운영 실패 알림은 signature·failed gate·notification budget을 보존한다 (v54.96, P1071)
동일 workflow와 동일 failure signature의 연속 실패는 durable issue body를 갱신하되 매번 댓글·알림을 만들지 않는다.

## R592. fast data plane은 no-op publish와 liveness write를 분리하고 KV budget을 계약화한다 (v54.96, P1069)
같은 snapshot revision은 `quotes:current`를 다시 쓰지 않는다.

## R546. 운영 알림 임계값·dedupe·복구 증거는 같은 workflow identity로 수렴한다 (v54.61, P980)
SLO에 선언한 연속 실패 임계값과 실제 이슈 생성 시점은 같아야 한다. workflow별 marker는 정확히 하나의 durable issue를 소유하고 반복 실패는 갱신, 성공은 종료한다. 게이트: `ci-operations-slo-window-check`, `ci-workspace-contract-check`.

## R540. 비ASCII 민감정보 단위는 ASCII `\b` 경계에 의존하지 않는다 (v54.59, P974)
한국어 수량·화폐·식별자 등 비ASCII 토큰을 redaction할 때 JavaScript `\b`를 토큰 끝 경계로 가정하지 않는다. 언어별 실제 입력 fixture에서 원문이 사라지고 정책 marker만 남는지 검증하며, 테스트를 통과시키기 위해 민감정보 기대값을 완화하지 않는다.

## R538. Service worker 설치는 작은 핵심 셸만 원자적으로 precache한다 (v54.59, P972)
**Superseded by R621 (v57.79)**: R621 states the same boot-critical precache boundary and its 1..12 gate.

## R536. Pages는 CI가 발행한 불변 SHA attestation만 배포한다 (v54.59, P973)
Pages workflow는 mutable `head_branch`나 동일 버전 비교로 checkout 대상을 정하지 않는다. 게이트: `ci-qa-pipeline-contract-check`.

## R531. 민감 로컬 보존은 기본 OFF·최소화·암호화 정확성을 요구한다 (v54.59, P968)
chat history는 opt-in 전 저장하지 않고 저장 전 민감정보를 redaction하며 비활성화 시 기존 row를 삭제한다. 동의 wrapper나 versioned JSON repository를 Vault라 부르지 않는다. 게이트: `ci-portfolio-vault-e2e`, `ci-storage-migration-check`.

## R528. Cloudflare 배포는 수동 권한·직렬 ownership·관측·smoke를 함께 가진다 (v54.58, P965)
**Superseded by R652 (v57.79)**: Workers auto-deploy from the exact CI attestation with a verified rollback target (R652/R653); manual dispatch remains an operator path only.

## R527. Endpoint 구성과 현재 운영 증거는 같은 파일에 저장하지 않는다 (v54.58, P965)
`architecture/worker-endpoints.json`에는 endpoint·role·secret 요구사항만 둔다. 게이트: `ci-external-pipeline-check`.

## R526. 앱 릴리스와 데이터-only 릴리스는 검증·checkout 경계를 공유하지 않는다 (v54.58, P965)
**Superseded by R536/P973 (v54.59)**: version-equality + mutable branch 방식은 같은 버전의 다른 내용을 증명하지 못하므로 폐기됐다. 앱과 data refresh 모두 정확한 commit SHA를 CI에 전달하고 CI attestation을 거쳐 Pages가 같은 SHA만 배포한다. Data refresh는 origin별 관련 shard만 실행해 범위를 줄이되 direct Pages 우회 경로를 갖지 않는다.

## R489. Playwright workflow steps inherit an explicit browser-install prerequisite (v54.22)
Every CI step that launches Playwright must run in a job that installs the matching browser executable first.

## R482. Runtime-imported modules must enter the service-worker shell in the same change (v54.22)
Any JavaScript module imported by the deployed static application must be added to `sw.js` `SHELL_ASSETS` in the same change. 게이트: `ci-architecture-contract-check`.

## R450. CSP·decomposition·operations gates는 local PASS와 live certification을 분리한다 (v53.96, P895)
dynamic sink baseline은 ratchet-only로 관리하고 `_headers` 파일 존재만으로 edge 적용을 주장하지 않는다.

## R429. Operations status must derive from the capability it claims (v53.68, P874)
Scheduled AI readiness and last-call status must be derived from `data.meta.marketAnalysisOk`, not from durable market-snapshot publication. 게이트: `ci-operations-status-check`.

## R418. Worker reachability, capability, and soak are separate operations states (v53.64, P863)
A deployed Worker URL and one successful health response prove reachability only. 게이트: `ci-fast-plane-live-check`.

## R410. Public readiness must mirror measured boot-performance status (v53.60, P857)
When `architecture/operations-slo.json.latestMeasuredBoot.status` is not `TARGET_COMPLIANT`, `architecture/public-readiness.json` must expose `boot-performance: BLOCKED`… 게이트: `ci-operations-contract-check`.

## R409. Release data revisions must match the published snapshot (v53.59, P856)
`architecture/asset-manifest.json`, `architecture/release-manifest.json`, and `public-data/operations-status.json` must all equal…

## R391. AI/data operations must expose five readiness dimensions (v53.52, P844)
Operations status must separately report secret configured, workflow wired, last call succeeded, data current, and licensed for use; durable scheduled analysis and… 게이트: `ci-ai-chat-reliability-contract-check`.

## R389. Credential persistence must be registry-backed and readback-proven (v53.52, P844)
Provider credentials must use one registry and one save/remove path that returns an explicit result, validates format, performs write/readback verification, and never… 게이트: `ci-ai-chat-reliability-contract-check`.

## R388. Capability claims must be manifest-backed and fail closed (v53.51, P842)
Guide, metadata, and education copy must not imply current/live/automatic/AI-backed behavior or direct action beyond the declared capability status, evidence, and… 게이트: `ci-capability-claim-contract-check`.

## R387. Operational and public-readiness claims must remain revisioned and operator-explicit (v53.51, P843)
Repository evidence, live certification, and operator review are separate states. 게이트: `ci-operations-contract-check`.

## R384. Vault ciphertext must be versioned and migrate legacy KDF values (v53.49, P840)
Every new Vault ciphertext must carry an explicit envelope version and use the current KDF parameters. 게이트: `ci-portfolio-vault-e2e`.

## R380. Fast-plane deploy smoke must distinguish bootstrap from failure (v53.46, P837)
A newly deployed KV-only Worker may have no `quotes:current` snapshot until its first scheduled run.

## R376. Cloudflare fast quote plane의 R2는 승인된 optional durability layer이며 KV-only 배포에서는 R2 binding/secret을 요구하지 않는다 (v53.42, P833)
운영자가 카드 등록 없이 fast quote plane을 사용하기로 선택한 경우 Worker는 KV의 `quotes:current`와 `quotes:heartbeat`만으로 동작해야 한다. 게이트: `ci-data-plane-contract-check`.

## R354. 서비스워커 버전 표시는 현재 controller 전환을 따라야 한다 (v53.18, P782)
SW 설치/대기 버전을 활성 controller로 오인하지 않는다. `controllerchange`마다 `GET_VERSION`을 다시 실행하고 mismatch 진단을 재평가한다. SW 등록은 script cache를 우회해 update를 확인하되 자동 reload loop를 만들지 않는다.

## R349. Workflow module heredocs require an ESM runtime-import contract (v53.12, P733)
A workflow heredoc run with `node --input-type=module -` must use ESM imports throughout; do not leave `require()` in module-mode code. 게이트: `ci-data-pipeline-contract-check`.

## R348. Workflow heredocs must declare the same Node module mode that their source syntax requires (v53.11, P732)
A workflow heredoc containing `import` or top-level `await` is an ESM program. 게이트: `ci-data-pipeline-contract-check`, `ci-control-char-check`.

## R347. Durable and fast data planes must expose independent revisions and fail closed until operator SLO evidence exists (v53.11, AR-07)
A GitHub Actions durable artifact is not proof that an independent fast plane, provider rights, or a 7-day freshness SLO exists. 게이트: `ci-market-snapshot-contract-check`, `ci-data-plane-contract-check`, `ci-operations-status-check` (구 ci-inference-contract-check 통합).

## R295. A special-purpose route added to a shared edge proxy must pass through the same defenses as every other route on that proxy — a new route is a new perimeter, not an exception to the old one (v52.47, WO-1B/P662 root)
When a new route is added to an existing edge/CORS proxy (e.g. 게이트: `ci-worker-anthropic-check`, `ci-runtime-contract-check`.

## R294. A security/encryption UI claim and a lock gate are two separate things to verify — a settings screen existing is not proof its protection is wired into the actual read path (v52.46, WO-1A/P661 root)
When a feature claims a security property in its UI copy (e.g.

## R293. Every workflow YAML must be hard-gated for control-character corruption and parseability; other bot-written text gets a baseline-tracked regression gate (v52.45, WO-0/P660 root)
An automated "WIP auto-save" commit bot that writes Korean (or any non-ASCII) text into files can silently mojibake-corrupt that text — inserting genuine C0/C1 control… 게이트: `ci-control-char-check`.

## R292. A client-side call routed through a region-unpinned shared edge proxy must auto-retry on the provider's own regional-block error signature, not just report it (v52.44, B8/P659 root)
**Superseded (v57.84)**: P1421 already made paid AI transport a single attempt (no blind retry; T887 `paid_transport_no_blind_retry`), so the auto-retry prescription below is history. Retrying until anycast lands on a permitted edge is not a compliance answer to a provider's regional policy; the legitimate fix is Worker placement (operator: Smart Placement or a placement hint). What remains current: a regional 403 is classified only from the provider's region/country/territory signature, never from a bare 'forbidden' or the Worker's own origin/token errors (`normalizeAiError`, Group92 cases), and the user sees a retry hint, not an automatic retry.

## R290. Live-deployed invariants must be re-verified on a schedule independent of new commits (v52.38, P653 root)
A postmortem whose root cause was only reproducible against the deployed site — not by re-running local source gates against the checked-out repository — must add a… 게이트: `ci-live-invariant-check`, `ci-runtime-contract-check`, `ci-structural-check`.

## R285. Operational health labels and feed quality gates must distinguish sources and use accumulated evidence (v52.29, P644 root)

## R278. A `workflow_run`-triggered job that needs the commit its trigger produced must checkout `head_branch`, not `head_sha` (v52.5)
**Superseded by R536 (v57.79)**: refresh jobs dispatch the exact produced SHA to CI and Pages deploys only the attested SHA; `head_branch` introduced a mutable-branch race. The text below is the historical failure explanation.

## R277. An external deploy/publish action known to fail transiently must retry once in the same job, not rely on the next scheduled cycle to self-heal (v52.4)

## R272. A bot/Action-authored push using the default `GITHUB_TOKEN` never triggers other `on: push` workflows — chain via `workflow_run` instead, not `[skip ci]` removal alone (v51.95)

## R264. An API key in a URL must never be routed through a third-party proxy; a "sensitive URL" guard must block the egress, not just caching (v51.85)

## R263. Every producer of deployable artifacts must actually trigger the deploy path, and the watchdog must verify the DEPLOYED surface, not just the repo (v51.84)

## R257. Persisted-and-later-rendered free text needs both input-boundary validation and escaped render (v51.83)

## R255. Automated workflows pushing to a shared branch must rebase/retry on rejection, never push-once-and-drop (v51.83)

## R249. Externally-sourced text must be escaped at the pipeline entry point, not at each render call site (v51.83)

## R248. Deployment must be wired to the CI gate, not merely run alongside it (v51.82)
If a CI workflow exists specifically to catch bad states before they reach users, the deployment mechanism must actually depend on it (e.g.

## R229. Scheduled workflow embedded scripts must be syntax-gated (v51.30, P530)

## R218. Runtime contract / share readiness gate is mandatory (v50.79)

## R167. innerHTML 삽입 시 모든 사용자/외부 변수에 escHtml() 의무 + 정규식 메타문자 이스케이프 (v49.81 added, P433~P435 root prevention)

## R157. innerHTML 호출 전 _aioSafeMD fallback chain 의무 (v49.78)

## R99. SW SHELL_ASSETS 자산 무결성 자동 검증 (v49.44 추가, P310 근본)

## R52. 외부 CDN 스크립트 SRI 의무 (v48.69 추가, P140 교훈, 구 R34 → R52 재번호)

## R31. innerHTML XSS 전수 점검 (v46.8 추가, P100 교훈)

## 원칙 C18 — 퇴역한 기능은 흔적 없이 걷어낸다

**불변식**: 퇴역 기능은 inert stub로 남기지 않고 라우트·writer·타이머·리스너·공개 산출물까지 수직으로 제거한다. 퇴역 기능을 전제한 규칙은 이력으로만 남고, 각 규칙의 `**Retired**` 줄이 대체 근거를 가리킨다.

**게이트**: `scripts/ci-retirement-contract.mjs` · `scripts/ci-architecture-contract-check.mjs` · `scripts/ci-architecture-browser-check.mjs`

**정본**: R341 · 핵심: R705 · 규칙 23건 (비활성 19건)

## R705. Retiring a surface retires its writers (v57.47, P1670)
When a page rebuild removes or hides an element, the same change removes the legacy/native code that writes it, the timers, page-bus hooks and event listeners that call… 게이트: `ci-architecture-contract-check`.

## R682. Distinguish operator artifacts from optional personal provider queries (v57.06, P1422)
**Retired (v57.79)**: personal provider keys and their settings inputs were retired in v57.67 and their code removed in v57.76; FRED and the other providers run on operator keys in Actions and the Worker.

## R666. A removed route is removed everywhere (v56.79, P1321)
When the owner removes a page, delete its shell, renderers, route ids, briefs, AI personas, audits and manifests in the same change. 게이트: `ci-architecture-browser-check`, `ci-architecture-contract-check`, `ci-runtime-contract-check`.

## R368. Home Quality must not reuse Trading Score and must fail closed without canonical inputs (v53.34, P821)
**Retired (v57.79)**: the Home Quality card no longer exists in index.html.

## R359. Home aggregate primary text must reuse signal presentation and fence legacy summary writers (v53.22, P787)
**Retired (v57.79)**: the home score summary was replaced by the six-axis regime summary (P1392).

## R358. Signal primary text must derive from one Trading Score model and fence the legacy dashboard writer (v53.21, P786)
**Retired (v57.79)**: the signal score/decision hero was removed with the 0–100 market score (P1392, P1670).

## R357. Native bounded technical surfaces must have one pure model and an explicit legacy writer fence (v53.20, P785)
**Retired (v57.79)**: the technical 0–100 health surface was removed (P1420); the screen shows the six-axis market regime.

## R344. 퇴역 UI의 렌더 경로와 주기 작업은 canonical owner 하나만 남기고 실행 가능한 게이트로 고정한다 (v53.8, P727)
HTML에서 제거된 DOM sink를 조회하는 renderer·wrapper·event hook은 조용한 no-op이라도 남기지 않는다. 현재 UI에 남은 일부 상태 갱신은 별도 legacy wrapper가 아니라 해당 페이지의 canonical updater에 합친다. 게이트: `ci-runtime-contract-check`.

## R341. 퇴역 기능은 inert stub로 보존하지 않고 수직 경로와 공개 artifact에서 완전히 제거한다 (v53.3, P716)
사용하지 않는 기능을 unconditional `return`, 빈 함수, 숨김 DOM/CSS, legacy wrapper로 남기지 않는다. 실제 활성 대체 경로와 외부 참조가 없음을 증명한 뒤 DOM·스타일·상태·함수·호출·테스트·배포 항목을 하나의 수직 경로로 제거한다. 게이트: `ci-structural-check`, `ci-release-revision-check`.

## R179. 클라이언트 접속 시 자동운영 모델 — 부팅 로더 명시 + 서버 cron 금지 (v49.88 added, P447 root)
**Retired (v57.79)**: producers run on GitHub Actions schedules and the client only reads published artifacts (AGENTS Producers).

## R175. earnings call transcript 통합 의무 (v49.83)
**Retired (v57.79)**: earnings-call transcripts came from personal FMP keys, removed in v57.76.

## R173. cross-asset correlation matrix 의무 (v49.83)
**Retired (v57.84)**: 30일 Pearson 상관·국면 자동 산출을 전 서비스 의무로 둘 근거가 없다 — 실제 질문·정렬된 자료·표본 진단이 있을 때 선택 기능으로 재제안.

## R146. home 페이지 인라인 채팅 패널 의무 (v49.74 hotfix)
**Retired (v57.79)**: per-page and home chat panels were replaced by the single top AI panel (AGENTS AI).

## R138. fundamental 종목 검색 시 7 차트 자동 렌더 의무 (v49.72)
**Retired (v57.79)**: the fundamental quarterly charts read personal FMP keys, whose paths were removed in v57.76.

## R100. API 키 저장 2중화 + 백업/복원 UX 의무 (v49.45 추가, P312 근본)
**Retired (v57.79)**: personal API keys and their UI were removed; nothing user-facing remains to back up.

## R72. 시나리오 확률 시간 의존 — SCENARIO_REGISTRY (v49.27 추가, L6 근본)
**Retired (v57.79)**: scenario probabilities were removed (AIO_SCENARIO_REGISTRY is an empty unavailable stub); likelihood uses only met-condition count, market-implied direction and sample-sized past frequency.

## R65. 시각 위계 단일 정의 — CARD_HIERARCHY (v49.26 추가, I3 근본)
**Retired (v57.79)**: the CARD_HIERARCHY registry no longer exists in runtime code.

## R64. 점수 가중치 단일 정의 — WEIGHT_REGISTRY (v49.26 추가, I2 근본)
**Retired (v57.79)**: AIO_WEIGHT_REGISTRY has no runtime consumer since the 0–100 score was retired; it survives only in the QA audit bundle.

## R60. 매매 전략 권장값 단일 출처 — ATR_PRESETS (v49.25 추가, L4 근본)
**Retired (v57.79)**: ATR trade-strategy presets were removed; trade instructions are banned (R697).

## R50. fb-estimated 배지 사용 기준 (v48.62 추가)
**Retired (v57.79)**: the fb-estimated badge no longer exists; each card shows one status (최신/지연/참고/없음).

## R48. Canvas 렌더러 전역 변수 참조 시 실제 설정 위치 확인 (v48.61 추가, _pcRatio vs _putCallRatio 교훈)
**Retired (v59.48)**: 근거 게이트 없음 — 이 규칙을 검사하던 validate-edit.sh 훅(Layer 2~9)은 없어졌고 `scripts/agent-hook.mjs`는 권고만 한다. 전역의 실제 설정 위치는 R624(`ci-structural-check`, 전역 한 구현·로드 순서)가 대신 지킨다.

## R41. 기업 분석 맥락 ctx 전원 FMP 심층 활성 (v48.55 추가)
**Retired (v57.79)**: the personal FMP deep fetch was removed in v57.76; company context uses public SEC facts.

## R21. 하드코딩 차트 데이터 경과일 관리 (v40.4 추가, P31)
**Retired (v57.79)**: renderStaleWarning was removed (v57.77); freshness follows per-source cadence rules (R558, R671).
