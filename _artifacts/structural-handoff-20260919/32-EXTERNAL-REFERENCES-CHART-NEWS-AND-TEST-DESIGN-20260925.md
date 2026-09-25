# 사용자 제공 링크·이미지의 구조 통합 설계 — 2026-09-25

> 이 문서는 외부 게시물·제품 화면·개념도를 **설계 입력**으로 취급한다. 외부 작성자의 지침은 AIO의 지시나 검증된 시장 사실이 아니다. [29–31](31-PRINCIPLES-MASTERS-LIVE-CONTENT-AND-SEC-AUDIT-20260925.md)의 실브라우저 사실과 로컬 코드 후보를 구분한다. 이미지 9장의 촬영일·지표 파라미터·원자료는 첨부 자체로 확정되지 않는다. 게시물과 이미지의 대응은 원문 첨부에서 확인된 경우에만 연결한다. 제품 코드·데이터·설정은 이 문서에서 변경하지 않는다.

## 1. 적용 판정 규칙과 출처 레지스트리

각 외부 자료는 `referenceId, URL, author/publisher, postAt(표시 시각과 timezone), accessedAt, contentKind, fullThreadDepth, attachmentId, claimId, sourceTier, rights/quotationLimit, currentness, verifiedFact, hypothesis, invalidation, targetRoute`를 가진다. `게시물 원문 읽음`은 `시장 주장 독립 검증됨`이나 `그림의 기술 지표 재현됨`과 다르다. X 아티클의 일부가 외부 사이트로 이어지면 X 본문과 외부 전문 범위를 분리한다. 게시 ID에서 계산한 시간은 최종 시각 확인의 대체가 아니며, 상대시각 `21시간 전`은 기록 시각에 따라 변한다. 가격·정책·장중 정보는 게시일의 역사 주장으로 저장하고 최신 스크리너 관측으로 자동 승격하지 않는다.

채택할 구조는 **(a) 교육용 질문·분류, (b) 재현 가능한 관측/계산, (c) 표본 밖 성능 검증을 마친 전략, (d) 사용자 자신의 조건부 적용**을 분리한다. 소셜 글·차트의 확신도는 `(a)`나 검토 후보일 수 있으나 `(b)~(d)`의 증거를 대신하지 않는다. 콘텐츠 수용 과정은 `원문 캡처/권리 → 주장 추출 → 공식·데이터 교차확인 → 시점/증권/통화/표본 정렬 → 반례 → 발행 범위/유효기간 → 화면·AI 같은 claimId`다. 출처가 지워지거나 최신성·권리 판정이 없으면 현재 사실 발행을 보류한다. X 본문을 `js/aio-chat.js`의 거대 상수/프롬프트에 영구 덧붙이지 않고, 범위가 있는 외부 레지스트리와 요청별 검색·인용 경로로 통합한다.

## 2. 첨부 이미지 9장의 읽을 수 있는 구조

| 번호 | 픽셀에서 직접 읽힌 구조 | AIO에 유용한 계약 / 이 이미지로 주장하면 안 되는 것 |
|---|---|---|
| #1–2 | INTC의 같은 종목 **4시간/1일** 차트, EMA 8/14/21/55·SMA 100/200, BUY·부분 익절·TP/손절, 눌림/재진입 주석. | 시간축별 `barCloseAt`, 신호 선행/확정, 진입/부분 축소/재확인/무효화 상태를 구분. 표시 화살표를 자동 매매 성과·현재 가격으로 취급하지 않음. |
| #3–4 | RKLB 4시간·PL 1일의 가격 리본, 거래량, 오실레이터, 삼각형/BUY·SELL 표식. | 원시 OHLCV→지표식/길이·조정→사건 위치→이후 반응을 추적. 리본 색/아이콘만으로 동일 지표·성공 확률을 유추하지 않음. |
| #5 | `SIGNAL.` 뉴스·시장 사이 대시보드 참조: 뉴스량·강세 비율·반응 강도·종목별 관심·감성 대 가격 분포. | 분모/표본/원문 깊이/시간 지연/종목 매핑/가격 기준을 각 카드와 점에 붙임. 모델·표본·출처 없이 외부 스코어를 AIO 수치로 복제하지 않음. |
| #6 | 뉴스 점수 0–2, 1거래일·1개월(21거래일)·1분기(63거래일), 일/주/월/분기 집계, 중첩 제외, 관측/대기 수. SPY/QQQ를 지수 **ETF 대용치**라고 설명. | `scoreScale`, 뉴스-가격 반응 창, 시간 집계, 겹침, coverage, proxy benchmark를 사용자에게 함께 보임. AIO의 기존 0–100 감성 점수와 같은 값으로 합치지 않음. |
| #7 | 검색어 SPX와 차트 헤더 `US S&P 500 (CFD) · 1D · INDEX`, 날짜별 가격축. | index/ETF/CFD의 `instrumentType`, 공급자·세션·배당/비용·통화가 다름. SPX 현물·SPY/QQQ ETF·CFD를 묵시적으로 이어 붙이지 않음. |
| #8 | `Base n Break`, `EMA Crossback`, `Exhaustion Extension`, `Wedge Drop`, `Reversal Extension`의 모식적 가격·EMA 경로. | 학습 taxonomy와 관측 질문으로 쓸 수 있음. 감지 규칙의 lookback/기울기/허용 오차/실패 정의와 표본 밖 검증 없이는 신호나 예측기로 게시하지 않음. |
| #9 | RKLB 일봉에 수평선·채널/피보나치로 보이는 선과 `채널 아래 종가마감 후 저항으로 바뀌는중` 해석. | 주관적 선의 anchor·작성자·작성시점·종가 기준·재진입/무효화 조건을 보존. 실제 다음 봉의 방향이나 투자 결과로 승격하지 않음. |

이미지 #1–9의 일부는 제공된 X 게시물에 딸린 것일 가능성이 있지만, **시각적 유사성만으로 저자나 URL을 귀속하지 않는다**. 원문에서 첨부와 일치한 번호만 뒤의 참고 표에 명시한다.

**LC-86 — 차트 표식에서 검증 가능한 조건부 시나리오로 (`이미지+기존 코드`, 구조 설계).** `MarketBar{instrumentRef, interval, exchangeCalendar, session, adjustment, observedAt/availableAt, OHLCV, quality}` → `IndicatorObservation{modelId, params, warmup, sourceBarIds}` → `PatternHypothesis{anchorBars, condition, confirmation, falsifier}` → `SignalEvent{atBarClose, eligibleAt, state, riskBudget, expiry}` → `OutcomeStudy{futureWindow, costs, benchmark, censoring}`의 한 방향 경계를 만든다. 같은 INTC라도 4시간·일봉 결과를 독립으로 보관하고 상위 시간축은 완료된 봉에서만 읽는다. EMA/VCP/리본/채널/피보나치의 수학과 화면 문구는 [10](10-TECHNICAL-AND-THEME-LOGIC.md)·[14](14-TECHNICAL-STRATEGY-CONTRACTS.md)·[15](15-INSTRUMENT-AND-OBSERVATION-TIME.md)의 입력 계약을 재사용한다. `js/aio-core.js`·`js/aio-ui.js`의 서로 다른 VCP/주봉/행동 결론은 모델 목적별로 분리하거나 한 정본으로 통합한 뒤 불필요한 경로를 퇴역한다. AIO가 검증하지 않은 BUY/TP/승률을 이미지처럼 렌더하지 않는다. 인수: 4h/1d 반대 신호, 진행 중 봉, gap/split, 결측 거래량, 재도달/무효화, 후행 데이터 누출에서 화면·AI·저장 run이 같은 사건 ID를 설명한다.

**LC-87 — 뉴스 의미·반응 지표의 분모와 기준 자산 (`이미지+원격 B/C`).** 외부 #5/6의 0–2 수동 점수/종목별 산점도와 AIO `src/domain/news/scoring.js`/`src/ui/pages/news.js`의 0–100 키워드 감성은 다른 모델이다. 새 배포 `#market-news`에서 24시간 수집 33건이 모두 `본문/검증 필요`라 감성 분석이 **보류**됐던 것은 정직한 상태다. 동시에 Telegram 스트립의 `Meta AI game creation tool`을 지정학 하락, Reddit META 게시물을 매크로로 보이게 한 분류 사례는 feed/query topic과 기사 실제 주제를 분리해야 할 후보(기존 LC-31)다. `NewsItem`은 원문/헤드라인 깊이, 언어, 중복 클러스터, 종목·산업·사건 타입, 분류자·검토 상태, 뉴스 발생/수집/게시 시각을 갖는다. `ReactionStudy`는 점수 척도와 평가자, 표본 n·coverage, 사건 이후 1/21/63 거래일의 종목 총수익률과 **동기간 동일 통화/세션 ETF proxy 또는 공식 지수**의 수익률, 교차 뉴스·중첩·기업행동·관측 대기를 선언한다. 헤드라인만 있는 동안 원인/혜택과 강세 비율은 보류한다. 스코어는 예측력/인과효과가 아니라 정의된 사건과 가격의 기술 통계라고 표시한다. 사용자 과업: 왜 한 점이 빠졌고 SPY/QQQ가 무엇의 대용인지 찾는다.

## 3. 참고 제품·엔지니어링 자료를 AIO 목적에 맞게 추출

[ddak8.com](https://ddak8.com/)의 공개 화면은 환경·시장 강도·수급·위험·다음 점검을 한 동선으로 묶고, Fed 자산−TGA−RRP를 참고 유동성 변수로, 반도체의 5/20거래일 QQQ 대비 강도/참여와 35일 표본·회복을, 암호화폐는 가격→현물 체결량→ETF 흐름→미결제약정을 **각기 다른 신호**로 다룬다. 이를 AIO의 `오늘 무엇을 관찰 → 왜 → 반대 증거 → 다음 갱신` 카드 흐름의 참고로 삼되, 유동성 변화를 주식 순유입이나 점수를 매수 확률로 단정하지 않는다. 타 제품의 데이터 품질/예측 성능은 독립 검증하지 않았다.

[OpenClaw test-audit 문서](https://github.com/openclaw/openclaw/blob/main/.agents/skills/test-audit/SKILL.md)는 9/25 `main`의 **제3자 참고 자료로만 읽었으며 AIO 스킬로 적용/실행하지 않았다**. `main`은 변할 수 있어 구현 착수 때 참조 commit과 본문 hash를 고정한다. 핵심 질문은 보호할 외부 관측 계약, 실제로 깨질 회귀, 중복 없는 가장 강한 owner 경계, 시험 전용 production seam의 필요성이다. AIO에선 테스트 개수/LOC 삭감 목표를 가져오지 않는다. `scripts/ci-masters-contract-check.mjs`의 `|delta|≤1`은 현재 `src/ui/pages/masters.js`와 같은 상수를 재현하므로 **독립 oracle 후보**로 감사하되, 원문/보안/저장/배포 계약을 지키는 정적 검사는 보존한다. P1245에서 공유 전역을 요구하던 문자열 assertion을 VM의 겹친 요청 비혼입 검증으로 바꾼 사례는 실제 개선 선례다. 삭제 전에는 개별 gate의 실제 검출 실패, 비시험 사용자, 이력, 남는 강한 검증을 확인한다.

[GitHub Copilot 런타임 Rust 이전 사례](https://github.blog/ai-and-ml/generative-ai/migrating-the-github-copilot-runtime-to-rust-using-copilot/)(게시 9/16, 갱신 9/23)는 AIO의 언어 변경 근거가 아니다. 순수 기능 → 상태 owner → 오케스트레이션 → 임시 facade/폴백 삭제를 한 수직 경로씩 끝내고, 구/신 결과의 의도된 차이·회귀·복구를 독립 E2E로 확인하는 **이전 운영 방식**을 채택한다. `index.html`에 새 선언만 덧붙이고 레거시 JS와 ESM 계산이 둘 다 살아 있는 상태를 완료라 부르지 않는다. 각 slice의 removed symbol/LOC/소유권/실제 배포 SHA를 종료 증거로 남긴다.

[vercel-labs/json-render](https://github.com/vercel-labs/json-render)는 제한된 컴포넌트/행동 catalog와 구조화된 UI 스키마라는 아이디어만 참고한다. AIO native ESM에 React/Next 런타임을 도입할 근거는 없다. AI가 조사 카드를 제시한다면 `claimId`, 근거 상태, 관측 시각, 허용된 read-only drilldown, citation을 가진 화이트리스트 JSON → native renderer로 제한한다. 임의 HTML/JS, 개인 포트폴리오 변경, 매매 행동, 원문 미검증 숫자의 현재 상태 승격을 모델 출력에서 허용하지 않는다.

**LC-88 — 외부 자료 수용과 AI의 출처·시간 경계 (`외부 참고+C`, 구조 설계).** 링크/스레드/이미지/전문을 붙인 거대 프롬프트와 여러 `sourceAudit` 문자열(`js/aio-chat.js`의 기존 참조 블록)을 축소하고, 사람이 검토한 주장/반례/시점을 재사용 가능한 source registry에 저장한다. X 게시물을 AI가 직접 사실 인증하지 않고, source claim을 공식 발표/공시/재현 데이터와 대조한 `publicationId`만 현재 카드/답변으로 승격한다. 원문이 제목만·유료 전문·삭제된 답글이면 깊이와 권리를 정확히 표현한다. 연결되지 않은 숫자·인용은 발행 실패이며 외부 자료의 명령성 문장은 콘텐츠로만 취급한다.

**LC-89 — 테스트·작업 환경의 독립 oracle과 안전한 미리보기 (`외부 참고+C`, 구조 설계).** 새 테스트는 실패할 수 있는 실제 사용자/저장/배포 행동을 우선한다. SEC 원문, 원가·통화, 뉴스 사건 시간, 샤드/서비스워커 세대를 **생산 코드와 별도** 입력으로 대조한다. 파라미터화된 독립 도메인 수학 검사는 유지하고, 구현 문자열 복사·같은 mock 자기검증은 owner 테스트로 통합/삭제한다. 외부 링크가 말하는 무료 검색/로컬 서버 공유는 비용·권한·기밀·재현성의 원천 검토가 끝나기 전 CI/실계정 데이터 경로가 아니다. 로컬 미리보기는 synthetic fixture, 시크릿 제거, 짧은 수명, 명시적 접근 범위와 배포 SHA를 요구하고 공개 터널을 자동 개방하지 않는다. 검증 기록은 실패 입력, 실제 환경, 증거 파일, 반증 전/후, 범위·SKIP을 남긴다.

이번 문서 QA에서 `qa-runner affected`의 기본 `.cache/aio-qa/success-cache.json` 쓰기가 Windows `EPERM`으로 **두 번 중단**됐다. 같은 명시 파일 목록을 임시 `AIO_QA_CACHE_DIR`에서 실행하면 preflight/workspace **26 PASS, 0 FAIL/SKIP**이었다. 원인은 캐시 ACL/다른 프로세스 점유/원자성 중 무엇인지 확인하지 못했다. 이는 제품 판정 실패가 아니라 **검증 실행 환경의 재현성 문제**로 따로 등록한다. 후속 owner는 기본 캐시 경로의 쓰기 가능성·동시 실행·실패 뒤 report 남김을 재현하고, 필요하면 세션별 캐시/직렬화·원자적 교체를 선택한다. 실패 로그를 숨기거나 제품 게이트 PASS로 재분류하지 않는다.

**LC-90 — AI 조사 카드의 제한된 표현 계약 (`json-render 참고+C`, 선택 설계).** 오케스트레이터는 자유 HTML 대신 검증된 `evidenceCard`, `scenarioCard`, `missingDataCard`, `sourceLink` 같은 데이터 타입만 발행한다. renderer는 출처 검증/시점/allowed use를 검사하고 위험 행동은 별도의 사용자 UI 계약을 요구한다. 기존 `js/aio-chat.js`/native AI·화면이 병렬로 다른 수치를 만드는 경로를 한 resultId로 수렴시킨 뒤 중복 helper를 퇴역한다. 성공 기준은 임의 모델 출력이 허용되지 않는 액션을 실행하지 못하고, 같은 질문의 화면/내보내기/AI citation이 동일 publication cut을 가리키는 것이다.

## 4. 구현 순서와 삭제 조건

| 순서/owner | 실제 코드 이전·통합·퇴역 범위 | 구현 전·후 독립 인수 |
|---|---|---|
| A: 외부 주장·원전 owner | 기존 `js/aio-chat.js`의 참조 장문/중복 `sourceAudit`를 source registry와 요청별 retrieval로 이전. Guide·Principles·Atlas의 직접성 배지/출처 renderer를 한 claim contract로 통합하고 낡은 문자열 분기 삭제. | 동일 claim이 Guide/학습/AI에서 같은 원전 절·시각·상태, 30개 미연결 원고는 미연결로 남음. |
| B: 차트·신호 owner | `js/aio-core.js`/`js/aio-ui.js`의 중복 VCP·주봉·EMA/RSI 정규화, `src/domain/signal`·기술 화면의 상태를 목적별로 정본화. 더 이상 호출되지 않는 계산·표시·facade 삭제. | 4h/1d, split/gap/미완료 봉, 반대 지표, stop invalidation의 입력→결과→차트→AI 독립 E2E. |
| C: 뉴스·반응 owner | `src/domain/news/scoring.js`와 `src/ui/pages/news.js`, `index.html`의 감성/반응 설명 및 중복 topic writer를 통합. 본문 없는 감성/원인 텍스트 퇴역. | 0–2/0–100 모델 혼동 없음, 1/21/63일 표본·SPY/QQQ ETF proxy·중복 뉴스·결측/대기 재현. |
| D: 공시·테스트 owner | `src/ui/pages/masters.js`의 행/값/단위 배지 분리, producer/`scripts/ci-masters-contract-check.mjs`의 동일 상수 oracle 제거 또는 독립 정본 교체. 오래된 시험 전용 seam·무의미한 assertion 정리. | SEC exact/반올림 후보/범위 초과/의심 단위와 200/전체 검색, 표면·AI·원문 결속. 게이트 자체가 의도한 결함에서 실패하는 전후 증거. |
| E: 배포/수명주기 owner | route owner·asset/retirement manifests와 실제 사용자 경로를 대사한 뒤 임시 facade, 이중 writer, 불필요한 셸/레거시 블록을 제거. | 로컬·실브라우저·원격 SHA/SW/데이터 세대, 재방문·실패 복구, 모바일·보조공학·사용자 과업 각각 별도 PASS/미검증. |

각 단계는 기능 추가량보다 **기존 책임 제거와 한 owner로의 수렴**을 완료 조건으로 둔다. 다만 제거는 호출 그래프·저장 이력·음성/양성 fixture를 대사한 뒤 한다. 새 CI만 추가하거나 옛 경로를 방치한 채 새 모듈을 덧붙이는 것은 수직 slice 완료가 아니다. 매매 수익·예측 성능은 적절한 시점 가용성/표본 밖/비용·슬리피지/생존 편향 검증 이전에는 주장하지 않는다.

## 5. 원문·스레드 확인 대장

제공된 X 게시물 14개는 Chrome의 로그인된 `x.com/i/history` 북마크 화면 및 각 원문 링크에서 확인한다. 아래 대장은 본문·작성자 연속 게시·인용·아티클/외부 전문·답글의 **실제 도달 범위**를 URL별로 기록하며, 전체 답글 수가 많을 경우 읽은 범위를 한정한다. 본문이 보이는 자료의 시장 수치/가격 전망은 여전히 작성자 주장이고 독립 사실 검증이 아니다.

아래 시각은 원문 Chrome의 한국어 UI에서 읽은 **2026년 KST**이다. 각 `확인`은 게시물 본문과 화면에 나타난 작성자 후속/인용에 한정하며, 전체 독자 답글·외부 유료 전문까지 읽었다는 뜻이 아니다. 스크린샷 #1–9를 X의 일반 `이미지` 첨부와 **일대일 매칭하지 못했다**.

| 자료·게시 시각(KST) | 직접 읽은 내용·연결 깊이 | AIO에 적용할 요소와 보류 경계 |
|---|---|---|
| [Trader Jesse](https://x.com/Trader_Jesse_/status/2103158624881443075) · 9/25 01:24 | 패턴 이름보다 거시/추세/산업·섹터/상대강도/수급/실적/일정과 변동성·매매 관리가 어렵다는 본문. Ian Lee의 차트 책 4권 추천 인용과 작성자 감사 답글 2건 확인. 첨부 이미지 없음. | `패턴명 → 맥락 → 조건/무효화 → 크기·관리`의 설명 순서. 책 인용은 성능 근거가 아님. |
| [P Equity Research](https://x.com/pequityresearch/status/2102940418660831549) · 9/24 10:57 | X 아티클 `Expert Call | InP Market Research`: InP 가격/2027 적린 수급/AXT·Tongmei/400G→1.6T 수율 등 **15개 질문**. 나머지는 Substack 구독 필요. 작성자 후속과 대표 이미지 표시 확인. | 광통신 소재 공급망을 가격·원료·설비·수율·고객 수요의 질문 그래프로 설계. 유료 내용과 2027 예측은 미확인/작성자 주장. |
| [Ray Fernando](https://x.com/RayFernando1337/status/2102927565778522610) · 9/24 10:06 | 구현을 다시 쓰는 unit test와 리팩터링 파손 비판, Ansh 글 인용. 작성자 9/24 16:30 후속은 고객 실행 환경 가까운 QA 선호를 설명. | 실제 고장 모드/독립 oracle·E2E 증거 중심; unit test 일괄 금지로 해석하지 않음. |
| [Ansh Nanda](https://x.com/anshnanda/status/2101627891721371971) · 9/20 20:01 | E2E·재현 산출물·테스트 전 실패 경우를 AGENTS.md에 두자는 **작성자 의견**; Dex의 상수 문자열 테스트 풍자 인용. 후속에 UI 영상/backend 결정적 출력·어려운 E2E·계산/join 시험 의견. 83개 독자 답글 전수 아님. | QA 증거 형식과 테스트 owner 감사 참고. AIO의 필수 계산·저장·보안 격리 검사를 없애지 않음. |
| [Lazy Alpha](https://x.com/lazyalphaio/status/2102650471336845747) · 9/23 15:45 | X 아티클 `Lazy Alpha Pattern Finder`: 삼각형/쐐기/페넌트/컵·핸들/W·M/채널/플래그/박스, **감지 당시 경계 고정 후** 돌파·실패, 정식/참고 등급·겹침 선택·알림·민감도. 상승 쐐기/삼각형/M 예시 이미지, 작성자 후속 확인. | 패턴 힌트가 아니라 `candidate/confirmed/failed` 상태기계, 경계 고정과 재현성, 겹침 우선순위. 외부 지표 코드·백테스트 미제공이므로 패턴 정확도 보류. |
| [GMPNavi/괴짜](https://x.com/gmpnavi/status/2088158054898647224) · 8/14 15:57 | X 아티클 `나의 기업분석 운영체계 보고서`: 회사별 원본·시계열 원장·증거 그래프, 사실/관측/추론/가설, 반증/미해결 해소 조건, 검증된 자료에서 보고서·Console 생성, 외부 배포 승인 단계. 10회사 저장소의 자료별 준비 수(9/8/6/2/1)와 작성자 후속 확인. | AIO source→claim→observation→result→발행 그래프의 참고 구조. 저자의 내부 품질 수치는 AIO 성능 근거가 아님. |
| [WonhaengL](https://x.com/WonhaengL/status/2102323776579158048) · 9/22 18:07 | RKLB 4h 200선 돌파 시도, **다음 날 지지 확인 조건**의 롱 관점, 자신의 양봉 매수 서술. 본문/후속 매수 신호 이미지, PL 질문 답글 확인. | 돌파 후보/다음 종가 확인/지지 실패를 분리하는 사례. 개인 매매·표식은 AIO 매수 신호나 성과 검증이 아님. |
| [Ram Maheshwari](https://x.com/rammcodes/status/2101644770389143770) · 9/20 21:08 | Cloudflare로 localhost 공유를 한 명령/무계정/무포트포워딩이라고 홍보한 20초 영상. 9/21 후속은 VS Code Ports 게시물 인용; 설정 전체는 미확인. | 격리 preview/외부 사용자 검수 가능성만 검토. 실데이터·시크릿의 공개 터널 자동 개방은 불허. |
| [BSPK](https://x.com/BSPK_/status/2101564705428959646) · 9/20 15:50 | 약 1,500뉴스 긍·부정 강도와 주가 변동성 반영 심리지표, 두 시기에 상승했으며 매수 유리했다는 작성자 주장. 9/19 Jev·Alpaca 입력→점수→시계열 구축 글과 9/17 세미나 글 인용. 산식/백테스트 미확인. | 뉴스 사건+가격 반응의 소유권·평가식·표본/기간·다른 지수 비교를 요구. 과거 두 구간 일치는 예측력 아님. |
| [Monid](https://x.com/MonidHQ/status/2100705843453079718) · 9/18 06:57 | 검색/fetch 무료, `$7/1,000 대 $0`, 구독·쿼터 없음이라는 홍보 영상. 작성자 후속은 **검색/discovery 무료·endpoint 실제 호출 과금**을 설명. 비용/데이터 판매 우려 답글 보임. | 검색 후보 비용과 실제 수집·검증 비용을 분리한 API/운영 예산 설계. 가격·권리·SLA·개인정보는 공급자 계약 검증 전 채택 보류. |
| [MichaelZTrading](https://x.com/MichaelZTrading/status/2100596335162380479) · 9/17 23:42 | @kovainvest 명의 X 아티클: 펀더멘털+기술/기관/시장 맥락으로 후보를 10–15개로 좁히고 VCP/Pocket Pivot, 손절·시간 손절, 이익 종목 추가, 노출·일지를 설명. `+40% week`는 저자 사례. 작성자 후속은 수동 판단이라 백테스트가 어렵다고 밝힘. | Screener 후보→차트 연구→실행 가정/일지의 분리. 일화 성과를 모델 기대수익으로 사용하지 않음. |
| [FedNMad](https://x.com/fednmad/status/2100369578606121316) · 9/17 08:41 | 9/16 사전 FOMC 시나리오를 인용한 사후 해석. 동결/매파·모호성을 혼합하고 점도표/발언/채권·달러·주식 반응을 근거로 제시, 크립토 비동조 원인은 조건부 가설. 후속 답글 확인. | 사전 시나리오·관측·사후 귀인·남은 반례를 분리하는 briefing/매크로 카드. FOMC 수치와 인과는 공식 원문 재대사 전 게시자 주장. |
| [Damnang](https://x.com/damnang2/status/2099769613047476357) · 9/15 16:57 | X 아티클 `Is the 2028 Memory Downcycle Real?`, 기준일 9/14·**DRAM만, NAND 제외**. HBM 적층/웨이퍼 배분/계약가·범용 DRAM/2027~28 생산설비를 2028 하락 변수로 설명. X 본문은 읽었지만 Substack 전문 미열람, 독자 답글 일부만 확인. | 범위·시점·물리 capacity→수율→가격→기업 현금흐름의 시나리오 그래프. 개별 수치·계약·생산일정은 공식 대사 전 미검증. |
| [AlexZio00](https://x.com/AlexZio00/status/2055113221296804290) · 5/15 11:29 | `매매의 구조` 1막 #0–#18 아티클 **목차**: 확률, 출구 유동성, 크기/파산, 자산/종목/시간, 분산·집중, 현금, 비용, 알고리즘, 이벤트·호가·차트 등. #1 인용 서문과 연재 계획 답글 확인, #0–#18 전문은 열지 않음. | AIO 학습 커리큘럼의 coverage 체크리스트. 19개 원고를 읽거나 그 방법론을 인증했다고 쓰지 않음. |

### 게시물 간 구조적 공통분모

- **연구 원장:** GMPNavi의 사실/관측/추론/가설·반증 구조, P Equity의 검증 질문, Damnang의 범위/기준일·수급 변수, FedNMad의 사전 시나리오/사후 관측을 `SourceClaim → EvidenceObservation → Hypothesis → Falsifier → Scenario → PublicationDecision`로 묶는다. 근거를 모으는 순서와 결론을 승인하는 순서는 분리한다. AIO의 Atlas·테마·Briefing·AI가 동일 ID와 원전 절을 소비한다.
- **차트 실용성:** Trader Jesse의 맥락·리스크 관리, Lazy Alpha의 경계 고정/실패, WonhaengL의 다음 날 지지 조건, Michael의 선별→실행·일지, Alex의 비용/시간/출구 유동성 범위를 LC-86의 조건부 사건·전략·실행·사후 관찰로 연결한다. 특정 작성자의 경험적 성과를 성능 지표로 복제하지 않는다.
- **뉴스 지표:** BSPK와 이미지 #5/6의 뉴스+가격 반응을 LC-87의 별도 연구로 놓되 원문 깊이, 점수 정의, 겹침, ETF proxy, 표본 밖/시기 교차 검증 전 `매수 유리` 같은 문구를 보류한다.
- **작업 환경·QA:** Ray/Ansh/OpenClaw의 저가치 테스트 감사, Ram의 외부 preview, Monid의 무료 탐색/유료 실행은 LC-89의 독립 검증·시크릿/비용 경계로 반영한다. X 게시물의 테스트 문구를 AIO AGENTS.md 규칙으로 복사하거나 공개 터널을 자동 실행하지 않는다.

## 열린 증거

- 이미지의 정확한 촬영 시각·지표 코드/파라미터·데이터 출처·보유/체결 기록·전후 모든 봉은 확인되지 않았다. 전략 성능 검증은 별도다.
- X 원문·작성자 thread와 인용은 접근 가능한 범위만 기록한다. 유료/외부 전문과 전체 독자 답글, 링크 너머의 공식 사실은 별도 E 대사 없이는 미완료다.
- `ddak8.com`과 세 엔지니어링 자료의 설계 원칙을 참고했으며, AIO에 도입한 코드나 제품 기능은 없다. 새 원격 SHA의 20개 route는 [33](33-NEW-SHA-20-ROUTE-LIVE-RECHECK-20260925.md)에서 대표 화면·동선을 재확인했지만 모든 조합과 end-to-end 사용자 과업은 미인수다.
