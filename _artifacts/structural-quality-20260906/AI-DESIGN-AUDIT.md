# AI 채팅 설계·구현 감사 — 2026-09-09

판정: **PARTIAL / 실제 모델 품질 미인증**. 초기 설계의 근거·정책 경계는 상당 부분 구현됐지만, 모든 기능이 완성됐거나 일반 모델보다 우수하다는 증거는 없다. 현재 작업 트리의 소스·로컬 fixture와 공개 설정을 구분한 보고서다. 커밋·push·배포는 수행하지 않았다.

## 초기 설계 의도

근거 문서는 `_context/AI-CHAT-INSTITUTIONAL-AUDIT-2026-07-12.md`, `_context/AI-SCREENER-INTELLIGENCE-REBUILD-HANDOFF-2026-07-27.md`, `_context/API-AI-CHAT-RELIABILITY-REMEDIATION-HANDOFF-2026-07-27.md`다. 현재 정책은 `_context/AIO-CURRENT-PRODUCT-ARCHITECTURE-CHARTER.md`와 RULES R460/R461을 함께 적용한다.

목표는 앱 화면과 같은 데이터·기준시각·출처를 읽고, 검증된 계산과 사실·가설·조건을 구분하는 Evidence-bound Screener Analyst다. 질문에 따라 필요한 깊이와 구조를 선택하고, 후속 질문에는 새 정보·결론 변경 조건을 추가해야 한다. 종목 후보의 다양성도 무작위 표현이 아니라 질문 적합성·사실 일관성·후보 편중 감소로 평가해야 한다.

7월 문서의 과거 결함을 현재 결함으로 복사하지 않았다. 당시 분리돼 있던 unified/retry 응답 경로는 현재 공통 파이프라인을 호출한다. 이후 정책은 근거 부족 시 답변 전체를 지우는 대신 해당 수치·단정만 보류하고 일반 설명·조건부 투자 분석을 보존한다. 가격·비중·손절 기준을 시나리오 입력으로 분석하는 것과 주문 실행은 별개다.

## 요구사항 대조

| 요구사항 | 현재 근거와 판정 |
|---|---|
| 공통 질문 계획 | `answer-orchestrator.js`의 execute를 페이지 채팅과 unified가 사용한다. 로컬 구현 확인. |
| 응답·재시도 공통 출판 경계 | `js/aio-chat.js`와 `index.html`의 정상·재시도 경로가 `_aioRunAIResponsePipeline`을 호출한다. 소스 연결 확인. |
| 현재 숫자 근거 바인딩 | P1052/P1054에서 값·단위·출처·시각·지표·종목·배율을 실제 주입 행과 대조한다. 임의 citation·snippet·잘못된 라벨 반례 통과. 문서 내용의 모든 의미를 자동 인증하지는 않는다. |
| 조건부 분석 보존 | 정책·데이터 제한을 한정적으로 표시한다. 교육 설명과 유용한 조건부 분석을 보존한다. |
| 사용자 전제 검증 | 신규 pure validator는 일치하는 종목·지표·단위·기간의 관측값으로 VERIFIED/CONTRADICTED/CONFLICT를 판정한다. 정확한 기간이 없는 quote는 UNVERIFIED다. 실제 수집 경로의 기간 제공 범위는 제한적이다. |
| 도메인 엔진 | causal/sector/company/technical/macro-fx 구현은 존재한다. 이번 감사 전에는 facade 노출만 있고 실제 채팅 소비가 없었다. 통합 수정 및 별도 검증 대상이다. 엔진 연결 자체가 분석 품질 인증은 아니다. |
| 교육 검색 | 160개 reference 문서와 실제 경로를 연결한다. 원문에서 확인된 개념 관계와 단어 검색 후보를 분리했다. 교육 자료는 현재 시장 근거가 아니다. |
| 웹 조사 | 필요성·기능 가용성·실행 결과·근거 품질을 구분하고 출처 등급·독립성을 hostname에서 계산한다. 실제 검색 공급자 호출 품질은 이번 fixture가 증명하지 않는다. |
| provider 스트림 | 직접 Claude/Worker의 timeout·abort·본문 취소·SSE terminal·오류·불완전 EOF를 mock transport로 검증했다. 실제 모델 호출과는 구분한다. |
| UI·대화 상태 | 중지·손상 기록·TTL·저장 실패·초점 순환·Escape·복원을 격리 Chromium에서 검사했다. 실제 사용자 저장 기록은 사용하지 않았다. |
| 공개 무키 채팅 | 읽은 `public-config.json`은 workerUrl=null, DISABLED, WORKER_HEALTH_STALE다. 소스에 Worker가 있다고 공개 경로가 활성화된 것은 아니다. 배포 상태를 변경하지 않았다. |
| 개인키 채팅 | 코드 경로 존재. 사용자 실제 키를 이용한 응답·비용·지연·장시간 다중 턴은 미검증. |
| 성능·비용·남용 | 본문 deadline·UTF-8 제한·Durable Object quota 구현과 로컬 검사 존재. 실제 운영 revision·분산 부하·유료 모델 비용은 별도 증거가 필요하다. |
| 일반 LLM 대비 우위 | benchmark manifest/routing corpus는 존재하지만 실제 답변 blind review·A/B·정확성·다양성·calibration 결과가 없다. 미인증. |

## 완료로 판정할 수 없는 부분

1. 정확한 시계열 기간이 수집되지 않은 입력으로 상승·하락 전제를 자동 확인할 수 없다. 전제 검증 함수의 PASS를 데이터 공급 완성으로 바꾸지 않는다.
2. 도메인 엔진은 primary intent 하나를 선택한다. 복합 질문의 모든 분석 축을 합성하는 실행과 정량 파생 claim의 공식·입력·기간 추적은 추가 검증 대상이다.
3. sector의 부분 표본은 전체 섹터 대표성을 보장하지 않는다. company의 정규화 점수와 causal의 시간 정렬은 각각 경제적 타당성·인과성을 인증하지 않는다.
4. 160개 교육 문서는 고유 원문을 보존한 reference draft다. 반복 문장 제거는 심층 집필 완료가 아니다. strict depth·원문 직접성·독립 계산 검토는 남아 있다.
5. 공개 Worker 활성화·실제 개인키 호출·모델 품질 benchmark가 없으므로 실서비스 전체 완료를 주장할 수 없다.

## 검증 기록

- `node scripts/ci-ai-intelligence-contract-check.mjs`: 라우팅 30개, 도메인 fixture 및 claim·출처·검색 인덱스 반례 PASS.
- `node scripts/ci-ai-provider-stream-check.mjs`: 직접/Worker mock stream 사례 PASS(앞선 실행). 최신 통합 QA 결과는 전체 보고서에 기록한다.
- `node scripts/ci-chat-ui-state-browser-check.mjs`: 격리 Chromium 상태/접근성 검사 PASS(앞선 실행).
- `node scripts/ci-ai-premise-check.mjs`: 정상·반대·0변동·충돌·기간/종목/지표 불일치·미래값·sourceKind·불변성 PASS.
- `node scripts/ci-ai-analysis-evidence-check.mjs`: 실제 분석 adapter의 typed mapping, 동일 ID 충돌, 시각·단위 불일치, 입력 부족, 전제 API PASS. company는 관측 facts만, technical은 동일 종목·시각·단위만 사용한다. 검증된 섹터 표본·인과 연결이 없는 분석은 부족 상태로 남는다.
- `node scripts/ci-ai-chat-analysis-integration-check.mjs`: 두 채팅이 공통 orchestrator를 호출하도록 연결했다. 최신 QA 집계와 사용자 화면 회귀는 `REPORT.md`에 기록한다.
- 2026-09-10 strict depth 감사는 계속 `ENCYCLOPEDIA_DEPTH_BLOCKED`, 0/160 semantic complete다. 원문 참조 보존 검사의 통과와 구분한다.

## 작업 모델

9월 9일 사용자 요청 이후 범위가 명확한 두 채팅 화면 통합과 회귀 스크립트는 `gpt-5.6-luna`, reasoning `max` 작업자에게 명시 배정했다. 그 이전 기본 상속 작업자를 Luna라고 소급하여 기록하지 않는다. 주 담당자는 설계 판단·변경 리뷰·검증 결과 통합을 담당한다.
