#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARKET_PRINCIPLES_CATALOG } from '../src/ui/pages/principles.js';
import { atomicWriteJsonSync } from './lib/atomic-write.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const writeJson = (relativePath, value) => {
  const target = path.join(root, relativePath);
  atomicWriteJsonSync(target, value);
};
const reviewedAt = process.env.KNOWLEDGE_MANIFEST_DATE || '2026-08-18';
const principles = readJson('public-data/principles/lesson-library.json').lessons || [];
const atlas = readJson('public-data/atlas/foundation-lessons.json').lessons || [];
const researchFacts = readJson('public-data/knowledge/research-facts.json').facts || [];

const principleFactIdsByChapter = Object.freeze({
  A: ['fact:oecd:productivity'],
  B: ['fact:fred:real-rates', 'fact:bls:cpi'],
  C: ['fact:fed:financial-stability'],
  D: ['fact:fred:real-rates', 'fact:fed:policy-transmission'],
  E: ['fact:fred:real-rates'],
  F: ['fact:sec:financial-statements'],
  G: ['fact:sec:financial-statements', 'fact:sec:10k-reading'],
  H: ['fact:finra:orders', 'fact:krx:listed-products'],
  J: ['fact:finra:orders'],
  I: ['fact:fed:financial-stability'],
  K: ['fact:sec:10k-reading', 'fact:doe:pue'],
  L: ['fact:transformer:attention', 'fact:asml:euv', 'fact:doe:pue'],
  M: ['fact:doe:pue', 'fact:fred:real-rates'],
  N: ['fact:nist:ai-rmf-core', 'fact:doe:pue'],
  O: ['fact:fred:real-rates', 'fact:sec:10k-reading', 'fact:krx:listed-products']
});

const factMatches = (lesson, surface) => {
  const explicit = surface === 'principles' ? principleFactIdsByChapter[lesson.chapterId] || [] : [];
  const haystack = `${lesson.id} ${lesson.title || ''} ${lesson.definition || ''} ${lesson.mechanism || ''} ${lesson.example || ''}`.toLowerCase();
  const inferred = researchFacts.filter((fact) => (fact.appliesTo || []).some((token) => haystack.includes(String(token).toLowerCase()))).map((fact) => fact.factId);
  const ids = [...new Set([...explicit, ...inferred])];
  return ids.map((id) => researchFacts.find((fact) => fact.factId === id)).filter(Boolean).slice(0, 4);
};

function summaryFor(lesson, surface) {
  return surface === 'principles'
    ? { definition: lesson.definition, mechanism: lesson.mechanism, example: lesson.example, counterScenario: lesson.counterScenario, verificationQuestion: lesson.verificationQuestion, visualization: lesson.diagram }
    : { definition: lesson.definition, mechanism: lesson.mechanism, example: lesson.example, counterScenario: lesson.limit, verificationQuestion: lesson.teachingQuestion, visualization: lesson.visualization };
}

function createArticle(lesson, surface, index) {
  const summary = summaryFor(lesson, surface);
  const verificationQuestion = summary.verificationQuestion;
  delete summary.verificationQuestion;
  const claimId = `${surface === 'principles' ? 'principles-lesson' : 'atlas-foundation'}-${lesson.id}`;
  const title = lesson.title || lesson.name || lesson.id;
  const evidenceFacts = factMatches(lesson, surface);
  const sourceIds = [...new Set([...(lesson.sourceIds || []), ...evidenceFacts.map((fact) => fact.sourceId)])];
  const intuition = summary.definition;
  const rationale = { kind: 'SOURCE_MECHANISM', text: summary.mechanism };
  const workedExample = { kind: 'SOURCE_EXAMPLE', inputs: [summary.example], assumptions: [], steps: [], result: '', interpretation: '', failureBoundary: '' };
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
      realEconomyChannel: '', companyChannel: '', financialStatementChannel: '', valuationChannel: '', marketChannel: '',
      tradingApplication: verificationQuestion,
      invalidation: summary.counterScenario,
      glossary: [],
      claimIds: [claimId],
      sourceIds,
      researchEvidence: evidenceFacts.map((fact) => ({
        factId: fact.factId,
        sourceId: fact.sourceId,
        statement: fact.statement,
        scope: fact.scope,
        invalidation: fact.invalidation,
        asOf: fact.asOf
      })),
      researchCoverage: evidenceFacts.length ? 'DIRECT_FACTS_ATTACHED_REVIEW_REQUIRED' : 'RESEARCH_REQUIRED'
    },
    quality: {
      coreTextCharacters: 0,
      contentForm: 'SOURCE_SUMMARY',
      semanticReview: 'REQUIRED',
      sourceDirectnessReview: 'REQUIRED',
      userValidation: 'NOT_CONDUCTED'
    },
    deepArticle: {
      status: 'RECONSTRUCTION_REQUIRED',
      dossierId: `research:${surface === 'principles' ? 'principles-lesson' : 'atlas-foundation'}:${lesson.id}`,
      progressiveDisclosure: ['source-summary', 'research-evidence'],
      uniqueDraftSeed: {
        definition: summary.definition,
        mechanism: summary.mechanism,
        example: summary.example,
        counterScenario: summary.counterScenario,
        verificationQuestion,
        visualization: summary.visualization
      },
      requiredBeforePromotion: ['independent research dossier', 'source profile', 'unique worked example or explicit non-quantitative rationale', 'market transmission review', 'semantic review']
    },
    authoringNote: `자동 구조화된 ${index + 1}번째 reference draft. 반복 문장·외부 원문 사실성·계산 예시는 사람이 source audit 후 승격해야 한다.`
  };
  delete article.article.retrievalChecks;
  article.quality.coreTextCharacters = [...new Set([summary.definition, summary.mechanism, summary.example, summary.counterScenario, verificationQuestion, summary.visualization].filter(Boolean))].join(' ').length;
  return article;
}

const principleArticles = principles.map((lesson, index) => createArticle(lesson, 'principles', index));
const atlasArticles = atlas.map((lesson, index) => createArticle(lesson, 'atlas-foundations', principleArticles.length + index));
const allArticles = [...principleArticles, ...atlasArticles];
for (const article of principleArticles) writeJson(`public-data/knowledge/articles/principles/${article.lessonId}.json`, article);
for (const article of atlasArticles) writeJson(`public-data/knowledge/articles/atlas-foundations/${article.lessonId}.json`, article);
writeJson('public-data/knowledge/articles.json', {
  schemaVersion: 'knowledge-articles.v1',
  generatedAt: reviewedAt,
  status: 'STRUCTURED_REFERENCE_DRAFT',
  boundary: 'articles are structured reference drafts; semantic review, source directness review, and user validation remain required',
  counts: { total: principleArticles.length + atlasArticles.length, principles: principleArticles.length, atlasFoundations: atlasArticles.length },
  articles: allArticles
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
