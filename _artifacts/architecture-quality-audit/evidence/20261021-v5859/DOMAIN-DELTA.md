> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# Domain·producer delta 의미 감사

MODE: review | VERDICT: FAIL | REF: 7e2411432f6ca0e5f02528b209b013bf5f7ff2dc (v58.59)

이 소유 범위에서 새 ACT ON 2건(medium 1, low 1). 별도 UI 담당의 계좌 베타 후보를 domain 식으로 확인했다. 동일 모델 팀의 독립 lens이므로 independence: limited. 제품·데이터·Git 변경, producer 실행, 외부 요청, 유료 AI 호출 없음.

## 읽기 범위와 근거

`d36bb256→REF`의 src/domain 전체 변경 13개와 지정 producer/lib 7개, 총 20개 파일의 전체 diff를 읽었다. 이 중 신규 analysis-read, taylor-rule, kr-investor-flows, ticker-exact, asset-class 5개는 고정 REF 전문을 읽었다. 나머지는 FULL_DIFF_REVIEW 8개와 DIFF_ONLY 7개다. 후속 원장 감사에서 이전 FULL 기반이 없는 factors, macro-sources, market-analysis-numbers, market-analysis-validate, daily-diff, market-read, entity/stock-read 7개를 DIFF_ONLY로 낮췄다. 이 최초 delta에서는 전체 diff만 읽었으며 전문 인증이 아니다. market-read와 entity/stock-read의 후속 직접 전문은 domain-complete.md/domain-complete-reading.tsv로 별도 기록한다. diff 출력이 잘린 부분은 배열 구간으로 나눠 추가 읽었다.

기존 20261021 financial-delta-reading/interpretation-reading/producer-reading 원장의 FULL 또는 FULL_DIFF_REVIEW 62개는 원장 sha256 = 이번 base Git 원문 sha256 = REF Git 원문 sha256임을 비교해 재사용했다. 이 62개는 이번 재독으로 세지 않는다. 이전 원장의 FULL_DIFF_REVIEW를 FULL로 승격하지 않는다. 새 원장에 이전 파일명·상태·SHA·base/current equality를 남겼고 REQUIRES_DELTA 잔여는 0개다. 실제 의미 판단은 기존 20261019→20261021의 연속 감사 범위와 이번 delta를 합친 범위다. 이것이 저장소 전체의 모든 파일을 다시 읽었다는 뜻은 아니다.

caller·parser·UI·실제 artifact는 PARTIAL 10개로 구분했다. `stress-sensitivity.js`는 prior hash reuse에 더해 FX 경계의 관련 식과 계약 전문을 이번에 읽었으나 원장 상태를 재사용에서 FULL로 올리지 않았다. 개별 자료의 바이트 SHA는 domain-reading.tsv를 본다.

## D59-01 — [ACT ON][medium] DuPont 설명이 ROE 변화를 상쇄한 요인을 하락 원인으로 제시

위치: `src/domain/fundamental/analysis-read.js:96`, `:101`.

Trigger: 세 요인의 로그 기여가 서로 반대이고, 절댓값이 가장 큰 단일 요인의 방향이 전체 ROE 변화 방향과 다른 정상 연간 기록. 예컨대 순이익률 +40%, 자산회전율 −20%, 레버리지 약 −23.9%인 경우다.

Failure: 절댓값 정렬은 가장 많이 움직인 요인을 찾지만 이를 그대로 “ROE가 내린 데는 … 가장 크게 작용”이라고 붙인다. 이익률이 손실을 상쇄했는데 하락을 만들었다고 읽히므로 사용자가 수익성 악화 원인을 반대로 이해한다.

Proof: 고정 REF buildDupontRead의 3개 연속 회계연도 fixture 실행에서 ROE 20.0%→17.0%, margin 10.0%→14.0%, turnover 1→0.8, leverage 2→1.5217을 얻었다. 실제 반환문은 `ROE가 20.0%에서 17.0%로 내린 데는 순이익률 변화(10.0% → 14.0%)가 가장 크게 작용했습니다.`였다. 로그 기여는 margin +0.33647, turnover −0.22314, leverage −0.27329다. 합은 음수이며 순이익률은 명백히 하락 상쇄다. 숫자·연속기간·양수 자산/자본은 합법적인 모듈 입력이다.

Caller: stock-read.renderStockAnalysis → dupontCard → buildDupontRead → 반환 sentence를 그대로 lede로 표시. assetChain 열을 수집한 종목에서 도달하며, 새 수집을 실행하거나 현행 모든 종목에서 발생했다고 주장하지 않는다.

최소 대안: 전체 변화와 같은 방향 기여 중 최대를 원인으로 고르고 반대 기여는 상쇄로 쓴다. 더 작은 수정은 기존 절댓값 요인을 유지하면서 “가장 많이 움직인 요인”과 방향·상쇄 여부를 명시해 인과 문장을 없애는 것이다.

## D59-02 — [ACT ON][low] 신규 분석 카드가 52/53주 회계연도를 달력 연도로 잘못 표시

위치: `src/domain/fundamental/analysis-read.js:20`(fyLabel), `:81`, `:113`, `:134`, `:187` 소비.

Trigger: 연간 회계말이 1월 첫 주인 52/53주 사업자. 고정 REF fiscal artifact에 실제로 LDOS 2026-01-02, SNA/TXT/SWK 2026-01-03이 존재한다. 기존 domain.period.fiscalYearLabel은 이들 기간을 FY2025로 읽는다.

Failure: 신규 helper는 앞 4자리만 잘라 FY2026으로 표기한다. 종목 요약의 역 DCF·DuPont 및 R&D/발생액에서 기존 재무 공시 FY2025와 다른 연도를 보여 동일 공시가 다른 연도의 실적으로 보인다. DCF는 assetChain을 요구하지 않아 신규 자산 수집 전에도 경로가 존재한다.

Proof: 같은 2026-01-02에 기존 fiscalYearLabel='FY2025', 새 buildDupontRead/buildRdRead/reverseDcfInputs label='FY2026'이 반환됐다. 실제 pinned LDOS 연간 history와 명시적인 synthetic shares/close fixture로 실행한 DCF도 state=ready,label=FY2026,periodEnd=2026-01-02다. 브라우저에서 LDOS 화면을 직접 확인한 증거는 아니다.

최소 대안: 이미 같은 period.js에서 import하는 fiscalYearLabel을 공유하고 새 helper를 제거한다. 신규 R&D UI의 직접 FY substring도 UI 담당의 대응 범위에서 함께 확인해야 한다.

## 공동 확인 — 새 계좌 베타의 통화 경계

UI 담당이 제기한 `src/ui/components/portfolio-read.js:157`은 estimateBookSensitivities에 기준통화 비중만 전달한다. 기존 domain `stress-sensitivity.js:55,:81`은 현지통화 수익률 모델이며 baseCurrency 인자를 받지 않는다. 새 카드가 이를 “계좌 평균 움직임”으로 읽으면 원화 계좌의 미국 자산 환산 효과가 빠진다.

고정 REF 모듈의 35주 격리 재현에서 USD 주가가 100으로 고정되고 S&P와 USD/KRW가 동행하는 경우 현지통화 beta=0, 같은 보유분의 실제 원화평가 수익률로 회귀하면 beta=1.000000000000002였다. 이 계산 차이는 measured이며 새 UI 문장의 의미 불일치 판단은 caller 계약에서 inferred다. 기존 stress panel은 원/달러 충격에만 별도의 translation을 더하는 설계라 이 후보를 기존 domain 자체의 새 변경으로 분류하지 않는다. UI 보고서와 합산할 때 중복 finding으로 세지 않는다. 최소 대안은 계좌 기준통화로 수익률과 지수 기준을 일치시키거나 “환율 제외·현지통화 주가 민감도”로 범위를 명시하는 것이다.

## 거시·시장서술의 현재 증거와 승격하지 않은 후보

- 고정 `public-data/data.json` marketAnalysis는 status=blocked, generatedAt=2026-10-21T02:51:43.056Z, reason=`leadership-claim-during-break,axis-state-contradiction:trend`다. 현재 summary는 종가/장중과 날짜를 붙인 지표 fallback이다. 새 producer의 prompt/validator 수정을 읽은 사실을 새 시장 해석 생성 성공으로 승격하지 않았다. 배포·브라우저 재생성은 root 범위다.
- Treasury 새 만기 입력은 같은 observedAt의 공식 feed 또는 동일 날짜 FRED만 읽으며, 없는 만기를 다른 날짜로 채우지 않는다. curveMonthAgo의 세션 탐색·단위(수익률 %와 bp), Taylor의 Okun 부호·SEP r*와 고정 대안·기준월 간격, 한국 수급의 부호/미공시 투자자 비추정, bondCushion의 USD↔KRW 환산 방향을 검토했다. 공식 외부 출처 원문과 수치를 새로 대조한 인증은 아니다.
- 한국 수급은 5일 전 값도 stale=false다(격리 재현). 일간 source의 실제 지연 게시시각·ECOS 운영 cadence를 이 감사에서 확인하지 않아 ACT ON으로 올리지 않았다. 현행 pinned artifact는 not-collected이므로 이미 사용자에게 낡은 수급을 최신으로 보여 준다고 주장하지 않는다. freshness 정책과 운영 cadence 대조가 남는다.
- buildReferenceTickerMap의 중복 CUSIP overwrite 가능성을 검토했으나 현재 pinned reference에서 서로 다른 ticker 충돌 0개였다. 가상 충돌만으로 새 결함으로 올리지 않았다. reference/FIGI 상충 시 ticker 보류와 preferred/notes/warrants class 차단을 확인했다. 외부 FIGI 교차 검증은 하지 않았다.
- 기존 20261021 금융·거시 finding들은 이번 delta에서 관련 source가 실질적으로 고쳐지지 않은 경우에도 이전 보고서 근거로만 남는다. 이 실행은 index-earnings stale row, macro-read missing target lower, macro-crossroads missing term premium, page-flow small sample 기존 반례를 재실행한 인증이 아니다.

## 실행·한계

`node --experimental-vm-modules _artifacts/architecture-quality-audit-20261021-v5859/domain-probe.mjs` → exit0. SourceTextModule이 git show REF의 상대 dependency만 연결하고 외부 import를 거부한다. domain-probe-result.json에 반환값·log 기여·실제 회계말·KR 수급·reference 충돌 수·portfolio FX 비교를 남겼다. Node experimental warning은 VM 안내다. 실행 도중 고정 REF에 없는 root data.json/sec-fundamentals.json 경로 조회는 실패했으며 최종 probe는 모두 고정 Git 원문으로 exit0에 도달했다. synthetic 입력은 분명히 구분했다.

`node .../domain-ledger.mjs`의 SHA 비교 원장 생성 완료, 상태별 FULL5/FULL_DIFF_REVIEW8/DIFF_ONLY7/HASH_REUSED_PRIOR_REVIEW62/PARTIAL10, REQUIRES_DELTA0. 동작 probe에 assertion 성공을 임의로 붙이지 않았고 결과 자체가 반례다. 소스 전체 QA·외부 수치 대조·브라우저·배포 인증은 수행하지 않았다.

SAFETY FACT: probe가 고정 REF의 실제 domain만 실행함 — PROVED(격리 Git loader, 상대 import 제한). DuPont 인과 문장과 FY label 정직성 — DISPROVED(probe). 계좌 FX 통화 의미 — local/translated 회귀 차이 PROVED, UI 실표시는 별도 담당.

다음 조치는 D59-01 문장의 방향별 기여 구분과 D59-02 공통 fiscalYearLabel 재사용이다. commit/push/deploy 없음.
