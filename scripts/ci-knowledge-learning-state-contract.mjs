#!/usr/bin/env node

import assert from 'node:assert/strict';
import { parseKnowledgeRouteState, serializeKnowledgeRouteState } from '../src/app/knowledge-route-state.js';
import { createLearningState } from '../src/domain/knowledge/learning-state.js';

const location = { href: 'https://aio-screener.local/?mode=graph&node=compute&path=ai&step=2#principles', pathname: '/', search: '?mode=graph&node=compute&path=ai&step=2', hash: '#principles' };
const parsed = parseKnowledgeRouteState(location);
assert.equal(parsed.mode, 'graph');
assert.equal(parsed.node, 'compute');
assert.equal(parsed.step, 2);
const serialized = serializeKnowledgeRouteState(location, { mode: 'tree', node: 'ai-era', lesson: 'A1', step: 0 });
assert.equal(serialized, '/?mode=tree&node=ai-era&step=0&lesson=A1#principles');
const store = new Map();
const storage = { getItem: (key) => store.get(key) || null, setItem: (key, value) => store.set(key, value) };
const learning = createLearningState({ storage, now: () => '2026-08-11T00:00:00.000Z' });
learning.markViewed('principles:A1');
learning.toggleBookmark('principles:A1');
learning.setNote('principles:A1', '재방문 확인');
learning.recordRetrieval('principles:A1', { correct: true });
const snapshot = learning.snapshot();
assert.equal(snapshot.progress['principles:A1'].viewed, true);
assert.deepEqual(snapshot.bookmarks, ['principles:A1']);
assert.equal(snapshot.notes['principles:A1'].value, '재방문 확인');
assert.equal(snapshot.retrieval['principles:A1'].correct, true);
const reloaded = createLearningState({ storage, now: () => '2026-08-11T00:00:00.000Z' }).snapshot();
assert.equal(reloaded.progress['principles:A1'].viewed, true);
console.log(JSON.stringify({ status: 'PASS', serialized, persisted: Boolean(reloaded.notes['principles:A1']) }, null, 2));
