import { createLearningState } from '../domain/knowledge/learning-state.js';

// Browser storage is an application boundary; the domain state remains storage-agnostic.
export function createAppKnowledgeLearningState(root = globalThis) {
  let storage = null;
  try { storage = root?.localStorage || null; } catch (_) { /* storage denial must not block lessons */ }
  return createLearningState({ storage });
}
