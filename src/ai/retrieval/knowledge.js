export const AI_KNOWLEDGE_RETRIEVAL_VERSION = 'ai-knowledge-retrieval.v1';

const ALLOWED_SURFACES = Object.freeze(new Set(['principles', 'atlas-foundations']));
const STOP_WORDS = Object.freeze(new Set([
  '그리고', '하지만', '대한', '대해', '에서', '으로', '하는', '어떻게', '무엇', '설명', '분석', '알려줘',
  'the', 'and', 'for', 'with', 'what', 'how', 'does', 'explain', 'analysis'
]));

function clean(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function tokens(value) {
  const normalized = clean(value).toLowerCase().replace(/[^0-9a-z가-힣%+./-]+/g, ' ');
  return [...new Set(normalized.split(/\s+/).filter((token) => token.length > 1 && !STOP_WORDS.has(token)))];
}

function compact(value, limit) {
  const text = clean(value);
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

function articleText(article) {
  const summary = article?.summary || {};
  return clean([
    article?.articleId, article?.lessonId, article?.surface, article?.title,
    ...(article?.conceptIds || []),
    summary.definition, summary.mechanism, summary.example, summary.counterScenario,
    summary.visualization, ...(article?.keywords || [])
  ].join(' ')).toLowerCase();
}

function surfaceBoost(queryText, surface) {
  const ai = /(ai|인공지능|모델|gpu|hbm|반도체|데이터센터|compute|memory|chip|agent|추론|학습|전력|냉각)/i.test(queryText);
  const principles = /(시장\s*원리|경제|금리|물가|유동성|밸류에이션|재무|현금흐름|포트폴리오|리스크|사이클|거시)/i.test(queryText);
  if (surface === 'atlas-foundations' && ai) return 6;
  if (surface === 'principles' && principles) return 6;
  return 0;
}

function scoreArticle(article, query, queryTokens) {
  const haystack = articleText(article);
  const title = clean(article?.title).toLowerCase();
  let score = surfaceBoost(query, article?.surface);
  for (const token of queryTokens) {
    if (title.includes(token)) score += 8;
    else if (haystack.includes(token)) score += token.length >= 4 ? 3 : 2;
  }
  if (title && query.toLowerCase().includes(title)) score += 12;
  return score;
}

export function createAIKnowledgeIndex(articles = []) {
  return Object.freeze((Array.isArray(articles) ? articles : [])
    .filter((article) => article && ALLOWED_SURFACES.has(article.surface) && article.articleId && article.title)
    .map((article) => Object.freeze({
      articleId: clean(article.articleId),
      lessonId: clean(article.lessonId),
      surface: article.surface,
      title: clean(article.title),
      conceptIds: Object.freeze((article.conceptIds || []).map(clean).filter(Boolean).slice(0, 8)),
      authoringStatus: clean(article.authoringStatus || 'UNREVIEWED_REFERENCE'),
      publication: clean(article.publication || 'EDUCATIONAL_REFERENCE_ONLY'),
      reviewedAt: clean(article.reviewedAt || ''),
      keywords: Object.freeze((article.keywords || []).map(clean).filter(Boolean).slice(0, 16)),
      route: Object.freeze({
        routeId: clean(article.route?.routeId || (article.surface === 'principles' ? 'principles' : 'atlas')),
        deepLink: clean(article.route?.deepLink || ''),
        verificationRouteId: clean(article.route?.verificationRouteId || ''),
        verificationLabel: clean(article.route?.verificationLabel || ''),
        metric: clean(article.route?.metric || ''),
        timeframe: clean(article.route?.timeframe || '')
      }),
      sources: Object.freeze((article.sources || []).filter((source) => /^https:\/\//i.test(source?.url || '')).slice(0, 3).map((source) => Object.freeze({
        id: clean(source.id), publisher: clean(source.publisher), title: clean(source.title), url: clean(source.url), allowedUse: clean(source.allowedUse || 'REFERENCE_ONLY'), directness: clean(source.directness || 'CANDIDATE_REVIEW_REQUIRED')
      }))),
      summary: Object.freeze({
        definition: compact(article.summary?.definition, 620),
        mechanism: compact(article.summary?.mechanism, 720),
        example: compact(article.summary?.example, 440),
        counterScenario: compact(article.summary?.counterScenario, 440),
        visualization: compact(article.summary?.visualization, 220)
      })
    })));
}

export function retrieveAIKnowledge(index, query, { topK = 3, maxChars = 5200 } = {}) {
  const normalizedQuery = clean(query);
  if (!normalizedQuery) return Object.freeze({ matches: [], context: '', audit: { version: AI_KNOWLEDGE_RETRIEVAL_VERSION, status: 'SKIPPED_EMPTY_QUERY', returned: 0 } });
  const queryTokens = tokens(normalizedQuery);
  const limit = Math.min(5, Math.max(1, Number(topK) || 3));
  const ranked = (Array.isArray(index) ? index : [])
    .map((article) => ({ article, score: scoreArticle(article, normalizedQuery, queryTokens) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.article.articleId.localeCompare(b.article.articleId))
    .slice(0, limit);
  const lines = [
    '[AIO KNOWLEDGE REFERENCE v1]',
    'sourceKind=REFERENCE | currentClaimsAllowed=false | surfaces=시장 원리,AI 시대 지식 지도',
    'Rule: 아래 자료는 구조·개념·전달 경로를 설명하는 교육용 reference다. 현재 시장·기업·가격·규제 사실은 별도 LIVE/SNAPSHOT/Web Research 근거로 확인하라.',
    'Rule: authoringStatus가 검토 완료를 뜻하지 않으므로 반대 시나리오와 확인 항목을 함께 제시하고, 현재 사실이나 매매 결론으로 승격하지 마라.'
    ,'Rule: 참고 원문은 directness 후보 링크이며 개별 요약을 직접 입증한다고 간주하지 마라. 인용 전 원문 범위와 기준일을 다시 확인하라.'
  ];
  const matches = [];
  for (const row of ranked) {
    const article = row.article;
    const surfaceLabel = article.surface === 'principles' ? '시장 원리' : 'AI 시대 지식 지도';
    const block = [
      `- [${surfaceLabel} · ${article.articleId}] ${article.title} | status=${article.authoringStatus} | reviewedAt=${article.reviewedAt || '미확인'}`,
      `  정의: ${article.summary.definition}`,
      `  작동 경로: ${article.summary.mechanism}`,
      article.summary.example ? `  적용 예시: ${article.summary.example}` : '',
      article.summary.counterScenario ? `  반대/한계: ${article.summary.counterScenario}` : '',
      `  지식 문서: ${article.route.deepLink || `route=${article.route.routeId} lesson=${article.lessonId}`}`,
      article.route.verificationRouteId ? `  전문 화면 검증: route=${article.route.verificationRouteId} metric=${article.route.metric || 'unspecified'} timeframe=${article.route.timeframe || 'unspecified'}` : '',
      article.sources.length ? `  참고 원문 후보(directness 재검토 필요): ${article.sources.map((source) => `${source.id}=${source.url}`).join(' | ')}` : ''
    ].filter(Boolean).join('\n');
    if (`${lines.join('\n')}\n${block}`.length > maxChars) break;
    lines.push(block);
    matches.push(Object.freeze({ ...article, score: row.score }));
  }
  const status = matches.length ? 'READY_REFERENCE_ONLY' : 'NO_RELEVANT_MATCH';
  return Object.freeze({
    matches: Object.freeze(matches),
    context: matches.length ? `\n\n${lines.join('\n')}\n` : '',
    audit: Object.freeze({
      version: AI_KNOWLEDGE_RETRIEVAL_VERSION,
      status,
      queryTokenCount: queryTokens.length,
      indexed: Array.isArray(index) ? index.length : 0,
      returned: matches.length,
      articleIds: Object.freeze(matches.map((match) => match.articleId)),
      sourceKind: 'REFERENCE',
      currentClaimsAllowed: false
    })
  });
}

export function createAIKnowledgeRetriever({ fetchImpl = globalThis.fetch, indexUrl = './public-data/knowledge/ai-retrieval-index.json' } = {}) {
  let indexPromise = null;
  let lastAudit = Object.freeze({ version: AI_KNOWLEDGE_RETRIEVAL_VERSION, status: 'NOT_LOADED', returned: 0 });
  const load = async () => {
    if (!indexPromise) {
      indexPromise = Promise.resolve(fetchImpl(indexUrl, { cache: 'no-cache' }))
        .then((response) => {
          if (!response || response.ok === false) throw new Error(`knowledge_index_http_${response?.status || 'unknown'}`);
          return response.json();
        })
        .then((payload) => createAIKnowledgeIndex(payload?.articles || []))
        .catch((error) => {
          indexPromise = null;
          throw error;
        });
    }
    return indexPromise;
  };
  const buildContext = async (query, options = {}) => {
    try {
      const result = retrieveAIKnowledge(await load(), query, options);
      lastAudit = result.audit;
      return result;
    } catch (error) {
      lastAudit = Object.freeze({ version: AI_KNOWLEDGE_RETRIEVAL_VERSION, status: 'UNAVAILABLE', returned: 0, error: clean(error?.message || 'knowledge_index_unavailable') });
      return Object.freeze({ matches: [], context: '', audit: lastAudit });
    }
  };
  return Object.freeze({ load, buildContext, getAudit: () => lastAudit });
}
