---
verified_by: qa-pipeline-contract
last_verified: 2026-08-24
confidence: high
auto_refresh: false
target_version: version.json
---

# QA And Delivery Pipeline Architecture

이 문서는 코드 수정 후 로컬 검증부터 GitHub Pages와 Cloudflare 운영 확인까지의 현재 실행 구조를 설명한다. 실행 정의의 단일 원본은 `architecture/qa-pipeline.json`이며 이 문서는 판단 기준과 운영 경계를 제공한다.

## Root Cause Closed

과거 CI는 값싼 정적 검사와 긴 브라우저 작업을 독립 job으로 동시에 시작했고, 각 job 안에서는 첫 실패 뒤 나머지 step을 건너뛰었다. 2026-08-24 감사 기준 최근 실패 run은 사전 구조 계약이 수초 안에 실패했지만 별도 headless job이 약 10분 동안 계속 실행된 뒤 두 번째 실패만 보고했다. 데이터 갱신 완료도 같은 전체 CI를 다시 호출해 이 비용과 실패를 30분마다 반복했다.

현재 구조는 다음 네 경계를 갖는다.

```text
local affected/cache
  -> CI preflight (cheap aggregate)
  -> static contract matrix (fail-fast: false)
  -> browser matrix (fail-fast: false)
  -> separate Pages deploy
  -> post-deploy Pages + Cloudflare + GitHub workflow verification
```

한 단계 안의 모든 오류를 수집하고, 실패 단계보다 비싼 단계만 차단한다. 따라서 하나를 고칠 때마다 전체를 처음부터 돌려 다음 오류를 찾는 방식이 아니다.

## Local Profiles

| Goal | Command | Contract |
|---|---|---|
| Task baseline | `node scripts/qa-runner.mjs session-start --session <task-id>` | 수정 전 파일 내용 해시를 저장해 기존 dirty 작업과 이번 변경을 분리 |
| Cheap feedback | `node scripts/qa-runner.mjs fast` | 정적 preflight만 실행; 성공 결과는 입력 내용 해시로 재사용 |
| Normal closeout | `node scripts/qa-runner.mjs affected --session <task-id> --explain`, then the same command without `--explain` | task baseline 이후 변경에서 정적·브라우저 소비자 그룹을 계산 |
| Baseline fallback | `node scripts/qa-runner.mjs affected --files path/a,path/b` | 이미 작업을 시작했을 때 정확한 task-owned 목록만 사용 |
| Failure retry | `node scripts/qa-runner.mjs rerun-failed` | 직전 실패 gate와 명시된 의존 gate만 재검사 |
| Source-contract audit | `node scripts/qa-runner.mjs contracts --no-cache` | 전체 비브라우저 계약을 실행하되 렌더링 PASS는 주장하지 않음 |
| Release certification | `node scripts/qa-runner.mjs full --no-cache` | 전체 로컬 소스·headless 경계를 한 번 실행 |
| Deployed truth | `node scripts/qa-runner.mjs external --no-cache` | Pages, proxy, fast plane, Actions 상태를 현재 시점에 관찰 |

캐시는 PASS만 저장하며 해당 gate 정의, cache schema, Node major, 선언된 입력 파일 내용과 gate script가 같을 때만 유효하다. 관련 없는 manifest 항목이나 runner 문구 변경은 모든 성공 gate를 무효화하지 않는다. CI와 release는 항상 `--no-cache`다. 결과는 `.cache/aio-qa/last-run.json`, task 기준선은 `.cache/aio-qa/sessions/`에 남고 저장소에는 커밋하지 않는다.

## GitHub Ownership

- `.github/workflows/ci.yml`: push/PR 소스 인증만 담당한다. 배포와 데이터-refresh 완료 트리거를 소유하지 않는다.
- `.github/workflows/pages-deploy.yml`: 성공한 CI가 업로드한 `aio-release-attestation`의 정확한 SHA만 checkout·배포한다. mutable branch checkout이나 version 문자열만 비교하는 우회 경로는 없다.
- `.github/workflows/data-watchdog.yml`: 로컬 데이터와 Pages/proxy/fast/live invariant를 한 aggregate profile로 실행한다. 한 plane 실패가 다른 plane 검사를 건너뛰지 않는다.
- `.github/workflows/operations-alert.yml`: CI, Pages, watchdog, knowledge lint, 두 refresh와 두 Cloudflare deploy의 실패를 workflow별 단일 이슈로 소유한다.
- Cloudflare deploy workflows: 명시적 수동 권한, 직렬 concurrency, source contract, 고정 Wrangler 버전, Workers Logs sampling, 배포 후 health/provider smoke를 소유한다.

Pages 배포와 Cloudflare 배포는 서로 다른 권한 경계다. Pages 성공이 Worker 배포 권한을 부여하지 않으며, 로컬 PASS도 commit/push/deploy 권한을 부여하지 않는다.

## Data Refresh Boundary

시장 데이터와 screener refresh는 생성·검증·commit 후 자신이 실제 push한 SHA를 CI `workflow_dispatch` 입력으로 전달한다. 기본 `GITHUB_TOKEN` push가 후속 push workflow를 만들지 않는 GitHub 경계를 명시적 dispatch로 닫는다. CI는 market refresh에는 core/data/knowledge와 관련 browser shard, screener refresh에는 core/data와 관련 browser shard만 실행한 뒤 정확한 SHA attestation을 발행한다. Pages는 그 산출물만 배포하므로 동시 main 변경이나 같은 버전의 다른 내용이 섞이지 않는다.

## External Evidence Boundary

`architecture/worker-endpoints.json`은 endpoint와 보안 요구사항만 담는다. 과거 health 응답을 현재 사실처럼 저장하지 않는다. `scripts/build-operations-status.mjs`는 refresh 시 proxy와 fast plane health를 다시 관찰하고, provider smoke는 AI proxy 수동 배포 workflow의 blocking gate로 분리한다. 최신 관찰 시점의 전체 외부 보고서는 `.cache/aio-qa/external-pipeline-status.json`에 기록한다.

## Change Rules

1. 새 gate는 manifest group, input scope, timeout, cache policy를 선언한다.
2. 값싼 gate에 Chromium/server 시작을 넣지 않는다. `ci-qa-pipeline-contract-check.mjs`가 이를 차단한다.
3. CI workflow에 긴 gate 목록을 다시 복사하지 않는다. manifest runner만 호출한다.
4. 같은 실패가 반복되면 P entry, RULE/QA 항목과 실행 gate를 함께 닫는다.
5. 배포 후 실패는 로컬 PASS와 별도로 보고하며 자동 source 수정이나 자동 deploy로 확대하지 않는다.
