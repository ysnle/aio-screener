---
verified_by: agent
last_verified: 2026-06-20
confidence: high
target_version: v50.98

---

## R226. Server news backstop must rank by market impact, not arrival order (v50.98)

- Scheduled public-data news refresh is not complete when it only fetches recent RSS titles. Server-side news must carry `score`, `selectionReason`, topic, country, tier, and scoring metadata so LLM market analysis and runtime backstops consume market-impact-ranked items.
- Required score axes: recency, source tier/trust, macro/rates, geopolitics/energy, AI/semis, earnings/analyst actions, FX/bonds/commodities, mega-cap relevance, and unverified/promo penalties.
- `data.json.meta` must expose `serverNewsScored`, `newsSourceCount`, and score range fields. Client runtime must expose a selection audit covering score buckets, topics, sources, tiers, verification status, and surface eligibility.
- `scripts/ci-data-pipeline-contract-check.mjs` must fail if server scoring, selection reasons, or `AIO.getNewsSelectionAudit()` are removed.

## R225. News surfaces must provide Korean market rewrite, not translation-only headlines (v50.97)

- News ingestion is not complete when it only translates foreign headlines. Market-news must expose a grouped Korean rewrite brief that reads like an investor-facing market summary.
- The normalized news object must preserve `ko_rewrite`, `ko_section`, and `ko_market` so visible cards, summary brief, cache, and chat consumers can share the same interpretation layer.
- Claude/Anthropic enrichment should produce section/rewrite/market fields; no-key or API-failure paths must still synthesize conservative local rewrite text without inventing facts beyond headline/description/source/tickers.
- `scripts/ci-data-pipeline-contract-check.mjs` must assert the rewrite brief container and data fields.

## R224. Currentness and fallback data must be visible at the consumer surface (v50.96)

- Pages that show cached, static fallback, or optional-secret-dependent data must label that state at the visible consumer surface, not only in logs/audits.
- News freshness must expose stale age when server/cache data is older than the runtime threshold and hide the warning when fresh data arrives.
- Macro/FRED and KR supply fallback values must be marked as reference/fallback and point to the authoritative source or missing key/action when applicable.
- Ticker/theme/KR rows that imply a security must provide a direct path to ticker detail analysis when the ticker identity is known.
- R1 version sync must be completed after currentness UX or QA review changes because stale cachebusters can hide the fix.

## R223. News translation must degrade to Korean insight, not raw English-only context (v50.95)

- News ingestion is not complete when English headlines are merely fetched or title-translated. Every visible/chat news consumer must have a Korean `ko_summary` plus at least one Korean explanation/impact/action field.
- If `ANTHROPIC_API_KEY` or browser Claude key is unavailable, `_aioBuildNewsLocalKoreanInsight()` must synthesize conservative Korean summary/explanation/impact/action from topic, sentiment, impact vector, source, and ticker extraction without inventing facts beyond the headline/description.
- `market-news`, `home` top news, and `_buildNewsContext()` must consume `_aioGetNewsTranslation()` rather than raw title/desc only.
- `AIO.getNewsTranslationQualityAudit()` and `scripts/ci-data-pipeline-contract-check.mjs` are the regression gate for this rule.

## R222. Public-data pipelines require an Actions-to-consumer contract gate (v50.94)

- Market/news auto-refresh is complete only when the path is contract-tested end to end: GitHub Actions schedule -> fetch script -> committed `public-data/*.json` artifact -> runtime loader -> runtime audit -> visible/chat/memo consumer.
- `data-watchdog.yml` must fail on stale or too-thin core artifacts, not only malformed JSON. Minimum floors: `symbolsOk >= 70`, `newsCount >= 10`, Telegram digest `count >= 100` and at least 2 channels.
- Optional services that depend on secrets (FRED, LLM market analysis, FMP fundamentals) may degrade without failing the site, but their status must be visible in `AIO.getDataPipelineAudit().layers.sources.publicData`.
- `scripts/ci-data-pipeline-contract-check.mjs` is the static gate for this rule and must be run by CI.

## R221. Telegram/news auto-refresh must close the ticker memo consumer path (v50.93)

- Scheduled Telegram/news digest updates are not complete when only the digest registry, freshness fields, or audit metadata change.
- If the payload includes ticker-linked items (`topItems/items[].tickers`), the app must map them into `SCREENER_DB.memo` via a dynamic `[TG YYYY-MM-DD · auto]` overlay.
- The path must remain verifiable through `getTelegramPipelineAudit().memoOverlay`, T831, and `scripts/ci-runtime-contract-check.mjs`.
- Static fallback memo overlays may remain, but dynamic overlays must be prepended and replace prior dynamic overlays on reload/reapply.

## R165. AIO_TICKER_NAME_REGISTRY 의미적 정확성 + 한글 별명 일관성 의무 (v49.80 Codex)

- 새 ticker 등록 시 `{ en, kr, alt[] }` 3축 의무. en은 공식 영문명, kr은 한국 시장 표기, alt는 alias 배열.
- 기업명 변경 시 (예: MARA 마라톤디지털 → 마라홀딩스) 즉시 반영. 회사 IR / SEC 10-K cover page 기준.
- KR_STOCK_DB 종목 sym 매핑 정확성 확보. 잘못 매핑된 사례 (예: 178320=로보스타 → 실제 서진시스템) 자동 audit.

## R166. AIO_THEME_SEMANTIC_EXCLUSION_RULES 의미적 misfit 배제 의무 (v49.80 Codex)

- 테마 자동 ticker 매칭 시 의미적 misfit (holding company / 다른 sector ETF) 명시 배제.
- 형식: `AIO_THEME_SEMANTIC_EXCLUSION_RULES[themeId][ticker] = '배제 이유'`.
- 회귀 방지: `getThemeCompositionLogicAudit().semanticExclusionHits === 0`.

## R159. ticker / options context는 _currentTickerId null + _liveData 미수신 양쪽 가드 의무 (v49.79)

- ticker 없을 때: "어떤 종목 분석을 원하시나요?" + 예시 (NVDA / 삼성전자 / 005930.KS) 명시.
- ticker 있으나 _liveData 미수신: "✗ 시세 미수신 → 모든 $ 가격 인용 금지 (HARD STOP)" 강제.
- 정성 프레임워크 (Weinstein / RSI / 패턴)만 적용 가이드.

## R160. kr-macro 정적 데이터 / 시점 토큰 진입부 staleness 경고 의무 (v49.79)

- DATA_SNAPSHOT._updated 기준 N일 전 표시.
- "2026.03 이란 전쟁", "2026.04 JPM/GS 리포트" 등 시점 분석은 historical anchor 명시.
- 답변 시 "스냅샷 기준 N일 전 값 — BOK/KOSIS/KRX 최신 확인" 명시 의무.

## R161. localStorage QuotaExceededError 강화 처리 + 사용자 toast 의무 (v49.79)

- `_saveChatHistory` quota 초과 시 50건 → 10건 순차 prune.
- 각 단계 사용자 toast 알림 (6s / 10s / 15s).
- API 키 백업 권장 안내 (AIO.exportApiKeys()).

## R162. 외부 fetch 결과 schema 검증 + graceful degrade 의무 (v49.79)

- `_aioValidateFetchResult(result, requiredFields, sourceName)` 헬퍼 사용.
- requiredFields 전부 누락 시 schema 변경 가능 경고 + degrade 메시지.
- partial 누락은 warning만 (부분 수집 유지).

## R163. 멀티탭 localStorage storage 이벤트 리스너 의무 (v49.79)

- `window.addEventListener('storage', ...)` 등록.
- API 키 / 사용자 프로필 / 알람 변경 시 다른 탭 toast + audit widget 자동 갱신.
- 중복 등록 방지 (`_aioStorageListenerRegistered` flag).

## R164. Claude API 호출 토큰 사용량 누적 추적 + 비용 가시화 의무 (v49.79)

- `_aioTrackApiUsage({model, inputTokens, outputTokens})` 매 호출 후.
- daily / lifetime / 30일+ 자동 정리.
- `AIO.getApiUsage()` 콘솔 명령으로 즉시 조회.
- Anthropic 가격 (Sonnet $3/$15, Haiku $0.25/$1.25 per 1M tok) 적용.

## R156. 외부 fetch 폴백 chain은 sequential 금지, Promise.race 병렬 의무 (v49.78 코드 단위 진단)

- 폴백 체인 (Yahoo 5 proxy / SEC 다수 / Finnhub 등)을 sequential `for...await`로 처리 시 최악 80s+ hang.
- `Promise.any` 또는 polyfill 병렬 race + 각 fetch에 짧은 timeout (3.5s)로 첫 성공 즉시 반환.
- 회귀 방지: T611 — `dynamicTickerLookup.toString()`에 `Promise.any` 또는 `Promise.race` 포함.

## R157. innerHTML 호출 전 _aioSafeMD fallback chain 의무 (v49.78)

- `_aioSafeMD` undefined 시 → `escHtml` → manual HTML escape 3단계 fallback.
- XSS 우회 방지 + DOMPurify 부재 시 답변 깨짐 차단.
- 회귀 방지: T613.

## R158. chatSend atomic streaming lock — 입력 검증 통과 직후 즉시 (v49.78)

- 기존 `state.streaming = true` 60줄+ 거리 → 빠른 더블 클릭 race window 존재.
- `state._chatSendEntered` counter 증가/감소로 atomic 보장.
- onDone / onError / chatClear 모두에서 reset.
- 회귀 방지: T615.

## R153. chatSend silent return 모든 경로 사용자 피드백 의무 (v49.77)

- `if (!ctx) return;` / `if (state.streaming) return;` / `if (!inp) return;` / `if (!q) return;` 모두 사용자 피드백 의무.
- toast 알림 (3~6초) 또는 input border 강조 (빈 입력 시).
- console.warn 로깅 추가 — 개발자 디버깅 가능.

## R154. callClaude 최종 실패 시 friendly 안내 + 자가 진단 가이드 (v49.77)

- 에러 분류 (401/429/500/network/other) 별 친화 안내.
- 권장 조치 ul 리스트 + 외부 링크 + 콘솔 명령 가이드.
- 액션 버튼: "🔁 같은 질문 재시도" + "🔄 데이터 새로고침" 인라인 삽입.

## R155. 데이터 ✗ / 환각 검출 시 답변 위 액션 버튼 배너 의무 (v49.77)

- 시세 ✗ 또는 재무 ✗ 시 답변 위에 amber 경고 배너 + 새로고침/재질문 버튼.
- 환각 self-confess 검출 시 빨간 경고 박스 + 동일 액션 버튼.
- 사용자가 답변 신뢰 못 할 때 즉시 액션 가능한 UX.

## R151. 시세 데이터 ✗ 시 답변에 가격 수치 절대 금지 — HARD STOP (v49.76)

- `_liveStatusCS` 미수신 시 system prompt에 🚨 HARD STOP 7 조항 강제 주입:
  1. 모든 $ 가격 수치 절대 금지
  2. 학습 연도 / 자기 환각 자백 표현 금지
  3. 가격 범위 추측 금지
  4. 시점 인용 금지 (데이터 블록 부재 시)
  5. 올바른 답변 시작 형식 명시
  6. 위반 시 R145 환각 경고 자동 표시
- v49.74 R145 + ABSOLUTE RULES 17조 위에 강제 HARD STOP 추가.

## R152. 모바일 채팅 레이아웃 100vw 비율 의무 (v49.76)

- `.aio-chat / .acp-messages / .acp-bubble / .acp-chips` 모바일에서 max-width: 100vw + box-sizing: border-box.
- `.acp-bubble` max-width: calc(100vw - 80px). chip wrap + 폰트 11px 통일.
- 사용자 좌절 발견 — "답변 화면 비율이랑 레이아웃도 안 맞아" 시정.

## R147. CHAT_CONTEXTS 등록은 DOM 패널과 항상 쌍 (Pattern A 일반화) (v49.75)

- 사용자 정직 발견 (P398) — home CHAT_CONTEXTS 등록 후 DOM panel 누락 → chatSend silent return.
- 모든 CHAT_CONTEXTS[ctxId] 정의 후 `<div class="aio-chat" id="chat-{ctxId}">` + msgs/inp/btn 4요소 의무.
- 회귀 방지: `AIO.assertChatPanelDomAudit().contextOnlyCount === 0`.

## R148. ABSOLUTE RULES는 system prompt 정의 + 답변 후처리 양쪽 의무 (Pattern B 일반화) (v49.75)

- R140 정성→정량 / R141 표준 4 구조 / R142 출처 괄호 — 시스템 프롬프트 정의만으로는 부족, 답변 후처리 검증 의무.
- `AIO.assertChatAnswerStructureAudit(responseText)` — 4 rule 위반 자동 검출 + chatSend 응답에 시각 배지.
- 회귀 방지: 답변 후처리 violations 검출 → 답변 위 amber 배지 표시.

## R149. 외부 fetch 실패는 사용자 ❌ 라벨로 surfacing 의무 (Pattern C 일반화) (v49.75)

- `_fetchTickerDataForChat` 17 promise × 실패 시 silent return 금지.
- `dynamicTickerLookup` 4단계 폴백 후도 실패 시 `'• ' + ticker + ': ❌ 시세 조회 실패'` 라벨 명시 (v49.67 패턴).
- 회귀 방지: `AIO.assertFetchFailureSurfacingAudit().hasUserVisibleFailLabel === true`.

## R150. AI 답변에 등장한 날짜 토큰은 세션 시각 대비 stale 자동 검출 (Pattern D 일반화) (v49.75)

- `getChatHallucinationAudit` regex 확장: `stale-md-date` (5/22 등 M/D + 오늘과 7일+ 이격) + `stale-iso-date` (YYYY-MM-DD).
- 답변에 stale 날짜 2건+ 시 환각 점수 +2 (P402).
- 회귀 방지: T593.

## R145. AI 답변에 학습 데이터 자기 인용 + 시점 환각 절대 금지 (v49.74 hotfix)

- 다음 표현 답변 등장 시 환각 신뢰도 F + 빨간 경고 박스 강제 표시:
  - "학습 데이터 기준", "내가 학습한", "학습 시점", "기억 속", "내가 알기로" — AI 자기 환각 자백
  - "2024년", "2025년 초", "202[0-5]년 (초/말/중반)" — 학습 시점 추정 연도
  - "약 $X~$Y대에서 베이스 형성" — 데이터 없이 가격 범위 추측
- 시세 데이터 ✗ 시 답변 전체에서 모든 가격 수치 절대 금지. "현재 시세 미수신, 정성 분석만" 명시.
- `getChatHallucinationAudit().requiresWarningBox === true` 시 답변 위에 강제 빨간 경고 박스.
- ABSOLUTE RULES 17조 (`_getChatRules`).

## R146. home 페이지 인라인 채팅 패널 의무 (v49.74 hotfix)

- 사용자 첫 진입점 `#page-home` 끝에 `<div class="aio-chat" id="chat-home">` + msgs/chips/inp/btn DOM 의무 (theme-detail 패턴 미러).
- CHAT_CONTEXTS['home'] 등록만으로는 부족 — 실제 DOM 트리거 필수.

## R143. AI 답변 품질 audit는 11 페이지 평가 의무 (KR 4 페이지 포함) (v49.74)

- `AIO.assertChatAnswerQualityAudit()`는 home/technical/macro/sentiment/breadth/fundamental/portfolio + kr-macro/kr-supply/kr-themes/kr-tech 총 11 페이지 평가.
- KR 페이지 누락 시 사용자 체감 갭 (한국 시장 답변 품질 저평가) 발생.
- 회귀 방지: T581 — `assertChatAnswerQualityAudit().perPageDetail.length === 11`.

## R144. AI 채팅 멀티턴 윈도잉 + 요약 prepend 의무 (v49.74)

- `state.messages` 배열은 char-limit (60K) + turn-cap (24) 양쪽 한도 적용.
- 트리밍 시 8개 이상 제거되면 사용자 주요 질문 5개 추출 → 요약 메시지 자동 prepend (역할 user) + 어시스턴트 확인 메시지 (역할 assistant).
- `window._chatMultiTurnStats` { trimEvents, summaryInsertions, maxTurnsBeforeTrim } 추적.
- 환각 누적 차단 + 이전 컨텍스트 핵심 보존.
- 회귀 방지: T582 (stats 초기화) + T583 (윈도잉 로직) + T585 (요약 트리거).

## R140. AI 답변에서 정성 표현 사용 시 정량 근거 1개 이상 괄호 동반 의무 (v49.73)

- 정성 표현 (높은/낮은/강한/약한/안정/불안/과열/공포/탐욕 등) 사용 시 반드시 정량 수치를 괄호로 동반.
- 올바른 예: "높은 변동성 (VIX 28.5, 90일 평균 18 대비 +58%)" / "탐욕 구간 (F&G 76, 직전 1주 +12pt)".
- 정성만 단독 사용 = 환각 신호. 데이터 부재 시 "데이터 미수신 — 정성 평가 불가" 답변.
- ABSOLUTE RULES 14조 (`_getChatRules` index.html L15298 직전).
- 회귀 방지: `assertChatAnswerQualityAudit().intuitiveness.rule14_qualityToQuant === true`.

## R141. AI 답변 표준 4 구조 강제 (결론/정량/시나리오/액션) (v49.73)

- 모든 분석성 답변은 다음 4 블록 구조 (단순 정보 질의는 예외):
  - ①【결론】 한 줄 요약 + 신뢰도 (low/medium/high)
  - ②【정량 근거】 3~5개 bullet, 각 (출처+기준일) 괄호 동반
  - ③【시나리오】 Bull/Base/Bear 3 분기 + 확률 합계 100%
  - ④【액션 가이드】 3단계 (관망 / 진입 / 이탈) — 각 트리거 + 포지션 사이즈
- 구조 위반 시 환각 위험 신호.
- ABSOLUTE RULES 15조.

## R142. 모든 정량 인용 시 (출처 · 기준일) 괄호 필수 (v49.73)

- 주가/지표/배수/비율/통계 모든 정량 인용 시 (출처 · 기준일) 괄호 동반.
- 올바른 예: "SPX 4,892.50 (Yahoo /quote, 2026-05-26 11:30)" / "NVDA P/E 22.4 (Finnhub, fetched 5분 전)".
- 시스템 프롬프트의 데이터 블록 라벨 `[source X · fetched Y]` 그대로 인용.
- 폴백값 인용 시 "(폴백)" 명시 (R128 12조 정합).
- ABSOLUTE RULES 16조. `_aioFetchLabel(name, source, ts)` 헬퍼 의무 사용.

## R138. fundamental 종목 검색 시 7 차트 자동 렌더 의무 (v49.72)

- fundamental 페이지에서 종목 검색 (`fundamentalSearch`) 시 DART Financials 스타일 7 섹션 차트 자동 렌더 의무: Growth / Profitability / Balance Sheet / Cash Flow / Liquidity / Working Capital / Valuation Multiples.
- 데이터 소스: `AIO.fetchFMP5YQuarterly(ticker)` (US) 또는 `AIO.fetchKRQuarterly(ticker)` (.KS/.KQ Naver fallback). 통합 진입점 `AIO.fetchQuarterlyFinancials(ticker)`.
- 캐시 5분 TTL + LRU 50 종목 cap (`window._fmpQuarterlyCache` + `_fmpQuarterlyCacheStats`).
- 7 canvas (`#fund-growth-chart` 등) 모두 `_aioChartRegistry`에 등록하여 페이지 이탈 시 메모리 leak 0.
- 데이터 부재 시 `reference-only` 폴백 마킹 + "5년 분기 데이터 부재" placeholder.
- 회귀 방지: `AIO.assertFinancialChartsAudit().coveragePct >= 80` + T561~T570.

## R139. AI 채팅 답변에 종목 detect 시 "📊 차트 보기" 버튼 자동 삽입 의무 (v49.72)

- `chatSend` 응답 렌더 시 `detectedTickers` 비어있지 않으면 각 ticker별 `📊 [종목] 재무 차트 보기 ↗` 시안색 버튼 자동 추가.
- 핸들러 `_aioShowFundamentalChart(ticker)`: fundamental 페이지 이동 + 자동 검색 + 7 차트 렌더 + 부드러운 스크롤.
- 인라인 mini-chart 미구현 정책 (P386): 토큰 비효율 + 모바일 레이아웃 + DOMPurify 복잡 → 페이지 이동 버튼이 표준.
- 회귀 방지: chatSend source에 `_aioShowFundamentalChart` + `aio-financial-chart-btn` 모두 포함 (T567).

## R135. 4/5차는 감사 함수만으로 완료 금지

- 사용자가 "세밀하게 전수 조사", "4차/5차"를 요구하면 자동 감사 함수 추가만으로 완료 처리하지 않는다.
- 최소 1회는 실제 `index.html`의 모든 `.page[id]`를 직접 원장화해 텍스트량, 버튼/입력, `data-action`, `data-on-*`, 외부 링크 rel, input 라벨, 표 접근성, live/snap 데이터 싱크, 출처/운영 마커, 표/차트/설명, 날짜형 토큰, 초기 로딩 문구를 페이지별로 확인한다.
- 원장 결과에서 나온 실제 사용자 문구/기능 결함을 먼저 고친 뒤, `AIO.getFourthFifthPassAudit()` 같은 재발 방지 감사로 게이트에 연결한다.
- 직접 점검 결과와 수치(예: 페이지 수, action 수, input binding 수)는 BUG-POSTMORTEM/CHANGELOG에 남긴다.
---

# AIO Screener — 마스터 룰 (RULES.md)
# 모든 작업 전 이 파일을 먼저 읽고 시작할 것

> **목적**: 반복되는 실수를 방지하고, 점검·QA·수정 작업의 품질을 보장하기 위한 최상위 규칙
> **최종 수정**: v48.97 (2026-05-09) — R34/R35 번호 충돌 수정 (CDN SRI→R52, 병렬fetch→R53) + KL5 FAIL 해소

---

## 📋 작업 전 필수 체크

### 1. 이 폴더 구조 확인 (v48.79+ 모듈화 후)
```
_context/                              ← 지식 베이스 (유일한 진실의 원천)
├── RULES.md                           ← 지금 이 파일 (마스터 룰, 가장 먼저 읽기)
├── BUG-POSTMORTEM.md                  ← 버그 사후 분석 누적 로그 (매 수정 후 기록)
├── QA-CHECKLIST.md                    ← 실행 가능한 QA 체크리스트 v3.3
├── KNOWLEDGE-BASE.md                  ← 기술 인사이트 축적 (R26)
├── CODE-MAP.md                        ← index.html + js 모듈 line 범위 맵 (부분 읽기 가이드)
├── WORKTREE-AUDIT.md                  ← GitHub/live/worktree 라우팅 + 미배포 작업 인벤토리
├── INDEX.md                           ← 지식 베이스 자동 인덱스 (R24)
└── CLAUDE.md                          ← _context/ 컨텍스트 + 파일 구조

루트/
├── CLAUDE.md                          ← 프로젝트 가이드
├── CHANGELOG.md                       ← 버전별 변경 이력
├── index.html + version.json          ← HTML shell + 버전 메타
└── js/                                ← aio-core/data/ui/chat/glossary 모듈
```

### 2. 작업 유형별 반드시 읽을 파일

| 작업 유형 | 읽을 파일 |
|-----------|-----------|
| **index.html 수정** | **CODE-MAP.md → 해당 line 범위만 Read** |
| 버그 수정 | RULES.md → BUG-POSTMORTEM.md → CODE-MAP.md → QA-CHECKLIST.md |
| 새 기능 추가 | RULES.md → CODE-MAP.md → WORKTREE-AUDIT.md(배포/워크트리 영향 시) |
| QA/점검 요청 | RULES.md → BUG-POSTMORTEM.md → QA-CHECKLIST.md |
| 리팩토링/개편 | RULES.md → BUG-POSTMORTEM.md → CODE-MAP.md |
| 버전 릴리스 | RULES.md(R1~R2) → CHANGELOG.md → WORKTREE-AUDIT.md(배포 상태 기록) |
| 지식 린팅 | RULES.md(R19~R20) → `/knowledge-lint` |

---

## 🔴 절대 규칙 (위반 시 무조건 재작업)

### R1. 버전 동기화 (7곳 필수)
버전 변경 시 반드시 **7곳 모두** 동일한 버전 문자열인지 확인:
1. `<title>` 태그 — `AIO Screener v{버전} — 올인원 투자 터미널`
2. `#app-version-badge` — HTML 내 인라인 텍스트
3. `version.json` → `version` 필드
4. `_context/CLAUDE.md` → `현재 버전:` 행
5. `CHANGELOG.md` → 최상단 항목의 버전 번호
6. **`const APP_VERSION`** — JS 상수 (`js/aio-core.js`). 이 값이 title과 badge를 JS에서 덮어씀. 놓치면 HTML은 v38.4인데 화면에 v38.3 표시
7. **`SW_VERSION`** — Service Worker 캐시 네임스페이스 (`sw.js`). 놓치면 새 배포 후에도 구버전 shell/data cache가 남을 수 있음.

> ⚠️ **v48.80 사고**: SW_VERSION이 v48.66에 머물러 stale cache 회전이 지연될 수 있었음. APP_VERSION과 SW_VERSION은 함께 동기화할 것.

확인 명령:
```bash
grep '<title>' index.html | head -1
grep 'app-version-badge' index.html | grep -o '>v[^<]*<'
grep 'APP_VERSION' js/aio-core.js | head -1
grep 'SW_VERSION' sw.js | head -1
cat version.json | grep version
grep '현재 버전' _context/CLAUDE.md
head -20 CHANGELOG.md | grep '## v'
```

### R1-A. GitHub 배포 후 브라우저 버전 확인 (필수)
코드를 GitHub에 업로드한 뒤, **반드시 라이브 사이트에서 브라우저 캐시 무시 새로고침** 후 확인:
1. 브라우저 탭 제목(`<title>`)에 올바른 버전이 표시되는가
2. 페이지 상단 `#app-version-badge`에 올바른 버전이 표시되는가
3. `version.json` 직접 접속(`/version.json`)으로 올바른 버전이 반환되는가

> **파일 버전 ≠ 브라우저 버전** 불일치의 흔한 원인:
> - GitHub Pages 캐시 (배포 후 1~5분 지연)
> - 브라우저 캐시 (Ctrl+Shift+R 또는 DevTools > Network > Disable cache)
> - 업로드 누락 (index.html만 올리고 version.json 미업로드, 또는 그 반대)
> - JS에서 `updateQuotaBadge()` 등이 badge 텍스트를 런타임에 덮어쓰는 경우

### R2. 버전 체계
- 현재 체계는 `v{major}.{patch}` 숫자 단조 증가: v48.77 → v48.78 → v48.79
- patch는 한 자리/두 자리 모두 허용한다. 숫자 비교로만 최신 여부를 판단하고, 문자열 사전순 비교는 금지한다.

### R3. 버그 수정 시 사후 분석 필수
모든 버그 수정 후 `BUG-POSTMORTEM.md`에 아래 형식으로 추가:
```
## [날짜] v{버전} — {버그 제목}
- **증상**: 사용자가 본 문제
- **근본 원인**: 왜 발생했나
- **놓친 이유**: 왜 기존 점검에서 못 잡았나
- **수정 내용**: 무엇을 바꿨나
- **예방 규칙**: 다음에 같은 유형 방지하려면
- **QA 체크리스트 추가 항목**: (있으면)
```

### R4. 동적 DOM 삽입 주의
JS에서 `element.after()`, `element.insertBefore()`, `element.appendChild()` 등으로
동적 DOM 삽입 시, **삽입 대상의 부모가 flex/grid 컨테이너인지 반드시 확인**.
→ grid/flex 내부에 예상치 못한 자식이 들어가면 레이아웃이 깨진다.

### R5. CSS overflow 3중 방어
스크롤 가능한 컨테이너(채팅, 뉴스, 리스트)는 반드시:
1. `overflow-y: auto` (세로 스크롤)
2. `overflow-x: hidden` (가로 넘침 방지)
3. `padding-bottom: 16px+` (하단 여백으로 콘텐츠 잘림 방지)

### R6. LLM 응답 렌더링 안전장치
- 테이블 5컬럼 초과 → 자동 리스트 변환
- 모든 셀에 `word-break: break-word; max-width: 200px`
- 시스템 프롬프트에 테이블 금지 + 대체 포맷 명시

### R7. 한국어 텍스트 레이아웃 검증 (v31.9 추가)
- 고정폭 CSS grid 컬럼은 **한국어 최대 텍스트 폭** 기준으로 설계 (한글 1자 ≈ 14px, 라틴 1자 ≈ 8px)
- 모든 고정폭 셀에 `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` 필수
- flex 자식에 `min-width: 0` 없으면 `text-overflow: ellipsis` 작동 안 함
- 반응형 브레이크포인트(768px, 480px)에서 grid 컬럼 축소 규칙 별도 정의 필수

### R8. 차트 카드 텍스트 폴백 필수 (v31.9 추가)
- 차트(Chart.js)에 의존하는 미니 카드는 반드시 **텍스트 폴백** 포함
- CDN 지연/실패 시 차트가 렌더되지 않아도 핵심 수치가 텍스트로 표시되어야 함
- Chart.js 로드 실패 시 2초 후 재시도 메커니즘 권장

### R10. 종목코드 입력 시 3중 검증 필수 (v35.6 추가)
신규 종목 추가 시 반드시 아래 3단계 모두 통과해야 DB에 코드 입력 가능:
1. **Yahoo Finance quote 페이지에서 공식 회사명 확인** — DB 등록명과 일치해야 함 (269620="Syswork" ≠ "레인보우로보틱스" 사례)
2. **가격/시총 범위 합리성 확인** — 해당 기업 규모와 가격대가 맞는지 (코스맥스 ODM 1위인데 9,520원 소형주 → 자회사 오매핑)
3. **비상장 여부 확인** — 네이버증권/KRX에서 "비상장"/"장외" 표기 시 코드 할당 금지 (두나무=비상장 사례)

### R11. 비상장 기업 코드 할당 금지 (v35.6 추가)
Yahoo Finance가 가격을 반환해도 해당 기업이 실제 상장사인지 확인해야 함. 비상장 기업의 이름을 상장 코드에 매핑하면 **전혀 다른 회사의 데이터**가 해당 이름으로 표시됨 (P18 Ghost Stock).

### R12. 유사 이름 모자회사 구분 (v35.6 추가)
검색 시 동일/유사 이름이 복수 나오면(예: 코스맥스/코스맥스BTI), 각각의 정식 종목명·코드·시총·사업내용을 대조하여 본사/자회사 구분 후 올바른 코드 선택 (P19 Parent-Sub Confusion).

### R13. CHAT_CONTEXTS 이원화 필수 (v37.5 추가)
새로운 CHAT_CONTEXT를 추가하거나 기존 컨텍스트를 수정할 때:
1. `const c = _closeSnap();` — 반드시 `_liveSnap()`과 함께 선언
2. 주가·지수 분석 → `c.spx`, `c.nasdaq`, `c.dow` (종가 기준)
3. 시장환경(VIX/DXY/TNX/WTI/Gold) → `s.vix`, `s.dxy` 등 (실시간)
4. `[실시간]` 태그를 시장환경 데이터에 부착
5. `⚠ 주가·지수 분석 시 위 종가 기준. VIX·DXY 등 시장환경은 실시간 값 사용.` 지시문 포함
6. 지정학 영향 받는 컨텍스트(briefing/sentiment/portfolio 등)에 지정학 블록 포함

> ⚠️ v37.2에서 이원화 원칙을 선언했으나 12개 기본 컨텍스트에 미적용 → v37.5에서 전면 적용. **새 컨텍스트 추가 시 반드시 이 패턴 따를 것.**

### R14. 뉴스 키워드 현행화 (v37.6 추가)
분기 1회 이상, 시장 핵심 키워드(TECH_KW/MED_KW/MACRO_KW/TOPIC_KEYWORDS)를 점검:
- 새로운 기술 트렌드(CPO, 유리기판, Agentic AI 등) 반영 여부
- 새로운 지정학 이벤트(골든돔, 관세 정책 등) 반영 여부
- 한국어 키워드 동기화 여부
- TOPIC_KEYWORDS 분류 정확도 검증

### R9. Dead Page 방지 — 페이지 3종 세트 + init 가드 리셋 필수 (v31.10 추가, v42.1 강화)
- 새 페이지(`page-xxx`) 추가 시 반드시 **3종 세트** 구현:
  1. **init 함수** (`initXxxPage()`) — 데이터 로드 + DOM 업데이트
  2. **`aio:pageShown` 리스너** — 페이지 진입 시 init 호출
  3. **`aio:liveQuotes` 리스너** — 실시간 데이터 갱신 시 활성 페이지면 업데이트
- HTML만 있고 JS init이 없으면 하드코딩 데이터가 영구적으로 표시되는 Dead Page가 됨
- 정적 페이지(guide)는 예외이나, 동적 데이터가 하나라도 있으면 반드시 적용
- **[3회 위반 강화]** init 가드(`if (xxxInitialized) return;`) 사용 시 `destroyPageCharts()`에 반드시 `xxxInitialized = false` 리셋 추가. 누락 시 페이지 재진입 불가 (P28)
- **[3회 위반 강화]** `setInterval` 추가 시 반드시 `destroyPageCharts()`에 대응 `clearInterval` 추가 (P27). 타이머 미해제 = 좀비 프로세스
- **[v48.69 4차 강화]** 전역 연속 타이머(모듈 최상위 레벨)도 반드시 ID를 전역 변수에 저장할 것:
  ```javascript
  // 금지
  setInterval(fn, 15*60*1000);
  // 올바른 패턴
  if (window._myTimer) clearInterval(window._myTimer);
  window._myTimer = setInterval(fn, 15*60*1000);
  ```
- 검증: `grep -n 'setInterval(' js/*.js | grep -v 'clearInterval\|_.*=\s*setInterval\|window\._.*=\s*setInterval'` → 0건 기대

### R15. 데이터 미수신 vs 진짜 0% 구분 필수 (v38.3 추가, P25, v42.1 강화)
- `d.pct || 0` 패턴은 **데이터 없음**과 **진짜 0% 변동**을 구분할 수 없으므로 금지
- 반드시 `d && d.price != null && d.pct != null` 명시적 null 체크 후, 미수신 시 "—" 표시
- **[3회 위반 강화]** 코드 수정 후 `grep '|| 0' index.html | grep -i 'pct\|change\|percent'` 실행하여 잔존 패턴 스캔 필수
- **[3회 위반 강화]** `|| 숫자` 폴백은 0이 유효값인 모든 필드(pct, change, breadth %)에서 사용 금지. `!= null ? val : fallback` 패턴 사용
- 새 UI 섹션(카드, 그리드, 테이블) 추가 시 반드시 점검:
  1. 클릭/인터랙션 핸들러 구현 여부
  2. `aio:liveQuotes` 자동 갱신 연결 여부
  3. 상세 패널(detail panel)이 열려있을 때 자동 갱신 포함 여부

### R16. 뉴스 티커 표시 규칙 (v39.0 추가, P30)
- 매크로/지정학/정책/금리/무역 토픽(`macro`,`geopolitics`,`policy`,`fed`,`rates`,`trade`) 뉴스에는 **티커 숨김**
- 기업/실적/섹터/일반 토픽 뉴스에만 관련 종목 티커 표시
- `isCompanyNews()`를 티커 표시 판단에 쓰지 말 것 (토픽 분류가 부정확할 수 있음 — general로 분류된 매크로 뉴스에 ETF 티커 붙는 문제)
- 홈 핵심뉴스, 시장 뉴스(renderFeed), 데일리 브리핑(renderBriefingFeed) 3곳 모두 동일 기준 적용

### R17. 뉴스 키워드 추가 시 길이 제한 (v39.0 추가, P28, v42.1 강화, v42.5 재정의)
- **영어 키워드**: 3글자 미만 단독 키워드 추가 금지 (오탐 원인 — `'S'` 한 글자로 모든 텍스트 매칭 사고 발생)
- **한국어 키워드**: 2글자 도메인 특화 용어(`'금리'`, `'물가'`, `'고용'` 등)는 허용 — 한국어 금융 도메인에서 오탐 위험보다 누락 위험이 큼. 단, **1글자 한국어 단독 키워드는 금지** (예: `'팹'`)
- 티커 매칭은 `extractTickers()`에서 word boundary(`\b`)로 처리해야 함
- 키워드 추가 후 반드시 비금융 텍스트("약물 운전 STOP" 등)로 오탐 테스트
- **[4회 위반 강화]** 약어(QE, AI, EV 등)는 full form이 이미 존재하면 추가 금지. 약어가 반드시 필요한 경우 복합 패턴으로 구체화
- **[v42.5 교훈]** 키워드 제거는 누락 위험이 큼 — 선별 로직 강화가 우선, 키워드 제거는 최후 수단

### R18. 텔레그램 채널 관리 (v39.0 추가, P29)
- 채널 추가 시 `t.me/s/{slug}`로 공개 미리보기 확인 필수
- 메시지 DOM(`.tgme_widget_message_wrap`)이 없으면 `_TG_UNAVAILABLE`에 등록
- rsshub에서 403 차단된 채널은 `_TG_DIRECT_ONLY`에 등록 (CF Worker 직접 스크래핑)

### R19. _context/ 지식 정합성 린팅 (v40.4 추가)
- 대규모 수정 또는 분기 1회 `/knowledge-lint` 실행하여 _context/ 문서 간 정합성 점검
- 점검 7항목: (L1) 포스트모템 P→규칙 R 매핑, (L2) 규칙 R→QA 체크리스트 매핑, (L3) 코드 참조 실재성, (L4) 버전/날짜 최신성, (L5) 중복/모순 규칙, (L6) INDEX.md 정합성 자동 갱신, (L7) violated_rule 위반 빈도 분석
- 린팅 결과에서 오류 항목은 즉시 수정, 경고 항목은 다음 작업 시 검토

### R20. 에이전트 산출물 검증 상태 관리 (v40.4 추가)
- _context/ 핵심 문서(RULES.md, BUG-POSTMORTEM.md, QA-CHECKLIST.md)에 프론트매터로 검증 상태 표기:
  - `verified_by`: agent(에이전트 자동 생성) | human(사용자 검증 완료)
  - `last_verified`: 마지막 검증 날짜
  - `confidence`: high(코드 기반 검증) | medium(추론 기반) | low(미검증)
- 에이전트가 규칙/체크리스트를 추가할 때 기본값은 `verified_by: agent, confidence: medium`
- 사용자가 확인하면 `verified_by: human, confidence: high`로 승격
- 린팅 시 `confidence: low` 항목 우선 검토

### R21. 하드코딩 차트 데이터 경과일 관리 (v40.4 추가, P31)
- 차트 데이터(VIX/NAAIM/AAII/브레드쓰 등)는 `DATA_SNAPSHOT._updated`와 함께 관리
- 3일+ 경과 시 `renderStaleWarning()` 경고 배지 자동 표시
- 동적 전환 가능한 데이터(VIX/HYG/SPY/QQQ)는 Yahoo Finance API로 자동 교체, 하드코딩은 폴백으로만

### R22. 뉴스 3곳 계층적 선별 체계 (v40.4 추가, P32)
- **홈 핵심**: 정적 큐레이션 (`HOME_WEEKLY_NEWS`), 시장 전체 핵심 2~3건
- **브리핑**: score 45+, 5~20건, 20건 초과 시 score 우선 선별 → 시간순 재정렬
- **시장 뉴스**: score 30+, 150건 상한, 48h, 시간순 (광범위)
- scoreItem()에 5대 토픽 부스트(매크로/지정학/주식/외환/채권) + 비시장 정치 감점(-25) 필수

### R23. 외국 기업(ADR) 재무 파싱 (v40.4 추가, P33)
- SEC XBRL 파싱 시 `10-K` + `20-F`(외국발행인) + `20-F/A` 모두 포함
- `us-gaap` 없으면 `ifrs-full` 폴백

### R24. _context/ 인덱스 자동 관리 (v41.6 추가)
- `_context/INDEX.md`는 지식 베이스 전체 문서의 역할, 상태, 연결 관계를 기록하는 자동 인덱스
- `/knowledge-lint` 실행 시 L6 단계에서 자동 갱신 (신규 파일 추가, 삭제된 파일 제거, 갱신일/신뢰도 동기화)
- 현재 버전 대비 10+ 버전 차이 문서는 "정리 대상 후보"로 자동 식별

### R25. 버그 역참조 체계 (v41.6 추가)
- BUG-POSTMORTEM.md 각 버그 항목에 `violated_rule: R{N}` 태그 필수 기록
- 신규 규칙 위반이면 `violated_rule: 신규 ({카테고리})` 형식
- `/knowledge-lint` L7 단계에서 규칙별 위반 빈도 자동 집계 -- 3회 이상 위반 시 "규칙 강화 필요" 플래그
- 태그 누락 항목도 린팅에서 경고 보고

### R26. 기술 인사이트 환류 (v41.6 추가)
- 대화/작업 중 발견한 기술적 인사이트(API 동작, 브라우저 quirks, 라이브러리 패턴)는 `_context/KNOWLEDGE-BASE.md`에 축적
- BUG-POSTMORTEM이 "무엇이 고장났나"를 기록한다면, KNOWLEDGE-BASE는 "어떻게 동작하는가"를 기록
- 동일 인사이트 3회 이상 재발견 시 RULES.md 규칙 승격 검토
- 카테고리: API, 브라우저, Chart.js, DOM/CSS, JS 패턴, 데이터

### R27. Commands ↔ Skills 동기화 (v46.2 추가, P69 교훈)
- 새 스킬(`skills/xxx/SKILL.md`) 추가 시 **반드시** `commands/xxx.md` wrapper도 동시 생성
- wrapper 없으면 `/xxx` 자동완성에 안 나옴 → 사용자가 스킬 존재 자체를 모름 (silent omission)
- CHAT_CONTEXTS에 새 페이지 컨텍스트 추가 시 **반드시** `_aiCtxMap` + `_aiDefaultChips`에도 동시 매핑
- 매핑 없으면 통합 AI 패널에서 해당 페이지 진입 시 컨텍스트 자동 전환 안 됨 → silent failure
- 검증: `ls .claude/commands/*.md | wc -l` == skills 폴더 수 + 인라인 commands 수

### R28. 실제 클릭 테스트 필수 (v46.5 추가, P82 교훈)
- 코드 수정 후 `typeof xxx === 'function'` 검증만으로 완료 선언 **금지**
- **반드시 실제 브라우저에서 버튼 클릭 + 입력 필드 입력 + 결과 확인**
- Set/Array 변환, 함수 내부 TypeError, placeholder≠value 같은 버그는 코드 레벨 검증으로 발견 불가
- 검증 우선순위: B1(브라우저 실측) > B3(포스트모템) > B4(호출부) > B6(규칙)
- 포트폴리오 추가, 기업 분석 검색, 뉴스 필터 등 사용자 인터랙션이 있는 기능은 반드시 실제 클릭 테스트
- `grep -n "\.indexOf\|\.push\|\.splice" index.html | grep "Set\|KNOWN_TICKERS"` — Set에 Array 메서드 사용 탐지

### R29. AI 채팅 데이터 검증 태그 (v46.5 추가)
- AI 응답의 할루시네이션 방지를 위해 systemPrompt 끝에 **데이터 검증 상태** 블록 주입
- ✗ 표시된 데이터 소스(재무/뉴스/웹검색/정적데이터)에 대해 AI가 추측하지 못하도록 강제
- chatSend() + chatSendUnified() **양쪽** 모두 적용해야 함 (한쪽만 적용하면 AI 패널에서 할루시네이션)
- messages 배열 60,000자 초과 시 오래된 메시지 자동 trim (토큰 폭발 방지)
- API 실패 시 모델 폴백: sonnet-thinking → sonnet → haiku (자동 재시도 2회)

### R30. 지표 라벨/임계값 전역 통일 (v46.8 추가, P83~P104 교훈)
- **VIX 5단계**: <15 안정, 15~20 주의, 20~25 경계, 25~30 공포, 30+ 극단공포
- **F&G (CNN 표준)**: <=25 극단공포, <=45 공포, <=55 중립, <=75 탐욕, >75 극단탐욕 (반드시 `<=` 연산자)
- **VKOSPI 4단계**: <15 안정, 15~25 경계, 25~35 공포, 35+ 극단공포
- 새 함수에서 VIX/F&G/VKOSPI 라벨을 사용할 때 반드시 위 기준 참조. 독자 기준 사용 금지
- 검증: `grep -n "vix.*안정\|vix.*주의\|vix.*경계\|fgScore.*<\|fgVal.*<\|vkospi.*안정" index.html`로 전수 확인

### R31. innerHTML XSS 전수 점검 (v46.8 추가, P100 교훈)
- 사용자 입력 가능 필드(ticker, memo, note, name)는 innerHTML 삽입 전 **반드시** `escHtml()` 적용
- 파일 임포트(importPortfolio 등) 후 스키마 검증 필수 (티커 정규식, 문자열 길이 제한)
- onclick 인라인 핸들러에 사용자 데이터 삽입 시 escHtml 또는 data-* 속성 패턴 사용
- 검증: `grep -n "innerHTML\|onclick.*'" index.html | grep "\${p\.\|'+t\.\|'+p\." | grep -v "escHtml"`

### R33. 데이터 Freshness 추적 의무화 — DATE_ENGINE + _markFetch + _aioFeedHealth (v48.39 추가, P133 교훈)
- **원칙**: 모든 fetch 함수는 성공 시 `window._markFetch('apiName')` 호출 의무. 모든 날짜/시간은 `DATE_ENGINE` 경유. 모든 피드(RSS/API)는 `_aioFeedHealth.reportOk/reportFail` 통합.
- **이유**:
  - 사용자가 현재 보는 데이터가 실시간인지 폴백인지 즉시 판단 가능
  - 애널리스트 리포트(`[Citi 04/17]`)는 시간 경과 시 UI가 stale 경고 자동 표시 → 투자 판단 오류 방지
  - 죽은 RSS 피드 자동 비활성화로 불필요한 트래픽/지연 제거
  - localStorage 캐시 용량 자동 관리 (QuotaExceededError 대응)
- **새 fetch 함수 작성 규칙**:
  ```javascript
  async function fetchXxx() {
    try {
      const data = await fetchWithTimeout(url, {}, 8000);
      applyData(data);
      window._markFetch('xxx');         // 필수
      if (DATA_SNAPSHOT) DATA_SNAPSHOT._isFallback = false;
      return data;
    } catch(e) {
      // 폴백 체인
    }
  }
  ```
- **새 피드(RSS/API) 추가 규칙**:
  - 고유 id 부여 (예: `'rss:' + source.name`)
  - `_aioFeedHealth.isDisabled(id)` 체크 후 스킵 판단
  - 성공 시 `.reportOk(id)` · 실패 시 `.reportFail(id)` 호출
- **새 localStorage 캐시 규칙**:
  - `localStorage.setItem` 직접 사용 금지
  - 반드시 `window.AIO_Cache.set(key, value, ttlMs)` 경유
  - 읽기: `AIO_Cache.get(key)` (만료 자동 판정 후 null 반환)
- **새 날짜 포맷 규칙**:
  - 하드코딩 `"2026-04-19"` 등 절대 날짜 문자열 금지 → `DATE_ENGINE.isoNow()` 또는 동적 계산
  - UI 상대 시간: `DATE_ENGINE.formatRelative(ts)` ("3분 전")
  - UI 절대 시간: `DATE_ENGINE.formatAbsolute(ts)` ("2026-04-19 13:45")
  - Stale 판정: `DATE_ENGINE.isStale(ts, category)` — 카테고리는 STALE_THRESHOLDS 참조
  - UI 배지: `DATE_ENGINE.staleBadge(ts, category)` — HTML 반환
- **SCREENER_DB memo 규칙** (v48.37):
  - 애널리스트 리포트 표기: `[Citi 04/17]`, `[JPM 04/15 Buy]` 등 — `_aioMemoStaleInfo` 파서 호환
  - 복합 날짜 표기: `[2026-04-15]` 또는 `[2026.04]`
  - 가급적 `_asOf: '2026-04-17'` 필드 사용 (파서보다 정확)
- **검증**:
  ```bash
  # 하드코딩 날짜 문자열 감지 (주석 제외)
  grep -n "'\"[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}'\"" js/*.js | grep -v '^.*//'
  # _markFetch 누락된 fetch 함수 감지
  grep -l 'async function fetch' js/*.js | xargs grep -L '_markFetch'
  ```
  가이드 페이지 → 디버그 섹션 → 신선도 패널 → 모든 API에 🟢 배지 확인

---

### R52. 외부 CDN 스크립트 SRI 의무 (v48.69 추가, P140 교훈, 구 R34 → R52 재번호)
- 모든 외부 CDN `<script src="...">` 태그에 반드시 `integrity="sha384-..."` + `crossorigin="anonymous"` 속성 필수
- 이유: CDN 서버 해킹·MITM 시 악성 JS 주입 가능 (supply chain attack). SRI 없으면 브라우저가 변조 여부를 검증하지 않음
- 해시 생성: `curl -sL <URL> | openssl dgst -sha384 -binary | openssl base64 -A` 로 취득 후 `sha384-<hash>` 형식 사용
- 폴백 스크립트(document.createElement)는 SRI 적용 불가 — 검증된 CDN URL로 교체 고려
- 검증: `grep -c 'integrity=' index.html` — CDN script 수와 일치 여부 확인

### R53. 독립 병렬 fetch는 단일 실패 격리 (v48.69 추가, P143 교훈, 구 R35 → R53 재번호)
- `Promise.all([f1, f2, f3])` 내 각 promise는 반드시 `.catch(()=>null)` 또는 `.catch(()=>FALLBACK)` 추가
- 이유: 하나의 API 실패가 나머지 모든 결과를 폐기시킴 → 부분 실패 시에도 가능한 데이터 표시 필요
- **권장 패턴**: 각 fetch에 개별 `.catch` 추가 방식 (현재 FMP 구현 방식 — 이미 올바름)
- **대안**: `Promise.allSettled([f1, f2, f3]).then(results => results.map(r => r.status==='fulfilled' ? r.value : null))`
- 검증: `grep -n 'Promise\.all\(' js/*.js | grep -v '\.catch\|allSettled'` — 각 fetch에 .catch 없는 경우 점검

### R32. Event Delegation 의무화 — onclick 인라인 핸들러 금지 (v48.35 추가, P132 교훈)
- **원칙**: HTML 및 JS 템플릿 리터럴 안에 `onclick=` / `onsubmit=` / `onchange=` / `onkeyup=` 등 인라인 이벤트 속성 **전면 금지**.
- **이유**:
  - `Content-Security-Policy: script-src 'self'` 헤더 도입 시 인라인 핸들러 전부 차단 → UI 마비 위험
  - ESM (`<script type="module">`) 전환 시 전역 함수 접근 불가
  - HTML 속성 문자열 이스케이프 지옥 (3중 백슬래시 패턴)
  - linter/IDE가 HTML 속성 안의 JS를 인식 못해 리팩토링 시 레퍼런스 추적 누락
- **신규 요소 작성 규칙**:
  - 정적 함수 호출: `<button data-action="fnName" data-arg="value">` (인자 3개까지 arg/arg2/arg3 지원)
  - 엘리먼트 참조 필요: `data-pass-el="1"` (함수의 마지막 인자로 element 전달)
  - 이벤트 참조 필요: `data-pass-event="1"` (마지막 인자로 MouseEvent 전달)
  - 백드롭 클릭 닫기: `data-close-on-outside="closeFnName"` (event.target === el 자동 체크)
  - 외부 링크 새탭: `data-open-url="https://..."` (`window.open` 대체, rel=noopener,noreferrer 자동)
  - stopPropagation: `data-stop="1"`
  - preventDefault: `data-prevent="1"`
- **2-statement 패턴**: `onclick="a();b()"` 같은 복합 동작은 **단일 헬퍼 함수**로 이식 (`_aio*` 네임스페이스).
  - 예: `onclick="prevPage='portfolio';showTicker(sym)"` → `_aioPortfolioTicker(sym)` 헬퍼 + `data-action="_aioPortfolioTicker" data-arg="sym"`
- **A11y**: `role="button"` 또는 `tabindex="0"` 요소는 자동으로 Enter/Space 키보드 활성화 지원 (디스패처 내장).
- **JS render 템플릿**: 템플릿 리터럴 안에도 `data-action` 패턴 적용 (escHtml로 arg wrapping).
- **검증**:
  ```bash
  grep -c 'onclick=\|onsubmit=\|onchange=' index.html js/*.js  # 0 반환 기대
  ```
  브라우저 DOM: `document.querySelectorAll('[onclick]').length === 0`
- **기존 코드 위반 발견 시**: 즉시 data-action 패턴으로 이식 (Perl 스크립트 `_context/scripts/migrate_onclick*.pl` 재활용 가능).

---

## 🟡 점검 시 주의사항 (과거 실수에서 배운 것)

### CSS/레이아웃 패턴
1. **grid 내부에 동적 요소 삽입** → 레이아웃 파괴 (v31.2 시그널 배너 사건)
2. **overflow:hidden on parent** → 자식 콘텐츠 잘림 (v31.1 채팅 가로 텍스트)
3. **max-height 컨테이너** → 하단 여백 없으면 콘텐츠가 입력창에 가려짐
4. **white-space:nowrap 전파** → 부모의 nowrap이 자식까지 영향

### JS/데이터 패턴
5. **_ldSafe 미사용** → null/undefined에서 .toFixed() 등 호출 시 크래시
5b. **getElementById → stale DOM 참조** → HTML에 없는 ID를 JS에서 참조하면 항상 null → 기능 무동작 (P43). DOM ID 참조 추가 시 `grep 'id="해당ID"' index.html` 필수
6. **async 에러 미처리** → try-catch 누락 시 무한 로딩 상태
7. **타이머 중복** → setInterval 중복 등록 시 메모리 누수 + 성능 저하
8. **popstate 핸들러 누락** → 뒤로가기 시 차트/데이터 미갱신

### LLM/AI 패턴
9. **시스템 프롬프트 규칙 무시** → Claude가 테이블 생성 → 렌더링 깨짐
10. **스트리밍 중 DOM 조작** → innerHTML 반복 교체 시 깜빡임/메모리 누수

### 레이아웃/텍스트 패턴 (v31.9 추가)
11. **고정폭 grid 컬럼 + 한국어 텍스트** → 라틴 기준 설계된 셀에서 한국어 텍스트 오버플로우 (P7)
12. **CDN 지연 시 차트 미렌더링** → 텍스트 폴백 없으면 빈 카드 표시 (P8)
13. **반응형 미대응** → 768px/480px에서 grid 컬럼 축소 없으면 텍스트 겹침/잘림
14. **Dead Page** → HTML만 있고 init 함수/이벤트 리스너 없음 → 하드코딩 데이터 영구 표시 (P9)

### 기술 분석 엔진 패턴 (v32 추가)
15. **analyzeTickerDeep/analyzeKrTickerDeep DOM target** → 결과를 렌더할 target element ID가 실제 HTML div ID와 일치해야 함 (US: `#ticker-analysis-result`, KR: `#kr-ticker-analysis-result`)
16. **CF Worker 프록시 의존** → Yahoo Finance 차트 데이터는 CF Worker(aio-yahoo-proxy)를 통해 fetch. rate limit(기본 100 req/min) 초과 시 429 에러. 동시 분석 요청 수 제한 필요.
17. **지수 분석 자동 트리거** → `initKoreaTechnical()`은 pageShown 시 KOSPI/KOSDAQ 동시 fetch → 2개 동시 API 호출. 이미 분석 결과가 있으면 재호출 방지 (innerHTML 체크).

### 종목 데이터 무결성 패턴 (v35.6 추가)
18. **Phantom Ticker (P17)** → 종목코드 미검증 입력 시 Yahoo Finance가 **다른 회사의 정상 가격**을 반환 → 에러 없이 잘못된 데이터 유입 (269620 사례)
19. **Ghost Stock (P18)** → 비상장 기업 이름을 상장 코드에 매핑 → 전혀 다른 회사의 데이터가 해당 이름으로 표시 (294870 두나무 사례)
20. **Parent-Sub Confusion (P19)** → 유사 이름 모자회사 혼동 → 자회사 코드에 본사 이름 매핑 (044820 코스맥스BTI 사례)

---

## 📌 QA 요청 시 워크플로우

```
1. RULES.md 읽기
2. BUG-POSTMORTEM.md 읽기 (기존 패턴 파악)
3. QA-CHECKLIST.md 기반으로 점검 수행
4. 발견된 문제 수정
5. 수정한 문제마다 BUG-POSTMORTEM.md에 사후 분석 추가
6. 필요 시 QA-CHECKLIST.md에 새 항목 추가
7. 버전 동기화 확인 (R1)
```

---

## 세션 2026-04-04 신규 규칙 (P31~P38)

### P31. 데이터-UI 단일 진실 원천 (Single Source of Truth)
데이터(JS)와 UI(HTML)가 2곳에서 관리되면 반드시 한쪽을 제거. JS에서 동적 생성하여 불일치 근본 방지.

### P32. 종목 추가 시 상장 여부 확인 필수
KOSPI(.KS) / KOSDAQ(.KQ) 상장 확인. 비상장·장외 주식 추가 금지. 두나무(업비트) 같은 비상장 실수 반복 방지.

### P33. 테마 간 동일 종목 중복 배치 금지
자회사는 모회사 테마에서 커버. 예: 보스턴다이내믹스(현대차 자회사) → auto에서 커버, robot에 현대차 별도 배치 금지.

### P34. 테마 종목 비중 체계적 설정
(1) 시총 비례 (2) 독과점 구조 반영 (3) 대장주 비중 상향 (4) ETF 구성 크로스체크. 임의 감 배분 금지.

### P35. 데모/모의 데이터 라벨링 또는 제거
정적 모의 데이터는 `[DEMO]` 라벨 필수. 실제 데이터 연결 완료 시 즉시 제거. 사용자 오인 방지.

### P36. UI 텍스트 핵심/상세 분리
접힌 상태에서 핵심 한 줄 완전히 읽혀야 함. 상세 설명은 토글/AI 채팅으로 분리.

### P37. 인라인 font-size 11px 미만 사용 금지
CSS override가 자동 보정(7-8→11px)하지만, 신규 코드에서 극소 글자 사용 자체를 금지.

### P38. 전역 기능은 글로벌 컴포넌트로
AI 채팅, 알림 등 전역적 기능은 페이지별 복제가 아닌 글로벌 컴포넌트(사이드바 등)로 구현.

### P56. init 함수 내 cleanup 루프 중복 금지
차트/DOM 생성 후 즉시 destroy하는 "생성 → destroy" 패턴은 코드 리뷰에서 반드시 검출. 하나의 init 함수에 cleanup 루프가 두 개 이상 존재하면 두 번째 루프가 방금 만든 객체를 날릴 위험.

### P57. 고정 repeat(N,1fr) 그리드 모바일 검증 필수
`repeat(N,1fr)` (N≥5)은 모바일 375px에서 N×최소셀너비 > 컨테이너 width 여부 확인 필수. 6열 이상 그리드는 `repeat(auto-fit,minmax(Xpx,1fr))`으로 교체 검토.

### P58. applyDataSnapshot map과 HTML data-snap 속성 동기화 필수
`applyDataSnapshot()` map에 키를 추가/제거할 때 반드시 HTML `data-snap="key"` 속성 존재 여부를 grep으로 확인. 키가 있는데 HTML 없으면 dead code, HTML에 있는데 map에 없으면 hardcoded 고정값 버그.

### P59. _lastFG 초기값은 DATA_SNAPSHOT.fg에서 가져올 것
`fetchFearGreed()` 비동기 응답 전에 `_lastFG`가 필요한 컨텍스트(AI 채팅 스냅, 트레이딩 스코어 등)에서 기본값 18로 폴백되는 문제. `applyDataSnapshot()` 직후 `window._lastFG = DATA_SNAPSHOT.fg || 18`로 초기화할 것.

### P60. signal 페이지 브레드쓰 바는 liveQuotes + pageShown 양쪽에서 갱신
`updateBreadthBars()`가 breadth 페이지 init에서만 호출되면 signal 페이지 브레드쓰 섹션은 breadth 페이지를 방문하기 전까지 하드코딩 고정값. signal 페이지의 `aio:liveQuotes` 리스너에서도 `updateBreadthBars()` 호출 필수.

---

## 🟡 재발 방지 규칙 (v48.54 신설 — 레이어/파이프라인/함수 단위)

### R34. CSS 색상 토큰 우선 — rgba 하드코딩 금지 (v48.54 추가)
**원칙**: 투명 화이트 오버레이 `rgba(255,255,255,0.0X)` 패턴은 CSS 변수(`--surface-1~5`)로만 사용.

**금지 패턴**:
```html
<!-- BAD -->
<div style="background:rgba(255,255,255,0.02)">
```

**권장 패턴**:
```html
<!-- GOOD -->
<div style="background:var(--surface-1)">
```

**표준 매핑** (v48.48 정의):
| 값 | 변수 |
|-----|------|
| `rgba(255,255,255,0.02)` | `var(--surface-1)` |
| `rgba(255,255,255,0.03)` | `var(--surface-2)` |
| `rgba(255,255,255,0.04)` | `var(--surface-3)` |
| `rgba(255,255,255,0.05)` | `var(--surface-4)` |
| `rgba(255,255,255,0.08)` | `var(--surface-5)` |

**⚠ Canvas ctx 예외**: HTML5 Canvas의 `ctx.strokeStyle` / `ctx.fillStyle` / `ctx.font`는 CSS var를 **해석 못함**. Canvas 렌더러 내부에서는 직접 hex/rgba 값 사용:
```js
// BAD
ctx.strokeStyle = 'var(--surface-5)';  // 작동 안 함
// GOOD
ctx.strokeStyle = 'rgba(255,255,255,0.08)';  // 또는 '#8888884A'
```

> SVG `fill="var(...)"` 및 HTML `style="..."` 속성은 OK (CSS 해석).

### R35. 신규 페이지 → CHAT_CONTEXTS 동시 생성 (v48.54 추가, P106 교훈)
**원칙**: 새 페이지(`<div class="page" id="page-XXX">`)를 만들 때 반드시 `CHAT_CONTEXTS['XXX']` 도 동시 정의.

**체크**:
```bash
# 페이지 ID ↔ CHAT_CONTEXTS 매칭 검증
grep -oE 'id="page-[a-z-]+"' index.html | sed 's/id="page-//;s/"//' | sort -u > /tmp/pages.txt
grep -oE "CHAT_CONTEXTS\['[a-z-]+'\]" index.html | sed "s/CHAT_CONTEXTS\['//;s/'\]//" | sort -u > /tmp/contexts.txt
diff /tmp/pages.txt /tmp/contexts.txt  # 차이 없어야 함 (home/kr-home/guide 등 AI 채팅 불필요 페이지 제외)
```

> **v48.53 교훈**: `page-themes` + `page-theme-detail` 존재하나 `CHAT_CONTEXTS['themes']` 부재 → AI가 테마 종목 인식 못함. 필수 페이지 ↔ 컨텍스트 매핑.

### R36. Themes 페이지 종목 추가 → LIVE_SYMBOLS 동시 등록 (v48.54 추가)
**원칙**: `SUB_THEMES` / `THEME_MAP` / `ALL_RRG_ETFS`에 종목(ticker/leader/etf)을 추가하면 **반드시** `LIVE_SYMBOLS` (js/aio-data.js)에도 추가.

**체크**:
```bash
# SUB_THEMES tickers 전수 추출 → LIVE_SYMBOLS 교차 확인
awk '/var SUB_THEMES = \[/,/^\];/' index.html | grep -oE "'[A-Z0-9.=^-]{2,}'" | sort -u > /tmp/themes_syms.txt
awk '/const LIVE_SYMBOLS/,/^\];/' js/aio-data.js | grep -oE "'[A-Z0-9.=^-]{2,}'" | sort -u > /tmp/live_syms.txt
comm -23 /tmp/themes_syms.txt /tmp/live_syms.txt  # 출력 없어야 함
```

> **v48.53 교훈**: ROBO/WCLD/BUG/VIG/DGRO/SCHD 6종 ETF가 `SUB_THEMES.etf`에 있으나 `LIVE_SYMBOLS` 누락 → fetch 안 되어 renderAllEtfGrid에 "—" 표시.

### R37. data-snap 신규 추가 → 자동 렌더러 참여 (v48.54 추가, P108 교훈)
**원칙**: `data-snap="키"` HTML 속성을 추가하면 반드시 `updateSnapValues()` 또는 유사 자동 렌더러(Phase E 확장)에 키 등록. 정적 하드코딩 금지.

**순서**:
1. DATA_SNAPSHOT에 기본값 정의
2. HTML `<span data-snap="키">값</span>` 배치
3. **fetchLiveQuotes 후 updater에 등록** (index.html 20820+ 업데이트 함수):
```js
var newVal = ld['YAHOO_TICKER'] ? ld['YAHOO_TICKER'].price : null;
if (newVal != null) document.querySelectorAll('[data-snap="키"]').forEach(function(el){ el.textContent = newVal.toFixed(2); });
```
4. 배포 전 브라우저에서 값이 동적으로 갱신되는지 실측

> **v48.53 교훈**: data-snap 50종 중 자동화 7종(14%)만 되어 있었음 → D+6 stale. 16종까지 확장 (32%), 나머지 34종은 FRED/통계청 API 필요로 다음 세션.

### R38. `on*` 인라인 이벤트 핸들러 금지 — 전체 확장 (R32 확장, v48.54 추가)
R32에서 `onclick` 금지 규칙을 **모든 on* 인라인 이벤트로 확장**:
- `onclick` · `onchange` · `oninput` · `onkeydown` · `onkeyup` · `onsubmit`
- `onmouseover` · `onmouseout` · `onmouseenter` · `onmouseleave`
- `onblur` · `onfocus` · `onsubmit`

**대안**:
- 클릭/키보드: `data-action="fn"` (Event Delegation)
- 엔터 입력: `data-on-enter="fn[:arg]"` (v48.47+)
- Hover/Focus 스타일: CSS `:hover` / `:focus` 클래스 (aio-hover-*, aio-focus-* 유틸)

> **v48.54 교훈**: onkeydown만 처리했던 v48.47 이후 onmouseover 6건 · onmouseout 6건 · onblur/focus 2건 잔존 발견. 전체 on* 전수 점검.
> **v48.61 교훈**: HTML만 점검했던 v48.54 이후 **JS innerHTML 동적 주입 7건 잔존**(aio-data.js 5건, aio-chat.js 1건 등). JS 파일도 전수 대상.

### R39. extractTickers → UI 노출 경로 필수 페어링 (v48.55 추가, P116/P121/P122/P125 교훈)
`extractTickers` · `getDisplayTickers` · `_extractTickers` 호출 결과는 반드시 UI 렌더러(innerHTML/append) 또는 AI 프롬프트에 구조화 주입되어야 함.
- `tickerStr` 생성 → HTML 삽입 경로 확인
- `mentionedTickers` Set 집계 → 시스템 프롬프트에 `【뉴스 언급 티커 (상위 N)】` 섹션 주입
- 클릭 액션: `data-action="_aioNewsTickerClick"` 필수

> **P125 6회 재발**: v48.1/v48.6/v48.7/v48.10/v48.53/v48.60 모두 "수집만 하고 UI 미노출". 신규 수집 데이터 PR에 UI 노출 체크리스트 필수.

### R40. CHAT_CONTEXTS system() = persona + 메서드론만 (v48.55 추가)
CHAT_CONTEXTS 시스템 함수는 **persona + 데이터 주입 파이프라인 안내 + 분석 프레임워크**만 포함. **SUB_THEMES/THEME_MAP/KR_TICKER_MAP 등 종목 리스트 반복 렌더링 금지** (토큰 낭비).
- 데이터는 `_liveSnap()`/`_closeSnap()`/`window._fundAnalysisData` 동적 주입
- 반복 리스트는 API 파이프라인이 담당

> **v48.55 교훈**: v48.53 `CHAT_CONTEXTS['themes']` SUB_THEMES 325종 나열 = 중복 하드코딩 (토큰 낭비).

### R41. 기업 분석 맥락 ctx 전원 FMP 심층 활성 (v48.55 추가)
`fundamental` · `themes` · `theme-detail` · `portfolio` 4개 ctx는 **단일 티커 감지 시 자동으로 `_fetchDeepCompareData`(FMP 15관점) 활성**.
```js
var _isDeepCtx = _isFundCtx || ctxId === 'themes' || ctxId === 'theme-detail' || ctxId === 'portfolio';
var _shouldDeepAnalyze = detectedTickers.length === 1 && (_isDeepCtx || _hasDeepAnalysisKw(q));
```

### R42. Agent 결과 실측 교차검증 의무 (v48.59 추가, Agent 오판 5회 누적)
Explore/QA/성능 Agent 요약은 **반드시 Read/Grep 직접 확인**. Agent 보고와 실제 코드 상태 불일치 5회 누적:
- portfolio-donut "렌더러 미존재" → 존재 확인 (drawPortfolioDonut at aio-core.js:20448)
- score-gauge-canvas "렌더러 없음" → 존재 (drawScoreGauge at aio-core.js:20421)
- _renderTopicSection "HTML 미삽입" → 정상 렌더 (aio-chat.js:5758)
- Portfolio "편입/편출 버튼 없음" → 존재 (addPortfolioPosition/edit/remove)
- 실제 누락은 risk-gauge-small 1개만 (v48.58에서 추가)

**절차**: Agent 감사 보고 → `Grep` 교차 → 실측 승인된 것만 수정.

### R43. Canvas context는 CSS var 미해석 (R34 예외, v48.59 추가)
`ctx.strokeStyle = 'var(--data-cyan)'` **금지** — Canvas 2D API는 CSS var를 문자열로만 인식해서 **transparent 처리**(라벨/선 불렌더링).
**대안**:
- `getComputedStyle(document.documentElement).getPropertyValue('--data-cyan').trim()` (런타임 해결)
- hex 직접 명시 (예: `#00d4ff = data-cyan`, `#00e5a0 = data-green`, `#ff5b50 = data-red`, `#7b8599 = text-muted`)

> **v48.54~v48.61 교훈**: rgba 358건 → var(--surface-*) sed 치환 시 JS ctx.* 10건 오염. v48.61 전수 hex 교체.

### R44. setTimeout 무한 재귀 종료 카운터 필수 (v48.59 추가, renderAllEtfGrid 교훈)
재귀 `setTimeout(self, 500)` 패턴은 반드시 카운터 가드:
```js
window._fnRetries = (window._fnRetries || 0) + 1;
if (window._fnRetries > 60) { renderFallback(); return; }
setTimeout(fn, 500);
```

**현 적용 사례**: renderAllEtfGrid(60회) · drawRRG(40회) · renderThemeHeatmap(60회) · renderSubThemesGrid(60회) · initKoreaSupply(20회) · initKoreaMacro(20회).

### R45. 페이지 전환 active 설정은 `dataset.arg` 기반 (v48.59 추가, v48.32 onclick 0건 후 잔존 버그)
```js
// 금지
n.getAttribute('onclick').includes("'breadth'")
// 권장
n.dataset.arg === 'breadth'
```

> **v48.61 교훈**: v48.57 Phase 2에서 "data-arg 전환" 주장했으나 aio-ui.js:1861, aio-core.js:4934에 `getAttribute('onclick')` 잔존. v48.61에서 이중 조건(`arg === id || legacy.includes(...)`)으로 호환.

### R46. HTML 외 JS 파일까지 sed 치환 범위 확대 (v48.61 추가)
CSS/이벤트/폰트 관련 대량 치환 시 **js/*.js 4모듈(aio-core/data/ui/chat) 전수 포함 필수**.
- v48.54 rgba 358건 치환 = index.html만 → JS 85건 누락
- v48.59 font-size 991건 치환 = index.html만 → JS 124건 누락
- v48.35 onclick 253건 제거 = HTML만 → JS innerHTML 동적 주입 7건 잔존

**체크리스트**: sed 치환 대상 = `index.html js/aio-core.js js/aio-data.js js/aio-ui.js js/aio-chat.js`.

### R47. CSS 변수 자기순환 참조 금지 (v48.61 추가, surface-1~5 교훈)
```css
/* 금지 - 자기 참조 → CSS invalid 값 → 모든 사용처 무효 */
--surface-1: var(--surface-1);
/* 권장 - 실제 값 할당 */
--surface-1: rgba(255,255,255,0.02);
```

> **v48.61 교훈**: v48.48에서 `--surface-1: var(--surface-1)` 자기참조로 정의 → 377건 사용처 모두 invisible(테이블 hover/카드 배경/구분선/input 배경 전부). v48.54 rgba → var(--surface-*) 치환 작업이 시각적으로 전혀 작동 안 함. 판매 품질 직결.

### R49. 새 페이지 추가 시 결론 바 의무 (v48.62 추가)
새 페이지(`<div class="page" id="page-xxx">`) 추가 시 `aio-explain` 아래, 헤더 위에 `<div id="xxx-conclusion-bar"></div>` 삽입 후 `_updateAllConclusionBars()`에 업데이트 블록 추가.
- 배치 순서: 결론 바 → 핵심 카드 → aio-explain (설명 접힘)

### R50. fb-estimated 배지 사용 기준 (v48.62 추가)
하드코딩 데이터를 유형별로 구분:
- `fb-static` : 특정 날짜 종가 기준 스냅샷 (날짜 명시 가능)
- `fb-estimated` : 모델 계산값·보간값·추정치 (amber 색상 경고)
새 하드코딩 차트/숫자 추가 시 반드시 둘 중 하나 선택.

### R51. 콘텐츠 카드 본문 폰트 최소 12px (v48.62 추가)
`.aio-card` 및 `.explain-body` 내부 텍스트는 12px 이상. 메타 UI(`.freshness-badge`, `.status-pill`, `.aio-tooltip`, `.pcb-label`)는 10~11px 허용.
신규 카드 작성 시 `font-size:11px` 이하 인라인 스타일을 콘텐츠 영역에 사용 금지.

### R48. Canvas 렌더러 전역 변수 참조 시 실제 설정 위치 확인 (v48.61 추가, _pcRatio vs _putCallRatio 교훈)
렌더러 작성 시 참조하는 `window._xxx` 전역이 **실제로 어디서 설정되는지** grep 확인.
```js
// 금지 — 설정 위치 확인 없이 가정
var pcr = window._pcRatio; // 어디서 설정? 모름 → 항상 null
// 권장 — 다층 폴백
var pcr = window._putCallRatio // 실제 전역 (aio-data.js:10478)
       || snap.pcr              // DATA_SNAPSHOT 키 (aio-core.js:3338)
       || snap.pcRatio          // 다른 이름 가능성
       || null;
```

> **v48.60 Phase 25 → v48.61 수정**: `_aioRenderSignalRegime`가 `window._pcRatio` 참조 → 실제 전역은 `window._putCallRatio` (P88 교정 후). PCR 카드 영구 "—" 표시. **P125 7번째 재발** (수집/설정-UI 렌더 불일치).

---

## 🔧 Hook 자동화 (v48.61 대폭 확장 — Layer 2~9 실제 구현)

### validate-edit.sh Hook 9 Layer
1. **Layer 1**: div 균형 (기존 v31+)
2. **Layer 2**: `rgba(255,255,255,0.0[2-8])` 신규 추가 경고 — R34 위반 감지
3. **Layer 3**: `on(mouseover|mouseout|blur|focus|click|change|input|keydown|keyup|submit)=` 신규 추가 경고 — R38 위반
4. **Layer 4**: `ctx\.(stroke|fill)Style\s*=\s*['"]var\(--` 감지 — R43 Canvas 에러
5. **Layer 5**: CHAT_CONTEXTS system 함수 내 `SUB_THEMES|themeMap\.(slice|map|forEach)` 6회+ 경고 — R40
6. **Layer 6**: `extractTickers`/`getDisplayTickers` 호출 횟수 vs `tickerStr`/`tickerTag`/`mentionedTickers` 사용 불일치 경고 — R39 (P125 탐지)
7. **Layer 7**: `setTimeout\([^,]+,\s*\d+\)` 재귀 3회+ vs `_xxxRetries > N` 가드 부재 경고 — R44
8. **Layer 8**: `getAttribute\(['"]onclick['"]\)` 신규 추가 경고 — R45 위반
9. **Layer 9**: TODO/FIXME/XXX 10건+ 증가 시 기술부채 경고 — R42 원칙


## R54. `data-aio-archive` 마킹 원칙 (v49.21 추가)

**적용 기준**: 역사적/아카이브 데이터를 담는 DOM 섹션에만 `data-aio-archive="true"` 를 추가한다.
`getCritical10PageFreshnessAudit()` 및 `getCriticalKrPageFreshnessAudit()` 는 이 속성 하위 DOM을 clone 후 제거하고 textContent를 검사한다.

**적용 O**: 과거 날짜 하드코딩 정책 일정표, 지정학 시나리오 아카이브, 주간 수급 스냅샷 히스토리 탭
**적용 X**: `data-snap` / `data-snap-date` / `data-live-price` 속성 보유 동적 갱신 예정 섹션
**위반 시**: 실제 stale 데이터가 감사에서 제외되어 P209/P211 타입 stale 탐지 불능 상태 재발

---

## R55. 동일 지표 multi-sink 단일화 (v49.24 추가, P216/P218 근본)

**원칙**: 동일 지표(신용잔고·F&G·VIX·KOSPI 등)가 여러 페이지에 표시되는 경우 **반드시** `data-snap="key"` 또는 `data-live-price` 속성을 사용한다. 인라인 텍스트 하드코딩 금지.

**근거**:
- **P216 (v49.22)**: kr-home은 `data-snap="kr-credit">19.2조원` 사용했으나 kr-technical은 `<span>31.7조 (사상최대)</span>` 하드코딩 → cross-page 64.6% 괴리
- **P218**: home의 `#home-fg-score`와 sentiment의 `#fg-score-big`이 다른 ID로 분기 → home은 영구 placeholder

**검증**: `AIO.getSnapshotConsistencyAudit()` → `mismatches.length === 0` 보장
**위반 시**: 동일 지표가 페이지별로 다른 값 표시되어 사용자 신뢰 훼손, freshness audit 누락

---

## R56. 임계값·라벨 단일 출처 — THRESHOLD_REGISTRY (v49.24 추가, P219 근본)

**원칙**: VIX/F&G/HY Spread/AAII/Skew 등 임계값 기반 라벨(`"공포"`, `"Tight"`, `"극단 비관"` 등)은 **반드시** `window.AIO_THRESHOLD_REGISTRY[지표].getLabel(value)` 호출로 생성한다.

**근거 (P219)**:
- VIX 18 → home에서 `"심리 공포"` 라벨 vs 정의(`12~20 정상 Risk-On`) 모순
- HY 289 bps → 배지 `"Tight"+"Risky"` 동시 표시 vs 정의(`<300 = 과열`)
- AAII Bear 43% → `"극단적 비관"` vs 임계값(`spread < -20% = 극단`)

**구조**: `window.AIO_THRESHOLD_REGISTRY = { VIX:{bands:[...], getLabel:fn}, FG:{...}, HY_SPREAD:{...}, AAII:{...}, SKEW:{...} }`
**검증**: 새 라벨 표시 코드 추가 시 grep으로 `getLabel(` 호출 확인. 인라인 if/switch 분기 금지.

---

## R57. 정적 테이블 stale 감지 의무 (v49.24 추가, P217 근본)

**원칙**: 3행 이상 정적 데이터를 담는 `<table>` 첫 데이터 행 첫 셀에는 **반드시** 날짜(MM/DD 또는 YYYY-MM-DD) 패턴을 포함하거나 부모 컨테이너에 `data-aio-archive="true"` 또는 `data-snap-date` 부착한다.

**근거 (P217)**: kr-supply 주간 수급 테이블이 `03/27 03/26 03/25 03/24 03/23` 2024년 데이터를 2년+ 잔존. `data-aio-archive` 마킹 부재로 freshness audit 누락.

**검증**: `AIO.getTableStaleAudit()` → `issueCount === 0` 보장 (90일+ 경과 자동 탐지)
**적용**: 주간/월간 수급 테이블, BOK/Fed 회의 일정표, 어닝 캘린더 등

---

## R58. DOM 인라인 vs DATA_SNAPSHOT 3-way 정합 (v49.24 추가, P213 근본)

**원칙**: `data-snap="key"` 속성을 가진 DOM 요소의 **인라인 텍스트(pre-JS fallback)는 반드시 DATA_SNAPSHOT[key] 출력값과 일치**해야 한다.

**근거 (P213)**: v48.61 P125 해소 시 DATA_SNAPSHOT.krCreditBalance = 19.8 추가했으나 DOM 인라인은 `<span data-snap="kr-credit">31.7조원</span>` 그대로 잔존. JS 실행 전 사용자에게 19.8 ≠ 31.7 노출 가능.

**검증**: `AIO.getSnapshotConsistencyAudit()` → 동일 key의 모든 sink가 같은 텍스트 보유
**프로세스**: DATA_SNAPSHOT 값 갱신 시 → 같은 key의 모든 DOM 인라인 텍스트도 동시 갱신 (Edit 또는 grep replace)

---

## R59. 점수 스케일 단일 정의 — SCORE_SCALES (v49.25 추가, L1 근본)

**원칙**: 점수 시스템(20점 만점, 0~100 스케일 등)을 사용하는 모든 페이지는 **반드시** `window.AIO_SCORE_SCALES` 객체를 참조한다. 스케일 변환은 `convert(score, fromScale, toScale)` 함수만 사용.

**근거 (L1)**: signal 페이지가 "20점 만점" 명시 + 표 구간 "75+/60~75/45~60/30~45/<30" (0~100 스케일) 혼합 표기 → 사용자 혼동
**구조**: `TWENTY_POINT { min:0, max:20, components:{trend:8, rs:4, ...} }` + `HUNDRED_POINT { bands:[{min:75, label:'적극 매수'}, ...] }` + `convert()` + `getLabel100From20()`
**위반 시**: 페이지마다 임의 변환식 사용 → 같은 점수가 다른 라벨로 표시될 위험

---

## R60. 매매 전략 권장값 단일 출처 — ATR_PRESETS (v49.25 추가, L4 근본)

**원칙**: ATR 배수·스톱·트레일링 등 매매 전략의 권장값은 **반드시** `window.AIO_ATR_PRESETS[preset]` 참조. 페이지마다 임의 범위 표기 금지.

**근거 (L4)**: signal L4433~4441 "스윙 3~5배, 포지션 4~8배" 광범위 모호. 트레이더가 어떤 값을 채택할지 알 수 없음.
**구조**: `swing {multiplier:3.0, range:[2.5,3.5]}` · `position {multiplier:5.0, range:[4.0,6.0]}` · `scalp` · `trailing` + `getStop()` + `getDescription()`
**위반 시**: 동일 전략이 페이지별로 다른 권장값 표기 → 실행 일관성 훼손

---

## R61. 다중 신호 합의 알고리즘 — diagnoseBreadthConsensus (v49.25 추가, L3 근본)

**원칙**: 3개 이상 신호(5SMA/20SMA/50SMA/McClellan/Weinstein 등)를 종합하는 판정은 **반드시** `AIO.diagnoseBreadthConsensus(signals)` 호출. 인라인 if/else 종합 금지.

**근거 (L3)**: breadth 페이지 5SMA 68%(강세) + 20SMA 75%(강세) + 50SMA 46%(혼조) + McClellan(약세) → 종합 "약세"라 단정. 근거 불명확. 강세 2개 + 약세 1개 + 혼조 1개 → 가중 평균으로는 "혼조" 또는 "약세 우위"가 정확.
**구조**: 가중치 자동 (sma5:0.1, sma20:0.2, sma50:0.3, mcclellan:0.2, weinstein:0.1, goldenCross:0.1) + 합의 점수 → verdict + conflict 보고
**위반 시**: 모순 신호 무시 판정 → 사용자 신뢰 훼손, P219 유사 패턴 재발

---

## R62. 정량 지표 자동 채점 — PIOTROSKI_CHECKLIST (v49.25 추가, L7 근본)

**원칙**: F-Score 등 정량 채점 시스템은 **반드시** 체크 항목과 검증 함수를 단일 객체에 등록. 페이지마다 9가지 체크 텍스트만 나열 금지.

**근거 (L7)**: fundamental L8134~8142 "9가지 YES/NO 체크" 설명만 있고 데이터로 분류하지 않음. 사용자가 자기 종목 F-Score 계산 불가.
**구조**: `AIO_PIOTROSKI_CHECKLIST.categories = { profitability:[4 items], leverage:[3 items], efficiency:[2 items] }` + `score(d) → {score:0~9, details:[], verdict:'우수/양호/주의/위험'}`
**위반 시**: 설명만 있고 실행 안 됨 → 정량 분석의 의미 상실

---

## R63. 라벨 인라인 사용 자동 audit — getThresholdLabelAudit (v49.25 추가, R56 자동화)

**원칙**: THRESHOLD_REGISTRY에 등록된 라벨(`'극단 공포'`, `'Tight'` 등)이 페이지 텍스트에 직접 작성된 위치는 **반드시** `getLabel()` 경유 여부 확인. 인라인 하드코딩 발견 시 마이그레이션.

**근거**: R56(THRESHOLD_REGISTRY) 신설만으로는 기존 인라인 라벨 코드가 자동 마이그레이션되지 않음. 신규 인프라 적용률 추적 필요.
**검증**: `AIO.getThresholdLabelAudit()` → `inlineHits` 배열. 페이지별 라벨 출현 위치 보고. 합법(tooltip/정의문)과 불법(라벨 표시) 구분은 코드 리뷰.

---

## R64. 점수 가중치 단일 정의 — WEIGHT_REGISTRY (v49.26 추가, I2 근본)

**원칙**: Trading Score / Quality Score / Market Regime 등 복합 점수의 구성요소별 가중치는 **반드시** `window.AIO_WEIGHT_REGISTRY[scoreKey]` 등록 후 페이지에서 `getComponentTooltip(key)` 호출로 표시.

**근거 (I2)**: home Trading Score "20점 만점" + Quality Score "0~100"라 명시하나, 구성요소 가중치(50일선 비율 ? 점, A/D ? 점, NHNL ? 점) 미공개 → 사용자가 점수 의미 파악 불가
**구조**: `TRADING_SCORE.components = [{id, label, weight, max, note}, ...]` + `totalWeight` + `getComponentTooltip(key)` 자동 생성
**위반 시**: 점수 시스템이 "블랙박스"로 보여 신뢰도 하락. 사용자가 자기 종목 점수 검증 불가.

---

## R65. 시각 위계 단일 정의 — CARD_HIERARCHY (v49.26 추가, I3 근본)

**원칙**: 카드(매매판단/품질점수/시장국면 등)는 **반드시** `window.AIO_CARD_HIERARCHY` 의 `primary` / `secondary` / `tertiary` 레벨로 분류하여 `getClassList(level)` 호출로 클래스 적용. 페이지 직접 fontSize 인라인 금지.

**근거 (I3)**: home 3개 카드 (`is-interactive has-stripe-top stripe-amber`)가 동일 타이포그래피 → Primary(매매신호) 시각 강조 부족
**구조**: `primary {fontSize:'24px', fontWeight:'900', stripeColor:'data-green'}` · `secondary {fontSize:'20px', fontWeight:'800'}` · `tertiary {fontSize:'16px'}`
**위반 시**: 우선순위 불명확, 사용자 시선 흐름 혼란

---

## R66. 중복 콘텐츠 자동 감사 — getDuplicateContentAudit (v49.26 추가, I4 근본)

**원칙**: 한 페이지에 동일 지표(`data-snap` 또는 `data-live-price` 키)가 3회 이상 표시되면 **반드시** 의도 명시 또는 `data-aio-archive` 마킹.

**근거 (I4)**: technical 페이지 TradingView 차트 + OHLC 폴백 정보 표시 비중 균등(중복). breadth 페이지도 같은 지표 3곳 이상 표시.
**검증**: `AIO.getDuplicateContentAudit()` → `duplicates[].count >= 3` 위치 보고
**위반 시**: 사용자가 "어디를 봐야 하나" 혼동, 인지 부하 증가

---

## R67. 동적 판정 함수 단일화 — getCycleFromMacro (v49.26 추가, I7 근본)

**원칙**: 경기 사이클 위치(Early/Mid/Late/Recession) 등 매크로 기반 판정은 **반드시** `AIO.getCycleFromMacro(macroInputs)` 호출. 페이지에 "◀ 현재" 위치 정적 하드코딩 금지.

**근거 (I7)**: themes L8534 "◀ 현재(Late Cycle · 에너지·필수소비·유틸)" 사이클 위치 정적 고정. 시간 경과·매크로 변화 미반영.
**구조**: `getCycleFromMacro({vix, breadth50, yield2s10s, spxTrend}) → {phase, inputs, rationale[]}`
**위반 시**: 사이클 판정이 6개월+ 정적으로 고정 → 신뢰도 훼손

---

## R68. 페이지 placeholder 표준 — 동적 검색 가이드 (v49.26 추가, I5/I6 근본)

**원칙**: 검색·동적 콘텐츠 영역의 초기 상태("스토리라인 생성 중..." 등 placeholder)는 **반드시** 사용자 가이드 텍스트(검색 예시·데이터 출처·예상 응답 시간) 포함.

**근거**:
- I5: fundamental 검색 전 예시 카드 부재 → 사용자가 어떤 종목 입력해야 할지 가이드 부족
- I6: macro "스토리라인 생성 중..." 플레이스홀더 → 실제 생성 로직/예상 결과 불명

**기본 패턴**: `<placeholder> + <sample-cta> + <data-source-note> + <expected-latency>`
**위반 시**: 동적 영역이 영구 placeholder로 보일 위험. 사용자 신뢰 훼손.

---

## R69. Action Item 단일 출처 — ACTION_RULES (v49.27 추가, E1/E2 근본)

**원칙**: "지금 해야 할 일" 가이드는 **반드시** `window.AIO_ACTION_RULES.getActionPlan({vix, fg, breadth50})` 호출로 생성. 페이지별 일반론 텍스트 ("AI 모멘텀 변동성 대비") 금지.

**근거 (E1/E2)**: home·briefing에 구체 포지션 조정 규칙 부재. 사용자가 "VIX 25에서 포지션을 얼마로?" 답을 얻지 못함.
**구조**: `positionSizing.rules = [{vixMax, sizePct, note}, ...]` + `sentimentAction.rules` + `getActionPlan(env)` → `{actions:[], position, sentiment}`
**위반 시**: 페이지마다 일반론적 조언 → 실행 가이드 누락

---

## R70. 페이지 목적 단일 정의 — PAGE_PURPOSE_REGISTRY (v49.27 추가, E3/E4 근본)

**원칙**: 각 페이지의 목적·주요 카드·CTA는 **반드시** `window.AIO_PAGE_PURPOSE_REGISTRY[pageKey]` 등록. signal vs home 역할 분리 명확화.

**근거**:
- **E3**: 매매신호 핵심이 home·signal 두 페이지에 분산 → 사용자가 page 본 목적 혼동
- **E4**: briefing의 5대 관전 포인트가 어닝 캘린더보다 아래 → 우선순위 역전

**구조**: `home {purpose, mainCards, cta}` · `briefing {purpose, sectionOrder, cta}` · 12 페이지 모두 등록
**위반 시**: 페이지 구조 변경 시 일관성 추적 불가, 정보 우선순위 깨짐

---

## R71. 이론 vs 실행 비율 audit — getPagePurposeRatioAudit (v49.27 추가, E5 근본)

**원칙**: 한 페이지의 정적 텍스트 글자수 vs 동적 sink 개수 비율을 자동 점검. 텍스트 3000자+ & sink <5개면 이론 우위 (E5 패턴) 경고.

**근거 (E5)**: portfolio L8716~8763 이론(Sharpe/Sortino/Kelly/Beta/IR) 풍부 vs UI L8767~8780 5개 미만 → 비대칭
**검증**: `AIO.getPagePurposeRatioAudit()` → 페이지별 `textLen`, `sinkCount` 보고. 비대칭 시 issueCount 증가.
**위반 시**: 사용자가 이론만 보고 실행 못 함

---

## R72. 시나리오 확률 시간 의존 — SCENARIO_REGISTRY (v49.27 추가, L6 근본)

**원칙**: 시나리오 확률(연착륙/스태그/침체)은 **반드시** `window.AIO_SCENARIO_REGISTRY` 등록 + `lastUpdated`/`source`/`triggers` 필수 메타데이터. 30일+ 경과 시 자동 stale 보고.

**근거 (L6)**: macro L7244~7295 시나리오 트리 확률 (30%/45%/25%) 하드코딩. 시간 경과·매크로 변화 미반영.
**구조**: `scenarios { 'soft-landing':{probability, lastUpdated, source, triggers[]} ... }` + `validateSum()` (확률 합 1.0 검증)
**검증**: `AIO.getScenarioFreshnessAudit()` → staleScenarios + probabilitySum
**위반 시**: 시나리오가 분기점(FOMC/CPI 발표) 후에도 stale로 표시되어 잘못된 의사결정 유도

---

## R73. 인프라 추가 시 페이지 적용 동반 의무 (v49.28 추가, P239 메타 근본)

**원칙**: 신규 `*_REGISTRY` 객체나 `AIO.get*Audit()`/`AIO.applyXxxToElement()` 함수를 추가할 때 **반드시 같은 버전에서 해당 인프라를 실제 페이지에 적용**해야 한다. 인프라 등록 PR과 페이지 적용 PR을 분리하면 인프라가 "사용 가능"하지만 "사용 안 됨" 상태로 영구 잔존.

**근거 (P239)**: v49.24~v49.27이 18개 근본 인프라(THRESHOLD/SCORE_SCALES/ATR/PIOTROSKI/WEIGHT/CARD_HIERARCHY/applyLabel/getCycle/ACTION/PAGE_PURPOSE/SCENARIO 등)를 추가했으나 실제 페이지 DOM에 적용 안 함. 사용자가 보는 화면은 그대로 stale. v49.28에서 시정.

**적용 체크리스트**:
1. 인프라 객체/함수 등록 (`aio-core.js`)
2. 최소 1개 페이지에 적용 (DOM 마커 + JS 호출)
3. `_aioPageBus.register()` 또는 `applyDataSnapshot` 통합 (페이지 진입 시 자동 호출)
4. 회귀 테스트 추가 — 페이지에 인프라 호출 결과 표시 확인 (단순 인프라 함수 존재 여부 X, 실제 DOM 결과 검증)

**위반 시**: 새 인프라가 "코드는 있는데 화면에 없음" 패턴으로 누적 → 디버깅 어려움, 사용자 신뢰 훼손
**자동 감사**: `AIO.getThresholdLabelAudit()` + `AIO.getSnapshotConsistencyAudit()` 호출 결과 + getDuplicateContentAudit를 정기 점검하여 적용률 추적

---

## R74. DOM 인라인 폴백 vs DATA_SNAPSHOT 동시 갱신 의무 (v49.30 추가, P252/M1 근본)

**원칙**: `data-snap="key"` 속성을 가진 DOM 요소의 인라인 폴백 텍스트는 **반드시** DATA_SNAPSHOT[key] 갱신 시 동시 갱신. `AIO.assertSnapshotInlineMatch()`가 핵심 sink (KOSPI/KOSDAQ/KRW/SPX/VIX/Fed/BOK 등)의 인라인 vs DATA_SNAPSHOT 비교.

**근거 (P252)**: KOSPI 인라인 `6,091.39` vs DATA_SNAPSHOT.kospi `7844.01` 22% 괴리. v49.23이 KR 6필드만 시정하고 메인 카드 누락 → P213 패턴 재발.
**검증**: `AIO.assertSnapshotInlineMatch()` → `mismatchCount === 0`. throwOnFail 옵션으로 개발 모드 차단 가능.
**위반 시**: pre-JS 상태에서 사용자에게 22% 괴리 가격 노출 → 의사결정 오류

---

## R75. 정적 콘텐츠 lifecycle 메타 필수 (v49.30 추가, P253/M2 근본)

**원칙**: 인터뷰/이벤트/주간 캘린더 등 시점 의존 정적 콘텐츠는 **반드시** `AIO_STATIC_CONTENT_LIFECYCLE.contents[id]`에 등록 (`createdAt` + `archiveAfterDays` + `replaceAfterDays`). DOM에는 `data-lifecycle-id="id"` 속성 부착.

**근거 (P253)**: Jensen 인터뷰(2026-03-20) 58일 잔존 — 정적 메모 lifecycle 정책 부재로 60일 임박 자동 알람 없음
**구조**: `{ jensen-interview-202603: { type:'interview', createdAt, archiveAfterDays:30, replaceAfterDays:60 } }`
**검증**: `AIO.getStaticContentLifecycleAudit()` → `expiredCount === 0`
**위반 시**: 정적 콘텐츠가 영구 잔존 → 1~2개월 시간 경과 후 stale 신뢰도 훼손

---

## R76. 정치/관료 이름 NAMED_ENTITY_REGISTRY 경유 의무 (v49.30 추가, P254/M3 근본)

**원칙**: Fed Chair/Treasury Sec/BOK 총재 등 정치·관료 이름은 페이지·CHAT_CONTEXTS·메모에 직접 하드코딩 금지. `AIO_NAMED_ENTITY_REGISTRY.entities[key].name` 참조 (또는 alt 배열).

**근거 (P254)**: chat L55 "Bessent/Warsh policy mix" — 인사 임명·교체 시점 의존. 검증 함수 부재로 임의 시점 stale 가능.
**구조**: `{ us-fed-chair: { name:'Powell', alt:[...], role, currentAs:'2026-05-17', source } }`
**검증**: `AIO.getNamedEntityAudit()` → `unverifiedCount === 0` (90일+ 미검증 인사 보고)
**위반 시**: 임명 변경 후 페이지가 구 인사 이름 영구 표시

---

## R77. 거시지표 MACRO_CALENDAR 등록 + 자동 stale (v49.30 추가, P254/M4 근본)

**원칙**: NFP/CPI/PCE/ISM 등 정기 발표 거시지표 데이터는 **반드시** `AIO_MACRO_CALENDAR.releases[key]`에 등록 (`lastRelease` + `nextRelease` + `dataField`). `getMacroReleaseStaleAudit()`가 nextRelease 경과 시 자동 stale 보고.

**근거 (P254)**: NFP 4/3 데이터 (`usUnemploy: 4.30`) → 44일 경과. 5월 발표 (5/3) 후에도 폴백 그대로. 자동 stale 트리거 부재.
**구조**: `{ us-nfp: { frequency:'monthly-first-friday', lastRelease, nextRelease, dataField:'usUnemploy' } }`
**검증**: `AIO.getMacroReleaseStaleAudit()` → `staleReleaseCount === 0`
**위반 시**: 발표 후에도 한 달 이상 stale 데이터 노출

---

## R78. KR 거시 KR_MACRO_RELEASE 등록 + 발표 캘린더 의무 (v49.30 추가, P255/M5 근본)

**원칙**: 산자부 수출입(매월 1일), 통계청 CPI/산업생산, BOK GDP(분기) 등 KR 거시 데이터는 **반드시** `AIO_KR_MACRO_RELEASE.releases[key]`에 등록. `monthData` 필드로 정확한 기준 월 명시.

**근거 (P255)**: "2월 반도체 수출 +157.9%" (kr-home L10684, kr-macro 등 3곳) → 3월/4월 데이터 발표 후에도 영구 잔존. KR 발표 캘린더 부재.
**구조**: `{ kr-semi-export: { frequency:'monthly-first', lastRelease:'2026-03-01', nextRelease:'2026-04-01', dataField:'krSemiExport', monthData:'2026-02' } }`
**검증**: `AIO.getKrMacroReleaseAudit()` → `krStaleReleaseCount === 0`
**위반 시**: KR 분기 거시 텍스트가 영구 stale → 정책 결정 오해

---

## R79. 지정학 시나리오 단일 출처 — GEOPOLITICAL_CONTEXT_REGISTRY (v49.31 추가, H3 근본)

**원칙**: 호르무즈/이란/대만/우크라/미중 관세 등 시점 의존 지정학 시나리오는 **반드시** `window.AIO_GEOPOLITICAL_CONTEXT_REGISTRY.scenarios[id]` 등록. 페이지 텍스트에 인라인 시나리오 작성 금지.

**근거 (H3)**: macro/signal 페이지에 "호르무즈", "이란 재협상", "트럼프 관세" 등 시점 의존 텍스트 산재 → 정책 변경 시 페이지마다 수동 갱신 필요. lastReviewed 추적 부재로 1~2개월 stale 가능.
**구조**: `{ hormuz-strait: { name, region, status:'active/monitoring/resolved', lastReviewed, marketImpact, currentPriceSignal } }`
**검증**: `AIO.getGeopoliticalReviewAudit()` → `overdueCount === 0` (14일 defaultReviewDays)
**위반 시**: 시나리오가 정책 변경 후에도 stale 노출 → 사용자 잘못된 투자 결정

---

## R80. 정적 데이터베이스 메타 의무 — SCREENER_DB_META (v49.31 추가, H1 근본)

**원칙**: SCREENER_DB 등 메모/분석을 포함하는 정적 데이터베이스는 **반드시** `*_META` 객체 (schemaVersion + lastBulkUpdate + staleAfterDays + replaceAfterDays + source + note) 부착. 메모 게시일 추적.

**근거 (H1)**: SCREENER_DB 메모 헤더 "2026-03 Yahoo Finance 기준" + memo 게시일 04-21/04-25 → 22~47일 경과. lifecycle 메타 부재로 자동 stale 알람 없음.
**구조**: `SCREENER_DB_META = { lastBulkUpdate, staleAfterDays:30, replaceAfterDays:60, source, note }` + `window.SCREENER_DB_META` 노출
**검증**: 콘솔에서 `window.SCREENER_DB_META.lastBulkUpdate` 확인 가능
**위반 시**: 분기 실적 시즌 후에도 EPS/PER 변경 미반영 → 종목 분석 오류

---

## R81. 정기 발표 데이터 사용자 가시 마커 (v49.31 추가, H4 근본)

**원칙**: FRED/KRX/산자부 등 정기 발표 데이터의 차트/카드 헤더에 **반드시** `다음 갱신: NFP 6/6` 등 다음 발표일 표시. MACRO_CALENDAR/KR_MACRO_RELEASE 등록 데이터 자동 연동.

**근거 (H4)**: macro FRED 차트 헤더 "FRED API · 월간 데이터"만 표기 → 사용자가 언제 새 데이터 들어오는지 알 수 없음. 시간 경과 시 stale 신뢰도 훼손.
**구조**: 차트 헤더에 `<span title="MACRO_CALENDAR 연동">(다음 갱신: NFP 6/6 · CPI 6/12 · PCE 6/30)</span>`
**검증**: 발표일 자동 도래 시 라벨 색상 변경 (amber → red)
**위반 시**: 사용자가 데이터 stale을 인지하지 못함

---

## R82. AI 채팅 가격 fetch 실패 시 Hard Guard 의무 (v49.32 추가, P263 근본)

**원칙**: 종목 시세 fetch 실패 시 system 프롬프트에 **반드시** HARD GUARDRAIL 텍스트 ("절대 가격 추측 금지. 학습 데이터 사용 금지. 외부 도구 권장만 답변") 주입. soft signal ("데이터 조회 실패") 금지.

**근거 (P263)**: chat L1940 폴백 분기가 "데이터 조회 실패 — 티커를 확인하세요" 단순 텍스트만 주입 → AI가 학습 데이터(2024~2025 stale)로 "QCOM 약 $150" 환각 응답
**구조**: results에 ⛔ 절대 금지 + ✅ 허용 답변 + ✅ 허용 분석 3종 명시 + ABSOLUTE RULES 4조항
**검증**: T260 — _fetchTickerDataForChat 실패 시 HARD GUARDRAIL 텍스트 포함 확인
**위반 시**: 사용자에게 잘못된 가격 응답 → 잘못된 투자 결정

---

## R83. 채팅 응답 post-hoc 가격 검증 의무 (v49.32 추가, P264 근본)

**원칙**: AI 응답 생성 후 **반드시** `AIO.assertChatResponseAccuracy(responseText, detectedTickers)` 호출. 응답 텍스트의 가격 패턴(`$\d+`) 추출 + 실시간 가격과 비교. ±20% 이상 괴리 시 응답 차단/재요청.

**근거 (P264)**: v49.24~31 누적 13개 audit이 모두 pre-render (DOM/데이터). 응답 후 가격 검증 0건.
**구조**: `{ accurate: boolean, deviation: pct, severity: 'critical/high/medium/low/none', issues: [], priceCitations: [] }`
**검증**: T263 — assertChatResponseAccuracy 호출 + mock 응답 비교
**위반 시**: 환각 응답이 사용자에게 그대로 노출

---

## R84. System 프롬프트 정량 수치 화이트리스트 (v49.32 추가, P262 근본)

**원칙**: chat system 프롬프트에 박힌 정량 수치 (147-150 같은 임계값/배수)는 **반드시** `AIO_NUMERIC_GUIDELINE_SAFELIST.thresholds[id]` 등록. AI에게 "calibration constant이지 stock price 아님" 명시.

**근거 (P262)**: chat L54 "147-150" (blow-off top 20MA distance band)이 AI가 "QCOM = 150" 환각 응답 시 환각 출처 가능
**구조**: `{ 'blowoff-singlename-20ma-distance': { value: '147-150', meaning: '...NOT stock price', context: '...' } }`
**검증**: T262 — SAFELIST 등록 + 147-150 포함 + isCalibrationConstant() 작동
**위반 시**: AI가 정량 임계값을 종목 가격으로 오인용 → 환각

---

## R85. 종목명-티커 단일 출처 — TICKER_NAME_REGISTRY (v49.32 추가, P266 근본)

**원칙**: 한글/영문/별명/한자 → 표준 ticker 매핑은 **반드시** `window.AIO_TICKER_NAME_REGISTRY.entries[ticker]` 단일 출처. 기존 KR_TICKER_MAP은 신규 종목 추가 시 영문 별명 미반영 위험.

**근거 (P266)**: KR_TICKER_MAP은 한글→영문 단일 방향. 영문 별명(Microsoft↔MSFT) / 한자(엔비디아↔NVDA↔Nvidia) 매핑 분산. 검증 함수 부재.
**구조**: `{ NVDA: { en:'NVIDIA', kr:'엔비디아', alt:['nvidia', 'nvda'] } }` + `resolveTickerFromAnyName(input)` → ticker or null + `getTickerMappingAudit()` 미매핑 보고
**검증**: T265 (resolveTickerFromAnyName('퀄컴') === 'QCOM'), T266 (getTickerMappingAudit unmappedCount === 0)
**위반 시**: 사용자 입력 매핑 실패 → 미매핑 종목에 대한 AI 환각

---

## R86. 환각 패턴 자동 탐지 + 의심 점수 (v49.32 추가, P264 보강)

**원칙**: 채팅 응답 텍스트에 대해 **반드시** `AIO.getChatHallucinationAudit(responseText)` 호출. 4 패턴 탐지 — 라운드 숫자 / 너무 정확한 소수 / 가격+불확실 표현 동시 등장 / 학습 데이터 시점 키워드.

**근거 (P264 보강)**: assertChatResponseAccuracy는 실시간 가격이 있어야 비교 가능. 가격이 없거나 fetch 실패 종목은 환각 패턴 탐지로 보완.
**구조**: `{ suspicionScore: 0~10, patterns: [...], verdict: 'high-risk/medium-risk/low-risk/clean' }`
**검증**: T264 — 의심 점수 0~10 + verdict 분류
**위반 시**: 환각 패턴 가진 응답이 차단 없이 노출

---

## R87. 종목별 데이터 무결성 통합 검증 (v49.32 확장, 사용자 추가 요청)

**원칙**: 종목/기업 관련 답변 시 **반드시** `AIO.assertTickerDataIntegrity(ticker)` 호출로 6개 데이터 채널 무결성 확인 — 시세(PriceStore) + 추세(`_fetchTickerTrend`) + 컨센서스(Finnhub) + 어닝(Finnhub) + Naver(KR) + SCREENER_DB 메모.

**근거**: 시세 fetch만 검증해도 어닝 일정/컨센서스/메모는 별도 채널이라 누락 시 환각 가능. 종목별 다중 데이터 채널 통합 게이트가 필요.
**구조**: `{ ticker, sources: {6 channels with available/age/fresh}, completenessScore: 0~100, verdict: 'excellent/good/partial/poor', recommendation }`
**검증**: `AIO.assertTickerDataIntegrity('QCOM')` → completenessScore ≥ 70 권장
**위반 시**: 일부 채널만 동작하는데 AI가 "전체 분석"으로 답변 → 부분 환각

---

## R88. Fundamental 15 분석 기준 데이터 출처 매핑 (v49.32 확장)

**원칙**: 종목 fundamental 분석 답변 시 15개 기준 (Quality/Growth/Profitability/Margin/Cashflow/Balance/Valuation/F-Score/Moat/Insider/Analyst/PEG 등)이 어떤 데이터 출처에서 오는지 **반드시** `AIO_FUNDAMENTAL_CRITERIA.criteria[id]`에 등록. `implFn`이 null인 항목은 답변 시 "데이터 부재" 명시 필수.

**근거**: 15개 기준 중 일부는 FMP/Finnhub API가 없으면 평가 불가능. 사용자가 "퀄컴 15개 분석 해줘"라고 물어도 실제로는 8~10개만 평가 가능한데 AI가 환각으로 채울 수 있음.
**구조**: `{ key: { label, dataSource, required:[fields], implFn: 'AIO_PIOTROSKI_CHECKLIST' or null } }`
**검증**: `AIO.getFundamentalCriteriaAudit()` → `coveragePct` 80% 이상 권장
**위반 시**: 일부 기준이 환각으로 채워짐

---

## R89. AI 채팅 응답 자동 검증 통합 의무 (v49.33 추가, P269 근본)

**원칙**: chatSend 응답 렌더 시 **반드시** AIO.assertChatResponseAccuracy + AIO.getChatHallucinationAudit 자동 호출 + 사용자에게 검증 배지 가시화. 함수만 정의하고 호출 안 하면 무의미.

**근거 (P269)**: v49.32에서 5개 검증 함수 신설했으나 chatSend 응답 렌더 코드에 자동 호출 통합 미적용 → 함수는 있는데 사용 안 됨 (R73 패턴)
**구조**: 응답 렌더 직후 `_srcBadge` 다음에 `_accBadge` 추가 — 가격 정확성 + 환각 의심도 표시. high-risk/high-deviation 시 console.warn.
**검증**: T273 — 채팅 응답 후 DOM에 `.aio-chat-accuracy-badge` 클래스 존재
**위반 시**: 검증 함수가 있어도 사용자에게 환각 응답이 차단 없이 노출

---

## R90. 종목 정성 분석 출처 의무 — ANALYSIS_FRAMEWORK_REGISTRY (v49.34 추가, 사용자 지적)

**원칙**: 종목/기업 분석 답변 시 15 분야 (비즈니스 구조/사업 모델/수익 구조/제품 포트폴리오/CEO 경영진/밸류에이션/협력 파트너십/공급망/TAM/리스크/경쟁/투자포인트/시세/차트/재무지표) 각각 **반드시** `AIO_ANALYSIS_FRAMEWORK_REGISTRY.fields[id].primarySource` 등록된 출처에서 데이터 fetch. AI 학습 데이터(2024~2025)로 정성 분야 채우기 금지.

**근거 (P272 ~ P274)**: 9/15 분야가 AI 학습 데이터 의존 (high hallucination risk). 사용자 "퀄컴 사업 모델/공급망/CEO 분석"에 환각 응답 가능. 무료 SEC EDGAR/Wikipedia API 미활용.
**구조**:
- `fields.business-structure`: SEC 10-K Item 1 → `fetchSECBusinessDescription`
- `fields.ceo-management`: Wikipedia API → `fetchWikipediaCompany`
- `fields.risk-factors`: SEC 10-K Item 1A → `fetchSECRiskFactors`
- `fields.investment-thesis`: Finnhub + Naver → `fetchFinnhubRecommendation` + `fetchNaverUSData`
- `fields.partnership`: SEC 8-K (v49.35 미구현)

**Hard guards**:
- `_fetchTickerDataForChat` 시 SEC + Wikipedia 병렬 fetch + system 프롬프트 주입
- ABSOLUTE RULES 5조 추가: "15 분야 출처가 위 데이터 블록에 없으면 '검증된 데이터 없음' 답변"
- `AIO.assertAnalysisFrameworkCoverage(ticker)` async — 종목별 가용성 매트릭스

**검증**: T279~T284 — 신규 fetch 함수 + REGISTRY 15 fields + coverage audit
**위반 시**: AI가 환각으로 사업 모델/CEO/공급망/리스크 답변 → 잘못된 투자 판단

---

## R91. 페이지 표시 분석 기준 registry 등록 + 가용성 가시화 의무 (v49.35 추가, P275 근본)

**원칙**: index.html에 텍스트로 명시된 분석 기준 (예: fundamental 페이지 L8175 "15개 분석 관점")은 **반드시** 코드 registry로 등록 + 각 기준 옆에 가용성 배지 (✓/⚠/❌) 표시 + 채팅 시 system 프롬프트에 가용성 매트릭스 주입.

**근거 (P275)**: fundamental 페이지가 "15개 분석 관점"을 텍스트로 자랑하나, 실제 구현은 6/15 (40%)뿐. 사용자가 "15개 모두 분석"이라 인지하나 AI가 미구현 9개를 학습 데이터로 환각 답변. 또한 v49.25 FUNDAMENTAL_CRITERIA / v49.34 ANALYSIS_FRAMEWORK_REGISTRY와 별개라 cross-reference 부재.

**구조**:
- `AIO_FUNDAMENTAL_PAGE_CRITERIA.criteria[id]`: { num:1~15, label, description, dataSource, implFn, plannedFn, requires:[], frequency, hallucinationRisk, note }
- 페이지 DOM 각 기준 옆 `[✓ 출처]` / `[⚠ 계획됨]` / `[❌ 미구현 - 환각 위험]` 배지 인라인
- `AIO.getFundamentalPageCriteriaAudit()` → 구현/미구현/highRisk + coveragePct
- `AIO.getCriteriaCrossReferenceAudit()` → 3개 "15기준" registry 매핑 안내

**검증**: T285~T290 — registry 15 entries / 페이지 가용성 배지 / coverage audit / cross-ref
**위반 시**: 페이지 텍스트는 "15개" 자랑하나 AI는 9개를 환각으로 채워 답변 → 사용자 잘못된 투자 결정

---

## R92. 페이지 표시 분석 기준 100% 커버 의무 (v49.36 추가, P278 근본)

**원칙**: 페이지 인라인에 "N개 분석 관점"을 표시하면 **반드시** N개 모두 구현 또는 명시적 대체 출처 제공. 미구현 시 hard guard로 환각 차단. coveragePct < 100% 시 페이지 헤더에 가용성 매트릭스 표시 의무.

**근거 (P278~P281)**: v49.35에서 fundamental 페이지 15기준 6/15(40%)만 구현. 사용자가 "15개 모두 분석" 인지하나 AI가 9개를 학습 데이터로 환각. v49.36에서 7 신규 함수 (computeFcfYield/BalanceSheetRatios/EvEbitda/MacroBeta + fetchFinnhubInsider/FinnhubShortInterest/SEC13F) 신설 → 14/15 (93%) 달성. Moat는 Morningstar 유료라 SEC 10-K AI 분석으로 대체. Industry Rank는 IBD 유료라 SCREENER_DB.rsi 대체.

**검증**: T291~T298 — 7 신규 함수 정의 + PAGE_CRITERIA implFn 갱신 + 페이지 가용성 배지 갱신 + coverage 93%
**위반 시**: 페이지 자랑하는 N개 vs 실제 구현 N-m개 차이 → 사용자 환각 답변 위험

---

## R93. 페이지 sequential audit 의무 (v49.37 추가, P282 메타 근본)

**원칙**: 21 페이지 각각 위→아래 sequential 점검 + 모든 sub-section을 6축 (최신성/정확성/정합성/로직성/직관성/핵심성)으로 매트릭스화. **반드시** `AIO_PAGE_SEQUENTIAL_AUDIT_REGISTRY.pages[pageId].subSections[]` 등록 + `auditStatus` 추적.

**근거 (P282 메타 결함)**: v49.23 4축 audit + v49.30 최신성 audit + v49.32~36 작업이 모두 **line range 분석 + 키워드 grep** 위주였음. 실제로 "위에서 아래로 한 줄씩 읽으며 각 카드/위젯/차트/표/버튼 개별 점검"은 안 함. 21페이지 × 8~10 sub-section × 6축 = 1000+ 점검 매트릭스 미실행.

**구조**:
- `AIO_PAGE_SEQUENTIAL_AUDIT_REGISTRY.pages[pageId]`: { lineRange, subSections:[{id, order, topic, lines}], auditStatus }
- `subSections[]`: top-down 순서로 enumerate (home L3961 버전 배지 → L3970 스냅 그리드 → L4020 3 카드 → L4053 Action Item → ...)
- `auditStatus`: 'pending' / 'partial' / 'done' 또는 axis별 객체

**검증**: T299~T304 — REGISTRY 정의 / home 페이지 subSections 등록 / live-quote-ts-topbar 갱신 hook / 페이지 chip 정합 / sub-section axis 매트릭스
**위반 시**: line-range/keyword 표면 audit만 반복 → 페이지 내 영구 placeholder/모순/stale 영역 잠복

---

## R94. 페이지 인라인 임계값 표 REGISTRY 정합 의무 (v49.38 추가, P286 근본)

**원칙**: 페이지 인라인 `<table class="explain-table">` 또는 임계값 표는 **반드시** `data-threshold-table="KEY"` 마커 부착 + REGISTRY의 bands 수/라벨과 정합. R56 보강.

**근거 (P286)**: home L4222 VIX 인라인 표가 5 구간 (12/20/30/45/∞)으로 표시되나 THRESHOLD_REGISTRY.VIX는 6 구간 (12/20/25/30/40/∞). 라벨도 "패닉 진입" vs "공포" 등 불일치. 사용자가 두 곳에서 다른 라벨 노출.

**구조**:
- DOM: `<tbody data-threshold-table="VIX">...</tbody>` 마커
- 각 row의 두 번째 column = REGISTRY bands[idx].label과 정확히 일치
- 행 수 = REGISTRY bands.length

**검증**: `AIO.getInlineThresholdTableAudit()` → `issueCount === 0`
**위반 시**: 페이지 표와 REGISTRY 라벨 불일치 → R56 단일 출처 원칙 위반 + 사용자 혼동

---

## R95. 페이지 간 동일 ticker 정합 의무 (v49.39 추가, P290 근본)

**원칙**: 동일 ticker(`data-live-price="^GSPC"` 등)가 여러 페이지에 표시되는 경우 **반드시** 동일 텍스트를 보유. `AIO.getCrossPageIndicatorConsistencyAudit()`가 자동 검증.

**근거 (P290)**: v49.24 sinkConsistency는 `data-snap` 기반. 라이브 가격 sink (`data-live-price`)는 별도 audit 없음 → home의 SPX vs technical의 SPX vs macro의 SPX가 다른 텍스트 보일 수 있음.

**구조**: 모든 `[data-live-price]` ticker별 그룹화 → distinct 텍스트 ≥2 시 mismatch. placeholder(`—`/loading) 제외.
**검증**: `AIO.getCrossPageIndicatorConsistencyAudit()` → issueCount === 0
**위반 시**: 사용자가 페이지 간 이동 시 동일 지표가 다른 값 노출 → 신뢰 훼손

---

## R96. data-action 핸들러 등록 검증 (v49.39 추가, P291 근본)

**원칙**: 모든 `[data-action="NAME"]` 요소의 NAME은 **반드시** `window[NAME]` / `window.AIO[NAME]` / event-delegate 등록 함수 / known alias 중 하나로 등록.

**근거 (P291)**: data-action이 미정의 함수 호출 시 click 무동작 → 사용자 혼동. 신규 핸들러 추가 시 정의 누락 가능성 자동 차단 필요.

**구조**: `AIO.getDataActionHandlerAudit()` → 모든 `data-action` 추출 + 등록 위치 (window/AIO/event-delegate/alias) 확인
**검증**: missing actions 0
**위반 시**: 사용자 click이 무반응 → "버튼이 동작 안 함" 신고

**v49.40 P294 보강**: `knownAliases`는 비-`_aio` 접두 글로벌 함수(showPage/toggleLLM 등)만 허용. `_aio*` 접두 함수는 반드시 실제 `window` 등록을 거쳐 `has_aio` 검사로 통과해야 함. alias 의존 false-positive 차단.

---

## R98. JS 함수 내 var X + const/let X 충돌 자동 탐지 (v49.44 추가, P311 근본)

**원칙**: 같은 함수 안에 `var X`와 `const X`/`let X`가 동시 선언되면 **SyntaxError**(`Identifier 'X' has already been declared`) 발생 → 그 파일 전체 parse 실패 → 모든 함수 정의 안 됨.

**근거 (P311)**: `aio-data.js refreshHomeDashboard()` L10989 `const ld` + L11085 try block 내 `var ld` → `var` hoist로 함수 top으로 끌어올려짐 → `const ld`와 동일 scope 충돌 → SyntaxError → aio-data.js 전체 마비 → `fetchLiveQuotes`/`refreshHomeDashboard` 등 미정의 → 데이터 파이프라인 전체 차단.

**구조**: `AIO.getVarHoistConflictAudit()` (async)
- 모든 JS 파일 fetch + 함수 본문 추출 + 같은 함수 안의 `var X`와 `const X`/`let X` 동시 선언 탐지
- 휴리스틱 — 정확도 95% (문자열 안 false positive 가능)
- P311 패턴은 100% 탐지

**검증**: `(await AIO.getVarHoistConflictAudit()).issueCount === 0`

**위반 시**: 해당 함수 전체 + 그 파일 모든 후속 함수가 parse 실패 → 페이지 전체 데이터 마비.

**수정 방법**:
- 두 선언 중 하나를 삭제 (outer scope 변수 재사용)
- 또는 변수 이름 변경 (`var ldInner` 등)

---

## R134. AI 채팅 데이터 다운로드 + 금액/% 시뮬레이션 의무 (v49.70 추가, P373~P374 근본)

**원칙**: AI 채팅 응답은 (1) Markdown/JSON/CSV 3 format 다운로드 버튼 자동 삽입 + (2) "1억 투자 시" / "SPX -5% 시나리오" 등 금액·지수 % 자연어 의도 감지 + 자산별 정량 영향 추산 의무.

**근거 (P373~P374)**: v49.69까지 답변 데이터 외부 활용 불가 (사용자가 수동 복사) + 금액/% 시뮬레이션 부재 → 사용자 질의 silent.

**구조**:
- `_aioExportChatData(ctxId, fullText, tickers, format)`: 3 format + 시장 스냅샷 + 종목 데이터 + AI 응답 + 클립보드 폴백
- `_aioSimulateAmountOrPct(q, tickers)`: 금액 5 단위 (억/천만/백만/만/USD) + 지수 % 양방향 + 자산별 영향
- chatSend 응답 직후 다운로드 버튼 (MD/JSON/CSV) + 시뮬레이션 chip 자동 삽입

**검증**: `AIO.runTests()` T545 (export 함수) + T546 (1억 + SPX -5% 정확 추산) + `AIO.assertChatAdvancedFeaturesAudit()` 100%.

---

## R133. AI 채팅 알람/임계값 트리거 의무 (v49.70 추가, P372 근본)

**원칙**: AI 채팅은 "VIX 30 이상 알림" / "F&G 75 넘으면" / "NVDA $200 도달" 자연어 의도 감지 → localStorage 알람 등록 + 1분마다 자동 점검 + 브라우저 Notification API 의무.

**근거 (P372)**: v49.69까지 사용자 알림 요청 silent 무시 → 임계값 도달 시 수동 모니터링 필요.

**구조**:
- `_aioParseAlertIntent(q)`: VIX/F&G/종목 가격 × above/below × 한글+영문 4 변형 패턴 매칭
- `_aioAddAlert(alert)` + `localStorage.aio_alerts_v1` 영속
- `_aioCheckAlerts()` 1분마다 setInterval + Notification API 권한 있을 때 자동 푸시
- chatSend 응답 직후 시안색 chip 안내 + 권한 요청

**검증**: `AIO.runTests()` T543 (5 알람 함수) + T544 (VIX 30+ / F&G 75+ 정확 파싱).

---

## R132. AI 채팅 사용자 투자 프로필 메모리 의무 (v49.70 추가, P371 근본)

**원칙**: AI 채팅은 사용자 위험 성향 (low/medium/high) + 투자 시간축 (1d/1m/1y/5y/10y) + 선호/제외 자산을 localStorage에 영속 저장 + 14 CHAT_CONTEXTS의 system prompt에 자동 주입 의무.

**근거 (P371)**: v49.69까지 사용자 프로필 미지원 → AI가 모든 사용자에게 동일 답변 → 개인화 부재.

**구조**:
- `_aioGetUserProfile()` / `_aioSetUserProfile(profile)`: localStorage `aio_user_profile_v1` 영속
- `_buildUserProfileContext()`: system prompt 텍스트 생성 (이모지 표준 + 시간축 라벨 + 자산 매핑)
- `_getV48IntegratedContext` 자동 호출 → 14 CHAT_CONTEXTS 모두 통합
- AI 답변 의무: (1) 위험 성향 맞는 포지션 사이즈 + (2) 시간축 맞는 진입 전략 + (3) 선호 자산 우선 + (4) 제외 자산 회피
- AIO.getUserProfile / setUserProfile 콘솔 API

**검증**: `AIO.runTests()` T541 (3 프로필 함수) + T542 (v48 자동 통합) + `AIO.assertChatAdvancedFeaturesAudit().fnChecks.userProfileGet`.

---

## R131. AI 채팅 거시 시나리오 동적 시뮬레이션 + 약어/별명 fuzzy 매칭 의무 (v49.69 추가, P368~P369 근본)

**원칙**: AI 채팅은 (1) 사용자 거시 시나리오 질의 ("Fed 50bp 인하 시" / "VIX 30 도달") → 6+ 시나리오 패턴 자동 감지 + 자산별 정량 영향 추산 + (2) 약어/별명 입력 (엔비/삼전/테슬라/유가/위안 등) → fuzzy 매핑으로 ticker 자동 변환 의무.

**근거 (P368~P369)**: v49.68까지 거시 시나리오 시뮬레이션 미지원 → "Fed 50bp 인하 시 자산 영향?" 질의 시 정성 답변만. 약어 매핑 부재 → "엔비 분석" 입력 시 _extractTickers 0건 → silent fail.

**구조**:
- `_simulateMacroScenario(q)`: 6 시나리오 패턴 (fed-cut/hike/vix-spike/spx-crash/dxy-strong/oil-spike) + Bridgewater + Druckenmiller 프레임 적용 + SPX/10Y/DXY/Gold/Sector 5축 영향 추산
- `_resolveTickerFromFuzzy(input)`: 50+ 약어/별명 매핑 + 부분 매칭 (양방향)
- `_extractTickers` 0건일 때 자동 fallback

**검증**: `AIO.runTests()` T534 (6 시나리오 매핑) + T535 (엔비→NVDA / 삼전→005930.KS / 테슬라→TSLA) + `AIO.assertChatInteractivityAudit()` 100%.

**위반 시**: 거시 가설 질의 silent / 약어 입력 ticker 미감지 → 사용자 답변 없음 또는 환각.

---

## R130. AI 채팅 자동 페이지 이동 + 포트폴리오 동적 시뮬레이션 의무 (v49.69 추가, P366~P367 근본)

**원칙**: AI 채팅 응답은 (1) 사용자 입력 의도 감지 → 적합 페이지 자동 이동 안내 (chip 표시) + (2) 포트폴리오 변경 질의 ("X 10% 추가 시") → 라이브 가격 + 가중치 변화 표 자동 삽입 의무.

**근거 (P366~P367)**: v49.68까지 사용자가 "차트 보여줘" 질의 시 답변만 + 페이지 이동 수동 클릭. 포트폴리오 변경 시뮬레이션 부재 → "10% AAPL 추가 시 비중?" 정성 답변만.

**구조**:
- `_autoNavigatePage(q, currentCtxId)`: 12+ 키워드 패턴 → page 매핑 + 현재 컨텍스트와 동일 시 nav 안내 생략
- `_simulatePortfolioAddition(q, tickers)`: 비중 % 정규식 매칭 + portfolio.holdings 자동 조회 + 라이브 가격 + 신규 가중치 계산
- chatSend 응답 렌더링 직후 chip 자동 삽입 (보라색=nav / 녹색=portfolio)

**검증**: `AIO.runTests()` T532 (autoNav 12+ intent) + T533 (portfolio simulator 정의) + T536 (chatSend 통합).

**위반 시**: 사용자 의도와 무관한 페이지 잔존 → 네비게이션 비효율 + 포트폴리오 가설 silent.

---

## R129. AI 채팅 후속 질문 자동 제안 의무 (v49.69 추가, P365 근본)

**원칙**: AI 채팅 응답 끝에 반드시 3개 후속 질문 chip 자동 제안 의무. 14 컨텍스트별 분기 + ticker/페이지 컨텍스트 기반 유기적 질문 생성. chip 클릭 시 `chatFromChip` 자동 호출.

**근거 (P365)**: v49.68까지 답변 종료 후 사용자가 직접 다음 질문 입력 → 진입장벽 + 대화 깊이 부족. 후속 질문 자동 제안 시 대화 흐름 유기적 + 사용자 진입장벽 50% 감소.

**구조**:
- `_suggestFollowUpQuestions(ctxId, userQuery, aiResponse, detectedTickers)`: 14 컨텍스트 분기 (종목→17 관점 deep-dive / macro→Bridgewater 4-Quadrant / sentiment→Marks Pendulum / portfolio→4-Quadrant 분포 / themes→Soros Bubble 단계 / kr-*→한국 시장 특화)
- 응답 종료 후 사이앙색 chip 3개 자동 삽입 + 클릭 시 `chatFromChip(ctxId, q)` 자동 호출

**검증**: `AIO.runTests()` T531 (함수 + 14 분기) + T539 (배열 3개 반환) + `AIO.assertChatInteractivityAudit().checks.suggestFollowUpQuestions`.

**위반 시**: 사용자 후속 질의 진입장벽 ↑ + 대화 흐름 단절.

---

## R128. AI 채팅 시각 단서 표준 + 데이터 소스 우선순위 + 출처 타임스탬프 (v49.68 추가, P361~P363 근본)

**원칙**: AI 채팅 답변은 (1) 이모지 표준 (🔴 공포·위험·매도 / 🟡 중립·주의 / 🟢 안정·기회·매수) + (2) 핵심 결론 **굵게** + (3) 데이터 소스 우선순위 명문화 (`_liveSnap` → `_closeSnap` → `DATA_SNAPSHOT` 폴백 → fetched) + (4) 모든 수치 인용 시 "Source · 기준일: YYYY-MM-DD" 표기 의무.

**근거 (P361~P363)**: v49.67 사용자 체감 시정 후 의미적 진단 결과 시각 단서 일관성 부재 (이모지/굵기 무작위) + 데이터 소스 우선순위 미명문화 (`_liveSnap`/`_closeSnap`/`DATA_SNAPSHOT` 혼용) + 출처 타임스탬프 누락 (Fed Rate 폴백값 인용 시 기준일 미표기). 사용자가 "이 답변 정확한가? 언제 기준?" 즉시 검증 불가.

**구조**:
- 시장 환경 헤더에 VIX/F&G/Score 이모지 자동 분류: VIX ≥25 🔴 / ≥20 🟡 / <20 🟢. F&G ≤25 또는 ≥75 🔴 / ≤45 또는 ≥55 🟡 / 46~54 🟢.
- ABSOLUTE RULES 10조 (시각 단서 표준) + 12조 (데이터 우선순위 1~4순위).
- 폴백값 인용 시 "(폴백)" 명시 + 학습 데이터 추정 절대 금지.

**검증**: `AIO.runTests()` T524 (이모지 + 타임스탬프) + T525 (ABSOLUTE RULES 10/12조 명시) + `getChatContextConsistencyAudit().fetchChat.visualCue/srcStamp`.

**위반 시**: 시각 단서 무작위 → 사용자가 위험/기회 즉시 인지 못함 + 출처 타임스탬프 부재 → "이 정보 언제 기준?" silent fail.

---

## R127. AI 채팅 Bull/Base/Bear 3 시나리오 분기 강제 (v49.68 추가, P361 근본)

**원칙**: 종목/시장 분석 답변은 반드시 **Bull (확신도 X%) / Base (Y%) / Bear (Z%)** 3 시나리오 분기 + X+Y+Z=100 확신도 명시 의무. 단일 시나리오만 답변 금지.

**근거 (P361)**: v49.67 의미적 진단 결과 14 CHAT_CONTEXTS 중 macro만 시나리오 분기 (60/25/15% 확률) 제공. fundamental/themes/ticker/portfolio/sentiment 등 대부분은 단일 결론 → 사용자가 비대칭 위험 인지 불가.

**구조**:
- 형식: "**📈 Bull (확신도 X%)**: [트리거 조건] → [목표 시나리오] / **🟡 Base (Y%)**: [현재 환경 유지 시] → [예상] / **📉 Bear (Z%)**: [악화 트리거] → [하방 시나리오]"
- ABSOLUTE RULES 9조 (시나리오 분기 의무) 명시.
- 시나리오별 trigger condition + 예상 시간축 + 구체적 액션 (포지션 사이즈/진입가/손절) 의무.

**검증**: `AIO.runTests()` T523 (Bull/Base/Bear + R127 명시) + `getChatContextConsistencyAudit().fetchChat.scenarioGuide`.

**위반 시**: 사용자가 "이 종목 어떻게 될까?" 질의 시 단일 결론만 받음 → 비대칭 위험 미인지.

---

## R126. AI 채팅 기관급 분석 프레임워크 8개 인용 의무 (v49.68 추가, P360 근본)

**원칙**: 14 CHAT_CONTEXTS의 답변은 의무적으로 다음 8 기관급 프레임 중 페이지 주제와 가장 관련 깊은 1~3개 명시 인용:
1. **Bridgewater All Weather 4-Quadrant** (성장 × 인플레 매트릭스)
2. **Druckenmiller Macro Overlay** (18개월 선행 유동성)
3. **Howard Marks Pendulum** (낙관↔비관 진자)
4. **Buffett Owner Earnings + Margin of Safety**
5. **Ackman Pershing Square 8 Criteria**
6. **Soros Reflexivity** (Perception ↔ Fundamentals 양방향)
7. **GS GIR Top of Mind + Out of Consensus**
8. **Morgan Stanley Cyclical Pendulum** (ISM/CRB → 11 GICS 섹터)

**근거 (P360)**: v49.67 의미적 진단 결과 기관급 프레임 통합도 32% (3.5/11) — Citi/JPM 부분만 통합, Bridgewater/Druckenmiller/Marks/Buffett/Ackman/Soros 등 핵심 기관급 프레임 명시 부재. 사용자가 "기관급 퀄리티" 요구.

**구조**:
- `_getInstitutionalFrameworkContext(pageFocus)` 신규 함수 — 8 프레임 정의 + 페이지별 우선 프레임 매핑
- `_getV48IntegratedContext`가 자동 호출 → 14 CHAT_CONTEXTS 모두 자동 주입
- ABSOLUTE RULES 11조 (8 프레임 중 1~3개 인용 의무) 명시

**페이지별 우선 프레임 매핑**:
- macro / kr-macro → Bridgewater 4-Quadrant + Druckenmiller Overlay
- sentiment → Marks Pendulum + Soros Reflexivity
- fundamental / ticker → Buffett Owner Earnings + Ackman 8 Criteria
- themes / theme-detail → Soros Reflexivity + MS Cyclical Pendulum
- technical → Soros Bubble 5단계 + Druckenmiller
- signal / breadth → GS GIR Out of Consensus + MS Cyclical
- fxbond → Bridgewater + Druckenmiller
- portfolio → All Weather (자산 분산) + Buffett Margin of Safety

**검증**: `AIO.runTests()` T521 (8 프레임 명시) + T522 (v48 → instFw 자동 호출) + T529 (14 컨텍스트 12+ 프레임) + `getChatContextConsistencyAudit().contexts.instFwCoverage`.

**위반 시**: AI 답변이 학습 데이터 기반 추측 → 기관급 분석 프레임 부재로 신뢰도 낮음 + 사용자 "왜 이 결론인가?" 추적 불가.

---

## R123. 사이드바 Audit row 의미 분리 표시 의무 (v49.67 추가, P357 근본)

**원칙**: 사이드바 audit row는 서로 다른 의미의 수치를 한 줄에 섞어 단독 대표값처럼 보이면 안 된다. 특히 REGISTRY 실제 등록 수와 alias/fetch coverage, 현재 stale hit와 archive/reference hit는 분리 표시한다.

**구조**:
- REGISTRY row는 `AIO.getTickerRegistryEntryAudit()`를 우선 사용해 `realEntries / totalEntries / placeholderCount` 기준을 표시하고, alias coverage는 보조 지표로만 붙인다.
- freshness row는 `AIO.getChatContextFreshnessAudit()`의 `currentHits`와 `archiveHits`를 분리 표시한다.
- `currentHits > 0`은 최신 판단 오염 가능성으로 warn, `archiveHits > 0`은 과거 리서치 참조로 표시하되 현재 판단 근거로 쓰면 안 된다.

**근거 (P357)**: v49.67에서 REGISTRY row가 alias coverage 46%만 보여 실제 384 real / 391 total 보강을 가렸다. freshness row도 totalHits만 보아 "측정 불가" 또는 전체 stale 경고로 표시되어 현재 stale과 archive reference를 구분하지 못했다.

**검증**: `AIO.runTests()` T505 (REGISTRY real/total row) + T506 (freshness 측정 불가 금지) + T507 (currentHits/archiveHits shape).

---

## R122. AI 채팅 사용자 체감 품질 의무 (v49.67 추가, P352~P356 근본)

**원칙**: AI 채팅 응답은 (1) 시세 fetch 폴백 4단계 (Yahoo→Stooq→Naver→Finnhub) 의무 + (2) 모든 종목 답변 첫 줄에 "현재 시장 환경" 헤더 자동 주입 의무 + (3) 시세 조회 실패 종목은 캐시 저장 금지 (stale 응답 5분 반복 차단) + (4) `AIO.assertTickerFetchHealth()` 카테고리별 coverage 자동 감지.

**근거 (P352~P356)**: v49.66까지 "함수 호출 정합" 100% 달성했으나 사용자 체감 품질 4 갭 잔존 — KR 종목 시세 fetch 실패 silent / 종목 답변에 시장 환경 도입 안 됨 / `_chatTickerCache`가 실패 응답도 5분 캐시 / 카테고리별 fetch 성공률 자동 점검 부재. 사용자 정직 지적 "몇몇 종목 시세 못 불러옴" + "시장 흐름 유기적 연결 안 됨" 정확 매핑.

**구조**:
- `dynamicTickerLookup` 4단계 폴백: Yahoo 3 proxies → Stooq (US/암호화폐 미지원 제외) → Naver siseJson (KR .KS/.KQ) → Finnhub /quote (US/ADR — Finnhub key 있을 때) → fetchFailed:true 구조화 응답
- `_fetchTickerDataForChat` 응답 헤더: `【현재 시장 환경】 SPX/VIX/10Y/F&G/트레이딩 스코어` + ABSOLUTE RULES 8조 ("지금 VIX X · F&G Y 환경에서 [종목]은..." 패턴)
- `_chatTickerCache` TTL eviction: 매 save 시 5분 만료 자동 제거 + `_isFailedFetch` 시 캐시 저장 거부
- `AIO.assertTickerFetchHealth()`: REGISTRY 391 entries × 6 category (us/kr/adr/crypto/index/other) × `_liveData[k].price > 0` 검증

**검증**: `AIO.runTests()` T498 (폴백 4단계) + T499 (시장 헤더) + T500 (TTL eviction) + T501 (assertTickerFetchHealth byCategory) + T502 (사이드바 row) + T503 (ABSOLUTE RULES 8조).

**위반 시**: 사용자 종목 질의에 silent fail (시세 못 불러옴 표시 없음) + 시장 환경과 무관한 정적 답변 + 실패 응답 5분 캐시로 반복 stale + 카테고리별 fetch 갭 미감지.

**Lineage 보완**: API key 부재로 Finnhub 폴백 미사용 시 `suggestedAction`에 "Finnhub API key 등록 권장" 명시.

---

## R121. AI 채팅 시스템 정의-호출 정합 의무 (v49.66 추가, P348~P351 근본)

**원칙**: `window.AIO.fetch*` 또는 `compute*` 접두 함수는 모두 의무적으로 (1) `_fetchTickerDataForChat` 통합 또는 (2) `knownExempt` 리스트에 명시. 14 CHAT_CONTEXTS는 모두 `_getV48IntegratedContext` 호출 의무. `_chatTickerCache`는 save + load + LRU eviction 3축 모두 구현 의무.

**근거 (P348~P351)**: v49.65 사용 가능도 97% 진단 — fetchSECRiskFactors v49.34 정의 후 호출 0건 잔존 (Dead code 1건) + 7 CHAT_CONTEXTS (macro/portfolio/breadth/kr-*) `_getV48IntegratedContext` 미호출 (Partial Integration) + `_chatTickerCache` 5분 TTL 정의만 + save 로직 부재 (Silent fail). 자동 회귀 방지 audit 부재로 신규 함수 추가 시 통합 누락 미감지.

**구조**:
- `AIO.assertChatFunctionCoverage()` 자동 점검:
  - `chatRelevantFns` = window.AIO.fetch*/compute* 함수 (28 knownExempt 제외)
  - `deadCode` = `_fetchTickerDataForChat` source에서 `AIO.fn(` 또는 `window.AIO.fn(` 패턴 미발견 함수
  - `partialContexts` = CHAT_CONTEXTS 중 system() source에 `_getV48IntegratedContext` 미포함
  - `cacheImplemented` = `_chatTickerCache[t]` save + `cacheMissTickers` load + `_CC_MAX`/`evictions` LRU 3축 모두 존재
  - `status: 'ok'` 조건: deadCodeCount === 0 AND partialContextCount === 0 AND cacheImplemented === true
- 사이드바 audit row 6번째 (`[data-audit-key="chatFunctionCoverage"]`) — "함수 X/Y · 컨텍스트 X/Y · 캐시 ✓/✗" 색상

**검증**: `AIO.runTests()` T492 (risk factors 통합) + T493 (14 컨텍스트 partial 0) + T494 (cache 3축 + stats fn) + T495 (deadCode 0) + T496 (사이드바 row DOM).

**위반 시**: 정의된 fetch/compute 함수가 채팅 응답에 활용 안 됨 → 사용자가 "왜 이 분석 안 되냐" 질문할 때 silent gap. v49.66 정직 시정 선례 (97% → 100%).

**Lineage 보완**: 의도적 미통합 시 ANALYSIS_FRAMEWORK_REGISTRY에 `deprecated: true` 또는 `knownExempt` 리스트 추가로 명시.

---

## R119. 3대 본질 정렬 감사 의무 (v49.65 추가, P346 근본)

**원칙**: 주요 기능/데이터/UX 변경은 항상 AIO의 3대 본질에 맞는지 자동 감사되어야 한다.
1. 기관급 기능과 내용을 초보자가 접근 가능한 All-in-one 스크리너
2. 정확한 최신 데이터를 지속 제공하고 자동 업데이트하는 운영 시스템
3. 직관적으로 사용 및 이해 가능한 스크리너

**구조**:
- `AIO.getEssenceAlignmentAudit()`는 `institutionalAllInOne`, `accurateFreshAutoOps`, `intuitiveBeginnerUse` 3개 goal 점수와 `overallScore`를 반환해야 한다.
- 사이드바 audit widget에는 `[data-audit-key="essence"]` row가 존재해야 하며 3개 goal 점수를 사용자가 바로 볼 수 있어야 한다.
- `AIO.getAutoOpsReadiness()`는 `essenceAlignment` 결과와 `AIO.getEssenceAlignmentAudit()` 명령을 포함해야 한다.
- `AIO.getDeploymentGateAudit()`는 `essenceAlignment`를 포함하고, 전체 점수 70 미만은 배포 blocker로 취급해야 한다.

**근거 (P346)**: v49.65 Codex 감사에서 이전 "전수 조사"가 정적/문서 중심이면 다음 변경 때 본질 정렬이 다시 빠질 수 있음을 확인. 페이지 안내, live 데이터 lineage, refresh scheduler, analysis framework, 배포 게이트를 하나의 제품 목표 감사로 묶어야 회귀를 막을 수 있다.

**검증**: `AIO.runTests()` T486 (essence audit API shape) / T487 (sidebar essence row) / T488 (AutoOps 통합) / T489 (deployment gate 통합) / T490 (모든 page brief registry 커버).

---

## R120. 초보자 초기 상태 문구는 보이는 DOM 기준으로만 감사 (v49.65 추가, P347 근본)

**원칙**: "로딩 중/계산 중/분석 로딩 중/데이터 로딩 중"은 사용자에게 오류인지 대기인지 모호하므로 초기 화면 문구로 쓰지 않는다. 대체 문구는 "수신 대기", "수집 대기", "판정 입력 대기", "분석 입력 수신 대기"를 사용한다.

**감사 방식**:
- `AIO.getEssenceAlignmentAudit()`의 텍스트 카운트는 보이는 DOM 텍스트만 대상으로 한다.
- `SCRIPT`, `STYLE`, `NOSCRIPT`, `TEMPLATE` 내부 문자열/주석은 사용자 화면 문구가 아니므로 직관성 벌점에 포함하지 않는다.
- 실제 화면의 초기 문구에서 `로딩 중|데이터 로딩|분석 로딩|계산 중` 카운트는 0이어야 한다.

**근거 (P347)**: v49.65 최초 3대 본질 감사에서 `document.body.textContent`가 script 문자열까지 세어 오탐을 만들었고, 실제 화면에도 29건의 모호한 초기 로딩 문구가 남아 있었다. 브라우저 기준으로 visible loading count 0건까지 정규화.

**검증**: `AIO.runTests()` T491 (`loadingTextCount === 0`) + 브라우저 sidebar essence row의 직관성 점수 확인.

---

## R118. REGISTRY coveragePct와 실등록 카운트 분리 감사 의무 (v49.65 추가, P339 근본)

**원칙**: REGISTRY 확장 평가는 `AIO.assertTickerRegistryCompleteness().coveragePct`와 `AIO.getTickerRegistryEntryAudit().realEntries`를 함께 본다. `_dup`/`_skip` placeholder는 coverage와 실등록 카운트에서 제외해야 한다.

**근거 (P339)**: v49.59에서 REGISTRY 173 → 230+ (32% → 50%)으로 확장 했지만 이후 SCR_KEYWORD_ALIASES 추가 시 audit threshold 미상향. KOSDAQ 200+ / 인도 ADR / 유럽 ADR 미등록 여전. 사용자가 "현대중공업 검색" 안되면 silent fail.

**구조**:
- `getAudit().coveragePct >= 60` → green ✓ 정상
- `>= 30 && < 60` → amber ⚠ 확장 권장
- `< 30` → red ✗ 긴급 확장 필요

**검증**: `AIO.runTests()` T471 (realEntries >= 380 + placeholderCount <= 8) / T472 (coveragePct >= 40) + 사이드바 위젯 시각.

---

## R117. dataConfidence:low 분야 환각 차단 알림 의무 (v49.65 추가, P340 근본)

**원칙**: AI 답변에서 `dataConfidence: "low"` 또는 `"low-medium"` 분야 (Supply Chain #12, Platform/Ecosystem #13, TAM #11, Moat #7 일부)는 응답에 "정성 분석 한계 — 외부 확인 권장" 경고 의무. "Strong/Wide/Large" 등 강한 형용 사용 금지.

**근거 (P340)**: v49.65에서 17 관점 미구현 3개 (#12 공급망 / #13 플랫폼 / #14 파트너십)에 신규 fetch 함수를 추가했으나, 외부 API가 없는 #13 Platform/Ecosystem은 3-source 합성 score만 산출. AI가 "이 회사는 대규모 플랫폼/생태계를 가진다" 단정 환각 위험.

**구조**:
- 신규 fetch (`fetchSECSupplyChain` / `fetchPlatformEcosystem` / `computeMoatScore` / `computeTAMEstimate`) 모두 `dataConfidence` 필드 반환 의무
- 링크+키워드 가이드만 제공하는 함수는 `sourceMode`/`requiresManualFetch`를 반환해 자동 추출과 구분
- ABSOLUTE RULES 7조 (`_getChatRules`) — "dataConfidence: low 분야는 답변에 '정성 분석 한계' 경고 필수"
- AI 학습 데이터 추정 절대 금지

**검증**: `AIO.runTests()` T478 (fetchPlatformEcosystem source에 dataConfidence 분기 존재) + T483 (ABSOLUTE RULES 7조에 dataConfidence 의무 텍스트).

---

## R116. 새 분석 관점 추가 시 4축 동시 갱신 의무 (v49.65 추가, P340 근본)

**원칙**: AIO_ANALYSIS_FRAMEWORK_REGISTRY에 새 관점 (entry) 추가 시 다음 4축을 동시 갱신:
1. **REGISTRY entry**: `fields.{key}` 추가 (num/label/type/primarySource/implFn/freshness/aiHallucinationRisk)
2. **implFn 함수**: 실제 fetch/compute 함수 정의 (없으면 plannedFn 명시 + R117 dataConfidence:low)
3. **_fetchTickerDataForChat promise**: 채팅 통합 (`_withTimeout` 2.5초 + 일부 실패 graceful fallback)
4. **ABSOLUTE RULES**: `_getChatRules` 또는 `_fetchTickerDataForChat` 반환 텍스트에 라벨 인용 의무 (학습 데이터 환각 차단)

**근거 (P340)**: v49.34 ANALYSIS_FRAMEWORK_REGISTRY 15 entries에서 partnership #14는 `implFn: null, plannedFn: 'fetchSECRecentFilings'`로 1년+ 잔존. supply-chain #12는 implFn 있으나 채팅 통합 안 됨. 4축 동시 갱신 미의무로 갭 누적.

**구조**:
- v49.65 신규 entry "platform-ecosystem" #13 → 4축 모두 완성 사례:
  - REGISTRY entry ✓
  - implFn `fetchPlatformEcosystem` ✓
  - _fetchTickerDataForChat `platformPromise` + `[Platform Eco]` 라벨 ✓
  - ABSOLUTE RULES 6조 (R116 17 라벨 인용 의무) + 7조 (R117 dataConfidence) ✓

**검증**: `AIO.runTests()` T482 (17 user perspectives + support fields/partialFields) + T481 (6 신규 promise + 6 신규 라벨) + T483 (R116/R117 rules 텍스트).

---

## R115. 사용자 가시 placeholder 텍스트 표준 의무 (v49.64 추가, P334 근본)

**원칙**: 모든 사용자 가시 "대기 중" 상태 placeholder는 "수신 대기" (incoming) / "수집 대기" (collecting) 표준 사용. "계산 중" / "로딩 중" / "분석 중" 금지.

**근거 (P334)**: v49.62~v49.63 Codex 통합 시 11곳 loading copy 정규화 누락 → "계산 중 99곳 / 로딩 중 85곳"이 페이지 곳곳에 영구 잔존 → 사용자가 "데이터 미수신"인지 "오류"인지 구분 불가 + getMarketCurrentnessAudit 영구 미반영 sink 자동 탐지 회피.

**표준 매핑**:
- "계산 중" / "계산중" → "수신 대기" (값을 받아 계산 대기)
- "로딩 중" / "로딩중" → "수집 대기" (소스에서 수집 대기)
- "분석 중" / "분석중" → "수신 대기" 또는 "심리 입력 수신 대기" / "거시 입력 수신 대기" (분석 대상 데이터 대기)
- "뉴스 로딩 중" → "뉴스 수집 중"

**검증**: `AIO.runTests()` T463 (home/sentiment/aaii/macro/temp 5 sink 표준 검증) + T466 (영구 loading 0건) + T467 (sentiment badge "분석 중" 부재 + "수신 대기" 존재).

**위반 시**: 사용자가 페이지 진입 시 영구 placeholder 잔존으로 데이터 미수신 인지 못함 + 자동 audit이 stale sink 탐지 회피.

**Lineage 보완**: placeholder 텍스트 변경과 함께 `data-operational-use="reference-only"` + `data-source-kind="unavailable"` 마킹 권장 (R114 통합 검증과 양립).

---

## R114. 외부 워크트리 통합 시 함수 존재 vs 페이지 실행 검증 분리 의무 (v49.63 추가, P331 근본)

**원칙**: Codex/다른 워크트리에서 통합 시 (1) `typeof fn === 'function'` 단위 검증 + (2) 실제 페이지가 fn을 호출하고 DOM이 변경되는지 통합 검증 양쪽 모두 필수.

**근거 (P331)**: v49.62 통합 시 4개 영역 함수 존재만 cherry-pick (T451~T454: "함수가 정의되었다"). Codex의 실제 의도 (T412~T429: "페이지가 실제로 함수를 호출하고 DOM이 변경된다")의 35%를 누락. 회귀 방지 가치 5배 차이.

**구조**:
- 단위 검증: `_assert('T_xxx_defined: fn 정의', typeof window.xxx === 'function')`
- 통합 검증: `_assert('T_xxx_integrated: page가 fn 호출', /xxx\(\)/.test(window.targetPageInit.toString()))`
- DOM 검증: `_assert('T_xxx_dom: element 속성 변경', el.getAttribute('data-source-kind') === 'unavailable')`

**검증**: AIO.runTests() 통과 시 단위 + 통합 + DOM 3중 보장.

**위반 시**: 외부 워크트리 변경의 35% 누락 같은 사고 재발 (v49.62 → v49.63 정직 시정 선례).

---

## R112. 모든 CHAT_CONTEXTS는 _getChatRules() 호출 의무 (v49.59 추가, P327 근본)

**원칙**: 14개 CHAT_CONTEXTS의 모든 system() 함수는 마지막에 `_getChatRules()` 호출 + ABSOLUTE RULES 일관성 유지 의무.

**근거 (P327)**: 14 CHAT_CONTEXTS 정합성 자동 검증 부재로 신규 페이지 추가 시 _getChatRules 호출 누락 회귀 미감지.

**구조**: `AIO.auditAllChatContexts()` 자동 검증
- system() 호출 성공 여부 + 길이 + dynamic injection 패턴 (`_currentTickerId/_liveData/DATA_SNAPSHOT`) + `_getChatRules` 호출 여부 검증
- 사이드바 audit 위젯에 chatContexts row 자동 노출 (registry/web_search/freshness/chatContexts 4축)

**검증**: `AIO.auditAllChatContexts().validCount === totalContexts`.

**위반 시**: 사용자가 일부 페이지에서 환각 차단 규칙 없는 답변 받음.

---

## R110. signal/breadth/sentiment context는 라이브 수치 자동 주입 의무 (v49.59 추가, P324 근본)

**원칙**: signal context는 `AIO_ACTION_RULES` 동적 평가, breadth context는 `AIO.diagnoseBreadthConsensus()` 결과 + DATA_SNAPSHOT 폴백, sentiment context는 6 지표 Tail Risk Board (VIX/VVIX/SKEW/MOVE/VIX9D/3M structure/AAII/PCR/HY OAS) 동적 주입 의무.

**근거 (P324)**: 이전 정의는 프레임만 있고 실제 수치 부재 → "현재 시그널 점수?" 질문에 환각 답변.

**구조**: 각 context system() 함수 안에 IIFE 또는 직접 변수 정의:
```js
// signal
var ar = window.AIO_ACTION_RULES;
if (vix >= 30) lines += '⛔ EXIT_OR_HEDGE';
// breadth
var consensus = window.AIO.diagnoseBreadthConsensus();
// sentiment
var vvix = ld['^VVIX'].price || snap.vvix;
```

**검증**: `CHAT_CONTEXTS.signal.system().includes('실시간 매매 액션 가이드')`.

**위반 시**: 사용자가 페이지 전용 채팅에서 추상적 답변만 받음.

---

## R109. fxbond 한국 금리 스냅샷 시점 명시 의무 (v49.59 추가, P326 근본)

**원칙**: 한국 금리 (krBond3y/krBond10y/bokRate)는 정기 발표 (BOK MPC/KRX) 스냅샷이므로 채팅 컨텍스트에서 "[스냅샷: 날짜 — 실시간 fetch 없음]" 마커 의무.

**근거 (P326)**: 사용자가 "지금 한국 10Y 금리?" 질문 시 → 미국 10Y만 실시간, 한국은 정기 발표 스냅샷인데 시점 불명확하여 환각 위험.

**구조**: fxbond context system()에 IIFE — `snap.built || lastUpdated` 시점 명시 + BOK 기준금리 + 3Y/10Y 동적 주입 + "한국 금리는 정기 발표 스냅샷. '현재' 답변 시 스냅샷 시점 명시 의무" 가이드.

**검증**: `CHAT_CONTEXTS.fxbond.system().includes('[스냅샷:')`.

**위반 시**: AI가 실시간으로 인식하여 stale 한국 금리 답변.

---

## R108. Audit 함수 추가 시 사이드바 위젯에도 노출 의무 (v49.58 추가, P322 근본)

**원칙**: 신규 `AIO.get*Audit()` / `AIO.assert*()` 함수 추가 시 핵심 3축 (정합성/가용성/신선도)에 해당하면 사이드바 audit 위젯에도 노출 의무.

**근거 (P322)**: 11개 audit 함수가 콘솔 전용으로만 노출되어 사용자 자가 진단 불가. 시스템 건강도 확인을 위해 F12 → Console 진입 필요 — UX 저하.

**구조**:
- 사이드바 `#aio-audit-widget-content` 안에 `[data-audit-key="X"]` row 추가
- `_aioRefreshAuditWidget()`에 신규 함수 호출 + DOM 갱신 분기 추가
- 5분 자동 + 토글 변경 시 즉시 + 사용자 수동 ↻ 버튼

**검증**: 사이드바에서 시스템 건강도 3개 라인 가시 (`✓ ticker 173/543 (32%)` / `🔍 web_search ON · 호출 0회` / `✓ 컨텍스트 신선도 96%`)

**위반 시**: audit 함수가 추가됐는데 사용자가 그 존재를 모름.

---

## R107. 채팅 fetch는 반드시 Promise.allSettled + 개별 timeout 의무 (v49.58 추가, P321 근본)

**원칙**: `_fetchTickerDataForChat` 또는 채팅 system 프롬프트에 데이터를 주입하는 모든 fetch는 (1) `Promise.allSettled` 패턴으로 일부 실패 허용 (2) `_withTimeout(promise, 2500, null)` 개별 timeout 의무.

**근거 (P321)**: 종목당 11+ fetch 병렬 시 일부 hang (Yahoo CORS 차단/SEC EDGAR 응답 지연/Finnhub rate limit) → 전체 응답 30초 대기. 사용자 경험 저하.

**구조**: `_withTimeout(promise, ms, fallback)` — Promise.race로 timeout 후 fallback 반환. Promise.allSettled로 array of {status, value/reason} 반환.

```js
var secPromise = _withTimeout(window.AIO.fetchSECBusinessDescription(t).catch(()=>null), 2500, null);
```

**검증**: 종목 분석 응답 시간 ≤ 4초.

**위반 시**: 하나의 fetch가 hang하면 전체 채팅 응답 hang.

---

## R106. 새 페이지 CHAT_CONTEXTS 신규 시 window._currentXxxId 자동 주입 의무 (v49.58 추가, P319 근본)

**원칙**: 새 페이지에 채팅 컨텍스트를 정의할 때 (1) 활성 식별자 (`_currentTickerId` / `_currentThemeId` / `_currentXxxId`) 전역 마커 도입 (2) `showXxx` / `showPage` 진입 hook에서 마커 자동 set (3) system() IIFE가 마커 기반 라이브 데이터 주입.

**근거 (P319)**: ticker 페이지가 14개 CHAT_CONTEXTS 중 가장 자주 사용되는데 컨텍스트 자체가 부재. v49.57 R105 (themes _currentThemeId 패턴)이 ticker/fundamental/options에 미확산.

**구조**:
- 마커: `window._currentTickerId = ticker;` (showTicker / fundamentalSearch 진입 시)
- system(): `var ticker = window._currentTickerId || null;` 후 라이브 가격 + 분석 컨텍스트 동적 주입
- showPage hook에서 페이지 전환 시 적절한 clear (themes 계열 진입 시 _currentTickerId clear 등)

**검증**: ticker 페이지 진입 → `window._currentTickerId === sym`. 채팅 system 프롬프트에 자동 ticker block 포함.

**위반 시**: 사용자가 보고 있는 페이지를 채팅이 인식 못하고 일반 답변만 함.

---

## R105. 테마 페이지 진입 시 채팅 컨텍스트에 활성 테마 ticker 라이브 가격 주입 의무 (v49.57 추가, P316/P317 근본)

**원칙**: themes/theme-detail 페이지 진입 시 `window._currentThemeId`를 set하여 CHAT_CONTEXTS의 `themes`/`theme-detail` system 프롬프트가 자동으로 해당 테마의 ticker 라이브 가격을 주입.

**근거 (P316)**: 테마 채팅에서 AI가 학습 데이터로 가격/실적 환각. 활성 테마를 시스템 프롬프트가 인지하지 못함.

**구조**:
- `showTheme(themeId)` 함수 진입 시 `window._currentThemeId = themeId;` 즉시 설정
- `CHAT_CONTEXTS.themes.system()` / `CHAT_CONTEXTS['theme-detail'].system()` 함수가 IIFE로 active theme 평면 ticker 배열 `aliases[themeId]` 조회 + `window._liveData[t].price` 라이브 주입
- 라이브 가격이 fetch 안 되면 "ABSOLUTE RULES 5조 적용" 안내만 표시

**검증**: `showTheme('ai'); CHAT_CONTEXTS.themes.system().includes('현재 테마: ai')` === true

---

## R104. _fetchTickerDataForChat 신규 fetch 추가 시 ABSOLUTE RULES 동기 확장 의무 (v49.57 추가, P317 근본)

**원칙**: `_fetchTickerDataForChat`에 신규 데이터 블록 라벨([SEC 8-K]/[News]/[Insider]/[13F] 등) 추가 시 system 프롬프트 말미 ABSOLUTE RULES에도 해당 라벨의 사용 가이드/환각 차단 조항을 동기 추가.

**근거 (P317)**: v49.34에서 [SEC 10-K]/[Wikipedia] 추가했으나 ABSOLUTE RULES에 가이드가 없어 AI가 라벨을 무시하거나 다른 데이터로 답변. 라벨이 존재해도 AI에게 "이걸 우선 인용해야 함"이 명시 안 되면 학습 데이터 환각.

**구조**:
- 라벨 추가: `results.push('  [신규 라벨] ...')` (chat.js _fetchTickerDataForChat)
- ABSOLUTE RULES 갱신: "N조. 위 [신규 라벨] 블록 데이터만 인용. 학습 데이터 환각 금지" (chat.js 마지막 return 문)
- 분석 분야 출처 매핑 갱신: "- 신규 분야: [신규 라벨] 인용" (R90 매핑 표)

**검증**: `(_fetchTickerDataForChat.toString()).match(/\[SEC 8-K\]/)` && (마지막 return 문에 5조 포함)

---

## R103. SCR_KEYWORD_ALIASES 신규 테마 추가 시 AIO_TICKER_NAME_REGISTRY 등록 의무 (v49.57 추가, P316 근본)

**원칙**: `js/aio-data.js` SCR_KEYWORD_ALIASES에 새 테마/ticker 추가 시 **반드시** `js/aio-core.js` AIO_TICKER_NAME_REGISTRY.entries에도 한글/영문/별명 alias와 함께 등록.

**근거 (P316)**: v49.32에서 47 entries만 등록. 이후 v49.33~v49.56에서 SCR_KEYWORD_ALIASES 259 테마 / 543 ticker 추가했으나 REGISTRY 동기화 안 됨 → 사용자가 "바이킹 테라퓨틱스 분석해줘" 입력 시 한글 → 티커 변환 실패 → AI가 다른 종목 답변하거나 거부.

**구조**: `AIO.assertTickerRegistryCompleteness()` 자동 audit
- SCR_KEYWORD_ALIASES 모든 ticker 수집 (중복 제거)
- REGISTRY.entries와 cross-check
- 미등록 ticker 30개까지 + 어느 테마에서 발견됐는지 리포트
- coveragePct 반환

**검증**: 정기 콘솔 `AIO.assertTickerRegistryCompleteness().coveragePct >= 80` (커버리지 80% 이상)

**위반 시**: 새 테마 추가했는데 한글 검색 안 됨. AI가 종목 인식 못함.

---

## R102. 페이지 cell-level audit 의무 (v49.48 추가, P318 근본)

**원칙**: sub-section enumerate(라인 범위 + 카테고리 라벨)에 그치지 않고, 페이지의 모든 카드/표/임계값 cell-level **값/색상/placeholder/key** 검증 의무.

**근거 (P318)**: 사용자 "각각의 페이지에서 모든 내용과 데이터 세밀하게 쪼개서 확인" 요구. v49.42/v49.47 sub-section enumerate만으로는 카드 내부 검증 부족 — placeholder 영구 표시, 색상 vs 임계값 모순, snap-key 등록 누락이 sub-section 단위로 잡히지 않음.

**구조**: `AIO.getCellLevelDataAudit(pageId)`
- 페이지의 모든 `.aio-card / .aio-metric-value / .stk-item / td[data-snap] / td[data-live-price] / [data-threshold-key] / [data-snap] / [data-live-price]` 요소 수집
- 각 cell의 값/색상/snap-key/live-key/threshold-key/archive 상태 캡쳐
- placeholder (—/.../로딩 등) 자동 분류

**검증**: `AIO.getCellLevelDataAudit('home').placeholderCount === 0`

**위반 시**: 사용자가 영구 placeholder를 보거나 임계값과 색상 모순 발견.

---

## R101. DOM ticker vs LIVE_SYMBOLS coverage 의무 (v49.48 추가, P317 근본)

**원칙**: 페이지에 `[data-live-price="TICKER"]` 추가 시 **반드시** `LIVE_SYMBOLS`에 등록.

**근거 (P317/P315)**: theme-detail의 `XSD` ticker가 LIVE_SYMBOLS 미등록 상태로 인해 영구 `—` placeholder. P315 시정(LIVE_SYMBOLS 등록)했으나 자동 탐지 audit 부재로 사전 차단 못함.

**구조**: `AIO.getLiveSymbolsCoverageAudit()`
- 모든 `[data-live-price]` ticker 수집
- `LIVE_SYMBOLS` Set과 비교
- 미등록 ticker (template placeholder `${sym}` 제외, `data-aio-archive` 제외) 보고

**검증**: `AIO.getLiveSymbolsCoverageAudit().issueCount === 0` + `getAutoOpsReadiness().liveSymbolsCoverage.issueCount === 0`

**위반 시**: 사용자가 페이지에서 영구 `—` placeholder 표시.

---

## R75 보강 (v49.48, P316 근본 — Jensen hardcoded → 일반화)

**기존 R75 (v49.30)**: 정적 콘텐츠 lifecycle 메타 부착 의무 (`createdAt` + `archiveAfterDays` + `replaceAfterDays`).

**v49.48 보강**: lifecycle 콘텐츠는 페이지에 `data-lifecycle-id="ID"` 마커 부착 + `[id$="-stale-days"]` 또는 `.lifecycle-stale-days` span 신설. `_aioStaticContentLifecycleHook()`이 모든 페이지 진입 시 자동 갱신.

**근거 (P316)**: v49.42 P304 시정 후 Jensen 인터뷰 `#jensen-interview-stale-days` span을 채우는 hook이 페이지 진입 시 호출되지 않아 v49.47 P314까지 영구 "경과 계산중" 표시. v49.47에서 Jensen 전용 hardcoded hook 추가했으나 `briefing-week-may-4-10` / `kr-export-2026-02` 같은 다른 LIFECYCLE 항목은 여전히 갱신 안 됨.

**시정**: v49.48 P316 — `_aioStaticContentLifecycleHook()` 일반화 + `_aioPageBus 'aio:pageShown'` 모든 페이지 자동 호출.

**위반 시**: STATIC_CONTENT_LIFECYCLE 등록 콘텐츠가 페이지에 표시되지만 동적 갱신 안 됨 (영구 stale label).

---

## R100. API 키 저장 2중화 + 백업/복원 UX 의무 (v49.45 추가, P312 근본)

**원칙**: API 키 저장은 **반드시** 다음 모두 만족:
1. **2중 이상 저장소** (localStorage + IndexedDB) — 한 곳 손실 시 다른 곳에서 복원 가능
2. **사용자 명시 export/import 함수** — JSON 파일 다운로드/복원
3. **자동 복원 함수** — localStorage 비어있을 시 IndexedDB에서 silent 복구

**근거 (P312)**: P310/P311 cascading 시 일부 사용자가 콘솔 에러 + 데이터 미수신 보고 캐시 클리어 시도 → localStorage 일괄 삭제 → API 키 동반 손실. 백업/복원 UX 없으면 11개 키 모두 재입력 필요.

**구조**:
- `_aioIdbBackupKeys(snapshot)` / `_aioIdbRestoreKeys()` — IndexedDB I/O
- `_aioCollectKeySnapshot()` — 현재 키 수집
- `_aioAutoBackupKeys()` — `_saveApiKey` 호출 시 + 5분마다 자동 mirror
- `AIO.exportApiKeys({masked})` — JSON 다운로드
- `AIO.importApiKeys(jsonString)` — 복원
- `AIO.recoverApiKeysFromIdb()` — 자동 복원

**검증**: 신규 API 키 종류 추가 시 `_AIO_SENSITIVE_KEYS`에 등록 + 위 함수들 자동 mirror.

**위반 시**: 사용자가 캐시 클리어 후 모든 키 재입력 필요. UX 마찰 + 사용자 이탈.

---

## R99. SW SHELL_ASSETS 자산 무결성 자동 검증 (v49.44 추가, P310 근본)

**원칙**: `sw.js`의 `SHELL_ASSETS` 배열에 등록된 모든 자산은 **반드시** 실제 파일로 존재 (HTTP 200 OK 응답).

**근거 (P310)**: 사용자가 GitHub UI에서 `manifest.json` 삭제 → `sw.js` `SHELL_ASSETS`에 `'./manifest.json'` 잔존 → SW install 시 `cache.add('./manifest.json')` 404 → 콘솔 에러 산재 + 사용자 캐시 클리어 시도 시 localStorage(API 키) 동시 손실.

**구조**: `AIO.getShellAssetIntegrityAudit()` (async)
- `sw.js` 본문에서 `SHELL_ASSETS` 추출
- 각 로컬 자산을 `fetch(url, {cache:'no-store'})` 호출 + status 검증
- 외부 CDN은 검증 제외 (별도 가용성)

**검증**: `(await AIO.getShellAssetIntegrityAudit()).issueCount === 0`

**위반 시**: 404 자산이 있으면 missing 배열 보고 → 즉시 `sw.js` SHELL_ASSETS에서 제거하거나 파일 복원.

---

## R97. data-snap 키 vs DATA_SNAPSHOT 시드 정합 (v49.41 추가, P301 근본)

**원칙**: 페이지 DOM에 `[data-snap="key"]` 추가 시 **반드시** `window.DATA_SNAPSHOT` 최상위 또는 `_fallback`에 대응 시드 필드 등록.

**근거 (P301/P299)**: `S.breadth5sma || 68` 같은 인라인 폴백 패턴이 시드 없이도 정상 동작 — R74 `assertSnapshotInlineMatch`는 시드가 있어야 비교 가능 → 시드 부재 silent pass. 실시간 fetch 경로가 `DATA_SNAPSHOT.key = X` set해도 시드가 없으면 다음 fetch 사이클에 다시 폴백값으로 회귀할 위험.

**구조**: `AIO.getStaticSeedFallbackAudit()`
- 페이지의 모든 `[data-snap]` 키 수집
- 각 키에 대응하는 `DATA_SNAPSHOT[key]` / `DATA_SNAPSHOT[toCamel(key)]` / `DATA_SNAPSHOT[toSnake(key)]` / `_fallback[key]` 검사
- 미등록 키 보고

**검증**: `getStaticSeedFallbackAudit().issueCount === 0` + `getAutoOpsReadiness().staticSeedFallback.issueCount === 0`

**위반 시**: 실시간 갱신이 외관상 정상이지만 정적 폴백값이 영원히 표시 (sticky stale).

## R125. Second/third-pass text, function, and data meaning audit required (v49.67 added, P359 root prevention)

**Rule**: A DOM surface inventory is not enough. After every page/overlay is counted, the app must run a deeper audit over meaning-bearing text, delegated input handlers, control labels, and data-sink explanation coverage.

**Required coverage**:
- `AIO.getDeepReviewAudit()` must scan visible/user-facing text snippets for placeholder/loading text, stale live-like tokens, dense unexplained jargon, and console-only hints.
- `data-on-enter` and `data-on-input` handlers must be verified separately from `data-action`.
- Buttons/role buttons must have visible text, `aria-label`, or `title`.
- Pages with many data sinks must have page-level lineage markers or explainers.
- Sidebar, AutoOps, deployment gate, and regression tests must expose the result.

**Evidence (P359)**: User asked whether the work went beyond first pass into 2nd/3rd-pass review and whether all text/function/content had been checked. P358 covered surfaces, but not text/function/data meaning layers.

**Validation**: `AIO.runTests()` T515-T520.

---

## R124. DOM-first full surface audit required (v49.67 added, P358 root prevention)

**Rule**: A page review is not complete until the app can audit the actual rendered DOM, not only registry entries or narrative notes.

**Required coverage**:
- `AIO.getFullSurfaceAudit()` must walk every `.page[id]` plus registered non-route overlays and return per-page counts for headings, sections/cards, data sinks, controls, tables, charts, explainers, visible loading text, brief coverage, and sequential registry coverage.
- The sidebar audit widget must include `[data-audit-key="fullSurface"]` so non-console users can see the result.
- `AIO.getAutoOpsReadiness()` and `AIO.getDeploymentGateAudit()` must include the full-surface result.
- Regression tests must verify API shape, all DOM page coverage, sidebar row, AutoOps integration, deployment gate integration, and visible loading text count.

**Evidence (P358)**: User challenged that the prior work looked like only a first-pass review. The previous `getPageUXAudit()` used `AIO_PAGE_BRIEFS` as its starting point, so it did not prove every actual page surface was inventoried.

**Validation**: `AIO.runTests()` T508-T514.

---

---

## R167. innerHTML 삽입 시 모든 사용자/외부 변수에 escHtml() 의무 + 정규식 메타문자 이스케이프 (v49.81 added, P433~P435 root prevention)

**Rule**: innerHTML/innerHTMLAssignment에 삽입되는 모든 사용자 입력, API 응답, 동적 라벨, ticker, 칩 등 변수는 `escHtml()` 래핑 의무. 동적 정규식(`new RegExp(userInput, ...)`) 생성 시 메타문자 이스케이프 의무.

**Required**:
- 사용자 입력 또는 외부 데이터를 직접 innerHTML/`+` concat으로 삽입 금지.
- HTML attribute 값에 데이터 삽입 시 `escHtml(x).replace(/'/g, '&#39;')` 표준 패턴 사용. 백슬래시 이스케이프 금지.
- `new RegExp(userInput, ...)` 호출 시 `userInput.replace(/[.*+?^${}()|[\]\]/g, '\$&')` 사전 이스케이프.

**Evidence (P433~P435)**: VsCode 작업본 v49.80 baseline 위 검토 결과 10+ 위치 escHtml 누락 + `_aioGuideSearch` 정규식 인젝션 가능 + chip safeQ 백슬래시 이스케이프 비효율 발견.

**Validation**: grep `innerHTML.*\+.*[A-Za-z]` 결과 사용자 데이터 변수가 escHtml 없이 삽입된 경우 0건.

---

## R168. vendor-prefix CSS 속성은 표준 속성과 동시 선언 + inline hover: 금지 (v49.81 added, P436~P437 root prevention)

**Rule**: CSS vendor-prefix 속성 사용 시 표준 속성과 동시 선언. inline `style` 속성에 `hover:`/`focus:` 등 pseudo-class 작성 금지 (의미 없음).

**Required**:
- `-webkit-line-clamp` → `-webkit-line-clamp` + `line-clamp` 동시.
- inline `style="...hover:..."` 패턴 금지. hover 효과는 stylesheet에서 `.class:hover` 또는 `:hover { ... }` 로 정의.
- 빈 CSS 규칙 (`.selector { /* */ }`) 정리.

**Evidence (P436~P437)**: line-clamp 표준 누락 3곳 + news-refresh-btn inline hover: 무효 사용 + 옛 dead CSS 규칙 잔존.

**Validation**: grep `style=.*hover:` 결과 0건 + `-webkit-line-clamp:[^}]*}` 옆에 표준 line-clamp 없는 경우 0건.

---

## R169. 동일 함수 내 var/const/let 이름 충돌 금지 + 신규 코드 let/const 우선 (v49.81 added, P438 root prevention, P311 패턴 재발 방지)

**Rule**: 동일 함수 스코프 내에 같은 이름의 `var`/`const`/`let` 선언 금지. 신규 코드는 `let`/`const` 우선 사용.

**Reason**: `var`는 function-scoped + hoisted. 같은 함수 내 어딘가 `const ld` + 다른 곳 `var ld` 선언 시 SyntaxError (P311 v49.44 hotfix 사례 — aio-data.js 전체 parse 실패 + 데이터 파이프라인 마비).

**Required**:
- 신규 변수 선언은 `let` 또는 `const` 사용.
- 기존 `var`는 같은 함수 내 const/let 충돌 가능성 확인 후 `let`으로 점진 마이그.
- `AIO.getVarHoistConflictAudit()` (v49.44 R98 기존) 자동 검증.

**Evidence (P438)**: VsCode 작업본에서 30+ 함수 `var ld` → `let ld` 일괄 전환 — P311 같은 SyntaxError 재발 차단.

**Validation**: `AIO.getVarHoistConflictAudit().conflicts.length === 0`.

---

## R170. 외부 작업본 통합 시 KR/외국 ticker 매핑 다중 위치 cross-check 의무 (v49.82 added, P439~P441 root prevention)

**Rule**: KR/외국 ticker 회사명 매핑 정정 시 모든 데이터 구조 동기 정정 의무. 외부 작업본(Codex/VsCode 등) 통합 시 cross-check audit 실행 후 0 conflict 검증.

**Required**:
- `AIO.assertKrTickerMappingAudit()` 실행 결과 critical 충돌 0건 확인 후에만 commit.
- 변경 대상 데이터 구조 (최소): `SCREENER_DB` (js/aio-data.js) + `AIO_TICKER_NAME_REGISTRY` (js/aio-core.js) + `KR_STOCK_DB` (index.html) + `LIVE_SYMBOLS` (js/aio-data.js) + `KNOWN_TICKERS`.
- WebSearch verified known mappings hardcoded check: 178320=서진시스템, 108320=LX세미콘, 108490=로보티즈, 090360=로보스타, 277810=레인보우로보틱스, 454910=두산로보틱스, 005930=삼성전자, 000660=SK하이닉스.

**Evidence (P439~P441)**: Codex v49.80가 `KR_STOCK_DB` 178320만 정정하고 `SCREENER_DB`는 누락. AI 채팅이 "로보스타"로 답변하고 KR 페이지는 "서진시스템" 표기 → 데이터 부정확. 자동 cross-check audit 없으면 silent fail.

**Validation**: `AIO.assertKrTickerMappingAudit().conflicts.filter(c=>c.severity==='critical').length === 0`.

**Pattern 일반화**: 신규 audit 함수 추가 시 (1) audit fn 정의 (2) 사이드바 row 노출 (3) 회귀 T 테스트 3종 셋트 동시 작성.

---

## R172~R178. v49.83 — 기관급 + 직관성 7 규칙 (사용자 백로그 9건 응답)

**R172 — MACRO_CALENDAR auto-advance 의무**: 발표 캘린더 entry는 일자 경과 시 자동 next event compute. `AIO._aioRecomputeMacroCalendar({ dryRun: true })` 사이드바 18축 노출 의무.

**R173 — cross-asset correlation matrix 의무**: 자산 간 30일 rolling Pearson correlation + regime classification 자동 산출. `AIO.computeCrossAssetCorrelation()` `_priceHistory` 활용. 사이드바 16축.

**R174 — AI 답변 정량 비율 측정 의무**: 채팅 답변에서 정량 토큰 비율 7%+ 권장. `AIO.assertQuantitativeRatioAudit()` 자동 측정 + 사이드바 17축. <4% 시 'fail' (정성 과다 환각 위험).

**R175 — earnings call transcript 통합 의무**: 종목 분석 시 FMP /earning_call_transcript 자동 fetch + 시스템 프롬프트 [Earnings Call (Qx YYYY)] 라벨 주입. AlphaSense/Sentieo 대체 무료 옵션.

**R176 — AI 답변 시각 자료 의무**: 답변 종목 detect 시 30일 mini sparkline SVG 자동 인라인 삽입. `_aioBuildSparklineSvg` 활용. 양수 green / 음수 red. 최대 3 종목.

**R177 — 사이드바 audit 일반/개발자 mode 토글 의무**: 18+ audit row metric은 일반 사용자에게 부담. `localStorage.aio_audit_mode = 'simple' | 'detailed'` 토글 의무.

**R178 — audit failure status sticky top + pulse 의무**: ✗ failure rows는 자동 top sort + 빨간 border + 2s pulse animation. ⚠ warn = amber. 위기 시그널 즉각 가시.

**Pattern 일반화 (R170 확장)**: 신규 audit 함수 추가 시 (1) fn 정의 (2) 사이드바 data-audit-key row 노출 (3) 회귀 T 테스트 3종 셋트 (`fn 정의 / status 반환 / 사이드바 DOM`) 동시 작성 의무.

---

## R179. 클라이언트 접속 시 자동운영 모델 — 부팅 로더 명시 + 서버 cron 금지 (v49.88 added, P447 root)

**Rule**: AIO는 GitHub Pages 정적 호스팅 + 개인 API 키(localStorage) 모델이다. 데이터 자동 갱신은 **사용자 브라우저 탭이 열린 동안** REFRESH_SCHEDULE 스케줄러로 수행한다. 이것은 한계가 아니라 의도된 설계다.

**Required**:
- 서버 cron / GitHub Actions schedule로 DATA_SNAPSHOT을 자동 갱신하지 **않는다**. 개인 키를 서버에 둘 수 없고(5명 각자 키), 공유 프록시(Cloudflare) 쿼터만 소진한다.
- 첫 라이브 수신(`aio:liveQuotes`) 전 정적 폴백 구간은 부팅 로더(`#aio-boot-loader`)로 사용자에게 명시한다.
- 스케줄러는 "5명 동시접속 최적화" 지터(±15%) + 첫 실행 랜덤 딜레이를 유지한다 (서버 부하/프록시 쿼터 분산).

**근거 (코드)**: `startDataScheduler` 주석 "5명 동시접속 최적화" · `DATA_APIS` 개인 키 5종 + Cloudflare/Claude 공유 · `visibilitychange` 자동 pause.

**Validation**: `AIO.getRefreshSchedulerAudit()` 태스크별 lastOk · 부팅 로더 T673.

---

## R180. 데이터 lineage 5단계 연결 의무 + 자동 audit (v49.89 added, P450 root)

**Rule**: 모든 핵심 데이터는 source(URL/API) → transport(프록시/타임아웃) → store(검증) → transform(가공) → render(DOM sink) 5단계가 끊김 없이 연결돼야 한다. `AIO.getDataLineageAudit()`로 자동 검증.

**Required**:
- 신규 데이터 추가 시: source 함수 + REFRESH_SCHEDULE 등록(자동 갱신) 또는 명시적 manual 분류 + renderSink(data-live-price/data-snap) DOM 바인딩.
- `getDataLineageAudit().broken === 0` 유지 (connected/gap/manual은 의도된 계층).
- 계층 분류: **auto**(완전 자동 연결) / **gap**(B계층 — 자동화 미구현 정적폴백, 예: breadth %above MA) / **manual**(C계층 — 수동 /data-refresh, 예: CPI/NFP/AAII).
- fetch 함수 lineage 판정 시 catch/폴백 블록까지 전체 읽기 (P449 — 부분 grep 판정 금지).

**근거 (코드 조사 v49.89)**: 13종 데이터 5단계 추적 — 시세/VIX/F&G/PCR/FRED/뉴스/VKOSPI=auto, breadth=gap, CPI 등=manual.

**Validation**: `AIO.getDataLineageAudit().broken === 0` · 사이드바 dataLineage row · T675~T679.

---

## R181. 데이터 검증은 카테고리 + cell-level(개별 sink→source) 둘 다 (v49.90 added, P451 root)

**Rule**: 데이터 lineage 검증은 카테고리(13종 5단계)에 그치지 않고, 화면에 렌더되는 개별 sink(data-live-price/data-snap)가 각각 source(LIVE_SYMBOLS/DATA_SNAPSHOT)에 연결됐는지 cell-level까지 검증한다.

**Required**:
- `getDataLineageAudit().cellLevel.totalOrphans === 0` 유지 (렌더되나 source 없는 끊긴 sink 0).
- 신규 data-live-price ticker는 LIVE_SYMBOLS 등록 또는 derivedLiveKeys 명시. 신규 data-snap key는 DATA_SNAPSHOT 직접 키 / applyDataSnapshot 매핑 / getStaticSeedFallbackAudit aliasMap 중 하나로 연결.
- "구조/카테고리 존재 확인"으로 끝내지 말 것 — 개별 데이터 값까지 source 역추적.

**근거 (v49.90 전수)**: data-live-price 54→LIVE_SYMBOLS 끊김 0 · data-snap 59→DATA_SNAPSHOT 끊김 0 (113 sink orphan 0).

**Validation**: `AIO.getDataLineageAudit().cellLevel.totalOrphans === 0` · T680.

---

## R182. cell-level은 연결 + 값 정확성 둘 다 / 텍스트 수치는 동적 참조 (v49.91 added, P452 root)

**Rule**: cell-level 데이터 검증은 sink-to-source 연결(orphan 0)에 그치지 않고, 주요 시세/거시 지표의 실제 값이 외부 실측과 일치하는지 확인한다. 텍스트/해설/CHAT_CONTEXTS 안의 수치는 DATA_SNAPSHOT 동적 참조를 우선하고 하드코딩을 금지한다.

**Required**:
- 연결 검증(getDataLineageAudit cellLevel orphan 0)은 "데이터 있음"을 보장하나 "값 정확"은 보장 못함 — /data-refresh로 주요 지표(CPI/PCE/NFP/시세/금리) 외부 실측 대조 주기 필수.
- 거시 지표는 발표 묶음 단위로 갱신 (CPI 갱신 시 PCE도 — v49.86 PCE 누락 재발 방지).
- 텍스트 안 수치(`SKEW 141.86` 등 하드코딩)는 `(DATA_SNAPSHOT.skew || '—')` 동적 참조로 전환. 폴백값도 최신 시드와 정합.

**근거 (P452)**: PCE 2.7→3.8 (1%p+ stale) — 연결은 정상이었으나 값이 3개월 stale. sentiment Tail Risk Board 3/30 하드코딩(SKEW 141.86) 잔존.

**Validation**: /data-refresh 주요 지표 실측 대조 · CHAT_CONTEXTS 하드코딩 수치 grep 0 (DATA_SNAPSHOT 참조 외).

---

## R183. WebSearch 수치는 지표별 정상 band 검증 후 수용 (v49.92 added, P453 root)

**Rule**: WebSearch/WebFetch가 반환한 수치를 데이터로 수용하기 전, 해당 지표의 상식적 정상 범위(sanity band)와 대조한다. 범위 이탈 시 오류 의심 → 재확인 또는 보수적 추정.

**지표별 sanity band**:
- VKOSPI / VIX: 9~40 (40+ = 위기, 검증 필수) · VVIX: 70~150 · MOVE: 50~180 · SKEW: 110~170
- PE: 5~60 · PBR: 0.3~15 · CPI/PCE YoY: -2~10% · 기준금리: 0~15%
- 지수 일변동 통상 ±5% 이내 (초과 시 이벤트 확인)
- **상관 검증**: VKOSPI ≈ VIX±10 (양립 안 되면 오류). 미국 VIX 15인데 한국 VKOSPI 74 = 명백한 오류.

**근거 (P453)**: VKOSPI 74.02를 WebSearch에서 받아 수용했으나 VIX 15.74와 양립 불가 — band 검증으로 잡았어야 함.

**Validation**: 데이터 갱신 시 band 이탈값 0 · 상관쌍(VKOSPI-VIX 등) 정합.

## R184. 동일 지표가 2개 저장소(DATA_SNAPSHOT 본체 + _fallback 미러)에 존재 시 정합 의무 (v49.96 added, P459 root)

**Rule**: 같은 지표가 `DATA_SNAPSHOT` 본체와 `DATA_SNAPSHOT._fallback`(computeTradingScore/computeMarketHealth가 읽는 미러)에 동시에 존재한다. **한쪽 갱신 시 반드시 다른 쪽도 동기화**한다. 한쪽만 갱신하면 silent drift → 페이지 표시값과 점수 계산값이 어긋남.

**미러 대상 12 키**: fg · fg_uw · vix · pcr · dxy · vvix · move · skew · aaiiBear · breadth5(=breadth5sma) · breadth50(=breadth50sma) · breadth200(=breadth200sma).

**근거 (P459)**: v49.95에서 `move`를 70.9로 갱신하며 `_fallback.move`를 62로 방치 → 점수계산은 62, 표시는 70.9. `pcr`도 본체 0.67 vs `_fallback.pcr` 0.83 불일치. runtime DOM audit(getSnapshotConsistencyAudit)는 applyDataSnapshot 정규화 후라 못 잡음.

**자동 가드**: `AIO.getSnapshotFallbackConsistencyAudit()` — 12 키 3% 허용오차 교차검증 (getAutoOpsReadiness 통합, T686 회귀).

**Validation**: `getSnapshotFallbackConsistencyAudit().issueCount === 0`.

## R185. 재발방지 audit은 pull이 아닌 push — 지속 운영 중 자동 surfacing 의무 (v49.96 added, P461 root)

**Rule**: 새 audit/test를 만들면 "수동 호출 전용(pull)"으로 끝내지 않는다. 지속 운영 중 stale/drift/코드결함이 발생하면 **운영자에게 자동으로 드러나야(push)** 한다. audit이 있어도 아무도 콘솔을 안 두드리면 묻힌다 (P460: KR_STOCK_DB 추출 0 결함이 audit엔 있었으나 운영자가 수동 점검 전엔 못 봄).

**메커니즘**: `_aioAutoSurfaceOps()` — `aio:liveQuotes`(라이브 fetch마다)에 throttle(30분) 연결 → `getAutoOpsReadiness`/`getSnapshotFallbackConsistencyAudit`/`getDataQualityIssueAudit` 자동 실행 → warn 시 `console.warn`(운영 진단) + 사이드바 위젯 badge. 엔드유저 팝업 아님(부하 분산 4초 지연 + try/catch).

**근거 (P461)**: 데이터 fetch는 REFRESH_SCHEDULE로 자동(push)이나 품질/drift audit은 수동(pull)뿐 → 지속운영 재발방지의 마지막 빈칸. pull→push로 메움.

**Validation**: `typeof _aioAutoSurfaceOps === 'function'` + `aio:liveQuotes` 리스너 등록 + T688.

## R186. 첫 접속/새로고침 시 진행률 로더 + 정적 콘텐츠 만료 시 동적 폴스루 의무 (v49.97 added, P462 root)

**Rule (a) 부팅 로더**: 첫 접속·새로고침으로 라이브 데이터 동기화 중일 때, 단순 "수신 중" 배너가 아니라 **핵심 N개 데이터 진행률**(N/total + 진행바 + 도착 항목 체크)을 표시한다. 핵심 시세 도착 후 단시간(4초)+하드캡(15초) 자동 닫기, 느린 소스(FRED/KR)는 백그라운드. `_lastFetch[key]` 타임스탬프 기반.

**Rule (b) 정적 콘텐츠 폴스루**: 정적 큐레이션(HOME_WEEKLY_NEWS 등)이 만료(72h)되면 안내문만 띄우지 말고 **동적 소스(RSS)로 자동 폴스루**한다. 동적 필터 임계값은 **단계적 완화**(90→70→50)로 영구 공백 방지.

**근거 (P462)**: 홈 "핵심 뉴스"가 정적 3건 만료 후 동적 items가 있어도 안내문만 띄우거나 score≥90 필터에 다 걸려 빈 화면 = 사용자 보고 "브리핑/뉴스 부실"의 근본.

**Validation**: 로더 진행률 DOM(`aio-boot-count`/`aio-boot-bar-fill`) + `renderHomeFeed` 단계적 완화(70/50) + T689.

## R200. v50 페이지 계약/데이터 증거/AI 답변/배포 게이트 4원칙 (v50.0 added, P476 root)

R187~R199는 더 이상 개별 패치 목록으로만 운영하지 않는다. 모든 후속 작업은 아래 4개 상위 계약을 통과해야 한다.

1. **페이지 계약**: 21개 route 페이지는 `AIO_PAGE_CONTRACTS`에 pageId/pageType/refreshTasks/symbols/dataSinks/charts/tables/narratives/forms/auditPolicy/decisionUsePolicy를 등록해야 한다. `DATA_REQUIREMENT_PROFILES`, `AIO_PAGE_REFRESH_MAP`, `PAGE_DEEP_AUDIT_SYSTEMS`, sequential audit registry는 이 계약에서 파생되어야 한다.
2. **데이터 증거**: live/snapshot/chart/table/formula/numeric/narrative 항목은 `EvidenceStore`의 evidenceId/sourcePolicy/sourceFamily/value/asOf/freshnessSla/decisionUse/status/remediation을 가져야 한다. `DATA_SNAPSHOT`은 기본적으로 snapshot/reference/historical이며, 매매 판단용 현재 데이터로 사용하려면 verified/current evidence로 승격되어야 한다.
3. **AI 답변**: AI 채팅의 현재 시장·종목 수치와 날짜는 주입된 quote/company/filing/news/technical block 또는 EvidenceStore verified/current 항목만 인용한다. stale/missing/block 상태면 숫자를 만들지 않고 "현재 검증 데이터 없음"으로 답한다. `assertChatResponseAccuracy()`는 `assertChatEvidenceReferences()`까지 함께 수행해야 한다.
4. **배포 게이트**: 배포 판단은 `AIO.runEvidenceDeploymentGate()`가 기준이다. must-pass 최소 조건은 21페이지 contract 존재, critical page block 0, unclassified/needs_evidence 0, source adapter registry 존재, audit registry 실행 가능이다.

## R187. 매매 핵심 페이지(종합 5)는 진입 시 stale하면 즉시 재fetch 의무 (v49.98 added, P463 root)

**Rule**: 실제 매매에 쓰는 종합 5페이지(대시보드/매매시그널/시장폭/투자심리/브리핑)는 스케줄 주기에만 의존하지 않는다. **페이지 진입(`aio:pageShown`) 시 의존 태스크가 stale(½ interval 초과)이면 즉시 강제 재fetch**해 최신 시장을 반영한다.

**매핑** (`AIO_PAGE_REFRESH_MAP`): home→[quotes,sentiment,breadth,news] · signal→[quotes,technicals,breadth] · breadth→[breadth,quotes] · sentiment→[sentiment,vixHistory,quotes] · briefing→[news,quotes,sentiment].

**가드**: fresh면 스킵(불필요 호출 방지) · `cfg._inFlight` 중복 차단 · per-task 30초 디바운스(빠른 페이지 전환 폭주 방지) · `_schedulerPaused`(백그라운드 탭) 존중.

**근거 (P463)**: 스케줄러가 주기(브레드쓰/심리 10분)로만 돌아 페이지 진입 시점에 stale일 수 있음 — 매매 결정에 직접 쓰는 페이지엔 치명적.

**Validation**: `AIO_PAGE_REFRESH_MAP` 5키 + `typeof _aioRefreshPageData === 'function'` + `aio:pageShown` 구독 + `AIO.getPageRefreshCoverageAudit()` + T690~T691.

## R188. 전체 데이터 최신화 진행률은 중앙 refresh state를 단일 진실 원천으로 표시한다 (v49.101 added, P464 root)

**Rule**: 상단 새로고침/전체 최신화 UX는 개별 fetch 호출 결과를 추정하지 않고 `AIO.runScheduledRefresh()`의 `aio:refresh:start/progress/done` 이벤트와 `AIO.getRefreshState()`를 단일 진실 원천으로 사용한다. 사용자는 진행 중 X/Y, 현재 소스, 완료/스킵/확인필요 상태를 볼 수 있어야 한다.

**Required**:
- `globalRefresh()`는 `AIO.forceRefreshAllData()` 또는 `AIO.runScheduledRefresh({forceRefresh:true})` 중앙 경로를 우선 사용한다.
- `data-status-panel`/API dashboard/error writer는 active refresh 중 진행 상태를 덮어쓰지 않는다.
- 뉴스 progress wrapper/bar는 실제 fetch 시작 시 표시되고 소스 진행률에 따라 갱신된다.
- 부트 로더는 quote 단독 수신만으로 5개 데이터 그룹 완료처럼 사라지지 않는다.

**Validation**: `AIO.getRefreshState()` + `aio:refresh:*` 이벤트 + `aio-refresh-progress-layer` + T695~T698.

## R189. 5개 종합 페이지 개별 데이터는 page profile 심볼/태스크 union으로 최신화한다 (v49.102 added, P465 root)

**Rule**: home/signal/breadth/sentiment/briefing의 자동 최신화는 단순 페이지명 매핑이 아니라 `DATA_REQUIREMENT_PROFILES`의 task와 symbol 목록을 refresh run에 전달해야 한다. 페이지 진입, 수동 전체 최신화, visibility resume은 가능한 한 `AIO.runScheduledRefresh()` 중앙 경로를 사용해 실제 task 실행과 UX 진행률이 갈라지지 않게 한다.

**Required**:
- `_aioRefreshPageData(pageId)`는 `_runScheduledTask()` 직접 호출이 아니라 `runScheduledRefresh({keys,pageId,symbols,options})`를 사용한다.
- `quotes` task는 page/profile symbols를 `fetchLiveQuotes()`에 전달한다.
- `technicals` task는 활성 입력 심볼뿐 아니라 profile symbols를 우선 후보로 사용한다.
- 5개 종합 페이지 전체 수동 최신화는 union task + union symbols를 사용한다.
- 운영 감사는 task/symbol/data-sink/chart/missing-live 샘플을 페이지별로 반환한다.

**Validation**: `AIO.refreshAllComprehensivePages()` + `AIO.getComprehensivePageDataFreshnessAudit()` + T699~T700.

## R190. 보이는 차트/지표/시세/수치/수식/텍스트 표면은 최신화 감사에 자동 편입한다 (v49.103 added, P466 root)

**Rule**: home/signal/breadth/sentiment/briefing의 실제 DOM에 추가되는 live price/change/percent/field sink는 별도 profile 수동 등록이 늦어져도 `collectPageDataSymbols()`가 자동 수집해 quote refresh symbol 범위에 포함해야 한다. 최신화 UX가 "데이터 갱신"을 표시할 때 실제 화면에 보이는 라이브 시세/지표 sink가 refresh scope 밖에 남아 있으면 안 된다.

**Required**:
- `[data-live-price]`, `[data-live-chg]`, `[data-live-pct]`, `[data-live-field]` DOM sink는 `_aioCollectDomLiveSymbols(pageId)`를 통해 page profile symbol union에 합류한다.
- 5개 종합 페이지 감사는 task/symbol뿐 아니라 live sink, snap key, chart-like element, formula-like text, static numeric candidate, stale/loading text candidate를 페이지별로 점검한다.
- snap key orphan, live key profile 누락, id 없는 chart-like element, stale/loading text 후보는 운영 감사 결과에 issues/samples로 노출한다.
- 새 UI 숫자/수식/차트/텍스트를 추가할 때 `AIO.getComprehensiveSurfaceIntegrityAudit()` 결과가 새 표면을 감지하는지 확인한다.

**Validation**: `AIO.getComprehensiveSurfaceIntegrityAudit()` + `AIO.getComprehensivePageDataFreshnessAudit().surfaceIntegrity` + T701~T702.

## R191. AI 채팅의 종목 답변은 strict preflight 후 최신 시세/기업 데이터 블록만 인용한다 (v49.104 added, P467 root)

**Rule**: 사용자가 주식 종목을 묻는 모든 AI 채팅 답변은 LLM 호출 전에 `AIO.ensureFreshChatAnswerData()`를 통과해야 한다. 종목 관련 가격, 시총, 밸류에이션, 실적, 목표가, 기업 분석 수치는 preflight 이후 주입된 quote/company-analysis 데이터 블록에 있는 값만 인용하고, 5분 cache hit나 학습 데이터 추정값으로 대체하면 안 된다.

**Required**:
- `chatSend()`와 `chatSendUnified()` 양쪽 모두 종목 감지 후 `ensureFreshChatAnswerData({forceFresh:true})`를 우선 호출한다.
- 종목 질문은 `_chatTickerCache` 해당 종목을 무효화하고 `_fetchTickerDataForChat(..., {forceFresh:true, reason:'chat-answer'})`로 fresh data block을 재생성한다.
- preflight는 중앙 `runScheduledRefresh({keys,symbols,reason,forceRefresh})` 경로를 사용하고, 필요한 경우 `dynamicTickerLookup()`으로 질문 ticker를 개별 재조회한다.
- 단일 종목 질문은 기본적으로 기업 심층 데이터 경로를 타야 한다. FMP/Finnhub/SEC/Naver 등 외부 데이터가 없으면 없는 항목을 명시하고 숫자를 추정하지 않는다.
- system prompt에는 ticker별 quote 상태/age/source를 포함한 `AI Chat Freshness Preflight` 블록을 주입한다.

**Validation**: `AIO.ensureFreshChatAnswerData()` + `AIO.getChatAnswerFreshnessAudit()` + `_fetchTickerDataForChat(...,{forceFresh:true})` + T703~T706.

## R192. `forceFresh` for AI stock answers must bypass every local freshness shortcut (v49.105 added, P468 root)

**Rule**: For stock-related AI answers, `forceFresh:true` is not a UI label and not a soft hint. It must bypass `_chatTickerCache`, bypass `_liveData` immediate cache returns, bypass `ensureFreshDataForUse` minGap throttling, and re-attempt per-ticker quote lookup before the prompt is assembled.

**Required**:
- `dynamicTickerLookup(ticker, {forceFresh:true})` must not return the `_liveData` cache fast path.
- `_fetchTickerDataForChat(..., {forceFresh:true, reason:'chat-answer'})` must call `dynamicTickerLookup(t,{forceFresh:true})` instead of using `_liveData` directly.
- `ensureFreshDataForUse({forceFresh:true})` must not return `recently_refreshed` only because the same task ran within the minGap window.
- Regression tests must cover all three bypass paths.

**Validation**: T707 plus T703/T704.

## R193. AI chat must vary answer structure by intent and use only injected current data for current claims (v49.106 added, P469 root)

**Rule**: AI chat answers must not collapse every user question into the same generic stock-analysis template. The prompt must classify the requested answer family and choose the appropriate response mode. Current market/company facts must come from injected data blocks, not Claude/model memory.

**Required**:
- The prompt must support at least these answer modes: decision memo, ranked comparison, valuation memo, earnings review, technical setup, portfolio risk note, beginner explanation, and balanced analysis.
- Current price, market cap, earnings, guidance, analyst target, rating, news, filing, macro release, and recent-date claims must cite or derive from injected live/FMP/SEC/Naver/Finnhub/news/web-search/DATA_SNAPSHOT blocks.
- If a required axis is missing or stale, the answer must say `데이터 미수집/확인 불가` or equivalent and omit the number instead of filling gaps from model training data.
- Both `chatSend()` and `chatSendUnified()` must inject the same answer coverage/current-data contract.

**Validation**: T708~T710.

## R194. Critical-10 refresh success must be followed by DOM binding verification (v49.107 added, P470 root)

**Rule**: "Data refreshed" is true only after the refresh task runs and the visible/live DOM sinks have been re-bound from the latest data store. The US operating scope is the Critical-10 set: comprehensive 5 pages plus market-analysis 5 pages.

**Required**:
- `AIO_PAGE_REFRESH_MAP` must include `home`, `signal`, `breadth`, `sentiment`, `briefing`, `technical`, `macro`, `fxbond`, `fundamental`, and `themes`.
- Manual force refresh and critical page refresh must use the Critical-10 symbol union, not only the comprehensive-5 union.
- `getDataRequirementProfile()` must merge DOM live symbols from `[data-live-price]`, `[data-live-chg]`, `[data-live-pct]`, and `[data-live-field]`.
- After quote refresh, `AIO.applyLiveDataToDom()` must re-apply all live price/change/pct/field sinks, and `AIO.verifyPageLiveDataBinding()` / `AIO.verifyCritical10LiveBindings()` must expose binding-missing vs source-missing separately.
- Cell-level and market-currentness audits must include all live sink attrs, not just `data-live-price`.

**Validation**: `AIO.refreshAllCriticalPages()` + `AIO.verifyCritical10LiveBindings()` + T711~T714.

## R195. Trading-use market data must pass DataTruthGate before decision use (v49.108 added, P471 root)

**Rule**: A fetched quote is not trading-usable merely because it arrived from a live endpoint. It must pass truth validation first. If truth validation fails, the value may be displayed only as reference/unverified and AI answers must not use it for trading judgment.

**Required**:
- Every live quote used by `data-live-price/chg/pct/field` must be evaluable through `AIO.evaluateDataTruth(symbol)`.
- Truth validation must check source allow-list, timestamp presence, max age by asset/session, price sanity range, percent-change sanity, and price-vs-previous-close percent coherence when previous close is available.
- DOM live sinks must expose `data-truth-status`, `data-truth-confidence`, and `data-truth-issues`.
- If truth status is `blocked`, `data-operational-use` must be `reference-only` even when `data-source-kind` is `live`.
- `annotateLiveDataSinks(...force:true)` must not re-promote truth-blocked values to `decision`.
- AI chat freshness preflight must include truth status/issues and must forbid current numeric claims from truth-blocked data.

**Validation**: `AIO.getDataTruthAudit({critical10:true})` + T715~T718.

## R196. Trading-use quotes require independent cross-source validation when available (v49.109 added, P472 root)

**Rule**: Current quote data must keep independent source-family evidence instead of overwriting providers into one final value. A value can remain decision-usable only if DataTruthGate passes and no independent live source materially disagrees. If independent sources disagree beyond the asset threshold, the quote is blocked for trading-use and AI answers must not cite it as current.

**Required**:
- Every quote write path (`applyLiveQuotes`, `_aioSetLiveData`, ticker-detail fallbacks, and stock-chat/company-analysis fetches) should record the value through `AIO.recordCrossSourceQuote()` when a price is available.
- `AIO.getCrossSourceQuoteValidation(symbol)` must compare source families, not raw labels, so all Yahoo proxies count as Yahoo while Finnhub/FMP/Stooq/Naver/CoinGecko/FX APIs remain independent families.
- `fetchLiveQuotes()` must schedule post-refresh cross-source validation for requested/core/critical symbols via `AIO.validateQuoteCrossSources()`.
- AI stock-answer preflight must force cross-source validation for detected tickers and inject cross-source status into the prompt.
- Delayed/EOD source disagreement may warn, but independent live-source disagreement must block decision-use data.

**Validation**: `AIO.getCrossSourceQuoteValidation(symbol)` + `AIO.validateQuoteCrossSources(symbols)` + T719~T723.

## R197. Critical-10 freshness must audit visible market surface, not only refresh schedules (v49.110 added, P473 root)

**Rule**: The comprehensive 5 pages and market-analysis 5 pages must not report freshness OK from refresh task metadata alone. The audit must read the actual visible DOM market surface and fail/warn when any visible quote, metric, date, or binding is missing, stale, reference-only, or truth-blocked.

**Required**:
- `AIO.getCritical10MarketSurfaceAudit()` must aggregate page-level market currentness, live binding, truth-blocked, and stale snap-date counts for all critical-10 pages.
- `AIO.getComprehensivePageDataFreshnessAudit()` must include `verifyPageLiveDataBinding()` and `getCritical10MarketSurfaceAudit()` so source-missing, binding-missing, truth-blocked visible cells, stale tasks, and stale snap dates affect page status.
- `AIO.getAutoOpsReadiness()` must expose the critical-10 market-surface audit and warn when affected pages exist.
- Visible `data-operational-use="reference-only"` or `data-truth-status="blocked"` quote cells must count as market currentness issues even if a numeric value is displayed.

**Validation**: `AIO.getCritical10MarketSurfaceAudit()` + `AIO.getComprehensivePageDataFreshnessAudit()` + T724~T727.

## R198. Critical-10 page content must be compared with current market reference/regime before being trusted (v49.111 added, P474 root)

**Rule**: The comprehensive 5 pages and market-analysis 5 pages must not be treated as market-current just because refresh tasks ran or live sinks exist. The app must inventory visible market content and compare it against the current reference quote/truth/cross-source snapshot and derived market regime.

**Required**:
- `AIO.collectCritical10MarketContentInventory()` must enumerate live cells, snapshot cells, snap dates, chart-like elements, static numeric text, and market narrative text for all critical-10 pages.
- `AIO.getMarketSituationReferenceSnapshot()` must expose current reference coverage, age, truth status, cross-source status, and a derived market regime for core market symbols.
- `AIO.getCritical10MarketSituationAudit()` must warn on missing current references, visible value/reference mismatches, source/truth problems, stale dates, and narrative-regime conflicts.
- `AIO.refreshCritical10MarketSituationAudit()` must be able to fetch current quotes, run cross-source validation, rebind DOM cells, and then rerun the situation audit.
- Comprehensive page freshness and ops readiness must surface the market-situation audit so a page cannot look healthy when its visible market content is not backed by current reference data.

**Validation**: `AIO.getCritical10MarketSituationAudit()` + `AIO.refreshCritical10MarketSituationAudit()` + T728~T733.

## R199. Critical-10 content checks must use a full evidence matrix, not representative samples (v49.112 added, P475 root)

**Rule**: Market-currentness checks must cover all visible critical-10 content categories, including trading indicators, sentiment indicators, Breadth charts, static numeric text, and analysis/explanation text. Representative-only checks are insufficient.

**Required**:
- `AIO.getCritical10ContentEvidenceMatrix()` must classify every live cell, snapshot cell, snap date, chart-like element, static numeric text, and market narrative as `pass`, `warn`, `block`, or `needs_evidence`.
- The matrix must use `collectCritical10MarketContentInventory({ full:true })`, not a sample-only inventory, when computing counts and status.
- External references may be passed in and must block a visible price cell when displayed value differs beyond tolerance.
- Comprehensive page freshness and ops readiness must include evidence matrix counts so pages cannot look healthy while content items still need evidence or are blocked.

**Validation**: `AIO.getCritical10ContentEvidenceMatrix()` + T734~T736.

## R201. Trading decision logic must pass current evidence gate (v50.1 added, P477 root)

**Rule**: trading score, market regime, execution window, Weinstein stage, ticker entry checklist, and options IV Rank are actionable only after `AIO.getTradingDecisionInputEvidence()` and `AIO.getTradingDecisionLogicAudit()` pass. `DATA_SNAPSHOT`, static screener values, localStorage ATH, same-day change technical proxies, RSP/SPY breadth proxies, and static VIX range bands are reference-only unless promoted by verified/current evidence.

**Validation**: `AIO.runEvidenceDeploymentGate({ strict: true })` includes `tradingDecisionLogic`, and strict mode blocks unresolved trading-use fallback warnings/blocks.

## R202. Runtime version uses one or two decimal digits only (v50.1 added)

**Rule**: Current runtime release tags must use `vMAJOR.MINOR` with one or two digits after the decimal point, for example `v50.1` or `v50.12`. Do not create new three-decimal tags such as `v49.100`. Historical changelog entries may remain as archive text, but active `APP_VERSION`, title, badge, `version.json`, `SW_VERSION`, and cache-busters must follow this format.

**Validation**: T748 checks `window.AIO.version` against `^v\d+\.\d{1,2}$`.

## R203. News surfaces must use the shared evidence-style surface contract (v50.2 added, P478 root)

**Rule**: `home`, `briefing`, and `market-news` must render from `AIO.buildNewsSurfaceModel()` using `AIO_NEWS_SURFACE_CONTRACTS`. Do not reintroduce independent ad hoc filters that bypass source tier, freshness window, score threshold, duplicate removal, verification status, or empty-reason accounting.

**Validation**: `AIO.getNewsSurfaceAudit({ rebuild: true })` must report all three surfaces, and `AIO.runEvidenceDeploymentGate({ strict: true })` must include `newsSurface`. Briefing AI input may include only verified/current items; secondary-only, Telegram-only, stale, or unverified items must stay in review/confirmation-needed UI.

## R204. User-facing market text must pass the text surface contract (v50.3 added, P479 root)

**Rule**: Every route-page text surface must be classified by `AIO_TEXT_SURFACE_CONTRACTS` as a current market claim, education explainer, operational status, developer note, risk disclaimer, or reference archive. Developer/version/rule markers such as `[PRIMARY]`, `[SECONDARY]`, `ACTION_RULES`, `PAGE_PURPOSE_REGISTRY`, and internal audit IDs must not be visible on route pages. Fixed-date market claims must either be refreshed through live calendar/news evidence or marked reference/archive.

**Validation**: T755~T758 verify text contracts, high-risk marker removal, briefing fixed-date claim removal, and deployment-gate integration through `AIO.getTextSurfaceAudit()` and `AIO.runEvidenceDeploymentGate()`.

## R205. Static market calendars must separate official releases from source-dependent topics (v50.4 added, P480 root)

**Rule**: Hardcoded current-market copy, pinned events, AI briefing context, and DATA_SNAPSHOT metadata must distinguish (1) last-published official values, (2) scheduled official release dates, and (3) source-dependent watch topics. Future CPI/NFP/PCE/FOMC values must never be invented before official release. Topics such as Computex announcements or SpaceX IPO reports must show their verification status and must not be rendered as confirmed market data unless verified/current evidence exists.

**Validation**: T759~T762 verify official June 2026 NFP/CPI/FOMC/PCE dates, snapshot current-topic fields, home current-topic queue, and active `vMAJOR.MINOR` runtime version policy.

## R206. 사용자 가시 텍스트에 개발자/버전 마커 금지 (v50.14 added, v50.13 UX audit root)

**Rule**: 21 route 페이지의 **사용자에게 보이는 텍스트/툴팁**에 개발 내부 마커를 노출하지 않는다 — 금지: `§NN`(KNOWLEDGE-BASE 섹션 참조), `vNN.NN`(앱 버전 배지 `#app-version-badge` 제외), 코드네임(예: "Claude Mythos"), 영문 dev 단어("Fallback Only"/"prominent"), 영문 거버넌스 코드(STALE/STATIC/OK/REF — 한글 오래됨/정적/최신/참고 사용), `[MM/DD]` 시점 접두사를 단 stale 내러티브. 이런 마커는 KNOWLEDGE-BASE/NARRATIVE_ENGINE/CHAT_CONTEXTS 작성 시 발생하기 쉬우므로, 사용자 surface에 들어가기 전 일반화(evergreen)하거나 HTML 주석/`data-text-role="developer-note"`로 분류한다.

**Validation**: `AIO.getVisibleDevMarkerAudit()`가 모든 `[id^="page-"]`의 **가시 텍스트(textContent) + 속성 텍스트(title·aria-label·placeholder·alt·data-tooltip)** 양쪽을 스캔해 위반 시 `violationCount>0` (각 violation에 `surface:'text'|'title'|...` 표기). 제외: 스크립트·앱버전배지·developer-note·archive·**외부 콘텐츠(라이브 RSS `.news-item-*`·LLM 채팅 `.acp-bubble`/`.aio-chat-msg`)**. `getAutoOpsReadiness()`에 통합. T776(가시 마커 0)·T777(breadth routine 200 부재)·T778(배지 한글)·T779(용어집 7)·T780(signal CP de-stale)로 회귀 방지.

**중요 교훈 2건** (v50.14 실측):
1. **속성 텍스트도 사용자 노출 표면** — textContent만 스캔하면 tooltip/aria-label의 dev마커(`DATA_SNAPSHOT`/`RNN`/`vNN.NN`)를 놓침. 표 a11y normalizer(`_aioApplyTableAccessibility`)가 버전배지 포함 heading을 aria-label로 읽어 'v50.14'를 누출한 케이스 — heading clone에서 버전배지 제거 후 추출로 시정. audit은 반드시 속성까지 커버.
2. **정적 HTML이 JS로 런타임 덮어써지는 동적 누출** — `generateMacroStoryline` 등 페이지 진입 시 렌더되는 텍스트는 페이지에 **실제 진입해야** DOM에 나타남. 정적 스캔만으론 부족하므로 **21페이지를 하나씩 진입(showPage)해 동적 렌더 후 재스캔** 필요. + **서비스워커가 동일 SW_VERSION 캐시를 유지하면 편집한 JS가 가려짐** — 검증 시 SW unregister + `caches.delete` 후 hard reload, 또는 서버에서 직접 fetch해 디스크 내용 대조.

## R207. 접근성 WCAG AA 유지 — 접근 이름·최소 폰트·tap target (v50.14 added)

**Rule**: 인터랙티브 요소(button/[role=button]/[data-action]/select)는 **접근 가능한 이름**(텍스트·aria-label·title)을 가져야 하고, **모든 가시 텍스트 폰트는 ≥11px**(v50.14 사용자 결정 — 9px/8px/9.5px 3차 microcopy 포함 전부 ≥11px 상향). tap target은 WCAG 2.5.8 AA **24×24px** 최소 — 단 인라인 칩/링크는 인라인 예외. 대비(getColorContrastAudit)·테이블(getTableAccessibilityAudit)은 기존 통과 유지. 44×44(AAA)는 밀집 터미널 특성상 트레이드오프로 목표 외.

**Validation**: `AIO.getAccessibilityAudit()`(활성 페이지 측정)가 `missingAccessibleNameCount`/`fontUnder10pxCount`/`tapTargetUnder24Count` 반환. T781이 접근 이름 0·초소형 폰트 0을 강제(tap target<24는 인라인 예외로 informational). 21페이지 라이브 스위프로 전수 검증(text 폰트 0·noName 0). **폰트 소스 주의**: `font-size:9px` 리터럴뿐 아니라 **동적 구성**(`(opts.fontSize || '9px')`)·**DOM API**(`el.style.fontSize='9px'`)도 <10px 누출 경로 — grep 시 `['"][89](\.\d)?px['"]`·`fontSize\s*=`까지 점검.

## R208. 분석 UI 상태·수량·정밀 주장·향후 일정은 증거 원천에서 파생 (v50.55 added, P500 root)

**Rule**: 사용자 가시 분석 표면은 `loading`, `unavailable`, `excluded`, `ready`를 서로 다른 상태로 표시한다. 등록 소스 수·활성 팩터·표시 상한·향후 일정은 코드의 실제 배열/응답/공식 일정 원천에서 파생하며 복수 위치에 숫자를 하드코딩하지 않는다. 승률·정확도 개선율 같은 정밀 분석 주장은 검증 가능한 출처, 표본, 기간, 시장 레짐이 없으면 표시하거나 AI 컨텍스트에 주입하지 않는다. 과거 이벤트는 향후 일정으로 자동 이동시키지 않으며, 기계적 주기 연장은 `estimated`로 명시한다.

**Validation**: T822가 뉴스 소스 수 동적 표기, 분류 토픽 필터, 근거 없는 기술 승률 제거, 스크리너 unavailable 상태를 검증한다. 일정 변경 시 Fed/BEA/BLS 등 1차 공식 출처 날짜를 확인하고 브라우저에서 과거 이벤트의 "발표 전/향후" 잔존 여부를 점검한다.

## R209. 계약 수·시간대·복합 가격 카드는 단일 진실 원천에서 파생 (v50.56 added, P501 root)

**Rule**: 라우트 수 검증은 `AIO_PAGE_CONTRACTS`/`expectedRoutePageCount`에서 파생하며 별도 숫자 리터럴을 두지 않는다. 날짜·요일·일일 사용량 경계는 동일한 명시적 timezone formatter를 사용한다. 현재가·변동액·등락률·전일종가처럼 한 카드에서 함께 해석되는 수치는 동일 quote payload와 timestamp에서 원자적으로 렌더한다.

**Validation**: `scripts/ci-structural-check.mjs`가 라우트 수, legacy 21-page gate 부재, KST formatter, KR previous-close sink/map을 검사한다. T743은 gate 계약 수 불변식, T823은 KST 날짜·요일과 KR sink 존재를 검증한다.

## R210. 런타임 scope·sink 소유권·증거 게이트 의미를 함께 검증 (v50.56 added, P502 root)

**Rule**: 여러 listener/함수가 공유하는 helper는 모든 caller보다 앞선 module scope에 선언한다. 복합 카드/행/pill은 `data-live-symbol`로 종목을 소유하고 `data-live-price`/`data-live-chg`는 실제 값 child에만 둔다. DataTruth sanity range는 자산·통화 단위를 구분하며, `reference-only` 미수집값은 경고로 남기되 `decision` sink의 blocked truth는 배포 차단한다. 날짜 감사는 KST 실제 경과일과 일정 문맥을 사용하고 비율·이동평균 기간·브랜드명 부분문자열을 날짜/개발 표식으로 판정하지 않는다. 12초 이상 비동기 수집은 전경 loading 대신 백그라운드 진행 상태를 표시한다.

**Validation**: T824와 `scripts/ci-structural-check.mjs`가 KR 복합 sink, 원화 가격 범위, reference-only 게이트, 날짜/비율 구분, 뉴스 백그라운드 상태를 검사한다. fresh browser context에서 22개 라우트를 모두 진입한 뒤 evidence/text block 0, 영구 loading 0, pageerror 0을 확인한다.

## R211. 넓은 AI 종목 추천은 분산 후보군을 먼저 만들고 반복 앵커를 감점 (v50.57 added, P503 root)

**Rule**: 사용자가 특정 티커·섹터·테마를 지정하지 않고 "종목 추천", "top picks", "stock ideas"처럼 넓은 추천을 요청하면 AI 채팅은 고정 리서치 내러티브나 최근 대화에서 반복된 종목으로 바로 수렴하지 않는다. 먼저 SCREENER_DB 기반 후보군을 섹터·시장/지역·시총 버킷으로 분산 샘플링하고, 최근 대화에서 반복된 티커는 감점한 뒤 그 후보군에서만 3~5개를 고른다.

**Required**:
- `_aioRunScreenerQuery()`는 조건 없는 넓은 추천을 `mode: 'diversified-recommendation'`으로 반환한다.
- 후보군은 동일 섹터/테마 과밀을 제한하고, 가능한 한 4개 이상 섹터와 복수 시장/시총 버킷을 포함한다.
- `chatSend()`는 최근 대화 티커를 추천 후보 생성기에 전달하고, system prompt에 추천 다양성·반복 편향 방지 규칙을 주입한다.
- 특정 섹터/테마 질문(예: "전력 종목 추천")은 분산 모드가 아니라 기존 명시 조건 필터를 유지한다.

**Validation**: T825는 "종목 추천해줘"가 균형 추천 후보 모드로 진입하고, "전력 종목 추천해줘"는 명시 섹터 필터로 남으며, 프롬프트에 반복 편향 방지 지시가 포함되는지 검증한다.

## R212. AI 채팅 정확성 가드는 사용자 의도별로 적용하고 답변력을 억제하지 않는다 (v50.58 added, P504 root)

**Rule**: AI 채팅의 환각 방지·출처·시나리오·기관 프레임 규칙은 모든 질문에 일괄 강제하지 않는다. 일반/교육 질문, 스크리너 후보 추천, 단순 종목 사실 질문, 매매 판단/전망 질문을 분리하고, 각 의도에 필요한 만큼만 데이터 한계와 답변 구조를 적용한다.

**Required**:
- `_aioChatAnswerPolicy()`가 일반/교육, 스크리너, 단순 종목, 매매 판단 모드를 구분한다.
- Bull/Base/Bear, 기관 프레임, 6단계 종목 리포트는 매매 판단·전망·추천 질문에만 강하게 적용한다.
- 일반/교육 질문은 바로 답하고, 현재 수치·최신 사건이 필요한 경우에만 데이터 미수집/출처 한계를 밝힌다.
- 스크리너 후보군은 3M·RSI·퀀트 랭크·섹터/시장 분산을 자체 근거로 사용할 수 있으며, 개별 티커 `[주가 추이]` 블록 부재만으로 스크리너 설명을 막지 않는다.
- 스크리너는 최종 추천의 근거 범위를 정직하게 제한하되, 사용자가 더 넓은 탐색을 원하면 추가 필터 조건을 안내한다.

**Validation**: T826은 `PER이 뭐야?`가 일반/교육 모드로, `종목 추천해줘`가 스크리너 보조 모드로, `NVDA 지금 매수해도 돼?`가 매매 판단 모드로 분리되는지와 chatSend/fetchTickerData의 과도한 형식 강제 완화를 검증한다.

## R213. AI 채팅 데이터 기능은 자연어 라우팅과 출처 레지스트리까지 연결해야 한다 (v50.59 added, P505 root)

**Rule**: 채팅용 데이터/분석 함수가 존재하는 것만으로 완료로 보지 않는다. 사용자가 티커 없이 자연어로 묻는 대표 질문도 해당 기능으로 라우팅되어야 하며, 주입되는 데이터 소스는 `AIO_CHAT_SOURCE_REGISTRY`와 `getChatSourceRegistryAudit()`에 드러나야 한다.

**Required**:
- 무티커 기술/차트 질문은 `_aioTechnicalSymbolsForChat()` 같은 라우터를 통해 시장 대표 프록시(SPY/QQQ/SMH 등) 또는 문맥별 프록시로 변환한다.
- OHLCV/차트/도메인 데이터처럼 `_fetchTickerDataForChat()` 바깥에서 주입되는 소스도 레지스트리에 등록하고 감사 스캔 범위에 포함한다.
- 데이터 블록에는 source, rows/count, fetched/asOf 또는 dataQuality 라벨을 붙여 최신성·신뢰성 한계를 사용자가 볼 수 있게 한다.
- 회귀 테스트는 함수 정의뿐 아니라 `chatSend()` 배선, 레지스트리 등록, audit unused=0까지 확인한다.

**Validation**: T827은 `지금 시장 차트적 분석해줘` 같은 무티커 기술 질문이 SPY/QQQ/SMH 시장 OHLCV 컨텍스트로 연결되고, `technicalOHLCV` 소스가 레지스트리와 감사에서 정상 처리되는지 검증한다.

## R214. AI 채팅은 AIO 전용 통합 답변 계약까지 주입해야 한다 (v50.60 added, P506 root)

**Rule**: AIO 채팅은 일반 LLM처럼 고립된 텍스트 답변만 생성하지 않는다. 내부 페이지와 데이터 파이프라인의 강점을 답변에 반영해야 하므로, 현재 시장 맥락, 정량 지표, 정성 뉴스/공시, 스크리너/테마/포트폴리오 맥락, 관련 페이지 연결을 하나의 답변 계약으로 주입해야 한다.

**Required**:
- 채팅 파이프라인 레이어는 `AIO_CHAT_PIPELINE_REGISTRY`처럼 선언적으로 드러나야 한다.
- 답변 계약은 최소 현재 시장 연결, 정량 답변, 정성 답변, 종합 판단, 페이지 연결, 추천 다양성/반복 편향 방지를 포함한다.
- `chatSend()`는 intent/coverage/source blocks와 별도로 통합 답변 컨텍스트를 system prompt에 주입한다.
- coverage flags는 ticker/trend/company뿐 아니라 technical/screener/domain/page-context 데이터를 인식해야 한다.
- 새 페이지나 데이터 레이어를 채팅에 연결할 때는 "어떤 답변 축에 쓰이는지"까지 테스트로 고정한다.

**Validation**: T828은 `AIO_CHAT_PIPELINE_REGISTRY`, `_buildAioIntegratedAnswerContext()`, `chatSend()` 배선을 함께 확인하고, 현재 시장·정량·정성·페이지 연결·AIO 전용 강점이 프롬프트 계약에 들어가는지 검증한다.

## R215. Telegram/외부 정성 소스는 digest -> 화면 -> 스크리너 -> 채팅 -> 테스트까지 환류해야 한다 (v50.61 added, P507 root)

**Rule**: Telegram, Discord, 리서치 채널처럼 구조화되지 않은 고빈도 정성 소스는 원문 수집만으로 완료로 보지 않는다. 수집 결과를 주간/일간 digest로 정규화하고, 사용자 화면·스크리너 후보·뉴스 분류·AI 채팅 계약에 같은 요약 레이어로 연결해야 한다.

**Required**:
- 공개 미러/공식 API/수동 파일 등 source URL과 수집 window, post count, channel별 count, safety cap 여부를 digest 객체에 남긴다.
- 주요 테마는 HOME_WEEKLY_NEWS 또는 동등한 사용자 노출 큐레이션에 반영한다.
- 종목 catalyst는 SCREENER_DB memo overlay 또는 별도 evidence layer로 연결하고, 고정 memo를 무작정 대체하지 않는다.
- 새 토픽은 MACRO_KW/TECH_KW 등 분류 키워드에 추가해 뉴스 파이프라인이 다음 수집에서도 감지하게 한다.
- AI 채팅은 digest themes/catalysts/pipeline note를 system prompt에 주입해 현재 시장과 추천 다양성에 활용한다.
- 고거래량 채널이 paging cap에 걸리면 "완료"로 숨기지 말고 resumable paging/backfill 필요성을 기록한다.

**Validation**: T829는 `AIO_TELEGRAM_WEEKLY_DIGEST`, HOME_WEEKLY_NEWS, SCREENER_DB memo overlay, MACRO/TECH keyword expansion, `_buildAioIntegratedAnswerContext()` Telegram 주입을 함께 검증한다.


## R216. Data/news refresh must separate collection freshness from consumption coverage (v50.62 added, P508 root)

**Rule**: A market/news refresh is not complete just because raw files or digest objects were updated. The system must separately expose market-data freshness, narrative/news freshness, page-level consumption coverage, and chat consumption coverage.

**Required**:
- DATA_SNAPSHOT must distinguish _marketDataUpdated/_marketDataDate from _telegramDigestUpdated/_telegramDigestDate when the two layers are refreshed by different pipelines.
- Stale/freshness banners must not imply current numeric market data when only narrative/news context was refreshed, and must not warn generically when numeric fallback is current but live coverage is incomplete.
- New digest topics must be mapped through a category registry and page integration map, then reflected in AIO_NEWS_SURFACE_CONTRACTS and chat integrated context.
- Regression tests must cover at least one broad page map, one analysis-page topic strip, and the freshness metadata split.

**Validation**: T830 checks Telegram categories, page maps, widened news contracts, DATA_SNAPSHOT market/digest dates, updateSnapshotStaleBanner, and chat category/page-map injection.

## R217. Scheduled data sources must close the collect -> artifact -> consume -> audit loop (v50.63 added, P509 root)

**Rule**: A source is not "automated" merely because a fetch script exists or a static JS object was manually updated. Scheduled sources must produce a same-origin `public-data/*` artifact, the app must consume that artifact at boot or refresh time, freshness metadata must reflect the consumed artifact, and an audit/test must expose whether the app is using dynamic data or static fallback.

**Required**:
- GitHub Actions must run the source fetcher and commit its artifact alongside related market data.
- Independent watchdogs must check freshness of every committed artifact that the UI treats as current context.
- The runtime loader must degrade to static fallback without blocking the app, but it must record `ready` vs `unavailable` status.
- Consumption must update the same registry/page-map/chat/freshness objects that the static fallback uses, not a parallel orphan object.
- Operational audits must show source count, artifact asOf/window/count, dynamicLoaded status, and coverage.
- Regression tests must exercise both the payload application function and the loader wiring string or equivalent route.

**Validation**: T831 checks dynamic Telegram digest application, `public-data/telegram-digest.json` loader wiring, freshness metadata update, category/page-map preservation, and Telegram pipeline audit visibility.

## R218. Runtime contract / share readiness gate is mandatory (v50.79)

- If an edit touches AI prompts, imported research, visual report generation, cachebusters, digest artifacts, or public-sharing UX, it must update both runtime and CI gates.
- Required checks: `AIO.getRuntimeContractAudit()`, `AIO.getShareReadinessAudit({ skipEssence: true })`, and `node scripts/ci-runtime-contract-check.mjs`.
- Completion means the artifact is consumed by page/AI/audit/CI, not merely created as a file.
- Removing a UI surface does not permit removing runtime callables until all prompt/test/page references are updated or retired.

## R219. Audit/gate is not semantic review (v50.89, P513 root)

**Rule**: A task is not complete just because an audit function exists, an object has the expected shape, a coverage percentage is high, or a sidebar row/DOM marker is present. For any request touching pages, AI chat, data/source pipelines, trading logic, technical analysis, ticker analysis, portfolio logic, market text, or public-sharing UX, the review must close the real semantic path:

- user request/intent -> affected function(s) and criteria
- affected function(s) -> downstream consumer(s)
- downstream consumer(s) -> visible page/chat/report output
- visible output -> market/domain meaning, currentness, source confidence, and user action risk

**Required**:
- Every new audit/readiness/coverage test must have either a direct semantic companion check or a documented semantic backlog item.
- Trading and market-decision edits must include at least one direct function contract and one user-visible wording/action check.
- AI chat edits must verify the route from user prompt intent to data/source block to answer policy/output, not only callable existence.
- UI/page redesign edits must inspect the first-screen visible hierarchy and at least one real user scenario for the touched route.
- Data/source edits must verify collect -> artifact/source -> loader -> normalized model -> page/chat consumer -> stale/source label.
- `node scripts/ci-semantic-review-check.mjs` must pass whenever `ci-runtime-contract-check.mjs`, AI/data/trading audits, or page redesign gates are touched.

**Validation**: `scripts/ci-semantic-review-check.mjs` inventories audit-only risk, verifies R219/P513 governance hooks, and asserts that high-risk trading/currentness gates remain semantic rather than shape-only.

## R220. Workflow memory must be compacted before it is extended (v50.89, P514 root)

**Rule**: `_context`, `CLAUDE.md`, QA checklists, postmortems, and `.agents/skills/*/SKILL.md` are operating surfaces, not infinite append-only logs. When a repeated problem appears, prefer one of these actions in order: remove stale guidance, merge duplicate rules, compress history into an indexable summary, split large skill details into `references/`, then add a new rule/check only if none of the above closes the loop.

**Required**:
- Do not add a long SKILL.md section when the material can live in a referenced file or deterministic script.
- A skill over 300 lines or 15KB must be treated as a compaction candidate unless it has a clear progressive-disclosure structure.
- `_context/BUG-POSTMORTEM.md` remains an archive, but latest failure patterns must be summarized into active RULES/QA/CI gates rather than re-read wholesale.
- `_context/RULES.md` additions must retire or merge superseded rules when a newer rule covers the same surface.
- `CLAUDE.md` must point to current operating contracts, not duplicate every historical caution.
- Any task that updates workflow docs or skills must run `node scripts/ci-workflow-compaction-check.mjs`.

**Validation**: `scripts/ci-workflow-compaction-check.mjs` reports oversized context/skill surfaces and fails if R220/P514 governance hooks are missing.
