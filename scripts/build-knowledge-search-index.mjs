#!/usr/bin/env node
// P1474 (knowledge review 2026-10-04): one search index across the learning surfaces. Searching the
// glossary for HBM, 포토닉스 or ROIC found nothing although the industry map, the principles lessons and
// the analysis frames covered them. The index lists every frame, principles lesson, principles node,
// AI-foundation lesson and industry-map node with its Korean title, a short text, search keys (canonical
// concept aliases included) and the route that opens it. Deterministic; part of the knowledge parity set.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWriteJsonSync } from './lib/atomic-write.mjs';
import { MARKET_PRINCIPLES_CATALOG } from '../src/ui/pages/principles.js';
import { DOMAIN_LABELS, FOUNDATION_MODULE_LABELS, TAXONOMY_NODE_LABELS } from '../src/ui/pages/atlas.js';
import { LESSONS, PATHS } from '../src/domain/knowledge/learning-core.js';
import { CONCEPT_CORE } from '../src/domain/knowledge/concept-core.js';
import { CONCEPT_SURFACES } from '../src/domain/knowledge/concept-surfaces.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const clip = (text, max = 150) => { const value = String(text || '').replace(/\s+/g, ' ').trim(); return value.length > max ? `${value.slice(0, max - 1)}…` : value; };

const keysFor = new Map();
for (const concept of CONCEPT_CORE) {
  for (const target of CONCEPT_SURFACES[concept.id] || []) {
    if (!keysFor.has(target)) keysFor.set(target, new Set());
    [concept.term, ...concept.aliases, ...(concept.covers || [])].forEach((key) => keysFor.get(target).add(key));
  }
}
const keys = (id, extra = []) => [...new Set([...extra, ...(keysFor.get(id) || [])].filter(Boolean).map(String))];

const entries = [];
const pathTitle = new Map(PATHS.map((item) => [item.id, item.title]));
for (const lesson of LESSONS) {
  const id = `frame:${lesson.id}`;
  entries.push({ id, surface: 'frame', surfaceLabel: '분석 노트', title: lesson.issue, text: clip(lesson.answer), group: pathTitle.get(lesson.path) || null, keys: keys(id, [lesson.title, ...(lesson.concepts || [])]), route: { page: 'principles', params: { mode: 'frames', node: lesson.id } } });
}
// Codex browser audit H52: the twelve column chapters were not searchable at all.
for (const part of read('public-data/principles/narrative-journey.json').parts || []) {
  for (const chapter of part.chapters || []) {
    const id = `column:${chapter.id}`;
    entries.push({ id, surface: 'column', surfaceLabel: '칼럼', title: chapter.title, text: clip(chapter.lead), group: part.title || null, keys: keys(id, [...(chapter.chain || [])]), route: { page: 'principles', params: { mode: 'story', chapter: chapter.id } } });
  }
}
const principlesLessons = read('public-data/principles/lesson-library.json').lessons || [];
for (const lesson of principlesLessons) {
  const id = `principles-lesson:${lesson.id}`;
  entries.push({ id, surface: 'principles-lesson', surfaceLabel: '시장 원리 레슨', title: `${lesson.id} ${lesson.title}`, text: clip(lesson.definition), group: lesson.level || null, keys: keys(id), route: { page: 'principles', params: { lesson: lesson.id } } });
}
for (const node of MARKET_PRINCIPLES_CATALOG.nodes || []) {
  const id = `principles-node:${node.id}`;
  entries.push({ id, surface: 'principles-node', surfaceLabel: '시장 원리 개념 지도', title: node.title || node.id, text: clip(node.summary || node.definition || node.description || ''), group: null, keys: keys(id), route: { page: 'principles', params: { mode: 'tree', node: node.id } } });
}
const foundations = read('public-data/atlas/foundations.json');
const layerOf = new Map();
for (const layer of foundations.layers || []) for (const moduleId of layer.modules || []) layerOf.set(moduleId, layer.id);
for (const lesson of read('public-data/atlas/foundation-lessons.json').lessons || []) {
  const id = `atlas-foundation:${lesson.id}`;
  entries.push({ id, surface: 'atlas-foundation', surfaceLabel: 'AI 기초', title: FOUNDATION_MODULE_LABELS[lesson.id] || lesson.title || lesson.id, text: clip(lesson.definition), group: layerOf.get(lesson.id) || null, keys: keys(id, [lesson.title]), route: { page: 'atlas', params: { mode: 'foundations', chapter: layerOf.get(lesson.id) || null, lesson: lesson.id } } });
}
const taxonomy = read('public-data/atlas/taxonomy-node-coverage.json');
for (const node of taxonomy.nodes || []) {
  const id = `atlas:${node.nodeId}`;
  entries.push({ id, surface: 'atlas-node', surfaceLabel: '산업 지도', title: TAXONOMY_NODE_LABELS[node.nodeId] || node.title, text: clip(`${DOMAIN_LABELS[node.domainId] || ''} · ${node.title}`), group: DOMAIN_LABELS[node.domainId] || null, keys: keys(id, [node.title, node.nodeId.replaceAll('-', ' ')]), route: { page: 'atlas', params: { mode: 'taxonomy', node: node.nodeId, domain: node.domainId } } });
}

// Managers (운용사·13F) by name, filer and style.
for (const manager of read('public-data/masters/manager-catalog.json').managers || []) {
  const id = `manager:${manager.id}`;
  entries.push({ id, surface: 'manager', surfaceLabel: '운용사·13F', title: manager.displayName || manager.id, text: clip(`${manager.filer || ''} · ${manager.style || ''}`), group: manager.style || null, keys: keys(id, [manager.filer, manager.style]), route: { page: 'masters', params: { manager: manager.id } } });
}

const output = {
  schemaVersion: 'knowledge-search-index.v1',
  generatedFrom: ['src/domain/knowledge/learning-core.js', 'src/domain/knowledge/concept-core.js', 'public-data/principles/narrative-journey.json', 'public-data/principles/lesson-library.json', 'src/ui/pages/principles.js', 'public-data/atlas/foundation-lessons.json', 'public-data/atlas/taxonomy-node-coverage.json', 'public-data/masters/manager-catalog.json'],
  boundary: 'Search index of learning surfaces; titles and short texts only. Glossary entries are searched in the page itself.',
  counts: Object.fromEntries([...new Set(entries.map((entry) => entry.surface))].map((surface) => [surface, entries.filter((entry) => entry.surface === surface).length])),
  entries
};
atomicWriteJsonSync(path.join(root, 'public-data/knowledge/search-index.json'), output);
console.log(JSON.stringify({ ok: true, entries: entries.length, counts: output.counts }));
