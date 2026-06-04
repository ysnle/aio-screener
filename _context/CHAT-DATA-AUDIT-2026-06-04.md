---
verified_by: agent
last_verified: 2026-06-04
confidence: high
target_version: v50.8
measured_env: headless preview (python3 http.server, no API keys, CORS-blocked external fetch)
---

# AI 채팅 데이터 출처 전수 감사 baseline — v50.8 (2026-06-04)

> 목적: 사용자 "AI 채팅이 정확·최신 데이터를 진짜 가져오는지, 현재 시장 반영하는지, 기존 기능 효율 활용하는지" 전수 조사. 3 Explore agent + 직접 코드 검증 + preview 실측. 이후 개선의 측정 기준선.

## 1. 답변 1건당 실제 데이터 흐름 (검증됨)

| 단계 | 함수 | 실제 fetch | 소스 |
|------|------|-----------|------|
| 시세 preflight | `chatSend`(aio-chat.js:4368) → `ensureFreshChatAnswerData({forceFresh})`(4476) → `dynamicTickerLookup(forceFresh:true)` | **O (강제)** | Yahoo 5프록시 3.5s race → Stooq → Naver → Finnhub 4단계 + `fetchFailed` 구조화 |
| 종목 펀더멘털 | `_fetchTickerDataForChat`(2072) — 11+ promise `Promise.allSettled`+`_withTimeout(2.5s)` | **O (캐시 miss 시)** | SEC 10-K/8-K/Risk/13F, Wikipedia, Finnhub news/insider/short, FMP ratios/profile/income/target, Naver, FCF/Balance/EV·EBITDA/MacroBeta/Moat/Segments/EarningsCall |
| 시장 환경 헤더 | `_liveSnap()`(index.html:14329) + `_closeSnap()` | **O** | `_liveData`(시세<5분) + `_fredData`(FRED) + `_bokData`/`_kosisD` |
| 캐시 | `_chatTickerCache`(5분 TTL/LRU 50), forceFresh 우회 | — | — |
| 답변 후 검증 | `assertChatResponseAccuracy`(±20%)+`getChatHallucinationAudit`(0~10)+`assertChatAnswerStructureAudit` | **O (자동)** | `_accBadge` 표시 |

## 2. 라이브 감사 실측 (headless preview)

```js
AIO.auditAllChatContexts()          // validCount 18 · dynamicCoveragePct 100% · invalid []
AIO.getChatContextConsistencyAudit() // issues [] (consistency OK)
AIO.assertChatFunctionCoverage()    // status warn · deadCodeCount 1 · deadCode ['computeCrossAssetCorrelation']
AIO.getChatTickerCacheStats()       // ttl 5min · max 50 · (headless 0 lookups)
```

- **18개 CHAT_CONTEXTS 전부 valid + 동적 커버리지 100%** — 정적·학습데이터 의존 컨텍스트 0.
- **dead code 1건**: `computeCrossAssetCorrelation`(v49.83 P444, 30일 rolling Pearson matrix) — 정의됐으나 채팅 미연결. (minor; 향후 macro/fxbond 채팅에 cross-asset 상관 주입하거나 exempt.)

## 3. Explore agent false-alarm 정정 (중요)

- **`_getV48IntegratedContext`는 dead code 아님** — index.html:15539 정의(aio-chat.js보다 먼저 로드되는 전역, chat 호출 시점 접근 가능).
- **web_search 배선됨** — `_shouldUseClaudeWebSearch`(aio-chat.js:3279)→`callClaude({webSearch})`(5185) Claude native + `_aiWebSearch`(4547) Perplexity/Google 이중.
- **cross-source/truth preflight** — `ensureFreshChatAnswerData`가 `validateQuoteCrossSources`+truth status 호출.

## 4. 진짜 발견 + v50.8 시정

- **G1 (시정 완료)**: macro 채팅의 실제 컨텍스트는 **index.html:17554 override**(aio-chat.js:62 macro는 死코드 — 덮어씌워짐). 이 override는 `_liveSnap().macro`(=`_fredData` 직접)로 Fed/실업률/주택/소매/임금은 live FRED를 쓰나, **US CPI/PCE/Core 인플레는 macroBlock에 누락**돼 v50.5 FRED 인플레 데이터가 채팅에 안 들어가던 갭. → `_liveSnap().macro`에 `cpiYoY/coreCpiYoY/pceYoY/corePceYoY/nfp` 추가(FRED live 우선 + DATA_SNAPSHOT 폴백, `[FRED]`/`[스냅샷]` 라벨) + macro CHAT_CONTEXT 프롬프트에 인플레·고용 라인 추가. preview 검증: 폴백 "CPI 3.8% [스냅샷]" / mock FRED 시 "CPI 2.9% [FRED] · NFP +147K [FRED]" 전환.
- **G1-보강 (A)**: `applyFredToUI`가 FRED YoY를 `DATA_SNAPSHOT.cpi/coreCpi/pce/corePce/nfp/fedRate/unemploy`에 write-back(`_fredLive` 메타) → 스냅샷 폴백·페이지 data-snap sink·기타 컨텍스트도 최신화.
- **G2 (잔존, 저위험)**: macro override에 **stale 하드코딩 시나리오** — "2026.04 Week 3 이란 협상결렬", "미-이란 2주 휴전 합의(4/7)", "4/9 시장 맥락", "Brent $103/Apollo 5.8%" 등. live 시세는 `s.wti`/`s.vix`로 치환되나 시나리오 서술·확률은 4월 고정. → /data-refresh 또는 시나리오 동적화 대상(향후).
- **G4 (acceptable-by-design)**: 펀더멘털 보조 11소스는 실패 시 `.catch(()=>null)`로 **조용히 누락**(데이터 블록에서 빠짐). price/quote 실패는 `fetchFailed`로 명시 표면화됨. ABSOLUTE RULES가 "주입된 데이터만 인용"을 강제하므로 누락 소스로 환각 위험은 낮음(AI가 없는 데이터를 못 씀). 단 사용자는 "SEC 시도했으나 실패" vs "미시도"를 구분 못함 — 향후 보조 소스 미수신 요약 라벨 검토.
- **G5 (저우선)**: DataTruthGate 답변 후 강제 — 프롬프트 truth_gate_rule 지시 + accuracy audit(±20%)로 부분 커버. truth-blocked 심볼 인용 사후 감지는 미구현(향후).

## 5. 결론

**채팅 데이터 출처는 이미 견고**(실시간 시세 강제 fetch · 11소스 펀더멘털 · live 시장 헤더 · 18컨텍스트 100% 동적 · 답변 후 자동 검증 · 환각 차단 ABSOLUTE RULES). 큰 결함 없음. v50.8에서 가장 실질적인 갭(macro 채팅이 v50.5 FRED 인플레를 못 받던 것)을 시정. 잔존은 macro 시나리오 stale(G2)·보조소스 silent 누락(G4, by-design)·dead code 1건으로 모두 minor.

## 6. 17~18 관점 기업 분석 데이터 출처·파이프라인 전수 (2026-06-04 심층)

레지스트리 3종(aio-core.js): `AIO_ANALYSIS_FRAMEWORK_REGISTRY`(6904, 17관점+2보조) · `AIO_FUNDAMENTAL_PAGE_CRITERIA`(6831, 정량15) · `AIO_FUNDAMENTAL_CRITERIA`(Piotroski). 채팅 "17 관점"=ANALYSIS_FRAMEWORK. `_fetchTickerDataForChat`(aio-chat.js:2072)가 11+ implFn을 `Promise.allSettled`로 병렬 호출.

**라이브 커버리지(`getAnalysisFrameworkCoverageAudit`)**: 17관점 전부 implFn 有(coveragePct 100%) · high-risk 7 · medium 6 · low 4 · partial(저신뢰 caveat) 10 · status warn.

### 관점별 실제 데이터 등급 (코드+라이브 실행 검증)

**🟢 실제 current-data fetch (정량, low/medium risk)**
- #8 세그먼트 매출 · #9 재무제표 · #10 밸류에이션: Yahoo + FMP `/ratios-ttm`·`/income`·`/segments` + Naver + computed(FcfYield/Balance/EvEbitda). daily~quarterly, 실 fetch.
- #14 파트너십: SEC **8-K Item 1.01/7.01** 실 fetch(`fetchSECRecentFilings`가 data.sec.gov CIK submissions 파싱). event-driven, dataConfidence high.
- #16 리스크: SEC 10-K Item 1A + Finnhub short interest 실 fetch.
- #1 사업구조 · #2 창립/성장 · #4 비즈모델 · #5/6 수익/제품: SEC 10-K(실 fetch) + Wikipedia(실) + Naver + FMP segments. **단 10-K는 annual** → "현재" = 최근 연차보고서(최대 ~11개월).
- #17 투자포인트: Finnhub consensus + Naver consensus 실 fetch.

**🔴 placeholder/정적테이블/가이드 (high-risk, 회사별 current 데이터 아님 — 모두 honest 라벨)**
- #10 기관흐름(13F) `fetchSEC13F`: **순수 placeholder** — `verdict:'manual-query-required'`, 실 holdings 데이터 없음, efts.sec.gov/WhaleWisdom URL만 반환. (무료 집계 13F API 부재 — 설계상 불가피.)
- #11 TAM `computeTAMEstimate`: live SEC SIC code 조회 → **정적 산업 TAM 테이블**(`AIO_INDUSTRY_TAM_REGISTRY` 하드코딩 22개 SIC) 매핑. 산업 레벨 정적값이지 회사별 current TAM 아님. dataConfidence low + "회사별 정확 TAM 추정 금지" note.
- #12 공급망 `fetchSECSupplyChain`: 10-K URL + 키워드 가이드만(`requiresManualFetch:true`, `extractedFacts:[]`) — 공급사/고객명 자동 추출 안 함. low-medium.
- #7 Moat `computeMoatScore`: 실제 재무비율(R&D/GM/OpMargin/FCF margin) **휴리스틱 채점**(AI 아님). 단 입력이 SCREENER_DB(정적 memo) + Naver 의존 → 데이터 없으면 score 0/low. Morningstar 유료 대체.
- #13 플랫폼 `fetchPlatformEcosystem`: SCREENER_DB.memo + FMP + Finnhub **합성 score**(외부 전용 API 없음). low.
- #3 CEO · #15 경쟁: Wikipedia + SEC 10-K(annual) — 인사변경/경쟁구도 변화 시 stale. high.

### 결론
- **정량 관점(밸류에이션·재무·세그먼트·8-K 파트너십·리스크)은 실제 최신 데이터를 fetch** — 정확·current.
- **정성 high-risk 7관점(13F·TAM·공급망·Moat·플랫폼·CEO·경쟁)은 placeholder/정적테이블/휴리스틱/가이드** — 회사별 current 데이터가 아니며, **레지스트리·함수가 모두 honest하게 dataConfidence low + R117 "학습데이터 추정 금지" 라벨**. AI 채팅은 ABSOLUTE RULES R116/R117로 이 한계를 답변에 고지하도록 강제됨.
- **환각 위험 낮음**: 가짜를 진짜로 위장하지 않고 "수동 확인 권장/저신뢰"로 정직 표기. **다만 13F는 데이터가 아예 없어(URL만)** 기관흐름 질문은 실질 답을 못 줌 — 무료 집계 API 부재로 구조적 한계.
- 개선 여지(향후, 선택): TAM 정적테이블 확장 / 공급망·플랫폼 NLP 추출(confidence 명시 유지) / 13F는 무료 소스 없어 URL 유지 불가피.

## 재현 명령
```bash
python3 -m http.server 8080   # AIO 루트
```
```js
AIO.auditAllChatContexts(); AIO.assertChatFunctionCoverage(); AIO.getChatContextConsistencyAudit(); AIO.getChatTickerCacheStats();
AIO.getAnalysisFrameworkCoverageAudit();   // 17관점 impl/high-risk/partial 분류
AIO.fetchSEC13F('AAPL'); AIO.computeMoatScore('AAPL'); AIO.computeTAMEstimate('AAPL');  // high-risk 실 반환 확인
CHAT_CONTEXTS.macro.system();  // '인플레·고용 (YoY...)' 라인 확인
```
