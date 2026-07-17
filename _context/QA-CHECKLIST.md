---
verified_by: Codex
last_verified: 2026-07-16
confidence: high
version: v3.8
checklist_version: v53.4
total_items: 728
stages: 22
latest_P_covered: P718
---

## v53.4 - 공급자 퇴역 소비자·실브라우저 결측 안전성 (P718/R341/R342)

- [x] 시나리오 확률 공급자 퇴역 시 생산자뿐 아니라 갱신 함수·호출부·DOM sink가 함께 제거되고 provider-required/unavailable 상태만 남는지 검사한다.
- [x] 외부 네트워크가 없는 실제 Chromium에서 거시 route를 포함한 critical-10과 22-route 접근성 검사를 실행해 console error가 0인지 확인한다.

## v53.4 - 정적·하드코딩 데이터 전수 계약 (P717/R342)

- [x] 22개 데이터 카테고리가 runtime artifact, 공식 reference 또는 explicit unavailable 중 하나로 분류되는지 검사한다.
- [x] `DATA_SNAPSHOT`의 변동 필드가 explicit null이며 0·중립값·과거값으로 결측을 대체하지 않는지 검사한다.
- [x] HTML의 `data-live-price/chg/pct/field`와 `data-snap` 슬롯에 숫자 초기값이 없는지 검사한다.
- [x] quote/FRED 정적 테이블, 합성 차트, RRG seed, 정적 sentiment 시계열이 없는지 검사한다.
- [x] 시나리오 확률·이벤트 결과·지정학·현재 narrative가 코드에 현재형 데이터로 내장되지 않는지 검사한다.
- [x] SCREENER_DB가 identity-only이며 signal/memo/mcap/rsi의 정적 행 데이터가 없는지 검사한다.
- [x] 런타임 Telegram memo가 적용될 경우 overlay provenance를 갖고 정적 memo와 구분되는지 검사한다.
- [x] LLM 공급자 단가·환율·질의당 비용을 고정값으로 계산하지 않는지 검사한다.
- [x] 공식 수동값은 `AIO_MANUAL_REFERENCE`에 source URL·asOf·operationalUse와 함께만 존재하는지 검사한다.
- [x] 미수신 KR macro/ECB/VIX term 값이 `—` 또는 `기준: 미수신`으로 렌더되는지 검사한다.
- [x] `AIO.getStaticSeedFallbackAudit()`와 page lineage의 orphan sink가 0인지 검사한다.
- [x] 스크리너 유니버스 재생성 후 lineage와 1100개 브라우저 회귀 테스트를 통과하는지 검사한다.

## v53.3 - 퇴역 코드·공개 artifact 정리 (P716/R341)

- [x] feedback board의 DOM·CSS·상태·API·관리자·submit stub이 모든 runtime 파일에서 제거됐는지 확인했다.
- [x] unconditional return 뒤 macro narrative, retired breadth history chart, legacy indicator와 wrapper 함수가 호출부·상태·CSS까지 수직 제거됐는지 확인했다.
- [x] runtime 전체 named function 중 선언 외 참조가 없는 항목이 없고 `ci-structural-check.mjs`가 재유입을 실패시키는지 확인했다.
- [x] 테마 상세는 활성 `showThemeDetail` 계약을 검증하고 퇴역 `_aioRenderPageFundamentals` stub의 완전 부재를 검증하는지 확인했다.
- [x] Pages manifest와 CI staging이 5개 runtime script를 명시하며 `js/*.js`와 `aio-tests.js`를 포함하지 않는지 확인했다.
- [x] service worker가 5개 runtime script를 캐시하되 `aio-tests.js`를 shell asset에 포함하지 않는지 확인했다.
- [x] JS/MJS 38개 문법 검사와 정적 계약 14개, Chromium headless 1100/1100을 통과했는지 확인했다.
- [x] boot·critical-10·portfolio vault 8/8·accessibility 22/22·FULL_INIT viewport 88/88에서 console error와 overflow가 없는지 확인했다.

## v53.2 - 소수 공유 준비 배치·시세 발행 중단·null 코어전 (P715)

- [x] telegram-digest.json topItems/broadItems가 원문 전문 없이 120자 summary만 담는지 확인했다(producer+기존 아티팩트 변환, 1.32MB→193KB).
- [x] TG 소비처(카드/피드필터/채팅 주입/narrative)가 text||summary 양쪽 아티팩트를 처리하는지 확인했다.
- [x] data.json이 quotes를 빈 배열로 발행하고 meta.quotesPublished:false/quotePolicy를 명시하는지, 내부 파생(history/분석/건강도)은 유지되는지 확인했다.
- [x] screener.json 846행에 원시 price 필드가 없고 validator가 price 발행을 계약 위반으로 차단하는지 확인했다.
- [x] 스크리너/워치리스트의 signal 표시가 BUY/SELL raw enum이 아니라 관측형 라벨(강세 구조/중립/관찰/약세 구조)인지 확인했다.
- [x] fail-closed null score가 어떤 표면에서도 "null점"으로 문자열화되지 않는지 확인했다 — 가드는 반드시 `typeof === 'number'`(Number(null)===0 함정 금지, `grep "Number.isFinite(Number("` 스윕).
- [x] 감사/테스트 리터럴에 라이브 시장값과 충돌 가능한 가격·환율 숫자가 없는지 확인했다('1,508' 오탐 제거, T175 타깃 가드 전담).
- [x] 사이드바가 데일리/시장 분석/내 투자·도구/학습 4그룹+한국 시장 접힘 구조이고 전 nav-item 라우트가 동작하는지 확인했다.

## v53.1 - 시스템 발화형 지시 제거·면책 도달·연구 라벨 (P714)

- [x] `AIO_ACTION_RULES`가 포지션%·매수/매도·헤지 지시를 렌더하지 않고 프레임워크 귀속 관측형만 출력하는지 확인했다(sizePct는 데이터 필드로만 존재).
- [x] home/signal 결론 바·점수 범례·MTF/VIX/breadth 가이드에 "선별매수/현금 확보/매수 시작"류 시스템 발화 지시가 없는지 grep 스윕으로 확인했다.
- [x] `computeTradingScore`에 HYG 달러 가격 고정 임계가 없고 신용 감점이 FRED HY OAS 실측 블록 단일 경로인지 확인했다(P713 계열 3번째 표면 소거).
- [x] 첫 방문 시 투자 면책 하단 바가 표시되고 확인 후 재표시되지 않으며(localStorage), 키보드로 확인 버튼 접근이 가능한지 확인했다.
- [x] 스크리너 추세신뢰도 컬럼이 헤더·범례·셀 툴팁 3곳에서 (연구)·예측 미확립을 명시하는지 확인했다.
- [x] AI 응답이 envelope 미제출+현재성 수치일 때 "자동 검증 미통과" 고지가 비차단으로 부가되는지 확인했다.
- [x] 출처 귀속 교육 서술(BofA FMS·Marks·Weinstein 원칙 등)은 귀속 표기와 함께 유지됐는지 확인했다(전면 삭제 아님).

## v53.0 - fail-closed 이중 표면·날짜핀 부패·공시 정직성 (P713)

- [x] `updateWeinsteinStage()`가 시장폭(50SMA) 미수신 시 임의 폴백(28) 대신 판정 자체를 보류하는지 확인했다.
- [x] `updateMTF()`가 시장폭 미수신 시 해당 축을 제외하고 null이 약세 분기로 떨어지지 않는지 확인했다.
- [x] 두 함수의 신용 판정이 HYG 달러 가격밴드가 아니라 FRED HY OAS 관측값(350/450/550bp)만 사용하고 미수신 시 축을 제외하는지 확인했다.
- [x] Weinstein 단계 문구가 명령형 매매 지시가 아니라 프레임워크 귀속 서술이고 disclaimer에 예측력 미검증이 명시되는지 확인했다.
- [x] VKOSPI가 `_vkospiLiveOk` 없이 배너·채팅 컨텍스트에 시드값을 현재값처럼 노출하지 않는지 확인했다.
- [x] 전술 스코어 공시가 "미검증"이 아니라 부분 백테스트의 음(−)의 상관 실측을 명시하는지 확인했다.
- [x] 테스트·runtime contract에 미래 특정일 등호 고정 단언이 없는지 확인했다(`grep "=== '20"` 스윕 — 이벤트 당일 CI 부패 방지).
- [x] BOK 금통위 날짜가 공식 2026 일정(7/16→8/27)과 일치하고 DATA_SNAPSHOT·MACRO_CALENDAR가 정합인지 확인했다.

## v52.99 - 22페이지 현재시장·파생결론 무결성 (P712/R340)

- [x] 10Y와 2Y 필드를 분리하고 2s10s가 명시적 관측 2Y·10Y로만 계산되는지 확인했다.
- [x] 기술 OHLCV 미수신 시 RSI·MACD·Weinstein Stage·멀티타임프레임을 등락률/정적 breadth로 합성하지 않는지 확인했다.
- [x] ticker·breadth 차트가 관측 이력 부재 시 난수 시계열을 생성하지 않는지 확인했다.
- [x] RRG가 과거 섹터 시드를 현재 사분면으로 표시하지 않고 상대가격 히스토리 부족 시 보류되는지 확인했다.
- [x] McClellan이 50MA 상회율에서 상승·하락 종목수를 역산하지 않는지 확인했다.
- [x] HY OAS가 HYG ETF 가격 임의 변환·정적 bp 대신 FRED 관측값만 사용하는지 확인했다.
- [x] 공식 미래 일정이 과거 이벤트를 제거하고 Fed/BLS/BEA/BOK 일정 필드에서 동적 생성되는지 확인했다.
- [x] 한국 테마·시장건강도가 quote coverage·현재 수급·VKOSPI 부족 시 점수와 등급을 함께 보류하는지 확인했다.
- [x] 엔캐리 프록시가 USD/JPY·VIX·10Y·HYG·수동확인 BOJ 금리 중 하나라도 결측이면 수치를 만들지 않고 보류되는지 확인했다.
- [x] 엔캐리 프록시가 포지션·옵션·당국 조치·청산 확률·자산 방향을 뜻하지 않는다는 한계를 표시하는지 확인했다.
- [x] 시장 레짐이 스냅샷 이동평균이 아니라 기준시각이 확인된 현재 OHLCV 이동평균을 요구하는지 확인했다.
- [x] OHLCV 미수신 시 임의 라운드 숫자를 지지·저항으로 렌더하지 않는지 확인했다.
- [x] RSP/SPY 단순 가격비율이 정규화 상대강도·시장폭·빅테크 집중도로 판정되지 않는지 확인했다.
- [x] 한국 공매도·수급 현재 원천이 없을 때 과거/시드 수치를 현재 카드에 표시하지 않는지 확인했다.
- [x] 거시·환율 카드가 단일 관측값으로 정책 조치, 자금흐름, 섹터/자산 방향을 단정하지 않는지 확인했다.

## v52.97 - Telegram 3채널 5일 전수 커버리지와 동적 narrative (P711/R339)

- [x] Telegram Web 3채널을 2026-07-11 00:00 KST부터 끝까지 스크롤하고 `data-mid` 중복 제거로 546건(106/345/95)을 전수 집계했다.
- [x] 기존 5일 selected raw 254건(57/122/75)과 실제 관측 수를 분리해 누락률을 공개했다.
- [x] producer가 rolling-window `observedItems` lineage와 capped `topItems`/`broadItems`를 분리하고 coverage funnel을 기록한다.
- [x] 동적 artifact 또는 구형 artifact의 현재 broad items가 static 7/3 narrative를 대체한다.
- [x] insider/earnings/flows/healthcare/japan 분류와 SCREENER_DB 기반 ticker alias 추출을 적용한다.
- [x] 22개 route page map과 `getTelegramPageCoverageAudit()`가 portfolio/ticker/screener/KR themes 및 guide 비적용까지 보고한다.
- [x] 공개 미러 전 채널 실패 시 이전 성공 digest와 성공시각을 보존한다.
- [x] Telegram을 secondary/reference로 유지하고 검증되지 않은 수치를 live decision input으로 승격하지 않는다.

## v52.96 - tracked public-data lineage/freshness audit (P710/R338)

- [x] 12개 tracked `public-data/*.json` 파일이 모두 명시적 정책과 timestamp selector를 갖고, 미등록 artifact는 CI에서 실패한다.
- [x] `generatedAt`, `asOf`, `observedAt`, `releaseAt`, `lastSuccessfulAt`, history date를 서로 대체하지 않는 self-test가 있다.
- [x] artifact별 timestamp, age, source, producer failure count, 마지막 Git commit SHA/시각을 재현 가능한 JSON 보고서로 출력한다.
- [x] live-core freshness/producer failure는 실패하고, research/reference stale 및 SEC 80% 미달은 경고로 남기며 decision-use 차단 상태를 보존한다.
- [x] 2026-07-15 local run: 12 artifacts, PASS 10, WARN 2, FAIL 0; WARN은 `screener-universe` staleAfterDays 초과와 SEC 24/655(3.7%) coverage 미달이다.
- [ ] SEC 누적 coverage 80%와 universe 갱신은 외부 Actions 실행/시간이 필요한 별도 조건이다.

## v52.94 regression closure (P709/R337)

- [x] T686 distinguishes dated reference-only fallback drift from live parity, and T1022 fixtures override direct screener artifact metadata during disconnected-producer tests.

## v52.94 - BLS 공식 evidence와 22-route page completeness contract

- [x] BLS 6개 allowlist series가 bounded keyless POST, 12시간 성공 캐시, M01-M12 필터, typed unit/seasonal adjustment/sourceKind를 유지한다.
- [x] BLS derived YoY/MoM은 필요한 history가 없으면 `insufficient_history`로 차단하고 `releaseAt`을 fetch time으로 대체하지 않으며 실패 시 last-known-good를 보존한다.
- [x] 22개 route contract가 required/optional producer, minCoverage, maxAge, failureState, forbiddenClaims를 가지며 completeness API가 loaded/partial/empty/blocked/stale-reference를 반환한다.
- [x] BLS fixture, pipeline/runtime contract, Chromium headless 1084/1084, accessibility 22 routes, viewport 88/88, portfolio E2E 8/8을 통과했다.

검증 시각: 2026-07-15. 외부 GitHub Actions/Pages live, human/legal approval은 별도 증거가 필요하다.

## v52.90 - 상태 기반 사용자 여정 2차 보강 (P705)

- [x] 기업 분석은 공급자 무응답에도 8초 총 예산 안에서 부분 성공/명시적 실패로 종료한다.
- [x] 서버 캐시·기기 캐시·직접 수집 뉴스는 피드와 헤더 요약이 동일한 항목·기준시각을 사용한다.
- [x] 뉴스 더보기는 시장 뉴스 페이지 안에서 피드 바로 뒤에 있고 실제 다음 12개를 공개한다.
- [x] 닫힌 AI 패널은 `inert`이며 열기/닫기 `aria-expanded`와 닫기 후 트리거 포커스가 일치한다.
- [x] 국내 테마는 시세 갱신 후에도 카드당 기본 5종목·260자 메모를 유지하고 나머지를 명시적으로 펼친다.
- [x] 한국 수급 실패는 단일 설명으로 수렴하고 종목 요청·프록시 폴백·재시도 회로에 상한이 있다.
- [x] 빈 포트폴리오는 계산 불가능한 카드 대신 첫 종목 추가 CTA를 우선하며, 보유 종목이 생기면 분석 영역을 복원한다.
- [x] 브리핑 제목과 모바일 상단바·검색·필터 조작 영역은 원문 노출/잘림/겹침 없이 읽고 누를 수 있다.

검증 결과: headless 1081/1081, 내부 라우트×뷰포트 88/88, 접근성 22라우트, 핵심 10면, 포트폴리오 8/8, 20개 사용자 표면 데스크톱/모바일 40/40 및 상태 여정 14/14 PASS. 실제 브라우저 pageerror 0, 문서 가로 넘침 0px.

## v52.89 - 남은 7면 시안 확장과 사용자 표면 수 정정 (P704)

- [x] 제품 정보구조는 19개 메뉴 페이지 + 용어사전 오버레이 = 20개 사용자 표면으로 설명한다.
- [x] 내부 22개 QA 라우트는 19 primary + 2 derived(`ticker`, `theme-detail`) + 1 reference(`options`)로 구분한다.
- [x] 사용설명서는 제목과 검색이 먼저 보이고 8개 장을 필요할 때 펼치는 구조다.
- [x] 용어사전은 267개 항목, 검색, 11개 카테고리와 모바일 대응 모달을 유지한다.
- [x] 국내 테마는 첫 화면 3개 테마만 보여주고 전체 목록은 명시적 더보기로 연다.
- [x] 한국 홈·매크로는 핵심 근거와 보조 탐색을 분리하고 기존 데이터/액션 DOM을 그대로 재사용한다.
- [x] 한국 수급·기술 및 한국 페이지의 중복 뉴스/용어 설명은 공용 뉴스·가이드로 통합한다.
- [x] 남은 7면을 1440×900과 390×844로 실렌더링하고 JS pageerror·가로 넘침·상호작용을 확인한다.

## v52.88 - 시안 최종 렌더 계약과 목록 밀도 보정 (P703)

- [x] 13면에서 런타임 자동 생성 `.aio-decision-header`와 `.aio-page-news-strip`이 일반 사용자 경로에 노출되지 않는다.
- [x] Telegram 피드·운영 배지·기존 details 등 시안 밖 중복 정보가 기본 화면에 되살아나지 않는다.
- [x] 시장 뉴스와 퀀트 스크리너는 첫 화면 12개/12행만 표시하고 명시적 더보기로 점진 공개한다.
- [x] 브리핑의 전체 뉴스 벽은 820px로 제한하며 사용자가 직접 확장할 수 있다.
- [x] 포트폴리오 상단 요약은 총손익·현금·노출 규칙 3열이고 모바일에서는 1열로 자연스럽게 쌓인다.
- [x] 기업 분석은 시안의 NVDA 기본 상태를 기존 `fundamentalSearch()` 데이터 파이프라인으로 채우며 정적 데모를 별도로 만들지 않는다.
- [x] 로컬 Chromium 1440×900 및 390×844에서 13면씩 총 26면을 캡처하고 JS pageerror 0·판단 헤더 0·노출 details 0을 확인한다.

## v52.87 - 13면 시안 중심 기본 경로 재구축 (P702)

- [x] 13개 시안 화면에 동적 `.aio-fund`가 생성되지 않고 페이지 이동 이벤트 등록도 제거됐다.
- [x] 시안 밖 `.aio-page-advanced-toggle`과 파이프라인 경고는 일반 모드에서 비노출, 개발자 모드에서만 접근 가능하다.
- [x] `aio-public-readiness`는 일반 모드에서 렌더되지 않고 개발자 모드에서만 기존 감사 데이터로 표시된다.
- [x] 포트폴리오 기본 순서는 보유 종목 → 리스크 → 배분 → 벤치마크 → 종목 분석이며 입력 폼은 CTA로만 열린다.
- [x] 스크리너 기본 표는 시안의 9개 핵심 열이며 기존 팩터/진입/뉴스 열은 전체 컬럼 모드에 남아 있다. Chromium headless `1075/1075`, 22라우트×4뷰포트 88조합, 접근성 22라우트, 핵심 10면 검사 모두 오류 0건이다.
- [ ] 실제 브라우저 13면 데스크톱/모바일 육안 점검 — 브라우저 제어 런타임 오류로 미완료, 로컬 자동 QA와 별도 구분한다.

## v52.86 - WP-AI19/20 non-agentic tool boundary and rights/retention/region (P701)

- [x] Tool capability registry distinguishes read-only market/research/portfolio access from mutation-capable order/account/external-send capabilities.
- [x] Unknown tools, write/mutation operations, consent failures, and operation mismatches fail closed at the common response boundary.
- [x] Rights registry retains provider, data use, output use, retention, region, training, redistribution, status, and notice fields.
- [x] Locally approved reference rights are explicit; live provider/Worker/market-data entries remain review-required unless separately verified.
- [x] Tool and rights audits are carried in the shared response envelope; T1007~T1014 and WP-AI19/20 runtime-contract checks pass with headless `1075/1075 PASS`; authenticated Worker live smoke (`HTTP 200`) is recorded separately, while live provider/data rights, legal/operator policy approval, and multi-user verification remain open.

## v52.85 - WP-AI17/18 coverage bias and human chat certification (P700)

- [x] Coverage report measures region, sector, cap, liquidity, source-kind coverage and exposure counts with deterministic ordering.
- [x] Missing/unknown dimensions are explicit and remain neutral; eligible recommendations with promoted missingness fail closed.
- [x] Coverage bias audit exposes overall coverage, per-dimension missingness, neutralization, and binary gate status.
- [x] Human certification matrix requires screen-reader, keyboard, mobile, novice, expert, and task-completion evidence.
- [x] Complete and split human evidence aggregate deterministically; evidence ID, signer, and signed timestamp are required.
- [x] Unsigned/incomplete certification remains blocked; T999~T1006 and WP-AI17/18 runtime-contract checks pass with headless `1067/1067 PASS`; live bias/user/SR certification and deploy verification remain open.

## v52.84 - WP-AI15/16 model-risk replay and cache/isolation/idempotency (P699)

- [x] Response replay manifests retain request/app/data/Worker revision, model, prompt, retriever, validator, evidence snapshot hash, sampling, output hash, owner, reviewer, canary, and rollback fields.
- [x] Sample replay passes only when output/evidence/model/prompt/retriever/validator metadata remains consistent; drift fails closed.
- [x] Model release approval requires owner/reviewer, approval, canary, and replay pass evidence; rollback-triggered releases are blocked.
- [x] Isolation cache keys separate tenant/session/route/entity/evidence/model/prompt/retriever context without embedding raw tenant/session identifiers.
- [x] Idempotency denies duplicate in-flight requests, returns completed requests as replay-only, and requires request ownership for finalization.
- [x] Stream partial/complete/aborted states and output hashes are finalized through one auditable helper; T991~T998 and WP-AI15/16 runtime-contract checks pass with headless `1059/1059 PASS`; live provider/canary/isolation and deploy verification remain open.

## v52.83 - WP-AI13/14 retrieval quality, poisoning, and financial conduct (P698)

- [x] Retrieval document index retains document ID, chunk ID, document version, publication time, source tier, and bounded text flags.
- [x] Instruction-injection/encoded/hidden-Unicode, retracted, superseded, and explicit-quarantine rows are excluded from active retrieval top-k results.
- [x] Recall@K, precision@K, source-tier coverage, temporal relevance, and poisoned current-action-use gates are deterministic and auditable.
- [x] Financial conduct policy exposes prohibited P0, jurisdictional legal-review, complex-product review, and educational states; multi-category matches are retained.
- [x] Actionable tax/regulatory/legal advice is blocked to the shared legal-review safe response while educational conduct explanations remain allowed.
- [x] T983~T990 and WP-AI13/14 runtime-contract checks pass; changed-module syntax and Chromium headless `1051/1051 PASS`; live retrieval/model/legal/red-team and deploy verification remain open.

## v52.79 - WP-AI4/5 external-data safety and financial action boundary (P694)

- [x] External news, Telegram, and web-search prompt blocks are marked `UNTRUSTED DATA` and retain hidden-Unicode/injection audit flags.
- [x] Translation prompts sanitize external title/description input and carry security flags into the request payload.
- [x] Portfolio AI preview exposes the field allowlist and excludes account/user identifiers, exact quantities, costs, targets, and notes until session opt-in.
- [x] Chat history has a 30-day retention window, 50-entry bound, sanitized entries, and an explicit off mode.
- [x] The common response pipeline carries `conductAudit` and blocks prohibited conduct, stale/missing/REFERENCE personalized actions, missing suitability, and uncalibrated probabilities.
- [x] T958~T966 and WP-AI4/5 runtime-contract checks pass; live model/red-team and deploy verification remain open.

## v52.80 - WP-AI6/7 automated publish and page context contracts (P695)

- [x] Automated translation/briefing/market-analysis routes expose `wp-ai6.publish.v1` validation and a deterministic evidence-summary fallback.
- [x] Briefing requests include the typed claim contract; missing structured output is blocked and fallback/source labels distinguish template text from AI text.
- [x] Server market-analysis metadata records publish-gate status and the `AIO.synthesizeMarketAnalysis` deterministic fallback.
- [x] Existing `AIO_PAGE_CONTRACTS` projects required/optional/forbidden AI data, beginner/expert modes, and explicit disabled-state rules.
- [x] All 22 route contracts are audited, including the `kr-technical`/`kr-tech` context alias; silent-disabled count is zero.
- [x] T967~T971 and WP-AI6/7 runtime-contract checks pass; live model/content quality and deploy verification remain open.

## v52.81 - WP-AI8/9/10 operations, benchmark, and feedback loop (P696)

- [x] AI success samples expose bounded latency, input/output tokens, failure rate, P50/P95, and estimated cost metadata.
- [x] Quota acquisition uses a bounded lock/limit contract and the shared API counter delegates to it.
- [x] The 12-case deterministic golden corpus covers educational, action, conduct, evidence, calibration, portfolio, and missing-data boundaries.
- [x] A/B release gate rejects metric regressions over threshold and any P0 error; no unsupported improvement is publishable.
- [x] Feedback samples retain request ID, entrypoint, model, prompt version, evidence status, validator version, and asOf.
- [x] T972~T976 and WP-AI8/9/10 runtime-contract checks pass; live provider SLO/model A-B and deploy verification remain open.

## v52.82 - WP-AI11/12 conversation lifecycle and CalculationEvidence (P697)

- [x] Request envelopes carry conversation/session, turn, route, entity, retry, and current-response ownership metadata.
- [x] Route/entity changes invalidate late streams; trim audits preserve the latest turn shape and bounded context.
- [x] Approved calculators emit `wp-ai12.calculation-evidence.v1` with formula version, input evidence IDs, assumptions, currency/rounding, result, and timestamp.
- [x] Calculation invariant mismatch, invalid/mutated evidence, model decision-use, and unknown calculators fail closed.
- [x] T977~T982 and WP-AI11/12 runtime-contract checks pass; live multi-user race/model arithmetic and deploy verification remain open.

## v52.78 - WP-AI3 intent retrieval and context compression (P693)

- [x] `AIO.classifyAIQueryIntent()` maps action/evidence/comparison/current/missing/mechanism/education questions to a required-evidence contract.
- [x] `AIO.retrieveImportedResearch()` ranks route research deterministically, limits results to top-k, and retains `sourceKind: REFERENCE` with `asOf`.
- [x] `AIO.buildAIRetrievalContext()` keeps static research separate from LIVE/SNAPSHOT/verified evidence and exposes retriever/version/recall audit metadata.
- [x] `AIO.compactAIContext()` applies deterministic line trimming within the declared 2K–6K token range and preserves required contract markers.
- [x] `AIO.recordAIContextBudget()` records estimated input tokens and P95 samples with the declared chars/4 ±10% measurement target.
- [x] Per-page and unified chat bind the active query and pass retrieval/context audits through the common response pipeline.
- [x] T950~T957 cover intent, top-k relevance, stable order, reference/live separation, recall, trim, P95, and pipeline audit.
- [x] Verification: changed-module syntax, runtime contract, and headless `1018/1018 PASS`; full viewport/accessibility/deploy gates intentionally not repeated for this packet.

## v52.77 - AI typed claim/evidence contract (P692)

- [x] `wp-ai2.claim.v1` normalizes metric, value, unit, scale, direction, asOf, source, sourceKind, and evidenceId.
- [x] Current-sensitive claims require one matching Evidence item and fail closed when Evidence is missing, duplicated, future-dated, or has a metric/unit/scale/value/direction mismatch.
- [x] Counterexamples cover F&G↔VIX, NFP 10x, bp↔%, direction sign, USD/KRW inversion, and current-sensitive Evidence omission.
- [x] Nested `[AI_CLAIMS_JSON]` envelopes parse through balanced JSON extraction and valid claims pass the shared `claimAudit` response boundary.
- [x] Per-page/unified streaming/final/retry paths pass injected quote Evidence to the common pipeline.
- [x] T941~T949 and WP-AI2 runtime contract are present.
- [x] `node --check`, runtime/version contract, and Chromium offline headless `1010/1010 PASS` completed.
- [ ] Pages/Worker live response, actual model-output certification, and post-deploy live verification remain open.

## v52.76 - AI 공개 진입점 공통 pipeline (P691)

- [x] `_aioCreateAIRequestObject`/`_aioBeginAIRequestAttempt`가 per-page/unified/retry/translation/briefing에 동일 pipeline·validator·block-policy 버전과 attempt를 기록한다.
- [x] per-page/unified retry가 같은 completion callback과 request object를 사용하고, assistant history/chips는 공통 gated text만 저장한다.
- [x] 자동 번역·브리핑이 공통 response pipeline을 통과하며, pipeline 부재/action 차단 시 local/deterministic fallback으로 fail-closed 한다.
- [x] `CHAT_CONTEXTS.briefing`이 정의되어 unified briefing route가 undefined context로 조용히 종료되지 않는다.
- [x] T937–T940 및 runtime contract가 envelope/audit/route/entrypoint wiring을 검사한다.
- [x] 변경 JS 문법, version/runtime/structural/data-pipeline/semantic contract 통과.
- [x] 최종 큰 단위 Chromium headless `1001/1001 PASS`, critical10 `10 routes/consoleErrors 0`, accessibility `22 routes/consoleErrors 0`, portfolio vault `PFE2-01~08 PASS`, viewport `88/88·worstOverflow 0px·jsErrors 0`, boot `FCP 1504ms·route 96ms·maxLongTask 1119ms`.
- [ ] GitHub Pages/Worker live 응답, 실제 모델 출력, 공개 배포는 미검증/미실행.

## v52.75 - AI 베타 공개 안전·시장분석 semantic gate (P690)

- [x] 공개 AI 패널과 임베디드 채팅 헤더가 `AI 베타 · 교육/리서치 보조`로 표시되고, 구체적 매매 지시를 제공하지 않는다는 안내가 보인다.
- [x] per-page/unified 채팅의 streaming·완료·retry 결과가 동일 action gate를 거치며, 차단 전 원문이 assistant history/chips에 저장되지 않는다.
- [x] current-sensitive 응답에 기준시각·Evidence 상태·원천/원문 재확인 disclosure가 붙는다.
- [x] `marketAnalysisOk` 생성 성공만으로 server LLM 문장을 렌더하지 않고 `marketAnalysisSemanticOk` 또는 `status: verified`를 요구한다.
- [x] T932–T936, runtime contract, syntax, Chromium offline headless `997/997 PASS`로 로컬 회귀 확인.
- [ ] GitHub Pages/Worker live 응답, 실제 모델별 문장 품질, WP-AI1 단일 파이프라인 통합은 후속 packet에서 검증한다.

## v52.74 - 초기 부팅·상호작용 성능 게이트 (P689)

- [x] 일반 부팅에서 Public Status가 `getShareReadinessAudit()`/배포 게이트/full-surface 감사를 호출하지 않고 활성 페이지의 materialized Evidence만 읽는다.
- [x] 현재성 검사는 `.page.active` 범위에서 DOM read/write를 배치하며 6초·18초 document 전체 재스캔이 없다.
- [x] 부팅 상태 표시는 `pointer-events:none`이고 3초 hard-release 후 제거되어 메뉴 입력을 막지 않는다.
- [x] Chromium gate에서 FCP ≤2.5초, 첫 페이지 전환 ≤2초, 최대 long task ≤2.5초를 만족한다.
- [x] 상세 운영·공유 감사는 명시적 API 또는 `aioAudit=1` 개발자 모드에서 계속 사용할 수 있다.

## v52.62 - 아이보리 리디자인(CLAUDE-CODE-HANDOFF.md) P1~P2 전체 + P3~P10 부분 적용

- [x] `:root` 색상 토큰 전수가 아이보리(웜 페이퍼) 값으로 교체되고, 두 번째 `:root!important` 오버라이드 블록(4462행 부근, "v51.43 visual hierarchy refresh")도 함께 갱신되어 실제로 반영됨. ✅ 로컬 확인 — 오버라이드 블록을 놓치면 P1 자체가 시각적 무효가 되는 함정이었음(향후 `:root` 토큰 작업 시 `grep -n "^:root {"`로 중복 블록 유무 먼저 확인할 것).
- [x] 일괄 이모지/픽토그램 제거 스크립트 실행 후 반드시 (1) `<button ...></button>` 빈 태그 중 `aria-label` 없는 것 전수 검색, (2) `? '' : ''` 양쪽-빈 삼항식 전수 검색을 수행. ✅ 이번 세션 5개 nameless 버튼(chatClear×2/`_aioHidePositionSizer`/`_aioTechnicalTicker`/`ai-ph-close`) + 1개 로직버그(바닥 확인 체크리스트, P678) 발견·수정. 헤드리스 992/992 통과가 이 클래스의 버그를 잡아주지 못했음(assert되지 않는 경로였기 때문) — 테스트 그린만으로 안심 금지.
- [x] 로컬 게이트 전종 PASS: syntax(js/*.js·scripts/*.mjs) · version-check · control-char · worker-anthropic · structural · ux-default-path · runtime-contract · data-pipeline-contract · semantic-review · workflow-compaction · skill-contract · stray-file. ✅
- [x] 헤드리스 `AIO.runTests()` 992/992 PASS. ✅
- [x] `AIO_VIEWPORT_FULL_INIT=1` viewport-matrix — kr-themes 테마 상세 닫기 버튼 nameless 발견·수정 후 재실행 확인 필요(세션 로그의 재실행 결과 참조). Portfolio Vault PFE2-01~08 전체 PASS. `ci-critical10-human-surface-check.mjs`에 TG 프록시 차단 예상 노이즈 allowlist 1건 추가(`ci-viewport-matrix-check.mjs`에는 이미 있던 패턴이 이 스크립트에는 누락돼 있었음).
- [ ] page-signal 섹션 순서 재배열(①스코어 히어로~⑤연계분석), page-briefing "시장분석 2×2 그리드+행동카드+오늘일정" 신규 섹션, page-portfolio 보유종목 미니차트+S/R 주석, page-technical volume profile 등 §5의 페이지별 신규 와이어프레임은 **미착수** — JS 렌더러 로직을 새로 설계해야 하는 별도 규모 작업으로 후속 세션 이관(CHANGELOG.md v52.62 참조).

> **2026-07-08 라이브 v52.26 일괄 검증 원장**: 아래 v52.7~v52.22 구간의 "(미확인)" 백로그와 P634~P641을 라이브에서 일괄 검증 — 각 박스에 ✅(통과)/⚠(부분)/❌(실패)/⛔(검증 불가) 주석 반영. 전체 증거·신규 발견(UX-01~UX-13: showThemeDetail P0 크래시, 프록시 SPOF, AI 백엔드 이원화 등)·구조 개선 설계(Phase V0~V4)는 **`FABLE-UIUX-DEEP-AUDIT-2026-07-08.md`** 참조.

## v52.22 - 1차 전수 리뷰 구조 보강 (P632)

- [x] GitHub Actions에서 `headless-tests`가 더 이상 `continue-on-error`가 아니며, `deploy` job이 `validate`와 `headless-tests`를 모두 통과한 뒤에만 실행됨. ✅ 2026-07-08 확인(ci.yml:152 `needs: [validate, headless-tests]`) — 단 **ci.yml:113~116 주석이 "deploy needs 미편입" 구서술 잔존(주석 drift, V0 정리 대상)**.
- [ ] `AIO.getDeploymentGateAudit({ strict:false })`가 full-surface stale `briefNotRendered` 조건 때문에 실패하지 않고, `AIO.getFullSurfaceAudit()`가 `.aio-page-brief` 재노출을 `pageBriefNotDecluttered`로 잡음.
- [x] 홈 PUBLIC STATUS 카드의 page evidence matrix가 `ticker`, `UNAVAILABLE`, `REFERENCE`, `SNAPSHOT`, `asOf pending` 같은 내부 enum/raw fallback을 일반 방문자 텍스트로 노출하지 않고 한국어 페이지명/상태/대기 문구를 표시함. ✅ 2026-07-08 라이브 확인(raw enum 0건).
- [ ] 390px 모바일 폭에서 topbar 오른쪽 액션 묶음이 viewport 밖으로 넘치지 않고 줄바꿈/ellipsis 처리됨. ⛔ 2026-07-08 뷰포트 미반영 환경 제약 — V3 뷰포트 매트릭스 CI로 이관.
- [x] `ci-runtime-contract-check.mjs`와 `ci-ux-default-path-check.mjs`가 위 네 항목의 정적 퇴행을 잡음. ✅ 2026-07-08 로컬 실행 green.

## v52.20 - 헤드리스 스킵리스트 23건 전수 해소, 진짜 버그 2건 포함 (P627-P630) — 실브라우저 미확인

- [x] **(확인됨)** signal 페이지: Lockout/OPEX 컨트롤과 Exit Triggers가 이제 실제로 진입 체크리스트/티커 바 아래로 재배치되어 보임(v50.33 도입 이후 처음으로 실제 작동, P628). ✅ 2026-07-08 라이브 — Exit(y2005) > 진입 체크리스트(y1695) 순서 확인, lockout은 의도적 display:none 유지(v51.40).
- [ ] **(라이브 실문답 미검증)** AI 채팅에서 "종목 추천해줘"를 연속 2회 질문 시, 두 번째 응답의 분산 설계 안내문("최근 대화 반복 티커는 점수 감점: N개")이 0이 아닌 실제 억제 개수를 표시(P629). ⛔ 2026-07-08 라이브 v52.26은 아직 채팅 개인키 경로라 실문답 불가. v52.30 로컬에서 preflight는 `_aioHasClaudeRoute()`로 보강되어 Worker 서버키 모드를 인식하고, 안내문은 "브리핑/번역과 달리 채팅은 개인키 또는 Worker 서버키 모드 필요"로 정직화됨. 배포 후 서버키 모드/개인키 중 하나로 실문답 재검증 필요.
- [ ] **(부분 확인)** index.html의 종목 티커 클릭 동작(홈 빠른 검색 5개 칩, kr-themes pill, 스크리너/무버스 테이블 행, 테마 리더 하이라이트 등 15곳) 전부 기존과 동일하게 종목 상세로 이동(onclick→data-action 전환, T143). ⚠ 2026-07-08 showTicker/정렬/탭 delegation 샘플 정상 — 15곳 전수는 아님(V3 헤드리스 클릭 전수로 이관).
- [x] **(확인됨)** 매크로 페이지 스토리라인 카드 하단에 "출처"/"예상 시간" 안내 문구가 표시됨(T239, R68). ✅ 2026-07-08 라이브.
- [x] **(확인됨)** signal 페이지 상단 마켓펄스 스트립과 fxbond의 캐리 리스크 배지가 "로딩 중"/"계산 중" 없이 표시됨(T491/T512/T557). ✅ 2026-07-08 — 단 mv-strip은 진입 후 수 분간 "—" 표시 후 채워짐(UX-07 첫 페인트 클래스, V2 대상).
- [ ] **(부분 확인)** 다수의 SVG 미니차트(스코어 구성, 시장 레짐 사분면, VaR/랭크 배지 등)의 텍스트 라벨이 커진 폰트(10px)로 겹침 없이 표시됨(T781, 41개 호출부 — 시각 확인 우선순위 가장 높음, 레이아웃 회귀 가능성). ⚠ 2026-07-08 계산형 검증: home svg 2개 getBBox 겹침 0·가시 폰트<10px 1건(9px, 경고 pill 세부 — SVG 아님)·signal svg 0개. 41곳 전수는 V3-1 계산 게이트로 구조 종결 예정.

## v52.19 - R280 기계 게이트 + fetchKrDynamicData 그림자/orphan 정리 (P626) — 실브라우저 미확인

- [ ] **(라이브 FAIL)** 한국 수급(`kr-supply`) 페이지 방문 시 "외국인 순매수 TOP 10"/"기관 순매수 TOP 10"/"외국인 보유비중 TOP 10" 3개 표가 "수신 대기"에서 실제 데이터로 채워짐(P605 이후 처음으로 실행 경로가 생긴 기능 복구). ❌ 2026-07-08 라이브 — 3표 전부 "데이터 수신 대기..." 영구. 원인: 프록시가 Naver API에 HTML 차단 페이지 반환(UX-03/V1, 코드 아닌 파이프라인).
- [ ] **(라이브 FAIL)** 위 표가 채워지지 않을 경우(엔드포인트 실패) "네이버 수급 데이터 수신 실패" 폴백 문구가 정상 표시됨(빈 "로딩 중" 무한 대기 아님). ❌ 2026-07-08 — 실패 상황인데 폴백 문구 미표시(콘솔은 "폴백 데이터 사용 중"이라 로그 — UI와 불일치, V1-4 실패 UI 계약 대상).
- [ ] **(미확인)** kr-dash-kospi-volume/kr-dash-kosdaq-volume/kr-breadth-adl/kr-breadth-52w/kr-breadth-20ma/kr-breadth-volume/kr-short-* 요소들은 삭제된 4개 함수의 대상이었으므로 이번 변경으로 동작이 바뀌지 않음(기존 정적 표시값 그대로) — 회귀 아님을 확인.

## v52.18 - FABLE 감사 P5 잔여 4건 (P622-625) — 전부 실브라우저 미확인

- [x] **(확인됨)** theme-detail 방문 시 상단 브레드크럼이 "AIO/테마/—"가 아니라 실제 테마명 표시. ✅ 2026-07-08 "Themes > AI AI·반도체" — 단 이 라우트(page-theme-detail)는 사용자 도달 경로가 없는 고아 표면임이 함께 발견됨(UX-02).
- [x] **(확인됨)** "주요 AI ETF" 표의 NVDA 행이 "Self"가 아니라 "—"(정적) 또는 "대장주"(동적 재렌더 후). ✅ 2026-07-08 NVDA행 "—", Self 셀 0건.
- [x] **(확인됨)** 스크리너 모멘텀 정렬 시 라이브 시세 없는 종목도 가격 컬럼에 실제 숫자 표시(빈 "—" 아님). ✅ 2026-07-08 정렬 후 상위 6종 전부 실가격(BE 295.05 등).
- [x] **(확인됨)** technical 페이지 SPY 포지셔닝 카드가 "3M 수익 0.0%·RSI 50.0" 고정이 아니라 실제 계산값(페이지 진입 몇 초 후) 표시. ✅ 2026-07-08 "200MA $695 · 50MA $740 · ATH $759" 실계산값.
- [x] **(라이브 재캡처 완료)** sentiment/fxbond HY 스프레드 주 표시값 정합: 2026-07-08 live v52.26 Playwright 확인 — `#hy-live-val` = `275 bps`, title `hy-spread · snapshot · reference-only`. 별도 `#hy-spread-est` = `추정 ~4.2%`는 라벨이 다른 보조 추정값으로 원래 P625의 "Live 289bp vs 275bp" 불일치와 별개.

## v52.17 - market-news 크로스채널 중복 수정 (P621) — 실브라우저 미확인

- [ ] **(재검 필요)** 동일 실화가 채널 라벨만 다르게 연속 노출되지 않음(word-bag 키로 2차 필터링). ⚠ 2026-07-08 완전동일 제목쌍 4건 관측(ADATA·삼성전자·SpaceX·SK하이닉스) — 단 감사 셀렉터의 중첩 캡처 아티팩트 가능성 있어 CONFIRMED 아님(UX-13). V3-3 word-bag 렌더 게이트로 기계 판정 예정.

## v52.16 - ticker cockpit 포트폴리오 데모 데이터 누출 수정 (P620) — 실브라우저 미확인

- [x] **(확인됨)** NVDA/AAPL/MSFT/TSLA 검색 시 "Your P&L: 내 포트폴리오 외 종목" 표시(가짜 평가손익 아님), 다른 16종목도 동일. ✅ 2026-07-08 NVDA에서 확인(전 종목 순회는 아님).
- [ ] **(부분 확인)** 위 메시지가 정상적으로 span 안에 표시되고(파괴되지 않고) "pnl pos" 초록 강조가 실제 보유 종목에만 적용됨. ⚠ 2026-07-08 메시지 정상 표시 확인 — 보유 종목 초록 강조는 미확인(포트폴리오 PIN 잠금으로 실보유 조작 배제).

## v52.15 - 홈 경고 pill 1줄 요약+펼치기 전환 (P616) — 실브라우저 미확인

- [x] **(확인됨)** 홈 방문 시(현재 FMP 키 오류 상태라 최소 1개 pill 존재) 경고 pill들이 바로 안 보이고 "⚠ 주의 항목 N건 ▾" 1줄 요약만 보임. ✅ 2026-07-08 "⚠ 주의 항목 10건" + DETAILS open=false.
- [ ] **(미확인)** 요약 줄 클릭 시 펼쳐지며 기존 11개 pill(FMP/AI/FRED + 8개 매크로 경과 + SMA)이 정상 표시되고, 라벨이 "펼치기"→"접기"로 바뀜. (2026-07-08 펼침 클릭은 미실시)
- [ ] **(미확인)** 주의 항목이 하나도 없는 상태(전부 정상)에서는 이 섹션 자체가 완전히 숨겨짐.

## v52.14 - P6 UX 정리 5건 일괄 수정 (P611-P615) — 전부 실브라우저 미확인, 아래 전 항목 다음 세션 확인 필요

- [x] **(확인됨)** 홈 PUBLIC STATUS 카드에 "full surface audit fail" 등 영문 내부 감사 로그나 "pageId:UNAVAILABLE" 같은 raw enum이 더 이상 노출되지 않고 한국어 건수 요약만 표시됨 (P611). ✅ 2026-07-08 라이브.
- [ ] **(미확인)** 아무 페이지나 전환 시 새 페이지 제목에 파란 포커스 테두리가 마우스 사용자에게 보이지 않음(스크린리더 포커스 이동 자체는 유지) (P612). (시각 항목 — V3 스크린샷 아티팩트로 이관)
- [ ] **(부분 확인)** AI 분석가 패널을 이력 없는 페이지에서 열면 완전 공백이 아니라 안내 문구가 보임. fundamental에서 프롬프트 자동채움 후 다른 페이지로 이동하면 입력창이 비어있음(사용자가 타이핑 중이던 값은 같은 페이지 재렌더에서 보존) (P613). ⚠ 2026-07-08 패널이 빈 화면 아닌 안내 메시지 표시 확인(키 안내) — 페이지별 문구·프롬프트 잔류는 미개별 확인.
- [x] **(확인됨)** 홈 최상단 운영자 노트에 "N일 경과" 배지가 날짜 옆에 표시되고, 3일/7일 임계값에 따라 색이 바뀜 (P614). ✅ 2026-07-08 "2026-06-30 7일 경과 (확인 필요)" 표시(색상 임계 전환은 픽셀 미확인).
- [ ] **(미확인)** 모바일 390px 폭에서 상단바 우측 버튼 클러스터가 잘리지 않고(특히 새로고침→"완료" 전환 시) 필요 시 두 번째 줄로 줄바꿈됨 (P615).

## v52.13 - kr-technical TradingView KRX 하드 브레이크 해소 — Naver 일봉+Chart.js 자체 캔들 대체 (P610)

- [ ] **(부분 확인)** kr-technical 페이지 방문 시 "TradingView 에서만 제공되는 심볼입니다" 오류 모달이 더 이상 뜨지 않고, 대신 캔들+거래량 차트가 렌더됨(005930 기본). ⚠ 2026-07-08 오류 모달 없음 ✓ — 단 **방문만으로는 렌더 안 됨**(Chart 인스턴스 null, 로드 트리거 필요 — U4/UX-06, V0-4 자동 로드 대상). 트리거 후엔 120pts·07-07 폭락봉 정상.
- [x] **(확인됨)** 종목코드 입력 후 "차트 로드" 클릭(또는 Enter) 시 해당 종목의 캔들 차트로 갱신됨. ✅ 2026-07-08 `loadKrCandleChart()` 경로로 120pts/마지막 07-07([286000,310000]) 확인 — **부수 발견: y축 beginAtZero:true로 0~500,000 스케일에 캔들 압축(UX-06)**.
- [ ] **(미확인 — 실브라우저 필요)** 존재하지 않는/오류 종목코드 입력 시 빈 캔버스가 아니라 "Naver 시세 수신 실패..." 폴백 메시지가 표시됨.
- [ ] US technical/fundamental 페이지의 TradingView 차트는 이번 변경과 무관하게 그대로 정상 작동.

## v52.12 - "30분마다" 서버 데이터 배지 tooltip 정정 — 정의(30분) vs 실발화(1~4h) 구분 (P609)

- [ ] topbar 서버 데이터 배지에 마우스 오버 시 tooltip이 "30분마다 자동 갱신"이라 단정하지 않고 정의/실발화를 구분해 서술.

## v52.11 - briefing 헤더 단어 중간 잘림 수정 — 말줄임 없는 고정 slice 4곳을 단어경계+'…'로 전환 (P608)

- [x] briefing 페이지 헤더 결론 문장이 어디서 잘리든 항상 완전한 단어 뒤에서 끝나고 잘렸으면 '…'가 붙어있음 — 단어 중간에서 뚝 끊기면 회귀. ✅ 2026-07-08 헤더 2건 완결('…' 처리 포함) 확인.

## v52.10 - briefing·signal F&G phantom global 수정 — window._lastFG로 전환 (P607/R261)

- [x] briefing 페이지 스코어 스트립의 F&G 값이 "—"가 아니라 홈/sentiment와 동일한 숫자를 표시. ✅ 2026-07-08 "F&G 45" = sentiment 45 = _lastFG. **단 같은 페이지 '실시간 시장 요약' 텍스트는 F&G 31을 병기 — 신규 이중값 발견(UX-05, V0-3 대상)**.
- [x] signal 페이지 `signal-mv-strip`의 F&G 필도 동일하게 실제 값 표시(둘 다 "—"로 고정되면 회귀). ✅ 2026-07-08 F&G 45 표시 — 단 진입 직후 수 분간 "—"였다가 채워짐(고정 아님·지연 — UX-07).

## v52.9 - themes 사이클 칩·본문 모순 해소: 칩이 marketState/getCycleFromMacro 단일 소스 구독 (P606/R276)

- [x] themes 페이지 방문 시 우상단 사이클 칩(예: "Mid Cycle (Expansion) · 성장 주도")과 본문 "동적 사이클 판정" 섹션이 항상 같은 phase 문구를 표시 — 서로 다른 사이클 이름이 동시에 보이면 회귀. ✅ 2026-07-08 칩·본문 동일 phase 확인.

## v52.8 - VKOSPI 실시간 fetch 사장 근본원인 수정 + 시드 재조정 (P605/R280)

- [ ] kr-technical/kr-home의 VKOSPI 값이 27.00에 고정되어 있지 않고 페이지 로드 후 실시간 값(Naver)으로 갱신됨 — 콘솔에 `[KR] VKOSPI 동적 업데이트:` 로그 확인. ❌ 2026-07-08 라이브 — 27.00 고정은 아니나 **16.00 폴백 고정**: fetchVkospiDynamic이 프록시 차단(HTML 응답)으로 실패 지속(UX-03/V1). 코드 배선은 정상, 파이프라인 사망. 같은 원인으로 P641 히스토리 누적도 시작 못 함(localStorage 키 부재·차트 6/5 시드 잔존).
- [ ] `kr-health-vkospi` 라벨이 실측값 기준 임계값(20/25/35)과 일치 — 항상 "공포"로 고정되어 있지 않음. ⚠ 2026-07-08 "16.00 (폴백·정상 추정)" — P635 정직화 라벨 형식으로 표시 중(실측값 기준 검증은 라이브 수신 복구 후 가능).
- [ ] `AIO.runTests()` 결과에서 T278/T422 PASS 확인(스킵리스트에서 제거됨 — 재실패 시 회귀).

## v52.7 - 매크로 캘린더 요일-고정 발표일 auto-advance 수정: NFP가 불가능한 요일로 밀리지 않음 (P604/R279)

- [ ] macro 페이지 헤더 + briefing 일정의 "다음 BLS NFP" 날짜가 항상 금요일 — 일/토요일이 표시되면 회귀.
- [ ] `AIO.runTests()` 결과에서 T859("monthly-first-friday 주기 nextRelease는 항상 금요일") PASS 확인.

## v52.6 - 뉴스 번역 파이프라인 사망(9개 표면) 수정: 페이지 스트립·브리핑이 자체 선택 항목의 번역을 요청 (P603/R245)

- [ ] macro/fxbond/technical/themes/sentiment/signal/fundamental/breadth 8개 페이지: "📰 관련 뉴스" 스트립(`_aioRenderPageNewsStrip`)의 항목이 영문일 때 몇 초 내로 한국어 제목으로 바뀜 — `[번역 대기] ...` 상태로 영구 고정되지 않음.
- [ ] 브리핑 페이지: "핵심 5선"/카테고리별 뉴스 목록(`renderBriefingFeed`)과 상단 다이제스트 "핵심 뉴스" 3건(`_aioRenderBriefingDigest`) 모두 동일하게 번역 결과가 반영됨(둘 다 영구 "[번역 대기]" 없음).
- [ ] 위 항목들이 번역되는 동안 `autoTranslateNews` 완료 후 화면이 자동으로 갱신됨(수동 새로고침 없이) — `_aioRenderActivePageNewsStrip`/`_aioRenderBriefingDigest` 재호출 배선 확인.

## v52.5 - workflow_run 체크아웃 ref 근본 수정: CI가 실제 트리거 커밋을 검증·배포 (P602/R278)

- [ ] 다음 `workflow_run` 트리거 CI 실행: `gh run view <run-id> --log | grep "HEAD is now"`가 그 사이클의 데이터 커밋 SHA(방금 refresh-data.yml이 push한 커밋)를 가리킴 — 이전 사이클 커밋 아님. 같은 시점 라이브 `data.json`의 `meta.generatedAt`도 같은 사이클로 갱신됨(한 사이클 지연 없음).
- [ ] `.github/workflows/ci.yml`의 3개 `Checkout` 스텝(validate/headless-tests/deploy) 모두 `ref:`가 `workflow_run` 이벤트에서 `github.event.workflow_run.head_branch`로 해석되고, push/PR/workflow_dispatch에서는 `github.sha`로 해석됨 — 단순 `head_sha` 폴백이 되돌아와 있지 않음.

## v51.83 - Systematic full-site audit: XSS, fundamentals data, score parity, data pipeline, medium hardening (R249-R262)

- [ ] Telegram feed cards (`_aioProcessTelegramItem`/`_aioRenderTelegramFeedHtml`) never render raw `<`/`>`/`"` from `it.text`/`it.url` — headline, body, ticker labels, and href are all escaped.
- [ ] Fundamental page (search any ticker): Market Cap is not "N/A" when a live price is present; the revenue card's "FY" year is not multiple years stale; Gross Margin is never shown above 100%; the pinned preview card for a just-searched ticker does not show all-dash metrics.
- [ ] Signal page's decision header and its own score gauge always show the same number — `AIO_PAGE_SCORE_MODE.signal === 'swing'` and `_aioDefaultDecision` reads it.
- [ ] KR home "KOSPI 상위 상승/하락" cards never show a live percentage whose sign contradicts the section header without the `.kr-sign-mismatch` flag being applied.
- [ ] Breadth page 50SMA big number, bar width, and readout sentence always agree — `updateBreadthBars()` reads `DATA_SNAPSHOT.breadth50sma` first in all three.
- [ ] `classifyTopic()`'s zero-keyword-match fallback only accepts `item.topics[0]` if `TOPIC_KEYWORDS.hasOwnProperty(...)` — never an arbitrary source-provided string. Briefing prompt contains the topic-tag caveat text.
- [ ] `refresh-data.yml`'s commit step retries with fetch+rebase on push rejection (bounded attempts) instead of a bare single `git push`.
- [ ] `fetchFred()` populates `_failedSeries` on any per-series error; `data.meta.fredFailedSeries` and the job-summary table reflect it.
- [ ] Ticker recent-search (`_fundRecentSearches`) rejects non-ticker-format input at `fundamentalSearch()`'s input boundary and escapes the rendered label.
- [ ] `_appendAIMsg()` (global chat panel) routes `html` through `window.safeHtml()` before setting `innerHTML`.
- [ ] `initBreadthPage()`'s `bp-price-chart` canvas guards against duplicate `mouseleave` listener registration the same way `bp-chart` does.
- [ ] Only one `function _aioRenderOperatorNote()` definition exists in js/aio-data.js.
- [ ] `_applyFearGreedScore()`'s sink list includes `#fg-score-val`, not just `#fg-score-big`.
- [ ] `fetch-telegram-digest.mjs` persists and reads back `channels[].lastPostId`; a second consecutive run against an unchanged remote should show `reachedKnown: true` and far fewer `pages` than the first run.

## v51.82 - Live full-site audit fixes: score consistency, news catch-up, CI hint, CDN timing, CI-gated deploy (R244-R248)

- [ ] Loading home twice in quick succession never shows a different number between the "오늘 결론" header verdict score and the "매매 점수 분해" gauge/card — both always match. `window._aioScoreCache` exists after any `computeTradingScore()` call.
- [ ] `refreshHomeDashboard()` calls `window._aioRenderPageDecisionHeader('home')` in the same pass after computing `tradingScore`.
- [ ] Home "핵심 뉴스" (top-3 boosted items) never stays on `[번역 대기]` placeholder titles for more than one translation batch cycle — `renderHomeFeed()` triggers `autoTranslateNews()` directly for any selected item not yet in `_translationCache`.
- [ ] `scripts/ci-version-check.mjs` failure output includes the line `Fix: run "node scripts/bump-version.mjs <version>"...`.
- [ ] Console never logs `[AIO] jsDelivr CDN 실패` before `DOMContentLoaded` has fired; the Chart.js fallback-detection block in index.html is wrapped in `document.addEventListener('DOMContentLoaded', ...)`.
- [ ] `gh api repos/{owner}/{repo}/pages` reports `build_type: "workflow"` (not `"legacy"`). Pushing a commit that fails `validate` does not update the live site; pushing one that passes does.
- [ ] The `deploy` job's staged artifact excludes every dot-prefixed and underscore-prefixed top-level path (`_context/`, `_archive/`, `_backup/`, `.github/`, `.claude/`, `.agents/`) — spot-check `https://ysnle.github.io/aio-screener/_context/RULES.md` still returns 404 after any deploy workflow change.

## v51.80 - Portfolio AI workbench + journal reflection learning loop (R243)

- [ ] `#pf-ai-workbench` is visible inside the portfolio page and contains holding selector, overview, ticker review, rebalance, learning, note save, and journal analysis actions.
- [ ] `_aioPortfolioAsk()` opens the unified AI panel, calls `updateAIPanelContext('portfolio')`, injects a generated prompt into `#ai-panel-inp`, and calls `chatSendUnified()`.
- [ ] `_aioSavePortfolioJournal()` stores notes only in browser localStorage under `aio_portfolio_journal_v1` and does not send notes until the user explicitly runs an AI action.
- [ ] `_aioBuildPortfolioActionPrompt()` includes selected ticker, current holdings, current note, and recent saved notes while keeping them as user context rather than live market evidence.
- [ ] Portfolio `CHAT_CONTEXTS.portfolio` contains the trade reflection/learning coach contract: facts/emotions/assumptions, thesis validity, sizing/stop, repeated mistakes, next checklist, and study concepts.
- [ ] `scripts/ci-runtime-contract-check.mjs` fails if the AI workbench DOM, journal handlers, direct AI execution path, or reflection prompt contract regresses.

## v51.79 - Portfolio Backtest Lab monthly model + PV-style report contract (R242)

- [ ] `#pf-backtest-lab` exposes initial capital, start year, rebalance type, benchmark, run action, and source/assumption caveat without blending into live portfolio P&L.
- [ ] `AIO.buildPortfolioBacktestLab()` returns `monthlyRows`, `annualRows`, `drawdowns`, `components`, and `performance` with CAGR, stdev, Sharpe, Sortino, active return, tracking error, information ratio, beta/alpha, VaR/CVaR, and capture ratios.
- [ ] Visible output renders `Performance Summary`, `Annual Returns`, `Worst Drawdowns`, and `Return / Risk Attribution` from the same model object.
- [ ] `getPortfolioContextForAI()` includes the latest Backtest Lab summary only when a successful model exists, and keeps historical simulation distinct from current holdings.
- [ ] `scripts/ci-runtime-contract-check.mjs` and `T845 v5179_portfolio_backtest_lab` fail if the UI, engine, deterministic output, or AI linkage regresses.

## v51.78 - Public readiness source/asOf matrix + governed context compaction (R241)

- [ ] `AIO.getPageEvidenceCurrentnessAudit().rows[]` returns `sourceLabel`, `asOf`, `confidence`, `snapshotDom`, and `referenceDom` in addition to existing source/blocker fields.
- [ ] `AIO.getPublicShareReadiness()` returns `pageEvidenceRows` and `weakPages`.
- [ ] Home `#aio-public-readiness` renders `.aio-public-readiness-pages` and `.aio-public-page-source` chips with page id, source label, and asOf.
- [ ] `scripts/ci-runtime-contract-check.mjs` fails if the page-level readiness source/asOf matrix is removed.
- [ ] `scripts/ci-workflow-compaction-check.mjs` no longer warns on governed ledgers (`RULES.md`, `QA-CHECKLIST.md`, `BUG-POSTMORTEM.md`) while still warning on unmanaged oversized context files.
- [ ] Browser visual QA confirms the readiness panel is visible and not blank/overlapping on the home path.

## v51.77 - Trader tactical framework integration (R240)

- [ ] `AIO_TACTICAL_TRADER_FRAMEWORK` exists in `js/aio-core.js` with `sourceKind: 'REFERENCE'`, `asOf: 2026-06-30T02:36:00+09:00`, durable rules, and dated examples marked `notRuntimeLevel`.
- [ ] `_aioBuildPageDecision()` surfaces the framework through structured `tacticalTraderFramework` metadata and page overlays, not copied standalone prose.
- [ ] `calcBreadthRotation()` accepts SMH/QQQ, SMH/SPY, IGV/SMH, software-to-semi rotation, failed-breakdown reclaim, and low-volume short-cover checks.
- [ ] `js/aio-chat.js` injects `_aioTacticalTraderFrameworkContext()` and explicitly prevents screenshot SPX/QQQ levels from being treated as current live levels.
- [ ] `MACRO_KW`/`TECH_KW` classify failed breakdown, support reclaim, volume-backed rally, and software-to-semi rotation terms.
- [ ] `scripts/ci-runtime-contract-check.mjs` fails if the framework registry, page decision integration, chat context, or keywords are removed.

## v51.76 - Public share readiness home surface (P551/R239)

- [ ] Home default path contains `#aio-public-readiness` and it renders from runtime audit data, not static marketing copy.
- [ ] `AIO.getPublicShareReadiness()` returns version, public-data age/status, page currentness status, pipeline status, blockers, and warnings.
- [ ] Static home quote badges do not say `FINNHUB 실시간`; runtime labels use source-aware wording.
- [ ] KR supply scheduler optional task does not produce the `fetchKrSupplyData` undefined guarded-function WARN in `scripts/ci-runtime-contract-check.mjs`.
- [ ] `scripts/ci-runtime-contract-check.mjs` fails if the home readiness panel or public readiness function is removed.

## v51.75 - Residual static LIVE / rolling 48h cleanup (P550/R238)

- [ ] Search user-facing HTML for static `● LIVE`, `LIVE RSS`, `BUY / LONG`, and `공격적 매매`; only source-aware labels should remain.
- [ ] Korea issue/news risk consumers use `filterByKst0800NewsCycle()` or the shared news surface model, not `filterByAge(newsCache, 48)`.
- [ ] `scripts/ci-runtime-contract-check.mjs` fails on overconfident visible static live/action labels.
- [ ] `scripts/ci-data-pipeline-contract-check.mjs` fails on direct rolling 48h newsCache reuse.

## v51.74 - Page currentness and news-contract gate (P549/R238)

- [ ] `AIO_PAGE_EVIDENCE_CONTRACT`, `AIO.getPageEvidenceState()`, and `AIO.getPageEvidenceCurrentnessAudit()` exist and are consumed by `_aioBuildPageDecision()`.
- [ ] Decision headers show a page caveat and do not promote technical, market-news, ticker, fundamental, theme-detail, options, or KR pages to raw `LIVE` when source evidence is mixed or absent.
- [ ] Market news page labels and empty states say `08:00 KST 완료 24h`, not `최근 48시간` or `48시간 이내`.
- [ ] Technical health score wording is an environment diagnostic and does not say `공격적 매매 가능`; it warns when composite trading score is below 60.
- [ ] Ticker page default action is neutral until a ticker/current data path populates it.
- [ ] `_liveSnap()` freshness returns source-aware labels such as `live 우선/source 확인`, `live+snapshot 혼합`, or `대부분 snapshot/fallback`.
- [ ] Run `node scripts/ci-runtime-contract-check.mjs` and `node scripts/ci-data-pipeline-contract-check.mjs`.

## v51.73 - Skill router/reference decomposition gate (R237)

- [ ] Frequent `SKILL.md` files are concise routers with frontmatter, AIO contract, reference loading map, core workflow, and binary self-eval.
- [ ] Long workflow detail lives under each skill's `references/` directory and every required reference is linked from the router.
- [ ] `.claude/skills/_shared/operating-contract.md` exists and all frequent skills/wrappers point to it.
- [ ] `.claude/commands/*.md` wrappers stay thin and do not duplicate skill implementation details.
- [ ] `scripts/ci-skill-contract-check.mjs` enforces v51.73 contract version, reference existence, shared contract links, and router size caps.
- [ ] `scripts/ci-workflow-compaction-check.mjs` passes without oversized frequent-skill warnings.

## v51.72 - Skill operating contract gate (R236)

- [ ] All frequent `.claude/skills/*/SKILL.md` files include the AIO Skill Operating Contract and read `_context/WORKFLOW-GOVERNANCE.md` + `_context/INDEX.md` first.
- [ ] Skill command wrappers in `.claude/commands/*.md` are thin routers that point to the matching `SKILL.md`.
- [ ] Skill and wrapper docs use R1 7-surface wording, not stale 6-surface wording.
- [ ] `scripts/ci-skill-contract-check.mjs` passes locally and is wired into `.github/workflows/ci.yml`.
- [ ] `scripts/ci-workflow-compaction-check.mjs` scans `.claude/skills`, not legacy `.agents/skills`.

## v51.71 - calcTechnicalSnapshot consumer contract closure (P548/R235)

- [ ] Ticker weekly context panel reads `weeklyCtx.wClose/lastWeekClose` and `wRsi14/wRsi` with fallback, so weekly close/RSI do not render as `—` when source values exist.
- [ ] AI chat technical data block includes VCP, Fibonacci/Volume Profile, RSI divergence, and weekly context lines from `calcTechnicalSnapshot()`.
- [ ] `public-data/screener.json` includes numeric `vcpScore` for refreshed screener rows before the VCP column is considered ready.
- [ ] `scripts/ci-runtime-contract-check.mjs` fails if weekly field aliases, chat consumer lines, or VCP artifact coverage regress.
- [ ] Version surfaces and cachebusters are synced to v51.71 after the technical contract fixes.

## v51.45 - Institutional Minervini technical engine (P536/R233)

- [ ] Ticker deep analysis shows an institutional Minervini check before secondary RSI/MACD/Bollinger rows.
- [ ] MA analysis includes 5/10/20 short stack, 50/100/200 long stack, full 5/10/20/50/100/200 order, and expanded 5/10·10/20·20/50·50/100·50/200·100/200 crosses.
- [ ] Horizontal Volume Profile shows POC, Value Area, nearest upper supply wall, nearest lower defense/support zone, and beginner-readable guidance.
- [ ] VCP contraction/volume dry-up and Fibonacci-zone confluence are shown as auxiliary confirmation, not as primary buy triggers.
- [ ] `calcTechnicalSnapshot()` and AI chat context expose the same MA stack fields (`sma5`, `sma100`, `shortMAState`, `longMAState`, `fullMAState`, `maStackScore`).
- [ ] `scripts/ci-runtime-contract-check.mjs` fails if the Minervini engine, MA stack coverage, Volume Profile guidance, or AI snapshot parity is removed.

## v51.44 - Trading logic/backtest factor audit hardening (P535/R232)

- [ ] Screener/backtest Kalman trend is computed on log prices and emits daily percent velocity, not raw price-unit velocity.
- [ ] `_aioApplyServerScreener()` merges Kalman fields only when `kalmanScale === 'log_pct_day'`, so old raw-scale data is ignored until refreshed.
- [ ] Trading score/chat/static guidance does not label `75+` as `적극 매수`; it uses risk-managed "매수 우호/선별/분할/무효화 우선" language.
- [ ] `scripts/ci-data-pipeline-contract-check.mjs` fails if log-scale Kalman generation or versioned runtime merge is removed.
- [ ] `scripts/ci-runtime-contract-check.mjs` fails if `75+ 적극 매수` wording returns.

## v51.43 - Visual hierarchy refresh (P534/R231)

- [ ] Home first viewport shows the operator note as a priority note with title, date, short lead, and expandable full memo instead of a full wall of text.
- [ ] Core decision pages use a warmer, less one-note visual hierarchy with decision/action/data cards clearly distinguished from ordinary widgets.
- [ ] KR technical default path does not show the legacy intro box above the decision flow.
- [ ] Fundamental example cards use intrinsic `auto-fit/minmax` tracks and do not create internal width overflow.
- [ ] `scripts/ci-ux-default-path-check.mjs` fails if the visual refresh layer, operator-note lead split, KR technical suppression, or fundamental grid guard is removed.

## v51.42 - Live default-path numeric safety (P533/R15/R228)

- [ ] Live home load has no `Cannot read properties of undefined (reading 'toFixed')` console error from `aio-core.js`.
- [ ] `window._aioSafeFixed()` exists and is used for partial live/scenario/chart numeric renderers.
- [ ] Ticker hero renders `—` instead of throwing when `_liveData[ticker]` is present without numeric `price` or `pct`.
- [ ] Scenario sum and chart tooltip renderers handle missing numeric fields without runtime exceptions.
- [ ] `scripts/ci-runtime-contract-check.mjs` fails if direct unsafe `live.price.toFixed`, `sumCheck.sum.toFixed`, or `ctx.parsed.y.toFixed` patterns return.

## v51.40 - Operator-note priority + Signal default-route hardening (P532/R228)

- [ ] Home desktop and mobile first viewport show the operator note before the decision/header flow when `public-data/operator-note.json.visible` is true.
- [ ] Operator note title/body are visually prominent enough for first-screen scanning and do not expose sample/example tags.
- [ ] SIGNAL default route does not show a collapsed `고급 매매 조건` row; retained `#signal-lockout-control` remains hidden only.
- [ ] `scripts/ci-ux-default-path-check.mjs` fails if operator-note priority/typography or Signal fold regression returns.
- [ ] R1 surfaces report v51.40 after the UX patch.

## v51.30 - News self-injection source quality + freshness gate (P531/R230)

- [ ] `scripts/fetch-data.mjs` scores news by actual article source tier, while preserving Google feed tier separately as `feedTier`.
- [ ] Low-quality/re-syndicated sources are explicitly penalized and cannot receive a tier-1 bonus from a high-priority Google News query.
- [ ] Korea market-mover coverage includes KOSPI, Samsung Electronics, SK Hynix, AI semiconductor selloff/rebound, Micron, and foreign-investor context.
- [ ] Home, briefing, market-news, and analysis-page news strips share the completed 08:00 KST to 08:00 KST 24h decision cycle.
- [ ] `public-data/data.json.meta` exposes `newsCyclePolicy`, `newsCycleStart`, `newsCycleEnd`, `newsCycleLabel`, and `newsNextRefresh`.

## v51.30 - Auto-refresh workflow syntax closure (P530/R229)

- [ ] `scripts/ci-data-pipeline-contract-check.mjs` parses Node heredoc blocks embedded in `refresh-data.yml` and `data-watchdog.yml`.
- [ ] `refresh-data.yml` Pipeline status summary runs without syntax error and does not block the commit refreshed public data step.
- [ ] Data freshness failures are triaged by layer: fetch step, summary step, commit/push step, watchdog threshold, and artifact quality floors.

## v51.30 - Practical default-path UX cleanup (P529/R228)

- [ ] Finite HOME/SIGNAL card groups use `auto-fit` or explicit columns, not `auto-fill`, so empty tracks do not create right-side blank space.
- [ ] HOME default viewport does not show collapsed score-flow or GxL advanced framework rows.
- [ ] SIGNAL default viewport does not show collapsed Lockout/OPEX or analysis-flow rows; legacy lockout DOM, if retained, is hidden.
- [ ] BREADTH default viewport does not show a Minervini framework block or collapsed analysis-flow row above the core breadth charts.
- [ ] SENTIMENT default viewport does not show duplicate header gauge, F&G subcomponent rail, or crypto temperature widget.
- [ ] SENTIMENT top content uses a balanced primary gauge + fluid analysis column without a tall left rail causing large right-side empty space.
- [ ] No default-route page exposes a visible explanation-only `<summary>분석 흐름 보기</summary>` block.
- [ ] `index.html` contains no user-facing `auto-fill` grid tracks; finite card groups use `auto-fit` or explicit responsive columns.
- [ ] `scripts/ci-ux-default-path-check.mjs` is wired into CI and fails on default-path UX noise or empty-track regressions.
- [ ] Removed default-route methodology content is preserved in `page-guide#guide-methodology`, including score formula, breadth/rally quality, sentiment, macro, and stock validation loops.

## v51.30 - Full route UI width-leak audit (P528)

- [ ] `page-fundamental` 390px mobile audit reports no `page.scrollWidth > page.clientWidth` from `.aio-page-news-strip` topic strings.
- [ ] `#fund-cards-grid` uses responsive tracks and does not widen `page-fundamental` on 390px mobile.
- [ ] `page-portfolio` 390px mobile audit reports no benchmark canvas width leak from `#pf-benchmark-chart`.
- [ ] `page-sentiment` desktop/mobile audits report no page-width leak from LWC chart containers.
- [ ] `#news-sentiment-chart` stays within its parent on 390px mobile after Chart.js writes inline canvas dimensions.
- [ ] `page-kr-technical` health/VKOSPI grids collapse to one column and canvases stay within viewport on 390px mobile.

## v51.30 - Browser UI review hardening (P527)

- [ ] Home dashboard does not render operator-note placeholder text when `public-data/operator-note.json` has no real operator message.
- [ ] Macro page desktop and 390px mobile viewport audits report no document/page horizontal overflow.
- [ ] Long `.aio-page-advanced-toggle > summary` labels wrap without vertical clipping on 390px mobile viewport.

## v51.30 - Maker-Checker broad recommendation + R1 sync gate (P526/T858)

- [ ] `scripts/ci-version-check.mjs` passes with title, badge, `APP_VERSION`, `SW_VERSION`, `version.json`, root/context docs, CHANGELOG, and all five JS cachebusters on the same version.
- [ ] `chatSend` Maker-Checker targets include `screenerResult.rows` when `detectedTickers.length === 0`.
- [ ] `AIO.runTests()` T858 verifies broad screener recommendation candidates through `_aioMakerCheckerVerify`, not only source-string wiring.
- [ ] `_aioMakerCheckerVerify()` computes factor ranks when SCREENER_DB exists but rank fields are not initialized.

## v50.98 - Market-impact news selection audit (P521/R226)

- [ ] `scripts/fetch-data.mjs` uses at least six server news query axes covering macro, AI/semis, geopolitics/energy, FX/bonds, analyst/earnings, and Korea.
- [ ] Server `data.json.news[]` items include `topic`, `country`, `tier`, `score`, `selectionReason`, and `feedSource`.
- [ ] `data.json.meta` includes `serverNewsScored`, `newsSourceCount`, `newsScoreMin`, and `newsScoreMax`.
- [ ] Client `scoreItem()` records `_scoreReasons` and applies an unverified-claim penalty.
- [ ] `AIO.getNewsSelectionAudit()` reports score buckets, topic/source/tier distribution, verification state, and home/briefing/market-news eligibility.
- [ ] `scripts/ci-data-pipeline-contract-check.mjs` fails if server scoring or the selection audit is removed.

## v50.97 - Korean market-news rewrite brief (P520/R225)

- [ ] Market-news page contains `#news-korean-rewrite-brief` above the card feed.
- [ ] `_aioBuildNewsKoreanRewriteBrief()` groups recent news into Korean sections such as 미국 정치, 지정학, 연준 및 미국 경제, AI 및 빅테크, 원자재 및 에너지.
- [ ] `_aioGetNewsTranslation()` returns `ko_rewrite`, `ko_section`, and `ko_market` even when Anthropic/Claude keys are unavailable.
- [ ] Anthropic translation prompt requests `section`, `rewrite`, and `market` fields and stores them in the translation cache.
- [ ] `scripts/ci-data-pipeline-contract-check.mjs` fails if the Korean rewrite brief or fields are removed.

## v50.96 - Multi-agent QA currentness/ticker UX sync (P519/R224)

- [ ] R1 version surfaces are all v50.96: title, badge, JS cachebusters, `APP_VERSION`, `SW_VERSION`, `version.json`, root/context docs.
- [ ] Ticker page direct search input calls `showTicker()` and provides quick chips for common symbols.
- [ ] News stale banner exists and is hidden/shown by server/RSS freshness logic.
- [ ] FRED macro fallback banner is visible when FRED data is unavailable and hidden when live FRED data loads.
- [ ] KR supply page clearly marks static fallback values and links to Naver investor flow.
- [ ] KR/theme ticker rows remain clickable into ticker detail analysis.

## v50.95 - Korean news translation insight fallback (P518/R223)

- [ ] `_aioBuildNewsLocalKoreanInsight()` returns Korean `ko_summary`, `ko_explain`, `ko_impact`, and `ko_action` for an English news item even without API keys.
- [ ] `freeTranslateNews()` and `localEnrichSingle()` store local insight fields when Google/Claude translation is missing or fails.
- [ ] market-news cards show Korean summary plus explanation/action lines without relying on Anthropic API.
- [ ] home top-news surfaces include a Korean summary line for dynamic RSS/news items.
- [ ] `_buildNewsContext()` injects Korean news summary/explanation/impact/action into chat context.

## v50.94 - Data pipeline contract gate + public-data operational audit (P517/R222)

- [ ] `scripts/ci-data-pipeline-contract-check.mjs` verifies refresh-data, data-watchdog, fetch scripts, runtime loader, audit, chat/news, and Telegram memo consumers.
- [ ] `.github/workflows/ci.yml` runs `node scripts/ci-data-pipeline-contract-check.mjs`.
- [ ] `data-watchdog.yml` fails on low core artifact quality: `symbolsOk < 70`, `newsCount < 10`, Telegram digest `count < 100` or `<2` channels.
- [ ] `_serverDataMeta` preserves FRED/F&G/news/LLM/Telegram/screener state after `_aioLoadServerData()`.
- [ ] `AIO.getDataPipelineAudit().layers.sources.publicData` exposes server public-data status and degraded optional services.

## v50.93 - Telegram digest dynamic memo overlay + CI gate wiring (P516/R221/T831)

- [ ] `_aioApplyTelegramDigestPayload(raw)` calls `_aioApplyTelegramDigestToScreenerDb(raw, merged)` after normalizing `public-data/telegram-digest.json`.
- [ ] A sample digest `topItems[].tickers` entry prepends `[TG YYYY-MM-DD · auto]` to the matching `SCREENER_DB.memo` row without removing older static memo context.
- [ ] `getTelegramPipelineAudit().memoOverlay.appliedCount` and ticker list show the digest-to-memo sink result.
- [ ] CI runs `ci-runtime-contract-check.mjs`, `ci-semantic-review-check.mjs`, and `ci-workflow-compaction-check.mjs` in `.github/workflows/ci.yml`.

## v50.63 - Telegram digest auto-refresh consumption loop (P509/R217/T831)

- [ ] `.github/workflows/refresh-data.yml` has valid YAML and a separate `run: node scripts/fetch-data.mjs` step.
- [ ] The scheduled refresh also runs `node scripts/fetch-telegram-digest.mjs --days=7 --out=public-data/telegram-digest.json`.
- [ ] The commit step stages `public-data/telegram-digest.json` when present.
- [ ] `data-watchdog.yml` checks both `public-data/data.json` and `public-data/telegram-digest.json` freshness.
- [ ] `public-data/telegram-digest.json` exists and includes generatedAt/since/until/channels/count/topicCounts/tickerCounts.
- [ ] `_aioLoadServerTelegramDigest()` fetches `public-data/telegram-digest.json` and degrades to static fallback if unavailable.
- [ ] `_aioApplyTelegramDigestPayload()` updates `AIO_TELEGRAM_WEEKLY_DIGEST`, category registry, page map, DATA_SNAPSHOT digest freshness, and `_aioTelegramDigestMeta`.
- [ ] `getTelegramPipelineAudit().digest` exposes dynamicLoaded/status/asOf/window/count/category/page-map coverage and T831 passes.

## v50.62 - Data/news freshness split + broad page integration (P508/R216/T830)

- [ ] public-data/data.json generatedAt is 2026-06-16 and quotesOk is 77/77.
- [ ] DATA_SNAPSHOT has _marketDataDate/_marketDataUpdated and _telegramDigestDate/_telegramDigestUpdated as separate fields.
- [ ] snapshot stale banner text is based on _marketDataUpdated and mentions market snapshot vs news/theme digest separately.
- [ ] AIO_TELEGRAM_CATEGORY_REGISTRY has at least 10 categories and AIO_TELEGRAM_PAGE_INTEGRATION_MAP covers home/macro/fxbond/technical/themes/sentiment/signal/fundamental/breadth/screener/briefing/market-news.
- [ ] AIO_NEWS_SURFACE_CONTRACTS technical/themes/fundamental include optical/power/memory/materials/ai-policy/crypto where appropriate.
- [ ] _buildAioIntegratedAnswerContext injects telegram_category_registry and telegram_page_map.
- [ ] T830 passes.

## v50.61 - Telegram 3채널 1주일 다이제스트 통합 (P507/R215/T829)

- [ ] `scripts/fetch-telegram-digest.mjs --since=...`가 3채널 공개 미러를 수집하고 JSON digest를 생성하는가
- [ ] `AIO_TELEGRAM_WEEKLY_DIGEST.counts.total === 796` 및 sources/window/pipelineNote가 노출되는가
- [ ] HOME_WEEKLY_NEWS 최신 항목 날짜가 2026-06-16이며 BOJ, Anthropic/Fable, CW laser, WF6/MLCC 테마를 포함하는가
- [ ] SCREENER_DB overlay가 NVDA/MU/000660.KS/009150.KS 등 핵심 종목 메모에 `[TG 06/15~16]` 근거를 추가하는가
- [ ] `_buildAioIntegratedAnswerContext()`가 telegram_weekly_digest/themes/catalysts/pipeline_note를 system prompt에 주입하는가
- [ ] T829가 digest, home, chat, keyword, memo overlay를 함께 검증하는가

## v50.60 - AI 채팅 통합 답변 파이프라인 보강 (P506/R214/T828)

- [ ] `AIO_CHAT_PIPELINE_REGISTRY`가 현재 시장·시세·차트·스크리너·시장폭/심리·매크로·펀더멘털·뉴스/공시·테마·포트폴리오 레이어를 선언하는가
- [ ] `_buildAioIntegratedAnswerContext()`가 일반 LLM이 아닌 AIO 전용 강점을 명시하는가
- [ ] 답변 계약이 현재 시장 연결, 정량 답변, 정성 답변, 종합 판단, 페이지 연결, 추천 다양성을 모두 포함하는가
- [ ] `chatSend()`가 `integratedContextStr`를 시스템 프롬프트에 실제 주입하는가
- [ ] coverage context가 `technicalData`, `screenerData`, `domainData` 축을 인식하는가
- [ ] T828이 레지스트리·프롬프트 계약·chatSend 배선을 함께 검증하는가

## v50.59 - AI 채팅 차트 분석 연결 보강 (P505/R213/T827)

- [ ] 무티커 기술/차트 질문이 `_aioTechnicalSymbolsForChat()`를 통해 시장 대표 프록시(SPY/QQQ/SMH 등)로 라우팅되는가
- [ ] `chatSend()`가 티커가 없어도 기술 질문일 때 `_fetchTechnicalDataForChat(..., {autoMarket:true})`를 호출하는가
- [ ] `_fetchTechnicalDataForChat()`가 OHLCV `dataQuality` source/rows/fetched 라벨을 포함하는가
- [ ] `AIO_CHAT_SOURCE_REGISTRY`에 `technicalOHLCV`가 등록되어 있는가
- [ ] `getChatSourceRegistryAudit()`가 `_fetchTickerDataForChat()` 외 기술/도메인/chatSend 주입 경로까지 스캔하는가
- [ ] T827이 라우팅·레지스트리·audit unused=0을 함께 검증하는가

## v50.58 - AI 채팅 답변 정책 유연화 (P504/R212/T826)

- [ ] 일반/교육 질문이 종목 리포트·Bull/Base/Bear 구조로 강제되지 않고 바로 답하는가
- [ ] 넓은 스크리너 추천이 `[주가 추이]` 부재로 막히지 않고 3M·RSI·퀀트 랭크를 근거로 설명하는가
- [ ] 단순 종목 사실 질문은 매수/매도 판단으로 과도하게 확장되지 않는가
- [ ] 매매 판단/전망/추천 질문에는 강한 데이터 검증·시나리오·시장 환경 연결이 유지되는가
- [ ] 스크리너 후보군 밖 종목은 확정 추천으로 섞지 않고 추가 탐색 조건으로 안내하는가
- [ ] T826이 `_aioChatAnswerPolicy()`, `chatSend()`, `_fetchTickerDataForChat()`의 의도별 정책 분리를 검증하는가

## v50.57 - AI 채팅 추천 다양성·반복 편향 방지 (P503/R211/T825)

- [ ] 조건 없는 "종목 추천" 질문이 `diversified-recommendation` 모드로 진입하는가
- [ ] 후보군이 4개 이상 섹터와 복수 시장/시총 버킷으로 분산되는가
- [ ] 최근 대화에 반복된 CEG/AVGO 등 티커가 후보 점수에서 감점되는가
- [ ] "전력/반도체/한국주"처럼 명시된 섹터/테마 질문은 기존 조건 필터를 유지하는가
- [ ] T825가 프롬프트 내 추천 다양성·반복 편향 방지 지시와 `chatSend()` 배선을 검증하는가

## v50.56 - 런타임 scope·복합 sink·증거 게이트 (P502/R210/T824)

- [ ] 공유 KST helper가 모든 `DOMContentLoaded` listener와 quota caller보다 먼저 선언되는가
- [ ] `.kr-etf-card`, `.kr-screen-card`, `.kr-ticker-pill` 컨테이너에 `data-live-price`가 없고 실제 가격 child에만 존재하는가
- [ ] `.KS/.KQ` 정상 원화 가격이 미국 주식 10,000 상한으로 truth-block 되지 않는가
- [ ] `reference-only` 미수집 quote는 warn, `decision` truth-block만 block으로 집계되는가
- [ ] `S&P500`, `MA(5/20/60)`, `1/3/6M`, 종목 수 비율이 개발 표식/과거 날짜로 오인되지 않는가
- [ ] 공식 일정 문구에 evidence/source/as-of metadata가 연결되는가
- [ ] 뉴스 수집 12초 이후 사용자 표면이 영구 loading이 아닌 백그라운드 갱신 상태를 표시하는가
- [ ] fresh browser에서 22/22 route, evidence block 0, text block 0, pageerror 0, T824 포함 전체 테스트가 통과하는가

## v50.56 - 계약·KST·KR 지수 정합성 (P501/R209/T823)

- [ ] `getPageContractAudit().routePageCount === expectedRoutePageCount === 22`이고 배포 게이트에 route-page contract 차단이 없는가
- [ ] `AIO.getKstDateParts(new Date('2026-06-14T15:30:00Z'))`가 `2026-06-15`, `월`을 반환하는가
- [ ] 홈 날짜 라벨과 LLM 일일 쿼터 날짜가 UTC가 아닌 `Asia/Seoul` 기준인가
- [ ] KOSPI/KOSDAQ 카드의 현재가·변동액·등락률·전일종가가 동일 quote의 previous close와 수학적으로 일치하는가
- [ ] `applyDataSnapshot()`에 `kospi-prev`와 `kosdaq-prev`가 모두 매핑되는가
- [ ] `node scripts/ci-structural-check.mjs`와 T743/T823이 통과하는가
- [ ] `scripts/start-local.cmd 8765`가 실행정책 오류 없이 현재 worktree를 제공하고 `/version.json`이 현재 버전인가

## v50.55 — 12페이지 실효성·정합성 감사 보강 (P500/R208/T822)

- [ ] 퀀트 스크리너 `screener.json` 404/미수신 시 "수집 중"이 영구 유지되지 않고 `팩터 검증 비활성` 또는 부분 데이터 상태가 표시되는가
- [ ] FMP 미설정 시 밸류·퀄리티 `—`가 결측이며 랭킹 제외 팩터라는 설명이 보이는가
- [ ] 시장 뉴스 소스 수가 `AIO_NEWS_SOURCES.length`와 일치하고, 48시간·점수 30·150건 상한이 사용자에게 공개되는가
- [ ] 뉴스 토픽 필터가 `semi`, `geo`, `bond`, `fx` 분류를 포함하고 빈 결과에서 현재 필터 조건을 설명하는가
- [ ] 기술분석 UI/CHAT_CONTEXTS에 근거 없는 `94% 승률`, `94.1%`, 출처 불명 개선율이 없는가
- [ ] 브리핑 프롬프트가 런타임 시장 스냅샷과 현재 이후 일정만 사용하고 과거 고정 테시스/목표가를 현재 사실처럼 재사용하지 않는가
- [ ] 홈/매크로/한국 일정 표면에 6/5·6/10 이벤트가 "발표 전/향후"로 남지 않았는가
- [ ] GitHub Actions가 `FRED_API_KEY`, `FMP_API_KEY`, `ANTHROPIC_API_KEY` 선택 시크릿을 수집 스크립트에 전달하는가
- [ ] T822 통과, JS syntax 0, version CI 통과, 브라우저 콘솔 신규 오류 0

## v49.57 — AI Chat 종목 데이터 커버리지 확장 (T395~T411)

- [ ] **T395**: `AIO_TICKER_NAME_REGISTRY.entries`.length >= 132 (v49.32 47 → v49.57 152)
- [ ] **T396**: 핵심 신규 등록 — NVO / VKTX / FANUY / SNPS / CDNS / NET / EQIX / RKLB / IONQ / MSTR / LITE / RIVN / SYM / FSLR / LMT + KR 5 (267250.KS HD현대중공업, 323410.KQ 카카오뱅크, 161890.KS 한국콜마, 000080.KS 하이트진로, 006260.KS LS)
- [ ] **T397**: `AIO.assertTickerRegistryCompleteness().coveragePct >= 30` — SCR_KEYWORD_ALIASES 543 ticker vs REGISTRY 정합. v49.57 라이브 측정: **32%** (47/543 8.6% → 173/543 32%, 3.7× 확장). v49.58+ 추가 ticker 등록 시 80% 목표.
- [ ] **T398**: `AIO.getThemeFetchCoverageAudit('ai')` — `{ status:'ok', tickers, fetchable:{yahoo,sec,wiki,finnhub,fmp,naver} }`
- [ ] **T399**: `AIO.fetchFinnhubCompanyNews` 함수 정의 (신규 v49.57)
- [ ] **T400**: `AIO.fetchSECRecentFilings` 강화 — `recent8KList[{filingDate,items,accession,url}]` 파싱 + form==='8-K' 인덱스 추출
- [ ] **T401**: `_fetchTickerDataForChat` 4 신규 라벨 ([SEC 8-K] / [News] / [Insider] / [13F])
- [ ] **T402**: ABSOLUTE RULES 5조 ([SEC 8-K]/[News]/[Insider] 학습 데이터 환각 금지)
- [ ] **T403**: `_shouldUseClaudeWebSearch` 함수 정의
- [ ] **T404**: `_shouldUseClaudeWebSearch('오늘 NVDA 뉴스', 'ticker', ['NVDA'])` === true
- [ ] **T405**: `_shouldUseClaudeWebSearch('PER이 뭐야', 'ticker', [])` === false
- [ ] **T406**: `AIO.getWebSearchAudit()` — `{ enabled, calls, maxUsesPerCall:3, estimatedCostUsd }`
- [ ] **T407**: `showTheme(themeId)` 진입 시 `window._currentThemeId` 설정
- [ ] **T408**: CIK_MAP 확장 — AMAT '0000006951' + LITE + RKLB + CEG 포함 (+84 entries)
- [ ] **T409**: `CHAT_CONTEXTS.themes.system()` 소스에 `_currentThemeId` + `SCR_KEYWORD_ALIASES`
- [ ] **T410**: `CHAT_CONTEXTS['theme-detail'].system()` 동일 dynamic 주입
- [ ] **T411**: APP_VERSION === 'v49.57'

### 수동 검증 (Chrome MCP)
1. themes 페이지 → "AI · 반도체" 카드 클릭 → 채팅 → "현재 테마의 NVDA 상황 분석"
2. system 프롬프트 확인 → `【현재 테마: ai · 등록 15종목 라이브 가격】` 블록 + 6개 데이터 라벨 + ABSOLUTE RULES 5조
3. "오늘 엔비디아 발표 뉴스" → 🔍 Claude 웹 검색 배지 + 검색 결과 인용
4. 콘솔: `AIO.assertTickerRegistryCompleteness().coveragePct >= 80`
5. 콘솔: `AIO.getThemeFetchCoverageAudit('ai').tickers > 10`
6. opt-out: `localStorage.setItem('aio_web_search_enabled','off')` → 배지 없음

---

# AIO Screener — QA 체크리스트 v3.7 (구 v3.6 본문)

> **v3 배경**: v2는 브라우저 런타임·콘솔·차트·레이아웃에 강하지만, LLM 답변·뉴스 선별·포트폴리오·기업분석·번역·API 키·인터랙션·성능·접근성 등 스크리너 핵심 기능의 50%+가 QA 범위 밖이었음. v3는 22개 페이지 × 264개 클릭 핸들러 × 10개 기능 모듈을 전수 커버.
> **v3.1 추가 (2026-04-06)**: v42.5~v42.7 전수 QA에서 발굴한 P56~P60 패턴 반영. init 중복 cleanup(P56), 그리드 모바일(P57), applyDataSnapshot 역방향(P58), API 전역 초기화 순서(P59), 크로스페이지 함수 연결(P60).
> **v3.2 추가 (2026-04-08)**: v44.6 이벤트-드리븐 QA에서 발굴한 P61~P63 반영. 17단계 신설 — 이벤트 후 하드코딩 텍스트 퇴행 검증(P61), "구조적 한계" 거부 원칙(P62), 전역 타이머 추적 불가(P63).
> **v3.3 추가 (2026-04-09)**: v44.9 /bug-fix QA에서 발굴한 P64 반영. 3F-0 신설 — SCREENER_DB 신규 종목 KNOWN_TICKERS 동시 등록 검증.
> **v3.4 추가 (2026-04-09)**: v45.5 표면 점검 사각지대 QA에서 발굴한 P65~P67 반영. **신규 19단계: 사용자 인터랙션 결과 검증** — UI 토글/탭/모드 클릭 시 결과값이 실제로 바뀌는지(P65), 데이터 미수신 시 "로딩" 영구 정체 없는지(P66), 동급 컴포넌트 자식 구조 일관성(P67).
> **v3.5 추가 (2026-04-17)**: v48.62 UX 실전성 보강(P106~P110) — 결론 바·fb-estimated 배지·신규 페이지 R49 준수.
> **v3.6 추가 (2026-04-28)**: v48.69 보안·타이머·데이터 무결성 감사(P140~P143). **QC9·QC10 게이트 신설** — CDN SRI 완결성(R34/P140), setInterval ID 저장(R9/P141). **20단계** — grep 기반 자동 검증 4항목.
> **핵심 원칙**: 코드 수정 → "고쳤다" 선언 금지. **브라우저에서 직접 확인한 증거**가 있어야 완료.
> **반복 요청 분석 결과**: 6대 패턴 중 #1 "코드 고쳤다면서 브라우저에서 안 되잖아"가 최다 빈도 → 이 체크리스트의 존재 이유
> **총 검증 항목**: 234개 (v3: 204개 + v3.1: 12개 + v3.2: 14개 + v3.3: 1개 + v3.4: 3개 신규)

---

## 최상위 바이너리 판정 (QC1~QC8)

수정 후 `/qa` 또는 `/post-edit-qa` 실행 시 **반드시** 아래 8개 게이트에 명시적 yes/no 답변. 이 섹션은 18단계 상세 체크리스트의 **요약 판정 레이어** — 각 상세 단계의 핵심만 추출.

| # | 게이트 | 기준 | 참조 단계 |
|---|--------|------|-----------|
| **QC1** | 구조 무결성 | div 열림/닫힘 일치 **AND** 버전 7곳 동기화 **AND** 콘솔 ERROR 0건 | 1A, 2A, 4A |
| **QC2** | Dead Page 없음 | 22개 페이지 모두 3초 이내 콘텐츠 렌더링 + 차트 canvas에 픽셀 존재 | 1A, 11 |
| **QC3** | 데이터 정합성 (R15) | `d.pct \|\| 0` 패턴 0건 **AND** `_SNAP_FALLBACK` ≥50 심볼 | 3C, 8 |
| **QC4** | 네비게이션 사이클 | A→B→A / popstate / 해시 직접 접근 모두 정상 재렌더 | 1B |
| **QC5** | 뉴스 필터 규칙 (R16/R17/R22) | 매크로 뉴스에 ETF 티커 0 + 3글자 미만 단독 키워드 0 + score 임계값(90/45/30) 준수 | 9 |
| **QC6** | Dead Static HTML (P46) | `applyDataSnapshot` map의 모든 키가 HTML `data-snap` 속성과 1:1 매칭 | 13 |
| **QC7** | 과거 버그 재발 없음 | BUG-POSTMORTEM P41~P64 패턴 grep 결과 재발 0건 | 15 |
| **QC8** | 이벤트 정합성 (P61) | WTI/VIX/지정학 이벤트 후 하드코딩 서술 텍스트가 현재 상황과 일치 | 17 |
| **QC9** | CDN SRI 완결성 (R34/P140) | `grep -c 'integrity=' index.html` ≥ 3 **AND** crossorigin="anonymous" 동반 | 20 |
| **QC10** | setInterval ID 저장 (R9/P141) | `grep -En 'setInterval\(' js/aio-core.js js/aio-data.js \| grep -v 'window\._.*Timer\|clearInterval'` → 0건 | 20 |

### 판정 규칙
- **전부 yes** → PASS ✓, 배포 가능 (사용자 명시 승인 시)
- **1~2개 no** → FAIL, 해당 단계 재실행 후 재판정 (최대 2회)
- **3개 이상 no** → CRITICAL FAIL, 작업 중단 + 사용자 에스컬레이션

### 바이너리 원칙
- "대체로 통과" 금지 — 명시적 yes/no만 허용
- WARN은 게이트 실패로 승격 (감점 금지)
- "미확인" → no로 간주
- 재실행 시 전체 18단계가 아닌 **실패 단계만** 재실행

### QC 게이트 → 상세 단계 맵

| QC | 포함 단계 | P 번호 커버 |
|----|-----------|-------------|
| QC1 | 0, 1A, 2A, 4 | P4, P26, R1 |
| QC2 | 1A, 1B, 11 | P9, P56, P58 |
| QC3 | 3, 8 | P25, R15 |
| QC4 | 1B, 1C | P31, P43 |
| QC5 | 9 | R16, R17, R22 |
| QC6 | 13 | P45, P46, P58 |
| QC7 | 15 | 전체 BUG-POSTMORTEM |
| QC8 | 17 | P61, P62, P63 |
| QC9 | 20 | R34, P140 |
| QC10 | 20 | R9, P141, P143 |

---

## 0단계: 수정 전 — 영향 범위 전수 파악

### 0A. 스코프 매핑 (수정 전 필수)

```
1. 수정 함수명:
2. 이 함수를 호출하는 곳 (grep 결과):
3. 이 함수가 접근하는 전역 변수 (window.*, ld[], sentPageCharts 등):
4. 영향받는 페이지 목록:
5. 영향받는 DOM 요소 ID:
6. 의존하는 데이터 소스 (Yahoo API? FRED? 하드코딩? _ldSafe?):
```

### 0B. 관련 코드 경로 전부 확인

```
이 수정이 영향 미치는 모든 코드 경로:
[ ] showPage() → 해당 페이지 init 호출 경로
[ ] popstate 핸들러 → 해당 페이지 처리 경로
[ ] 타이머/자동갱신 → 해당 데이터 refresh 경로
[ ] 앱 시작(DOMContentLoaded) → 초기 호출 경로
```

---

## 1단계: 브라우저 런타임 테스트 (스킵 시 완료 선언 불가)

### 실행 방법: 실제 브라우저에서 사이트 열고, 아래를 직접 확인

### 1A. 페이지별 순회 — 영향받는 모든 페이지 각각

```
[ ] 페이지 진입 → 3초 이내 콘텐츠 렌더링 (빈 화면 = FAIL)
[ ] 차트가 실제로 그려져 있음 (canvas에 픽셀이 있음, 비어있지 않음)
[ ] 차트 비율이 정상 (가로 세로 비율 왜곡 없음, 축 라벨 읽힘)
[ ] 수치가 실제값 (0.00%, "—", null, NaN = FAIL)
[ ] 변화율이 현실적 (모든 종목이 0% = FAIL, 100%+ = 의심)
```

**브라우저에서 직접 확인하는 방법 — JavaScript 실행:**
```javascript
// 각 페이지에서 실행: 빈 화면/미갱신 DOM 탐지
document.querySelectorAll('.stat-value, .metric-val, [id*="-val"]').forEach(el => {
  if (el.textContent.trim() === '—' || el.textContent.trim() === '0.00%' || el.textContent.trim() === '')
    console.warn('⚠ 빈/기본값 발견:', el.id || el.className, '=', el.textContent);
});
```

### 1B. 네비게이션 사이클 — 직접 클릭해서 확인

```
시나리오 1: 사이드바 A→B→A
[ ] home → signal → home: 시세 카드 정상
[ ] home → sentiment → home: 뉴스 카드 정상
[ ] sentiment → themes → sentiment: AAII 차트 재렌더 (빈 화면 아님)
[ ] fxbond → macro → fxbond: Yield Curve 차트 재렌더

시나리오 2: popstate (뒤로가기/앞으로가기)
[ ] signal 방문 → 다른 페이지 → 브라우저 뒤로가기 → signal 게이지/바/카드 정상
[ ] sentiment 방문 → 뒤로가기 → AAII 차트 재생성

시나리오 3: 해시 직접 접근
[ ] URL에 #signal 입력 → 직접 접근 시 대시보드 정상
[ ] F5 새로고침 → 현재 페이지 정상 유지
```

### 1C. 시간 경과 테스트

```
[ ] 페이지 로드 후 30~45초 대기 → 자동 갱신 작동 확인
[ ] 갱신 후 차트가 깨지지 않고 유지됨
[ ] 시그널 점수가 "—"에서 실제 숫자로 전환됨
```

---

## 2단계: Console + Network 검증

### 2A. Console 에러 — 0건이어야 통과

**브라우저에서 확인:**
```
[ ] DevTools Console 열기
[ ] 빨간색 에러 0건 (WARNING은 허용, ERROR는 불허)
[ ] 특히: "is not defined", "Cannot read properties of null", "Chart already initialized" 0건
```

**자동화 확인 — 콘솔에서 실행:**
```javascript
// 에러 카운터 설치 (페이지 로드 직후)
window._errCount = 0;
window.addEventListener('error', () => window._errCount++);
// 30초 후 확인
setTimeout(() => console.log('에러 수:', window._errCount), 30000);
```

### 2B. API 응답 구조 검증

**수정된 코드가 API 응답을 파싱하면 반드시:**
```
[ ] Network 탭에서 해당 API 호출 찾기
[ ] Response 탭에서 실제 JSON 구조 확인
[ ] 코드가 가정하는 필드(meta.regularMarketChangePercent 등)가 실제로 존재하는지 확인
[ ] 존재하지 않는 필드를 사용하면 → 수동 계산/폴백 로직 필수
```

**자동화 확인:**
```javascript
// Yahoo Finance chart API 응답 필드 확인 예시
fetch('https://query1.finance.yahoo.com/v8/finance/chart/SPY?range=1d&interval=1d')
  .then(r => r.json())
  .then(d => {
    var meta = d.chart.result[0].meta;
    console.log('regularMarketPrice:', meta.regularMarketPrice);
    console.log('regularMarketChangePercent:', meta.regularMarketChangePercent); // undefined이면 수동계산 필요
    console.log('chartPreviousClose:', meta.chartPreviousClose);
  });
```

### 2C. 핵심 함수 실행 검증

**브라우저 콘솔에서 직접 호출하여 동작 확인:**
```javascript
// 시그널 관련
typeof computeTradingScore === 'function'       // true?
typeof initSignalDashboard === 'function'       // true?
computeTradingScore()                           // .total이 숫자인가?

// 센티먼트 관련
typeof initSentimentCharts === 'function'       // true?
sentChartsInitialized                           // 현재 상태 확인

// 데이터 관련
typeof _ldSafe === 'function'                   // true?
_ldSafe('^TNX','price')                         // 숫자 반환? (0이나 null 아닌가)
_ldSafe('^VIX','price')                         // 숫자 반환?

// RRG 관련
typeof calcLiveRS === 'function'                // true?
typeof drawRRG === 'function'                   // true?
calcLiveRS()                                    // 배열 반환? rsRatio 범위 97~103?
```

---

## 3단계: 코드 레벨 정적 분석

### 3A. 캔버스 ID 매칭 (차트 수정 시 필수)

```
수정된 함수가 getElementById('캔버스ID')를 호출하면:
[ ] HTML에서 해당 id가 존재하는가? (grep으로 확인)
[ ] 해당 캔버스가 올바른 페이지 div(page-xxx) 안에 있는가?
[ ] 같은 함수가 다른 페이지에서도 호출되면 → 페이지별로 올바른 캔버스를 선택하는가?
[ ] chartDataGate()에 전달하는 캔버스 ID와 실제 getElementById의 ID가 일치하는가?
```

### 3B. init 가드 라이프사이클 (상태 변수 수정 시 필수)

```
if (xxxInitialized) return; 패턴이 있으면:
[ ] destroy 함수에서 xxxInitialized = false 리셋이 있는가?
[ ] 부모 함수(initXxxPage)가 자식 호출 전 리셋하는가?
[ ] DOMContentLoaded에서 조기 호출로 true가 설정된 후, 사용자 첫 방문 시 차단되지 않는가?

P56 이중 cleanup 루프 검사 (v42.6 추가):
[ ] init 함수 내에 Object.keys(pageCharts).forEach(destroy) 패턴이 2회 이상 존재하는가?
    grep: "Object.keys.*Charts.*forEach\|forEach.*destroy" + 동일 함수 내 중복 여부
[ ] 중복이 있으면 — 두 번째 루프가 방금 initXxxCharts()로 생성한 인스턴스를 즉시 파괴하지 않는지 확인
[ ] 올바른 구조: init 함수 상단 cleanup 1회 → 차트 생성 → (cleanup 없음)
```

### 3C. 데이터 폴백 체인

```
_liveData / ld[] 접근 코드:
[ ] ld['XXX'] ? ld['XXX'].price : null → null일 때 하류에서 무슨 일이 일어나는가?
[ ] _ldSafe() 사용했는가? (null 대신 _SNAP_FALLBACK 값 반환)
[ ] if (val) 에서 val=0이면 false → 0인 실제 데이터가 버려지지 않는가?
```

### 3D-1. CSS 셀렉터 범위 (v41.1 추가)

```
CSS 규칙 추가 시:
[ ] `*` 유니버설 셀렉터는 box-sizing 리셋 외 사용 금지 -> `html` 또는 구체적 셀렉터
[ ] 타이밍/사이즈 매직 넘버는 T 상수 객체 또는 CSS 변수 사용
[ ] 인라인 스타일과 CSS !important 충돌 시 -> 인라인 dead code 제거
```

### 3G. Dead Static HTML / applyDataSnapshot 매핑 검증 (v42.4 추가, v42.7 보강)

> **배경**: v42.4 전수 QA에서 발견. HTML에 `data-snap` 속성이나 DOM ID가 선언되어 있어도 JS 업데이트 함수가 없으면 하드코딩 값이 영구 고정됨. 코드 리뷰로는 발견 불가 — grep 전수 확인 필수.
> **v42.7 보강 (P58)**: 역방향도 검증 필수 — map에 있는데 HTML 없으면 silent dead code.

```
applyDataSnapshot 매핑 완전성 (양방향 검증):
[ ] HTML→map: HTML의 모든 data-snap 키가 applyDataSnapshot map에 존재하는가?
    확인: grep -oP 'data-snap="[^"]*"' index.html | sort -u → map과 대조
[ ] map→HTML (P58 역방향): applyDataSnapshot map의 모든 키에 data-snap="해당키" HTML 요소가 존재하는가?
    확인: map 키 목록 추출 → 각 키에 대해 grep 'data-snap="키"' index.html | wc -l = 0이면 dead code
    자동화:
    grep -oP "'[a-z0-9-]+':\s*[^,}]+" index.html  # map 키 추출 (수동 검증)
[ ] 새 map 키 추가 시 → HTML에 data-snap 요소도 동시 추가했는가?
[ ] map 키 제거 시 → HTML에 data-snap 요소도 동시 제거했는가?

Dead DOM 탐지 (항상 "—" 또는 하드코딩 고정 값 요소):
[ ] signal 페이지 브레드쓰 바 (bb-5sma-bar/val/badge, bb-20sma-bar/val/badge, bb-50sma-bar/val/badge): ID 존재 + updateBreadthBars() 호출 확인
[ ] breadth 페이지 NDX 카드 (bp-ndx5-val, bp-ndx20-val, bp-ndx50-val): ID 존재 + updateBreadthBars() 호출 확인
[ ] technical 페이지 breadth-bar 게이지: querySelector('div') 패턴이 아닌 el.style.width 직접 적용 확인

querySelector null 위험:
[ ] breadthEl.querySelector('div').style → breadthEl 자체가 bar인 경우 null 위험. el.style.width 직접 사용
[ ] 새 코드에서 querySelector().style 패턴 사용 시 null 가드 (if (child) child.style...) 추가

데이터 staleness (R21):
[ ] bpLabels / bhLabels 마지막 날짜가 현재 기준 10거래일 이내 (DATA_SNAPSHOT 갱신 시 함께 갱신)
[ ] window._breadth5, _breadth200, _breadth50, _breadthNDX5/20/50 6개 전역 변수 존재 확인
[ ] getDataAge().stale = days > 1 — 2일 이상 경과 시 stale 배지 표시 (R21)
```

**브라우저 자동 확인 스크립트:**
```javascript
(function() {
  var deadIds = ['bb-5sma-val','bb-20sma-val','bb-50sma-val','bp-ndx5-val','bp-ndx20-val','bp-ndx50-val','breadth-pct'];
  var dead = deadIds.filter(function(id) { var el = document.getElementById(id); return el && (el.textContent === '—' || el.textContent === ''); });
  if (dead.length) console.warn('[QA 3G] Dead DOM:', dead); else console.log('[QA 3G] Dead DOM 없음 ✓');
  var retail = document.querySelector('[data-snap="retail-sales"]');
  if (retail && retail.textContent !== '+0.6%' && retail.textContent !== '') console.log('[QA 3G] retail-sales 동적 갱신됨:', retail.textContent, '✓');
  else if (retail && retail.textContent === '+0.6%') console.warn('[QA 3G] retail-sales 하드코딩 고정 의심');
})();
```

### 3D. 이벤트 핸들러 완전성

```
페이지 init 함수를 수정했으면:
[ ] showPage() switch/if에서 해당 페이지 분기에 같은 함수 호출되는가?
[ ] popstate 핸들러에서 해당 페이지 분기에 같은 함수 호출되는가?
[ ] aio:liveQuotes 이벤트에서 활성 페이지일 때 갱신 함수 호출되는가?

P60 크로스페이지 공유 함수 연결 검사 (v42.7 추가):
[ ] 여러 페이지에서 동일 데이터 섹션을 표시하는 함수가 있는가?
    예: updateBreadthBars()는 breadth 페이지 + signal 페이지 모두 브레드쓰 데이터 표시
[ ] 있다면 — 각 페이지의 aio:liveQuotes 리스너에 해당 함수 호출이 연결되어 있는가?
[ ] 없다면 — 한 페이지를 방문해야만 다른 페이지의 데이터가 업데이트되는 의존성 버그 발생
    확인: grep "updateBreadthBars\|updateXxxSection\|refreshXxx" index.html → 호출 지점 수 확인
```

### 3E. 전역 상태 영향 범위

```
window.* 변수를 수정/읽는 코드:
[ ] 해당 변수를 write하는 다른 함수가 있는가? (race condition 가능성)
[ ] 해당 변수를 read하는 다른 함수가 있는가? (영향 범위)
[ ] 변수가 처음 어디서 초기화되는가? (undefined 상태로 read되는 시점이 있는가?)

P59 API 의존 전역 변수 초기화 순서 (v42.7 추가):
[ ] API 콜백에서만 set되는 전역 변수(예: _lastFG, _lastVIX 등)가 있는가?
    grep: "window\._last[A-Z]" → fetchXxx() 내에서만 write되는지 확인
[ ] 그런 변수를 쓰는 컴포넌트(AI 컨텍스트, 트레이딩 점수, 페이지 init)가 API 응답 전에 호출될 수 있는가?
[ ] 있다면 — applyDataSnapshot() 직후 DATA_SNAPSHOT 정적 폴백으로 초기값 설정:
    예: if (!window._lastFG) window._lastFG = DATA_SNAPSHOT.fg || 18;
[ ] 단, API 응답이 오면 덮어쓰도록 fetchXxx() 콜백에도 동일 변수 write 유지
```

### 3F-0. P24 일반 보호 검증 (data-live-price 관련 수정 시 필수) — v38.3 추가

```
[ ] 벌크 `[data-live-price]` 업데이트 3곳에서 `el.children.length > 0` 체크 유지되는가?
[ ] 복합 요소(.kr-ticker-pill, .kr-etf-card 등)의 자식이 벌크 업데이트로 파괴되지 않는가?
[ ] KR 테마 pill: 종목명/비중/등락률 모두 표시되는가? (최초 로드 + 실시간 갱신 후)
[ ] KR ETF 카드: 가격/등락률 모두 표시되는가? (최초 로드 + 실시간 갱신 후)
[ ] 새 `data-live-price` 속성 추가 시: 벌크 업데이트와 충돌 여부 확인
```

### 3F. 종목 데이터 무결성 검증 (종목 추가/수정 시 필수) — v35.6 추가

> **배경**: 269620/294870/044820 3건에서 종목코드 오매핑, 비상장 기업 코드 할당, 모자회사 혼동이 동시 발생. QA 204항목 중 "데이터 원본 정확성" 검증이 0개였음.

#### 3F-0. SCREENER_DB 신규 종목 KNOWN_TICKERS 동시 등록 (P64 — v44.9 추가)
```
[ ] SCREENER_DB에 신규 sym 추가 시 → KNOWN_TICKERS Set에도 알파벳순으로 동시 등록했는가?
    확인: grep "'심볼'" index.html | grep -v "sym:\|memo:\|sector:\|mcap:\|rsi:" → KNOWN_TICKERS 라인이 반드시 나와야 함
[ ] 미등록 시 증상: 뉴스 피드에서 해당 종목 관련 기사에 티커 배지가 붙지 않음 (extractTickers() 누락)
```

#### 3F-1. 신규 종목 추가 시 3중 검증 (R10)
```
[ ] Yahoo Finance quote 페이지에서 공식 회사명이 DB 등록명과 일치하는가?
    예: 269620.KQ → "Syswork Co." ≠ "레인보우로보틱스" → FAIL
[ ] 해당 기업이 KOSPI/KOSDAQ에 상장되어 있는가? (R11)
    검증: 네이버증권/KRX에서 "비상장", "장외거래" 표기 없는지 확인
    예: "두나무" → 비상장 → 코드 할당 금지
[ ] 유사 이름 모자회사가 있는가? (R12)
    검증: 동일 검색어로 복수 종목 나오면 정식명·코드·시총 각각 확인
    예: "코스맥스" 검색 → 192820(코스맥스) + 044820(코스맥스BTI) → 본사=192820
```

#### 3F-2. 기존 종목 데이터 갱신 시 일관성 검증
```
[ ] KR_STOCK_DB의 코드가 KR_THEME_MAP에서 참조하는 코드와 일치하는가?
    자동화: KR_THEME_MAP 내 모든 code → KR_STOCK_DB에 존재 확인
[ ] FALLBACK_QUOTES의 심볼이 KR_STOCK_DB의 코드와 일치하는가?
[ ] SCREENER_DB의 sym이 KR_STOCK_DB와 일치하는가?
[ ] alias 배열(코스닥/kosdaq/k뷰티 등)의 심볼이 실제 DB에 존재하는가?
[ ] KR_STOCK_DB의 .KQ 종목이 실제 코스닥 상장인가? (KOSPI 종목이 섞여있지 않은가?)
```

#### 3F-3. 가격/시총 합리성 검증
```
[ ] 가격이 전일 대비 ±50% 초과 변동 시 → 액면분할/합병 여부 수동 확인
    예: 코스맥스 110,000→9,520 (10배+ 하락) → 액면분할 의심
[ ] 시총이 0.0조 또는 0인 종목이 없는가?
[ ] 대형주(시총 10조+)인데 가격이 비정상적으로 낮지 않은가?
[ ] 테마별 상위 비중 종목의 가격 추이가 해당 테마(반도체/방산/바이오 등)와 상관관계가 있는가?
    예: crypto 테마 40% 종목의 일간 수익률이 BTC 움직임과 무관하면 → 오매핑 의심
```

#### 3F-4. 자동화 검증 스크립트 (Python)
```python
# 수정 후 반드시 실행 — 3가지 자동 검출
import re
with open('index.html','r') as f: txt = f.read()

# 1) KR_THEME_MAP → KR_STOCK_DB 참조 무결성
db_codes = set(re.findall(r"'(\d{6})':\s*\{name:", txt))
theme_codes = set(re.findall(r"code:'(\d{6})'", txt))
orphan = theme_codes - db_codes
assert not orphan, f"THEME→DB 누락: {orphan}"

# 2) KR_THEME_MAP 각 테마 가중치 합=100
themes = re.findall(r"'([a-z-]+)':\s*\[", txt[txt.find('KR_THEME_MAP'):])
for t in themes:
    weights = re.findall(r'w:(\d+)', txt[txt.find(f"'{t}': ["):txt.find(']', txt.find(f"'{t}': ["))])
    assert sum(int(w) for w in weights) == 100, f"{t} 가중치 합 ≠ 100"

# 3) 중복 코드 탐지
codes = re.findall(r"'(\d{6})':\s*\{name:", txt)
dupes = [c for c in codes if codes.count(c) > 1]
assert not dupes, f"중복 코드: {set(dupes)}"

print("✅ 종목 데이터 무결성 검증 통과")
```

---

## 4단계: 시각적 품질 검증

### 4A. 차트 비율/스케일

```
[ ] Canvas width/height 속성 vs CSS width/height → 비율 일치하는가?
[ ] CSS width:100% 사용 시 canvas 속성도 동적 조정하는가?
[ ] 데이터 포인트가 차트 영역의 20~80% 활용 (한쪽에 몰려있으면 정규화 문제)
[ ] 축 라벨이 잘리지 않고 읽히는가?
```

### 4B. 수치 합리성 (수동 교차검증)

```
[ ] 주요 수치 3개를 외부 소스(Yahoo Finance 웹, TradingView)와 비교
[ ] 변화율이 0.00%인 종목이 3개 이상 → 데이터 파이프라인 문제
[ ] 스프레드가 "—" → 폴백 미작동
[ ] RS 값이 모두 100 근처 → 정규화 범위 확인
[ ] 날짜 라벨이 현재 날짜 기준인가? (stale 하드코딩 아닌가?)
```

---

## 5단계: 회귀 테스트 (수정 외 영역)

```
[ ] 수정하지 않은 인접 페이지 2개 이상 방문 → 정상 작동 확인
[ ] 홈 페이지 시세 카드 정상
[ ] 사이드바 네비게이션 전체 동작
[ ] 다크 테마 렌더링 정상 (글씨 색, 배경 색)
```

---

## 6단계: LLM / AI 채팅 시스템 검증

> 코드 참조: `chatSend()`, `_getChatRules()`, `CHAT_CONTEXTS`, `consumeLLMQuery()`, `renderMarkdownLight()`
> 영향 페이지: **모든 22개 페이지** (각 페이지에 AI 채팅 패널 존재)

### 6A. 채팅 기본 동작

```
[ ] 채팅 입력창에 텍스트 입력 → Enter 또는 전송 버튼 → 응답 수신 확인
[ ] 응답이 스트리밍으로 표시됨 (한 번에 덤프가 아님)
[ ] 응답 완료 후 [Q:후속질문1||후속질문2||후속질문3] 칩이 생성됨
[ ] 칩 클릭 → 해당 질문이 자동 입력되고 전송됨
[ ] 🗑 버튼 → 채팅 기록 초기화 (이전 대화 사라짐)
[ ] API 키 미설정 시 → "API 키를 설정해주세요" 안내 표시 (무한 로딩 아님)
```

### 6B. 컨텍스트별 시스템 프롬프트 검증

```
각 페이지에서 질문 전송 후 응답이 해당 페이지 맥락에 맞는지:
[ ] home: 대시보드 데이터(S&P, VIX, F&G) 인용
[ ] signal: 트레이딩 스코어 인용 + 5대 컴포넌트 언급
[ ] breadth: 시장폭 지표(5SMA/20SMA/50SMA 비율) 언급
[ ] sentiment: F&G, AAII, Put/Call 언급
[ ] technical: Weinstein Stage, RSI, MACD 언급
[ ] macro: 금리, DXY, WTI, Brent 인용
[ ] fundamental: 실제 수집 데이터(FMP/SEC) 인용 (학습 데이터 아닌 실시간)
[ ] portfolio: 사용자 실제 보유 종목 티커 인용
[ ] fxbond: 수익률곡선, 원/달러, 캐리트레이드 맥락
[ ] options: VIX 기반 전략 매핑, 그릭스 언급
```

### 6C. LLM 응답 품질 검증

```
[ ] 마크다운 테이블(| col | col |)이 답변에 포함되지 않음 (포맷 규칙 ①)
[ ] 의사/환자/진단 비유가 사용되지 않음 (포맷 규칙 ②)
[ ] 이모지 5개 이하 (포맷 규칙 ④)
[ ] 수준 분리 표현 없음 ("초보자는~", "고급 사용자는~" 등 없음)
[ ] "Tier X급" 표현 없음
[ ] 투자 책임 고지가 첫 응답에 1회 포함
[ ] 실시간 데이터 섹션의 실제 수치를 인용 (학습 데이터 가격 사용 금지)
```

### 6D. LLM 쿼타/비용 시스템

```
[ ] LLM ON/OFF 토글 작동
[ ] 일일 사용량 카운터 표시
[ ] 일일 한도 초과 시 확인 팝업 발생
[ ] 적응형 모델 선택: 단순 질문→Haiku, 복잡 질문→Sonnet 자동 전환
```

### 6E. 응답 렌더링 품질

```
[ ] 볼드(**텍스트**)가 <strong>으로 렌더링됨
[ ] 코드블록(```)이 <pre> 태그로 정상 표시
[ ] 긴 응답이 채팅 버블 밖으로 넘치지 않음 (.acp-bubble overflow)
[ ] 긴 응답 시 채팅 영역 자동 확장 (chat-expanded 클래스)
[ ] ↗ 확장/↙ 축소 버튼 동작
[ ] 숫자가 볼드 또는 별도 행으로 강조됨
```

### 6F. 채팅 DOM 구조 무결성 검증 (★ 핵심 — v34.1 사후 추가)

> **배경**: v34.1에서 `chatAppendMsg()`가 id를 `.acp-msg` wrap에 설정 → `onDone`이 wrap의 innerHTML을 덮어쓰면서 `.acp-bubble`이 소멸 → 128개 블록 요소가 `flex-direction:row` 부모에 직접 배치 → **가로 렌더링**. CSS만으로는 해결 불가한 구조적 버그.

```
스트리밍 완료 후 DOM 구조 점검:
[ ] .acp-msg.ai 안에 .acp-bubble 자식이 존재하는지 확인
    검증: document.querySelectorAll('.acp-msg.ai').forEach(m => { if (!m.querySelector('.acp-bubble')) console.error('❌ bubble 소실:', m); })
[ ] .acp-msg.ai의 직접 자식이 1~3개 (bubble + badge + 기타) — 128개 등 대량이면 FAIL
    검증: document.querySelectorAll('.acp-msg.ai').forEach(m => { if (m.children.length > 5) console.error('❌ 자식 과다:', m.children.length); })
[ ] .acp-bubble의 scrollWidth ≤ offsetWidth (가로 넘침 없음)
    검증: document.querySelectorAll('.acp-bubble').forEach(b => { if (b.scrollWidth > b.offsetWidth + 2) console.error('❌ 가로 넘침:', b.scrollWidth, '>', b.offsetWidth); })
[ ] chatAppendMsg()에서 id가 bubble에 설정되는지 코드 확인 (bubble.id = id, NOT wrap.id = id)
[ ] onDone의 getElementById('chat-xxx-streaming')이 .acp-bubble을 반환하는지 확인
[ ] 로딩 제거 시 .acp-msg wrap 전체가 제거되는지 (빈 wrap 잔류 방지)
    검증: loadEl.closest('.acp-msg') 패턴 사용 여부

자동 확장 동작:
[ ] 200자 이상 응답 시 chat-expanded 클래스 자동 추가
[ ] 확장 시 .acp-messages의 max-height가 none (무제한)
[ ] 확장 상태에서 세로 스크롤 정상 작동
[ ] 축소 버튼 클릭 시 원래 크기로 복원
```

**반드시 브라우저에서 검증할 JS 스니펫:**
```javascript
// AI 답변 완료 후 실행 — DOM 구조 건전성 체크
(function chatDomHealthCheck() {
  var msgs = document.querySelectorAll('.acp-msg.ai');
  var issues = [];
  msgs.forEach(function(m, i) {
    if (!m.querySelector('.acp-bubble')) issues.push('msg[' + i + ']: bubble 없음');
    if (m.children.length > 5) issues.push('msg[' + i + ']: 자식 ' + m.children.length + '개 (구조 파괴)');
    var b = m.querySelector('.acp-bubble');
    if (b && b.scrollWidth > b.offsetWidth + 2) issues.push('msg[' + i + ']: 가로 넘침 ' + b.scrollWidth + '>' + b.offsetWidth);
  });
  if (issues.length === 0) console.log('✅ 채팅 DOM 건전성 OK (' + msgs.length + '개 메시지)');
  else issues.forEach(function(s) { console.error('❌ ' + s); });
  return issues;
})();
```

---

## 7단계: 뉴스 엔진 검증

> 코드 참조: `fetchAllNews()`, `scoreItem()`, `classifyTopic()`, `isTelegramMsgRelevant()`, `renderFeed()`
> 영향 페이지: home, market-news, briefing

### 7A. 뉴스 수집 파이프라인

```
[ ] 시장 소식 페이지 진입 → 프로그레스 바 표시 → 소스별 순차 로딩
[ ] 최종 "X건 수집 · Y개 소스" 표시
[ ] 수집 완료 후 뉴스 카드가 렌더링됨 (빈 화면 아님)
[ ] ↻ 새로고침 버튼 → 재수집 동작
```

### 7B. 뉴스 선별 품질

```
[ ] 연예/스포츠/부동산/날씨 뉴스가 피드에 없음
[ ] 주식/매크로/반도체/에너지/채권/외환/지정학/방산 뉴스만 존재
[ ] 한국 뉴스가 피드 상위를 독점하지 않음 (US 외신이 우선)
[ ] 토픽 필터(매크로/주식/에너지/크립토) 클릭 → 해당 토픽만 표시
[ ] 국가 필터(미국/한국/아시아/유럽) 클릭 → 해당 국가만 표시
[ ] 📡 텔레그램 필터 → TG 마크 뉴스만 표시
[ ] 매크로/지정학/정책 뉴스에 ETF/지수 티커($GLD,$TLT,$XLE 등) 안 붙음 (v39.0)
[ ] 기업/실적/섹터 뉴스에만 관련 종목 티커 표시됨 (v39.0)
[ ] TECH_KW에 3글자 미만 단독 키워드 없음 — 오탐 방지 (v39.0 P28)
[ ] 한국어 번역 제목이 표시됨 (getDisplayTitle 사용 확인)
```

### 7B-2. 홈 핵심 뉴스 품질 (v39.0)

```
[ ] 오늘의 시장 배너 하단에 핵심 뉴스 3개 이하 불릿 표시
[ ] 전체 80소스 수집 완료 후에만 핵심 뉴스 렌더링 (점진적 렌더링 아님)
[ ] score 90+ 시장 이동 이벤트만 선별 (매크로/지정학 +30 가중)
[ ] 핵심 뉴스에 매크로/지정학 티커 안 붙음
[ ] 한국어 번역 제목으로 표시
[ ] 비금융 기사(셀럽, 범죄, 스포츠) 완전 차단
[ ] 제목 유사도 기반 중복 제거 — 같은 이벤트 다른 기사 중복 안 됨
```

### 7C. 텔레그램 채널 수집 검증

```
[ ] bornlupin 채널에서 뉴스 수집됨
[ ] insidertracking 채널에서 뉴스 수집됨
[ ] aetherjapanresearch 채널에서 뉴스 수집됨
[ ] walterbloomberg 채널에서 뉴스 수집됨 (v39.0: CF Worker 직접 스크래핑)
[ ] TG 뉴스에 📡 TG 뱃지 표시
[ ] 스팸/광고 메시지가 필터링됨
[ ] 우주/항공우주 뉴스(SpaceX/NASA)가 차단되지 않음
[ ] firstsquawk/financialjuicechannel이 즉시 스킵됨 (콘솔에 '비활성' 로그)
[ ] 광범위 키워드만('시장', 'market' 등) 1개 매칭된 비금융 기사가 차단됨
[ ] 핵심 인물 발언(Powell, Jensen Huang 등) 뉴스가 상위에 위치
```

---

## 8단계: 포트폴리오 관리 검증

> 코드 참조: `addPortfolioPosition()`, `removePosition()`, `renderPortfolio()`, `getPortfolioContextForAI()`
> 영향 페이지: portfolio

### 8A. CRUD 동작

```
[ ] 종목 추가 (티커 + 수량 + 매수가 + 목표가 입력 → 추가 버튼)
[ ] 추가된 종목이 테이블에 표시 (현재가, 변화율, 손익, 목표가)
[ ] 종목 삭제 → 목록에서 제거
[ ] 수량/매수가/목표가 수정 가능
[ ] 데이터가 localStorage에 저장됨 (새로고침 후에도 유지)
```

### 8B. 손익 계산 정확성

```
[ ] 손익 = (현재가 - 매수가) × 수량 → 올바른 숫자
[ ] 손익률 = ((현재가 - 매수가) / 매수가) × 100 → 올바른 %
[ ] 양수 = 초록색, 음수 = 빨간색
[ ] 총 자산 = Σ(현재가 × 수량) → 올바른 합계
[ ] 목표가 대비 업사이드(%) 표시 (목표가 설정 시)
```

### 8C. 포트폴리오 → AI 연결

```
[ ] 포트폴리오 페이지에서 AI 채팅 시 → 실제 보유 종목이 프롬프트에 주입
[ ] "내 포트폴리오 분석해줘" → 보유 종목 티커·수량·손익·보유일수가 응답에 인용
[ ] 목표가 설정 종목 → AI가 목표가 대비 현재 상태 분석
```

### 8D. 확인 모달 시스템 (v34.1+)

> 코드 참조: `showConfirmModal()`, `closeConfirmModal()`, `_confirmCallback`

```
[ ] 포트폴리오 전체 삭제 → 네이티브 confirm() 대신 커스텀 모달 표시 (🗑️ 아이콘)
[ ] 개별 종목 삭제 → 커스텀 모달 (📉 아이콘)
[ ] 채팅 기록 삭제 → 커스텀 모달 (💬 아이콘)
[ ] 모달 "취소" 클릭 → 아무것도 삭제 안 됨
[ ] 모달 "확인" 클릭 → 콜백 실행 (삭제 진행)
[ ] ESC 키 → 모달 닫힘
[ ] 배경 클릭 → 모달 닫힘
[ ] 모달 닫힌 후 ESC 핸들러 정리됨 (메모리 누수 없음)
```

### 8E. 다중 워치리스트 시스템 (v34.1+)

> 코드 참조: `getWatchlists()`, `saveWatchlists()`, `createWatchlist()`, `deleteWatchlist()`, `addToWatchlist()`, `removeFromWatchlist()`, `addToWatchlistFromScreener()`, `renderWatchlistContent()`, `refreshWatchlistUI()`
> localStorage 키: `aio_watchlists`, `aio_watchlist_active`

```
CRUD:
[ ] 새 리스트 생성 (이름 입력) → 드롭다운에 표시
[ ] 리스트 이름 변경 → 드롭다운 반영
[ ] 리스트 삭제 → 확인 모달 표시 → 삭제 후 드롭다운에서 제거
[ ] 종목 추가 (티커 + 메모 입력) → 테이블에 표시
[ ] 종목 삭제 (✕ 버튼) → 테이블에서 제거

데이터 연동:
[ ] 워치리스트 종목에 실시간 가격 표시 (_liveData 연동)
[ ] SCREENER_DB 종목 → 신호(BUY/SELL/WATCH/HOLD) 뱃지 표시
[ ] SCREENER_DB 종목 → 종목명(NVIDIA, Apple 등) 표시
[ ] aio:liveQuotes 이벤트 시 워치리스트 자동 갱신
[ ] 포트폴리오 AI 분석 프롬프트에 워치리스트 컨텍스트 포함

UI 상태:
[ ] 리스트 미선택 시 → 안내 메시지 표시, 추가 입력 숨김
[ ] 리스트 선택 후 → 추가 입력 노출, 이름변경/삭제 버튼 활성화
[ ] 빈 리스트 → "리스트가 비어있습니다" 메시지
[ ] 드롭다운 전환 → 테이블 내용 즉시 변경
[ ] 새로고침 후에도 localStorage에서 복원

스크리너 연동:
[ ] 스크리너 결과 테이블에 ⭐ 컬럼 + 버튼 표시
[ ] ⭐ 클릭 → 워치리스트 1개면 바로 추가 + 토스트 알림
[ ] ⭐ 클릭 → 워치리스트 여러 개면 선택 프롬프트
[ ] 워치리스트 0개 시 → 안내 알림

중복 방지:
[ ] 같은 이름 리스트 생성 불가
[ ] 같은 티커 중복 추가 시 알림
```

---

## 9단계: 기업 분석 (Fundamental) 검증

> 코드 참조: `fundamentalSearch()`, `_fmpFetch()`, `fetchSECFilings()`, `CHAT_CONTEXTS.fundamental`
> 영향 페이지: fundamental

### 9A. 데이터 수집 파이프라인

```
[ ] 티커 입력 → 🔍 기업 분석 버튼 → 프로그레스 표시
[ ] Yahoo Finance 시세 수집 확인
[ ] SEC EDGAR 공시 수집 확인
[ ] SEC XBRL 재무데이터 파싱 확인
[ ] FMP API 키 있을 때: 18개 엔드포인트 + TTM 2개 (ratios-ttm, key-metrics-ttm) 수집 확인
[ ] FMP API 키 없을 때: SEC+Yahoo만으로 분석 (에러 없음)
[ ] 수집 완료 → "✅ 데이터 수집 완료 — N개 소스" 표시
[ ] 최근 검색 기록 칩에 검색한 티커 추가됨
```

### 9B-1. 데이터 정확도 검증 (v35.2 추가)

```
[ ] 밸류에이션 카드의 P/E, P/B, EV/EBITDA가 TTM 뱃지 표시 (Annual이 아닌 TTM 우선)
[ ] 퀵뷰 EV/Sales 값이 P/S와 다름 (같으면 BUG — 과거 잘못된 proxy 할당)
[ ] 기관 투자자 포지션 가치가 현실적 (shares × value / shares 오류 방지 확인)
[ ] CAGR 라벨이 "2Y CAGR"로 표시 (과거 "3Y" 오류 수정 확인)
[ ] 프롬프트에 '핵심 밸류에이션 지표 (TTM)' + '밸류에이션 연간 추이 (Annual Trend)' 분리 확인
[ ] FRED 차트에서 0값이 정상 표시 (빈 구간 없음 — 과거 0→null 필터링 버그)
[ ] 주가 변화율 0.00%인 종목이 정상 표시 (과거 0%를 재계산하는 버그)
[ ] DCF upside/downside 수치가 정상 (NaN, undefined 없음)
[ ] 배당수익률: 가격 없을 때 'N/A' 표시 (과거 price=1 fallback 버그)
[ ] deep-compare 분석에서 '핵심 투자 지표 (TTM)' + '(Annual 추이)' 분리 표시
```

### 9B. UI 렌더링

```
[ ] 기업 헤더 (회사명, 티커, 시세, 변화율) 표시
[ ] SEC 공시 섹션 (최근 10-K, 10-Q, 8-K) 표시
[ ] 재무제표 차트/테이블 표시
[ ] 밸류에이션 지표 카드 표시 (TTM/Annual 뱃지 확인)
[ ] 경쟁사 비교 표시
[ ] 실적 서프라이즈 표시
```

---

## 10단계: API 키 / Vault / 설정 검증

### 10A. API 키 저장/로드

```
[ ] Anthropic API 키 입력 → 저장 → 새로고침 후 유지
[ ] FMP 키 입력 → 저장 → 기업 분석 데이터 풍부해짐
[ ] FRED 키 입력 → 저장 → 매크로 데이터 확장
[ ] CF Worker URL 입력 → 저장 → CORS 프록시 동작
```

### 10B. 키 없을 때 Graceful Degradation

```
[ ] Anthropic 키 없음 → AI 채팅 비활성, 나머지 기능 정상
[ ] FMP 키 없음 → 기업 분석은 SEC+Yahoo만으로 동작
[ ] 모든 키 없음 → 스크리너 기본 기능(시세, 차트, 뉴스RSS) 정상
[ ] 잘못된 키 입력 → 에러 표시 (무한 로딩 아님)
```

---

## 11단계: 종목 스크리너 검증

### 11A. 필터링 동작

```
[ ] 텍스트 검색(AI, 반도체 등) → 키워드 매칭 결과
[ ] 섹터 필터 클릭 → 해당 섹터만 표시
[ ] 시그널 필터 → BUY/HOLD/WATCH별 필터링
[ ] 인덱스 필터 (S&P500/NASDAQ100/DOW30) → 해당 구성종목만
```

### 11B. 스파크라인 미니차트 (v34.1+)

> 코드 참조: `renderSparklines()`, `fetchSparkData()`, `drawSparkline()`, `drawSparkPlaceholder()`, `_sparkCache`

```
[ ] 스크리너 결과 테이블에 "5일 추이" 컬럼 표시
[ ] 스캔 실행 후 canvas 요소(.sparkline-mini)가 각 행에 생성됨
[ ] Yahoo Finance Chart API(range=5d, interval=1d) 호출
[ ] 데이터 수신 시 → 그래디언트 채움 + 추세 라인 + 엔드포인트 도트 렌더링
[ ] 데이터 미수신 시 → "—" 플레이스홀더 표시 (에러 아님)
[ ] 5분 캐시 작동 (재렌더 시 API 재호출 없음)
[ ] DPR 스케일링 (Retina에서 선명)
[ ] 상승추세 = 초록, 하락추세 = 빨강 라인
[ ] colspan 정합성: 빈 결과 메시지 colspan=9 (⭐ 포함)
```

### 11C. 뉴스 필터링 & 주요 뉴스 (v34.1c)

> 코드 참조: `renderHomeFeed()`, `scoreItem()`, `NEWS_BLACKLIST_KW`, `_MEGA_TICKERS`, `_LARGE_TICKERS`, `isTelegramMsgRelevant()`

```
[ ] 대시보드 "주요 뉴스" 섹션에 최대 5개만 표시
[ ] 표시되는 뉴스의 score가 모두 ≥ 25
[ ] 매크로/지정학/실적/정책 토픽 뉴스가 상위에 위치
[ ] 한국 지역뉴스(시장이, 군수, 새만금, 종량제 등) 필터링됨
[ ] 한국 소스(country=kr) 금융 관련성 게이트 정상 적용
[ ] 3단계 컨텍스트 필터: 블랙리스트 + finRelevance≥3 오버라이드 동작
[ ] finRelevance=0 기사에 _FINANCE_RELEVANCE_KW 게이트 적용
[ ] _KR_BROAD_KW 2차 필터: 광범위 한국어만 있는 기사 차단
[ ] 대형주 MEGA 티커 뉴스 +8점 / LARGE 티커 +4점 부스트
[ ] US Tier1 소스 최상위, KR 소스 최하위 정렬
[ ] 텔레그램 메시지에도 글로벌 블랙리스트 적용
[ ] 뉴스 0건일 때 "현재 주요 뉴스가 없습니다" 안내 표시
[ ] 시장 품질 점수 최소값 5 (0이 아닌 값) 확인
[ ] NASDAQ 카드(^IXIC) 대시보드에 정상 표시
[ ] 5열 그리드 → 모바일 2열 반응형 정상 동작
```

### 11D. 섹터 비교 분석 시스템 (v34.2)

> 코드 참조: `_SECTOR_KEYWORDS`, `_detectSectorQuery()`, `_fetchSectorCompareData()`, `_formatSectorComparePrompt()`, `chatSend()` 섹터 통합부

```
[ ] "소프트웨어 기업 중 가장 싼 종목 찾아줘" → 섹터 감지 + FMP API 호출 발생
[ ] _detectSectorQuery: 섹터 키워드 + 의도 키워드 동시 존재 시에만 매칭
[ ] 섹터 매칭 결과에 최대 8개 종목만 포함
[ ] _fetchSectorCompareData: 5개 FMP 엔드포인트 병렬 호출 (ratios-ttm, key-metrics-ttm, income-statement, profile, price-target-consensus)
[ ] 비교 데이터에 25+ 필드 포함 (PER/PBR/PEG/EV-EBITDA/ROE/마진/성장률/애널리스트 등)
[ ] 섹터 평균 자동 계산 정상 동작
[ ] 밸류에이션 랭킹 (PER/PEG/EV-EBITDA/업사이드 정렬) 정상 출력
[ ] 개별 티커 감지(detectedTickers) 시 섹터 비교 비활성화 (우선순위 정상)
[ ] FMP API 실패 시 에러 조용히 처리 (console.warn만, UI 미노출)
[ ] 섹터 비교 프롬프트가 시스템 프롬프트 끝에 정상 추가됨
```

### 11E. 해자(Moat) 분석 프레임워크 (v34.2)

> 코드 참조: 기업분석 15포인트 프롬프트 #6, 해자 추론용 투자 강도 지표 섹션

```
[ ] 기업분석 프롬프트 #6에 7가지 해자 유형별 데이터→해자 매핑 포함
[ ] R&D/매출, SG&A/매출, CAPEX/매출, FCF마진 3개년 데이터 주입 정상
[ ] 해자 강도 종합 판정 기준 (Wide/Narrow/None) 명시
[ ] 해자 약화 경고 신호 조건 명시
[ ] fmpProfile(description) 2000자까지 확장되어 비즈니스 모델 충분히 제공
[ ] 개별 티커 채팅에 FMP 밸류에이션 데이터 (PER/PBR/PEG/EV-EBITDA) 정상 주입
[ ] 비교 분석 모드에서 4축 평가 (밸류에이션·수익성·성장·재무건전성) 동작
[ ] 밸류 트랩 경고 로직 프롬프트에 포함
```

### 11F. 기업 내부 비교 분석 시스템 (v34.3 갱신)

> 코드 참조: `_detectDeepCompareIntent()`, `_fetchDeepCompareData()`, `_formatDeepComparePrompt()`, `chatSend()` 심층 비교 통합부
> v34.3 QA 점검 기준 갱신 (2026-03-27)

```
[ ] "AMZN과 TSLA 비즈니스 모델 비교해줘" → 티커 2개 감지 + 내부 비교 의도 감지 발동
[ ] "NVDA vs AVGO 해자 비교분석" → 심층 데이터 18개 FMP 엔드포인트 병렬 호출 (v34.3에서 10→18 확장 확인)
[ ] _detectDeepCompareIntent: 기업 내부 키워드(~40개) + 비교 키워드(~15개) AND 조건으로 트리거
[ ] 티커 1개일 때는 발동하지 않음 (detectedTickers.length >= 2 조건)
[ ] 비즈니스 모델 설명 2000자 + 세그먼트별 매출(비중% 자동계산) + 지역별 매출 + 손익 3개년(GM/R&D/SG&A/OM/NM) + 현금흐름 3개년(CAPEX/FCF/자사주/배당) + 성장률 + 경영진 + 내부자(매수/매도 시그널) + 기관 투자자 + 대차대조표(D/E/유동비율) + 핵심지표(EV/EBITDA/FCF Yield/ROIC) + 실적서프라이즈 + 애널리스트추정 + 목표가/DCF + 경쟁사그룹 = 16개 데이터 블록
[ ] 15개 관점 비교 분석 지침 프롬프트 포함 (기업 개요~투자포인트)
[ ] 해자 7유형 비교 판정 지침 포함 (기술독점/네트워크/전환비용/브랜드/규모/무형자산/FCF전환)
[ ] _CHAT_RULES ⑤-3 규칙 정상 적용 ("이사회 보고 수준의 깊이" 명시)
[ ] FMP API 실패 시 에러 조용히 처리 (console.warn만)
[ ] ✅ v34.4 수정완료: 비교 키워드에 "장단점/장점/단점/우위/열위/pros/cons" 등 25개 추가
[ ] ✅ v34.4 수정완료: 티커 감지 3→5개 확장, 심층 비교 3개 초과 시 showToast 안내
```

### 11H. 단일 기업 심층 분석 모드 (v34.4 신규)

> 코드 참조: `_hasDeepAnalysisKw()`, `_DEEP_ANALYSIS_KW`, `_formatSingleDeepPrompt()`, `chatSend()` singleDeepStr 통합부

```
[ ] "NVDA 해자 분석해줘" → 티커 1개 감지 + 심층 키워드 감지 → 18개 FMP 엔드포인트 호출
[ ] "AAPL 비즈니스 모델 분석" → 단일 심층 분석 발동 확인
[ ] "TSLA 종합 분석해줘" → 단일 심층 분석 발동 확인
[ ] fundamentalSearch()로 이미 검색한 티커일 때 → 중복 호출 방지 (window._fundAnalysisData.ticker 체크)
[ ] FMP 키 없을 때 → 단일 심층 발동 안 함 (에러 없음)
[ ] _formatSingleDeepPrompt: 16개 데이터 블록 정상 출력 + 15개 관점 + 해자 7유형 지침 포함
[ ] _CHAT_RULES ⑤-4 규칙 정상 적용 ("전문 리서치 리포트 수준" 명시)
[ ] singleDeepStr이 시스템 프롬프트 끝에 정상 추가됨
[ ] deepCompareStr이 이미 있으면 singleDeepStr 비활성화 (중복 방지)
```

### 11G. 버전 & 스냅샷 동기화 (v34.2)

> 코드 참조: `APP_VERSION`, `DOMContentLoaded` 버전 동기화, `DATA_SNAPSHOT._updated`, 스탈니스 배너

```
[ ] APP_VERSION 상수 변경 시 title + #app-version-badge 자동 반영
[ ] sw.js SW_VERSION과 APP_VERSION 일치 확인
[ ] DATA_SNAPSHOT._updated가 24시간 이내일 때 노란 배너 미노출
[ ] 라이브 데이터 수신 시 aio:liveDataReceived 이벤트로 배너 즉시 해제
[ ] 5초 폴링 (최대 24회) → 2분 내 라이브 데이터 없으면 배너 유지
[ ] version.json과 APP_VERSION 값 일치 확인
[ ] 브라우저 콘솔에서 AIO.getOperationalHealth().serviceWorker 버전 확인
```

---

## 12단계: 인터랙션 전수 테스트

### 12A. 사이드바 네비게이션 (22개 페이지)

```
모든 nav-item 클릭 → 해당 페이지 표시:
[ ] 홈 / 매매시그널 / 시장폭 / 투자심리 / 데일리 브리핑
[ ] 차트 분석 / 매크로 / 환율채권 / 기업 분석 / 테마 분석
[ ] 종목 스크리너 / 옵션 / 포트폴리오 / 시장 소식 / 입문 가이드
[ ] 한국장 / 한국 테마 / 한국 수급 / 한국 매크로 / 한국 기술적 분석
```

### 12B. Dead Link / Dead Button 탐지

```javascript
document.querySelectorAll('[onclick]').forEach(el => {
  try {
    const fn = el.getAttribute('onclick').split('(')[0];
    if (typeof window[fn] !== 'function' && !fn.includes('.') && !fn.includes('this'))
      console.warn('❌ Dead onclick:', fn, '→', el.textContent?.slice(0,30));
  } catch(e) {}
});
```

---

## 13단계: 성능 / 메모리 검증

```
[ ] Chart.js 인스턴스 수 합리적 (중복 생성 없음)
[ ] DOM 노드 수 10,000개 이하
[ ] 페이지 전환 10회 반복 후 메모리 안정
```

---

## 14단계: 접근성 / 가독성

```
[ ] Tab 키로 주요 요소 순회 가능
[ ] [role="button"] 요소에 focus-visible 스타일 적용 확인
[ ] label-input for 연결 확인 (eq-price, eq-ema20, eq-rsi, fb-desc)
[ ] 모달 열림 시 첫 번째 버튼/입력에 자동 포커스
[ ] 모든 텍스트가 배경 대비 4.5:1 이상
[ ] 최소 font-size 11px (10px 이하 금지 -- v41.3 override 시스템)
[ ] 빨간색=하락/위험, 초록색=상승/안전 컬러 코딩 일관성
[ ] skip-link (.skip-link) HTML 존재 + JS 중복 없음
```

### 14B. 보안 검증 (v41.5 추가)

```
[ ] innerHTML에 사용자/외부 데이터 삽입 시 escHtml() 래핑 확인
    grep: innerHTML.*ticker|innerHTML.*msg|innerHTML.*sym
[ ] native confirm()/alert() 사용 금지 -- showConfirmModal() 사용
[ ] localStorage 민감 데이터 암호화 (safeLS/safeLSGet 사용)
```

### 14C. 타이머/메모리 검증 (v41.5 추가)

```
[ ] setInterval 추가 시 destroyPageCharts에 대응 clearInterval 존재
    grep: setInterval → 각각 clearInterval 짝이 있는지 확인
[ ] init 가드 (if (initialized) return) 사용 시 destroy에서 플래그 리셋
[ ] Dead code 주기 점검: 함수 정의만 있고 호출처 0건인 함수 없는지
```

---

## 15단계: 에러 복구 / Graceful Degradation

```
[ ] Yahoo Finance API 실패 → 폴백 시세 사용
[ ] CF Worker 프록시 실패 → 대체 프록시 자동 시도
[ ] RSS 피드 일부 실패 → 성공한 소스만으로 뉴스 렌더링
[ ] 시세가 NaN/Infinity → "—" 처리
```

---

## 16단계: 한국 시장 페이지 전용 검증

```
[ ] KOSPI/KOSDAQ/원달러 실시간 시세 표시
[ ] 한국 테마 HOT/강세/중립/조정 탭 필터 동작
[ ] 한국 기술적 분석: KOSPI/KOSDAQ 자동 분석 + 개별 종목 분석
[ ] Weinstein Stage, RSI, 이동평균 등 지표 표시
```

---

## 17단계: 이벤트-드리븐 시장 정합성 검증 (v3.2 신설 — 2026-04-08)

> **신설 배경**: v44.6 QA에서 WTI -15% 휴전 합의 이후 static 텍스트 6곳이 역방향 유지. DATA_SNAPSHOT 수치 갱신과 텍스트 서술 갱신이 분리된 구조적 공백. P61~P63 반영.

### 트리거: DATA_SNAPSHOT 주요 수치 갱신 이후, 또는 대형 시장 이벤트(전쟁·휴전·FOMC·금리결정·쇼크) 직후 반드시 실행

```
[ ] DATA_SNAPSHOT._note로 마지막 갱신 컨텍스트 확인
[ ] HOME_WEEKLY_NEWS[0] 이벤트 반영 여부 (이전 이벤트 뉴스 잔존 여부)

--- 매크로 페이지 텍스트 정합성 ---
[ ] 유가·에너지 섹션 "수요파괴 현황" 제목/데이터가 현재 WTI 방향과 일치하는지
[ ] JPM/IB 유가 대응 옵션 상태(○/◐/✓)가 현실 반영인지
[ ] 시나리오 A/B/C 조건 텍스트가 현재 시장과 충돌하지 않는지

--- 시그널 페이지 CP 카드 ---
[ ] CP1(지정학) 미터바 %와 detail 텍스트가 현 이벤트 상태를 반영하는지
[ ] CP3(거시경제)/CP6(원자재) CRITICAL/HIGH/MEDIUM 등급이 데이터와 정합하는지

--- 한국 매크로 페이지 코멘트 ---
[ ] 물가 섹션 코멘트가 현재 유가 방향과 일치하는지 (↑/↓ 역방향 금지)
[ ] 수입 동향 코멘트의 에너지 가격 방향이 DATA_SNAPSHOT.wtiPct와 일치하는지

--- 함수 구조 ---
[ ] generateMacroStoryline() 지정학 챕터 트리거 조건 확인:
    WTI pct 절대값 8%+ OR VIX 25+ && WTI 85+ 시 자동 삽입됨 (v44.6)
    → live _oilPct 먼저, 없으면 DATA_SNAPSHOT.wtiPct 폴백
[ ] setInterval == clearInterval 수 확인 (목표: 동일해야 함)
```

### grep 빠른 점검 (이벤트 후 역방향 텍스트 탐지)
```bash
# 이전 이벤트 서술 잔존 탐지
grep -n "이란전쟁\|전쟁 발발\|급등이.*리스크\|급증.*이란\|수요가 무너지고" index.html | grep -v "//\|MACRO_KW"

# 타이머 균형
echo "setInterval: $(grep -c 'setInterval' index.html) / clearInterval: $(grep -c 'clearInterval' index.html)"
```

---

## 실행 규칙 (위반 시 "완료" 선언 불가)

1. **1단계(브라우저 런타임) 스킵 → 완료 불가** — 코드만 고치고 끝내는 건 검증이 아님
2. **"문법 통과 ✅" = 3단계의 일부일 뿐** — 1~2단계 없이 검증 완료 아님
3. **홈 페이지 스크린샷 1장 = 검증 아님** — 영향받는 모든 페이지 각각 확인
4. **차트가 "보이면 OK" 아님** — 비율, 수치, 축 라벨까지 확인
5. **숫자가 "있으면 OK" 아님** — 0%, "—", null, NaN은 FAIL

---

## 4C. 레이아웃 오버플로우 검증 (v31.9 추가)

```
[ ] Market Breadth 배지(bb-badge)가 바 차트 영역을 침범하지 않는지 확인
[ ] 모든 고정폭 grid 셀에서 한국어 텍스트가 잘리거나 인접 셀 침범하지 않는지 확인
[ ] 섹터 히트맵 배지(tac-heat-badge)가 텍스트 넘침 없는지 확인
[ ] 홈 페이지 AAII 카드에 수치 텍스트(bear%/bull%/signal)가 표시되는지 확인
[ ] 768px 뷰포트에서 breadth-bar-row, score-bar-row 레이아웃 정상인지 확인
[ ] 480px 뷰포트에서 동일 항목 확인

P57 고정 repeat(N,1fr) 그리드 모바일 검증 (v42.6 추가):
[ ] repeat(N,1fr) (N≥5) 그리드가 모바일 375px에서 가로 overflow 없는지 확인
    자동 탐지: document.querySelectorAll('[style*="repeat("]').forEach(el => { if (el.scrollWidth > el.clientWidth + 2) console.warn('⚠ grid overflow:', el.id || el.className, el.scrollWidth); })
[ ] 6열 이상 고정 그리드는 repeat(auto-fit,minmax(Xpx,1fr))으로 변경 검토
[ ] 변경 시 데스크톱(1440px)에서 컬럼 수가 유지되는지 확인
```

**브라우저에서 확인:**
```javascript
// 고정폭 grid 셀 오버플로우 감지
document.querySelectorAll('.bb-badge, .tac-heat-badge, .bb-label').forEach(el => {
  if (el.scrollWidth > el.clientWidth)
    console.warn('⚠ 텍스트 오버플로우:', el.className, el.textContent,
      'scrollW:', el.scrollWidth, 'clientW:', el.clientWidth);
});
```

### 4D. 데이터 최신성 검증 (v31.9 추가)

```
[ ] 콘솔에서 "[Yahoo→FRED]" 로그 확인 → 브릿지가 실행되고 있는지
[ ] FRED 데이터 소스 라벨이 "실시간 (HH:MM)" 또는 "FRED YYYY-MM-DD"로 표시되는지
[ ] 10Y-2Y, 10Y-3M 스프레드가 실시간 계산값인지 ("—"가 아닌지)
[ ] CF Worker 설정 시 콘솔에 503/429 에러가 발생하지 않는지
```

**브라우저에서 확인:**
```javascript
// Yahoo→FRED 브릿지 상태 확인
console.log('window._live10Y:', window._live10Y);
console.log('window._live30Y:', window._live30Y);
console.log('window._liveVIXCLS:', window._liveVIXCLS);
// FRED 데이터 소스 확인
document.querySelectorAll('[data-fred]').forEach(el =>
  console.log(el.id, el.dataset.fred));
```

---

## 부록: 페이지별 핵심 검증 매트릭스

| 페이지 | 필수 확인 요소 | FAIL 조건 |
|--------|--------------|-----------|
| home | 시세카드 변화율, 2s10s 스프레드, HY 스프레드, 뉴스 | 변화율 0.00%, 스프레드 "—", 뉴스 빈칸 |
| kr-home | KOSPI/KOSDAQ 변화율, 원/달러 환율 | 변화율 0.00%, 환율 "—" |
| signal | 점수 게이지, 5개 서브 바, advice 카드, 시나리오 3개 | 게이지 "—", 바 0, advice 빈칸 |
| sentiment | AAII 막대차트, P/C 스파크라인, F&G 게이지 | 차트 빈 화면, 게이지 "—" |
| fxbond | koreaCurveChart, 스프레드 3개, DXY | 차트 빈 화면, 스프레드 "—" |
| macro | yieldCurveChart, 경제 온도, WTI-Brent | 차트 빈 화면, 온도 "—" |
| themes | RRG 캔버스, 섹터 ETF RS, YTD, 세분화테마 카드+심층분석 | RRG 비율 왜곡, RS 0%, YTD "—", 세분화테마 전종목 0%, 카드 클릭 무반응 |
| breadth | SMA 바 3개, 캔버스 차트 4개, McClellan | 바 0, 차트 빈 화면 |
| technical | 기술 지표, 지지/저항, Weinstein, 종합 판정 | 지표 "—", 수치 0, analyzeTickerDeep 에러 |
| kr-technical | KOSPI/KOSDAQ 자동 분석, 개별 종목 분석, 용어 해설 | 지수 분석 빈 화면, analyzeKrIndex/analyzeKrTickerDeep 에러 |
| options | VIX/VVIX 실시간 값, 데이터 고지 배너, 업데이트 시간 | VIX "26.78" 하드코딩 그대로, 배너 없음, 시간 "—" |
| portfolio | 포트폴리오 종목 카드, 손익 계산, 총 자산 | 첫 진입 시 빈 화면, 종목 "—" |

---

## 부록: 반복 실패 방지를 위한 특별 체크

이전 프로젝트에서 2회+ 반복된 버그 패턴 — 수정 시 반드시 교차확인:

| 패턴 | 확인법 |
|------|--------|
| 함수 존재하지만 호출 안 됨 | grep으로 호출 지점 확인 + 브라우저에서 breakpoint |
| init 가드 미리셋 | destroy 함수에서 flag=false 확인 |
| 캔버스 ID 불일치 | getElementById의 ID가 올바른 page-div 안에 있는지 |
| API 필드 가정 | Network 탭에서 실제 응답 확인 |
| window.* 캐시 미할당 | 콘솔에서 해당 변수 값 확인 |
| popstate 누락 | 뒤로가기로 해당 페이지 진입 테스트 |
| 수정이 한 경로만 (showPage만, popstate 누락) | 두 경로 모두 테스트 |
| 동적 DOM 삽입이 grid/flex 깨뜨림 | 삽입 대상 부모의 display 속성 확인 (grid/flex면 외부 컨테이너 사용) |
| 채팅 LLM 응답 가로 렌더링 (★) | **근본 원인**: chatAppendMsg의 id가 wrap에 설정되면 onDone이 wrap.innerHTML 덮어씀→bubble 소멸→flex:row 가로 배치. **검증**: 응답 완료 후 `.acp-msg.ai` 안에 `.acp-bubble` 존재하는지, 직접 자식 수가 5개 이하인지 반드시 DOM 검사 |
| 기술 분석 결과 DOM target 불일치 | analyzeKrTickerDeep가 #kr-ticker-analysis-result 에 렌더하는지 확인 |
| init 함수 내 cleanup 루프 2개 (P56) | Object.keys(pageCharts).forEach(destroy) 패턴이 동일 init 함수 내 2회 이상이면 — 두 번째가 방금 생성한 차트를 파괴 |
| applyDataSnapshot map→HTML 불일치 (P58) | map 키 추가/제거 시 HTML data-snap 속성 역방향 확인 필수. 방향: HTML→map(기존) + map→HTML(신규) |
| API 의존 전역 변수 undefined 상태 (P59) | fetch 콜백에서만 set되는 전역(예: _lastFG)은 applyDataSnapshot 후 DATA_SNAPSHOT 폴백으로 초기화 |
| 크로스페이지 공유 함수 단방향 연결 (P60) | 여러 페이지에서 같은 데이터 표시 시 — 각 페이지의 liveQuotes 리스너에 공통 업데이트 함수 연결 누락 |
| 고정 열 그리드 모바일 overflow (P57) | repeat(N,1fr) N≥6은 375px에서 overflow 위험. repeat(auto-fit,minmax(Xpx,1fr)) 교체 |
| CF Worker 프록시 rate limit | Yahoo Finance 차트 요청 시 429 에러 발생하지 않는지 확인 |
| 스크롤 영역 하단 잘림 | 모든 overflow-y:auto 컨테이너에 padding-bottom 16px+ 있는지 |
| 버전 4곳 불일치 | title, badge, version.json, 파일명 MD5 모두 동일한지 (RULES.md R1) |
| `.pct \|\| 0` 패턴 재도입 (P25) | `grep -n '\.pct ||' index.html` → Category C 외 신규 사용 없는지 확인. 반드시 `d.pct != null ? d.pct : 기본값` 사용 |
| div 균형 점검 오류 | `grep -c` 대신 `grep -o '<div' index.html \| wc -l` 사용. `grep -c`는 한 줄에 여러 div가 있으면 1로 카운트 |
| P24 `[data-live-price]` 신규 코드 | 벌크 업데이트 신규 작성 시 반드시 `el.children.length > 0` 체크 포함 여부 확인 |
| CSS overflow 미설정 | 스크롤 컨테이너에 overflow-x:hidden + overflow-y:auto + padding-bottom 3중 확인 |
| 고정폭 grid 컬럼에 한국어 텍스트 오버플로우 | 모든 고정폭 셀에 `overflow:hidden; text-overflow:ellipsis` 적용 + 한국어 최대 폭(글자수×14px) 확인 |
| 차트 의존 카드에 텍스트 폴백 없음 | 홈 AAII/P/C Ratio 등 미니 차트 카드에 차트 실패 시 수치 텍스트 표시 여부 확인 |
| Yahoo→FRED 브릿지 미작동 | 콘솔에서 `[Yahoo→FRED]` 로그 출력 확인, FRED 데이터 소스 라벨이 "실시간 (HH:MM)" 표시 확인 |
| 반응형 브레이크포인트 레이아웃 깨짐 | 768px/480px에서 breadth-bar-row, score-bar-row, 캘린더 grid 겹침/잘림 없는지 확인 |
| Dead Page (init/리스너 없음) | 모든 page-* div에 대해 (1) init 함수 존재 (2) pageShown 리스너 (3) liveQuotes 리스너 3종 확인 |

---

## 부록: v34.3 QA 점검 보고서 (2026-03-27)

> **점검 범위**: 15개 관점 기업 분석 프레임워크 + 기업 내부 비교 분석 시스템 + 해자 7유형 매핑 + FMP 데이터 파이프라인 + _CHAT_RULES 응답 품질 규칙
> **점검 방법**: index.html 전수 코드 리딩 (라인 19746~21810)
> **결과 요약**: 핵심 기능 정상 구현 확인, 경미한 개선 사항 3건 발견

### ✅ 통과 항목

```
[✅] 15개 관점 프롬프트 (라인 20377~20408) — 기업 개요~투자포인트 전부 구현, 각 관점에 ★데이터 태그 매핑
[✅] 해자 7유형 매핑 (라인 20387~20399) — 기술독점/네트워크/전환비용/브랜드/규모/무형자산/FCF전환, Wide/Narrow/None 판정 기준 + 해자 약화 경고 시그널 포함
[✅] FMP 18개 엔드포인트 정합 (라인 21435~21456) — fundamentalSearch()와 _fetchDeepCompareData() 동일 폭. profile/income/balance/cashflow/ratios/metrics/growth/executives/insider/institutional/estimates/priceTarget/revSegment/revGeo/peers/surprises/ev/dcf
[✅] 시스템 프롬프트 3중 주입 (라인 21804~21808) — tickerDataStr + sectorCompareStr + deepCompareStr 조건부 추가
[✅] _detectDeepCompareIntent (라인 21401~21422) — deepKw(~40개) AND compareKw(~15개) 교차 감지
[✅] _formatDeepComparePrompt (라인 21486~21742) — 16개 데이터 블록 + 15개 관점 비교 지침
[✅] _formatSectorComparePrompt (라인 21194~21311) — 섹터 평균 계산 + 4축 순위 + 교차검증 지침
[✅] _CHAT_RULES ⑤-3 (라인 19763) — 기업 내부 비교 분석 데이터 감지 시 15개 관점 + 이사회 수준 깊이 강제
[✅] 해자 추론용 투자 강도 지표 (라인 20203~20227) — R&D/매출, SG&A/매출, CAPEX/매출, FCF마진 3개년 + 해석 가이드
[✅] 응답 프레임워크 (라인 20410~20417) — 기계적 나열 금지, 스토리 연결, 실제 숫자 인용, 방향성 중시, 리서치 리포트 수준
[✅] 비교 응답 프레임워크 (라인 21734~21741) — 서사적 비교, 학습 데이터 금지, 3개년 추이 가속/감속, 핵심 차별점 심화
[✅] version.json v34.3 정합 — note 필드에 구현 내용 정확히 기술
```

### ⚠️ 발견된 문제 3건 → ✅ v34.4에서 전부 수정 완료

#### 문제 1: `_detectDeepCompareIntent` 비교 키워드 커버리지 부족 → ✅ v34.4 수정

- **증상**: "NVDA AVGO 장단점", "AAPL MSFT 우위", "TSLA RIVN 열위" 같은 자연어 표현에서 deepCompare가 트리거되지 않음
- **근본 원인**: `compareKw` 배열에 "장단점", "장점", "단점", "우위", "열위", "좋은 점", "나쁜 점", "강점", "약점" 같은 일상적 비교 표현이 누락됨
- **왜 문제인가**: 투자자가 "NVDA AVGO 장단점 비교해줘"라고 물으면 deepCompare 키워드 조건에 "장단점"이 없어 `hasCompare`가 false → 일반 채팅으로 처리됨 → 세그먼트/마진/R&D 등 심층 데이터 없이 학습 데이터만으로 답변 → 품질 저하
- **수정 내용**: compareKw에 25개 자연어 표현 추가 (장단점/장점/단점/강점/약점/우위/열위/좋은 점/나쁜 점/뭐가 좋/뭘 사/뭐가 낫/pros/cons/advantage/disadvantage/strength/weakness/better/worse/pick/choose/prefer/which)

#### 문제 2: `_extractTickers` 최대 3개 제한 — 사용자 미고지 → ✅ v34.4 수정

- **증상**: "NVDA AMD INTC AVGO QCOM 해자 비교해줘"라고 5개 티커를 보내면 앞 3개만 감지됨
- **근본 원인**: `_extractTickers()`에서 `return tickers.slice(0, 3)` — 최대 3개 하드코딩 제한
- **수정 내용**: (A) 기본 데이터 조회는 5개까지 확장 (`slice(0,5)`), (B) 심층 비교는 3개 유지하되 초과 시 `showToast()`로 안내 메시지 표시

#### 문제 3: QA-CHECKLIST 11F 항목 미갱신 → ✅ v34.4 수정

- **증상**: 11F 항목이 v34.2 기준(10개 엔드포인트, 9단계 지침)으로 기재
- **수정 내용**: v34.3/v34.4 기준으로 전면 갱신 + 11H 단일 기업 심층 분석 항목 신규 추가

### 📋 향후 검증 추가 권장 항목

```
[ ] "NVDA AVGO 장단점" → deepCompare 발동 여부 확인 (v34.4 수정 완료 — 실제 브라우저 검증 필요)
[ ] 4개 티커 입력 시 토스트 안내 메시지 표시 여부 확인 (v34.4 수정 완료 — 실제 브라우저 검증 필요)
[ ] "NVDA 해자 분석해줘" → 단일 심층 분석 발동 + 18개 FMP 데이터 주입 확인 (v34.4 신규)
[ ] "AAPL 종합 분석" → fundamentalSearch 미실행 상태에서도 심층 데이터 주입 확인 (v34.4 신규)
[ ] deepCompare 발동 시 FMP API 호출 시간 측정 (티커 3개 × 18개 = 54개 병렬 호출 → 6초 타임아웃 내 완료 여부)
[ ] deepCompare 프롬프트 토큰 크기 측정 (3개 티커 × 16개 블록 = 프롬프트 길이가 모델 컨텍스트 윈도우 초과하지 않는지)
[ ] singleDeep 프롬프트 토큰 크기 측정 (1개 티커 × 16개 블록 + 심층 지침 = 컨텍스트 윈도우 여유 확인)
```

---

## v34.7 종목 유니버스 감사 — 테마/서브테마 검증 항목

> **v34.7 배경**: STOCK-UNIVERSE-AUDIT.md 기반으로 SCREENER_DB, THEME_MAP, SUB_THEMES, SCR_KEYWORD_ALIASES, KNOWN_TICKERS를 전면 개편. 상장폐지/합병 종목 제거, 누락 종목/키워드 대폭 추가, 신규 서브테마 4개 신설.

### 12A. 상장폐지/합병 종목 완전 제거 확인

```
[ ] ELASTIC — 코드 전체에서 검색 시 활성 코드에 없음 (주석만 허용)
[ ] INFN — 코드 전체에서 검색 시 활성 코드에 없음 (Nokia 인수 → 상장폐지)
[ ] IIVI — 코드 전체에서 검색 시 활성 코드에 없음 (COHR 합병 완료)
[ ] SPCE — 코드 전체에서 검색 시 활성 코드에 없음 (Virgin Galactic 사실상 종료)
```

### 12B. 대체 종목 정상 반영 확인

```
[ ] ESTC가 THEME_MAP software '데이터/AI플랫폼'에 존재
[ ] ANET이 photonics '광섬유/네트워크'에 존재 (INFN 대체)
[ ] LUNR, RDW가 defense '우주/위성'에 존재 (SPCE 대체)
[ ] SCREENER_DB에 ESTC, ANET, LUNR, RDW 각각 존재
```

### 12C. 신규 SCREENER_DB 종목 검증

```
[ ] AA (Alcoa) — sym:'AA' 존재, sector/memo 합리적
[ ] BIIB (Biogen) — sym:'BIIB' 존재
[ ] CLSK (CleanSpark) — sym:'CLSK' 존재
[ ] ETSY — sym:'ETSY' 존재
[ ] LAC (Lithium Americas) — sym:'LAC' 존재
[ ] MASI (Masimo) — sym:'MASI' 존재
[ ] MP (MP Materials) — sym:'MP' 존재
[ ] RUN (Sunrun) — sym:'RUN' 존재
[ ] SEDG (SolarEdge) — sym:'SEDG' 존재
[ ] STAG (STAG Industrial) — sym:'STAG' 존재
[ ] IBIT (iShares Bitcoin Trust) — sym:'IBIT' 존재
[ ] BITO (ProShares Bitcoin Strategy) — sym:'BITO' 존재
[ ] QBTS (D-Wave Quantum) — sym:'QBTS' 존재
[ ] UMC (United Microelectronics) — sym:'UMC' 존재
```

### 12D. THEME_MAP 서브테마 확장 검증

```
[ ] 반도체 — '파운드리/성숙공정' 서브테마 존재 (INTC, GFS, TSM, UMC)
[ ] 반도체 — '아날로그/RF'에 NXPI, ON 추가됨
[ ] AI 인프라 — '양자컴퓨팅' 서브테마 존재 (IONQ, RGTI, QBTS)
[ ] 소프트웨어 — 데이터/AI플랫폼에 AI, TTD 추가됨
[ ] 방산 — 전통 방산에 PLTR, LDOS 추가됨
[ ] 임의소비재 — '플랫폼/딜리버리' 서브테마 존재 (UBER, DASH, CPNG)
[ ] 금융 — 결제/핀테크에 SOFI, AFRM 추가됨
[ ] 헬스케어 — '생명과학 장비' 서브테마 존재 (TMO, DHR, A, WAT)
[ ] 크립토 — 'BTC ETF' 서브테마 존재 (IBIT, BITO)
[ ] 로보틱스 — 'AI/휴머노이드' 서브테마 존재 (TSLA, FANUY), 산업자동화에 PATH 추가
```

### 12E. SUB_THEMES 신규 4개 검증

```
[ ] id:'foundry' — 파운드리/성숙공정 존재, leaders/tickers 배열 비어있지 않음
[ ] id:'btc_etf' — BTC ETF/보유 존재, compositeBase:'BTC-USD' 설정됨
[ ] id:'delivery' — 플랫폼/딜리버리 존재, leaders/tickers 배열 비어있지 않음
[ ] id:'glp1' — GLP-1/비만치료 존재, leaders/tickers 배열 비어있지 않음
[ ] 세분화 테마 그리드에서 17개 카드 표시 (기존 13 + 신규 4)
```

### 12G. 세분화 테마 인터랙션 검증 (v38.3 추가, P25)

```
[ ] 세분화 테마 카드에 cursor:pointer + onclick 존재
[ ] 데이터 미수신 종목은 "—" 표시 ("+0.0%" 아님) — d.pct||0 패턴 사용 금지
[ ] 카드 클릭 → #sub-theme-detail-panel 표시
[ ] 심층 분석 패널 내용: 헤더(이모지+이름+ETF+등락률), 설명, 전종목 테이블, 커버리지, 브레드스, 심층분석(온도진단/격차/비중/학습포인트)
[ ] ✕ 닫기 버튼 → 패널 숨김
[ ] aio:liveQuotes 시 패널 열려있으면 자동 갱신
[ ] showThemeDetail()의 서브테마 종목 표시도 "—" 처리 (동일 P25 규칙)
```

### 12F. SCR_KEYWORD_ALIASES 키워드 검증

```
[ ] '드론' → 검색 시 KTOS, AVAV, RKLB 반환
[ ] '로보틱스' → 검색 시 ISRG, ROK, ABB, PATH, FANUY 반환
[ ] '리튬' → 검색 시 LAC, ALB, SQM, LIT 반환
[ ] '메타버스' → 검색 시 META, RBLX, U 반환
[ ] 'autonomous' → 검색 시 TSLA, GOOGL, MBLY, APTV 반환
[ ] 'glp-1' → 검색 시 LLY, NVO, AMGN, VKTX 반환
[ ] '비만' → 검색 시 LLY, NVO, AMGN, VKTX 반환 (기존 LLY만 → 확장 확인)
[ ] 'sq' → 검색 시 XYZ 반환 (SQ→XYZ 리브랜딩 매핑)
```

### 12G. KNOWN_TICKERS 정합성

```
[ ] 신규 추가 종목 15개 모두 KNOWN_TICKERS에 존재: AA, BIIB, BITO, BOTZ, CLSK, ETSY, IBIT, LAC, MASI, MP, QBTS, RUN, SEDG, STAG, UMC
[ ] 제거 종목 2개 KNOWN_TICKERS에서 삭제됨: IIVI, SPCE
```

### 12H. 브라우저 실행 검증 (배포 후 필수)

```
[ ] 테마/트렌드 페이지 진입 → 모든 테마 카드 렌더링 (빈 카드 = FAIL)
[ ] 세분화 테마 그리드 → 17개 카드 모두 표시
[ ] 신규 서브테마 4개(파운드리, BTC ETF, 딜리버리, GLP-1) 카드 클릭 → 종목 리스트 표시
[ ] 스크리너 검색 "드론" → 결과 반환 (KTOS, AVAV, RKLB)
[ ] 스크리너 검색 "GLP-1" → 결과 반환 (LLY, NVO, AMGN, VKTX)
[ ] 스크리너 검색 "ELASTIC" → 결과 없음 (제거됨)
[ ] 스크리너 검색 "SPCE" → 결과 없음 (제거됨)
[ ] 스크리너에서 ESTC 검색 → 정상 표시 (Elastic → ESTC 리브랜딩)
[ ] PRIORITY_SYMS 추가 그룹(IBIT, BITO, UBER, DASH 등) 시세 60초 내 로딩 확인
[ ] 콘솔 에러 없음 (INFN/IIVI/SPCE/ELASTIC 관련 undefined 에러 = FAIL)
```

### 12I. PARA 모니터링

```
[ ] PARA SCREENER_DB memo에 "⚠️ 티커변경/상장폐지 가능" 경고 포함 확인
[ ] Skydance-Paramount 합병 완료 시 → PARA 엔트리 업데이트 또는 제거 필요 (향후 작업)
```

---

## v34.8 통합 부족 감사 — UX/접근성/데이터 일관성 검증 항목

> **v34.8 배경**: UNIFIED-DEFICIENCY-AUDIT-v34.6.md + FULL-DEFICIENCY-AUDIT.md 두 감사 보고서 통합 반영. alert()→showToast 전환, PXD 제거, 인쇄 스타일, 접근성, kr-supply 경고 배너 등.

### 13A. alert() 전면 제거 확인

```
[ ] 코드 전체 grep "alert(" → 0건 (모두 showToast로 전환됨)
[ ] API 키 저장 시 showToast('API 키가 저장되었습니다 ✓') 정상 표시
[ ] 포트폴리오 빈 입력 시 showToast 경고 정상 표시
[ ] 워치리스트 중복 종목 추가 시 showToast 정상 표시
[ ] PIN 설정 완료 시 showToast 정상 표시
```

### 13B. PXD 완전 제거 확인

```
[ ] KNOWN_TICKERS에서 PXD 제거됨 (ExxonMobil 인수 완료)
[ ] SCREENER_DB에 PXD 없음 (기존에도 없었음, 확인 차)
[ ] 검색 "PXD" → 결과 없음
```

### 13C. @media print 인쇄 스타일 확인

```
[ ] 브라우저 인쇄 미리보기 → 사이드바/네비게이션 숨김
[ ] 인쇄 시 배경 흰색, 텍스트 검정
[ ] 차트가 페이지 경계에서 잘리지 않음 (page-break-inside: avoid)
[ ] 버튼, 입력창, 채팅 패널 숨김 처리
```

### 13D. 접근성 (aria-label) 확인

```
[ ] 모든 canvas에 role="img" + aria-label 존재 (22개)
[ ] 스크리너 스파크라인 canvas에 aria-label="{티커} 스파크라인 차트" 확인
[ ] 스크린 리더로 차트 영역 접근 시 의미 있는 텍스트 읽힘
```

### 13E. signal AI 칩 확인

```
[ ] 시그널 페이지 진입 → AI 채팅 패널에 4개 추천 질문 칩 표시
[ ] 칩 클릭 → 해당 질문이 채팅에 자동 전송
```

### 13F. kr-supply 경고 배너 확인

```
[ ] 수급 분석 페이지 진입 → "정적 스냅샷" 경고 배너 표시
[ ] 배너 색상 오렌지, 텍스트 가독성 양호
```

### 13G. 통합 감사 잔여 항목 — v34.9에서 전부 완료

```
[x] E1/C1: TradingView 위젯 임베드 — v34.9 완료 (page-technical, page-fundamental, page-kr-technical)
[x] E3/H3: McClellan Oscillator 실제 계산 — v34.9 완료 (19/39 EMA 기반 calcMcClellan + updateMcClellanUI)
[x] E4/H1: 옵션 체인 그릭스 계산 — v34.9 완료 (Black-Scholes bsGreeks + updateGreeksPanel)
[x] E7/H4: 포트폴리오 SPY 벤치마크 비교 차트 — v34.9 완료 (updateBenchmarkChart canvas)
[x] E11/M1: 스크리너 결과 CSV 내보내기 — v34.9 완료 (exportScreenerCSV + UTF-8 BOM)
[x] E6/M2: 가격 알림 시스템 — v34.9 완료 (localStorage 기반 addPriceAlert/checkPriceAlerts)
[x] D1/H2: 한국 수급 API 연동 — v34.9 준비 완료 (경고 배너 업데이트, 엔드포인트 확보 시 즉시 연동 가능)
[x] D4: 경제 캘린더 동적화 — v34.9 완료 (getNextFOMC, getNextBOK 동적 계산)
[x] B2: 하드코딩 날짜 정리 — v34.9 완료 (DATA_SNAPSHOT 폴백값 문서화 + 경고 주석)
[x] B3: 이란 관련 참조 범용화 — v34.9 완료 (4개 섹션 주석 추가 + 소제목 범용화)
[x] G2: 색각 이상 배려 — v34.9 완료 (a11y-up/a11y-dn/a11y-hold CSS + applyA11yIndicators)
[x] M8: 에러 메시지 한국어화 — v34.9 확인 완료 (전수 조사 결과 이미 전체 한국어)
```

### 13H. v34.9 추가 구현 항목 (감사 보고서 외)

```
[x] 스크리너→차트분석 워크플로우 연결 (screenerToChart)
[x] 스크리너→기업분석 워크플로우 연결 (screenerToFundamental)
[x] 뉴스→종목 워크플로우 연결 (newsToStock)
[x] PWA manifest.json + sw.js 생성 + Service Worker 등록
[x] 다크/라이트 테마 전환 (toggleTheme + CSS 라이트 테마 + localStorage 저장)
```

---

## 2026-03-28 v35.7 감사 보고서 통합 검증

```
[x] DATA_SNAPSHOT: US 전면 3/27(금) 종가 반영 확인 (S&P/Dow/Nasdaq/VIX/WTI/DXY/BTC/글로벌)
[x] FALLBACK_QUOTES: 3/27 기준 350+개 항목, 중복 0개 확인
[x] kr-supply: KOSPI 외국인 -17,939억 / 기관 -472억 / 개인 +17,048억 — kr-home과 일치 확인
[x] kr-supply: KOSDAQ 외국인 -459억 / 기관 -423억 / 개인 +818억 — kr-home과 일치 확인
[x] PRIORITY_SYMS: 한국 125개 종목 (방산/조선/전력/반도체/바이오/원전/2차전지/ETF/코스닥) 확인
[x] PRIORITY_SYMS: S&P 500 Top 50 누락분 (GOOGL, JPM, V, JNJ 등 25종목) 추가 확인
[x] HTML 폴백값: VIX 31.05, S&P 6,369, BTC 66,310, TNX 4.44%, VKOSPI 28.5 확인
[x] Medium: MOVE 115.0, F&G 12 확인
[x] HY spread 날짜: 2026-03-27 확인
[x] 수급 섹션 날짜: data-date-ref="kr-last" 동적 바인딩 확인
[x] 11개 <script> 블록 전체 JS 문법 검증 통과
```

---

## 2026-03-28 한국 동적 데이터 모듈 검증

```
[x] fetchVkospiDynamic: VKOSPI API → kr-vkospi-val, kr-health-vkospi 동적 업데이트
[x] fetchKrTradingVolume: 거래대금 → kr-dash-kospi-volume, kr-dash-kosdaq-volume
[x] fetchKrForeignRanking: 외국인 TOP 테이블 동적 렌더링 (순매수/매도/보유비중)
[x] fetchKrWeeklySupply: 주간 5거래일 수급 트렌드 동적 구성
[x] _enrichMarketCap: 개별 종목 시가총액 → KR_STOCK_DB 반영
[x] REFRESH_SCHEDULE.krDynamic: 15분 주기 등록
[x] 초기 로드: initKoreaHome → fetchKrDynamicData 호출 연결
[x] HTML ID 12개 추가 완료
[x] 11개 <script> 블록 JS 문법 검증 통과
```

---

## 2026-03-28 CF Worker 부하 최적화 검증

```
[x] REFRESH_SCHEDULE.quotes: 180000 (3분) 확인
[x] REFRESH_SCHEDULE.krDynamic: 1800000 (30분) 확인
[x] PRIORITY_SYMS: 379개 unique, 중복 0개 (grep/python 검증)
[x] _PROXY_REGISTRY.getRotated(): 라운드로빈 메서드 추가, 문법 검증 통과
[x] fetchViaProxy: getRotated() 호출로 변경 확인
[x] fetchYFChart: orderedProxies 라운드로빈 적용 확인
[x] CF Worker Free Tier 대비 62% (61,543/100,000) — 4인 여유
[x] JS 문법 검증: _PROXY_REGISTRY, fetchViaProxy, PRIORITY_SYMS 통과
```

---

## 2026-03-28 정적 하드코딩 전면 동적화 검증

```
[x] KOSDAQ 수급: fetchKrSupplyData KOSDAQ investorTrend 추가
[x] updateKrSupplyDOM: KOSPI+KOSDAQ 동시 업데이트 + 동적 코멘트 생성
[x] kr-home 코스닥 수급: 6개 ID 부여 (foreign/inst/retail + bar)
[x] 수급 코멘트 7개 요소 동적 생성 (외국인 연속매매일수 자동계산)
[x] fetchKrShortSelling: 공매도 거래대금 동적화
[x] fetchKrBreadthData: ADL/20MA/52주고저 동적화
[x] fetchKrDynamicData: 4→6개 함수 통합 확인
[x] applyFredToUI: yc-2y, yc-2y-track, dxy-1m 동적 연결
[x] fetchPutCall: regime-pcr + DATA_SNAPSHOT.pcr 연결
[x] 29개 정적 ID 전부 JS 참조 2회 이상 확인 (0개 미연결)
[x] 6개 신규/수정 함수 Node.js syntax 통과
```

## 2026-03-28 kr-supply 공매도 서브섹션 동적화 보완

```
[x] kr-short-kospi-ratio: 하드코딩 "4.07%" → fetchKrShortSelling() 동적 + data-live-kr 추가
[x] kr-short-kosdaq-ratio: 하드코딩 "3.27%" → fetchKrShortSelling() 동적 + data-live-kr 추가
[x] kr-short-kospi-chg: 하드코딩 "▲ 0.83%p" → 동적 변화폭 or "KRX 전용 데이터" 안내
[x] kr-short-kosdaq-chg: 하드코딩 "▲ 1.40%p" → 동적 변화폭 or "KRX 전용 데이터" 안내
[x] kr-short-balance: 하드코딩 "14.2조" → 동적 or "N/A" + KRX API 연동 예정 안내
[x] kr-short-stock-table: 하드코딩 5개 종목 제거 → KRX 연동 예정 안내 1행으로 교체 + ID 부여
[x] kr-short-balance-sub: 52주 평균 하드코딩 제거 → 동적 서브라인 ID 부여
[x] fetchKrShortSelling(): Naver basic API contents 파싱 추가 (프록시 래핑 대응)
[x] JS 구문 검증 통과 (11개 script block 전체)
[ ] 브라우저 실제 확인: kr-supply-short 탭 열어서 5개 값 표시 확인 (KRX 미연동 시 N/A 정상 표시)
```

## 2026-03-28 전체 데이터 동적화 (v35.8) 검증

```
[x] MARKET_SNAPSHOT localStorage 캐시: applyLiveQuotes() 끝에 저장 로직 추가
[x] applyStaticFallbacks(): localStorage 48시간 이내 캐시 우선 로드
[x] _applyRiskMonitorFallbacks(): Risk Monitor 폴백 별도 함수 분리
[x] const tsEl 중복 선언 → var tsEl2 수정 (JS 구문 에러 해결)
[x] generateDynamicBriefing(): briefing-static-archive 전체 동적 생성
[x] 하드코딩 시장 브리핑 (이란-미국 충돌, FOMC 분석 등) 전면 제거 → 실시간 생성
[x] loadEarningsSurprises(): FMP API 동적 호출 (aio_fmp_key 사용)
[x] loadEarningsCalendar(): FMP API earning_calendar 90일 범위 동적 호출
[x] updateScreenerFromLiveData(): SCREENER_DB mcap 라이브 업데이트
[x] 포트폴리오 테이블 NVDA/XLC/XSD: data-live-price 속성 추가
[x] Fed Rate 4곳: data-snap="fed-rate" + FRED DFEDTARU 연결
[x] 11개 script block JS 구문 검증 통과
[ ] 브라우저 확인: 동적 브리핑 정상 생성 확인
[ ] 브라우저 확인: FMP API 키 입력 후 어닝 데이터 로드 확인
[ ] 브라우저 확인: 포트폴리오 테이블 가격 실시간 반영 확인
[ ] 브라우저 확인: localStorage 캐시 동작 확인 (새로고침 후 캐시 사용 여부)
```

## 2026-03-28 QA 재점검 — 정적 데이터 잔존 2차 감사

```
[x] HTML 정적 데이터 재조사: 23개 발견 → 전부 수정 (data-snap/ID 추가 또는 플레이스홀더 전환)
[x] JS 정적 데이터 재조사: 6개 발견 → 전부 수정 (_updated 동적화, 차트 라벨 롤링, 코멘트 동적)
[x] 날짜/시간 5개 발견 → 전부 수정 (센티멘트 게이지, AAII, PCE 이벤트)
[x] 중앙은행 금리 테이블: data-snap 속성 추가 (boj/boe/pboc/bok-rate)
[x] 한국 종목 시가총액: data-live-kr 속성 추가 (4종목)
[x] 시장 폭 지표: ID 추가 (bb-5sma/20sma/50sma, ndx-breadth-5d/20d/50d)
[x] AAII 설문 날짜: id="aaii-survey-date" 동적 연결
[x] 차트 X축 날짜: AAII/VIX/PCR/Breadth 4개 차트 → 롤링 날짜 계산
[x] 주간 수급 테이블: 하드코딩 5행 → 동적 로딩 플레이스홀더
[x] kr-supply-alert-banner: 하드코딩 코멘트 → "수급 데이터 로딩 중" 플레이스홀더
[x] kr-supply-analysis-text: 하드코딩 코멘트 → "수급 분석 데이터 로딩 중" 플레이스홀더
[x] 최종 JS 구문 검증: 11개 block 전체 통과

최종 동적 바인딩 현황:
  data-snap: 40개
  data-live-price: 230개
  data-live-kr: 9개
  data-date-ref: 26개
  DOM ID: 719개
  남은 정적: 교육/인용문/역사데이터 3건 (동적화 불필요)
```

---

## v36.1 LLM AI 채팅 시스템 실시간 동적화 검증

### 수정 범위
```
수정 함수: _CHAT_RULES (IIFE) → _getChatRules() (일반 함수)
수정 함수: _liveSnap() — 폴백값 3건 수정
참조 변경: 21개소 (_CHAT_RULES → _getChatRules())
영향 컨텍스트: home, signal, breadth, fundamental, macro, portfolio,
               kr, options, etf-explorer, kr-supply + 기타 전체
```

### 핵심 수정 사항

| # | 항목 | 이전 (문제) | 이후 (수정) | 상태 |
|---|------|------------|------------|------|
| 1 | `_CHAT_RULES` 날짜 | IIFE — 페이지 로드 시 1회 계산, 자정 지나도 갱신 안됨 | `_getChatRules()` 함수 — 매 채팅마다 `new Date()` 재계산 | ✅ |
| 2 | KST 시각 주입 | 없음 | `_timeStr` 추가 — "N시 M분" 형식으로 AI에 현재 시각 전달 | ✅ |
| 3 | F&G 폴백 | `18` (하드코딩) | `'데이터 없음'` — AI가 옛날 수치 인용 방지 | ✅ |
| 4 | 50MA 폴백 | `6656` (하드코딩) | `'데이터 없음'` | ✅ |
| 5 | 200MA 폴백 | `6593` (하드코딩) | `'데이터 없음'` | ✅ |
| 6 | 참조 갱신 | `_CHAT_RULES` (상수) 21곳 | `_getChatRules()` (함수 호출) 21곳 | ✅ |

### 검증 결과
```
JS 구문: 11개 <script> 블록 전체 new Function() 파싱 ✅ 에러 0건
_CHAT_RULES 잔존 참조: 0건 ✅ (grep 확인)
_getChatRules 참조: 22건 (1 정의 + 21 호출) ✅
하드코딩 연도 검토: 시스템 프롬프트 내 2020~2025년 참조는 모두 역사적 사례/교육용 → 수정 불필요
```

---

## v36.4 US SUB_THEMES ETF 가중비중 검증

### 수정 함수: `calcCompositePerf(tickers, weights)`, `getThemePerf`, `renderSubThemesGrid`, `showThemeDetail`

### 체크포인트 — weights 적용 확인
- [ ] 콘솔: `SUB_THEMES.filter(s=>s.weights).length` === 20 (ETF 보유 테마)
- [ ] 콘솔: `SUB_THEMES.filter(s=>!s.weights).length` === 25 (ETF 미보유 테마)
- [ ] `calcCompositePerf(['NVDA','AMD','AVGO'], {NVDA:25,AMD:10,AVGO:12})` — weights 기반 가중평균 반환
- [ ] `calcCompositePerf(['NVDA','AMD','AVGO'])` — √price 폴백 동작 (하위 호환)
- [ ] 테마·트렌드 페이지 → 서브테마 그리드 정상 렌더링
- [ ] ETF 보유 테마 카드 소스 표시: "ETF가중(N)" 형식
- [ ] ETF 미보유 테마 카드 소스 표시: "합산(N)" 형식
- [ ] 서브테마 상세 패널 → 서브테마 퍼포먼스 weights 반영
- [ ] 버전: APP_VERSION === 'v36.4', HTML badge === 'v36.4', version.json === 'v36.4'

---

## v36.5 LLM 웹검색 외부 내러티브·이벤트 집중 강화 검증

### 수정 함수: `_needsWebSearch`, `_buildSearchQuery`, `_formatSearchForPrompt`, `_perplexitySearch`, `_getChatRules`

### 체크포인트 — _needsWebSearch 내러티브 패턴 감지
```
- [ ] "사스포칼립스 뜻이 뭐야" → 웹검색 트리거 (내러티브 패턴)
- [ ] "GTC 2026 발표 요약" → 웹검색 트리거 (컨퍼런스 패턴)
- [ ] "버핏이 최근에 뭐 샀어" → 웹검색 트리거 (월가 인물 패턴)
- [ ] "숏스퀴즈 종목" → 웹검색 트리거 (밈주/변동성 패턴)
- [ ] "ARM everywhere 테마" → 웹검색 트리거 (내러티브 패턴)
- [ ] "Nvidia rally momentum" → 웹검색 트리거 (영문 고유명사+시장 맥락)
- [ ] 일반 교육 질문 "PER이 뭐야" → 웹검색 미트리거 (기존 동작 유지)
```

### 체크포인트 — _buildSearchQuery 프리픽스
```
- [ ] 내러티브 쿼리 → 검색어에 "시장 내러티브" 프리픽스 포함
- [ ] 월가 인물 쿼리 → 검색어에 "월가 투자 견해" 프리픽스 포함
- [ ] 일반 쿼리 → 프리픽스 없음 (기존 동작 유지)
```

### 체크포인트 — _formatSearchForPrompt 활용 원칙
```
- [ ] 검색 결과 포맷에 "📡 외부 내러티브 활용 원칙" 섹션 존재
- [ ] 4대 우선순위 (①내러티브 ②컨퍼런스 ③대가/기관 ④이벤트 드리븐) 포함
- [ ] "외부에서만 얻을 수 있는 정보" 강조 문구 포함
```

### 체크포인트 — Perplexity Sonar 시스템 프롬프트
```
- [ ] 시스템 프롬프트에 4대 우선순위 탐색 지시 포함
- [ ] "외부에서만 알 수 있는 최신 정보" 우선 추출 지시 포함
- [ ] 600자 이내 제한
```

### 체크포인트 — _getChatRules 규칙 19
```
- [ ] 규칙 19 "외부 내러티브 활용" 존재
- [ ] 웹검색 결과가 있을 때만 활성화되는 조건부 규칙
- [ ] 검색 정보 무시 시 F 등급 경고 포함
```

### 체크포인트 — 버전
```
- [ ] APP_VERSION === 'v36.5'
- [ ] HTML badge === 'v36.5'
- [ ] version.json === 'v36.5'
```

---

## v36.2 듀얼 엔진 AI 웹검색 연동 검증

### 추가 함수: `_needsWebSearch`, `_perplexitySearch`, `_googleSearch`, `_aiWebSearch`, `_formatSearchForPrompt`, `_searchCitationsHTML`

### 체크포인트 — Perplexity Sonar (1순위)
```
Perplexity API 키 UI (사이드바)       ✅
Perplexity 키 암호화 저장 + 복원      ✅ (_AIO_SENSITIVE_KEYS + _restoreDecryptedKeys 양쪽)
_perplexitySearch() API 호출 형식     ✅ (sonar, search_recency_filter: week)
검색 결과 시스템 프롬프트 주입         ✅ (AI 요약 직접 전달)
```

### 체크포인트 — Google Custom Search (2순위 폴백)
```
Google Search API 키 UI (사이드바)    ✅
Google Search Engine ID(cx) UI        ✅
Google 키 2개 암호화 저장 + 복원      ✅ (_AIO_SENSITIVE_KEYS + _restoreDecryptedKeys 양쪽)
_googleSearch() API 호출 형식         ✅ (num=5, lr=lang_ko, gl=kr)
스니펫 → Perplexity 동일 포맷 변환   ✅ ({ answer, citations, engine })
```

### 체크포인트 — 통합 시스템
```
_aiWebSearch() 우선순위 동작          ✅ (Perplexity → Google 폴백)
_needsWebSearch() 키 체크 로직        ✅ (Perplexity 키 or Google 키+cx)
자동 검색 판단 (교육 질문 제외)       ✅ (9개 패턴 + 50자+ 복합 질문)
chatSend 파이프라인 통합              ✅ (ticker/sector/deep 다음에 실행)
검색 실패 시 기존 답변 정상 진행       ✅ (try/catch)
_formatSearchForPrompt 엔진별 분기   ✅ (Perplexity vs Google 차별화)
응답 후 출처 링크 UI                  ✅ (_searchCitationsHTML)
모델 배지에 웹검색+엔진명 표시        ✅
JS 구문 검증                          ✅ 에러 0건
```

---

## 버전별 추가 점검 — v36.6 / v36.7 / v36.8

### v36.6 (프리/애프터마켓 + 선물 + VIX 구조 동적화)
```
includePrePost=true 설정 (CHART_PARAMS, fetchSparkData)  ✅
fetchYFChart에서 marketState/extPrice/extPct 추출         ✅
applyLiveQuotes에서 _extHoursData 저장                   ✅
data-ext-hours 배지 표시                                   ✅
PRIORITY_SYMS에 ES=F/NQ=F/YM=F/VXX/UVXY 추가            ✅
_SNAP_FALLBACK에 선물+VVIX+VXX+UVXY 추가                ✅
VIX term structure → VXX/UVXY 기반 동적화                 ✅
Risk Monitor VIX 구조 동적화 (rm-vixstr-*)                ✅
```

### v36.7 (세션 인식 + VVIX/VIX + _closeSnap)
```
_getUsSession() DST 자동판별                              ✅
_isFuturesOpen() 선물 운영 판별                           ✅
_getKrxSession() 존재 및 동작                             ✅
VVIX/VIX 비율 임계값 (<5/<6/<7/7+)                       ✅
window._vvixVixRatio 전역 저장                            ✅
_closeSnap() chartPreviousClose 기반                      ✅
_liveSnap() usSession/krSession/futuresOpen 포함          ✅
applyLiveQuotes chartPreviousClose 보존                   ✅
_getChatRules 규칙 19-B 분석 데이터 기준 원칙             ✅
LLM 시스템 프롬프트 이중 데이터 (실시간+종가)            ✅
```

### v36.8 (세션 인식 가격 표시 v2 — 괴리 해소 + 범위 제한)
```
지수: 항상 현물(종가) 표시, 선물 대체 제거                 ✅
지수: RTH 외 시 data-idx-futures에 선물 참고 표시          ✅
지수: RTH 중 시 data-idx-futures 숨김                      ✅
개별 종목 ext: ticker-hero-ext 전용 (기업분석 화면만)      ✅
개별 종목 ext: _currentTickerSym 일치 시에만 업데이트     ✅
개별 종목 ext: Pre/After 시 "종가→ext가격" 표시           ✅
개별 종목 ext: 정규장 중 display:none                      ✅
_liveSnap() 지수 항상 현물 (_idxPrice 제거)               ✅
_liveSnap() indexBasis = 정규장실시간/종가기준             ✅
_liveSnap() nasdaq/nasdaqPct/dow/dowPct 필드 추가         ✅
CHAT_CONTEXTS home/briefing/chart 3곳 지수+기준 레이블    ✅
APP_VERSION v36.8 + HTML 배지 + version.json              ✅
CHANGELOG v36.8 (v2 반영)                                  ✅
JS 구문 검증                                               ✅ 에러 0건
```

### v36.9 (분석 함수 전면 종가 전환)
```
_closingVal() 헬퍼 신규 (chartPreviousClose 우선)          ✅
computeTradingScore() 종가 입력 (VIX/DXY/HYG/SPX/유가)    ✅
computeMarketHealth() 종가 기반 VIX/SPY/QQQ                ✅
classifyMarketRegime() 종가 기반 SPX vs MA                  ✅
calcSectorBreadth() 종가 pct 명시                           ✅
kr-themes CHAT_CONTEXTS 종가 기준 대장주                    ✅
kr-macro CHAT_CONTEXTS KOSPI/KOSDAQ 종가                   ✅
APP_VERSION v36.9 + HTML 배지 + version.json              ✅
CHANGELOG v36.9                                            ✅
JS 구문 검증                                               ✅ 에러 0건
```

### v37.0 (테마/트렌드 전면 병합 — v35.8 개편 반영)
```
KR_STOCK_DB 047820 삼천당제약 추가 (143종목)               ✅
medtech_kr 전면 재구성 (삼천당/미래컴퍼니/리가켐/솔바이오)   ✅
telecom 삼성SDS 제거 (w:38/34/28 순수 통신3사)             ✅
retail 제일기획 제거 (w:24/22/20/18/16)                     ✅
logistics 롯데지주 제거 (w:32/28/22/18)                     ✅
steel_chem S-Oil 제거 (w:30/22/20/16/12)                   ✅
nuclear 두산에너빌리티 35→30% 보정                          ✅
US SUB_THEMES 45개 전테마 weights 부여 (21개 신규)          ✅
semi_equip CDNS/SNPS 추가 + 명칭 'EDA' 포함                ✅
nuclear_util OKLO 추가 (w:8%)                               ✅
defense PLTR 5→10%                                          ✅
PRIORITY_SYMS 047820.KQ 추가                                ✅
KOSDAQ 목록에 047820 추가                                    ✅
비중 산출 3대 기준 + 3대 금지 코드 주석                      ✅
medtech_kr HTML 카드 신규 종목 + 촉매 반영                   ✅
telecom HTML 카드 삼성SDS 제거                               ✅
steel_chem HTML 카드 S-Oil→한화솔루션 교체                   ✅
KR_THEME_CATALYSTS medtech_kr 갱신                           ✅
APP_VERSION v37.0 + HTML 배지 + version.json                ✅
CHANGELOG v37.0                                              ✅
JS 구문 검증                                                 ✅ 에러 0건
```

### v37.2 (LLM 답변 시스템 이원화 완전 적용)
```
_closeSnap() 시장환경 데이터 실시간 분리 (_liveFmt 추가)           ✅
_closeSnap() stockBasis/envBasis 필드 추가                         ✅
Home CHAT_CONTEXT 이원화 지시문 개편 (주가=종가, 시장환경=실시간)  ✅
Home CHAT_CONTEXT [종가]/[실시간] 태그 추가                        ✅
Technical CHAT_CONTEXT _closeSnap() 추가 + 종가 블록 + 이원화 지시 ✅
Macro CHAT_CONTEXT _closeSnap() 추가 + 종가 블록 + 이원화 지시     ✅
kr-tech CHAT_CONTEXT 한국 대장주 실시간→_closingVal(종가) 전환     ✅
kr-tech CHAT_CONTEXT KOSPI/KOSDAQ 종가 기준 전환                   ✅
kr-supply CHAT_CONTEXT KOSPI _closingVal(종가) 전환                ✅
이원화 매트릭스 주석 v37.2 확장 (CHAT_CONTEXTS 전체 매핑)          ✅
JS 구문 검증                                                       ✅ 에러 0건 (11개 블록)
CHANGELOG v37.2                                                    ✅

── 기존 정상 동작 확인 (변경 없음) ──
kr-themes CHAT_CONTEXT: 이미 _closingVal() 사용                    ✅ 변경 불필요
kr-macro CHAT_CONTEXT: 이미 _closingVal() 사용                     ✅ 변경 불필요
signal CHAT_CONTEXT: _liveSnap() only (실시간 전용 페이지)          ✅ 변경 불필요
fxbond CHAT_CONTEXT: 실시간 only (환율/채권 페이지)                 ✅ 변경 불필요
```

### v37.1 (분석 데이터 소스 이원화 — 주가=종가, 시장환경=실시간)
```
_closingVal() 데이터 소스 매트릭스 주석 추가                   ✅
computeTradingScore() VIX/VVIX/DXY/TNX/HYG/유가 → _ldSafe    ✅
computeTradingScore() SPX/SPY/RSP → _closingVal 유지           ✅
computeMarketHealth() VIX → _ldSafe, SPY/QQQ → _closingVal    ✅
classifyMarketRegime() VIX → _ldSafe, SPX → _closingVal       ✅
데이터 소스 이원화 원칙 주석 (3함수 모두)                       ✅
APP_VERSION v37.1 + HTML 배지 + version.json                   ✅
CHANGELOG v37.1                                                 ✅
JS 구문 검증                                                    ✅ 에러 0건

── 브라우저 QA 점검 (2026-03-29) ──
computeMarketHealth() qqq 미정의 변수 버그 → ld['QQQ'] 수정    ✅ 핫픽스
computeTradingScore() 실행 정상 (total:5)                       ✅
classifyMarketRegime() 실행 정상 (DOWNTREND)                    ✅
_closingVal SPY/SPX/RSP/QQQ 정상 반환                          ✅
_ldSafe VIX/DXY/TNX/HYG/OIL/VVIX 정상 반환                    ✅
KR_STOCK_DB 143종목, 삼천당제약 047820 확인                     ✅
KR_THEME_MAP medtech_kr 전면 재구성 확인                        ✅
KR_THEME_MAP telecom/retail/logistics/steel_chem 종목 제거 확인 ✅
nuclear 두산에너빌리티 w=30 확인                                ✅
SUB_THEMES 45개 전테마 weights 보유 확인                        ✅
semi_equip CDNS/SNPS, nuclear_util OKLO, defense PLTR=10%      ✅
US 테마 히트맵 + 섹터 분석 정상 렌더링                          ✅
KR 테마 카드 medtech_kr 신규 종목/촉매 정상 표시                ✅
18개 페이지 순회 — showPage() 에러 0건                         ✅
콘솔 에러 0건 (리프레시 포함)                                   ✅
JS 구문 재검증 (핫픽스 후)                                      ✅ 에러 0건

── v37.5 전수점검 (2026-03-30) ──
CHAT_CONTEXTS 이원화 전면 적용 (12개 기본 컨텍스트)              ✅
  signal: _closeSnap() + 종가/실시간 지시문                      ✅
  breadth: _closeSnap() + 종가/실시간 지시문                     ✅
  sentiment: _closeSnap() + 종가/실시간 지시문 + 지정학블록       ✅
  briefing: _closeSnap() + 종가/실시간 지시문 + 지정학블록        ✅
  technical(기본): _closeSnap() + 종가/실시간 지시문              ✅
  macro(기본): _closeSnap() + 종가/실시간 지시문                  ✅
  fundamental: _closeSnap() + 종가/실시간 지시문                  ✅
  themes: _closeSnap() + [실시간] 태그                            ✅
  guide: _closeSnap() + 종가/실시간 지시문                        ✅
  screener: _closeSnap() + 종가/실시간 지시문                     ✅
  options: _closeSnap() + 종가/실시간 지시문                      ✅
  portfolio: _closeSnap() + 종가/실시간 지시문 + 지정학블록       ✅
  fxbond: _closeSnap() + 종가/실시간 지시문                       ✅
briefing 구버전 newsCache.slice(0,5) 이중 주입 제거              ✅
관세/무역전쟁 키워드 보강 (MACRO_KW ~28개, TOPIC_KEYWORDS 동기화) ✅
지정학 컨텍스트 블록 확산 (briefing/sentiment/portfolio)          ✅
_closeSnap() 전수 카운트: 18회 (1정의+17호출)                    ✅
JS 구문 검증 11개 script block                                    ✅ 에러 0건
version.json v37.5                                                ✅
CHANGELOG.md v37.5 항목 추가                                      ✅

── v37.6 키워드 대폭 확장 (2026-03-30) ──
TECH_KW 확장 (~255→~340+): CPO/유리기판/BSPDN/에이전틱AI/800V 등 ✅
MED_KW 확장: 골든돔/드론방어/레이저무기/GLP-1/바이오시밀러 등     ✅
TOPIC_KEYWORDS semi: CPO/유리기판/에이전틱AI/액침냉각/NVLink 등    ✅
TOPIC_KEYWORDS defense: 골든돔/미사일방어/드론방어/Anduril 등      ✅
TOPIC_KEYWORDS energy: DC전력/800V/전고체배터리/액침냉각 등        ✅
한국어 키워드 동기화: 광패키징/에이전틱AI/소버린AI/골든돔 등       ✅
JS 구문 검증 11개 script block                                    ✅ 에러 0건

── v37.7 시장 키워드 2차 확장 (2026-03-30) ──
TECH_KW 2차 확장 (~340→~430+): 양자컴퓨팅/우주경제/사이버보안/원전/AI인프라SW ✅
MED_KW 2차 확장: GLP-1 세부/바이오심화/ESS/조선/우주/사이버보안 기업        ✅
MACRO_KW 확장: AI CapEx/power demand/nuclear renaissance/CHIPS Act 등       ✅
TOPIC_KEYWORDS 신규 토픽 4종: healthcare/shipbuilding/space/quantum          ✅
_CTX_TOPIC_MAP 신규 4개 토픽 매핑                                            ✅
한국어 키워드 동기화: 양자컴퓨팅/큐비트/우주경제/스타링크/제로트러스트 등    ✅
JS 구문 검증 11개 script block                                              ✅ 에러 0건

── v37.8 전 페이지 동적 분석 텍스트 (2026-03-30) ──
kr-macro: _generateKrMacroAnalysis — KRW/USD·10Y·VIX 복합 리스크 진단       ✅
kr-themes: _generateKrThemesAnalysis — Top3/Bottom3·테마브레스·리스크온오프   ✅
portfolio: _generatePortfolioAnalysis — 과집중 경고·일간/누적 P&L 해석       ✅
screener: _generateScreenerAnalysis — BUY/SELL 비율·평균 RSI 판단            ✅
sentiment: _generateSentimentAnalysis — F&G+VIX+P/C 복합 판단                ✅
options: _generateOptionsAnalysis — VIX 전략·IV Rank·VVIX/VIX·추천전략       ✅
fundamental: _generateFundamentalAnalysis — P/E 분포·Top ROE·등락종목        ✅
HTML 컨테이너 7개 페이지 삽입 확인                                           ✅
기존 init/render 함수에 호출 연결 7건                                        ✅
JS 구문 검증 11개 script block                                              ✅ 에러 0건
R1 5곳 버전 싱크 (title/badge/version.json/CLAUDE.md/CHANGELOG)             ✅

── v37.9 국내 테마 UI/UX 전면 개편 (2026-03-30) ──
CSS: kr-ticker-pill 그리드 레이아웃 전환 (종목명·가격·등락%)              ✅
HTML: 112개 pill 구조 일괄 변환 (pill-pct→pill-wt + pill-pct 분리)        ✅
JS: initKoreaThemes pill 렌더링 개선 (2자리 등락%, 원 제거)               ✅
JS: showKrThemeDetail 대폭 강화 (요약카드4·강도판단·메달·AI버튼4)         ✅
JS 구문 검증 11개 script block                                            ✅ 에러 0건
R1 5곳 버전 싱크 (title/badge/version.json/CLAUDE.md/CHANGELOG)           ✅
── v37.9 핫픽스 (2026-03-30) ──
BUG: .page.active contain-intrinsic-size 제한 → 스크롤 불가 수정           ✅
v34.9 정적 스냅샷 노란 경고 제거 (kr-supply)                               ✅
kr-supply 수급분석 동적 텍스트 강화 (주체별·연속성·시그널·경고)             ✅
JS 구문 검증 11개 script block                                            ✅ 에러 0건

── v38.0 미국+한국 테마 심층 분석 엔진 (2026-03-30) ──
미국: _buildThemeDeepAnalysis 함수 추가 (온도·격차·건강도·서브테마·ETF비교) ✅
한국: _buildKrThemeDeepAnalysis 함수 추가 (온도·편차·건강도·대장주·비중)   ✅
showThemeDetail 내 심층 분석 호출 연결                                     ✅
showKrThemeDetail 내 심층 분석 호출 연결                                   ✅
JS 구문 검증 11개 script block                                            ✅ 에러 0건
R1 5곳 버전 싱크 v38.0                                                    ✅

── v38.0 핫픽스: 스크롤+인사이트 레이아웃 수정 (2026-03-30) ──
BUG: .content overflow-x:hidden 추가 (수평 오버플로우 차단)                 ✅
BUG: .page/.page.active overflow-x:hidden 추가 (페이지 단위 방어)          ✅
BUG: .insight-box max-width:100% + overflow-wrap 추가 (부모 넘침 방지)     ✅
BUG: .insight-box.box-collapsed max-width:100% + box-sizing 추가           ✅
BUG: .page.active contain-intrinsic-size: none 확인 (이전 핫픽스 유지)     ✅
JS 구문 검증 11개 script block                                            ✅ 에러 0건

── v38.1 전수점검 보고서 기반 전면 수정 (2026-03-30) ──
C1: APP_VERSION const v37.2→v38.1 (런타임 덮어쓰기 수정)                   ✅
C2: KR_STOCK_DB themes 3건 (삼성SDS/LG전자/S-Oil)                         ✅
C3: fetchYFChart _pct falsy 버그 (_pct==null 으로 수정)                    ✅
H1: KR_THEME_CATALYSTS telecom 삼성SDS→LG유플러스                         ✅
H3: MACRO_KW 해운항로 한국어 키워드 추가                                   ✅
SCROLL: .main/.content min-height:0 추가 (flex column 근본 수정)           ✅
SCROLL: insight-box max-width:100% + overflow-wrap                         ✅
SCROLL: .content/.page/.page.active overflow-x:hidden 3중 방어             ✅
MEM: fetchSparkData .catch() 추가                                          ✅
MEM: 차트 mouseleave 중복 리스너 removeEventListener 방지                  ✅
MEM: visibilitychange _dataStatusInterval 클린업/재시작                     ✅
JS 구문 검증 11개 script block                                            ✅ 에러 0건
R1 5곳 버전 싱크 v38.1 (title/badge/APP_VERSION/version.json/CLAUDE.md)    ✅

── v42.3/v42.4 감사 리포트 11건 반영: Dead DOM + 레이아웃 + 브레드쓰 데이터 (2026-04-06) ──
BUG: .bb-label font-size 11px→8px + min-width 제거 (breadth 바 레이블 오버플로우)         ✅
BUG: Pattern Scanner 제거 (Signal/Momentum Dead 컬럼 — JS 업데이트 함수 없음)             ✅
BUG: Portfolio 카드 텍스트 겹침 → flex:1;min-width:0 수정                                 ✅
BUG: fxbond initYieldCurveChart() 잘못된 페이지 호출 제거                                 ✅
BUG: breadth-bar querySelector('div') null → el.style.width 직접 적용 (A-2)             ✅
BUG: applyDataSnapshot map 4개 키 누락 — retail-sales/wage-growth/cons-conf/housing (A-3) ✅
BUG: signal 브레드쓰 바 6개 행 Dead Static HTML → ID 부여 + updateBreadthBars() 신설 (A-1) ✅
BUG: destroyPageCharts themes 케이스 누락 → RRG clearRect 추가 (D-3)                     ✅
UX: risk-monitor-grid + portfolio summary 4열 → auto-fill minmax 반응형 (B-3)            ✅
DATA: bpLabels/bhLabels 2/20~3/19 → 3/6~4/2 갱신 (6주 괴리 수정, R21) (C-2)            ✅
RULE: getDataAge() days>3 → days>1 (R21 2일 이상 stale 배지) (A-4)                     ✅
SKILL: /qa TIER 13 추가 — Dead Static HTML / applyDataSnapshot 매핑 전수 확인           ✅

── v41.8 감사 리포트 3건 반영: 종목 품질 + 테마 가중치 + CSS 정렬 (2026-04-05) ──
BUG: streaming weights PARA->PSKY 키 수정                                  ✅
BUG: .kr-ticker-pill grid 1fr auto auto auto + ::before bar               ✅
종목: SSNLF 제거 (memory/foundry) + 비중 재분배 합계 100%                    ✅
종목: LCID 제거 (ev_auto) + 5개 quick-access 배열에서도 제거                  ✅
종목: STEM 제거 + FLNC 추가 (hydrogen_ess) 합계 100%                        ✅
종목: U 제거 (gaming) 합계 100%                                             ✅
종목: BTBT/HUT/APLD 제거 (neocloud) 합계 100%                              ✅
종목: PLUG/FCEL 비중 축소, BE 확대 (hydrogen_ess) 합계 100%                  ✅
종목: SEDG w:16->8, ENPH/FSLR 확대 (solar_renew) 합계 100%                 ✅
종목: photonics_kr 12->4종목 합계 100%                                      ✅
종목: crypto 카카오 w:30->15, 위메이드 w:25->35 합계 100%                    ✅
종목: KR_STOCK_DB theme 배열 6건 수정                                       ✅
로직: SPY ATH localStorage 동적 추적                                        ✅
로직: calcCompositePerf mcap 폴백                                           ✅
전체 바/그래프 정렬 전수 확인 (5패턴: pill/KR perf/US sector/sub-themes/score) ✅

── v45.5: 사용자 인터랙션 결과 검증 (2026-04-09) ──
P65: UI 토글/탭/모드 변수가 렌더 함수 내부에서 실제 분기 사용되는지 grep — `setSectorPerfMode` 같은 dead toggle 검출
P66: 데이터 미수신 상태에서 "로딩" 텍스트 영구 정체 금지 — 폴백 사용 또는 "대기/—"로 명시
P67: 동급 컴포넌트(pulse-seg/카드)는 동일 자식 구조 — 한 segment만 자식 누락 시 시각 정렬 깨짐

── v46.8: 함수 로직/기준/보안 전수 점검 (2026-04-14) ──
P83: signal 페이지 재진입 시 refreshSignal 타이머 복구 — initSignalDashboard에서 _refreshSignalInterval 재등록 확인
P86: classifyTopic 반환 토픽과 _macroT 배열 정합 — TOPIC_KEYWORDS 실존 키만 포함 확인
P88: window._putCallRatio 설정 여부 — fetchPutCall()에서 할당 확인 (computeTradingScore/ExecutionWindow 참조)
P89: updateEntryChecklist 이벤트 날짜 — 과거 경과 날짜 잔존 여부 확인 (현재일 기준)
P90: _calcEMA 루프 인덱스 — prices[period+i] 범위 초과 없는지 확인
P91: updateBottomProcess Dead Zone — b5=null 시 모든 stage 조건 false→stage=0 오판 방지
P95: Stooq CSV 파싱 인덱스 — cols[6]=Close, cols[3]=Open (cols[7]=Volume 아님)
P96: DATA_APIS key() — PIN 설정 후 safeLSGetSync 경유 확인 (암호화 문자열 API 전달 방지)
P97: SCREENER_DB 섹터명 ↔ SECTOR_COLORS/분석함수 섹터명 정합 — 'Financials' vs 'Financial Services', 'Consumer' vs 'Consumer Defensive'
P100: innerHTML 삽입부 escHtml 전수 — p.ticker, p.memo, t.sym, t.note, g.term, g.def (XSS)
P101: _calcRSILast Wilder SMMA 여부 — 단순평균 아닌 Wilder smoothed 구현 확인
P102: generateMacroStoryline 금리 심볼 — ^FVX(5년물)를 "2년물"로 표기하지 않는지 확인
P103: _generatePortfolioAnalysis 베타 수식 — pfBeta/totalW 정상 가중평균 (noop 아닌지)
P104: isCompanyNews companyTopics ↔ TOPIC_KEYWORDS 전체 토픽 커버 — 누락 토픽 없는지
P105: _generateAIBriefing 이벤트 날짜 — 현재일 기준 과거 이벤트가 "향후"로 주입되지 않는지

── v46.8: 라벨/기준 통일성 검증 ──
VIX 라벨 5단계(안정/주의/경계/공포/극단공포): 15/20/25/30 경계 — 모든 함수에서 동일한지 grep 확인
F&G 라벨: <= 연산자 통일 (25/45/55/75) — < vs <= 혼용 없는지
VKOSPI 라벨: 15/25/35 기준 4단계(안정/경계/공포/극단공포) — 모든 함수에서 동일
```

── v48.62: UX 실전성 — 결론 바·배지·폰트 (2026-04-22) ──
P106: 4개 우선 페이지(home/signal/sentiment/macro) 상단에 `.page-conclusion-bar` 존재 여부 — `id="home-conclusion-bar"` 등 grep 확인
P107: `_updateAllConclusionBars()` 호출 경로 — `updateMarketPulse()` 내 마지막 줄 및 `aio:liveQuotes` 이벤트 후 트리거 확인
P108: `fb-estimated` 배지 색상 — amber(`rgba(255,163,26,...)`) 정상 렌더링 여부
P109: 결론 바 "업데이트" 열 — 데이터 로드 후 "—" 에서 상대시간(예: "3분 전")으로 갱신되는지 확인
P110: 새 페이지 추가 시 R49 준수 — 결론 바 div 삽입 여부 grep(`id=".*-conclusion-bar"`) 확인

── v48.69: 보안·타이머·데이터 무결성 검증 (2026-04-28) ──
P140/R34: CDN SRI integrity 속성 존재 여부 — `grep -c 'integrity=' index.html` ≥ 3, 각 줄에 crossorigin="anonymous" 동반 확인
P141/R9: setInterval ID 전역 저장 여부 — `grep -n 'setInterval(' js/aio-core.js | grep -v 'window\._.*Timer'` → 0건 (결과 있으면 ID 미저장 타이머)
P142/R15: aio-data.js extPct/F&G `|| 0` 재발 검사 — `grep -n '|| 0' js/aio-data.js | grep -i 'pct\|fg\|score'` → 0건
P143: _lastFetch 키 정합 — `grep -n '_lastFetch\.' js/aio-core.js` 결과에서 저장 키('quote')와 조회 키('quote'||'liveQuotes') 대칭 확인

--- v50.78 contract-recovery checks (2026-06-18) ---
P510-Q1: After page redesign, run `node scripts/ci-version-check.mjs` and verify all five static JS cachebusters match `APP_VERSION`.
P510-Q2: Search AI prompt/tool text for callable names such as `_aioCreateVisualReport`; each referenced callable must exist on `window` in the loaded runtime.
P510-Q3: Any generated `public-data/*digest*.json` artifact must have one of: runtime loader + audit, documented manual-only status, or explicit retirement.
P510-Q4: Imported/user research used in AI context must carry `sourceKind=REFERENCE` and must not be promoted as LIVE market evidence.
P510-Q5: Visual/report generation must be backed by current page decision data and include as-of/source/confidence labels.

--- v50.79 runtime/share readiness checks (2026-06-18) ---
P511-Q1: Run `node scripts/ci-runtime-contract-check.mjs` after any AI prompt, digest, visual report, cachebuster, or external-sharing change.
P511-Q2: In browser, `AIO.getRuntimeContractAudit().status` must not be `fail`.
P511-Q3: In browser, `AIO.getShareReadinessAudit({ skipEssence: true }).shareable` must be boolean and blockers must be empty before public sharing.
P511-Q4: Every generated digest/artifact must be consumed by page/AI/audit/CI or explicitly retired.
P511-Q5: Removing UI must include a grep for prompt/test references to the removed runtime functions.

--- v50.88 trading logic contract checks (2026-06-19) ---
P512-Q1: Run `node scripts/ci-runtime-contract-check.mjs`; it must verify `computeTradingScore()` returns both `total` and `score`.
P512-Q2: `classifyMarketRegime()` must not use optimistic fallback breadth 75; unavailable breadth should fall back to live/snapshot/neutral only.
P512-Q3: `getScoreAdvice()` must not label 75+ as “적극 매수”; use market-environment wording such as `매수 우호` and pair it with risk controls.
P512-Q4: `analyzeTickerDeep()` must gate entry verdicts with `computeTradingScore('swing')`, so strong single-stock charts do not override weak market conditions.
P512-Q5: `AIO_EVENT_RISK_CONTEXT.asOf` must reflect the current market event window before sell-pressure/blowoff logic is trusted.

--- v50.89 semantic review contract checks (2026-06-19) ---
P513-Q1: Run `node scripts/ci-semantic-review-check.mjs`; it must inventory audit/readiness tests and verify R219/P513 hooks.
P513-Q2: For every new audit/readiness/coverage assertion, add a semantic companion check or record the unresolved semantic backlog.
P513-Q3: For trading, market, technical, ticker, portfolio, AI chat, data/source, or page redesign work, document function -> consumer -> visible output.
P513-Q4: For AI chat work, verify prompt intent -> data/source block -> answer policy -> user-visible answer, not only callable existence.
P513-Q5: For data/source work, verify collect/source -> loader -> normalized model -> page/chat consumer -> source/stale label.
P513-Q6: For page UX work, inspect the first-screen hierarchy and at least one real beginner/intermediate/advanced user scenario for each touched route.

--- v50.89 workflow compaction checks (2026-06-19) ---
P514-Q1: Run `node scripts/ci-workflow-compaction-check.mjs` after workflow, helper-file, skill, QA, rule, or postmortem changes.
P514-Q2: Before adding a new workflow rule or skill section, identify whether an old rule/section should be removed, merged, compressed, or split into a reference.
P514-Q3: Treat any `SKILL.md` over 300 lines or 15KB as a compaction candidate; move details into `references/` or scripts instead of appending.
P514-Q4: Treat `_context/BUG-POSTMORTEM.md`, `_context/RULES.md`, and `_context/QA-CHECKLIST.md` as archives plus active gates; do not require full-file rereads for ordinary tasks.
P514-Q5: Keep `CLAUDE.md` as a routing guide to current contracts, not a duplicate of every historical lesson.

--- v52.23 live/browser surface checks (2026-07-06) ---
P633-Q1: After live/browser QA, verify at least one desktop and one 390px mobile viewport for every route called out by the audit, plus any route that timed out or was previously unverified.
P633-Q2: News surfaces (`home`, `briefing`, `market-news`) must not visibly render `[번역 대기]`, `undefined`, `null`, `NaN`, or `[object Object]`.
P633-Q3: User-facing source badges must use localized labels (`스냅샷`, `참고`, `실시간`, `지연`) and must not expose raw `SNAPSHOT · reference` style enum text.
P633-Q4: Mobile checks must distinguish intentional internal table scrolling from actual viewport overflow, then verify component-specific fixes for `sentiment`, `fxbond`, `portfolio`, `ticker`, and `screener`.
P633-Q5: Deprecated/reduced routes that remain reachable, such as `options`, must still render a meaningful reference-only page rather than a thin placeholder.
P633-Q6: Run `node scripts/ci-runtime-contract-check.mjs`, `node scripts/ci-ux-default-path-check.mjs`, and a real-browser route matrix before claiming live/browser QA coverage.
P633-Q7: When a browser matrix finds nameless visible controls, add explicit labels/`aria-label`s even if a nearby visual label exists, then rerun the same desktop/mobile matrix to green.

--- v52.24 crash-day live-audit checks: verdict honesty, KR baseline, translation cascade (2026-07-07) ---
P634-Q1 (R282): For any interpretive/regime verdict function (not a bare number), verify each input's live-vs-fallback status is checked before an assertive branch renders — including the "everything is normal" branch, not just the alarming ones.
P634-Q2: Cross-check any live-vs-fallback comparison (e.g., live VIX vs seeded VIX9D) by fetching the real external values (Yahoo/Naver) for the same moment and confirming the app's directional verdict matches reality, not just that it renders without error.
P635-Q1: Fallback/snapshot-sourced display text carrying an interpretive label ("정상"/"공포"/"위험") must visually self-disclose as non-live (e.g., "폴백·" prefix), not only via a separate nearby badge.
P636-Q1: For any KR index/ticker previous-close or change%, verify the value against Naver's `compareToPreviousClosePrice`-derived previous close directly (`curl m.stock.naver.com/api/index/{KOSPI|KOSDAQ}/basic`), especially in any week adjacent to a US market holiday — Yahoo's `chartPreviousClose`/`regularMarketPreviousClose` for `^KS11`/`^KQ11` is known to return a one-session-stale value across that boundary.
P636-Q2: When fetching Yahoo Finance externally for verification, use `range=7d` (or wider) and diff the last two daily closes yourself — never trust `range=2d`'s `chartPreviousClose` field across a holiday-adjacent week; it can silently return the wrong reference session.
P637-Q1: When a Claude-relay-dependent feature (translation/AI briefing/ticker-AI) fails, verify the failure degrades to the next real fallback in the chain (e.g., `freeTranslateNews`/Google Translate) rather than a generic non-specific template — check that the *specific* headline content differs per item, not just that some Korean text renders.
P638-Q1: Before treating a `POST .../anthropic` 405 as a new bug, check `_context/DEFERRED-BLOCKS.md` for B5 (Cloudflare Worker server-key deploy) first — this is a known, already-triaged operator-action item, not a code defect; re-verify by reading `cloudflare-worker-proxy.js`'s actual routing order rather than assuming the repo file itself is wrong.

--- v52.25 post-redeploy verification + label/copy drift checks (2026-07-07) ---
P638-Q2: After an operator redeploys the Cloudflare Worker, verify with actual `curl -X POST .../anthropic` calls (not just GET/browser visits to the bare URL — those hit a different, unrelated code branch and can show a misleading 400 "url parameter required"). Also re-test 5-10x spaced a few seconds apart before declaring it fully healthy — a freshly-added `ANTHROPIC_API_KEY` can show intermittent 403s from Anthropic's own rate/concurrency tier that look like a redeploy failure but aren't.
P639-Q1: When two visible scores/labels on the same page or same screen region could plausibly be read as measuring "the market" or "the market's condition," verify their exact underlying function/data source before assuming a conflict is a bug — if they're legitimately different metrics (e.g., broad technical health vs. macro-weighted composite), the fix is a disambiguating label reusing existing app terminology, not swapping the data source.
P640-Q1: After any hardware/embed replacement (e.g., P610's TradingView → Naver candle-chart swap), grep the surrounding explanatory copy/tooltips for the old technology's name — a chart can be fully replaced while its neighboring "how this is calculated" sentence still references the retired component.

--- v52.26 dead-chart root-cause + pre-deploy local verification (2026-07-07) ---
P641-Q1: Before assuming a stale chart shares some "generic expansion helper" with other charts, grep for the exact canvas ID's `new Chart(...)` construction site first — a hardcoded literal array is at least as likely as shared infrastructure, and misattributing it risks either overreaching into unrelated shared code or wrongly deferring a simple, safe, single-site fix.
P641-Q2: For any metric shown only client-side with no server accumulation path (check `scripts/fetch-data.mjs`'s daily-record field list and the live `public-data/history.json` directly), verify whether adding it to the unattended production cron is actually safe (reachability from GitHub Actions runners, error handling) before doing so — a client-side `localStorage` upsert-accumulation (mirroring the existing server-side upsert-by-date/cap idiom) is a lower-risk alternative when the source itself works from the browser already.
P641-Q3: When OS-level browser screenshots time out or show unexpectedly blank canvases in a multi-tab/multi-window automation session, check `document.hidden`/`document.visibilityState` first — a backgrounded tab can suppress compositor painting independent of whether the underlying Chart.js/canvas state is actually correct. Confirm real rendering via `canvas.getContext('2d').getImageData(...)` pixel inspection (non-transparent pixel count + distinct color count) rather than concluding "broken" from a single failed/blank screenshot.
P641-Q4: Any local-file code change intended to fix a *live-site* finding should be verified against a local static server (e.g., `python3 -m http.server`) before being declared fixed — testing against the still-old live deployment will just reconfirm the original bug.

--- v52.27 FABLE UI/UX Phase V0 checks (2026-07-08) ---
P642-Q1: Theme heatmap/detail: every `THEME_MAP` entry must open the inline detail panel without console dispatch failure, and the panel must become the visible canonical surface after click.
P642-Q2: `theme-detail` route/hash must resolve to the `themes` inline detail surface; do not maintain a separate orphan detail page with divergent content.
P642-Q3: Briefing market summary and the same-screen Fear & Greed strip must read the same live-first source (`window._lastFG`) before falling back to snapshot data.
P642-Q4: `kr-technical` cold entry must instantiate the Naver candle chart without manual symbol search, and the y-axis must be data-range padded rather than zero-baseline compressed.
P642-Q5: After touching theme detail, route canonicalization, briefing summary metrics, or KR candle chart boot, run T860/T861, `node scripts/ci-runtime-contract-check.mjs`, and the headless/browser route checks before claiming closure.

--- v52.28 FABLE UI/UX remaining phase checks (2026-07-08) ---
P643-Q1: For every JSON-expected proxy endpoint, HTTP 200 must still be rejected if the body is HTML/CAPTCHA/block text; do not mark that proxy ok or cache it as a successful body.
P643-Q2: KR supply failure must visibly leave `수신 대기`: investor TOP10 date becomes `수신 실패`, three TOP10 tables render a failure/fallback card, and analysis/banner text explains proxy/Naver failure.
P643-Q3: New or touched visible metric slots must expose `data-value-state=value|pending|failed|na`; bare `—` is acceptable only inside an explicit state or non-decision reference text.
P643-Q4: Run `node scripts/ci-viewport-matrix-check.mjs` for route x viewport surface QA; if it fails, record failing route/viewport before changing CSS.
P643-Q5: Keep `aria-live` regions intentionally scarce, canvas elements named or hidden, and chart resize limited to visible charts. `node scripts/ci-ux-default-path-check.mjs` must enforce these.

--- v52.29 FABLE remaining automation checks (2026-07-08) ---
P644-Q1: Proxy ordering must use accumulated success/failure evidence (`okCount`, `failCount`, and score-based active ordering), not only static order or the latest successful timestamp.
P644-Q2: Client live quote counts and server snapshot quote counts must be visibly labelled as different populations (`클라 시세` vs `서버 스냅샷 시세` or equivalent).
P644-Q3: `market-news` and `briefing` rendered card duplicates must be checked in the route x viewport browser matrix with a normalized text/word-bag key.
P644-Q4: Runtime/UX contract gates must assert the proxy score, quote label split, and duplicate-card matrix wiring.

--- v52.30 AI chat key-route honesty checks (2026-07-08) ---
P645-Q1: `chatSend()` and `chatSendUnified()` must not gate on `getApiKey()` alone; they must check the effective Claude route helper (`_aioHasClaudeRoute` or equivalent).
P645-Q2: If no personal key and no Worker server-key route exists, the user-facing message must distinguish chat from briefing/translation: briefing/translation may use operator server key, chat needs personal key or enabled Worker server-key mode.
P645-Q3: `callClaude()` preflight and chat UI preflight must use the same route resolver path so the UI cannot block a call that would succeed through Worker server-key mode.
P645-Q4: T865 and `ci-runtime-contract-check.mjs` must fail if the chat key gate regresses to personal-key-only logic.

--- v52.31 breadth regime color + zero-delta checks (2026-07-08) ---
P646-Q1: Signal-page market breadth cards (`bb-5sma/20sma/50sma`) must use `NARRATIVE_ENGINE.getBreadthRegime()` or an equivalent canonical helper for non-overheat labels/colors.
P646-Q2: A 32% breadth value must render as red `공포 영역`, not green/amber, on both the signal card and breadth detail gauge.
P646-Q3: Breadth detail bars (`breadth-5sma-bar`, `breadth-20sma-bar`, `breadth-50sma-bar`) must update their background color together with the big value and label.
P646-Q4: Zero metric deltas must render neutral `0pp` with `is-flat`, not `±0pp`, `+0pp`, or `-0pp`.
P646-Q5: T866 and `ci-runtime-contract-check.mjs` must fail if the breadth color contract or zero-delta contract regresses.

--- v52.32 viewport matrix geometry checks (2026-07-08) ---
P647-Q1: `scripts/ci-viewport-matrix-check.mjs` must check topbar action clipping at 390/768/1024/1440, not only document overflow.
P647-Q2: The matrix must fail on SVG text overlap using rendered geometry (`getBBox()`), not string/DOM presence alone.
P647-Q3: SVG text below 10px must fail unless the SVG/text is not visible in the active route.
P647-Q4: `ci-runtime-contract-check.mjs` must assert the `topbarClipCount`, `svgTextOverlapCount`, and `svgTinyTextCount` fields remain wired.

--- v52.33 live quote fallback mirror checks (2026-07-08) ---
P648-Q1: `applyLiveQuotes()` must synchronize `_fallback[key]` when `_LIVE_SNAP_MAP` updates a `DATA_SNAPSHOT` key that already exists in `_fallback`.
P648-Q2: T686 must remain green after server/public-data quotes update VIX or other mirrored fields.

--- v52.34 FABLE V0/V1 completion-gap checks (2026-07-09) ---
P649-Q1: `_buildBriefingDecisionSummary()`'s F&G value must read `window._lastFG` first and `snap.fg` as fallback only — not the dead `snap.fg.value`/`snap.fearGreed` fields (a third, previously-unaudited same-page F&G read site beyond P642's two).
P649-Q2: `fetchVkospiDynamic()` must surface an explicit `failed` value-slot state on `kr-vkospi-val`/`kr-health-vkospi` after 3 consecutive failures (proxy error, bad parse, or exception), and self-heal (reset the fail counter) on the next success.
P649-Q3: `calcKrHealthScore()` must not overwrite the VKOSPI failed state with a stale `snap.vkospi` value when it re-runs on kr-technical page re-view.
P649-Q4: T867/T868 and `ci-runtime-contract-check.mjs` must fail if either contract regresses.

--- v52.35 user research integration checks (2026-07-09) ---
P650-Q1: AI CAPEX risk answers must mention funding pulse evidence, not only chip demand: 10Y+, LQD YTM, IG OAS/corporate OAS, HY OAS, rating/downshift, oil/inflation shocks, and capex ROI.
P650-Q2: Semiconductor technical answers must map 20EMA/50EMA/100SMA/200SMA as separate regime layers and must treat SMH/XSD above-20EMA washout as tactical mean-reversion only when 200EMA breadth is still intact.
P650-Q3: User-provided image/chart levels such as SMH/XSD above-20EMA 0 / above-50EMA 32 / above-200EMA 84 must remain `sourceKind=REFERENCE`; never quote them as live/current values unless a fresh data block or user-updated chart supplies them.
P650-Q4: AI value-chain answers must distinguish infrastructure sellers (NVDA/MU style risks) from monetization/toll-collector platforms (MSFT style evidence) and then reconnect both through capex funding cost and ROI.
P650-Q5: `ci-runtime-contract-check.mjs` must fail if the v52.35 chat/data/knowledge-base integration strings disappear.

--- v52.36 Telegram live-news routing checks (2026-07-09) ---
P651-Q1: Compare the live/public Telegram mirror posts from `insidertracking`, `aetherjapanresearch`, and `bornlupin` against deployed `public-data/telegram-digest.json`; record channel `lastPostId` gaps before claiming the site reflects current market news.
P651-Q2: Market-moving credit/funding posts must classify as `credit` when they mention LQD/OAS, corporate bonds, investment grade, credit spreads, rating downgrades, project finance, funding cost, or CAPEX funding.
P651-Q3: `macro`, `fxbond`, `breadth`, `fundamental`, `themes`, `theme-detail`, `kr-home`, `kr-supply`, and `kr-technical` must each subscribe to page-appropriate Telegram tags rather than sharing one generic feed.
P651-Q4: Long-form bank/research posts must not be globally filtered out by compact-card length limits; analysis pages must preserve them while compact pages can still suppress them.
P651-Q5: `data-watchdog.yml`, `ci-data-pipeline-contract-check.mjs`, and `ci-runtime-contract-check.mjs` must fail if live Telegram digest freshness/channel coverage, credit classification, or page feed hosts regress.

--- v52.37 topic coverage and credit/funding surface checks (2026-07-09) ---
P652-Q1: Compare `public-data/telegram-digest.json.topicCounts` keys against `_TG_PAGE_TAGS`; any produced non-internal topic such as `market-note` must be consumed by at least one suitable page.
P652-Q2: `credit` must remain a first-class runtime topic: `TOPIC_KEYWORDS`, `getTopicBadge`, `_TOPIC_GROUP_ORDER`, topic label/advice/color, and macro ticker-suppression paths must all recognize it.
P652-Q3: `macro`, `fxbond`, `themes`, `sentiment`, `signal`, `fundamental`, and `breadth` news surface contracts must include `credit`; `fxbond` must also accept legacy server topic `fxbond`.
P652-Q4: `scripts/fetch-data.mjs` must keep a dedicated `Google News - Credit/Funding` query and `credit-funding` scoring rule for LQD/HYG/OAS, corporate bonds, rating downgrades, AI CAPEX funding, and data center financing.
P652-Q5: `ci-data-pipeline-contract-check.mjs` and `ci-runtime-contract-check.mjs` must fail if P652-Q1~Q4 regress.

--- v52.38 external agent-operations pattern integration checks (2026-07-09) ---
P653-Q1: `scripts/ci-live-invariant-check.mjs` must fetch the live deployed site and fail if any live `index.html` script cachebuster disagrees with live `version.json`, or if any top-level function name is declared in more than one live runtime script file (R280 live re-check). `.github/workflows/data-watchdog.yml` must run it on the existing hourly schedule.
P653-Q2: `.claude/skills/post-edit-qa/references/tiers.md` must name an explicit live-browser-verification tier (Chrome MCP when connected), and the report contract must require stating whether that tier ran or was skipped — never silently omitted.
P653-Q3: `scripts/ci-knowledge-lint-check.mjs` must fail if `_context/INDEX.md`'s document table disagrees with the actual git-tracked `_context/*.md` file set in either direction, if `_context/INDEX.md` and `_context/CLAUDE.md` document tables disagree, or if any doc that opts in with `auto_refresh: true` frontmatter is missing a parseable `last_verified` date or is stale beyond the script's threshold (docs without `auto_refresh: true` are intentionally frozen snapshots and must not be flagged). `.github/workflows/knowledge-lint.yml` must run it weekly.
P653-Q4: `.claude/skills/knowledge-lint/references/workflow.md` must include a Pass 8 that audits accumulated skill/command instructions for reasoning-echo requests and instruction-without-eval drift, and `.claude/skills/knowledge-lint/SKILL.md`'s self-eval table must reference it (KL7).
P653-Q5: `.claude/skills/integrate/references/workflow.md` must include an explicit step to scan for and mask credential-shaped strings (API key prefixes, private key blocks, account numbers) before persisting extracted material into any git-tracked doc, since this repo deploys publicly via GitHub Pages.

--- v52.39 page-education-layer render/content checks (2026-07-10) ---
P654-Q1: Every non-excluded route page (all 22 route pages except `theme-detail` and `guide`, 20 total) must render exactly one `.aio-fund` `<details>` block after `showPage`, and it must not carry the `open` attribute (default-collapsed).
P654-Q2: Every `AIO_PAGE_FUNDAMENTALS` entry's `concept`/`why`/`how`/`action` arrays must be non-empty.
P654-Q3: Registry copy must not violate R291. Mechanically checkable subset: zero year/date patterns (`20\d\d년?`, `\d+월 \d+일`) and zero present-tense market-state assertion patterns ("현재/지금 ~이다·입니다" as a market-state claim) inside the registry block. The words "지금"/"현재" alone are not violations — an invariant framing question ("지금 얼마나 공격적이어도 되나") or a literal quoted UI section label ("경기 사이클 — 지금 어디?") are both allowed; the ban is on asserting a specific market level/regime as current fact. Combine the mechanical scan with a manual diff read.
P654-Q4: The component must not use the `.aio-page-brief` class anywhere in its own code block, and must not add any `aria-live` attribute.
P654-Q5: T869 and `ci-runtime-contract-check.mjs`'s page-fundamentals contract checks must fail if any of P654-Q1~Q4 regress.

--- v52.40 FABLE-EFFICACY-AUDIT-2026-07-10 Batch 1 checks (EF-01/02/04/13, 2026-07-10) ---
P655-Q1: Every `[data-live-price="^GSPC"]` sink across home/signal/technical must reflect the same live value within 0.1% after a live quote injects `window._liveData['^GSPC']` (no page-specific parallel S&P source).
P655-Q2: `updateMarketPulse()`'s breadth strip (`mp-breadth-val`/`mp-breadth-label`) must derive color/label from `NARRATIVE_ENGINE.getBreadthRegime(bVal)`, not an independent threshold function.
P655-Q3: `breadth-header-badge` and `breadth-diag-signal` (breadth page) must update when `_aioRenderBreadthConsensus()` runs, reading the same `marketState.breadthConsensusFull` object the signal-page "다중 신호 합의" box already reads — not a static HTML seed.
P655-Q4: `breadth-new-highs`/`breadth-new-lows`/`breadth-hl-ratio` must carry `data-value-state="na"` (via `_aioRenderValueSlot`) after `initBreadthPage()`, regardless of whether `Chart` is defined — never a bare perpetual `—` with no state attribute.
P655-Q5: The breadth 50SMA readout sentence and bar width must match `DATA_SNAPSHOT.breadth50sma` (via `window._aioSyncBreadth50Readout()`) even when `Chart` is undefined — this sync must not live only inside the Chart.js-gated `updateBreadthBars()` path.
P655-Q6: `#briefing-date-line` must never show a date/time that is still in the future relative to the actual "now" — during the 00:00–08:00 KST window it must render yesterday's basis date with a "어제 생성분" qualifier (`window._aioRenderBriefingDateLine`, mockable via a `nowOverride` argument for tests).
P655-Q7: The FOMC decision-header footnote (`_aioRenderPageDecisionHeader`'s `.aio-decision-foot`, all 6 pages in `_fomcFooterPages`) must prefix `AIO_EVENT_FRESHNESS_REGISTRY.fomc.eventDate`, append an "(오래된 컨텍스트 · N일 경과)" badge past 21 days, and render empty (fall back to the page caveat) past 30 days.
P655-Q8: Any mini-card labeled "라이브"/"지금" must not be bound to a pure-snapshot `data-snap` attribute; it must read `window._liveData` first with an explicit fallback indicator (e.g. macro's `#macro-now-spx` / `_aioSyncMacroLiveSpxMini()`).
P655-Q9: `js/aio-tests.js` T870~T873 and `ci-runtime-contract-check.mjs`'s 8 EF-01/02/04/13 static checks must fail if any of P655-Q1~Q8 regress.

--- v52.41 FABLE-EFFICACY-AUDIT-2026-07-10 Batch 2 checks (EF-08/10/11/12/19, 2026-07-10) ---
P656-Q1: `_aioRenderCarryUnwindRisk()` must remain reachable from both an `aio:pageShown`('fxbond') and `aio:liveQuotes` `_aioPageBus` registration, not only the legacy `showPage`-monkeypatch `setTimeout`, and must produce a finite `carry-score-text` value even when all four live inputs (`JPY=X`/`^VIX`/`^TNX`/`HYG`) are absent.
P656-Q2: The carry-unwind rate-diff risk label must disclose that the BOJ side of the spread is a fixed constant (not a live feed).
P656-Q3: `page-ticker`'s Key Metrics (`ticker-m-mcap/pe/pb/roe/div`) and Quarterly Results (`ticker-f-rev/gp/op/ni`) slots must carry `data-value-state="na"` with a pointer to the fundamental page after `showTicker()` runs — never a bare, state-less `—` forever. The Chart tab's `loadTickerChart()` (Stooq-based, already FMP-independent) must not be touched.
P656-Q4: `rm-vixstr-status` and `rm-rspratio-status` must carry `data-value-state="pending"` (via `_aioRenderValueSlot`) whenever their respective live inputs (VXX/VIX; RSP/SPY) are unavailable, instead of leaving the static HTML seed text unstated indefinitely.
P656-Q5: The TradingView OHLC fallback strip (`data-tvohlc-close`/`data-tvohlc-chg`) must populate via an independent `_aioSyncTvOhlcFallback()` reachable from technical page-shown/live-quotes events — it must not depend on `loadTVChart()` (i.e. on the primary chart having been loaded) to ever render.
P656-Q6: kr-technical's "KOSPI/KOSDAQ 분석 새로고침" buttons must call `analyzeKrIndex` with `data-arg2` set to the button's own card's result-container id (`kr-kospi-tech-result` / `kr-kosdaq-tech-result`) — the `analyzeKrTickerDeep` mis-wiring (which writes to the unrelated `#kr-ticker-analysis-result`) must not reappear.
P656-Q7: `js/aio-tests.js` T874~T878 and `ci-runtime-contract-check.mjs`'s 7 EF-08/10/11/12/19 static checks must fail if any of P656-Q1~Q6 regress.

--- v52.42 FABLE-EFFICACY-AUDIT-2026-07-10 Batch 3 checks (EF-06/07/14/15/16, 2026-07-10) ---
P657-Q1: `#page-sentiment [data-live-price="^VIX9D"/"^VIX3M"/"^VIX6M"]` slots must render `data-value-state="na"` (not `"value"`) when the number came from the `DATA_SNAPSHOT` seed rather than a live quote, with a "(정적)" qualifier in the visible text.
P657-Q2: `#kr-home-kospi-supply .kr-supply-title`'s date span must read "폴백 데이터" (not a specific date) whenever `_showKrSupplyFailureState()` has rendered the failure warning for that card.
P657-Q3: News source-name spans (e.g. the briefing digest's "(source)" suffix) must pass through `_aioSafeSourceLabel()`, which replaces names that are >30% non-Latin/non-Hangul script with "외신" while leaving Latin/Korean-mixed names untouched.
P657-Q4: Whenever the client successfully fetches the CNN Fear & Greed historical series (populating `fg-h1`'s "전일: N점"), the `sentiment-fg-delta` and `home-fg-delta` elements must be recomputed from that same just-fetched previous score, not left showing a value derived from a different (server-snapshot) previous-score source.
P657-Q5: `kr-macro-bokrate-freshness`/`kr-macro-cpi-freshness`/`kr-macro-pmi-freshness` must render a "기준: MM/DD (N일 전)" badge sourced from `DATA_SNAPSHOT._fieldTs.bok_rate`/`kr_macro` on kr-macro page-shown.
P657-Q6: `js/aio-tests.js` T879/T880/T881/T883 and `ci-runtime-contract-check.mjs`'s 6 EF-06/07/14/15/16 static checks must fail if any of P657-Q1~Q5 regress.

--- v52.43 FABLE-EFFICACY-AUDIT-2026-07-10 Batch 4 checks (EF-03/05/17/18, 2026-07-10) ---
P658-Q1: `DATA_SNAPSHOT.bokNext` and `MACRO_CALENDAR.releases['kr-bok'].nextRelease` must both read `2026-07-16` (WebSearch-verified against Reuters/CNBC/Bloomberg), not the incorrect `2026-07-10` that was previously hardcoded. The kr-macro page's static meeting-history table must include the 2026-05-28 row.
P658-Q2: `MACRO_CALENDAR.releases['us-fomc']`/`['us-fed-rate']` must have `lastRelease` rolled forward to `2026-06-17` (the meeting that already occurred) and `nextRelease` set to `2026-07-29`, not left pointing at an already-past meeting as "next".
P658-Q3: `fetchKrSupplyData()` must request `https://m.stock.naver.com/api/index/{KOSPI,KOSDAQ}/trend` (curl-verified 200, matches the individual-stock `/api/stock/{code}/trend` pattern) — never the confirmed-404 `/investorTrend` path. `_aioAdaptKrTrendResponse()` must map the flat `{personalValue,foreignValue,institutionalValue}` snapshot into `{xxxBuy,xxxSell}` pairs preserving net-flow sign/magnitude.
P658-Q4: `GMO_MARKETS`'s Americas group must include `ES=F`/`NQ=F` entries tagged `isFutures: true`, and `renderGmoTable()` must render a distinct highlight (background tint + "시간외" label) for those rows specifically when `_getUsSession()` is not `'open'`.
P658-Q5: `js/aio-tests.js` T884/T885/T886 and `ci-runtime-contract-check.mjs`'s 5 EF-03/17/18 static checks must fail if any of P658-Q1~Q4 regress.

--- v52.44 DEFERRED-BLOCKS B8 mitigation checks (Worker anycast 403 auto-retry, 2026-07-10) ---
P659-Q1: `js/aio-chat.js`'s `_aioFetchClaudeWithRetry(url, fetchOpts, serverKey, maxRetries)` must only retry when `serverKey` is true, the response status is 403, and the parsed body matches Anthropic's own `{error:{type:'forbidden'}}` shape — not the Worker's own `errorResponse()` shape, and not any other 403 cause.
P659-Q2: `callClaude()`'s initial request and its 400-beta-header fallback retry must both call `_aioFetchClaudeWithRetry(_claudeTarget.url, ..., _claudeTarget.serverKey)` — neither call site may regress to a bare `fetch(_claudeTarget.url, ...)`.
P659-Q3: `autoTranslateNews()` (news translation) and `_generateAIBriefing()` (AI briefing) in `js/aio-data.js` must both route their Claude call through `_aioFetchClaudeWithRetry` when it is defined, falling back to bare `fetch` only if the helper is somehow absent (defensive `typeof` guard, matching the existing `_aioClaudeTarget` reference pattern already used in the same file).
P659-Q4: `js/aio-tests.js` T887-T890 and `ci-runtime-contract-check.mjs`'s 4 B8 static checks must fail if any of P659-Q1~Q3 regress.

--- v52.45 CODEX-DIAGNOSIS WO-0 checks (workflow YAML corruption + repo-wide mojibake, 2026-07-10) ---
P660-Q1: `.github/workflows/*.yml` must contain zero C0/C1 control characters and must parse successfully with `js-yaml` — this is a hard gate (no baseline, no exceptions), unlike every other tracked file.
P660-Q2: Any tracked `.md`/`.js`/`.mjs`/`.json`/`.html`/`.yml` file outside `public-data/` may carry pre-existing control characters recorded in `_context/control-char-baseline.json`, but the count per file must never *increase* beyond its recorded baseline — `scripts/ci-control-char-check.mjs` must fail on any such regression.
P660-Q3: `package.json` must declare `js-yaml` as a devDependency, and `.github/workflows/ci.yml`'s `validate` job must run `npm install` before invoking `scripts/ci-control-char-check.mjs`.
P660-Q4: `scripts/ci-runtime-contract-check.mjs`'s WO-0/P660 static checks must fail if Q1~Q3 regress. (The one-time bulk mojibake restoration's own integrity — CHANGELOG.md's 604 `## v` headers and BUG-POSTMORTEM.md's 438 `## P` headers unchanged before/after — was verified manually during the fix per P660 and is not re-asserted as a standing gate, since hardcoding those counts would break on the next ordinary version bump or postmortem entry.)

--- v52.46 CODEX-DIAGNOSIS WO-1A checks (portfolio vault integration, 2026-07-10) ---
P661-Q1: `_AIO_SENSITIVE_KEYS` (js/aio-core.js) must include `'aio_portfolio_data'` — `safeLS`/`safeLSGet` must treat portfolio storage the same as any other vault-protected key.
P661-Q2: `renderPortfolio()` must call `isPortfolioLocked()` at its start and show the lock screen (not the empty-portfolio message) when locked — the previous gate, `checkPortfolioPin()`, must stay removed (it had zero call sites and never actually fired).
P661-Q3: `unlockPortfolio()` must reject a wrong PIN by checking that `_AioVault.decrypt(raw) === null` against the stored ciphertext (AES-GCM authentication failure), not by any plaintext string comparison.
P661-Q4: A legacy install with a plaintext `aio_portfolio_pin` and plaintext `aio_portfolio_data` must, on first unlock with the same PIN value, end up with `aio_portfolio_data` re-saved as `aio_enc::`-prefixed ciphertext and `aio_portfolio_pin` removed — with no user-visible behavior change (same PIN digits keep working).
P661-Q5: `resetPortfolioPin()` (opt out of portfolio protection) must never remove or alter `aio_vault_salt` — the shared vault protecting other encrypted API keys must be unaffected by a portfolio-only opt-out.
P661-Q6: `js/aio-tests.js` T891-T895 and `ci-runtime-contract-check.mjs`'s 4 WO-1A static checks must fail if P661-Q1~Q5 regress. (Full behavioral proof — actual AES-GCM round-trip, wrong-PIN rejection, and migration — was verified via a same-session Playwright E2E pass, 17/17; not re-run as a standing headless-suite test since the crypto flow is async and the suite runs synchronously, per the same constraint as B8/T887-890.)

--- v52.47 CODEX-DIAGNOSIS WO-1B checks (Anthropic proxy auth/cost boundary, 2026-07-10) ---
P662-Q1: `cloudflare-worker-proxy.js`'s `/anthropic` route must reject a request with no `Origin` header, or an `Origin` not in `ALLOWED_ORIGINS`, with 403 — before ever reaching the Anthropic upstream fetch.
P662-Q2: If `env.AIO_APP_TOKEN` is configured, `/anthropic` must reject a request whose `X-AIO-App-Token` header doesn't match it with 403; if `env.AIO_APP_TOKEN` is unset, the header must not be required (backward compatible with deployments that haven't configured it).
P662-Q3: `/anthropic` must enforce its own rate limit (20 req/min per `cf-connecting-ip`, tracked in a dedicated map) independent of the general data-proxy's 300 req/min limit — the 21st request within a minute from the same IP must get 429.
P662-Q4: If `env.AIO_QUOTA` (the daily-cap KV binding) is missing, `/anthropic` must return 503 (fail-closed) rather than silently proceeding uncapped; if bound and the daily cap is already reached, it must return 429.
P662-Q5: A request body larger than 200KB must be rejected with 413 before being parsed or forwarded upstream.
P662-Q6: `env.ANTHROPIC_KILL_SWITCH === '1'` must return 503 even when `ANTHROPIC_API_KEY` is otherwise configured correctly.
P662-Q7: The client (`js/aio-chat.js` `callClaude()`, `js/aio-data.js` `autoTranslateNews()`/`_generateAIBriefing()`) must send the `X-AIO-App-Token` header only on the server-key (Worker-routed) branch, never on the direct-personal-key branch; the Worker's CORS `Access-Control-Allow-Headers` must include `X-AIO-App-Token` or browsers will block the header before the Worker ever sees it.
P662-Q8: `scripts/ci-worker-anthropic-check.mjs` (a real handler-invocation test, not a static contract — see R295) and `ci-runtime-contract-check.mjs`'s 5 WO-1B static checks must fail if P662-Q1~Q7 regress.

--- v52.48 CODEX-DIAGNOSIS WO-5 checks (change control + hook unification, 2026-07-10 — dev-environment config, not app code; no CI gate, verified by manual pipe-tests) ---
P663-Q1: `main` branch protection on GitHub must have `allow_force_pushes=false` and `allow_deletions=false`, with no required PR reviews or required status checks (verify via `gh api repos/ysnle/aio-screener/branches/main/protection`) — chosen deliberately so the existing direct-push bot/hook workflow keeps working.
P663-Q2: `.codex/hooks.json`'s hook commands must be repo-root-relative paths (e.g. `.codex/hooks/protect-files.sh`), never an absolute machine-specific path — the previous OneDrive-rooted absolute paths pointed at a directory that no longer exists, silently disabling all 6 Codex hooks.
P663-Q3: Both `.claude/hooks/auto-commit-on-stop.sh` and `.codex/hooks/auto-commit-on-stop.sh` must, when a session-start snapshot file exists, stage only paths absent from that snapshot (via `comm -13` on sorted path lists) rather than `git add -A` unconditionally; absent a snapshot, they must fall back to `git add -A` so a session started before this hook was wired doesn't silently save nothing.
P663-Q4: `.claude/hooks/session-start-snapshot.sh` and `.codex/hooks/session-start-snapshot.sh` must write `git status --porcelain` to their own tool-specific snapshot file (`.claude/.session-start-snapshot` / `.codex/.session-start-snapshot`, both gitignored) — not a shared file, since two different agent tools can run against this repo concurrently (observed directly this session).
P663-Q5: `.claude/hooks/check-version-sync.sh` and `.codex/hooks/check-version-sync.sh` must capture version numbers with a variable-length patch digit group (`v[0-9][0-9]*\.[0-9][0-9]*`), not a fixed single digit after the decimal point, which silently truncated e.g. `v52.47` to `v52.4`.
P663-Q6: `_context/CLAUDE.md` must not claim `.claude/settings.local.json` is Git-tracked — it has been gitignored since the 2026-07-04 config audit (`git ls-files .claude/settings.local.json` returns nothing).

P664-Q1: `window.AIO.getTradingDecisionInputEvidence().total` must equal 13 and its `rows` must include `vvix-price`/`fg-sentiment`/`breadth200-participation`/`pcr-putcall`/`hy-spread-bp`/`aaii-bearish` alongside the original 7 — `computeTradingScore()`'s actual input list and the evidence registry's tracked-input list must stay 1:1.
P664-Q2: The `aaii-bearish` row must always report `decisionUse:'reference'` (never `'trading'`) and must never appear in `criticalMissing` — AAII has no live-fetch path (weekly manual snapshot only) and must not be able to trip the trading-critical-missing gate.
P664-Q3: `fetchHYSpread()` (js/aio-data.js) must call `window._markFetch('hySpread')` immediately after a successful FRED fetch, alongside its existing module-local `hyLastFetch` cache-gate update — the evidence engine can only report HY-spread freshness through the shared `_lastFetch` registry, not the module-local variable.
P664-Q4: `_aioDefaultDecision()` (js/aio-core.js) must read `computeTradingScore(...)`'s full return value (not only `.total`) and merge `evidenceAudit.criticalMissing.length` into the page's `sourceKind`: 0 missing → no change, 1-2 → `DELAYED`, 3+ → `SNAPSHOT`. The merge must stay bounded exactly this way — an unbounded merge (any single missing input forcing `SNAPSHOT`) would make the decision header show "스냅샷" during routine, harmless single-input staleness, trading a stale-shown-as-live bug for a live-shown-as-stale one.
P664-Q5: When `criticalMissing` is non-empty, `_aioDefaultDecision()`'s dynamic caveat (naming the specific missing inputs) must be combined with — not overwritten by — the page's static `AIO_PAGE_EVIDENCE_CONTRACT` caveat when both are present (see `window._aioBuildPageDecision`'s evidence-merge step).
P664-Q6: `js/aio-tests.js` T896-T900 and `ci-runtime-contract-check.mjs`'s 6 WO-6 static checks must fail if P664-Q1~Q5 regress. (T896/T897/T900 call the real `window.AIO.getTradingDecisionInputEvidence()`/`window._aioBuildPageDecision('home')` functions directly rather than regex-matching source, since these don't depend on async network state the way B8/WO-1A's Claude-fetch and vault-crypto logic did.)
P664-Q7 (deferred, tracked as DEFERRED-BLOCKS.md B9, not a standing gate): WO-6's full literal completion gate — per-field `source`/`observedAt`/`publishedAt`/`fetchedAt`/`freshnessClass`/`fallbackReason` on every value shown across all ~20 pages, a structural separation between `DATA_SNAPSHOT`'s single file-level `_updated` timestamp and true per-field observation times, and a dedicated auditable source-lineage export UI — remains unimplemented. This session's P664 slice covers only `computeTradingScore()`'s 13 inputs and the shared cross-page decision header.

P665-Q1: `scripts/backtest-trading-score.mjs`'s `reconstructScore()` must accept an optional `hyg` parameter that defaults to the original constant (78) when omitted — the existing production call site (`fetch-data.mjs`'s 30-minute-cron `runBacktest`) must produce byte-for-byte-structurally-identical output (ignoring only `generatedAt`) before and after this change.
P665-Q2: `scripts/backtest-trading-score-longrun.mjs` must fetch real multi-year daily history for SPX/VIX/VVIX/TNX/DXY/WTI/HYG via the same Yahoo chart API pattern already used in production, and must throw (not silently produce a truncated/misleading report) if the merged series comes back under 300 trading days.
P665-Q3: The long-run backtest's regime labels must be derived from the fetched data itself (trailing VIX level + trailing-252-day drawdown from rolling ATH), not from hardcoded historical narrative dates — avoiding a memorized-date error becoming a silent data-classification bug.
P665-Q4: `public-data/score-backtest-longrun.json` must retain its `methodology`/`caveats` fields stating plainly that only ~55% of `computeTradingScore()`'s weight (vol+trend+macro) is covered, and that the live app's displayed composite score remains provisional/unvalidated regardless of this result — a reader of only the top-level correlation numbers must not be able to conclude "the whole score is validated" or "the whole score is invalidated."
P665-Q5: This finding must not have silently changed `computeTradingScore()`'s live logic, `getScoreAdvice()`'s text, or any band/threshold in `js/aio-core.js` or `index.html` — a negative backtest result on a partial-coverage validation is a documented finding requiring its own separate product decision, not an automatic trigger for a live behavior change.

P666-Q1: `scripts/fetch-data.mjs`'s `backtestFactors(stockData, opts)` must accept optional `opts.offsets`/`opts.fwdDays` that default to the original constants (`[147,126,105,84,63,42]`/`21`) when omitted — the existing production call site (which passes no second argument) must produce structurally identical output (ignoring only `asOf`) before and after this change.
P666-Q2: `fetch-data.mjs` must guard its `main()` invocation behind an `import.meta.url` direct-execution check (matching every other `scripts/*.mjs` file in this repo) — importing the file (to reuse `backtestFactors`/`closesToFactors`/`_mean`) must never trigger the live fetch pipeline's real network calls or overwrite `public-data/*.json`.
P666-Q3: `scripts/backtest-factors-longrun.mjs` must select its ticker sample from `public-data/screener-universe.json` sorted by `mcap` descending, bounded to a `--top` count (default 120) — never the full universe — and must fetch with concurrency capped at 4 (matching `fetch-data.mjs`'s own `backfillHistory()` concurrency), given this repo's documented prior Yahoo IP-blocking history.
P666-Q4: `public-data/factor-backtest-longrun.json` must retain its `methodology.survivorshipBiasCaveat` and `methodology.subsetNotFullUniverse` fields stating plainly that survivorship bias is unresolved and the sample is a top-mcap subset — a reader must not be able to conclude "the live factor model's survivorship/full-universe validation gate has passed" from this file alone.
P666-Q5: This finding must not have silently changed `_aioComputeFactorRanks()`'s live factor weights, direction, or inclusion in `js/aio-data.js`, nor `backtestFactors()`'s live `COMP_W`/factor list in `fetch-data.mjs` — a negative-IC finding on a partial-coverage (4-of-7-factor, subset-universe, survivorship-unresolved) validation is a documented finding requiring its own separate product decision.

P667-Q1: `js/aio-ui.js`'s `_pricePosition()` must keep its per-marker label baseline and value baseline at least 14px apart (currently `slY+21` and `slY+35`) — reverting to a 10px gap reintroduces the SVG bounding-box overlap this fixed (verified failing on all 4 supported viewport widths for the `technical` route before the fix, passing after).
P667-Q2: `scripts/ci-viewport-matrix-check.mjs` must collect `pageerror` and `console.error` events per page and attribute them to whichever route was active when they fired — a route silently throwing on every visit must fail the gate, not report a clean PASS.
P667-Q3: The viewport matrix's console-error allowlist must match only the specific, source-verified expected-noise patterns (`net::ERR_FAILED`/`Failed to load resource` from the deliberate network abort, and the app's own `[AIO:api] {source}: warn → error` health-escalation log) — it must not broaden to a pattern that would also swallow a genuine new JS error in the same subsystem.
P667-Q4: `zeroCanvasCount` must reflect a real query against `<canvas>` elements with zero client width/height (or zero backing-store width/height) among visible canvases — not an array that is declared but never populated.
P667-Q5: Any inline `font-size` at or below 8px in visible page content must fail the viewport gate (`tinyTextCriticalCount`); 9px remains observation-only (`tinyTextCount`) pending a dedicated typography remediation pass, per the documented static scan (index.html: 1 instance at 7px, 0 at 8px, ~34 at 9px) informing this threshold choice.
P667-Q6: `.github/workflows/ci.yml`'s `viewport-matrix` job must run with `AIO_VIEWPORT_FULL_INIT=1`, must not have `continue-on-error: true`, and must be included in `deploy`'s `needs:` array — a regression here must fail CI and block deploy, not silently report-and-continue.
P667-Q7 (deferred, tracked in DEFERRED-BLOCKS.md, not a standing gate): WO-4's full literal completion gate — external success/timeout/partial-data scenario coverage (only the "everything aborted" failure scenario is tested today), route-round-trip listener/timer/fetch-leak detection, and manual keyboard/screen-reader walkthrough evidence — remain unimplemented/unavailable. This session's P667 slice covers the SVG-overlap bug fix and the pageerror/console.error/zero-canvas/small-text/blocking-gate portions of WO-4's scope only.

P668-Q1: `js/aio-chat.js`'s alert auto-check must register its 60-second interval through `window._aioRegisterTimer('alerts-check', ...)` when that function exists, with a defensive fallback to a bare `setInterval` only if it doesn't — the interval's actual firing behavior (60s cadence, 30s initial delay) must be unchanged.
P668-Q2: `_context/WO7-GLOBAL-INVENTORY-2026-07-10.md`'s baseline counts (innerHTML/global-write/localStorage-direct-vs-safeLS counts) must be treated as the reference point for any future WO-7 packet's "decreased or justified increase" claim — a future packet must not report a bare count without comparing it to this baseline.

P669-Q1: `scripts/ci-doc-currency-check.mjs` must always exit 0 (informational only) — it must never hard-fail CI on ordinary line-count drift, only surface it as a warning above the configured threshold (500 lines, matching this repo's own existing "±500줄 이상 변경 시 CODE-MAP 갱신" convention).
P669-Q2: `_context/CODE-MAP.md`'s §1 file-size table must match `wc -l` on each listed file within the ±500-line threshold at any given time — run `node scripts/ci-doc-currency-check.mjs` to check, and treat a reported drift as a signal to refresh the table (not to silence the check).
P669-Q3: `_context/CODE-MAP.md`'s own frontmatter/intro must continue to disclose that only §1 (file-size table) was re-verified in the WO-8/P669 pass — not the detailed per-function line ranges in §2 onward — until a dedicated full rescan happens; a reader must not assume every line reference in the document is current just because the top-level table is.
P669-Q4: `_context/FABLE-LIVE-AUDIT-2026-07-04.md`'s added status line must not claim P4 (FMP key plan error) is resolved by code — it is explicitly an operator-action item the user chose to leave as-is (closed-by-decision, not closed-by-fix).

P671-Q1: F&G and any other multi-page current metric must resolve through `window.AIO.getCanonicalMetric()` (or its documented successor) with explicit `status`, `asOf`/`fetchedAt`, `freshness`, and `allowedUse`; no current consumer may read `_lastFG`/snapshot through a truthy fallback chain.

P671-Q2: A delayed/server or snapshot F&G value may be visible with a localized reference/delay badge, but must be `allowedUse:false` and must not affect `computeTradingScore()`/`computeExecutionWindow()` as a trading input; missing/stale current evidence must be neutralized or blocked.

P671-Q3: The canonical selector regression suite must retain live precedence, numeric zero preservation, snapshot-reference isolation, and stale-current blocking tests (T901–T904), plus the runtime-contract static checks.

P671-Q4: PC/desktop route validation must verify that all repeated F&G sinks (home, signal, sentiment, briefing, risk/pulse overlays) agree on the same canonical value and source state; any visible split is a release blocker.

P672-Q1: `AIO_EVENT_FRESHNESS_REGISTRY` entries used in decision copy must declare a claim-age window and resolve through `AIO.getEventClaimState()`; expired FOMC/geopolitical/issuer narratives must render as historical/reference-only.

P672-Q2: `_aioDefaultDecision()` must block current action/decision when the trading-critical missing-input quorum reaches 3+, retain the numeric diagnostic score for transparency, and expose `decisionBlocked`; tactical/page overlays must not overwrite the block.

P672-Q3: T905/T906 and runtime-contract H3-B/C checks must remain in the release gate, alongside headless route execution.
P673-Q1: At 1024×768, sentiment and macro canvases must not extend beyond their grid parent; the desktop audit must report zero accidental clipped canvases.
P673-Q2: A deliberately wide screener table may overflow only inside `.aio-table-scroll`, which must expose `role="region"`, `tabindex="0"`, and a localized label.
P673-Q3: `AIO.normalizeExternalSourceState()` fixtures must keep success→decision, partial→reference-only, and timeout/malformed/unavailable→none policies stable (T907–T910).
P673-Q4: Telegram/API failures must produce an explicit user-facing state row; a blank `tg-feed-*` slot is a release blocker (T911 + runtime H3-E).

P674-Q1: Chart.js, DOMPurify, and Lightweight Charts must not use ordered `defer` ahead of local `aio-*` modules; CDN loss must leave route boot/reload available (T912).
P674-Q2: H3-F PC journey must cover screener tab/filter/search, KR supply/theme interactions, guide search, browser back, and hash-route reload with no page error.
P674-Q3: H3-G must keep `getPageContractAudit()` at 22 routes with zero missing contract categories and `getDataLineageAudit()` at broken/orphan sink 0 (T913); known breadth/manual tiers remain explicit, not silently promoted.

P675-Q1: `initBreadthPage()` must guard missing and partial Chart fallbacks (`registry`, `plugins`, and `register`) before chart registration; the CDN-blocked breadth route must produce no page error.
P675-Q2: H3-G element lineage inventory must expose all 13 fields listed in the handoff, with incomplete 0 and orphan sinks 0; static content remains explicit reference-only.
P675-Q3: Critical-10 Chromium at 1024×768 must keep the decision header/conclusion/evidence/action in the first human surface and keep developer/debug surfaces hidden; status badges and reference archives must not be misclassified.
P675-Q4: Automated H3-I checks must find no nameless or unfocusable controls, positive tabindex, or unnamed canvases during Tab traversal; NVDA/manual screen-reader evidence remains separately marked unverified.
P675-Q5: T914–T918, `ci-runtime-contract-check.mjs`, and the blocking `human-surface` CI job must remain wired.

P676-Q1: `ci-accessibility-matrix-check.mjs` must cover all 22 routes at the mobile viewport and report zero computed fonts under 10px, nameless controls, unnamed selects/canvases, and positive tabindex values; small-target findings remain explicitly observational.
P676-Q2: `ci-viewport-matrix-check.mjs` FULL_INIT must cover 22 routes × 4 viewports (88/88), with zero overflow and runtime errors; the offline TG proxy failure is allowed only through the exact expected-log contract.
P676-Q3: the final Chromium headless suite must remain 992/992 PASS, including T919–T931 for AI errors, content truth, route IA, declutter, typed provenance, and architecture governance.
P676-Q4: `ci-portfolio-vault-e2e.mjs` must keep PFE2-01–PFE2-08 green for encrypted storage, lock/reload, migration, explicit plaintext opt-out, and input boundaries.
P676-Q5: typed provenance must preserve one evidence ID across UI/score/AI projections, distinguish missing from neutral, and weaken future/stale/manual/seed evidence to non-decision action strength; decision surfaces must expose `data-evidence-id` and `data-operational-use`.
P676-Q6: score/factor research artifacts must retain their reduced-scope status and PIT/delisted/cost/adaptive-weight caveats until the full validation gate is actually run.
P676-Q7: Firefox/WebKit, NVDA/manual screen-reader, live GitHub Pages, and Worker deployment remain separate external/human gates and must not be marked PASS from Chromium/local evidence alone.

P677-Q1: T830 must distinguish `_isFallback=true` reference snapshots from promoted live snapshots: fallback dates must be valid and no newer than the dynamic digest, while only promoted snapshots are subject to the seven-day cross-source parity window; the audit must expose fallback state and date delta.

## Institutional public-release audit — 2026-07-12 handoff

- [x] **Local release revision contract (WP-8)**: CI derives one deterministic local revision from app/version, SW build, data/screener hashes, Worker source hash, and the Pages artifact allowlist; live deployment, provider rights, and human/legal certification remain separate gates.

These are blocking acceptance checks derived from `_context/INSTITUTIONAL-DATA-READINESS-HANDOFF-2026-07-12.md`. They remain FAIL until implemented as executable CI/runtime tests; documentation or a green shape audit is not sufficient.

- [ ] **IRG-1 repeated metric parity**: after a five-second settle, every visible F&G/VIX/breadth/score/regime sink on all 22 routes has the same evidence ID, value, `asOf`, `sourceKind`, and `allowedUse`. Baseline failure to reproduce first: canonical/home F&G 49 while signal/sentiment/briefing show snapshot 31. This is the literal executable closure of P671-Q4.
- [ ] **IRG-2 quote observation contract**: all 77 server quote rows carry true `observedAt`, `marketState`, exchange timezone, delay metadata, and source; receipt/fetch time must never substitute for observation time.
- [ ] **IRG-3 screener universe truth**: `universe`, `fetch-ok`, `ranked`, and `displayed` counts are either equal or separately labelled. Baseline failure: artifact 870/846 while UI displays 873.
- [ ] **IRG-4 page semantic completeness**: all 22 routes declare unique required evidence producers, minimum coverage, allowed action strength, and failure copy. `theme-detail` aliasing `page-themes` does not count as an independently complete page.
- [ ] **IRG-5 no hidden decision missingness**: exact placeholder values in any field used by rank/decision/action block the strong action surface. Baselines: screener 4,254 exact placeholders and KR themes 212 after settle.
- [ ] **IRG-6 semantic AI validator**: generated analysis may publish only if every numeric token, metric label, unit, sign, and observation time resolves to input evidence. Baseline failures: F&G 49 relabelled as VIX 49 and NFP 57 thousand rendered as 570,000.
- [ ] **IRG-7 operational failure matrix**: each external source has real success/partial/timeout/malformed fixtures, source-specific SLO, quarantine, and user-facing state. The current all-network-aborted browser fixture alone is insufficient.
- [ ] **IRG-8 independent data/right review**: production-source reproducibility, independent-vendor/official-source divergence, corporate actions, redistribution entitlement, and vendor termination plan are approved before PUBLIC/commercial use.

## AI institutional public-release gate — 2026-07-12

Derived from `_context/AI-CHAT-INSTITUTIONAL-AUDIT-2026-07-12.md`. All items are blocking until executable; prompt text, badges, or function-presence audits do not count.

- [ ] **AIG-1 route↔context bidirectional coverage**: all 22 routes resolve to an explicit supported/unsupported AI contract, every `_aiCtxMap` target exists, and every supported path reaches the common response validator. Baseline failure: `briefing → briefing` while `CHAT_CONTEXTS['briefing']` is absent.
- [ ] **AIG-2 typed semantic claims**: F&G↔VIX label swap, NFP K scale 10x, bp↔%, sign inversion, FX pair inversion, ticker-number attribution, and as-of mismatch fixtures are blocked before render.
- [ ] **AIG-3 evidence-bound citations**: a nearby `Source: Yahoo/FRED` string alone cannot pass. Every current-sensitive claim must carry an allowlisted evidence ID whose entity/metric/value/unit/asOf match the claim.
- [ ] **AIG-4 one response pipeline**: per-page, unified, retry-success, translation, briefing, and server `marketAnalysis` record the same validator/policy version and cannot bypass block/fallback behavior.
- [ ] **AIG-5 prompt-injection boundary**: news, Telegram, filings, web-search text, user research, and imported notes are structured as untrusted data; direct/indirect injection and system-prompt/data-exfiltration red-team fixtures produce zero policy override.
- [ ] **AIG-6 action permission**: missing/stale/reference evidence or incomplete suitability prevents personalized buy/sell/target/stop/position-size output. Disclaimer text is not a substitute for this code gate.
- [ ] **AIG-7 privacy**: portfolio fields sent to an LLM are previewed, allowlisted/redacted, and explicitly consented at send time; chat-history storage is opt-in/off, encrypted where sensitive, and fully deletable.
- [ ] **AIG-8 prompt/cost budget**: actual API input/cache-write/cache-read/output/search usage is measured. P95 prompt tokens obey a declared per-intent budget and displayed estimates differ from billed usage by no more than 10%. Baseline system-only average is ~82,669 chars/~20.7K tokens versus the UI's 2.5K input assumption.
- [ ] **AIG-9 backend parity**: personal-key and Worker modes disclose and meet the same answer contract or visibly declare a reduced mode. Baseline mismatch: client requests 12K/16K output while Worker defaults to 1.5K.
- [ ] **AIG-10 golden A/B**: the frozen 22-route corpus covers current facts, mechanism, comparison, action, stale/conflict, injection, and multi-turn correction. The AIO variant must beat the same general LLM on predeclared grounding/currentness/action-safety axes with P0 semantic errors equal to zero.
- [ ] **AIG-11 live operations**: deployed Worker revision/config/KV, availability, TTFB/total latency, completion rate, retries, per-user/total cost, quota races, and kill/rollback are observed against SLO; local handler tests alone are insufficient.
- [ ] **AIG-12 honest public claims**: “기관급”, “검증됨”, “실시간”, and “일반 LLM보다 우수” appear only where the corresponding measured gate passes; otherwise the surface says BETA/research aid and identifies unverified limits.

### AI page-topic deep gate — 2026-07-12 second pass

- [ ] **AIPG-1 bidirectional route contract**: all 22 routes declare AI support explicitly; every `_aiCtxMap` target exists in `CHAT_CONTEXTS`, has usable input/chips, and reaches the shared validator. Baseline: `briefing` maps to a missing context and is disabled.
- [ ] **AIPG-2 selected-entity binding**: ticker, theme-detail, portfolio, and options answers carry the exact active entity ID and must abstain when it is absent. Baseline: the dedicated dynamic `theme-detail` context is overwritten by the generic `themes` object, making both runtime prompts identical.
- [ ] **AIPG-3 screener coverage disclosure**: every screener answer states universe/fetch-ok/ranked/displayed counts and factor availability; a 12-row fallback sample must never be described as full-universe ranking.
- [ ] **AIPG-4 options contract gate**: no expiry/strike/debit-credit/max-profit-loss/breakeven/Greeks recommendation is permitted without a verified chain snapshot containing bid/ask, OI, volume, IV, Greeks, multiplier, expiry, underlying quote, source, and as-of.
- [ ] **AIPG-5 portfolio suitability**: personalized sizing, stop, liquidation, leverage, or allocation output requires declared objective, horizon, liquidity need, tax/jurisdiction constraints, leverage, and loss tolerance; otherwise only educational scenario analysis is allowed.
- [ ] **AIPG-6 per-page evidence contract**: each supported route declares required/optional evidence, freshness budget, forbidden claims, action permission, output schema, fallback copy, and validator set as an AI projection of the existing page contract—not a parallel registry.
- [ ] **AIPG-7 golden page matrix**: 21 supported pages × current fact/mechanism/action/missing/source-conflict/multiturn-correction × novice/expert × normal/degraded fixtures run in CI/canary. P0 semantic errors must be zero.
- [ ] **AIPG-8 page/UI/AI parity**: the visible page conclusion, chart annotation, AI claim, and action copy resolve to the same evidence IDs, as-of times, and source states after settle.
- [ ] **AIPG-9 prompt specialization budget**: page-specific required evidence/policy stays within a declared token budget; unrelated historical examples and generic action rules are retrieved only when relevant rather than repeated in every 64K–107K-character context.
- [ ] **AIPG-10 user-facing chips**: every supported page exposes four questions that are answerable from currently available data. Baseline missing unified chips: `options`; `briefing` has neither context nor chips.

### AI extended institutional gate — 2026-07-13 third pass

Derived from AI-X01~10 and WP-AI11~20 in `_context/AI-CHAT-INSTITUTIONAL-AUDIT-2026-07-12.md`. These are PUBLIC-blocking. A prompt instruction or policy sentence does not count as enforcement.

- [ ] **AIXG-1 conversation lifecycle**: route/entity change, stream overlap, retry/cancel/timeout, context trim, correction, and multi-tab late-response fixtures produce zero stale-entity claims and zero wrong-turn renders.
- [ ] **AIXG-2 deterministic financial compute**: options payoff/Greeks, portfolio risk, FX, return, sizing, fee/tax/slippage values come only from approved versioned calculators with exact input evidence IDs; model-created decision numbers are zero.
- [ ] **AIXG-3 retrieval quality and poisoning**: route-level recall@k/precision@k and temporal/source-tier budgets pass; retracted, superseded, poisoned, unauthorized, or malicious-instruction documents never support a current action claim.
- [ ] **AIXG-4 financial conduct**: MNPI, insider information, manipulation, pump-and-dump, wash trading, front-running, rumor amplification, sanctions/restricted securities, and jurisdictional advice fixtures produce zero executable prohibited guidance.
- [ ] **AIXG-5 model risk and replay**: each sampled answer records app/data/Worker/model/prompt/retriever/validator/calculator revisions and evidence snapshot hash; approved production samples can be replayed and rolled back.
- [ ] **AIXG-6 cache isolation and idempotency**: two-user/two-tab retry/cancel/late-response tests produce zero cross-user data leakage, duplicate billing/storage, stale cache promotion, and partial-stream completion misclassification.
- [ ] **AIXG-7 coverage bias**: recommendation and answer coverage is reported by universe/region/sector/cap/liquidity/language/source availability; missing is never silently converted to neutral or promoted into a recommendation.
- [ ] **AIXG-8 human chat certification**: keyboard, streaming live-region, focus return, citation discovery, mobile zoom, NVDA/VoiceOver, novice and expert tasks meet declared completion and misunderstanding thresholds.
- [ ] **AIXG-9 non-agentic capability boundary**: the current product has no model-triggered order, message, upload, account, or external-write path; any future mutation capability requires explicit confirmation, allowlist, dry-run, and audit log.
- [ ] **AIXG-10 rights/retention/region**: source data, provider processing, chat retention/training, generated summaries, copyright, redistribution, commercial display, region, deletion, and termination-plan decisions are approved and match user notices.

### Dual-handoff execution gate — 2026-07-13

- [ ] **DHG-1 one Evidence Store**: data and AI work packets write/read the same typed evidence and calculation schemas; no parallel AI-only truth registry is introduced.
- [ ] **DHG-2 one page contract**: `PageAIContract` is a projection of `AIO_PAGE_CONTRACTS`, not a second page registry.
- [ ] **DHG-3 one response validator**: server marketAnalysis, briefing, translation, per-page, unified, and retry paths share one validator/publish policy.
- [ ] **DHG-4 one release manifest**: app/data/Worker/model/prompt/retriever/validator/calculator revisions are tied to one request and live release manifest.
- [ ] **DHG-5 explicit status**: every packet reports `DESIGNED`, `IMPLEMENTED_LOCAL`, `VERIFIED_LOCAL`, or `VERIFIED_LIVE`; documentation presence alone is never marked complete.

### 3차 라이브 데이터·현재시장 전수 게이트 — v52.91 / P706

- [x] **LIVE3-01 비밀정보**: 저장된 API 키 실값이 password input DOM/accessibility tree에 복원되지 않고 고정 마스크만 표시된다.
- [x] **LIVE3-02 부팅**: 초기 snapshot date 렌더가 `DATA_SNAPSHOT` TDZ를 만들지 않는다.
- [x] **LIVE3-03 판단 입력**: 관측 근거가 오래된 breadth/PCR/AAII는 전술 점수·레짐·실행창에 현재값으로 들어가지 않는다.
- [x] **LIVE3-04 시장 브리핑**: S&P 500은 SPY가 아니라 `^GSPC`의 canonical `price/pct`로 표시된다.
- [x] **LIVE3-05 한국 수급**: 누락값을 0으로 바꾸지 않으며 실패 시 숫자·막대·순매수/순매도 라벨을 함께 중립화한다.
- [x] **LIVE3-06 소스 충돌**: 한국 지수의 서버/Naver 차이가 0.75%를 넘으면 후발 Naver 값이 서버 확정치를 덮지 않는다.
- [x] **LIVE3-07 수집 이력**: Telegram `attemptedAt`, `lastSuccessfulAt`, `collectionStatus`가 분리되고 전 채널 실패 시 성공시각이 갱신되지 않는다.
- [x] **LIVE3-08 로직/문구**: 기대값 예시는 +0.4R이며 전술 점수는 예측·매수 신호가 아닌 환경 설명으로 표시된다.
- [x] **LIVE3-09 시세 현재성**: producer와 client가 `regularMarketTime`/`observedAt`, `marketState`, 거래소 시간대를 보존한다.
- [x] **LIVE3-10 F&G 우선순위**: client 직결/proxy 실패가 이미 적용된 최신 서버 F&G를 오래된 정적 seed로 덮어쓰지 않는다.
- [x] **LIVE3-11 시장 대조**: 2026-07-14 미국·한국 지수, VIX, Fed/BLS/BEA/BOK 최신 수치를 외부 자료와 대조했다.
- [ ] **LIVE3-X 외부 복구 필요**: Telegram 3채널, 한국 투자자 수급, FMP, PCR/AAII의 정상 자동수집 성공 증거는 아직 없다. breadth는 847/870 일봉 기반 자동 계산으로 복구됐지만 공개 배포 후 VERIFIED_LIVE는 별도 필요하다. 실패를 성공으로 표시하지 않는 상태가 합격 조건이다.

### 외부 의존·산출물 보존 게이트 — v52.92 / P707

- [x] **LIVE3-12 last-known-good**: 핵심 시세 커버리지 50% 미만이면 첫 `data.json` 쓰기 전에 실패한다.
- [x] **LIVE3-13 독립 갱신**: `SCREENER_ONLY=1`은 핵심 data/history를 건드리지 않고 screener만 갱신한다.
- [x] **LIVE3-14 브레드쓰 증거**: all/us/kr별 universe, eligible, coveragePct, observedAt, SMA window별 eligible을 기록한다.
- [x] **LIVE3-15 팩터 사용범위**: `rankingContract.tradingSignal=false`, predictive validation 미확립, live/backtest parity false를 유지한다.
- [x] **LIVE3-16 외부 대체 레지스트리**: 각 외부 의존에 현재 경로·대체 공급자·권리·cadence·구현 상태가 있으며 API 존재를 연결 완료로 표시하지 않는다.

### 무료 공식 소스·독립 publish 게이트 — v52.93 / P708

- [x] **LIVE3-17 독립 workflow**: 6시간 screener workflow가 core `data.json/history.json`과 분리되고 `SCREENER_ONLY=1`, `SCREENER_ENRICH=1`로 실행된다.
- [x] **LIVE3-18 행 lineage**: 모든 새 screener row가 자기 OHLCV의 `observedAt`, `source`, `sourceKind`, `allowedUse`를 가진다.
- [x] **LIVE3-19 semantic publish**: `validate-screener-artifact.mjs`가 80% 가격/시장폭 커버리지, 행 수 일치, 관측시각, research-only 계약을 통과하기 전 publish를 막는다.
- [x] **LIVE3-20 Cboe 공식 지연값**: Cboe Daily Market Statistics의 total/equity/index P/C와 selectedDate를 함께 파싱하며 `delayed`로만 사용한다. 실패한 CDN/proxy는 공식 서버값을 snapshot으로 덮지 않는다.
- [x] **LIVE3-21 SEC 무료 누적**: companyfacts는 bounded batch, annual form/period/accession provenance, atomic artifact를 사용한다. `SEC_USER_AGENT`가 없으면 operator configuration required로 종료한다.
- [x] **LIVE3-22 재무 커버리지 차단**: SEC/FMP 재무 커버리지가 미국 유니버스 80% 미만이면 value/quality를 활성화하지 않는다.
- [x] **LIVE3-23 신규 지식 문서 게이트**: knowledge lint는 아직 stage하지 않은 non-ignored `_context/*.md`도 `INDEX.md`와 `_context/CLAUDE.md` 양쪽 문서 표에 존재하는지 검사한다.
- [ ] **LIVE3-X2 운영자/외부**: 저장소 변수 `SEC_USER_AGENT`, OpenDART/ECOS/KOSIS 무료 키, KRX 승인·제3자 제공 조건, live Pages 재실행은 별도 필요하다.

### 발행 계약 무결성 게이트 — v53.5 / P719

- [x] **LIVE3-24 발행 write 전수**: 공개 아티팩트 발행 계약(quotes 스트립 등)을 바꿀 때 같은 출력 경로(OUT)에 쓰는 write 사이트를 전수 grep으로 확인한다 — P719는 meta 후기록 재기록이 스트립을 덮어쓴 사례.
- [x] **LIVE3-25 read-back 단언**: fetch-data.mjs는 마지막 발행본을 디스크에서 다시 읽어 `quotes===[]`·`meta.quotesPublished===false`를 단언하며 위반 시 커밋 전에 fail한다.
- [ ] **LIVE3-26 배포 후 라이브 재확인**: v53.5 배포 후 다음 refresh-data 크론 산출물에서 data.json 계약(quotes=[]/quotesPublished:false)을 curl로 재확인한다. (telegram summary-only·screener price-부재는 2026-07-17 라이브 확인 완료)

### ticker 종목 개요 게이트 — v53.6 / P723·P724

- [x] **TKOV-01 실데이터 렌더**: ticker 종목 개요(가격 정보·관련 테마·팩터 프로파일·TV 대형 차트)가 NVDA 기준 로컬 실브라우저에서 실데이터로 채워진다(수익률=SCREENER_DB 동일 값, 테마 칩=THEME_MAP 역조회, 레이더=factorScores). 결측 필드는 '—'+사유 title.
- [x] **TKOV-02 KR 미지원 명시**: .KS/.KQ 심볼은 TV iframe을 로드하지 않고 P610 사유 안내를 표시한다.
- [x] **TKOV-03 _liveData 확장 필드**: applyLiveQuotes가 52주/거래량 7필드를 수신 시 보존한다(P724). 새 UI가 _liveData 비표준 필드를 읽기 전 쓰기 지점을 grep으로 실증한다.
- [ ] **TKOV-04 라이브 확인 잔여**: 배포 후 라이브에서 ① 52주 범위가 실제 quote 수신 시 채워지는지 ② TradingView iframe 실렌더(샌드박스에서는 iframe 생성만 확인됨) ③ fundamental 가격 포지션 카드가 _liveData 1순위로 채워지는지 재확인.

### 한국장 통합 게이트 — v53.7 / P725

- [x] **KRIN-01 라우트 퇴역**: kr-home/kr-supply/kr-themes/kr-macro/kr-technical 5라우트가 REMOVED로 분류되고 구 해시가 macro/themes/technical로 리다이렉트된다(실브라우저 확인).
- [x] **KRIN-02 통합 섹션 렌더**: themes(테마 카드 28+progressive)·macro(핵심지수/전일종가/BOK/CPI/신선도 배지)·technical(캔들 캔버스/건강점수 슬롯)의 `kr-integrated-*` 섹션이 로컬 실브라우저에서 실데이터 렌더, pageerror 0.
- [x] **KRIN-03 계약 sink 보존**: P636/P721 KR 전일종가·변화폭 sink(`data-live-prev-close`/`data-live-kr-change`)가 macro 통합 섹션에 보존되고 structural 게이트가 검증한다.
- [ ] **KRIN-04 라이브 확인 잔여**: 배포 후 라이브에서 ① 구 해시 리다이렉트 ② KR 테마 카드 시세 커버리지(통합 후 themes 라우트 fetch로 변경) ③ Naver 캔들 차트 실로드 ④ tg-feed-kr-macro/technical 피드 주입 재확인.
