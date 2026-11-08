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
