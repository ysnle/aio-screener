---
updated: 2026-06-14
version_context: v50.42 → v50.50 (배포 시점)
purpose: "별도 세션 필요"라고 넘긴 작업의 진짜 정체를 한 곳에 정리. 대부분은 세션과 무관하게 진행 가능했고, 실제 막힌 것은 데이터·시간·운영자 결정 4종뿐임을 명확히 한다.
---

# 미뤄둔 작업 / 진짜 블록 현황 (Deferred & Blocked)

## 0. "별도 세션 필요"의 진실 (2026-06-13 사용자 지적 대응)

사용자: *"별도의 세션이 필요하다고 하는데 지금 여기 세션과 무슨 차이가 있길래 그래? 여기서 진행하면 안 되는 거야?"*

**정직한 답**: 기술적으로 이 세션과 다른 세션은 **차이가 없다** — 같은 코드·도구·권한. "별도 세션"은 대부분 두 가지의 완곡어였다:
1. **세션 컨텍스트 예산** — 매우 긴 세션에서 큰 작업을 컨텍스트 끊김 직전에 시작하면 하다 마는 위험. → 안전한 분할 문제이지 능력 문제 아님. **여기서 단계별 커밋으로 가능.**
2. **라이브 앱 회귀 통제** — 대규모 변경(84곳 마이그레이션·DOM 대이동·게이트 67건)은 단계별 검증 필요. → **여기서 단계별로 하면 됨.**

→ 따라서 §2(진행 가능) 항목은 "별도 세션"이 아니라 **예산이 허락하는 만큼 여기서** 진행한다.

---

## 1. 진짜 블록 (여기서도 불가 — 데이터·시간·운영자 결정)

| # | 항목 | 블록 사유 | 해제 조건 | 비고 |
|---|------|-----------|-----------|------|
| B1 | KR 정적 스냅샷 de-stale (KOSPI inline · kr-home/kr-supply/kr-macro/kr-technical 정적값) | 무료 자동 KR breadth/신용잔고/수급 데이터 소스 없음. 추측 입력 금지(R15/R183). | KR 데이터 소스 확보(유료 API or 수동 입력 파이프라인) | DATA_SNAPSHOT KR 필드 일부만 갱신 가능, breadth류는 불가 |
| B2 | 미확보 시세 필드 (ETH·KOSDAQ·DXY·글로벌지수·5월 CPI) | WebSearch 미확보 시 추측 생성 금지(R15/R183) | `scripts/fetch-data.mjs` SYMBOLS에 추가 후 cron 1회 (DXY/일부는 v50.40에서 추가 → 다음 cron 반영) | 코드는 준비, 데이터 도착 대기 |
| B3 | jensen 인터뷰 84일 아카이브 콘텐츠 | 대체할 신규 분석 자료 없음 | 신규 인터뷰/리서치 자료 통합(/integrate) | `#jensen-interview-stale-days`(index.html:5671)가 경과일 동적 표시 中 — 기능은 정상, 콘텐츠만 stale |
| B4 | WO-7 차트 history 재배선 (IV Rank·F&G 추이·VIX 퍼센타일 실데이터 전환) | `public-data/history.json` 20~60일 누적 필요 (물리적 시간) | 시간 경과 → 코드가 자동 전환 (`_aioHistorySeries`/`_aioVixPercentile` 준비됨) | 생산자(fetch-data.mjs append)·소비자 레이어 완료. 누적만 대기 |
| B5 | ~~WO-10 Claude 키 서버화 (Cloudflare Worker Anthropic 프록시)~~ **해소됨(2026-07-07, v52.24, P638)** | (과거) 운영자 결정 + Worker secret 배포 필요 | — | `cloudflare-worker-proxy.js`(v50.27 복원, v50.52 B5 라우트 추가)가 실배포에 반영 안 돼 `/anthropic`가 405를 반환하던 것을 라이브 감사(FABLE-LIVE-AUDIT-2026-07-07.md C1)로 확정 실측 → 운영자가 같은 날 워커 재배포 + `ANTHROPIC_API_KEY` 시크릿 추가로 해소. curl 재현 확인(405→200) + 라이브 브리핑 페이지에서 실제 AI 콘텐츠 렌더 확인. **잔여 관찰 정정(2026-07-10, EF-20)**: 그때 "간헐적 403, Anthropic 측 rate/concurrency 추정"이라 적었던 것은 틀린 추정이었음 — 실제로는 아래 B8 참조(Cloudflare 엣지 리전 문제, rate/concurrency 아님) |
| B8 | AI 채팅 `/anthropic` 간헐적 403 (EF-20, B5 잔여 관찰의 실제 정체) | **레포 코드·시크릿·배포 전부 정상, 근본 원인은 Cloudflare Workers anycast 라우팅이 요청마다 다른 엣지 데이터센터를 태우고 Anthropic이 특정 리전(홍콩 HKG) 발신 요청을 정책상 거부하는 것.** curl로 3회 재현: 동일 요청이 `CF-RAY: ...-NRT`(도쿄) 경유 시 200 정상, `CF-RAY: ...-HKG`(홍콩) 경유 시 403 `{"error":{"type":"forbidden","message":"Request not allowed"}}` — 응답이 Worker의 `errorResponse()` 형태(`{error,status}`)가 아니라 Anthropic 자체 에러 포맷이라 Anthropic이 직접 반환한 것으로 확정(Worker는 pipe-through만 함). 무료 Cloudflare 플랜은 Worker 실행 리전을 사용자가 직접 제외/고정할 수 없음(리전 고정은 보통 Enterprise 전용) | 코드로 완전 제거는 불가(Cloudflare 리전 라우팅은 운영자 통제 밖 — 이 부분은 여전히 §1 "진짜 블록"). **완화책 구현 완료(2026-07-10, v52.44, P659/R292)**: `js/aio-chat.js`에 공유 헬퍼 `_aioFetchClaudeWithRetry(url, fetchOpts, serverKey, maxRetries=2)` 신설 — 서버키 모드(Worker 경유)+403+Anthropic 고유 `{error:{type:'forbidden'}}` 포맷일 때만 즉시 새 fetch로 최대 2회 재시도. 문서 원문은 채팅만 지목했으나 EF-20 관찰("채팅·브리핑·번역 동시 실패")을 재확인해 셋 다 같은 Worker `/anthropic` 경로+같은 근본원인에 노출돼 있음을 확인 → `callClaude`(채팅, 최초요청+400-beta폴백 재요청 2곳)·`autoTranslateNews`(번역)·`_generateAIBriefing`(브리핑) 3개 함수 4개 호출부 전체 적용. 일일 사용량 KV 카운터는 재시도 시도마다 증가(부작용, 캡 300 대비 미미해 별도 처리 안 함) | 2026-07-10 root-cause 기록 → 같은 날 사용자 요청으로 완화책 구현(P659, T887~890, `ci-runtime-contract-check.mjs` 4건, 헤드리스 952/952). 근본원인(Cloudflare 무료 플랜 리전 미고정)은 여전히 코드로 해결 불가 — 매우 짧은 시간 내 재시도까지 전부 HKG로 라우팅되는 최악의 경우 사용자에게 403이 여전히 보일 수 있음(완화이지 완전 해결 아님, 확률 감소 조치) |
| B6 | ~~cron 발화 신뢰성 최종 검증~~ **해소됨(2026-07-03, v51.95, P591/R272)** | (과거) GitHub Actions 로그를 시간에 걸쳐 관찰해야 확인 | — | 실측 결과 cron 자체는 신뢰성 문제 없었음(30분마다 정확히 발화·커밋). 진짜 원인은 별개: `refresh-data.yml`의 `GITHUB_TOKEN` push가 `ci.yml`의 `push` 트리거를 절대 못 울려 validate/deploy가 전혀 안 돌고 있었음(라이브 사이트 19h stale 실측). `workflow_run` 트리거 추가로 해소 — PAT 불필요. **정정(2026-07-04, FABLE-LIVE-AUDIT-2026-07-04.md P2)**: "30분마다 정확히 발화"는 이 시점 관측 범위에서의 판단이었고, 이후 48h를 더 폭넓게 재관측한 결과 실발화 간격은 1.0~4.2h(중앙값 ~1.8h) — cron **정의**(`17,47 * * * *`)는 30분 그대로이나 GitHub 무료 러너 스케줄러 자체 스로틀링으로 **실발화**는 그보다 느림(코드로 해결 불가). "신뢰성 문제 없음"(발화 자체가 스킵/중단되지 않음)이라는 결론은 유효, "정확히 30분마다"라는 간격 서술만 정정. |
| B7 | ~~kr-technical TradingView KRX 위젯 하드 브레이크~~ **해소됨(2026-07-05, v52.13, P610)** (FABLE-LIVE-AUDIT-2026-07-04.md P3) | (과거) TradingView 무료 embed가 `KRX:005930`(+`KRX_DLY:` 지연 변형)에 "TradingView 에서만 제공되는 심볼입니다" 오류를 반환 — 라이브 재현 확인, 이 문자열은 우리 코드베이스 어디에도 없음(TradingView 자체 콘텐츠) | — | 검토한 3가지 대안 중 가장 큰 규모인 ②(Naver siseJson+Chart.js 자체 캔버스)로 사용자가 2026-07-05 재개 확정 — `#tv-widget-kr`의 TradingView iframe을 `fetchKrDailyCandles()`(js/aio-data.js) + `loadKrCandleChart()`(index.html, floating-bar 캔들+거래량+MA20, Chart.js core만 사용·신규 플러그인 없음)로 완전 대체. US technical/fundamental 페이지의 TradingView 임베드(정상 작동 중)는 무변경. 라이브 curl로 파서 검증(120/120건, OHLC 정합성 위반 0)했으나 Chrome 확장 미연결로 실브라우저 캔버스 렌더링은 미확인 — QA-CHECKLIST 등록. 상세는 BUG-POSTMORTEM.md P610 참조. |
| B9 | CODEX-COMPREHENSIVE-DIAGNOSIS WO-6 완료 게이트 잔여분 ("모든 값"의 전면 provenance 리트로핏) | **이건 §1 "진짜 블록"이 아니라 순수 엔지니어링 규모 문제** — 데이터·시간·운영자 결정 어느 것도 막고 있지 않음. Codex 원문 완료 게이트("모든 값에 source/observedAt/publishedAt/fetchedAt/freshnessClass/fallbackReason", "snapshot 대표 시각과 필드 시각 분리", "감사 가능한 source lineage export")를 문자 그대로 만족하려면 20개 페이지에 표시되는 개별 값 전체에 대한 다주 단위 리트로핏이 필요 — 단일 세션 범위 밖. | 다음 세션에서 §2 방식(단계별 커밋)으로 이어서 진행 가능 — 우선순위: (1) `DATA_SNAPSHOT` 파일 구조에 필드별 타임스탬프 추가(현재는 파일 전체에 단일 `_updated`만 존재), (2) `getTradingDecisionInputEvidence()`류 결과를 노출하는 전용 UI 패널(현재는 콘솔/AI 컨텍스트 전용), (3) computeTradingScore 외 다른 스코어/게이지(execution window, market regime 등)에도 동일 evidence 레지스트리 패턴 확산 | **2026-07-10, v52.49, P664**: WO-6의 핵심 슬라이스(computeTradingScore 13개 입력의 evidence 추적 + 화면 decision header가 그 evidence를 실제로 소비)는 이번 세션에서 완료. `_context/BUG-POSTMORTEM.md` P664 "범위 밖으로 남긴 것" 참조. |

> 핵심: B1·B2·B3 = **데이터 없음**, B4·B6 = **시간 필요**. 코드로 해결되는 게 아니다. B7(외부 서비스 TradingView 상태 불확실)은 자체 렌더로 대체해 2026-07-05 해소됨(P610), B5(운영자 결정: Worker 재배포)는 2026-07-07 운영자가 실제로 재배포해 해소됨(P638) — 둘 다 더 이상 이 표에 해당 없음. B8(AI 채팅 간헐적 403)은 **운영자 결정도 데이터도 아닌 인프라 제약**(Cloudflare 무료 플랜 리전 미고정 + Anthropic 리전 정책) — 완전 제거는 여전히 불가하지만, 재시도 완화책은 같은 날 구현 완료(v52.44/P659, 채팅+번역+브리핑 3개 함수 전체 적용). B9(WO-6 전면 리트로핏 잔여)는 **엔지니어링 규모 문제일 뿐 진짜 블록 아님** — 핵심 슬라이스는 v52.49/P664에서 완료, 전면 확장은 §2 방식으로 다음 세션 이어서 가능.

---

## 2. 진행 가능 (여기서/다음에 코드로 해결 — "별도 세션" 아님)

OPUS-HANDOFF WO 백로그 + v50.33/34 페이지 잔여 + v50.42 후속에서 도출. v50.43 plan(`fluttering-stirring-squid.md`)의 클러스터 1~3에 해당.

| 항목 | 출처 | 상태 |
|------|------|------|
| home 결론 3중복 통합 (conclusion-bar + trading verdict + action-item + 정적 설명) | v50.33 잔여 | v50.43 C1 진행 |
| breadth 차트 6행 통합·압축 (카드+현재+히스토리 3중) | v50.33 잔여 (v50.34는 접기 토글만) | v50.43 C1 진행 |
| marketState 광범위 소비자 구독 이전 (채팅 헤더·내러티브·페이지 배너) | v50.42 후속 | v50.43 C2 진행 |
| 중복 재계산 제거 (같은 틱 `_aioRegimeNow`/`getCycleFromMacro`) | v50.42 후속 | v50.43 C2 진행 |
| WO-14 배포 게이트 블록 67건 (signal 31·fxbond 16·themes 12) pass/reference 분류 | OPUS-HANDOFF | v50.43 C3 진행 |
| WO-13 audit 통폐합 (critical-10 5세대 → v50.0 게이트 단일) | OPUS-HANDOFF | v50.43 C3 진행 |
| WO-12 문서 다이어트 (루트 CLAUDE.md 슬림화 + 아카이브) | OPUS-HANDOFF | v50.43 C3 진행 |

### 장기·낮은 우선순위 (진행 가능하나 별도 패스 권장)
- `!important` 325개 CSS 변수 리팩토링 (specificity 정리)
- innerHTML XSS 211건 수동 점검 (대부분 정적 HTML + escHtml 적용 — DOMPurify 게이트로 일부 커버됨)
- index.html 29K줄 페이지 단위 모듈 분리 (CODE-MAP 의존 작업 한계 완화)
- WO-9 script `defer` 적용 (로드 순서 의존성 검증 필요 — core→data→ui→chat)
- WO-11 전면 홈 IA 재설계 (UX 검토 동반 — 초보자 시작 패널은 v50.26 완료, 전면 재조립은 미완)

---

## 3. 다음 세션 작업 목록 (2026-06-14 정리 — v50.50 배포 후)

> v50.42~50 누적 배포 완료 시점 기준. 우선순위 순. 각 항목은 **여기서/다음에 코드로 진행 가능**하며, 진짜 블록(§1)은 별도 표기.

### 우선순위 A — 구조 정합 (코드, 즉시 가능)
| # | 작업 | 근거/위치 | 비고 |
|---|------|-----------|------|
| A1 | **KR stale-days 2-writer 통합** | aio-core.js:2086/2148 `STATIC_CONTENT_LIFECYCLE` "N일 경과" vs index.html:21089 `data-snap-date` "D+N일" — 서로 다른 기준일로 숫자 불일치 위험 | v50.49에서 일반화 시도했으나 **두 경로 통합이 선결**이라 revert. 단일 기준일·단일 포맷터로 합친 뒤 stale 라벨 일반화 |
| A2 | **breadth 차트 통합·압축 (C1B)** | v50.34 접기 토글(`_aioBreadthDetailToggle`)만 적용. 문서엔 추가 통합 언급 있으나 현 코드와 어긋남 | 카드+현재+히스토리 3중 표현 중복 — doc/code 재대조 후 실제 통합 |
| A3 | **marketState 소비자 구독 확산 잔여** | v50.42~44에서 home action·채팅 헤더·4 렌더러 전환 완료. 잔여 내러티브 렌더러/페이지 배너 일부 | `aio:marketStateUpdated` 미구독 소비자 마저 이전 (선순환 완결) |

### 우선순위 B — 운영 정리 (분량 큼, 단계적)
| # | 작업 | 근거 | 비고 |
|---|------|------|------|
| B-WO13 | audit 통폐합 (critical-10 5세대 → v50.0 evidence 게이트 단일) | OPUS-HANDOFF | orphan audit 정리 |
| B-WO14 | 배포 게이트 블록 67건 (signal 31·fxbond 16·themes 12) pass/reference 분류 | OPUS-HANDOFF | 대부분 reference-only 재분류로 해소 예상 |
| B-WO12 | 문서 다이어트 (루트 CLAUDE.md 슬림화 + 아카이브) | OPUS-HANDOFF | 현 루트 CLAUDE.md 비대 — note 아카이브 이전 |

### 우선순위 C — sink 확산 (선택적)
| # | 작업 | 근거 | 비고 |
|---|------|------|------|
| C1 | breadth/sentiment에 `[data-market-analysis-sink]` 확산 | v50.47 잔여 | **주의**: breadth 랠리품질·sentiment 복합판단은 **이미 도메인 렌더러 보유**(aio-ui.js:754 등) → 일반 sink가 덮어쓰면 부적절. 도메인 렌더러 리팩토링 동반해야 안전 |

### 진짜 블록 (§1 재참조 — 코드로 해결 불가)
- B1 KR 정적 데이터 (소스 없음) · B2 미확보 시세 필드 (데이터 도착 대기) · B3 jensen 84일 (신규 자료 필요)
- B4 차트 history 누적 (시간) · B5 Claude 키 서버화 (운영자 결정) · B6 cron 신뢰성 검증 (시간)

### UX 관련 정직 메모 (v50.50 라이브 검증 결론)
에이전트 정적 UX 감사(`PAGE-UX-AUDIT-2026-06-13.md`)의 "빈 껍데기/고장" ★항목 **대부분이 거짓 양성**이었음 — 라이브 직접 점검 결과 macro 스토리라인·온도계(61)·kr-themes(28카드)·kr-macro/kr-technical 모두 정상 렌더, options nav 이미 제거됨, sentiment/breadth verdict 렌더러 보유. **유일한 실증 모순**(home 매매 카드 라벨 vs 결론바)만 v50.50에서 시정. 남은 UX는 버그가 아닌 **주관적 밀도**(긴 페이지=충실 콘텐츠) — 사용자 지목 시 선별 진행. 무차별 "간소화"는 콘텐츠 손실 위험이므로 지양.

---

## 4. v50.51 진행 결과 (2026-06-14 — Priority A 전체 + B 착수)

DEFERRED-BLOCKS §3 우선순위 A 전체 + B 착수 수행.

| 항목 | 상태 | 내용 |
|------|------|------|
| A1 stale-days 통합 | ✅ 완료 | `_aioStaleDays`/`_aioStaleDaysLabel`(aio-core) 단일 헬퍼 신설 — base·now 로컬-일 정규화로 UTC/로컬 off-by-one 제거. **실제 충돌은 data-snap-date writer 2개**(aio-core:17734 "N일 경과" UTC parse vs index.html:21092 "D+N일" local parse)가 같은 `#KEY-stale-days` span을 경쟁 기재한 것 — 보고서의 2086/2148은 시나리오 writer였음(정정). 양 핸들러 + LIFECYCLE getStatus + 시나리오 2곳을 단일 카운터로 라우팅. KR 4카드(deposit/52w-high/52w-low/advance) stale-days span 추가(라벨 일반화). 라이브 검증: 전 span 단일 "N일 경과" 포맷, D+ 0건. |
| A2 breadth 차트 통합 | ✅ 완료 | SECTION 5-B(`bh-*` 히스토리 4캔버스) **제거** — `bp-*`(SECTION 5)가 동일 5/20/50 시장폭 + S&P·나스닥 듀얼라인을 일별 전체 사이클 + 라이브 스냅샷 override로 표시하므로 정적·저밀도 bh 세트는 중복. `initBreadthCharts()`/`_refreshBreadthHistoryCharts` retired(no-op). bp 제목/aria 정직화. 8→4 캔버스. 라이브 검증: bp 5인스턴스 렌더·bh 제거·콘솔 JS 0. |
| A3 marketState 구독 확산 | ✅ 완료 | `aio:marketStateUpdated` 리스너(aio-core:3002)에 `renderDynamicMarketNarratives`+`generateMacroStoryline` 추가(idempotent·additive). 채팅 헤더는 질의 시점 on-demand read라 구독 불요(갭 아님). 라이브 검증: 두뇌 갱신 시 narrative sink 동기화·에러 0. |
| WO-12 문서 다이어트 | ✅ 완료 | 루트 CLAUDE.md 227줄(26K토큰)→~75줄(최근 5버전+CHANGELOG 포인터). `_context/CLAUDE.md` 209→~95줄(버전 노트 제거+버전 v50.41→v50.50 정정). **CHANGELOG-ARCHIVE.md 미신설** — CHANGELOG.md가 이미 v48~v50.50 상세 단일 출처라 중복 회피("누락분만 이전" 조건 충족). |
| WO-14 게이트 블록 분류 | ✅ 착수 완료 | **45 evidence 블록 = 100% `kind:live`**(환경 의존, 운영서 해소·재분류 대상 아님). 트레이딩 로직 0블록. 텍스트 블록 signal 3→0·fxbond 1→0(reference archive 마킹 + staleDate 오탐 미들닷 시정)·themes 0. 잔여 17건=비우선 페이지 금융용어 오탐. `GATE-BASELINE §6`에 분류 기록. **보고서의 "67블록"은 대부분 환경 의존 live**임을 실증. |
| WO-13 audit 통폐합 | ⚠️ 착수(평가)·통합 보류 | critical-10 4함수는 **dead 아님** — 별개 lens(surface/situation/matrix)·각자 다른 반환 shape·freshness audit/AUDIT_REGISTRY/autoOps 소비·T724~736 핀·RULES 의무·이미 `buildEvidenceStore` 엔진 공유. 유일 진짜 중복(matrix 이중정의)은 **v50.44에서 이미 해소**(_deadV49112). 추가 thin-wrapper 병합은 테스트·룰 계약 파손 위험 큰 대비 이득 미미 → **무리한 통합 지양, 보류**(정직 결론: 통폐합 전제가 중복도 과대평가). |
