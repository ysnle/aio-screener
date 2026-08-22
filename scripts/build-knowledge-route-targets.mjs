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
const catalogById = new Map(MARKET_PRINCIPLES_CATALOG.lessons.map((lesson) => [lesson.id, lesson]));
const articleTargetCount = principles.length + atlas.length;
const targets = [];
const PRINCIPLES_ROUTE_BY_CHAPTER = Object.freeze({
  A: ['macro', '생산성·실질성장', '장기'], B: ['macro', '통화·물가', '경기순환'], C: ['fxbond', '신용스프레드·유동성', '경기순환'],
  D: ['fxbond', '금리곡선·실질금리', '1년~10년'], E: ['macro', '성장·물가·고용', '월간~분기'], F: ['fundamental', '매출·마진·현금흐름', '분기~연간'],
  G: ['fundamental', '재무제표·자본효율', '분기~연간'], H: ['technical', '가격·거래량·시장구조', '일간~주간'], I: ['portfolio', '비중·상관·낙폭', '월간~연간'],
  J: ['technical', '추세·변동성·무효화', '일간~주간'], K: ['themes', '산업 병목·설비투자', '분기~다년'], L: ['themes', 'AI 가치사슬·수요', '분기~다년'],
  M: ['fundamental', '투하자본·자본비용', '연간~다년'], N: ['options', '변동성·꼬리위험', '일간~분기'], O: ['screener', '품질·성장·밸류에이션', '분기~다년']
});
const ATLAS_ROUTE_BY_LAYER = Object.freeze({
  F0: ['principles', '문제·학습·시스템 분류', '구조'], F1: ['themes', '물리·계산·반도체 제약', '다년'], F2: ['themes', '학습 방식·모델 품질', '분기~다년'],
  F3: ['themes', '모델 구조·추론 비용', '분기~다년'], F4: ['themes', 'AI 시스템·Agent·안전', '분기~다년'], F5: ['themes', 'AI 인프라 병목·공급망', '분기~다년'], F6: ['fundamental', '가동률·CAPEX·FCF·ROIC', '분기~다년']
});
const routeTarget = (mapping, key) => {
  const [routeId, metric, timeframe] = mapping[key] || ['atlas', '구조적 연결', '구조'];
  return { routeId, routeLabel: `${metric} 전문 화면에서 검증`, metric, timeframe };
};
for (const lesson of principles) {
  const compatibility = catalogById.get(lesson.id);
  const professional = compatibility?.route ? { routeId: compatibility.route, routeLabel: compatibility.routeLabel, metric: routeTarget(PRINCIPLES_ROUTE_BY_CHAPTER, lesson.chapterId).metric, timeframe: routeTarget(PRINCIPLES_ROUTE_BY_CHAPTER, lesson.chapterId).timeframe } : routeTarget(PRINCIPLES_ROUTE_BY_CHAPTER, lesson.chapterId);
  targets.push({ articleId: `principles:${lesson.id}`, conceptId: (lesson.nodeIds || [])[0] ? `principles:${lesson.nodeIds[0]}` : null, ...professional, returnContext: { route: 'principles', lesson: lesson.id }, status: 'ROUTE_TARGET', reviewedAt });
}
for (const lesson of atlas) targets.push({ articleId: `atlas-foundations:${lesson.id}`, conceptId: (lesson.relatedAtlasNodeIds || [])[0] ? `atlas:${lesson.relatedAtlasNodeIds[0]}` : null, ...routeTarget(ATLAS_ROUTE_BY_LAYER, lesson.layer), returnContext: { route: 'atlas', lesson: lesson.id }, status: 'ROUTE_TARGET', reviewedAt });
for (const lesson of MARKET_PRINCIPLES_CATALOG.lessons) {
  const sourceLesson = principles.find((item) => item.id === lesson.id);
  const professional = routeTarget(PRINCIPLES_ROUTE_BY_CHAPTER, sourceLesson?.chapterId);
  targets.push({ articleId: `compatibility:${lesson.id}`, articleKind: 'compatibility-lesson', conceptId: (lesson.nodeIds || [])[0] ? `principles:${lesson.nodeIds[0]}` : null, routeId: lesson.route, routeLabel: lesson.routeLabel, metric: professional.metric, timeframe: professional.timeframe, returnContext: { route: 'principles', lesson: lesson.id }, status: 'ROUTE_TARGET', reviewedAt });
}
const scenarios = [
  ['novice', `principles:${principles[0].id}`], ['novice', `atlas-foundations:${atlas[0].id}`], ['intermediate-investor', `principles:${principles[20].id}`], ['intermediate-investor', `principles:${principles[30].id}`], ['active-trader', `principles:${principles[50].id}`], ['active-trader', `compatibility:${MARKET_PRINCIPLES_CATALOG.lessons[0].id}`], ['domain-expert', `atlas-foundations:${atlas[15].id}`], ['domain-expert', `atlas-foundations:${atlas[20].id}`], ['korean-investor', `principles:${principles[70].id}`], ['korean-investor', `principles:${principles[80].id}`], ['returning-learner', `principles:${principles[1].id}`], ['returning-learner', `atlas-foundations:${atlas[1].id}`], ['skeptical-risk-aware', `principles:${principles[90].id}`], ['skeptical-risk-aware', `atlas-foundations:${atlas[30].id}`], ['time-poor', `principles:${principles[10].id}`], ['time-poor', `atlas-foundations:${atlas[40].id}`], ['novice', `compatibility:${MARKET_PRINCIPLES_CATALOG.lessons[1].id}`], ['active-trader', `atlas-foundations:${atlas[47].id}`]
].map(([persona, articleId]) => ({ persona, articleId, expectedBoundary: 'REFERENCE_OR_OVERVIEW_ONLY' }));
writeJson('public-data/knowledge/route-targets.json', { schemaVersion: 'knowledge-route-targets.v1', generatedAt: reviewedAt, status: 'ROUTE_TARGETS_CONNECTED', boundary: '전문 화면 링크는 검증할 metric·timeframe 맥락을 전달하며 투자 판단을 생성하지 않는다.', allowedRoutes: ['atlas', 'principles', 'macro', 'fxbond', 'fundamental', 'themes', 'technical', 'market-news', 'screener', 'entity', 'portfolio', 'options'], counts: { articleTargets: articleTargetCount, compatibilityTargets: MARKET_PRINCIPLES_CATALOG.lessons.length }, targets, scenarios });
console.log(JSON.stringify({ status: 'PASS', targets: targets.length, articleTargets: articleTargetCount, compatibilityTargets: MARKET_PRINCIPLES_CATALOG.lessons.length, scenarios: scenarios.length, routeTargets: targets.filter((target) => target.routeId).length }, null, 2));
