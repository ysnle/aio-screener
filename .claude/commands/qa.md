# /qa

## AIO Skill Operating Contract

This command is a thin wrapper. Read `_context/CURRENT-STATE.md`, `_context/WORKFLOW-GOVERNANCE.md`, `_context/INDEX.md`, `.claude/skills/_shared/operating-contract.md`, and `.claude/skills/post-edit-qa/SKILL.md` completely.

Use `.claude/skills` as canonical and refresh any local Codex mirror with `node scripts/sync-agent-skills.mjs`. Keep R1 as 7 surfaces when a version bump is required, and run `node scripts/ci-skill-contract-check.mjs` after skill or wrapper edits.

## Route

Run `.claude/skills/post-edit-qa/SKILL.md`.

## Modes

- `/qa quick`: `node scripts/qa-runner.mjs fast`.
- `/qa`: Explain and run `node scripts/qa-runner.mjs affected`.
- `/qa retry`: `node scripts/qa-runner.mjs rerun-failed`; fix the whole reported batch before retrying.
- `/qa full`: One uncached release/deep pass with `node scripts/qa-runner.mjs full --no-cache`.
- `/qa external`: `node scripts/qa-runner.mjs external --no-cache` for Pages/Cloudflare/runtime claims.
- `/qa focus:{page}`: Page-focused QA plus shared producers/consumers.

## Final Output

Separate verified, blocked, and unverified surfaces. Do not claim browser, network, or live validation unless it actually ran.
