# Claude 후속 — Codex 파이프라인 의미 검토 결함 수정 (v59.44 → v59.45, 2026-10-31)

입력: `_artifacts/pipeline-review-20261024/` (Codex 2026-10-24~31, 초기 HANDOFF 12건 + PASS2~PASS30). 이 폴더의 `reproduce-*.mjs`는 Codex 재현 스크립트 사본이고, `.out`은 **수정 전** v59.44 실행 결과다(exit 0 = 결함 단언이 모두 성립). 원본 폴더는 고치지 않았다.

## 1. 재확인 결과 (수정 전)

- 초기 12건(DATA-01~05, OPS-01/02, RUNTIME-01, AI-01/02, KNOW-01, QA-01)과 PASS2 3건은 v58.7x에 이미 고쳐져 있었다. 다만 QA-01은 `knowledge-authoring-contract.mjs` 경로가 남아 있었다(이번에 수정).
- P3-QA-02는 겉으로 고쳐진 것처럼 보였다. 실제로는 `js/aio-core.js`가 1MiB 한도보다 169바이트 작아서 통과했을 뿐인 잠복 결함이었다(이번에 수정).
- PASS4~PASS30의 결함은 거의 모두 재현됐다.

## 2. 수정 범위

- **방식:** 8개 영역으로 나눠 파일 소유권이 겹치지 않게 수정하고, 주 담당자가 통합했다.
- **회귀:** `scripts/ci-pipeline-semantics-check.mjs`가 `scripts/fixtures/pipeline-semantics/<영역>.mjs` 12개 파일, 174개 케이스를 돌린다. 각 케이스는 finding id를 달고 실제 함수를 호출한다(R732).

| 영역 | 처리한 finding | 회귀 |
|---|---|---|
| briefing | PASS20·21·26 전 항목, R3-01~03, R1-05, R2-02(selection) | briefing.mjs 31 |
| portfolio | PASS22·23·27, P3-PF-01, P10-PF-02, R1-03 | portfolio.mjs 22 |
| market | PASS16·17·18, P8-THEME-01, P9-THEME-02, P10-STATE-01(시나리오), R1-01, R1-05, R3-04, R4-04 | market.mjs 30 |
| fundamentals | PASS4(DATA-09 제외), PASS5·19·25, P3-DATA-08, P3-RUNTIME-02, R1-04, R3-07 | fundamentals.mjs 24 |
| screener | PASS6·7-8·9·24, P18-KRTHEME-01, R1-02, R4-02, R4-03 | screener.mjs 14 |
| ai | PASS11·12·13, R4-01 | ai.mjs 16 |
| knowledge-state | PASS10·28·29·30, R2-03·06·07 | knowledge-state.mjs 20 |
| operations | PASS14·15, R3-06, 초기 12건 재확인 | operations.mjs 6 |
| 주 담당자 직접 | P3-QA-02, QA-01 잔여, R2-01·02·04·05, P7-BT-01, P4-DATA-09·10, P4-QA-03, P6-STAT-01 UI 라벨, P23 화면 문구, P27 레거시 '$NaN', Atlas 재시도, 화면 coverage 연결, boot 예산 | qa·data-runtime·research-scripts·producers |

- **원장:** 결함 클래스별로 P2141~P2150을 기록하고 R732를 신설했다.
  - P2141 결측, P2142 시각, P2143 실패, P2144 동률, P2145 캐시
  - P2146 부분문자열, P2147 단위, P2148 AI, P2149 병합, P2150 게이트
- **공개 자료에서 실제로 틀리게 나가던 것:**
  - `event-briefs.json`의 매출 '예상 대비 −100%' 8건(DLR·ENTG·COHU·GEV·STX·V 등). 다음 실행에서 다시 계산된다(QA-EVENT-BRIEF-AMOUNT-01).
  - 시장 상태 '5일 변화'(달러지수 +0.3%로 표시, 맞는 값 +0.4%).

## 3. Codex가 보지 않은 파일의 추가 검토 (R1~R4)

- **대상:** Codex 핸드오프에 경로가 나오지 않은 source 파일은 523개다(`UNMENTIONED-SOURCE-FILES.txt`, 언급 여부 기준이라 실제 미판독보다 많게 잡힌다).
- **방식:** 4개 읽기 전용 검토로 화면·데이터 계층·생산자·도메인/AI를 나눴다.
- **결과:** 새 결함 22건을 찾았고 모두 위 표에서 고쳤다. 미래 시각·결측·점 개수 창·부분문자열·실패를 성공으로 기록하는 클래스가 같았다.
- **각 검토가 '못 본 파일' 목록을 남겼다.** 주요 항목:
  - stock-chart*, entity.js, theme-playbook-view, market.js
  - app/commands, providers analysis/portfolio, orchestrators analysis/portfolio/themes
  - market-analysis-validate.mjs, screener-breadth.mjs
  - trading-score, stage, price-levels, macro/*, knowledge 본문 팩
  - 다음 검토는 이 목록부터 이어 간다.

## 4. 소유자 결정 필요 (구현하지 않음)

1. **P3-DOC-01:** 설정 가이드 PDF(v49.57)와 생성기(v56)가 Claude 개인 키·`/anthropic` 기준이다. 지금 앱은 공용 Worker `/openai`를 쓴다. 퇴역을 권한다(배포 allowlist에 없다).
2. **P24-PRODUCT-01:** 차트 전략 렌즈가 이 종목의 피벗·EMA 가격을 손절·목표 칸에 넣고 '일부 정리'라고 쓴다. AGENTS의 '앱이 가격·타이밍을 정하지 않음'과 부딪친다.
   - 제안: 현재 가격은 수준 지도에만 두고, 렌즈는 일반 규칙만 설명한다.
3. **OPTIONS_ANALYSIS:** 옵션은 퇴역했는데 분류기가 'options' 근거를 요구한다. 그 근거에 매핑된 도구가 없다.
   - (a) '옵션 자료 없음'으로 답한다.
   - (b) 일반 질문으로 흡수한다.
4. **R3-05:** 미국 스크리너의 미수집 종목 행을 이어 쓸지 정해야 한다. 지금은 '이전 종가 기준' 표시 경로가 없어 이어 쓰지 않았다.
5. **P9-BT-01/02:** 2026-07 상대화 실험을 역사 실험으로 고정할지, 현행 v5 모델로 다시 돌릴지 정해야 한다. 설명 문구는 이미 바로잡았다.
6. **나머지 영역별 OWNER 항목:**
   - INTL 종목 벤치마크
   - 원장 flowTiming 기본값
   - 생산자 adapter 입력 확대
   - public-readiness 임계·명칭
   - 학습 메모 백업 범위

## 5. 남은 일 (CONSIDER·후속)

- **P25-STORY-02 나머지:** `sync-company-profiles.mjs`가 index 행에 `contentHash`를 넣어야 한다. 클라이언트는 이미 읽는다.
- **P25-STORY-01 나머지:** entity signature에 달력 로드 여부를 넣고, AI 문맥에 freshness를 전달해야 한다.
- **mergeNewsFeedHealth `lastHealthyAt`:** 이름이 의미와 맞지 않는다. `operational-health.mjs`와 함께 바꿔야 한다.
- **기타 CONSIDER:** 각 영역 보고에서 남긴 것(curl `--max-time`, 13F 다중 출처, 깊은 freeze 등). 실패 양상·가능성·비용을 적었고 구현하지 않았다.
- **임시 사본 정리:** `C:\Users\zmfhd\AppData\Local\Temp\full`(AI 작업자의 사본, 535MB). 안의 `node_modules`가 실제 저장소를 가리키는 junction이다. 재귀 삭제하기 전에 junction을 먼저 끊어야 한다.

## 5-1. v59.46 소유자 결정 반영 (2026-10-31)

- P3-DOC-01: 설정 가이드 PDF·생성기를 지웠다(change-only).
- P2151 P24-PRODUCT-01: 렌즈 규칙 칸에서 이 종목 가격과 '일부 정리'를 뺐다(R724).
  - 소유자는 '하방 압력 상승/현금 비중 높이기 권고/분할 수익 실현 권고'를 제안했다.
  - '권고'는 비중·시점 제안이라 R724와 부딪친다. 그래서 방식의 규칙("이 방식은 ~에서 이익 일부를 확정")으로 표현했다.
  - 하방 압력은 이미 추세 판단(trendRead)이 관측으로 보여 준다.
- P2152 R3-05: 미국 미수집 종목의 행을 이어 쓴다.
  - 7일 이내 행만, retainedFrom을 단다.
  - 검증기는 이어 쓴 행을 빼고 수집률을 본다.
  - 순위는 최신 확정 종가 행만 점수화하므로 섞이지 않는다.
- P2153: OPTIONS_ANALYSIS 근거는 market-snapshot+entity-quote다.
- P2154 P9-BT-01: 상대화 실험을 현행 모델로 다시 돌렸다(relative-v2: 기준선 단위만 다름).
  - 21일 −0.104, 63일 −0.144, 보류 구간 음수로 실패했다.
  - 환경 라벨 정책을 유지한다.
- 알려진 환경성 실패:
  - browser-secondary-text-budget(themes 959>901): 로컬 회전 자료가 금요일 종가 전이라 사분면 분류가 0이 되고, 그래서 접힌 칸이 자동으로 열렸다.
  - watchdog 2건: 로컬 자료 신선도.
- 구조 진단(소유자 질문)은 최종 답변에 수치와 함께 정리했다. 요점:
  - 결함 클래스 10개는 '관측값' 공용 타입이 없는 데서 나온다.
  - finite 헬퍼 70개 파일, 날짜 정규식 132곳.
  - 원장은 R 669 / P 1,673 / QA 1,239 / 게이트 169로 누적형이다.

## 5-2. 공용 관측 부품 시범 (v59.46, 소유자 승인 "시범부터 진행")

- 공용 부품:
  - `src/domain/shared/number.js`: finiteNumber(엄격) + readNumber(문자열 허용, 빈 값·공백·불리언·배열은 없음) + isFiniteNumber
  - `src/domain/shared/session-date.js`(신규): isoDay·stampDay·latestSessionRows
- 옮긴 영역: src/domain/market·screener·themes 전체, ui/pages screener·themes·market, data/selectors/market-inputs.
  - 지역 finite 21개와 날짜 정규식 20곳을 지웠다.
  - 예외: market-calendar.js는 import 금지(P1533)라 자체 검사를 유지한다.
- 래칫 게이트 `shared-primitive-ratchet` + `architecture/shared-primitive-baseline.json`:
  - src/ 전체 수치: 지역 finite 64→42, 날짜 정규식 93→78(정의 파일 제외).
  - 옮긴 영역은 0으로 고정한다.
- 시범 중 찾은 결함: P2155 cash-metrics의 빈 capex → 0%.
- 게이트 정리: desktop-continuity의 `indexOf('function finite(')` 소스 절단을 공용 함수 주입으로 바꿨다.
  - 이 게이트에는 소스 문자열 위치로 자르는 절단이 아직 10곳 남아 있다. 다음 정리 대상이다.
- 순 코드 줄 수: 추적 src 95,996줄은 그대로, 신규 session-date.js +28줄이다.
  - 한 줄짜리 사본을 한 줄 import로 바꾼 것이라 줄 수는 줄지 않았다.
  - 줄 수를 실제로 줄이는 큰 대상은 js/와 src/의 중복 로직, 원장 압축, 소스 문자열 게이트다.
- 다음 확장 순서(같은 방식):
  1. fundamental·portfolio·macro·technical의 남은 지역 finite 42개
  2. 날짜 정규식 78곳
  3. scripts/producer 쪽 사본(래칫 범위 밖)

## 5-3. src 전체 확대 (v59.46)

- 결과(src/ 전체):
  - 지역 finite 64→0개.
  - 날짜 정규식 93→5곳. 남은 5곳은 파서 4곳과 import 없는 달력 1곳이다.
- 재무 finiteFact도 이제 readNumber를 가리킨다.
- 래칫:
  - 영역별 예외 목록을 지웠다.
  - 기준선은 4개 파일 5곳뿐이고, 나머지는 모두 0으로 고정했다.
- 고친 게이트:
  - architecture-contract의 macro-read 문장 고정 → 동작 확인
  - desktop-continuity의 analysis.js 절단 → 공용 함수 주입
  - knowledge parity 영향 규칙에 src/domain/shared/*.js 추가(생성물 656개 변화 없음)
- 줄 수: 추적 src 95,996→95,982(−14), session-date.js +38. 순 +24다.
- 남은 구조 과제:
  1. 생산자→소비자 경계의 관측값 계약. src 안 observedAt 참조가 479곳이다.
  2. js/와 src/ 이중 런타임
  3. 게이트의 소스 문자열 절단 76곳(21개 스크립트)
  4. 원장 압축
  5. scripts/ 쪽 사본(래칫 범위 밖)

## 5-4. 데이터 경계 계약 1단계 (v59.46, 소유자 결정 "(가)")

설계·단계·래칫 정의는 `BOUNDARY-CONTRACT-DESIGN.md`에 있다.

- **접근자 추가:** `readRowNumber(row, key, purpose)`를 `src/data/contracts/screener.js`에 두었다. 준비도 레지스트리의 숫자 필드는 `fieldValueForPurpose`로 읽고, 레지스트리 밖 키(ret5d, ret10d)는 그대로 읽는다.
- **소비자 이전:** group-strength, kr-themes, korea-participation을 옮겼다. korea-participation의 지역 `read`는 이 접근자로 대체했다.
- **동작 확인:** 테마 화면을 옛 직접 읽기와 새 계약 읽기로 각각 렌더해 비교했다. 전체 텍스트 11,456자가 같다.
- **신선도 정책:** `src/domain/shared/freshness-policy.js`를 새로 두고, 같은 의미의 예산 사본 7곳을 여기로 모았다. 값은 그대로다.
  - 15분: providers/screener, portfolio/surface
  - 4일: factor-ranks, providers/screener, screener-breadth(96시간)
  - 456일: period, cash-metrics
- **래칫:** `rawRowRead` 지표를 더했다. 기준선은 225건(48파일)이다.
- **의미 검사:** `BC-ROWREAD-01`을 추가해 의미 검사가 181건이 됐다.
- **정정:** `scripts/lib/factors.mjs:285`의 CURRENT는 결함이 아니다. 백테스트의 as-of 재구성이다. 이어쓴 행도 최신 세션만 쓰는 소비자에서 이미 빠지므로 고치지 않았다.
- **다음 단계:**
  1. 단계 2: factor-ranks·screener 페이지·theme-playbook-view·theme-criteria·setup-profile 이전. 계산 용도 전환은 화면별로 소유자 확인.
  2. 단계 3: 달력일 예산을 세션 수로 교체. 동작이 바뀌므로 승인 필요.

## 5-5. v59.47 경계 계약 2·3단계 + SEC 투영 장애 (소유자 "계획 전부 승인")

- 2단계: 소비자 30여 파일 이전. rawRowRead 225→92(남은 대부분 오탐). readRowNumber는 준비도 없는 행을 두 용도 모두 원값으로 읽는다(백테스트·골든 행).
- 3단계: 가격 팩터·시장 폭·팩터 세트의 4일 기준 → market-calendar `isSessionCurrent`(최신 완료 세션, 또는 한 세션 뒤는 마감 후 12시간 안). 연도 없는 달력(2026 이전)만 4일.
- 4·5단계 닫음: 상태 어휘는 서로 다른 것을 말함, js/ 직접 읽기 3건은 값 전달.
- P2156: refresh-screener가 10/30 22:25Z부터 SEC 투영 1 MiB 초과(1,052,459)로 실패 → `src/data/contracts/sec-projection.js` 공통 값 헤더(recordDefaults) 무손실 인코딩, 1,034→647 KB. 생산자 실증은 push 뒤 첫 refresh-screener(QA-SEC-PROJ-DEFAULTS-LIVE-01).
- 부팅 gzip 상한 636,000→636,500(+194 B, 사유 boot-budget.json note).
- 전체 QA 158 통과(브라우저 포함).

## 5-6. v59.48 전면 보강 (소유자 "하나하나 의심해가면서")

- P2156 실증: push 뒤 refresh-screener 06:21Z·06:30Z 성공, sec-fundamentals-summary 652,220 B(62%), recordDefaults 14필드.
- P2157~P2161:
  - P2157: EPS 비교 기준 `epsComparisonBasis`(조정/보고).
  - P2158: 브리프 한국어 단위·문장부호·FOMC "10대 2".
  - P2159: 주말 칩 세션 종가.
  - P2160: 브리프 파일 compact + 640 KiB 예산.
  - P2161: watchdog은 자기 평면만 오류(322/349 중복 경보 제거).
- 변경 전용(에이전트 3개 작업, diff 직접 확인):
  - 부팅 -45 KB gzip(상한 597 KB로 낮춤).
  - RULES 원칙 C1~C18 재구성(494→213 KB, R 727개 보존).
  - desktop-continuity를 실제 모듈 + 가짜 DOM으로 전환.
  - sec-fiscal-history 분리.
  - 아키텍처 중복 텍스트 고정 제거.
  - 06~08 KST 시각 의존 테스트 고정.
- 의심해서 닫은 것(고치지 않음):
  - CLAUDE.md 버전 줄: bump·게이트가 이미 맞춤.
  - "전면 재작성 금지" vs AGENTS 삭제 원칙: 충돌 아님.
  - Trading Score 문구: v5 모델이 살아 있고 AIO_PAGE_BRIEFS.steps는 화면에 그리지 않음.
- watchdog 판단 근거: 8일 시뮬레이션에서 SLO(마지막 성공 경과) 규칙은 322→238로만 줄었다. 빨간불 대부분이 실제 생산자 장애였다(시장 10/29 01:20~14:20Z 연속 실패 등). 그 장애들은 이미 operations-alert 이슈(재개·회복·임계)가 맡고 있었으므로, 남은 문제는 이중 경보였다.
- 남은 일:
  - 생산자 신뢰도. 7일 실패율은 refresh-data 27%, refresh-screener 23%, CI 14%다. 주원인은 데이터 커밋의 CI 적색(UNATTESTED_REVISION)과 공유 파일 rebase 충돌이다.
  - js/aio-*.js 공용 vm 하네스.
  - AI 채팅 게이트 묶음 통합.
  - 06~08 KST 뉴스 완료 주기 행 stale 판정(제품 질문, 게이트 에이전트 지적).
  - QA-BC-SESSION-LIVE-01(평일 마감 후 확인).

## 5-7. v59.49 실패 원장에서 출발한 보강 (소유자 "남은 작업 모두", "결정 필요한 건 바꿔")

- **방식:** 추측 대신 최근 7일 Actions 실패 145건을 원인별로 분류했다. 분류에 쓴 파일은 scratchpad `causes.txt`·`jobs.txt`다.
  - UNATTESTED_REVISION 52건: 모두 CI 실패의 연쇄였다.
  - CI 시간대 테스트 10건, history-time 9건, static-data 7건(10-24, 54bc802b에서 이미 수정), 픽스처 5건, 겹침 4건, 텍스트 예산 3건, 증명 단계 13건(사람 push CI 실패의 연쇄로, 설계대로 동작), 브라우저 설치 장애 다수, API 500 1건.
- **수정 (P2162~P2166, R733):**
  - 세션 분류 경계: RUT 16:30 종가, 일요일 재개장, 월요일 개장 직후.
  - 시간표 전수 검사 게이트(scripts/lib/market-session-sweep.mjs). 수정 전 코드에서 96건 불일치를 재현하고 수정 후 0건이다.
  - 뉴스 점검을 화면과 같은 규칙으로 맞췄다. 소유자가 물은 '06~08 KST 오래됨'은 화면 표시가 아니었다. 화면은 이미 최신 완료 주기를 현재로 보였고, 점검 수치와 테스트만 어긋나 있었다.
  - 그밖의 수정: 시나리오 픽스처, 확장 묶음 겹침, event-briefs 데이터 출처(ci.yml, 위험 경로), API 5xx 재시도.
  - 읽기 전용 검토 3개의 결함도 고쳤다: 차트 코치 R724, 비교표 구간, 손익 색, 차트 전환, 테마 창, 시황 검증기, 국채 스프레드 날짜, 장기 거시 표기.
  - 스크리너 질의를 chat-globals로 옮겼다(gzip −6.6 KB, 상한 591 KB).
- **의심해서 철회한 것:**
  - 테마 기록 결손의 원인을 압축 행 미전개로 봤다. 실제로는 10/30 기록 시점에 스크리너가 P2156 장애로 10/29에 머물렀던 것이다(설계대로 제외되고 다음 갱신에서 채워짐).
  - stageRun 변경은 되돌렸다. v58.78 테스트가 정한 보수적 하한이 맞다.
  - vm 하네스와 채팅 게이트 통합은 닫았다. 결함 근거가 없다.
- **남은 것:**
  - 홈 보조 텍스트가 417/418자다. 행사 문장이 늘면 사람 push CI가 깨질 수 있다. 상한을 올리려면 소유자 사유가 필요하다(--write).
  - 잠재 항목(Sahm·고용 행 개수 창, price-levels 무효 봉 이어 붙이기, trading-score 게이트 전 가중치·도달 불가 '비중 부담' 문구, 테마 공급자 테스트 경로 updatedAt, 시장 화면 원시 값 대 봉투 값)은 고치지 않았다. 지금 출력이 같거나 라이브에서 닿지 않는다.
  - 라이브 확인: QA-SESSION-SWEEP-LIVE-01(일요일 22~24Z, 월요일 개장), QA-DATA-CI-ORIGIN-LIVE-01.

## 6. 검증 경계

- **실행해서 통과:**
  - pipeline-semantics 전 케이스
  - esm-core, runtime-contract, architecture-contract, scenario-guidance, fiscal-quality, masters-contract
  - headless-tests(T752 단언은 새 루머 판정에 맞춤)
  - boot-budget(상향, 사유 기록), version, record-fix, assertion-trace, workspace-contract, text-pin, control-char
  - `qa-runner affected` 전체 결과는 `qa-affected.log`에 있다.
- **확인하지 않음:**
  - 브라우저로 본 화면 문구
  - Actions에서의 workflow 변경(operations-alert.yml)
  - 라이브 생산자 실행과 공개 자료 재생성
  - 커밋·push 없음
