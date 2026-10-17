---
name: verify-aio
description: Drive the local AIO Screener web UI like a user (8 screens, glossary, AI panel, shell) with Playwright and capture proof; also checks route-owners surfaces against the live DOM. Use to prove a UI change works in the real app.
---

## AIO Skill Operating Contract

Follow `.claude/skills/_shared/operating-contract.md`; reuse it if already read. This skill proves user-visible behavior; it does not replace `post-edit-qa` gates.

## Reference Loading Map

- Read `features/README.md` first (baseline, conventions, proof rules, index), then only the feature files the change touches.
- CLI: `scripts/verify-aio.mjs`. Lifecycle in `scripts/lib/instance.mjs`, shared waits/runner in `scripts/lib/drive.mjs`, one driver per map file in `scripts/features/<id>.mjs` (first line `// Map: features/<id>.md`).
- All commands below run from the repo root as `node .claude/skills/verify-aio/scripts/verify-aio.mjs <command>`.

## Launch

`launch [--port 8791]` starts `scripts/start-local-node.mjs` detached on `127.0.0.1:<port>` (default 8791, so the `aio-node` preview on 8765 is untouched), writes `<os tmp>/aio-verify/<port>/state.json`, then runs doctor. Ready = log line `AIO local server` plus doctor OK; each drive also waits for `window.showPage` and a `.page.active`. No build or seed step: the checkout's `public-data/` is the data. A port held by a pid this harness did not start is refused.

## Doctor

`doctor [--port]` is read-only: state file, our pid alive, the port's listener is our pid, served `version.json` = checkout, `/index.html` title `AIO Screener <version>` plus main navigation. Run it before the first drive and after any failed drive; `drive` and `registry` refuse to start on a failed doctor.

## Check (static, no browser)

`check` enforces the map contract: every `features/<id>.md` has `scripts/features/<id>.mjs` and vice versa, the README indexes every map file, each map keeps the four H2s, and each driver names its map. Run it after any map or driver edit.

## Drive

`drive <feature|all> [--viewport desktop|tablet|phone] [--run <id>] [--send-ai]`; `list` prints ids (`ai-panel glossary learn macro market portfolio screener shell stock themes today`).

- Each feature runs in a fresh Chromium context (service workers blocked, empty storage) that is closed afterwards.
- Handles are user-facing: sidebar `.nav-item[role=button]` by label, hub tabs `#aio-hub-tabs button.aio-hub-tab` by label, then ids and aria-labels. `--viewport phone` (390x844) and `--viewport tablet` (iPad portrait 820x1180) open the sidebar through the hamburger; desktop and phone runs alone do not certify the iPad layout.
- `expectText` never accepts loading copy (`—`, `판정 대기`, `…불러오는 중입니다.`); prefer element ids over page text length.
- `--send-ai` is the only path that can spend the shared AI budget; locally the Worker is unreachable, so the AI drive proves the free degraded path instead.

## Registry

`registry [--run <id>]` opens every route in `architecture/route-owners.json` and reports declared `nativePrimarySurface`/`nativeSecondarySurface` selectors missing from the live DOM. The static twin is the surface-exists block in `scripts/ci-architecture-contract-check.mjs` (R704).

## Evidence

- `_artifacts/verify-aio/<run>/<feature>-<viewport>/` (git-ignored): a screenshot per step, `final.aria.yml`, `report.json` (action and observed state per step, uncaught errors, unexpected console errors, CORS/network-noise count, local 4xx/5xx); `summary-<viewport>.json` and `registry.json` beside them.
- FAIL = a failed step, any uncaught page error, or any local 4xx/5xx. Console errors are classified on full text; CORS rejections of external providers are expected on 127.0.0.1 and only counted.
- Proof standard: real user path, never internal setters; action plus resulting state; side effects from a second view (portfolio storage, theme persistence); `—` is honest missing data, never a verified number.

## Cleanup

`cleanup [--port]` kills only the pid in the state file (`taskkill /T` on Windows), deletes the state dir, prints remaining listeners, and never touches `_artifacts/verify-aio/`. Never kill node by process name.

## Boundaries

- 127.0.0.1 is not allowed by the shared Worker or quote providers (CORS): live quotes, AI answers and provider refreshes show their degraded state locally. Claims about them need the Pages origin and the `post-edit-qa` external tier.
- Upkeep: `/maintain-verification-skill` audits this skill and `features/`.
