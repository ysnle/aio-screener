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
console.log(JSON.stringify({ status: 'PASS', renderers: 5 }, null, 2));
