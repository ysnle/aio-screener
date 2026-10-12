# 구조·운영·QA 검토 — 2차 기록

2026-10-12 KST. 읽기 전용 전문 리뷰 결과. 파일/producer/배포 변경 없음. static·offline runtime 근거와 운영 실증을 구분한다.

## 의도와 구현 추적

| 결정 | 실제 경로 | 판단 |
|---|---|---|
|19→8 화면|route-hubs의8허브 →19개 개별 route/상단 탭|내비게이션1단계 완료. 내용 통합·레거시 삭제2단계 완료와 다름. 기존ID 유지 자체는 결함이 아니다.|
|native ESM 단일 소유|bootstrap dynamic imports →provider/normalizer/store/page; secondary legacy boundaries|lifecycle/renderer/data 각각19native, chart8native·7legacy·4N/A, narrative4native·11legacy·4N/A. strict full-native5개다. acquisition owner와 normalization owner를 혼동하면 안 된다.|
|한 클릭 한 전환|typed command→router scope→navigationCommitted→store.route→hub|단일 authority·abort·lazy-import disposed 검사·재이동 guard가 타당하다.|
|가벼운 초기 부팅|critical sync→2.3초 후 후속 sync→route lazy import|구조 확인. 이번 실제 boot budget 측정은 하지 않았다.|
|최신 artifact 자동 반영|Actions→data/snapshot/history→30분 polling→native sync|boot snapshot 재commit 누락. 아래A01.|
|공용 AI $20|Actions/browser→shared Worker→DO admission/reservation→validated settlement|오프라인 계약101 assertions PASS. 실제 usage·청구·유료 답변은 미검증.|
|13F 정적·13D/G event polling|daily ownership-only→filing-season/new13F→semantic hash→reference UI|타당하다. polling 시각은 콘텐츠hash에서 제외하고 amendment/notice 계보를 보존한다.|
|반응형 재지원|responsive-shell→inert/focus/dialog/visualViewport→viewport gates|현재 사용 범위에 맞다. 스킬의 desktop-only 지시는 낡았다.|
|exact SHA 배포|main CI attestation→Pages/Worker checkout→postdeploy checks|소스 경계 확인. 현재 배포·Secrets·권한·live health는 미실증.|

## 이슈

### A01 · P1 · server revision이 바뀌어도 boot snapshot에 고정

- 근거 `src/app/bootstrap.js:351,608,689,863,865`, `js/aio-data.js:6936`.
- snapshotLoader.load와 marketSnapshot 대입은 start에서만 실행한다. serverDataLoaded handler는 native slices를 sync하지만 snapshot을 다시 load/commit하지 않는다.
- getCanonicalMarketRevision은 새 server meta보다 boot snapshot revision을 우선한다.
- 실제 createAIOArchitecture를 fake EventTarget 문서/local fake fetch로 실행한 뒤 revision B 이벤트를 넣었다. snapshot fetch1회, canonical과 runtime snapshot 모두 revision A를 유지했다.
- 결과: 장시간 열린 탭은 새 quotes와 revision mismatch/옛 completed-close candidate를 유지할 수 있다. fast-plane promotion/revocation의 reload 없는 적용 주석도 재호출 경로가 없다.
- 권고: revision 변화에서 한 번 reload/coalesce 후 snapshot/evidence/store/canonical을 함께 commit; out-of-order/dispose 보호 유지. A→B와 fast promotion/revocation integration fixture 필요.

### A02 · P1 · 25시간 지난 뉴스도 CURRENT

- 근거 `src/data/contracts/page-timeline.js:9,13,14`, `src/data/orchestrators/news.js:14`.
- timeline 뉴스30h, fallback36h, quote/breadth4일, F&G2일 허용. 25h SPX/FG/breadth/news 동일 revision catalog를 home에 넣으면 CURRENT로 실행된다.
- 뉴스는 최신 완료 미국장 주말 예외로 설명할 수 없다. 10/12 최신성 결정과 충돌한다.
- 권고: producer cadence/revision·최신완료세션·경제release·dated filing을 구분하는 단일 admission. 주말 금요일 종가를 wall-clock만으로 막지 않는다.

### A03 · P1 · 시장 폭 구성종목 artifact 최초1회 고정

- 근거 `src/ui/pages/market.js:343~352`, `src/ui/components/breadth-board.js:158,196`.
- `_aioBreadthContributors`가 있으면 loader를 호출하지 않는다. 새 총계와 옛 구성종목 근거가 공존하거나 최신 날짜 drilldown이 사라질 수 있다.
- 권고: history/server revision 변화에서 재검사/atomic 교체. 총계·표본·구성종목B가 함께 바뀌는 fixture.

### A04 · P2 · timeline gate가 퇴역 options와 count16 고정

- 근거 `page-timeline.js:31,115`, `ci-page-data-timeline-contract-check.mjs:27,45`, `src/app/routes.js:5`.
- active에는 options가 없는데 audit에 포함하며 active 집합 대신 count16을 assert한다.
- 권고: registry의 market-sensitive/reference/retired sets로 집합 파생. alias redirect는 별도 검증.

### A05 · P2 · 단일 writer gate의 검색 범위 누락

- 근거 `scripts/ci-architecture-contract-check.mjs:106,524,532`.
- native는 pages만 검색하고 실질 renderer인 components를 빠뜨린다. legacy도 shell/core/data/ui/chat만 검색해 분리된 aio-pages/workspace/macro-tech/charts를 놓친다.
- 현재 double-writer race를 확인한 주장은 아니다. 회귀 방어 범위 결함이다.
- 권고: runtime manifest/ownership registry에서 모든 production writer 대상을 파생. component+분리legacy 동일sink negative fixture가 FAIL해야 한다.

### A06 · P2 · 소유권 정본이 퇴역 DOM·역사 설명과 혼재

- 근거 `architecture/route-owners.json:10,13,193` 및 home/signal/breadth/briefing entries.
- rm01Note의15legacy renderer vs 현재0, technical native chart vs 'canvas remains legacy' 설명, 퇴역 score DOM이 혼재한다.
- dataOwner=native는 reader/normalization을 가리키지만 mutable globals를 채우는 legacy acquisition이 남는다.
- 권고: 역사ledger와 현재owner 설명 분리, 현재sink 목록 갱신. enum/current evidence consistency 검사 필요.

### A07 · P2 · QA 스킬의 desktop-only 정책 drift

- 근거 `.claude/skills/post-edit-qa/references/tiers.md:25`와 generated mirror.
- 현 AGENTS는 desktop/mobile/iPad를 지원하지만 Tier4는 모바일을 acceptance target이 아니라고 지시한다.
- 권고: canonical만 수정 후 mirror sync. 이번 리뷰는 사용자 현행 지시를 우선해 세 viewport를 확인한다. 승인 대기 사유가 아니다.

### A08 · P3 · 승인 dated model 소비와 예산정산 계약 불일치

- 근거 `scripts/lib/ai-shared-analysis.mjs:19`, `worker/openai-budget.mjs:116`.
- dated gpt-6-luna 응답은 text extractor가 인정하나 settlement는 정확 alias만 인정한다. completed+valid usage의 조건부fixture에서 text=Done, settlement=null.
- 실제 upstream의 dated response 발생은 미검증. cap 우회가 아닌 가용예산 과도 예약 위험이다.
- 권고: 승인 모델identity/가격 계약 공통화. 임의 future model을 같은 가격으로 추정하지 않는다.

### A09 · P3 · 퇴역 CFTC UI의 producer와 컴포넌트 잔존

- 근거 `.github/workflows/refresh-screener.yml:67,125`, `src/ui/components/positioning-board.js:87`.
- renderer production caller는 없지만 producer/artifact staging은 계속된다. Claude 기존 handoff도 같은 항목을 발견했다.
- 권고: 승인된 reference consumer에 연결할지, producer/component를 함께 퇴역할지 결정. 현재 요청은 리뷰이므로 삭제 미적용.

### A10 · P2 · 허브별 실제 통합 완료 기준 부재

- 근거 route-hubs/STRUCTURE-PROPOSAL의2단계대기/bootstrap의19page등록.
- 내비게이션 축소는 좋지만 중복 내용·시점·legacy 경계가 자동 제거되지 않는다.
- 권고: 허브마다 대표질문/동일revision/native writer/legacy deletion/old alias라는5개 완료 조건으로 닫는다. 전면 재설계나1단계 되돌리기는 불필요하다.

## 검증과 한계

- offline: worker/openai-contract.test.mjs101assertions PASS, ci-ai-budget-scope-check335production sources PASS, ci-13f-currentness-check PASS.
- ci-page-data-timeline-contract PASS(pageCount16/fieldCheck49)는 위 A02/A04를 잡지 못했다.
- source contracts는 root 실행에서132PASS/1환경실패(knowledge parity self-copy)다. deployed 검증으로 승격하지 않는다.
- 정리 판단: 독립 정책 없는 한줄 provider wrapper를 더 만들기보다 revision/clock/freshness 경계를 하나로 묶는 것이 더 가치 있다. 요청 없는 추측성 대규모 삭제는 권하지 않는다.
- 미검증: live Secrets/권한/배포SHA, 실제청구·AI답변, Safari실기기, long-lived 실제producer전환, 정확한성능budget.
