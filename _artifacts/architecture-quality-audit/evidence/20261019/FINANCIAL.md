> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# 금융 계산·기간·단위 감사

MODE: review | VERDICT: PASS+NOTES (이 소유 범위의 검토 결과이며 전체 앱/투자 정확도 인증 아님)
REF: df6f0b33abd1c15c268d818efcbfc3c5547ed9b0 / v58.20
검토자: current_financial_review, correctness/root-cause lens. 독립성: limited (동일 모델 팀).

## 읽기 경계와 상태

`src/domain/fundamental/**` 11개와 `src/domain/portfolio/**` 11개, 총 22개 현행 파일을 전부 읽었다. FULL은 전 파일 전문, PARTIAL은 호출자 해당 범위만이다. 둘은 `financial-reading.tsv`에서 구분했다. 소유 범위 NOT_READ 0개. 긴 파일은 출력이 잘리지 않는 연속 범위로 나눠 읽었다. 마지막 대조 결과 FULL 22개 SHA256 불일치 0개이며 HEAD도 동일하다. 현행 과거 감사 보고서의 finding/이유는 읽지 않았다. 다른 팀원이 이번 감사에서 만든 `domain-contract-result.json`의 valuation 실행 결과는 독립 소스 발견 후 재현 근거로 읽었으며 독립 발견 투표로 세지 않는다.

## F-FIN-01 — [PRE-EXISTING][warning] 조정 종가 필드가 정규화에서 사라져 일부 Forward PER와 보유 종가 평가를 잃음

- 정확한 위치: `src/data/normalize/screener.js:122` (122~130의 valuation whitelist), 별도의 보유 평가 reader는 `src/ui/pages/portfolio.js:191`. 도메인 소비자 위치: `src/domain/fundamental/consensus-read.js:27`.
- Trigger: producer가 `valuationPrice`를 발행하지만 `pePrice`와 `pbPrice`는 없는 종목. 순손실·음의 자본인 경우에도 share trust를 만족한 close는 `secFundamentalRowFields` 42~48에 따라 합법적으로 존재한다.
- Failure: provider는 `_valuationPrice`로 바꾸지만 normalize whitelist는 이 키를 넘기지 않는다. 소비자는 close가 없다고 판단하여 유효한 예상 PER 또는 적자 예상 안내까지 숨긴다. 포트폴리오 close reader도 `_valuationPrice`를 읽지 않아 이 종목들의 유효한 종가 fallback을 버린다. 실시간 quote가 도착하면 포트폴리오 쪽은 회복할 수 있지만 컨센서스는 의도상 completed close를 사용한다.
- Caller chain: `sec-row-fields.js:42` → `src/data/providers/screener.js:603` → `src/data/orchestrators/screener.js:40` → `normalizeScreener` → canonical screener rows → `src/ui/components/fiscal-read.js:271` / `src/ui/pages/screener.js:404,633` → `consensusView`. 포트폴리오는 canonical rows → `screenerCloseOf` 191 → `derivePortfolioSurface` 202 → `holdingValue` 153.
- 실행 증거(실제 모듈 + 현재 체크인 artifact, browser 아님): `expandScreenerArtifact(public-data/screener.json)`에서 `valuationPrice>0 && !(pePrice>0) && !(pbPrice>0)`인 종목 7개: RBRK, LUNR, CORZ, AMC, ARRY, EQH, APPN. 같은 artifact의 close/date와 `public-data/consensus-estimates.json`의 자기 종목 행으로 `consensusView`를 실행한 뒤 `normalizeScreener({rows:[row]})`를 거쳐 재실행했다(now=2026-10-19). CORZ 224.6667배→null, ARRY 5.359375배→null, EQH 6.593556배→null, APPN 65.349206배→null. 나머지는 forward EPS가 양수가 아니므로 fwdPe 자체는 null이었으나 정상 expectation view가 정규화 뒤 사라진다. 실제 사용자 보유 데이터나 유료 API는 쓰지 않았다.
- Root의 별도 실행 증거: `_artifacts/architecture-quality-audit-20261019/domain-contract-result.json` valuation: 합성 row close100 / fwdEPS5 / trailingEPS-1이 정규화 전 fwdPe20, 후 view=null, fieldPreserved=false. 소스 키 누락 발견은 이 검토자가 독립 수행했고 이 합성 실행은 root 수행이다.
- 반론/도달성: PE나 PB가 하나라도 있는 일반 종목은 `_valuationPePrice` fallback 때문에 결함이 가려진다. 위 7개는 현재 데이터에서 두 fallback이 없는 실제 입력이다. 라이브 화면의 발생 빈도/보유 여부는 측정하지 않았다.
- 최소 대안: 정규화에 `_valuationPrice` 보존 한 줄을 추가하고 portfolio close reader가 같은 canonical key를 최우선으로 읽는다. 계산기 새 추상화나 provider 재수집은 필요 없다. regression은 실제 pipeline 전후 view 보존과 PE/PB 없는 주식의 completed-close valuation을 확인한다.

## 확인했으나 finding으로 승격하지 않은 후보

- [UNPROVEN][warning] `src/domain/portfolio/attribution.js:55`: stock/market/FX 종료일은 맞추지만 sector ETF 종료일은 검사하지 않는다. 실제 함수에 stock10%,market5%(2026-10-16),sector80%(2025-10-16)를 넣으면 섹터+75%p/종목선택-70%p, `sectorMappedPct=100`, skipped=[]를 발행한다. 산술 항등식은 맞아도 같은 창의 원인 분해가 아니다. 다만 현재 체크인 SPY/XLK/XLF/XLV/XLY/XLRE는 모두 2026-10-16으로 같으며, 현행 producer/provider가 다른 날짜 ETF를 허용하는 실제 실행 경로까지 입증하지 못했다. 따라서 확정 결함 수에 넣지 않는다. 다음 최소 확인은 per-symbol chart 끝 날짜가 다른 응답의 `_enrichPriceFactors`→provider 경로 재현이다. 허용된다면 sector row date 불일치 때 market fallback과 sectorKnown=false가 가장 작은 대안이다.
- [NOTED] `backtest.js:231`: baseCurrencyReturns는 local-path 시작 비중에 월별 FX를 적용한 별도 계열이다. FX까지 반영한 buy-and-hold 계좌 비중 drift를 다시 시뮬레이션하는 경로는 아니다. 현행 `js/aio-workspace.js:1593`은 이 계열 숫자를 표/차트에 렌더하지 않고 disclosure만 붙인다. 사용자가 보는 숫자의 현재 오산으로 올리지 않았다. 미래 numeric consumer를 붙일 때 경로 정의와 FX drift를 함께 정해야 한다.
- [DISMISSED] `sec-statements.js:100`의 debtToEquity가 current debt를 포함하지 않는 후보: 현행 UI `js/aio-ui.js:2175`가 명시적으로 '장기부채 ÷ 자기자본'이라고 표시한다. 표기의 계약에 맞으므로 버그로 보지 않았다.
- [DISMISSED] `risk.js`가 cash 미해결 시 account view를 보류하는 후보: 선언과 scope를 분리한 구현이며 sleeve만 게시한다. 누락 cash를 0% 계좌라고 발표하는 경로가 아니다.
- [NOTED] `isLendingFinancial`의 넓은 sector+예외 목록 분류는 보험사까지 은행형 설명/FCF 보류로 묶는다. 관련 issuer 영업모형·현재 curated identity의 검증 없이 함수 이름이나 분류 취향만으로 finding을 만들지 않았다.

## 검토한 계약과 측정 한계

- SEC: 같은 fiscal end/start, 연간 300~400일, TTM의 4개 연속 분기와 FY−3분기, common earnings 구분, average-equity ROE, native currency/ADR의 price ratio 보류, share trust, PIT availability와 fiscal end 구분, reconciliation idempotency 구조를 읽었다. 외부 SEC 원문과 전 종목 amount의 대조는 수행하지 않았다.
- 포트폴리오: 시장가치와 원가 분리, 직접/역방향 FX의 시간 컷, 환산 실패 보류, 부분 가격 분모, current composition과 실제 원장 성과 구분, 전략 drift/rebalance, 현금 scope, 월말 동시성/연속 grid, 가중 수익·기여도, 표본 안정성 근거를 읽었다. 실제 가족 계좌·보유 입력, 브라우저 interaction, 실제 공급자 응답은 사용하지 않았다.
- 계산의 실사용성은 현재 데이터의 7종목 valuation 사례와 production caller chain까지 확인했다. 실거래 예측성·점수의 투자 유용성·브라우저 반응성 인증은 아니다. 성능 benchmark는 하지 않았고 파일 길이/스타일 취향은 finding에서 제외했다.
- 실행: 실제 pure ESM import를 통한 valuation 전후 비교와 attribution 날짜 반례, 현재 artifact 구조/특정 rows 읽기, 소스 SHA256 최종 비교. producer·외부 네트워크·전체 QA·브라우저·배포 검사는 실행하지 않았다. 리뷰 산출물 두 파일 외 제품/데이터 변경 없음. commit/push/deploy 없음.
