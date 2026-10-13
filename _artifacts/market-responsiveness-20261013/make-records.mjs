// v57.52 market responsiveness records (P1718-P1730) for scripts/record-fix.mjs.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const note = 'v57.52 급변 장세 반영·통합 점검(갱신 경로·해설·판정·실시간·AI·뉴스) 반영(P1718~P1730).';
const base = { version: 'v57.52', date: '2026-10-13', r: null, status: null, note, qa_section: '검증 스킬' };
const e = (id, title, symptom, root_cause, fix, violated_rule, prevention, verification, changelog) => ({ p: { id, title, symptom, root_cause, fix, violated_rule, prevention, verification }, changelog });
const entries = [
  e(1718, '30분 데이터 갱신을 보완하는 Worker dispatch가 Cloudflare에서 예외로 한 번도 실행되지 않아, 공개 데이터 갱신 간격이 중앙값 4시간·최대 13시간',
    'refresh-data의 GitHub 예약 실행은 지난 7일 예정 343회 중 39회(11%)만 왔다. 이를 보완하는 data-plane Worker의 :20/:50 dispatch는 토큰이 설정돼 있는데도 매 슬롯 workflow-observation-failed status 0이었다.',
    'worker/data-plane.js가 GitHub API 호출에 redirect:\'error\'를 썼다. Cloudflare Workers는 이 모드에 TypeError를 던진다(P1433에서 OpenAI 경로만 고침). Node fixture는 이 값을 허용해 테스트가 통과했다.',
    '두 호출을 redirect:\'manual\'로 바꾸고(3xx는 기존 ok 검사가 거부), Worker 소스 전체에서 \'error\' 리다이렉트 모드를 금지하는 단언과 dispatcher 호출 init.redirect 단언을 추가했다.',
    '운영 경로는 실제 런타임 의미로 검증', 'P1718: ci-data-plane-contract-check(dispatcher redirect manual·Worker 소스 금지)', 'gate 통과. 배포 후 Worker /health schedulerDispatch.lastObservation이 accepted/recent-success로 바뀌는지 확인(QA-VERIFY-19).',
    '**30분 갱신 복구 (P1718):** Worker의 refresh-data 호출이 Cloudflare에서 예외로 실패하던 문제를 고쳐, GitHub 예약 실행 누락(도달률 11%)을 Worker가 실제로 메운다.'),
  e(1719, '서버 시장 해설이 날짜·시각 숫자를 지수 값으로 읽는 검증기 오탐으로 차단되고(발행률 63%), 차단 시 재시도·직전본 없이 카드가 비었음',
    '10/13 코스피 −5.46% 당일 해설이 metric-value-mismatch:market.spx로 2회 연속 차단돼 홈 \'오늘의 시장\' 카드가 숨겨졌다. 최근 30회 중 11회 차단.',
    'analysisLevelsAfterLabels가 라벨 뒤 첫 숫자를 지수 값으로 보며 월·일·시·분·KST를 제외하지 않았고(validateAnalysisMetricMentions와 규칙 불일치), 라벨 수준 루프에 맥락 예외가 없었다. genMarketAnalysis는 차단 시 즉시 대기 문구로 대체했다.',
    'isNonMetricNumber 하나로 날짜·시각·개수 숫자를 두 검증기에서 함께 제외하고 라벨 수준 루프에도 맥락 예외를 적용했다. 차단 사유를 넣어 1회 재생성하고, 그래도 차단이면 12시간 이내 직전 검증본을 retained{at,from,reason}과 함께 유지해 홈 카드·AI 패널에 \'HH:MM 기준 직전 검증본\'으로 표시한다. 거절 원문은 실행 로그에만 400자.',
    '근거 검증은 오탐 없이, 실패는 투명하게', 'P1719: ci-data-pipeline-contract-check(날짜·시각 숫자 통과·틀린 수준 차단·재시도·직전본 12시간)', 'fixture: "S&P 500은 10월 12일 7,807.24로 마감" 통과, "7,100으로 마감" 차단.',
    '**시장 해설 차단 오탐 수정 (P1719):** 날짜·시각 숫자를 지수 값으로 읽던 검증 오탐을 없애고, 차단되면 한 번 다시 쓰며, 그래도 막히면 직전 검증본을 기준 시각과 함께 보여 준다.'),
  e(1720, '뉴스가 KST 08:00 마감 묶음뿐이라 한국 장중 급락(코스피 −5.46%) 기사가 다음 날 08시 이후까지 화면·해설·AI에 0건',
    '오늘 화면의 중요 뉴스 1위가 1일 전 환율 기사였고, 해설 프롬프트는 급락 원인 기사 없이 종가만 받았다.',
    '정본 창(전날 08:00~오늘 08:00 KST) 밖 기사를 모두 버렸고 장중 사건을 담을 별도 경로가 없었다. 한국어 tier2 매체 표기(연합뉴스 등)가 tier 정규식에 없어 한국 기사가 tier3로 분류됐다.',
    '정본 묶음은 그대로 두고, 같은 수집 결과에서 08:00 이후 tier1·2 기사 최대 6건(한국 2건 우선, 기존 저품질·낚시·주제 상한·정본 중복 제외)을 data.newsIntraday로 발행한다. 해설 프롬프트·AI 뉴스 맥락·뉴스 화면에 \'08:00 이후 장중 속보 · 잠정\'으로 연결하고, 15:30 이후 머리말에 기준을 밝힌다. tier2 정규식에 기존 매체의 한글 표기를 추가했다.',
    '정본 창 유지 + 잠정 칸은 명시 라벨', 'P1720: ci-data-pipeline-contract-check(selectNewsIntraday)·ci-artifact-semantics-check(newsIntraday)·ci-esm-core-unit-check(selectIntradayNews)', 'fixture 13건→6건(한국 2), 정본 중복·컷 이전·tier3 제외, 빈 입력 [].',
    '**장중 속보 칸 (P1720):** 08:00 정본 묶음은 그대로 두고, 그 이후 주요 매체 기사 최대 6건을 \'장중 속보 · 잠정\'으로 뉴스 화면·해설·AI에 함께 넣는다.'),
  e(1721, '원/달러가 여러 화면에서 10/9 값에 고정되고, 브렌트 유럽 현물(10/6)을 WTI 선물과 비교해 36달러 스프레드를 해석',
    '시장 상태·브리핑·금리환율이 원/달러 1,340.0(10/9)을 \'1거래일 전 종가\'로 표시했다. 거시 브렌트는 125.44(10/6, 유럽 현물)로 WTI 93.74(선물)와 36달러 차이를 해석했다.',
    'Yahoo KRW=X·JPY=X 일봉에서 10/12 봉이 빠지고 10/13 종가가 null이라 history가 10/9 값을 두 행에 기록했다. 브렌트는 history에 선물 열이 없어 FRED 현물만 있었다.',
    '평일 FX 전일값을 1시간봉의 23:00Z(KST 08:00) 컷 종가로 계산하고(실패 시 일봉 경로 유지), history에 BZ=F 브렌트 선물 완료 종가 열을 WTI와 같은 계약으로 추가했다(1년 백필). 거시는 선물 우선, 현물은 기준을 밝힌 참고, 현물-선물 스프레드는 해석하지 않는다.',
    '같은 기준끼리만 비교', 'P1721: ci-data-pipeline-contract-check(fxCloseAtCut·brent 열)·ci-codex-structure-regression-fixture(M06·P1726)', 'Yahoo 실측 재현: 10/13 실행 원/달러 1,334.20(10/12 컷).',
    '**환율·브렌트 최신성 (P1721):** 원/달러가 10/9에 멈추던 공급자 결측을 08:00 컷 종가로 메우고, 브렌트는 선물 종가를 따로 쌓아 WTI와 같은 기준으로만 비교한다.'),
  e(1722, '텔레그램 지정학 기사(영국 기관: 호르무즈 선박 피격)가 \'한국장\' 수급 태그로 분류됨',
    '호르무즈 선박 피격 글에 한국장 태그가 붙었다.', '한국 수급 판정이 bare \'기관\' 단어 매칭이었다.',
    'KR_INSTITUTIONAL_FLOW(외국인·기관 동반 매도, 기관 순매도 등 수급 문맥)로 바꿨다.', '분류는 문맥 근거', 'P1722: ci-data-pipeline-contract-check', '"영국 기관: 호르무즈 …" 비매칭, "기관이 3,000억 순매도" 매칭.',
    '**텔레그램 태그 (P1722):** 지정학 기사의 \'기관\' 단어가 한국장 수급으로 잘못 분류되지 않는다.'),
  e(1723, '하루 급변(코스피 −5.46%, 5일 −13.8%)이 판정·브리핑 리드·홈·한국 참여도·테마에 근거 있게 올라오지 않음',
    '브리핑 한국 문장이 가중치 45로 리드 4개 밖에 밀렸고 1일 문장은 억제됐다. 변동성 축은 \'단기 충격을 크게 반영하지 않음\', 한국 참여도는 \'3개월 강한 테마\'로 시작, 반도체 테마는 동일가중 +12.6%로 대형 2종목 −12~−18%를 가렸다.',
    '판정·서술이 미국 5·20·50·200일 창에 고정됐고, 한국 1일 충격의 기록상 위치를 계산하는 곳이 없었다.',
    '미국 6축 상태 규칙은 그대로 두고, KOSPI 1·5일 변화의 최근 252세션 기록 위치로 브리핑 한국 문장 가중치(끝 2% 84 등)를 정하고 1일·5일을 한 문장으로 합쳤다. 추세·변동성 축 read 끝에 \'미국과 다른 시장\'임을 밝힌 한국 기록 한 줄, 홈 한국 줄 경고, 한국 참여도 첫 줄(지수 vs 표본 중앙값 — 대형주 집중 하락), 그룹 강도·국내 테마에 거래대금 상위 3종목 문장을 추가했다.',
    '근거 있는 서술(기록 백분위), 새 등급 없음', 'P1723: ci-regime-scenarios-fixture(축 상태 불변 deepEqual)·ci-korea-participation-fixture', '오늘 데이터: 한국 문장 45→84(리드 2위), 하루 하위 6%·5일 하위 2%.',
    '**한국 충격 반영 (P1723):** 미국 판정 규칙은 그대로 두고, 코스피 하루·5일 변화의 기록상 위치로 브리핑·축 설명·홈·한국 참여도·테마에 근거 있는 문장을 올린다.'),
  e(1724, '오늘 \'직전 종가 대비 변화\'에서 코스피가 빠짐(비교 기준일 10/9가 한국 휴장일)',
    '헤드라인이 "크게 움직인 것은 WTI +2.06%"였다.', 'daily-diff가 모든 지표를 미국 직전 세션끼리 비교해 KRX 휴장일 지표를 notCompared로 빼고, notCompared를 렌더하지 않았다.',
    '코스피·코스닥은 직전 KRX 세션과 비교하고 칸에 기준일을 적으며, 비교 제외 지표를 사유와 함께 한 줄로 표시한다.', '종가 기준 — 시장별 세션', 'P1724: ci-regime-scenarios-fixture(daily-diff KRX)', '오늘: "WTI +2.06% · 코스피(한국 10/13) −5.46% · 코스닥 −1.43%", "비교 제외: 원/달러(최근 종가 10/9)".',
    '**직전 종가 대비 변화 (P1724):** 코스피·코스닥을 한국 직전 세션과 비교해 넣고, 비교에서 빠진 지표는 사유와 함께 보여 준다.'),
  e(1725, '기준일이 다른 값을 한 문장·한 칩에서 섞음(코스피 10/13 vs 원/달러 10/9, 미국장 섹션 vs 실시간 띠 부호 반대)',
    '브리핑이 "코스피 5일 −13.8% · 원/달러 5일 −0.2%(원화 강세)"로 다른 날짜 창을 비교했고, 한국 축 칩은 FX 날짜만 표기했다. 홈 \'직전 종가 대비 변화\' WTI +2.06%와 실시간 띠 −1.92%가 설명 없이 나란히 보였다.',
    '축 기준일 칩이 FX valueAsOf만 받았고, 비교 문장과 섹션 머리말이 기준을 밝히지 않았다.',
    '환율 축에 원/달러·엔/달러·코스피 각각의 기준일을 넘겨 섞이면 칩·값에 날짜를 표시하고, 한국 문장에 날짜를 병기하며, 홈·거시 FX 칸 머리말에 \'미국 종가 10/9 → 10/12 · 실시간 시세와 기간이 다름\'을 명시했다.', '기준일 명시', 'P1725: ci-regime-scenarios-fixture(섞인 날짜 칩)', '칩 "10/9~10/13", 각 값 날짜 표기.',
    '**기준일 섞임 정리 (P1725):** 날짜가 다른 값을 비교할 때 각 기준일을 함께 적고, 미국 종가 섹션과 실시간 시세의 기간 차이를 머리말에 밝힌다.'),
  e(1726, '유가 5일 반등(+4.8%)이 20일 \'하락\' 판정에 가려지고, 현물-선물 혼합 브렌트 스프레드를 해석',
    '거시 유가 노드가 WTI 20일 −7.5%로 \'하락\'만 표시했다. 브렌트 현물 125.44 vs WTI 선물 93.74의 스프레드를 해석했다.',
    '유가 방향이 20일 창만 보았고, brentWtiCheck가 basis를 구분하지 않았다.',
    '판정은 20일 그대로 두고 "20일 −7.5%(최근 5일 +4.8% 반등)"을 근거·노드 값에 병기했다. 브렌트는 선물 열이 있으면 선물끼리 비교(스프레드 $15 초과면 보류), 현물만 있으면 참고 문장만 쓴다.', '같은 기준 비교 / 판정 불변', 'P1726: ci-codex-structure-regression-fixture(M06 갱신·P1726)', '오늘: WTI 근거 "93.74달러 (20일 −7.5% · 최근 5일 +4.8% 반등)".',
    '**유가 단기 변화 병기 (P1726):** 20일 판정은 유지하되 최근 5일 반등을 함께 적고, 기준이 다른 브렌트·WTI 스프레드는 해석하지 않는다.'),
  e(1727, '시나리오 \'현재 조건 부합\'과 부합 수의 신용 정의가 다르고, 원화 보합권 기준·브리핑 다음 단계(한국·뉴스)가 어긋남',
    '상태는 \'집중 유지 · 현재 조건 부합\'인데 부합 수는 3/4였다. 원/달러 5일 −0.2%를 브리핑은 \'원화 강세\', 한국 카드는 \'보합권\'으로 썼다. 브리핑 한국 링크는 코스피가 없는 거시 화면으로 갔고 뉴스로 가는 길이 없었다.',
    'regime-scenarios는 신용 \'부담 아님\', scenario-outlook은 \'우호\'를 조건으로 썼다. 원화 보합권 ±0.5%가 한 곳에만 있었다. page-flow korea 목적지가 거시였다.',
    '신용 조건을 favorable로 통일, 원화 ±0.5% 보합권을 브리핑에도 적용, 한국 링크를 시장 상태 한국 보드로(리드에 있으면 첫 링크), 에너지·지정학·한국 뉴스 필터 링크와 뉴스 화면 topic/country handoff를 연결했다. 소비처 없는 decision-summary.js 삭제.', '한 정의', 'P1727: ci-regime-scenarios-fixture·ci-scenario-guidance-fixture·ci-esm-core-unit-check', '오늘: 시나리오 셋 다 \'관찰할 조건\'·3/4 일치, 다음 단계 1위 \'시장 상태 · 한국 시장 참고\'.',
    '**시나리오·다음 단계 정합 (P1727):** 시나리오 부합 정의와 원화 보합권 기준을 하나로 맞추고, 브리핑에서 한국 보드와 주제별 뉴스로 바로 이어진다.'),
  e(1728, '한국 종목·코스닥 실시간 등락률이 한 세션 어긋난 공급자 전일종가로 계산돼 과장(삼성전자 −6.59% vs −5.58%, 코스닥 −6.19% vs −1.43%)',
    '운영 사이트 종목 히어로가 005930 ▼6.59%~7.38%, 000660 ▼9.60%를 보였고, ^KQ11 실시간 −6.19%가 AI 맥락에 들어갈 수 있었다.',
    'Yahoo regularMarketPreviousClose를 그대로 저장했고, 거래소 전일값 보호가 지수 스냅샷에만 있었으며 그 경로(Naver 프록시)가 실패했다.',
    '한국 지수는 history 직전 완료 KRX 종가, 종목은 같은 세션 스크리너 ret1d(거래소 종가 교정)와 대조해 다르면 검증 기준으로 재계산하고, 기준이 없으면 \'전일 기준 미확인\'으로 보류한다. 히어로·요약 시세·AI 기술 블록이 같은 검증 값을 쓴다. 브라우저 직접 Yahoo 호출을 Worker 경유로, 운영 Origin에서 항상 403인 프록시를 체인에서 제거했다.',
    '종가 기준 / fail-closed', 'P1728: ci-esm-core-unit-check(검증기 6건)·ci-entity-quality-browser-check', '재주입 재현: ^KQ11 −1.43%, ^KS11 −5.465%, 005930 −5.58%.',
    '**한국 실시간 등락률 검증 (P1728):** 공급자 전일종가가 한 세션 어긋나도 거래소 종가 기준으로 다시 계산하고, 기준이 없으면 등락률을 만들지 않는다.'),
  e(1729, 'AI 맥락이 화면과 다른 입력·틀(Bull/Base/Bear)을 쓰고 코스피·뉴스 창·장중 속보·기준 시각을 몰랐으며, 단어 수 기반 어조 표시가 남아 있었음',
    'AI 시나리오 맥락이 신용 입력 없이 \'신용 관측 없음 보류\'라고 말했고, 시장 헤더에 코스피가 없었다. 텔레그램 카드·뉴스 목록에 상승/하락 단어 수 어조 칩·점이 남아 모기지 금리 급등 글을 \'긍정 어조\'로 표시했다.',
    'renderMarketScenarioContext({history})만 넘겼고, 헤더가 화면 3흐름과 다른 3분법을 지시했다. 감성 배지 퇴역 뒤 텔레그램·legacy 뉴스 렌더의 어조 집계가 남았다.',
    'collectMarketInputs로 화면과 같은 입력을 전달하고, 헤더에 KOSPI·KOSDAQ 완료 종가·기준일 한 줄을 넣고 확산·집중·동반 약화 3흐름으로 교체했다. 뉴스 맥락에 08:00 창 경계·장중 속보·부재 명시를 넣고, AI 패널 머리에 맥락 기준 시각과 예약 해설 상태(직전본 포함)를 한 줄로 표시한다. 텔레그램 어조 집계·칩·바와 legacy 뉴스 감성 점을 퇴역했다.',
    '근거 없는 신호 금지 / 화면과 AI 한 정의', 'P1729: ci-ai-intelligence-contract-check·ci-esm-core-unit-check·aio-tests T525', '실데이터 fixture: HY 310bp·5/20일 변화 포함, 패널 "맥락 기준 · 시세 … · 뉴스 10/13 08:00까지 + 장중 속보 1건".',
    '**AI 맥락 정합 (P1729):** AI가 화면과 같은 시장 입력·시나리오 틀·코스피·뉴스 창과 장중 속보를 받고, 패널에 맥락 기준 시각을 보여 준다. 단어 수 기반 어조 표시는 모두 퇴역했다.'),
  e(1730, '장중 속보 칸 화면과 브리핑→뉴스 주제 handoff',
    '뉴스 화면에 08:00 이후 사건을 보여 줄 자리가 없었고, 브리핑 다음 단계의 topic/country 문맥을 뉴스 화면이 무시했다.',
    'news.js가 정본 묶음만 렌더하고 handoff에서 ticker만 읽었다.',
    'selectIntradayNews(컷 이전·정본 중복 제외, 최대 6)로 중요 뉴스 위에 \'08:00 이후 장중 속보 · 잠정\' 칸(제목·시각, 출처는 hover, 데이터 없으면 숨김)을 두고, 15:30 이후 머리말에 기준을 밝힌다. topic/country handoff를 기존 필터와 칩에 연결했다.', '잠정 표시 명시', 'P1730: ci-esm-core-unit-check(selectIntradayNews)·브라우저 news 확인', '브라우저: 칸 표시·빈 데이터 hidden·kr/energy 필터 aria-pressed.',
    '**장중 속보 화면 (P1730):** 뉴스 화면 위쪽에 08:00 이후 주요 기사 칸을 잠정 표시와 함께 두고, 브리핑에서 에너지·지정학·한국 뉴스로 바로 이어진다.')
];
const qa = [{
  id: 'QA-VERIFY-19',
  text: 'P1718~P1730: 배포 후 Worker /health의 schedulerDispatch.lastObservation이 accepted 또는 recent-success이고 refresh-data 실행 간격이 1시간 이내로 줄며, data.json에 newsIntraday가 발행되고 marketAnalysis가 verified(또는 retained)로 나오며, 운영 사이트 005930 히어로 등락률이 스크리너 ret1d와 같다.',
  verify_by: 'push·배포 뒤 2~3시간 Worker /health·gh run list·운영 사이트 확인',
  done: false
}];
entries.forEach((entry, index) => {
  const record = { ...base, p: entry.p, qa: index === entries.length - 1 ? qa : [], changelog: [entry.changelog] };
  writeFileSync(join(here, `record-p${entry.p.id}.json`), `${JSON.stringify(record, null, 2)}\n`);
});
console.log(`wrote ${entries.length} records`);
