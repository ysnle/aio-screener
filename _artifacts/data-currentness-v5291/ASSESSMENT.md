# v52.91 3차 라이브 데이터·현재시장 전수 평가

평가 시각: 2026-07-14 KST  
범위: 19개 primary 페이지 + 용어사전 오버레이 = 20개 사용자 표면. 자동 QA의 22개는 primary 19 + derived 2 + reference 1이며 사용자 페이지 수가 아니다.

## 결론

전체 자동 최신화 상태가 아니다. 서버 스냅샷의 시세 77/77, CNN Fear & Greed, FRED 19개, 뉴스 40개·8소스는 7월 14일 수집 증거가 있다. 반면 breadth, Put/Call, AAII, 한국 투자자 수급, Telegram, FMP는 정적·지연·실패·무응답 상태다. 이 입력들은 v52.91에서 현재 판단으로 승격하지 않도록 격리했다.

## 22개 데이터 범주

| # | 데이터 범주 | 자동 원천/이력 | 7/14 상태 | 판단 사용 | 조치 |
|---:|---|---|---|---|---|
| 1 | 미국 주요지수 | Yahoo→GitHub Actions, 77/77 묶음 | OK · S&P/Nasdaq 당일 종가 일치 | 허용 | 관측시각 메타 보존 |
| 2 | 미국 주식/ETF 시세 | Yahoo, 서버 스냅샷 | OK | 허용 | 파일시각과 거래시각 분리 |
| 3 | 한국 지수 | Yahoo 서버 + Naver client | OK/충돌감시 | 허용 | 0.75% 이상 상충 시 후발 덮어쓰기 거부 |
| 4 | 환율 | Yahoo 서버 스냅샷 | OK | 허용 | 관측시각 보존 |
| 5 | 국채/금리 시세 | Yahoo + FRED | OK | 허용 | 지표별 freshness budget |
| 6 | 원자재 | Yahoo | OK | 허용 | 관측시각 보존 |
| 7 | 암호화폐 | Yahoo | OK | 허용 | 24/7 marketState 분리 필요성 유지 |
| 8 | Fear & Greed | CNN, asOf 10:08Z | OK · 44 Fear | 허용 | canonical envelope 유지 |
| 9 | VIX/VVIX/기간구조 | Yahoo + 일부 계산 | OK/부분 | 검증값만 | 정적 VKOSPI 추정은 reference 유지 |
| 10 | Put/Call | client 외부 원천/폴백 | WARN · fetch 실패 | 차단/중립화 | 원천 복구 전 행동 근거 금지 |
| 11 | AAII/NAAIM | 공개 주간 자료/정적 폴백 | WARN · AAII 오래됨 | 차단 | 주간 관측시각 필요 |
| 12 | 시장폭 20/50/200SMA | 정적 snapshot 2026-06-26 | BLOCKED | 차단/50 중립 | 일반 fetch 시각 차용 제거 |
| 13 | FRED 거시 19개 | FRED API, GitHub Actions | OK | 주기별 허용 | 월간/정책값 예산 분리 |
| 14 | 미국 고용·물가·PCE | BLS/BEA→FRED/정적 설명 | OK · 최신 발표 대조 | 허용 | 다음 발표일 텍스트 갱신 |
| 15 | Fed 정책금리 | FRED/Fed | OK · 3.50~3.75% | 허용 | 45일 budget |
| 16 | 한국 거시/BOK | BOK 일정 + 정적/동적 혼합 | OK/부분 | 날짜 확인값만 | 다음 회의 7/16으로 수정 |
| 17 | 한국 투자자 수급 | Naver client proxy | BLOCKED · HTML/CORS 실패 | 금지 | 값·막대·방향 모두 미수신 처리 |
| 18 | 기술지표/OHLCV | Yahoo chart 기반 계산 | OK | 조건부 허용 | 기준 시점/일봉 길이 공개 |
| 19 | 시장 뉴스 | RSS 8소스, GitHub Actions | OK · 40건 | 설명용 | 실패 번역 회로 차단 |
| 20 | Telegram 리서치 | 3채널 스크래퍼 | BLOCKED · 전 채널 실패 | cached reference만 | attempt/success 시각 분리 |
| 21 | 기업 펀더멘털 | FMP + SEC/폴백 | WARN · FMP key 있으나 0건 경로 관측 | 제한 | 소스 0건을 완료로 표시 금지 |
| 22 | 전술 점수/백테스트 | 위 입력 + 가격 파생 4팩터 | WARN · n5d30 corr -0.477, n21d14 -0.253, 유의성 false | 환경 설명만 | Buy/매수 밴드 제거, 미확인 입력 fail-closed |

## 현재 시장 대조

- 미국: S&P 500 7,515.34(-0.79%), Nasdaq 25,873.18(-1.55%), VIX 약 17.2. 중동/호르무즈 위험과 유가·금리 상승, AI/반도체 약세라는 당일 서사와 화면 수치 방향이 일치했다.
- 한국: KOSPI 6,856.83(+0.73%), KOSDAQ 783.98(-1.92%). 서버 스냅샷을 종가 기준으로 채택하고 상충하는 후발 client 소스는 덮어쓰지 않는다.
- 거시: 6월 고용 +57K·실업률 4.2%, Fed 3.50~3.75%, 5월 PCE 4.1%·core 3.4%, BOK 2.50%와 7월 16일 다음 회의를 대조했다. 7월 14일 미국 CPI 발표 전에는 5월 CPI가 최신 확정치라는 시점 경계를 적용했다.

## 실브라우저 증거

- 로컬 Chromium으로 19 primary + 용어사전, desktop/mobile 총 40렌더를 수행했고 `pageerror` 0이었다.
- 브리핑은 `S&P 500 지수 7515.34 -0.79%`로 실제 지수/필드를 표시했다.
- client 외부 요청이 실패한 뒤에도 F&G는 서버 관측값 44, `cnn-via-github-actions`, `VALID/current`를 유지했다.
- 한국 수급 실패 화면은 6개 값 `—`, 0% 중립 막대, 기관·프로그램 `미수신 · 원천에서 확인`으로 수렴한다.
- 점수는 `환경 우호/환경 양호` 상태 설명이며 통계적 예측·매수 허가로 표시하지 않는다.

## 남은 외부 운영 의존성

Telegram 3채널, Naver 투자자 수급, FMP 결과, breadth/PCR/AAII 원천은 코드만으로 성공을 만들 수 없다. v52.91의 완료 범위는 이 실패를 숨기지 않고 현재 판단에서 차단하는 구조적 보강까지다. 운영 원천이 복구된 뒤 각 `lastSuccessfulAt`과 실제 관측값을 다시 확인해야 `VERIFIED_LIVE`로 승격할 수 있다.
