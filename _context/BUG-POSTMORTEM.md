---
last_verified: 2026-11-23
confidence: medium
derived_facts: see _context/CURRENT-STATE.md (generated) for latest P/R/QA/version
---

# 결함 사후 분석 원장 (P 항목)

새 항목은 `node scripts/record-fix.mjs`가 첫 `## P` 헤딩 바로 위에 넣는다(최신이 위). 손으로 쓰지 않는다(R3·C1). 전체를 읽지 말고 P 번호·파일명·원칙 id로 검색한다. 규칙과 원칙은 `RULES.md`의 C1~C18 색인, 반복 결함을 게이트로 올리는 절차는 `WORKFLOW-GOVERNANCE.md`의 Postmortem-To-Gate Rule이 정본이다. 결함이 아닌 기능·정리는 P를 받지 않는다(change-only).

이 원장은 다음 작업을 바꾸는 것만 남긴다(소유자 2026-11-19): 반복 결함 클래스 표, 최근 두 릴리스(v60.30·v60.31)의 전문, 그 이전 항목마다 한 줄 `## P<번호> - <릴리스> - <제목> · 원칙 <R/C id> · 교훈 <어긴 규칙> · 검사 <막는 게이트> · 파일 <경로>`. 증상·원인·수정·검증 전문은 git 히스토리에 있다: `git show d0bbbcae3:_context/BUG-POSTMORTEM.md`(P703 이하는 그보다 앞선 2026-07-18 이전 리비전). 결번 또는 비결함 번호: P617~P619, P650, P670, P710, P723, P725(v53.7 기능 작업).

## 반복 결함 클래스 — 원칙별 집계

같은 원칙에서 결함이 계속 나오면 사례를 더하지 말고 공용 함수·전 표면 스캔·시간표 전수 검사로 닫는다(R734). 아래 표는 원장 본문에서 기계적으로 센 탐색 보조이고 의미 판정이 아니다.

<!-- ledger-class-report:begin -->
집계 2026-11-20: P 항목 2111건 중 원칙에 연결된 809건, 연결 없음 1302건(대부분 v52 이전, R/C 인용 없음). 한 항목이 여러 원칙을 인용하면 각 원칙에 센다. 최근 = P1900 이후. 재생성: `node scripts/ledger-class-report.mjs --write`.

| 원칙 (RULES.md) | P 항목 | 최근 | 최신 사례 |
|---|---:|---:|---|
| C1 기록·버전·원장은 스크립트가 쓴다 | 99 | 28 | P2366, P2364, P2277 |
| C2 작업 공간 사실은 생성되고, 도구는 정본 하나에서 나온다 | 29 | 1 | P1905, P1597, P1595 |
| C3 검증은 실제 결과를 증명한다 | 58 | 18 | P2636, P2635, P2181 |
| C4 한 의미에는 한 구현 | 149 | 21 | P2219, P2212, P2211 |
| C5 화면은 라우트가 소유한다 | 31 | 4 | P2182, P2146, P2144 |
| C6 표시는 기기에 적응하고 접근성을 지킨다 | 19 | 3 | P2227, P2082, P1966 |
| C7 읽는 문장은 관측과 근거만 말한다 | 38 | 20 | P2183, P2179, P2085 |
| C8 결측은 값이 아니다 | 67 | 15 | P2184, P2178, P2149 |
| C9 현재성은 관측 시각과 달력에서 나온다 | 66 | 19 | P2557, P2226, P2213 |
| C10 한 지표에는 한 원천과 한 표시 owner | 62 | 22 | P2184, P2180, P2178 |
| C11 판단은 근거 게이트와 검증된 방법을 거친다 | 118 | 30 | P2629, P2571, P2566 |
| C12 종목과 공시는 정확한 등록으로만 식별한다 | 15 | 5 | P2036, P2002, P1973 |
| C13 생산자는 수집→산출물→소비→감사를 닫는다 | 141 | 17 | P2599, P2150, P2145 |
| C14 뉴스와 외부 정성 자료는 출처를 지닌 참고 입력이다 | 27 | 15 | P2555, P2232, P2146 |
| C15 지식·학습 자료는 구조와 의미를 따로 인증한다 | 39 | 5 | P2059, P2021, P2014 |
| C16 AI는 공용 Worker 한 경로와 근거 계약을 쓴다 | 41 | 9 | P2596, P2390, P2388 |
| C17 운영·배포·보안은 증거로 닫힌 쪽에 선다 | 85 | 13 | P2311, P2215, P2163 |
| C18 퇴역한 기능은 흔적 없이 걷어낸다 | 22 | 1 | P2046, P1672, P1671 |
<!-- ledger-class-report:end -->

## 옛 반복 클래스 (v53 이전 수기 표, R25 승격 원장)

| 클래스 | 대표 P | 상태/게이트 |
|--------|--------|------------|
| 진척 인플레이션 (실행 소유권 이전 없이 선언식 상태 승격 — scaffold/신규 파일 수를 완료로 오인) | P736 P740 | **R352 승격 완료** — `architecture/route-owners.json` 대조 검증(ci-retirement-contract/ci-operations-status-check), "게이트는 선언이 아니라 실측을 검증" 원칙 |
| 이중 표면·그림자 구현 드리프트 (동일 판정의 중복 구현 중 한쪽만 수정) | P276 P492 P605 P606 P625 P713 P719 P741 P745 | ci-structural(그림자 선언), "동일 지표 소비 표면 grep 전수" 원칙, **AG-DOM-WRITER 신설**(P741, native/legacy id 교집합 0). P745: sloppy-mode 함수 재대입(`name = function(){}`)이 앞선 `function name(){}` 선언을 이름만 재사용해 완전히 덮어쓰는 패턴도 "이중 구현"의 한 형태 — grep으로 동일 이름 재선언/재대입 여부를 확인할 것 |
| 생산자-소비자 파이프 단절 (인프라·필드만 만들고 소비 경로 미연결) | P239 P548 P652 P664 P721 P724 P743 | "읽기 코드 존재≠필드 존재 — 쓰기 지점 grep 실증" 원칙. P743: cross-module 브릿지 API는 "소비 측"과 "노출/필터링 측"이 분리된 별도 계약일 수 있음 — 실브라우저 게이트로 종단 간 확인 필수 |
| 관측 시점 리터럴 부패 (달력 회전·시장값 회전·데이터 상태 영구 단언) | P604 P627 P713(T884) P715('1,508') P720('5/5') P722 | R279 계열. `grep "=== '20"` 스윕, 감사 토큰에 비숫자 컨텍스트 의무 |
| fail-closed 위반 (결측·정적·합성값의 현재 판정 승격) | P635 P649 P706 P712 P713 P717 P718 | R340~R342, ci-static-data-contract 22카테고리 |
| 매매 지시·과신 라벨 발화 (정적 UI 포함) | P490 P512 P535 P714 P720 | P714 관측형 전환 + 지시 문형 grep |
| HYG 달러 가격 임계로 신용 판정 | P576 P713 P714 P726(5표면 전부 해소) | **R343 승격 완료** — `grep -E "hyg\s*[<>]"` QA §0/§4 상시 편입 |
| silent fail (실패를 삼키고 정상처럼 보임) | P352 P410 P415 P523 P546 P565 P707 | 실패 상태 명시 렌더 + lineage 게이트 |
| XSS/이스케이프 누락 | P433~P438 P558 P566 P567 | escHtml/safeHtml 스윕, runtime contract |
| 일괄 치환·스윕 부작용 (sed/이모지 제거가 코드 파괴) | PR-P135 P678 P680 | R309 — 스윕 후 빈 버튼·양쪽-빈 삼항 전수 검색 |
| init 가드·cleanup 라이프사이클 | P56 P484 P568 | QA 3B 단계, 타이머 레지스트리 |
| 인코딩/mojibake 파손 | P507계열 P583 P596 P660 | ci-control-char-check (baseline) |
| 테스트가 artifact 내용에 의존 (데이터 상태 바뀌면 CI RED) | P648 P677 P709 P720 P722 | "가용/불가용 양쪽 분기 검증" 원칙, push 전 이중 artifact 실행 |
| 자기평가 오류 ("이미 됐다" 무검증 주장) | P631 P687 P688 | "기존 확인 기록 재검증 없이 신뢰 금지" (memory/feedback) |

---

## P2750 - v60.49 - 데이터 갱신 커밋마다 코드 상태 파일 3개(asset·release manifest, public-config)를 다시 써서 긴 브랜치가 매번 충돌했다 (2026-11-23)

- symptom/reproduction: git 이력 5,863커밋 중 3,586개가 architecture/asset-manifest.json·release-manifest.json을 바꿨고, public-config.json은 최근 53일 데이터 커밋 1,603개 중 1,603개에서 바뀌었다. 바뀐 것은 dataRevision·dataGeneratedAt·dataCycleId·dataCycleManifestRevision·generatedAt과 ai.routeEvidence의 source·observedAt·observationStatus뿐이라, 코드 브랜치를 main에 합칠 때마다 생성물 충돌과 고정값 실패가 났다.
- root_cause: 데이터 revision과 Worker 관측 시각이 코드 릴리스 파일에 복사돼 있었다. sync-data-release-manifests.mjs가 매 갱신마다 market-snapshot.revision과 data.json 주기 id를 두 manifest에 옮겨 적었고, build-operations-status.mjs가 operations-status.json ai.publicChat.health에 이미 있는 관측(source·observedAt·observationStatus)과 planes.fast.soak.observedDays를 public-config.json에 다시 적었다. 두 복사본 모두 앱이 읽지 않았다.
- fix: 데이터 revision의 정본은 public-data/operations-status.json dataRevision 하나다(주기 id는 data.json meta에 그대로). 두 manifest에서 데이터 필드 다섯 개를 지우고 sync-data-release-manifests.mjs와 refresh-data의 'Promote one data release revision' 단계를 삭제했다. public-config.json routeEvidence는 status만 남기고, fastQuotes.certification에서 soakObservedDays를 지웠다(소비자 게이트는 operations-status의 soak을 읽는다). 충돌 해소기는 manifest 표를 지우고 operations-status 경로 정책만 남겼고, --align-generated는 operations-status만 맞춘다. 데이터 오버레이는 manifest를 코드 커밋에서 가져온다.
- violated_rule: R421·R428 (데이터 revision은 한 곳에서만 발행)
- prevention: scripts/ci-release-revision-check.mjs 섹션 release-manifests-code-only: 두 manifest가 dataRevision·dataGeneratedAt·dataCycleId·dataCycleManifestRevision·generatedAt 중 하나라도 가지면 실패(고치기 전 manifest로 실패 확인). scripts/ci-operations-contract-check.mjs: operations-status dataRevision이 market-snapshot.revision과 같다. scripts/ci-generated-conflict-fixture.mjs: 정책 없는 파일의 충돌은 해소하지 않는다.
- verification/residual: node scripts/ci-release-revision-check.mjs; node scripts/ci-operations-contract-check.mjs; node scripts/ci-architecture-contract-check.mjs; node scripts/ci-generated-conflict-fixture.mjs; node scripts/ci-release-source-check.mjs; node scripts/ci-operations-status-check.mjs; node scripts/ci-fast-plane-consumer-gate.mjs. push 뒤 확인: 다음 refresh-data·refresh-screener 커밋의 --stat에 architecture/*-manifest.json이 없다.
- files: architecture/asset-manifest.json, architecture/release-manifest.json, public-config.json, scripts/build-operations-status.mjs, scripts/sync-data-release-manifests.mjs, .github/workflows/refresh-data.yml, scripts/lib/data-publish-sets.mjs, scripts/build-data-overlay.mjs, scripts/lib/align-generated-version.mjs, scripts/resolve-data-manifest-merge.mjs, scripts/resolve-generated-conflicts.mjs, scripts/ci-release-revision-check.mjs, scripts/ci-operations-contract-check.mjs, scripts/ci-architecture-contract-check.mjs, scripts/ci-generated-conflict-fixture.mjs, scripts/ci-release-source-check.mjs, scripts/ci-scenario-guidance-fixture.mjs, scripts/ci-official-references-check.mjs, scripts/ci-qa-pipeline-contract-check.mjs, _context/RULES.md

## P2749 - v60.49 - AI 계약 검사의 VIX 기록 픽스처가 월요일(UTC)마다 실패해 CI와 데이터 갱신을 막았다 (2026-11-23)

- symptom/reproduction: 2026-11-23 00:06Z부터 ci-ai-intelligence-contract-check의 'v60.46 the VIX record tool reads one sample' 블록이 실패했다. CI가 빨갛게 되면서 Refresh market data 실행이 모두 막혀 실서비스 데이터 갱신이 멈췄다.
- root_cause: 픽스처가 _aioHistory 두 줄을 Date.now()에서 달력일 1일·2일 전(iso(1), iso(2))으로 날짜 매겼다. buildCloseSeries는 시장 세션 날짜만 남기므로 UTC 월요일에는 두 줄이 일요일·토요일이 되어 VIX 줄이 하나도 남지 않았다. 검사 결과가 돌리는 요일에 따라 달라지는 결함 부류(P2223과 같은 계열, R739 위반)인데, v59.99/v60.18의 시계 이동 검사는 --check 생성기만 45일·366일 옮겨 돌렸고 계약 검사는 한 번도 다른 요일에 돌지 않았다.
- fix: e5045b8fc에서 두 줄을 previousHistorySession으로 직전 두 미국 세션에 놓았다(제품 코드는 바꾸지 않음). 같은 부류를 닫는 게이트 scripts/ci-clock-shift-check.mjs를 workspace 그룹(inputClass code, CI 전체 범위에서만 실행)에 등록했다: 벽시계를 읽는 비브라우저 code/mixed 계약 검사를 오늘, 다음 7일(01:00Z), 가장 가까운 NYSE 휴장일(15:00Z)과 KRX 휴장일(01:00Z)에 돌려 판정이 오늘과 다르면 실패한다. 시계는 scripts/lib/clock-offset.mjs(NODE_OPTIONS --import, 자식 프로세스와 vm 컨텍스트까지 이동)가 옮긴다. 부하로 생긴 타이머 경합은 단독 재실행으로 걸러 낸다.
- violated_rule: R739 (현재성 픽스처는 명시적 now를 넘긴다)
- prevention: scripts/ci-clock-shift-check.mjs: 'v60.49 <검사> gives today's verdict on <요일·휴장일>' 및 음성 대조 'v60.49 the negative control (VIX rows on calendar days 1 and 2 back) fails on some target day and passes on another'. 고치기 전 VIX 블록(git show e5045b8fc^:scripts/ci-ai-intelligence-contract-check.mjs)을 --only로 돌리면 8개 대상 요일에서 실패한다.
- verification/residual: node scripts/ci-clock-shift-check.mjs (23개 검사 x 9개 대상 통과, 약 61초, 12코어 로컬); node scripts/ci-clock-shift-check.mjs --only <고치기 전 사본> 실패 8건; node scripts/ci-qa-pipeline-contract-check.mjs; node scripts/ci-data-pipeline-contract-check.mjs.
- files: scripts/ci-ai-intelligence-contract-check.mjs, scripts/ci-clock-shift-check.mjs, scripts/lib/clock-offset.mjs, architecture/qa-pipeline.json

## P2748 - v60.48 - 한국 종목 일봉 폴백이 월요일·연휴 뒤 등락률을 0%로 적고, 네이버를 직접 불러 요청마다 실패 두 번을 냈다 (2026-11-22)

- symptom/reproduction: 실서비스 20개 화면 점검에서 기술적 분석·매크로 화면이 api.finance.naver.com과 fchart.stock.naver.com을 브라우저에서 직접 불러 종목마다 net::ERR_FAILED 두 건과 콘솔 오류를 남겼다. 같은 폴백의 종목 상세 경로(js/aio-kr-data.js)는 조회 창이 이틀이어서 월요일이나 연휴 뒤에는 한 줄만 받고, 전일 종가를 그 줄의 종가로 채워 등락률 0.00%를 기록했다.
- root_cause: 두 네이버 호스트는 교차 출처 허용 헤더를 보내지 않아 브라우저 직접 호출은 언제나 실패하는데, 세 호출 지점이 '직접 시도 후 릴레이'를 반복했다. P2337이 공급자 쪽(src/data/providers/naver-kr.js)의 주말 전일 종가만 고쳤고, 같은 응답을 읽는 종목 상세 쪽 복사본은 남았다.
- fix: 세 지점 모두 릴레이만 부른다. 종목 상세 폴백의 조회 창을 10일로 넓히고, 한 줄뿐이면 등락률을 0이 아니라 '모름'으로 둔다.
- violated_rule: 같은 응답을 읽는 코드가 두 곳에 있으면 한 곳의 수정이 다른 곳을 고치지 않는다 (R620 계열).
- prevention: scripts/ci-proxy-continuity-check.mjs가 배포되는 모든 스크립트에서 '직접 호출 뒤 릴레이' 줄을 찾아 파일과 줄 번호로 실패한다. v60.47 코드에서 세 지점 모두로 실패함을 확인했다. 한 줄 응답의 등락률은 행동 테스트가 없다(큰 비동기 함수 안의 블록).
- verification/residual: node scripts/ci-proxy-continuity-check.mjs (63 PASS, 이전 코드에서는 naver-kr.js:198, :258, aio-kr-data.js:1177로 실패)
- files: js/aio-kr-data.js, src/data/providers/naver-kr.js, scripts/ci-proxy-continuity-check.mjs

## P2747 - v60.47 - 보유 종목 추가에서 접힌 '선택 입력' 안의 칸(통화·목표가)이 거부되면 포커스가 그 칸으로 가지 못함 (2026-11-22)

- symptom/reproduction: 실서비스 v60.46에서 선택 입력 접힘이 닫힌 채 원가 통화가 거부되면 칸에는 오류 표시와 안내가 붙지만 포커스는 '추가 / 업데이트' 버튼에 남고, 안내 문구는 닫힌 접힘 안에 있어 보이지 않았다(토스트만 보임).
- root_cause: refuseField가 표시 뒤 곧바로 input.focus()를 불렀다. 닫힌 details 안의 입력란은 포커스를 받을 수 없다.
- fix: refuseField가 거부된 칸을 감싼 닫힌 접힘을 먼저 연 뒤 포커스를 준다.
- violated_rule: 거부된 입력은 표시·안내·포커스가 함께 간다 (v60.46 보유 종목 거부 한 경로)
- prevention: scripts/ci-esm-core-unit-check.mjs v60.47: 닫힌 details 안의 칸을 거부하면 접힘이 열리고 그 칸이 포커스를 받는다.
- verification/residual: node scripts/ci-esm-core-unit-check.mjs exit 0. 실서비스 화면에서의 재확인은 배포 뒤에 한다.
- files: src/ui/components/input-check.js, scripts/ci-esm-core-unit-check.mjs

## P2746 - v60.46 - callSharedAi를 채팅 전역이 설치되기 전에 부르면 요청도 콜백도 없이 멈춤 (CI browser-ai-public 간헐 실패의 원인) (2026-11-22)

- symptom/reproduction: v60.44 이후 CI의 browser-ai-public이 5번 중 4번 120초(이후 60초 멈춤 진단)로 실패했다: 'stalled at shared-ai-stream; held orchestrator 1; worker requests 0; pending none'. 로컬 단독 실행은 항상 통과했고, 같은 게이트를 6~7개 동시에 돌리면 2~4개가 같은 문구로 실패했다.
- root_cause: callSharedAi는 요청 파이프라인과 답변 오케스트레이터만 기다렸다. 본문 크기 한도는 chat-globals.js가 설치하는 AIO.aiWorkerContract에서 읽는데, 패널 스크립트가 실행된 순간부터 callSharedAi는 전역이라 chat-globals보다 먼저 불릴 수 있다. 그때 async 함수 안에서 TypeError(reading 'clientBodyTargetBytes')가 나고, 호출자가 반환 약속을 보지 않아 onDone·onError 어느 쪽도 불리지 않는다. 패널 자체 진입점은 로더가 전역 설치 뒤에 재생하므로 영향이 없었다.
- fix: 공용 AI 준비 대기(_aioAIAnswerReady)가 패널 로더(AIO.loadChat: 채팅 전역·질문 단서·프로필)까지 기다린다. 게이트는 callSharedAi가 던진 오류를 멈춤이 아니라 그 오류로 보고한다.
- violated_rule: 지연 로드 모듈이 설치하는 전역을 읽는 함수는 그 설치를 스스로 기다려야 한다 (P2171 계열)
- prevention: scripts/ci-ai-chat-public-route-browser-check.mjs v60.46: callSharedAi의 반환 약속 거부를 게이트 오류로 올린다. 수정 전 코드에서는 부하를 걸면 'callSharedAi threw: TypeError … clientBodyTargetBytes'로 실패한다.
- verification/residual: 수정 전: 동시 7개 중 4개 실패(TypeError 확인). 수정 후: 동시 8개 모두 통과. CI에서의 통과는 push 뒤 확인한다.
- files: src/app/compatibility-globals.js, scripts/ci-ai-chat-public-route-browser-check.mjs

## P2745 - v60.46 - 주말에 Yahoo가 원/달러를 다른 값으로 다시 찍으면 시세 스냅샷과 이력의 일치 검사가 데이터 갱신을 막음 (2026-11-22)

- symptom/reproduction: 11/22(일) 02시Z 이후 refresh-data가 매번 history-time에서 실패했다: 'latest row 2026-11-22 field usdkrw: 1346.13 != KRW=X completed value 1337.8 (MARKET_CLOSED)'. AAII 수집도 12시간 넘게 발행되지 못했다.
- root_cause: 이력 프로듀서는 세션이 없는 날에 찍힌 읽기를 행에 넣지 않고 마지막 세션 값을 유지한다(dropSessionlessReads). 일치 검사는 같은 읽기를 스냅샷의 완료 종가로 보고 이력과 비교했다. 토요일에는 재표기 값이 금요일 종가와 같아 통과했고, 일요일에 값이 달라지자 막혔다.
- fix: 검사가 프로듀서와 같은 세션 규칙(observationSessionDate)을 쓴다: 세션 없는 날에 찍힌 스냅샷 시세는 완료 종가가 아니므로 비교하지 않는다.
- violated_rule: 교차 산출물 일치 검사는 한쪽 프로듀서가 버리는 입력을 다른 쪽의 기준값으로 쓰면 안 된다 (P2630 계열)
- prevention: scripts/ci-history-field-time-contract-check.mjs v60.46: 스냅샷 시세의 관측일이 세션일일 때만 이력 최신 행과 비교한다.
- verification/residual: node scripts/ci-history-field-time-contract-check.mjs exit 0. observationSessionDate('usdkrw','2026-11-22T03:30Z')는 null, 금요일 22:36Z는 2026-11-20. 실패한 실행의 후보 자료로 직접 재현하지는 않았다(로그의 '세션 없는 날 읽기 4건 제외' 줄과 같은 시세다). 화면의 원/달러 값이 주말 재표기 값을 보여 주는 문제는 고치지 않았다.
- files: scripts/ci-history-field-time-contract-check.mjs

## P2744 - v60.46 - 시나리오 상태의 테마 수치 비교가 다른 레인이 바꾼 screener.json과 보류 행을 같은 입력으로 취급해 생산자 실행 20번을 막음 (2026-11-22)

- symptom/reproduction: scenario-guidance-fixture의 v58.75 단언('scenario-state.json US theme 1-month values match the live pipeline on the same close')이 11/20~22 스크리너 실행 16번, 11/15~20 시장 갱신 22:50Z 실행 4번을 실패시켰다(예: semiconductor -19.86 vs -18.86). 11/22 07:31Z 스크리너 실행도 같은 이유로 실패했다.
- root_cause: 비교 조건이 '같은 미국 종가'뿐이었다. scenario-state.json은 시장 갱신 레인이 그때의 screener.json으로 만들고, 스크리너 레인은 그 사이에 screener.json을 다시 쓴다. 또 23:00Z 전에는 기준 지수가 한 세션 늦은 테마 행이 이전 상태 값을 그대로 잇는데(heldThemeRow), 게이트의 다시 계산은 이전 상태 없이 한다. 두 경우 모두 규칙 차이가 아니라 입력 차이다(P2630과 같은 계열).
- fix: scenario-state의 basis에 screenerComputedAt(만든 screener.json의 factorComputedAt)을 남기고, 비교는 같은 종가·같은 screener.json일 때만, 보류(held) 행은 빼고 한다.
- violated_rule: 교차 레인 일치 검사는 그 레인이 바꾸는 입력을 같은 입력으로 취급하면 안 된다 (P2630)
- prevention: scripts/ci-scenario-guidance-fixture.mjs v60.46: 상태가 자신이 읽은 screener.json을 basis에 밝힌다. 이전 build-scenario-state.mjs에서 실패한다.
- verification/residual: node scripts/ci-scenario-guidance-fixture.mjs exit 0 (지금 발행본은 stamp가 없어 비교를 건너뛴다고 출력). 시장 레인 22:50Z 실패가 보류 행 때문이라는 것은 시각과 코드에서 추론했고 재현하지 않았다.
- files: scripts/build-scenario-state.mjs, scripts/ci-scenario-guidance-fixture.mjs

## P2743 - v60.46 - data overlay가 public-data 전체를 새 코드 커밋에서 가져와 생성된 지식 파일이 이전 코드 위에 실림 (2026-11-22)

- symptom/reproduction: 2026-11-19 데이터 커밋 CI의 knowledge 묶음이 'knowledge generated outputs drifted'로 15번 실패했다.
- root_cause: build-data-overlay.mjs와 resolve-release-source.mjs의 '생성 경로'가 public-data 디렉터리 전체였다. public-data/knowledge·principles·atlas 페이지 문안은 코드 push가 만드는 생성물인데, overlay는 이것까지 데이터 커밋(빨간 새 코드의 생성물)에서 가져와 마지막 초록 코드 위에 올렸다. 같은 이유로 그런 파일만 바꾼 코드 커밋은 '데이터 커밋'으로 취급됐다.
- fix: 생산자가 쓰는 경로의 정의를 하나로 했다: scripts/lib/data-publish-sets.mjs의 PRODUCER_WRITTEN_PATHS(발행 집합 전체 + 브라우저 데이터 고정 파일). resolve-release-source는 그 밖을 바꾼 커밋을 코드로 보고, overlay는 그 경로만 데이터 커밋에서 가져온다(overlay 스크립트는 저장소를 import하지 않으므로 데이터 커밋의 모듈을 git show로 읽는다).
- violated_rule: 없음 (생성 경로 목록과 발행 집합이 같아야 한다는 검사는 발행 집합 ⊂ 생성 경로 방향만 봤다)
- prevention: scripts/ci-release-source-check.mjs v60.46: 임시 저장소에서 생성된 지식 파일만 바꾼 커밋이 코드 커밋으로 판정되고, overlay가 데이터 커밋의 data.json과 코드 커밋의 지식 파일을 함께 싣는다. 이전 코드에서 첫 단언이 실패한다.
- verification/residual: node scripts/ci-release-source-check.mjs exit 0 (이전 build-data-overlay.mjs·resolve-release-source.mjs로 실패 확인). 실제 overlay 릴리스는 push 뒤 빨간 코드 push가 있을 때만 생긴다.
- files: scripts/lib/data-publish-sets.mjs, scripts/build-data-overlay.mjs, scripts/resolve-release-source.mjs, scripts/ci-release-source-check.mjs

## P2742 - v60.46 - operations-status.json이 코드 상태(라우트 소유 목록)를 복사해 데이터 커밋 CI가 43번 실패 (2026-11-22)

- symptom/reproduction: 2026-11-19~20 데이터 커밋 CI의 data 묶음이 '[operations-status] nativeLazyOwner does not match route-owners.json'로 43번 실패했고, 그 결과 converge가 인증 없는 리비전 배포를 22번 거부했다.
- root_cause: build-operations-status.mjs가 architecture/route-owners.json(코드)에서 라우트 소유 목록을 계산해 데이터 산출물에 routes로 썼고, ci-operations-status-check와 ci-retirement-contract가 그 복사본을 다시 route-owners.json과 비교했다. 새 코드 위에서 만든 데이터가 data overlay로 이전 코드 위에 실리면 복사본과 저장소가 어긋난다. 그 블록을 읽는 화면·Worker는 없었다.
- fix: 발행 계약 createOperationsStatus에서 routes 필드를 없애고, 생산자는 route-owners.json을 읽지 않으며 reconciliation.routeCount도 쓰지 않는다. 두 게이트의 복사본 비교를 지웠다. 라우트 소유와 코드의 일치는 ci-retirement-contract가 매니페스트·route-owners·bootstrap 측정으로 계속 검사한다.
- violated_rule: 없음 (데이터 산출물이 코드 상태를 복사하면 안 된다는 검사가 없었다)
- prevention: scripts/ci-operations-status-check.mjs v60.46: createOperationsStatus({ routes }) 결과에 routes가 없어야 한다. 이전 계약(routes를 그대로 복사)에서 실패한다.
- verification/residual: node scripts/ci-operations-status-check.mjs, node scripts/ci-retirement-contract.mjs, node scripts/ci-operations-contract-check.mjs exit 0. 발행된 operations-status.json의 routes 블록은 다음 생산자 실행에서 빠진다(push 뒤 확인).
- files: scripts/build-operations-status.mjs, src/data/contracts/operations.js, scripts/ci-operations-status-check.mjs, scripts/ci-retirement-contract.mjs

## P2741 - v60.46 - 보유 종목 추가에서 모르는 티커나 잘못된 통화를 거부해도 포커스가 저장 버튼에 남았다 (2026-11-22)

- symptom/reproduction: 티커 ZZZZQ나 원가 통화 "12"는 칸에 aria-invalid가 붙었지만 포커스가 추가 버튼에 남았다(실서비스 확인). 빈 티커, 수량 0, 목표가 -1은 칸으로 포커스가 갔다.
- root_cause: 거부 경로가 둘이었다: input-check.js readHoldingInputs의 refuse(표시 + 포커스)와 js/aio-workspace.js가 부르는 window._aioMarkField(표시만). 목표가는 레거시 파일이 직접 포커스를 옮겼다.
- fix: input-check.js refuseField(표시 + 안내 + 포커스, 입력한 글 유지)와 HOLDING_REFUSALS가 이 폼의 모든 거부를 소유한다. compatibility-globals.js는 window._aioRefuseField / _aioClearField만 내고, js/aio-workspace.js는 티커·원가 통화·목표가 거부에서 그것만 부른다. _aioMarkField는 지웠다.
- violated_rule: 같은 동작은 한 곳이 소유한다
- prevention: node scripts/ci-esm-core-unit-check.mjs: 'v60.46 a refused holding field is marked, focused and keeps its text', 'v60.46 the legacy holding form refuses ticker, currency and target through the one refusal path' (_pfAddOnce를 vm에서 그대로 실행). 고치기 전 js/aio-workspace.js로 실패함을 확인했다.
- verification/residual: node scripts/ci-esm-core-unit-check.mjs 통과. 브라우저 미확인: 실제 폼에서 ZZZZQ 거부 뒤 티커 칸에 포커스가 가는지.
- files: src/ui/components/input-check.js, src/app/compatibility-globals.js, js/aio-workspace.js

## P2740 - v60.46 - 검색 칸에서 한글을 조합하는 중 Escape를 누르면 확정한 글자까지 지워졌다 (2026-11-22)

- symptom/reproduction: 명령 검색에 "매크로"를 확정한 뒤 "ㅁ"을 조합하는 중 Escape를 누르면 칸 전체가 비고 결과 7건이 사라졌다(Codex 실서비스 재현). 조합 중인 글자만 취소돼야 한다.
- root_cause: 칸이 <input type="search">라 Escape의 기본 동작이 값을 지운다. behaviors/layers.js는 조합 중 Escape를 건너뛰기만 해 기본 동작을 막지 않았다. 스크리너 #scr-text-search도 type=search라 같다.
- fix: behaviors/layers.js의 문서 키 처리(부팅 때 설치)가 조합 중(isComposing 또는 keyCode 229) Escape를 받으면 대상이 search 칸일 때 기본 동작만 막는다. 층은 닫지 않고, 조합 취소는 IME가 한다. 조합 중 Enter가 결과를 열지 않는 command-search.js 동작은 그대로다.
- violated_rule: 입력한 글은 사용자가 지우기 전에 사라지지 않는다
- prevention: node scripts/ci-esm-core-unit-check.mjs: 'v60.46 Escape while composing keeps the search text (no native clear) and closes no layer'. 고치기 전 layers.js로 실패함을 확인했다.
- verification/residual: node scripts/ci-esm-core-unit-check.mjs 통과(합성 키 이벤트로 기본 동작 차단만 확인). 브라우저 미확인: 이 작업 트리에 node_modules가 없어 Playwright CDP Input.imeSetComposition 재현을 돌리지 못했다. 실제 IME에서 확정 글자가 남는지 확인이 남았다.
- files: src/ui/behaviors/layers.js

## P2739 - v60.46 - 서가가 열어 보기만 한 글을 "읽음"으로 셌다 (2026-11-22)

- symptom/reproduction: 리서치 라이브러리 서가는 글을 열기만 해도 "편 읽음", "읽은 글", 정렬 "안 읽은 글"로 표시했다. 읽었는지는 알 수 없다.
- root_cause: research-shell.js markRead가 글을 연 순간 기록되는데 문구는 읽음을 말했다.
- fix: 문구를 사실대로 바꿨다: "편 열어 봄", "이 브라우저에서 열어 본 글", 정렬 "안 열어 본 글", 책등 접근 이름 ", 열어 봄". 문구는 research-shell.js OPENED_WORDS 한 표가 소유하고, 함수·변수 이름도 opened로 바꾸고, 저장 키(research_read)와 정렬 값(unread)은 기존 기록을 지키려 그대로 두고 주석으로 밝혔다.
- violated_rule: 사실이 맞아야 한다(PRODUCT 원칙 1)
- prevention: node scripts/ci-esm-core-unit-check.mjs: 'v60.46 the research shelf says 열어 봄 for a document that was only opened'. 고치기 전 코드에서 실패함을 확인했다.
- verification/residual: node scripts/ci-esm-core-unit-check.mjs 통과. 브라우저 미확인: 서가 머리의 숫자 줄 표시.
- files: src/ui/knowledge/research-shell.js

## P2738 - v60.46 - 주기 차트를 받지 못하면 이전 차트의 추세 칩이 빈 차트 옆에 남았다 (2026-11-22)

- symptom/reproduction: AAPL 월봉처럼 봉 데이터를 받지 못한 주기로 바꾸면 차트는 비었는데 이전 차트의 "상승 추세 N봉" 칩과 레이어 줄이 그대로 남았다.
- root_cause: 레이어 줄(#stock-chart-layers)과 읽기 줄(.stock-chart-layer-read)은 attachChartLayers 안에서만 지워졌고, 실패 경로는 그 함수를 부르지 않았다. renderStockChart의 공용 초기화는 다른 줄만 지웠다.
- fix: stock-chart-layers.js clearChartLayers가 레이어 줄과 읽기 줄을 지우고, renderStockChart의 공용 초기화가 봉을 받기 전에 부른다. attachChartLayers도 같은 함수를 쓴다.
- violated_rule: 화면의 숫자와 판정은 지금 그린 자료의 것이다
- prevention: node scripts/ci-esm-core-unit-check.mjs: 'v60.46 a timeframe that failed to load leaves no layer row or read line of the previous chart' (renderStockChart 실패 경로를 실제로 돌린다). 고치기 전 stock-chart.js로 실패함을 확인했다.
- verification/residual: node scripts/ci-esm-core-unit-check.mjs 통과. 브라우저 미확인: 실패하는 주기를 실제로 열어 칩이 사라지는지.
- files: src/ui/components/stock-chart.js, src/ui/components/stock-chart-layers.js

## P2737 - v60.46 - 검색 창이 열린 채 뒤로 가면 창이 그대로 남았다 (2026-11-22)

- symptom/reproduction: 명령 검색(Ctrl+K)을 연 채 뒤로 가기를 하면 화면은 바뀌었는데 검색 창은 그대로 떠 있었다.
- root_cause: command-search.js에 화면 이동 처리가 없었고, 서랍은 자기 hashchange 규칙을 따로 가졌다: 층마다 규칙이 달랐다.
- fix: 검색 창도 behaviors/layers.js onNavigate로 연다: 뒤로·앞으로·해시 이동에서 닫히고, 옛 화면의 버튼으로 포커스를 돌려주지 않고 새 화면 제목으로 보낸다. 서랍과 같은 한 규칙이다.
- violated_rule: 같은 동작은 한 곳이 소유한다(behaviors/layers.js)
- prevention: node scripts/ci-esm-core-unit-check.mjs: 'v60.46 Back closes the command search and focuses the new screen\'s heading, not the old opener'. 고치기 전 코드에서 실패함을 확인했다.
- verification/residual: node scripts/ci-esm-core-unit-check.mjs 통과. 브라우저 미확인: 실제 뒤로 가기(마우스 뒤로, Alt+←)에서 검색 창이 닫히는지.
- files: src/ui/navigation/command-search.js, src/ui/behaviors/layers.js

## P2736 - v60.46 - 메뉴(서랍)가 열린 채 뒤로 가면 포커스가 BODY로 떨어졌다 (2026-11-22)

- symptom/reproduction: 휴대폰·아이패드 세로에서 메뉴를 연 채 뒤로 가기를 하면 메뉴는 닫혔지만 포커스가 BODY에 남아 다음 Tab이 문서 맨 위에서 시작했다.
- root_cause: responsive-shell.js가 hashchange에서 setOpen(false, false)로 포커스를 돌려주지 않고 닫았다. showPage(js/aio-core.js)가 새 화면 제목에 주는 포커스는 메뉴가 열려 있는 동안 본문이 inert라 들어가지 못했다.
- fix: behaviors/layers.js에 화면 이동 규칙을 두었다: onNavigate로 연 층은 popstate·hashchange에서 닫히고, 포커스가 BODY나 숨은·inert 영역에 남으면 새 화면의 .page-title(showPage와 같은 대상)로 간다. 서랍은 이 규칙으로 닫히고 자기 hashchange 처리는 지웠다.
- violated_rule: WCAG 2.4.3 포커스 순서
- prevention: node scripts/ci-esm-core-unit-check.mjs: 'v60.46 Back closes the navigation layers through onNavigate and focuses the new screen\'s heading', 'v60.46 Back closes the drawer and focus lands on the new screen\'s heading, not BODY'. 고치기 전 layers.js와 responsive-shell.js로 각각 실패함을 확인했다.
- verification/residual: node scripts/ci-esm-core-unit-check.mjs 통과. 브라우저 미확인: 실제 뒤로 가기에서 새 화면 제목에 포커스가 가는지(popstate 처리 순서).
- files: src/ui/behaviors/layers.js, src/ui/components/responsive-shell.js

## P2735 - v60.46 - 비교 트레이에서 종목 하나를 뺄 수 없었고, 비우면 포커스가 사라졌다 (2026-11-22)

- symptom/reproduction: 종목 비교 트레이는 전체 비우기만 있어 하나만 빼려면 표에서 다시 찾아야 했다. 비교 비우기를 누르면 트레이가 숨으며 포커스가 BODY로 떨어졌다.
- root_cause: inspector.js renderCompareTray가 종목 열에 상세 버튼만 만들었고 clear-compare 동작은 포커스를 다루지 않았다.
- fix: 각 종목 열에 "빼기" 버튼(접근 이름 "<티커> 비교에서 빼기")을 둔다. 뺀 뒤에는 그 자리에 온 종목의 빼기, 없으면 앞 종목, 트레이가 비면 비교를 추가한 컨트롤(behaviors/layers.js focusOrigin으로 기억), 그것이 없으면 검사 창의 비교 추가로 포커스가 간다.
- violated_rule: WCAG 2.4.3 포커스 순서: 누른 컨트롤이 사라지면 포커스는 가까운 다음 대상으로 간다
- prevention: node scripts/ci-esm-core-unit-check.mjs: 'v60.46 each compare item has a 빼기 button named with its ticker', 'v60.46 비교 비우기 returns focus to the control that added the compare'. 고치기 전 코드에서 실패함을 확인했다.
- verification/residual: node scripts/ci-esm-core-unit-check.mjs 통과. 브라우저 미확인: 실제 트레이의 빼기 버튼 배치(열 머리 아래)와 휴대폰 폭.
- files: src/ui/pages/screener/inspector.js, src/ui/styles/screener-quality.css

## P2734 - v60.46 - 스크리너 RSI 범위가 최소 > 최대를 받아, 실행 미리보기와 표가 서로 다른 수를 냈다 (2026-11-22)

- symptom/reproduction: RSI 80 ~ 20처럼 최소가 최대보다 큰 범위를 넣어도 아무 표시가 없었고, 실행 미리보기(workbench.js buildVisualDefinition)는 최소만 넣어 RSI 80 이상 종목을 세었는데 표(filters.js filterRows)는 두 경계를 모두 적용해 0종목이었다. 최대만 넣으면 미리보기는 조건이 없는 것처럼 셌다.
- root_cause: RSI 범위를 읽는 곳이 둘이었다: 표 필터는 두 입력을, 실행 정의 빌더는 scr-rsi-min 하나만 읽었다. 뒤집힌 범위를 판정하는 규칙이 없었고 맞춤 조건 쌍(RSI·1개월·3개월 수익률·변동폭 하한/상한)도 같은 빈틈이 있었다.
- fix: domain/screener/custom-conditions.js rangeInverted / invertedConditionPairs가 하나의 범위 규칙이다. filters.js readRsiRange를 표 필터와 실행 빌더가 함께 읽어 미리보기가 최소·최대를 모두 받는다(뒤집힌 범위는 계약이 거부해 미리보기 수가 나오지 않고 표는 0종목). 뒤집힌 RSI 범위는 input-check.js markRange로 두 칸에 aria-invalid와 "최소값이 최대값보다 큽니다" 한 줄을 단다. 맞춤 조건의 뒤집힌 쌍은 조건 안내 줄에 "함께 만족할 수 없습니다"로 적힌다.
- violated_rule: 같은 정의는 한 곳에서 계산한다
- prevention: node scripts/ci-esm-core-unit-check.mjs: 'v60.46 the run preview takes the RSI upper bound the table applies', 'v60.46 an inverted RSI range is marked on both inputs with one short message'. 고치기 전 코드에서 실패함을 확인했다.
- verification/residual: node scripts/ci-esm-core-unit-check.mjs 통과(고치기 전 workbench.js로 실패). 브라우저 미확인: 실제 스크리너에서 80/20 입력 시 표시 위치와 모양.
- files: src/domain/screener/custom-conditions.js, src/ui/pages/screener/filters.js, src/ui/pages/screener/workbench.js, src/ui/components/input-check.js

## P2733 - v60.46 - worker/README의 KV 쓰기 상한이 영수증 48건 기준(432·624)으로 남음 — 코드는 54건(438·630) (2026-11-22)

- symptom/reproduction: worker/README.md가 하루 정상 상한 432회(384 + 영수증 48), 최악 624회라고 적었다. worker/data-plane.js는 v60.14부터 DISPATCH_RECEIPTS_PER_DAY = 48 + 6이라 정상 438, 최악 630이다.
- root_cause: ci-data-plane-contract-check가 README에 '432 successful KV writes/day'·'624/day' 리터럴이 있는지만 봐서, 코드가 바뀌어도 낡은 문구가 검사를 통과했다.
- fix: README 한 문장을 438(384 + 54)·630으로 고치고, 검사는 FAST_PLANE_WRITE_POLICY에서 읽은 값(정상 상한·영수증 수·최악)을 README에서 찾는다.
- violated_rule: 문서의 숫자를 검사할 때는 코드에서 계산한 값과 대조한다.
- prevention: README 숫자 토큰을 정책 객체에서 만든다 — 영수증 수가 다시 바뀌면 README를 고칠 때까지 실패한다.
- verification/residual: README를 432로 되돌리면 v60.46 단언이 실패함(음성 대조); 고친 뒤 PASS.
- files: worker/README.md, scripts/ci-data-plane-contract-check.mjs

## P2732 - v60.46 - Sandisk NBM 계약 비중을 매출 비중으로 적음 — 원문은 비트 물량 비중 (2026-11-22)

- symptom/reproduction: fact:sandisk:2026-investor-day-model이 NBM 계약이 'FY2027 매출의 50%, FY2028 약 3분의 2'를 덮는다고 적어 fcf-and-funding 등 아틀라스 글의 근거에 그대로 실렸다.
- root_cause: 투자자의 날 요약을 사실 원장에 옮기면서 분모(bits)를 revenue로 바꿔 적었다.
- fix: Sandisk 2026-08-13 보도자료 원문(investor.sandisk.com 'approximately 50 percent of bits in FY2027 and approximately two-thirds of bits in FY2028')을 직접 확인하고 research-facts.json 문장을 비트 비중으로 고쳤다. 가중평균 계약 기간 4년 이상은 보도자료에 없고 발표 자료(접근 불가)에 있다는 감사 기록만 있어 그대로 두었다.
- violated_rule: 수치는 원문의 분모와 함께 옮긴다.
- prevention: 사실 원장 문장을 고칠 때 원문 문구를 확인한다; 원장 한 곳만 고치고 생성물은 builder가 다시 만든다.
- verification/residual: current-evidence-ledger·research-dossiers·articles에 새 문장, ci-knowledge-generated-parity-check PASS.
- files: public-data/knowledge/research-facts.json

## P2731 - v60.46 - G5 '주가의 세 엔진' 그림 문장이 주가 = EPS × PER을 조건 없는 항등식이라 함 (2026-11-22)

- symptom/reproduction: G5 summary.visualization이 '주가 = 주당이익 × 배수(PER)는 늘 성립하는 항등식'이라고 적었다. 이익이 0 이하면 PER이 정의되지 않아 성립하지 않는다.
- root_cause: build-principles-lessons.mjs의 G5 diagram 문구가 PER의 정의역(EPS > 0)을 빠뜨렸다.
- fix: 문구를 '이익이 플러스인 기업에서 주가 = 주당이익 × 배수(PER)는 늘 성립하는 분해식이다(적자면 PER이 정의되지 않는다)'로 바꾸고 생성물을 다시 만들었다.
- violated_rule: 교육 본문의 식은 성립 조건과 함께 적는다.
- prevention: 원천 한 곳(build-principles-lessons.mjs)만 고치고 ci-knowledge-generated-parity-check가 생성물 일치를 본다.
- verification/residual: articles/principles/G5.json·articles.json·lesson-library.json·ai-retrieval-index.json에 새 문구, parity PASS.
- files: scripts/build-principles-lessons.mjs

## P2730 - v60.46 - 지식 출처 링크 — 404 주소 13곳과 날짜 붙은 출처의 '최신판' 주소 (2026-11-22)

- symptom/reproduction: sources.json의 MP-SEC(투자 기초, 37편)·MP-FED-ED(연준 교육, 11편)·MP-TREASURY·AT-CM-01 등 13개 주소가 404였다. WEB-BLS-CPI-2026-06과 PS-10은 2026년 6월 CPI 수치를 인용하면서 cpi.htm?lv=true(늘 최신 달을 보여 주는 주소)를 가리켜, 7월 발표 뒤에는 다른 달 수치가 열렸다.
- root_cause: 출처 주소는 손으로 적은 원천 파일(build-principles-lessons.mjs의 sources, research-source-seeds.json, atlas/source-packets.json·domain-source-packets.json·player-product-registry.json, content/research/principles/catalog.json, chapters.json, narrative-journey.json)에 있고, 주소가 살아 있는지나 날짜 붙은 출처가 움직이는 주소를 쓰는지 보는 검사가 없었다.
- fix: 각 주소를 직접 열어 200과 의도한 문서임을 확인한 공식 주소로 바꾸고 생성물을 다시 만들었다: investor.gov/introduction-investing, federalreserveeducation.org, BLS archives/cpi_07142026.htm, investor.gov 10-K 안내 새 경로, 재무부 interest-rate-statistics, DOE 데이터센터 전력 보고서, NIST robotics, FAA space, AMD instinct.html, KIOXIA SSD, Vertiv AI, Synopsys EDA, SEC 재무제표 입문서. OECD(MP-OECD-IND)·GAO(AT-DD-03)·TSMC 3DFabric(AT-PA-01/PP-05)은 봇 차단으로 대체 주소를 확인하지 못해 그대로 두었다.
- violated_rule: 출처는 그 주장을 확인할 수 있는 문서를 가리켜야 한다 — 날짜 붙은 수치는 그 발표본을 가리킨다.
- prevention: ci-knowledge-corpus-check core 구역에 오프라인 규칙: 날짜 붙은 출처(publishedAt 또는 id·제목의 연도)가 ?lv=true·BLS 현재 발표·/latest 모양 주소를 가리키면 실패. 네트워크 생존 확인은 게이트가 아닌 scripts/report-knowledge-source-liveness.mjs(404=dead, 403/429/5xx=판정 불가).
- verification/residual: 이전 sources.json에서 규칙이 PS-10·WEB-BLS-CPI-2026-06 두 건을 잡음(음성 대조). ci-knowledge-generated-parity-check·ci-knowledge-corpus-check PASS.
- files: scripts/build-principles-lessons.mjs, public-data/knowledge/research-source-seeds.json, public-data/atlas/source-packets.json, public-data/atlas/domain-source-packets.json, public-data/atlas/player-product-registry.json, content/research/principles/catalog.json, scripts/ci-knowledge-corpus-check.mjs, scripts/report-knowledge-source-liveness.mjs

## P2729 - v60.46 - 기술적 분석 머리글의 종가 날짜가 지수 카드가 그리는 일봉이 아니라 history.json 종가에서 나왔다 (2026-11-22)

- symptom/reproduction: 머리글은 '11/18 종가 · 일봉'인데 지수 카드는 11/17 일봉을 그리는 경우가 생길 수 있었다(Codex 관측). 카드는 자기 날짜를 '· 11/17 종가'로 따로 적어 머리글과 카드가 다른 세션을 말했다.
- root_cause: v60.30 chartsPageBasis는 '미국 카드가 그리는 마지막 봉'을 머리글 날짜로 정의했지만, 페이지는 그 함수에 indexChartReadings(history.json 종가)를 넘겼다. 지수 카드는 _aioFetchYahooChartData의 일봉을 따로 받아 그리므로 두 원천의 마지막 세션이 다를 수 있다.
- fix: createChartCards에 basisOf 옵션을 두어 지수 그리드가 자기 settled 판독에서 날짜를 정하고(카드의 일봉이 도착하거나 종가로 대체될 때마다 다시 읽고 바뀌면 카드 날짜 표시를 다시 칠함), onReadings(list, asOf)로 머리글·결론·대표 종목 부분이 그 날짜를 따른다. 카드가 아직 없으면 history 종가로 정한다(domain chartsHeaderBasis).
- violated_rule: 없음 (v60.30 정의와 구현의 어긋남)
- prevention: scripts/ci-domain-parity-check.mjs: chartsHeaderBasis가 그려진 판독이 있으면 그 날짜를, 없으면 history 종가 날짜를 쓰는지, 페이지가 지수 그리드에 basisOf로 이를 넘기고 chartsPageBasis(readings)를 직접 쓰지 않는지 검사. 이전 코드로 실패함을 확인했다.
- verification/residual: node scripts/ci-domain-parity-check.mjs. 브라우저 게이트와 실화면 확인은 이 스레드에서 돌리지 않았다(통합 때 qa-runner 브라우저 그룹).
- files: src/domain/technical/market-charts.js, src/ui/components/market-candles.js, src/ui/pages/charts.js, scripts/ci-domain-parity-check.mjs

## P2728 - v60.46 - 종목 개요의 사 주는 곳·공급하는 곳 칩이 무엇에 대한 대금인지 없이 위탁생산 발주와 광고 지면 대금을 한 줄에 섞었다 (2026-11-22)

- symptom/reproduction: 삼성전자 개요의 사 주는 곳에 Tesla(칩 구매), Qualcomm(웨이퍼·조립·테스트), Trade Desk(낙찰 광고 지면 대금)가 이름만으로 나란히 보였다. '2층 반도체, 메모리' 바로 아래라 Trade Desk가 광고 사업 관계라는 사실은 원자료 표를 열어야 알 수 있었다.
- root_cause: company-graph.js가 money-flow 연결에 문장 전체(text)만 남기고 그 hop의 what(무엇에 대한 대금)을 따로 두지 않아 칩이 보일 수 있는 구분 정보가 없었다. 별칭은 원인이 아니다: Samsung Ads는 삼성전자의 광고 사업부라 'Samsung' 연결은 법인으로 맞다.
- fix: money-flow 연결의 said 항목에 hop.what(괄호 제거, 40자)을 what으로 저장하고, 종목 개요 domain이 첫 what을 행에 싣고, 칩이 이름 옆에 '· 낙찰된 광고 지면 대금 전달'처럼 보인다. 고객·파트너 줄은 꼬리가 수치라 종류가 없어 아무것도 붙이지 않는다(추론하지 않음). 옛 graph.json은 what 없이 그대로 읽힌다. graph.json은 sync-company-profiles.mjs(로컬 작업공간 생성기)로 다시 썼다.
- violated_rule: 없음
- prevention: scripts/ci-company-profile-contract-check.mjs: money-flow 연결이 what을 갖고 고객 줄은 갖지 않는지, 발행 그래프에서 삼성전자 구매처 TTD·TSLA·QCOM이 각자 광고·칩·웨이퍼 대금을 말하는지, what 없는 옛 그래프가 null로 읽히는지 검사. 이전 그래프·코드로 실패함을 확인했다.
- verification/residual: node scripts/ci-company-profile-contract-check.mjs; node scripts/sync-company-profiles.mjs (953개 연결 중 155개에 what). 별칭 함정 스캔(등록 이름 뒤 대문자 단어 1,081건)에서 다른 법인으로 잘못 연결되는 사례를 찾지 못했다. 브라우저 화면은 이 스레드에서 보지 않았다.
- files: src/domain/entity/company-graph.js, src/domain/entity/company-overview.js, src/ui/components/company-overview.js, src/ui/styles/company-overview.css, public-data/company-profiles/graph.json, scripts/ci-company-profile-contract-check.mjs

## P2727 - v60.46 - 시장 점수 백테스트의 과거 행이 실행마다 다시 계산되는데 파일이 그 사실을 적지 않았다 (2026-11-22)

- symptom/reproduction: score-backtest-history.json의 2026-07-15 재구성 점수가 11-19 발행본 68에서 11-20 발행본 69로 바뀌었다. 굴러가는 history.json 창의 앞 세션이 빠져 그 날짜의 200일 이동평균이 성립하지 않게 됐기 때문이다(trend200maAvailable true → false). 파일은 발행 당시 값처럼 읽혔다.
- root_cause: runBacktest가 history.json 창 안의 모든 행을 매번 다시 계산해 덮어쓰고(창보다 오래된 행만 이전 실행 값 유지), 출력에는 그 규칙이 없었다. 같은 저장소의 테마 단계 이력은 재계산 행에 recomputed를 달고, 주간 장기 결과표는 정의 지문으로 재계산임을 밝힌다.
- fix: 출력에 restatement { pastRows: 'recomputed', recomputedFrom, rule }을 쓰고 note에 같은 사실을 적었다. 값을 동결(append-only)하지 않은 이유: 이 행들은 화면이 발행한 점수가 아니라 재구성이며 Pages 번들에서 제외된 연구 산출물이다. 기존 재계산 산출물의 관례(표시)와 맞췄다.
- violated_rule: 없음 (재계산 산출물이 재계산임을 밝히는 규칙이 이 하네스에 적용되지 않았다)
- prevention: scripts/ci-research-model-contract-check.mjs: 재구성 출력의 restatement.pastRows가 recomputed이고 recomputedFrom이 이번 실행의 첫 세션인지 검사. 이전 producer로 실패함을 확인했다.
- verification/residual: node scripts/ci-research-model-contract-check.mjs. git 발행본 15개에서 07-15 값 68/69와 trend200maAvailable 변화를 확인했다. 필드는 다음 refresh-data 실행 뒤 발행 파일에 나타난다.
- files: scripts/backtest-trading-score.mjs, scripts/ci-research-model-contract-check.mjs

## P2726 - v60.46 - 시장 점수 백테스트의 유효 표본이 실제로 겹치지 않는 창 수가 아니라 행 수÷보유일 내림이었다 (2026-11-22)

- symptom/reproduction: public-data/score-backtest-history.json summary가 유효 표본 5일 56·21일 12개를 적었다. 겹치지 않는 보유 구간을 직접 세면 57·13개다(Codex 독립 검산). 21일 표본이 판정 바닥 30에 못 미친다는 사실도 두 보유기간을 합친 sampleSizeSufficient 하나로만 드러났다.
- root_cause: summarizeTradingScoreBacktest가 nEff를 Math.floor(n / h)로 근사했다. 행이 연속 세션이면 앞 창의 종료 세션에서 다음 창을 시작하는 탐욕적 계수는 올림이 된다. 같은 저장소의 장기 하네스(backtest-trading-score-longrun.mjs)는 이미 세션 위치로 세는 nonOverlappingCount를 쓰고 있었다.
- fix: 상관을 계산하는 쌍마다 세션 위치를 붙이고 scripts/lib/rank-statistics.mjs nonOverlappingCount로 창을 센다. 창 수가 없는 상관은 0으로 보고 바닥을 통과하지 않는다(fail closed). 보유기간별 sample5d/sample21d('sufficient'|'insufficient')와 minIndependent를 함께 쓴다. 구간 추정·p값은 계산하지 않으며 significanceStatus UNKNOWN 그대로다.
- violated_rule: R1247 (겹치는 선행 구간은 겹치지 않는 창 수로 판단)
- prevention: scripts/ci-research-model-contract-check.mjs: 재구성 요약의 nEff가 세션 위치 계수(연속 행에서 올림)와 같고 21일이 insufficient로 표시되는지, 창 수 없는 상관이 충분으로 판정되지 않는지 검사. 이전 producer로 실패함을 확인했다.
- verification/residual: node scripts/ci-research-model-contract-check.mjs (고친 코드 통과, 이전 scripts/backtest-trading-score.mjs로 4개 실패). 발행 파일은 다음 refresh-data 실행(하루 한 번)에서 57/13으로 바뀐다.
- files: scripts/backtest-trading-score.mjs, scripts/ci-research-model-contract-check.mjs

## P2725 - v60.46 - 지연된 13F 운용사의 최근 제출(13F-NT)이 원본 공시 탭을 연 뒤에만 보였다 (2026-11-22)

- symptom/reproduction: Pershing Square(2026-03-31 보유)와 Oaktree(2026-06-30 보유)는 2026-09-30 분기에 13F-NT를 냈다(11/16, 11/17). 기본 탭(변화)에서는 분기 말 칩이 '다음 신고 지남'만 적고, 13F-NT 사유와 최근 제출일은 원본 공시 탭을 연 뒤에야 나타났다. Scion은 2025-11-03 13F-HR 뒤 제출이 없다.
- root_cause: 칩의 사유가 filing-discovery.json(원본 공시 탭에서만 불러옴)의 latestSubmission만 읽었다. 같은 정보가 페이지와 함께 오는 manager-catalog.json에도 있었다.
- fix: 판정을 src/domain/masters/filing-deadline.js의 thirteenFCurrentness(stale, reason NOTICE_FILED|NEXT_FILING_DUE, laterSubmission)로 옮겼다. 상세는 discovery가 없으면 카탈로그(registry의 manager.latestSubmission)를 넘긴다. 보유 신고보다 뒤 분기의 제출이 있으면 제출일 줄에 '최근 제출 <서식> <제출일>(<분기> 분기)'를 적는다.
- violated_rule: 없음
- prevention: scripts/ci-masters-contract-check.mjs 'v60.46 a stale filer with a later 13F-NT reads notice filed with that submission's date' 외 두 건(이전 코드에는 판정 함수가 없어 실패).
- verification/residual: node scripts/ci-masters-contract-check.mjs (통과, 이전 masters.js 실패). 브라우저로 Pershing 화면을 직접 보지는 않았다.
- files: src/ui/pages/masters.js, scripts/ci-masters-contract-check.mjs

## P2724 - v60.46 - 13F 마감일 계산이 공휴일을 건너뛰지 않았다 (2026-11-22)

- symptom/reproduction: 13F 마감(분기 말 + 45일)이 주말이면 월요일로만 넘겼다. 2026-02-14(토)는 월요일 2/16이 대통령의 날이라 실제 마감이 2/17인데 2/16로 계산해, 2025-09-30 보유가 2/17 하루 동안 '지연'으로 표시됐다. 2027-02-14(일)도 2/15가 대통령의 날이라 2/16이 마감이다.
- root_cause: src/domain/masters/filing-deadline.js가 요일만 보고 공휴일은 무시했다. 저장소에는 미국 시장 휴장일 표(market-calendar.js)가 이미 있었다.
- fix: 마감일이 주말이나 등록된 NYSE 휴장일이면 다음 영업일로 넘긴다(resolveMarketCalendarSession). SEC는 연방 공휴일에 닫는데 NYSE 표와는 성금요일(NYSE만), 콜럼버스의 날·재향군인의 날(연방만)이 다르다. 셋 다 13F 마감(5/15, 8/14, 11/14, 2/14~15) 직후에 올 수 없어 결과는 같다고 주석에 적었다. 표가 없는 해는 주말만 넘긴다.
- violated_rule: 없음
- prevention: scripts/ci-masters-contract-check.mjs 'v60.46 the Q4 2025 13F deadline rolls past Presidents' Day 2026 to Feb 17' 외 두 건. scripts/ci-data-boundary-fixture.mjs의 thirteenFStale 표 해시를 다시 고정했다(바뀐 표본은 2026-09-30의 2027-02-16 하나).
- verification/residual: node scripts/ci-masters-contract-check.mjs, node scripts/ci-data-boundary-fixture.mjs (통과, 이전 코드는 첫 검사에서 실패). 2025-11~2028-02 매일 비교에서 바뀐 날은 2026-02-17, 2027-02-16 두 날뿐이다.
- files: src/domain/masters/filing-deadline.js, scripts/ci-masters-contract-check.mjs, scripts/ci-data-boundary-fixture.mjs

## P2723 - v60.46 - 13F 금액 단위 경고가 세 운용사 중 하나씩 놓쳤다 (2026-11-22)

- symptom/reproduction: 2026-09-30 분기에 금액을 천 달러 단위로 낸 신고는 T. Rowe Price, Duquesne, Baupost 세 곳인데, 화면은 첫 365행(holdings-summary의 holdings)으로 T. Rowe와 Baupost만, 1,278행(allHoldings)이었다면 Baupost와 Duquesne만 찾았다. Duquesne의 금액·비중이 1,000배 작게 보였다. 운용사별 전체 행(198,132행)이나 웹 투영(4,652행)으로는 세 곳 모두 잡힌다.
- root_cause: detectValueScaleSuspects는 같은 CUSIP·분기의 다른 신고 두 곳 이상과 주당 가격을 비교하는데, 브라우저가 이를 잘린 표본(운용사별 상위 행)에서 돌려 비교할 종목 수가 표본마다 달랐다. 전체 행을 가진 생산자는 이 판정을 하지 않았다.
- fix: scripts/build-masters-runtime-artifacts.mjs가 모든 운용사의 전체 행 저장소를 읽는 첫 단계에서 같은 함수(src/domain/masters/value-scale.js)로 판정하고 managers[].verification.valueScaleReview {ratio, comparedRows}로 holdings-summary.json에 싣는다. 화면은 valueScaleReviewsOf로 그 상태를 읽어 기존대로 금액을 보류하고, 브라우저 쪽 판정은 지웠다. 저장소의 로컬 git 객체에서 masters-store 트리를 그대로 꺼내 생산자를 오프라인으로 다시 돌려 holdings-summary.json·index.json을 갱신했다(세 곳 게시).
- violated_rule: 없음 (판정은 가진 자료가 가장 넓은 곳에서 한 번 한다는 검사가 없었다)
- prevention: scripts/ci-masters-contract-check.mjs: 'v60.46 the masters page reads the published unit review', 'v60.46 the runtime builder detects the unit review over every manager's full rows', 그리고 웹 투영 행에서 잡히는 신고가 모두 게시돼 있어야 한다(이전 holdings-summary.json은 세 곳 모두 없어 실패).
- verification/residual: node scripts/ci-masters-contract-check.mjs (고친 코드·재생성 자료 통과, 이전 자료·코드 실패). 화면에서 Duquesne 금액 보류 안내를 직접 보지는 않았다. 다음 13F 전체 레인 실행에서 같은 결과가 나오는지 확인한다.
- files: scripts/build-masters-runtime-artifacts.mjs, src/domain/masters/value-scale.js, src/ui/pages/masters.js, public-data/masters/holdings-summary.json, public-data/masters/index.json, scripts/ci-masters-contract-check.mjs

## P2722 - v60.46 - 대가 보유 종목의 공유 주소가 다른 운용사(워런 버핏)를 열었다 (2026-11-22)

- symptom/reproduction: #masters?manager=<id> 주소로 들어오면 카탈로그에만 있는 운용사 31곳(38곳 중 정적 목록 7곳 밖) 모두 카탈로그가 도착하기 전까지 Warren Buffett(berkshire-hathaway) 화면이 보였고, 목록에 없는 id는 끝까지 버핏 화면에 머물렀다. 주소도 버핏으로 다시 쓰였다.
- root_cause: render()가 고른 운용사를 matchesList.find(...) || matchesList[0]로 정하고 그 결과를 state.selectedId에 다시 썼다. 카탈로그 전에는 registry가 정적 MASTER_REGISTRY 7곳뿐이라 요청 id가 없으면 첫 운용사로 바뀌었고, 바뀐 id가 주소 동기화로 저장돼 카탈로그가 와도 돌아오지 않았다. 요청한 운용사와 보여 줄 운용사를 가르는 판단이 화면 그리기 안에 섞여 있었다.
- fix: src/domain/masters/holdings-format.js의 resolveManagerSelection이 선택을 정한다: 목록에 있으면 그 운용사, 없으면 카탈로그 대기 중 'loading', 카탈로그가 끝났으면 'not-found'. 화면은 요청 id를 지키고, 불러오는 중·목록에 없음(카탈로그 실패 시 따로)을 상세 자리에 알린다. 다른 운용사로의 대체는 목록 필터가 알려진 운용사를 가릴 때만 남는다. page.dataset.aioMastersSelection이 상태를 드러낸다.
- violated_rule: 없음 (주소가 가리키는 대상을 다른 대상으로 바꾸지 않는다는 검사가 없었다)
- prevention: scripts/ci-masters-contract-check.mjs 'v60.46 a requested manager waits for the catalog and is never replaced by another'(카탈로그 전·후, 없는 id). 이전 holdings-format.js에는 판정 함수가 없어 실패한다. 화면 연결은 소스 문자열 고정 대신(텍스트 핀 래칫) 브라우저 검사의 몫으로 남겼다.
- verification/residual: node scripts/ci-masters-contract-check.mjs (고친 코드 통과, 이전 코드 실패). 새 브라우저 컨텍스트에서 공유 주소를 여는 확인은 하지 않았다.
- files: src/domain/masters/holdings-format.js, src/ui/pages/masters.js, scripts/ci-masters-contract-check.mjs

## P2721 - v60.46 - AI의 VIX 구간 기록 도구가 겹치는 날의 상승 비율을 '사례 약 N개' 옆에 말했다 (2026-11-22)

- symptom/reproduction: scenario_record(vix)가 'VIX 35.9 — 30~40 구간: 21거래일 뒤 오른 비율 81%(평소 64%) … 사례 약 25개 · 참고'처럼, 겹치는 528일에서 낸 비율을 근사 사례 수 옆에 붙였다. 화면의 낙폭 줄은 겹치지 않는 사례로 바뀌어 같은 구간에 두 표본의 숫자가 나왔다.
- root_cause: 도구가 stressRiskSummary가 아니라 겹치는 날의 구간 요약(horizons[21]의 hitRate·nEff)을 읽었다.
- fix: stressRiskSummary가 같은 겹치지 않는 사례에서 오른 경우(upCases·upShare)도 센다. 도구는 그 필드와 사례 수, 중앙값·하위 5%를 '겹치지 않는 사례 N개 중 M개, 평소 X%'로 말하고, 10개 미만은 비율 없이·10~29개는 '참고'(evidenceStrength)로 화면과 같은 규칙을 따른다. 기록이 다른 정의로 계산돼 있으면 화면 줄과 같은 '없음 — 다시 계산' 문장을 돌려준다. 정의가 바뀌어 outcome-stamps를 다시 만들었다.
- violated_rule: R706 (과거 빈도는 겹치지 않는 사례로)
- prevention: scripts/ci-ai-intelligence-contract-check.mjs: VIX 도구가 '오른 경우 64%(겹치지 않는 사례 64개 중 41개, 평소 64%)'와 화면과 같은 낙폭 줄을 내고 81%·'사례 약'을 쓰지 않으며, 7개 사례는 비율 없이 말한다. scripts/ci-market-lean-validation-check.mjs: upCases·upShare가 같은 사례에서 계산된다. 고치기 전 코드에서 실패.
- verification/residual: node scripts/ci-ai-intelligence-contract-check.mjs; node scripts/ci-market-lean-validation-check.mjs; node scripts/ci-expect-output-check.mjs (지문만 바뀜).
- files: src/ai/tools/market-tools.js, src/domain/market/signal/stress-outcomes.js, src/domain/market/signal/vix-band-record.js, src/domain/scenarios/outcome-stamps.js, scripts/ci-ai-intelligence-contract-check.mjs, scripts/ci-market-lean-validation-check.mjs, scripts/fixtures/expect/market-lean.expect.md

## P2720 - v60.46 - 부문 매출 줄이 회사 전체 매출 예상치와 비교됐다 (2026-11-22)

- symptom/reproduction: APPN '전문 서비스 매출'이 예상 대비 −78.8%, '클라우드 구독 매출' −38.4%, CEVA '로열티 매출'·'라이선싱 및 관련 매출' −12.9%, ESTC·APPN·NOW '구독 매출'이 회사 전체 매출 컨센서스와 비교돼 찍혔다.
- root_cause: 예상치를 붙이고 읽는 판단(consensusPeriodMatches)이 기간만 보고 범위를 보지 않았다. 제공처 컨센서스는 분기의 회사 전체 매출인데, metric이 revenue이면 부문·항목 줄도 같은 양으로 취급됐다. 브리프에는 범위 필드가 없다.
- fix: 같은 판단을 consensusQuantityMatches(기간 AND 범위) 하나로 바꿨다. figureScope는 라벨에서 기간·연도 말을 지운 뒤 전체 매출 이름(매출·총매출·순매출·매출 및 수익·Total revenue·Net sales)만 'total'로 보고, 다른 수식어가 붙은 매출 줄은 'part'로 비교하지 않는다(불분명하면 비교하지 않는 쪽). 생산자의 예상치 부착·저장분 제거와 화면·반응 읽기가 모두 이 함수를 따른다. 발행본 142개 예상치 줄 중 부문 7줄이 새로 빠지고, 해당 브리프마다 총매출 줄이 남아 판정은 유지된다.
- violated_rule: 없음 (예상치와 같은 양인지 보는 판단이 기간만 봤다)
- prevention: scripts/ci-esm-core-unit-check.mjs: 전문 서비스·로열티·라이선싱·클라우드 구독·구독·데이터센터 매출·Subscription revenue는 예상 대비가 없고 3분기 순매출·총매출·매출 및 수익·Net sales·매출은 비교된다. scripts/ci-event-briefs-check.mjs: 생산자가 부문 매출 줄에 예상치를 붙이지 않는다. 고치기 전 코드에서 실패.
- verification/residual: node scripts/ci-esm-core-unit-check.mjs; node scripts/ci-event-briefs-check.mjs. 발행본 재분류: ESTC 구독, CEVA 라이선싱·로열티, APPN 클라우드 구독·구독·전문 서비스, NOW 구독 매출 7줄이 비교에서 빠짐.
- files: src/domain/briefing/event-briefs.js, scripts/fetch-event-briefs.mjs, scripts/ci-esm-core-unit-check.mjs, scripts/ci-event-briefs-check.mjs

## P2719 - v60.46 - 대만 월매출의 MOPS 표 생성일이 공시일(publishedAt)로 저장됐다 (2026-11-22)

- symptom/reproduction: public-data/tw-monthly-revenue.json의 16개사 10월 매출이 모두 publishedAt 2026-11-17이었다. 회사들은 10일 전후에 각자 공시하는데, 같은 날짜는 MOPS가 표를 만든 날(出表日期)이다.
- root_cause: parseRevenueRow가 TWSE t187ap05_L의 出表日期를 publishedAt으로 옮겼다. 이 데이터셋에는 회사별 공시일 필드가 없다(出表日期·資料年月·公司代號·公司名稱·產業別·營業收入·累計營業收入·備註).
- fix: 필드를 tableDate로 바꿨다(회사 줄·묶음 머리·수집 전 표지). 읽기 모델 buildTwRevenueView도 tableDate를 내고, tableDateOf가 v60.46 이전 저장분의 publishedAt을 표 생성일로 읽는다. 이어 붙는(carried) 이전 줄은 생산자가 tableDate로 바꿔 쓴다. 화면에는 이 날짜가 찍히지 않는다. 발행 파일은 네트워크 없이 생산자 경로로 다시 만들 수 없어 그대로 두었고, 다음 수집 때 새 이름으로 바뀐다.
- violated_rule: 없음 (원천 필드의 뜻을 이름이 말해야 한다)
- prevention: scripts/ci-tw-monthly-revenue-fixture.mjs: 出表日期는 tableDate로 읽히고 publishedAt으로 저장되지 않으며, 이전 이름의 저장분은 이어 붙을 때 tableDate가 되고 읽기 모델도 그렇게 읽는다. 고치기 전 코드에서 실패.
- verification/residual: node scripts/ci-tw-monthly-revenue-fixture.mjs
- files: scripts/fetch-tw-monthly-revenue.mjs, src/domain/briefing/tw-monthly-revenue.js, scripts/ci-tw-monthly-revenue-fixture.mjs

## P2718 - v60.46 - 사실에 없는 주어의 문장 주장이 '검사 통과'와 구별되지 않았다 (2026-11-22)

- symptom/reproduction: 문장 주장 검사기(claimIssues)가 주어가 facts에 없으면 날짜·값 검사를 건너뛰고 빈 배열을 돌려줬다. 비교할 것이 없음과 비교해서 맞음이 같은 결과였고, 재생 검사는 '0 issues'로만 보고했다.
- root_cause: own(=facts[subject])이 없을 때 wantDay·fact가 null이 되어 조건문이 조용히 넘어갔다. 순위 묶음(rank.among)·비교 대상(compare.against)·그림의 basis가 facts에 없을 때도 같았다.
- fix: scripts/lib/claim-validate.mjs: 이슈에 level('error'|'warning')을 두고, 비교할 사실이 없는 주어·그림·날짜·순위 묶음·비교 대상은 'unlinked' 경고로 낸다. isClaimError로 막는 오류와 구별한다(해석은 막지 않는다, 사실 오류만 막는다). ci-sentence-claim-replay-check는 경고를 따로 세어 '0 fact errors, N not compared'로 보고하고 목록을 경고로 출력한다.
- violated_rule: 없음 (검사하지 못한 것을 통과로 세지 않는다는 규칙이 이 검사기에 없었다)
- prevention: scripts/ci-sentence-claim-replay-check.mjs 자기 검사: 주어·비교 대상이 없는 주장과 basis에 사실이 없는 그림은 unlinked 경고를 내고 오류는 내지 않는다. 고치기 전 코드에서 실패.
- verification/residual: node scripts/ci-sentence-claim-replay-check.mjs — 431 시장 읽기·421 하루 기록, 0 fact errors, 0 not compared.
- files: scripts/lib/claim-validate.mjs, scripts/ci-sentence-claim-replay-check.mjs

## P2717 - v60.46 - VIX 구간 낙폭 비율과 옆의 사례 수가 다른 표본이었다 (2026-11-22)

- symptom/reproduction: 시장 상태·AI의 VIX 위험 줄이 '빠진 경우 29% (평소 17%, 겹치지 않는 사례 64개)'로 찍혔다. 29%는 겹치는 528일, 17%는 9,265일에서 계산했고 64개는 따로 센 겹치지 않는 창 수라, 비율의 분모로 읽혔다.
- root_cause: stressRiskSummary가 drawdownShare를 모든 겹치는 날로, cases를 탐욕적으로 고른 겹치지 않는 창으로 계산했다. vixBandRiskLine은 두 값을 한 괄호에 붙였다.
- fix: stressRiskSummary가 겹치지 않는 사례를 한 번 고르고 비율·적중 수(drawdownCases)·중앙값·하위 5%를 그 사례에서 계산한다(R706). 기저(allRisk)도 같은 함수라 같은 규칙. 줄은 '겹치지 않는 사례 64개 중 N개, 평소 X%'로 쓰고 10~29개는 기존대로 '참고', 10개 미만은 비율 없이. 정의가 바뀌어 outcome-stamps를 다시 만들었고, 발행본은 다음 일간 레인에서 다시 계산될 때까지 '없음 — 주간 갱신 때 다시 계산'으로 보인다(P2587 경로). 시나리오·테마의 기저(baseN, 전체 거래일)는 화면에 개수 없이 '같은 기록 전체 거래일'로만 쓰여 이번 규칙과 어긋나지 않아 그대로 둔다.
- violated_rule: R706 (과거 빈도는 겹치지 않는 사례로 — 비율이 그 사례 수 옆에 놓였지만 다른 표본에서 계산됐다)
- prevention: scripts/ci-market-lean-validation-check.mjs: 42개 겹치는 창 중 5일만 하락인 표본에서 비율은 겹치지 않는 2개 사례 중 1개 = 50%(5/42가 아님), 줄은 '118개 중 10개, 평소 14%' 형식. 고치기 전 코드에서 실패.
- verification/residual: node scripts/ci-market-lean-validation-check.mjs; node scripts/ci-market-reading-week-fixture.mjs; node scripts/ci-scenario-guidance-fixture.mjs (스탬프 일치). 발행본 재계산은 네트워크가 필요해 하지 않음.
- files: src/domain/market/signal/stress-outcomes.js, src/domain/market/signal/vix-band-record.js, src/domain/scenarios/outcome-stamps.js, src/domain/content/likelihood-grounds.js, scripts/ci-market-lean-validation-check.mjs, scripts/ci-market-reading-week-fixture.mjs

## P2716 - v60.46 - 실적 예상 대비가 연간·누적 줄을 분기 예상치와 비교했다 (2026-11-22)

- symptom/reproduction: POWL의 '연간 희석 EPS $6.04' 줄이 분기 예상 대비 +40.3%(제공처 분기 실제치로 계산)로, RGTI의 '첫 9개월 매출' 줄이 −60.7%로 찍혔다. 저장된 surprisePct는 각각 +280%, +203.6%였다. 같은 묶음: KLIC·SANM '2026 회계연도 매출', DIS '연간 조정 EPS'.
- root_cause: figureSurprise의 기간 검사가 매출의 '연간' 라벨에만 걸렸다(ANNUAL_RE, metric === 'revenue'). EPS 줄과 9개월·누적·반기 줄, '회계연도' 라벨은 그대로 분기 예상치와 비교됐다. 생산자(assembleEarningsSections)도 기간을 보지 않고 모든 매출·EPS 줄에 예상치를 붙였고, event-aftermath·earnings-context는 저장된 surprisePct를 직접 읽었다.
- fix: src/domain/briefing/event-briefs.js에 기간 분류 하나(figurePeriod: quarter·annual·cumulative, 라벨 우선, 라벨에 없으면 인용문이 한 기간만 말할 때)와 consensusQuantityMatches(뒤의 범위 판단과 한 함수)를 두고, 모든 지표에 적용한다. 기간을 말하지 않는 줄은 발표의 분기로 본다. 생산자는 분기가 아닌 줄에 예상치를 붙이지 않고 저장분에서 떼며, beatButFell·실적 문맥 줄도 figureSurprise를 읽는다. 같은 자리에서 예상치의 '발표 전 확인' 시각이 발표 뒤였던 문제(RGTI 21:05Z 발표, 22:26Z 확인)는 preReportSeenAt으로 발표 시각 이전 관측만 남기고, 화면은 저장분도 같은 규칙으로 읽는다.
- violated_rule: 없음 (예상치와 같은 기간인지 보는 규칙이 매출 연간 줄에만 있었다)
- prevention: scripts/ci-esm-core-unit-check.mjs: 연간 EPS·첫 9개월·인용문의 nine months·회계연도·상반기 줄은 예상 대비가 없고 2026 회계연도 4분기·기간 없는 줄은 비교된다. scripts/ci-event-briefs-check.mjs: 생산자가 분기 줄에만 예상치를 붙이고, 발표 뒤 관측은 발표 전 시각이 아니다. 고치기 전 코드에서 실패.
- verification/residual: node scripts/ci-esm-core-unit-check.mjs; node scripts/ci-event-briefs-check.mjs (이전 event-briefs.js로 실패). public-data/event-briefs.json 142개 예상치 줄 재분류: 연간·누적 6줄만 비교에서 빠짐.
- files: src/domain/briefing/event-briefs.js, scripts/fetch-event-briefs.mjs, src/domain/briefing/event-aftermath.js, scripts/producer/earnings-context.mjs, src/ui/components/event-briefs.js, scripts/ci-esm-core-unit-check.mjs, scripts/ci-event-briefs-check.mjs

## P2715 - v60.46 - "외부 검색 없이"라고 쓴 AI 질문이 검색 요청으로 읽힘 (2026-11-22)

- symptom/reproduction: 실서비스 v60.44(2026-11-22): "외부 검색 없이 앱의 공개 홈 자료만 사용해서 SPY의 최근 종가와 등락률, 기준일을 한 문장으로 알려줘"의 리서치 판정이 requestedByUser=true였다. requestedByUser는 웹검색을 붙이게 하고(native-search.js searchMustRun) 앱 자료 스냅샷 판정(snapshotEligible)을 막는다.
- root_cause: src/ai/research/decision.js의 EXPLICIT_SEARCH_RE가 '검색'·'search' 같은 단어만 보고 부정(없이·말고·빼고·하지 마·without·no·don't)을 보지 않았다.
- fix: 부정된 검색 구절(NEGATED_SEARCH_RE)을 지운 뒤 검색 요청 단서를 읽는다. 부정은 검색 요청이 아니다. userOptOut(설정 스위치, 실패 시 닫힘)으로 바꾸지는 않았다: 그 경로는 답에 검색 미수신 안내를 붙이기 때문이다. 최근 종가 질문의 REQUIRED 판정은 바꾸지 않았다.
- violated_rule: 없음
- prevention: scripts/ci-ai-intelligence-contract-check.mjs v60.46 블록: 부정 구절 8개(한국어·영어)는 requestedByUser가 false, 실제 검색 요청 5개는 true. 이전 decision.js에서 실패함을 확인했다.
- verification/residual: node scripts/ci-ai-intelligence-contract-check.mjs, node scripts/ci-native-search-check.mjs, node scripts/ci-regex-term-ratchet-check.mjs, node scripts/ci-pipeline-semantics-check.mjs 통과.
- files: src/ai/research/decision.js, scripts/ci-ai-intelligence-contract-check.mjs

## P2714 - v60.46 - 앱 자료로 답한 AI 답변에 "최신 수치 확인 안 됨 — 일반 설명만"과 "근거, 확인 필요"가 붙음 (2026-11-22)

- symptom/reproduction: 실서비스 v60.44, 오늘 화면 AI 패널(2026-11-22): "외부 검색 없이 앱의 공개 홈 자료만 사용해서 SPY의 최근 종가와 등락률, 기준일을 한 문장으로 알려줘"에 앱 도구 자료로 맞게 답했는데($689.81, 3.64% 하락, 11월 20일 종가) 답 맨 위에 "※ 최신 수치 확인 안 됨 — 일반 설명만"이 붙고 근거 표시는 "답변 근거, 확인 필요"였다.
- root_cause: 질문에 '최근'이 있어 리서치 판정이 REQUIRED였고, 검색이 돌지 않아 research-evidence-unavailable 사유가 붙었다. 안내 줄(summarizeAnswerLimitations)은 확인된 수치가 있는지를 publishedClaimCount(타입 claim 수)로만 판단했는데, v60.41 이후 글 우선 답변은 수치를 산문으로 싣고 필터가 요청 자료·도구 결과와 대조해 남기므로 claim 수가 0이었다. 그래서 '일반 설명만' 분기로 갔다. 근거 표시(_aioBuildAIResponseDisclosure)도 게시된 종가 claim과 장중 시세 행만 읽어, 장 마감 뒤 시세 행이 결정용이 아니면 '확인 필요'가 됐다. v60.42(P2702)는 세션 안내만 같은 기준(keptFigures)으로 고쳤고 나머지 사유 분기는 그대로였다.
- fix: 파이프라인이 게시된 답에 확인된 수치가 있는지(figuresShown = 게시된 claim 또는 필터를 통과한 산문 수치)를 한 번 정해 안내 줄에 넘긴다: 확인된 수치가 있으면 '일반 설명만'을 쓰지 않고, 일부를 뺐으면 '일부 최신 수치 확인 안 됨 — 확인된 값만 표시', 빼지 않았으면 '표시한 값 외의 최신 수치는 확인 안 됨'. claim 없이 산문 수치만 있는 답은 게이트에 appFigures(도구가 읽은 종가일)를 싣고, 근거 표시는 '앱 자료 근거 · <종가일> 종가 · 원천: 앱 자료·도구 결과'로 쓴다. 수치 필터와 리서치 판정은 바꾸지 않았다.
- violated_rule: 없음 (안내 줄이 게시된 내용이 아니라 타입 claim 수를 읽었다)
- prevention: scripts/ci-ai-intelligence-contract-check.mjs v60.46 블록: 실서비스 답 모양(리서치 REQUIRED·검색 없음·도구 종가)으로 파이프라인을 돌려 '일반 설명만'이 없고 근거 표시가 '앱 자료 근거 · 2026-11-20 종가'인지, 일부를 뺀 답은 '확인된 값만 표시', 전부 뺀 답은 여전히 '일반 설명만'·'확인 필요'인지 본다. 이전 코드에서 앞의 세 검사가 실패함을 확인했다.
- verification/residual: node scripts/ci-ai-intelligence-contract-check.mjs (고친 코드 통과, 이전 publication.js·request-pipeline.js로 3건 실패). 실모델 확인은 배포 뒤 같은 질문으로.
- files: src/ai/response/publication.js, src/ai/response/request-pipeline.js, scripts/ci-ai-intelligence-contract-check.mjs

## P2713 - v60.45 - 차트(기술적 분석) 화면에서 AI 입력창이 꺼져 있었다 (2026-11-22)

- symptom/reproduction: #technical 또는 #charts 화면에서 AI 패널을 열면 "AI 분석은 주요 분석 페이지에서 사용할 수 있습니다."만 보이고 입력창과 전송 버튼이 비활성이었다. 실서비스 평가의 RSI 정의 문항(def-rsi)이 v60.42, v60.44 두 번 모두 입력창 대기 시간 초과로 끝났다. 다른 19개 화면은 정상.
- root_cause: v59.64에서 기술적 분석 화면의 라우트가 charts가 되고 #technical이 그리로 열리게 됐는데, 채팅 패널의 화면→컨텍스트 표(_aiCtxMap, js/aio-chat.js)에는 technical 키만 있었다. window.PAGES에는 charts의 chatCtx: 'technical'이 적혀 있었지만 그 필드를 읽는 코드가 없어, 표가 둘인 채로 어긋남이 가려졌다. 평가 도구의 오류를 답 품질 문제로만 보고 화면을 열어 보지 않아 두 번 놓쳤다.
- fix: _aiCtxMap에 charts → technical을 넣었다. 아무도 읽지 않는 window.PAGES의 chatCtx 필드는 지웠다(표를 하나로). 게이트가 vertical-slices의 모든 라우트에 패널 컨텍스트가 있는지 전수 검사한다.
- violated_rule: 없음 (새 라우트를 더할 때 채팅 패널 표를 함께 보게 하는 검사가 없었다)
- prevention: scripts/ci-ai-intelligence-contract-check.mjs: VERTICAL_SLICE_CONTRACTS의 모든 라우트가 _aiCtxMap 또는 panel-contexts.js에 등록돼 있어야 한다. 고치기 전 코드에서 charts로 실패함을 확인했다.
- verification/residual: node scripts/ci-ai-intelligence-contract-check.mjs (고친 코드 통과, 이전 js/aio-chat.js로 실패). 로컬 화면에서 #technical의 AI 입력창이 켜지는지 확인.
- files: js/aio-chat.js, js/aio-core.js, scripts/ci-ai-intelligence-contract-check.mjs

## P2712 - v60.44 - v60.44 history.json was committed whole 293 times in a week when only check clocks moved (2026-11-22)

- symptom/reproduction: 2026-11-15..21: public-data/history.json (4 MB) was rewritten in 293 data commits (1,166 MB raw, 32 MB packed of about 97 MB weekly repository growth). On a closed Saturday two consecutive commits differed only in rows.*.fieldMeta.*.checkedAt and rows.*.marketSnapshotRevision.
- root_cause: history.json had no skipUnchanged entry in the freshness registry, so a run that learned nothing new still published new bytes. Four screener-lane files (sec-fiscal-history, treasury-auctions, sp500-weights, kr-investor-flows) likewise moved only generatedAt.
- fix: src/data/contracts/artifact-freshness.js: history.json is skipUnchanged with the two clock paths as volatileKeys; the four screener-lane files use DERIVED. write-freshness-ledger restores the published bytes on such a run and the ledger records the confirmation time.
- violated_rule: A file whose content did not change is not committed; the confirmation time lives in the freshness ledger.
- prevention: ci-artifact-refresh-path-check 'v60.43 a history.json run that moved only field check clocks and the snapshot revision keeps the published file; a changed close or observation time is written' and 'v60.43 the screener-lane files that usually move only generatedAt keep their published bytes on such a run'.
- verification/residual: On real commit pairs: Saturday pair equal except volatile keys, US-session and weekday-closed pairs different. Not verified: the drop in data commits and deployments, readable only from the Actions history after push.
- files: src/data/contracts/artifact-freshness.js, scripts/ci-artifact-refresh-path-check.mjs

## P2711 - v60.44 - v60.44 the browser never read the five-minute quote plane at boot and kept calling live sources with every market closed (2026-11-22)

- symptom/reproduction: Live boot on a closed Saturday (2026-11-21, v60.42): 20 external calls in 44 s and no request to the data plane /quotes. Quotes kept a 3-minute timer, the KR batch a 30-minute timer, and entering 매크로 on a Sunday re-ran the KR batch, although no price could have moved.
- root_cause: The first market-snapshot read ran before public-config resolved, so the fast-plane URL was unknown and the loader fell back to the durable snapshot for the whole visit. No refresh task read the market clock: timers, page entry and the stale report each used the raw interval. The scheduler also still held browser fetch tasks (CoinGecko global and markets, FX reference rates, Fear and Greed, sentiment history, FRED, HY OAS) for values data.json and history.json already carry.
- fix: src/app/refresh-session-policy.js is the one owner of a task's interval for the hour (refreshIntervalMs); timers, page entry and the stale report in refresh-scheduler.js all read it: closed markets stretch quotes to 30 minutes and hold the KR batch and the snapshot re-read. bootstrap.js waits up to 3 s for public-config before the first snapshot read and a marketSnapshot task re-reads the plane every 5 minutes in session. The browser fetch tasks for artifact-carried values are deleted (js/aio-data.js is 20 KB smaller) with their service-worker host patterns and health rows.
- violated_rule: A value the producer already publishes has no browser fetch, and a refresh cadence is decided in one place that knows whether a market is open.
- prevention: ci-state-machine-regression-check 'v60.43 SM-05' pins the interval per task on a Saturday, in the KR session, just after the KR close and in the US session, and that the scheduler has no raw-interval read left. ci-refresh-scheduler-model-check replays every sequence from a closed and an open clock and carries the mutant 'timers do not ask the session policy'. ci-runtime-contract-check LIVE3-10 and aio-tests T898 fail if a browser F&G or HY OAS fetcher returns; ci-sa-04-boot-network-budget keeps the task list.
- verification/residual: State-machine check 14 passed, scheduler model check 10,920 sequences R1-R4, affected QA green locally; /quotes answers 200 with 16 quotes from the production origin. Not verified: the live boot call count and the /quotes read on the deployed site (the Worker rejects a localhost origin), to be checked after push.
- files: src/app/refresh-session-policy.js, src/app/refresh-scheduler.js, src/app/bootstrap.js, js/aio-data.js, js/aio-core.js, sw.js, scripts/ci-state-machine-regression-check.mjs, scripts/ci-refresh-scheduler-model-check.mjs

## P2710 - v60.44 - v60.44 횟수가 함께 적힌 문장이 통째로 지워져 이어 묻기에서 배당수익률이 빠짐 (2026-11-22)

- symptom/reproduction: MSFT 종목 화면에서 '배당은 얼마나 줘?'라고 이어 물으면 답에 배당수익률 문장이 없고 '일부 최신 수치 확인 안 됨'이 붙었다(실서비스 평가 2026-11-22, 같은 날 실서비스에서 모델 원문을 받아 재현). 모델 원문은 '2026년 11월 20일 종가 기준 배당수익률은 0.77%였고, 해당 기간 배당은 4회였습니다.'였다.
- root_cause: 답변 수치 필터는 문장의 모든 숫자가 자료에 있어야 문장을 남긴다. 자료에는 '4회'가 있었지만 필터가 '회'를 단위로 읽지 않아 한 자리 숫자 4를 근거 없는 값으로 보고, 같은 문장의 배당수익률까지 지웠다.
- fix: 'N회'를 횟수 단위로 읽는다. 자료에 같은 횟수가 같은 단위로 적혀 있을 때만 통과한다(src/ai/response/publication.js WRITTEN_FIGURE, WRITTEN_UNITS).
- violated_rule: 문장 단위로 거르는 필터는 자료가 실제로 쓰는 표기를 모두 읽을 수 있어야 한다. 읽지 못하는 표기 하나가 옆의 확인된 수치까지 지운다.
- prevention: ci-ai-intelligence-contract-check 'v60.44 a counted number of times in the material supports the same count in the answer, so the yield sentence beside it stays': 같은 횟수는 통과, 다른 횟수(5회)와 다른 단위(4개)는 통과하지 않는다.
- verification/residual: node scripts/ci-ai-intelligence-contract-check.mjs. 실서비스 재확인은 배포 뒤 같은 질문으로 한다.
- files: src/ai/response/publication.js, scripts/ci-ai-intelligence-contract-check.mjs

## P2709 - v60.43 - v60.43 one row's trailing dividend yield above 40% rejected the whole extended screener shard for 3.5 days (2026-11-22)

- symptom/reproduction: public-data/screener-extended.json was last committed 2026-11-18T03:28Z. From then to 2026-11-21 43 of 44 'Refresh screener and SEC fundamentals' runs ended red; 29 of the failures were '[screener-extended-validator] row ABR: dividendYieldPct must be 0-40% (55.17 / 57.66 / 62.14)', each after about 20 minutes of fetching 3,885 symbols. The published shard therefore still carries no dividend fields and prices from the 2026-11-17 session.
- root_cause: v60.28 added the dividend facts with their plausibility limit only in the validator (row-facts-contract.js DIVIDEND_YIELD_MAX_PCT). The producer (price-factors.js dividendFacts) wrote any ratio, and both validators stop at the first failing row and reject the artifact, so one row outside the limit blocked every other row. The core artifact had the same exposure; its highest yield on 2026-11-21 was 28.97%.
- fix: src/domain/screener/price-factors.js owns DIVIDEND_YIELD_MAX_PCT and dividendFacts returns no dividend fields when the trailing yield exceeds it (the row keeps its price factors; absent dividend facts already read as unknown). row-facts-contract.js imports the same constant, so the producer and the validators share one limit and the validators stay strict.
- violated_rule: A plausibility limit belongs where the value is written; a validator that knows a limit the producer does not turns one bad row into an outage of the whole artifact.
- prevention: ci-data-pipeline-contract-check 'v60.43 a trailing yield above the limit publishes no dividend facts and the row still passes the contract; a yield at the limit is published': a synthetic chart whose last close collapses (60% yield) must produce a row with price factors, no dividend fields and no contract errors. It fails on the v60.42 producer (the row carried dividendYieldPct 60).
- verification/residual: ci-data-pipeline-contract-check exits 0 with the fix and fails on the previous price-factors.js (checked by restoring the old file). Not verified: a real refresh-screener run publishing the extended shard; that needs the fix pushed and the next scheduled run.
- files: src/domain/screener/price-factors.js, src/domain/screener/row-facts-contract.js, scripts/ci-data-pipeline-contract-check.mjs

## P2708 - v60.43 - v60.43 AI 답변에서 PER·PBR 문장이 지워짐 (자료는 'PER 15.7', 답은 '15.7배') (2026-11-22)

- symptom/reproduction: 실서비스 60문항 평가(2026-11-22, v60.42)에서 PER을 묻는 답 4건이 화면 값을 말하지 않고 '일부 최신 수치 확인 안 됨 — 확인된 값만 표시'로 열렸다(NVDA PER, AMD 대 NVDA 비교, 애플 이어 묻기, PER 100배 전제 질문). 밸류에이션 문항 통과율 43%.
- root_cause: v60.42에서 종목 수치를 스크리너 행 한 줄로 주기 시작했는데 이 행은 배수를 단위 없이 쓴다('PER 15.7'). 답변 수치 필터(publication.js figureSupported)는 답이 단위를 쓰면 자료의 단위와 같아야 통과시키므로 '15.7배'는 단위 없는 자료 값과 맞지 않아 문장째 지워졌다. 예전 종목 블록은 '30.0배'로 써서 드러나지 않았다.
- fix: figureSupported가 자료에 PER·PBR·PSR·PEG·EV/EBITDA로 이름 붙은 단위 없는 값을 답의 '배' 표기와 같은 수치로 본다. 지표와 종목이 같아야 한다는 조건은 그대로다(src/ai/response/publication.js MULTIPLE_METRICS).
- violated_rule: 자료의 표기를 바꾸면 그 자료를 근거로 답을 거르는 필터가 같은 표기를 읽는지 함께 확인한다.
- prevention: ci-ai-intelligence-contract-check 'v60.43 a multiple the stock row writes bare supports the same figure written with 배, for that metric and that stock only': 같은 종목·같은 지표는 통과, 다른 종목의 PER·같은 종목의 PBR 값·RSI는 통과하지 않는다. 수정 전 publication.js에서 실패함을 확인했다.
- verification/residual: node scripts/ci-ai-intelligence-contract-check.mjs (수정 전 파일로 되돌리면 실패). 실서비스 재평가는 배포 뒤 해당 문항만 다시 돌려 확인한다.
- files: src/ai/response/publication.js, scripts/ci-ai-intelligence-contract-check.mjs

## P2707 - v60.42 - 도구를 쓰는 AI 질문 하나가 하루 질문 한도를 두세 번 차감 (2026-11-22)

- symptom/reproduction: 도구를 쓰는 질문은 모델 요청이 2~3번 나가는데 요청마다 연결당 하루 150개, 전체 하루 300개 한도에서 한 번씩 차감됐다. 실제로 쓸 수 있는 질문 수가 절반 이하였다.
- root_cause: 공용 Worker의 한도 장부가 재시도 키(:retry1/2)만 면제하고 같은 질문의 도구 라운드(:r1, :r2), 도구 없는 대체 요청(:plain), 빈 답변 재작성(:w1) 키는 새 질문으로 셌다(v60.02에서 도구 루프를 붙일 때 장부를 맞추지 않음).
- fix: 같은 연결에서 오늘 집계된 질문의 이어지는 요청은 연결별·전체 하루 질문 수에서 뺀다. 금액 예약과 월 한도는 요청마다 그대로다. 허용 접미사는 질문 하나당 정해진 21가지로 닫혀 있고 그 밖의 키는 질문으로 센다(cloudflare-worker-proxy.js).
- violated_rule: R1
- prevention: 한도 장부 모델 검사에 이어지는 요청 전이를 넣었고, Worker 계약 테스트가 도구 라운드는 한도를 쓰지 않고 지어낸 접미사는 쓴다는 것을 검사한다.
- verification/residual: node scripts/ci-ai-ledger-model-check.mjs
- files: cloudflare-worker-proxy.js, scripts/ci-ai-ledger-model-check.mjs, worker/openai-contract.test.mjs

## P2706 - v60.42 - 도구가 있는 AI 채팅 턴에도 모든 자료를 미리 실어 지시문이 6만 자 (2026-11-21)

- symptom/reproduction: 실서비스에서 두 종목 수익률 비교 질문의 지시문이 6만 자(입력 약 3만 4천 토큰)였고 질문마다 두 번 전송됐다. 참고 자료 묶음 약 1만 9천 자, 근거 목록 1만 2천 자, 겹치는 규칙 블록이 대부분이었고 답변 준비에만 약 10초가 걸렸다.
- root_cause: v60.02에서 모델이 자료를 요청하는 도구를 붙였지만 그 전의 조립(질문을 보고 모든 자료를 미리 싣는 방식)을 그대로 두었다. 두 설계가 함께 돌아 같은 자료가 미리 실리고 도구로도 요청됐다.
- fix: 도구를 주는 턴은 짧은 지시문을 쓴다(src/ai/prompt/lean-prompt.js): 역할 다섯 줄, 화면의 시장 판정과 확정 종가, 질문에 나온 종목의 스크리너 행. 통합 리서치·기술 지표·재무·뉴스·섹터 비교·근거 목록은 미리 싣지 않고 도구로 읽는다(통합 리서치는 새 reference 도구). 도구가 없는 빠른 답변 턴은 기존 조립을 쓴다. 로컬 실측: 같은 질문 14,675자, 시장 상태 질문 12,008자.
- violated_rule: R1
- prevention: scripts/ci-chat-screen-tool-check.mjs가 짧은 지시문의 내용과 크기(도구 안내+종목 행+원칙 9천 자 미만), 미리 싣던 블록이 도구 턴에서 빠지는지를 검사한다.
- verification/residual: node scripts/ci-chat-screen-tool-check.mjs
- files: src/ai/prompt/lean-prompt.js, src/ai/tools/market-tools.js, src/ai/tools/registry.js, src/ai/response/answer-principles.js, src/app/chat-globals.js, js/aio-chat.js, scripts/ci-chat-screen-tool-check.mjs

## P2705 - v60.42 - 모든 AI 채팅 질문에 8천 자 학습 교재 블록이 실림 (2026-11-21)

- symptom/reproduction: 두 종목의 3개월 수익률 비교 질문의 지시문이 6만 자였고, 그중 8천 자가 질문과 무관한 시장 학습 교재였다. 지시문이 전송 한도에 닿아 요청마다 잘렸고, 잘린 길이가 달라 두 번째 요청이 캐시를 쓰지 못했다.
- root_cause: 교재 블록이 질문이 아니라 화면 목록으로 선택됐고 그 목록이 모든 화면을 덮었다(P1740이 AI 인프라 프레임에서 고친 것과 같은 종류).
- fix: 교재 블록은 질문이 그 주제(손절, 물타기, 주도주, 복기 등)를 물을 때만 싣는다(js/aio-chat.js).
- violated_rule: R1
- prevention: 실서비스 평가가 지시문 길이와 걸린 시간을 잰다. 참고 자료는 질문으로 고른다.
- verification/residual: node scripts/ci-ai-chat-reliability-contract-check.mjs
- files: js/aio-chat.js

## P2704 - v60.42 - AI 답변에서 앱에 있는 원달러 종가 문장이 빠지고 "**"가 남음 (2026-11-21)

- symptom/reproduction: 원달러 환율 질문에 앱의 11/20 종가 1,346.13원 문장이 "근거 수치 없음"으로 빠졌고, 답이 짝 없는 "**"와 "실시간 환율은 확인된 값이 없습니다"로 시작했다. 안내는 환율 문장을 "주가 문장"이라고 불렀다.
- root_cause: 종가 행의 단위 krw_per_usd가 단위 대조표에 없어 "원" 표기와 맞지 않았다. 문장 분리가 닫는 굵은 표시를 다음 문장에 붙여, 문장 하나를 빼면 표시가 홀수로 남았다.
- fix: 단위당 가격은 호가 통화로 대조한다(원달러는 원, 유가·금은 달러, 시세 행은 행의 통화). 굵은 표시는 문장마다 짝을 맞추고, 환율 주제를 따로 이름 붙인다(src/ai/response/publication.js).
- violated_rule: R1
- prevention: 게이트가 환율 종가 문장의 결속과, 굵은 구간 안 문장 제거 뒤 표시 짝을 확인한다.
- verification/residual: node scripts/ci-ai-intelligence-contract-check.mjs
- files: src/ai/response/publication.js

## P2703 - v60.42 - AI 답변의 "확인된 수치"에 내부 표기와 제공자 이름이 보임 (2026-11-21)

- symptom/reproduction: "NVDA · price: 125.53currency [live:yahoo-proxy · 2026-11-20T21:00:01.000Z]", "15.1배: 15.1배 [consensus tool · 2026-11-21]" 같은 줄이 답변에 보였다.
- root_cause: 수치 줄이 원시 값·내부 단위 단어·출처 식별자를 그대로 이어 붙였고, 시세 행에는 표시 이름이 없어 "티커 · price"로 떨어졌다.
- fix: 수치 줄은 독자 표기로 쓴다: "NVDA 종가: $125.53 [2026-11-20]", "삼성전자 종가: 183,100원". 제공자 이름은 쓰지 않고 날짜만 남긴다. 이름이 이미 값을 말하면 값을 두 번 쓰지 않는다. 숫자가 아닌 값은 확인된 수치로 올리지 않는다(src/ai/response/renderer.js, publication.js).
- violated_rule: R1
- prevention: 게이트가 시세·PER 줄의 표기와 문자열 값의 분류를 확인한다.
- verification/residual: node scripts/ci-ai-intelligence-contract-check.mjs
- files: src/ai/response/renderer.js, src/ai/response/publication.js

## P2702 - v60.42 - 앱 자료로 답한 AI 답변 위에 "최신 수치 확인 안 됨 — 일반 설명만"이 붙음 (2026-11-21)

- symptom/reproduction: 조건 검색 표나 날짜가 붙은 종가로 답한 답변 8개와 날씨 답변이 "최신 수치 확인 안 됨 — 일반 설명만"으로 시작했다.
- root_cause: 본문을 글로 받는 답변은 수치마다 형식화된 주장이 없어 항상 "계획 불일치"로 읽혔고, 한계 문구가 필터가 실제로 뺀 것이 아니라 그 판정을 따랐다. 세션 근거 안내도 게시된 주장이 있을 때만 생략됐다.
- fix: 한계 문구는 필터가 실제로 뺀 수치 문장을 따른다. 모든 수치가 필터를 통과했고 웹검색 수치가 없으면 세션 안내를 붙이지 않는다(src/ai/response/request-pipeline.js).
- violated_rule: R1
- prevention: 게이트가 근거 있는 글 답변과 날씨 답변에 문구가 없고, 지어낸 수치에는 남는지 확인한다.
- verification/residual: node scripts/ci-ai-intelligence-contract-check.mjs
- files: src/ai/response/request-pipeline.js

## P2701 - v60.42 - AI 채팅의 종목 PER·배당·수익률이 종목 화면 값과 다르거나 웹에서 옴 (2026-11-21)

- symptom/reproduction: 엔비디아 PER을 물으면 화면의 15.68이 아니라 컨센서스 조정 EPS 기준 15.1을 답했고, 마이크로소프트 배당과 삼성전자 50일선 위치는 웹검색 수치로 답했다. 평가의 종목 질문 통과율이 41%였다.
- root_cause: 종목 화면·스크리너 표에 보이는 행 값(PER, PBR, ROE, 배당수익률, 매출 성장률, 기간 수익률, 이동평균 대비)을 한 종목에 대해 읽는 도구가 없었다. screen 도구는 조건 검색만 받았다.
- fix: screen 도구에 symbols를 더해 지정 종목의 스크리너 행을 같은 엔진과 같은 조건 읽기로 돌려준다(미국·한국 모두, DB에 없는 종목은 이름을 밝힘). 도구 안내문은 화면 값을 먼저 말하고 다른 기준의 값은 기준을 밝혀 덧붙이게 한다.
- violated_rule: R1
- prevention: 게이트가 지정 종목 검색의 PER이 스크리너 행의 PER과 같은지 확인한다.
- verification/residual: node scripts/ci-chat-screen-tool-check.mjs
- files: src/ai/context/screener-query.js, src/ai/tools/market-tools.js, src/ai/tools/registry.js

## P2700 - v60.42 - AI 채팅 답변 10건 중 1건이 본문 없이 "문장이 남지 않았습니다"로 끝남 (2026-11-21)

- symptom/reproduction: 실서비스 60문항 평가에서 6개 답변이 "응답 길이 한도 — 일부만 표시 / 확인된 근거로 쓸 수 있는 문장이 남지 않았습니다"로 끝났다(시장 판정, 코스피, SMH, 삼성전자·SK하이닉스 비교, 애플 PER 후속 질문).
- root_cause: 현재 시점 질문에 주입 자료가 없으면 웹검색을 강제하는 규칙이 자료 도구보다 먼저 만들어져 그대로 남아 있었다. 모델이 도구로 종가를 받은 뒤에도 다음 요청은 웹검색만 허용하고 호출을 강제했고, 모델은 글을 쓰지 못한 채 추론 항목만 100개 내다가 제공자의 항목 한도(max_messages)에서 끊겼다. 클라이언트는 본문이 없는 끊긴 응답을 그대로 답으로 게시했다.
- fix: 자료 도구가 있는 답변에서는 독자가 검색을 요청했을 때만 검색을 강제한다(src/ai/research/native-search.js). 본문 없이 끊긴 응답은 낮은 추론 강도와 도구 호출 없음으로 한 번 다시 요청한다(src/ai/tools/loop.js rewriteEmpty).
- violated_rule: R1
- prevention: 실서비스 평가 실행기(scripts/ai-chat-eval.mjs)가 빈 답을 실패로 센다. 도구 루프 게이트가 본문 없이 끊긴 응답의 재요청을, 검색 게이트가 도구가 있을 때 강제 검색이 없음을 확인한다.
- verification/residual: node scripts/ci-ai-chat-reliability-contract-check.mjs
- files: src/ai/tools/loop.js, src/ai/research/native-search.js, js/aio-chat.js

## P2699 - v60.41 - 보유 종목 질문이 모델 호출 뒤에 'AI 안전 모드'로 바뀌고 채팅에서 동의할 방법이 없음 (2026-11-21)

- symptom/reproduction: '내 보유 종목 기준으로 지금 조심할 게 뭐야'를 물으면 29초 뒤 완성된 답이 'AI 안전 모드 … 동의 후에만'으로 바뀌었다. 채팅 안에는 동의 버튼이 없었고, 포트폴리오 화면 밖에서는 보유 종목이 답에 쓰이지 않았다.
- root_cause: 보유 종목 전송 동의를 답이 나온 뒤의 행동 검사가 확인했다. 질문이 개인 질문인지, 동의가 있는지를 모델 호출 전에 정하는 곳이 없었다.
- fix: 개인 질문 판정을 한 모듈(src/ai/context/personal-turn.js)로 모았다. 보유 종목이 있고 동의가 없으면 모델을 부르기 전에 채팅에서 한 번 묻고, '동의하고 답하기'와 '보유 종목 없이 답하기' 두 버튼이 같은 질문을 다시 보낸다. 동의한 사용자는 어느 화면에서든 보유·관심 종목이 질문과 함께 간다. 답이 나온 뒤 막던 검사는 지웠다.
- violated_rule: R1
- prevention: 동의가 필요한 자료는 호출 전에 정한다. 게이트가 동의 없는 보유 종목 질문이 모델 호출 없이 물음으로 끝나는지 확인한다.
- verification/residual: node scripts/ci-ai-intelligence-contract-check.mjs
- files: src/ai/context/personal-turn.js, src/ai/context/choosing-blocks.js, src/app/chat-globals.js, js/aio-chat.js, js/aio-core.js, js/aio-qa-audits.js

## P2698 - v60.41 - AI 답변이 JSON 한 덩어리여서 길이 제한에 잘리면 전부 버려지고 쓰는 동안 아무것도 보이지 않음 (2026-11-21)

- symptom/reproduction: '요즘 돈이 어디로 가고 있어'를 물으면 31초 뒤 '답변 형식이 완성되지 않아'만 나왔다. 답을 받는 동안 화면에는 대기 문구만 있었다.
- root_cause: 모델이 본문과 근거를 하나의 JSON 객체로 썼다. 끝이 잘리면 JSON이 닫히지 않아 본문까지 읽을 수 없었고, 닫히기 전에는 화면에 보여 줄 문장이 없었다.
- fix: 모델이 본문을 먼저 일반 글로 쓰고, 근거·출처·이어 물을 질문은 맨 끝의 한 블록으로 쓴다(src/ai/response/answer-envelope.js). 끝 블록이 없거나 깨져도 본문은 남는다. 쓰는 동안 본문을 같은 검사를 거쳐 0.35초마다 보여 주고, 끝나지 않은 마지막 문장은 보이지 않게 둔다. JSON 조각을 정규식으로 되살리던 복구 코드는 지웠다.
- violated_rule: R1
- prevention: 읽는 사람에게 보일 글은 구조 블록보다 먼저 온다. 게이트가 잘린 답, 깨진 끝 블록, 쓰는 중인 답에서 본문이 남는지 확인한다.
- verification/residual: node scripts/ci-ai-intelligence-contract-check.mjs && node scripts/ci-ai-chat-reliability-contract-check.mjs
- files: src/ai/response/answer-envelope.js, src/ai/response/claim-ledger.js, src/ai/response/publication.js, src/ai/response/request-pipeline.js, js/aio-chat.js, scripts/lib/answer-envelope-fixture.mjs

## P2697 - v60.41 - AI 채팅이 확정 종가를 2분 규칙으로 막아 앱에 있는 가격을 '확인된 가격 없음'으로 답함 (2026-11-21)

- symptom/reproduction: 장이 닫힌 뒤 'NVDA 어떤 회사고 지금 가격은 어디야'를 물으면 39초 뒤 가격을 답하지 않았다. 앱에는 종가 125.53과 고점 대비 -48.4%가 있었다.
- root_cause: 가격 사용 판정이 장중 시세용 규칙 하나였다. 관측이 2분 안이고 두 번째 출처가 확인해야만 쓸 수 있었고, 장 마감 뒤의 확정 종가도 같은 규칙으로 막혔다. 제품은 종가 기준인데 판정은 장중 기준이었다.
- fix: 가격 기준 판정을 한 함수(src/ai/time/quote-basis.js)로 모았다. 정규장이 끝났고 관측이 그 종가 시각이면 날짜를 붙인 종가로 쓴다. 장중에만 2분·두 출처 규칙이 남는다. 출처가 서로 다르면 어느 쪽이든 막는다. 시세가 없거나 관측 시각이 없으면 도구의 완성봉 종가를 쓰도록 안내한다.
- violated_rule: R1
- prevention: 가격 기준은 시장 세션으로 정한다. 게이트가 마감 뒤 종가 허용, 장중 2분 규칙, 출처 충돌 차단을 각각 확인한다.
- verification/residual: node scripts/ci-ai-evidence-contract-check.mjs
- files: src/ai/time/quote-basis.js, js/aio-data.js, js/aio-core.js, js/aio-chat.js, src/ai/research/native-search.js, src/ai/context/stock-trend-line.js

## P2696 - v60.41 - AI 채팅의 조건 검색이 스크리너와 다른 규칙을 써서 실제 72종목인 조건에 '결과 없음'을 답함 (2026-11-21)

- symptom/reproduction: 실서비스에서 '미국 대형주 중 PER 20 이하, 3개월 수익률 플러스'를 물으면 11초 뒤 결과 없음이 나왔다. 같은 조건을 스크리너 화면에 넣으면 72종목이다. 과매도는 매도 신호 종목으로, 시가총액이 없는 행은 소형주로 읽혔다.
- root_cause: 채팅의 screen 도구는 문장을 정규식으로 읽는 별도 엔진(src/ai/context/screener-query.js)이었고, 스크리너 화면의 조건 엔진(custom-conditions.js)과 시가총액 구간(row-presentation.js)을 쓰지 않았다. 같은 질문의 정의가 두 벌이었다.
- fix: screen 도구가 구조화된 조건(시장·규모·섹터·테마·지수·조건 33종·정렬·개수)을 받아 스크리너와 같은 엔진으로 실행한다. 정규식 엔진은 지웠다. 0건이면 어느 조건이 모두 걸렀는지, 자료가 없는 조건인지를 함께 돌려준다. 조건 읽기와 테마 별칭은 화면 코드에서 도메인으로 옮겨 화면과 채팅이 같이 쓴다.
- violated_rule: R1
- prevention: 같은 질문에 답하는 정의는 한 곳에 둔다. 게이트가 채팅 도구 결과와 스크리너 엔진 결과를 같은 행에서 비교한다.
- verification/residual: node scripts/ci-chat-screen-tool-check.mjs
- files: src/ai/context/screener-query.js, src/ai/tools/market-tools.js, src/domain/screener/condition-read.js, src/domain/screener/theme-aliases.js, src/domain/screener/row-presentation.js, scripts/ci-chat-screen-tool-check.mjs

## P2695 - v60.40 - v60.39 뒤에도 history.json이 매 주기 251행을 다시 씀: 재기록의 주된 경로는 공포·탐욕 지수 과거 그래프였음 (2026-11-21)

- symptom/reproduction: v60.39 배포 뒤 첫 수집 커밋(fb1748854)에서 420행 중 251행이 바뀌었고, 바뀐 것은 fg 필드의 확인 시각뿐이었다.
- root_cause: updateHistory가 CNN 과거 그래프의 1년치 점을 매 주기 새 수집 시각으로 덮어썼다. v60.39는 일봉 백필과 스크리너 폭 경로만 막았고, 수정 전 차이를 필드별로 나눠 보지 않아 이 경로를 놓쳤다.
- fix: 이미 기록된 점(값과 관측이 같은 점)은 확인 시각을 그대로 둔다. 같은 커밋에 적용하면 바뀌는 행이 251개에서 2개가 된다.
- violated_rule: R1
- prevention: 시각만 바뀌는 재기록을 고칠 때는 수정 전 실제 커밋 차이를 필드별로 세고, 배포 뒤 첫 커밋에서 다시 센다.
- verification/residual: node scripts/ci-history-field-time-contract-check.mjs
- files: scripts/producer/history.mjs

## P2694 - v60.39 - history.json이 매 주기 값은 0~3개만 바뀌는데 과거 250여 행의 확인 시각을 다시 찍어 통째로 새로 커밋됨 (2026-11-21)

- symptom/reproduction: 연속 커밋 다섯 건에서 값 셀은 0~3개, 확인 시각은 283~659개가 바뀌었다. 사흘간 147개 판이 묶음 기준 19.5MB로 저장소 증가의 가장 큰 몫이었다.
- root_cause: mergeBackfillBars가 같은 일봉을 다시 읽으면 값과 관측이 같아도 그 셀의 메타를 새 수집 시각으로 덮어썼다.
- fix: 값이 같고 확인 시각 말고는 메타가 같은 일봉은 같은 관측으로 보고 기존 기록을 그대로 둔다.
- violated_rule: R1
- prevention: 세션 모델 검사(B1)에 같은 관측 건너뛰기를 적고 지문을 갱신했다. 실제 history.json에 같은 일봉 9,313개를 다시 읽혀 파일이 바뀌지 않음을 확인했다.
- verification/residual: node scripts/ci-history-session-model-check.mjs
- files: scripts/producer/history.mjs, scripts/ci-history-session-model-check.mjs, architecture/model-check-coverage.json

## P2693 - v60.38 - 대가 보유의 Vanguard 카드가 그룹 전체 이름으로 영국 자회사 한 곳의 13F를 보여 줌 (2026-11-21)

- symptom/reproduction: 카드 이름은 Vanguard Group인데 보유 합계는 영국 법인(CIK 0001680208) 한 곳의 신고분이라 그룹 규모와 맞지 않는다.
- root_cause: manager-catalog의 표시 이름과 신고 법인 이름이 cik가 실제로 신고하는 법인과 달랐고, familyCiks는 어떤 수집기도 읽지 않았다.
- fix: 표시 이름과 신고 법인을 실제 신고 법인(Vanguard Asset Management, 영국)으로 바로잡고 쓰이지 않는 familyCiks를 지웠다. 본체 CIK로 바꾸는 것은 신고 여부를 확인한 뒤의 일로 남긴다.
- violated_rule: R1
- prevention: ci-masters-contract-check가 신고 법인 표기가 그 cik의 단일 법인을 가리키는지 본다.
- verification/residual: node scripts/ci-masters-contract-check.mjs
- files: public-data/masters/manager-catalog.json, public-data/masters/index.json, scripts/ci-masters-contract-check.mjs

## P2692 - v60.37 - 장중 뉴스와 종목 뉴스 메모가 정정 기사를 원 기사와 같은 사건으로 버릴 수 있음 (2026-11-21)

- symptom/reproduction: 발행된 데이터에는 아직 사례가 없다. 코드상 장중 속보 칸과 종목 뉴스 메모는 이미 실린 기사와 제목이 비슷한 정정 기사를 같은 사건으로 보고 싣지 않는다.
- root_cause: 본 뉴스 묶음의 같은 사건 판정은 정정 기사를 제외하지만, 같은 파일의 selectNewsIntraday와 selectTickerNewsMemo는 그 제외 없이 newsSameEvent를 불렀다.
- fix: 두 경로 모두 정정 기사(isNewsRevisionRow)는 같은 사건 판정에서 뺀다. R702 문구를 이 동작에 맞췄다.
- violated_rule: R702
- prevention: R702가 발행 선택의 같은 사건 기준과 정정 기사 예외를 코드 이름과 함께 적는다.
- verification/residual: node scripts/ci-news-ranking-check.mjs
- files: scripts/lib/news-selection.mjs, _context/RULES.md

## P2691 - v60.36 - 설정되지 않은 relay를 화면에 들어갈 때마다 다시 호출 (2026-11-21)

- symptom/reproduction: 매크로·기술적 분석·테마 화면에 들어갈 때마다 /relay?provider=bok, kosis가 503을 받았다.
- root_cause: Worker에 한국은행·KOSIS 키가 없는데 클라이언트는 성공해야만 결과를 기억해서, 실패한 호출을 매 진입과 30분 주기로 되풀이했다.
- fix: /health가 그 provider를 미설정으로 알리거나 그 페이지에서 'not configured' 503을 받았으면 relay 주소를 주지 않아 기존 '경로 없음' 폴백으로 간다. 일시적 503은 기억하지 않는다.
- violated_rule: 가볍게 유지한다 (PRODUCT.md 원칙 6)
- prevention: ci-proxy-continuity-check가 미설정 provider에 relay 주소가 나오지 않는지 확인한다.
- verification/residual: node scripts/ci-proxy-continuity-check.mjs
- files: src/data/providers/proxy-transport.js

## P2690 - v60.36 - 13F 보유 금액이 일부 운용사에서 1000배 작게 수집됨 (2026-11-21)

- symptom/reproduction: T. Rowe Price, Duquesne, Baupost의 보유 금액이 주당 1달러 미만으로 계산될 만큼 작았다(T. Rowe Price 합계 9.9억 달러, 실제 약 9,937억 달러).
- root_cause: 수집기 두 곳이 정보표의 value를 모두 달러로 읽었다. 이 신고들은 천 달러 단위로 적혀 있고 표지 합계도 같은 단위라 기존 합계 대사로는 잡히지 않았다.
- fix: 신고 한 건마다 주식 행의 value/shares 중앙값이 0.001~1달러이면 천 달러 신고로 보고 행 값과 표지 합계를 1000배 한다(scripts/lib/13f-value-unit.mjs). 운용사 이름은 보지 않는다.
- violated_rule: 사실이 맞아야 한다 (PRODUCT.md 원칙 1)
- prevention: pipeline-semantics MASTERS-13F-UNIT-01이 천 달러 신고와 달러 신고, 재적용 시 불변을 확인한다.
- verification/residual: node scripts/ci-pipeline-semantics-check.mjs
- files: scripts/lib/13f-value-unit.mjs, scripts/collect-13f-reference.mjs, scripts/collect-13f-history-rows.mjs

## P2689 - v60.35 - 기술적 분석 대표 종목 카드가 화면 밖이면 영영 '불러오는 중' (2026-11-20)

- symptom/reproduction: 실서비스 데스크톱에서 대표 종목 카드 10개 중 8개가 '불러오는 중'으로 남았고, 빠르게 스크롤해 지나친 카드(META, GOOG, LLY)는 끝까지 그려지지 않았다.
- root_cause: 카드마다 화면에 들어올 때만 일봉을 요청했는데, 대기 중인 카드도 '불러오는 중'으로 표시했고 건너뛴 카드는 다시 관측되지 않았다.
- fix: 대표 종목 보기가 보이면 모든 카드가 동시 4건 한도의 대기열로 일봉을 받는다. 카드별 스크롤 관측은 지웠다.
- violated_rule: 화면 검증은 실서비스·사용자 관점으로 (CLAUDE.md 작업 규칙)
- prevention: ci-architecture-browser-check가 대표 종목 보기를 연 뒤 모든 카드가 그려지는지 본다.
- verification/residual: node scripts/ci-architecture-browser-check.mjs
- files: src/ui/components/market-candles.js, src/ui/pages/charts.js

## P2688 - v60.32 - v60.31 push 뒤 배포가 8시간 반 멈춤: 종목 화면 검사가 회사 설명이 오기 전에 읽어 CI에서 실패했고, 이후 데이터 갱신 42회가 옛 코드와 새 데이터 조합으로 실패 (2026-11-20)

- symptom/reproduction: v60.31 소스 push(d6b2081e2)의 CI에서 browser-entity-quality가 두 번 실패(사업 설명 자료 없음, 출처 링크 없음). 그 뒤 데이터 갱신 실행마다 operations-status 검사가 nativeLazyOwner 불일치로 실패했고 실서비스는 v60.30, 데이터는 517분 묵음.
- root_cause: (1) ci-entity-quality-browser-check가 섹션 수만 기다린 뒤 읽었는데, 종목 개요의 상장 설명과 출처 링크는 섹션보다 늦게 도착한다. 로컬은 빠르게 지나가고 CI는 그 사이를 읽었다. (2) 데이터 갱신 CI는 마지막으로 통과한 코드에 새 데이터를 얹어 검사하므로, 새 릴리스가 한 번도 통과하지 못하면 v60.30 route-owners와 v60.31 operations-status가 만나 매번 실패한다. (3) 재구성 직후가 아니라 배치 끝에 전체 QA를 돌려 옛 구조를 고정한 브라우저 검사 9개를 push 직전에야 발견했다.
- fix: 검사가 출처 링크(설명 도착의 표시)까지 기다린 뒤 읽는다. 수정 push(aa0e81ae5)로 소스 CI가 통과해 배포와 데이터 갱신이 풀렸다. 브라우저 데이터 고정본은 새 구조(화면별 AI 읽기)로 다시 잡고 브라우저 6묶음을 로컬에서 통과시킨 뒤 push했다.
- violated_rule: 검사는 읽으려는 내용이 도착한 뒤에 읽는다. 소스 push 뒤에는 CI가 통과할 때까지 본다: 통과하지 못한 릴리스는 이후 데이터 갱신 전체를 막는다.
- prevention: ci-entity-quality-browser-check의 대기 조건이 읽는 대상(출처 링크)을 포함한다. 화면 구조를 바꾼 배치는 구현 직후 브라우저 묶음을 한 번 돌린다(배치 끝이 아니라). 고정본을 다시 잡으면 qa-runner --group browser-* 여섯 묶음을 로컬에서 돌린다(affected는 고정본 파일만으로 브라우저 묶음을 고르지 않는다).
- verification/residual: node scripts/ci-entity-quality-browser-check.mjs (6 cases PASS); CI run for aa0e81ae5 success; live version.json v60.31; qa-runner --group browser-unit|runtime|knowledge|resilience|viewport|surface exit 0 on the d0bbbcae3 pin.
- files: scripts/ci-entity-quality-browser-check.mjs, architecture/browser-data-fixture.json

## P2687 - v60.31 - 캔들 차트의 마지막 봉이 매물대 막대 밑에 깔리고, 현재가·52주 고점 라벨이 가격 축 눈금 숫자와 겹침 (2026-11-19)

- symptom/reproduction: 소유자 2026-11-19: 종목 분석 차트와 기술적 분석 일봉 카드에서 최근 봉들이 오른쪽 매물대(volume profile) 막대 아래에 그려져 보이지 않고, 가격 축의 현재가 라벨(예: 656.95)이 650.00 눈금 위에 겹쳐 두 숫자가 함께 읽히지 않음. 52주 고점 등 기준선 라벨도 같음.
- root_cause: (1) stock-chart-layers.js의 매물대는 플롯 오른쪽 20%(최대 150px)를 덮는 캔버스 층인데, 보이는 범위(showRecent, 카드 setVisibleLogicalRange)는 마지막 봉에서 끝나 최근 약 20% 봉이 그 밑에 놓였다. (2) 현재가는 라이브러리 lastValueVisible 축 라벨, 기준선은 createPriceLine의 axisLabelVisible 축 라벨로 그려졌다. 고정 바이트(_artifacts/entity-quality-20261012/browser-lightweight-charts.js, 4.2.0)에서 축 라벨은 눈금 라벨 위에 그대로 덧그려지고, 가격선 title은 axisLabelVisible이 꺼지면 그리지 않는다(조기 반환). 라벨 아래 눈금을 숨기는 옵션은 없다.
- fix: recentLogicalRange(length, count)가 매물대 폭(PROFILE_SHARE)만큼 오른쪽 여백 논리 범위를 더해 마지막 봉의 오른쪽 끝이 매물대 왼쪽보다 왼쪽에 오게 한다(분석 자리 130봉, 카드 90봉; 카드는 minBarSpacing 2, 두 차트 모두 lockVisibleTimeRangeOnResize). 현재가 축 라벨(lastValueVisible)과 기준선 축 라벨(axisLabelVisible)을 끄고, 같은 값을 플롯 오른쪽 안쪽의 태그로 그린다(현재가는 상승·하락 색 채움, 기준선은 선 색). 태그는 서로 겹치지 않게 쌓고, 그린 위치를 layers.geometry()로 내보낸다.
- violated_rule: 차트 위의 겹 층과 라벨은 데이터를 가리지 않는다: 마지막 봉은 덮는 층 밖에 그리고, 값 라벨은 다른 숫자와 겹쳐 그리지 않는다.
- prevention: scripts/ci-chart-scale-browser-check.mjs labelChecks: 6개 뷰포트·테마에서 지수 카드 4장과 분석 자리 차트마다 마지막 봉 오른쪽 x ≤ 매물대 왼쪽 x, lastValueVisible false, 현재가 태그 존재, 모든 태그가 플롯 안, 태그끼리 겹치지 않음을 단언한다. 고친 전 코드에서 실패하는지는 이번 스레드에서 따로 돌려 보지 않았다.
- verification/residual: node scripts/ci-chart-scale-browser-check.mjs (6 cases PASS), node scripts/ci-entity-quality-browser-check.mjs, node scripts/ci-theme-research-browser-check.mjs; 전후 스크린샷 _artifacts/verify-aio/charts-restructure-20261119/
- files: src/ui/components/stock-chart-layers.js, src/ui/components/stock-chart.js, src/ui/components/market-candles.js, scripts/ci-chart-scale-browser-check.mjs

## P2686 - v60.31 - 차트가 스케일이 안 맞거나 깨져서 나옴: 오늘 지수 줄 캔들이 왼쪽에 몰리고, 기술적 분석 일봉 카드는 오른쪽이 비고 높이가 어긋나며, 가격 눈금 끝 값이 잘림 (2026-11-19)

- symptom/reproduction: 소유자 2026-11-19 스크린샷(다크, 1690~1920px). 라이브 1690x940 다크에서 재현: 오늘 지수 줄 SPY·QQQ·IWM 카드가 '11/18(수) 마감'인데 봉 15·18·15개가 차트 왼쪽 1/5에만 그려지고 16시 종가 봉이 10시 40분 옆에 붙음(SOXX만 79개). 기술적 분석 일봉 카드 3장은 캔버스 402px 중 가격 축이 76px라 플롯이 326px로 오른쪽이 비어 보이고, SPY만 칩이 두 줄이 되며 차트 시작선이 25px 아래(330/355/330), 좌하단 라이브러리 로고가 캔들을 가림, SPY 카드 맨 아래 눈금 660.00이 잘림. 종목 차트(NVDA 일봉)는 맨 아래 눈금 120.00이 잘림.
- root_cause: (1) home-index-strip.js chartSvg가 캔들을 시각이 아니라 배열 순서(i * step)로 놓았다. Yahoo가 마감 세션 5분봉의 OHLC를 대부분 null로 보내는 응답(SPY 79개 중 64개, QQQ 61개; Worker가 120초 캐시)을 걸러내면 남은 봉이 앞쪽에 붙고 16시 봉이 10:40 자리에 그려졌다. (2) stock-chart-layers.js가 스터디 칸과 축을 맞추려는 minimumWidth 76px를 칸이 없는 compact 카드에도 걸었다. (3) market-candles.js 카드가 라이브러리 기본 attributionLogo를 그대로 켜 두었다. (4) chart-quality.css의 카드가 flex 열이라 칩 줄 수에 따라 차트 시작 위치가 카드마다 달랐다. (5) 캔들 차트의 가격 축이 entireTextOnly 없이 그려져 패널 끝에 걸친 눈금 라벨이 반쯤 잘렸다.
- fix: sessionModel이 각 봉에 뉴욕 9:30 기준 5분 슬롯(0~78)을 붙이고 chartSvg·시간 눈금은 그 슬롯으로 그린다(빈 구간은 비워 두고 채우지 않으며, 빈 봉이 있으면 머리 칩 hover에 적음). compact 카드는 축 최소 폭을 걸지 않고(52px), 로고를 끄고 기술적 분석 데이터 출처에 Lightweight Charts 표기를 둔다. 카드는 subgrid 다섯 줄을 공유해 한 줄의 차트가 같은 선에서 시작한다. stock-chart.js PRICE_SCALE(entireTextOnly)을 일봉·분봉 차트가 함께 쓰고 스터디 칸도 같은 옵션을 쓴다. Worker(cloudflare-worker-proxy.js)는 Yahoo chart 응답의 종가가 절반 넘게 null이면 엣지 사본을 지나는 일회용 키로 한 번 다시 요청해(캐시하지 않음) 온전한 응답을 돌려주고, 그래도 비어 있으면 no-store로 내보낸다.
- violated_rule: 차트는 데이터의 시간과 크기 그대로 그린다: 시간축 위치는 배열 순서가 아니라 시각에서, 카드 차트는 카드 폭을 채우고 쓰지 않는 축 폭을 예약하지 않으며, 눈금 라벨은 잘린 채 그리지 않는다.
- prevention: scripts/ci-chart-scale-browser-check.mjs(qa-pipeline browser-chart-scale): 11/18 SPY와 같은 null 5분봉 픽스처와 고정 라이브러리 바이트로 6개 뷰포트·테마에서 16시 봉이 오른쪽 끝(>97%)·10:35 봉이 제자리(<20%), 카드 차트 폭 ≥ 카드 차트 상자 95%, 카드 가격 축 ≤ 60px, 같은 줄 카드의 차트 시작선·높이 차 ≤ 1px, 카드 로고 없음과 데이터 출처 표기, 종목 차트 entireTextOnly를 단언한다. 고치기 전 코드(HEAD 워크트리)에서 모든 단언이 실패하고 고친 뒤 통과함을 확인했다. ci-esm-core-unit-check에 null 구간을 건너는 슬롯·missing 단위 단언 추가.
- verification/residual: node scripts/ci-chart-scale-browser-check.mjs (6 cases PASS; HEAD 워크트리에서 FAIL 확인), node scripts/ci-esm-core-unit-check.mjs, node scripts/ci-entity-quality-browser-check.mjs, node scripts/ci-screen-rereview-browser-check.mjs, node scripts/ci-desktop-continuity-check.mjs, node scripts/ci-runtime-contract-check.mjs, node scripts/ci-fold-kind-check.mjs, node scripts/ci-control-char-check.mjs, node scripts/ci-data-audit-contract-check.mjs, node scripts/ci-csp-meta-check.mjs
- files: src/ui/components/home-index-strip.js, src/ui/components/stock-chart.js, src/ui/components/stock-chart-layers.js, src/ui/components/market-candles.js, src/ui/components/page-sources.js, src/ui/styles/chart-quality.css, scripts/ci-chart-scale-browser-check.mjs, scripts/ci-esm-core-unit-check.mjs, architecture/qa-pipeline.json, cloudflare-worker-proxy.js, scripts/ci-worker-relay-check.mjs

## P2685 - v60.30 - v60.30 오늘·브리핑 이야기 날짜 표기가 지수 세션을 종목 세션 날짜로 적음 (2026-11-18)

- symptom/reproduction: 2026-11-18 병합 뒤 자료에서 일일 요약의 날짜 표기가 '11/16 마감'인데 그 아래 지수 문장은 11/17 종가였다. 지수 가격은 11/17, 종목·묶음 등락은 스크리너 세션인 11/16이었다.
- root_cause: src/domain/briefing/day-account.js: 날짜 표기를 원장의 sessions.us(스크리너 팩터 세션) 하나로 찍었다. 지수 봉과 종목 등락은 원천이 달라 한 세션 어긋날 수 있는데 표기는 하나뿐이었다.
- fix: sessionLabel: 지수 가격 사실의 날짜와 종목 세션이 같으면 'M/D 마감', 다르면 '지수 M/D 마감, 종목 M/D 마감'으로 둘 다 적고 각자 주장(us-session, us-movers)을 갖는다. scripts/lib/claim-facts.mjs가 us-movers를 종목·묶음 등락 사실의 날짜로 확인한다.
- violated_rule: 날짜 표기는 그 아래 수치가 나온 자료의 날짜와 같아야 한다.
- prevention: scripts/ci-sentence-claim-replay-check.mjs (v60.30) f-asof: 게시된 원장에서 날짜 표기 주장이 지수 가격 사실과 종목 등락 사실의 날짜와 각각 일치해야 한다. 고치기 전 코드는 병합된 자료에서 1건 실패한다.
- verification/residual: ci-sentence-claim-replay-check, ci-esm-core-unit-check, ci-market-reading-week-fixture, ci-boot-bundle-budget-check exit 0. 로컬 브라우저 오늘 화면에서 '지수 11/17 마감, 종목 11/16 마감' 확인.
- files: src/domain/briefing/day-account.js, scripts/lib/claim-facts.mjs

## P2684 - v60.30 - v60.30 Korean theme criteria count only the criteria that apply, and an unknown dot differs from an unmet one (2026-11-18)

- symptom/reproduction: Every Korean theme in the 시나리오 table read "x/6, 미확인 3" (e.g. "3/6, 미확인 3"), and the dots drew an unknown criterion the same as an unmet one.
- root_cause: src/domain/scenarios/theme-criteria.js themeCriteria read three inputs a Korean theme never has: the row's 6-month median (theme-playbook.js builds KR rows with ret6m null because the KR stage reads 3개월·1개월), the consensus artifact and the earnings calendar (both US listings only; theme-playbook-view.js passes no calendar for KR). theme-playbook-view.js drew dots as met for i < met and plain otherwise.
- fix: The relative-strength 6-month leg falls back to the members' own 6-month median (screener rows carry ret6m for .KS/.KQ; the KOSPI 6-month return comes from history) when at least three members carry it. CRITERIA_MARKETS scopes 이익 전망 방향 and 촉매 to US, so a Korean theme is counted out of 4. criteriaDots draws met (filled), unmet (faint) and unknown (hollow ring, --color-text-secondary in both themes) in that order. The Korean stage itself is unchanged.
- violated_rule: A criterion whose source does not cover a market is not counted for it; a missing value is shown as unknown, never as unmet.
- prevention: ci-domain-parity-check v60.30 THEME_CRITERIA_MARKET_SCOPE (a KR theme reads "3/4" with all four known; a US theme without consensus or calendar still reads "4/6, 미확인 2") and THEME_CRITERIA_UNKNOWN_DOT (dot classes is-met, is-unmet, is-unknown and the hollow is-unknown rule).
- verification/residual: node scripts/ci-domain-parity-check.mjs and ci-scenario-guidance-fixture exit 0; node --check on the edited files.
- files: src/domain/scenarios/theme-criteria.js, src/ui/components/theme-playbook-view.js, src/ui/styles/themes-page.css, scripts/ci-domain-parity-check.mjs

## P2683 - v60.30 - v60.30 the 최근 바뀜 badge is separated from the stage-flow text in the DOM (2026-11-18)

- symptom/reproduction: In the 시나리오 tab table the stage-flow cell's text and badge ran together for copy and screen readers: "13거래일째, '동행'에서최근 바뀜".
- root_cause: src/ui/components/theme-playbook-view.js stageFlowCell appended the badge span directly after the text span; the only gap was the badge's CSS margin, which is not text.
- fix: stageFlowCell appends a text-node space before the badge (accessible text "…'동행'에서 최근 바뀜"); the badge margin in themes-page.css drops from 6px to 2px so the visual gap stays about the same. stageFlowCell is exported for the check.
- violated_rule: Adjacent text and badges are separated in the DOM, not by CSS spacing alone.
- prevention: ci-domain-parity-check v60.30 STAGE_FLOW_CHIP_SEPARATED renders the cell on a text-concatenating DOM and requires "'동행'에서 최근 바뀜".
- verification/residual: node scripts/ci-domain-parity-check.mjs exits 0; ci-decision-frame-check and ci-esm-core-unit-check exit 0.
- files: src/ui/components/theme-playbook-view.js, src/ui/styles/themes-page.css, scripts/ci-domain-parity-check.mjs

## P2682 - v60.30 - v60.30 the 기술적 분석 header dates the page by the US cards' latest drawn bar (2026-11-18)

- symptom/reproduction: During the 11/18 US session the charts page header read "11/18 종가 · 일봉" while the US index cards drew the 11/17 bar; the stock-table caption compared its rows against the same date and could name an unfinished US session as pending.
- root_cause: src/ui/pages/charts.js took the page basis as the latest asOf across every index card. The Korean cards (코스피, 코스닥) close about 15 hours before the US cards, so during the US session their newer close dated a page whose US cards still drew the previous session.
- fix: src/domain/technical/market-charts.js chartsPageBasis(readings) returns the latest completed bar the US cards draw (close-series.js closeSessionMarket), falling back to the latest drawn bar without a US card; charts.js uses it for the header and the stock-table comparison, and a card on another date keeps its own date chip.
- violated_rule: A page's as-of date is the date of the bars it draws for its lead market, never the newest date of another market's series.
- prevention: ci-domain-parity-check v60.30 CHARTS_HEADER_BAR_DATE: US cards on 11/17 with Korean cards on 11/18 must give 11/17, and charts.js must read chartsPageBasis.
- verification/residual: node scripts/ci-domain-parity-check.mjs exits 0; ci-esm-core-unit-check and ci-metric-consistency-check exit 0; node --check on the edited files.
- files: src/domain/technical/market-charts.js, src/ui/pages/charts.js, scripts/ci-domain-parity-check.mjs

## P2681 - v60.30 - v60.30 the S&P 500 map as-of chip names the pending session like the other theme tabs (2026-11-18)

- symptom/reproduction: On 테마와 섹터 (2026-11-18) the 테마 순위 and 시나리오 tabs read "11/16 종가, 11/17 반영 전" while the 지도 tab read "11/16 종가, 반영 전" with the pending date missing.
- root_cause: src/ui/components/sector-map.js built its chip from its own template literal instead of the shared as-of formatter session-lag.js sessionChipText that theme-strength.js and theme-playbook-view.js use, and the literal had no pending date.
- fix: sector-map.js passes the map basis and, when the map is behind, its expected session to sessionChipText; the hover text is unchanged.
- violated_rule: One as-of label per meaning: a screen's tabs format the same basis through one formatter.
- prevention: ci-domain-parity-check v60.30 SECTOR_MAP_ASOF_CHIP fails when sector-map.js does not import sessionChipText or still carries the bare '종가, 반영 전' literal.
- verification/residual: node scripts/ci-domain-parity-check.mjs exits 0; node --check on the edited file.
- files: src/ui/components/sector-map.js, scripts/ci-domain-parity-check.mjs

## P2680 - v60.30 - 공용 이동 링크(flow-next-link)와 종목 개요 근거 링크가 375px에서 24px보다 낮음 (2026-11-18)

- symptom/reproduction: 2026-11-18 375px 폭: 홈 링크 약 82x16, 시그널 163x24, 종목 100x19, 종목·매크로의 인라인 링크 여러 개가 24px 미만이었다.
- root_cause: index.html .page .flow-next-link(모든 화면의 '다음' 링크·page-lens__link의 공용 모양)가 padding 0, 높이 지정 없이 글자 높이(12~14px 글꼴 → 16~19px)만 가졌다. src/ui/styles/entity-quality.css의 24px 규칙은 button.stock-read-point-link에만 걸려, 같은 클래스의 a(종목 개요 근거 원문 링크, stock-read.js)는 빠졌다.
- fix: .page .flow-next-link에 display: inline-flex; align-items: center; min-height: var(--touch-min)(layout-primitives.css의 프로젝트 최소 24px)을 더했다. entity-quality.css 규칙을 .stock-read-point-link(버튼과 링크 모두)로 넓히고 높이를 var(--touch-min)로 맞췄다. 한 화면용 규칙은 더하지 않았다.
- violated_rule: 손가락으로 누르는 대상은 --touch-min(24px) 이상(WCAG 2.5.8) — 공용 모양에서 정한다.
- prevention: 기존 scripts/ci-ui-render-hygiene-check.mjs·ci-touch-ergonomics-browser-check.mjs(브라우저 게이트, 이번에는 실행하지 않음)가 24px 미만 대상을 잡는다. 이 둘은 문장 안 인라인 링크를 면제하므로, 새 정적 검사는 더하지 않았다.
- verification/residual: CSS만 바뀜. 브라우저 측정은 하지 않음(브라우저 QA 금지 지시) — 배치 통합 때 hygiene·touch 게이트로 확인 필요.
- files: index.html, src/ui/styles/entity-quality.css

## P2679 - v60.30 - 명령 검색에서 '삼성'을 치면 용어 KOSPI가 결과에 나옴(정의 문장 일치) (2026-11-18)

- symptom/reproduction: 2026-11-18 명령 검색에 '삼성'을 입력하면 용어 묶음에 KOSPI가 나왔다. KOSPI 정의('… 삼성전자, SK하이닉스 등 포함')에 '삼성'이 있었기 때문이다.
- root_cause: src/ui/navigation/command-search.js matchTerms: 이름·별칭이 맞지 않아도 정의 문장에 질의가 들어 있으면 두 글자 질의에서도 결과로 냈다. 같은 화면의 리서치 묶음(knowledge-search.js searchKnowledgeIndex 본문 일치, 점수 20~25)도 같은 약한 일치를 냈다.
- fix: matchTerms: 정의만 맞는 결과는 질의가 DEFINITION_MIN_QUERY(3)자 이상일 때만 낸다. 이름·별칭 일치는 그대로 먼저 온다. 명령 검색의 리서치 묶음도 본문만 맞는 결과(점수 50 미만)에 같은 하한을 쓴다. 용어 사전·리서치 서가의 자체 검색은 바꾸지 않았다.
- violated_rule: 검색 결과는 이름 일치가 먼저이고, 설명 문장 일치는 더 강한 질의에서만 보인다.
- prevention: scripts/ci-search-surface-contract.mjs v60.30: matchTerms('삼성', [KOSPI])는 빈 결과, matchTerms('삼성전자', [KOSPI])는 KOSPI. 이전 코드는 '삼성'에서 KOSPI를 내 실패한다.
- verification/residual: node --check; node scripts/ci-search-surface-contract.mjs OK. 브라우저 확인은 하지 않음.
- files: src/ui/navigation/command-search.js, scripts/ci-search-surface-contract.mjs

## P2678 - v60.30 - 포트폴리오 중복 종목 창이 '10주 @ 150 통화 미입력'으로 쓰고, 통화를 안 적은 단가와 USD 단가를 다른 통화로 보아 합치기를 막음 (2026-11-18)

- symptom/reproduction: 2026-11-18 포트폴리오에서 보유 종목을 다시 추가하면 창이 '보유 10주 @ 150 통화 미입력' 같은 기호·코드 문장을 썼다. 통화를 비운 기존 단가와 USD로 적은 새 단가는 같은 달러 상장인데도 '매수 단가 통화가 달라(통화 미입력, 입력 USD)'로 합칠 수 없다고 했다.
- root_cause: src/ui/panels/portfolio-duplicate-holding.js lot: '수량주 @ 단가 통화코드'를 그대로 찍고 비어 있는 통화를 '통화 미입력'으로 불렀다. src/domain/portfolio/holding-merge.js holdingMergeBlocker는 통화 빈칸을 상장 통화로 읽는 표(surface.js costCurrency 대체 규칙)와 달리 빈칸과 코드를 문자열로만 비교했다.
- fix: lot이 '수량 10주, 매수 단가 150'으로 쓰고, 통화는 상장 통화와 다를 때만 '원'·'달러'(그 밖은 코드)로 붙인다. 통화가 다른 경우의 문장은 '보유 달러, 입력 원'처럼 이름으로, 빈칸은 '상장 통화(달러)'로 쓴다. holdingMergeBlocker는 빈칸을 그 종목의 상장 통화(fx.js listingCurrency)로 읽고 비교한다 — 상장 통화를 모르는 6자리 코드는 이전처럼 막는다.
- violated_rule: 화면 문장은 기호·코드 대신 쉬운 한국어로, 같은 규칙(통화 빈칸 = 상장 통화)은 모든 소비자가 같이 읽는다.
- prevention: scripts/fixtures/pipeline-semantics/portfolio.mjs v60.30: 통화 빈칸 150과 USD 160의 NVDA가 합쳐지고 문장에 '@'·'통화 미입력'·'달러'·'USD'가 없으며 '보유 수량 10주, 매수 단가 150)'을 담는다; 원화 단가의 미국 종목은 '매수 단가 200,000원'. v60.28 검사 문구도 새 문장으로 갱신. 이전 코드는 '@'로 실패한다.
- verification/residual: node --check; node scripts/ci-pipeline-semantics-check.mjs --only portfolio 통과. 브라우저 확인은 하지 않음.
- files: src/ui/panels/portfolio-duplicate-holding.js, src/domain/portfolio/holding-merge.js, scripts/fixtures/pipeline-semantics/portfolio.mjs

## P2677 - v60.30 - 포트폴리오 오늘 칸이 종가 평가 종목에 숫자 대신 '종가 기준'이라는 문구를 표시함 (2026-11-18)

- symptom/reproduction: 2026-11-18 포트폴리오 보유 종목 표: 실시간 시세 없이 종가로 평가한 종목의 오늘 칸이 모두 '종가 기준'. 같은 종가 자료에 그 거래일의 전일 대비 변화(ret1d)가 있는데 보이지 않았다.
- root_cause: src/ui/pages/portfolio.js screenerCloseOf가 종가 가격과 날짜만 넘기고 그 종가의 하루 변화는 넘기지 않았다. src/domain/portfolio/surface.js holdingValue도 종가 평가 행에 변화 값을 두지 않아 표가 문구로 대신했다.
- fix: screenerCloseOf가 { price, date, changePct: row.ret1d }를 넘기고 surface.js holdingValue가 종가 평가 행에 closeChangePct(그 종가의 전 거래일 대비, closeDate로 날짜)를 둔다. dailyPct·dailyPctEligible과 머리의 '오늘'은 실시간 시세 규칙 그대로다. 표의 오늘 칸은 실시간 변화가 없고 종가 변화가 있으면 '-1.20% (11/16)'처럼 날짜와 함께 쓰고, 마우스 설명은 '11/16 종가의 전 거래일 대비 변화'라고 말한다. 종가 변화가 없으면(요청형 종가 등) 기존 '종가 기준'.
- violated_rule: 알려진 값은 문구로 대신하지 않는다 — 값과 그 기준일을 함께 보인다.
- prevention: scripts/fixtures/pipeline-semantics/portfolio.mjs v60.30: 종가 평가 두 종목(ret1d -1.2, +0.5, 11/16)의 오늘 칸이 ['-1.20% (11/16)', '+0.50% (11/16)']. 이전 코드는 '종가 기준'으로 실패한다.
- verification/residual: node --check; node scripts/ci-pipeline-semantics-check.mjs --only portfolio 통과. 부팅 묶음 밖 파일만 바뀜(측정). 브라우저 확인은 하지 않음.
- files: src/ui/pages/portfolio.js, src/domain/portfolio/surface.js, scripts/fixtures/pipeline-semantics/portfolio.mjs

## P2676 - v60.30 - 포트폴리오 요약 줄이 모든 종목이 종가 평가일 때 종목 수를 두 번 말함 (2026-11-18)

- symptom/reproduction: 2026-11-18 포트폴리오: '6종목 평가 완료, 6종목은 실시간 시세 대신 11/16 종가 기준'.
- root_cause: src/ui/pages/portfolio.js closeNote: 종가로 평가한 종목 수를 늘 'N종목은 …'으로 붙였고, 그것이 보유 종목 전체와 같은지 보지 않았다.
- fix: closeNote: 종가 평가 수가 보유 종목 수와 같으면 ', 모두 11/16 종가 기준'으로 쓴다. 일부만 종가일 때는 기존 문장을 쓴다.
- violated_rule: 같은 사실은 한 줄에서 한 번만 말한다.
- prevention: scripts/fixtures/pipeline-semantics/portfolio.mjs v60.30: 두 종목이 모두 종가 평가인 포트폴리오를 가짜 DOM에 올리면 상태 줄이 '2종목 평가 완료 … , 모두 11/16 종가 기준'으로 끝나고 '2종목은'이 없다. 이전 코드는 '2종목은'으로 실패한다.
- verification/residual: node --check; node scripts/ci-pipeline-semantics-check.mjs --only portfolio (34 cases) 통과. 브라우저 확인은 하지 않음.
- files: src/ui/pages/portfolio.js, scripts/fixtures/pipeline-semantics/portfolio.mjs

## P2675 - v60.30 - 종목 개요 위치 칸이 52주 범위 21%를 '부담'으로 표시함 (2026-11-18)

- symptom/reproduction: 2026-11-18 종목 개요 위치 칸: '52주 범위 21%'(52주 고점 대비 -32.6%) 옆 칩이 '부담'. 범위 안의 자리는 측정값인데 위험 판정 단어가 붙었고, 무엇을 쟀는지(범위 하단)는 말하지 않았다.
- root_cause: src/domain/entity/stock-read.js buildStockRead 'range' 점: 위치 0.4 미만을 tone 'burden', 0.6 이상을 'favorable'로 매겼고, src/ui/components/stock-read.js 위치 칸이 그 tone의 단어(부담·우호·중립)를 칩으로 찍었다. 위치 칸 자체의 규칙(0%는 1년 최저, 100%는 최고)에는 위험 판정이 없다 — 추세와 50일선 거리 판정은 추세·위험 칸이 맡는다.
- fix: range 점의 tone을 neutral로 두고 zone('범위 하단' < 0.4 ≤ '범위 중간' < 0.6 ≤ '범위 상단', 기존 tone 경계와 같음)을 함께 돌려준다. 위치 칸 칩은 zone을 쓴다. 추세·위험 칸은 그대로 판정 단어(우호·부담·중립)를 쓴다.
- violated_rule: 칩은 그 칸이 잰 것을 말하고, 위험 단어는 그 칸의 규칙이 위험을 판정할 때만 쓴다.
- prevention: scripts/ci-esm-core-unit-check.mjs v60.30: 52주 범위 약 21%·50%·89% 행의 range 점이 각각 '범위 하단'·'범위 중간'·'범위 상단'이고 tone은 neutral. 이전 코드는 tone burden으로 실패한다.
- verification/residual: node --check; ci-esm-core-unit-check ok, ci-codex-structure-regression-fixture OK, ci-chart-scenarios-fixture PASS. 브라우저 확인은 하지 않음.
- files: src/domain/entity/stock-read.js, src/ui/components/stock-read.js, scripts/ci-esm-core-unit-check.mjs

## P2674 - v60.30 - 스크리너 근거 보기에서 팩터 이름과 긴 정의가 구분 없이 붙어 겉면에 나옴 (2026-11-18)

- symptom/reproduction: 2026-11-18 스크리너 행 근거 보기: '밸류저PER·저PBR — …'처럼 팩터 이름(밸류)과 정의가 한 덩어리로 붙고, 설명 문장이 접힌 칸이 아니라 막대 위 겉면에 있었다.
- root_cause: src/ui/pages/screener/inspector.js 팩터 목록: 이름 span 안에 정의 span(sx-factor__desc)을 붙였다. 둘의 구분은 CSS margin-left(soft-ui.css)뿐이라 좁은 폭·읽기 모드에서 붙어 보였고, 정의는 겉면에 남았다.
- fix: 팩터 행 겉면은 이름과 점수만 둔다. 정의는 definitionLines로 모아 아래 기존 접힘('점수 계산 순서, 팩터 정의, 요인 겹침…')에 '밸류 — 정의' 한 줄씩 넣는다. 쓰이지 않게 된 .sx-factor__desc 규칙(soft-ui.css, ui-states.css 목록)을 지웠다.
- violated_rule: 겉면은 짧은 이름과 값, 설명은 접힘에(owner 2026-10-31 face for beginners, folds for experts).
- prevention: scripts/ci-screener-presentation-check.mjs v60.30: inspector.js에 sx-factor__desc가 없고 정의가 접힘 목록으로 들어간다(소스 검사 — 근거 보기 패널은 가짜 DOM 검사 경로가 없다). 이전 코드는 sx-factor__desc로 실패한다.
- verification/residual: node --check; node scripts/ci-screener-presentation-check.mjs PASS. 브라우저 확인은 하지 않음.
- files: src/ui/pages/screener/inspector.js, src/ui/styles/soft-ui.css, src/ui/styles/ui-states.css, scripts/ci-screener-presentation-check.mjs

## P2673 - v60.30 - 스크리너 순위 보류 문장이 머리말과 표에서 시장·날짜까지 되풀이됨 (2026-11-18)

- symptom/reproduction: 2026-11-18 스크리너 한국 머리말: '239종목 중 239종목 계산, 한국 11/16 종가 자료가 최신 거래일보다 오래돼 순위를 매기지 않았습니다, 한국 11/16 종가 기준, 11/17 계산', 그리고 표에 같은 문장이 다시 나왔다.
- root_cause: src/domain/screener/row-presentation.js sessionHoldLine: 시장과 종가 날짜를 담은 한 문장을 머리말(kicker)과 빈 표 양쪽에 그대로 썼다. 머리말 옆 종가 표시(data-factor-asof)가 이미 시장·날짜를 말하고 있었고, 계산 수가 전체와 같아도 'N종목 중 N종목'으로 찍었다(src/ui/pages/screener/table.js kicker).
- fix: sessionHoldLine이 { header: '순위 보류(최신 거래일 종가 대기)', table: '순위 보류 — 최신 거래일 종가가 들어오면 순위를 매깁니다' }를 돌려준다. 머리말은 header를 한 번, 표 상태 줄은 'N종목, '+table을 한 번 쓰고 빈 표는 table을 쓴다. 계산 수가 전체와 같으면 'N종목 계산'만 쓴다.
- violated_rule: 같은 사실은 한 화면 영역에서 한 번만 말한다 — 시장·날짜는 종가 표시가 맡는다.
- prevention: scripts/ci-screener-presentation-check.mjs v60.30: 머리말이 '한국'·'01/05'·'N종목 중 N종목'을 담지 않고, 표 상태 줄(데스크톱 형태)에 '순위 보류'가 정확히 한 번. 기존 v60.26 검사도 새 문구로 갱신. 이전 코드는 머리말의 '한국 01/05'로 실패한다.
- verification/residual: node --check; node scripts/ci-screener-presentation-check.mjs PASS. 브라우저 확인은 하지 않음.
- files: src/domain/screener/row-presentation.js, src/ui/pages/screener/table.js, scripts/ci-screener-presentation-check.mjs

## P2672 - v60.30 - 스크리너에서 순위가 보류된 시장(한국)을 고르면 기본 '조건 통과만' 때문에 표가 0행이 됨 (2026-11-18)

- symptom/reproduction: 2026-11-18 스크리너 한국: '자료가 최신 거래일보다 오래돼 순위를 매기지 않았습니다'와 함께 표가 비었다. 순위가 없으니 조건 화면을 통과한 종목도 없고, 기본으로 켜진 '조건 통과만'이 전체 목록을 가렸다. 종목을 보려면 사용자가 버튼을 찾아 꺼야 했다.
- root_cause: src/ui/pages/screener/filters.js filterRows: '조건 통과만'(scr-passed-only)을 시장에 순위가 있는지와 상관없이 적용했다. 시장별 컨트롤 사용 가능 여부를 정하는 syncScreenerControlAvailability가 이 컨트롤만 다루지 않았다.
- fix: filters.js syncScreenerControlAvailability: 선택 시장의 행 가운데 전체 순위(overallRank)가 하나도 없으면 scr-passed-only를 disabled로 둔다(체크 상태는 순위가 돌아올 때를 위해 그대로). passedOnlyApplied(documentRef)가 '켜져 있고 사용 가능'을 한 곳에서 판정하고, filterRows·조건 칩·맞춤 조건 안내·table.js(필터 캐시 키, 빈 표 버튼, 상태 줄, 깔때기)가 모두 그것을 읽는다. 순위가 없는 동안 상태 줄은 '통과 종목만 보기' 버튼을 내지 않는다. 사용자의 다른 필터(시장·섹터·백분위 등)는 그대로 적용한다.
- violated_rule: 기본 보기가 자료 상태 때문에 0행이 되면 안 된다 — 판정할 수 없는 조건은 꺼진 것으로 다루고 그렇다고 말한다.
- prevention: scripts/ci-screener-presentation-check.mjs v60.30: 한국 행이 모두 순위 없음·screenStatus unavailable이고 '조건 통과만'이 켜진 상태에서 표에 행이 나오고, 체크 상태는 유지되며, 전체 순위 칸은 비고, 상태 줄에 '통과 종목만 보기'가 없다. 이전 코드는 0행으로 실패한다.
- verification/residual: node --check; node scripts/ci-screener-presentation-check.mjs PASS. 브라우저 확인은 하지 않음.
- files: src/ui/pages/screener/filters.js, src/ui/pages/screener/table.js, scripts/ci-screener-presentation-check.mjs

## P2671 - v60.30 - 시장 폭 참여 문장이 이동평균 위 비율 수준만으로 '상승이 넓게 퍼져 있다'고 씀 (2026-11-18)

- symptom/reproduction: 2026-11-18 시장 폭: '둘 다 60% 이상이라 상승이 넓게 퍼져 있습니다'가 같은 기간 지수가 내리는 동안 나왔다.
- root_cause: src/domain/market/story/page-flow.js breadthFlow participation: 50일선·200일선 위 비율이 둘 다 60% 이상인 수준 분기가 지수 방향을 보지 않고 '상승'을 단정했다.
- fix: page-flow.js: '둘 다 60% 이상이라 중기·장기 참여가 넓습니다'로 수준만 말하고, S&P 500 20일 변화가 있으면 오를 때 '— S&P 500도 20일 +x%로 함께 올랐습니다', 내릴 때 '— 다만 S&P 500은 20일 -x%로 내려, 지수 하락 속에서도 다수 종목이 평균선 위에 남아 있습니다'를 붙인다.
- violated_rule: 참여 비율은 수준이고 방향이 아니다 — 방향은 지수의 같은 기간 변화로 말한다.
- prevention: scripts/ci-esm-core-unit-check.mjs v60.30 broad participation: 66%/70%에서 지수 하락이면 '다만 S&P 500은 20일 -…%로 내려', 상승이면 '함께 올랐습니다', 어느 쪽도 '상승이 넓게'를 쓰지 않음. 이전 코드는 '상승이 넓게'에서 실패한다.
- verification/residual: node --check; ci-esm-core-unit-check, ci-scenario-guidance-fixture exit 0. 브라우저 확인은 하지 않음.
- files: src/domain/market/story/page-flow.js, scripts/ci-esm-core-unit-check.mjs

## P2670 - v60.30 - 지수별 가격 온도가 최신 종가를 가진 닛케이 225를 '갱신 지연'으로 표시 (2026-11-18)

- symptom/reproduction: 2026-11-18 투자 심리 지수별 가격 온도: 닛케이 225 타일에 '갱신 지연'과 '11/16 종가 -2.4%'가 함께 나왔다. 산출 시각(11/17 01:52Z, 도쿄 장중)에 닛케이의 마지막 완료 세션은 11/16이었다.
- root_cause: src/domain/market/sentiment/market-temperature.js staleMarketIds: 수집이 실패해 앞 본문을 유지한 시장(payload.retained)을 날짜와 상관없이 모두 지연으로 셌다.
- fix: staleMarketIds: 유지된 본문은 산출 시각에 그 시장이 마친 최신 세션보다 뒤일 때만 지연이다 — 미국·한국은 market-calendar.js latestCompletedSession, 등록된 달력이 없는 일본은 다른 시장의 가장 새 종가 날짜와 비교한다. 산출물 2일 경과·7일 뒤처짐·10일 경과 규칙은 그대로다.
- violated_rule: 갱신 지연은 그 시장의 최신 세션보다 날짜가 뒤일 때만 붙인다.
- prevention: scripts/ci-esm-core-unit-check.mjs v60.30: 11/17 01:52Z에 11/16 본문을 유지한 닛케이·코스피는 지연이 아니고, 18:00 KST에 11/16 코스피와 11/14 닛케이는 지연. 이전 코드는 첫 경우에서 실패한다. scripts/ci-data-boundary-fixture.mjs의 staleMarketIds 해시 고정값을 새 규칙 값으로 한 번 옮겼다.
- verification/residual: node --check; ci-esm-core-unit-check, ci-data-boundary-fixture exit 0. 로컬 market-temperature.json(retained nikkei, asOf 11/16)으로 확인. 브라우저 확인은 하지 않음.
- files: src/domain/market/sentiment/market-temperature.js, scripts/ci-esm-core-unit-check.mjs, scripts/ci-data-boundary-fixture.mjs

## P2669 - v60.30 - 투자 심리 종합이 VIX ÷ 3개월 VIX 비율을 '차이'로 부르고, 1.00을 기준 '가까이'라고 씀 (2026-11-18)

- symptom/reproduction: 2026-11-18 투자 심리: 'VIX와 3개월 VIX의 차이가 역전 기준(1) 가까이 좁혀졌습니다(1.00)'. 값은 비율이고, 화면의 1.00은 기준에 닿은 값이다.
- root_cause: src/ui/components/sentiment-board.js buildSentimentModel 종합 문장: 비율을 '차이'로 불렀고, 비교는 반올림 전 값(0.996 등)으로 하면서 문장에는 소수 둘째 자리 값을 적어 '가까이'와 1.00이 함께 나왔다.
- fix: sentiment-board.js termRatioLine: 'VIX ÷ 3개월 VIX 비율(x.xx)'로 부르고, 적힌 두 자리 값으로 기준과 비교해 넘으면 '역전됐습니다', 같으면 '닿았습니다', 아래면 '가까워졌습니다'.
- violated_rule: 문장의 비교 단어는 화면에 적힌 값과 같은 쪽을 말한다.
- prevention: scripts/ci-esm-core-unit-check.mjs v60.30 VIX term ratio: 0.97/0.998/1.03이 각각 가까워졌습니다/닿았습니다(1.00)/역전됐습니다이고 '차이'를 쓰지 않음. 이전 코드에는 termRatioLine이 없고 '차이'를 써서 실패한다.
- verification/residual: node --check; ci-esm-core-unit-check, ci-domain-parity-check, ci-scenario-guidance-fixture, ci-runtime-contract-check exit 0. 브라우저 확인은 하지 않음.
- files: src/ui/components/sentiment-board.js, scripts/ci-esm-core-unit-check.mjs

## P2668 - v60.30 - 다음 주 실적 일정의 S&P 500 비중 숫자가 라벨과 떨어져 주가 등락처럼 읽힘 (2026-11-18)

- symptom/reproduction: 2026-11-18 시장 상태 '다음 주 판단을 바꿀 일정': 'PANW 0.4% 실적 (S&P 500 비중)'. 0.4%가 종목 옆에 붙어 등락률로 읽혔다.
- root_cause: src/domain/market/story/market-story.js buildMarketStory 주간 실적 줄: 제목을 '<종목> <비중>% 실적 (S&P 500 비중)'으로 만들어 숫자와 그 라벨을 괄호 밖·안으로 갈랐다.
- fix: market-story.js: 한 회사는 'PANW 실적 (S&P 500 비중 0.4%)', 같은 세션 여러 회사는 'CSCO · AMAT 실적 (S&P 500 비중 CSCO 0.6% · AMAT 0.4%)'로 숫자를 라벨 안에 둔다.
- violated_rule: 숫자는 그 숫자가 무엇인지 말하는 라벨 바로 옆에 둔다.
- prevention: scripts/ci-domain-parity-check.mjs v60.30 WEEK_AHEAD_WEIGHT_IN_LABEL: PANW 한 줄과 CSCO·AMAT 두 회사 줄의 제목을 정확히 비교한다. 이전 코드는 'PANW 0.4% 실적 (S&P 500 비중)'에서 실패한다. ci-esm-core-unit-check의 오늘 다음 일정 입력 예도 새 모양으로 바꿨다.
- verification/residual: node --check; ci-domain-parity-check, ci-esm-core-unit-check, ci-metric-consistency-check exit 0. 브라우저 확인은 하지 않음.
- files: src/domain/market/story/market-story.js, scripts/ci-domain-parity-check.mjs, scripts/ci-esm-core-unit-check.mjs

## P2667 - v60.30 - 브리핑 업종 이야기가 업종 중간값보다 덜 움직인 대형주를 '가장 많이 움직인 종목'으로 씀 (2026-11-18)

- symptom/reproduction: 2026-11-18 브리핑: '광통신/포토닉스 하락 — 업종 중간값 -7.1%, 가장 많이 움직인 종목은 AVGO -3.9%'. 같은 업종의 AAOI -9.5%, ALAB -8.8%, LITE -8.5%가 더 크게 내렸다.
- root_cause: src/domain/briefing/day-account.js buildDayAccount group-move 분기: 이름을 붙인 종목을 stock-move 사실(지수 영향 5bp 이상이거나 $200M+ 거래의 4% 이상 이동 — 대형주 위주)에서만 골랐다. 업종 사실이 이미 실은 leaders(중간값 방향으로 가장 크게 움직인 구성 종목 3개, src/domain/market/day/facts.js)를 쓰지 않았다.
- fix: day-account.js: 업종 사실의 leaders가 있으면 그 종목·등락을 '가장 많이 내린/오른 종목은'으로 쓰고(거래량 꼬리표는 같은 종목의 stock-move 사실에서), leaders가 없는 옛 자료에서는 stock-move 종목을 '크게 움직인 주요 종목은'으로 쓴다.
- violated_rule: 최상급('가장')은 그 집합 전체에서 계산한 값에만 붙인다.
- prevention: scripts/ci-esm-core-unit-check.mjs v60.30 group movers: leaders가 있는 업종 줄은 S1 -9.5%, S2 -8.8%, S3 -8.5%를 '가장 많이 내린 종목'으로 쓰고 BIG -3.9%를 이름 붙이지 않음, leaders가 없으면 '가장'을 쓰지 않음. 이전 코드는 'BIG -3.9%'에서 실패한다.
- verification/residual: node --check; ci-esm-core-unit-check, ci-metric-consistency-check, ci-section-visual-contract, ci-headline-translation-check exit 0. 로컬 market-day.json(11/16)의 광통신 leaders AAOI/ALAB/LITE로 확인. 브라우저 확인은 하지 않음.
- files: src/domain/briefing/day-account.js, scripts/ci-esm-core-unit-check.mjs

## P2666 - v60.30 - 매크로 챕터 '관련 보도'가 다른 주제 기사(암호화폐)를 영어 원문 제목으로 붙임 (2026-11-18)

- symptom/reproduction: 2026-11-18 매크로 물가 챕터 '관련 보도': 'Crypto Market Loses About $330 Billion in a Week as Bitcoin Slides and Inflation Fears Mount'. 암호화폐 시장 기사이고, 생산자가 만든 한국어 제목(titleKo)이 있는데도 영어 제목이 나왔다.
- root_cause: src/domain/macro/macro-chapters.js chapterToday: 제목 단어 주제(wordTopics)에 챕터 주제('inflation')가 하나라도 있으면 붙였다 — 'Inflation Fears'라는 부수 언급만으로 암호화폐 기사가 물가 보도가 됐다. wordTopics가 없을 때는 피드 주제(topics)로 대신 맞췄다. 보여 줄 제목은 report.title(원문)이었고 titleKo를 읽지 않았다.
- fix: chapterToday: 기사는 챕터 주제 단어를 가지면서 종목(subjects)이 없고 장 밖 주제 단어(crypto, ai-semis, deal, earnings — 시장 원장 WORD_TOPICS 기준)가 없을 때만 붙는다; 피드 주제 대체는 뺐다. 제목은 한국어(titleKo, 없으면 한국어 원제)만 쓰고 한국어 제목이 없는 기사는 후보에서 뺀다 — 맞는 기사가 없으면 '관련 보도' 줄이 나오지 않는다. 뉴스 원천은 넓히지 않았다.
- violated_rule: 보도는 그 장의 주제 자체에 대한 것만 근거로 붙이고, 화면 제목은 한국어로만 보인다(브리핑 day-account shownKorean과 같은 기준).
- prevention: scripts/ci-esm-core-unit-check.mjs v60.30: 인플레이션을 언급한 암호화폐 기사와 한국어 제목 없는 기사는 물가 보도가 아니고, 함께 있을 때 한국어 CPI 기사가 선택된다. 이전 코드는 영어 암호화폐 제목을 돌려줘 실패한다.
- verification/residual: node --check; ci-esm-core-unit-check exit 0. 로컬 market-day.json에서 물가 챕터 보도 없음, 금리·유가·금속·달러 챕터는 한국어 제목 확인. 브라우저 확인은 하지 않음.
- files: src/domain/macro/macro-chapters.js, scripts/ci-esm-core-unit-check.mjs

## P2665 - v60.30 - 매크로 근원 CPI 13개월 연율이 괄호 안의 괄호로 찍히고, 왜 13개월인지(빠진 달)를 말하지 않음 (2026-11-18)

- symptom/reproduction: 2026-11-18 매크로 물가 챕터: '3.7% (10월, 13개월 연율 2.6% (25년 9월 대비, 1년 전 같은 달 지수 없음))'. 겹괄호이고, 빠진 달(25년 10월)이 이름으로 나오지 않아 13개월 연율을 쓴 이유가 흐리다. 같은 근거가 물가 방향 문장(macro-signals)과 물가 축 행(macro-read)에도 겹괄호로 들어갔다.
- root_cause: src/domain/macro/macro-read.js yoyAt: 파생 연율의 note를 ' (… 대비, …)'처럼 자체 괄호로 돌려줬고, 세 소비자(macro-chapters 근원 CPI 3개월 연율 행, macro-read 근원 CPI 3개월 속도 행, macro-signals measureDirection)는 모두 그 note를 자기 괄호 안에 넣는다. 겹괄호를 잡는 검사가 없었다.
- fix: yoyAt note를 괄호 없는 ', 25년 10월 지수가 없어 25년 9월 대비' 절로 바꿨다(빠진 12개월 전 달을 이름으로). 결과: '3.7% (10월, 13개월 연율 2.6%, 25년 10월 지수가 없어 25년 9월 대비)'. scripts/ci-sentence-join-check.mjs에 maxParenDepth(export)와 'nested' 규칙을 추가: src/domain/macro/** 의 한국어 리터럴에서 `${}` 안 리터럴을 놓인 깊이에서 세어 겹괄호면 실패하고, 실행 때 자기 규칙이 합성 겹괄호를 잡는지 먼저 확인한다.
- violated_rule: 화면 문장에 괄호 안의 괄호를 쓰지 않는다; 파생 값은 왜 파생인지를 같은 줄에서 말한다.
- prevention: scripts/ci-esm-core-unit-check.mjs v60.30: 13개월 연율 note가 ', 25년 10월 지수가 없어 25년 9월 대비'이고 챕터 행·물가 방향 문장·챕터 상세 모든 행의 maxParenDepth <= 1(이전 코드는 깊이 2로 실패). scripts/ci-sentence-join-check.mjs v60.30 'nested' 규칙(매크로 도메인 정적 겹괄호).
- verification/residual: node --check; ci-esm-core-unit-check, ci-sentence-join-check exit 0. 실데이터 물가 챕터 행 확인. 브라우저 확인은 하지 않음.
- files: src/domain/macro/macro-read.js, scripts/ci-sentence-join-check.mjs, scripts/ci-esm-core-unit-check.mjs

## P2664 - v60.30 - 매크로 S&P 500 이익 전망 게이지가 '전망 상향 우위, +25%'로 무엇의 몇 %인지 말하지 않음 (2026-11-18)

- symptom/reproduction: 2026-11-18 매크로 화면 S&P 500 이익 전망 칸의 게이지 캡션 '전망 상향 우위, +25%'. +25%가 이익 증가율로 읽히지만 실제로는 최근 4주 이익 전망 수정 건수의 (상향 − 하향) ÷ 전체 비율이다. 정의는 접힌 칸 끝에만 있었다.
- root_cause: src/ui/components/index-earnings.js breadthGauge: 게이지 캡션은 'label, value'로 찍히는데(gauge-bar.js) label이 측정 대상(수정 건수)과 기간(4주)을 담지 않았다.
- fix: breadthGauge label을 '4주 이익 전망 수정 건수 순상향'으로 바꿔 캡션이 '4주 이익 전망 수정 건수 순상향, +25%'로 읽힌다. breadthGauge를 export해 검사가 읽는다.
- violated_rule: 숫자 옆에는 그 숫자가 무엇인지(측정·기간)가 붙는다 — 정의를 접힌 칸에만 두지 않는다.
- prevention: scripts/ci-esm-core-unit-check.mjs v60.30: breadthGauge(0.25).label이 '4주'와 '수정 건수'를 담는다. 이전 label('전망 상향 우위')은 실패한다.
- verification/residual: node --check; ci-esm-core-unit-check exit 0. 브라우저 텍스트 예산(secondary-text-budget) 검사는 실행하지 않음 — 캡션이 9자 길어졌다.
- files: src/ui/components/index-earnings.js, scripts/ci-esm-core-unit-check.mjs

## P2663 - v60.30 - 매크로 신용 가지가 중립 판정의 실제 원인 대신 '5거래일 변화는 작지만 … 수준이나 20거래일 변화 때문에'라는 고정 문장을 씀 (2026-11-18)

- symptom/reproduction: 2026-11-18 매크로 화면: 하이일드 5거래일 -19bp 옆에 '5거래일 변화는 작지만 신용 지표는 중립입니다 — 수준이나 20거래일 변화 때문에 안정으로 보지 않습니다'. 실제로는 수준 323bp(350bp 미만)와 20거래일 0bp 모두 양호 조건을 충족했고, 중립은 CCC와 하이일드의 60관측 확대 차이 226bp(기준 150bp) 때문이었다.
- root_cause: src/domain/macro/macro-chain.js creditCalm: 중립 분기가 creditState의 어느 양호 조건이 빠졌는지 묻지 않고 고정 문장을 썼다. 신용 축이 v59.70에 CCC 분산(lowerRated) 조건을 얻은 뒤에도 문장은 수준·20거래일만 원인으로 짐작했고, 문장 앞머리는 |5거래일| < 25bp(화살표 기준)를 '작다'로 불렀다.
- fix: src/domain/briefing/market-read.js creditNeutralCause: creditState의 양호 조건(수준 < 350bp, 5거래일 <= +5bp, 20거래일 < +25bp, CCC 60관측 차이 < 150bp) 중 빠진 것을 값과 기준으로 돌려준다. macro-chain.js 중립 문장은 그 목록을 '양호 조건 중 …에 걸립니다'로 쓰고, 5거래일 값은 크기 단어 없이 숫자로만 쓴다('5거래일 -19bp에도 신용 지표는 중립입니다 — 양호 조건 중 CCC와 하이일드의 60관측 확대 차이 226bp(양호는 150bp 미만)에 걸립니다').
- violated_rule: 판정 문장은 판정을 정한 입력과 그 값을 말한다(Codex audit F06의 부담 원인 원칙을 중립에도 적용).
- prevention: scripts/ci-scenario-guidance-fixture.mjs v60.30: CCC 차이로만 중립인 경우 문장이 5거래일 -19bp와 CCC 60관측 차이·기준을 말하고 '작지만'·'수준이나'를 쓰지 않음, 수준 372bp 중립은 수준을 말함. 이전 코드는 '작지만'에서 실패한다.
- verification/residual: node --check; ci-scenario-guidance-fixture, ci-metric-consistency-check, ci-regime-scenarios-fixture, ci-codex-structure-regression-fixture exit 0. 실데이터(11/13 HY 3.23%, -19bp)에서 새 문장 확인. 브라우저 확인은 하지 않음.
- files: src/domain/briefing/market-read.js, src/domain/macro/macro-chain.js, scripts/ci-scenario-guidance-fixture.mjs

## P2662 - v60.30 - 포트폴리오 백테스트·위험 패널의 보류 문구가 'VaR 인증 보류 — 부트스트랩 변동 큼', 'RF 미입력 — Sharpe 보류', '위험 추정 입력을 확정하지 못해 보류합니다: composition-snapshot-unavailable.' 같은 내부 용어·코드로 쓰여, 무엇이 없고 무엇을 하면 되는지 말하지 않음 (2026-11-18)

- symptom/reproduction: 백테스트 랩 성과 요약의 VaR 행, 백테스트 보류 메시지('조정주가(adjusted close) 이력이 없어 … 승격할 수 없습니다', '부분 배분은 보류입니다 — 미지정 멤버', '관측 rate leg가 선언되지 않았습니다', 'fx-unavailable'), 위험 지표 패널의 선언 줄·샤프 타일·현금 보류 줄, refreshPortfolioRisk 상태 줄(내부 코드 노출), 원장 성과 요약('실제 계좌 성과(TWR/MWR) 보류 — … dayCount(actual-365) …')이 모두 검증 용어와 영문 코드를 앞면에 썼다.
- root_cause: 보류 사유 문구를 만드는 곳(src/domain/portfolio/backtest.js 경고, src/ui/components/portfolio-backtest-lab.js varCertLabel·varRowLabel, src/ui/components/portfolio-risk-metrics.js, js/aio-workspace.js refreshPortfolioRisk·refreshPortfolioLedgerPerformance, src/domain/portfolio/risk.js assessAccountPerformance)이 엔진의 판정 이름과 코드를 그대로 독자 문장으로 썼다. v60.28이 가격 기록 누락 한 건만 '무엇이 없어 실행하지 않았습니다 — 무엇을 하세요' 한 문장으로 바꿨다.
- fix: 모든 보류를 같은 한 문장 형태로: 무엇이 없어 실행/계산하지 않았는지 — 무엇을 넣거나 하면 되는지(백테스트 13가지 보류, 원장 성과 4가지, 위험 상태 줄 5가지, 계좌 전체 보기 3가지, 샤프 타일 2가지). VaR 행은 '확정' 또는 'VaR 참고값: 기간이 짧음, 시작 달을 앞당겨 기간을 늘리면 (41개월 이상) 확정값이 됩니다'. 내부 코드는 위험 패널의 기존 '계산 식별자' 접힌 칸(account-hold …)과 로그(_aioLog)에만 남고, 백테스트 패널은 접힌 칸이 없어 코드를 모델(varCertification, allocationBlocked)에만 둔다.
- violated_rule: 앞면 문장은 짧고 쉬운 한국어로 무엇이 없고 무엇을 하면 되는지 말한다; 기술 용어·코드는 접힌 칸에만 둔다.
- prevention: scripts/fixtures/pipeline-semantics/portfolio.mjs v60.30: 백테스트 보류 6종·원장 성과 보류 4종·위험 패널 앞면에 보류/인증/leg/targetWeight/adjusted close/raw close/승격/dayCount/영문 코드가 없고, 각 문장이 '…하지 않았습니다 — …하세요/계산합니다.'로 끝나며, 코드는 계산 식별자 접힌 칸에 남는다. scripts/ci-esm-core-unit-check.mjs v60.30 VaR 행 문구. 이전 코드는 '보류'·'leg'·코드에서 실패한다. scripts/ci-portfolio-vault-e2e.mjs의 라벨 기대값('확정', '참고값 — ')과 위험 패널 정규식도 새 문구로 바꿨다(브라우저 게이트, 실행하지 않음).
- verification/residual: node --check(backtest.js, risk.js, portfolio-risk-metrics.js, portfolio-backtest-lab.js, js/aio-workspace.js, 검사 스크립트); node scripts/ci-pipeline-semantics-check.mjs 228 passed; ci-review-integrity-unit-check, ci-runtime-contract-check exit 0. ci-esm-core-unit-check는 다른 스레드가 고치는 src/domain/briefing/day-account.js(1725행 'list is not iterable')에서 멈춰 내 검사 줄까지 가지 못했다 — 바꾼 정규식·VaR 문구 검사는 따로 실행해 통과를 확인했다. 브라우저 확인은 하지 않음.
- files: src/domain/portfolio/backtest.js, src/domain/portfolio/risk.js, src/ui/components/portfolio-backtest-lab.js, src/ui/components/portfolio-risk-metrics.js, js/aio-workspace.js, scripts/fixtures/pipeline-semantics/portfolio.mjs, scripts/ci-esm-core-unit-check.mjs, scripts/ci-portfolio-vault-e2e.mjs

## P2661 - v60.30 - 순현금 주석이 장기부채 기준 회사 모두에 '1년 안에 갚을 부채는 빠져 있습니다'라고 썼지만, LongTermDebt 등 합계 개념은 그 몫을 포함함 (2026-11-18)

- symptom/reproduction: 재무 공시 '이익률 단계와 현금' 카드의 '한계, 함께 볼 것': 리스 포함이 아닌 모든 발행사에 '장기부채만 뺀 값이며, 1년 안에 갚을 부채와 리스 부채는 빠져 있습니다'. 로컬 코어 원장(10/16 사본) 부채 보유 644곳 중 414곳은 LongTermDebt로 읽혀 1년 안에 갚을 몫이 이미 들어 있었다(MSFT FY2026 40,294M = 비유동 31,067M + 유동분).
- root_cause: src/ui/components/fundamental-analysis-cards.js 주석이 debtBasis(리스 포함 여부)만 보고 문장을 골랐다. debtBasis는 리스 포함 여부만 담고, 시리즈가 어떤 개념(합계 vs 비유동)에 고정됐는지는 아티팩트에 없었다.
- fix: sec-earnings.js SEC_DEBT_NONCURRENT_CONCEPTS / secDebtCurrentCoverage: us-gaap 계산 관계(sec-normalize.js DEBT_DERIVED_PAIRS의 [비유동, 유동, 합계] 쌍, SEC_CONCEPT_PARTS)대로 LongTermDebt·파생 합계·리스 포함 합계(IncludingCurrentMaturities)·파생 리스 합계는 포함, LongTermDebtNoncurrent·LongTermDebtAndCapitalLeaseObligations(비유동)만 제외. scripts/lib/sec-fiscal-history.mjs fiscalDebtCurrent → build-sec-runtime-projection.mjs가 sec-fiscal-history.json에 희소 지도 debtCurrent(제외인 발행사만 'excluded')와 형식 문자열을 쓴다. fiscal-read.js가 root._aioSecDebtCurrent로 읽고 debtCurrentFor(지도 없으면 null)를 내며, buildMarginCashRead가 cash.debtCurrent를 싣고 netCashScopeNote가 제외면 '1년 넘게 남은 몫만 뺀 값이며, 1년 안에 갚을 몫과 리스 부채는 빠져', 포함이면 '장기부채(1년 안에 갚을 몫 포함)를 뺀 값', 모르면 그 몫을 말하지 않는다.
- violated_rule: 데이터 범위 주석은 그 값을 만든 개념의 실제 범위를 말한다; 범위를 모르면 주장하지 않는다.
- prevention: scripts/ci-data-pipeline-contract-check.mjs v60.30 두 검사(fixtures/sec-debt-concept-cases.mjs currentCoverageCase: LongTermDebt·비유동+유동 파생·리스 파생은 포함, 유동분 없는 비유동 두 개념만 제외; longTermDebt 선호 개념마다 범위가 DEBT_DERIVED_PAIRS 비유동 피연산자 여부와 일치). scripts/ci-fiscal-quality-fixture.mjs v60.30: debtCurrent 지도의 제외 발행사는 '1년 안에 갚을 몫과 리스 부채는 빠져', 지도에 없는 발행사는 '(1년 안에 갚을 몫 포함)'이고 빠졌다고 말하지 않음 — 이전 코드는 합계 발행사에도 빠졌다고 써서 실패.
- verification/residual: node --check(sec-earnings.js, sec-normalize.js, analysis-read.js, fiscal-read.js, fundamental-analysis-cards.js, stock-lens-cards.js, sec-fiscal-history.mjs, build-sec-runtime-projection.mjs); ci-fiscal-quality-fixture PASS; ci-data-pipeline-contract-check OK. 아티팩트(public-data/sec-fiscal-history.json)는 다시 만들지 않았다 — 다음 SEC 런타임 투영 실행 전까지 debtCurrent 지도가 없어 주석은 1년 안 몫을 말하지 않는다(거짓 주장만 사라짐). 브라우저 확인은 하지 않음.
- files: src/domain/fundamental/sec-earnings.js, src/domain/fundamental/sec-normalize.js, src/domain/fundamental/analysis-read.js, src/ui/components/fiscal-read.js, src/ui/components/fundamental-analysis-cards.js, src/ui/components/stock-lens-cards.js, scripts/lib/sec-fiscal-history.mjs, scripts/build-sec-runtime-projection.mjs, scripts/fixtures/sec-debt-concept-cases.mjs, scripts/ci-data-pipeline-contract-check.mjs, scripts/ci-fiscal-quality-fixture.mjs

## P2660 - v60.30 - 재무 공시의 같은 테마 기업 비교표가 매출 성장·순이익률을 회계연도 값으로 보여, 같은 페이지의 요약 타일·스크리너 행(최근 4개 분기)과 기준이 달랐음 (2026-11-18)

- symptom/reproduction: 종목 페이지 재무 공시: 요약 타일과 스크리너 행은 최근 4개 분기 기준(trailingRowFundamentals)인데, '같은 테마 기업과 비교' 표는 각 회사의 회계연도 매출 성장·순이익률을 '회계연도' 열과 함께 보여 같은 회사의 같은 지표가 두 값으로 읽혔다. 종목 요약의 동종 순위 차트는 이미 4개 분기 기준이었다.
- root_cause: src/ui/components/fundamental-analysis-cards.js fiscalExtras: buildThemePeers에 quartersFor를 넘기지 않아 analysis-read.js applyPeerBasis가 언제나 회계연도로 떨어졌다(stock-lens-cards.js stockLensContext만 넘김). 표의 기간 열과 캡션도 '최근 회계연도'로 고정이었다.
- fix: fiscalExtras가 root._aioSecQuarterHistory를 parseQuarterHistory로 읽어 quartersFor로 넘긴다(종목 요약과 같은 입력). applyPeerBasis는 4개 분기 기준인 지표를 가진 행에 trailingThrough(그 행의 4개 분기 끝 날짜)를 남긴다. themePeerCard는 기간 열을 '기준'으로 바꿔 행마다 '6/30까지 4개 분기' 또는 회계연도(FY25)를 한 번 쓰고, 캡션은 stock-lens.js peerBasisText로 '매출 성장·순이익률은 최근 4개 분기(…), ROE·잉여현금 마진은 각 회사의 최근 회계연도'를 말한다.
- violated_rule: 한 화면에서 같은 지표는 한 기준으로 읽는다; 기준이 다른 값은 그 기준을 같은 줄에 적는다.
- prevention: scripts/ci-fiscal-quality-fixture.mjs v60.30: 분기 자료가 있는 그룹으로 재무 공시를 그리면 테마 비교표 머리가 '기준'이고 네 행 모두 '6/30까지 4개 분기', 캡션이 4개 분기 기준을 한 번 말하며, 성장 칸이 4개 분기 성장률(43.5%)이다. 이전 코드는 quartersFor 없이 회계연도로 그려 실패한다.
- verification/residual: node --check(analysis-read.js, fundamental-analysis-cards.js); node scripts/ci-fiscal-quality-fixture.mjs PASS; node scripts/ci-data-pipeline-contract-check.mjs OK(v60.28 peer basis 검사 포함). 브라우저 확인은 하지 않음. 넓은 섹터 백분위(peer-read.js buildPeerRead, 접힌 '넓은 섹터 안 위치 보기')는 회계연도 기준 그대로다.
- files: src/domain/fundamental/analysis-read.js, src/ui/components/fundamental-analysis-cards.js, scripts/ci-fiscal-quality-fixture.mjs

## P2659 - v60.30 - 시장 읽기 참여 진술이 기준 아래 값을 기준과 같은 숫자로 반올림해 인쇄함('40%뿐' 옆 '40% 위로 회복되는지(현재 40%)') (2026-11-18)

- symptom/reproduction: history.json 재생 11개 세션: narrow-rally 2026-09-11~13·10-13 '50일선 위 종목은 40%뿐입니다' + 확인 '40% 위로 회복되는지(현재 40%)'(실제 39.6%); broad-derisking 2026-07-17~19 '상승 종목 30%'(실제 29.5%, 기준 30% 미만); index-defended 2026-04-15·07-31~08-02 '상승 종목은 45%'(실제 44.5·44.7%, 기준 45% 미만).
- root_cause: src/domain/briefing/market-read.js: 기준(RULES.breadth.weakBelow 40, deriskAdvanceBelow 30, defendedAdvanceBelow 45) 판정은 원값으로 하고 인쇄는 정수로 반올림해, 기준 바로 아래 값이 기준 숫자 그대로 찍혔다.
- fix: src/domain/shared/claim.js digitsApart: 기준선보다 엄격히 위/아래라고 말하는 수치는 기준과 같은 숫자로 찍히지 않을 만큼 소수 자리를 늘린다(최대 2자리 추가). market-read.js 변환 진술의 closeClaim이 이를 쓴다('39.6%뿐', '상승 종목 29.5%'). 기준선 자체(40%)는 단위 기본 자리로 인쇄.
- violated_rule: 기준선과의 관계를 말하는 단어는 인쇄된(반올림된) 값으로도 참이어야 한다(문장 claim 계약 d).
- prevention: scripts/ci-sentence-claim-replay-check.mjs v60.30: relation below/above 단어를 인쇄 값과 기준선으로 비교. 이전 코드는 d-relation 11건으로 실패한다.
- verification/residual: node --check; ci-sentence-claim-replay-check, ci-esm-core-unit-check, ci-text-pin-ratchet-check exit 0. 브라우저 확인은 하지 않음.
- files: src/domain/shared/claim.js, src/domain/briefing/market-read.js, scripts/ci-sentence-claim-replay-check.mjs

## P2658 - v60.30 - 시장 읽기 vix-inversion이 VIX와 3개월 VIX가 같게 인쇄된 날에도 '보다 높은 역전 상태'라고 씀 (2026-11-18)

- symptom/reproduction: history.json 2026-02-06·07·08(같은 종가 반복): 'VIX(20.37)가 3개월 VIX(20.37)보다 높은 역전 상태입니다.'
- root_cause: src/domain/briefing/market-read.js: 진술 조건이 비율 >= RULES.volatility.invertedRatioAt(1)이라 두 값이 같으면(비율 1.00) 통과했고, 문장은 '보다 높은'이라고 단정했다.
- fix: market-read.js: 비율 조건에 더해 인쇄되는 두 수준(소수 둘째 자리)이 VIX > 3개월 VIX일 때만 역전 진술을 낸다. 같으면 진술 없음.
- violated_rule: 기준선과의 관계를 말하는 단어는 인쇄된(반올림된) 값으로도 참이어야 한다(문장 claim 계약 d).
- prevention: scripts/ci-sentence-claim-replay-check.mjs v60.30: 'inverted' 단어(relation above)를 3개월 VIX의 인쇄 값과 비교. 이전 코드는 d-relation 3건으로 실패한다.
- verification/residual: node --check; ci-sentence-claim-replay-check, ci-esm-core-unit-check, ci-crash-replay-check exit 0. 브라우저 확인은 하지 않음.
- files: src/domain/briefing/market-read.js, scripts/ci-sentence-claim-replay-check.mjs

## P2657 - v60.30 - 시장 읽기 vix-spike가 VIX 5일 +25% 고정 기준만으로 '급등'이라 불러, VIX 자기 변동성으로는 보통 크기인 움직임도 급등이 됨 (2026-11-18)

- symptom/reproduction: history.json 재생 12개 세션에서 거짓: 2025-11-18 'VIX 5일 +43% 급등(24.69).', 2025-11-17 +27%, 2026-01-20 +33%, 2026-02-05 +29%, 2026-03-05 +27%, 2026-06-09/11 +26%, 2026-11-06 +32% 등 — moveGrade(VIX 5거래일 sd 기준)는 모두 ordinary.
- root_cause: src/domain/briefing/market-read.js vix-spike: 진술을 낼지 정하는 선(RULES.volatility.spike5dPct 25%)이 크기 단어까지 정했다. 다른 모든 크기 단어는 src/domain/market/session/move-size.js moveGrade(자기 변동성 대비)를 따른다.
- fix: market-read.js: +25% 선은 진술을 내는 조건으로 남기고, '급등'은 closeMoveGrade(history, 'vix', 5일 변화, 5세션)가 large일 때만, 아니면 '상승'으로 쓴다('VIX 5일 +43% 상승(24.69).').
- violated_rule: 크기 단어는 그 측정의 moveGrade와 맞아야 한다(문장 claim 계약 c, v60.19 하나의 크기 어휘).
- prevention: scripts/ci-sentence-claim-replay-check.mjs v60.30: 'spike' 단어(size large)를 VIX 5거래일 sd로 등급을 매겨 비교. 이전 코드는 c-size 12건으로 실패한다.
- verification/residual: node --check; ci-sentence-claim-replay-check, ci-move-size-word-check, ci-esm-core-unit-check, ci-scenario-guidance-fixture exit 0. 브라우저 확인은 하지 않음.
- files: src/domain/briefing/market-read.js, src/domain/shared/claim.js, scripts/ci-sentence-claim-replay-check.mjs

## P2656 - v60.30 - 브리핑 가격 이야기의 '가장 큰 변화(X)'가 실제로 가장 크게 움직인 자산이 아니라 이야기의 대표(가장 중요한) 자산을 가리킴 (2026-11-18)

- symptom/reproduction: history.json으로 다시 만든 421개 세션 중 188개 세션, 272개 가격 이야기에서 거짓. 예: 2025-11-11 '11/11 종가 WTI 유가 +1.5%, 브렌트 유가 +1.7%. 가장 큰 변화(WTI 유가)는 평소 하루 변동의 0.9배입니다.' — 브렌트는 1.1배. 2025-10-15 '가장 큰 변화(하이일드 스프레드)는 … 2.6배' 옆 투자등급 스프레드 2.67배. 금리(10년물 82건), 유가(WTI 68), 신용(HY 47), 달러(41), 금(30)에서 반복.
- root_cause: src/domain/briefing/day-account.js 가격 이야기: 문장의 최상급이 이야기의 seed(원장 materiality 순 1위)를 그대로 썼다. materiality는 핵심 지표(10년물, 달러지수, WTI, 금, HY)를 1.0, 나머지를 0.7로 가중하고 업종을 움직인 가격을 끌어올리므로, 1위가 자기 변동성 대비 가장 큰 움직임이라는 보장이 없다.
- fix: day-account.js: '가장 큰 변화'는 같은 가족(유가·금리·신용·달러·금과 은) 중 원장이 크기를 잰 구간(하루 또는 5거래일, sizedBy)의 |z|가 가장 큰 자산을 가리키고, 그 자산의 배수를 쓴다. 대표 자산이 실제로 가장 클 때(동률 포함)는 문장이 그대로다. 제목의 방향(유가 상승 등)은 여전히 대표 자산의 부호.
- violated_rule: 최상급·순위 단어는 그 집단의 모든 구성원과 비교해 참이어야 한다(문장 claim 계약 a).
- prevention: scripts/ci-sentence-claim-replay-check.mjs v60.30: 'largest' claim(rank among family:<id>)을 원장 가족 구성원의 priceMoveSize와 비교한다. 이전 코드는 a-rank 362건으로 실패한다.
- verification/residual: node --check; ci-sentence-claim-replay-check(0건), ci-esm-core-unit-check, ci-metric-consistency-check, ci-headline-translation-check, ci-section-visual-contract exit 0. 발행된 market-day.json(11/16) 문장은 변하지 않음. 브라우저 확인은 하지 않음.
- files: src/domain/briefing/day-account.js, scripts/ci-sentence-claim-replay-check.mjs

---

## P2655 - v60.29 - 재무 공시 '예상 대비 실제 EPS' 카드가 SEC 카드와 다른 분기 이름을 씀 · 교훈 한 화면에서 같은 회계 분기는 한 이름으로 부른다; 원천마다 다른 분기 표기는 한 주인이 맞춘다. · 검사 ci-fiscal-quality-fixture · 파일 src/domain/fundamental/period.js, src/domain/fundamental/analysis-read.js, src/domain/fundamental/quarter-read.js, src/ui/components/fundamental-analysis-cards.js, src/ui/components/stock-lens-cards.js, scripts/ci-fiscal-quality-fixture.mjs
## P2654 - v60.29 - 회사 관계 그래프가 괄호 안 다른 회사의 협력사·고객을 경쟁·고객 관계로 연결함 · 교훈 관계 간선은 그 줄의 주체에만 붙는다; 괄호 속 다른 회사의 관계를 이 회사의 관계로 옮기지 않는다. · 검사 ci-company-profile-contract-check · 파일 src/domain/entity/company-graph.js, scripts/ci-company-profile-contract-check.mjs, public-data/company-profiles/graph.json
## P2653 - v60.29 - 종목 가격 줄과 시장 연결 줄이 한 종목의 테마를 서로 다르게 말함 · 교훈 한 화면에서 한 종목의 분류는 한 주인이 정하고, 다른 분류를 말할 때는 둘의 관계를 밝힌다. · 검사 ci-section-visual-contract · 파일 src/domain/entity/primary-theme.js, src/domain/entity/why-moved.js, src/domain/entity/stock-read.js, src/ui/components/stock-read.js, src/ui/components/stock-lens-cards.js, src/ui/pages/entity.js
## P2652 - v60.29 - 테마 단계 표 '기준 충족'이 이익 전망·실적 일정을 받기 전 숫자로 고정됨 · 교훈 늦게 도착하는 입력으로 계산한 값은 그 입력이 도착하면 다시 그려야 하고, 확인하지 못한 항목은 충족·미충족과 구분해 보여야 한다. · 검사 ci-esm-core-unit-check, ci-scenario-guidance-fixture · 파일 src/ui/components/theme-playbook-view.js, src/domain/scenarios/theme-criteria.js, scripts/ci-esm-core-unit-check.mjs, scripts/ci-scenario-guidance-fixture.mjs
## P2651 - v60.29 - 테마 시나리오 기준일 칩이 '11/17 반영 전'을 '11/17 반영'으로 잘라 뜻을 뒤집음 · 교훈 표시 문구는 뜻이 바뀌는 지점에서 잘리면 안 된다; 길이 계약은 호출부의 짧은 형태와 게이트가 지키고 컴포넌트가 조용히 자르지 않는다. · 검사 ci-esm-core-unit-check · 파일 src/ui/components/section-frame.js, src/ui/components/session-lag.js, src/ui/components/theme-playbook-view.js, scripts/ci-secondary-text-budget-check.mjs, scripts/ci-esm-core-unit-check.mjs, scripts/ci-domain-parity-check.mjs
## P2650 - v60.29 - 리스 포함 부채 계정만 쓰는 기업의 장기부채가 비어 재무 공시에 '장기부채 자료 없음'으로 표시됨 · 교훈 공시 개념 하나가 빠졌다고 값이 조용히 비면 안 된다; 대체 개념은 기준(리스 포함 여부)을 함께 실어 같은 시계열 안에서 섞지 않는다. · 검사 ci-data-pipeline-contract-check · 파일 src/domain/fundamental/sec-earnings.js, src/domain/fundamental/sec-normalize.js, scripts/lib/sec-fiscal-history.mjs, scripts/build-sec-runtime-projection.mjs, src/domain/fundamental/fiscal-read.js, src/domain/fundamental/analysis-read.js
## P2649 - v60.29 - 스크리너 한 행의 PER은 최근 4개 분기, 순이익률·매출 성장은 최대 1년 전 회계연도로 섞여 순위·동종 비교가 묵은 숫자를 씀 · 교훈 AGENTS 종가 기준·한 숫자 한 기준: 한 행·한 순위 안에서 서로 다른 기간의 숫자를 섞지 않는다. · 검사 ci-data-pipeline-contract-check, ci-screener-presentation-check · 파일 src/domain/fundamental/trailing-year.js, src/domain/fundamental/sec-row-fields.js, src/domain/fundamental/fiscal-read.js, src/domain/fundamental/analysis-read.js, src/domain/fundamental/stock-lens.js, src/ui/components/stock-lens-cards.js
## P2648 - v60.29 - 기술 리스크가 50일선 근처(하루 변동폭 안) 종가를 이평 이탈로 세어 '부담 최상위 구간'을 표시 · 교훈 한 개념(선 근처)은 한 임계값 원천(RULES.technical.nearLineAdr)에서 온다. · 파일 src/domain/portfolio/technical-risk.js, js/aio-ui.js
## P2647 - v60.29 - 한국 보유 종목(005930)이 논지 점검·오늘 내 종목·점검 유형에서 자기 시세 행(005930.KS)을 찾지 못함 · 교훈 보유 종목의 상장 심볼은 reader가 한 번 정하고 모든 소비자가 그 값을 읽는다(v59.54 surface 계약). · 파일 src/domain/portfolio/fx.js, src/domain/portfolio/surface.js, src/domain/portfolio/checks.js, src/domain/portfolio/portfolio-read.js, src/domain/briefing/daily-diff.js, src/ui/components/portfolio-checklist.js
## P2646 - v60.29 - 시장 상태 전망 문장이 '확인합니다., 상대강도는'·'확인합니다.. 선도였지만'으로 이어짐 · 교훈 문장 잇기는 한 곳에서: 마침표로 끝난 문장 뒤에 ', '나 '. '로 시작하는 조각을 붙이지 않는다. · 검사 ci-sentence-join-check · 파일 src/domain/market/regime/scenario-outlook.js, scripts/ci-sentence-join-check.mjs
## P2645 - v60.29 - 화면이 찍는 측정 용어(칼만·포켓 피벗·CVaR·RVOL·ERP 등)가 용어 사전에 없음 · 교훈 화면이 찍는 측정 이름은 용어 사전에서 찾을 수 있어야 한다. · 검사 ci-glossary-vocabulary-check · 파일 js/aio-glossary.js, scripts/ci-glossary-vocabulary-check.mjs
## P2644 - v60.29 - 산업 지도 가치사슬 층의 기업 예시가 빈약하고 모델 층은 비어 있음 · 교훈 같은 사실(기업의 가치사슬 층)은 한 원천에서 읽는다. · 검사 ci-atlas-contract-check · 파일 src/ui/pages/atlas.js, scripts/ci-atlas-contract-check.mjs
## P2643 - v60.29 - 산업 지도를 연 뒤 다른 화면 주소에 지도 상태(?mode=taxonomy&node=…)가 남음 · 교훈 화면 상태는 그 화면 주소(hash 질의)에만 둔다 — 다른 화면 주소로 새지 않는다. · 검사 ci-knowledge-corpus-check · 파일 src/app/knowledge-route-state.js, src/ui/pages/atlas.js, src/ui/pages/principles.js, src/ui/pages/masters.js, src/ui/knowledge/glossary-bridge.js, src/ui/knowledge/research-shell.js
## P2642 - v60.29 - 13F 레인이 새 분기 첫 실행에서 고정 행 수 하한에 걸려 백오프에 들어감 · 교훈 분기마다 움직이는 수량에 고정 하한을 두지 않는다(시계 폭탄 클래스). · 파일 scripts/ci-masters-contract-check.mjs
## P2641 - v60.29 - 배당·PER 질문 답변에 관계없는 분기 매출 차트가 붙음 · 교훈 그림은 질문의 주제를 받쳐야 한다; 관계없는 그림보다 그림 없음이 낫다. · 검사 ci-ai-intelligence-contract-check · 파일 src/ai/response/answer-visual-choice.js, scripts/ci-ai-intelligence-contract-check.mjs
## P2640 - v60.29 - 종목 화면 PER 산식 질문에 AI가 '화면 산식은 다를 수 있다'고 답함 · 교훈 화면에 있는 수치와 산식은 AI 맥락에도 같은 값으로 있어야 한다. · 검사 ci-ai-intelligence-contract-check · 파일 src/ai/context/choosing-blocks.js, scripts/ci-ai-intelligence-contract-check.mjs
## P2639 - v60.29 - 계산된 배당수익률이 근거 수치가 있어도 빠지고, 안내 줄이 무엇을 뺐는지 말하지 않음 · 교훈 소유자 2026-11-17: 해석은 막지 않는다; 근거 없는 현재 수치만 빼고, 뺀 것은 읽는 사람에게 알린다. · 검사 ci-ai-intelligence-contract-check · 파일 src/ai/response/publication.js, src/ai/response/request-pipeline.js, scripts/ci-ai-intelligence-contract-check.mjs
## P2638 - v60.29 - 웹검색 답변이 잘린 문장('…64년 연속 연간 배(sec.gov)', '…2026년 수치는 연환산액')을 그대로 게시함 · 교훈 소유자 2026-11-17: 문장은 통째로만 뺀다; 잘린 문장이나 매달린 링크 꼬리는 게시하지 않는다. · 검사 ci-ai-intelligence-contract-check · 파일 src/ai/response/publication.js, src/ai/response/request-pipeline.js, scripts/ci-ai-intelligence-contract-check.mjs
## P2637 - v60.27 - Screener rows without a price stayed blank or showed last night's close as a live price · 교훈 One owner per concern: the page reached the quote owner through the scheduler, whose in-flight skip dropped the request, and the price cell decided '… · 검사 ci-screener-presentation-check, ci-screener-workbench-contract · 파일 src/ui/pages/screener/table.js, src/ui/pages/screener/model.js, src/ui/pages/screener/page.js, scripts/ci-screener-presentation-check.mjs, scripts/ci-screener-workbench-contract.mjs
## P2636 - v60.26 - Windows 기본 PATH에서 데이터 발행 모의 검사 실패 · 원칙 C3 · 교훈 C3 검증은 실제 결과를 증명한다. · 파일 scripts/ci-publish-data-commit-check.mjs
## P2635 - v60.26 - 같은 JSON을 비교해도 브라우저 자료 구조가 달라졌다고 보고 · 원칙 C3 · 교훈 C3 검증은 실제 결과를 증명한다. · 파일 scripts/lib/schema-fingerprint.mjs, scripts/ci-browser-data-fixture-check.mjs
## P2634 - v60.26 - SEC 연간 정규화가 회계연도를 매출로만 정해 최신 10-K의 순이익·자본을 버림 · 교훈 한 레코드의 회계연도는 그 레코드가 쓰는 모든 연간 피연산자 중 최신 기말이어야 하며, 새 해 순이익과 옛 해 매출을 섞지 않는다. · 검사 ci-data-pipeline-contract-check · 파일 src/domain/fundamental/sec-normalize.js, scripts/ci-data-pipeline-contract-check.mjs, scripts/fixtures/sec-fiscal-anchor-cases.mjs
## P2633 - v60.26 - 스크리너가 순위 0개·조건 결과 0종목을 이유 없이 보임(오래된 종가, 불러오는 중인 조건 자료) · 교훈 0이나 '없음'은 판정이 끝났을 때만 말한다 — 보류와 로딩은 이유와 함께 보류·로딩으로 말한다. · 검사 ci-screener-presentation-check · 파일 src/domain/screener/row-presentation.js, src/ui/pages/screener/model.js, src/ui/pages/screener/table.js, scripts/ci-screener-presentation-check.mjs
## P2632 - v60.26 - 스크리너가 PBR 자본을 '최근 연간(FY)'이라고 설명했지만 대부분 분기 재무상태표 자본 · 교훈 화면의 산식 설명은 자료가 실제로 쓰는 기준을 말한다. · 검사 ci-screener-presentation-check · 파일 src/domain/screener/row-presentation.js, src/ui/pages/screener/model.js, scripts/ci-screener-presentation-check.mjs
## P2631 - v60.26 - 스크리너 전체 순위가 반올림 백분위 동점으로 매겨지고 조건 화면에서는 그 화면 순위로 바뀜 · 교훈 같은 화면의 순위와 그 분모는 한 출처에서 나와야 하고, 반올림한 값으로 서수를 만들지 않는다. · 검사 ci-screener-presentation-check · 파일 src/domain/screener/overall-rank.js, src/data/orchestrators/screener.js, src/ui/pages/screener/model.js, src/ui/pages/screener/table.js, src/ui/pages/screener/inspector.js, src/ui/pages/screener/page.js
## P2630 - v60.26 - 스크리너 갱신 레인이 오늘 판정 기록 검사에 막혀 게시를 멈춤 · 교훈 교차 레인 일치 검사는 그 레인이 바꾸는 입력을 '같은 입력'으로 취급하면 안 된다. · 검사 ci-metric-consistency-check · 파일 scripts/lib/verdict-model.mjs, scripts/ci-metric-consistency-check.mjs
## P2629 - v60.26 - 현금 인수 대기 종목이 저변동 팩터 상위를 차지해 종합 순위가 부풀려짐 · 원칙 R713 · 교훈 R713: 판정 이름은 그 이름을 정의하는 조건이 있을 때만 붙이고, 임계값은 공용 상수에서 읽는다 — 저변동이라는 이름은 사업의 변동성을 전제로 한다. · 검사 ci-screener-workbench-contract · 파일 src/domain/screener/factor-ranks.js, src/domain/rules/thresholds.js, scripts/ci-screener-workbench-contract.mjs
## P2628 - v60.26 - 가치 팩터가 PER 200배·PBR 50배 이상을 빼고 채점해 비싼 종목이 더 싸게 읽힘 · 교훈 점수 입력은 값이 나빠질수록 점수도 같은 방향으로 움직여야 한다 — 극단값을 '자료 없음'으로 바꾸면 단조성이 깨진다. · 검사 ci-data-audit-contract-check · 파일 src/domain/screener/factor-ranks.js, scripts/ci-data-audit-contract-check.mjs
## P2627 - v60.26 - 배당락 당일 첫 마감 후 실행에서 수익률·RSI가 배당을 가격 하락으로 읽음 · 교훈 조정 계열을 쓰는 팩터는 공급자 조정이 완료됐는지 확인할 근거(배당 이벤트)를 함께 받아야 한다. · 검사 ci-data-pipeline-contract-check · 파일 src/domain/screener/price-factors.js, scripts/producer/screener.mjs, scripts/ci-data-pipeline-contract-check.mjs
## P2626 - v60.26 - 팩터 백테스트가 이력이 짧은 종목의 추세·추세 속도를 정의보다 짧은 창으로 채점 · 교훈 한 정의는 한 곳에 둔다 — 백테스트는 실제 팩터 코드의 창을 읽고, 짧은 이력이 모델 정의를 대신하지 않는다. · 검사 ci-data-pipeline-contract-check · 파일 src/domain/screener/price-factors.js, src/domain/screener/model-fingerprint.js, scripts/lib/factors.mjs, scripts/producer/screener.mjs, scripts/backtest-factors-longrun.mjs, scripts/ci-data-pipeline-contract-check.mjs
## P2625 - v60.26 - Forward PER 조건이 컨센서스 파일을 받는 동안 '0종목'을 표시하고, 자료 파일을 못 받으면 '불러오는 중'에 머묾 · 교훈 지연 자료를 읽는 조건은 자료가 오기 전의 0을 결과로 보이지 않고, 실패는 이유와 함께 끝낸다. 같은 규칙에 특수 경우를 두 번째로 더하지 않는다. · 검사 ci-screener-presentation-check · 파일 src/domain/screener/custom-conditions.js, src/ui/pages/screener/model.js, src/ui/pages/screener/table.js, src/ui/pages/screener/filters.js, src/ui/components/screener-cash.js, scripts/ci-screener-presentation-check.mjs
## P2624 - v60.26 - 스크리너 공급자가 거래량 기준(volumeBasis)과 PBR 자본 기준일을 페이지로 넘기지 않음 · 교훈 산출물이 밝힌 기준은 그것을 설명하는 화면까지 같은 이름으로 도착해야 한다. · 검사 ci-screener-workbench-contract · 파일 src/data/providers/screener.js, src/data/normalize/screener.js, src/ui/pages/screener/table.js, src/ui/pages/screener/inspector.js, scripts/ci-screener-workbench-contract.mjs
## P2623 - v60.26 - 종목 요약의 스크리너 종합 순위가 조건 화면 순서(screenRank)로 매겨짐 · 교훈 같은 순위는 화면마다 한 출처와 한 분모로 읽는다. · 검사 ci-esm-core-unit-check · 파일 src/ui/components/stock-read.js, src/domain/entity/stock-read.js, scripts/ci-esm-core-unit-check.mjs
## P2622 - v60.26 - SEC 정규화 출력이 바뀌었는데 정규화 버전이 그대로라 저장된 기록이 다시 정규화되지 않음 · 교훈 저장된 산출물의 의미를 바꾸는 정규화 변경은 그 산출물을 다시 만들게 하는 버전을 함께 올린다. · 검사 ci-data-audit-contract-check · 파일 src/domain/fundamental/sec-normalize.js, scripts/ci-data-audit-contract-check.mjs
## P2621 - v60.26 - 사후 검증 탭이 가격 요인 4개만 다시 매긴 백테스트를 '현재 순위와 같은 모델'이라 부르고 영어 사유·중복 날짜를 표시 · 교훈 검증 문장은 검증이 실제로 다룬 범위만 말하고, 한국어 화면에 원천의 영어 문장을 그대로 싣지 않는다. · 검사 ci-screener-presentation-check · 파일 src/domain/screener/model-fingerprint.js, src/ui/pages/screener/validation-tab.js, src/ui/components/screener-validation.js, src/ui/components/trend-chart.js, scripts/lib/factors.mjs, scripts/producer/screener.mjs
## P2620 - v60.26 - 다음 주 실적 두 줄이 모두 '비중이 가장 커'로 읽히고, 시장 폭 렌즈가 S&P 500 집계를 유니버스로 적음 · 교훈 최상급 표현은 한 대상에만 쓴다; 같은 지표의 집계 범위는 화면마다 같은 메타데이터에서 읽는다. · 검사 ci-domain-parity-check, ci-screener-market-fixture · 파일 src/domain/market/story/market-story.js, src/domain/narrative/lens-registry.js, scripts/ci-domain-parity-check.mjs, scripts/ci-screener-market-fixture.mjs
## P2619 - v60.26 - 브리핑 '지난 24시간'이 11/16 움직임을 11/17 종가 머리글 아래 날짜 없이 보여 줌 · 교훈 같은 사실을 두 화면이 다른 날짜(또는 날짜 없이)로 보이면 안 된다; 라벨은 한 함수가 정한다. · 검사 ci-headline-translation-check · 파일 src/domain/briefing/day-account.js, src/ui/components/home-day.js, src/ui/components/briefing-day.js, scripts/ci-headline-translation-check.mjs
## P2618 - v60.26 - 기술적 분석 대표 종목 표가 머리글과 다른 거래일을 날짜 없이 보여 줌 · 교훈 한 화면이 서로 다른 세션의 값을 함께 보이면 각자의 기준일을 적는다. · 검사 ci-domain-parity-check · 파일 src/domain/technical/market-charts.js, src/ui/pages/charts.js, scripts/ci-domain-parity-check.mjs
## P2617 - v60.26 - 실적 카드의 음수 EPS가 'EPS $-0.07'과 'EPS $(0.12)' 두 형식으로 찍힘 · 교훈 같은 화면의 같은 종류 숫자는 한 형식을 쓴다. · 검사 ci-event-briefs-check · 파일 src/domain/shared/number.js, src/domain/fundamental/consensus-read.js, src/domain/briefing/event-briefs.js, src/domain/briefing/reaction-read.js, scripts/ci-event-briefs-check.mjs, scripts/fixtures/pipeline-semantics/briefing.mjs
## P2616 - v60.26 - 예상치 없는 실적 카드가 '예상: 없음 / 발표: 없음'으로 읽힘 · 교훈 빈 칸의 문구가 사실과 다른 뜻(발표 없음)으로 읽히면 안 된다; 브리프가 가진 구조화 수치를 버리지 않는다. · 검사 ci-event-briefs-check · 파일 src/domain/briefing/reaction-read.js, src/ui/components/event-briefs.js, scripts/ci-event-briefs-check.mjs
## P2615 - v60.26 - 실적 카드 '주가 반응: 없음'이 아래 줄의 시간외 +4.8%와 어긋남 · 교훈 같은 카드 안의 두 표시가 같은 반응을 서로 다른 상태로 적으면 안 된다; 표시 문구는 도메인에서 한 번 정한다. · 검사 ci-event-briefs-check · 파일 src/domain/briefing/reaction-read.js, src/domain/briefing/event-briefs.js, src/ui/components/event-briefs.js, scripts/ci-event-briefs-check.mjs
## P2614 - v60.26 - 팩터 백테스트가 2년 이력을 받고도 1년 시절 리밸런스 6회만 계산 · 교훈 한 정의는 한 곳에 둔다 — 표본 범위는 수집 이력과 팩터 lookback에서 파생하고 손으로 다시 적지 않는다. · 검사 ci-data-pipeline-contract-check, ci-runtime-contract-check · 파일 src/domain/screener/model-fingerprint.js, scripts/lib/factors.mjs, scripts/ci-data-pipeline-contract-check.mjs, scripts/ci-runtime-contract-check.mjs, scripts/backtest-factors-longrun.mjs
## P2613 - v60.25 - Windows 체크아웃이 출시 후보 검사에서 거부됨 · 교훈 작업 계약의 데이터 정직성과 검증 증거 일치 · 파일 scripts/qa-runner.mjs, scripts/ci-qa-runner-behavior-check.mjs
## P2612 - v60.25 - 일반 파일 편집에서 작업공간 알림 발생 · 교훈 작업 계약의 데이터 정직성과 검증 증거 일치 · 파일 scripts/agent-hook.mjs, scripts/ci-workspace-contract-check.mjs
## P2611 - v60.25 - 이전 분석을 재사용하면 공급자 거부가 운영 상태에서 사라짐 · 교훈 작업 계약의 데이터 정직성과 검증 증거 일치 · 파일 scripts/lib/operational-health.mjs, scripts/ci-data-pipeline-contract-check.mjs
## P2610 - v60.25 - SEC 랭킹의 기준 시각이 시세 갱신 때 변경됨 · 교훈 작업 계약의 데이터 정직성과 검증 증거 일치 · 파일 scripts/build-operations-status.mjs, scripts/ci-operations-status-check.mjs
## P2609 - v60.25 - 빠진 목표비중을 0%로 계산 · 교훈 작업 계약의 데이터 정직성과 검증 증거 일치 · 파일 src/domain/portfolio/risk.js, src/ui/panels/portfolio-risk-input.js, scripts/ci-esm-core-unit-check.mjs
## P2608 - v60.25 - 검색 취소 뒤 종목 화면이 열림 · 교훈 작업 계약의 데이터 정직성과 검증 증거 일치 · 파일 src/ui/navigation/command-search.js, scripts/ci-search-surface-contract.mjs
## P2607 - v60.24 - searched figures beside an app trend date keep the 'AIO가 확인한 값 아님' notice · 교훈 Shown searched figures always say they are not AIO-verified. · 검사 ci-ai-intelligence-contract-check · 파일 src/ai/response/publication.js, scripts/ci-ai-intelligence-contract-check.mjs
## P2606 - v60.24 - an app trend close date is checked against this request's close-basis tool rows, not matched by phrase · 교훈 A check compares the claim with its source; a phrase is not a source and a missing source is not a negative finding. · 검사 ci-ai-intelligence-contract-check · 파일 src/ai/response/publication.js, scripts/ci-ai-intelligence-contract-check.mjs
## P2605 - v60.24 - the AI context and the lead's tie-keeping read scenario-state.json on the default 시장 신호 view again · 교훈 A deferred view defers DOM, not the data other consumers read. · 검사 ci-boot-interaction-check, ci-ai-intelligence-contract-check · 파일 src/ui/components/market-regime.js, src/ai/context/market-content.js, scripts/ci-boot-interaction-check.mjs, scripts/ci-ai-intelligence-contract-check.mjs
## P2604 - v60.23 - 웹검색과 앱 가격 도구의 기준일 출처가 혼합됨 · 교훈 앱 수치와 웹 근거의 출처를 일대일로 연결하고 없는 자료는 확인 불가로 표시한다. · 파일 src/ai/tools/registry.js, src/ai/tools/loop.js, src/ai/response/request-pipeline.js, src/ai/response/publication.js, js/aio-chat.js, scripts/ci-ai-intelligence-contract-check.mjs
## P2603 - v60.23 - 시장 상태의 숨겨진 시나리오 상세 선행 렌더링 · 교훈 숨은 상세는 실제 진입 시 로드하고 딥링크와 탭 탐색은 동일한 소유권을 사용한다. · 검사 ci-boot-interaction-check · 파일 src/ui/components/market-regime.js, src/ui/components/macro-crossroads.js, scripts/ci-boot-interaction-check.mjs
## P2602 - v60.23 - 첫 서비스워커 제어 직후 받은 앱 문서의 부팅 자산 불일치 · 교훈 오류 폴백은 실제로 실행할 수 있는 발행본과 정직한 차단 상태를 제공한다. · 파일 sw.js, offline.html, scripts/build-pages-bundle.mjs, scripts/lib/pages-bundle-config.mjs, scripts/ci-service-worker-offline-browser-check.mjs, scripts/ci-service-worker-cache-policy-check.mjs
## P2601 - v60.22 - 시장 이야기의 지연된 과거 기록이 열린 상세와 포커스를 초기화 · 교훈 비동기 데이터 갱신은 사용자 탐색과 근거 읽기 위치를 유지한다. · 검사 ci-architecture-browser-check · 파일 src/ui/components/market-narratives.js, scripts/ci-architecture-browser-check.mjs
## P2600 - v60.21 - the watchdog trusted a CI run by its head_sha while Pages deploys the SHA in the run's attestation · 교훈 AGENTS: one definition per decision; v60.19 attested-release rule (only the attested SHA deploys). · 검사 ci-deployment-convergence-check, ci-qa-pipeline-contract-check · 파일 .github/workflows/pages-deploy.yml, scripts/deployment-provenance.mjs, scripts/ci-external-pipeline-check.mjs, scripts/ci-deployment-convergence-check.mjs, scripts/ci-qa-pipeline-contract-check.mjs, architecture/qa-pipeline.json
## P2599 - v60.21 - the generated-conflict resolver took the code fields from origin when a background fetch advanced origin/main during the merge · 원칙 R626 · 교훈 R626: generated-manifest conflicts merge by field ownership with the data side taken from main's line. · 검사 ci-generated-conflict-fixture · 파일 scripts/resolve-data-manifest-merge.mjs, scripts/resolve-generated-conflicts.mjs, scripts/ci-generated-conflict-fixture.mjs
## P2598 - v60.21 - 시장 상태 showed one scenario with two past records: the story section kept the frame it drew from AIO's own closes before scenario-outcomes.json arrived · 교훈 One interpretation model per page state: every section and the AI quote the same record for a branch. · 검사 ci-decision-frame-check · 파일 src/domain/market/regime/macro-crossroads.js, src/ui/components/market-narratives.js, src/ai/context/market-content.js, scripts/ci-decision-frame-check.mjs
## P2597 - v60.21 - a web-searched answer dropped the figures the reader asked to be searched, kept or broke their citations and opened '최신 수치 확인 안 됨 — 일반 설명만' under a s… · 교훈 AGENTS AI: cited web search fills what the artifacts cannot answer; numbers need a source (plan 044: a current figure must exist in what the model wa… · 검사 ci-ai-intelligence-contract-check, ci-ai-chat-reliability-contract-check · 파일 src/ai/response/publication.js, src/ai/response/request-pipeline.js, js/aio-chat.js, scripts/ci-ai-intelligence-contract-check.mjs, scripts/ci-ai-chat-reliability-contract-check.mjs
## P2596 - v60.21 - the market-reading validator admitted a likelihood on the met-condition count and axis states after the prompt stopped offering them as grounds · 원칙 R698 · 교훈 R698: an AI answer is filtered by sentence (the filter must admit what the prompt allows and nothing it withholds). · 검사 ci-market-reading-week-fixture, ci-narrative-lifecycle-model-check, ci-scenario-guidance-fixture · 파일 src/domain/content/likelihood-grounds.js, scripts/lib/market-analysis-validate.mjs, scripts/lib/market-analysis-prompt.mjs, scripts/lib/model-check-kit.mjs, scripts/ci-narrative-lifecycle-model-check.mjs, architecture/model-check-coverage.json
## P2595 - v60.21 - a weekend provider restamp was filed as a Saturday session and moved into the row before it, so the time contract refused every refresh for seven hou… · 교훈 A history row write must never take a shape the time contract refuses, and a session is a session day of the field's own calendar. · 검사 ci-history-session-model-check · 파일 src/domain/market/session/history-session.js, scripts/producer/history.mjs, scripts/ci-history-session-model-check.mjs, architecture/model-check-coverage.json
## P2594 - v60.21 - 외부 공유에서 잘못된 주소의 복귀 경로 누락 · 교훈 외부에서 잘못된 링크에 도착한 독자에게 탐색을 재개할 경로를 제공한다. · 검사 ci-release-revision-check, ci-boot-bundle-budget-check · 파일 404.html, index.html, og-image.png, .github/workflows/pages-deploy.yml, scripts/lib/pages-bundle-config.mjs, public-artifact-manifest.json
## P2593 - v60.21 - 소표본 실적 반응의 비율 표기 · 교훈 과거 집계는 표본이 10건 미만이면 건수로 표시하고 비율에 기저율을 함께 둔다. · 검사 ci-data-audit-contract-check · 파일 src/domain/briefing/event-aftermath.js, scripts/ci-data-audit-contract-check.mjs
## P2592 - v60.21 - 첫 거래와 심리 기록의 진입 및 이전 입력 잔류 · 교훈 빈 상태는 첫 사용자 작업의 진입점을 노출하고 거래마다 선택을 기록한다. · 검사 ci-portfolio-vault-e2e · 파일 src/ui/pages/portfolio.js, src/ui/panels/portfolio-trade-journal.js, scripts/ci-portfolio-vault-e2e.mjs
## P2591 - v60.21 - 자산군 선택 기간과 첫 요약 불일치 · 교훈 기간을 선택하면 결과와 해석이 같은 표본과 기간을 사용한다. · 검사 ci-architecture-browser-check · 파일 src/ui/components/macro-board.js, scripts/ci-architecture-browser-check.mjs
## P2590 - v60.21 - 종목 메모 진입과 공유 주소의 화면 불일치 · 교훈 종목 선택과 보기 상태는 주소, 화면, 저장 초안의 같은 발행사를 가리킨다. · 검사 ci-entity-deep-link-browser-check · 파일 src/app/router.js, src/app/research-handoff.js, src/ui/pages/entity.js, src/ui/navigation/page-views.js, src/ui/components/research-snapshots.js, src/ui/components/stock-lens-cards.js
## P2589 - v60.20 - the stamp fixture no longer assumes the committed stress record is unstamped · 교훈 A gate that reads a published artifact must hold for both the artifact as committed and the artifact as the next producer run writes it (pre-push pro… · 파일 scripts/ci-scenario-guidance-fixture.mjs
## P2588 - v60.19 - the reader-boot check proves the hover load instead of counting any idle callback · 교훈 A gate asserts the behaviour it names; a condition that is true through an unrelated module is not evidence. · 파일 scripts/ci-ai-chat-public-route-browser-check.mjs, src/domain/scenarios/outcome-fingerprints.js
## P2587 - v60.19 - the VIX-band fold and the correction card disappeared while their weekly record waited for a new definition stamp · 교훈 AGENTS: a designed source that failed stays visible as 없음 with its last date. · 검사 ci-scenario-guidance-fixture · 파일 src/domain/scenarios/outcome-fingerprints.js, src/ui/components/stress-outcomes.js, src/ui/components/correction-base-rate.js, scripts/ci-scenario-guidance-fixture.mjs
## P2586 - v60.19 - a validator exception failed the whole refresh · 교훈 A failing stage degrades to the plain fallback and a pipeline notice; it never fails the data cycle. · 검사 ci-market-reading-week-fixture · 파일 scripts/producer/market-narrative.mjs, scripts/lib/market-analysis-validate.mjs, src/data/pipeline-notices.js, scripts/ci-market-reading-week-fixture.mjs, scripts/ci-narrative-lifecycle-model-check.mjs, architecture/model-check-coverage.json
## P2585 - v60.19 - the portfolio stress panel read the KOSPI rows on the wall clock instead of the app clock · 교훈 Every surface reads time from the app clock so shifted-clock checks cover it. · 검사 ci-esm-core-unit-check · 파일 src/ui/components/portfolio-exposure.js, src/ui/panels/portfolio-stress.js, src/domain/portfolio/kr-stress.js, scripts/ci-esm-core-unit-check.mjs
## P2584 - v60.19 - the AI record tool said a valid branch id had no record while its definition stamp was behind · 교훈 A source that is present but unusable is named as such, never as absent. · 검사 ci-ai-intelligence-contract-check · 파일 src/ai/tools/market-tools.js, scripts/ci-ai-intelligence-contract-check.mjs
## P2583 - v60.19 - a Yahoo/FRED failure in the lean backtest skipped the screener validation verdict · 교훈 A degradable input degrades its own verdict, not unrelated ones, and its failure stays visible. · 검사 ci-market-lean-validation-check · 파일 .github/workflows/research-backtest.yml, scripts/ci-market-lean-validation-check.mjs
## P2582 - v60.19 - the AI reading's rejection log was never written in production · 교훈 Owner decision P1719: rejected AI text is kept for the operator outside the repository, never in a published file. · 검사 ci-market-reading-week-fixture · 파일 scripts/producer/market-narrative.mjs, scripts/ci-market-reading-week-fixture.mjs, scripts/ci-data-pipeline-contract-check.mjs, scripts/ci-narrative-lifecycle-model-check.mjs, scripts/ci-scenario-guidance-fixture.mjs
## P2581 - v60.19 - a persistent 13F lane failure turned every refresh run red and doubled the data cycle · 교훈 A run's conclusion is its own work's outcome; a side lane's alert is a signal beside it (v59.85 fallback guard). · 검사 ci-13f-currentness-check · 파일 scripts/daily-lane-age.mjs, .github/workflows/refresh-data.yml, scripts/ci-13f-currentness-check.mjs, scripts/fixtures/pipeline-semantics/operations.mjs
## P2580 - v60.19 - the lean basis said every published verdict failed, including a passed direction · 교훈 A state line says what the published verdict says, case by case. · 검사 ci-market-lean-validation-check · 파일 src/domain/market/regime/market-lean.js, scripts/ci-market-lean-validation-check.mjs, scripts/fixtures/expect/market-lean.expect.md
## P2579 - v60.19 - the 시장 기울기 card never repainted when the lean verdict arrived after the AI context reader asked for it · 교훈 A reader that paints before its data arrives is repainted when it arrives. · 검사 ci-market-lean-validation-check · 파일 src/ui/components/session-lean.js, scripts/ci-market-lean-validation-check.mjs
## P2578 - v60.19 - the 시장 상태 fold stated a risk-validation verdict that had no committed criterion, artifact or judge · 교훈 Owner 2026-11-15: no unvalidated verdict shown as a result; a validation verdict comes from a registered criterion and a published judgement. · 검사 ci-market-lean-validation-check · 파일 architecture/validation-gate-criteria.json, scripts/backtest-market-lean-risk.mjs, scripts/build-validation-gates.mjs, .github/workflows/research-backtest.yml, src/domain/market/regime/market-lean.js, scripts/lib/market-analysis-prompt.mjs
## P2577 - v60.19 - a multi-session move was graded on three different sds by the screen, the ledger and the reading validator · 교훈 One materiality scale: a move is sized the same way on every surface that names its size. · 검사 ci-esm-core-unit-check · 파일 src/domain/market/session/move-size.js, src/domain/market/day/facts.js, scripts/lib/market-analysis-moves.mjs, src/domain/market/regime/regime-scenarios.js, scripts/ci-esm-core-unit-check.mjs
## P2576 - v60.19 - an evidence-bound AI claim was dropped for a second figure in text that is never published · 교훈 A check guards what is published; a value the evidence proves is not dropped for text that is replaced. · 검사 ci-ai-intelligence-contract-check · 파일 src/ai/response/publication.js, scripts/ci-ai-intelligence-contract-check.mjs
## P2575 - v60.19 - a size-word block reached the retry prompt as a bare code · 교훈 Every blocking validator issue reaches the retry with a fix the model can act on. · 검사 ci-market-reading-week-fixture · 파일 scripts/lib/market-analysis-validate.mjs, scripts/producer/market-narrative.mjs, scripts/ci-market-reading-week-fixture.mjs
## P2574 - v60.19 - the reading's size-word check blocked correct sentences by giving every size word in a one-metric sentence to that metric · 교훈 A validator rule guards clear contradictions only; when the binding of a word to a metric is in doubt it does not fire. · 검사 ci-market-reading-week-fixture · 파일 scripts/lib/market-analysis-validate.mjs, scripts/ci-market-reading-week-fixture.mjs
## P2573 - v60.19 - 부팅 뒤 6.5초 지연 JS 375,712바이트로 예산 370,000 초과 — 모든 라우트가 포트폴리오 렌더러를 받음 · 교훈 부팅 뒤 창에는 그 라우트가 쓰는 코드만 읽는다 · 검사 ci-boot-interaction-check, ci-portfolio-vault-e2e · 파일 src/app/legacy-screen-bridges.js, src/app/portfolio-screen-bridges.js
## P2572 - v60.19 - 시장 기울기가 검증 안 된 규칙으로 매수·매도 방향을 표시함 · 교훈 AGENTS 제품 결정: 근거 없는 등급·검증 안 된 점수를 판정처럼 보이지 않는다; 과거 빈도는 겹치지 않는 사례·기본 비율·표본 수와 함께 · 검사 ci-market-lean-validation-check · 파일 src/domain/market/regime/market-lean.js, src/ui/components/session-lean.js, scripts/backtest-market-lean.mjs, scripts/build-validation-gates.mjs, scripts/ci-market-lean-validation-check.mjs, architecture/validation-gate-criteria.json
## P2571 - v60.19 - 시장 기울기 모델이 R724에 어긋나게 기울기별 '덜 불리한 선택'을 AI 맥락에 넣음 · 원칙 R724 · 교훈 R724 · 검사 ci-market-lean-validation-check · 파일 src/domain/market/regime/market-lean.js, src/ui/components/session-lean.js, scripts/lib/market-analysis-prompt.mjs, scripts/ci-market-lean-validation-check.mjs, scripts/fixtures/expect/market-lean.cases.mjs, scripts/fixtures/expect/market-lean.expect.md
## P2570 - v60.19 - 시장 기울기 빈도의 표본 수 하한이 반올림 전 값으로 판정돼 표시와 어긋남 · 교훈 표본 수는 한 번 반올림한 값으로 판정·표시한다 · 검사 ci-esm-core-unit-check · 파일 src/domain/market/regime/market-lean.js, src/domain/shared/evidence-strength.js, scripts/ci-esm-core-unit-check.mjs
## P2569 - v60.19 - AI 시장 읽기가 이동 크기 등급을 모른 채 크기 단어를 씀 · 교훈 AI 문장의 크기 단어는 원장 등급과 같아야 한다 · 검사 ci-market-reading-week-fixture, ci-data-pipeline-contract-check · 파일 scripts/lib/market-analysis-moves.mjs, scripts/lib/market-analysis-validate.mjs, scripts/lib/market-analysis-prompt.mjs, scripts/producer/market-narrative.mjs, scripts/ci-market-reading-week-fixture.mjs, scripts/ci-data-pipeline-contract-check.mjs
## P2568 - v60.19 - 고정 % 기준 크기 단어(보합권·크게·급등)가 이동 크기 등급과 어긋남 · 교훈 크기 단어는 한 등급 규칙에서만 나온다 · 검사 ci-move-size-word-check, ci-esm-core-unit-check · 파일 src/domain/market/session/move-size.js, src/domain/market/day/facts.js, scripts/lib/market-timeline.mjs, src/domain/briefing/market-read.js, src/domain/macro/krw-decomposition.js, src/domain/macro/rates-fx.js
## P2567 - v60.19 - 열린 나스닥 조정에 깊이와 무관한 기저율(40번 중 8번)만 보임 · 교훈 과거 빈도는 지금과 같은 조건의 사례로 센다 (AGENTS Past frequencies) · 검사 ci-decision-frame-check, ci-data-audit-contract-check, ci-esm-core-unit-check · 파일 src/domain/scenarios/correction-base-rates.js, src/ai/tools/market-tools.js, scripts/ci-decision-frame-check.mjs
## P2566 - v60.19 - 표본 없는 방향 문장과 개수를 근거로 허용한 AI 지시 · 원칙 R713 · 교훈 방향·우위 문장은 기저율과 표본 수가 붙은 빈도와 함께만 쓴다 (AGENTS Past frequencies, R713) · 검사 ci-decision-frame-check, ci-scenario-guidance-fixture, ci-ai-intelligence-contract-check · 파일 src/domain/technical/market-charts.js, src/ai/response/answer-modes.js, src/domain/market/regime/macro-crossroads.js, src/ai/context/market-content.js
## P2565 - v60.19 - 규칙표의 '비용이 작은 쪽'이 화면에서 비용 가설 꼬리표 없이 과거 성과처럼 보임 · 교훈 규칙표에서 나온 우위는 근거 종류(비용 가설)와 과거 빈도를 곁에 두고 보인다 (AGENTS Judgement allowed · Past frequencies) · 검사 ci-decision-frame-check · 파일 src/domain/scenarios/decision-frame.js, src/ui/components/decision-frame.js, src/ui/components/macro-crossroads.js, src/ui/components/market-narratives.js, src/ui/components/theme-playbook-view.js, src/domain/market/regime/macro-crossroads.js
## P2564 - v60.19 - 명령 검색에서 Home·End가 아무 일도 하지 않음 · 교훈 목록 키 동작은 공용 listbox 규칙 하나를 쓴다 · 검사 ci-search-surface-contract · 파일 src/ui/navigation/command-search.js, scripts/ci-search-surface-contract.mjs
## P2563 - v60.19 - route-owners가 매크로에 없는 실시간 가격 속성을 표면으로 선언 · 교훈 레지스트리는 지금 코드가 쓰는 표면만 선언한다 · 검사 ci-architecture-contract-check · 파일 architecture/route-owners.json, scripts/ci-architecture-contract-check.mjs
## P2562 - v60.19 - AI 공급망 보드가 대만 매출이 늦게 오면 열린 PER 접힘을 지움 · 교훈 늦은 데이터 재그리기는 첫 그리기와 같은 옵션을 쓴다 · 검사 ci-architecture-contract-check · 파일 src/ui/components/ai-chain-flow.js, scripts/ci-architecture-contract-check.mjs
## P2561 - v60.19 - 새로고침 재렌더가 자산군 1개월을 3개월로 되돌리고 포커스를 BODY로 떨어뜨림 · 교훈 재렌더는 읽는 사람의 선택과 포커스를 지킨다 · 검사 ci-architecture-browser-check · 파일 src/ui/behaviors/focus-continuity.js, src/app/after-boot.js, src/ui/components/macro-board.js, scripts/ci-architecture-browser-check.mjs, scripts/ci-architecture-contract-check.mjs
## P2560 - v60.19 - 수동 Pages 배포가 지정한 SHA와 다른 증명 SHA를 조용히 배포 · 교훈 배포는 CI가 증명한 SHA만, 지정한 SHA와 다르면 멈춘다 · 검사 ci-deployment-convergence-check · 파일 .github/workflows/pages-deploy.yml, scripts/ci-deployment-convergence-check.mjs
## P2559 - v60.19 - Event briefs 경보가 한 번 성공으로 닫히고, Worker가 돌린 실행이 SLO에서 운영자 실행으로 빠짐 · 교훈 자동 실행은 실행 이름으로 자동임을 밝힌다 · 검사 ci-data-plane-contract-check · 파일 .github/workflows/operations-alert.yml, .github/workflows/data-watchdog.yml, .github/workflows/event-briefs.yml, worker/data-plane.js, scripts/lib/data-publish-sets.mjs, scripts/ci-data-plane-contract-check.mjs
## P2558 - v60.19 - 공식 웹검색 근거가 180일을 넘으면 데이터 발행 자체가 멈추는 시계 폭탄 · 교훈 만료되는 참고 근거는 발행을 막지 않고 미리 알린다 · 검사 ci-data-pipeline-contract-check · 파일 scripts/ci-web-research-contract-check.mjs, scripts/ci-manual-reference-expiry-check.mjs, .github/workflows/data-watchdog.yml, js/aio-core.js, scripts/ci-data-pipeline-contract-check.mjs
## P2557 - v60.19 - FRED 전 계열 실패·출처 없는 이월값이 무결성 게이트를 통과 · 원칙 C9 · 교훈 이월한 값은 관측일과 원 출처를 가진다(C9) · 검사 ci-data-pipeline-contract-check · 파일 scripts/ci-refresh-artifact-integrity-check.mjs, scripts/ci-data-pipeline-contract-check.mjs
## P2556 - v60.19 - 부팅 뒤 6.5초 지연 JS가 509,042바이트로 예산 397,000 초과 · 교훈 부팅 뒤 창에는 그 라우트가 쓰는 코드만 읽는다 · 검사 ci-boot-interaction-check, ci-architecture-contract-check · 파일 src/app/classic-loader.js, src/ui/components/term-marks.js, src/ui/knowledge/research-shell.js, src/app/compatibility-globals.js, src/app/bootstrap.js, src/ui/pages/analysis.js
## P2555 - v60.19 - 헤드리스 T145b가 글 0개 채널을 다이제스트 채널로 세어 실패 · 원칙 C14 · 교훈 감사는 생산자가 실제로 낸 항목만 비교한다 · 파일 js/aio-qa-audits.js
## P2554 - v60.19 - 시장 원장에서 가격의 중요도가 자기 z만 보고, 그 가격이 움직인 업종·종목('설명하는 것')을 반영하지 않음 · 교훈 가격 사실의 중요도는 자기 변동성 대비 크기와 그 가격이 그날 움직인 것(선언된 driver 연결)으로 정한다 · 검사 ci-esm-core-unit-check, ci-market-reading-week-fixture · 파일 src/domain/market/day/facts.js, scripts/lib/market-analysis-moves.mjs, scripts/ci-esm-core-unit-check.mjs, scripts/ci-market-reading-week-fixture.mjs
## P2553 - v60.19 - 시황 요약의 크기 말('큰 폭' 등)이 고정 % 경계로 정해져 지표 자체 변동성과 무관 · 교훈 규칙 기반 문장의 크기 말은 원장의 한 가지 크기(자기 변동성 대비)에서 나온다 · 검사 ci-data-pipeline-contract-check · 파일 scripts/lib/market-timeline.mjs, scripts/fetch-data.mjs, scripts/ci-data-pipeline-contract-check.mjs
## P2552 - v60.19 - 완료 시황 슬롯에 슬롯 종료 뒤 관측한 시세가 그 슬롯의 움직임으로 실림 · 교훈 기간 단위 기록은 그 기간 안에서 관측한 값만 담는다 · 검사 ci-data-pipeline-contract-check · 파일 scripts/lib/market-timeline.mjs, scripts/fetch-data.mjs, scripts/ci-data-pipeline-contract-check.mjs
## P2551 - v60.19 - CPI 소비 경로가 보여 주는 달을 밝히지 않고, 13개월 연율을 '전년 대비'로 표기 · 교훈 파생 수치는 공식 지표 이름을 빌리지 않고 파생임과 근거를 밝힌다; 화면의 지난 발표값은 그 기준월을 단다 · 검사 ci-esm-core-unit-check · 파일 src/domain/briefing/schedule.js, src/domain/macro/macro-read.js, src/domain/macro/macro-chapters.js, src/domain/macro/macro-signals.js, scripts/ci-esm-core-unit-check.mjs
## P2550 - v60.19 - 연준 목표 범위 중간값이 서로 다른 날짜의 상단·하단을 평균 · 교훈 범위는 한 관측일의 상·하단이다 · 검사 ci-esm-core-unit-check · 파일 src/domain/macro/fed-target-range.js, src/ui/knowledge/current-observations.js, src/domain/macro/macro-read.js, src/domain/macro/taylor-rule.js, src/domain/macro/macro-chapters.js, src/domain/macro/liquidity-growth.js
## P2549 - v60.19 - 포트폴리오 S&P 비교가 다른 두 날짜의 환율과 주가를 합쳐 +21%를 커버리지 100%로 표시 · 교훈 서로 곱하는 두 변화율은 같은 두 관측일 사이의 변화다 · 검사 ci-portfolio-native-chart-check · 파일 src/ui/components/portfolio-value-trend.js, scripts/ci-portfolio-native-chart-check.mjs
## P2548 - v60.19 - 그림자 모델 식별자가 한국 가중치·팩터 공식이 바뀌어도 같아 다른 모델 성과를 같은 모델로 비교 · 교훈 검증 기록의 모델 식별자는 모델을 정의하는 전부(시장별 가중치·공식)의 지문이다 · 검사 ci-candidate-archive-check · 파일 scripts/lib/candidate-archive.mjs, src/domain/screener/model-fingerprint.js, scripts/ci-candidate-archive-check.mjs
## P2547 - v60.19 - SEC 첫 연차보고서가 시도와 같은 UTC일이면 재시도되지 않고 7일 목록창을 지나면 빠짐 · 교훈 재시도 근거가 되는 관측(공시 접수)은 그 관측을 처리할 때까지 남는다 · 검사 ci-fiscal-quality-fixture · 파일 scripts/fetch-sec-fundamentals.mjs, scripts/ci-fiscal-quality-fixture.mjs
## P2546 - v60.19 - 컨센서스 일회성 분기 판정이 직전 4분기 밖의 5번째 분기까지 읽어 PER·성장률을 숨김 · 교훈 합계의 품질 판정은 그 합계를 이루는 기간만 본다 · 검사 ci-data-pipeline-contract-check · 파일 src/domain/fundamental/consensus-read.js, scripts/ci-data-pipeline-contract-check.mjs
## P2545 - v60.19 - 다시 묻기가 저장된 종목 대화가 아닌 지금 열린 매크로 대화로 전송 · 교훈 다시 보내는 질문은 그 질문이 속한 대화와 화면으로 간다 · 검사 ci-chat-ui-state-browser-check, ci-ai-intelligence-contract-check · 파일 src/ui/components/chat-run-status.js, src/ui/components/chat-sessions.js, src/ai/session/pending-turn.js, scripts/ci-chat-ui-state-browser-check.mjs, scripts/ci-ai-intelligence-contract-check.mjs
## P2544 - v60.19 - 검색을 요청한 질문이 앱 함수 호출만으로 검색 없이 끝남 · 교훈 사용자가 검색을 요청한 답변은 실제 호스티드 검색을 한 번 이상 거친다 · 검사 ci-ai-chat-reliability-contract-check, ci-ai-intelligence-contract-check · 파일 src/ai/tools/loop.js, scripts/ci-ai-chat-reliability-contract-check.mjs, scripts/ci-ai-intelligence-contract-check.mjs
## P2543 - v60.19 - AI 답변의 수치가 값만 맞으면 다른 종목·지표·기준·날짜의 근거로 통과 · 교훈 답변의 수치는 같은 종목·지표·기준·관측일·방향의 근거에만 묶인다 · 검사 ci-ai-intelligence-contract-check · 파일 src/ai/response/publication.js, scripts/ci-ai-intelligence-contract-check.mjs
## P2542 - v60.18 - 시장 온도의 닛케이 기준일이 도쿄 오전마다 하루 이틀 뒤로 감 · 교훈 발행된 기준일은 공급처의 일시적 빈 봉 때문에 뒤로 가지 않는다 · 검사 ci-esm-core-unit-check · 파일 scripts/build-market-temperature.mjs, scripts/ci-esm-core-unit-check.mjs
## P2541 - v60.18 - market-day 중요도가 여러 날 누적 움직임을 놓침 — 10년물 5거래일 +29bp가 minor 23, 11/13 lead 0건 · 교훈 움직임의 크기를 매기는 기준은 한 표에 있고, 같은 방향으로 이어지는 누적 움직임도 그 표로 잰다 · 검사 ci-metric-consistency-check · 파일 src/domain/rules/thresholds.js, src/domain/market/day/facts.js, src/domain/briefing/day-account.js, scripts/ci-metric-consistency-check.mjs
## P2540 - v60.18 - 발행된 today-verdict.json이 이전 규칙(v60.14)의 판정(1/4/1)인데 현재 코드(1/3/2)와 다르다는 표시가 없었음 — 토요일 개수 변화도 원인 불명 · 교훈 발행된 파생 판정은 그것을 만든 코드를 밝히고, 같은 코드·같은 입력이면 같은 판정이어야 한다 · 검사 ci-esm-core-unit-check, ci-metric-consistency-check · 파일 scripts/lib/verdict-model.mjs, scripts/build-scenario-state.mjs, scripts/ci-metric-consistency-check.mjs, scripts/ci-esm-core-unit-check.mjs
## P2539 - v60.18 - 변동성 축이 VIX 급락 중에 '5일 +5% 올라'라고 씀 — 5거래일 전 기준점이 급등 직전이라 순변화가 오늘 구간과 반대 · 교훈 변화율을 말할 때는 같은 계열의 두 점을 날짜와 함께 밝히고, 끝점 차이를 진행 방향으로 쓰지 않는다 · 검사 ci-metric-consistency-check · 파일 src/domain/briefing/market-read.js, scripts/ci-metric-consistency-check.mjs
## P2538 - v60.18 - 오늘 hero와 추세·AI·반도체 축 문장이 반등일에도 '주도주가 함께 약해지고 있습니다'로 고정됨 — 수준 판정과 최근 방향을 한 술어로 말함 · 교훈 한 문장의 술어는 그 문장이 인용한 숫자의 방향과 같아야 하고, 수준 상태와 최근 변화는 각자의 숫자에서 나온다 · 검사 ci-metric-consistency-check, ci-esm-core-unit-check · 파일 src/domain/market/signal/recent-direction.js, src/domain/briefing/market-read.js, src/domain/guide/lessons.js, scripts/ci-metric-consistency-check.mjs, scripts/ci-esm-core-unit-check.mjs, scripts/ci-crash-replay-check.mjs
## P2537 - v60.18 - 작은 표본의 과거 수치가 자리마다 다른 문구로 나오고, 리밸런스 6번에 '약하게 같은 방향'이라고 씀 · 원칙 R706 · 교훈 R706 — 과거 빈도는 표본 하한 아래에서 수치를 내지 않고, 하한과 문구는 한 곳에서 정한다 · 검사 ci-scenario-guidance-fixture, ci-esm-core-unit-check · 파일 src/domain/shared/evidence-strength.js, src/domain/scenarios/analogs.js, src/ui/components/stress-outcomes.js, src/ui/components/market-temperature.js, src/ui/pages/screener/validation-tab.js, scripts/ci-scenario-guidance-fixture.mjs
## P2536 - v60.18 - build-validation-gates.mjs가 없는 --out-dir에서 ENOENT로 멈추고, --check 실패 이유를 말하지 않음 · 교훈 출력 디렉터리를 받는 스크립트는 그 디렉터리를 만든다 · 검사 ci-scenario-guidance-fixture · 파일 scripts/build-validation-gates.mjs, scripts/ci-scenario-guidance-fixture.mjs
## P2535 - v60.18 - 테마 단계 장기 기록이 v60.15 이전 절대 수익 기준인데 새 문구로 표시되고, 주간 생산자가 재생성을 건너뜀 · 교훈 캐시·주간 산출물은 정의 지문이 지금 코드와 같을 때만 유지·표시한다(손으로 올리는 버전 문자열로 판단하지 않는다) · 검사 ci-scenario-guidance-fixture · 파일 src/domain/shared/definition-fingerprint.js, scripts/build-outcome-stamps.mjs, src/domain/scenarios/outcome-stamps.js, src/domain/scenarios/outcome-fingerprints.js, src/domain/scenarios/analogs.js, src/domain/scenarios/theme-playbook.js
## P2534 - v60.18 - 5거래일 +0.35%인 테마에 '급락'이 붙음 · 교훈 크기 낱말(급락·급등)은 그 대상 자신의 움직임과 문턱에서 나온다 · 검사 ci-scenario-guidance-fixture · 파일 src/domain/scenarios/theme-playbook.js, scripts/ci-scenario-guidance-fixture.mjs
## P2533 - v60.18 - 테마 단계가 매일 밤 22:51Z에 뒤집혔다가 23:21Z에 돌아옴 — 기준 지수가 30분 동안 바뀜 · 교훈 판정의 기준(지수·날짜)은 한 판독 안에서 바뀌지 않고, 바뀐 기준으로 계산된 값은 같은 이름으로 비교하지 않는다 · 검사 ci-scenario-guidance-fixture · 파일 src/domain/scenarios/theme-playbook.js, scripts/build-scenario-state.mjs, scripts/ci-scenario-guidance-fixture.mjs
## P2532 - v60.18 - 텔레그램 채널 수 4가 게이트·감시·브라우저에 박혀 있어, 채널 퇴역 뒤 첫 다이제스트에서 실패하고 브라우저는 퇴역 채널을 계속 요청 · 교훈 등록부가 정하는 개수는 소비자가 등록부에서 파생한다; 숫자 리터럴로 복제하지 않는다 · 검사 ci-atlas-contract-check, ci-runtime-contract-check · 파일 scripts/lib/telegram-channels.mjs, scripts/ci-atlas-contract-check.mjs, scripts/ci-six-doc-coverage-check.mjs, scripts/ci-external-pipeline-check.mjs, scripts/lib/operational-health.mjs, scripts/ci-data-pipeline-contract-check.mjs
## P2531 - v60.18 - 13F 레인이 9일 실패하는 동안 운영자 알림이 한 번도 열리지 않음 · 교훈 저하 허용 레인도 지속 실패는 운영 알림에 닿아야 한다 · 검사 ci-13f-currentness-check · 파일 scripts/daily-lane-age.mjs, .github/workflows/refresh-data.yml, scripts/ci-13f-currentness-check.mjs
## P2530 - v60.18 - 13F 마스터 레인이 11/06부터 실패 — security-master 정규화 경계 수치를 아무도 다시 계산하지 않음 · 교훈 게이트가 다른 산출물과 같기를 요구하는 수치는 같은 생산자가 같은 입력에서 함께 계산해 쓴다 · 검사 ci-masters-contract-check · 파일 scripts/lib/masters-raw-rows.mjs, scripts/build-masters-runtime-artifacts.mjs, scripts/lib/data-publish-sets.mjs, scripts/ci-masters-contract-check.mjs
## P2529 - v60.18 - 화면 곳곳의 자체 부호 함수가 0을 '+0.0%'로, 0 변화를 방향 있는 말로 적음 · 교훈 부호와 방향은 공용 포맷터 한 곳에서 정한다; 0은 부호도 방향도 없다 · 검사 ci-esm-core-unit-check · 파일 src/domain/briefing/credit-reading.js, src/domain/briefing/reaction-read.js, src/domain/macro/macro-chapters.js, src/domain/market/indices/index-levels.js, src/domain/technical/market-charts.js, src/domain/briefing/ai-chain-flow.js
## P2528 - v60.18 - 신선도 원장이 막힌 산출물을 'missing'으로 적고, bigtech-cashflow가 시각만 바뀐 커밋을 반복함 · 교훈 운영자 입력을 기다리는 산출물은 blocked로, 사라진 산출물만 missing으로 적는다; 시각만 바뀐 재확인은 커밋하지 않는다 · 검사 ci-artifact-refresh-path-check · 파일 scripts/write-freshness-ledger.mjs, src/data/contracts/artifact-freshness.js, scripts/ci-artifact-refresh-path-check.mjs
## P2527 - v60.18 - operations-status overall이 상수 'OPERATOR_REQUIRED'로 고정되어 상태를 말하지 않음 · 교훈 요약 상태는 그 근거가 되는 항목에서 계산한다; 상수 요약은 상태가 아니다 · 검사 ci-operations-status-check · 파일 scripts/build-operations-status.mjs, scripts/ci-operations-status-check.mjs
## P2526 - v60.18 - AI 공급자 계정 거절(HTTP 429 credit_balance_exhausted)이 경고로만 남아 운영자 알림이 없음 · 교훈 운영자 조치가 필요한 외부 거절은 알림이 여는 오류로 올린다; 스스로 회복되는 저하만 경고로 둔다 · 검사 ci-data-pipeline-contract-check, ci-operations-status-check · 파일 scripts/lib/operational-health.mjs, scripts/ci-external-pipeline-check.mjs, scripts/build-operations-status.mjs, scripts/ci-data-pipeline-contract-check.mjs
## P2525 - v60.18 - screener 충돌 재실행이 운영자 실행으로 디스패치되어 현재 확장 샤드를 강제 재수집·덮어씀 · 교훈 봇이 스스로 다시 디스패치하는 실행은 운영자 기본값을 물려받지 않는다 · 검사 ci-publish-data-commit-check · 파일 scripts/lib/data-publish-sets.mjs, scripts/ci-publish-data-commit-check.mjs
## P2524 - v60.18 - 운영 알림 연속 실패 집계가 스케줄러가 디스패치한 refresh 실행을 빼고 셈 · 교훈 알림의 연속 실패 판정은 실행 표시 이름이 아니라 워크플로 정체성으로 묶는다 · 검사 ci-workspace-contract-check · 파일 .github/workflows/operations-alert.yml, scripts/ci-workspace-contract-check.mjs
## P2523 - v60.18 - AI 시장 해석이 AI·CNBC·S&P 500을 한글로 풀어 씀(에이아이·씨엔비씨·에스앤피500) · 교훈 생성 텍스트의 표기는 산출물에 들어가는 한 곳에서 화면 표기와 맞춘다 · 검사 ci-ai-spelled-terms-check · 파일 scripts/lib/market-analysis-validate.mjs, scripts/ci-ai-spelled-terms-check.mjs
## P2522 - v60.18 - 텔레그램 다이제스트가 3주 동안 'partial'로 남음 — 미리보기가 사라진 채널을 계속 기대 채널로 셈 · 교훈 실패한 출처는 기한 안에 고치거나 이유와 함께 등록부에서 퇴역시킨다 — 끝나지 않는 partial은 상태가 아니다 · 검사 ci-telegram-channels-check · 파일 scripts/fetch-telegram-digest.mjs, scripts/lib/telegram-channels.mjs, scripts/ci-telegram-channels-check.mjs
## P2521 - v60.18 - 외국 발행사의 분기 검토 재무제표 6-K가 그날의 실적 발표로 분류됨 (TSM 11/13 '3분기 실적') · 교훈 이벤트 날짜는 시장이 처음 그 정보를 본 날이어야 한다(재공시는 새 이벤트가 아니다) · 검사 ci-event-briefs-check · 파일 scripts/lib/sec-results-filings.mjs, scripts/ci-event-briefs-check.mjs
## P2520 - v60.18 - 실적 브리프 '원문 요약 정리 중'이 기한 없이 남음 (NU 2.5일+, CAMT·NVMI·OKLO 9~10일) · 교훈 약속 문구(정리 중·확인 중)는 끝나는 조건과 기한을 가져야 한다 · 검사 ci-event-briefs-check · 파일 scripts/fetch-event-briefs.mjs, src/domain/briefing/event-briefs.js, src/ui/components/event-briefs.js, scripts/ci-event-briefs-check.mjs
## P2519 - v60.18 - 11/09 반등일 08:00 묶음에 그날 시장을 설명하는 기사가 하나도 없음 (장중 칸의 기사가 다음 묶음으로 넘어가지 않고, 바닥 좌석이 주제 상한을 먼저 씀) · 교훈 예약 좌석은 들어갈 자격을 보장할 뿐, 더 높은 순위 기사보다 상한을 먼저 쓰지 않는다. 창 안에 든 기사는 그 창의 묶음 후보다 · 검사 ci-news-ranking-check · 파일 scripts/lib/news-selection.mjs, scripts/producer/source-planes.mjs, scripts/ci-news-ranking-check.mjs
## P2518 - v60.18 - 'Dollar rate in Pakistan today' 같은 환율 고시 페이지가 시장 뉴스 상위 5에 들어감 · 교훈 맥락 어휘는 기사가 다루는 주제가 아니다 · 검사 ci-news-ranking-check · 파일 scripts/lib/news-selection.mjs, scripts/ci-news-ranking-check.mjs
## P2517 - v60.18 - 뉴스 묶음 순위가 키워드 개수로 정해져, CPI 날 시장 기사가 한 종목 애널리스트 메모보다 낮았고 게시 순서가 좌석 순서였음 · 교훈 관련성은 기사가 무엇에 관한 것인지로 정한다. 키워드를 몇 개 맞혔는지로 정하지 않는다. 좌석 예약은 묶음에 들어갈지를 정할 뿐, 게시 순서를 정하지 않는다 · 검사 ci-news-ranking-check · 파일 scripts/lib/news-selection.mjs, scripts/producer/source-planes.mjs, scripts/producer/run-meta.mjs, scripts/ci-news-ranking-check.mjs, architecture/qa-pipeline.json
## P2516 - v60.18 - 홈 지수 줄에서 일부 장중 요청만 성공하면 SPY ETF 카드와 지수 종가 카드가 한 줄에 섞임 · 교훈 한 줄의 카드는 하나의 기준(같은 세션의 ETF 또는 발행 종가)을 쓴다 · 검사 ci-desktop-continuity-check · 파일 src/ui/components/home-index-strip.js, scripts/ci-desktop-continuity-check.mjs
## P2515 - v60.18 - 매크로 물가 카드 CPI 3.7%·근원 2.6%(9월분)에 '이번 수집 실패, 직전 발표값' — 실패가 아니라 1년 전 기준 지수 공백 · 교훈 직전 발표값을 보여 주는 이유는 자료를 조립하는 곳에서 한 번 정하고 모든 블록이 그 이유를 그린다 · 검사 ci-codex-structure-regression-fixture · 파일 src/domain/macro/indicators.js, src/domain/briefing/macro-releases.js, src/ui/components/macro-board.js, src/domain/macro/macro-read.js, scripts/ci-codex-structure-regression-fixture.mjs
## P2514 - v60.18 - 주말 배포본 홈 '달러 지수 103.41 0.00%' — 같은 세션의 실시간 시세가 발행 종가의 등락(+0.23%)을 덮음 · 교훈 실시간 시세는 발행 종가보다 새 관측일 때만 그 등락을 바꾼다 · 검사 ci-market-snapshot-contract-check · 파일 src/data/quality/validation-stores.js, src/legacy/market-snapshot-bridge.js, js/aio-data.js, scripts/ci-market-snapshot-contract-check.mjs
## P2513 - v60.18 - 매크로 '금리, 할인율' 칸이 5거래일 +29bp로 부담인데 머리줄·연결 고리·기준은 20거래일 +5bp만 말함 — 판정을 정한 다리를 다시 추정 · 교훈 한 판정의 머리줄·기준·연결 문장은 판정을 정한 다리와 그 값에서 그린다 · 검사 ci-regime-scenarios-fixture, ci-codex-structure-regression-fixture · 파일 src/domain/briefing/market-read.js, src/domain/macro/macro-read.js, scripts/ci-regime-scenarios-fixture.mjs, scripts/ci-codex-structure-regression-fixture.mjs
## P2512 - v60.18 - 이름이 티커와 대소문자만 다른 종목(LYFT·Lyft)의 종목 칩에 이름이 빠짐 · 교훈 표시 생략 조건은 실제 중복일 때만 적용한다 · 검사 ci-esm-core-unit-check · 파일 src/ui/components/ticker-start.js, scripts/ci-esm-core-unit-check.mjs
## P2511 - v60.18 - 스크리너 모집단과 시장 폭 렌즈의 '미국 N종목'이 918과 914로 달랐음 · 교훈 같은 집합의 크기는 한 정의, 한 함수로 센다 · 검사 ci-screener-market-fixture · 파일 src/domain/screener/market-scope.js, src/domain/screener/factor-ranks.js, src/domain/narrative/lens-registry.js, src/ui/pages/screener/table.js, scripts/ci-screener-market-fixture.mjs
## P2510 - v60.18 - 장기 결과 산출물의 정의 지문을 생산자만 확인하고 화면은 옛 정의로 계산된 빈도를 그대로 읽음 · 교훈 정의 지문이 있는 산출물은 읽는 쪽도 지문을 확인한다 · 검사 ci-scenario-guidance-fixture · 파일 src/domain/scenarios/outcome-fingerprints.js, src/domain/market/regime/macro-crossroads.js, src/ai/tools/market-tools.js, src/ui/components/correction-base-rate.js, src/domain/market/regime/market-lean.js, scripts/ci-scenario-guidance-fixture.mjs
## P2509 - v60.18 - 하이일드 스프레드를 신용 축과 신용 판정이 서로 다른 관측에서 읽어 같은 날 다른 수준·방향을 냄 · 교훈 한 지표의 수준·변화·날짜는 한 관측에서 한 함수로 읽는다 · 검사 ci-metric-consistency-check · 파일 src/domain/briefing/market-read.js, src/domain/briefing/credit-reading.js, src/ui/components/market-regime.js, src/ai/context/close-basis-evidence.js, src/domain/macro/macro-read.js, src/domain/macro/macro-chain.js
## P2508 - v60.18 - REGIME_CONTEXT의 새 방향 문장(날짜 기준점)을 그대로 옮기면 metric-value-mismatch로 막힘 · 교훈 프롬프트가 주는 문장 형태는 그대로 옮겨도 검증을 통과한다 · 검사 ci-market-reading-week-fixture · 파일 scripts/lib/market-analysis-validate.mjs, scripts/ci-market-reading-week-fixture.mjs
## P2507 - v60.18 - AI 해석의 거절된 답이 어디에도 남지 않아 가장 잦은 차단(변동성 축)의 원인을 확인할 수 없었음 · 교훈 차단 사유를 셀 수 있는 규칙은 차단된 원문도 남긴다 · 검사 ci-market-reading-week-fixture · 파일 scripts/lib/market-analysis-rejections.mjs, scripts/producer/market-narrative.mjs, .github/workflows/refresh-data.yml, scripts/ci-market-reading-week-fixture.mjs
## P2506 - v60.18 - 근거 id를 지운 게시 문장에 빈 괄호·남은 대괄호·조사+입니다 붙음이 남은 채 검증본으로 게시됨 · 교훈 검증은 게시되는 문장 그대로를 본다 · 검사 ci-market-reading-week-fixture · 파일 scripts/lib/market-analysis-validate.mjs, scripts/lib/market-analysis-prompt.mjs, scripts/ci-market-reading-week-fixture.mjs
## P2505 - v60.18 - AI 해석의 큰 움직임 목록이 고정 종목·고정 문턱이라 10년물·금·달러와 장중 미국 지수가 빠지고 매일 같은 첫 문장이 나옴 · 교훈 해석이 여는 움직임은 그날 가장 큰 움직임이다. 어떤 지표가 큰지는 그 지표 자신의 변동성으로 잰다 · 검사 ci-market-reading-week-fixture, ci-data-pipeline-contract-check · 파일 scripts/ci-data-pipeline-contract-check.mjs, scripts/ci-market-reading-week-fixture.mjs, scripts/fixtures/market-analysis-week-20261115.json, scripts/lib/market-analysis-moves.mjs, scripts/lib/market-analysis-prompt.mjs, scripts/lib/market-analysis-validate.mjs
## P2504 - v60.18 - 프롬프트 칸 이름 '압력'이 본문에 새어 상승 수치에 하락 낱말이 붙음 · 교훈 프롬프트 구조 낱말은 게시 문장에 들어가지 않는다. 숫자에 붙은 방향어는 그 숫자의 부호와 같다 · 검사 ci-market-reading-week-fixture, ci-data-pipeline-contract-check · 파일 scripts/lib/market-analysis-validate.mjs, scripts/producer/market-narrative.mjs, scripts/lib/market-analysis-prompt.mjs, scripts/ci-data-pipeline-contract-check.mjs, scripts/ci-market-reading-week-fixture.mjs
## P2503 - v60.18 - 제공처 429 장애 동안 직전 검증 해석을 붙잡지 못하고 '자동 검증 실패' 문구로 지표만 보여 줌 · 교훈 제공처가 실패한 갱신은 이번 실행의 검증기가 여전히 통과시키는 12시간 이내 검증본을 내리지 않는다. 대체 문구는 실제 원인을 말한다 · 검사 ci-narrative-lifecycle-model-check, ci-market-reading-week-fixture · 파일 scripts/lib/market-analysis-validate.mjs, scripts/producer/market-narrative.mjs, scripts/ci-narrative-lifecycle-model-check.mjs, scripts/ci-market-reading-week-fixture.mjs, scripts/fixtures/market-analysis-week-20261115.json, architecture/qa-pipeline.json
## P2502 - v60.17 - AI 시황 문장이 한 줄에서 기간 등락률을 소수 둘째 자리와 첫째 자리로 섞어 표시함 · 교훈 한 줄 안의 기간 등락률은 같은 자릿수로 표시한다 · 검사 ci-runtime-contract-check · 파일 src/domain/content/percent-precision.js, src/data/server-market-analysis.js, scripts/ci-runtime-contract-check.mjs
## P2501 - v60.16 - 기준 등록표가 삭제된 함수를 구현으로 적고 있었다 · 교훈 같은 정의는 한 곳에서 계산한다 · 검사 ci-runtime-contract-check · 파일 js/aio-core.js, js/aio-tests.js, scripts/ci-runtime-contract-check.mjs
## P2500 - v60.16 - 주말에 이야기 언급이 '줄어듦'으로 읽혔다 · 교훈 같은 정의는 한 곳에서 계산한다 · 검사 ci-esm-core-unit-check · 파일 src/domain/narrative/narratives.js, src/domain/narrative/narrative-cards.js, scripts/ci-esm-core-unit-check.mjs
## P2499 - v60.16 - 기사 별칭 표와 AI 종목 뉴스 필터가 공통 종목명 규칙을 쓰지 않았다 · 교훈 같은 정의는 한 곳에서 계산한다 · 검사 ci-esm-core-unit-check · 파일 src/domain/news/article-tickers.js, src/domain/news/stories.js, src/domain/briefing/news-picks.js, src/app/chat-globals.js, js/aio-chat.js, js/aio-data.js
## P2498 - v60.16 - 시장 이야기의 CCC 약한 고리 판정이 고정 25bp 리터럴을 씀 · 교훈 문구는 판정 규칙의 기준선과 같은 비교를 말한다 · 검사 ci-esm-core-unit-check · 파일 src/domain/market/story/market-story.js, src/domain/briefing/credit-reading.js, src/domain/macro/macro-chapters.js, scripts/ci-esm-core-unit-check.mjs
## P2497 - v60.16 - 시장 이야기 금리 줄이 실질금리와 기대인플레가 상쇄된 주를 '큰 변화가 없습니다'로 읽음 · 교훈 문구는 판정 규칙의 기준선과 같은 비교를 말한다 · 검사 ci-esm-core-unit-check · 파일 src/domain/market/story/market-story.js, src/domain/macro/macro-chapters.js, scripts/ci-esm-core-unit-check.mjs
## P2496 - v60.16 - 통화정책·물가 축의 수준 판정 문장이 규칙의 기준선과 다른 말을 함 · 교훈 문구는 판정 규칙의 기준선과 같은 비교를 말한다 · 검사 ci-esm-core-unit-check · 파일 src/domain/macro/macro-read.js, scripts/ci-esm-core-unit-check.mjs
## P2495 - v60.16 - 헤드라인 논조가 비대칭이고 방향 단어를 못 읽었다 · 교훈 근거로 넘기는 값은 시점과 출처가 맞아야 한다 · 파일 [src/domain/news/scoring.js, src/domain/news/direction-words.js, scripts/ci-esm-core-unit-check.mjs, scripts/fixtures/expect/news-selection.expect.md
## P2494 - v60.16 - 차트 돌파가 스크리너와 달리 최근 교차를 요구하지 않음 · 교훈 문구와 판정은 한 규칙 상수와 실제 표본을 읽는다 · 파일 src/domain/rules/thresholds.js, src/domain/technical/definitions.js, scripts/ci-chart-scenarios-fixture.mjs
## P2493 - v60.16 - 가치 팩터 표시 필드가 정규화 단계에서 버려지고, 판정 다리와 다른 창의 문구·게이지가 표시됨 · 교훈 새 필드는 생산·정규화·소비 세 곳에 함께 넣고, 문구는 판정이 걸린 다리와 창을 말한다 · 검사 ci-domain-parity-check, ci-data-audit-contract-check, ci-chart-scenarios-fixture · 파일 src/data/normalize/screener.js, src/data/providers/screener.js, scripts/producer/screener.mjs, src/domain/briefing/credit-reading.js, src/domain/macro/macro-read.js, src/ui/components/fiscal-read.js
## P2492 - v60.16 - 시장 기울기 카드가 5단계 척도를 암시하지만 개수만 투표함 · 교훈 판정은 지금 충족된 조건만 말한다 · 파일 src/domain/market/regime/market-lean.js, src/ui/components/session-lean.js, scripts/ci-esm-core-unit-check.mjs, scripts/fixtures/expect/market-lean.expect.md
## P2491 - v60.16 - 한 주 금리 하락을 "금리가 주가를 받친다"로 읽음 · 교훈 판정은 지금 충족된 조건만 말한다 · 파일 src/domain/briefing/market-read.js, scripts/ci-regime-scenarios-fixture.mjs
## P2490 - v60.16 - 조정 중 반등을 "조정 전"으로 표시 · 교훈 판정은 지금 충족된 조건만 말한다 · 파일 src/domain/scenarios/correction-base-rates.js, src/ui/components/correction-base-rate.js, scripts/ci-esm-core-unit-check.mjs
## P2489 - v60.16 - 실업률만 올라도 고용 발표를 급랭으로 읽음 · 교훈 판정은 지금 충족된 조건만 말한다 · 파일 src/domain/macro/release-zones.js, src/domain/market/regime/macro-crossroads.js, scripts/ci-esm-core-unit-check.mjs
## P2488 - v60.16 - 같은 지표 개수가 다른 종합 라벨로 읽힘 · 교훈 판정은 지금 충족된 조건만 말한다 · 파일 src/domain/briefing/market-read.js, scripts/ci-regime-scenarios-fixture.mjs
## P2487 - v60.16 - 변동성 부담 판정이 하루 단위로 켜졌다 꺼짐 · 교훈 판정은 지금 충족된 조건만 말한다 · 파일 src/domain/briefing/market-read.js, src/domain/rules/thresholds.js, src/ui/pages/guide.js, scripts/ci-regime-scenarios-fixture.mjs
## P2486 - v60.16 - 금리 축이 한 주 급등을 읽지 못함 · 교훈 판정은 지금 충족된 조건만 말한다 · 파일 src/domain/briefing/market-read.js, src/domain/rules/thresholds.js, src/ui/pages/guide.js, scripts/ci-regime-scenarios-fixture.mjs
## P2485 - v60.16 - 검증 게이트 산출물이 증거 모델과 현행 모델의 차이를 기록하지 않음 · 교훈 밸류에이션 분자·분모는 같은 기준과 기간을 쓴다 · 파일 scripts/build-validation-gates.mjs, scripts/lib/factors.mjs
## P2484 - v60.16 - 전략 렌즈의 거래량 감소 판정이 빈 거래량을 0으로 세고 기준 평균에 최근 5일을 포함 · 교훈 밸류에이션 분자·분모는 같은 기준과 기간을 쓴다 · 파일 src/domain/technical/chart-strategies.js
## P2483 - v60.16 - 금융사 정의가 두 벌 — 리츠가 재무 읽기에서는 FCF를 받고 스크리너에서는 빠짐 · 교훈 밸류에이션 분자·분모는 같은 기준과 기간을 쓴다 · 파일 src/domain/fundamental/financial-kind.js, src/domain/fundamental/cash-metrics.js, src/domain/fundamental/fiscal-read.js, src/domain/fundamental/peer-read.js, src/domain/fundamental/analysis-read.js
## P2482 - v60.16 - 일회성 이익 표시가 계절·경기 분기와 적자 기업에도 붙음 · 교훈 밸류에이션 분자·분모는 같은 기준과 기간을 쓴다 · 파일 src/domain/fundamental/sec-valuation-basis.js
## P2481 - v60.16 - 가치 팩터가 자본잠식·TTM 적자 종목을 한 항만으로 채점 · 교훈 밸류에이션 분자·분모는 같은 기준과 기간을 쓴다 · 파일 src/domain/screener/factor-ranks.js, src/domain/fundamental/sec-row-fields.js, src/data/providers/screener.js
## P2480 - v60.16 - 보통주 귀속 TTM이 더 오래돼도 순이익 TTM보다 우선 · 교훈 밸류에이션 분자·분모는 같은 기준과 기간을 쓴다 · 파일 src/domain/fundamental/sec-earnings.js
## P2479 - v60.16 - 12·16주 회계 분기 기업은 TTM이 만들어지지 않음 · 교훈 밸류에이션 분자·분모는 같은 기준과 기간을 쓴다 · 파일 src/domain/fundamental/period.js, src/domain/fundamental/sec-earnings.js, src/domain/fundamental/sec-normalize.js, src/domain/fundamental/fiscal-read.js, scripts/ci-codex-structure-regression-fixture.mjs
## P2478 - v60.16 - 분기 PIT 행 16개 상한이 TTM 연결을 끊어 PER이 10개월 전 회계연도로 조용히 후퇴 · 교훈 밸류에이션 분자·분모는 같은 기준과 기간을 쓴다 · 검사 ci-data-audit-contract-check · 파일 src/domain/fundamental/sec-normalize.js, src/domain/fundamental/sec-valuation-basis.js, src/domain/fundamental/sec-row-fields.js, src/domain/fundamental/fiscal-read.js, src/data/providers/screener.js, scripts/ci-data-audit-contract-check.mjs
## P2477 - v60.16 - 채널 신호·뉴스 없음 점수·%p 단위 · 교훈 근거로 넘기는 값은 시점과 출처가 맞아야 한다 · 파일 [src/ai/context/channel-signals.js, src/domain/news/scoring.js, src/ai/response/publication.js, scripts/ci-data-pipeline-contract-check.mjs, scripts/ci-domain-parity-check.mjs, scripts/ci-ai-intelligence-contract-check.mjs
## P2476 - v60.16 - 홈 뉴스 가산이 서버에 없는 토픽 키를 쓰고 출처 등급을 두 번 더했다 · 교훈 근거로 넘기는 값은 시점과 출처가 맞아야 한다 · 파일 [src/domain/news/selection.js, scripts/fixtures/expect/news-selection.cases.mjs, scripts/fixtures/expect/news-selection.expect.md
## P2475 - v60.16 - 갱신 실패한 CPI가 AI 문맥에서 말없이 빠졌다 · 교훈 근거로 넘기는 값은 시점과 출처가 맞아야 한다 · 파일 [src/ai/context/macro-release-evidence.js, src/ai/context/chat-macro-lines.js, scripts/ci-esm-core-unit-check.mjs
## P2474 - v60.16 - 건설·시설 제목이 루머로, 일반 보도가 미확인으로 표시됐다 · 교훈 근거로 넘기는 값은 시점과 출처가 맞아야 한다 · 파일 [src/domain/news/report-verification.js, scripts/ci-codex-structure-regression-fixture.mjs
## P2473 - v60.16 - 섹터 표 'Macro Beta'가 측정값처럼 AI에 전달됐다 · 교훈 근거로 넘기는 값은 시점과 출처가 맞아야 한다 · 파일 [js/aio-core.js, js/aio-chat.js, js/aio-tests.js, js/aio-qa-audits.js
## P2472 - v60.16 - 종목 헤드라인 매처가 대소문자·한글 이름을 못 읽었다 · 교훈 근거로 넘기는 값은 시점과 출처가 맞아야 한다 · 파일 [src/domain/briefing/news-picks.js, src/ui/components/market-timeline.js, src/ui/pages/themes/detail.js, scripts/ci-esm-core-unit-check.mjs
## P2471 - v60.16 - 움직인 종목 옆 헤드라인이 다음 날 아침 기사를 골랐다 · 교훈 근거로 넘기는 값은 시점과 출처가 맞아야 한다 · 검사 ci-esm-core-unit-check · 파일 [src/domain/briefing/news-picks.js, src/domain/briefing/day-account.js, src/domain/news/direction-words.js, src/ui/components/market-timeline.js, src/ui/pages/themes/detail.js, scripts/ci-esm-core-unit-check.mjs
## P2470 - v60.16 - 평균 상관·회전율·백테스트 문구 불일치 · 교훈 비교하는 두 수치는 같은 통화·기간·기준을 쓴다 · 검사 ci-runtime-contract-check · 파일 src/domain/portfolio/exposure-panel.js, src/ui/components/portfolio-exposure.js, src/domain/portfolio/backtest.js, src/ui/panels/portfolio-trade-journal.js, scripts/ci-runtime-contract-check.mjs
## P2469 - v60.16 - 1년 미만 MWR 연율 표시 · 교훈 비교하는 두 수치는 같은 통화·기간·기준을 쓴다 · 검사 ci-review-integrity-unit-check · 파일 src/domain/portfolio/risk.js, js/aio-workspace.js, scripts/ci-review-integrity-unit-check.mjs
## P2468 - v60.16 - 백테스트 시작 비중·첫 해 계산 · 교훈 비교하는 두 수치는 같은 통화·기간·기준을 쓴다 · 검사 ci-esm-core-unit-check · 파일 src/domain/portfolio/backtest.js, scripts/ci-esm-core-unit-check.mjs
## P2467 - v60.16 - 체크리스트 분산 항목이 채권 유무로 판정 · 교훈 비교하는 두 수치는 같은 통화·기간·기준을 쓴다 · 검사 ci-esm-core-unit-check · 파일 src/ui/components/portfolio-checklist.js, src/ui/components/portfolio-read.js, src/domain/portfolio/concentration-bands.js
## P2466 - v60.16 - 기술 위험 점수가 12종목에서 잘리고 비중을 무시 · 교훈 비교하는 두 수치는 같은 통화·기간·기준을 쓴다 · 검사 ci-domain-parity-check · 파일 src/domain/portfolio/technical-risk.js, js/aio-workspace.js, scripts/ci-domain-parity-check.mjs
## P2465 - v60.16 - 한·미 혼합 계좌 위험 지표가 일간 종가 쌍으로 계산됨 · 교훈 비교하는 두 수치는 같은 통화·기간·기준을 쓴다 · 검사 ci-esm-core-unit-check, ci-runtime-contract-check · 파일 src/domain/portfolio/risk-readout.js, src/domain/portfolio/return-stats.js, src/ui/components/portfolio-risk-metrics.js, js/aio-workspace.js, scripts/ci-runtime-contract-check.mjs
## P2464 - v60.16 - 실시간 시세가 없으면 위험 추정 전체가 보류 · 교훈 비교하는 두 수치는 같은 통화·기간·기준을 쓴다 · 검사 ci-esm-core-unit-check · 파일 src/ui/panels/portfolio-risk-input.js, js/aio-workspace.js, src/ui/components/portfolio-risk-metrics.js, scripts/ci-esm-core-unit-check.mjs
## P2463 - v60.16 - 벤치마크 비교가 통화를 맞추지 않음 · 교훈 비교하는 두 수치는 같은 통화·기간·기준을 쓴다 · 검사 ci-portfolio-native-chart-check · 파일 src/domain/portfolio/benchmark-trend.js, src/ui/components/portfolio-value-trend.js, scripts/ci-portfolio-native-chart-check.mjs
## P2462 - v60.16 - 13F 옵션 신규 행이 주식 매수처럼 '신규 편입'으로 표시 · 교훈 같은 정의는 한 곳에서 계산한다 · 검사 ci-masters-contract-check · 파일 src/ui/pages/masters-views.js, scripts/ci-masters-contract-check.mjs
## P2461 - v60.16 - 포켓 피벗 조건이 미국 종목의 절반을 통과시킴 · 교훈 같은 정의는 한 곳에서 계산한다 · 검사 ci-esm-core-unit-check · 파일 src/domain/technical/follow-through.js, src/domain/screener/custom-conditions.js, scripts/ci-esm-core-unit-check.mjs
## P2460 - v60.16 - '돌파·거래 증가' 프리셋이 항상 0종목 · 교훈 같은 정의는 한 곳에서 계산한다 · 검사 ci-screener-workbench-contract · 파일 src/domain/screener/price-factors.js, src/domain/screener/screen-engine.js, src/data/contracts/screener.js, src/domain/screener/preset-lessons.js, scripts/ci-screener-workbench-contract.mjs
## P2459 - v60.16 - 베이스 번호가 받아온 기간 길이에 따라 달라짐 · 교훈 같은 정의는 한 곳에서 계산한다 · 검사 ci-esm-core-unit-check · 파일 src/domain/technical/follow-through.js, src/domain/screener/custom-conditions.js, src/domain/screener/row-presentation.js, src/data/providers/screener.js, src/data/normalize/screener.js
## P2458 - v60.16 - 52주 신고가·이동평균 거리가 배당 조정 종가로 계산됨 · 교훈 같은 정의는 한 곳에서 계산한다 · 검사 ci-esm-core-unit-check · 파일 src/domain/screener/price-factors.js, src/domain/screener/custom-conditions.js, scripts/ci-esm-core-unit-check.mjs
## P2457 - v60.16 - 13F CUSIP 변경이 '전량 제외'와 '신규 편입'으로 나뉨 · 교훈 같은 정의는 한 곳에서 계산한다 · 검사 ci-masters-contract-check · 파일 src/domain/masters/corporate-actions.js, scripts/build-masters-runtime-artifacts.mjs, src/ui/pages/masters-views.js, scripts/ci-masters-contract-check.mjs
## P2456 - v60.16 - 13F 주식 분할이 '증가'로 표시됨 · 교훈 같은 정의는 한 곳에서 계산한다 · 검사 ci-masters-contract-check · 파일 src/domain/masters/corporate-actions.js, src/domain/masters/holdings-format.js, scripts/build-masters-runtime-artifacts.mjs, scripts/ci-masters-contract-check.mjs
## P2455 - v60.16 - 가격대 반응 횟수에 구간을 뚫고 지나간 봉이 포함 · 교훈 문구와 판정은 한 규칙 상수와 실제 표본을 읽는다 · 파일 src/domain/technical/price-levels.js, scripts/ci-esm-core-unit-check.mjs
## P2454 - v60.16 - 유사 사례 중앙값이 짝수 표본에서 아래쪽 값 · 교훈 문구와 판정은 한 규칙 상수와 실제 표본을 읽는다 · 파일 src/domain/scenarios/analogs.js, src/domain/market/sentiment/market-temperature.js
## P2453 - v60.16 - 차트 분석 거래량 배수의 분모에 당일 포함 · 교훈 문구와 판정은 한 규칙 상수와 실제 표본을 읽는다 · 파일 src/domain/technical/chart-analysis.js, scripts/ci-chart-scenarios-fixture.mjs
## P2452 - v60.16 - 테마 단계 성과가 상대 판정인데 절대 수익률로 채점 · 교훈 문구와 판정은 한 규칙 상수와 실제 표본을 읽는다 · 파일 src/domain/scenarios/analogs.js, src/domain/scenarios/theme-playbook.js, scripts/ci-scenario-guidance-fixture.mjs
## P2451 - v60.16 - 실적 종목이 지수를 '이끌었습니다'라는 근거 없는 귀속 · 교훈 문구와 판정은 한 규칙 상수와 실제 표본을 읽는다 · 파일 src/domain/market/story/market-story.js, scripts/ci-esm-core-unit-check.mjs
## P2450 - v60.16 - 브리핑 이야기가 마감 뒤 올라온 무관한 보도를 움직임의 근거로 붙임 · 교훈 문구와 판정은 한 규칙 상수와 실제 표본을 읽는다 · 파일 src/domain/briefing/day-account.js, scripts/ci-esm-core-unit-check.mjs
## P2449 - v60.16 - 뉴스 출처 가점이 네 번 겹침 · 교훈 문구와 판정은 한 규칙 상수와 실제 표본을 읽는다 · 파일 src/domain/news/selection.js, scripts/fixtures/expect/news-selection.expect.md
## P2448 - v60.16 - 실질금리·기대인플레 분해가 10년물 시세와 다른 구간인데 같은 5일로 표기 · 교훈 문구와 판정은 한 규칙 상수와 실제 표본을 읽는다 · 파일 src/domain/briefing/market-read.js, scripts/ci-esm-core-unit-check.mjs
## P2447 - v60.16 - 시장 이야기 신용 문장이 판정과 다른 창의 숫자를 인용 · 교훈 문구와 판정은 한 규칙 상수와 실제 표본을 읽는다 · 파일 src/domain/market/story/market-story.js, scripts/ci-esm-core-unit-check.mjs
## P2446 - v60.16 - 폭 '좁다/넓다' 기준이 화면마다 다름 · 교훈 문구와 판정은 한 규칙 상수와 실제 표본을 읽는다 · 파일 src/domain/technical/market-charts.js, src/domain/market/regime/cross-readings.js, scripts/ci-esm-core-unit-check.mjs
## P2445 - v60.16 - 한국 참여도에서 코스닥 종목을 섞은 중앙값을 KOSPI와 비교 · 교훈 문구와 판정은 한 규칙 상수와 실제 표본을 읽는다 · 파일 src/domain/market/korea/korea-participation.js, scripts/ci-korea-participation-fixture.mjs
## P2444 - v60.16 - fiscalsteep 갈림길의 가격 반영이 조건과 같은 수 · 교훈 문구와 판정은 한 규칙 상수와 실제 표본을 읽는다 · 파일 src/domain/market/regime/macro-crossroads.js, scripts/ci-scenario-guidance-fixture.mjs
## P2443 - v60.16 - 시장 기울기에서 지수 온도가 두 표로 계산됨 · 교훈 문구와 판정은 한 규칙 상수와 실제 표본을 읽는다 · 파일 src/domain/market/regime/market-lean.js, scripts/ci-esm-core-unit-check.mjs
## P2442 - v60.16 - 심리 합성 요소가 '1년 백분위'라고 쓰지만 실제 표본은 166~241거래일 · 교훈 문구와 판정은 한 규칙 상수와 실제 표본을 읽는다 · 파일 src/domain/market/sentiment/composite-fear-greed.js, src/domain/briefing/market-read.js, scripts/ci-esm-core-unit-check.mjs
## P2441 - v60.16 - 주식 수가 10-K 표지 기준으로 오래됨 · 교훈 밸류에이션 분자·분모는 같은 기준과 기간을 쓴다 · 검사 ci-data-audit, ci-data-pipeline · 파일 src/domain/fundamental/sec-normalize.js, scripts/ci-data-audit-contract-check.mjs, scripts/ci-data-pipeline-contract-check.mjs
## P2440 - v60.16 - 재고·매출채권 증가 판정이 계절성을 무시 · 교훈 밸류에이션 분자·분모는 같은 기준과 기간을 쓴다 · 검사 ci-data-audit · 파일 src/domain/fundamental/quarter-read.js, scripts/ci-data-audit-contract-check.mjs
## P2439 - v60.16 - P/B 분모가 회계연도 말 자본이고 우선주 포함 · 교훈 밸류에이션 분자·분모는 같은 기준과 기간을 쓴다 · 검사 ci-data-audit · 파일 src/domain/fundamental/sec-valuation-basis.js, src/domain/fundamental/sec-normalize.js, src/domain/fundamental/sec-row-fields.js, scripts/producer/screener.mjs, scripts/ci-data-audit-contract-check.mjs
## P2438 - v60.16 - 매출 개념이 기간마다 달라 성장률이 왜곡됨 · 교훈 밸류에이션 분자·분모는 같은 기준과 기간을 쓴다 · 검사 ci-data-audit · 파일 src/domain/fundamental/sec-report.js, scripts/ci-data-audit-contract-check.mjs
## P2437 - v60.16 - 보험사를 대출 금융사로 읽음 · 교훈 밸류에이션 분자·분모는 같은 기준과 기간을 쓴다 · 검사 ci-data-audit · 파일 src/domain/fundamental/fiscal-read.js, src/domain/fundamental/analysis-read.js, src/domain/fundamental/peer-read.js, src/domain/entity/company-analysis.js, scripts/ci-data-audit-contract-check.mjs
## P2436 - v60.16 - 총부채가 비유동 장기부채만 읽음 · 교훈 밸류에이션 분자·분모는 같은 기준과 기간을 쓴다 · 검사 ci-data-audit, ci-data-pipeline · 파일 src/domain/fundamental/sec-earnings.js, src/domain/fundamental/sec-normalize.js, scripts/ci-data-audit-contract-check.mjs, scripts/ci-data-pipeline-contract-check.mjs
## P2435 - v60.16 - TTM 순이익의 일회성 이익이 P/E를 낮춰 보이게 함 · 교훈 밸류에이션 분자·분모는 같은 기준과 기간을 쓴다 · 검사 ci-data-audit-contract-check · 파일 src/domain/fundamental/sec-valuation-basis.js, src/domain/fundamental/sec-normalize.js, src/domain/fundamental/sec-row-fields.js, src/domain/fundamental/sec-report.js, src/domain/fundamental/fiscal-read.js, scripts/fetch-sec-fundamentals.mjs
## P2434 - v60.16 - 점수 백테스트 기록에 비거래일 행이 남음 — 작성기 세션 규칙과 게이트 · 교훈 검증 산출물은 실제로 계산한 것만 충족으로 적는다 · 검사 ci-research-model-contract-check · 파일 scripts/backtest-trading-score.mjs, scripts/ci-research-model-contract-check.mjs, scripts/fixtures/pipeline-semantics/screener.mjs
## P2433 - v60.16 - 팩터 백테스트 IC가 미국·한국 행을 한 상관으로 합산 · 교훈 검증 산출물은 실제로 계산한 것만 충족으로 적는다 · 검사 ci-research-validation-check · 파일 scripts/lib/factors.mjs, scripts/producer/screener.mjs, src/ui/components/screener-validation.js, scripts/ci-research-validation-check.mjs
## P2432 - v60.16 - 점수 재구성에 HYG 가격 신용 대리와 결측 중립 기본값이 들어감 (R343) · 원칙 R343 · 교훈 검증 산출물은 실제로 계산한 것만 충족으로 적는다 · 검사 ci-research-model-contract-check · 파일 scripts/backtest-trading-score.mjs, scripts/backtest-trading-score-longrun.mjs, scripts/fixtures/pipeline-semantics/screener.mjs, scripts/fixtures/pipeline-semantics/research-scripts.mjs, scripts/ci-research-model-contract-check.mjs
## P2431 - v60.16 - 겹치는 선행 구간에 행 수 기준 신뢰구간·표본 충분 판정을 씀 (R1247) · 교훈 검증 산출물은 실제로 계산한 것만 충족으로 적는다 · 검사 ci-research-validation-check, ci-research-model-contract-check · 파일 scripts/lib/rank-statistics.mjs, scripts/backtest-trading-score-longrun.mjs, scripts/backtest-trading-score.mjs, scripts/ci-research-validation-check.mjs, scripts/ci-research-model-contract-check.mjs
## P2430 - v60.16 - 검증 게이트의 회전율·거래비용 판정이 백테스트가 쓰지 않는 필드를 읽음 · 교훈 검증 산출물은 실제로 계산한 것만 충족으로 적는다 · 검사 ci-data-audit-contract-check · 파일 scripts/build-validation-gates.mjs, scripts/backtest-factors-longrun.mjs, architecture/validation-gate-criteria.js, scripts/ci-data-audit-contract-check.mjs, scripts/ci-research-model-contract-check.mjs, scripts/ci-screener-workbench-contract.mjs
## P2429 - v60.16 - CCC 꼬리 판정이 CCC 자체 변동폭과 무관한 고정 +50bp · 교훈 문장은 계산한 수치와 같은 방향·크기를 말한다 · 검사 ci-esm-core-unit-check · 파일 src/domain/macro/macro-chapters.js, scripts/ci-esm-core-unit-check.mjs
## P2428 - v60.16 - 금 해석이 방향만 보고 폭을 보지 않음 · 교훈 문장은 계산한 수치와 같은 방향·크기를 말한다 · 검사 ci-esm-core-unit-check · 파일 src/domain/macro/macro-chapters.js, scripts/ci-esm-core-unit-check.mjs
## P2427 - v60.16 - 고용 발표 구간 기준(5만·7.5만·20만)이 규칙 표 밖 리터럴로 중복 · 교훈 문장은 계산한 수치와 같은 방향·크기를 말한다 · 검사 ci-esm-core-unit-check · 파일 src/domain/rules/thresholds.js, src/domain/macro/release-zones.js, scripts/ci-esm-core-unit-check.mjs
## P2426 - v60.16 - 10년 금리가 조용하면 서로 상쇄한 실질금리·기대인플레 움직임이 '큰 변화 없음'으로 가려짐 · 교훈 문장은 계산한 수치와 같은 방향·크기를 말한다 · 검사 ci-esm-core-unit-check · 파일 src/domain/macro/macro-chapters.js, scripts/ci-esm-core-unit-check.mjs
## P2425 - v60.16 - 근원 CPI 전년 대비가 12개월 전 발표가 없는 달에 사라져 물가 방향이 PCE만으로 판정됨 · 교훈 문장은 계산한 수치와 같은 방향·크기를 말한다 · 검사 ci-esm-core-unit-check · 파일 src/domain/macro/macro-read.js, src/domain/macro/macro-signals.js, src/domain/macro/macro-chapters.js, scripts/ci-esm-core-unit-check.mjs
## P2424 - v60.16 - 원화 분해가 반대 부호의 달러 몫과 원화 고유 몫을 '함께 움직였다'고 읽음 · 교훈 문장은 계산한 수치와 같은 방향·크기를 말한다 · 검사 ci-esm-core-unit-check · 파일 src/domain/macro/krw-decomposition.js, scripts/ci-esm-core-unit-check.mjs
## P2423 - v60.15 - 화면 문구가 실제 규칙과 다른 숫자·기준을 말함 · 교훈 화면 숫자는 규칙 상수에서 읽는다 · 파일 src/domain/technical/chart-strategies.js, src/domain/macro/treasury-auctions.js, scripts/lib/factors.mjs
## P2422 - v60.15 - 일회성 이익이 낀 직전 4개 분기 합과 예상 EPS의 비교가 -30% 기준 바로 위(-29.4%)에서 그대로 표시 · 교훈 같은 기준이 아닌 두 값은 비교하지 않는다 · 검사 ci-data-pipeline-contract-check · 파일 src/domain/fundamental/consensus-read.js
## P2421 - v60.15 - 30주선이 4주 1% 미만으로 꾸준히 오르는 완만한 상승이 3단계(천장 형성)로 표시 · 교훈 판정 이름은 정의와 같아야 한다 · 검사 ci-chart-scenarios-fixture · 파일 src/domain/technical/definitions.js, scripts/ci-chart-scenarios-fixture.mjs
## P2420 - v60.15 - 신용 경색 시나리오의 수준 조건이 350bp(양호 경계)였고, 변동성 충격은 조건에 쓴 VIX 비율을 '시장 가격도 같은 방향'으로 다시 셈 · 교훈 한 관측은 한 번만 근거로 센다 · 검사 ci-scenario-guidance-fixture · 파일 src/domain/market/regime/macro-crossroads.js
## P2419 - v60.15 - 하이일드 5거래일 변화가 매크로 카드(-12bp)와 시장 상태(-28bp)에서 다르게 표시 · 교훈 한 사실 한 소유자(데이터 일관성) · 검사 ci-scenario-guidance-fixture · 파일 src/domain/macro/macro-read.js
## P2418 - v60.15 - 주도주 이탈이 유지(held) 상태로만 남아 있어도 추세 축을 덮어쓰고, 금리·주가 교차 문장이 5일 반등을 '견딘다'로 읽음 · 교훈 판정은 지금 충족된 조건만 말한다 · 검사 ci-scenario-guidance-fixture, ci-esm-core-unit-check · 파일 src/domain/briefing/market-read.js
## P2417 - v60.14 - 뒤처진 빠른 시세가 더 새 스냅샷을 이김, 첫 화면 판정에 나이 확인 없음, 기록 재적재가 이전 주기 사본을 읽음 · 교훈 더 새 자료가 있으면 그것을 쓴다 — 묵은 사본은 조용히 이기지 않는다 · 검사 ci-codex-structure-regression-fixture · 파일 src/data/market-snapshot-loader.js, index.html, js/aio-data.js
## P2416 - v60.14 - 주도주 문장이 오른 수치를 이탈 이유로 말함, 한국 비교가 뒤에 열린 미국장을 직전이라 함 · 교훈 문장은 찍힌 수치와 같은 방향을 말한다 (plan 019) · 검사 ci-scenario-guidance-fixture, ci-regime-scenarios-fixture · 파일 src/domain/briefing/market-read.js
## P2415 - v60.14 - 연준 일정 자동 수집이 내년 칸 형식 때문에 올해 일정까지 내려감 · 교훈 한 부분의 미정이 확정된 부분을 화면에서 내리면 안 된다 · 검사 ci-data-pipeline-contract-check, ci-artifact-semantics-check · 파일 scripts/lib/official-calendars.mjs, scripts/ci-data-pipeline-contract-check.mjs, scripts/ci-artifact-semantics-check.mjs
## P2414 - v60.14 - 운영 알림이 매번 물러남, 감시·스크리너가 GitHub 예약에만 의존 · 교훈 자동화는 스스로 회복해야 한다 — 감시가 장애와 함께 조용해지면 안 된다 · 검사 ci-data-plane-contract-check · 파일 .github/workflows/operations-alert.yml, worker/data-plane.js, .github/workflows/refresh-screener.yml, scripts/ci-data-plane-contract-check.mjs
## P2413 - v60.14 - 데이터 커밋이 생산자 게이트를 통과한 뒤 CI에서 거부되어 배포가 멈춤 · 교훈 생산자 게이트와 CI 게이트는 같은 집합이어야 한다 (failure-ledger: 원인 클래스를 게이트로 닫는다) · 검사 ci-qa-pipeline-contract-check · 파일 scripts/qa-runner.mjs, architecture/qa-pipeline.json, .github/workflows/refresh-data.yml, .github/workflows/refresh-screener.yml, scripts/ci-qa-pipeline-contract-check.mjs
## P2412 - v60.13 - 합성 자료의 날짜·정밀도: 한국 테마 기록 하루 밀림, 백테스트 기록 중복·잔존, 1달러 미만 종목 수익률 양자화, 짝수 중앙값 · 교훈 기록의 날짜는 그 값이 속한 거래일이다 · 검사 ci-esm-core-unit-check · 파일 scripts/build-scenario-state.mjs, scripts/producer/screener.mjs, scripts/backtest-trading-score.mjs, src/domain/screener/price-factors.js, src/domain/market/day/facts.js
## P2411 - v60.13 - 감시 워크플로 오탐: 응답하는 연준 피드를 죽은 피드로, 재고정 checkout 충돌, 확장 검증기의 조건부 열, 거래소 달력 연간 점검 · 교훈 게이트는 대상이 실제로 고장 났을 때만 실패한다 (실패 원장 우선) · 검사 ci-codex-structure-regression-fixture · 파일 scripts/lib/news-selection.mjs, .github/workflows/watchdog-browser.yml, .github/workflows/exchange-calendar-review.yml, scripts/lib/screener-extended-validate.mjs, src/domain/screener/price-factors.js, scripts/validate-screener-artifact.mjs
## P2410 - v60.13 - 공유 자료 재적재가 CDN의 이전 주기 사본을 받아 최신으로 취급 · 교훈 한 화면의 자료는 같은 주기에서 온다 · 검사 ci-codex-structure-regression-fixture · 파일 src/data/shared-artifacts.js
## P2409 - v60.13 - 원천 실패가 정상처럼 기록됨: 국채 곡선 전월 자료, 상장 목록 CIK 전부 비움 · 교훈 부분 실패는 마지막 정상 값을 지우거나 성공으로 표기하지 않는다 (P2143 계열) · 파일 scripts/lib/macro-sources.mjs, scripts/build-us-listings.mjs
## P2408 - v60.13 - history: 보류 세션 복구 목록에서 sox·skew·vix3m·vvix·move 빠짐, 묵은 Fear & Greed와 이전 스냅샷의 세션 표기 · 교훈 손으로 관리하는 병렬 목록 금지 — 정본에서 파생 · 검사 ci-codex-structure-regression-fixture · 파일 scripts/producer/history.mjs
## P2407 - v60.13 - 종가 읽기 두 벌: 휴장일이 0% 거래일로, 주말 사본이 금요일 종가를 덮음 · 교훈 같은 수치는 한 계산기에서 읽는다 (AGENTS 단일 출처) · 검사 ci-codex-structure-regression-fixture · 파일 src/domain/market/indices/index-levels.js
## P2406 - v60.13 - 판정 문장·입력이 수치와 어긋남: 하이일드 주간 변화 두 정의, 실질금리 분해 버림, 유가·달러·금리 문장, 이야기 카드 표시 · 교훈 문장은 찍힌 수치와 같은 방향을 말한다 (plan 019) · 검사 ci-codex-structure-regression-fixture · 파일 src/domain/briefing/market-read.js, src/domain/narrative/narrative-cards.js, src/domain/market/regime/macro-crossroads.js, src/domain/macro/krw-decomposition.js
## P2405 - v60.07 - 0으로 반올림되는 값에 부호와 등락 색이 붙음 · 교훈 화면 방향은 찍힌 값을 따른다 (plan 019) — 부호·색의 소유자는 shared/number.js 하나 · 검사 ci-esm-core-unit-check · 파일 src/domain/shared/number.js, src/ui/pages/portfolio.js, src/ui/pages/entity.js, src/ui/components/portfolio-watchlist.js, src/ui/components/sentiment-board.js, src/ui/components/macro-chapters.js
## P2404 - v60.07 - 한국 참여도 문장에 '+0.0%'가 찍힘 · 교훈 화면 방향은 찍힌 값을 따른다 (plan 019) — 부호 표기의 소유자는 signedText 하나 · 파일 src/domain/market/korea/korea-participation.js
## P2403 - v60.06 - 레이어 스택: 팝오버 재등록 누수와 모달 위 창의 inert · 교훈 한 동작의 소유자는 하나 (C 색인: 단일 소유자) — 소유자를 만들 때 그 위에 겹치는 경우를 모두 열거하지 않았다 · 검사 ci-esm-core-unit-check · 파일 src/ui/behaviors/layers.js, src/ui/components/popover.js, src/ui/components/term-marks.js, src/ui/navigation/command-search.js
## P2402 - v60.05 - 입력창에서 취소 버튼에 Enter를 누르면 값이 저장됨 · 교훈 키 처리는 그 컨트롤 범위에서만 (C 색인: 단일 소유자) · 파일 js/aio-workspace.js
## P2401 - v60.05 - Escape 한 번에 겹친 레이어가 함께 닫힘 · 교훈 한 동작의 소유자는 하나 (C 색인: 단일 소유자) · 검사 ci-esm-core-unit-check · 파일 src/ui/behaviors/layers.js, src/ui/navigation/screen-shortcuts.js, src/ui/components/responsive-shell.js, js/aio-workspace.js, js/aio-core.js
## P2400 - v60.04 - a live comparison answer keeps the figures it copied from its material and loses its false 'no current figures' header · 교훈 Owner decision 2026-11-12: a current figure is checked against what the model was given, not deleted for being a figure. · 검사 ci-ai-intelligence-contract-check · 파일 src/ai/response/publication.js, src/ui/components/ai-answer-visuals.js, scripts/ci-ai-intelligence-contract-check.mjs
## P2399 - v60.03 - a refused chat request is retried without tools only when the refusal is about the tools · 교훈 One question is one paid request unless a retry can change the outcome. · 검사 ci-ai-chat-reliability-contract-check, ci-screener-ai-conditions-browser-check · 파일 src/ai/tools/loop.js, js/aio-chat.js, js/aio-tests.js, scripts/ci-ai-chat-reliability-contract-check.mjs
## P2398 - v60.03 - v60.02 a universe review dated a day ahead of the reader's clock no longer empties the screener · 교훈 A review date is not a market observation; clock skew must not remove content (P1542 class). · 검사 ci-screener-extended-browser-check · 파일 src/data/contracts/screener.js, src/data/providers/screener.js, js/aio-data.js, public-data/screener-universe.json
## P2397 - v60.02 - BLS 빈 각주 객체 [{}] 때문에 모든 시계열이 'footnote-present'로 표시됨 · 교훈 원천이 말하지 않은 상태를 만들어 내지 않는다(없는 값은 없음으로). · 검사 ci-data-pipeline-contract-check · 파일 scripts/lib/macro-sources.mjs, scripts/ci-data-pipeline-contract-check.mjs
## P2396 - v60.02 - 종목 이름 등록부의 근거 없는 두 항목(352700.KQ 'HPSP', 413640.KQ 'Hyundai Mobis Test/NEXTIN') 삭제 · 교훈 티커 추정 금지 — 등록부의 이름은 저장소 데이터가 뒷받침해야 한다. · 파일 js/aio-core.js
## P2395 - v60.02 - a chat figure is supported only for the subject it was given for · 교훈 No invented numbers: a real number attached to the wrong subject is an invented claim. · 검사 ci-ai-intelligence-contract-check · 파일 src/ai/response/publication.js, src/ai/response/request-pipeline.js, js/aio-chat.js, scripts/ci-ai-intelligence-contract-check.mjs, scripts/fixtures/answer-subject-blocks.mjs, scripts/fixtures/pipeline-semantics/ai.mjs
## P2394 - v60.01 - a figure from the data the chat model was given stays in the sentence that uses it · 교훈 Owner decision 2026-11-12: a current figure is checked against what the model was given, not deleted because it is a figure. · 검사 ci-ai-intelligence-contract-check · 파일 src/ai/response/publication.js, src/ai/response/request-pipeline.js, js/aio-chat.js, src/app/chat-globals.js, scripts/ci-ai-intelligence-contract-check.mjs
## P2393 - v59.99 - the screener no longer empties 31 days after a universe review · 교훈 P1542: a lapsed review window is shown honestly and never removes the product's content. · 검사 ci-screener-workbench-contract · 파일 src/data/contracts/screener.js, scripts/ci-screener-workbench-contract.mjs, scripts/fixtures/chat-prompt-assembly.mjs
## P2392 - v59.99 - the screener-universe mirror no longer changes with the calendar · 교훈 A generated file compared in a gate must be a pure function of its sources (P1542 class: a lapsed review window is shown, never a deploy stop). · 검사 ci-data-pipeline-contract-check · 파일 scripts/sync-screener-universe.mjs, src/data/providers/screener.js, scripts/lib/factors.mjs, public-data/screener-universe.json, scripts/ci-data-pipeline-contract-check.mjs
## P2391 - v59.99 - the market reading is no longer blocked by a quoted likelihood, an approached rate level, 안정 on a neutral axis or a burden the sentence says is absent · 교훈 A deterministic gate must block wrong claims, not correct sentences (P2164 class). · 검사 ci-scenario-guidance-fixture, ci-codex-structure-regression-fixture · 파일 scripts/lib/market-analysis-validate.mjs, src/domain/briefing/evidence-text.js, scripts/ci-scenario-guidance-fixture.mjs, scripts/ci-codex-structure-regression-fixture.mjs, .github/workflows/ai-effort-experiment.yml
## P2390 - v59.99 - the chat evidence filter deleted a current sentence even when its number was the injected one · 원칙 C16, R687 · 교훈 C16 / R687: a current figure must exist in the evidence the model was given; one that does exist is not an unbound claim. · 검사 ci-ai-intelligence-contract-check · 파일 src/ai/response/publication.js, src/ai/response/request-pipeline.js, scripts/ci-ai-intelligence-contract-check.mjs
## P2389 - v59.99 - an answer that carried no web citations was announced as a searched answer · 교훈 A user-facing line states only what happened (no invented facts about the answer's evidence). · 검사 ci-ai-intelligence-contract-check · 파일 js/aio-chat.js, src/ai/research/native-search.js, src/app/compatibility-globals.js, src/ai/context/reference-budget.js, scripts/ci-ai-intelligence-contract-check.mjs, scripts/fixtures/chat-prompt-assembly.mjs
## P2388 - v59.99 - the chat evidence filter deleted dated history and fixed definitions as unbound current figures · 원칙 C16, R687 · 교훈 C16 / R687: only a number presented as a current observation must be bound to injected evidence; history and definitions are not current figures. · 검사 ci-ai-intelligence-contract-check · 파일 src/ai/response/publication.js, scripts/ci-ai-intelligence-contract-check.mjs
## P2387 - v59.98 - BLS reported its four CPI series as failed every refresh after the October 2026 CPI release · 교훈 One source-gap rule per observation family: the FRED and BLS paths read the same CPI months and must classify a never-published comparator month the… · 검사 ci-data-pipeline-contract-check · 파일 scripts/lib/macro-sources.mjs, scripts/ci-data-pipeline-contract-check.mjs
## P2386 - v59.98 - Three more surfaces take their up/down colour from the printed value · 교훈 Direction follows the printed value (plan 025 rule, directionOf/signedText). · 검사 ci-esm-core-unit-check · 파일 src/ui/pages/screener/model.js, src/ui/pages/themes/sectors.js, src/ui/components/portfolio-backtest-lab.js, scripts/ci-esm-core-unit-check.mjs
## P2385 - v59.98 - '부도덕', '상향식' and '하향식' no longer count as stance keyword hits · 교훈 A keyword hit is the word itself, not a longer word that contains it. · 검사 ci-esm-core-unit-check · 파일 src/domain/news/keyword-match.js, scripts/ci-esm-core-unit-check.mjs
## P2384 - v59.98 - A published FOMC brief with a non-Korean headline is repaired · 교훈 Korean UI: a stored headline meets the same gate as a new one. · 검사 ci-event-briefs-check · 파일 scripts/fetch-event-briefs.mjs, scripts/ci-event-briefs-check.mjs
## P2383 - v59.98 - The AI action gate keeps advice to tidy a watchlist of 종목 · 교훈 The directive gate replaces trade instructions, not ordinary guidance close to their wording. · 검사 ci-ai-intelligence-contract-check · 파일 src/ai/response/request-pipeline.js, scripts/ci-ai-intelligence-contract-check.mjs
## P2382 - v59.98 - The 시장 상태 story and the rates axis quote one 10-year 5-session change when the 10-year lags · 교훈 One metric, one window, one number on every screen. · 검사 ci-esm-core-unit-check · 파일 src/domain/market/story/market-story.js, scripts/ci-esm-core-unit-check.mjs
## P2381 - v59.98 - An all-capital ticker in an AI question no longer also resolves to another issuer · 교훈 No ticker guessing: one rule for reading a typed word as a ticker or a name. · 검사 ci-codex-structure-regression-fixture · 파일 src/domain/instruments/resolve-name.js, src/ai/entity/resolver.js, scripts/ci-codex-structure-regression-fixture.mjs
## P2380 - v59.97 - an issuer with no annual SEC facts yet was never retried after its first 10-K · 교훈 A terminal state must name the event that ends it; 'unsupported' for a not-yet-annual filer is a waiting state, not a permanent one. · 검사 ci-fiscal-quality-fixture · 파일 scripts/fetch-sec-fundamentals.mjs, scripts/ci-fiscal-quality-fixture.mjs
## P2379 - v59.97 - a model FOMC headline in English could be stored and block every later release at preflight · 교훈 A producer owns the rule its blocking gate checks: an artifact the gate would reject is never written. · 검사 ci-event-briefs-check · 파일 src/domain/briefing/event-briefs.js, scripts/fetch-event-briefs.mjs, scripts/ci-event-briefs-check.mjs
## P2378 - v59.97 - a lapsed static review window no longer stops every data release · 교훈 P1542: a data problem is shown honestly on screen and must not stop shipping. · 파일 scripts/ci-static-db-expiry-check.mjs
## P2377 - v59.97 - six-doc coverage gate checks 13F counts for consistency instead of pinning one quarter's numbers · 교훈 A gate on the publish path must not fail a correct product because the calendar moved (owner P1542: a data problem is shown honestly and does not sto… · 파일 scripts/ci-six-doc-coverage-check.mjs
## P2376 - v59.97 - crash-replay reads its fixed 2026 windows from a frozen closes fixture, not the rolling history · 교훈 A gate on the publish path must not fail a correct product because the calendar moved. · 파일 scripts/ci-crash-replay-check.mjs, architecture/fixtures/crash-replay-2026-closes.json
## P2375 - v59.97 - metric-consistency gate failed when the 시장 상태 axis correctly withheld a stale HY or 10-year input, and its 11/6 replay rode on live rows · 교훈 A gate that judges today's data needs the inputs the product passes, a fixture for each state of the fact, and a printed skip when the product itself… · 검사 ci-metric-consistency-check · 파일 scripts/ci-metric-consistency-check.mjs, architecture/fixtures/market-close-2026-11-06.json
## P2374 - v59.97 - refresh integrity gate refused every key-present partial FRED cycle that the producer had labelled as last-known-good · 교훈 P1189 (a partial-failure FRED cycle is meant to publish under an explicit LKG label); P1085 (one provider outage must not look like a total pipeline… · 검사 ci-data-pipeline-contract-check · 파일 scripts/ci-refresh-artifact-integrity-check.mjs, scripts/ci-data-pipeline-contract-check.mjs
## P2373 - v59.97 - the current-number check reads normalised text and spelled units and currency codes · 교훈 A current number that is not bound to evidence is not published (P1519/P1740 numeric-evidence publication policy). · 검사 ci-ai-intelligence-contract-check · 파일 src/ai/response/publication.js, scripts/ci-ai-intelligence-contract-check.mjs
## P2372 - v59.97 - the AI action gate catches nominalised, sized, colloquial, two-sentence and emphasised trade instructions · 교훈 No trade instructions: the app never tells the reader to buy or sell, at what price or size (AGENTS product rule; P1539 action gate). · 검사 ci-ai-intelligence-contract-check · 파일 src/ai/response/request-pipeline.js, scripts/ci-ai-intelligence-contract-check.mjs
## P2371 - v59.97 - a saved conversation turn without an answer no longer breaks saving · 교훈 A bad stored record must not stop the answer flow. · 검사 ci-ai-intelligence-contract-check · 파일 src/ai/session/chat-sessions.js, scripts/ci-ai-intelligence-contract-check.mjs
## P2370 - v59.97 - stopping an AI answer removes the 분석 중 bubble and the streaming caret · 교훈 A cancelled request leaves no pending animation on screen. · 검사 ci-ai-chat-reliability-contract-check, ci-chat-ui-state-browser-check · 파일 js/aio-chat.js, scripts/ci-ai-chat-reliability-contract-check.mjs, scripts/ci-chat-ui-state-browser-check.mjs
## P2369 - v59.97 - a long AI conversation keeps its evidence contract and action policy when the request is trimmed · 교훈 User-protection policy must reach the model on every AI answer; a size budget may drop reference data or old turns, never the policy. · 검사 ci-ai-chat-reliability-contract-check · 파일 js/aio-chat.js, scripts/ci-ai-chat-reliability-contract-check.mjs
## P2368 - v59.97 - A typed all-capital ticker is never rewritten to another issuer through a display name · 교훈 No ticker guessing: a ticker-shaped input is never rewritten to another issuer. · 검사 ci-esm-core-unit-check · 파일 src/domain/instruments/resolve-name.js, scripts/ci-esm-core-unit-check.mjs
## P2367 - v59.97 - The news bear keyword '위기' no longer matches inside '분위기' · 교훈 One keyword rule for every news list must not produce false matches inside unrelated words. · 검사 ci-esm-core-unit-check · 파일 src/domain/news/keyword-match.js, scripts/ci-esm-core-unit-check.mjs
## P2366 - v59.97 - 스크리너 순위의 과거 성과가 0.00%p로 찍히는 차이에 '앞섰습니다'와 양호 톤을 붙였다 · 원칙 R2 · 교훈 색과 단어는 찍힌 부호를 따른다(directionOf, v58.80 R2-27). · 검사 ci-esm-core-unit-check · 파일 src/domain/screener/screener-read.js, scripts/ci-esm-core-unit-check.mjs
## P2365 - v59.97 - 포트폴리오 '지금 구성 vs S&P 500' 추세 차트가 원화 기준 계좌의 미국 종목 수익률에서 환율 변화를 빼고 그렸다 · 교훈 통화를 가정하지 않는다 / 한 수치는 기준을 밝힌다 — 같은 화면의 두 수익률이 서로 다른 통화 기준으로 계산됐다. · 검사 ci-portfolio-native-chart-check · 파일 src/domain/portfolio/benchmark-trend.js, src/ui/components/portfolio-value-trend.js, scripts/ci-portfolio-native-chart-check.mjs
## P2364 - v59.97 - 포트폴리오 지수 대비 문장이 0.0%p로 찍히는 차이에 '뒤처집니다'와 부담 톤을 붙였다 · 원칙 R2 · 교훈 색과 단어는 찍힌 부호를 따른다(directionOf, v58.80 R2-27). · 검사 ci-review-integrity-unit-check · 파일 src/domain/portfolio/portfolio-read.js, scripts/ci-review-integrity-unit-check.mjs
## P2363 - v59.97 - 시장 상태 sentences named a private threshold or proxy beside a shared one (breadth 50%, F&G 25, 0.0% sectors, 분배일 rank, 나스닥 100 hold) · 교훈 A sentence takes its threshold and its source from the module that prints the number. · 파일 src/domain/rules/thresholds.js, src/domain/market/regime/cross-readings.js, src/domain/market/regime/market-flow.js, src/domain/market/story/page-flow.js, src/domain/briefing/market-read.js, scripts/ci-esm-core-unit-check.mjs
## P2362 - v59.97 - the 10-year direction word was chosen from FRED DGS10 while the sentence printed the market ^TNX change · 교훈 A sentence takes its threshold and its source from the module that prints the number. · 파일 src/domain/market/story/market-story.js, src/domain/macro/macro-chapters.js, scripts/ci-esm-core-unit-check.mjs
## P2361 - v59.97 - the HY 20-session latch held 부담 while every reader said 중립 in its hold window · 교훈 One fact, one state: every reader of the credit verdict takes the 20-session stress from the one latch (same class as the v59.96 metric-consistency i… · 파일 src/domain/briefing/market-read.js, src/domain/briefing/credit-reading.js, scripts/ci-esm-core-unit-check.mjs
## P2360 - v59.97 - the screener producer logs an empty ^GSPC / ^IXIC daily-bar read instead of a warning that could never print · 교훈 A failure handler must be reachable by the failure it describes. · 파일 scripts/producer/screener.mjs
## P2359 - v59.97 - the browser-data pin integrity check fetches its pinned commit instead of skipping in shallow CI checkouts · 교훈 A gate that cannot run its check must say so, not pass silently. · 검사 ci-browser-data-fixture-check · 파일 scripts/browser-data-fixture.mjs, scripts/ci-browser-data-fixture-check.mjs
## P2358 - v59.97 - the Actions shared-AI client waits past the Worker's 60 s deadline for a non-search call · 교훈 A client timeout on a budgeted Worker call must outlast the Worker's own deadline so the Worker answers first. · 검사 ci-data-pipeline-contract-check · 파일 scripts/lib/ai-shared-analysis.mjs, scripts/ci-data-pipeline-contract-check.mjs
## P2357 - v59.97 - a failing theme-detail playbook render no longer silently skips the teach render · 교훈 A failure is visible in the log; one surface failing does not take an independent one down silently. · 파일 src/ui/pages/themes.js
## P2356 - v59.97 - the briefing opening no longer says an index fall sat in a few large stocks · 교훈 A reading states only what its inputs show; no cause the data does not carry. · 파일 src/domain/briefing/day-account.js
## P2355 - v59.97 - seven more change sites take their sign, colour and bar from the printed value · 교훈 The sign, colour and direction word of a change follow the printed value (src/domain/shared/number.js, v58.80). · 검사 ci-esm-core-unit-check · 파일 src/ui/components/market-story.js, src/ui/components/korea-participation.js, src/ui/pages/screener/validation-tab.js, src/ui/components/theme-playbook-view.js, src/ui/components/portfolio-backtest-lab.js, src/ui/pages/themes/sectors.js
## P2354 - v59.96 - metric-consistency gate refused every data release once the HY spread calmed · 교훈 REVIEW.md failure 6 (a gate that does not prove what it claims) — a consistency gate that fed one reader less input than the product does. · 파일 scripts/ci-metric-consistency-check.mjs
## P2353 - v59.95 - v59.94 Taiwan monthly revenue erased a company the source rows left out · 교훈 A missing value stays missing and a value that exists is not thrown away. · 검사 ci-tw-monthly-revenue-fixture · 파일 scripts/fetch-tw-monthly-revenue.mjs, scripts/ci-tw-monthly-revenue-fixture.mjs
## P2352 - v59.95 - v59.94 KR index weights read a blank day ratio as a 0% move · 교훈 A missing value stays missing (never 0 or a guess). · 검사 ci-event-briefs-check · 파일 scripts/fetch-kr-index-weights.mjs, scripts/ci-event-briefs-check.mjs
## P2351 - v59.95 - v59.94 새로고침 완료 뒤 일곱 화면이 다시 그려지지 않고, 스크리너 순위 비중 안내가 고정 문장에 덮임 · 교훈 이벤트는 그 이벤트를 보내는 대상에서 듣는다 (sentiment.js가 document와 window를 함께 듣는 방식) · 검사 ci-esm-core-unit-check · 파일 src/ui/pages/market.js, src/ui/pages/charts.js, src/ui/pages/analysis.js, src/ui/pages/screener/page.js, src/ui/pages/entity.js, src/ui/pages/news.js
## P2350 - v59.95 - v59.94 종목 등락·코스피 칩·카드의 화살표와 색이 출력된 값이 아니라 원래 값의 부호를 따름 · 교훈 부호·화살표·색은 출력된 값을 따른다 (src/domain/shared/number.js directionOf, v58.80) · 검사 ci-esm-core-unit-check · 파일 src/ui/pages/entity.js, src/ui/pages/market.js, src/ui/components/daily-loop.js, src/ui/components/home-day.js, src/ui/components/market-candles.js, src/ui/components/market-story.js
## P2349 - v59.95 - v59.94 비교 문장이 0.0%로 출력되는 차이를 높다·낮다·강했다·반전으로 읽고, 섹터 문장이 읽은 수와 무관하게 '11개 섹터'라고 씀 · 교훈 부호·화살표·색·비교 단어는 출력된 값을 따른다 (src/domain/shared/number.js directionOf, v58.80) · 검사 ci-esm-core-unit-check · 파일 src/ui/pages/screener/inspector.js, src/ui/pages/themes/detail.js, src/ui/pages/themes/sectors.js, src/ui/components/korea-participation.js, scripts/ci-esm-core-unit-check.mjs
## P2348 - v59.95 - v59.94 AI numeric-evidence check missed observed prices, yields and FX levels written without a unit · 교훈 No unverified current number in an AI answer (no invented numbers). · 검사 ci-ai-intelligence-contract-check · 파일 src/ai/response/publication.js, scripts/ci-ai-intelligence-contract-check.mjs
## P2347 - v59.95 - v59.94 an official release stops being upcoming once its real release time has passed · 교훈 A past event is not shown as coming. · 검사 ci-esm-core-unit-check · 파일 src/domain/market/day/facts.js, scripts/ci-esm-core-unit-check.mjs
## P2346 - v59.95 - v59.94 AI action gate catches prices written with thousands separators, 만/억 units and ranges · 교훈 No trade instructions (entry/stop/target/size): the app never tells the reader what to buy or sell, at what price, size or time. · 검사 ci-ai-intelligence-contract-check · 파일 src/ai/response/request-pipeline.js, scripts/ci-ai-intelligence-contract-check.mjs
## P2345 - v59.95 - v59.94 the :50 refresh-data dispatch slot was skipped every hour · 교훈 A dedupe window must measure the event it dedupes: 'a run already happened for this slot' is a start-time question, not a completion-time one. · 검사 ci-data-plane-contract-check · 파일 worker/data-plane.js, scripts/ci-data-plane-contract-check.mjs
## P2344 - v59.95 - v59.94 stale snapshot banner stacked a listener pair and a timer on every apply · 교훈 A repeated render path must not register a new subscription per call. · 파일 src/ui/components/data-status-surface.js, scripts/ci-esm-core-unit-check.mjs
## P2343 - v59.95 - v59.94 command guard denied an index-only unstage and allowed a forced push with a quoted +refspec · 교훈 A guard rule matches the operation's effect, not one spelling of it. · 파일 scripts/agent-hook.mjs, scripts/ci-workspace-contract-check.mjs
## P2342 - v59.95 - v59.94 four-place FX daily bars rounded high, low and adjusted close to two places · 교훈 One bar's fields share one precision; a rounding step must not reorder high, close and low. · 파일 src/domain/screener/price-factors.js, scripts/ci-esm-core-unit-check.mjs
## P2341 - v59.95 - v59.94 a manual CI dispatch no longer cancels main's push CI, and release_sha reaches shells only through env · 교훈 Workflow inputs and step outputs reach shell text through env:, never ${{ }} inside run:; a manual run must not share a cancel-in-progress group with… · 검사 ci-release-source-check · 파일 .github/workflows/ci.yml, scripts/ci-release-source-check.mjs
## P2340 - v59.95 - v59.94 earnings calendar records its failed day and IPO queries · 교훈 A missing value stays missing: a failed query must not be published as an empty, current result. · 검사 ci-event-briefs-check · 파일 scripts/fetch-earnings-calendar.mjs, scripts/ci-event-briefs-check.mjs
## P2339 - v59.95 - v59.94 publish-data-commit gate failed on every Windows run and hid the browser groups · 교훈 REVIEW.md failure 6 (a gate that does not prove what it claims: here it failed for a reason unrelated to the publisher) and the Windows notes in CLAU… · 파일 scripts/publish-data-commit.mjs, scripts/ci-publish-data-commit-check.mjs
## P2338 - v59.94 - refresh degradation gate compares against the last published data.json · 교훈 A gate must be able to fail in the context it runs in; a catch that turns a missing baseline into a pass hid that it never compared anything. · 검사 ci-data-pipeline-contract-check · 파일 scripts/ci-refresh-artifact-integrity-check.mjs, scripts/ci-data-pipeline-contract-check.mjs
## P2337 - v59.93 - Korean fallback quotes had no previous close after a weekend or holiday · 교훈 AGENTS.md honesty: a value that exists (the previous close) must not be shown as missing. · 파일 src/data/providers/naver-kr.js
## P2336 - v59.93 - agent command guard let short-flag force pushes and option-prefixed hard resets through · 교훈 AGENTS.md non-negotiable boundaries (destructive commands are denied by the hook); P1340 fixed the same guard for whole-tree discards. · 검사 ci-workspace-contract-check · 파일 scripts/agent-hook.mjs, scripts/ci-workspace-contract-check.mjs
## P2335 - v59.93 - blank-chart fallback threw on a deleted function and skipped its unavailable marking · 교훈 REVIEW.md failure 5 (a progress/loading state not cleared) reached through a deleted callee; an empty catch hid it. · 파일 js/aio-core.js
## P2334 - v59.93 - briefing opening said '지수 하락' on a day the S&P 500 rose · 교훈 REVIEW.md failure 1 (a screen states something that is not true); same class as P2333 (direction word must follow the printed number). · 검사 ci-esm-core-unit-check · 파일 src/domain/briefing/day-account.js, scripts/ci-esm-core-unit-check.mjs
## P2333 - v59.92 - 0.0%로 표시된 원/달러 변화에 '원화 강세'가 붙음 · 교훈 방향 단어·색은 표시된 숫자의 부호를 따른다(v58.80 directionOf와 같은 계약). · 파일 src/domain/macro/krw-decomposition.js
## P2332 - v59.92 - 거부된 달러 현금 금액이 이전 저장 금액으로 되돌아감 · 교훈 한 화면 값에는 한 시점에 한 소유자 — 비동기 처리기가 기다리는 동안의 DOM 상태 추측으로 소유를 정하지 않는다(P2106의 연장). · 검사 ci-portfolio-vault-e2e, ci-esm-core-unit-check · 파일 src/ui/panels/portfolio-cash-entry.js, src/app/compatibility-globals.js, src/ui/pages/portfolio.js, scripts/ci-portfolio-vault-e2e.mjs, scripts/ci-esm-core-unit-check.mjs
## P2331 - v59.88 - 질문 티커 해석 경로가 다섯 개라 별명이 다른 종목과 함께 쓰이면 빠지고, 한글 이름에 붙은 영문 접두가 유령 티커가 됐다 · 교훈 한 개념에 한 소유자 (ADR-0003, AGENTS 구조 우선) · 파일 src/domain/ticker/nicknames.js, src/domain/ticker/question-words.js, src/ai/entity/chat-tickers.js, src/ai/entity/resolver.js, src/ai/entity/extract-tickers.js, src/domain/news/article-tickers.js
## P2330 - v59.88 - 스크리너의 FCF 마진·매출 대비 설비투자 조건이 현금 지표를 한 번도 불러오지 못했다 · 교훈 상대 import는 정적이든 문자열 import()든 존재하는 파일을 가리켜야 한다. 파일을 옮길 때는 그 파일이 부르는 경로도 함께 다시 계산한다. · 검사 ci-architecture-contract-check · 파일 src/ui/pages/screener/model.js, scripts/ci-architecture-contract-check.mjs
## P2329 - v59.88 - 한국 장 마감 뒤 미국 장 마감 전에는 원화 분해의 코스피 20거래일 변화가 매크로·시장 상태와 달랐다 · 교훈 여러 시장을 섞은 계산에서 한 시장의 기준일을 다른 시장 구간에 쓰지 않는다. 각 구간은 자기 시장의 최신 세션에서 끝난다. · 검사 ci-esm-core-unit-check · 파일 src/domain/macro/krw-decomposition.js, scripts/ci-esm-core-unit-check.mjs
## P2328 - v59.88 - 한국 장 마감 뒤 미국 장 마감 전의 스크리너 갱신이 'all breadth coverage below 80%'로 실패했다 · 교훈 여러 시장을 섞은 집계는 시장마다 자기 거래일 달력으로 세션을 판정한다. 하나의 다수결 날짜를 섞은 시장 전체에 적용하지 않는다. · 검사 ci-data-pipeline-contract-check · 파일 scripts/producer/screener.mjs, scripts/ci-data-pipeline-contract-check.mjs
## P2327 - v59.87 - AI [주가 추이]가 종목 화면과 다른 계산으로 수익률·추세를 말함 · 교훈 ADR-0003 규칙 5 (AI context는 화면이 쓰는 같은 domain 함수나 근거 행을 읽는다) · 검사 ci-ai-evidence-contract-check · 파일 src/ai/context/stock-trend-line.js, js/aio-chat.js, src/app/chat-globals.js, src/app/compatibility-globals.js, scripts/ci-ai-evidence-contract-check.mjs
## P2326 - v59.87 - 포트폴리오의 한국 종목(6자리 코드)이 늘 '시세 대기'였다(정규화가 listingSymbol을 버림) · 교훈 리더가 해석한 필드를 정규화·리듀서가 나열식으로 다시 만들 때는 그 필드를 함께 옮겨야 한다. 보존은 체인 전체를 지나는 테스트로 확인한다. · 검사 ci-esm-core-unit-check · 파일 src/data/normalize/portfolio.js, js/aio-data.js, scripts/ci-esm-core-unit-check.mjs
## P2325 - v59.87 - 옛 기술 스냅샷의 ADR·VCP가 v59.59 이후 모든 브라우저에서 비어 있었다(AIO_ARCH 허용 목록 누락) · 교훈 한 API는 한 곳에서 선언한다. 위임 대상이 없을 때 조용히 null로 떨어지는 경로는 실제 브라우저에서 위임이 성립하는지 테스트로 확인해야 한다. · 검사 ci-esm-core-unit-check · 파일 src/app/bootstrap.js, src/legacy/compatibility-facade.js, js/aio-core.js, scripts/ci-esm-core-unit-check.mjs
## P2324 - v59.86 - 시장 뉴스 타임라인 링크가 다크 모드에서 대비 1.85로 읽기 어려웠다 · 교훈 본문 링크는 테마 토큰 색을 쓴다(WCAG AA). · 파일 src/ui/styles/v2-today.css
## P2323 - v59.86 - 차트 화면 AI가 QQQ·SOXX 한 달 비교를 '검증 근거 없음'으로 거절했다 · 교훈 화면이 판정에 쓰는 종가는 AI도 같은 근거 행으로 받는다. · 파일 src/ai/context/close-basis-evidence.js, src/ai/response/renderer.js, js/aio-chat.js
## P2322 - v59.86 - 통화 혼합 포트폴리오에서 원화 종목 손익을 달러로 표시했고, 기준 통화를 골라도 새로고침 전에는 반영되지 않았다 · 교훈 금액은 그 금액이 계산된 통화로만 표시한다. · 파일 src/domain/portfolio/surface.js, src/ui/pages/portfolio.js, src/domain/portfolio/portfolio-read.js, src/ui/components/portfolio-value-trend.js, js/aio-workspace.js
## P2321 - v59.86 - #fundamental/005930 주소가 한국 종목으로 풀리지 않아 SEC 재무 안내를 보였다 · 교훈 한 입력(종목 코드)은 들어온 경로와 무관하게 같은 정규화를 탄다. · 파일 src/app/router.js
## P2320 - v59.86 - 최근 4개 분기 매출 성장이 1년 전 분기의 순이익 공백 때문에 10개월 전 회계연도 성장으로 되돌아갔다 · 교훈 비교에 쓰는 필드만 비교의 성립 조건이 된다 — 다른 필드의 공백이 다른 비교를 막지 않는다. · 파일 src/domain/fundamental/analysis-read.js, src/domain/fundamental/fiscal-read.js
## P2319 - v59.85 - '다음 일정'이 미국 발표를 KST 날짜로만 걸러 FOMC는 발표 전에 빠지고 CPI는 발표 뒤에도 남았다 · 교훈 시각이 있는 일정은 그 시각으로 '다음'을 판정한다 — 독자의 날짜와 발표국의 날짜를 섞지 않는다. · 파일 src/domain/market/market-story.js, src/domain/briefing/schedule.js
## P2318 - v59.85 - 오늘 hero가 '다소 부담'을 말하는 바로 아래 지수 카드는 당일 상승을 보여, 판정이 무슨 기간 기준인지 알 수 없었다 · 교훈 한 화면의 두 숫자가 다른 기간이면 그 기간을 그 자리에서 말한다. · 파일 src/domain/briefing/market-read.js, src/domain/rules/thresholds.js, src/ui/components/market-regime.js
## P2317 - v59.85 - 연준이 9/17에 금리를 올린 뒤에도 물가·고용·소매 해석이 '인하 기대'로 쓰였고, 명목 소매판매를 수요 과열로 읽었다 · 교훈 해석은 지금의 정책 국면과 실질 기준에서 읽는다 — 명목값과 지난 국면의 문장을 현재 판단으로 쓰지 않는다. · 파일 src/domain/macro/macro-chapters.js, src/domain/macro/macro-read.js, src/domain/macro/macro-signals.js, src/domain/macro/release-zones.js
## P2316 - v59.85 - 거시 화면의 같은 개념(물가 방향·고용 경고·신용 해제·유가 기준·달러 부담·변동성 구간)을 화면마다 다른 규칙으로 판정했다 · 교훈 한 사실, 한 소유자 — 같은 지표의 판정은 한 함수가 내리고 화면들은 그 결과를 읽는다. · 파일 src/domain/macro/macro-read.js, src/domain/macro/macro-chapters.js, src/domain/macro/macro-signals.js, src/domain/macro/rates-fx.js, src/domain/macro/volatility.js, src/domain/briefing/market-read.js
## P2315 - v59.85 - 시장 해석 프롬프트가 CPI 한 달 변화로 '물가는 오르는 중'이라고 단정해 화면의 '방향 보류'와 어긋났다 · 교훈 AI 프롬프트의 판정 문장은 화면과 같은 규칙 모듈에서 온다(one fact, one owner). · 파일 scripts/producer/market-narrative.mjs, scripts/lib/market-analysis-prompt.mjs, scripts/lib/market-analysis-validate.mjs, scripts/lib/event-brief-prompts.mjs, scripts/fetch-event-briefs.mjs, js/aio-chat.js
## P2314 - v59.85 - AI 답변이 화면의 거시 숫자를 근거 행 없이 받아 지우거나 화면과 다른 금리·VIX를 썼다 · 교훈 화면과 AI가 같은 사실을 같은 값·같은 기준일로 말해야 한다(one fact, one owner). · 파일 src/ai/context/macro-release-evidence.js, src/ai/context/chat-macro-lines.js, src/ai/context/close-basis-evidence.js, src/ai/analysis/evidence-inputs.js, src/ai/analysis/macro-fx.js, src/ai/context/market-content.js
## P2313 - v59.85 - GitHub crons kept running beside the Worker dispatch, and a watchdog re-pin would have pushed every release onto the overlay · 교훈 v59.81 single-scheduler intent: one slot, one cycle. · 검사 ci-release-source-check, ci-data-plane-contract-check · 파일 scripts/cron-fallback-guard.mjs, scripts/refresh-cadence.mjs, worker/data-plane.js, scripts/ci-data-plane-contract-check.mjs, scripts/build-data-overlay.mjs, scripts/ci-release-source-check.mjs
## P2312 - v59.85 - The freshness grade measured pipeline liveness only; history.json's registry paths resolved nothing · 원칙 R747 · 교훈 The v59.70 freshness contract ("every card refreshes itself, or says it does not"): a card built on stale content was shown as current. · 검사 ci-artifact-refresh-path-check · 파일 src/data/contracts/artifact-freshness.js, scripts/write-freshness-ledger.mjs, scripts/ci-external-pipeline-check.mjs, scripts/ci-artifact-refresh-path-check.mjs, scripts/fetch-kr-index-weights.mjs, scripts/ci-event-briefs-check.mjs
## P2311 - v59.85 - Four hand-written data commit loops drifted apart; event-briefs lost a cycle to a dirty-worktree rebase · 원칙 R255, R746 · 교훈 R255 (a lost push race must not drop the cycle) held in only two of the four loops. · 검사 ci-publish-data-commit-check · 파일 scripts/lib/data-publish-sets.mjs, scripts/publish-data-commit.mjs, scripts/ci-publish-data-commit-check.mjs, .github/workflows/refresh-data.yml, .github/workflows/refresh-screener.yml, .github/workflows/event-briefs.yml
## P2310 - v59.85 - 기업 이야기에 내부 코드·영문 항목명이 그대로 보임 · 교훈 한국어 UI, 원시 키 노출 금지 · 검사 ci-company-profile-contract-check · 파일 scripts/ci-company-profile-contract-check.mjs, public-data/company-profiles/
## P2309 - v59.85 - 기업 이야기 첫 화면 실적이 4~12개월 전 회계연도 숫자 · 교훈 원천의 최신 보고서 우선, 한 화면 한 기준 시점 · 검사 ci-company-profile-contract-check · 파일 src/ui/components/stock-read.js, src/ui/components/company-story.js, scripts/ci-company-profile-contract-check.mjs, public-data/company-profiles/
## P2308 - v59.85 - 기업 이야기의 '새 실적' 표시가 조사 1~3주 뒤 발표를 놓침 · 교훈 AGENTS Freshness — 주기 상대 신선도 · 검사 ci-company-profile-contract-check · 파일 src/domain/entity/company-story.js, src/ui/components/company-story.js, src/ui/pages/entity.js, scripts/ci-company-profile-contract-check.mjs
## P2307 - v59.85 - 차트의 매물대와 '거래 집중 가격대' 표가 다른 계산이라 최대 구간이 어긋날 수 있음 · 교훈 한 사실은 한 소유자 · 검사 ci-chart-scenarios-fixture · 파일 src/domain/technical/chart-scenarios.js, src/domain/technical/chart-layers.js, src/ui/components/stock-chart-layers.js, src/ui/components/stock-chart.js, scripts/ci-chart-scenarios-fixture.mjs
## P2306 - v59.85 - 같은 화면에서 같은 지수·종목의 추세가 세 가지 단어로 읽힘 · 교훈 한 사실은 한 소유자(v59.84 화면 간 단일 사실 게이트) · 검사 ci-metric-consistency-check, ci-chart-layers-fixture · 파일 src/domain/technical/bands.js, src/domain/technical/trend-state.js, src/domain/technical/chart-layers.js, src/domain/technical/market-charts.js, src/domain/technical/chart-analysis.js, src/ui/components/stock-chart.js
## P2305 - v59.84 - AI 해설 문장이 증거 id를 본문에 담아 내보내 화면마다 지우는 코드가 늘어남 · 교훈 증거 id는 증거 저장소에만 · 검사 ci-data-pipeline-contract-check · 파일 scripts/lib/market-analysis-validate.mjs, scripts/ci-data-pipeline-contract-check.mjs
## P2304 - v59.84 - VIX 25.6이 화면마다 다른 구간 이름으로 읽힘 · 교훈 기준값은 RULES 한 곳(데이터 일관성) · 검사 ci-domain-parity-check · 파일 src/ui/components/home-vix.js, src/domain/market/market-story.js, scripts/ci-domain-parity-check.mjs
## P2303 - v59.84 - 참여가 넓어지는데 시나리오 전환 제목이 '약세 전환'으로만 읽힘 · 교훈 한 사실 한 소유자(데이터 일관성) · 검사 ci-metric-consistency-check · 파일 src/domain/market/regime-scenarios.js, src/domain/market/scenario-outlook.js, scripts/ci-metric-consistency-check.mjs
## P2302 - v59.84 - 매크로 연결 고리가 금리·신용 축과 다른 색과 문장을 보임 · 교훈 한 사실 한 소유자(데이터 일관성) · 검사 ci-metric-consistency-check · 파일 src/domain/macro/macro-read.js, scripts/ci-metric-consistency-check.mjs
## P2301 - v59.84 - 신용 스프레드 한 값이 시장 상태·매크로·시장 이야기에서 서로 다른 상태와 문장으로 읽힘 · 교훈 한 사실 한 소유자(데이터 일관성) · 검사 ci-metric-consistency-check · 파일 src/domain/briefing/credit-reading.js, src/domain/briefing/market-read.js, src/domain/macro/macro-chapters.js, src/domain/market/market-story.js, scripts/ci-metric-consistency-check.mjs
## P2300 - v59.84 - 한국 종목을 열 때마다 없는 kr-fundamentals.json을 요청해 404 · 교훈 계약에 없는 산출물 요청 금지 · 파일 src/ui/components/company-analysis.js
## P2299 - v59.84 - 브리핑 '이유가 확인되지 않은 큰 움직임'에 실적 발표 다음 날 움직인 종목이 들어감 · 교훈 이미 가진 사건 데이터의 연결 · 검사 ci-section-visual-contract · 파일 src/domain/briefing/day-account.js, src/ui/components/briefing-day.js, scripts/ci-section-visual-contract.mjs
## P2298 - v59.84 - 미국·한국 종목을 함께 담으면 포트폴리오가 '모두 가격 없음'·'통화 혼합()'·'$70000.00'으로 표시 · 교훈 P1175 단위 없는 합산 금지(유지) + 거짓 상태 문구 금지 · 검사 ci-esm-core-unit-check · 파일 src/domain/portfolio/surface.js, src/domain/portfolio/portfolio-read.js, src/ui/pages/portfolio.js, src/ui/components/portfolio-shell-controls.js, scripts/ci-esm-core-unit-check.mjs
## P2297 - v59.84 - 종목 '같은 날 보도'에 움직인 다음 날 나온 칼럼이 원인처럼 붙음 · 교훈 숫자와 근거의 기준일 일치 · 검사 ci-section-visual-contract · 파일 src/domain/entity/why-moved.js, scripts/ci-section-visual-contract.mjs
## P2296 - v59.84 - 소식 모음 게시물의 두 항목이 한 M&A로 짝지어져 'CRWD의 MSFT 인수 (약 42억 달러)'가 표시 · 교훈 관찰 ≠ 행위자(P2293 계열) · 검사 ci-data-pipeline-contract-check · 파일 scripts/lib/telegram-signals.mjs, scripts/ci-data-pipeline-contract-check.mjs
## P2295 - v59.84 - 실적 카드가 소형사 매출을 '0만 달러'로, 예상 대비를 매출 성장처럼, 보도된 이유가 있는데 '이유 불명확'으로 표시 · 교훈 숫자는 단위·기준과 함께(정확성) · 검사 ci-esm-core-unit-check · 파일 src/domain/shared/number.js, scripts/fetch-event-briefs.mjs, src/ui/components/event-briefs.js, src/domain/briefing/reaction-read.js
## P2294 - v59.84 - 브리핑 AI 해설에 증거 id 잔여 '[; regime-context]'가 보임 · 교훈 증거 id는 증거 저장소에만(X20/P1847 계열 다섯 번째 재발) · 검사 ci-codex-structure-regression-fixture · 파일 src/domain/briefing/evidence-text.js, scripts/ci-codex-structure-regression-fixture.mjs
## P2293 - v59.79 - 가격·스프레드 관측을 매수 주체·선행 신호로 단정한 문장 · 원칙 R719 · 교훈 R719 (원인 지지는 방향 일치만 — 단일 원인·주체를 단정하지 않음) · 검사 ci-esm-core-unit-check
## P2292 - v59.78 - Refresh market data 장애 알림(#5)이 갱신이 모두 성공한 뒤에도 닫히지 않음 · 교훈 한 워크플로의 장애 알림은 그 워크플로의 모든 실행이 같은 키로 판정한다. · 검사 ci-workspace-contract-check
## P2291 - v59.78 - 데이터 워치독이 저장소 정리 항목(문서 카탈로그·브라우저 고정본 데이터 모양) 때문에 빨간불을 이어가 실제 데이터 장애 신호를 묻음 · 교훈 워치독 빨간불은 사용자가 보는 데이터나 라이브 사이트가 틀렸을 때만 켜진다. · 검사 ci-release-source-check
## P2290 - v59.78 - 코드 병합 하나의 push CI가 빨간불이면 그 뒤 데이터 갱신 전부가 배포 거부되어 라이브 데이터가 몇 시간씩 멈춤 · 교훈 데이터 평면은 코드 릴리스 실패와 독립적으로 흘러야 한다: 사용자가 보는 데이터가 멈추는 것이 가장 큰 결함이다(소유자 2026-11-08). · 검사 ci-release-source-check · 파일 scripts/resolve-release-source.mjs, scripts/build-data-overlay.mjs, scripts/ci-release-source-check.mjs
## P2289 - v59.77 - 신용 20거래일 판정의 '부담 시작일'이 날마다 뒤로 밀림(10/30 → 11/3) · 교훈 과거 판정은 그 시점에 알 수 있던 기준으로 다시 계산한다 · 검사 ci-esm-core-unit-check · 파일 scripts/ci-esm-core-unit-check.mjs
## P2288 - v59.76 - 매크로 달러 장은 원/달러 20거래일 +1.5%를 '원화는 안정적', 성장·한국 장은 '원화가 약해져'로 씀 · 교훈 같은 화면에서 같은 기간의 같은 숫자는 한 가지로 읽는다 · 검사 ci-esm-core-unit-check · 파일 scripts/ci-esm-core-unit-check.mjs
## P2287 - v59.76 - 시장 상태 신용 축이 하이일드 5일 +22bp 확대 중에 '5거래일 전 부담 → 중립'으로 표시됨 · 교훈 히스테리시스 해제는 진입 원인이 실제로 가라앉았을 때만 한다(기준점 잡음으로 풀지 않는다) · 검사 ci-esm-core-unit-check · 파일 scripts/ci-esm-core-unit-check.mjs
## P2286 - v59.75 - 오늘·시장 신호 첫 6.5초에 차트 화면 전용 종목 차트 묶음(~124 KB)이 함께 내려옴 · 교훈 한 화면만 쓰는 무거운 모듈은 그 화면이 열릴 때 불러온다(boot-budget: 첫 화면 집합을 줄이면 상한도 내린다). · 검사 ci-boot-interaction-check · 파일 src/ui/pages/analysis.js, architecture/boot-budget.json
## P2285 - v59.75 - 매크로 성장 장의 판단 조건이 수집하지 않는 ISM을 기준으로 삼고, BB·B 스프레드는 기록이 1년으로 잘려 읽히지 않음 · 교훈 화면이 말하는 지표와 판단 조건은 수집·표시되는 원천에서만 나온다(원천 없는 위젯·근거 없는 판단 제거, AGENTS). · 검사 ci-esm-core-unit-check · 파일 scripts/producer/macro-history.mjs
## P2284 - v59.74 - 평일 종가가 전날 값으로 남음 (나스닥100·WTI·브렌트·금·은·달러, 10/26~11/4) · 교훈 한 세션의 종가는 그 세션의 행이 가진다. 자리표시 값은 관측이 아니다. · 검사 ci-metric-consistency-check
## P2283 - v59.74 - 다음 주 일정에서 11/10 CPI 누락, 매크로 첫 문장 '다음 주요 발표는 11/17 소매판매' · 교훈 '다음 발표'는 달력상 다음 발표다. 한 이름에 두 뜻을 싣지 않는다. · 검사 ci-metric-consistency-check, ci-structural-check
## P2282 - v59.74 - 수신 중에 종목을 붙인 시세 요청이 그 종목을 받지 못함(시세 수요 모듈 신설) · 교훈 요청한 종목은 그 요청이 돌려받는 수신이 읽는다(STATE-MACHINES SM-04 I4.1) · 검사 ci-state-machine-regression-check · 파일 src/data/quote-demand.js, scripts/ci-state-machine-regression-check.mjs
## P2281 - v59.74 - 서버 데이터 적재가 겹치면 늦게 온 옛 응답이 새 메타를 덮을 수 있음 · 교훈 한 적재 결과만 공유 메타를 쓴다(STATE-MACHINES SM-15) · 검사 ci-state-machine-regression-check · 파일 scripts/ci-state-machine-regression-check.mjs
## P2280 - v59.74 - 유니버스 밖 종목 읽기 캐시가 대기 중 항목을 밀어내 중복 수신 · 교훈 같은 종목의 진행 중 읽기는 하나다(STATE-MACHINES SM-13) · 검사 ci-state-machine-regression-check · 파일 scripts/ci-state-machine-regression-check.mjs
## P2279 - v59.74 - 답변이 도는 중 다른 AI 화면으로 가면 전송 버튼이 다시 켜짐 · 교훈 AI 채팅 요청은 하나만 활성이고 그 동안 전송은 꺼진다(STATE-MACHINES SM-08) · 검사 ci-state-machine-regression-check · 파일 scripts/ci-state-machine-regression-check.mjs
## P2278 - v59.74 - 화면 진입 갱신이 시작 전 취소되면 30초 동안 같은 화면 갱신을 막음 · 교훈 상태 전이는 실제로 일어난 일만 기록한다(STATE-MACHINES SM-07) · 검사 ci-state-machine-regression-check · 파일 scripts/ci-state-machine-regression-check.mjs
## P2277 - v59.74 - 시세 실패마다 재시도 사슬이 하나씩 늘고 숨긴 탭에서도 호출함 · 원칙 R3 · 교훈 C 숨긴 탭은 스스로 호출하지 않는다(refresh-scheduler-model R3) · 검사 ci-state-machine-regression-check, ci-runtime-contract-check · 파일 scripts/ci-state-machine-regression-check.mjs
## P2276 - v59.74 - 겹친 갱신이 시세 요청 종목 목록을 지우거나 끝난 갱신의 목록을 영구히 되살림 · 교훈 C 공유 상태는 소유자가 하나이거나 합성으로 계산한다 · 검사 ci-state-machine-regression-check · 파일 scripts/ci-state-machine-regression-check.mjs
## P2275 - v59.74 - 자동 갱신이 하지 않은 수신을 성공으로, 취소를 실패로 기록하고 늦게 끝난 수신 결과를 버림 · 원칙 R1, R3 · 교훈 C 상태 정직성: 갱신 시각은 실제로 받은 데이터만 말한다 · 검사 ci-state-machine-regression-check · 파일 scripts/ci-state-machine-regression-check.mjs, _context/STATE-MACHINES.md
## P2274 - v59.74 - 같은 시장 상태 화면이 같은 금리 하락을 '물가 안도'와 '피난성·성장 걱정'으로 반대로 읽음 · 교훈 한 화면 한 판정: 같은 사실을 화면 안에서 반대로 읽지 않는다
## P2273 - v59.74 - 시장 상태·스크리너 등에서 문서가 창보다 길어져 바깥 스크롤이 한 번 더 생기고 휴대폰 화면 아래가 비어 보임 · 교훈 반응형: 데스크톱·휴대폰·아이패드가 같은 화면을 한 스크롤로 쓴다(AGENTS Responsive) · 검사 ci-viewport-matrix-check · 파일 index.html, scripts/ci-viewport-matrix-check.mjs
## P2272 - v59.74 - 유가가 거의 안 움직였는데 '채권시장이 유가를 물가에 반영', 연결 지도는 기대인플레를 '기준일이 달라 보류' · 교훈 판단을 보류하는 조건은 그 판단에 필요한 입력에만 건다 · 검사 ci-esm-core-unit-check · 파일 scripts/ci-esm-core-unit-check.mjs
## P2271 - v59.74 - 매크로 금·은 장이 실질금리 -27bp 속 금 -3.4%를 '실질금리·달러와 어긋나지 않았다'로 읽음 · 교훈 같은 화면 무리에서 같은 20거래일은 한 가지로 읽는다(cross-asset-relations와 같은 선) · 검사 ci-esm-core-unit-check · 파일 scripts/ci-esm-core-unit-check.mjs
## P2270 - v59.74 - 등록 밖 상장 종목의 공식 이름이 약 1초 뒤 티커 글자로 되돌아감 · 교훈 한 번 확인한 공식 이름은 같은 세션의 다시 그리기에서 유지된다(v59.54 run-6 #11) · 검사 ci-out-of-universe-ticker-browser-check · 파일 src/ui/pages/entity.js, scripts/ci-out-of-universe-ticker-browser-check.mjs
## P2269 - v59.74 - DOMContentLoaded의 v20 래퍼가 시세 수요 모듈을 덮어써 요청 종목과 결과가 사라짐 · 교훈 요청한 종목은 그 요청이 돌려받는 수신이 읽는다(STATE-MACHINES SM-04 I4.1) · 검사 ci-state-machine-regression-check · 파일 js/aio-ui.js, scripts/ci-state-machine-regression-check.mjs
## P2268 - v59.74 - 기록이 60거래일 미만이거나 Yahoo 일봉이 없는 한국 종목은 차트 자체가 비었다 · 교훈 모든 종목에 기본 차트 분석을 빠짐없이 보여 준다(소유자 2026-11-07) · 검사 ci-chart-layers-fixture · 파일 scripts/ci-chart-layers-fixture.mjs
## P2267 - v59.72 - Post-boot lazy JS over budget once market-day carries narratives (backtest idle warm on every route) · 교훈 Route-only engines load on that route's action, not on idle across all routes. · 파일 scripts/ci-boot-interaction-check.mjs
## P2266 - v59.72 - One flaky phone check on the v59.71 push left every later data release unattested · 교훈 Browser gates wait on the state they assert, never on a fixed sleep. · 파일 scripts/ci-responsive-browser-check.mjs
## P2265 - v59.72 - Watchdog failed hourly on a quiet Federal Reserve feed (192h allowance below the feed's own gaps) · 교훈 Liveness thresholds come from the source's measured cadence, not a guess. · 검사 ci-codex-structure-regression-fixture · 파일 scripts/ci-codex-structure-regression-fixture.mjs
## P2264 - v59.72 - S&P 500 member weights stale since 10/27 — iShares renamed the weight column · 교훈 An external CSV contract change must fail visibly, not age silently behind a kept file. · 검사 ci-data-pipeline-contract-check, ci-external-pipeline-check · 파일 public-data/sp500-weights.json, scripts/fetch-sp500-weights.mjs, scripts/ci-data-pipeline-contract-check.mjs
## P2263 - v59.71 - Statistical conventions: sentiment percentile, Sahm windows, capture ratio, mixed quarter ends, index basis · 교훈 Shared statistical conventions (shared/percentile.js) and calendar-aligned windows · 검사 ci-esm-core-unit-check
## P2262 - v59.71 - Legacy engines still computed trend, breadth, extension and 52-week distance on their own rules beside the canonical ones · 교훈 One owner per quantity (RULES thresholds, bands.js trend, one 52-week field)
## P2261 - v59.71 - Value factor scored loss-makers on P/B alone, ranking distressed names as cheap · 교훈 A value missing because its input is negative is information, not absence · 검사 ci-domain-parity-check · 파일 scripts/ci-domain-parity-check.mjs
## P2260 - v59.71 - Breadth history was rewritten from today's S&P 500 membership every run and mixed two populations in one percentile · 교훈 Point-in-time data: a historical observation is frozen once published (survivorship) · 파일 scripts/producer/screener-breadth.mjs
## P2259 - v59.71 - Breadth snapshot coverage gate counted rows from every session while the percentages used only the majority session · 교훈 A coverage gate must measure the population the published number describes · 파일 scripts/producer/screener.mjs
## P2258 - v59.71 - Reverse DCF priced a split-adjusted close against the pre-split SEC cover share count · 교훈 One valuation basis per number: price and share count from the same reconciled row · 검사 ci-esm-core-unit-check · 파일 scripts/ci-esm-core-unit-check.mjs
## P2257 - v59.71 - 스크리너 '거시 시나리오' link opened 매크로 after the scenarios moved to 시장 상태 · 교훈 결론에서 근거로 가는 링크는 근거가 있는 화면을 연다.
## P2256 - v59.71 - 기술적 분석 stock table and 종목 named a different trend for the same stock · 교훈 같은 종목의 같은 지표는 화면이 달라도 같은 정의로 읽는다(한 사실, 여러 화면). · 검사 ci-esm-core-unit-check
## P2255 - v59.71 - An outlook reported as below expectations read as 전망 신중 instead of 가이던스 하회 · 교훈 가이던스 하향(회사가 낮춤)·하회(예상보다 낮음)·신중(어조)은 서로 다른 상태다(v59.70). · 검사 ci-esm-core-unit-check
## P2254 - v59.71 - 시장 상태 week-ahead listed any-weight reports and gave them the AI-spending sentence by market mood, not by company · 교훈 문장은 그 줄의 대상에서 나온다 — 시장 전체 상태로 개별 항목을 설명하지 않는다. · 검사 ci-esm-core-unit-check
## P2253 - v59.71 - One earnings report printed different surprises on 브리핑 and 오늘, and annual revenue was compared with the quarter's estimate · 교훈 같은 사실은 한 선택자에서 나온다 — 한 보고서의 서프라이즈는 한 기준·한 숫자다. · 검사 ci-esm-core-unit-check, ci-event-briefs-check
## P2252 - v59.71 - Earnings reactions read a carried-forward history row as the benchmark's close and printed a flat 0.0% market move · 교훈 같은 사실은 한 선택자에서 나온다 — history 이월 값은 그 날짜의 관측이 아니다(fieldMeta.sessionDate). · 검사 ci-esm-core-unit-check
## P2251 - v59.71 - A stock split before the next SEC filing priced P/E and P/B on the pre-split share count · 교훈 가격 비율의 분자와 분모는 같은 주식 기준이어야 한다(v58.20 B1). · 검사 ci-data-pipeline-contract-check
## P2250 - v59.71 - Earnings reaction read benchmarked oil, power and software against SMH and called a kept outlook weak · 교훈 AGENTS 근거 없는 판정 금지 — 비교 대상은 종목이 실제 속한 집합이어야 한다. · 검사 ci-esm-core-unit-check
## P2249 - v59.70 - The first v59.70 refresh failed: the data-audit gate read the published history.v2 object as rows and got an empty regime · 교훈 A reader of history.json goes through readHistoryRows; a gate that reads published artifacts must be run against the shape the new producer writes, n… · 파일 public-data/history.json, scripts/ci-data-audit-contract-check.mjs
## P2248 - v59.70 - Three screens computed the 20-session HY spread change three ways (+32bp vs +34bp), and 매크로 read credit with its own thresholds · 원칙 R745 · 교훈 One number, one source (a figure shown on two screens is computed once) · 파일 scripts/ci-data-audit-contract-check.mjs
## P2247 - v59.70 - 테마·스크리너 화면 검수 결함 6건: AI 설비투자 띠 다크 대비 1.8, 카드 머리 줄 깨짐, 1개월 1위 기준 불일치와 7줄 시나리오 문단, 산점도 축 제목 겹침, S&P 500 지도 섹터 라벨 말줄임, 스크리너 분모 넷, 검증 안내 띠 잘림 · 교훈 QUALITY-BAR 1(숫자는 한 기준으로 이어진다)·2(잘린 글자 없음)·7(짧은 해석)·9(AA 대비) · 검사 ci-theme-screener-review-check
## P2246 - v59.70 - 매크로로 바로 들어오면 BOK·KOSIS 조회가 relay 전역이 설치되기 전에 돌아 _cfWorkerUrl ReferenceError로 끝났다 · 교훈 클래식 코드가 모듈이 설치하는 전역을 부르려면 설치 신호를 기다린다 — 고정 시간 타이머는 모듈 그래프 도착 순서를 보장하지 않는다. · 검사 ci-route-soak-check · 파일 js/aio-data.js, src/ui/pages/market.js, js/aio-workspace.js, src/data/providers/proxy-transport.js, scripts/ci-route-soak-check.mjs
## P2245 - v59.70 - A failed history.json or data.json held the screener read until the critical-data gate's 20 s fallback · 교훈 A wait on another file must end when that file's read settles, failed or not, not only when it succeeds · 검사 ci-esm-core-unit-check, ci-sa-02-outage-browser-fixture · 파일 scripts/ci-esm-core-unit-check.mjs, scripts/ci-sa-02-outage-browser-fixture.mjs
## P2244 - v59.70 - apply-pending-records --help ran the real integration: version bump, every record written, pending files deleted · 교훈 A command that writes the ledgers or the version must never write on an argument it does not understand · 검사 ci-record-fix-check · 파일 scripts/apply-pending-records.mjs, scripts/lib/cli-args.mjs, scripts/ci-record-fix-check.mjs
## P2243 - v59.70 - 시세 칩 '◦', 발표 띠 현재값 선의 라벨 관통, 라벨의 '거시', 0 변화의 방향 라벨, 'HY' 검색 순서 · 교훈 화면에 뜻 없는 기호를 두지 않는다. 표시는 인쇄된 값을 따른다. 라벨은 매크로다. 검색은 가장 정확한 일치를 먼저 보인다. · 검사 ci-contrast-focus-browser-check, ci-rendered-copy-lint, ci-search-surface-contract
## P2242 - v59.70 - 공용 진행 표시(스피너)가 좁은 버튼 글자를 덮었고 차트 라이브러리 로고 링크가 브라우저 기본 파란색이었다 · 교훈 공용 상태 표시는 가장 좁은 소비자에서도 내용을 가리지 않는다. 외부 라이브러리가 그린 링크도 앱의 링크 색·포커스 규칙을 따른다. · 검사 ci-contrast-focus-browser-check
## P2241 - v59.70 - 발표 띠 현재값 선이 라벨을 가르고 고용 눈금이 '5만7.5만'으로 붙었으며 용어 팝오버가 용어보다 왼쪽에 떴다 · 교훈 화면 너비에 달린 배치는 그려진 뒤 잰다. 팝오버는 그것을 연 요소에 붙는다. · 검사 ci-esm-core-unit-check
## P2240 - v59.70 - 브리핑·오늘 '지난 24시간' 둘째 이야기가 제목과 본문 없이 무게 막대와 '관련 보도 1건'만 나왔다 · 교훈 씨앗 종류를 늘리면 그 종류의 문구도 같이 만든다 — 빈 제목 이야기는 목록에 들어가지 않는다. · 검사 ci-esm-core-unit-check · 파일 src/domain/briefing/day-account.js
## P2239 - v59.70 - 다크 뉴스 '시간대별 시황' 제목이 브라우저 기본 파랑 링크였고, 라이트 칩·보조 글자는 AA에 못 미쳤으며, 뉴스 접힘 카드에 펼침 표시가 없었다 · 교훈 블록을 다른 화면으로 옮기면 그 블록의 스타일 범위도 같이 옮긴다. 데이터 색 토큰은 쓰이는 가장 어두운 바탕에서 AA를 넘어야 한다. 접기 행은 열린다는 표시를 가진다. · 검사 ci-contrast-focus-browser-check · 파일 scripts/ci-contrast-focus-browser-check.mjs
## P2238 - v59.70 - 휴대폰 1열 규칙이 더 구체적인 2열 규칙에 져서 환율·뉴스 초점·금리 표가 390px에서 2열로 눌렸다 · 교훈 미디어 쿼리는 명시도를 올려 주지 않는다 — 휴대폰 재배치 규칙은 이기려는 규칙과 같은 범위 이상이어야 한다. · 검사 ci-phone-override-specificity-check · 파일 scripts/ci-phone-override-specificity-check.mjs, index.html
## P2237 - v59.70 - 종목 경로형 딥링크(#technical/AAPL, #fundamental/AAPL)가 '오늘' 허브 탭과 빈 차트로 열림 · 교훈 주소 하나는 한 파서로 읽는다 — 부팅 라우트와 라우터가 같은 해시 형식을 다르게 읽었다. · 검사 ci-esm-core-unit-check, ci-entity-deep-link-browser-check · 파일 src/app/bootstrap.js, scripts/ci-esm-core-unit-check.mjs, scripts/ci-entity-deep-link-browser-check.mjs
## P2236 - v59.70 - history.json·data.json을 받지 못해도 화면은 '종가 기록을 불러오는 중입니다'를 계속 보여 줬다 · 교훈 불러오기 실패는 대기와 다른 상태로 발행해야 한다 — 실패를 null로만 돌려주면 모든 소비자가 영원한 '불러오는 중'을 보여 준다. · 검사 ci-sa-02-outage-browser-fixture · 파일 public-data/history.json, js/aio-data.js, src/data/server-data-loader.js, src/ui/components/data-state.js, scripts/ci-sa-02-outage-browser-fixture.mjs
## P2235 - v59.70 - 테마가 이미 열린 상태에서 옛 #theme-detail/<id> 주소가 아무것도 열지 않음, 테마 구성 변경 뒤 playbook 버전 미변경 · 교훈 주소가 주제를 담는다(v57.50 I28) — 화면이 이미 열려 있어도 주소의 id가 선택을 정한다; 산출물을 만드는 규칙이 바뀌면 버전 표기를 함께 올린다 · 검사 ci-esm-core-unit-check · 파일 scripts/lib/theme-detail-address.mjs
## P2234 - v59.70 - 옛 #theme-detail/<id> 주소가 어느 테마든 방산을 연다 · 교훈 주소가 주제를 담는다(v57.50 I28) — 주소의 id를 대체값으로 덮지 않는다 · 검사 ci-esm-core-unit-check · 파일 js/aio-core.js, src/app/bootstrap.js, src/ui/navigation/theme-detail.js
## P2233 - v59.70 - 테마 시나리오: 미국 종가가 반영되기 전 '미국 0'과 빈 지도 · 교훈 X03 — 오래된 기준일은 지우지 않고 날짜를 붙인 참고 값으로 둔다(P1681)
## P2232 - v59.70 - 테마 RRG: 산출물이 한 세션 늦으면 세부 업종 ETF가 한 점에 겹침 · 원칙 R1, R14 · 교훈 R14 계열 — 세션 틱과 일봉 시계열을 한 계산에 섞지 않는다
## P2231 - v59.70 - 라이브 데이터 02:54Z에서 게이지 '+0.0%'와 국채 곡선 라벨 겹침 — push CI browser-surface·viewport 실패 · 원칙 R2 · 교훈 반올림해 0인 변화는 부호도 색도 없다(signedText 규칙, v58.80 R2-27). 차트 텍스트는 서로 겹치지 않는다(viewport matrix). · 검사 ci-render-boundary-fixture · 파일 src/ui/components/svg-label-dodge.js, scripts/ci-render-boundary-fixture.mjs
## P2230 - v59.70 - Screen re-review: same-window values still split (HY 5-session +13/+25bp, KOSPI 20-session -18.6/-19.3%), ledger day moves over a carried close, a bl… · 원칙 R744 · 교훈 One number, one source (a figure shown on two screens is computed once) · 검사 ci-metric-consistency-check, ci-screen-rereview-browser-check · 파일 src/domain/market-day/one-session.js, scripts/ci-metric-consistency-check.mjs, scripts/ci-screen-rereview-browser-check.mjs
## P2229 - v59.70 - The same metric read different values across screens: HY +13/+25bp, 10-year -32/-40bp and day moves that spanned a carried-forward session · 원칙 R743 · 교훈 One number, one source (a figure shown on two screens is computed once) · 검사 ci-metric-consistency-check · 파일 scripts/ci-metric-consistency-check.mjs
## P2228 - v59.70 - 시장 이야기가 이월된 행 값을 그 날 종가로 읽음 · 교훈 종가 기준 점수 / 시점 일치(관측일과 행 날짜를 구분) · 검사 ci-data-audit-contract-check · 파일 src/domain/market/market-story.js, scripts/ci-data-audit-contract-check.mjs
## P2227 - v59.70 - 실패한 원천 레코드가 판단용 사용 등급을 그대로 발행 · 원칙 R5 · 교훈 AGENTS: 원천 없는 판단 금지 / evidence 계약(freshness가 decision을 승격하지 못하고 강등만 한다) · 검사 ci-data-audit-contract-check · 파일 src/data/contracts/evidence.js, scripts/ci-data-audit-contract-check.mjs
## P2226 - v59.70 - A source push that fixed the data plane failed CI only because time had passed, so no release could be attested · 원칙 R634, R742 · 교훈 R634 (rewritten v59.70): calendar facts block producers and the watchdog, not source-push CI · 검사 ci-refresh-origin-live-data-check · 파일 scripts/lib/qa-live-data.mjs, scripts/ci-refresh-origin-live-data-check.mjs
## P2225 - v59.70 - CI on refresh commits failed on what the live data said, and every later data commit stayed UNATTESTED · 원칙 R3, R741 · 교훈 R3/AGENTS: a refresh commit is attested on code contracts; live content is watched, not re-litigated per commit · 검사 ci-refresh-origin-live-data-check · 파일 architecture/qa-pipeline.json, scripts/lib/qa-live-data.mjs, scripts/ci-refresh-origin-live-data-check.mjs
## P2224 - v59.70 - No single freshness record: screens, gates and the watchdog each judged age from their own clock, and some screen data had no refresh path at all · 원칙 R740 · 교훈 Owner 2026-11-04: every screen value refreshes itself or says it does not; one freshness source · 검사 ci-artifact-refresh-path-check · 파일 src/data/contracts/artifact-freshness.js, src/data/freshness.js, scripts/ci-artifact-refresh-path-check.mjs
## P2223 - v59.70 - The LIVE3-03 breadth fixture ran on the wall clock and failed the bot's data-commit CI at some hours · 원칙 R739 · 교훈 Fixtures do not read the wall clock (v59.48 failure-ledger pass pinned the news audit the same way)
## P2222 - v59.70 - v59.69 reaction-read.js regexes carried literal backspace bytes instead of \b · 교훈 Edit tool, not shell heredocs, for JS with backslashes (CLAUDE.md Windows note) · 검사 ci-control-char-check · 파일 scripts/ci-control-char-check.mjs
## P2221 - v59.70 - Pages release verification failed code deploys on stale data, and the watchdog read an in-flight deploy as untrusted · 원칙 R738 · 교훈 v59.48 ownership split: each plane is judged once, by the workflow that owns it
## P2220 - v59.70 - The Telegram signal kind list in the semantics gate was a copy and refused the 'deal' kind · 원칙 R737 · 교훈 One vocabulary, one source (closed-vocabulary copies drift) · 파일 scripts/lib/telegram-signals.mjs, public-data/telegram-digest.json
## P2219 - v59.70 - A weekly survey or hand-kept event value that aged refused the whole market refresh · 원칙 C4, R736 · 교훈 AGENTS lane-quarantine decision (owner 2026-10-23): one auxiliary check must not refuse the whole refresh
## P2218 - v59.62 - A headline naming two reporters showed only the first calendar row (Palantir lost to Apple) · 교훈 A selector over many candidates must not return the first match when the input can name several. · 검사 ci-esm-core-unit-check
## P2217 - v59.62 - Event briefs frozen since 10/31: the timestamp-only gate discarded every real change · 교훈 A no-op gate must compare content, not the textual layout of a generated file. · 검사 ci-data-pipeline-contract-check · 파일 scripts/lib/json-same-except.mjs
## P2216 - v59.61 - 스크리너가 새 SEC 원장을 발행한 뒤 main push에 실패하면 다음 실행까지 CI가 전체 원장 검사를 건너뜀 · 교훈 P1757 SEC 원장 저장소 · 검사 ci-sec-store-previous-check · 파일 scripts/sec-fundamentals-store.mjs, scripts/ci-sec-store-previous-check.mjs
## P2215 - v59.60 - Pages 배포 직후 라이브 불변식 검사가 일시 503에 재시도 없이 실패 · 원칙 R290 · 교훈 R290 라이브 불변식 · 파일 scripts/ci-live-invariant-check.mjs
## P2214 - v59.60 - 숨김 중 시작한 갱신이 복귀 뒤 끝나면 보이는 탭의 자동 갱신이 멈춤 · 원칙 R1, R3 · 교훈 없음(새 상태 기계 검사) · 검사 ci-refresh-scheduler-model-check · 파일 src/app/refresh-scheduler.js, scripts/ci-refresh-scheduler-model-check.mjs, scripts/ci-pipeline-semantics-check.mjs
## P2213 - v59.60 - 시세 세션 분류가 달력 경계(SMH 반일장·휴장, KRX 지연 개장, 수능 시간)에서 확정 종가를 장중·STALE로 읽음 · 원칙 R447 · 교훈 R447 시장 달력 · 검사 ci-market-session-model-check · 파일 scripts/build-market-snapshot.mjs, scripts/ci-market-session-model-check.mjs, scripts/ci-market-snapshot-contract-check.mjs
## P2212 - v59.59 - Same quantity computed two ways across screens: percentile conventions, legacy ADR/VCP, Weinstein stage, neutral rate, portfolio FX · 원칙 C4, R265 · 교훈 C4 one meaning one implementation; a named method follows its published definition (R265). · 검사 ci-quant-reference-check · 파일 src/domain/shared/percentile.js, scripts/ci-quant-reference-check.mjs
## P2211 - v59.59 - Analysis math counted missing, stale or gated inputs as values and measured windows on filtered arrays · 원칙 C4, R265 · 교훈 C4 one meaning one implementation; null is unknown, never 0; a named method follows its published definition (R265). · 검사 ci-quant-reference-check · 파일 scripts/ci-quant-reference-check.mjs
## P2210 - v59.59 - 스크리너 보관 실행 목록이 화면 재진입 뒤 '불러오는 중' 표시에 묶여 재현 버튼이 사라짐 · 교훈 비동기 로드 표시는 그 로드를 끝내지 않고 반환하는 모든 경로에서 해제해야 한다(P2107 계열). · 파일 src/ui/pages/screener.js, scripts/ci-screener-auto-refresh-browser-check.mjs
## P2209 - v59.59 - 기능별 점검: 화면이 주장한 내용이 데이터·계산과 어긋난 25곳 · 교훈 AGENTS 데이터 정직성(날짜·기간·미수집 표시, 지어낸 숫자 금지)
## P2208 - v59.59 - 회전(RRG) 산출물이 종가 21분 뒤 읽은 미확정 일봉을 그 세션 내내 재사용했고(SMH -8.41% 대 확정 -6.98%), 13F 발견기는 13F-NT만 낸 운용사를 최신으로 표시했다 · 교훈 확정 종가 기준 — 종가 직후 공급자 값은 확정값이 아니며, 보유 내역 없는 통지 제출은 보유 최신성이 아니다. · 검사 ci-rotation-history-check · 파일 scripts/ci-rotation-history-check.mjs
## P2207 - v59.59 - 수집·발행 코드 44곳이 Number.isFinite(Number(x))로 판정해 null·빈 문자열 값을 0 관측으로 받아들였다 · 교훈 없는 값은 없는 값이다 — 관측이 없는 칸을 0 관측으로 승격하지 않는다(P715·P2164, shared-primitive ratchet). · 파일 src/domain/shared/number.js, scripts/ci-pipeline-semantics-check.mjs
## P2206 - v59.59 - AI 공개 경로 게이트가 병렬 QA 부하에서 '채팅 스크립트 없이 부팅' 확인 전에 유휴 로드가 먼저 끝나 간헐 실패했다 · 교훈 타이머 경합을 시험하는 게이트는 경쟁하는 타이머를 고정해야 한다 — 실행 속도에 기대는 순서 가정은 병렬 CI에서 깨진다. · 검사 ci-ai-chat-public-route-browser-check · 파일 src/app/chat-loader.js, js/aio-chat.js
## P2205 - v59.59 - 감시 cadence 경고가 GitHub가 건너뛴 시간별 cron만 세어, 실제로는 30~100분마다 돈 감시를 '실행 누락'으로 표시했다 · 교훈 감시 게이트는 실제로 일어나는 실행 경로를 모두 세야 한다 — 백업 경로(cron)만 세면 경보 피로가 생긴다. · 검사 ci-data-pipeline-contract-check · 파일 scripts/lib/operational-health.mjs, scripts/ci-data-pipeline-contract-check.mjs, scripts/ci-deployment-convergence-check.mjs
## P2204 - v59.59 - 테마 상세로 갔다가 모듈 마운트 전에 다른 화면으로 떠나면, 다음 테마 진입이 개요 대신 방산 상세로 열렸다 · 교훈 화면 전환 사이에 넘기는 일회성 상태는 그 전환에만 속해야 한다 — 소비되지 않은 대기 상태가 다음 진입으로 새면 사용자가 고르지 않은 화면이 열린다. · 검사 ci-responsive-browser-check · 파일 js/aio-core.js, scripts/ci-responsive-browser-check.mjs
## P2203 - v59.58 - 연준 보도자료 피드가 FOMC 주 뒤 주말에 조용해지자 72h 죽은 피드 게이트가 Pages 배포·감시 실행을 매번 실패로 표시했다 · 교훈 감시 게이트는 원천의 정상 발행 주기를 반영해야 한다 — 저빈도 공식 원천을 고빈도 검색 피드와 같은 기준으로 판정하면 경보 피로가 생긴다(ops 로드맵 alert fatigue). · 검사 ci-codex-structure-regression-fixture · 파일 scripts/ci-codex-structure-regression-fixture.mjs, public-data/data.json
## P2202 - v59.56 - 시황 해석이 실적 요약을 입력으로 받지 않아 급락 원인을 일반 헤드라인으로만 씀 · 교훈 해석은 그날 종가를 움직인 1차 원문(실적 요약)을 입력으로 받는다 · 검사 ci-event-briefs-check, ci-data-pipeline-contract-check · 파일 scripts/producer/earnings-context.mjs, scripts/ci-event-briefs-check.mjs, scripts/ci-data-pipeline-contract-check.mjs
## P2201 - v59.56 - 실적 요약 숫자 검증이 기간 표기와 억 달러 표기를 숫자 불일치로 보고 항목을 버림 · 교훈 검증은 숫자만 대조한다 — 기간 표기·단위 환산은 숫자로 세지 않는다 · 검사 ci-event-briefs-check · 파일 scripts/ci-event-briefs-check.mjs
## P2200 - v59.56 - 투자 심리 '심리 종합' 요약이 연결 카드에 덮여 사라짐 · 교훈 동적으로 만드는 블록 id는 정적 셸의 기존 id와 겹치지 않는 고유 접두사를 쓴다. · 파일 index.html
## P2199 - v59.56 - 실적 요약의 범위·단위·비교 기준이 영어로 남거나 한쪽 끝만 한국어 단위로 바뀜 · 교훈 화면 숫자는 한국어 단위와 한 가지 표기로 읽힌다 · 파일 scripts/ci-pipeline-semantics-check.mjs
## P2198 - v59.54 - 등록 종목 밖 미국 상장 기호(FB, AAP)의 종목 화면 제목에 회사 이름이 없음 · 교훈 AGENTS 티커 추정 금지 — 이름은 상장 목록 원천에서만 가져온다. · 검사 ci-out-of-universe-ticker-browser-check · 파일 src/ui/pages/entity.js, scripts/ci-out-of-universe-ticker-browser-check.mjs
## P2197 - v59.54 - 보유 추가를 두 번 누르면 방금 저장한 종목을 '이미 보유 중 — 바꿀까요?'로 다시 물음 · 원칙 R734 · 교훈 R734 — 반복 결함 클래스(중복 실행)는 공용 경로에서 닫는다. · 검사 ci-portfolio-vault-e2e · 파일 js/aio-workspace.js, scripts/ci-portfolio-vault-e2e.mjs
## P2196 - v59.54 - AI 스크리너 문맥에서 실시간 시세가 'N/A' 또는 'STALE'로 표시됨 · 교훈 AGENTS 종가 기준 점수와 실시간 시세 구분 — 서로 다른 시점의 값에 다른 값의 상태를 붙이지 않는다. · 파일 src/ai/context/screener-query.js, scripts/fixtures/pipeline-semantics/ai.mjs, scripts/ci-pipeline-semantics-check.mjs
## P2195 - v59.54 - 포트폴리오 기준 통화를 선언하지 않았는데 AI에 '기준 통화 USD'로 전달되고, 시세 통화를 모르는 보유가 '통화 혼합'으로 안내됨 · 교훈 AGENTS 원천 없는 값 금지 — 사용자가 선언하지 않은 기준 통화를 선언된 값처럼 전달했다. · 검사 ci-esm-core-unit-check · 파일 src/domain/portfolio/surface.js, scripts/fixtures/pipeline-semantics/portfolio.mjs, scripts/ci-pipeline-semantics-check.mjs, scripts/ci-esm-core-unit-check.mjs
## P2194 - v59.53 - 일반 사용자에게 필요한 S&P 500 지도와 AI 설비투자 설명을 개발자 전용 CSS가 숨김 · 원칙 C4 · 교훈 C4 공용 의미와 단일 소유권, 데이터 정직성, 사용자 가치 우선
## P2193 - v59.53 - 섹터 ETF를 광범위 ETF로 묶어 업종 집중도를 숨김 · 원칙 C4 · 교훈 C4 공용 의미와 단일 소유권, 데이터 정직성, 사용자 가치 우선 · 검사 ci-pipeline-semantics-check · 파일 scripts/ci-pipeline-semantics-check.mjs
## P2192 - v59.53 - 한국 보유 코드의 시세 키와 통화 분리로 원화 값을 USD로 합산·표시 · 원칙 C4 · 교훈 C4 공용 의미와 단일 소유권, 데이터 정직성, 사용자 가치 우선 · 검사 ci-pipeline-semantics-check · 파일 scripts/ci-pipeline-semantics-check.mjs
## P2191 - v59.53 - 리서치 문서를 선택하면 키보드 읽기 포커스가 BODY로 유실 · 원칙 C4 · 교훈 C4 공용 의미와 단일 소유권, 데이터 정직성, 사용자 가치 우선
## P2190 - v59.53 - 접힌 사용자 콘텐츠와 현재 탐색 계약을 따르지 않는 검증 드라이버 · 원칙 C4 · 교훈 C4 공용 의미와 단일 소유권, 데이터 정직성, 사용자 가치 우선
## P2189 - v59.53 - 시장 온도의 혼재를 보통 범위로, 전부 지연된 자료를 현재 극단 없음으로 표시 · 원칙 C4 · 교훈 C4 공용 의미와 단일 소유권, 데이터 정직성, 사용자 가치 우선 · 검사 ci-pipeline-semantics-check · 파일 scripts/ci-pipeline-semantics-check.mjs
## P2188 - v59.52 - 기업 펼침 검증을 건너뛰어도 성공을 합성하고 단일 case를 6개 실행으로 보고 · 교훈 REVIEW.md 게이트가 증명하지 않는다, 정적·브라우저·라이브 증거 분리
## P2187 - v59.52 - 시세 갱신 때 브리핑·종목의 열린 근거가 닫히고 포커스가 사라짐 · 원칙 C4 · 교훈 REVIEW.md 수명주기와 정본 소유권, C4 한 의미에는 한 구현
## P2186 - v59.52 - 미래 세션 날짜가 최신 가격 팩터로 인정됨 · 원칙 R670 · 교훈 R670 직전 미국 정규장 기준, 데이터 정직성과 미래 정보 금지
## P2185 - v59.52 - AI 종목 검색이 retail의 AI와 대명사 it를 기술 테마로 읽음 · 원칙 R734, C4 · 교훈 R734 반복 결함의 공용 함수화, C4 한 의미에는 한 구현 · 파일 scripts/ci-pipeline-semantics-check.mjs
## P2184 - v59.52 - 포트폴리오 비교 지수·섹터 ETF가 지표 계약을 우회 · 원칙 C8, C10 · 교훈 C8 결측은 값이 아니다, C10 한 지표에는 한 원천과 한 표시 owner · 검사 ci-portfolio-vault-e2e · 파일 scripts/ci-pipeline-semantics-check.mjs
## P2183 - v59.52 - AI 후보 탐색이 임의 점수와 최종 종목 선택 지시로 제품 결정에 충돌 · 원칙 R211, R724, C4, C7 · 교훈 R211 본문은 diversified candidate list for research, never a recommendation이며 R724는 종목을 대신 고르지 않는다. C4 한 의미 한 구현, C7 검증 안 된 합산 금지. · 파일 scripts/ci-pipeline-semantics-check.mjs
## P2182 - v59.52 - AI 지연 스크립트 로드 실패 전에 질문 초안이 비워짐 · 원칙 C5 · 교훈 C5 입력 수명주기, P2105 질문 보존과 P2171 중복 전송 방지 · 파일 scripts/ci-pipeline-semantics-check.mjs
## P2181 - v59.52 - 의미 검사 영역 오타가 0건 PASS로 통과 · 원칙 C3 · 교훈 C3 검증은 실제 결과를 증명한다 · 파일 scripts/ci-pipeline-semantics-check.mjs
## P2180 - v59.52 - 시나리오 동률 진입·해소·구성원 변경이 기록에서 누락 · 원칙 C10, R734 · 교훈 C10 한 지표에는 한 원천과 한 표시 owner, R734 공용 함수와 재현 · 파일 scripts/ci-pipeline-semantics-check.mjs
## P2179 - v59.52 - 작은 추세 비중을 보유 종목 없음으로 표시 · 원칙 C7 · 교훈 C7 읽는 문장은 관측과 근거만 말한다 · 파일 scripts/ci-pipeline-semantics-check.mjs
## P2178 - v59.52 - AI 종목 검색이 정본 지표의 사용 제한과 기준일을 버림 · 원칙 C8, C10 · 교훈 C8 결측은 값이 아니다, C10 한 지표에는 한 원천과 한 표시 owner · 파일 scripts/ci-pipeline-semantics-check.mjs
## P2177 - v59.51 - AI 패널을 열면 페이지가 눌려 표가 잘리고, 휴대폰 포트폴리오 저장 버튼이 하단 탭 아래에 깔림 · 교훈 AGENTS 데스크톱·모바일 반응형 지원(44px 터치 대상).
## P2176 - v59.51 - 재무 공시 매출·순이익 막대의 값 이름표가 겹치고 마지막 것이 잘리며, 날짜 축이 중간에서 끊김 · 교훈 AGENTS 데스크톱·모바일 반응형 지원. · 파일 scripts/ci-fiscal-quality-fixture.mjs
## P2175 - v59.51 - 주말 홈에서 선물 칩과 장 연결 문장이 서로 다른 선물 값을 보여 줌 · 교훈 AGENTS 종가 기준 점수 — 한 화면 안에서 같은 시장 값이 둘이면 안 된다. · 검사 ci-esm-core-unit-check, ci-runtime-contract-check
## P2174 - v59.51 - 종목의 차트·재무 공시 탭 주소에서 종목(sym)이 빠져 새로고침하면 '종목 선택 전'이 됨, 차트 제목은 'SPY 일봉' · 교훈 AGENTS 티커 추정 금지 — 화면이 다른 종목을 이름으로 보여 주면 안 된다. · 파일 src/app/router.js
## P2173 - v59.51 - 용어 표시 대상 네 개가 이름이 바뀐 사전 항목을 가리켜 근원 물가·PCE·50/200일선에 용어 설명이 붙지 않음 · 교훈 AGENTS 초보 사용자 이해 — 전문 용어는 사전 표시를 단다.
## P2172 - v59.51 - 시장 상태 첫 화면이 홈의 '혼조'와 달리 '판정 대기'로 오래 남고, '지수 차트 보기' 링크가 차트 두 화면 위에 떨어짐 · 교훈 AGENTS 판정은 종가 기준 하나 — 두 화면이 같은 판정을 보여야 한다. · 검사 ci-secondary-text-budget
## P2171 - v59.51 - AI 질문창: Enter 두 번이면 같은 질문이 두 번 전송되고, HTML 모양 입력의 일부가 말풍선에서 사라짐 · 원칙 R724 · 교훈 R724의 비용 원칙(AI는 월 $20 목표) — 같은 질문이 두 번 과금되면 안 된다. · 검사 ci-ai-chat-reliability-contract-check · 파일 js/aio-chat.js, src/app/chat-loader.js, scripts/ci-ai-chat-reliability-contract-check.mjs
## P2170 - v59.51 - 같은 날 반도체(SMH)·미 10년물 변화가 한 화면 안에서 두 값으로 나옴 · 원칙 R734 · 교훈 R734: 같은 수치는 하나의 공용 함수에서 읽는다. · 파일 scripts/fixtures/pipeline-semantics/market.mjs, scripts/ci-pipeline-semantics-check.mjs
## P2169 - v59.51 - 조건 충족 수가 같은 두 시나리오를 화면마다 다르게 '선두'로 표시함 · 원칙 R734 · 교훈 R734: 반복 클래스는 공용 함수로 닫는다(같은 판정을 화면마다 따로 계산하지 않는다). · 검사 ci-fiscal-quality-fixture · 파일 scripts/fixtures/pipeline-semantics/market.mjs, scripts/ci-pipeline-semantics-check.mjs
## P2168 - v59.51 - 느린 휴대폰에서 첫 로딩 중 하단 탭을 누르면 아무 반응 없이 사라짐 · 교훈 AGENTS 데스크톱·모바일 반응형 지원(2026-10-11 재승인) — 휴대폰에서 첫 동작이 반응해야 한다. · 파일 index.html, js/aio-core.js, scripts/ci-csp-meta-check.mjs
## P2167 - v59.50 - 시장 상태의 선택지 득실과 테마 반등 문장이 '분할 접근은 … 확인된 뒤가 맞습니다'처럼 시점을 지시함 · 원칙 R724, R734 · 교훈 R724(앱은 시점을 고르지 않는다), R734(신규): 반복 클래스는 전 표면 스캔으로 닫는다. · 검사 ci-instruction-text-ratchet-check · 파일 src/domain/market/macro-crossroads.js, src/domain/scenarios/theme-playbook.js, scripts/lib/instruction-text-scan.mjs
## P2166 - v59.49 - 국채 2s10s가 다른 날짜의 FRED 스프레드를 같은 날짜 스프레드로 표시할 수 있고, 장기 거시 카드가 월간 값을 '월평균'이라 부름 · 교훈 없음(다른 시점 값을 같은 날짜로 표시하는 반복 클래스). · 파일 src/domain/macro/treasury-curve.js, src/domain/macro/long-history.js
## P2165 - v59.49 - 종목 화면 차트 도구가 손절·목표 가격을 계산하고, 비교표·손익 색·차트 전환이 사실과 다르게 보임 · 원칙 R724 · 교훈 R724(차트 코치), 고정 개수 창 반복 클래스(비교표·테마 창), 현재처럼 보이는 오래된 값(캐시).
## P2164 - v59.49 - AI 시황 검증기가 부분 문자열·지수 이름의 숫자·결측 등락률로 맞는 문장을 막고 틀린 문장을 통과시킴 · 교훈 없음(부분 문자열·결측→0 반복 클래스, BUG-POSTMORTEM 반복 클래스 표). · 검사 ci-market-analysis · 파일 scripts/lib/market-analysis-validate.mjs, scripts/build-market-snapshot.mjs
## P2163 - v59.49 - 데이터 전용 커밋의 CI가 자료 내용·생산자 순서·벽시계에 따라 실패해 데이터 반영이 멈춤 · 원칙 R733, R721 · 교훈 R733(이번 버전): 시간·자료 경계를 다루는 게이트는 고정 시계·고정 입력으로 증명한다. R721: 데이터 전용 커밋은 데이터 검사로 인증한다.
## P2162 - v59.49 - 시세 세션 분류가 RUT 16:30 종가·일요일 재개장·월요일 개장 직후를 잘못 분류해 데이터 갱신이 반복 실패함 · 원칙 R733 · 교훈 R733(신규): 시간 경계 코드는 고정 시계와 시간표 전수 검사로 증명한다. · 검사 ci-market-snapshot-contract-check · 파일 scripts/build-market-snapshot.mjs, scripts/lib/market-session-sweep.mjs
## P2161 - v59.48 - 데이터 감시(watchdog)가 다른 워크플로의 실패를 다시 빨간불로 올려 자기 신호를 잃음 · 교훈 없음(신호 중복 설계 결함): 한 신호에 소유자가 둘이었다. · 검사 ci-codex-structure-regression-fixture · 파일 scripts/ci-codex-structure-regression-fixture.mjs
## P2160 - v59.48 - 실적 브리프 파일이 크기 상한 없이 자라 다음 용량 장애로 가던 중 · 교훈 없음(용량 설계 결함): 보관 기간만 있고 크기 상한이 없었다.
## P2159 - v59.48 - 주말 홈 시세 칩이 토요일 스냅숏 행을 마감일로 읽음 · 교훈 없음(같은 사실을 두 경로로 읽은 결함)
## P2158 - v59.48 - 실적 브리프가 공시 영문 단위와 문장을 그대로 보여 주고 라벨과 값이 붙어 읽힘 · 교훈 없음(표시 언어 결함): 한국어 UI에 영문 단위가 노출됐다.
## P2157 - v59.48 - 실적 브리프의 EPS 서프라이즈가 GAAP 실적을 조정(비GAAP) 컨센서스와 비교함 · 교훈 없음(비교 기준 불일치 결함): 서로 다른 회계 기준의 값을 비교했다. · 파일 src/domain/briefing/event-briefs.js · 관련 P21
## P2156 - v59.47 - SEC 런타임 투영이 1 MiB 상한을 다시 넘어 스크리너·SEC 갱신이 하루 넘게 멈춤 · 교훈 없음(규칙 위반이 아닌 용량 설계 결함): 상한에 닿을 때마다 필드를 손으로 빼는 대응이 반복됐다. · 파일 src/data/contracts/sec-projection.js, scripts/ci-pipeline-semantics-check.mjs
## P2155 - v59.46 - 현금 조건이 빈 설비투자를 설비투자 0%로 읽음 · 원칙 R3 · 교훈 R3: 빠진 값은 0이 아니다(P2141 클래스). · 파일 scripts/ci-pipeline-semantics-check.mjs, scripts/ci-shared-primitive-ratchet-check.mjs
## P2154 - v59.46 - 점수 상대화 실험이 현행 모델과 통제 비교가 아니었음 · 원칙 R3 · 교훈 R3: 비교 실험은 비교 변인 외의 경로를 공유한다. · 파일 scripts/backtest-trading-score-longrun.mjs, scripts/ci-pipeline-semantics-check.mjs
## P2153 - v59.46 - 옵션 질문이 아무 도구도 제공하지 않는 'options' 근거를 요구함 · 원칙 R3 · 교훈 R3: 퇴역한 기능을 가리키는 소비자 경로를 남기지 않는다. · 파일 scripts/ci-pipeline-semantics-check.mjs, scripts/ci-ai-intelligence-contract-check.mjs · 관련 P11
## P2152 - v59.46 - 미국 스크리너가 이번 실행에서 받지 못한 종목의 직전 행을 지움 · 원칙 R3 · 교훈 R3: 실패한 수집은 마지막 정상 자료를 지우지 않는다(P2143 클래스). · 파일 scripts/ci-pipeline-semantics-check.mjs, scripts/validate-screener-artifact.mjs
## P2151 - v59.46 - 차트 매매 방식 렌즈가 이 종목 가격을 손절·목표 칸에 넣고 '일부 정리'를 지시함 · 원칙 R724 · 교훈 R724: 앱은 종목·가격·비중·시점을 고르지 않고, 고르는 법을 가르친다. · 파일 scripts/ci-pipeline-semantics-check.mjs, scripts/ci-esm-core-unit-check.mjs · 관련 P24
## P2150 - v59.45 - 게이트가 다음 정상 13F 갱신을 막고, 지식 helper 변경에서 선택되지 않으며, 바뀐 동작에 맞춘 고정 단언이 남음 · 원칙 R603 · 교훈 R603: 생성물은 고빈도 데이터 refresh가 바꾸는 휘발값을 고정하지 않는다. · 파일 scripts/lib/knowledge-authoring-contract.mjs, scripts/ci-masters-contract-check.mjs, scripts/ci-pipeline-semantics-check.mjs
## P2149 - v59.45 - 병합·저장·가져오기에서 정보가 조용히 사라지거나 성공으로 보고됨 · 원칙 R3, R2, R576 · 교훈 R576: 앱·지식·금융 계산의 경계는 종료·관계 의미·결측·비용 의미를 보존한다. · 파일 scripts/ci-pipeline-semantics-check.mjs · 관련 P29, P27, P20
## P2148 - v59.45 - AI 공개 경계가 무관한 근거와 인용 뒤 지시를 통과시키고 출처 결속을 일부로 전체를 판정함 · 원칙 R687 · 교훈 R687: AI 문맥의 현재 수치는 화면과 같은 기준. · 파일 scripts/ci-pipeline-semantics-check.mjs · 관련 P11, P12, P13
## P2147 - v59.45 - 통화·단위·금액 의미가 계산 중에 바뀜 (매출 예상 대비 -100% 공개 자료 포함) · 원칙 R2, R584 · 교훈 R584: 사용자 표면은 결측·선택·통화·렌더러 소유권을 producer 계약 그대로 보존한다. · 파일 public-data/event-briefs.json, scripts/ci-pipeline-semantics-check.mjs · 관련 P21, P13, P23, P19, P22, P18
## P2146 - v59.45 - 부분 문자열 매칭이 종목·주제·출처·질문 의도를 잘못 붙임 · 원칙 R3, R4, R730 · 교훈 R730: 뉴스 키워드 목록은 하나의 규칙(keyword-match.js)으로만 비교한다. · 파일 scripts/ci-pipeline-semantics-check.mjs · 관련 P20, P11
## P2145 - v59.45 - 캐시·식별 키가 내용 변경과 검증 실패를 보지 못함 · 원칙 R571 · 교훈 R571: 요청·캐시·수집 시도·실제 관측의 수명주기를 분리한다. · 파일 js/aio-core.js, scripts/ci-pipeline-semantics-check.mjs · 관련 P25, P20, P30
## P2144 - v59.45 - 동률·반올림 0·확인 불가를 1위·방향·'조건 맞지 않음'으로 서술함 · 원칙 R4, R1, R586 · 교훈 R586: 결측 팩터는 중립값이 아니며 순위 분모를 희석하지 않는다. · 파일 scripts/ci-pipeline-semantics-check.mjs · 관련 P19, P25, P26
## P2143 - v59.45 - 실패하거나 일부만 된 수집이 성공·전체로 기록되거나 이전 정상 자료를 지움 · 원칙 R2, R3, R545 · 교훈 R545: 관측 생략·실패·유효기간 내 LKG를 서로 다른 운영 상태로 보존한다. · 파일 scripts/ci-pipeline-semantics-check.mjs · 관련 P15, P28
## P2142 - v59.45 - 미래·진행 중·다른 세션의 관측이 '현재'로 쓰이고 서로 다른 기간 값을 같은 기간으로 비교함 · 원칙 R1, R2, R683 · 교훈 R683: 기간·기준일 라벨은 계산에서 파생한다. · 파일 scripts/ci-pipeline-semantics-check.mjs · 관련 P16, P23, P26
## P2141 - v59.45 - 빠진 값이 0·보합·충족으로 읽혀 화면과 판정에 들어감 (파이프라인 의미 검토 결측 클래스) · 원칙 R2, R628 · 교훈 R628: 결측은 조건도 구간도 관측값도 만족시키지 않는다 — 경계에서 Number(null)===0을 먼저 막는다. · 검사 ci-pipeline-semantics-check · 파일 scripts/ci-pipeline-semantics-check.mjs
## P2140 - v59.44 - 예전 출처의 '왜 움직였나' 문장이 남아 회사 IR·유료 매체 근거와 이유 없는 문장이 보임 · 원칙 R618 · 교훈 R618: 원천 형식 가정은 실제 표본으로 검사한다. · 검사 ci-event-briefs-check · 파일 scripts/ci-event-briefs-check.mjs
## P2139 - v59.44 - AI 질문이 첫 질문 뒤로 계속 실패함 · 원칙 R596 · 교훈 R596: 바이트 계약은 바이트로 잰다. · 검사 ci-ai-chat-reliability-contract-check · 파일 js/aio-chat.js, worker/openai-budget.mjs, scripts/ci-ai-chat-reliability-contract-check.mjs
## P2138 - v59.44 - GAAP 주당순이익을 조정 기준 컨센서스와 비교해 큰 미달처럼 보임 · 원칙 R618 · 교훈 R618: 비교는 같은 기준끼리만 한다. · 검사 ci-event-briefs-check · 파일 scripts/fetch-event-briefs.mjs, scripts/ci-event-briefs-check.mjs
## P2137 - v59.44 - 실적 요약 제목이 영어 보도자료 제목이거나 '실적 발표'뿐임 · 원칙 R618 · 교훈 R618: 화면 문장은 한국어 계약을 생산 단계에서 검사한다. · 검사 ci-event-briefs-check · 파일 scripts/fetch-event-briefs.mjs, src/domain/briefing/event-briefs.js, scripts/ci-event-briefs-check.mjs
## P2136 - v59.44 - 삼성전자 실적 공시를 읽지 못해 주요 발표 요약에서 빠짐 · 원칙 R618 · 교훈 R618: 원천 형식 가정은 실제 공시 표본으로 검사한다. · 검사 ci-event-briefs-check · 파일 src/domain/briefing/event-briefs.js, scripts/ci-event-briefs-check.mjs
## P2135 - v59.43 - 10/28 FOMC 결과가 수기 레지스트리에 없어 시장 데이터 갱신이 13시간 넘게 게시 차단 · 교훈 느린 데이터 정적화·소유자 확인(AGENTS) — 일정이 정해진 수기 참조의 갱신 시점을 지키지 못함 · 검사 ci-data-refresh-audit, ci-manual-reference-expiry · 파일 js/aio-core.js
## P2134 - v59.43 - 투자 심리: 풋/콜 비율 1.1 이상을 '하락 대비 수요'로 단정하고, VIX9D > VIX 앞쪽 역전을 콘탱고로 표시 · 교훈 근거 없는 판정 금지(AGENTS) — 관측이 구분하지 못하는 방향을 라벨이 단정 · 검사 ci-esm-core-unit-check, ci-architecture-contract-check
## P2133 - v59.43 - 재무 보고서: 없는 EPS가 $0.00과 Beat/Miss로, 순부채 미수신이 0으로 계산됐다 · 원칙 R257 · 교훈 AGENTS: 없는 값은 0이 아니다(P1164 계열). XSS 방어(R257 계열). · 파일 js/aio-ui.js, js/aio-core.js
## P2132 - v59.43 - 시장 분석 대체 문장이 시장 상태 화면과 반대 판정을 냈다 (리스크 낮음·환경 양호 vs 혼조) · 교훈 AGENTS: 한 판정에 한 소유자. 근거 없는 등급 금지. · 파일 js/aio-core.js, src/domain/market/market-regime.js, js/aio-tests.js
## P2131 - v59.43 - AI 질문 분류의 영어 단서가 부분 문자열로 걸렸다 ('operating'에 per, 'know'에 now, 'threshold'에 hold) · 원칙 R730 · 교훈 R730(키워드는 하나의 규칙으로 비교) 정신. S1 부분 문자열 매칭 클래스. · 검사 ci-esm-core-unit-check · 파일 js/aio-chat.js, js/aio-core.js, src/ai/intent/question-cues.js, src/domain/news/keyword-match.js, scripts/ci-esm-core-unit-check.mjs
## P2130 - v59.43 - 현재성 가드가 시장 심리 화면의 native 종합 문단에 '혼합 출처 분석, 보조 참고용' 툴팁과 참고용 표시를 달았다 · 교훈 S1 부분 문자열 매칭 클래스(레거시 감사): id 부분 일치로 대상을 고르면 다른 소유자의 요소를 건드린다. · 검사 ci-runtime-contract-check · 파일 js/aio-core.js, scripts/ci-runtime-contract-check.mjs, js/aio-tests.js
## P2129 - v59.43 - 포트폴리오: 진입마다 '(시세 미수신)' 행이 잠깐 보이고, 관심 종목 목록 하나가 다음 저장 때 사라짐 · 교훈 AGENTS: 한 데이터에 한 소유자. 같은 키에 쓰는 코드가 둘이면 규칙이 갈린다. · 검사 ci-esm-core-unit-check · 파일 js/aio-workspace.js, src/data/watchlist-store.js, scripts/ci-esm-core-unit-check.mjs, src/ui/pages/portfolio.js
## P2128 - v59.43 - 텔레그램 피드 카드가 채널 이름을 이스케이프 없이 HTML에 넣고, 머리글 'N건'이 화면 상한으로 자른 뒤의 수 · 교훈 외부 텍스트는 HTML에 넣기 전 이스케이프한다; 화면 수치는 무엇을 센 것인지 밝힌다. · 검사 ci-data-pipeline-contract-check · 파일 js/aio-data.js
## P2127 - v59.43 - 코스닥·코스피 격차 문구가 그날 방향을 무시 · 교훈 화면 문장은 그날 숫자의 방향을 그대로 따른다(데이터 정직성). · 검사 ci-esm-core-unit-check · 파일 src/domain/market/session-bridge.js, scripts/ci-esm-core-unit-check.mjs
## P2126 - v59.43 - AI 채팅의 텔레그램 글 관련성이 부분 문자열이라 '엔비디아' 질문에 엔화 글이, 'ai'가 'said' 안에서 맞음 · 원칙 R730 · 교훈 R730 · 검사 ci-esm-core-unit-check · 파일 js/aio-chat.js, src/domain/news/selection.js
## P2125 - v59.43 - 텔레그램 종목 메모가 영어 회사명을 부분 문자열로 맞춰 'ARM'이 'alarm' 안에서 맞음 · 원칙 R730 · 교훈 R730 (키워드 하나의 규칙) — 회사명 매칭에도 같은 경계 규칙. · 검사 ci-data-pipeline-contract-check · 파일 js/aio-data.js
## P2124 - v59.43 - 뉴스 선별 점검의 화면별 적격 수가 늘 0이라 뉴스 화면 출처 표시가 기사 수와 무관하게 '스냅샷'에 고정 · 교훈 AGENTS: 화면 라벨은 실제 상태에서 파생한다 — 죽은 전역 호출이 라벨을 고정했다. · 검사 ci-esm-core-unit-check · 파일 js/aio-core.js, src/app/news-selection-entry-points.js
## P2123 - v59.43 - 서버 뉴스 규칙이 "won't"를 원화로, 지지율(approval rating)을 애널리스트 등급으로, "margin for error"를 마진으로 셈 · 원칙 R730 · 교훈 R730 정신(키워드 오탐을 측정으로 찾고 규칙 하나로 고친다)을 서버 채점기에도 적용 — 서버 규칙은 별도 정규식 집합이다. · 검사 ci-codex-structure-regression-fixture · 파일 scripts/lib/news-selection.mjs
## P2122 - v59.42 - 추세 지지선 이름이 숫자 앞에 유니코드 마이너스를 써서 오늘 화면 문장에 '200일선−1%'가 나감 · 교훈 R-부호 규칙(RULES: 화면에 나가는 부호 있는 숫자는 ASCII 마이너스, 숫자 앞 U+2212 금지). · 검사 ci-rendered-copy-lint-check · 파일 src/domain/briefing/market-read.js, scripts/ci-rendered-copy-lint-check.mjs
## P2121 - v59.42 - 레거시 화면 결함 3건: 한국 테마 시총 칸이 늘 '—', 예전 포트폴리오 표의 손실 부호 누락, Ctrl/Cmd+R 새로고침 가로채기 · 교훈 AGENTS: 원천 없는 위젯 제거, 근거 없는 대체값 금지. · 파일 src/data/providers/naver-kr.js, js/aio-kr-data.js, js/aio-workspace.js, js/aio-ui.js
## P2120 - v59.42 - 부팅 중 서비스 워커 버전 응답이 아직 설치되지 않은 updateDataStatus를 불러 'updateDataStatus is not defined' · 원칙 R731 · 교훈 R731 · 검사 ci-runtime-contract-check · 파일 js/aio-data.js, src/ui/components/data-status-surface.js, src/app/bootstrap.js, scripts/ci-runtime-contract-check.mjs
## P2119 - v59.42 - 거시·금리가 장중 Yahoo 금리·VIX를 FRED 공식 값으로 표시 — Yahoo→FRED 브릿지 퇴역 · 교훈 AGENTS: 종가 기준 점수와 출처 정직성. 공식 시계열 칸에 다른 원천 값을 넣지 않는다. · 검사 ci-runtime-contract-check · 파일 src/ui/pages/market.js, js/aio-data.js, scripts/ci-runtime-contract-check.mjs, js/aio-tests.js
## P2118 - v59.42 - AI 질문이 브라우저 자체 하루 20회 한도에서 확인창으로 막힘 — 실제 한도는 Worker의 연결당 150회 · 교훈 AGENTS: AI는 공용 Worker로 항상 사용(월 $20 목표). 한도는 Worker가 소유한다. · 검사 ci-ai-chat-reliability-contract-check · 파일 js/aio-ui.js, scripts/ci-ai-chat-reliability-contract-check.mjs
## P2117 - v59.42 - 뉴스 키워드 목록마다 비교 규칙이 달라 부분 문자열 오탐이 점수·제외를 바꿈 — 뉴스 채점·선별을 src/domain/news 한 곳으로 이전 · 원칙 R730 · 교훈 AGENTS 정보구조: 병합마다 레거시 js/ 소유를 src/로 옮기고 대체된 코드를 지운다. 같은 결함 클래스(P1428, P2116)가 목록별로 반복됐다. · 검사 ci-esm-core-unit-check, ci-architecture-contract-check · 파일 js/aio-data.js, src/domain/news/keyword-match.js, src/domain/news/selection-keywords.js, src/domain/news/selection.js, src/app/news-selection-entry-points.js, scripts/fixtures/expect/news-selection.cases.mjs
## P2116 - v59.42 - 뉴스 제외 목록이 영어 키워드를 부분 문자열로 비교해 inflation 기사 등을 버림 · 교훈 제외 필터는 의도한 단어에만 걸려야 한다 — 시장 핵심 기사를 조용히 버리지 않는다. · 검사 ci-esm-core-unit-check · 파일 js/aio-data.js, src/data/providers/telegram-direct.js, scripts/ci-esm-core-unit-check.mjs
## P2115 - v59.42 - 리뷰어 평가가 짚은 화면 결함 4건: 홈 헤드라인 1건만 표시, 지금 시세 관측 시각, 테마 색/부호, 포트폴리오 쉼표 · 교훈 화면 문장·색·시각은 화면에 찍힌 값과 같은 근거를 따른다(같은 값 같은 판정). · 검사 ci-rendered-copy-lint-check · 파일 js/aio-data.js, js/aio-tests.js
## P2114 - v59.42 - AI 매매 지시 차단이 소수점 가격(177.50달러)이 든 지시를 통과시킴 · 원칙 R698 · 교훈 R698: 화면과 AI는 개인 매매 지시(가격·수량·시점)를 내지 않는다. · 검사 ci-ai-intelligence-contract-check · 파일 src/ai/response/request-pipeline.js, scripts/ci-ai-intelligence-contract-check.mjs
## P2113 - v59.42 - qa-runner --files가 공백으로 나눈 경로를 첫 번째만 남기고 조용히 버림 · 원칙 R618 · 교훈 R618: 강제는 게이트 실행·보고 형식에 둔다 — 게이트 선택이 조용히 좁아지면 보고가 사실과 달라진다. · 검사 ci-qa-runner-behavior-check · 파일 scripts/qa-runner.mjs, scripts/ci-expect-output-check.mjs, scripts/ci-qa-runner-behavior-check.mjs
## P2112 - v59.39 - Pages 배포가 자기 실행을 queued로 읽어 배포 후 검증에서 실패 · 교훈 P1351: 현재 Pages 배포 실행만 진행 중 예외를 받는다(이번엔 그 예외가 API 상태 하나만 알았다). · 검사 ci-cloudflare-deployment-contract-check · 파일 scripts/deployment-provenance.mjs, scripts/ci-cloudflare-deployment-contract-check.mjs
## P2111 - v59.37 - 홈 금 등락이 반올림하면 0인데 -0.00%로 표시 · 원칙 R2 · 교훈 v58.80 first-users R2-27: 색과 부호는 찍힌 숫자를 따른다. · 검사 ci-rendered-copy-lint-check · 파일 js/aio-data.js, src/domain/shared/number.js, scripts/ci-rendered-copy-lint-check.mjs
## P2110 - v59.27 - 운영 7일 기록이 저장소에 쌓이지 않아 실시간 시세 soak가 영원히 0일 · 원칙 R603 · 교훈 R603 데이터 갱신 범위 상태와 운영 증거의 단일 출처 · 검사 ci-operations-slo-window-check · 파일 public-data/operations-slo-window.json, scripts/ci-operations-slo-window-check.mjs
## P2109 - v59.24 - 08:00 KST 시황이 사흘 전 WTI 종가로 시작 · 교훈 완료 종가는 그 세션 날짜로만 쓴다(v57.81 종가 세션 규칙) · 검사 ci-esm-core-unit-check · 파일 scripts/ci-esm-core-unit-check.mjs, scripts/ci-data-pipeline-contract-check.mjs
## P2108 - v59.23 - 바쁜 페이지에서 도착한 자료 응답을 시간 초과로 버림 · 교훈 타임아웃은 네트워크가 느린 것과 페이지가 바쁜 것을 구분해야 한다(밀려서 늦게 실행된 타이머로 도착한 응답을 버리지 않는다). · 검사 ci-artifact-cache-check
## P2107 - v59.21 - 스크리너 실행 보관 목록이 '불러오는 중'에 멈춤 · 교훈 정적 DOM에 남기는 진행 표시는 그 작업을 버리는 정리 단계에서 함께 지워야 한다. · 검사 ci-screener-auto-refresh-browser-check
## P2106 - v59.21 - 현금 저장이 입력한 금액 대신 저장돼 있던 금액을 저장함 · 교훈 지연 로드를 기다리는 입력 처리기는 기다리기 전에 입력값을 떠 둬야 한다(기다리는 동안 DOM이 다시 그려질 수 있다). · 검사 ci-portfolio-vault-e2e
## P2105 - v59.17 - 지연 로드된 AI 패널이 미리 채운 질문을 지움 · 교훈 지연 로드 브리지는 로드 전 호출을 로드 후와 같은 결과로 재생해야 한다(호출 사이의 DOM 상태 포함). · 검사 ci-ai-chat-public-route-browser-check · 파일 src/app/chat-loader.js
## P2104 - v59.08 - 시장 상태 추이 차트의 '기록 이전' 라벨이 좁은 빈 구간에서 y축 숫자와 겹침 · 교훈 차트 라벨은 이웃 라벨과 겹치지 않는다(viewport matrix svg text overlap). · 파일 src/ui/components/trend-chart.js
## P2103 - v58.84 - 테마 연구 브라우저 게이트가 CDN에 의존해 외부망이 막힌 환경에서 30초 시간 초과로 실패 · 교훈 브라우저 게이트는 고정 입력으로 재현 가능해야 한다(remote-blocked 네트워크 정책). · 파일 scripts/ci-theme-research-browser-check.mjs
## P2102 - v58.84 - 운영 알림이 깜빡이는 레인마다 닫혔다 다시 열려 알림이 쌓임 · 교훈 operations-slo 연속 2회 실패 알림 기준과 대칭인 복구 기준이 없었다. · 검사 ci-workspace-contract-check · 파일 scripts/ci-workspace-contract-check.mjs
## P2101 - v58.82 - 공용 Worker 오류 응답에 키 흔적이 남을 수 있음 · 원칙 R636 · 교훈 R636 비밀값은 어떤 출력에도 마스킹되어 나간다 — Worker 응답에도 같은 원칙 · 파일 worker/openai-contract.test.mjs
## P2100 - v58.82 - 수능일·개장일 KRX 시간 변경이 캘린더에 없음 · 원칙 R447 · 교훈 R447 거래 시간은 등록된 연간 캘린더에서만 온다 · 검사 ci-market-session-contract-check · 파일 scripts/ci-market-session-contract-check.mjs
## P2099 - v58.82 - 전각 티커·잘못된 목표가·손상된 관심목록 저장소 처리 · 교훈 입력 폼은 거절 이유를 그 칸에서 알린다; 저장 실패는 조용히 버리지 않는다. · 검사 ci-esm-core-unit-check · 파일 scripts/ci-esm-core-unit-check.mjs
## P2098 - v58.82 - 휴장일·주말·시간대 경계에서 날짜와 신선도가 틀림 · 교훈 신선도는 원천의 발행 주기 기준(AGENTS Freshness); 다른 지표의 숫자를 공식 계열 자리에 넣지 않는다. · 검사 ci-esm-core-unit-check · 파일 scripts/ci-esm-core-unit-check.mjs
## P2097 - v58.82 - 부분 실패가 좋은 자료를 덮거나 캐시를 무시함 · 교훈 생산자는 실패 시 마지막 정상 자료를 유지한다; 오류 응답은 오프라인과 같이 취급한다. · 검사 ci-esm-core-unit-check · 파일 sw.js, scripts/ci-esm-core-unit-check.mjs
## P2096 - v58.82 - 같은 IP를 쓰는 가족이 동시에 검색 답변을 받으면 네 번째 질문이 거절됨 · 교훈 공유 IP 가구(제품 대상: 가족·지인)가 정상 사용 중 거절되지 않아야 한다. · 파일 worker/openai-contract.test.mjs
## P2095 - v58.82 - 두 탭에서 포트폴리오를 고치면 나중 탭이 다른 탭의 변경을 지움 · 교훈 저장소 사본이 더 새로우면 오래된 메모리 사본으로 덮어쓰지 않는다. · 파일 js/aio-workspace.js
## P2094 - v58.82 - 외부 뉴스 제목과 가져온 백업의 통화 코드가 마크업으로 렌더링됨 · 교훈 외부 텍스트는 렌더링 지점에서 이스케이프한다; 가져오기는 입력 폼과 같은 규칙으로 검증한다. · 검사 ci-esm-core-unit-check · 파일 js/aio-kr-data.js, scripts/ci-esm-core-unit-check.mjs
## P2093 - v58.81 - 13F 레인의 파일 크기 초과가 시장 데이터 갱신 전체를 막음 · 원칙 R603 · 교훈 R603 (데이터 갱신 범위의 상태는 레인별로 격리) · 파일 public-data/masters/filings.json, scripts/ci-artifact-size-headroom-check.mjs
## P2092 - v58.80 - 이름을 입력하고 바로 Enter로 고르면 고른 종목의 후보 버튼이 검색칸 아래에 다시 생겼다 · 원칙 R726 · 교훈 R726
## P2091 - v58.80 - 한국 장 마감 뒤 상단 시세 칩이 '서버 10/23 마감, 시세 16종 · 한국 10/26 마감'으로 한국 마감을 종목 수 뒤에 붙였다 · 원칙 R726 · 교훈 R726 · 검사 ci-architecture-browser-check
## P2090 - v58.80 - 번역이 실패한 때 봉인된 시간대 묶음의 해외 헤드라인이 이틀 동안 영어로 남았다 · 원칙 R726 · 교훈 R726 · 검사 ci-esm-core-unit-check · 파일 scripts/fetch-data.mjs
## P2089 - v58.80 - 느린 3G 휴대폰에서 오늘 판정이 43초 뒤에야 보였고, 늦게 그려진 지수 카드·탭 줄이 읽던 화면을 밀었으며, 준비 전 탭은 무시됐다 · 원칙 R622, R726 · 교훈 R726 · 검사 ci-esm-core-unit-check, ci-version-check · 파일 js/aio-core.js, public-data/today-verdict.json
## P2088 - v58.80 - 종목 요약의 재무 칸이 SEC 기록을 받은 뒤에도 10~15초 동안 '불러오는 중'으로 되돌아갔다 · 원칙 R726, R728 · 교훈 R726
## P2087 - v58.80 - 같은 화면의 숫자가 서로 다른 기준·범위로 읽혔다: 반도체 카드 종목, 상대강도 기준, 유가 거리 단위, 맞춤 조건 결과 범위 · 원칙 R726 · 교훈 R726 · 검사 ci-esm-core-unit-check
## P2086 - v58.80 - 종목 검색이 한글 이름 후보를 숨겼고, 최근 검색·화면 이동 뒤 설명·확인 창이 고른 것과 다르게 움직였다 · 원칙 R726 · 교훈 R726 · 검사 ci-esm-core-unit-check
## P2085 - v58.80 - 산업 지도에서 뒤로 가기가 리서치 라이브러리를 떠났고, 떠 있는 설명 세 종류가 함께 열리거나 스크롤 중 저절로 열렸다 · 원칙 R723 · 교훈 R723 · 검사 ci-esm-core-unit-check · 파일 src/ui/components/popover.js
## P2084 - v58.80 - 스크리너 맞춤 조건 문장이 'RSI 30 이하', '3개월 수익률 20% 이상'을 알아듣지 못했다 · 원칙 R723 · 교훈 R723 · 검사 ci-esm-core-unit-check · 파일 scripts/ci-esm-core-unit-check.mjs
## P2083 - v58.80 - 지수 카드가 실패 뒤 다시 '불러오는 중'으로 돌아갔고, 가격 시각과 매매일지 날짜가 날짜 없이 또는 UTC로 적혔다 · 원칙 R2, R726 · 교훈 R726
## P2082 - v58.80 - 가격 방향 색이 차트 캔들과 반대였고, 0으로 반올림된 변화와 판정 막대까지 방향 색으로 칠해졌다 · 원칙 R3, R723, R727 · 교훈 R723 · 검사 ci-runtime-contract-check, ci-esm-core-unit-check · 파일 scripts/ci-esm-core-unit-check.mjs, scripts/ci-runtime-contract-check.mjs
## P2081 - v58.80 - 휴대폰·느린 망에서 첫 화면 결론이 늦고, 면책 막대·맨 위로 버튼이 본문을 가렸으며, 로딩 중 상태가 '자료 없음'처럼 읽혔다 · 교훈 AGENTS 제품 결정(데스크톱·모바일·아이패드 반응형 지원) — 휴대폰에서 결론이 늦고 고정 요소가 본문을 가렸다. · 검사 ci-esm-core-unit-check · 파일 index.html
## P2080 - v58.80 - 확인 대화상자의 Enter가 취소로 처리됐고, 관심 종목·뒤로 가기·접기·빈 상태가 사용자가 기대한 동작과 달랐다 · 교훈 P1604 role-button 소유자 규칙의 반대 방향 — 위임 핸들러가 안쪽 네이티브 컨트롤의 기본 동작을 가로챘다.
## P2079 - v58.80 - 같은 숫자가 화면마다 다른 기준·단위·자릿수로 읽혔고, 판정 문구가 지시처럼 읽혔다 · 교훈 AGENTS 제품 결정(종가 기준 점수, 매매 지시 금지) — 같은 값이 화면마다 다른 기준으로 보였고 판정 칩이 행동 지시처럼 읽혔다. · 검사 ci-esm-core-unit-check, ci-fiscal-quality-fixture · 파일 src/domain/shared/number.js
## P2078 - v58.80 - 초보자에게 내부 이름·영어·수식이 그대로 보였고, 관심 종목·검색·스크리너·두 탭·AI 패널의 상태가 서로 어긋났다 · 교훈 AGENTS 협업 원칙(초보자 언어, 원천 텍스트는 화면 밖) — 내부 식별자·제공자명이 본문에 노출됐다. · 검사 ci-esm-core-unit-check · 파일 src/data/watchlist-store.js
## P2077 - v58.80 - 숫자 입력이 말없이 비워지거나 터무니없는 값을 받았고, 휴대폰에서 표·메뉴·버튼이 손에 맞지 않았다 · 교훈 AGENTS 반응형 지원(데스크톱·모바일·아이패드) — 휴대폰 핵심 동작(수정·삭제, 닫기)이 손에 닿지 않았다. · 검사 ci-esm-core-unit-check, ci-portfolio-vault-e2e · 파일 src/domain/shared/numeric-input.js, src/ui/components/input-check.js
## P2076 - v58.80 - 판단 문장이 같은 화면의 근거·그림과 반대로 읽혔다 · 원칙 R726 · 교훈 R726 (한 이름은 한 길이·한 집합) 및 AGENTS 근거 없는 판정 금지 — 문장이 자기 근거와 다른 값을 말했다. · 검사 ci-esm-core-unit-check
## P2075 - v58.80 - 불러오는 중·받지 못함을 '없음'으로 말하는 화면이 남아 있었다 · 교훈 AGENTS 원천 없는 판정 금지 — 응답 전·실패를 '없음'으로 단정했다(P2068 loading≠absence 계열의 잔여). · 검사 ci-esm-core-unit-check · 파일 src/domain/content/data-state.js
## P2074 - v58.80 - 같은 이름의 숫자가 화면마다 다른 길이·집합·반올림으로 계산됐다 · 원칙 R572 · 교훈 R572 (비교는 같은 관측) — 같은 이름이 다른 길이·집합을 가리켰다. · 검사 ci-esm-core-unit-check, ci-fiscal-quality-fixture, ci-scenario-guidance-fixture · 파일 src/domain/market/market-windows.js
## P2073 - v58.80 - 주말에 달러 지수 하루 변화가 금요일 체결가와 금요일 정산가의 차이로 계산됐다 · 원칙 R572 · 교훈 R572 (비교는 같은 관측) — 변화율의 분모가 같은 세션의 다른 값이었다(P545·P1581·P2065와 같은 '다른 기준의 전일 종가' 계열). · 검사 ci-data-pipeline-contract-check, ci-history-field-time-contract · 파일 scripts/producer/quotes.mjs, scripts/ci-data-pipeline-contract-check.mjs
## P2072 - v58.80 - 느린 3G에서 screener.json과 SEC 요약 파일이 8초 제한에 끊겨 처음부터 다시 받기를 반복했다 · 교훈 네트워크 제한 시간은 '연결이 죽었다'를 판정해야 하며, 파일 크기와 회선 속도의 곱을 판정하면 안 된다. · 검사 ci-esm-core-unit-check, ci-artifact-cache-check · 파일 src/platform/http.js, src/data/artifact-cache.js, scripts/ci-esm-core-unit-check.mjs, scripts/ci-artifact-cache-check.mjs
## P2071 - v58.80 - '내 계획 점검'이 잘못된 입력을 거절해도 이전 계산 결과를 새 계획처럼 남겼다 · 교훈 거절된 입력 뒤에는 이전 결과를 현재 결과처럼 보이지 않는다. · 검사 ci-portfolio-vault-e2e · 파일 js/aio-ui.js, scripts/ci-portfolio-vault-e2e.mjs
## P2070 - v58.80 - 종목 화면의 '관심 종목에 추가'가 '추가 요청함'으로 바뀌고 '먼저 워치리스트를 선택하세요'만 남겼다 · 교훈 버튼은 실제 결과만 적는다; 행동을 막을 때는 그 자리에서 할 수 있는 다음 행동을 준다. · 검사 ci-out-of-universe-ticker-browser-check · 파일 js/aio-workspace.js, scripts/ci-runtime-contract-check.mjs
## P2069 - v58.80 - 없는 티커(AAPLL, SIVB, -100)를 검색하면 메모·관심 종목·AI 버튼이 있는 종목 화면이 열렸다 · 교훈 티커 추정 금지 — 입력 경로마다 같은 상장 확인 소유자를 쓴다. · 검사 ci-out-of-universe-ticker-browser-check · 파일 js/aio-core.js, scripts/ci-runtime-contract-check.mjs
## P2068 - v58.80 - 느린 연결에서 아직 도착하지 않은 자료를 '없음·보류'라는 최종 판정으로 보여 줬다 · 교훈 로딩 중과 자료 없음은 다른 상태다; 최종 판정 문구는 자료가 도착한 뒤에만 쓴다. · 검사 ci-runtime-contract-check · 파일 scripts/ci-runtime-contract-check.mjs
## P2067 - v58.80 - 거시 머리말의 다음 발표 날짜(10/28 FOMC)가 본문의 한국 시각(10/29 03:00)과 하루 어긋났다 · 교훈 같은 일정은 한 시계(한국 시각)로 화면마다 같은 날짜를 적는다. · 검사 ci-runtime-contract-check · 파일 js/aio-core.js, scripts/ci-runtime-contract-check.mjs
## P2066 - v58.80 - 원화 매수 단가로 넣은 한국 종목이 달러($70,000.00)로 저장·표시됐다 · 교훈 화면에 보이는 단위와 저장되는 단위는 한 출처에서 정한다. · 검사 ci-portfolio-vault-e2e · 파일 js/aio-workspace.js, scripts/ci-runtime-contract-check.mjs
## P2065 - v58.80 - WTI·브렌트유 만기 직전 며칠 동안 하루 변화율이 서로 다른 월물을 나눠 계산됐다 · 원칙 R572 · 교훈 R572 (비교는 같은 관측) — 변화율의 분자와 분모가 다른 계약이었다(P545·P1581과 같은 '다른 기준의 전일 종가' 계열). · 검사 ci-data-pipeline-contract-check · 파일 scripts/producer/quotes.mjs, scripts/ci-data-pipeline-contract-check.mjs
## P2064 - v58.80 - 테마 단계 소급 계산이 지금 구성 종목을 과거에 쓴다는 사실을 밝히지 않았고, 과거 판정의 미래 자료 불변성을 검사하는 게이트가 없었다 · 원칙 R697, R725, C11 · 교훈 R697 · 검사 ci-lookahead-check · 파일 scripts/ci-lookahead-check.mjs
## P2063 - v58.79 - 리서치 라이브러리 1024~1100px에서 본문이 약 140px 칸으로 눌림 · 교훈 반응형 구간 규칙은 같은 요소의 열 고정을 그 구간의 열 수와 함께 다시 정한다. · 파일 src/ui/styles/v2-research.css
## P2062 - v58.78 - 섹터 회전 그래프(RRG)의 이름이 서로 겹치고 꼬리가 엉켜 읽을 수 없었다 · 원칙 R571 · 교훈 R571
## P2061 - v58.78 - S&P 500 지도 타일에 수익률 색이 나오지 않고 크게 움직인 종목 글자가 사라졌다 · 원칙 R571 · 교훈 R571 · 검사 ci-esm-core-unit-check
## P2060 - v58.77 - AI 패널의 "웹검색 중" 안내가 답변이 끝난 뒤에도 그대로 남았다 · 원칙 R571 · 교훈 R571 · 검사 ci-ai-intelligence-contract-check
## P2059 - v58.77 - 지식 연구 dossier가 부분 문자열 매칭으로 무관한 근거를 연결했다(evaluation←SEC 재무제표 등) · 원칙 R718 · 교훈 R718 · 검사 ci-review-integrity-unit-check
## P2058 - v58.77 - FMP 성장률 요청 URL에 물음표가 두 번 들어가 API 키가 전달되지 않았다 · 원칙 R575 · 교훈 R575 · 검사 ci-review-integrity-unit-check
## P2057 - v58.77 - Cboe 풋콜 보존값이 이번 런의 수집 성공으로 운영 receipt에 기록됐다 · 원칙 R571 · 교훈 R571 · 검사 ci-review-integrity-unit-check
## P2056 - v58.77 - 지식 빌더가 import하는 helper·연구 패킷 27개를 바꿔도 생성물 parity 게이트가 선택되지 않았다 · 원칙 R589 · 교훈 R589 · 검사 ci-qa-pipeline-contract-check
## P2055 - v58.77 - 지식 화면이 서버가 참고용으로 제한한 LKG CPI·정책금리를 자동 갱신 현재값으로 표시했다 · 원칙 R570 · 교훈 R570 · 검사 ci-scenario-guidance-fixture
## P2054 - v58.77 - 무관한 근거 하나가 AI 답변의 현재 사건 문장 검사를 꺼 버렸고, 단위 없는 지수 수치는 검사를 빠져나갔다 · 원칙 R698 · 교훈 R698 · 검사 ci-ai-intelligence-contract-check
## P2053 - v58.77 - 최초 시장 스냅샷 읽기가 실패한 탭은 새 revision 알림이 와도 다시 읽지 않았다 · 원칙 R571 · 교훈 R571 · 검사 ci-esm-core-unit-check
## P2052 - v58.77 - 수렴 드라이버가 시간초과·승인대기 CI를 실패로 분류하지 않아 운영 job이 초록으로 끝났다 · 원칙 R593 · 교훈 R593 · 검사 ci-codex-structure-regression-fixture
## P2051 - v58.77 - 배포를 건너뛴 Pages 성공 run이 열린 Pages 장애 이슈를 복구로 닫았다 · 원칙 R657 · 교훈 R657 · 검사 ci-workspace-contract-check
## P2050 - v58.77 - 확장 스크리너 shard가 push 실패 뒤 rebase된 새 core와 다시 검증되지 않고 push됐다 · 원칙 R595 · 교훈 R595 · 검사 ci-data-pipeline-contract-check
## P2049 - v58.77 - 시장 온도계가 전 시장 동시 수집 실패를 지연으로 표시하지 못했고, Yahoo 요청에는 시간 상한이 없었다 · 원칙 R634 · 교훈 R634 · 검사 ci-esm-core-unit-check
## P2048 - v58.77 - 공식 CPI·PCE가 FRED보다 한 달 앞설 때 이전 달 변화량이 남고, 공식 읽기가 실패한 다음 런에는 기준월이 역행했다 · 원칙 R587 · 교훈 R587 · 검사 ci-data-pipeline-contract-check
## P2047 - v58.76 - 텔레그램 요약이 14일 창(약 2,400건)을 잃고 직전 커서 이후 약 100건만 게시했다 · 원칙 R262 · 교훈 R262 · 검사 ci-data-pipeline-contract-check · 파일 public-data/telegram-digest.json
## P2046 - v58.75 - 접어 두려던 도구들이 개발자 모드에서만 보였다 · 원칙 R705 · 교훈 R705
## P2045 - v58.75 - "돌파 관찰" 프리셋이 피벗 근접 감시 목록을 통째로 뺐다 · 교훈 없음 · 검사 ci-screener-workbench-contract
## P2044 - v58.75 - 같은 테마의 1개월 수익률이 생산자 문장과 화면 계산에서 달랐다 · 원칙 R603 · 교훈 R603 · 검사 ci-scenario-guidance-fixture
## P2043 - v58.75 - 분배일 수가 시장 상태와 시장 폭에서 다르게 나왔다 · 원칙 R723 · 교훈 R723 · 검사 ci-regime-scenarios-fixture
## P2042 - v58.75 - 도움말 기준표와 거시 문장이 실제 판정 규칙과 다르게 읽혔다 · 원칙 R723 · 교훈 R723 · 검사 ci-capability-claim-contract-check, ci-regime-scenarios-fixture
## P2041 - v58.75 - 투자 심리 가격 온도의 "RSI 14일 11"이 실제 RSI로 읽혔다 · 원칙 R670 · 교훈 R670 · 검사 ci-esm-core-unit-check
## P2040 - v58.75 - 텔레그램 글의 대표 꼬리표가 내용과 다르게 나왔다 · 원칙 R722 · 교훈 R722 · 검사 ci-data-pipeline-contract-check
## P2039 - v58.75 - 뉴스에 관련 없는 시나리오 꼬리표가 붙었고, 첫 로드 때는 하나도 붙지 않았다 · 원칙 R697 · 교훈 R697 · 검사 ci-esm-core-unit-check
## P2038 - v58.75 - 브리핑 7일 일정의 실적 행에 EPS 예상이 보이지 않았고 일부 실적이 빠졌다 · 원칙 R603 · 교훈 R603 · 검사 ci-esm-core-unit-check
## P2037 - v58.75 - 매매 지시 차단 장치가 가격이 붙은 명령문을 통과시켰다 · 원칙 R724 · 교훈 R724 · 검사 ci-ai-intelligence-contract-check · 파일 scripts/ci-ai-intelligence-contract-check.mjs
## P2036 - v58.75 - AI 도우미가 보고 있는 종목을 받지 못했고, 보유 내역 없이 포트폴리오 맥락이 있다고 알렸다 · 원칙 R131 · 교훈 R131 · 검사 ci-ai-intelligence-contract-check
## P2035 - v58.74 - 다음 이벤트 날짜가 화면마다 미국 날짜와 한국 시각으로 섞여 나왔다 · 원칙 R723 · 교훈 R723
## P2034 - v58.74 - 거시 교차로가 정책금리 하단을 '상단 - 0.25'로 가정했다 · 원칙 R689 · 교훈 R689
## P2033 - v58.74 - 뉴스 제목 번역이 시장 용어를 다른 뜻으로 옮겼다(Treasury Haven → '재정 예금 안정성') · 원칙 R702 · 교훈 R702 · 검사 ci-data-pipeline-contract-check · 파일 scripts/ci-data-pipeline-contract-check.mjs
## P2032 - v58.74 - 공포·탐욕 10/16 종가가 주말 실시간 값(18)으로 덮여 공식 과거 기록(22.07)과 달랐다 · 원칙 R720 · 교훈 R720 · 검사 ci-esm-core-unit-check · 파일 public-data/history.json
## P2031 - v58.74 - 테마 상세가 하루 수익률 차이를 '상대 모멘텀 우세'·'상대 약세'로 단정 · 원칙 R689 · 교훈 R689
## P2030 - v58.74 - 뉴스 메타 줄이 지금 시나리오에 없는 갈래 이름('신용 경색 시나리오' 등)을 붙임 · 원칙 R689 · 교훈 R689
## P2029 - v58.74 - 테마 강도 카드가 P2017 뒤에도 하위 그룹 중앙값의 중앙값을 써 같은 화면 표와 숫자가 다름 · 원칙 R689 · 교훈 R689
## P2028 - v58.74 - 종목 요약이 흐름을 이끈 쪽을 섹터와 테마 반대로 적음 · 원칙 R689 · 교훈 R689
## P2027 - v58.74 - 순이익률 문장이 두 해 모두 적자인 기업에 '남는 이익이 줄었다'고 쓰고 흑자·적자 전환을 구분하지 않음 · 원칙 R689 · 교훈 R689
## P2026 - v58.74 - 섹터 흐름 목록이 반도체 ETF(SMH)를 11개 섹터와 같은 순위에 넣음 · 원칙 R689 · 교훈 R689
## P2025 - v58.74 - 화면 문구 생성기가 '(으)로' 자리표시자·U+2212 음수·'+0.0' 부호를 그대로 노출 · 원칙 R723 · 교훈 R723 화면 숫자·조사·단위는 공용 헬퍼로 만들고, 렌더된 문구 린트가 지킨다 · 검사 ci-rendered-copy-lint-check, ci-esm-core-unit-check · 파일 src/domain/shared/number.js, scripts/ci-rendered-copy-lint-check.mjs
## P2024 - v58.74 - AI 해설이 다음 주 대형 실적 날짜와 헤드라인 날짜를 틀리게 씀 · 원칙 R687 · 교훈 R687
## P2023 - v58.74 - ROE 문장이 자기자본이 늘어난 적자 기업에 '순손실로 자본이 줄어든 해'라고 씀 · 원칙 R689 · 교훈 R689
## P2022 - v58.74 - 거시 '1년 전보다'가 1년이 아닌 구간과 비교 · 원칙 R683 · 교훈 R683
## P2021 - v58.74 - 도움말 판정 기준표와 HY 설명이 실제 판정 규칙과 다름 · 원칙 R688 · 교훈 R688
## P2020 - v58.74 - '지금 흐름' 전환 카드의 반증 조건이 이미 충족된 채 전환이 유지되고, 시장 폭이 약해졌다고 단정 · 원칙 R713 · 교훈 R713
## P2019 - v58.74 - 종목 요약 재무 칸이 불러오는 중인 재무를 'SEC 연간 공시 없음'으로 표시 · 원칙 R709 · 교훈 R709
## P2018 - v58.74 - 테마 순위 변화 라벨이 그 주 흐름과 반대 방향을 말함 · 원칙 R707 · 교훈 R707
## P2017 - v58.74 - 테마 행 수치를 하위 그룹 중앙값의 중앙값으로 계산해 작은 그룹이 테마 전체 숫자를 정함 · 원칙 R685 · 교훈 R685
## P2016 - v58.74 - 이스라엘 총리 성명 텔레그램 글이 '한국장'으로 분류됨 · 원칙 R722 · 교훈 R722
## P2015 - v58.74 - AI 해설 기준 표시가 미 10년물 종가를 '장외 시세'로 표시 · 원칙 R713 · 교훈 R713
## P2014 - v58.74 - AI 해설 문장 끝에 '[]'와 '[;]'가 남음 · 원칙 R718 · 교훈 R718
## P2013 - v58.74 - Cboe 풋콜 수집 실패가 정적 데이터 계약을 깨 데이터 갱신 전체를 막음 · 원칙 R721 · 교훈 R721
## P2012 - v58.74 - 금요일 17시(ET) 이후 환율·선물 시세를 장중으로 분류해 데이터 갱신이 거부됨 · 원칙 R720 · 교훈 R720
## P2011 - v58.72 - history 세션 정리가 뒤쪽 행의 확정 종가를 보지 못해 전일 종가 읽기가 확정 값을 덮을 수 있음 · 원칙 R423 · 교훈 R423 · 검사 ci-history-session-model-check
## P2010 - v58.72 - 번역 헤드라인에 베트남어 단어가 섞여 게시됨 · 원칙 R702 · 교훈 R702
## P2009 - v58.72 - AI 해설이 코스피 장중 4% 급락 뒤 반등한 날을 '장중 큰 움직임은 없고'라고 씀 · 원칙 R713 · 교훈 R713
## P2008 - v58.72 - 금리·환율의 곡선 움직임 20거래일 구간이 옆에 그린 공식 곡선보다 하루 늦게 끝남 · 원칙 R715 · 교훈 R715
## P2007 - v58.72 - AI 해설에 증거 id를 지운 자리의 빈 괄호 '()'가 남음 · 원칙 R718 · 교훈 R718
## P2006 - v58.72 - 재개된 13D/G 이벤트로 filing-discovery.json이 용량 예산을 넘어 데이터 갱신을 막음 · 원칙 R717 · 교훈 R717
## P2005 - v58.72 - producer-dry-run 스크리너 레인이 직전 게시본의 세션 날짜에 막혀 데이터 갱신 전체를 멈춤 · 원칙 R720 · 교훈 R720
## P2004 - v58.71 - history 검사가 비어 있는 전일 종가를 0으로 읽어 새 코드의 첫 데이터 갱신을 막음 · 원칙 R720 · 교훈 R720 · 검사 ci-history-field-time-contract-check
## P2003 - v58.71 - 실제 30% 넘는 급등락 종목이 빠지고, 서울 외 거래소 전일 종가가 두 세션 전이 되며, 세션 종가가 자기 행을 놓치면 사라짐 · 원칙 R423 · 교훈 R423 · 검사 ci-data-pipeline-contract-check
## P2002 - v58.71 - 13F 발행사 집계가 직전 분기를 빠뜨리고 날짜가 고정되며, 이력 분기는 정정 재합성·대조가 되지 않음 · 원칙 R439 · 교훈 R439
## P2001 - v58.71 - 13F 단계 실패가 시장·뉴스 커밋까지 막고, 격리 레인은 기한 없이 이어짐 · 원칙 R721 · 교훈 R721
## P2000 - v58.71 - 막힌 해설이 같은 입력으로 30분마다 모델을 두 번씩 다시 부름 · 교훈 없음 — 비용 결함 · 검사 ci-data-pipeline-contract-check
## P1999 - v58.71 - HY 스프레드 수준과 변화폭의 날짜가 어긋나고, 거시 증거 출처가 모두 FRED로 표시되며, 코스피·WTI 큰 움직임 줄이 세션을 건너뜀 · 원칙 R332 · 교훈 R332 · 검사 ci-data-pipeline-contract-check
## P1998 - v58.71 - breadth가 미국 장 없는 날에 빈 행을 만들고, 지난 세션 종목을 오늘 등락에 섞음 · 원칙 R423 · 교훈 R423
## P1997 - v58.71 - 수집기 작은 결함 다섯 건(이탈 종목 잔류, 네트워크 재시도, 13F 기간 묶음, IPO 실패, Nasdaq 상태 유실) · 교훈 없음 — 개별 결함 · 검사 ci-13f-currentness-check
## P1996 - v58.71 - 백테스트 달력이 한국 휴일인 미국 거래일을 빠뜨림 · 원칙 R423 · 교훈 R423 · 검사 ci-data-pipeline-contract-check
## P1995 - v58.71 - SEC 재무가 새 10-Q·10-K 공시를 최대 28일 늦게 반영함 · 교훈 없음 — 갱신 신호 부재 · 검사 ci-data-pipeline-contract-check
## P1994 - v58.71 - 한국 데이터 장애 하나가 스크리너 전체 갱신을 막음 · 원칙 R721 · 교훈 R721 · 검사 ci-data-pipeline-contract-check
## P1993 - v58.71 - 텔레그램 채널의 첫 페이지가 비어도 수집 성공으로 집계됨 · 원칙 R441 · 교훈 R441
## P1992 - v58.71 - 오래된 공식값이 더 새 FRED 값을 덮고, 세션 경계·달 경계·먼 달 뉴스에서 판정이 어긋남 · 원칙 R423 · 교훈 R423
## P1991 - v58.71 - 물가 지표의 비교 달 공백이 FRED 전체를 낡게 만들고, 오래된 변화폭과 3개월 연율 인용이 해설을 막음 · 원칙 R332 · 교훈 R332 · 파일 public-data/macro-history.json
## P1990 - v58.71 - history 필드 수정 기록이 두 읽기 사이를 왕복함 · 원칙 R423 · 교훈 R423 · 검사 ci-history-field-time-contract-check · 파일 scripts/ci-history-field-time-contract-check.mjs
## P1989 - v58.71 - 스크리너 갱신이 공유 파생 파일 충돌로 실패하고 그 주기를 버림 · 원칙 R255 · 교훈 R255 · 파일 public-data/operations-status.json
## P1988 - v58.71 - 스크리너가 UTC 자정 무렵 실행에서 하루 전 세션을 다시 게시함 · 원칙 R423 · 교훈 R423 · 검사 ci-data-pipeline-contract-check
## P1987 - v58.71 - 대량 보유(13D/G) 공시 수집이 2024-12-17에서 멈춤 · 교훈 없음 — 원천(SEC) 서식명 변경 · 검사 ci-13f-currentness-check · 파일 scripts/ci-13f-currentness-check.mjs
## P1986 - v58.71 - 레인 격리가 되돌린 뉴스에 새 주기 이름을 붙이고, 검증되지 않은 AI 해설을 '직전 검증본'으로 다시 게시할 수 있었음 · 원칙 R721 · 교훈 R721 · 검사 ci-data-pipeline-contract-check · 파일 scripts/ci-data-pipeline-contract-check.mjs
## P1985 - v58.71 - 브리핑 등락 막대가 다른 날의 종가를 같은 날처럼 나란히 보여 줌 · 원칙 R683 · 교훈 R683 · 검사 ci-data-pipeline-contract-check
## P1984 - v58.71 - 텔레그램 분류기가 달러 가격 글을 모두 거시로, 자사주 매입을 내부자 거래로 분류하고 수치 데이터 글이 선별 하한 아래로 빠짐 · 원칙 R722 · 교훈 R722 채널 글의 분류·선별은 글이 담은 수치를 기준으로도 판단한다 · 검사 ci-data-pipeline-contract-check
## P1983 - v58.70 - 보조 레인 검사 하나나 브라우저 CI 설치 장애가 데이터 게시 전체를 막음 · 원칙 R721 · 교훈 R721 보조 레인 실패는 그 레인만 격리하고, 데이터 전용 커밋은 데이터 검사로 인증한다 · 검사 ci-data-pipeline-contract-check, ci-artifact-semantics-check, ci-qa-pipeline-contract-check
## P1982 - v58.69 - 장중 뉴스 상한을 12로 올렸는데 데이터 산출물 검사가 6에 고정돼 데이터 갱신이 막힘 · 원칙 R720 · 교훈 R720 수정마다 HEAD에서 실패하는 음성 대조와 양성 대조를 둔다 · 파일 src/domain/news/stories.js
## P1981 - v58.69 - 미국 일봉이 빈 세션이 history에 영구 구멍으로 남고, 1일 변화가 2거래일 변화로 표시됨 · 원칙 R423 · 교훈 R423 일별 시계열에는 완료된 시장 세션 값만 저장한다 · 검사 ci-data-pipeline-contract-check
## P1980 - v58.69 - 시세 생산자가 빈 일봉을 버려 직전 종가를 두 세션 전 값으로 잡음 · 원칙 R423 · 교훈 R423 일별 시계열에는 완료된 시장 세션 값만 저장한다 · 검사 ci-data-pipeline-contract-check
## P1979 - v58.68 - 시황 생성기의 직전 세션 큰 움직임이 코스피·WTI만 다루고, 빠진 세션을 하루 변화로 계산함 · 원칙 R720 · 교훈 R720 수정마다 HEAD에서 실패하는 음성 대조와 양성 대조를 둔다 · 검사 ci-esm-core-unit-check, ci-data-pipeline-contract-check
## P1978 - v58.68 - history 백필이 장중 컷으로 남은 행을 확정 종가로 덮지 않아 10/21 미국 종가가 빠짐 · 원칙 R720 · 교훈 R720 수정마다 HEAD에서 실패하는 음성 대조와 양성 대조를 둔다 · 검사 ci-history-field-time-contract-check
## P1977 - v58.66 - 의미 게이트가 증거 계층(evidenceQuotes)을 읽지 않아, 해석이 SMH·지수 선물을 인용하면 갱신 전체가 거부됨 · 원칙 R720 · 교훈 R720 게이트는 실제 산출물 형태로 음성 대조를 확인해야 한다
## P1976 - v58.65 - 본문에 괄호 없이 쓰인 프롬프트 라벨(METRIC_EVIDENCE id)이 정리되지 않아 시장 해석 전체가 차단됨 · 원칙 R720 · 교훈 R720 같은 결함 클래스의 다른 형태까지 음성 대조로 확인한다 · 검사 ci-data-pipeline-contract-check
## P1975 - v58.65 - FRED 장애 때 공식 1차 출처가 값을 바꿔도 신선도 표시가 stale로 남아 14시간 동안 시장 데이터 게시가 막힘 · 원칙 R628 · 교훈 R628 결측·대체값은 출처와 상태가 함께 이동해야 한다 · 검사 ci-artifact-semantics-check
## P1974 - v58.65 - CI 브라우저 샤드의 Playwright 설치 재시도가 남은 apt 잠금에 막혀 10/21 17:48 이후 어떤 커밋도 배포되지 않음 · 원칙 R720 · 교훈 R720 게이트는 음성 대조로 실패를 확인해야 한다(재시도 경로가 실제로 다시 시도하는지 확인되지 않았다)
## P1973 - v58.64 - 감사 결함 클래스의 다른 발생: NOT 조건 설명, 포트폴리오 입력 삭제, 한국 시세 null 예외, CIK 전체 대조 부재 · 원칙 R628, R663 · 교훈 R628 결측은 0도 조건 충족도 관측값도 아니다; R663 종목은 정확한 등록 일치로만 · 검사 ci-architecture-audit-regression-fixture · 파일 public-data/sec-fundamentals-summary.json
## P1972 - v58.64 - AI 채팅 헤더의 자산 간 상관(computeCrossAssetCorrelation)이 항상 '데이터 부족'인 죽은 계산 · 원칙 R628 · 교훈 R628 결측은 조건도 구간도 관측값도 만족시키지 않는다(존재 검사만으로 통과시키지 않는다)
## P1971 - v58.64 - 시장 가이드가 분기 수 집계를 '비용이 작은 쪽'으로 표현하고, 같은 원인을 나눠 쓴 분기에 선택이 흔들림 · 원칙 R265 · 교훈 R265 외부 도구·이론과 같다고 주장하면 그 정의와 정확히 일치 · 검사 ci-architecture-audit-regression-fixture
## P1970 - v58.64 - 산출물 캐시가 소유자를 fetch 함수 이름으로 식별해 루트 간 혼합·강제 새로고침 누락 · 원칙 R632 · 교훈 R632 입력/읽기 계약 일치 · 검사 ci-artifact-cache-check · 파일 scripts/ci-artifact-cache-check.mjs
## P1969 - v58.64 - 조건부 통계 READY가 같은 표본의 반복·겹치는 결과 창을 독립 표본으로 셈 · 원칙 R706 · 교훈 R706 과거 빈도는 겹치지 않는 사례로 센다 · 검사 ci-conditional-evidence-contract, ci-architecture-audit-regression-fixture · 파일 scripts/ci-conditional-evidence-contract.mjs
## P1968 - v58.63 - follow-through의 '연중'·'52주 저점'이 2년치 생산자 시계열 전체로 계산됨 · 원칙 R713 · 교훈 R713 판정 이름은 그 이름을 정의하는 조건이 있을 때만 붙인다 · 검사 ci-architecture-audit-regression-fixture · 파일 scripts/ci-architecture-audit-regression-fixture.mjs
## P1967 - v58.63 - Worker가 이미 상류로 보낸 요청의 실패에도 쿼터 예약을 되돌림 · 교훈 공용 AI 월예산 정책(AGENTS 2026-10-11)
## P1966 - v58.63 - 게이트 오라클 결함: 결함을 재현한 입력에서도 통과하던 QA 러너·원장·CSP·접근성·추적·생산자 게이트 · 원칙 C14, C1, C4, C7, C6, C10, C3, R712, R719 · 교훈 R712 게이트 지표는 서식 변경으로 만족되지 않는다 · 검사 ci-qa-runner-behavior-check, ci-record-fix-check, ci-ledger-integrity · 파일 index.html · 관련 P797, P799
## P1965 - v58.63 - 레거시 UI 상태 경쟁: 관심목록 대상, 한국 테마 필터, 위험 패널 재진입, 포커스, 힌트 데이터, 저장소 예외, SW 캐시 범위 · 원칙 C01, C09, R628 · 교훈 R628 (5) 한 렌더러의 예외가 다음 렌더를 취소하지 않도록 호출 경계를 둔다 · 검사 ci-architecture-contract-check
## P1964 - v58.63 - 기준·범위 불일치: 시장 읽기, 실적 주간, 회계연도, 포트폴리오 읽기, 즉석 종목 캐시, 권리, 거시 갈림길, 화면 연결 · 원칙 R671, R340 · 교훈 R671 현재성 라벨은 관측·달력에서 한 presenter로, R340 필수 입력의 의미·기준일·coverage가 갖춰질 때만 결론 표시 · 검사 ci-architecture-audit-regression-fixture, ci-esm-core-unit-check, ci-review-integrity-unit-check · 파일 scripts/ci-architecture-audit-regression-fixture.mjs
## P1963 - v58.63 - 결측·부분 자료가 0 또는 외삽 값으로 표시되는 클래스(한국 테마, 포트폴리오 30일, 차트, 테마 등락, 지수 실적, 매매일지, 코스피 스트레스, 기준금리) · 원칙 C07, C08, C13, R628, R706 · 교훈 R628 결측은 조건도 구간도 관측값도 만족시키지 않는다, R706 과거 빈도는 겹치지 않는 사례로 센다 · 검사 ci-architecture-audit-regression-fixture, ci-esm-core-unit-check · 파일 scripts/ci-architecture-audit-regression-fixture.mjs
## P1962 - v58.63 - 스크리너 의미 오류: NOT 하위 필드 식별, 상수 팩터 '독립 신호', 평가 가격, 문장 조건의 OR·반대 방향·원화 단위 · 원칙 R586, R628 · 교훈 R586 결측 팩터는 중립값이 아니다, R628 결측은 조건을 만족시키지 않는다 · 검사 ci-architecture-audit-regression-fixture, ci-esm-core-unit-check · 파일 scripts/ci-architecture-audit-regression-fixture.mjs
## P1961 - v58.63 - SEC CIK 대조표 10건이 다른 발행사를 가리켜 사업 설명·8-K가 남의 회사 자료로 표시 · 원칙 R663 · 교훈 R663 종목은 정확한 등록 일치로만 해석하고 추측하지 않는다 · 검사 ci-architecture-audit-regression-fixture · 파일 scripts/ci-architecture-audit-regression-fixture.mjs
## P1960 - v58.63 - AI 답변 경계: 계획 파싱 실패 경로의 현재 사건 문장, 행동 제안 게이트, 상태 확인·취소·종가 기준 전달 · 원칙 R628 · 교훈 R628 계열 정직성(미확인 현재 값·사건은 게시하지 않는다), AI 답변 단일 파이프라인 규칙 · 검사 ci-architecture-audit-regression-fixture, ci-ai-premise-check · 파일 scripts/ci-architecture-audit-regression-fixture.mjs
## P1959 - v58.62 - 시장 해석이 반도체·미국 지수 선물·아시아 움직임을 근거로 쓸 수 없었다 · 교훈 P1093(근거는 발행 산출물에서) 자체는 지켰지만, 해석이 설명해야 할 시장의 근거가 그 산출물에 없었다 — 설명 대상과 근거 집합이 어긋난 연결 결손(소유자 2026-10-21: 정보·데이터 연결이 계속 빠진다). · 검사 ci-market-snapshot-contract-check, ci-data-pipeline-contract-check · 파일 src/data/contracts/market-snapshot.js, scripts/fixtures/market-analysis-evidence-tier-20261021.json, scripts/ci-market-snapshot-contract-check.mjs, scripts/ci-data-pipeline-contract-check.mjs
## P1958 - v58.61 - 뉴스 피드 'Google News - Market movers'가 10/19부터 68회 연속 0건 — 시장 움직임 설명 기사가 묶음에 들어오지 못함 · 교훈 피드는 매 실행 사용 가능한 기사를 내야 한다(P1504 피드 상태)
## P1957 - v58.60 - 검증 통과한 시장 해석에 '(METRIC_EVIDENCE:', '(REGIME_CONTEXT)', '(MARKET_DRIVERS)' 같은 프롬프트 내부 표기가 그대로 보임 · 교훈 화면에 내부 식별자·출처 표기 금지(출처는 접힘) · 검사 ci-data-pipeline-contract-check
## P1956 - v58.60 - SEC 공시 요약 투영이 1 MiB 상한을 넘어 refresh-screener가 두 번 연속 실패, 한국 10/21 종가와 스크리너가 갱신되지 않음 · 교훈 1 MiB 공개 투영 상한(P1470/P1632) — 상한 근처 여유 확보 · 검사 ci-esm-core-unit-check
## P1955 - v58.59 - 해석 본문이 막힌 날 새 날의 한 문장 후보가 버려져 전날 문장이 아침 내내 유지 · 교훈 하루 한 문장 계약(v57.71) — 새 날은 새 문장 · 검사 ci-data-pipeline-contract-check
## P1954 - v58.59 - 10/21 00:22Z부터 모든 시장 해석 시도가 검증기의 자기 근거 오독으로 차단 · 교훈 검증기는 프롬프트가 준 근거와 같은 기준으로 판정한다(시장 해석 계약) · 검사 ci-data-pipeline-contract-check · 파일 scripts/fixtures/market-analysis-20261021.json
## P1953 - v58.58 - 미국 10/20 종가가 오른 뒤에도 그날 아침 코스피 -3.73%가 오늘의 한 문장을 '오늘의 하락'으로 고정 · 교훈 판정과 같은 방향의 문장(오늘의 한 문장 계약) · 검사 ci-data-pipeline-contract-check
## P1952 - v58.57 - 자료 갱신 릴리스가 병합 커밋으로 검증된 코드를 '미검증'으로 거부 · 교훈 검증 게이트는 '같은 코드가 테스트됐는가'를 확인해야지 특정 SHA 하나에 CI가 붙었는지만 보면 안 된다. · 파일 .github/workflows/ci.yml
## P1951 - v58.56 - 스크리너 프리셋 전환이 '실행 통과만'을 꺼서 탈락 행이 섞임 · 교훈 표의 범위(무엇을 보여 줄지)와 표시 필터(그 안에서 무엇을 거를지)를 같은 초기화로 다루지 않는다. · 검사 ci-screener-extended-browser-check · 파일 scripts/ci-screener-extended-browser-check.mjs
## P1950 - v58.54 - producer dry run 게이트가 벽시계로 뉴스 주기를 판정해 23:00Z 경계 뒤 정기 갱신 전까지 실패함 (923cabb 배포 차단) · 교훈 CI 게이트는 벽시계·데이터 나이에 따라 결과가 바뀌면 안 된다(P1940과 같은 계열). · 파일 scripts/ci-producer-dry-run.mjs, public-data/data.json, scripts/lib/producer-dry-run-fetch.mjs, scripts/qa-runner.mjs
## P1949 - v58.52 - 헤드라인 번역이 Anthropic을 '인간형 AI'로, $45 billion을 '4,500억 달러'로 옮김 · 교훈 출처 문장을 바꾸지 않는 번역 · 검사 ci-data-pipeline-contract-check · 파일 scripts/producer/market-narrative.mjs
## P1948 - v58.52 - 종목 화면의 '이 테마의 시나리오 →'(한국 테마)가 테마 화면 맨 위로만 가고 상세가 닫혀 있음 · 교훈 링크는 도착한 화면에서 대상을 연다 · 검사 ci-runtime-contract-check
## P1947 - v58.52 - 스크리너 'MS' 검색이 0행, 'NV' 검색이 MSFT·MU·AMD까지 반환 · 교훈 검색은 표시 필터 안에서 일관되게 동작 · 검사 ci-screener-workbench-contract · 파일 src/ui/pages/screener.js
## P1946 - v58.52 - 모든 화면 상단 시장 상태 바가 퇴역한 0~100 스윙 점수('52 · 중립 · 신호 혼재')를 보임 · 교훈 한 화면 한 판정 · 근거 없는 점수 표시 금지(AGENTS) · 검사 ci-runtime-contract-check · 파일 js/aio-pages.js, src/domain/briefing/market-read.js
## P1945 - v58.52 - 실적 일정이 시각·알파벳 순으로 잘려 넷플릭스·메타·테슬라 대신 EFX·GPC·HAS가 보임 · 교훈 일정은 시장을 움직이는 순서로 고른다 · 검사 ci-esm-core-unit-check · 파일 src/domain/briefing/schedule.js
## P1944 - v58.52 - 코스피 -3.73% 반등 실패일에 오늘의 한 문장이 '소진·회복' 바닥 프레임으로 나옴 · 교훈 판정과 같은 방향의 문장(오늘의 한 문장 계약) · 검사 ci-data-pipeline-contract-check · 파일 scripts/producer/market-narrative.mjs
## P1943 - v58.52 - 한국 종목 종가를 넥스트레이드 20:00 통합가로 덮어써 일간 등락률이 틀림 (SK하이닉스 -4.2%가 -7.1%로) · 교훈 종가 기준 점수(AGENTS) — KRX 종가가 한국 종목의 종가다 · 검사 ci-esm-core-unit-check · 파일 scripts/producer/kr-exchange.mjs
## P1942 - v58.51 - 검증에 실패한 AI 답변 계획을 claim 묶음으로 읽어 '수치 주장을 제외했다'는 잘못된 안내 표시 · 원칙 R312 · 교훈 R312 구조화 claim 검증 · 파일 js/aio-core.js, js/aio-tests.js
## P1941 - v58.50 - 접근성 매트릭스가 24px 최소 높이를 갖춘 타임라인 뉴스 링크를 부동소수점 오차로 작은 클릭 영역으로 판정함 · 교훈 CI 게이트는 데이터 내용·배치에 따라 결과가 바뀌면 안 되고, 레이아웃 측정값은 부동소수점 오차를 허용해 비교한다.
## P1940 - v58.49 - screener-extended·entity-quality 게이트가 벽시계와 지연 로드된 Chart.js에 의존해 미국 장 마감 뒤 빨갛게 됨 · 교훈 CI 게이트는 벽시계·데이터 나이·비동기 로드 순서에 따라 결과가 바뀌면 안 된다.
## P1939 - v58.48 - 한국 테마 상세가 테마 제목·종목명·촉매 문구를 이스케이프 없이 innerHTML에 씀 · 교훈 innerHTML에 넣는 데이터 유래 문자열은 항상 이스케이프한다. · 파일 js/aio-kr-data.js
## P1938 - v58.47 - 테마 상세를 닫은 뒤 두 번째 재렌더에서 키보드 포커스가 페이지 본문으로 떨어짐 · 교훈 WCAG 2.4.3 포커스 순서: 닫힌 대화 상자는 포커스를 연 요소로 돌려주고, 재렌더가 그것을 빼앗지 않는다. · 검사 ci-reference-adoption-browser-check · 파일 src/ui/pages/themes.js
## P1937 - v58.45 - v58.43 순위 기록 판정 문장이 유의한 음의 IC를 "우연과 구분되지 않음"으로 쓰고, 표본 수·판정 범위를 잘못 말함 · 교훈 근거 문장은 판정이 실제로 말하는 방향·표본·범위만 말한다. · 검사 ci-market-guide-fixture · 파일 src/domain/guide/lessons.js, src/ui/pages/screener.js, src/ui/components/screen-lessons.js, scripts/ci-market-guide-fixture.mjs
## P1936 - v58.44 - 월간 거시 일정 검토가 이미 지난 날짜 차이만으로 9개 일정을 '다름'으로 보고하고 닫힌 검토 이슈를 다시 열 수 있음 · 교훈 자동 검토 알림은 실제로 화면이나 앞으로의 일정이 달라질 때만 사람을 부른다. · 검사 ci-macro-calendar-review-contract-check · 파일 scripts/ci-macro-calendar-review-contract-check.mjs
## P1935 - v58.40 - 갱신 커밋이 사람의 병합과 부딪히면 그 회차 데이터가 통째로 빠지고, 수렴 대기 뒤에 늦게 끝난 데이터 CI 실패는 6시간 뒤에야 알려짐 · 교훈 데이터 자동화는 사람의 병합과 충돌해도 회차를 잃지 않고, 실패는 다음 회차 안에 알린다. · 검사 ci-codex-structure-regression-fixture, ci-data-continuity-check · 파일 scripts/ci-codex-structure-regression-fixture.mjs, scripts/ci-data-continuity-check.mjs
## P1934 - v58.37 - 한국 종목의 테마 링크가 미국 테마를 열거나 아무것도 열지 않음 · 원칙 R672 · 교훈 R672 (한국 테마 이름·구성은 한 소유자; KRX 종목은 한국 테마 상세로 연결) · 검사 ci-esm-core-unit-check · 파일 src/ui/components/stock-read.js, src/ui/navigation/theme-detail.js
## P1933 - v58.36 - 기존 감사의 미해결 결함: 백테스트 기준 통화 가중이 현지 통화로 표류, 진행 중인 달을 완결 월로 집계, 미확인 거래소 접미사를 달러로 처리, 장중(REGULAR) 값을 종가로 AI 근거에 전달 · 교훈 데이터 정직성(미확인 통화는 기준 통화가 아니다, 장중 값은 종가가 아니다) · 검사 ci-esm-core-unit-check · 파일 src/domain/portfolio/backtest.js, src/domain/portfolio/fx.js, scripts/lib/market-analysis-validate.mjs
## P1932 - v58.35 - 주말 'skip' 갱신 실행이 열린 실패 알림을 복구로 닫고 연속 실패 횟수를 초기화함 · 교훈 실패 알림은 실제 작업이 성공했을 때만 복구로 닫는다; 건너뛴 실행은 상태 증거가 아니다. · 검사 ci-workspace-contract-check, ci-codex-structure-regression-fixture, ci-producer-dry-run · 파일 src/domain/news/report-verification.js, scripts/producer/ai-usage.mjs, scripts/ci-workspace-contract-check.mjs, scripts/ci-codex-structure-regression-fixture.mjs, scripts/ci-producer-dry-run.mjs
## P1931 - v58.32 - 근거 없는 숫자와 잘못된 라벨: 포트폴리오 금리·유가 스트레스, 후행 P/E를 'Forward P/E'로 표기, 스톡그랜트를 내부자 매수로 집계, 유동성 차입금을 뺀 부채비율 · 교훈 데이터 정직성(만든 숫자 금지), 라벨은 계산 근거와 일치 · 파일 js/aio-workspace.js, js/aio-ui.js, js/aio-chat.js, src/domain/fundamental/sec-statements.js
## P1930 - v58.30 - 화면마다 시황이 엇갈림: 판정·브리핑은 AI·반도체 주도주 조정을 중심 변수로 보는데 시나리오·AI 해설은 '유가 충격'(2/4)을 앞세우고, 오늘의 한 문장은 10/18에 멈춤 · 교훈 같은 시장 판단은 모든 화면이 하나의 공유 판정(시장 상태 leadership)을 근거로 쓴다. · 검사 ci-scenario-guidance-fixture, ci-data-pipeline-contract-check · 파일 scripts/ci-scenario-guidance-fixture.mjs, scripts/ci-data-pipeline-contract-check.mjs, scripts/qa-runner.mjs
## P1929 - v58.27 - 월요일 시장 해석이 검증 실패로 막히고 오늘의 한 문장이 전날 것으로 남음, 뉴스 묶음이 같은 주기 안에서 40건에서 32건으로 줄어듦 · 교훈 닫힌 수집 창의 결과는 다음 실행에서 버리지 않고 이어받으며, 검증 실패·거절 사유는 항상 기록한다. · 검사 ci-codex-structure-regression-fixture · 파일 scripts/ci-codex-structure-regression-fixture.mjs, scripts/ci-data-pipeline-contract-check.mjs
## P1928 - v58.26 - AI 투자 꺾임 시나리오 게이트가 반도체 급락을 보지 못했고, AI 대화가 DXY를 100 고정선으로 판정했음 · 교훈 같은 지표의 판정은 모든 화면이 하나의 공유 분류기를 쓴다. · 검사 ci-scenario-guidance-fixture · 파일 js/aio-chat.js, scripts/ci-scenario-guidance-fixture.mjs
## P1927 - v58.23 - 브리핑과 AI 경기 사이클 국면이 시장 상태와 다른 주도주·추세 판정을 읽었음 · 교훈 같은 지표의 판정은 모든 화면이 하나의 공유 분류기를 쓴다. · 검사 ci-scenario-guidance-fixture · 파일 src/domain/briefing/market-read.js, js/aio-core.js, scripts/ci-scenario-guidance-fixture.mjs
## P1926 - v58.21 - 금리 축 bp 차이가 부동소수점 오차로 10bp 미만으로 읽혀 '부담' 래치가 풀렸음 · 교훈 임계값 비교에 쓰는 단위 환산 값은 표시 정밀도로 정규화한 뒤 비교한다. · 검사 ci-regime-scenarios-fixture · 파일 src/domain/briefing/market-read.js, scripts/ci-regime-scenarios-fixture.mjs
## P1925 - v58.20 - 선택 항목인 실적 캘린더(Finnhub) 실패 한 번이 스크리너·SEC 갱신 전체를 중단 · 교훈 선택 lane 실패 격리 · 검사 ci-data-continuity-check · 파일 scripts/fetch-earnings-calendar.mjs
## P1924 - v58.20 - 출력 한도에서 잘린 AI 답변이 정산되지 않아 예약 상한 전액이 월 예산에서 차감 · 교훈 정산은 실제 청구 근거 기준 · 파일 worker/openai-usage.mjs, worker/openai-contract.test.mjs
## P1923 - v58.20 - 보통주 귀속 이익 기준 PER을 화면이 순이익 기준으로 재계산해 최근 4개 분기 PER·PEG가 틀림 · 교훈 생산자 필드는 소비자까지 전달 · 검사 ci-esm-core-unit-check · 파일 src/data/providers/screener.js
## P1922 - v58.20 - 지수 1·3·6개월 수익률이 세션이 아니라 행 수로 기준점을 잡아 누락일이 있으면 더 긴 기간을 비교 · 교훈 n거래일 = n세션 (P1428 계열) · 검사 ci-esm-core-unit-check · 파일 src/domain/market/benchmarks.js
## P1921 - v58.20 - 뒤로가기(bfcache) 복원 뒤 데이터 재적재·나이 배지·가격 알림 타이머가 멈춤 · 교훈 페이지 수명주기 복원 · 검사 ci-runtime-contract-check · 파일 js/aio-core.js
## P1920 - v58.20 - 갱신 봇이 띄운 축소 CI가 사람이 push한 코드까지 포함한 커밋을 검증·배포 · 교훈 배포 검증 범위 · 검사 ci-qa-pipeline-contract-check · 파일 .github/workflows/ci.yml
## P1919 - v58.20 - VIX 급등일(+30% 초과)과 저금리 ^IRX 변동이 공급자 오류로 판정돼 게시 데이터에서 빠짐 · 교훈 급변일 데이터 보존 · 검사 ci-data-pipeline-contract-check · 파일 scripts/fetch-data.mjs
## P1918 - v58.20 - 공개 AI 프록시의 연결별 상한이 횟수만 세어 한 연결이 월 예산 $20을 약 10분에 소진 가능 · 교훈 예산 남용 방지(금액 단위) · 파일 cloudflare-worker-proxy.js, worker/openai-contract.test.mjs
## P1917 - v58.20 - 주식분할 뒤 PER·PBR·참고 시총이 분할 비율만큼 틀리고 eps-consistent로 표시됨 · 교훈 가격과 주식 수의 기준 일치 · 검사 ci-data-pipeline-contract-check · 파일 src/domain/fundamental/sec-normalize.js
## P1916 - v58.14 - 대시보드 '섹터 등락'의 RRG 사분면이 테마·섹터 화면과 달랐음 (XLB·XLY·XLF·XLU) · 교훈 같은 지표의 판정은 모든 화면이 하나의 공유 분류기를 쓴다. · 검사 ci-scenario-guidance-fixture · 파일 src/ui/components/sector-moves.js, scripts/ci-scenario-guidance-fixture.mjs
## P1915 - v58.10 - history.json 행마다 pcr 열 유무가 달라 열 일관성 게이트가 유예 만료 뒤 main CI를 막음 · 교훈 행 단위로 누적되는 새 history 필드는 공통 열 목록에 함께 등록해 모든 행이 같은 열 집합을 갖게 한다. · 검사 ci-history-field-time-contract-check, ci-artifact-semantics-check · 파일 scripts/fetch-data.mjs, public-data/history.json, scripts/ci-history-field-time-contract-check.mjs, scripts/ci-artifact-semantics-check.mjs
## P1914 - v58.04 - 확장 범위(5,057행)에서 스크리너 표가 입력 뒤 수백 ms마다 다시 그려지고 화면이 수 초씩 멈춤 · 교훈 부분 갱신 이벤트(시세 전용)는 전체 재구성을 부르지 않고, 겹친 비싼 계산은 하나로 합친다. · 검사 ci-screener-workbench-contract, ci-screener-extended-browser-check · 파일 src/app/bootstrap.js, src/ui/pages/screener.js, scripts/ci-screener-workbench-contract.mjs, scripts/ci-screener-extended-browser-check.mjs, scripts/ci-screener-auto-refresh-browser-check.mjs
## P1913 - v58.03 - 거시·브리핑·포트폴리오 해석이 서로 다른 기준·월·가중을 써서 판정이 어긋남 · 교훈 같은 개념은 한 곳에서 계산하고 결측은 추정·중립값이 아니라 보류로 둔다. · 검사 ci-esm-core-unit-check, ci-scenario-guidance-fixture, ci-review-integrity-unit-check · 파일 scripts/lib/market-analysis-validate.mjs, scripts/ci-esm-core-unit-check.mjs, scripts/ci-scenario-guidance-fixture.mjs, scripts/ci-review-integrity-unit-check.mjs
## P1912 - v58.02 - VCP 수축 탐지가 다음 조정을 첫 스윙 고점에서 시작해 피벗이 실제 고점보다 낮게 찍힘 · 교훈 한 판정의 입력 구간은 그 판정이 정의한 구조(가장 높은 스윙 고점)를 따라야 한다. · 검사 ci-esm-core-unit-check · 파일 src/domain/technical/definitions.js, scripts/ci-esm-core-unit-check.mjs
## P1911 - v58.01 - 후보 기록 모델 정체성이 미국 모델만 담아 한국 모델 변경이 기록 평균에 섞임 · 교훈 한 기록 모집단의 모델 정체성은 그 모집단에 섞인 모든 시장의 적용 모델을 담아야 한다; 팩터 라벨은 실제 계산을 서술한다. · 검사 ci-candidate-archive-check, ci-screener-workbench-contract · 파일 src/domain/screener/model-fingerprint.js, scripts/lib/candidate-archive.mjs, src/ui/pages/screener.js, scripts/ci-candidate-archive-check.mjs, scripts/ci-screener-workbench-contract.mjs
## P1910 - v57.99 - SEC 재무 정규화가 USD 편의환산을 USD 보고로, 20-F 보통주 수를 ADS 가격 기준으로 읽음 · 교훈 한 레코드의 모든 피연산자는 한 택소노미·한 통화에서 온다(v6 소유자 결정); 가격 비율의 주식 수는 상장선과 같은 단위여야 한다. · 검사 ci-data-pipeline-contract-check
## P1909 - v57.94 - 주도 영역 이탈 판정이 하루 단위 확인 조건 때문에 이탈·약세를 오갔음 · 원칙 R707 · 교훈 R707 (판정에는 최근 움직임 점검과 창이 함께 있어야 함 · 뒤집히는 판정에는 이력) · 검사 ci-crash-replay-check · 파일 scripts/ci-crash-replay-check.mjs, scripts/ci-scenario-guidance-fixture.mjs
## P1908 - v57.93 - 기업·제품 분류 관계가 종류 없이 한 목록으로 묶임 · 교훈 구조 참조는 관계의 종류를 밝혀야 속성이 잘못 옮겨지지 않는다 · 파일 scripts/ci-atlas-contract-check.mjs, scripts/ci-knowledge-generated-parity-check.mjs
## P1907 - v57.93 - AI 원인 귀속 엔진이 경쟁 원인과 방향 없는 교차자산을 지지로 셈 · 원칙 R719 · 교훈 근거는 주장을 직접 지지해야 한다(시간 일치 ≠ 인과 지지) · 파일 scripts/ci-ai-intelligence-contract-check.mjs
## P1906 - v57.92 - 태블릿에서 학습 글의 다음 단계가 목록 뒤로 밀리고 13F 같은 회사 두 종목이 구분 안 됨 · 교훈 데스크톱·모바일·아이패드 반응형 지원(AGENTS 2026-10-11) · 파일 scripts/ci-review-integrity-unit-check.mjs
## P1905 - v57.92 - 스킬 평가 고정 목록이 새 스킬 3개를 빠뜨림 · 원칙 R27 · 교훈 R27 Commands↔Skills 동기화 · 파일 scripts/ci-skill-eval-fixture-check.mjs
## P1904 - v57.92 - 52주 범위 판정이 빈 행까지 기간으로 셈 · 원칙 R713 · 교훈 R713 기술 정의 단일화 — 52주는 240거래일 이상의 실제 범위 · 파일 scripts/ci-review-integrity-unit-check.mjs
## P1903 - v57.92 - 지식 근거 자동 연결이 다의어로 다른 분야 사실을 붙임 · 원칙 R718 · 교훈 근거는 주장을 직접 지지해야 한다(존재≠지지) · 파일 scripts/ci-review-integrity-unit-check.mjs, scripts/ci-knowledge-generated-parity-check.mjs
## P1902 - v57.91 - 브리핑 금 문장이 실질금리 자료가 있는데도 '실질금리 자료 미수신'으로 표시 · 교훈 관측일 정렬 가드는 비교(분해) 규칙에만 적용하고, 단일 계열의 자체 관측값을 지우지 않는다(입력이 있으면 '미수신'이라 말하지 않는다). · 파일 src/domain/briefing/market-read.js, public-data/data.json
## P1901 - v57.91 - 로딩·렉 — 첫 방문 새로고침 깜빡임, 휴대폰 뉴스 점수 36초 멈춤, 거래일 계산 반복, 레거시 행 50MB 복사 · 교훈 없음 — 측정 없이 누적된 반복 비용(자동화 브라우저에서는 QA 묶음까지 실려 실제 사용자 비용을 가렸음) · 파일 scripts/ci-runtime-contract-check.mjs
## P1900 - v57.90 - data-store SEC 원장 단일 파일 87.8MB — GitHub 100MB 푸시 거부까지 약 12MB · 원칙 R717 · 교훈 R717 · 검사 ci-sec-ledger-store-check · 파일 scripts/lib/sec-ledger-store.mjs, scripts/ci-sec-ledger-store-check.mjs
## P1899 - v57.89 - 13F 운용사 원장 50MB 초과 — blackrock-inc.json 60.5MB(jpmorgan-chase 45.6MB 근접)가 데이터 커밋 크기 게이트를 무력화 · 원칙 R717 · 교훈 R717 · 검사 ci-masters-manager-store-check · 파일 public-data/masters/managers/blackrock-inc.json, scripts/lib/masters-manager-store.mjs, scripts/split-masters-manager-rows.mjs
## P1898 - v57.88 - 작은 정합성 결함 묶음 — IFRS 자본 기준 표기, 오래된 분기의 후보 기록, 모듈 없을 때 VCP '패턴 없음', 차트 null 접근, 해설 검증 과매칭, 화면 이탈 뒤 재시도, 시점이 박힌 레거시 테마 설명 · 교훈 없음 — 개별 경계 처리 누락 · 검사 ci-candidate-archive-check, ci-data-pipeline-contract-check · 파일 scripts/ci-candidate-archive-check.mjs, scripts/ci-data-pipeline-contract-check.mjs
## P1897 - v57.88 - 자동화 경보 사각지대 — 배포 중 워치독 오탐, CI 실패로 배포가 멈춰도 갱신은 초록, 50MB 차단이 데이터 커밋을 멈출 위험 · 교훈 없음 — 진행 중 완화와 실패 전파의 적용 범위 누락 · 파일 public-data/masters/managers/blackrock-inc.json, scripts/ci-external-pipeline-check.mjs, scripts/ensure-live-convergence.mjs
## P1896 - v57.88 - 뉴스에 내부 키 $GE_VRN 배지, 한국어 회사명 미인식, 시세 페이지 통과 · 교훈 티커 추정 금지 — 내부 키를 티커처럼 노출
## P1895 - v57.88 - 화면끼리 같은 대상을 다르게 말함 — 다음 발표·섹터 창·스크리너 상위 수·과거 빈도·환율 축 · 교훈 없음 — 화면 간 같은 개념의 단일 정의 부재 · 검사 ci-scenario-guidance-fixture · 파일 scripts/ci-scenario-guidance-fixture.mjs
## P1894 - v57.88 - 한국 종목 장중 '전일 대비'가 건너뛴 거래일을 확인하지 않음 · 교훈 없음 — 주석의 조건이 코드에 없음 · 파일 src/ui/pages/entity.js
## P1893 - v57.88 - 판정 보류된 테마(한국 원전·건설 등)가 테마 단계판에서 사라짐 — '테마 46개' 중 43개만 표시 · 교훈 없음 — 새 상태값의 소비처 누락 (v57.87 회귀) · 파일 src/ui/components/theme-playbook.js
## P1892 - v57.88 - 코스피가 오른 날 한국 참여 해설이 '대형주에 하락이 몰렸다'고 씀 · 교훈 없음 — 방향 분기 누락 · 검사 ci-korea-participation-fixture · 파일 scripts/ci-korea-participation-fixture.mjs
## P1891 - v57.88 - 스크리너 후속 확인: 거래량 실린 하락일이 종목의 78%에 붙고, 베이스 실패·50일선 아래·문장 해석이 잘못 판정됨 · 원칙 R713 · 교훈 R713 — 기준값은 근거와 같은 정의여야 함 · 검사 ci-esm-core-unit-check · 파일 scripts/ci-esm-core-unit-check.mjs
## P1890 - v57.88 - AI 금지 주제 요청이 '감시 피하려면'·'왜 … 단계별로' 같은 표현으로 교육 질문으로 통과 · 교훈 없음 — 방어 예외가 실행 요청보다 우선함 · 검사 ci-ai-intelligence-contract-check · 파일 scripts/ci-ai-intelligence-contract-check.mjs
## P1889 - v57.87 - 한국 뉴스 예약 3칸을 같은 원·달러 환율 주제가 모두 차지하고, 시세 페이지가 기사로 통과함 · 교훈 없음 — 예약 슬롯 다양성 규칙 부재 · 검사 ci-data-pipeline-contract-check · 파일 scripts/ci-data-pipeline-contract-check.mjs
## P1888 - v57.87 - 한국 반도체 테마가 삼성 −16%·하이닉스 −30% 날에 '상대 방어'로, 5거래일 급락·자체 수익률 음수 테마가 '추세 속 조정 — 분할 먼저'로 읽힘 · 원칙 R706 · 교훈 R706 계열 — 같은 화면에서 서로 반대인 판정 · 검사 ci-scenario-guidance-fixture · 파일 scripts/ci-scenario-guidance-fixture.mjs
## P1887 - v57.87 - WTI가 5일 +7% 오르는데 시장·거시·브리핑이 'WTI 하락'으로 읽고, 1년 평균보다 24% 높은 유가가 '유가 안정' 충족으로 기록됨 · 교훈 없음 — 창(기간)과 수준을 함께 보지 않음 · 검사 ci-scenario-guidance-fixture · 파일 scripts/ci-scenario-guidance-fixture.mjs
## P1886 - v57.87 - AI 시장 해설이 WTI +3% 마감을 빠뜨리고, 화면이 중심 흐름 없음이라고 하는데 가장 가까운 흐름과 유리한 선택지를 결론처럼 씀 · 원칙 R706 · 교훈 R706 계열 — 화면 판정과 다른 결론을 같은 근거로 쓰지 않는다 · 검사 ci-data-pipeline-contract-check · 파일 scripts/ci-data-pipeline-contract-check.mjs
## P1885 - v57.87 - XOM이 지주회사 재편(8-K12B) 뒤 새 CIK로 매핑돼 연간 재무가 없다는 영구 미지원으로 남음 · 교훈 티커 추정 금지 — 이름이 아닌 8-K12B·CIK로 확인한 항목만 · 검사 ci-data-pipeline-contract-check
## P1884 - v57.87 - 급락 다음 날 AI 시장 해설이 장중 반등만 말하고 직전 완료 세션의 코스피 −7.6% 종가를 빠뜨림 · 원칙 R707 · 교훈 R707 (판정에는 최근 움직임 점검과 창이 함께 있어야 함) · 검사 ci-data-pipeline-contract-check · 파일 scripts/ci-data-pipeline-contract-check.mjs
## P1883 - v57.87 - 코스피 −7.6% 급락일 뉴스 묶음의 한국 3슬롯이 환율 기사로 채워지고 지수 급락 기사가 빠짐 · 교훈 없음 — 선정 규칙이 사건의 크기를 보지 않음 · 검사 ci-data-pipeline-contract-check · 파일 scripts/ci-data-pipeline-contract-check.mjs
## P1882 - v57.86 - 화면 사이 같은 사실을 서로 반대로 보이는 표기 네 건 · 원칙 R707 · 교훈 R707 (판정에는 최근 움직임 점검과 창이 함께 있어야 함)
## P1881 - v57.86 - 한국 종목 화면이 장중 내내 '전일 기준 미확인'으로 등락을 숨김 · 원칙 R709 · 교훈 R709 (기본 경로 숫자 렌더러는 부분 자료에 안전해야 함)
## P1880 - v57.86 - 스크리너 상위권 요약이 모르는 52주 값을 0%로 세고, 프리셋 두 개가 제 신호로 고르지 않았음 · 원칙 R709 · 교훈 R709 (기본 경로 숫자 렌더러는 부분 자료에 안전해야 함) · 검사 ci-screener-workbench-contract
## P1879 - v57.86 - 포트폴리오 보유 종목 시세 요청이 다른 시세 실행과 겹치면 버려져 한국 보유 종목이 계속 '가격 없음' · 원칙 R709 · 교훈 R709 (기본 경로 숫자 렌더러는 부분 자료에 안전해야 함) · 검사 ci-portfolio-vault-e2e
## P1878 - v57.86 - 1개월 동안 지수보다 크게 뒤처진 테마를 '상대 방어(덜 하락한 것)'로 읽음 · 원칙 R707 · 교훈 R707 (판정에는 최근 움직임 점검과 창이 함께 있어야 함) · 검사 ci-scenario-guidance-fixture · 파일 scripts/ci-scenario-guidance-fixture.mjs
## P1877 - v57.86 - 거시 시나리오가 빠른 확대만으로 신용 경색을 세우고, 자기 입력으로 '시장 가격도 이 방향'을 확인했음 · 원칙 R707 · 교훈 R707 (판정에는 최근 움직임 점검과 창이 함께 있어야 함) · 검사 ci-scenario-guidance-fixture · 파일 scripts/ci-scenario-guidance-fixture.mjs
## P1876 - v57.86 - 52주 전체 기간 하한 252세션이 생산자의 1년치(251/245봉)보다 커서 전 종목 52주 값·VCP 단계가 비었음 · 원칙 R3, R716 · 교훈 R3 (회귀 게이트가 실제 입력 길이로 검사하지 않음)
## P1875 - v57.86 - IFRS·비USD 공시 종목(TSM·ASML·SAP·NVO·HSBC 등)이 SEC 재무 없음으로 남아 미국 핵심 순위에서 보류됨 · 교훈 원천 없는 위젯·근거 없는 등급 제거 원칙의 반대편 — 근거가 있는 공시를 택소노미·통화 고정 때문에 버렸다 · 검사 ci-data-pipeline-contract-check · 파일 src/domain/fundamental/sec-normalize.js
## P1874 - v57.85 - 테마 단계·RRG 사분면·VCP 피벗이 정의 조건 없는 이름을 붙임(지수와 동행인데 약세, 하락 중인데 주도, 띠보다 큰 잡음에 사분면이 매일 바뀜, 화면마다 다른 피벗) · 원칙 R707, R713, R714 · 교훈 R713(정의 조건 없는 판정 이름), R707(잡음 버퍼·이력), R714(단일 정의) · 검사 ci-scenario-guidance-fixture, ci-chart-scenarios-fixture, ci-rotation-history-check, ci-esm-core-unit-check · 파일 scripts/ci-scenario-guidance-fixture.mjs, scripts/ci-chart-scenarios-fixture.mjs, scripts/ci-rotation-history-check.mjs, scripts/ci-esm-core-unit-check.mjs, scripts/ci-data-pipeline-contract-check.mjs, scripts/ci-decomp-hotspot-check.mjs
## P1873 - v57.85 - SEC 재무 정규화 실패 112종목 중 미국 종목 다수가 한 달째 재검사되지 않았고, 지역은행은 매출 개념이 없어 실패하거나 수수료 소계를 매출로 씀 · 교훈 데이터 품질은 수집 범위가 아니라 실제 입력으로 판정한다 — 개념 세트 변경이 재검사로 이어지는지 측정하지 않았다 · 검사 ci-data-pipeline-contract-check · 파일 src/domain/fundamental/sec-report.js, scripts/fetch-sec-fundamentals.mjs
## P1872 - v57.85 - 종합 순위가 가격 신호만으로 계산되고 펀드·SPAC이 주식과 한 순위에 섞임 · 원칙 R713, R715 · 교훈 R713(임계값은 공용 상수에서 읽는다) — 같은 필드의 신선도 기한이 레지스트리와 순위 모델에 따로 있었다. · 검사 ci-screener-workbench-contract, ci-candidate-archive-check
## P1871 - v57.85 - 같은 기술 지표가 모듈마다 다르게 정의되어 차트·스크리너·요약·테마 화면이 같은 종목·섹터를 다르게 판정함 · 원칙 R713, R352, R714 · 교훈 R713(임계값은 공용 상수), R352(병렬 모델 금지), P1428(252봉 미만은 52주 아님) · 검사 ci-chart-scenarios-fixture, ci-scenario-guidance-fixture, ci-data-pipeline-contract-check · 파일 src/domain/technical/definitions.js, scripts/ci-chart-scenarios-fixture.mjs, scripts/ci-scenario-guidance-fixture.mjs, scripts/ci-esm-core-unit-check.mjs, scripts/ci-data-pipeline-contract-check.mjs, scripts/ci-entity-summary-fixture.mjs
## P1870 - v57.84 - AI 요청 분류가 방어 교육과 단순 공시 언급을 차단·법률 모드로 보냄 · 교훈 번호 규칙 없음 — 안전 게이트 오탐·미탐. · 검사 ci-ai-intelligence-contract-check
## P1869 - v57.85 - 거시 게이지와 브리핑 문장이 축 판정과 다른 임계값을 사용 · 원칙 R713 · 교훈 R713 · 검사 ci-scenario-guidance-fixture · 파일 scripts/ci-scenario-guidance-fixture.mjs, scripts/ci-esm-core-unit-check.mjs
## P1868 - v57.84 - 브리핑 문장 규칙과 종합 라벨이 비대칭 · 원칙 R713 · 교훈 R713(같은 검토에서 만든 판정 정의 규칙).
## P1867 - v57.84 - 스크리너 프리셋이 같은 종합 순위를 네 번 거른 것에 불과 · 교훈 번호 규칙 없음. · 검사 ci-screener-workbench-contract
## P1866 - v57.84 - AI 답변 행동 게이트가 일반 문장을 매매 지시로 오인 · 교훈 번호 규칙 없음 — 안전 게이트 오탐. · 파일 js/aio-chat.js
## P1865 - v57.84 - 13F 스타일 분류와 지연 설명이 실제와 다름 · 교훈 번호 규칙 없음.
## P1864 - v57.84 - 포트폴리오가 선언된 환율 경로가 없으면 계산 거부 · 교훈 번호 규칙 없음. · 검사 ci-esm-core-unit-check, ci-portfolio-vault-e2e
## P1863 - v57.84 - 컨센서스 PER이 가격 날짜 없이도 계산되고 금융주 규칙이 누락 · 원칙 R709 · 교훈 R709(검증할 수 없으면 계산하지 않는다).
## P1862 - v57.84 - 종목·테마 판정이 화면마다 다른 정의를 사용 · 원칙 R709 · 교훈 R709(결측은 판단 보류).
## P1861 - v57.84 - 차트 돌파 상태가 사실상 도달 불가 · 교훈 번호 규칙 없음. · 검사 ci-chart-scenarios-fixture
## P1860 - v57.84 - 시장 건강 점수가 SPY 가격을 S&P 지수 이동평균과 비교 · 원칙 R614 · 교훈 R614(비교하는 두 값은 같은 단위·같은 원천). · 검사 ci-esm-core-unit-check
## P1859 - v57.84 - 판정 이름이 그 이름을 정의하는 조건 없이 붙음 · 원칙 R713 · 교훈 번호 규칙 없음 — 새 규칙 R713. · 검사 ci-scenario-guidance-fixture
## P1858 - v57.84 - 분해·텍스트 핀 게이트를 서식 변경으로 통과 가능 · 원칙 R620 · 교훈 R620 분해 래칫, v57.54 텍스트 핀 래칫. · 검사 ci-decomp-hotspot-check, ci-text-pin-ratchet-check
## P1857 - v57.84 - AI 403 'forbidden' 응답을 지역 차단으로 오분류 · 원칙 R292 · 교훈 R292(분류는 공급자 자신의 오류 서명으로만). · 파일 js/aio-tests.js
## P1856 - v57.84 - 의미 검토 게이트가 얕은 테스트를 지키고 인증을 원천 차단 · 교훈 번호 규칙 없음 — 게이트가 개선을 실패로 만드는 역유인(Goodhart). · 검사 ci-semantic-review-check · 파일 scripts/ci-semantic-review-check.mjs
## P1855 - v57.84 - 원장 파서가 규칙 60개를 없는 번호로 동결 · 원칙 R1, R53, R172, R178, R111, R113, R136, R137, R171, R230, R301, R709, R710, R618 · 교훈 R618 원장 루프(게이트가 원장의 실제 구조를 읽어야 한다). · 검사 ci-ledger-integrity-check · 파일 scripts/ci-ledger-integrity-check.mjs
## P1854 - v57.83 - 주도주 약세를 유지로 표시 · 원칙 R707, R706 · 교훈 R707 여유 구간·이름 붙은 창, R706 근거 없는 주도 주장 금지. · 검사 ci-scenario-guidance-fixture, ci-crash-replay-check
## P1853 - v57.83 - 매매 점수 추세 항목 여유 구간·200일선 아래 상한 · 원칙 R707, R708 · 교훈 R707 판정 여유 구간과 화면 간 일관성. · 검사 ci-crash-replay-check
## P1852 - v57.83 - 운영 도착률 분모 소급·Worker dispatch 제외 · 원칙 R701 · 교훈 R701 PASS와 운영 건강의 구분. · 검사 ci-operations-slo-window-check
## P1851 - v57.83 - 홈 내 종목 8개 이후·빈 일정 구분 · 교훈 번호 규칙 없음 — 빈 상태가 원인(미수신·로딩·0건)을 구분. · 검사 ci-esm-core-unit-check
## P1850 - v57.83 - 전일 종가 보정 경고 반복 · 원칙 R701 · 교훈 R701 경고 신호의 신뢰성.
## P1849 - v57.83 - Workers AI 번역 한도·중단 제어 없음 · 교훈 번호 규칙 없음 — 유료·한도 경로의 비용 경계. · 검사 ci-worker-relay-check
## P1848 - v57.83 - 근거 팝업 신선도와 발행 주기 불일치 · 원칙 R707 · 교훈 R707 판정 창 명시. · 검사 ci-scenario-guidance-fixture, ci-atlas-contract-check, ci-esm-core-unit-check
## P1847 - v57.83 - 브리핑 원시 evidence ID 노출 재발 · 교훈 번호 규칙 없음 — 내부 식별자를 읽는 사람에게 노출하지 않음. · 검사 ci-codex-structure-regression-fixture
## P1846 - v57.83 - 표본 없는 정성 확률 문장 · 원칙 R706 · 교훈 R706 근거 없는 확률 표현 금지. · 검사 ci-scenario-guidance-fixture
## P1845 - v57.83 - 미국 보유 하락 비율 분모 · 교훈 번호 규칙 없음 — 비율의 분모는 그 비율이 말하는 집합. · 검사 ci-review-integrity-unit-check
## P1844 - v57.83 - 발표된 지표를 다음 발표로 안내 · 원칙 R707 · 교훈 R707 판정 기준 시각 명시. · 검사 ci-scenario-guidance-fixture
## P1843 - v57.83 - 신용 부담 원인 오설명 · 원칙 R707 · 교훈 R707 판정 근거와 문장의 일치. · 검사 ci-scenario-guidance-fixture
## P1842 - v57.83 - 겹치는 표본의 표준오차와 작은 표본 표기 · 원칙 R706 · 교훈 R706 겹치지 않는 사례와 표본 크기 표기. · 검사 ci-esm-core-unit-check, ci-scenario-guidance-fixture
## P1841 - v57.83 - MWR 기간 초 첫날 입금 누락 · 교훈 번호 규칙 없음 — 같은 기간의 두 수익률은 같은 현금흐름 창. · 검사 ci-esm-core-unit-check
## P1840 - v57.83 - AI 대화 기록 삭제·용량 초과·고지 불일치 · 교훈 번호 규칙 없음 — 저장·전송 고지의 정확성, WCAG 4.1.3 상태 메시지. · 검사 ci-ai-intelligence-contract-check
## P1839 - v57.83 - DOMPurify 3.0.9 알려진 취약점 · 교훈 번호 규칙 없음 — 고정한 외부 의존성의 보안 권고 확인. · 파일 index.html, js/aio-tests.js
## P1838 - v57.82 - The first live US listing dropped NYSE Texas listings such as ET · 원칙 R663 · 교훈 R663 exact registry match: a listed security must be accepted. · 검사 ci-us-listings-check · 파일 scripts/ci-us-listings-check.mjs
## P1837 - v57.81 - history.json held one session under two dates · 원칙 R447 · 교훈 R447 market time fields. · 검사 ci-esm-core-unit-check, ci-history-field-time-contract-check · 파일 src/domain/market/history-session.js, scripts/ci-history-field-time-contract-check.mjs
## P1836 - v57.81 - Touch devices lost basis cards, scroll position and folds · 교훈 Responsive parity (AGENTS, 2026-10-11). · 검사 ci-touch-ergonomics-browser-check, ci-responsive-browser-check · 파일 scripts/ci-touch-ergonomics-browser-check.mjs, scripts/ci-responsive-browser-check.mjs
## P1835 - v57.81 - Portfolio allocation card overflowed onto 섹터 배분 · 교훈 Responsive parity (AGENTS). · 검사 ci-portfolio-vault-e2e, ci-responsive-browser-check · 파일 scripts/ci-responsive-browser-check.mjs
## P1834 - v57.81 - Portfolio entry rejected listed symbols such as SPCX · 원칙 R663 · 교훈 R663 exact registry match. · 검사 ci-portfolio-vault-e2e, ci-esm-core-unit-check · 파일 scripts/ci-portfolio-vault-e2e.mjs
## P1833 - v57.81 - Portfolio and Korea reads ignored the Korean crash day · 원칙 R707 · 교훈 R707 (v57.81). · 검사 ci-korea-participation-fixture, ci-review-integrity-unit-check, ci-desktop-continuity-check, ci-data-pipeline-contract-check · 파일 scripts/ci-korea-participation-fixture.mjs, scripts/ci-review-integrity-unit-check.mjs
## P1832 - v57.81 - Stock and screener labels stayed favorable through breakdowns · 원칙 R707 · 교훈 R707 (v57.81). · 검사 ci-esm-core-unit-check · 파일 src/domain/technical/bands.js, scripts/ci-esm-core-unit-check.mjs, scripts/ci-entity-quality-browser-check.mjs
## P1831 - v57.81 - Macro scenarios ranked without their defining condition · 원칙 R707 · 교훈 R707 (v57.81). · 검사 ci-scenario-guidance-fixture · 파일 src/domain/macro/macro-signals.js, scripts/ci-scenario-guidance-fixture.mjs
## P1830 - v57.81 - Themes, sectors and the AI called falling leaders 주도 · 원칙 R707 · 교훈 R707 (v57.81). · 검사 ci-scenario-guidance-fixture · 파일 src/domain/themes/recent-check.js, scripts/ci-scenario-guidance-fixture.mjs
## P1829 - v57.81 - Market judgements flipped inside daily noise and missed a leadership break · 교훈 AGENTS Likelihood/Screen design: a judgement must not overstate its evidence. · 검사 ci-scenario-guidance-fixture, ci-esm-core-unit-check · 파일 scripts/ci-scenario-guidance-fixture.mjs, scripts/ci-esm-core-unit-check.mjs
## P1828 - v57.80 - The data watchdog went red whenever it ran while a fresh push was still in CI · 원칙 R657 · 교훈 Operations alerts fail closed on real staleness, not on a deploy in flight (R657). · 파일 scripts/ci-external-pipeline-check.mjs
## P1827 - v57.79 - Phone and chart layout defects found in the screen review · 교훈 Responsive layout and one state at a time; values carry their basis. · 검사 ci-esm-core-unit-check, ci-architecture-browser-check · 파일 scripts/ci-architecture-browser-check.mjs, scripts/ci-responsive-browser-check.mjs
## P1826 - v57.79 - Internal lineage metadata appeared as a visible reader card · 교훈 No developer copy on user surfaces (AGENTS Screen design). · 검사 ci-esm-core-unit-check · 파일 scripts/ci-esm-core-unit-check.mjs
## P1825 - v57.79 - A manual refresh kept serving pre-refresh validation artifacts for up to 6 hours · 교훈 A manual refresh must show newly published data. · 검사 ci-artifact-cache-check · 파일 scripts/ci-artifact-cache-check.mjs
## P1824 - v57.79 - Past-frequency lines turned 3-9 cases into hit rates and "mostly" claims · 교훈 AGENTS Likelihood: past frequency with sample size; small samples must not read as frequencies. · 검사 ci-scenario-guidance-fixture · 파일 scripts/ci-scenario-guidance-fixture.mjs
## P1823 - v57.77 - The artifact cache never hit and the screener re-downloaded 3 MB on every visit · 교훈 A cache must be keyed by a stable identity. · 검사 ci-artifact-cache-check · 파일 scripts/ci-artifact-cache-check.mjs
## P1822 - v57.77 - Data-pipeline audit permanently reported a missing function · 교훈 An audit must not report a permanent false alarm. · 파일 scripts/ci-headless-tests.mjs
## P1821 - v57.77 - WCAG AA failures on news links, radar, theme chips and headings · 교훈 WCAG AA 1.4.3, 2.5.3, 4.1.2, 1.3.1 on default paths. · 검사 ci-accessibility-matrix-check · 파일 scripts/ci-accessibility-matrix-check.mjs
## P1820 - v57.77 - Legacy updateRiskMonitor raced the native macro renderer on the same data-snap sinks · 교훈 One writer per DOM sink once a native renderer owns it. · 검사 ci-architecture-contract-check · 파일 scripts/ci-architecture-contract-check.mjs
## P1819 - v57.76 - The sector RRG scatter chart was visible only in developer mode · 교훈 A section visual must be reachable on the default path, not only in developer mode. · 검사 ci-architecture-contract-check, ci-architecture-browser-check · 파일 scripts/ci-architecture-contract-check.mjs
## P1818 - v57.75 - Korea FX axis read 양호 (won strong) on a crash day when the won had turned weak · 교훈 A favorable verdict must not contradict the latest session. · 검사 ci-esm-core-unit-check · 파일 scripts/ci-esm-core-unit-check.mjs
## P1817 - v57.75 - Breadth segment stamped with the newest row date while most rows held the previous session · 교훈 A summary is dated by the session its values describe. · 검사 ci-data-pipeline-contract-check · 파일 scripts/ci-data-pipeline-contract-check.mjs
## P1816 - v57.75 - A retained market reading was re-served without checking it against the new data · 교훈 Retained output must pass the same gate as fresh output. · 검사 ci-data-pipeline-contract-check · 파일 scripts/ci-data-pipeline-contract-check.mjs
## P1815 - v57.75 - Causal attribution check fooled by citation ids and refusals; KOSPI intraday cause taken from pre-session headlines · 교훈 Validators read prose, not markup; a cause must come from evidence observed after the move. · 검사 ci-data-pipeline-contract-check · 파일 scripts/ci-data-pipeline-contract-check.mjs
## P1814 - v57.75 - Retired personal data keys still read through DATA_APIS and the Vault restore · 교훈 A retirement must close every read path, not only the getter. · 검사 ci-extension-api-runtime-check · 파일 scripts/ci-extension-api-runtime-check.mjs
## P1813 - v57.71 - 용어 팝업에서 Tab을 누르면 포커스가 문서 끝(BODY)으로 빠짐 · 교훈 없음
## P1812 - v57.70 - 텔레그램 요약에 이모지·구분선·중국어 원문이 그대로 노출 · 교훈 없음 · 검사 ci-data-pipeline-contract-check
## P1811 - v57.70 - SPY 등 지수 추종 상품을 같은 지수와 비교해 "S&P 500보다 0.0%p 높음" 표시 · 교훈 없음 · 검사 ci-data-pipeline-contract-check · 파일 scripts/ci-data-pipeline-contract-check.mjs
## P1810 - v57.70 - Visa 등 결제망·거래소에 은행용 순이자마진 해석이 붙음 · 교훈 없음 · 검사 ci-data-pipeline-contract-check
## P1809 - v57.70 - 컨센서스 직전 4개 분기 합과 향후 예상 합의 기준이 달라 GOOGL "직전 PER 17.8배·예상 이익 -35%"로 표시 · 교훈 없음 · 검사 ci-data-pipeline-contract-check · 파일 scripts/ci-data-pipeline-contract-check.mjs
## P1808 - v57.70 - 테마 상세 구성 종목 48개가 계속 "시세 대기"로 비어 있음 · 교훈 없음 · 검사 ci-data-pipeline-contract-check
## P1807 - v57.70 - #fundamental/AAPL 주소가 종목을 무시하고 직전 선택(또는 빈 화면)을 표시 · 교훈 없음 · 검사 ci-data-pipeline-contract-check
## P1806 - v57.70 - 스크리너 헤더가 최신 1개 행의 날짜(10/14)를 미국 팩터 세션으로 표시하고 실제 순위는 10/13 기준 · 교훈 없음 · 검사 ci-data-pipeline-contract-check · 파일 scripts/ci-data-pipeline-contract-check.mjs
## P1805 - v57.70 - 장중에 기록한 직전 종가가 다음 날짜로 밀려 브리핑의 WTI·금·달러 1일 변화가 0.0%로 굳음 · 교훈 없음 · 검사 ci-data-pipeline-contract-check · 파일 scripts/ci-data-pipeline-contract-check.mjs
## P1804 - v57.69 - 한국 주요 경제지·통신이 tier 3으로 분류돼 코스피 급락 아침 장중 속보 슬롯에 한국 기사가 0건 · 교훈 없음(출처 분류 목록 누락) · 검사 ci-data-pipeline-contract-check · 파일 scripts/ci-data-pipeline-contract-check.mjs
## P1803 - v57.69 - 헤드라인 번역에 태국어·한자·가나가 섞인 결과가 한국어로 통과되고 다음 실행에도 재사용됨 · 교훈 없음(출력 검증 부족) · 검사 ci-data-pipeline-contract-check · 파일 scripts/ci-data-pipeline-contract-check.mjs
## P1802 - v57.69 - 시장 폭 기여 종목 산출물이 판정 대상 1개 세션(10/14)을 게시해 화면이 10/13 수치와 10/14 분모를 섞음 · 교훈 없음(두 생산 경로의 표본 규칙 불일치) · 검사 ci-data-pipeline-contract-check · 파일 scripts/ci-data-pipeline-contract-check.mjs
## P1801 - v57.69 - 거시 갈림길이 근원 PCE만으로 '물가 둔화'를 판정해 핫 CPI 다음 날에도 softland가 선두 · 교훈 없음(판정 입력 누락) · 검사 ci-scenario-guidance-fixture · 파일 scripts/ci-scenario-guidance-fixture.mjs
## P1800 - v57.69 - 급락일 AI 시장 해설이 핫 CPI를 '물가 둔화 경로'로 쓰고 원인·코스피 급락을 빠뜨린 채 검증됨으로 게시 · 교훈 없음(검증 규칙 공백) · 검사 ci-data-pipeline-contract-check · 파일 scripts/ci-data-pipeline-contract-check.mjs
## P1799 - v57.68 - 한국 지수 장 초반 전일 대비 등락률이 이틀 전 종가 기준으로 계산됨 · 교훈 없음(공급자 일봉 막대 시점 가정) · 검사 ci-data-pipeline-contract-check · 파일 scripts/ci-data-pipeline-contract-check.mjs
## P1798 - v57.66 - 다중 클래스 메가캡(GOOGL·META·V 등)의 SEC 주식 수 공백 — 시총·PER·가치 팩터 빈칸 · 교훈 없음(데이터 원천 범위 한계 + 재수집 순서) · 검사 ci-data-pipeline-contract-check · 파일 scripts/ci-data-pipeline-contract-check.mjs
## P1797 - v57.65 - 테마 상세를 닫은 뒤 포커스가 가끔 문서 본문으로 떨어짐(CI 간헐 실패 재발) · 교훈 focus() 호출은 성공을 보장하지 않는다 — 복원 루프는 document.activeElement로 결과를 확인한 뒤 끝낸다
## P1796 - v57.65 - SEC 원장 게이트가 git-ignored 낡은 로컬 원장을 정본으로 읽어 오탐 실패 · 교훈 P1757 계약(CI는 manifest digest가 일치하는 원장만 복원)이 로컬 읽기 경로에는 적용되지 않았다. · 검사 ci-data-pipeline-contract-check · 파일 scripts/ci-sec-runtime-projection-check.mjs, public-data/sec-fundamentals.json, scripts/lib/sec-ledger.mjs
## P1795 - v57.64 - 홈 VIX 칸이 게시된 종가가 있어도 '—'로 남음 · 교훈 표시 칸은 자기 데이터가 도착하는 모든 경로에서 칠해져야 한다 — 전체 재그리기에 묶인 칸은 그 재그리기를 건너뛰는 런타임에서 비어 있다
## P1794 - v57.63 - 무료 뉴스 번역(Workers AI)이 매번 실패하고 유료 OpenAI로 넘어감 · 교훈 외부 모델을 고를 때는 계정에서 실제로 호출 가능한지 확인한다
## P1793 - v57.61 - AI 답변 자동 재시도가 늘 409로 실패하고 다시 물으면 한도가 두 번 차감됨 · 교훈 한 질문은 한 번만 센다(재시도는 같은 질문) · 파일 worker/openai-contract.test.mjs
## P1792 - v57.60 - 배포 진행 중에 데이터 감시가 버전 불일치로 실패함 · 교훈 진행 중인 배포는 실패가 아니라 대기 상태로 읽는다
## P1791 - v57.60 - 한국 테마 칩을 누르면 '채팅 입력창 DOM 부재' 토스트만 뜸 · 교훈 입력 경로를 통합할 때 모든 호출자를 새 경로로 옮긴다
## P1790 - v57.59 - 거시 _failedSeries가 지난 실행의 실패를 계속 끌고 감 · 교훈 실패 표시는 현재 실행의 사실만 말한다
## P1789 - v57.59 - 장기 거시 이력이 생산되자 CI가 실패해 v57.58 Pages 배포가 건너뛰어짐 · 교훈 자료가 생겨야 나타나는 화면 그룹은 게이트 허용 목록에 함께 등록한다
## P1788 - v57.59 - VIX 미수신이 초록색 '0.00'으로 표시됨 · 교훈 없는 값을 0으로 채우지 않는다 · 파일 js/aio-data.js
## P1787 - v57.59 - 테마 상세를 닫은 뒤 포커스가 사라지는 간헐 실패(CI browser-knowledge) · 교훈 닫기 후 포커스는 현재 DOM의 같은 트리거로 돌아가야 한다(재렌더 후 포함)
## P1786 - v57.58 - 한국 보유 종목(105560)이 평가액 없이 '—'로 남음 · 교훈 값을 못 받은 이유가 자료 부재가 아니라 규칙 불일치면 표시 등급을 낮춰서라도 보여 준다
## P1785 - v57.56 - SPY 단계 카드가 이동평균 배열을 'Weinstein Stage'로 표기 · 원칙 C19, R675 · 교훈 만든 이름표는 실제 표시 경로에 연결한다(R675)
## P1784 - v57.56 - ETF(SPY) 화면이 '기업 요약·재무 분석·AI로 기업 분석·같은 섹터(ETF) 비교'로 표시 · 교훈 화면 문구는 자산 유형에 맞춘다
## P1783 - v57.56 - 금리 질문 답변에 '최신 수치 확인 안 됨'이 붙고 화면의 20거래일 변화를 쓰지 못함 · 교훈 화면에 보이는 숫자는 AI도 같은 근거로 인용할 수 있어야 한다 · 검사 ci-ai-intelligence-contract
## P1782 - v57.56 - Forward PER의 '향후 4개 분기'에 이미 끝난 분기가 들어 있음(AMD 2026-09~) · 교훈 기간 이름은 실제 포함 범위를 말한다
## P1781 - v57.56 - BRK.B·BF.B로 찾으면 이름·데이터 없는 빈 종목 화면 · 교훈 티커는 정확히 일치할 때만 열되, 같은 종목의 표기 차이는 목록 기준으로 맞춘다
## P1780 - v57.56 - 스크리너 첫 화면이 자체 검증에서 진 순위로 정렬돼 GME·AMC가 맨 위 · 교훈 검증에서 효과가 확인되지 않은 순위를 기본 읽기 순서로 쓰지 않는다
## P1779 - v57.55 - 종목 검색 '삼성'은 1초 알림만 뜨고, 없는 티커는 '잠시 후 다시'로 안내 · 교훈 티커는 정확히 일치할 때만 열고, 후보는 사용자가 고른다
## P1778 - v57.55 - 스크리너 가격 칸이 —로 비고, '추세 양호'가 50일선 아래 종목에 붙으며, 한글 이름 검색이 안 되고, 밸류·퀄리티 열이 전부 — · 교훈 표의 라벨은 같은 행의 숫자와 모순되지 않고, 근거 없는 열은 보이지 않는다 · 검사 ci-desktop-continuity
## P1777 - v57.55 - 기기 다크 설정을 무시하고, 다크 모드에서 스크리너 활성 칩·'종가' 칩·빨간 글자가 읽기 어려움 · 교훈 다크 테마에도 WCAG AA 대비를 지킨다
## P1776 - v57.55 - 실적 메모가 무관한 기사에 붙고, 정치 글·잡담이 텔레그램 목록에 올라옴 · 교훈 기사 옆 맥락 줄은 그 기사의 주어에만 붙는다
## P1775 - v57.55 - 금리 갈림길과 시나리오가 정책 경로를 빼고, 필수 조건이 깨진 흐름을 3/4로 부르며, 같은 지표를 두 번 세고, 고용 상태를 둘로 씀 · 교훈 판정 문장은 정책 경로·수준·필수 조건을 함께 보고, 같은 근거를 두 번 세지 않는다
## P1774 - v57.55 - 분기 추세 문장이 데이터와 반대로 '빨라졌다'고 씀(MRNA +260% → +2.1%) · 교훈 추세 문장은 그 근거 숫자와 같은 방향이어야 한다
## P1773 - v57.55 - 같은 날 시장 상태 집계가 종목 차트 탭·포트폴리오(우호 3)와 오늘·시장 상태(우호 2·중립 2)에서 다름 · 교훈 같은 사실은 모든 화면이 같은 판정기와 같은 입력에서 읽는다
## P1772 - v57.55 - 첫 방문 면책 고지 띠가 AI 입력창과 전송 버튼을 가림 · 교훈 알림 띠는 입력 컨트롤을 덮지 않는다
## P1771 - v57.55 - 포트폴리오 보유 종목이 끝내 —로 남고, 한국 6자리 종목은 시세를 받지 못하며, 점검 카드가 현금·쏠림을 잘못 판정 · 교훈 평가할 수 없는 값은 판정에 쓰지 않고, 입력한 값은 '미입력'으로 부르지 않는다
## P1770 - v57.55 - WTI 20거래일 변화율이 화면마다 −7.2/−11.0/−11.4%로 다름 · 교훈 N거래일 변화는 한 헬퍼(sessionPointBack)로만 계산한다
## P1769 - v57.55 - #ticker/NVDA 주소가 빈 화면이 되고, 없는 주소는 이전 화면을 잘못된 주소 아래 남김 · 교훈 모든 주소는 실제 화면 하나로 끝난다 — 빈 화면이나 이전 화면을 남기지 않는다
## P1768 - v57.54 - 분석 노트 검색 색인이 LESSONS에서 만들어지면서도 동기화 검사 대상이 아니어서 2026-10-11 패킷 노트 5개가 검색되지 않음 · 교훈 원천에서 생성되는 산출물은 그 원천을 바꾸는 변경과 같은 동기화 검사에 묶인다 · 검사 ci-knowledge-generated-parity-check · 파일 public-data/knowledge/search-index.json
## P1767 - v57.54 - 예약 AI 시장 분석이 직전 결과로 유지되면 운영 상태 산출물이 계약 검증에 걸려 그 회차 데이터 갱신 전체가 실패함 · 교훈 운영 상태 산출물은 스스로 선언한 어휘로만 상태를 게시한다 · 검사 ci-operations-status-check
## P1766 - v57.54 - AI 번역 응답이 배치의 일부 기사를 빠뜨리면 그 기사는 캐시에도 대체 번역에도 들어가지 않고 사라짐 · 원칙 R245 · 교훈 R245: 화면에 보이는 뉴스는 번역 요청 경로를 가져야 함 / 실패는 명시적 대체로 처리 · 검사 ci-ai-chat-public-route-browser-check
## P1765 - v57.54 - 대시보드 '핵심 뉴스'의 영어 제목이 번역되지 않고 원문으로 계속 남음 · 원칙 R245 · 교훈 R245: 화면에 보이는 뉴스는 번역 요청 경로를 가져야 함 · 검사 ci-data-pipeline-contract-check
## P1764 - v57.54 - S&P 500 종가가 새 거래일로 넘어간 뒤 시장 폭이 도착하기 전까지 대시보드 시장 폭 카드가 통째로 사라지고, 같은 이유로 CI가 실패해 그 시간대의 배포가 모두 막힘 · 교훈 AGENTS: 신선도(날짜가 붙은 직전 값은 참고로 표시) / 데이터 갱신이 배포를 막지 않아야 함 · 검사 ci-esm-core-unit-check, ci-responsive-browser-check, ci-portfolio-vault-e2e
## P1763 - v57.54 - 단축키 도움말이 화면 통합 전 이름(시그널·매크로·테마·트렌드)과 숫자를 그대로 쓰고, 폰 상단 시각이 잘리며, 1px로 접힌 버튼 같은 렌더 결함을 잡는 게이트가 없음 · 교훈 AGENTS: 8화면 정보 구조 / WCAG 2.5.8 대상 크기 · 검사 ci-ui-render-hygiene-check, ci-ui-vocabulary-check, ci-ai-intelligence-contract-check, ci-responsive-browser-check · 파일 src/ui/navigation/screen-shortcuts.js, architecture/ui-vocabulary.json
## P1762 - v57.54 - 한국 종목 순위가 분모보다 크게(890/239) 나오고, 예측력이 없다고 스스로 밝힌 팩터 점수를 백분위·상위 1%처럼 보이며, 차트 첫 방문에서 라이브러리 실패 문구가 뜰 수 있음 · 교훈 AGENTS: 근거 없는 등급·점수 금지, 개발자 문구 금지 / WCAG 1.3.1 제목 구조 · 검사 ci-esm-core-unit-check, ci-screener-auto-refresh-browser-check, ci-ui-vocabulary-check
## P1761 - v57.54 - 같은 신용 지표를 화면마다 중립/경계로 다르게 부르고, 미국 장 시작 전 시세를 '종가'로 표기하며, 운영 사이트에서 영어 뉴스 제목 번역이 한 번도 요청되지 않음 · 교훈 AGENTS: 화면 정직성(한 가지 상태 어휘), 출처는 화면 밖, 읽기 길이 3–5줄, 근거 없는 대표 선택 금지 · 검사 ci-ui-vocabulary-check, ci-ui-render-hygiene-check, ci-regime-scenarios-fixture, ci-esm-core-unit-check · 파일 architecture/ui-vocabulary.json
## P1760 - v57.54 - 버전 숫자 없이 나간 코드 수정이 재방문자에게 닿지 않고, 숨은 탭에서 알림이 울릴 수 없으며, 검색 없는 재시도가 '검색했다'는 프롬프트로 나감 · 원칙 R1 · 교훈 R1 버전 동기화의 전제(코드 변경=버전 변경)가 실제 운영에서 깨짐 / AI 근거 정직성 · 검사 ci-service-worker-cache-policy-check, ci-runtime-contract-check, ci-chat-resilience-check, ci-ai-intelligence-contract-check · 파일 sw.js, index.html, src/app/background-alerts.js
## P1759 - v57.54 - Origin 헤더는 위조할 수 있어 한 접속이 공용 AI의 하루 한도(300회)를 모두 써 버릴 수 있었고, 예산이 바닥나기 직전까지 웹 검색을 그대로 사용 · 교훈 AGENTS: AI 공용 예산 월 $20(owner 2026-10-11) — 예산이 위조 가능한 경계에만 의존 · 검사 ci-worker-anthropic-check · 파일 worker/openai-contract.test.mjs
## P1758 - v57.54 - 일괄 시세 호출이 항상 401로 실패해 종목마다 따로 받았고, Worker가 전달한 원천의 404를 중계 장애로 보고 공개 프록시 3곳에 같은 요청을 다시 보냄 · 교훈 AGENTS: 비용·느린 데이터 정적화 / 화면 정직성(상태 색) / WCAG AA · 검사 ci-proxy-continuity-check, ci-ai-intelligence-contract-check, ci-runtime-contract-check
## P1757 - v57.54 - 새 가격이 없는 주말에도 30분마다 전체 갱신이 돌고, 브라우저가 읽지 않는 66.7MB SEC 원장이 하루 3번 main 이력에 커밋됨 · 교훈 AGENTS: 느린 데이터 정적화·비용 / 로컬 프로듀서 금지(생산은 Actions) · 검사 ci-data-pipeline-contract-check, ci-sec-runtime-projection-check, ci-professional-data-gap-check, ci-data-lineage-audit · 파일 public-data/sec-fundamentals.json, scripts/refresh-cadence.mjs, src/domain/market/market-calendar.js
## P1756 - v57.54 - 첫 화면이 쓰지 않는 글꼴 전체와 차트 라이브러리를 받고, 서버 뉴스가 이미 있는데도 브라우저가 RSS를 다시 모으며, 모두 실패하는 Stooq를 계속 부름 · 원칙 R620 · 교훈 AGENTS: 느린 데이터 정적화·비용(AI 월 $20) / R620 분해 래칫 · 검사 ci-proxy-continuity-check, ci-runtime-contract-check · 파일 index.html
## P1755 - v57.54 - 점수 하나를 읽으려고 전체 상태를 깊은 복제·동결하고, 뉴스마다 정규식을 새로 만들며, 서비스 워커가 재방문 때 모든 스크립트를 다시 내려받음 · 원칙 R620 · 교훈 AGENTS: 데스크톱·모바일·아이패드 반응형 지원(폰 성능) / R620 분해 래칫 · 검사 ci-esm-core-unit-check, ci-reference-adoption-contract-check, ci-service-worker-cache-policy-check, ci-runtime-contract-check · 파일 sw.js
## P1754 - v57.54 - index.html 스타일의 3분의 1이 쓰이지 않는 규칙이고, 고정 근흑색 리터럴이 다크 모드에서 테두리·구분선·배지를 지움 · 원칙 R620 · 교훈 소유자: 다크 모드 지원 / R620 분해 래칫 순감소 · 검사 ci-decomp-hotspot-check, ci-runtime-contract-check · 파일 index.html
## P1753 - v57.54 - 사용자에게 매번 내려가는 고전 스크립트에 호출자 없는 코드와 대상 없는 작성기가 남고, 차트 탭의 '심층 종목 기술 분석' 버튼이 v56.96 이후 아무 일도 하지 않음 · 원칙 R620 · 교훈 AGENTS: 원천 없는 위젯·근거 없는 표시 제거 / R620 분해 래칫(순감소) · 검사 ci-runtime-contract-check, ci-research-flow-contract-check, ci-data-pipeline-contract-check, ci-architecture-contract-check · 파일 index.html
## P1752 - v57.54 - 검증 파이프라인의 빨간 실행 대부분이 코드 결함이 아닌 거짓 실패이고, 실패해도 무엇을 해야 하는지 알려 주지 않음 · 원칙 R626, R1 · 교훈 R1 버전 동기화 단일 소유 / R626 생성물 충돌 필드 단위 / AGENTS: 기록 순서 bump → record-fix → generate-workspace-state · 검사 ci-generated-conflict-fixture, ci-qa-runner-behavior-check, ci-qa-pipeline-contract-check, ci-record-fix-check
## P1751 - v57.54 - Worker가 웹검색·긴 답변을 60초에 끊어 예약 비용을 날리고, 장부가 한 덩어리로 커지며, 업스트림 오류를 공개 캐시함 · 원칙 R606, R634 · 교훈 AGENTS 2026-10-11: AI 월 $20 예산 안에서 항상 사용 / R606 자동 수렴 / R634 신선도 엄격 · 검사 ci-13f-currentness-check, ci-data-pipeline-contract-check, ci-data-refresh-audit, ci-qa-pipeline-contract-check · 파일 worker/openai-contract.test.mjs
## P1750 - v57.54 - 다크 모드에서 주요 버튼이 보이지 않고, 화면 제목이 제목 요소가 아니며, 값이 채워지지 않는 위젯이 남아 있음 · 교훈 소유자: 다크 모드 지원 / 원천 없는 위젯 제거 / 최소 글자 12px / WCAG AA · 검사 ci-runtime-contract-check, ci-capability-claim-contract-check, ci-responsive-browser-check
## P1749 - v57.54 - 리서치 화면에 같은 목록이 세 번 나오고 제목·섹션명·입력창 표기가 제각각 · 교훈 소유자 2026-10-03: 섹션마다 시각 하나 + 짧은 해설 / 중복 제거 · 검사 ci-masters-contract-check, ci-atlas-contract-check, ci-principles-contract-check, ci-research-flow-contract-check
## P1748 - v57.54 - 종목·스크리너 화면에서 섹션 순서가 렌더마다 바뀌고 분모·PER 기준·용어가 화면 안에서 서로 맞지 않음 · 교훈 소유자 2026-10-14: 한 화면 안의 논리 일관성과 화면 간 유기적 연결 · 검사 ci-esm-core-unit-check, ci-entity-quality-browser-check, ci-architecture-browser-check, ci-screener-workbench · 파일 src/domain/scenarios/theme-stage.js
## P1747 - v57.54 - 거시 갈림길이 동점을 숨기고 같은 8갈래를 두 번 보이며, 테마 회전 문장이 국내 현상을 시장 전체처럼 읽게 함 · 교훈 소유자 2026-10-14: 애매하면 안 하느니 못함 — 근거와 결론, 화면 간 연결이 일관돼야 함 · 검사 ci-scenario-guidance-fixture, ci-esm-core-unit-check
## P1746 - v57.54 - 오늘·시장 상태 화면에서 '지금 구조'와 '앞으로의 갈림길'이 따로 놀고 문구·순서·날짜 형식이 화면마다 다름 · 교훈 소유자 2026-10-14: 새 기능이 기존 화면에 녹아들게, 문구·시각 하나하나와 인과 흐름 · 검사 ci-scenario-guidance-fixture, ci-esm-core-unit-check
## P1745 - v57.54 - AI 패널이 화면마다 대화가 끊기고 이전 대화를 다시 열 수 없음 · 교훈 소유자 2026-10-14: 이전 대화를 세션처럼 저장·기억, 저장 여부는 첫 대화 때 묻기 / AI 항상 사용 · 검사 ci-ai-intelligence-contract-check · 파일 js/aio-chat.js, src/ai/session/chat-sessions.js, src/ui/components/chat-sessions.js, src/ai/context/panel-contexts.js
## P1744 - v57.54 - 티커 없는 전망·테마 질문의 AI 답변에 시각 자료가 없고 관점 대비가 없음 · 교훈 소유자 2026-10-13: 직관적으로 이해할 수 있게(시각) + 각 영역·전문가 관점의 선택지 설명 · 검사 ci-scenario-guidance-fixture · 파일 src/ui/components/ai-answer-visuals.js
## P1743 - v57.54 - 앞을 보는 갈림길이 소유자 예시(금리·CPI·고용)에만 묶여 있고 테마·자동 운영이 없음 · 교훈 AGENTS 소유자 2026-10-13: 예시가 아니라 모든 국면·테마에 같은 구조로 적용, 가능성·해석은 데이터와 함께 자동으로 계속 갱신 · 검사 ci-scenario-guidance-fixture · 파일 src/domain/market/macro-crossroads.js, src/domain/scenarios/exposures.js, src/domain/scenarios/analogs.js, src/domain/scenarios/theme-playbook.js, scripts/build-scenario-state.mjs, public-data/scenario-state.json
## P1742 - v57.54 - 화면과 AI가 지금까지의 시장만 요약하고 앞으로의 갈림길과 사용자 대응을 말하지 못함 · 교훈 AGENTS 소유자 2026-10-12/10-13: 가능성·기회비용·유리한 쪽 설명은 허용·기대, 가격·수량·시점·종목 지시와 지어낸 확률만 금지 · 검사 ci-scenario-guidance-fixture · 파일 src/domain/market/macro-crossroads.js
## P1741 - v57.54 - AI 답변이 실적·차트 질문에도 글만 내보내 수치 흐름을 한눈에 볼 수 없음 · 교훈 owner 2026-10-03 텍스트+시각 균형 원칙 · 검사 ci-ai-intelligence-contract-check · 파일 src/ui/components/ai-answer-visuals.js
## P1740 - v57.54 - AI 채팅이 질문 의도·종목 맥락을 놓치고 한 가지 답변 틀과 오래된 지식 경계를 강제 · 교훈 AGENTS AI 협업 원칙: 질문 맥락 이해·근거 기반 답변·만료 자료 단정 금지 · 검사 ci-ai-intelligence-contract-check
## P1739 - v57.53 - 장중 속보 목록 링크가 24px보다 낮아 접근성 게이트가 실패 · 교훈 WCAG 2.5.8 터치 영역 24px · 검사 ci-accessibility-matrix
## P1738 - v57.53 - 10년물·3개월물 금리의 정규장 전 시세를 '장 마감 종가'로 표시해 스냅샷·히스토리가 어긋나고 데이터 커밋 CI가 실패 · 교훈 완료 종가만 종가로 표시 · 검사 ci-market-snapshot-contract-check, ci-history-field-time-contract-check
## P1737 - v57.53 - 자동 산출물이 생겨도 화면이 수동 값을 읽음 · 교훈 자동 원천 우선 · 검사 ci-manual-reference-expiry-check, ci-runtime-contract-check
## P1736 - v57.53 - 남은 수동 값이 조용히 낡아도 화면은 현재 값처럼 표시 · 교훈 만료된 값을 현재처럼 보이지 않게 · 검사 ci-manual-reference-expiry-check
## P1735 - v57.53 - 휴장일 표가 세 곳에 따로 있고 브리핑 일정 표는 2026년만 있음 · 교훈 단일 원천 · 검사 ci-market-session-contract-check
## P1734 - v57.53 - 한은 기준금리·한국 CPI·수출 잠정치·NAAIM이 운영자 수동 웹검색 스냅샷(8/21)에 멈춤 · 교훈 모델 요약값 발행 금지 / 공식 원천 대조 · 검사 ci-official-references-check
## P1733 - v57.53 - ISM PMI 발표일이 수동 목록(12월까지)뿐 · 교훈 공표 규칙 기반 계산 · 검사 ci-data-pipeline-contract-check
## P1732 - v57.53 - 연준 정책금리 범위가 문자열 "3.75-4.00%"로 하드코딩돼 다음 FOMC 이후 낡음 · 교훈 수동 값 자동화 · 검사 ci-data-pipeline-contract-check, ci-runtime-contract-check
## P1731 - v57.53 - FOMC 회의 일정이 손으로 적은 표(12/9까지)뿐이라 다음 해 일정·일정 변경이 반영되지 않음 · 교훈 수동 값 자동화 / fail-closed · 검사 ci-data-pipeline-contract-check, ci-artifact-semantics-check · 파일 scripts/lib/official-calendars.mjs
## P1730 - v57.52 - 장중 속보 칸 화면과 브리핑→뉴스 주제 handoff · 교훈 잠정 표시 명시 · 검사 ci-esm-core-unit-check
## P1729 - v57.52 - AI 맥락이 화면과 다른 입력·틀(Bull/Base/Bear)을 쓰고 코스피·뉴스 창·장중 속보·기준 시각을 몰랐으며, 단어 수 기반 어조 표시가 남아 있었음 · 교훈 근거 없는 신호 금지 / 화면과 AI 한 정의 · 검사 ci-ai-intelligence-contract-check, ci-esm-core-unit-check
## P1728 - v57.52 - 한국 종목·코스닥 실시간 등락률이 한 세션 어긋난 공급자 전일종가로 계산돼 과장(삼성전자 −6.59% vs −5.58%, 코스닥 −6.19% vs −1.43%) · 교훈 종가 기준 / fail-closed · 검사 ci-esm-core-unit-check, ci-entity-quality-browser-check
## P1727 - v57.52 - 시나리오 '현재 조건 부합'과 부합 수의 신용 정의가 다르고, 원화 보합권 기준·브리핑 다음 단계(한국·뉴스)가 어긋남 · 교훈 한 정의 · 검사 ci-regime-scenarios-fixture, ci-scenario-guidance-fixture, ci-esm-core-unit-check
## P1726 - v57.52 - 유가 5일 반등(+4.8%)이 20일 '하락' 판정에 가려지고, 현물-선물 혼합 브렌트 스프레드를 해석 · 교훈 같은 기준 비교 / 판정 불변 · 검사 ci-codex-structure-regression-fixture
## P1725 - v57.52 - 기준일이 다른 값을 한 문장·한 칩에서 섞음(코스피 10/13 vs 원/달러 10/9, 미국장 섹션 vs 실시간 띠 부호 반대) · 교훈 기준일 명시 · 검사 ci-regime-scenarios-fixture
## P1724 - v57.52 - 오늘 '직전 종가 대비 변화'에서 코스피가 빠짐(비교 기준일 10/9가 한국 휴장일) · 교훈 종가 기준 — 시장별 세션 · 검사 ci-regime-scenarios-fixture
## P1723 - v57.52 - 하루 급변(코스피 −5.46%, 5일 −13.8%)이 판정·브리핑 리드·홈·한국 참여도·테마에 근거 있게 올라오지 않음 · 교훈 근거 있는 서술(기록 백분위), 새 등급 없음 · 검사 ci-regime-scenarios-fixture, ci-korea-participation-fixture
## P1722 - v57.52 - 텔레그램 지정학 기사(영국 기관: 호르무즈 선박 피격)가 '한국장' 수급 태그로 분류됨 · 교훈 분류는 문맥 근거 · 검사 ci-data-pipeline-contract-check
## P1721 - v57.52 - 원/달러가 여러 화면에서 10/9 값에 고정되고, 브렌트 유럽 현물(10/6)을 WTI 선물과 비교해 36달러 스프레드를 해석 · 교훈 같은 기준끼리만 비교 · 검사 ci-data-pipeline-contract-check, ci-codex-structure-regression-fixture
## P1720 - v57.52 - 뉴스가 KST 08:00 마감 묶음뿐이라 한국 장중 급락(코스피 −5.46%) 기사가 다음 날 08시 이후까지 화면·해설·AI에 0건 · 교훈 정본 창 유지 + 잠정 칸은 명시 라벨 · 검사 ci-data-pipeline-contract-check, ci-artifact-semantics-check, ci-esm-core-unit-check
## P1719 - v57.52 - 서버 시장 해설이 날짜·시각 숫자를 지수 값으로 읽는 검증기 오탐으로 차단되고(발행률 63%), 차단 시 재시도·직전본 없이 카드가 비었음 · 교훈 근거 검증은 오탐 없이, 실패는 투명하게 · 검사 ci-data-pipeline-contract-check
## P1718 - v57.52 - 30분 데이터 갱신을 보완하는 Worker dispatch가 Cloudflare에서 예외로 한 번도 실행되지 않아, 공개 데이터 갱신 간격이 중앙값 4시간·최대 13시간 · 교훈 운영 경로는 실제 런타임 의미로 검증 · 검사 ci-data-plane-contract-check · 파일 worker/data-plane.js
## P1717 - v57.51 - 배포 후 확인: 13F 자료 도착 시 종목 요약 재렌더가 '최근 공시' 줄을 지우고, 실적 달력 '대형주 일정 미확인 N개'가 매주 30여 개로 소음이 됨 · 교훈 근거 없는 신호 금지 — 구분할 수 없는 상태를 수치로 노출하지 않음
## P1716 - v57.51 - 종목 화면에 최근 공시(8-K·10-Q·10-K) 경로가 없었음 · 교훈 원천 근거 연결 · 검사 ci-sec-runtime-projection-check, ci-entity-summary-fixture
## P1715 - v57.51 - 시장 폭이 관찰 목록 편향을 드러내지 않았고, 거래대금 정의·한국 거래대금·상대 거래량이 비어 있거나 틀림 · 교훈 원천 없는 필드 퇴역 / 분모 명시 · 검사 ci-data-pipeline-contract-check, ci-screener-workbench-contract
## P1714 - v57.51 - 유니버스 커버리지 공백: 코스닥150 비중 50%·미국 중형주 91% 누락, 3종목 미만 하위 테마가 순위에서 제외 · 교훈 커버리지 — 대표 지수 대비 공백 명시 · 검사 ci-runtime-contract-check, ci-architecture-contract-check
## P1713 - v57.51 - 유니버스 정합성: 상장폐지·티커 변경 종목 잔존, 코드-이름 불일치, GICS와 다른 섹터, 노후 지수 태그, 주식 클래스 이중 계산 · 교훈 티커 추정 금지 — 공식 구성 목록 근거 · 검사 ci-data-pipeline, ci-runtime-contract-check, ci-structural-check, ci-architecture-contract-check
## P1712 - v57.51 - 실적 일정이 주말 UTC 실행에서 지난주를 조회하고 ASML·TSM 같은 대형주 누락을 알리지 않음 · 교훈 원천 없는 값 금지 — 누락을 "발표 없음"으로 읽히게 두지 않음 · 검사 ci-data-pipeline-contract-check
## P1711 - v57.51 - 뉴스·텔레그램 발행 주체 판정이 일반 단어 회사명·분석 주체 은행·목록형 게시물·제품명 추론으로 오탐 · 교훈 티커 추정 금지 · 검사 ci-reference-adoption-contract-check, ci-data-pipeline
## P1710 - v57.51 - 시장 뉴스 40칸이 같은 주제 의역 기사와 CFD 브로커 마케팅 글로 채워지고 출처에 URL이 그대로 표기 · 교훈 뉴스는 큐레이션 — 원천 확대가 아니라 선별 품질 · 검사 ci-data-pipeline-contract-check
## P1709 - v57.51 - 종목 뉴스 메모의 약 20%가 다른 회사 기사였고 90종목 고정 수집이라 나머지는 늘 비어 있었으며, 미검증 메모가 AI와 검색에 들어감 · 교훈 티커 추정 금지 — 발행 주체 미확인 기사를 종목 근거로 사용 · 검사 ci-data-pipeline-contract-check
## P1708 - v57.51 - 리츠·금융의 매출 계정을 소계로 잡아 순이익률 7,491%·성장률 부호 반전, 극단 비율이 표시 없이 노출 · 교훈 근거 없는 등급 금지 · 검사 ci-sec-runtime-projection-check, ci-entity-summary-fixture, ci-esm-core-unit-check
## P1707 - v57.51 - SEC 발행주식 수가 2009년 값이거나 1000배인 종목이 PER·참고 시가총액·밸류 순위를 왜곡 · 교훈 근거 없는 값 금지 — 기간이 다른 주식수와 현재 가격 혼합 · 검사 ci-sec-runtime-projection-check, ci-entity-summary-fixture, ci-domain-parity-check
## P1706 - v57.51 - 섹터 ETF 11개와 IWM·DIA가 주식으로 집계되고, ETF·원자재 신탁에 SEC 재무가 붙음 · 교훈 원천 없는 값 금지 — ETF에는 발행사 재무가 없음 · 검사 ci-data-pipeline, ci-sec-runtime-projection-check
## P1705 - v57.51 - 도쿄·대만 상장 4종목이 USD·뉴욕 시간으로 기록돼 통화·세션·거래대금이 틀리고 미국 시장 폭·순위 모집단에 섞임 · 교훈 종가 기준 — 통화·세션 기준을 행마다 선언 · 검사 ci-market-session-contract-check, ci-data-pipeline, ci-screener-market-fixture
## P1704 - v57.51 - 한국 종가가 거래소 종가와 달랐고(마감 동시호가 미반영) 공급자 결측 세션(10/12) 때문에 한국 179행 전체가 한 세션 뒤처짐 · 교훈 종가 기준 — 공급자 종가를 거래소 종가와 대조 없이 사용 · 검사 ci-data-pipeline-contract-check, ci-operations-slo
## P1703 - v57.50 - VIX 장외(글로벌 거래 시간) 값을 '장 마감 종가'로 표시해 스냅샷·히스토리·시장 해설 입력이 어긋나고 데이터 커밋 CI가 실패 · 교훈 종가 기준(close-basis) — 장외 값은 종가가 아님 · 검사 ci-market-snapshot-contract-check, ci-history-field-time-contract-check, ci-qa-pipeline-contract-check
## P1702 - v57.50 - 코스피 -5.46% 급락일에 서버 시장 해설 전체가 'N% 이상' 같은 근사 표현 때문에 차단됨 · 교훈 검증은 표현의 뜻대로(과잉 차단 금지) · 검사 ci-data-pipeline-contract-check
## P1701 - v57.50 - VIX 구간 결과 산출물이 일주일 캐시라 새 군집 수·표준오차 필드가 10/20까지 공개되지 않음 · 교훈 생산물 필드 추가 시 소비 경로 끝까지 확인 · 파일 scripts/build-stress-outcomes.mjs
## P1700 - v57.50 - 퇴역한 점수·화면 조각이 DOM과 계산에 남음 — 홈 "지금 매매해도 될까?" 그리드, 재무 화면 시장 리스크 레이더, AI 자동 점수 그림 · 교훈 퇴역은 DOM·계산·문구 전체에서 · 검사 ci-architecture-browser-check, ci-architecture-contract-check, ci-structural-check
## P1699 - v57.50 - 같은 지표의 기준·기준일이 표면마다 다름 — AI 헤더 실시간 vs 화면 종가, RSI 70 vs 78, VIX·HY·시장 폭 구간, 섹터 1일·1주 원천, 포트폴리오 섹터 분모 · 교훈 한 개념 한 기준(RULES 단일 출처) · 검사 ci-ai-intelligence-contract-check, ci-chat-resilience-check, ci-runtime-contract-check, ci-desktop-continuity-check
## P1698 - v57.50 - 지표의 이면·방법론 결함 — 근거 없는 종합 심리 점수, 쪼개져 부풀린 VIX 구간 사례 수, 우연 수준 부호로 단정한 순위 검증, 기준과 무관한 경고·사분면 확정 · 교훈 근거 없는 등급 제거·표본 한계 명시 · 검사 ci-esm-core-unit-check, ci-codex-structure-regression-fixture, ci-portfolio-vault-e2e, ci-review-integrity-unit-check
## P1697 - v57.50 - 화면 간 결론에서 다음 화면으로 갈 때 맥락이 따라가지 않고, 거시·브리핑·테마 상세에는 다음 단계가 없음 · 교훈 각 페이지는 하나의 논리 흐름 + 화면 간 다리(소유자 2026-10-04) · 검사 ci-architecture-browser-check, ci-theme-research-browser, ci-masters-browser, ci-knowledge-route-bridge-contract
## P1696 - v57.50 - 용어 사전·검색에서 원리 화면을 열면 고른 개념이 사라지고, 변동성 장(N1~N15) 문서 링크 15개는 퇴역한 옵션 화면을 가리켜 이동 실패 · 교훈 라우트 퇴역 시 모든 링크 원천 갱신 · 검사 ci-knowledge-route-bridge-contract, ci-knowledge-generated-parity-check
## P1695 - v57.50 - 원/달러 같은 날짜에 관측이 여럿이면 다음 날 새벽 틱이 정산 종가를 덮어씀 · 교훈 종가 기준(close-basis) · 검사 ci-esm-core-unit-check, ci-market-session-contract-check
## P1694 - v57.50 - 종가 경로 트레이딩 점수가 시장 폭으로 200일선 비율을 읽음(나머지 경로와 점수 구간은 20일선 기준) · 교훈 필드 이름은 실제 의미와 일치 · 검사 ci-native-decision-evidence, ci-domain-parity-check
## P1693 - v57.50 - 종목 화면 "같은 섹터 비교"가 한글 라벨을 검색어로 넘겨 스크리너에서 기술 섹터 0건 · 교훈 화면 간 연결은 데이터 키로 전달(표시 라벨 금지) · 검사 ci-esm-core-unit-check
## P1692 - v57.50 - 정규식 백슬래시 손상으로 차트 패턴의 진행 중 봉 제외와 한국 종목 통화 판별이 동작하지 않음 · 교훈 node heredoc 치환 금지(백슬래시 손실) — Edit 도구 사용 · 파일 js/aio-core.js, js/aio-workspace.js
## P1691 - v57.50 - 같은 신용 상태를 화면마다 다른 기준으로 판정 — HY가 20거래일 +45bp 확대 중인데 브리핑·시나리오·거시 게이지는 "안정" · 교훈 한 개념 한 판정 함수(RULES 단일 출처) · 검사 ci-esm-core-unit-check, ci-domain-parity-check, ci-regime-scenarios-fixture
## P1690 - v57.49 - 배포판 AI가 종가 근거 행을 정확히 복사했는데도 claim 유형 표시가 'market_data'라 수치가 모두 제거됨 · 교훈 실제 모델 출력 형태로 계약 검증 · 검사 ci-ai-intelligence-contract-check
## P1689 - v57.49 - S&P 500 지도의 1일·1주 탭이 데이터가 있어도 배포판에서 한 번도 켜지지 않고, 신용 충돌 문구가 한 달째 확대를 '좁아졌다'로만 말함 · 교훈 생산물 필드 추가 시 소비 경로 끝까지 확인 · 검사 ci-esm-core-unit-check · 파일 src/data/normalize/screener.js
## P1688 - v57.49 - AI 답변이 화면에 있는 VIX·10년물 종가를 근거로 묶지 못해 수치를 모두 지우고, 서버 시장 해설 검증기가 다른 지표의 등락률을 통과시킴 · 교훈 근거 결합 · 종가 기준 · 매매 지시 금지 · 검사 ci-ai-intelligence-contract-check, ci-data-pipeline-contract-check · 파일 src/ai/context/close-basis-evidence.js
## P1687 - v57.49 - 스크리너 재무 팩터가 180일 신선도 기준으로 사실상 꺼지고, 항상 0건인 필터와 종목 화면의 모순된 판정·단위가 남음 · 교훈 한 규칙 한 출처 · 원천 없는 위젯 금지 · 판정과 표시 일치 · 검사 ci-esm-core-unit-check, ci-screener-workbench-contract, ci-fiscal-quality-fixture · 파일 src/domain/fundamental/period.js
## P1686 - v57.49 - S&P 500 지도가 현재 비중으로 과거 수익률을 가중해 1·3개월 수익률을 부풀리고, 테마 화면에 근거 없는 RRG 등급·잘린 산점도·반대 색 규칙이 섞임 · 교훈 사후 정보 편향 금지 · 근거 없는 등급 금지 · 같은 화면 같은 색 의미 · 검사 ci-esm-core-unit-check
## P1685 - v57.49 - 24시간 자산의 일요일 체결이 종가로 섞여 '20일' 변화와 환율 축 판정이 뒤집히고, 거시 새 카드의 단위·주기·판정이 값과 맞지 않음 · 교훈 종가 기준 · 같은 기간 비교 · 근거 없는 등급 금지 · 검사 ci-esm-core-unit-check, ci-codex-structure-regression-fixture, ci-scenario-guidance-fixture
## P1684 - v57.49 - 포트폴리오 손익·비중이 통화를 섞어 계산되고, 근거 없는 등급과 매매 권유가 남아 있으며, 13F 주식 분할이 '보유 확대'로 읽힘 · 교훈 기준 통화 단일 경로 · 근거 없는 등급 금지 · 매매 지시 금지 · 검사 ci-review-integrity-unit-check, ci-esm-core-unit-check, ci-runtime-contract-check
## P1683 - v57.49 - 텔레그램 요약 파일이 관측 계보 행까지 함께 내려보내 커지고, 숫자 HTML 엔티티가 남으며, 원천 종가가 빈 세션을 건너뛴 1일·5일 수익률이 다른 기간을 쓴다 · 교훈 생산물 크기 예산 · 결측을 다른 기간 값으로 대체 금지 · 검사 ci-runtime-contract-check, ci-artifact-semantics-check, ci-data-lineage-audit · 파일 public-data/telegram-observed.json
## P1682 - v57.48 - 무료 공식 데이터 레인이 처음 도착하자 거시 화면 브라우저 게이트가 실패해 push CI와 배포가 막힘 · 교훈 기능 추가 시 고정 게이트 동기화 · 검사 ci-architecture-browser-check
## P1681 - v57.48 - 전문가 검토 반영이 일부만 닫힘 — 오래된 테마 순위의 '지금' 판단, 날짜 없는 기여 분석, AI 물가 관측월·URL 날짜·묵은 브리핑, 지도 기준일 혼합 · 원칙 R3 · 교훈 R3 사후 분석 · 공통 현재성 admission · 검사 ci-review-integrity-unit-check, ci-ai-intelligence-contract-check, ci-esm-core-unit-check
## P1680 - v57.48 - X22 수정이 PM·IR 같은 실제 종목까지 막고, S&P 500 지도가 시세 tick마다 다시 그려지며, verify-aio 자체 검사가 실패 · 원칙 R3 · 교훈 R3 사후 분석 · 인계 주장 재검증 · 파일 js/aio-tests.js
## P1679 - v57.48 - S&P 500 sector map added; the Telegram digest no longer blocks the data boot path · 교훈 A map's areas must come from the index's own weights; a partial map says what is missing. · 검사 ci-data-lineage-audit · 파일 scripts/fetch-sp500-weights.mjs
## P1678 - v57.48 - Reading surfaces over-claimed (VaR as maximum loss, causal education text) and hid scope or evidence · 교훈 Education and labels describe conditions and scope; they do not promise ranges, causes or coverage the data does not carry. · 검사 ci-esm-core-unit-check
## P1677 - v57.48 - Screens disagreed on whether a 10/9 close may be read as today, and on which records validate the ranking · 교훈 One admission rule for 'current' across screens: a dated close is a dated reference until the latest completed session arrives.
## P1676 - v57.48 - AI answers lost sentences to decimal points and URLs, treated role words as tickers and missed facts the screen shows · 교훈 Post-processing must remove whole unsupported claims, never fragments; an AI card states its own basis. · 검사 ci-ai-intelligence-contract-check, ci-esm-core-unit-check
## P1675 - v57.48 - Portfolio and theme arithmetic accepted the wrong benchmark, mismatched dates, stale members and mislabelled cohorts · 교훈 A comparison is valid only on the same basis date, the same population and a label that matches its definition.
## P1674 - v57.47 - Research library shelf was a row of colour bars, not a library a reader could browse · 교훈 Adopt a reference's interaction model, not only its look, and never let a visual dimension imply a quantity the data does not carry. · 파일 src/ui/knowledge/research-shell.js
## P1673 - v57.47 - Stale-data empty states read as 'no match' and 'still checking' · 교훈 An empty state names its cause: missing data, held data and filtered-out data are different messages.
## P1672 - v57.47 - Gates pinned dead legacy writers as presence markers · 원칙 R705 · 교훈 R705: retiring a surface retires its writers; a gate must pin the behavior the user sees, not the presence of a function name. · 검사 ci-architecture-contract-check
## P1671 - v57.47 - KR supply plane kept fetching Naver investor flows and candles into hidden folds · 원칙 R705 · 교훈 R705: retiring a surface retires its writers, fetchers and timers in the same change. · 검사 ci-runtime-contract-check
## P1670 - v57.47 - Retired surfaces left live writers, timers, a no-op button and ghost price alerts · 원칙 R705 · 교훈 Retiring a surface retires its writers: removing an element removes the code that writes it, the timers and hooks that call that code, and any contro… · 검사 ci-architecture-contract-check
## P1669 - v57.47 - Chat '차트 자세히 보기' opened the chart tab on the previous company · 교훈 One bridge per navigation intent: every 'open this ticker's chart' entry point goes through the same function, so a contract change cannot leave a st… · 검사 ci-architecture-contract-check
## P1668 - v57.47 - Boot fetched screener.json twice and the 0.6MB SEC fundamentals projection on every route · 교훈 Fetch on demand: a shared artifact is fetched once per freshness window and a route-specific projection is loaded by the route that renders it, not b… · 검사 ci-esm-core-unit-check, ci-architecture-contract-check
## P1667 - v57.47 - route-owners.json declared 35 native surfaces that page rebuilds had removed · 원칙 R352, R704 · 교훈 Registry claims must be executable: an ownership manifest that is never checked against the page drifts silently (same class as R352 F-02 hardcoded a… · 검사 ci-architecture-contract-check · 파일 index.html
## P1666 - v57.47 - 데이터 갱신 작업이 배포 대기로 갱신 잠금을 5~9분 붙잡고, 감시는 GitHub 예약이 빠져 3일에 11번만 돔 · 원칙 R606 · 교훈 소유자 원칙: 늦은 데이터 금지 · 자동화 효율 · 검사 ci-codex-structure-regression-fixture, ci-qa-pipeline-contract-check · 파일 scripts/ci-codex-structure-regression-fixture.mjs
## P1665 - v57.47 - 데이터 감시 작업이 한 번 실패하면 계속 실패하고, 30분 갱신 호출 토큰이 Worker에 한 번도 실리지 않음 · 교훈 소유자 원칙: 늦은 데이터 금지 · 자동화 신뢰성 · 검사 ci-codex-structure-regression-fixture · 파일 scripts/ci-codex-structure-regression-fixture.mjs
## P1664 - v57.47 - 화면 파일 하나만 고쳐도 대부분의 브라우저 검사가 선택되고, 화면 크기 검사가 순서대로만 돌아 QA가 길어짐 · 교훈 소유자 2026-10-12 QA·검증 효율 · 검사 ci-codex-structure-regression-fixture, ci-qa-pipeline-contract-check · 파일 scripts/ci-codex-structure-regression-fixture.mjs
## P1663 - v57.47 - 투자 심리·시장 폭 화면에 지표 원리를 배울 자리가 없고, 로컬 QA가 작업보다 오래 걸림 · 교훈 소유자 2026-10-12 깊이 학습 연결 · QA 효율 · 검사 ci-codex-structure-regression-fixture, ci-skill-contract-check · 파일 scripts/ci-codex-structure-regression-fixture.mjs
## P1662 - v57.47 - 종목 품질 브라우저 검사가 독립된 6개 경우를 순서대로 돌려 QA가 길어짐 · 교훈 QA 효율(owner 2026-10-12) · 검사 ci-entity-quality-browser-check · 파일 scripts/ci-entity-quality-browser-check.mjs
## P1661 - v57.47 - 검증에 실패한 0~100 시장 점수를 대신할 근거 있는 비교가 화면에 없음 · 원칙 R298 · 교훈 R298 · AGENTS 근거 없는 등급 제거 · 검사 ci-codex-structure-regression-fixture · 파일 scripts/ci-codex-structure-regression-fixture.mjs
## P1660 - v57.47 - 카드 접힘 칸이 근거·출처 목록이라 더 배우려는 사용자에게 원리를 알려주지 않음 · 교훈 소유자 2026-10-12 깊이 학습 연결 · 출처 화면 밖(2026-10-06) · 검사 ci-codex-structure-regression-fixture · 파일 src/domain/content/axis-deep-dives.js, scripts/ci-codex-structure-regression-fixture.mjs
## P1659 - v57.46 - 시장 상태 6축 카드가 길어 한 화면 흐름이 끊김 · 교훈 읽기 길이 기준(owner 2026-10-05) · 검사 ci-architecture-browser-check · 파일 scripts/ci-architecture-browser-check.mjs
## P1658 - v57.46 - 설명이 달린 카드에 키보드로 들어갈 수 없음 (U01) · 교훈 WCAG 2.1.1 키보드
## P1657 - v57.46 - 검증 실패한 종합 점수가 AI 답변 머리말과 내보내기에 인용됨 · 원칙 R298 · 교훈 AGENTS 근거 없는 등급 제거 · R298 · 파일 js/aio-chat.js
## P1656 - v57.46 - 일봉 보충이 최근 거래일의 정규장 종가 기록을 덮어써 시장 환경 점수가 보류됨 · 원칙 R298 · 교훈 R298/P1345 종가 기준 근거 보존 · 검사 ci-codex-structure-regression-fixture · 파일 scripts/ci-codex-structure-regression-fixture.mjs
## P1655 - v57.46 - 브라우저 개인 Google/Perplexity 검색 경로가 공용 AI 웹검색과 따로 남아 있음 · 교훈 웹검색 단일 경로(owner 2026-10-12) · 검사 ci-native-search-check, ci-chat-resilience-check, ci-ai-intelligence-contract-check, ci-connection-access-check · 파일 scripts/ci-native-search-check.mjs
## P1654 - v57.45 - 유동성·성장·원자재 지표, 경제 일정, 한국 종목 재무가 무료 공식 원천에서 수집되지 않음 · 교훈 무료 공식 원천 우선(owner 2026-10-11) · 검사 ci-codex-structure-regression-fixture · 파일 scripts/ci-codex-structure-regression-fixture.mjs
## P1653 - v57.45 - 휴대폰·아이패드에서 AI 질문 입력이 느리고 연결 확인이 쉽게 실패하며, AI 켜기·웹검색 스위치와 페이지별 채팅이 흩어져 있음 · 교훈 owner 2026-10-12: AI 항상 사용·웹검색 자동·단일 AI 패널 · 반응형 지원(2026-10-11) · 검사 ci-codex-structure-regression-fixture · 파일 scripts/ci-codex-structure-regression-fixture.mjs
## P1652 - v57.44 - 오래된 재무가 현재처럼 순위에 쓰이고, AI 대화·운영 노트·도구 문서가 지난 결정을 따름 · 원칙 R141, R315, R474 · 교훈 결측을 중립값으로 대체 금지 · 매매 지시 금지(owner 2026-10-12) · 반응형 재승인(2026-10-11) · AI 예산 $20(2026-10-11) · 검사 ci-codex-structure-regression-fixture · 파일 scripts/ci-codex-structure-regression-fixture.mjs
## P1651 - v57.44 - 한국장 급락이 화면에 해석되지 않고 AI 해설에 인용 토큰이 그대로 노출됨 · 교훈 P1628 한국 지수는 KRX 세션 기준 · 신선도 원칙(owner 2026-10-12) · 검사 ci-codex-structure-regression-fixture · 파일 scripts/ci-codex-structure-regression-fixture.mjs
## P1650 - v57.43 - 엔티티 품질 CI 게이트가 필수 fixture 미추적과 정당한 한국 순위 보류를 실패로 처리 · 원칙 R670 · 교훈 R670 완료 종가 기준 · 화면 정직성(원천 없는 위젯 숨김)과 게이트의 일치 · 검사 ci-entity-quality-browser-check
## P1649 - v57.43 - 한국 스크리너가 순위 0개 이유 없이 미국 팩터 세션을 표시하고 정본·QA 범위가 현재와 어긋남 · 교훈 반응형 지원 재승인(2026-10-11)·정본 파생 원칙 · 검사 ci-codex-structure-regression-fixture, ci-page-data-timeline-contract-check, ci-architecture-contract-check · 파일 scripts/ci-codex-structure-regression-fixture.mjs
## P1648 - v57.43 - 뉴스 목록에 시세 페이지·공시 목록·재게시·같은 사건 중복이 섞임 · 교훈 선별 우선 원칙(중요 사건 우선) · 검사 ci-codex-structure-regression-fixture · 파일 scripts/ci-codex-structure-regression-fixture.mjs
## P1647 - v57.43 - 오래 열린 탭이 첫 스냅샷·공유 자료·차트·재무를 계속 보여 줌 · 교훈 느린 데이터 정적화 원칙 — 정적 자료도 revision 기준 갱신 필요 · 검사 ci-codex-structure-regression-fixture · 파일 scripts/ci-codex-structure-regression-fixture.mjs
## P1646 - v57.43 - 종목·포트폴리오 계산과 문장이 경계 입력에서 사실과 어긋남 · 교훈 티커 추정 금지·결측을 중립값으로 대체 금지 · 검사 ci-codex-structure-regression-fixture · 파일 scripts/ci-codex-structure-regression-fixture.mjs
## P1645 - v57.43 - AI 시장 해설이 허위 변화율·불가능한 조건 수·확률·직접 지시를 통과시킴 · 교훈 제품 원칙: 매매 지시 금지·근거 없는 수치 금지 · 검사 ci-codex-structure-regression-fixture · 파일 scripts/ci-codex-structure-regression-fixture.mjs
## P1644 - v57.43 - 시장 판정이 서로 다른 날짜의 입력과 오래된 종가를 섞어 현재처럼 읽음 · 교훈 P1533 세션 기준 정렬 — 일부 읽기 함수가 공통 기준 밖에 있었다 · 검사 ci-codex-structure-regression-fixture, ci-scenario-guidance-fixture · 파일 scripts/ci-codex-structure-regression-fixture.mjs
## P1643 - v57.42 - 숫자 설명이 브라우저 기본 툴팁에만 있어 휴대폰·키보드에서 보이지 않고 관측 시점도 없음 · 교훈 P1505 출처는 화면 밖(hover)·날짜는 숫자 옆 — hover가 터치·키보드에서 동작하지 않던 공백 · 검사 ci-scenario-guidance-fixture · 파일 scripts/ci-scenario-guidance-fixture.mjs
## P1642 - v57.42 - 리서치 라이브러리에서 전체 소장 자료를 한눈에 볼 수 없음 · 교훈 소유자 자료 통합(integrate) · 검사 ci-runtime-contract-check
## P1641 - v57.42 - 오늘 화면에 섹터별 등락이 없어 하루 순환매를 볼 수 없음 · 교훈 화면 데이터는 최신 생산물을 따른다 · 검사 ci-scenario-guidance-fixture · 파일 scripts/ci-scenario-guidance-fixture.mjs
## P1640 - v57.42 - 종목 요약이 세 블록에서 같은 수익률·순위를 반복하고 기술·재무 분석으로 이어지지 않음 · 교훈 8화면 통합 시 대체된 레거시 코드 삭제(AGENTS 정보구조) · 검사 ci-entity-quality-browser-check
## P1639 - v57.42 - 차트 근거에 50일선 대비 확장 정도와 저점 반등 확인 지표가 없음 · 교훈 매매 지시 금지 — 사실로만 표시 · 검사 ci-scenario-guidance-fixture · 파일 scripts/ci-scenario-guidance-fixture.mjs
## P1638 - v57.42 - 신용 축이 하이일드 평균만 보고 취약 등급의 스트레스를 놓침 · 교훈 공식 무료 구조화 출처 우선(소유자 2026-10-11) · 검사 ci-scenario-guidance-fixture · 파일 scripts/ci-scenario-guidance-fixture.mjs
## P1637 - v57.42 - 시장 상태에 축별 변화 방향을 한눈에 볼 그림이 없음 · 교훈 AGENTS 보정 없는 n/100 종합 점수 금지(소유자 참고 이미지의 종합 점수는 반영하지 않음) · 검사 ci-scenario-guidance-fixture · 파일 scripts/ci-scenario-guidance-fixture.mjs
## P1636 - v57.42 - 리서치 라이브러리 참고 관측값이 두 달 전 값으로 고정 · 교훈 화면 데이터는 최신 생산물을 따른다(소유자 2026-10-12) · 검사 ci-scenario-guidance-fixture
## P1635 - v57.42 - 자동 생성 AI 시장 해석이 수치 나열과 무의미한 문장으로 채워짐 · 교훈 AI 산출물은 화면의 결정론 판정과 같은 근거를 써야 한다 · 검사 ci-scenario-guidance-fixture
## P1634 - v57.42 - 종목 차트가 일봉만 지원하고 캔들이 증권사 화면과 다르게 압축·미국식 색으로 그려짐 · 교훈 화면 설명과 실제 표시 일치 · 검사 ci-scenario-guidance-fixture
## P1633 - v57.42 - 시장 시나리오에 개연성·대응 가능성·확인/주의/무시 항목이 없고 추세·시장 폭이 한 기간만 보임 · 교훈 AGENTS.md 매매 지시 금지(가격·수량·시점)와 가능성·기회비용 설명의 구분(소유자 2026-10-12) · 검사 ci-scenario-guidance-fixture
## P1632 - v57.42 - 스크리너 생산 레인 실패: SEC 런타임 투영이 1MiB 상한 초과 · 교훈 생성물 크기 예산(artifact-size headroom watchdog) · 검사 ci-sec-runtime-projection-check
## P1631 - v57.41 - 8화면 브라우저 대조: 용어 사전 딥링크 빈 화면과 화면 간 문구·분모·표기 불일치 · 교훈 화면 간 정의·분모 단일화(P1611 계열), 개발자 문구 금지, 근거 없는 원인 단정 금지 · 검사 ci-responsive-browser-check
## P1630 - v57.41 - 인수 리뷰: 가격 표기 혼재, 재렌더 시 펼침·포커스 소실, 원천 없는 사업 설명 상시 안내, 시나리오 카드 과밀 · 교훈 화면 정직성(원천 없는 위젯은 숨김), 읽기 길이 기준(블록당 3-5줄), 원본 단위·표기 일관성 · 검사 ci-screener-market-fixture, ci-entity-quality-browser-check
## P1629 - v57.40 - 한국 휴장·주말 뒤 최신 종가 팩터 전체 보류 · 원칙 R670 · 교훈 R670 완료 종가 기준; 시장별 원본 관측일 · 검사 ci-screener-market-fixture
## P1628 - v57.40 - 시장 축 가독성·조건부 흐름과 한국 참여도 부족 · 원칙 R670 · 교훈 원본 시점·시장·표본 경계 보존; R670 종가 근거 · 검사 ci-regime-scenarios-fixture, ci-korea-participation-fixture
## P1627 - v57.40 - 재무 손실 방향과 동일 회계기간 원본 정밀도 · 원칙 R670 · 교훈 종목 identity·관측 기준·원본 단위 보존; R670 완료 종가 비교 · 검사 ci-fiscal-quality-fixture, ci-entity-quality-browser-check · 파일 scripts/ci-fiscal-quality-fixture.mjs
## P1626 - v57.40 - 차트 조건부 흐름과 거래량 가격대의 근거 계약 · 원칙 R670 · 교훈 종목 identity·관측 기준·원본 단위 보존; R670 완료 종가 비교 · 검사 ci-chart-scenarios-fixture, ci-entity-quality-browser-check · 파일 scripts/ci-chart-scenarios-fixture.mjs
## P1625 - v57.40 - 시장별 순위 모집단과 선택 정렬의 일치 · 원칙 R670 · 교훈 종목 identity·관측 기준·원본 단위 보존; R670 완료 종가 비교 · 검사 ci-screener-market-fixture, ci-entity-quality-browser-check · 파일 scripts/ci-screener-market-fixture.mjs
## P1624 - v57.40 - 종목 첫 진입 자료 연결과 기업 분석 공통 구조 · 원칙 R670 · 교훈 종목 identity·관측 기준·원본 단위 보존; R670 완료 종가 비교 · 검사 ci-entity-summary-fixture, ci-entity-quality-browser-check · 파일 scripts/ci-entity-summary-fixture.mjs
## P1623 - v57.39 - 상대강도 기준일 혼합과 1% 미만 시장 폭 단위 확대 · 원칙 R670 · 교훈 R670 직전 미국장 종가 비교; 원본 단위 보존 · 검사 ci-esm-core-unit-check
## P1622 - v57.39 - 테마 핵심 종목 누락·사업/상품 오분류와 구성 종목 내부 비교 부재 · 원칙 R632, R670 · 교훈 R632 자료/상품 정체성, R670 종가 비교, 근거 없는 편집 가중치 배제 · 검사 ci-runtime-contract-check, ci-esm-core-unit-check, ci-responsive-browser-check
## P1621 - v57.39 - 기존 재무 화면 캐시로 채팅 자료가 생략되고 페이지 밖 도메인 질의가 연결되지 않음 · 원칙 R632 · 교훈 R632 producer/consumer 연결 및 자료 가용성 정직성 · 검사 ci-native-search-check, ci-esm-core-unit-check
## P1620 - v57.39 - 홈 시장 폭 요약·전체 테마 티커 누락과 용어사전 다크 모드 충돌 · 원칙 R632, R679, R670 · 교훈 R632 생산자/소비자 일치, R679 화면 상태 일치, R670 직전 미국장 종가 기준 · 검사 ci-esm-core-unit-check, ci-responsive-browser-check
## P1619 - v57.38 - 홈 지수·선물 혼용 및 hidden 스타일 덮어쓰기·상단 정체성 오류 · 원칙 R1, R632, R679 · 교훈 R632 producer/consumer 의미 일치, R679 표시 상태 일치, R1 버전 표시 · 검사 ci-desktop-continuity-check, ci-responsive-browser-check
## P1618 - v57.38 - 사용자 재승인 모바일·아이패드 반응형 화면 복원 · 원칙 R474, R669 · 교훈 사용자 2026-10-11 변경 지시; R474/R669 현재 범위 · 검사 ci-responsive-browser-check
## P1617 - v57.37 - KRX 휴장일(한글날)이 주말과 맞닿으면 정상 종가가 72h 리시를 초과해 STALE_UNEXPECTED로 거부되고, 데이터 리프레시 발행이 fail-closed로 막혔다 · 교훈 휴장 venue의 정상 종가와 진짜 결측은 구분되어야 한다(P1160 계약의 취지) · 검사 ci-market-snapshot-contract-check · 파일 scripts/ci-market-snapshot-contract-check.mjs
## P1616 - v57.37 - P1608/P1609 조건부 검색 전환이 게이트·헤드리스 단언에 반영되지 않아 첫 CI에서 browser 3개 샤드가 실패했다 · 교훈 계약 변경은 같은 계약을 단언하는 게이트·테스트와 함께 변경되어야 한다(게이트 남발이 아니라 계약 동기화) · 검사 ci-assertion-trace-check
## P1615 - v57.37 - 13F 전체 체인 재실행이 저장 행 재사용 패스트패스에서 구성 근거(amendmentChain)를 복원하지 않아, 신규 index 빌더(체인 미기록)와 결합하면 두 번째 풀체인 실행부터 masters 계약 게이트가 확정 실패했다 · 교훈 구성된 분기는 합성 근거를 상태로 유지해야 하며(P1462), 게이트는 근거 없는 발행을 실패시킨다 · 검사 ci-masters-contract-check
## P1614 - v57.37 - 콜드 로드에서 스크리너 '이어서 볼 곳'이 '판정 대기'로 고정됐고, 필드 준비 985(필수 필드)와 수집 성공 989가 같은 정의로 읽혔으며 리서치·테마 화면의 표제·그룹·기준일 표기가 실제 데이터와 어긋났다 · 교훈 부분 커버리지와 별개 정의는 그렇게 공개되어야 하며(운영 정직성), 표제·헤더·정렬·그룹은 같은 사실을 가리켜야 한다 · 검사 ci-screener-auto-refresh-browser-check, ci-masters-browser-check · 파일 js/aio-data.js
## P1613 - v57.37 - 종목 차트 탭이 선택 종목을 이어받지 못해 SPY로 남는 비결정 동작이 있었고, 같은 재무 화면에서 '관측 항목'이 7개와 6개로 이중 집계됐으며 ROE·매출·기준일 표기가 기준 없이 섞였다 · 교훈 한 화면의 같은 어휘는 하나의 정의를 가리켜야 하며(화면 정직성), 종목 화면의 세 탭은 같은 종목을 보여준다(P1430/P1591) · 검사 ci-architecture-browser-check
## P1612 - v57.37 - 거시 카드가 결측월을 건너뛴 위치 오프셋으로 '1년 전'을 계산해 13개월 전 값(2.7%)을 표시했고, 기간 프리미엄 카드가 5거래일 지연을 무표기로 두었다 · 원칙 R670 · 교훈 결측 입력은 추측하지 않고 보류 표기한다(R670, 결측 hold 원칙) · 검사 ci-architecture-browser-check · 파일 src/domain/macro/indicators.js
## P1611 - v57.37 - 같은 사실이 화면마다 다른 기준·분모·단위로 표시됐다: breadth '판정 대상'이 신고·신저 전용 분모(804)를 썼고, 혼합 basis 카드가 값별 관측일을 대표 칩 하나로 덮었으며, F&G '전일' 델타가 두 정의로 공존했다 · 원칙 R670 · 교훈 모든 숫자는 basis를 이름짓고 같은 entity는 화면 간 같은 basis로 표시한다(R670, 화면 정직성 결정 2026-10-02) · 검사 ci-architecture-browser-check, ci-esm-core-unit-check · 파일 scripts/ci-architecture-browser-check.mjs, scripts/ci-esm-core-unit-check.mjs, scripts/ci-page-market-epoch-browser-check.mjs
## P1610 - v57.37 - VIX 배지가 라이브 게이트 경로에만 묶여 전 라우트에서 'VIX —'로 고정되고, 시세 카운트 칩이 스냅샷(16종)·라이브(7종) 두 플레인이 같은 슬롯을 last-writer-wins로 덮어썼다 · 원칙 R620 · 교훈 정적·런타임·브라우저 증거는 별개이며 하나의 값은 단일 writer를 가져야 한다(R620/P1127 계열, P1508 재발 방지 의도) · 검사 ci-architecture-browser-check · 파일 js/aio-data.js, scripts/ci-architecture-browser-check.mjs
## P1609 - v57.36 - 검색 토글의 실제 delegated change 인자·저장 상태 불일치 · 원칙 R679, R632 · 교훈 R679 표시와 실제 근거 상태 일치, R632 생산자/소비자 계약 일치 · 검사 ci-native-search-check · 파일 scripts/ci-native-search-check.mjs
## P1608 - v57.36 - 조건부 OpenAI 웹검색·공용 $20 원장·내부 근거 우선 및 최신성 분리 · 원칙 R681, R680, R679 · 교훈 R681 공용 유료 AI 경로, R680 예약/청구 구분, R679 근거 의미 강화 금지 및 소유자 2026-10-11 결정 · 검사 ci-native-search-check · 파일 worker/openai-contract.test.mjs, scripts/ci-native-search-check.mjs
## P1607 - v57.35 - 공용 자료와 개인 연결의 소비 경로·Worker 설정 상태 불일치 · 원칙 R1, R632 · 교훈 R1 버전 동기화, R632 입력/읽기 계약 일치 및 제품의 누락값 추정 금지·공용 AI 월예산 정책 · 검사 ci-connection-access-check · 파일 scripts/ci-connection-access-check.mjs, worker/openai-contract.test.mjs
## P1606 - v57.34 - 새 분석 노트의 화면과 통합 검색 간 소비 경로 불일치 · 원칙 R618, R703 · 교훈 R618 실제 소비 경로 확인 및 R703 조작 계약. · 검사 ci-theme-research-browser-check
## P1605 - v57.34 - 출처별 신용·측정·증거 충돌 프레임의 실제 소비 경로 · 원칙 R618, R702 · 교훈 R618 reference/current evidence 경계 및 R702 관찰 범위 정직성. · 검사 ci-theme-research-browser-check
## P1604 - v57.34 - 설명 버튼·키보드 단일 실행과 모드 전환 차트 가독성 · 원칙 R618, R703 · 교훈 R618 증거 수준 분리 및 R703 단일 조작과 테마 계약. · 검사 ci-theme-research-browser-check
## P1603 - v57.33 - 범위가 명시된 브라우저 증거와 QA 실행 연결 · 원칙 R618, R701 · 교훈 R618 static/runtime/browser/live 분리 및 R701 현재 실행 증거. · 검사 ci-reference-adoption-contract-check
## P1602 - v57.33 - 일정·공시 근거와 불변 로컬 리서치 저장 · 원칙 R670, R618 · 교훈 P1370 내용 해시, R670 기준일, R618 근거 수준. · 검사 ci-reference-adoption-contract-check
## P1601 - v57.33 - 뉴스 사건·정정 보존과 정확한 회사 연결 · 원칙 R670, R618 · 교훈 P1339 exact issuer, R670 종가 기준, R618 증거 수준 분리. · 검사 ci-reference-adoption-contract-check, ci-reference-adoption-browser-check
## P1600 - v57.32 - Frontend audit remainder: scoped knowledge claims, readable lesson sources, glossary accuracy, 13F price gaps, translation repairs and an industry ov… · 원칙 C4 · 교훈 An introduction carries the same scope (who, how large, when) as the detailed page it leads to; a reader-facing label names what it is in Korean; a c… · 검사 ci-atlas-contract-check
## P1599 - v57.32 - Frontend audit visual pass: dashboards and infographics answer the page question, with honest scales and colours · 교훈 A chart states its period, scale and unit, keeps different units on different axes, and uses up/down colour only where up or down has a direction of… · 검사 ci-desktop-continuity-check
## P1598 - v57.32 - 실패 알림의 최신 실행 소유권과 전체 서명 무결성 · 원칙 R701 · 교훈 R701 운영 상태는 관측 시각과 해당 최신 증거로 판정한다. · 검사 ci-workspace-contract-check · 파일 scripts/ci-workspace-contract-check.mjs
## P1597 - v57.32 - 장기 SLO 조회·기간·cron 분모 무결성 보완 · 원칙 R24 · 교훈 R24-07 예정 도착과 독립 관측 근거 · 검사 ci-operations-slo-window-check · 파일 scripts/ci-operations-slo-window-check.mjs
## P1596 - v57.32 - 운영 게이트 통과와 전체 건강 상태 분리 · 원칙 R701 · 교훈 R701 게이트 PASS는 선택 서비스·도착 cadence 정상 인증이 아니다 · 검사 ci-data-pipeline-contract-check · 파일 scripts/ci-data-pipeline-contract-check.mjs
## P1595 - v57.32 - Worker 보완 예약 요청의 중복 억제와 접수 관측 · 원칙 R24 · 교훈 R24-07 운영 관측과 인증 분리 · 검사 ci-data-plane-contract-check · 파일 scripts/ci-data-plane-contract-check.mjs
## P1594 - v57.32 - 시장 분석 검증의 지표 경계·반복 숫자·언어 판정 보완 · 원칙 R670 · 교훈 R670 직전 미국장 기준 및 검증된 근거만 표시 · 검사 ci-data-pipeline-contract-check · 파일 scripts/ci-data-pipeline-contract-check.mjs
## P1593 - v57.31 - Frontend audit round 10: reversed part/whole relations, mismatched product links, fundamental tab losing its company and overstated copy · 교훈 A relation type's labels must follow the direction the edges are authored in, and a product link must name the node the product actually serves. · 검사 ci-knowledge-review-check, ci-atlas-contract-check, ci-domain-parity-check
## P1592 - v57.31 - Frontend audit round 4-9: wrong-company news tag, cost-basis donut, skip-link blank page, desynced screener controls and learning-text errors · 교훈 A legacy fallback must yield to the native owner by the marker the owner actually writes, and a ticker tag must identify the article's company, not a… · 검사 ci-runtime-contract-check, ci-esm-core-unit-check, ci-knowledge-generated-parity · 파일 js/aio-data.js, js/aio-workspace.js, index.html
## P1591 - v57.31 - Frontend audit round 1-3: light-theme diagrams, unreadable fiscal card, stale rotation read and overlapping concept graph · 원칙 C02, C09 · 교훈 A shared renderer must read theme tokens, and one threshold must have one owner. · 검사 ci-esm-core-unit-check · 파일 js/aio-ui.js · 관련 P3
## P1590 - v57.31 - Sector rotation missed core industry groups and duplicated cybersecurity · 교훈 Rotation coverage should span the core industry groups without duplicates. · 검사 ci-rotation-history-check
## P1589 - v57.31 - Universe and KR theme identities were wrong or dead · 교훈 No ticker inference; identity is verified, never assumed.
## P1588 - v57.31 - US theme taxonomy mixed misclassifications, missing industries and editorial weights · 교훈 Classification and weighting need stated, consistent rules. · 검사 ci-runtime-contract-check
## P1587 - v57.31 - A 1000x SEC share count published P/E 26,500 and P/B 4,461 · 교훈 Derived valuation must not rest on an implausible operand. · 검사 ci-data-pipeline-contract-check
## P1586 - v57.31 - Fear & Greed depended solely on a bot-gated CNN endpoint · 교훈 Core indicators need a source the product may use. · 파일 src/domain/sentiment/composite-fear-greed.js
## P1585 - v57.31 - Market-analysis validator rejected correct Korean analyses · 교훈 A validator must reject wrong claims, not correct ones. · 검사 ci-data-pipeline-contract-check
## P1584 - v57.31 - A single AAII reference miss blocked the 30-minute market publish · 교훈 Reference-only inputs must not gate decision-plane freshness.
## P1583 - v57.31 - Korea business-indicator widget showed permanent placeholders with fixed colours · 교훈 AGENTS.md: hide widgets whose source does not exist.
## P1582 - v57.31 - SEC fundamentals hid the equity basis and showed a co-registrant name · 교훈 Every ratio declares its basis; identity comes from the registrant record. · 검사 ci-sec-runtime-projection-check
## P1581 - v57.31 - Yahoo quote fallback printed a multi-day change as the daily change · 교훈 Daily change is against the previous session close (P545). · 검사 ci-data-pipeline-contract-check
## P1580 - v57.31 - Exit-plan levels printed ATR substitutes as moving averages · 교훈 Missing inputs are never guessed; labels must name what was computed.
## P1579 - v57.31 - Up/down colours ignored quote state and change basis · 교훈 One status per card; a stale value must not look current.
## P1578 - v57.31 - Refresh dispatcher token could not be installed and its absence was invisible · 교훈 A degraded data driver must be visible to the watchdog. · 검사 ci-data-plane-contract-check
## P1577 - v57.31 - Korea CPI reference and US CPI next-release date were out of date · 교훈 Official references are refreshed after each release, never estimated. · 검사 ci-static-db-expiry-check
## P1576 - v57.31 - In-session price could be written to history as a completed close · 교훈 History rows are completed daily closes only (P1095). · 검사 ci-data-pipeline-contract-check
## P1575 - v57.31 - Theme breadth counted leaders without a move as not rising; F&G 0 treated as missing · 교훈 Missing is not zero, and zero is not missing.
## P1574 - v57.31 - Portfolio card kept the VIX-to-max-exposure sizing ladder · 교훈 No trade/sizing instructions; one set of VIX bands.
## P1573 - v57.31 - Cboe put/call labelled current regardless of its trading date · 교훈 Labels must reflect the observation date, not the fetch success.
## P1572 - v57.31 - Failed BEA PCE fetch republished the carried row as ok · 교훈 A failed collection must never relabel carried values as current. · 검사 ci-data-pipeline-contract-check
## P1571 - v57.31 - No guard against data files approaching the GitHub push limit · 교훈 Automation must surface growth before it blocks pushes. · 파일 public-data/masters/managers/blackrock-inc.json
## P1570 - v57.31 - US retail sales schedule ran out on 2026-10-15 · 교훈 Calendar dates come from the official publisher, never estimates. · 검사 ci-static-db-expiry-check
## P1569 - v57.31 - Chart.js secondary CDN loaded without Subresource Integrity · 교훈 Third-party scripts must be integrity-pinned. · 검사 ci-runtime-contract-check · 파일 index.html
## P1568 - v57.31 - Equity/index put-call ratios invented from the total ratio · 교훈 Missing inputs are never guessed (AGENTS.md). · 검사 ci-runtime-contract-check
## P1567 - v57.31 - Market score number and letter grade still shown in headers · 교훈 AGENTS.md: no composite grades or letter scores without predictive evidence; 0-100 market score retired from UI; no trade instructions. · 검사 ci-page-decision-reference-check
## P1566 - v57.31 - Generated-conflict resolver picked the version branch data identity when merging the branch into main · 교훈 Generated release manifests must carry main's data identity after any merge. · 검사 ci-operations-contract-check
## P1565 - v57.30 - KR analysis and the macro reading stated conclusions the inputs do not support · 교훈 No trade instructions; claims need a source (AGENTS.md). · 검사 ci-control-char-check
## P1564 - v57.30 - Legacy files kept their own copies of the VIX and Fear & Greed ladders · 교훈 One VIX band set and one F&G zone set (P1534); no trade instructions. · 검사 ci-domain-parity-check
## P1563 - v57.30 - A stopped Worker's last fast-plane snapshot kept its CURRENT labels and won over a fresh durable snapshot · 교훈 A degraded source must degrade to the previous behaviour (P1152). · 검사 ci-fast-plane-consumer-gate
## P1562 - v57.30 - The regime drift alert called a move inside one Fear & Greed zone severe, and used old VIX names · 교훈 One VIX band set and one F&G zone set (P1534).
## P1561 - v57.30 - Concentration weights were published as current while withheld positions had left the denominator · 교훈 Missing inputs are disclosed on the result, not only in a list. · 검사 ci-esm-core-unit-check
## P1560 - v57.30 - One filer reporting 13F dollar values 1,000x too high got both normal filers withheld · 교훈 A withheld amount needs a reference the reader can trust. · 검사 ci-masters-contract-check
## P1559 - v57.30 - Chat templates produced allocation percentages, invented elasticities and buy verdicts · 교훈 No trade instructions; numbers need a source (AGENTS.md). · 검사 ci-control-char-check
## P1558 - v57.30 - The technical brief showed raw English flag identifiers with action verbs, and missing inputs read as low load · 교훈 No trade instructions; missing inputs hold the score (AGENTS.md).
## P1557 - v57.30 - The home and briefing cards printed a position percentage next to a VIX ladder that disagreed with the VIX status · 원칙 R696 · 교훈 No trade instructions (sizing); one VIX band set (AGENTS.md, R696).
## P1556 - v57.30 - The refresh audit would stop every 30-minute data commit on the day of the next BOK meeting · 교훈 The autopilot must not stop for a human step without a lead time (owner decision, same pattern as P1542). · 검사 ci-data-refresh-audit
## P1555 - v57.30 - Reader copy exposed implementation terms, and the KR comparison table kept rows nothing wrote · 교훈 No developer copy on user surfaces; hide sourceless widgets (AGENTS.md).
## P1554 - v57.30 - A score built on one of two appetite readings carried no partial marker · 교훈 Missing inputs are disclosed on the number, not only in prose. · 검사 ci-esm-core-unit-check
## P1553 - v57.30 - A factor percentile was published for a lone rankable row · 교훈 Missing inputs hold the score; a percentile needs peers. · 검사 ci-esm-core-unit-check
## P1552 - v57.30 - The KR analysis paragraphs turned the 0-100 market score into a favourable/defensive narrative · 교훈 Scores are reference descriptions, never decision-grade; no trade instructions (AGENTS.md). · 검사 ci-control-char-check
## P1551 - v57.30 - Chat diagrams drew defaults for missing inputs and the quiet-tape signal fired on a missing SPY change · 교훈 Missing inputs hold the score; they are never guessed (AGENTS.md); no trade instructions.
## P1550 - v57.30 - Chat and news attributed an issuer by a short alias, an uppercase acronym or a Korean substring · 교훈 No ticker guessing: a name or ticker-shaped token is never attributed to another issuer (P1339).
## P1549 - v57.30 - Responsive blocks below the supported desktop width remained in the stylesheet · 원칙 R669 · 교훈 Desktop only: do not add breakpoints or mobile handling back (AGENTS.md). · 검사 ci-desktop-scope-check
## P1548 - v57.30 - Sourceless widgets and internal ids were visible on screen · 교훈 Hide sourceless widgets; no developer copy (AGENTS.md).
## P1547 - v57.30 - Outbound fetches had a header-only deadline and the SEC client had none · 교훈 Every outbound call needs one total deadline.
## P1546 - v57.30 - The technical brief, tactical overlay and page briefs carried English trade instructions and unvalidated 0-100 sums · 교훈 No trade instructions; no composite scores without predictive evidence; no developer copy on user surfaces (AGENTS.md). · 검사 ci-control-char-check
## P1545 - v57.30 - The assertion-trace gate checked the format of a ledger id, not that the id exists · 교훈 Traceability needs referential integrity. · 검사 ci-assertion-trace-check · 관련 P9999
## P1544 - v57.30 - Telegram digest tagged ordinary English words with tickers · 교훈 No ticker guessing (P1339). · 검사 ci-data-pipeline-contract-check · 파일 scripts/lib/telegram-tickers.mjs
## P1543 - v57.30 - The legacy chat resolver guessed tickers from name fragments · 교훈 No ticker guessing (P1339).
## P1542 - v57.30 - The static-database calendar gate would have failed the whole release on 2026-10-15 although the schedule had not been refreshed by anyone · 교훈 Time-bomb gates must warn before they fail. · 검사 ci-static-db-expiry-check
## P1541 - v57.30 - The Yahoo-to-FRED bridge mapped a 13-week discount rate onto the 3-month constant-maturity series and overwrote the 10Y-3M spread · 교훈 Missing inputs hold the score; they are never guessed (AGENTS.md). · 검사 ci-runtime-contract-check
## P1540 - v57.30 - Score bands read as advice although the long-run validation shows no positive relation · 교훈 Scores are reference descriptions on the last completed close, never decision-grade (AGENTS.md). · 검사 ci-domain-parity-check, ci-control-char-check
## P1539 - v57.30 - The AI action gate replaced the whole answer on a keyword and the system prompt left room for a personalized action once suitability was known · 원칙 R315 · 교훈 No trade instructions (AGENTS.md); R315 allowed a conditional personalized instruction and is superseded by this rule. · 검사 ci-ai-intelligence-contract-check · 파일 js/aio-tests.js
## P1538 - v57.30 - Technical, KR health, portfolio and moat surfaces showed A~D entry grades, 0-100 composites and instruction verdicts · 교훈 No composite grades or letter scores without predictive evidence; no trade instructions (AGENTS.md product decisions). · 검사 ci-control-char-check, ci-runtime-contract-check · 파일 js/aio-tests.js
## P1537 - v57.30 - The news count did not say which list it covered, and the concept-map list printed a relation word without a direction · 교훈 A count says which list and which filter state it covers. · 검사 ci-esm-core-unit-check, ci-knowledge-renderer-contract
## P1536 - v57.30 - The concentration model weighted a position with a cached or reference price, and the legacy wrapper substituted the snapshot close · 원칙 R590 · 교훈 A reference price is not an exposure (R590). · 검사 ci-esm-core-unit-check · 파일 js/aio-core.js, src/domain/portfolio/concentration.js
## P1535 - v57.30 - Internal action enums and a position-size percentage were shown to readers, and AI prompts forced an action verdict · 원칙 R693 · 교훈 Visible and model-directed text states conditions, not instructions (R693); an internal code is not reader text. · 검사 ci-control-char-check · 파일 index.html
## P1534 - v57.30 - VIX and Fear & Greed band edges existed in a dozen copies that disagreed, and the regime alert depended on the legacy copy · 교훈 A threshold that drives an alert has one owner; copies are allowed only when pinned to it by a gate. · 검사 ci-domain-parity-check
## P1533 - v57.30 - The pure exchange calendar lived in the AI layer, five domain modules imported upward, and two session counters disagreed · 교훈 The domain layer does not import the AI layer; one calendar answers every 'how many sessions' question. · 검사 ci-market-session-contract-check · 파일 src/ai/time/market-session.js, src/domain/market/market-calendar.js
## P1532 - v57.30 - A fast-plane snapshot whose quotes were all stale was adopted ahead of the durable snapshot · 교훈 A source that is not fresher than the fallback must not outrank it. · 검사 ci-fast-plane-consumer-gate
## P1531 - v57.30 - Industry map product lines were English registry text on a Korean page · 교훈 Reader-facing text is Korean and is never a raw registry string. · 검사 ci-atlas-contract-check
## P1530 - v57.30 - 13F scale detection flagged the normal filer of a two-filer security next to the odd one · 교훈 A comparison baseline needs enough independent observations to say which side is the outlier. · 검사 ci-masters-contract-check · 파일 public-data/masters/holdings.json
## P1529 - v57.30 - Trend chart month labels overlapped once the time range grew, turning browser-viewport red on main · 교훈 A label density must follow the space available, not the number of data points. · 검사 ci-esm-core-unit-check
## P1528 - v57.30 - Macro chain compared a real yield and a breakeven observed on different days · 원칙 R671 · 교훈 Quantities compared on one screen share an observation date or are held apart (R671 family). · 검사 ci-esm-core-unit-check
## P1527 - v57.30 - Home KPI trend included a row after the close basis and disagreed with 시장 상태 · 교훈 One quantity, one definition across screens (H03). · 검사 ci-esm-core-unit-check · 파일 public-data/history.json
## P1526 - v57.30 - Compatibility event adapter called removed listeners and merged different Date/Map/Set events · 교훈 Compatibility adapters keep native event semantics.
## P1525 - v57.30 - AI publication let a current-sensitive count or magnitude through without evidence · 교훈 A figure in a current-sensitive answer must be bound to evidence or removed. · 검사 ci-ai-intelligence-contract-check
## P1524 - v57.30 - Industry map listed company roles as if they were direct suppliers of a node · 교훈 Items of unverified relation are marked as references, not facts; labels derive from registry structure, never from an invented source. · 검사 ci-atlas-contract-check
## P1523 - v57.30 - Live UI text, glossary and help gave trading instructions and unsourced figures · 교훈 User-visible text states observation, conditions and what would invalidate them, never an instruction or an unsourced probability. · 검사 ci-control-char-check · 파일 index.html, js/aio-workspace.js, js/aio-pages.js, js/aio-ui.js, js/aio-kr-data.js, js/aio-core.js
## P1522 - v57.30 - 13F scale-review withholding covered only the top rows, comparisons and shards · 교훈 A safeguard that withholds a figure must withhold it at every consumer of that figure. · 검사 ci-masters-contract-check
## P1521 - v57.30 - P1500 pictograph gate verdict depended on the Node Unicode data version · 교훈 A gate whose verdict depends on the runtime's Unicode tables is not deterministic; its allowlist must name every intended glyph. · 파일 scripts/ci-control-char-check.mjs, index.html, js/aio-ui.js, src/ui/pages/screener.js
## P1520 - v57.30 - Worker deploys stranded when main advances only by data-refresh commits · 원칙 R606, R674 · 교훈 P1351 intent: a delayed attested release must not overwrite newer Worker code. It does not require skipping a release whose newer commits leave the p… · 검사 ci-cloudflare-deployment-contract-check · 파일 worker/wrangler.proxy.toml
## P1519 - v57.29 - AI 공개 검증 정책을 native ESM으로 분리하고 모듈 부재를 안전하게 처리 · 원칙 R690 · 교훈 R690 실행 증거 범위 구분. 기존 출처·관측 시각·근거 결속 정책과 current-sensitive 필터를 보존한다. · 검사 ci-ai-intelligence-contract-check, ci-ai-chat-analysis-integration-check, ci-ai-quote-evidence-check, ci-ai-chat-public-route-browser-check · 파일 src/ai/response/publication.js
## P1518 - v57.29 - 공유 기반 소유권·본문 제한 시간·전체 QA 증명 경계 정비 · 원칙 R571, R589, R690 · 교훈 R571 요청·캐시 수명 구분, R589 gate 실제 읽기·입력·영향 범위 일치; R690 전체 QA 증명의 범위와 내용 결속. · 검사 ci-esm-core-unit-check, ci-data-plane-contract-check, ci-data-continuity-check, ci-qa-runner-behavior-check
## P1517 - v57.28 - 감사 2차: 재무·스크리너·13F·테마·시장 폭·거시·포트폴리오·레슨의 범위·근거 표기 (H09 H10 H14 H17 H20 H22 H23 H27 H28 H30 H35~H39 H41 H46~H48 H50 H51 H79~H86 H100 H102 H112~H114) · 원칙 R688, R689 · 교훈 R688·R689
## P1516 - v57.28 - 관측 사실보다 강한 해석 문구 (H08·H11·H12·H15·H16·H19·H21·H25·H26·H29·H32·H33·H34·H38·H40·H42·H49) · 원칙 R689 · 교훈 R689
## P1515 - v57.28 - 라이브러리의 정의·계산·인과 단정과 탐색 구조 (H52~H55·H59~H66·H70~H78·H81·H106) · 원칙 C2, C3, R688 · 교훈 R688
## P1514 - v57.28 - AI가 화면과 다른 근거로 답하고 질문 버튼이 매매 지시를 약속 (H13·H104) · 원칙 R687 · 교훈 R687
## P1513 - v57.28 - 13F 금액 단위 1,000배 불일치·역조회 누락·비교의 거짓 빈 결과 (H97·H98·H99·H101·H103) · 원칙 R686 · 교훈 R686 0과 미확인을 구별
## P1512 - v57.28 - 스크리너 실행 결과·표·다음 종목 링크가 서로 다른 집합 (H43·H44·H45) · 원칙 R685 · 교훈 R685 같은 화면의 수·표·링크는 같은 집합
## P1511 - v57.28 - 피드의 주제 이름이 기사 관련성의 증거로 계산됨 — 날씨·바카라 글이 실적·한국 뉴스로 게시 (H04·H05·H06) · 원칙 R684 · 교훈 R684 판정의 근거는 대상 텍스트 자체
## P1510 - v57.28 - 같은 이름의 기간·기준일이 화면마다 다른 계산을 가리킴 (Codex 브라우저 감사 H01·H02·H03·H18·H24·H31) · 원칙 R683 · 교훈 같은 이름의 숫자는 같은 계산·같은 기준일
## P1509 - v57.27 - 같은 날 공포·탐욕 1일 변화가 홈 +3, 투자 심리 +4 · 교훈 같은 지표의 변화는 화면이 달라도 하나의 계산 규칙을 쓴다(P1428). · 검사 ci-architecture-browser-check
## P1508 - v57.27 - 데이터 증가가 다음 코드 CI에서야 드러나던 운영 공백과 상단 VIX 빈칸 · 교훈 데이터로 커지는 예산은 데이터를 바꾸는 쪽(정기 감시)에서 먼저 보여야 한다.
## P1507 - v57.27 - 소유자 X 기록 자료 통합 — 포지셔닝·진입 위치·밸류에이션·인상기 사례 · 교훈 외부 자료는 기존 구조(노트·지표·판정 화면)에 맞게 가공하고, 2차 인용 수치는 판정에 쓰지 않는다.
## P1506 - v57.26 - 거시 사분면과 판정 카드의 기준 차이 미설명, 지표 칸 배치, 고점 배지 문구 · 교훈 같은 화면의 두 판정이 다른 기준을 쓰면 그 기준을 밝혀야 한다.
## P1505 - v57.26 - 출처 문구 노출, 화면 간 중복, 빈 종목 화면, 혼합 라벨, 반복 태그 · 교훈 한 화면, 한 판정 위치. 숫자에는 기준일이 붙고, 출처는 찾을 수 있되 화면을 가리지 않는다.
## P1504 - v57.26 - 뉴스 선별에 관련성 하한·출처 상한이 없어 스팸과 콘텐츠 농장이 섞임 · 교훈 선별은 빈 칸을 채우는 것이 아니라 기준을 통과한 기사만 남기는 것이다.
## P1503 - v57.26 - 텔레그램 요약의 미디어 전용 오집계, 부분 문자열 분류, 첫 태그 표시 · 교훈 이월된 계보 데이터는 원래 기록을 보존해야 하고, 분류 키워드는 단어 단위로 맞춰야 한다.
## P1502 - v57.25 - 소유자 제공 자료의 관점을 분석 노트로 통합 · 교훈 칼럼의 주장은 법칙처럼 쓰지 않고, 성립 조건과 반대 사례를 함께 둔다.
## P1501 - v57.25 - 다가오는 일정이 의사록·만기·휴장을 빼고 "일정 없음"으로 표시 · 교훈 규칙으로 정해지는 일정은 계산할 수 있으므로 "일정 없음"으로 비워 두지 않는다. 날짜를 지어내지 않는다(삼성전자 잠정실적처럼 회사가 정하는 날짜는 넣지 않음). · 검사 ci-esm-core-unit-check
## P1500 - v57.25 - 화면 전체 이모지 제거와 재유입 차단 · 교훈 소유자 결정: 화면에 이모지·이모티콘을 쓰지 않는다. · 검사 ci-control-char-check · 파일 index.html
## P1499 - v57.25 - 화면 전수 점검에서 찾은 표시 결함 · 교훈 같은 화면의 숫자는 이름과 기준이 일치해야 하고, 색은 테마 토큰만 쓴다.
## P1498 - v57.25 - 데이터 갱신 뒤 CI 실패 2건과 13D/G 발행사명 전부 공백 · 교훈 데이터에 따라 생기는 카드는 게이트가 고정 개수가 아니라 조건으로 판정해야 하고, 파서는 실제로 받는 원문 형식으로 검증해야 한다. · 검사 ci-13f-semantic-hash-check
## P1497 - v57.24 - 운영자 수동 데이터 갱신이 커밋 단계에서 계속 실패 · 교훈 후보 검증은 실제로 커밋될 파일 집합을 같은 기준으로 비교해야 한다(P1415 생산 삭제 포함).
## P1496 - v57.23 - 재무 공시가 연간 10-K만 보여 최근 실적을 알 수 없음 · 교훈 최근 실적은 기간을 밝혀 비교하고, 추정값은 추정이라고 표시한다.
## P1495 - v57.23 - 관계 가이드 노드가 영어 용어 위주로 쓰여 있음 · 교훈 사용자 화면에는 개발자·영어 약어 위주 문구를 두지 않는다(Product decisions — Screen design).
## P1494 - v57.22 - 화면 간 해석 기준·문구 불일치 일괄 정리 · 교훈 결론 먼저, 근거는 같은 기준으로, 검증되지 않은 판정은 서술로(Product decisions — Screen design).
## P1493 - v57.22 - 뉴스: 한국어 표시 아래 영어 기사, 오늘 08시 창과 10/4 기준시각 불일치, 맥락 없는 텔레그램 글 · 교훈 화면이 말하는 기준과 실제 목록의 기준은 같아야 한다.
## P1492 - v57.22 - 재무 공시가 현금흐름 없이 매출·이익만, PEG에 가격 판단을 붙임 · 교훈 근거 없는 등급·결론을 붙이지 않고, 기간이 다른 값은 직접 비교하지 않는다.
## P1491 - v57.22 - META가 종목 화면에서 기술(XLK), 테마에서 통신(XLC) · 교훈 같은 종목은 모든 화면에서 같은 섹터·비교 ETF를 쓴다.
## P1490 - v57.22 - 스크리너 931종목 전부 순위 보류 · 원칙 R670 · 교훈 종가 기준 점수는 직전 완료 세션 기준이다 — 주말·휴장은 지연이 아니다(R670).
## P1489 - v57.22 - 같은 10년물에 오늘 +4bp, 금리·환율 −5bp · 원칙 R670 · 교훈 수준과 변화는 같은 출처·같은 기준일에서 나와야 한다(R670 종가 기준).
## P1488 - v57.22 - 운용사·13F: 추가 보유만 담은 수정공시를 분기 전체처럼 비교 · 교훈 분기 전체로 조합된 값만 추이 비교에 쓴다. 부분 공시는 보류하고 부분임을 표시한다.
## P1487 - v57.22 - 리서치 라이브러리: 정의·계산·도식이 서로 다른 말을 하던 항목 교정 · 교훈 정의·계산·도식·실제 화면은 같은 이야기를 해야 하고, 결론에는 성립 조건을 붙인다(Codex 검토 2026-10-05).
## P1486 - v57.21 - Relationship guides and the column link: old embedded view and an internal metric code · 교훈 Owner direction 2026-10-05: the learning hub reads as a professional research library — one contents·document·connections shell, no source/review/bou… · 검사 ci-atlas-browser-check, ci-three-page-learning-flow-check
## P1485 - v57.21 - Masters: fail-closed value reconciliation restored; lookup copy in plain language · 교훈 Owner direction 2026-10-05: the learning hub reads as a professional research library — one contents·document·connections shell, no source/review/bou… · 검사 ci-masters-contract-check, ci-masters-browser-check
## P1484 - v57.21 - Library loads with no failure state or retry · 교훈 Owner direction 2026-10-05: the learning hub reads as a professional research library — one contents·document·connections shell, no source/review/bou… · 검사 ci-principles-browser-check, ci-atlas-browser-check
## P1483 - v57.21 - Atlas deep links: view and domain parameters ignored or overwritten · 교훈 Owner direction 2026-10-05: the learning hub reads as a professional research library — one contents·document·connections shell, no source/review/bou… · 검사 ci-atlas-browser-check
## P1482 - v57.21 - AI 기초: F0 modules stuck on loading; process modules and a duplicate listed · 교훈 Owner direction 2026-10-05: the learning hub reads as a professional research library — one contents·document·connections shell, no source/review/bou… · 검사 ci-atlas-contract-check, ci-atlas-browser-check
## P1481 - v57.21 - Reading text: lessons, AI foundations, industry nodes, domains and the dictionary read as short stories · 교훈 Owner direction 2026-10-05: the learning hub reads as a professional research library — one contents·document·connections shell, no source/review/bou… · 검사 ci-knowledge-review-check, ci-principles-lesson-parity · 파일 src/domain/knowledge/foundation-stories.js
## P1480 - v57.21 - 리서치 라이브러리: one research shell replaces the four learning pages · 교훈 Owner direction 2026-10-05: the learning hub reads as a professional research library — one contents·document·connections shell, no source/review/bou… · 검사 ci-principles-contract-check, ci-atlas-contract-check, ci-masters-contract-check · 파일 src/ui/knowledge/research-shell.js
## P1479 - v57.20 - Masters: what each way of managing money is for, and what 13F shows of it · 교훈 Knowledge review 2026-10-04 (1차·2차): a learning surface must define look-alike concepts apart, keep units and causal direction straight, give every l… · 검사 ci-knowledge-review-check, ci-masters-contract-check · 파일 src/domain/masters/style-frames.js
## P1478 - v57.20 - Nathan framework sources name the post they are · 교훈 Knowledge review 2026-10-04 (1차·2차): a learning surface must define look-alike concepts apart, keep units and causal direction straight, give every l… · 검사 ci-knowledge-review-check, ci-research-flow-contract-check
## P1477 - v57.20 - Refresh cadence by kind of knowledge · 교훈 Knowledge review 2026-10-04 (1차·2차): a learning surface must define look-alike concepts apart, keep units and causal direction straight, give every l… · 검사 ci-knowledge-review-check, ci-atlas-browser-check · 파일 src/domain/knowledge/knowledge-cadence.js
## P1476 - v57.20 - Learning screens: entry order, readable links, guide consistency · 교훈 Knowledge review 2026-10-04 (1차·2차): a learning surface must define look-alike concepts apart, keep units and causal direction straight, give every l… · 검사 ci-knowledge-review-check, ci-atlas-browser-check, ci-principles-browser-check
## P1475 - v57.20 - Lesson sources support the lesson; K7, O2, G7 corrected · 교훈 Knowledge review 2026-10-04 (1차·2차): a learning surface must define look-alike concepts apart, keep units and causal direction straight, give every l… · 검사 ci-knowledge-review-check
## P1474 - v57.20 - Unified knowledge search from the glossary · 교훈 Knowledge review 2026-10-04 (1차·2차): a learning surface must define look-alike concepts apart, keep units and causal direction straight, give every l… · 검사 ci-knowledge-review-check, ci-knowledge-generated-parity-check · 파일 scripts/build-knowledge-search-index.mjs, public-data/knowledge/search-index.json
## P1473 - v57.20 - 분석 프레임: issue-led analysis notes in a professional register · 교훈 Knowledge review 2026-10-04 (1차·2차): a learning surface must define look-alike concepts apart, keep units and causal direction straight, give every l… · 검사 ci-knowledge-review-check, ci-principles-browser-check, ci-three-page-learning-flow-check · 파일 src/domain/knowledge/learning-core.js
## P1472 - v57.20 - Glossary definitions corrected; one concept source shared with the learning screens · 교훈 Knowledge review 2026-10-04 (1차·2차): a learning surface must define look-alike concepts apart, keep units and causal direction straight, give every l… · 검사 ci-knowledge-review-check · 파일 src/domain/knowledge/concept-core.js
## P1471 - v57.20 - Industry map relations are typed; list order is no longer a supply chain · 교훈 Knowledge review 2026-10-04 (1차·2차): a learning surface must define look-alike concepts apart, keep units and causal direction straight, give every l… · 검사 ci-knowledge-review-check · 파일 src/domain/knowledge/atlas-relations.js
## P1470 - v57.19 - SEC page projection back under its 1 MiB bound · 교훈 Takeover review of v57.18 (2026-10-04): a number must state what it was computed on, a validation claim must be about the model actually on screen, a… · 검사 ci-sec-runtime-projection-check · 파일 scripts/build-sec-runtime-projection.mjs
## P1469 - v57.19 - Term premium (Kim-Wright) on the rates page · 교훈 Takeover review of v57.18 (2026-10-04): a number must state what it was computed on, a validation claim must be about the model actually on screen, a… · 검사 ci-review-integrity-unit-check
## P1468 - v57.19 - Factor overlap is measured, not asserted · 교훈 Takeover review of v57.18 (2026-10-04): a number must state what it was computed on, a validation claim must be about the model actually on screen, a… · 검사 ci-review-integrity-unit-check · 파일 src/domain/screener/factor-overlap.js
## P1467 - v57.19 - 재무 공시 compares the company with same-sector filers · 교훈 Takeover review of v57.18 (2026-10-04): a number must state what it was computed on, a validation claim must be about the model actually on screen, a… · 검사 ci-review-integrity-unit-check · 파일 src/domain/fundamental/peer-read.js
## P1466 - v57.19 - Portfolio return attribution — market, sector, stock, FX, cash · 교훈 Takeover review of v57.18 (2026-10-04): a number must state what it was computed on, a validation claim must be about the model actually on screen, a… · 검사 ci-review-integrity-unit-check · 파일 src/domain/portfolio/attribution.js
## P1465 - v57.19 - Forward candidate record of the ranking actually shown · 교훈 Takeover review of v57.18 (2026-10-04): a number must state what it was computed on, a validation claim must be about the model actually on screen, a… · 검사 ci-candidate-archive-check · 파일 scripts/lib/candidate-archive.mjs, public-data/screener-candidate-archive.json, scripts/ci-candidate-archive-check.mjs
## P1464 - v57.19 - The percentile column is called 백분위 · 교훈 Takeover review of v57.18 (2026-10-04): a number must state what it was computed on, a validation claim must be about the model actually on screen, a… · 검사 ci-review-integrity-unit-check
## P1463 - v57.19 - The validation identity follows the weights the screen ranks with · 교훈 Takeover review of v57.18 (2026-10-04): a number must state what it was computed on, a validation claim must be about the model actually on screen, a… · 검사 ci-review-integrity-unit-check
## P1462 - v57.19 - 13F current/prior quarters state how their rows were assembled · 교훈 Takeover review of v57.18 (2026-10-04): a number must state what it was computed on, a validation claim must be about the model actually on screen, a… · 검사 ci-review-integrity-unit-check · 파일 scripts/ci-masters-contract-check.mjs
## P1461 - v57.18 - Screener workbench user copy uses user vocabulary · 원칙 R679 · 교훈 P1216 (internal enums must be translated for users) / R679. · 파일 scripts/ci-runtime-contract-check.mjs
## P1460 - v57.18 - Screener workbench user copy uses user vocabulary · 원칙 R679 · 교훈 P1216 (internal enums must be translated for users) / R679. · 파일 scripts/ci-runtime-contract-check.mjs
## P1459 - v57.18 - Ticker A is Agilent everywhere; chart range tabs respect the available history; news aliases match on word boundaries · 원칙 R17 · 교훈 P1339 (ticker guessing is forbidden — one ticker, one issuer) / R17 (word boundaries in extractTickers) / P1205 (native range ownership). · 검사 ci-data-pipeline-contract-check · 파일 scripts/ci-data-pipeline-contract-check.mjs, scripts/ci-esm-core-unit-check.mjs
## P1458 - v57.18 - Macro sparkline says its date span and cadence; the theme cycle pill uses the rendered view's denominator · 원칙 R570, R631 · 교훈 R570 (관측 주기를 소비자까지 보존) / R631 (분모를 선언한다) / P1352 family.
## P1457 - v57.18 - Breadth contributors carry asset type and a corporate-action suspicion flag · 원칙 R570, R631 · 교훈 R570/R631 (관측의 종목·주기·출처·범위를 소비자까지 보존) / corporate-action audit remains BLOCKED — suspicion must not read as adjustment.
## P1456 - v57.18 - Causal narrative sentences name level, direction and window on one observation basis · 원칙 R679, R628 · 교훈 R679 (presentation cannot strengthen evidence meaning) / R628 / the fact-vs-interpretation contract already documented in market-read comments. · 파일 src/domain/rules/thresholds.js, scripts/ci-esm-core-unit-check.mjs, scripts/ci-domain-parity-check.mjs
## P1455 - v57.18 - Ledger account performance reaches the screen even when the price-history check holds, and 수정 opens the form · 원칙 R632 · 교훈 A hold on one evidence tier must not hold a different tier's result (E3/E4 distinct evidence levels) / R632 (the edit path preserves declared fields… · 파일 scripts/ci-esm-core-unit-check.mjs
## P1454 - v57.18 - Portfolio read: one currency hold, one value-weight denominator per dimension, one benchmark population · 원칙 R631 · 교훈 R631 (분모·표본을 선언하지 않으면 인증하지 않는다) / P1447 (market-class awareness) / P1175 (단위 성립 전 합계 금지). · 검사 ci-esm-core-unit-check · 파일 scripts/ci-esm-core-unit-check.mjs
## P1453 - v57.18 - Portfolio surface writers print the declared currency, not a hard-coded $ · 교훈 LC-45 residual (합계·현금·히어로 금액의 통화 표기는 기존 surface 요약을 따른다) / P1418 family (unit lies in presentation). · 파일 scripts/ci-esm-core-unit-check.mjs
## P1452 - v57.18 - A failed re-rank discards the previous ranking; the backtest IC panel is visible again · 원칙 R628, R586, R631, R483 · 교훈 R628 (결측은 조건·구간·관측값을 만족시키지 않는다) / R631 (보류는 사유·분모를 이름 그대로 표시) / R483 (golden gates move atomically with the contract). · 검사 ci-runtime-contract-check · 파일 scripts/ci-runtime-contract-check.mjs
## P1451 - v57.18 - Stored screener validation carries the model fingerprint; one weights module everywhere · 원칙 C1, R631, R619, R602 · 교훈 R631 (성과·검증 결과는 측정 경로·분모·표본을 선언해야 인증한다) / R619 (같은 의미의 구현은 하나만) / R602-type label-identity trap. · 검사 ci-runtime-contract-check, ci-esm-core-unit-check · 파일 src/domain/screener/model-fingerprint.js, scripts/ci-esm-core-unit-check.mjs, scripts/ci-runtime-contract-check.mjs, scripts/ci-domain-parity-check.mjs
## P1450 - v57.18 - 13F history lane composes amendments with the same policy as the reference lane · 원칙 R499, R619 · 교훈 R499 (13F-HR/A는 정정 유형별로 합성한다 — history lane이 위반) / a period whose composition is unverified must not publish a quarter total. · 검사 ci-13f-currentness-check, ci-masters-contract-check · 파일 scripts/lib/13f-compose.mjs, scripts/ci-13f-currentness-check.mjs, scripts/ci-masters-contract-check.mjs
## P1449 - v57.18 - The shipped SEC projection reconciles parent-company equity itself · 교훈 P1402 (concept choice must follow the ratio definition) / R-.Accounting-basis: a repair that only exists on a path whose inputs another gate strips d… · 검사 ci-sec-runtime-projection-check, ci-esm-core-unit-check · 파일 scripts/build-sec-runtime-projection.mjs, scripts/ci-sec-runtime-projection-check.mjs, scripts/ci-esm-core-unit-check.mjs
## P1448 - v57.17 - Live invariant check accepts the shared-Worker-only AI policy · 교훈 A policy rename updates every gate that reads the policy. · 파일 scripts/ci-live-invariant-check.mjs
## P1447 - v57.16 - Benchmarks by market · 교훈 Review 2026-10-04 (institutional standard): what a number is called must match how it was computed — completed sessions, one model for ranking and va… · 파일 src/domain/market/benchmarks.js
## P1446 - v57.16 - 재무 공시: cash chain, ROE basis, share count · 교훈 Review 2026-10-04 (institutional standard): what a number is called must match how it was computed — completed sessions, one model for ranking and va…
## P1445 - v57.16 - Portfolio panels share one currency and denominator · 교훈 Review 2026-10-04 (institutional standard): what a number is called must match how it was computed — completed sessions, one model for ranking and va… · 검사 ci-decomp-hotspot-check · 파일 src/ui/panels/portfolio-base-values.js
## P1444 - v57.16 - 13F ledger scope and turnover label; KR themes read from completed closes · 교훈 Review 2026-10-04 (institutional standard): what a number is called must match how it was computed — completed sessions, one model for ranking and va… · 검사 ci-three-page-artifact-budget-check
## P1443 - v57.16 - Ranking and validation use one model; the validation view says what it measured · 교훈 Review 2026-10-04 (institutional standard): what a number is called must match how it was computed — completed sessions, one model for ranking and va… · 검사 ci-runtime-contract-check, ci-data-pipeline-contract-check
## P1442 - v57.16 - Screener factors use completed sessions only · 교훈 Review 2026-10-04 (institutional standard): what a number is called must match how it was computed — completed sessions, one model for ranking and va… · 검사 ci-data-pipeline-contract-check
## P1441 - v57.15 - Theme detail flow from artifact data; sharper price-vs-results reading · 교훈 Owner direction: analysis that connects data and stays correct; missing live data must not leave a section empty when published data can answer.
## P1440 - v57.14 - Fiscal history as its own artifact; sub-theme ranking reading · 교훈 Runtime artifact budgets are part of the interactive-path contract; a new series ships as its own bounded projection. · 검사 ci-sec-runtime-projection-check, ci-data-lineage-audit · 파일 public-data/sec-fiscal-history.json
## P1439 - v57.13 - Screener refresh blocked by a hardcoded universe size · 교훈 Gates check relations between artifacts, not literals that a routine data change invalidates. · 파일 public-data/screener-universe.json
## P1438 - v57.12 - 포트폴리오: the holdings read against the market · 교훈 Owner direction 2026-10-04: every page reads as one connected argument (explain, analyse, connect), with balanced text and visuals; remove how-to and… · 파일 src/domain/portfolio/portfolio-read.js, src/ui/components/portfolio-read.js
## P1437 - v57.12 - 스크리너: the ranking explained before the table · 교훈 Owner direction 2026-10-04: every page reads as one connected argument (explain, analyse, connect), with balanced text and visuals; remove how-to and… · 검사 ci-screener-auto-refresh-browser-check · 파일 src/domain/screener/screener-read.js, src/ui/components/screener-read.js
## P1436 - v57.12 - 재무 공시: annual trend from SEC filings, tied to price · 교훈 Owner direction 2026-10-04: every page reads as one connected argument (explain, analyse, connect), with balanced text and visuals; remove how-to and… · 파일 src/domain/fundamental/fiscal-read.js, src/ui/components/fiscal-read.js
## P1435 - v57.12 - 종목 차트: reading first, stage and template pictures, evidence folded · 교훈 Owner direction 2026-10-04: every page reads as one connected argument (explain, analyse, connect), with balanced text and visuals; remove how-to and…
## P1434 - v57.12 - 종목 요약: one connected reading of the stock with two pictures · 교훈 Owner direction 2026-10-04: every page reads as one connected argument (explain, analyse, connect), with balanced text and visuals; remove how-to and… · 파일 src/domain/entity/stock-read.js, src/ui/components/stock-read.js
## P1433 - v57.11 - AI proxy: owner acknowledgement of a legacy month's spend, and propagation-safe deploy verification · 교훈 Owner decision 2026-10-04: use the charged OpenAI API now, within the existing $10 monthly cap. · 파일 cloudflare-worker-proxy.js, worker/wrangler.proxy.toml, worker/openai-contract.test.mjs
## P1432 - v57.10 - 오늘 daily loop: 어제와 달라진 점 · 내 종목 · 다가오는 일정 · 내 종목 뉴스 · 교훈 Owner direction: 오늘 as the daily screen (conclusion → my names → schedule → my news). · 파일 src/domain/briefing/daily-diff.js, src/ui/components/daily-loop.js
## P1431 - v57.10 - Page logic flow: section leads, verdict first, next steps with reasons · 교훈 Owner direction: minimal usage guidance, connected analysis on every page. · 검사 ci-architecture-browser-check, ci-screener-auto-refresh-browser-check · 파일 src/domain/market/page-flow.js, src/ui/components/page-flow.js
## P1430 - v57.10 - 종목 integration: 요약 · 차트 · 재무 공시 share one company; index cards open their own chart · 교훈 Owner decisions: 8-screen IA, context continuity, no retired scores on user surfaces. · 검사 ci-architecture-browser-check, ci-runtime-contract-check
## P1429 - v57.10 - Missing-data experience: one empty state, no wall of dashes, a reading even when the live quote is absent · 교훈 Owner decisions: no sourceless or empty widgets; fill needed data, remove useless content. · 검사 ci-screener-auto-refresh-browser-check · 파일 src/ui/components/empty-state.js
## P1428 - v57.10 - Meaning fixes: one rule registry, no verdict from a missing input, guide describes the screens that exist · 교훈 Owner decisions: one source of truth across screens; no verdict from an unmeasured input; no retired concepts on user surfaces. · 검사 ci-architecture-browser-check, ci-capability-claim-contract-check, ci-user-journey-quality-check, ci-runtime-contract-check · 파일 src/domain/rules/thresholds.js
## P1427 - v57.09 - 거시: one rule set across the page, and every verdict shown as a picture plus a sentence · 교훈 Owner decisions: one source of truth across screens; judgements by published rules; easy and intuitive surfaces balancing text and visuals. · 검사 ci-architecture-contract-check, ci-architecture-browser-check
## P1426 - v57.08 - 거시: direction, equity impact and transmission instead of isolated numbers · 교훈 Owner decisions 2026-10-01/02: judgements only by published rules with the flip condition shown; observation separate from interpretation; one source… · 검사 ci-architecture-contract-check, ci-architecture-browser-check, ci-esm-core-unit-check, ci-data-lineage-audit · 파일 public-data/macro-history.json, src/domain/macro/macro-read.js
## P1425 - v57.07 - 거시 hub rebuilt as two evidence boards; fixed-threshold verdicts and dead legacy writers retired · 원칙 R344 · 교훈 Owner decisions 2026-10-01/02: remove sourceless widgets and ungrounded grades; one close basis; observation separate from interpretation. · 검사 ci-architecture-contract-check, ci-architecture-browser-check, ci-runtime-contract-check, ci-data-pipeline-contract-check · 파일 src/domain/macro/indicators.js, src/domain/macro/rates-fx.js, src/ui/components/macro-board.js, index.html
## P1424 - v57.06 - Initialize shared AI readiness independently of translation activity · 원칙 R592 · 교훈 P1070/R592 separate route readiness from user switch and quota; P1421 do not certify old deployed provider readiness. · 검사 ci-extension-api-runtime-check
## P1423 - v57.06 - Native provider transport and lossless concurrent translation handoff · 원칙 R620 · 교훈 R620 decomposition ratchet; P1173 QA dependency reachability; P1421 completed shared-provider response validation. · 검사 ci-extension-api-runtime-check, ci-decomp-hotspot-check, ci-qa-pipeline-contract-check, ci-ai-chat-public-route-browser-check
## P1422 - v57.06 - Personal data connections preserve provider contracts and credential ownership · 원칙 R627, R681 · 교훈 R627 credential isolation and provider-specific relay boundaries; R681 shared AI credential and budget scope; provider contract verification must use… · 검사 ci-extension-api-runtime-check, ci-worker-relay-check
## P1421 - v57.06 - AI migration preserves one budget and credential boundary · 원칙 R680 · 교훈 R680: all active paid AI paths must be inside the declared budget and migration must preserve credential, cancellation and evidence boundaries. · 검사 ci-ai-budget-scope-check, ci-worker-anthropic-check
## P1420 - v57.05 - 차트 · 기술: retired market-health score replaced by the six-axis summary; stock chart first · 교훈 Owner decision 2026-10-02: no 0-100 total score on user surfaces. · 검사 ci-architecture-contract-check, ci-architecture-browser-check · 파일 index.html
## P1419 - v57.04 - Screener 상위 N% instead of A-F, ranking post-hoc validation panel, yen carry score removed (Bank of Korea rate used as the Japan gap) · 교훈 Owner decisions: no ungrounded grade or composite score; a label names what was measured. · 검사 ci-esm-core-unit-check · 파일 src/ui/pages/screener.js, src/ui/components/screener-validation.js, public-data/backtest-history.json, src/ui/pages/market.js, js/aio-data.js
## P1418 - v57.03 - 포트폴리오 점검 (single holding, single currency, region/type/sector/cash shares) and hidden currency mix in the totals · 교훈 Amounts travel with their currency (P1407); verdicts need a stated basis. · 검사 ci-esm-core-unit-check · 파일 src/domain/portfolio/checks.js
## P1417 - v57.02 - 테마: sub-theme relative strength table and AI capex flow; history event also heard on window · 교훈 Owner decisions: evidence and state, no ungrounded composite score; REFERENCE material is labelled with source and date. · 검사 ci-esm-core-unit-check · 파일 src/domain/themes/group-strength.js, src/domain/themes/ai-capex-flow.js, src/ui/components/theme-strength.js
## P1416 - v57.01 - 시장 폭: 52-week highs/lows, 4% movers, 40-day ratio, distribution days and a contributor drilldown · 교훈 Owner decisions: evidence + state, no ungrounded composite score; one close basis (P1399). · 검사 ci-esm-core-unit-check · 파일 src/domain/market/breadth-signals.js, public-data/breadth-contributors.json
## P1415 - v56.99 - Refresh promotion gate: producer deletions are part of the candidate · 교훈 A fail-closed gate distinguishes a deletion from an unreadable file.
## P1414 - v56.99 - Fast-quote snapshot revision covers previous close, session and quality · 교훈 A revision identifies everything published under it. · 파일 worker/data-plane.js
## P1413 - v56.99 - Worker transport boundary: body deadline, streamed size cap, redirect policy · 교훈 One transport boundary owns time, size and destination. · 검사 ci-worker-relay-check · 파일 cloudflare-worker-proxy.js
## P1412 - v56.99 - Sentiment page: one input adapter, coalesced renders · 교훈 One input path per screen. · 파일 src/ui/pages/sentiment.js
## P1411 - v56.99 - Legacy briefing digest retired (hidden DOM, page/live hooks, translation requests) · 교훈 A screen integration is complete when the old-only execution paths are gone. · 검사 ci-architecture-contract-check
## P1410 - v56.99 - Service worker: data cache keyed without the ?t= cache-buster; writes tied to the event · 교훈 A cache-buster is not a revision. · 검사 ci-service-worker-cache-policy-check · 파일 sw.js
## P1409 - v56.98 - Return contract rejects unparseable times and mixed horizons · 교훈 A contract checks meaning, not only presence. · 검사 ci-esm-core-unit-check · 파일 src/domain/screener/return-contract.js
## P1408 - v56.98 - Event dedupe keeps the next genuine update; earnings retry; HTTP status kept; news mount cleanup · 교훈 Lifecycle: a failure path restores retry; a transport error keeps its cause. · 검사 ci-esm-core-unit-check
## P1407 - v56.98 - Portfolio risk weights and totals carry one base currency · 교훈 Amounts travel with their currency; the totals and the risk path share one unit contract. · 검사 ci-esm-core-unit-check · 파일 src/ui/panels/portfolio-risk-input.js
## P1406 - v56.98 - AI entity resolution: whole-word names and registry-confirmed symbols · 교훈 One identity rule for the screen and the AI; no ticker guessing. · 검사 ci-ai-intelligence-contract-check · 파일 src/ai/entity/resolver.js
## P1405 - v56.97 - 차트 · 기술 follows the stock opened on the 종목 screen · 교훈 One stock carries across screens. · 파일 src/ui/pages/entity.js, src/ui/components/stock-chart.js
## P1404 - v56.97 - Glossary: market/limit orders, VWAP, accumulation/distribution, institutional streaks, breadth screen · 교훈 Definitions state what a measure is, not who is behind it. · 파일 js/aio-glossary.js
## P1403 - v56.97 - News: a server backstop item from an older cycle is not restored as current · 교훈 A fallback never upgrades freshness. · 검사 ci-architecture-browser-check · 파일 js/aio-data.js
## P1402 - v56.97 - SEC equity: parent-company equity first; a conflicting NCI-inclusive tag no longer becomes the reported equity · 교훈 An official source label does not establish semantic correctness; concept choice follows the ratio definition. · 검사 ci-esm-core-unit-check · 파일 src/domain/fundamental/sec-report.js
## P1401 - v56.97 - Portfolio PIN accepts the vault contract (4-20 characters); schedule separates time passed from result received · 교훈 One contract per secret input; a status names what was observed. · 검사 ci-portfolio-vault-e2e · 파일 index.html
## P1400 - v56.97 - Architecture contract updated for the rebuilt briefing, 시장 상태, 시장 폭 and news screens · 원칙 R3 · 교훈 R3/QA: the full gate set, preflight included, runs before a batch is reported as verified. · 파일 scripts/ci-architecture-contract-check.mjs
## P1399 - v56.97 - Market inputs share one close basis; missing is not a verdict; interpretation is tagged as a hypothesis · 원칙 R670 · 교훈 AGENTS.md close-basis scores (R670) and evidence-state per card; owner decision 2026-10-02 (states are descriptive). · 검사 ci-esm-core-unit-check · 파일 scripts/fetch-data.mjs, src/domain/briefing/market-read.js
## P1398 - v56.96 - Supplied research integrated: a16z State of Markets II, chart techniques, Raschke rules, earnings-slope principle · 원칙 R26 · 교훈 R26/integrate: frameworks with sources and dates; transient figures stay REFERENCE.
## P1397 - v56.96 - 차트 · 기술: candlestick chart with VCP, pivot, events and an evidence panel (no grade) · 교훈 Owner decisions 2026-10-03: evidence + state, no composite grade; no trade instructions. · 검사 ci-esm-core-unit-check · 파일 src/domain/technical/chart-analysis.js, src/ui/components/stock-chart.js
## P1396 - v56.95 - 투자 심리 is five equal cards and one synthesis; retired score and sourceless SKEW removed · 교훈 Owner principles: no sourceless widgets; one consistent judgement vocabulary across screens. · 파일 src/ui/components/sentiment-board.js
## P1395 - v56.95 - 시장 폭 shows each participation measure as a trend chart with labelled axes · 교훈 Owner principles: trends over snapshots; no developer source strings; no claims without a source (McClellan). · 파일 src/ui/components/breadth-board.js, src/ui/components/trend-chart.js
## P1394 - v56.95 - Regime FX axis adds USD/JPY; oil is judged against its own 1-year range · 교훈 Thresholds must be relative to the series regime when a fixed level would become a constant.
## P1393 - v56.94 - Leftover developer copy removed (AI helper status, briefing date line, repeated disclaimers) · 교훈 Owner principle: no developer text on user surfaces.
## P1392 - v56.94 - 시장 상태 is a six-axis regime board; the 0-100 score and swing/day toggle leave user surfaces · 교훈 Owner decisions 2026-10-02: retire the score from user surfaces (P714) and the swing/day toggle; no duplicated or sourceless widgets. · 검사 ci-desktop-continuity · 파일 src/domain/briefing/market-read.js, src/ui/components/market-regime.js
## P1391 - v56.93 - News screen leads with important stories; titles are real headlines; developer markers removed · 교훈 Owner principles: no developer text on user surfaces; no grades without grounds. · 검사 ci-data-pipeline
## P1390 - v56.93 - Supplied-material frameworks integrated into the briefing read (real yield, curve, breadth, credit) · 원칙 R26 · 교훈 R26/integrate: frameworks extracted, transient opinions (box range, 2028 cycle, FOMC odds) not promoted to current signals.
## P1389 - v56.93 - Briefing rebuilt as schedule → connected read → asset drivers → next checks · 교훈 Owner principles: no repeated or sourceless content; analysis must connect evidence; one reading flow. · 파일 src/domain/briefing/market-read.js, src/domain/briefing/schedule.js, src/ui/components/briefing-read.js
## P1388 - v56.93 - Reference score: macro/oil/credit inputs reach the model and F&G is no longer double-counted · 원칙 R670 · 교훈 R670 unchanged (completed close only). Owner decision 2026-10-02: remove the double counting. · 검사 ci-esm-core-unit-check, ci-domain-parity-check
## P1387 - v56.92 - Home headline cards show the point move and the secondary row shows changes · 교훈 Owner review 2026-10-02.
## P1386 - v56.92 - Static-db calendar gate honours the official schedule instead of breaking on each release day · 원칙 R650 · 교훈 R650: schedule advance never implies a completed result. · 파일 scripts/ci-static-db-expiry-check.mjs
## P1385 - v56.92 - Newly added macro series publish an observed freshness marker · 교훈 Adding a producer field must satisfy the existing artifact contracts (P1375 omission). · 검사 ci-data-pipeline-contract-check
## P1384 - v56.92 - Reference score shows the previous completed close while the new close is pending · 원칙 R670 · 교훈 R670 meaning unchanged (completed close only); the score never mixes intraday values.
## P1383 - v56.92 - Home summary uses only a verified Korean server analysis; no '?' template, no fabricated 50 · 교훈 Missing values are never guessed; one VIX band.
## P1382 - v56.92 - Headline-only earnings news carries estimate/actual context · 교훈 Missing values are never invented; the context is structured provider data, not inferred from the headline. · 파일 src/domain/news/earnings-context.js
## P1381 - v56.92 - 오늘 headline cards: index futures, rates and oil · 교훈 Owner review 2026-10-02.
## P1380 - v56.92 - Home core news shows 4 diverse, translated headlines without developer notes · 교훈 Owner review 2026-10-02: 3-4 important, diverse market stories; no developer text on user surfaces. · 검사 ci-data-pipeline-contract-check
## P1379 - v56.91 - F&G semantics gate accepts a newer intraday headline · 교훈 A gate must encode the data's real observation semantics, not an assumed equality.
## P1378 - v56.91 - Screener universe membership review before the hard expiry · 원칙 R605 · 교훈 R605 universe review cadence; one identity per instrument.
## P1377 - v56.91 - refresh-data actually runs every 30 minutes · 교훈 Freshness SLAs must be backed by a scheduler that actually fires. · 검사 ci-data-plane-contract-check · 파일 worker/README.md
## P1376 - v56.90 - Remaining sourceless sinks: VIX9D/VIX6M cells and the macro consumer-confidence card · 교훈 Product decision 2026-10-01: hide widgets whose source does not exist.
## P1375 - v56.90 - Policy-rate surfaces show the FOMC target range, not the FEDFUNDS monthly average · 교훈 One metric, one meaning; compare like with like.
## P1374 - v56.90 - SEC fundamentals cover banks reporting revenue net of interest expense · 교훈 Coverage gaps should be closed from the official source before considering paid data (AGENTS.md budget). · 검사 ci-data-pipeline-contract-check
## P1373 - v56.90 - News selection covers Korea, FX/bonds and credit · 교훈 Korean-market content is a user-facing feature (AGENTS.md). · 검사 ci-data-pipeline-contract-check
## P1372 - v56.90 - Server AI market analysis must be Korean, heading-free and session-true · 원칙 R670 · 교훈 Korean product surface; observation time and session are part of every value (R670). · 검사 ci-data-pipeline-contract-check
## P1371 - v56.89 - Sourceless widgets and ungrounded grades no longer read as data · 교훈 Product decision 2026-10-01: hide widgets whose source does not exist; no grades without calibration; missing values are never guessed. · 검사 ci-architecture-browser-check
## P1370 - v56.88 - 13F manager projections stop re-hashing unchanged quarters every day · 교훈 Content-addressed artifacts must hash content, not build time; a generated object store needs a retention rule. · 검사 ci-13f-semantic-hash-check
## P1369 - v56.88 - Diagnostic scores and units say what they measure · 교훈 Uncalibrated scores must not be presented as quality certification.
## P1368 - v56.88 - Signal page legacy widgets refresh on native navigation and never invent VIX · 교훈 Missing inputs are never guessed (product decision); a migrated route must keep an owner for every visible widget.
## P1367 - v56.88 - One VIX band across home, regime summary and chat · 교훈 One metric, one interpretation per session.
## P1366 - v56.88 - A missing 1/5-session return no longer discards a valid durable RRG point · 교훈 Missing values are not estimated, and a missing optional field must not erase independent valid evidence. · 검사 ci-esm-core-unit-check · 파일 scripts/ci-esm-core-unit-check.mjs
## P1365 - v56.88 - Unselected fundamental page no longer reads as an SEC receipt failure · 교훈 P1360 scope split: an absent selection is not a missing observation.
## P1364 - v56.88 - Market-score verdict and caveat stay on score pages and describe the close-basis model · 원칙 R670 · 교훈 R670 close-basis score; a page verdict must not import another scope's evidence. · 검사 ci-runtime-contract-check
## P1363 - v56.88 - Salt-only legacy Vault no longer dead-ends every unlock · 교훈 Fail-closed security must protect an actual asset; a lockout with no recovery path is a defect, not protection. · 검사 ci-portfolio-vault-e2e · 파일 scripts/ci-portfolio-vault-e2e.mjs
## P1362 - v56.87 - Make delayed news key-configuration action a real accessible button · 교훈 Existing keyboard and desktop target-size browser contracts.
## P1361 - v56.87 - Give native news headline targets layout slack above 24px · 교훈 Existing WCAG desktop target-size browser contract. · 검사 ci-accessibility-matrix-check
## P1360 - v56.87 - Match fundamental page evidence to selected issuer or actual SEC watchlist · 원칙 R677, R679 · 교훈 R677 observation identity; R679 truthful reference presentation. · 검사 ci-fundamental-watchlist-timeline-check
## P1359 - v56.87 - Decode translated and original news at one normalization boundary · 원칙 R679 · 교훈 P1205 news entity and XSS contract; R679 truthful content presentation.
## P1358 - v56.87 - Durable completed-session ETF rotation producer and native consumer · 원칙 R677, R679 · 교훈 P715 raw-price publication boundary; R677 observation/session identity; R679 descriptive reference semantics. · 검사 ci-rotation-history-check
## P1357 - v56.87 - Separate informative current observations from score-close and trade eligibility · 원칙 R670, R679 · 교훈 R670 completed US close applies to scores; R679 reference descriptions must not assert trade eligibility or calibrated probabilities.
## P1356 - v56.87 - Advance PCE schedule from verified official future dates · 원칙 R650 · 교훈 R650 schedule advancement is separate from verified release results.
## P1355 - v56.87 - Verified producer receipt preserves observation identity across local app versions · 원칙 R1, R676 · 교훈 R1 official version surfaces; R676 producer and release identity. · 검사 ci-esm-core-unit-check
## P1354 - v56.87 - Shared numeric formatting preserves missing observations · 원칙 R294, R679 · 교훈 R294 and R679 presentation meaning boundaries. · 검사 ci-esm-core-unit-check
## P1353 - v56.87 - Atomic monthly AI reservation and truthful operating budget scope · 원칙 R680 · 교훈 Owner budget decision and new R680 cost-dimension contract. · 검사 ci-worker-anthropic-check, ci-worker-relay-check
## P1352 - v56.87 - Descriptive market UI without default scores or economic-cycle overclaims · 원칙 R670, R671, R679 · 교훈 R670 and R671; new R679 presentation meaning contract. · 검사 ci-esm-core-unit-check
## P1351 - v56.87 - Exact deployment provenance and stale-release guards · 원칙 R674 · 교훈 R674 and exact release-attestation boundaries. · 검사 ci-cloudflare-deployment-contract-check, ci-deployment-convergence-check
## P1350 - v56.87 - Authenticated financial Vault and evidence-safe AI portfolio context · 원칙 R294, R670, R678 · 교훈 R294 and R670; new R678 financial boundary contract. · 검사 ci-portfolio-vault-e2e, ci-esm-core-unit-check
## P1349 - v56.87 - Observation-session identity and independent KRX briefing evidence · 원칙 R670, R294, R677 · 교훈 R670 and R294; new R677 observation identity contract. · 검사 ci-esm-core-unit-check, ci-native-decision-evidence-check
## P1348 - v56.86 - Shared canonical aliases across compatibility navigation · 교훈 Single navigation authority.
## P1347 - v56.86 - Safe dead-code ranges and explicit QA ledger updates · 원칙 R676 · 교훈 R676 and tooling preservation contracts. · 검사 ci-record-fix-check
## P1346 - v56.86 - Native six-axis briefing and top descriptive checklist · 원칙 R670 · 교훈 R670 and QA-UX-11.
## P1345 - v56.86 - Completed-close inputs, dated MA and late snapshot analysis · 원칙 R670 · 교훈 R670 and P1339. · 검사 ci-esm-core-unit-check
## P1344 - v56.85 - work stalled behind PR merges; mixed CRLF/LF working tree; briefing lost its market summary and action card · 원칙 R676, R675 · 교훈 R676 — owner decisions (here: the change flow) live in AGENTS.md; R675 — a test must not keep a removed surface alive.
## P1343 - v56.85 - owner decisions lived only in one agent's personal memory; routing pointed at superseded handoffs · 원칙 R676 · 교훈 R676 (new) — owner product decisions and the change flow live in AGENTS.md, not in one agent's private memory. · 파일 scripts/resolve-generated-conflicts.mjs
## P1342 - v56.85 - unreachable runtime code kept alive; reachability tooling lived only in a session scratchpad · 원칙 R675 · 교훈 R675 — a runtime initializer or renderer needs a production caller; code kept alive only by tests is deleted with the test. · 파일 src/domain/ticker/resolve-name.js, scripts/lib/js-toplevel.mjs, scripts/dead-code.mjs
## P1341 - v56.84 - data-plane deploy deadlocked: the rollback baseline required a sourceSha the July Worker never exposed · 원칙 R652 · 교훈 R652 — rollback baselines capture the live identity; the capture must represent 'no identity' explicitly instead of blocking forever.
## P1340 - v56.84 - watchdog failed every run on skipped deploy runs; guard missed whole-tree discards; hooks were cwd-relative · 원칙 R674 · 교훈 R674-family — deployment verdicts come from runs that actually deployed; destructive-command protection is deny-by-pattern for every whole-tree disca… · 파일 scripts/agent-hook.mjs
## P1339 - v56.84 - page initializers orphaned since PAGES.init retirement; name search, chat aliases and trend input silently dead · 원칙 R670, R675 · 교훈 R675 (new) — a runtime initializer must be reachable from a route or event; a direct-call test does not prove it runs. · 파일 src/domain/ticker/resolve-name.js, src/domain/market/moving-average.js, public-data/history.json
## P1338 - v56.84 - facade kept a third copy of the score inputs; saved news-sentiment history wiped every render · 원칙 R670 · 교훈 R670 — one score-input path for legacy and native consumers.
## P1337 - v56.83 - no shared routine for delegation, assumption checks or post-PR trimming · 원칙 R27 · 교훈 R27-family — shared agent contracts live in skills/_shared.
## P1336 - v56.83 - one FRED abort failed CPI/unemployment for a whole cycle · 원칙 R256 · 교훈 R256 — failed series are named, not silently swallowed (kept). · 검사 ci-data-pipeline-contract-check
## P1335 - v56.83 - Pages deploy blocked by SHA-pin policy; data-plane smoke failed and rolled back to a July Worker · 교훈 R-deploy — a deploy step must judge the version it deployed and roll back to the version it replaced. · 검사 ci-data-plane-contract-check
## P1334 - v56.83 - Worker deploy workflows could run fork code with deploy secrets · 원칙 R674 · 교훈 R674 — privileged workflow_run deploys only act on pushes to this repository. · 검사 ci-cloudflare-deployment-contract-check
## P1333 - v56.83 - accessibility matrix failed on CI with no detail · 원칙 R620 · 교훈 R620-family — a failing gate must name what failed.
## P1332 - v56.82 - five gates and two artifacts still counted 20 routes after the options retirement · 원칙 R666 · 교훈 R666 — a removed route is removed everywhere. · 파일 public-data/operations-status.json, architecture/baseline.json
## P1331 - v56.82 - "?" term buttons were 15 px targets after becoming real buttons · 원칙 R665 · 교훈 R665 — explanations reachable by pointer and keyboard. · 검사 ci-accessibility-matrix-check
## P1330 - v56.82 - Masters initial artifacts exceeded the 500 KB budget after the ticker ledger moved to mount time · 교훈 P1325 prevention — a fix must not breach an existing budget gate. · 검사 ci-masters-contract-check, ci-masters-browser-check
## P1329 - v56.82 - every user parsed ~4,200 lines of self-audit/QA machinery in aio-core.js · 원칙 R673 · 교훈 R673 — QA/audit machinery is not part of the user runtime. · 검사 ci-decomp-hotspot-check, ci-release-revision-check · 파일 js/aio-core.js, index.html, sw.js, js/aio-qa-audits.js
## P1328 - v56.81 - market-environment score was blank all Korean daytime because the last US close counted as stale · 원칙 R670 · 교훈 R670 — a reference description is computed on the latest completed US regular close and states that basis. · 검사 ci-esm-core-unit-check, ci-domain-parity-check, ci-native-decision-evidence-check · 파일 src/domain/signal/close-basis.js
## P1327 - v56.81 - Korean themes were invisible to users and unreachable from a KRX stock · 원칙 R672 · 교훈 R672 — user content is not hidden behind developer mode, and a KRX stock links to its Korean themes. · 검사 ci-esm-core-unit-check · 파일 src/domain/themes/kr-themes.js · 관련 P725
## P1326 - v56.81 - header said "실시간/LIVE" with the current clock even for last night's closes (F-56) · 원칙 R671 · 교훈 R671 — currentness labels come from observation times and the market calendar, from one presenter, in one slot. · 검사 ci-esm-core-unit-check, ci-runtime-contract-check · 파일 src/domain/market/quote-currentness.js
## P1325 - v56.81 - Masters ticker lookup stuck on "불러오는 중" and manager cards buried below it · 원칙 R665 · 교훈 R665-family — an async surface must end in a result, an explicit empty state or an explicit error, never an endless loading state. · 검사 ci-masters-contract-check, ci-masters-browser-check · 파일 src/ui/pages/masters.js
## P1324 - v56.81 - mobile/tablet code still shipped after the desktop-only decision · 원칙 R474, R476, R669 · 교훈 R669 — desktop-only means no mobile/tablet code ships. · 검사 ci-desktop-scope-check · 파일 index.html
## P1323 - v56.80 - ledger frontmatter duplicated generated facts and drifted; every fix needed six hand edits · 원칙 R667, R668 · 교훈 R667 — frontmatter is metadata; derived facts live in the generated state. · 검사 ci-record-fix-check, ci-workspace-contract-check · 파일 scripts/record-fix.mjs, scripts/ci-record-fix-check.mjs
## P1322 - v56.80 - home first screen led with an empty score panel above the market numbers · 원칙 R668 · 교훈 R668 — a summary that cannot be computed must not sit above the values it summarizes, and must state the real cause. · 검사 ci-runtime-contract-check, ci-esm-core-unit-check · 파일 index.html
## P1321 - v56.79 - the options route removed from navigation in v50.35 still shipped as a hidden page · 원칙 R666 · 교훈 R666 — a route the owner removed is removed everywhere; its hash may only alias to the surviving owner. · 검사 ci-architecture-browser-check, ci-architecture-contract-check, ci-runtime-contract-check · 파일 src/app/routes.js
## P1320 - v56.78 - "?" term tooltips clipped at the left edge and unreachable by keyboard or click · 원칙 R474, R476, R665 · 교훈 R665 — an explanation affordance must be reachable by pointer and keyboard and must render fully inside the viewport. · 검사 ci-esm-core-unit-check · 파일 src/ui/components/term-tooltip.js
## P1319 - v56.78 - screener repeated "YYYY-MM-DD · 참고" in every stale cell · 원칙 R662 · 교훈 R662 — visible state is derived once from its owner and stated where it is read, not restated per value. · 검사 ci-esm-core-unit-check
## P1318 - v56.78 - screener market-cap filter returned 0 rows in every size bucket · 원칙 R664 · 교훈 R664 — a reference-only filter must not require decision-grade evidence, and a derived reference value must pass a plausibility check before bucketin… · 검사 ci-esm-core-unit-check · 파일 src/data/providers/screener.js
## P1317 - v56.78 - Korean stocks could not be opened on the ticker route · 원칙 R663 · 교훈 R663 — the route, the quote request and the screener lookup must use one canonical symbol for the same instrument. · 검사 ci-esm-core-unit-check · 파일 src/domain/entity/ticker-symbol.js
## P1316 - v56.77 - portfolio export dropped every personal section except positions · 원칙 R661 · 교훈 R661 — a personal-data export must include every personal section the app stores, or state what it omits. · 검사 ci-esm-core-unit-check, ci-portfolio-vault-e2e · 파일 src/data/portfolio-backup.js
## P1315 - v56.77 - six user-visible correctness defects found by the 2026-09-28 full audit · 원칙 R662 · 교훈 R662 — visible direction, component names, shortcuts and statutory/cited facts must be derived from (or checked against) their single owner; optional… · 검사 ci-runtime-contract-check · 파일 js/aio-kr-data.js, js/aio-data.js, index.html, js/aio-ui.js
## P1314 - v56.76 - knowledge candidate builders could escape their isolated workspace through symlinks · 원칙 R660 · 교훈 R660 — generated knowledge builders may run only from a symlink-free isolated workspace, and every triggered producer helper must select its parity g… · 파일 scripts/lib/atomic-write.mjs, scripts/lib/13f-semantic-hash.mjs
## P1313 - v56.75 - operator alert policies had no source collector for deployed evidence · 원칙 R659 · 교훈 R659 — alert observation sources must preserve evidence lineage, fail closed, protect operator credentials, and never expose source bodies or usage m… · 검사 ci-operations-alert-source-check
## P1312 - v56.74 - operator alert policy lacked a private Anthropic usage source · 원칙 R658 · 교훈 R658 — operator-only usage evidence must be authenticated, private, read-only, UTC-day scoped, and excluded from public health or issue surfaces. · 검사 ci-worker-anthropic-check, ci-worker-relay-check, ci-cloudflare-deployment-contract-check
## P1311 - v56.73 - operator alert thresholds had no executable fail-closed policy · 원칙 R657 · 교훈 R657 — operator alert policy must preserve evidence provenance, threshold boundaries, and fail-closed UNKNOWN behavior without weakening existing rel… · 검사 ci-operations-alert-policy-check, ci-qa-pipeline-contract-check
## P1310 - v56.72 - generated knowledge changes had no reviewable candidate artifact · 원칙 R655 · 교훈 R655 — generated knowledge candidates must come from the tested checkout and stay review-only until a person adds reviewed outputs to the source chan…
## P1309 - v56.71 - SEC 13F discovery rewrote unchanged data daily and rebuilt rows outside filing season · 원칙 R654 · 교훈 R654 — SEC 13D/G freshness checks and 13F row imports must have separate cadences, with unchanged semantic artifacts left untouched.
## P1308 - v56.70 - Worker attestation and coalesced deployment recovery were incomplete · 원칙 R653 · 교훈 R653 — Worker auto-deploy must recover coalesced changes from the live source SHA.
## P1307 - v56.69 - Worker main changes had no attested automatic deployment or rollback · 원칙 R652 · 교훈 R652 — Worker auto-deploys require exact CI evidence and a verified rollback target.
## P1306 - v56.68 - knowledge parity ran lesson consumers before their source builder · 원칙 R651 · 교훈 R651 — registered knowledge producers must precede their direct consumers within one build pass.
## P1305 - v56.67 - macro calendar review digest omitted later schedule changes · 원칙 R605 · 교훈 R605 — a scheduled official-source review must preserve full schedule differences and surface incomplete evidence for human review.
## P1304 - v56.66 - macro-calendar candidate dates had no scheduled evidence review path · 원칙 R605 · 교훈 R605 — static calendars require cadence-aligned official-source review; keep lastRelease tied to verified result evidence.
## P1303 - v56.65 - generated Principles lesson library drifted from its canonical lesson and D6 metadata · 원칙 R560 · 교훈 R560 — generated JSON visible to parallel readers must be replaced atomically as a complete artifact.
## P1302 - v56.64 - exchange sessions used incomplete or incorrect annual calendars · 원칙 R447 · 교훈 R447 — missing or unsupported market-calendar evidence must remain UNKNOWN and cannot be inferred as an open session.
## P1301 - v56.62 - a passed macro schedule date was inferred as a completed release · 원칙 R492, R605, R420 · 교훈 R492/R605/R420 previously coupled a passed schedule date to lastRelease; those rules now require result evidence before advancing it.
## P1300 - v56.61 - refresh audit borrowed the status timestamp when snapshot generatedAt was missing · 원칙 R649, R640 · 교훈 R640 requires the published artifact itself to satisfy the strict freshness boundary; sidecar success time is not proof of artifact publication time. · 파일 scripts/ci-data-refresh-audit.mjs, scripts/ci-data-pipeline-contract-check.mjs
## P1299 - v56.61 - refresh candidate gate가 1 MiB보다 큰 유효 blob을 거부했다 · 교훈 refresh candidate hash는 검증한 바이트 전체를 재현해야 하며 유효 파일 크기만으로 정상 게시를 막지 않는다.
## P1298 - v56.61 - refresh audit가 Fed 일정 출처 URL의 공식성을 확인하지 않았다 · 원칙 R648 · 검사 ci-data-refresh-audit
## P1297 - v56.61 - refresh audit의 forced status가 future·malformed 시각보다 우선했다 · 원칙 R647 · 검사 ci-data-refresh-audit
## P1296 - v56.61 - runtime freshness가 artifact SLA metadata와 분 반올림으로 완화될 수 있었다 · 원칙 R646
## P1295 - v56.61 - browser runtime이 future generatedAt을 current로 처리할 수 있었다 · 원칙 R645, R642
## P1294 - v56.61 - Risk Radar가 매크로 출처 URL을 이름과 함께 원문 노출했다 · 원칙 R644 · 검사 ci-runtime-contract-check
## P1293 - v56.61 - 중앙은행 금리 감사가 한국은행 증거 없이 OK가 될 수 있었다 · 원칙 R643 · 검사 ci-data-refresh-audit
## P1292 - v56.61 - 미래 snapshot 시각이 refresh audit에서 OK로 보일 수 있었다 · 원칙 R642
## P1291 - v56.61 - browser와 operations status에 토요일 stale-cycle grace가 남아 있었다 · 원칙 R637, R640, R641
## P1290 - v56.60 - 휴장 주말의 stale market-snapshot이 refresh 구조 gate에서 OK로 분류됐다 · 원칙 R640 · 검사 ci-data-refresh-audit
## P1289 - v56.59 - 예약 refresh의 market-snapshot 실패 원인이 runner 종료 뒤 사라졌다 · 원칙 R639 · 검사 ci-data-refresh-audit
## P1288 - v56.58 - legacy 뉴스 집계가 최소 표본 아래서 시장 위험·행동 신호를 발행했다 · 원칙 R633, R638 · 검사 ci-esm-core-unit-check
## P1287 - v56.58 - 휴장 세션의 quote 상태가 오래된 live-core artifact를 통과시켰다 · 원칙 R637
## P1286 - v56.57 - CI 실패 게이트의 원인 로그가 tail 제한과 함께 유실될 수 있었다 · 원칙 R636 · 검사 ci-qa-runner-behavior-check, ci-qa-pipeline-contract-check, ci-assertion-trace-check
## P1285 - v56.57 - 과거 뉴스 감성 이력과 ESM 부재 fallback이 표본 계약을 우회할 수 있었다 · 원칙 R635 · 검사 ci-esm-core-unit-check
## P1284 - v56.56 - 기사 표본 하나가 뉴스 감성을 극단값으로 만들었다 · 검사 ci-esm-core-unit-check
## P1283 - v56.56 - 호출 가능한 코드 릴리스 모드가 strict freshness 정책을 우회할 수 있었다 · 원칙 R634 · 검사 ci-data-lineage-audit
## P1282 - v56.55 - 포트폴리오 섹터 다이어그램이 폐기 키 aio_portfolio를 읽어 실데이터에서 조용히 사라졌다
## P1281 - v56.55 - 채팅 포트폴리오 시뮬레이터가 죽은 키·스키마를 읽어 실데이터에서 항상 빈 포트폴리오였다
## P1280 - v56.55 - compatibility facade의 두 번째 포트폴리오 매핑과 죽은 상태 분기가 이중 결과를 냈다 · 검사 ci-esm-core-unit-check, ci-architecture-contract-check
## P1279 - v56.55 - mount 실패 시 레거시 셸이 라우터가 커밋하지 않은 화면에 남았다 · 검사 ci-esm-core-unit-check
## P1278 - v56.55 - 동일 라우트 재확약이 viewState를 조용히 버려 전환 원자성이 깨졌다 · 검사 ci-esm-core-unit-check · 파일 src/app/router.js
## P1277 - v56.54 - 접근성·포트폴리오 브라우저 보고서에 검증 세대가 없고 readiness의 라이브 문구가 오래됐다
## P1276 - v56.54 - 원격 Tier-0 발행 실패 로그가 실패한 시세 행을 숨겼다 · 검사 ci-data-refresh-audit
## P1275 - v56.54 - 9월 Fed 정책 결정과 CP2의 옛 금리 범위·22범주 감사 날짜가 충돌했다 · 검사 ci-data-refresh-audit, ci-runtime-contract-check
## P1274 - v56.54 - 테마 국면이 현재 US 50SMA 시장폭을 놓쳤다 · 검사 ci-runtime-contract-check
## P1273 - v56.54 - 홈의 헤드라인 전용 뉴스가 번역·감성·시장 영향 해석으로 보였다 · 검사 ci-data-pipeline-contract-check
## P1272 - v56.53 - 뷰포트 검사가 비접근성으로 명시된 숨김 file input을 이름 없는 화면 컨트롤로 셌다 · 검사 ci-viewport-matrix-check
## P1271 - v56.53 - 비활성 fast quote 경로를 사용자 기능 AVAILABLE로 표시했다 · 검사 ci-operations-status-check, ci-version-check
## P1270 - v56.53 - refresh promotion이 같은 무거운 검사를 다시 실행하고 검증 후보를 Git index/커밋에 결속하지 않았다 · 검사 ci-qa-pipeline-contract-check
## P1269 - v56.53 - 스크리너 자동 갱신 브라우저 검사가 새로 보이는 행을 잘못 실패시켰다 · 검사 ci-screener-auto-refresh-browser-check
## P1268 - v56.53 - 뉴스 요약 DOM이 이중 작성되고 헤드라인·피드 주제를 검증된 위험 신호처럼 표시했다 · 검사 ci-esm-core-unit-check, ci-runtime-contract-check, ci-domain-parity-check
## P1267 - v56.53 - 테마 시장폭과 경기 국면이 다른 기간/모집단 대체값으로 확정되고 Guide 점수 범위가 어긋났다 · 검사 ci-esm-core-unit-check, ci-runtime-contract-check, ci-architecture-contract-check · 파일 js/aio-tests.js
## P1266 - v56.53 - data-plane 계약 게이트가 fixture 설치 전 실제 provider 호출로 503을 냈다 · 검사 ci-data-plane-contract-check
## P1265 - v56.52 - QA 실행 identity·커밋 후보 결속이 없어 실패 배치가 덮이고 검증 tree와 커밋 tree가 어긋날 수 있었다 (E2-C6 P0·P1-3) · 원칙 C6 · 교훈 E2-C6 P0/P1-3 인수("2개 동시 runner 격리·손상 캐시·리포트 선택 오용 실패 주입", "QA 통과 tree와 부분 staged tree가 다르면 출시 준비 PASS 금지", "한 owner로 옮기고 영향 선택 보완"), rerun-failed의 "정… · 검사 ci-qa-runner-behavior-check · 파일 worker/data-plane.js
## P1264 - v56.51 - 공유 Worker 환경의 FRED 출처 라벨·개인키 거부 경로가 브라우저에서 미검증이었다 (QA-CRED-05) · 교훈 QA-CRED-05 verify_by(매크로 라우트 FRED 출처 라벨 확인), "공유 Worker는 개인 키를 받지 않는다"는 보안 경계의 실측 원칙. · 검사 ci-architecture-browser-check
## P1263 - v56.51 - 체크리스트의 모드 정책이 결정되지 않았고, 집계가 셸에 흩어져 revision 결속이 없었다 (QA-SIG-27) · 교훈 QA-SIG-27 verify_by(제품 결정 후 모드별 체크리스트 fixture + 실브라우저 3상 집계), P1214의 "라벨이 없는 임계값을 약속하지 않는다", P1164/B01의 "미보고를 통과로 만들지 않는다"(여기서는 미보고가 집계에서 실종되던 경로). · 검사 ci-esm-core-unit-check, ci-runtime-contract-check · 파일 src/domain/signal/mode.js
## P1262 - v56.51 - fetch-data producer가 P1256 이후 모든 실행에서 ReferenceError로 죽었다 (QA-FX-REFRESH 해소) · 교훈 P1256의 "receipt는 실제 수집 결과를 말한다"는 계약(그 receipt 코드 자체가 실행 불가였음), data-refresh의 "producer·artifact·consumer·gate를 함께". · 검사 ci-history-field-time-contract-check, ci-data-lineage-audit · 파일 scripts/fetch-data.mjs
## P1261 - v56.50 - 용어집 수치 항목에 출처 필드 계약이 없었고, 근거 없는 인용·예측 문구가 남아 있었다 (QA-GLOSSARY-SWEEP) · 원칙 C1 · 교훈 QA-GLOSSARY-SWEEP verify_by(경험칙 수치의 출처·조건 표기 단언 + 대조 결과 기록), 금융 콘텐츠 정직성(출처 없는 수치·예측 금지). · 검사 ci-runtime-contract-check · 파일 js/aio-glossary.js
## P1260 - v56.50 - 테마 퇴역 섹션의 렌더러·selector·quote 게이트·CSS가 요소 부재 no-op으로 남아 있었다 (QA-THM-CLEANUP) · 교훈 QA-THM-CLEANUP verify_by(퇴역 id 참조 0건 단언 + decomp 순감소 ratchet), P1257의 퇴역 결정("퇴역(삭제)") 의미. · 검사 ci-runtime-contract-check, ci-decomp-hotspot-check · 파일 index.html
## P1259 - v56.49 - 기준 통화 수익률이 없었고, 게이트의 셸 소스 계약이 분해된 코드를 따라오지 못했다 (QA-FX-SERIES·게이트 클로즈아웃) · 교훈 QA-FX-SERIES verify_by(월말 FX 정렬 fixture + 두 결과의 라벨·수치 대조), QA1986 verify_by(조립 fixture + 셸 순감소), 소스 계약의 "코드의 소유자를 따라간다" 원칙. · 검사 ci-esm-core-unit-check, ci-structural-check · 관련 P11
## P1258 - v56.48 - 셸 위험 입력 조립(스냅샷·returnsMap·estimate 호출)이 아직 셸에 남아 있었다 (E4 잔여/셸 분해) · 원칙 R632 · 교훈 QA1986 verify_by(조립 fixture + 셸 순감소), P1195/P1199 분해 선례(R632 단일 writer 정신). · 검사 ci-decomp-hotspot-check, ci-esm-core-unit-check · 파일 js/aio-workspace.js, src/ui/panels/portfolio-risk-input.js
## P1257 - v56.48 - 테마 페이지 숨김 섹션의 퇴역/이전이 결정되지 않아 공개 문구와 실제 노출이 어긋나 있었다 (LC-35/QA-THM-35) · 교훈 LC-35 설계("공개 요구를 먼저 결정하고 중복·낡은 마크업은 삭제·통합, 필요한 콘텐츠만 명확한 공개 경로로 이전"), 공개 문구=실제 노출 원칙. · 검사 ci-runtime-contract-check · 파일 js/aio-pages.js
## P1256 - v56.48 - SEC 밖 도메인에는 receipt가 없었고, "기존값 유지"가 상태 소비자에서 새 수집 성공과 구분되지 않았다 (E5 O06/QA-E5-RECEIPT) · 교훈 doc 17 O06("domain receipt에 attempted/updated/retained/terminalUnsupported/transientFailed와 lastSuccessfulObservation을 독립 기록"), QA-E5-RECEIPT verify_… · 검사 ci-operations-status-check, ci-sec-runtime-projection-check · 파일 scripts/fetch-data.mjs, scripts/lib/domain-receipt.mjs, src/data/contracts/operations.js
## P1255 - v56.48 - 조정종가 계열과 raw 계열이 한 순위·한 행에서 섞이고, 가격 기준 선언이 소비자까지 도달하지 않았다 (E7 기업행동/조정가격) · 교훈 return-contract의 mixed-adjustment-scope-in-one-comparison, P1181 이중 기준 혼합 금지, P1167 시간 계약 필드 통과 규칙. · 파일 src/data/normalize/screener.js
## P1254 - v56.48 - 테마 칩이 상세 제공 여부를 드러내지 않아 14개 상세/11개 요약 전용이 구분되지 않았다 (LC-54) · 교훈 LC-54 설계("데이터 계약에 detailAvailability를 명시하고 읽기 전용 칩의 시각·접근성 의미를 구분한다"). · 검사 ci-runtime-contract-check · 파일 src/ui/pages/themes.js
## P1253 - v56.48 - 죽은 다이버전스 감지기가 항상 "없음"을 출력하고, VCP·변동성 프로필·Stage가 같은 이름으로 서로 다른 모델을 가리켰다 (E7 차트 기법) · 교훈 계약 없는 모델명 공유(정체성 불일치), 미검증 수치를 매매 근거로 표기하지 않는 규칙. · 검사 ci-esm-core-unit-check, ci-runtime-contract-check · 파일 js/aio-ui.js
## P1252 - v56.48 - 백테스트가 비용 미상 행을 조용히 제외해 비중을 재분배했고, 집중도가 원가를 분모에 섞었다 (E7 백테스트·위험) · 교훈 PFR08(비용은 통계 수단 아님·제외=재분배 금지), PFR06/legacy 원가-시장가치 분리, 결측은 보류 원칙. · 검사 ci-esm-core-unit-check · 파일 src/domain/portfolio/backtest.js, src/domain/portfolio/concentration.js
## P1251 - v56.48 - 스크리너 빌더가 표시 필터를 실행 조건처럼 보이게 했고, 무효 입력이 무음 무시됐다 (LC-64/65/73) · 교훈 LC-64/65/73 설계(runDefinition/hash와 tableViewFilter 분리, 무효 입력의 명시적 거부, 빈 상태 분리). · 검사 ci-runtime-contract-check
## P1250 - v56.48 - SKEW 변화량이 본값과 다른 read model에서 나와 보류된 값 옆에 퍼센트가 표시됐다 (LC-63/OPT-01) · 원칙 R97 · 교훈 LC-63 계약("current/previous 어느 하나가 부적격이면 변화량도 보류"), P1207 단일 identity/read model.
## P1249 - v56.48 - 캔들 패턴이 방향 예측으로 읽히고, Guide가 척도 불일치·직접 행동 지시를 남기고 있었다 (LC-55/78) · 교훈 LC-55("각 문장을 형태 관측으로 제한하고 관측 봉 수·기준일·원천·미감지를 함께 표시"), 매매 지시 금지 정책(P1220 계열), 스코어 척도 단일화(P1214). · 검사 ci-runtime-contract-check
## P1248 - v56.48 - 용어 사전이 금융 정의를 틀리게 가르치고, 중복 표제·수동 분류 목록이 레지스트리와 어긋나 있었다 (E7 콘텐츠) · 교훈 금융 콘텐츠 정직성(정의 대조·출처·조건부 경험칙·행동 지시 분리), LC-56/57/58/66~72 원전 대조 요구. · 검사 ci-runtime-contract-check · 파일 js/aio-glossary.js, js/aio-ui.js
## P1247 - v56.47 - 백테스트 랩이 통화 없는 합산으로 비중을 만들었고, 첫 수정은 필요 없는 곳까지 막았다 (E3/E4 FX 축) · 원칙 R632 · 교훈 26 §전환·복구·삭제 3("통화 없는 합산을 구형 fallback으로 되살리지 않는다"), 11 §23 선언된 관측 rate leg, E3/P1194·P1196의 환산 근거 규칙, data-refresh SP4(소비자 라벨이 실제 지표와 일치). · 검사 ci-esm-core-unit-check, ci-reconciliation-contract-check · 파일 js/aio-workspace.js
## P1246 - v56.46 - 백테스트 통화축이 요구한 과거 FX 시계열 공급원이 없었고, 공식 교차검증이 공표 지연을 불일치로 오표기할 설계였다 (E3/E4 FX 축) · 교훈 E0 "producer·artifact·consumer·gate를 한 변경에서 동기화", data-refresh SP1/SP2/SP3(출처·관측 경계 식별, 실패·미관측의 명시, REFERENCE의 현재 입력 승격 금지), SP4(소비자 라벨이 실제 지표·대리와 일치… · 검사 ci-history-field-time-contract-check · 파일 src/domain/portfolio/backtest.js, scripts/fetch-data.mjs, public-data/history.json, .github/workflows/refresh-data.yml
## P1245 - v56.45 - 요청 출처가 스트림이 아니라 공유 전역에 묶여, 겹친 두 요청의 근거가 서로의 검증으로 승격될 수 있었다 (E6 A05) · 원칙 R618, R620 · 교훈 05 A05(요청별 출처·오류 소유권, 취소·재시도·늦은 응답이 다른 요청 상태를 변경하지 못함), E6 claim/publication gate의 fail-closed, 그리고 "결정을 리터럴로 고정해 요구와 모순된 구현을 보증하지 않는다"(R618 계열). · 검사 ci-ai-intelligence-contract-check · 파일 js/aio-chat.js, js/aio-core.js, js/aio-tests.js
## P1244 - v56.44 - AI 요청 분류와 응답 감사가 한 함수에 섞여 있었고, E2 S-E 리팩터가 headless 배선 프로브를 깼다 (E6 A05·A06 + 회귀 복구) · 교훈 E6 A05/A06, E2 S-E·LC-44 회귀, 단일 소유자 없는 이중 분류. · 검사 ci-ai-intelligence-contract-check
## P1243 - v56.43 - VaR recent-half가 검증되지 않은 표본 순서를 가정했다 · 교훈 E4/P1203 잔여(입력 순서 계약의 런타임 검증), 표본 가정의 fail-closed 원칙. · 검사 ci-esm-core-unit-check
## P1242 - v56.42 - 다른 trigger로 채운 창이 예정 도착 PASS로 인증됐다 (E5 R24-07 종료) · 원칙 R24 · 교훈 06 O02·O04 SLO 관측창 완전성, R24-07. · 검사 ci-operations-slo-window-check · 파일 public-data/operations-slo-window.json
## P1241 - v56.41 - 스크리너 행 해석 소유자 미확정으로 번들 DB가 정본처럼 쓰일 수 있었다 (E2 S-C 종료) · 원칙 R632 · 교훈 E0 map S-C shadow 종료 조건(한 owner), R632. · 검사 ci-esm-core-unit-check, ci-runtime-contract-check, ci-retirement-contract · 파일 src/data/screener-row-policy.js
## P1240 - v56.40 - 스크리너 행 해석 체인이 두 구현으로 갈라져 비교 근거가 없었다 (E2 S-C) · 원칙 R632 · 교훈 E0 map S-C shadow 종료 조건, R632(단일 소유자 없는 이중 구현 금지). · 검사 ci-esm-core-unit-check, ci-runtime-contract-check, ci-retirement-contract
## P1239 - v56.40 - 두 채팅이 같은 스크리너 AI 컨텍스트를 각자 구현했다 (E2 S-E) · 교훈 E0 map S-E 공통 helper 종료 조건. · 검사 ci-runtime-contract-check
## P1238 - v56.40 - 뉴스 전용 IDB가 스크리너 저장소 이름으로 남아 있었다 (E2 S-F) · 교훈 E0 map S-F 개명·쓰기 경로 이전. · 검사 ci-runtime-contract-check
## P1237 - v56.39 - Principles가 4개 학습 층의 관계를 첫 화면에서 설명하지 않았다 · 교훈 LC-53 인수 조건, 콘텐츠 층 표기. · 검사 ci-runtime-contract-check · 파일 index.html
## P1236 - v56.39 - Guide 배경지식이 조건·출처 없이 금융 규칙을 단정했다 · 교훈 LC-52 인수 조건, E6 claim/allowedUse 경계(교육 문장도 조건·반례 필요). · 검사 ci-runtime-contract-check · 파일 index.html
## P1235 - v56.39 - Masters 역조회가 8행만 조용히 잘라 6행이 사라진 것처럼 보였다 · 교훈 LC-51 인수 조건, 표시 범위 정직성. · 검사 ci-runtime-contract-check · 파일 src/ui/pages/masters.js
## P1234 - v56.39 - Atlas 근거 검색이 0건을 근거 부재로 읽히게 했다 · 교훈 LC-50 인수 조건, 검색 범위·0건 설명. · 검사 ci-runtime-contract-check · 파일 src/ui/pages/atlas.js
## P1233 - v56.39 - 테마 가격 참여 폭이 실제 분모(n)를 밝히지 않았다 · 교훈 LC-36 인수 조건, 분모·표본 명시. · 검사 ci-runtime-contract-check · 파일 src/ui/pages/themes.js
## P1232 - v56.39 - 테마 공개 범위가 화면에 선언되지 않았다 (LC-35 조사) · 교훈 LC-35 인수 조건(범위 결정 기록). · 검사 ci-runtime-contract-check
## P1231 - v56.39 - 헤드라인 전용 기사의 인과·수혜 요약이 그대로 게시됐다 · 교훈 LC-32 인수 조건, 헤드라인 전용의 claim 자격. · 검사 ci-runtime-contract-check · 파일 src/ui/pages/news.js
## P1230 - v56.39 - 뉴스 주제가 피드 query에서 복사돼 기사 분류처럼 표시됐다 · 교훈 LC-31 인수 조건, 분류 근거·원천 표시. · 검사 ci-runtime-contract-check · 파일 src/data/normalize/news.js
## P1229 - v56.38 - Macro 곡선 가용성이 공식 2s10s 스프레드에 종속됐다 · 교훈 P1147/P1208 same-cut curve contract, LC-49 인수 조건. · 검사 ci-runtime-contract-check
## P1228 - v56.38 - Signal 섹터 폭과 Breadth 종목 폭이 같은 '시장 폭'처럼 읽혔다 · 교훈 LC-48 인수 조건, 모집단·기간 명시. · 검사 ci-runtime-contract-check · 파일 index.html
## P1227 - v56.38 - Breadth 50SMA 카드와 그 아래 문장이 다른 상태를 동시에 보여줬다 · 교훈 P1164/B01 native sink fence, LC-47 인수 조건. · 검사 ci-runtime-contract-check · 파일 index.html
## P1226 - v56.38 - Macro 배너가 정적 '수신 대기'인데 카드에는 값이 있었다 · 교훈 LC-46 인수 조건, 값/배너/상태 원자성. · 검사 ci-runtime-contract-check
## P1225 - v56.38 - 포트폴리오 표가 모든 금액에 $를 붙였다 · 교훈 E3 통화 보존 계약, LC-45 인수 조건. · 검사 ci-runtime-contract-check · 파일 src/ui/pages/portfolio.js
## P1224 - v56.38 - 포트폴리오 '가져오기'가 Tab에서 건너뛰어졌다 · 교훈 LC-44 인수 조건, 키보드 도달. · 검사 ci-runtime-contract-check · 파일 index.html, js/aio-core.js
## P1223 - v56.38 - 포트폴리오 도입 문구가 숨겨진 신선도 strip을 약속했다 · 교훈 LC-43 인수 조건, 공개 약속과 표시 일치. · 검사 ci-runtime-contract-check
## P1222 - v56.37 - Masters 과거 shard가 index 서술자와 동치 검증 없이 변화 원장에 들어갔다 · 교훈 LC-30 인수 조건, P1204 원본·파생 세대 동치 계약(소비자 측). · 검사 ci-runtime-contract-check · 파일 src/ui/pages/masters.js
## P1221 - v56.37 - Atlas가 고유 개념 수와 단계 배치 수를 구분하지 않았다 · 교훈 LC-22 인수 조건, 분모·총수 표기 정직성. · 검사 ci-runtime-contract-check · 파일 src/ui/pages/atlas.js
## P1220 - v56.37 - Guide가 reference-only 점수를 매매 지시로 바꾸고 미제공 지표를 제공한다고 썼다 · 교훈 LC-19·LC-21 인수 조건, E6 allowedUse·capability 정직성. · 검사 ci-runtime-contract-check · 파일 index.html
## P1219 - v56.37 - Fear & Greed 변화량 0이 라벨 없이 두 번째 점수처럼 보였다 · 교훈 LC-29 인수 조건, 결측·변화 라벨 정직성. · 검사 ci-runtime-contract-check · 파일 js/aio-data.js
## P1218 - v56.37 - 테마 상세가 하루 등락을 모멘텀·자금흐름·원인 단정으로 확장했다 · 교훈 LC-28·LC-37·LC-38 인수 조건, 관측→계산→해석→행동 층 분리. · 검사 ci-runtime-contract-check · 파일 src/ui/pages/themes.js, js/aio-kr-data.js
## P1217 - v56.36 - 뉴스 원문 카드가 키보드로 도달할 수 없는 클릭 div였다 · 교훈 LC-34 인수 조건, 접근 가능한 원문 링크. · 검사 ci-runtime-contract-check · 파일 src/ui/pages/news.js, index.html, js/aio-core.js
## P1216 - v56.36 - 뉴스 빈 상태가 내부 emptyReason enum을 그대로 노출했다 · 교훈 LC-33 인수 조건, 내부 구현 어휘의 사용자 노출 금지. · 검사 ci-runtime-contract-check · 파일 src/ui/pages/news.js
## P1215 - v56.36 - 기업 분석의 '차트 분석'이 없는 입력에 쓰고 이전 종목을 보여줬다 · 원칙 R630 · 교훈 R630(동일 결과 ID는 실제 입력만 바꾸어야 함), LC-39 인수 조건. · 검사 ci-runtime-contract-check · 파일 js/aio-core.js
## P1214 - v56.35 - 신호 점수 모드가 라벨만 바꾸고 실제 계산·판정·체크리스트에는 전달되지 않았다 · 원칙 R630, R624 · 교훈 R630(동일 결과 ID는 실제 입력만 바꾸어야 함), R624(상태 global 단일 소유), LC-26 인수 조건. · 검사 ci-esm-core-unit-check, ci-runtime-contract-check · 파일 src/domain/signal/mode.js, src/app/bootstrap.js
## P1213 - v56.35 - 관측시각 없는 가격이 전역 LIVE 배지와 나란히 '현재가'로 읽혔다 · 교훈 P1107 field-owned observation time, LC-42 인수 조건. · 검사 ci-screener-workbench-contract · 파일 src/ui/pages/screener.js
## P1212 - v56.35 - 결측 진단값이 0으로 승격돼 '측정된 0'처럼 보였다 · 교훈 P1176 계열의 Number(null)===0 승격 금지, LC-41 인수 조건. · 검사 ci-screener-workbench-contract, ci-runtime-contract-check · 파일 src/ui/pages/screener.js, js/aio-ui.js
## P1211 - v56.35 - 스크리너 실행 판정과 표의 표시 범위가 같은 모집단처럼 보였다 · 교훈 LC-25 인수 조건, 12 U01 결과 정직성. · 검사 ci-screener-workbench-contract · 파일 src/ui/pages/screener.js, index.html
## P1210 - v56.35 - Why 제목이 엔진이 방출하지 않는 상태를 비교해 항상 '순위 계산 보류'였다 · 원칙 R630 · 교훈 LC-40 인수 조건, R630(도메인 상태를 UI가 재구성하지 않음). · 검사 ci-screener-workbench-contract · 파일 src/ui/pages/screener.js
## P1209 - v56.34 - 뉴스 HTML entity가 화면에 문자열 그대로 남았다 · 원칙 R630 · 교훈 P1095 HTML-escaping boundary, R630(consumer에서 표현 수단을 바꾸지 않음), LC-24 인수 조건. · 파일 src/data/normalize/news.js
## P1208 - v56.34 - 2s10s가 금리 수준과 금리차를 섞고 cut identity를 잃었다 · 원칙 R630 · 교훈 P1147 same-observation curve contract, R630/LC-23 unit·cut identity, route owner single-writer boundary. · 파일 src/domain/macro/treasury-curve.js
## P1207 - v56.34 - SKEW가 options에는 있고 sentiment에는 없는 동일 quote였다 · 원칙 R630 · 교훈 R630 동일 결과 ID는 실제 입력만 바꾸어야 함, route/data owner 단일 경계, LC-20 동일 metric identity/read model. · 검사 ci-page-market-epoch-browser-check
## P1206 - v56.34 - 날짜 경과일이 다른 항목의 sink를 덮었다 · 원칙 R630 · 교훈 P1107 field-owned observation time, R630 DOM last-writer 금지, LC-17 인수 조건.
## P1205 - v56.34 - 티커 탭 클릭이 두 패널을 모두 숨기고 기간 버튼은 죽은 경로였다 · 원칙 R630, R624 · 교훈 R630(동일 결과 ID는 실제 입력만 바꾸어야 함), R624(상태 global의 단일 소유), LC-18/LC-27 인수 조건, P834의 native chart ownership. · 검사 ci-esm-core-unit-check, ci-architecture-browser-check, ci-retirement-contract, ci-architecture-contract-check · 파일 src/ui/pages/entity.js
## P1204 - v56.33 - Masters canonical index가 최신 holdings 세대와 다른 커밋을 만들었다 · 원칙 R457, R626 · 교훈 R457(원본·파생 projection은 같은 실행에서 재생성하고 같은 commit에 stage, CI는 staging 배선까지 검증), P1095 계열 fail-closed publication. 기존 R626 병합 규칙과 달리 여기서는 conflict가 아니라 s… · 검사 ci-data-continuity-check, ci-masters-contract-check · 파일 public-data/masters/index.json, architecture/qa-pipeline.json
## P1203 - v56.32 - VaR certified 상태가 현실적인 표본에서 도달 불가였다 · 원칙 R632, R628 · 교훈 R632(판정 경로는 도달 가능해야 한다 — 도달 불가한 인증은 인증이 아니라 상수다), P1190의 잔여, R628 계열(불가능한 상태를 '보류'로 계속 말하면 사용자는 표본을 늘려도 안 된다는 사실을 알 수 없다). · 검사 ci-portfolio-vault-e2e
## P1201 - v56.31 - 회고 경로에서 정책 셀렉터가 활성으로 보여 선언이 쓰이는 것처럼 읽혔다 · 검사 ci-portfolio-vault-e2e, ci-esm-core-unit-check
## P1200 - v56.31 - 목표비중에 현금을 넣을 수 없어 계좌 범위를 선언할 방법이 없었다 · 원칙 R632, R628 · 교훈 R632(선언 가능해야 할 입력이 검증으로 막혀 있었다), P1188의 계좌 범위 보류 원칙(보류는 근거 부재일 때만 — 근거가 선언되면 열려야 한다), R628(차액을 0으로 승격하지 않고 현금 몫으로 명시). · 검사 ci-esm-core-unit-check
## P1199 - v56.30 - 선언 저장소의 ack 계산이 ratcheted 셸 안에 있어 테스트되지 않았다 · 원칙 R620, R632 · 교훈 R620/P1127(분해는 순감소 — 그리고 여기서는 *검증 가능성*이 목적이다), P1191/P1195의 잔여(residual_risk에 직접 적어 둔 항목), R632(저장 계약의 소유자가 둘로 갈라져 있었다). · 검사 ci-esm-core-unit-check · 파일 js/aio-workspace.js, src/data/portfolio-declarations-store.js
## P1198 - v56.29 - 선언하지도 않은 리밸런싱 정책이 'declared'로 게시됐고, 정책 오타는 조용히 daily가 됐다 · 원칙 R632, R628 · 교훈 R632(선언에는 writer/consumer가 있어야 하고, 없는 선언을 만들지 않는다), R628 유사(부재를 기본값으로 승격하지 않는다), P1176 계열(오타·부재가 전략 주장으로 승격되지 않는다). · 검사 ci-esm-core-unit-check, ci-portfolio-vault-e2e · 파일 index.html, js/aio-workspace.js
## P1197 - v56.28 - 회고 경로에서 리밸런싱 정책은 결과를 바꾸지 않는데 필수였고, 정체성만 바꿨다 · 원칙 R632, R627 · 교훈 R632(선언에는 소비자가 있어야 한다 — 소비자가 없으면 요구하지도, 정체성을 바꾸지도 않는다), R627 계열(선언된 자격·입력의 효과를 결과가 증명해야 한다), P1182 계약(경로별 소비 의미를 발행). · 검사 ci-esm-core-unit-check
## P1196 - v56.27 - 원가 통화가 시세 통화와 다르면 선언된 leg가 있어도 P&L을 만들 수 없었다 · 원칙 R632, R628 · 교훈 R632(선언된 근거는 도달 가능한 소비처를 가져야 한다), R628(부재를 0으로 승격하지 않는다 — 근거가 없으면 여전히 보류), P1176 계열(P&L은 두 축이 같은 단위일 때만), P1181의 원칙(단위가 다르면 합성하지 않는다)을 근거 유무로 재적용. · 검사 ci-esm-core-unit-check
## P1195 - v56.26 - 선언 패널의 마크업과 ack 문구가 ratcheted 셸에 남아 있었다 · 원칙 R620, R632 · 교훈 R620/P1127(분해는 순감소), P831 선례(표시 계층은 네이티브), R632(문구도 계약이다 — 실패가 성공처럼 읽히면 안 된다). · 검사 ci-esm-core-unit-check · 파일 js/aio-workspace.js, src/ui/panels/portfolio-declarations.js, index.html
## P1194 - v56.25 - 혼합 통화 합계에 환산 근거를 선언할 입력이 없었고, 그 선언을 상태 슬라이스가 버렸다 · 원칙 R632, R627, R628 · 교훈 R632(선언 입력에는 writer가 있어야 한다 — FX leg), R627 계열(선언된 자격은 도달 가능한 경로가 증명돼야 한다), R628(부재를 0/1로 승격하지 않는다 — 환산 불가는 보류), P1181 클래스(선언이 경계에서 조용히 사라진다 — 이번엔 슬라… · 검사 ci-esm-core-unit-check, ci-portfolio-vault-e2e · 파일 src/domain/portfolio/fx.js, index.html, js/aio-workspace.js
## P1193 - v56.24 - 고정 목표비중 전략 경로가 선언 입력 없이 테스트에서만 호출됐다 · 원칙 R632, R627, R631 · 교훈 R632(선언 입력에는 writer가 있어야 한다 — 측정 경로·정책), R627 계열(선언된 자격은 도달 가능한 경로가 증명돼야 한다), R631(측정 경로·정책을 선언하지 않으면 인증하지 않는다 — 그 선언을 사용자가 할 수 있어야 한다). · 검사 ci-esm-core-unit-check, ci-portfolio-vault-e2e · 파일 src/data/portfolio-assumptions.js, scripts/ci-esm-core-unit-check.mjs, scripts/ci-portfolio-vault-e2e.mjs
## P1192 - v56.23 - 완료 컷 행이 컷 이후 previous-close를 실어 P1095와 history-time 계약이 충돌했다 · 원칙 R628 · 교훈 P1095(previous-completed-close 값은 현재 관측 시각을 상속하지 않으며, 완료 컷 행은 컷 이후 관측을 담지 않는다), history-time 계약(스탬프는 관측 시각이 아니라 bar 경계에서 온다), R628 계열(경계를 모르면 값을 0/현재… · 검사 ci-esm-core-unit-check, ci-history-field-time-contract-check · 파일 scripts/ci-esm-core-unit-check.mjs, scripts/ci-history-field-time-contract-check.mjs
## P1191 - v56.22 - TWR/MWR 엔진에 원장을 넣을 입력 경로가 없어 계좌 성과가 영구히 보류됐다 · 원칙 R632, R627, R631 · 교훈 R632(선언 입력에는 writer가 있어야 한다 — 원장), R627 계열(선언된 자격은 도달 가능한 경로가 증명돼야 한다), R631(측정 계약을 통과한 결과만 게시한다 — 원장도 같은 계약). · 검사 ci-esm-core-unit-check, ci-portfolio-vault-e2e · 파일 src/data/portfolio-ledger.js, scripts/ci-esm-core-unit-check.mjs, scripts/ci-portfolio-vault-e2e.mjs, index.html, js/aio-workspace.js, src/ui/pages/portfolio.js
## P1190 - v56.21 - VaR/CVaR 인증이 '검증 부재' 라벨로 영구 보류돼 표본 안정성을 판정할 수 없었다 · 원칙 R630, R628 · 교훈 P1182(선언 없는 인증 금지 — 그 대칭으로 선언된 임계값에는 인증 경로가 있어야 한다), R628 계열(부재를 영구 상태 라벨로 위장하지 않는다). · 검사 ci-esm-core-unit-check · 파일 src/domain/portfolio/backtest.js, scripts/ci-esm-core-unit-check.mjs
## P1189 - v56.21 - FRED 제공자 상태가 어휘 밖 값이라 producer가 refresh 사이클 전체를 죽였다 · 원칙 R631 · 교훈 P1091(status는 OPERATIONS_STATUS, rights/availability는 자기 어휘 — 축을 섞지 않는다), P1085(한 제공자의 실패가 전체 사이클을 죽이지 않게 레인을 분리한다), R631 계열(선언된 어휘 밖의 값을 발행하지 않는다). · 검사 ci-operations-status-check · 파일 scripts/fetch-data.mjs, src/data/contracts/operations.js, scripts/ci-operations-status-check.mjs
## P1188 - v56.20 - 계좌·현금 통화를 선언할 writer가 없었고, TWR/MWR·고정 목표비중 경로가 '차단만' 있었다 · 원칙 R627, R628, R631, R632 · 교훈 R628(부재를 0으로 승격 — 미선언 수익률·통화), R631(측정 경로·분모·RF·표본을 선언하지 않으면 인증하지 않는다 — 원장·규약도 같은 계약), R632(선언 입력에는 writer가 있어야 한다 — 계좌/현금 통화), R627 계열 원리(선언된 자격은 도달… · 검사 ci-esm-core-unit-check, ci-portfolio-vault-e2e · 파일 src/data/portfolio-assumptions.js, scripts/ci-esm-core-unit-check.mjs, scripts/ci-portfolio-vault-e2e.mjs, index.html
## P1187 - v56.19 - 포트폴리오에 통화를 선언할 writer가 없었고 import·전체삭제 경로가 저장 ack를 버렸다 · 원칙 R628, R632, R619 · 교훈 R628(부재를 확인된 값으로 승격 — 통화 추정·무효 선언 통과), R632 신설(선언 입력에는 writer가 있어야 하고, 저장 경로는 durable ack를 버리지 않는다), R619 계열 원리(입력 경로·소유권의 단일 출처). · 검사 ci-esm-core-unit-check, ci-portfolio-vault-e2e · 파일 src/data/runtime-readers.js, src/data/normalize/portfolio.js, src/domain/portfolio/surface.js, index.html, js/aio-workspace.js, scripts/ci-esm-core-unit-check.mjs
## P1186 - v56.18 - native screener state가 두 경로에서 투영돼 같은 상태를 두 번 적용했다 · 원칙 R619, R628, R622 · 교훈 R619(상태 소유자·트리거는 한 곳에 — 두 경로가 같은 projection을 씀), R628(투영을 중복 적용해 부재/최신 판정을 흐리지 않는다), R622 계열 원리(경계는 이름이 아니라 호출 지점 수로 검증한다). · 검사 ci-runtime-contract-check · 파일 js/aio-data.js, scripts/ci-runtime-contract-check.mjs
## P1185 - v56.18 - 스크리너에 리스너 없는 no-op 렌더 hook과 쓰이지 않는 전역을 읽는 죽은 reader가 남아 있었다 · 원칙 R619, R628, R622 · 교훈 R619(정의·경로는 한 곳에 — canonical 경계 옆에 죽은 두 번째 경로), R628(부재를 정상 상태처럼 반환하지 않는다 — 항상 빈 행을 돌려주는 reader), R622 계열 원리(퇴역은 심볼 부재로 검증되어야 한다 — 이름만 남은 hook). · 검사 ci-runtime-contract-check, ci-retirement-contract · 파일 js/aio-data.js, src/data/runtime-readers.js, architecture/route-owners.json, scripts/ci-runtime-contract-check.mjs, index.html
## P1184 - v56.18 - 팩터 품질 라벨이 시각 존재만으로 CURRENT였고 factor-ranks가 timeBasis를 소비하지 않았다 · 원칙 R628, R602, R619 · 교훈 R628(시각 존재를 최신성으로 승격하지 않는다 — 30일 전 관측이 CURRENT), R602(같은 observedAt이 'bar-start'와 '관측시각' 두 정의), R619(신선도 예산의 정의를 한 곳으로 — producer·소비측이 각자 판정). · 검사 ci-data-pipeline-contract-check, ci-research-model-contract-check · 파일 scripts/fetch-data.mjs, scripts/ci-data-pipeline-contract-check.mjs, scripts/ci-research-model-contract-check.mjs
## P1183 - v56.18 - quote identity 잔여(source/sourceKind/valueKind)와 registry 정본이 검증되지 않았다 · 원칙 R619, R628, R602, R629 · 교훈 R619(정본 정의는 한 곳에 — registry가 자기 오류를 검증하지 못했다), R628(부재·파생을 확인된 값으로 승격 — 'unknown'/'provider' 기본값), R602(같은 값이 서로 다른 의미 축), R629(타입·선언 구분이 검증 경계에서 다시… · 검사 ci-market-snapshot-contract-check · 파일 worker/data-plane.js, scripts/ci-market-snapshot-contract-check.mjs
## P1182 - v56.17 - 성과·위험 지표가 측정 계약(범위·RF·표본·시점) 없이 결과를 발행했다 · 원칙 R628, R602, R630, R631 · 교훈 R628(미선언·부재를 확인된 값으로 승격하지 않는다 — RF 상수·무선언 현금 분모·무표본 인증), R602(같은 라벨/수치가 다른 범위를 가림 — sleeve 수치의 account 렌더, 라벨과 실제 정책의 분리), R630 계열 원리(측정 결과에 식별자가 아예… · 검사 ci-esm-core-unit-check · 파일 src/domain/portfolio/risk.js, index.html, scripts/ci-esm-core-unit-check.mjs
## P1181 - v56.16 - 배분 정책·통화·저장 ack 세 경계가 '없는 것을 있는 척'하는 입력을 통과시켰다 · 원칙 R628, R602, R619, R629 · 교훈 R628(결측·실패를 확인된 값/완료로 승격하지 않는다 — 시장가치 폴백이 명시 제외를, persist 실패가 '완료'를, 미선언이 단일 기준을 대신했다), R602(같은 basis 라벨이 다른 정책을 가리킴 — explicit 라벨 아래 시장가치 정규화), R619… · 검사 ci-esm-core-unit-check, ci-portfolio-vault-e2e · 파일 scripts/ci-esm-core-unit-check.mjs, scripts/ci-portfolio-vault-e2e.mjs · 관련 P11
## P1180 - v56.16 - 같은 artifact에서 live mcap만 바꿔도 snapshotId와 점수·순위가 함께 바뀌어 관측과 계산이 한 ID에 묶였다 · 원칙 R24, R630, R619, R628, R602 · 교훈 R630(정체성은 대상의 입력에서 파생 — 중첩 파생 상태와 시계 파생 status가 관측 정체성의 입력이었다), R619(정의는 한 곳에 — live 키 목록이 provider에만 있고 engine은 몰랐다), R628(파생을 관측으로 승격하지 않는다 — readi… · 검사 ci-screener-workbench-contract · 파일 scripts/ci-screener-workbench-contract.mjs
## P1179 - v56.16 - 팩터 시간 계약 필드가 provider/normalizer에서 소실돼 UI가 바 시작을 세션일로 재구성했다 · 원칙 R24, R619, R602, R628 · 교훈 R619(시간 계약의 정의를 한 곳으로 모은다 — 필드가 경계마다 소실), R602(같은 bar-start가 '세션일'과 '관측시각' 두 정의로 소비), R628(파생·부재를 확인된 값으로 승격하지 않는다 — basis 없는 observedAt). · 검사 ci-data-pipeline-contract-check · 파일 scripts/fetch-data.mjs, src/data/providers/screener.js, src/data/normalize/screener.js, src/ui/pages/screener.js, src/data/runtime-readers.js, scripts/ci-data-pipeline-contract-check.mjs
## P1178 - v56.16 - 종목·단위가 맞아도 잘못된 metricId가 published snapshot을 통과했다 · 원칙 R24, R619, R602, R628 · 교훈 R619(quote identity의 정의를 registry 한 곳에 둔다 — validator가 자기 기준을 갖지 못했다), R602(같은 instrumentId가 '정상 metric'과 '임의 metric'을 모두 가리킬 수 있었다), R628(파생 identit… · 검사 ci-market-snapshot-contract-check · 파일 worker/data-plane.js, scripts/ci-market-snapshot-contract-check.mjs
## P1177 - v56.15 - 시세 tick이 ranked snapshot 정체성을 바꿔 보관한 실행을 대체했다 · 원칙 R630, R602, R619, R628 · 교훈 R630(식별자·정체성 해시는 그 대상의 입력에서 파생한다 — 이번에 만든 규칙), R602(같은 rows가 '표시 입력'과 '정체성 입력' 두 정의를 가리켰다), R619(정체성 정의를 한 곳으로 모았다), R628(파생값을 관측값으로 승격하지 않는다 — 시세 ti… · 검사 ci-screener-workbench-contract, ci-screener-auto-refresh-browser-check · 파일 scripts/ci-screener-auto-refresh-browser-check.mjs, src/data/providers/screener.js, scripts/ci-screener-workbench-contract.mjs
## P1176 - v56.14 - 미설정 목표가가 0으로 저장돼 '목표 $0.00 · -100% 잠재수익'으로 표시됐다 · 원칙 R628, R629, R602, R619 · 교훈 R629(미설정 입력을 0으로 직렬화하지 않는다 — 이번에 만든 규칙), R628(결측을 '관측된 0'으로 바꾸지 않는다 — 세 경계에서 재발), R602(같은 '목표가 미설정' 라벨이 두 정의를 가리켰다), R619(목표가의 정의를 한 곳으로 모았다). · 검사 ci-esm-core-unit-check, ci-portfolio-vault-e2e · 파일 js/aio-workspace.js, src/data/runtime-readers.js, src/data/normalize/portfolio.js, src/ui/pages/portfolio.js, src/legacy/compatibility-facade.js, scripts/ci-esm-core-unit-check.mjs · 관련 P11
## P1175 - v56.13 - 통화 없는 합산을 완전한 평가로 표시했다 · 원칙 R628, R602, R619 · 교훈 R628(미확인을 확인으로 승격 — 통화 없는 합산이 complete), R602(단위 판정을 합산 지점 한 곳으로 모았다), R619(합계의 기준 통화를 소비자가 선언하게 했다). · 검사 ci-esm-core-unit-check · 파일 src/data/normalize/portfolio.js, src/domain/portfolio/surface.js, js/aio-workspace.js · 관련 P11
## P1174 - v56.12 - 통화를 잃은 quote가 현재 가격이 됐고, 수익률에는 비교 기준이 없었다 · 원칙 R628, R602, R619 · 교훈 R628(미완전한 것을 완전한 것으로 승격하지 않는다 — 통화 없는 quote가 현재 가격, 이름이 조정 선언), R602(가격/통화/시각이 따로 판정되던 것을 한 계약으로 모았다), R619(비교 기준을 소비자 선언 한 곳으로 모았다). · 검사 ci-screener-workbench-contract · 파일 src/data/providers/screener.js, src/data/providers/quote-contract.js, src/domain/screener/return-contract.js
## P1173 - v56.11 - 파일별 신선함을 입력 묶음의 호환성으로, 선언된 게이트 입력을 실제 선택 규칙으로 읽었다 · 원칙 R628, R602, R619 · 교훈 R628(확인되지 않은 것을 확인된 것으로 승격하지 않는다 — 무조건 합치기, 전역 정상, 실행되지 않는 게이트, 채워지지 않는 캐시), R602(같은 낱말이 두 정의를 가리켰다 — ready/overall/inputs), R619(새 계약 축을 소비자 선언 한 곳에… · 검사 ci-screener-workbench-contract, ci-operations-contract-check, ci-qa-pipeline-contract-check, ci-service-worker-cache-policy-check · 파일 src/data/providers/screener.js, js/aio-kr-data.js, src/data/providers/publication-set.js, _context/gate-baseline-skip-list.json, sw.js
## P1172 - v56.10 - '공식 도메인'이 '이 질문에 답했다'로 승격됐고, 텍스트 claim 하나가 수치 검사를 껐다 · 원칙 R628, R602, R619 · 교훈 R628(미확인·무결속을 확인된 근거로 승격하지 않는다), R602(같은 ready가 '출처 존재'와 '질문 충족' 두 정의를 가리켰다), R619(수치 조건 해제 규칙을 claim 타입 계약 하나로 모았다). · 검사 ci-ai-intelligence-contract-check · 파일 scripts/ci-ai-intelligence-contract-check.mjs
## P1171 - v56.09 - 식별 metadata의 출처가 없는데 이름 추측으로 채울 뻔했고, ETF가 발행자 비율 모델에 들어갈 수 있었다 · 원칙 R628, R619, R602 · 교훈 R628(미확인을 확인으로 승격하지 않는다 — 이름 추측으로 assetType을 채우는 경로를 만들지 않았다), R619(식별 규칙의 단일 정본을 registry로 만들었다), R602(ETF와 보통주가 같은 비율 모델을 가리켰다 — 이제 유형이 적격성을 가른다). · 검사 ci-screener-workbench-contract · 파일 src/domain/market/instrument-registry.js, scripts/ci-screener-workbench-contract.mjs, src/data/providers/screener.js
## P1170 - v56.08 - 일봉 바 시작이 '관측시각'이라는 이름 하나로 발행돼 소비자가 의미를 추측해야 했다 · 원칙 R614, R602, R619 · 교훈 R614(시점·출처 정합 — 계산 시점과 바 시작을 같은 이름으로 발행하지 않는다), R602(전역 factorObservedAt이 '전체 시장'과 '개별 시장' 두 정의를 가리켰다), R619(세션 시각 규칙의 단일 구현을 만들었다 — 이전에는 존재하지 않았다). · 검사 ci-data-pipeline-contract-check · 파일 scripts/fetch-data.mjs, src/domain/market/session-time.js, scripts/ci-data-pipeline-contract-check.mjs, public-data/data.json, src/data/providers/screener.js
## P1169 - v56.07 - SEC 수집이 전부 실패해도 workflow는 성공으로 끝났고, 그 성공이 수집 성공으로 읽혔다 · 원칙 R628, R620, R613 · 교훈 R628(미관측·0건 갱신을 성공으로 승격하지 않는다), R620(선언한 계약을 실제로 호출한다 — coverage/형식 검사는 있었지만 이번 수집 성과는 어디에서도 판정되지 않았다), R613(발행 어휘가 NO_REFRESH_RETAINED 같은 실제 상태를 이름… · 검사 ci-sec-runtime-projection-check · 파일 scripts/fetch-sec-fundamentals.mjs, scripts/ci-sec-runtime-projection-check.mjs
## P1168 - v56.06 - 내용이 같은 생성물이 'drift'로 보고됐고, 기계 실행이 사용자 실행 이력에 쌓였다 · 원칙 R620, R602, R628 · 교훈 R620(선언한 계약을 실제로 검사한다 — 해시 비교가 '내용'이 아니라 '체크아웃 표현'을 검사했다), R602(같은 라벨 runHistory가 기계 실행과 사용자 실행 두 정의를 가리켰다), R628(변경 없음을 변경으로 보고하지 않는다). · 검사 ci-screener-auto-refresh-browser-check · 파일 src/data/orchestrators/screener.js
## P1167 - v56.05 - 일봉 바 시작 시각이 팩터 '관측시각'으로, 식별 metadata 미확인이 침묵으로 표시됐다 · 원칙 R614, R628, R620 · 교훈 R614(시점·출처 정합 — 계산 시점과 관측 시점을 같은 이름으로 표시하지 않는다), R628(미확인·결측을 확인된 결과로 승격하지 않는다), R620(선언한 계약을 소비 경로에서 실제로 호출한다 — 검증기를 정의만 하고 provider에서 호출하지 않았다). · 검사 ci-screener-auto-refresh-browser-check · 파일 src/ui/pages/screener.js, src/data/normalize/screener.js, scripts/ci-screener-auto-refresh-browser-check.mjs
## P1166 - v56.04 - 한 도메인이 0회 실행돼도 30일 SLO는 CERTIFIED였고, 관측 없는 정적 설정은 CURRENT였다 · 원칙 R628, R602, R613, R619 · 교훈 R628(미관측·0회 실행을 PASS/CURRENT로 승격하지 않는다), R602(같은 라벨 'artifact 성공률'이 두 도메인을 가리켰다), R613(발행 어휘가 실제 상태를 이름 짓지 못하면 소비자가 구분할 수 없다), R619(집계가 두 의미를 한 판정으로… · 검사 ci-operations-slo-window-check · 파일 scripts/build-operations-slo-window.mjs, public-data/operations-status.json, scripts/ci-operations-slo-window-check.mjs, scripts/build-operations-status.mjs
## P1165 - v56.03 - 실행 전 '통과' 수치가 선택한 정의가 아니라 파이프라인 기본값이었다 · 원칙 R602, R619, R628 · 교훈 R602(같은 라벨이 두 정의를 가리키면 정의나 라벨을 하나로 만든다), R619(같은 의미의 구현은 하나만 둔다 — 미리보기와 실행이 같은 의미를 서로 다르게 계산했다), R628(결측·부적격을 실제 결과로 승격하지 않는다). · 검사 ci-screener-auto-refresh-browser-check · 파일 src/data/orchestrators/screener.js, src/ui/pages/screener.js, scripts/ci-screener-auto-refresh-browser-check.mjs, scripts/ci-screener-workbench-contract.mjs, scripts/ci-esm-core-unit-check.mjs, scripts/ci-domain-parity-check.mjs
## P1164 - v56.02 - 결측이 '관측된 0'·'관측된 구간'이 되어 위기 문장과 예외를 만들었다: Number(null)===0 클래스 · 원칙 R602, R628, R613, R625 · 교훈 R602(결측을 다른 입력으로 대체 금지), R628(신규), R613(값·시각 정합), R625(픽스처가 검출기를 대신 맞춰주면 검사가 아니다). · 검사 ci-headless-tests · 파일 js/aio-macro-tech.js, js/aio-pages.js, scripts/ci-headless-tests.mjs, scripts/ci-screener-workbench-contract.mjs, scripts/ci-syntax-check.mjs
## P1163 - v56.01 - 버전 계약이 둘로 갈라져 있었다: 게이트는 v56을 허용하고 런타임은 v56.01을 요구했다 · 원칙 R1, R619, R627 · 교훈 R619(같은 의미를 두 곳에 두지 않는다 — 버전 형식의 소유자가 게이트와 런타임으로 갈라져 있었다), R627. · 파일 scripts/bump-version.mjs, scripts/ci-headless-tests.mjs, scripts/ci-version-check.mjs, scripts/generate-workspace-state.mjs, _context/BUG-POSTMORTEM.md
## P1162 - v56 - macro 페이지가 매 마운트마다 ReferenceError로 죽어 있었다: tenY 단축 표기 · 원칙 R352 · 교훈 R352(단일 구현 이전 시 소비측까지 전수 갱신), F-09(의미 단위 단일 소유). · 파일 src/ui/pages/market.js, scripts/ci-user-journey-quality-check.mjs, scripts/ci-syntax-check.mjs
## P1161 - v56 - vertical-slice 마커를 "마운트가 소유한 것"으로 취급해 dispose가 지웠고, 브라우저 게이트 4개가 macro에서 막혔다 · 원칙 R619, R618 · 교훈 R619(같은 의미를 두 곳에 두지 않는다 — 마커 소유자가 마운트와 노드로 갈라져 있었다), R618. · 검사 ci-architecture-browser-check, ci-vertical-slice-browser-check, ci-headless-tests · 파일 scripts/ci-architecture-browser-check.mjs, scripts/ci-vertical-slice-browser-check.mjs, scripts/ci-headless-tests.mjs, scripts/ci-syntax-check.mjs
## P1160 - v56 - 주말마다 시장 스냅샷이 발행 정지됐고, 그걸 막는 게이트가 실제로는 막지 않았다 · 원칙 R627, R606, R613 · 교훈 R627(선언과 실제 강제의 정합), R606(집계/게시 경계), R613(값·시각 정합). · 검사 ci-market-snapshot-contract-check · 파일 public-data/market-snapshot.json, scripts/ci-market-snapshot-contract-check.mjs, scripts/build-market-snapshot.mjs
## P1159 - v56 - wrangler 버전 "통일"이 fast-plane 배포를 실제로 깨뜨렸고, 게이트는 모양만 보고 있었다 · 원칙 R627 · 교훈 R627(선언과 실제 강제의 정합) — 이번엔 게이트가 모양을 검사하고 동작 조건을 검사하지 않았다. · 검사 ci-cloudflare-deployment-contract-check · 파일 scripts/ci-cloudflare-deployment-contract-check.mjs
## P1158 - v56 - 액션 핀이 낡아 Node 20 지원 종료 경고가 났고, 그 핀을 지키는 게이트가 없었다 · 원칙 R627, R618 · 교훈 R627(선언과 강제의 정합), R618(원장 루프). · 파일 .github/dependabot.yml, scripts/ci-operator-secrets-contract-check.mjs
## P1157 - v56 - 실효 상한이 isolate 수에 비례하던 레이트리밋을 Cloudflare 바인딩으로 교체 · 원칙 R627 · 교훈 R627(선언과 실제 강제의 정합) — 이번 사례는 문서가 가리킨 방어 경로 자체가 그 배포 형태에서 존재하지 않았다. · 검사 ci-worker-relay-check, ci-worker-anthropic-check · 파일 cloudflare-worker-proxy.js, worker/wrangler.proxy.toml, scripts/ci-worker-relay-check.mjs, scripts/ci-worker-anthropic-check.mjs, scripts/ci-proxy-continuity-check.mjs, scripts/ci-cloudflare-deployment-contract-check.mjs
## P1156 - v56 - 방어선이 광고와 실제가 달랐던 4곳 + 조용한 결손 1곳 · 원칙 R627, R618 · 교훈 R627(선언과 실제 도달/강제의 정합), R618(원장 루프). · 검사 ci-worker-relay-check, ci-data-plane-contract-check · 파일 worker/data-plane.js, sw.js, scripts/ci-worker-relay-check.mjs, scripts/ci-data-plane-contract-check.mjs, scripts/ci-worker-anthropic-check.mjs, scripts/ci-proxy-continuity-check.mjs
## P1155 - v56 - dead entry·폐기 안내·dead secret·문서 드리프트 4건 · 원칙 R627, R1 · 교훈 R627(선언과 도달 경로의 정합), R1(표면 동기화). · 검사 ci-data-pipeline-contract-check · 파일 js/aio-core.js, scripts/ci-data-pipeline-contract-check.mjs, scripts/ci-operator-secrets-contract-check.mjs, scripts/ci-syntax-check.mjs
## P1154 - v56 - Claude 서버모드 무UI와 저장만 반영하던 제공자 상태 · 원칙 R463 · 교훈 R463(AI readiness는 저장이 아니라 선택된 endpoint를 검증한다). · 검사 ci-ai-chat-reliability-contract-check · 파일 cloudflare-worker-proxy.js, scripts/ci-ai-chat-reliability-contract-check.mjs, scripts/ci-syntax-check.mjs
## P1153 - v56 - 웹 검색 키가 코드·Vault·export에는 있는데 입력 경로가 없었다 · 원칙 R627 · 교훈 R627(선언과 도달 경로의 정합). · 검사 ci-worker-relay-check · 파일 index.html, scripts/ci-syntax-check.mjs, scripts/ci-runtime-contract-check.mjs
## P1152 - v56 - fast data plane이 게시만 되고 소비자도 승격 게이트도 없었다 · 원칙 R503, R627 · 교훈 R503(참조 깊이·최신성·권리 검토를 서로 다른 승격 단계로 보존), R627. · 검사 ci-fast-plane-consumer-gate · 파일 worker/data-plane.js, src/app/bootstrap.js, architecture/worker-endpoints.json, scripts/ci-fast-plane-consumer-gate.mjs, scripts/ci-market-snapshot-contract-check.mjs, scripts/ci-operator-readiness-check.mjs
## P1151 - v56 - FRED·BOK ECOS·KOSIS는 사용자에게 도달 불가였다 · 원칙 R627, R463 · 교훈 R627(선언된 자격증명은 도달 가능한 경로가 증명돼야 한다), R463. · 검사 ci-worker-relay-check · 파일 scripts/ci-worker-relay-check.mjs, scripts/ci-worker-anthropic-check.mjs, scripts/ci-proxy-continuity-check.mjs, scripts/ci-cloudflare-deployment-contract-check.mjs
## P1150 - v55.23 - W00/W02 잔여: 내비게이션 단일 commit + portfolio provider 단일 출처 · 원칙 R352 · 교훈 R352(이중 writer/이중 실행), F-09(의미 단위 단일 소유) — 신규 규칙 승격은 회귀 관찰 후 판단. · 검사 ci-esm-core-unit-check · 파일 scripts/ci-esm-core-unit-check.mjs, scripts/ci-architecture-browser-check.mjs · 관련 P4
## P1149 - v55.23 - W04: 집계 분모 범위와 지식 dossier의 의미 분리 · 원칙 C01, C02, R606 · 교훈 R606(집계 범위와 라벨 정합), F-09(의미 단위 정합성). · 검사 ci-knowledge-sector-domain-depth · 파일 scripts/build-knowledge-domain-dossiers.mjs
## P1148 - v55.23 - W09: SEC 파생값 가용시각과 뉴스 절대시각 · 원칙 R614 · 교훈 R614(시점·출처 정합), F-09. · 검사 ci-data-pipeline-contract-check, ci-esm-core-unit-check · 파일 src/ui/pages/news.js, scripts/ci-data-pipeline-contract-check.mjs, scripts/ci-esm-core-unit-check.mjs, public-data/sec-fundamentals.json
## P1147 - v55.23 - W08: 시장 건강도 표본 coverage와 2s10s leg 정렬 · 원칙 R613, R614 · 교훈 R613(값·시각 정합), R614. · 검사 ci-esm-core-unit-check · 파일 scripts/ci-esm-core-unit-check.mjs, scripts/ci-desktop-continuity-check.mjs
## P1146 - v55.23 - W07: 스크리너 가중·순위·백분위·가격축·월별 그리드 · 원칙 R602, R613 · 교훈 R602(결측을 다른 입력으로 대체 금지), R613. · 검사 ci-esm-core-unit-check, ci-screener-workbench-contract, ci-domain-parity-check
## P1145 - v55.23 - W03: 스냅샷 실측 coverage 검증과 quote 표시 상태 · 원칙 R613, R614 · 교훈 R613(값·단위·시각 정합), R614. · 검사 ci-market-snapshot-contract-check, ci-desktop-continuity-check · 파일 scripts/ci-market-snapshot-contract-check.mjs, scripts/ci-desktop-continuity-check.mjs, scripts/ci-data-pipeline-contract-check.mjs
## P1144 - v55.22 - CI data 게이트 3건: 24/7 BTC 종가축 어긋남 + 권리 미검증 승격 · 원칙 R613, R614 · 교훈 R613(값·시각 정합), R614(게이트 조합 정합). · 검사 ci-history-field-time-contract-check, ci-artifact-semantics-check
## P1143 - v55.21 - 구조 개편 W01/W01-C/W02/W00: 화면 정합성·포트폴리오 상태·내비게이션 단일화 · 원칙 R352 · 교훈 R352(이중 writer), F-09(의미 단위 정합성) — 신규 규칙 승격은 후속 회귀 관찰 후 판단. · 검사 ci-esm-core-unit-check, ci-architecture-contract-check · 파일 src/domain/sentiment/narrative.js, scripts/ci-esm-core-unit-check.mjs · 관련 P1, P4
## P1142 - v55.21 - 데이터 파이프라인 전수 재감사에서 나온 결함 12건 · 원칙 R626, R620 · 검사 ci-version-check, ci-csp-ratchet-check, ci-worker-anthropic-check, ci-runtime-contract-check · 파일 js/aio-kr-data.js, index.html, worker/README.md, src/ui/pages/sentiment.js, sw.js
## P1141 - v55.21 - 리베이스 해소를 규칙과 도구로 고정하고, QA 낭비를 실측했다 · 원칙 R626 · 교훈 R626(신규). · 파일 scripts/resolve-data-manifest-merge.mjs
## P1140 - v55.20 - 리베이스 후 검증에서 드러난 3건 · 원칙 R620, R622 · 교훈 R620(측정면 — 게이트가 플랫폼에 따라 다르게 판정했다), R622(추출은 위치를 보존한다). · 검사 ci-chat-ui-state-browser-check, ci-version-check, ci-release-manifest-contract, ci-workspace-contract-check · 파일 js/aio-workspace.js, index.html
## P1139 - v55.20 - 인과 탐지기가 한국어를 보지 못했고, 픽스처가 그걸 가리고 있었다 · 원칙 R625 · 교훈 R625(신규) — 픽스처가 검출기의 언어를 대신 맞춰주면 그 검사는 아무것도 검사하지 않는다. · 파일 scripts/fetch-data.mjs, _context/CODEX-SECOND-PASS-HANDOFF-2026-07-10.md, _context/doc-freshness-baseline.json
## P1138 - v55.19 - 전역 승자·로드 순서를 기계적으로 검사한다 · 원칙 R280, R622, R624 · 교훈 R622(실행 순서), R624(신규). · 파일 index.html, architecture/runtime-script-order.json, architecture/global-ownership-baseline.json, js/aio-ui.js
## P1137 - v55.18 - 3단계: 라우트 20개가 다섯 곳에 다섯 순서로 있었다 · 원칙 R620, R623 · 교훈 R620(측정면), R623(신규 — 같은 집합을 여러 곳에 손으로 적지 않는다). · 검사 ci-architecture-contract-check, ci-architecture-browser-check, ci-route-soak-check, ci-desktop-continuity-check · 파일 js/aio-core.js, src/app/routes.js, architecture/route-owners.json, architecture/golden-routes.json, scripts/generate-route-registry.mjs
## P1136 - v55.17 - 2단계 완결: 블록 A 이관, 인라인 15,308줄 → 154줄 · 원칙 R622, R619, R620, R280 · 교훈 R620(측정·커버리지), R622(실행 위치 보존). · 검사 ci-runtime-contract-check, ci-architecture-contract-check, ci-chat-resilience-check, ci-professional-data-gap-check · 파일 js/aio-workspace.js, index.html
## P1135 - v55.16 - 추출한 파일을 defer 그룹 *뒤*에 붙여 실행 순서를 뒤집었다 · 원칙 R340, R620, R622, R280 · 교훈 R620(3항), R622(신규 — 추출은 실행 위치를 보존한다). · 검사 ci-architecture-browser-check · 파일 index.html, js/aio-pages.js, js/aio-ui.js, js/aio-macro-tech.js
## P1134 - v55.15 - 추출한 모듈을 프리캐시에 넣을 뻔했다 · 원칙 R621, R620, R340, R345 · 교훈 R620(3항 — 새 파일이 곧 새 무제한 구역), R621(신규). · 파일 js/aio-kr-data.js, index.html, sw.js, js/aio-pages.js
## P1133 - v55.14 - 등록된 새 파일로 추출해 측면 이동을 막았다 · 원칙 R620, R280, R344, R619 · 교훈 R620(3항 — 커버리지와 측면 이동), R619(2항 — 단언 소유자는 코드를 따라간다). · 파일 index.html, js/aio-pages.js, architecture/asset-manifest.json, sw.js, .github/workflows/pages-deploy.yml, architecture/decomposition-hotspots.json · 관련 P797, P798, P799, P801, P802
## P1132 - v55.13 - 블록 F 이관이 잠복 전역 섀도잉을 드러냈다 · 원칙 R619, R620, R280 · 교훈 R619(2항 — 폴백·사본은 조용히 다른 결과를 낸다), R620(3항). · 파일 index.html, js/aio-ui.js
## P1131 - v55.12 - 블록 G 이관에서 게이트 고정 텍스트가 예상의 7.5배였다 · 원칙 R619, R620, R280 · 교훈 R619(2항 — 옮긴 코드의 단언 소유자는 함께 옮긴다), R620(3항). · 검사 ci-ai-intelligence-contract-check, ci-ai-chat-reliability-contract-check · 파일 index.html, js/aio-chat.js
## P1130 - v55.11 - 인라인 셸 코드를 새 파일 없이 기존 등록 파일로 이관했다 · 원칙 R280, R620, R619 · 교훈 R620(3항 — 커버리지를 빠뜨리면 압력은 옆으로 샌다: 새 무제한 구역을 만들지 않는 분해 방식), R619(3항 — 상한이 있는 파일은 순증 0 이하). · 파일 index.html, architecture/asset-manifest.json, sw.js, .github/workflows/pages-deploy.yml, js/aio-ui.js
## P1129 - v55.10 - 중복 선언·죽은 코드·3중으로 어긋난 문서 수치 · 원칙 R619, R620 · 교훈 R619(1항·2항 — 같은 의미의 선언·수치를 두 곳에 두지 않는다), R620(4항 — 측정 대상은 문서에 등록하고, 문서 수치는 생성물에서 파생한다). · 파일 index.html · 관련 P725, P797, P796
## P1128 - v55.09 - OPEX 만기 계산이 두 규칙으로 갈라져 한쪽만 시간대 보정을 받았다 · 원칙 R619 · 교훈 R619(신규, 1항·2항·3항). · 파일 js/aio-data.js, js/aio-core.js
## P1127 - v55.08 - 크기 상한이 벽이 되어 1줄 수정을 막았고, 선언된 수치를 게이트가 읽지 않았다 · 원칙 R450, R620 · 교훈 R620(신규). R450은 유지된다(래칫 원칙은 R450이 이미 요구한 "ratchet-only" 관리와 같은 방향이며, 이번 변경은 그 요구를 실제로 집행한 것이다). · 파일 js/aio-core.js, architecture/decomposition-hotspots.json
## P1126 - v55.07 - HTML 이스케이프가 최대 8벌로 갈라져 있었다 · 원칙 R619 · 교훈 R619(신규). · 파일 js/aio-data.js, js/aio-ui.js, index.html
## P1125 - v55.06 - 문서 신선도 검사가 대부분의 문서를 보지 않았고, 분류 충돌을 숨겼다 · 원칙 R618 · 교훈 R618(4항). · 검사 ci-knowledge-lint-check · 파일 _context/CODEX-SECOND-PASS-HANDOFF-2026-07-10.md, _context/doc-freshness-baseline.json
## P1124 - v55.06 - 2,440개 단언 중 절반이 "왜 있는지"를 말하지 않았다 · 원칙 R618 · 교훈 R618(1항). · 파일 js/aio-tests.js, scripts/ci-assertion-trace-check.mjs, _context/assertion-trace-baseline.json
## P1123 - v55.06 - 원장의 구멍과 OPEN 항목에 재검증 트리거가 없었다 · 원칙 R1, R53, R111, R113, R136, R171, R618 · 교훈 R618(2항·3항). · 파일 scripts/ci-ledger-integrity-check.mjs, _context/rule-gap-manifest.json, _context/open-item-baseline.json
## P1122 - v55.05 - 자동 시장 분석이 사용자에게 영구히 도달할 수 없었다 · 원칙 R613, R617 · 교훈 R613(1항), R617(신규). · 검사 ci-data-pipeline-contract-check
## P1121 - v55.05 - 프롬프트가 일상적인 수치·방향 질문을 "확인 필요"로 되돌렸다 · 원칙 R617 · 교훈 R617(신규). · 검사 ci-ai-intelligence-contract-check
## P1120 - v55.05 - 개인화 지시와 수치 주장이 "차단"이어야 할 이유가 없었다 · 원칙 R617 · 교훈 R617(신규). · 검사 ci-ai-intelligence-contract-check, ci-runtime-contract-check · 파일 src/ai/orchestrator/answer-orchestrator.js, js/aio-tests.js
## P1119 - v55.04 - 헤드라인 전용 뉴스의 인과 근거 0건이 선언되지 않았다 · 원칙 R613, R614 · 교훈 R613(1항), R614(5항). · 검사 ci-data-pipeline-contract-check
## P1118 - v55.04 - 총점과 팩터 배분의 차액이 화면에 없었다 · 원칙 R613, R615 · 교훈 R613(1항), R615. · 검사 ci-artifact-semantics-check, ci-runtime-contract-check, ci-architecture-browser-check
## P1117 - v55.04 - history 대체 표식이 프로듀서에서 버려져 게이트가 영구 면제됐다 · 원칙 R613, R614 · 교훈 R613(1항·2항), R614(7항). · 검사 ci-history-field-time-contract-check
## P1116 - v55.04 - quote 평면이 인용한 산출물에 시세 행이 없었다 · 원칙 R613, R614 · 교훈 R613(1항), R614(2항). · 검사 ci-runtime-contract-check · 파일 js/aio-core.js
## P1115 - v55.03 - 클라이언트가 fetch하는 경로에 발행자가 없었다 · 원칙 R614, R615 · 교훈 R614(6항), R615(3항). · 검사 ci-artifact-semantics-check · 파일 public-data/earnings-calendar.json
## P1114 - v55.03 - 전년동월비 시리즈가 빈 단위를 선언했다 · 원칙 R613, R614, R615 · 교훈 R613(1항), R614(5항·7항), R615. · 검사 ci-runtime-contract-check · 파일 js/aio-data.js
## P1113 - v55.03 - 정규화 버킷이 개별 행의 관측 시각으로 대체될 수 있었다 · 원칙 R613, R614, R615 · 교훈 R613(2항), R614(7항), R615. · 검사 ci-runtime-contract-check · 파일 src/data/providers/screener.js
## P1112 - v55.03 - 캐시 라우팅이 소비자 없는 산출물을 캐시한다고 선언했다 · 원칙 R614, R615 · 교훈 R614(6항), R615. · 검사 ci-service-worker-cache-policy-check · 파일 sw.js
## P1111 - v55.03 - 아무도 읽지 않는 런타임 자산 등록부가 드리프트했다 · 원칙 R615 · 교훈 R615. · 검사 ci-service-worker-cache-policy-check · 파일 sw.js, src/ai/operations/control-plane.js, src/data/contracts/revision.js, src/platform/sanitizer.js
## P1110 - v55.03 - 중첩 산출물 1,372개에 신선도 측정면이 없었다 · 원칙 R614, R615 · 교훈 R614(6항), R615.
## P1109 - v55.03 - 퇴역한 범위의 산출물이 계속 발행되고 참조가 해소되지 않았다 · 원칙 R614, R615 · 교훈 R614(6항), R615. · 검사 ci-artifact-semantics-check
## P1108 - v55.02 - 서술 근거의 legacy 면제가 canonical 0행을 영구 통과시켰다 · 원칙 R613, R614 · 교훈 R613(2항·3항), R614. · 검사 ci-artifact-semantics-check
## P1107 - v55.02 - marketSurveys.checkedAt이 영구 동결된 채 살아있는 이름을 썼다 · 원칙 R613, R614 · 교훈 R613(6항), R614. · 검사 ci-artifact-semantics-check, ci-web-research-contract-check
## P1106 - v55.02 - FRED 시리즈 표에 중복 키가 있어 앞 선언이 죽어 있었다 · 원칙 R614 · 교훈 R614. · 검사 ci-runtime-contract-check · 파일 js/aio-data.js
## P1105 - v55.02 - 히스토리 시계열이 소비자가 읽는 fieldMeta를 버렸다 · 원칙 R614 · 교훈 R614. · 검사 ci-runtime-contract-check · 파일 src/ui/pages/market.js
## P1104 - v55.02 - 관측되지 않은 Worker health가 CURRENT로 발행됐다 · 원칙 R613, R614 · 교훈 R613(6항), R614. · 검사 ci-artifact-semantics-check
## P1103 - v55.02 - 권리 축과 정합성 축의 어휘가 선언되지 않았고, MATCH가 권리를 승격했다 · 원칙 R613, R614, R812 · 교훈 R613(5항), R614, R812. · 검사 ci-artifact-semantics-check · 파일 src/data/contracts/operations.js
## P1102 - v55.02 - earnings-calendar.json이 소비자·계보 정책 없이 생산돼 CI 트랩이었다 · 원칙 R614 · 교훈 R614. · 검사 ci-data-pipeline-contract-check · 파일 index.html
## P1101 - v55.02 - history.json 행 스키마가 비균질하고 최신행이 breadth 5필드를 누락했다 · 원칙 R613, R614 · 교훈 R613(1항), R614. · 검사 ci-history-field-time-contract-check, ci-artifact-semantics-check
## P1100 - v55.02 - F&G 일별 시계열이 같은 날 두 점을 가졌고 값과 출처가 어긋났다 · 원칙 R613, R614 · 교훈 R613(1항·2항), R614. · 검사 ci-artifact-semantics-check
## P1099 - v55.02 - 전환 면제가 만료 없이 영구 공허 통과였다 · 원칙 R614 · 교훈 R614.
## P1098 - v55.02 - 텔레그램 커버리지가 280.5%로 발행됐다 · 원칙 R613, R614 · 교훈 R613(1항), R614. · 검사 ci-artifact-semantics-check · 파일 js/aio-tests.js
## P1097 - v55.02 - newsSourceCount가 피드 수를 출처 수로 발행했다 · 원칙 R614 · 교훈 R614. · 검사 ci-artifact-semantics-check
## P1096 - v55.02 - BEA PCE 월간 core 값이 12개월 문단에서 왔다 · 원칙 R613, R614 · 교훈 R613(1항·2항), R614. · 검사 ci-history-field-time-contract-check
## P1095 - v55.01 - 이전 종가가 현재 관측 시각을 상속해 히스토리 시간축이 한 세션 어긋났다 · 원칙 R613 · 교훈 R613 (신규). · 검사 ci-artifact-semantics-check
## P1094 - v55.01 - 점수 배분이 총점을 재구성할 수 없었다 · 원칙 R613 · 교훈 R613 (신규). · 검사 ci-artifact-semantics-check · 파일 index.html
## P1093 - v55.01 - 서술의 근거가 발행 산출물에 존재하지 않았다 · 원칙 R613 · 교훈 R613 (신규). · 검사 ci-artifact-semantics-check · 파일 js/aio-core.js
## P1092 - v55.01 - 동결된 freshness 판정이 현재 상태로 읽혔다 · 원칙 R613 · 교훈 R613 (신규). · 검사 ci-artifact-semantics-check
## P1091 - v55.01 - statusVocabulary가 실제 status 값과 교집합이 0이었다 · 원칙 R613 · 교훈 R613 (신규). · 검사 ci-artifact-semantics-check
## P1090 - v55.01 - macro 신선도 플래그가 19개 전부 거짓 stale이었다 · 원칙 R613 · 교훈 R613 (신규). · 검사 ci-artifact-semantics-check
## P1089 - v54.99 - 운영자 프로비저닝이 어떤 정본 문서에도 없었다 · 원칙 R612 · 교훈 R612 (신규). · 검사 ci-workspace-contract-check · 파일 _context/OPERATOR-RUNBOOK.md, scripts/ci-operator-secrets-contract-check.mjs, scripts/workspace-state-lib.mjs
## P1088 - v54.99 - 워크플로 job에 실행 상한이 없어 주기 전체가 막힐 수 있었다 · 원칙 R607 · 교훈 R607 (신규). · 검사 ci-qa-pipeline-contract-check
## P1087 - v54.99 - 봇이 디스패치한 CI의 attestation에 소비자가 없어 라이브 배포가 정지했다 · 원칙 R263, R606 · 교훈 R606 (신규). · 검사 ci-qa-pipeline-contract-check · 파일 scripts/ensure-live-convergence.mjs
## P1086 - v54.99 - 서비스워커 폴백이 나이 상한 없이 오래된 시세를 현재 값으로 서빙했다 · 원칙 R608 · 교훈 R608 (신규). · 검사 ci-service-worker-cache-policy-check · 파일 sw.js
## P1085 - v54.99 - 시세 레인 하나의 실패가 데이터 사이클 전체를 중단시켰다 · 원칙 R609 · 교훈 R609 (신규). · 검사 ci-qa-pipeline-contract-check
## P1084 - v54.99 - 에이전트 편집 훅이 Claude 페이로드에서 무력했다 · 원칙 R611 · 교훈 R611 (신규). · 검사 ci-workspace-contract-check · 파일 scripts/agent-hook.mjs
## P1083 - v54.99 - 워치독 실패 요약 스텝이 셸 확장으로 죽어 진단이 유실됐다 · 원칙 R610 · 교훈 R610 (신규). · 검사 ci-qa-pipeline-contract-check · 파일 scripts/report-qa-failures.mjs
## P1082 - v54.98 - 이벤트 레지스트리 등록이 빈-레지스트리 단언 4건을 깨뜨렸다 · 원칙 R605 · 교훈 없음(신규 설계에 맞춘 테스트 갱신). R605 관련.
## P1081 - v54.98 - 정적 DB data-refresh 분리·일정 커버리지 확장·만료 정책 · 원칙 R605 · 교훈 R605 (신규). · 파일 scripts/fetch-earnings-calendar.mjs
## P1080 - v54.98 - 데이터 파이프라인 구조 4건: hy-oas 허용목록·SEC pe/pb·상태 쓰기·정적 시총 서술 · 원칙 R604, R596, R595 · 교훈 R604 (신규, 정적 DB 구성 한정). R596(정본 어휘)·R595(원자성 분리) 관련. · 검사 ci-screener-workbench-contract · 파일 index.html
## P1079 - v54.98 - 생성된 현재 상태가 데이터 refresh 휘발값을 고정해 배포를 재차단했다 · 원칙 R595, R603 · 교훈 R603 (신규). R595와의 충돌 해소를 포함한다. · 검사 ci-workspace-contract-check · 파일 scripts/workspace-state-lib.mjs, public-data/operations-status.json, _context/CURRENT-STATE.md, scripts/ci-workspace-contract-check.mjs
## P1078 - v54.98 - 같은 라벨이 두 정의를 가리키던 수치 표면 6건 · 원칙 R602 · 교훈 R602.
## P1077 - v54.98 - 게이트가 죽은 코드 안 문자열을 사용자 출력 증거로 단언했다 · 원칙 R601 · 교훈 R601. · 파일 src/ui/knowledge/supplied-material-bridge.js, scripts/ci-atlas-contract-check.mjs
## P1076 - v54.98 - 계약 감사가 자기 부작용을 검증해 항상 통과했다 · 원칙 R600 · 교훈 R600. · 파일 index.html, js/aio-core.js
## P1075 - v54.98 - 질문 분류 축이 수치·현재성 가드의 유일한 스위치였다 · 원칙 R599 · 교훈 R599.
## P1074 - v54.98 - 배포를 멈춘 gate 3건, 표시 단위·소유권, 체크아웃 개행 · 원칙 R596, R597 · 교훈 R596, R597. · 검사 ci-screener-auto-refresh-browser-check · 파일 src/data/contracts/source-kind.js
## P1073 - v54.96 - refresh producer contract가 안전한 pre-push 경계를 표현하지 못했다 · 원칙 R595 · 교훈 R595. · 검사 ci-qa-pipeline-contract-check · 파일 scripts/ci-qa-pipeline-contract-check.mjs
## P1072 - v54.96 - 자동 gate PASS가 전수 semantic coverage 완료로 오인될 수 있었다 · 원칙 R594 · 교훈 R594. · 파일 scripts/ci-semantic-review-check.mjs
## P1071 - v54.96 - 운영 실패 issue가 동일 signature 댓글을 무한 누적할 수 있었다 · 원칙 R593 · 교훈 R593. · 검사 ci-workspace-contract-check
## P1070 - v54.96 - browser/headless 실패가 원격에서 원인별로 보존되지 않았다 · 원칙 R589, R594 · 교훈 R589/R594. · 검사 ci-headless-tests
## P1069 - v54.96 - fast plane heartbeat가 무변경 cadence마다 KV write를 소비했다 · 원칙 R592 · 교훈 R592. · 검사 ci-data-plane-contract-check · 파일 scripts/ci-data-plane-contract-check.mjs
## P1068 - v54.96 - AI premise와 company-primary source classification이 자체 라벨을 권한 근거로 사용했다 · 원칙 R590, R591 · 교훈 R590/R591. · 검사 ci-ai-premise-check, ci-ai-intelligence-contract-check
## P1067 - v54.95 - cacheable QA가 실제 의존 파일 변경을 놓치고 parity 실행이 workspace를 변경했다 · 원칙 R589 · 교훈 R589. · 검사 ci-qa-pipeline-contract-check · 파일 public-data/market-snapshot.json
## P1066 - v54.95 - refresh/history 이벤트 타깃과 theme-detail 직접 진입 route 소유권이 분열됐다 · 원칙 R588 · 교훈 R588.
## P1065 - v54.95 - 스크리너 뉴스가 fetch 시각을 기사 관측시각으로 사용했다 · 원칙 R587 · 교훈 R587.
## P1064 - v54.95 - sourceKind 허용 목록 분열과 evidence last-arrival-wins가 권한·revision을 왜곡했다 · 원칙 R587 · 교훈 R587.
## P1063 - v54.95 - 결측 factor가 z=0으로 순위에 참여해 composite와 percentile을 희석했다 · 원칙 R586 · 교훈 R586.
## P1062 - v54.95 - pre-frozen state가 nested mutation을 허용하고 listener 예외가 후속 구독자를 차단했다 · 원칙 R1, R585 · 교훈 A12 미완료 경계, R585. · 검사 ci-esm-core-unit-check · 파일 src/state/store.js, scripts/ci-esm-core-unit-check.mjs, architecture/adr-0002-vite-typescript-and-state-access.md, _context/BUG-POSTMORTEM.md, _context/RULES.md, _context/QA-CHECKLIST.md
## P1061 - v54.89 - legacy chat 가격 evidence가 출처·통화를 과잉 추론했다 · 원칙 R402 · 교훈 R402 및 P1057의 관측·출처·단위 손실 방지와 현재성 승격 금지 계약. · 검사 ci-ai-quote-evidence-check
## P1060 - v54.88 - 정상 가격 evidence fixture가 통화 단위 부재로 차단됐다 · 원칙 R402 · 교훈 R402 및 P851의 lossy field mapping 방지 계약. · 파일 scripts/ci-headless-tests.mjs
## P1057 - v54.85 - 두 채팅 시세 경로가 같은 관측의 근거 정보를 다르게 잃었다 · 원칙 R456 · 교훈 R456 및 관측 시각/수신 시각 분리 계약. · 검사 ci-ai-quote-evidence-check
## P1056 - v54.85 - AI 답변 부가 정보가 본문을 가로로 압축했다 · 교훈 공유 채팅 소비자의 가독성·접근성 및 증거 수준 구분 계약. · 검사 ci-chat-response-layout-browser-check, ci-chat-resilience-check
## P1055 - v54.84 - AI 분석 엔진과 전제 검증이 실제 채팅에서 소비되지 않았다 · 검사 ci-ai-premise-check, ci-ai-chat-analysis-integration-check
## P1054 - v54.84 - AI 숫자의 지표·종목·배율 식별자가 출판 검증에서 사라졌다 · 검사 ci-ai-intelligence-contract-check
## P1053 - v54.84 - AI 검색 후보를 정식 개념 연결로 표시했다 · 검사 ci-ai-intelligence-contract-check
## P1052 - v54.84 - AI 근거 ID와 출처 이름만으로 내용이 검증됐다 · 검사 ci-ai-intelligence-contract-check
## P1051 - v54.84 - AI 취소·대화 보관의 수명주기와 접근성이 불완전했다 · 검사 ci-chat-ui-state-browser-check, ci-chat-resilience-check
## P1050 - v54.84 - AI 스트림 본문에 deadline이 적용되지 않았다 · 검사 ci-worker-anthropic-check, ci-ai-provider-stream-check
## P1049 - v54.84 - Masters 생성 중 부분 쓰기가 최신 보유 파일을 손상했다 · 검사 ci-data-continuity-check
## P1048 - v54.84 - 뉴스 단어 일부와 알 수 없는 관계를 과도하게 해석했다
## P1047 - v54.84 - 교육 원문의 부족을 반복 문장으로 심층 콘텐츠처럼 채웠다
## P1046 - v54.84 - 13F 분할 원본 행에 종목 전체 증감이 반복됐다
## P1045 - v54.84 - 미국 휴장일의 최신 정규장 종가가 오래된 데이터로 차단됐다
## P1044 - v54.83 - 포트폴리오 평가 기준과 결측 손익의 불일치 · 검사 ci-esm-core-unit-check
## P1043 - v54.83 - 작업 범위와 무관한 스킬·hook 반복 실행
## P1042 - v54.82 - 화면 상태와 출처가 실제 근거를 과장했다
## P1041 - v54.82 - 탐색·학습 UI가 실패 및 재렌더에서 사용자 상태를 잃었다
## P1040 - v54.82 - SEC 결측 및 서로 다른 회계기간이 비율로 합성됐다
## P1039 - v54.81 - 변경 없는 canonical 상태를 공개 조회마다 다시 복사했다 · 검사 ci-esm-core-unit-check
## P1038 - v54.81 - 스크리너 준비와 스냅샷 해시가 부팅에서 긴 작업을 만들었다 · 검사 ci-screener-workbench-contract
## P1037 - v54.80 - preload URL이 실행 script와 달라 중복 전송됐다 · 검사 ci-version-check
## P1036 - v54.80 - 스크리너 데이터 기준일이 9px로 렌더됐다 · 검사 ci-accessibility-matrix-check
## P1035 - v54.80 - 페이지 갱신과 관측 집계가 입력 변경 없이 반복됐다 · 검사 ci-esm-core-unit-check, ci-native-decision-evidence-check · 파일 scripts/performance-hunt.mjs
## P1034 - v54.79 - 스크리너 관측 집계가 부팅에서 중간 객체와 날짜 파싱을 반복했다 · 검사 ci-native-decision-evidence-check · 파일 src/data/runtime-readers.js, scripts/ci-native-decision-evidence-check.mjs
## P1033 - v54.76 - 페이지 의미·상태·통화·차트 소유권이 실제 데이터와 달랐다
## P1032 - v54.76 - 브라우저 QA가 route registry·paint 완료·자원 예산을 충분히 반영하지 않았다 · 검사 ci-qa-pipeline-contract-check · 파일 src/app/routes.js
## P1031 - v54.76 - fallback·이벤트·scheduler의 이중 소유권이 지연 응답에서 재실행을 만들었다
## P1030 - v54.76 - 부분·미래·저품질 수집이 published/current 상태로 승격될 수 있었다
## P1029 - v54.76 - Atlas 기업·제품 검색이 레지스트리의 실제 분류 연결을 읽지 않았다
## P1028 - v54.76 - 정상 Telegram 원장이 Atlas 요약에서는 수집 실패로 표시됐다 · 검사 ci-atlas-browser-check
## P1027 - v54.76 - private evidence index 전환 뒤 Atlas 관계 근거 링크가 전부 미해결로 표시됐다 · 검사 ci-knowledge-core-semantic-check, ci-atlas-contract-check, ci-atlas-browser-check
## P1026 - v54.76 - AI 분석·리서치·응답 경계가 결측·혼합 문맥·오류 세부를 과신했다 · 검사 ci-ai-intelligence-contract-check, ci-inference-contract-check, ci-research-model-contract-check, ci-research-flow-contract-check
## P1025 - v54.76 - 도메인 계산기가 잘못된 값·단위·비용 의미를 유효한 금융 결과로 만들 수 있었다 · 검사 ci-domain-parity-check, ci-esm-core-unit-check, ci-screener-workbench-contract, ci-native-decision-evidence-check
## P1024 - v54.76 - 지식 그래프의 탐색 관계와 인과 관계가 섞이고 저장 상태가 외부 변경에 노출됐다 · 검사 ci-knowledge-core-semantic-check, ci-knowledge-learning-state-contract, ci-knowledge-route-bridge-contract, ci-principles-contract-check
## P1023 - v54.76 - 앱 종료 뒤 deferred 작업과 route transition이 상태를 다시 쓸 수 있었다 · 검사 ci-esm-core-unit-check, ci-runtime-contract-check, ci-architecture-contract-check, ci-knowledge-route-bridge-contract
## P1022 - v54.75 - 상태 projection이 결측 숫자와 명시적 초기화를 보존하지 못했다 · 검사 ci-architecture-contract-check
## P1021 - v54.75 - 삭제된 기능과 시험용 기반이 현재 제품 기능처럼 남아 있었다 · 검사 ci-retirement-contract, ci-desktop-continuity-check, ci-knowledge-core-semantic-check, ci-knowledge-ontology-contract
## P1020 - v54.75 - 작은 기반 계약들이 누락값·시간·불변성을 성공 상태로 해석했다 · 검사 ci-ai-intelligence-contract-check, ci-knowledge-core-semantic-check, ci-architecture-contract-check, ci-esm-core-unit-check
## P1019 - v54.75 - 실패한 계산·취소된 요청이 후속 실행의 상태를 오염했다 · 검사 ci-esm-core-unit-check
## P1018 - v54.75 - 서로 다른 통화·관측·출처가 한 스크리너 값으로 합쳐졌다 · 검사 ci-screener-workbench-contract, ci-native-decision-evidence-check, ci-desktop-continuity-check
## P1017 - v54.74 - 화면 조건과 실행 정의가 별개 상태로 누적됐다 · 검사 ci-desktop-continuity-check, ci-screener-auto-refresh-browser-check
## P1016 - v54.74 - 취소·재시도와 저장소 실패가 서로의 상태를 오염했다 · 검사 ci-artifact-cache-check, ci-storage-migration-check
## P1015 - v54.74 - 집합의 80% 충족이 오래된 소수 행까지 유효하게 만들었다 · 검사 ci-research-model-contract-check, ci-esm-core-unit-check
## P1014 - v54.74 - 실행 기능의 내부 존재가 화면 연결·영속 재현을 뜻하지 않았다
## P1013 - v54.74 - 표시 가능한 과거 관측과 계산 가능한 현재 관측의 정책이 충돌했다 · 검사 ci-esm-core-unit-check, ci-screener-workbench-contract, ci-screener-auto-refresh-browser-check
## P1012 - v54.73 - 현재 동작과 분리된 구식 회귀 기대값이 남았다
## P1011 - v54.73 - 계약 PASS가 스크리너의 재현성·시점·결측 의미를 보증하지 못했다 · 원칙 R573
## P1010 - v54.70 - 구조상 연결과 실제 사용자 흐름 사이에 결측·중복·탐색 단절이 남았다 · 원칙 R572 · 검사 ci-desktop-continuity-check, ci-runtime-contract-check · 파일 index.html
## P1009 - v54.69 - 데스크톱 결측값 처리와 문서 참조 연결이 불완전했다 · 검사 ci-desktop-continuity-check
## P1008 - v54.69 - 취소된 채팅과 검색 실패가 후속 답변을 막거나 덮었다 · 검사 ci-chat-resilience-check
## P1007 - v54.69 - 관측 결측·출처·주기와 수집 성공시각이 합성 중 바뀌었다 · 검사 ci-proxy-continuity-check, ci-data-continuity-check
## P1006 - v54.69 - 무료 프록시 요청 식별·회복·설정이 서로 충돌했다 · 검사 ci-proxy-continuity-check
## P1005 - v54.68 - 버전 동기화가 권한 오류 후 같은 버전으로 재개되지 않았다 · 원칙 R1
## P1004 - v54.68 - 관측 품질·사용권·종목·주기가 다른 경로에서 섞였다 · 원칙 R570 · 교훈 R570 — 값·종목·관측 주기·사용 범위의 identity를 producer부터 consumer까지 보존한다. · 검사 ci-research-flow-contract-check
## P1003 - v54.65 - market epoch 브라우저 검사가 screener hydration보다 먼저 판정했다 · 원칙 R569 · 교훈 R569 — 서로 독립적으로 hydrate되는 producer의 readiness를 다른 producer 완료 신호로 대체해서는 안 된다.
## P1002 - v54.65 - 유효한 memo 출처 세부표시와 종료된 BOK 일정이 브라우저 회귀를 만들었다 · 원칙 R559, R568 · 교훈 R559/R568 — 발표가 수신되면 값·관측일·다음 공식 일정이 함께 이동해야 하며 유효한 출처 상세표시를 provenance 결손으로 오판해서는 안 된다.
## P1001 - v54.64 - 자동 데이터 커밋이 생성 상태와 FRED readiness를 누락해 exact-SHA CI를 깨뜨렸다 · 원칙 R563 · 교훈 R563 — 자동 데이터 병합/생성의 마지막 상태는 현재 artifact inventory에서 다시 생성되어야 한다. · 파일 architecture/public-readiness.json
## P1000 - v54.64 - 교육·조건부 금융 질문과 검색 실패가 채팅 전체 차단으로 확대됐다 · 원칙 R460, R456 · 교훈 R460/R456 — 단어 기반 안전 분류나 evidence 결손은 전체 답변 안전 모드가 아니라 실제 행위·해당 주장 범위에서만 작동해야 하며, reference knowledge와 live evidence를 분리해야 한다.
## P999 - v54.63 - SEC runtime projection manifest가 Windows source CRLF digest를 저장했다
## P998 - v54.63 - generated workspace byte inventory가 checkout 줄바꿈에 따라 달라졌다
## P997 - v54.63 - 원격 자동 데이터 병합 뒤 generated workspace state가 병합 전 inventory에 머물렀다 · 파일 _context/CURRENT-STATE.md
## P996 - v54.63 - 자동화된 macro lineage를 과거 manual 단언이 회귀 실패로 오판했다
## P995 - v54.63 - 주간 설문과 같은 날짜 금리차가 자동 refresh 밖의 수동/LKG 경계에 남았다
## P994 - v54.63 - 병렬 full QA가 지식 JSON의 truncate-write 찰나를 읽어 간헐적 EOF로 중단됐다
## P993 - v54.63 - 새 CPI SA companion sink와 이미 발표된 PCE 일정이 lineage/calendar 감사에서 끊겼다
## P992 - v54.63 - AAII 주간 결과가 다음 공식 발표 전인데 UTC 8일 경계에서 stale로 오판됐다
## P991 - v54.63 - 실패·stale Worker 경로와 과대 Masters bootstrap이 공개 준비 상태와 실제 전달 비용을 왜곡했다
## P990 - v54.63 - 결측·극단치·섹터 편향이 있는 횡단면 팩터가 동일한 신뢰도의 종합 순위처럼 보였다
## P989 - v54.63 - CPI 정의·국채 곡선·스크리너 필드 권한이 producer와 browser 사이에서 소실되거나 혼합됐다
## P988 - v54.63 - 헤드라인-only 뉴스가 검증된 기사·감성·AI 인과 근거로 승격됐다
## P987 - v54.63 - 정적 재무 카드와 기본 NVDA 자동 검색이 공시·시세·선택 상태를 한 화면에서 혼합했다
## P986 - v54.62 - lazy native mount 이전 headless 검사가 실제 패널 가시성을 요구해 증거 수준을 혼합했다 · 검사 ci-headless-tests
## P985 - v54.62 - 화면에 숫자는 보였지만 기준일·출처·분류 성격이 함께 전달되지 않았다
## P984 - v54.62 - ticker의 관련 테마 클릭이 숨은 themes DOM 또는 lazy mount 사이에서 소실됐다
## P983 - v54.62 - 실패한 entity artifact와 느슨한 byte-budget 캐시가 후속 요청을 오염시켰다
## P982 - v54.62 - 생성 성공·LKG·readiness가 freshness/source truth를 서로 다르게 해석했다
## P981 - v54.62 - AI 오케스트레이터가 행동 권한을 계획만 하고 provider보다 먼저 집행하지 않았다
## P980 - v54.61 - 운영 알림 임계값과 실제 GitHub 이슈 생성 시점이 달랐다
## P979 - v54.61 - 로컬 operations 재생성이 마지막 유효 Worker 관측을 빈 값으로 덮어썼다
## P978 - v54.61 - 실패한 headless group 하나를 고친 뒤에도 전체 ordered suite를 다시 실행했다
## P977 - v54.61 - native route 선언과 달리 boot가 대부분의 page renderer와 대형 canonical data를 즉시 결합했다
## P976 - v54.60 - 버전 범프가 과거 route-soak PASS를 새 revision의 현재 증거처럼 남겼다 · 원칙 R1
## P975 - v54.60 - 런타임 readiness와 release deep audit가 결합돼 단일 headless 검사가 수십 분 반복됐다
## P974 - v54.59 - 한국어 수량 단위 뒤 ASCII word boundary 때문에 chat history 수량이 redaction되지 않았다
## P973 - v54.59 - data refresh 완료 뒤 mutable main을 다시 checkout해 검증하지 않은 동시 변경을 배포할 수 있었다
## P972 - v54.59 - 강한 연구 철학과 모순된 제품 범위·플랫폼 조합이 architecture 완료 선언을 왜곡했다
## P971 - v54.59 - dirty 작업 트리와 group 단위 재검사 때문에 작은 수정도 전체 QA를 반복했다
## P970 - v54.59 - 과거 boot 측정의 appRevision만 올라가 현재 성능 PASS처럼 보였다
## P969 - v54.59 - 동일 AI prompt가 idempotency 없이 같은 request ID를 공유해 quota를 우회하고 upstream을 중복 호출했다
## P968 - v54.59 - chat history가 기본 저장되고 ESM privacy vault가 동의만으로 평문 JSON을 쓸 수 있었다
## P967 - v54.59 - freshness와 consumer가 reference evidence를 decision use로 다시 승격할 수 있었다
## P966 - v54.59 - 존재하는 CI gate가 full·workflow·watchdog 어느 경로에서도 실행되지 않았다
## P965 - v54.58 - 첫 오류 중단과 독립 장시간 job 때문에 수정마다 전체 검증 비용이 반복됐다 · 파일 architecture/qa-pipeline.json
## P964 - v54.57 - 작업환경의 현재 사실과 자동화 계약이 복제·비검증 표면으로 분산됐다 · 검사 ci-workspace-contract-check, ci-knowledge-lint-check, ci-skill-contract-check
## P963 - v54.55 - Public AI browser gate could select a later background request
## P962 - v54.54 - In-app interaction audit exposed false portfolio P&L and silent theme/detail boundaries
## P961 - v54.50 - Follow-up surface audit exposed hidden overlay semantics and stale/ambiguous research metadata
## P960 - v54.50 - The empty ticker route retained a stale symbol and an unnamed market-code input
## P959 - v54.49 - Page hydration crossed route ownership and the architecture counter misread comparisons
## P958 - v54.48 - Residual audit exposed focus loss, scheduler overlap and mixed-source overstatement · 파일 src/platform/http.js
## P957 - v54.46 - Second-pass audit found shared currentness and cancellation gaps · 원칙 R15, R16, R27, R503, R507 · 교훈 R15/R16 currentness and source truth, R27 lifecycle/route ownership, R503/R507 freshness promotion, and the no-overstatement rule for user-facing dec…
## P956 - v54.45 - Full-route audit exposed missing-data overstatement and chart observer retention · 원칙 R15, R16 · 교훈 R15/R16 numeric and news-surface consistency, the single-owner/lifecycle boundary, and the service-worker shell parity contract. · 검사 ci-architecture-contract-check · 파일 sw.js
## P953 - v54.43 - Complete artifacts still rendered as disconnected textbook cards and cross-page state leaked · 원칙 R508, R509 · 교훈 R508 covered persistence and publication truth but did not require narrative order, destination consumption, page-scoped query cleanup or regulatory… · 검사 ci-three-page-learning-flow-check
## P952 - v54.42 - Three-page rendering was connected but completeness and route state were overstated · 원칙 R508 · 교훈 a connected DOM path was reported as complete without coverage-state semantics, while route and persistence gates checked only the immediate click re…
## P951 - v54.41 - Public, blocked and derived data categories were collapsed into SKIPPED · 원칙 R507, C4 · 교훈 freshness, access rights, computation mode and environment scope were conflated; R507 now requires four distinct states and scope-qualified configura… · 파일 public-data/data.json
## P950 - v54.40 - Detail loading still crossed interaction, meaning and failure boundaries · 원칙 R504, R506 · 교훈 R504 described bounded shards but did not require the narrowest interaction boundary, summary/full semantic separation, a long-session cache cap or n…
## P949 - v54.39 - Three-page lazy loading still transferred canonical monoliths and repeated route requests · 원칙 R500, R504, R505 · 교훈 R500's capability boundary was too coarse to prevent canonical-monolith transfer or repeated requests; R504 and R505 now define the runtime projectio…
## P948 - v54.38 - Three new pages had no end-to-end currentness and learner-flow closure · 원칙 R499, R500, R501, R502 · 교훈 R499, R500, R501 and R502.
## P947 - v54.37 - prompt-caching header was omitted from the public Worker CORS contract · 원칙 R497 · 교훈 R497; browser route certification must cover the complete public request contract, including preflight.
## P946 - v54.37 - SEC report unavailable state omitted its point-in-time boundary · 원칙 R481 · 교훈 R481.
## P945 - v54.37 - fundamentals created a row with no screener factors while CI pinned an obsolete snapshot · 원칙 R498 · 교훈 R498.
## P944 - v54.37 - safety hardening disconnected the public route and converted claim failures into blank chat · 원칙 R497 · 교훈 R497.
## P943 - v54.36 - authored depth and raw identity aggregation were not reflected in repository state
## P942 - v54.35 - refreshable data and generated-reference surfaces could drift from their declared boundaries
## P941 - v54.34 - three knowledge surfaces had incomplete depth or reconciliation disclosure
## P940 - v54.33 - shared current observations were rendered without selected-node scope · 원칙 R496 · 교훈 R496.
## P939 - v54.33 - user-facing knowledge pages exposed forced question prompts · 원칙 R495, R491 · 교훈 R495; historical R491 question-presence behavior is superseded by the user-facing learner-first boundary.
## P938 - v54.25 - Atlas relationship-map patch dropped an existing teaching question · 원칙 R491 · 교훈 R491; browser goldens and the implementation must be checked from the same working tree, especially when a large shared renderer is dirty.
## P937 - v54.25 - timeless neutral-rate value and disconnected company roadmap · 원칙 R494 · 교훈 R494; unobservable estimates and company targets must retain model/date/directness boundaries through every consumer. · 검사 ci-atlas-contract-check
## P936 - v54.24 - SEC fact fallback concept selection retained stale observations · 원칙 R493 · 교훈 R493; SEC fallback concepts must be unioned before newest-observation selection. · 파일 scripts/fetch-sec-fundamentals.mjs
## P935 - v54.23 - Static macro calendar retained passed release dates · 원칙 R492 · 교훈 R492; scheduled dates must be checked against the publisher calendar and advanced when passed.
## P934 - v54.22 - Atlas browser golden matched an unstaged renderer overlay · 원칙 R491 · 교훈 R491; a browser golden and its implementation must be verified from the same committed tree before push.
## P933 - v54.22 - Headless tests raced the asynchronous Telegram artifact load · 원칙 R490 · 교훈 R490; asynchronous generated-artifact consumers require an explicit settled-state barrier before their assertions run. · 파일 public-data/telegram-digest.json
## P932 - v54.22 - Browser gates ran in a CI job without a browser executable · 원칙 R489 · 교훈 R489; browser gates must be scheduled only behind a declared browser-install prerequisite and remain in the deploy dependency graph.
## P931 - v54.22 - Desktop-only gate passed against unstaged scope corrections · 원칙 R488 · 교훈 R488; a declared product-scope gate must be verified from the committed tree and its direct dependency set, not from the working tree alone. · 검사 ci-desktop-scope-check
## P930 - v54.22 - Local version gate passed against unstaged active handoff surfaces · 원칙 R487, R1 · 교훈 R487; R1 validation before commit/push must cover the staged tree whenever required version surfaces also contain unrelated unstaged work.
## P929 - v54.22 - Synthetic route work was incorrectly charged to initial shell FCP · 원칙 R486 · 교훈 R486; independent performance phases must be measured across an actual browser presentation boundary and may not be merged into one misleading metric.
## P928 - v54.22 - Full-route Chromium lifecycle and ownership manifest retained SEC report v2 · 원칙 R483 · 교훈 R483; every independent consumer/golden and declared contract must change atomically with a versioned domain envelope.
## P927 - v54.22 - Runtime W1-04 retained the SEC report v2 golden after PIT v3 migration · 원칙 R483 · 교훈 R483; all independent golden gates must move atomically with a versioned domain contract.
## P926 - v54.22 - HY OAS froze on LKG whenever the general FRED API key was absent · 원칙 R485 · 교훈 R485; available official keyless downloads should close critical single-series gaps while preserving their true access and lineage.
## P925 - v54.22 - Factor-rank golden fixtures lost parity after row-level freshness enforcement · 원칙 R484 · 교훈 R484; factor fixtures must carry the same field-family epochs required from production rows.
## P924 - v54.22 - Retired mobile knowledge personas left a stale 20-scenario golden count · 원칙 R474 · 교훈 R474; mobile personas and acceptance criteria remain out of scope unless the user explicitly reopens them. · 검사 ci-desktop-scope-check
## P923 - v54.22 - SEC report v3 shipped with an independent v2 golden assertion · 원칙 R483 · 교훈 R483; versioned domain contracts and all deliberate golden assertions must change atomically.
## P922 - v54.22 - Source registry was imported online but omitted from the service-worker shell · 원칙 R482 · 교훈 R482; runtime imports and the service-worker application shell must change atomically.
## P921 - v54.22 - Static capability labels hid implemented 13F/risk work and SEC facts were not queryable as-of filing time · 원칙 R481 · 교훈 R481; a professional capability status requires executable evidence and every PIT result must exclude observations unavailable at the requested cut. · 검사 ci-professional-data-gap-check
## P920 - v54.21 - Unregistered source limits and sparse/null history could present incomplete data as current breadth · 원칙 R480 · 교훈 R480; every changing or hardcoded category needs a daily-audited origin/limit contract, and sparse or missing observations must fail closed. · 검사 ci-source-registry-contract-check
## P919 - v54.20 - Quant screener mixed live, factor, filing, and news epochs under one row timestamp · 원칙 R479 · 교훈 R479; quant rows and rankings must preserve separate source epochs, request current quotes for rendered symbols, and fail closed when input coverage…
## P918 - v54.19 - Page fields could report different observation times and direction bases as one current market · 원칙 R478 · 교훈 R478; every market-sensitive field must preserve observation lineage, use a compatible direction basis, and fail closed across mixed revisions.
## P917 - v54.18 - Static reconciliation could certify stale or inconsistent cross-page market state · 원칙 R477 · 교훈 R477; reconciliation and market-sensitive pages must derive status from current evidence and one shared revision/cut.
## P916 - v54.17 - Mobile acceptance scope and version notation drifted across active gates · 원칙 R474, R475 · 교훈 R474 and R475; future acceptance must follow the declared product scope and release identifiers must be canonical and strictly increasing. · 검사 ci-desktop-scope-check · 파일 scripts/bump-version.mjs
## P915 - v54.16 - Missing transaction cost was silently treated as zero in the Outcome Ledger · 원칙 R471 · 교훈 R471; screener research outcomes must be evidence-bound and fail closed when costs/liquidity are not modeled. · 검사 ci-screener-workbench-contract
## P914 - v54.13 - New screener validation artifact was absent from lineage policy registry · 원칙 R338 · 교훈 R338; tracked public-data artifacts require explicit policy, timestamp selector and commit/source evidence. · 파일 public-data/screener-validation-gate.json
## P913 - v54.12 - Architecture browser timer gate raced a boot-delayed alert timer · 교훈 Browser lifecycle evidence must be stable against known boot-delayed timers before classifying route resource growth.
## P912 - v54.12 - Screener rebuild design had no executable contract boundary · 원칙 R471 · 교훈 R471; research-relative ranking and currentness/rights boundaries must be explicit at the screener lifecycle boundary. · 파일 public-data/screener-validation-gate.json
## P911 - v54.7 - Generated knowledge reference artifacts initially lacked explicit currentness metadata · 원칙 R470 · 교훈 R470; currentness must be first-class and machine-checkable.
## P910 - v54.6 - Structural knowledge drafts were still too easy to mistake for the requested stock/economics/technology encyclopedia · 원칙 R467, R469 · 교훈 R467 — a structured draft boundary is necessary but insufficient when the product mission and full content corpus are not separately gated.
## P909 - v54.6 - Knowledge artifacts could drift from runtime shape and overstate draft completeness · 원칙 R464, R468 · 교훈 R464~R468.
## P908 - v54.5 - Worker requests could be certified by an unrelated personal key and transient health latency was over-cached · 원칙 R390, R463 · 교훈 R390 — chat readiness는 실제 선택 endpoint의 인증·연결 상태를 명시적으로 검증해야 하며 다른 credential의 존재로 대체할 수 없다. · 파일 scripts/ci-ai-chat-reliability-contract-check.mjs
## P907 - v54.4 - Partial Telegram collection was rejected while total failure was accepted · 원칙 R455, R462 · 교훈 R455 — 정상 unavailable/partial 상태는 명시적으로 모델링하고 과거 값이나 허위 완전 성공으로 승격하지 않아야 한다. · 파일 scripts/ci-six-doc-coverage-check.mjs, scripts/ci-atlas-contract-check.mjs
## P906 - v54.4 - Research outage erased otherwise answerable analysis across both chat surfaces · 원칙 R460, R461 · 교훈 R460 — 근거 부족은 답변 전체 안전 모드가 아니라 해당 주장 limitation으로 전달해야 한다. · 파일 scripts/ci-ai-intelligence-contract-check.mjs, scripts/ci-runtime-contract-check.mjs, js/aio-tests.js
## P905 - v54.4 - Residual keyword safety rules still blocked answerable finance education · 원칙 R456, R460 · 교훈 R456 — QuestionPlan 밖의 병렬 안전 분류기는 같은 질문을 다른 의미로 해석할 수 있다. · 파일 src/ai/policy/conduct.js, js/aio-tests.js
## P904 - v54.4 - Durable Object location hint was treated as a provider-region guarantee · 원칙 R458, R459 · 교훈 R458 — readiness는 binding/config 존재가 아니라 실제 consumer 경계 실행으로 증명해야 한다.
## P903 - v54.3 - Repository AI Worker and deployed public proxy had no release path · 원칙 R456, R458 · 교훈 R456 — 실행 계약은 consumer까지 연결되어야 하며, 저장소에 존재하지만 배포되지 않은 Worker는 AI 채팅 경로로 인증할 수 없다.
## P902 - v54.2 - Scheduled Telegram refresh repeatedly invalidated the Atlas release contract · 원칙 R455, R457 · 교훈 R455 — 서로 참조하는 요약 인덱스와 원본 artifact는 같은 retained count·collection status를 가져야 한다. · 파일 public-data/atlas/index.json
## P901 - v54.2 - AI chat composed incompatible classifiers, evidence contracts, and UI fallbacks · 원칙 R219, R453, R456 · 교훈 R219/R453 및 P898 — producer/consumer·UI·safety가 같은 실행 계약을 사용해야 하며, 현재성 주장은 질의에 선택된 근거와 직접 결합되어야 한다.
## P900 - v54.1 - Deployment gates rejected an explicit news-unavailable snapshot · 원칙 R239, R391, R455 · 교훈 R239/R391 — refresh failures must remain explicit and deploy gates must distinguish unavailable evidence from missing contracts. · 파일 public-data/data.json
## P899 - v54.0 - Service-worker takeover fixture contradicted the guarded reload contract · 원칙 R443, R454 · 교훈 R443/P875 — release fixtures must exercise the current runtime contract and must not turn an expected navigation into a false failure.
## P898 - v54.0 - AI Research producer and consumer used incompatible evidence contracts · 원칙 R219, R444, R3, R453 · 교훈 R219/R444 plus R3 — producer/consumer interoperability and capability claims require executable proof, and required-current answers must fail closed…
## P897 - v53.99 - Count-based knowledge contracts certified disconnected graphs and unresolved evidence · 원칙 R219, R431, R451, R452 · 교훈 R219/R431/R451 — counts and field presence cannot certify semantic topology, runtime resolvability, or graceful degradation.
## P896 - v53.98 - Required-field coverage was mistaken for encyclopedia-grade depth · 원칙 R431, R434, R438, R451 · 교훈 R431/R434/R438; required-field presence and artifact counts cannot stand in for semantic depth or user comprehension.
## P895 - v53.96 - Current-code remediation handoff contracts were implemented as fail-closed gates · 원칙 R1, R3, R26, R27 · 교훈 R1/R3/R26/R27 plus the handoff CR-QA/BASE/DATA/AI/WORKER/ARCH/TIME/FUND/MODEL/CSP/DECOMP/OPS acceptance contracts.
## P894 - v53.96 - Codex loaded stale monolithic skills outside the canonical contract gate · 원칙 R236, R237 · 교훈 R236/R237; assistant-specific skill roots must not become independent instruction sources, and the gate must validate the surface the active agent ac… · 검사 ci-skill-contract-check, ci-workflow-compaction-check · 파일 scripts/sync-agent-skills.mjs
## P893 - v53.95 - Full-route audit closed runtime contract, provenance, and visual grouping gaps · 원칙 R1, R21, R26, R27 · 교훈 R1/R21/R26/R27; public data readiness, source provenance, shell assets, and release metadata must be structurally connected rather than inferred from… · 파일 src/domain/screener/setup-profile.js
## P892 - v53.89 - Structural reference gates missed learner hierarchy and visible Masters runtime failures · 원칙 R307, R352, R438 · 교훈 R307/R352/R438; UI의 숫자는 유한해야 하고 하나의 파이프라인이 실제 artifact를 소유해야 하며 학습 표면은 큰 개념에서 작은 개념으로 점진 공개되어야 한다.
## P891 - v53.88 - Market Principles and AI Atlas were exposed as learner surfaces instead of research inventories · 원칙 R430, R431, R434 · 교훈 R430/R431/R434; functional learning surfaces must expose measurable user-facing explanations and source boundaries, and structural artifact counts ca…
## P890 - v53.87 - Scion latest-filing availability was made explicit · 원칙 R431, R434 · 교훈 R431/R434; a stale reference must distinguish stale data from a verified absence of a newer filing and must not be silently treated as current.
## P889 - v53.86 - weekend market-closed grace prevented false live-data freshness failure · 원칙 R21, R435 · 교훈 R21/R435; freshness must reflect the declared observation/session boundary and reference overlays must retain explicit provenance.
## P888 - v53.85 - six-document reference layer and currentness boundaries closed · 원칙 R431, R432, R434 · 교훈 R431/R432/R434; structural/reference coverage must not be presented as verified current facts.
## P887 - v53.83 - Atlas connected 19 domain guides to the taxonomy renderer · 원칙 R431, R434 · 교훈 R431/R434; aggregate domain presence must not be mistaken for per-domain explanatory coverage. · 파일 public-data/atlas/domain-guides.json
## P886 - v53.83 - Masters security-master normalization became an explicit fail-closed artifact · 원칙 R432 · 교훈 R432; raw filing rows are not a verified security master or sector classification. · 파일 public-data/masters/security-master.json
## P885 - v53.83 - Foundations 48-module authored reference layer was connected · 원칙 R431, R434 · 교훈 R431/R434; a module count alone cannot prove usable lesson content. · 파일 public-data/atlas/foundation-lessons.json
## P884 - v53.83 - Principles A~O chapter layer and full node lesson coverage were connected · 원칙 R431, R434 · 교훈 R431/R434; aggregate graph coverage must not hide missing chapter framing or uncovered nodes.
## P883 - v53.82 - Principles graph reached the 60-node MVP floor with new application and adjacent-technology loops · 원칙 R431 · 교훈 R431; aggregate graph counts must reflect per-node explanations and explicit failure/verification boundaries.
## P882 - v53.82 - Atlas P1/P2 evidence inventory expanded without promoting current claims · 원칙 R431, R433 · 교훈 R431/R433; structural coverage and official reference links must remain distinct from reviewed current claims, production state, or investment conclu…
## P882 - v53.82 - knowledge generators used host-locale alias ordering · 교훈 generated artifact ordering must be deterministic across supported operating systems and Node runtimes. · 파일 src/domain/knowledge/order.js, scripts/build-knowledge-concept-manifest.mjs, _context/BUG-POSTMORTEM.md, scripts/ci-knowledge-generated-parity-check.mjs
## P881 - v53.81 - Atlas player/product references expanded without promoting current claims · 원칙 R432 · 교훈 R432 publication and normalization boundaries; structural reference data must not be rendered as current production, shipment, yield, valuation, or t… · 검사 ci-atlas-contract-check
## P881 - v53.81 - QA runner behavior fixture depended on a user-owned artifact directory · 교훈 executable QA fixtures must not depend on user-output ACLs or mutate shared repository inputs when an immutable fixture can prove the same contract. · 파일 scripts/ci-qa-runner-behavior-check.mjs, _context/BUG-POSTMORTEM.md, scripts/qa-runner.mjs
## P880 - v53.80 - the Principles catalog stopped at six learning paths despite the UX target of eight · 원칙 R431 · 교훈 R431 content-unit coverage; aggregate node/lesson counts must not hide missing navigation paths.
## P880 - v53.80 - portfolio backtest extraction crossed the domain/app boundary · 교훈 domain modules are pure computation and may not own browser-global integration. · 파일 src/domain/portfolio/backtest.js, src/app/bootstrap.js, _context/BUG-POSTMORTEM.md, scripts/qa-runner.mjs, scripts/ci-runtime-contract-check.mjs, scripts/ci-esm-core-unit-check.mjs
## P879 - v53.80 - retirement manifest omitted the three newly connected learning routes · 교훈 route retirement reconciliation; a manifest must agree with the code-derived route ownership ledger. · 검사 ci-retirement-contract · 파일 architecture/route-owners.json, public-data/operations-status.json
## P879 - v53.80 - published-snapshot boundary, official calendar rollover, and BOK carry key · 교훈 fail-closed evidence, official-source time-series, shared-field naming, and sequential browser-gate policies.
## P878 - v53.80 - release manifests lagged the application revision after the content expansion · 원칙 R1 · 교훈 R1; every release artifact that participates in the release tuple must identify the same application revision. · 파일 architecture/asset-manifest.json, architecture/release-manifest.json, architecture/visual-state-matrix.json, architecture/operations-slo.json, architecture/public-readiness.json, public-data/operations-status.json
## P877 - v53.80 - expanded reference inventory without silently promoting unsupported current claims · 원칙 R431, R432 · 교훈 R431; aggregate schema coverage was not enough to prove content-unit coverage or normalization boundary visibility.
## P876 - v53.79 - structural coverage was being mistaken for full source-document implementation · 원칙 R430 · 교훈 R430; a reference surface must not imply full publication when only the schema or inventory is connected. · 검사 ci-six-doc-coverage-check, ci-atlas-contract-check, ci-principles-contract-check
## P875 - v53.78 - midpoint QA exposed stale 13F wiring, noop views, and research-surface gaps · 원칙 R1, R26, R307 · 교훈 R1/R26/R307 and the midpoint QA gates QA-MF1~3, QA-MP1~3, QA-AT1~2; reference data must not look current when it is stale, and controls must not pret…
## P875 - v53.69 - public 24-hour evidence lane, macro chart ownership, and quote-basis continuity · 원칙 R1, R3 · 교훈 R1/R3 and the shared-cut, single-owner, fail-closed freshness principles — a visible surface cannot silently use an older window or an unlabelled bas…
## P874 - v53.68 - operations status promoted durable snapshot success to scheduled AI success · 원칙 R429 · 교훈 R429; operational readiness must reflect the producer capability actually being claimed. · 검사 ci-operations-status-check
## P873 - v53.68 - refresh commits could publish a newer snapshot with an older release manifest · 원칙 R421, R428 · 교훈 R421/R428; data and release revisions form one atomic publish tuple.
## P872 - v53.68 - Yahoo REGULAR provider hints misclassified completed closes across the weekend · 원칙 R423, R427 · 교훈 R423/R427; completed daily values must retain a typed session and never be promoted or discarded based on a stale provider hint alone.
## P871 - v53.67 - decision headers were not structurally mounted for every route · 원칙 R425 · 교훈 R425 and H3-H — every visible route decision surface must have a discoverable, evidence-labelled header before detail content.
## P870 - v53.66 - rolling Telegram research payload was eligible to masquerade as current news · 원칙 R424 · 교훈 R424; current-sensitive surfaces must share one fresh completed market cut and must not promote rolling research data as current. · 검사 ci-data-pipeline-contract · 파일 architecture/route-owners.json
## P869 - v53.65 - pages and official macro releases used different current-market cuts · 원칙 R424, R279 · 교훈 R424/R279 — current-market pages must share one authoritative cut and completed releases must reconcile both schedule and observation.
## P868 - v53.65 - daily history mixed completed US closes with live Korea and continuous-market points · 원칙 R423 · 교훈 R423 — a daily series row cannot promote an in-session point as a completed close.
## P867 - v53.65 - FRED LKG values suppressed the saved personal-key bridge and appeared freshly fetched · 원칙 R422 · 교훈 R422 — LKG presence cannot suppress a configured primary provider or masquerade as a current success.
## P866 - v53.64 - data refresh advanced the snapshot without release-manifest promotion · 원칙 R418, R419 · 교훈 R418/R419 — runtime operations and release manifests must share one data/app/worker revision tuple. · 검사 ci-operations-contract-check · 파일 architecture/asset-manifest.json, architecture/release-manifest.json
## P865 - v53.64 - FOMC calendar remained on a completed meeting · 원칙 R279, R77 · 교훈 R279/R77 — official release calendars must not surface a completed event as the next release.
## P864 - v53.64 - release architecture manifests lagged the R1 bump · 원칙 R1, R414 · 교훈 R1/R414 — every release SSOT must identify the same application and worker revision before deployment. · 파일 scripts/bump-version.mjs, architecture/asset-manifest.json
## P863 - v53.64 - deployed Worker endpoints were treated as unconfigured · 원칙 R400, R408 · 교훈 R400/R408-style operations claims must distinguish a reachable endpoint from authenticated, rights-cleared, soaked, or AI-capable service readiness. · 파일 architecture/worker-endpoints.json
## P862 - v53.64 - partial portfolio holdings were summed as known zeroes · 교훈 unknown portfolio evidence must remain unknown rather than becoming zero.
## P861 - v53.64 - undated/future news could satisfy freshness windows · 교훈 current narrative scores require observable event time.
## P860 - v53.64 - reference/snapshot values could reach native Trading Score inputs · 교훈 decision surfaces must never promote reference or snapshot evidence to current trading inputs. · 검사 ci-native-decision-evidence-check
## P859 - v53.64 - themes performance bars still had a deferred legacy writer · 원칙 R413 · 교훈 R413 — a visible chart/performance surface must have one scoped writer and an explicit missing-evidence state.
## P858 - v53.62 - boot critical-path ownership and measured SLO closure · 검사 ci-boot-interaction-check
## P857 - v53.60 - public readiness가 부트 성능 차단 상태를 반영하지 않음
## P856 - v53.59 - release manifest가 published market snapshot 리비전과 분리
## P855 - v53.59 - AI quota 배지가 실제 AI route readiness를 과장 · 원칙 R408 · 교훈 R408. quota는 capability가 아니며 route readiness가 확인된 경우에만 사용 가능 상태를 표시한다.
## P854 - v53.59 - 실패 안전 점수가 보조 UI에 null로 노출
## P853 - v53.59 - 누적 quote 배열이 서로 다른 생산자 리비전을 한 화면에 혼합 · 원칙 R407 · 교훈 R407. 동일 지표의 가격·변화·전일 기준·관측시각은 단일 producer revision에서만 함께 렌더링한다.
## P852 - v53.58 - unified chat and legacy evidence paths could bypass the typed research/session boundary · 원칙 R395, R396, R401, R402 · 교훈 R395/R396/R401/R402; current or causal claims must not bypass ResearchDecision/Plan, MarketSessionEvidence, or typed source evidence, and data lineag…
## P851 - v53.57 - chat quote evidence was not normalized to the typed claim contract · 원칙 R396, R402 · 교훈 R396/R402; current numeric claims remain typed and evidence-bound, but valid chat quote rows must reach the validator in the same schema.
## P850 - v53.56 - Web Research and market-session readiness were conflated with provider/data presence · 원칙 R401 · 교훈 R401; current/causal claims require the decision's source floors and runtime capability, while closed/delayed data must remain explicitly bounded.
## P849 - v53.55 - domain analysis, benchmark, and operations contracts lacked executable boundaries · 교훈 no domain conclusion or model-quality claim may be emitted without supplied evidence and pinned evaluation inputs. · 검사 ci-ai-intelligence-contract-check · 파일 scripts/ci-ai-intelligence-contract-check.mjs
## P848 - v53.55 - AI chat intelligence path bypassed typed planning and research ranking was presented as confirmation · 교훈 current-sensitive AI output must be evidence-bound and a research-relative ranking must never be promoted into a verified recommendation. · 검사 ci-ai-intelligence-contract-check · 파일 scripts/ci-ai-intelligence-contract-check.mjs
## P847 - v53.54 - server market analysis trusted untyped semantic metadata and source lineage was incomplete · 교훈 current-sensitive automated prose must be evidence-bound; source tier, content depth, event time, and artifact revision must be explicit before downs…
## P846 - v53.54 - deferred core compatibility exports shadowed Claude key save and route functions · 원칙 R389, R390 · 교훈 R389 credential persistence must be readback-proven; R390 route readiness must not confuse an available personal key with a missing shared Worker rou… · 파일 js/aio-core.js
## P845 - v53.53 - early compatibility-facade navigation could read lexical prevPage before initialization · 원칙 R392 · 교훈 R392 requires legacy compatibility entrypoints to remain safe during module/classic-script initialization races.
## P844 - v53.52 - AI credential persistence, route readiness, and control-plane states were optimistic or conflated · 원칙 R389, R390, R391 · 교훈 R389 requires one credential registry with write/readback proof and no optimistic/plaintext fallback; R390 requires explicit AI route readiness/error…
## P843 - v53.51 - route soak, operational posture, and public readiness lacked executable repository gates · 원칙 R386, R387 · 교훈 R386 requires repeated route/resource behavior to be a blocking executable gate; R387 requires operational/public claims to be revisioned, source-lab…
## P842 - v53.51 - Guide copy and capability claims lacked one executable content boundary · 원칙 R388 · 교훈 R388 requires capability claims to be manifest-backed and to fail closed when wording exceeds the available evidence or implementation.
## P841 - v53.50 - ten planned page slices lacked one executable route/data/state boundary · 원칙 R385 · 교훈 R385 requires each vertical slice to have one lifecycle/data/renderer/chart/narrative acceptance contract and an executable route boundary. · 파일 src/app/vertical-slices.js
## P840 - v53.49 - stale SEC facts, entity-free ticker actions, and unversioned Vault ciphertext needed explicit boundaries · 원칙 R381, R383, R384 · 교훈 R381 evidence purpose/freshness separation, R383 action narratives require entity evidence, and R384 versioned KDF migration must preserve legacy dec…
## P839 - v53.48 - route transitions and chart/key resources could outlive their owning surface · 원칙 R382 · 교훈 R382 requires route-owned async/chart resources to stop at scope disposal and forbids automatic plaintext API-key persistence outside the encrypted V…
## P838 - v53.47 - reference evidence could enter Trading Score through mixed allowedUse paths · 원칙 R381 · 교훈 R381 requires decision models to consume only normalized, fresh decision evidence and to preserve reference values outside the decision path.
## P837 - v53.46 - deploy smoke treated a freshly deployed empty KV as a Worker failure · 원칙 R380 · 교훈 R380 deploy smoke must distinguish unavailable initialization from malformed or partial runtime evidence.
## P836 - v53.45 - SEC refresh repeatedly retried failures and starved untried candidates · 원칙 R379 · 교훈 R379 data refresh must rotate eligible candidates and preserve unavailable states instead of fabricating values.
## P835 - v53.63 - portfolio allocation chart still bypassed native holdings state · 원칙 R413 · 교훈 R413; chart promotion must use normalized evidence and a single fenced writer.
## P835 - v53.44 - supplied market materials needed reusable chart, behavior, and communication protocols · 원칙 R26, R219 · 교훈 R26 knowledge feedback, R219 semantic review, and the current-evidence/reference separation contract.
## P834 - v53.63 - ticker chart still bypassed native entity state · 원칙 R413 · 교훈 R413; chart ownership requires one scoped registry, source-labelled evidence, and a legacy fence.
## P834 - v53.43 - supplied AI infrastructure materials needed a durable framework without contaminating live evidence · 원칙 R26, R135, R219 · 교훈 R26 knowledge feedback, R135 memo freshness, R219 semantic review, and the current-evidence/reference separation contract.
## P833 - v53.63 - native runtime data boundary and chart ownership drift · 원칙 R352, R361 · 교훈 R352/R361 — ownership must be derived from the actual producer/provider graph, and a legacy writer must be fenced before a native dimension is record… · 검사 ci-architecture-contract · 파일 src/data/runtime-readers.js
## P833 - v53.42 - fast quote deployment required an R2 subscription although KV is sufficient for the current snapshot path · 원칙 R2
## P832 - v53.41 - fundamental page had only a summary line while the official SEC report boundary remained implicit · 원칙 R352, R306 · 교훈 R352 single executable owner and R306 typed provenance for official regulator evidence.
## P831 - v53.40 - portfolio summary/allocation had no single deterministic owner after Vault/table cutover · 원칙 R352, R357 · 교훈 R352 single executable owner and R357 bounded native surface with an explicit legacy writer fence. · 파일 src/ui/pages/portfolio.js, index.html · 관련 P830
## P795 - v53.30 - bounded theme-detail benchmark native surface · 원칙 R367, R366 · 교훈 R367 / R366 — benchmark narrative must use normalized canonical evidence, fail closed when either side is missing, and fence the exact legacy section…
## P794 - v53.29 - bounded theme-detail subtheme-gap native surface · 원칙 R366, R365 · 교훈 R366 / R365 — subtheme-gap narrative must use normalized canonical evidence, fail closed when coverage is missing, and fence the exact legacy section…
## P793 - v53.22 - bounded theme-detail breadth-health native surface · 원칙 R365, R364 · 교훈 R365 / R364 — breadth-health narrative must use normalized canonical evidence, fail closed when coverage is missing, and fence the exact legacy secti…
## P792 - v53.27 - bounded theme-detail performance-spread native surface · 원칙 R364, R363 · 교훈 R364 / R363 — ranking narrative must use observed canonical evidence, fail closed with insufficient coverage, and fence the exact legacy section befo…
## P791 - v55.10 - bounded theme-detail temperature narrative native surface · 원칙 R363, R362 · 교훈 R363 / R362 — dynamic narrative must derive from normalized canonical input, fail closed when missing, and fence the exact legacy section before nati…
## P790 - v53.25 - bounded theme-detail detailed-leader native surface · 원칙 R362, R361 · 교훈 R362 / R361 — a transferred leader surface needs one native writer, explicit normalized quote evidence, and a legacy writer fence before native owner…
## P789 - v53.24 - bounded theme-detail composition/breadth native surface · 원칙 R361, R360 · 교훈 R361 / R360 — a derived composition cutover must use an explicit event/child boundary, fail closed when quote coverage is insufficient, and fence the…
## P788 - v58.99 - bounded theme-detail native summary and isolated legacy detail body · 원칙 R352, R359, R360 · 교훈 R352 single execution ownership, R359 bounded primary-surface discipline, and R360 derived theme-detail event/child boundary.
## P787 - v53.22 - home aggregate score/decision summary가 signal presentation과 별도 native writer 경계를 갖지 못했다 · 원칙 R352, R358, R359 · 교훈 R352 단일 실행 소유권·renderer ownership 회계, R358 canonical presentation/fence, 신규 R359 home bounded aggregate fence. · 파일 js/aio-data.js
## P786 - v53.21 - signal 핵심 판정 hero가 canonical Trading Score와 별도 legacy writer 경계를 갖지 못했다 · 원칙 R352, R357 · 교훈 R352 단일 실행 소유권·실측 renderer ownership 원칙 및 R357 native bounded-surface writer fence 원칙. · 파일 index.html, src/domain/signal/trading-score.js
## P785 - v53.20 - 기술 페이지 시장 건강도 1차 표면이 native state/renderer와 레거시 writer 경계를 갖지 못했다 · 원칙 R352, R357 · 교훈 R352 단일 실행 소유권·실측 renderer ownership 원칙과 R357 native bounded-surface writer fence 원칙. · 파일 src/ui/pages/analysis.js, index.html, js/aio-core.js, src/domain/market/health.js, scripts/ci-esm-core-unit-check.mjs
## P784 - v53.19 - Yahoo chart caller가 shared proxy health registry를 우회해 실패 health를 학습하지 못했다 · 원칙 R356, R352 · 교훈 R356 (shared proxy health path), with R352 single execution ownership reinforcement.
## P783 - v53.18 - 정상 기준 스냅샷이 있어도 topbar는 연결 중이었고 client proxy 실패가 중복 fanout을 만들었다 · 원칙 R341, R342, R352 · 교훈 R341/R342의 fail-closed provenance, R352의 단일 실행 소유권.
## P782 - v53.18 - 새 서비스워커 활성화 뒤에도 최초 controller 버전이 화면에 고정됐다 · 원칙 R5, R47 · 교훈 R5/R47의 버전·캐시 일치와 관측 가능성 원칙. · 파일 sw.js
## P781 - v53.18 - route별 소유권과 요약 counts가 서로 다른 renderer 진척을 보고했다 · 원칙 R352 · 교훈 R352의 실행 소유권 실측 원칙. · 파일 architecture/route-owners.json.routes
## P780 - v53.17 - bounded portfolio readiness/status native surface · 원칙 R352 · 교훈 R352 / P780 reinforcement — portfolio readiness may be native only as a bounded status surface; Vault consent, mutations, legacy table/totals, risk,… · 파일 src/ui/pages/portfolio.js
## P779 - v53.17 - bounded fundamental SEC status native surface · 원칙 R352 · 교훈 R352 / P779 reinforcement — a fundamental route may transfer an independently owned provenance/status surface only when the normalized artifact carri… · 파일 src/ui/pages/entity.js
## P778 - v53.17 - bounded options replacement-metric native surface · 원칙 R352 · 교훈 R352 / P778 reinforcement — a native bounded metric surface must transfer source/provenance with the normalized state, fence every shared writer reac…
## P777 - v53.17 - bounded ticker hero native surface and explicit title-ID preservation · 원칙 R352 · 교훈 R352 / P777 reinforcement — stable native sink IDs are executable route contracts; shared accessibility/normalization passes must not rewrite them, a… · 파일 src/ui/pages/entity.js, js/aio-ui.js
## P776 - v53.17 - theme-detail derived-route declaration retirement · 원칙 R352, R3 · 교훈 R352 / R3 — route ownership must follow executable runtime behavior, and dead compatibility declarations must not remain after their canonical route…
## P775 - v53.17 - bounded themes RRG primary surface cutover · 원칙 R352, R3 · 교훈 R352 / R3 — renderer ownership must follow actual writer evidence, and unavailable/static theme values must remain fail-closed rather than being prom…
## P774 - v53.17 - declaration-only legacy cleanup after native feed cutovers · 원칙 R352, R3 · 교훈 R352 / R3 — a completed native cutover must retire declaration-only legacy surfaces and keep structural/browser contracts aligned with the delete led…
## P773 - v53.17 - breadth primary current-metric surface had a native/legacy writer and artifact-access gap · 원칙 R352 · 교훈 R352 / P772 reinforcement — a bounded native surface requires one executable owner, an evidence-reachable input, and explicit fencing of every legacy… · 파일 src/ui/pages/market.js, src/legacy/compatibility-facade.js
## P772 - v53.17 - fxbond primary metric surface had native/legacy last-writer risk · 원칙 R352 · 교훈 R352 / P771 reinforcement — every native primary metric surface requires one executable owner and an explicit fence for every legacy writer reaching… · 파일 src/ui/pages/market.js
## P771 - v53.17 - macro primary metric surface had native/legacy last-writer risk · 원칙 R352 · 교훈 R352 / P770 reinforcement — a native primary surface requires one executable owner and explicit fencing of every legacy writer that can reach that su… · 파일 src/ui/pages/market.js
## P770 - v53.17 - briefing primary feed owner transfer · 원칙 R352 · 교훈 R352 / AG-DOM-WRITER — complex content routes still require one primary container owner and a complete delete ledger.
## P769 - v53.17 - market-news primary feed owner transfer · 원칙 R352 · 교훈 R352 / AG-DOM-WRITER — a renderer cutover must transfer the executable owner and retire all primary-container writers. · 파일 src/ui/pages/news.js
## P768 - v53.17 - legacy screener fetch and factor projection duplicated the native artifact owner · 원칙 R352, R3 · 교훈 R352/R3/P768 — native data ownership must remove duplicate runtime producers while retaining only documented identity/memo compatibility boundaries. · 검사 ci-runtime-contract-check, ci-data-pipeline-contract-check · 파일 src/data/providers/screener.js, public-data/screener.json
## P767 - v53.17 - the data-pipeline gate still described a retired screener readiness surface · 원칙 R352, R3 · 교훈 R352/R3 — a gate must verify the current owner and cannot preserve retired-surface assumptions. · 파일 js/aio-data.js, src/ui/pages/screener.js
## P766 - v53.17 - non-route screener queries still bypassed the canonical native rows · 원칙 R352, R3 · 교훈 R352/R3 — a compatibility boundary is not complete while downstream consumers can bypass it. · 검사 ci-runtime-contract-check · 파일 js/aio-data.js
## P765 - v53.17 - native screener readiness node still had a legacy DOM writer after ARX-10 · 원칙 R352, R3 · 교훈 R352/R3 (native ownership must move with competing writers removed and recorded). · 파일 scripts/ci-architecture-contract-check.mjs, js/aio-data.js
## P764 - v53.17 - ARX-16 screener compatibility consumers bypassed the canonical native read boundary · 원칙 R352 · 교훈 R352 (single executable read owner and explicit compatibility boundary).
## P763 - v53.17 - factor-weight regime math remained embedded in the legacy wrapper · 원칙 R352 · 교훈 R352 (deterministic model math must have one executable owner). · 파일 src/domain/screener/factor-weights.js
## P762 - v53.17 - analysis signal still depended on the retired three-input toy model · 원칙 R352, R3 · 교훈 R352/R3. · 파일 src/domain/signal/decision.js
## P761 - v53.17 - market/screener parity smoke modules had no executable product owner · 원칙 R352, R3 · 교훈 R352/R3.
## P760 - v53.17 - ARX-10 native screener cutover left a legacy test/DOM ownership boundary stale · 원칙 R352, R3 · 교훈 R352/R3 (executable ownership and postmortem record must move with migration).
## P759 - v53.17 - RM-03 계속: _aioComputeFactorRanks의 legacy 단일 구현이 parity fixture만으로는 유지되지 않고 있었다 · 원칙 R352 · 교훈 R352(추출 모듈만 추가하고 실행 가능한 legacy owner를 남기는 위험을 같은 배치에서 제거해야 함). · 파일 js/aio-data.js, src/domain/screener/factor-ranks.js, sw.js · 관련 P758
## P755~P758 - v53.17 - RM-03 계속: ci-domain-parity-check.mjs의 잔여 smoke-only 토이 4종 중 3종을 실 legacy 산식으로 교체, 1종은 완전 퇴역 · 원칙 R352
## P754 - v53.17 - Data freshness watchdog의 R290 라이브 불변식 스텝이 무관한 fast-plane 실패 뒤에서 매번 조용히 skip되고 있었다 · 원칙 R290 · 교훈 해당 없음(신규 발견). · 파일 .github/workflows/data-watchdog.yml
## P753 - v53.17 - ci-architecture-browser-check.mjs의 17-route 왕복 게이트가 라우팅과 무관한 15초 부팅 지연 타이머를 "누수"로 오탐했다 · 교훈 해당 없음(신규 발견 — 이 정확한 타이밍 경계에 걸린 것은 이번이 처음으로 보인다). · 파일 js/aio-data.js
## P752 - v53.16 - P746 breadth-stage-summary를 Fable 2차 자문으로 해소: "Weinstein Stage"가 아니라 시장 참여도 분류기를 신설했다 · 원칙 R340, R352 · 교훈 해당 없음(신규 기능). · 파일 js/aio-data.js, public-data/history.json, architecture/reconciliation-status.json, js/aio-ui.js, src/domain/market/breadth.js, index.html
## P751 - v53.16 - ci-knowledge-lint-check.mjs가 git의 quoted-path 출력을 처리하지 못해 비-ASCII 파일명에서 크래시했다 · 원칙 R290 · 교훈 해당 없음(신규 발견 — 이 스크립트는 R290/P653에서 도입된 뒤 비-ASCII/공백 미추적 파일이 _context/에 놓인 적이 없어 이 경로가 한 번도 실행되지 않았던 것으로 추정). · 파일 scripts/ci-knowledge-lint-check.mjs
## P750 - v53.16 - ARX-04/RM-06 재진입 계속: Fable 자문으로 orchestrator staleness race를 발견·수정하고, news ARX-04와 screener-ranking C2를 재평가했다 · 원칙 C2, C1, R352 · 교훈 F-01~F-03류(미실측 서술의 반복), R352(orchestrator가 legacy와 다른 "승자 결정 없는 병렬 쓰기" 상태였던 것도 넓게 보면 단일 상태 원칙 위반). · 파일 public-data/data.json, js/aio-data.js, src/data/providers/news.js, src/data/orchestrators/screener.js, src/platform/http.js, scripts/ci-esm-core-unit-check.mjs
## P749 - v53.16 - RM-03 계속: news 감성점수·리스크신호를 순수 도메인으로 추출 — Fable 어드바이저 검토 후 착수, 첫 시도에서 KST 사이클 fixture 시각 설계 결함을 스스로 발견·수정 · 교훈 해당 없음(자체 발견·자체 수정, 배포 전 커밋되지 않은 로컬 작업 중 확인됨). · 파일 js/aio-data.js, src/domain/news/scoring.js, scripts/dump-news-scoring-fixtures.mjs
## P748 - v53.16 - ARX-04 두 번째 슬라이스: entity(ticker) provider가 SEC 펀더멘털을 실 fetch — sentiment는 라이브 렌더 회귀 위험으로 보류 · 교훈 해당 없음. · 파일 src/data/providers/entity.js, js/aio-chat.js, src/data/orchestrators/entity.js
## P747 - v53.16 - ARX-03/04 재진입: 8개 domain의 command/reducer 경계는 이미 클린했고, ARX-04 "closed" 선언은 미실측이었다 — screener provider 첫 실 fetch 확보 중 rank null→0 오염 발견 · 원칙 R352 · 교훈 F-01~F-03류(미실측 완료 선언), P715 반복 클래스(Number.isFinite(Number(...)) null→0), R352(랭킹 산식은 추측 복제 금지 — null로 정직하게 유지). · 파일 src/data/market-snapshot-loader.js, public-data/screener.json, src/data/normalize/screener.js, src/data/providers/screener.js, src/data/orchestrators/screener.js
## P746 - v53.16 - breadth 페이지의 Weinstein 요약 배지 두 곳이 리디자인 이후 어느 라이브 코드로도 갱신되지 않는 영구 플레이스홀더였다 (발견·부분 정리, 근본 수정은 이월) · 원칙 R340, R3 · 교훈 해당 없음(신규 회귀 아님 — 발견된 상태가 사문화 이전부터 이미 고아였음). R3 취지에 따라 발견 즉시 기록. · 파일 js/aio-ui.js, index.html
## P745 - v53.16 - RM-03 item 2: RRG(rsRatio/rsMomentum)·Weinstein/MTF 도메인 추출을 완료하고 F&G 합성 전제 오류를 확정했다 · 원칙 R340, R352, R3 · 교훈 R352(추출=동일 산식 이동 — 이번엔 반대로 "새 모델이 아니라 애초에 추출 대상 없음"을 실측으로 확정), F-11(원 계획의 전제 오류), R3. · 파일 _context/ARCHITECTURE-REMEDIATION-HANDOFF-2026-07-19.md, js/aio-data.js, index.html, src/domain/themes/rrg.js, src/domain/technical/stage.js, js/aio-core.js
## P744 - v53.16 - RM-05: 3개 native page 모듈이 lifecycle dataset 마커를 빠뜨렸고(RM-01 잔여 결함), 브라우저 게이트가 이를 놓치고 있었다 · 원칙 R352 · 교훈 R352(패턴 반복 시에도 각 파일 전수 확인 필요), AG-RESOURCE(A→B→A 자원 누수 assert 원칙, 이번에 실질적으로 처음 다中 route에 적용됨). · 파일 _context/ARCHITECTURE-REMEDIATION-HANDOFF-2026-07-19.md, scripts/ci-esm-core-unit-check.mjs, architecture/route-owners.json
## P743 - v53.16 - RM-03: computeTradingScore extraction, and exposeArchitecture's hardcoded allowlist silently dropped the new bridge function from every real browser · 원칙 R343, R352 · 교훈 R352(단일 구현 이전 시 소비측만이 아니라 노출측 계약까지 전수 갱신), F-11, AG-LEGACY(사본 삭제). · 파일 js/aio-core.js, src/domain/signal/trading-score.js, architecture/fixtures/trading-score-golden.json, src/app/bootstrap.js, src/legacy/compatibility-facade.js, scripts/backtest-trading-score.mjs
## P742 - v53.16 - RM-02: store cloned full state twice per dispatch plus once per subscriber, no O(1) scaling path for screener/portfolio · 원칙 R352 · 교훈 F-05(신설 규칙 후보 — 상태 store 클론 예산 부재), R352(W5 선행 조건 미충족 상태로 대형 slice 이관 금지). · 파일 src/state/store.js, src/state/memoize.js, scripts/ci-architecture-contract-check.mjs
## P741 - v53.16 - RM-01: thin native page modules double-wrote legacy-owned DOM and silently blocked legacy click delegation · 원칙 R352, R3 · 교훈 R352, F-03(이중 DOM writer), AG-03(단일 writer 원칙), R3(즉시 postmortem 필요). · 파일 _context/ARCHITECTURE-REMEDIATION-HANDOFF-2026-07-19.md, index.html, js/aio-data.js, architecture/route-owners.json
## P740 - v53.16 - 소유권 회계 하드코딩과 게이트 역전으로 이중 DOM writer 경합이 "17/17 native"로 은폐됨 · 원칙 R352, R25, R3 · 교훈 R352(migration은 실행 소유권 이전으로 판정), R25(반복 클래스 추적 — "진척 인플레이션" 신규 클래스의 2번째 사례), R3(F-01~F-03이 발생 당시 즉시 postmortem되지 않음, 이번에 소급 기록). · 파일 index.html, scripts/ci-retirement-contract.mjs, scripts/build-operations-status.mjs, architecture/route-owners.json, architecture/retirement-manifest.json, scripts/ci-architecture-contract-check.mjs
## P739 - v53.16 - deferred CI gates exposed stale cross-page projections and an inert derived route · 원칙 R3, R352 · 교훈 R3 postmortem requirement, R352 native ownership parity, and the route-settle/deploy-gate contract.
## P738 - v53.15 - native cutover left the runtime contract gate on retired legacy markers · 원칙 R3, R352 · 교훈 R3 postmortem requirement, R352 architecture ownership parity, and the deploy-gate contract.
## P737 - v53.15 - native sentiment chart update path dereferenced an incomplete Chart instance · 원칙 R3 · 교훈 R3 postmortem requirement and the resource/chart lifecycle contract.
## P736 - v53.15 - architecture scaffold가 실제 legacy 소유권 이전 없이 완료처럼 보였다 · 원칙 R352, R73 · 교훈 R352 및 R73/P239의 "인프라만 추가하고 소비·소유 경로 미연결" 클래스. · 파일 index.html · 관련 P239
## P735 - v53.14 - 데이터 히스토리의 공통 날짜와 LKG/AI/HY OAS 경계가 분리되지 않았다 · 원칙 R351, R332, R340 · 교훈 R351 및 R332/R340 계열(QG-06/QG-09/QG-11/QG-12).
## P734 - v53.13 - reload 후 Portfolio Vault 잠금 화면과 RSS news backstop이 회귀했다 · 원칙 R350 · 교훈 R350. · 파일 scripts/fetch-data.mjs
## P733 - v53.12 - refresh-data ESM summary에 CommonJS require가 남아 있었다 · 원칙 R348, R349 · 교훈 R348/R349.
## P732 - v53.11 - data-watchdog와 refresh workflow의 ESM heredoc가 CommonJS parser/runtime에 남아 있었다 · 교훈 workflow syntax gate는 실제 실행 mode와 같은 parser를 사용해야 한다는 운영 계약.
## P731 - v53.11 - WebSearch inferred-claim validator가 optional range와 camelCase numeric sink를 처리하지 못했다 · 원칙 R347 · 교훈 R347의 inferred claim fail-closed contract.
## P730 - v53.10 - Worker 보안 게이트가 PASS 출력 후 Node 프로세스를 종료하지 않았다 · 교훈 CI/QA 실행은 PASS 문구뿐 아니라 종료 code와 종료 시점까지 검증해야 한다는 실행 gate 원칙. · 파일 scripts/ci-worker-anthropic-check.mjs
## P729 - v53.9 - ESM 호환 observer가 legacy pageShown 이벤트를 수신하지 못했다 · 원칙 R346 · 교훈 R346(legacy event adapter는 실제 EventTarget과 payload shape를 boundary에서 정규화해야 함). · 파일 src/legacy/compatibility-facade.js, src/app/router.js, src/app/bootstrap.js
## P728 - v53.9 - quote batch가 종목마다 전역 DOM을 스캔하고 퇴역 KR 표가 네트워크 fanout을 남겼다 · 원칙 R344, R345 · 교훈 R344의 퇴역 소비자 수직 제거 범위에 scheduler/network fanout과 runtime audit을 끝까지 포함하지 못했고, 고빈도 batch에 canonical DOM owner가 없었다.
## P727 - v53.8 - 퇴역 fxbond 해설 경로가 무효 DOM 조회와 비등록 timer 폴백을 남겼다 · 원칙 R341, R344 · 교훈 R341의 퇴역 경로 완전 제거와 QA QC10의 timer registry 원칙을 구현 경로 끝까지 적용하지 못했다.
## P726 - v53.7 - HYG 달러 가격 임계 신용 판정이 5번째 표면까지 잔존했고, 그중 하나는 대상 DOM 자체가 없는 고아 코드였다 · 원칙 R25, R341, R309, R340 · 교훈 R25(이중/다중 표면 grep 전수 없이 "고쳤다" 선언 — 3회 이상 반복돼 R341 승격 대상), R341(퇴역 UI의 JS 수직 경로 미제거). · 파일 js/aio-data.js, js/aio-chat.js, index.html, js/aio-ui.js, js/aio-core.js, js/aio-tests.js
## P724 - v53.6 - Yahoo v7 quote의 52주/거래량 확장 필드를 _liveData에 쓰는 코드가 저장소에 0곳 — 이를 1순위 소스로 읽는 UI가 영구 결측이었다 · 원칙 R25 · 교훈 R25 계열(인프라 추가 시 소비자까지 경로 연결) — P721(RRG)과 같은 "생산자-소비자 파이프 단절" 클래스. · 관련 P723
## P722 - v53.5 - v53.3/53.4 신규 테스트 3건이 "데이터 없음"을 영구 불변식으로 단언해 push 시 CI RED를 예약해 두고 있었다 · 원칙 R279 · 교훈 R279 계열(관측 시점 상태를 영구 등호 단언) — 날짜(R279)·숫자 시드(P626)·이제 "결측 상태" 자체까지 3번째 변형. 규칙 승격: "테스트 불변식은 데이터 가용성 상태와 무관하게 참이어야 한다(가용/불가용 양쪽을 명시적으로 분기 검증)".
## P721 - v53.5 - RRG가 세션 내 틱 누적에 의존해 모든 신규 방문자에게 영구 판정 보류였다 · 원칙 R25 · 교훈 R25(인프라 교체 시 소비자 경로까지 연결 — v52.98이 시드 제거만 하고 실데이터 경로 미연결), 카테고리 20(정적 시장값 리터럴).
## P720 - v53.5 - critical10 감사의 맨몸 날짜 토큰이 정상 체크리스트 "5/5"와 충돌해 간헐 CI RED를 만들었다 · 원칙 R25 · 교훈 R25 반복(P715와 동일 클래스 3회째 — 감사 리터럴에 시장 실값과 충돌 가능한 짧은 숫자/날짜 패턴 금지를 규칙 승격 후보로).
## P719 - v53.5 - data.json 발행 계약(P715 quotes 스트립)이 meta 후기록 재기록에 덮여 라이브에서 무효였다 · 원칙 R25 · 교훈 R25(같은 파일 내 이중 write 사이트 전수 확인 없이 한 곳만 패치). P712~P714의 "이중 표면 드리프트" 패턴의 producer 판 — 동일 산출물에 쓰는 모든 write 경로를 grep 전수로 닫아야 한다.
## P718 - v53.4 - 공급자 퇴역 뒤 남은 시나리오 소비자가 null 확률을 숫자로 포맷했다 · 원칙 R341, R342 · 교훈 R341의 퇴역 경로 완전 제거와 R342의 결측 숫자 포맷 금지 원칙을 생산자 쪽에만 적용하고 실제 route 소비자까지 닫지 못했다.
## P717 - v53.4 - 정적 시드와 현재형 서술이 데이터 생산자처럼 분산되어 결측을 숨겼다 · 원칙 R340, R342 · 교훈 R340의 fail-closed 원칙이 파생 결론에는 적용됐지만, 화면 초기값·현재형 텍스트·AI context·비용표·테스트 fixture까지 하나의 데이터 표면으로 묶이지 않았다.
## P716 - v53.3 - 퇴역 기능을 비활성 코드로 보존하고 테스트 번들을 공개 배포한 구조가 코드와 사이트를 함께 비대화했다 · 원칙 R220, R341 · 교훈 R220의 compactness 원칙과 공개 artifact 최소화 계약이 퇴역 경로·CI 전용 자산까지 확장되지 않았다. · 검사 ci-structural-check, ci-release-revision-check
## P715 - v53.2 - 서버 백스톱 제거가 null 코어전 함정·오탐 리터럴·hue 결합 테스트를 연쇄로 드러냈다 · 원칙 R340, R25 · 교훈 R340(결측의 문자열 승격 — 이번엔 'null' 리터럴), R25(P713 날짜핀과 동족의 "외부값 회전 시 부패하는 리터럴 단언" 2번째 클래스), 신규 함정: truthy/finite 가드에서 Number() 선코어전 금지. · 파일 index.html
## P714 - v53.1 - 정적 UI가 AI 게이트가 차단하는 매매·배분 지시를 20여 곳에서 발화하고 있었다 · 원칙 R340, R25, R341 · 교훈 R340 계열(검증 안 된 입력의 판정 승격 — 이번엔 값이 아니라 '지시문'이 승격 대상이었음), R25(P713과 동일 클래스 hyg 임계의 3번째 표면 — Weinstein/MTF/score), WP-AI0의 경계 정의(게이트가 "AI 응답"만 대상이라 정적 U… · 파일 index.html
## P713 - v53.0 - fail-closed 전수 스윕이 이중 구현 표면을 놓쳤고, 날짜 하드코딩 테스트가 이벤트 당일 CI를 죽였다 · 원칙 R340, R276, R3, R25 · 교훈 R340(파생 결론의 결측 대체 금지 — 이중 구현까지 전수 강제 실패), R276 계열(동일 판정의 이중 표면), R3·R25(날짜 하드코딩 단언은 P604 auto-advance 버그와 같은 "달력 회전 부패" 계열인데 테스트/계약에서 재발). · 파일 index.html, js/aio-tests.js
## P712 - v52.99 - 결측·정적·합성 데이터가 현재 시장 판정으로 승격됐다 · 원칙 R301, R332, R340 · 교훈 R301/R332의 currentness·lineage gate를 개별 값에는 적용했지만, 파생 결론과 시각화가 필수 입력 결측을 중립값·정적값·합성값으로 대체하는 경로까지 강제하지 못했다. · 파일 public-data/data.json
## P711 - v52.97 - Telegram 증분 digest가 전체 관측 커버리지와 최신 narrative를 동시에 잃었다 · 원칙 R215, R262, R338, R339 · 교훈 R215의 digest→화면→스크리너→채팅 환류를 원문 배열 존재 여부로만 판단했고 R262의 self-throttle을 전체 기간 lineage와 독립적으로 설계하지 않았다. R338의 timestamp 의미 분리도 count/coverage 의미까지 확장하지 않았…
## P709 - v52.94 - Automated refresh exposed stale fallback-parity and producer-fixture assertions · 원칙 R308, R337 · 교훈 R308 enforcement gap; promoted to R337 for fixture precedence and explicit fallback-drift semantics.
## P708 - v52.93 - 무료 대체 계획이 실행 workflow·행 lineage·공식 Put/Call 경로 없이 부분 완료로 남음 · 원칙 R333, R334 · 교훈 R333의 “구현 완료 분리”를 workflow/row/publish 수준까지 실행하지 못함. R334로 승격. · 파일 _context/CLAUDE.md, .github/workflows/refresh-screener.yml, scripts/fetch-data.mjs, scripts/validate-screener-artifact.mjs
## P707 - v52.92 - 외부 수집 전면 실패가 마지막 정상 data.json을 빈 산출물로 덮어썼다 · 원칙 R332, R333 · 교훈 R332의 attemptedAt/lastSuccessfulAt 분리와 마지막 정상값 보존을 producer artifact publish 단계까지 적용하지 않았다. · 파일 public-data/data.json
## P706 - v52.91 - 파일 갱신 성공과 개별 관측 최신성을 혼용해 일부 정적·실패 데이터를 현재 판단처럼 보였다 · 원칙 R301, R332 · 교훈 R301의 개별 currentness envelope를 F&G에만 엄격히 적용하고 다른 데이터군의 파일 freshness·관측 freshness·수집 실패 의미까지 일반화하지 않았다. · 파일 public-data/data.json
## P705 - v52.90 - 시안 구조 검사는 통과했지만 비동기·빈 상태·닫힌 상태의 실제 사용자 여정이 분리돼 있었다 · 원칙 R329, R330, R331 · 교훈 R329의 최종 렌더 계약을 섹션 노출 여부 위주로 해석했고 R330의 정보 위계를 네트워크 실패·0건·오프스크린 포커스까지 확장하지 않았다.
## P704 - v52.89 - 사용자 페이지 20개와 내부 QA 라우트 22개를 혼용했고 남은 7면은 시안 정보 위계가 확장되지 않았다 · 원칙 R329, R330 · 교훈 R329의 최종 화면 정보 위계 계약을 13면에만 한정했고, 내부 구현 용어를 사용자 정보구조 설명에 그대로 사용했다.
## P703 - v52.88 - 정적 시안 정리가 런타임 주입·무제한 목록·기존 재배치 로직까지 제어하지 못함 (R329)
## P702 - v52.87 - 시안을 기본 구조가 아닌 기존 화면 위 장식층으로 적용 — "접어두기"를 "정리 완료"로 취급 (R328)
## P701 - v52.86 - tool mutation·데이터 권리가 registry 게이트 없이 암묵적 (WP-AI19/20)
## P700 - v52.85 - coverage bias·human 사용성 인증이 바이너리 게이트가 아니었음 (WP-AI17/18)
## P699 - v52.84 - model replay·요청 격리에 release/finalization 계약 부재 (WP-AI15/16)
## P698 - v52.83 - retrieval poisoning 품질·금융 conduct legal-review 상태 부재 (WP-AI13/14)
## P697 - v52.82 - 요청 lifecycle·금융 산술이 강제 가능한 계약이 아니었음 (WP-AI11/12, CalculationEvidence)
## P696 - v52.81 - AI 운영/벤치마크/피드백에 단일 로컬 release 계약 부재 (WP-AI8~10)
## P695 - v52.80 - 자동 발행물에 공통 publish fallback 부재 + 페이지 계약에 AI projection 부재 (WP-AI6/7)
## P694 - v52.79 - 외부 데이터·포트폴리오 AI가 action boundary를 무계약 통과 (WP-AI4/5)
## P693 - v52.78 - 연구자료 전량 주입 — intent retrieval·결정론적 context budget 부재 (WP-AI3)
## P692 - v52.77 - typed claim/evidence 검증이 공유 AI 응답 경계에 부재 (WP-AI2)
## P691 - v52.76 - AI 공개 진입점들이 공통 요청/응답 계약 없이 완료·재시도·자동 콘텐츠를 각자 처리 (WP-AI1)
## P690 - v52.75 - 응답 검증이 경고-only, 자동 시장분석이 생성 성공만으로 렌더 — 공개 안전 경계 우회
## P689 - v52.74 - 일반 방문자 부팅이 배포·공유 준비도 전체 감사를 반복 실행 — 초기 페이지 전환 수 초 정지
## P688 - v52.73 - "이미 comp-compliant, 폴리싱만" 자기평가 오류 2회째 — 3페이지 전부 실제 구조 재구축 필요(사용자 직접 지적)
## P687 - v52.72 - 6페이지 "comp-compliant" 재검증 결과 최소 3페이지 오판 + 자체 콘텐츠 소실 버그 2건
## P686 - v52.70 - macro 재구축: 여는 div 삭제/닫는 div 잔존 + 재설계가 제거한 data-snap sink를 요구하는 테스트 충돌
## P685 - v52.70 - technical 재구축: CSS-var-alpha-suffix 클래스 3건 추가 + 전체 컨테이너 치환이 신규 지표 카드를 매 로드 삭제
## P684 - v52.68 - sentiment 재구축: JS 함수의 DOM-shape 의존(wrapper+sibling strong) 보존 필요
## P683 - v52.67 - breadth는 comp 재구축이 아예 미착수였음 + 라이브 호출 UI 함수에 네온 hex·영문 라벨 잔존
## P682 - v52.66 - briefing 스팟체크에서 독립 실버그 6건 (색 스윕 누락·영문 라벨 3·디버그 문자열 노출·dead 참조로 일정 섹션 영구 공백)
## P681 - v52.65 - signal 점수/레짐 섹션이 리디자인 이전 레거시 구조 + 부수 렌더 버그 3건
## P680 - v52.64 - 이모지 제거 후 U+FE0F 고아 variation-selector가 보이지 않는 무명 버튼 생성 — R309 2번째 사례
## P679 - v52.63 - style/id 속성 안 curly quote가 page-breadth getElementById를 조용히 파괴 (기존재)
## P678 - v52.62 - 이모지 일괄 제거 스크립트가 JS 문자열 내 조건 마커를 파괴 — "바닥 확인" 항상 5/5 (R309 신설)
## P677 - v52.60 - T830이 유효한 stale fallback 스냅샷을 거부 — fallback은 방향성·명시적 degraded로 검증 (R308)
## P676 - v52.59 - H2 2차 게이트: 접근성 폰트 계약·route settle 오탐·typed provenance·공개 artifact 종결
## P675 - v52.58 - CDN 소실 시 breadth 초기화가 partial Chart stub 상태로 레지스트리 접근
## P674 - v52.57 - 서드파티 CDN 장애가 리로드 후 로컬 부팅 큐 정지 가능
## P673 - v52.56 - 노트북 차트 고유폭 + silent 외부 피드 실패가 실제 사용자 상태 은폐
## P672 - v52.55 - 만료된 이벤트 서사·입력 결측 레짐이 점수 provenance 수정 후에도 현재형으로 들림
## P671 - v52.55 - F&G 다중 currentness 경로 — 라이브 스트립과 stale 합성값 불일치, stale 값의 점수 유입 가능
## P669 - v52.54 - CODE-MAP 파일 크기 표 무재검증 드리프트(최대 484줄) — ci-doc-currency 게이트 신설 (WO-8)
## P668 - v52.53 - 전역 read/write 인벤토리: timer/chart/page 어댑터는 기존재(갭은 채택률), snapshot adapter 부재, localStorage 직접 146 vs safeLS 8 (WO-7)
## P667 - v52.52 - viewport 게이트가 FULL_INIT=0 report-only — technical SVG 라벨-값 겹침 놓침 → 배포 차단 게이트 승격 (WO-4)
## P666 - v52.51 - lowvol 서브팩터 10년/120종목 백테스트 유의미 음의 상관, composite 전 구간 무의미 (WO-3, 코드 무변경·제품 결정 보류)
## P665 - v52.50 - 스코어 vol+trend+macro(가중 55%) 10년 백테스트 통계적 유의미 음의 상관 (WO-2, 코드 무변경·제품 결정 보류)
## P664 - v52.49 - evidenceAudit: 13개 실입력 중 6개 미등록 + 등록분도 화면 미반영 — 병합 연결 (WO-6)
## P663 - v52.48 - main 브랜치 무보호 + hooks 절대경로 전체 무력화 + auto-commit 과수집 + 버전 정규식 버그 (WO-5)
## P662 - v52.47 - /anthropic 프록시가 방어 전부 우회·호출자 인증 없음·KV 미바인딩 시 캡 무제한 — 계층형 강화+fail-closed (WO-1B)
## P661 - v52.46 - 포트폴리오 "AES-256 암호화" UI 주장 거짓 + PIN 잠금 게이트가 호출부 0건 고아 함수 (WO-1A)
## P660 - v52.45 - data-watchdog.yml mojibake 파손으로 워치독 사망 + 저장소 9,639건 mojibake 발견(7,486 복구) + ci-control-char 게이트 신설 (WO-0)
## P659 - v52.44 - Worker /anthropic anycast 403 자동 재시도 — 채팅·번역·브리핑 3함수 4호출부 (B8 완화, 근본은 CF 리전 미고정)
## P658 - v52.43 - kr-supply 진짜 원인은 프록시 차단이 아니라 404(부재 엔드포인트) + BOK 금통위 날짜 자체 오류 (EF Batch 4)
## P657 - v52.42 - 라벨·번역 정직화 5건 — 시드 시각구분·수급 라벨 모순·소스명 가드·F&G 델타 소스·기준일 배지 (EF Batch 3)
## P656 - v52.41 - 라이브 재검증 결과 발견 절반이 원 진단과 다른 실제 원인·규모 (EF Batch 2)
## P655 - v52.40 - technical/breadth/briefing이 표면마다 다른 값·미래 시각·asOf 없는 서술 (EF Batch 1)
## P654 - v52.39 - 22페이지 교육 레이어(핵심 개념·근본 원리·실전 적용) 공통 부재 → AIO_PAGE_FUNDAMENTALS 신설 (R291)
## P653 - v52.38 - 운영 구조 격차 5건 — 라이브 전용 회귀 재검증 부재·실브라우저 QA 티어 비공식·knowledge-lint 무강제 등
## P652 - v52.37 - Telegram market-note·credit/funding 신호가 수집 후 일부 페이지 표면에서 누락
## P651 - v52.36 - Telegram 최신 뉴스가 페이지별 시장 본질/라이브 감시로 충분히 미연결
## P649 - v52.34 - V0/V1 "완료" 후 잔존 — 브리핑 F&G 3번째 소스 + VKOSPI 실패 UI 부재
## P648 - v52.33 - quote가 DATA_SNAPSHOT.vix만 갱신하고 _fallback.vix stale → T686 배포 차단
## P647 - v52.32 - viewport matrix가 topbar 잘림·SVG 텍스트 기하를 아직 실패시키지 못했음
## P646 - v52.31 - breadth 색상 의미가 렌더러별 분산 — 공포 32%가 비적색 게이지 가능
## P645 - v52.30 - AI 채팅 preflight가 개인키만 인정 — Worker 서버키 모드 미인식
## P644 - v52.29 - 프록시 순서에 누적 성공 증거 부재·quote 카운트 라벨 모호·중복 뉴스 카드 미게이트
## P643 - v52.28 - 프록시 HTML 차단 페이지를 JSON 성공으로 취급·KR 실패에도 대기 UI 생존·값 슬롯 typed state 부재
## P642 - v52.27 - showThemeDetail 유효 데이터 크래시(P0)·theme-detail 고아 라우트·브리핑 F&G 이중 소스·KR 캔들 냉시동 공백 (FABLE V0)
## P641 - v52.26 - VKOSPI 미니차트가 하드코딩 한 달 전 20포인트 배열 — localStorage 누적으로 교체
## P640 - v52.25 - kr-technical 설명문에 제거된 TradingView 잔존 문구
## P639 - v52.25 - 티커 체크리스트 "시장" 점수는 별개 지표인데 라벨 공유로 자기모순처럼 보임 — 라벨 명확화
## P638 - v52.24 - 배포 Worker가 리포 /anthropic 라우트보다 구버전 — 운영자 재배포+시크릿 추가로 당일 해소
## P637 - v52.24 - Claude 번역 실패가 기계번역(Google) 대신 일반 템플릿으로 직행
## P636 - v52.24 - KOSPI/KOSDAQ 전일종가가 미국 휴장 인접 주간 1세션 stale — Naver 파생값 sticky 우선
## P635 - v52.24 - VKOSPI 폴백 시드에 라이브와 동일한 단정 "(정상)" 라벨 → "(폴백·정상 추정)"
## P634 - v52.24 - VIX 기간구조가 live VIX vs stale 시드 VIX9D 비교 — 실제 콘탱고를 패닉 백워데이션 오판
## P633 - v52.23 - 라이브 QA: 사용자 노출 placeholder·raw 소스 라벨·페이지별 모바일 overflow
## P632 - v52.22 - 헤드리스 green이지만 report-only + full-surface 감사가 제거된 brief 기대 + 내부 구현 노출
## P631 - v52.20 - 로드맵 항목이 이미 해소돼 있었음(자기 진단 오류 정정) + VCP server/client parity 게이트 추가
## P630 - v52.20 - 헤드리스 스킵리스트 전량 해소 (899/922→922/922)
## P629 - v52.20 - 추천 다양성 "최근 반복 감점 개수" 카운터가 항상 0
## P628 - v52.20 - signal 섹션 재배치 함수가 작성 시점부터 silent dead code (parentElement 등식 불성립)
## P627 - v52.20 - 스킵리스트 8건이 전부 R279 클래스 — 시점 관측값의 영구 리터럴 단언을 구조 속성 단언으로 재작성
## P626 - v52.19 - index.html의 dead `fetchKrDynamicData` 중복 선언 삭제 + 고아 KR fetcher 5개 개별 endpoint 검증 + 그림자 선언 CI 게이트 (R280)
## P625 - v52.18 - HY 스프레드가 같은 페이지 로드에서 독립 드리프트된 하드코딩 2값 — 단일 출처 위반
## P624 - v52.18 - technical "SPY 포지셔닝" 카드 영구 기본값(3M 0.0%/RSI 50.0) — 데이터 소스 미배선
## P623 - v52.18 - 스크리너 가격 컬럼 90% "—" — 서버가 이미 가진 데이터 미사용
## P622 - v52.18 - theme-detail 브레드크럼 영구 "—" + ETF 표 NVDA "Self" 오라벨
## P621 - v52.17 - 크로스채널 중복 뉴스(같은 실화·다른 채널 라벨)가 3중 dedup 통과 — word-bag 2차 필터
## P620 - v52.16 - ticker cockpit이 포트폴리오 미보유 방문자에게 가짜 P&L 데모 데이터 노출 + 자체 폴백을 파괴하는 DOM 버그
## P616 - v52.15 - 홈 경고 pill 11개 연속 노출 → 1줄 요약+펼치기 (사용자 3안 중 확정)
## P615 - v52.14 - 모바일 390px topbar 우측 버튼 클러스터 잘림
## P614 - v52.14 - 운영자 노트에 "N일 경과" 배지 부재
## P613 - v52.14 - AI 패널 빈 상태 인사 부재 + 페이지 자동 프롬프트가 이동 후 공유 입력창에 잔류
## P612 - v52.14 - 페이지 전환마다 마우스 사용자에게 파란 포커스 링 노출
## P611 - v52.14 - PUBLIC STATUS 카드가 영문 내부 감사 로그 문자열을 방문자에게 노출
## P610 - v52.13 - kr-technical TradingView KRX 하드 브레이크 → Naver 일봉+Chart.js 자체 캔들로 대체
## P609 - v52.12 - "30분마다 자동 갱신" tooltip이 실제 크론 실발화(1~4h)와 불일치
## P608 - v52.11 - briefing 헤더 단어 중간 잘림 — 무말줄임 slice 4곳을 단어경계+'…'로
## P607 - v52.10 - briefing/signal F&G가 어디서도 할당 안 되는 전역 참조 — 영구 "—" (→ window._lastFG)
## P606 - v52.9 - themes 사이클 칩과 본문 판정이 독립 계산 — 실제 모순 발생 (단일 소스 구독)
## P605 - v52.8 - VKOSPI 실시간 fetch가 후행 로드 파일의 중복 선언에 밀려 영구 dead code — 27.00 고정 (R280)
## P604 - v52.7 - MACRO_CALENDAR auto-advance가 요일-고정 발표일(NFP)을 불가능한 요일로 밀음 (R279)
## P603 - v52.6 - 9개 표면 뉴스 번역 사각 — 페이지 스트립/브리핑이 자체 선택 항목의 번역을 미요청 (R245)
## P602 - v52.5 - workflow_run 체크아웃이 트리거 시작 커밋 고정 — 매 봇 사이클이 이전 사이클 트리 검증·배포 (R278)
## P601 - v52.4 - Pages deploy 1회 재시도 — 별개로 보이던 "Run failed" 이메일 2건의 공통 근본
## P600 - v52.3 - marketState 구독 모델 성숙도 검토 + 신규 코드 규율 R276 신설 (Phase 3 완료)
## P599 - v52.2 - computeTradingScore 검증 하네스 구축 (인프라만, 표본 부족 명시)
## P598 - v52.1 - telegram-digest 중복 items 필드 제거 (~46% 감량)
## P597 - v52.0 - 코어 모듈 4종+glossary defer 전환 완료
## P596 - v51.99 - bump-version.mjs가 매 범프마다 _context/CLAUDE.md의 히스토리 버전 참조를 조용히 파괴
## P595 - v51.99 - eager 모듈 심볼 참조 22건 가드 + CHAT_CONTEXTS 소유권 위험 수정 (defer 선행)
## P594 - v51.98 - 스코어 알고리즘 index.html→aio-core.js 이관 (바이트 수준 동작 불변 증명)
## P593 - v51.97 - FRED 확장 시 다른 방법론 지표가 기존 라벨 아래 조용히 교체
## P592 - v51.96 - /data-refresh 전수에서 독립 실드리프트 3건 적발 (기계적 숫자 갱신이면 놓쳤을 것)
## P591 - v51.95 - 30분 데이터 커밋이 CI 미트리거 — 라이브 ~19h 조용한 stale
## P590 - v51.94 - 서버 스크리너 유니버스를 JS 소스 텍스트 문자열 검색으로 추출 (취약)
## P589 - v51.92 - 진단서의 Stooq 폴백 권고가 실제로는 PoW 챌린지 차단으로 불가
## P588 - v51.91 - 900+ 브라우저 테스트 스위트에 CI job 부재 — 사람이 콘솔 열어야 회귀 발견
## P587 - v51.91 - 배당 미조정 종가로 모멘텀/추세 팩터 구조적 과소평가
## P586 - v51.91 - 백테스트 패널이 라이브 composite 검증처럼 표시 — 실제는 고정가중 4팩터 부분집합
## P585 - v51.91 - HY-spread 매핑이 아무도 읽지 않는 합성 FRED id에 기록
## P584 - v51.91 - 서버 Cutler RSI vs 클라이언트 Wilder RSI — 같은 "RSI(14)" 라벨, 다른 숫자
## P583 - v51.90 - _context/CLAUDE.md 이중 인코딩 파손 + CODE-MAP 60버전 stale
## P582 - v51.90 - OneDrive 동기화 충돌로 로컬 .git 파손 (loose objects 2.4GiB)
## P581 - v51.89 - value 팩터가 자연 스케일 상이한 3배수를 비정규화 평균 — 사실상 단일 팩터로 붕괴
## P580 - v51.89 - size 팩터 부호가 학술 SMB 정의와 정반대
## P579 - v51.88 - MACD histogram 앞 8값 isFinite(null) 함정 오염
## P578 - v51.88 - Bollinger 표준편차 분모 모집단 이탈
## P577 - v51.88 - 주봉 청킹 앞-앵커로 최신 1~4일 누락
## P576 - v51.88 - 신용 스트레스 입력이 FRED OAS 실측 대신 듀레이션 오염 HYG 근사 우선 ★반복 클래스 기점
## P575 - v51.87 - OPEX 날짜가 UTC+ 시간대에서 하루 앞당겨짐
## P574 - v51.86 - Sortino 하방편차 분모 비표준 — ~46% 과소평가
## P573 - v51.85 - 개인 FRED 키가 서드파티 CORS 프록시로 평문 전송 가능
## P572 - v51.84 - [skip ci] 데이터 커밋이 CI-gated 배포 이후 라이브 미도달
## P571 - v51.83 - TG scraper self-throttle 부재 — 30분마다 14일 전체 재탐색
## P570 - v51.83 - sentiment 같은 카드에 서로 다른 F&G 2값
## P569 - v51.83 - _aioRenderOperatorNote 3중 정의 (2개 영구 dead)
## P568 - v51.83 - breadth 캔버스 재방문마다 mouseleave 리스너 누수
## P567 - v51.83 - 전역 채팅 패널에 per-page 채팅의 DOMPurify 계층 부재
## P566 - v51.83 - 티커 최근 검색 저장 self-XSS (입력 검증·이스케이프 부재)
## P565 - v51.83 - FRED per-series 실패 완전 silent
## P564 - v51.83 - refresh-data push가 pull/rebase 없이 — 실제 race 발생 이력
## P563 - v51.83 - 오태그 뉴스가 AI 브리핑에서 조작처럼 들리는 섹터 분석 유발
## P562 - v51.83 - breadth 50SMA 큰 숫자가 자기 바/문장과 모순
## P561 - v51.83 - KR 홈 "상위 상승"에 -3.40% 종목
## P560 - v51.83 - fundamental 불가능/자기모순 재무 표시 (독립 근본원인 4건)
## P559 - v51.83 - P553 점수 불일치 클래스 signal 재발 (타이밍 아닌 모드 불일치)
## P558 - v51.83 - Telegram 피드 XSS — 외부 원문 innerHTML 원시 삽입 9페이지
## P557 - v51.82 - GitHub Pages가 CI 결과와 무관 배포 — 깨진 push가 라이브行 (build_type workflow 전환)
## P556 - v51.82 - "jsDelivr CDN 실패" 경고가 사실상 매 로드 오탐
## P555 - v51.82 - CI 33% 실패가 선행 버전 동기화 파손을 무관 커밋들이 상속한 것
## P554 - v51.82 - 홈 "핵심 뉴스"가 자기가 부스트한 항목에서 영구 [번역 대기]
## P553 - v51.82 - 홈 결론 헤더 vs 점수 게이지 숫자 불일치 (스코어 캐시 부재)
## P551 - v51.76 - 공개 준비도가 콘솔 감사로만 존재 — 홈 가시 표면화 (R239)
## P550 - v51.75 - 정적 `● LIVE`·rolling 48h 라벨 잔존 (R238)
## P549 - v51.74 - 페이지 currentness 과대표현 + 뉴스 윈도 라벨 드리프트 (R238)
## P548 - v51.71 - calcTechnicalSnapshot 신규 필드가 UI/AI/아티팩트 소비 경로 부분 미연결 (R235)
## P547 - v51.66 - 카테고리별 데이터 기준 시각 추적 부재 — 시간적 비일관성 노출 불가
## P546 - v51.65 - FMP 403/401 플랜 오류 silent — 밸류/퀄리티 팩터 미반영
## P545 - v51.64 - 주말 수집 시 chartPreviousClose로 주간 변동률을 일간으로 오표시
## P544 - v51.63 - DATA_SNAPSHOT *Pct에 주간 변동률 오기입
## P543 - v51.63 - 8개 지수 프로퍼티가 주석 안에 묻혀 미정의
- P535~P542 · v51.44~v51.47 · 스크리너/백테스트 정밀화 6건 — Kalman raw scale·측정노이즈 하드코딩, Bollinger 모집단 분산, stageEstimate Stage2/3 미구분, COMP_W dead key, FAILED_RETEST 미발화, Minervini 설명>계산, watchdog 48h 게이트 부재
## P534 - v51.43 - 시각 위계가 구 터미널 컨셉 잔존 (visual refresh)
## P533 - v51.42 - 라이브 기본 경로 unsafe toFixed (→ _aioSafeFixed)
## P532 - v51.40 - 운영자 노트가 첫 화면 결정 흐름 아래 매몰
- P526~P531 · v51.30 · Maker-Checker 광역 추천 누락·R1 게이트 실패, placeholder 노트·macro overflow, 모바일 폭 누수, 빈 그리드 트랙·접힘 노이즈, workflow summary 문법 파손, 뉴스 랭킹 약체 선정
## P525 - v51.30 - var _SECTOR_KEYWORDS가 const와 충돌 — chatSend 파일 전체 미실행
- P522~P524 · v51.08 · 스크리너 첫 진입 빈 테이블 · CORS 실패 시 뉴스 캐시 빈 배열 덮어쓰기 · krDynamic 스케줄러 세션 전체 silent no-op
- P515~P521 · v50.90~v50.98 · T번호 중복/dead·TG memo overlay 미갱신·source-to-consumer CI 계약 부재(P517/R222)·번역 저하·cachebuster 은폐·한국어 rewrite 표면 부재·서버 뉴스 최신순 선정
## P514 - v50.89 - workflow helpers/skills가 append-only 메모리로 비대화 → compaction 게이트 신설 (R220)
## P513 - v50.89 - audit-only 완료 패턴이 semantic gap 은폐 → semantic review 게이트 신설 (R219)
- P500~P512 · v50.55~v50.88 · 감사 정적 추정 혼재(오탐/은폐)·계약/KST/KR 카드 진실 원천 분열·scope/복합 sink 게이트·채팅 과수렴/과억제/다양성·통합 답변 계약·TG digest 소비 루프·fold 취약 선택자·runtime contract drift·notes without gates·매매 문구 과신
- P482~P499 · v50.9~v50.24 · 동기함수 .catch(silent reject)·_breadth200 폴백 오라벨·sentiment lazy-init 빈 차트·yield curve 영구 대기·themes 정적 진단 모순·스토리라인 전제 역방향·CP stale 읽기·50SMA readout 모순·미로딩 기본값 75·exit trigger 라벨 과장·F&G 페이지간 정반대 결론·breadth verdict 부호 버그·kr-technical undefined 렌더 2건·VaR 이중부호·존재하지 않는 패널 자동전송·SPX ATH 하드코딩 오표시·가상 태스크 참조 no-op
## P481 - v50.6 - breadth participation이 200일선 사유화 (5/20/50만 보는데 200 표시+로직 잔존)
- P464~P480 · v49.101~v50.4 · 근본 규칙 수립 시대 — 중앙 refresh state(R188)·페이지 프로파일 union(R189)·가시 표면 전수 freshness(R190/R193)·강제 fresh preflight(R191/R192)·DataTruthGate(R195)·교차 소스 검증(R196)·DOM 바인딩 검증(R194)·현재 시장 대조(R197~R199)·21페이지 evidence 계약+배포 게이트(R200)·뉴스/텍스트/캘린더 계약(R203~R205)

## P316~P463 · v49.57~v49.97 (AI 채팅 심층 보강·전수 감사 시대 — 시대 요약)

개별 원문은 git 히스토리 참조. 주요 계보:
- **환각 차단**: 시세 실패 시 가격 인용 HARD STOP(P406/P432), 학습 데이터 자기 인용 차단(P397), 날짜 토큰 stale 검출(P403), ABSOLUTE RULES 후처리 검증(P401), 세션 시각 헤더(P388)
- **silent fail 정직화**: dynamicTickerLookup 폴백 체인(P352/P415), chatSend silent return 5경로(P410), callClaude 실패 안내(P411), Promise.all 타임아웃(P321), QuotaExceeded(P424)
- **커버리지/레지스트리**: TICKER_NAME_REGISTRY 47→152+(P316/P339/P428), CIK_MAP 확장(P408계열), CHAT_CONTEXTS DOM 매트릭스 16 부재 발견(P400/P420), options/ticker/market-news/home 컨텍스트 누락(P319/P325/P391/P398)
- **XSS/코드 위생**: escHtml 누락 표면(P433/P434), 정규식 인젝션(P434), var hoist 충돌(P438, P311 클래스), KR 코드 다중 위치 cross-check(P441)
- **fundamental 15기준**: 9/15 학습 의존 발견(P272)→SEC/Wiki 무료 API(P273)→registry+가용성 배지(P275~P281)
- **cell-level 전수**: 구조가 아닌 "값" 정확성 검증(P451/P452), WebSearch 값 상식 검증(P453), DATA_SNAPSHOT stale 스윕(P454~P456), 본체↔_fallback drift 가드(P459), pull-only audit의 push 레이어(P461), on-enter 갱신(P463)
- **운영**: manifest.json 삭제로 SW 캐시 전체 마비(P310 CRITICAL), aio-data.js parse 실패(P311 CRITICAL), API 키 단일 저장소 위험(P312), Claude 키 미입력 silent fail(P329)
## P213~P315 · v49.22~v49.49 (근본수정 registry 시대 — 시대 요약)

- 임계값·라벨 단일 출처(THRESHOLD_REGISTRY/SCORE_SCALES, P220/P224~P228), 가중치 공개(P229), 사이클 동적화(P233), ACTION_RULES/PAGE_PURPOSE(P234~P236), 시나리오 시간 의존(P237), 지정학 단일 출처(P259)
- **메타 패턴 P239**: "인프라만 추가하고 페이지 적용 누락"(R73) — P240~P251에서 23개 항목 페이지 적용으로 상환
- 정적 콘텐츠 lifecycle(P253, Jensen 58일), KOSPI 인라인 괴리(P252), data-snap 바인딩(P258), 페이지 sequential audit 도입(P282~P293), data-action 미정의 핸들러 탐지(P291), LIVE_SYMBOLS coverage(P317/P318 2차 세트)
- ※ P316~P319는 번호 중복 2세트 존재(v49.48~49와 v49.57~58) — 당시 넘버링 실수, 본 원장에서는 병기로만 기록
## P1~P212 · v31~v49.21 (구형 포맷 시대 — 시대 요약)

구형 "BUG-N" 포맷·P41~P144 인덱스는 git 히스토리 참조. 현재도 유효한 핵심 패턴은 QA-CHECKLIST 부록 "반복 실패 방지 특별 체크"와 RULES.md에 흡수됨:
- P24 벌크 data-live-price 자식 파괴 (children.length 체크) · P25 `.pct||0` 금지 (R15) · P28 3글자 미만 키워드 오탐 (R17)
- P41~P68: v42 시대 QA 발굴 — P56 init 이중 cleanup·P57 고정 그리드 모바일 overflow·P58 applyDataSnapshot map↔HTML 역방향·P59 API 의존 전역 초기화 순서·P60 크로스페이지 공유 함수 연결·P61~P63 이벤트 후 텍스트 정합·P64 KNOWN_TICKERS 동시 등록
- P106~P110 UX 실전성 (결론 바·fb-estimated) · P126~P131 아키텍처 감사 (DOM 폴백 불일치·이벤트 중복 dispatch·prompt() 금지·스트리밍 truncation·프록시 cooldown)
- PR-P132~P138 예방적 리팩토링 — onclick 인라인 253건 제거·staleness 감지·sed 치환 범위(3회 재발)·주장-실체 불일치 Hook·canvas CSS var
- P139 scroll-chaining 전 페이지 스크롤 불가 · P140~P143 CDN SRI(R34)·setInterval ID(R9)·R15 재발·_lastFetch 키 불일치 · P144 포트폴리오 벤치마크 커버리지
