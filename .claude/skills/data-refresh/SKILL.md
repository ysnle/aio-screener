---
name: data-refresh
description: 전체 하드코딩 데이터 전수 점검 + 최신화. DATA_SNAPSHOT, 심리지표, 브레드쓰, 뉴스, 매크로 등 22개 데이터 카테고리 대상.
---

# /data-refresh -- 전체 하드코딩 데이터 최신화 워크플로우

## 목적
index.html에 하드코딩된 **모든** 시장 데이터의 경과일을 전수 점검하고, 오늘 날짜 기준으로 최신화한다.

---

## 트리거 조건

- 사용자가 `/data-refresh` 명시 호출
- 주기적: **매일** (일간 데이터 갱신) + 주요 발표(FOMC/CPI/NFP/ISM/OPEC 등) 직후
- 이벤트 기반: 지정학적 충격(WTI ±8%, VIX 30+, SPY ±3% 세션) 발생 후 24h 이내
- DATA_SNAPSHOT._updated 경과일 1일 이상 시 자동 후보

## 실행 전 필수 읽기

1. `_context/RULES.md` — R15 (데이터 미수신 vs 0%), R21 (데이터 경과일 관리)
2. `_context/BUG-POSTMORTEM.md` — P10~P11 (bpLabels 동기화), P48 (브레드쓰 배열 2주 괴리), P49 (stale 임계값), P61 (이벤트 후 하드코딩 텍스트 퇴행)
3. `CHANGELOG.md` 최신 5개 — 최근 어느 카테고리가 갱신됐는지 파악 (중복 작업 방지)

---

## 실행 절차

### 1단계: 전수 경과일 스캔 (22개 카테고리)

아래 명령을 **모두** 실행하여 각 데이터의 마지막 업데이트 날짜 추출:

```bash
# === A그룹: 핵심 스냅샷 ===
# A1. DATA_SNAPSHOT._updated (마스터 타임스탬프)
grep -n "_updated" index.html | grep "2026\|_updated:" | head -3

# A2. Fear & Greed 지수
grep -n "fg:" index.html | grep -v "function\|var\|if\|fg[A-Z]" | head -3

# A3. VIX 차트 시계열 (labels20 공유 배열 — VIX+HY OAS 둘 다 이 배열 사용)
# ⚠️ CRITICAL: labels20은 VIX 차트와 HY OAS 차트가 공유한다.
#    연장/수정 시 vixData + hyData 동시에 업데이트 필수!
grep -n "labels20\|vixData" index.html | grep -v "chartDataGate\|sentPageCharts\|datasets\[" | head -5

# === B그룹: 주간 발표 데이터 (매주 업데이트) ===
# B1. AAII 심리 (Bull/Bear/Neutral) — 수요일 설문, 목요일 발표
grep -n "aaiiLabels\|aaiiDatasets" index.html | head -4

# B2. NAAIM 노출 지수 — 수요일 설문, 목요일 발표
grep -n "naaimLabels\|naaimData" index.html | head -4

# B3. Investor Intelligence Bull/Bear
# ⚠️ NOTE: investorsintelligence.com은 구독 필요 — 직접 접근 불가.
#    대안: Yardeni Research ("II bull bear ratio yardeni") 또는 추세 외삽
grep -n "iiLabels\|iiBull\|iiBear" index.html | head -4

# B4. Put/Call 비율 시계열
grep -n "pcLabels\|pcData" index.html | head -4

# === C그룹: 시장 브레드쓰 (주간~일간) ===
# C1. bpLabels (실제 날짜 레이블 — 브레드쓰 차트 전체 공유)
grep -n "bpLabels\|bpSPX5\|bpSPX20\|bpSPX50" index.html | grep -v "window\._breadth\|function\|chart\|data:" | head -8

# C2. NDX 브레드쓰
grep -n "bpNDX5\|bpNDX20\|bpNDX50" index.html | grep -v "window\._breadth\|function\|chart\|data:" | head -4

# C3. McClellan / NYSE A-D (simulated 여부 확인)
grep -n "mcclellan\|advance.*decline\|simulated" index.html | head -5

# C4. Weinstein Stage (텍스트/CHAT_CONTEXT 기반, 별도 배열 없음)
grep -n "와인스타인\|weinstein\|stage.*3\|stage.*4" index.html | head -5

# === D그룹: 채권/신용 (일간~주간) ===
# D1. HY OAS 스프레드 시계열 (⚠️ labels20 공유 — A3 참조)
grep -n "hyData" index.html | grep -v "chartDataGate\|sentPageCharts\|datasets\[" | head -3

# D2. 채권 수익률 폴백 (_SNAP_FALLBACK)
grep -n "_SNAP_FALLBACK" index.html | head -3
grep -A20 "_SNAP_FALLBACK" index.html | grep "TNX\|FVX\|TYX\|IRX"

# D3. 10Y-2Y 스프레드 표시값
grep -n "T10Y2Y\|10Y.*2Y\|2s10s" index.html | head -5

# === E그룹: 매크로 (월간~분기) ===
# E1. CPI/PCE/ISM 등 경제지표
grep -n "cpi:\|pce:\|ismPmi\|ismSvc" index.html | grep -v "function\|var \|if\|//\|_snap\|DATA_SNAPSHOT\._\|data-snap" | head -8

# E2. 실업률/임금/소매판매
grep -n "usUnemploy\|usWageGrowth\|retailSales\|consConf\|housingStarts" index.html | grep -v "function\|var \|if\|//\|_snap\|DATA_SNAPSHOT\._\|data-snap" | head -8

# E3. FOMC 일정
grep -n "fomc\b\|fomcNext\|bokNext" index.html | grep -v "function\|var \|if\|//" | head -5

# E4. 중앙은행 금리 (Fed/ECB/BOJ/BOE/PBOC/BOK)
grep -n "fedRate\|ecbRate\|bojRate\|boeRate\|pbocRate\|bokRate" index.html | grep -v "function\|var \|if\|//" | head -10

# === F그룹: 뉴스/콘텐츠 (일간~주간) ===
# F1. HOME_WEEKLY_NEWS (홈 핵심 뉴스 — 정적 수동 큐레이션, 3건 유지)
grep -A15 "^var HOME_WEEKLY_NEWS" index.html | grep "date:"

# === G그룹: 기준 가격/원자재 ===
# G1. 원자재 폴백 (DATA_SNAPSHOT — API 실패 시 표시값)
# ⚠️ 주의: 원자재(특히 WTI/Brent/Gold)는 지정학 이벤트로 급등락 → 폴백값과 시장가 큰 괴리 발생 가능
grep -n "wti:\|brent:\|gold:" index.html | grep -v "function\|var \|if\|//\|fetchLive\|_liveSnap\|wtiColor\|wtiIcon" | head -5

# G2. 글로벌 지수 (니케이/항셍/DAX 등)
grep -n "nikkei:\|hangseng:\|shanghai:\|dax:\|ftse:\|cac:" index.html | grep -v "function\|var\|if\|//" | head -8

# G3. 암호화폐 (BTC/ETH)
grep -n "btc:\|eth:" index.html | grep -v "function\|var\|if" | head -4

# === H그룹: 한국 시장 ===
# H1. KOSPI/KOSDAQ/원화
grep -n "kospi:\|kosdaq:\|krw:" index.html | grep -v "function\|var\|if" | head -6

# H2. 한국 금리/GDP/CPI
grep -n "bokRate\|krBond\|krGdp\|krCpi" index.html | head -6

# H3. VKOSPI
grep -n "vkospi:" index.html | head -3

# H4. 한국 수급 (동적 — 네이버 investorTrend API)
# fetchKrSupplyData() → updateKrSupplyDOM()에서 fNet/iNet/pNet 기반 동적 생성.
# 코멘트, 연속매매 건수, 수급 분석 텍스트 모두 동적. 수동 갱신 불필요.
# 점검 포인트: 프록시 차단으로 API 실패 시 폴백 텍스트가 stale한지 확인
grep -n "kr-home-kospi-comment\|fetchKrSupplyData\|프록시 차단" index.html | head -6

# H5. 한국 테마 퍼포먼스 (동적 — renderKrThemePerfBars + _liveData 가중평균)
# KR_THEME_MAP 기반 가중 평균 수익률 계산 → 퍼포먼스 바 + 테마 강도 판단 모두 동적.
# 개별 종목 시세: polling.finance.naver.com 배치 fetch (동적).
# 점검 포인트: CHAT_CONTEXTS['kr-themes'] 내 하드코딩 등락률 문자열만 수동 갱신 대상
grep -n "CHAT_CONTEXTS\['kr-themes'\]" index.html | head -3

# === I그룹: 24시간 뉴스/이벤트 WebSearch (v45.6 신설) ===
# API/RSS로 자동 수집되는 뉴스와 별개로,
# WebSearch로 지난 24시간 주요 시장 이동 이벤트를 직접 확인한다.
# 이 단계는 grep이 아니라 WebSearch 실행 (아래 "I그룹 상세" 참조)
echo "[I그룹] WebSearch 단계 — 아래 절차에 따라 실행"
```

### 2단계: 경과일 리포트 생성

스캔 결과를 아래 테이블로 정리 (오늘 날짜 기준 경과일 자동 계산):

```
| # | 카테고리 | 데이터 포인트 | 마지막 업데이트 | 경과일 | 상태 | 업데이트 주기 |
|---|----------|-------------|---------------|--------|------|-------------|
| A1 | DATA_SNAPSHOT | _updated | 2026-04-04 | 2일 | OK | 매일 |
| A2 | Fear & Greed | fg: 12 | 2026-04-04 | 2일 | OK | 매일 |
| A3 | VIX 차트 | labels20 ends 3/19 | 3/19 | 18일 | CRITICAL | 일간 |
| B1 | AAII 심리 | Bull 33.6% | 4/1 (pub 4/3) | 3일 | OK | 매주 목 |
| B2 | NAAIM | 68.36% | 4/1 (pub 4/3) | 3일 | OK | 매주 목 |
| ... | ... | ... | ... | ... | ... | ... |
```

상태 기준:
- `OK`: 업데이트 주기 내
- `STALE`: 주기 초과 (일간 3일+, 주간 8일+, 월간 35일+)
- `CRITICAL`: 주기 2배 초과

### 3단계: STALE/CRITICAL 항목 최신화

각 STALE/CRITICAL 항목별로:

1. **데이터 수집 — 법적 안전성 원칙**

   **원칙**: WebFetch = 직접 HTTP 요청 → 해당 사이트 ToS "자동화 접근 금지" 위반 가능.
   WebSearch = 검색엔진 결과 읽기 → 인간이 구글 검색하는 것과 동일 → **ToS 위반 없음**.

   **⚠️ 수집 전략 (사이트별 구분)**:

   | 카테고리 | 허용 방식 | 사유 | 검색어/URL |
   |----------|-----------|------|------------|
   | AAII | WebFetch ✅ 또는 WebSearch | 공개 연구 데이터, 연구 목적 허용 | `https://www.aaii.com/sentiment-survey` |
   | NAAIM | WebFetch ✅ 또는 WebSearch | 공개 지수, 접근 제한 없음 | `https://naaim.org/programs/naaim-exposure-index/` |
   | FRED (HY OAS) | WebFetch ✅ 또는 WebSearch | 연방 공공 데이터, 퍼블릭 도메인 | `https://fred.stlouisfed.org/series/BAMLH0A0HYM2` |
   | BLS (CPI/PCE) | WebFetch ✅ 또는 WebSearch | 정부 공공 데이터 | `https://www.bls.gov/cpi/` |
   | **VIX** | **WebSearch 전용** | investing.com ToS 자동화 금지 명시 | "VIX close [날짜] 2026" |
   | **WTI/원자재** | **WebSearch 전용** | investing.com ToS 동일 | "WTI crude oil price [날짜] 2026" |
   | **Put/Call** | **WebSearch 전용** | macromicro.me 403 + ToS 불명확 | "CBOE put call ratio [날짜] 2026" |
   | II Bull/Bear | WebSearch 전용 | 구독 필요, 직접 접근 차단 | "Investors Intelligence bull bear [날짜] 2026" |
   | Fear & Greed | WebSearch 전용 | CNN 직접 JSON은 미검증 | "CNN Fear Greed index [날짜]" |
   | Market Breadth | WebSearch 전용 | 실시간 breadth 데이터 유료 | "% stocks above 50 day moving average [날짜] 2026" |
   | **VKOSPI** | **WebSearch 전용** | investing.com ToS 자동화 금지 (참조: `/indices/kospi-volatility`) | "VKOSPI close [날짜] 2026" |

   **⛔ 절대 WebFetch 금지**: `investing.com`, `macromicro.me`, `marketwatch.com`, `wsj.com` — ToS 자동화 금지 명시.

   **WebSearch 사용법**: 날짜를 검색어에 명시 → 당일 데이터 확보.
   예: "VIX close April 9 2026" or "CBOE put call ratio April 9 2026"

   **둘 다 실패 시**: SKIPPED 처리 (미처리와 구분). _note에 기록.

2. **index.html 내 해당 값 업데이트**:

   **차트 시계열 업데이트 전략 선택**:
   - **Rolling** (1 out, 1 in): 고정 기간 창을 유지할 때 (드물게 사용)
   - **Extension** (끝에 추가): 날짜 레이블이 있는 차트 — 주로 이 방법 사용
     - 예: `labels20 = [...기존..., '3/20', '3/24', '4/2']` + `vixData = [...기존..., 25.5, 26.95, 23.87]`

   **⚠️ labels20 공유 배열 주의**:
   - `labels20` = VIX 차트 + HY OAS 차트 공유
   - labels20 연장 시 `vixData` 와 `hyData` **동시** 업데이트 필수
   - 업데이트 후 배열 길이 일치 검증: `vixData.length == labels20.length == hyData.length`

   **DATA_SNAPSHOT 업데이트 시**:
   - 해당 필드값 수정
   - `_updated` 타임스탬프 → 오늘 날짜
   - `_note` 필드 → 버전/날짜 갱신 (예: `'v43.0 — /data-refresh 4/6'`)

   **HOME_WEEKLY_NEWS** (F1): 상세 절차는 아래 F1 섹션 참조

3. **배열 길이 검증** (차트 시계열 수정 후):
   ```bash
   # labels20, vixData, hyData 길이 일치 확인
   python3 -c "
   import re
   with open('index.html', 'r', encoding='utf-8') as f:
       content = f.read()
   l20 = re.search(r'const labels20 = (\[.*?\]);', content)
   vd  = re.search(r'const vixData = (\[.*?\]);', content)
   hd  = re.search(r'const hyData = (\[.*?\]);', content)
   if l20 and vd and hd:
       print('labels20:', len(eval(l20.group(1))))
       print('vixData: ', len(eval(vd.group(1))))
       print('hyData:  ', len(eval(hd.group(1))))
   "
   ```

4. **버전 범프**: 데이터 갱신도 버전 올림 (6곳 동기화 R1)

### 4단계: 브레드쓰 바 HTML 하드코딩 갱신

시그널 페이지의 breadth-bar-row HTML에 직접 하드코딩된 값들도 갱신:
```bash
grep -n "breadth-bar-row" index.html | head -10
```
- `bb-bar` width, `bb-val` 텍스트, `bb-badge` 상태 텍스트 모두 최신 수치와 일치시킴
- 색상: 70%+ 초록, 50-70% 파랑, 35-50% 노랑, 35% 미만 빨강
- bpLabels 마지막 값 = 실제 HTML 하드코딩 값과 일치해야 함

### 5단계: 동적 데이터 파이프라인 확인

API에서 자동 교체되는 데이터의 동작 확인 (이것들은 수동 수정 불필요, 동작만 확인):
- VIX 차트: `_refreshSentimentChartData()` 정상 동작?
- HYG -> OAS 추정: HYG ETF 가격 기반 OAS 변환 정상?
- SPY/QQQ 실시간: `fetchLiveQuotes()` 정상?
- KR 수급: 프록시 통한 KRX 데이터 수집 정상?

### 6단계: 최종 리포트

```
## /data-refresh 완료 리포트

실행일: {날짜}
점검 항목: {N}개
- OK: {N}개
- STALE -> 갱신 완료: {N}개
- CRITICAL -> 갱신 완료: {N}개
- 동적 파이프라인 정상: {N}개
- 스킵 (주기 내): {N}개

### 갱신 상세
| 카테고리 | 이전값 | 신규값 | 출처 |
|----------|--------|--------|------|
| ... | ... | ... | ... |
```

## I그룹: 24시간 뉴스/이벤트 WebSearch (v45.6 신설)

> **핵심 원칙**: API/RSS 자동 수집 ≠ 시장 이동 이벤트 인지. API는 "무엇이 발표됐는지" 수집하고, WebSearch는 "시장이 왜 움직였는지" 파악한다. 둘 다 해야 완전하다.

### 실행 시점
- /data-refresh 실행 시 **매번** (1단계 grep 스캔 후, 3단계 갱신 전에 실행)
- A~H그룹 수치 갱신의 **맥락**을 파악하기 위한 사전 단계

### WebSearch 실행 (5개 영역)

```
# 1. 글로벌 시장 이동 이벤트 (지난 24시간)
WebSearch: "market moving news today [YYYY-MM-DD] 2026"
→ S&P/NASDAQ 급등락 원인, 섹터 로테이션 촉발 이벤트

# 2. 지정학/정책 (지난 24시간)
WebSearch: "geopolitical risk oil tariff [YYYY-MM-DD] 2026"
→ 전쟁/휴전/제재/관세 변동

# 3. 연준/중앙은행 (지난 24시간)
WebSearch: "Fed FOMC rate [YYYY-MM-DD] 2026" OR "ECB BOJ rate 2026"
→ 금리 결정/발언/시장 반응

# 4. AI/반도체 (지난 24시간)
WebSearch: "Nvidia TSMC AI semiconductor [YYYY-MM-DD] 2026"
→ 초대형 기술 이벤트

# 5. 한국 시장 (지난 24시간) ← 구조적 한계 보강
WebSearch: "KOSPI 외국인 기관 [YYYY-MM-DD] 2026"
WebSearch: "한국 증시 뉴스 [YYYY-MM-DD] 2026"
→ 수급 동향, 테마 변동, 정책 이슈
```

### 수집 결과 활용

1. **맥락 주입**: 수치 갱신 시 "왜 이렇게 변했는지" 이해한 상태로 작업 → 코멘트/텍스트 정합성 자동 확보
2. **HOME_WEEKLY_NEWS 후보**: score 90+급 이벤트 발견 시 F1 절차 자동 트리거
3. **CHAT_CONTEXTS 시나리오 갱신 판단**: macro Pro의 시나리오 확률이 현실과 괴리되면 갱신 (v45.6 패턴)
4. **한국 수급 코멘트 갱신**: H4 하드코딩 텍스트를 WebSearch 결과로 교체

### I그룹 리포트 형식

```
### I그룹: 24시간 이벤트 서치 결과
| 영역 | 주요 이벤트 | 시장 영향 | 데이터 갱신 필요? |
|------|-----------|---------|----------------|
| 글로벌 | (이벤트) | SPX +1.2% | A1 DATA_SNAPSHOT |
| 지정학 | (이벤트) | WTI -3% | G1 + macro 시나리오 |
| 한국 | 외국인 순매수 전환 | KOSPI +2% | H1 + H4 코멘트 |
```

---

## H4~H5: 한국 시장 동적 파이프라인 점검 + CHAT_CONTEXTS 보강 (v45.6 정정)

> **핵심**: 한국 시장 UI 렌더링은 대부분 **네이버 파이낸스 API 기반 동적 코딩**이다.
> 수급 코멘트, 테마 퍼포먼스 바, 종목 시세, 수급 분석 텍스트 모두 **동적 — 수동 갱신 불필요**.
> **수동 갱신 대상은 CHAT_CONTEXTS 하드코딩 문자열 + KR_THEME_CATALYSTS만.**

### H4. 한국 동적 파이프라인 정상 동작 확인

아래 7개 함수가 네이버 API 기반 동적 데이터 수집 + 렌더링을 담당:

| 함수 | 소스 | 역할 |
|------|------|------|
| `fetchKrSupplyData()` | m.stock.naver.com/api/index/{idx}/investorTrend | KOSPI/KOSDAQ 외국인·기관·개인 수급 |
| `updateKrSupplyDOM()` | fetchKrSupplyData 결과 | 수급 코멘트/분석 텍스트 동적 생성 (12+ 분기) |
| `fetchKrNaverQuotes()` | polling.finance.naver.com 배치 | KR_STOCK_DB 전 종목 실시간 시세 |
| `renderKrThemePerfBars(ld)` | _liveData 가중 평균 | 테마 퍼포먼스 바 + 강도 + 순위 동적 렌더 |
| `renderKrThemeCardsFromMap()` | KR_THEME_MAP + _liveData | 테마 카드 동적 생성 (정적 HTML 제거됨 v40.4) |
| `fetchKrDynamicData()` | 6개 하위 함수 일괄 호출 | VKOSPI/거래량/Top10/주간수급/공매도/브레드쓰 |
| `showKrThemeDetail()` | _liveData + KR_THEME_MAP | 개별 종목 시세/등락률/테마 강도 동적 |

**점검 포인트** (data-refresh 실행 시):
- 프록시 차단 여부: console에서 "프록시 차단" 경고 확인 → 차단 시 폴백 텍스트가 표시됨 (기능 정상, 데이터만 stale)
- fetchKrNaverQuotes 배치 크기: KR_STOCK_DB 종목 수 vs 실제 fetch 응답 수
- renderKrThemePerfBars: 22개 테마 전부 렌더되는지 (ld 키 5개 미만이면 return)

### H5. CHAT_CONTEXTS kr-themes 하드코딩 등락률만 수동 갱신

**UI는 동적이지만 LLM 프롬프트는 하드코딩**: kr-themes CHAT_CONTEXTS 내 "+9.1%", "-12.5%" 등 테마별 등락률 + KR_THEME_CATALYSTS 설명 문자열만 수동 갱신 대상.

**갱신 주기**: 주간 (UI 퍼포먼스 바는 실시간이므로 일간 필요 없음)
**갱신 대상**: `CHAT_CONTEXTS['kr-themes']` system 함수 내 등락률 + 해설 문자열

---

## 데이터 소스 참조

| 데이터 | 소스 | 발표 주기 | URL/키워드 |
|--------|------|-----------|-----------|
| AAII | AAII.com | 매주 수(목 발표) | aaii.com/sentimentsurvey |
| NAAIM | NAAIM.org | 매주 수(목 발표) | naaim.org/exposure-index |
| Put/Call | CBOE | 매일 | cboe.com/market-data |
| HY OAS | FRED/ICE BofA | 매일 | BAMLH0A0HYM2 |
| Fear & Greed | CNN | 매일 | money.cnn.com/data/fear-and-greed |
| CPI/PCE | BLS/BEA | 매월 | bls.gov / bea.gov |
| ISM PMI | ISM | 매월 1일 | ismworld.org |
| **KR 수급** | **네이버 API (동적)** | **실시간** | **m.stock.naver.com/api/index/{idx}/investorTrend — 수동 갱신 불필요** |
| **KR 종목 시세** | **네이버 API (동적)** | **실시간** | **polling.finance.naver.com/api/realtime/domestic/stock/ — 수동 갱신 불필요** |
| **KR 테마 퍼포먼스** | **네이버 API (동적)** | **실시간** | **renderKrThemePerfBars — _liveData 가중 평균 자동 계산** |
| KR 테마 CHAT_CONTEXTS | WebSearch | 주간 | "한국 증시 테마 방산 반도체 [날짜] 2026" (LLM 프롬프트만 수동) |
| **VKOSPI** | **WebSearch** | **매일** | **"VKOSPI close [날짜] 2026"** |
| **24h 이벤트** | **WebSearch** | **매일** | **"market moving news [날짜] 2026"** |
| FOMC | Fed | 6주 간격 | federalreserve.gov/monetarypolicy |
| Breadth % | Barchart | 매일 | barchart.com/market-breadth |
| Inv Intelligence | II | 매주 | yardeni.com (구독 없이 접근 가능한 대안) |
| VIX 일간 종가 | Yahoo Finance/FRED | 매일 | ^VIX historical |
| WTI/Brent | tradingeconomics.com | 매일 | crude oil price |

## J그룹: 실시간 데이터 폴백 체인 검증 (v46.3 신설)

> **핵심**: 하드코딩 데이터 갱신 외에, **실시간 데이터 수집 파이프라인 자체의 건강도**도 점검해야 한다.
> 프록시 차단·API 변경·심볼 매핑 오류로 폴백이 잘못 작동하면 페이지 전체가 공란이 된다.

### 폴백 체인 아키텍처 (v46.3 기준)

```
미국 시장 (420+ 심볼):
  fetchLiveQuotes() → Yahoo v8/chart (직접→프록시 5개)
    → [실패 시] Stooq CSV (stooq.com/q/l/ — 배치 30개, 무료, 키 불필요)
    → [VIX/금리/지수] Yahoo 단독 (Stooq 미지원 → DATA_SNAPSHOT 정적 폴백)

한국 시장 (148 심볼):
  fetchKrNaverQuotes() → polling.finance.naver.com (배치 20개)
    → [배치 실패] m.stock.naver.com/api/stock/{code}/basic (개별 10개)
    → [아직 누락] api.finance.naver.com/siseJson.naver (2일 OHLCV, 상위 20개)
    → [아직 누락] fchart.stock.naver.com/siseJson.nhn (다른 서버, 동일 데이터)
    → [전멸 시] Yahoo .KS/.KQ (15분 지연)

AI 채팅 개별 조회:
  dynamicTickerLookup() → _liveData 캐시 → Yahoo → Stooq / siseJson
```

### 폴백 체인 점검 항목

```bash
# J1. Stooq 폴백 코드 존재 확인
grep -n "live:stooq" index.html | head -3

# J2. siseJson 폴백 코드 존재 확인
grep -n "live:naver-sise\|live:naver-fchart" index.html | head -3

# J3. 선물 심볼 스킵 가드 (P71: ES=F/NQ=F/YM=F Stooq 미지원)
grep -n "includes('=F')" index.html | head -5

# J4. 지수 스킵 가드 (P70: ^GSPC/^DJI 가격 괴리)
grep -n "_stooqSkip\|_noStooq\|_noSt" index.html | head -5

# J5. dynamicTickerLookup Stooq 폴백 존재
grep -n "dynamicTickerLookup" index.html | head -3
grep -A5 "function dynamicTickerLookup" index.html | grep "stooq\|siseJson" | head -3
```

### Stooq 심볼 매핑 규칙

| Yahoo 심볼 | Stooq 심볼 | 비고 |
|-----------|-----------|------|
| AAPL, NVDA 등 | aapl.us, nvda.us | 일반 주식/ETF |
| CL=F (WTI) | cl.f | 원자재 명시 매핑 |
| BZ=F (Brent) | bz.f | 원자재 명시 매핑 |
| GC=F (Gold) | gc.f | 원자재 명시 매핑 |
| DX-Y.NYB (DXY) | dx.f | 달러 인덱스 |
| **^GSPC, ^DJI, ^IXIC** | **스킵** | ETF 가격 ≠ 지수값 (P70) |
| **ES=F, NQ=F, YM=F** | **스킵** | Stooq 미지원 (P71) |
| **^VIX, ^TNX** | **스킵** | Stooq 미지원 |
| **BTC-USD, ETH-USD** | **스킵** | Stooq 미지원 |

### 하드코딩 폴백값 갱신 대상 (data-refresh 시 함께 점검)

```bash
# _SECTOR_PCT_FALLBACK: 섹터 ETF daily 폴백 (전쟁/휴전 이벤트 후 즉시 갱신)
grep -n "_SECTOR_PCT_FALLBACK" index.html | head -3

# _sectorRRGSeed: RRG 4사분면 초기 배치 (섹터 로테이션 이벤트 후 갱신)
grep -n "_sectorRRGSeed" index.html | head -3

# KR_THEME_CATALYSTS: 한국 테마 촉매 텍스트 (주간 갱신)
grep -n "KR_THEME_CATALYSTS" index.html | head -3
```

---

## 주의사항 (Gotchas)

1. **labels20 공유**: VIX 차트와 HY OAS 차트가 같은 `labels20` 배열 공유. 연장 시 `vixData` + `hyData` 동시 업데이트 안 하면 배열 길이 불일치 → 차트 렌더링 오류.

2. **AAII/NAAIM 발표 주기**: 수요일 설문 → 목요일 발표. 수~목 사이에는 경과일이 높아도 정상(주기 내). 섣불리 STALE 판정 금지.

3. **II Bull/Bear 데이터 접근 제한**: investorsintelligence.com 구독 필요. 웹 검색으로 직접 데이터 못 얻으면 → (a) Yardeni Research 검색, (b) 최근 트렌드 선형 외삽 (iiBull -1.5/주, iiBear +1.5/주 정도).

4. **WTI/Brent 급등 감지**: 지정학 이벤트 시 DATA_SNAPSHOT 폴백값과 실제 시장가 큰 괴리 발생. HOME_WEEKLY_NEWS 날짜와 폴백값 비교로 감지 가능. 괴리 $5+ 시 즉시 갱신.

5. **G그룹 글로벌 지수**: nikkei/hangseng 등은 API 실패 시에만 표시. 2~3일 경과는 정상. 다만 주요 급락(10%+) 후에는 폴백값도 갱신 필요.

6. **DATA_SNAPSHOT._note 갱신**: _updated 변경 시 _note 필드도 같이 업데이트 (현재 버전 + 날짜 기재).

7. **차트 시계열 Extension vs Rolling**: 날짜 레이블이 있는 배열(labels20, bpLabels, pcLabels 등)은 **Extension** 사용. 롤링 방식(1 out, 1 in)은 배열이 고정 크기인 경우만 사용.

8. **버전 범프 필수**: 데이터 갱신도 index.html 수정이므로 6곳 버전 동기화 (R1) 필요. 데이터 전용 갱신이면 마이너 버전 올림 (예: v42.9 → v43.0).

9. **이벤트 후 하드코딩 텍스트 퇴행 (P61)**: DATA_SNAPSHOT 수치를 갱신해도 static HTML 서술 텍스트(코멘트·섹션 제목·시나리오 조건·미터바 width)는 별도 갱신 루틴이 없어 이전 이벤트 맥락 잔존. 예: WTI -15% 휴전 후에도 "이란전쟁發 유가급등" 서술. 수치 갱신 후 반드시 텍스트 서술 정합성 체크. grep 명령: `grep -n "이란\|전쟁\|급등\|휴전\|휴전합의" index.html | head -20`

10. **ADR/해외지수 시차**: 니케이/DAX 등은 아시아/유럽 장 마감 기준 전일 종가. 미국 시장 시간대에서 "경과 1일"은 정상. 동일 달력일 갱신 아니어도 OK.

11. **Stooq 지수 매핑 금지 (P70)**: ^GSPC→SPY 프록시 매핑 시 ETF 가격($680)이 지수(6800)에 주입되어 **10배 괴리**. 지수(^GSPC/^DJI/^IXIC)는 절대 Stooq 폴백 금지. Yahoo 단독 + DATA_SNAPSHOT 정적 폴백.

12. **Stooq 선물 심볼 (P71)**: ES=F/NQ=F/YM=F는 Stooq에서 N/D 반환. `sym.includes('=F')` 가드로 스킵. 원자재(CL=F/GC=F/BZ=F 등)만 명시 매핑(cl.f/gc.f/bz.f).

13. **Stooq pct 계산**: Stooq은 당일 OHLCV 1행만 반환 → 전일 종가 없음. `_liveData[sym].chartPreviousClose`가 있으면 그것 사용, 없으면 시가(Open) 대비로 차선 계산.

14. **siseJson 응답 파싱**: `api.finance.naver.com/siseJson.naver` 응답은 순수 JSON이 아닌 JSONP-like 텍스트. 정규식 `\["(\d{8})",\s*(\d+),...\]` 패턴으로 파싱. 장 시작 전(09:00 전)에는 당일 행이 없을 수 있음.

15. **전 데이터 경로 통일 원칙**: 데이터 보완 시 fetchLiveQuotes()만이 아니라, dynamicTickerLookup()(AI 채팅), _fetchOneSectorWeekly()(섹터 1주), _fetchTickerDataForChat() 등 **모든 데이터 소비 경로**에 동일한 폴백 적용해야 함. 한 곳만 보완하고 다른 곳을 누락하면 일관성 깨짐.

16. **테마 파이프라인 하드코딩**: _sectorRRGSeed(RRG 4사분면 시드), _SECTOR_PCT_FALLBACK(섹터 폴백 등락률), KR_THEME_CATALYSTS(한국 테마 촉매 텍스트) — 이 3가지는 시장 이벤트(전쟁/휴전/어닝 시즌) 후 반드시 갱신. 특히 RRG 시드는 섹터 로테이션 반영 필수.

---

## 에러 복구

### API/웹 검색 실패 시

| 실패 유형 | 대응 |
|-----------|------|
| WebSearch 결과 없음 (II Bull/Bear 등 구독 소스) | (1) Yardeni Research 재검색 (2) 최근 3주 추세 선형 외삽 (3) 리포트에 "추정(외삽)" 명시 |
| 웹 검색 결과 날짜 불명확 | 최신 공식 발표 기관 직접 검색 (BLS/BEA/ISM/FRED). 날짜 확인 안 되면 갱신 보류 + 리포트에 "확인 불가" |
| labels20 배열 길이 불일치 | 즉시 rollback → python3 검증 script 재실행 → `vixData.length == labels20.length == hyData.length` 확인 후 재시도 |
| 버전 범프 후 Hook validate-edit.sh 실패 | div 균형 재확인 (`grep -o '<div' index.html \| wc -l` == `grep -o '</div' index.html \| wc -l`) 후 재편집 |
| _SNAP_FALLBACK 누락 심볼 | 데이터 갱신 전 `_SNAP_FALLBACK` 심볼 수 ≥50 확인. 미달 시 누락 심볼 먼저 추가 후 재시도 |

### 부분 실패 허용 기준

- **전체 중단**: A그룹(핵심 스냅샷) 실패 시 즉시 중단 + 사용자 에스컬레이션
- **부분 진행**: B~H그룹 중 1~2개 소스 실패는 "SKIPPED" 기록 후 나머지 진행
- **리포트 명시**: 실패한 카테고리는 최종 리포트 표에 "SKIPPED (사유)" 표기 — 은닉 금지

### 재시도 규칙

- 동일 카테고리 웹 검색 재시도 **최대 2회** (검색어 변경)
- 2회 실패 → 외삽 또는 SKIPPED로 전환, 무한 재시도 금지
- 전체 프로세스는 1회 실행 — 실패 시 처음부터 재시작 금지 (성공 갱신분은 유지)

---

## 바이너리 Self-Eval (완료 전 체크)

모든 갱신 완료 후 아래에 **명시적으로 yes/no** 답변. no가 하나라도 있으면 해당 부분 수정 후 재검증.

| # | 평가 항목 | 기준 |
|---|-----------|------|
| **D1** | 전수 스캔 완수 | 22개 카테고리 전체(A~H 8그룹)에 대한 staleness 테이블이 출력되었는가? 22개 행 포함. |
| **D2** | CRITICAL 처리 | CRITICAL 판정 항목이 모두 업데이트 or 명시적 SKIPPED 처리되었는가? (은닉 금지) |
| **D3** | 배열 길이 일치 | labels20 / vixData / hyData 길이가 **동일**한가? (python3 검증 스크립트 통과) |
| **D4** | 버전 6곳 동기화 | title / badge / APP_VERSION / version.json / _context/CLAUDE.md / CHANGELOG.md 6곳 모두 동일 버전 문자열인가? (R1) |
| **D5** | 이벤트 텍스트 정합성 | WTI/VIX/지정학 이벤트 후 하드코딩 텍스트가 현재 상황과 일치하는가? (P61 — "전쟁發 급등" 잔존 0건) |
| **D6** | _note/_updated 동기화 | DATA_SNAPSHOT._updated 타임스탬프 + _note 필드(버전+날짜)가 오늘 날짜로 갱신되었는가? |
| **D7** | I그룹 24h 이벤트 서치 완료 | 5개 영역(글로벌/지정학/연준/AI/한국) WebSearch 실행 + 리포트 테이블 포함되었는가? |
| **D8** | 한국 동적 파이프라인 정상 (H4) | fetchKrSupplyData/fetchKrNaverQuotes/renderKrThemePerfBars 정상 동작 확인? (프록시 차단 시 폴백 상태 기록) |

### 판정 규칙
- **전부 yes** → PASS ✓, 사용자에게 리포트 제출
- **1~2개 no** → FAIL, 해당 항목 수정 후 재검증 (전체 재실행 아님)
- **3개 이상 no** → CRITICAL FAIL, 작업 중단 + 사용자 에스컬레이션

### 에스컬레이션 기준
- D1 no (카테고리 누락) → 누락된 카테고리만 추가 스캔 후 재실행
- D3 no (배열 불일치) → 즉시 rollback, 차트 렌더링 오류 위험 (P10~P11 재발)
- D4 no (버전 비동기) → 6곳 전수 grep 재실행 (R1 절대 규칙)

---

## F1. HOME_WEEKLY_NEWS 상세 절차

### 개요
`HOME_WEEKLY_NEWS`는 홈 화면에 고정 표시되는 **수동 큐레이션 뉴스 3건**이다.
API가 자동 수집하는 뉴스와 별개 — 직접 수정하지 않으면 갱신되지 않는다.

- 위치: `index.html` → `var HOME_WEEKLY_NEWS = [...]`
- 스캔 명령: `grep -A15 "^var HOME_WEEKLY_NEWS" index.html | grep "date:"`

### 언제 업데이트하는가

- `/data-refresh` 실행 시 **매번** 점검 대상 포함
- 3건 중 가장 오래된 항목이 **7일 초과**이면 교체 검토
- 날짜와 무관하게 **더 중요한 신규 이벤트** 발생 시 즉시 교체

### 선별 기준 (score 90+급 이벤트만)

다음 중 해당하면 HOME_WEEKLY_NEWS 후보:
- 지정학 이벤트: 전쟁/제재/봉쇄/최후통첩/호르무즈 등
- 중앙은행 결정: FOMC/BOJ/ECB 금리 변경 (동결은 낮은 우선순위)
- 거시 정책: 관세 발동/예산안 부결/부채한도 위기
- 시장 구조 충격: 서킷브레이커/VIX 40+ 급등/패닉 셀링
- AI/반도체 초대형 이벤트: Anthropic $30B급 ARR, NVDA 어닝 서프라이즈, TSMC CoWoS 용량 공시
- 단순 기업 실적/애널리스트 등급 변경은 제외

### 아이템 형식

```javascript
{
  title: '한국어 제목 — 2~4문장 핵심 요약. 수치 포함 권장.',
  source: '출처1/출처2',
  date: 'YYYY-MM-DD',    // 이벤트 발생일 (발표일 기준)
  sentiment: 'bear',      // 아래 기준 참조
  topic: 'geo'            // 아래 기준 참조
}
```

**sentiment 판별**:
| 값 | 기준 |
|----|------|
| `bear` | 주가 하락 압력 (전쟁/관세/금리 인상/실적 쇼크) |
| `bull` | 주가 상승 압력 (긴축 완화/AI 호황/실적 서프라이즈) |
| `warn` | 중립이나 주의 필요 (유동성 경고/변동성 급등) |
| `neutral` | 방향성 불명확 (FOMC 동결/혼합 지표) |

**topic 판별**:
| 값 | 기준 |
|----|------|
| `geo` | 지정학 (전쟁/제재/봉쇄/외교) |
| `macro` | 거시경제 (GDP/CPI/고용/소비) |
| `fed` | 연준/중앙은행 금리 결정 |
| `trade` | 무역/관세/공급망 |
| `tech` | AI/반도체/기술 초대형 이벤트 |
| `earn` | 실적 (score 90+급만) |
| `market` | 시장 구조적 이벤트 (서킷브레이커/급락) |

### 3건 유지 규칙

- **항상 3건** 유지 (더 많거나 적으면 안 됨)
- 신규 이벤트 추가 시 가장 오래된 항목(date 기준)을 교체
- 날짜가 같으면 `sentiment: 'bear'` 항목 우선 유지 (리스크 가시성 원칙)

### 웹 검색 전략

```
# 오늘의 시장 이동 이벤트
"[YYYY-MM-DD] market moving news reuters bloomberg"

# 지정학
"[오늘 날짜] geopolitical risk oil strait"

# 연준
"Fed FOMC [최근 월] 2026 rate decision"

# AI/반도체
"Nvidia TSMC Anthropic OpenAI [오늘 날짜] 2026"

# 관세/무역
"tariff trade war [오늘 날짜] 2026"
```

### 업데이트 절차 (단계별)

1. 현재 3건 날짜 확인:
   ```bash
   grep -A15 "^var HOME_WEEKLY_NEWS" index.html | grep "date:"
   ```
2. 가장 오래된 항목의 date 파악 → 오늘 기준 경과일 계산
3. WebSearch로 최근 7일 이내 score 90+급 이벤트 파악
4. **교체 필요한 경우**: 가장 오래된 항목 → 신규 이벤트로 교체 (Edit)
5. **교체 불필요한 경우**: 리포트에 "HOME_WEEKLY_NEWS: 3건 최신 상태 유지" 기재
6. 교체 후 버전 범프 포함 (다른 데이터 갱신과 함께)
