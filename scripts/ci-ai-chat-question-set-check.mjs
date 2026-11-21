#!/usr/bin/env node
// scripts/ci-ai-chat-question-set-check.mjs — v60.41 (owner 2026-11-21: chat quality and coverage are measured by real
// questions, not by pinned source text).
//
// Validates architecture/ai-chat-question-set.json, the question set scripts/ai-chat-eval.mjs asks the real chat. It never
// calls the model. It fails when:
//   - the schema is wrong: unknown check keys, expect values, resolvers or screener conditions, a screen that is not a route,
//     a question longer than the chat input accepts, a missing manual note, duplicate ids, fewer than 45 or more than 60
//     questions;
//   - a task (the five user tasks) or a listed situation has fewer than two questions;
//   - a figure resolver does not resolve against the committed public-data, or a rowsFromScreen spec cannot be evaluated
//     (unknown theme, size bucket, or a condition no committed row carries the data for).
// A screen that matches no rows today is not a failure (the answer is then "none"); the runner scores that case.
// Self-test: a duplicate id, an unknown resolver and a situation left with one question each fail.
//
//   node scripts/ci-ai-chat-question-set-check.mjs
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MIN_PER_TAG, REQUIRED_SITUATIONS, SET_PATH, TASK_IDS, coverage, loadEvalData, resolveQuestions, validateSet } from './lib/ai-chat-eval.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');
let failed = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
};

const set = JSON.parse(read(SET_PATH));
const routes = Object.keys(JSON.parse(read('architecture/route-owners.json')).routes || {});
const coverageGaps = (candidate) => {
  const count = coverage(candidate);
  return [...TASK_IDS.map((id) => `task:${id}`), ...REQUIRED_SITUATIONS.map((id) => `situation:${id}`)].filter((tag) => (count[tag] || 0) < MIN_PER_TAG);
};

const errors = validateSet(set, { routes });
check(`v60.41 question set schema (${set.questions?.length || 0} questions)`, errors.length === 0, errors.slice(0, 8).join('; '));
const gaps = coverageGaps(set);
check(`v60.41 every task and situation has >= ${MIN_PER_TAG} questions`, gaps.length === 0, gaps.join(', '));

const data = await loadEvalData(async (file) => read(file));
const { errors: resolveErrors } = resolveQuestions(set.questions || [], data);
const figureCount = (set.questions || []).reduce((n, q) => n + (q.checks?.figures?.length || 0), 0);
const screenCount = (set.questions || []).filter((q) => q.checks?.rowsFromScreen).length;
check(`v60.41 every figure and screen resolves against committed public-data (${figureCount} figures, ${screenCount} screens)`, resolveErrors.length === 0, resolveErrors.slice(0, 8).join('; '));

// Self-test: the checks above fail on a broken set.
const clone = () => JSON.parse(JSON.stringify(set));
const dup = clone();
dup.questions[1].id = dup.questions[0].id;
check('v60.41 self-test: a duplicate id fails', validateSet(dup, { routes }).some((message) => /duplicate id/.test(message)));
const badResolver = clone();
badResolver.questions.find((q) => q.checks?.figures?.length).checks.figures[0].resolver = 'history.closing:spx';
check('v60.41 self-test: an unknown resolver fails', validateSet(badResolver, { routes }).some((message) => /unknown resolver/.test(message)));
const thin = clone();
const victim = REQUIRED_SITUATIONS[0];
let kept = 0;
thin.questions.forEach((q) => { if ((q.situations || []).includes(victim)) { kept += 1; if (kept > 1) q.situations = q.situations.filter((id) => id !== victim); } });
check('v60.41 self-test: a situation with one question fails coverage', coverageGaps(thin).includes(`situation:${victim}`));
const missingRow = clone();
missingRow.questions = [{ id: 'x', checks: { figures: [{ resolver: 'screener.field:NOTATICKER.pe' }] } }];
check('v60.41 self-test: a figure that does not resolve fails', resolveQuestions(missingRow.questions, data).errors.length === 1);

if (failed) {
  console.error(`ai-chat question set: ${failed} check(s) failed`);
  process.exit(1);
}
console.log('ai-chat question set: OK');
