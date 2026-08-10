# /qa

## AIO Skill Operating Contract

This command is a thin wrapper. Before executing, read `_context/WORKFLOW-GOVERNANCE.md`, `_context/INDEX.md`, `.claude/skills/_shared/operating-contract.md`, and `.claude/skills/post-edit-qa/SKILL.md` completely.

Use `.claude/skills` as canonical and refresh any local Codex mirror with `node scripts/sync-agent-skills.mjs`. Keep R1 as 7 surfaces when a version bump is required, and run `node scripts/ci-skill-contract-check.mjs` after skill or wrapper edits.

## Route

Run `.claude/skills/post-edit-qa/SKILL.md`.

## Modes

- `/qa quick`: Tier 1 plus obvious dead-page/data-snap checks.
- `/qa`: Minimum sufficient tier set for the touched surfaces.
- `/qa full`: Full deep QA across the app.
- `/qa focus:{page}`: Page-focused QA plus shared producers/consumers.

## Final Output

Separate verified, blocked, and unverified surfaces. Do not claim browser, network, or live validation unless it actually ran.
