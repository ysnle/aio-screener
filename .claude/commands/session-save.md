# /session-save

Use only when the user explicitly asks to remember or save personal cross-session context.

## Boundaries

- Project truth belongs in the repository: `CHANGELOG.md`, `_context/CURRENT-STATE.md`, RULES, BUG, QA, KNOWLEDGE, and executable gates.
- Do not copy diffs, current version, deployment state, bug details, code rules, or research artifacts into personal memory.
- Do not use a hardcoded machine/user path. Discover the active client memory capability or report it unavailable.
- Never commit, push or deploy as part of memory save.

## Workflow

1. Identify only durable user preference, feedback, or explicitly requested personal memory.
2. Check for an existing matching memory entry through the active client capability.
3. Update rather than duplicate; use absolute dates.
4. If no memory capability is available, report BLOCKED without writing an ad-hoc repository or home-directory file.

## Output

Report saved, updated, skipped and blocked items separately. Repository state remains governed by `_context/CURRENT-STATE.md` and its generator.
