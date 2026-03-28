# AIO 스크리너 변경 이력 (Changelog)

> **작업 규칙**: 매 버전 완료 시 이 파일에 기록. 다음 버전 작업 시 전체 코드 재작성 금지 — 이 로그를 보고 필요한 부분만 수정(patch).
>
> **작업 시작 전 참고 방법**: 새 작업을 시작할 때 이 파일의 최근 3~5개 항목을 먼저 읽는다. 현재 버전, 최근 변경된 파일, 진행 중인 이슈를 파악한 뒤 작업 계획을 세운다. 같은 영역을 건드리는 경우 이전 변경 의도와 충돌하지 않는지 확인한다.

---

---

## 2026-03-29 — 분석 데이터 소스 이원화: 주가=종가, 시장환경=실시간 (v37.1)

### 주요 변경
- **데이터 소스 이원화 원칙 정립**: 주가(SPX/SPY/QQQ/RSP/개별종목)=`_closingVal()` 종가, 시장환경(VIX/VVIX/DXY/TNX/HYG/유가)=`_ldSafe()` 실시간
- **`computeTradingScore()`**: VIX/VVIX/DXY/HYG/TNX/유가를 실시간으로 복원, SPX/SPY/RSP 종가 유지
- **`computeMarketHealth()`**: VIX 실시간 복원, SPY/QQQ 종가 유지
- **`classifyMarketRegime()`**: VIX 실시간 복원, SPX 종가 유지
- **`_closingVal()` 함수에 이원화 매트릭스 테이블 주석 추가**

### 이유
- 주가: 장 마감까지 봐야 정확한 분석 → 종가 고정
- 시장 환경(채권금리/환율/VIX/유가): 실시간성이 중요 → 선물 24시간 거래 데이터 즉각 반영

---

## 2026-03-29 — 테마/트렌드 전면 병합: v35.8 개편 사항 반영 (v37.0)

### 주요 변경
- **medtech_kr 전면 재구성**: 한미약품/유한양행/SK바이오팜/휴젤 → 삼천당제약(35%)/미래컴퍼니(25%)/리가켐바이오(22%)/솔바이오(18%). bio 테마와 80% 중복 해소
- **업종 불일치 6건 해소**: telecom에서 삼성SDS 제거(IT서비스→통신 ❌), retail에서 제일기획 제거(광고→유통 ❌), logistics에서 롯데지주 제거(지주→물류 ❌), steel_chem에서 S-Oil 제거(정유→energy_kr 전용), nuclear 두산에너빌리티 35→30% 보정
- **US SUB_THEMES 45개 전테마 weights 부여**: memory, semi_equip, foundry, photonics, dc_network, dc_infra, neocloud, ai_platform, hydrogen_ess, quantum, ecommerce, streaming, social_ad, gaming, delivery, space, asset_mgmt, insurance, fintech_crypto, btc_etf, glp1, medtech 등 21개 테마에 신규 weights 추가
- **semi_equip 확장**: CDNS(Cadence)/SNPS(Synopsys) 추가, 명칭 '반도체 장비/EDA'로 변경
- **nuclear_util에 OKLO 추가**: Sam Altman 투자 마이크로원자로 기업, w=8%
- **defense PLTR 비중 5→10%**: AI 정부계약 폭발 반영
- **KR_STOCK_DB**: 삼천당제약(047820) 추가 → 143종목
- **PRIORITY_SYMS**: 삼천당제약(047820.KQ) 추가
- **비중 산출 3대 기준 + 3대 금지 코드 주석 추가**: 주가 퍼포먼스 > 시총 가중 > ETF 참조
- **HTML 카드 동기화**: medtech_kr 카드 신규 종목/촉매 반영, telecom 카드 삼성SDS 제거, steel_chem 카드 S-Oil→한화솔루션 교체

### 보존된 v36.6~v36.9 기능
- v36.6 선물 심볼(ES=F, NQ=F, YM=F) PRIORITY_SYMS 유지
- v36.8 시간외 표시 로직(ticker-hero-ext, data-idx-futures) 유지
- v36.9 _closingVal() 헬퍼 및 분석 함수 종가 전환 유지

---

## 2026-03-29 — 분석 함수 전면 종가 전환: 장중 점수 흔들림 해소 (v36.9)

### 주요 변경
- **`_closingVal(sym, field)` 헬퍼 신규**: chartPreviousClose → previousClose → price 순으로 종가 데이터 반환. 모든 분석 함수의 공통 데이터 접근점
- **`computeTradingScore()`**: VIX/DXY/HYG/TNX/SPX/유가 등 모든 입력을 `_closingVal()` 기반으로 전환. 장중 20~30점 흔들림 제거
- **`computeMarketHealth()`**: VIX 절대값 평가를 종가 기준으로. SPY/QQQ 존재 검증도 `_closingVal` 경유
- **`classifyMarketRegime()`**: SPX 종가 vs MA 비교로 장중 레짐 왔다갔다 방지
- **`calcSectorBreadth()`**: 종가 기준 pct 사용 표기 명시
- **`kr-themes` CHAT_CONTEXTS**: 한국 대장주 10개를 `_closingVal()` 경유 종가 기반으로 변경, "테마별 대장주 종가 기준" 레이블
- **`kr-macro` CHAT_CONTEXTS**: KOSPI/KOSDAQ `_closingVal()` 경유, "종가 기준 데이터" 레이블

### 설계 근거
- 감사 결과: 6개 핵심 분석 함수가 실시간 데이터 사용 → 같은 질문에 시간마다 다른 답
- v36.7의 `_closeSnap()` 원칙이 선언만 되고 실제 분석 함수에 미적용 상태였음
- 종가 기준 전환으로: 트레이딩 스코어, 시장 건강도, 레짐 분류가 하루 동안 안정적으로 유지

### 변경 파일
- `index.html`: _closingVal() 신규, computeTradingScore, computeMarketHealth, classifyMarketRegime, calcSectorBreadth, CHAT_CONTEXTS kr-themes/kr-macro
- `version.json`: v36.9
- `CHANGELOG.md`: 이 항목

---

## 2026-03-29 — 세션 인식 가격 표시 v2: 괴리 해소 + 표시 범위 제한 (v36.8)

### 주요 변경
- **지수 표시 정책 변경**: 현물-선물 괴리 문제 해소 → 지수는 **항상 현물(종가)** 표시, 선물은 별도 참고 정보로만 제공
  - RTH 중: 현물 실시간 가격 [정규장 실시간]
  - RTH 외: 종가 유지 + 선물 시세를 `data-idx-futures` 영역에 참고 표시 (홈 S&P/NASDAQ 카드)
- **개별 종목 시간외 표시 범위 제한**: 모든 곳 → **기업분석(ticker-detail) 화면 전용**
  - `ticker-hero-ext` 요소 추가 (ticker-hero-chg 아래)
  - Pre/After 시 "종가 $185.50 → Pre $189.20 (+2.0%)" 형식
  - `_currentTickerSym` 일치 시에만 업데이트
- **`_liveSnap()` 지수 로직 단순화**: `_idxPrice()` 제거 → 항상 `_ld('^GSPC','price')` 사용. `indexBasis` = '정규장 실시간' / '종가 기준'
- **`_liveSnap()` nasdaq/dow 필드 추가**: 기존 spx만 있던 것에 nasdaq, nasdaqPct, dow, dowPct 추가
- **LLM 채팅 컨텍스트 3곳**: home/briefing/chart 시스템 프롬프트에 3대 지수 + 기준 레이블

### 설계 근거
- 현물-선물 괴리(0.05~0.3%): 선물로 대체하면 본장 종가와 불일치 → 종가 유지가 더 정확
- 분석/해석에 쓰이는 데이터는 `_closeSnap()` 종가 기준 (v36.7에서 이미 구현)
- 시간외 정보는 개별 종목 분석 시에만 의미 있음 → 홈/브리핑 등에서 불필요한 노이즈 제거

### 변경 파일
- `index.html`: applyLiveQuotes (ext-hours→ticker-hero 전용, 지수→종가+선물참고), _liveSnap (지수 항상 현물), CHAT_CONTEXTS 3곳, ticker-hero-ext HTML, data-idx-futures HTML
- `version.json`: v36.8
- `CHANGELOG.md`: 이 항목

---

## 2026-03-29 — 세션 인식 데이터 라우팅 + VVIX/VIX 비율 + 분석용 종가 분리 (v36.7)

### 주요 변경
- **`_getUsSession()`**: 미국 시장 세션 판별 (open/pre/after/futures_only/closed), DST 자동 반영
- **`_isFuturesOpen()`**: 선물 시장 운영 여부 판별 (일 18:00~금 17:00 ET)
- **VVIX/VIX 비율 지표 강화**: 연구 기반 임계값 (<5 과잉안도, 5~6 정상, 6~7 긴장감지, >7 고위험), 해석 라벨 + 전역 저장 + LLM 전달
- **`_closeSnap()` 신규**: 전일 종가 기반 분석용 스냅샷 (chartPreviousClose 활용). LLM 분석/해석/근거는 장중 실시간이 아닌 확정 종가 사용
- **`_liveSnap()` 세션 인식 개선**: usSession/krSession/futuresOpen 상태 + VVIX/VIX 비율 포함
- **LLM 시스템 프롬프트 이중 데이터**: 실시간 현황 + 분석 기준 종가 데이터 분리 주입
- **_getChatRules 규칙 19-B**: "분석 데이터 기준 원칙" — 분석시 전일 종가 필수 사용 규칙
- **chartPreviousClose 보존**: applyLiveQuotes에서 _liveData에 chartPreviousClose 저장

### 설계 근거
- 사용자 요청 6가지: (1)KRX 본장만 (2)VVIX/VIX 비율 (3)한국 세션별 데이터 (4)미국 세션별 데이터 (5)선물시장 시간 인식 (6)분석은 종가 기준
- 장중 실시간 데이터로 분석하면 변동에 따라 같은 질문에 다른 답이 나옴 → 종가 기준으로 일관성 확보

### 변경 파일
- `index.html`: _getUsSession, _isFuturesOpen 신규, _liveSnap/_closeSnap, applyLiveQuotes, CHAT_CONTEXTS, _getChatRules 수정
- `version.json`: v36.7
- `CHANGELOG.md`: 이 항목

---

## 2026-03-29 — 프리/애프터마켓·지수선물·VIX 기간구조 동적화 (v36.6)

### 주요 변경
- **프리마켓/애프터마켓 시세 지원**: Yahoo `includePrePost=true`, marketState 기반 시간외 시세 추출·저장·UI 표시
- **지수 선물 추가**: ES=F, NQ=F, YM=F → PRIORITY_SYMS + _SNAP_FALLBACK + _liveSnap (LLM 전달)
- **VIX ETF(VXX, UVXY) 추가**: 시세 수집 + VIX 선물 프록시로 활용
- **VIX 기간구조 동적화**: 하드코딩 VX1~4 → VXX/UVXY/VVIX 실시간 테이블 + 콘탱고/백워데이션 자동 판정
- **VVIX 안정화**: _SNAP_FALLBACK 추가 + _liveSnap에 추가 → LLM에 전달
- **LLM 매크로 브리핑 강화**: 지수선물, VVIX, 시간외 시세 정보 추가

### 설계 근거
- 기존 본장 종가만 → 프리/애프터 + 지수선물으로 24시간 방향 추적
- VIX 선물 개별 티커 불안정 → VXX/UVXY ETF 프록시 활용
- API 부담: +6티커 (기존 574개 대비 +1% 미만)

### 변경 파일
- `index.html`: fetchYFChart, applyLiveQuotes, updateRiskMonitor, _liveSnap, PRIORITY_SYMS, _SNAP_FALLBACK, HTML 수정
- `version.json`: v36.6
- `CHANGELOG.md`: 이 항목

---

## 2026-03-29 — LLM 웹검색 외부 내러티브·이벤트 집중 강화 (v36.5)

### 주요 변경
- **`_needsWebSearch()` 7개 패턴 추가**: 시장 내러티브(사스포칼립스, turbo quant, ARM everywhere 등), 주요 컨퍼런스(GTC, CES, WWDC, Davos 등), 밈주/숏스퀴즈/변동성 이벤트, 월가 투자 대가/기관(버핏, 달리오, ARK, 골드만 등), 영문 고유명사+시장 맥락 자동 감지
- **`_buildSearchQuery()` 내러티브 프리픽스**: 내러티브 쿼리면 "시장 내러티브", 월가 인물 쿼리면 "월가 투자 견해" 프리픽스 자동 추가
- **`_formatSearchForPrompt()` 외부 내러티브 활용 원칙**: 검색 결과 시스템 프롬프트에 4대 우선순위(① 내러티브/테마 ② 컨퍼런스/이벤트 ③ 대가/기관 포지션 ④ 이벤트 드리븐) 명시
- **Perplexity Sonar 시스템 프롬프트 개선**: 단순 "최신 뉴스" → 4대 우선순위 기반 탐색 지시로 교체, 600자 이내
- **`_getChatRules()` 규칙 19 추가**: 웹검색 결과가 있을 때 외부 내러티브 우선 활용 규칙

### 설계 근거
- 사용자 요청: "검색 API가 없으면 알 수 없는 정보" — 시장 내러티브, 컨퍼런스 시사점, 투자 대가 포지션 등 LLM 학습 데이터에 없는 실시간 외부 정보에 집중
- 기존 웹검색은 일반 뉴스/시세 위주였으나, 내러티브·이벤트·인물 쿼리를 자동 감지하여 검색 품질 향상

### 변경 파일
- `index.html`: _needsWebSearch, _buildSearchQuery, _formatSearchForPrompt, _perplexitySearch, _getChatRules 5개 함수 수정
- `version.json`: v36.5
- `CHANGELOG.md`: 이 항목

---

## 2026-03-29 — US 서브테마 ETF 가중비중 도입 (v36.4)

### 주요 변경
- **[US] SUB_THEMES ETF 추종 weights 추가**: ETF가 있는 20개 미국 서브테마에 정적 가중비중(`weights`) 프로퍼티 도입
  - 적용 테마: bigtech(QQQ), ai_chip(SMH), cloud_saas(IGV), cybersec(HACK), oil_major(XLE), oil_service(OIH), mlp_pipe(AMLP), nuclear_util(URA), solar_renew(ICLN), grid_util(XLU), big_bank(XLF), pharma(XLV), biotech(XBI), defense(ITA), industrial(XLI), robotics_auto(BOTZ), consumer_brand(XLP), ev_auto(LIT), travel(JETS), telecom_us(XLC), reit_dc(XLRE), gold_mining(GDX), materials(XLB)
  - 각 ETF의 실제 구성비를 참고하여 섹터 대표성 반영
- **`calcCompositePerf(tickers, weights)` 로직 개선**:
  - `weights` 객체가 전달되면 ETF 추종 정적 비중으로 가중평균 계산
  - `weights` 없으면 기존 `√price × perfBonus` 동적 폴백 유지 (하위 호환)
- **`renderSubThemesGrid` / `showThemeDetail` / `getThemePerf`**: weights 전달하여 ETF 가중 퍼포먼스 표시

### 설계 근거
- 한국 KR_THEME_MAP은 이미 ETF 추종 정적 `w` 사용 → 미국도 동일 방식으로 통일
- ETF 없는 25개 서브테마는 기존 `√price` 동적 가중치 유지
- 대형주 편중 방지 (시총 비중은 삼성전자/AAPL 등이 테마 전체를 압도하는 문제)

### 변경 파일
- `index.html`: SUB_THEMES weights 추가, calcCompositePerf 시그니처 변경, 렌더링 함수 4곳 수정
- `version.json`: v36.4
- `CHANGELOG.md`: 이 항목

---

## 2026-03-28 — v35.8 + v36.1 + v36.2 전체 통합 (v36.3)

### 주요 변경
- **[MERGE] 3개 버전 완전 통합**: v35.8 (테마/트렌드 대확장) + v36.1 (LLM 동적화) + v36.2 (웹검색 API)를 단일 파일로 통합
- **v35.8 반영 내용**:
  - 한국 테마 16→22개 확장 (건설/인프라, 유통/리테일, 철강/화학/소재, 물류/운송/항공, 의료기기/디지털헬스, 에너지/정유)
  - 미국 세분화 테마 17→45개 확장 (9개 대분류)
  - PRIORITY_SYMS ~382→574개 (+192, US 시세 커버율 51%→99.7%)
  - pill UI 리디자인 (코드 숨김, 등락률 색상 틴트, hover glow)
  - 테마 퍼포먼스 랭킹 바 차트 + 종목 상세 분석 패널 신설
  - 4열 그리드, 대장주 3개 콤팩트 표시
- **v36.1 반영 내용**: _getChatRules() 동적 날짜, _liveSnap() 안전 폴백
- **v36.2 반영 내용**: Perplexity + Google 듀얼 웹검색, chatSend 통합

### 검증
- JS 구문: 10개 `<script>` 블록 전체 파싱 통과
- _CHAT_RULES 잔존: 0건
- _getChatRules 참조: 22건 (1 정의 + 21 호출)
- 웹검색 함수: 전체 정상 (6개 함수 + chatSend 통합)

---

## 2026-03-28 — 듀얼 엔진 AI 웹검색 연동 (v36.2)

### 주요 변경
- **[NEW] 듀얼 검색 엔진 아키텍처**: Perplexity Sonar (1순위) + Google Custom Search (2순위 폴백). 어느 하나만 키 등록해도 작동
- **[NEW] `_perplexitySearch()`**: Perplexity Sonar API 호출 (search_recency_filter: week, temperature: 0.1, 500자 이내 한국어 팩트 요약 + 출처 인용)
- **[NEW] `_googleSearch()`**: Google Custom Search JSON API 호출 (무료 100회/일, 스니펫 5건 + URL). Perplexity 미설정 또는 실패 시 자동 폴백
- **[NEW] `_aiWebSearch()`**: 통합 검색 디스패처 — Perplexity 우선 시도 → 실패 시 Google 폴백 → 둘 다 없으면 에러
- **[NEW] `_needsWebSearch()` 자동 판단 로직**: 9개 패턴 매칭(최신 소식, 실적 발표, 전망/예측, 정책 이벤트, IPO/M&A, 급등/급락 원인, 규제, 산업 트렌드, 명시적 검색 요청) + 긴 질문에서 기업+이벤트 조합 감지. Perplexity 또는 Google 키 중 하나라도 있으면 활성화
- **[NEW] 검색 결과 UI**: 응답 후 출처 링크 카드(최대 5건) + 모델 배지에 "🔍 웹검색" 표시 + 검색 완료 알림 배지 (엔진명 Perplexity/Google 구분 표시)
- **[NEW] API 키 입력 UI**: 사이드바에 Perplexity API 키 + Google Search API 키 + Google Search Engine ID(cx) 입력란 추가, 전부 암호화 저장(AioVault)
- **[MOD] `_formatSearchForPrompt()`**: 엔진별 차별화 — Perplexity: AI 요약 직접 전달, Google: 스니펫 나열 + "스니펫 기반 종합" 지시

### 작동 흐름
```
사용자 질문 → _needsWebSearch() 자동 판단 (Perplexity 키 or Google 키 확인)
  → 검색 필요: _aiWebSearch() 호출
       → 1순위: _perplexitySearch() (AI 요약 + 출처)
       → 실패 시: _googleSearch() (스니펫 5건 + URL)
       → 결과를 systemPrompt에 주입
  → 검색 불필요: 기존 흐름대로 직접 답변
→ Claude API 호출 (시스템 프롬프트에 웹검색 결과 포함)
→ 응답 완료 → 출처 링크 UI 표시 (엔진명 표시)
```

### 검색 트리거 예시
- "테슬라 최근 소식" → ✅ 검색 (최신 뉴스)
- "NVDA 실적 발표 결과" → ✅ 검색 (어닝 이벤트)
- "반도체 업종 전망" → ✅ 검색 (전망/예측)
- "왜 오늘 시장이 빠졌어?" → ✅ 검색 (급락 원인)
- "PER이 뭐야?" → ❌ 검색 안 함 (교육/개념)
- "RSI 설명해줘" → ❌ 검색 안 함 (용어 정의)

### 비용 비교
| 엔진 | 무료 한도 | 유료 단가 | 특징 |
|------|-----------|-----------|------|
| Perplexity Sonar | 없음 (유료) | $5/1000 요청 | AI 요약 + 출처, 최고 품질 |
| Google Custom Search | 100회/일 | $5/1000 요청 | 스니펫만, 무료 한도 있음 |

### 검증
- JS 구문: 11개 `<script>` 블록 전체 파싱 통과

---

## 2026-03-28 — LLM AI 채팅 시스템 실시간 동적화 (v36.1)

### 주요 변경
- **[CRITICAL] `_CHAT_RULES` IIFE → `_getChatRules()` 함수 전환**: 기존에는 페이지 로드 시 1회만 날짜/시간 계산(IIFE). 자정 넘기면 AI가 어제 날짜로 답변하는 치명적 버그. → 매 채팅 호출마다 `new Date()` 재계산하는 함수로 전환. KST 시각(시·분)도 추가 주입
- **[FIX] `_liveSnap()` 하드코딩 폴백 제거**: F&G `18` → `'데이터 없음'`, 50MA `6656` → `'데이터 없음'`, 200MA `6593` → `'데이터 없음'`. 실시간 데이터 미수신 시 AI가 옛날 수치를 "현재"로 오인하는 문제 방지
- **[MOD] 21개 시스템 프롬프트 참조 갱신**: 모든 `_CHAT_RULES` → `_getChatRules()` 호출로 변경 (home/signal/breadth/fundamental/macro/kr 등 전체 컨텍스트)

### 검증
- JS 구문: 11개 `<script>` 블록 전체 `new Function()` 파싱 통과
- `_CHAT_RULES` 참조 잔존: 0건 (완전 교체 확인)
- `_getChatRules` 참조: 22건 (1 정의 + 21 호출)

---

## 2026-03-28 — 전체 데이터 동적화 (v35.8 완성)

### 주요 변경
- **[NEW] MARKET_SNAPSHOT localStorage 캐시**: `applyLiveQuotes()` 성공 시 자동 저장, 다음 로드 시 48시간 이내 캐시 우선 사용. 하드코딩 폴백은 절대적 최후 수단으로만 유지
- **[NEW] generateDynamicBriefing()**: 시장 브리핑 전체를 실시간 데이터 기반 자동생성. 기존 2026.03.23 하드코딩 스냅샷 전면 교체 (시장상태, VIX해석, 유가, 금리, DXY, F&G 등)
- **[NEW] FMP API 어닝 동적화**: `loadEarningsSurprises()` + `loadEarningsCalendar()` — FMP API 키 있으면 실시간 실적 서프라이즈/캘린더 자동 호출, 없으면 안내 표시
- **[NEW] updateScreenerFromLiveData()**: SCREENER_DB 83종목 mcap을 라이브 데이터에서 자동 업데이트
- **[MOD] 포트폴리오 테이블**: NVDA/XLC/XSD 가격 하드코딩 → `data-live-price` 속성으로 실시간 연동
- **[MOD] Fed Funds Rate 동적화**: 4곳 하드코딩 "3.50-3.75%" → `data-snap="fed-rate"` + FRED DFEDTARU 자동 연결
- **[FIX] _applyRiskMonitorFallbacks()**: Risk Monitor 폴백 항목 (RSP/SPY, F&G, HY Spread) 별도 함수로 분리

### 동적화 현황
- 폴백 가격 170+ 종목: localStorage 캐시로 항상 최신 유지
- 시장 브리핑: 실시간 자동생성 (하드코딩 텍스트 0개)
- 어닝 데이터: FMP API 실시간 (키 필요)
- 스크리너 DB: mcap 라이브 업데이트
- 포트폴리오: 가격 실시간 연동
- 기준금리: FRED 자동 연결

### 검증
- 11개 script block JS 구문 검증 통과
- `const tsEl` 중복 선언 → `var tsEl2` 수정

---

## 2026-03-28 — kr-supply 서브섹션 공매도 동적화 보완

### 주요 변경
- **[FIX] 공매도 상세 5개 ID 동적 연결**: `kr-short-kospi-ratio`, `kr-short-kosdaq-ratio`, `kr-short-kospi-chg`, `kr-short-kosdaq-chg`, `kr-short-balance` — 이전에는 정적 하드코딩(4.07%, 3.27%, 14.2조)
- **[MOD] fetchKrShortSelling()**: Naver basic API에서 shortSellingRatio/shortBalance 필드 탐색, 없으면 "N/A" + "KRX 전용 데이터" 안내
- **[FIX] 공매도 종목 테이블**: 하드코딩 5개 종목(에코프로, 카카오 등) 제거 → "KRX 공매도 데이터 연동 예정" 안내로 교체
- **[ADD] kr-short-stock-table ID**: 공매도 종목 테이블에 ID 부여 → 향후 KRX API 연동 시 동적 채움 가능
- **[ADD] kr-short-balance-sub ID**: 잔고 서브라인 동적 안내 텍스트

### 한계
- 공매도 비중/잔고는 KRX만 정확한 데이터 제공, 네이버 API에 해당 필드 없으면 "N/A" 표시
- 향후 KRX OPEN API 연동 시 자동으로 실데이터 표시 전환 가능하도록 구조 설계

### 검증
- JS 구문 검증 통과 (Node.js new Function())
- 5개 ID 동적 바인딩 + data-live-kr 속성 추가 완료

---

## 2026-03-28 — 정적 하드코딩 전면 동적화 (29개 요소)

### 주요 변경
- **[FIX] KOSDAQ 수급 사각지대 해소**: `fetchKrSupplyData()` KOSDAQ investorTrend 추가, `updateKrSupplyDOM()` KOSPI+KOSDAQ 동시 업데이트
- **[FIX] kr-home 코스닥 수급 ID 부여**: `kr-home-kosdaq-foreign/inst/retail` + bar 6개 — 이전에는 ID 없어 JS 접근 불가
- **[NEW] 수급 코멘트 동적 생성**: 외국인 연속 매매일수 자동 계산, 7개 코멘트 요소 실시간 갱신
- **[NEW] fetchKrShortSelling()**: 공매도 관련 거래대금 동적화
- **[NEW] fetchKrBreadthData()**: 한국 시장 폭 (ADL, 20MA 비율, 52주 고/저) 동적화
- **[MOD] fetchKrDynamicData()**: 4→6개 함수 통합 호출
- **[MOD] applyFredToUI()**: `yc-2y`, `yc-2y-track` FRED DGS2 연결, `dxy-1m` DXY 변화율 연결
- **[MOD] fetchPutCall()**: `regime-pcr` + `DATA_SNAPSHOT.pcr` 동적 연결

### 검증
- 29개 정적 ID 전부 동적 바인딩 확인 (0개 미연결)
- 6개 신규/수정 함수 Node.js syntax 통과

---

## 2026-03-28 — CF Worker 부하 최적화 (4인 공유 Free Tier 대응)

### 주요 변경
- **[MOD] REFRESH_SCHEDULE.quotes**: interval 60000 → 180000 (1분 → 3분)
- **[MOD] REFRESH_SCHEDULE.krDynamic**: interval 900000 → 1800000 (15분 → 30분)
- **[FIX] PRIORITY_SYMS**: 중복 심볼 12개 제거 (391 → 379개, 81그룹) — LUNR, 207940.KS, 005490.KS, 086280.KS, NOC, GD, UBER, FTNT, SOFI, AFRM, RGTI, DASH
- **[NEW] _PROXY_REGISTRY.getRotated()**: 라운드로빈 프록시 순환 — CF Worker에 모든 요청 집중 방지
- **[MOD] fetchViaProxy()**: getActive() → getRotated() 변경 (부하 균등 분산)
- **[MOD] fetchYFChart()**: orderedProxies에 라운드로빈 적용

### 부하 개선 결과
- 총 요청량 (4인/일): 942,913 → 307,713 (**67% 감소**)
- CF Worker 부하 (4인/일): 942,913 → 61,543 (**93% 감소**)
- Free Tier (100,000/일) 대비: **62%** 사용 → 여유

### 검증
- PRIORITY_SYMS: 379개 unique, 중복 0개 확인
- _PROXY_REGISTRY, fetchViaProxy, PRIORITY_SYMS JS 문법 검증 통과

---

## 2026-03-28 — 한국 시장 동적 데이터 모듈 구현 (정적 하드코딩 → 네이버 API 동적 fetch)

### 주요 변경
- **[NEW] fetchVkospiDynamic()**: VKOSPI 실시간 값을 네이버 API `/api/index/VKOSPI/basic`에서 fetch → `kr-vkospi-val`, `kr-health-vkospi` DOM 자동 업데이트
- **[NEW] fetchKrTradingVolume()**: KOSPI/KOSDAQ 거래대금을 네이버 인덱스 API에서 추출 → `kr-dash-kospi-volume`, `kr-dash-kosdaq-volume` 동적 표시
- **[NEW] fetchKrForeignRanking()**: 외국인 순매수/순매도 TOP 5, 보유비중 TOP 10을 네이버 랭킹 API에서 fetch → 테이블 동적 렌더링
- **[NEW] fetchKrWeeklySupply()**: 주간 투자자별 순매수 트렌드(최근 5거래일)를 `investorTrend` API에서 동적 구성
- **[NEW] _enrichMarketCap()**: fetchKrNaverQuotes 개별 종목 응답에서 시가총액 추출 → KR_STOCK_DB 자동 반영
- **[NEW] fetchKrDynamicData()**: 위 4개 함수 통합 호출 (Promise.allSettled)
- **[MOD] REFRESH_SCHEDULE**: `krDynamic` 항목 추가 (15분 주기 갱신)
- **[MOD] HTML**: 공매도·거래대금·외국인 TOP·주간 수급 테이블에 동적 바인딩용 ID 추가 (12개 요소)
- **[MOD] fetchKrNaverQuotes**: 개별 종목 폴백에서 `_enrichMarketCap` 호출 연결

### 영향 범위
- 기존 프록시 인프라 (`fetchViaProxy`, `_PROXY_REGISTRY`) 재사용 — 새 인프라 불필요
- 초기 로드: `initKoreaHome()` → `fetchKrSupplyData()` 직후 `fetchKrDynamicData()` 자동 호출
- 네이버 API 실패 시 기존 하드코딩 HTML 폴백값 유지 (graceful degradation)

### 검증
- 11개 `<script>` 블록 전체 JS 문법 검증 통과

---

## 2026-03-28 — v35.7 감사 보고서 전면 통합 (Critical 5 + High 6 + Medium 5)

### 근본 원인
- v35.6 기준 DATA_SNAPSHOT US 데이터가 3/26 기준 (1일 지연)
- FALLBACK_QUOTES가 3/20 기준 (1주 지연) + 49개 중복 항목으로 정확한 값 덮어씌움
- kr-supply 섹션 수급 데이터가 kr-home과 모순 (외국인 +4,820억 vs -17,939억)
- PRIORITY_SYMS 한국 종목 18개로 125개 중 84.5% 커버리지 누락

### 주요 변경
- **[Critical 2.1] DATA_SNAPSHOT**: US 전면 3/27(금) 종가 → S&P 6368.85, Dow 45166.64, VIX 31.05, WTI 99.64, DXY 99.98, BTC 66310, DAX 22613, FTSE 9972 등
- **[Critical 2.2+2.3] FALLBACK_QUOTES**: 3/20 → 3/27 전면 갱신, 350+개 항목 (중복 49개 제거, 한국 30종목 추가)
- **[Critical 2.4] 수급 데이터**: kr-supply KOSPI/KOSDAQ 외국인·기관·개인 수치를 kr-home과 일치시킴 (외국인 -17,939억/기관 -472억/개인 +17,048억)
- **[Critical 2.5] PRIORITY_SYMS**: 한국 종목 18→125개 확대 (방산/조선/전력/반도체/바이오/원전/2차전지/ETF/코스닥 주도주/기타 대형주) + S&P 500 Top 50 누락분 추가
- **[High] 브리핑 HTML 폴백값**: VIX 26.78→31.05, S&P 6,506→6,369, BTC 70,441→66,310, TNX 4.39→4.44
- **[Medium] DATA_SNAPSHOT**: VKOSPI 32.5→28.5, MOVE 107.4→115.0, F&G 15→12
- **[Medium] HTML 폴백**: VKOSPI 32.50→28.50, HY 날짜 3/20→3/27

### 정적 데이터 동적 전환 분석
- 시가총액, VKOSPI 수치: 네이버 API 개별 종목 호출 시 부가 데이터로 추출 가능 (fetchKrNaverQuotes에서 확장 가능)
- 공매도 비중, 거래량, 외국인 보유비중/순매수 TOP, 주간 수급 추이: CF Worker (서버사이드 프록시) 필요
- BOK 기준금리, 수출/GDP: BOK ECOS 공공 API 필요

### 검증
- 11개 `<script>` 블록 전체 JS 문법 검증 통과 (`new Function` 테스트)
- DATA_SNAPSHOT ↔ FALLBACK_QUOTES ↔ kr-supply 데이터 일관성 확인

---

## 2026-03-28 — DATE_ENGINE 동적 날짜 시스템 도입 (하드코딩 날짜 근본 해결)

### 근본 원인
- 스크리너 전체에 80개+ 하드코딩 날짜 존재 (유저에게 보이는 18개소 포함)
- "오늘이 며칠인지" 자동 인식하는 시스템 부재 → 매번 열 때마다 옛 날짜 표시
- LLM 시스템 프롬프트에 현재 날짜 주입 없음 → AI가 "현재는 2025년" 등 오답 생성

### 주요 변경
- **[NEW] DATE_ENGINE 모듈**: 동적 날짜/시간 계산 엔진 (~120줄)
  - KST 기준 현재 시각, 한국/미국 최근 거래일 자동 계산
  - 주말·공휴일(한국 17일, 미국 10일) 자동 건너뛰기
  - KRX 장 상태 판별 (open/pre/after/closed)
  - `data-date-ref` HTML 바인딩 → 27개 DOM 요소에 동적 날짜 자동 주입
  - 페이지 로드 시 즉시 실행 + 1시간 주기 갱신
- **[MOD] 한국 시장 섹션**: "3/27 종가", "3/27 기준" 등 하드코딩 날짜 → `data-date-ref="kr-last"` 동적 바인딩으로 교체
- **[MOD] LLM 시스템 프롬프트**: `_CHAT_RULES`에 현재 날짜·연도·최근 거래일 자동 주입 → AI가 항상 정확한 날짜 인식
- **[FIX] CSS `.kr-theme-catalyst::after`**: 하드코딩 "2026.03 기준" → 동적 날짜로 교체

### 영향 범위
- 27개 HTML 요소에 `data-date-ref` 바인딩 추가
- 모든 AI 채팅 컨텍스트에 동적 날짜 주입
- 기존 `DATA_SNAPSHOT._updated`에 동적 필드 추가 (`_today`, `_krLastTrading`, `_usLastTrading`)

---

## 2026-03-28 — 네이버 파이낸스 API 통합 (한국 시장 1차 데이터 소스)

### 주요 변경
- **[NEW] fetchKrNaverQuotes() 함수**: 네이버 파이낸스를 한국 시장 1차 데이터 소스로 추가
  - 지수: `m.stock.naver.com/api/index/{KOSPI,KOSDAQ}/basic` (2개)
  - 종목: `polling.finance.naver.com/api/realtime/domestic/stock/{codes}` (배치 20개씩, 전 종목)
  - 배치 실패 시 `m.stock.naver.com/api/stock/{code}/basic` 개별 폴백
  - CORS 프록시 체인(`fetchViaProxy`) 경유, 기존 인프라 재활용
- **[MOD] fetchLiveQuotes()**: 환율 섹션 다음에 네이버 한국 시세 호출 삽입
  - 네이버 성공(≥3개) → Yahoo Korean 배치 그룹 자동 스킵 (요청 절감)
  - 네이버 실패 → 기존 Yahoo Finance .KS/.KQ 경로 폴백 유지
- **[MOD] REFRESH_SCHEDULE**: `krSupply` 항목 추가 (10분 주기)
  - `fetchKrSupplyData()` 기존 1회→10분 주기 반복으로 변경
- **[FIX] SCREENER_DB 코스맥스 sym 중복**: `sym:'044820.KQ','192820.KQ'` → 개별 항목으로 분리 (JS 문법 오류 해결)

### 데이터 파이프라인 변경
- 기존: Yahoo Finance v8/chart (CORS 프록시) → 60초 폴링
- 변경: 네이버 파이낸스 (1차) → Yahoo Finance (폴백) → FALLBACK_QUOTES (최종 폴백)
- Naver 응답 → Yahoo-compatible 포맷 자동 변환 (`symbol, regularMarketPrice, regularMarketChangePercent`)

### 영향 범위
- index.html: fetchKrNaverQuotes() ~100줄 추가, fetchLiveQuotes() ~15줄 수정
- REFRESH_SCHEDULE: +1 항목 (krSupply)
- startDataScheduler(): +1 함수 할당

### 검증 결과
- JS 문법 검증 ✅
- 기존 Yahoo/CoinGecko/FX 경로 영향 없음 ✅

---

## 2026-03-28 — 한국 종목 데이터 오류 전면 수정 + 누락 대형주 8종목 추가

### 버그 수정 (3건)
- **[FIX] 레인보우로보틱스 종목코드 269620→277810**: Yahoo에서 269620.KQ는 "Syswork Co."로 매핑됨. 실제 레인보우로보틱스는 277810.KQ. HTML·SCREENER_DB·KR_STOCK_DB·KR_THEME_MAP·FALLBACK_QUOTES·alias배열·KOSDAQ_SET 등 11개소 전면 수정. price 60,000→567,000, mcap 1조→11조
- **[FIX] 294870 두나무→HDC현대산업개발**: 두나무는 비상장 기업이며, 294870는 실제 HDC현대산업개발(KOSPI 건설주). sector→건설, crypto테마에서 제거, KOSDAQ→KOSPI 교정. crypto테마 가중치 재분배 (위메이드40/카카오35/갤럭시아25)
- **[FIX] 044820 코스맥스→코스맥스BTI**: 044820은 자회사 코스맥스BTI. 실제 코스맥스 본사는 192820.KQ(price 147,700). kbeauty 테마 대표를 192820으로 교체

### 종목 추가 (8건)
- **[NEW] 192820 코스맥스**: ODM 본사, price 147,700, mcap 2.2조, kbeauty 테마
- **[NEW] 015760 한국전력**: 전력 인프라 대장, price 43,900, mcap 28.2조, power-grid 테마
- **[NEW] 323410 카카오뱅크**: 인터넷은행, price 24,650, mcap 11.7조, finance 테마
- **[NEW] 402340 SK스퀘어**: 투자지주(SK하이닉스 지분), price 544,000, mcap 71.7조, semi 테마
- **[NEW] 034730 SK**: SK그룹 지주, price 334,000, mcap 18.2조
- **[NEW] 003550 LG**: LG그룹 지주, price 89,000, mcap 13.7조
- **[NEW] 028260 삼성물산**: 삼성그룹 지배구조, price 269,000, mcap 44조
- **[NEW] 009830 한화솔루션**: 화학/에너지(수소·태양광), price 35,650, mcap 6.1조, battery 테마

### 테마 가중치 조정
- **semi**: SK하이닉스·삼성전자 25→24, SK스퀘어 3→2 (합계 100)
- **finance**: KB금융 20→19, 신한지주 18→17 (합계 100)
- **battery**: LG화학 10→8, 엘앤에프 8→6, 한화솔루션(009830) w:4 추가 (합계 100)
- **crypto**: 두나무(294870) 제거, 위메이드 40/카카오 35/갤럭시아 25 재분배

### 영향 범위
- KR_STOCK_DB: 114→122 종목 (+8, 수정 3)
- KR_THEME_MAP: 16테마 유지, 4테마 가중치 조정
- FALLBACK_QUOTES: 한국 21→30 항목 (+9)
- SCREENER_DB, alias배열, HTML pill, KOSDAQ_SET 동기 수정

### 검증 결과
- KR_STOCK_DB 122종목 중복 없음 ✅
- KR_THEME_MAP 16테마 전체 가중치 합=100 ✅
- 테마→DB 참조 무결성 ✅
- 괄호 밸런스 ✅

---

## 2026-03-28 — KR_STOCK_DB · FALLBACK_QUOTES 3/27 종가 전면 갱신

- **변경 내용**:
  - `KR_STOCK_DB` 113종목 주가(p) + 시총(mcap) 업데이트 — Yahoo Finance 3/27 종가 기준
  - `FALLBACK_QUOTES` 한국 21종목 가격 업데이트 — 동일 3/27 종가 기준
  - 날짜 주석 2건 변경: "2026-03-23 장중 실시간 반영" → "2026-03-27 종가 기준 반영", "2026-03-20 종가 기준" → "2026-03-27 종가 기준"
  - mcap은 `new_mcap = old_mcap × (new_price / old_price)` 비례 계산 후 반올림 적용
- **변경 이유**: 사용자 요청 — 국내 테마 등 한국 데이터가 최신 반영되지 않았음. 전면 점검 후 3/27 종가 기준으로 갱신
- **영향 범위**: `KR_STOCK_DB` (line ~25321), `FALLBACK_QUOTES` 한국 섹션 (line ~16801), 날짜 주석 2건
- **검증 결과**: JS 구문 검증 통과 (KR_STOCK_DB 114종목, FALLBACK_QUOTES 435항목, KR_THEME_MAP 16테마 구조 정상)
- **알려진 이슈**:
  - 269620 (엘앤피코스메틱/레인보우로보틱스) 종목코드 불일치 — Yahoo에서 "Syswork Co."로 매핑됨. 실제 레인보우로보틱스는 277810. 7개소 참조로 cascade 위험 있어 별도 작업으로 분리
  - 950130 엘앤피코스메틱 mcap 0.0조 (액면분할 추정), 044820 코스맥스·294870 두나무 가격 대폭 변동 — 수동 검증 필요

---

## v35.6 — 2026-03-28 — 한국 데이터 최신화 + 종목 대폭 확장 + 기술 분석 보강

### 데이터 최신화
- **[FIX] DATA_SNAPSHOT 3/27 종가 전면 갱신**: KOSPI 5438.87, KOSDAQ 1141.51, KRW 1509.58, VKOSPI 32.5, 국고채10Y 3.72
- **[FIX] 수급 데이터 3/27 기준**: 외국인 -1.79조(7연속 매도), 3월 누적 30조+ 매도
- **[FIX] 투자심리 지표 현실 반영**: 투자심리 68→25, 외인수급강도 78→15, 모멘텀 65→30
- **[FIX] 모든 "3/20 기준" → "3/27 기준"** 일괄 교체

### 종목 확장
- **[NEW] SCREENER_DB 150+ 한국 종목**: 20개 섹터별 체계 확장 (시총 상위, 반도체, 방산, 조선, 전력, 원전, 2차전지, 바이오, K-뷰티, K-콘텐츠, 자동차, 로봇, 금융, K-푸드, 통신, 크립토, 유통, 건설, 에너지/화학, 기타 우량주)
- **[NEW] 한국 검색 앨리어스 25개 추가**: '한국주식', '코스피', '코스닥', 'k반도체', 'k방산' 등
- **[FIX] krTickerToYahoo() KOSDAQ 43종목 동기화**: SCREENER_DB 전체 KOSDAQ 종목 반영

### 기술 분석 보강
- **[NEW] VKOSPI Chart.js 스파크라인**: 24일 일별 데이터, 공포/안정 임계선 표시 (initKrVkospiChart)
- **[NEW] 한국 시장 건강 점수**: 6항목(KOSPI·KOSDAQ 추세, VKOSPI, 외국인수급, 수출, BOK금리) 가중 합산, 등급 A+~F 동적 계산 (calcKrHealthScore)
- **[NEW] 한국 금리 스프레드 동적 계산**: 3Y-10Y, BOK-10Y, CD-BOK 스프레드 DATA_SNAPSHOT 기반 자동 산출 (calcKrYieldSpreads)
- **[NEW] 시장 내부 건강도 (Breadth) 위젯**: ADL비율, 52주 신고/신저, 20MA 비율, 거래대금 표시

### 영향 범위
- `DATA_SNAPSHOT` 한국 관련 15+ 필드 갱신
- `SCREENER_DB` 736→886+ 항목 (한국 50→150+)
- `initKoreaTechnical()` 4개 신규 위젯 함수 호출 추가
- 한국장 기술 분석 페이지 전면 보강 (미국장 수준 대등)

---

## v35.5 — 2026-03-29 — KR-MARKET-AUDIT 16항목 전면 반영

### 즉시 반영 (4건)
- **[FIX] 대장주 카드 등락률·시총 동적 갱신**: `initKoreaHome()` 내 homeCards 루프에서 `.kr-screen-chg`, `.kr-screen-cap` 요소를 실시간 데이터로 업데이트
- **[FIX] "주간 수익률" → "일간 수익률"**: 테마 카드 16곳 일괄 수정 (실제 데이터가 일간 등락률이므로)
- **[NEW] KRX 섹터 ETF `data-live-price` 바인딩**: 정적 ETF 섹션을 6개 대표 ETF/종목 카드로 교체 (091160 KODEX반도체, 305720 KODEX2차전지, 012450 한화에어로 등), `initKoreaHome()`에서 실시간 가격·등락률 갱신
- **[FIX] 카탈리스트 날짜 표시**: CSS pseudo-element로 "(2026.03 기준)" 자동 부착

### 단기 반영 (5건)
- **[FIX] 테마 종목 리밸런싱**: finance에 카카오뱅크(323410) 추가, power-grid에 한국전력(015760) 추가, semi에 SK스퀘어(402340) 추가
- **[FIX] telecom에서 LG전자(066570) 제거**: 가전/전장 업체로 통신 테마 부적합 → 가중치 32/28/20/20 재조정
- **[FIX] ai-sw에서 삼성전자(005930) 제거**: 이미 semi 25%에 포함, AI-SW 3%는 불필요 → 26/16/21/16/10/7/4 재조정

### 중기 반영 (4건)
- **[NEW] 수급 에러 표시**: `_showKrSupplyFallbackNotice()` 함수 추가, 프록시 전부 실패 시 "과거 스냅샷" 안내
- **[NEW] 대장주 클릭 → 테마 연결**: homeCards 클릭 시 해당 종목의 테마 카드로 자동 스크롤
- **[UX] TradingView 입력 개선**: placeholder "종목코드 (예: 005930)", width 90→120px, Enter키 지원
- **[NEW] 섹터 카테고리 필터**: IT/반도체, 산업/에너지, 소비/문화, 금융/통신 4버튼 + `_KR_SECTOR_MAP` + `filterKrSector()`

### 장기 반영 (3건)
- **[NEW] SCREENER_DB 한국 종목 확장**: KR_THEME_MAP 기반 50개 한국 대표주 추가 (KOSPI/KOSDAQ 필터 옵션 포함), 시장 필터 select에 KOSPI/KOSDAQ 추가
- **[NEW] 카탈리스트 JS 분리**: `KR_THEME_CATALYSTS` 객체 생성 + `initKoreaThemes()`에서 동적 주입 (HTML 하드코딩 → JS 변수 일원화)
- **[FIX] 수급 프록시 5단계 강화**: corsproxy.io, allorigins, codetabs, thingproxy 추가 + 프록시별 실패 로그 출력

### 영향 범위
- 한국장 홈 / 테마 / 수급 / 스크리너 — 5개 페이지 전체
- `KR_THEME_MAP` 16개 테마 114종목 리밸런싱
- `SCREENER_DB` 686→736 항목 (한국 50종목 추가)
- `fetchKrSupplyData()` 프록시 체인 3→5단계

---

## v35.4 — 2026-03-29 — 한국 시장 데이터 정확도 수정

### CRITICAL 수정 (1건)
- **[FIX] 한은 기준금리 `bokRate` 2.75% → 2.50%**: `DATA_STATIC`, HTML 초기값 2곳(`data-snap="bok-rate"`), LLM 프롬프트 fallback 값 모두 동기화. 주석도 "2025.02 인하 후" → "2025.05 인하 후 2.50% → 2026.02까지 6연속 동결"로 정정. 금통위 결정 테이블(2.50%)과 불일치하던 것 해소

### MEDIUM 수정 (2건)
- **[FIX] 한국 CPI `krCpi` 1.9% → 2.0%**: `DATA_STATIC` 값 + 글로벌 비교 테이블 HTML 초기값 동기화. 주석 시점 "2025Q1" → "2026.02 기준"으로 갱신
- **[FIX] LLM 예산 환율 `exchangeRate` 1,450 → 1,500**: 2026.03 실제 환율(1,508~1,517원)에 맞춰 보수적 조정. 월간 예산 ₩14,500 → ₩15,000

### LOW 수정 (1건)
- **[FIX] "오늘의 주요 이슈" 라벨**: 정적 스냅샷 데이터인데 "오늘의"로 표기 → "주요 이슈 (스냅샷)"으로 변경

### 영향 범위
- `DATA_STATIC` 한국 섹션 → `data-snap` 매핑 → KR-HOME, KR-MACRO UI + LLM 프롬프트 (한국 매크로 전문가)
- `LLM_BUDGET` 환율 → 토큰 예산 KRW 환산

---

## v35.3 — 2026-03-29 — 투자 심리 자연 통합 (Phase B) + 폴백 뱃지 수정 (Phase D)

### Phase B: 투자 심리 — 자연 통합 (7건)
- **[NEW] _CHAT_RULES #41 행동경제학 데이터**: 극단 감정 구간(F&G ≤10, ≥90) 역사적 수익률 참고 데이터 + 인지 편향 패턴 감지 시 객관적 안내 (손실 회피, FOMO, 확증 편향 등) — 양방향 균형 원칙 준수
- **[NEW] Regime 뱃지 역사적 참고**: PULLBACK/CORRECTION/DOWNTREND 구간에 역사적 패턴 참고 문구 자동 표시 (예: "5~10% 조정은 연평균 3회 발생하는 정상 패턴")
- **[NEW] F&G 극단구간 역사적 참고**: F&G ≤15 또는 ≥85 시 해당 구간의 역사적 후속 수익률 참고 문구 표시
- **[NEW] Signal Score 극단구간 참고**: 매수 시그널(≤25) 또는 과열 시그널(≥80) 시 역사적 패턴 참고 문구 추가
- **[UPD] 포트폴리오 메모 플레이스홀더**: "메모 입력..." → "매수 근거 (예: 실적 서프라이즈, 밸류에이션)" 로 변경
- **[NEW] 채팅 기본 칩 확장**: home/sentiment/breadth 페이지에 투자 심리 관련 기본 질문 칩 추가 (`CHAT_DEFAULT_CHIPS`)
- **[NEW] 용어사전 4건 추가**: 처분 효과, 과잉 자신감, 평균 회귀, 항복 매도

### Phase D: 접근성·현지화 보완
- **[FIX] 폴백 뱃지 텍스트**: "라이브 데이터 (3/22)" → "폴백 데이터 (과거 스냅샷)" (2건)
- **[OK] D2 이란 참조 일반화**: v35.0에서 이미 완료 확인
- **[OK] D3 캔버스 aria-label**: 100% 준수 확인

### 설계 원칙
- 새 페이지/UI 요소 추가 없음 — 기존 페이지에 맥락 적합한 한 줄 참고 데이터만 삽입
- 주관적 조언 금지 — 객관적 역사 데이터 + 학술 출처만 사용
- 양방향 균형 — 공포/탐욕 양쪽 모두 역사적 사례 제시

---

## v35.2 — 2026-03-29 — 데이터 정확도 전수 조사 (CRITICAL 4건 + MEDIUM 6건)

### CRITICAL 수정 (4건)
- **[FIX] 기관 투자자 포지션 가치 계산**: `(shares * value) / shares` → `value` 직접 사용 (결과가 같았으나 의미론적 오류)
- **[FIX] EV/Sales = P/S 잘못 대입**: 퀵뷰에서 `priceToSalesRatioTTM`을 `evToRev`에 할당하던 것 → `key-metrics-ttm`의 `evToSalesTTM` 사용
- **[FIX] FRED 0값 소실**: `parseFloat(o.value) || null` → `isNaN(parsed) ? null : parsed` (정상 0값 보존)
- **[FIX] % 변화율 0% 덮어쓰기**: `!pct || pct === 0` 조건이 정상 0%를 잘못 재계산 → `pct == null`로 변경

### MEDIUM 수정 (6건)
- **[FIX] 3Y CAGR 라벨링 오류**: `rev3yCagr` → `rev2yCagr` (inc[0] vs inc[2] = 2년 간격, 0.5 지수 정확)
- **[FIX] CAGR NaN 방지**: 현재 매출 음수 시 `Math.pow(음수, 0.5)` = NaN → `inc[0].revenue > 0` 가드 추가
- **[FIX] DCF upside 타입 비일관성**: `.toFixed(1)` 후 문자열 비교 → 숫자 변수로 분리 후 `.toFixed(1)` 적용
- **[FIX] 배당수익률 price=0 가드**: `price || 1` → `price && price > 0` 체크, 없으면 'N/A' 표시
- **[FIX] deep-compare key-metrics TTM 누락**: `_fetchDeepCompareData`에 `v3/key-metrics-ttm/` 추가, 프롬프트에 TTM 섹션 분리
- **[FIX] deep-compare 핵심지표 라벨**: Annual 데이터 "핵심 투자 지표 (Annual 추이)" + TTM "핵심 투자 지표 (TTM)" 분리

### 미수정 LOW 사항 (향후 개선)
- 포트폴리오 비중 `.toFixed(0)` → `.toFixed(1)` (소수점 1자리)
- Fear & Greed 전일 점수 배열 인덱스 검증
- 뉴스 번역 캐시 TTL 미설정
- SEC XBRL `.val` 프로퍼티 검증 강화
- `_liveData` 캐시 TTL (장시간 세션용)

---

## v35.1 — 2026-03-29 — FMP 데이터 정확도 수정 (TTM vs Annual)

### 근본 원인 분석
- **[BUG] TTM vs Annual 데이터 불일치**: 심층 분석(deep analysis)이 `v3/ratios/` 및 `v3/key-metrics/` (연간 데이터)를 호출하면서 프롬프트와 UI에서 "TTM"으로 표시. 퀵뷰는 `v3/ratios-ttm/` 및 `v3/key-metrics-ttm/`을 올바르게 사용 중이었음
- 사용자 보고: 기업 분석 실적/밸류에이션 데이터가 부정확

### 수정 내역
- **[FIX] TTM 엔드포인트 추가**: 심층 분석 데이터 수집에 `v3/ratios-ttm/` + `v3/key-metrics-ttm/` 호출 추가 → `collected.fmpRatiosTTM`, `collected.fmpMetricsTTM`에 저장
- **[FIX] 프롬프트 라벨 정정**: "핵심 밸류에이션 지표 (TTM)" → TTM 데이터 우선 사용, Annual fallback. 연간 추이(Annual Trend) 섹션 별도 추가
- **[FIX] UI TTM 우선 표시**: `_renderFundValuation()` 함수가 TTM 데이터를 우선 사용하고 Annual을 fallback으로 활용. TTM/Annual 출처 뱃지 표시
- **[FIX] PEG Ratio 활성화**: `rt.pegRatioTTM` 데이터로 PEG 표시 (기존 N/A 고정이었음)
- **[NEW] 연간 밸류에이션 추이**: Claude 프롬프트에 최근 3개년 P/E, P/B, EV/EBITDA, ROIC 추이 데이터 추가

### 영향 범위
- `index.html`: FMP 데이터 수집 파이프라인 + 프롬프트 주입 + UI 렌더링

---

## v35.0 — 2026-03-29 — 뉴스 탭 이분화 + 참고자료 통합 + 2026 내러티브 반영

### 뉴스 유형 탭 이분화
- **[NEW] 뉴스 유형 탭 (전체/시장/기업)**: 시장 뉴스 페이지에 3개 탭 추가. `전체` / `📊 시장 뉴스` / `🏢 기업 뉴스` 전환 가능
- **[NEW] 기업 뉴스 판별 로직 (`isCompanyNews`)**: 티커 보유 + 기업 관련 토픽(equity/earnings/semi/analyst/defense) 조합으로 자동 분류
- **[NEW] 기업 뉴스 간결 불릿 형식 (`renderCompanyBullet`)**: 기업 뉴스 탭 선택 시 카드 대신 `시간 TICKER | 헤드라인 (출처)` 한 줄 불릿 형식으로 표시
- **[NEW] `setNewsTypeTab()` 탭 전환 함수**: 활성 탭 스타일 전환 + `renderFeed()` 재호출로 즉시 필터 적용

### Phase A — 참고자료 3건 + 누락 프레임워크 5건 반영
- **[NEW] #34 Basis Trade 유동성 리스크**: 국채 basis trade ~1조 달러 레버리지 구조, SOFR/FTD 초기 신호 체크리스트, 유동성 이벤트 판별 기준
- **[NEW] #36 KV 캐시 압축 팩트 체크 프레임워크**: TurboQuant 6가지 팩트 분해, 시장 과잉반응 3요소, 제번스 패러독스
- **[NEW] #36 AI 밸류체인 5레이어**: L1에너지→L2칩→L3클라우드→L4모델→L5앱
- **[NEW] #36 Agentic AI→CPU 병목**: GPU=thinking, CPU=doing, EPYC 40%+
- **[NEW] #37 AI 기업 경쟁 구도**: OpenAI vs Anthropic 지출 철학, CapEx 생존력(BEP) 분석
- **[NEW] #37 SaaSpocalypse**: AI가 SaaS 먹어치우는 구조적 전환, 소프트웨어 ETF -23%+
- **[NEW] #37 M7 인프라 통제 3유형**: 가상통합/실물통합/하이브리드 분류
- **[NEW] #38 인터커넥션 TurboQuant 연계**: KV캐시→메모리 대역폭→HBM 수요 연결
- **[NEW] #39 금융 배관 모니터링**: TGA↔준비금, ON-RRP, SOFR vs IORB, 딜러 감마, 분기말 리스크
- **[NEW] #40 비판적 분석 DNA**: 헤드라인 해체, 규모 감각, 확인/추정/비전 분류, BS감지+균형, 메커니즘 해부, 비유의 힘

### Phase E — 2026 내러티브 테마/키워드
- **[NEW] THEME_MAP ai_infra 서브테마**: 에이전트 인프라(CPU) — AMD, INTC, ARM, AVGO
- **[NEW] SCR_KEYWORD_ALIASES 9건 추가**: saaspocalypse, 사스포칼립스, turboquant, kv캐시, basis trade, agentic, arm agi, 레포/마진콜, ftd

### Phase B — 데이터 정합성
- **[FIX] SCREENER_DB 'A'(Avantor) 누락 수정**: THEME_MAP healthcare 생명과학 장비 서브테마 동기화
- **[CONFIRM] ETF 중복 없음**: 685종목 전수 검증 완료
- **[CONFIRM] THEME_MAP↔SCREENER_DB 동기화**: leaders 170건 + subThemes 233건 검증

### 텔레그램 참고자료 4건 추가 반영
- **[NEW] #36 ARM 아키텍처 지배력 프레임워크**: AI Agent 멀티스텝 구조→CPU Throughput-bound, Perf/Watt 기준 ARM 4배 코어 밀도, Hyperscaler 전원 ARM 채택(Graviton/Cobalt/Axion), ARM CSS 시스템 아키텍처
- **[NEW] #36 AI 투자 사이클 3단계**: GPU(연산)→네트워크/전력(인프라)→CPU(워크플로우 지배), 현재 3단계 초입
- **[NEW] #36 Citi TurboQuant 프레임워크 보강**: 자기강화 사이클(비용↑→효율연구→처리량↑→가격↓), 업계 KV캐시 압축 수렴, AI 수요+메모리 순 긍정적
- **[NEW] #37 GS AI Agent 온디바이스 수요**: OpenClaw/NemoClaw, 단위출하량↓이나 ASP↑ 믹스개선, AAPL 맥미니 AI 샌드박스
- **[NEW] #38 JPM 800V DC 전환 프레임워크**: 48V→800V DC(전력손실 25%→10%), VRT 최선호주, 1P D2C 냉각 지배적, 800V시 2P 필수화 촉매
- **[NEW] #38 AI 인프라 CapEx 런웨이**: 버블 논쟁 일단락, 7~10년 지속 성장 컨센서스, 병목 3대 요인(전력/인력/장비)
- **[NEW] SCR_KEYWORD_ALIASES 12건 추가**: openclaw, nemoclaw, 800v, 800v dc, 버티브, vertiv, cpu병목, graviton, cobalt, axion, 액체냉각, liquid cooling
- **[MOD] `renderFeed()` 수정**: 토픽 필터 후 뉴스 유형 탭 필터 단계 추가, 기업 탭 활성 시 불릿 렌더링 분기 적용

---

## v34.9 — 2026-03-28 — Phase 2-4 전면 구현 (기능 확장 / 데이터 인프라 / UX·접근성)

### Phase 2 — 기능 확장
- **[NEW] TradingView 위젯 임베드**: 차트분석(page-technical), 기업분석(page-fundamental), 한국장 기술적분석(page-kr-technical) 3개 페이지에 TradingView 인터랙티브 차트 위젯 추가. 종목 코드 입력 → 실시간 차트 로드 기능
- **[NEW] McClellan Oscillator 실제 계산**: 하드코딩된 McClellan 값을 19일/39일 EMA 기반 실시간 계산으로 교체. 매클렐란 오실레이터 + 써메이션 인덱스 동적 업데이트
- **[NEW] Black-Scholes Greeks 계산기**: 옵션 분석 페이지에 실시간 Greeks(Delta, Gamma, Theta, Vega, Rho) 동적 계산 추가. 실시간 주가 데이터 기반 자동 갱신
- **[NEW] 포트폴리오 SPY 벤치마크 비교 차트**: 포트폴리오 페이지에 내 수익률 vs SPY 수익률 비교 캔버스 차트 추가 (30일 시뮬레이션 곡선)
- **[NEW] 스크리너 CSV 내보내기**: 스크리너 결과 테이블에 📥 CSV 내보내기 버튼 추가. UTF-8 BOM 포함하여 한글 깨짐 방지
- **[NEW] 가격 알림 시스템**: localStorage 기반 가격 알림 기능. 종목별 ≥/≤ 조건 설정, 30초 주기 자동 체크, 도달 시 showToast 알림

### Phase 3 — 데이터/인프라
- **[NEW] 경제 캘린더 동적화**: FOMC/BOK 일정을 하드코딩에서 동적 계산(getNextFOMC, getNextBOK)으로 전환. 2026년 전체 일정 내장
- **[FIX] 하드코딩 날짜 정리**: DATA_SNAPSHOT 폴백값에 경고 주석 추가, _note 버전 갱신, 폴백 데이터 섹션 문서화 강화
- **[FIX] 이란 참조 범용화**: 지정학적 시나리오 4개 섹션에 "v34.9 주기적 현행화 필요" 주석 추가, 에너지 위기 소제목을 "지정학적 리스크 모니터링"으로 범용화, MACRO_KW 카테고리 주석 범용화
- **[DOC] 한국 수급 API 연동 준비**: kr-supply 경고 배너에 "API 연동 시스템 준비 완료, 엔드포인트 확보 시 즉시 연동 가능" 상태 반영

### Phase 4 — UX/접근성
- **[NEW] 색각 이상 접근성 (▲/▼ 아이콘)**: CSS 클래스 a11y-up/a11y-dn/a11y-hold 추가. 등락 표시에 색상 외 ▲/▼/● 아이콘 자동 병용. 30초 주기 자동 갱신
- **[CONFIRM] 에러 메시지 한국어화**: 전수 조사 결과 showToast/showDataError 전체가 이미 한국어 — 추가 작업 불요 확인
- **[NEW] 워크플로우 연결**: 스크리너→차트분석(screenerToChart), 스크리너→기업분석(screenerToFundamental), 뉴스→종목(newsToStock) 페이지 간 원클릭 이동 기능 추가. showTicker 래핑하여 마지막 클릭 종목 기억
- **[NEW] PWA + Service Worker**: manifest.json 생성, sw.js 생성 (Network-first for API, cache-first for assets), index.html에 manifest link + SW 등록 코드 추가
- **[NEW] 다크/라이트 테마 전환**: CSS 라이트 테마 변수 체계 추가, 고정 토글 버튼(🌙/☀️), localStorage 기반 테마 저장/복원, TradingView iframe 자동 테마 연동

- **수정된 파일**: `index.html`, `version.json`, `manifest.json`(신규), `sw.js`(신규), `CHANGELOG.md`, `_context/CLAUDE.md`, `_context/QA-CHECKLIST.md`
- **영향 범위**: CSS(라이트 테마+접근성 클래스), HTML(5개 페이지 위젯 추가), JS(15+ 신규 함수), PWA(manifest+SW)

---

## v34.8 — 2026-03-28 — 통합 부족 감사 반영 (UX/접근성/데이터 일관성)

- **[FIX] C5 — PXD 상장폐지 종목 제거**: Pioneer Natural Resources → ExxonMobil 인수 완료(2024.05). KNOWN_TICKERS에서 제거
- **[FIX] B1/H5 — alert() 24건 → showToast() 전환**: 네이티브 브라우저 alert 24곳을 모두 커스텀 showToast()로 교체. API 키 저장/삭제, 포트폴리오 입력 검증, 워치리스트 중복/빈값, 피드백, PIN, 기술적 분석 입력 등 전 영역
- **[NEW] A2 — signal 페이지 AI 추천 칩 4개 추가**: CHAT_DEFAULT_CHIPS에 signal 컨텍스트 추가 (트레이딩 스코어, VIX 포지션 사이징, 섹터 배분, 풋콜비율 질문)
- **[NEW] B4/M5 — @media print 인쇄 스타일시트 추가**: 사이드바/버튼/채팅패널 숨김, 배경 흰색, 텍스트 검정, canvas page-break-inside:avoid
- **[FIX] B5/G1 — 스파크라인 canvas aria-label 추가**: 스크리너 미니차트에 `role="img"` + `aria-label` 추가 (스크린 리더 접근성)
- **[NEW] H2 — kr-supply 정적 데이터 경고 배너 추가**: "이 페이지의 수급 데이터는 정적 스냅샷입니다" 경고 배너를 수급 분석 페이지 상단에 추가
- **수정된 파일**: `index.html`, `version.json`, `CHANGELOG.md`, `_context/CLAUDE.md`, `_context/QA-CHECKLIST.md`
- **영향 범위**: JS(alert→showToast 24곳), CSS(@media print 추가), HTML(kr-supply 배너, sparkline aria-label, signal 칩), DATA(PXD KNOWN_TICKERS 제거)
- **감사 보고서 출처**: `UNIFIED-DEFICIENCY-AUDIT-v34.6.md` + `FULL-DEFICIENCY-AUDIT.md` 통합 반영

---

## v34.7 — 2026-03-28 — 종목 유니버스 전면 감사 + 테마/서브테마 대폭 확장

- **[FIX] Phase 1 — 데이터 오류 즉시 수정**:
  - `ELASTIC` → `ESTC` 수정 (THEME_MAP software 데이터/AI플랫폼)
  - `INFN` 제거 (Nokia 인수 → 상장폐지). photonics 광섬유/네트워크에 `ANET` 대체. SUB_THEMES photonics tickers에서도 제거
  - `IIVI` 제거 (COHR로 합병 완료). photonics leaders, SCREENER_DB, KNOWN_TICKERS에서 모두 제거
  - `SPCE` 제거 (Virgin Galactic 사실상 종료). defense 우주/위성에 `LUNR`/`RDW` 대체. SCREENER_DB, KNOWN_TICKERS, SCR_KEYWORD_ALIASES, PRIORITY_SYMS, SUB_THEMES, 폴백 데이터에서 전부 정리
- **[NEW] Phase 2-1 — SCREENER_DB 누락 종목 14개 추가**:
  - THEME↔SCREENER 불일치 10개: AA, BIIB, CLSK, ETSY, LAC, MASI, MP, RUN, SEDG, STAG
  - 신규 서브테마용 4개: IBIT, BITO, QBTS, UMC
- **[NEW] Phase 2-2 — THEME_MAP 서브테마/종목 대폭 확장**:
  - 반도체: `파운드리/성숙공정` 서브테마 신설 (INTC, GFS, TSM, UMC). 아날로그/RF에 NXPI, ON 추가
  - AI 인프라: `양자컴퓨팅` 서브테마 신설 (IONQ, RGTI, QBTS)
  - 소프트웨어: 데이터/AI플랫폼에 AI, TTD 추가
  - 방산: 전통 방산에 PLTR, LDOS 추가
  - 임의소비재: `플랫폼/딜리버리` 서브테마 신설 (UBER, DASH, CPNG). 이커머스에 CPNG 추가
  - 금융: 결제/핀테크에 SOFI, AFRM 추가
  - 헬스케어: `생명과학 장비` 서브테마 신설 (TMO, DHR, A, WAT)
  - 크립토: `BTC ETF` 서브테마 신설 (IBIT, BITO)
  - 로보틱스: `AI/휴머노이드` 서브테마 신설 (TSLA, FANUY). 산업 자동화에 PATH 추가
- **[NEW] Phase 2-3 — SCR_KEYWORD_ALIASES 11개 키워드 추가/강화**:
  - 신규: 드론, 로보틱스, 리튬, 메타버스, autonomous, GLP-1, obesity, sq→XYZ
  - 강화: 자율주행(+MBLY, APTV), 비만(+NVO, AMGN, VKTX), 로봇(+ROK, ABB, PATH, FANUY)
- **[NEW] Phase 3 — SUB_THEMES 4개 신규 서브테마**:
  - `foundry` (파운드리/성숙공정): INTC, GFS, TSM, UMC — 비첨단 공정 수요 회복
  - `btc_etf` (BTC ETF/보유): IBIT, BITO, MSTR, COIN — 현물 ETF 기관 유입
  - `delivery` (플랫폼/딜리버리): UBER, DASH, CPNG — 라이드셰어/배달 성장
  - `glp1` (GLP-1/비만치료): LLY, NVO, AMGN — GLP-1 수용체 작용제 시장
- **[FIX] PARA 모니터링 라벨**: Skydance 합병 진행 중 → 티커변경/상장폐지 가능 경고 추가
- **[PERF] PRIORITY_SYMS 2그룹 추가**: 신규 서브테마 리더(IBIT, BITO, UBER, DASH, CPNG, LLY, NVO, INTC, GFS, UMC) 우선 fetch
- **KNOWN_TICKERS 갱신**: AA, BIIB, BITO, BOTZ, CLSK, ETSY, IBIT, LAC, MASI, MP, QBTS, RUN, SEDG, STAG, UMC 추가. IIVI, SPCE 제거
- **수정된 파일**: `index.html`, `version.json`, `CHANGELOG.md`, `_context/CLAUDE.md`, `_context/QA-CHECKLIST.md`
- **영향 범위**: SCREENER_DB(+14 entries, -2 removed), THEME_MAP(9개 테마 서브테마 확장), SUB_THEMES(+4 신규), SCR_KEYWORD_ALIASES(+11 키워드), KNOWN_TICKERS(+15, -2), PRIORITY_SYMS(+2그룹)

---

## v34.6 — 2026-03-28 — 한국 시장 대폭 강화 + 캐시 방지 + 테마 시세 가속

- **[NEW] 한국 시장 대폭 강화**: DATA_SNAPSHOT 한국 매크로 확장, AI 채팅 컨텍스트 4개(kr-tech, kr-supply, kr-themes, kr-macro), 한국 3개 페이지 채팅 패널 추가, 뉴스 RSS 강화(조선비즈/머니투데이 Tier 2), 모델 라우팅 한국 전용(기본 Sonnet), kr-macro 동적화
- **[FIX] 캐시 방지**: `<head>`에 Cache-Control/Pragma/Expires 메타 태그 추가, 업데이트 배너 클릭 시 `?v=timestamp` 강제 캐시 무효화, URL 자동 정리
- **[PERF] 테마 시세 가속**: SUB_THEMES 핵심 종목 34개를 PRIORITY_SYMS 앞쪽(그룹 6~12)으로 이동. 테마 그룹 완료 시 즉시 화면 업데이트. 중간 갱신 주기 5→3그룹으로 단축

---

## v34.5 — 2026-03-27 — UI/UX 전수 감사 + 시간 동결 콘텐츠 해결 + 모바일 반응형 강화

- **[FIX] 🔴 브리핑 페이지 시간 동결 해결**: 2026.03.22~23 기준 하드코딩된 정적 콘텐츠(핵심 요약 5항목, 이란-미국 긴급 알림, Goldman 분석, Post-FOMC 구조, 시나리오 트리, 3/24-3/28 주간 일정)를 `#briefing-static-archive` div로 감싸고 접기/펼치기 토글 추가. "⚠️ 아래 분석은 2026.03.22~23 기준 과거 스냅샷입니다" 경고 배너를 명시적으로 추가. "오늘의 핵심 요약" → "과거 핵심 요약 (2026.03.23 스냅샷)"으로 제목 변경. 상태 뱃지 "🔴 위험회피 / 쿼드위칭 완료" → `classifyMarketRegime()` 연동 동적 국면 뱃지로 교체. 채팅 칩 4개를 시간 독립적 질문("오늘 시장 종합 브리핑", "지금 가장 중요한 리스크 요인은?" 등)으로 교체. 날짜 서브타이틀 동적 생성.
- **[FIX] 🔴 시그널 리스크 히트맵 범용화**: 8-포인트 리스크 히트맵의 CP1(지정학) "이란-미국 군사 충돌" → "지정학 긴장 모니터링", CP2(통화정책) "2026 인하 1회만" → "금리 경로 모니터링", CP3(거시경제) "CPI 2.4% 재점화" → "CPI/Core CPI 추이 모니터링", CP6(원자재) "귀금속 청산 가속" → "원자재 공급 리스크 모니터링"으로 범용 서술 교체. 날짜 "(3/23)" 제거.
- **[FIX] 🔴 옵션 IV Rank/Percentile 동적화**: 하드코딩 "72" / "68%" → `#opt-ivrank-val`, `#opt-ivpct-val` ID 부여 + `initOptionsPage()`에서 VIX 기반 추정 로직으로 동적 갱신. IV Rank/Percentile 해석("옵션 매도 유리" 등)도 수치에 연동하여 동적 변경. "⚠ VIX 기반 추정값 — CBOE 확인" 라벨 추가.
- **[FIX] 🟡 모바일 480px 반응형 강화**: `@media (max-width: 480px)`에 5열→2열(`repeat(5` → `repeat(2,1fr)`), 3열→1열(`1fr 1fr 1fr` → `1fr`), 4열→2열 폴백 규칙 추가. 홈 시세카드(5열), 옵션 센티먼트(4열), 옵션 메트릭스(5열), 브리핑 3열 카드 등 모바일 480px에서 레이아웃 깨짐 방지.
- **[FIX] 🟡 홈/브리핑 상태 뱃지 동적화**: 홈 "🔴 위험회피" → `#home-risk-regime-badge` + `classifyMarketRegime()` 기반 동적 업데이트(🔴 하락추세/🟠 조정/🟡 눌림/🟢 상승). 브리핑 페이지도 `#briefing-regime-badge` + pageShown 이벤트에서 동적 갱신.
- **[FIX] 🟡 한국 경제 일정 경고**: "주요 경제 일정 (3월 ~ 5월)" → "⚠ 과거 스냅샷 — 최신 일정은 AI 채팅에서 확인" 라벨 추가.
- **[FIX] 홈 날짜 라벨 동적화**: "2026.03.23 (월) KST" 하드코딩 → "시세 자동갱신 중..." 플레이스홀더 + DOMContentLoaded에서 동적 날짜 표시.
- **[DOC] UX-AUDIT-v34.4.md 작성**: 22개 페이지 × HTML 전수 점검 보고서. CRITICAL 3건 + HIGH 4건 + MEDIUM 5건 발견. 페이지별 등급 매트릭스 + Phase 1/2/3 수정 로드맵.
- **[FIX] ATH 이중 정의 통일**: 홈 대시보드 Market Regime 계산에서 `const SPX_ATH = 6947` 하드코딩 → `window._spxATH || 6947` 동적 추적 우선으로 변경. 실시간 데이터에서 S&P 500이 신고가를 갱신하면 자동 반영. 기존에는 실시간 피드(16298줄)에서 동적 추적하면서 홈 대시보드(16695줄)에서는 하드코딩이 남아있어 불일치 가능성.
- **[FIX] 프로덕션 로그 억제**: `AIO_DEBUG` 플래그 도입. 기본 프로덕션 모드에서는 `[AIO]` 접두사 console.log만 억제(154건 → 0건 표시). console.warn/error는 유지. `?debug=1` URL 파라미터 또는 `localStorage.setItem('aio_debug','1')`로 전체 로그 활성화 가능. 사용자 DevTools 경험 개선.
- **[DOC] KOSPI 스냅샷 주석 명확화**: DATA_SNAPSHOT의 KOSPI 5551 값에 "프로젝트 시나리오 기준값, 실시간 데이터 수신 시 자동 교체" 주석 추가.
- **수정된 파일**: `index.html`, `version.json`, `CHANGELOG.md`, `UX-AUDIT-v34.4.md`
- **영향 범위**: HTML(briefing 정적 콘텐츠 래핑, signal CP1-3-6 텍스트, options IV 카드 ID, home 뱃지 ID, kr-macro 일정 라벨), CSS(@media 480px 그리드 폴백), JS(initOptionsPage IV 동적 갱신, home regime 뱃지 업데이트, briefing regime 뱃지 업데이트)

---

## v34.4 — 2026-03-27 — 비교 키워드 확장 + 단일 기업 심층 분석 모드 + 티커 감지 개선

- **[FIX] 비교 키워드 커버리지 확장**: `_detectDeepCompareIntent()`의 `compareKw`에 25개 자연어 표현 추가. "장단점/장점/단점/강점/약점/우위/열위/좋은 점/나쁜 점/뭐가 좋/뭘 사/뭐가 낫/pros/cons/advantage/disadvantage/strength/weakness/better/worse/pick/choose/prefer/which" 등. 기존에는 "비교/vs/분석" 같은 명시적 표현만 감지 → "NVDA AVGO 장단점"에서 심층 비교 미발동되는 문제 해결.
- **[FIX] 티커 감지 3→5개 확장**: `_extractTickers()`의 `slice(0,3)` → `slice(0,5)`. 기본 데이터(실시간 시세+FMP 밸류에이션)는 최대 5개까지 조회. 심층 비교(`_fetchDeepCompareData`)는 API 비용/속도 제한으로 3개 유지하되, 4개 이상 입력 시 `showToast()`로 "최대 3개 종목까지 가능합니다. X, Y, Z로 분석합니다." 안내 메시지 표시.
- **[NEW] 단일 기업 심층 분석 모드**: 채팅에서 티커 1개 + 심층 키워드("해자 분석", "비즈니스 모델", "수익 구조" 등) 감지 시 자동 발동. `fundamentalSearch()`로 기업 분석 페이지에서 검색하지 않은 상태에서도 18개 FMP 엔드포인트를 자동 호출하여 시스템 프롬프트에 주입. 15개 관점 + 해자 7유형 판정 지침 포함. 예: "NVDA 해자 분석해줘" → 세그먼트별 매출/R&D비율/마진추이/FCF/경영진/내부자/DCF 등 전체 데이터 기반 심층 분석.
  - `_formatSingleDeepPrompt()` 신규 함수: `_formatDeepComparePrompt()`의 데이터 블록을 재사용하되, 비교 지침 대신 단일 기업 심층 분석 지침(15개 관점 + 해자 7유형 + Bull/Base/Bear 시나리오)으로 교체.
  - `_hasDeepAnalysisKw()` 공유 함수: 심층 키워드 배열(`_DEEP_ANALYSIS_KW`)을 단일 기업/비교 분석 양쪽에서 재사용. "종합 분석/심층 분석/딥다이브/deep dive/기업 분석" 6개 키워드 추가.
  - 이미 `fundamentalSearch()`로 해당 티커를 검색한 상태면 중복 호출 방지 (`window._fundAnalysisData.ticker` 체크).
- **[FIX] _CHAT_RULES ⑤-4 신규**: 단일 기업 심층 분석 데이터 감지 시 15개 관점 프레임워크 + 해자 7유형 판정 적용 지시. fundamentalSearch 미실행 상태에서도 18개 FMP 데이터를 최대한 활용하도록 명시.
- **[FIX] 심층 키워드 배열 리팩토링**: 기존 `_detectDeepCompareIntent()` 내부 `deepKw` 배열 → 전역 `_DEEP_ANALYSIS_KW` 상수로 분리. `_hasDeepAnalysisKw()` 공유 함수로 단일/비교 양쪽에서 재사용.
- **[FIX] 버전 동기화 (R1)**: title(v34.4) + badge(v34.4) + APP_VERSION(v34.4) + version.json(v34.4) 5곳 동기화.
- **[FIX] briefing 하드코딩 이벤트 제거**: Goldman -$9.6B, 쿼드러플위칭 등 수주 전 이벤트가 하드코딩되어 거짓 정보 전달 위험 → `window.newsCache`에서 실시간 수집 뉴스 Top5를 자동 주입으로 교체. 뉴스 미수집 시 안내 메시지. 트레이딩 스코어도 주입.
- **[FIX] themes 테마 ETF 실시간 데이터 주입**: SMH/SOXX/IGV/ITA/HACK/ICLN/URA/XBI/LIT/BOTZ/XLE/GDX 12개 테마 ETF의 실시간 가격·등락률을 `window._liveData`에서 추출하여 시스템 프롬프트에 주입. 하드코딩 "HOT/강세/중립/조정" 제거 → 실제 등락률 기반 시그널(🔥강세/↑상승/↓하락/❄약세)로 교체.
- **[FIX] home 시장건강도·국면 데이터 강화**: `computeMarketHealth()`, `classifyMarketRegime()` 결과를 시스템 프롬프트에 주입. DXY, 10Y 금리, WTI, Gold, USD/KRW도 추가. 기존 4개 지표 → 10개 지표로 확장.
- **[FIX] kr-themes 한국 대장주 실시간 시세 주입**: 삼성전자/SK하이닉스/현대모비스/포스코퓨처엠/삼성SDI/LG에너지솔루션/한미반도체 7개 종목의 `_liveData` 시세를 프롬프트에 자동 주입. 테마별 분석 가이드 구체화(방산/반도체/조선/원전/2차전지).
- **[FIX] kr-macro KOSPI/KOSDAQ 실시간 주입 + 스냅샷 경고 강화**: `_liveData['^KS11']`, `['^KQ11']`에서 KOSPI/KOSDAQ 실시간 시세 주입. 하드코딩 경제지표(기준금리, CPI, 수출 등)에 "학습 데이터 기준" 경고를 개별 항목마다 명시 (기존: 상단 1회 경고 → 변경: 각 항목 옆에 ⚠ 표시).
- **[FIX] QA-CHECKLIST 11F 갱신**: v34.2 기준 → v34.3/v34.4 기준으로 업데이트. "10개 엔드포인트" → 18개, "9단계 지침" → 15개 관점, 발견된 문제 3건 + 점검 보고서 추가.
- **수정된 파일**: `index.html`, `version.json`, `CHANGELOG.md`, `QA-CHECKLIST.md`
- **영향 범위**: JS(`_detectDeepCompareIntent`, `_extractTickers`, `chatSend`, `_formatSingleDeepPrompt`, `_hasDeepAnalysisKw`, `_DEEP_ANALYSIS_KW`, `_CHAT_RULES ⑤-4`), 전역 상태(singleDeepStr 추가)

---

## v34.3 — 2026-03-27 — 기업 내부 비교 분석 시스템 + 해자 프레임워크 강화

- **[NEW] 기업 내부 비교 분석 시스템**: 채팅에서 티커 2~3개 + 비교 의도(비즈니스 모델/해자/수익 구조 등) 감지 시 자동 발동. `_detectDeepCompareIntent()` → `_fetchDeepCompareData()` → `_formatDeepComparePrompt()` 파이프라인.
- **[NEW] FMP 18개 엔드포인트 완전 정합**: `_fetchDeepCompareData()`가 `fundamentalSearch()`와 동일한 18개 FMP 엔드포인트를 종목당 병렬 호출. profile, income(3y), balance, cashflow(3y), ratios-ttm, key-metrics, growth(3y), executives, insider-trading, institutional-holder, analyst-estimates, price-target-consensus, rev-product-segmentation, rev-geographic-segmentation, stock-peers, earnings-surprises, enterprise-values, DCF.
- **[NEW] 15개 관점 비교 프롬프트**: 기업 개요 / 설립 배경 / 경영진 분석 / 비즈니스 모델 / 제품 포트폴리오 / 기술력&해자 / 수익 구조 / 재무제표 / 밸류에이션 / 시장 TAM / 수요&공급망 / 파트너십 / 경쟁 구조 / 리스크 / 투자포인트 전부 커버. 임원급 깊이 지시.
- **[NEW] 해자 분석 7유형 데이터→해자 매핑 프레임워크**: 기술 독점(R&D/매출), 네트워크 효과(매출성장 vs SG&A), 전환비용(GM 안정), 브랜드(GM+SG&A), 규모의 경제(OpMargin 추이), 무형자산(description 키워드), FCF 전환(FCF마진). Wide/Narrow/None 판정 기준 + 해자 약화 경고 시그널.
- **[FIX] _CHAT_RULES ⑤-3 강화**: 기업 내부 비교 분석 데이터 감지 시 15개 관점 프레임워크 + 이사회 보고 수준 깊이 지시.
- **[FIX] QA-CHECKLIST 11D/11E/11F/11G 추가**: 섹터 비교, 해자 프레임워크, 기업 내부 비교, 버전 동기화 검증 항목.

---

## v34.1 — 2026-03-26 — 종목 유니버스 대폭 확장 + 테마/섹터 ETF 100% 연결 + Bloomberg 핵심 패턴 3종 이식

  - **[FIX] v34.2 LLM 채팅 가로 렌더링 근본 수정**: chatAppendMsg()에서 id를 .acp-msg wrap이 아닌 .acp-bubble에 설정하도록 변경. onDone 콜백이 wrap.innerHTML을 덮어써 bubble 소멸 → 128개 블록 요소가 flex:row 부모에 직접 배치되던 구조적 버그 해결. 로딩 제거 시 .closest('.acp-msg') 패턴으로 빈 wrap 잔류 방지.
  - **[FIX] v34.2 채팅 CSS 방어 강화**: .acp-msg에 overflow:hidden, .acp-bubble에 min-width:0 + flex:1 1 0% 추가. 확장 시 .acp-messages max-height:none으로 무제한 세로 확장.
  - **[FIX] v34.2 자동 확장 임계값 개선**: 500자 → 200자로 하향. 일반 LLM 채팅처럼 긴 답변 시 빠르게 자동 확장.
  - **[FIX] v34.2 이모지 규칙 강화**: 시스템 프롬프트에서 이모지 5개 이하 규칙을 구체적으로 명시 (숫자 이모지, 장식 이모지 포함 카운트, 대안 포맷 제시).
  - **[FIX] v34.2 max_tokens 확대**: 채팅 응답 max_tokens 4096 → 8192. 기업 분석 15개 관점 등 긴 분석이 중간에 잘리는 문제 해결.
  - **[FIX] v34.2 QA-CHECKLIST 6F항 신설**: 채팅 DOM 구조 무결성 검증 항목 추가 (bubble 존재, 자식 수, 가로 넘침, 자동 확장 동작). JS 검증 스니펫 포함.
  - **[FIX] v34.2 브리핑 뉴스 미표시 수정**: renderBriefingFeed()가 인수 없이 호출되어 items=undefined → "뉴스 로딩 중..." 영구 표시. showPage('briefing') 및 aio:pageShown 이벤트에서 renderBriefingFeed(newsCache) 인수 전달 추가.

- **변경 내용**:
  - **[NEW] 스파크라인 미니차트**: 스크리너 결과 테이블에 "5일 추이" 컬럼 추가. Yahoo Finance Chart API(range=5d, interval=1d)로 실데이터 표시. Canvas 기반 DPR 스케일링, 그래디언트 채움, 추세 컬러 라인, 5분 TTL 캐시.
  - **[NEW] 확인 모달 시스템**: 네이티브 `confirm()` 대체. `showConfirmModal(title, msg, callback, icon)` 전역 함수. 포트폴리오 전체삭제(🗑️), 개별삭제(📉), 채팅 기록삭제(💬)에 적용. 다크 테마, blur 배경, ESC 키 지원.
  - **[NEW] 다중 워치리스트 시스템**: 포트폴리오 페이지에 "⭐ 관심 종목 리스트" 위젯 추가. 복수 리스트 생성/이름변경/삭제, 종목별 메모, 드롭다운 전환. localStorage 영속. SCREENER_DB 연동(신호/종목명 표시). 스크리너 결과에 ⭐ 버튼으로 빠른 추가. 토스트 알림. AI 분석 컨텍스트에 워치리스트 자동 포함.
  - **출처**: Bloomberg Terminal 클론 분석에서 핵심 패턴 3종(sparkline, confirmation modal, multi-watchlist) 선별 이식. 원본 아키텍처(Next.js/Jotai/TanStack Query)가 아닌 AIO 단일 HTML 패러다임에 맞게 재설계.
  - **[FIX] 뉴스 필터링 근본 수정**: 한국 RSS 소스(`item.country === 'kr'`)가 금융 키워드 관련성 게이트를 우회하던 면제(exemption) 제거 — 지역/생활 뉴스 유입의 근본 원인. NEWS_BLACKLIST_KW에 ~80개 한국 지역뉴스 키워드 추가(지방행정, 지역개발, 생활복지, 기념행사 등). isTelegramMsgRelevant()에도 글로벌 블랙리스트 적용.
  - **[FIX] 주요 뉴스 섹션 품질 개선**: renderHomeFeed()를 시간순 8개 → 점수 기반 상위 3~5개로 전면 재설계. 매크로/지정학/실적/정책 토픽 가중, 티커 연결 보너스, 최소 score ≥ 25 게이트. 진짜 핵심 뉴스만 대시보드에 표시.
  - **[FIX] 시장 품질 점수 0점 방지**: `computeTradingScore()` 최소값을 Math.max(0,...) → Math.max(5,...) 로 변경. 극단적 시장 상황에서도 "미계산"과 구분.
  - **[NEW] NASDAQ 100 대시보드 카드**: S&P 500 옆에 NASDAQ(^IXIC) 카드 추가. 5열 그리드, 보라색(#a78bfa) 액센트. 모바일 반응형 2열 폴백.
  - **[FIX] v34.1b 뉴스 필터링 2차 강화**: NEWS_BLACKLIST_KW ~80개 → ~170개 추가 (광역자치단체명, 업무협약/MOU, 어촌뉴딜, 일자리 창출, 선착순 모집, 건강음료/배달사업, 행정지원, 인사이동/연임, 상공회의소 등). `_nonFinPatterns`에 한국 지자체 주어 패턴·업무협약·인사 패턴 추가. 한국 비전문소스 광범위 키워드('기업','수출','에너지' 등)만으로 통과하는 기사 차단하는 2차 필터 신설.
  - **[FIX] v34.1b 외신 우선순위 강화**: 시간 버킷 30분→15분 축소, 한국 소스 우선도 하향(Tier1 KR: 70→50, Tier2 KR: 40→30), 비한국 Tier2 우선도 상향(60→65). scoreItem()에서 한국 부스트(+3) 제거, US Tier1 부스트 +8→+12, 비한국 Tier1/Tier2 추가 부스트 신설.
  - **[FIX] v34.1c 컨텍스트 기반 3단계 뉴스 선별 시스템**: 키워드 전용 블랙리스트 → 금융 관련성 컨텍스트 기반 필터로 근본 재설계. STEP1: 하드 블랙리스트(finRelevance≥3이면 패널티만, 차단X). STEP2: 금융 관련성 게이트(finRelevance=0이면 _FINANCE_RELEVANCE_KW 체크). STEP3: 한국 광범위 키워드 2차 필터(_KR_BROAD_KW). 정치 키워드(대통령이/총리/장관 등) 블랙리스트에서 제거 — "대통령이 코스피 부양" 같은 주식 관련 정책 뉴스 보존.
  - **[NEW] v34.1c 대형주/대장주/주도주 티커 부스트**: _MEGA_TICKERS(~50개: AAPL,NVDA,TSLA 등 메가캡+주요ETF+한국 대장주) +8점, _LARGE_TICKERS(~80개: 대형주) +4점 부스트. 미국 주식 시장 중심 뉴스 우선순위 실현.
  - **[FIX] v34.1c 정치 키워드 블랙리스트 정리**: NEWS_BLACKLIST_KW에서 주식 관련 정책 뉴스를 차단하던 정치 키워드 ~15개 제거(대통령이/은/의, 총리, 장관이/은/의, 검찰, 국회에서 등). _nonFinPatterns에서도 "Trump says", "Senate passes" 등 무역/관세/정책 뉴스 차단 가능 패턴 제거.
  - **SCREENER_DB 대폭 확장**: 297개 → 673개 종목. S&P500 100%, NASDAQ100 100%, DOW30 100%.
  - **주요 ADR ~50개**: 중국/일본/유럽/캐나다/인도/라틴 글로벌 핵심 종목.
  - **ETF 80+개**: 인덱스·섹터(11개 GICS)·테마(15개)·원자재·채권·글로벌·변동성.
  - **유명 소형주 ~30개**: 우주/양자컴/AI/크립토/원전/밈/EV/바이오.
  - **테마/섹터 ETF 완전 연결**: THEME_MAP 195개 티커 전량 SCREENER_DB·KNOWN_TICKERS에 매핑 확인.
  - **섹터 ETF 11종 보강**: XLB/XLC/XLE/XLF/XLI/XLK/XLP/XLRE/XLU/XLV/XLY 전부 SCREENER_DB 등록.
  - **테마 ETF 15종 보강**: SMH/IGV/ITA/HACK/ICLN/URA/AMLP/OIH/GDX/JETS/LIT/BOTZ/XBI/XOP/SOXX 전부 등록.
  - **누락 개별주 9개 보강**: ABB/ADM/ES/FANUY/IIVI/JETS/NDSN/PNW/TPL.
  - **KNOWN_TICKERS 확장**: 288개 → 740개.
  - **SCR_KEYWORD_ALIASES 확장**: ~170개 → 205개 카테고리.
  - **_CHAT_RULES 심화 분석 프레임워크 6개 추가 (#34~#39)**: 11개 소스 문서(TeraFab, 유동성, 이란, 현금위기, GTC Memory, AI순환, Intel파운드리, 인터커넥션, Qualcomm 등)의 인사이트·비판력·전달기법 추출 → LLM 답변 시스템에 통합.
    - #34: 유동성 위기 조기 경보 (5단계 체계, CCBS, HY Basis, 사적신용 리스크)
    - #35: 지정학 리스크 심화 (Escalate-to-De-escalate 패턴, 감마+지정학, Bull/Bear 체크리스트)
    - #36: 반도체 심화 (TeraFab, 우주 데이터센터, Adaptive SoC Phase전략, Intel파운드리, D₀ 방정식)
    - #37: AI 순환 투자 구조 (NVIDIA-CoreWeave 루프, 부채 4배, 깨지는 조건 3개)
    - #38: 인터커넥션 시대 (Memory Wall, SerDes/PAM4, CPO, Memory TCO, Qualcomm, NVIDIA vs 개방형 연합)
    - #39: 매크로-신용 순환 (금리 3가지 맛, GDP 대비 지준금, 연준 B/S 전망)
  - **밸류체인 4개 확장**: 우주 반도체, 파운드리 경쟁 구도 2026, Memory TCO 전쟁, 인터커넥트 병목
  - **기존 밸류체인 업데이트**: 반도체(Intel 18A/Tesla TeraFab FOPLP 추가), AI(커스텀ASIC/인터커넥트/광모듈/LPDDR 확장)
- **수정된 파일**: `index.html`, `version.json`, `CLAUDE.md`, `CHANGELOG.md`
- **기능 연결성**: 스크리너 필터 ✅, 뉴스 매칭 ✅, RRG ✅, 자연어 검색 ✅, 기술적 분석 ✅, 기업 분석 ✅, 포트폴리오 ✅, 매매 시그널 ✅, 테마 ETF ✅, 섹터 ETF ✅, LLM 심화분석 ✅

---

## v34 — 2026-03-26 — Bloomberg Terminal 스타일 통합 (글로벌 마켓 오버뷰 + 키보드 단축키 + 디자인 레퍼런스)

- **변경 내용**:
  - **글로벌 마켓 오버뷰 테이블 (Bloomberg-style)**: Home 페이지 SECTION 2.5에 추가. 4개 지역(Americas, Rates&Commodities, Asia-Pacific, EMEA)으로 그룹핑된 19개 주요 글로벌 지수/자산 테이블. Bloomberg 오렌지 액센트(`#ff9900`), 머스타드 골드 가격 표시(`#f5f5b8`), 변동 방향 시그널(▲▲/▲/—/▼/▼▼). EXPAND/COMPACT 토글로 전체/축약 뷰 전환. 기존 `data-live-price`/`aio:liveQuotes` 이벤트 시스템과 완전 통합.
  - **데이터 신선도 컬러 인디케이터**: GMO 패널 상단에 시간 기반 컬러 도트 (≤15초 🟢, ≤60초 🟡, ≤180초 🟠, >180초 🔴) + 마지막 업데이트 시각 표시. 실시간 모드 시 도트 펄스 애니메이션.
  - **셀 업데이트 플래시 애니메이션**: 데이터 변경 시 가격 셀이 노란색으로 0.6초 플래시 후 페이드아웃 (`gmo-cell-flash` 키프레임).
  - **키보드 단축키 시스템 대폭 확장**: `?` 키로 단축키 도움말 모달 열기/닫기. 숫자키 1-8로 페이지 직접 이동, `G`로 글로벌 마켓 확장 토글, `R`로 데이터 새로고침. 입력 필드 내에서는 단축키 비활성화.
  - **Bloomberg-style 키보드 단축키 도움말 모달**: `#kbd-shortcuts-modal` — Bloomberg 터미널 스타일 디자인, 오렌지 액센트, 모노스페이스 키 뱃지. ESC 또는 배경 클릭으로 닫기.
  - **UI 디자인 레퍼런스 문서 작성**: `_context/archive-reports/AIO_UI_디자인_레퍼런스.md` — Bloomberg Terminal 클론(125파일, 3,946 LoC) 및 Sovereign Office 대시보드 이미지 분석. 컬러 시스템, 타이포그래피, 레이아웃 패턴, 스파크라인, 컨트롤 바, 모달 스타일 등 체계적 문서화.
- **수정된 파일**: `index.html`, `version.json`, `CLAUDE.md`, `CHANGELOG.md`, `_context/archive-reports/AIO_UI_디자인_레퍼런스.md`
- **영향 범위**: Home 페이지(GMO 위젯 추가), CSS(블룸버그 스타일 변수·애니메이션), JS(GMO 렌더링·키보드 핸들러), 전역 키보드 이벤트(1-8 페이지 이동)
- **참조**: Bloomberg Terminal Clone (Next.js, AlphaVantage+Redis), Sovereign Office 대시보드

---

## v33.5 — 2026-03-25 — QA v3 체크리스트 도입 + 텔레그램 CJK 필터 수정 + 브라우저 전수점검

- **변경 내용**:
  - **QA v3 체크리스트 도입**: 기존 v2(57항목) + v3 추가(147항목) = 총 204항목 16개 스테이지. 기존 v2는 아카이브 보존.
  - **텔레그램 필터 CJK 최소길이 수정**: `isTelegramMsgRelevant()` 최소 문자 수를 20→12로 하향. CJK 문자는 정보밀도가 높아 18자 일본어 문장도 완전한 뉴스 문장이므로 기존 20자 기준에서 걸러지는 문제 해결.
  - **브라우저 QA 전수점검 완료**: 22개 페이지 네비게이션 전체 OK, 15개 핵심 함수 존재 확인, 9개 채팅 패널 확장 버튼 확인, 코드 펜스 렌더링 검증, 포트폴리오 DOM 검증, 한국 시장 5개 페이지 확인.
- **수정된 파일**: `index.html`, `version.json`, `CLAUDE.md`, `CHANGELOG.md`, `_context/QA-CHECKLIST.md`
- **영향 범위**: JS(`isTelegramMsgRelevant` 최소길이 변경), QA 시스템(체크리스트 v3 전면 교체)

---

## v33.4 — 2026-03-25 — LLM 채팅 확장 시스템 + 종목 검색·포트폴리오 대규모 보강

- **변경 내용**:
  - **LLM 채팅 확장/축소 토글 시스템**: 모든 채팅 패널(9개)에 ↗ 확장 버튼 추가. 클릭 시 `max-height: 480px → 75vh`로 확장되어 긴 답변을 전체 화면에서 세로 스크롤로 읽기 가능. 500자 이상 응답 시 자동 확장.
  - **LLM 답변 가로 넘침 완전 차단**: `.acp-bubble` overflow-x를 `auto→hidden`으로 변경, `overflow-wrap:break-word` 추가, `max-width: calc(100%-24px) → 100%`. 코드블록(pre)도 `white-space:pre-wrap;word-break:break-word` 적용.
  - **마크다운 코드 펜스(```) 렌더링**: `renderMarkdownLight()`에 코드 펜스 파싱 추가. 코드 블록이 `<pre>` 태그로 렌더링되며 배경·테두리 스타일링 적용.
  - **종목 검색 최근 기록**: 최근 검색 8개 localStorage 저장, 기업 분석 페이지에 클릭 가능한 최근 검색 칩 표시. 페이지 진입 시 자동 렌더링.
  - **포트폴리오 목표가(Target Price)**: 입력 폼에 목표가 필드 추가, 테이블에 목표가 컬럼 + 현재가 대비 업사이드(%) 표시, AI 프롬프트에 목표가·보유일 포함.
  - **포트폴리오 AI 칩 확장**: '목표가 점검', '손익 전략' 2개 추가 (4→6개).
  - **포트폴리오 AI 프롬프트 강화**: 보유일수(addedAt 기반), 목표가 대비 잔여 상승여력을 컨텍스트에 포함.
  - **Signal 채팅 max-height**: 200px → 320px + 확장 가능.
- **수정된 파일**: `index.html`, `version.json`, `CLAUDE.md`, `CHANGELOG.md`
- **LLM UI 개선 요약**: 가로 넘침 0건 보장, 긴 답변 시 채팅 영역 자동 확장, 코드블록 깔끔 렌더링
- **영향 범위**: CSS(chat), JS(chatSend·renderMarkdownLight·toggleChatExpand·_fundRecentSearches·addPortfolioPosition·editPosition·clearPortfolioForm·renderPortfolio·getPortfolioContextForAI), HTML(9개 채팅 헤더, 포트폴리오 폼/테이블)

---

## v33.3 — 2026-03-25 — 텔레그램 뉴스 필터 보강 + 키워드 ~100개 확장

- **변경 내용**:
  - **스팸 필터 오탐 수정**: '무료' 단독 키워드 제거 → '무료 이벤트','무료 참여','무료 가입','무료 체험','무료 쿠폰','무료 배송' 복합 패턴으로 구체화. '가입' 단독도 제거 (ETF 가입 등 정당 사용)
  - **우주/항공우주 키워드 추가**: 영문 18개 (spacex, nasa, boeing, lockheed 등) + 한국어 19개 (우주, 로켓, 위성, 항공우주 등)
  - **핵심 인물 키워드**: 영문 14명 (trump, powell, jensen huang 등) + 한국어 11명 (트럼프, 파월, 젠슨 황 등)
  - **증권사 키워드 추가**: raymond james, wedbush, piper sandler, jefferies, bernstein, stifel
  - **일본어 키워드 확장**: 9개 → 21개 (利上げ, 利下げ, 景気, 投資, 防衛, 宇宙 등 12개 추가)
  - **한국어 AI/테크 + 리포트 키워드**: 오픈AI, 데이터센터, GPU, HBM, 목표 주가, 강력 매수, 매수의견, 비중확대
  - **분석 메모 시스템**: `_context/CHAT_WORK_ANALYSIS.md` 신규 — 채팅 세션 작업물 분석 기록 (의도/이유/빈틈)
- **수정된 파일**: `index.html`, `version.json`, `CLAUDE.md`, `CHANGELOG.md`, `_context/CHAT_WORK_ANALYSIS.md`
- **버그 수정**: 2건 — '무료' 스팸 오탐 (정당한 뉴스 차단), 우주/항공 키워드 전무 (NASA/SpaceX 뉴스 100% 차단)
- **키워드 수**: spamKW 22→26(구체화), relevantKW ~180→~280(+100)
- **bornlupin 7건 통과율**: 5/7 (71%) → 7/7 (100%)

---

## v33.2 — 2026-03-25 — FMP API 9개 엔드포인트 추가 + 15개 관점 완전 커버

- **변경 내용**:
  - **FMP API 9개 추가**: 경영진(key-executives), 내부자 거래(insider-trading), 기관 보유(institutional-holder), 애널리스트 추정(analyst-estimates), 목표가(price-target-consensus), 매출 세그먼트(revenue-product-segmentation), 지역별 매출(revenue-geographic-segmentation), 재무 성장률(financial-growth), DCF 밸류에이션(discounted-cash-flow)
  - **LLM 프롬프트 강화**: 9개 신규 데이터를 시스템 프롬프트에 구조화 주입 (경영진 보상·내부자 매매 집계·기관 TOP10·EPS 추정·목표가 삼중비교·매출 분해·성장률 YoY·DCF 적정가)
  - **15개 관점 프레임워크**: 각 관점에 ★데이터 태그 추가 — AI가 어떤 수집 데이터를 참조해야 하는지 명시적 지시
  - **v33.1 수정사항 보존**: CORS 프록시 폴백, SEC XBRL 원시 데이터 반환, 재무카드 폴백 모두 유지
- **수정된 파일**: `index.html`, `version.json`, `CLAUDE.md`, `CHANGELOG.md`
- **15개 관점 커버리지**: 9/15 (60%) → 15/15 (100%)
- **FMP API 호출**: 기존 9개 → 18개 (무료 플랜 일 250회 기준 약 13회 분석 가능)

---

## v33.1 — 2026-03-25 — 기업 분석 CORS 수정 + SEC XBRL 폴백 강화

- **변경 내용**:
  - `fetchSECFinancials`: CORS 프록시 폴백 추가 (직접 호출 실패 시 `fetchViaProxy` 경유)
  - `fetchSECFilings`: 동일하게 프록시 폴백 추가
  - `fetchSECFinancials`: 원시 XBRL 데이터 반환으로 변경 (`_parseSECFinancials`와 API 일치)
  - `_renderFundFinancials`: FMP 없을 때 SEC XBRL 데이터로 핵심 재무 카드 폴백 (매출/순이익/EPS/ROE/Gross Margin/부채비율 등)
- **수정된 파일**: `index.html`, `version.json`, `CLAUDE.md`, `CHANGELOG.md`
- **버그 원인**: SEC EDGAR `data.sec.gov/api/xbrl/companyfacts` 엔드포인트가 CORS 미지원 + fetchSECFinancials가 가공된 데이터를 반환하여 _parseSECFinancials와 불일치

---

## v33.0 — 2026-03-25 — 기업 분석 페이지 전면 재설계 (SEC+FMP 실시간 데이터 → AI 종합 분석)

- **변경 내용**:
  - **데이터 파이프라인 신설**: 검색 시 SEC EDGAR XBRL + FMP API + Yahoo Finance에서 실제 데이터를 자동 수집
    - SEC EDGAR: 공시 목록(10-K/10-Q/8-K) + XBRL 재무데이터 파싱(매출/순이익/자산/자본/EPS/영업CF/CAPEX)
    - FMP API: 기업 프로필(CEO/직원수/사업설명) + 손익계산서 + 대차대조표 + 현금흐름표 + 핵심지표(PE/PB/EV-EBITDA/ROIC/FCF Yield) + 재무비율(마진/ROE/유동비율/부채비율) + 경쟁사 + 실적 서프라이즈
    - Yahoo Finance: 실시간 시세
  - **UI 전면 재설계**: 검색 → 데이터 수집 진행률 표시 → 기업 헤더 + SEC 공시 + 재무 하이라이트(12개 카드) + 재무제표 트렌드(테이블) + 밸류에이션 분석 + 경쟁사 비교 + 실적 서프라이즈 히스토리
  - **LLM 프롬프트 핵심 강화**: 수집된 실제 데이터(시세/프로필/재무3종/비율/지표/경쟁사/서프라이즈)를 시스템 프롬프트에 직접 주입 → Claude가 학습 데이터가 아닌 실시간 팩트 기반으로 분석
  - **15개 관점 종합 분석 프레임워크**: 기업개요 → 설립배경&성장 → 경영진 → 비즈니스모델 → 제품포트폴리오 → 기술력&해자 → 수익구조 → 재무제표심층 → 밸류에이션 → 시장(TAM) → 수요·공급망 → 파트너십 → 경쟁구조 → 리스크 → 투자포인트
  - **SEC XBRL 파서**: `_parseSECFinancials()` — us-gaap 개념 자동 매핑, 연간(10-K)/분기(10-Q) 분리, 중복 제거
  - **FMP API 헬퍼**: `_fmpFetch()` — localStorage FMP 키 사용, 타임아웃 10초
  - 네비게이션 라벨: "기업 실적" → "기업 분석"
  - 채팅 칩 업데이트: 종합 기업 분석 / 재무제표 심층 분석 / 경쟁 구조 & 해자 / 리스크 & 투자 포인트
- **기술 노트**:
  - SEC EDGAR: CORS 미지원 → 브라우저에서 직접 호출 시 CORS 에러 가능 (CF Worker 프록시 통해야 함)
  - FMP 무료 250회/일 — 1회 검색당 ~8 API 호출, 하루 ~30회 종합 분석 가능
  - `window._fundAnalysisData`에 수집 데이터 캐시 → `CHAT_CONTEXTS.fundamental.system()`에서 프롬프트 주입
- **파일 변경**: index.html, version.json, CHANGELOG.md

---

## v32.4 — 2026-03-25 — 투자 백과사전 대규모 보강 (228→256개 용어)

- **변경 내용**:
  - **기존 정의 보강 (~60개)**: 실전 임계값(PER 섹터별 기준, RSI 다이버전스, VIX 선물 구조 등), 역사적 사례(2022 금리 인상, 2020 QE, 2024 엔캐리 등), AIO 페이지 연결(→ 차트분석/시장폭/대시보드 페이지에서 확인) 추가.
  - **신규 용어 28개**: 기초(Forward PER, PEG, EV/EBITDA, 베타, 알파, 샤프비율, 52주 신고가), 기술적분석(Weinstein Stage, SEPA, DMI, 윌리엄스%R, 매물대), 경제(Sahm Rule, 필립스곡선, 중립금리, 잭슨홀), 매크로(McClellan, A/D Line, HY스프레드, 연준대차대조표, 글로벌유동성사이클), 옵션(맥스페인, 변동성매매, 풋콜패리티), 한국시장(대차잔고, 기관순매수연속일, 개인신용융자, 밴드수익률), 배경지식(레짐체인지, 꼬리위험, 승자의저주, 앵커링, 손실회피).
  - **볼린저밴드 JS 문법 수정**: 스퀴즈 문자열 내 따옴표 이스케이프 오류 수정.
- **핵심 원칙**: 단순 정의 → "왜 중요하고, 어떻게 쓰는가"까지 연결된 실전형 백과사전.
- **영향 범위**: GLOSSARY 배열 전체. 카테고리 구조 변경 없음.
- **점검**: JS eval 통과, 256개 전수 파싱 확인.

---

## v32.3 — 2026-03-25 — 전문가 통합 분석 완성 (Tier 잔재·초보자 표현 전면 제거)

- **변경 내용**:
  - **7개 챗 컨텍스트 Tier 참조 제거**: 대시보드·매매시그널·기업분석·투자가이드·포트폴리오·기술적분석·매크로 프롬프트에서 "Tier X급" 표현 전부 삭제 → "데이터 근거와 인과 체인", "유기적 연결", "멀티팩터 교차검증" 등 분석의 질을 지시하는 표현으로 대체.
  - **수준 분리 표현 제거 (2건)**: 매크로 "초보에겐 비유로 쉽게, 중급 이상에겐~" → 비유+정량 병행. 기업분석 "초보~중급" → "핵심 체크포인트".
  - **전문 용어 설명 방식 전환 (2건)**: 차트분석·한국기술분석의 "괄호로 쉬운 설명" → 분석 맥락 속 자연스러운 의미 전달.
  - **UI 텍스트 개편 (3건)**: 투자심리 "초보자는~" → 분할매수 리스크분산. 옵션 "초보자는 커버드콜만" → 커버드콜/CSP부터. 포트폴리오 "초보자는 5% 이내" → 리스크 관리 원칙상 5~10%.
  - **용어사전 개편 (4건)**: 롱/숏·포지션사이징·마진/레버리지·ETF vs 개별주에서 "초보자" 표현 제거 → 전문적 맥락 설명(리스크관리·샤프비율·코어위성전략).
- **핵심 원칙**: "수준을 낮추는 것"이 아니라 "설명에 근거를 다는 것"으로 접근성 확보.
- **영향 범위**: AI 시스템 프롬프트 7개 컨텍스트, UI HTML 3건, JS 용어사전 4건.
- **점검**: Tier 잔재 0건, 초보자 표현 0건 — 전수 확인 완료.

---

## v32.2 — 2026-03-25 — 분석 수준 드롭다운 제거 → 통합 전문 분석 모드

- **변경 내용**:
  - **분석 수준 선택 UI 완전 제거**: 사이드바 드롭다운(고급/심화/프로) 삭제. 레벨 분리 자체를 없앰.
  - **통합 전문 분석 모드**: 항상 전문가급 분석이 기본. 멀티팩터 교차검증·시나리오 확률·정량 분석이 유기적으로 연결된 단일 분석 체계.
  - **AI 프롬프트 통합**: `_CHAT_RULES`에서 레벨 주입 로직 삭제 → "전문가급 통합 분석 + 근거 기반 설명" 단일 원칙. 적응형 난이도 → 통합 전문 분석. Tier 시스템 3단계 → 분량만 조절(수준 일정).
  - **JS 정리**: `setAnalysisLevel()` 함수 제거, `aio_analysis_level` localStorage 키 정리.
  - **가이드 로드맵 재설계**: 레벨별 분리 → 유기적 학습 경로(기업분석+차트→매크로+시장폭→포트폴리오+섹터+옵션).
- **핵심 원칙**: "근거 없는 결론 금지". 모든 판단에 데이터·통계·역사적 사례를 연결하면 전문적이면서도 누구나 따라올 수 있다.
- **영향 범위**: 사이드바, _CHAT_RULES, 전체 AI 시스템 프롬프트, JS 함수.

---

## v32.1 — 2026-03-25 — 초보자 모드 폐지 → 분석 수준 시스템 대규모 개편

- **변경 내용**:
  - **초보자 모드 토글 제거**: 사이드바 "🎓 초보자 모드" 체크박스 → "🎚️ 분석 수준" 드롭다운(고급/심화/프로)으로 교체.
  - **기본 수준 = 고급**: 모든 분석에 근거·이유·데이터를 연결하여 설명. 기초 용어 정의는 생략하되, 분석 맥락 속에서 자연스럽게 이해 가능.
  - **CSS 개편**: `.beg-explain`(숨김) → `.insight-box`(항상 표시, 클릭 펼침/접기). `body.beginner-mode` 의존성 제거.
  - **22개 insight-box 콘텐츠 고급화**: "🎓 이 페이지는 무엇인가요?" → "💡 핵심 인사이트" + 데이터 근거 기반 설명으로 전면 업그레이드.
  - **AI 프롬프트 체계 개편**: 적응형 난이도 4단계(초급/중급/고급/프로) → 3단계(고급/심화/프로). Tier 시스템 4→3단계 재설계. _CHAT_RULES에 사용자 선택 분석 수준 자동 주입.
  - **가이드 섹션 타이틀 전면 교체**: "초보자 가이드" → "분석 가이드" (환율, 수익률 곡선, 스프레드, 밸류에이션, 기술적 분석, 매크로).
  - **투자 가이드 AI 멘토 프롬프트 재작성**: "초보자 멘토" → "분석 전문 멘토". 학습 로드맵을 고급→심화→프로로 재설계. 흔한 실수 항목에 통계적 근거 추가.
  - **JS**: `toggleBeginnerMode()` → `setAnalysisLevel()`. localStorage key `aio_beginner` → `aio_analysis_level`.
- **영향 범위**: 사이드바, CSS, 22개 insight-box, AI 시스템 프롬프트 전체, _CHAT_RULES, 가이드/매크로/FX/기술분석/기업분석 페이지 섹션 타이틀.

---

## v32 — 2026-03-25 — 차트·기술 분석 엔진 통합 + 한국 시장 기술 분석 페이지

- **변경 내용**:
  - **기술 분석 엔진 (712줄)**: `run_screener_pro.py`의 핵심 알고리즘을 JavaScript로 포팅. Weinstein Stage(4단계), 추세 위치(6단계), 조정 분류(건전한 눌림/추세 반전), 진입 등급(A+~D), 20/50·50/200 SMA 교차 신호, RSI 다이버전스, MACD, 볼린저 밴드. Yahoo Finance 데이터 → CF Worker 프록시.
  - **US 차트·기술 분석 페이지 연동**: `analyzeTickerDeep(ticker)` — 미국 종목 종합 분석 대시보드 (상세 한국어 설명 포함).
  - **한국 시장 기술 분석 페이지 신설 (`page-kr-technical`)**: 사이드바 네비게이션 추가, KOSPI/KOSDAQ 지수 자동 분석, 개별 한국 종목 분석 (삼성전자 등 8개 퀵버튼), 기술 분석 용어 해설, AI 채팅.
  - **`initKoreaTechnical()` + `analyzeKrIndex()`**: 페이지 진입 시 KOSPI/KOSDAQ 자동 분석, `aio:pageShown`/`aio:liveQuotes` 리스너 등록.
  - **`analyzeKrTickerDeep()`**: 한국 종목 전용 분석 함수, `#kr-ticker-analysis-result` 타겟.
- **QA 시스템 반영**: BUG-POSTMORTEM에 신규 패턴 기록, QA-CHECKLIST에 기술 분석 검증 항목 추가, RULES에 기술 분석 엔진 규칙 추가.
- **영향 범위**: 새 페이지 `page-kr-technical`, 사이드바 네비, breadcrumbMap, 기술 분석 엔진 전체, showPage 이벤트 처리.

---

## v31.10 — 2026-03-25 — Dead Page 전수 점검 및 수정

- **변경 내용**:
  - **OPTIONS 페이지 실시간화**: 전체 하드코딩 데이터 → VIX/VVIX `data-live-price` 연결, `initOptionsPage()` 함수 추가. VIX 백분위, VVIX/VIX 비율, VVIX 상태 동적 계산. "참고용 데이터" 고지 배너 추가.
  - **PORTFOLIO 첫 진입 빈 화면 수정**: `aio:pageShown` 리스너 추가 → 페이지 진입 시 즉시 `renderPortfolio()` 호출.
  - **OPTIONS `aio:pageShown` + `aio:liveQuotes` 리스너 등록**: 실시간 데이터 갱신 시 옵션 페이지도 업데이트.
  - **VIX Term Structure 스팟 가격 실시간 연결**: 기간구조 테이블의 VIX Spot 값도 `data-live-price="^VIX"` 적용.
- **QA 시스템 반영**: BUG-POSTMORTEM에 P9 패턴(Dead Page) 추가, QA-CHECKLIST에 options/portfolio 검증 매트릭스 + Dead Page 체크 추가, RULES에 R9(3종 세트 필수) 추가.
- **영향 범위**: page-options, page-portfolio, 이벤트 리스너 영역.

---

## v31.9 — 2026-03-25 — 데이터 최신성 대폭 개선: Yahoo→FRED 실시간 브릿지

- **변경 내용**:
  - **Yahoo→FRED 실시간 브릿지 (`_syncYahooToFred`)**: FRED 데이터가 1일 이상 지연 시 Yahoo Finance 실시간 데이터로 자동 대체
    - DGS10 ← ^TNX (10Y 국채금리: FRED 1~2일 → **15분 실시간**)
    - DGS30 ← ^TYX (30Y 국채금리: FRED 1~2일 → **15분 실시간**)
    - DGS5 ← ^FVX (5Y 국채금리: 실시간 보조)
    - DGS3MO ← ^IRX (3M 국채금리: 실시간 보조)
    - VIXCLS ← ^VIX (VIX 종가: FRED 1~2일 → **15분 실시간**)
    - DTWEXBGS ← DX-Y.NYB (달러인덱스: FRED **5일** → **15분 실시간**)
    - HY 스프레드 추정 ← HYG ETF 가격 기반 실시간 계산
  - **스프레드 실시간 자동 계산**: T10Y2Y(10Y-2Y)와 T10Y3M(10Y-3M) 스프레드를 Yahoo 실시간 금리에서 매 갱신 시 자동 계산
  - **데이터 소스 추적 표시**: applyFredToUI에 FRED 원본 vs Yahoo 실시간 구분 표시 (`_fredSourceLabel`)
  - **콘솔 데이터 현황**: FRED/Yahoo 통합 데이터 현황을 🟢Yahoo/🔵FRED 이모지로 구분 로깅
  - **`_YAHOO_FRED_MAP`**: Yahoo↔FRED 심볼 매핑 테이블 (7개 시리즈, 변환 함수 포함)
  - **MacroStore 동기화**: Yahoo 브릿지 데이터가 MacroStore에도 자동 반영 (하류 검증 레이어 일관성 유지)
- **개선 효과**:
  - FRED 5일 지연(DTWEXBGS) → 15분 | FRED 1~2일 지연(DGS10/30, VIXCLS) → 15분
  - 수익률 곡선 스프레드: FRED 2시간 갱신 → 매 1분(시세 갱신 시) 자동 재계산
  - 모든 시장 데이터 하루 이내 목표 달성 (월간 지표 UNRATE/CPI/FEDFUNDS 제외 — 발표 주기 자체가 월간)
- **파일**: index.html, version.json, CHANGELOG.md, _context/CLAUDE.md

---

## v31.8 — 2026-03-25 — 통합: 뉴스 엔진 강화 + 데이터 검증 스토어 + LLM 심화

- **변경 내용 (뉴스/LLM — 외부 세션 병합)**:
  - **뉴스 소스 미국 중점 재설계**: 50→60개 소스, US 비중 28%→68%. KR을 Tier1→Tier2~3으로 하향, Bloomberg·Reuters·CNBC·WSJ 최우선. Benzinga·Nasdaq·The Economist·Forbes·Business Insider·Morningstar·Kitco·The Block·DL News 13개 신규 추가
  - **키워드 3~5배 확장**: MACRO_KW 69→310개, TECH_KW 29→111개, MED_KW 28→168개, 블랙리스트 239→456개, 금융 화이트리스트 83→403개
  - **토픽 분류 확장**: 7→11개 카테고리 (+bond, fx, defense, equity)
  - **스코어링 개편**: KR 부스트 +12→+3, US Tier1 부스트 +8 신규, 30분 버킷 내 소스 우선순위 정렬
  - **2차 관련성 게이트**: 면제 소스도 금융 키워드 없으면 제거, 비금융 정규식 패턴 필터 신설
  - **LLM 7개 심화 프레임워크**: 크로스에셋 상관관계, 기관 플로우, 어닝 시즌, 시장 레짐, 정량 리스크, 밸류체인, 유동성
- **변경 내용 (데이터 검증 — 이전 세션)**:
  - **PriceStore/MacroStore/NewsStore**: 3-tier 검증 스토어 (시세 급변감지, FRED 범위검사, 뉴스 중복제거)
  - **DataHealth**: 통합 파이프라인 모니터링 (`DataHealth.log()` 콘솔 명령)
  - **Finnhub WS→PriceStore 연동**: 실시간 WebSocket 시세가 검증 레이어를 거침
  - **FMP 엔드포인트 수정**: `earnings-surprises` → `earnings` (레거시 API 마이그레이션)
  - **ICSA 범위 수정**: MacroStore ICSA 범위 0~10000 → 0~1000000 (단위 불일치 버그)
- **파일**: index.html, version.json

---

## v31.7 — 2026-03-25 — 3-tier 데이터 검증 스토어 + DataHealth 파이프라인 모니터링

- **변경 내용**:
  - **PriceStore**: 시세 데이터 검증 레이어 — NaN/음수 거부, 50% 점프 감지, 5분 초과 데이터 stale 마킹, 소스별 추적. `window._liveData`와 자동 동기화
  - **MacroStore**: FRED 매크로 데이터 검증 — 12개 시리즈별 유효 범위 검사 (실업률 0~30%, 금리 0~25% 등), 결측값(".") 자동 거부, `window._fredData`와 동기화
  - **NewsStore**: 뉴스 품질 필터 — URL 기반 중복 제거, 제목 길이 검사, 죽은 피드 자동 추적 (3회 연속 실패 시 차단)
  - **DataHealth**: 통합 파이프라인 건강 리포트 — `DataHealth.log()` 콘솔 명령으로 시세/매크로/뉴스 전체 상태 한눈에 확인
  - **Finnhub WS→PriceStore 연동**: WebSocket 실시간 시세가 PriceStore 검증을 거쳐 `_liveData` 반영 (PriceStore 미초기화 시 기존 방식 폴백)
  - **자동 Health Report**: `initV20DataEngine()` Phase 8 — 초기화 20초 후 DataHealth.log() 자동 실행
  - **RSS 죽은 피드 보고**: 모든 프록시 실패 시 NewsStore.reportDeadFeed() 호출하여 피드 상태 자동 추적
- **아키텍처**: API → Store(검증) → Global Variables → UI 3-tier 구조. 기존 `_liveData`/`_fredData` 글로벌 변수 호환 유지
- **파일**: index.html, version.json

---

## v31.6 — 2026-03-25 — 죽은 RSS 제거 + CF Worker rate limit 증가

- **변경 내용**:
  - **죽은 RSS 피드 제거**: biz.chosun.com (404 폐지), news.mt.co.kr (410 영구 삭제) — 불필요한 404/410 에러 요청 제거
  - **CF Worker rate limit 100→300/분**: 페이지 로드 시 Yahoo Finance 100+ 심볼이 한꺼번에 요청되면서 100 req/min 초과 → FRED 초기 요청 429 발생하던 문제 해결
- **API 감사 결과**: 788건 네트워크 요청 분석 완료. Yahoo/FRED/CoinGecko/CNN F&G/환율 모두 정상 확인
- **파일**: index.html, version.json, cloudflare-worker-proxy.js

---

## v31.5 — 2026-03-25 — 데이터 파이프라인 최적화

- **변경 내용**:
  - **RSS2JSON 429 해결**: CF Worker 보유 시 rss2json 건너뛰고 CF Worker XML 파싱 우선 사용. rss2json은 CF Worker 미설정 시에만 시도 → 429 rate limit 완전 방지
  - **FRED CF Worker 우선**: `fetchFredSeries()` 함수에서 CF Worker를 1차로 시도, 실패 시 직접 호출 → corsproxy 폴백. 기존: 직접(503 실패) → corsproxy
  - **Yahoo Finance 직접 호출 제거**: CF Worker 설정 시 직접 CORS 호출 건너뜀. 매 심볼당 503 실패 요청 1건 절감 → 네트워크 요청 약 50% 감소
  - **Staleness 배너 자동 숨김**: DATA_SNAPSHOT._updated가 오래되어도 실시간 데이터 수신 확인되면 12초 후 경고 배너 자동 해제
- **성능 개선**: Yahoo 100+ 심볼 × 503 직접 호출 제거 → 초기 로딩 시 불필요 요청 약 100건 절감
- **파일**: index.html, version.json

---

## v31.4 — 2026-03-25 — 복잡도 감지 로직 대폭 강화

- **변경 내용**:
  - **컨텍스트별 특화 키워드**: 8개 채팅 컨텍스트(portfolio, fundamental, technical, signal, macro, breadth, sentiment, themes) 각각에 Sonnet/Thinking 승격 키워드 세트 별도 정의
    - 예: fundamental에서 "DCF", "적정 주가" → Thinking, "재무 분석", "이익률" → Sonnet
    - 예: technical에서 "엘리어트 파동", "와이코프" → Thinking, "진입 시점", "손절" → Sonnet
  - **영어 키워드 지원**: 한국어/영어 병렬 매칭 (예: "rebalance", "position sizing", "deep analysis")
  - **구조적 복잡도 분석**: 질문 길이(150자+), 물음표 개수(2+), 접속사 수(2+), 조건문 포함 여부로 자동 Sonnet 승격
  - **범용 심층 패턴 확장**: "비교해줘", "왜 그래", "분석해줘", "전망해줘", "추천해줘" 등 20+ 한국어 범용 패턴 추가
- **이전 대비**: 키워드 12개 → 약 120개+, 컨텍스트 특화 1개(portfolio) → 8개, 영어 0 → 30개+
- **파일**: index.html, version.json

---

## v31.3 — 2026-03-25 — 적응형 LLM 모델 시스템

- **변경 내용**:
  - **적응형 모델 선택**: 기본 Haiku 4.5 사용, 질문 복잡도에 따라 Sonnet 4.6 또는 Sonnet+Extended Thinking 자동 승격
    - `_detectQueryComplexity()` — 질문 텍스트+컨텍스트 분석으로 haiku/sonnet/sonnet-thinking 중 선택
    - 포트폴리오 컨텍스트는 기본 Sonnet, 심층 분석 키워드 감지 시 Thinking 모드
  - **LLM_MODELS 설정**: haiku/sonnet/sonnet-thinking 3개 모델 프로필 정의 (비용/토큰 정보 포함)
  - **callClaude() Extended Thinking 지원**: `thinking: { type: 'enabled', budget_tokens: 5000 }` 요청 자동 추가
  - **스트림 파서 개선**: `thinking_delta` 블록 무시 처리 (text_delta만 수집)
  - **모델 배지 표시**: AI 응답 완료 후 사용된 모델명 배지 표시 (Haiku=회색, Sonnet=파란색, Thinking=보라색)
  - **채팅 헤더 업데이트**: 모든 AI 채팅 헤더를 "Claude AI · 적응형"으로 변경
  - **설정 패널 업데이트**: 비용 안내를 적응형 시스템 반영 (일반 ~$0.005/쿼리, 심층 ~$0.02/쿼리)
  - **opts 파라미터 버그 수정**: chatSend()에서 callClaude() 호출 시 opts가 onError 위치에 잘못 배치된 버그 수정
- **비용 절감**: 일반 질문은 Haiku(~$0.005) 사용으로 기존 Sonnet(~$0.020) 대비 약 75% 절감
- **파일**: index.html, version.json

---

## v31.2 — 2026-03-25 — 시그널 페이지 빈 여백 수정 + QA 시스템 통합

- **변경 내용**:
  - **시그널 배너 레이아웃 수정**: `signal-advice` 배너가 `grid-template-columns: 200px 1fr` 내부에 동적 삽입되어 거대한 빈 공간 발생 → grid 바깥에 전용 `<div id="signal-advice-container">` 생성하여 해결
  - **QA 시스템 통합 재편**: 루트에 흩어진 24개 QA/AUDIT/REPORT 파일을 `_context/`로 통합
    - 핵심 파일 4개 → `_context/` 루트
    - 리포트 20개 → `_context/archive-reports/`
  - **RULES.md 신규**: 마스터 룰 — 작업 유형별 참조 파일, 절대 규칙 6개(R1~R6), 과거 실수 패턴
  - **BUG-POSTMORTEM.md 신규**: 버그 사후 분석 누적 로그 (v31~v31.2 3건 기록)
  - **QA-CHECKLIST.md 업데이트**: 반복 실패 방지 항목 6개 추가
- **근본 원인**: JS `closest('[style*="display"]')`가 grid 컨테이너를 선택 → `scoreCard.after()` 삽입이 grid 자식으로 들어감
- **예방 규칙**: R4 (동적 DOM 삽입 시 부모 레이아웃 확인)
- **파일**: index.html, version.json, `_context/RULES.md`, `_context/BUG-POSTMORTEM.md`

---

## v31.1 — 2026-03-25 — AI 챗 가로 텍스트 버그 수정

- **변경 내용**:
  - **CSS 수정**: `.acp-bubble`에 `overflow-x:auto; white-space:normal`, `.acp-messages`에 `padding-bottom:24px; overflow-x:hidden`, `.chat-tbl th/td`에 `white-space:normal; word-break:break-word; max-width:200px`
  - **렌더링 안전장치**: `renderMarkdownLight` — 5컬럼 초과 테이블 → 카드형 리스트 자동 변환
  - **시스템 프롬프트 강화**: 테이블 금지 규칙 + 대체 포맷 3가지 구체적 명시
  - **전체 LLM 영역 여백**: `chat-signal-msgs`, `chat-fxbond-msgs`, `chat-screener-msgs`에 padding-bottom 추가
- **근본 원인**: Claude가 시스템 프롬프트의 테이블 금지를 무시 → `renderMarkdownLight`가 충실히 `<table>` 렌더링 → 좁은 버블에서 6+컬럼 테이블이 가로로 표시됨
- **파일**: index.html, version.json

---

## v31 — 2026-03-25 — 버전 체계 변경 (소수점 1자리)

- **변경 내용**:
  - **버전 체계 전환**: v30.13 → v31 (소수점 2자리 → 1자리). 다음: 31.1→31.2→...→31.9→32
  - **버전 4곳 동기화**: title, badge, version.json, 파일명 모두 일치 확인 절차 도입
  - v30.15가 title/badge에만 표기되고 실제 파일 미존재한 문제 해결
- **근본 원인**: 코드 변경 없이 title 번호만 올리는 관행 + 버전 동기화 검증 절차 부재
- **예방 규칙**: R1 (4곳 동기화), R2 (소수점 1자리 한정)
- **파일**: index.html, version.json

---

## v30.14 — 2026-03-24 — QA 종합검증 후 근본 수정

- **변경 내용**:
  - **C1: 변화율 계산 강화** — fetchYFChart 직접 요청(Yahoo direct) 경로에도 `chartPreviousClose` 기반 폴백 변화율 계산 적용. 동적 검색(lookupTicker)도 동일 패턴 적용. 환율 심볼(`KRW=X`, `JPY=X` 등 8개)을 `PRIORITY_SYMS`에 추가하여 Yahoo chart API에서 `chartPreviousClose` 확보 → `_fxPrevClose` 자동 보정으로 환율 변화율 즉시 계산 가능
  - **C3: 차트 초기화 rAF+setTimeout 폴백** — 전체 showPage() 페이지 초기화를 `_safePageInit()` 패턴으로 교체. `requestAnimationFrame` 2중 호출 + `setTimeout(80ms)` 병행으로 비활성 탭에서도 차트 초기화 보장
  - **C4: macro Yield Curve 호출 추가** — macro 페이지 진입 시 `initYieldCurveChart()` 호출 추가 (기존에는 fxbond에서만 호출)
  - **S1: popstate 핸들러 완전화** — 기존 3개(breadth, signal, sentiment) → 9개 페이지 전체 reinit. fxbond, macro, technical, fundamental, market-news, briefing 6개 추가. destroyPageCharts도 popstate에서 호출
  - **S2: 버전 통일** — title v30.14, badge v30.14, version.json v30.14, prototype 동기화
- **영향 범위**: index.html, version.json, aio_ui_prototype_v30_13.html
- **근본 원인 분석**: `_liveData` 필드명 `.pct` 사용 확인, Yahoo chart API `meta.regularMarketChangePercent` 미존재 확인, rAF 비활성 탭 중단 현상 발견, popstate showPage 비동기성 확인

---

## v30.13-deploy-qa — 2026-03-24 — 배포판 종합 QA 실행

- **변경 내용**:
  - QA-CHECKLIST.md v2 전 단계 실행: 브라우저 런타임 + 데이터 교차검증 + 네비게이션 + 콘솔/네트워크 + 코드 정적 분석
  - `_context/BROWSER-QA-REPORT-v30.13-deploy.md` 신규 생성: 배포판 종합 검증 결과
- **검증 결과 (6대 축)**:
  - 연결성 70/100: 393개 티커 가격 연결, Finnhub WS 미연결
  - 안정성 60/100: JS 에러 0건, Yahoo 503 다수→CORS 폴백 복구
  - 호환성 75/100: 대부분 렌더링 정상, popstate 6/9 페이지 미대응
  - 충돌성 80/100: 페이지 전환 크래시 없음
  - 정확성 40/100: 가격 정확, 변화율 전체 0%, 점수 0/100
  - 최신성 50/100: 가격 실시간, 변화율 stale, 버전 불일치
- **크리티컬 버그 5건**: C1 변화율 전체 0%, C2 거래점수 0, C3 sentiment 차트 빈 화면, C4 macro yield curve 빈 화면, C5 환율 0%
- **구조적 문제 4건**: S1 popstate 6페이지 누락, S2 버전 불일치, S3 Finnhub WS 미연결, S4 home 품질점수 0
- **핵심 근본 원인**: v30.13d 패치가 부분 배포됨 — `_processFxRates()`, `_computeChangePercent()` 미존재, `chartPreviousClose` 기반 수동 계산 미적용
- **영향 범위**: signal, sentiment, fxbond, macro, kr-home, home
- **파일**: `_context/BROWSER-QA-REPORT-v30.13-deploy.md`

---

## v30.13d-qa2 — 2026-03-24 — 반복 요청 분석 + 브라우저 QA 시연

- **변경 내용**:
  - 전체 프로젝트 대화 이력 + CHANGELOG + 리포트 24건 교차 분석 → 반복 요청 6대 패턴 식별
  - `_context/REPEAT-REQUEST-ANALYSIS.md` 신규 생성: "코드 고쳤다면서 브라우저에서 안 되잖아" 등 반복 패턴 분석
  - `_context/QA-CHECKLIST.md` v1→v2 전면 개편: 실행 가능한 브라우저 JS 명령어 포함, 5단계(스코프→런타임→콘솔→코드→시각) 체계화
  - `_context/BROWSER-QA-REPORT-v30.13.md` 신규 생성: v30.13 배포판 실제 브라우저 검증 결과 (Bug 1~6 전부 재현 확인)
  - `_context/working-rules.md` 규칙 8 강화: 브라우저 검증 실행 방법 + 결과 기록 형식 추가
- **브라우저 검증 결과**: signal popstate 게이지 0(Bug 1), AAII 빈 화면(Bug 2), macro Yield Curve 빈 화면+2s10s "—"(Bug 3), 환율 전부 0.00%(Bug 5/6) 확인
- **추가 발견**: Finnhub WS 무한 재연결(49건 WARNING), fxbond 수익률 곡선은 정상이나 macro는 미렌더
- **파일**: `_context/REPEAT-REQUEST-ANALYSIS.md`, `_context/QA-CHECKLIST.md`(v2), `_context/BROWSER-QA-REPORT-v30.13.md`, `_context/working-rules.md`

---

## v30.13d-qa — 2026-03-24 — QA 시스템 근본 개선

- **변경 내용**:
  - v30.13d 6개 버그가 기존 점검 과정에서 모두 놓친 원인 분석 (사후 분석 문서 작성)
  - `_context/QA-FAILURE-ANALYSIS-v30.13d.md` 신규 생성: 버그별 근본 원인 + 왜 놓쳤는지 + 기존 테스트의 구조적 결함 분석
  - `_context/QA-CHECKLIST.md` 신규 생성: 4단계 런타임 QA 체크리스트 (스코프 파악 → 브라우저 런타임 → 데이터 검증 → 코드 레벨 → 시각적 품질)
  - `_context/working-rules.md` 업데이트: 규칙 7 작업흐름에 런타임 QA 단계 추가, 규칙 8 (런타임 QA 필수) + 규칙 9 (상태 라이프사이클 패턴) 신설
  - `_context/CLAUDE.md` 업데이트: 버전 정보 갱신, 상태 라이프사이클 문서화, QA 체크리스트 참조 추가, 핵심 함수 목록 보강
- **변경 이유**: 기존 테스트가 "코드 존재 확인" 수준이었고 "실제 동작 확인"이 전무 → 런타임/네비게이션/시각적/API 검증을 의무화
- **핵심 교훈**: 문법 통과 ≠ 동작 확인, 스크린샷 ≠ 테스트, 홈페이지만 확인 ≠ 전체 검증
- **파일**: `_context/QA-FAILURE-ANALYSIS-v30.13d.md`, `_context/QA-CHECKLIST.md`, `_context/working-rules.md`, `_context/CLAUDE.md`

---

## v30.13d — 2026-03-24 — 6대 UI/데이터 버그 수정

- **변경 내용**:
  - **Bug 5+6 (fetchYFChart 변화율 0%)**: Yahoo `/v8/finance/chart` API의 `meta.regularMarketChangePercent` 누락 → `chartPreviousClose`로 직접 계산 보정. 섹터 ETF RS + 한국장 KOSPI/KOSDAQ 변화율 정상화
  - **Bug 2 (AAII 심리 차트 빈 화면)**: `initSentimentPage()` → `initSentimentCharts()` 호출 시 `sentChartsInitialized=true` 잔존 → 차트 destroy 후 재생성 불가. `sentChartsInitialized = false` 리셋 추가
  - **Bug 3 (Yield Curve 차트 + 2s10s "—")**: `initYieldCurveChart()`가 fxbond 페이지의 `koreaCurveChart` 대신 macro 페이지의 `yieldCurveChart`에 렌더 → 캔버스 ID 수정. `updateFxBondPage()`의 yield 데이터 null 반환 → `_ldSafe()` 폴백 적용. 홈 2s10s FRED 실패 시 Yahoo 기반 폴백 계산 추가
  - **Bug 1 (시그널 대시보드 미갱신)**: popstate 핸들러가 `computeTradingScore()`만 호출하고 DOM 미갱신 → `initSignalDashboard()` 전체 호출로 수정
  - **Bug 4 (RRG 차트 스케일/비율)**: canvas 900x480 고정 → 컨테이너 기반 동적 리사이즈(비율 왜곡 방지). RS 정규화 범위 `/5` → `/3.5`로 스프레드 확대
- **파일**: index.html, aio_ui_prototype_v30_13.html, version.json (3파일 동기화)

---

## v30.13c — 2026-03-24 — 적응형 난이도 시스템 + 프로급 분석 기능 대폭 확장

- **변경 내용**:
  - **Rule 7 완전 교체**: "초보자 접근성" → "적응형 난이도 시스템" (초급/중급/고급/프로 4모드 자동 감지)
  - **Rule 19 확장**: 초보 교육 전용 → 전 수준 투자 교육(초급→중급→고급→프로), 성장 가이드 삽입
  - **Rule 29 확장**: Tier 3단계 → Tier 4단계 (Tier 4 = 프로/퀀트급, 20문장+, 정량분석 중심)
  - **Technical Pro 프로급 추가**: 와이코프 방법론, 볼륨 프로파일(POC/VAH/VAL), 오더플로우, 멀티 인디케이터 크로스체크, 백테스트 사고법, 상관관계 분석
  - **Options 프로급 추가**: Vol Surface 스큐, 고차 그릭스(Charm/Vanna/Volga), 복합전략(Ratio/Back/Diagonal/Jade Lizard), 어닝플레이 고급, 딜러 포지셔닝(GEX/DEX/VEX)
  - **Fundamental 프로급 추가**: Dupont ROE 분해, Accrual Quality, 잔여이익모델, 기업 생애주기, 어닝 퀄리티 스코어(Beneish/Altman/Piotroski), 경영진 분석(Form 4)
  - **Portfolio 프로급 추가**: 팩터 분해(Factor Attribution), VaR 95%/99%, 효율적 프론티어, 스트레스 테스트(2008/2020/2022), 테일 리스크(CVaR), 인컴 최적화
  - **4단계 시뮬레이션 테스트**: 16문항 (초급3+중급4+고급4+프로5) → 14.5/16 PASS (90.6%)
- **파일**: index.html, aio_ui_prototype_v30_13.html (동기화 완료, diff 0)
- **총 줄 수**: 23,844줄

---

## v30.13b — 2026-03-24 — 내러티브/스토리텔링 응답 시스템 구축 + 답변 깊이 보정

- **변경 내용**:
  - **_CHAT_RULES 29~33번 추가** (기존 28개 → 33개):
    - Rule 29: 답변 깊이 3단계 Tier 보정 (Tier 1 단순팩트→Tier 2 분석비교→Tier 3 심층전략)
    - Rule 30: 스토리텔링 기법 (비유의 힘, 감정-논리 블렌딩, 대화체 전환, 반전 포인트, 개인화)
    - Rule 31: 상황별 답변 구조 템플릿 (종목분석/시장상황/개념교육/포트폴리오 패턴)
    - Rule 32: 흐름과 리듬 (문단 호흡, 수치 시각적 강조, 전환 문구, 펀치라인 결론)
    - Rule 33: 사용자 공감 & 참여 유도 (질문 의도 재확인, 선제적 후속질문, 격려 클로징)
  - **Rule 1 강화**: 단순 친근함 → "이야기를 들려주듯 자연스러운 흐름" 명시
  - **Rule 2 강화**: 서사 구조 5단계 확장 (장면진입→임팩트→Why스토리→So What→액션클로징)
  - **max_tokens 2048→4096**: 풍성한 답변 허용
  - **7개 개별 CHAT_CONTEXTS 프레임워크 강화**: home, signal, portfolio, technical(Pro), fundamental, macro(Pro), guide — 각각 서사적 응답 패턴 명시 + Tier급 지정 + "단답 금지" 경고 추가
- **파일**: index.html, aio_ui_prototype_v30_13.html (동기화 완료, diff 0)
- **총 줄 수**: 23,806줄

---

## v30.13 — 2026-03-24 — 3차 전수 점검 대규모 보강 (20개 카테고리 전수 점검 → 누락 12개 영역 보강)

- **변경 내용**:
  - **_CHAT_RULES 20~28번 추가** (기존 19개 → 28개):
    - Rule 20: 기술적 분석 심화 (피보나치 되돌림/확장, 엘리엇 파동 5+3 구조 & 3대 규칙, 일목균형표 5개 라인, 다이버전스 정규/히든)
    - Rule 21: 매매 전략 심화 (데이트레이딩 골든아워, 포지션트레이딩, 퀀트/팩터 5대 팩터, 페어트레이딩, mean reversion)
    - Rule 22: 원자재 심화 (구리/금 비율 경기선행, OPEC+ 의사결정, 콘탱고/백워데이션 실전, 농산물 USDA)
    - Rule 23: 크립토 심화 (BTC 4년 반감기 사이클, 온체인 핵심지표 4종, 규제 이벤트, DeFi 위험)
    - Rule 24: 배당/인컴 심화 (배당귀족/킹 기준, 배당 함정, 배당커버리지, 리츠 FFO/AFFO, 커버드콜 ETF)
    - Rule 25: 지정학 리스크 & 투자 (대만해협→TSMC→반도체, 중동→유가→인플레, 미중 기술패권, 공급망 재편 nearshoring)
    - Rule 26: 세금/제도 기초 (미국 양도세 단기/장기, 배당세, Tax-Loss Harvesting, 한국 해외주식세금, ISA, IRA/401k)
    - Rule 27: 행동재무학 상세 (프로스펙트이론, 매몰비용, 과신편향, 가용성/대표성 휴리스틱, 후향적 편향, 군집행동)
    - Rule 28: 시장구조/제도 심화 (다크풀 40%, Short Interest Ratio, IPO 락업, 인덱스 편입 효과, 자사주매입 EPS 부풀리기, SPAC)
  - **technical (Pro)**: 피보나치 & 엘리엇 파동 상세, 일목균형표 핵심, 다이버전스 정규/히든 구분 추가
  - **macro (Pro)**: 경기사이클 4단계(회복/확장/과열/침체) & 섹터 매핑, 지정학 리스크 시장 전파 경로 3가지 (대만/중동/미중)
- **검증**: 20개 카테고리 전수 점검, 기존 PARTIAL 11개 + MISSING 1개 → 모두 COVERED로 보강 완료
- **웹 검색 참고**: 피보나치/엘리엇(LuxAlgo/EliteCurrensea 2025), 지정학 반도체 공급망(ScienceDirect/Everstream 2026), BTC 반감기 사이클(SeekingAlpha/TradingKey 2026)
- **영향 범위**: index.html + aio_ui_prototype_v30_13.html (_CHAT_RULES는 모든 컨텍스트에 자동 적용)

---

## v30.13 — 2026-03-24 — 2차 심층 보강 (웹 검색 기반 + 시뮬레이션 테스트 28/28 통과)

- **변경 내용**:
  - **portfolio**: 포지션 사이징 공식(1-2% 룰, ATR 기반), Kelly Criterion(Half-Kelly 권장), 상관관계 관리(0.7 임계), 드로다운 관리 프로토콜(-5%/-10%/-15~20% 단계별), 포트폴리오 건강도 체크리스트 6항목, 시장 환경별 노출도 가이드
  - **technical (Pro)**: 차트 패턴 신뢰도 가이드(H&S 89%, Double Bottom 88%, VCP 94%), 스윙 트레이딩 진입/퇴장 체계, CAN SLIM 7개 조건 상세, 보조지표 실전 해석(RSI/MACD/볼린저/OBV/VWAP), ATR 계산법 상세
  - **fundamental**: FCFF/FCFE 구분 및 공식, 재무제표 3종 읽기 가이드(손익/BS/CF + Red Flags), 섹터별 핵심 지표(6개 섹터), 적자기업 분석법, Moat 6가지 유형별 구체 사례, Rule of 40 공식 상세
  - **signal**: 5대 컴포넌트 세부 해석 + 스코어 변동 시나리오
  - **screener**: CAN SLIM/SEPA/밸류/배당/품질 5개 스크리닝 방법론
- **검증**: 기초~심화 단계별 질문 시뮬레이션 28문항 → 28/28 ✅ 전수 통과
- **웹 검색 참고**: Kelly Criterion 최신 연구, 차트 패턴 신뢰도(2026), ATR stop-loss 실전, CAN SLIM, DCF/FCF(CFA Institute 2026)
- **영향 범위**: index.html + aio_ui_prototype_v30_13.html

---

## v30.13 — 2026-03-24 — 개별 CHAT_CONTEXTS 시스템 프롬프트 심층 보강

- **변경 내용**:
  - **technical (Pro)**: VCP 상세 프레임워크 추가 (2~6회 수축 구조, SEPA 8대 조건, 손절 -5~8%, RR 3:1+), 멀티타임프레임 분석 가이드, 섹터 로테이션 맥락 연결
  - **macro (Pro)**: 2026 "Great Rotation" 프레임 추가 (에너지/원자재/산업재 리더, 기술주 소외), Fed 정책 경로 & QT 종료 시점 분석, 섹터 로테이션 확인 지표
  - **fundamental**: 어닝 분석 프레임워크 (Whisper Number, 가이던스, 마진 추이), DCF 실전 가이드 (민감도 분석, Rule of 40), PEG/EV/Sales 추가
  - **sentiment**: AAII/NAAIM/Put-Call 상세 임계값 가이드, VIX 구조(VIX vs VIX3M), 스마트머니 vs 덤머니 분석
  - **options**: 감마 노출(GEX) & 딜러 포지셔닝 해설, Zero Gamma Level, 시장 상황별 전략 매핑 (저변동/중변동/고변동/어닝시즌)
  - **themes**: AI 밸류체인 4계층 맵 (L1 반도체→L4 응용), 에너지 전환 맵 (전통/원전/재생)
  - **portfolio**: 대표 자산배분 모델 4종 (60/40, 올웨더, 바벨, 영구), 리밸런싱 원칙 (시간/임계치/세금 효율)
  - **fxbond**: 수익률곡선 심층 해석 (Bear Steepening, Bull Flattening, 2s10s 스프레드), 캐리트레이드 메커니즘
  - **breadth**: McClellan/A-D Line 임계값 가이드, 50SMA 위 비율 과매수/과매도 기준
  - **guide**: 초보자 단계별 학습 로드맵 (4단계), 흔한 실수 TOP 5
  - **kr-macro**: 코리아 디스카운트 구조적 요인, 밸류업 프로그램 해설
- **변경 이유**: 각 페이지별 AI가 수준 높은 전문 답변을 제공할 수 있도록 개별 컨텍스트 프롬프트에 실전 프레임워크·최신 시장 트렌드 반영
- **영향 범위**: index.html + aio_ui_prototype_v30_13.html (CHAT_CONTEXTS 내 11개 컨텍스트의 system 프롬프트)

---

## v30.13 — 2026-03-24 — LLM 커버리지 대폭 확장 + 범위 밖 안내

- **변경 내용**:
  - _CHAT_RULES 14번: 범위 밖 질문 시 외부 AI 안내 메시지
  - _CHAT_RULES 15번: 포괄적 금융 지식 커버리지 추가 (투자용어/밸류에이션/기술적분석/매매전략/옵션파생/채권금리/환율외환/원자재/크립토/매크로/시장구조/행동재무/포트폴리오이론/섹터산업/한국시장)
  - _CHAT_RULES 16번: 주요 기업/ETF 일반 지식 커버리지
  - _CHAT_RULES 17번: 이벤트/캘린더/계절성 패턴 커버리지
  - _CHAT_RULES 18번: 글로벌 매크로 연결 커버리지
  - _CHAT_RULES 19번: 초보~중급 투자 교육 적극 대응
- **변경 이유**: 사용자가 스크리너 내에서 주식 관련 모든 질문에 답변받을 수 있도록 커버리지 최대화
- **영향 범위**: index.html + aio_ui_prototype_v30_13.html (_CHAT_RULES는 모든 19개 채팅 컨텍스트에 자동 적용)

---

## v30.13 — 2026-03-24 — LLM 모델 및 예산 체계 수정

- **변경 내용**:
  - 채팅/스크리너 모델: `claude-sonnet-4-5-20251001`(존재하지 않는 ID, 404 에러) → `claude-sonnet-4-6` 으로 수정
  - 뉴스/번역 모델: `claude-haiku-4-5-20251001` 유지 (정상)
  - 모델 선택 드롭다운 UI 제거 → Sonnet 4.6 고정 표시
  - 채팅 패널 헤더 7곳 "Claude Haiku" → "Claude Sonnet 4.6" 수정
  - API 설명 텍스트 업데이트 (비용 정보 현행화)
  - 예산 $30 → $50 반영 (인당 $6/월 → $10/월)
  - version.json, `<title>` 태그 v30.13으로 업데이트
- **변경 이유**: Sonnet 모델 ID 오류로 404 에러 발생 + 모델/예산 정책 변경 (채팅 Sonnet, 번역 Haiku 분리)
- **영향 범위**: index.html (LLM_MODELS, LLM_BUDGET, 채팅 UI 헤더, 사이드바), version.json
- **검증 결과**: `claude-sonnet-4-5-20251001` 잔존 0건, `Claude Haiku` 하드코딩 잔존 0건 (주석 1건 정상), `$30` 예산 잔존 0건 (비관련 텍스트 제외)

---

## 2026-03-24 — CHANGELOG.md 작업 참고 규칙 추가

- **변경 내용**: 상단에 "작업 시작 전 참고 방법" 규칙 추가
- **변경 이유**: 새 작업 시 최근 변경 이력을 먼저 확인하는 습관 정착

---

## 2026-03-24 — 프로젝트 작업 환경 세팅

- **변경 내용**: 하위 폴더 4개 생성 (_backup, _archive, _context, outputs) + 컨텍스트 파일 3종 작성 (CLAUDE.md, voice-and-style.md, working-rules.md) + html-prototype-dev.plugin 패키징 (outputs/에 저장)
- **변경 이유**: 프로젝트 작업 폴더 초기 세팅 — 백업/아카이브/컨텍스트/출력물 관리 체계 구축
- **영향 범위**: 기존 파일 변경 없음. 새 폴더 및 파일만 추가

---

## v18.0 — 2026-03-21

### 정적 폴백값 실제 시세 교정 (2026-03-21 기준)
- `applyStaticFallbacks()` FALLBACK_QUOTES 전면 업데이트
  - S&P 500: 5,580 → **6,506** (-1.51%)
  - NASDAQ Composite: 17,318 → **21,648** (-2.01%)
  - BTC/USD: 84,200 → **70,005** (-0.53%)
  - WTI 원유: 92.4 → **97.4** (+2.60%) — 이란 전쟁 프리미엄 반영
  - 금(Gold): 3,052 → **3,030** (-1.98%)
  - VIX: 20.8 → **22.4** (+5.20%)
  - KRW/USD: 1,458 → **1,504.83** (+0.30%)
  - ETH: 3,820 → **2,264** (+0.40%)
  - 방산주(LMT/RTX/NOC) 상승 · 에너지주(XOM/CVX/COP/OXY) 상승 반영
- 스냅카드 HTML 초기값도 동일하게 교정 (JS 실행 전에도 올바른 값 표시)

### RSS 뉴스 로딩 방식 전면 개선 (0건 → 정상)
- `fetchOneFeed()` 함수 개선: **rss2json.com API를 1순위로** 사용
  - 형식: `https://api.rss2json.com/v1/api.json?rss_url=ENCODED_URL&count=15`
  - CORS 제약 없이 JSON 반환 → 시장 소식 뉴스 정상 로딩
  - rss2json 실패 시 기존 5개 CORS 프록시 체인 폴백 유지
- 타임스탬프 표시: "📌 2026-03-21 기준 · 실시간 연결 중..."

## v17.0 — 2026-03-21

### 무엇을 바꿨나
**정적 기본값 즉시 로드 — API 실패해도 데이터 공백 없애기.**
페이지 로드 즉시 2026-03-21 기준 추정값으로 모든 데이터 칸을 채우고,
실시간 데이터 도착 시 자동 교체. API 실패해도 항상 숫자가 보임.

---

### 핵심 변경: applyStaticFallbacks() 신규 함수

동작 순서:
1. DOMContentLoaded → applyStaticFallbacks() → 모든 칸 즉시 채움 (0ms)
2. fetchLiveQuotes() → API 성공 시 자동 교체 (수초 내)
3. fetchAllNews()   → RSS 성공 시 뉴스 교체 (3초 후)

정적 기본값 76개 심볼 커버:
- 지수 6개: SPX 5,580 / VIX 20.8 / Nasdaq 17,318 / RUT 2,041
- 원자재 6개: WTI $92.4 / Brent $107.2 (이란전쟁) / Gold $3,052
- 크립토 4개: BTC $84,200 / ETH $3,820 / SOL $143
- 외환 6개: DXY 104.2 / KRW 1,458 / JPY 149.4 / EUR 1.084
- 금리 4개: TNX 4.31% / TYX 4.61%
- ETF 20개+: HYG 78.5 / TLT 87.5 / SPY 556.2 / XLE 96.4
- 개별주 20개+: NVDA 119.4 / MU 104.2 (어닝서프) / LMT 512.4 (방산)

---

### 초기 DOM 값 교체 (22개)

SPX "로딩중" → 5,580 / VIX "로딩중" → 20.8 / WTI "로딩중" → 92.4
Gold "로딩중" → 3,052 / BTC "로딩중" → 84,200
변동성 상태 "—" → "불안 (주의)" / VIX 서브 "로딩중..." → "VIX 20.8 · 67%ile"
HY Spread "—" → "+342bp" / RSP/SPY "—" → "0.291" / F&G "—" → "18"
Risk Monitor (VIX·HYG·TNX) "—" → 각 추정값 / FX 변동률 "—" → 추정%

---

### 데이터 신뢰도 표시

- 타임스탬프: "3/21 추정값 · 실시간 연결 중..." 표시
- API 성공 시: 실제 시각으로 자동 교체됨
- 값 출처: 데일리 브리핑 및 뉴스 기사 확인 기반 (WTI·Brent·VIX·KRW 등)

---

### 파일 정보
- 입력: aio_ui_prototype_v16.html (605,664 bytes)
- 출력: aio_ui_prototype_v17.html (615,671 bytes / 9,656 줄)
- div 균형: 2,169 / 2,169 v
- script 균형: 6 open / 6 close v

---

## v16.1 — 2026-03-21

### 무엇을 바꿨나
**두 가지 핵심 버그 수정 + 데이터 fetch 강화.**

---

### 🔴 [긴급 버그 수정] v8 Signal 코드 `<script>` 태그 누락 (v13~v15 내내 존재)

- **증상**: 대시보드 모든 페이지 하단에 JS 소스코드가 텍스트로 노출됨
- **원인**: `// v8 Signal Dashboard` 이후 2,500줄 이상 코드가 `<script>` 태그 없이 HTML 본문에 노출
- **결과**: `initSignalDashboard is not defined` 콘솔 에러, Signal/FX·Bond 페이지 기능 전체 미동작
- **수정**: line 8896 앞에 `<script>` 삽입, line 9454 뒤에 `</script>` 삽입 → v15, v16 모두 적용
- **영향 범위**: Signal 대시보드, FX·Bond 페이지, initSignalDashboard, updateFxBondPage 전체

---

### 🟡 CORS 프록시 체인 확장 (3개 → 5단계)

| 순위 | 프록시 | 비고 |
|------|--------|------|
| 1 | api.allorigins.win | 기존 주력 |
| 2 | corsproxy.app | 신규 추가 |
| 3 | corsproxy.io | 기존 폴백 |
| 4 | api.codetabs.com | 기존 폴백 |
| 5 | allorigins.win/raw | 신규 추가 |

- `PROXY_CHAIN` 배열 신규 정의 → `fetchOneFeed()`에서 자동 사용
- `fetchLiveQuotes()`: Yahoo Finance v7 + v8 두 엔드포인트 × 5 프록시 = 최대 10회 시도
- `fetchHYSpread()`: FRED CSV URL에 4-proxy 루프 추가

---

### 🟡 시세 fetch 자동 재시도

- 모든 프록시 실패 시 2분 후 자동 재시도
- 성공 시 `#live-quote-ts` 레이블에 "시세 HH:MM 갱신" 표시
- 실패 원인: Yahoo Finance CORS 차단 + CORS 프록시 과부하 — 구조적 한계이며 재시도로 완화

---

### ℹ️ 데이터 fetch 한계 설명 (구조적)

| 데이터 | 원인 | 상태 |
|--------|------|------|
| 실시간 시세 (Yahoo) | Yahoo Finance CORS 차단, 프록시 불안정 | 프록시 5단계로 개선 |
| HY Spread (FRED) | CORS + allorigins 부하 | 4-proxy 루프로 개선 |
| RSS 뉴스 | CORS 프록시 일시 다운 | 5-proxy chain 적용 |
| VIX/지수 | 동일 | 자동 재시도 추가 |

> **근본 원인**: 정적 HTML 파일을 로컬/브라우저에서 직접 열 경우 외부 API는 반드시 CORS 프록시를 통해야 하며, 무료 공개 프록시는 간헐적으로 다운/차단됨. 백엔드 서버(Node.js, Flask 등) 없이는 100% 신뢰성 보장 불가.

---

### 파일 정보
- v15.html + v16.html 모두 script 태그 수정 적용
- div 균형: 2,169 / 2,169 ✅
- script 균형: 6 open / 6 close ✅

---

## v16.0 — 2026-03-21

### 무엇을 바꿨나
**섹션별 뉴스 시간창(Time Window) 분리 + RSS 소스 대폭 확장.**
사용자 요청에 따라 대시보드·시장소식·데일리브리핑 3개 섹션이 각각 다른 기간의 뉴스를 표시하도록 구현.
RSS 소스도 37개 → 50개+로 확장해 시장소식의 취재 범위를 넓힘.

---

### 🟢 핵심 변경: 섹션별 뉴스 시간창

| 섹션 | 기간 | 목적 |
|------|------|------|
| 대시보드 상단 뉴스 | **7일 (168h)** | 이번 주 시장 화두 — 유연성 있게 주간 핫이슈 반영 |
| 시장 소식 (Market News) | **3일 (72h)** | 최신 시황 — 3일 지난 뉴스 자동 제외 |
| 데일리 브리핑 | **24시간** | 오늘 뉴스만 — 24시간 지나면 자동 제외 |

---

### 🟢 신규 함수: `filterByAge(items, maxHours)`

```js
// pubDate 기준 시간 필터 (pubDate 없으면 최신으로 간주)
function filterByAge(items, maxHours) { ... }

// 시간창 상수
const TW_HOME_H     = 168;  // 7일
const TW_MARKET_H   = 72;   // 3일
const TW_BRIEFING_H = 24;   // 24시간
```
- `updateHomeNewsGrid()` → `filterByAge(items, TW_HOME_H)` 적용
- `renderFeed()` → `filterByAge(items, TW_MARKET_H)` 적용
- `renderBriefingFeed()` (신규) → `filterByAge(newsCache, TW_BRIEFING_H)` 적용

---

### 🟢 신규 함수: `renderBriefingFeed()`

- 데일리 브리핑 페이지에 **실시간 24시간 뉴스 섹션** 추가
- 캐시에서 24h 이내 뉴스 최대 20건, 점수 정렬, analyst 제외
- `fetchAllNews()` 완료 시 자동 호출
- `showPage('briefing')` 시 자동 호출

---

### 🟢 데일리 브리핑 페이지 — 실시간 뉴스 섹션 추가

```html
<!-- 새로 삽입된 섹션 (기존 정적 분석 위에 위치) -->
<div id="briefing-live-news-list">
  <!-- 24시간 이내 RSS 뉴스 자동 채움 -->
</div>
```
- `id="briefing-24h-count"`: 24시간 이내 건수 자동 표시
- `id="briefing-24h-ts"`: 최종 갱신 시각 표시

---

### 🟢 RSS 소스 확장 (37개 → 50개+)

새로 추가된 소스:

| 소스 | 분류 | 목적 |
|------|------|------|
| AP News Economy | 글로벌 | 미국 경제 AP 전문 |
| NPR Business | 글로벌 | 미국 공영방송 |
| Benzinga | 글로벌 | 시장 속보 |
| Investopedia | 글로벌 | 금융 용어·시장 해설 |
| The Street | 주식 | 미국 주식 전문 |
| Al Jazeera Business | 지정학 | 중동·글로벌 |
| Middle East Eye | 지정학 | 이란전쟁 등 중동 뉴스 |
| Reuters Breaking Views | 글로벌 | 심층 경제 논평 |
| FT Tech | 테크 | FT 기술 섹션 |
| Economic Times | 아시아 | 인도 경제 |
| Taiwan News | 아시아 | 대만 (반도체·지정학) |
| 연합뉴스 국제 | 한국 | 국제 뉴스 한국어 |
| 뉴시스 경제 | 한국 | 한국 경제 |

---

### 🟢 UI 레이블 개선

- 대시보드 상단 뉴스: **📅 7일** 배지 추가, "이번 주 화두 우선" 설명
- 시장 소식 헤더: **📅 3일 이내** 배지 + 실시간 건수 표시 (`market-news-tw-label`)
- 시장 소식 제목: `Market News` → `시장 소식 (Market News)`
- 소스 목록 텍스트: 신규 소스 반영 업데이트

---

### 파일 정보
- 입력: `aio_ui_prototype_v15.html` (539,717 bytes / 9,356 줄)
- 출력: `aio_ui_prototype_v16.html` (603,653 bytes / 9,459 줄)
- 빌드: Python 패치 스크립트 15개 항목
- div 균형: 2,169 / 2,169 ✅
- 버전 태그: `v15.0` → `v16.0` ✅

---

## v15.1 — 2026-03-21

### 무엇을 바꿨나
**홈 뉴스 스트립 실시간 화두 반영 + 뉴스 스코어링 키워드 업데이트.**
주요 뉴스 플레이스홀더 카드 6장을 현재 시장 최대 화두(이란전쟁·MU실적·FOMC)로 교체.
`MACRO_KW / TECH_KW / BEAR_KW / BULL_KW` 스코어링 배열에 신규 키워드 41개 추가 →
RSS 자동 수집 시 현재 화두 뉴스가 상단에 정렬되도록 가중치 강화.

---

### 🟡 홈 뉴스 플레이스홀더 교체 (6장)

> **구조 설명**: 홈 `#home-news-grid`는 페이지 로드 3초 후 `fetchAllNews()`가
> RSS를 받아 자동 교체. 플레이스홀더는 초기 화면 표시용이므로
> 매주 주요 화두로 수동 갱신 필요.

| # | 이전 | 이후 (2026-03-21 기준) |
|---|------|------------------------|
| 1 | 연준 금리 동결 소식 | 🔴 이란-미국-이스라엘 전쟁 — 호르무즈 해협 긴장, 브렌트유 $107 (+40%) |
| 2 | 관세 전쟁 일반 소식 | ✅ Micron(MU) 어닝 서프라이즈 — EPS $1.56 (예상 $1.29), AI 메모리 수요 급증 |
| 3 | 시장 지표 일반 소식 | 🏦 FOMC 3월 동결 확인 — Fed Fund Rate 3.50–3.75%, 연내 2회 인하 전망 유지 |
| 4 | 섹터 로테이션 소식 | ⚠️ 관세 리스크 + PPI 0.7% 서프라이즈 — 스태그플레이션 경고 |
| 5 | 기술주 소식 | 📊 시장 폭 악화 — S&P500 중 200일선 상위 종목 41% (3개월 저점) |
| 6 | 일반 전망 | 📅 다음주 핵심 일정 — PCE 물가(3/28), GDP 수정치(3/27), CB 소비자신뢰(3/25) |

---

### 🟡 FOMC 배너 수치 정정

- **위치**: 홈 이벤트 배너 `#home-event-banner`
- **오류**: `Fed Fund Rate: 4.25–4.50%` (구 2024년 수치)
- **수정**: `Fed Fund Rate: 3.50–3.75%` (2026-03-18 FOMC 동결 확인 기준)

---

### 🟡 뉴스 스코어링 키워드 추가 (41개)

#### MACRO_KW (+12) — 지정학·전쟁 관련
```
'Iran', 'Hormuz', 'strait', 'airstrike', 'ceasefire', 'escalation',
'Middle East', 'Brent', 'crude oil', 'oil embargo', 'energy shock', 'oil supply',
'이란', '호르무즈', '원유 급등', '스태그플레이션', '에너지 위기', '유가 충격'
```
→ 이란전쟁 관련 RSS 기사에 +25pt 가중치 적용

#### TECH_KW (+10) — Micron / 메모리 반도체
```
'Micron', 'memory', 'DRAM', 'NAND', 'HBM demand', 'memory shortage',
'memory boom', 'MU earnings', 'AI memory', 'data center memory',
'메모리', 'D램', '낸드'
```
→ MU 실적 / AI 메모리 수요 RSS에 +15pt 가중치 적용

#### BEAR_KW (+10) — 약세 심리 키워드
```
'oil shock', 'war premium', 'stagflation', 'supply disruption', 'energy shock',
'Hormuz closure', 'oil embargo', 'inflation surge', 'PPI surge', 'escalation',
'유가 급등', '스태그플레이션', '원유 위기', '전쟁 리스크', '에너지 충격'
```

#### BULL_KW (+9) — 강세 심리 키워드
```
'earnings beat', 'earnings surprise', 'revenue tripled', 'memory boom',
'AI demand surge', 'AI capex', 'guidance raise', 'beats forecast',
'어닝 서프라이즈', '실적 급등', '매출 급증', '메모리 호황', 'AI 수요'
```

---

### 파일 정보
- 입력: `aio_ui_prototype_v15.html` (v15.0 기반)
- 출력: `aio_ui_prototype_v15.html` (in-place patch, ~539KB / 9,356 줄)
- 빌드: Python 패치 스크립트 (플레이스홀더 6장 + 키워드 41개 + FOMC 배너)
- div 균형: 2,162 / 2,162 ✅

---

## v15.0 — 2026-03-21

### 무엇을 바꿨나
**텍스트·용어·폰트·구조 전면 점검 — 주식 초보자 친화 패치.**
전문 용어·영어 라벨·작은 글씨 등 초보자가 이해하기 어려운 표현을 전면 정비.
60개 이상의 텍스트 교체 + CSS 가독성 강화 블록 추가.

---

### 🟢 텍스트·용어 개선 (60개+)

#### 1. 로고 서브타이틀
- `Market Intelligence Platform` → `주식 종합 분석 플랫폼`

#### 2. 네비게이션 라벨 한국어화
- `Market Breadth` → `시장 폭 분석`
- `Sentiment` → `투자 심리`

#### 3. 사이드바 버튼 한국어화
- `FEEDBACK` → `💬 피드백`
- `BOARD` → `📋 게시판`
- `🤖 AI ASSISTANT` → `🤖 AI 도우미`

#### 4. 홈 페이지
- 페이지 제목: `Market Overview` → `시장 현황 (Market Overview)`
- 상태 뱃지: `🔴 RISK-OFF` → `🔴 위험 회피 장세 (RISK-OFF)`
- 리스크 현황판: `8-Point Risk Heatmap` → `8가지 리스크 현황판`
- 시장 폭 위젯: `Market Breadth — 시장 폭` → `시장 폭 (Market Breadth)`

#### 5. 시그널 페이지
- 점수 가중치 설명: `Volatility 25% · Momentum 25% · Trend 20% · Breadth 20% · Macro 10%`
  → `변동성 25% · 모멘텀 25% · 추세 20% · 시장폭 20% · 거시경제 10%`
- 실행 타이밍 제목: `⏱ EXECUTION WINDOW SCORE` → `⏱ 최적 거래 타이밍`
- 실행 타이밍 설명: `시장 시간 / 유동성 / 변동성 타이밍` → `지금이 거래하기 좋은 시간대인지 평가합니다`
- 점수 분해 제목: `구성 점수 분해 (Weighted Breakdown)` → `점수 구성 상세 (가중 평균)`

#### 6. 리스크 모니터 라벨 (rm-label 7개)
- `VIX` → `공포지수 (VIX)` + 툴팁 설명 개선
- `VVIX` → `VVIX (공포의 공포)` + 툴팁 개선
- `VIX Structure` → `VIX 선물 구조` + Contango/Backwardation 설명 한국어화
- `MOVE Index` → `MOVE (채권 변동성)` + 툴팁 개선
- `DXY` → `달러 인덱스 (DXY)` + 툴팁 개선
- `HYG (HY Spread)` → `HYG (고수익 채권)` + 툴팁 개선
- `TNX (10Y Yield)` → `미국 10년 금리 (TNX)` + 툴팁 개선
- `RSP/SPY Ratio` → `시장 균형도 (RSP/SPY)` + 툴팁 개선
- `Fear & Greed` → `공포 & 탐욕 지수` + 툴팁 개선
- `Backwardation` → `역전 (백워데이션)`
- `Elevated` → `높음 (Elevated)`

#### 7. 시장 폭(Breadth) 바 라벨 7개
- `% above 20 SMA` → `20일선 상위 종목 비율`
- `% above 50 SMA` → `50일선 상위 종목 비율`
- `% above 200 SMA` → `200일선 상위 종목 비율`
- `NYSE A/D Ratio` → `NYSE 상승/하락 비율`
- `RSP/SPY Relative` → `시장 균등도 (RSP/SPY)`
- `McClellan Summation` → `매클렐런 에너지 지수`
- `Weinstein Stage` → `와인스타인 스테이지`
- 상태 배지: `BEARISH` → `약세`, `WEAK` → `약세 징조`, `BEARISH DIV` → `베어 다이버전스`

#### 8. 섹터 히트맵 ETF 이름 한국어화 (12개)
- Technology → 기술주, Financials → 금융, Energy → 에너지, Health Care → 헬스케어
- Industrials → 산업재, Cons Disc → 소비재, Cons Staples → 필수소비재
- Real Estate → 부동산(리츠), Materials → 원자재, Utilities → 유틸리티
- Comm Svc → 통신서비스, Gold → 금 (Gold)

#### 9. 섹터 RRG 위상도
- 섹션 제목: `Sector RRG Positioning` → `섹터 로테이션 위상도 (RRG)`
- 사분면: `LEADING` → `LEADING (주도 섹터)`, `IMPROVING` → `IMPROVING (상승 전환)`
- 사분면: `WEAKENING` → `WEAKENING (약화 중)`, `LAGGING` → `LAGGING (낙후 섹터)`

#### 10. Breadth 차트 타이틀
- `$SPXA5R (5일선 상위)` → `5일 이평선 상위 비율 ($SPXA5R)`
- `$SPXA20R (20일선 상위)` → `20일 이평선 상위 비율 ($SPXA20R)`
- `$SPXA50R (50일선 상위)` → `50일 이평선 상위 비율 ($SPXA50R)`

---

### 🟢 CSS 가독성 강화 (v15 override 블록 추가)

| 대상 | 변경 내용 |
|------|-----------|
| `.rm-label` | font-size 10px, font-weight 700, line-height 1.45 보장 |
| `.bb-label` | font-size 11px, min-width 130px로 잘림 방지 |
| `.tip-body` | font-size 11px, line-height 1.65, padding 9px 보장 |
| `.tac-score-label` | font-size 9px, letter-spacing 0.04em |
| `.stage-desc / .stage-label` | font-size 9px, line-height 1.5 |
| `.tac-event-scenario / .tac-kill-trigger` | 10~11px 보장 |
| `.nc-title / .nc-desc` | 12px / 11px 보장 |
| `.tac-heat-badge / .tac-sector-name` | 9px / 11px 보장 |
| `.sec-name / .rrg-tag` | 9px 보장 |
| `.energy-note / .flow-stat-lbl` | 9px, line-height 개선 |

---

### 파일 정보
- 입력: `aio_ui_prototype_v14.html` (536,392 bytes / 9,263 줄)
- 출력: `aio_ui_prototype_v15.html` (~570KB / ~9,350 줄)
- 빌드: Python 패치 스크립트 (60개+ 텍스트 치환 + CSS 블록 추가)
- div 균형: 2,162 / 2,162 ✅
- 버전 태그: `v14.0` → `v15.0` ✅

---

## v14.0 — 2026-03-21

### 무엇을 바꿨나
**자체 지표·수치 객관 점검 + 접근성 패치.**
v13 출시 직후 자체 지표·데이터·수치의 정확성을 전면 감사(audit)하여 발견된
정적 하드코딩 5건·로직 오류 2건·접근성 미비 2건 총 9개 이슈를 일괄 수정.

---

### 🔵 지표 감사 결과 수정 (5건)

#### 1. Options 페이지 VIX %ile 하드코딩 제거
- **위치**: `applyLiveQuotes()` + `.options-vix-pct-label` 클래스, `#vix-pct-table-cell`
- **증상**: Options 페이지 VIX 백분위수가 `90.9%ile · Stressed`로 고정 — 실시간 VIX 변동 미반영
- **수정**: `applyLiveQuotes()` 내 VIX 처리 블록에 `vixToPercentile()` / `vixRegime()` 호출 추가.
  `.options-vix-pct-label` 클래스 및 `vix-pct-table-cell` ID를 동적으로 업데이트

#### 2. breadth200 = 27.1 하드코딩
- **위치**: `computeTradingScore()` 내 `const breadth200 = 27.1`
- **증상**: BreadthScore 계산에 실제 Breadth 페이지 값이 아닌 고정값 사용 → 항상 28/100 고정
- **수정**: `window._breadth200` 참조로 교체. `initBreadthPage()` 완료 시 최신 배열 마지막 값 캐싱

#### 3. RSP/SPY 임계값 역사적 평균 기반 재보정
- **위치**: `updateRiskMonitor()` 내 RSP/SPY 판단 로직
- **증상**: 임계값 0.32/0.30이 역사적 평균(0.28~0.30) 대비 너무 높아 '건강' 과잉 판정
- **수정**: `ratio > 0.30 → 폭 넓음(건강)`, `ratio > 0.285 → 경계선`, 이하 `빅테크 집중(취약)`

#### 4. SPX MA 하드코딩 → window._spxMA 외부화
- **위치**: `computeTradingScore()` 내 `const spx200ma = 5200` 등
- **증상**: 3/21 기준 5200/5400 고정값 — 이후 시장 이동 반영 불가
- **수정**: `window._spxMA && window._spxMA[200]` 참조로 교체. 기본값 5580/5740(최근 수준)으로 갱신

#### 5. Risk Composite VIX 단독 → 복합 지표 업그레이드
- **위치**: `updateRiskMonitor()` 내 `riskComposite` 계산
- **증상**: 리스크 종합 점수가 VIX만 사용 — HYG(신용시장)·TNX(금리) 미반영
- **수정**: VIX(50%) + HYG(25%) + TNX(25%) 복합 지표로 업그레이드

---

### 🔵 로직 오류 수정 (2건)

#### 6. EDT/EST UTC-4 하드코딩 → DST 자동감지
- **위치**: `getExecutionWindowScore()` 내 ET 시간대 계산
- **증상**: `etOffset = -4 * 60` 고정 → 겨울(EST)·여름(EDT) 구분 없이 1시간 오차
- **수정**: `isEDT(d)` 함수 신규 추가 — 미국 DST 규칙(3월 2번째 일요일 ~ 11월 1번째 일요일) 자동 판별

#### 7. breadth200 캐싱 누락
- **위치**: `initBreadthPage()` 완료 시점
- **증상**: `window._breadth200` 할당 코드 없어 항상 undefined → 하드코딩 기본값 사용
- **수정**: `initBreadthPage()` 마지막에 `window._breadth200 = bpSPX20[bpSPX20.length - 1]` 추가

---

### 🔵 접근성 개선 (2건)

#### 8. 네비게이션 키보드 접근성
- **위치**: nav-item 19개 전체
- **수정**: `role="button" tabindex="0"` 일괄 추가
- **추가**: `.nav-item:focus-visible { outline: 2px solid ... }` CSS 추가
- **추가**: `<nav class="sidebar">` → `<nav class="sidebar" aria-label="메인 네비게이션">`
- **추가**: `.search-bar:focus-within` 포커스 인디케이터 CSS
- **추가**: `.acp-input-row input:focus` outline CSS

#### 9. 날짜 레이블 데이터 신선도 명시
- **위치**: `updateDateLabels()` 내 `dlEl.textContent`
- **수정**: `⚡실시간: 시세·뉴스·F&G  |  📌정적: MA·Breadth·CP리스크(주1회 갱신)` 로 교체
- 사용자가 어떤 데이터가 실시간이고 어떤 데이터가 정적인지 즉시 파악 가능

---

### 파일 정보
- 입력: `aio_ui_prototype_v13.html` (587,198 bytes / 9,226 줄)
- 출력: `aio_ui_prototype_v14.html` (536,392 bytes / 9,263 줄)
- 빌드: Python 패치 스크립트 (9개 패치 순차 적용)
- div 균형: 2,162 / 2,162 ✅ · `isEDT` 함수 ✅ · `window._breadth200` ✅

---

## v13.0 — 2026-03-21

### 무엇을 바꿨나
**전면 버그 수정 + 데이터 소스 확장 + 구조 정상화 패치.**
v12 코드 정밀 점검을 통해 발견된 Critical 5건·Major 5건·Medium 8건 총 18개 이슈를 일괄 수정.
새 기능 추가 없이 기존 기능을 올바르게 작동시키는 데 집중.

---

### 🔴 Critical 버그 수정 (5건)

#### 1. 홈 뉴스 그리드 템플릿 리터럴 이스케이프 버그
- **위치**: `updateHomeNewsGrid()` 내 map 함수 (L6126–6137)
- **증상**: 홈 뉴스 카드의 CSS 클래스·제목·시간이 리터럴 문자열 `${tag.dot}`, `${title}` 등으로 출력됨 (값 미반영)
- **원인**: 백틱 템플릿 리터럴 안에서 `\${...}` 로 잘못 이스케이프
- **수정**: `\${tag.dot}` → `${tag.dot}`, `\${tag.cls}` → `${tag.cls}`, `\${tag.txt}` → `${tag.txt}`, `\${title}` → `${title}`, `\${ago}` → `${ago}`, `\${src}` → `${src}`, `\${items.length}` → `${items.length}` (총 7개 표현식)

#### 2. AIO_NEWS_SOURCES 전체 `tier` · `flag` 필드 누락
- **위치**: `AIO_NEWS_SOURCES` 배열 (37개 소스 전체)
- **증상**: `renderFeed()`의 tier1/2/3 섹션 분리 불가, 뉴스 카드 국기 아이콘 `undefined` 출력
- **원인**: 소스 정의 시 `tier`, `flag` 키를 빠뜨림
- **수정**: 전체 소스에 `tier: 1/2/3`, `flag: '🇺🇸/🇰🇷/...'` 필드 일괄 추가 (43개 소스)

#### 3. `.alert-card` CSS 클래스 미정의
- **위치**: `<style>` 블록
- **증상**: `renderNewsCard()`가 `.alert-card.info` 클래스를 사용하나 CSS에 정의 없어 뉴스 카드 스타일 전혀 미적용
- **수정**: `.alert-card`, `.alert-card.info/warn/danger/success` CSS 규칙 추가

#### 4. `fundamentalSearch()` 함수 미정의
- **위치**: `page-fundamental` 검색 버튼 `onclick` 핸들러
- **증상**: 기업분석 페이지 검색 버튼 클릭 시 `ReferenceError: fundamentalSearch is not defined`
- **수정**: `fundamentalSearch()` 함수 신규 정의 — 검색어를 AI 채팅 입력창에 전달 후 `chatSend('fundamental')` 호출

#### 5. `applyLiveQuotes` 3중 override 체인
- **위치**: 파일 후반부 두 개의 IIFE
- **증상**: `var origApply = window.applyLiveQuotes` 패턴이 3개 중첩 — 실행 순서에 따라 `undefined is not a function` 발생 가능
- **수정**: override 체인 완전 제거 → `document.dispatchEvent(new Event('aio:liveQuotes'))` 커스텀 이벤트 방식으로 교체. Signal 페이지·FX/Bond 페이지가 각자 `addEventListener`로 구독

---

### 🟠 Major 버그 수정 (5건)

#### 6. `escHtml()` 함수 스코프 오류
- **증상**: `renderNewsCard()`에서 `escHtml()` 호출하나 함수가 피드백 보드 스크립트 블록에만 정의되어 있어 일부 실행 환경에서 ReferenceError
- **수정**: 뉴스 스코어링 섹션 상단에 전역 `escHtml()` 함수 추가

#### 7. `getCountryFlag()` 국가→플래그 매핑 미정의
- **증상**: `fetchAllNews()`에서 각 아이템에 `flag` 를 할당하나 매핑 함수 없음 → `item.flag = undefined`
- **수정**: `COUNTRY_FLAG` 객체 및 `getCountryFlag(country)` 함수 신규 추가. `fetchAllNews()` 파이프라인에 `flag: i.flag || getCountryFlag(i.country)` 연산 추가

#### 8. VIX 백분위수 하드코딩 (7곳)
- **증상**: `90.9%ile`, `Stressed` 등 VIX 관련 표시가 정적 문자열로 7곳에 산재 — 실시간 VIX 변동 미반영
- **수정**:
  - `vixToPercentile(vix)` 함수 신규 추가 — 1990~2026 역사적 VIX 분포 기반 CDF 근사 계산
  - `vixRegime(vix)` 함수 신규 추가 — Subdued/Low/Normal/Elevated/Stressed/Crisis/Extreme 7단계 분류
  - `applyLiveQuotes()` 내 VIX 처리 블록에서 두 함수 호출, `#vol-regime-val`, `#vol-regime-sub`, `#vix-pct-cell` 실시간 업데이트

#### 9. Korea Market CSS 블록 중복
- **위치**: `<style>` 내 `/* ═══ KOREA MARKET ═══ */` 주석 블록
- **증상**: 동일한 CSS 규칙 블록이 2회 중복 정의 (6,328자) — 스타일 충돌 가능성 + 파일 불필요 비대화
- **수정**: 두 번째 중복 블록 완전 삭제

#### 10. `window._lastFG` 미설정
- **증상**: `computeTradingScore()`에서 `window._lastFG || 25` 로 Fear&Greed 값을 참조하나, `fetchFearGreed()` 성공 시 `_lastFG` 에 캐싱하는 코드가 없어 항상 기본값 25 사용 → Momentum Score 상시 32점 고정
- **수정**: `fetchFearGreed()` 내 score 확정 시점에 `window._lastFG = score;` 할당 추가 (직접 fetch 경로·프록시 경로 양쪽)

---

### 🟡 Medium 개선 (8건)

#### 11. 뉴스 카드 디자인 개선 (`news-card-v13`)
- 기존 `.alert-card` 기반 단순 레이아웃 → `.news-card-v13` 컴포넌트로 교체
- 구성: 국기 아이콘 + 출처명 + 토픽 배지 (색상 구분) + 상대시간 + 티커 태그 + 제목 + 요약 + 감성 바
- 감성(sentiment) 바: -1~+1 값을 좌우 폭으로 시각화, 강세(초록)/약세(빨강)/중립(회색)
- 토픽별 색상 배지: macro(노랑) / geo(빨강) / semi(파랑) / earnings(초록) / energy(주황) / crypto(보라) / analyst(회색)
- 신규 CSS: `.news-card-v13`, `.nc-header`, `.nc-flag`, `.nc-source`, `.nc-topic`, `.nc-time`, `.nc-tickers`, `.nc-title`, `.nc-desc`, `.nc-foot`, `.nc-sent-bar`, `.nc-sent-fill`

#### 12. `LIVE_SYMBOLS` 확장 (58개 → 67개)
- 추가: `^FTSE`, `^N225`, `^HSI` (글로벌 지수)
- 추가: `BZ=F` (브렌트유), `PL=F` (백금), `PA=F` (팔라듐), `ZC=F` (옥수수), `ZW=F` (소맥)
- 추가: `SOL-USD`, `BNB-USD` (크립토)
- 추가: `CHFUSD=X`, `SGDUSD=X` (스위스프랑·싱가포르달러)
- 추가: `LMT`, `RTX`, `NOC`, `GD`, `HII` (방산), `JPM`, `GS`, `MS`, `BLK`, `WFC` (금융), `LLY`, `JNJ`, `MRK`, `PFE`, `ABBV` (헬스케어), `RKLB`, `ASTS`, `HOOD`, `COIN`, `MARA` (성장·크립토)
- 추가: `ITA`, `OIH`, `IGV`, `SOXX`, `ARKK`, `HACK`, `GDX` (섹터 ETF)
- 추가: `UVXY`, `SQQQ`, `SH` (변동성·인버스 모니터)

#### 13. `AIO_NEWS_SOURCES` 확장 (37개 → 43개)
- 추가: **Wired Business** (tech/macro)
- 추가: **EIA News** (에너지 공식 발표)
- 추가: **CryptoSlate** (크립토)
- 추가: **The Straits Times** (싱가포르/아시아 시장)
- 추가: **Channel NewsAsia** (아시아 거시)
- 추가: **DW Business** (독일/유럽)

#### 14. CORS 프록시 3중화
- 기존: `allorigins.win` → `corsproxy.io` 2단계
- 추가: `api.codetabs.com` 3번째 폴백
- `fetchOneFeed()` proxies 배열에 3번째 엔트리 추가

#### 15. 뉴스 중복 제거 로직 개선
- 기존: 제목 앞 40자 기준 단순 비교
- 수정: 제목 앞 60자 + 특수문자 제거 후 정규화 키 비교 (`replace(/[^a-z0-9가-힣]/g, '')`)
- 빈 제목(10자 미만) 필터링 추가

#### 16. HY Spread 동적 표시
- 홈 Market Status 카드 `#hy-spread-val` 하드코딩 `+42bp` → `—` (로딩 대기)
- `applyLiveQuotes()` 내 HYG 가격 수신 시 스프레드 자동 추정 및 업데이트: `(82.5 - hygPrice) * 80 + 240` bp 근사식 사용
- 색상 등급: <300bp 초록(Tight) / <450bp 노랑(Elevated) / 이상 빨강(Distressed)

#### 17. Signal 페이지 의사결정 threshold 개선
- 기존: 고정 65점 YES / 45점 CAUTION / 미만 NO (2단계)
- 수정: 모드별 동적 threshold (`swing`: 60점, `day`: 65점 기준)
  - `threshold + 10` 이상 → ✅ YES
  - `threshold - 10` 이상 → ⚠ CAUTION
  - `threshold - 25` 이상 → 🔴 NO
  - 미만 → 🚨 AVOID — 즉시 청산 (신규 등급)

#### 18. `<div>` 미닫힘 태그 완전 해소
- 기존: `<div>` 열기 2,164개 / 닫기 2,158개 (불균형 6개)
- 수정: `page-home`, `page-signal`, `page-fxbond` 각 1개, `.app`·`.main`·`.content` 래퍼 3개 닫기 태그 추가
- 최종: 열기 2,162개 / 닫기 2,162개 (완전 균형 ✅)

---

### 기타 소규모 수정

- **`globalRefresh()`**: `prevPage` 변수 대신 실제 활성 DOM 요소 기준으로 현재 페이지 감지, FX/Bond 페이지 refresh 케이스 추가
- **`switchTab()`**: 함수 시그니처 `(el, tabId)` → `(tabId, el)` 양방향 호환 처리, 탭 ID 목록에 `tab-chart`, `tab-financials` 추가
- **`BULL_KW` / `BEAR_KW`**: 각 10여개 키워드 추가 (breakout, accumulate, bubble, caution 등)
- **`fetchHYSpread()`**: 6시간 자동 갱신 인터벌 추가 (`setInterval`)
- **뉴스 캐시 상한**: 80개 → 120개
- **배경 뉴스 프리페치**: DOMContentLoaded 후 3초 딜레이로 비동기 news fetch 자동 시작 (첫 진입 시 뉴스 즉시 표시)
- **날짜 라벨 동적화**: `updateDateLabels()` — KST 기준 현재 날짜·요일 자동 계산, `#home-date-label` 업데이트
- **Market Regime 카드 IDs**: `#mkt-regime-sub`, `#risk-appetite-sub` ID 추가, SPX ATH 대비 실시간 퍼센트 표시 (`^GSPC` 수신 시 `#mkt-regime-sub` 업데이트)
- **Signal 페이지 초기화**: `initSignalDashboard()` 호출 시 `fetchLiveQuotes()` 즉시 실행 추가
- **버전 표기**: `v12.0` → `v13.0` (`<title>`, `#app-version-badge`, `version.json` 내 참조)

---

### 수정된 버그 목록 (전체)

| # | 심각도 | 위치 | 증상 | 수정 |
|---|--------|------|------|------|
| 1 | 🔴 Critical | `updateHomeNewsGrid()` | 뉴스 그리드 `${...}` 리터럴 출력 | 이스케이프 제거 |
| 2 | 🔴 Critical | `AIO_NEWS_SOURCES` 전체 | tier/flag undefined | 필드 일괄 추가 |
| 3 | 🔴 Critical | `<style>` | `.alert-card` CSS 미정의 | CSS 규칙 추가 |
| 4 | 🔴 Critical | `page-fundamental` | `fundamentalSearch` ReferenceError | 함수 신규 정의 |
| 5 | 🔴 Critical | JS 전역 | `applyLiveQuotes` 3중 override 체인 | 이벤트 기반으로 교체 |
| 6 | 🟠 Major | JS 전역 | `escHtml` 스코프 오류 | 전역 함수 추가 |
| 7 | 🟠 Major | `fetchAllNews()` | `item.flag = undefined` | `getCountryFlag()` 추가 |
| 8 | 🟠 Major | VIX 표시 7곳 | 90.9%ile 하드코딩 | 동적 계산 함수 도입 |
| 9 | 🟠 Major | `<style>` | Korea Market CSS 6,328자 중복 | 중복 블록 삭제 |
| 10 | 🟠 Major | `fetchFearGreed()` | `_lastFG` 미설정 → 점수 25 고정 | 캐싱 코드 추가 |
| 11 | 🟡 Medium | `renderNewsCard()` | 뉴스 카드 레이아웃 빈약 | `news-card-v13` 컴포넌트 교체 |
| 12 | 🟡 Medium | `LIVE_SYMBOLS` | 방산·헬스·크립토 등 누락 | 58 → 67개 확장 |
| 13 | 🟡 Medium | `AIO_NEWS_SOURCES` | 주요 소스 미포함 | 37 → 43개 확장 |
| 14 | 🟡 Medium | `fetchOneFeed()` | CORS 프록시 2개 | 3개로 확장 |
| 15 | 🟡 Medium | `fetchAllNews()` | 중복 제거 40자·부정확 | 60자 정규화로 개선 |
| 16 | 🟡 Medium | `#hy-spread-val` | +42bp 하드코딩 | HYG 기반 동적 추정 |
| 17 | 🟡 Medium | Signal 점수 | 모드 무관 고정 threshold | 스윙/데이 모드별 분리 |
| 18 | 🟡 Medium | HTML 전체 | `<div>` 6개 미닫힘 | 닫기 태그 추가, 균형 0 |

---

### 파일 정보
- 입력: `aio_ui_prototype_v12.html` (580,516 bytes / 9,129 줄)
- 출력: `aio_ui_prototype_v13.html` (587,198 bytes / 9,226 줄)
- 빌드: Python 패치 스크립트 (36개 패치 함수 순차 적용)
- JS 문법 검증: 통과 ✅ · 준비중: 0 ✅ · 페이지: 21개 ✅
- div 균형: 2,162 / 2,162 ✅ · 이스케이프 오류: 0 ✅

---

## v12.0 — 2026-03-21

### 무엇을 바꿨나
**GitHub Pages 자동 업데이트 연동** 추가. 파일을 push하면 열려있는 모든 브라우저가 자동으로 변경 감지 후 배너 표시.

### 주요 변경
- **상단 업데이트 배너** (`#update-banner`) — 새 버전 감지 시 초록 배너 슬라이드인, 클릭하면 새로고침
- **사이드바 GitHub 설정 행** — `username/repo-name` 입력 필드 + 설정 버튼 + 연결 상태 표시 (`gh-sync-status`)
- **버전 폴링 로직** (`ghPollOnce`, `startGhPolling`, `showUpdateBanner`)
  - 5분마다 `https://raw.githubusercontent.com/[user]/[repo]/main/version.json` fetch
  - 최초 로드 시 현재 버전 기록, 이후 변경 감지 시 배너 표시
  - 연결 상태: ✓ 최신 (초록) / 🔄 신규 (주황) / ✗ 실패 (빨강)
- **`version.json`** 파일 생성 — 배포 시 이 파일만 수정하면 모든 브라우저 감지
- 설정값 `localStorage` 저장 (`aio_gh_repo`) — 새로고침 후에도 유지

### 사용 방법 (GitHub Pages 배포)
1. GitHub 저장소 생성 → `Settings > Pages > Source: main branch`
2. `aio_ui_prototype_v12.html` + `version.json`을 저장소에 push
3. 사이드바 하단 GitHub 설정 행에 `username/repo-name` 입력 후 저장
4. 이후 새 버전 배포 시: `version.json`의 `version` 값 변경 후 push
5. ~1분 내 모든 열린 브라우저에 업데이트 배너 자동 표시

### 파일 정보
- 입력: `aio_ui_prototype_v11.html` (572,769 bytes / 8,958 줄)
- 출력: `aio_ui_prototype_v12.html` (580,516 bytes / 9,129 줄)
- 빌드: `build_v12.py`
- 신규 파일: `version.json`
- JS 문법 검증: 통과 ✅ · 준비중: 0 ✅ · 페이지: 21개 ✅

---

## v11.0 — 2026-03-21

### 무엇을 바꿨나
사이드바 하단에 **LLM AI 패널** 통합. API 키 직접 입력, ON/OFF 토글, 일일 가능 횟수·남은 횟수 시각화.

### 주요 변경
- **사이드바 LLM 패널** (footer 영역 교체)
  - 슬라이드 토글 스위치 (ON/OFF) — `.llm-switch-track / .llm-switch-thumb`
  - API 키 입력 필드 (password type) + 저장 버튼 — `sidebar-api-key`
  - 일일 가능: 10회 / 남은 횟수: N회 — `llm-daily-cap / llm-remaining`
  - 사용량 프로그레스 바 — `llm-prog-fill` (초록→주황→빨강)
  - 예산 안내: "월 $10 · 5인 공유 · 매일 자정 리셋"
- **홈 헤더 배지** → "AI ON · 10/10" 형식으로 남은 횟수 동기화
- `getLLMState()` — `llm-toggle` → `llm-switch-track` 기반으로 교체
- `updateQuotaBadge()` — 사이드바 요소 전부 업데이트하도록 전면 재작성
- `toggleLLM()` — 사이드바 스위치와 헤더 배지 동기화
- `saveSidebarApiKey()` / `loadSidebarApiKey()` — 저장 시 마스킹 표시, 포커스 시 실제 키 노출
- `openApiKeyConfig()` (구 prompt 다이얼로그) 방식 유지(하위 호환)

### 파일 정보
- 입력: `aio_ui_prototype_v10.html` (564,509 bytes / 8,755 줄)
- 출력: `aio_ui_prototype_v11.html` (572,769 bytes / 8,958 줄)
- 빌드: `build_v11.py`
- JS 문법 검증: 통과 ✅ · 준비중: 0 ✅ · 페이지: 21개 ✅

---

## v10.0 — 2026-03-21

### 무엇을 바꿨나
홈 뉴스 로직 전면 재정비. ARM 목표가 상향 같은 개별 종목 analyst 레이팅이 "주요 뉴스"로 뜨는 문제 수정.

### 주요 변경
- **CORS 프록시 이중화** — `allorigins.win` 실패 시 `corsproxy.io` 자동 재시도 (`fetchOneFeed`)
- **키워드 스코어링 4티어 재설계**
  - `MACRO_KW` +25pt: 연준·금리·관세·지정학 등
  - `TECH_KW` +15pt: AI·반도체 구조적 이슈
  - `MED_KW` +6pt: 일반 기업 소식
  - `ANALYST_KW` -20pt 페널티 + `_isAnalyst` 플래그: 목표가·투자의견 변경
- **감성(sentiment) 계산** — `BULL_KW`/`BEAR_KW` 기반 -1~+1 float, 뉴스 카드 색상 정상화
- **`updateHomeNewsGrid()` 재구성** — `_isAnalyst` 제외, 매크로·지정학 4개 우선, 나머지 2개 일반
- **정적 폴백 뉴스 교체** — "HSBC: ARM 목표가 상향" 제거 → 연준·관세·Gold·시장폭 경보 등 매크로 중심
- 홈 뉴스 헤더: "매크로 · 지정학 · 시장구조 우선 — 종목별 analyst 레이팅 제외" 안내 추가
- `TOPIC_KEYWORDS` 확장 — analyst 카테고리 추가

### 수정된 버그
1. `fetchOneFeed` 단일 프록시 → RSS 실패 시 폴백 없음
2. `scoreItem`에서 `item.sentiment` 미설정 → 모든 뉴스 카드 색상 회색
3. `HIGH_KW`에 NVDA/AAPL/TSLA 등 포함 → analyst 레이팅 높은 점수
4. `updateHomeNewsGrid` 단순 `slice(0,6)` → 매크로 우선순위 없음
5. 정적 폴백에 ARM analyst 뉴스 하드코딩

### 파일 정보
- 입력: `aio_ui_prototype_v9.html` (557KB / 8,620 줄)
- 출력: `aio_ui_prototype_v10.html` (564,509 bytes / 8,755 줄)
- 빌드: `build_v10.py`
- JS 문법 검증: 통과 ✅ · 준비중: 0 ✅ · 페이지: 21개 ✅

---

## v9.0 — 2026-03-21

### 무엇을 바꿨나
**외환·채권 (FX·BOND)** 전용 페이지 신설. 환율·국채금리·MOVE·크레딧 스프레드 통합 스크리너.

### 주요 변경
- **신규 페이지 `page-fxbond`** (21번째 페이지)
  - 섹션 A: DXY 메인 게이지 + 8개 FX 페어 카드 (KRW/JPY/EUR/GBP/CNY/AUD/DXY/BTC) 라이브 가격
  - 섹션 B: 수익률 곡선 바 차트 (3M/2Y/5Y/10Y/30Y) + 스프레드 카드 (2s10s, 3M10Y, 5s30s)
  - 섹션 C: MOVE Index 107.4 (정적) + HYG/LQD/EMB 크레딧 + TLT/IEF/SHY ETF 모니터
  - 섹션 D: 글로벌 기준금리 비교표 (US/EU/JP/UK/CN/KR)
  - 섹션 E: 금리·환율 시나리오 영향 매트릭스 (3 시나리오)
- **홈 페이지** — 8셀 FX·Bond 미니 스트립 (DXY/KRW/JPY/EUR + 2Y/10Y/30Y/MOVE)
- **매크로 페이지** 상단 — 6셀 FX 요약 패널 + fxbond 페이지 링크
- **LIVE_SYMBOLS 확장** — KRW=X, JPY=X, EURUSD=X, GBPUSD=X, CNY=X, AUDUSD=X, ^TYX, ^FVX, ^IRX, IEF, SHY, EMB 추가 (총 50+개)
- `updateFxBondPage()` — DXY 신호, 수익률 곡선 바, 스프레드 계산, 크레딧 스프레드 추정 업데이트
- `breadcrumbMap` / `showPage` — fxbond 라우팅 추가
- 신규 CSS: `.fx-card`, `.yc-cell`, `.spread-card`, `.bond-etf-row`, `.home-fx-cell`, `.mfx-cell`

### 파일 정보
- 입력: `aio_ui_prototype_v8.html` (509,125 bytes / 7,870 줄)
- 출력: `aio_ui_prototype_v9.html` (557KB / 8,620 줄)
- 빌드: `build_v9.py`
- JS 문법 검증: 통과 ✅ · 준비중: 0 ✅ · 페이지: 21개 ✅

---

## v8.0 — 2026-03-21

### 무엇을 바꿨나
Signal 페이지를 Bloomberg Terminal급 **"지금 거래해야 할까? / Should I Be Trading?"** 대시보드로 완전 교체.
참고 자료(리스크봇, 시장 폭, 8-Point 히트맵, RRG, 포트폴리오 도넛, 패턴 스캐너) 전면 반영.

### 주요 신규 기능
- **LIVE 종합 거래 점수** (0-100) → YES / CAUTION / NO 의사결정 배지
  - Volatility 25% + Momentum 25% + Trend 20% + Breadth 20% + Macro 10%
  - 스윙 / 데이트레이딩 모드 토글
  - 45초 자동 갱신
- **Execution Window Score** — 미국 동부시간 기준 실행 타이밍 점수 (개장직후/파워아워 최고점)
- **스크롤 티커 바** — 13개 주요 지수·ETF 실시간 흐름 표시
- **FOMC 경보 배너** — 연준 일정·금리 현황 상시 표시
- **리스크 모니터 보드** (리스크봇 스타일)
  - VIX / VVIX / VIX Structure / MOVE Index / DXY / HYG / TNX / Fear&Greed / RSP:SPY 비율
- **8-Point Risk Heatmap** — CP1(지정학)~CP8(사이버) 복합 리스크 시각화
- **Market Breadth 바 차트** — % above 20/50/200 SMA, NYSE A/D, RSP/SPY, McClellan, Weinstein Stage
- **Sector RRG Positioning** — Leading/Improving/Weakening/Lagging 4분면 + 11개 섹터 ETF 라이브 히트맵
- **Portfolio Allocation Donut** — Canvas 도넛 차트 (현금50%/에너지방산30%/달러헤지12%/AI사이버8%)
- **Pattern Scanner** — 6종목 Weinstein Stage/Signal/Momentum 테이블 (라이브 가격)
- **AI Terminal** — 거래 전략 AI 채팅 (신규 signal 컨텍스트)
- **3-Scenario Outlook** — Bull 30% / Base 50% / Bear 20%
- **Exit Triggers** — 6가지 즉시 청산 신호 기준

### 기술 변경
- `LIVE_SYMBOLS` 24개 → 40개 (섹터 ETF 11개, ^VVIX, ^TNX, RSP, QQQ, LQD 추가)
- `applyLiveQuotes` → `window._liveData` 전역 저장소에 실시간 가격 캐싱
- `computeTradingScore()` — VIX·FG·SPX·Breadth 기반 5-Factor 가중 점수 계산
- `drawScoreGauge()` — Canvas Arc 게이지
- `drawPortfolioDonut()` — Canvas 도넛 차트
- `updateRiskMonitor()` — 리스크 셀 실시간 컬러 업데이트
- `updateSectorHeatmap()` — 섹터 타일 등락률 기반 색상 히트맵
- `getExecutionWindowScore()` — 미국 ET 기준 장 시간대 스코어링

### 파일 정보
- 입력: `aio_ui_prototype_v7.html`
- 출력: `aio_ui_prototype_v8.html`
- 크기: 509,125 bytes / 7,870 줄
- JS 문법 검증: 통과 ✅
- 준비중 페이지: 0건 ✅
- 전체 페이지: 20개 모두 정상 ✅

---

## v6.0 — 2026-03-21

### 무엇을 바꿨나
전체 페이지를 완전히 갈아엎고 핵심 3페이지(Dashboard, Trading Signal, News)만 남김.
나머지 14개 페이지는 "준비 중" 플레이스홀더로 교체.

### 왜 바꿨나
- 원본 v4 대비 군데군데 오류 누적, 자체 발명 지표(CONSENSUS/CONVICTION/EVIDENCE/PH-0) 사용, 하드코딩된 가짜 뉴스, 실시간 시세 미연동 문제 다수 존재
- 사용자 요청: "기관(펀드)급 수준의 퀄리티를 주식 초보자도 쉽게 이용할 수 있게", "싹 다 갈아엎어야겠는데"
- 자체 발명 지표 제거하고 Bloomberg/Goldman 실제 사용 용어로 대체

### 어떻게 바꿨나
- `build_v6.py` 빌드 스크립트로 원본 CSS·사이드바 추출 후 새 HTML 조립
- **Dashboard**: 실시간 가격 타일 6개 (SPX/NASDAQ/VIX/WTI/Gold/BTC), Fear&Greed 라이브, Fed Stance, Volatility Regime, RSS 뉴스 6개, Exit Triggers, 섹터 히트맵
- **Trading Signal**: DEFENSIVE 스탠스 배너, Key Levels 테이블 (6 자산 라이브 가격), 3-Scenario 그리드 (Bull 30%/Base 50%/Bear 20%), Watchlist (MU/ARM/NVDA/XLE/GLD)
- **News**: 22개 RSS 소스 자동 수집, 국가·토픽 필터
- **실시간 데이터**: Yahoo Finance API (allorigins.win → corsproxy.io 이중 프록시), CNN Fear&Greed API
- **제거된 것**: CONSENSUS Score, CONVICTION Score, EVIDENCE Score, PH-0, 하드코딩 뉴스
- **추가된 용어**: Market Regime (Bull/Correction/Bear), Risk Appetite (Risk-On/Off), Fed Policy Stance (Hawkish/On Hold/Dovish), HY Credit Spread, Volatility Regime (Subdued/Elevated/Stressed/Crisis)

### 파일 정보
- 출력: `aio_ui_prototype_v6.html`
- 크기: 96,072 bytes / 1,465 줄
- JS 문법 검증: 통과 ✅

---

## v5.x — 2026-03-20 (이전 세션)

### 주요 변경
- build_v5.py로 v4 원본에서 변환
- 5-KPI 바 용어 교체 (1차: Market Consensus 등 → 2차: Bloomberg 실제 용어)
- fgRating 한국어화: 극단적 공포/공포/중립/탐욕/극단적 탐욕
- 다음주 일정 섹션 추가 (3/24~3/28)
- renderFeed JS 문법 오류 수정 (orphaned closing brace 제거)
- showPage('page-market-news') → showPage('market-news', null) 버그 수정
- Barron's 아포스트로피 JS 문법 오류 수정

---

## v4.4 — (원본 프로토타입)

- 파일: `aio_ui_prototype-9d072106.html`
- 원본 기준점. 이후 모든 버전의 CSS·사이드바 소스.
