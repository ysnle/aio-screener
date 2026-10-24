# Workflow 전수 목록 (정적 스냅샷)

각 실행 step 원문과 조건은 inventory.json에 보존했다. cron은 YAML 원문 시간이며 한국 시각으로 변환한 표가 아니다.

## CI

파일: `.github/workflows/ci.yml`

트리거: `{"push":{"branches":["main"]},"pull_request":null,"workflow_dispatch":{"inputs":{"release_sha":{"description":"Exact bot-produced commit to validate and attest","required":false,"type":"string"},"origin":{"description":"Validation scope owner (refresh-data or refresh-screener)","required":false,"type":"string"}}}}`

concurrency: `{"group":"${{ github.workflow }}-${{ github.event.pull_request.number || inputs.release_sha || github.ref }}","cancel-in-progress":true}`

| Job | Needs | 단계 수 | 주요 실행 |
|---|---|---:|---|
| preflight | 없음 | 5 | `node scripts/qa-runner.mjs --group preflight --no-cache` |
| contracts | "preflight" | 6 | `node scripts/sec-fundamentals-store.mjs restore --match-manifest`<br>`node scripts/qa-runner.mjs --group ${{ matrix.group }} --no-cache` |
| browser | "preflight" | 7 | `node scripts/qa-runner.mjs --group ${{ matrix.group }} --no-cache` |
| attest | ["preflight","contracts","browser"] | 4 |  |

## Data freshness watchdog

파일: `.github/workflows/data-watchdog.yml`

트리거: `{"schedule":[{"cron":"23 * * * *"}],"workflow_run":{"workflows":["Deploy GitHub Pages","Deploy AI proxy","Refresh market data"],"types":["completed"]},"workflow_dispatch":{"inputs":{"max_age_minutes":{"description":"Maximum live artifact age in minutes.","required":false,"default":"360"}}}}`

concurrency: `{"group":"aio-data-watchdog","cancel-in-progress":true}`

| Job | Needs | 단계 수 | 주요 실행 |
|---|---|---:|---|
| check | 없음 | 9 | `node scripts/qa-runner.mjs watchdog --no-cache --jobs 2 2>&1 / tee "$RUNNER_TEMP/watchdog-qa.log"`<br>`node scripts/report-qa-failures.mjs --title Watchdog`<br>`node scripts/build-operations-slo-window.mjs --out "$RUNNER_TEMP/operations-slo-window.json"` |
| manual-reference-expiry | 없음 | 4 | `node scripts/ci-manual-reference-expiry-check.mjs --issue-body "$RUNNER_TEMP/manual-reference-expiry.md" --github-output` |

## Deploy AI proxy

파일: `.github/workflows/deploy-ai-proxy.yml`

트리거: `{"workflow_run":{"workflows":["CI"],"types":["completed"]},"workflow_dispatch":{"inputs":{"ci_run_id":{"description":"Successful main CI run that attested the exact Worker source SHA","required":true,"type":"string"}}}}`

concurrency: `{"group":"aio-cloudflare-ai-proxy","cancel-in-progress":false}`

| Job | Needs | 단계 수 | 주요 실행 |
|---|---|---:|---|
| deploy | 없음 | 17 | `node scripts/qa-runner.mjs --group cloudflare --no-cache`<br>`wrangler deployments list --json --config worker/wrangler.proxy.deploy.toml > "$RUNNER_TEMP/aio-proxy-deployments.json"`<br>`previous_version="$(node scripts/resolve-worker-rollback-version.mjs "$RUNNER_TEMP/aio-proxy-deployments.json")"`<br>`safe="$(node scripts/worker-deploy-impact.mjs --main-advance aiProxy "$EXPECTED_SHA" "$current_main_sha" // echo false)"`<br>`if ! wrangler deploy --config worker/wrangler.proxy.deploy.toml --message "AIO AI proxy $SOURCE_SHA" 2>&1 / tee "$deploy_log"; then`<br>`if wrangler deploy --config worker/wrangler.proxy.deploy.toml --message "AIO AI proxy $SOURCE_SHA (retry)" 2>&1 / tee "$deploy_log"; then`<br>`wrangler deploy --config worker/wrangler.proxy.deploy.toml --message "AIO AI proxy $SOURCE_SHA (no Workers AI)"`<br>`wrangler rollback "$PREVIOUS_VERSION_ID" --config worker/wrangler.proxy.deploy.toml --message "Automatic rollback after failed AIO smoke for $SOURCE_SHA"` |

## Deploy fast data plane

파일: `.github/workflows/deploy-data-plane.yml`

트리거: `{"workflow_run":{"workflows":["CI"],"types":["completed"]},"workflow_dispatch":{"inputs":{"ci_run_id":{"description":"Successful main CI run that attested the exact Worker source SHA","required":true,"type":"string"}}}}`

concurrency: `{"group":"aio-cloudflare-data-plane","cancel-in-progress":false}`

| Job | Needs | 단계 수 | 주요 실행 |
|---|---|---:|---|
| deploy | 없음 | 17 | `node scripts/qa-runner.mjs --group cloudflare --no-cache`<br>`wrangler deployments list --json --config worker/wrangler.deploy.toml > "$RUNNER_TEMP/aio-fast-deployments.json"`<br>`previous_version="$(node scripts/resolve-worker-rollback-version.mjs "$RUNNER_TEMP/aio-fast-deployments.json")"`<br>`safe="$(node scripts/worker-deploy-impact.mjs --main-advance dataPlane "$EXPECTED_SHA" "$current_main_sha" // echo false)"`<br>`wrangler deploy --config worker/wrangler.deploy.toml --message "AIO fast data plane $SOURCE_SHA"`<br>`wrangler rollback "$PREVIOUS_VERSION_ID" --config worker/wrangler.deploy.toml --message "Automatic rollback after failed AIO smoke for $SOURCE_SHA"` |

## Annual exchange calendar review reminder

파일: `.github/workflows/exchange-calendar-review.yml`

트리거: `{"schedule":[{"cron":"0 9 1 11 *"}],"workflow_dispatch":{"inputs":{"review_year":{"description":"Calendar year to review; blank defaults to the next UTC calendar year.","required":false,"type":"string"}}}}`

concurrency: `{"group":"annual-exchange-calendar-review","cancel-in-progress":false}`

| Job | Needs | 단계 수 | 주요 실행 |
|---|---|---:|---|
| report | 없음 | 3 | `node scripts/build-exchange-calendar-review.mjs --year "$review_year" > "$body_file"` |
| issue | "report" | 1 |  |

## Knowledge build candidate

파일: `.github/workflows/knowledge-build-candidate.yml`

트리거: `{"pull_request":{"paths":["content/**","js/aio-glossary.js","public-data/atlas/**","public-data/knowledge/**","public-data/masters/holdings.json","public-data/masters/history-holdings.json","public-data/masters/index.json","public-data/principles/**","src/ui/pages/principles.js","src/ui/pages/atlas.js","src/ui/knowledge/learning-controls.js","src/app/knowledge-route-state.js","src/domain/knowledge/**","scripts/build-13f-issuer-aggregates.mjs","scripts/lib/atomic-write.mjs","scripts/lib/13f-semantic-hash.mjs","scripts/*knowledge*.mjs","scripts/build-atlas-*.mjs","scripts/build-principles-*.mjs","scripts/audit-knowledge-*.mjs","scripts/enrich-knowledge-*.mjs","scripts/ci-knowledge-generated-parity-check.mjs",".github/workflows/knowledge-build-candidate.yml"]},"workflow_dispatch":{}}`

concurrency: `{"group":"knowledge-build-candidate-${{ github.event.pull_request.number || github.ref }}","cancel-in-progress":true}`

| Job | Needs | 단계 수 | 주요 실행 |
|---|---|---:|---|
| candidate | 없음 | 4 | `node scripts/ci-knowledge-generated-parity-check.mjs --candidate-dir "$CANDIDATE_DIR"` |

## Knowledge base lint

파일: `.github/workflows/knowledge-lint.yml`

트리거: `{"schedule":[{"cron":"13 4 * * 1"}],"workflow_dispatch":{}}`

concurrency: `undefined`

| Job | Needs | 단계 수 | 주요 실행 |
|---|---|---:|---|
| lint | 없음 | 2 | `node scripts/generate-workspace-state.mjs --check`<br>`node scripts/sync-agent-profiles.mjs --check`<br>`node scripts/ci-skill-contract-check.mjs`<br>`node scripts/ci-skill-eval-fixture-check.mjs`<br>`node scripts/ci-doc-currency-check.mjs`<br>`node scripts/ci-ledger-integrity-check.mjs`<br>`node scripts/ci-assertion-trace-check.mjs`<br>`node scripts/ci-six-doc-coverage-check.mjs`<br>`node scripts/ci-workspace-contract-check.mjs`<br>`node scripts/ci-knowledge-lint-check.mjs` |

## Weekly macro calendar candidate review

파일: `.github/workflows/macro-calendar-review.yml`

트리거: `{"schedule":[{"cron":"7 10 * * 1"}],"workflow_dispatch":{"inputs":{"review_date":{"description":"Optional deterministic UTC review date (YYYY-MM-DD).","required":false,"type":"string"}}}}`

concurrency: `{"group":"weekly-macro-calendar-review","cancel-in-progress":false}`

| Job | Needs | 단계 수 | 주요 실행 |
|---|---|---:|---|
| review | 없음 | 5 | `node scripts/fetch-fred-calendar-candidates.mjs --as-of "$review_date" > "$RUNNER_TEMP/macro-calendar-candidates.json"`<br>`node scripts/preview-macro-calendar.mjs --fixture "$RUNNER_TEMP/macro-calendar-candidates.json" --as-of "$review_date" > "$RUNNER_TEMP/macro-calendar-preview.json"`<br>`node scripts/build-macro-calendar-review.mjs --preview "$RUNNER_TEMP/macro-calendar-preview.json" > "$RUNNER_TEMP/macro-calendar-review.md"` |

## Operations failure escalation

파일: `.github/workflows/operations-alert.yml`

트리거: `{"workflow_run":{"workflows":["CI","Deploy GitHub Pages","Data freshness watchdog","Knowledge base lint","Refresh market data","Refresh screener and SEC fundamentals","Deploy AI proxy","Deploy fast data plane"],"types":["completed"]}}`

concurrency: `{"group":"aio-operations-alert-${{ github.event.workflow_run.name }}","cancel-in-progress":false}`

| Job | Needs | 단계 수 | 주요 실행 |
|---|---|---:|---|
| reconcile | 없음 | 1 |  |

## Deploy GitHub Pages

파일: `.github/workflows/pages-deploy.yml`

트리거: `{"workflow_run":{"workflows":["CI"],"types":["completed"]},"workflow_dispatch":{"inputs":{"ci_run_id":{"description":"Completed CI run that produced the release attestation","required":true,"type":"string"},"expected_sha":{"description":"Exact lowercase 40-hex SHA that CI attested","required":true,"type":"string"}}}}`

concurrency: `{"group":"aio-pages-production","cancel-in-progress":false}`

| Job | Needs | 단계 수 | 주요 실행 |
|---|---|---:|---|
| deploy | 없음 | 17 | `node scripts/build-pages-bundle.mjs "$RUNNER_TEMP/pages-dist" --manifest "$RUNNER_TEMP/aio-bundle-manifest.json"`<br>`node scripts/ci-external-pipeline-check.mjs --mode release`<br>`node scripts/ci-live-invariant-check.mjs` |

## Refresh market data

파일: `.github/workflows/refresh-data.yml`

트리거: `{"schedule":[{"cron":"17,47 * * * *"},{"cron":"33 7 * * *"}],"workflow_dispatch":{"inputs":{"trigger":{"description":"operator (full 13F chain) or scheduler (data cycle only)","required":false,"default":"operator","type":"string"},"retry":{"description":"set by the refresh itself on a push collision (collision); empty otherwise","required":false,"default":"","type":"string"}}}}`

concurrency: `undefined`

| Job | Needs | 단계 수 | 주요 실행 |
|---|---|---:|---|
| cadence | 없음 | 2 | `node scripts/refresh-cadence.mjs --github-output` |
| refresh | "cadence" | 30 | `node scripts/fetch-data.mjs`<br>`node scripts/ci-data-refresh-audit.mjs --write-snapshot-diagnostic "$RUNNER_TEMP/market-snapshot-diagnostic.json"`<br>`node scripts/fetch-telegram-digest.mjs --days=14 --out=public-data/telegram-digest.json`<br>`age_hours="$(node scripts/daily-lane-age.mjs)"`<br>`node scripts/build-stress-outcomes.mjs`<br>`node scripts/build-scenario-outcomes.mjs`<br>`node scripts/build-market-temperature.mjs`<br>`node scripts/collect-13f-discovery.mjs`<br>`node scripts/collect-13f-reference.mjs`<br>`node scripts/collect-13f-history-index.mjs`<br>`node scripts/collect-13f-history-rows.mjs`<br>`node scripts/build-13f-issuer-aggregates.mjs`<br>`node scripts/collect-13f-figi-tickers.mjs // echo "::warning::OpenFIGI CUSIP mapping skipped"`<br>`node scripts/build-masters-runtime-artifacts.mjs`<br>`node scripts/build-13f-reference-ticker-index.mjs`<br>`ownership_result="$(node scripts/collect-13f-discovery.mjs --ownership-only)"`<br>`node scripts/ci-13f-currentness-check.mjs`<br>`node scripts/ci-masters-contract-check.mjs`<br>`node scripts/refresh-web-research.mjs`<br>`node scripts/build-scenario-state.mjs`<br>`node scripts/sync-data-release-manifests.mjs`<br>`node scripts/quarantine-degradable-lanes.mjs`<br>`node scripts/ci-refresh-artifact-integrity-check.mjs`<br>`node scripts/ci-data-continuity-check.mjs`<br>`node scripts/verify-refresh-candidate.mjs --self-test`<br>`AIO_QA_CACHE_DIR="$RUNNER_TEMP/aio-qa" node scripts/qa-runner.mjs --group data --no-cache`<br>`node scripts/ci-web-research-contract-check.mjs`<br>`node scripts/verify-refresh-candidate.mjs --record "$RUNNER_TEMP/aio-refresh-data-candidate.json"`<br>`node scripts/verify-refresh-candidate.mjs --expect "$RUNNER_TEMP/aio-refresh-data-candidate.json"`<br>`node scripts/ci-masters-contract-check.mjs --staged`<br>`node scripts/verify-refresh-candidate.mjs --expect-staged "$RUNNER_TEMP/aio-refresh-data-candidate.json"`<br>`gh workflow run refresh-data.yml --ref main -f trigger=scheduler -f retry=collision`<br>`node scripts/verify-refresh-candidate.mjs --expect-commit "$RUNNER_TEMP/aio-refresh-data-candidate.json"`<br>`node scripts/verify-refresh-candidate.mjs --expect-commit "$RUNNER_TEMP/aio-refresh-data-candidate.json" // collision_retry "the rebased tree no longer matches the validated candidate"`<br>`gh workflow run ci.yml --ref main -f release_sha="$final_sha" -f origin="refresh-data"`<br>`node scripts/daily-lane-age.mjs --write-marker` |
| converge | ["cadence","refresh"] | 3 | `node scripts/ensure-live-convergence.mjs --await-sha "${{ needs.refresh.outputs.sha }}" --timeout-min 12`<br>`node scripts/ensure-live-convergence.mjs` |

## Refresh screener and SEC fundamentals

파일: `.github/workflows/refresh-screener.yml`

트리거: `{"schedule":[{"cron":"53 */6 * * *"},{"cron":"53 21 * * *"}],"workflow_dispatch":{"inputs":{"retry":{"description":"collision = one re-run from the new main after a push conflict (v58.71)","required":false,"default":""}}}}`

concurrency: `undefined`

| Job | Needs | 단계 수 | 주요 실행 |
|---|---|---:|---|
| refresh-screener | 없음 | 19 | `node scripts/sec-fundamentals-store.mjs restore --github-output`<br>`node scripts/fetch-sec-fundamentals.mjs`<br>`node scripts/fetch-dart-fundamentals.mjs`<br>`node scripts/fetch-kr-investor-flows.mjs`<br>`node scripts/fetch-earnings-calendar.mjs`<br>`node scripts/fetch-consensus-estimates.mjs`<br>`node scripts/fetch-sp500-weights.mjs`<br>`node scripts/build-us-listings.mjs`<br>`node scripts/ci-us-listings-check.mjs`<br>`node scripts/sec-fundamentals-store.mjs guard`<br>`node scripts/build-sec-runtime-projection.mjs`<br>`node scripts/ci-sec-runtime-projection-check.mjs`<br>`node scripts/fetch-data.mjs`<br>`node scripts/validate-screener-artifact.mjs public-data/screener.json`<br>`node scripts/ci-screener-workbench-contract.mjs`<br>`node scripts/ci-page-data-timeline-contract-check.mjs`<br>`node scripts/ci-candidate-archive-check.mjs # P1465`<br>`node scripts/build-reconciliation-status.mjs`<br>`node scripts/build-operations-status.mjs`<br>`node scripts/ci-reconciliation-contract-check.mjs`<br>`node scripts/ci-source-registry-contract-check.mjs`<br>`node scripts/ci-professional-data-gap-check.mjs`<br>`node scripts/ci-static-data-contract-check.mjs`<br>`node scripts/ci-operations-status-check.mjs`<br>`node scripts/verify-refresh-candidate.mjs --record "$RUNNER_TEMP/aio-refresh-screener-candidate.json"`<br>`node scripts/verify-refresh-candidate.mjs --expect "$RUNNER_TEMP/aio-refresh-screener-candidate.json"`<br>`gh workflow run refresh-screener.yml --ref main -f retry=collision`<br>`node scripts/verify-refresh-candidate.mjs --expect-staged "$RUNNER_TEMP/aio-refresh-screener-candidate.json"`<br>`node scripts/sec-fundamentals-store.mjs publish`<br>`node scripts/verify-refresh-candidate.mjs --expect-commit "$RUNNER_TEMP/aio-refresh-screener-candidate.json"`<br>`node scripts/verify-refresh-candidate.mjs --expect-commit "$RUNNER_TEMP/aio-refresh-screener-candidate.json" // collision_retry "the rebased tree no longer matches the validated candidate"`<br>`gh workflow run ci.yml --ref main -f release_sha="$final_sha" -f origin="refresh-screener"` |
| refresh-screener-extended | "refresh-screener" | 9 | `node scripts/screener-extended-due.mjs`<br>`node scripts/fetch-extended-universe.mjs`<br>`node scripts/fetch-sec-fundamentals.mjs`<br>`node scripts/fetch-data.mjs`<br>`node scripts/validate-screener-extended.mjs public-data/screener-extended.json`<br>`node scripts/ci-screener-extended-contract-check.mjs`<br>`node scripts/ci-artifact-size-headroom-check.mjs`<br>`gh workflow run ci.yml --ref main -f release_sha="$final_sha" -f origin="refresh-screener"` |
| converge-extended | "refresh-screener-extended" | 3 | `node scripts/ensure-live-convergence.mjs --await-sha "${{ needs.refresh-screener-extended.outputs.sha }}" --timeout-min 12` |
| converge | "refresh-screener" | 3 | `node scripts/ensure-live-convergence.mjs --await-sha "${{ needs.refresh-screener.outputs.sha }}" --timeout-min 12`<br>`node scripts/ensure-live-convergence.mjs` |

## Monthly screener universe review

파일: `.github/workflows/universe-review.yml`

트리거: `{"schedule":[{"cron":"29 9 1 * *"}],"workflow_dispatch":{"inputs":{"review_date":{"description":"Optional deterministic UTC report date (YYYY-MM-DD).","required":false,"type":"string"}}}}`

concurrency: `{"group":"monthly-screener-universe-review","cancel-in-progress":false}`

| Job | Needs | 단계 수 | 주요 실행 |
|---|---|---:|---|
| review | 없음 | 5 | `node scripts/sync-screener-universe.mjs --check`<br>`node scripts/build-universe-review.mjs --date "$review_date" > "$RUNNER_TEMP/universe-review.md"`<br>`node scripts/build-universe-review.mjs > "$RUNNER_TEMP/universe-review.md"` |

