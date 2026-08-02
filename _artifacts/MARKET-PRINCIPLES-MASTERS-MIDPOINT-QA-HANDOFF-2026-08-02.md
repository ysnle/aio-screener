# MARKET PRINCIPLES / AI ATLAS / MASTERS — 중간 QA 피드백 인계서

> 상태: `REVIEW_HANDOFF`  
> 기준 체크아웃: `C:\Projects\AIO` / `main`  
> 기준 버전: `v53.77`  
> 점검일: `2026-08-02`  
> 목적: 6개 설계 문서를 기반으로 구현된 시장 원리·AI Era Atlas·대가의 포트폴리오 작업을 다음 에이전트가 이어서 보완하기 위한 실행 계약  
> 주의: 이 문서는 코드 구현 완료 보고서가 아니라 **미완료 사항과 합격 조건을 전달하는 QA 인계서**다.

---

## 0. 한 줄 판정

6개 설계 문서에는 사용자 의도가 대부분 반영되어 있으나, 실제 화면 구현은 최종 요구 범위의 약 `40~45%` 수준이다.

- 방향·데이터 경계·라우트 아키텍처: 양호
- 실제 교육 콘텐츠의 폭과 깊이: 부족
- AI Atlas의 사용자 전달성: 내부 연구 대시보드 수준
- 13F 데이터 최신성: 일부 오류
- Masters 상세 기능: 대부분 미구현
- 모바일·접근성: release blocker 존재

현재 결과물은 **Phase 1 기반 구축물**로는 우수하지만, 최종 사용자용 완성 페이지 또는 배포 가능 상태로 판정하지 않는다.

---

## 1. 반드시 함께 읽을 6개 SSOT

1. `_context/MARKET-PRINCIPLES-PAGE-DESIGN-HANDOFF-2026-08-01.md`
2. `_context/MARKET-PRINCIPLES-KNOWLEDGE-GRAPH-UX-SPEC-2026-08-01.md`
3. `_context/AI-ERA-FOUNDATIONS-CURRICULUM-2026-08-01.md`
4. `_context/AI-ERA-INDUSTRY-ATLAS-RESEARCH-SPEC-2026-08-01.md`
5. `_context/AI-ERA-DEEP-TAXONOMY-PLAYER-PRODUCT-SPEC-2026-08-01.md`
6. `_context/MASTERS-PORTFOLIO-13F-PAGE-DESIGN-HANDOFF-2026-08-01.md`

이 문서는 위 6개 설계를 대체하지 않는다. 다음 에이전트는 이 인계서를 먼저 읽은 뒤, 작업 대상에 해당하는 SSOT 본문을 읽어야 한다.

---

## 2. 독립 재검증 결과

### 통과

- JS syntax: Principles / Atlas / Masters
- 세 페이지 정적 contract
- 세 페이지 1440×900 Chromium browser contract
- version sync `v53.77`
- structural contract: 20 routes
- runtime contract
- architecture contract / browser contract
- vertical-slice contract / browser contract
- route soak: 20 routes × 3 laps, browser error 0, canvas 수 누적 없음
- operations contract
- workflow compaction
- knowledge lint
- `git diff --check`

### 실패

- `node scripts/ci-accessibility-matrix-check.mjs`
  - route: `principles`
  - 모바일 small target: 8개
  - 측정 크기: `33×17px`
  - artifact: `_artifacts/accessibility-matrix-audit.json`

### 아직 검증하지 않은 것

- NVDA/VoiceOver 실제 낭독
- Firefox/Safari
- 실제 초보 사용자 이해도 테스트
- live Pages 배포 parity
- 15개 외부 source URL 전체의 장기 permalink 안정성
- Telegram 5개 채널 장기 전체 archive
- 모든 13F 신고주체의 amendment/notice/combination report 전수 재검증

---

## 3. P0 — 배포 전에 반드시 해결

### P0-01. Berkshire 최신 13F 누락

현재:

- `public-data/masters/filings.json`
- Berkshire `latestFiling.periodOfReport = 2025-12-31`
- accession `0001193125-26-054580`

하지만 SEC에는 다음 filing이 존재한다.

- report period: `2026-03-31`
- filed: `2026-05-15`
- accession: `0001193125-26-226661`
- SEC: `https://www.sec.gov/Archives/edgar/data/1067983/000119312526226661/0001193125-26-226661-index.htm`

영향:

- 기본 선택 투자자의 보유 종목이 한 분기 뒤처짐
- shares delta·value delta·action label이 이전 분기 기준으로 계산됨
- 화면의 `검토 2026-08-02`가 데이터 최신성을 오해하게 만들 수 있음

필수 조치:

1. 모든 LIVE_13F profile에 대해 SEC submissions에서 최신 `13F-HR`/적용 가능한 `13F-HR/A`를 다시 선택한다.
2. `periodOfReport` 최대값을 단순 artifact 값과 독립적으로 대조한다.
3. current/prior filing을 다시 수집하고 holdings/diff를 재생성한다.
4. Scion의 2025-09-30 상태가 실제 최신인지 별도 확인한다.
5. 자동 수집 시 `asOf`, `collectedAt`, `latestAvailablePeriod`, `freshnessStatus`를 남긴다.

합격 게이트:

- [ ] Berkshire latest period가 SEC 최신 filing과 일치한다.
- [ ] 7개 LIVE_13F profile 모두 `latestAvailablePeriod === latestFiling.periodOfReport`다.
- [ ] 현재·이전 filing accession이 서로 다르고 보고분기가 역순이다.
- [ ] cover-page totals와 parsed row totals가 다시 reconcile된다.
- [ ] current/prior 재수집 뒤 action counts가 재계산된다.
- [ ] 최신 분기 누락 fixture를 넣으면 CI가 실패한다.

### P0-02. 접근성 matrix 실패

원인:

- `index.html:5304~5305`
- `.principles-evidence-link`가 10px 글꼴과 작은 padding을 사용
- 모바일에서 33×17px로 측정

필수 조치:

- 링크의 실제 hit area 높이를 최소 24px 이상으로 만든다.
- focus-visible을 명확히 표시한다.
- 색상만으로 source 상태를 구분하지 않는다.
- 긴 출처명도 키보드와 screen reader에서 의미가 유지되어야 한다.

합격 게이트:

- [ ] accessibility matrix `status: pass`
- [ ] Principles smallTargetCount `0`
- [ ] 390×844에서 출처 링크가 겹치거나 잘리지 않는다.

---

## 4. P1 — 핵심 기능 및 사용자 의도

### P1-01. Masters 상세 탭이 모두 noop

위치:

- `src/ui/pages/masters.js:206~207`

현재 다음 탭이 모두 `action = noop`이다.

- 핵심 변화
- 전체 보유
- 섹터 구성
- 분기 추이
- 원본 공시

데이터 상태:

- 전체 current rows available: `1,268`
- 전체 comparison rows available: `1,375`
- 사용자 화면: 기관별 top 10, 총 68개 current rows만 노출

필수 조치:

1. 구현할 탭만 노출한다.
2. 미구현 탭은 숨기거나 `disabled + 준비 중`으로 명시한다.
3. 사용 가능한 전체 artifact를 초기 DOM 전체 생성 없이 pagination/virtualization한다.
4. Exited 종목을 별도 변화 표에서 확인 가능하게 한다.
5. 섹터 구성은 검증된 security master가 없으면 추정하지 않는다.
6. 분기 추이는 최소 2개 분기에서 시작하고 불완전 기간을 표시한다.

필수 탭 계약:

| 탭 | 최소 기능 |
|---|---|
| 핵심 변화 | New/Increased/Reduced/Unchanged/Exited 필터, shares 기준, 증감 절대값·비율 |
| 전체 보유 | pagination/virtualization, issuer/CUSIP/put-call/share type, 정렬·검색 |
| 섹터 구성 | 검증된 분류 출처, 미분류 비중, 합계 100% 검증 |
| 분기 추이 | report period 기반, current price와 혼합 금지 |
| 원본 공시 | current/prior index, primary XML, information table XML |

합격 게이트:

- [ ] 모든 보이는 탭 클릭 시 활성 상태와 본문이 실제 변경된다.
- [ ] `noop` action이 사용자 기능 탭에 남아 있지 않다.
- [ ] full holdings에서 1,268개 원본 행에 접근 가능하다.
- [ ] Exited rows를 사용자 화면에서 찾을 수 있다.
- [ ] Fisher 대규모 filing도 초기 DOM 폭증이 없다.

### P1-02. Market Principles 1-hop/2-hop이 동일

위치:

- `src/ui/pages/principles.js:374~378`

현재:

```js
const edges = state.depth === 2 ? CATALOG.edges : CATALOG.edges;
```

필수 조치:

- selected node 기준 1-hop neighbor와 2-hop neighbor를 실제 계산한다.
- 비선택 edge는 숨기거나 약화하되 AA 대비를 해치지 않는다.
- node 수와 edge 수를 화면에 표시한다.
- 1-hop/2-hop 전환 시 키보드 focus가 유지되어야 한다.

합격 게이트:

- [ ] 동일 node에서 1-hop과 2-hop의 visible edge/node count가 다르다.
- [ ] CI가 서로 다른 count와 연결 집합을 검증한다.
- [ ] 선택 node가 바뀌면 subgraph도 바뀐다.

### P1-03. Market Principles 콘텐츠가 너무 얕음

현재:

- node: 12
- lesson: 7
- path: 2
- 중심 내용: AI 인프라와 evidence practice

누락된 사용자 핵심 요구:

- 왜 주식과 생산자산을 이해해야 하는가
- 자본주의·기업·소유권·이익·복리
- 돈·은행·신용·중앙은행·금리·채권·환율
- 생산성·인플레이션·경기순환·유동성
- 시장 가격과 가치·기대·리스크 프리미엄
- 주식시장과 실물경제의 차이
- 원자재·전력·물류·산업정책
- AI·반도체·AIDC가 이 기반 위에서 어떻게 연결되는가

필수 조치:

- 6개 SSOT의 P0 내용을 사용자용 레슨 원고로 승격한다.
- node마다 최소 다음 구조를 유지한다.
  - 한 문장 정의
  - 쉬운 비유
  - 원리
  - 왜 중요한가
  - 선행 개념
  - 다음 개념
  - 산업/기업 연결
  - 오해하기 쉬운 점
  - bull/bear 또는 실패 조건
  - source/as-of

MVP 최소 경로:

1. 15분: 돈·기업·주식·금리
2. 30분: AI가 계산→칩→데이터센터→전력이 되는 과정
3. 45분: AI 가치사슬→CAPEX→매출→FCF→ROIC

### P1-04. AI Era Atlas가 내부 연구 현황판처럼 보임

현재:

- reviewedNodes: `0`
- structural taxonomy nodes: `55`
- current claims: `0`
- 사용자 화면에 `ATLAS-xx`, `TG-Cxx`, `DESIGN_ONLY`, `REVIEWED_CANDIDATE`가 전면 노출

판정:

- source governance는 우수함
- 사용자 학습·전달 UX는 미완성

필수 조치:

- 내부 packet ID와 publication status는 기본 화면에서 숨기고 `출처/검증 상세` drawer로 이동한다.
- 사용자는 `무엇인가 → 왜 필요한가 → 어떻게 작동하는가 → 누가 만드는가 → 무엇을 봐야 하는가` 순서로 읽게 한다.
- AI foundations 48개 module은 제목 카드가 아니라 실제 lesson body를 가져야 한다.
- Deep taxonomy는 최소 P0 domain부터 L0→L6를 실제 player/product까지 연결한다.

P0 필수 심화:

- Foundry: 3nm/2nm/18A, GAA, backside power, SRAM/interconnect, yield tree
- Lithography: KrF/ArF/ArFi/EUV/High-NA, overlay, multipatterning, 중국 DUV 검증 상태
- Front-end/back-end: 증착·식각·세정·CMP·계측·패키징·테스트
- Memory: SRAM/DRAM/HBM/NAND/SSD/CXL
- Photonics: laser/modulator/detector/DSP/TIA, SiPh/InP/SiN, pluggable/LPO/CPO/optical I/O
- AIDC/power: rack/network/storage/power chain/cooling/grid/permit/finance
- Open AI: open source/open weight/open tooling/runtime/license 구분
- Cloud/neocloud, on-device AI, physical AI, defense/drone, space/Artemis
- 모든 subsector의 player role·대표 product family·KPI·리스크

합격 게이트:

- [ ] P0 node마다 실제 설명 body가 있다.
- [ ] P0 L4마다 player role과 product family가 있다.
- [ ] 기업명이 역할·제품 없이 나열된 node가 없다.
- [ ] CURRENT 수치·수율·shipment에는 as-of와 primary source가 있다.
- [ ] Telegram claim은 discovery 상태로 남고 검증 전 CURRENT로 승격되지 않는다.
- [ ] 초보자 기본 화면에서 내부 packet ID가 보이지 않는다.

### P1-05. 모바일 master-detail 흐름 단절

시장 원리:

- `.principles-tree-list`가 모바일에서도 `max-height:620px; overflow:auto`
- node 선택 뒤 상세는 목록 아래 화면 밖에 있음
- 선택 후 scroll/focus 이동 없음

Masters:

- 모바일에서 manager 8명이 모두 먼저 표시됨
- 선택 detail은 목록 아래에 있음
- 선택 후 detail 이동 없음

필수 조치:

- 모바일은 단일 scroll을 기본으로 한다.
- node/manager 선택 후 detail heading으로 focus 또는 scroll 이동한다.
- 뒤로 가기 또는 목록 복귀 위치를 보존한다.
- mobile graph는 text alternative가 주 탐색 수단이 되도록 한다.

합격 게이트:

- [ ] 390×844에서 선택 후 상세 제목이 한 화면 안에 나타난다.
- [ ] 중첩 세로 스크롤이 없다.
- [ ] 키보드와 screen reader focus 위치가 예측 가능하다.

---

## 5. P2 — 품질과 방향성

### P2-01. 정보구조가 2페이지 요청에서 3페이지로 증가

현재 top-level:

1. 시장 원리
2. 대가의 포트폴리오
3. AI Era Atlas

사용자의 최초 요구는 2개 신규 페이지였다.

권장 기본안:

```text
시장 원리
├─ 세상이 움직이는 원리
├─ 시장·자본·돈
├─ AI 시대 기초
├─ AI 산업 지도
└─ 세부 산업·기업·제품 Atlas

대가의 포트폴리오
├─ 투자자 목록
├─ 핵심 변화
├─ 전체 보유
├─ 섹터·집중도
├─ 분기 추이
└─ 투자 방법론
```

AI Atlas를 별도 top-level로 유지하려면 사용자가 `시장 원리`와 어떤 차이로 인식해야 하는지 한 문장 가치 제안을 명확히 해야 한다.

### P2-02. 내부 용어와 영문 혼용

문제 예시:

- `REFERENCE_CONNECTED`
- `REVIEWED_CANDIDATE`
- `claim packet`
- `evidence ledger`
- `TG-C08`
- 영문 claim summary와 한국어 설명 혼합

권장 사용자 문구:

| 내부 상태 | 사용자 문구 |
|---|---|
| DESIGN_ONLY | 구조 준비 중 |
| REVIEWED_CANDIDATE | 1차 자료 검토 |
| PARTIAL | 일부 자료 확인 |
| NEEDS_REVIEW | 추가 검증 필요 |
| REFERENCE_CONNECTED | 출처 연결됨 |

내부 ID는 출처 drawer 또는 개발자 진단 화면에서만 노출한다.

### P2-03. 그래프 가독성

- light theme에서 edge가 너무 희미함
- node label이 작음
- 관계 유형이 선 모양이나 범례로 구분되지 않음
- selected path 외 전체 맥락이 약함

필수 개선:

- WCAG 대비를 만족하는 edge palette
- 관계 유형별 선 스타일 또는 label
- selected node prerequisite/downstream 분리
- 미니 범례
- reduce-motion 존중
- force simulation 금지 유지

---

## 6. 잘된 부분 — 유지할 계약

다음은 수정 과정에서도 반드시 유지한다.

- Telegram은 discovery/reference이며 1차 검증 전 LIVE 승격 금지
- 현재 데이터와 영구 개념 분리
- 투자자 이름과 실제 신고주체·CIK 분리
- 13F는 전체 자산·실시간 포트폴리오가 아님을 표시
- 매수/매도 성격은 평가액이 아니라 shares 변화 기준
- Minervini는 METHOD_ONLY
- BUY/SELL·목표가·현재가 기반 추천 생성 금지
- safe DOM construction, `innerHTML` 사용 금지
- source URL, reviewedAt/as-of, status 유지
- route lifecycle/re-entry/resource cleanup 유지
- full filing 대량 DOM 초기 생성 금지
- 사용자 지시 없는 commit/push/deploy 금지

---

## 7. 권장 실행 순서

### Batch A — release blockers

1. 13F latest-period 재수집 및 freshness gate
2. accessibility target 수정
3. 보이는 noop 탭 제거 또는 실제 연결

### Batch B — 실제 사용자 흐름

4. Masters 핵심 변화·전체 보유 구현
5. mobile master-detail 전환
6. graph 1-hop/2-hop 실제 계산
7. 내부 ID·영문 상태를 사용자 문구로 변환

### Batch C — 콘텐츠 생산

8. 시장·자본·돈 기본 코스 작성
9. AI 15/30/45분 코스 작성
10. Foundry/DUV-EUV/Memory/Packaging/Photonics/AIDC/Power P0 심화
11. player/product/KPI/source 연결

### Batch D — 확장

12. Masters 섹터·분기 추이·투자자 비교·방법론
13. Cloud/neocloud/physical AI/defense/space/open model 확장
14. 초보자 comprehension test와 NVDA 검수

---

## 8. 완료 판정용 Binary Gate

| ID | Yes 조건 |
|---|---|
| QA-MP1 | Principles mobile smallTargetCount가 0이다. |
| QA-MP2 | 1-hop과 2-hop의 visible graph 집합이 실제로 다르다. |
| QA-MP3 | 모바일 node 선택 후 상세 heading이 즉시 보이고 focus 가능하다. |
| QA-MP4 | 시장 원리 15/30/45분 코스에 실제 lesson body가 있다. |
| QA-AT1 | P0 taxonomy가 L4 player/product까지 내려간다. |
| QA-AT2 | 초보자 화면에 내부 packet ID가 기본 노출되지 않는다. |
| QA-AT3 | 모든 current claim은 primary source와 as-of를 가진다. |
| QA-MF1 | 모든 LIVE_13F latest period가 SEC 최신 available filing과 일치한다. |
| QA-MF2 | 보이는 Masters 탭 중 noop이 없다. |
| QA-MF3 | 전체 보유와 Exited rows를 UI에서 조회할 수 있다. |
| QA-MF4 | 13F 문구가 전체 포트폴리오·현재 매매로 오해되지 않는다. |
| QA-UX1 | 390×844와 1440×900에서 overflow·중첩 세로 스크롤이 없다. |
| QA-UX2 | 키보드만으로 mode/tab/node/manager/detail/source를 탐색할 수 있다. |
| QA-REL1 | 기존 architecture/route-soak/runtime/knowledge gates가 유지된다. |

하나라도 `No`면 `완료` 또는 `배포 준비`로 선언하지 않는다.

---

## 9. 실행 후 필수 검증 명령

```powershell
node --check src/ui/pages/principles.js
node --check src/ui/pages/atlas.js
node --check src/ui/pages/masters.js
node scripts/ci-principles-contract-check.mjs
node scripts/ci-atlas-contract-check.mjs
node scripts/ci-masters-contract-check.mjs
node scripts/ci-principles-browser-check.mjs
node scripts/ci-atlas-browser-check.mjs
node scripts/ci-masters-browser-check.mjs
node scripts/ci-accessibility-matrix-check.mjs
node scripts/ci-architecture-contract-check.mjs
node scripts/ci-architecture-browser-check.mjs
node scripts/ci-vertical-slice-contract-check.mjs
node scripts/ci-vertical-slice-browser-check.mjs
node scripts/ci-route-soak-check.mjs
node scripts/ci-runtime-contract-check.mjs
node scripts/ci-version-check.mjs
node scripts/ci-knowledge-lint-check.mjs
git diff --check
```

추가로 gate를 수정했다면 gate PASS만 근거로 삼지 말고 다음을 source에서 독립 재계산한다.

- route 수
- node/lesson/path 수
- reviewed/current claim 수
- source 수
- manager 수
- latest/prior period와 accession
- full current/prior row 수
- action count
- small target count

---

## 10. 다음 에이전트에게 그대로 전달할 시작 프롬프트

```text
C:\Projects\AIO에서 시장 원리·AI Era Atlas·대가의 포트폴리오 중간 작업을 이어서 보완해줘.

먼저 다음 문서를 순서대로 읽어:
1. AGENTS.md
2. _context/WORKFLOW-GOVERNANCE.md
3. _artifacts/MARKET-PRINCIPLES-MASTERS-MIDPOINT-QA-HANDOFF-2026-08-02.md
4. 위 인계서 §1에 적힌 6개 SSOT 중 작업 대상 문서
5. _context/RULES.md, _context/CODE-MAP.md, 최근 CHANGELOG

중요 원칙:
- 인계서의 P0부터 순서대로 처리한다.
- 기존 사용자 변경을 되돌리지 않는다.
- 테스트 자체를 느슨하게 만들어 통과시키지 않는다.
- gate를 수정했으면 실제 source/data 수량을 독립 재계산한다.
- Telegram claim을 CURRENT/LIVE로 승격하지 않는다.
- 13F 최신성은 SEC 원문으로 검증한다.
- UI에 보이는 noop 버튼을 남기지 않는다.
- 모바일 390×844와 데스크톱 1440×900을 모두 실제 브라우저로 확인한다.
- 코드 변경 시 프로젝트 규칙에 맞게 version/CHANGELOG/QA/postmortem을 동기화한다.
- commit/push/deploy는 사용자가 명시적으로 요청하지 않으면 하지 않는다.

이번 작업 범위를 먼저 P0/P1/P2로 나눠 보고하고, 구현 후 Binary Gate QA-MP1~QA-REL1 결과를 Yes/No 표로 제출해.
```

---

## 11. 최종 제품 방향

이 작업의 목표는 연구 데이터베이스를 사용자에게 그대로 노출하는 것이 아니다.

최종 사용자 경험은 다음 순서를 따라야 한다.

```text
쉽게 이해한다
→ 전체 지도에서 위치를 본다
→ 원리와 인과관계를 배운다
→ 세부 공정·기업·제품으로 내려간다
→ 출처와 반대 논리를 검증한다
→ 기존 전문 페이지에서 현재 데이터를 확인한다
```

내부 제작 상태·claim ID·source packet은 이 학습 흐름을 뒷받침하는 근거 계층이지, 첫 화면의 주인공이 아니다.

