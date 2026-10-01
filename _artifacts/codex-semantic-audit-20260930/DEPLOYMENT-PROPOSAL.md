# P1351 배포 수렴 정책 변경 제안 (미적용)

자동 승인 검토가 dispatch CI 소비 경로와 자동 수렴 mode 도입을 거부했다. 사용자가 정확한 배포 정책 변경과 영향 범위를 승인하지 않았다는 이유였다. 거부된 범위를 우회하지 않았다. 아래 diff는 검토용이며 실행 파일에 적용하지 않았다. 커밋/push/dispatch/배포는 실행하지 않았다.

Worker 변경 A 뒤 bot B가 main을 전진시키면 A는 stale로 건너뛰고 B의 dispatch CI는 push-only Worker 소비자를 깨우지 못한다. Pages 일치만으로 종료하는 드라이버도 Worker를 놓친다. 제안은 동일 저장소/main/CI 성공/정확한 SHA 및 run/repository attestation을 유지한다. 자동 convergence_only는 누적 Worker 변경만 배포하고 secret sync를 실행하지 않는다. API 실패와 legacy 무출처 Worker는 fail-closed다. 현재 적용된 제한 보강(main guard, attestation 바인딩, rollback 날짜, observer exact-ID) 위에 추가하는 제안이다.

## 정확한 추가 workflow diff

```diff
--- a/.github/workflows/deploy-ai-proxy.yml
+++ b/.github/workflows/deploy-ai-proxy.yml
@@
-        type: string
-
+        type: string
+      convergence_only:
+        description: Reconcile Worker code without forced redeploy or secret sync
+        required: false
+        default: false
+        type: boolean
+
@@
-      (github.event_name == 'workflow_run' && github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.head_branch == 'main' && github.event.workflow_run.event == 'push' && github.event.workflow_run.head_repository.full_name == github.repository)
+      (github.event_name == 'workflow_run' && github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.head_branch == 'main' && (github.event.workflow_run.event == 'push' || github.event.workflow_run.event == 'workflow_dispatch') && github.event.workflow_run.head_repository.full_name == github.repository)
@@
-          [ "$ci_event" = 'push' ] || { echo "::error::CI run $run_id was triggered by '$ci_event', expected a push to main"; exit 1; }
+          case "$ci_event" in push|workflow_dispatch) ;; *) echo "::error::CI run must be a same-repository main push or dispatch"; exit 1;; esac
@@
-          ATTESTED_CHANGE: ${{ steps.release.outputs.attested_change }}
+          CONVERGENCE_ONLY: ${{ inputs.convergence_only }}
+          ATTESTED_CHANGE: ${{ steps.release.outputs.attested_change }}
@@
-          const manual = process.env.EVENT_NAME === 'workflow_dispatch';
+          const manual = process.env.EVENT_NAME === 'workflow_dispatch' && process.env.CONVERGENCE_ONLY !== 'true';
@@
-          EVENT_NAME: ${{ github.event_name }}
-          CF_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
+          EVENT_NAME: ${{ github.event_name }}
+          CONVERGENCE_ONLY: ${{ inputs.convergence_only }}
+          CF_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
@@
-          if [ "$EVENT_NAME" = 'workflow_dispatch' ]; then
-            for pair in "ANTHROPIC_API_KEY=$CLAUDE_KEY" "FRED_API_KEY=$FRED_RELAY_KEY"; do
+          if [ "$EVENT_NAME" = 'workflow_dispatch' ] && [ "$CONVERGENCE_ONLY" != 'true' ]; then
+            for pair in "ANTHROPIC_API_KEY=$CLAUDE_KEY" "FRED_API_KEY=$FRED_RELAY_KEY"; do
@@
-        if: steps.convergence.outputs.should_deploy == 'true' && steps.latest-main.outputs.safe == 'true' && github.event_name == 'workflow_dispatch'
-        env:
+        if: steps.convergence.outputs.should_deploy == 'true' && steps.latest-main.outputs.safe == 'true' && github.event_name == 'workflow_dispatch' && !inputs.convergence_only
+        env:
--- a/.github/workflows/deploy-data-plane.yml
+++ b/.github/workflows/deploy-data-plane.yml
@@
-        type: string
-
+        type: string
+      convergence_only:
+        description: Reconcile Worker code without forced redeploy or secret sync
+        required: false
+        default: false
+        type: boolean
+
@@
-      (github.event_name == 'workflow_run' && github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.head_branch == 'main' && github.event.workflow_run.event == 'push' && github.event.workflow_run.head_repository.full_name == github.repository)
+      (github.event_name == 'workflow_run' && github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.head_branch == 'main' && (github.event.workflow_run.event == 'push' || github.event.workflow_run.event == 'workflow_dispatch') && github.event.workflow_run.head_repository.full_name == github.repository)
@@
-          [ "$ci_event" = 'push' ] || { echo "::error::CI run $run_id was triggered by '$ci_event', expected a push to main"; exit 1; }
+          case "$ci_event" in push|workflow_dispatch) ;; *) echo "::error::CI run must be a same-repository main push or dispatch"; exit 1;; esac
@@
-          ATTESTED_CHANGE: ${{ steps.release.outputs.attested_change }}
+          CONVERGENCE_ONLY: ${{ inputs.convergence_only }}
+          ATTESTED_CHANGE: ${{ steps.release.outputs.attested_change }}
@@
-          const manual = process.env.EVENT_NAME === 'workflow_dispatch';
+          const manual = process.env.EVENT_NAME === 'workflow_dispatch' && process.env.CONVERGENCE_ONLY !== 'true';
```

## 정확한 driver 추가 diff

```diff
--- a/scripts/ensure-live-convergence.mjs
+++ b/scripts/ensure-live-convergence.mjs
@@
-import { writeFileSync } from 'node:fs';
+import { readFileSync, writeFileSync } from 'node:fs';
+import { getWorkerChangesBetween, isAncestorCommit, shouldDeployWorker } from './worker-deploy-impact.mjs';
@@
-  if (report.liveSha === report.targetSha) finish('CONVERGED');
+  const currentMain = await api('/repos/' + REPO + '/commits/main');
+  if (currentMain.sha !== report.targetSha) finish('STALE_TARGET');
+  const endpoints = JSON.parse(readFileSync(new URL('../architecture/worker-endpoints.json', import.meta.url), 'utf8'));
+  let workersDispatched = false;
+  for (const [plane, endpoint, workflow] of [
+    ['aiProxy', endpoints.proxy, 'deploy-ai-proxy.yml'],
+    ['dataPlane', endpoints.fastQuotes, 'deploy-data-plane.yml']
+  ]) {
+    const response = await fetch(endpoint.baseUrl.replace(/\/$/, '') + (endpoint.healthPath || '/health'), {
+      headers: { Origin: 'https://ysnle.github.io', 'cache-control': 'no-cache' },
+      signal: AbortSignal.timeout(20000)
+    });
+    if (![200, 503].includes(response.status)) throw new Error('Worker health unavailable: ' + plane);
+    const health = await response.json();
+    const liveSha = health.sourceSha;
+    if (!/^[0-9a-f]{40}$/.test(liveSha || '')) throw new Error('operator_required: missing or malformed ' + plane + ' identity');
+    const cumulativeChanges = liveSha !== report.targetSha && isAncestorCommit(liveSha, report.targetSha)
+      ? await getWorkerChangesBetween(liveSha, report.targetSha) : undefined;
+    if (shouldDeployWorker({ plane, liveSha, testedSha: report.targetSha, latestMainSha: currentMain.sha, cumulativeChanges })) {
+      await dispatchWorkflow(workflow, { ci_run_id: String(report.ciRunId), convergence_only: true });
+      workersDispatched = true;
+    }
+  }
+  if (report.liveSha === report.targetSha) finish(workersDispatched ? 'DISPATCHED_WORKERS' : 'CONVERGED');
@@
-  finish('DISPATCHED_DEPLOY');
+  finish(workersDispatched ? 'DISPATCHED_PAGES_AND_WORKERS' : 'DISPATCHED_DEPLOY');
```

위 driver diff는 Pages가 이미 같아도 Worker를 독립적으로 판단한다. dispatch 요청 상태는 실제 배포 성공으로 표기하지 않는다. dry-run은 요청을 기록할 뿐 POST하지 않는다. sourceSha가 없거나 malformed이면 자동으로 증명 경계를 완화하지 않는다.

## 승인 후 수정·검증할 gate

- ci-cloudflare-deployment-contract-check 마지막 P1334 push-only assertion은 새 P1351 same-repository push-or-dispatch 규칙으로 바꾸되 fork/PR/다른 branch/name/repository/SHA/run을 거부한다.
- ci-deployment-convergence-check는 convergence_only와 secret sync 차단을 검사한다.
- bot A→B 합성 이력: B per-push change=false + live..B 누적 true이면 해당 plane만 배포한다. 누적 false와 이미 수렴한 경우 mutation 0회다.
- main/health API 오류는 fail-closed이며 자동 handoff가 manual forced redeploy/secret sync를 실행하지 않는 mock 경로를 확인한다.
- 실제 dispatch/배포를 로컬 회귀 검증에 포함하지 않는다. 이 제안의 신규 실행 경로는 아직 미검증이다.
