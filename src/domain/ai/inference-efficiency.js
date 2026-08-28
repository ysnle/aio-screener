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
  return AI_INFERENCE_PROXY_SYMBOLS.map((item) => {
    const quote = liveData?.[item.symbol];
    const rawPct = quote?.pct ?? quote?.regularMarketChangePercent;
    const pct = rawPct == null || rawPct === '' ? null : Number(rawPct);
    const declaredSourceKind = String(quote?.sourceKind || '').toUpperCase();
    const sourceKind = Number.isFinite(pct)
      ? (['LIVE', 'DELAYED', 'SNAPSHOT', 'REFERENCE', 'UNAVAILABLE'].includes(declaredSourceKind)
        ? declaredSourceKind
        : quote?.source || quote?.provider ? 'LIVE' : 'REFERENCE')
      : 'MISSING';
    return {
      ...item,
      pct: Number.isFinite(pct) ? pct : null,
      source: quote?.source || quote?.provider || null,
      sourceKind
    };
  });
}
