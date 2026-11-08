// v59.85 (data-automation redesign): the one table of what each producing workflow commits to main, and how.
//
// Before this, five hand-written bash commit/push loops (refresh-data, refresh-screener core and extended shard,
// event-briefs) each kept their own staged-path list, size check, rebase-and-retry loop and post-rebase validation,
// and the gates checked them by grepping the workflow text for `stage_if_exists public-data/<file>`. The loops had
// drifted: the extended shard had no collision retry (a rebase conflict ended the run red), event-briefs did not
// re-validate after a rebase, and event-briefs unstaged a timestamp-only file but left it modified in the worktree, so
// the retry's `git rebase` refused to run ("cannot rebase: You have unstaged changes", run 42480198913) and that
// cycle's briefs were lost. scripts/publish-data-commit.mjs now runs every set below through one tested path, and the
// gates read this table instead of the workflow text.
//
// Fields (all paths are repository-relative):
//   workflow      the workflow file that publishes the set (the freshness registry names the same file)
//   message       commit message prefix; the publisher appends the UTC minute
//   required      paths that must exist; `git add` fails the run when one is missing
//   optional      paths staged only when present (a lane that did not run leaves its file alone)
//   timestampOnly { '<path>': [keys] } — a file whose parsed JSON equals HEAD after dropping these top-level keys is
//                 put back to HEAD (index and worktree), so a re-check that moved only the clock makes no commit
//   afterStage    commands run once the set is staged (a failure stops the run before any commit)
//   beforeCommit  commands run when something is staged, just before the commit (stores published ahead of main)
//   verifyCommit  commands that must pass on the commit and again after every rebase
//   onRebaseFail  'collision' (dispatch one re-run of `collision.workflow` from the new main and end green) or 'fail'
//   collision     { workflow, inputs } for the re-run dispatch; the re-run carries retry=collision and a second
//                 collision fails loudly instead of looping
//   ciOrigin      the `origin` input of the exact-SHA CI dispatch (ci.yml release_sha) after a push
//
// The publisher itself always refuses a staged .json that does not parse and any staged file over 50 MB.
// `$CANDIDATE` in a command is replaced by the workflow's validated candidate file ($RUNNER_TEMP/aio-<id>-candidate.json).

const CANDIDATE_COMMIT = 'node scripts/verify-refresh-candidate.mjs --expect-commit "$CANDIDATE"';

export const DATA_PUBLISH_SETS = Object.freeze({
  'refresh-data': Object.freeze({
    workflow: 'refresh-data.yml',
    message: 'data: refresh market and news data',
    candidateFile: 'aio-refresh-data-candidate.json',
    required: [
      'public-data/data.json',
      'public-data/history.json',
      'architecture/asset-manifest.json',
      'architecture/release-manifest.json',
      'architecture/public-readiness.json',
    ],
    optional: [
      'public-data/rotation-detail.json', // v59.70 (R11): rotationHistory split from data.json; same commit or live trails vanish
      'public-data/macro-history.json', // P1426
      'public-data/macro-calendar.json', // P1654
      'public-data/stress-outcomes.json', // P1661
      'public-data/today-verdict.json', // v58.80 F01
      'public-data/scenario-outcomes.json', // P1743
      'public-data/scenario-state.json', // P1743
      'public-data/market-day.json', // v59.63
      'public-data/market-temperature.json', // v57.54
      'public-data/official-references.json', // P1734
      'public-data/market-snapshot.json',
      'public-data/market-snapshot-status.json',
      'public-data/operations-status.json',
      'public-data/operations-slo-window.json', // v59.27
      'public-data/freshness/refresh-data.json', // v59.70
      'public-config.json',
      'public-data/reconciliation-status.json',
      'public-data/screener.json',
      'public-data/telegram-digest.json',
      'public-data/telegram-observed.json', // P1683
      'public-data/atlas/index.json',
      'public-data/backtest-history.json',
      'public-data/score-backtest-history.json',
      'public-data/structural-data-research.json',
      'public-data/masters/filing-discovery.json',
      'public-data/masters/filings.json',
      'public-data/masters/manager-catalog.json',
      'public-data/masters/index.json',
      'public-data/masters/holdings.json',
      'public-data/masters/holdings-summary.json',
      'public-data/masters/history-index.json',
      'public-data/masters/history-holdings.json',
      'public-data/masters/issuer-aggregates.json',
      'public-data/masters/ticker-index-reference.json',
      'public-data/masters/cusip-ticker-map.json',
      'public-data/masters/managers-store.json', // v59.82: rows live on the masters-store branch
      'public-data/objects/masters',
      'public-data/masters/history/managers',
    ],
    timestampOnly: {},
    afterStage: [
      'node scripts/ci-masters-contract-check.mjs --staged',
      'node scripts/verify-refresh-candidate.mjs --expect-staged "$CANDIDATE"',
    ],
    // v59.82: main's manifest must never name a tree the masters-store branch never held.
    beforeCommit: ['git diff --staged --quiet -- public-data/masters/managers-store.json || node scripts/masters-managers-store.mjs publish'],
    verifyCommit: [CANDIDATE_COMMIT],
    onRebaseFail: 'collision',
    collision: { workflow: 'refresh-data.yml', inputs: { trigger: 'scheduler' } },
    ciOrigin: 'refresh-data',
  }),
  'refresh-screener': Object.freeze({
    workflow: 'refresh-screener.yml',
    message: 'data: refresh screener and SEC fundamentals',
    candidateFile: 'aio-refresh-screener-candidate.json',
    // P1757: public-data/sec-fundamentals.json is gitignored and published to the data-store branch (beforeCommit).
    required: [
      'public-data/screener.json',
      'public-data/sec-fundamentals-summary.json',
      'public-data/sec-fundamentals-summary.manifest.json',
      'public-data/screener-validation-gate.json',
      'public-data/reconciliation-status.json',
      'public-data/operations-status.json',
      'public-data/history.json',
      'public-config.json',
      'architecture/public-readiness.json',
    ],
    optional: [
      'public-data/earnings-calendar.json',
      'public-data/freshness/refresh-screener.json', // v59.70
      'public-data/bigtech-cashflow.json', // v59.56
      'public-data/treasury-auctions.json', // v59.57
      'public-data/sp500-weights.json',
      'public-data/us-listings.json', // v57.81
      'public-data/consensus-estimates.json', // v57.54
      'public-data/kr-fundamentals.json', // P1654 (blocked on DART_API_KEY)
      'public-data/kr-investor-flows.json', // v59.70
      'public-data/tw-monthly-revenue.json', // v59.56
      'public-data/backtest-history.json',
      'public-data/breadth-contributors.json', // P1416
      'public-data/theme-stage-history.json', // v58.79
      'public-data/sec-fiscal-history.json', // P1436
      'public-data/screener-candidate-archive.json', // P1465
    ],
    timestampOnly: {},
    afterStage: ['node scripts/verify-refresh-candidate.mjs --expect-staged "$CANDIDATE"'],
    // P1757: the SEC ledger store is published before main, so main's manifest never names a digest the store lacks.
    beforeCommit: ['node scripts/sec-fundamentals-store.mjs publish'],
    verifyCommit: [CANDIDATE_COMMIT],
    onRebaseFail: 'collision',
    collision: { workflow: 'refresh-screener.yml', inputs: {} },
    ciOrigin: 'refresh-screener',
  }),
  'refresh-screener-extended': Object.freeze({
    workflow: 'refresh-screener.yml',
    message: 'data: refresh extended screener universe',
    candidateFile: null,
    required: [],
    optional: ['public-data/screener-extended.json', 'public-data/screener-extended-universe.json', 'public-data/sec-fundamentals-extended.json'],
    timestampOnly: {},
    afterStage: [],
    beforeCommit: [],
    // v58.77 (DATA-05): the shard was validated against the core screener.json it was built on; a core push in between
    // changes that membership, so the rebased pair is validated again before it is pushed.
    verifyCommit: ['node scripts/validate-screener-extended.mjs public-data/screener-extended.json', 'node scripts/ci-screener-extended-contract-check.mjs'],
    // The shard is a once-per-session job; a conflict means the core moved under it, and the next due cycle rebuilds it.
    onRebaseFail: 'fail',
    collision: null,
    ciOrigin: 'refresh-screener',
  }),
  'event-briefs': Object.freeze({
    workflow: 'event-briefs.yml',
    message: 'data: event briefs',
    candidateFile: null,
    required: [],
    optional: ['public-data/event-briefs.json', 'public-data/kr-index-weights.json'],
    // v59.62: a run that only re-checked sources changes generatedAt alone. v59.85: kr-index-weights too — 12 of the 15
    // event-brief commits on Sunday 11/08 rewrote only its generatedAt, each one a CI run and a Pages deploy.
    timestampOnly: { 'public-data/event-briefs.json': ['generatedAt'], 'public-data/kr-index-weights.json': ['generatedAt'] },
    afterStage: [],
    beforeCommit: [],
    // Only this workflow writes these files, so a rebase cannot change them; the publisher's own parse check suffices.
    verifyCommit: [],
    onRebaseFail: 'collision',
    collision: { workflow: 'event-briefs.yml', inputs: {} },
    ciOrigin: 'event-briefs',
  }),
});

/** Every path a set may stage (required + optional). */
export const publishSetPaths = (id) => {
  const set = DATA_PUBLISH_SETS[id];
  return set ? [...set.required, ...set.optional] : [];
};

/** The publish set ids a workflow file runs. */
export const publishSetsForWorkflow = (workflow) => Object.entries(DATA_PUBLISH_SETS)
  .filter(([, set]) => set.workflow === workflow).map(([id]) => id);

/** True when `workflow` commits `path` through one of its publish sets. */
export const workflowPublishes = (workflow, path) => publishSetsForWorkflow(workflow).some((id) => publishSetPaths(id).includes(path));
