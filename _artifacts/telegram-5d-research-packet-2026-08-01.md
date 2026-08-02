# Telegram 5일 연구 패킷 — 2026-08-01

> 상태: `REFERENCE_ONLY` / `DISCOVERY` / `DESIGN_ONLY`
> 조사 창: `2026-07-28 00:00 KST` 이후, 2026-08-01 관측 시점까지
> 목적: 시장 원리·AI 시대 지식 그래프의 후보 node/edge/question 생성
> 금지: 이 문서의 Telegram 수치·전망·속보를 LIVE 데이터·매매 신호·기업 사실로 승격

## 1. 조사 완전성

기존 자동 산출물은 3개 채널만 정식으로 보존한다. `public-data/telegram-digest.json`의 2026-08-01T07:15:57Z 산출물에서 조사 창에 관측된 경량 lineage는 813건이다. 이 숫자는 공개 미러 기반 `observedItems`이며, 본문 전체 재배포가 아니다.

| 채널 | 조사 창 관측 | 상태 | 해석 |
|---|---:|---|---|
| `aetherjapanresearch` | 235 | `REFERENCE_READY` | 일본/미국 sell-side·장비·메모리·AI 인프라 |
| `insidertracking` | 465 | `REFERENCE_READY` | macro·지정학·flows·기업/실적·AI 전력 |
| `bornlupin` | 113 | `REFERENCE_READY` | 한국/미국 메모리·실적·수출·NAND/SSD |
| `survival_DoPB` | 2 | `SPARSE_REFERENCE` | 조사 창 내 실제 관측은 희소; Kioxia/SK하이닉스 소재 중심 |
| `Onionfarmer` | 0 | `STALE_FOR_WINDOW` | 로그인 채널의 최신 관측이 2026-07-21; 이번 3~5일 창에는 신규 표본 없음 |

따라서 이번 작업은 **5개 채널 전수 조사 완료**가 아니다. 기존 3개 채널의 rolling lineage와 브라우저 표본을 재사용하고, 두 채널은 접근성·신선도만 판정한 **부분 source packet**이다. `Onionfarmer`의 과거 게시물은 역사적 discovery로만 취급한다.

## 2. 반복해서 나타난 framework 후보

아래는 원문 복사가 아니라 여러 게시물에서 반복된 질문 구조다. 공식 출처 대조 전에는 `CANDIDATE`다.

| ID | framework | provisional graph edge | 1차 검증 대상 |
|---|---|---|---|
| TG-F1 | 병목은 GPU에서 메모리·패키징·광·전력·냉각·허가/금융으로 이동한다 | `AI demand → bottleneck → supplier economics` | 기업 IR·SEMI/JEDEC/IEEE·DOE/LBNL |
| TG-F2 | LTA·선급금·capacity reservation은 메모리/서버부품 cycle의 downside와 customer concentration을 함께 바꾼다 | `LTA → revenue visibility` + `LTA → concentration risk` | 삼성전자·SK하이닉스·Kioxia·부품사 IR |
| TG-F3 | AI CAPEX는 수요만이 아니라 감가상각·FCF·부채·리스·스프레드의 문제다 | `AI CAPEX → financing → ROIC/credit` | hyperscaler 10-Q/10-K·채권자료·SEC |
| TG-F4 | 실적의 방향과 주가의 방향은 기대치·포지셔닝·강제청산에 의해 분리될 수 있다 | `earnings surprise → positioning/flows → price` | SEC/IR·거래소·공식 지표 |
| TG-F5 | 지정학·유가 충격은 인플레이션·금리·달러·밸류에이션 경로로 전파된다 | `geo/oil → inflation/rates → valuation/flows` | Fed·BLS/BEA·EIA·정부 발표 |
| TG-F6 | 오픈 모델/추론 확산은 token price가 아니라 correct task·latency·reliability·TCO로 비교해야 한다 | `model economics → workload → storage/compute demand` | model card·benchmark 원자료·기업 기술문서 |
| TG-F7 | 일본 장비·부품·자동차/전자 공급망은 AI 서버·MLCC·패키징·지진/복구 리스크가 함께 보인다 | `Japan supply chain → AI infrastructure constraints` | 기업 IR·METI·공식 재난/복구 발표 |
| TG-F8 | AI 추론·에이전트 확산은 SSD/NAND/UFS/스토리지 요구를 바꿀 수 있다 | `inference/agent → storage demand` | Kioxia earnings call·NAND/SSD 공식 자료 |

## 3. 지식 그래프 승격 후보

아직 canonical ID가 동결되지 않았으므로 `candidate` namespace만 사용한다.

```yaml
nodes:
  - id: candidate.ai.capex
    kind: CONCEPT
    parent: candidate.ai.economics
  - id: candidate.memory.hbm-dram-nand
    kind: TECHNOLOGY
    parent: candidate.ai.infrastructure
  - id: candidate.memory.lta
    kind: BUSINESS_MODEL
    parent: candidate.memory.hbm-dram-nand
  - id: candidate.ai.packaging
    kind: TECHNOLOGY
    parent: candidate.ai.infrastructure
  - id: candidate.ai.optics-network
    kind: TECHNOLOGY
    parent: candidate.ai.infrastructure
  - id: candidate.ai.power-grid-cooling
    kind: INFRASTRUCTURE
    parent: candidate.ai.infrastructure
  - id: candidate.ai.financing-credit
    kind: MARKET_MECHANISM
    parent: candidate.ai.economics
  - id: candidate.macro.geo-oil-rates
    kind: CAUSAL_HUB
    parent: candidate.market
edges:
  - from: candidate.ai.capex
    to: candidate.memory.hbm-dram-nand
    type: DEMAND
    status: CANDIDATE
  - from: candidate.memory.lta
    to: candidate.ai.financing-credit
    type: RISK_TRADEOFF
    status: CANDIDATE
  - from: candidate.ai.capex
    to: candidate.ai.power-grid-cooling
    type: BOTTLENECK
    status: CANDIDATE
  - from: candidate.macro.geo-oil-rates
    to: candidate.ai.financing-credit
    type: TRANSMISSION
    status: CANDIDATE
```

## 4. 화면·페이지 소비 경계

| 소비 surface | 허용 | 금지 |
|---|---|---|
| `시장 원리 / 자본의 지도` | 검증된 framework, causal edge, bull/bear question | Telegram 목표가·단기 전망·현재 숫자 복제 |
| AI foundations / Atlas | 공식 source로 재검증한 원리·가치사슬·경제성 | 채널 주장을 canonical lesson으로 직접 게시 |
| `market-news` / `briefing` | `REFERENCE`로 표시된 discovery 문맥 | Telegram을 현재 판단의 primary evidence로 표시 |
| `themes` / `fundamental` / `ticker` | 공식 IR·공시로 재검증된 current claim | Telegram 숫자만으로 memo·signal·추천 생성 |
| Masters / 13F | SEC EDGAR 원본 기반 별도 pipeline | Telegram 자료로 보유내역 추정 |

## 5. Binary gate

| Gate | 조건 | 현재 |
|---|---|---|
| TG-1 | 기간·채널별 coverage와 stale 상태를 기록했다 | YES |
| TG-2 | `sourceKind=REFERENCE`, `researchRole=DISCOVERY`로 고정했다 | YES |
| TG-3 | forwarding/중복을 5개 채널 전체에서 확정 제거했다 | NO — 추가 수집 필요 |
| TG-4 | 모든 current claim을 1차 출처와 대조했다 | NO — claim packet 단계 필요 |
| TG-5 | candidate node/edge가 canonical ontology·source·reviewedAt를 가졌다 | NO — `DEEP-00/KG-00` 이후 |
| TG-6 | 검증 전 LIVE/Trading Score/매매신호 입력으로 유입되지 않는다 | YES |
| TG-7 | Tree/Graph/Path 저충실도 화면에서 9~15 node·1-hop·모바일 대체 구조를 검증했다 | NO — low-fi 단계 필요 |

## 6. 다음 정식 순서

1. `ATLAS-00` / `DEEP-00` / `MP-00` / `KG-00`: ontology·scope·canonical owner 동결
2. `TG-ATLAS-00~01`: 3~5일 rolling window, channel coverage, dedup, entity/URL inventory
3. `TG-ATLAS-02`: 반복 framework별 공식 원출처 reconciliation 및 evidence ledger
4. 검증된 일부 node만 `REVIEWED` 구조화 데이터로 승격; 나머지는 `CANDIDATE/NEEDS_REVIEW`
5. KG low-fi: TREE/GRAPH/PATH, 9~15 node, 1-hop, text alternative, deep link 검증
6. 승인 후 `MP-01→MP-08`, AI `AI-0→AI-6`, KG `KG-01→KG-07` 구현
7. 13F는 Telegram과 분리하여 `MF-00→MF-09` SEC pipeline으로 진행

이 패킷만으로는 구현 승인·버전 변경·배포 승인이 발생하지 않는다.
