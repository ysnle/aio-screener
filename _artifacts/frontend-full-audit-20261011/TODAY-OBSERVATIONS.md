# TODAY-OBSERVATIONS — frontend-full-audit-20261011

- Scope: `#home`, `#briefing`, `#market-news` (127.0.0.1:8931), 관측일 2026-10-11
- Method: Node+Playwright 1회 실행, 라우트당 5초 렌더 대기, 표시 텍스트·수치·기준일·상태칩(id 기반)·콘솔에러 추출. 스크린샷 `today-home.png` / `today-briefing.png` / `today-market-news.png`
- Baseline: 마지막 미국장 2026-10-09(금) 종가, market-snapshot lastSuccessful 2026-10-10T15:23:15Z (fresh), 뉴스 사이클 2026-10-09 08:00 ~ 2026-10-10 08:00 KST, newsCount 40
- 등급: A=틀린/낡은 데이터, B=같은 값 다른 basis, C=기준일/상태칩, D=카피/UX

## 요약 (건수)

| 등급 | 건수 | ID |
|---|---|---|
| A | 3 | TODAY-A1, A2, A3 |
| B | 2 | TODAY-B1, B2 |
| C | 2 | TODAY-C1, C2 |
| D | 2 | TODAY-D1, D2 |
| **합계** | **9** | |

## A — 틀린/낡은 데이터

- **TODAY-A1 (high, 중복: X-A3)** `market-news`
  - 위치: 카테고리별 섹션 안내문 · actual: "이전 수집분 **39건**"
  - expected: **40건** — `data.json:meta.newsCount`, `meta.cycleComponents.newsCount`, `meta.domainReceipts.news.counts.updated` = 40
  - 수정: UI 수집 건수 산정의 오프바이원 제거, newsCount와 동일 소스 사용
- **TODAY-A2 (medium)** `home,#briefing`
  - 위치: F&G 상태칩 · actual: "F&G **45 중립**"(home) / briefing 동일 취급
  - expected: `data.json:fearGreed.rating` = **"fear"** (score 45). 단, data.json 자체 history는 44.71→fear, 45.23→neutral로 **45=neutral** 임계 → 데이터측 rating 라벨이 자체 임계와 모순. 렌더(중립)가 임계상 옳음.
  - 수정: 생성기 fearGreed.rating 산정 로직 수정(45 경계 처리)
- **TODAY-A3 (low)** `briefing`
  - 위치: "오늘의 시장 해석" 다중자산 20일 · actual: "러셀 2000 20일 **-3.3%** vs S&P 500 +2.0%"
  - expected: `history.json` rut 20거래일 ≈ **-2.95%**(2806.98/2892.24−1, 기준 2026-09-14). 같은 문장의 '금 20일 -3.1%'는 history gold(-3.1%, 4216.3/4351.9−1)와 정합.
  - 수정: 브리핑 저장본 다중자산 20일 수치 재생성/기준일 명시. ('20일' 창 정의 모호로 확신도 낮음)

## B — 같은 값, 다른 basis

- **TODAY-B1 (high, 중복: X-B1)** `home`
  - 위치: hero '지금 시세' — BTC 카드 · actual: **BTC 82,871.30 +0.39%**, per-카드 basis 라벨 없음
  - expected: `market-snapshot.json:quotes[market.crypto.btc]` value=**82871.3**(session=CURRENT_SESSION, quality=CURRENT) vs previousValue=**82546.32**(완료종가). 즉 라이브 세션값.
  - 수정: BTC 카드에 '실시간/지연 세션' basis 라벨 명시(인접 지수 카드 '10/9 종가'와 구분). 값은 정확.
- **TODAY-B2 (medium, 중복: X-B5)** `home,#briefing`
  - 위치: hero 헤드라인 · actual: home "S&P 500 **사상 최고치 부근**"
  - expected: **1년 고점 대비 -0.1%** (`history.json` spx max 7818.93@2026-10-06 vs 7811.54 = -0.09%). briefing은 '1년 고점 대비 -0.1%로 고점권'으로 표기.
  - 수정: '사상 최고치'(all-time)는 1년 고점 근거로 과장 — basis 일치 표현으로 통일

## C — 기준일/상태칩

- **TODAY-C1 (medium)** `home,#market-news`
  - actual: home "**lastFetch=unknown**" vs market-news "수집 지연 · **마지막 수집 10. 11. 오전 12:23**"
  - expected: 두 라우트가 동일 수집 시각(`operations-status.json:generatedAt` = 2026-10-11 00:23 KST) 참조
  - 수정: home lastFetch를 news 페이지와 동일 타임스탬프 소스로 연결
- **TODAY-C2 (low)** `home,#briefing,#market-news`
  - actual: "AI 도우미 - **일시 사용 불가**", "공용 AI 연결 확인 실패"
  - expected: `operations-status.json:ai.publicChat.status` = **CURRENT** (health 200)
  - 수정: 클라이언트 헬스체크 실패 문구와 durable plane CURRENT 불일치 점검 (검증환경 네트워크 영향 가능)

## D — 카피/UX

- **TODAY-D1 (high)** `home`
  - actual: "현재 검증 뉴스 없음 / **reason=all-news-outside-time-window · lastFetch=unknown**"
  - expected: 내부 코드 노출 금지, 사용자 문구로 변환 (market-news는 사용자 문구로 표현)
- **TODAY-D2 (high)** `home,#briefing`
  - actual: home "2026.10.11 (일) KST" vs briefing "2026-10-11 (일)" — 날짜 포맷(. vs -, KST 접미) 불일치
  - 수정: 날짜 포맷 헬퍼로 통일

## 확인됐으나 문제 없음 (핵심만)

- hero 수치 8종(SPX 7,811.54 +0.59% / 나스닥 +0.64% / 10Y 5.244 +1.3bp / WTI 91.85 +0.39% / VIX 14.84 −3.70% / DXY 102.23 +0.09% / 금 4,216.30 +1.43% / KOSPI 6,625.93 −2.62%)이 market-snapshot.json quotes와 일치
- briefing 기준일: 페이지 2026-10-11 + 본문 '10/9 미국 종가 기준' = 마지막 미국장 종가와 정합. '50일선 위 종목 35%'(history breadth50 34.7), HY 315bp, 풋/콜 0.82, F&G 45, CPI 3.4%/근원 2.4%, 소매판매 1.1%, 분배일 7일 모두 데이터와 일치
- market-news 헤더 수집창 '10. 9. 08:00 ~ 10. 10. 08:00 KST' = `meta.newsCycleLabel`
- 관련 종목 chip 3건 샘플: 삼성전자 글→chip 삼성전자, 미장브리핑→AMD/TSM/MRVL/LITE, 레딧관심도→MU — 타사 재작성 사례 미발견
- 3개 라우트 공통 상단 '종가 · 서버 10/9 마감 · 시세 16종'(coverage 16) 일관

## blocked

- 원문(텔레그램/뉴스 피드) 데이터가 비교파일 4종에 없어 chip의 타사 재작성 여부는 렌더 본문(잘림) 내부정합만 확인 → 원문 대조 불가
- 브리핑 '20일' 창 정의가 데이터에 없어 rut 수치 재현 모호(A3 확신도 낮음)
- hero '20거래일 +2.0%'(SPX)는 history 20거래일 +2.1%와 반올림/기준일 차이 → 단정 불가로 미채점
- 상단 'VIX —'(em dash)는 fast quote plane UNAVAILABLE / browser plane NOT_OBSERVED와 정합 → 오류 미채점

_관측 스크립트: szk 스크래치패드 `audit-routes.mjs` (읽기 전용, 1회 실행)._ 
