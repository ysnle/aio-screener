# /deploy

Deploy is allowed only when the user explicitly asks for `/deploy`, `deploy`, or `배포해줘`.

Read `_context/CURRENT-STATE.md` first. Automatic commit, push and deployment remain forbidden outside this explicit route.

## Required Gates

1. Run `node scripts/qa-runner.mjs full --no-cache`; fix the complete failure batch before rerunning failed groups.
2. Confirm the separate GitHub Pages workflow will deploy the successful CI SHA. Data-refresh deployment must pass its live-version drift guard.
3. Confirm `CHANGELOG.md` has the current version entry and the working-tree scope is intentional.
4. Commit/push only the reviewed target changes, wait for CI and the gated Pages workflow, then run `node scripts/qa-runner.mjs external --no-cache` against the exact deployed revision and Cloudflare planes.
5. Confirm no unverified live/browser claim is included unless live/browser validation actually ran.

## Route

This is a deployment workflow wrapper, not a skill replacement. If the deploy is part of bug/data/QA work, first follow the matching skill and then run this deploy closeout.

## Final Output

Report commit/push/deploy status separately from local verification. If deployment is blocked, name the exact blocked command or permission.
