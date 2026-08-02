# 6개 기반 문서 구현 커버리지 감사

작성일: 2026-08-02  
대상 버전: v53.87
판정: `REFERENCE LAYER CONNECTED — 외부 검증이 필요한 현재성 데이터는 fail-closed`

이 감사는 다음 6개 SSOT 문서의 설계 항목을 실제 코드·공개 데이터·검증 게이트와 대조한 결과다. 구조 artifact와 사용자용 학습 원고가 연결된 범위는 완료로 기록하고, SEC security master·기업별 현재 생산상태·현재 수치처럼 추가 1차 검증이 필요한 값은 임의로 채우지 않고 공개 차단 상태로 기록한다.

## 종합 판정

| 문서 | v53.86 연결 상태 | 판정 |
|---|---|---|
| AI Era Industry Atlas Research Spec | 19개 domain, 95개 taxonomy node, 19개 domain packet, 57개 구조 claim, 23개 1차 출처, 14개 candidate claim, 813개 Telegram 관측 lineage | `REFERENCE CONNECTED` |
| AI Era Deep Taxonomy Player/Product Spec | L0~L6, 95개 node coverage, 20개 role-reference player, 20개 product-family, 20개 currentness overlay와 공식 URL | `REFERENCE CONNECTED` |
| Market Principles Page Design Handoff | 60개 canonical node, 71개 edge, 15개 A~O chapter, 111개 authored lesson, 8개 path | `AUTHORED REFERENCE CONNECTED` |
| AI Era Foundations Curriculum | 7개 layer, 48개 module, 48개 authored reference lesson, 각 lesson의 정의·원리·예시·한계·질문·시각화 frame·source 연결 | `AUTHORED REFERENCE CONNECTED` |
| Market Principles Knowledge Graph UX Spec | TREE/GRAPH/PATH, 실제 1-hop/2-hop BFS, 텍스트 대체, 60/71/8 그래프 범위 | `UX CONNECTED` |
| Masters Portfolio / 13F Page Design Handoff | 8개 프로필, 1,248개 전체 holdings row, 1,377개 비교 row, 84개 filing period·12,525개 과거 SEC 원문 row, 53개 reference mapping, 최신성 경계 | `SEC DATA CONNECTED / NORMALIZATION GATED` |

## 문서별 대조 결과

### 1. Industry Atlas Research Spec

연결된 항목:

- `public-data/atlas/source-packets.json`에 2026-07-28~2026-08-01 5일 Telegram discovery window, 5개 채널, 23개 공식 source, 14개 candidate claim, 12개 candidate node, 7개 edge를 기록했다.
- `public-data/atlas/domain-source-packets.json`에 19개 taxonomy domain별 공식 출처·검증 질문·공표 경계를 연결했다.
- `public-data/atlas/domain-claim-ledger.json`에 domain당 3개씩 57개 구조 reference claim을 연결했다. 이 ledger의 `currentClaims`는 0이다.
- `public-data/atlas/taxonomy-node-coverage.json`에 95개 node별 역할·제품군·상류/하류 연결·검증 질문·source seed를 연결했다.
- 화면에는 packet, domain guide, claim ledger, 95개 coverage card, Telegram 5채널 reference window가 실제 렌더링된다.

검증 경계:

- Telegram은 발견 보조 자료이며 공식 사실·현재 수치·매매 신호로 승격하지 않는다.
- 현재 생산량·출하·수율·CAPEX·가격·시장점유율 같은 숫자 claim은 공식 1차 출처와 기준일이 붙기 전 공개하지 않는다.
- 구조 claim과 current claim을 분리했으며, 현재 claim 0은 누락이 아니라 출판 게이트의 의도된 결과다.

### 2. Deep Taxonomy Player/Product Spec

연결된 항목:

- L0~L6 taxonomy level과 95개 node를 페이지에 연결했다.
- 20개 role-reference player와 20개 product-family에 공식 URL, taxonomy node, 역할·입출력·기술/경제 KPI를 연결했다.
- `player-product-currentness.json`은 공식 페이지 확인일을 2026-08-02로 기록하고, 제품 상태를 실적·출하·수율이 아닌 교육용 참고 분류로 표시한다.
- 각 node에 역할·제품군·상류/하류·검증 질문을 보여 주며, 전 범위 확장 조사 지점을 끊기지 않게 연결했다.

검증 경계:

- 제품 상태 `서비스·제품 페이지 확인/확장 단계 참고 분류/연구·개발 참고 분류`는 양산량·매출·수율의 대체값이 아니다.
- 기업별 최신 세대, 생산능력, 고객, 가격, 수익성은 해당 기업의 공식 공시·제품 문서·기준일을 별도 확인해야 한다.

### 3. Market Principles Page Design Handoff

연결된 항목:

- 60개 canonical node, 71개 edge, 8개 path, TREE/GRAPH/PATH 모드, 검색·선택·전문 route 연결을 유지한다.
- A~O 15개 chapter artifact와 111개 lesson library를 실제 화면에 연결했다.
- 각 lesson은 정의, 메커니즘, 예시, 반례/실패 조건, 검증 질문, diagram frame, prerequisite, source IDs, route를 갖는다.
- 기존 39개 node lesson은 호환용 canonical catalog로 유지하고, A~O 전 범위 111개 authored reference lesson을 별도 학습 목록으로 제공한다.
- 1-hop/2-hop은 선택 노드 기준 BFS로 실제 다른 edge 집합을 렌더링한다.

검증 경계:

- lesson은 학습용 reference 원고이며 투자 조언·현재 가격 전망이 아니다.
- 전문 지식의 장문 교재·실사용자 이해도 조사는 별도 운영·콘텐츠 품질 게이트다.

### 4. AI Era Foundations Curriculum

연결된 항목:

- 7개 layer와 48개 module index를 연결했다.
- 48개 module 각각에 정의, 작동 원리, 예시, 한계, teaching question, visualization frame, related Atlas node, source ID를 연결했다.
- `foundation-lessons.json`을 preferred renderer source로 사용하며, 화면에서 48개 authored reference lesson을 확인할 수 있다.

검증 경계:

- 원고는 화면에서 읽을 수 있는 authored reference layer다. 수식·물리 실험·독립 interactive visualization은 별도 제작물이 아니며, frame/질문 형태로 연결된다.
- 모델·칩·AIDC·Agent 관련 현재 성능과 비용은 기준일이 있는 공식 자료 없이는 확정하지 않는다.

### 5. Knowledge Graph UX Spec

연결된 항목:

- TREE/GRAPH/PATH 3모드, 검색, 선택, path 이동, 출처 badge, 텍스트 관계 목록을 연결했다.
- 선택 node 기준 1-hop/2-hop BFS, SVG와 텍스트 대체, 키보드 focus, source link를 구현했다.
- 현재 그래프는 60 node/71 edge/8 path로 MVP 목표에 진입했다.

검증 경계:

- 그래프는 개념 관계를 표시하며 인과·수익성·주가 방향을 보장하지 않는다.
- 데스크톱 우선 사용성은 검증하되, 모바일은 기존 접근성/레이아웃 회귀 게이트를 유지한다.

### 6. Masters Portfolio / 13F Page Design Handoff

연결된 항목:

- 8개 프로필, 7개 신고주체의 SEC filing metadata와 Berkshire 2026-03-31 보고분기(2026-05-15 제출)를 연결했다.
- 전체 holdings 1,248행, 비교 1,377행, 상위 변화·전체 보유·참고 섹터·분기 추이·원본 공시 탭을 실제 동작시킨다.
- `history-index.json`에 신고주체 7개 × 12개 기간 = 84개 filing period를 연결하고, `history-holdings.json`에 과거 70개 분기의 SEC 정보표 원문 12,525행을 import하여 보고가치·shares 합계를 계산한다.
- `security-master-reference.json`은 화면에 표시 가능한 53개 참고 매핑을 별도 기록하되, 모두 `REFERENCE_ONLY`·ticker/sector 미검증 상태로 표시한다.
- Scion의 최신 연결 분기가 2025-09-30인 사실을 `STALE_REFERENCE`로 표시한다.

검증 경계:

- fail-closed `security-master.json`은 1,102개 CUSIP·1,122개 issuer 문자열 정규화 큐와 0개 verified mapping을 유지한다.
- 참고 sector는 보고가치 합계의 교육용 분류일 뿐, SEC가 제공한 확정 sector·투자 신호·현재 포트폴리오가 아니다.
- 84개 기간 전체가 SEC 정보표 행과 cover 대사 상태를 갖는다. 현재/직전 분기는 기존 holdings artifact와, 과거 70개 분기는 history-holdings artifact와 연결된다.
- 13F는 신고된 미국 주식·옵션 등 일부 보유만 보여 주며 전체 포트폴리오가 아니다.

## 의도적으로 남겨 둔 외부 검증 게이트

다음 세 항목은 “데이터를 빼먹은 상태”가 아니라 공식 원문 검증 없이는 안전하게 공개할 수 없어 차단한 상태다.

1. Atlas의 모든 current numeric/product-generation/production-state claim에 대한 공식 source별 최신 수치 ledger.
2. 95개 taxonomy node 전 범위의 기업·제품 확장 enrichment. 현재 20개 대표 role/product reference는 연결됐고, 나머지는 node coverage와 verification question으로 조사 큐를 유지한다.
3. 13F 전체 분기 행에 대한 verified security master, corporate-action/share-class 검토, sector mapping, shares history.

이 세 항목을 추정값·Telegram 문장·fuzzy ticker mapping으로 채우지 않은 것이 데이터 신뢰성 규칙이다. 페이지에서 사용자에게 제공되는 학습/참고 데이터와 검증 전 데이터의 경계는 모두 표시된다.

## v53.87 구현 환류

- Market Principles: A~O 15개 chapter와 111개 authored reference lesson 연결.
- Foundations: 48개 authored reference lesson과 source/visualization frame 연결.
- Atlas: 19개 domain packet, 57개 structural claim, 95개 taxonomy coverage, 20개 player/product currentness overlay 연결.
- Telegram: 5개 채널 window, 관측 lineage 813건, promoted current claim 0건 연결.
- Masters: SEC 84개 filing period·12,525개 과거 원문 행, 53개 reference mapping, verified security master 0건 fail-closed 연결.
- 사용자 화면의 내부 상태 enum을 한국어 의미 라벨로 변환하고, 버전 SSOT를 v53.87으로 동기화했다.
- Scion의 최신 SEC 제출 여부를 submissions JSON으로 확인하고 `NO_LATER_13F_HR_REPORTED`를 Masters 상세 화면에 연결했다.

## 결론

설계 문서에 정의된 구조·학습 reference·검증 경계는 v53.87에서 실제 페이지와 데이터 artifact에 연결됐다. 반면 공식 현재성 검증이 필요한 기업별 수치·제품 생산상태·전 범위 security master는 완료로 가장하지 않고 차단 상태로 남겼다. 이 artifact의 목적은 “모든 필드가 임의의 값으로 채워졌는가”가 아니라 “채워진 값의 출처와 공개 가능 범위가 추적 가능한가”를 release gate에서 확인하는 것이다.
