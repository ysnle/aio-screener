// Reading the definition stamps of the two weekly long-history artifacts (outcome-stamps.js, generated from the defining
// code by scripts/build-outcome-stamps.mjs) for their producers' weekly skip and their readers. Browser-safe: constants only.
//   scenario-outcomes.json  `fingerprints` { schema, branches, themes, corrections } and a `fingerprint` on every theme row
//   stress-outcomes.json    `fingerprint`
import { OUTCOME_STAMPS } from './outcome-stamps.js';
import { isIsoDay } from '../shared/session-date.js';

export const SCENARIO_OUTCOMES_SCHEMA = 'scenario-outcomes.v1';
export const STRESS_OUTCOMES_SCHEMA = 'stress-outcomes.v1';

/** The stamps a current scenario-outcomes.json carries (`fingerprints`). */
export const scenarioOutcomeFingerprints = () => ({ schema: SCENARIO_OUTCOMES_SCHEMA, branches: OUTCOME_STAMPS.branches, themes: OUTCOME_STAMPS.themeStage, corrections: OUTCOME_STAMPS.corrections });

/**
 * Whether a published scenario-outcomes.json was computed on today's definitions: the file stamps match and every theme
 * row carries the live theme stamp and the live US benchmark (a row that fell back to ^GSPC because RSP failed to load
 * is not current, so the next run retries).
 */
export function scenarioOutcomesCurrent(payload, benchmark) {
  const live = scenarioOutcomeFingerprints();
  const stamps = payload?.fingerprints || {};
  return Object.keys(live).every((key) => stamps[key] === live[key])
    && Object.values(payload?.themes || {}).every((row) => row?.fingerprint === live.themes && row.benchmark === benchmark);
}

export const stressOutcomesFingerprint = () => OUTCOME_STAMPS.stress;
export const stressOutcomesCurrent = (payload) => !!payload && payload.fingerprint === OUTCOME_STAMPS.stress;

/**
 * What a reader may use of a published scenario-outcomes.json: each part only when it was computed under today's
 * definition (branches and corrections by the file stamps, theme rows by their own stamp); a part from another
 * definition is null, so the reader falls back as it does when the part is missing. Every consumer reads through this.
 */
export function currentScenarioOutcomes(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const live = scenarioOutcomeFingerprints();
  const stamps = payload.fingerprints || {};
  const same = (key) => stamps.schema === live.schema && stamps[key] === live[key];
  const themes = Object.fromEntries(Object.entries(payload.themes || {}).filter(([, row]) => row?.fingerprint === live.themes));
  return { ...payload, branches: same('branches') ? payload.branches || null : null, corrections: same('corrections') ? payload.corrections || null : null, themes };
}
/** A published stress-outcomes.json when it was computed under today's definition, else null. */
export const currentStressOutcomes = (payload) => (stressOutcomesCurrent(payload) ? payload : null);

/**
 * The one status line for a weekly record a reader cannot use (AGENTS: a designed source that failed
 * stays visible with its last date). `restamped`: the file is there but was computed on another definition; otherwise
 * it is missing or failed (없음). The last date is the file's generatedAt.
 */
export function outcomeRecordNote(payload, { restamped = false } = {}) {
  const at = String(payload?.generatedAt || '').slice(0, 10);
  const last = isIsoDay(at) ? ` (마지막 계산 ${Number(at.slice(5, 7))}/${Number(at.slice(8, 10))})` : '';
  return restamped ? `정의가 바뀌어 다음 갱신 때 다시 계산합니다${last}.` : `없음${last}.`;
}
