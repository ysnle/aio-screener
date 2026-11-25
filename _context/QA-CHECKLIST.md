---
verified_by: browser and fixture QA per item (summary; latest evidence in CURRENT-STATE.md and the item rows)
last_verified: 2026-11-25
confidence: medium
---

v60.19 이하 절의 검증 끝난 행은 절마다 `- 완료 <n>건: <QA id 목록>` 한 줄로 줄였다(id 없는 행은 개수만). 열린 행(`- [ ]`)은 원문 그대로 둔다. 행 전문은 git 히스토리: `git show d0bbbcae3:_context/QA-CHECKLIST.md`.

## v60.54 AI 답변과 화면의 같은 사실 (2026-11-25)

- [x] QA-AI-CHANNEL-CLAIM-01: v60.54 시장 조사의 ledger 도구와 단서 메시지는 텔레그램 채널에서 추린 사실(인수합병·경제지표·목표주가 건수)을 '[채널 주장 · 미확인 · 채널 종류 · M/D]' 표시로만 싣고 게시물 원문은 싣지 않으며, 채널 주장 수치만 기댄 price 원인은 막는다. verify_by: node scripts/ci-market-investigation-check.mjs (v60.54 라벨)
- [x] QA-AI-INVESTIGATION-ARTIFACTS-01: v60.54 시장 조사의 company 도구는 컨센서스·실적 공시 요약과 회사 가이던스·다음 실적일·채널 주장을, market_data 도구는 국채 입찰·한국 투자자별 순매수·채널 경제지표를 각 화면의 도메인 리더로 읽는다. verify_by: node scripts/ci-market-investigation-check.mjs (v60.54 라벨)
- [ ] QA-AI-INVESTIGATION-ARTIFACTS-LIVE-01: v60.54 push 뒤 Actions의 시장 조사 실행 trail에 company·market_data 호출이 나타나고, 게시된 원인 중 채널 주장에서 온 것은 inference이거나 검색 문서가 붙어 있다. verify_by: push 뒤 data.json marketInvestigation.trail과 causes를 읽는다
- [x] QA-AI-CHANNEL-CLAIM-MACRO-01: v60.54 매크로 화면 AI 글의 사실 묶음은 최근 1주 채널 경제지표(실제·예상)를 채널 주장(미확인) 표시로만 싣고 게시물 원문·목표주가는 싣지 않는다. verify_by: node scripts/ci-screen-reading-check.mjs (v60.54 매크로 라벨)
- [x] QA-SCREEN-AI-01: 화면 AI 읽기가 금리와 환율(buildRatesFx), 기술적 분석 시장 지수(indexChartReadings·분배일·반등 확인 신호·반등의 다른 시장 확인), 테마와 섹터(playbook 미국 테마 단계), 한국(playbook 한국 테마 단계, 한국 종가)까지 화면이 그리는 같은 도메인 함수로 사실 묶음을 만들고, 금리 주도 하락일과 조용한 날, AI 주도와 방어주 주도, 얇은 한국 자료에서 서로 다른 묶음을 낸다; 자기 사실이 없으면 묶음을 만들지 않는다. (v60.54) verify_by: node scripts/ci-screen-reading-check.mjs
- [x] QA-SCREEN-AI-02: 공통 지시문(src/ai/reading/reading-core.js)이 판단 먼저 → 무엇이 있었나 → 왜 중요한가 → 가격이 반영한 것 → 확인·전환 조건의 한 줄기 추론, 맞지 않는 사실 하나, 조건부 안내를 요구하고 날짜·연도·티커·지수 수준을 담지 않는다; 블록 2개·520자까지 통과하고 셋째 블록·묶음에 없는 수치·지시·목표가·% 확률은 막는다; 화면은 두 블록을 두 문단으로 그린다. (v60.54) verify_by: node scripts/ci-screen-reading-check.mjs
- [x] QA-SCREEN-AI-03: 종목·차트·포트폴리오 AI 분석이 브라우저에서 화면이 이미 계산한 사실(회사 모델·밸류에이션 줄·종목 렌즈, 차트 분석과 시나리오, 포트폴리오 AI 행)로 묶음을 만들고 같은 지시문과 검사를 거친다; 키는 종목·종가·사실 해시이며, 포트폴리오 묶음은 기호·업종·비중·수익률만 담고 저장소에 남지 않는다; 한 번 묻고 이유를 실어 한 번 다시 묻고, 실패·예산 소진이면 이유 한 줄만 남긴다. (v60.54) verify_by: node scripts/ci-screen-reading-check.mjs
- [x] QA-AI-INVESTIGATION-CITATION-01: v60.54 시장 조사 답의 본문에 붙은 인라인 출처 링크(마크다운 링크·괄호 속 주소·맨 주소)는 판정·게시 전에 지우고, 검사가 바뀌면 이전 검사가 막아 둔 같은 단서를 다시 묻는다. verify_by: node scripts/ci-market-investigation-check.mjs (v60.54 인라인 링크 라벨)

## v60.53 시장 조사 (2026-11-25)

- [x] QA-INVESTIGATION-01: 시장 조사의 단서는 market-day 장부의 lead 등급 움직임(자산 자신의 변동 대비 크기)과 직전 세션 대비 바뀐 판정 낱말·시나리오 조건 수에서만 나온다; 금리 주도 하락·조용한 날·한 종목 충격에서 단서가 달라지고, 조용한 날은 요청하지 않고 그렇다고 말한다. (v60.53) verify_by: node scripts/ci-market-investigation-check.mjs
- [x] QA-INVESTIGATION-02: 시장 조사 본문의 수치·날짜는 단서·도구 결과에만 있어야 하고, 보도·공식 원인은 이번 검색이 돌려준 문서의 url·매체·발행일을 가져야 게시된다; 해석(근거 없는 가능성, 추론만 있는 원인)은 경고만 한다. 같은 단서 묶음은 다시 묻지 않고, 검증에 막힌 묶음은 보류되며, 월 예산을 넘으면 요청하지 않는다. (v60.53) verify_by: node scripts/ci-market-investigation-check.mjs
- [x] QA-INVESTIGATION-03: 오늘은 그 종가의 시장 조사를 판정 문장 먼저, 짧은 문단, 단서·출처 접힘 순으로 보이고, 시장 상태는 판정 한 줄과 오늘 링크만 둔다; 블록이 없으면 두 자리 모두 비어 숨는다. 채팅은 같은 조사를 근거 종류와 함께 읽는다. (v60.53) verify_by: node scripts/ci-market-investigation-check.mjs
- [x] QA-REBOUND-QUALITY-01: 반등 시도·추세 회복이 있으면 저점일과 최근 종가를 같은 거래일끼리 비교해 신용(하이일드 스프레드 하락)·달러(DXY 하락)·변동성(VIX 하락이면서 3개월 VIX 아래)·참여 폭(50일선 위 종목 비율 상승과 동일가중 상승)을 확인/미확인/자료 없음으로 판정하고, 확인 수/아는 수와 RULES.reboundQuality로 정한 상태어(다른 시장도 확인·엇갈림·지수만 반등·판단 보류)를 반등 줄 아래 한 줄과 네 항목으로 보인다; 자료 없는 항목은 분모에서 빠지고 이름이 나오며 이웃 거래일 값을 빌리지 않는다; 원인은 단정하지 않는다. (v60.53) verify_by: node scripts/ci-market-story-check.mjs
- [x] QA-REBOUND-QUALITY-02: AI 시장 이야기 사실 줄이 화면과 같은 반등의 다른 시장 확인 판정과 네 항목을 받는다. (v60.53) verify_by: node scripts/ci-market-story-check.mjs

## v60.52 AI 답변과 화면의 같은 사실 (2026-11-24)

- [x] QA-AI-STORY-FRESH-01: v60.52 company_story는 종목 화면과 같은 storyFreshness로 조사일 뒤 새 실적·분기 공시를 알리고 asOf에 조사일과 새 날짜를 함께 싣는다 (P2762) verify_by: node scripts/ci-ai-intelligence-contract-check.mjs (v60.52 company_story 라벨)
- [x] QA-AI-SCREEN-PLAN-01: v60.52 조건 검색 도구 결과는 적용한 조건 id와 적용하지 못한 조건·이유(현금흐름 지표 미계산, 목록에 없는 id)를 밝히고, 설명은 화면과 같다고 하지 않으며 AND만 된다고 말한다. verify_by: node scripts/ci-chat-screen-tool-check.mjs (v60.52 라벨)
- [x] QA-AI-FORECAST-01: v60.52 조건문 결과절의 확률·가능성·기대 수익률 수치는 자료에 있을 때만 남고(없으면 문장이 빠지고 '확률'로 셈), 조건절 임계값·자료에 있는 빈도·수치 없는 조건 해석은 남는다 (P2763) verify_by: node scripts/ci-ai-intelligence-contract-check.mjs (v60.52 forecast 라벨)
- [ ] QA-AI-FORECAST-LIVE-01: v60.52 push 뒤 배포판 AI 패널에서 '연준이 다음 달 금리를 내리면 S&P 500이 오를 확률은?'의 답이 근거 없는 확률 수치를 싣지 않고 조건 설명은 남긴다 (P2763) verify_by: 배포판 AI 패널에서 같은 질문을 묻고 답 본문에 자료 없는 N% 확률이 없는지 본다
- [x] QA-DECISION-FRAME-52A: 판단 틀: 기저율 없는 기록은 횟수만(null·비율 없음), AI 줄의 다리 제목은 한 번씩, 빈 다리는 '비교 자료 없음'; 기록 없는 시나리오도 제 기간(매크로 20거래일, 테마 THEME_OUTCOME_HORIZON)으로 오늘 현금 비교를 적는다. (v60.52) verify_by: node scripts/ci-decision-frame-check.mjs
- [x] QA-DECISION-FRAME-52B: 판단 틀 강조: 평소와 구별되지 않는 기록은 판정이 먼저('과거 빈도: 평소와 구별 안 됨 — …'), 이익·손실 폭은 빈도나 하락 비율이 평소와 구별될 때만 본문, 아니면 접힘; 하락 중앙값은 '사례일 종가 대비'; 빗나가는 조건은 한 줄에 하나, 과거 하락은 따로 한 줄. (v60.52) verify_by: node scripts/ci-decision-frame-check.mjs && node scripts/ci-stock-producer-leftovers-check.mjs
- [x] QA-SCENARIO-STATE-52: 시나리오 변화 기록: 충족 수가 같아도 충족 조건이 바뀌면 '조건 충족 2/3 그대로, 근거가 바뀜 (새로 충족: …; 더 이상 아님: …)', 시장 가격 방향이 사라지면 '시장 가격 자료가 빠져 방향을 읽지 못함(직전: …)'을 남기고, 날짜만 바뀐 스냅숏은 아무것도 남기지 않는다. (v60.52) verify_by: node scripts/ci-scenario-guidance-fixture.mjs
- [x] QA-REBOUND-TERMS-01: 반등 확인 신호(FTD)는 나스닥 종합 기준으로 이름·저점일·규칙을 한 줄에 보이고 '반등 시도'를 쓰지 않는다; 시장 해석의 반등(나스닥 100)이 함께 있으면 두 지수와 엇갈릴 수 있음을 한 줄로 말하고, 거래량 비교가 조기 폐장일이면 그렇다고 말한다. (v60.52) verify_by: node scripts/ci-market-reading-defects-check.mjs
- [x] QA-REBOUND-TERMS-02: AI에 넘기는 시장 이야기 반등 줄은 나스닥 100과 규칙(저점 대비 +5%)을 이름에 담고, 확인 신호 문장은 나스닥 종합과 반등 확인 신호(FTD)를 이름한다. (v60.52) verify_by: node scripts/ci-market-story-check.mjs
- [x] QA-RALLY-COUNT-01: 반등 확인 신호(FTD)의 일수는 저점 다음 거래일이 1일째다(저점은 0일째, 소유자 2026-11-24): 11/20 저점·11/26 휴장이면 11/27이 4일째로 가장 이른 확인일이고 11/25(3일째)는 확인이 아니다; 다른 정의(rally-attempt.v2가 아닌 fieldMeta.rallyPhase.model)로 센 행은 읽지 않는다. (v60.52) verify_by: node scripts/ci-market-reading-defects-check.mjs
- [x] QA-SCR-WORDING-01: v60.52 순위 밖 '가격 정체' 행의 설명은 규칙 임계값(60일 연 변동성·하루 평균 폭)만 말하고 원인을 짓지 않는다 (P2765). verify_by: node scripts/ci-screener-presentation-check.mjs
- [x] QA-SCR-WORDING-02: v60.52 조건 화면의 '왜' 문장은 엔진의 조건별 판정(explainAdmission: exists·range·enum·and/or/not·값 없음 정책·필수 값)을 그대로 읽어, 통과·미달·판정 보류 상태와 어긋나지 않는다. verify_by: node scripts/ci-screener-workbench-contract.mjs
- [x] QA-STOCK-RDCF-01: v60.52 투자 논지의 역 DCF 문장은 계산에 쓴 할인율·영구 성장률을 함께 말하고, 요약과 역 DCF 카드는 같은 함수(reverseDcfAssumptions)로 기본값과 읽는 사람의 값을 고른다. verify_by: node scripts/ci-fiscal-quality-fixture.mjs && node scripts/ci-stock-reading-defects-check.mjs
- [x] QA-SESSION-ALIGN-01: SOXX가 S&P 500보다 한 세션 늦으면 SOXX − S&P 500 20거래일은 비고, 'AI 투자 꺾임' 가격 문장은 두 날짜와 보류를 적는다; 10년물 − 기대인플레이션도 10년물 마지막 날에 짝지어 읽는다. (P2766, v60.52) verify_by: node scripts/ci-scenario-guidance-fixture.mjs
- [x] QA-SESSION-ALIGN-02: 차트 상대강도는 지수와 같은 날 종가인 마지막 봉에서 끝나고 그 날짜를 적는다; 실적 반응의 지수 움직임은 기준일·첫 거래일 모두 그 세션 종가이며; AI 기술 블록 RSI는 차트 마지막 봉 기준이다. (P2766, v60.52) verify_by: node scripts/ci-esm-core-unit-check.mjs
- [x] QA-SESSION-ALIGN-03: 실적 발표 후 첫 거래일은 그 거래소 달력의 첫 세션이며, 그 봉이 없으면 '첫 거래일 종가 없음'과 최근 봉까지의 누적을 날짜와 함께 적는다(한국 상장은 KRX 달력). (P2766, v60.52) verify_by: node scripts/ci-event-briefs-check.mjs

## v60.51 검사 결정성 (2026-11-24)

- [x] QA-CHECK-FIXTURES-01: v60.51 규칙에 대한 검사는 검사 안에 적힌 행이나 scripts/fixtures/의 고정 행을 읽고, public-data를 읽는 단정은 'data' 구역에만 있다. 시계를 읽는 모든 계약 검사는 다음 7일·가까운 휴장일·30일 뒤에 같은 판정을 낸다. verify_by: node scripts/ci-clock-shift-check.mjs
- [x] QA-CHECK-FIXTURES-02: v60.51 데이터 발행 전 검사(chat-screen-tool)는 벤치마크 종가 지연으로 테마 단계가 보류된 정당한 상태에서 발행을 막지 않고, 형식이 깨진 테마 행에서는 막는다. verify_by: node scripts/ci-chat-screen-tool-check.mjs
- [x] QA-DAY-CAUSE-01: 선두 움직임은 지수 기여를 %p로 말하고, 연결된 보도 중 원장 순서(출처 등급·점수)의 첫 보도를 한국어 제목 그대로 오늘·브리핑 본문에 보인다; 연결 보도가 없으면 보도 줄이 없다. (v60.51) verify_by: node scripts/ci-day-cause-check.mjs && node scripts/ci-sentence-claim-replay-check.mjs
- [x] QA-DAY-CAUSE-02: 오늘 주요 뉴스와 뉴스 중요 뉴스는 08:00 묶음과 그 뒤 채점된 기사를 가장 새 기사 기준 24시간으로 합쳐, 선두 움직임과 이어진 기사를 먼저 고른다. (v60.51) verify_by: node scripts/ci-day-cause-check.mjs
- [x] QA-DOMAIN-CLOCK-01: src/domain의 함수는 시계를 스스로 읽지 않는다: 시계 읽기는 내보낸 함수의 매개변수 기본값이거나 호출자가 now/nowMs/asOfMs를 주지 않았을 때의 대체값뿐이다(예외 src/domain/briefing/macro-releases.js, 사유는 검사 안에 적음). 내부 helper가 읽던 시계(SEC 정규화의 보고 경과일·수집 시각, SEC 보고서 신선도, 뉴스 선별 감사 시각, 포트폴리오 시세 증거, 팩터 순위)는 진입점의 now로 이어진다. (v60.51) verify_by: node scripts/ci-market-session-contract-check.mjs
- [x] QA-AI-STORY-DATED-01: AI의 company_story 도구와 종목 질문 맥락은 종목 화면과 같은 날짜가 붙은 회사 이야기(datedStory)를 받는다: '현재'+수량은 'M/D 조사 당시'로 읽힌다. (v60.51) verify_by: node scripts/ci-ai-intelligence-contract-check.mjs
- [x] QA-BOOT-BUDGET-V6051-01: 부팅 예산: 네이티브 모듈 gzip 510,500, 옛 스크립트 gzip 316,500·raw 968,000(시세 등락 기준 규칙이 js/aio-data.js에서 네이티브로 옮겨 가 두 예산의 합은 줄었다). (v60.51) verify_by: node scripts/ci-boot-bundle-budget-check.mjs
- [x] QA-QUOTE-BASIS-01: 미국 지수 시세의 등락은 시세 세션 앞의 기록 종가 기준이다; 제공처 전일종가가 다른 세션이면 기록 종가로 다시 계산하고, 휴장일 사이·기록 없음이면 제공처 짝을 둔다. (v60.51) verify_by: node scripts/ci-esm-core-unit-check.mjs
- [x] QA-OPENING-REBOUND-01: 시장 해석은 고점 대비 -10%에 닿은 나스닥 100의 하락 안에서 가장 낮은 종가보다 5% 이상 높게 마감하면 반등 시도로 읽는다. 첫 문장은 반등 폭과 고점 대비 낙폭(숫자 둘), 둘째 문장은 S&P 500과 나스닥 100의 200일선 위치를 말하고, 진단 줄은 그대로 남는다. 반등 줄은 상태어를 머리에 두고 반등이 시작된 저점(넘으면 반등 실패)과 두 지수의 200일선 수준·종가 대비 거리를 싣는다. verify_by: node scripts/ci-market-story-check.mjs
- [x] QA-OPENING-REBOUND-02: 추세 회복은 저점 뒤 S&P 500과 나스닥 100이 함께 50일선과 200일선 위로 마감한 날부터 둘 다 200일선 위에 있는 동안 이어지고, 반등 실패는 반등이 시작된 저점 아래로 마감한 그 거래일에만 보인다. 시장 상태의 다음에 확인할 가격 조건은 반등이 있을 때 저점·200일선/50일선·바닥 확인일(나스닥 종합 기준) 항목을 앞에 두고, 시장 상태 얼굴에는 반등 줄을 다시 쓰지 않는다. verify_by: node scripts/ci-market-story-check.mjs
- [x] QA-STOCK-RESEARCH-DAY-01: v60.51 회사 이야기의 '현재/지금'+수량과 날짜 없는 추정치 수정 건수는 'M/D 조사 당시'로 그려지고, 프로듀서는 같은 글을 경고한다. verify_by: node scripts/ci-stock-producer-leftovers-check.mjs
- [x] QA-CONSENSUS-SPLIT-BASIS-01: v60.51 분할 전 기준으로 발행된 컨센서스 EPS는 스크리너 행의 분할 사건으로 종가 기준에 맞춰지고, EPS가 종가 이상인 행은 발행 전에 표시된다. verify_by: node scripts/ci-stock-producer-leftovers-check.mjs
- [x] QA-HISTORY-HELD-COPY-01: v60.51 history.json의 보류 사본은 그 세션 주인 행의 값을 싣고, 세션 계산은 주말 행을 읽지 않는다. verify_by: node scripts/ci-stock-producer-leftovers-check.mjs
- [x] QA-THEME-EMPTY-FRAME-01: v60.51 네 다리가 모두 원천 없는 판단 틀은 그리지 않고, 테마 카드의 단계 조건 수는 세는 조건을 모두 적는다. verify_by: node scripts/ci-stock-producer-leftovers-check.mjs
- [x] QA-DAY-CAUSE-03: 종목 머리의 움직임 줄은 그 움직임을 다룬 보도(세션 창 안, 방향 낱말, 회사 이름)만 붙이고, 없으면 움직임만 보인다; 브리핑의 남는 목록은 '움직임을 다룬 보도 없음'으로 적는다. (v60.51) verify_by: node scripts/ci-day-cause-check.mjs && node scripts/ci-esm-core-unit-check.mjs

## v60.50 재무 공시 기간 규칙 (2026-11-24)

- [x] QA-CLAIM-FUND-PERIOD-01: 재무 공시의 '전년보다' 자기자본 변화와 직전 분기 대비 재고·매출채권 변화는 period.js의 1년(300~400일)·한 분기(75~125일) 간격일 때만 나온다. 이익의 질 '위 막대' 문구는 막대가 그려질 때만 붙는다. (v60.50) verify_by: node scripts/ci-sentence-claim-replay-check.mjs
- [x] QA-CLAIM-FUND-02: 재무 공시의 이익의 질·동종 비교 막대·컨센서스 줄의 숫자는 모두 claim에서 찍히고, 디스크의 모든 filer에서 사실과 맞으며 비교하지 못한 claim이 0건이다. claim을 지운 문장과 데이터에서 벗어난 숫자는 실패한다. (v60.50) verify_by: node scripts/ci-sentence-claim-replay-check.mjs
- [x] QA-DATA-COMMIT-SCOPE-02: 데이터 커밋은 public-data/만 바꾼다: 모든 publish set 경로가 public-data/로 시작하고, 발행기는 set 또는 index(스테이징 직후·커밋 직전)에 public-data/ 밖 경로가 있으면 커밋 전에 실패한다. git commit을 하는 워크플로는 발행기 또는 watchdog-browser.yml의 browser-data-fixture 재고정뿐이다. (v60.50) verify_by: node scripts/ci-publish-data-commit-check.mjs
- [x] QA-DATA-COMMIT-SCOPE-03: public-config.json은 릴리스 범위다: appRevision이 version.json과 같고, AI 경로는 PUBLISHED(사유 null) 또는 DISABLED(사유 있음)이며, AI·시세 Worker와 패스트 플레인 주소가 architecture/worker-endpoints.json과 같다. 승격된 패스트 플레인은 권리 검토 플래그와 인증 시각을 가진다. Worker 준비 여부는 브라우저가 /health로 확인한다. (v60.50) verify_by: node scripts/ci-release-revision-check.mjs && node scripts/ci-fast-plane-consumer-gate.mjs && node scripts/ci-ai-budget-scope-check.mjs
- [x] QA-DATA-PATH-SPLIT-01: 모든 게이트는 inputClass code 또는 data를 선언한다(mixed·미선언은 ci-qa-pipeline-contract-check가 거부). 각 originScopes 레인과 --group data --data-run이 고르는 게이트는 모두 data이고, 섹션 픽스처 게이트는 데이터 실행에서 data 섹션만, 그 밖에서는 두 섹션을 모두 실행한다. ai-intelligence(P2749)는 어느 레인의 데이터 실행에도 없다. (v60.50) verify_by: node scripts/ci-qa-pipeline-contract-check.mjs && node scripts/ci-qa-runner-behavior-check.mjs
- [x] QA-DATA-PATH-SPLIT-02: knowledge-lint의 문서 나이(P1125)는 어느 실행에서도 실패하지 않고 경고로만 보고된다. 기준선 파일·--write 경로·watchdog 쌍둥이는 없다. (v60.50) verify_by: node scripts/ci-refresh-origin-live-data-check.mjs
- [x] QA-INDEX-LONGRUN-01: refresh-data 일간 레인이 S&P 500·나스닥 종합·필라델피아 반도체(^SOX)·KOSPI 일봉 종가를 제공처 첫 거래일부터 받아 public-data/index-longrun.json(주간 갱신)에 10% 이상 고점 대비 하락 구간(고점·저점·깊이·거래일 수·회복일)과 1·5·20거래일 하위·상위 2% 움직임(겹치는 구간은 하나로)을 쓴다. readIndexLongrun은 이 표와 history.json의 이후 거래일을 이어 현재 움직임의 순위와 '그 뒤 가장 큰' 날짜, 현재 하락폭과 그만큼 깊었던 과거 구간을 돌려준다. 파일이 아직 없으면 데이터 섹션은 통과한다. (v60.50) verify_by: node scripts/ci-index-longrun-check.mjs
- [x] QA-JUDGEMENT-RULES-01: 시장 폭 판정 옆에 도메인이 낸 속도('중립 · 빠르게 악화')가 시장 상태 행·시장 폭 머리·AI 사실에 같이 보이고 개수는 바뀌지 않는다. 매크로 사분면 머리는 보류일 때도 '물가 목표 위 · 속도 보류, 성장 견조, 연준 인상 국면'처럼 수준·성장·연준 국면을 말한다. 유가와 달러와 물가 속도는 유지 띠로 문턱 근처에서 하루씩 뒤집히지 않고 전환 직전이면 '경계'를 붙인다. 가이드 '기울일 쪽' 첫 줄은 선두 시나리오를 따르고 집계 선택이 다르면 다르다고 적으며, '피할 쪽'에 선두가 고른 선택이 들면 그렇다고 적는다. 대안 시나리오는 선두 다음으로 조건이 많이 맞는 것과 그 꼬리표다. (v60.50) verify_by: node scripts/ci-judgement-rule-redesign-check.mjs
- [x] QA-MARKET-READING-STATE-01: 시장 화면의 고정 문장은 현재 상태를 읽는다: 동일가중 격차는 두 지수 방향과 함께, 한국 쌍은 같은 날짜끼리, 이미 충족된 확인 조건은 충족으로, 완료 세션 값은 '오늘'이 아니라 그 날짜로, 새 저점일은 반등이 아니라 저점으로, 주식·채권 상관은 한 기준으로, 시세 없는 통화는 자기 종가와 날짜로 보인다. (v60.50) verify_by: node scripts/ci-market-reading-defects-check.mjs
- [x] QA-MARKET-STORY-01: 오늘과 시장 상태의 머리말은 집계 꼬리표('부담 우세')가 아니라 시장 해석으로 연다. 세 층: 첫 문장(단계어와 진단을 일상어로, 숫자는 많아야 하나 — 반도체·나스닥 100의 단계, 시장 전체(S&P 500)의 단계, 진단; 장기 기록표가 그 낙폭을 자리매김하면 숫자 대신 '…이후 가장 깊은 하락'), 종가 고점 대비 막대 다섯(반도체·나스닥 100·S&P 500·다우·동일가중, 한 눈금, -10% 조정·-20% 약세장 점선), 진단 한 줄(상태어, 이유 하나, 신용 스프레드와 빠른 확대일 때만 5거래일 변화, 바뀌는 조건 하나). 기록 문장은 그 아래 작은 한 줄(묶음당 하나). 단계어 조정 -10%·약세장 -20%·약세장 문턱 -19~-20%·조정 전; 진단은 나스닥 100과 동일가중의 낙폭 차이 5%p, 하이일드 450bp와 5거래일 +25bp, 실업률·청구 성장선으로 정한 쏠림 되돌림·침체형·금융 불안형·판단 보류. 나스닥은 화면 어디서나 나스닥 100 하나이고 장기 기록표도 ^NDX다. 반도체는 필라델피아 반도체 지수(SOX)이며 오늘 지수 카드의 SOXX와 이름이 다르다. 모든 숫자와 단계어는 주장(claim)으로 찍고 문장 재생 검사가 매 세션 사실과 대조한다. today-verdict.json에 story 줄이 실리고, story가 없는 옛 기록은 heroLine을 그린다. (v60.50) verify_by: node scripts/ci-market-story-check.mjs
- [x] QA-SCREENER-TOP-PICK-01: 200일선 아래이거나 5거래일 급락인 종목은 스크리너 목록에 순위대로 남고 백분위 옆에 '반대 조건 N'이 붙으며, 종목 화면의 '스크리너 백분위 상위, 미국'에는 나오지 않는다. 순이익률이 자기 이전 회계연도 중앙값의 2배 이상(5%p 이상, 3개 연도 이상)인 종목은 반대 조건에 '낮은 PER이 이익 정점일 수 있음'이 숫자와 함께 붙고, 순위 점수는 바뀌지 않는다. (v60.50) verify_by: node scripts/ci-screener-rank-redesign-check.mjs
- [x] QA-STOCK-PRICED-IN-01: 종목 개요 '재무 한눈에'의 '이 주가가 반영하는 것'(src/domain/fundamental/priced-in.js buildPricedInRead)은 컨센서스 행과 스크리너 행만으로 네 상태 중 하나를 규칙으로 정해(RULES.pricedIn, 접힌 '상태를 정하는 법'에 기준 표기) 가격이 무엇을 가정하는지 쓴다: 이익 감소를 먼저 반영(고점 대비 -35% 이하, 추정치 하향 없음, 예상 이익 > 직전: 추정치대로면 직전 이익 기준보다 낮은 가격이고 이익이 추정치보다 1 − 직전 EPS ÷ 예상 EPS 넘게 줄면 그렇지 않다, 정점 경고는 '경기순환주의 PER 역설'과 함께 한 절), 주가와 추정치가 함께 내려가는 중(하향이 상향보다 2건 이상 많음: 배수는 아직 바닥 근거가 아님), 기대가 이미 가격에 있음(고점 -10% 안, 직전 PER 28배 이상, 예상 이익 증가 10% 이하: 이익보다 높은 배수에 기대는 가격), 그 밖은 두 숫자만. 정점 경고는 컨센서스 줄에서 빠졌다. 적자·분할 기준 의심(PE_PLAUSIBLE_MIN)·일회성 기준 차이·200배 초과면 줄이 없다. 모든 숫자는 claim으로 나와 문장 재생 검사가 대조한다. (v60.50) verify_by: node scripts/ci-stock-reading-defects-check.mjs
- [x] QA-PORTFOLIO-LEADERS-01: 포트폴리오 첫 문장(buildPortfolioRead headline)은 보유 금액 중 주도 영역(AI·반도체: ai-chain-flow.js leaderMembers, LEADER_THEMES 하위 테마 구성 종목)의 비중과, 그 묶음과 나머지의 52주 종가 고점 대비 평균(평가액 가중, 종가 날짜 표시)을 먼저 쓴다. 한국 상장 종목은 미국 테마 지도 밖이라 '미국 보유 금액'으로 이름을 바꿔 빼고, 테마 지도가 없으면 줄이 없다. 주도주 묶음(LEADER_THEMES)과 AI 설비투자 사슬(market-flow.js AI_CAPEX_CHAIN_THEMES, 전력·유틸리티 포함)은 다른 개념이라 이름을 나눴다. (v60.50) verify_by: node scripts/ci-review-integrity-unit-check.mjs
- [x] QA-STOCK-READING-01: 종목 화면 문장은 음수 내재 성장을 감소로, 직전 해가 같은 부호면 '돌아섰습니다' 없이, 직전 분기가 4개 분기보다 크게 빠르면 '빨라짐'으로 읽는다. 정점 경고가 있으면 배수 경로도 같은 경고를 쓰고, 순이익 성장 100% 초과면 PEG를 적지 않으며, 4개 분기 EPS 합이 종가 이상이면 PER을 보류한다. (v60.50) verify_by: node scripts/ci-stock-reading-defects-check.mjs
- [x] QA-STORY-SCREENS-01: 시장 해석을 다섯 화면에 잇는다. 각 화면 첫 줄은 도메인이 주장(claim)으로 만든 쉬운 문장이고, 그림은 기존 막대(종가 고점 대비 막대, fallFrame/fall-bars)를 다시 쓴다. 시장 폭: 판정 사유 꼬리표('참여 비율 중간')를 원자료 표로 내리고 '지수는 조정이지만 종목은 더 깊습니다. 관찰 중인 미국 종목 절반이 1년 고점에서 N% 넘게 내렸고, n 중 하나꼴은 반 토막입니다.'(스크리너 미국 종목·펀드 제외, 52주 종가 고점 대비 중앙값 버림, 반 토막 -50% 이하 RULES.story.halfOffPct, S&P 500·동일가중·종목 중앙값 막대). 투자 심리: 판정 사유 꼬리표('공포 쪽 쏠림 (6/6)')를 VIX 구간 기록 한 줄로 바꾼다(지금 VIX 구간 뒤 21거래일 안 -5% 이상 하락 비율과 21거래일 뒤 상승 비율을 평소와 비교, analogs pastEvidence의 표본 오차 2배를 넘을 때만 잦았다·드물었다, 사례 10개 미만이면 줄 없음, 공포·탐욕은 긴 기록이 없어 VIX로 봄). 기술적 분석: 장기 기록표가 있을 때만 지수 카드 아래 '지난 하락과 비교' — 나스닥 100 한 줄(10% 이상 하락 구간 가운데 몇 번째로 깊은지, 약세장 문턱이면 '약세장 기준(-20%)까지 N%p')과 구간 막대(고점 월, 낙폭, 고점→저점 거래일), 다른 지수는 한 줄과 접힌 막대. 브리핑: 첫 줄의 이끄는 미국 지수 하루 등락에 순위 하나 — 기록이 1년 이상일 때 기록 중 가장 많이 내린/오른 하루(재생 검사가 record:<지수>:change1d로 대조), 장기 기록표가 같은 세션까지 있으면 '…이후 가장 큰 하루 하락'(같은 크기의 마지막 사례가 1년 넘게 전일 때만). 테마와 섹터: 요약 카드 첫 줄 '주도 테마(AI·반도체) 종목은 1년 고점에서 평균 N% 내렸고, 나머지 테마 종목은 평균 M%입니다.'(LEADER_THEMES leaderMembers, 단순 평균, 종목 수는 접힘). 크기 낱말은 계산으로 참일 때만, 매수·매도 지시 없음. (v60.50) verify_by: node scripts/ci-market-story-check.mjs

## v60.49 재무 숫자의 기간 계약 (2026-11-23)

- [x] QA-CLAIM-FUNDAMENTAL-01: 재무 공시의 재무 흐름 문장(fiscal-read buildFiscalRead)과 분기 문장(quarter-read buildQuarterRead·buildWorkingCapitalRead)은 숫자를 claim의 figure로만 찍고, 각 figure는 기간(FY·TTM·Q·SPAN·M6)과 변화의 기준 기간을 가진다. 디스크의 모든 SEC 공시 기업에 대해 문장마다 기간·값·기준 기간이 사실과 맞는다. (v60.49) verify_by: node scripts/ci-sentence-claim-replay-check.mjs
- [x] QA-CLAIM-FUNDAMENTAL-02: 검사기는 기간 없는 금액·비율 figure, 다른 종류 기간을 기준으로 한 변화(FY 대 분기), 한 단계가 아닌 기준(3년 전을 전년으로), 선언 없이 두 기간을 섞은 claim, 데이터가 다른 종류 기간에만 가진 값(4개 분기 PER을 회계연도로)을 각각 오류로 잡는다. (v60.49) verify_by: node scripts/ci-sentence-claim-replay-check.mjs
- [x] QA-CLOCK-SHIFT-01: 벽시계를 읽는 비브라우저 계약 검사는 다음 7일 모든 요일과 가장 가까운 NYSE·KRX 휴장일에도 오늘과 같은 판정을 낸다. (v60.49) verify_by: node scripts/ci-clock-shift-check.mjs
- [x] QA-DATA-COMMIT-SCOPE-01: asset·release manifest에는 데이터 revision 필드가 없고, 데이터 revision은 operations-status.json 한 곳에만 있다. (v60.49) verify_by: node scripts/ci-release-revision-check.mjs && node scripts/ci-operations-contract-check.mjs

## v60.48 v60.48 (2026-11-22)

- [x] QA-v6048-relay-only: v60.48 P2748 배포 스크립트 어디에도 '직접 호출 뒤 릴레이' 줄이 없다. verify_by: node scripts/ci-proxy-continuity-check.mjs
- [x] QA-v6048-panel-chunk: v60.48 AI 패널(src/ui/chat/panel.js)은 번들의 지연 청크이고, AI 컨트롤에 닿기 전에는 받지 않는다. verify_by: node scripts/ci-boot-interaction-check.mjs
- [x] QA-v6048-runner-static-through: v60.48 로컬 QA 실행은 앞 단계가 실패해도 정적 단계를 끝까지 돌고 브라우저 단계만 건너뛴다 (CI는 단계별 중단 유지) verify_by: node scripts/ci-qa-runner-behavior-check.mjs

## v60.47 보유 종목 입력 거부 (2026-11-22)

- [x] QA-HOLDING-REFUSAL-FOLD-FOCUS-01: 닫힌 접힘 안의 입력란이 거부되면 접힘이 열리고 그 칸이 포커스를 받는다. verify_by: node scripts/ci-esm-core-unit-check.mjs

## v60.46 AI 답변 안내 줄 (2026-11-22)

- [x] QA-AI-APP-FIGURES-NOTICE-01: v60.46 앱 자료·도구 결과로 확인된 수치를 보여 주는 AI 답변은 '일반 설명만' 안내를 달지 않고 근거 표시가 '앱 자료 근거'다. 일부 수치를 뺀 답은 '확인된 값만 표시', 모든 수치를 뺀 답만 '일반 설명만'. verify_by: node scripts/ci-ai-intelligence-contract-check.mjs
- [x] QA-AI-NEGATED-SEARCH-01: v60.46 "검색 없이"·"검색하지 말고"·"without search" 같은 부정 구절은 AI 리서치 판정에서 검색 요청(requestedByUser)이 아니고, "검색해줘"·"search"는 여전히 요청이다. verify_by: node scripts/ci-ai-intelligence-contract-check.mjs
- [x] QA-EARNINGS-PERIOD-01: 실적 줄의 예상 대비는 분기 줄에만 붙는다 — 연간·9개월·누적·반기·회계연도 줄은 발표 수치만 보이고, 예상치의 발표 전 확인 시각은 발표 시각보다 늦지 않다. (v60.46) verify_by: node scripts/ci-esm-core-unit-check.mjs && node scripts/ci-event-briefs-check.mjs
- [x] QA-VIX-RISK-SAMPLE-01: VIX 구간 낙폭 줄의 비율과 사례 수는 같은 겹치지 않는 사례에서 나온다 — '겹치지 않는 사례 N개 중 M개'. (v60.46) verify_by: node scripts/ci-market-lean-validation-check.mjs
- [x] QA-CLAIM-UNLINKED-01: 문장 주장 검사는 비교할 사실이 없는 주장을 'unlinked' 경고로 따로 세고, 검증됨으로 보고하지 않는다. (v60.46) verify_by: node scripts/ci-sentence-claim-replay-check.mjs
- [x] QA-TW-TABLE-DATE-01: 대만 월매출의 出表日期는 tableDate(표 생성일)로 저장되고 공시일로 쓰이지 않는다. (v60.46) verify_by: node scripts/ci-tw-monthly-revenue-fixture.mjs
- [x] QA-EARNINGS-SCOPE-01: 부문·항목 매출 줄(구독·로열티·서비스 등)은 회사 전체 매출 예상치와 비교하지 않고 발표 수치만 보인다. (v60.46) verify_by: node scripts/ci-esm-core-unit-check.mjs && node scripts/ci-event-briefs-check.mjs
- [x] QA-AI-VIX-SAMPLE-01: AI의 VIX 구간 기록은 화면과 같은 겹치지 않는 사례의 비율과 개수를 말한다. (v60.46) verify_by: node scripts/ci-ai-intelligence-contract-check.mjs
- [x] QA-MASTERS-SHARED-LINK-01: #masters?manager=<id>는 그 운용사를 연다. 카탈로그가 오기 전에는 '불러오는 중', 목록에 없는 id는 '목록에 없음'을 보이고, 다른 운용사로 바꾸거나 주소를 다시 쓰지 않는다(v60.46). verify_by: node scripts/ci-masters-contract-check.mjs
- [x] QA-MASTERS-VALUE-SCALE-01: 13F 금액 단위 판정은 생산자가 모든 운용사의 전체 행으로 하고 holdings-summary.json의 managers[].verification.valueScaleReview로 게시한다. 화면은 그 상태만 읽고 직접 판정하지 않는다(v60.46). verify_by: node scripts/ci-masters-contract-check.mjs
- [x] QA-13F-DEADLINE-HOLIDAY-01: 13F 마감일은 주말과 등록된 미국 휴장일을 건너 다음 영업일이다(2026-02-14 → 2/17). 등록 표가 없는 해는 주말만 건넌다(v60.46). verify_by: node scripts/ci-masters-contract-check.mjs
- [x] QA-MASTERS-STALE-SUBMISSION-01: 13F 보유가 다음 마감을 넘긴 운용사는 어느 탭에서든 분기 말 칩에 사유(13F-NT면 다른 신고자 보고)가 있고, 보유 신고보다 뒤의 제출이 있으면 그 서식·제출일·분기가 제출일 줄에 있다(v60.46). verify_by: node scripts/ci-masters-contract-check.mjs
- [x] QA-SCORE-BACKTEST-NEFF-01: 시장 점수 백테스트의 유효 표본은 세션 위치로 센 겹치지 않는 창 수이고, 보유기간마다 바닥 30 미만이면 insufficient로 표시된다. verify_by: node scripts/ci-research-model-contract-check.mjs
- [x] QA-SCORE-BACKTEST-RESTATE-01: 시장 점수 백테스트 파일은 과거 행이 실행마다 재계산된다는 것과 재계산 시작 세션을 적는다. verify_by: node scripts/ci-research-model-contract-check.mjs
- [x] QA-COMPANY-CHIP-PAYS-FOR-01: 종목 개요의 관계 칩은 money-flow 연결이면 이름 옆에 무엇에 대한 대금인지 이야기 원문 문구로 보여 주고, 그 문구가 없는 연결에는 아무것도 붙이지 않는다. verify_by: node scripts/ci-company-profile-contract-check.mjs
- [x] QA-CHARTS-HEADER-DRAWN-01: 기술적 분석 머리글의 종가 날짜는 미국 지수 카드가 실제로 그린 마지막 봉의 날짜이고, 카드가 아직 없을 때만 history 종가 날짜다. verify_by: node scripts/ci-domain-parity-check.mjs
- [x] QA-KNOW-SOURCE-URL-01: 날짜 붙은 지식 출처는 그 발표본 주소를 가리킨다(?lv=true·BLS 현재 발표·/latest 금지). 주소 생존은 report-knowledge-source-liveness로 출처 갱신 때 확인한다. verify_by: node scripts/ci-knowledge-corpus-check.mjs
- [x] QA-SCR-RANGE-01: RSI 최소가 최대보다 크면 두 칸이 잘못된 값으로 표시되고, 미리보기와 표는 같은 최소·최대를 쓴다. verify_by: node scripts/ci-esm-core-unit-check.mjs
- [x] QA-SCR-COMPARE-REMOVE-01: 비교 트레이의 종목마다 빼기가 있고, 빼거나 비운 뒤 포커스가 다음 종목이나 비교를 추가한 컨트롤에 있다. verify_by: node scripts/ci-esm-core-unit-check.mjs
- [x] QA-NAV-BACK-FOCUS-01: 메뉴를 연 채 뒤로 가면 메뉴가 닫히고 포커스가 새 화면 제목에 있다. verify_by: node scripts/ci-esm-core-unit-check.mjs
- [x] QA-NAV-BACK-SEARCH-01: 검색 창을 연 채 뒤로 가면 창이 닫히고 포커스가 새 화면 제목에 있다. verify_by: node scripts/ci-esm-core-unit-check.mjs
- [x] QA-CHART-LAYER-RESET-01: 봉 데이터를 받지 못한 주기에서 이전 차트의 레이어 칩과 읽기 줄이 남지 않는다. verify_by: node scripts/ci-esm-core-unit-check.mjs
- [x] QA-SHELF-OPENED-01: 서가는 연 글을 "열어 봄"으로 세고 "읽음"이라고 쓰지 않는다. verify_by: node scripts/ci-esm-core-unit-check.mjs
- [ ] QA-SEARCH-IME-ESCAPE-01: 검색 칸에서 한글 조합 중 Escape는 조합 중인 글자만 취소하고 확정한 글자와 결과는 남는다(명령 검색, 스크리너 표에서 찾기). verify_by: node scripts/ci-esm-core-unit-check.mjs
- [x] QA-PF-REFUSAL-FOCUS-01: 보유 종목 추가의 모든 거부(빈 티커, 수량, 단가, 모르는 티커, 원가 통화, 목표가)가 그 칸에 표시하고 포커스를 옮긴다. verify_by: node scripts/ci-esm-core-unit-check.mjs
- [x] QA-DATA-RUN-CODE-GATES-01: architecture/qa-pipeline.json의 모든 게이트는 inputClass(data·code)를 선언한다(v60.50에 mixed 폐지). 데이터 실행(생산자의 push 전 검사 data-commit·--data-run, 데이터 전용 커밋의 축소 범위 CI)은 data 게이트만 돌리고 그 안의 code 섹션을 건너뛴다. 코드 push CI는 모든 게이트를 돌린다. 클래스 없이 등록된 게이트는 ci-qa-pipeline-contract-check가 거부한다. verify_by: node scripts/ci-qa-runner-behavior-check.mjs && node scripts/ci-qa-pipeline-contract-check.mjs
- [x] QA-OPS-STATUS-NO-CODE-COPY-01: public-data/operations-status.json은 라우트 소유 목록(routes, reconciliation.routeCount)을 싣지 않는다. 발행 계약이 그 필드를 버린다. verify_by: node scripts/ci-operations-status-check.mjs
- [x] QA-OVERLAY-PRODUCER-PATHS-01: data overlay 릴리스는 PRODUCER_WRITTEN_PATHS만 데이터 커밋에서 가져오고 나머지(생성된 지식 파일 포함)는 코드 커밋 그대로다. 그 밖의 경로를 바꾼 커밋은 코드 커밋이다. verify_by: node scripts/ci-release-source-check.mjs
- [x] QA-SCENARIO-STATE-SCREENER-BASIS-01: scenario-state.json의 basis.screenerComputedAt이 만든 screener.json을 가리키고, 테마 1개월 수치의 발행본·다시 계산 비교는 같은 종가·같은 screener.json·보류 아닌 행에서만 한다. verify_by: node scripts/ci-scenario-guidance-fixture.mjs
- [x] QA-FRED-RELEASE-THROTTLE-01: data.json의 FRED 월별 시리즈 중 공식 발표 일정이 있는 10개(CPI 4, PCE 2, 실업률, 고용, 시간당 임금, 소매판매에서 직전 값이 FRED 값인 것)는 발표 사이에 다시 받지 않고 이전 값을 관측일 그대로 잇는다. 발표일에는 08:30 ET부터 12시간 동안 매 실행 받으므로 새 값은 FRED가 올린 뒤 첫 실행에 들어온다. 일정이 없는 FEDFUNDS·HOUST와 일별 시리즈는 매 실행 받는다. macro-history도 같은 규칙(scripts/lib/series-fetch-due.mjs)을 쓴다. verify_by: node scripts/ci-data-audit-contract-check.mjs
- [x] QA-VKOSPI-RETIRED-01: 브라우저는 VKOSPI를 받지 않는다(fetchVkospiDynamic, 실패 상태, DATA_SNAPSHOT.vkospi 시드, VKOSPI 기호 시드 삭제). krDynamic 작업은 네이버 한국 시세만 받는다. 프로듀서도 VKOSPI를 발행하지 않는다: 읽는 화면이 없고 KRX 재배포 권리가 미확정이다(reconciliation 'kr-macro-vkospi-supply'). verify_by: node scripts/ci-runtime-contract-check.mjs
- [x] QA-FAST-QUOTES-CLOCK-01: 데이터 플레인 Worker는 미국(04:00-20:00 ET) 또는 한국 장이 열려 있을 때만 5분마다 시세를 발행하고, 그 밖에는 30분에 한 번(BTC/ETH) 발행한다. 장 판단은 브라우저와 같은 src/app/refresh-session-policy.js를 읽고, 워크플로 4종 실행은 5분 슬롯을 그대로 쓴다 (v60.46). verify_by: node scripts/ci-data-plane-contract-check.mjs
- [x] QA-PROXY-ALLOWLIST-01: AI 프록시 Worker 중계 허용 목록과 브라우저 사본(_AIO_SHARED_WORKER_HOSTS)에 호출처 없는 호스트(공포탐욕 3종, 환율 기준가 2종, 번역 2종, rss2json.com)가 없고, JSON 수용 규칙에도 없다 (v60.46). verify_by: node scripts/ci-proxy-continuity-check.mjs
- [x] QA-HISTORY-TIME-SESSIONLESS-QUOTE-01: 세션 없는 날에 찍힌 스냅샷 시세는 이력 최신 행과 비교하지 않는다(이력은 마지막 세션 값을 유지한다). verify_by: node scripts/ci-history-field-time-contract-check.mjs
- [x] QA-SHARED-AI-READY-PANEL-GLOBALS-01: callSharedAi는 패널 로더가 채팅 전역을 설치한 뒤에 요청을 만든다. 던져진 오류는 게이트에서 멈춤이 아니라 오류로 보인다. verify_by: node scripts/ci-ai-chat-public-route-browser-check.mjs

## v60.45 차트 화면 AI 패널 (2026-11-22)

- [x] QA-AI-CHARTS-PANEL-01: 기술적 분석 화면(#technical, #charts)에서 AI 패널을 열면 입력창과 전송 버튼이 켜져 있고, 모든 라우트에 패널 컨텍스트가 있다. verify_by: node scripts/ci-ai-intelligence-contract-check.mjs

## v60.32 축소 배치와 배포 정지 복구 (2026-11-20)

- [x] QA-CI-ENTITY-WAIT: 종목 화면 품질 검사는 상장 설명의 출처 링크가 나타난 뒤에 개요를 읽는다 (P2688) verify_by: node scripts/ci-entity-quality-browser-check.mjs

## v60.31 리서치 라이브러리 (2026-11-19)

- [x] QA-AI-MAP-01: 산업 지도 › AI 지도(#atlas?mode=aimap)는 세 지도다. 밸류체인은 7층 카드를 위(7층)에서 아래로 쌓고 카드 사이 연결선은 없다. 각 카드의 '공급하는 곳' 한 줄이 그 층이 공급하는 모든 위층과 공급 관계 수(company-graph.v1 supply 엣지, 공급하는 회사의 층 → 사는 회사의 층)를 많은 순으로 적고(위층 공급이 없으면 그 줄이 없다), 아래층으로 가는 관계는 원자료 표 접힘 하나에만 있다(layerUpwardSupply); 위층 이름을 누르면 카드 아래에 기업 쌍, 층을 누르면 그 층 기업, 기업 칩은 종목 개요를 연다. 데이터센터·전력은 공용 그래프 부품(src/ui/components/node-graph.js, 개념 지도와 공유)으로 그린다. 자본순환은 한 회사를 가운데 두고(기본은 거래가 가장 많은 회사, 거래 수 순 회사 버튼, &node= 주소) 왼쪽 들어오는 돈(그 회사가 받는 쪽인 거래, 보증은 의무를 지는 회사 쪽에도), 오른쪽 나가는 약정을 금액 순으로 놓고, 달러 금액만 열 안 막대, GW는 글자로, 양쪽에 모두 있는 상대 회사는 '양쪽에 있음'과 위의 한 줄로 이름을 적는다(capitalFocus); 금액은 기준이 달라 더하지 않는다. 390px에서 세 열은 들어오는 돈 → 회사 → 나가는 약정으로 쌓인다. 주소: &layer=1~7, &map=datacenter|capital, &node=<종목|@비상장|단계>. 접힘은 계산 방법·데이터 출처뿐이다(ci-fold-kind-check atlas-ai-map). 1440·820·390px 라이트·다크에서 가로 넘침과 페이지 오류가 없다(v60.31). verify_by: node scripts/ci-fold-kind-check.mjs && node .claude/skills/verify-aio/scripts/verify-aio.mjs drive learn --viewport desktop, then --viewport phone (AI 지도 step)
- [x] QA-CAPITAL-FLOWS-01: public-data/atlas/capital-flows.json(ai-capital-flows.v1)은 atlas 기준 자료와 따로 둔 날짜 있는 거래 자료다. scripts/ci-capital-flows-contract-check.mjs가 스키마, 모든 엣지의 https 출처·날짜·발표일, 상장 노드 id가 us-listings 또는 company-profiles index에 정확히 존재(비상장은 @), filing|company가 아닌 엣지의 status '보도', 금액의 unit·amountBasis, 평가어·매매 문구 금지를 강제하고, reviewedAt 180일 초과는 실패가 아니라 화면의 '기준일 지남' 칩으로 나오는지 오프라인 문서에 렌더해 확인한다(파일 없음은 통과, 지도는 숨김). 자기 시험 22건(가운데 회사 보기의 양쪽 판정·정렬·막대, 밸류체인 층별 위층 공급 포함)(v60.31). verify_by: node scripts/ci-capital-flows-contract-check.mjs
- [x] QA-AXIS-FACTS-01: 시장 상태 축(추세·시장 폭·변동성·금리·신용·달러와 원자재·환율, 심리·AI·반도체 집중)은 코드가 조립한 서술 문장(read)을 내지 않는다. 판정 이유는 고정 어휘 표(AXIS_REASONS)의 '판정 사유' 근거 행 하나로(유지 시작일·기록 순위·판정에서 제외한 관측일은 괄호 안 값), 최근 흐름은 '최근 흐름 (5거래일)' 행으로, 드문 코스피 움직임은 변동성 축의 '한국 (미국 종가 판정과 별도)' 행으로, 브렌트·WTI 보류 때는 '브렌트' 행으로 남는다. 판정 규칙은 그대로라 history.json 420개 세션 전부에서 각 축의 state·flip·flipDistances와 기존 evidence 행이 작업 전과 같다(v60.31). verify_by: node scripts/ci-scenario-guidance-fixture.mjs && node scripts/ci-regime-scenarios-fixture.mjs && node scripts/ci-metric-consistency-check.mjs && node scripts/ci-esm-core-unit-check.mjs
- [x] QA-AXIS-FACTS-02: 시장 상태 축 행의 '지금 읽기' 카드, 시장 폭 상단 줄(#breadth-read), 매크로의 공유 축 카드(금리·신용·유가·달러)는 '판정 사유' 값을 보여 주고 같은 값을 근거 표에서 두 번 적지 않는다. 문장이 없어도 1440·390px에서 가로 스크롤과 콘솔 오류가 없다(v60.31). verify_by: node .claude/skills/verify-aio/scripts/verify-aio.mjs drive market --viewport desktop, then --viewport phone; drive macro at both viewports
- [x] QA-BREADTH-FACE-01: 시장 폭은 판정(#breadth-state, 판정 사유 #breadth-read) → 반대 근거 한 줄(#breadth-counter, 판정이 선 쪽의 반대편에 있는 지표의 제목과 값, 없으면 숨김) → 판정이 바뀌는 조건과 거리(#breadth-flip) → AI 읽기(#breadth-screen-reading) → 그룹별 지표 행 9개(.bb-rows > .ind-row, 접힘 없음: 값·기준선 구간·가장 가까운 기준선까지·5/20일 변화) → 차트 9개 순서다. 축의 관측값·임계 거리·규칙·S&P 500 구성 종목 수치는 #breadth-raw, 신고가·신저가·급등락 종목 목록은 차트 아래 raw-table 접힘, 지표 정의와 시장 폭 원리는 #breadth-method에 있다. scripts/ci-fold-kind-check.mjs SCREENS.breadth가 v60.30 구조(기준 noteFold, 나머지 지표 보기, 종목 보기, deepDiveFold)에서 실패한다(v60.31). verify_by: node scripts/ci-fold-kind-check.mjs && node .claude/skills/verify-aio/scripts/verify-aio.mjs drive market --viewport desktop, then --viewport phone (시장 폭 접힘 종류 집계 step)
- [x] QA-SENTIMENT-FACE-01: 투자 심리는 공용 심리 판정(시장 상태 참고 행, #sentiment-state·판정 사유 #sentiment-read) → 상태어 집계 한 줄(#sentiment-synthesis, 문장 없음) → 반대 근거 또는 같은 쪽이 아닌 지표(#sentiment-counter) → 공포·탐욕 위치 막대 → AI 읽기(#sentiment-screen-reading) → 지표 행 4개(#sentiment-card-grid > .ind-row: 값·상태어·다음 경계까지·변화·경계 규칙) → 지표 추이 차트 → 지수별 가격 온도(타일·순위 막대·2년 차트는 본문, 과거 결과는 raw-table) 순서다. 카드 모델은 src/domain/market/sentiment/sentiment-model.js(buildSentimentModel·sentimentCounter·termRatioDistance)이고 AAII는 공용 시장 입력(inputs.js regimeMarketInput aaii, data.json marketSurveys.aaii)에서 읽는다. 접힘은 #sentiment-raw·#sentiment-method·온도 raw-table·데이터 출처뿐이며 ci-fold-kind-check SCREENS.sentiment가 v60.30 구조에서 실패한다(v60.31). verify_by: node scripts/ci-fold-kind-check.mjs && node scripts/ci-screen-reading-check.mjs && node .claude/skills/verify-aio/scripts/verify-aio.mjs drive market --viewport desktop (투자 심리 접힘 종류 집계 step)
- [x] QA-CHART-SCALE-01: 오늘 지수 줄의 5분봉 캔들은 각자의 시각 슬롯(9:30=0, 16:00=78)에 그려진다. 시세 제공처가 값 없이 보낸 구간은 비워 두고, 16시 종가 봉은 카드 오른쪽 끝에 있다. 기술적 분석 일봉 카드는 카드 폭을 채우고 가격 축이 라벨 폭(약 52px)이며 로고가 없고, 같은 줄 카드의 차트가 같은 선에서 같은 높이로 시작한다. 캔들 차트 가격 축은 라벨이 잘린 눈금을 그리지 않는다(v60.31). verify_by: node scripts/ci-chart-scale-browser-check.mjs && node scripts/ci-esm-core-unit-check.mjs
- [x] QA-CHART-SCALE-02: Worker 프록시는 종가가 절반 넘게 null인 Yahoo chart 응답을 받으면 캐시하지 않는 일회용 키로 한 번 다시 요청해 온전한 응답을 돌려주고, 그래도 비어 있으면 no-store로 내보낸다. 온전한 응답은 상위 요청 한 번, max-age 120 그대로다(v60.31). verify_by: node scripts/ci-worker-relay-check.mjs
- [x] QA-CHART-OVERLAP-01: 캔들 차트(기술적 분석 지수 카드·분석 자리)의 마지막 봉은 매물대 막대 왼쪽에 그려지고, 현재가·기준선 값은 가격 축 라벨이 아니라 플롯 안 태그로 그려져 눈금 숫자와 겹치지 않으며 태그끼리도 겹치지 않는다(v60.31). verify_by: node scripts/ci-chart-scale-browser-check.mjs
- [x] QA-CHARTS-PAGE-01: 기술적 분석(#page-charts)은 종목 검색(#charts-search-open) → 시장 지수 보기(일봉·지수 추세를 합친 카드 6장: 나스닥100·S&P 500·반도체·러셀2000은 ETF 일봉 캔들, 코스피·코스닥은 종가 선) → 대표 종목 보기(행마다 추세 단어, 누르면 분석 자리에 열림) → 분석 자리(#stock-chart-section, 페이지에 하나, 기본 SPY) 순서다. 카드 판정 단어는 분석 자리와 같은 분류기(src/domain/technical/trend-state.js trendOfBars)에서 나오고 카드 접힘은 원자료 표 하나다. 검색 결과·대표 종목 행·카드의 '분석 열기'는 같은 화면 분석 자리에 열리고 주소는 #charts?sym=<SYM>이 된다(v60.31). verify_by: node scripts/ci-architecture-browser-check.mjs && node scripts/ci-fold-kind-check.mjs && node .claude/skills/verify-aio/scripts/verify-aio.mjs drive charts --viewport desktop, then --viewport phone
- [x] QA-CHARTS-STOCKS-01: 대표 종목 보기는 시장 지수와 같은 카드 부품(src/ui/components/market-candles.js createChartCards)으로 종목마다 카드 하나를 'S&P 500 비중 상위'·'오늘 크게 움직인 종목' 묶음에 그린다: 판정 단어·사실 한 줄·칩·일봉 차트·원자료 표 접힘·분석 열기. 보기가 닫혀 있을 때는 종목 일봉을 요청하지 않고, 카드가 화면에 들어올 때만 요청하며 동시에 4개를 넘지 않는다. 일봉이 없는 종목은 빈 차트 없이 '11/18 종가 기준 일봉 값 없음'과 판정 '값 없음'을 보인다. 같은 줄 카드의 차트 시작선이 1px 안에서 맞고, 그린 카드는 마지막 봉·가격 태그 단언을 지킨다. 스크리너 수치 표는 보기 맨 아래 원자료 표 접힘이다(v60.31). verify_by: node scripts/ci-chart-scale-browser-check.mjs && node .claude/skills/verify-aio/scripts/verify-aio.mjs drive charts --viewport desktop, then --viewport phone
- [x] QA-CHARTS-PAGE-02: 종목 허브 탭은 개요·재무 공시 두 개이고 차트 탭이 없다. 허브 줄의 '기술적 분석에서 보기'는 그 종목을 기술적 분석 분석 자리에 연다. 옛 주소 #technical, #technical/<SYM>, #technical?sym=<SYM>과 showPage('technical')·openMarketChart·명령 검색의 차트 열기는 모두 기술적 분석의 그 종목으로 열리고 주소는 #charts?sym=<SYM>로 정리된다. #page-technical은 빈 껍데기이고 technical은 charts의 파생 보기다(v60.31). verify_by: node scripts/ci-entity-deep-link-browser-check.mjs && node scripts/ci-entity-quality-browser-check.mjs && node scripts/ci-esm-core-unit-check.mjs && node .claude/skills/verify-aio/scripts/verify-aio.mjs drive stock --viewport desktop
- [x] QA-MACRO-FACE-01: 매크로(macro)와 금리와 환율(fxbond)에서 접히는 것은 원자료 표(raw-table)·계산 방법(method)·데이터 출처(sources)뿐이다. scripts/ci-fold-kind-check.mjs SCREENS에 macro(macro-board, indicator-face, index-earnings, macro-chapters, release-zone-bar, gauge-bar, screen-reading, page-sources)와 fxbond(macro-board, krw-read, indicator-face, page-sources)가 들어 있고 index.html #page-macro·#page-fxbond 구간은 outer-close 주석까지 읽힌다. v60.30 코드(6요인 축 행, 지표 묶음, data-view-open 셸, 수익률 곡선 안내, 카드별 지표 정의 noteFold, 요인 원리 deepDiveFold, 자산배분 원리)에서는 실패한다(v60.31). verify_by: node scripts/ci-fold-kind-check.mjs
- [x] QA-MACRO-FACE-02: 매크로 요약의 6요인과 금리와 환율의 원·엔 요인은 접히지 않는 지표 행(article.ind-row.macro-axis: 제목·상태 칩·대표 수치·기준까지, 그 아래 판정 사유와 판정이 바뀌는 조건 두 줄, 게이지와 시나리오 버튼)이다. 성장·물가·정책 축의 해석 문장(read)은 고정 어휘 MACRO_AXIS_REASONS의 판정 사유 행으로 바뀌었고, history.json 420세션 × 2개 매크로 입력 × 3축 = 2,520 판정에서 상태·flip·헤드라인·게이지·기존 근거가 바뀌지 않는다. 지표 정의·원리는 페이지 끝 계산 방법 접힘 하나(#macro-method, #rates-method)에 있고, 1440·820·390px 라이트·다크에서 가로 넘침과 콘솔 오류(외부 CORS 제외)가 없다(v60.31). verify_by: node scripts/ci-architecture-browser-check.mjs (macro/fxbond 단계) && node .claude/skills/verify-aio/scripts/verify-aio.mjs drive macro --viewport desktop, then --viewport phone
- [x] QA-PRINCIPLES-LIBRARY-01: 시장 상태·시장 폭·투자 심리·매크로·금리와 환율의 계산 방법 접힘은 계산(무엇을 재는지·판정 기준·학술 근거)만 두고, 지표의 원리는 리서치 라이브러리 글 하나로 연결한다(principle-link.js principleLink, data-aio-principle). src/domain/content/indicator-notes.js의 모든 주소가 분석 노트(learning-core lessonById) 또는 원리 레슨(lesson-library.json)으로 풀리고, 다섯 화면 모듈(sentiment-board, breadth-board, market-regime, macro-board, stress-outcomes)은 principleLink를 쓰며 '전문가 해석'·'다른 축과의 연결' 같은 교육 블록을 갖지 않는다. v60.30 코드(axis-deep-dives.js·board-deep-dives.js의 원리 블록을 화면에 그림)에서는 실패한다(v60.31). verify_by: node scripts/ci-codex-structure-regression-fixture.mjs
- [x] QA-SCREEN-READING-01: 시장 상태·시장 폭·매크로의 AI 읽기 사실 묶음은 화면과 같은 해석(interpretationFromArtifacts)의 축 제목·상태 라벨·근거·전환 조건·기준일만 쓰고 축의 read 문장과 (참고) 근거는 넣지 않으며, 같은 사실이면 같은 key라 다시 부르지 않는다(검증 통과본 재사용, 검증 실패 key는 재호출 없음, 공급자 실패는 key당 3회까지). 검증은 묶음에 없는 수치·날짜, 묶음과 다른 상태 라벨, 매수·매도 지시, % 확률, 지시문 표시 누출, 한국어 아님, 400자 초과만 막고 근거 얇은 해석은 경고만 남긴다(v60.31). verify_by: node scripts/ci-screen-reading-check.mjs
- [x] QA-SCREEN-READING-02: 화면은 검증된 읽기의 basis가 지금 보여 주는 종가(regime asOf)와 같을 때만 판정 바로 아래 접지 않은 한 문단으로 그리고(textContent, 'AI 읽기'·M/D 종가 기준), 아니면 호스트를 비우고 숨긴다. data.json에 screenReadings가 없어도 콘솔 오류 없이 빈 자리로 남는다 — 1440·390px에서 확인(v60.31). verify_by: node .claude/skills/verify-aio/scripts/verify-aio.mjs registry, then open #signal and #breadth at 1440 and 390 px after the next refresh-data run publishes data.json screenReadings
- [x] QA-SCREEN-TASKS-01: 화면마다 독자가 할 수 있는 일을 실제 브라우저에서 확인한다: 첫 화면에서 판정 단어가 보이고, 접힘을 모두 닫은 채로 판정 근거가 읽히며, 보이는 접힘의 이름은 원자료 표·계산 방법·데이터 출처로 시작하고 키보드로 열리고, 보기 탭마다 내용이 다르고, 390px에서 가로로 넘치지 않고, 화면의 제 일(기술적 분석: 종목을 검색해 그 종목 제목 아래 차트가 열린다)이 된다. 요소의 id·class·위치는 확인하지 않는다. v60.30 화면(종류 이름 없는 접힘)에서는 실패한다(v60.31). verify_by: node scripts/ci-screen-tasks-browser-check.mjs
- [x] QA-FOLD-KIND-01: 시장 상태(signal)에서 접히는 것은 원자료 표(raw-table)·계산 방법(method)·데이터 출처(sources) 세 종류뿐이고 각 <details>는 data-fold-kind를 단다. scripts/ci-fold-kind-check.mjs가 SCREENS 레지스트리의 렌더 모듈과 index.html #page-signal 구간을 정적으로 읽어 표시 없는 접힘·허용 밖 종류·다른 접힘 제작 함수(noteFold, deepDiveFold)를 실패시키며, v60.30 코드(축 행·판정 근거·조합 접힘)에서는 실패한다(자기 시험 9건 포함, v60.31). verify_by: node scripts/ci-fold-kind-check.mjs
- [x] QA-SIGNAL-FACE-01: 시장 상태 지금 보기(지표 보기와 합침)는 판정 → 반대 근거 한 줄(#regime-counter, 고정 어휘와 숫자) → 5거래일 전 비교 → AI 읽기 → 6개 지표 행과 참고 2개 행(article.ind-row, 접힘 없음: 제목·상태 칩·대표 수치·기준까지, 그 아래 판정 사유와 판정이 바뀌는 조건 두 줄) → 지표 추이 차트(#regime-history) → 레이더·같이 놓고 보면·엇갈리는 조합·가격 조건 순서이고, 축의 나머지 관측값은 #regime-raw 하나, 계산 방법은 #regime-method에 있다. 1440·820·390px 라이트·다크에서 가로 넘침과 콘솔 오류가 없다(v60.31). verify_by: node scripts/ci-regime-scenarios-fixture.mjs && node .claude/skills/verify-aio/scripts/verify-aio.mjs drive market --viewport desktop, then --viewport phone (fold census step)
- [x] QA-STOCK-COMPANY-01: 종목 개요(#page-ticker)는 이름·가격 줄·회사 한 줄 아래 사업(무엇을 파나·누구에게 파나·매출을 움직이는 것, 이야기가 없으면 분류·섹터·업종만) → 밸류체인 안의 자리(AI 지도 층, 사 주는 곳·공급하는 곳·겨루는 곳, 회사가 당사자인 자본순환과 보도 표시, AI 지도에서 보기 하나; 지도 밖 회사는 한 줄) → 재무 한눈에(매출 성장·순이익률·잉여현금흐름·현금과 부채, 숫자와 고정 상태어, 재무 공시로 가는 버튼) → 내 메모 순서다. 접힘은 원자료 표·계산 방법·데이터 출처뿐이고 가격 차트는 없다(기술적 분석에서 보기 링크 하나). 재무 공시는 최근 실적 발표 요약을 펼친 채 위에 두고 발견 사항을 행으로 펼치며 같은 세 종류만 접는다(v60.31). verify_by: node scripts/ci-screen-tasks-browser-check.mjs --only ticker && node scripts/ci-fold-kind-check.mjs && node scripts/ci-section-visual-contract.mjs

## v60.30 문장 claim 계약 (2026-11-18)

- [x] QA-CLAIM-REPLAY-01: 브리핑 지난 24시간(day-account)의 모든 수치·날짜·판정 단어와 시장 읽기 진술 11종(narrow-rally, broad-rally, broad-weakness, broad-derisking, index-defended, tech-leads, tech-lags, credit-widening, credit-stress, vix-inversion, vix-spike)은 claim(src/domain/shared/claim.js)에서만 문장이 되고, 저장된 모든 세션(history.json 약 420개, 크래시 재생 고정 종가 중 history에 없는 세션, 발행된 market-day.json)에서 검사기가 사실과 대조해 0건이다(v60.30). verify_by: node scripts/ci-sentence-claim-replay-check.mjs
- [x] QA-CLAIM-REPLAY-02: 검사기 자체 시험: 결함 유형 a(최상급·순위), b(참여 단어가 지수 방향을 거스름), c(크기 단어와 moveGrade), d(인쇄된 값과 기준선), e(라벨 없는 수치·claim 없이 인쇄된 수치), f(asOf와 자료 날짜)마다 거짓 claim 하나를 잡아야 통과한다(v60.30). verify_by: node scripts/ci-sentence-claim-replay-check.mjs
- [x] QA-CLAIM-REPLAY-03: 변환된 파일의 한글 템플릿 리터럴이 숫자 서식 함수를 직접 끼워 넣는 곳은 day-account.js 0, market-read.js 297(미변환 진술)에서 늘지 않는다(v60.30). verify_by: node scripts/ci-sentence-claim-replay-check.mjs
- [x] QA-CLAIM-LARGEST-01: 브리핑 가격 이야기의 '가장 큰 변화(X)'는 같은 가족 중 자기 변동성 대비 가장 큰 움직임을 가리킨다(v60.30). verify_by: node scripts/ci-sentence-claim-replay-check.mjs
- [x] QA-CLAIM-VIXSPIKE-01: 시장 읽기의 VIX 5일 문장은 VIX 자기 변동성으로 큰 움직임일 때만 '급등'이라 쓴다(v60.30). verify_by: node scripts/ci-sentence-claim-replay-check.mjs
- [x] QA-CLAIM-VIXINV-01: VIX 역전 진술은 인쇄된 VIX가 인쇄된 3개월 VIX보다 높을 때만 나온다(v60.30). verify_by: node scripts/ci-sentence-claim-replay-check.mjs
- [x] QA-CLAIM-THRESHOLD-01: 기준 아래·위라고 말하는 시장 읽기 수치는 기준과 같은 숫자로 찍히지 않는다(v60.30). verify_by: node scripts/ci-sentence-claim-replay-check.mjs
- [x] QA-PEER-TABLE-BASIS-01: 재무 공시의 같은 테마 기업 비교표는 매출 성장·순이익률을 종목 요약·스크리너와 같은 최근 4개 분기 기준으로 쓰고(그룹 70% 이상이 분기 자료를 가질 때), 행마다 'M/D까지 4개 분기' 또는 회계연도를 기준 열에 한 번 적는다(v60.30). verify_by: node scripts/ci-fiscal-quality-fixture.mjs
- [x] QA-EXT-QUARTER-BASIS-01: 확장 SEC 원장(sec-fundamentals-extended.json)의 압축 기록은 관측 배열 대신 8개 분기 문자열(quarterHistory, quarterlyHistory 출력)을 남기고, 확장 행의 순이익률·매출 성장은 코어 행과 같은 최근 4개 분기 기준을 쓴다(v60.30). 다음 프로듀서 실행부터 다시 읽힌 발행사에 붙는다. verify_by: node scripts/ci-data-pipeline-contract-check.mjs
- [x] QA-SEC-MAP-ACCESSOR-01: SEC fiscal-history 지도(issuerSic, debtBasis, debtCurrent)는 src/ui/components/fiscal-read.js만 root에서 읽고, 다른 컴포넌트는 issuerSic / debtBasisFor / debtCurrentFor를 쓴다(v60.30). verify_by: node scripts/ci-fiscal-quality-fixture.mjs
- [x] QA-NETCASH-CURRENT-PORTION-01: 순현금 주석은 부채 개념의 실제 범위를 따른다: 유동분 없는 비유동 개념만 '1년 안에 갚을 몫이 빠져 있다'고 하고, LongTermDebt 등 합계는 그 몫이 포함됐다고 하며, debtCurrent 지도가 없는 아티팩트에서는 그 몫을 말하지 않는다(v60.30). verify_by: node scripts/ci-data-pipeline-contract-check.mjs && node scripts/ci-fiscal-quality-fixture.mjs
- [x] QA-PF-HOLD-PLAIN-01: 포트폴리오 백테스트·위험·원장 성과의 보류 문구는 무엇이 없어 계산하지 않았는지와 무엇을 하면 되는지를 한 문장으로 쓰고, 보류·인증·leg·영문 코드 같은 내부 용어는 앞면에 없다(위험 패널은 계산 식별자 접힌 칸에만)(v60.30). verify_by: node scripts/ci-pipeline-semantics-check.mjs
- [x] QA-BOOT-PORTFOLIO-PANELS-01: 포트폴리오 전용 패널 계약(위험 입력 조립, 원장·계좌 성과, 선언 패널, 기준 통화 평가액, 백업 묶음)과 매매일지 도메인은 부팅 모듈 집합 밖(lazyOnlyInputs)에 있고 포트폴리오 화면 브리지(portfolio-screen-bridges.js)와 함께 설치된다(v60.30). verify_by: node scripts/ci-boot-bundle-budget-check.mjs
- [x] QA-MACRO-CREDIT-NEUTRAL-01: 매크로 신용 가지의 중립 문장은 빠진 양호 조건을 값·기준과 함께 말하고, 5거래일 변화를 '작다'고 부르지 않는다(v60.30). verify_by: node scripts/ci-scenario-guidance-fixture.mjs
- [x] QA-MACRO-EARN-BREADTH-01: 매크로 S&P 500 이익 전망 게이지 캡션은 측정(이익 전망 수정 건수)과 기간(4주)을 % 옆에 붙인다(v60.30). verify_by: node scripts/ci-esm-core-unit-check.mjs
- [x] QA-MACRO-NESTED-PAREN-01: 매크로 생성 문장(물가 챕터·물가 방향·물가 축)에 괄호 안의 괄호가 없고, 13개월 연율은 빠진 달과 기준월을 같은 괄호 안 절로 말한다(v60.30). verify_by: node scripts/ci-esm-core-unit-check.mjs && node scripts/ci-sentence-join-check.mjs
- [x] QA-MACRO-CHAPTER-REPORT-01: 매크로 챕터 '관련 보도'는 그 장 주제 자체에 대한 한국어 제목 기사만 보이고, 다른 주제(암호화폐·반도체·인수·실적·종목) 기사나 번역 없는 기사는 붙지 않는다(v60.30). verify_by: node scripts/ci-esm-core-unit-check.mjs
- [x] QA-MARKET-TEXT-01: 브리핑 업종 이야기의 '가장 많이 내린/오른 종목'은 업종 사실의 leaders이고, leaders가 없으면 최상급 없이 '크게 움직인 주요 종목'으로 쓴다(v60.30). verify_by: node scripts/ci-esm-core-unit-check.mjs
- [x] QA-MARKET-TEXT-02: 주간 실적 일정 제목은 S&P 500 비중 숫자를 '(S&P 500 비중 …%)' 라벨 안에 둔다(v60.30). verify_by: node scripts/ci-domain-parity-check.mjs
- [x] QA-MARKET-TEXT-03: 투자 심리의 VIX 기간 구조 문장은 '비율'로 부르고 적힌 값 기준으로 아래/닿음/넘음을 말한다(v60.30). verify_by: node scripts/ci-esm-core-unit-check.mjs
- [x] QA-MARKET-TEXT-04: 지수별 가격 온도는 수집 실패로 유지된 본문이 그 시장의 최신 완료 세션 종가면 '갱신 지연'을 붙이지 않는다(v60.30). verify_by: node scripts/ci-esm-core-unit-check.mjs
- [x] QA-MARKET-TEXT-05: 시장 폭 참여 문장은 비율 수준을 '참여가 넓다'로만 말하고, 지수 20일 방향이 있으면 그 조합을 사실대로 쓴다(v60.30). verify_by: node scripts/ci-esm-core-unit-check.mjs
- [x] QA-SCR-UNRANKED-01: 순위가 없는 시장을 고르면 '조건 통과만'이 켜져 있어도 전체 목록이 순위 없이 표시되고, 순위 칸은 비며, 사용자의 다른 필터는 유지된다(v60.30). verify_by: node scripts/ci-screener-presentation-check.mjs
- [x] QA-SCR-HOLD-ONCE-01: 순위 보류 시장의 이유는 머리말에서 한 번(시장·날짜는 종가 표시가 맡음), 표 상태 줄에서 짧게 한 번 말한다(v60.30). verify_by: node scripts/ci-screener-presentation-check.mjs
- [x] QA-SCR-FACTOR-FOLD-01: 스크리너 근거 보기의 팩터 행 겉면은 이름과 점수만, 팩터 정의는 아래 접힘에 '이름 — 정의'로 둔다(v60.30). verify_by: node scripts/ci-screener-presentation-check.mjs
- [x] QA-TICKER-RANGE-ZONE-01: 종목 개요 위치 칸 칩은 범위 하단·중간·상단으로 잰 것을 말하고 우호·부담 같은 판정 단어를 쓰지 않는다(v60.30). verify_by: node scripts/ci-esm-core-unit-check.mjs
- [x] QA-PF-CLOSE-ONCE-01: 포트폴리오 요약 줄은 모든 보유 종목이 종가 평가일 때 종목 수를 다시 말하지 않고 '모두 M/D 종가 기준'으로 쓴다(v60.30). verify_by: node scripts/ci-pipeline-semantics-check.mjs --only portfolio
- [x] QA-PF-CLOSE-DAY-01: 종가로 평가한 보유 종목의 오늘 칸은 그 종가의 전 거래일 대비 변화를 날짜와 함께 보인다(머리의 오늘 합계는 실시간 시세만)(v60.30). verify_by: node scripts/ci-pipeline-semantics-check.mjs --only portfolio
- [x] QA-PF-DUP-PLAIN-01: 중복 종목 창은 '수량 N주, 매수 단가 X'로 쓰고 상장 통화와 다를 때만 통화를 말하며, 통화 빈칸은 상장 통화로 읽어 합치기를 판단한다(v60.30). verify_by: node scripts/ci-pipeline-semantics-check.mjs --only portfolio
- [x] QA-SEARCH-DEF-FLOOR-01: 명령 검색은 두 글자 질의에 정의·본문만 맞는 용어·리서치를 내지 않는다(이름·별칭 일치는 그대로)(v60.30). verify_by: node scripts/ci-search-surface-contract.mjs
- [ ] QA-TOUCH-LINK-01: 공용 이동 링크(.flow-next-link)와 종목 개요 근거 링크(.stock-read-point-link)는 375px에서도 --touch-min(24px) 이상이다(v60.30). verify_by: node scripts/ci-ui-render-hygiene-check.mjs

## v60.29 AI 답변 게시 결함 (2026-11-18)

- [x] QA-AI-6028-WHOLE: 웹검색 답변에 잘린 문장·여는 괄호 없는 링크 꼬리·본문 없는 머리 줄이 게시되지 않는다(v60.29). verify_by: node scripts/ci-ai-intelligence-contract-check.mjs
- [x] QA-AI-6028-DERIVED: 근거 있는 피연산자로 맞게 계산한 수치(배당수익률 등)는 계산값으로 게시되고, 뺀 수치 문장은 안내 줄이 종류와 개수로 알린다(v60.29). verify_by: node scripts/ci-ai-intelligence-contract-check.mjs
- [x] QA-AI-6028-PER-CTX: 종목 화면 PER·배당 질문의 AI 맥락에 화면과 같은 PER 산식(종가·기준일·EPS 기준·Forward PER 예상치 날짜)과 행의 배당 필드가 실린다(v60.29). verify_by: node scripts/ci-ai-intelligence-contract-check.mjs
- [x] QA-AI-6028-DIV-LIVE: 다음 스크리너 생산 뒤 KO 행에 dividendTtm·dividendYieldPct가 있고, 종목 화면 배당 질문 맥락에 '배당수익률 …%(최근 완료 종가 기준)'가 나온다(v60.29). verify_by: node -e "const d=require('./public-data/screener.json').data.KO;console.log(d.dividendTtm,d.dividendYieldPct,d.dividendLastExDate,d.dividendCount12m)"
- [x] QA-AI-6028-VISUAL: 배당·PER처럼 밸류에이션만 묻는 AI 답변에는 분기 매출 그림이나 기본 주가 그림이 붙지 않는다(v60.29). verify_by: node scripts/ci-ai-intelligence-contract-check.mjs
- [x] QA-MASTERS-6028-QUARTER: 13F 계약 검사는 분기별 행 합계가 아니라 운용사별 보유·비교 행 존재와 내부 일치를 본다(v60.29). push 뒤 레인이 2026-09-30 분기를 게시하는지 확인한다. verify_by: node scripts/ci-masters-contract-check.mjs
- [x] QA-INTEGRATION-6028-PARITY: 기술 리스크의 이동평균 이탈은 추세 판정과 같은 선 근처 폭을 쓰며, 레거시 골든과 달라지는 시나리오(zero_volume_70)는 일치 검사에 선언돼 있다(v60.29). verify_by: node scripts/ci-domain-parity-check.mjs
- [x] QA-LIB-6028-ROUTE: 리서치 화면(산업 지도·개념·대가)의 열린 문서는 그 화면 hash 질의에만 있고, 다른 화면으로 가면 주소에 남지 않는다. 옛 ?mode=…#atlas 링크는 진입 때 한 번 읽힌다(v60.29). verify_by: node scripts/ci-knowledge-corpus-check.mjs
- [x] QA-LIB-6028-LAYERS: 산업 지도 가치사슬 7층이 기업 이야기 층(단일 표)에서 기업을 읽고, 모델 층을 포함해 빈 층이 없다(v60.29). verify_by: node scripts/ci-atlas-contract-check.mjs
- [x] QA-LIB-6028-GLOSSARY: 화면 어휘 목록과 스크리너 컬럼 라벨이 모두 조립된 용어 사전에 있거나 대응·평이 선언이 있다(v60.29). verify_by: node scripts/ci-glossary-vocabulary-check.mjs
- [x] QA-TEXT-6028-JOIN: 제품 코드의 한국어 문장 잇기에서 '.,'·'..'가 생기는 정적 패턴이 없다(다른 스레드 pending 목록 제외, 목록은 줄기만 함)(v60.29). verify_by: node scripts/ci-sentence-join-check.mjs
- [x] QA-PF-6028-KRKEY: 한국 보유 종목은 논지 점검·오늘 내 종목·점검·백테스트에서 상장 심볼(.KS/.KQ) 행으로 읽힌다(v60.29). verify_by: node scripts/ci-pipeline-semantics-check.mjs
- [x] QA-PF-6028-MERGE: 같은 종목 재추가는 합치기/바꾸기, 통화가 다르면 합치기 거부, 가져오기 중복 행은 합쳐져 알림에 표시(v60.29). verify_by: node scripts/ci-pipeline-semantics-check.mjs
- [x] QA-PF-6028-BAND: 기술 리스크의 이평 이탈은 추세 판정과 같은 선 근처 범위(ADR 1배) 밖에서만 센다(v60.29). verify_by: node scripts/ci-pipeline-semantics-check.mjs
- [x] QA-PF-6028-BTKO: 백테스트 결과에 영어·내부어가 없고 비교 지수 최고/최저 연도·최대 낙폭과 시작 비중 줄이 있다(v60.29). verify_by: node scripts/ci-pipeline-semantics-check.mjs
- [x] QA-PF-6028-RF: 무위험 수익률 칸에 SOFR 값·날짜 넣기 버튼이 있고 누를 때만 입력으로 저장된다(v60.29). verify_by: node scripts/ci-pipeline-semantics-check.mjs
- [x] QA-PF-6028-COPY: 포트폴리오 환율·계좌 성과·추세 문구에 실제와 다른 설명, '..', '.,', 같은 숫자 반복이 없다(v60.29). verify_by: node scripts/ci-pipeline-semantics-check.mjs
- [x] QA-SCR-6028-BASIS: 스크리너 행의 순이익률·매출 성장이 PER과 같은 최근 4개 분기 기준(없으면 FY)이고 기준·종료일을 발행하며, 표·검사창·동종 비교가 그 기준을 적는다(v60.29). verify_by: node scripts/ci-data-pipeline-contract-check.mjs && node scripts/ci-screener-presentation-check.mjs
- [x] QA-SCR-6028-DIVIDEND: 스크리너 행의 dividendTtm·dividendYieldPct·dividendLastExDate·dividendCount12m·dividendBasis가 최근 365일 배당락 이벤트와 맞고(0~40%), 이벤트 요청이 없거나 기간이 1년이 안 되면 비어 있다(v60.29). verify_by: node scripts/ci-data-pipeline-contract-check.mjs && node scripts/validate-screener-artifact.mjs public-data/screener.json
- [x] QA-SEC-6028-DEBT: SEC 장기부채는 리스 포함 계정만 쓰는 기업도 채우고, 한 시계열은 한 기준을 지키며, 부분 합계·채권별 개념은 기준이 되지 않는다(v60.29). verify_by: node scripts/ci-data-pipeline-contract-check.mjs
- [x] QA-SEC-6028-DEBT-LIVE: 다음 SEC 재정규화 뒤 AVGO 최근 회계연도 장기부채가 비어 있지 않고, 최근 연도 장기부채가 있는 발행사가 491/795보다 늘며, debtBasis 맵에 리스 포함 기업이 나타난다(v60.29). verify_by: node -e "const d=require('./public-data/sec-fiscal-history.json');const n=Object.values(d.data).filter(s=>s.split(';').at(-1).split(':')[6]!=='').length;console.log(n,Object.keys(d.data).length,d.data.AVGO.split(';').at(-1),Object.keys(d.debtBasis||{}).length)"
- [x] QA-SEC-6028-DEBT-UI: sec-fiscal-history.json의 debtBasis 맵이 재무 공시 화면까지 이어진다: 리스 포함 기업은 연간 금액표 열·순현금 줄·스톡 렌즈가 '장기부채(리스 포함)'로, 한계 문구가 금융리스 포함으로 바뀌고, 맵에 없는 종목은 '장기부채'와 리스 제외 문구를 유지한다(v60.29). verify_by: node scripts/ci-fiscal-quality-fixture.mjs
- [x] QA-THEMES-6028-ASOF: 기준일 칩은 글자를 자르지 않고, 시장 접두어가 붙은 세션 칩 최장 형태가 ASOF_MAX 안에 들며 '반영 전'으로 끝난다(v60.29). verify_by: node scripts/ci-esm-core-unit-check.mjs
- [x] QA-THEMES-6028-CRITERIA: 테마 단계 표 '기준 충족'은 늦게 온 컨센서스·실적 달력으로 다시 그려지고, 미확인 기준을 셀에 적으며, 로드 중에는 그 열로 정렬하지 않는다(v60.29). verify_by: node scripts/ci-esm-core-unit-check.mjs && node scripts/ci-scenario-guidance-fixture.mjs
- [x] QA-THEMES-6028-TWREV: 대만 월매출 문장은 전부 늘면 '모두', 하나도 없으면 '없습니다'로 쓰고 'N개사 중 N개사'를 쓰지 않는다(v60.29). verify_by: node scripts/ci-tw-monthly-revenue-fixture.mjs
- [x] QA-TICKER-6028-THEME: 종목 화면의 가격 줄·시장 연결 줄·테마 링크가 primary-theme.js 하나의 대표 테마를 말하고, 다른 테마 이야기는 대표 테마와 함께 말한다(v60.29). verify_by: node scripts/ci-section-visual-contract.mjs
- [x] QA-COMPANY-6028-EDGE: 회사 관계 간선은 줄의 주체만 연결하고, 괄호 속 다른 회사의 협력·계약·보증은 간선이 되지 않으며, 범주 괄호의 구성원은 연결된다(v60.29). verify_by: node scripts/ci-company-profile-contract-check.mjs
- [x] QA-FUND-6028-QLABEL: 재무 공시의 EPS 예상 대비 카드는 SEC 분기 말일이 45일 안에 있으면 SEC 카드와 같은 분기 이름을 쓰고, 없으면 원천 이름을 쓴다(v60.29). verify_by: node scripts/ci-fiscal-quality-fixture.mjs

## v60.26 프로젝트 감사 (2026-11-18)

- [x] QA-AUDIT-OPTIONAL-EMPTY: 저장한 구조와 원본·역순 행을 비교하고 모든 행에서 키가 사라지는 변경을 검출한다. verify_by: node scripts/ci-browser-data-fixture-check.mjs
- [x] QA-AUDIT-PUBLISH-BASH: Git Bash가 PATH에 없는 Windows 환경에서 임시 원격 저장소 발행 사례가 통과해야 한다. verify_by: node scripts/ci-publish-data-commit-check.mjs

## v60.25 프로젝트 감사 (2026-11-18)

- [x] QA-AUDIT-6025-SEARCH: 검색 취소 뒤 종목 화면이 열림 회귀 검사. verify_by: node scripts/ci-search-surface-contract.mjs
- [x] QA-AUDIT-6025-WEIGHT: 빠진 목표비중을 0%로 계산 회귀 검사. verify_by: node scripts/ci-esm-core-unit-check.mjs
- [x] QA-AUDIT-6025-SEC: SEC 랭킹의 기준 시각이 시세 갱신 때 변경됨 회귀 검사. verify_by: node scripts/ci-operations-status-check.mjs
- [x] QA-AUDIT-6025-RETAIN: 이전 분석을 재사용하면 공급자 거부가 운영 상태에서 사라짐 회귀 검사. verify_by: node scripts/ci-data-pipeline-contract-check.mjs
- [x] QA-AUDIT-6025-HOOK: 일반 파일 편집에서 작업공간 알림 발생 회귀 검사. verify_by: node scripts/ci-workspace-contract-check.mjs
- [x] QA-AUDIT-6025-CRLF: Windows 체크아웃이 출시 후보 검사에서 거부됨 회귀 검사. verify_by: node scripts/ci-qa-runner-behavior-check.mjs

## v60.21 history 주말 재스탬프 (2026-11-16)

- [x] QA-HIST-WEEKEND-01: v60.21 주말·휴장일에 공급자가 다시 찍은 시각의 값은 어느 세션의 종가도 되지 않고(보류 행), 어떤 행도 그 행의 UTC 날짜가 끝난 뒤 관측한 값을 담지 않는다(FX·미국 지수·코스피·BTC 달력별 전수 탐색). verify_by: node scripts/ci-history-session-model-check.mjs
- [x] QA-HIST-WEEKEND-LIVE-01: v60.21 push 뒤 첫 주말(토·일) 갱신이 모두 게시되고, history.json의 토·일 행 usdkrw가 carried-forward(heldReason no-session-on-stamp-day 또는 session-already-recorded)이며 sessionDate가 금요일이다. verify_by: 주말 Refresh market data 실행 결과와 public-data/history.json 토·일 행 fieldMeta.usdkrw 확인
- [x] QA-AI-SEARCH-FIG-01: v60.21 웹검색 답변에서 이 요청의 출처를 같은 문장에 단 수치는 링크와 함께 남고(표 칸·확인된 수치 목록 제외), 출처 없는 수치·다른 URL·모델 계산·AIO 값과 어긋난 수치는 문장째 빠지며 그 문장의 인용도 함께 빠진다. 여는 줄은 검색 수치를 'AIO가 확인한 값 아님'으로 밝히고 '일반 설명만'을 쓰지 않는다. verify_by: node scripts/ci-ai-intelligence-contract-check.mjs
- [x] QA-AI-SEARCH-FIG-LIVE-01: v60.21 push 뒤 배포판 AI 패널(홈)에서 '엔비디아 이번 주 실적 발표의 시장 예상치를 검색해서 알려줘'의 답이 컨센서스 수치를 출처 링크와 함께 보여 주거나 일관된 보류 문구를 쓰고, 답 본문에 '](https://' 같은 링크 원문이 남지 않는다. verify_by: 배포판에서 같은 질문 1회, getChatState().messages.at(-1).content와 말풍선 확인
- [x] QA-NARR-RECORD-01: v60.21 시장이 말하는 이야기의 시나리오 판단 틀은 장기 기록이 늦게 도착해도 같은 갈림길의 시나리오와 가이드 판단 틀과 같은 기록·같은 문장이고, AI 답변 블록은 그 기록을 기다린다. verify_by: node scripts/ci-decision-frame-check.mjs
- [x] QA-NARR-RECORD-LIVE-01: v60.21 push 뒤 배포판 시장 상태 → 이야기와 전망에서 이야기 섹션과 시나리오 섹션의 같은 갈림길 '가능성' 줄이 같고(장기 일봉 기록), 'AIO 종가 기록' 줄이 이야기 섹션에만 남지 않는다. verify_by: 배포판 시장 상태 새로고침 1회 뒤 두 섹션의 판단 틀 텍스트 비교

## v60.19 AI 수치 근거 대조 (2026-11-15)
- 완료 18건: QA-AI-FIG-01, QA-AI-SEARCH-01, QA-AI-SEARCH-LIVE-01, QA-AI-RETRY-01, QA-AI-RETRY-LIVE-01, QA-CONS-OOQ-01, QA-SEC-1STANNUAL-01, QA-SHADOW-ID-01, QA-PF-FXLEG-01, QA-FED-RANGE-01, QA-CPI-DERIVED-01, QA-TIMELINE-WINDOW-01, QA-SIZE-WORD-01, QA-MATERIALITY-EXPLAINS-01, QA-OPS-DOC-01, QA-MOVE-SIZE-01, QA-VIX-RISK-01, QA-LEAN-01
- [ ] QA-VIX-RISK-02: v60.19 다음 주간 stress-outcomes 갱신 뒤 public-data/stress-outcomes.json이 새 지문(stress-outcomes:aa7e90509d8d94d0)과 밴드별 risk를 싣고, 시장 상태 카드와 VIX 낙폭 줄이 기록 없음 대신 숫자를 보인다. verify_by: node scripts/ci-market-lean-validation-check.mjs (갱신된 산출물로)
- [ ] QA-LEAN-02: v60.19 research-backtest.yml을 실행한 뒤 market-lean-backtest 산출물과 validation-gates의 marketLean 판정을 검토하고, 승격할 때 public-data/market-lean-backtest.json과 model-validation-status.json을 같은 검토 변경으로 올린다. verify_by: node scripts/build-validation-gates.mjs --check

## v60.18 매크로 판정 다리 (v60.18) (2026-11-15)
- 완료 15건: QA-MACRO-LEG-01, QA-LIVE-CHG-01, QA-MACRO-HELD-01, QA-HOME-STRIP-01, QA-THEME-BENCH-01, QA-THEME-BREAKWORD-01, QA-OUTCOME-STAMP-01, QA-GATES-OUTDIR-01, QA-EVIDENCE-STRENGTH-01, QA-VERDICT-DIR-01, QA-VERDICT-DIR-02, QA-VERDICT-VIX-01, QA-VERDICT-MODEL-01, QA-MARKETDAY-CUM-01, QA-VERDICT-WEEK-01
- [ ] QA-LIVE-CHG-LIVE-01: v60.18 배포 뒤 첫 주말 배포본 홈 교차자산 줄 달러 지수 등락이 브리핑·market-snapshot.json 값과 같다. verify_by: 배포본 홈 #home-cross-assets [data-live-chg="DX-Y.NYB"]와 public-data/market-snapshot.json changePct 대조
- [ ] QA-THEME-BENCH-LIVE-01: v60.18 push 뒤 첫 22:5xZ refresh-data 실행의 scenario-state.json: 미국 테마 행이 held(benchmark-lag)로 직전 단계를 유지하고, 23:2xZ 실행의 transitions에 그날 테마 단계 되돌림이 없다. verify_by: git show <22:5xZ·23:2xZ 커밋>:public-data/scenario-state.json 의 themes[].held 와 transitions 확인
- [ ] QA-OUTCOME-STAMP-LIVE-01: v60.18 push 뒤 첫 refresh-data 일일 레인 실행이 scenario-outcomes.json(fingerprints, 테마 행 fingerprint, outcome 'excess')과 stress-outcomes.json(fingerprint)을 다시 쓰고, 테마 화면 과거 기록과 VIX 구간 표가 다시 보인다. verify_by: git log -1 -- public-data/scenario-outcomes.json public-data/stress-outcomes.json 와 두 파일의 fingerprint 필드 확인
- [ ] QA-VERDICT-DIR-LIVE-01: v60.18 push 뒤 첫 refresh-data의 today-verdict.json heroLine이 그날 SOXX·S&P 500의 50일선 위치와 마지막 구간 방향(반등 중/재하락 중/멈춤)을 같은 단어로 쓴다. verify_by: git show <첫 refresh 커밋>:public-data/today-verdict.json 과 history.json SOXX·S&P 500 대조
- [ ] QA-VERDICT-MODEL-LIVE-01: v60.18 push 뒤 첫 refresh-data의 today-verdict.json에 model이 있고 ci-metric-consistency-check가 STALE-MODEL 없이 통과한다. verify_by: git pull 뒤 node scripts/ci-metric-consistency-check.mjs
- [ ] QA-MARKETDAY-CUM-LIVE-01: v60.18 push 뒤 첫 refresh-data의 market-day.json 가격 사실에 zWeek·weekCounts·sizedBy가 있고 rules 문구가 5거래일 다리를 말한다. verify_by: git show <첫 refresh 커밋>:public-data/market-day.json
- [ ] QA-TEMP-BASIS-01: v60.18 push 뒤 도쿄 오전(00:00~06:00Z) refresh-data의 market-temperature.json 닛케이 asOf가 직전 산출물보다 과거가 아니다(그때는 retained에 nikkei). verify_by: git log -p public-data/market-temperature.json 의 markets.nikkei.asOf 연속 확인

## v60.06 레이어 스택 검토 수정 (2026-11-14)
- 완료 1건: QA-A11Y-06

## v60.05 공용 동작 계층 (2026-11-13)
- 완료 1건: QA-A11Y-05

## v59.88 스크리너 산출물 계약 (2026-11-09)
- 완료 4건: QA-BREADTH-ALL-MARKET-SESSION, QA-KRW-KOSPI-OWN-SESSION, QA-IMPORT-RESOLUTION, QA-DESIGN-TOKEN-RATCHET

## v59.87 기술 지표 단일 정의 (2026-11-09)
- 완료 3건: QA-LEGACY-TECH-FACADE, QA-PORTFOLIO-KR-LISTING, QA-AI-SCREEN-FACTS-01

## v59.86 라이브 실사용 점검 (2026-11-09)
- 완료 5건: QA-FUND-TTM-REVENUE, QA-ROUTE-KR-CODE, QA-PF-MIXED-ROW-UNIT, QA-AI-LEADER-CLOSES, QA-A11Y-NEWS-LINK

## v59.85 Data publisher (v59.85) (2026-11-09)
- 완료 9건: QA-DATA-PUBLISH-01, QA-DATA-FRESH-01, QA-OPS-CRON-01, QA-AI-MACRO-RELEASE-ROWS, QA-AI-INFLATION-DIRECTION, QA-MACRO-ONE-OWNER-READS, QA-MACRO-POLICY-CYCLE-WORDING, QA-HOME-VERDICT-HORIZON, QA-WEEK-AHEAD-RELEASE-CLOCK

## v59.83 저장소 이력 증가: 데이터 브랜치 보류, 스크린샷 차단 (2026-11-08)
- 완료 1건: QA-REPO-ARTIFACT-IMAGE

## v59.79 관측과 해석의 구분 (X 북마크 11/08) (2026-11-08)
- 완료 1건: QA-KNOW-OBS-NOT-ACTOR

## v59.74 사이트 품질 점검 (2026-11-08)
- 완료 5건: QA-UI-OUTER-SCROLL, QA-UI-NO-QUESTION-LABEL, QA-UI-WEEK-ON-CARDS, QA-UI-WATCH-AXES-CAPTION, QA-DATA-NARRATIVE-NEWS
- [ ] QA-DATA-SENTENCE-STATEMENT: v59.74: 다음 08:00 KST 시장 해석 실행 뒤 public-data의 오늘 문장이 질문이 아니고, 홈 판정 카드에 '오늘의 쟁점'으로 나온다. verify_by: 2026-11-09
- [ ] QA-DATA-SEMIS-EVIDENCE-SOXX: v59.74: 다음 갱신 뒤 public-data/market-snapshot.json evidenceQuotes의 반도체 행이 SOXX이고, AI 시장 해석이 반도체를 SMH로 적지 않는다. verify_by: 2026-11-09
- [ ] QA-DATA-HEADLINE-GLOSSARY: v59.74: Worker 배포 뒤 새로 번역된 뉴스 제목에 'Muted'→'미묘한', 'oil prices'→'오일 가격' 같은 직역과 ' : Finance : JKN' 같은 매체 꼬리표가 없다. verify_by: 2026-11-10

## v59.71 Split-adjusted SEC share count (2026-11-07)
- 완료 2건: QA-DATA-70A, QA-DATA-70B

## v59.70 Actions reliability (v59.70) (2026-11-07)
- 완료 43건: QA-OPS-REFERENCE-ROWS, QA-OPS-TELEGRAM-KINDS, QA-OPS-RELEASE-DATA-AGE, QA-OPS-FIXTURE-CLOCK, QA-OPS-FRESHNESS-LEDGER, QA-OPS-REFRESH-ORIGIN-ADVISORY, QA-OPS-CONTROL-CHAR-HOOK, QA-OPS-CI-CLOCK-ADVISORY, QA-DATA-66A, QA-DATA-66B, QA-DATA-66C, QA-DATA-66D, QA-DATA-66E, QA-DATA-66F, QA-DATA-66G, QA-DATA-ONE-VALUE, QA-DATA-HEADLINE-KO, QA-DATA-REREVIEW-ONE-VALUE, QA-OPS-WAVE2-INTEGRATION-GATES, QA-OPS-PIN-DRIFT-LIVE-DATA, QA-DATA-HISTORY-V2-BROWSER, QA-PHONE-OVERRIDE-SPECIFICITY, QA-CONTRAST-FOCUS-BROWSER, QA-COPY-READER-DUTY, QA-GLOSSARY-MACRO-LABEL, QA-PERF-BOOT-DEPLOY-BUNDLE, QA-PERF-AI-ON-INTENT, QA-OPS-WRITER-ARGS, QA-DATA-CORE-FAIL-SETTLES, QA-OPS-GATE-FREE-PORTS, QA-OPS-BROWSER-DATA-PIN, QA-DEEPLINK-RELAY-ORDER, QA-DATA-HY20-ONE, QA-DATA-CREDIT-RANGE, QA-DATA-CORRECTION-RATES, QA-DATA-EVENT-FLOWS, QA-DATA-WORKING-CAPITAL, QA-UI-ENTITY-SECTIONS, QA-PORT-S16, QA-RESEARCH-CONTENT-SOURCE, QA-SHELL-COMMAND-SEARCH, QA-SHELL-COMMAND-SEARCH-FLOWS, QA-RESEARCH-XBM-20261104

## v59.65 v59.65 브리핑 24시간 (2026-11-03)
- 완료 1건: QA-DATA-65A

## v59.64 v59.64 macro assets and 기술적 분석 (2026-11-03)
- 완료 1건: QA-DATA-64A

## v59.63 v59.63 market-day ledger (2026-11-03)
- 완료 1건: QA-DATA-63A

## v59.62 v59.62 market reflection (2026-11-03)
- 완료 1건: QA-DATA-62A

## v59.61 SEC 원장 저장소 직전 칸 (v59.61) (2026-11-03)
- 완료 1건: QA-SEC-STORE-PREVIOUS

## v59.60 형식 검증 회차 (v59.60) (2026-11-03)
- 완료 2건: QA-MARKET-SESSION-MODEL, QA-SCHEDULER-PAUSE-MODEL

## v59.59 기능별 정합성 점검 (2026-11-02)
- 완료 3건: QA-FEATURE-AUDIT-01, QA-DECOMP-GLOSSARY, QA-CALC-01

## v59.57 X 북마크 11/02 — FTD·국채 입찰 (2026-11-02)
- 완료 2건: QA-DATA-FTD-01, QA-DATA-AUCTION-01

## v59.56 빅테크 분기 현금흐름 (2026-11-01)
- 완료 4건: QA-TEXT-RELEASE-01, QA-TW-REV-01, QA-EB-PERIOD-01, QA-MA-EARN-01
- [ ] QA-BTCF-01: v59.56 빅테크 분기 현금흐름: 첫 refresh-screener 실행 로그에서 9개사 모두 status ok이고 하이퍼스케일러 5개사 합계(complete)가 나오는지, AMZN·MSFT 최근 4분기 영업현금흐름·설비투자가 회사 실적 발표의 현금흐름표 합계와 맞는지(설비투자는 총액 기준이라 회사 FCF 정의와 차이는 허용) 확인. 집계 전 종목이 있으면 로그의 concepts 값으로 태그를 CASHFLOW_CONCEPTS에 더한다. verify_by: manual

## v59.54 포트폴리오 통화 (2026-11-01)
- 완료 4건: QA-PF-CCY-01, QA-AI-PRICE-01, QA-PF-ADD-01, QA-TICKER-NAME-01

## v59.53 기존 기능과 콘텐츠의 의미·사용성 (2026-11-01)
- 완료 6건: QA-TEMPERATURE-MEANING-01, QA-VERIFY-CURRENT-PATHS-01, QA-RESEARCH-READING-FOCUS-01, QA-HOLDING-LISTING-UNIT-01, QA-SECTOR-ETF-EXPOSURE-01, QA-THEME-USER-DISCLOSURES-01

## v59.52 v59 변경 재검토 (2026-11-01)
- 완료 12건: QA-AI-SCREENER-READINESS-01, QA-PORTFOLIO-TINY-TREND-01, QA-SCENARIO-LEADER-SET-01, QA-SEMANTICS-AREA-01, QA-AI-LAZY-DRAFT-01, QA-AI-COMPARISON-PURPOSE-01, QA-PORTFOLIO-BENCHMARK-READINESS-01, QA-RETIRED-FUND-RECENT-01, QA-AI-QUERY-WORD-BOUNDARY-01, QA-SESSION-FUTURE-VALIDITY-01, QA-RENDER-FOLD-OWNERSHIP-01, QA-BROWSER-EVIDENCE-SCOPE-01

## v59.51 휴대폰 첫 동작 (2026-10-31)
- 완료 11건: QA-BOOT-TAP-01, QA-SCENARIO-TIE-01, QA-ONE-SOURCE-01, QA-AI-DOUBLE-SEND-01, QA-SIGNAL-ENTRY-01, QA-TERM-MARKS-01, QA-STOCK-HASH-01, QA-WEEKEND-FUTURES-01, QA-FISCAL-LABELS-01, QA-PANEL-TOUCH-01, QA-TWO-LAYER-01

## v59.50 매매 지시 (2026-10-31)
- 완료 1건: QA-R724-CHOICES-01

## v59.49 시세 세션 (2026-10-31)
- 완료 2건: QA-SESSION-SWEEP-LIVE-01, QA-DATA-CI-ORIGIN-LIVE-01

## v59.48 실적 브리프 (2026-10-31)
- 완료 3건: QA-EB-EPS-BASIS-LIVE-01, QA-EB-BUDGET-LIVE-01, QA-WATCHDOG-OWNER-LIVE-01

## v59.47 데이터 경계 계약 (2026-10-31)
- 완료 2건: QA-BC-SESSION-LIVE-01, QA-SEC-PROJ-DEFAULTS-LIVE-01

## v59.46 v59.46 소유자 결정 반영 (2026-10-31)
- 완료 1건: QA-SCR-ROW-CARRY-01

## v59.45 파이프라인 의미 검토 통합 (2026-10-31)
- 완료 1건: QA-PIPE-SEM-01
- [ ] QA-OPS-ALERT-RECOVERY-01: push 뒤 Worker 배포 workflow가 실패 후 smoke 단계를 통과한 성공 두 번에만 운영 이슈를 닫고, jobs API 실패 실행은 이슈를 닫지 않는다. verify_by: GitHub Actions operations-alert 실행 로그와 열린 operations 이슈 상태 확인
- [ ] QA-KR-WEIGHTS-RETAIN-01: push 뒤 event-briefs 실행에서 kr-index-weights.json이 KOSPI·KOSDAQ 두 시장을 모두 유지하고, 덜 읽힌 시장은 retained 표시와 함께 이전 값을 유지한다. verify_by: node -e "const j=require('./public-data/kr-index-weights.json');console.log(Object.keys(j.markets||{}))"
- [ ] QA-EVENT-BRIEF-AMOUNT-01: push 뒤 첫 event-briefs 실행에서 매출 '예상 대비' -99%보다 낮은 비교가 하나도 남지 않는다(10/31 기준 DLR·ENTG·COHU·GEV·STX·V 등 8건). verify_by: node -e "const j=require('./public-data/event-briefs.json');console.log(JSON.stringify(j).match(/-99\.9|-100/g)?.length||0)"

## v59.42 뉴스 키워드 규칙 단일화 (2026-10-28)
- [ ] QA-NEWS-RULE-01: 다음 refresh-data 뒤 라이브에서 브라우저 RSS 기사가 섞였을 때 오늘·브리핑·시장 뉴스 선별이 expect 스위트와 같은 규칙으로 움직이는지(복수형·한국어 조사 기사 포함, taxi·Surgery 같은 오탐 없음) 확인. verify_by: push 뒤 라이브 시장 뉴스 화면에서 window._allNewsItems의 RSS 기사(_serverBackstop 아님)를 window.scoreItem·classifyTopic으로 다시 매겨 expect 스위트 규칙과 비교, node scripts/ci-expect-output-check.mjs
- [ ] QA-NEWS-LABEL-01: 뉴스 화면 출처 표시가 기사가 있을 때 '스냅샷'이 아니라 계약 상한(DELAYED, 지연)으로 나오는지. verify_by: 로컬/라이브 시장 뉴스 화면에서 window.AIO.getNewsSelectionAudit().marketNewsEligible > 0과 페이지 sourceKind DELAYED 확인
- [ ] QA-NEWS-COV-01: push 뒤 첫 refresh-data에서 새 피드 5개가 healthy이고 묶음에 에너지·암호화폐·헬스케어·일본/중국/유럽 기사가 실리며 3등급이 12건 이하인지. verify_by: public-data/data.json meta.newsFeedHealth의 새 피드 status/kept/selected와 news[].tier·topic 집계
- [ ] QA-VERIFY-62: event-briefs.yml의 첫 Actions 실행이 10/18 이후 무버 실적(META 10/21, MSFT·GOOGL 10/28, SK하이닉스·삼성전자 DART 잠정 실적)과 10/28 FOMC 성명·기자회견(녹취록이 있으면 녹취록(예비), 없으면 보도 기준)을 채우고, 글마다 costLedger에 비용이 남으며, 오늘 '주요 발표 요약'과 종목 화면에 보인다. verify_by: push 후 event-briefs.yml 실행 로그 + public-data/event-briefs.json의 briefs·costLedger·skippedFilings 확인 + node scripts/ci-event-briefs-check.mjs
- [ ] QA-VERIFY-63: kr-index-weights.json이 한국장 마감 뒤(16:10 KST 이후) 채워지고, 세션 브리지 한국 고유 요인 줄과 직전 미국장 줄이 지수를 끈 종목과 같은 날 뉴스·텔레그램을 붙이며, 실적 달력의 미확정 대형주는 SEC 8-K 2.02로 이미 발표했는지 이유를 단다. verify_by: push 후 event-briefs.yml·refresh-screener.yml 실행 + public-data/kr-index-weights.json, public-data/earnings-calendar.json largeCapCoverage.recentlyReported·unconfirmedReasons 확인

## v59.32 사용자·운영 번거로움 제거 (2026-10-27)
- 완료 1건: QA-FRICTION-06

## v59.27 사용자·운영 번거로움 제거 (2026-10-27)
- 완료 5건: QA-FRICTION-01, QA-FRICTION-02, QA-FRICTION-03, QA-FRICTION-04, QA-FRICTION-05

## v59.10 가족 코드 제거 (v59.10) (2026-10-26)
- 완료 1건: QA-EDGE-13

## v58.89 퇴역 게이트 잔여 검사 복원 (2026-10-27)
- 완료 1건: QA-GOV-RETIRE-01

## v58.86 규칙·게이트 부채 정리 (2026-10-27)
- [ ] QA-BOUNDARY-HUMAN-01: 상시 경계: 모집 사용자 과업 검증과 키보드·스크린리더·200% 확대 실사는 자동화로 대신하지 않는다. 결과가 생기기 전까지 architecture/human-validation.json은 NOT_EXECUTED, certification은 OPERATOR_REQUIRED다(v58.86에 v54~v56의 같은 항목 12개를 합침) verify_by: architecture/human-validation.json sessions + ci-product-charter-contract-check의 human-validation 구획
- [ ] QA-BOUNDARY-KNOWLEDGE-01: 상시 경계: 지식 원고 160편과 연구 필요 단위의 사람 의미·출처 직접성 검수가 끝나기 전에는 지식 화면을 참고용으로만 말한다(v58.86에 v53~v56의 같은 항목 20개를 합침) verify_by: _context/CURRENT-STATE.md Knowledge Boundary의 human review complete 값
- [ ] QA-BOUNDARY-AI-LIVE-01: 상시 경계: 공용 Worker의 실답변 품질(후속 질문·인용·번역)은 로컬 fixture가 증명하지 않는다. 소유자가 배포본에서 블라인드 질문 묶음으로 점검한다(v58.86에 같은 항목 7개를 합침) verify_by: 소유자 블라인드 점검 기록
- [ ] QA-BOUNDARY-DATA-RIGHTS-01: 상시 경계: 유료·면허 자료(심리 지표·추정치·옵션·보안 마스터·기업행위·섹터 매핑)와 공급자 권리는 확보 전까지 참고용이며 점수에 쓰지 않는다(v58.86에 같은 항목 16개를 합침) verify_by: source-registry rightsStatus와 ci-research-model-contract-check

## v58.84 운영 알림 복구 히스테리시스 (2026-10-26)
- 완료 2건: QA-OPS-10, QA-TEST-HERMETIC-01
- [ ] QA-OPS-11: 주간 운영 점검은 디스패치·Cloudflare 토큰 만료(30일 전 경고·거절 시 조치), 저장소 크기(900 MB 경고·2 GB 조치), AI 월 예약액 80%를 상태로만 판정하고, 조치가 필요할 때만 이슈 하나를 열며 정상 주에 닫는다. 공개 이슈에 AI 금액을 쓰지 않는다. verify_by: v58.84 ci-operations-weekly-review-check.mjs; 실제 Actions 실행과 토큰 응답은 미검증
- [ ] QA-PORT-BACKUP-01: 보유 종목이 있고 백업 기록이 없거나 30일 넘었으면 포트폴리오 화면에 한 줄 백업 안내가 보이고, 내보내기 직후 사라진다. verify_by: v58.84 ci-esm-core-unit-check.mjs backupReminder; 화면 표시는 브라우저 수동 확인 필요

## v58.83 팩터 검증 외부 대조 (2026-10-26)
- 완료 2건: QA-RESEARCH-BENCH-01, QA-RESEARCH-BENCH-02

## v58.82 다중 사용자 엣지 케이스 점검 (2026-10-26)
- 완료 11건: QA-EDGE-01, QA-EDGE-03, QA-EDGE-04, QA-EDGE-05, QA-EDGE-06, QA-EDGE-07, QA-EDGE-08, QA-EDGE-09, QA-EDGE-10, QA-EDGE-11, QA-EDGE-12
- [ ] QA-EDGE-02: v58.82 다른 탭에서 보유 종목이 바뀐 뒤 이 탭에서 추가·수정·삭제하면 저장되지 않고 다시 불러오기 안내가 나온다(다른 탭 변경 보존). verify_by: 브라우저 두 탭으로 포트폴리오를 열고 한쪽에서 추가 후 다른 쪽에서 추가 시도

## v58.81 v58.81 레인 크기 격리 (2026-10-26)
- 완료 1건: QA-DATA-LANE-SIZE-01

## v58.80 미래 자료 누설 검사와 작업 방식 개선 (2026-10-25)
- 완료 33건: QA-LOOKAHEAD-01, QA-ROLL-01, QA-RELATION-01, QA-FU-01, QA-FU-02, QA-FU-03, QA-FU-04, QA-FU-05, QA-FU-06, QA-FU-07, QA-FU-08, QA-ROLL-02, QA-NUM-01, QA-NUM-02, QA-STATE-01, QA-NUM-03, QA-INPUT-01, QA-STATE-02, QA-BOOT-02, QA-UNITS-01, QA-STATE-03, QA-BOOT-03, QA-COLOR-01, QA-STATE-04, QA-PARSE-01, QA-NAV-02, QA-BOOT-04, QA-VOCAB-01, QA-SEARCH-05, QA-BASIS-07, QA-REPAINT-01, QA-BOOT-09, QA-NEWS-36
- [ ] QA-VERIFY-61: 포트폴리오 ETF 펼쳐 보기: 라이브에서 SPY·VOO가 실시간 시세로 평가액을 받으면 읽는 법 첫 카드가 ETF 속까지 본 상위 종목 막대로 나오고, 실질 종목 수 타일이 펼친 값과 보유 그대로 값을 함께 보이며, 가격 없는 추종 ETF는 문장에 이름이 남는다. verify_by: live 포트폴리오에 NVDA·SPY·VOO 보유 입력 후 데스크톱·휴대폰 확인 (로컬은 ETF 시세가 없어 ci-esm-core-unit-check 고정 입력이 대신 검증)

## v58.79 v58.79 섹션 틀, 보조 문구 상한 게이트, 오늘·테마와 섹터 문구 정리 (2026-10-25) (2026-10-25)
- 완료 18건: QA-FRAME-BUDGET-01, QA-FRAME-UNIT-01, QA-HOME-FRAME-01, QA-THEMES-FRAME-01, QA-BREADTH-SP500-01, QA-THEME-SPLIT-01, QA-MARKET-FRAME-01, QA-OTHER-FRAME-01, QA-RESEARCH-GRID-01, QA-THEME-BACKFILL-01, QA-THEME-BACKFILL-LIVE-01, QA-RESEARCH-LINKS-01, QA-CHART-DRAW-01, QA-CHART-DRAW-02, QA-CHART-REVIEW-01, QA-CHART-REVIEW-02, QA-CHART-REVIEW-03, QA-CHART-REVIEW-04
- [ ] QA-BREADTH-SP500-LIVE-01: v58.79 push 뒤 첫 refresh-screener 실행에서 public-data/screener-breadth-history.json 최근 행의 fieldMeta.breadth50.universeScope가 sp500-members-not-official-index-breadth, eligible 480 이상이고, 시장 폭 화면 분모가 "S&P 500 N개 종목"으로 바뀌었는지 확인한다. verify_by: 라이브 확인(push 뒤 refresh-screener)

## v58.78 v58.78 오늘 지수 띠, S&P 500 지도 색, 사이드바 검색 제거, 거시 머리 (2026-10-25) (2026-10-25)
- 완료 6건: QA-SECTOR-MAP-SHADE-01, QA-HOME-INDEX-STRIP-01, QA-RRG-LABELS-01, QA-THEME-TABLE-02, QA-THEME-RANK-02, QA-THEME-2W-LIVE-01
- [ ] QA-HOME-INDEX-STRIP-LIVE-01: v58.78 지수 띠를 배포본에서 확인한다(로컬은 공용 Worker 중계가 막혀 실제 분봉을 받지 못함): 4개 카드가 그려지고 등락이 시세와 맞는지, 장중 갱신되는지. verify_by: push 뒤 배포본 오늘 화면 → #home-index-strip 카드 4개·rect 그려짐, 장중 5분 뒤 다시 읽음

## v58.77 v58.77 파이프라인 감사 잔여 결함, AI 답변 맞춤, 모바일 예시 질문 (2026-10-25) (2026-10-25)
- 완료 16건: QA-MACRO-MONTH-01, QA-TEMP-STALE-01, QA-EXT-REBASE-01, QA-OPS-PAGES-RECOVER-01, QA-OPS-CI-TIMEOUT-01, QA-RUNTIME-SNAPSHOT-RETRY-01, QA-AI-EVENT-BIND-01, QA-KNOW-LKG-REF-01, QA-KNOW-PARITY-SELECT-01, QA-CBOE-RECEIPT-01, QA-FMP-QUERY-01, QA-DOSSIER-WORD-01, QA-AI-PROFILE-01, QA-AI-CHIPS-TOUCH-01, QA-AI-WEBSEARCH-STATUS-01, QA-AI-LEARN-01
- [ ] QA-MACRO-MONTH-LIVE-01: P2048: push 뒤 다음 CPI·PCE 발표 갱신에서 data.json의 cpiDelta·pceDelta가 같은 기준월의 변화이고 서사 방향이 그 값과 맞는다. verify_by: push 뒤 refresh-data → public-data/data.json macro.cpi/_asOf_cpi/cpiDelta
- [ ] QA-AI-CHIPS-DEVICE-01: v58.77 예시 질문 접기를 실제 iPhone·iPad(가상 키보드)에서 확인한다. verify_by: push 뒤 실기기에서 AI 패널 질문 1회 → 칩 접힘·입력 중 숨김 확인
- [ ] QA-AI-LEARN-LIVE-01: v58.77 사용 기록 학습을 배포본에서 켜고 며칠 사용한 뒤 요약이 실제 사용과 맞는지, 끄면 저장소에서 사라지는지 확인한다. verify_by: push 뒤 배포본 AI 패널 맞춤 시트 → 사용 기록 요약·끄기 후 localStorage aio_ai_learned_v1 부재

## v58.76 v58.76 파이프라인 복구와 개발자 전용 화면 정리 (2026-10-24) (2026-10-24)
- 완료 4건: QA-TG-MERGE-01, QA-TG-MERGE-LIVE-01, QA-DEVONLY-RETIRE-01, QA-CONSOLE-FN-RETIRE-01

## v58.75 v58.75 사용자 유형 검토 (2026-10-24) (2026-10-24)
- 완료 11건: QA-AI-SCREEN-01, QA-AI-PRICED-IMP-01, QA-BRIEF-EPS-01, QA-NEWS-SCN-TAG-01, QA-TEMP-RANK-01, QA-GUIDE-PCE-01, QA-DIST-DAYS-01, QA-THEME-ROT-01, QA-SCR-PIVOT-01, QA-PERSONA-LEVELS-01, QA-PERSONA-CHOOSE-01
- [ ] QA-AI-PF-CONSENT-01: P2036: 포트폴리오 질문은 동의 뒤에만 보유 행을 보내고, 보내지 않았으면 모델에 미전송을 알린다. verify_by: push 뒤 AI 패널 포트폴리오 칩 → 동의 창 → 답 확인
- [ ] QA-TG-LEAD-01: P2040: 채널 글의 대표 꼬리표가 첫 문장 주제를 따르고, 부정 표현은 꼬리표가 되지 않는다. verify_by: push 뒤 뉴스 채널 피드 대표 꼬리표 확인
- [ ] QA-HIDDEN-TOOLS-01: P2046: 백테스트(보유 시)·내 계획 점검·이번 주 실적·테마 상세 AI 칩이 일반 모드에서 보인다. verify_by: node .claude/skills/verify-aio/scripts/verify-aio.mjs drive today
- [ ] QA-PERSONA-LIVE-01: v58.75 라이브: 실제 시세로 차트 레벨 지도·셋업 점검표·RS선, 생산자 갱신 뒤 마진·서프라이즈·6주 실적 일정이 나온다. verify_by: push 뒤 라이브 #technical·#fundamental NVDA 확인

## v58.74 데이터 v58.74 (2026-10-24)
- 완료 25건: QA-PUTCALL-KEEP-01, QA-EVID-BRACKET-01, QA-POLITICAL-EVENTS-01, QA-MEMBER-SPLIT-01, QA-KR-CLOSE-NOTE-01, QA-HOME-WEEKEND-01, QA-THEME-POOL-01, QA-THEME-WEEK-01, QA-GUIDE-RULES-01, QA-WEEKEND-LABELS-01, QA-AUDIT-WORDING-01, QA-COPY-LINT-01, QA-FLOW-SMH-01, QA-CASH-CONV-01, QA-STOCK-TIE-01, QA-THEME-CARD-POOL-01, QA-NEWS-BRANCH-01, QA-THEME-DAY-01, QA-TEXT-FLOW-01, QA-FG-HISTORY-01, QA-NEWS-TERMS-01, QA-POLICY-LOWER-01, QA-EVENT-KST-01, QA-EXPERT-FLOW-01, QA-KR-EXPORT-LINE-01
- [ ] QA-FX-FRIDAY-01: P2012: 금요일 17시(ET) 이후 환율·선물 시세가 휴장 종가로 분류된다. verify_by: 다음 금요일 21Z 이후 refresh-data history-time 단계 통과
- [ ] QA-SCOPE-TNX-01: P2015: 해설 기준 표시에서 10년물 종가가 종가로 묶인다. verify_by: push 뒤 브리핑 AI 해설 기준 줄 확인
- [ ] QA-TG-KR-02: P2016: 직함 '국장'이 들어간 글이 한국장으로 분류되지 않는다. verify_by: push 뒤 뉴스 채널 피드 태그 확인
- [ ] QA-FUND-ABSENT-01: P2019: 공시가 있는 종목의 재무 칸이 로딩 중 '없음'으로 보이지 않는다. verify_by: node .claude/skills/verify-aio/scripts/verify-aio.mjs drive stock
- [ ] QA-TRANSITION-01: P2020: 전환 카드의 반증 조건은 전환을 실제로 풀 수 있는 조건이다. verify_by: node .claude/skills/verify-aio/scripts/verify-aio.mjs drive today
- [ ] QA-YEAR-WINDOW-01: P2022: '1년 전보다'는 날짜 기준 1년 전 관측과 비교한다. verify_by: node .claude/skills/verify-aio/scripts/verify-aio.mjs drive macro
- [ ] QA-ROE-WORD-01: P2023: 적자 해의 ROE 문장이 실제 자기자본 변화와 맞는다. verify_by: node .claude/skills/verify-aio/scripts/verify-aio.mjs drive stock
- [ ] QA-AI-DATES-01: P2024: AI 해설이 다음 주 대형 실적 날짜와 헤드라인 날짜를 자료대로 쓴다. verify_by: 푸시 후 다음 refresh-data의 marketAnalysis 본문 확인

## v58.73 UI v58.73 (2026-10-24)
- 완료 2건: QA-UI-RADIX-01, QA-MODEL-SELFCHECK-01

## v58.72 데이터 v58.72 (2026-10-23)
- 완료 4건: QA-13DG-SIZE-01, QA-EVID-PAREN-01, QA-HIST-MODEL-01, QA-NARR-MODEL-01
- [ ] QA-DRYRUN-SESSION-01: P2005: 직전 게시본의 세션이 합성 일봉보다 새로워도 dry-run 스크리너 레인이 screener.json을 다시 쓴다. verify_by: push 뒤 refresh-data의 producer-dry-run 단계 통과
- [ ] QA-CURVE-CUT-01: P2008: 곡선 움직임 문장의 끝 날짜가 화면의 공식 국채 곡선 날짜와 같다. verify_by: push 뒤 #fxbond '곡선 움직임' 날짜 확인
- [ ] QA-NARR-IDLE-01: P2009: 장이 닫힌 시간의 해설이 근거 없이 '장중 큰 움직임이 없었다'고 쓰지 않는다. verify_by: push 뒤 다음 한국 마감 후 AI 해설 확인
- [ ] QA-HEADLINE-LANG-01: P2010: 원문에 없는 악센트 라틴 단어가 섞인 번역 헤드라인은 게시되지 않는다. verify_by: push 뒤 뉴스 화면에서 'bác' 미노출 확인

## v58.71 데이터 v58.71 (2026-10-23)
- 완료 15건: QA-TG-SIGNAL-01, QA-TG-SIGNAL-02, QA-TG-SIGNAL-03, QA-BRF-DATE-01, QA-LANE-02, QA-13DG-01, QA-13DG-02, QA-SCR-SESSION-01, QA-HIST-REV-01, QA-SCR-KR-RETAIN-01, QA-BT-CAL-01, QA-PROD-SMALL-01, QA-MACRO-EDGE-02, QA-AI-REPEAT-01, QA-QUOTE-SESSION-01
- [ ] QA-SCR-COLLISION-01: P1989: refresh-screener의 rebase 충돌은 collision 재실행 1회로 이어지고, 재실행 충돌은 실패로 끝난다. verify_by: 다음 충돌 발생 시 refresh-screener 실행 로그의 'collision retry' 경고 확인
- [ ] QA-FRED-GAP-01: P1991: CPI 비교 달 공백 기간에 fredFailedSeries가 비고 cpiDelta가 이전 값으로 남지 않는다. verify_by: push 뒤 12/10 이전 refresh-data 실행의 public-data/data.json meta.fredFailedSeries·macro.cpiDelta 확인
- [ ] QA-MACRO-EDGE-01: P1992: push 뒤 refresh-data 실행에서 국채·BEA 값이 FRED보다 오래된 관측으로 덮이지 않는다. verify_by: public-data/data.json macro 필드의 fieldMeta 관측일과 FRED 관측일 비교
- [ ] QA-TG-EMPTY-01: P1993: 첫 페이지가 빈 채널은 오류로 기록되고 collectionStatus가 ok가 아니다. verify_by: 다음 차단 발생 시 telegram-digest.json channels[].error 확인
- [ ] QA-SEC-FILING-01: P1995: push 뒤 refresh-screener 로그에 periodic filers 수가 찍히고 새 공시 발행사가 갱신된다. verify_by: gh run view (refresh-screener) 로그의 '[sec-fundamentals:core] periodic filers' 줄
- [ ] QA-BREADTH-SESSION-01: P1998: push 뒤 history.json에 미국 breadth가 모두 빈 행이 새로 생기지 않는다. verify_by: public-data/history.json 최근 행의 breadth20/advanceRatio 확인
- [ ] QA-LANE-13F-01: P2001: 13F 단계가 실패한 주기도 시장·뉴스를 게시하고 13F 파일은 직전 게시로 남는다. verify_by: 다음 13F 실패 시 refresh-data 로그의 'Restore 13F files' 단계 확인
- [ ] QA-13F-AGG-01: P2002: 다음 13F 전체 실행 뒤 issuer-aggregates에 직전 분기가 들어가고 이력 분기의 countReconciled가 채워진다. verify_by: public-data/masters/issuer-aggregates.json periods와 history-index.json countReconciled 확인
- [ ] QA-HIST-NULLPREV-01: P2004: 스냅숏 전일 종가가 비어 있어도 history-time 검사가 0과 비교하지 않는다. verify_by: push 뒤 refresh-data 실행의 history-time 단계 통과 확인

## v58.70 데이터 v58.70 (2026-10-23)
- 완료 1건: QA-DATA-LANE-01
- [ ] QA-DATA-LANE-02: P1983: push 후 첫 refresh-data 실행 요약에 Lane quarantine 행이 나오고, 데이터 커밋 CI가 Browser 잡을 건너뛴 채 Attest가 성공한다. verify_by: gh run view (refresh-data, ci workflow_dispatch)

## v58.69 시장 v58.69 (2026-10-23)
- 완료 4건: QA-MKT-QUOTE-HOLE-01, QA-MKT-SESSION-HOLE-01, QA-MKT-WORDING-01, QA-NEWS-INTRADAY-MAX-01

## v58.68 시장 v58.68 (2026-10-23)
- 완료 4건: QA-HIST-BACKFILL-01, QA-MKT-LEAD-01, QA-MKT-READ-US-01, QA-MKT-FLOW-01

## v58.66 운영 v58.65 (2026-10-23)
- [ ] QA-OPS-EVTIER-01: P1977: 해석이 증거 계층(SMH·지수 선물)을 인용한 갱신이 의미 게이트를 통과해 게시된다. verify_by: gh run list --workflow refresh-data.yml --limit 3

## v58.65 운영 v58.65 (2026-10-23)
- 완료 2건: QA-OPS-MACRO-01, QA-OPS-LABEL-01
- [ ] QA-OPS-CI-01: P1974: 브라우저 샤드 설치가 timeout된 뒤의 재시도가 dpkg 잠금 때문에 실패하지 않는다. v58.67: apt 네트워크 timeout·재시도 설정, 재시도 전 남은 apt 정리. v58.68: apt 아카이브 캐시, 시도당 240초. verify_by: gh run view <CI run> --log | grep 'playwright install attempt'

## v58.64 아키텍처 감사 후속 v58.64 (2026-10-23)
- 완료 5건: QA-ARCH-AUDIT-10, QA-ARCH-AUDIT-11, QA-ARCH-AUDIT-12, QA-ARCH-AUDIT-13, QA-ARCH-AUDIT-14

## v58.63 아키텍처 품질 감사 v58.63 (2026-10-22)
- 완료 9건: QA-ARCH-AUDIT-01, QA-ARCH-AUDIT-02, QA-ARCH-AUDIT-03, QA-ARCH-AUDIT-04, QA-ARCH-AUDIT-05, QA-ARCH-AUDIT-06, QA-ARCH-AUDIT-07, QA-ARCH-AUDIT-08, QA-ARCH-AUDIT-09

## v58.62 시장 해석 증거 계층 (2026-10-21)
- 완료 1건: QA-VERIFY-60

## v58.59 실화면 점검 반영 2026-10-21 (2026-10-21)
- [ ] QA-VERIFY-59: P1954 push 뒤 첫 refresh-data 실행에서 marketAnalysis attempt 로그에 session-wording-mismatch:market.wti·metric-value-mismatch:macro.cpi(근원 CPI 인용)·axis-state-contradiction(조건 문구 인용)·no-lead-overstated(중심 흐름이 있는 날)가 다시 나오지 않고, public-data/data.json marketAnalysis.status가 verified다. verify_by: push 뒤 다음 refresh-data 로그 grep 'marketAnalysis attempt'

## v58.54 producer dry run 시계 고정 (2026-10-21)
- 완료 1건: QA-DATA-63

## v58.43 시나리오·학습 (2026-10-19)
- [ ] QA-LESSONS-RECORD-01: 배포 뒤 라이브 #screener 화면 원칙의 '순위가 높으면 오른다' 근거 문장이 screener-candidate-archive.json의 독립 표본 판정과 같은 말을 한다. verify_by: 라이브 #screener 원칙 카드 + public-data/screener-candidate-archive.json summarize

## v58.39 시나리오·학습 (2026-10-19)
- [ ] QA-EVIDENCE-01: 배포 뒤 라이브 거시·오늘 화면의 과거 빈도 문장이 기준선과 구별되지 않는 경우 비율 없이 건수·기준선만 말하고, 다음 시나리오 성과 갱신의 scenario-outcomes.json에 method가 기록된다. verify_by: 라이브 #macro #home 과거 빈도 문장 + public-data/scenario-outcomes.json method

## v58.38 시나리오·학습 (2026-10-19)
- [ ] QA-INTERPRETATION-01: 배포 뒤 라이브 오늘·거시·브리핑·테마의 중심 시나리오 이름이 서로 같고, public-data/scenario-state.json의 crossroads.leadId와도 같다. verify_by: 라이브 #home #macro #briefing #themes + scenario-state.json leadId 비교

## v58.31 시나리오·학습 (2026-10-19)
- [ ] QA-MARKET-GUIDE-01: 배포 뒤 라이브 오늘 화면에 '오늘의 가이드' 카드가 시나리오 블록 아래 보이고, 선택지 집계·지향/지양·오늘 해당하는 원칙이 나오며 '개념 배우기'가 해당 원리 레슨을 연다. 다음 데이터 갱신 뒤 scenario-state.json에 guide 항목이 생긴다. verify_by: 라이브 #home 확인 + public-data/scenario-state.json의 guide 필드
- [ ] QA-SCREEN-LESSONS-01: 배포 뒤 시장 상태·거시·차트·스크리너·포트폴리오 화면의 '이어서 볼 곳' 앞에 원칙 카드가 최대 3개 보이고, 차트·종목·스크리너 화면에는 시장 상태 근거 문장이 붙지 않는다. verify_by: 라이브 #signal #macro #technical #screener #portfolio 확인

## v57.99 SEC 재무 기준 (2026-10-17)
- 완료 2건: QA-SEC-BASIS-01, QA-SEC-BASIS-02

## v57.97 배포 번들링 (2026-10-17)
- 완료 1건: QA-DEPLOY-BUNDLE-01

## v57.95 스크리너 산출물 압축 (2026-10-17)
- 완료 1건: QA-SCR-43

## v57.94 주도 영역 이탈 안정화 (2026-10-17)
- 완료 1건: QA-REPLAY-02

## v57.92 지식 근거·전수 감사 반영 (2026-10-17)
- 완료 2건: QA-KNOW-EVID-01, QA-VERIFY-58

## v57.91 v57.91 로딩·렉 최적화 (2026-10-16)
- 완료 1건: QA-VERIFY-57

## v57.90 data-store SEC 원장 분할 (2026-10-16)
- 완료 1건: QA-VERIFY-56

## v57.89 13F 운용사 원장 분할 (2026-10-16)
- 완료 2건: QA-MASTERS-STORE-01, QA-VERIFY-55

## v57.88 v57.88 품질 점검 (2026-10-16)
- 완료 4건: QA-VERIFY-51, QA-VERIFY-52, QA-VERIFY-53, QA-VERIFY-54

## v57.87 한국 급락 뉴스·AI 해설 (2026-10-16)
- 완료 9건: QA-VERIFY-42, QA-VERIFY-43, QA-VERIFY-44, QA-VERIFY-45, QA-VERIFY-46, QA-VERIFY-47, QA-VERIFY-48, QA-VERIFY-49, QA-VERIFY-50

## v57.86 SEC IFRS·비USD 정규화 (2026-10-16)
- 완료 3건: QA-VERIFY-38, QA-VERIFY-39, QA-VERIFY-40
- [ ] QA-VERIFY-41: P1881 push 뒤 다음 KRX 장중에 운영 005930.KS 종목 화면이 '전일 기준 미확인' 대신 직전 완료 세션 일봉 종가 대비 등락을 보인다. verify_by: 다음 KRX 세션 09:30~15:30 KST에 운영 종목 화면 확인

## v57.84 기술 지표 정의 통일 (2026-10-16)
- 완료 7건: QA-TECHDEF-01, QA-VERIFY-33, QA-SCRMODEL-01, QA-VERIFY-34, QA-TECHDEF-02, QA-SCRMODEL-02, QA-VERIFY-37
- [ ] QA-VERIFY-35: P1873: push 뒤 refresh-screener 실행에서 sec-fundamentals failures의 required-us-gaap-annual-concepts-unavailable 행이 모두 conceptSetVersion sec-annual-concepts.v5를 갖고, TFC·FITB·RF·GS·CRWD·VLO가 data로 옮겨지며, MTB·HBAN·EWBC 재수집 뒤 revenueConcept가 derived:InterestIncomeExpenseNet+NoninterestIncome이고 margin이 보류되지 않는지 확인한다. 미국 핵심 순위 수가 747 근처인지 본다. verify_by: push 뒤 refresh-screener 2~3회 실행 후 data-store 원장과 screener.json 검사
- [ ] QA-VERIFY-36: P1874 push 뒤 첫 refresh-data에서 rotationHistory 행마다 trail 20점이 있고 테마 화면 산점도·카드·막대 배지가 같은 정착 사분면을 보이며, 첫 스크리너 갱신에서 vcpStage 분포 변화(near_pivot·breakout 수)를 기록하고, 다음 주간 scenario-outcomes 갱신에서 themes[*].basis가 relative-banded가 된다. verify_by: push 뒤 public-data/data.json rotationHistory·screener.json·scenario-outcomes.json과 운영 사이트 테마 화면 확인

## v57.83 급변 구간 재생 (2026-10-16)
- 완료 1건: QA-REPLAY-01

## v57.71 오늘의 한 문장 (v57.71) (2026-10-15)
- 완료 1건: QA-VERIFY-32

## v57.70 직전 종가 세션 날짜 (v57.70) (2026-10-15)
- 완료 1건: QA-VERIFY-31

## v57.69 급락일 시장 해설 (v57.69) (2026-10-15)
- [ ] QA-VERIFY-30: P1800 배포 후 다음 refresh-data 산출물의 marketAnalysis가 큰 움직임의 원인을 헤드라인에 귀속하고, CPI가 오른 달에 물가 둔화를 단정하지 않으며, 코스피 3% 이상 움직인 날 코스피를 언급한다(또는 retained/blocked로 정직하게 표시). verify_by: push 뒤 다음 refresh-data의 public-data/data.json marketAnalysis·semanticIssues 확인

## v57.68 한국 지수 전일 종가 (v57.68) (2026-10-15)
- [ ] QA-VERIFY-29: P1799 배포 후 KRX 개장 직후(09:00~09:30 KST) refresh-data 1회 뒤 market-snapshot.json ^KS11/^KQ11 previousValue가 market-temperature.json의 직전 KST 종가와 같고, 홈 화면 한국 지수 등락률이 그 기준으로 표시된다. verify_by: push 뒤 다음 KRX 개장 직후 산출물과 운영 사이트 홈 확인

## v57.67 개인 데이터 키 퇴역 (v57.67) (2026-10-15)
- [ ] QA-VERIFY-28: v57.67 배포와 BOK_API_KEY·KOSIS_API_KEY Secret 등록, Deploy AI proxy 실행 후: 운영 사이트 설정에 개인 키 입력칸이 없고, 거시 화면 한국은행 기준금리·KR CPI가 운영자 중계로 채워지며, 재무 화면 실적 캘린더가 공용 수집 자료로 보인다. verify_by: Secret 등록·Worker 재배포 후 운영 사이트 설정·거시·재무 화면 확인

## v57.66 SEC 다중 클래스 주식 수 (v57.66) (2026-10-15)
- 완료 1건: QA-VERIFY-27

## v57.65 SEC 원장 digest 대조 (2026-10-15)
- 완료 1건: QA-SEC-STALE-LEDGER-01

## v57.61 라이브 10인 점검 후속 v57.56 (2026-10-14)
- 완료 1건: QA-VERIFY-26

## v57.59 라이브 10인 점검 후속 v57.56 (2026-10-14)
- 완료 1건: QA-VERIFY-25

## v57.58 라이브 10인 점검 후속 v57.56 (2026-10-14)
- 완료 1건: QA-VERIFY-24, QA-VERIFY-25

## v57.56 라이브 10인 점검 후속 v57.56 (2026-10-14)
- 완료 1건: QA-VERIFY-23

## v57.55 라이브 10인 점검 v57.55 (2026-10-14)
- 완료 1건: QA-VERIFY-22

## v57.54 검증 스킬 (2026-10-14)
- 완료 1건: QA-VERIFY-21

## v57.53 검증 스킬 (2026-10-13)
- 완료 1건: QA-VERIFY-20

## v57.52 검증 스킬 (2026-10-13)
- [ ] QA-VERIFY-19: P1718~P1730: 배포 후 Worker /health의 schedulerDispatch.lastObservation이 accepted 또는 recent-success이고 refresh-data 실행 간격이 1시간 이내로 줄며, data.json에 newsIntraday가 발행되고 marketAnalysis가 verified(또는 retained)로 나오며, 운영 사이트 005930 히어로 등락률이 스크리너 ret1d와 같다. verify_by: push·배포 뒤 2~3시간 Worker /health·gh run list·운영 사이트 확인

## v57.51 검증 스킬 (2026-10-13)
- 완료 1건: QA-VERIFY-18

## v57.50 검증 스킬 (2026-10-13)
- 완료 1건: QA-VERIFY-17

## v57.49 검증 스킬 (2026-10-13)
- 완료 1건: QA-VERIFY-16

## v57.48 verify-aio user-path verification (2026-10-13)
- 완료 5건: QA-VERIFY-09, QA-VERIFY-10, QA-VERIFY-11, QA-VERIFY-12, QA-VERIFY-13
- [ ] QA-VERIFY-14: P1680: 테마 화면에서 '섹터별 숫자'를 열고 타일을 한 번 누른 뒤 시세 갱신이 와도 접힘과 선택이 유지된다. verify_by: 배포 사이트 테마 화면에서 장중 시세 갱신 후 확인
- [ ] QA-VERIFY-15: P1681: 미국 종가가 최신 거래일보다 오래된 동안 테마 표·테마 상세·AI 테마 답변이 '지금 주도'를 단정하지 않고 기준일 참고로 말한다. verify_by: 데이터 갱신 전 시간대에 배포 사이트 테마 화면과 AI 테마 질문 1회

## v57.47 깊이 보기 학습 접힘 (2026-10-12)
- 완료 12건: QA-DEEP-DIVE-01, QA-STRESS-OUTCOMES-01, QA-SPEED-01, QA-QA-SPEED-01, QA-VERIFY-01, QA-VERIFY-02, QA-VERIFY-03, QA-VERIFY-04, QA-VERIFY-05, QA-VERIFY-06, QA-VERIFY-07, QA-VERIFY-08
- [ ] QA-DEEP-DIVE-02: P1663: 투자 심리 지표 카드와 시장 폭 화면에 공용 깊이 보기 접힘이 있다. verify_by: verify-aio skill (시장 상태 화면 #sentiment .regime-axis-deep 6개; ci-responsive-browser-check는 이 접힘을 단언하지 않음; 정적 구조는 ci-codex-structure-regression-fixture P1663)
- [ ] QA-WATCHDOG-LATCH-01: P1665: 감시 실행은 자기 직전 실패만으로 실패하지 않고, Worker 갱신 호출 토큰이 없으면 data-plane이 재배포된다. verify_by: push 후 data-watchdog 다음 실행 + data-plane /health schedulerDispatch.configured
- [ ] QA-REFRESH-LOCK-01: P1666: 갱신 생산 job만 refresh-data 잠금을 갖고, 수렴 대기는 converge job에서 돌며, 감시는 Pages 배포 완료를 따라 실행된다. verify_by: push 후 Refresh market data 실행의 job 구성과 Data freshness watchdog 이벤트(workflow_run) 확인

## v57.46 AI 웹검색 단일 경로 (2026-10-12)
- 완료 3건: QA-WEBSEARCH-SINGLE-01, QA-HISTORY-CLOSE-01, QA-SCORE-AI-01
- [ ] QA-BASIS-KEYBOARD-01: P1658: 근거 설명 카드는 키보드 초점으로 근거를 열 수 있고, 평소 화면에는 버튼이 보이지 않는다. verify_by: verify-aio skill (Tab → 근거 버튼 → aio-basis-card 표시; ci-responsive-browser-check 미포함, 초점 크기만 ci-accessibility-matrix-check P1658)
- [ ] QA-SIGNAL-LENGTH-01: P1659: 시장 상태 축 카드는 대표 수치 1행과 바뀌는 조건만 펼치고 나머지는 접는다. verify_by: verify-aio skill (#signal regime-board 높이·접힘; ci-responsive-browser-check는 6축 존재만 단언)

## v57.45 AI 패널·모바일 입력 (2026-10-12)
- 완료 3건: QA-AI-ALWAYS-ON-01, QA-MOBILE-TYPING-01, QA-FREE-DATA-01

## v57.44 한국장·AI 해설 표면 (2026-10-12)
- 완료 3건: QA-KR-SESSION-01, QA-FUND-AGE-01, QA-CHAT-CONTRACT-01

## v57.43 시장 읽기 시간 정렬 (2026-10-12)
- 완료 6건: QA-CODEX-TIME-01, QA-CODEX-AI-01, QA-CODEX-ENTITY-01, QA-CODEX-REFRESH-01, QA-CODEX-NEWS-01, QA-CODEX-CANON-01

## v57.42 생산 레인 크기 (2026-10-12)
- 완료 12건: QA-SEC-PROJECTION-01, QA-SCENARIO-GUIDANCE-01, QA-CHART-INTERVALS-01, QA-AI-REGIME-CONTEXT-01, QA-RESEARCH-LIVE-OBS-01, QA-REGIME-RADAR-01, QA-CREDIT-TIERS-01, QA-CHART-EXTENSION-01, QA-TICKER-SUMMARY-01, QA-HOME-SECTORS-01, QA-RESEARCH-SHELF-01, QA-BASIS-CARD-01

## v57.41 재렌더 상태 보존 (2026-10-12)
- 완료 2건: QA-RERENDER-DISCLOSURE-01, QA-OVERLAY-ROUTE-01

## v57.40 종목 분석 구조·시장 분리 (2026-10-12)
- 완료 6건: QA-ENTITY-SUMMARY-01, QA-SCREENER-MARKET-01, QA-CHART-SCENARIOS-01, QA-FISCAL-QUALITY-01, QA-REGIME-CONTINUITY-01, QA-KR-SESSION-FRESHNESS-01

## v57.39 시장 폭·테마·사전 (2026-10-11)
- 완료 4건: QA-BREADTH-THEME-GLOSSARY-01, QA-AI-CONTENT-COVERAGE-01, QA-THEME-MEMBERS-COMPARISON-01, QA-COMPARISON-BASIS-01

## v57.38 반응형 화면 (2026-10-11)
- 완료 2건: QA-RESPONSIVE-01, QA-MARKET-IDENTITY-01

## v57.36 조건부 공용 AI 웹검색 (2026-10-11)
- 완료 2건: QA-NATIVE-SEARCH-01, QA-SEARCH-TOGGLE-01

## v57.35 공용 연결과 개인 공급자 (2026-10-11)
- 완료 1건: QA-CONNECTION-01

## v57.34 모드와 자료 사고 체계 (2026-10-11)
- 완료 3건: QA-THEME-INTERACTION-01, QA-RESEARCH-REASONING-01, QA-RESEARCH-SEARCH-01

## v57.33 REA·SaveTicker 참조 적용 (2026-10-11)
- 완료 3건: QA-REFERENCE-NEWS-01, QA-REFERENCE-SNAPSHOT-01, QA-REFERENCE-EVIDENCE-01

## v57.32 운영 자동화·분석 검증 (2026-10-10)
- 완료 10건: QA-OPS-ANALYSIS-01, QA-OPS-DISPATCH-01, QA-OPS-HEALTH-01, QA-OPS-SLO-01, QA-OPS-ALERT-01, QA-V5732-01, QA-V5732-02, QA-V5732-03, QA-V5732-04, QA-V5732-05

## v57.31 v57.31 merge and decision batch (2026-10-10)
- 완료 30건: QA-V5731-01, QA-V5731-02, QA-V5731-03, QA-V5731-04, QA-V5731-05, QA-V5731-06, QA-V5731-07, QA-V5731-08, QA-V5731-09, QA-V5731-10, QA-V5731-11, QA-V5731-12, QA-V5731-13, QA-V5731-14, QA-V5731-15, QA-V5731-16, QA-V5731-17, QA-V5731-18, QA-V5731-23, QA-V5731-24, QA-V5731-25, QA-V5731-26, QA-V5731-27, QA-V5731-28, QA-V5731-29, QA-V5731-30, QA-V5731-31, QA-V5731-32, QA-V5731-33, QA-V5731-34, QA-WATCHDOG-LATCH-01, QA-VERIFY-19
- [ ] QA-V5731-19: AAII degradation warns without blocking refresh. verify_by: next refresh-data run with AAII unavailable
- [ ] QA-V5731-20: Market analysis status is explained on every run — a verified run's claims match the published inputs, a held run names the failed check, and the held/verified count over the window is reported (v57.84: 'verified on most runs' rewarded passing over correct holds). verify_by: public-data/data.json marketAnalysis.status + reason over the next 10 refresh runs
- [ ] QA-V5731-21: the sentiment composite is a met-condition count (n of 7 conditions), not a calibrated score or a likelihood; each missing condition shows as missing (never counted as met or unmet) and the card states n of available, not n of 7, when inputs are absent (v57.84 revision). verify_by: #sentiment composite card condition count after push
- [ ] QA-V5731-22: An extreme screener P/E is reconciled against the filing (shares class and scale, EPS period, units) before it is kept or held — a very high P/E from a tiny profit is legitimate, a share-scale error is not (v57.84: 'above 5,000' is not the test). verify_by: after next SEC refresh: public-data/screener.json PKG pe vs SEC companyfacts

## v57.29 공유 기반 아키텍처 회귀 (2026-10-08)
- 완료 3건: QA-ARCH-1518, QA-RELEASE-1518, QA-AI-1519

## v57.28 Codex 브라우저 감사 v57.27 반영 (2026-10-08)
- 완료 13건: QA-BRW-01, QA-BRW-02, QA-BRW-03, QA-BRW-04, QA-BRW-05, QA-BRW-06, QA-BRW-07, QA-BRW-08, QA-BRW-09, QA-BRW-10, QA-BRW-11, QA-BRW-12, QA-BRW-13

## v57.08 거시 direction reads (2026-10-03)
- 완료 1건: QA-MACRO-HISTORY-LIVE-01

## v57.06 GPT-6 Luna shared AI migration (2026-10-03)
- 완료 6건: QA-AI-LUNA-01, QA-AI-LUNA-LIVE-01, QA-PROVIDER-OWNERSHIP-01, QA-PROVIDER-LIVE-01, QA-PROVIDER-STRUCTURE-01, QA-AI-READINESS-01, QA-BOUNDARY-AI-LIVE-01

## v56.89 Screen honesty (2026-10-01)
- 완료 1건: QA-UX-SOURCE-01

## v56.88 Page decision scope (2026-10-01)
- 완료 1건: QA-SEMANTIC-SCOPE-01

## v56.87 Semantic, financial and operating-budget audit (2026-09-30)
- 완료 8건: QA-SEMANTIC-DATA-01, QA-SEMANTIC-VAULT-01, QA-SEMANTIC-DEPLOY-01, QA-SEMANTIC-UI-01, QA-SEMANTIC-BUDGET-01, QA-SEMANTIC-FORMAT-01, QA-SEMANTIC-PRODUCER-01, QA-SEMANTIC-CURRENT-01
- [ ] QA-SEMANTIC-DEPLOY-02: Bot-advanced main converges Pages and both Workers using specifically approved dispatch CI consumption; proposal is pending and not applied. verify_by: P1351 approved DEPLOYMENT-PROPOSAL.md implementation + isolated driver regression + CI-attested live probe
- [ ] QA-SEMANTIC-ROTATION-01: The durable derived RRG artifact reaches the native provider while preserving aligned completed sessions, raw-price limits, failed observations and reference-only use. verify_by: P1358 ci-rotation-history-check + ci-esm-core-unit-check + Actions producer run + real-data themes screenshot

## v56.86 continued reconstruction audit (2026-09-30)
- 완료 3건: QA-OPS-AG-05, QA-OPS-NAV-01, QA-DATA-62

## v56.85 parallel dead-code trim, harness governance (2026-09-30)
- 완료 3건: QA-OPS-AG-03, QA-OPS-AG-04, QA-UX-11

## v56.84 facade trim, orphaned initializers, MA fallback (2026-09-30)
- 완료 5건: QA-UX-10, QA-DATA-60, QA-DATA-59, QA-OPS-AG-02, QA-DATA-61

## v56.83 deploy blockers, Worker rollback, FRED retry, delegation routines (2026-09-29)
- 완료 4건: QA-OPS-SEC-01, QA-OPS-DEP-01, QA-DATA-58, QA-OPS-AG-01

## v56.82 self-audit split, Masters budget, tooltip targets, route-count follow-up (2026-09-29)
- 완료 1건: QA-OPS-QA-01

## v56.81 close-basis score, one status vocabulary, desktop-only, Masters and KR themes (2026-09-29)
- 완료 5건: QA-UX-08, QA-UX-06, QA-DATA-57, QA-UX-07, QA-UX-09

## v56.80 home numbers-first first screen and record-fix ledger flow (2026-09-29)
- 완료 2건: QA-UX-05, QA-OPS-REC-01

## v56.79 options route retirement (2026-09-29)
- 완료 1건: QA-ROUTE-19

## v56.78 KR ticker route, reference size filter, stale-note and tooltip usability (2026-09-28)
- 완료 4건: QA-UX-02, QA-DATA-56, QA-UX-03, QA-UX-04

## v56.77 full-audit user-visible fixes and full personal-data backup (2026-09-28)
- 완료 2건: QA-UX-01, QA-DATA-55

## v56.76 knowledge candidate workspace symlink containment (2026-09-28)
- 완료 1건: QA-DATA-54

## v56.75 operations alert source collector (2026-09-28)
- 완료 1건: QA-OPS-03

## v56.74 private AI usage observation source (2026-09-28)
- 완료 1건: QA-OPS-02

## v56.73 operator alert policy (2026-09-28)
- 완료 1건: QA-OPS-01

## v56.72 knowledge build candidate artifact (2026-09-28)
- 완료 1건: QA-DATA-52

## v56.72 annual exchange-calendar review reminder (2026-09-28)
- 완료 1건: QA-DATA-53

## v56.67 macro calendar candidate review safeguards (2026-09-28)
- 완료 1건: QA-DATA-48

## v56.69 attested Worker auto-deploy and smoke rollback (2026-09-28)
- 완료 1건: QA-DATA-49

## v56.71 SEC 13D/G polling and 13F filing-season imports (2026-09-28)
- 완료 1건: QA-DATA-51

## v56.70 Worker deployment convergence recovery (2026-09-28)
- 완료 1건: QA-DATA-50

## v56.65 generated Principles lesson parity (2026-09-28)
- 완료 1건: QA-DATA-47

## v56.64 annual exchange calendar (2026-09-28)
- 완료 1건: QA-DATA-46

## v56.63 monthly screener-universe review report (2026-09-28)
- 완료 1건: QA-DATA-45

## v56.56 F-52 뉴스 분석 최소 표본 게이트 (2026-09-27)
- 완료 2건: QA-DATA-26, QA-DATA-27

## v56.58 live-core strict lineage·legacy F-52 표본 경계 (2026-09-27)
- 완료 4건: QA-DATA-30, QA-DATA-29, QA-DATA-31, QA-DATA-33
- [ ] QA-DATA-32: market-snapshot 실패·불일치·12시간 stale 시에만 실패 진단 artifact를 남긴다. 값은 registry Tier-0 ID, 품질/세션 enum, bounded count·coverage만 포함하고 provider 자유 문자열·payload·credential은 제외한다. 로컬 redaction·크기·freshness fixture와 capture/upload workflow contract가 통과했는지 확인한다. 원격 artifact 실제 내용은 캡처 workflow가 포함된 revision의 다음 scheduled refresh에서 인수한다. verify_by: `ci-data-refresh-audit.mjs` P1289/R639 redaction·size·freshness fixture와 static capture/upload contract; 다음 `Refresh market data` failure artifact read-only review.

## v56.61 strict freshness and macro-source contracts (2026-09-27–28)
- 완료 11건: QA-DATA-34, QA-DATA-35, QA-DATA-36, QA-DATA-37, QA-DATA-38, QA-DATA-39, QA-DATA-40, QA-DATA-41, QA-DATA-44, QA-DATA-42, QA-DATA-43

## v56.57 운영·저장 뉴스·CI 실패 증거 (2026-09-27)
- 완료 2건: QA-DATA-28, QA-CI-01

## v56.55 E0 원자 전환·portfolio reader 단일화 (2026-09-27)
- 완료 4건: QA-E0-ATOMIC, QA-E0-VIEWSTATE-PRODUCER, QA-E0-SHELL-EFFECT-ORDER, QA-E0-READERS

## v56.48 E7 잔여 — 감사 3종 결함 클러스터 + 큐 3종 (2026-09-25)
- 완료 3건: QA-THM-CLEANUP, QA-GLOSSARY-SWEEP, QA-THM-35, QA-E5-RECEIPT

## v56.47 E3/E4 FX 계획 4 — 백테스트 통화축 (2026-09-25)
- 완료 2건: QA-FX-CONSUMERS, QA-FX-SERIES, QA-FX-REFRESH

## v56.46 E3/E4 FX 통화축 선행 BLOCKER (2026-09-25)
- 완료 3건: QA-FX-AXIS, QA-FX-REFRESH, QA-FX-CONSUMERS

## v56.45 E6 A05 요청별 출처 소유권 (2026-09-25)
- 완료 2건: QA-AI-A05, QA-AI-A05-STREAM

## v56.42 E5 R24-07 SLO 예정 도착 집계 (2026-09-25)
- 완료 2건: QA-E5-SLO, QA-E5-RECEIPT

## v56.40 E2 잔여 S-C·S-E·S-F (2026-09-25)
- 완료 4건: QA-E2-SC, QA-E2-SE, QA-E2-SF, QA-E2-40

## v56.39 LC-31/32/35/36/50~53 기사·테마·근거·학습 정직성 (2026-09-25)
- 완료 9건: QA-NEWS-31, QA-NEWS-32, QA-THM-35, QA-THM-36, QA-ATL-50, QA-MST-51, QA-GUIDE-52, QA-PRN-53, QA-FINAL-39

## v56.38 LC-43~49 공개 포트폴리오·시장 표시 정직성 (2026-09-25)
- 완료 8건: QA-PORT-43, QA-PORT-44, QA-PORT-45, QA-MKT-46, QA-MKT-47, QA-MKT-48, QA-MKT-49, QA-PORT-MKT-38

## v56.37 LC-30/22/19/21/29/28/37/38 shard 동치·수량·문장 정직성 (2026-09-25)
- 완료 7건: QA-MST-30, QA-ATL-22, QA-GUIDE-19, QA-GUIDE-21, QA-SENT-29, QA-THM-28, QA-CONTENT-37

## v56.36 LC-39/33/34 교차 라우트 정체성·뉴스 접근성 (2026-09-25)
- 완료 4건: QA-ENT-39, QA-NEWS-33, QA-NEWS-34, QA-NEWS-35

## v56.35 E2 LC-25/26/40~42 스크리너·신호 결과 정직성 (2026-09-25)
- 완료 8건: QA-SCR-40, QA-SCR-25, QA-SCR-41, QA-SCR-42, QA-SIG-26, QA-SCR-28, QA-SIG-27, QA-DOC-01, QA-01, QA-EXHAUST-98, QA-02

## v56.14 스크리너 frozen-run 동일성 (2026-09-22)
- 완료 1건: QA-SCR-01

## v56 공유/사용자 자격증명 평면 (2026-09-20)
- 완료 22건: QA-CRED-01, QA-CRED-02, QA-CRED-03, QA-CRED-04, QA-CRED-05, QA-CRED-08, QA-CRED-18, QA-CRED-19, QA-CRED-21, QA-CRED-20, QA-CRED-30, QA-CRED-31, QA-CRED-33, QA-CRED-32, QA-CRED-22, QA-CRED-23, QA-CRED-25, QA-CRED-26, QA-CRED-27, QA-CRED-29, QA-CRED-15, QA-CRED-07, QA-VERIFY-28, QA-CRED-14, QA-DATA-29
- [ ] QA-CRED-14: **`/relay`와 데이터 프록시의 실효 방어는 라이브에서 아직 검증되지 않았고, 위조 클라이언트 위험은 남아 있다.** Origin 강제는 비브라우저 클라이언트가 헤더를 위조하면 통과하고, `AIO_APP_TOKEN` 값은 공개 클라이언트 JS에 상수가 있으며(`_aioAppToken`), 레이트리밋 바인딩은 **로케이션별**이라 전역 상한이 아니다. 따라서 위조 클라이언트는 `/relay`로 운영자 FRED/BOK/KOSIS 쿼터를 하루 `RELAY_DAILY_CAP`(기본 2000)까지 소진시킬 수 있고, 일반 프록시에는 일일 캡이 아예 없다. 또한 대시보드 스크린샷 기준으로 라이브 `aio-proxy`는 **커밋 `6ef2561d`(2026-08-29)** 를 실행 중이고 `AIO_APP_TOKEN`·`RELAY_DAILY_CAP`·relay 키가 아직 없으며, 배포된 코드에 `/relay` 자체가 없다. verify_by: `deploy-ai-proxy.yml` 재배포 후 (a) `/health`가 `relay.appTokenRequired===true`·`relay.configured.fred===true`를 보고하고 `AIO_APP_REVISION`이 v56인지, (b) 위조 Origin + 무토큰 요청이 403/429로 막히는지, (c) `RELAY_RATE_LIMITER` 계열 429가 Workers Logs에 실제로 나타나는지
- [ ] QA-CRED-24: **`provider === 'POST'/'POSTPOST'` 경로에 같은 계열의 불일치가 남아 있다.** 이 분기는 스케줄을 보지 않고 무조건 `AFTER_HOURS`를 반환하는데, 품질 매퍼가 그 라벨을 24h로 제한한다. 실측된 실패 경로는 아니었으므로 관측 없이 바꾸지 않았다. verify_by: 이 분기를 타는 실제 피드가 관측되면(스냅샷 status의 `errors`에 `AFTER_HOURS`가 등장) 세션 스케줄과 정합화하고 `ci-market-snapshot-contract-check.mjs`에 힌트 `POST` 케이스를 추가
- [ ] QA-CRED-16: **같은 데이터의 캐시 TTL이 세 곳에서 독립적으로 선언돼 있다.** `sw.js` 데이터 900s(FRED 포함), `cloudflare-worker-proxy.js` 일반 프록시 FRED 3600s, `/relay` 제공자별 3600s, `worker/data-plane.js` `/quotes` 30s+SWR120 — 서로를 교차 검증하는 코드가 없어 같은 시리즈가 SW에서 15분, 엣지에서 1시간까지 다르게 노후될 수 있다. 또한 `/relay` 응답은 `Cache-Control: public, max-age=3600`이므로 **운영자 키를 교체해도 엣지/브라우저 캐시가 최대 1시간 옛 페이로드를 계속 준다**. verify_by: 캐시 TTL 단일 선언 원천 도입 시 `ci-service-worker-cache-policy-check.mjs` + `ci-worker-relay-check.mjs`, 또는 런북에 "키 교체 후 1시간 대기 또는 URL 파라미터 변경" 절차 명시
- [ ] QA-CRED-17: **알림 공백과 죽었을 가능성이 있는 감사.** (a) `operations-alert.yml`은 `workflow_run` 이벤트로 동작하는데 `ensure-live-convergence.mjs`가 기본 `GITHUB_TOKEN`으로 디스패치한 CI/Pages 실행은 `workflow_run`을 발생시키지 않으므로, **봇이 스스로 만든 실행의 실패는 아무에게도 알려지지 않는다**. (b) `AIO.getShellAssetIntegrityAudit`(`js/aio-core.js:10576`)이 `sw.js`에서 `/SHELL_ASSETS\s*=\s*\[/`로 배열을 찾는데 이는 `CRITICAL_SHELL_ASSETS`의 **부분 문자열 우연**으로만 일치한다 — 이름을 바꾸면 감사가 조용히 `SHELL_ASSETS 패턴 미발견`이 되고, 게다가 이 함수를 호출하는 곳을 찾지 못했다(dead code 가능성). verify_by: (a) `ci-workflow-compaction-check.mjs` + 알림 경로에 디스패치 실행 포함 여부 확인, (b) `js/aio-core.js`의 호출부 존재 여부와 정규식이 실제 식별자를 요구하도록 고친 뒤 `ci-runtime-contract-check.mjs`
- [ ] QA-CRED-06: operator CI secrets `TWELVE_DATA_API_KEY`·`FINNHUB_API_KEY` (used only by producers in Actions: `refresh-data.yml` 2차 시세 폴백, `refresh-screener.yml` 어닝 캘린더) must exist; the personal-key UI is retired, so these secrets are the only key path. 없으면 두 레인이 조용히 비므로 존재를 확인한다. verify_by: `ci-operator-secrets-contract-check.mjs` + 운영자 시크릿 목록 대조(`_context/OPERATOR-RUNBOOK.md` §1)

## v55.06 작업 환경 루프 보강 (2026-09-19)
- 완료 22건: QA-EXHAUST-74, QA-EXHAUST-75, QA-EXHAUST-76, QA-EXHAUST-77, QA-EXHAUST-96, QA-EXHAUST-97, QA-EXHAUST-78, QA-EXHAUST-79, QA-EXHAUST-80, QA-EXHAUST-82, QA-EXHAUST-87, QA-EXHAUST-89, QA-EXHAUST-93, QA-EXHAUST-91/92, QA-EXHAUST-95, QA-EXHAUST-90, QA-EXHAUST-94, QA-EXHAUST-88, QA-EXHAUST-86, QA-EXHAUST-84, QA-EXHAUST-81, QA-EXHAUST-91, QA-AICHAT11
- [ ] QA-EXHAUST-98: **`affected` 프로파일의 skip 의미를 감사한다(P1141).** 이번 세션에서 블록 A 추출이 `browser-chat-ui-state`를 깨뜨렸는데, 그 게이트는 `affected` 실행에서 **skip**되어 통과로 보였고, 리베이스 후 skip=0이 되면서 처음 실패가 드러났다. 즉 "affected PASS"가 추출 안전성의 증거가 되지 못한다. 확인할 것: (a) skip이 "그룹 미선택"인지 "입력 미변경"인지, (b) `inputs`를 선언하지 않은 게이트(예: `browser-chat-ui-state`는 `timeoutMs`·`usesLocalServer`만 있고 `inputs` 없음)가 어떤 규칙으로 선택·skip되는지, (c) `js/**` 패턴이 `browser-runtime` 그룹을 실제로 포함하는데도 왜 skip됐는지. verify_by: ci-qa-runner-behavior-check + 회귀 픽스처(추출 파일만 바꿨을 때 해당 게이트가 반드시 실행되는지)
- [ ] QA-EXHAUST-85: **이스케이프 잔여 폴백 4곳을 수렴시킨다.** P1126에서 문자 집합이 동일한 재구현 2건은 위임으로 합쳤고 ui의 3-char 사본은 동작 변경으로 처리했지만, `typeof escHtml === 'function' ? escHtml(x) : <인라인 이스케이프>` 방어 폴백이 아직 남아 있다 — `aio-core.js:4139`, `aio-core.js:4189`, `aio-core.js:27162`, `aio-data.js:11630`, `index.html:14133`(`_escHtmlSafe`). core는 상한까지 1줄이라 폴백 제거로 순감을 만들어야 하고, index.html은 2단계 인라인 추출 후에 다루는 것이 안전하다. verify_by: ci-assertion-trace-check + ci-decomp-hotspot-check (인라인 이스케이프 정규식이 정본 외에 남지 않았는지, core 라인 순증 0 이하)
- [ ] QA-EXHAUST-83: **개인화 요청의 suitability 전제는 여전히 만족 불가다.** P1120은 차단을 공시로 우회했을 뿐, `question-planner.js:90`이 계속 `suitabilityProfile: null, evidenceComplete: false`를 넘기므로 개인화/실행 요청은 **항상** `suitability-profile-required`+`current-evidence-required` limitation을 달고 나간다. 실제 프로필을 공급하는 경로가 없어 "조건부 허용"(`allowed: true`) 상태에는 도달할 수 없다 — R617(1)의 잔여 사례다. verify_by: ci-ai-intelligence-contract-check (프로필 공급 경로가 생기면 limitation이 사라져야 한다)

## v55.05 차단 경계 → 공시 재배치 (2026-09-19)
- 완료 3건: QA-EXHAUST-71, QA-EXHAUST-72, QA-EXHAUST-73

## v55.04 semantic fix residuals 종결 (2026-09-19)
- 완료 4건: QA-EXHAUST-67, QA-EXHAUST-68, QA-EXHAUST-69, QA-EXHAUST-70

## v55.03 중첩 산출물 전수 감사와 구조 보강 (2026-09-18)
- 완료 7건: QA-EXHAUST-60, QA-EXHAUST-61, QA-EXHAUST-62, QA-EXHAUST-63, QA-EXHAUST-64, QA-EXHAUST-65, QA-EXHAUST-66

## v55.02 데이터 의미·정합성 전수 감사 (2026-09-18)
- 완료 13건: QA-EXHAUST-47, QA-EXHAUST-48, QA-EXHAUST-49, QA-EXHAUST-50, QA-EXHAUST-51, QA-EXHAUST-52, QA-EXHAUST-53, QA-EXHAUST-54, QA-EXHAUST-55, QA-EXHAUST-56, QA-EXHAUST-60, QA-EXHAUST-57, QA-EXHAUST-65, QA-EXHAUST-58, QA-EXHAUST-66, QA-EXHAUST-59

## v54.96 QA 계약·감사 경계 (2026-09-15)
- 완료 16건: QA-EXHAUST-31, QA-EXHAUST-32, QA-EXHAUST-33, QA-EXHAUST-34, QA-EXHAUST-35, QA-EXHAUST-36, QA-EXHAUST-37, QA-EXHAUST-38, QA-EXHAUST-39, QA-EXHAUST-40, QA-EXHAUST-41, QA-EXHAUST-42, QA-EXHAUST-43, QA-EXHAUST-44, QA-EXHAUST-45, QA-EXHAUST-46, QA-BOUNDARY-KNOWLEDGE-01

## v54.95 상태 저장소 불변성·구독 격리 (2026-09-12)
- 완료 7건: QA-EXHAUST-24, QA-EXHAUST-25, QA-EXHAUST-26, QA-EXHAUST-27, QA-EXHAUST-28, QA-EXHAUST-29, QA-EXHAUST-30

## v54.85 채팅 가독성과 근거 전달 (2026-09-10)
- 완료 2건: QA-AI-RESPONSE-REFLOW, QA-AI-QUOTE-PROVENANCE

## v54.84 AI 및 데이터 의미 검증 (2026-09-09)
- 완료 9건: QA-AI-IDENTITY, QA-AI-KNOWLEDGE-LINK, QA-AI-ANALYSIS-WIRING, QA-AI-STREAM-LIFETIME, QA-AI-UI-STATE, QA-DATA-RAW-ATOMIC, QA-MARKET-CALENDAR, QA-KNOWLEDGE-DEEP-AUTHORING, QA-AI-LIVE-QUALITY, QA-BOUNDARY-KNOWLEDGE-01, QA-BOUNDARY-AI-LIVE-01

## v54.76 working-tree audit continuation (2026-09-05)
- 완료 7건: QA-PORTFOLIO-VALUATION, QA-PERF-OBSERVATION, QA-PERF-HYDRATION, QA-EXHAUST-20, QA-EXHAUST-21, QA-EXHAUST-22, QA-EXHAUST-23

## v54.76 exhaustive audit checkpoint (2026-09-02)
- 완료 19건: QA-EXHAUST-01, QA-EXHAUST-02, QA-EXHAUST-03, QA-EXHAUST-04, QA-EXHAUST-07, QA-EXHAUST-08, QA-EXHAUST-09, QA-EXHAUST-10, QA-EXHAUST-11, QA-EXHAUST-12, QA-EXHAUST-13, QA-EXHAUST-14, QA-EXHAUST-15, QA-EXHAUST-16, QA-EXHAUST-17, QA-EXHAUST-18, QA-EXHAUST-19, QA-EXHAUST-05, QA-EXHAUST-06, QA-BOUNDARY-KNOWLEDGE-01, QA-BOUNDARY-DATA-RIGHTS-01

## v54.73 independent code/history audit (2026-08-31)
- 완료 6건: QA-AUDIT-20260831-01, QA-AUDIT-20260831-02, QA-AUDIT-20260831-03, QA-AUDIT-20260831-04, QA-AUDIT-20260831-05, QA-AUDIT-20260831-06, QA-BOUNDARY-DATA-RIGHTS-01

## v54.72 deep supplied-materials structural pass (2026-08-31)
- 완료 6건: QA-REF-20260831-01, QA-REF-20260831-02, QA-REF-20260831-03, QA-REF-20260831-04, QA-REF-20260831-05, QA-REF-20260831-06

## v54.71 supplied research integration (2026-08-30)
- 완료 6건: QA-REF-20260830-01, QA-REF-20260830-02, QA-REF-20260830-03, QA-REF-20260830-04, QA-A11Y-20260830-01, QA-REF-20260830-05, QA-BOUNDARY-DATA-RIGHTS-01

## v54.70 actual desktop journey (2026-08-30)
- 완료 5건: QA-USER-01, QA-USER-02, QA-USER-03, QA-USER-04, QA-USER-05, QA-BOUNDARY-HUMAN-01

## v54.69 continuity repairs (2026-08-30)
- 완료 5건: QA-CONT-01, QA-CONT-02, QA-CONT-03, QA-CONT-04, QA-CONT-05

## v54.68 source-to-screen structural repairs (2026-08-30)
- 완료 5건: QA-FLOW-01, QA-FLOW-02, QA-FLOW-03, QA-FLOW-04, QA-FLOW-05

## v54.65 reference provenance and official-calendar rollover (2026-08-29)
- 완료 3건: QA-DATA-24, QA-DATA-25, QA-RUNTIME-01

## v54.64 AI Web Research, knowledge retrieval and useful-answer boundary (2026-08-28)
- 완료 8건: QA-AUTO01, QA-AICHAT11, QA-AICHAT12, QA-AICHAT13, QA-AICHAT14, QA-AICHAT15, QA-AICHAT16, QA-AICHAT17, QA-BOUNDARY-AI-LIVE-01

## v54.63 source-to-screen data and research-model reconstruction (2026-08-28)
- 완료 23건: QA-DATA-01, QA-DATA-02, QA-DATA-03, QA-DATA-04, QA-DATA-05, QA-DATA-06, QA-DATA-07, QA-DATA-08, QA-DATA-09, QA-DATA-10, QA-DATA-11, QA-DATA-12, QA-DATA-13, QA-DATA-14, QA-DATA-15, QA-DATA-16, QA-DATA-17, QA-DATA-18, QA-DATA-19, QA-DATA-20, QA-DATA-21, QA-DATA-22, QA-DATA-23, QA-BOUNDARY-DATA-RIGHTS-01, QA-BOUNDARY-HUMAN-01

## v54.62 data truth and end-to-end user-flow remediation (2026-08-26)
- 완료 15건: QA-TRUTH-01, QA-TRUTH-02, QA-TRUTH-03, QA-TRUTH-04, QA-TRUTH-05, QA-TRUTH-06, QA-TRUTH-07, QA-TRUTH-08, QA-TRUTH-09, QA-TRUTH-10, QA-TRUTH-11, QA-TRUTH-12, QA-TRUTH-13, QA-TRUTH-14, QA-TRUTH-15, QA-BOUNDARY-HUMAN-01

## v54.61 prioritized structural reconstruction (2026-08-25)
- 완료 9건: QA-REBUILD-01, QA-REBUILD-02, QA-REBUILD-03, QA-REBUILD-04, QA-REBUILD-05, QA-REBUILD-06, QA-REBUILD-07, QA-REBUILD-08, QA-REBUILD-09, QA-BOUNDARY-HUMAN-01

## v54.60 bounded audit execution and complete reverse-engineering ledger (2026-08-25)
- 완료 8건: QA-AUDIT-01, QA-AUDIT-02, QA-AUDIT-03, QA-AUDIT-04, QA-AUDIT-05, QA-AUDIT-06, QA-AUDIT-07, QA-AUDIT-08, QA-BOUNDARY-HUMAN-01

## v54.59 product, architecture and closed-loop redesign (2026-08-24)
- 완료 16건: QA-ARCH-01, QA-ARCH-02, QA-ARCH-03, QA-ARCH-04, QA-ARCH-05, QA-ARCH-06, QA-ARCH-07, QA-ARCH-08, QA-ARCH-09, QA-ARCH-10, QA-ARCH-11, QA-ARCH-12, QA-ARCH-13, QA-ARCH-14, QA-ARCH-15, QA-ARCH-16

## v54.58 phased QA and delivery pipeline redesign (superseded where noted, 2026-08-24)
- 완료 13건: QA-PIPELINE-01, QA-PIPELINE-02, QA-PIPELINE-03, QA-PIPELINE-04, QA-PIPELINE-05, QA-PIPELINE-06, QA-PIPELINE-07, QA-PIPELINE-08, QA-PIPELINE-09, QA-PIPELINE-10, QA-PIPELINE-11, QA-PIPELINE-12, QA-PIPELINE-13, QA-ARCH-09, QA-ARCH-16

## v54.57 workspace, knowledge and automation-loop redesign (2026-08-23)
- 완료 13건: QA-WORKSPACE-01, QA-WORKSPACE-02, QA-WORKSPACE-03, QA-WORKSPACE-04, QA-WORKSPACE-05, QA-WORKSPACE-06, QA-WORKSPACE-07, QA-WORKSPACE-08, QA-WORKSPACE-09, QA-WORKSPACE-10, QA-WORKSPACE-11, QA-WORKSPACE-12, QA-WORKSPACE-13

## v54.56 market-learning curriculum integration (2026-08-23)
- 완료 7건: QA-PRINCIPLES-REF-01, QA-PRINCIPLES-REF-02, QA-PRINCIPLES-REF-03, QA-PRINCIPLES-REF-04, QA-PRINCIPLES-REF-05, QA-AI-REFERENCE-01, QA-CODEONLY-01

## v54.55 AI public-route and isolated boot verification (2026-08-23)
- 완료 6건: QA-AI-07, QA-BOOT-08, QA-REGRESSION-07, QA-TIER13-07, QA-DEPLOY-08, QA-HUMAN-04, QA-BOUNDARY-HUMAN-01

## v54.54 in-app interaction and cross-route trust audit (2026-08-23)
- 완료 7건: QA-TRUST-06, QA-INTERACTION-06, QA-ROUTE-DETAIL-06, QA-COPY-06, QA-TIER13-06, QA-AI-06, QA-COPY-07, QA-HUMAN-04, QA-BOUNDARY-AI-LIVE-01

## v54.50 ticker-state and visual surface audit (2026-08-23)
- 완료 13건: QA-A11Y-03, QA-A11Y-04, QA-TRUST-04, QA-TRUST-05, QA-DATA-05, QA-VISUAL-01, QA-VIEWPORT-04, QA-VERTICAL-04, QA-SCREENER-04, QA-HEADLESS-05, QA-TIER13-05, QA-DEPLOY-07, QA-HUMAN-03, QA-HUMAN-04, QA-DEPLOY-08

## v54.49 route ownership and release-boundary closure (2026-08-23)
- 완료 8건: QA-RUNTIME-03, QA-CONTRACT-03, QA-FIXTURE-03, QA-BROWSER-03, QA-HEADLESS-04, QA-TIER13-04, QA-DEPLOY-06, QA-HUMAN-02, QA-HUMAN-04, QA-DEPLOY-08

## v54.48 residual-closure currentness/cancellation/accessibility (2026-08-23)
- 완료 8건: QA-TRUST-03, QA-RUNTIME-02, QA-A11Y-02, QA-DATA-03, QA-DATA-04, QA-TIER13-03, QA-DEPLOY-05, QA-HUMAN-01, QA-HUMAN-04, QA-DEPLOY-08

## v54.47 second-pass currentness/cancellation closure (2026-08-23)
- 완료 4건: QA-TRUST-01, QA-TRUST-02, QA-RUNTIME-01, QA-A11Y-01

## v54.43 narrative-first three-page closure (2026-08-22)
- 완료 10건

## v54.42 three-page completeness and route-state closure (2026-08-22)
- 완료 11건: QA-BOUNDARY-KNOWLEDGE-01

## v54.41 external-source state correction (2026-08-22)
- 완료 8건

## v54.40 interaction-scoped detail and current-data closure (2026-08-22)
- 완료 11건: QA-BOUNDARY-KNOWLEDGE-01

## v54.39 three-page runtime budget and completeness boundary (2026-08-22)
- 완료 10건: QA-PAGES-PERF-01, QA-PAGES-PERF-02, QA-PAGES-PERF-03, QA-PAGES-CACHE-01, QA-MASTERS-RUNTIME-01, QA-KNOWLEDGE-RUNTIME-01, QA-TIER13-02, QA-MASTERS-ONLINE-01, QA-KNOWLEDGE-HUMAN-01, QA-DEPLOY-04, QA-BOUNDARY-KNOWLEDGE-01, QA-DEPLOY-08

## v54.38 three-page currentness and learner-flow closure (2026-08-22)
- 완료 11건: QA-MASTERS-13F-29, QA-MASTERS-13F-30, QA-MASTERS-13F-31, QA-KNOWLEDGE-UX-01, QA-KNOWLEDGE-UX-02, QA-PAGES-VIEWPORT-01, QA-PAGES-REGRESSION-01, QA-MASTERS-13F-32, QA-MASTERS-13F-33, QA-KNOWLEDGE-UX-03, QA-DEPLOY-03, QA-BOUNDARY-DATA-RIGHTS-01, QA-BOUNDARY-KNOWLEDGE-01, QA-DEPLOY-08

## v54.37 live AI browser preflight repair (2026-08-21)
- 완료 3건: QA-AI-CORS-01, QA-AI-CORS-02, QA-AI-LIVE-02

## v54.44 user research integration: inference efficiency and macro transmission (2026-08-22)
- 완료 6건: QA-REF-AI-01, QA-REF-AI-02, QA-REF-MACRO-01, QA-REF-CHAT-01, QA-REF-DATA-01, QA-REF-DATA-02, QA-BOUNDARY-DATA-RIGHTS-01

## v54.45 full-route audit and fail-closed rendering fixes (2026-08-22)
- 완료 6건: QA-AUDIT-01, QA-AUDIT-02, QA-AUDIT-03, QA-AUDIT-04, QA-AUDIT-05, QA-AUDIT-DATA-01, QA-BOUNDARY-HUMAN-01

## v54.46 evidence-first copy hardening (2026-08-22)
- 완료 2건: QA-COPY-01, QA-COPY-02

## v54.37 public AI end-to-end reliability (2026-08-18)
- 완료 12건: QA-AIROUTE5, QA-AISTREAM1, QA-AIDEGRADE3, QA-AIDEGRADE4, QA-AIOPS1, QA-AIBROWSER1, QA-DATA-REFRESH-12, QA-SCREENER-FRESHNESS-02, QA-FUND-PIT-01, QA-AILOCAL-01, QA-TIER13-01, QA-AIRELEASE1, QA-HUMAN-04, QA-BOUNDARY-AI-LIVE-01

## v54.36 semantic/reference completion pass (2026-08-18)
- 완료 10건: QA-KNOWLEDGE-DEPTH-03, QA-KNOWLEDGE-RESEARCH-02, QA-ATLAS-EVIDENCE-02, QA-MASTERS-13F-27, QA-PAGES-STRUCTURE-02, QA-KNOWLEDGE-SELF-05, QA-MASTERS-13F-28, QA-DEPLOY-02, QA-DATA-REFRESH-03, QA-SCREENER-FRESHNESS-01, QA-BOUNDARY-KNOWLEDGE-01, QA-BOUNDARY-DATA-RIGHTS-01, QA-DEPLOY-08

## v54.35 sequential quality closure (2026-08-18)
- 완료 10건: QA-MASTERS-13F-23, QA-MASTERS-13F-24, QA-MASTERS-13F-25, QA-KNOWLEDGE-DEPTH-02, QA-ATLAS-CURRENTNESS-01, QA-KNOWLEDGE-FRESHNESS-01, QA-DATA-REFRESH-11, QA-KNOWLEDGE-SELF-04, QA-MASTERS-13F-26, QA-DEPLOY-01, QA-BOUNDARY-DATA-RIGHTS-01, QA-DEPLOY-08

## v54.34 structural quality and content-depth closure (2026-08-16)
- 완료 5건: QA-KNOWLEDGE-DEPTH-01, QA-ATLAS-FOUNDATION-01, QA-MASTERS-13F-22, QA-PAGES-STRUCTURE-01, QA-KNOWLEDGE-SELF-04

## v54.33 self-guided learning and observation scope (2026-08-16)
- 완료 5건: QA-KNOWLEDGE-SELF-01, QA-KNOWLEDGE-SELF-02, QA-KNOWLEDGE-SELF-03, QA-MASTERS-13F-21, QA-KNOWLEDGE-SELF-04

## v54.32 method-only master boundary (2026-08-16)
- 완료 3건: QA-MASTERS-13F-18, QA-MASTERS-13F-19, QA-MASTERS-13F-20

## v54.31 beginner-core Masters curation (2026-08-16)
- 완료 6건: QA-MASTERS-13F-13, QA-MASTERS-13F-14, QA-MASTERS-13F-15, QA-MASTERS-13F-16, QA-MASTERS-13F-16b, QA-MASTERS-13F-17

## v54.30 major filer expansion (2026-08-16)
- 완료 3건: QA-MASTERS-13F-10, QA-MASTERS-13F-11, QA-MASTERS-13F-12

## v54.29 SEC 13F row preview boundary (2026-08-16)
- 완료 4건: QA-MASTERS-13F-06, QA-MASTERS-13F-07, QA-MASTERS-13F-08, QA-MASTERS-13F-09

## v54.28 13F manager coverage and discovery separation (2026-08-16)
- 완료 5건: QA-MASTERS-13F-01, QA-MASTERS-13F-02, QA-MASTERS-13F-03, QA-MASTERS-13F-04, QA-MASTERS-13F-05

## v54.24 Exhaustive user-visible data and automation freshness (2026-08-15)
- 완료 7건: QA-DATA-REFRESH-06, QA-DATA-REFRESH-07, QA-DATA-REFRESH-08, QA-DATA-REFRESH-09, QA-AUTOMATION-01, QA-AUTOMATION-02, QA-DATA-REFRESH-10

## v54.23 Full data refresh and official calendar freshness (2026-08-14)
- 완료 5건: QA-DATA-REFRESH-01, QA-DATA-REFRESH-02, QA-DATA-REFRESH-03, QA-DATA-REFRESH-04, QA-DATA-REFRESH-05, QA-BOUNDARY-DATA-RIGHTS-01

## v54.22 Professional data partial-capability closure (2026-08-13)
- 완료 22건: QA-DESKTOP-SCOPE-01, QA-PRO-DATA-01, QA-PRO-DATA-02, QA-PRO-DATA-03, QA-PRO-DATA-04, QA-PRO-DATA-05, QA-PRO-DATA-06, QA-PRO-DATA-07, QA-PRO-DATA-08, QA-PRO-DATA-09, QA-PRO-DATA-10, QA-PRO-DATA-11, QA-PRO-DATA-12, QA-PRO-DATA-13, QA-PRO-DATA-14, QA-PRO-DATA-15, QA-PRO-DATA-16, QA-PRO-DATA-17, QA-PRO-DATA-18, QA-PRO-DATA-19, QA-PRO-DATA-20, QA-PRO-DATA-21

## v54.21 Daily source registry, history, and missing professional data closure (2026-08-13)
- 완료 7건: QA-SOURCE-DAILY-01, QA-SOURCE-DAILY-02, QA-SOURCE-DAILY-03, QA-SOURCE-DAILY-04, QA-SOURCE-DAILY-05, QA-SOURCE-DAILY-06, QA-SOURCE-DAILY-07

## v54.20 Quant screener source epochs and automatic refresh closure (2026-08-13)
- 완료 8건: QA-QUANT-AUTO-01, QA-QUANT-AUTO-02, QA-QUANT-AUTO-03, QA-QUANT-AUTO-04, QA-QUANT-AUTO-05, QA-QUANT-AUTO-06, QA-QUANT-AUTO-06B, QA-QUANT-AUTO-07

## v54.19 Field-level page timeline and automation consistency (2026-08-13)
- 완료 7건: QA-DATA-TIMELINE-01, QA-DATA-TIMELINE-02, QA-DATA-TIMELINE-03, QA-DATA-TIMELINE-04, QA-DATA-TIMELINE-05, QA-DATA-TIMELINE-06, QA-DATA-TIMELINE-07, QA-BOUNDARY-DATA-RIGHTS-01

## v54.18 Evidence-derived data reconciliation and shared market epoch (2026-08-13)
- 완료 6건: QA-DATA-EPOCH-01, QA-DATA-EPOCH-02, QA-DATA-EPOCH-03, QA-DATA-EPOCH-04, QA-DATA-EPOCH-05, QA-DATA-EPOCH-06

## v54.17 Desktop-only scope and canonical version gates (2026-08-13)
- 완료 3건: QA-SCOPE-01, QA-VERSION-01, QA-SCOPE-02

## v54.16 SCR-OS local contract closure and promotion safety (2026-08-13)
- 완료 5건: QA-SCR-OS14, QA-SCR-OS15, QA-SCR-OS16, QA-SCR-OS17, QA-SCR-OS18, QA-BOUNDARY-DATA-RIGHTS-01

## v54.15 SCR-UX-00~05 native screener UI/UX and visual workflow (2026-08-13)
- 완료 7건: QA-SCR-UX1, QA-SCR-UX2, QA-SCR-UX3, QA-SCR-UX4, QA-SCR-UX5, QA-SCR-UX6, QA-DATA-01

## v54.13 SCR-OS-00~13 Screener Workbench and lineage regression closure (2026-08-12)
- 완료 13건: QA-SCR1, QA-SCR2, QA-SCR3, QA-SCR4, QA-SCR5, QA-SCR6, QA-SCR7, QA-SCR8, QA-SCR9, QA-SCR10, QA-SCR11, QA-SCR12, QA-SCR13

## v54.11 Daily briefing reference-bridge integration (2026-08-12)
- 완료 6건: QA-BRIEFING1, QA-BRIEFING2, QA-BRIEFING3, QA-BRIEFING4, QA-BRIEFING5, QA-BRIEFING6

## v54.7 KA-11~16 execution gates (2026-08-12)
- 완료 6건: QA-KA11, QA-KA12, QA-KA13, QA-KA14, QA-KA15, QA-KA16

## v54.6 Knowledge Atlas structural implementation (2026-08-11)
- 완료 10건: QA-KA1, QA-KA2, QA-KA3, QA-KA4, QA-KA5, QA-KA6, QA-KA7, QA-KA8, QA-KA9, QA-KA10, QA-BOUNDARY-KNOWLEDGE-01

## v54.25 관계 지도·중립금리·SNDK 통합 (2026-08-15)
- 완료 8건: QA-REL1, QA-REL2, QA-REL3, QA-REL4, QA-REL5, QA-REL6, QA-REL7, QA-REL8

## v54.27 실제 관측값 연결 (2026-08-15)
- 완료 3건: QA-REL9, QA-REL10, QA-REL11

## v54.5 AI 선택 라우트·배포 게이트 일치 (2026-08-11)
- 완료 4건: QA-AIROUTE1, QA-AIROUTE2, QA-AIROUTE3, QA-AIROUTE4, QA-AIROUTE5

## v54.4 AI 안전 분류·US authority 구조 교정 (2026-08-11)
- 완료 10건: QA-AICONDUCT1, QA-AICONDUCT2, QA-AICONDUCT3, QA-AIDEGRADE1, QA-AIDEGRADE2, QA-AIDEGRADE3, QA-TGPARTIAL1, QA-AIAUTH1, QA-AIAUTH2, QA-AIAUTH3

## v54.3 AI 공유 Worker 배포 폐쇄 (2026-08-10)
- 완료 6건: QA-AIPROXY1, QA-AIPROXY2, QA-AIPROXY3, QA-AIPROXY4, QA-AIPROXY5, QA-AIPROXY6, QA-AIAUTH1, QA-AIAUTH, QA-AIAUTH3

## v54.2 AI 채팅 구조 일원화·오분류 종료 (2026-08-10)
- 완료 10건: QA-AICHAT1, QA-AICHAT2, QA-AICHAT3, QA-AICHAT4, QA-AICHAT5, QA-AICHAT6, QA-AICHAT7, QA-AICHAT8, QA-AICHAT9, QA-AICHAT10

## v54.1 배포 데이터 계약 보강 (2026-08-10)
- 완료 3건: QA-DATA1, QA-DATA2, QA-DATA3

## v54.0 AI Research reliability closure (2026-08-10)
- 완료 9건: QA-AIRC1, QA-AIRC2, QA-AIRC3, QA-AIRC4, QA-AIRC5, QA-AIRC6, QA-AIRC7, QA-AIRC8, QA-REL1

## v53.99 지식 코어 S0 기준 구현 (2026-08-10)
- 완료 10건: QA-KC1, QA-KC2, QA-KC3, QA-KC4, QA-KC5, QA-KC6, QA-KC7, QA-KC8, QA-KC9, QA-KC10, QA-BOUNDARY-KNOWLEDGE-01

## v53.98 지식 백과 심층도·명칭 감사 (2026-08-10)
- 완료 7건: QA-KB1, QA-KB2, QA-KB3, QA-KB4, QA-KB5, QA-KB6, QA-KB7, QA-BOUNDARY-KNOWLEDGE-01

## v53.96 current-code remediation closure (2026-08-10)
- 완료 10건: QA-CR1, QA-CR2, QA-CR3, QA-CR4, QA-CR5, QA-CR6, QA-CR7, QA-CR8, QA-CR9

## v53.95 full-route audit closure (2026-08-09)
- 완료 8건: QA-AUDIT1, QA-AUDIT2, QA-AUDIT3, QA-AUDIT4, QA-AUDIT5, QA-AUDIT6, QA-AUDIT7, QA-AUDIT8

## v53.93 구조 보완 closure (2026-08-09)
- 완료 6건: QA-STRUCT1, QA-STRUCT2, QA-STRUCT3, QA-STRUCT4, QA-STRUCT5, QA-STRUCT6

## v53.92 Telegram 4채널 integration closure (2026-08-09)
- 완료 6건: QA-TG1, QA-TG2, QA-TG3, QA-TG4, QA-TG5, QA-TG6

## v53.91 integration closure (2026-08-09)
- 완료 9건: QA-INT6, QA-INT7, QA-INT8, QA-INT9, QA-INT1, QA-INT2, QA-INT3, QA-INT4, QA-INT5

## Coverage expansion checkpoint: six source documents (v53.89)
- 완료 17건: QA-MP4, QA-AT3, QA-AT4, QA-AT5, QA-AI1, QA-AI2, QA-AT6, QA-MP5, QA-DOC1, QA-DOC2, QA-MF4, QA-DATA1, QA-MF5, QA-MP6, QA-AT7, QA-AT8, QA-MF6

## Midpoint QA handoff closure: Market Principles / Masters / Atlas (v53.78)
- 완료 10건: QA-MF1, QA-MF2, QA-MF3, QA-MP1, QA-MP2, QA-MP3, QA-AT1, QA-AT2, QA-MF4, QA-HUMAN-04

## P872-P874 Data session, publish tuple, and operations truth gates (v53.68)
- 완료 5건

## P871 Explicit decision-header mounting and first-view contract (v53.67)
- 완료 4건

## P870 Current Telegram lane and cycle-manifest coherence (v53.66)
- 완료 6건

## P867-P869 FRED·공통컷·시계열 정합성 (v53.65)
- 완료 10건

## P864 Release manifest synchronization (v53.64)
- 완료 4건

## P865 Official FOMC calendar rollover (v53.64)
- 완료 3건

## P866 Post-refresh release/data revision coherence (v53.64)
- 완료 3건

## P833-P835 Native runtime data boundary and chart lifecycle (v53.63)
- 완료 9건: QA-ARCH-14

## P852 Web Research, session, provenance, concurrency, and accessibility closure (v53.58)
- 완료 8건: QA-ARCH-14

## P853~P857 quote atomicity, presentation, route readiness, release parity, and SLO gate (v53.60)
- 완료 7건

## P858 boot critical path and measured SLO closure (v53.62)
- 완료 5건

## P859-P862 Native secondary evidence boundaries (v53.64)
- 완료 8건: QA-ARCH-14

## P850 Web Research, source evidence, and market-session closure (2026-07-28, v53.56)
- 완료 8건

## P849 AIQ-4 domain engines and AIQ-5/6 operator contracts (2026-07-28, v53.55)
- 완료 6건: QA-AI-LIVE-QUALITY

## P848 AIQ-0~3 intelligence rebuild (2026-07-28, v53.55)
- 완료 8건: QA-AI-LIVE-QUALITY

## P847 API/source/pipeline evidence hardening (2026-07-27, v53.54)
- 완료 6건

## P846 deployed API-key save and Claude route regression (2026-07-27, v53.54)
- 완료 5건: QA-AI-LIVE-QUALITY

## P845 early compatibility-facade navigation (2026-07-27, v53.53)
- 완료 4건

## P844 API/AI chat reliability remediation (2026-07-27, v53.52)
- 완료 10건: QA-AI-LIVE-QUALITY

## P843 Wave 5 route soak, operations, and public-readiness boundary (2026-07-27, v53.51)
- 완료 8건

## P842 Wave 4 capability/content boundary (2026-07-27, v53.51)
- 완료 4건

## P841 Wave 3 vertical slice boundary (2026-07-27, v53.50)
- 완료 6건

## P840 W1-04/W1-05/W2-05 freshness, narrative, and KDF remediation (2026-07-27, v53.49)
- 완료 6건

## P839 W2 Scope/chart/key-resource remediation (2026-07-27, v53.48)
- 완료 7건

## P838 W1 Decision-evidence boundary (2026-07-27, v53.47)
- 완료 6건

## P837 Fast-plane deploy smoke bootstrap (2026-07-27, v53.46)
- 완료 4건

## P836 Full data refresh (2026-07-27, v53.45)
- 완료 4건

## P835 Reference analysis protocol completion (2026-07-27, v53.44)
- 완료 3건

## P834 AI infrastructure cycle reference integration (2026-07-27, v53.43)
- 완료 4건

## P833 KV-only fast quote plane (2026-07-27, v53.42)
- 완료 4건

## P827~P830 current secondary-surface closure (2026-07-27, v53.39)
- 완료 7건

## P831 portfolio deterministic summary surface (2026-07-27, v53.40)
- 완료 4건

## P832 fundamental SEC core report surface (2026-07-27, v53.41)
- 완료 4건

## P781~P783 중간점검 회귀 체크
- 완료 6건

## P784 SA bounded packet 회귀 체크
- 완료 6건

## P785 ARX-11 bounded technical health 회귀 체크
- 완료 5건

## P786 ARX-11 bounded signal hero 회귀 체크
- 완료 5건

## P787 ARX-11 bounded home aggregate 회귀 체크
- 완료 5건

## P788 derived theme-detail summary 회귀 체크
- 완료 4건

## P789 theme-detail composition/breadth regression check
- 완료 4건

## P790 theme-detail detailed leaders regression check
- 완료 4건

## P791 theme-detail temperature narrative regression check
- 완료 4건

## P792 theme-detail performance-spread narrative regression check
- 완료 4건

## P793 theme-detail breadth-health narrative regression check
- 완료 4건

## P794 theme-detail subtheme-gap narrative regression check
- 완료 4건

## P795 theme-detail benchmark narrative regression check
- 완료 4건

## 2026-07-19 v53.13 최종 릴리스 증거 (P734)
- 완료 5건

## 2026-07-19 v53.14 data-reliability execution evidence (P735)
- 완료 5건

## 2026-07-19 v53.15 architecture ownership cutover evidence (P736/R352)
- 완료 11건

## 2026-07-19 ARX-09~16 local cutover
- 완료 12건

## 2026-07-22 RM-03 P755~P759 domain extraction evidence
- 완료 5건

## 2026-07-22 ARX-10/P760 native screener cutover evidence
- 완료 4건

## 2026-07-22 P761-P764 continuation evidence
- 완료 6건

## 2026-07-22 P768 native screener single-fetch compatibility bridge evidence
- 완료 4건

## 2026-07-22 P769 market-news primary feed renderer evidence
- 완료 4건

## 2026-07-22 P770 briefing primary feed renderer evidence
- 완료 4건

## 2026-07-22 P771 macro primary metric renderer evidence
- 완료 4건

## 2026-07-22 P772 fxbond primary metric renderer evidence
- 완료 4건

## 2026-07-22 P773 breadth primary current-metric renderer evidence
- 완료 5건

## 2026-07-22 P777 bounded ticker hero native surface evidence
- 완료 5건

## 2026-07-22 P780 bounded portfolio readiness/status native surface evidence
- 완료 5건: QA-ARCH-14

## 2026-07-22 P779 bounded fundamental SEC status native surface evidence
- 완료 5건: QA-ARCH-14

## 2026-07-22 P778 bounded options replacement-metric native surface evidence
- 완료 5건

## 2026-07-22 P776 theme-detail derived-route retirement evidence
- 완료 4건

## 2026-07-22 P775 themes bounded native surface evidence
- 완료 4건

## 2026-07-22 P774 declaration-only legacy cleanup evidence
- 완료 4건

## 2026-07-22 P767 native screener data-pipeline contract evidence
- 완료 3건

## 2026-07-22 P766 canonical screener helper migration evidence
- 완료 4건: QA-ARCH-14

## 2026-07-22 P765 native screener DOM ownership regression evidence
- 완료 4건

## §1. 열린 항목 (Open Backlog)
- 완료 15건: QA-AI-LIVE-QUALITY, QA-BOUNDARY-AI-LIVE-01, QA-BOUNDARY-HUMAN-01

## P875 structural freshness/lifecycle checks (2026-08-01)
- 완료 6건

## P1030 supplied research packet / time-series / architecture (2026-09-05)
- 완료 9건

## P1083~P1089 automation continuity (2026-09-17)
- 완료 4건

## 의미·정합성 검토 미해결 항목 (2026-09-17)
- 완료 7건

## semantic fix residuals (v55.01, 2026-09-17)
- 완료 11건: QA-EXHAUST-67

## E3·E4 portfolio 통화·수익률·성과 잔여 (v56.22, 2026-09-24)
- 완료 23건: QA-FX-CONSUMERS
- [ ] 전략 경로 **UX 잔여** — 회고 경로에서 정책 셀렉터는 여전히 노출되고(미사용·미선언을 표시한다), `unrecognized` 플래그는 발행만 하고 별도 문구를 쓰지 않으며(셀렉터가 미선언으로 되돌아가는 것으로 드러난다), 목표비중 합이 정확히 100%여야 해 현금을 목표비중에 포함한 계좌 범위 선언은 불가하다. verify_by: design-intake (전략 경로 폼 UX 결정 후)

## data-refresh 상태 (v56.32, 2026-09-24)
- 완료 4건

## §4. 부록: 반복 실패 방지 특별 체크 (2회+ 반복 패턴)

| 패턴 | 확인법 |
|------|--------|
| 함수 존재하지만 호출 안 됨 | grep 호출 지점 + 브라우저 breakpoint. 읽기 코드 존재≠필드 존재 — 쓰기 지점 grep 실증(P724) |
| 이중 표면/그림자 구현 | 동일 지표 소비 표면 grep 전수(`abv50`, `hyg`, `DATA_SNAPSHOT.vkospi` 등) — 함수 단위 수정 금지(P713) |
| 동일 산출물 이중 write | 출력 경로 write 사이트 전수 grep + write 헬퍼·read-back 단언(P719) |
| init 가드 미리셋 / 이중 cleanup | destroy flag=false · init 내 destroy 루프 1회만(P56) |
| API 필드 가정 | Network 탭 실제 응답 확인 |
| popstate/showPage 한 경로만 수정 | 두 경로 모두 테스트 |
| 채팅 가로 렌더링 | `.acp-msg.ai` 내 `.acp-bubble` 존재 + 자식 수 DOM 검사 |
| `.pct \|\| 0` 재도입 (P25/R15) | `grep -n '\.pct ||' ` → 신규 0건, `!= null ?` 사용 |
| div 균형 오판 | `grep -o '<div' \| wc -l` (grep -c는 줄당 1 카운트) |
| data-live-price 벌크 자식 파괴 (P24) | `el.children.length > 0` 체크 유지 |
| 시점 관측값 리터럴 단언 (R279) | 날짜/시장값/데이터 상태를 영구 등호로 고정 금지 — 구조 속성으로 재작성(P627/P715/P720/P722) |
| 테스트가 artifact 내용 의존 | push 전 "현재 origin artifact"와 "차기 producer 산출물" 양쪽 실행(P722) |
| 스윕/일괄 치환 부작용 (R309) | 빈 버튼·양쪽-빈 삼항·문자열 마커 전수 검색(P678/P680) |
| "이미 됐다" 자기평가 | 과거 확인 기록을 재검증 없이 신뢰 금지(P631/P687/P688) |
| var/const hoist 충돌 | 모듈 전체 parse 실패 유발(P311/P525) — `node --check` 필수 |
| 고정 열 그리드 모바일 overflow (P57) | `repeat(N,1fr)` N≥6 → auto-fit/minmax |
| Dead Page | page-* div마다 init·pageShown·liveQuotes 3종 확인 |

---
