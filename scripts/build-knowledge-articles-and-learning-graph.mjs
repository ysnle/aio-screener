#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARKET_PRINCIPLES_CATALOG } from '../src/ui/pages/principles.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const writeJson = (relativePath, value) => {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};
const reviewedAt = process.env.KNOWLEDGE_MANIFEST_DATE || '2026-08-11';
const principles = readJson('public-data/principles/lesson-library.json').lessons || [];
const atlas = readJson('public-data/atlas/foundation-lessons.json').lessons || [];

function summaryFor(lesson, surface) {
  return surface === 'principles'
    ? { definition: lesson.definition, mechanism: lesson.mechanism, example: lesson.example, counterScenario: lesson.counterScenario, verificationQuestion: lesson.verificationQuestion, visualization: lesson.diagram }
    : { definition: lesson.definition, mechanism: lesson.mechanism, example: lesson.example, counterScenario: lesson.limit, verificationQuestion: lesson.teachingQuestion, visualization: lesson.visualization };
}

function createArticle(lesson, surface, index) {
  const summary = summaryFor(lesson, surface);
  const claimId = `${surface === 'principles' ? 'principles-lesson' : 'atlas-foundation'}-${lesson.id}`;
  const title = lesson.title || lesson.name || lesson.id;
  const sourceIds = [...new Set(lesson.sourceIds || [])];
  const intuition = `${summary.definition} ${summary.mechanism} 이 문서는 ${title}을 단일 지표나 종목 서사가 아니라 조건과 전달 경로를 확인하는 교육용 개념으로 다룬다.`;
  const rationale = {
    kind: 'QUALITATIVE_RATIONALE',
    text: `현재 데이터나 가격을 예측하는 공식으로 승격하지 않고, ${title}을 관찰할 때 어떤 입력·제약·결과를 분리해야 하는지 설명한다. ${summary.counterScenario || '대체 설명과 관찰기간이 충분하지 않으면 결론을 보류한다.'}`,
    assumptions: ['교육용 reference 범위', '현재 수치·생산량·가격을 확정하지 않음', 'source ID와 기준일을 다시 확인해야 함']
  };
  const workedExample = {
    kind: 'REFERENCE_SCENARIO',
    inputs: [summary.example, `개념: ${title}`, `원고 sourceIds: ${sourceIds.join(', ') || '없음'}`],
    assumptions: ['입력은 설명을 위한 가상/정성 시나리오다.', '관찰기간·단위·대체 설명을 별도 기록한다.', '현재 시장 의사결정 또는 매매 주문으로 사용하지 않는다.'],
    steps: [
      `1. ${title}과 연결된 핵심 제약을 ${summary.mechanism}으로 분해한다.`,
      `2. ${summary.example}을 실물경제·기업·재무·시장 층으로 나누어 어떤 층의 관찰인지 표시한다.`,
      `3. ${summary.verificationQuestion}에 답할 직접 자료와 반대 시나리오를 정리한다.`
    ],
    result: `이 시나리오에서 확인 가능한 결과는 ${title}의 작동 경로와 보류 조건이며, 특정 가격 방향이나 투자 결론이 아니다.`,
    interpretation: '개념의 설명과 실제 관측 사실을 분리하고, source·기준일·단위를 채운 뒤에만 더 강한 주장을 검토한다.',
    failureBoundary: summary.counterScenario || '직접 출처, 기준일, 관찰기간 또는 대체 설명이 없으면 결론을 확정하지 않는다.'
  };
  const article = {
    schemaVersion: 'knowledge-article.v1',
    articleId: `${surface}:${lesson.id}`,
    lessonId: lesson.id,
    surface,
    title,
    authoringStatus: 'STRUCTURED_REFERENCE_DRAFT',
    publication: 'EDUCATIONAL_REFERENCE_ONLY',
    reviewedAt,
    summary,
    article: {
      intuition,
      formalModelOrRationale: rationale,
      workedExampleOrRationale: workedExample,
      realEconomyChannel: `실물경제 층: ${title}이 자원·수요·생산·병목의 어떤 변수를 바꾸는지 확인한다. ${summary.mechanism}`,
      companyChannel: `기업 층: 고객 문제, 운영 KPI, 경쟁우위와 공급 조건이 ${title}과 어떻게 연결되는지 구분한다.`,
      financialStatementChannel: `재무제표 층: 매출·비용·CAPEX·감가상각·운전자본·현금흐름 중 어떤 항목에 흔적이 남는지 확인하되 공시 line item을 직접 대조한다.`,
      valuationChannel: `밸류에이션 층: 기대 성장·마진·자본비용·기간·잔존가치를 분리하고, ${title}만으로 적정가치를 산출하지 않는다.`,
      marketChannel: `시장 층: 관찰시점·기대 대비 서프라이즈·유동성·반대 설명을 기록하며 현재 가격 방향으로 번역하지 않는다.`,
      tradingApplication: `관찰 적용: ${summary.verificationQuestion}을 체크리스트로 사용하고, 확인되지 않은 수치·매매 지시는 생성하지 않는다.`,
      invalidation: summary.counterScenario || '핵심 가정이 깨지거나 직접 근거가 없으면 이 설명을 보류한다.',
      glossary: [
        { term: title, definition: summary.definition },
        { term: '직접성', definition: '출처가 해당 주장을 직접 지지하는 정도이며, 배경 출처의 존재만으로 높아지지 않는다.' },
        { term: '기준일', definition: '관찰·공시·발행 시점을 구분하는 필드다.' }
      ],
      retrievalChecks: [
        summary.verificationQuestion,
        `이 설명에서 관찰 사실과 해석을 분리하면 각각 무엇이며, 어떤 조건에서 결론을 무효화할 것인가?`
      ],
      claimIds: [claimId],
      sourceIds
    },
    quality: {
      coreTextCharacters: 0,
      lengthFloor: 1200,
      semanticReview: 'REQUIRED',
      sourceDirectnessReview: 'REQUIRED',
      userValidation: 'NOT_CONDUCTED'
    },
    deepArticle: {
      status: 'RECONSTRUCTION_REQUIRED',
      dossierId: `research:${surface === 'principles' ? 'principles-lesson' : 'atlas-foundation'}:${lesson.id}`,
      progressiveDisclosure: ['30-second-summary', '5-minute-core-article', 'deep-dive-model-evidence'],
      uniqueDraftSeed: {
        definition: summary.definition,
        mechanism: summary.mechanism,
        example: summary.example,
        counterScenario: summary.counterScenario,
        verificationQuestion: summary.verificationQuestion,
        visualization: summary.visualization
      },
      requiredBeforePromotion: ['independent research dossier', 'source profile', 'unique worked example or explicit non-quantitative rationale', 'market transmission review', 'semantic review']
    },
    authoringNote: `자동 구조화된 ${index + 1}번째 reference draft. 반복 문장·외부 원문 사실성·계산 예시는 사람이 source audit 후 승격해야 한다.`
  };
  article.quality.coreTextCharacters = [article.article.intuition, rationale.text, JSON.stringify(workedExample), article.article.realEconomyChannel, article.article.companyChannel, article.article.financialStatementChannel, article.article.valuationChannel, article.article.marketChannel, article.article.tradingApplication, article.article.invalidation, JSON.stringify(article.article.glossary), JSON.stringify(article.article.retrievalChecks)].join(' ').length;
  return article;
}

const principleArticles = principles.map((lesson, index) => createArticle(lesson, 'principles', index));
const atlasArticles = atlas.map((lesson, index) => createArticle(lesson, 'atlas-foundations', principleArticles.length + index));
for (const article of principleArticles) writeJson(`public-data/knowledge/articles/principles/${article.lessonId}.json`, article);
for (const article of atlasArticles) writeJson(`public-data/knowledge/articles/atlas-foundations/${article.lessonId}.json`, article);
writeJson('public-data/knowledge/articles.json', {
  schemaVersion: 'knowledge-articles.v1',
  generatedAt: reviewedAt,
  status: 'STRUCTURED_REFERENCE_DRAFT',
  boundary: 'articles are structured reference drafts; semantic review, source directness review, and user validation remain required',
  counts: { total: principleArticles.length + atlasArticles.length, principles: principleArticles.length, atlasFoundations: atlasArticles.length },
  articles: [...principleArticles, ...atlasArticles]
});

const graphNodes = [];
function addGraphNodes(lessons, surface) {
  for (let index = 0; index < lessons.length; index += 1) {
    const lesson = lessons[index];
    const articleId = `${surface}:${lesson.id}`;
    const previous = index > 0 ? `${surface}:${lessons[index - 1].id}` : null;
    const next = index < lessons.length - 1 ? `${surface}:${lessons[index + 1].id}` : null;
    graphNodes.push({
      id: articleId,
      surface,
      lessonId: lesson.id,
      articleId,
      prerequisiteIds: previous ? [previous] : [],
      nextIds: next ? [next] : [],
      expertRouteIds: [articleId],
      pathIds: [],
      overviewOnly: false,
      status: 'STRUCTURED_REFERENCE_DRAFT'
    });
  }
}
addGraphNodes(principles, 'principles');
addGraphNodes(atlas, 'atlas-foundations');

const paths = [];
for (const chapter of readJson('public-data/principles/chapters.json').chapters || []) {
  const lessonIds = principles.filter((lesson) => lesson.chapterId === chapter.id).map((lesson) => `principles:${lesson.id}`);
  paths.push({ id: `principles-chapter-${chapter.id}`, title: chapter.title, description: chapter.coreIdea, nodeIds: lessonIds, surface: 'principles', status: 'STRUCTURED_REFERENCE_DRAFT' });
}
const atlasById = new Set(atlas.map((lesson) => lesson.id));
paths.push({ id: 'atlas-foundations-complete', title: 'AI 시대 지식 지도 기초 경로', description: 'AI 기초 48개 lesson을 물리·모델·시스템·경제성 순서로 연결한다.', nodeIds: atlas.map((lesson) => `atlas-foundations:${lesson.id}`), surface: 'atlas-foundations', status: 'STRUCTURED_REFERENCE_DRAFT' });
const pathIdsByNode = new Map();
for (const pathEntry of paths) for (const nodeId of pathEntry.nodeIds) pathIdsByNode.set(nodeId, [...(pathIdsByNode.get(nodeId) || []), pathEntry.id]);
for (const node of graphNodes) node.pathIds = pathIdsByNode.get(node.id) || [];

writeJson('public-data/knowledge/learning-graph.json', {
  schemaVersion: 'knowledge-learning-graph.v1',
  generatedAt: reviewedAt,
  status: 'STRUCTURED_REFERENCE_DRAFT',
  boundary: 'graph continuity is local reference structure; it does not certify learning outcomes or recruited-user validation',
  counts: { nodes: graphNodes.length, paths: paths.length, principlesLessons: principles.length, atlasLessons: atlas.length },
  nodes: graphNodes,
  paths
});
console.log(JSON.stringify({ status: 'PASS', articles: principleArticles.length + atlasArticles.length, principles: principleArticles.length, atlas: atlasArticles.length, paths: paths.length }, null, 2));
