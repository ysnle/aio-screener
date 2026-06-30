# /deploy

Deploy is allowed only when the user explicitly asks for `/deploy`, `deploy`, or `배포해줘`.

## Required Gates

1. Run `node scripts/ci-version-check.mjs` to verify R1 7 synchronized surfaces.
2. Run the relevant structural/runtime/data gates for the touched files.
3. Confirm `CHANGELOG.md` has the current version entry.
4. Confirm no unverified live/browser claim is included unless live/browser validation actually ran.

## Route

This is a deployment workflow wrapper, not a skill replacement. If the deploy is part of bug/data/QA work, first follow the matching skill and then run this deploy closeout.

## Final Output

Report commit/push/deploy status separately from local verification. If deployment is blocked, name the exact blocked command or permission.
