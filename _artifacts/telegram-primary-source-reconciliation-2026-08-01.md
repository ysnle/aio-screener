# Telegram 발견 프레임워크 1차 출처 대조 원장 — 2026-08-01

> 상태: `DRAFT_PRIMARY_RECONCILIATION` / `REFERENCE_ONLY` / `DESIGN_ONLY`
> 입력: `_artifacts/telegram-5d-research-packet-2026-08-01.md`
> 조사 창: `2026-07-28 00:00 KST` 이후 2026-08-01 관측 시점까지
> 목적: Telegram에서 반복 발견된 framework를 공식 1차 출처와 대조하여 `REVIEWED_CANDIDATE`, `PARTIAL`, `NEEDS_REVIEW`로 분기
> 금지: Telegram 수치·전망·목표가·속보를 LIVE 데이터, Trading Score, current company fact, 13F 데이터로 승격

## 1. 판정 규칙

| 판정 | 의미 | 허용 소비 |
|---|---|---|
| `REVIEWED_CANDIDATE` | 공식 1차 자료가 framework의 좁은 명제를 직접 지지하지만 canonical ontology가 아직 동결되지 않음 | 저충실도 Tree/Graph/Path 후보 |
| `PARTIAL` | 인과 사슬의 일부만 공식 자료로 지지됨. 나머지는 추가 원자료가 필요함 | 보류된 edge와 검증 질문 |
| `NEEDS_REVIEW` | 현재 공식 자료만으로는 핵심 명제를 지지하지 못함 | discovery/question만 |
| `BLOCKED_NUMERIC` | Telegram 숫자·예측·가격 레벨을 원장에 보존하지 않고 차단함 | 어떤 화면·신호에도 사용 금지 |

`Telegram`은 발견 source이며 독립적인 primary evidence가 아니다. 기업의 자사 발표는 제품·전략·자사 재무에 한정해 사용하고, 산업 전체의 수급·시장 가격·인과로 일반화하지 않는다.

## 2. 1차 출처 registry

| Source ID | 공식 출처 | 날짜 | 확인 가능한 범위 |
|---|---|---:|---|
| `PS-01` | [TSMC 2026 AGM minutes](https://investor.tsmc.com/sites/ir/shareholders-meeting/2026-06-04/2026AGM_Minutes_wmn.pdf) | 2026-06-04 | AI 수요, 선단 공정, advanced packaging, capacity 투자에 대한 회사의 설명 |
| `PS-02` | [Micron HBM4 / PCIe Gen6 SSD / SOCAMM2 발표](https://investors.micron.com/news-releases/news-release-details/micron-high-volume-production-hbm4-designed-nvidia-vera-rubin) | 2026-03-16 | HBM·메모리·데이터센터 SSD가 AI 시스템의 서로 다른 구성요소라는 제품 수준 근거 |
| `PS-03` | [Kioxia Investor Day 2026](https://www.kioxia-holdings.com/content/dam/kioxia-hd/en-jp/ir/library/event/asset/Kioxia-Investor-Day-2026-en.pdf) | 2026-06-02 | 1년 LTA에서 다년 LTA로의 전환, earnings volatility 완화, AI 인프라·고가 SSD 전략 |
| `PS-04` | [Kioxia AI inference growth strategy](https://www.kioxia-holdings.com/en-jp/news/2026/20260602-1.html) | 2026-06-02 | 추론 workload와 KV cache·SSD 제품의 연결에 대한 자사 전략 |
| `PS-05` | [Kioxia BiCS10 sample shipment](https://apac.kioxia.com/en-apac/about/news/2026/20260703-1.html) | 2026-07-03 | enterprise/data-center SSD와 AI storage 요구의 제품 수준 연결 |
| `PS-06` | [Microsoft 2026 Q3 Form 10-Q](https://www.sec.gov/Archives/edgar/data/789019/000119312526191507/msft-20260331.htm) | 2026-03-31 | AI 인프라 투자에 따른 cloud cost/gross-margin 및 compute capacity 설명 |
| `PS-07` | [Meta 2026 Q1 Form 10-Q](https://www.sec.gov/Archives/edgar/data/1326801/000162828026028526/meta-20260331.htm) | 2026-03-31 | AI 관련 CAPEX, servers/data centers/network, contractual commitments |
| `PS-08` | [Oracle 2026 Q3 Form 10-Q](https://www.sec.gov/Archives/edgar/data/1341439/000119312526101045/orcl-20260228.htm) | 2026-02-28 | data-center expansion에 따른 CAPEX 증가 및 lease/power/interest 비용 구조 |
| `PS-09` | [Federal Reserve Monetary Policy Report — July 2026](https://www.federalreserve.gov/monetarypolicy/2026-07-mpr-summary.htm) | 2026-07-10 | energy/oil shock → inflation → rates/financial conditions 전파의 공식 설명 |
| `PS-10` | [BLS CPI — June 2026](https://www.bls.gov/news.release/cpi.htm?lv=true) | 2026-07-14 | 에너지·가솔린 가격과 CPI 관측값. 관측값 자체만 사용 |
| `PS-11` | [EIA Short-Term Energy Outlook](https://www.eia.gov/outlooks/steo/report/petro_prod.php) | 2026-06-09 | 공급 차질과 석유제품 가격 경로. 전망은 전망으로만 라벨링 |
| `PS-12` | [NIST AI 800-3 benchmark evaluation toolbox](https://www.nist.gov/news-events/news/2026/02/new-report-expanding-ai-evaluation-toolbox-statistical-models) | 2026-02-19 | AI 평가를 단일 순위가 아닌 통계적 검증 문제로 다뤄야 한다는 평가 방법론 |
| `PS-13` | [DOE/LLNL Stormbreaker testbed](https://www.energy.gov/ceser/articles/ceser-releases-new-testbed-advance-llm-and-agentic-ai-evaluation-critical) | 2026-07-16 | LLM/agentic AI를 실제 critical-infrastructure 환경에서 평가하는 필요성 |
| `PS-14` | [METI manufacturing-base report](https://www.meti.go.jp/english/press/2026/0415_001.html) | 2026-04-15 | 지정학적 위험, equipment/materials, 제조 생태계·공급망 resilience |
| `PS-15` | [METI Japan-US strategic investment projects](https://www.meti.go.jp/english/press/2026/0218_002.html) | 2026-02-18 | AI data center 전력 및 반도체 소재·장비 공급망의 정책/프로젝트 범위 |

## 3. Claim-level evidence ledger

| Claim ID | Telegram discovery | 좁혀 쓴 검증 명제 | 1차 출처 | 판정 | 승격 결정 |
|---|---|---|---|---|---|
| `TG-C01` | `TG-F1` | AI 시스템의 제약은 compute만이 아니라 memory, advanced packaging, storage, power 등 여러 계층에 걸쳐 나타난다 | `PS-01`, `PS-02` | `PARTIAL` | `REVIEWED_CANDIDATE` edge로 보류. “GPU에서 다른 병목으로 이동했다”는 시간적 일반화는 추가 산업 자료 필요 |
| `TG-C02` | `TG-F2` | 다년 LTA는 공급자 관점에서 매출 가시성과 earnings volatility 완화의 수단이 될 수 있다 | `PS-03` | `REVIEWED_CANDIDATE` | `candidate.memory.lta → candidate.ai.revenue-visibility`만 후보 승격. customer concentration/downside 완화는 미검증 |
| `TG-C03` | `TG-F3` | AI CAPEX는 수요 서사와 별개로 감가상각·cloud cost·FCF·commitment·자금조달을 함께 봐야 한다 | `PS-06`, `PS-07`, `PS-08` | `REVIEWED_CANDIDATE` | `candidate.ai.capex → candidate.ai.financing-credit` 후보. ROIC·신용스프레드의 현재 판정은 별도 재무/채권 자료 필요 |
| `TG-C04` | `TG-F4` | 실적 방향과 주가 방향이 기대치·positioning·forced flow에 의해 분리될 수 있다 | 없음 | `NEEDS_REVIEW` | 현재는 검증 질문만 유지. Telegram flow/ticker 언급을 시장 인과 증거로 사용하지 않음 |
| `TG-C05` | `TG-F5` | 에너지·유가 공급 충격은 물가와 금리·금융여건으로 전파될 수 있다 | `PS-09`, `PS-10`, `PS-11` | `REVIEWED_CANDIDATE` | `candidate.macro.geo-oil-rates → candidate.ai.financing-credit`의 macro transmission 후보. valuation/flows edge는 시장자료 추가 필요 |
| `TG-C06` | `TG-F6` | AI 경제성 비교는 token price 하나가 아니라 task quality, latency, reliability, energy/TCO 같은 workload 조건을 포함해야 한다 | `PS-12`, `PS-13` | `PARTIAL` | 평가 차원 node만 후보 승격. 특정 모델·벤치마크 우열과 비용 수치는 별도 원자료 없이는 차단 |
| `TG-C07` | `TG-F7` | 일본 공급망의 AI 관련 기회와 위험은 장비·소재·전력·공급망 resilience를 함께 봐야 한다 | `PS-14`, `PS-15` | `PARTIAL` | 일본 공급망/정책 node 후보. 특정 기업 수혜·매출·공급 부족 주장은 기업 IR 추가 필요 |
| `TG-C08` | `TG-F8` | 추론 workload의 확산은 KV cache·enterprise/data-center SSD 같은 저장 계층의 제품 요구를 바꿀 수 있다 | `PS-03`, `PS-04`, `PS-05`, `PS-02` | `REVIEWED_CANDIDATE` | `candidate.inference → candidate.storage-demand` 제품-level edge 후보. NAND 전체 수급·가격 전망은 차단 |

## 4. 현재 승격 가능한 구조와 보류 구조

```yaml
status: REVIEWED_CANDIDATE
sourceKind: REFERENCE
researchRole: DISCOVERY
nodes:
  - id: candidate.ai.capex
    status: REVIEWED_CANDIDATE
    evidence: [PS-06, PS-07, PS-08]
  - id: candidate.memory.lta
    status: REVIEWED_CANDIDATE
    evidence: [PS-03]
  - id: candidate.ai.packaging-memory-storage
    status: REVIEWED_CANDIDATE
    evidence: [PS-01, PS-02, PS-03, PS-04, PS-05]
  - id: candidate.ai.financing-credit
    status: CANDIDATE
    evidence: [PS-06, PS-07, PS-08, PS-09]
  - id: candidate.macro.geo-oil-rates
    status: REVIEWED_CANDIDATE
    evidence: [PS-09, PS-10, PS-11]
  - id: candidate.ai.evaluation-dimensions
    status: REVIEWED_CANDIDATE
    evidence: [PS-12, PS-13]
  - id: candidate.japan.supply-chain-resilience
    status: CANDIDATE
    evidence: [PS-14, PS-15]
  - id: candidate.ai.inference-storage
    status: REVIEWED_CANDIDATE
    evidence: [PS-02, PS-03, PS-04, PS-05]
edges:
  - from: candidate.ai.capex
    to: candidate.ai.packaging-memory-storage
    type: DEMAND_OR_CONSTRAINT
    status: CANDIDATE
  - from: candidate.memory.lta
    to: candidate.ai.revenue-visibility
    type: VISIBILITY
    status: REVIEWED_CANDIDATE
  - from: candidate.ai.capex
    to: candidate.ai.financing-credit
    type: FINANCING_TRADEOFF
    status: REVIEWED_CANDIDATE
  - from: candidate.macro.geo-oil-rates
    to: candidate.ai.financing-credit
    type: TRANSMISSION
    status: REVIEWED_CANDIDATE
  - from: candidate.ai.inference
    to: candidate.ai.inference-storage
    type: WORKLOAD_REQUIREMENT
    status: REVIEWED_CANDIDATE
```

위 구조는 `DEEP-00/KG-00` 전에는 canonical ID가 아니다. `REVIEWED_CANDIDATE`는 공식 근거가 있다는 뜻이지 `PUBLISHED` 또는 LIVE라는 뜻이 아니다.

## 5. 차단된 주장

- Telegram에 등장한 3~5일 수치, 가격 레벨, 목표가, 출하량, yield, “전량 매진”, 고객별 예약 비중은 이 원장에 근거값으로 승격하지 않는다.
- Kioxia의 LTA 설명은 Kioxia의 전략 명제다. 이를 메모리 산업 전체의 customer concentration 또는 cycle downside 제거로 일반화하지 않는다.
- Meta/Microsoft/Oracle의 CAPEX 공시는 각 회사의 비용·투자·약정 사실이다. “AI 수요가 강하므로 모든 AI 종목의 FCF가 개선된다”는 결론은 허용하지 않는다.
- Fed/BLS/EIA 자료는 유가·물가·금리의 관측/정책 경로를 지지하지만, 특정 날짜의 주가 방향·강제청산·valuation multiple을 증명하지 않는다.
- 기업 제품 발표는 제품 positioning과 공급사 주장을 보여주며, 전체 NAND/HBM 수급·가격·산업 TAM의 독립 증거가 아니다.

## 6. Gate 결과

| Gate | 조건 | 결과 |
|---|---|---|
| `TG-8` | framework마다 공식 출처 ID와 검증 범위를 연결했다 | `YES` |
| `TG-9` | 부분 지지만 있는 인과고리를 `PARTIAL`로 분리했다 | `YES` |
| `TG-10` | current numeric claim을 1차 출처와 대조했다 | `NO` — 일부 수치 claim은 별도 claim packet 필요 |
| `TG-11` | `REVIEWED_CANDIDATE`를 canonical/PUBLISHED/LIVE로 오인하지 않게 했다 | `YES` |
| `TG-12` | F4 positioning/forced-flow edge에 독립 primary evidence가 있다 | `NO` |
| `TG-13` | 저충실도 화면에 넣을 node/edge의 source badge/status를 정했다 | `YES` |

## 7. 저충실도 단계로 넘기는 범위

다음 12개 노드만 저충실도 검증의 입력으로 허용한다: `AI era`, `AI workload`, `compute`, `memory/HBM`, `advanced packaging`, `storage/SSD`, `power/cooling`, `AI CAPEX`, `revenue visibility/LTA`, `financing/credit`, `geo/oil/rates`, `evaluation dimensions`.

저충실도 화면에서는 각 노드에 `source status`와 `evidence count`를 노출하고, `F4 positioning/forced-flow`, 고객집중 리스크, 가격·출하·yield 수치는 기본 화면에서 숨긴다. 모든 링크는 `REFERENCE → primary-source reconciliation → candidate` 순서를 보존해야 한다.

이 원장은 구현·버전 변경·배포 승인을 발생시키지 않는다.
