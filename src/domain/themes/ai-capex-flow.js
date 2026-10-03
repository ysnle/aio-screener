// P1417: AI capital spending as a flow of money into layers, from the owner-supplied a16z "State of
// Markets II" (2026-09-30), which cites BNP Paribas (2026-08) for the split and TrendForce
// (2026-09-14) for lead times. Static REFERENCE, never a current signal. Layers link to this
// screener's own THEME_MAP categories (a category mapping, not a ticker guess); the knowledge base
// entry is _context/KNOWLEDGE-BASE.md TM-XIX.

export const AI_CAPEX_FLOW = Object.freeze({
  id: 'ai-capex-flow-2026-08',
  sourceKind: 'REFERENCE',
  title: 'AI 설비투자 100달러는 어디로 가나',
  source: 'BNP Paribas 추정(2026-08), a16z State of Markets II(2026-09-30) 인용',
  layers: Object.freeze([
    Object.freeze({ id: 'semis', label: '반도체', share: 50, parts: '가속기 25 · 메모리 15 · CPU·서버 10 (이 중 반도체 장비 약 8)', themes: ['semiconductor'] }),
    Object.freeze({ id: 'power', label: '전력', share: 20, parts: '계통 연결·자가발전 10 · 전력 분배 6.5 · 현장 배전 3.5', themes: ['utilities', 'energy'] }),
    Object.freeze({ id: 'network', label: '네트워크', share: 15, parts: '광 트랜시버 5.5 · 스위치 4.5 · 네트워크 칩 3 · 케이블 2', themes: ['photonics'] }),
    Object.freeze({ id: 'cooling', label: '냉각', share: 7.5, parts: '액체·공랭 냉각 설비', themes: ['ai_infra'] }),
    Object.freeze({ id: 'facility', label: '시설·건설', share: 7.5, parts: '데이터센터 건물·부지·건설', themes: ['ai_infra', 'industrials'] })
  ])
});

// Lead times are the bottleneck map: the longer the wait, the scarcer the capacity.
export const AI_BOTTLENECK_LEAD_TIMES = Object.freeze({
  source: 'TrendForce 리드타임(2026-09-14), a16z State of Markets II 인용',
  note: '칩은 제때 오지만 짓고 전원을 넣는 것이 병목 — 원 자료에 없는 공급사 매핑은 하지 않음',
  rows: Object.freeze([
    Object.freeze({ item: '가스터빈', weeks: [260, 420], layer: 'power' }),
    Object.freeze({ item: '변압기', weeks: [104, 260], layer: 'power' }),
    Object.freeze({ item: 'MW급 스위치기어', weeks: [52, 104], layer: 'power' }),
    Object.freeze({ item: '니어라인 HDD', weeks: [50, 104], layer: 'semis' }),
    Object.freeze({ item: 'CoWoS 패키징', weeks: [40, 60], layer: 'semis' }),
    Object.freeze({ item: '800G 광 모듈', weeks: [40, 60], layer: 'network' }),
    Object.freeze({ item: 'ABF 기판', weeks: [48, 56], layer: 'semis' }),
    Object.freeze({ item: 'HBM', weeks: [40, 52], layer: 'semis' }),
    Object.freeze({ item: 'DRAM', weeks: [20, 40], layer: 'semis' }),
    Object.freeze({ item: 'GPU 시스템', weeks: [20, 30], layer: 'semis', balanced: true }),
    Object.freeze({ item: 'NAND', weeks: [16, 26], layer: 'semis' }),
    Object.freeze({ item: 'MLCC', weeks: [12, 30], layer: 'semis' })
  ])
});
