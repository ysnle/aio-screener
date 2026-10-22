> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# 남은 UI 셸 전문 감사

MODE: review | VERDICT: FAIL | REF: 7e2411432f6ca0e5f02528b209b013bf5f7ff2dc (v58.59)

FINDINGS: 2 actionable. 제품 소스는 읽기 전용이며 수정·커밋·push·배포하지 않았다. cstack review 절차로 호출 경로와 반례를 재검증했다. INDEPENDENCE: 같은 모델의 분담 검토이므로 limited. 이 문서 자체는 독립된 두 번째 모델의 승인이 아니다.

## 읽기 증빙

- `js/aio-ui.js` 1–4382 전체를 고정 REF의 `git show`로 읽었다. 처음 결합 출력은 잘림 경고가 있었으므로 그것을 읽기 증빙으로 삼지 않고, 1–300 / 301–700 / 701–1100 / 1101–1500 / 1501–1900 / 1901–2300 / 2301–2700 / 2701–3100 / 3101–3500 / 3501–3900 / 3901–4382의 연속 범위를 각각 출력하여 전 줄을 읽었다.
- Git blob: `48c3fa8c10fff09c3e2b34d8c75a22180e035032`.
- 원본 바이트 SHA256: `5fb244f82c49219b3f34afdded788bc3356696ea687e0deafc99a7a8079a44bd`.
- local checkout은 v58.61이며 다수 dirty 변경이 있었다. 이를 감사 대상과 혼합하지 않았다.

## UI-SHELL-1 [ACT ON][P1] 저장 차단이 나머지 셸 초기화를 중단

고정 위치: `js/aio-ui.js:3387–3398` (첫 예외는 3387). 저장소가 차단되어 localStorage의 getItem 또는 최초 setItem이 예외를 던지는 정상적인 브라우저 거절 상태에서, 최상위 `aio_visited` IIFE가 예외를 그대로 내보낸다. 이후 3479의 키보드 리스너, 4269의 테마 복원, 4329의 면책 마운트, 4367의 `_aioOpenStockSearch` 전역 대입 및 마지막 DOMContentLoaded 등록에 도달하지 못한다. 같은 파일 63–68은 저장 거절을 예상하여 안내하도록 설계되어 있지만, 먼저 스크립트 평가가 중단되어 완만한 저하 계약이 깨진다. 함수 선언의 호이스팅과 실제 초기화·대입 실행 여부는 구분했다.

실제 호출 경로: classic defer 파일 평가 → 3386 즉시 실행 → localStorage.getItem('aio_visited') → 예외 → 파일 뒤쪽 평가 중단. 사이드바 종목 검색은 index의 `_aioOpenStockSearch` action에 의존하며, 키보드 단축키도 해당 리스너 등록에 의존한다.

measured: 고정 원본 전체를 VM에서 평가하고 저장 어댑터만 거절하도록 했을 때 스택에 `js/aio-ui.js:3387:21`, document keydown 등록 0, `_aioOpenStockSearch` 미등록을 확인했다. 같은 DOM stub에 저장 허용만 바꾼 대조군은 keydown 1, `_aioOpenStockSearch` 등록 true였다. 실제 브라우저의 저장 거절 재현은 실행하지 않았다.

대안: 이 두 마이그레이션/방문 기록 IIFE의 저장 접근을 기존 안전 저장 어댑터나 한정 try/catch로 감싼다. 저장 거절 시 방문 여부 기록만 생략하고 뒤 셸 등록을 계속한다. 저장 거절 대조군에서 마지막 action과 키보드 리스너가 모두 등록되는 회귀 검증이 적절하다.

## UI-SHELL-2 [ACT ON][P1] 월별 가격 이력 실패를 누적 원가 손익의 가짜 30일 곡선으로 대체

고정 위치: `js/aio-ui.js:4156–4168` (출력 4213–4221). 한 종목의 일별 이력이 실패하거나 상위 10개 밖이면, 현재 가격과 매입 원가의 누적 손익을 계산하여 0부터 오늘까지 선형 분배한다. 매입일이나 해당 30일의 관측치는 사용하지 않는데 `내 포트폴리오: ... (30일)` 및 `Alpha`를 출력한다. 상위 10종목만의 문제가 아니라 유일한 종목의 fetch 실패도 동일 경로다.

실제 사용자 경로: 포트폴리오에 보유 종목 존재 → `js/aio-workspace.js:731–741`이 `pf-benchmark-section`을 노출 → `index.html:5557` 새로고침 버튼의 `data-action="updateBenchmarkChart"` → `js/aio-core.js:1757–1762` 전역 dispatch → `updateBenchmarkChart` → SPY 성공/보유종목 실패 → uncovReturn 선형 보간 → canvas 출력. 해당 section은 data-dev-only가 아니며 보유 종목이 있으면 나타난다(정적 경로 추적).

measured: VM에서 SPY의 5개 일별 종가를 모두 100으로 제공하고, NVDA 1주·원가100·현재가200·월별이력 요청 실패를 제공했다. 실제 함수가 `내 포트폴리오: +100.0% (30일)`, `SPY: +0.0% (30일)`, `Alpha: +100.0%p`, `일별 실데이터 커버리지: 0%`를 그렸다. 월별 이력이 하나도 없으므로 이 +100%의 월별 기간 귀속을 입증할 수 없다.

index.html:5564에는 '실제 계좌 수익이 아님·상위 10종목 밖 단순 추정' 문구가 있지만, 유일한/상위 종목의 네트워크 실패까지 선형 추정으로 전환한다는 범위를 설명하지 않고 기간을 창작하는 계산 자체도 정당화하지 않는다. 가족용 참고 기능이라는 목적은 유지할 수 있지만 확인 불가한 숫자를 그려서는 안 된다.

대안: 이력 없는 종목은 전체 포트폴리오·Alpha를 보류하고 SPY와 커버리지/결측 사유만 보여준다. 부분 시계열을 제공하려면 '확보된 n개 종목만의 참고 수익률'로 별도 명명하고 누락을 원가로 메우지 않는다. 비중은 동일 시점·동일 기준통화 평가액, 비교선은 관측 날짜 교집합으로 계산한다. 현재 원가 수익률은 기간이 확인된 별도 현재 손익 표면에만 남긴다.

## 검토했으나 확정 발견에 넣지 않은 후보

- 금리 SVG의 1M 라벨(1509)에 threeM을 넣는 빌더(1783), 심리 게이지 축 방향, 과거 score-breakdown은 코드상 후보이나 해당 SVG slot이 현재 index에 없거나 도달성이 확인되지 않아 actionable에 포함하지 않았다.
- 한국 일봉 비동기 응답 경합·VKOSPI chart registry 밖 소유권은 `data-dev-only` 하위이므로 일반 사용자 노출 결함으로 승격하지 않았다.
- legacy 재무 렌더러의 누락값→0, 년도별 index 결합, 일부 문자열 HTML sink는 전문 검토했으나 별도 금융 감사와의 중복 및 실제 provider 데이터 형태 검증을 마치지 않아 확정 보안/금융 결함으로 보고하지 않았다.
- A12 screener inspector stale, A13 research keyboard blur는 이 분담의 신규 발견으로 중복 기록하지 않았다.

## 실행 증거와 한계

`node _artifacts/architecture-quality-audit-20261021-v5859/ui-shell-probe-repro.mjs` → 정상 종료, `ui-shell-probe-results.json`에 위 두 반례와 허용 저장 대조군 기록. 고정 원본 전체/함수를 격리 VM에서만 평가했으며 DOM·canvas·fetch는 stub/mock이다. 외부 네트워크·producer·실제 AI·실브라우저·live 서비스는 실행하지 않았다. 브라우저 렌더·포커스·배포 동작은 UNVERIFIED다. 제품 수정은 하지 않았으므로 closeout 제품 QA나 workspace generator는 실행하지 않았다.

SAFETY FACT: 이 두 반례의 계산·등록 실패는 고정 blob 격리 실행으로 PROVED (ladder step 4). 실제 사용자 화면의 시각적 재현은 UNPROVEN.
