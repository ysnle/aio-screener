// v59.70 (I8, actions-reliability ledger class B): CI used to fail on what the live data and the calendar said (news rows
// current, a staged theme, the 12 h data SLA, a 45-day document date). A refresh commit then stayed UNATTESTED, and on
// 11-04 the source push that fixed the data plane (432ac3eb) failed the same checks only because time had passed, so no
// release on top of it could be attested (owner 2026-11-04: "구조 변경도 넣어", approved in this session).
//
// Rule: every ci.yml contract shard runs with AIO_QA_ORIGIN=ci, source pushes included. There a gate declared
// `liveData: "content"` reports its failure (ADVISORY) and a gate that judges dates against the wall clock reports that
// judgement as a warning (the reconciliation 24 h window; knowledge-lint P1125 warns everywhere since v60.50). Producer pre-push runs, local runs and the watchdog set no origin, so the
// same checks still fail there; the watchdog twins (same script in watchdog-local) keep watching the live content.
// Source defects (control characters, YAML, code contracts) declare nothing and block everywhere.

// v60.50 (data-path split): every gate declares what its verdict depends on (`inputClass`), one of two:
//   data — the artifacts a producer writes (public-data/**; public-config.json and the architecture manifests are code);
//   code — code and pinned fixtures; a code test that only borrows a published file as realistic input is code too.
// A data run — a producer's pre-push gate (the data-commit profile, or --data-run) and the reduced-scope CI of a data-only
// commit — runs `data` gates only. The code under a data-only commit already passed full push CI (resolve-release-source.mjs
// rides the data on that code, direct or overlay), so a code assertion there can only repeat that verdict, or stop the live
// data for every reader on a calendar rule or a code fixture (a weekday fixture blocked every refresh for hours).
// A script that holds both kinds splits them into sections (scripts/lib/gate-sections.mjs): the runner sets DATA_RUN_ENV
// for a data run and runSections skips the `code` sections there. Such a gate is declared `data`.
export const GATE_INPUT_CLASSES = Object.freeze(['data', 'code']);
export const DATA_RUN_ENV = 'AIO_QA_DATA_RUN';

/** true when this gate runs in a data run (a producer pre-push gate or the CI of a data-only commit). */
export function runsInDataRun(gate) {
  return gate?.inputClass === 'data';
}

/** true inside a gate process the runner started for a data run. */
export function isDataRun(env = process.env) {
  return env[DATA_RUN_ENV] === '1';
}

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
