---
verified_by: Codex
last_verified: 2026-07-27
audited_repository_version: v53.52
repository_advanced_during_documentation: v53.53 P845 compatibility-facade initialization fix; no Web Research or public-data finding in this document was changed by that concurrent patch
status: DESIGN_ONLY
implementation_authorized: false
project_skills_used: none
confidence: high for repository code and current public artifacts; medium for provider behavior that requires an authorized key; blocked for live conversational answer certification because no public chat route exists
evidence_scope: js/aio-chat.js, Cloudflare Worker source and tests, current public-data artifacts, operations and reconciliation artifacts, current official Anthropic web-search/search-result/citation documentation
depends_on:
  - AI-SCREENER-INTELLIGENCE-REBUILD-HANDOFF-2026-07-27.md
  - API-AI-CHAT-RELIABILITY-REMEDIATION-HANDOFF-2026-07-27.md
---

# Web Research·핵심 데이터 구조 개편 핸드오프

> 목적: AIO의 Web Research와 핵심 데이터를 “검색이 실행됐는가”와 “파일에 값이 있는가”가 아니라, **질문별로 필요한 최신·공식·시점 정렬 Evidence가 충분하며 각 주장에 결속됐는가**로 판정하도록 재구축한다.
>
> 이 문서는 진단·기획·설계 자료다. 제품 코드, 데이터, 키, Worker, 배포 상태는 변경하지 않았다.

## 0. 최종 판정

현재 AIO에는 Perplexity, Google Custom Search, Claude native web search 경로가 존재한다. 최신성·실적·뉴스·원인·컨퍼런스·정성 분석 키워드도 상당수 감지한다. 그러나 다음 명제는 아직 참이 아니다.

> “스크리너 범위 밖 또는 최신 정보가 필요한 질문은 항상 Web Research로 전환되고, 핵심 주장은 신뢰 가능한 최신 출처로 검증된 뒤 답변된다.”

현재 상태는 다음과 같다.

| 영역 | 현재 판정 | 이유 |
|---|---|---|
| Web Research 코드 경로 | 존재 | Perplexity → Google 폴백과 Claude native search가 있음 |
| 모든 공개 사용자 검색 | 보장 안 됨 | 검색 키 또는 사용 가능한 Claude 경로가 필요 |
| 최신성 질문 검색 판정 | 부분 | 정규식 중심이며 명시적 `ResearchDecision`이 없음 |
| 범위 밖 질문 전환 | 불완전 | `OUT_OF_SCOPE_RESEARCH` intent와 범위 판정 계약 없음 |
| 단순 교육 질문 무검색 | 부분 | 일부 정규식 예외만 있고 혼합 질문 분리가 약함 |
| 복합 질문 분해 검색 | 사실상 미연결 | `_aiDeepSearch()`는 정의됐지만 실제 `chatSend()` 경로에서 호출되지 않음 |
| 검색 실패 처리 | 위험 | 실패 로그 후 기존 답변을 계속 생성 |
| 출처 신뢰도 | 불충분 | 공식 1차 자료와 기사·의견·집계 사이트가 체계적으로 분리되지 않음 |
| claim-source 결속 | 없음 | 답변 하단 URL 목록은 있으나 어떤 문장을 어떤 출처가 지지하는지 강제하지 않음 |
| 데이터 커버리지 | 숫자상 양호, 의미상 부분 | 16/16·845/870·74.3%가 세션·필드·최신성·권리·질문 적합성을 대표하지 못함 |
| 서버 AI 분석 품질 gate | 실패 | 실제 오류·혼동이 `semanticStatus=verified`를 통과 |

따라서 개편의 핵심은 검색 공급자를 하나 더 붙이는 것이 아니다.

1. 질문마다 검색 필요성을 구조화한다.
2. 검색 결과를 문서가 아니라 Evidence로 정규화한다.
3. 질문 유형별 최소 데이터 요건을 계산한다.
4. 데이터가 부족하면 검색·질문·부분답변·차단 중 하나를 명시적으로 선택한다.
5. 검증된 Claim만 화면에 렌더한다.

## 1. Web Research 현재 실행 경로 재진단

### 1.1 현재 경로

```text
질문
  → _needsWebSearch()
       ├─ Perplexity 키 있음 → Sonar 검색
       ├─ Google key + cx 있음 → Google CSE 스니펫
       └─ 둘 다 없음 → 검색 미실행
  → 검색 요약 문자열을 system prompt에 주입
  → 별도로 _shouldUseClaudeWebSearch()
       └─ Claude 경로가 있고 휴리스틱 충족 → native web_search tool
  → 자유형 스트리밍 답변
  → 출처 URL을 답변 아래 별도 목록으로 표시
```

이 구조는 검색 경로의 존재를 보여 주지만 Research 품질 계약은 아니다.

### 1.2 확정 이슈 원장

#### WR-P0 — 답변의 사실성과 현재성을 직접 훼손

| ID | 현재 증거 | 위험 | 구조적 조치 |
|---|---|---|---|
| WR-P0-01 | `_needsWebSearch()`는 Perplexity 또는 완성된 Google CSE 키가 없으면 즉시 `null` | 검색이 필수인 질문도 일반 답변 경로로 진행 | 키 유무와 분리된 `ResearchDecision.required=true` 생성 |
| WR-P0-02 | 검색 호출 실패 시 로그만 남기고 기존 답변 계속 | 최신 원인·실적·정책 질문에서 기억 기반 오답 | 필수 검색 실패 시 current/causal claim 차단 |
| WR-P0-03 | `_aiDeepSearch()`는 정의만 있고 실제 전송 경로 호출 없음 | 복합 원인·기업·섹터 질문이 단일 검색어 1개에 의존 | `ResearchPlan.subQueries[]`를 실제 Orchestrator가 소유 |
| WR-P0-04 | 검색 요약 전체와 URL 최대 5개를 문자열로 주입 | 문장별 근거를 확인할 수 없음 | `EvidenceDocument → EvidenceChunk → Claim.evidenceIds[]` 결속 |
| WR-P0-05 | Google 스니펫을 학습 데이터로 교차검증하라는 prompt | 오래된 모델 기억이 최신 검색을 오염 | 모델 기억은 현재 사실 검증 수단에서 제외 |
| WR-P0-06 | Claude server-tool 오류는 HTTP 200 내부 error block일 수 있으나 현재 UI는 명시적 Research 실패로 승격하지 않음 | 검색이 실행된 것처럼 보이거나 조용히 무검색 답변 | tool result의 error code를 Research 상태로 파싱 |
| WR-P0-07 | 공개 채팅 route가 `NO_ROUTE` | native web search도 공개 사용자가 실행 불가 | Chat readiness와 Research readiness를 별도 capability로 공개 |

#### WR-P1 — 출처·범위·시간 품질을 약화

| ID | 현재 증거 | 위험 | 구조적 조치 |
|---|---|---|---|
| WR-P1-01 | Perplexity 도메인 목록에 언론·의견·집계 사이트가 혼재하고 SEC·Fed·BLS·BEA·기업 IR이 없음 | 공시·거시·실적 질문도 2차 기사 중심 | claim type별 공식 1차 source policy |
| WR-P1-02 | Google CSE는 `lr=lang_ko&gl=kr` 고정 | 미국·글로벌 질문도 한국어 검색 편향 | 질문의 시장·지역·언어별 locale 계획 |
| WR-P1-03 | 현재/오늘이면 day, 그 외 week라는 단일 recency | 분기 실적·13F·정책·구조 변화에 부적합 | claim type별 lookback window |
| WR-P1-04 | `_buildSearchQuery()`가 150자로 절단 | 긴 복합 질문의 후반 엔터티·기간·조건 소실 가능 | 구조화된 subquery별 독립 길이·필드 |
| WR-P1-05 | Deep Search 보조 쿼리에 `2026` 하드코딩 | 연도 변경 시 자동 부패 | `currentDate`, fiscal period, market session 주입 |
| WR-P1-06 | Claude native search는 `web_search_20250305` 기본형 | 현재도 지원되나 동적 필터링·응답 포함 제어 미사용 | gateway capability negotiation 후 버전 선택 |
| WR-P1-07 | 검색 UI는 “최신 정보 N건 수집”으로 표시 | 발행일·원문 확인·출처 등급을 검증하지 않아도 성공처럼 보임 | `검색됨`, `원문 확인`, `claim 사용`, `conflict` 분리 |
| WR-P1-08 | native search citation도 하단 URL 목록으로 평탄화 | 인용 위치와 cited text 손실 | citation block을 claim 단위로 보존 |
| WR-P1-09 | 사용자 opt-out·일일 cap이 필수 최신성 요구보다 먼저 검색을 중단시킬 수 있음 | required research가 optional처럼 조용히 축소 | `RESEARCH_REQUIRED_BUT_UNAVAILABLE` 명시 |
| WR-P1-10 | 검색 공급자 health가 AI Worker health와 분리되지 않음 | 채팅 가능하지만 검색 불가인 상태를 모름 | provider/model/tool별 capability probe |

#### WR-P2 — 비용·UX·확장성

| ID | 문제 | 구조적 조치 |
|---|---|---|
| WR-P2-01 | 티커 감지 시 단순 질문도 항상 사전 검색 가능 | 교육·정적 회사 설명·현재 질문을 분리 |
| WR-P2-02 | 검색 캐시가 query 문자열 5분 기준 | market session, result revision, source update를 cache key에 포함 |
| WR-P2-03 | Perplexity 요약과 Google 스니펫의 품질 계약이 같음 | provider별 `contentDepth`와 사용 가능 claim 유형 분리 |
| WR-P2-04 | 검색 결과 중복·동일 원문 재배포 탐지 없음 | canonical URL·syndication cluster로 독립 출처 수 계산 |
| WR-P2-05 | 검색 비용이 질문 난이도와 연결되지 않음 | fast/deep research budget과 최대 subquery 수 분리 |

### 1.3 공식 플랫폼 제약을 반영한 설계

2026-07-27 확인 기준 공식 Anthropic 문서는 다음을 명시한다.

- Web search는 현재 정보와 인용을 제공한다.
- `web_search_20250305`는 기본 검색으로 계속 지원된다.
- `web_search_20260209`는 동적 필터링을, `web_search_20260318`는 응답 포함 제어를 추가한다.
- 최신 버전은 모델 지원과 `allowed_callers` 구성이 필요하므로 무조건 문자열만 바꾸면 안 된다.
- server tool 오류는 HTTP 200 응답 안의 tool-result error로 반환될 수 있다.
- 외부 검색 결과를 `search_result` block으로 주입하면 source/title/content와 인용 위치를 보존할 수 있다.
- citations와 strict structured output은 같은 응답에서 호환되지 않는다.

참고:

- https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/server-tools
- https://platform.claude.com/docs/en/build-with-claude/search-results
- https://platform.claude.com/docs/en/build-with-claude/citations

따라서 목표는 다음 2단계다.

1. strict `QuestionPlan`, `ResearchPlan`, `ClaimLedger`를 생성·검증한다.
2. 검증된 SearchResult/Evidence만 별도 citation-capable presentation pass 또는 deterministic renderer로 표시한다.

## 2. 검색 여부를 결정하는 새 계약

### 2.1 ResearchDecision

```text
ResearchDecision
  requirement: REQUIRED | OPTIONAL | NOT_NEEDED | FORBIDDEN
  reasons[]
  questionClass
  currentSensitive
  causalSensitive
  outOfScope
  requestedByUser
  freshnessSlo
  sourcePolicyId
  minimumIndependentSources
  minimumPrimarySources
  maxResearchBudget
  failureMode
```

검색 키가 없더라도 `requirement`는 바뀌지 않는다. 실행 가능 여부는 별도 상태다.

```text
ResearchCapability
  provider
  routeReady
  authReady
  toolReady
  quotaReady
  supportsCitations
  supportsFullContent
  supportsDomainControl
  checkedAt
```

### 2.2 질문 유형별 기본 정책

| 질문 | 검색 정책 | 이유 |
|---|---|---|
| “채권 금리가 뭐야?” | `NOT_NEEDED` | 시점 비민감 개념 설명 |
| “현재 10년물 금리가 왜 올랐어?” | `REQUIRED` | 현재값·원인·이벤트 필요 |
| “NVDA는 무슨 회사야?” | `OPTIONAL` | 최신 사업구조 보강 가능, 핵심 개념은 공시 snapshot 사용 |
| “NVDA 이번 실적 어땠어?” | `REQUIRED` | 최신 공시·IR·실적 시각 필요 |
| “왜 반도체가 하락해?” | `REQUIRED` | “지금”이 없어도 원인 질문은 현재성 내포 가능 |
| “SW 섹터 구조를 설명해줘” | `OPTIONAL` | taxonomy 중심, 최신 리더십 요청 시 required로 승격 |
| “오늘 SW 섹터가 왜 약해?” | `REQUIRED` | breadth·가격·뉴스·event timeline 필요 |
| 앱 범위 밖의 최신 일반 질문 | `REQUIRED + OUT_OF_SCOPE_RESEARCH` | 모델 기억 단정 금지 |
| 앱 범위 밖의 비시점 일반지식 | `OPTIONAL` | 짧게 답하고 필요할 때만 검색 |
| 사용자가 “검색하지 마”라고 요청한 최신 질문 | `REQUIRED_BUT_DISABLED` | 현재 사실은 답하지 않고 제한 설명 |

### 2.3 혼합 질문 분해

“채권 금리가 뭐고, 오늘 왜 올랐으며 주식에는 어떤 영향이야?”는 하나의 정규식 결과가 아니다.

```text
Part A CONCEPT_EXPLANATION → 검색 불필요
Part B CURRENT_STATE       → 공식 시세/세션
Part C CAUSE_ATTRIBUTION   → Web Research 필수
Part D TRANSMISSION        → 관측과 조건부 추론
```

각 부분은 서로 다른 Evidence 요건과 실패 방식을 가진다.

## 3. 목표 Research Plane

```text
QuestionPlan
  → ResearchDecision
  → ResearchPlanner
       ├─ premise query
       ├─ official/primary query
       ├─ event/news query
       ├─ counter-hypothesis query
       └─ source-conflict query
  → Provider Gateway
       ├─ Official adapters
       ├─ Claude web search
       ├─ Perplexity
       └─ Google CSE
  → Fetch / Normalize / Deduplicate
  → Source Authority & Rights Gate
  → Time Alignment
  → EvidenceDocument / EvidenceChunk
  → Claim candidates
  → Cross-source validation
  → ClaimLedger
  → Policy validation
  → Answer renderer + inline citations
```

### 3.1 ResearchPlan

```text
ResearchPlan
  planId
  questionId
  market
  entities[]
  eventWindow
  priceReactionWindow
  subQueries[]
    queryId
    purpose
    claimTypes[]
    locale
    allowedDomains[]
    blockedDomains[]
    recency
    primaryRequired
  stopConditions
  budget
```

### 3.2 검색 결과 정규화

```text
EvidenceDocument
  documentId
  canonicalUrl
  title
  publisher
  author
  publishedAt
  updatedAt
  fetchedAt
  sourceTier
  sourceType
  primaryOrSecondary
  rights
  contentDepth: FULL_TEXT | EXCERPT | SNIPPET | SUMMARY
  locale
  entities[]
  eventTime
  status

EvidenceChunk
  chunkId
  documentId
  text
  section
  citedText
  extractionMethod
  integrityHash
```

`SNIPPET`과 외부 모델의 `SUMMARY`는 구체 수치·공식 가이던스·직접 인용의 단독 근거가 될 수 없다.

### 3.3 인과 분석용 시간 정렬

```text
EventEvidence
  eventId
  announcedAt
  firstReportedAt
  sourcePublishedAt
  marketSession
  affectedEntities[]
  expectedDirection
  surprise

ReactionEvidence
  instrument
  windowStart
  windowEnd
  return
  abnormalReturn
  volumeZ
  breadthChange
  ratesFxChange
```

기사 제목과 하락이 같은 날이라는 이유만으로 인과를 확정하지 않는다.

최소 조건:

1. 사건이 가격 반응보다 먼저 공개됐다.
2. 관련 자산·동종군·시장 반응이 가설과 일치한다.
3. 최소 하나의 대안 가설을 검토했다.
4. 직접 근거가 없으면 `가능성` 또는 `복합 요인`으로 표시한다.

## 4. 출처 정책

### 4.1 claim 유형별 우선순위

| Claim 유형 | 1순위 | 2순위 | 단독 근거 금지 |
|---|---|---|---|
| 현재 시세·거래량 | 거래소/승인 시세 공급자 | 검증된 보조 공급자 | 검색 스니펫·기사 |
| 기업 실적·가이던스 | SEC/거래소 공시·기업 IR | Tier 1 보도 | 블로그·집계 요약 |
| 경영진·M&A·규제 | 공식 공시·기관 발표 | Tier 1 보도 | 소셜·의견 |
| 매크로 발표 | BLS·BEA·Fed·FRED·BOK·KOSIS | Tier 1 보도 | 검색 요약 |
| 애널리스트 컨센서스 | 라이선스된 원자료 | 복수 보도 | 단일 기사 제목 |
| 시장 원인 | 공식 사건 + 복수 독립 보도 + 가격 반응 | 검증된 전문 분석 | 단일 headline |
| 산업 구조·TAM | 회사 공시·정부·산업협회·원연구 | 검증된 리서치 | 검색 모델 요약 |
| 교육 개념 | 내부 검증 지식 | 공식 교육 자료 | 최신 검색 강제 불필요 |

### 4.2 source tier와 독립성

동일 Reuters 기사를 여러 포털이 재게시해도 독립 출처는 1개다. 다음을 기준으로 cluster한다.

- canonical URL
- 원 저작권자·wire source
- 제목·본문 유사도
- 같은 발표문을 그대로 옮긴 기사
- 동일 analyst note를 재인용한 기사

`minimumIndependentSources=2`는 링크 2개가 아니라 독립 취재·공식 자료 2개를 의미한다.

### 4.3 검색 성공 상태

```text
NOT_RUN
RUNNING
RESULTS_FOUND
PRIMARY_CONFIRMED
MULTI_SOURCE_CONFIRMED
CONFLICT
INSUFFICIENT
RATE_LIMITED
AUTH_FAILED
TOOL_ERROR
DISABLED_BY_USER
```

사용자 UI의 “웹검색 ✓”는 폐기한다. 대신 예:

```text
Web Research: 복수 출처 확인
공식 1차 1건 · 독립 보도 2건
사건 기준 20:10 KST · 가격 반응 20:10~20:40 KST
미확인: 옵션 수급
```

## 5. 핵심 데이터 재감사

### 5.1 현재 public artifact 실증

2026-07-27 11:39 UTC 생성 artifact 기준:

| 영역 | 표면 수치 | 실제 의미 |
|---|---:|---|
| Tier 0 시장 snapshot | 16/16 | 9 `STALE`, 7 `DELAYED`, 16개 모두 session `UNKNOWN` |
| 일반 quote artifact | `quotesPublished=false` | broad quote는 브라우저 직접 fetch 의존 |
| screener | 845/870 | 행별 관측시각과 필드 커버리지가 균일하지 않음 |
| screener 상단 `factorObservedAt` | 2026-07-27 | 845행 중 702행은 2026-07-23, 13행은 7/24, 130행만 7/27 |
| 펀더멘털 coverage | 74.3% | 필드별·최신성별 coverage가 아님 |
| SEC 저장 | 539/655 eligible | 실패 16, 최신 fiscal period 품질은 별도 |
| FMP | 미활성 | `fmpHasKey=false`, `fmpOk=false` |
| 뉴스 | 34건 | Tier 1 2, Tier 2 1, Tier 3 28, Tier 4 3 |
| FRED | 27 key | 현재 수집 성공 |
| BLS | 6 series | cached-fresh |
| 유료 심리 | AAII/NAAIM/II blocked | 정확 수치 생성 금지 |
| 한국 핵심 | VKOSPI·수급 blocked | 승인 공급자·권리 미확보 |

### 5.2 시장 snapshot의 의미 오류

현재 snapshot은 값이 존재해도 다음 문제를 가진다.

- 모든 instrument의 `session`이 `UNKNOWN`이다.
- 미국 지수·미국 10년물의 이전 거래일 종가가 pre-market 시점에 `STALE`로 표시된다.
- “정상적인 휴장/장전 기준 종가”와 “수집 장애로 오래된 값”을 구분하지 못한다.
- `fetchedAt`은 최신이어도 `observedAt`은 며칠 전일 수 있다.
- `allowedUse=reference`인데 화면·AI가 current 판단으로 승격할 위험이 있다.

필요 상태:

```text
CURRENT_SESSION
PREVIOUS_CLOSE_EXPECTED
DELAYED_IN_SESSION
STALE_UNEXPECTED
MARKET_CLOSED
HOLIDAY
PREMARKET
AFTER_HOURS
SOURCE_UNAVAILABLE
```

### 5.3 screener 관측시각 불일치

상단 한 개의 `factorObservedAt`으로 전체 데이터가 최신처럼 보이면 안 된다.

필수 개편:

- 행별 `observedAt` 분포 공개
- 시장·국가·거래일별 coverage
- 최신 batch와 이전 batch가 섞였는지 `mixedRevision=true`
- 질문 대상 행의 실제 관측시각 사용
- 화면 상단에는 `latest`, `median`, `oldest`, `currentCoveragePct`를 함께 표시
- mixed revision에서는 비교·랭킹 사용 범위를 자동 축소

### 5.4 펀더멘털 coverage 과대 표현

현재 706개 미국 성공 행 기준:

| 필드 | 존재 수 | 대략 coverage |
|---|---:|---:|
| PE | 61 | 8.6% |
| PB | 63 | 8.9% |
| ROE | 496 | 70.3% |
| margin | 539 | 76.3% |
| revenue growth | 539 | 76.3% |
| fundamental period 존재 | 539 | 76.3% |

SEC `fundamentalObservedAt` 연도:

- 2026: 48
- 2025: 445
- 2024 이하: 46
- 일부 예: NVDA 2022, MA 2021, GE 2018, NEE 2012

따라서 `fundamentalCoveragePct=74.3`만으로 “기업 분석 데이터가 74.3% 준비됨”이라고 표시하면 안 된다.

새 지표:

```text
FieldCoverage
FreshnessWeightedCoverage
LatestFilingCoverage
QuarterlyCoverage
ValuationCoverage
GrowthCoverage
BalanceSheetCoverage
CashFlowCoverage
EntityMatchConfidence
RestatementStatus
```

기업 답변에서 최신 10-Q/10-K가 없으면 오래된 annual fact를 현재 기업 상태로 사용하지 않는다.

### 5.5 뉴스가 원인 분석을 충분히 지지하지 못함

현재 34건 중 Tier 1/2는 3건뿐이며 31건이 Tier 3/4다. topic도 analyst·semi·fxbond에 편중돼 있다.

현재 artifact는 다음에는 유용하다.

- 최근 headline 탐색
- 추가 조사 후보 생성
- 화면의 뉴스 목록

하지만 다음의 단독 근거로는 부족하다.

- 시장 전체 하락의 확정 원인
- 기업 실적·가이던스의 정확 수치
- M&A·규제·경영진 변경
- “지금 매수할 종목” 선별

필수 보강:

- 원문 또는 공식 발표 fetch 상태
- canonical publisher
- article publishedAt와 eventAt 분리
- headline-only 표시
- topic coverage와 geographic coverage
- 중복 wire clustering
- 가격 반응 시간 정렬
- claim 사용 가능 여부

### 5.6 서버 AI 분석문 gate가 실제 오류를 통과

현재 `public-data/data.json`의 서버 생성문은 다음을 포함한다.

- 실제 VIX는 17.68인데 본문은 `VIX 39(Fear&Greed)`라고 작성해 VIX와 F&G를 혼합했다.
- `oneLine`은 요약이 아니라 `# 현재 시장 분석` 헤더다.
- 뉴스와 자산 반응의 인과 표현이 Claim 단위 Evidence 검증 없이 작성됐다.
- 그럼에도 `semanticStatus=verified`, `semanticIssues=[]`다.

따라서 현재 semantic gate는 “시장 분석의 의미 정확성”을 인증하지 않는다.

필수 validator:

- metric identity: VIX와 F&G 분리
- value/unit/category
- observedAt/source
- headline vs body
- cause wording strength
- event-before-reaction
- oneLine semantic role
- stale/reference 사용 범위
- unsupported current claim

## 6. 질문별 핵심 데이터 요구사항

| 질문 유형 | 필수 Evidence | 없을 때 |
|---|---|---|
| 현재 시장 상태 | session, 지수, VIX, breadth, rates, DXY, observedAt | 현재 판정 보류 |
| 시장/섹터 하락 원인 | 위 상태 + event timeline + 복수 출처 + 가격 반응 | 원인 확정 금지 |
| 반등 가능성 | trend, breadth, volatility, catalysts, invalidation | 확률 금지, 조건만 제시 |
| 섹터 분석 | ETF, equal-weight, constituent breadth, subsector, leaders/laggards, revisions, valuation, flow | 가능한 축과 누락 축 분리 |
| 종목 분석 | current quote, OHLCV, latest filing, earnings, guidance, valuation, revisions, news | 빠진 축을 현재 상태로 추측 금지 |
| 차트 분석 | split-adjusted OHLCV, volume, timeframe, session, corporate events | 구체 지지·저항·진입가 금지 |
| 매크로 | official release, prior, consensus, revision, release time, cross-asset reaction | 관측과 일반론만 제공 |
| 환율 | USD/KRW, DXY, KR-US curve, CNH, JPY, flow/intervention evidence | 원인 단정 금지 |
| 채권 | curve, real yield, inflation expectations, policy expectation, auction/event | 단일 금리로 주식 방향 확정 금지 |
| 옵션 | chain, timestamp, IV, OI, volume, spreads, Greeks, event | 옵션 수급·감마 원인 주장 금지 |
| 한국 시장 | KRX/Koscom-approved quote, VKOSPI, 외국인/기관 수급, 공매도, FX | current causal/action 답변 제한 |
| 포트폴리오 행동 | 사용자 동의, 보유·비중, 기간, 손실감내, 현금, 제약 | 개인화 행동 문장 금지 |

## 7. Data Readiness의 새 판정 방식

### 7.1 단일 coverage 폐기

질문별 readiness는 다음 다차원 점검의 결과다.

```text
DataReadiness
  availability
  entityCoverage
  fieldCoverage
  freshness
  marketSessionAlignment
  sourceAuthority
  pointInTimeIntegrity
  revisionConsistency
  conflictStatus
  rights
  allowedUse
  questionFit
```

한 축이라도 P0 필수 조건을 충족하지 못하면 `READY`가 아니다.

### 7.2 Answerability Matrix

```text
READY
PARTIAL_EXPLICIT
RESEARCH_REQUIRED
CLARIFICATION_REQUIRED
BLOCKED_MISSING
BLOCKED_STALE
BLOCKED_CONFLICT
BLOCKED_RIGHTS
BLOCKED_ROUTE
```

예:

```text
질문: "지금 미국 반도체가 왜 하락해?"
premise: PARTIAL
market session: PREMARKET
sector quote: PREVIOUS_CLOSE_EXPECTED
sector breadth: MISSING_CURRENT
event research: REQUIRED_BUT_NO_ROUTE
answerability: PARTIAL_EXPLICIT
allowed answer:
  - 마지막 확인 종가 기준 조정 여부
  - 현재 확인할 조건
blocked:
  - "지금 하락 중" 확정
  - 원인 확정
  - 종목 진입 지시
```

## 8. 사용자 화면 계약

### 8.1 답변 상단 데이터 캡슐

모든 current/causal/company/sector 답변에 다음을 노출한다.

```text
기준: 2026-07-27 20:39 KST
세션: 미국 장전
사용: VIX(15분 지연), USD/KRW(지연), SMH/SOXX(직전 종가)
Research: 실행 불가 — 공개 AI/검색 경로 없음
누락: 섹터 현재 breadth, 옵션 수급
판정 범위: 직전 종가 기반 참고 분석
```

### 8.2 claim 인라인 근거

하단 URL 더미가 아니라 다음 구조로 렌더한다.

```text
“회사의 분기 매출 가이던스가 상향됐다.” [공식 IR · 발표 07-27 06:00 ET]
“발표 후 시간외 주가는 +4.2%였다.” [승인 시세 · 관측 07-27 06:30 ET]
“섹터 약세의 단독 원인이라고 보기는 어렵다.” [AIO 추론 · 대안 가설 2개]
```

### 8.3 누락 정보도 핵심 정보

누락을 접힌 디버그 영역에 숨기지 않는다.

- 답변 결론에 영향을 주는 누락
- 다음 확인 시점
- 사용자가 직접 제공할 수 있는 정보
- 자동 수집 예정 여부
- 라이선스/권리로 영구 차단된 정보

## 9. 자동화·지속 운영 계약

### 9.1 Research capability 자동 점검

매 배포/일정 실행에서 비밀값 없이 다음을 기록한다.

```text
providerConfigured
routeReachable
authProbeStatus
toolVersion
modelSupportsTool
quotaRemainingClass
lastSuccessfulSearchAt
lastCitationCount
lastPrimarySourceCount
lastToolError
```

Worker `/health`가 AI 호출 가능만 표시해서는 부족하다. `webSearch.ready`를 별도로 노출한다.

### 9.2 Data quality 자동 점검

매 artifact 생성 시:

- 행별 observedAt 분포
- mixed revision
- 필드별 coverage
- freshness-weighted coverage
- latest filing coverage
- source-tier distribution
- session UNKNOWN count
- headline-only news count
- rights unresolved count
- conflict count
- required category blocked count

이 값은 `operations-status.json`과 UI 진단 화면에 동일 revision으로 연결한다.

### 9.3 drift 감시

- 검색 tool version과 모델 지원 drift
- source domain 정책 drift
- 시장 휴장·세션 calendar drift
- filing taxonomy drift
- entity/ticker alias drift
- 뉴스 source tier drift
- 질문별 required Evidence drift
- 답변 claim 오류율 drift

## 10. 실행 우선순위와 소유권

### P0 — 전문가가 직접 설계·구현

1. `ResearchDecision`과 `Answerability` state machine
2. 검색 필수 실패 시 fail-closed
3. Research Plane과 ClaimLedger 결속
4. source authority·rights·independence 정책
5. event-price causal alignment
6. session-aware market evidence
7. screener mixed-revision·행별 observedAt gate
8. freshness-weighted fundamental coverage
9. 서버 시장 분석 semantic validator
10. 공개 Chat/Research route의 실제 운영 정책

### P1 — 명확한 계약 후 하위 에이전트 수행 가능

- 공식 source domain registry 입력
- locale·alias·sector taxonomy fixture 확장
- 상태 배지와 데이터 캡슐 UI
- source card·missing card 컴포넌트
- provider별 mock error fixture
- field coverage 표 생성
- 문서 링크·aria-label·도움말
- canonical URL 정규화의 기계적 규칙

### P2 — 후속 최적화

- query cache와 dedup 최적화
- research budget UI
- citation 카드 접기/펼치기
- 사용자 피드백과 claim 연결
- cost/latency dashboard

하위 에이전트는 P0의 정책·스키마·허용 용도를 바꾸지 않는다. P0 계약이 확정된 뒤 정형화된 UI·fixture·registry 작업만 맡긴다.

## 11. 검증 전략

사용자가 요청한 비용 정책을 유지한다.

| 시점 | 검증 |
|---|---|
| 개별 작업 | 관련 ResearchDecision·source·readiness fixture 10~30개 |
| P0 하위 Wave 완료 | 해당 영역 50~120개 |
| Research Plane 통합 | 대표 370문항 smoke |
| 최종 후보 | 4,440 fixture 전체 1회 |
| 배포 직전 | 개인키·Worker·Perplexity·Google 경로별 critical live |
| 운영 | 일일 capability probe, 주간 critical, 월간 full |

### 11.1 Web Research 필수 fixture

- 키 없음
- Vault locked
- Worker route 없음
- tool unsupported model
- 일일 quota 초과
- HTTP 200 안의 tool error
- 검색 결과 0건
- snippet만 존재
- 공식 자료와 기사 충돌
- 같은 wire 기사 중복
- 발행시각이 가격 반응 이후
- 오래된 기사만 존재
- 사용자가 검색 opt-out
- 단순 교육 질문
- 교육 + 현재 원인 혼합 질문
- 앱 범위 밖 최신 질문
- 긴 복합 질문의 후반 entity 보존
- 연도 변경

### 11.2 데이터 필수 fixture

- session UNKNOWN
- 정상적인 previous close
- 휴장
- mixed row revision
- 상단 observedAt과 행 observedAt 불일치
- coverage 높지만 필수 필드 없음
- 오래된 SEC fact
- latest 10-Q 누락
- headline-only news
- Tier 3/4만 존재
- rights blocked
- missing과 zero
- source conflict
- 같은 값·다른 단위
- revision된 macro release

## 12. 인수 조건

### Web Research

- [ ] 검색 필요성이 키 유무와 독립적으로 계산됨
- [ ] `OUT_OF_SCOPE_RESEARCH`가 first-class intent
- [ ] 복합 질문이 실제 subquery로 분해됨
- [ ] 하드코딩 연도 0
- [ ] 필수 검색 실패 시 current/causal claim 0
- [ ] 공식 1차 source policy가 claim 유형별 적용됨
- [ ] 검색 요약·스니펫을 단독 확정 근거로 사용하지 않음
- [ ] 독립 출처 수가 syndication을 제거해 계산됨
- [ ] 각 factual claim에 evidenceId와 인라인 citation 존재
- [ ] tool error·quota·opt-out이 사용자에게 정확히 표시됨
- [ ] Chat ready와 Research ready가 분리됨

### 핵심 데이터

- [ ] market session `UNKNOWN` 0 또는 명시적 blocked
- [ ] previous close와 unexpected stale 분리
- [ ] screener 상단/행 observedAt 불일치가 숨겨지지 않음
- [ ] mixed revision에서 비교·랭킹 자동 제한
- [ ] 필드별·최신성별 fundamental coverage 노출
- [ ] 오래된 filing이 현재 상태로 승격되지 않음
- [ ] 뉴스 source tier·content depth·event time 존재
- [ ] 인과 답변에 event-price alignment 존재
- [ ] rights unresolved 자료가 판단용으로 사용되지 않음
- [ ] 질문별 Answerability가 UI와 AI에 동일하게 적용됨

### AI 품질

- [ ] VIX/F&G 등 metric identity 혼동 0
- [ ] 숫자·단위·범주·기준시각 오류 0
- [ ] `oneLine`이 실제 요약인지 검증
- [ ] unsupported cause 0
- [ ] 검색 미실행 상태에서 최신 사실 단정 0
- [ ] 데이터 누락을 모델 기억으로 채운 사례 0

이 조건을 충족하기 전에는 “Web Research가 모든 범위 밖·최신 질문을 자동 처리한다”거나 “핵심 데이터가 빠짐없이 최신 상태로 AI 답변에 반영된다”고 확정하지 않는다.
