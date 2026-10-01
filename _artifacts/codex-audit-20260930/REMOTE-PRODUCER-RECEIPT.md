# 원격 producer 산출물 확인 — 2026-10-01

읽기 전용 GitHub GET 조사. 데이터는 메모리에서만 다운로드·해석했으며 로컬 데이터 수신, producer 실행, workflow dispatch, commit, push, deploy는 하지 않았다. 이 보고서만 주 담당자의 요청으로 작성했다.

## 확인된 상태

- 저장소: https://github.com/ysnle/aio-screener
- 고정 원격 main 커밋: `9896adec45cc5de78fba2af481554602f3e89c6d`
- 커밋: aio-data-bot, `2026-10-01T00:34:43Z`, `data: refresh market and news data 2026-10-01T00:34Z`
- 생산 실행: https://github.com/ysnle/aio-screener/actions/runs/36796745469
- schedule 시작 `2026-10-01T00:33:10Z`, 최종 success `2026-10-01T00:37:12Z`. integrity, continuity, reconciliation, candidate gate, commit, 정확 SHA CI dispatch, live convergence 단계 모두 success.
- 원격 workflow blob `59be2700dd2f7f6d5f5e1ea52133803f604ace3d`에도 cron `17,47 * * * *` / `13 7 * * *`, concurrency cancel-in-progress=false가 있다. 로컬만 변경된 cron으로 오인한 결과가 아니다.
- 이전 성공 실행 36775256908은 9/30 20:48:58Z→20:57:15Z, 36740391717은 15:55:21Z→15:59:35Z였다. 따라서 로컬 data.json의 9/29 23:44Z 시각은 원격 producer 전체 정지를 의미하지 않는다.

## 정확한 다운로드 근거

아래 12개는 해당 커밋에서 변경된 전체 파일이다. 고정 커밋 Git tree에서 각 SHA를 얻고, `GET /repos/ysnle/aio-screener/git/blobs/{sha}` 응답의 base64를 메모리로 복호화했다. **모두 JSON 파싱 성공, 길이 일치, SHA1(`blob <length>\0` + 원본 바이트)가 tree SHA와 일치**했다. 이는 다운로드 가능 및 원본 무결성 증거이며 현행 로컬 코드 호환성 PASS는 아니다.

| 파일 | Git blob SHA | 바이트 | 생산 시각/연결 |
|---|---|---:|---|
| public-data/data.json | `4ded4b69b712d90d32158f4b9842b35905562b7e` | 126274 | meta.generatedAt=2026-10-01T00:34:01.108Z |
| public-data/history.json | `0359587a23dc404628d2290d8fbc9d9a32cec127` | 2182528 | 420행; 마지막 date=2026-10-01, cycleEnd=2026-09-30T23:00:00Z |
| public-data/market-snapshot.json | `87b54c316f150af764fbe2b6f0e7c0eb8a26b362` | 14152 | generatedAt=2026-10-01T00:34:01.108Z; published |
| public-data/market-snapshot-status.json | `c83af1471370066f9ba280edd022de62d9e81b46` | 475 | updatedAt=2026-10-01T00:34:21.804Z |
| public-data/operations-status.json | `5a5093cf7f483aa52cf58fc9ab12b78623213013` | 17876 | generatedAt=2026-10-01T00:34:27.477Z; appRevision=v56.83 |
| public-data/reconciliation-status.json | `e8f66927991a534b70ea14c4eae43ed81801d6f7` | 63878 | generatedAt=2026-10-01T00:34:27.458Z |
| public-data/score-backtest-history.json | `5308d3eb6ed5423aac703314c16bd6f71b640ed5` | 92024 | generatedAt=2026-10-01T00:34:27.422Z |
| public-data/telegram-digest.json | `8c1d9ec2b736e493db855989d3c948fae42cfff6` | 1048422 | generatedAt=2026-10-01T00:34:34.517Z |
| public-data/atlas/index.json | `3837cbd54243730cf23f3ad977ee3ac050281d94` | 3104 | Telegram 연결 index; generatedAt 필드 없음 |
| architecture/asset-manifest.json | `3cbd6e896244ea1d3857258247ed8cefa4ee75b3` | 973 | generatedAt=2026-10-01T00:34:35.123Z; appRevision=v56.83 |
| architecture/release-manifest.json | `b4f84eec74e2d9cbf5f2939d42b63d6f0094d87e` | 857 | generatedAt=2026-10-01T00:34:35.123Z; appRevision=v56.83 |
| public-config.json | `ded2e4c40d140a0ef04e9af07347b0c1a212cfe5` | 1224 | appRevision=v56.83; AI route policy 포함 |

data/history/snapshot 및 asset/release/operations의 dataRevision은 `market-snapshot:2026-10-01T00:34:01.108Z:e00476d3`으로 연결된다. data.meta.cycleId는 `kst-0800-2026-09-30T23:00:00.000Z`, cycleStatus=PUBLISHED, cycleBlockers=[], news40, symbols78/78이다. Treasury와 AAII domain receipt는 NO_REFRESH_RETAINED를 명시한다. 최신 파일 생성은 모든 개별 원천을 새 관측으로 바꾸지 않는다.

## 실패 원인과 artifact 구분

9/30 13:37:56Z 실패 실행: https://github.com/ysnle/aio-screener/actions/runs/36723041959

- 첫 실패: step12 Validate evidence-derived 22-category reconciliation 내 `ci-data-refresh-audit.mjs`, 13:41:06.824Z exit1. 출력은 D1-structural=no, tier0=16/16, unknownSessions=0, snapshotFreshness=CURRENT, snapshotErrors=0, policyStates 모두 허용 상태였다. 뉴스 count=0이 함께 기록됐다.
- 뒤 실패: step13 candidate gate가 아직 기록되지 않은 candidate manifest를 찾지 못해 13:41:08Z exit2. 이는 앞 검증 실패 때문에 `--record`에 도달하지 않은 후속 결과다. commit 단계는 실행되지 않았다.
- 이 실행의 정확한 최종 실패 조건 하나까지는 로그만으로 확정하지 않았다. 당시 검증 코드의 snapshotReadyForPromotion은 data.meta.cycleStatus=PUBLISHED도 요구한다. 뉴스 0으로 사이클 보류되었을 가능성은 있으나 진단 JSON의 실제 내용은 다운로드하지 않았으므로 추정으로 남긴다.
- 다운로드 가능한 **진단 artifact**: id `11101326896`, name `market-snapshot-diagnostic-36723041959`, 606bytes, createdAt=2026-09-30T13:40:51Z, expiresAt=2026-10-07T13:40:51Z, expired=false. 정상 데이터 bundle로 사용할 수 없다.
- 최신 성공 실행 36796745469의 artifacts API는 total_count=0이다. 정상 producer 결과는 Actions ZIP이 아니라 원격 main의 커밋된 JSON blob에서 수신해야 한다.

cron 실제 실행 간격은 30분보다 길었다. GitHub 공식 문서는 schedule의 지연 및 고부하 시 queued job drop 가능성을 명시한다: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule . 이 저장소에서 특정 누락 실행이 왜 생겼는지는 GitHub 내부 스케줄러 증거가 없어 미확인이다. cron 설정만으로 매 30분 실행 성공을 보장했다고 보고하지 않는다.

## 수신 방법 제안과 경계

1. 위 커밋 및 blob SHA를 고정하여 별도 staging에 원본 바이트로 수신하고 Git blob SHA/길이/JSON 파싱을 검증한다. Contents API는 1MiB를 넘는 history/telegram에 제약이 있으므로 Git blobs API 또는 정확 SHA의 raw URL을 사용한다. base64 복호화한 원본 바이트를 저장하며 JSON 재직렬화로 원본을 바꾸지 않는다.
2. 시작 baseline 대비 수신 대상이 사용자 dirty 변경과 충돌하지 않는지 확인하고 일괄 교체한다. 핵심 data/history/snapshot/snapshot-status 4개만 교체하면 운영·Telegram·score cycle이 갈라질 수 있다. 이번 변경 9 public-data 파일 + asset/release를 함께 검토하는 11개 묶음이 더 안전하다.
3. public-config는 구버전 AI 정책을 포함하므로 현행 로컬 정책 위에 그대로 수신하지 않는 것을 권한다. 위 12개 목록은 변경 파일 전체 목록이지 무조건 덮어쓸 승인 목록이 아니다. metadata를 asset/release/operations 3개로 분류하면 나머지는 data 8개 + public-config 1개다.
4. asset/release/operations의 appRevision=v56.83은 현행 로컬 버전과 다르다. 원본 수신 무결성을 기록한 후, 주 담당자가 준비하는 공식 제한 정렬 모드에서 현재 버전·dataRevision 일치를 검증하고 해당 metadata만 정렬해야 한다. 생산 시각은 유지한다. operations의 세부 feature/AI/route 구조까지 최신 로컬 의도와 일치하는지는 현행 gate로 별도 검증한다.
5. 수신 후 data-refresh/data-lineage 및 cycle/operations/reconciliation 현행 검사를 수행한다. 원격 구버전 gate 성공이 로컬 최신 gate 통과를 대체하지 않는다. SLA를 완화하지 않는다.

미검증: 실제 로컬 수신/버전 정렬 결과, 수신 후 최신 로컬 QA, 특정 cron 누락의 내부 원인, 실패 진단 ZIP 내용. 본 조사에서 외부 워크플로 실행 및 commit/push/deploy는 하지 않았다.
