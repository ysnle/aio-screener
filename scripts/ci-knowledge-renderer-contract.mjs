#!/usr/bin/env node

import assert from 'node:assert/strict';
import { renderKnowledgeEvidence } from '../src/ui/knowledge/evidence.js';
import { renderKnowledgeGraphTextAlternative } from '../src/ui/knowledge/graph.js';
import { renderKnowledgeLesson } from '../src/ui/knowledge/lesson.js';
import { renderKnowledgePath } from '../src/ui/knowledge/path.js';
import { renderKnowledgeTree } from '../src/ui/knowledge/tree.js';

function documentRef() {
  return {
    createElement(tag) { return node(tag); }
  };
}
function node(tag) {
  return { tagName: tag, children: [], attributes: {}, className: '', textContent: '', append(...children) { this.children.push(...children); }, appendChild(child) { this.children.push(child); }, setAttribute(key, value) { this.attributes[key] = value; }, addEventListener() {}, type: '', href: '', target: '', rel: '' };
}
const documentLike = documentRef();
const article = { title: '개념', article: { intuition: '직관', formalModelOrRationale: { text: '근거' }, workedExampleOrRationale: { inputs: ['입력'], assumptions: ['가정'], steps: ['단계'], result: '결과', interpretation: '해석', failureBoundary: '경계' }, realEconomyChannel: '실물', companyChannel: '기업', financialStatementChannel: '재무', valuationChannel: '밸류', marketChannel: '시장', tradingApplication: '적용', invalidation: '무효화', glossary: [{ term: '개념', definition: '정의' }], claimIds: ['c1'], sourceIds: ['S1'] } };
assert.equal(renderKnowledgeLesson(documentLike, article).tagName, 'article');
assert.equal(renderKnowledgeEvidence(documentLike, ['S1'], { resolve: () => ({ title: '출처', url: 'https://example.com', sourceRole: 'CONTEXT' }) }).tagName, 'section');
assert.equal(renderKnowledgeGraphTextAlternative(documentLike, [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }], [{ from: 'a', to: 'b', type: 'CAUSES' }]).tagName, 'section');
assert.equal(renderKnowledgePath(documentLike, { title: '경로', nodeIds: ['a'] }, [{ id: 'a', title: 'A' }]).tagName, 'nav');
assert.equal(renderKnowledgeTree(documentLike, [{ title: '분류', nodes: [{ id: 'a', title: 'A' }] }]).tagName, 'div');
// P1537 (audit H110): the text alternative names a relation in the reader's words (the edge's own Korean relation), never the
// internal English edge type, and falls back to a neutral '관계' rather than an enum.
{
  const textOf = (n) => (n.textContent || '') + (n.children || []).map(textOf).join('');
  const nodes = [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }];
  const withBoth = textOf(renderKnowledgeGraphTextAlternative(documentLike, nodes, [{ from: 'a', to: 'b', relation: '분해', type: 'CAUSES' }]));
  assert.ok(withBoth.includes('A → B · 분해'), `relation text missing: ${withBoth}`);
  assert.ok(!/CAUSES/.test(withBoth), `internal edge type reached the reader: ${withBoth}`);
  const typeOnly = textOf(renderKnowledgeGraphTextAlternative(documentLike, nodes, [{ from: 'a', to: 'b', type: 'CAUSES' }]));
  assert.ok(typeOnly.includes('A → B · 관계') && !/CAUSES/.test(typeOnly), `an edge with only an internal type must read 관계: ${typeOnly}`);
  // The connected-concepts list shows which way a relation points (the map aside used to print the relation word alone).
  const principles = (await import('node:fs')).readFileSync(new URL('../src/ui/pages/principles.js', import.meta.url), 'utf8');
  assert.ok(/edge\.from === node\.id \? '→' : '←'\} \$\{edge\.relation/.test(principles), 'the connected-concepts list must show the relation direction');
}
console.log(JSON.stringify({ status: 'PASS', renderers: 5 }, null, 2));
