// Reference-only taxonomy for AI inference economics and the supplied AI deal map.
// Current prices/returns are intentionally kept outside this module.

export const AI_INFERENCE_EFFICIENCY_REFERENCE = Object.freeze({
  id: 'ai-inference-efficiency-v1',
  sourceKind: 'REFERENCE',
  operationalUse: 'reference-only',
  axes: Object.freeze([
    Object.freeze({
      id: 'memory-proximity',
      label: '메모리 근접성',
      low: 'HBM/외부 메모리',
      high: 'SRAM·온칩 메모리',
      question: 'decode에서 가중치 이동과 KV cache 이동을 얼마나 줄이는가?'
    }),
    Object.freeze({
      id: 'specialization',
      label: '하드웨어 특화도',
      low: '범용·유연한 제어',
      high: '모델·연산 특화',
      question: '유연성을 줄이는 대신 latency·tokens/W를 얼마나 개선하는가?'
    })
  ]),
  workloads: Object.freeze([
    Object.freeze({ id: 'realtime', label: '저배치 실시간', metric: 'latency', fit: '음성·코딩 에이전트·대화형 추론' }),
    Object.freeze({ id: 'batch', label: '대규모 배치', metric: 'tokens/W·TCO', fit: '오프라인 인덱싱·대량 생성·평가' }),
    Object.freeze({ id: 'hybrid', label: '분리형 hybrid', metric: 'prefill/KV ↔ decode', fit: 'GPU/HBM은 prefill·KV, LPU/SRAM은 decode' })
  ]),
  entities: Object.freeze([
    Object.freeze({ id: 'cerebras', label: 'Cerebras', memory: '온칩 SRAM', specialization: '높음', fit: '저배치 latency', status: 'REFERENCE' }),
    Object.freeze({ id: 'groq', label: 'Groq', memory: 'SRAM + deterministic scheduling', specialization: '높음', fit: '저지연 decode', status: 'REFERENCE' }),
    Object.freeze({ id: 'etched', label: 'Etched', memory: 'HBM + SRAM', specialization: 'Transformer 특화', fit: 'tokens/W·data-center throughput', status: 'REFERENCE' }),
    Object.freeze({ id: 'frozen-v2', label: 'Google Frozen v2', memory: '공식 사양 미확인', specialization: 'rumored/model-specific', fit: '검증 대기', status: 'UNVERIFIED_REFERENCE' })
  ]),
  constraints: Object.freeze([
    'decode는 FLOPS보다 weight/KV memory movement가 병목일 수 있다.',
    'batch가 커지면 weight traffic은 amortize되지만 request별 KV cache 부담은 남는다.',
    '단일 칩 승자보다 workload stage별 자원 배분과 TCO가 비교 단위다.',
    '성능·전력·가격 수치는 공급사 주장 또는 2차 자료일 수 있으므로 현재 신호로 승격하지 않는다.'
  ])
});

// 2026-08-29 supplied-materials integration: durable lenses extracted from the
// Micron/Tema/BCG/AI Insider references and the attached accelerator supply-chain
// comparison. These are explanatory dimensions only; they never create a rank,
// price target, or current company claim.
export const AI_INFRASTRUCTURE_REFERENCE_LENSES = Object.freeze([
  Object.freeze({
    id: 'token-demand-relay',
    label: '토큰 수요 릴레이',
    thesis: '사용자 수요와 사용자당 토큰량이 늘면 학습보다 추론 workload·메모리·전력·검증 수요가 순차적으로 커질 수 있습니다.',
    observe: 'query mix · tokens/user · prefill/decode 비중 · utilization · verification latency',
    invalidation: '토큰 수요가 정체되거나 workload가 memory-bound가 아니며, utilization·현금흐름이 CAPEX를 따라가지 못하는 경우'
  }),
  Object.freeze({
    id: 'query-shape-economics',
    label: '질의 형태별 경제성',
    thesis: '실시간·장문·대량배치·에이전트 질의는 latency·bandwidth·KV cache·전력 요구가 다르므로 GPU 수요를 단일 FLOPS로 해석하지 않습니다.',
    observe: 'latency · memory bandwidth · KV cache traffic · energy/query · batch size · TCO',
    invalidation: '동일 workload·precision·system boundary에서 비용·전력·지연 차이가 재현되지 않는 경우'
  }),
  Object.freeze({
    id: 'memory-hierarchy-option',
    label: '메모리 계층 옵션',
    thesis: 'HBM·SRAM·고대역폭 플래시·eSSD는 경쟁재라기보다 prefill/KV/decode와 용량·지연 요구에 따른 계층 선택지입니다.',
    observe: 'qualification · yield · capacity/bit · read/write path · customer adoption · supply allocation',
    invalidation: '표준화·qualification·양산·고객 채택이 이어지지 않거나, 데이터 이동 이득이 시스템 TCO를 개선하지 못하는 경우'
  }),
  Object.freeze({
    id: 'capex-financing-durability',
    label: 'CAPEX·자금 지속성',
    thesis: 'AI 인프라 수요가 매출로 전환되는 속도보다 감가상각·이자·채권 발행이 빨라지면 성장 서사가 자금조달 위험으로 바뀔 수 있습니다.',
    observe: 'OCF/FCF · capex/depreciation · interest coverage · debt maturity · rental spread · dilution',
    invalidation: '계약·사용량·현금흐름이 CAPEX와 조달비용을 충분히 흡수하고, 재융자·고객집중 위험이 낮아지는 경우'
  }),
  Object.freeze({
    id: 'physical-ai-deployment',
    label: 'Physical AI 배치 검증',
    thesis: '휴머노이드·로봇은 발표·펀딩·파일럿을 실제 생산성으로 동일시하지 않고 운영시간과 개입률로 검증합니다.',
    observe: 'autonomous hours · interventions/hour · task success · cycle time · uptime · repair time · supervision ratio',
    invalidation: '파일럿이 반복 생산·안전·유지보수·단위원가 개선으로 이어지지 않는 경우'
  })
]);

// 2026-08-30 supplied Jalapeño/OpenAI integration. The official OpenAI page
// supplies the objective and workload-level framing; detailed slice, cache,
// topology, and compiler claims from the supplied analysis remain inferred
// reference until independently confirmed.
export const AI_INFERENCE_ARCHITECTURE_REFERENCE = Object.freeze({
  id: 'ai-inference-architecture-co-design-v1',
  sourceKind: 'REFERENCE',
  operationalUse: 'reference-only',
  objective: '사용자 경험을 만족시키는 useful tokens·energy/request·latency의 Pareto 균형과 전력·TCO 제약',
  evidenceClasses: Object.freeze([
    Object.freeze({ id: 'official', label: '공식 확인 후보', meaning: 'Prefill/Decode 병목 차이, 데이터·KV locality, network 통합, matched user experience·energy 관점, AI 보조 설계·검증 루프' }),
    Object.freeze({ id: 'inferred', label: '분석 추론', meaning: 'NUMA·local memory placement, 단순화된 memory hierarchy, explicit placement, collective network와 상세 마이크로아키텍처의 세부 해석' })
  ]),
  layers: Object.freeze([
    Object.freeze({ id: 'workload', label: 'Workload/SLO', focus: 'Prefill·Decode·Draft·Verify, TTFT·TBT·TTLT, batch와 interactive latency' }),
    Object.freeze({ id: 'data-movement', label: 'Memory/Data movement', focus: 'weight·KV 이동, locality, memory distance, bandwidth·latency·jitter' }),
    Object.freeze({ id: 'network', label: 'Collective/Scale-up', focus: 'cross-core·cross-chip communication, synchronization·tail latency, rack-scale topology' }),
    Object.freeze({ id: 'software', label: 'Compiler/Agent loop', focus: 'clear semantics → placement/mapping/search → executable test·measurement → iteration' }),
    Object.freeze({ id: 'economics', label: 'System economics', focus: 'tokens/W·energy/request·utilization·power capacity·TCO·model portability' })
  ]),
  timeSeriesChecks: Object.freeze([
    Object.freeze({ id: 'request', window: 'request/session', metrics: 'TTFT·TBT·TTLT·tokens/user·energy/request' }),
    Object.freeze({ id: 'workload', window: 'model/workload cohort', metrics: 'prefill/decode mix·batch·KV traffic·precision·model support cost' }),
    Object.freeze({ id: 'operations', window: 'daily/weekly operations', metrics: 'utilization·power·thermal headroom·network tail latency·error/retry rate' }),
    Object.freeze({ id: 'capital', window: 'quarterly/asset life', metrics: 'CAPEX·depreciation·replacement reserve·financing·FCF·capacity monetization' })
  ]),
  sources: Object.freeze([
    Object.freeze({ id: 'openai-jalapeno-results', url: 'https://openai.com/index/jalapeno-first-results/', class: 'official-primary-candidate' }),
    Object.freeze({ id: 'zartbot-jalapeno-analysis', url: 'https://zartbot.github.io/blog/arch/jalapeno/en.html', class: 'inferred-secondary-reference' })
  ]),
  boundary: '성능·전력·비용 수치와 세부 칩 토폴로지는 workload·정밀도·배치·시스템 경계를 맞춘 독립 측정 전까지 현재 종목 우열이나 밸류에이션 근거로 사용하지 않습니다.'
});

// The attached GB200/GB300/VR200 table is preserved as a role map. Supplier
// names are intentionally not copied into the live ticker universe: identity,
// contract, qualification and current exposure require primary verification.
export const AI_HARDWARE_SUPPLY_CHAIN_REFERENCE = Object.freeze([
  Object.freeze({ id: 'compute-tray', label: 'Compute tray', roles: 'substrate · HDI PCB · CCL · copper foil · fiber glass · resin', question: '세대별 layer·loss·재료 사양 변화가 어느 공급단계의 병목으로 전이되는가?' }),
  Object.freeze({ id: 'nvswitch-tray', label: 'NVSwitch tray', roles: 'HDI/HLC PCB · CCL · copper foil · optical/electrical interconnect', question: '스위치 fabric과 scale-up 네트워크가 compute tray와 다른 콘텐츠를 만드는가?' }),
  Object.freeze({ id: 'midplane', label: 'Midplane', roles: 'high-layer PCB · low-loss CCL · connector/interconnect', question: '랙 확장 시 PCB 층수·저손실 소재·조립 qualification이 공급 제약이 되는가?' }),
  Object.freeze({ id: 'qualification-gate', label: 'Qualification gate', roles: 'sample → validation → yield → volume → customer mix', question: '기술 표가 매출·마진·FCF로 전환됐다는 공식 증거가 존재하는가?' })
]);

export const AI_INFERENCE_PROXY_SYMBOLS = Object.freeze([
  Object.freeze({ symbol: 'NVDA', role: 'accelerator', label: 'GPU/가속기' }),
  Object.freeze({ symbol: 'AMD', role: 'accelerator', label: 'GPU/가속기' }),
  Object.freeze({ symbol: 'AVGO', role: 'custom-silicon', label: 'custom silicon·네트워크' }),
  Object.freeze({ symbol: 'MRVL', role: 'custom-silicon', label: '데이터센터 silicon' }),
  Object.freeze({ symbol: 'MU', role: 'memory', label: '메모리' }),
  Object.freeze({ symbol: 'ANET', role: 'networking', label: '네트워킹' })
]);

export const AI_DEAL_ECOSYSTEM_NODES = Object.freeze([
  Object.freeze({ id: 'microsoft', label: 'Microsoft', role: 'hyperscaler·capital' }),
  Object.freeze({ id: 'broadcom', label: 'Broadcom', role: 'custom silicon·networking' }),
  Object.freeze({ id: 'google', label: 'Google', role: 'hyperscaler·model lab' }),
  Object.freeze({ id: 'softbank', label: 'SoftBank', role: 'capital·investment' }),
  Object.freeze({ id: 'coreweave', label: 'CoreWeave', role: 'neocloud·compute' }),
  Object.freeze({ id: 'nscale', label: 'Nscale', role: 'neocloud·compute' }),
  Object.freeze({ id: 'figure-ai', label: 'Figure AI', role: 'application·robotics' }),
  Object.freeze({ id: 'nebius', label: 'Nebius', role: 'neocloud·compute' }),
  Object.freeze({ id: 'sb-energy', label: 'SB Energy', role: 'power·data center' }),
  Object.freeze({ id: 'harvey', label: 'Harvey', role: 'vertical application' }),
  Object.freeze({ id: 'cursor', label: 'Cursor', role: 'developer application' }),
  Object.freeze({ id: 'openai', label: 'OpenAI', role: 'model lab·services demand' }),
  Object.freeze({ id: 'ambience-healthcare', label: 'Ambience Healthcare', role: 'vertical application' }),
  Object.freeze({ id: 'anthropic', label: 'Anthropic', role: 'model lab·services demand' }),
  Object.freeze({ id: 'mistral', label: 'Mistral', role: 'model lab' }),
  Object.freeze({ id: 'nvidia', label: 'Nvidia', role: 'accelerator·platform' }),
  Object.freeze({ id: 'corning', label: 'Corning', role: 'optics·materials' }),
  Object.freeze({ id: 'intel', label: 'Intel', role: 'compute·foundry' }),
  Object.freeze({ id: 'oracle', label: 'Oracle', role: 'cloud·enterprise' }),
  Object.freeze({ id: 'xai', label: 'xAI', role: 'model lab' }),
  Object.freeze({ id: 'amd', label: 'AMD', role: 'accelerator' }),
  Object.freeze({ id: 'amazon', label: 'Amazon', role: 'hyperscaler·capital' })
]);

export const AI_DEAL_ECOSYSTEM_EDGES = Object.freeze([
  Object.freeze({ kind: 'services', from: 'hyperscaler', to: 'model-lab', label: '클라우드·모델 서비스' }),
  Object.freeze({ kind: 'investment', from: 'capital', to: 'model-lab', label: '투자·자본 연결' }),
  Object.freeze({ kind: 'hardware', from: 'accelerator', to: 'model-lab', label: '가속기·메모리·네트워크 공급' }),
  Object.freeze({ kind: 'services', from: 'model-lab', to: 'neocloud', label: '컴퓨트 수요·임대' }),
  Object.freeze({ kind: 'investment', from: 'hyperscaler', to: 'power-data-center', label: '데이터센터·전력 CAPEX' }),
  Object.freeze({ kind: 'hardware', from: 'hardware', to: 'power-data-center', label: '광학·네트워크·전력 인프라' })
]);

export function selectAiInferenceProxies(liveData = {}) {
  const source = liveData && typeof liveData === 'object' && !Array.isArray(liveData) ? liveData : {};
  return Object.freeze(AI_INFERENCE_PROXY_SYMBOLS.map((item) => {
    const quote = source[item.symbol];
    const rawPct = quote?.pct ?? quote?.regularMarketChangePercent;
    const pct = rawPct == null || rawPct === '' ? null : Number(rawPct);
    const declaredSourceKind = String(quote?.sourceKind || '').toUpperCase();
    const sourceKind = Number.isFinite(pct)
      ? (['LIVE', 'DELAYED', 'SNAPSHOT', 'REFERENCE', 'UNAVAILABLE'].includes(declaredSourceKind)
        ? declaredSourceKind
        : 'REFERENCE')
      : 'MISSING';
    return Object.freeze({
      ...item,
      pct: Number.isFinite(pct) ? pct : null,
      source: quote?.source || quote?.provider || null,
      sourceKind,
      observedAt: quote?.observedAt || quote?.ts || quote?.timestamp || null
    });
  }));
}
