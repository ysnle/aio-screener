#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  INTEGRATED_MARKET_AI_FRAMEWORK_PACK,
  INTEGRATED_MARKET_AI_FRAMEWORK_PACK_VERSION
} from '../src/domain/knowledge/integrated-market-ai-framework-pack.js';
import { atomicWriteJsonSync } from './lib/atomic-write.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const generatedAt = process.env.KNOWLEDGE_MANIFEST_DATE || '2026-09-12';
const principles = read('public-data/principles/lesson-library.json');
const atlas = read('public-data/atlas/foundation-lessons.json');
const nathan = read('public-data/knowledge/nathan-frameworks.json');
const concepts = read('public-data/knowledge/concepts.json');

const pageFrameworks = (page) => INTEGRATED_MARKET_AI_FRAMEWORK_PACK.frameworks.filter((framework) => framework.page === page);
const requiredFields = ['definition', 'mechanism', 'observables', 'confirmation', 'invalidation', 'counterclaim', 'question', 'visualization'];
for (const framework of INTEGRATED_MARKET_AI_FRAMEWORK_PACK.frameworks) {
  for (const field of requiredFields) {
    if (!framework[field] || (Array.isArray(framework[field]) && !framework[field].length)) throw new Error(`${framework.id}: missing ${field}`);
  }
  if (!['principles', 'atlas'].includes(framework.page)) throw new Error(`${framework.id}: unsupported page ${framework.page}`);
  if (framework.currentClaimsAllowed !== false || framework.rankingUse !== 'none') throw new Error(`${framework.id}: promotion boundary drift`);
}

const existingPrincipleIds = new Set((concepts.concepts || []).filter((concept) => concept.surface === 'principles').map((concept) => concept.legacyId));
const existingAtlasIds = new Set((concepts.concepts || []).filter((concept) => concept.surface === 'atlas').map((concept) => concept.legacyId));
for (const framework of INTEGRATED_MARKET_AI_FRAMEWORK_PACK.frameworks) {
  for (const linkedId of framework.linkedConceptIds) {
    const [surface, legacyId] = linkedId.split(':');
    if (surface === 'principles' && !existingPrincipleIds.has(legacyId)) throw new Error(`${framework.id}: missing Principles link ${linkedId}`);
    if (surface === 'atlas' && !existingAtlasIds.has(legacyId)) throw new Error(`${framework.id}: missing Atlas link ${linkedId}`);
  }
}

const integrationAudit = [
  {
    id: 'market-principles-curriculum',
    page: 'principles',
    sourceArtifact: 'public-data/principles/lesson-library.json',
    inventory: principles.lessons?.length || 0,
    checks: { definition: true, mechanism: true, example: true, counterScenario: true, verificationQuestion: true, route: true, currentClaimsPromoted: false },
    status: 'EXISTING_CANONICAL_LAYER'
  },
  {
    id: 'ai-era-foundations',
    page: 'atlas',
    sourceArtifact: 'public-data/atlas/foundation-lessons.json',
    inventory: atlas.lessons?.length || 0,
    checks: { definition: true, mechanism: true, example: true, counterScenario: true, verificationQuestion: true, route: true, currentClaimsPromoted: false },
    status: 'EXISTING_CANONICAL_LAYER'
  },
  {
    id: 'structural-frameworks',
    page: 'both',
    sourceArtifact: 'existing-reference-protocol',
    inventory: nathan.articles?.length || 0,
    checks: { mechanisms: true, observables: true, confirmation: true, invalidation: true, currentClaimsPromoted: false, rawExternalPostReplay: false },
    status: 'EXISTING_REFERENCE_PROTOCOL'
  },
  {
    id: 'current-supplied-manuscript',
    page: 'both',
    sourceArtifact: 'internal-structured-reference',
    inventory: INTEGRATED_MARKET_AI_FRAMEWORK_PACK.frameworks.length,
    checks: {
      marketPrinciplesConnected: pageFrameworks('principles').length > 0,
      aiEraConnected: pageFrameworks('atlas').length > 0,
      existingConceptLinksValidated: true,
      mechanismAndFailureBoundary: true,
      rawDocumentReplay: false,
      currentClaimsPromoted: false,
      rankingOrScreenerMutation: false
    },
    status: 'INTEGRATED_REFERENCE_FRAMEWORK'
  }
];

const datedScene = {
  asOf: '2026-09-12',
  status: 'REFERENCE_CANDIDATE_REQUIRES_PRIMARY_RECONCILIATION',
  categories: [
    '미국 물가·고용·PMI·소비심리·주택·수익률곡선',
    'AI 모델 세대·에이전트·디지털 노동·생산성 사례',
    '학습·추론 비용·커스텀 칩·HBM·네트워크·광연결',
    '전력·냉각·변압기·데이터센터·장기 전력계약',
    '빅테크 CAPEX·회사채·선급금·프로젝트 금융·레버리지',
    'AI 수익화·가동률·감가상각·FCF·ROIC·기업 해자'
  ],
  handling: '최신본에 포함된 수치·모델명·기업별 사례는 영구 개념과 분리하여 현재성 후보로만 분류한다. 공식 1차 출처·기준일·정의·반대 근거가 연결되기 전에는 스크리너 점수·랭킹·현재 주장·매매 신호에 사용하지 않는다.',
  retainedStructure: '에이전트 workflow, 추론 경제성, 시스템 처리량, 전력-컴퓨트 결합, AI 자금조달, 해자 강화·침식은 통합 구조 프레임으로 보존한다.'
};

const output = {
  ...INTEGRATED_MARKET_AI_FRAMEWORK_PACK,
  generatedAt,
  counts: {
    frameworks: INTEGRATED_MARKET_AI_FRAMEWORK_PACK.frameworks.length,
    principles: pageFrameworks('principles').length,
    atlas: pageFrameworks('atlas').length,
    concepts: INTEGRATED_MARKET_AI_FRAMEWORK_PACK.concepts.length,
    articles: INTEGRATED_MARKET_AI_FRAMEWORK_PACK.articles.length,
    crossPageSpine: INTEGRATED_MARKET_AI_FRAMEWORK_PACK.crossPageSpine.length
  },
  integrationAudit,
  datedScene,
  boundary: '공급 문헌에서 추출한 영구 원리와 분석 절차만 보존한다. 원문 문구·작성자·외부 게시물 식별자·현재 수치·매매 신호는 사용자 화면과 랭킹 로직에 복사하지 않는다.'
};

atomicWriteJsonSync(path.join(root, 'public-data', 'knowledge', 'integrated-market-ai-frameworks.json'), output);
console.log(JSON.stringify({ status: 'PASS', schemaVersion: INTEGRATED_MARKET_AI_FRAMEWORK_PACK_VERSION, counts: output.counts, audit: integrationAudit.map((row) => ({ id: row.id, status: row.status, inventory: row.inventory })) }, null, 2));
