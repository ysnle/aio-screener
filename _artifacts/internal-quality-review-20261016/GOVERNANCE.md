# 내부 운영·에이전트·평가 기준의 질

2026-10-16, v57.88 dirty 읽기 기준. 독립 검토자가 읽기 전용으로 조사하고 주 담당자가 통합했다. G08은 주 담당자가 메모리 격리 반례로 추가 확인했다. 나머지는 아래 코드·문서의 논리 대조이며 행동 실험으로 승격하지 않는다. 기존 감사의 같은 문제를 새 독립 결함으로 중복 계산하지 않는다.

## G01 · 의미 인증이 현재 소스 identity에 묶이지 않음 — 부분 해결

근거: [semantic gate](C:/Projects/AIO/scripts/ci-semantic-review-check.mjs:67), [과거 coverage](C:/Projects/AIO/_artifacts/exhaustive-audit-20260831/coverage-summary.json:2).

감사 수 하한과 영구 `releaseCertified=false` 강제는 실제 제거됐다. 좋은 수정이다. 다만 현재 true 허용 조건은 고정된 과거 coverage에 100%, reviewer/date, 존재하는 evidence 파일이 있으면 만족한다. 현재 소스 hash·검토 범위와의 연결은 검사하지 않는다. 과거 범위 인증 후 제품이 바뀌어도 같은 조건을 만족할 수 있다. 지금 실제로 잘못 true라는 주장은 아니다.

제안: 역사 인증은 해당 revision에 보존하고, 현행 인증을 주장할 때만 대상 파일 hash와 범위를 대조한다. 모든 줄 100%를 사용자 품질의 충분조건으로 삼지 않는다. 비용은 범위 추적이며 이익은 과거 리뷰의 유효한 재사용과 현행 오인증 방지다. 확인은 인증 범위 안/밖 파일 변경이 각각 적절히 다르게 처리되는지로 한다.

## G02 · 디자인 합격 기준이 현행 제품 원칙과 어긋남 — 잔여

근거: [design review](C:/Projects/AIO/.claude/skills/post-edit-qa/references/design-review.md:8), [AGENTS](C:/Projects/AIO/AGENTS.md:32).

초보자 이해·날짜·대비·키보드 검사는 유지한다. 그러나 모든 section의 시각물+130~230자+접힌 상세, 44px 목표, 비예측 score/grade의 설명 라벨 허용을 같은 합격표로 강제하면 단순 결측 안내에도 불필요한 그림과 글을 붙이게 된다. 검증 없는 종합 등급을 설명용이라고 다시 들일 여지도 있다. 44px 자체가 나쁜 목표라는 뜻은 아니다.

제안: 불변인 데이터 정직성과 문맥별 디자인 권장을 구분한다. 단문 알림·표·차트·상태 카드 각각에 적합한 완료 경로를 허용한다. 형식 균일성은 조금 줄지만 정보의 신호 대 잡음비가 좋아진다. 글자 수 충족을 이해 검증으로 부르지 않는다.

## G03 · 브라우저 증거 수준이 도구 이름에 종속됨 — 잔여

근거: [QA tiers](C:/Projects/AIO/.claude/skills/post-edit-qa/references/tiers.md:66), [verify skill](C:/Projects/AIO/.claude/skills/verify-aio/SKILL.md:28).

실제 navigation·조작·결과·화면 확인을 요구하는 의도는 좋다. 하지만 Chrome MCP가 없으면 미실행이라고 적도록 하면서 현행 드라이버는 Playwright Chromium을 쓴다. ‘Live Deployment’라는 제목의 범위에 로컬 서버도 포함한다. 같은 관측을 특정 도구가 아니라고 격하하거나 로컬을 배포 증거로 오해할 수 있다.

제안: 도구가 아니라 행동·관측·환경으로 분류한다. 로컬 브라우저/배포 브라우저, 자동 단언/사람의 시각 확인을 분리한다. 다른 도구로 같은 행동과 화면을 확인해도 같은 증거 수준이어야 한다. 자동 드라이버 PASS를 시각적 전수 검수로 올리지 않는 경계는 유지한다.

## G04 · 스킬 실험이 같은 질의 더 단순한 개선을 기각함 — 잔여

근거: [autoresearch](C:/Projects/AIO/.claude/skills/autoresearch/SKILL.md:39), [workflow](C:/Projects/AIO/.claude/skills/autoresearch/references/workflow.md:48), [governance](C:/Projects/AIO/_context/WORKFLOW-GOVERNANCE.md:212).

baseline과 동일 과제 비교는 유지한다. governance는 동점+위험 감소를 허용하지만 skill은 동점을 자동 기각한다. 같은 작은 과제를 반복해 95%를 3번 넘으면 끝나는 기준에는 미사용 과제 확인이 없다. 품질을 유지하면서 50줄·토큰·시간을 줄이는 변경이 버려지고, 이미 본 과제에만 맞는 지침이 남을 수 있다.

제안: 안전·정확성 저하가 없으면 동점 비용 감소도 채택 가능하게 하고, 최종 채택 전 미사용 과제 소수로 확인한다. 통계 플랫폼 신설은 필요 없다. 수용 기준은 동점 축약을 허용하면서 평균 점수가 올라가도 중요한 실패가 새로 생긴 변경은 기각하는 것이다.

## G05 · 모든 지침을 이진 eval로 정당화하라는 규칙도 과도함 — 잔여

근거: [knowledge-lint workflow](C:/Projects/AIO/.claude/skills/knowledge-lint/references/workflow.md:15), [공유 계약](C:/Projects/AIO/.claude/skills/_shared/operating-contract.md:44).

반복·고위험 결함의 행동 회귀는 유지한다. 그러나 지침마다 대응 eval이 없으면 finding, 제거가 자체 eval 성공률을 바꾸지 않으면 제거 후보라는 기준은 작은 평가집합에 대한 과적합을 장려할 수 있다. 드문 비밀키 유출 방지는 작은 실험에서 차이가 0이어도 필요하다. 반대로 스타일 선호를 이진 항목으로 복제한다고 질이 높아지지는 않는다.

제안: 심각도·재발·검사 가능성·유지 비용에 따라 회귀 검사, 리뷰 질문, 참고 지침을 고른다. 형식상 1:1 매핑 대신 중요한 위험을 실제로 잡는지 확인한다. 작은 문구 수정과 데이터 손실 결함의 예방 비용이 달라도 정당한 완료 경로가 있어야 한다.

## G06 · session baseline은 작업 소유권 격리가 아님 — 잔여

근거: [QA skill](C:/Projects/AIO/.claude/skills/post-edit-qa/SKILL.md:28), [runner](C:/Projects/AIO/scripts/qa-runner.mjs:272).

시작 전 dirty를 구분하는 기능은 유용하다. 그러나 이후 모든 hash 차이를 모으므로 A의 baseline 뒤 B가 바꾼 파일도 A의 변경 목록에 들어간다. 이를 task-only 격리라고 설명하는 것은 과하다.

제안: 시간 기준 변경 탐지라고 명명하고 병행 편집은 worktree/소유 경로로 구분한다. 영향받는 공유 소비자를 검사하는 확장은 계속 필요하다. 이번 감사는 이 때문에 명시적 자체 파일 목록으로 QA를 선택한다.

## G07 · 효과별 producer 구분은 해결, refresh 권한·버전 경계는 잔여

근거: [AGENTS](C:/Projects/AIO/AGENTS.md:35), [refresh workflow](C:/Projects/AIO/.claude/skills/data-refresh/references/workflow.md:9), [운영 경계](C:/Projects/AIO/_context/WORKFLOW-GOVERNANCE.md:202).

workspace generator를 producer에서 제외한 개정은 유지한다. 다만 skill은 dispatch와 무조건 앱 version bump를 기본 단계로 적고, governance는 dispatch의 명시 권한을 요구한다. ‘오래됐는지 확인’과 ‘갱신해’가 지침 선택에 따라 원격 작업까지 이어질 수 있다. 실제 자동 갱신은 data revision으로도 추적한다.

제안: 점검/갱신/생산기 코드 수정의 허용 효과를 구별한다. 데이터만 바뀌면 data revision·asOf, 제품이 바뀌면 app version을 사용하도록 문구를 실제 workflow와 맞춘다. 새 버전 숫자의 증가를 품질 개선으로 보지 않는다.

## G08 · 스킬 평가의 필수 목록이 9개 중 과거 6개만 강제 — 새 구체 반례

근거: [fixture gate](C:/Projects/AIO/scripts/ci-skill-eval-fixture-check.mjs:21), [현행 fixture](C:/Projects/AIO/architecture/skill-eval-cases.json).

현재 JSON에는 9개가 있다. 그러나 필수 목록은 옛 6개다. 주 담당자는 verify/create/maintain 3개를 **메모리에서만** 제거하고 현재 gate 본문을 격리 실행했다. exit0, ‘6 skills, 18 cases’ PASS가 나왔다. 파일을 지우거나 고치지 않았다. [재현](./counterexamples.json).

제안: 이미 있는 canonical skill 집합으로 누락을 대조한다. 항목3개·금지 주장1개 같은 개수 검사는 구조 증거로만 부른다. fixture의 존재는 행동 품질 실험이 아니다. 모든 현행 스킬의 fixture 삭제가 검출되는지가 최소 수용 기준이다.

## 읽기 범위·한계

AGENTS·CURRENT-STATE·WORKFLOW-GOVERNANCE, canonical skill9개와 관련 workflow/reference, command16개, agent4개, 공유 계약·위임문, hook 설정/구현, semantic/skill-eval/workflow-compaction/ledger/assertion gate, QA runner 관련 범위, skill-eval JSON, 관련 workflow를 읽었다. feature 지도/driver 전편, QA pipeline 및 모든 workflow의 전수 의미 검토, 모델 행동 실험·브라우저·배포는 이 분담의 확인 범위가 아니다. 이전 감사의 상세 표를 현행 완료 인증으로 재사용하지 않았다.
