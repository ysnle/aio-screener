# First-principles review — 2026-09-05

Status: APPLIED_VALIDATED. The user explicitly approved cleanup.patch; it was applied after a fresh baseline and a successful conflict check. Local version: v54.78. No commit, push or deployment occurred.

## Product criterion

The useful job is to observe market state, select research candidates, compare evidence and preserve a reviewable thesis. Code earns its place by serving that flow, its data producers, or a meaningful verification of those paths. A standalone abstraction plus tests of that abstraction is not evidence of a product capability.

## Scope and evidence

- Inventoried 1,820 tracked files, including 174 native JavaScript modules, 180 scripts and nine workflows. Existing uncommitted work was preserved.
- Reviewed runtime bootstrap, state/command/orchestrator wiring, legacy evidence implementation, AI answer dispatch, public artifact boundaries, builder consumers and CI entry points.
- Cross-checked candidate import paths AND all exported symbols against tracked runtime, script, architecture, workflow and prescriptive files. Dynamic test imports were checked separately; a static import graph alone was not used as deletion proof.
- This is a repository-wide structural and targeted semantic review, not a claim to have semantically audited every line, dataset or historical research document.

## Delete

The patch removes ten modules whose exported APIs have no runtime or producer consumers:

| Modules | Existing consumers | Reason |
| --- | --- | --- |
| src/platform/telemetry.js; src/ai/websearch/claims.js | None | Unused event recorder and wrapper around the active inference validator. |
| src/ai/provider/adapter.js; src/ai/operations/control-plane.js; src/ai/evidence/graph.js; src/ai/response/envelope.js | ci-ai-intelligence-contract-check.mjs only | A parallel, unconnected AI abstraction layer. Actual dispatch, research evidence and output validation live in answer-orchestrator/research/claim-ledger modules and remain intact. |
| src/data/contracts/revision.js; src/data/quality/lineage.js; src/platform/sanitizer.js | ci-architecture-contract-check.mjs only | Shadow fixture contracts. Actual release checks, provenance checks and UI escaping do not use these modules. |
| src/state/selectors/market.js | ci-architecture-contract-check.mjs only | Trivial property wrappers not consumed by the market renderer. The provider regression still checks the resulting quote value and immutability directly. |

The obsolete _deadV49112_getCritical10ContentEvidenceMatrix and its private _aioEvidenceStatus helper are also removed: 125 lines. Its only external executable reference is T817 demanding that the dead function exist. T817 is changed to require absence while retaining the canonical buildEvidenceStore check. The shared _aioExternalReferenceMap is retained because the current implementation uses it.

## Simplify after deletion

Remove only the fixture imports/assertions dedicated to the deleted abstractions. Keep tests of the active market writer, evidence store, inferred claims, AI planning/research policy and response pipeline. Update the code map to point at the remaining implementation. No replacement framework, generic factory or automation is added.

Patch: cleanup.patch — 15 files, 353 deleted lines, 6 added lines; net reduction 347 lines.

## Keep and why

- Native state/commands/providers/orchestrators: numerous thin files do add navigation cost, but their active consumers, cancellation and state ownership boundaries are real. Broadly merging them would introduce lifecycle risk without a demonstrated product benefit.
- Active legacy data producers and facade: the renderer being native does not mean the producer is removable. Registry labels are insufficient retirement evidence.
- Public data: about 401 MB on disk in tracked public-data files at inspection time, distinct from shipped bytes. Bulk files have explicit publishing exclusions and projection consumers. No retention policy was invented to delete historical data.
- Separate refresh/deploy/watchdog workflows: different triggers and responsibilities, including source-independent external checks. Repeated command names alone do not prove duplicate work.
- Existing benchmark/parity fixtures and historical records: they support active checks or preserve evidence; unused-by-browser is not synonymous with unnecessary.

## Validation

Before patch application, all six commands passed:

- node scripts/ci-architecture-contract-check.mjs
- node scripts/ci-ai-intelligence-contract-check.mjs
- node scripts/ci-esm-core-unit-check.mjs
- node scripts/ci-inference-contract-check.mjs
- node scripts/ci-release-revision-check.mjs
- node scripts/ci-retirement-contract.mjs

Draft checks passed: git apply --check cleanup.patch against the current tree; node --check on all four modified JavaScript preview files. These are patch applicability/syntax checks, not post-change runtime evidence.

## Application and remaining verification

- Approval block resolved: the user explicitly authorized application. No source application remains blocked.
- Applied exactly the reviewed patch; version/cache-key metadata was synchronized with bump-version.mjs and generated workspace state was refreshed. Existing dirty source changes were preserved.
- Independent post-application checks: 164 native modules, 236 relative imports, zero missing imports. The active getCritical10ContentEvidenceMatrix function is byte-identical and returned identical results for three representative input cases. The obsolete implementation and helper are absent. Core runtime decreased by 6,780 bytes.
- Post-application architecture, AI intelligence and ESM core checks passed. The affected QA runner completed: 86 PASS, 0 FAIL, 0 SKIP, 0 cached, 580.7 seconds. See qa-results.json and qa.log.
- Unverified: live deployment/provider state and human visual/accessibility review. These are not implied by automated local tests.

## Final validation

- 71 static gates and 15 local browser gates passed, including 109 headless test groups and the 20-route architecture/vertical flow checks.
- Browser checks covered public AI, market epoch, screener refresh, boot, architecture, vertical flows, route soak, outage, service worker control, boot network budget, viewport matrix, critical surfaces, portfolio vault and accessibility.
- Final generate-workspace-state.mjs --check and git diff --check passed after QA.
- No blocked work remains within the applied cleanup scope. Live state and human semantic/visual certification remain unverified.
- Retained active producer/lifecycle/validation paths intentionally; no claim that every remaining line is optimal or unnecessary work has been exhausted.
