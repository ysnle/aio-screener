// Generated from the exported Principles catalog; edit the relation profile and regenerate.
export const PRINCIPLE_EDGE_SEMANTICS = Object.freeze({
  "ai-era->ai-workload": {
    "id": "principle-edge-001",
    "type": "CAUSES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "이 상위 개념을 구성 요소로 분해하는 교육 경로일 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "ai-era->compute": {
    "id": "principle-edge-002",
    "type": "CAUSES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "시스템을 설명하는 구조적 축으로 연결될 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "ai-era->evaluation": {
    "id": "principle-edge-003",
    "type": "EVIDENCES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "하위 개념의 설명이나 주장을 점검하는 검증 경로일 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "ai-workload->compute": {
    "id": "principle-edge-004",
    "type": "REQUIRES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "앞 단계의 workload 또는 조건이 뒤 단계의 자원을 요구할 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "ai-workload->memory-hbm": {
    "id": "principle-edge-005",
    "type": "REQUIRES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "앞 단계의 workload 또는 조건이 뒤 단계의 자원을 요구할 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "compute->advanced-packaging": {
    "id": "principle-edge-006",
    "type": "ENABLES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "앞 단계의 capability가 뒤 단계의 구현 선택지를 열 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "memory-hbm->advanced-packaging": {
    "id": "principle-edge-007",
    "type": "ENABLES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "앞 단계의 capability가 뒤 단계의 구현 선택지를 열 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "memory-hbm->storage": {
    "id": "principle-edge-008",
    "type": "CONSTRAINS",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "제약이 다음 계층의 병목 또는 비용으로 이동할 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "compute->power-cooling": {
    "id": "principle-edge-009",
    "type": "REQUIRES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "계산 workload가 전력·냉각 자원을 요구할 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "power-cooling->ai-capex": {
    "id": "principle-edge-010",
    "type": "REQUIRES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "물리적 확장이 공급·운영 조건을 충족해야 할 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "advanced-packaging->ai-capex": {
    "id": "principle-edge-011",
    "type": "CONSTRAINS",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "공급망의 가용성·수율·리드타임이 경제성을 제약할 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "storage->visibility": {
    "id": "principle-edge-012",
    "type": "MEASURES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "관찰된 수요 단서가 다음 판단의 측정 입력으로 사용될 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "ai-capex->visibility": {
    "id": "principle-edge-013",
    "type": "ENABLES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "인프라 투자가 고객 가치 또는 매출 경로를 열 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "ai-capex->financing": {
    "id": "principle-edge-014",
    "type": "FUNDS",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "자금 조달 조건이 투자를 가능하게 하거나 제한할 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "geo-rates->financing": {
    "id": "principle-edge-015",
    "type": "CONSTRAINS",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "거시 조건이 금융·산업 선택의 제약을 바꿀 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "financing->evaluation": {
    "id": "principle-edge-016",
    "type": "PRICES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "금융 조건이 할인율·위험 프리미엄으로 가격에 반영될 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "visibility->evaluation": {
    "id": "principle-edge-017",
    "type": "EVIDENCES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "하위 개념의 설명이나 주장을 점검하는 검증 경로일 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "scarcity-choice->ai-era": {
    "id": "principle-edge-018",
    "type": "REQUIRES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "기초 원리가 이후 시스템과 선택의 전제일 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "scarcity-choice->productivity-wealth": {
    "id": "principle-edge-019",
    "type": "CAUSES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "선택이 산출과 생산성의 경로를 바꿀 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "productivity-wealth->capitalism-engine": {
    "id": "principle-edge-020",
    "type": "ENABLES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "제도와 소유·계약이 재투자 경로를 열 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "capitalism-engine->money-purchasing-power": {
    "id": "principle-edge-021",
    "type": "ENABLES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "화폐 기능이 교환·계산·저장 경로를 가능하게 할 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "money-purchasing-power->inflation-deflation": {
    "id": "principle-edge-022",
    "type": "CAUSES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "가격 수준 변화가 실질 구매력으로 전달될 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "inflation-deflation->credit-banks-debt": {
    "id": "principle-edge-023",
    "type": "CONSTRAINS",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "신용 조건이 차입·지출·투자 능력을 바꿀 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "credit-banks-debt->interest-central-bank": {
    "id": "principle-edge-024",
    "type": "PRICES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "금리가 시간·위험·유동성의 자금 가격이 될 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "interest-central-bank->bonds-dollar-currency": {
    "id": "principle-edge-025",
    "type": "ENABLES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "채권·환율 조건이 자본 이동으로 전달될 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "bonds-dollar-currency->government-fiscal": {
    "id": "principle-edge-026",
    "type": "FUNDS",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "재정·국가 차입이 수요와 프로젝트 자금으로 이어질 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "government-fiscal->company-stock-valuation": {
    "id": "principle-edge-027",
    "type": "CONSTRAINS",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "재정·정책 조건이 기업의 운영·자금조달 환경을 바꿀 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "company-stock-valuation->market-price-discovery": {
    "id": "principle-edge-028",
    "type": "PRICES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "기업의 현금흐름 기대가 시장 가격에 반영될 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "market-price-discovery->cycles-allocation": {
    "id": "principle-edge-029",
    "type": "MEASURES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "경기·이익·유동성의 시간축을 구분해 관찰할 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "cycles-allocation->investment-risk": {
    "id": "principle-edge-030",
    "type": "CONSTRAINS",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "리스크 관리가 자산배분과 생존 가능성을 제한할 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "investment-risk->industry-value-chain": {
    "id": "principle-edge-031",
    "type": "MEASURES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "산업 가치사슬이 분석 단위와 이익 풀을 정의할 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "industry-value-chain->ai-workload": {
    "id": "principle-edge-032",
    "type": "ENABLES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "산업 구조가 AI workload의 수요·병목으로 연결될 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "interest-central-bank->financing": {
    "id": "principle-edge-033",
    "type": "PRICES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "금융 조건이 기업의 할인율과 자금비용을 바꿀 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "industry-value-chain->ai-capex": {
    "id": "principle-edge-034",
    "type": "FUNDS",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "산업의 이익 풀이 CAPEX와 투자 선택으로 전달될 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "power-cooling->power-electricity-system": {
    "id": "principle-edge-035",
    "type": "CAUSES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "교육용 구조 경로로 연결되며 조건은 원문 관계 설명에 따른다"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "power-electricity-system->power-generation-market": {
    "id": "principle-edge-036",
    "type": "CAUSES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "교육용 구조 경로로 연결되며 조건은 원문 관계 설명에 따른다"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "power-generation-market->grid-transmission-distribution": {
    "id": "principle-edge-037",
    "type": "CAUSES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "교육용 구조 경로로 연결되며 조건은 원문 관계 설명에 따른다"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "grid-transmission-distribution->energy-storage": {
    "id": "principle-edge-038",
    "type": "CAUSES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "교육용 구조 경로로 연결되며 조건은 원문 관계 설명에 따른다"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "energy-storage->data-center-power-demand": {
    "id": "principle-edge-039",
    "type": "CAUSES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "교육용 구조 경로로 연결되며 조건은 원문 관계 설명에 따른다"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "data-center-power-demand->industrial-energy-efficiency": {
    "id": "principle-edge-040",
    "type": "CAUSES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "교육용 구조 경로로 연결되며 조건은 원문 관계 설명에 따른다"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "industrial-energy-efficiency->critical-minerals": {
    "id": "principle-edge-041",
    "type": "CAUSES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "교육용 구조 경로로 연결되며 조건은 원문 관계 설명에 따른다"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "industry-value-chain->robotics-automation": {
    "id": "principle-edge-042",
    "type": "CAUSES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "교육용 구조 경로로 연결되며 조건은 원문 관계 설명에 따른다"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "robotics-automation->defense-space": {
    "id": "principle-edge-043",
    "type": "CAUSES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "교육용 구조 경로로 연결되며 조건은 원문 관계 설명에 따른다"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "defense-space->biotech-healthcare": {
    "id": "principle-edge-044",
    "type": "CAUSES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "교육용 구조 경로로 연결되며 조건은 원문 관계 설명에 따른다"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "biotech-healthcare->finance-software-consumer": {
    "id": "principle-edge-045",
    "type": "CAUSES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "교육용 구조 경로로 연결되며 조건은 원문 관계 설명에 따른다"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "finance-software-consumer->us-korea-market": {
    "id": "principle-edge-046",
    "type": "CAUSES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "교육용 구조 경로로 연결되며 조건은 원문 관계 설명에 따른다"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "us-korea-market->krw-dollar-foreign-flow": {
    "id": "principle-edge-047",
    "type": "CAUSES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "교육용 구조 경로로 연결되며 조건은 원문 관계 설명에 따른다"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "krw-dollar-foreign-flow->korea-semiconductor-policy": {
    "id": "principle-edge-048",
    "type": "CAUSES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "교육용 구조 경로로 연결되며 조건은 원문 관계 설명에 따른다"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "korea-semiconductor-policy->tax-accounting-cashflow": {
    "id": "principle-edge-049",
    "type": "CAUSES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "교육용 구조 경로로 연결되며 조건은 원문 관계 설명에 따른다"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "critical-minerals->industry-value-chain": {
    "id": "principle-edge-050",
    "type": "CAUSES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "교육용 구조 경로로 연결되며 조건은 원문 관계 설명에 따른다"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "company-stock-valuation->tax-accounting-cashflow": {
    "id": "principle-edge-051",
    "type": "CAUSES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "교육용 구조 경로로 연결되며 조건은 원문 관계 설명에 따른다"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "robotics-automation->physical-ai-perception": {
    "id": "principle-edge-052",
    "type": "REQUIRES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "물리 시스템이 센서·인지 입력을 요구할 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "physical-ai-perception->physical-ai-planning": {
    "id": "principle-edge-053",
    "type": "CAUSES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "인지 결과가 상태 추정과 다음 행동 판단을 만든다"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "physical-ai-planning->physical-ai-control": {
    "id": "principle-edge-054",
    "type": "ENABLES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "상태 추정이 행동 계획과 제어 선택을 가능하게 할 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "physical-ai-control->robot-unit-economics": {
    "id": "principle-edge-055",
    "type": "MEASURES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "운영 성과가 가동률·유지비·단위경제성으로 측정될 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "defense-space->defense-autonomy": {
    "id": "principle-edge-056",
    "type": "ENABLES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "기술 capability가 임무 수행과 자동화를 가능하게 할 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "defense-autonomy->defense-procurement": {
    "id": "principle-edge-057",
    "type": "EVIDENCES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "조달 조건이 기술 성능과 운용 적합성을 검증할 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "space-launch-economics->space-systems-economics": {
    "id": "principle-edge-058",
    "type": "ENABLES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "발사·시스템 단계가 우주 가치사슬로 이어질 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "space-systems-economics->defense-procurement": {
    "id": "principle-edge-059",
    "type": "FUNDS",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "정부 수요·조달이 시스템 투자와 매출의 고객 경로가 될 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "finance-software-consumer->enterprise-ai-workflow": {
    "id": "principle-edge-060",
    "type": "ENABLES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "기술이 실제 기업 workflow에 적용될 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "enterprise-ai-workflow->ai-workflow-adoption": {
    "id": "principle-edge-061",
    "type": "CONSTRAINS",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "도입 비용과 전환 부담이 사용·ROI를 제약할 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "ai-workflow-adoption->application-roi-evidence": {
    "id": "principle-edge-062",
    "type": "EVIDENCES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "도입 성과를 기준선과 관찰 지표로 검증할 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "critical-minerals->rare-earths-supply-chain": {
    "id": "principle-edge-063",
    "type": "ENABLES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "원재료가 정제·제품·고객 가치사슬로 이어질 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "rare-earths-supply-chain->refining-qualification": {
    "id": "principle-edge-064",
    "type": "REQUIRES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "순도·수율·고객 인증이 판매 가능한 공급의 조건일 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "refining-qualification->materials-policy": {
    "id": "principle-edge-065",
    "type": "CONSTRAINS",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "정책과 공급망 규칙이 소재 선택과 투자를 제약할 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "memory-hbm->hbm-system-bottleneck": {
    "id": "principle-edge-066",
    "type": "CONSTRAINS",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "메모리 시스템 병목이 처리량·전력·비용을 제약할 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "hbm-system-bottleneck->chiplet-economics": {
    "id": "principle-edge-067",
    "type": "ENABLES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "패키지 연결이 시스템 대역폭과 통합을 가능하게 할 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "advanced-packaging->chiplet-economics": {
    "id": "principle-edge-068",
    "type": "CONSTRAINS",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "패키지 비용·열·수율이 시스템 경제성을 제약할 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "ai-era->quantum-platform": {
    "id": "principle-edge-069",
    "type": "ENABLES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "인접 연산 방식이 대체·보완 가능성을 탐색하게 할 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "compute->photonic-link-economics": {
    "id": "principle-edge-070",
    "type": "ENABLES",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "분산 workload의 통신 요구가 광 연결 선택을 가능하게 할 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  },
  "ai-capex->data-center-lease-burden": {
    "id": "principle-edge-071",
    "type": "FUNDS",
    "direction": "DIRECTED",
    "kind": "PRINCIPLE",
    "strength": "CORE",
    "polarity": "CONDITIONAL",
    "conditions": [
      "임차·계약·금융비용이 데이터센터 투자 구조로 전달될 때"
    ],
    "sourceIds": [],
    "reviewedAt": "2026-08-11",
    "reviewStatus": "STRUCTURAL_REFERENCE_REVIEWED",
    "sourceStatus": "EVIDENCE_REGISTRY_PENDING"
  }
});
