# 11 — 저장 성공과 포트폴리오 금액의 의미

Astra 조사·설계 · v56 working tree · 2026-09-20. 실제 사용자 보유내역·키·암호문을 읽지 않았으며 모두 코드/합성 입력만 사용했다.

## P11-01 / W11-A — 메모리 반영과 영구 저장 성공 분리

`js/aio-workspace.js:238` savePortfolioData는 runtime cache를 먼저 갱신하고 safeLS promise를 반환/await하지 않는다. 실패는 로그로 처리하고 portfolioChanged를 즉시 dispatch한다. addPosition 경로(:397–412)는 직후 폼을 지우고 ‘브라우저에만 저장됨’ 완료 toast를 표시한다.

safeLS를 quota 실패 stub으로 교체한 격리 실행에서 반환 promise 없음, portfolioChanged 발생, runtime만 새 값, 실패 로그가 재현됐다. [증거](portfolio-save.json). 실제 저장소를 건드리거나 실제 데이터 손실을 일으킨 시험이 아니다.

설계: repository write가 durable acknowledgement를 반환하게 하고 UI가 완료를 await한다. saving/dirty/failed/saved 상태를 분리한다. optimistic 화면을 유지할 수 있지만 failed 상태에서는 새로고침 시 사라질 수 있음을 명확히 표시하고 재시도·내보내기·되돌리기를 제공한다. 폼 입력은 저장 성공 전 버리지 않는다.

한 포트폴리오 write를 직렬화하고 revision 기반으로 오래된 비동기 encrypt 결과가 최신 상태를 덮어쓰지 못하게 한다. 여러 tab 충돌은 사용자에게 충돌로 드러내며 덮어쓰기 정책을 명시한다. 현재 코드에서 경쟁으로 실제 역전된 저장은 아직 재현하지 않았으므로 예방 인수조건이다.

인수: quota 초과, privacy mode, 암호화 실패, 잠긴 Vault, 연속2회 저장, 오래된 promise가 나중에 완료, 재진입/새로고침, tab 충돌. 실제 비밀 대신 전용 synthetic 브라우저 profile을 사용한다. 제품 코드 수정은 구현 에이전트가 담당한다.

## P11-02 / W11-B — 통화 없는 합산을 완전한 평가로 표시하지 않기

normalizePortfolio는 holding.currency/baseCurrency를 보존하지 않는다. derivePortfolioSurface는 수량×가격과 cash를 같은 단위로 합산한다. 합성 USD100+KRW70000 입력은 currency를 잃고 totalAssets70100, valuationState=complete를 반환했다. [증거](portfolio-currency.json).

single-currency 전제라면 함수 입력에서 다른 통화를 거부해야 하고, 다중통화를 지원한다면 변환해야 한다. 현재 추가 UI가6자리 국내 ticker를 허용하는 점을 포함해 실제 국내 quote identity→price→portfolio 연결을 더 추적해야 한다. 이번 합성 결과를 실제 사용자 화면에서 혼합통화 자산이 이미 오평가됐다는 주장으로 확대하지 않는다.

설계: position에 instrumentId, venue, priceCurrency, costCurrency, quantityUnit을 보존한다. account의 baseCurrency와 cashByCurrency를 둔다. FX leg의 pair convention, observedAt, source, rate와 valuation cut을 명시한다. base value는 변환 근거가 있을 때만 계산하고 원화/달러 원래 금액을 유지한다. 거래가격의 역사 FX와 현재 평가 FX를 섞어 손익을 계산하지 않는다.

첫 구현은 단일통화 검증/보류로 작게 닫을 수 있다. 다중통화 전면 구현이 전제는 아니다. 단, currency 미확인은 USD라는 뜻이 아니며 symbol만 보고 자동 추정하지 않는다. ADR/보통주·우선주·share class·split 이후 수량·채권 lot/계약승수는 별도 instrument registry 계약이다.

인수: USD만, KRW만, 혼합+FX없음, 혼합+FX유효, FX역수, 오래된FX, 서로 다른 cost currency, 현금 통화 혼합, quote currency 미확인. totals/weights/sector/concentration/AI context가 같은 base value를 사용해야 한다.

## 이미 확인한 보호 경계와 남은 프라이버시 조사

createPrivacyVault는 encryptedAtRest capability가 없으면 disabled다. 실제 portfolio는 별도 legacy AES-GCM Vault 경로를 쓴다. portfolio AI에는 session consent와 allowlist/redaction 함수가 있고 chat history는 opt-in이다. 이 사실만으로 모든 전송·로그·export 경로의 안전성을 인증하지 않는다.

추가 조사: lock 후 모든 UI/state/AI context memory 제거, journal별 전송 동의, BYOK/server relay 경계, export/import의 원문 노출 고지, 잘못된 PIN·새 salt 저장 실패·session public mode, 자동 로그의 민감정보 제거. 실제 자격증명이나 개인자료 없이 코드와 synthetic fixture로 검증한다.

## 2026-09-23 R24-06 통화 end-to-end 계약

[현재성 표](25-CURRENT-FINDING-STATUS-CROSSWALK.md)는 P11-02의 통화 합산 반증에 대한 P1175 부분 구현과 이 문서가 보강하는 reader→UI 잔여를 분리한다. 첫 end-to-end 전환의 선행 순서와 E3 인수는 [26 실행·인수 계획](26-EXECUTION-AND-ACCEPTANCE-PLAN.md)에 둔다.

R24-06은 `currency`라는 필드 하나를 normalizer에 추가하는 작업이 아니다. 통화가 Vault write/read, provider, normalizer, 도메인 평가·손익·위험, selector/ViewModel, holdings table·totals·AI context까지 같은 뜻과 provenance로 이동해야 한다. 감사에서 확인된 reader/provider/normalizer의 정보 손실과 `surface.js`에서 원가와 시장가를 통화 검사 없이 빼는 경로는 정적 근거이며, 이번 문서 보강은 실제 사용자 계좌가 잘못 평가됐다는 증거를 추가하지 않는다.

### 타입과 계산 경계

제안하는 의미 계약은 다음과 같다. 금액은 숫자 하나만 전달하지 않고 금액·통화·출처·관측 또는 적용 시각을 함께 보존한다.

```ts
type Money = {
  amount: number;
  currency: string;              // ISO 4217 또는 명시적으로 등록한 단위
  observedAt?: string | null;
  sourceRevisionId?: string | null;
};

type FxObservation = {
  baseCurrency: string;
  quoteCurrency: string;
  quotePerBase: number;           // 예: USD/KRW = 1400 means 1 USD = 1400 KRW
  observedAt: string;
  fetchedAt: string;
  sourceId: string;
  revisionId: string;
  qualityStatus: string;
  rightsId: string;
};

type PortfolioValuationCut = {
  baseCurrency: string;
  asOf: string;
  fxPolicyId: string;
  maxObservationAgeMs: number;
  priceAndFxRevisionIds: string[];
};
```

계좌는 `baseCurrency`를 명시하고 현금은 통화별 `cashByCurrency`로 보존한다. 각 보유는 canonical `instrumentId`, listing/venue, quantity와 quantity unit, cost basis `Money`, market price `Money`를 각각 유지한다. `costCurrency`, `priceCurrency`, 계좌 `baseCurrency`, cash currency는 서로 다를 수 있다. ticker 문자열, 현재 시세 통화, 사용자의 locale로 통화를 추론하지 않는다.

FX 경로는 입력 통화→계좌 기준 통화의 방향과 각 leg를 저장한다. 직접 pair와 역수 pair의 방향을 분명히 하고, 역수는 유한한 양수 rate에 한해서만 계산한다. triangulation을 지원하면 통화 경로와 leg별 source/revision/observedAt을 모두 고정한다. stale, 미래 시각, 잘못된 pair, 통화 불명, 품질·권리 차단, 시간 cut 불일치는 FX 부재와 같은 차단 상태다. rate `0` 또는 실패를 정상 숫자로 취급하지 않는다.

도메인에는 원화/달러 등 native amount를 계속 제공하고, FX 근거가 통과한 금액에만 `baseAmount`를 만든다. 총자산·현금 포함 비중·sector·concentration·risk 입력·AI 요약은 동일한 `PortfolioValuationSnapshot`의 base amount와 snapshot ID를 소비한다. 화면 경로별로 개별 환산하거나 일부는 native, 일부는 base 값을 합산하지 않는다. 미환산 멤버가 있으면 완전한 base total/P&L/risk는 차단하고 `확인된 native 금액`과 누락 사유만 따로 보일 수 있다.

손익 비교는 원가와 시가가 같은 통화일 때 직접 차감한다. 통화가 다르면 cost basis의 기준 시각에 고정된 비용 FX와 valuation cut 시각의 시장 FX를 별도로 사용한다. 취득/수수료/입출금 내역이나 historical FX가 없어 base-currency P&L을 재현할 수 없으면 손익 계산은 보류한다. 현재 FX를 과거 원가에 소급 적용해 실제 계좌 성과인 것처럼 표현하지 않는다. 이 계약은 원장 없는 계좌의 실제 TWR/MWR을 만들어내지 않는다.

### 전달 경로와 상태 전이

```text
Vault encrypted record
  → runtime reader (원본 schema/revision 포함)
  → portfolio provider (instrument + money/FX envelope)
  → normalizer (통화 보존, 추론 금지)
  → valuation / P&L / risk domain (하나의 ValuationCut/Snapshot)
  → selector / presentation model
  → totals, cash, holdings, allocation, risk UI, AI context
```

저장 성공 시 새 통화 메타데이터는 기존 보호된 portfolio record와 같은 durable transaction으로 기록한다. 통화 일부가 분리된 평문 저장소에 복제되지 않는다. 실패 시 메모리의 optimistic 변경을 완료로 알리지 않는 P11-01의 acknowledgement 계약을 따른다. display selector는 native money와 변환 근거·base value를 함께 가져오되 계산식을 중복 구현하지 않는다. AI context도 화면에서 확인된 같은 valuation snapshot을 참조하고, snapshot이 blocked/partial이면 해당 금액을 확정 사실로 내보내지 않는다.

### 저장 데이터 이전과 복구

- 이전 schema의 통화가 비어 있거나 불명확하면 USD로 채우지 않는다. 원래 암호화 record와 revision을 보존한 채 `currency-resolution-required`로 표시한다.
- 사용자가 종목 거래소·계좌 기준 통화·기존 원가 통화를 확인한 경우에만 새 schema revision을 만든다. 변환 이전의 원본을 복구 지점으로 유지하고 화면에서 확인된 해석을 기록한다.
- 기존 결과의 currency lineage가 충분하지 않으면 `legacy-currency-unknown`으로 남기고 새 base total/risk와 직접 비교하지 않는다. 재실행은 새 valuation cut으로 새 ID를 생성한다.
- 신규 reader/normalizer/domain/UI 전 경로가 통과하기 전에는 기존 저장값을 덮어쓰지 않는다. 오류 시 이전 원본과 native amount를 복원하고 변환 통계만 차단한다. 통화 미확인 상태를 통화 없는 합계로 rollback하지 않는다.

### 독립 인수 fixture

| fixture | 입력·기대 |
|---|---|
| USD 계좌 | USD 100 주식 + USD 900 현금, FX 불필요. 전체자산 1,000 USD, 종목 총자산비중 10%, 주식 내 비중 100%. |
| KRW 계좌 | KRW 가격·원가·현금만 존재. USD 가정 없이 totals와 화면이 KRW를 보존한다. |
| USD/KRW 혼합 + 유효 FX | USD 50 + KRW 70,000, base USD, 1 USD=1,400 KRW. 기대 총액 USD 100. FX pair 방향·관측 cut·revision이 결과에 보존된다. |
| 혼합 + FX 없음/오래됨/미래 관측 | 완전 총액, base 비중, P&L, risk를 보류한다. 50+70,000 또는 일부 멤버만으로 total을 만들지 않는다. |
| 역수 pair | 1 KRW=1/1,400 USD를 입력해 정방향 사례와 허용 오차 안에서 같은 결과를 낸다. 역수 0·음수·NaN은 거부한다. |
| 원가 통화 ≠ 시가 통화 | historical cost FX와 current valuation FX가 각각 적용된다. 하나만 없으면 해당 base P&L은 차단되고 native 손익도 통화별로 구분된다. |
| Vault → AI/UI 전체 경로 | 새 schema를 암호화 저장·재로드한 뒤 같은 valuation snapshot ID, native/base 금액, 차단 상태가 totals/table/risk/AI context에서 일치한다. 저장 실패는 성공 toast와 입력 초기화를 만들지 않는다. |
| 구 schema migration 실패/복구 | 누락 통화가 USD가 되지 않으며 원본 revision 복구가 가능하다. 부분 이전 결과가 완전 계좌로 표시되지 않는다. |

합성 fixture는 산술·계약을 확인하며 FX 공급자 품질, 권리, 실제 계좌 거래 원장, 데이터 저장 암호화와 실제 브라우저 접근성 인수는 별도의 근거가 필요하다. UI 표본 캡처나 domain 단위 PASS로 이 end-to-end 경계를 완료했다고 표시하지 않는다.
