# PASS16 — 시장 시간·세션 연결·시계열 의미

2026-10-29 KST, v59.42 P2127 작업 트리. 직접 검토, 에이전트/제품 수정/외부 수집 없음. baseline pipeline-review-pass16-20261029. 공식 휴장 일정 자체를 외부 검증한 것이 아니라 저장소가 선언한 계약과 소비자 동작을 대조했다.

## P16-TIME-01 — 등록된 특별 개장 시간을 화면 시계가 무시

중간 / 수정 권고 / Pre-existing. market-calendar.js의 KRX specialSessions는 2026-11-19 open10:00/close16:30을 반환한다. session-bridge.js marketClock은 close만 읽고 open은540분(09:00) 고정이다. 재현: 해당 날짜09:30 KST에 calendar.open='10:00'인데 clock.kr.phase='regular'. 2027 첫 개장일10:00 설정에도 같은 구조가 적용된다.

영향: home-session-bridge 및 AI 맥락의 한국 정규장 표시가 조기 시작하며 krLive 판단에도 전달된다. 외부 일정의 사실성 여부와 독립적으로 같은 저장소 안의 계약 불일치다. 보강: open/close를 모두 calendar 결과에서 읽고 특별 개장·정상일·휴장·개장 직전/정각·확정 대기 경계를 비교한다. 레지스트리 날짜를 하드코딩한 별도 예외 분기를 만들지 않는다.

## P16-TIME-02 — 날짜 정렬이 일부 지수에만 적용

중간 / 수정 권고 / Pre-existing. koreaLinks는 Nasdaq을 코스피 관측 전에 완료한 미국 세션과 대조하고 Nikkei/Hang Seng/환율은 같은 KST 날짜로 제한한다. 반면 kosdaq과 semis는 날짜 검사 없이 사용한다.

재현: 10/28 코스피+1%, 직전 미국 Nasdaq+1%, 같은 날 코스닥+1%에서는 local verdict='against'. 코스닥을10/26 -8%로 바꾸면 local='supports'가 돼 국내 고유 요인으로 설명한다. SMH를 미래10/29 +20%로 넣으면 직전 미국장 evidence에 그 수치도 포함된다. fixture는 단순 '값 없음'이 아닌 날짜가 명시된 서로 다른 세션을 사용한다.

영향: 소비자는 이를 ‘왜 움직였나/근거 맞음’으로 표시한다. 화면과 AI 모두 session-lean.js에서 같은 buildSessionBridge/renderSessionBridgeContext를 사용한다. 보강: 한국 지수끼리 같은 기준 세션, 미국 ETF는 Nasdaq과 같은 직전 완료 세션에 결속시킨다. 당일 아시아 장중 자료는 cutoff 이후 관측이 섞이지 않는지도 확인한다. 미확인 입력은 원인 분류에서 제외하되 빠진 근거를 설명한다. 회귀: 동일/이전/다음 세션, 날짜 없음, cutoff 이후 동일 날짜, 지수 하나만 있는 입력.

## P16-TIME-03 — 미래 관측을 0분 전의 선물 시세로 표시

중간 / 수정 권고 / Pre-existing. reading은 (now-observedAt)를 Math.max(0,...)로 처리하고 미래 입력을 거부하지 않는다. futuresStale은 ageMin 상한만 본다. 재현: now10/28 08Z, NQ=F observedAt10/29 08Z이면 ageMin0/futuresStale=false이며 문구는 ‘0분 전 관측’이다.

이는 정규화 소비자의 방어 누락 재현이며 현재 운영 artifact에 미래 행이 존재한다고 주장하지 않는다. producer/market snapshot gate의 모든 활성 경로가 이런 입력을 사전에 차단하는지는 추가 추적이 필요하다. 보강: 미래/유효하지 않은 시각을 별도 unknown 상태로 분류하고 갱신 지연과 구분한다. 허용할 clock skew가 필요하면 명시적 상한을 둔다. 미래 생성 시각 snapshotAge도 같은 clamp를 사용하므로 동일 회귀군에 포함한다.

## 전체 본문 직접 판독12파일

src/domain/market/의 market-calendar.js, session-bridge.js, session-time.js, quote-currentness.js, quote-presentation.js, history-session.js, moving-average.js, market-windows.js, close-series.js, benchmarks.js, instrument-registry.js와 src/ui/components/session-lean.js. 최초 묶음 출력의 session-bridge 중간은126줄 이후로 재판독했고 calendar181줄 이후 및 close-series171줄 이후도 모두 확인했다.

정상 계약: calendar 미등록 연도는 session 판정 unknown; 최신 US 완료 종가와 장중 상태 분리; KRX 마감 확정 grace 명시; close-series는 carried-forward 제외·동일 세션 중복/settlement 우선순위·1일 변화의 누락 허용0; benchmark는 종목 factor 기준일 through를 받음; instrument registry의 이름 기반 선언과 inferred currency를 구분함. quote presentation은 envelope/raw 가격 충돌을 disputed로 남김. 이 소스 확인을 browser/live PASS로 표현하지 않는다.

추가 후보(확정3건과 별도): closeChange는 BTC의 null market을 US로 치환해 세션 간격을 센다. recordPercentile은 현재값이 표본에 포함됐다는 분모를 쓰므로 외부값이 최대를 넘을 때100 초과 가능성이 있다. benchmarkOf의 INTL 기본US가 실제 소비자에서 제외되는지 확인 필요. quote-presentation의 allowedUse 'none'이 reference로 정규화되므로 consumer 권한 사용 경로를 확인해야 한다. history-session의 날짜문자열 regex만 통과한 invalid date, close-series 미등록 연도 weekday fallback은 호출 목적별 검토가 필요하다. 아직 운영 결함으로 확정하지 않았다.

## 증거

reproduce-pass16.mjs exit0, 결과 pass16-reproductions.json. special-open 대조와 날짜 혼합·미래 timestamp를 순수 함수로 재현했다. UI 연결은 소스 판독이며 브라우저/모델을 실행하지 않았다. 실제 코드 수정·commit/push/deploy 없음. 전체 전수 검토 미완료.

감사 소유7경로 affected QA: run2026-10-29T01-28-00-330Z-39976-xm6ml3, pass3/cached7/fail2. PASS15와 같은 generated-state 불일치 및 qa-runner-behavior 임시 last-run.json ENOENT가 남았다. fixture syntax 및 audit diff --check 통과. 개선 금지 범위에 따라 generator/QA 코드 수정 없이 실패를 보존했다. 앞선 source 분류940개 기준 직접 판독 기록은134개, 나머지806개(타 reader/부분/미대조 포함)이며 전체 의미 완료율은 아니다.
