import { readFileSync } from 'node:fs';

const artifact = JSON.parse(readFileSync(new URL('../architecture/human-validation.json', import.meta.url), 'utf8'));
const fail = (message) => { throw new Error(`[human-validation] ${message}`); };
const study = artifact.minimumStudy || {};
const acceptance = artifact.acceptance || {};
const sessions = artifact.sessions || [];
const requiredDimensions = ['screen-reader-reading-order', 'keyboard-only', 'computed-contrast', '200-percent-zoom-reflow', 'dialog-focus-trap-and-return'];
if (artifact.schemaVersion !== 'human-validation.v1' || study.participantsPerPersona < 5 || study.personas?.length !== 3 || study.tasks?.length < 6 || requiredDimensions.some((dimension) => !study.manualAccessibilityDimensions?.includes(dimension))) fail('study topology is incomplete');
if (acceptance.taskCompletionRateMin < 0.9 || acceptance.criticalMisunderstandingRateMax > 0.05 || acceptance.accessibilityCriticalFailuresMax !== 0) fail('acceptance thresholds are weaker than the product boundary');
for (const session of sessions) {
  for (const field of acceptance.requiredFieldsPerSession || []) if (session[field] == null || session[field] === '') fail(`session ${session.evidenceId || 'unknown'} missing ${field}`);
  if (!study.personas.includes(session.persona) || !study.platforms.includes(session.platform) || !study.tasks.includes(session.taskId)) fail(`session ${session.evidenceId} is outside the declared study topology`);
  if (Number.isNaN(Date.parse(session.observedAt)) || Number.isNaN(Date.parse(session.signedAt))) fail(`session ${session.evidenceId} has invalid timestamps`);
}
const participantsByPersona = Object.fromEntries(study.personas.map((persona) => [persona, new Set(sessions.filter((session) => session.persona === persona).map((session) => session.participantAlias)).size]));
const completeCoverage = study.personas.every((persona) => participantsByPersona[persona] >= study.participantsPerPersona)
  && study.tasks.every((task) => sessions.some((session) => session.taskId === task))
  && study.assistiveTechnology.every((technology) => sessions.some((session) => session.assistiveTechnology === technology));
const taskCompletionRate = sessions.length ? sessions.filter((session) => session.completed === true).length / sessions.length : null;
const misunderstandingRate = sessions.length ? sessions.filter((session) => session.criticalMisunderstanding === true).length / sessions.length : null;
const qualified = completeCoverage && taskCompletionRate >= acceptance.taskCompletionRateMin && misunderstandingRate <= acceptance.criticalMisunderstandingRateMax && artifact.aggregate?.accessibilityCriticalFailures === 0;
if ((artifact.status === 'USER_VALIDATED' || artifact.certification === 'PASS') && !qualified) fail('artifact promoted human validation without complete qualified evidence');
if (!sessions.length && (artifact.status !== 'NOT_EXECUTED' || artifact.certification !== 'OPERATOR_REQUIRED')) fail('empty study must remain operator-required');
console.log(JSON.stringify({ ok: true, contract: artifact.schemaVersion, sessions: sessions.length, participantsByPersona, qualified, certification: artifact.certification }));
