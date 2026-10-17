// Worked-number blocks for the 112 principles lessons (v57.98), merged from the per-chapter authoring files.
// Shape matches the analysis notes' example in src/domain/knowledge/learning-core.js — inputs → steps → result —
// plus `limit`, the condition under which the calculation stops holding. Every number is an illustrative
// assumption (the lesson's folded basis says so); none is presented as a current market fact.
// Reading standard: result + limit read as one 3–5 line block under the calculation (130–230 chars).
import { WORKED_A_H } from './principles-worked-a-h.mjs';
import { WORKED_I_O } from './principles-worked-i-o.mjs';

export const PRINCIPLE_WORKED = { ...WORKED_A_H, ...WORKED_I_O };

export const WORKED_LIMITS = { inputs: 4, input: 100, steps: 4, step: 110, part: { min: 50, max: 160 }, reading: { min: 130, max: 230 } };

export function workedProblems(id, worked) {
  const problems = [];
  if (!worked) return [`${id}: no worked-number block`];
  const { inputs, steps, result, limit } = worked;
  if (!Array.isArray(inputs) || !inputs.length || inputs.length > WORKED_LIMITS.inputs) problems.push(`${id}: needs 1–${WORKED_LIMITS.inputs} inputs`);
  if (!Array.isArray(steps) || !steps.length || steps.length > WORKED_LIMITS.steps) problems.push(`${id}: needs 1–${WORKED_LIMITS.steps} steps`);
  (inputs || []).forEach((text, index) => { if (String(text).length > WORKED_LIMITS.input) problems.push(`${id}: input ${index} is ${String(text).length} chars`); });
  (steps || []).forEach((text, index) => { if (String(text).length > WORKED_LIMITS.step) problems.push(`${id}: step ${index} is ${String(text).length} chars`); });
  for (const [key, text] of [['result', result], ['limit', limit]]) {
    const length = String(text || '').length;
    if (length < WORKED_LIMITS.part.min || length > WORKED_LIMITS.part.max) problems.push(`${id}: ${key} is ${length} chars`);
  }
  const reading = String(result || '').length + String(limit || '').length;
  if (reading < WORKED_LIMITS.reading.min || reading > WORKED_LIMITS.reading.max) problems.push(`${id}: result + limit is ${reading} chars`);
  const text = [...(inputs || []), ...(steps || []), result, limit].join(' ');
  if (/[?？]/.test(text)) problems.push(`${id}: question inside the worked block`);
  if (!/\d/.test((steps || []).join(' '))) problems.push(`${id}: steps carry no arithmetic`);
  return problems;
}
