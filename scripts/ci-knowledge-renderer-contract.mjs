#!/usr/bin/env node

import assert from 'node:assert/strict';
// v58.51: the evidence/graph/path/tree renderers had no product caller and were removed; lesson.js (live) and the principles
// relation-direction text stay covered here.
import { renderKnowledgeLesson } from '../src/ui/knowledge/lesson.js';

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
{
  // The connected-concepts list shows which way a relation points (the map aside used to print the relation word alone).
  const principles = (await import('node:fs')).readFileSync(new URL('../src/ui/pages/principles.js', import.meta.url), 'utf8');
  assert.ok(/edge\.from === node\.id \? '→' : '←'\} \$\{edge\.relation/.test(principles), 'the connected-concepts list must show the relation direction');
}
console.log(JSON.stringify({ status: 'PASS', renderers: 1 }, null, 2));
