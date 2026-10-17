# 계산·재무 경로 심층 검토

기준: 시작 preflight v57.89 뒤 병행 변경된 작업 트리. 인벤토리 시점은 v57.90, 재개 시점은 v57.91이다. `financial-counterexamples-initial.json`에 최초 실행시각·모듈 SHA256·합성 입력 결과를 보존했다. 재개 때 6개 소스 hash가 전부 동일함을 확인하고 E08 통제 입력을 추가한 결과가 `financial-counterexamples.json`이다. 이 문서는 코드 리뷰와 격리 계산 증거이며 배포 결함 발생률 보고가 아니다. 아래 우선순위는 합성 입력이 실제 소비 경로에 들어올 때의 영향 기준이다. 기존 P 원장을 수정하지 않았다.

## E01 · 높은 우선순위 · 원가통화 충돌이 손익을 통과

`src/domain/portfolio/surface.js:267`은 원가통화 충돌을 row.currency가 명시된 경우에만 찾는다. 값의 통화는 listingCurrency로 USD까지 해석하지만 원가 KRW와의 충돌에는 같은 규칙을 적용하지 않는다. 기준 USD, 1주, 가격100, 평균원가140000, costCurrency KRW, FX 없음에서 손익 −139900과 −99.9286%를 발행했다. quote currency를 USD로 명시한 대조 입력은 손익 null로 보류했다. 단위가 다른 값의 뺄셈은 설명 문구로 고칠 문제가 아니다.

최소 개선: effective value currency와 원가통화를 같은 resolver로 비교하고 필요한 원가환산이 완료되지 않으면 손익·AI returnPct를 보류한다. 원가통화 입력 저장(aio-workspace.js:475–512)과 import 추가필드 보존(portfolio-backup.js:25–34)은 코드로 확인했다. 다만 실제 quote 통화 누락과 app-close FX 부재가 함께 발생하는 UI 상태는 미검증이다. runtime-readers의 통화 보충과 portfolio.js의 FX 전달이 평상시 이 경로를 막을 수 있다. `portfolio-read.js`의 보류 소비도 함께 확인해야 한다.

## E02 · 중간 우선순위 · 결과를 바꾸는 현금수익률이 identity에 없음

`src/domain/portfolio/risk.js:385`의 identityPayload는 cashTreatment를 기록하나 annualRate/observed cash series를 포함하지 않는다. 동일 snapshot에서 현금 연율0→10%를 바꾸면 publishedReturns는 `[0.08,0.08]`에서 `[0.0800756573,0.0800756573]`으로 바뀌는데 estimateId는 `pfre-02828885de5cfabf`로 같았다. 같은 ID가 같은 계산 입력을 뜻한다는 내부 계약을 위반한다. 캐시·재현 비교에 사용되지 않는 소비자라면 사용자 영향은 작을 수 있다.

최소 개선: 실제 소비한 현금수익률/series만 canonical identity에 포함한다. 결과에 쓰지 않은 선언까지 무조건 넣을 필요는 없다. 현행 소비자에서 이 ID 때문에 캐시가 잘못 재사용되는 사례는 확인하지 않았다. 계산 재현 identity 충돌까지 확인했다.

## E03 · 높은 우선순위 · 주식 부분 수익률에 현금 비중이 섞임

`risk.js:311–316`은 주식 목표비중 합0.8을 sleeve에도 그대로 전달한다. 한 주식이 매일10% 오르고 현금수익률이 미선언일 때 publishedScope는 invested_sleeve지만 daily 결과는 `[0.08,0.08]`, buy-and-hold는 `[0.08,0.10]`이었다. 주식100% 목표 대조는 `[0.10,0.10]`이다. 첫날 이후 정상화 여부까지 정책에 따라 달라져 같은 ‘주식 부분’의 정의가 변한다.

최소 개선: sleeve는 주식 내부 합1 비중으로, whole account는 원래 주식+현금 비중으로 각각 계산한다. UI 입력 조립기(portfolio-risk-input.js:146–157)도 합100% 미만을 현금 잔여로 허용한다. daily·buy-and-hold·월간 경계 및 현금수익률 유무를 함께 대조해야 한다. 기존 P1200 fixture는 scope·현금 잔여는 검사하지만 이 수익률 반례를 잡지 못한다.

## E04 · 높은 우선순위 · 단일 외화 보유 계좌의 FX 누락 표지 없음

`src/ui/panels/portfolio-risk-input.js:175–176`은 통화 종류 수가1이면 외화 여부와 관계없이 returnCurrencyBasis를 기준통화, fxIncluded를 null로 둔다. USD 주식 하나·KRW 기준·현시점 환율 leg가 있으나 과거 FX가 없으면 USD local return1%를 반환하면서 출력 metadata의 returnCurrencyBasis를 KRW로 발행했다. 같은 입력에 일별환율을 추가하면 return2.5538%로 바뀌어도 두 표지는 여전히 KRW/null이었다. aio-workspace.js:1152의 경고 조건 fxIncluded===false를 통과하지 않는다. 실제 DOM 표시·발생은 이번 합성 실험으로 검증하지 않았다.

최소 개선: 통화 종류 수 대신 기준통화와 다른 보유통화의 존재·실제 환산 여부를 발행한다. USD-only/KRW-base와 역방향을 모두 확인한다.

## E05 · 높은 우선순위 · 연간 이익에 분기 EPS를 결합

`src/domain/fundamental/sec-normalize.js:495–498`은 FY/end/form을 검사하지만 EPS 시작일·duration을 검사하지 않는다. 동일 10-K/FY/end/filed에 연간 EPS1과 Q4 EPS0.2를 넣고 순서만 바꾸면 연간 NI100의 추정 주식 수가100→500, PER10→50으로 바뀌고 두 결과 모두 consistent였다. 이는 provider 실제 발생 빈도와 별개로 재현되는 순서 의존 결함이다. SEC fact의 fp가 FY라는 것만으로 해당 값이 1년 duration이라는 뜻은 아니다.

이 합성 입력은 직접 주식 수 fact가 없어 eps-implied fallback을 사용했다. 직접 주식 수가 있는 경우는 별도 사용·scale-mismatch 보류 경로가 있다. 최소 개선: 연간 revenue와 EPS의 시작·종료 기간 일치를 검사하고 annual duration을 요구한다. 희석/기본 EPS·클래스 주식 귀속은 별도 축으로 유지한다. 실제 SEC fact 공존 사례 대조는 아직 수행하지 않았다.

## E06 · 중간 우선순위 · VaR 안정성 검사를 CVaR까지 확장

`return-stats.js:88–104`의 bootstrap·민감도는 VaR만 계산한다. 100개 수익률에서 손실2%가 매3번째 등장하는 표본은 VaR2%/CVaR2%로 certified다. 그중 최악 한 관측만 −90%로 바꾸면 VaR2%/CVaR4.5882%인데 여전히 certified다. 이것만으로 CVaR가 통계적으로 불안정하다고 증명한 것은 아니다. **CVaR의 안정성을 측정하지 않고도 그 인증 범위를 포함하는 자기 설명**이 문제다. 현행 cutoff 이하 모든 동률을 tail에 넣는 구현은 정확한 5% 질량 기반 expected shortfall과도 구분해 정의할 필요가 있다.

backtest.js:903–905가 실제로 ‘VaR/CVaR … 인증됨(표본 안정성 통과)’ 문구를 발행한다. 최소 개선: 인증 이름을 현재 측정하는 VaR로 한정하거나 CVaR 별도 불확실성·민감도를 추가한다. 임계값 공개가 임계값의 통계적 정당성까지 보증하지는 않는다.

## E07 · 중간 우선순위 · 은행 FCF 비교 보류의 비대칭

`src/domain/fundamental/peer-read.js:68–78`은 대상 회사가 lending financial일 때만 FCF 순위를 보류한다. 합성 동일기간 자료에서 Visa를 대상, 은행5개를 peers로 주면 FCF마진20%, 은행 중앙값50%, percentile0/n5를 발행했다. JPM을 대상으로 하면 동일 메트릭을 금융사 비교 불가로 보류했다. 은행 OCF−capex를 산업 FCF로 비교하지 않는 자체 원칙은 peer 쪽에도 적용돼야 한다.

실제 fiscal-read.js:197–198 소비자도 같은 sector·history 존재만으로 peers를 조립해 이 비대칭을 차단하지 않는다. 합성 수치는 실제 Visa·은행 실적이 아니다. 최소 개선: 메트릭별 peer 적격성을 평가하고 비교 가능한 모집단·n을 발행한다. 금융 섹터 전체의 사업모델 차이도 단순 섹터 비교의 한계로 설명한다.

## E08 · 중간 우선순위 · 희소 평가액의 경계가정 수익률을 실제 TWR로 명명

`risk.js:538–554`은 평가액 사이 모든 현금흐름을 시작 또는 끝에 일괄 배치한다. 연초100·연말160·중간입금50 입력은 입금일이2월이든12월이든 TWR10%다. 실제 입금 시점의 평가액이 없으면 정확한 시간가중 수익률은 유일하게 정해지지 않는다. 일자 기반 MWR가 다르다는 사실 자체는 버그가 아니다. 시작/끝 규약은 UI와 결과에 이미 공개된다. 다만 기간 내부 흐름을 해당 경계에 배치한 근사임을 설명하지 않고 ‘실제 계좌 성과 TWR’로 명명한다. 선언한 경계모형의 산술 자체는 맞는다.

독립 검토가 최초 withMidValuation 실험은 입금일도 달라 엄밀한 단일변수 대조가 아님을 지적했다. 기존 JSON은 별도 보존하고, 같은6/30 입금일의 coarseSameDate 대조를 추가 실행했다. 평가액을 연초100/연말160 두개로 주면10%, 입금후6/30 평가액150을 추가하면6.6667%며 MWR는 둘 다8.0089%다. 추가 평가 정보에 따라 TWR가 달라질 수 있음을 보여주며 최초 두 평가액만으로 어느 값이 실제 참인지 인증하지 않는다.

최소 개선: 외부흐름 시점별 평가액으로 subperiod를 만들거나 근사/가정 수익률임을 표시한다. 일별 가중 근사법도 선택 가능하며 모든 계좌에 GIPS 준수를 강제할 이유는 없다. [GIPS 공식 handbook](https://www.gipsstandards.org/standards/gips-standards-for-firms/gips-standards-handbook-for-firms/)은 true TWR의 일별 또는 각 외부 현금흐름 시점 평가·기하연결과 근사법을 구분한다. 이 자료는 정의 대조용이며 앱에 대한 법적 적용 판단이 아니다.

## 모듈 전수 읽기

| 모듈 | 전문 검토한 내용·잔여 경계 |
|---|---|
| portfolio/attribution.js | 항등식·FX역수·종목/지수 종가일 보류; 섹터ETF 날짜 검사는 별도 없음 |
| portfolio/backtest.js | 조정종가·공통월말·연속그리드·부분연도·RF보류; E06 인증범위 |
| portfolio/cash.js | 통화잔액·leg·app close·보류; 약8일 고정 FX 창의 타당성 별도 |
| portfolio/checks.js | 미확인분모·ETF·환산위험 구분; 통화/지역 정의 외부검증 별도 |
| portfolio/concentration.js | 원가대체금지·음수/결측·가격확인 부분집합 공시 |
| portfolio/fx.js | 직접/역수 leg·미래/오래된 관측 보류; 제한된 접미사 외 USD 해석 |
| portfolio/kr-stress.js | session span·beta1가정 표기; 실제 비중첩 유효 창 수는 별도 |
| portfolio/portfolio-read.js | 분모·국가구분·AI금액제거; E01 returnPct 전파 경계 |
| portfolio/return-stats.js | 연율화·R7·시간순서; E06 |
| portfolio/risk.js | snapshot·현금·전략·TWR/MWR; E02/E03/E08 |
| portfolio/surface.js | 평가·현금·원가 환산·보류; E01 |
| fundamental/consensus-read.js | 추정/가격나이·미일자가격 보류; −30% basisGap 휴리스틱 잔여 |
| fundamental/fiscal-read.js | 같은FY·평균자본ROE·TTM/연간; 실제split확인없는 비율추론 경계 |
| fundamental/peer-read.js | 연간간격·기간차이·최소n; E07 |
| fundamental/period.js | 결측·동일기간·연간간격; FPI까지90일 유예 일반화 한계 |
| fundamental/quarter-read.js | 전년분기·파생Q4; 결측YoY 제거 후 최근방향 연속성 미보장 |
| fundamental/sec-normalize.js | taxonomy/통화·IFRSratio-only·bank/class shares; E05 |
| fundamental/sec-report.js | healing·PIT; 신규 IFRS/통화 정책 적용의 호출 경계 별도 |
| fundamental/sec-row-fields.js | shares trust·기간나이·metadata; now 기준과 ratio floor는 정책 |
| fundamental/sic-sector.js | SIC 고정매핑·unmapped null; SEC SIC와 앱 섹터 변환 구분 |

소비자·fixture는 portfolio-risk-input 전문, portfolio-ledger normalization/writer, aio-workspace 성과/위험/AI, fiscal-read UI/peer, company-analysis 전문, fiscal-quality fixture 전문, review-integrity/ESM/data-pipeline 관련 fixture 범위를 읽었다. 그 외 UI 전체·모든 테스트를 완독했다고 주장하지 않는다. 기존 감사 F04 MWR boundary와 F08 하락추세 분모는 수정된 코드가 확인되어 이번 신규8건에 포함하지 않았다.
