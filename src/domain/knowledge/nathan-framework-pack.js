// Nathan's supplied material is projected into reusable knowledge primitives.
// The projection intentionally keeps mechanisms, observables, counter-scenarios,
// and provenance boundaries; it does not copy post prose or promote dated claims.
import { NATHAN_PREVIOUS_THREADS_REFERENCE } from '../research/nathan-previous-threads.js';

export const NATHAN_FRAMEWORK_PACK_VERSION = 'nathan-framework-pack.v1';

const ROUTE_ALIASES = Object.freeze({
  macro: 'macro',
  market: 'market',
  portfolio: 'portfolio',
  crypto: 'entity',
  themes: 'themes',
  principles: 'principles',
  screener: 'screener',
  execution: 'technical',
  allocation: 'portfolio',
  risk: 'portfolio',
  valuation: 'fundamental',
  regulatory: 'market-news',
  entity: 'entity'
});

const INPUT_ALIASES = Object.freeze({
  'net issuance': ['순발행', '국채 발행'],
  'foreign demand/holdings': ['해외수요', '해외 보유'],
  'auction tails': ['경매 테일', '국채 경매'],
  'term premium': ['텀프리미엄', '기간 프리미엄'],
  'front-end vs. long-end yields': ['단기금리', '장기금리', '단기금리 장기금리', '장단기 금리'],
  'real activity': ['실물경제', '실물활동'],
  'risk-asset breadth': ['위험자산 폭', '시장 breadth'],
  'bank capital constraints': ['은행 자본 제약', '은행 자본'],
  'NBFI share': ['비은행 금융기관', 'NBFI'],
  'partial-basket representativeness': ['부분 바스켓 대표성', 'ETF 바스켓 대표성'],
  'creation/redemption': ['생성환매', '생성·환매'],
  'premium/discount': ['프리미엄 디스카운트', '괴리'],
  'leverage': ['레버리지', '차입'],
  'margin': ['마진', '증거금'],
  'collateral': ['담보', '담보자산'],
  'liquidation': ['청산', '강제청산'],
  'settlement': ['결제', '세틀먼트'],
  'ETF': ['상장지수펀드'],
  'tail loss': ['테일 손실', '꼬리위험'],
  'cash buffer': ['현금 여력', '현금 버퍼'],
  'source tier': ['출처 등급', '출처 계층'],
  'fact vs. narrative': ['사실과 서사', '사실·해석 분리'],
  'out-of-sample persistence': ['표본 밖 지속성', '재현성'],
  'market friction': ['시장 마찰', '거래 마찰'],
  'willingness to pay': ['지불의사', '지불 의사'],
  'hidden rows/formulas': ['숨은 행', '숨은 수식'],
  'dynamic ranges': ['동적 범위', '동적 레인지'],
  'asset allocation': ['자산배분', '자산 배분'],
  'risk premium': ['위험프리미엄', '위험 프리미엄'],
  'hedge ratio': ['헤지비율', '헤지 비율'],
  'basis': ['베이시스', '기초자산 괴리'],
  'counterparty': ['거래상대방', '상대방 위험'],
  'institution type': ['기관 유형', '금융기관 역할'],
  'price discovery': ['가격발견', '가격 발견'],
  'mark-to-market': ['시가평가', '평가손익'],
  'primary legal text': ['법률 원문', '규제 원문'],
  'venue access': ['시장 접근성', '거래소 접근']
});

const clean = (value) => String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
const unique = (values) => [...new Set((Array.isArray(values) ? values : []).map(clean).filter(Boolean))];
const routeFromConsumer = (value) => {
  const token = clean(value).split(':')[0] || '';
  return ROUTE_ALIASES[token] || null;
};

function aliasVariants(framework) {
  const values = [framework.id, framework.title, ...(framework.inputs || [])];
  values.push(...clean(framework.title).split(/[·,/:()·|]+/).map((value) => value.trim()).filter((value) => value.length > 1));
  for (const input of framework.inputs || []) values.push(...(INPUT_ALIASES[input] || []));
  return unique(values);
}

function frameworkRoutes(framework) {
  return unique((framework.allowedConsumers || []).map(routeFromConsumer));
}

const rawFrameworks = Array.isArray(NATHAN_PREVIOUS_THREADS_REFERENCE.frameworks)
  ? NATHAN_PREVIOUS_THREADS_REFERENCE.frameworks
  : [];

export const NATHAN_FRAMEWORKS = Object.freeze(rawFrameworks.map((framework) => {
  const conceptId = `nathan-frameworks:${framework.id}`;
  const aliases = aliasVariants(framework);
  const routeIds = frameworkRoutes(framework);
  return Object.freeze({
    ...framework,
    conceptId,
    aliases: Object.freeze(aliases),
    routeIds: Object.freeze(routeIds),
    analysisStages: Object.freeze(['scope', 'mechanism', 'observables', 'confirmation', 'counter-scenario', 'currentness']),
    evidenceSeparation: Object.freeze(['structural reference', 'current observation', 'inference', 'action']),
    currentClaimsAllowed: false,
    rankingUse: 'none',
    processingRule: '주장 범위와 작동 경로를 먼저 고정하고, 현재 관측값·반증 조건·행동 허용 여부를 각각 분리한다.'
  });
}));

export const NATHAN_KNOWLEDGE_CONCEPTS = Object.freeze(NATHAN_FRAMEWORKS.map((framework) => Object.freeze({
  canonicalId: framework.conceptId,
  legacyId: framework.id,
  surface: 'nathan-frameworks',
  equivalenceGroup: null,
  title: framework.title,
  kind: 'analytical-framework',
  layer: 'L1',
  domainId: framework.routeIds[0] || null,
  status: 'CANONICAL_REFERENCE',
  source: { artifact: 'src/domain/research/nathan-previous-threads.js', locator: 'NATHAN_PREVIOUS_THREADS_REFERENCE.frameworks', field: 'frameworks[]' },
  sourceIds: Object.freeze(unique(framework.sourceRefs)),
  routeIds: framework.routeIds,
  aliases: framework.aliases
})));

const aliasTargetMap = new Map();
for (const framework of NATHAN_FRAMEWORKS) {
  for (const alias of framework.aliases) aliasTargetMap.set(alias, [...(aliasTargetMap.get(alias) || []), framework.conceptId]);
}

export const NATHAN_KNOWLEDGE_ALIASES = Object.freeze([...aliasTargetMap.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([alias, targets]) => Object.freeze({
    alias,
    targets: Object.freeze(unique(targets)),
    kind: 'STRUCTURAL_TERM',
    resolution: unique(targets).length === 1 ? 'unique' : 'multi-framework'
  })));

export const NATHAN_ANALYSIS_PROTOCOL = Object.freeze({
  schemaVersion: 'nathan-analysis-protocol.v1',
  sourceKind: 'REFERENCE',
  currentClaimsAllowed: false,
  rankingUse: 'none',
  stages: Object.freeze(['scope', 'mechanism', 'observables', 'confirmation', 'counter-scenario', 'currentness']),
  separation: Object.freeze(['structural reference', 'current observation', 'inference', 'action']),
  stopRules: Object.freeze([
    '현재 수치·예측·목표·방향성은 별도 LIVE/SNAPSHOT/Web Research 근거 없이는 사용하지 않는다.',
    '반증 조건과 반대 경로가 없으면 결론이 아니라 가설로 남긴다.',
    '자료의 권위·서사·인용 횟수는 사실성이나 안전성의 대체 지표로 사용하지 않는다.'
  ])
});

export function matchNathanFrameworks(query, { routeId = null, limit = 5 } = {}) {
  const normalized = clean(query).toLocaleLowerCase('ko-KR');
  if (!normalized) return Object.freeze([]);
  const rows = NATHAN_FRAMEWORKS.map((framework) => {
    const routeMatch = !routeId || framework.routeIds.includes(routeId);
    const titleMatch = normalized.includes(clean(framework.title).toLocaleLowerCase('ko-KR'));
    const matchedAliases = framework.aliases.filter((alias) => normalized.includes(alias.toLocaleLowerCase('ko-KR')));
    const score = (routeMatch ? 1 : 0) + (titleMatch ? 8 : 0) + matchedAliases.length * 3;
    return { framework, score, matchedAliases };
  }).filter((row) => row.score > 1 && (!routeId || row.framework.routeIds.includes(routeId)))
    .sort((left, right) => right.score - left.score || left.framework.id.localeCompare(right.framework.id))
    .slice(0, Number.isInteger(limit) && limit > 0 ? Math.min(8, limit) : 5);
  return Object.freeze(rows.map(({ framework, score, matchedAliases }) => Object.freeze({
    frameworkId: framework.id,
    conceptId: framework.conceptId,
    score,
    matchedAliases: Object.freeze(matchedAliases),
    routeIds: framework.routeIds,
    inputs: framework.inputs,
    confirmation: framework.confirmation,
    invalidation: framework.invalidation,
    counterclaim: framework.counterclaim
  })));
}

export function buildNathanAnalysisContext(query, options = {}) {
  const matches = matchNathanFrameworks(query, options);
  return Object.freeze({
    schemaVersion: NATHAN_ANALYSIS_PROTOCOL.schemaVersion,
    sourceKind: NATHAN_ANALYSIS_PROTOCOL.sourceKind,
    frameworkIds: Object.freeze(matches.map((match) => match.frameworkId)),
    conceptIds: Object.freeze(matches.map((match) => match.conceptId)),
    matchedAliases: Object.freeze(unique(matches.flatMap((match) => match.matchedAliases))),
    stages: NATHAN_ANALYSIS_PROTOCOL.stages,
    separation: NATHAN_ANALYSIS_PROTOCOL.separation,
    stopRules: NATHAN_ANALYSIS_PROTOCOL.stopRules,
    currentClaimsAllowed: false,
    rankingUse: 'none'
  });
}

export const NATHAN_FRAMEWORK_ARTICLES = Object.freeze(NATHAN_FRAMEWORKS.map((framework) => Object.freeze({
  schemaVersion: 'knowledge-framework-article.v1',
  articleId: framework.conceptId,
  lessonId: `nathan-framework:${framework.id}`,
  surface: 'nathan-frameworks',
  title: framework.title,
  conceptIds: Object.freeze([framework.conceptId]),
  authoringStatus: 'STRUCTURED_REFERENCE',
  publication: 'EDUCATIONAL_REFERENCE_ONLY',
  reviewedAt: NATHAN_PREVIOUS_THREADS_REFERENCE.reviewedAt || '',
  keywords: Object.freeze(framework.aliases),
  route: Object.freeze({
    routeId: framework.routeIds[0] || 'principles',
    deepLink: `?nathanFramework=${encodeURIComponent(framework.id)}`,
    verificationRouteId: framework.routeIds[0] || 'principles',
    verificationLabel: '구조적 분석 맥락에서 확인',
    metric: 'reference-framework',
    timeframe: framework.timeframe || ''
  }),
  sources: Object.freeze((framework.sourceRefs || []).map((sourceRef) => Object.freeze({
    id: sourceRef,
    publisher: NATHAN_PREVIOUS_THREADS_REFERENCE.author,
    title: '직접 확인된 외부 연구자료',
    url: '',
    allowedUse: 'REFERENCE_ONLY',
    directness: 'DIRECT_READ'
  }))),
  summary: Object.freeze({
    definition: framework.thesis,
    mechanism: framework.mechanism,
    example: (framework.inputs || []).join(' · '),
    counterScenario: [framework.invalidation, framework.counterclaim].filter(Boolean).join(' '),
    visualization: [framework.confirmation, framework.timeframe].filter(Boolean).join(' | ')
  }),
  processing: Object.freeze({
    stages: framework.analysisStages,
    evidenceSeparation: framework.evidenceSeparation,
    confirmation: framework.confirmation,
    invalidation: framework.invalidation,
    blockedConsumers: framework.blockedConsumers
  })
})));

export const NATHAN_FRAMEWORK_PACK = Object.freeze({
  schemaVersion: NATHAN_FRAMEWORK_PACK_VERSION,
  sourceReferenceId: NATHAN_PREVIOUS_THREADS_REFERENCE.id,
  status: 'REFERENCE_ONLY',
  currentClaimsAllowed: false,
  rankingUse: 'none',
  concepts: NATHAN_KNOWLEDGE_CONCEPTS,
  aliases: NATHAN_KNOWLEDGE_ALIASES,
  articles: NATHAN_FRAMEWORK_ARTICLES,
  analysisProtocol: NATHAN_ANALYSIS_PROTOCOL
});
