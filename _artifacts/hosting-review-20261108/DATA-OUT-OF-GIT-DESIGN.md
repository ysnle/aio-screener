# 데이터를 git 밖으로: 설계안 (2026-11-08, v59.80 호스팅 점검)

## 실측
- 저장소 크기: GitHub 기준 1.06GB(공개 저장소). GitHub 권장 상한은 1GB 부근이다.
- 추적 파일: 617MB.
  - `public-data` 367MB. 그중 `masters/managers` 298MB(파일 41개, 최대 33MB).
  - `_artifacts` 211MB.
- 배포하지 않는데 main에 커밋된 생산용 원본은 약 330MB다. `pages-deploy.yml`의 rsync가 빼는 대상으로, `masters/managers`, `masters/holdings.json`, `history-holdings.json`, `issuer-aggregates.json`, `sec-fundamentals-extended.json`, `telegram-observed.json` 등이다.
- 7일 동안 새 blob은 원본 2.7GB, 로컬 pack 기준 232MB다. 주된 출처:
  - `history.json` 19MB, `screener-extended` 14MB, `sec-fundamentals-extended` 11MB, `data.json` 7MB, `telegram-digest` 6MB
  - 원장 문서와 코드: `BUG-POSTMORTEM` 11MB, `CHANGELOG` 8MB, `aio-core.js` 9MB
- 원인은 시간값만 바뀌는 커밋이 아니다. 주말 커밋 표본을 보면 `data.json` 변경 747줄 가운데 시간값은 291줄뿐이다. 뉴스·시세·텔레그램처럼 실제 내용이 30분마다 큰 JSON 통째로 다시 쓰인다. 그래서 내용이 그대로인 커밋을 건너뛰는 방식으로는 줄지 않는다.
- 데이터 봇 커밋: 7일에 312건. 평일은 하루 49건 수준이다.

## 선택지
| 안 | 내용 | 효과 | 위험·작업량 |
|---|---|---|---|
| A. 생산용 원본을 data-store 브랜치로 | `sec-fundamentals.json`에 이미 쓰는 방식을 확장한다. 배포하지 않는 원본 330MB를 main 밖으로 옮긴다 | main 체크아웃과 클론 크기 −330MB, Actions 작업마다 체크아웃 수 초 단축. 이력 증가 감소는 작다(13F는 분기 단위) | 낮음~중간. 생산 스크립트 6~8개의 읽기·쓰기 경로, `recover-masters-holdings-from-shards`, 13F 검사 |
| B. 자주 바뀌는 배포 데이터를 이력 없는 데이터 브랜치로 | `data.json`·`history.json`·`screener*`·`telegram-*` 등을 커밋 하나만 유지하는 브랜치에 강제 push한다. Pages 빌드가 main 코드와 그 브랜치를 합친다 | 이력 증가의 대부분이 사라진다(주당 압축 수십~100MB 이상) | 높음. CI 배포 증명(release-source, reduced scope), 브라우저 검사용 고정 데이터(데이터 커밋 sha 기준), 로컬 개발의 `public-data` 읽기, 감시 검사, 데이터 계약 검사를 모두 다시 설계해야 한다 |
| C. main 이력 재작성(squash) | 오래된 데이터 커밋을 정리한다 | 즉시 용량이 줄어든다 | 공유 이력 강제 재작성이라 다른 세션·클론·PR이 모두 깨진다. 권하지 않는다 |

## 권장
1. A를 먼저 별도 배치로 진행한다. 위험이 낮고, 모든 Actions 작업의 체크아웃 비용을 바로 줄인다.
2. B는 저장소가 2GB에 가까워질 때 단독 배치로 설계한다. 지금 증가 속도(압축 주당 약 100~230MB)라면 대략 4~8주 뒤다. CI 배포 증명과 고정 데이터 구조를 함께 바꿔야 해서, 다른 작업과 섞지 않는다.
3. C는 쓰지 않는다.

## 진행 (v59.82, 2026-11-08)
- A를 13F 운용사 원본 `public-data/masters/managers/`(파일 41개, 285MB)부터 적용했다. 330MB 중 86%다. 최근 60일 동안 이 폴더의 새 blob만 압축 약 250MB여서, 체크아웃 크기와 이력 증가를 함께 줄이는 몫이 가장 크다.
- 파일은 고아 브랜치 `masters-store`에 커밋 하나로 둔다. 갱신 때마다 강제 push하고, 그 부모 커밋은 main이 직전에 가리키던 트리를 담는다. main에는 매니페스트 `public-data/masters/managers-store.json`(git 트리 ID, 파일별 바이트와 sha256, 운용사별 접수번호·행 수)만 남는다. 스크립트는 `scripts/masters-managers-store.mjs`(manifest·check·restore·publish)다.
- 13F 전체 체인은 시작할 때 `restore --require`로 main이 가리키는 트리를 받고, 끝에 매니페스트를 다시 쓴다. 커밋 단계는 매니페스트가 바뀌면 main push 전에 저장소를 먼저 발행한다. 13F 단계가 실패하면 반쯤 다시 쓴 폴더를 지운다.
- 계약 검사(`ci-masters-contract-check`)는 holdings의 운용사별 설명을 항상 매니페스트와 대조한다. 행 내용은 로컬 폴더가 매니페스트 트리와 같을 때만 읽는다. 생산 커밋(--staged)에서는 일치해야만 통과하고, 원본이 없는 CI·새 작업 트리에서는 SKIP을 표시한다.
- 남은 producer-only 파일은 main에 그대로 둔다. `holdings.json`·`history-holdings.json`·`issuer-aggregates.json`은 합계 22MB이고, CI 검사 여러 개가 직접 읽는다. `sec-fundamentals-extended`·`telegram-observed`는 30분마다 생산 스크립트가 읽고 쓴다. 옮기는 비용에 비해 얻는 것이 작다.

## B 설계 검토 (2026-11-08, 구현 전 소유자 승인 단계)

### 1. 실측: 최근 14일 이력 증가 (압축 기준)
- 측정 방법: 각 주에 새로 생긴 객체(`git rev-list --objects <끝> --not <시작>`)를 경로별로 묶고, 묶음마다 `git pack-objects --window=50 --depth=50`로 압축한 바이트를 쟀다. 주 시작 전의 기준 객체를 쓰지 않으므로 실제보다 조금 크게 나오는 상한값이다. 스크립트는 `_artifacts/hosting-review-20261108/measure-history-growth.mjs`다(저장소 루트에서 실행).
- GitHub 저장소 크기: 1,069,883KB(약 1.02GiB).

| 묶음 | 14~7일 전 (506커밋) | 최근 7일 (600커밋) |
|---|---|---|
| `_artifacts` | **181.6MB** | **55.2MB** |
| `public-data` 배포분 (B 대상) | 22.7MB | 24.2MB |
| `public-data` 생산 전용 (`telegram-observed`·`score-backtest-history`·`sec-fundamentals-extended` 등) | 13.0MB | 11.8MB |
| 코드·원장 문서·생성 매니페스트·커밋/루트 트리 | 8.7MB | 9.8MB |
| 합계 | 226MB | 101MB |

- 이력 증가의 주원인은 데이터 봇이 아니라 `_artifacts`의 PNG/JPG 검토 스크린샷이다. 14일 동안 새 `_artifacts` blob은 원본 기준 PNG 245MB(2,101개)와 JPG 8MB였다.
  - 14~7일 전의 큰 몫은 로컬 게이트 실행이 추적 중인 증거 PNG를 매번 다시 쓴 것이었다. `responsive-browser` 916개 101MB, `entity-quality` 627개 73MB가 여기에 해당한다. 86c00b6c(11-02)에서 멈췄다.
  - 최근 7일에도 `wave2-d/screens` 30MB 등 검토 스크린샷이 약 45MB 커밋됐다.
- 위 설계안 첫 부분의 "7일 압축 232MB, 주로 데이터"는 이번 측정과 맞지 않는다. 그 232MB의 대부분은 `_artifacts`였다.
- B가 줄이는 몫은 최대 주당 약 24MB다. 생산 전용 고빈도 파일까지 옮겨도 약 35MB(연 1.2~1.8GB)다. 이것은 전체 증가의 25~35%에 그친다.
- Actions 체크아웃은 depth 1이고, reduced-scope 실행만 `blob:none`으로 커밋과 트리를 받는다. 따라서 이력이 커져도 30분 생산 작업은 거의 느려지지 않는다. 이력 증가가 실제로 드는 비용은 GitHub 저장소 크기(권장 1GB, 강력 권장 5GB 미만)와 로컬 클론 크기다.

### 2. B를 구현한다면: 코드 기준으로 바꿔야 하는 곳
대상은 봇이 30분마다 쓰는 파일이다. 근거는 `refresh-data.yml` 커밋 단계의 `stage_if_exists` 목록, `refresh-screener.yml`, `event-briefs.yml`이다. 14일 동안 400~670판이 쌓인 파일은 `operations-status`·`reconciliation-status`·`history`·`telegram-digest`·`data`·`market-snapshot*`·`macro-*`·`scenario-state`·`today-verdict`이고, `market-day`는 178판이다. 이 데이터를 고아 브랜치 `live-data`의 커밋 하나에 두고 매번 강제 push한다. `masters-store`처럼 부모는 직전 트리만 둔다. main에는 매니페스트(트리 ID, 파일별 blob과 sha256)만 남긴다.

1. **CI 배포 증명** (`ci.yml` preflight·contracts·attest, `resolve-release-source.mjs`, `build-data-overlay.mjs`)
   - 지금은 "릴리스 = main 커밋 하나"다. `testedSha`, 첫 부모 이력의 treesame 규칙(P1952), `OVERLAY_GENERATED_PATHS`, 오버레이 모드가 모두 데이터와 코드가 같은 커밋 이력에 있다는 전제 위에 서 있다.
   - B에서는 릴리스가 (코드 sha, 데이터 트리 ID) 두 값이 된다. 그래서 `aio-release-attestation.v1`을 v2로 바꿔 `dataTreeId`를 넣는다. `resolve-release-source`의 treesame 탐색은 필요 없어지고, "가장 최근 녹색 코드 + 최신 데이터"가 기본이 된다. 오버레이 모드는 사라진다.
   - 데이터 계약(`core`·`data`·`knowledge` 그룹)은 데이터 커밋을 main checkout 위에 풀어놓고 돌려야 한다.
   - CI 트리거도 바뀐다. 데이터 push는 main push가 아니므로 `workflow_dispatch(origin, data_tree)` 경로만 남는다.
2. **라이브 수렴** (`ensure-live-convergence.mjs`)
   - 지금은 `origin/main` sha → 그 sha의 CI 실행 → 라이브 `deployment.json.sourceSha` 비교다.
   - B에서는 목표가 (main sha, live-data 트리) 쌍이다. 비교 키는 `deployment.json`에 `dataTreeId`를 더해 둘로 늘린다. `--await-sha` 계약과 "이전 데이터 리비전 실패" 판정(`earlierFailure`)도 데이터 트리 기준으로 다시 써야 한다.
3. **`pages-deploy.yml`**
   - "검증된 sha 하나를 checkout → rsync 허용 목록" 구조에 live-data 트리 가져오기 단계를 더한다.
   - P1351 재확인("main head가 바뀌었으면 배포 건너뜀")은 main head와 live-data head를 둘 다 보도록 바꾼다. 그러지 않으면 데이터만 바뀐 지연 배포가 새 데이터를 덮어쓴다.
   - 데이터가 30분마다 강제 push되므로, 배포 직전 비교가 지금보다 자주 "건너뜀"이 된다. 연속 갱신 때 라이브가 계속 한 박자씩 밀리지 않도록, 건너뛴 쪽이 다음 배포를 확실히 넘겨받는지 다시 검증해야 한다.
4. **브라우저 고정 데이터** (`architecture/browser-data-fixture.json`, `browser-data-fixture.mjs`, `watchdog-browser.yml` repin)
   - 지금은 main의 데이터 커밋 sha를 고정하고, CI가 `git fetch --depth=1 origin <sha>`로 받는다.
   - live-data 브랜치는 이력을 지우므로, 고정한 커밋이 다음 강제 push 뒤 도달 불가가 되어 GC 대상이 된다. 그러면 고정 데이터를 다시 만들 수 없다.
   - 그래서 고정 데이터는 sha 대신 내용 자체를 보존해야 한다. 별도 `fixture-store` 브랜치나 Release asset이 필요하고, repin 작업은 그 저장소에 쓰도록 바꾼다. `clock`은 데이터 커밋 시각에서 매니페스트의 시각으로 바꾼다.
5. **생산 단계의 커밋·push** (`refresh-data`·`refresh-screener`(core·extended 두 번)·`event-briefs`, 13F 체인)
   - 생산 작업 넷이 같은 live-data 브랜치를 강제 push한다. 지금 main에서 rebase로 합치던 "서로 다른 파일만 쓰는 동시 생산"은, 강제 push 단일 커밋에서는 마지막 쓰기가 이기는 문제로 바뀐다.
   - 그래서 다음이 필요하다: `--force-with-lease`, 원격 최신 트리 위에 자기 파일만 덮어 다시 만들기, 재시도. `masters-store`는 13F 체인만 쓰기 때문에 이 문제가 없었다.
   - `operations-status.json`은 14일 동안 사람 커밋 136건이 함께 쓴 공유 파일이다. bump-version·record-fix가 revision을 찍는다. 이 파일은 main에 남기거나 둘로 나눠야 한다.
   - `public-config.json`과 `architecture/*-manifest.json`도 생산 단계가 함께 쓰므로 같은 분리가 필요하다.
6. **rebase·충돌 재시도**
   - `collision_retry`와 `verify-refresh-candidate --expect-commit`의 "rebase한 트리가 검증한 후보와 같다" 검사는 대상을 live-data 트리로 바꿔야 한다.
   - main과의 충돌은 사라지지만, 생산 작업끼리의 lease 충돌이 그 자리를 차지한다.
7. **로컬 개발** (`start-local-node.mjs`, 스크립트 211개, src/js 71개가 `public-data/`를 읽는다)
   - 깨끗한 main 체크아웃에는 고빈도 데이터가 없게 된다. 그래서 `restore --require` 같은 단계를 로컬 서버 시작, `qa-runner`, 모든 세션 준비에 넣어야 한다.
   - 그 동안 `public-data/data.json`은 추적되지 않는 파일이 된다. `.gitignore`, "commit-all이 다른 작업을 쓸어 담는" 문제(P1977)와도 다시 맞춰야 한다.
8. **감시·최신성 게이트** (`data-watchdog.yml`, `freshness/refresh-data.json`, `liveData: content` 게이트)
   - 대부분 라이브 URL이나 checkout의 `public-data`를 읽는다. checkout 쪽은 7과 같은 복원 단계가 필요하다.
   - `operations-slo-window`는 Actions 실행 기록을 읽으므로 영향이 없다.
9. **검토와 되돌리기**
   - 지금은 데이터 변경이 main 커밋이므로 `git log -p -- public-data/data.json`으로 보고 `git revert`로 되돌린다. 데이터가 원인인 사고 분석도 이 이력을 쓴다(예: P1977·P2195).
   - B에서는 직전 한 판만 남는다(부모 커밋). 그보다 앞선 데이터는 Pages 배포 artifact(보존 기간이 짧다)나 별도 보관이 없으면 사라진다.
   - 되돌리기는 "이전 트리를 다시 강제 push"하는 새 스크립트가 맡는다. 사고 분석에 쓰던 이력 보기는 주간 스냅샷 태그 같은 보완이 없으면 잃는다.

예상 작업량: 워크플로 6개, 스크립트 6~8개, attestation 스키마 v2, 새 store·fixture-store 스크립트, 그리고 각각이 옛 코드에서 실패하는 게이트. v59.78 오버레이와 v59.80 re-pin 규모를 합친 것보다 크다. 실패하면 라이브 데이터가 멈춘다. 이것이 소유자가 가장 큰 문제로 꼽은 위험이다.

### 3. 판단: 지금은 B를 할 가치가 없다
- B가 줄이는 몫은 주당 약 24~35MB로, 전체의 25~35%다. 그 대가로 배포 증명·수렴·고정 데이터·생산 4개의 동시성 모델을 한꺼번에 바꾸고, 데이터의 이력 검토와 revert를 잃는다.
- 같은 위험을 지금 감수할 만큼 저장소가 급하지 않다. 1.02GiB에서 GitHub 강력 권장선 5GB까지 남은 여유는 아래 1번만 해도 주당 약 50~60MB 증가 기준 1년 이상이다.

권장하는 더 싼 대안 (작은 것부터):
1. **`_artifacts` 스크린샷을 커밋하지 않는다** (가장 효과가 크다. 최근 주 약 45MB, 앞선 주 약 180MB)
   - `_artifacts/**/*.png`·`*.jpg`를 기본으로 무시한다. 남겨야 하는 작은 참조 이미지만 허용 목록에 둔다.
   - 검토 스크린샷은 git 밖 로컬 폴더나 Actions artifact로 보낸다.
   - 게이트를 하나 둔다. staged나 push 범위에서 `_artifacts` 아래 새 이미지 blob이 생기거나 커밋 하나에 `_artifacts` blob이 N MB를 넘으면 실패한다(옛 코드의 wave2-d 커밋에서 실패해야 한다).
   - 이 일은 기록 원장·생산 경로를 건드리지 않는다.
2. **로컬 저장소 정리** (저장소 변경 없음)
   - 로컬 `.git`에는 압축되지 않은 loose 객체 2.54GiB와 pack 81개가 있다. `git gc`나 `git maintenance run --task=gc`로 줄인다.
   - 새 클론과 클라우드 세션은 `--filter=blob:none`으로 받는다. 과거 데이터 blob은 필요할 때만 내려받는다.
   - 질문에서 든 sparse checkout·fetch 필터 방식이 이것이다. 저장소 이력은 그대로 커지지만 체크아웃·클론 비용은 사라진다.
3. **고빈도 데이터는 main에 그대로 두고 B 착수 조건만 정한다**
   - 조건 예: GitHub 크기가 2.5GB를 넘거나, 1번 이후에도 4주 평균 압축 증가가 주당 100MB를 넘을 때 B를 단독 배치로 연다.
   - 그때는 위 2절의 1~9를 그대로 구현 범위로 쓴다.

### 승인 요청
- (권장) B를 보류하고, 대안 1(`_artifacts` 이미지 커밋 중단 + 게이트)과 대안 2(로컬 정리 안내)를 진행한다.
- 또는 위 2절대로 B를 구현한다.

### 결정 (2026-11-08, v59.83)
- 소유자가 B 보류와 대안 진행을 승인했다.
- 대안 1을 v59.83에 넣었다. `_artifacts` 이미지는 `.gitignore`가 막는다. 추적 중인 1,119개는 `architecture/artifact-image-baseline.json`에 고정했다. `scripts/ci-artifact-image-check.mjs`(workspace 그룹)가 새 이미지나 다시 쓴 이미지에서 실패한다.
- 대안 2(로컬 `git gc`, 새 클론 `--filter=blob:none`)는 저장소 변경이 없는 안내로 남긴다.
- B는 저장소가 2.5GB를 넘거나 4주 평균 증가가 주당 100MB를 넘을 때 다시 연다.
