# PASS20 — 뉴스 생산·선별·검증·장중 정정 계약

2026-10-30 직접 검토. 제품 수정·생산자 실행·외부 요청·에이전트 사용 없음. v59.44 작업 트리 기준. 이전 판독 후 변경 6경로와 신규 132경로는 pass20-inventory-drift.json에 보존했다. 신규 경로 수에는 감사 자료도 포함되며 모두 새 제품 파일이라는 뜻은 아니다.

## 판독 범위와 증거

전체 판독 13파일: src/domain/news/{selection,scoring,keyword-match,keyword-prefilter,report-verification,stories,earnings-context,kr-close-note}.js, src/app/news-selection-entry-points.js, src/domain/briefing/{news-picks,macro-releases,market-movers}.js, scripts/lib/news-selection.mjs. 대형 selection과 producer는 구간을 나누어 끝까지 확인했다. selection-keywords.js 1,731행은 아직 전체 판독하지 않았다. js/aio-core LRU 및 src/ui/components/news.js 소비 지점은 부분 확인이며 FULL로 올리지 않는다.

reproduce-pass20.mjs의 8개 순수 함수 반례 exit0, pass20-reproductions.json. 서버 dedup은 별도 reproduce-pass20-dedup.mjs와 pass20-dedup.json. 아래 경계 반례는 운영 발생률이나 브라우저 실행 증거가 아니다.

## 발견·영향·개편안

### P20-VERIFY-01 — 루머 판정과 AI 입력 자격 판정이 다름

reportVerification은 rumor를 루머로 판정하지만 selection의 별도 UNVERIFIED_CLAIM_KW는 동일 표현을 놓친다. Reuters tier1, 최신시각, 충분한 summary를 가진 “Market chatter: chip acquisition rumor”가 verified-current 및 eligibleForAi=true. producer가 붙인 verification=unconfirmed도 단일 판정의 원천으로 소비하지 않는다. 정상 selectNewsBundle 출력은 headline-only이므로 모든 서버 루머가 AI 본문 증거로 들어간다고 단정하지 않는다. 요약이 붙은 RSS/보강 입력 경계에서 재현된다.

개편: 공통 검증 상태 함수를 생산자·선별·화면·AI가 공유하고 unconfirmed는 이후 단계에서 무조건 verified로 상승시키지 않는다. 출처 등급·본문 깊이·주장의 검증 여부는 별도 축이다. 회귀: rumor/reportedly/한국어 루머, 공식 확인 뒤 정정 버전, headline-only와 summary 조합, producer 상태 전달.

### P20-TIME-01 — 미래 서버 cycle을 신뢰하여 미래 기사도 AI 입력으로 선택

serverCycleTrusted가 now-end<=24시간만 검사해 미래 end도 통과한다. 미래 pubDate와 미래 cycle을 가진 _serverBackstop 입력에서 currentEvidence.current=false/futurePublication과 aiItems 포함이 동시에 발생했다. 정상 수집기의 현재 cycle 생성 자체가 미래라는 뜻은 아니며 boundary 방어 결함이다.

개편: cycle start<=end<=now, 허용 지연, 기사 발행 시간 범위를 공통 판정하고 currentEvidence=false가 AI 자격을 막도록 한다. 현재/과거/미래 cycle, 종료 전, 시간 오차 경계, 미래 게시 예약을 회귀 검증.

### P20-CACHE-01 — 기사 점수 캐시가 시간 경과와 내용 변경을 반영하지 않음

scoreItem key는 title/source/pubDate 중심이며 now·desc·tier·tickers를 포함하지 않는다. 같은 Map에서 5일 경과한 점수는 초기값 그대로, 빈 캐시 계산은 감소했다. 실제 entry-point의 private LRU는 용량 제한이며 TTL이 없다. 장시간 열린 탭이나 요약 보강 시 선별 우선순위가 과거 상태에 고정될 수 있다. _blacklisted mutation도 재사용 행에서 재평가 시 초기화되는지 보강 필요.

개편: 정적 relevance만 캐시하고 시간 감점은 호출 시 계산. 내용 revision을 key에 반영. 회귀: 하루 경계, 탭 장기 유지, 동일 URL 본문/등급 변경, blacklist 해제.

### P20-REVISION-01 — 같은 URL의 정정이 장중 추가 기사에서 사라짐

stories.selectIntradayNews는 canonical link와 같으면 correctionOf가 있는 신규 정정도 제외한다. main story identity의 버전 구분과 장중 슬롯 기준이 다르다. 기존 기사 rose→정정 fell 반례에서 빈 배열. UI news가 이 선택기를 호출한다.

서버 selectNewsBundle도 newsSameEvent의 문자 bigram/동일 숫자로 서로 반대 방향의 제목을 같은 사건으로 제거한다. 점수 높은 기존 rose50%가 남고 다른 URL의 Correction/fell50%는 빠지는 별도 반례를 마련했다. one-event-one-slot 정책은 합리적이나 정정을 버리는 근거가 되어서는 안 된다. 출력 projection도 revision 메타데이터를 유지하지 않는다.

개편: article/event/version을 구분하고 동일 사건의 최신 정정은 대체·연결한다. 중복 보도 묶음에는 출처와 수정 상태를 남긴다. 제목 유사성은 표시 다양성의 보조 신호로만 사용. 회귀: 동일 URL 정정, 다른 URL 철회, 같은 숫자의 반대 방향, 서로 다른 기업의 비슷한 제목, 높은 점수의 오래된 기사.

### P20-TEXT-01 — 부정문을 위험 발생으로 집계

“no credit stress or default risk” 5건으로 credit 위험 신호가 생성된다. 어휘 동시출현을 사건 확인으로 승격한 결과다. 요약으로 분석가능 여부를 통과시키고 제목+desc만 감성 산정하는 별도 반례에서는 강세 summary 5개가 sampleSufficient=true/score50이다. 후자는 제목 감성이라는 명확한 제품 정의가 있다면 계산 자체 오류로 단정할 수 없으므로 입력 범위·표현의 일치 여부를 확인할 후보로 기록한다.

개편: 부정/해소/가능성/실제 발생을 분리하고 단순 키워드 지표는 그 한계를 표시. summary를 자격 판단에 쓰면서 실제 분석하지 않는 경우 화면이 본문 분석을 암시하지 않도록 한다. 회귀: no/without/easing/risk of/actual default, 동일 기사 반복과 독립 기사 표본.

### P20-TIER-01 — 출처 부분문자열이 등급을 높임

client newsSourceTier는 FT 패턴의 단어 경계가 없어 Software News를 tier1로 판정한다. server tier 판정은 경계가 있으며 명시적 tier가 있으면 정상 전달될 수 있어 모든 서버 출력 문제는 아니다. 정확한 출처 ID·도메인 레지스트리로 판정하고 알려지지 않은 문자열을 보수 처리. 회귀: FT/Financial Times/Software 및 명시 tier 우선순위.

### P20-ISSUER-01 — 종목 기호 클래스 경계 후보

companyMatcher('BRK')는 '$BRK.B earnings'에 일치한다. producer tickerNewsHeadlineNamesIssuer에도 점을 경계로 보는 형태가 있다. BRK가 실제 유효 회사로 들어온 운영 사례는 확인하지 않았으므로 이름 추정 발생으로 단정하지 않는다. 정확한 registry symbol, 클래스 suffix, 일반 단어 티커, 한국 suffix를 함께 검증해야 한다.

## 추가 후보·정상 계약

- sourceMonthStale가 달 이름만으로 과거 기사로 판정하여 미래 연도의 전망이나 과거 비교 설명을 버릴 수 있다. 실제 입력 사례 필요.
- mergeNewsFeedHealth의 최초 실패에도 lastHealthyAt=at가 생겨 필드명과 의미가 어긋날 여지. firstObservedAt와 lastSuccessAt 분리 제안.
- fetchNews의 intraday 선택은 기본 Date.now를 사용하여 run attempt time과 cycle cut이 달라질 수 있다. 자정/08:00 경계 주입 시각 회귀 필요.
- ticker memo의 미래 허용 1시간, intraday 15분, client 5분이 다르다. 정책 의도와 시각 정규화 단위를 합의해야 한다.
- deriveTickerNewsLineage는 ts/pubDate 중 최대를 택하므로 서로 불일치하거나 미래 시각이면 관측일이 올라간다. 정상 RSS parser는 같은 publication을 제공한다. 수집시각 대체 금지와 함께 일치 검증 제안.
- source cap·tier3 cap·한국 예약·feed floor는 코드에 명시되어 있다. 다양성 목적 자체를 결함으로 취급하지 않는다. 한국 슬롯 옛 주석3과 상수5는 주석 drift다.
- macro-releases와 market-movers 신규 모듈은 전체 판독. 릴리스 예정 고정 UTC시각의 DST/공식 발표시각 적합성, buildMacroBoard와 호출 nowMs 일치 여부는 후속 소비자 검토 후보다.

## 남은 범위

event-briefs 신규 경로는 다음 pass에서 producer·UI·workflow까지 연결 검토한다. 6개 변경 경로 재검토와 나머지 파일별 NOT_RECONCILED 상태는 남아 있다. 이 문서는 전체 Codebase 완료 선언이 아니다. 정적 재현은 배포·실시간·UI 인증으로 승격하지 않는다. commit/push/deploy 없음.
