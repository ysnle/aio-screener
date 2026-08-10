# QA Scope Matrix

Use this reference to select the minimum sufficient QA tiers without hardcoding a historical page count.

## Risk Mapping

| Changed surface | Required tiers | Escalate when |
|-----------------|----------------|---------------|
| Skill, command, workflow doc | 1, 12 | Canonical/mirror, command, or reference topology changed |
| Pure data artifact | 1, 3, 7, 12 | User-visible headline, decision score, or freshness changed |
| Data producer or selector | 1, 3, 7, 12 | Multiple consumers, fallbacks, or sourceKind promotion involved |
| Shared renderer or navigation | 1, 2, 4, 6, 10, 12 | More than one route or lifecycle owner is affected |
| User input or HTML rendering | 1, 2, 5, 6, 12 | `innerHTML`, URL, API text, or persisted content is involved |
| Timer, listener, chart lifecycle | 1, 2, 4, 9, 10, 12 | Re-entry, repeated navigation, or shared ownership is involved |
| User-visible UI/UX | Above mapping plus 13 | Browser control is unavailable or deployment differs from local |

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
