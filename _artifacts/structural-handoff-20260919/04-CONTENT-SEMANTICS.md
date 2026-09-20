# 04 — 기관공시와 지식 콘텐츠의 의미 계약

Astra 설계 · 2026-09-20 · v55.22 / `54428470`. 생성 자료의 개수나 schema 통과를 의미 검수 완료로 간주하지 않는다.

## C01 / W04-A — 선택한 운용사와 집계 분모 일치

`src/ui/pages/masters.js:695`의 `createIssuerAggregateView`는 managerId로 records를 필터하고 고유 보고기간과 reviewQueue를 계산한다. 그런데 :706–708의 ‘현재 manager 집계 CUSIP’, ‘집계에 포함된 보고기간’, ‘검토 대기 플래그’는 전체 artifact coverage를 우선 사용한다.

현재 issuer-aggregates artifact의 전체 수치는 2500/77/268이다. manager별 records는 Berkshire61, Duquesne289, Fisher1885, Pershing18, Appaloosa81, Baupost73, Scion93이다. Appaloosa metadata는81/11/81이다. 선택한 manager의 표와 전체 분모의 요약 카드가 다른 범위를 설명하는 정적 경로를 확인했다. 실제 선택 UI 재현은 아직 하지 않았다.

설계: summary는 필터된 records에서 동일 함수를 통해 계산하고 scope={managerId,reportPeriods,aggregationKey}를 동반한다. 전체 coverage는 ‘전체 수집 원장’ 구역에서만 사용한다. 고유 보고기간 수와 manager-period 조합 수를 구별한다. CUSIP 단독 수와 manager·CUSIP·share type·put/call 집계 record 수 역시 같다고 가정하지 않는다. 현재 label ‘집계 CUSIP’가 어느 count인지 정정한다.

인수: 최소2 manager 전환, 전체 보기, 빈 manager, 같은 CUSIP의 share type/put-call 차이, 중복 period. 상단/표/내보내기 scope가 동일해야 한다. SEC 보고가치와 현재 시장가, 제출일과 보고기간은 계속 구분하며 공시자료를 현재 포지션이라고 승격하지 않는다.

## C02 / W04-B — KPI와 검증 질문, 가치사슬을 분리

`scripts/build-knowledge-domain-dossiers.mjs:43`은 guide.unit, guide.kpis, taxonomy verificationQuestion을 uniqueKpis에 합친다. :44의 valueChain은 mechanism 문장과 node 제목을 이어 붙인다. 현재 domain-cloud-platform dossier에는 공식 자료·기준일을 묻는 질문이 KPI 목록에 들어간다. array/string schema 통과만으로 경제 지표나 가치사슬 순서가 성립하지 않는다.

현재 status=STRUCTURAL_REFERENCE_DRAFT와 REFERENCE_ONLY 경계는 정직하게 미완료를 표시하므로 보존한다. repository가 dossier를 적재하는 연결은 있으나 해당 필드가 현재 Atlas/AI의 최종 주장에 쓰였다는 사실까지 확인한 것은 아니다.

설계: `metrics[]`는 metricId/name/definition/unit/numerator/denominator/period/sourceRequirement를 가진다. 모든 지표가 비율은 아니므로 분자·분모는 해당할 때만 요구한다. `researchQuestions[]`는 질문과 검증 조건을 갖고 metrics를 참조한다. `valueChain.nodes/edges`는 참여자·투입/산출·관계 방향·가격/비용 전달·시간지연·반증 조건을 명시한다. mechanism 문장은 설명으로 보존하되 그래프의 순서로 간주하지 않는다.

generator는 원본에 없는 KPI 정의나 경제 인과를 자동 발명하지 않는다. 정규화가 안 된 기존 항목은 unclassifiedCandidates로 보존하고 semanticReview=REQUIRED를 유지한다. generatedAt, evidenceAsOf, reviewedAt을 분리한다. 재생성 날짜가 최신이라고 내용의 경제적 유효성이 갱신되는 것은 아니다.

인수: 질문이 metric으로 유입되지 않음, 모든 metric의 단위·기간 정의, 실제 근거 없는 edge는 가설 상태, 기존 source/taxonomy 링크 보존, consumer가 draft를 검증된 금융 사실로 표기하지 않음. cloud 한 도메인에서 끝까지 확인한 뒤 다른 산업으로 확장한다. 생성 JSON은 직접 수정하지 않고 원본과 generator를 수정하는 작업으로 넘긴다.

## 후속 의미 검수

SEC 보고가치 단위와 form 시점별 규칙, 정정공시/누적기간, issuer/security identity, 투자자 원칙의 원문 맥락, 산업별 KPI가 기업 재무·밸류에이션으로 전달되는 경로는 별도 함수/콘텐츠별 점검 대상이다. 콘텐츠가 많이 존재한다는 이유로 이 검수를 완료 처리하지 않는다.
