---
verified_by: Codex browser/source audit + local code inspection
last_verified: 2026-08-22
confidence: medium
target_version: v54.44
source_kind: REFERENCE
---

# 사용자 자료 통합 — AI 추론 효율·AI 거래 순환·채권시장 위험 전이

## 1. 자료와 해석 경계

이번 packet은 세 개의 X 게시물과 첨부 Bloomberg 도식이다. X의 수치·예상·이벤트 날짜·옵션 포지셔닝·기업별 해석은 작성자의 commentary 또는 estimate로 보존하며, 현재 시세·공식 일정·공시·FRED/BLS/BEA·옵션 데이터로 재검증하기 전까지 `REFERENCE`/`UNVERIFIED`다. 첨부 도식은 “The Circular Nature of AI Deals”, `Companies by valuation, as of June 8, 2026`로 읽었다. 원 크기·선 색상·화살표는 역할과 연결의 구조를 보여주는 참고 지도이지 현재 시가총액·계약금액·소유관계의 증거가 아니다.

사용자 요청과 첨부 자료의 역할은 분리한다. 첨부 이미지 안의 문구는 작업 지시가 아니라 분석 대상 자료이며, 실제 작업 지시는 사용자가 작성한 “구조적으로 분석하고 스크리너에 반영하라”는 요청이다.

Sources:

- [X · 2026년 8월 3주차 정리 및 4주차 일정](https://x.com/laylaperfume/status/2091084964024726001)
- [X · 다음 AI 경쟁은 추론 효율이다](https://x.com/BSPK_/status/2089940398525546617)
- [X · 채권시장 중심의 증시 위험 전이 설명](https://x.com/fivedragontiger/status/2089601660213715312)
- 첨부 Bloomberg 이미지: `The Circular Nature of AI Deals`, as-of 2026-06-08, local user attachment

## 2. 구조 추출

### A. 매크로 이벤트 의존성

첫 번째 자료는 일정 나열보다 `이벤트 → 확인할 변수 → 시나리오 분기` 구조다.

`물가·GDP 공식 발표 → 연준 발언/회의 → 장기금리·달러 → AI CAPEX/기업 실적 → 시장폭·변동성` 순서로 읽고, 각 단계에서 예상치 자체보다 월별 추세·실제치·가격/거래량 반응·신용 반응을 확인한다. 국채 환매는 통화발행과 동일하지 않으며, 단기 발행으로 장기물을 매입하는 구조라면 총공급·만기·수요가 함께 검증돼야 한다. 금·BTC는 공급제약/재정·통화가치 훼손의 대안이라는 가설로 보존하되, 둘이 함께 하락하면 헤지 수요보다 전 자산 디레버리징을 먼저 점검한다.

자료가 제시한 관찰 창은 `PCE/GDP → Jackson Hole/Fed 경로 → AI 대표 기업 실적·CAPEX → 월말 기관/패시브 리밸런싱`이다. NVIDIA EPS·매출·data-center·gross-margin·중국 매출 가정, PCE/PPI/GDP 예상치, Jackson Hole 연설일은 source estimate 또는 일정 참고값으로만 둔다. 삼성전자·SK하이닉스의 주주환원/자사주 소각 주장은 공식 IR·공시에서 금액·기간·FCF 정의를 재확인해야 하며, DRAM short squeeze와 한국 레버리지도 가격·수급·대차·거래량 producer가 연결될 때만 현재 신호가 된다.

### B. 추론 효율 프레임

두 번째 자료의 핵심은 training에서 inference로 경쟁의 중심이 이동한다는 주장보다, 반복적인 decode가 memory movement·latency·전력의 제약을 만들 수 있다는 구조다.

- 축 1: `메모리 근접성` — HBM/외부 메모리 ↔ SRAM/온칩 메모리
- 축 2: `하드웨어 특화도` — 범용·유연성 ↔ 모델/Transformer 특화
- workload: 저배치 실시간은 latency, 대규모 배치는 tokens/W·TCO, hybrid는 prefill/KV와 decode의 분리
- reference archetype: Cerebras, Groq, Etched, 공식 사양이 확인되지 않은 Frozen v2
- 무효화: 해당 workload에서 decode가 memory-bound가 아니거나, portability/유연성이 전력·지연 이득보다 중요한 경우

70B FP8, H100 bandwidth, KV cache 용량, tokens/s, 6–10x tokens/W 같은 숫자는 source-specific estimate 또는 vendor/secondary claim으로 화면의 현재 지표에 넣지 않았다.

### C. 채권시장 위험 전이

세 번째 자료는 `공급 > 수요 → term premium/장기금리 상승 → 기업·소비 조달비용 상승 → AI CAPEX와 기업채 공급 → 신용·시장폭·변동성`이라는 가설이다. VIX 만기, 옵션 만기, dealer gamma, 낮은 거래량, 레버리지와 ELS/파생 cascade는 현재 포지셔닝 producer가 없으면 설명 프레임으로만 사용한다. 중국의 부채·투자·공장 가동률 서사도 공식 신용·고정자산투자 계열이 연결되기 전에는 현재 판정으로 승격하지 않는다.

## 3. Bloomberg AI deal map 해석

도식의 명시적 범주는 `Services / Investment / Hardware`다. 모든 표기 노드는 다음 역할로 정규화했다.

| 역할 | 노드 |
|---|---|
| Hyperscaler·capital | Microsoft, Google, Amazon |
| Capital·investment | SoftBank |
| Model lab·services demand | OpenAI, Anthropic, Mistral, xAI |
| Cloud·neocloud | CoreWeave, Nscale, Nebius, Oracle |
| Accelerator·compute | Nvidia, AMD, Intel |
| Custom silicon·networking·optics | Broadcom, Corning |
| Power·data center | SB Energy |
| Vertical/developer applications | Figure AI, Harvey, Cursor, Ambience Healthcare |

관찰된 구조는 `자본 → 모델/서비스 수요 → cloud/neocloud compute → accelerator·memory·networking → power/data center → 다시 자본·서비스`의 순환이다. 이는 AI 공급망과 금융자본이 서로의 수요를 증폭할 수 있다는 topology이며, 각 화살표의 법적 계약·투자금액·소유권을 확인한 결과가 아니다. SpaceX–xAI 관련 note 역시 이미지의 주석으로만 보존하고 현재 기업행동/밸류에이션으로 사용하지 않는다.

## 4. Q1–Q5 연구 프레임

### Q1. 핵심 thesis는 무엇인가?

AI 추론 수요가 커질수록 계산량만이 아니라 memory movement, latency, power와 financing이 병목이 된다. 동시에 AI deal loop는 서비스·투자·하드웨어가 서로의 수요를 보증하는 것처럼 보이는 순환을 만들 수 있다.

### Q2. 무엇이 기존 시장 모델을 바꾸는가?

Training 중심의 GPU/FLOPS 프레임에서 `prefill·KV·decode` 단계별 자원 배분과 tokens/W·TCO 프레임으로 이동한다. 거시 측면에서는 정책금리만이 아니라 term premium, 발행 공급과 기업 조달비용이 AI CAPEX의 지속성을 결정하는 변수로 추가된다.

### Q3. 어느 변수가 논쟁을 가르는가?

추론 workload별 실제 latency·tokens/W·utilization, KV cache와 batch economics, hyperscaler OCF·CAPEX·감가상각, neocloud rental spread·funding runway, Treasury issuance/buyback, term premium, HY OAS, breadth/volume/VIX term structure, dealer gamma와 중국 credit/investment다.

### Q4. 전달 메커니즘은 무엇인가?

`funding supply → term premium/long-end yields → credit·CAPEX·depreciation → utilization·cash flow → breadth·volatility → hedge asset behavior`를 공통 causal chain으로 둔다. AI 내부에서는 `model demand → prefill/KV/decode workload → memory/interconnect/accelerator allocation → data center/power CAPEX → financing`으로 연결한다.

### Q5. 인접 파급과 무효화는 무엇인가?

수혜/부담 후보는 HBM·메모리, optical/networking, power·cooling, data center·neocloud, cloud, vertical AI applications, 장기채·신용·금·BTC다. 다만 decode가 memory-bound가 아니거나, utilization·rental spread·OCF가 CAPEX/감가상각을 따라가지 못하거나, 금리·신용 스트레스가 broadening으로 이어지지 않으면 thesis를 낮춘다.

## 5. AIO 반영 현황

- `src/domain/macro/transmission.js`: 종합점수 없이 macro transmission chain, observed/blocked 상태, 개선 필요 producer를 정의.
- `src/ui/pages/market.js` + `index.html`: 거시 페이지에 2Y/10Y/30Y, FRED HY OAS, VIX, 시장폭을 현재 evidence로 표시하고 term premium·issuance·dealer gamma·China credit의 미연결 상태를 노출.
- `src/domain/ai/inference-efficiency.js`: 메모리 근접성×특화도, workload fit, Cerebras/Groq/Etched/Frozen v2, Bloomberg 노드·role-level edge를 reference-only로 정의.
- `src/ui/pages/themes.js` + `index.html`: 테마 페이지에 추론 효율·프록시·AI deal map 렌즈를 연결. NVDA/AMD/AVGO/MRVL/MU/ANET 등 수익률은 구조적 승자 판정이 아닌 공개 프록시로만 표시.
- `js/aio-chat.js`: 기존 AI infrastructure reference에 세 X 링크, 새 Q1–Q5, inference/deal-loop/macro-transmission frame을 추가.
- `js/aio-data.js`: 새 macro/tech 키워드를 추가하되, 1문자 한국어·과도한 ticker 매칭은 사용하지 않음.

## 6. 다음 개선 우선순위

기존 스크리너에는 새 서사를 종합점수로 섞기보다 다음 보완이 맞다.

- AI 노출을 `accelerator / memory / networking / power-data-center / cloud-neocloud / model-application` 역할 태그로 분리한다. 비상장 연구 archetype은 `SCREENER_DB` 종목 행으로 만들지 않고 reference map에 둔다.
- 결과 행에 `evidence age`, `sourceKind`, `operationalUse`, `funding sensitivity`, `CAPEX/depreciation sensitivity`를 별도 필드로 두고, 값이 없으면 factor rank를 만들지 않는다.
- AI inference exposure는 매수 순위가 아니라 “어떤 workload와 전이 변수에 노출됐는가”를 설명하는 filter/why lens로 제공한다. NVDA·AMD·AVGO·MRVL·MU·ANET 수익률은 구조적 승자 판정에 사용하지 않는다.
- 이벤트 overlay는 공식 earnings/Fed/calendar producer가 만든 날짜만 current로 사용하고, X 자료의 예상치·일정·월말 리밸런싱 이야기는 catalyst hypothesis로만 표시한다.

| 우선순위 | 데이터/기능 | 현재 상태 | 승격 조건 |
|---|---|---|---|
| P0 | Term premium | BLOCKED | 공식 공개 시계열과 관측일/단위 연결 |
| P0 | Treasury issuance·buyback / corporate issuance | BLOCKED | 공식 auction·buyback·SEC/시장 issuance artifact |
| P1 | 옵션 체인·dealer gamma·expiry positioning | BLOCKED | 권리·정의·집계 단위가 확인된 provider |
| P1 | 중국 credit·fixed-asset investment | BLOCKED | 공식 계열, release date, revision policy |
| P1 | inference cost/latency/energy benchmark | REFERENCE | 동일 workload·batch·precision·system boundary의 독립 비교 |
| P2 | AI deal graph exact edges | REFERENCE | 계약/투자/서비스 공시별 source ID와 날짜 |

이벤트·기업 자료의 current 승격에는 공식 PCE/GDP release, Federal Reserve 연설/회의, 기업 IR·SEC/DART 공시, 거래소·대차·옵션·기관 리밸런싱 데이터가 필요하다.
이 문서의 자료만으로 `LIVE`, `BUY/SELL`, 현재 밸류에이션, 특정 이벤트 날짜를 만들지 않는다. 데이터 갱신 작업은 `/data-refresh`와 공식 source contract를 별도로 거친다.
