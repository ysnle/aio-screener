# 04 — 기관공시와 지식 콘텐츠의 의미 계약

Astra 설계 · 2026-09-20 · v55.22 / `54428470`. 생성 자료의 개수나 schema 통과를 의미 검수 완료로 간주하지 않는다.

기존 C01/C02는 발견 당시 기록이다. 아래 C03은 v56 브라우저 관찰과 v56.01 현재 코드 대조로 추가한 후속 발견이다. 기존 수정 여부는 RECHECK-V56.md와 구분한다.

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

## C03 / W04-C — 전체 원장·운용사 원장·미리보기의 세 범위

v56의 C01 수정은 renderer가 전달받은 records에서 manager 집계를 계산하도록 바꿨다. 그러나 실제 UI는 전체 원장이 아니라 manager별 runtime shard를 받는다. `scripts/build-masters-runtime-artifacts.mjs:217–252`는 해당 manager의 전체 coverage를 저장하면서 aggregates는 상위10개 preview만 보낸다. `src/ui/pages/masters.js:1178`의 loadQuarterArtifacts와 :1095의 createDetail 전달 경로에서 이 shard가 사용된다. v56.01에서도 같은 연결을 확인했다.

Appaloosa ‘분기 추이’ 실제 로컬 화면: 선택 manager record10, CUSIP10, 검토대기10, ‘전체 수집 원장(모든 manager)’81records/기간11/검토대기15. shard의 coverage는 Appaloosa 전체81개이고 previewRecords=10이다. 따라서81은 모든 manager의 전체가 아니며10은 Appaloosa 전체 record 수도 아니다. **전달받은 배열이 이미 잘린 미리보기라는 사실이 집계 계약에 빠져 있다.** [브라우저 증거](v56-masters-quarter.json).

기존 ‘동일 배열에서 계산’ 규칙만으로 해결되지 않는다. source scope와 projection scope를 구분한다. producer가 `sourceScope=manager`, `sourceCount`, `previewCount`, `selectionRule`, `complete=false`, `asOf`를 명시하고 renderer는 다음처럼 표시한다.

- ‘Appaloosa 원장81개 중 상위10개 미리보기’ — 전체81의 기준과 정렬 규칙을 함께 설명.
- ‘미리보기10개에서 확인된 CUSIP 수’ — preview에서 산출한 값임을 표시.
- ‘운용사 전체 검토대기15건’과 ‘현재 미리보기의 검토대기’를 별도 표시. 두 queue의 정의가 같은지도 정규화.
- 전 manager 합계는 진짜 global index metadata를 받은 경우에만 표시. manager shard를 global로 부르지 않음.

인수 fixture는 global artifact뿐 아니라 **실제 runtime shard**를 사용해야 한다. manager81/preview10, 다른 manager, preview0, aggregateRecords<previewCount 오류, reviewQueue의 flag/상태 정의 차이를 검사한다. 브라우저에서는 동일 기관의 요약·표·분기 추이를 오가며 분모와 보고기간이 유지되는지 확인한다. 구현 시 새로운 giant payload를 내려받아 의미 문제를 가리는 대신 작은 shard에 충분한 범위 metadata를 둔다.
