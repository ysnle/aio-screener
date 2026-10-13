# v57.51 스크리너 데이터 점검 — 인수인계 (2026-10-13)

## 무엇을 했나
소유자 요청은 "스크리너의 모든 정보·데이터·소식의 품질·정확성·최신성·정합성·원천·커버리지 점검과 실제 개선"이었다. 진행 순서는 다음과 같다.
1. 읽기 전용 점검 3건을 진행했다. 필드 원천·정확성 F01–F23, 커버리지 V01–V24, 소식 N01–N24.
2. 파일 소유를 나눈 작업자 4명(D1 가격, D2 SEC, D3 뉴스, D4 유니버스)이 수정했다. 지시서는 `WORKER-BRIEF.md`.
3. 독립 교차 검토에서 P3 5건을 찾아 수정했다.
4. 기록은 P1704–P1716이고, 각 항목은 `record-p17xx.json`에 있다.

- 코드 커밋: 2f14d796. 첫 push CI는 예상대로 browser-market-epoch와 browser-screener-refresh에서 실패했다. 유니버스는 1,143행으로 늘었는데 저장 산출물은 989행이라, 현재 세션 커버리지가 0.704로 기준 0.8에 못 미쳤기 때문이다.
- 데이터 커밋: refresh-screener run 38374258177 → 2807e945. 이 커밋의 CI는 통과했고 Pages는 v57.51로 바뀌었다.

## 새 산출물 확인 결과 (QA-VERIFY-18, 2807e945 기준)
| 항목 | 결과 |
|---|---|
| 한국 종가 교정 | 확인. 미국 러너에서 Naver 경로가 열린다. 239행 중 reconciled 237, rejected 2. 교정한 종가 6,150건, 채운 세션 237건 |
| 005930 | 확인. factorSessionDate 2026-10-13, ret1d −5.58%(같은 날 코스피 −5.46%). 10/12 결측 세션 채움. 30일 거래대금 4.48조원 / 33.1억달러 |
| 8035.T | 확인. JPY, Asia/Tokyo, listingMarket INTL |
| 시장 폭 | 확인. us 840(ETF·해외 제외). sp500 구간은 500/503종목으로, 50일선 위 37.3%, 200일선 위 52.3%. 관찰 목록 기준 50일선 위는 35.6% |
| 신규 종목 | 대부분 확인. SPCX, SKYD, TWLO, OKTA, GMED, 089030.KQ, 033780.KS 수신. **VYLR은 미수신**(unfetchedSymbols에 있음). 공급자에 아직 시계열이 없는 것으로 보인다(추정). 2회 연속 미수신이면 교체를 검토한다 |
| 종목 뉴스 메모 | 확인. collected 73, rotation-pending 756, not-covered 296, no-verified-article 17. 검증된 메모만 실린다 |
| SEC | 확인. margin>100 행 0건. ESS 순이익률 37.2%, 성장률 +6.4%. PKG·V의 pe는 보류. PER<5는 EIX 4.8, RUN 3.96, LYFT 2.26으로, 일회성 이익 가능성이 있다(F18) |
| rvol20 | 확인. 1,142행 모두 채워짐 |
| fundamentalQuality | 확인. basis fiscal-year-end-age, reportAgeDays가 실린다 |

QA-VERIFY-18은 record-fix에 P 항목이 있어야 체크할 수 있어서 아직 열어 두었다. 다음 수정 기록 때 `done:true, update:true`로 닫는다.

## 열린 항목과 소유자 결정
- **AI Worker·fast data plane:** 첫 push CI가 실패해 v57.50에 머물렀다. 재배포 조건은 "push로 시작된 CI 성공"이고, 이 문서 커밋의 push CI가 통과하면 자동으로 재배포된다. external-pipeline의 proxy-source-revision으로 확인한다.
- **N14:** KST 08:00 뉴스 마감은 정책이라 유지했다. 제안: 08:00 이후 tier1·2 속보 칸을 최대 5건 둔다.
- **F09:** 가격 열은 실시간 시세만 쓰는 구조를 유지했다. pePrice·pbPrice는 산식 근거로 남겼다.
- **evEbitda:** factor-ranks의 golden fixture 줄은 남겼다(실데이터에서는 작동하지 않음). 지우려면 golden 갱신을 결정해야 한다.
- **Russell 2000 표본 150:** 하지 않았다. 대표 표본이 되지 못하고 유동성 낮은 종목만 늘어난다.
- **V21:** 월별 유니버스 스냅샷을 제안했다.
- **한국 법인명 변경:** 보류했다(HDC→IPARK현대산업개발, 엔씨소프트→NC, 한글과컴퓨터→한컴, 서울가스→서울도시가스).
- **DART_API_KEY:** 미설정이다. 그래서 한국 재무와 공시는 0건이다.
- **F23:** 차트 탭 RSI는 차트 일봉으로 따로 계산한다. 산출물 rsi와 통일할지 결정해야 한다.

## 반복하지 말 것
- 유니버스를 늘리면 첫 push CI의 커버리지 검사 2개가 실패한다. 그래서 push 직후 refresh-screener를 실행하고, 데이터 커밋 뒤 push CI를 한 번 더 통과시켜 Worker까지 재배포한다.
- 데이터 생산 스크립트는 로컬에서 실행하지 않는다. 예외는 R271의 sync-screener-universe로, 네트워크 없는 순수 변환이다.
