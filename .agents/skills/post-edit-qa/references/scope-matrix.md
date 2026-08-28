# QA Scope Matrix

Use this reference to select the minimum sufficient QA tiers without hardcoding a historical page count.

## Risk Mapping

| Changed surface | Required tiers | Escalate when |
|-----------------|----------------|---------------|
| Skill, command, agent, hook, workflow doc | 1, 5, 12 | Canonical/mirror, generated profile, permission, command, or reference topology changed |
| Generated current state/catalog producer | 1, 12 | Registry inputs, classification or preflight budget changed |
| Pure data artifact | 1, 3, 7, 12 | User-visible headline, decision score, or freshness changed |
| Data producer or selector | 1, 3, 7, 12 | Multiple consumers, fallbacks, or sourceKind promotion involved |
| Shared renderer or navigation | 1, 2, 4, 6, 10, 12 | More than one route or lifecycle owner is affected |
| User input or HTML rendering | 1, 2, 5, 6, 12 | `innerHTML`, URL, API text, or persisted content is involved |
| Timer, listener, chart lifecycle | 1, 2, 4, 9, 10, 12 | Re-entry, repeated navigation, or shared ownership is involved |
| User-visible UI/UX | Above mapping plus 13 | Browser control is unavailable or deployment differs from local |

## Runner Mapping

| Situation | Command | Why |
|-----------|---------|-----|
| Before the first edit | `node scripts/qa-runner.mjs session-start --session <task-id>` | Captures a content-hash baseline that excludes pre-existing dirty work |
| Before or during a small edit | `node scripts/qa-runner.mjs fast` | Cheap structural feedback with safe local cache |
| Normal post-edit closeout | `node scripts/qa-runner.mjs affected --session <task-id> --explain`, then the same command without `--explain` | Selects shared consumers from task-only changed paths |
| Baseline was not captured | `node scripts/qa-runner.mjs affected --files path/a,path/b` | Uses the exact task-owned list without inheriting unrelated dirty files |
| One phase reported failures | `node scripts/qa-runner.mjs rerun-failed` | Rechecks exact failed gates and declared dependencies only |
| Complete source-contract audit | `node scripts/qa-runner.mjs contracts --no-cache` | Runs every non-browser local gate without claiming rendered behavior |
| Release/shared-shell certification | `node scripts/qa-runner.mjs full --no-cache` | Executes the complete local source/runtime boundary once |
| Deployed GitHub Pages/Cloudflare state | `node scripts/qa-runner.mjs external --no-cache` | Separates external truth from local truth |

Impact selection is conservative: `scripts/**` and broad architecture changes fan out to all static groups. `index.html`, shared JS, shell, service worker and common UI select the relevant browser shards. The manifest, not prose or a frozen page count, is authoritative.

## Route Coverage

- Derive routes from the current repository route/page registry and architecture contracts.
- Do not copy a historical route count into the skill.
- Check directly touched routes plus sibling consumers of the same producer or renderer.
- For shared navigation, store, shell, service worker, or cross-route events, use the full active route set.
- Record retired aliases separately; redirect behavior is not an active-page PASS.

## Evidence Levels

| Level | Proves | Does not prove |
|-------|--------|----------------|
| Static | Syntax, references, structural invariants | Runtime rendering or external availability |
| Runtime/headless | Executed local behavior and assertions | Real paint quality or deployed parity |
| Browser | User interaction, visible layout, console state | External provider correctness unless exercised |
| Live/external | Deployed/provider state at observation time | Future availability |

Report each level independently. A lower level cannot substitute for a required higher level.
