#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWriteJsonSync } from './lib/atomic-write.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reviewedAt = process.env.KNOWLEDGE_MANIFEST_DATE || '2026-08-18';

const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const writeJson = (relativePath, value) => atomicWriteJsonSync(path.join(root, relativePath), value);

function clean(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function recoverShort(value, markers = []) {
  const text = clean(value);
  for (const marker of markers) {
    const index = text.indexOf(marker);
    if (index > 0) return text.slice(0, index).trim();
  }
  return text;
}

function normalizeShort(source, kind) {
  const markers = kind === 'principles'
    ? {
      definition: [' 이 레슨은'],
      mechanism: [' 작동 경로를 읽을 때에는'],
      example: [' 이 사례를 분석할 때'],
      counterScenario: [' 이 반례는'],
      verificationQuestion: [' 이 질문에 답할 때는'],
      diagram: [' · ']
    }
    : {
      definition: [' 이 레슨은'],
      mechanism: [' 작동 원리는'],
      example: [' 이 사례는 설명을 위해'],
      counterScenario: [' 이 제한은'],
      verificationQuestion: [' 답변에는'],
      diagram: [' · ']
    };
  return Object.fromEntries(Object.entries(source || {}).map(([key, value]) => [key, recoverShort(value, markers[key] || [])]));
}


// Preserve authored summaries; do not manufacture semantic depth from shared prose.
const generatedFields = ['intuition', 'formalModel', 'workedExample', 'realEconomyChannel', 'companyChannel', 'financialStatementChannel', 'valuationChannel', 'marketChannel', 'tradingApplication', 'invalidation', 'glossary', 'semanticStatus'];
for (const [kind, relativePath] of [['principles', 'public-data/principles/lesson-library.json'], ['atlas', 'public-data/atlas/foundation-lessons.json']]) {
  const artifact = readJson(relativePath);
  const lessons = artifact.lessons.map((lesson) => {
    const source = lesson.summary || normalizeShort(lesson, kind);
    const summary = {
      definition: clean(source.definition), mechanism: clean(source.mechanism), example: clean(source.example),
      counterScenario: clean(source.counterScenario || source.limit),
      verificationQuestion: clean(source.verificationQuestion || source.teachingQuestion),
      diagram: clean(source.diagram || source.visualization)
    };
    const result = { ...lesson, ...summary, summary, deepStatus: 'RECONSTRUCTION_REQUIRED' };
    if (lesson.semanticStatus === 'REFERENCE_SEMANTIC_AUTHORED') for (const field of generatedFields) delete result[field];
    if (kind === 'atlas') Object.assign(result, { limit: summary.counterScenario, teachingQuestion: summary.verificationQuestion, visualization: summary.diagram });
    return result;
  });
  writeJson(relativePath, { ...artifact, revision: reviewedAt + '-source-preserved', deepFormStatus: 'RECONSTRUCTION_REQUIRED',
    ...(kind === 'atlas' ? { longFormStatus: 'RECONSTRUCTION_REQUIRED' } : {}),
    boundary: '개념별 원문과 출처를 보존한 짧은 참고 원고다. 심층 설명과 계산 사례는 추가 집필·검증이 필요하다.', lessons });
  console.log(kind + ': ' + lessons.length + ' source summaries preserved');
}
