// v59.70 (I8, actions-reliability ledger class B): CI used to fail on what the live data and the calendar said (news rows
// current, a staged theme, the 12 h data SLA, a 45-day document date). A refresh commit then stayed UNATTESTED, and on
// 11-04 the source push that fixed the data plane (432ac3eb) failed the same checks only because time had passed, so no
// release on top of it could be attested (owner 2026-11-04: "구조 변경도 넣어", approved in this session).
//
// Rule: every ci.yml contract shard runs with AIO_QA_ORIGIN=ci, source pushes included. There a gate declared
// `liveData: "content"` reports its failure (ADVISORY) and a gate that judges dates against the wall clock reports that
// judgement as a warning (knowledge-lint P1125). Producer pre-push runs, local runs and the watchdog set no origin, so the
// same checks still fail there; the watchdog twins (same script in watchdog-local) keep watching the live content.
// Source defects (control characters, YAML, code contracts) declare nothing and block everywhere.

export const LIVE_DATA_KINDS = Object.freeze(['content']);
export const CI_ORIGIN = 'ci';

/** The validation origin of this run: 'ci' for a ci.yml contract shard, else 'source' (local, producer, watchdog). */
export function qaOrigin(env = process.env) {
  return env.AIO_QA_ORIGIN === CI_ORIGIN ? CI_ORIGIN : 'source';
}

// v59.78 (automation audit 2026-11-08): the data freshness watchdog is red only for what a reader sees — stale or
// missing live data, a live site or Worker that diverged from the repository. Repository upkeep that it also runs
// (context catalog/document age, the browser fixture's pinned data shape) declares `watchdogRole: "maintenance"`: in the
// watchdog profile its failure is reported (ADVISORY) and still blocks CI and every local run. On 11/08 00:46-07:15Z every
// watchdog run was red for a producer adding a field (fixture pin drift) and then a 17-byte catalog mismatch, so the
// alert said "13 consecutive failures" while the data itself was current.
export const WATCHDOG_PROFILE = 'watchdog';

/** true when a failure of this gate fails the run (false = reported as ADVISORY). */
export function failureBlocks(gate, origin, profile = null) {
  if (profile === WATCHDOG_PROFILE && gate?.watchdogRole === 'maintenance') return false;
  return !(origin === CI_ORIGIN && gate?.liveData === 'content');
}

/** true when a wall-clock date judgement (document age) fails the run here; in a CI contract shard it is a warning. */
export function clockJudgementBlocks(env = process.env) {
  return qaOrigin(env) !== CI_ORIGIN;
}
