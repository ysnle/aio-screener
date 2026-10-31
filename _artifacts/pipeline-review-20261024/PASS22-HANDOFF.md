# PASS22 — 포트폴리오 통화·현금·위험·원장 의미 계약

2026-10-30 연속 직접 검토. 제품 개선 없음. 전체 판독 12파일: src/domain/portfolio/{fx,cash,return-stats,asset-class,concentration,risk,look-through,checks,attribution,trade-journal,kr-stress}.js와 src/ui/panels/portfolio-risk-input.js. risk.js 큰 출력의 잘린 중간은 121–245/246–375/376–500/501–610 및 tail로 다시 판독. return-stats도 두 구간과 tail 재판독. checks의 앞부분 출력 누락은 재판독으로 보완. reproduce-pass22.mjs 8묶음 exit0, pass22-reproductions.json. 실제 사용자 원장·브라우저 실행 없음.

## P22-LEDGER-01 — 잘못된 외부 현금흐름을 버린 뒤 정확한 성과로 표시

assessAccountPerformance의 flows는 amount가 비수/음수이거나 date가 없으면 filter로 삭제한다. deposit amount='bad'와 평가액100→200을 주면 status=ready,twr=100%,twrExact=true. 거래 종류는 검증하지만 해당 거래의 필수 값 실패가 hold로 전파되지 않는다. 금액 null은 전역 isFinite(null)에 의해 0으로 들어갈 수도 있다. compatibility-globals는 이 함수를 공개한다. 실제 UI 입력 정규화가 해당 값을 막는지는 아직 전체 소비 경로 미검증.

개편: 외부현금흐름은 모든 행의 날짜·금액·통화·시점 유효성을 먼저 검증하고 오류 목록과 함께 성과 보류. 계좌 개설 후 무거래 기간은 transactions=[]여도 완전 원장 선언과 평가액이 있으면 계산 가능한 별도 상태로 고려(현재 무조건 ledger-not-available). 정확한 TWR과 경계 근사 TWR 분리는 이미 구현되어 있어 유지. 회귀: 잘못된/누락/음수 입금, 0입금, 기간 밖 실패행, 입금일 평가액 누락, 시작·종료일 입금, 통화 불일치.

IRR 탐색은 [-.9999,10] 고정이라 bracket 밖 해·여러 해·극단 손실은 미해결로 남는다. 경고 “구간 내 부호 변화가 없어”는 함수의 여러 null 이유를 포괄하지 못한다. 특정 해를 지어내지 않고 보류하는 동작은 정상이며 원인을 분리할 것.

## P22-RISK-01 — 수익률 값 검증 없이 ready

deriveRiskEstimate는 배열 존재·길이만 검사하고 요소의 유한성·가격수익률 하한·날짜 순서/실제 달력일을 검사하지 않는다. [NaN,.1]은 ready와 NaN publishedReturns. portfolio-risk-input도 historyMap의 값 나눗셈을 직접 수행한다. commonDates 구성 upstream이 정상값을 보증하는지 전체 backtest 경로 검토가 추가로 필요하므로 현재 사용자 계좌에 NaN이 보인다고 단정하지 않는다.

개편: 공통 return panel에 날짜·통화·가격종류·유효수치 계약을 두고 실패행을 명시. 단순 배열 tail alignment와 정렬 여부를 데이터 모델에서 해결. 회귀: 0/NaN/Infinity/-100% 미만, 불일치 날짜, 누락 중간 세션, 같은 길이 다른 기간, split 조정.

createCompositionSnapshot은 “immutable snapshot” 주석과 달리 객체를 freeze하지 않고 provenance/asOf 미래 여부도 직접 검증하지 않는다. 현재 UI는 allowedUse quote를 요구하고 기준 통화로 환산하므로 이 함수만으로 라이브가격 보호가 없다고 확대하지 않는다. 동일 ticker 여러 lot은 snapshot member에 중복으로 남지만 targetWeights는 symbol당 하나라 전략 경로의 정확한 member-count 검사에 막힐 수 있다. 현재 구성 경로의 lot 합산 보강은 정상이다.

## P22-CASH-01 — 오류 잔액을 합계에서 조용히 제외

convertCashBalances USD100+KRW amount='bad', targetUSD 입력에서 ok=true,total100. null amount는 0으로 받아들인다. surface와 portfolio-risk-input이 소비한다. 정상 저장 UI가 오류 값을 만들지 않는지 별도 연결 검증 필요. 미확인 currency는 legacy 정책으로 목표통화와 같은 단위 취급하며, 이 예외는 추정 금지 원칙과 다르므로 마이그레이션을 명시적으로 설계해야 한다.

개편: 원본 잔액별 유효/없음/오류/환산보류를 남기고 어느 하나라도 미확정이면 전체 total을 보류한다. 이미 계산된 부분합은 부분합으로만 제공. appFx는 전달된 rate만 사용하고 convert 시각 기준 재검증하지 않는다(정상 appUsdKrwClose 생성기가 제한). 생성 후 장시간 보관 재사용 회귀 필요.

## P22-FX-01 — 오래된 direct가 최신 inverse를 가림

resolveFxRate는 direct 존재 시 inverse를 후보로 보지 않는다. USD→KRW2020년 + KRW→USD2026년10/29 입력은 최신 역산이 가능해도 rate-stale. 가격을 지어내지는 않지만 사용자에게 불필요한 환산 보류. normalizeFxLegs는 같은 방향 중복을 제거하지 않아 import 데이터에서는 첫 행이 승리한다.

개편: 동일 통화쌍 선언의 충돌 정책을 정의하고 시각·유효성 기준으로 선택, 충돌이면 이유를 표시. 임의 삼각환산을 하지 않는 현재 정책은 정상. listingCurrency의 exchange suffix 기본값과 asset-class/trade-journal의 별도 USD fallback은 통일 검토(일본/홍콩/유럽 상장과 US share class 회귀).

## P22-STATS-01 — 결측 시각·무변동이 검증됨/무상관으로 승격

_btVarOrderAudit([.1,.2],unspecified,[null,null])는 Number(null)=0으로 verified. _calcDailyReturns는 Infinity를 유효 양수가격으로 보고 비유한 수익률을 생성한다. _pearsonCorr 무변동은 정의되지 않은 상관인데 0을 반환한다. _calcCorrelationMatrix는 날짜 없이 길이 짧은 tail끼리 맞춘다. 날짜를 이미 정렬·교집합한 caller인지 구분해야 한다.

개편: 결측/유한/시각 중복을 타입 정규화 단계에서 구분하고 상관 미정은 null과 원인 제공. return 함수는 거래일 식별을 함께 보존. 10일 이내 간격을 모두 단일 일수익률로 간주하는 현재 holiday 완화는 휴장과 누락을 구분하지 못하므로 calendar 기반 인접성 검증으로 보강. VaR bootstrap/민감도는 재현 가능한 내부 안정성 검사이며 미래 손실 확률 보증으로 “certified”를 설명하지 않도록 소비 문구 검토. CVaR 안정성·VaR 안정성을 별개 반환하는 보강은 정상.

## P22-LOOKTHROUGH-01 — 입력 순서에 따라 섹터가 달라짐

lookThrough는 첫 add의 sector를 유지한다. 직접 NVDA sector=null을 먼저 넣으면 뒤의 SPY 구성원 Technology가 있어도 Unclassified, SPY 먼저면 Technology. 같은 포트폴리오를 입력 순서만 바꾸어 섹터 결과가 바뀌는 재현. 종목/기업 합산 비중은 맞더라도 섹터 위험 설명은 달라진다.

개편: 확인된 sector의 출처·우선순위를 정하고 unknown을 이후 검증값으로 보강. 서로 다른 유효 sector 충돌은 명시. SP500 totalWeight가 실제 members 합과 다를 경우 펼친 가치의 합이 원래 ETF 가치와 일치하지 않는 추가 경계 후보. 구성일 freshness, 누락 비중, 주식클래스 정규화도 같이 검사. ETF 전체를 단일회사로 부르지 않는 기존 checks는 정상이나 모든 ETF가 다회사 분산이라고 단정하면 단일종목 ETF를 놓칠 수 있다.

## 기타 직접 판독 결과와 후속 강화

- asset-class: 자체 listingCurrency는 KR 외 모두 USD로 처리하여 fx.js의 일본/홍콩/미확인 suffix 방어와 다르다. bond/stock map은 같은 ticker 여러 row를 마지막 비중으로 덮어쓰지만 bondPct는 전부 더하므로 상관의 구성 비중과 표시 비중이 다를 수 있다. 미등록 bond ETF·금/원자재 ETF가 stock sleeve로 들어가므로 “주식 부분” 명칭의 범위가 과도한지 확인. 상관은 현재 가중치로 과거를 보는 가상 경로임을 유지. 관측 없음/80%coverage/주수 부족 보류는 정상.
- concentration: held 항목 제외 분모를 partial로 표시하고 cost를 시장가 대체로 쓰지 않는 보호는 정상. 총액 override가 과도하게 크면 합100% 미만은 감지하지 않으며 문구는 invested-sleeve지만 override에 현금이 섞일 가능성은 caller 계약으로 명확화. provenance 없는 pure 입력은 호출자 책임이라 live 인증으로 취급하지 않는다.
- checks: shareHeld는 미평가 종목의 개수만 보고 절반 미만이면 평가된 부분의 쏠림을 판정한다. 미평가1개가 압도적인 자산일 수 있으므로 전체계좌 verdict와 계산된 부분 비중을 분리. currency/sector 카드에도 같은 불확실성 전달. 규칙의 주의 band는 내부기준으로 표시되어 있음.
- attribution: stock/index 마지막 날짜 일치를 강제하지만 sector ETF 마지막 날짜는 검증하지 않는 기존 지적 유지. usdkrwAsOf를 undefined로 생략하면 FX기간 일치 검사를 생략한다. 전체3개월 시작일/시장별 휴장 차이는 종료일만으로 보증되지 않는다. 현재 수량의 시작가치 역산 변경은 정상. 주석의 “현재 비중”과 실제 시작가치 비중은 문서 drift다.
- trade-journal: FIFO는 같은 날짜의 buy를 sell보다 먼저 정렬하므로 실제 장중 매도→재매수 순서가 반영되지 않는다. 순서 정보 없는 기록은 “당일 매수 선행 가정”을 명시. 부분 매도 하나가 여러 lot를 닫으면 n은 독립 거래수가 아닌 lot조각 수다. MIN_SAMPLE=10은 lot 분할로 쉽게 넘길 수 있다. journalReview는 small=true여도 승률%와 본전승률 설명을 먼저 생성한다(주석은 10미만 count-only). 통계 단위를 명시하고 같은 진입/청산 묶음의 비독립 표본을 따로 처리. 손익비 기반 본전 승률은 거래마다 같은 자본 가정이며 실제 계좌 통화손익 본전과 다르다. invalid fee는 0으로 대체, 잘못된 currency는 USD로 대체하는 입력 경계도 보강. 날짜 parse는 실제 존재 날짜 roundtrip 검증 필요.
- kr-stress: exact-session span과 최소10개 비중첩 창을 계산하는 보호 확인. worst 선택 자체는 겹치는 모든 유효 창에서 이루어지며 “역사상 최악”과 확률추정은 구별. KOSDAQ-only 계좌에도 KOSPI 가정인지 소비자 라벨 확인 필요. 현재 basis는 index beta1 가정 명시.

## 다음 연결 검토

portfolio surface·backtest·stress-sensitivity·portfolio-read 및 거래일지 UI/저장 경로를 이어서 판독해야 함수 경계 반례의 실제 도달 여부를 확정할 수 있다. PASS22는 포트폴리오 전체 완료 선언이 아니다. 제품 파일·public-data 수정 없음, 커밋·배포 없음.
