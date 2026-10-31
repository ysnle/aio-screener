# PASS28 — 파이프라인 자체 상태표와 공통 해석 조립

2026-10-31 KST. 전체 직접 판독8파일: src/data/{page-completeness,public-readiness}.js, src/domain/interpretation/{concepts,market-interpretation}.js, src/data/selectors/{interpretation,market-inputs}.js, scripts/lib/market-interpretation-inputs.mjs, scripts/ci-interpretation-boundary-check.mjs. js/aio-core.js15408–15428의 route별 producer 계약은 검색 결과로 대조(전체판독 아님).

재현 reproduce-pass28.mjs→pass28-reproductions.json exit0, 6개 묶음. 주입 root/순수함수, 네트워크·배포접근 없음.

## P28-COMPLETENESS-01 — loaded/ready가 의미상 충분성보다 넓음

pageDataCompleteness는 loaded인데 lastSuccessfulAt이 잘못된 날짜/미래/없음이어도 stale 처리하지 않는다. coverage=NaN도 minCoverage 비교에서 통과한다. 세 경우모두 loaded 반례. 필수producer status='empty'도 ISSUE_STATUSES에 없어 전체loaded가 된다. EMPTY_STATUSES에는 empty가 있으나 issues에 들어가지 않아 해당 처리에 도달하지 않는다. unknown enum도 같은 문제다.

screenerLoadState는 partial인 slice도 backtest객체와 nonstale universe이면 ready로 승격한다. backtest의 단순존재는 결과의 유효성/현재모델일치/coverage를 보장하지 않는다. producerState breadth는 이ready만으로 coverage100을 부여하고 screener 자체 생성시각 대신 data.json generatedAt을 쓴다. screenerArtifact coverage는 명시NaN이라 screener route의 최소80% 계약을 검사하지 못한다. 이 함수들이 본문수치를 직접 만드는 것은 아니지만 router 상태속성과 QA가 이를 '자료충분' 근거로 읽으면 잘못된 인증이 된다.

개편: load(success)·coverage·freshness·semantic eligibility를 다른 필드로 유지하고, 필수관측시각/유한coverage가 없으면 unknown. enum allowlist와 unknown hold. breadth는 실제대상/유효분모를 사용. 각artifact의 observedAt/revision/nextExpectedPublication로 판정하고 generatedAt을 대체관측일로 쓰지 않는다. 회귀: partial+backtest존재,NaN/nullcoverage,미래/불량날짜,empty/새enum,소스별휴장/발표주기.

## P28-AUDIT-01 — 감사가 없는 것과 통과를 구분하지 못함

auditPageDataCompleteness([],[])는 routeCount0/statusloaded를 반환한다. install의 기본opts에도 pageId없으면0개가 가능하므로 전체route가감사됐다는뜻으로 쓰면 안 된다. pageDataCompleteness는 readProducer가 준 객체를 직접변경(status/ageMs등)하므로 동일객체를 재사용하는caller에서는 한page의maxAge 판정이 다음page에전파될 수 있다. 현재 installer의 producerState는 새객체라 정상경로에는 보호가 있다.

public-readiness는 미래generatedAt을Math.max(0,age)로0분전표시하고 다른 audit을pass로주면 statusok/'베타공유가능'을반환한다(2099재현). invaliddate도NaN이라age차단을통과한다. runtime모드는 페이지caveat존재로pageAuditpass, metadata generatedAt존재로pipelineAuditok를합성한다. 전체외부상태를검증한것과동일한'파이프라인OK'어휘를사용한다. detailed AIO API와 public runtime의검증수준은결과auditMode로구분되지만label에는그한계가충분하지않다.

3h/6h 일괄지연임계도 source cadence-relative 정책과다르다. 조용한주말/월간공식자료를블록하거나,새data.json생성으로오래된하위자료를가릴수있다. family/friends무료도구에'베타공유가능/공개전차단'은과거public-beta절차의명칭잔재라데이터상태와배포권한을분리할것. 실제사용자표면은developer panel위주라고파일주석에명시되어있으므로모든화면에서이문구가보인다고확대하지않는다.

## P28-INTERPRETATION-01 — 같은 함수라도 입력·시계는 아직 같지 않음

browser collectInterpretationInputs(root,{nowMs})는 nowMs를반환하지만 collectMarketInputs는 Date.now를market.now에넣는다. builder는market.now??nowMs를우선하므로 과거nowMs를주입해도regime/KRX입장은실시계,events/groups/indexEarnings는주입시계가된다. fixture에서2026-10-30기준과현재market.now불일치확인. producer adapter는market.now를nowMs로덮으므로browser/producer동일입력시계계약이갈라진다. 보통live now에서는수ms차이라큰문제가아니지만session경계/fixture/리플레이에서의미가달라진다.

producer adapter에는rotationHistory/indexEarnings입력이없고calendar.releases도넘기지않는다. browser에는모두있으며breadthSp500와rates.dgs2AsOf도더있다. producer는HY bp를정수반올림, browser는수신숫자를유지한다. 'sameartifacts이므로cannotdrift'라는주석은현재동일결과보증보다강하다. 미제공단계가null인것자체는정상허용이지만guide/outlook가다른근거로결론을내는범위를명시해야한다.

개편: 공통snapshot envelope에asOf/clock/revisions/coverage를고정하고adapter별필드대조를실행. optional단계의미제공이서술에미치는영향표시. server/browser golden fixture를같은artifacts·동일시계로비교하되의도된차이만명시. latest실행시각과과거기준일을서로덮지않는다.

## P28-CONTRACT-01 — 단계목록 게이트는 실제 실행순서를 검증하지 않음

INTERPRETATION_STAGES에는events/flow가없다. 선언목록은indexEarnings→crossroads지만실제실행은crossroads/scenarios뒤에indexEarnings. gate는정적인배열을deepEqual할뿐이므로실제호출순서·누락단계를검증하지않는다. 의존성상현재순서가반드시버그라는뜻은아니며목록과문서의의미드리프트다.

stage catch로부분객체반환을막지만typedScreenerRows는stage밖에서실행되어타입오류/getter예외는전체를중단할수있다. errors가있어도overallstatus가없어consumer가null과의도적skip을구분하기어렵다. gate의broken검사는errors가object라는것만검사하고실제throw가포착됐는지/실패stage이름이맞는지증명하지않는다. guide.direction.live.length>=0는유효한배열이면항상true라의미검수가아니다.

개편: stage id/dependencies/status(skip/missing/error/ready)를단일registry로정의하고실제실행trace에대조. 고의로특정stage가실패하는injectedfixture로후속null전파/서술축소를검증. import/call정규식gate는alias/membercall우회까지완전보증하지않으므로AST사용또는실행증거보완. Object.freeze(Set)은add/delete를막지않는DEFENSIVE_SECTORS 계약후보도기록하되현재mutation호출은미확인.

## 검증 상태

PASS24–27 감사자료 affected QA: run2026-10-31T02-50-23-390Z-26928-a2upwt, pass3/cached9/fail0, exit0. 실제실행3=workflow-yaml/product-charter/operations-contract;나머지는캐시. 이는의미검토나브라우저/배포인증이아니다. PASS28은해당실행후추가되어그실행의인증범위로확장하지않는다. 전체파일감사는진행중. 제품개선·commit/push/deploy없음.
