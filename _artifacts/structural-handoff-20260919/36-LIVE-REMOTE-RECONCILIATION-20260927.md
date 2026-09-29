# v56.54 로컬·실배포·원격 CI 대조 — 2026-09-27

이 문서는 [35 구현 교차점검](35-FINAL-IMPLEMENTATION-CROSSWALK-20260926.md)에 9/27의 반증을 추가한다. 시각은 KST로 적되 원본 UTC timestamp를 함께 보존한다. 브라우저 방문, 로컬 자동 검사, 원격 GitHub Actions, 공개 Pages는 다른 증거다. 현재 작업 트리는 미커밋이다.

## 결론과 세대

| 대상 | 직접 확인한 사실 | 판정 |
|---|---|---|
| 공개 Pages | 9/27 11:00 KST `/deployment.json`: `sourceSha=fc75c775467001af6c1781cfc150c286b5a14806`, `appRevision=v56.33`, `deployedAt=2026-09-26T01:41:02.613Z` | v56.52 푸시는 있었지만 v56.54 로컬 코드와 v56.52 배치는 사용자에게 서빙되지 않음. [공개 배포 증거](https://ysnle.github.io/aio-screener/deployment.json) |
| GitHub CI | `cd4d8ca7` CI는 version/operations 계약 실패, Pages hand-over skipped. 이후 `6cc40b3f` CI #1570은 browser runtime/viewport 2 job 실패·attestation skipped | “푸시 성공=배포 성공”이 아님. [CI #1570](https://github.com/ysnle/aio-screener/actions/runs/36224407829) |
| 원격 데이터 갱신 | 9/26 20:49 KST 이후 9/27 09:37 KST #1458까지 최신 목록의 6회 연속 refresh 실패. #1458의 `D1-structural=no`, `attempt=failed`, 기존 market snapshot 9/26 15:38 KST 유지 | 데이터 소비자는 마지막 정상 발행과 실패 시도를 구분해야 함. [refresh #1458](https://github.com/ysnle/aio-screener/actions/runs/36283075657) |
| 원격 main / 로컬 | 원격 `28801f63`까지 screener 데이터 커밋이 네 개 진행, 로컬 HEAD `cd4d8ca7`은 4 behind. 로컬 v56.54는 dirty 작업 트리 | rebase/커밋 후보/원격 CI를 거치지 않았으므로 로컬 PASS를 출시 인증으로 사용 불가 |
| PR 운영 | 9/27 공개 목록에서 [#7 Actions 8종](https://github.com/ysnle/aio-screener/pull/7)·[#8 CI toolchain 2종](https://github.com/ysnle/aio-screener/pull/8)이 열린 상태 | 직접 main 코드 작업과 의존성 PR 리뷰가 분리돼 있다. 병합 가능성과 회귀 영향은 PR별 CI/변경 diff를 별도 검토해야 함 |

## 원격 refresh의 정확한 차단 지점

전달받은 감사에서 E3 FOMC·E4 정책금리가 7/29 관측으로 60일 STALE였다는 것은 맞았다. 그러나 **그 항목이 #1458을 중단시켰다는 인과는 틀렸다.** 원격 로그의 E3/E4 줄 다음에는 `D1-structural | no | rows=22 unknownSessions=0 tier0=16/16`가 나오며 `ci-data-refresh-audit.mjs`의 종료 조건은 `snapshotAudit.currentCyclePublished`였다. 그 시도의 `market-snapshot-status`는 `attempt=failed`; 어떤 종목의 어떤 quality가 거부됐는지는 원격 로그에 출력되지 않았다. 기존 발행 snapshot의 timestamp가 18시간 전이라는 사실만으로 거부 종목을 추정하지 않는다.

P1275는 [Fed의 9/16 공식 결정](https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm)과 현재 런타임 레지스트리의 3.75–4.00%·10/28 다음 회의를 결속해 E3/E4의 독립적인 낡은 7/29 날짜를 제거했다. `ci-data-refresh-audit`는 이제 같은 레지스트리와 캘린더 날짜를 대조한다. P1276은 다음 원격 실패부터 `snapshotErrors`를 출력한다. **실제 Tier-0 실패 품질 원인 수정은 개별 오류가 관측될 때까지 OPEN**이다. B2 NAAIM/B3 Investor Intelligence는 유료 접근 경계로 계속 BLOCKED이고 이를 가짜 신선 데이터로 채우지 않는다.

## 20 라우트 사용자 화면 대조 범위

9/26 공개 v56.33과 로컬 v56.53에서 원본 라우트 레지스트리의 20개 라우트를 각각 방문해 화면 제목, 첫 화면 핵심 텍스트·상태·보류 이유를 읽었다. 9/27 새 로컬 v56.54에서는 아래 확정 반증의 수정 화면을 재방문했다. 이 표는 **화면 방문/대표 문구**의 증거이지, 각 페이지의 모든 접기/필터/모달, 개별 기사 원문, 금융 숫자, 저장 상태, 모바일·스크린리더 과업을 전수 인증한 결과가 아니다.

| 라우트 | 방문 시 사용자 관점 대조·미해결 인수 |
|---|---|
| home | 공개 헤드라인에 해석성 요약이 남음. 로컬 v56.54는 원제목·원문 링크, “헤드라인 전용·본문 미검증”, 선별 점수 뜻을 표시. 홈 점수는 필수 입력 미수신 보류. |
| briefing | 로컬 시장 스냅샷·뉴스·판정 보류/출처 표시 확인. 같은 데이터 컷의 시세·매크로·AI 문장 대사는 미완. |
| market-news | 공개 분석 가능 9건 vs 로컬 헤드라인 본문 적격성 보류. 전체 기사 원문 entailment·권리는 미인수. |
| signal | 로컬 점수/체크리스트 결측 보류. P1275 후 CP2의 Fed 목표범위 3.75–4.00%(9/16)를 브라우저에서 확인. 6 preset 사용자 과업은 미인수. |
| breadth | 로컬 5/20/50SMA·분모·관측시각, 50SMA 35.5% 확인. 공식 exchange A/D와 McClellan은 별도 원천 대기. |
| sentiment | 관측값과 참고/보류 라벨 표본 확인. 유료 설문 숫자와 현재값 전환 미인수. |
| technical | 선택 종목 없을 때 보류. 기업행동·4h/1d 독립 연구 미인수. |
| macro | 필수 SPY 결측으로 행동 판정 보류. 경제 지표의 서로 다른 관측일과 정책 결정 범위 대사는 계속 필요. |
| fxbond | 환율/채권 표본 시각 차이 확인. USD/KRW 일별 이력·공식 FX 대조의 정식 발행 인수 미완. |
| themes | 로컬 v56.54에서 Breadth와 같은 50SMA 35.5%를 읽음; RRG는 상대 이력 부족으로 보류. “경기 사이클/확장”은 시장폭·VIX·가격의 대리 해석이며 경기 순환의 실증 인증이 아님. |
| theme-detail | 상세 진입·요약 경계 방문. 14종 상세/11종 요약 각각의 수치·원천·링크 전수는 미완. |
| screener | 로컬 universe 873/필드 준비 705/통과 286/결측 166 표본, 모델 검증 BLOCKED. quote tick 전 신규 행 “미수신”의 제품 경계와 원격 CI fixture를 구분해야 함. |
| fundamental | 선택 종목 없는 보류; SEC 회사별 amount/unit/PIT 원행 대사 미완. |
| ticker | 종목 미선택 상태 방문. 선택·전환·same-route viewState 원자성 미인수. |
| options | 현재 원천/해석 가능 범위 표본 방문. 실제 chain·OI·IV·권리 대사 미완. |
| portfolio | 빈 로컬 포트폴리오와 저장 경계 방문. PIN·복원·통화·시세 실패 전체 수명주기는 로컬 E2E/실사용 과업 분리. |
| principles | 비동기 본문 로드 확인. 112개 원고의 원전/반례/8경로 의미 검수는 미완. |
| masters | SEC 카탈로그·준비 중 상태 확인. 37 managers/193,200 rows의 원행 amount/unit oracle 미인수. |
| atlas | 비동기 지도 콘텐츠 표시 확인. 층별 placement·직접 출처 전수 미인수. |
| guide | 공개 v56.33의 옛 점수 60/40 및 근거 없는 breadth 200일/설문 안내와 로컬 5구간/실제 5·20·50 가용성 문구를 대조. 사용자 이해도 시험은 미완. |

## 구조 개편의 실제 진척

20개 라우트의 lifecycle/renderer/data owner는 `architecture/route-owners.json`에 정의되어 있고, 퇴역 writer와 no-op UI의 일부는 P1260·P1268 등으로 제거했다. 그러나 경로별 실소유는 균일하지 않다. 이 감사에서 chart는 native 8·legacy 8·해당 없음 4, narrative는 native 2·legacy 14·해당 없음 4였다. `src/app/router.js`의 동일 route/entity 전환은 `viewState` 갱신을 생략하고, `src/legacy/compatibility-facade.js`의 `showPage` 부작용은 router 전환보다 앞선다. E0의 원자적 전환·legacy 책임 회수는 OPEN이다. 따라서 “구조 개편이 진행됐다”는 사실과 “전체가 이상적 native 구조로 통합됐다”는 인증을 구분한다.

## 이번 로컬 보강과 증거 원장

- P1273·P1274·P1275는 각각 홈 헤드라인 의미, native breadth→Themes 일치, FOMC 정책 범위의 이중 작성 경로를 고쳤다. 이들은 단순 계약 추가가 아니라 `js/aio-data.js`·`js/aio-core.js`의 실제 사용자 화면 렌더링 변경이다.
- P1276은 실패 원인 관찰 가능성을 높였으며 현재 원격 refresh를 통과시킨 것으로 선언하지 않는다.
- P1277은 접근성/portfolio vault 브라우저 보고서에 revision/SHA를 기록한다. v56.54에서 portfolio vault 28/28, 20라우트 접근성 구조 PASS(뉴스 링크 24px 보강 후), route-soak 20라우트×3회 PASS, boot `PASS/TARGET_COMPLIANT`, architecture 20라우트 PASS, viewport 20라우트×3폭·overflow/JS error 0을 로컬 Chromium으로 재측정했다. 모두 `gitHead=cd4d8ca7`, dirty checkout의 측정이므로 `public-readiness`의 route-soak=PENDING, boot=REMEASURE_REQUIRED를 release PASS로 자동 승격하지 않는다.
- 현재 작업 세션 `affected`는 86 PASS·1 FAIL·31 SKIP이다. `data-lineage` FAIL은 체크인 `data.json`·`market-snapshot.json`의 9/26 01:35Z 컷이 각각 12h·24h 신선도 한계를 넘어서 발생했고, 그 선행 실패 때문에 headless/브라우저 묶음이 SKIP됐다. 독립 실행한 headless는 **1147/1147 PASS**였다. 다음 원격 refresh의 Tier-0 실패를 해결하지 않은 채 데이터 파일 timestamp나 readiness를 수동으로 올리지 않는다.
- readiness의 live-revision 문구를 9/27 실제 `/deployment.json` 관측으로 갱신했다. public beta decision은 `BLOCKED_UNTIL_OPERATOR_CRITERIA_CLOSE`를 유지한다.
- origin/main의 최신 네 데이터 커밋은 로컬 변경과 충돌 가능성이 있는 asset/release/operations/reconciliation 파일을 포함한다. 원격 data freshness를 잃지 않도록 커밋·rebase 시 데이터 산출물의 최신성/세대를 다시 비교해야 한다.

## 다음 인수 순서

1. `data-lineage`의 실제 stale 입력을 공식 producer로 갱신하여 v56.54 `affected`의 실패 배치를 닫는다. 로컬 브라우저 보고서의 revision stamp는 확인했으며, dirty checkout의 PASS를 release 인증으로 승격하지 않는다.
2. 다음 원격 refresh에서 `snapshotErrors`의 거부 종목/품질을 관측해 해당 producer/session 분류를 원인별로 고친다. E3/E4 날짜 수정만으로 해결됐다고 보지 않는다.
3. 사용자 요청에 따른 커밋/푸시 단계에서는 `origin/main`의 최신 bot 데이터와 코드 기준을 충돌 없이 정렬하고, 원격 CI→attestation→Pages `/deployment.json` exact SHA를 확인한다.
4. AI 실공급자 overlap trace, fast quote 권리/soak, 30일 SLO, 실사용자 이해도, SEC/뉴스 원문 의미와 20개 라우트의 전체 수직 과업은 별도 OPEN으로 유지한다.

이 문서 작성 시 커밋·푸시·배포하지 않았다.
