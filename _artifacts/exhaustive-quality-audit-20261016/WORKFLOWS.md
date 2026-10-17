# Actions 13개 전문 리뷰

v57.91·HEAD `0c8072d6d452cfe42bb31cfc5388cead691103c6`를 읽은 독립 검토다. 13파일2666행 전문을 읽고 called script의 관련 실패 경로를 추적했다. 실행·dispatch·배포·Cloudflare 계정 검증은 수행하지 않았다. 다음은 정적 실패 경로이며 실제 사고 이력이 아니다.

## 우선 검토할 6개 경로

**W01 · AI binding fallback의 원인 식별이 넓다.** `deploy-ai-proxy.yml:215–226`은 일반 authentication error/code10000/not authorized/permission도 Workers AI binding 오류로 취급하여 `[ai]`를 제거하고 재배포한다. 첫 요청만 일시 인증 실패하고 재시도는 성공하는 반례에서는 무관한 binding까지 제거될 수 있다. 지속적인 token 오류면 재시도도 실패하므로 항상 잘못 제거된 배포가 성공한다고 주장하지 않는다. Workers AI/binding 식별과 권한 오류를 함께 요구하거나 구조화된 특정 오류를 사용해야 한다. 현재 gate의 grep 위치·문구 검사는 이 원인 혼동을 검증하지 못한다.

**W02 · 정상 예산 차단이 코드 rollback 사유가 된다.** 같은 workflow286–305행의 유료 `/openai` smoke가 월예산 소진/일일한도/미확인 비용의 정상429에도 실패해 이전 코드로 rollback한다. 이전 코드도 동일 DO 장부를 사용하므로 예산 차단은 해결되지 않는다. 정확한 정책 error.code를 operating-blocked로 분리하고 코드 계약 실패와 구별해야 한다. 실제 청구·rollback은 관측하지 않았다.

**W03 · daily marker를 복원하나 저장하지 않는다.** `refresh-data.yml:127–165`에는 restore만 있고 전문525행에 `--write-marker`와 해당 cache save가 없다. SEC 내용이 같으면 semantic hash가 clock-only 갱신을 보존하므로 과거 marker 만료 후 매 cycle >20h로 daily lane을 반복할 수 있다. P1751의 성공 poll 간격 보존 취지가 미완성인 경로다. 검증·게시 성공 후 marker를 작성·저장하되 실패는 진전시키지 않아야 한다. 무조건 clock을 갱신해 content hash를 훼손할 이유는 없다.

**W04 · global alert pending slot에서 다른 사건이 사라진다.** `operations-alert.yml:14–20`의 단일 concurrency 그룹에서 A 실행 중 B pending 뒤 C가 도착하면 B가 취소될 수 있다. 각 실행이 자기 workflow만 reconcile하므로 B의 실패가 이후 다시 발생하지 않으면 알림을 놓친다. cancel-in-progress:false는 pending 보존 약속이 아니다. workflow ID별 그룹 또는 명시적인 queue를 검토한다. [GitHub concurrency 문서](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax).

**W05 · dispatch event SHA와 실제 tested SHA가 다를 수 있다.** producer A push와 CI dispatch 사이 다른 writer가 B push하면 `--ref main -f release_sha=A`의 event head는 B, 실제 checkout/attestation은 A일 수 있다. convergence의 head_sha=A 검색 또는 Pages의 eventSHA==expectedSHA 비교가 유효한 A attestation을 찾지 못한다. 이 문제는 미검증 배포 우회가 아니라 검증 인계 실패·지연이다. dispatch run ID와 artifact testedSha로 결속하거나 최신main으로 재수렴해야 한다. [GitHub event 정의](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows).

**W06 · 기본 converge는 settled CI failure도 초록으로 마칠 수 있다.** `scripts/ensure-live-convergence.mjs:182–211`의 기본 분기는 attestation 부재를 exit0 UNATTESTED_REVISION으로 끝낸다. --await-sha는 CI failure를 exit1로 전파하지만 No changes 뒤 기본 호출은 같은 실패를 전파하지 않는 경계가 남는다. P1897 부분 해결의 잔여로 분류한다. cancelled·실행중·관측실패를 settled failure와 구별하되 두 분기의 판정을 공유해야 한다.

## 파일별 읽은 범위와 판정

| 파일(.github/workflows/) | 전문 범위 | 판정 |
|---|---:|---|
| ci.yml | 1–210 | exact checkout·repo/run 결속·attest 타당; dispatchSHA W05 |
| data-watchdog.yml | 1–152 | 독립lane·실패재전파·증거보존; cache upload 경로는 직접 writer와 일치 |
| deploy-ai-proxy.yml | 1–328 | exactCI·main 재검사·rollback identity 존재; W01/W02 |
| deploy-data-plane.yml | 1–283 | exactSHA·변경범위·rollback; 초기KV없는 bootstrap 성공은 데이터준비 인증 아님 |
| exchange-calendar-review.yml | 1–93 | main 제한·읽기/issue권한 분리·closed 유지·title fallback |
| knowledge-build-candidate.yml | 1–67 | PR read권한·credentials미보존·임시upload·배포없음 |
| knowledge-lint.yml | 1–37 | read권한·제한시간·check; runner Node 의존은 현행실패로 단정 불가 |
| macro-calendar-review.yml | 1–94 | 공식후보→preview→증거→issue; 자동숫자 승격없음 |
| operations-alert.yml | 1–139 | 반복실패·signature dedupe; global pending W04 |
| pages-deploy.yml | 1–225 | attested staging·allowlist·retry main 재검사; W05·실패후 rollback없음 |
| refresh-data.yml | 1–525 | producer잠금·lane분리·candidate/hash·retry; W03/W06 |
| refresh-screener.yml | 1–425 | core/extended·SECstore guard·staging·CI; orphan store 장기역사 보존 별도 |
| universe-review.yml | 1–88 | main·check·review issue·closed 유지; 자동universe승격 없음 |

이전 F30의 ‘현재cron을30일 소급·dispatch전부 제외’ 지적은 cadence history와 scheduler title 식별 구현으로 수정됐다. history 조회 실패의 current-cron-backfilled는 명시된 fallback이다. P1899/P1757의 manager/SEC part 분할·50MB staging은 구현됐다. 두 과거 지적을 현재 확정 장애로 반복하지 않는다. 실제 취소 이력·계정권한·예산장부·원격SHA·배포·rollback·장기 원장 복구는 미인증이다.
