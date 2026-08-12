---
verified_by: Codex
last_verified: 2026-08-12
repository_version: v54.12
status: IMPLEMENTED_LOCAL
implementation_authorized: true
confidence: high_for_repository_artifacts_and_linked_project_documentation_medium_for_unverified_live_provider_behavior
research_as_of: 2026-08-12
depends_on:
  - AUTOMATED-DATA-RELIABILITY-HANDOFF-2026-07-18.md
  - DATA-SOURCE-REPLACEMENT-PLAN-2026-07-14.md
  - WEB-RESEARCH-CRITICAL-DATA-REMEDIATION-HANDOFF-2026-07-27.md
  - AI-SCREENER-INTELLIGENCE-REBUILD-HANDOFF-2026-07-27.md
  - AIO-CURRENT-CODE-REMEDIATION-HANDOFF-2026-08-09.md
---

# 오픈소스 전문 스크리너 비교와 AIO Screener 재설계 핸드오프

> 목적: 전문 스크리너·브라우저형 투자 터미널과 개인 공개 프로젝트 20개를 비교하고, AIO가 가져올 제품 루프·데이터 계약·자동화 구조를 후속 구현자가 바로 실행할 수 있는 패킷으로 고정한다.
>
> 이 문서는 설계와 실행 계약이다. 이번 실행에서 계약·도메인·Workbench adapter·로컬 gate가 추가되었지만, 외부 프로젝트 코드/데이터·공급자 자격증명·PIT 예측 승격은 추가하지 않았다. 외부 프로젝트의 기능 설명과 별 수는 2026-08-12 각 저장소/공식 문서 관측값이며 변할 수 있다.

## 0. 결론

AIO를 지금 전면 재작성하는 것은 권고하지 않는다. 현재 AIO에는 873종목 유니버스, 848종목 팩터 관측, 74.2% 펀더멘털 coverage, 팩터·VCP·레짐 가중치·알림·백테스트·포트폴리오·뉴스·내부자·공매도 데이터가 이미 있다. 문제는 기능 수가 아니라 다음 폐루프가 아직 하나의 계약으로 닫히지 않았다는 점이다.

```text
시장/이벤트 관측
  -> 신선도·권리·필드별 출처 검증
  -> 재현 가능한 ScreenDefinition 실행
  -> 후보별 WhyRanked/WhyRejected
  -> watchlist·메모·알림
  -> T+1/T+5/T+21/T+63 결과 기록
  -> 비용·유동성·생존편향을 반영한 검증
  -> 승격/보류/폐기
```

권고안은 **Hybrid Screener Workbench**다. 기존 GitHub Pages UI와 현재 ESM provider/orchestrator/domain 경로를 유지하면서, 스크리너에 필요한 계약과 상태를 별도 모듈·artifact로 추출한다. 5,000종목·100필드 이상 또는 브라우저 JSON/DOM 예산 초과가 실측될 때만 Parquet + DuckDB-WASM 또는 별도 query API로 이동한다. 빅뱅 재작성 대신 동일 snapshot을 구/신 엔진에 넣어 결과 parity를 검증하는 strangler migration을 사용한다.

가장 먼저 가져올 것은 새 차트가 아니다.

1. 저장·공유 가능한 조건식과 프리셋
2. 필드 레지스트리와 필드별 출처·관측시각·결측 이유
3. 후보 선정/탈락 이유와 데이터 부족 분리
4. 종목·필드 단위 dirty refresh
5. 스크린 실행 이력과 후속 성과 원장
6. PIT 유니버스·거래비용·유동성 검증
7. 자동 레짐은 즉시 랭킹 변경이 아니라 제안→검증→승격 흐름

## 1. 조사 범위와 분류 원칙

### 1.1 포함 기준

- 브라우저에서 직접 쓰는 screener, research terminal, self-hosted workbench
- 조건식·랭킹·백테스트·관심종목·알림 중 2개 이상을 연결한 프로젝트
- 개인 또는 소규모 제작자가 공개한 재현 가능한 저장소
- 데이터 adapter, 스케줄러, provider fallback, point-in-time 검증 등 AIO 구조에 직접 기여하는 비브라우저 사례

### 1.2 제외/보조 기준

- 단일 티커 차트 또는 가격 예측 데모만 있는 프로젝트는 본표에서 제외
- 자동 주문이 중심인 프로젝트는 주문 기능을 채택하지 않고 작업 큐·승인·관측 구조만 참고
- Finviz/TradingView 비공식 scraping wrapper는 서비스 약관·재배포 위험 때문에 데이터 주경로 후보에서 제외
- 별 수는 품질 점수가 아니라 발견성 지표다. 개인 프로젝트 여부는 저장소 소유자와 README 표현을 기준으로 분류했으며 법인/팀 규모를 독립 검증한 결과는 아니다.

## 2. 20개 비교군 요약

별 수는 조사 시점의 근사값이다.

| # | 프로젝트 | 성격/표면 | 조사 시점 별 | 라이선스 | AIO가 배울 핵심 | 반영 판정 |
|---:|---|---|---:|---|---|---|
| 1 | [OpenBB](https://github.com/OpenBB-finance/OpenBB) | 전문 데이터 플랫폼·웹/CLI | 71.8k | AGPL-3.0 | provider 표준화, 확장 가능한 데이터 계층 | 구조 참고 |
| 2 | [Microsoft Qlib](https://github.com/microsoft/qlib) | 기관급 퀀트 연구 | 47.3k | MIT | PIT 연구, workflow·experiment 기록 | 검증 계층 우선 |
| 3 | [Ghostfolio](https://github.com/ghostfolio/ghostfolio) | 셀프호스팅 웹 자산관리 | 9.1k | AGPL-3.0 | 포트폴리오 성과·privacy·PWA | UX/성과 원장 참고 |
| 4 | [Stocksera](https://github.com/guanquann/Stocksera) | 개인 웹 시장정보 터미널 | 777 | MIT | 내부자·공매도·의회·ETF 등 대체 데이터 결합 | 기존 AIO 컬럼화 |
| 5 | [PKScreener](https://github.com/pkjmesra/PKScreener) | 개인 기술 스캐너 | 378 | MIT | 전략 프리셋, 자동 스캔, 알림 | 프리셋/스케줄 참고 |
| 6 | [xang1234/stock-screener](https://github.com/xang1234/stock-screener) | 개인 셀프호스팅 웹 스크리너 | 272 | Apache-2.0 | 80+ 필터, 다중 시장 큐, 부트스트랩 | 강한 직접 참고 |
| 7 | [OpenTerminalUI](https://github.com/Hitheshkaranth/OpenTerminalUI) | 개인/소규모 풀스택 웹 터미널 | 102 | MIT | query builder, custom formula, why-ranked, PIT fundamentals | 최우선 제품 참고 |
| 8 | [RyanJHamby/stock-screener](https://github.com/RyanJHamby/stock-screener) | 개인 웹 스크리너 | 37 | MIT | 간결한 필터 UX | 제한 참고 |
| 9 | [AdvancingTitans/stock-analysis](https://github.com/AdvancingTitans/stock-analysis) | 개인 분석 대시보드 | 21 | MIT | 분석 패널 조합 | 제한 참고 |
| 10 | [crible](https://github.com/maxgfr/crible) | 개인 셀프호스팅 웹/CLI | 1 | MIT | 한 DSL, DuckDB/Parquet, 브라우저 WASM, LKG | 확장 시 최우선 |
| 11 | [tickflow-stock-panel](https://github.com/shy3130/tickflow-stock-panel) | **개인 공개** 셀프호스팅 웹 workbench | 2.7k | MIT + 비상업 고지/데이터 약관 | 선별→백테스트→모니터링→복기, 확장 데이터 | 가장 가까운 비교군 |
| 12 | [Stocknear frontend](https://github.com/stocknear/frontend) / [운영 사이트](https://stocknear.com/) | 개인 창업형 공개 프런트+운영 웹 | 39 | AGPL-3.0 | saved screen→watchlist→note→portfolio 결과 루프 | 제품 루프 최우선 |
| 13 | [AlphaSuite](https://github.com/rsandx/AlphaSuite) | 개인 Streamlit 퀀트 workbench | 236 | MIT | daily pipeline, plugin scanner, 훈련·백테스트 | 플러그인/운영 참고 |
| 14 | [m-turnergane/stock-screener](https://github.com/m-turnergane/stock-screener) | 개인 공개 Streamlit 스크리너 | 44 | MIT | 섹터별 지표·다중 소스·캐시·공개 데모 | 필드 UX 참고 |
| 15 | [Opptrix](https://github.com/Travisun/Opptrix) | 개인/커뮤니티 웹+Electron 연구 workbench | 201 | Apache-2.0 | InstrumentRef, capability/provider registry, multi-market packages | 데이터 계약 최우선 |
| 16 | [OpenAlice](https://github.com/TraderAlice/OpenAlice) | 개인 시작 로컬 웹/desktop 연구 OS | 6.5k | AGPL-3.0 | issue/schedule/inbox/memory, 승인형 작업 | 자동 복기·핸드오프 참고 |
| 17 | [OpenTradex](https://github.com/deonmenezes/opentradex) | 개인 공개 웹 cockpit | 55 | MIT | connector 계약, paper-first, human approval | 연결성/안전 참고 |
| 18 | [QuantDinger](https://github.com/OpenByteInc/QuantDinger) | 소규모 회사 셀프호스팅 웹 OS | 10.5k | Apache-2.0 | API·scheduler·finite job·long worker 소유권 분리 | 운영 구조 참고 |
| 19 | [FinceptTerminal](https://github.com/Fincept-Corporation/FinceptTerminal) | 전문 desktop terminal; 브라우저 아님 | 30.1k | AGPL-3.0 | 100+ connector 범주, cross-domain data | 공급자 카탈로그 참고 |
| 20 | [equity-screening-funnel](https://github.com/stobartj/equity-screening-funnel) | 개인 표준 라이브러리 파이프라인; 브라우저 아님 | 0 | MIT | 레짐→섹터→품질→가치→모멘텀 hard gate | 방법론/반례 참고 |

## 3. 추가 10개 심층 비교

### 3.1 tickflow-stock-panel — AIO와 가장 가까운 개인 제작 사례

README가 개인 공개·비공식 프로젝트임을 명시한다. Polars 전종목 스캔, DuckDB/Parquet, 18개 전략, 팩터 IC/IR, T+1·수수료·슬리피지·손절을 반영한 전략 백테스트, SSE 진행률, 4종 모니터, 트리거 영속화, 장후 파이프라인, 자동 복기와 Feishu 전송을 하나의 웹 workbench로 연결한다.

**가져올 것**

- 전략 카드와 고급 조건식을 함께 제공하는 2단 UX
- `screen run`을 알림 규칙과 복기 보고서의 입력으로 재사용
- 데이터 동기화 상태를 사용자 페이지로 노출
- 제3자 데이터 필드를 동적 메뉴/컬럼으로 등록하는 확장점

**가져오지 않을 것**

- 특정 상용 데이터 key에 대한 결합
- README의 “제로 운영” 표현을 운영 SLO 증거 없이 AIO에 사용
- AI 생성 전략을 검증 없이 실행 가능 상태로 승격

### 3.2 Stocknear — 개인 제작에서 운영 제품으로 발전한 웹 사례

공개 SvelteKit 프런트와 운영 사이트가 연결되어 있다. 운영 문서는 스크린을 저장하고, 후보를 watchlist에 넣고, 추가 시점 가격과 메모를 보존하고, 옵션 흐름·실적 일정·애널리스트·포트폴리오로 교차검증하여 성과를 추적하는 흐름을 명시한다. 옵션·다크풀 등 다수 데이터는 라이선스 공급자에 의존하며 API 재배포 권리가 없어 외부 API를 제공하지 않는다고 밝힌다.

**가져올 것**

- `SavedScreen -> CandidateSet -> WatchlistEntry -> ThesisNote -> Outcome`
- 후보가 발견된 스크린과 통과 조건을 메모에 자동 첨부
- “독립 신호 2개 이상 수렴”을 표시하되 매수 신호로 오인되지 않게 분리
- 필터 자체보다 사용자가 반복 가능한 연구 절차를 배우게 하는 learning center

**주의**

- 유료/라이선스 alt-data를 무료 공개 API처럼 모방하지 않는다.
- AGPL 코드를 직접 복사하지 않고 제품 패턴과 계약만 독립 구현한다.

### 3.3 AlphaSuite — 개인용 데이터 파이프라인과 scanner plugin

Streamlit UI에서 초기 다운로드·daily pipeline·generic/signal scanner·모델 학습·백테스트·포트폴리오 분석을 연결한다. `scanners/`의 독립 파일을 자동 발견해 UI에 올리는 확장 모델이 핵심이다.

**가져올 것**: `ScreenerFieldRegistry`와 `ScreenPluginManifest`를 분리하고, 새 스캐너가 필수 필드·cadence·결측 정책·테스트 fixture를 선언하게 한다.

### 3.4 m-turnergane/stock-screener — 공개 가능한 소형 브라우저 스크리너

Streamlit 공개 데모, 기본·기술·섹터 특화 분석, 다중 소스, 캐시와 batch 처리 패턴을 제공한다. AIO보다 범위와 운영 증거는 작지만 개인이 공유 가능한 단위로 UX를 줄이는 참고가 된다.

**가져올 것**: 기본 사용자에게는 3~6개 필터와 비교표만 먼저 보여주고, 고급 팩터·검증은 단계적으로 펼친다.

### 3.5 Opptrix — multi-market capability registry

브라우저와 Electron이 같은 React UI/Fastify API를 사용하며, `InstrumentRef(시장+자산유형+코드)`와 capability를 기준으로 시장별 provider 우선순위·fallback을 구성한다. 로컬 `.opmd` 시장 패키지, provider SDK, 계획 작업, RSS, 분석 도구를 분리한다.

**가져올 것**

- ticker 문자열만으로 자산을 식별하지 않고 `instrumentId`, MIC, currency, assetType 사용
- 공급자를 회사명이 아니라 capability 집합으로 선택
- 시장마다 사용 가능한 필드가 다름을 `unsupported`와 `missing`으로 분리
- 한국/미국 refresh 큐와 snapshot clock을 분리

### 3.6 OpenAlice — 자동 작업을 durable issue로 만드는 개인 프로젝트

연구 요청을 파일·issue·schedule·inbox·tracked entity로 영속화한다. 타이머가 불투명한 AI endpoint를 부르는 대신, 자기 설명적인 작업을 실행하고 결과를 inbox에 남긴다.

**가져올 것**: 자동 스크린/복기를 `RefreshJob`과 `ReviewIssue`로 기록하고 입력 snapshot, 실행 버전, 산출물, 실패 이유, 다음 실행을 남긴다. 주문 기능은 범위 밖이다.

### 3.7 OpenTradex — connector와 승인 경계

`scan -> AI filter -> human approval -> paper fill -> review`를 명시하고, 12개 connector와 로컬 키·paper-first 원칙을 둔다.

**가져올 것**: 자동화 상태를 `observe`, `suggest`, `approve`, `publish`로 나누고, AI/레짐 엔진은 승인 없이 운영 랭킹 계약을 바꾸지 못하게 한다. 주문 connector는 채택하지 않는다.

### 3.8 QuantDinger — process ownership과 관측성

웹/API, scheduler worker, 장기 실행 worker, 유한 Celery job, PostgreSQL, cache, Prometheus/Grafana/Alertmanager를 역할별로 분리한다. 연구→코드→백테스트→paper/live→monitoring 전체를 다루지만 AIO는 연구·paper 전까지만 참고한다.

**가져올 것**

- API 요청과 장기 refresh/backtest를 같은 프로세스에서 처리하지 않음
- job lease, heartbeat, retry, idempotency key
- provider·queue·artifact age를 단일 operations 화면에서 관측

### 3.9 FinceptTerminal — 넓은 공급자 카탈로그의 이점과 위험

브라우저 사례는 아니지만 공식 문서는 World Bank, IMF, DBnomics, FRED, 시장 feed, DB, streaming 등 100+ connector 범주와 cross-domain 분석을 설명한다.

**가져올 것**: connector 수가 아니라 `공식성, 권리, cadence, revision, 지역, 비용, rate limit, fallback 적합성`을 가진 capability catalog.

**가져오지 않을 것**: 100개 연결을 목표 KPI로 삼는 것. 같은 원천을 재포장한 공급자는 독립 교차검증으로 계산하지 않는다.

### 3.10 equity-screening-funnel — hard gate 반례

시장 레짐→섹터→펀더멘털 품질→가치 정당화→기술 모멘텀의 5단계를 이진 gate로 통과시킨다. 각 단계가 탈락 이유를 출력한다.

**가져올 것**: 데이터 완전성·유동성·거래정지·이벤트 위험처럼 절대 조건은 hard gate로 분리한다.

**가져오지 않을 것**: 모든 전략을 하나의 고정 5단 funnel에 넣는 것. 장기 가치와 단기 모멘텀은 목적함수와 시간축이 다르며, 레짐이 종목 품질 데이터의 결측을 정당화해서는 안 된다.

## 4. AIO 현재 기준선과 정확한 부족분

### 4.1 현재 확인된 강점

| 영역 | 현재 상태 |
|---|---|
| 유니버스 | `public-data/screener.json` 873, 관측 성공 848 |
| 펀더멘털 | 540/728, 74.2%; SEC normalized + 선택적 FMP 모델 |
| 기술/팩터 | momentum, trend, low-vol, size, value, quality, Kalman, VCP/setup |
| 레짐 | 시장 상태와 팩터 가중치 경로, drift marker, breadth/sentiment/macro 입력 존재 |
| 자동화 | `refresh-screener.yml`, `refresh-data.yml`, watchdog, durable/fast plane 설계 존재 |
| 데이터 계층 | `provider -> orchestrator -> normalize -> evidence -> domain -> page` ESM 뼈대 존재 |
| 연구 확장 | 실적, 내부자, 공매도, 뉴스, 테마, 포트폴리오 등 인접 데이터가 이미 존재 |
| 안전 경계 | 랭킹은 `research-relative-ranking-only`; 거래 신호 아님 |

### 4.2 검증으로 확인된 차단점

`public-data/model-validation-status.json`은 `BLOCKED`다.

- point-in-time universe 없음
- 현재 유니버스 기반 장기 검증으로 생존편향 미해소
- turnover, 거래비용, 유동성/수용량 미모델링
- live adaptive weight와 backtest parity 미확립
- predictive validity 미확립

따라서 새 오픈소스의 전략 수, 높은 별 수, AI 기능은 이 차단을 우회하지 못한다.

### 4.3 gap matrix

| 축 | 현재 AIO | 부족한 계약 | 우선도 |
|---|---|---|---:|
| 조건식 | UI 필터와 팩터 프로필 존재 | versioned AST/DSL, 저장·공유·재현 | P0 |
| 설명 | setup/factor 표시는 존재 | 행별 기여·통과·탈락·결측 이유 | P0 |
| 실행 이력 | 최신 snapshot 중심 | 동일 정의의 ScreenRun 원장 | P0 |
| 결과 학습 | 백테스트 artifact 존재 | 실제 발견시점 이후 outcome ledger | P0 |
| 개별 갱신 | 페이지/전체 refresh 중심 | symbol+field dirty queue, dedupe/budget | P0 |
| provenance | row/페이지 lineage 존재 | 필드별 source/observed/filed/fetched 시점 | P0 |
| 공급자 | 여러 API와 fallback 존재 | capability registry, 독립성·권리·quota | P1 |
| 시장 반영 | marketState/레짐 존재 | confidence, hysteresis, 승격 gate, replay | P1 |
| 유니버스 | US/KR curated 873 | PIT 구성종목·상장폐지·corporate action | P1 |
| 검증 | walk-forward/holdout 일부 | 비용·회전율·유동성·live parity | P1 |
| 확장성 | 정적 JSON/브라우저 렌더 | column projection, pagination, query budget | P2 |
| 운영 | workflows/operations artifact 존재 | job lease, per-stage heartbeat, field SLO | P2 |

### 4.4 기존 요소별 유지·보완·재설계 판정

이 표가 외부 프로젝트의 기능을 AIO에 무비판적으로 추가하지 않기 위한 실제 대조 원장이다.

| AIO 요소/구조 | 현재 판정 | 외부 비교에서 확인한 보완점 | 처분 |
|---|---|---|---|
| `src/data` provider→orchestrator→normalize 계층 | 이미 방향이 맞음 | Opptrix의 capability/market registry처럼 지원 시장·필드·fallback을 명시 | **유지+강화** |
| `src/domain/screener` factor/setup 순수 모듈 | 이미 있음 | ScreenDefinition과 explanation이 같은 순수 계산을 호출하게 함 | **유지** |
| GitHub Actions screener/data durable artifact | 이미 있음 | TickFlow/AlphaSuite처럼 단계별 sync 상태·실패 원인·재실행 범위를 노출 | **유지+관측성 보강** |
| 현재 시장/한국·미국 관측시각 분리 | 이미 일부 있음 | InstrumentRef·market calendar를 정본으로 고정 | **유지+정규화** |
| marketState·breadth·레짐 가중치 | 이미 있음 | confidence·hysteresis·replay·fixed/adaptive diff 추가 | **추출·재검증** |
| 시장/섹터/시그널/시총/setup 등 UI 필터 | 이미 있음 | Stocknear처럼 저장·버전·공유 가능한 정의로 전환 | **보완** |
| 팩터 순위/VCP/setup label | 이미 있음 | OpenTerminalUI처럼 왜 선정/탈락했는지 기여도와 반대 근거 표시 | **보완** |
| backtest/factor validation 탭 | 이미 있음, predictive 승격 차단 | Qlib/TickFlow처럼 PIT·비용·유동성·live parity를 gate로 연결 | **근본 보완** |
| watchlist·메모·알림 | 기능은 있으나 screener run과 분절 | Stocknear처럼 발견한 screen version·가격·무효화 조건을 자동 연결 | **연결 재설계** |
| 포트폴리오 | 이미 있음 | screener 후보의 실제 채택/미채택과 후속 성과를 Outcome Ledger로 연결 | **연결 재설계** |
| 실적·내부자·공매도·뉴스·테마 | 이미 별도 표면에 있음 | Stocksera/Stocknear처럼 field registry를 통해 screener column과 교차검증 입력으로 투영 | **통합 보완** |
| `SCREENER_DB` 정적 identity + runtime enrichment | 호환 경계로 유효하나 혼합 위험 | identity master와 ObservationEnvelope를 분리하고 validFrom/validTo 추가 | **점진 분리** |
| `screener.json` 전체 projection | 873종목에는 작동 | crible처럼 규모 gate 초과 시 column projection/Parquet/WASM을 실측 비교 | **조건부 교체** |
| 페이지/전체 중심 refresh | 자동화는 있으나 개별 demand가 약함 | dirty symbol+field queue, dedupe, quota, incremental recompute | **재설계** |
| AI 설명/전략 생성 | 보조 분석 경로가 있음 | 구조화 결과를 해석만 하고 screen 정의·운영 가중치 변경은 승인 필요 | **권한 축소·증거 결속** |
| 브라우저의 임의 provider 직접 fan-out | 일부 fallback 가치 | key·quota·CORS·권리·중복 요청 때문에 durable/fast plane 우선 | **축소** |
| 현재 유니버스 기반 장기 검증 | 연구 참고만 가능 | PIT universe·delisting·filing available date 없이는 성능 승격 금지 | **대체** |
| 새 페이지를 계속 추가하는 방식 | 기능 발견성은 높지만 분절 확대 | Workbench 내부의 builder/result/history/outcome/ops로 수렴 | **중단하고 통합** |
| 자동 주문·AI autopilot | AIO 핵심 범위 아님 | OpenAlice/OpenTradex의 승인·paper-first 구조만 참고 | **도입 금지** |
| Finviz/TradingView 비공식 scraping 주경로 | 권리·안정성 위험 | 공식/승인 source와 reference plane 분리 | **도입 금지** |
| 전면 빅뱅 재작성 | 현재 근거 부족 | dual-run parity와 확장성 trigger 충족 전에는 회귀 위험이 더 큼 | **보류** |

### 4.5 우선 반영 묶음

| 묶음 | 포함 요소 | 기대효과 | 선행조건 |
|---|---|---|---|
| P0 제품 폐루프 | Saved Screen, WhyRanked, ScreenRun, Outcome | 반복 가능한 개인 투자 연구와 실제 개선 측정 | 기존 필터/팩터 inventory |
| P0 데이터 진실성 | FieldRegistry, field provenance, dirty refresh | 결측·stale·unsupported 구분, 불필요한 전체 refresh 감소 | provider/consumer 대사 |
| P1 검증 | PIT universe, filing available date, costs/liquidity | 연구 랭킹의 과대해석 방지와 승격 가능성 확보 | immutable snapshot/run |
| P1 자동 시장 반영 | Regime confidence/hysteresis/replay | 시장 변화 반영과 flip-flop/과최적화 억제 | 고정 랭킹 baseline |
| P2 확장성 | column projection, virtualization, Parquet/WASM spike | 유니버스·필드 확대 시 브라우저 성능 유지 | 실측 trigger 초과 |
| P2 운영 | capability health, job lease/heartbeat, rights/quota | 자동 루프의 실패 탐지와 복구 가능성 | control plane contract |

## 5. UI/UX·프런트엔드 재설계 감사

### 5.1 감사 경계

- 2026-08-12 공개 Pages에서 직접 확인한 화면은 `v54.7`이었다. 저장소 기준 `v54.11`과 같다고 간주하지 않는다.
- 공개 화면은 desktop 기본 viewport에서 스크리너 route를 확인했다. 모바일은 실제 사용자 범위에서 제외하므로 설계·구현·검증 대상에 포함하지 않는다.
- 저장소 `v54.11`에는 공개 화면에 없는 `Screener Workbench` scaffold와 ScreenDefinition JSON editor가 존재한다. 이는 local 설계/구현 표면이며 live 완료로 판정하지 않는다.
- 외부 프로젝트 UI는 저장소 README·공식 learning/documentation과 공개 스크린샷을 기준으로 비교했다. 로그인/유료 기능의 실제 상호작용은 인증하지 않았다.

### 5.2 현재 화면의 강점

| 요소 | 판정 |
|---|---|
| 페이지 제목→기준일→준비도→프리셋→탭→필터→결과 순서 | 기본 정보 위계가 명확함 |
| 기본 9열과 `전체 컬럼 보기` | 22열을 처음부터 노출하지 않는 방향이 맞음 |
| 12개씩 더 보기 | 873개 DOM을 한 번에 렌더하지 않아 현재 규모에 적절함 |
| 시장·섹터·구조·시총·검색 | 핵심 필터가 첫 화면에 있음 |
| 팩터 기준일·유니버스·rank coverage | 최소 데이터 준비도는 노출됨 |
| 연구 전용·매매 신호 아님 경계 | 결과 하단과 지표 설명에 존재 |
| 폼 aria-label, 표 region label, focus style | 접근성 기반이 이미 있음 |
| 차분한 아이보리 테마와 숫자 중심 표 | 장시간 보는 연구 도구 성격에 적합함 |

### 5.3 실측된 UI/UX 문제

#### Desktop

1. **프리셋·설명·KPI·탭·필터가 서로 다른 가로줄에 밀집**해 사용자의 현재 조건과 다음 행동이 한눈에 잡히지 않는다.
2. 활성 조건을 removable chip으로 보여주지 않아 여러 필터를 바꾼 뒤 현재 screen을 재현하기 어렵다.
3. 필터 변경이 즉시 결과를 바꾸지만 `결과 갱신`, `snapshot 고정`, `실행 완료`의 시각적 경계가 약하다.
4. `전체 컬럼 보기`가 13개 이상의 컬럼을 한 번에 여는 all-or-nothing 방식이다. 분석 목적별 column preset이 없다.
5. 현재가가 전부 `—`인 상태에서도 현재가 열이 핵심 폭을 점유한다. 컬럼 단위 readiness를 헤더에서 알려주지 않는다.
6. 공개 DOM에서 기본 헤더는 9개인데 결과 row는 8개 cell로 관찰되어 `추세신뢰도(연구)`와 `VCP 구조`의 의미/정렬이 어긋날 가능성이 있다. 구현 착수 전 semantic table fixture로 재검증해야 한다.
7. 결과 행 클릭의 주 행동이 명확하지 않다. ticker 이동, WhyRanked, watchlist, 비교가 서로 다른 발견 경로에 흩어져 있다.
8. 좌측 전체 앱 navigation이 desktop 폭을 계속 차지해 screener의 비교표 밀도를 낮춘다. workbench에서는 compact/collapse 상태가 필요하다.

### 5.4 local Workbench scaffold의 UX 경계

저장소 `v54.11`의 JSON textarea, `정의 실행/가져오기/내보내기`, 3개의 10px 상태 card는 계약 검증과 개발자 debugging에는 유효하다. 그러나 기본 사용자 표면으로는 다음 문제가 있다.

- JSON AST를 알아야 screen을 편집할 수 있음
- 기존 프리셋과 Workbench 프리셋이 이중으로 보일 가능성
- readiness/run/outcome/operations가 모두 같은 시각 무게를 가져 우선순위가 없음
- WhyRanked가 한 줄 text preview이면 기여도·반대 근거·결측을 비교하기 어려움

따라서 JSON editor는 `개발자/가져오기` drawer로 내리고, 사용자는 visual filter builder를 기본으로 사용한다. ScreenDefinition은 UI 뒤의 canonical contract로 남긴다.

### 5.5 권고 정보 구조

```text
[Screener header]
  이름 · snapshot 시각 · readiness · 연구 경계

[Workflow bar]
  저장된 스크린 ▾  새로 만들기  비교  실행

[Visual filter builder]
  Universe | Hard gates | Rank factors | Events
  [Technology ×] [3M > 10% ×] [RSI 45~70 ×] [+ 조건]

[Result summary]
  873 universe -> 812 ready -> 41 passed -> 7 data unavailable

[Desktop]
  결과 표 65~70% | Why/근거 drawer 30~35%

[History]
  Run diff | Outcome | Operations는 2차 탭
```

핵심은 `조건을 만드는 영역`, `결과를 비교하는 영역`, `왜 뽑혔는지 확인하는 영역`을 한 화면 안에서 구별하는 것이다.

### 5.6 결과 표 개편

#### column preset

| preset | 기본 열 |
|---|---|
| 발견 | 종목, 상대 rank, 1M/3M/6M, setup, 데이터 상태 |
| 퀄리티·가치 | 종목, value, quality, ROE, margin, growth, filing 시점 |
| 추세·스윙 | 종목, 1M/3M, 50/200MA, RSI, VCP, liquidity |
| 리스크 | 종목, volatility, ADR, dollar volume, drawdown, event risk |
| 이벤트 | 종목, earnings 거리, news catalyst, insider, short-interest 상태 |

- 종목 열은 desktop 표에서 sticky로 유지한다.
- 헤더에 sort 방향, 단위, freshness dot을 같이 표시한다.
- `—`는 하나로 쓰지 않고 missing/stale/unsupported/blocked를 icon+text로 구분한다.
- row의 전체 배경을 빨강/초록으로 칠하지 않는다. 색은 숫자와 작은 상태 chip에만 사용한다.
- 열 폭은 내용 유형별 고정 규칙을 두고 숫자는 tabular-nums/right align을 유지한다.
- 행을 누르면 ticker page로 즉시 이동하지 않고 selection을 먼저 만든다. 별도 `기업 보기` 행동을 제공한다.
- 비교 선택은 최대 3~5개로 제한하고 상단 sticky compare tray에 모은다.

### 5.7 설명·시각화 요소

다른 스크리너에서 가져올 시각화는 많을 필요가 없다.

1. **Factor contribution bar/waterfall**: 총 rank가 어떤 팩터로 형성됐는지 양/음 기여 표시
2. **Hard-gate funnel**: universe→ready→통과 단계와 탈락 수
3. **Regime diff**: 고정 가중치와 현재 레짐 적용 후 순위 변화만 표시
4. **Outcome sparkline/strip**: screen 발견 이후 T+1/5/21/63과 benchmark 차이
5. **Freshness/coverage meter**: 값의 질을 score와 분리
6. **Source drawer**: field→source→observed/filed/fetched 시점을 표 형태로 표시

15개 차트 모드를 그대로 가져오지 않는다. heatmap, treemap, scatter는 질문이 명확할 때만 2차 분석 tab에 둔다. rank 설명을 장식용 radar chart로 대체하지 않는다.

### 5.8 시각 언어

- `score/rank`, `confidence`, `data readiness`를 서로 다른 모양과 라벨로 구분한다.
- 상승/하락은 색뿐 아니라 `+/-`, arrow, text를 함께 쓴다.
- stale/unsupported는 빨간 오류가 아니라 회색/호박색 정보 상태로 표현한다.
- 현재 아이보리 테마와 밀도는 유지하되 핵심 CTA만 accent를 사용한다.
- 작은 10px 설명을 핵심 조작 표면에 사용하지 않는다. helper text는 최소 12px, 주요 control은 최소 36px 목표로 한다.
- title 속성만으로 지표 의미를 전달하지 않고 keyboard로 접근 가능한 info popover를 둔다.

### 5.9 접근성·상호작용 계약

- `랭킹/팩터·레짐/백테스트`는 `tablist/tab/tabpanel`, `aria-selected`, 방향키 이동을 구현한다.
- sortable `th role=button` 대신 header 내부 실제 button 또는 동등한 keyboard contract를 사용한다.
- table region 진입 시 가로 스크롤 가능성과 고정 열을 screen reader에 알린다.
- filter 추가/제거와 결과 수 변경은 과도하지 않은 live region으로 알린다.
- WhyRanked chart에는 동일 정보의 text/table 대안을 항상 제공한다.
- loading, empty, no-match, data-unavailable, provider-blocked를 서로 다른 empty state로 설계한다.

### 5.10 프런트엔드 실행 패킷

| 패킷 | 내용 | 선행조건 | 완료 gate |
|---|---|---|---|
| SCR-UX-00 | live/local semantic·visual baseline, 헤더/행 cell parity | SCR-OS-00 | 9 core columns fixture와 1280/1440/1920 desktop screenshot baseline |
| SCR-UX-01 | header/workflow/filter chip/summary IA 개편 | SCR-OS-02~03 | 저장 screen 재현, active filter 전수 표시 |
| SCR-UX-02 | sticky/column preset/row selection/compare tray | SCR-OS-01/04 | keyboard sort, desktop 0 body overflow, 가로 스크롤 중 종목 identity 유지 |
| SCR-UX-03 | Why drawer·provenance·funnel·regime diff | SCR-OS-04/08 | chart/text parity, contrary/missing evidence 노출 |
| SCR-UX-04 | Run history·Outcome·Operations progressive disclosure | SCR-OS-05~07 | main task 방해 없이 2차 tab 접근 가능 |
| SCR-UX-05 | 사용성·접근성·성능 검증 | 전 패킷 | 5개 대표 task, WCAG AA, 저사양 p95 gate |

대표 task는 다음으로 고정한다.

1. 미국 기술주 중 3개월 모멘텀·유동성 조건으로 후보 찾기
2. 선택 종목이 왜 통과했는지와 결측 필드 확인
3. 스크린 저장 후 다시 불러와 동일 결과 hash 확인
4. 두 종목을 비교하고 기업 분석으로 이동
5. 과거 run의 T+21 benchmark 상대성과 확인

## 6. 목표 제품: Screener Workbench

### 5.1 사용자 흐름

```text
[프리셋 선택 또는 조건 작성]
  -> [데이터 준비도 미리보기]
  -> [스냅샷 고정 후 실행]
  -> [통과/탈락/데이터부족 3분류]
  -> [Why ranked + 반대 근거]
  -> [watchlist/alert/review issue]
  -> [성과 시계열과 무효화 조건]
  -> [스크린 버전 비교]
```

### 5.2 화면 구성

1. **Screen Builder**: 초급 preset 카드, 고급 조건식, 필드 검색, 단위·시점 표시
2. **Readiness Preview**: 예상 eligible 수, field coverage, stale/unsupported, 예상 provider 비용
3. **Result Table**: column preset, virtualized rows, why-ranked, provenance drawer
4. **Candidate Workspace**: 차트·펀더멘털·뉴스·이벤트·메모·무효화 조건
5. **Run History**: 정의 버전, snapshot, 후보 변화, 결과, 실패/partial 상태
6. **Outcome Lab**: T+1/5/21/63, benchmark-relative, drawdown, hit rate, turnover
7. **Operations**: source health, field freshness, queue, last good snapshot, rights review

### 5.3 상태 어휘

값 없음 하나로 합치지 않는다.

- `CURRENT`: 시점·권리·품질 계약 통과
- `DELAYED`: 허용된 지연 데이터
- `STALE`: 값은 있으나 freshness 초과
- `MISSING`: 공급자가 값을 반환하지 않음
- `UNSUPPORTED`: 해당 시장/자산/공급자 capability에 없음
- `BLOCKED_RIGHTS`: 표시/저장/재배포 권리 미확정
- `CONFLICT`: 독립 원천 간 허용 오차 초과
- `INFERRED`: 관측값이 아닌 파생/추론
- `LAST_GOOD`: 현재 수집 실패로 이전 승인 snapshot 사용

## 7. 목표 데이터·API·파이프라인 구조

### 6.1 control plane

- `ProviderRegistry`: provider와 credential 상태
- `CapabilityCatalog`: 시장/자산/필드/cadence/revision/rights/rate limit
- `RefreshPlanner`: 시장 캘린더·release calendar·dirty field 기반 작업 계획
- `BudgetGovernor`: 일/분 quota, 비용, concurrency, circuit breaker
- `SourceHealth`: 최근 성공·지연·오류 유형·divergence·LKG age
- `PromotionRegistry`: 연구 필드/팩터/레짐 정의의 승인 상태

### 6.2 data plane

```text
공식/승인 provider adapters
  -> raw observation envelope
  -> identity + units + calendar normalization
  -> field-level reconciliation
  -> immutable PIT snapshot
  -> factors/regime/event features
  -> ScreenDefinition compiler
  -> ScreenRun + explanations
  -> browser projection / AI evidence / alerts / outcome ledger
```

### 6.3 핵심 계약

```text
InstrumentRef
  instrumentId, symbol, MIC, assetType, currency, validFrom, validTo

ObservationEnvelope
  instrumentId, fieldId, value, unit, sourceId,
  observedAt, filedAt, fetchedAt, effectiveAt, revisionId,
  sourceKind, rightsId, qualityStatus, evidenceId

FieldDefinition
  fieldId, label, type, unit, supportedMarkets,
  cadence, freshnessBudget, requiredCapabilities,
  missingPolicy, reconciliationPolicy, allowedUse

ScreenDefinition
  screenId, version, name, objective, horizon,
  universeRef, filtersAST, hardGates, ranking, columns,
  requiredFields, minCoverage, regimePolicy, createdAt

ScreenRun
  runId, screenVersion, snapshotId, startedAt, completedAt,
  status, eligibleCount, passed, rejected, unavailable,
  providerSet, engineVersion, explanationsHash

RankExplanation
  instrumentId, totalScore, contributions, passedGates,
  failedGates, missingEvidence, contraryEvidence, confidence

RegimeState
  regimeId, observedAt, inputs, state, confidence,
  missingInputs, transitionReason, hysteresisState, allowedUse

OutcomeObservation
  runId, instrumentId, horizon, entryConvention,
  rawReturn, benchmarkReturn, maxDrawdown, liquidityFlags,
  costsApplied, observedAt
```

### 6.4 공급자 다각화 원칙

| tier | 용도 | 예 | 규칙 |
|---|---|---|---|
| T1 공식 원천 | filing, macro, 거래소 공시 | SEC, DART/KRX 승인 경로, FRED/BLS/BEA/Treasury | 숫자 정본 우선; revision 보존 |
| T2 계약/라이선스 | quote, fundamentals, options, estimates | 승인된 유료/무료 key provider | 표시·저장·재배포 권리 별도 |
| T3 공개 지연 시장 | 연구용 시세/기술 | Yahoo 등 현재 허용 경로 | LKG·rate-limit·지연 라벨 |
| T4 참고/발견 | 뉴스, RSS, Telegram, Web Research | 현재 AIO reference plane | 숫자 정본/현재 시세 대체 금지 |

다각화는 provider 개수가 아니라 독립 원천 수로 계산한다. 두 provider가 같은 거래소 feed나 같은 filing을 재판매하면 하나의 독립 관측으로 본다. 전체 row의 source를 하나로 고르지 말고 필드별로 reconcile한다.

### 6.5 자동 갱신 cadence

| 데이터 | trigger/cadence | 성공 후 소비자 | 실패 정책 |
|---|---|---|---|
| instrument master | 주 1회 + listing/delisting event | universe, symbol resolver | 이전 master + 변경 경고 |
| EOD 가격/거래량 | 시장별 close+buffer | factor, breadth, screen | LKG; 해당 시장 run partial |
| fast quote | 세션 인지 1~5분 목표, 권한별 | 화면 보강, alert | EOD와 혼합 표시 금지 |
| corporate action | 일 1회 + event | adjusted history, returns | 영향 종목 재계산 queue |
| filing/fundamental | filing event + 일 reconciliation | quality/value, company | 이전 filing 유지, stale 표시 |
| earnings/calendar | 일 1회 + event window | event gate, alerts | 날짜 신뢰도 등급 |
| macro | 공식 release calendar | regime, macro pages | revision 보존, 예상/실제 분리 |
| news/reference | 5~30분, source별 | discovery, narrative | reference unavailable; 가격 대체 금지 |
| screen run | snapshot commit 후 | result/history/alerts | snapshot 미완료면 실행 차단/partial |
| outcome | T+1/5/21/63 | outcome lab | 기준 가격 누락 시 unavailable |

### 6.6 종목·필드 단위 dirty refresh

1. 사용자가 결과 row를 열거나 screen이 필드를 요구한다.
2. `FieldReadiness`가 stale/missing이면서 capability가 존재하면 `RefreshDemand` 생성.
3. `(instrumentId, fieldGroup, asOfBucket)` idempotency key로 중복 제거.
4. quota·시장 세션·우선도에 따라 bounded fan-out.
5. 성공 시 관련 factor와 screen만 incremental recompute.
6. 실패 시 reason·nextRetry·LKG age를 기록하고 전체 refresh로 확대하지 않는다.

필드가 `UNSUPPORTED` 또는 `BLOCKED_RIGHTS`이면 반복 재시도하지 않는다.

## 8. 자동 시장 상황 반영 설계

### 7.1 입력 축

- 추세: 지수 20/50/200일, ATH gap, 시장별 추세 분산
- breadth: advance/decline, 20/50/200일 상회율, new high/low
- volatility: VIX 수준·변화·기간구조; 한국 대용치는 별도 라벨
- credit/liquidity: HY spread, 금리곡선, 달러, 금융여건
- rotation: sector relative strength와 RRG
- event: CPI/FOMC/고용/실적 집중도와 시간 거리
- source health: 핵심 입력의 coverage·freshness·conflict

### 7.2 상태 결정

`RegimeState`는 deterministic feature 계산과 명시적 threshold로 만들고 `confidence`와 `missingInputs`를 함께 출력한다. 상태 전환에는 hysteresis와 최소 유지기간을 둔다. 예: 진입 threshold와 이탈 threshold를 다르게 하고, 중요 입력이 stale이면 기존 상태를 유지하되 `LOW_CONFIDENCE`로 강등한다.

### 7.3 랭킹 연결 안전장치

- 레짐은 스크린 preset 추천, 위험 경고, position-size 참고에는 즉시 사용할 수 있다.
- factor weight 자동 변경은 별도 replay/walk-forward에서 개선이 재현된 뒤에만 승격한다.
- live adaptive weight와 backtest weight가 다르면 `liveBacktestParity=false`를 유지한다.
- 레짐 변화 때문에 종목의 펀더멘털 결측이나 권리 문제를 통과시키지 않는다.
- 모든 레짐 기반 결과에 “고정 조건 결과와 달라진 종목” diff를 제공한다.

## 9. 구현 선택지

| 선택지 | 내용 | 장점 | 위험 | 판정 |
|---|---|---|---|---|
| A. 현 구조 내부 확장 | 현재 페이지/JSON에 기능 추가 | 빠른 초기 UX | 단일 파일·상태 결합 증가 | 단기 패킷만 |
| B. Hybrid Workbench | 계약·engine·artifact를 ESM로 추출, 기존 UI가 소비 | 회귀 통제, 점진 migration | 일시적 adapter 필요 | **권고** |
| C. 별도 앱 재구축 | React/Svelte + API/DB 전면 구축 | 대규모 확장 | 기능 parity·배포·운영 비용 | trigger 충족 시만 |

### 8.1 C로 전환하는 객관적 trigger

- 목표 universe가 5,000종목 또는 projection 100필드를 지속 초과
- 압축 screener payload가 정한 예산을 넘고 column projection으로도 회복 불가
- 결과 DOM virtualization/pagination 후에도 저사양 p95가 gate 실패
- ScreenRun·Outcome·PIT snapshot 보존량이 GitHub artifact 방식의 비용/보존 한계 초과
- 기존 `src/data`/`src/domain` 추출로 단일 writer와 테스트 가능한 계약을 만들 수 없음이 spike로 입증
- dual-run parity가 확보되고 rollback 가능한 새 배포면이 준비됨

trigger 전에는 C를 선택하지 않는다.

## 10. 실행 패킷

모든 상태는 `DESIGNED -> IMPLEMENTED_LOCAL -> VERIFIED_LOCAL -> VERIFIED_LIVE`로 관리한다.

### SCR-OS-00 — 기준선 동결과 중복 대사

**목적**: 기존 자동 데이터·AI·구조 handoff와 겹치는 항목을 하나의 dependency ledger로 고정.

**산출물**: 현재 field inventory, producer/consumer map, refresh owner, existing gate map, duplicate/stale proposal ledger.

**완료 조건**: 873/848/74.2%와 model-validation BLOCKED를 fixture로 고정하고 기존 기능을 “미구현”으로 재발명하지 않음.

### SCR-OS-01 — FieldRegistry와 ObservationEnvelope

**소유면**: 신규 `src/domain/screener/` 계약, `src/data/contracts/`, screener normalizer/provider.

**필수**: 단위, 시점 4종, source, rights, missing status, allowedUse.

**완료 조건**: 대표 30필드 × US/KR fixture에서 CURRENT/STALE/MISSING/UNSUPPORTED/CONFLICT가 이진 검증됨.

### SCR-OS-02 — ScreenDefinition AST/DSL

**필수**: AND/OR/NOT, range, enum, null policy, hard gate, sort/rank, column set, immutable version.

**완료 조건**: UI·engine·AI가 같은 정의를 사용하고 round-trip golden fixture가 통과. 문자열 eval 금지.

### SCR-OS-03 — Saved Screen과 preset

**필수**: 초급 카드, 고급 builder, import/export, schema migration, URL/share payload에는 credential 없음.

**완료 조건**: 기본 6개 전략이 동일 snapshot에서 deterministic result hash 생성.

### SCR-OS-04 — WhyRanked/WhyRejected

**필수**: score contribution, hard gate, missing evidence, contrary evidence, factor peer 기준.

**완료 조건**: 모든 결과 row가 선정 이유 또는 계산 불가 이유를 가지며 AI 문장 없이도 설명 가능.

### SCR-OS-05 — ScreenRun과 Outcome Ledger

**필수**: snapshot/run/engine 버전, T+1/5/21/63, benchmark-relative, drawdown, cost flags.

**완료 조건**: 과거 결과가 최신 데이터로 덮어써지지 않고 동일 run 재생성 가능.

### SCR-OS-06 — Dirty Refresh Planner

**필수**: symbol+field queue, dedupe, priority, rate budget, retry/circuit breaker, LKG.

**완료 조건**: 한 종목 펀더멘털 누락이 전체 873종목 refresh를 유발하지 않으며 실패가 operations artifact에 남음.

### SCR-OS-07 — Provider Capability와 reconciliation

**필수**: 독립성 그룹, rights, cost/quota, market coverage, fallback, divergence tolerance.

**완료 조건**: provider 장애/429/partial/conflict fixture에서 결정적 source 선택과 fail-closed 상태가 통과.

### SCR-OS-08 — Regime v2 replay

**필수**: confidence, hysteresis, missing input, transition log, fixed-vs-adaptive diff.

**완료 조건**: flip-flop·stale-input·극단 변동 fixture와 과거 replay 통과. 성능 개선 미입증 시 weight 자동 변경은 비활성.

### SCR-OS-09 — PIT 검증과 승격 gate

**필수**: point-in-time universe, delisting, corporate action, filing available date, turnover, costs, liquidity, confidence interval.

**완료 조건**: `model-validation-status.json` 각 false가 실제 증거로만 전환되고 live/backtest parity가 이진 gate로 연결.

### SCR-OS-10 — 확장성 spike

동일 873/5k/20k fixture를 JSON, column projection, Parquet+DuckDB-WASM 후보로 비교한다. payload, parse, query, memory, render p50/p95를 기록한다. 기술 선택은 결과 이후 결정한다.

### SCR-OS-11 — Workbench UI cutover

기존 screener route에 adapter로 붙이고, 구/신 결과 hash·선택 상태·접근성·desktop viewport·저사양 성능 parity를 검증한다. rollback 전에는 legacy writer를 삭제하지 않는다.

## 11. 의존성 순서

```text
SCR-OS-00
  -> SCR-OS-01
      -> SCR-OS-02 -> SCR-OS-03 -> SCR-OS-04
      -> SCR-OS-06 -> SCR-OS-07
      -> SCR-OS-08
  -> SCR-OS-05 -> SCR-OS-09
  -> SCR-OS-10
  -> SCR-OS-11
```

이번 구현 세션은 `SCR-OS-00 -> SCR-OS-01~04 -> SCR-OS-06~08 -> SCR-OS-05/09 -> SCR-OS-10 -> SCR-OS-11` 순서로 진행한다. Workbench UI는 계약·엔진·설명 경계가 생긴 뒤 legacy table을 rollback surface로 유지한 adapter로 연결한다.

## 12. 필수 검증 gate

| gate | 실패 조건 |
|---|---|
| G-SCR-IDENTITY | symbol alias/MIC/currency 충돌 또는 PIT valid range 누락 |
| G-SCR-FIELD | 값에 unit/source/observedAt/allowedUse 없음 |
| G-SCR-DEFINITION | 저장 정의 round-trip 또는 deterministic hash 불일치 |
| G-SCR-EXPLAIN | 결과/탈락 row에 이유 없음 |
| G-SCR-REFRESH | 중복 fan-out, 무한 retry, quota 초과, LKG 오표시 |
| G-SCR-REGIME | stale input이 CURRENT regime 또는 자동 승격 생성 |
| G-SCR-PIT | 미래 filing, 현재 유니버스, 상장폐지 누락이 backtest에 유입 |
| G-SCR-COST | turnover/cost/liquidity 없이 성과를 predictive로 승격 |
| G-SCR-PARITY | live와 backtest 정의/가중치/필드 버전 불일치 |
| G-SCR-RIGHTS | 재배포 권리 미확정 값을 public artifact에 포함 |
| G-SCR-PERF | 정한 저사양 payload/parse/query/render 예산 초과 |
| G-SCR-LIVE | local 성공을 live provider/Actions/Pages 성공으로 간주 |

## 13. 다음 실행자 파일 라우팅

| 책임 | 우선 확인/예상 변경면 |
|---|---|
| 현재 페이지 | `src/ui/pages/screener.js` |
| provider/orchestration | `src/data/providers/screener.js`, `src/data/orchestrators/screener.js` |
| normalization | `src/data/normalize/screener.js` |
| factor/setup | `src/domain/screener/factor-ranks.js`, `factor-weights.js`, `setup-profile.js` |
| identity compatibility | `js/aio-data.js`의 `SCREENER_DB` 경계; CODE-MAP 구간만 읽기 |
| artifact producer | `scripts/fetch-data.mjs`의 `SCREENER_ONLY`/`enrichScreener`, `scripts/fetch-sec-fundamentals.mjs`, `scripts/validate-screener-artifact.mjs` |
| automation | `.github/workflows/refresh-screener.yml`, `refresh-data.yml`, `data-watchdog.yml` |
| validation status | `public-data/model-validation-status.json`, factor backtest artifacts |
| 기존 SSOT | 이 문서 front matter의 `depends_on` 5개 문서 |

파일 경로는 구현 착수 전 `rg --files`로 재확인한다. 새 경로를 이 문서만 보고 존재한다고 가정하지 않는다.

## 14. 라이선스·권리·보안 경계

- MIT/Apache 프로젝트는 고지·라이선스 조건을 확인한 뒤에만 코드 재사용한다.
- AGPL 프로젝트(OpenBB, Ghostfolio, Stocknear, OpenAlice, Fincept)는 직접 코드 혼입보다 계약·UX 패턴의 독립 구현을 우선한다.
- tickflow-stock-panel은 MIT 표기와 별개로 README에 비상업 고지와 데이터 서비스 약관 준수를 요구하므로 코드·데이터 사용 전 별도 검토가 필요하다.
- Yahoo, Finviz, TradingView, options/dark-pool/analyst data의 접근 가능성을 표시·저장·재배포 권리로 간주하지 않는다.
- API key는 브라우저 public artifact, saved screen, URL, log, fixture에 넣지 않는다.
- Web Research·뉴스·Telegram은 발견/참고 역할이며 현재 숫자 정본으로 승격하지 않는다.
- 자동 주문·실거래 연결은 이 handoff의 non-goal이다.

## 15. Q1~Q5 durable framework

### Q1. 무엇이 새롭게 구별되는가?

AIO의 격차는 데이터 종류 부족보다 **선별 정의와 관측 시점, 결과, 후속 성과가 하나의 run으로 연결되지 않는 것**이다. 다른 프로젝트의 가치도 기능 복사가 아니라 이 폐루프를 닫는 패턴에 있다.

### Q2. 어떤 관점이 바뀌어야 하는가?

페이지별 기능 추가에서 `field -> observation -> snapshot -> screen -> explanation -> outcome`의 producer/consumer 계약으로 이동한다. coverage 하나가 아니라 질문/스크린별 answerability를 본다.

### Q3. 무엇이 이 설계를 무효화하는가?

- 현재 ESM 구조가 위 계약을 회귀 없이 수용하고 규모 예산도 통과하면 별도 앱 재구축은 불필요하다.
- PIT/비용/유동성 검증 후에도 factor 성과가 안정적으로 재현되지 않으면 예측형 표현과 adaptive ranking 범위를 축소해야 한다.
- 공급자 권리 또는 비용이 공개 제품과 맞지 않으면 해당 필드는 reference/local-only로 강등한다.

### Q4. 인과 사슬은 무엇인가?

필드 시점/출처 불명확 -> 동일 스크린 재현 불가 -> 과거 결과가 최신 값으로 오염 -> 백테스트/복기 신뢰 하락 -> 레짐 자동 적응 과최적화 -> 추천처럼 보이는 거짓 정밀도. 반대로 field provenance와 immutable run을 먼저 만들면 자동화·AI·백테스트가 같은 증거를 소비한다.

### Q5. 인접 시스템 영향은 무엇인가?

- AI: ScreenDefinition과 RankExplanation을 도구 출력으로 소비
- 포트폴리오: 후보 발견 run과 실제 보유/성과를 연결
- 알림: saved screen version과 snapshot을 저장
- 뉴스/실적/내부자/공매도: 별도 페이지 기능을 screener field로 투영
- 운영: provider health와 refresh job을 operations-status에 연결
- 교육: preset의 목적·한계·무효화 조건을 learning surface에 연결

## 16. 완료/미완료 경계

### 이번 문서에서 완료

- 20개 비교군, 그중 추가 10개와 개인 공개 사례 분류
- AIO 현재 강점과 검증 차단점 대조
- 제품·데이터·API·자동화·레짐·검증 목표 설계
- Hybrid/전면 재구축 선택 기준
- SCR-OS-00~11 실행 패킷과 gate

### 아직 완료가 아닌 것

- 외부 코드 또는 라이선스 데이터 도입
- 새 API key/provider 계약
- runtime field registry/DSL/outcome ledger 구현은 로컬 코드와 계약 gate로 추가되었으나, 최종 검증 전까지 `IMPLEMENTED_LOCAL`로만 표시한다.
- PIT universe와 거래비용 검증
- 자동 레짐 가중치의 predictive 승격
- local/live 성능·접근성·운영 soak 및 in-app browser/Pages parity

이 문서의 다음 상태 변경은 최종 로컬 gate/benchmark 결과 또는 별도 live/provider/PIT 증거가 생성될 때만 수행한다.
