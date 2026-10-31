# PASS19 — SEC 정규화·재무 해석·종목 소비 계약

2026-10-29 연속 직접 검토. 에이전트 사용 없음. 제품/생산물 수정 없음. 아래는 코드 의미 검토이며 운영 인증이 아니다.

## 범위와 실행

전체 판독 14파일: `src/domain/fundamental/{period,sec-row-fields,sec-normalize,sic-sector,sec-report,quarter-read,consensus-read,fiscal-read,peer-read,analysis-read,stock-lens,sec-statements}.js`, `src/domain/entity/{kr-fundamentals,summary-hydration}.js`. sec-earnings는 기존 직접 판독 기록이 있다. 출력이 잘린 sec-normalize는 1–145/146–300/301–445/446–595/596–끝으로 다시 나눠 확인했다. 다른 큰 파일도 구간별 읽기 완료. 부분 소비자: stock-lens-cards의 stockLensContext, fundamental-analysis-cards 역DCF·현금 카드, producer/screener 및 build-sec-runtime-projection 연결 검색. 부분 파일은 FULL로 세지 않는다.

`reproduce-pass19.mjs` 실행 exit0, 8개 반례 묶음은 `pass19-reproductions.json`. 외부 SEC/FRED/Yahoo 요청, 생산자 실행, 브라우저 실행 없음. 실제 데이터의 빈도와 화면 도달 여부는 아래처럼 나눈다.

## 발견 및 개편 제안

### P19-PERIOD-01 — 종목 렌즈에서 누락 회계연도를 전년으로 비교

stock-lens.js metricValue는 최근 두 revenue>0행을 그대로 나눠 FY 성장률·전년 capex·평균자본 ROE·‘1년 전’ 마진을 만든다. fiscal-read/peer-read는 isPriorAnnualPeriod를 적용한다. 2022매출100→2025매출200 반례에서 fiscal-read.lastGrowth=null이지만 lens는 FY2025 +100%를 반환한다. stock-lens-cards:76은 이 함수에 fiscal history를 직접 전달한다.

영향: 동일 회사의 공시 화면과 읽는 법 카드가 다른 기간 의미를 전달. 개선: 모든 전년 비교에 공통 annual pair 판정을 적용하고 누락 시 기간 누락으로 표시. 여러 해 총변화/CAGR는 별도로 명명한다. 회귀: 1년/2년/3년 간격, 52/53주, 유효매출 없는 중간 연도, prior equity 결측. 분기/TTM과 FY의 성장 속도 비교 역시 창이 다름을 유지.

### P19-PEER-01 — 모두 같은 값도 ‘1위·강점’

stock-lens.js buildPeerStrengths는 ordered.indexOf(value)+1로 동률 순위를1로 잡고 side=0이면 strengths에 넣는다. 자기 포함4개 모두 growth10에서 강점1건, rank1 재현. 문장에는 중앙값과 같다고 쓰면서 강점으로 분류한다. 해당 함수는 stock-lens-cards:70 활성 경로다.

개선: 표시 공동순위와 강점/약점 판단을 분리한다. 중앙값과 같은 값은 중립, 또는 midrank/tie interval로 상대위치를 산정한다. 동률 전체/부분 동률/4개 최소 표본/반올림 동률을 검증. 데이터 없는 metric을 일반적 강점으로 확대하지 않는다.

### P19-DCF-01 — 날짜 형식만 맞으면 오래된 종가로 ‘지금 가격’ 역산

analysis-read.js reverseDcfInputs는 연간자료와 shares 관측 기간을 검사하지만 close는 양수와 날짜 형식만 확인한다. 최근 FY 입력 + 1990종가 → ready 재현. fundamental-analysis-cards:130과 stock-lens-cards:68이 소비하고 결과 문구는 ‘지금 가격/시가총액’이다. 카드에 종가 날짜는 표시되므로 날짜 자체 은폐라고 쓰지 않는다.

개선: 완료 세션·가격 기준·현재성 계약을 공유하고 오래된 가격은 날짜 있는 역사 가정으로 전환하거나 현재 역산을 보류한다. 같은 함수가 sharesCheck=scale-mismatch인 양수 shares도 허용하는 반례는 별도의 방어 후보다. 정상 normalizer는 해당 수량을 null로 내보내므로 scale-mismatch 수량의 실제 도달은 미확인. 회귀: 오래된/미래/장중/미완료 종가, 검증 실패 shares, split 이후 가격·수량, 잘못된 발행자·통화.

### P19-FISCAL-01 — 0변화를 감소, 0현금을 유출로 서술

fiscal-read 성장 streak=0은 감소로 표현한다. 매출100→100에서 tone neutral·+0%와 ‘직전 해보다 줄었습니다’가 공존. cash는 NI=0/OCF=0도 ‘순손실과 영업현금 유출… 한쪽이 마이너스’로 표시한다. 양수/음수 분기가 0을 처리하지 못한 명확한 반례다.

개선: 감소/보합/증가, 순손실/손익분기/흑자, 유출/0/유입을 분리한다. 회귀는 3×3 부호 조합과 flat band 양 경계를 포함. 단일 FY fallback은 growth=0도 favorable라 공통 flat band와 다르다. latest period 없는/미래인 방어도 별도 강화 필요.

### P19-CONSENSUS-01 — 가격 위치를 가격 방향으로 단정

consensus-read는 고점 대비−10% 이하면 priceDir=down, −5% 이상이면 up으로 놓고 최근4주 전망 수정과 ‘같은/반대 방향’이라고 말한다. 고점 대비−20%, 최근1개월+20%, 전망 상향3의 fixture도 ‘반대 방향’. 가격 위치만으로 해당 기간 움직임의 방향을 알 수 없다.

개선: 같은4주 가격 변화와 revision 기간을 맞추거나 ‘고점에서 떨어진 위치지만 전망 상향’처럼 위치만 설명한다. 동일 기준 조정 EPS 여부를 growth≤−30% 휴리스틱 하나로 확인했다고 보지 말고 source basis를 전달. 미래 priceDate는 현재 freshness 조건을 통과하는 추가 방어 후보(P17 index-earnings와 동일 결함 계열). up/down 결측을0으로 바꿔 ‘변경 없음’으로 만드는 경로도 관측 범위 필요.

### P19-CASH-01 — 일부 반환액을 합계로, 장기부채 차감을 순부채로 명명

analysis-read buildMarginCashRead는 buybacks나 dividends 한쪽만 있으면 다른쪽을0으로 더하고 returnedShareOfFcf를 만든다. fixture buybacks20/dividendsnull→returned20. UI fundamental-analysis-cards:367은 이를 ‘매입과 배당 합’이라 한다. 공시되지 않은 항목이0임을 입증한 것은 아니다.

cash.net은 liquid−longTermDebt이며 stock-lens netCash는 단순 ‘순현금/순부채’라고 부른다. SEC normalizer longTermDebt는 Noncurrent/LongTermDebt 후보, runtime의 압축 이력에는 debt concept이나 currentDebt가 없다. sec-statements는 별도로 currentDebt를 더하고 debtBasis를 노출하므로 화면 간 범위도 다르다. 현금 카드 본문은 ‘대 장기부채’라고 한정하므로 그 설명까지 누락됐다고 주장하지 않는다.

개선: 보고됨/미공시/미수집/확인된0을 유지하고 부분 합은 ‘확인된 항목 합’. debt scope를 값과 함께 전달해 ‘현금−장기부채’라고 표시하거나 동일 날짜 총차입금을 수집·합산한다. 회귀: 한쪽만 공시, 둘 다0, current-only/noncurrent-only/total, 현금·단기투자 결측, 기간 불일치.

### P19-PIT-01 — 역사 선택 API가 통화·외국주식 기준을 유실(현행 제품 호출 미확인)

sec-report selectSecFundamentalsAsOf는 native-currency pit를 읽으면서 reportingCurrency/pit.currency를 결과에 보존하지 않고 priceAsOf로 PE/PB를 만든다. EUR/20-F fixture에서 USD가격100과 EUR이익100/ordinary shares100을 결합해 PE100. 정상 정규화/현재값 경로는 non-USD/20-F 가격 비율을 보류한다. 검색에서 이 역사 API의 호출은 현재 gate들에만 확인됐으므로 라이브 화면 결함으로 승격하지 않는다.

개선: 역사 재구성에도 현재와 동일한 통화·주식 class·규모 검증 적용, 가격에는 단위/시점 메타를 요구. EPS/common/TTM·margin hold 정책도 current selector와 차이가 있으므로 의도한 역사 정책을 명시. 회귀: EUR/IFRS/20-F/40-F, scale mismatch, 개정공시 전후, filing-date-only 시각 정책. pointInTimeStatus가 revenue 수락시간만 보고 전체 accepted-time처럼 보일 수 있는 범위도 문서화.

## 추가 후보·정상 경로·한계

- sec-row-fields는 미래 observedAt/filedAt에도 CURRENT를 반환(2099/2100 fixture). sec-report freshness는 미래를 거부한다. 생산자 현재 파일의 실제 미래 행 여부 미검증이며 방어 계약 불일치로 분류. age filter는 nowMs, quality는 factorSessionDate 기준이라 역사 replay에서 다른 판단 가능.
- SEC normalize는 동일통화·taxonomy 선택, 은행 매출의 같은 accession 합성, 외국 ordinary shares 보류, share count/EPS cross-check, 발표 가능 시점 별도 보존을 수행한다. 다만 split을 near-integer 주식 수 변화로 추정하며 합병/대규모 발행도 후보가 될 수 있다. 직접 split 사건 근거를 소비하는 설계로 보강 제안. 실제 오판 사례는 미확인.
- sec-statements는 bank derived revenue를 목록에 넣지만 rowsOf는 실제 XBRL concept만 읽으므로 normalizer의 은행 합성 매출과 동일하지 않다. IFRS bank fee subtotal 제외 정책도 동일 함수가 아니다. 금액 row의 서로 다른 기간을 metrics에서 함께 노출하는 부분, stale/future acceptance는 별도 연결 검증 필요.
- quarter-read는 yoy 결측을 제거한 뒤 마지막3개로 추세를 말하므로 비연속 분기가 연속 추세로 읽힐 수 있다. fiscal-read shares.length−1을 년 수로 표기하는 부분도 연도 누락을 고려해야 한다. 생성된 압축 이력의 결측/중복과 결합 검증 예정.
- buildThemePeers는 기본 peer-read의 12개월 비교 범위/대출금융 FCF 제외를 적용하지 않는다. theme mix·오래된 회계연도·다른 factorSessionDate가 strengths에 들어갈 수 있다. buildLensRead 역시 consensusView의 freshness를 거치지 않는 raw consensus를 받는다(stockLensContext 확인). 공통 metric eligibility를 공유하고 화면별 우회 경로를 테스트할 것.
- lens financials는 일반 sector/SIC로 은행 lens를 선택해 카드결제·보험 등과 대출금융 분류가 다를 수 있다. isLendingFinancial 예외와 lensIdFor를 합의한 분류표로 정리해야 한다.
- stock-lens thesis는 역DCF의 할인율/영구성장률 가정을 같은 문장에 보존하지 않고 ‘지금 가격은 연x% 가정’으로 축약한다. 원 카드에는 가정 표시·민감도 조절이 있으므로 그것을 유지하는 파생 텍스트 계약이 필요. ‘상대강도=수급 방향’ 단정은 PASS17 가격→자금흐름 이슈의 추가 소비자.
- impliedGrowth finite/range 방어 및 buildTrailingYearRead의 숫자문자열 합산은 정상 UI/파서에서 제한될 가능성이 있어 API 방어 후보. dcf 모델 자체의 경제적 타당성을 본 코드 판독만으로 인증하지 않는다.
- kr-fundamentals는 원화·연결/별도·기말ROE·접수번호를 명시. prior year/basis 확인은 생산자 책임이므로 DART 경로와 계속 대조할 것.
- summary-hydration은 symbol identity, 미래 bar 제외, 오늘 종가 마감20분 확인, abort/revision, 20개 캐시/실패30초, KR previous-close 검증 hook을 갖춘다. 원시 close 기반 history와 조정종가 기반 다른 소비자가 beta/성과에서 섞이는지는 caller 계약 검증 필요. 현재성은 수집시간 캐시 TTL과 실제 quote 관측시간을 분리해야 한다.

미완료 목록을 남기는 것은 전체 완료 선언이 아니다. 남은 domain/UI/producer/workflow/문서·자료 연결을 계속 직접 검토한다. 이번 문서·fixture 추가 이후 전체 QA는 아직 재실행하지 않았으며 앞선 qa-runner-behavior 실패는 PASS18에 기록돼 있다.
