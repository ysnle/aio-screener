---
verified_by: Codex
last_verified: 2026-07-27
repository_version: v53.55
deployed_live_reference_version: v53.54
status: IMPLEMENTED_LOCAL_AIQ_0_3
implementation_authorized: true
implementation_progress:
  completed_local: AIQ-0 through AIQ-4 plus AIQ-5/6 benchmark and operations contract scaffolds
  pending: AIQ-5 live model benchmark, public Worker, blind review, and AIQ-6 production/operator validation
project_skills_used: none
confidence: high for code, artifacts, routing rules, and the reproduced server-generated analysis; blocked for paid live conversational model benchmark because the public chat route is unavailable
evidence_scope: current repository, deployed no-route chat behavior, public-data artifacts, GitHub Actions-generated market analysis, current AI/Anthropic architecture documentation, financial QA benchmark papers
depends_on:
  - API-AI-CHAT-RELIABILITY-REMEDIATION-HANDOFF-2026-07-27.md
  - WEB-RESEARCH-CRITICAL-DATA-REMEDIATION-HANDOFF-2026-07-27.md
  - AI-CHAT-INSTITUTIONAL-AUDIT-2026-07-12.md
  - AIO-STRUCTURAL-REMEDIATION-MASTERPLAN-2026-07-27.md
---

# AI Screener Intelligence 전체 재구축 핸드오프

> 목적: AIO의 AI를 “긴 프롬프트를 가진 일반 챗봇”이 아니라, 현재 화면과 데이터 파이프라인을 정확히 조회하고 검증된 계산과 조건부 분석을 제공하는 **Evidence-bound Screener Analyst**로 재구축한다.
>
> 이 문서는 v53.52 저장소 코드와 v53.51 배포 라이브를 분리해 진단한 설계·실행 계약이다. 코드 수정, 실제 개인키 사용, Worker 배포, 모델 유료 벤치마크, 버전 변경, 커밋·배포는 수행하지 않았다.

## 0. 최종 결론

현재 AIO에는 다음 요소가 이미 존재한다.

- 22개 채팅 컨텍스트
- 시세·기술·스크리너·뉴스·매크로·포트폴리오 주입 경로
- 개인 Claude 키와 Worker 경로
- 웹검색 조건부 호출
- 공통 응답 파이프라인과 행동 차단 게이트
- Evidence·claim·conversation·retrieval 관련 신규 ESM 계약
- 추천 반복 감점과 섹터·시장·시총 분산 후보 로직

그러나 이 구성만으로 “수준 높은 AI 주식 스크리너”라고 판단할 수 없다.

가장 중요한 현재 결함은 다음과 같다.

1. **신규 ESM AI 계약이 실제 채팅 실행 경로의 주인이 아니다.**  
   `src/ai/*`는 `AIO.getAIContext()`까지 노출하지만 실제 `chatSend()`는 여전히 `js/aio-chat.js`의 긴 문자열 프롬프트·legacy fetch·DOM 후처리 경로를 사용한다.
2. **질문 해석이 금융 질문의 본질을 분류하지 못한다.**  
   `왜 하락하는가`, `반등 가능한가`, `어느 종목에 들어갈까`, `SW 섹터 분석` 같은 대표 질문이 원인·전망·행동·섹터 intent로 구조화되지 않는다.
3. **현재성·원인·행동이 서로 다른 검증 계약을 쓰지 않는다.**  
   현재값을 읽는 것, 하락 원인을 추론하는 것, 사용자가 무엇을 할지 설명하는 것이 한 프롬프트에 섞인다.
4. **typed claim은 prompt 요청일 뿐 강제 출력이 아니다.**  
   모델이 claim envelope를 제출하지 않으면 경고만 붙고 자유형 답변이 노출된다.
5. **공통 안전 게이트를 통과한 뒤 별도 DOM 카드가 행동 지시를 다시 생성한다.**  
   차트 판독 후처리는 `분할 매수`, `손절 $...`, `눌림목 매수`를 공통 정책 밖에서 출력한다.
6. **스크리너의 연구용 상대 랭킹이 추천 검증처럼 승격된다.**  
   공개 artifact는 `research-relative-ranking-only`, `predictiveValidation=not-established`, `liveModelParity=false`인데 prompt는 “실시간”, “객관적”, “추천 후보”라고 표현하고 Maker-Checker는 랭크만으로 `CONFIRMED`를 표시한다.
7. **실제 서버 생성 분석의 semantic gate가 품질을 인증하지 못한다.**  
   F&G 범주 오분류와 인과 추정이 `semanticStatus=verified`를 통과했다.
8. **답변 다양성은 표현의 무작위성이 아니라 질문 적합성으로 관리돼야 하는데 현재는 prompt 문장과 추천 티커 감점에 치우쳐 있다.**
9. **공개 채팅 경로가 없으므로 실제 대화형 답변 품질은 아직 인증할 수 없다.**
10. **Web Research는 구현돼 있지만 검색 필요성·실행 가능성·검색 성공·claim 인용이 하나의 계약으로 묶여 있지 않다.** 검색 키가 없거나 호출이 실패하면 최신·원인 질문도 일반 답변으로 계속될 수 있고, 정의된 Deep Search는 실제 전송 경로에 연결되지 않았다.
11. **핵심 데이터의 단일 coverage 숫자가 질문별 답변 가능성을 과대 표시한다.** 현재 screener 상단 관측일과 845개 행의 관측일이 혼재하고, 펀더멘털 74.3%는 PER/PBR·최신 filing·필드별 완전성을 뜻하지 않는다.

현재 공개 판정:

| 영역 | 판정 |
|---|---|
| 서버 정기 AI 시장분석 생성 | 실제 작동, 품질 gate 불충분 |
| 공개 무키 채팅 | NO-GO |
| 개인키 채팅 코드 | 조건부 경로 존재, 실답변 미인증 |
| 질문 routing | 대표 실사용 질문에서 불완전 |
| 현재 데이터 grounding | 부분 구현, 실행 경로 분열 |
| 숫자 정확성 | 일부 가격/NFP 검사, 전 영역 인증 아님 |
| 원인 분석 | headline·prompt 의존, causal engine 없음 |
| 종목 추천 | 연구 후보 제공은 가능, 추천 효능·행동 정당화 불가 |
| 다중 턴 | lifecycle 계약 존재, 실제 모델 회귀 미인증 |
| 답변 다양성 | 추천 반복 완화 일부, 질문 적합성 benchmark 부재 |
| 확장성 | 모듈 뼈대는 존재, legacy 채팅이 병목 |

## 1. 제품의 설계 의도와 본질

AIO의 AI는 다음 세 가지 중 첫 번째여야 한다.

| 형태 | 정의 | AIO 목표 여부 |
|---|---|---|
| Evidence-bound Screener Analyst | 앱의 현재 데이터·차트·스크리너를 조회하고 사실·추론·조건을 분리 | 목표 |
| 일반 금융 챗봇 | 학습 기억과 웹검색으로 그럴듯한 설명 생성 | 목표 아님 |
| 자동 매매 추천기 | 종목·가격·비중을 직접 지시 | 목표 아님 |

### 1.1 AI가 제공해야 하는 고유 가치

일반 LLM보다 나아야 하는 지점은 문체나 유명 투자자 이름이 아니다.

1. 사용자가 보는 화면과 같은 값을 읽는다.
2. 각 값의 관측시각·출처·허용 용도를 보존한다.
3. 종목·섹터·시장·거시·포트폴리오를 동일 Evidence graph에서 연결한다.
4. 현재 사실, 원인 가설, 전망 조건, 사용자 행동 지원을 분리한다.
5. 데이터가 없거나 상충하면 그 사실을 답변의 핵심으로 올린다.
6. 계산은 검증된 도구가 수행하고 모델은 의미를 해석한다.
7. 사용자의 질문 수준에 맞는 깊이로 답한다.
8. 분석 결론이 바뀌는 조건과 무효화 조건을 설명한다.

### 1.2 좋은 답변의 최소 구조

모든 질문에 같은 6단계 템플릿을 강제하지 않는다. 질문에 따라 다음 블록에서 필요한 것만 선택한다.

```text
직답
사실 확인 / 전제 확인
핵심 Evidence
분석 또는 메커니즘
대안 가설 / 반대 논리
확인 조건 / 무효화 조건
사용자에게 필요한 추가 정보
출처·기준시각·데이터 한계
```

### 1.3 “다양성”의 정확한 정의

답변 다양성은 같은 사실을 매번 다르게 말하는 것이 아니다.

- 동일 snapshot의 동일 질문: 핵심 사실·결론은 안정적이어야 한다.
- 질문 목적이 다르면: 답변 구조와 깊이가 달라야 한다.
- 추천 후보 질문: 특정 유명 종목·AI 테마 반복을 억제해야 한다.
- 초보자 질문: 용어와 메커니즘을 먼저 설명해야 한다.
- 숙련자 질문: 상대강도·breadth·revision·민감도·반례를 제공해야 한다.
- 후속 질문: 이전 문장을 반복하지 않고 새 정보와 변경 조건을 추가해야 한다.

즉 목표는 `random diversity`가 아니라 `intent-appropriate diversity + fact consistency`다.

## 2. 현재 실행 아키텍처 실측

### 2.1 실제 경로

```text
사용자 질문
  → 정규식 intent/ticker/sector 감지
  → 여러 legacy fetch와 문자열 context 병렬 조립
  → 최대 약 90K자 prompt
  → Claude 자유형 streaming text
  → 행동 regex / typed-claim 선택적 검사
  → 답변 DOM 렌더
  → 차트·시뮬레이션·추천 검증 등 별도 DOM 후처리
```

신규 구조는 별도로 존재한다.

```text
EvidenceStore
  → createEvidenceRetriever()
  → buildEvidenceContext()
  → createAIContextManifest()
```

하지만 실제 `chatSend()`는 `AIO.getAIContext()` 또는 `createAIResponseEnvelope()`를 주 실행 경로로 사용하지 않는다. 결과적으로 신규 아키텍처가 선언한 계약과 사용자가 받는 답변이 동일하지 않다.

### 2.2 자유형 출력의 한계

현재 `callClaude()` 요청은 다음 특성을 가진다.

- 자유형 streaming text
- 일반 12,000, thinking 16,000 max tokens
- system prompt 문자열 분할 cache
- 조건부 `web_search_20250305`
- strict JSON schema output 없음
- typed tool call 없음
- 답변 후 regex와 문자열 검사

Anthropic의 현재 API는 strict structured output과 typed tool use를 지원한다. 현재처럼 자유형 답변에서 regex로 결론·수치·행동을 다시 추출하는 구조는 최신 API 능력을 활용하지 못한다.

### 2.3 프롬프트 내부 상충

현재 prompt에는 다음 지시가 함께 존재한다.

- 행동 질문이면 `보유/추가매수 금지/비중축소/헤지/관망` 결론을 명시
- Bull/Base/Bear 확률 합계 100 강제
- 기관 프레임 1~3개 인용 강제
- 구체 매수·매도·손절·목표가·비중 지시 금지
- 단순 질문에서는 형식을 완화

이 지시는 서로 충돌한다.

예:

- 행동 결론을 요구하면서 행동 문장을 차단한다.
- 근거가 없는 시나리오 확률을 강제하면서 추측을 금지한다.
- 질문과 무관해도 기관 프레임 인용을 요구하면서 간결한 직답을 요구한다.

모델 품질이 좋아도 상충 prompt는 일관성과 비용을 악화시킨다.

## 3. 실제 생성 결과 품질 실증

### 3.1 공개 채팅

공개 무키 사용자의 질문은 모델로 전달되지 않고 다음 안내에서 종료된다.

> AI 답변을 쓰려면 Claude 키를 저장하세요. 브리핑/번역은 운영자 서버키 가능, 채팅은 개인키 또는 Worker 서버키 모드 필요.

따라서 공개 사이트에서 아래 실사용 질문을 연속 실행해도 현재는 질문별 답변 차이를 평가할 수 없다.

### 3.2 실제 서버 Claude 생성문

`public-data/data.json`의 실제 생성 결과:

```text
model: claude-haiku-4-5
semanticStatus: verified
Fear & Greed 원본: score=39, rating=fear
```

생성문 일부:

```text
Fear & Greed 지수 39(극도의 공포)로 위험회피 심화
```

확정 문제:

1. 원본 범주는 `fear`인데 답변은 `극도의 공포`라고 잘못 분류했다.
2. `oneLine` 필드에 실제 한 줄 요약이 아니라 `# 현재 시장 분석` 헤더가 저장됐다.
3. 금리·달러 움직임에서 “금리 인하 기대감 반영”을 직접 인과처럼 서술했지만 해당 인과를 검증하는 evidence가 없다.
4. 뉴스 헤드라인을 시장 원인으로 승격할 때 발표시각과 가격 반응의 시간 정렬을 검증하지 않는다.
5. 그럼에도 `semanticStatus=verified`다.

원인:

`validateMarketAnalysisText()`는 현재 빈 응답과 NFP 10배 단위 오류만 검사한다. F&G 범주, 각 수치, source/asOf, 인과 표현, 헤더/oneLine, 뉴스 시간 정렬을 검증하지 않는다.

### 3.3 계약 테스트의 과대해석

다음 검사는 통과한다.

- NFP scale gate
- inferred claim schema
- capability claim contract

그러나 위 실제 오류도 함께 통과한다. 현재 테스트는 “계약 함수가 존재한다”는 증거이지 실제 분석 정확도 인증이 아니다.

## 4. 실사용 질문 routing·데이터 적합성 감사

아래 질문은 사용자가 실제로 입력할 가능성이 높은 표현을 그대로 사용했다.

| 질문 | 현재 분류/동작 | 현재 결함 | 목표 intent |
|---|---|---|---|
| 지금 미국 반도체가 하락중인데 어떻게 해야 될까? | `LATEST_CHECK`; action intent 아님 | 전제·섹터·보유상태·행동 권한 분리 없음 | `VERIFY_PREMISE + SECTOR_DIAGNOSIS + ACTION_SUPPORT` |
| 지금 어느 종목을 들어가는 게 좋을까? | `LATEST_CHECK`; “들어가다” action 미감지 | suitability 없이 generic 분석, broad recommendation regex도 불일치 | `SCREEN_CANDIDATES + SUITABILITY_REQUIRED` |
| 지금 왜 반도체가 하락 중이야? | 최신성만 감지 | causal intent 없음 | `CAUSE_ATTRIBUTION + SECTOR` |
| 왜 반도체가 하락 중이야? | 일반 분석; 기본 native web search도 보장 안 됨 | “지금”이 없으면 최신 원인 검색이 빠질 수 있음 | `CAUSE_ATTRIBUTION + FRESHNESS_REQUIRED` |
| 지금 왜 시장 전체가 하락 중이야? | 최신성 감지 | 시장 하락·breadth·cross-asset·event timeline 계약 없음 | `CAUSE_ATTRIBUTION + MARKET_REGIME` |
| 다시 반등 및 상승할 수 있을까? | `GENERAL_ANALYSIS` 가능 | 전망·시나리오 intent 미감지 | `CONDITIONAL_OUTLOOK` |
| SW 섹터 분석해줘 | `DEEP_RESEARCH` | `SW` alias 미지원, “분석”은 sector compare fetch를 발동하지 않음 | `SECTOR_ANALYSIS` |
| 소프트웨어 섹터에서 좋은 종목 골라줘 | 비교/추천과 sector 감지 | 현재 추천 효능 미확립, 시점 표현 왜곡 | `SECTOR_SCREEN + SUITABILITY` |
| 이 기업 좋아? | entity 없음 | 명확화보다 일반론으로 흐를 수 있음 | `ENTITY_CLARIFICATION` |
| NVDA 주식 어때? | ticker + freshness 성향 | 최신 사건 web search가 항상 보장되지 않음 | `COMPANY_QUALITY + CURRENT_STATE` |
| NVDA 차트 분석해줘 | technical/deep | post-card가 행동 게이트 밖에서 매수·손절 지시 | `TECHNICAL_ANALYSIS` |
| 지금 경제와 매크로 분석해줘 | latest/deep/macro | release·revision·market reaction이 한 문자열에 혼합 | `MACRO_REGIME` |
| 환율 왜 이래? | macro linkage | 현재 원인 검색과 한·미 금리차·수급이 보장되지 않음 | `FX_CAUSE_ATTRIBUTION` |
| 채권 금리가 뭐야? | beginner + macro | 단순 교육 질문에도 과도한 시장/기관 프레임 가능 | `CONCEPT_EXPLANATION` |
| 내 포트에서 NVDA를 더 사도 돼? | action/portfolio/ticker | suitability·전송 동의·concentration·세금·기간 계약 필요 | `PORTFOLIO_DECISION_SUPPORT` |
| 이 뉴스 때문에 시장이 빠진 거야? | 최신/뉴스 가능 | 사건과 가격의 시간 정렬·대안 가설 없음 | `EVENT_CAUSALITY_CHECK` |

### 4.1 intent taxonomy 누락

현재 정규식에는 다음 1급 intent가 없다.

- `VERIFY_PREMISE`
- `CAUSE_ATTRIBUTION`
- `CONDITIONAL_OUTLOOK`
- `SECTOR_ANALYSIS`
- `COMPANY_QUALITY`
- `TECHNICAL_ANALYSIS`
- `SCREEN_CANDIDATES`
- `PORTFOLIO_DECISION_SUPPORT`
- `CONCEPT_EXPLANATION`
- `DATA_CHALLENGE`
- `COMPARE_ALTERNATIVES`
- `MONITOR_AND_INVALIDATE`

단어 감지 배열이 아니라 typed `QuestionPlan`이 필요하다.

## 5. 현재 데이터로 질문별 답변 가능성 실증

2026-07-27 artifact 기준:

- 시장 snapshot: 16/16
- S&P 500 관측시각: 2026-07-24, `STALE/reference`
- Nasdaq 관측시각: 2026-07-24, `STALE/reference`
- 미국 10년물: 2026-07-24, `STALE/reference`
- VIX·DXY·USD/KRW: delayed/reference
- screener: 845/870
- factor 관측일: 2026-07-23
- factor 허용 용도: `research-relative-ranking-only`
- fundamental coverage: 74.3%
- ranking predictive validation: 미확립
- 뉴스: 40개, 다수 tier3/4와 제목 중심

### 5.1 “지금 반도체 하락 중”

현재 확인 가능한 연구용 EOD 데이터:

| 자산 | 1개월 | 3개월 | RSI | 50일선 대비 | 관측시각 |
|---|---:|---:|---:|---:|---|
| SMH | -6.73% | +21.67% | 46.9 | -3.12% | 2026-07-23 |
| SOXX | -8.64% | +27.73% | 47.3 | -3.10% | 2026-07-23 |

이 데이터로 가능한 답:

- 최근 한 달 조정과 중기 강세의 공존 설명
- 50일선 아래·200일선 위라는 시간축 분리
- 반등 확인 조건과 추가 약화 조건 설명

이 데이터로 불가능한 답:

- “지금 장중 하락 중” 확정
- 오늘 하락 원인 단정
- 특정 종목 즉시 진입·손절 지시

정상 응답은 먼저 “현재 미국 현물 장중 여부와 SMH/SOXX 최신 관측이 확인되지 않았다”고 밝혀야 한다.

### 5.2 “SW 섹터 분석”

현재 EOD 연구 데이터:

| 자산/종목 | 1개월 | 3개월 | 6개월 | RSI | 50일선 대비 | 200일선 대비 |
|---|---:|---:|---:|---:|---:|---:|
| IGV | -0.25% | -1.83% | -8.68% | 36.3 | -6.11% | -8.70% |
| MSFT | +2.04% | -11.67% | -13.70% | 44.7 | -4.50% | -12.37% |
| CRM | +2.29% | -17.10% | -28.82% | 40.5 | -7.76% | -23.85% |
| NOW | -4.17% | -10.80% | -26.62% | 36.2 | -11.53% | -27.67% |
| PANW | +11.93% | +79.71% | +79.44% | 51.2 | +10.43% | +54.29% |
| CRWD | +7.75% | +57.21% | +64.55% | 47.3 | +3.64% | +40.12% |

가능한 분석:

- IGV와 대형 애플리케이션 소프트웨어 약세
- 보안 소프트웨어와 일반 SaaS의 큰 내부 분산
- cap-weighted 단일 섹터 결론이 내부 리더십을 숨긴다는 설명

추가로 필요한 데이터:

- IGV constituent breadth
- equal-weight 수익률
- earnings revision
- forward valuation
- ARR/RPO·FCF·SBC
- 장기금리 민감도
- ETF flow
- 최근 기업 가이던스와 공식 공시

따라서 좋은 답은 “소프트웨어 전체가 같다”가 아니라 하위 산업별 분해를 제공해야 한다.

### 5.3 “환율 왜 이래?”

현재 관측:

- USD/KRW 1,469.33, delayed/reference
- DXY 101.208, delayed/reference
- 미국 10년물 4.679%, stale/reference

이 세 값만으로 환율 원인을 확정할 수 없다.

필수 추가축:

- 한·미 정책금리와 2Y/10Y 차이
- 위안·엔 동조
- 외국인 주식·채권 수급
- 무역수지·에너지 가격
- 역외 NDF
- 당국 개입/발언
- 글로벌 위험회피

답변은 관측된 방향과 원인 가설을 분리해야 한다.

## 6. 새로 확정된 P0/P1/P2 원장

### P0

| ID | 문제 | 사용자 위험 | 완료 조건 |
|---|---|---|---|
| AIQ-P0-01 | 실제 채팅이 ESM AI 계약을 우회 | 새 아키텍처와 실답변 불일치 | `chatSend`가 단일 AI Orchestrator만 호출 |
| AIQ-P0-02 | 질문별 typed plan 없음 | 원인·전망·행동 질문 오분류 | 대표 질문 routing 98% 이상 |
| AIQ-P0-03 | 자유형 claim 제출 | 숫자 검증 우회 | strict AnswerPlan/ClaimLedger 필수 |
| AIQ-P0-04 | 후처리 카드가 정책 우회 | AI 본문 차단 후 매수·손절 재노출 | 모든 생성 표면 동일 policy/render pipeline |
| AIQ-P0-05 | 연구 랭킹을 추천 검증으로 승격 | 검증 안 된 후보를 확정 추천처럼 표시 | `CONFIRMED` 제거, 허용 용도 보존 |
| AIQ-P0-06 | screener 기준시각을 현재 시각으로 생성 | stale factor가 실시간처럼 보임 | producer observedAt만 표시 |
| AIQ-P0-07 | causal engine 없음 | 뉴스 제목을 하락 원인으로 오인 | 시간 정렬·대안가설·교차자산 확인 |
| AIQ-P0-08 | arbitrary Bull/Base/Bear 확률 강제 | 근거 없는 정밀성 | calibrated model 없으면 확률 금지 |
| AIQ-P0-09 | semantic gate가 사실 전체를 검증하지 않음 | 오분류가 verified 통과 | 모든 numeric/category/asOf/source claim 대조 |
| AIQ-P0-10 | suitability 없이 종목·포트 행동 지원 | 사용자 상황과 무관한 처방 | action permission + 최소 명확화 |
| AIQ-P0-11 | 공개 채팅 경로 없음 | 실사용 불가 | Worker 또는 명확한 개인키 정책 |
| AIQ-P0-12 | current question에서 session 확인 없음 | 휴장·장전·stale를 장중으로 오인 | MarketSessionEvidence 필수 |

### P1

| ID | 문제 | 개편 |
|---|---|---|
| AIQ-P1-01 | sector 질문이 하위 산업을 뭉갬 | sector taxonomy + constituent breadth |
| AIQ-P1-02 | entity 별명·보통주·ADR·시장 모호성 | EntityResolution 단계 |
| AIQ-P1-03 | SEC annual fact가 오래돼도 기업 품질로 사용 | filing period·latest 10-Q/10-K gate |
| AIQ-P1-04 | 검색 출처와 claim 연결 약함 | claim-source citation binding |
| AIQ-P1-05 | web search tool 버전·경로 분산 | gateway가 최신 지원 tool version 관리 |
| AIQ-P1-06 | prompt 과대·상충 | intent별 2~6K token budget |
| AIQ-P1-07 | 추천 다양성만 있고 coverage bias 평가 부족 | region/sector/cap/source exposure |
| AIQ-P1-08 | multi-turn 사실 수정 회귀 미인증 | correction/memory invalidation corpus |
| AIQ-P1-09 | 답변 feedback가 원인 추적 불가 | snapshot/model/prompt/evidence eval 연결 |
| AIQ-P1-10 | novice/expert가 문체 차이에 그칠 위험 | 정보 깊이와 계산 설명 계약 분리 |
| AIQ-P1-11 | 비용·latency가 답변 모드와 연결되지 않음 | fast/deep 모드 SLO와 fallback |
| AIQ-P1-12 | 기업·섹터·시장 결론의 PIT replay 부족 | snapshot-replay benchmark |

### P2

| ID | 문제 | 개편 |
|---|---|---|
| AIQ-P2-01 | 모든 답변에 기관 프레임·3시나리오 과강제 | intent별 renderer |
| AIQ-P2-02 | 단순 교육 질문의 인지부하 | plain explanation mode |
| AIQ-P2-03 | 후속 질문이 가용 데이터와 무관 | capability-aware chips |
| AIQ-P2-04 | 긴 표·배지·카드가 핵심 결론을 분산 | answer card hierarchy |
| AIQ-P2-05 | 자동 시각화가 claim ledger와 분리 | 동일 ViewModel에서 생성 |

## 7. 목표 아키텍처

```text
User Question
  ↓
Conversation / Route / Entity Resolver
  ↓
Intent + Premise + Time Resolver
  ↓
QuestionPlan
  ↓
Capability Planner
  ├─ Market Session
  ├─ Market / Sector / Entity Snapshot
  ├─ Screener
  ├─ OHLCV / Deterministic Calculators
  ├─ Filings / Fundamentals
  ├─ Macro Releases
  ├─ News / Web Evidence
  └─ Portfolio (explicit consent)
  ↓
Evidence Graph + Missingness Matrix
  ↓
Analysis Engine
  ├─ Causal Attribution
  ├─ Relative / Cross-sectional Analysis
  ├─ Scenario Conditions
  └─ Suitability / Action Permission
  ↓
Strict ClaimLedger
  ↓
Claim Validator + Policy Validator
  ↓
Deterministic Answer Renderer
  ↓
Text / Table / Chart / Citations / Follow-ups
```

### 7.1 QuestionPlan

```text
QuestionPlan
  queryId
  intent[]
  entities[]
  market
  timeframe
  requestedDepth
  userLevel
  premise
  currentSensitive
  requiredEvidence[]
  optionalEvidence[]
  requiredTools[]
  suitabilityRequired
  actionPermission
  clarificationQuestions[]
```

### 7.2 Premise 검증

사용자 전제를 그대로 믿지 않는다.

예:

```text
premise: "미국 반도체가 지금 하락 중"
check:
  market session open?
  SMH and SOXX current?
  sector breadth negative?
  move material vs normal volatility?
result:
  VERIFIED | PARTIAL | CONTRADICTED | UNAVAILABLE
```

전제가 확인되지 않으면 답변 첫 문장에서 교정한다.

### 7.3 Evidence Graph

```text
EvidenceNode
  evidenceId
  metric
  entity
  value
  unit
  observedAt
  fetchedAt
  marketSession
  source
  sourceTier
  quality
  allowedUse
  revision

EvidenceEdge
  relation
  fromEvidenceId
  toEvidenceId
  method
  confidence
```

### 7.4 ClaimLedger

모델의 최종 prose 전에 모든 주장 후보를 구조화한다.

```text
Claim
  claimId
  type: FACT | CALCULATION | INFERENCE | SCENARIO | EDUCATION
  text
  evidenceIds[]
  value
  unit
  asOf
  confidence
  allowedUse
  causalStrength
  validationStatus
```

`FACT`와 `CALCULATION`은 자동 대조한다.  
`INFERENCE`는 관측 사실과 분리한다.  
`SCENARIO`는 조건과 무효화 조건을 필수로 한다.

### 7.5 Structured output와 citation의 분리

Anthropic citations와 strict structured outputs는 동시에 사용할 수 없는 제약이 있다. 따라서 2단계로 설계한다.

1. **Analysis pass**: strict tool/JSON으로 QuestionPlan과 ClaimLedger 생성
2. **Presentation pass**: 검증된 ClaimLedger만 사용해 자연어와 인용 블록 생성

또는 UI가 ClaimLedger를 직접 deterministic render하고 모델은 해설 문장만 생성한다.

### 7.6 모든 후처리의 단일화

다음 표면은 AI 본문과 동일한 policy를 통과해야 한다.

- 차트 판독 카드
- 금액/비중 시뮬레이션
- 포트폴리오 추가 시뮬레이션
- Maker-Checker
- 자동 시각화
- 후속 질문
- 다운로드
- 브리핑·번역·시장분석

답변 후 `innerHTML`로 별도 결론을 추가하는 구조를 금지한다.

## 8. 질문 유형별 분석 로직

### 8.1 “왜 하락해?”

필수 순서:

1. 실제 하락 여부와 session 확인
2. 시장·섹터·개별 종목 효과 분해
3. 사건 발표시각과 가격 반응 정렬
4. 금리·달러·변동성·breadth·거래량 확인
5. 최소 2개 대안 가설
6. 확인되지 않은 원인은 `가능성`으로 표시
7. 무엇이 반증하면 원인 해석이 바뀌는지 제시

금지:

- 뉴스 제목 하나를 원인으로 확정
- 종가 하락 뒤 나온 기사를 원인으로 사용
- “차익실현”을 근거 없는 만능 원인으로 사용

### 8.2 “반등할까?”

예측 확률을 임의 생성하지 않는다.

답변:

- 현재 상태
- 반등 확인 조건
- 실패/추가 하락 조건
- 시간축별 차이
- 이벤트 리스크
- 현재 판단을 바꿀 데이터

확률은 PIT calibration이 검증된 모델 결과가 있을 때만 제공한다.

### 8.3 “어느 종목이 좋아?”

먼저 필요한 최소 질문:

- 시장/국가
- 투자기간
- 허용 손실 또는 변동성
- 이미 보유한 집중 포지션
- 성장/가치/방어 선호

즉시 제공 가능한 것은 `연구 후보군`이다.

후보군에는 반드시:

- 선정 조건
- universe/coverage
- 데이터 기준일
- 강한 팩터
- 약한 팩터
- 제외 조건
- 대체 후보
- earnings/event risk

`BUY`, `CONFIRMED`, `객관적 추천` 표현은 예측 효능이 검증되기 전까지 금지한다.

### 8.4 섹터·테마 분석

필수축:

- sector ETF 절대·상대 수익률
- cap-weighted vs equal-weight
- constituent breadth
- 리더·후발·약세군
- valuation과 earnings revision
- rates/FX/commodity sensitivity
- fund flow
- 주요 공시·실적·정책 이벤트
- 시장 대비 상대강도
- 데이터 coverage

소프트웨어는 최소한 다음으로 분리한다.

- infrastructure/platform
- application SaaS
- cybersecurity
- database/data
- cloud hyperscaler
- IT services

반도체는 최소한:

- GPU/accelerator
- memory
- foundry
- equipment
- analog/power
- networking/custom silicon

### 8.5 “이 기업 어때?”

필수축:

1. entity와 상장주식 종류 확인
2. 사업 모델과 매출원
3. 성장·마진·현금흐름
4. balance sheet와 dilution/SBC
5. valuation과 기대치
6. 최근 filing/earnings/guidance
7. 산업·경쟁·규제
8. 가격·기술 상태
9. thesis / anti-thesis
10. 확인·무효화 조건

SEC 연도 자료가 오래됐으면 최신 기업 상태로 승격하지 않는다.

### 8.6 차트 분석

필수:

- ticker·거래소·조정주가 여부
- timeframe
- market session
- OHLCV coverage
- 추세 구조
- 거래량 확인
- 변동성/ATR
- 지지·저항 산식
- 상대강도
- gap·earnings event
- 반등/이탈 확인 조건

20일 고가·저가를 자동으로 확정 지지·저항 또는 손절가로 표현하지 않는다.

### 8.7 매크로

답변을 다음으로 분리한다.

- 관측값
- 시장 예상 대비 surprise
- 이전치 revision
- 정책 반응 함수
- 자산별 전달 경로
- 현재 가격 반응
- 대안 해석

“금리가 내려서 주식 상승” 같은 단선 인과를 금지한다.

### 8.8 환율

관측과 원인을 분리한다.

- USD/KRW와 DXY
- 미국·한국 단기/장기 금리
- CNH·JPY
- 위험선호와 외국인 수급
- 무역·원자재
- 정책 발언/개입

데이터가 없으면 “현재 확인 가능한 축”과 “확인하지 못한 축”을 나눠 답한다.

### 8.9 교육 질문

“채권 금리가 뭐야?”에는 시나리오 확률·유명 투자자 프레임이 필요 없다.

권장 구조:

1. 한 문장 정의
2. 가격과 금리의 반대 관계
3. 왜 주식에 영향을 주는지
4. 현재 화면에서 어디를 보면 되는지
5. 원하면 현재 수치 연결

## 9. 실사용 Golden Question Corpus

### 9.1 최소 질문군

| 유형 | 예시 수 |
|---|---:|
| 현재 상태 확인 | 20 |
| 원인 분석 | 30 |
| 반등·전망 조건 | 25 |
| 종목 후보·스크리닝 | 30 |
| 섹터·테마 | 30 |
| 기업 품질·밸류에이션 | 35 |
| 차트·기술 | 30 |
| 실적·공시 | 25 |
| 매크로 | 30 |
| 환율·채권 | 25 |
| 포트폴리오 | 25 |
| 교육 | 20 |
| 데이터 반박·출처 확인 | 20 |
| 다중 턴 정정 | 25 |
| 총계 | 370 |

각 질문은 다음 fixture로 반복한다.

- 정상
- stale
- missing
- source conflict
- market closed
- entity ambiguous
- novice
- expert
- 3회 반복 안정성

최소 자동 sample 수는 370 × 핵심 6상태 × novice/expert = 4,440이다. 모든 조합을 매 커밋마다 실행하지 않고 tiered benchmark로 나눈다.

### 9.2 사용자 제공 대표 질문의 기대 행동

#### 질문: 지금 미국 반도체가 하락 중인데 어떻게 해야 될까?

합격 답변:

1. 장중/장전/휴장과 최신 SMH/SOXX 관측을 확인
2. 전제가 확인되지 않으면 교정
3. 최근 조정과 중기 추세를 시간축별 분리
4. 사용자의 보유 여부·기간·손실 감내를 질문
5. 매수 지시 대신 확인/무효화 조건 제공

#### 질문: 지금 어느 종목을 들어가는 게 좋을까?

합격 답변:

1. 즉시 단일 종목을 찍지 않음
2. 투자기간·시장·위험 선호 확인
3. 현재 universe와 coverage 공개
4. 연구 후보 3~5개를 서로 다른 노출로 분산
5. 각 후보의 선정·제외 이유와 이벤트 위험 제공
6. ranking이 예측력 미확립이면 명확히 표시

#### 질문: 왜 반도체/시장 전체가 하락 중이야?

합격 답변:

1. 실제 가격 움직임 확인
2. 확인된 사건과 가격 반응을 시간 정렬
3. 금리·달러·VIX·breadth·sector dispersion 연결
4. 주요 가설과 대안 가설 분리
5. “확인된 원인”과 “가능한 설명” 구분

#### 질문: SW 섹터 분석해줘

합격 답변:

1. IGV만 보지 않고 하위 산업 분해
2. 보안 소프트웨어와 일반 SaaS의 divergence 설명
3. 상대수익률·breadth·valuation·revision·금리 민감도
4. 리더·약세군·확인 조건
5. 데이터 기준일과 coverage

#### 질문: 이 기업/주식 어때?

합격 답변:

1. ticker 확인 또는 명확화
2. 기업 품질과 주식 매력도를 분리
3. 좋은 기업도 비싼 가격이면 다른 결론임을 설명
4. 최신 filing·실적·가이던스·밸류·차트 연결
5. thesis와 anti-thesis

#### 질문: 환율 왜 이래?

합격 답변:

1. USD/KRW 방향·기준시각
2. DXY와 한·미 금리차
3. 위안·엔·위험선호·외국인 수급
4. 확인된 축과 미확인 축
5. 단일 원인 확정 금지

## 10. 평가 기준

### 10.1 자동 평가

| 지표 | 합격 기준 |
|---|---:|
| intent routing | ≥98% |
| entity/time/session resolution | 100% |
| numeric claim/evidence 일치 | 100% |
| unit/direction/asOf/source 오류 | 0 |
| stale를 current로 사용 | 0 |
| missing을 neutral/zero로 사용 | 0 |
| unsupported causal claim | 0 |
| arbitrary probability | 0 |
| policy 우회 DOM 카드 | 0 |
| unsupported recommendation promotion | 0 |
| citation dead link/claim mismatch | 0 |

### 10.2 답변 품질

각 답변을 0~5로 평가:

- directness
- factuality
- freshness
- reasoning coherence
- causal discipline
- uncertainty calibration
- data coverage
- usefulness
- novice/expert fit
- non-redundancy

평균 4.2 이상, factuality/freshness/causal discipline은 각각 4.8 이상을 요구한다.

### 10.3 다양성과 일관성

- 동일 snapshot 3회: 숫자·범주·핵심 결론 불일치 0
- 표현 중복률은 낮추되 핵심 사실은 동일
- broad recommendation 20회: sector/region/cap exposure 보고
- 특정 유명 ticker 반복률 상한
- data coverage가 높은 종목만 자동 승격되는 편향 측정
- 사용자가 질문 조건을 바꾸면 후보와 결론이 이유와 함께 변경

### 10.4 일반 LLM 대비 차별성

동일 모델·동일 질문으로 비교:

1. AIO data/context off
2. AIO legacy giant prompt
3. 새 QuestionPlan + Evidence Graph + tools

비교 지표:

- 사실 정확도
- 현재성
- 계산 정확도
- 출처 결속
- 조건부 분석
- 행동 안전성과 유용성
- latency/cost

AIO 구조가 일반 LLM보다 유의하게 낫지 않으면 “AI 스크리너 우위”를 주장하지 않는다.

## 11. 실행 Wave

### Wave AIQ-0 — 거짓 신뢰 제거

전문가 직접:

- `CONFIRMED`, “실시간 객관 추천” 표현 제거 설계
- factor actual observedAt/allowedUse 전파
- post-response 행동 카드 전수 inventory
- marketAnalysis semantic validator 확대

gate:

- 연구용 랭킹의 추천 승격 0
- gate 이후 행동 문장 생성 0
- 실제 F&G 39 오분류 fixture 차단

### Wave AIQ-1 — QuestionPlan

전문가 직접:

- intent/entity/time/premise resolver
- user examples 포함 routing corpus
- clarification policy

하위 에이전트 가능:

- 한국어 표현·오타·약어·영어 변형 corpus 확장
- `SW/소프트웨어/SaaS/보안SW` alias fixture

### Wave AIQ-2 — Evidence Tool Plane

전문가 직접:

- 시장 session tool
- market/sector/entity/macro/portfolio tool schema
- deterministic calculation registry
- tool 결과 Evidence 계약

하위 에이전트 가능:

- 공급자별 mock fixture
- source/asOf UI badge

### Wave AIQ-3 — ClaimLedger와 renderer

전문가 직접:

- strict output/tool schema
- fact/calc/inference/scenario 분리
- citation binding
- 모든 후처리 단일 renderer 이관

### Wave AIQ-4 — 도메인 분석 엔진

전문가 직접:

- cause attribution
- sector decomposition
- company quality/valuation
- technical conditions
- macro/FX transmission
- suitability/action permission

### Wave AIQ-5 — 실제 모델 benchmark

필요 조건:

- 공개 Worker 또는 시험 전용 개인키
- snapshot 고정
- 비용 한도
- 모델/prompt/retriever/validator 버전 고정

실행:

- smoke 50
- critical 120
- full 4,440
- 2인 blind review 표본
- 일반 LLM A/B

### Wave AIQ-6 — 운영

- model canary
- prompt/retrieval drift
- feedback linkage
- weekly critical benchmark
- monthly full benchmark
- rollback

## 12. 테스트 비용 정책

매 작은 패치마다 전체 4,440문항을 실행하지 않는다.

| 시점 | 검사 |
|---|---|
| 개별 작업 | 관련 intent/contract 10~30개 |
| Wave 종료 | 해당 영역 critical 50~120개 |
| AIQ-3/4 통합 | smoke 370개 |
| 최종 로컬 후보 | full 4,440 |
| 배포 전 | live critical + key/Worker 양 경로 |
| 운영 | 주간 critical, 월간 full |

## 13. 파일 소유권 개편

목표:

```text
src/ai/
  orchestrator/
    question-planner.js
    capability-planner.js
    answer-orchestrator.js
  intent/
    taxonomy.js
    resolver.js
  entity/
    resolver.js
  time/
    market-session.js
  tools/
    market.js
    sector.js
    entity.js
    macro.js
    portfolio.js
    technical.js
    screener.js
    news.js
  evidence/
    graph.js
    completeness.js
  analysis/
    causal.js
    outlook.js
    sector.js
    company.js
    technical.js
    macro.js
    fx.js
  response/
    claim-ledger.js
    validator.js
    renderer.js
  policy/
    suitability.js
    action-permission.js
  eval/
    corpus/
    graders/
    replay/
```

legacy burn-down:

- `js/aio-chat.js`는 UI compatibility adapter만 남긴다.
- `_buildAioIntegratedAnswerContext` giant string 조립 제거
- `_getV48IntegratedContext`를 live chat 입력에서 제거
- 별도 후처리 결론 카드 제거
- `assertChatAnswerStructureAudit`를 실제 ClaimLedger validator로 대체
- `Maker-Checker CONFIRMED` 제거

## 14. 외부 전문 근거

이 설계는 다음 자료의 원칙을 반영한다.

- Anthropic structured outputs: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- Anthropic tool use: https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works
- Anthropic citations: https://platform.claude.com/docs/en/build-with-claude/citations
- Anthropic prompt caching: https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-use-with-prompt-caching
- FinanceBench: https://arxiv.org/abs/2311.11944
- FinQA: https://arxiv.org/abs/2109.00122
- FinBen: https://arxiv.org/abs/2402.12659
- MultiFinBen: https://arxiv.org/abs/2506.14028

FinanceBench와 FinQA가 보여 주는 핵심 교훈은 금융 QA에서 긴 컨텍스트나 모델 명성만으로 정확한 retrieval·수치 추론·근거 연결이 보장되지 않는다는 점이다. FinBen 계열은 단순 QA뿐 아니라 정보 추출·텍스트 분석·생성·리스크·예측·의사결정을 분리 평가해야 함을 보여 준다.

## 15. 최종 인수 조건

- [ ] 공개 또는 개인키 채팅이 실제 호출 가능
- [ ] 사용자 대표 질문 16개 routing 정답
- [ ] 370개 question corpus와 fixture 존재
- [ ] 신규 ESM AI Orchestrator가 실제 채팅의 단일 주인
- [ ] QuestionPlan/ClaimLedger strict schema
- [ ] 사실·계산·추론·시나리오 구분
- [ ] current 질문의 market session 확인
- [ ] cause attribution의 시간 정렬과 대안 가설
- [ ] screener 연구용 allowedUse 보존
- [ ] `CONFIRMED` 추천 오인 제거
- [ ] arbitrary 확률 0
- [ ] post-response policy 우회 0
- [ ] novice/expert 실제 정보 깊이 차등
- [ ] 숫자·단위·범주·asOf·source 오류 0
- [ ] stale/current와 missing/neutral 혼동 0
- [ ] 동일 snapshot 반복 사실 일관성 100%
- [ ] 일반 LLM 대비 A/B 우위
- [ ] 개인키·Worker 양 경로 critical benchmark 통과
- [ ] 최종 full 4,440 benchmark 1회 통과

이 조건을 충족하기 전에는 “높은 품질의 최신 AI 주식 스크리너 답변을 제공한다”고 공개적으로 확정하지 않는다.

## 16. Web Research·핵심 데이터 보강 계약

Web Research와 핵심 데이터의 상세 재감사·스키마·우선순위·인수 조건은 `WEB-RESEARCH-CRITICAL-DATA-REMEDIATION-HANDOFF-2026-07-27.md`를 이 문서의 강제 실행 부속 계약으로 사용한다.

핵심 변경점:

1. 검색 필요성은 API 키 유무가 아니라 `ResearchDecision`으로 먼저 결정한다.
2. `OUT_OF_SCOPE_RESEARCH`, `RESEARCH_REQUIRED_BUT_UNAVAILABLE`, `BLOCKED_ROUTE`를 first-class 상태로 둔다.
3. 복합 질문은 premise·공식 자료·사건·대안 가설 subquery로 실제 분해한다.
4. 검색 결과는 문자열 요약이 아니라 `EvidenceDocument/EvidenceChunk`로 정규화하고 ClaimLedger에 결속한다.
5. 검색 실패·quota·tool error·사용자 opt-out 상태에서는 current/causal claim을 fail-closed한다.
6. snapshot 16/16, screener 845/870, fundamental 74.3% 같은 단일 숫자를 답변 준비 완료로 사용하지 않는다.
7. `availability × field coverage × freshness × session × authority × PIT × conflict × rights × allowedUse × question fit`으로 Answerability를 계산한다.
8. 현재 artifact의 mixed observedAt, session `UNKNOWN`, 낮은 PER/PBR coverage, 오래된 SEC period, Tier 3/4 중심 뉴스, 서버 AI metric 혼동을 P0로 처리한다.
9. 답변 화면에는 사용 데이터·기준시각·검색 상태·누락·판정 범위를 사용자에게 보이는 데이터 캡슐로 표시한다.

이 부속 계약과 본문의 QuestionPlan→Evidence Graph→ClaimLedger 구조는 선택 관계가 아니다. Research 결과와 durable data 모두 같은 Evidence·Claim validator를 통과해야 한다.
