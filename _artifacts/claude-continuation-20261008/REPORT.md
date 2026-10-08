# v57.28·v57.29 이후 점검과 구조 개선 이어받기

작업일 2026-10-08, 클라우드 세션(브랜치 `claude/eloquent-davinci-lyqv2b`). 기준은 `origin/main` `7d57d21`(v57.27 + 데이터 갱신 커밋).
로컬 `C:\Projects\AIO`의 미커밋 v57.28·v57.29는 이 저장소에 없다. 그 코드는 확인하지 못했고, 업로드된 문서로만 읽었다.

## 1. 먼저 알아둘 것

- v57.29 신규 파일 3개(`src/app/compatibility-events.js`, `src/ai/response/publication.js`, `scripts/fixtures/architecture-lifecycle-regressions.mjs`)가 저장소에 없다. 로컬 전용이다.
- 이 브랜치는 `bump-version`·`record-fix`를 실행하지 않았다. 로컬이 v57.28·v57.29, P1510~P1519, R683~R690을 이미 써서 ID가 충돌하고, `record-fix`는 R번호 공백도 막는다. 원장 기록은 같은 폴더의 초안 JSON으로 남겼다.
- 콘텐츠 변경(H88 등)과 `fetch-data.mjs`·`fetch-telegram-digest.mjs` 수정은 하지 않았다. v57.28이 뉴스·텔레그램 생산 로직을 바꿨고, 그 파일 목록을 모르기 때문이다.

## 2. 업로드 문서의 주장을 이 저장소에서 대조한 결과

| 주장 | 결과 |
|---|---|
| 정적 모듈 277개, 로컬 edge 467개, cycle 0 | 기준선은 274개·464 import·cycle 0(동적 리터럴 import 21개 포함해도 0). 차이 3개는 v57.29가 추가한 모듈로 보이나 확인 불가 |
| 쓰이지 않는 helper 후속 검토 | 맞다. 진입점에서 도달 불가한 모듈 21개가 있지만 모두 CI 스크립트가 직접 import한다. 삭제 금지 |
| v57.29를 막은 `data-refresh`·`data-lineage` 최신성 실패 | 해소됐다. 10/8 14:07Z 라이브 기준 데이터 37분, 스크리너 8분, 텔레그램 36분. 봇이 계속 갱신 중 |
| 배포본은 아직 v57.27 | 맞다. 라이브 `version.json`과 `deployment.json` 소스 SHA 일치(7d57d21) |

## 3. GitHub 실행 이력에서 나온 결함

**Pages 배포가 #161~#169까지 9번 연속 실패했다. 산출물 문제가 아니다.** 마지막 성공은 #160(10/7 13:59Z)이다.
라이브는 v57.27이고 데이터도 신선하다. 실패한 것은 배포 후 검증 `proxy-source-revision` 하나다(라이브 프록시 Worker v57.24, 소스 v57.27).

원인 사슬:
1. 10/7 13:54Z v57.25~27이 병합 푸시로 들어왔다(CI #1682 성공).
2. 같은 시각 데이터 봇이 `main`을 앞서 나가게 했다(`2b7da10`).
3. `Deploy AI proxy` #53은 CI가 검증한 SHA와 `main` HEAD가 다르다는 이유로 모든 배포 단계를 skipped 처리했다.
4. 봇의 CI는 `GITHUB_TOKEN` 디스패치라 `workflow_run` 이벤트가 없다(R606). 그런데 Worker 배포 워크플로를 다시 돌려 줄 구동자가 없다. `ensure-live-convergence.mjs`는 Pages만 디스패치한다.
5. 그래서 누적 diff로 수렴시키는 기존 로직이 다시 실행될 기회가 없었다.

**워치독은 55번 연속 실패 중이다.** 10/8 09:09Z 런에서 실패한 게이트는 `external-pipeline` 하나뿐이다(통과 10, 실패 1). 9/26부터의 연속 실패 전체가 같은 원인인지는 확인하지 못했다. 앞선 구간의 로그가 만료됐다. SLO 창은 별개의 구조 문제다. 7일 안에 워치독 스케줄 런이 30회뿐이라 도착률이 0.18이고, 목표는 0.9다. 실패가 없어도 PASS할 수 없다.

## 4. 이번 변경

- `scripts/worker-deploy-impact.mjs`: `getMainAdvanceWorkerChanges` 추가. `shouldDeployWorker`는 더 새로운 `main`이 (a) 테스트 SHA의 후손이고 (b) 사이 커밋이 해당 plane의 배포 입력을 건드리지 않았을 때만 stale로 보지 않는다. 증거가 없거나, 후손이 아니거나, git 오류면 기존처럼 건너뛴다. 직전 가드용 `--main-advance` CLI도 추가했다.
- `.github/workflows/deploy-ai-proxy.yml`, `deploy-data-plane.yml`: 판정 단계와 변경 직전 가드가 같은 분류기를 쓴다. 새 `main`을 fetch하고, 정확한 HEAD 일치 bash 비교를 없앴다. **push 전용 CI 출처 게이트(R674)는 바꾸지 않았다.**
- `scripts/ci-cloudflare-deployment-contract-check.mjs`: P1351 단언 10개 추가.
- `scripts/ci-control-char-check.mjs`: 허용 목록에 `★ ☆ ☰` 추가. 이 게이트는 Node 20.20.2(Unicode 17)에서는 통과하고 Node 22.22.0(Unicode 16)에서는 ★(U+2605)·☰(U+2630)를 이모지로 판정해 preflight를 막았다. 진짜 이모지는 두 환경에서 똑같이 계속 걸린다.

검증:
- 새 단언은 수정 전 구현에서 실패한다.
- 실제 사고 커밋 쌍으로 재현했다. 테스트 SHA `d947723`에 `main`이 `2b7da10` 또는 오늘 HEAD이면 두 plane 모두 `true`. v57.24에서 `d947723`는 Worker 입력이 바뀌었으므로 `aiProxy=false`.
- 아직 검증하지 못한 것: 변경된 워크플로의 실제 GitHub Actions 실행, Cloudflare 배포. 로컬 fixture가 대신하지 않는다.

## 5. Codex 푸시 이후 순서

1. `git fetch origin && git merge origin/main`으로 이 브랜치에 병합한다. v57.29 변경 목록에는 위 파일들이 없다. v57.28 쪽은 목록을 몰라 확인 필요.
2. `bump-version v57.30` 후 `record-fix`로 초안 JSON 2개를 기록한다(ID는 자동 할당). `generate-workspace-state --write` 실행.
3. 푸시한 뒤 `Deploy AI proxy`와 `Deploy fast data plane` 런에서 `Deploy canonical Worker` 단계가 실제 실행됐는지 확인한다. 이 수정이 `main`에 들어가기 전에 푸시한다면 같은 stale skip이 다시 나올 수 있다. 그때 프록시가 v57.24에 머물면 Pages도 다시 red가 된다.
4. 이슈 #4(워치독)는 프록시가 수렴하기 전에는 닫지 않는다.

## 6. 남은 구조 과제

| 우선 | 항목 | 근거와 메모 |
|---|---|---|
| 곧 | `knowledge-lint` P1125 | 오늘 `_context` 문서 4개가 `last_verified` 45일 임계를 넘겨 실패(기준선 1, 현재 4): `CLAUDE.md`(46일), `KNOWLEDGE-BASE.md`(46일), `WORKFLOW-GOVERNANCE.md`(46일), `RESEARCH-INTEGRATION-AI-INFRA-MARKET-RISK-2026-08-22.md`(47일). 앞의 3개는 v57.29 변경 목록에 있어 푸시로 풀릴 가능성이 크다. 마지막 1개는 목록에 없으므로 소유자 검토가 필요하다. 검토 없이 날짜만 갱신하지 않았다 |
| 결정 필요 | 워치독 SLO 목표(도착률 0.9) | 스케줄이 하루 약 5회라 달성 불가. cron 빈도나 목표 재정의 필요 |
| 병합 후 | H88·H89 산업 지도 관계 종류 | 레지스트리에 공급 관계 진술이 없고 `relation/kind` 필드도 없다. `taxonomyNodeIds`는 유지하고 병렬 필드(`nodeLinks`)를 추가해야 `ci-atlas-contract-check`·`reconcile-atlas-taxonomy` 등이 안 깨진다. 근거 없는 라벨은 금지이므로 출처 확인이 먼저. 별개로 제품·플레이어 노드 불일치 2건(`sandisk-hbf-roadmap`, `samsung-hbm-family`) |
| 병합 후 | 시장 시간 모듈 위치 | `src/ai/time/market-session.js`(import 0개, NYSE·KRX 달력)를 `src/domain` 3곳이 쓴다. `src/domain/market/session-time.js`와 개념이 중복되고 `js/aio-core.js:18118`에 parity 사본이 있다. 순수 모듈을 domain으로 옮기고 AI 쪽엔 재export만 남기는 것을 권고 |
| 병합 후 | 같은 종류 결함의 남은 인스턴스 | 평문 `writeFileSync`로 공개 JSON을 쓰는 곳: `fetch-telegram-digest.mjs:573,583`, `sync-data-release-manifests.mjs`, `reconcile-atlas-taxonomy.mjs`, `resolve-13f-prior-filings.mjs`. 본문 대기에 타임아웃이 없는 곳: `fetch-data.mjs:139-163`(CI 정지 위험), `personal-transport.js:92-95`(브라우저, 영향 작음) |
| 낮음 | 쓰이지 않는 export 36개 | 선언 외 참조 0. 예: `evaluateSearchClaim`, `canUseEvidence`, `selectEvidenceMap`, `findSavedScreen`, `runDefaultScreens`, `createExplanationIndex`, `src/state/selectors/*`. v57.28·29가 호출자를 추가했을 수 있어 병합 후 다시 grep |
| 기존 | v57.28 남은 항목 | `CLAUDE-RESPONSE-v57.28.md`의 "남은 항목"과 13F 단위 이상 3건 결정은 그대로 남아 있다. 이번에 건드리지 않았다 |

미검토: Dependabot PR #7·#8·#13(열림), 월간 검토 이슈 #16·#17.
