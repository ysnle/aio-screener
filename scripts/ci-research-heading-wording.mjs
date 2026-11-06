// Screen review #19 (2026-11-04, v59.70): research headings name the subject, not a reading lesson. A title, list
// label, aside block or fold summary on 개념·분석 / 산업 지도 that says '읽는 법 / 읽는 순서 / 읽는 방법 / 읽는 핵심' or
// '먼저 알아둘 …' is the textbook tone the owner removed (feedback: no textbook tone, 2026-11-04).
// Behaviour, not source text: every analysis note is rendered (article + connection column) and every 산업 지도
// domain overview is mounted against scripts/lib/fake-dom.mjs, and the headings they produce are checked; the
// published research data (catalog, stories, page copy, learning paths) is checked by its title fields and by each
// paragraph's opening clause.
// Negative control: on integration-20261104 it fails — 'post-report-path' and 'truth-leverage-gauges' list labels end
// in '읽는 방법', the note and lesson columns are titled '먼저 알아둘 개념', and the cloud domain overview opens a
// paragraph with '이 분야를 읽는 핵심은'.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createFakeDocument } from './lib/fake-dom.mjs';
import { readAtlasCopySource, readConceptStories, readIndustryStories, readPrinciplesCatalogSource, repoRoot } from './lib/research-content.mjs';

export const TEXTBOOK_HEADING = /읽는\s*(?:법|방법|순서|핵심)|먼저\s*알아(?:둘|야\s*할)/;
const HEADING_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'SUMMARY', 'FIGCAPTION', 'LEGEND']);
const errors = [];
const flag = (where, text) => { if (TEXTBOOK_HEADING.test(String(text || ''))) errors.push(`${where}: "${String(text).slice(0, 80)}"`); };
const walk = (node, visit) => { visit(node); (node.children || []).forEach((child) => walk(child, visit)); };
const headingsOf = (where, root) => walk(root, (node) => {
  if (HEADING_TAGS.has(node.tagName) || node.classList?.contains('af-issue') || node.classList?.contains('rl-aside-title')) flag(`${where} <${node.tagName?.toLowerCase()}>`, node.textContent);
});

// 1. Analysis notes: the article, its connection column (block titles + linked note labels), and the list label.
const { LESSONS } = await import('../src/domain/knowledge/learning-core.js');
const { renderFrameArticle, renderFrameConnections } = await import('../src/ui/knowledge/analysis-frames.js');
const doc = createFakeDocument();
const block = (title) => { const box = doc.createElement('section'); const head = doc.createElement('h3'); head.textContent = title; box.appendChild(head); return box; };
for (const lesson of LESSONS) {
  flag(`note ${lesson.id} list label`, lesson.model ? lesson.title : String(lesson.issue || '').split(' — ')[0]);
  flag(`note ${lesson.id} title`, lesson.title);
  headingsOf(`note ${lesson.id}`, renderFrameArticle(doc, lesson));
  for (const node of renderFrameConnections(doc, lesson, { block })) headingsOf(`note ${lesson.id} column`, node);
}

// 2. 산업 지도 domain overviews, mounted the way the atlas page mounts them.
const { renderIndustryPage } = await import('../src/ui/knowledge/industry-view.js');
const domains = JSON.parse(readFileSync(resolve(repoRoot, 'public-data/atlas/source-packets.json'), 'utf8')).taxonomyDomains || [];
const industry = readIndustryStories();
const labels = { domain: (d) => d.title || d.id, node: (n) => n.title || n.id, category: (k) => k || '' };
const parts = { domainText: (d) => industry.INDUSTRY_DOMAIN_STORIES[d.id] || null, guide: () => null, basis: () => null, layers: () => null, story: () => null, domainStory: () => null };
let mounted = 0;
for (const domain of domains) {
  const root = doc.createElement('div');
  const shell = renderIndustryPage(doc, { root, state: { view: 'domain', selectedDomainId: domain.id }, data: { research: { taxonomyDomains: domains } }, labels, parts, onLocal() {}, onFrame() {}, onConcept() {} });
  if (shell) { headingsOf(`산업 지도 ${domain.id}`, shell); mounted += 1; }
}
if (domains.length && !mounted) errors.push('no 산업 지도 domain overview mounted — the check would pass vacuously');

// 3. Published research data: title-like fields anywhere, and the opening clause of every paragraph.
const TITLE_KEYS = /^(?:title|titleKo|label|heading|name|issue|summary|caption)$/;
const opening = (text) => String(text).split(/[.,—:]/)[0];
const scan = (where, value, key = '') => {
  if (typeof value === 'string') { if (TITLE_KEYS.test(key)) flag(`${where}.${key}`, value); else flag(`${where} paragraph opening`, opening(value)); return; }
  if (Array.isArray(value)) value.forEach((item, index) => scan(`${where}[${index}]`, item, key));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => scan(where, v, k));
};
const catalog = readPrinciplesCatalogSource();
scan('principles catalog', { nodes: catalog.nodes, lessons: catalog.lessons, paths: catalog.paths });
scan('concept stories', readConceptStories());
scan('industry stories', { nodes: industry.INDUSTRY_NODE_STORIES, domains: industry.INDUSTRY_DOMAIN_STORIES });
scan('atlas page copy', readAtlasCopySource());
const { LEARNING_PATHS } = await import('../src/ui/knowledge/concepts-view.js');
LEARNING_PATHS.forEach((band) => flag(`learning path ${band.level}`, band.title));

if (errors.length) {
  console.error(JSON.stringify({ ok: false, pattern: String(TEXTBOOK_HEADING), errors: errors.slice(0, 40), total: errors.length }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, notes: LESSONS.length, domains: mounted, pattern: String(TEXTBOOK_HEADING) }));
