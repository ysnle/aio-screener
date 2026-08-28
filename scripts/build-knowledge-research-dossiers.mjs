#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWriteJsonSync } from './lib/atomic-write.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const write = (file, value) => {
  const target = path.join(root, file);
  atomicWriteJsonSync(target, value);
};
const reviewedAt = process.env.KNOWLEDGE_RESEARCH_DATE || '2026-08-18';
const matrix = read('public-data/knowledge/coverage-matrix.json');
const sourcesBundle = read('public-data/knowledge/sources.json');
const claimsBundle = read('public-data/knowledge/claims.json');
const seedBundle = read('public-data/knowledge/research-source-seeds.json');
const factsBundle = read('public-data/knowledge/research-facts.json');
const articlesBundle = read('public-data/knowledge/articles.json');
const sources = new Map((sourcesBundle.sources || []).map((source) => [source.id, source]));
const facts = new Map((factsBundle.facts || []).map((fact) => [fact.factId, fact]));
const articleById = new Map((articlesBundle.articles || []).map((article) => [article.articleId, article]));
const seeds = seedBundle.sources || [];
const sourceText = (unit) => `${unit.unitId} ${unit.title} ${(unit.sourceIds || []).join(' ')}`.toLowerCase();
const seedRules = [
  { test: /(real-interest|inflation|nominal|real-rate|yield-curve|interest|D2|B2|E2|D3|E4)/i, ids: ['WEB-FRED-INFLATION-EXPECTATIONS'] },
  { test: /(productivity|output|labour|labor|capital-input|growth|A2)/i, ids: ['WEB-OECD-PRODUCTIVITY-METHODS'] },
  { test: /(cpi|purchasing-power|price-level|B2|B3)/i, ids: ['WEB-BLS-CPI-CONCEPTS'] },
  { test: /(monetary|central-bank|policy-rate|FOMC|rates|D[1-5])/i, ids: ['WEB-FED-MPR-JULY-2026'] },
  { test: /(credit|bank|debt|leverage|liquidity|cycle|financial-stability|maturity|funding|C[1-4]|I[1-5])/i, ids: ['WEB-FED-FINANCIAL-STABILITY'] },
  { test: /(ETF|ETN|ELW|KRX|Korea|한국|listed-product|H[1-9]|O[1-5])/i, ids: ['WEB-KRX-SECURITIES-INTRO'] },
  { test: /(financial|valuation|income|balance|cash|roic|fcf|capital|enterprise|filing|10-k|G[1-8]|K10)/i, ids: ['WEB-SEC-FINANCIAL-STATEMENTS-2024', 'WEB-SEC-INVESTOR-10K-2020'] },
  { test: /(order|liquidity|execution|price-discovery|market|trading|H[1-9]|J[1-9])/i, ids: ['WEB-FINRA-ORDER-TYPES'] },
  { test: /(euv|lithography|foundry|semiconductor|node|high-na|optics|chip|L[1-9])/i, ids: ['WEB-ASML-EUV-2026'] },
  { test: /(attention|transformer|token|embedding|context|kv-cache|pretraining|post-training|evaluation|hallucination|human-review|agent|tool-use|world-model|NIST|AI)/i, ids: ['WEB-ARXIV-TRANSFORMER-2017', 'WEB-NIST-AI-RMF-2023'] },
  { test: /(rules-vs-learning|learning-types|supervised|unsupervised|reinforcement|generative)/i, ids: ['WEB-GOOGLE-ML-TYPES-2026'] },
  { test: /(generalization-and-memory|memorization|generalization)/i, ids: ['WEB-ARXIV-GENERALIZE-MEMORIZE-2018'] },
  { test: /(parameter-vs-external-memory|retrieval-augmented-generation|external-memory)/i, ids: ['WEB-ARXIV-RAG-2020'] },
  { test: /(tool-use|agent-loop|reasoning-and-acting)/i, ids: ['WEB-ARXIV-REACT-2022'] },
  { test: /(state-action-dynamics|planning-and-control|world-model-limitations)/i, ids: ['WEB-ARXIV-WORLD-MODELS-2018'] },
  { test: /(silicon-and-doping|doping|semiconductor)/i, ids: ['WEB-IBM-SEMICONDUCTOR-DOPING'] },
  { test: /(vectors-and-matrices|cpu-gpu-asic-npu|precision-and-tensor-core|memory-wall|parallel-processing)/i, ids: ['WEB-NVIDIA-CUDA-PROGRAMMING-GUIDE-2026', 'WEB-GOOGLE-TPU-ARCHITECTURE-2026'] },
  { test: /(bottlenecks-and-scarcity|hbm|advanced-packaging|chiplet|interconnect)/i, ids: ['WEB-TSMC-3DFABRIC-2026', 'WEB-MICRON-HBM2E-2020'] },
  { test: /(capex-and-depreciation|unit-economics|utilization|fcf-and-funding)/i, ids: ['WEB-SEC-GOOGLE-10K-2025'] },
  { test: /(energy|power|grid|cooling|rack|PUE|utilization|capacity|yield|data-center)/i, ids: ['WEB-DOE-DATACENTER-PUE-2019', 'WEB-DOE-DATACENTER-DESIGN-2024'] },
  { test: /(AI|risk|evaluation|human-review|governance|deployment)/i, ids: ['WEB-NIST-AI-RMF-2023', 'WEB-NIST-AI-RMF-CORE-2023'] }
];
const safeFile = (id) => id.replace(/[^a-zA-Z0-9._-]+/g, '_');
const claimByEntity = new Map();
for (const claim of claimsBundle.claims || []) {
  const key = `${claim.surface}:${claim.entityId}`;
  claimByEntity.set(key, [...(claimByEntity.get(key) || []), claim]);
}
const queryFor = (unit) => [
  `${unit.title} mechanism primary source`,
  `${unit.title} official data standard filing evidence`,
  `${unit.title} disconfirming evidence limitations`
];
const dossiers = [];
for (const unit of matrix.units || []) {
  const matchedIds = [...new Set(seedRules.filter((rule) => rule.test.test(sourceText(unit))).flatMap((rule) => rule.ids))];
  const article = articleById.get(unit.articleId);
  const attachedFactIds = [...new Set((article?.article?.researchEvidence || []).map((evidence) => evidence.factId).filter(Boolean))];
  const attachedSourceIds = attachedFactIds.map((factId) => facts.get(factId)?.sourceId).filter(Boolean);
  const selectedIds = [...new Set([...attachedSourceIds, ...matchedIds])];
  const selectedSources = selectedIds.map((id) => sources.get(id)).filter(Boolean).map((source) => ({
    sourceId: source.id,
    url: source.url,
    publisher: source.publisher,
    title: source.title,
    sourceTier: source.sourceTier || 'PRIMARY_OFFICIAL',
    directness: source.directness || 'CONTEXT',
    selectionReason: attachedSourceIds.includes(source.id) ? 'dated fact attached to the structured lesson article; directness remains limited to the stated scope' : 'matched to the content unit topic; claim-specific use remains subject to semantic review'
  }));
  const candidateSources = [...new Set([...(unit.sourceIds || []), ...selectedIds])].map((id) => {
    const source = sources.get(id);
    return source ? { sourceId: id, url: source.url, publisher: source.publisher, title: source.title, sourceTier: source.sourceTier || null } : { sourceId: id, unresolved: true };
  });
  const claims = claimByEntity.get(`${unit.surface === 'atlas-foundations' ? 'atlas' : unit.surface}:${unit.unitId.split(':').at(-1)}`) || [];
  const haystack = sourceText(unit);
  const inferredResearchFactIds = (factsBundle.facts || [])
    .filter((fact) => (fact.appliesTo || []).some((token) => haystack.includes(String(token).toLowerCase())))
    .map((fact) => fact.factId)
    .slice(0, 6);
  const researchFactIds = [...new Set([...attachedFactIds, ...inferredResearchFactIds])];
  const hasDatedEvidence = selectedSources.length > 0 && researchFactIds.some((factId) => facts.get(factId)?.asOf && sources.has(facts.get(factId)?.sourceId));
  const status = hasDatedEvidence ? 'RESEARCHED' : selectedSources.length ? 'RESEARCH_IN_PROGRESS' : 'RESEARCH_REQUIRED';
  const dossier = {
    schemaVersion: 'knowledge-research-dossier.v1',
    dossierId: `research:${unit.unitId}`,
    contentUnitId: unit.unitId,
    unitKind: unit.kind,
    title: unit.title,
    researchQuestions: [
      `What is the claim-specific mechanism for ${unit.title}?`,
      `Which variable, unit, time boundary or assumption would change the interpretation of ${unit.title}?`,
      `Which official, academic, standard or filing evidence can directly support the relevant claim?`
    ],
    queries: queryFor(unit),
    searchedAt: selectedSources.length ? reviewedAt : null,
    method: selectedSources.length ? 'WEB_SEARCH_PRIMARY_PAGE_OPENED_SEED' : 'NOT_STARTED',
    candidateSources,
    selectedSources,
    rejectedSources: candidateSources.filter((candidate) => candidate.unresolved).map((candidate) => ({ sourceId: candidate.sourceId, reason: 'unresolved in canonical registry; cannot be promoted' })),
    sourceTiers: [...new Set(selectedSources.map((source) => source.sourceTier).filter(Boolean))],
    claimCoverage: claims.map((claim) => ({ claimId: claim.claimId, currentDirectness: claim.directness, requiredAction: claim.directness === 'DIRECT' ? 'retain scope and asOf' : 'independent direct source required' })),
    researchFactIds,
    consensus: hasDatedEvidence ? 'At least one dated primary/reference fact is attached to the lesson scope; independent comparison, semantic review and user validation remain open.' : selectedSources.length ? 'Seed sources were directly inspected for topic relevance; claim-level consensus remains open.' : 'Not assessed.',
    disagreement: 'Not assessed until independent source comparison is complete.',
    invalidation: 'Do not promote current, quantitative, company or product claims without claim-specific direct evidence and an asOf boundary.',
    currentnessBoundary: 'Reference-only. Time-varying values must come from data-refresh or an asOf/freshness-aware evidence artifact.',
    q1Thesis: `A claim about ${unit.title} must be expressed as a mechanism with explicit scope and evidence rather than as a label or recommendation.`,
    q2ParadigmShift: 'The relevant structural change, if any, must be supported by a dated primary, official, academic or standard source.',
    q3DisconfirmingVariable: 'The dossier must name the observed variable, assumption or boundary that would falsify the interpretation.',
    q4StructuralMechanism: `Trace ${unit.title} through inputs, constraints, outputs and measurable consequences before applying a market interpretation.`,
    q5AdjacentImpact: 'Only retain adjacent effects that have a source-backed mechanism; do not infer a company or market outcome from topic proximity.',
    status,
    completion: { researchComplete: hasDatedEvidence, sourceProfileComplete: selectedSources.length > 0, semanticReview: 'REQUIRED', userValidation: 'NOT_CONDUCTED' }
  };
  dossiers.push(dossier);
  write(`public-data/knowledge/research-dossiers/${safeFile(unit.unitId)}.json`, dossier);
}
write('public-data/knowledge/research-dossiers.json', {
  schemaVersion: 'knowledge-research-dossiers.v1',
  generatedAt: reviewedAt,
  status: 'RESEARCH_IN_PROGRESS',
  boundary: 'Dossiers preserve a per-unit research contract. RESEARCHED means a dated fact and canonical source are attached to the stated scope; it does not certify independent source comparison, semantic review or user validation.',
  counts: { total: dossiers.length, researchRequired: dossiers.filter((d) => d.status === 'RESEARCH_REQUIRED').length, researchInProgress: dossiers.filter((d) => d.status === 'RESEARCH_IN_PROGRESS').length, researched: dossiers.filter((d) => d.status === 'RESEARCHED').length },
  dossiers
});
console.log(JSON.stringify({ status: 'PASS_WITH_BOUNDARY', total: dossiers.length, researchRequired: dossiers.filter((d) => d.status === 'RESEARCH_REQUIRED').length, researchInProgress: dossiers.filter((d) => d.status === 'RESEARCH_IN_PROGRESS').length }, null, 2));
