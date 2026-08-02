# MARKET PRINCIPLES KNOWLEDGE GRAPH UX SPEC — 트리·마인드맵·학습 경로

> 상태: **DESIGN_ONLY — 구현 미착수**  
> 작성일: 2026-08-01  
> 상위 문서: `MARKET-PRINCIPLES-PAGE-DESIGN-HANDOFF-2026-08-01.md`  
> AI 상세: `AI-ERA-FOUNDATIONS-CURRICULUM-2026-08-01.md`  
> 목적: 많은 개념을 단순 목록이 아니라 유기적 관계로 이해시키되, 복잡한 그래프가 오히려 학습을 방해하지 않도록 탐색·관계·순서를 분리한다.

---

## 0. 결론

트리와 마인드맵 방식이 일반적인 장문/카드 나열보다 적합하다. 특히 시장·자본·AI는 하나의 개념이 여러 영역을 동시에 연결하기 때문이다.

단, **순수 트리만으로는 부족하다.**

- 미국채 금리는 `채권`의 자식이면서 `주식 밸류에이션`, `달러`, `정부 재정`, `AIDC 자금조달`과도 연결된다.
- 반도체는 `산업`의 자식이면서 `물리학`, `화학`, `AI`, `전력`, `지정학`과 연결된다.
- AI는 `컴퓨터과학`의 자식이면서 `수학`, `반도체`, `데이터센터`, `노동시장`, `자본시장`과 연결된다.

따라서 최종 UX는 다음 3층 구조를 사용한다.

```text
TREE MODE       전체 위치와 상하위 구조를 파악
GRAPH MODE      분야를 가로지르는 원인·제약·자금 흐름을 이해
PATH MODE       초보자가 정해진 순서대로 학습
```

한 문장 원칙:

> **트리는 방향을 주고, 그래프는 연결을 보여주며, 학습 경로는 완주를 돕는다.**

---

## 1. 전체 지식의 뿌리

최상위 root는 `투자`가 아니라 **인간의 삶과 희소성**에서 시작한다. 그래야 경제·자본주의·과학·AI가 억지로 붙은 별도 과목이 아니라 하나의 세계로 연결된다.

```text
세상은 어떻게 움직이는가
├─ 자연과 물리 법칙
│  ├─ 물질
│  ├─ 에너지
│  └─ 정보
├─ 인간과 사회
│  ├─ 욕구
│  ├─ 노동
│  ├─ 협력·경쟁
│  └─ 제도·국가
├─ 희소성과 경제
│  ├─ 생산
│  ├─ 소비
│  ├─ 교환
│  └─ 가격
├─ 돈과 신용
│  ├─ 화폐
│  ├─ 은행
│  ├─ 금리
│  └─ 부채
├─ 자본과 금융시장
│  ├─ 채권
│  ├─ 주식
│  ├─ 환율
│  └─ 파생·유동성
├─ 기업과 산업
│  ├─ 기술
│  ├─ 공급망
│  ├─ 이익
│  └─ 경쟁
└─ AI 시대
   ├─ 수학·알고리즘
   ├─ 모델
   ├─ 칩
   ├─ AIDC
   ├─ 전력·냉각
   └─ 생산성·노동·자본
```

---

## 2. 3개 탐색 모드

### 2-1. TREE MODE — 전체 지도

목적:

- 현재 위치 파악
- 큰 분야→chapter→lesson의 계층 탐색
- 초보자가 선택지를 잃지 않게 함

화면:

```text
[세상은 어떻게 움직이는가]
           │
 ┌─────────┼─────────┐
[자연]   [경제]    [자본]
                     │
             ┌───────┼────────┐
           [금리]   [주식]   [산업]
                              │
                     ┌────────┼────────┐
                  [반도체]  [전력]   [AI]
```

규칙:

- 한 화면에 최대 3 depth만 표시
- 한 node의 primary child는 권장 3~5개, 최대 7개
- 선택 node를 중심으로 부모 1단계+자식 1~2단계만 확장
- 나머지는 축약 count로 표시
- tree edge는 `is-part-of` 또는 `prerequisite`만 사용
- cross-domain 인과관계는 tree에 억지로 넣지 않고 GRAPH MODE에서 표시

### 2-2. GRAPH MODE — 관계 지도

목적:

- 분야를 가로지르는 인과관계
- 돈·에너지·정보·물자의 흐름
- 하나의 충격이 다른 시장으로 전달되는 과정

예시:

```text
[AI 수요]
   ├─enables→ [모델 확대]
   ├─raises-demand-for→ [GPU/ASIC]
   └─raises-demand-for→ [AIDC]

[GPU/ASIC] ─requires→ [HBM]
     │                └─constrained-by→ [첨단 패키징]
     ├─requires→ [네트워크]
     └─consumes→ [전력]

[AIDC] ─requires→ [변압기/송전망]
     ├─requires→ [냉각]
     └─funded-by→ [기업 현금흐름/채권/주식]

[미국채 금리] ─prices→ [자본조달 비용]
              └─discounts→ [AI 기업 미래이익]
```

규칙:

- 선택 node를 중심으로 1-hop 기본, `관계 더 보기` 시 2-hop
- 전체 그래프를 한 번에 펼치지 않음
- 기본 표시 node 9~15개, 최대 24개
- node를 drag해서 위치를 바꾸는 기능은 MVP 제외
- physics simulation으로 계속 흔들리는 force graph 금지
- edge 방향·동사를 반드시 표시
- color만으로 관계 유형을 구분하지 않음
- 같은 node가 여러 부모와 연결돼도 중복 node를 만들지 않음

### 2-3. PATH MODE — 순서대로 배우기

목적:

- 초보자가 그래프에서 길을 잃지 않도록 함
- 특정 질문에 필요한 최소 선수 개념만 제공

예시 경로:

```text
왜 AI는 전기를 많이 쓰는가?

1. bit와 transistor
 → 2. 행렬곱
 → 3. GPU/ASIC
 → 4. HBM과 데이터 이동
 → 5. 전력과 열
 → 6. AIDC 냉각
 → 7. 전력망 병목
```

권장 기본 path:

1. `20분 자본시장 기초`
2. `금리는 어떻게 세상을 움직이는가`
3. `기업과 주가는 어떻게 연결되는가`
4. `AI는 어떻게 답을 만드는가`
5. `AI가 칩·데이터센터·전력이 되는 과정`
6. `반도체 가치사슬 한 바퀴`
7. `전력시장 한 바퀴`
8. `리스크와 복리`

규칙:

- path는 5~9 lesson
- 각 단계에 `왜 다음 단계로 가는가` 연결문 1개
- 사용자가 중간 node로 진입해도 선수 개념을 확인 가능
- 진행률은 localStorage 기반 선택 기능; MVP 필수 아님

---

## 3. 사용자 화면 상태

### 상태 A. 전체 지도

```text
시장 원리 / 자본의 지도
[검색] [트리] [관계 지도] [학습 경로]

              세상은 어떻게 움직이는가
          /          |          |          \
      자연·과학   돈·신용   자본시장    기업·산업
                                           |
                                        AI 시대
```

### 상태 B. node 선택

선택한 node만 강조하고 나머지는 흐리게 한다.

```text
선택: 미국채 금리

부모: 채권
핵심 답: 왜 세계 자산의 할인율 기준인가
연결: 달러 · 재정적자 · 주식 밸류에이션 · AIDC 자금조달
다음 lesson: 수익률 곡선
[3분 설명 읽기] [현재 환율·채권 페이지에서 확인]
```

### 상태 C. lesson 읽기

- 지도는 작은 breadcrumb mini-map으로 축소
- 본문 집중
- 하단에 `이 개념이 연결되는 곳` 3~5개

### 상태 D. 관계 따라가기

```text
AI 수요
  → 왜? 더 많은 학습/추론
GPU/ASIC
  → 무엇이 제한? HBM·패키징·전력
AIDC
  → 무엇이 제한? 계통접속·변압기·냉각
자본시장
  → 무엇이 가격을 결정? 금리·가동률·현금흐름
```

---

## 4. node 유형

| type | 의미 | 예시 |
|---|---|---|
| ROOT | 전체 질문 | 세상은 어떻게 움직이는가 |
| FOUNDATION | 원초 학문/기초 | 에너지, 확률, 정보, 희소성 |
| MECHANISM | 작동 원리 | 복리, 할인, attention, 도핑 |
| SYSTEM | 여러 요소의 결합 | 은행, Transformer, AIDC, 전력망 |
| MARKET | 가격/거래 체계 | 채권시장, 주식시장, 전력시장 |
| ASSET | 금융/실물 자산 | 현금, 국채, 주식, 원자재 |
| INDUSTRY | 가치사슬 | 반도체, 방산, 바이오 |
| ACTOR | 행동 주체 | 가계, 기업, 중앙은행, hyperscaler |
| METRIC | 관측값 | CPI, 10Y, PUE, utilization |
| RISK | 실패/제약 | 신용경색, memory wall, grid bottleneck |
| PRACTICE | 사용/행동 | 검증, position sizing, prompt framing |

node type은 색상만이 아니라 shape/label로도 구분한다.

---

## 5. edge 유형

모든 edge에는 방향과 동사를 넣는다.

| edge | 한국어 라벨 | 예시 |
|---|---|---|
| IS_PART_OF | 구성한다 | HBM → AI accelerator system |
| REQUIRES | 필요로 한다 | AI 칩 → 전력 |
| ENABLES | 가능하게 한다 | Transformer → 대규모 병렬 학습 |
| CAUSES | 영향을 준다 | 금리 상승 → 할인율 상승 |
| CONSTRAINS | 제한한다 | 전력망 → AIDC 증설 |
| FUNDS | 자금을 댄다 | 채권시장 → 기업 CAPEX |
| PRICES | 가격 기준이 된다 | 미국채 금리 → 회사채/주식 |
| CONVERTS_TO | 변환된다 | 전기에너지 → 계산+열 |
| OBSERVED_BY | 여기서 관찰한다 | 달러 유동성 → DXY/스프레드 |
| EXAMPLE_OF | 사례다 | TPU → AI ASIC |
| COMPETES_WITH | 대체/경쟁한다 | GPU ↔ ASIC |
| COMPLEMENTS | 보완한다 | CPU ↔ GPU |
| RISKS | 위험을 준다 | 엔캐리 unwind → 위험자산 |
| PREREQUISITE | 먼저 이해한다 | 확률 → token sampling |
| APPLIED_IN | 현재 적용한다 | 미국채 원리 → 환율·채권 route |

금지 edge:

- `관련 있음`처럼 방향과 의미가 없는 연결
- 사실·가설을 구분하지 않은 인과
- 현재 상관관계를 영구적 인과로 고정

---

## 6. 관계의 신뢰도와 성격

edge에도 metadata가 필요하다.

- `kind`: PRINCIPLE / HISTORICAL / OBSERVATION / THESIS
- `strength`: CORE / CONTEXTUAL / CONDITIONAL
- `polarity`: POSITIVE / NEGATIVE / NON_MONOTONIC / NONE
- `conditions`: 작동 조건
- `sourceIds`
- `reviewedAt`

예시:

```json
{
  "from": "treasury-yield",
  "to": "equity-valuation",
  "type": "PRICES",
  "label": "할인율 기준이 된다",
  "kind": "PRINCIPLE",
  "strength": "CORE",
  "polarity": "NON_MONOTONIC",
  "conditions": ["이익 전망과 위험 프리미엄이 동시에 변할 수 있음"],
  "sourceIds": ["..."],
  "reviewedAt": "YYYY-MM-DD"
}
```

`금리 상승→주가 하락`을 단순 NEGATIVE로 만들지 않고, 조건과 비단조성을 표시하는 이유다.

---

## 7. AI 시대의 지식 지도

```text
AI 시대
├─ 원초 학문
│  ├─ 수학: 벡터·행렬·확률·최적화·정보
│  ├─ 물리: 전기·전자기·열·광학·양자
│  ├─ 화학: 실리콘·도핑·증착·포토·식각
│  ├─ 컴퓨터: bit·병렬처리·메모리·네트워크
│  └─ 경제: 규모·고정비·병목·CAPEX·생산성
├─ 학습
│  ├─ 데이터
│  ├─ 신경망
│  ├─ loss/backprop
│  ├─ 사전학습
│  └─ 후속학습·평가
├─ 모델
│  ├─ Transformer
│  ├─ Diffusion
│  ├─ Multimodal
│  └─ World Model
├─ 시스템
│  ├─ RAG
│  ├─ Tool Use
│  ├─ Agent
│  └─ Serving
├─ 하드웨어
│  ├─ CPU
│  ├─ GPU
│  ├─ ASIC/NPU/TPU
│  ├─ HBM
│  └─ Network/Optics
├─ 제조
│  ├─ IP/EDA
│  ├─ 장비·소재
│  ├─ Foundry/Memory
│  ├─ Packaging
│  └─ Test/Server
├─ AIDC
│  ├─ Training/Inference
│  ├─ Rack/Network/Storage
│  ├─ Power
│  └─ Cooling
└─ 사회·경제
   ├─ 생산성
   ├─ 노동
   ├─ 수익화
   ├─ 자본지출
   ├─ 지정학·규제
   └─ 위험
```

주요 cross-link:

```text
행렬곱 ─enables→ 신경망 계산 ─runs-on→ GPU/ASIC
GPU/ASIC ─requires→ HBM ─requires→ 첨단 패키징
GPU/ASIC ─installed-in→ AIDC ─requires→ 전력망
AIDC ─funded-by→ 현금흐름/채권/주식
미국채 금리 ─prices→ AIDC 자금조달·AI 기업 밸류에이션
AI 효율 ─may-lower→ 단위비용 ─may-raise→ 총사용량
World Model ─enables→ 로봇 계획 ─requires→ 센서/edge chip/actuator
```

---

## 8. 데이터 스키마

### graph.json

```json
{
  "schemaVersion": "principles-graph.v1",
  "rootNodeId": "how-the-world-moves",
  "nodes": [],
  "edges": [],
  "paths": []
}
```

### node

```json
{
  "id": "ai-asic",
  "type": "SYSTEM",
  "title": "AI ASIC",
  "shortTitle": "ASIC",
  "question": "ASIC은 왜 생겨났고 언제 GPU보다 유리한가?",
  "answer30s": "...",
  "primaryParentId": "ai-hardware",
  "chapterId": "ai-era",
  "lessonId": "why-ai-asic",
  "level": "BEGINNER",
  "tags": ["ai", "chip", "economics"],
  "relatedRouteIds": ["themes", "fundamental"],
  "sourceIds": [],
  "reviewedAt": "YYYY-MM-DD"
}
```

### path

```json
{
  "id": "why-ai-needs-power",
  "title": "왜 AI는 전기를 많이 쓰는가",
  "audience": "BEGINNER",
  "estimatedMinutes": 25,
  "nodeIds": [
    "bit-transistor",
    "matrix-multiplication",
    "gpu-asic",
    "memory-wall",
    "energy-heat",
    "aidc-cooling",
    "grid-bottleneck"
  ]
}
```

---

## 9. 과밀 방지 규칙

마인드맵의 가장 큰 실패는 `모든 것을 보여주려다 아무것도 읽히지 않는 것`이다.

### 화면 제한

- 기본 node 9~15개
- 최대 node 24개
- 한 node의 visible edge 최대 7개
- label 최대 2줄
- 긴 설명은 node 안이 아니라 선택 상세에서 표시
- zoom-out 시 chapter title만 표시
- zoom-in 시 lesson 표시
- edge 겹침이 많으면 관계 유형 filter가 아니라 선택 node 중심 view로 축소

### 편집 제한

- primaryParent는 1개
- cross-link는 핵심 3~7개
- 같은 내용을 나타내는 alias node 생성 금지
- 지나치게 일반적인 node(`경제`, `시장`)는 intermediate hub로만 사용
- leaf node는 반드시 읽을 lesson 또는 외부 전문 route와 연결
- dead-end node 금지

### 인지부하 제한

- 최초 화면에서 금융·AI·산업 전체 leaf를 표시하지 않음
- animation은 선택/확장 시 짧은 transition만
- 자동 회전·움직이는 force layout 금지
- 사용자가 node 위치를 기억할 수 있도록 layout 안정성 유지

---

## 10. 검색과 발견

검색 예시 `미국채`:

- node 직접 결과: 미국채
- 질문 결과: 미국채 금리는 왜 중요한가
- 연결 결과: 달러, 할인율, 국채 담보, 재정적자
- 전문 페이지: 환율·채권
- 학습 경로: 금리는 어떻게 세상을 움직이는가

동작:

- 검색 결과를 별도 목록으로만 보여주지 않고 graph에서 해당 node까지의 경로를 강조
- 동의어/영문/약어 지원: `미국채`, `Treasury`, `UST`, `10Y`
- 용어사전 alias를 재사용
- 0건이면 유사어 제안만 하고 임의 node 생성 금지

---

## 11. Deep link와 상태

공유해야 하는 상태:

- mode: tree/graph/path/lesson
- selected node
- active path와 step
- chapter/lesson

공유하지 않아도 되는 상태:

- 일시적 pan/zoom 위치
- hover
- 펼친 부가설명

권장 개념:

```text
?page=principles&mode=graph&node=ai-asic
?page=principles&mode=path&path=why-ai-needs-power&step=4
```

실제 URL 형식은 현행 router 계약에 맞춘다.

---

## 12. 모바일과 접근성

그래프 canvas만 제공하면 접근성 실패다.

### 모바일

- 기본은 focus node 중심 세로 구조
- 부모→현재→자식→관련 node 순서
- 전체 tree는 accordion
- edge는 문장으로 변환

예:

```text
AI ASIC
├─ 상위: AI 하드웨어
├─ 필요: 행렬곱·메모리·compiler
├─ 경쟁/보완: GPU·FPGA
├─ 연결: HBM·파운드리·AIDC·전력
└─ 현재 적용: 테마·트렌드 페이지
```

### 접근성

- SVG에 title/desc
- keyboard로 node 이동/선택
- 선택 node에 visible focus
- node와 edge 전체를 동등한 nested list/text alternative로 제공
- color 외 shape/edge label 사용
- screen reader 순서는 root→depth→node
- zoom/pan이 핵심 콘텐츠 접근의 유일한 수단이 되지 않음

---

## 13. 시각 스타일

- root와 선택 node만 강한 대비
- 다른 node는 중립 surface
- node type별 색상 수를 4~6개 이내로 제한
- edge는 얇은 중립선+동사 label
- `위험/제약` edge만 별도 패턴/아이콘
- 모든 node를 카드처럼 만들지 않음
- 과도한 shadow/gradient/glow 금지
- 현재 AIO의 serif 제목, 차분한 배경, hairline border 계승

권장 shape:

- ROOT: double circle 또는 큰 원
- FOUNDATION: circle
- MECHANISM: rounded rectangle
- SYSTEM/MARKET/INDUSTRY: rectangle
- RISK: diamond 또는 경고 marker
- PRACTICE: pill/terminal node

---

## 14. 구현 옵션

### 권장 MVP

- deterministic SVG layout
- chapter별 수동 좌표 또는 계층 layout
- node select/expand
- path highlight
- text alternative
- 외부 graph library 없이도 가능

### 후속 확장

- D3 hierarchy/graph
- minimap
- 사용자 bookmark
- compare two nodes
- `이 충격이 어디로 번지는가` scenario traversal

### 비권장

- WebGL/3D 우주형 그래프
- 항상 움직이는 force simulation
- 수백 node 한 화면 렌더
- 사용자 drag 위치를 핵심 정보구조로 저장
- 그래프만 있고 읽을 lesson이 없는 구조

---

## 15. 구현 작업 패킷

### KG-00. ontology 동결
- node/edge type
- root tree
- AI cross-link
- canonical node ID

### KG-01. graph content
- MVP 60~90 node
- primary parent
- 핵심 edge
- 8개 path
- orphan/duplicate audit

### KG-02. tree mode
- 3-depth navigation
- stable layout
- selected state
- breadcrumb

### KG-03. graph mode
- 1-hop/2-hop
- edge label/direction
- node detail
- relationship text alternative

### KG-04. path mode
- ordered steps
- why-next transition
- resume/deep link

### KG-05. search
- alias index
- path highlight
- route/lesson integration

### KG-06. mobile/a11y
- accordion/list fallback
- keyboard
- SVG title/desc
- screen reader order

### KG-07. gates
- node id uniqueness
- no orphan leaf
- every edge references valid nodes
- max visible density
- source/reviewedAt
- route/deep-link/back-forward

---

## 16. 완료 기준

- 사용자가 전체 root에서 `AI ASIC`까지 3단계 이내 탐색 가능
- `AI ASIC`에서 GPU/HBM/AIDC/전력/경제성 연결을 한 화면에서 이해 가능
- `미국채 금리`에서 주식·달러·재정·AI CAPEX 연결을 확인 가능
- 초보자는 graph를 사용하지 않고 PATH MODE만으로 학습 가능
- 선택 node 외 모든 node가 동시에 확장되지 않음
- 모바일에 동등한 세로 텍스트 구조가 있음
- node/edge/lesson/전문 route가 서로 dead-end 없이 연결됨

---

## 17. 후속 에이전트 시작 프롬프트

```text
_context/MARKET-PRINCIPLES-KNOWLEDGE-GRAPH-UX-SPEC-2026-08-01.md를
시장 원리 페이지의 탐색/시각화 SSOT로 읽어라.
TREE/GRAPH/PATH 3모드를 하나의 복잡한 force graph로 합치지 마라.
KG-00 ontology 동결 전에는 graph renderer를 구현하지 마라.
기본 화면 9~15 node, 선택 중심 1-hop, 모바일 text alternative 계약을 지켜라.
이 문서는 DESIGN_ONLY이며 구현 완료가 아니다.
```
