# AIO Screener — Git History & Repository Health Audit

Scope: `C:\projects\AIO`, read-only analysis of `main` (2,083 commits, 2026-04-02 → 2026-09-27,
v38.9 → v56.55). All figures below were produced with read-only git plumbing
(`git log`, `git ls-tree`, `git cat-file`, `git rev-list --objects`, `git count-objects`);
no destructive commands were run and nothing in the working tree or `.git` was modified.

---

## Part A — Key metrics tables

### A1. Commit authorship

| Author | Commits | % of total | Role |
|---|---:|---:|---|
| aio-data-bot | 1,351–1,356* | ~65% | GitHub Actions data-refresh cron (market/news/SEC/13F) |
| aio-screener bot | 501–519* | ~24% | **All AI-agent code/feature/fix/docs commits since 2026-05-31** |
| ysnle (human owner) | 227 | ~11% | Founder — **last commit 2026-06-30** (`daa9eaef`) |
| Codex | 4 | <1% | One agent session that used its own identity |
| T3 Code | 2 | <1% | ditto |
| dependabot[bot] | 2 | <1% | Automated dependency PRs |

*Two different `shortlog`/`log --author` passes gave slightly different counts (1356/1351,
519/501) because of git's fuzzy author-string matching; treat as ±1% precision, not exact.

**Finding: since 2026-07-01, 100% of the ~1,511 commits in July–September are machine-authored**
(aio-data-bot or aio-screener bot). No commit in the last ~3 months carries the human
owner's git identity, and the single shared "aio-screener bot" identity is used
interchangeably by whatever AI tool (Claude/Codex/Fable) was driving a session that day —
git metadata alone cannot tell you which agent, which model, or which human-approved session
produced any given code commit in that window. The only way to recover that is to read the
Korean-language commit body text itself.

### A2. Commit cadence by month

| Month | Commits | Notes |
|---|---:|---|
| 2026-04 | 110 | human-only, monolith era |
| 2026-05 | 122 | human-only (mostly), bots begin appearing late May |
| 2026-06 | 340 | bots dominate from ~2026-06-10 (aio-data-bot) / human stops 2026-06-30 |
| 2026-07 | 662 | peak month; src/ ESM strangler + architecture/ born 2026-07-18/19/20 |
| 2026-08 | 523 | 13F/Masters/Atlas feature buildout |
| 2026-09 (partial, 27 days) | 326 | governance/QA machinery (R-rules, P-postmortems) dominates |

Daily peaks reach 33–47 commits/day (e.g. 2026-08-22: 47, 2026-07-27: 33) — almost
entirely bot/agent-driven; this is a commit rate no human reviewer can meaningfully
gate in real time.

### A3. Version cadence

| Metric | Value |
|---|---|
| Version range | v38.9 (2026-04-02) → v56.55 (2026-09-27) |
| Distinct `vX.Y` strings referenced in commit subjects | 343 |
| Elapsed days | ~178 |
| Major version increments (v38→v56) | 18 over 178 days (~1 every 10 days) |
| Average distinct version string per day | ~1.9 |
| Versioning scheme (stated, R2 in CLAUDE.md) | `v{major}.{patch}`, "monotonic increase", 2-digit patch allowed |

Version bumps are **not release boundaries** — commits like
`cd4d8ca7 feat: handoff remainder batches ... (P1205~P1265, v56.15→v56.52)` bump the
version 37 times inside a single commit's *stated range*, and `version.json`/`CLAUDE.md`/
`sw.js`/badges are kept in sync by a script (`scripts/bump-version.mjs`, per R1) rather than
by one version = one deploy. There is no tag per version (only one tag exists in the whole
repo: `pre-rebase-backup-b707055e`), so a "version" is a documentation label inside commit
messages/JSON files, not a durably addressable git ref.

### A4. Repository size (`.git`)

| Metric | Value |
|---|---|
| `.git` total size (via `du -sh`) | 1.7 GB |
| Loose objects (`git count-objects -v`) | 21,385 objects, ~1,003 MB |
| Packed objects | 21,668 objects in 42 packs, ~578 MB |
| Garbage/tmp objects (`tmp_obj_*`) | 17 objects, ~72 KB — **confirms user's report of stray tmp objects from an interrupted `git gc`/push** |
| Working tree size (`du -sh .` excl. `.git`) | 822 MB |
| `public-data/` alone (working tree) | 596 MB |
| Sum of all blob object sizes across all history revisions (uncompressed, delta-expanded) | **18.77 GB** (compressed by git's delta+zlib into the ~578 MB packs — a ~32:1 ratio, which is *why* it hasn't already broken CI/clone times, but is fragile: it depends on git repacking well, and 42 separate packs plus 1 GB of ungathered loose objects means that compression is not fully realized on disk right now) |
| Branches | `main`, `codex/v54.37-ai-reliability` (stale, last commit 2026-08-21), 2 dependabot branches (2026-09-20) |
| Tags | 1 (`pre-rebase-backup-b707055e`, 2026-09-19) |

### A5. Where the history bytes are (top contributors, sum of all blob revisions in history)

| Path | Total bytes across all revisions | # revisions | Current size |
|---|---:|---:|---:|
| `public-data/masters/` (13F manager shards, all files) | 10.33 GB | 1,732 blobs | ~596 MB (managers alone) |
| `public-data/sec-fundamentals.json` | 3.95 GB | 259 | 32.0 MB (grew from 423 B on 2026-07-15) |
| `public-data/masters/managers/blackrock-inc.json` | 2.01 GB | 33 | 62.4 MB |
| `public-data/masters/managers/jpmorgan-chase.json` | 1.52 GB | 33 | 47.0 MB |
| `public-data/telegram-digest.json` | 1.28 GB | 1,056 | — |
| `public-data/history.json` | 1.13 GB | 1,251 | 1.78 MB |
| `public-data/masters/managers/citadel-advisors.json` | 1.06 GB | 33 | 33.0 MB |
| `index.html` | 1.04 GB | 475 | 996 KB (13,357 lines) |
| `js/aio-core.js` | 475 MB | 392 | 1.7 MB (28,169 lines) |
| `CHANGELOG.md` | 365 MB | 452 | 2,648 lines |

**`public-data/masters/managers/*.json` (13F institutional-holdings shards) is, by a wide
margin, the single largest driver of repository growth**: 13 manager-shard files each
committed in full ~33 times over roughly one month (first появление ~2026-08-22 for
BlackRock) already account for >10 GB of historical blob data, more than half of all
history bytes in the repository.

### A6. Working-tree size trend (checked out at monthly commit checkpoints — proxy for repo growth)

| Date | Commit | `public-data/` bytes | Total tree bytes |
|---|---|---:|---:|
| 2026-04-15 | 62cb8b4b | 0 | 3.56 MB |
| 2026-05-15 | d965a034 | 0 | 7.84 MB |
| 2026-06-15 | 2e82bc91 | 172 KB | 8.37 MB |
| 2026-07-15 | 583f4662 | 2.23 MB | 20.8 MB |
| 2026-08-15 | e20e830f | 52.4 MB | 107 MB |
| 2026-09-15 | 95313e77 | **493.9 MB** | **554.7 MB** |
| 2026-09-26 | cd4d8ca7 | 609.4 MB | 674.9 MB |

Growth rate accelerated sharply after the 13F/Masters feature landed in mid/late August:
+447 MB in the Aug15→Sep15 window (~14.4 MB/day), +120 MB in the following 11 days
(~10.9 MB/day). **Projection at the current ~11–14 MB/day pace: +350–430 MB/month.**
At that rate the tracked working tree would exceed **1.5–2 GB within 3 months** and
**4–6+ GB within a year**, and — because every 13F refresh commits whole manager-shard
files rather than diffs of them — `.git` history size grows in lockstep (each full BlackRock
JSON commit adds ~60 MB of new blob content even though only a small fraction of the filing
data actually changed quarter to quarter).

### A7. File churn (commit count touching a file), excluding `public-data/`

| File | Commits touching it | Insertions | Deletions | % of all 2,083 commits |
|---|---:|---:|---:|---:|
| `index.html` | 470 | 148,332 | 134,969 | 22.6% |
| `CHANGELOG.md` | 450 | 83,052 | 80,153 | 21.6% |
| `version.json` | 423 | 874 | 873 | 20.3% |
| `_context/CLAUDE.md` | 398 | 1,246 | 1,192 | 19.1% |
| `js/aio-core.js` | 390 | 35,657 | 7,530 | 18.7% |
| `CLAUDE.md` (root) | 381 | 1,356 | 1,281 | 18.3% |
| `sw.js` | 349 | 1,759 | 1,441 | 16.8% |
| `_context/BUG-POSTMORTEM.md` | 291 | 16,773 | 11,578 | 14.0% |
| `js/aio-data.js` | 214 | 24,432 | 7,500 | 10.3% |
| `js/aio-chat.js` | 123 | 13,544 | 4,337 | 5.9% |

**`index.html` is touched by nearly a quarter of every commit ever made to this repo**, and
`js/aio-core.js` has net-grown by ~28,100 lines (35,657 added vs 7,530 removed) despite an
ESM "strangler" migration explicitly intended to shrink it. Four of the top five churn
files are governance/version bookkeeping (`CHANGELOG.md`, `version.json`, `_context/CLAUDE.md`,
root `CLAUDE.md`) rather than product code — i.e. a large fraction of all commit activity
is process overhead (keeping 7 files in sync per R1) rather than feature or bug work.

### A8. Legacy monolith vs native ESM migration progress (as of 2026-09-27)

| Layer | Files | Total lines |
|---|---:|---:|
| `js/*.js` (legacy compat modules, incl. former `index.html` content) | 10 | 82,737 |
| `src/**/*.js` (native ESM strangler layer, started 2026-07-18) | 193 | 34,298 |
| `index.html` (static shell) | 1 | 13,357 |

After ~10 weeks of an explicitly declared "strangler migration" (`architecture/README.md`:
"AR-00~09 strangler migration"), the legacy `js/` layer (82.7K lines) is still **2.4x larger**
than the new native `src/` layer (34.3K lines), and `js/aio-core.js` alone is still growing
(net +28K lines since inception per A7). This is consistent with a classic strangler-fig
anti-pattern: new code is added natively, but the legacy core is not being retired at a
comparable rate, so the team is paying to maintain both surfaces simultaneously.

### A9. Governance/QA ledger size

| Ledger | Size (latest ID) |
|---|---|
| `_context/RULES.md` | 178 rules (R1…R178, though CLAUDE.md still calls out only R1–R3, R27 as "absolute") |
| `_context/BUG-POSTMORTEM.md` | 1,283 postmortem entries (P1…P1283) |
| `_context/QA-CHECKLIST.md` | 200 unique open QA IDs (204 rows, 5 superseded) per `_context/CURRENT-STATE.md` |
| `_context/` directory | 74 tracked files, 3.94 MB |
| `architecture/` ADRs | 2 (`adr-0001-rebuild-foundations.md`, `adr-0002-vite-typescript-and-state-access.md`) despite 74 `_context/*HANDOFF*/*AUDIT*` documents |
| CI scripts (`scripts/ci-*.mjs`) | ~129 per `_context/CURRENT-STATE.md` |

### A10. Merge/rebase friction

| Metric | Value |
|---|---|
| Merge commits on `main` | 60 |
| Dedicated bot-conflict tooling | `scripts/resolve-data-manifest-merge.mjs` exists |
| "regenerate after rebase" fixups found | ≥4 explicit commits (`98fe885c`, `3bce0a7e`, `9631d1d8`, `d26bec65`) plus one `parallel-agent-p1266-wip-during-rebase` detached-work commit (`00a062ed`) |
| Backup tag from a rebase incident | `pre-rebase-backup-b707055e` (2026-09-19) — a manual safety tag taken before a rebase, still sitting in history a week later |
| Explicit reverts found by message grep | 1 (`5891dba7`, a partial UI revert) — reverts are otherwise absorbed silently into "fix" commits rather than tracked as such |

---

## Part B — Findings

Each finding: **Severity — Title.** Evidence, root cause, impact.

### B1. Critical — Binary/full-file 13F data committed to git instead of an artifact/object store

**Evidence:** `public-data/masters/managers/*.json` (13 institutional-manager shards)
account for >10.3 GB of historical blob content (A5) from just ~33 revisions per file
over ~5 weeks; `blackrock-inc.json` alone is 62 MB *today* and has been committed in full
15 times at ~61.5 MB each (A5 sample). `public-data/sec-fundamentals.json` grew from 423
bytes to 31 MB in 259 commits over 10 weeks (A6). None of these are diffed or chunked —
every refresh replaces the whole file.

**Root cause:** the data pipeline (`scripts/fetch-data.mjs`, EDGAR 13F collectors) treats
git as a database/CDN rather than as source-code version control, and `git diff`-based
delta compression on JSON that reorders/reformats between runs is far less effective than
it looks from raw byte counts.

**Impact:** clone/fetch time for any new contributor or CI runner grows every month
(future clones must download the *entire* 578 MB pack even though HEAD only needs ~600 MB
of live JSON); GitHub has soft/hard repo size limits (recommended <1 GB, hard warnings
~5 GB, and GitHub can restrict pushes past that); `git gc`/repack cost rises; and — per A6 —
the growth is accelerating (+11–14 MB/day), not stabilizing. This is the single biggest
structural risk in the repository today.

### B2. Critical — All AI-agent code commits for 3+ months are unattributed to any individual session/agent

**Evidence:** human owner `ysnle`'s last commit was 2026-06-30 (`daa9eaef`). Every one of
the ~1,511 commits from July 1 through September 27 is authored as either `aio-data-bot`
(data refresh cron) or the single shared identity `aio-screener bot` (all code/feature/fix/
docs work, first appearing 2026-05-31). The task prompt itself notes the actual authors
were "Claude/Codex/Fable" agents — but git metadata cannot distinguish which tool, which
model, or which reviewed session produced any given commit; that information exists only
as free text inside Korean commit bodies (if at all).

**Root cause:** the repo's automation wraps every agent's commits under one bot git
identity rather than per-agent/per-session identities or `Co-authored-by:` trailers.

**Impact:** no `git blame`/`git log --author` based accountability, bisection-by-agent, or
retrospective ("which tool introduced this regression") is possible without manually
reading commit-message prose across ~1,300 commits. Combined with B3 (batch commits), this
makes the history close to useless for root-causing a regression by anything other than
`git bisect` + manual testing.

### B3. High — Massive multi-version "batch" commits destroy reviewability and bisectability

**Evidence:** `cd4d8ca7` ("P1205~P1265, v56.15→v56.52") touches 41 files / 80 changed
paths, +2,477/−450 lines, and its message claims to cover **50 P-numbers and 37 version
increments in one commit**. `4e297fc7` similarly claims "P1205~P1259, v56.15→v56.49".
Other examples: `1c31b7ca`/`13cd2f2b` (duplicate messages, "P1116~P1125/R616~R618"),
`ff4e37c9` ("P1083~P1095/R606~R613"), `9a951b8c` ("13-version 전수 보강, P110~P125, 16건").
This pattern recurs dozens of times across the full history (A3/A10 grep found 20+ such
commits).

**Root cause:** the stated workflow explicitly forbids "자동 배포/커밋 금지" (no auto
deploy/commit) unless the user asks — so agents apparently do large amounts of local,
uncommitted work across many "P" (postmortem/patch) units and many version bumps, then
land it all in one shot when a commit is finally authorized. `version.json`/`CHANGELOG.md`
bookkeeping (A7) is updated incrementally in the *working directory* across that whole
span but only becomes a real commit boundary at the end.

**Impact:** `git bisect` across such a commit cannot isolate which of 50 "P" fixes caused
a regression; code review (if any occurs) cannot meaningfully review a +2,477-line diff
spanning 41 unrelated files as one unit; and the "version" numbers in between were never
independently deployed or tested as their own state, so `v56.15`…`v56.51` are not
reconstructable/checkoutable states — only `v56.52` (the commit) and `v56.55` (HEAD) exist
as real git objects.

### B4. High — `index.html` remains a 13,357-line/996 KB monolith and is still the most-churned file in the repo

**Evidence:** A7 — 470/2,083 commits (22.6%) touch `index.html`; A8 shows the legacy `js/`
layer (82.7K lines) is still 2.4x the new `src/` ESM layer (34.3K lines) after ~10 weeks of
declared migration; `js/aio-core.js` (28,169 lines, 1.7 MB) has *grown* net +28K lines
since inception rather than shrinking. `architecture/README.md`'s own text acknowledges the
risk explicitly: *"등록 비용을 피해 기존 파일에 접어넣었지만, 그대로 두면 index.html이
줄어드는 대신 aio-ui.js가 새 모놀리스가 됩니다"* ("to avoid registration cost we folded it
into an existing file, but left alone, instead of index.html shrinking, aio-ui.js becomes
the new monolith") — a self-diagnosed instance of the same anti-pattern recurring inside
the *replacement* code.

**Root cause:** migrating a route/feature to `src/` costs more (new file registration,
contract wiring, CI gate updates) than patching the existing monolith, so under time
pressure agents default to the path of least resistance.

**Impact:** the stated migration goal (native ESM, `fullNativeOwner` completion signal per
`architecture/README.md`) is not converging; two parallel implementations of overlapping
functionality must be kept consistent by hand, and the biggest, riskiest file in the
codebase remains the one edited most often.

### B5. High — Repo size and CI gate proliferation is outrunning documentation governance

**Evidence:** A9 — 178 numbered rules, 1,283 numbered postmortems, 200 open QA IDs, ~129 CI
scripts, but only 2 ADRs for a repo whose `architecture/` directory implies a formal
decision-record practice. `_context/CURRENT-STATE.md` explicitly instructs agents *not* to
read the full ledgers by default ("do not load the full ledgers by default") — i.e. the
project's own governance system now assumes no one (human or agent) reads the majority of
its own rules end-to-end; they are searched, not read.

**Root cause:** the "복리 루프" (compounding loop) process mandates writing a postmortem
entry for every bug and promoting repeated ones to a rule (R1–R3 in CLAUDE.md), with no
corresponding pruning/consolidation step; ledgers only grow.

**Impact:** the governance system has become large enough that its own maintainers
(CLAUDE.md, CURRENT-STATE.md) had to build search/index tooling and explicit "don't read
this whole file" guidance just to keep it usable — a strong signal that documentation
volume has outpaced its own utility, and every new agent session pays a real token/time
cost just discovering which subset of 74 `_context/` files and 178 rules is relevant.

### B6. Medium — 42 packs + ~1 GB of un-repacked loose objects + stray garbage tmp objects

**Evidence:** `git count-objects -v`: 21,385 loose objects (~1.0 GB), 21,668 packed objects
across **42 separate packs** (~578 MB), plus 17 `tmp_obj_*` garbage objects (~72 KB) under
`.git/objects/{01,15,26,47,bd,db}/`.

**Root cause:** frequent small `git gc --auto` triggers (from the very high commit rate —
up to 47 commits/day) create many small packs instead of periodic full repacks; the
`tmp_obj_*` files are leftovers from an interrupted pack/index write (possibly a killed
Actions runner or an interrupted local push).

**Impact:** not urgent on its own, but it means the on-disk `.git` (1.7 GB) is meaningfully
larger than an optimally repacked equivalent would be, and it's a low-cost, high-value
maintenance action (`git gc` / repack) that nobody appears to be running periodically. This
is a symptom, not a cause, of B1's growth problem.

### B7. Medium — Large amounts of investigative/audit artifacts (`_artifacts/`) are committed to `main`, including PNG screenshot dumps and a zip

**Evidence:** `git ls-files` shows dozens of `_artifacts/*` subdirectories (`live-human-ux-v5289`,
`live-human-ux-v5290/screens`, `live3-local-v5291(-final)`, `desktop-browser-audit`,
`redesign-current-v5288*`, etc.) with 27–47 files each, including PNG screenshots
(`_artifacts/live-human-ux-v5290/contact-mobile-b.png` = 1.35 MB, several >1 MB each) and
`_artifacts/AIO-Knowledge-System-Structural-Handoff-v53.99.zip`. `.gitignore` shows the
project is *aware* of this problem (it already ignores some viewport screenshots and audit
JSON dumps with comments explaining why), but the ignore rules are narrow/manually
maintained path-by-path (e.g. `_artifacts/viewport-matrix/*.png` is ignored but
`_artifacts/live-human-ux-v5290/*.png` is not).

**Root cause:** every new QA/audit pass creates a fresh dated `_artifacts/<name>-<date>/`
directory and someone (an agent) has to remember to add it to `.gitignore` after the fact;
there's no default-ignore-then-allowlist policy.

**Impact:** permanent history bloat from what is explicitly described in the repo's own
`.gitignore` comments as "local scratch / legacy artifacts — never meant to ship or be
tracked" — the same class of problem the `.gitignore` was created to solve (per its header
comment referencing `_context/BUG-POSTMORTEM.md` P572) is recurring in a new location
(`_artifacts/`) instead of being fixed structurally.

### B8. Medium — Stale branches and a lingering rebase-safety tag suggest ad hoc, not process-driven, branch hygiene

**Evidence:** `codex/v54.37-ai-reliability` — local and remote — last commit 2026-08-21,
over 5 weeks stale relative to `main` at audit time, and **verified via
`git log origin/main..origin/codex/v54.37-ai-reliability` to have zero unique commits** —
it is fully redundant with `main` and safe to delete right now. `pre-rebase-backup-b707055e`
tag from 2026-09-19, one week old at audit time and not obviously scheduled for removal.
2 dependabot PRs are open and unmerged for 7–10 days as of the audit date (`gh pr list`:
#8 `ci-toolchain` group, opened 2026-09-20; #7 `github-actions` group, opened 2026-09-17) —
routine dependency-update PRs sitting unreviewed for over a week, on a repo whose CI is
otherwise extremely high-frequency. A third PR, #1 (2026-06-20, "v50.76 전체 데이터
최신화"), is closed and was a `claude/dazzling-herschel-416fc5` branch — the only PR in
the repo's history that used an actual pull-request review flow instead of direct pushes
to `main`; everything else in this audit (2,083 commits) landed via direct commit/merge
to `main`, not PR review.

**Root cause:** branches/tags are created ad hoc (an agent named a feature branch after
the version at branch-creation time; a human/agent tagged a pre-rebase safety point) with
no visible cleanup convention.

**Impact:** low on its own, but it's evidence that the very high commit-automation
investment (bots, CI gates, postmortem ledgers) has not been matched by equivalent
branch/tag lifecycle automation — the "boring" parts of git hygiene are manual and drift.

### B9. Low–Medium — Version numbers are not deployable/checkoutable release points

**Evidence:** Only one git tag exists in the whole repository (A4); `version.json`,
`CLAUDE.md`, `sw.js` etc. are patched in place per commit (R1, `bump-version.mjs`) but
intermediate versions inside a batch commit (e.g. all of v56.15→v56.51 inside `cd4d8ca7`,
B3) never existed as their own commit/tag.

**Root cause:** versioning is treated as a content/documentation concern (cache-busting,
user-facing badge) rather than a git-native release concern.

**Impact:** "what shipped in v52.3" is not answerable by `git show v52.3` — you must grep
`CHANGELOG.md` and hope the entry is accurate and complete (and CHANGELOG.md is itself the
4th-most-churned file, at 452 commits, so its own accuracy has had bugs — see A7 and the
CHANGELOG grep hit at line 637 self-describing a documentation-vs-reality drift: *"CODE-MAP
정정... §1 파일 크기 표는 실제와 500~2,500줄 어긋나 있었다(크기 검사가... 꺼져 있어 아무도
몰랐다)"* — a stated documentation file was silently wrong by 500–2,500 lines because its
own verification check had been switched off, unnoticed).

### B10. Low — Coherence between stated intent and observed history is partially good, partially not

**Evidence for "good":** `architecture/README.md` accurately and self-critically describes
the strangler migration's actual state (native ESM is a "transitional compatibility API,
not a certified minimal read-only facade"); `_context/CURRENT-STATE.md` is generated
(`scripts/generate-workspace-state.mjs`), not hand-maintained, which is a genuinely sound
practice that avoids the classic stale-docs problem for *that* file specifically.

**Evidence for "not good":** `CLAUDE.md`'s stated absolute rules are only R1–R3 + R27, but
`_context/RULES.md` has grown to 178 rules — the "absolute" subset displayed to a fresh
agent session is a small, curated slice of a much larger and largely-unread ledger (B5);
the architecture doc's own migration goal (retire `js/`) is measurably not being met (B4/A8).

**Root cause / impact:** the project's meta-documentation about itself is often *honest*
(it says "this isn't done yet" in several places) but the underlying trend lines (A6, A7,
A8) show the gap widening, not closing, which suggests the self-assessment isn't
translating into corrective backlog prioritization.

---

## Part C — "If I were building/operating this"

### C1. Data out of git (addresses B1, the single highest-leverage fix)

**Current approach:** every 13F manager shard, `sec-fundamentals.json`, `screener.json`,
`history.json`, `telegram-digest.json` — all committed in full to `main` every 30 min–few
hours, growing at ~11–14 MB/day and already responsible for >10 GB of historical blob
content out of ~19 GB total.

**Recommendation:** move all `public-data/**` artifacts that are (a) machine-generated,
(b) fully replaced on every refresh, and (c) not meaningfully diffed by humans, out of git
entirely. Concrete options, in order of preference for this project's constraints
(GitHub Pages static hosting, Cloudflare Workers proxy, zero paid infra per memory notes):

1. **GitHub Releases as a blob store** — tag each data refresh as a release asset
   (`data-2026-09-27T05-25Z`), let GitHub's release-asset storage (not repo-size-counted)
   hold the JSON, and have the Pages site / service worker fetch `latest` via the Releases
   API or a small redirector. Zero new infra, zero new cost, and Actions can create a
   release in the same job that currently commits to `public-data/`.
2. **Orphan branch, shallow/depth-1, force-pushed** (e.g. `data` branch with `git push
   --force` each refresh, or periodic squash) — keeps data *in* the repo's hosting (so
   Pages could still serve it from a branch if desired) but prevents *history* accumulation
   because the branch never grows past one commit. Cheaper to adopt (no API changes needed
   if the site already fetches from a known path) but loses point-in-time history for the
   data itself — which is arguably fine, since `public-data/masters/*` history isn't used
   as a time series inside git; the app already builds its own `history.json`/quarter
   tracking for that.
3. **Cloudflare R2** (the project already uses Cloudflare Workers for proxies) — cheapest
   at scale, keeps data fully out of GitHub, and Workers can read/write it directly. Higher
   migration cost (new credentials, new fetch path in the site) but the most scalable and
   the most aligned with "data outside git."
4. Pages build artifact (GitHub Pages deploy without committing source) — least good fit
   here since Pages is currently served directly from `main`'s `public-data/`, not from a
   build step.

**Migration steps (option 1, lowest-risk incremental path):**
1. Add a `scripts/publish-data-release.mjs` that uploads the refresh outputs as release
   assets tagged by timestamp, and updates a single small `public-data/manifest.json` (URLs
   + revision + hash) that *does* stay in git (KB-sized, not MB).
2. Change site loaders to fetch big JSON from the release asset URL in the manifest instead
   of a same-repo path.
3. Run both paths in parallel for one release cycle to validate parity.
4. Cut over `refresh-data.yml`/`refresh-screener.yml` to stop committing the large files;
   keep committing only the manifest.
5. **Do not attempt `git filter-repo`/BFG history rewrite on `main`** while it's the single
   source of truth for a live 5-user tool with in-flight uncommitted work (per this audit's
   own constraints) — accept the existing ~19 GB of history as sunk cost, stop the bleeding
   going forward, and let old packs age out via GitHub's own retention/compression rather
   than doing a disruptive rewrite. If size ever becomes a hard blocker, a *scheduled,
   announced* rewrite is a separate, deliberate project with its own rollback plan — not an
   incidental cleanup step.

**Trade-off:** losing "the whole 13F history is one `git log`" convenience. In practice this
convenience isn't used today (the app's own `history.json`/`score-backtest-history.json`
already serve that purpose), so the cost is low relative to the ~350–430 MB/month growth
it removes from the object store your CI, contributors, and any future clone must pay for.

### C2. Commit identity and granularity (addresses B2, B3)

**Current approach:** one shared bot identity for all agent work; large multi-"P"-number,
multi-version batch commits landed after long uncommitted local sessions.

**Recommendation:**
- Use `Co-authored-by:` trailers (or distinct bot identities per tool: `claude-agent-bot`,
  `codex-agent-bot`) so `git log --author`/`git shortlog` can actually distinguish which
  tool produced which change, even if a human still gates the push. This is a pure
  metadata change, costs nothing, and immediately restores bisect-by-agent capability.
- Commit at "P-number" (single fix/postmortem) granularity, not at "batch of 50" granularity.
  If the existing workflow rule ("no auto-commit/deploy unless the user asks") is the reason
  work piles up uncommitted, decouple **committing** from **deploying**: commit locally to a
  short-lived branch per unit of work as it's completed, and only *merge-to-main-and-deploy*
  in the explicitly-approved batch. This preserves the "ask before shipping" governance
  intent while giving `git bisect`/`git log -p` per-P-number granularity for free.
- Reserve version bumps for the point right before a deploy, not for every P-number's local
  edit — i.e. stop treating `version.json` as a work-in-progress counter.

**Trade-off:** more commits to look at in `git log` day-to-day, but each one is small,
attributable, and revertable — the standard trade every team makes moving from "big commits"
to "small commits," and this repo is unusually well-positioned to make it cheaply because
almost all commits are already machine-generated (no human keystroke cost to commit more
often).

### C3. Branching and release model (addresses B3, B8, B9)

**Recommendation:** adopt lightweight git tags at every real deploy (`v56.55` → `git tag
v56.55 <sha>` in the same Action that deploys to Pages), so "what shipped in vX.Y" becomes
`git show vX.Y` instead of a CHANGELOG grep. Combine with a `deploy` branch or GitHub
Environments/Releases so Pages deployment provenance is a first-class git object, not just
a JSON field. This is additive (doesn't require changing anything else) and directly fixes
B9 at near-zero cost — a single line added to the existing deploy workflow.

For the stale `codex/` branch and old dependabot branches (B8): a scheduled monthly
`gh api` read-only audit (or a documented manual step) to delete merged/abandoned branches
would keep the branch list meaningful; this is a process fix, not a tooling investment.

### C4. What's working and should be kept

- The generated (not hand-written) `_context/CURRENT-STATE.md` is a good pattern — extend
  it: generate more of `_context/RULES.md`'s "active/superseded" split the same way, so the
  178-rule ledger doesn't need a human/agent to read all of it to find the 10 that matter
  for a given change.
- `scripts/resolve-data-manifest-merge.mjs` and the lane-isolation fix described in
  CHANGELOG (P1085/R609, "시세 게이트 실패가 ... 한 번에 스킵시켰다") show the team *does*
  learn from bot/human merge friction and fixes it structurally — that instinct is right;
  it just needs to be pointed at C1 (data-out-of-git) as the next highest-value target,
  since most merge conflicts here are almost certainly `public-data/*` bot-vs-bot or
  bot-vs-human races (**unverified** — a full conflict-content audit of all 60 merge
  commits was not performed in this pass; recommend a follow-up `git log --merges -p` scan
  specifically on `public-data/` paths to confirm).

---

## Notes on verification

- Confirmed via direct read-only git commands: all metrics in Part A tables A1–A10 except
  where marked.
- **Verified in a follow-up pass:** `codex/v54.37-ai-reliability` has zero unique commits
  vs. `origin/main` (confirmed redundant, safe to delete); the two dependabot PRs are open,
  not merged, 7–10 days old as of 2026-09-27; essentially all repo history (2,083 commits)
  landed via direct push/merge to `main` rather than PR review — only one PR (#1, closed
  2026-06-20) in the repo's entire lifetime went through the PR flow.
- **Still unverified / would need further checking:** (1) whether the 60 merge commits are
  predominantly `public-data/*` conflicts vs. code conflicts (would need a full
  `git log --merges -p` content scan, expensive, not run in this pass); (2) exact GitHub
  repository size as reported by GitHub's own server-side accounting (vs. local `.git` size,
  which can differ) — not checked via `gh api repos/ysnle/aio-screener` in this pass.
