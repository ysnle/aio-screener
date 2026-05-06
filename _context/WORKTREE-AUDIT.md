---
verified_by: codex
last_verified: 2026-05-06
confidence: high
target_version: v48.80
---

# Worktree Audit

This document is the routing map for AIO sessions, Claude worktrees, GitHub `origin/main`, and the live GitHub Pages build.

## Baseline

- **Deployed version observed before Codex deploy commit**: v48.79
- **GitHub baseline before Codex deploy commit**: `origin/main` at `c67d55d` (`v48.79: AI 채팅 행동 원칙 + AI vs 닷컴 버블 프레임 통합`)
- **Live site**: `https://ysnle.github.io/aio-screener/`
- **Live parity**: `index.html`, `version.json`, `manifest.json`, `sw.js`, and `js/*.js` match `origin/main` after CRLF/LF normalization.

## Important Routing Notes

- The OneDrive root worktree is still on local `main` at v48.13 and is behind `origin/main`. Do not use it as the deploy source until it is fast-forwarded or replaced with the current GitHub main.
- The v48.79 deploy source is represented by `origin/main`; Codex integration work must be applied on top of that baseline.
- v48.78/v48.79 work from `claude/frosty-tharp-f7bf80` is now represented in `origin/main` and should not be treated as unpublished.
- Several older Claude worktrees still have uncommitted local changes. Treat them as historical scratch/reference material, not as canonical deploy state.

## Branches Ahead Of GitHub Main

| Branch | State | Meaning | Action |
|---|---:|---|---|
| `claude/frosty-tharp-f7bf80` | represented by `origin/main` at v48.79, may still have local dirt | v48.78/v48.79 source branch history | Do not merge local dirt blindly; compare to `origin/main` first |
| `claude/laughing-poincare-757cb9` | ahead 2 | Alternative v48.73 path; code-equivalent cleanup already represented in `origin/main`, plus session/deploy documentation drift | Do not blindly merge; cherry-pick only intentional docs if needed |

## Dirty Historical Worktrees

The following worktrees contain uncommitted edits and should not be assumed to be reflected in the live site without a targeted diff:

- `AIO` root: v48.11~v48.13 changelog/doc backfill on stale local `main`.
- `adoring-shaw-079e0e`: v48.60 skill/rules docs.
- `beautiful-gagarin-8377cc`: v48.52~v48.54 large local edits.
- `determined-babbage-ef98ab`: v48.69 integrate/news additions.
- `elated-bhabha-33a5ca`: v48.71~v48.72 security/data edits.
- `elegant-perlman-f5a1e2`: v48.62 data/narrative consistency edits.
- `eloquent-yonath-fa9500`: v48.63 theme/trend edits.
- `exciting-bassi-ae7768`: v48.62 data-refresh edits.
- `suspicious-lamport-d37d8b`: stale context metadata edit.
- `upbeat-dubinsky-48a684`: v48.63~v48.66 operational docs.
- `xenodochial-edison-c7c185`: v48.67~v48.69 breadth/data edits.

## Changelog Backfill

The v48.77/v48.79 GitHub main code already contains later deployed work, but `CHANGELOG.md` was missing some historical sections. On 2026-05-05, the audit branch backfilled:

- v48.11
- v48.12
- v48.13
- v48.63
- v48.64
- v48.65
- v48.66

v48.78 and v48.79 are now present as deployed release entries in the integrated changelog.

## Audit Fixes On This Branch

- **P144 portfolio benchmark coverage**: `updateBenchmarkChart()` treated requested top holdings as covered before Yahoo chart fetch success was known. If those fetches failed, weights disappeared from both the real-series and fallback buckets. The audit branch now builds coverage from resolved ticker series only.
- **P145-P149 deep QA hardening**: inline/direct handler cleanup, AI quota cancel id, signal mode class state, sector 20d fallback chart, and mobile onboarding/theme-chip layout fixes are part of the Codex deploy candidate.
- **P150 operations hardening**: v48.80 synchronizes `sw.js` cache versioning with the app, exposes SW health, and adds `AIO.getOperationalHealth()` for live self-diagnostics.

## Definition Of "Applied"

A request is considered applied to the real site only when all of the following are true:

1. The implementation is in `origin/main`.
2. The live GitHub Pages asset matches the corresponding `origin/main` file after line-ending normalization.
3. The release/version documentation does not claim a higher deployed version than `version.json`.
4. Local Claude worktree-only changes are explicitly marked as unpublished or are merged/deployed by user request.
