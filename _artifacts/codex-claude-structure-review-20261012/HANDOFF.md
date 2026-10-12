# Claude 구조 개선 심층 검토 핸드오프

작성: Codex, 2026-10-12 KST. 상태: 로컬 구조·로직·대표 입력 리뷰 기록 완료, 실제 AI 답변·배포 검증 차단.

## 먼저 읽을 판단

전체 판단은 **FAIL/WARN 혼합**이다. 사용자 질문을 중심으로 메뉴를 정리하고, 종합점수를 걷어내고, 공통 판정과 데이터 계보를 마련한 방향은 타당하다. 다만 같은 데이터가 최신성·누락 검사 없이 다른 소비자로 넘어가거나, 새 산출물을 장시간 열린 화면이 다시 읽지 않는 경로가 남았다. 정상 fixture PASS만으로 이 의미·시점 결함을 인증할 수 없다.

44개 검토 항목(M15 + E14 + A10 + U5)을 기록했다. 여기에는 재현된 코드 결함, 정적 검증 공백, 설계·표현 문제와 계획 미완료가 함께 포함된다. **44개 독립 버그라는 뜻은 아니다.** M14/E09처럼 같은 종류가 두 경로에 있는 항목도 있다.

범위는 10월 1~12일 non-data/non-merge 79개 커밋과 P1363~P1643의 281개 기록이다. 인벤토리는 작업 누락 방지용이며 각 P entry의 의미·과거 배포를 모두 독립 PASS로 처리하지 않았다. 통합 이력에는 Claude뿐 아니라 Codex·Command Code 작업도 들어 있어 단독 저작으로 귀속하지 않았다.

## 후속 작업의 우선순위

| 순서 | 해결할 문제 | 상세 근거 | 완료 기준 |
|---|---|---|---|
|1|**동일 revision·종가·관측일을 끝까지 소비**: boot snapshot/macro/contributors/차트/SEC 이력 캐시, AI 생성 순서|A01/A03, M01/M02, E04/E05|같은 탭에서 producer A→B를 주입했을 때 화면·근거·AI context가 B로 함께 바뀌고 실패 후 재시도 가능|
|2|**누락·stale를 유효 숫자로 승격하지 않기**: 자체 F&G/레이더/지수 초과성과/거래량/테마 순위|M03~M05, E02/E07/E08|각 필수 입력 null/stale/ahead에서 숫자·현재 판단이 보류되고 원자료 시점이 보존됨|
|3|**입력 신원·AI 검증 경계**: 잘못된 한국 코드·날짜, 허위 변화율·조건수·확률·직접 지시|E01/E06, M06|0059300/날짜는 다른 issuer로 바뀌지 않음; 허위 변화/99·4/가짜확률/직접 지시가 admission에서 거부됨|
|4|**계산과 문장의 의미 일치**: 지수 기여 추론, MA 하락폭, 일별 비교 날짜·단위, 평탄 역배열, KR 회전|E03/E09~E11, M10~M12/M14/M15|경계 입력에서 사실과 문장이 일치. 표본·분모·기간·절대/상대 차이를 짧게 설명|
|5|**통합의 실제 완료와 사용성**: 반복 종목 요약, 숫자 근거 접근성, 서가 동선, 최신 관측 dead path|E12~E14, U01~U05, A10|대표 질문→차트→접힌 근거가 연결되고 키보드/탭·같은 페이지 문서 이동이 가능|
|6|**QA와 정본의 범위**: component/split legacy writer 누락, 퇴역 route/count, stale 스킬/registry, 빈 배열 PASS|A04~A07, M13|현재 registry/manifest에서 대상을 파생하고 정상·반례 integration을 모두 검사|

수정은 이번에 적용하지 않았다. 기능 삭제/새 producer/배포 작업을 이 리뷰가 승인한 것은 아니다. CFTC producer·사업 설명 producer·추정 매물대의 유지/삭제는 기존 결정 항목을 중복 요청하지 말고 현재 사용자 범위를 확인해 별도 처리한다.

## 검증·차단·미검증

| 증거 | 이번 결과 | 한계 |
|---|---|---|
|Source contracts|캐시 없이 132 PASS, 1 환경 실패|knowledge-generated-parity self-copy 오류. 생성물 불일치 FAIL로 단정하지 않음|
|Workspace 필수 계약|generated-state/workspace/knowledge/skill/eval/ledger/assertion/profile/mirror PASS|모델 행동·배포를 인증하지 않음|
|Offline 반례|주 담당자가 19개 그룹을 직접 재실행, JSON 보존|고의 반례의 실제 production 빈도·외부 source 상태는 별도|
|실제 Chrome|19 route 열기·본문 읽기, 9개 대표 종목/오입력, KR 선택·차트 005930 직접 입력|실시간 가격 미수신 다수. 394편 콘텐츠 전편의 투자 서술 인증은 아님|
|반응형 gate|19 route × 3 viewport PASS|실기기 Safari·모든 문구 이해 검증은 아님|
|대표 종목 gate|6개 KR 모집단 assertion FAIL, 나머지 AEHR 합성 chart/fiscal/scenario 실행|local 최신 완료 KR 세션의 artifact 부족. 합성 응답을 live로 승격하지 않음|
|AI 실제 조작|17 route 전송 시도→공용 AI 미준비·질문 보존, masters/guide는 disabled|생성 답변 0건. 인용·grounding·숫자·설명 품질·실제 비용 정산 미검증|
|배포판|브라우저 방문 자체가 자동 승인 검토 429/retry-limit으로 차단|위험 판정이 아닌 검토 서비스 실패. 우회하지 않음|

미검증을 더 구체적으로 남긴다: 새 CCC/B/BB 수집, SEC 레인 복구 후 실제 artifact, 현재 모델의 새 사후검증, 최신 한국장 producer, long-lived 실제 발행 전환, 실기기 iPhone/iPad Safari, 정확한 boot/performance budget, 전체 WCAG 감사, 포트폴리오 실제 PIN/복원·실제 개인 보유값, 실제 Worker 답변·청구·Secrets·권한·배포 SHA는 완료하지 않았다.

## 상세 자료와 재현 방법

- [작업별 인벤토리](./CHANGE-INVENTORY.md)와 [기록·파일 원문 JSON](./change-inventory.json): 79개 커밋의 intent/files, 281개 관련 P 기록. 독립 PASS 목록이 아니다.
- [반례 원문](./reproduce.mjs), [실행 결과](./counterexamples.json), [실행 로그](./counterexamples.log): `node _artifacts/codex-claude-structure-review-20261012/reproduce.mjs`. 외부 네트워크·producer 호출 없이 현행 domain과 renderer 경계를 실행한다.
- [계약 로그](./contracts-workspace-temp.log), [브라우저 결과](./browser-gates.json), [종목](./browser-gates/entity/browser-report.json), [반응형](./browser-gates/responsive/report.json).
- [원본 보존 검사](./preservation.json): 세션 시작 content hash와 현재 2828개 기존 파일을 비교한다. 최종 수치와 closeout은 아래 갱신 기록에 남긴다.

## 다음 담당자가 피해야 할 오판

1. 8개 허브/19개 route를 8개 실제 renderer로 완전 통합했다고 말하지 않는다. 내비게이션 통합과 legacy 퇴역은 다른 종료 조건이다.
2. 숫자의 관측일이 보인다는 이유로 현재 판정 사용을 허용하지 않는다. dated 참고 자료는 남길 수 있지만 새 판단은 source/revision/latest completed session admission이 필요하다.
3. 테스트가 PASS했다고 문장 인과·누락·확률·사용자 이해까지 PASS라고 하지 않는다. 이번 반례는 기존 정상 gate들을 통과하는 입력 경계에서 발견했다.
4. provider 미수신·AI 미준비를 합성 응답으로 조용히 대체하지 않는다. 합성 chart 결과와 실제 user network 결과를 계속 분리한다.
5. 이 보고서를 근거로 자동 commit/push/deploy, 기능 삭제, Secrets 변경을 하지 않는다. 이번 작업은 새 리뷰 자료만 작성했다.

## 범위와 작업 경계

- 2026-10-01 정보 구조 제안 및 v56.89의 8개 화면 내비게이션부터 2026-10-12 v57.42까지의 구조 개선을 검토한다.
- 기준 HEAD: `57833f62`. 시작 시점의 미커밋 변경(P1643 포함)은 사용자 소유로 보존한다.
- 요청은 결정·의도·방향성, 생산기와 갱신, 데이터 계약과 계산, 소비자와 화면, 사용자 이해와 편의까지 추적하는 리뷰다.
- 제품 소스 수정·기능 삭제·버전 변경·commit·push·deploy를 실행하지 않는다. 리뷰 자료와 검증 근거만 새 디렉터리에 작성한다.
- 실행 기준선: `node scripts/qa-runner.mjs session-start --session codex-claude-structure-review-20261012`.
- 정적 계약, 실행 재현, 로컬 브라우저 paint/조작, 배포 상태는 서로 다른 증거다. 과거 보고서의 PASS는 이번 검토의 PASS로 승격하지 않는다.
- desktop/mobile/iPad는 현재 사용자 범위다. 일부 스킬의 오래된 desktop-only 문구는 적용하지 않는다.

## 진행 중 발견한 사항

1. 8화면은 현재 내비게이션 묶음이고 active route는 19개다. 레거시 삭제를 동반한 실제 통합 완료와 구분해야 한다.
2. P1643 숫자 근거 카드가 일반 `title`을 동적으로 바꾸지만 비초점 요소에 키보드 진입을 추가하지 않는다. 브라우저 재현 예정.
3. 레이더·심리 합산·시나리오의 누락/오래된 입력 처리와 원래 시장 판정의 신선도 처리 간 불일치 후보를 독립 리뷰어가 재현했다. 주 담당자가 증거를 통합 검토한다.
4. 최초 localhost 브라우저 접속은 샌드박스 소켓 경계에서 실패했다. localhost 전용 서버를 승인된 격리 밖 실행으로 시작한 뒤 Chrome에서 실제 v57.42를 열었다. 제품 네트워크 설정은 변경하지 않았다.

## 검증 진행 기록

- `node scripts/qa-runner.mjs fast`: 실행 6 PASS + 캐시 8, 실패 0. 보고서: `.cache/aio-qa/runs/2026-10-12T08-09-33-511Z-35356-gbkpqm.json`. 구조 검증이며 화면 의미 검증은 아니다.
- 기존 실패 배치가 runner에 남아 있음을 확인했다. 이번 fast 실행이 이를 모두 덮지 않았다는 NOTE를 그대로 존중한다.
- Chrome 로컬 v57.42 오늘 화면을 열고 초기 안내를 닫았다. 시장 혼조, 미국 종가 10/9, 시나리오 집중 유지 조건 4/4, 섹터 ETF 11행을 실제 표시에서 확인했다.

## 중간 기록 파일

- [시장·오늘·거시 발견 사항](./MARKET-FINDINGS.md): M01~M15, 작업별 producer→domain→화면 추적과 실제 화면의 의미 충돌. 1차 상세 기록 완료.
- [구조·운영·QA 발견 사항](./ARCHITECTURE-FINDINGS.md): A01~A10, snapshot revision·freshness·writer 검사·레지스트리·예산정산·미완료 통합 경계. 2차 상세 기록 완료.
- [종목·테마·포트폴리오·리서치 발견 사항](./ENTITY-FINDINGS.md): E01~E14, 계산·입력·갱신 반례와 실제 미국/한국/오입력 결과. 3차 상세 기록 완료.
- [실제 UI·입력·AI 점검](./UI-AND-AI-CHECKS.md): 19route 직접보기, 대표9종목/오입력, 한국순위0, P1643 U01~U05, AI17전송차단+2미지원. 4차 상세 기록 완료.
- 실제 입력·AI 검토를 추가 요청받았다. 로컬 오늘 화면에서 질문을 실제 전송했으나 공용 AI 미준비로 차단됐고 입력은 유지됐다.
- 배포판 방문은 자동 승인 검토 서비스의429/retry-limit 오류로 거절됐다. 위험 판정이 아닌 승인 검토 실패이며 우회하지 않았다. 배포 AI 답변 품질은 아직 확인하지 못했다.
- 전체 source contracts는 임시폴더 경계를 분리한 실행에서132 PASS/1 FAIL이다. 실패는 knowledge-generated-parity가 repository 내부 임시폴더로 자기 자신을 복사하려는 환경 설정 오류(ERR_FS_CP_EINVAL)다. 제품 parity 오류로 단정하지 않는다.

## 최종 로컬 마감 기록

- task session 기반 `affected --explain`은 이번 새 리뷰 자료만 선택했다. 기존 Claude dirty 파일은 작업 범위를 넓히지 않았다.
- `node scripts/qa-runner.mjs affected --session codex-claude-structure-review-20261012`: 3 실행 PASS + 11 캐시, 실패 0. 로그 `closeout.log`, run `2026-10-12T08-58-36-875Z-20320-d0zf9d`.
- 이는 보고서 작업의 로컬 마감이며, contracts의 환경 실패와 entity gate의 한국 데이터 실패를 해결했다고 의미하지 않는다. runner도 이전 실패 배치를 그대로 보존했다.
- `git diff --check`: PASS.
- `preservation.json`: 시작 시점 기존 2828개 파일 중 변경 0, HEAD 동일. 제품·기존 dirty·기존 QA 산출물을 보존했다.
- 버전 변경, commit, push, deploy, Actions dispatch, Secrets 변경은 실행하지 않았다.

이번 작업은 한 번에 기록하지 않았다. 시작 경계/첫 관측 → MARKET → ARCHITECTURE → ENTITY → UI/AI → 인벤토리/반례 → 최종 마감을 순차 작성했다.
