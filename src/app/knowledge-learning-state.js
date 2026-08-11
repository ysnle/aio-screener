import { createLearningState } from '../domain/knowledge/learning-state.js';

// Browser storage is an application boundary; the domain state remains storage-agnostic.
export function createAppKnowledgeLearningState(root = globalThis) {
  return createLearningState({ storage: root?.localStorage || null });
}
