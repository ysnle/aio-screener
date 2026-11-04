// v59.70 (I8, actions-reliability ledger class B): a refresh commit changes only generated data on top of a source commit
// that already passed the full push CI (ci.yml attest guard); refresh-data also ran the data group fail-closed before
// its push. CI on that commit used to fail on what the live data said (news rows current, a staged theme, the 12 h SLA), and
// every later data commit stayed UNATTESTED until the content changed. A gate declared `liveData: "content"` asserts live
// content: on a refresh origin its failure is reported (ADVISORY) and its watchdog twin (same script in watchdog-local)
// keeps watching it; on a source push, in a producer's own pre-push run and in the watchdog it still fails.

export const LIVE_DATA_KINDS = Object.freeze(['content']);
export const REFRESH_ORIGIN = 'refresh';

/** The validation origin of this run: 'refresh' for a refresh-origin CI shard, else 'source'. */
export function qaOrigin(env = process.env) {
  return env.AIO_QA_ORIGIN === REFRESH_ORIGIN ? REFRESH_ORIGIN : 'source';
}

/** true when a failure of this gate fails the run (false = reported as ADVISORY). */
export function failureBlocks(gate, origin) {
  return !(origin === REFRESH_ORIGIN && gate?.liveData === 'content');
}
