# 읽기 증거의 경계

2026-10-16 시작, 2026-10-17 KST 계속. 시작 preflight는 v57.89, 인벤토리 캡처 시점은 병행 변경 후 v57.90(HEAD cf64d49b…), 재개 때는 v57.91이었다. 하나의 불변 릴리스 전체를 인증한 것으로 읽지 않는다. 사용자·병행 작업자의 dirty 구현은 이 감사가 만들지 않았다. 금융 반례 6개 소스의 hash는 재개 시에도 모두 동일했고, 지식 JSON 캡처 대비 변화는 search-index 한 파일이었다.

`article-review.tsv`는 두 독립 독자가 경로 정렬 앞/뒤 80편씩 읽은 결과를 주 담당자가 통합한 160행이다. summary의 정의·원리·예시·반례·시각 설명·확인질문을 전부 읽었다. article/deepArticle seed는 문자열·구조 동일성을 검사한 뒤 중복을 재사용했다. research evidence 객체는 각 분담에서 JSON 전체 동일성으로 중복 제거한 29종/12종의 전문을 읽었다. 두 집합의 합을 서로 다른 41종으로 주장하지 않는다. 첫 출력의 절단은 해당 범위를 재출력하여 보완했다.

내부정합은 외부 사실·최신성·교육효과 PASS가 아니다. 근거연결오류는 fact가 본문과 다른 주제를 설명한다는 판정이며 본문 정의 자체가 거짓이라는 뜻이 아니다. CONTEXT/DISCOVERY/STRUCTURAL로 선언한 source를 DIRECT라고 표방했다고 간주하지 않는다. artifact 연결과 실제 사용자 노출은 별도다.

원고160편 전부의 workedExample assumptions/steps/result/interpretation/failureBoundary 및 5개 전달 channel은 비어 있다. 이것은 이 생성 초안의 완성도 공백이다. 실제 UI가 사용하는 lesson.story, 분석 노트·칼럼까지 모두 비어 있다는 결론은 성립하지 않는다. 실제 UI의 산술/기하평균 노트는 본문과 계산 예를 보여 주었다. 해당 소비 원문은 별도로 읽는다.

외부 대조 후 정정: TPU의 `on-chip HBM` 표현은 Google 공식 소개에도 존재한다. 따라서 감사 후보를 사실 오류로 확정하지 않는다. 물리 계층을 명료화하라는 편집 제안과 원문 오인용 판정은 다르다. [Google Cloud TPU 소개](https://docs.cloud.google.com/tpu/docs/intro-to-tpu).

역사 규칙은 2026-07-17 Git revision `4911d8ce433edddda0fb9b0ff1226843d0967254`에서 복구했다. 210개 미검토 행(210개 unique ID)에 대응하는 211개 과거 블록이며 누락 ID는 0이다. R75가 두 블록이어서 개수가 다르다. 처음 인계 메모의 unique209는 독립 집합 계산으로210으로 정정했다. 본문 속 다른 헤딩·부록의 경계 오염도 별도 표시한다. 현재 RULES의 핵심 색인 밖 항목은 재발 추적 이력이라는 선언을 존중한다. 과거 본문을 현재 강제 규칙으로 복원하지 않는다.

현재 19개 domain dossier는 모든 고유 필드와 공통 템플릿 동일성을 확인하여 읽었다. 모두 STRUCTURAL_REFERENCE_DRAFT/research REQUIRED/semanticReview REQUIRED이며 metrics·graph edges는 0, evidenceAsOf/reviewedAt은 null이다. 빈 필드 자체를 시장 사실 오류·완료 허위로 세지 않는다.

재무·포트폴리오 도메인 JS20개는 독립 독자가 전문을 읽었다. UI/AI/producer/fixture는 관련 호출 범위만 읽었으므로 전체 전문 검토로 세지 않는다. 주 담당자는 실제 모듈을 import하는 격리 합성 입력 실험으로 후보 E01–E08을 대조했다. 이 실험은 실제 저장 UI의 입력 허용 여부·실제 provider 발생 빈도·배포 서비스의 결함 발생을 인증하지 않는다.
