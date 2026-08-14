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
const targets = [];
for (const lesson of principles) {
  const compatibility = catalogById.get(lesson.id);
  targets.push({ articleId: `principles:${lesson.id}`, conceptId: (lesson.nodeIds || [])[0] ? `principles:${lesson.nodeIds[0]}` : null, routeId: compatibility?.route || null, routeLabel: compatibility?.routeLabel || null, metric: null, timeframe: null, returnContext: { route: 'principles', lesson: lesson.id }, status: compatibility?.route ? 'ROUTE_TARGET' : 'OVERVIEW_ONLY', reviewedAt });
}
for (const lesson of atlas) targets.push({ articleId: `atlas-foundations:${lesson.id}`, conceptId: (lesson.relatedAtlasNodeIds || [])[0] ? `atlas:${lesson.relatedAtlasNodeIds[0]}` : null, routeId: null, routeLabel: null, metric: null, timeframe: null, returnContext: { route: 'atlas', lesson: lesson.id }, status: 'OVERVIEW_ONLY', reviewedAt });
for (const lesson of MARKET_PRINCIPLES_CATALOG.lessons) targets.push({ articleId: `compatibility:${lesson.id}`, articleKind: 'compatibility-lesson', conceptId: (lesson.nodeIds || [])[0] ? `principles:${lesson.nodeIds[0]}` : null, routeId: lesson.route, routeLabel: lesson.routeLabel, metric: null, timeframe: null, returnContext: { route: 'principles', lesson: lesson.id }, status: 'ROUTE_TARGET', reviewedAt });
const scenarios = [
  ['novice', `principles:${principles[0].id}`], ['novice', `atlas-foundations:${atlas[0].id}`], ['intermediate-investor', `principles:${principles[20].id}`], ['intermediate-investor', `principles:${principles[30].id}`], ['active-trader', `principles:${principles[50].id}`], ['active-trader', `compatibility:${MARKET_PRINCIPLES_CATALOG.lessons[0].id}`], ['domain-expert', `atlas-foundations:${atlas[15].id}`], ['domain-expert', `atlas-foundations:${atlas[20].id}`], ['korean-investor', `principles:${principles[70].id}`], ['korean-investor', `principles:${principles[80].id}`], ['returning-learner', `principles:${principles[1].id}`], ['returning-learner', `atlas-foundations:${atlas[1].id}`], ['skeptical-risk-aware', `principles:${principles[90].id}`], ['skeptical-risk-aware', `atlas-foundations:${atlas[30].id}`], ['time-poor', `principles:${principles[10].id}`], ['time-poor', `atlas-foundations:${atlas[40].id}`], ['novice', `compatibility:${MARKET_PRINCIPLES_CATALOG.lessons[1].id}`], ['active-trader', `atlas-foundations:${atlas[47].id}`]
].map(([persona, articleId]) => ({ persona, articleId, expectedBoundary: 'REFERENCE_OR_OVERVIEW_ONLY' }));
writeJson('public-data/knowledge/route-targets.json', { schemaVersion: 'knowledge-route-targets.v1', generatedAt: reviewedAt, status: 'STRUCTURED_REFERENCE_DRAFT', allowedRoutes: ['atlas', 'principles', 'macro', 'fxbond', 'fundamental', 'themes', 'technical', 'market-news', 'screener', 'entity', 'portfolio', 'options'], counts: { articleTargets: 159, compatibilityTargets: MARKET_PRINCIPLES_CATALOG.lessons.length }, targets, scenarios });
console.log(JSON.stringify({ status: 'PASS', targets: targets.length, articleTargets: 159, compatibilityTargets: MARKET_PRINCIPLES_CATALOG.lessons.length, scenarios: scenarios.length, routeTargets: targets.filter((target) => target.routeId).length }, null, 2));
