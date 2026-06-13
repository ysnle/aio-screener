---
date: 2026-06-13
method: 3 병렬 Explore 에이전트 — 21개 route 페이지를 "사용자가 보고/읽고/사용하고/느끼는" 관점으로 전수
purpose: 페이지별 근본/구조적 개편 + 자율 운영 루프(v50.42~) 우선순위 도출
---

# 페이지별 사용자 경험 전수 조사 (2026-06-13)

## 교차 페이지 핵심 발견 (수렴된 구조 문제 — 우선순위순)

### ★★★ P1. "수신/수집/산출 대기" 빈 껍데기가 도처에 (최대 문제)
사용자가 "사이트가 미완성/고장"으로 느끼는 #1 원인. **데이터/로직은 있는데 해당 섹션이 영구 placeholder**:
- home 결론바 · breadth 랠리품질 판별 · sentiment 복합판단 · briefing 뉴스개수 · macro 스토리라인("생성 중...") · technical 심층 핵심레벨 · kr-themes 테마 그리드(완전 공백) · kr-supply 동적분석 · kr-technical KOSPI/KOSDAQ 분석 · kr-macro 매크로 자동판단
- **이것이 자율 루프 Phase 3(텍스트 합성)의 정확한 타깃** — marketState+newsSignal에서 템플릿 합성으로 채우면 빈 껍데기→라이브 분석으로 전환. UX #1 수정 = 루프 완성과 동일.

### ★★ P2. 페이지 "현재 분석/자동 판정" 부재 + naive 알고리즘
- 건강점수 가중치 불투명(home/signal/technical/kr-technical 제각각) · breadth McClellan "의심" 하드코딩(v50.45 실측화 착수) · 시나리오 확률 근거 부재 · kr-technical 건강점수 "32"가 0~100 어디인지 범위 미표시.
- → 자율 루프 Phase 2(cycle/risk 모델 재작성) + 합성 엔진이 "현재 Regime 판정 1문장"을 모든 페이지 상단에 제공.

### ★★ P3. KR 페이지 데이터 stale (15일~4개월) — 정직 라벨 필요
- kr-credit(신용잔고) 15일 · kr-deposit(예탁금) 28일 · kr-export(수출) 4개월 · kr-issues 28일.
- 무료 KR 자동 소스 없음(R15/R183 블록) → **수정은 "fresh 데이터"가 아니라 정직한 stale 라벨**: "참고용 스냅샷 · N일 전" + 시각 강등 + (가능시) 외부 링크. 이건 즉시 가능.
- 부수: 신용잔고 "역대 최고·빚투 급증"이 공포심 유발 → 중립 해석 1줄 필요.

### ★ P4. 스크롤 과다 + 핵심 묻힘
- macro(11섹션) · kr-macro(11) · kr-home(7) · guide(400줄). → 상단 "1분 요약/현재 분석" 고정 + 상세는 접기.

### ★ P5. 죽은/폐기 흔적
- options 폐기됐으나 내비/링크 잔존 가능(확인 필요) · technical TradingView hidden 유물 · kr-themes 필터 클릭 무반응 · guide TOC 버튼 작동 미확인.

### ★ P6. 중복 지표
- home/signal/breadth가 동일 KPI(SPY/VIX/시장폭) 반복 · fxbond 통화쌍 카드 8개 + 종합 그리드 9개 중복.

## 페이지별 ★ 최우선 (요약)
- **home**: 결론 4중복(결론바+카드+액션+요약) 통합, 빈 결론바 채우기
- **signal**: 점수 5개 상단+계산식 1줄, Lockout 기관용어 접기, CP1~8 vs 리스크모니터 중복 제거
- **breadth**: 8차트→2~3 압축, McClellan "의심" 제거(v50.45 착수), 랠리품질 빈칸 채우기
- **sentiment**: F&G+VIX만 상단, 복합판단 빈칸 채우기, 나머지 아코디언
- **briefing**: 뉴스개수 "-" 동적 로드, Jensen "예상"은 테마/매크로로 분리
- **technical**: 건강도 계산식 노출, 심층 핵심레벨 빈칸 채우거나 숨김, Institutional Brief 접기
- **macro**: 스토리라인 "생성 중" 영구공백 해결, 인플레/고용 "모니터링 중" 실값, 온도계 현재점수 표시, 1분요약
- **fxbond**: 상단 현황요약 1줄, "수신 대기" 8곳 스켈레톤, 통화쌍/종합 중복 통합
- **fundamental**: 검색 로딩 스피너, 비활성 TradingView/리스크레이더 정리
- **themes**: RRG 사분면 색상+호버, 경기사이클 현재위치 포인터, 테마히트맵 기본값, ETF차트 자동로드
- **theme-detail**: ETF 테이블 카테고리 혼재(NVDA/XLC/XSD) 정리, 부테마 예시종목 추가
- **portfolio**: 포지션0 온보딩 CTA, PIN 용도 명확화, 섹션 단순화(요약→보유→고급탭)
- **ticker**: Financials 탭 확장, 진입품질 EMA/RSI 자동입력, Action 버튼 기능 연결
- **options**: 내비 제거 또는 리다이렉트(폐기 잔존)
- **market-news**: 캐시 샘플 뉴스 먼저, 센티먼트 점수 정의, 필터 15개 정리
- **kr-home**: 데이터 타임스탬프 명시, 이슈 하단 이동, 신용잔고 중립 해석, 체감온도 캐시 초기값
- **kr-supply**: 동적분석 AI 인사이트, TAB2 "히스토리(참고)" 명칭, 용어 툴팁, 공매도 탭 명확화
- **kr-themes**: ★ 테마 그리드 완전 공백 — renderKrThemeCardsFromMap 디버깅 또는 정적 복귀(최우선)
- **kr-macro**: 1분요약, 수출 4개월 stale 라벨, 자동판정 로직, 섹션 압축
- **kr-technical**: 차트로드 디버깅, 건강점수 범위/게이지, VKOSPI 차트 데이터바인딩, 금리스프레드 해석
- **guide**: 400줄 축약, 필수 API 2개 강조, TOC 작동 확인, 10단계 루틴 기본 펼침

## 자율 운영 루프와의 연결 (결론)
**P1(빈 껍데기) + P2(현재 분석 부재)는 자율 루프 Phase 3(`_aioSynthesizeMarketAnalysis` 텍스트 합성)이 정확히 푸는 문제.** v50.45에서 뉴스 신호→두뇌 고리를 복원했으니, Phase 3는 그 두뇌(marketState+newsSignal)에서 각 페이지의 "현재 분석" 산문을 템플릿 합성해 빈 섹션을 채운다. 즉 **자율 루프 완성 = 최대 UX 문제 해결**이 일치. P3(KR stale 라벨)은 독립적·즉시 가능.

권장 실행 순서: (1) Phase 3 합성 엔진으로 home/macro/breadth/sentiment/kr-* 빈 "현재 분석" 채우기 → (2) Phase 2 알고리즘 모델 재작성(cycle/risk) → (3) KR stale 정직 라벨 패스 → (4) 페이지별 가시 정리(중복/접기/죽은요소).
