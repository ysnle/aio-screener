> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# 남은 검증 도구·기준의 의미 검토

MODE: review. 고정 기준 v58.59 `7e2411432f6ca0e5f02528b209b013bf5f7ff2dc`. 현재 v58.61 작업 트리와 구별한다. root가 검증·지식·운영 도구26개를 전문으로 읽었다. 파일별 SHA와 범위는 [읽기 원장](./remaining-root-reading.tsv), 실행은 [격리 probe](./remaining-governance-probe.mjs)와 [원시 결과](./remaining-governance-probe.json)에 있다. 제품 코드를 바꾸지 않았고, generated-parity의 builder도 실행하지 않았다.

## ACT ON — 검사의 정체성·완료 조건

**GV01 / P2. 조사 단위의 누락을 행 수로 대신 검사한다.** `scripts/ci-knowledge-web-research-dossier.mjs:15–24`는455개 dossier 행 수와 dossierId의 유일성을 검사하지만 `contentUnitId`가 coverage-matrix의 단위와 일대일인지 확인하지 않는다. 실제 pinned 자료의 A2행 contentUnitId만 A1과 같게 바꿔455행/454고유단위/A2누락으로 만들었는데 해당 gate는 원본과 똑같이 `PASS_WITH_BOUNDARY`, failures[]를 반환했다. 자료가 실제로 누락되어 있다는 뜻은 아니다. 최소 보완은 실제 unitId 집합과 contentUnitId 집합의 양방향 차집합·중복을 검사하는 것이다. 조사455건이라는 수치가 전 단원을 조사했다는 증거가 되면 안 된다.

**GV02 / P2. seed 중복을 계산하지만 실패로 연결하지 않는다.** `scripts/ci-knowledge-article-uniqueness.mjs:21–33`의 collisions는 출력에만 쓰이고 failures/종료 조건에는 쓰이지 않는다. 실제160개 원고의 두 번째 seed를 첫 번째와 같게 만든 fixture는 `uniqueDraftSeeds:159`, `exactCollisions:1`이면서 `PASS_WITH_BOUNDARY`, exit0이다. 원본은160/0이다. 이 검사가 사람의 의미적 독창성을 인증하지 않는다는 경계는 올바르다. 그 경계와 별개로, 명시적으로 측정한 완전 중복까지 허용할지 결정해야 한다. topic별 seed 보존을 계약으로 삼을 경우 충돌을 실패로 연결하고, 공용 seed를 허용하려면 명시적으로 공유되는 개념을 식별해야 한다. 단어 몇 개를 다르게 해 gate를 맞추는 보완은 피한다.

**GV03 / P2. ‘미해결이 있는 동안 완료 금지’가 무조건 완료 금지가 됐다.** `scripts/ci-operator-readiness-check.mjs:21`은 unresolved 목록을 계산하기 전에 overall MATCH 또는 closure.complete를 무조건 거부한다. 현재 원본은 unresolved15/PASS다. 같은 gate에 category 상태와 상위 closure를 모두 MATCH/완료/미해결0으로 맞춘 입력을 주어도 ‘unresolved categories exist’라며 throw한다. 개별 category의 세부 증거를 인증한 fixture는 아니며, 해당 gate의 조건부 로직을 검증한 것이다. `scripts/ci-reconciliation-contract-check.mjs:12`에도 overall MATCH 자체를 금지하는 같은 패턴이 있다. 최소 보완은 미해결 집합·실제 증거가 남아 있을 때만 완료 승격을 막고, 완결된 입력이 통과하는 양성 대조를 함께 두는 것이다. 현재 미완료 자료를 PASS로 바꾸자는 제안은 아니다.

위3개는 **각 gate의 보장 범위**에 관한 발견이다. 다른 CI 검사가 같은 fixture를 차단할 수 있으므로 전체 파이프라인 우회 성공으로 확대하지 않는다. 모든 fixture는 메모리에서만 바뀌었고 저장소의 지식·운영 데이터는 수정하지 않았다.

독립 재검토: UI 담당자와 workflow 담당자가 고정 gate 원본을 각각 대조했고, UI 담당자는 결과 파일 쓰기만 제거한 probe를 메모리에서 다시 실행해 같은 반례를 확인했다. generated-parity의 targets에는 articles.json과 research-dossiers.json이 모두 포함되어 단순 산출물 변조를 별도로 차단할 수 있다는 지적을 반영했다. 같은 모델의 별도 맥락 검토이므로 독립성은 limited다. probe JSON의 requestedProcessExitCode는 VM의 요청 기록이며, evaluationCompleted/thrown을 실제 CLI의 성공 exit0으로 읽으면 안 된다.

## CONSIDER — 기준이 개선 경로를 닫는 구간

- `ci-knowledge-route-bridge-contract.mjs:17`은18개 시나리오에 mobile/tablet/touch persona가 하나라도 생기면 실패하도록 명시한다. 과거 desktop 범위의 흔적이며 현재 desktop/phone/iPad 공통 기능이라는 방향과 충돌한다. 기존 desktop 시나리오를 유지하면서 실제 작은 화면의 지식→종목 이동을 추가할 수 있어야 한다. 단순한 persona 문자열 검사보다 장치별 실제 행동 검증이 유용하다.
- `ci-operator-readiness-check.mjs:15,29`의 fast plane OPERATOR_REQUIRED 고정과 public-beta BLOCKED 고정도 증거가 갖춰졌을 때의 정상 전이가 없다. 현재 부족한 증거를 보수적으로 표시하는 목적은 유지하되 **상태 전이의 조건**을 검사해야 한다. 가족 도구에는 공용 유료 서비스의 형식 인증을 기능 개선의 선행조건으로 삼지 않는 현재 사용자 결정을 적용한다.
- `ci-knowledge-article-contract.mjs:38`은 SOURCE_SUMMARY/RECONSTRUCTION_REQUIRED만 허용하지만 authoring-contract와 market-transmission은 SEMANTIC_REFERENCE_AUTHORED 분기도 갖는다. 현재 자료는 source-preserved라 충돌이 발생하지 않는다. 실제 본문 심화 시 지원 모드·필수 증거를 한 계약으로 맞춰야 한다. 판정 단어만 바꾸는 승격은 금지하는 편이 맞다.
- full-corpus의 종류별 개수·태그, 기사 필드 존재, URL/출처 ID 보존 검사는 자동으로 하기 좋은 구조 검증이다. 이것들이 원문의 의미, 실제 출처의 주장 일치, 학습 효과를 증명하지는 않는다. 현재 `completionReady:false` 경계는 유지할 가치가 있다.

## 유지할 만한 설계

운영 알림은 명시 관측 시각·거래소 캘린더·정규장 종가·미등록 연도의 UNKNOWN을 구별한다. SLO 테스트에는 zero-run, push-only, 불완전 pagination, 미래/중복 run, 정상 완료의 양성 대조가 함께 있다. 이런 테스트 구조는 위 GV03에도 적용할 만하다. 이 판단은 읽은 함수와 fixture의 설계 평가이며, 실제30일 운영이나 청구액을 재측정한 결과가 아니다.

지식 generated-parity는 저장소를 별도 임시 복사본으로 분리하고 symlink 및 clean SHA 경계를 검사한다. 소스 읽기로 확인했으며 로컬 producer 금지 범위에 따라 실행하지 않았다. semantic-review의 인증 서명/증거 경로/100% 선 조건도 자동 PASS를 전문 검수로 부르지 않도록 하는 방향이다. 다만 과거 한 감사 폴더의 누적 수치만으로 현재 소스의 의미 검수를 인증할 수는 없으므로, 현재 SHA별 읽기 근거와 분리해서 보고해야 한다.
