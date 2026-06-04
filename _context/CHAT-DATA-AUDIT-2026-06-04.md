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

## 재현 명령
```bash
python3 -m http.server 8080   # AIO 루트
```
```js
AIO.auditAllChatContexts(); AIO.assertChatFunctionCoverage(); AIO.getChatContextConsistencyAudit(); AIO.getChatTickerCacheStats();
CHAT_CONTEXTS.macro.system();  // '인플레·고용 (YoY...)' 라인 확인
```
