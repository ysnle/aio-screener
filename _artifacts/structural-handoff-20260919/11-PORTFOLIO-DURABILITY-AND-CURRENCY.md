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
