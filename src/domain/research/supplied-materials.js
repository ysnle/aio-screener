// Durable bridges extracted from the 2026-08-29 supplied research packet.
// This module is deliberately reference-only: it contains no current values,
// issuer rankings, prices, targets, or investment recommendations.
export const SUPPLIED_MATERIALS_REFERENCE = Object.freeze({
  id: 'supplied-materials-2026-08-29',
  sourceKind: 'REFERENCE',
  operationalUse: 'reference-only',
  reviewedAt: '2026-08-29',
  updatedAt: '2026-08-31',
  sourcePackets: Object.freeze([
    Object.freeze({ id: '2026-08-30-market-research', reviewedAt: '2026-08-30', sourceKind: 'REFERENCE', readableSources: 6, unreadableSources: 4, note: 'X Article 포인터 4건은 공개 본문이 404로 반환되어 추측하지 않음' }),
    Object.freeze({ id: '2026-08-30-jalapeno', reviewedAt: '2026-08-30', sourceKind: 'REFERENCE', note: '공식 OpenAI 설명은 primary confirmation 후보, zartbot의 세부 마이크로아키텍처는 inferred reference' }),
    Object.freeze({ id: '2026-08-29-market-research', reviewedAt: '2026-08-29', sourceKind: 'REFERENCE', note: 'X/GitHub·공식 문서·첨부 이미지·일부 403/부분 접근 자료를 읽기 상태별로 분리한 선행 패킷' })
  ]),
  sourceAudit: Object.freeze([
    Object.freeze({ id: 'packet-2026-08-30', label: '이번 시장·AI 자료', linkCount: 10, readableCount: 6, blockedCount: 4, status: 'MIXED_ACCESS', note: '본문 확인 자료만 프레임 추출에 사용하고, Article pointer 4건은 내용 추측을 금지' }),
    Object.freeze({ id: 'packet-2026-08-29', label: '이전 시장·금융·AI 자료', linkCount: 17, readableCount: 0, blockedCount: 0, status: 'REFERENCE_PACKET', note: 'ParadisLabs·Yonsei·Minervini·Future Walker·KKDW·ZeroHedge·Micron·NVIDIA·Fed·Goldman Sachs gs-quant·첨부 도표 등을 읽기 상태별로 기록' }),
    Object.freeze({ id: 'nested-official-and-secondary', label: '중첩 문서·공식 자료', linkCount: 10, readableCount: 0, blockedCount: 0, status: 'MIXED_ACCESS', note: 'Tema HBF·BlackRock/Fed·BCG·Micron·JPMorgan·Citrini·AI Insider·Fed Warsh·NVIDIA·AI Bottlenecks; 접근 수준이 다른 자료의 해석을 현재 데이터로 승격하지 않음' })
  ]),
  sourceLinks: Object.freeze([
    'https://x.com/RealSimpleAriel/status/2093778843186418078',
    'https://x.com/InvestNorthwise/status/2093778247171424706',
    'https://x.com/tmmrwseoul/status/2088951001562906868',
    'https://x.com/tmmrwseoul/status/2094003866597802019',
    'https://x.com/RossHaber/status/2093867858065232159',
    'https://x.com/dons_korea/status/2093868524720758872',
    'https://x.com/jukan05/status/2093641673171669020',
    'https://zartbot.github.io/blog/arch/jalapeno/en.html',
    'https://x.com/gimduha77994334/status/2093679410507616760',
    'https://x.com/Trader_Jesse_/status/2093569705340756408',
    'https://openai.com/index/jalapeno-first-results/',
    'https://x.com/ParadisLabs/status/2093472998711771421',
    'https://x.com/Yonsei_dent/status/2093324017898008598',
    'https://x.com/markminervini/status/2093365115693244926',
    'https://x.com/Future__Walker/status/2093346533005779448',
    'https://x.com/KKDW_KOREA/status/2093345000348373429',
    'https://x.com/zerohedge/status/2093309457639858477',
    'https://x.com/fi56622380/status/2093040177711329673',
    'https://x.com/nick88886666/status/2092584653089800439',
    'https://github.com/goldmansachs/gs-quant',
    'https://x.com/sshleo84/status/2092582780140200416',
    'https://x.com/jinseongeo83473/status/2092370080088949037',
    'https://x.com/Trader_Jesse_/status/2092505959805648992',
    'https://x.com/gimduha77994334/status/2092462253723222461',
    'https://x.com/sniffshiba/status/2091828331310379484',
    'https://x.com/theodore_invest/status/2091897677709803883',
    'https://x.com/Future__Walker/status/2091861129823998056',
    'https://x.com/tmmrwseoul/status/2091505159222460767'
  ]),
  timeSeries: Object.freeze([
    Object.freeze({ id: 'market-reaction', label: '시장 반응창', window: '1–5 sessions', cadence: 'session/eod', metrics: Object.freeze(['gap', 'volume', 'acceptance/rejection', 'event reaction']), alignment: 'event timestamp와 거래 세션을 분리', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'market-swing', label: '스윙·상대강도창', window: '20–60 sessions', cadence: 'daily/weekly', metrics: Object.freeze(['relative strength', 'breadth', 'extreme movers', 'concentration']), alignment: '동일 유니버스·동일 기준일 비교', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'market-trend', label: '중장기 추세창', window: '50–200 sessions', cadence: 'daily/weekly', metrics: Object.freeze(['MA level/slope', 'highs/lows', 'index confirmation', 'leadership']), alignment: 'cap-weighted·equal-weight·small-cap·sector를 함께 비교', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'event-window', label: '이벤트 전후창', window: 'event date ±1–5 sessions', cadence: 'event-linked', metrics: Object.freeze(['earnings', 'guidance', 'rates', 'gap', 'volume', 'price acceptance']), alignment: '발표시각·관측시각·세션 종료를 별도 보존', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'macro-release-lag', label: '거시 발표·전달 시차', window: 'release date ↔ observation period', cadence: 'daily/monthly/quarterly', metrics: Object.freeze(['policy/rates', 'mortgage', 'housing starts/permits', 'local fiscal/employment', 'inflation', 'revisions']), alignment: '발표일·관측기간·개정일·lead/lag를 분리', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'institutional-quarter', label: '기관 보유 분기창', window: 'report period ↔ filed date ↔ next observable window', cadence: 'quarterly/filing', metrics: Object.freeze(['filer/CIK', 'CUSIP/share class', 'shares/value', 'corporate actions', 'price/volume']), alignment: '13F 신고 흔적과 현재 가격·수급을 같은 사건으로 합치지 않음', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'ai-request', label: 'AI 요청·사용자 경험창', window: 'request/session', cadence: 'request/session', metrics: Object.freeze(['TTFT', 'TBT/TTLT', 'tokens', 'batch', 'energy/request']), alignment: 'model·prompt·precision·system boundary를 고정', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'ai-workload-cohort', label: 'AI workload cohort창', window: 'model/workload cohort', cadence: 'daily/weekly', metrics: Object.freeze(['prefill/decode', 'KV traffic', 'precision', 'batch', 'support cost']), alignment: '모델·질의 형태·배치·정밀도별 cohort를 섞지 않음', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'ai-operations', label: 'AI 운영·가동률창', window: 'daily/weekly', cadence: 'daily/weekly', metrics: Object.freeze(['utilization', 'power/thermal', 'network tail', 'error/retry', 'autonomous hours']), alignment: '파일럿·출하와 반복 운영을 분리', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'capital-quarter', label: '자본·자산수명 분기창', window: 'quarterly/asset life', cadence: 'quarterly/asset-life', metrics: Object.freeze(['CAPEX', 'depreciation', 'replacement reserve', 'financing', 'dilution', 'FCF', 'capacity monetization']), alignment: 'connected power·billable IT power·ARR·revenue·cash를 분모별로 분리', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'qualification-milestones', label: '하드웨어 qualification창', window: 'sample → validation → yield → volume → customer mix', cadence: 'milestone/quarterly', metrics: Object.freeze(['sample', 'validation', 'yield', 'volume', 'qualification', 'customer mix']), alignment: '공급사 언급과 실제 매출·양산을 분리', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'physical-ai-operations', label: 'Physical AI 운영창', window: 'pilot → repeat deployment', cadence: 'pilot/monthly', metrics: Object.freeze(['autonomous hours', 'interventions', 'task/cycle', 'uptime', 'repair', 'supervision']), alignment: '시연 영상·파일럿과 반복 배치·단위경제성을 분리', sourceKind: 'REFERENCE', operationalUse: 'reference-only' }),
    Object.freeze({ id: 'software-usage-cohort', label: '소프트웨어 usage cohort창', window: 'contract → usage/outcome → renewal/cash', cadence: 'monthly/quarterly', metrics: Object.freeze(['usage', 'outcome', 'retention', 'margin', 'cash conversion']), alignment: 'seat·usage·outcome·인식매출·현금흐름의 분모를 분리', sourceKind: 'REFERENCE', operationalUse: 'reference-only' })
  ]),
  sections: Object.freeze([
    Object.freeze({
      id: 'market-principles',
      sourceRefs: Object.freeze(['ParadisLabs-2093472998711771421', 'zerohedge-2093309457639858477', 'gimduha-2093679410507616760', 'gimduha-2092462253723222461', 'Fed-Warsh-official']),
      timeSeriesIds: Object.freeze(['macro-release-lag', 'market-trend', 'market-reaction']),
      title: '시장 원리 · 금리·유동성·가격발견',
      thesis: '정책금리, 장기금리, 단기자금, 가격·포지셔닝은 같은 신호가 아니며 서로 다른 시간축으로 자산에 전달됩니다.',
      steps: Object.freeze([
        '정책금리·forward guidance → 기대·단기금리',
        '재정·국채·기업채 공급 → term premium·장기금리',
        'TGA·FIMA·repo·SOFR/OIS·MMF → 담보·현금·레버리지',
        '가격·거래량·시장 내부·포지셔닝 → 기대의 재조정'
      ]),
      observe: '정책금리와 장기금리, term premium, 발행·수요, repo/OIS/SOFR/MMF, 가격·breadth·포지셔닝을 같은 기준일로 대조',
      invalidation: '연결된 producer·관측일·동일 유니버스가 없으면 현재 방향·유동성 상태를 판정하지 않음'
    }),
    Object.freeze({
      id: 'institutional-flow',
      sourceRefs: Object.freeze(['13F-boundary', 'Goldman-Sachs-gs-quant', 'masters-SEC-artifacts']),
      timeSeriesIds: Object.freeze(['institutional-quarter', 'market-swing']),
      title: '13F · 공개 보유에서 흐름 검증까지',
      thesis: '13F는 기관의 실시간 행동이 아니라 분기 말 공개 흔적입니다. 기관 보유를 신호로 쓰려면 공시·정규화·가격·수급을 순서대로 대조해야 합니다.',
      steps: Object.freeze([
        'filer·CIK·filing·report period·filedAt 확인',
        'CUSIP·share class·corporate action 정규화',
        '이전 분기와 shares/value 변화 비교',
        '가격·거래량·ETF·short·insider·13D/G와 분리 대조'
      ]),
      observe: 'NEW/INCREASED/REDUCED/EXITED는 신고 주식 수 변화로만 표시하고, 실제 체결·전체 자산·현금·공매도로 확대 해석하지 않음',
      invalidation: 'ticker crosswalk·corporate-action review·동일 보고분기 또는 원문 filing이 없으면 기관 흐름 신호를 생성하지 않음'
    }),
    Object.freeze({
      id: 'ai-era-economics',
      sourceRefs: Object.freeze(['InvestNorthwise-2093778247171424706', 'ParadisLabs-2093472998711771421', 'Tema-HBF', 'BlackRock-AI-Fed', 'BCG-space-data-center', 'Micron-query-memory-power']),
      timeSeriesIds: Object.freeze(['ai-workload-cohort', 'ai-operations', 'capital-quarter']),
      title: 'AI 시대 · workload에서 현금흐름까지',
      thesis: 'AI 경제성은 GPU/FLOPS 하나가 아니라 사용량·질의 형태·메모리·전력·가동률·자본조달이 연결된 시스템 결과입니다.',
      steps: Object.freeze([
        '사용자·tokens/user → query mix',
        'prefill/KV/decode → 메모리·네트워크·전력',
        '가동률·검증·운영시간 → task 단위 경제성',
        'CAPEX·감가상각·이자·희석 → OCF/FCF·ROIC'
      ]),
      observe: 'latency·bandwidth·KV traffic·energy/query·utilization·qualification·yield·CAPEX/depreciation·FCF',
      invalidation: '발표·파일럿·출하·펀딩만 있고 실제 사용량·고객 지불·가동률·현금흐름 증거가 없으면 성장 서사를 승격하지 않음'
    }),
    Object.freeze({
      id: 'market-confirmation',
      sourceRefs: Object.freeze(['tmmrwseoul-2094003866597802019', 'RossHaber-2093867858065232159', 'tmmrwseoul-2088951001562906868']),
      timeSeriesIds: Object.freeze(['market-reaction', 'market-swing', 'market-trend', 'event-window']),
      title: '시장 확인 · 지수·상대강도·이벤트',
      thesis: '한 지수의 반등이나 패턴 이름보다 시가총액가중 지수·동일가중·소형주·섹터 breadth·상대강도·거래량의 동행 여부가 시장 국면을 가르는 확인 증거입니다.',
      steps: Object.freeze([
        '관찰 사실과 해석을 분리하고 기준일·세션을 고정',
        'cap-weighted 지수 ↔ equal-weight·small-cap·섹터 상대강도 비교',
        '5/20/50/200일선 위치·기울기·신고가/신저가·거래량을 같은 창에서 대조',
        '실적 발표 전후 갭·거래량·가격 수용과 무효화 수준 확인'
      ]),
      observe: '1~5일 반응, 20~60일 추세, 50~200일 구조를 분리하고 실적·금리 이벤트 창을 별도 태그로 붙임',
      invalidation: '단일 종가·패턴 라벨·소수 대형주 지지만 있고 breadth·상대강도·거래량·이벤트 결과가 동행하지 않으면 시장 전체 확인으로 승격하지 않음'
    }),
    Object.freeze({
      id: 'macro-lagged-supply',
      sourceRefs: Object.freeze(['gimduha-2093679410507616760', 'RealSimpleAriel-2093778843186418078', 'Fed-Warsh-official']),
      timeSeriesIds: Object.freeze(['macro-release-lag', 'market-reaction']),
      title: '금리 · 주택 공급 · 고용의 시차',
      thesis: '금리 인상은 수요를 누르는 동시에 주택·건설 공급과 지방재정 경로를 늦출 수 있습니다. 어느 효과가 우세한지는 즉시 결론이 아니라 시차·고용·물가의 순서로 확인합니다.',
      steps: Object.freeze([
        '금리·모기지 → 주택 수요와 신규 공급의 서로 다른 리드타임',
        '주택 거래·가격·세수 → 지방정부 재정 → 교육·지방정부 고용',
        '고용·소득·수요와 공급 파이프라인을 같은 기준일로 정렬',
        '다음 고용·물가 발표에서 가설을 갱신하고 정책 경로는 조건부로 남김'
      ]),
      observe: '정책금리·장기금리·모기지·주택착공/허가·지방재정/고용·물가의 발표일과 관측기간을 구분',
      invalidation: '금리·주택·고용 사이의 시간순서와 독립 지표가 맞지 않거나 대체 요인이 더 강하면 단일 금리 인과로 설명하지 않음'
    }),
    Object.freeze({
      id: 'ai-inference-architecture',
      sourceRefs: Object.freeze(['OpenAI-Jalapeno', 'zartbot-Jalapeno', 'Tema-HBF', 'Micron-query-memory-power']),
      timeSeriesIds: Object.freeze(['ai-request', 'ai-workload-cohort', 'ai-operations']),
      title: 'AI 추론 아키텍처 · 시스템 공동설계',
      thesis: 'AI 시대의 경쟁 단위는 peak FLOPS가 아니라 사용자 경험을 만족시키는 tokens·energy·latency의 시스템 결과이며, 하드웨어·메모리·네트워크·컴파일러·검증 루프를 함께 봐야 합니다.',
      steps: Object.freeze([
        'Prefill·Decode·Draft·Verify의 병목과 사용자 SLO 분리',
        '데이터 이동·KV locality·메모리 거리·collective 통신을 시스템 비용으로 계상',
        '명확한 의미와 측정 가능한 배치 공간에서 AI가 placement·mapping·kernel을 탐색',
        '요청당 에너지·TTLT/TBT·tokens/W·전력·TCO를 실측하고 모델별로 재검증'
      ]),
      observe: '공식 성능·전력 측정과 추론 분석의 세부 추론을 분리하고, workload·모델·배치·정밀도·시스템 경계를 함께 기록',
      invalidation: '표준화된 workload에서 latency·energy·utilization·TCO 개선이 재현되지 않거나 새 모델 지원 비용이 이득을 잠식하는 경우'
    }),
    Object.freeze({
      id: 'ai-capacity-conversion',
      sourceRefs: Object.freeze(['InvestNorthwise-2093778247171424706', 'NBIS-vs-IREN-financing-attachment']),
      timeSeriesIds: Object.freeze(['capital-quarter', 'ai-operations', 'software-usage-cohort']),
      title: 'AI 용량 → 매출·현금 전환',
      thesis: 'AI 인프라의 투자 가능성은 연결 전력이나 계약 발표가 아니라 billable IT power, 가동·수락된 용량, 가격·이용률, 인식매출, 현금흐름과 자금조달의 연결에서 확인합니다.',
      steps: Object.freeze([
        'connected power → billable IT power → energization·acceptance 구분',
        '계약·exit ARR → recognized revenue → OCF/FCF의 인식 순서 확인',
        'marginal contract pricing과 fleet pricing, 회계수명과 경제수명 분리',
        'CAPEX·D&A·이자·희석·replacement reserve·financing waterfall을 함께 검증'
      ]),
      observe: 'capacity·utilization·ARR·revenue·cash의 기준일·분모·계약 상태와 자금조달 조건을 분기별로 고정',
      invalidation: '전력·계약·밸류에이션 숫자만 있고 실제 수락·사용량·고객 지불·현금흐름 또는 자금조달 증거가 없으면 전환 서사를 승격하지 않음'
    }),
    Object.freeze({
      id: 'ai-hardware-qualification',
      sourceRefs: Object.freeze(['GB200-GB300-VR200-supply-chain-attachment', 'Micron-query-memory-power', 'HBF-whitepaper']),
      timeSeriesIds: Object.freeze(['qualification-milestones', 'capital-quarter', 'ai-workload-cohort']),
      title: 'AI 하드웨어 · qualification에서 양산까지',
      thesis: '가속기 세대와 공급사 표는 투자 노출이 아니라 시스템 BOM·검증·수율·양산·고객 믹스가 시간에 따라 전환되는 qualification 지도입니다.',
      steps: Object.freeze([
        'compute tray·NVSwitch tray·PCB·CCL·copper·glass·resin·midplane 계층 분해',
        'sample → validation → yield → volume → customer mix 순서 기록',
        '대역폭·메모리·전력·열·네트워크 제약을 workload cohort와 연결',
        '공급사 언급·설계 채택과 실제 출하·매출·마진·현금 전환 분리'
      ]),
      observe: '부품·플랫폼·고객·양산 단계별 관측일과 변경 이력을 남기고, 단일 세대의 이름으로 미래 매출을 추정하지 않음',
      invalidation: 'qualification·yield·volume·고객 확인이 없거나 공급망 병목이 system-level latency·energy·TCO 개선으로 이어지지 않으면 노출 신호를 보류'
    }),
    Object.freeze({
      id: 'physical-ai-validation',
      sourceRefs: Object.freeze(['AI-Insider-humanoid-robotics', 'BCG-space-data-center']),
      timeSeriesIds: Object.freeze(['physical-ai-operations', 'capital-quarter']),
      title: 'Physical AI · 시연에서 반복 운영까지',
      thesis: '로봇·우주 인프라 자료는 시연 가능성보다 반복 배치에서의 자율시간, 개입, 작업 성공률, uptime, 수리·감독 비용으로 검증해야 합니다.',
      steps: Object.freeze([
        'pilot·demo·design win과 repeat deployment를 별도 상태로 기록',
        'autonomous hours·interventions·task/cycle·uptime·repair 측정',
        '환경·작업·안전·통신·열 조건별 성능 cohort 분리',
        'CAPEX·운영비·감독비·수익화·현금흐름으로 단위경제성 확인'
      ]),
      observe: '파일럿 날짜와 운영 기간, 개입률·실패·수리·감독의 분모를 고정하고 영상 한 편을 일반화하지 않음',
      invalidation: '반복 운영·고객 지불·신뢰성 데이터 없이 데모나 정책 기대만 존재하면 상용화·수익성 결론을 보류'
    }),
    Object.freeze({
      id: 'software-outcome-economics',
      sourceRefs: Object.freeze(['InvestNorthwise-2093778247171424706', 'JPMorgan-software-trends', 'Snowflake-unstructured-data-observation']),
      timeSeriesIds: Object.freeze(['software-usage-cohort', 'capital-quarter']),
      title: '소프트웨어 · seat에서 outcome·현금까지',
      thesis: 'AI 소프트웨어는 좌석 수나 발표된 ARR보다 실제 사용량·업무 결과·갱신·마진·현금 전환을 cohort로 확인해야 합니다.',
      steps: Object.freeze([
        'seat·contract·usage·outcome 단위를 분리',
        '비정형 데이터 → governed workflow → 반복 사용 경로 확인',
        'retention·support cost·gross margin·cash conversion을 cohort로 대조',
        'EV/EBITDA·ARR·매출·FCF를 서로 다른 분모로 해석'
      ]),
      observe: '계약 시점·사용량·결과·갱신·현금수취와 회계 인식 시점을 별도 보존',
      invalidation: '좌석·계약·valuation만 있고 usage/outcome·갱신·현금 데이터가 없으면 AI 수익화 질을 높게 평가하지 않음'
    }),
    Object.freeze({
      id: 'price-first-confirmation',
      sourceRefs: Object.freeze(['tmmrwseoul-2094003866597802019', 'tmmrwseoul-profile-observations', 'RealSimpleAriel-2093778843186418078', 'Yonsei-dent-2093324017898008598', 'Minervini-2093365115693244926']),
      timeSeriesIds: Object.freeze(['market-reaction', 'market-swing', 'market-trend', 'event-window']),
      title: '가격 우선 · 패턴은 분류 도구',
      thesis: '가격·거래량·수용 여부가 1차 관찰이고, 갭·추세·패턴·지표는 그 관찰을 분류하는 도구입니다. 로그/선형 표시와 단일 지표를 혼동하지 않습니다.',
      steps: Object.freeze([
        '원시 가격·거래량·갭·변동성·수용을 먼저 저장',
        '20/50/200일선과 로그/선형 시각화를 별도 확인',
        'breadth·상대강도·리더십·극단 상승/하락을 동일 창에서 비교',
        '패턴 라벨은 관측 후에 붙이고 무효화·이벤트 창을 함께 표시'
      ]),
      observe: '1~5일 반응, 20~60일 스윙, 50~200일 추세를 섞지 않고 같은 유니버스·기준일로 비교',
      invalidation: '패턴 이름·단일 지표·현재 캔들만 있고 가격 수용·거래량·breadth·상대강도가 맞지 않으면 분류를 신호로 승격하지 않음'
    }),
    Object.freeze({
      id: 'market-risk-process',
      sourceRefs: Object.freeze(['RealSimpleAriel-2093778843186418078', 'RossHaber-2093867858065232159', 'gimduha-2093679410507616760', 'theodore-invest-2091897677709803883']),
      timeSeriesIds: Object.freeze(['market-reaction', 'market-swing', 'market-trend', 'macro-release-lag']),
      title: '시장 리스크 · 노출·확인·무효화',
      thesis: '변동성이 큰 시장에서는 전망보다 노출 크기, 지수 확인, breadth·상대강도, 이벤트 위험, 무효화 조건을 하나의 과정으로 관리해야 합니다.',
      steps: Object.freeze([
        '지수·섹터·종목의 동행/괴리와 리더십 집중도를 확인',
        '실적·금리·정책 이벤트 전후 갭·거래량·수용을 기록',
        '변동성·유동성·포지셔닝에 따라 노출과 포지션 크기를 조정',
        '가설·무효화·재확인 조건을 시계열 로그로 남김'
      ]),
      observe: '노출·변동성·breadth·포지셔닝·이벤트 결과를 동일한 시간축에 놓고, 현재값과 dated reference를 구분',
      invalidation: '지수 확인·참여도·거래량·이벤트 결과가 맞지 않거나 반대 증거가 누적되면 기존 해석을 보류·갱신'
    })
  ]),
  routeMappings: Object.freeze({
    home: Object.freeze({ sectionIds: Object.freeze(['market-confirmation', 'market-principles', 'macro-lagged-supply']), timeSeriesIds: Object.freeze(['market-reaction', 'market-trend', 'macro-release-lag']) }),
    signal: Object.freeze({ sectionIds: Object.freeze(['market-confirmation', 'market-risk-process', 'institutional-flow']), timeSeriesIds: Object.freeze(['market-reaction', 'market-swing', 'event-window', 'institutional-quarter']) }),
    technical: Object.freeze({ sectionIds: Object.freeze(['price-first-confirmation', 'market-confirmation']), timeSeriesIds: Object.freeze(['market-reaction', 'market-swing', 'market-trend']) }),
    market: Object.freeze({ sectionIds: Object.freeze(['market-confirmation', 'market-principles', 'macro-lagged-supply', 'market-risk-process']), timeSeriesIds: Object.freeze(['market-reaction', 'market-swing', 'market-trend', 'macro-release-lag', 'event-window']) }),
    macro: Object.freeze({ sectionIds: Object.freeze(['market-principles', 'macro-lagged-supply', 'market-confirmation']), timeSeriesIds: Object.freeze(['macro-release-lag', 'market-reaction', 'market-trend']) }),
    fxbond: Object.freeze({ sectionIds: Object.freeze(['market-principles', 'market-risk-process', 'macro-lagged-supply']), timeSeriesIds: Object.freeze(['macro-release-lag', 'market-reaction', 'event-window']) }),
    breadth: Object.freeze({ sectionIds: Object.freeze(['market-confirmation', 'price-first-confirmation', 'market-risk-process']), timeSeriesIds: Object.freeze(['market-reaction', 'market-swing', 'market-trend']) }),
    themes: Object.freeze({ sectionIds: Object.freeze(['ai-era-economics', 'ai-inference-architecture', 'ai-capacity-conversion', 'ai-hardware-qualification', 'physical-ai-validation', 'software-outcome-economics']), timeSeriesIds: Object.freeze(['ai-request', 'ai-workload-cohort', 'ai-operations', 'capital-quarter', 'qualification-milestones', 'physical-ai-operations', 'software-usage-cohort']) }),
    'theme-detail': Object.freeze({ sectionIds: Object.freeze(['ai-era-economics', 'ai-capacity-conversion', 'physical-ai-validation', 'software-outcome-economics']), timeSeriesIds: Object.freeze(['ai-workload-cohort', 'ai-operations', 'capital-quarter', 'physical-ai-operations', 'software-usage-cohort']) }),
    principles: Object.freeze({ sectionIds: Object.freeze(['market-principles', 'market-confirmation', 'macro-lagged-supply', 'institutional-flow', 'ai-era-economics', 'ai-inference-architecture', 'ai-capacity-conversion', 'market-risk-process']), timeSeriesIds: Object.freeze(['market-reaction', 'market-trend', 'macro-release-lag', 'institutional-quarter', 'ai-workload-cohort', 'capital-quarter']) }),
    atlas: Object.freeze({ sectionIds: Object.freeze(['ai-era-economics', 'ai-inference-architecture', 'ai-capacity-conversion', 'ai-hardware-qualification', 'market-principles', 'market-confirmation', 'macro-lagged-supply', 'institutional-flow']), timeSeriesIds: Object.freeze(['market-reaction', 'market-trend', 'macro-release-lag', 'institutional-quarter', 'ai-request', 'ai-workload-cohort', 'capital-quarter', 'qualification-milestones']) }),
    screener: Object.freeze({ sectionIds: Object.freeze(['market-confirmation', 'ai-era-economics', 'ai-capacity-conversion', 'ai-hardware-qualification']), timeSeriesIds: Object.freeze(['market-reaction', 'market-swing', 'market-trend', 'ai-workload-cohort', 'ai-operations', 'capital-quarter', 'qualification-milestones']) }),
    ticker: Object.freeze({ sectionIds: Object.freeze(['ai-era-economics', 'ai-capacity-conversion', 'ai-inference-architecture', 'institutional-flow']), timeSeriesIds: Object.freeze(['ai-request', 'ai-operations', 'capital-quarter', 'institutional-quarter']) }),
    fundamental: Object.freeze({ sectionIds: Object.freeze(['ai-capacity-conversion', 'software-outcome-economics', 'physical-ai-validation', 'institutional-flow']), timeSeriesIds: Object.freeze(['software-usage-cohort', 'physical-ai-operations', 'capital-quarter', 'institutional-quarter']) }),
    options: Object.freeze({ sectionIds: Object.freeze(['market-principles', 'market-risk-process']), timeSeriesIds: Object.freeze(['market-reaction', 'event-window']) }),
    portfolio: Object.freeze({ sectionIds: Object.freeze(['market-risk-process', 'market-principles', 'institutional-flow', 'ai-capacity-conversion']), timeSeriesIds: Object.freeze(['market-reaction', 'market-swing', 'institutional-quarter', 'capital-quarter']) }),
    masters: Object.freeze({ sectionIds: Object.freeze(['institutional-flow', 'market-principles']), timeSeriesIds: Object.freeze(['institutional-quarter', 'macro-release-lag']) }),
    sentiment: Object.freeze({ sectionIds: Object.freeze(['market-risk-process', 'market-confirmation']), timeSeriesIds: Object.freeze(['market-reaction', 'market-swing', 'event-window']) }),
    'market-news': Object.freeze({ sectionIds: Object.freeze(['market-confirmation', 'market-risk-process']), timeSeriesIds: Object.freeze(['market-reaction', 'event-window']) }),
    briefing: Object.freeze({ sectionIds: Object.freeze(['market-confirmation', 'market-principles', 'macro-lagged-supply']), timeSeriesIds: Object.freeze(['market-reaction', 'market-trend', 'macro-release-lag', 'event-window']) })
  }),
  boundary: '이 브리지는 학습·질문 설계용 REFERENCE입니다. 현재 가격·목표가·확률·기관 보유·공급사 매출·투자 판단을 생성하지 않습니다. 2026-08-30 자료의 X Article 본문 미확인 4건은 해석·현재 주장으로 사용하지 않습니다.'
});
