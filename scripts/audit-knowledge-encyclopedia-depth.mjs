#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const readJson = (relativePath) => JSON.parse(read(relativePath));
const principles = readJson('public-data/principles/lesson-library.json');
const atlas = readJson('public-data/atlas/foundation-lessons.json');
const principlesUi = read('src/ui/pages/principles.js');
const routeState = read('src/app/knowledge-route-state.js');
const learningState = read('src/domain/knowledge/learning-state.js');
const routeBridge = read('src/domain/knowledge/route-bridge.js');
const structuredArticles = readJson('public-data/knowledge/articles.json');
const learningGraph = readJson('public-data/knowledge/learning-graph.json');

const TARGET_SEMANTIC_FIELDS = [
  'intuition',
  'formalModel',
  'workedExample',
  'realEconomyChannel',
  'companyChannel',
  'financialStatementChannel',
  'valuationChannel',
  'marketChannel',
  'tradingApplication',
  'invalidation',
  'glossary',
  'retrievalChecks',
  'claimIds'
];

const PERSONAS = [
  { id: 'novice', need: '선수 개념·용어·직관·순차 학습', currentSupport: 'PARTIAL' },
  { id: 'intermediate-investor', need: '산업 KPI·기업 실적·재무제표·밸류에이션', currentSupport: 'PARTIAL' },
  { id: 'active-trader', need: '관찰 지표·시점·레짐·무효화·차트 이동', currentSupport: 'WEAK' },
  { id: 'domain-expert', need: '정식 모델·가정·논쟁·주장별 직접 근거', currentSupport: 'WEAK' },
  { id: 'korean-investor', need: '미국·글로벌 충격의 환율·한국 산업·종목 전달', currentSupport: 'PARTIAL' },
  { id: 'returning-learner', need: '진도·북마크·노트·회상 퀴즈·재개', currentSupport: 'MISSING' },
  { id: 'skeptical-risk-aware', need: '반례·불확실성·대체 설명·근거 최신성', currentSupport: 'PARTIAL' },
  { id: 'time-poor', need: '요약에서 심층 본문으로 내려가는 단계적 공개', currentSupport: 'PARTIAL' }
];

function percentile(sorted, ratio) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0;
}

function hasMaterialValue(value) {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return value && typeof value === 'object' && Object.keys(value).length > 0;
}

function sourceConcentration(lessons) {
  const counts = new Map();
  for (const lesson of lessons) {
    for (const sourceId of lesson.sourceIds || []) counts.set(sourceId, (counts.get(sourceId) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([sourceId, lessonCount]) => ({ sourceId, lessonCount }));
}

function auditCorpus({ id, lessons, currentFields, targetMinimumChars }) {
  const lengths = lessons
    .map((lesson) => currentFields.reduce((total, field) => total + String(lesson[field] || '').trim().length, 0))
    .sort((left, right) => left - right);
  const targetCoverage = Object.fromEntries(TARGET_SEMANTIC_FIELDS.map((field) => [
    field,
    lessons.filter((lesson) => hasMaterialValue(lesson[field])).length
  ]));
  const semanticComplete = lessons.filter((lesson) => TARGET_SEMANTIC_FIELDS.every((field) => hasMaterialValue(lesson[field]))).length;
  const structuredWorkedExamples = lessons.filter((lesson) => hasMaterialValue(lesson.workedExample)).length;
  const meetsLengthFloor = lengths.filter((length) => length >= targetMinimumChars).length;
  return {
    id,
    lessonCount: lessons.length,
    currentFieldSet: currentFields,
    currentCoreTextCharacters: {
      minimum: lengths[0] || 0,
      median: percentile(lengths, 0.5),
      p90: percentile(lengths, 0.9),
      maximum: lengths[lengths.length - 1] || 0,
      mean: Math.round(lengths.reduce((total, length) => total + length, 0) / Math.max(1, lengths.length))
    },
    targetMinimumChars,
    meetsLengthFloor,
    belowLengthFloor: lessons.length - meetsLengthFloor,
    digitBearingExampleCount: lessons.filter((lesson) => /[0-9０-９]/.test(String(lesson.example || ''))).length,
    structuredWorkedExamples,
    targetSemanticFieldCoverage: targetCoverage,
    semanticComplete,
    sourceConcentration: sourceConcentration(lessons),
    certification: semanticComplete === lessons.length && meetsLengthFloor === lessons.length ? 'PASS' : 'FAIL'
  };
}

const corpora = [
  auditCorpus({
    id: 'market-principles',
    lessons: principles.lessons || [],
    currentFields: ['definition', 'mechanism', 'example', 'counterScenario', 'verificationQuestion', 'diagram'],
    targetMinimumChars: 1200
  }),
  auditCorpus({
    id: 'ai-knowledge-map-foundations',
    lessons: atlas.lessons || [],
    currentFields: ['definition', 'mechanism', 'example', 'limit', 'teachingQuestion', 'visualization'],
    targetMinimumChars: 1200
  })
];

const uiCapabilities = {
  shareableLessonState: /serializeKnowledgeRouteState|replaceKnowledgeRouteState/.test(routeState),
  progressPersistence: /createLearningState|markViewed|setProgress/.test(learningState),
  bookmarks: /toggleBookmark/.test(learningState),
  learnerNotes: /setNote/.test(learningState),
  retrievalQuizState: /recordRetrieval/.test(learningState),
  professionalRouteBridge: /createKnowledgeRouteBridge|routeLabel/.test(`${principlesUi}\n${routeBridge}`)
};
const structuredReferenceArtifacts = {
  articleCount: structuredArticles.counts?.total || 0,
  principlesArticleCount: structuredArticles.counts?.principles || 0,
  atlasArticleCount: structuredArticles.counts?.atlasFoundations || 0,
  learningNodeCount: learningGraph.counts?.nodes || learningGraph.nodes?.length || 0,
  pathCount: learningGraph.counts?.paths || learningGraph.paths?.length || 0,
  status: structuredArticles.status || 'UNKNOWN',
  publicationBoundary: structuredArticles.boundary || 'UNSPECIFIED'
};

const result = {
  schemaVersion: 'knowledge-encyclopedia-depth-audit.v1',
  auditedAt: process.env.KNOWLEDGE_MANIFEST_DATE || '2026-08-11',
  status: corpora.every((corpus) => corpus.certification === 'PASS') ? 'ENCYCLOPEDIA_DEPTH_CERTIFIED' : 'ENCYCLOPEDIA_DEPTH_BLOCKED',
  interpretation: '현재 required-field 존재 여부와 백과사전급 설명 깊이는 다른 계약이다. 문자 수는 하한선일 뿐이며 semantic field 충족과 구조화된 worked example을 함께 통과해야 한다.',
  naming: {
    routeId: 'atlas',
    publicName: 'AI 시대 지식 지도',
    pageKicker: 'AI 시대 지식 백과'
  },
  corpora,
  uiCapabilities,
  structuredReferenceArtifacts,
  personaAuditBoundary: '실제 참여자 연구가 아니라 저장소와 브라우저 시나리오에 근거한 다중 사용자 관점 휴리스틱 감사다.',
  personas: PERSONAS,
  blockers: [
    'KB-S0-01: 159/159 core lessons are below the 1,200-character encyclopedia floor.',
    'KB-S0-02: 0/159 lessons implement the complete semantic depth contract.',
    'KB-S0-03: 0/159 source lesson summaries contain a structured workedExample object; generated drafts are separate and remain review-required.',
    'KB-S0-04: route/local learning-state contracts exist, but learner controls, retrieval UX, and user validation remain open.',
    'KB-S0-05: actual recruited-user validation has not been conducted.'
  ],
  targetContract: {
    compactSummary: '한 화면에서 빠르게 훑는 요약은 유지하되, 요약 아래에 1,200자 이상 심층 본문과 의미 필드를 점진 공개한다.',
    requiredSemanticFields: TARGET_SEMANTIC_FIELDS,
    workedExampleShape: ['inputs', 'assumptions', 'steps', 'result', 'interpretation', 'failureBoundary'],
    applicationClosure: ['realEconomyChannel', 'companyChannel', 'financialStatementChannel', 'valuationChannel', 'marketChannel', 'tradingApplication', 'invalidation'],
    rule: '길이만 늘린 반복 문장, 포괄 출처 하나의 다수 주장 재사용, 학습 원고에서 직접 BUY/SELL 생성은 실패다.'
  }
};

if (process.argv.includes('--write')) {
  const outputPath = path.join(root, '_artifacts', 'knowledge-encyclopedia-depth-audit.json');
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(outputPath);
}

console.log(JSON.stringify(result, null, 2));
if (process.argv.includes('--strict') && result.status !== 'ENCYCLOPEDIA_DEPTH_CERTIFIED') process.exitCode = 1;
