> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# UI 전문 의미 검토 (진행 중)

검토자 structure_ui. 부모가 지정한 원본 inventory 기준. 제품 코드 수정·Git·QA·브라우저·producer·네트워크 실행 없음. 부모의 추가 지시에 따라 이 보고서와 ui-reading.tsv만 저장한다. 다른 작업자 변경을 되돌리지 않는다.

## 1차 완료

32파일, 120731 bytes, 실제행2060, split-line slots2092. 전문 읽기 직전 hash는 따로 채취하지 못했다. 전체91의 2026-10-18T09:11:11.718Z와09:11:44.612Z raw bundle hash는 동일한 05d7178e1f00ffb80176af786a53c9e4fe33ec2b53593b2e9da544e0865b7232, inventory 개별sha mismatch0. 완독32 종료 hash796cbb279c64e26177c4cfdb6a4b898fb9a2b18c86d98b98d6fc8a77d0ceb704(09:12:02.150Z).

알고리즘: 상대POSIX path 기본 사전순, 각 path UTF-8 + NUL + raw bytes를 SHA256에 연속 입력. 실제행은 마지막LF를 별도빈행으로 세지 않으며 slots는 split LF length다.

1차 FULL: components의 color-theme/deep-dive/dom/empty-state/knowledge-arrival/korea-participation/page-flow/page-sources/responsive-shell/scenario-outlook/scroll-cue/sector-moves/shell-overlays/term-marks/term-tooltip; knowledge의 capability-loader/evidence/graph/learning-controls/lesson/path/safe-external-link/supplied-material-bridge/tree; navigation3개 전체; panels5개 전체.

1차 소스 후보(실행 검증 없음):
- korea-participation.js:24 available=false이면 준비한 headline까지 host.hidden으로 숨긴다. analysis.js:144 caller. designed source 실패가 없음으로 남지 않는 경계. 반론: 한국 표본을 제공하지 않는 배포라면 숨김 의도일 수 있음. 최소수정: unavailable 상태만 남김. 검증: 정상→부재→복구 상태.
- sector-moves.js:33~35 기존카드 제거 후6개미만이면 설명 없이 반환. daily-loop.js:282 caller. 최소표본 규칙은 합리적이나 실패 상태도 함께 사라짐. 최소수정: 6미만에서 차트·요약 보류, 상태·수신수만 표시. 검증11/6/5/0개.
- scroll-memory.js:78~84 commit의0ms timer가 disposer94~102 밖에 남아 dispose후 restore와 listener를 재생성 가능. bootstrap.js:835/943 설치·해제 caller. 반론: 앱 전체 해제는 일반세션에서 드묾. 최소수정 pending timer취소+disposed guard. 검증 commit→dispose→timer drain.
- scenario-outlook.js:31,36 nowMs가 섹터에만 적용되고 테마는 Date.now 재호출. market-regime.js:294/431 caller. 보통 차이는 작지만 재현과 완료세션 경계가 어긋남. 최소수정 outlookThemes에 nowMs전달. 검증 고정시각 다른 wall clock.
- knowledge-arrival.js:11~24 전역listener와 플래그에 해제 경계 없음; clear27은DOM만 제거. 반론: 운영document는한세션고정. 최소수정 app소유 install/dispose. 검증 app재설치 후 구document 접근없음.
- knowledge-arrival.js:57 returnContext가 있어도 history.length>1이면 무조건back. 내부문서 진입에서는 정확하지만 직접deep link+외부history에서는 문서가 아닌 이전사이트로 복귀 가능. 검증 내부/직접/외부history 진입3경로.
- responsive-shell.js:114/143, scroll-cue.js: observer핸들을 shell이 보유하지 않아 이미detach된 box는 최종 querySelector에서 disconnect못함. 실제GC/반복DOM교체 미검증이므로 확정누수아님. 제안 Set소유+removed target정리; 검증 활성observer·detached node계측.

설계절충: dom.js 및 knowledge local element helper의 작은중복, UI폴더의 DOM없는 portfolio-risk-input은 새framework/전역DI 도입 사유가 아니다. evidence.js:18 외부링크 helper불일치는 제품caller 미확인(검색상 contract script만)이므로 제품보안결함으로 승격하지 않았다.

## 2차 시작

components 미완독29+styles9=38파일,616053bytes,7992slots. 시작2026-10-18T09:14:10.588Z hash4eda1a31dc533844bfaef502d9b46e3ab1eb238e10a62a4f8ebc045b3848f2aa, inventory mismatch0.

원문은4000 UTF-16 chars이하 구간으로 나눠 출력해 순서대로 전문 읽음. 완료파일 상태는 ui-reading.tsv. 앞선 대형출력 truncation으로 중간이 생략된1차소형파일은 별도로 재독했고 생략본문은FULL로 세지 않았다.

2차 발견 메모(아직우선순위·행번호최종정리전,전문읽기증거,실행없음):
- company-analysis: KR_FUNDAMENTALS refresh callback은 재호출하지만 signature는keys/model/scenario-state만 포함하고 KR artifact는조기반환뒤 krFundamentalPoints에서 읽는다. 한국재무가 최초부재→도착해도 동일signature로카드갱신누락 가능. 최소수정 모델에KR근거를 포함하거나KRrevision/선택회사의KR입력을signature에포함. parent에격리실행요청.
- ai-answer-visuals buildRelativeVisual: 개별최근63봉을최소길이로slice하고배열index로x축정렬;날짜교집합을만들지않고첫종목의from/to로모든선을설명. 한국/미국휴장또는누락날짜에서다른날짜를같은x에놓음. 최소수정완료일교집합후동일기준일rebasing. 검증엇갈린휴장/누락fixture.
- ai-answer-visuals buildFundamentalsVisual: quarterly문자열의빈숫자를Number로바꿔null순이익을0으로표시가능;기존parseQuarterHistory/annualparser는결측방어존재. 최소수정canonical분기parser재사용. 검증매출존재·순이익빈필드에서0%표시금지.
- home-kpi-trend renderHomeParticipation: b50In두점이면63개SPX전체변화와b50부분기간변화를같은기간이라고설명. 시작/끝일공통교집합또는개별기간표시필요. b20도거래일대신행index로20기간명명. 검증breadth가늦게시작/중간누락fixture.
- sentiment-board: volCalm은ratio<0.95인데fearful&&(volKnown&&!volCalm) branch의문구는ratio0.95~0.99에도변동성구조역전이라고함. card는같은ratio에평탄. 최소수정flat와inverted를동일분류함수로연결. 검증fg공포/ratio0.97/신용양호조합에서역전없음.
- macro-crossroads: target.dataset.aioScenarioLoad를첫시도전에고정하고이후refreshScenarioArtifacts를다시호출하지않음. TTL/실패retry가있는데도장기세션/첫실패후페이지재진입에서재시도안됨가능. 다른caller의outcomes갱신여부추가검색필요.
- macro-crossroads compact artifact callback은headingLevel을전달하지않아home의최초h2가갱신후기본h3로바뀜. 최소수정모든render옵션전달. 검증artifact도착전/후제목레벨동일.
- sector-map: tile은pointer-onlydiv이고canvas roleimg;키보드대안table은섹터best/worst2개만제공.임의나머지종목의detail/이동동등경로는없음.제안fold내전체멤버selector/목록.반론다른스크리너에서직접검색가능하나지도동작자체의동등대안은아님.
- stress-outcomes: monthn>0이면평균/상승비율을모두표시하고nonoverlap사례10미만보류가없음;n은거래일이고n/h추정을독립표본대용으로쓴다.현artifact표본/producer의실제case정의부모domain검토와대조필요.확정통계오류로과장하지않음.

그밖의유지판정근거: infrastructure는정적reference renderer;breadth는domain판정과공통range를사용하고drill열림보존;briefing/daily는도메인모델과DOM을연결하나earnings중복요청·캐시정책이두파일에복제되어추후데이터레이어로이관할실익있음;fiscal은결측0방어·공통zero bar·접근성표·최신callback포인터존재;stock-chart는최신ticket으로asyncrace방어·libraryboundedwait·기존chartremove를제공.대형함수자체를결함으로세지않음.


## 2차 완료

38파일 전부4000char이하 구간으로 전문 완독. {"time":"2026-10-18T10:39:20.014Z","count":38,"bytes":616053,"lines":7954,"slots":7992,"sha256":"4eda1a31dc533844bfaef502d9b46e3ab1eb238e10a62a4f8ebc045b3848f2aa","inventoryMismatch":[],"full":70}
시작과 종료의38파일 hash 동일. TSV는 한국어로 통일했으며 현재 전체91중70 FULL,21 미독. 나머지는 knowledge9개와 pages12개다.

CSS는 실제 viewport와 접근성 판정의 실행증거가 아니다. regime-quality의 xr-path-cards minmax(280px,1fr)는 280px보다 좁은 내부영역에서 overflow할 수 있으나 실제computed/layout검증 없이 화면결함으로 확정하지 않았다. responsive.css는 이selector를 재정의하지 않는다.

추가 의미메모: theme-playbook도 최초aioScenarioLoad flag로 scenario/macro artifact 요청을 한번만 한다. market-regime의home callback으로 이어지는 compact render는 headingLevel을 누락한다. theme-strength는 renderer 교체 전에 이전scroll cue 핸들을disconnect하는 명시적 소유권이 있어responsive-shell 일반경로와 구별해야 한다.


## 지식9개 추가 전문 완료

{"time":"2026-10-18T10:42:12.974Z","full":79,"sha256":"05d7178e1f00ffb80176af786a53c9e4fe33ec2b53593b2e9da544e0865b7232","inventoryMismatch":[]}
knowledge 전체18개 전문 완독. 남은12개는 pages 전체이며 전문 상태를 TSV에 보존했다.

추가 소스후보:
- concepts-view의 prereqIds 필터 /^[A-O]d{1,2}$/는 숫자가 아니라 literal d를 받는다. A1/O4 등 정상선행ID를모두제외하여선행레슨블록이사라짐. 최소수정정상ID정규식;검증선행ID가있는실제레슨의DOM.
- research-shell의input blur는관련focus목적지확인없이180ms후결과를숨긴다. Tab으로결과button에이동해도180ms후숨겨져키보드선택을방해. 최소수정search영역밖으로focus가나갈때만닫기. 검증Tab→180ms이상대기→Enter로선택.
- research-shell attachSelectionAsk는view scroll listener만등록하고main이분리된뒤그scroll이올때만스스로해제. 앱읽기영역은.content내부scroll이므로popover가scroll과함께닫히지않고기존mainlistener가장기남을수있음. term-marks가같은앱의.content scroll을별도로처리하는코드와대비된다.최소수정page disposer에해제연결하고실제scroller구독.
- current-observations latestClose는raw history 양수와carried-forward만검사하며canonical buildCloseSeries/closeBasis의완료세션제한을사용하지않음. 연구화면의현재종가가다른화면과다른선택정책으로움직일수있음. parent격리실행과실제artifact구조대조전확정현재오표시로승격하지않음.


페이지 analysis/sentiment/guide/market 추가 전문완독. TSV83/91 FULL. 나머지 atlas/entity/masters/news/portfolio/principles/screener/themes 8개는 전문미독이다. 페이지 resource bag은 일반 구독 해제를 제공하지만 일부 컴포넌트의 전역 listener/async후속 렌더는 이 lifecycle 밖에 있어 점진적으로 소유권을 연결할 수 있다. sentiments의 microtask coalescing은 기존 재사용 가능한 선례이며 새전역DI가필요하지않다.
