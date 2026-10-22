> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# CI/QA tooling 심층 감사

MODE: review | REF: 7e2411432f6ca0e5f02528b209b013bf5f7ff2dc | v58.59

담당 다섯 파일은 고정 `git show` 원문 전문을 읽었다. 원문 SHA256/바이트 범위는 `tooling-reading.tsv`에 기록했다. 게이트 전체나 producer를 실행하지 않았다. `probe-tooling.mjs`는 실제 원문에서 추출한 순수 함수/검사 구간만 VM에서 실행하고, 메모리 fixture를 변형했다. 산출물 외 파일·데이터·Git 변경과 외부 호출은 없다.

## 판정

구체적으로 재현한 기존 결함 1건과 검사 범위 한계 3건이다. CI green 여부와 실제 사용자 기능/데이터 정확성은 다른 증거다. 이 스크립트들 자체도 대체로 문서·라벨·계약의 기계적 정합성만 검사하며, `ci-knowledge-lint-check.mjs` 최종 출력은 semantic truth를 인증하지 않는다고 명시한다. 다섯 게이트의 존재나 check 수를 품질 인증으로 보고하지 않는다.

### [PRE-EXISTING][medium] R 원장 최상위 규칙 삭제를 gap gate가 놓친다

- 위치: `scripts/ci-ledger-integrity-check.mjs:47`–49,74.
- 트리거: 현재 최고 R719의 제목과 본문 블록이 RULES에서 삭제되고 다른 R은 유지되는 편집.
- 실패: `maxR`를 현재 본문에서 다시 계산하여 탐색 상한이 R718로 줄어든다. R719는 `actualGaps` 후보에 들지 않는다. `defined.size >= manifest.definedCount * 0.9`도 단일 삭제를 통과시킨다. 'no rule may vanish silently'라 명명한 검사가 가장 최근 규칙 유실을 검사하지 못한다.
- 실행 증거: 실제 pinned RULES/manifest와 실제 R-gap 검사 구간으로 originalErrors `[]`, R719 전체 블록 삭제 fixture도 afterRemovingHighestRuleErrors `[]`, remainingMax `718`. 제품 파일은 편집하지 않았다. 현재 manifest.maxR는 710이라 단순히 그 상한만 검사해도 최신 R719 보호는 안 된다.
- 실제 caller: `architecture/qa-pipeline.json` workspace의 `ledger-integrity` gate 및 `.github/workflows/knowledge-lint.yml:33`; push CI는 `qa-runner`의 workspace shard를 호출한다. 여기서 전체 CI가 이 변경을 최종 승인한다고 주장하지 않는다. 생성 파일 동기화 등 다른 게이트는 별도로 동작한다.
- 수정 방향: 새 규칙 추가 시 기준의 defined-ID 목록/최고 ID를 갱신하고 삭제를 집합 차이로 검사하거나, 변경 이전 Git 기준의 실제 정의 ID와 대조한다. 단순한 90% 개수 floor나 현재 max만으로 삭제 보존을 증명하지 않는다.

### [CONSIDER][measured] assertion trace는 literal 첫 인수만 센다

- 위치: `scripts/ci-assertion-trace-check.mjs:37`.
- 실제 함수 fixture: `check('untraceable new assertion', condition)`은 1개 수집하지만 동일 label을 변수에 담아 `check(label, condition)`으로 호출하면 0개 수집한다. 새 assertion이 라벨 출처 의무에서 완전히 빠질 수 있다.
- 이 정규식은 의도적으로 literal label의 기계적 subset이다. 기존 특정 사용자 기능 실패나 악의적 우회 발생을 증명한 것은 아니다. '모든 NEW assertion이 추적된다'는 강한 해석을 지양하고, AST 기반 수집 또는 동적 label의 명시적 커버리지 목록이 필요하다.
- ledgerHas 역시 P/R 문서 heading이 아니라 `_context/*.md`/CHANGELOG의 어떤 언급이든 인정하고, QA/T/workstream token의 실제 정의는 검사하지 않는다. citation 문법 PASS는 회귀 의미/근거의 진실성을 증명하지 않는다.

### [CONSIDER][measured] text-pin ratchet은 alias와 줄바꿈으로 같은 검사를 놓친다

- 위치: `scripts/ci-text-pin-ratchet-check.mjs:27`,41.
- 실제 countTextPins fixture: source 직접 includes는 1, 동일 source를 alias에 대입한 뒤 includes는 0, regex `.test(\n source)`도 0. SOURCE_VAR의 단순 변수 수집과 줄별 matcher 때문에 생긴다.
- count budget과 exemption count 제한은 직접 literal 패턴의 증가를 억제한다. 파일 내부 별칭·일반적인 multiline formatting·wrapper 함수까지 추적하는 검사라는 의미는 아니다. 현재 전체 제품 결함으로 승격하지 않는다. 행동 검증으로 전환한 양을 이 수치의 감소만으로 인증해서는 안 된다.

### [CONSIDER][measured] doc freshness는 stale 경로 집합 대신 개수를 허용한다

- 위치: `scripts/ci-knowledge-lint-check.mjs:76`.
- 실제 비교식을 VM 평가: baseline stale=[old-document.md], staleCount=1인 상태에서 now stale=[new-document.md]로 교환하면 true. 기존 debt를 정리한 자리만큼 다른 문서가 새로 낡아도 'set does not grow' check가 통과한다. per-document warning은 출력되므로 완전 은폐와는 다르다.
- 개수 상한은 backlog 예산으로는 타당할 수 있다. '새 stale 문서는 갱신/명시적 재승인이 필요'라는 주석의 정책을 원한다면 날짜 부기 없이 정규화한 경로 집합의 새로운 멤버를 비교해야 한다. 새로운 stale이 경고에만 그쳐도 되는 정책이라면 메시지와 문서가 count budget임을 밝혀야 한다. 정책 선택에 해당하므로 blocker로 올리지 않는다.

## 파일별 실제 경계

| 파일 | 실제로 강제하는 것 | 정상 실행 mutation / 잔여 한계 |
| --- | --- | --- |
| assertion-trace | 수집한 literal label의 frozen debt, 일부 유효 citation token/release heading | 기본 read-only; `--write`는 baseline을 쓴다. 의미적 assertion 타당성은 검사하지 않는다. |
| ledger-integrity | R 중복/현재 최고 아래 신규 gap, 새 open QA row의 verify_by token | 기본 read-only; `--write`는 두 baseline을 쓴다. 트리거 문자열의 실제 gate 존재/실행은 검사하지 않는다. |
| text-pin-ratchet | 인식 패턴의 파일별 수량과 exemption 수 증가 제한 | 기본 read-only; `--write`는 원칙 shrink만, `--allow-growth`로 명시적으로 증가 기록 가능. 언어/taint parser는 아니다. |
| knowledge-lint | 생성 catalog/current state, 일부 frontmatter/중복/구문/일정 기반 경고 | 기본 read-only; `--write`는 freshness baseline을 쓴다. 날짜 갱신 자체가 실제 의미 재검토를 증명하지 않는다. |
| workspace-contract | 문서 budget/marker/wiring 및 hook 실제 payload, operations-alert의 injected API fixture | 정상 실행이 subprocess를 띄우지만, 읽은 호출은 hook guard/session status와 dead-code self-test이다. operations-alert github-script는 fake API에만 연결된다. 자동 commit/push/deploy 증거 없음. |

`ci-workspace-contract-check.mjs`의 hook fixture는 stdin에 명령 문자열을 전달하고 agent-hook은 정규식으로 deny JSON을 돌려준다. 그 문자열의 `git reset`, `git restore` 등을 실제 실행하는 것이 아니다. session-start는 `git status --short`만 실행한다. dead-code self-test는 in-memory splitter/remover fixture이며 실제 파일을 쓰는 `remove` 분기를 호출하지 않는다. 실제 gate 실행을 하지 않았으므로 런타임 전체 무변경을 실측했다는 의미로 보고하지 않는다.

## 증거

`node _artifacts/architecture-quality-audit-20261021-v5859/probe-tooling.mjs` → `tooling-probe.json`. 격리 순수 구간 재현만 시행했다. 다섯 게이트 자체/전체 CI/브라우저/배포는 미실행이다. independence: limited — 동일 모델 담당자 1명, 전체 감사의 별도 담당 결과는 root가 통합한다.
