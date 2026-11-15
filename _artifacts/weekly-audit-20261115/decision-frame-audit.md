# 판단 틀(가능성·손익비·기회비용·틀렸을 때·우위 구간) 감사 — 2026-11-15

범위: 작업 트리(커밋되지 않은 v60.18+ 배치)의 코드와 `public-data/` 산출물, 그리고 오늘 실행한 두 백테스트 결과(scratchpad `lean/market-lean-backtest.json`, `lean-risk/risk-result.json`)를 읽기만 했다. 편집·git·프로듀서·AI 호출은 하지 않았다.
표기: **[실측]** = 코드나 산출물에서 직접 읽음, **[추정]** = 읽은 값으로 계산·해석함. 화면에 실제로 그려지는지는 브라우저로 확인하지 않았으므로 "렌더 결과"는 모두 코드 경로에서 추론한 것이다.

---

## 0. 먼저 볼 것 — 지금 작업 트리에서는 과거 빈도가 거의 다 꺼진다

- 새로 생긴(추적 안 됨) `src/domain/scenarios/outcome-stamps.js`·`outcome-fingerprints.js`는 정의 스탬프가 맞을 때만 장기 기록을 읽게 한다. `currentScenarioOutcomes`(outcome-fingerprints.js:33-40)는 `fingerprints`가 맞지 않으면 `branches`·`corrections`를 null로 만들고, theme 행 중 `fingerprint`가 맞는 것만 남긴다. `currentStressOutcomes`(:42)는 `fingerprint`가 없으면 null을 돌려준다. **[실측]**
- 그런데 지금 `public-data/scenario-outcomes.json`(최상위 키: schemaVersion…branches, themes, corrections, from, to)에는 `fingerprints`가 없고, theme 행에도 `fingerprint`가 없다. `public-data/stress-outcomes.json`에도 `fingerprint`가 없다. HEAD 버전도 마찬가지다. **[실측]**
- 그래서 프로듀서가 다시 돌기 전까지 브라우저에서는 이렇게 된다 **[추정, 코드 경로 기준]**:
  - 시장 상태의 VIX 구간 카드가 숨는다(stress-outcomes.js:62, `section.hidden = true`).
  - 나스닥 조정 기저율이 그려지지 않는다(correction-base-rate.js:11, rates null → return null).
  - 시나리오 갈래의 과거 빈도가 장기 기록 대신 `history.json` 420거래일(2025-09-22~2026-11-15)로 대체된다(macro-crossroads.js:403-409). 겹치지 않는 20거래일 사례가 한 자릿수라 "N번뿐이라 빈도로 말하지 않습니다"나 개수만 남는다.
  - 테마 단계의 과거 줄은 "다른 기준으로 분류돼 있어 비교하지 않습니다"로 바뀐다(theme-playbook.js:237).
  - 시장 기울기의 VIX 항목이 빠진다(market-lean.js:161,165).
- 두 프로듀서 모두 스탬프가 다르면 주간 건너뛰기를 하지 않으므로(build-scenario-outcomes.mjs:79-80, build-stress-outcomes.mjs:44-45) push 뒤 첫 refresh-data 실행에서 회복된다 **[실측]**. 위험은 순서다. 통합 패스가 이 배치를 push한 뒤 refresh-data가 돌기 전까지 라이브에서는 차별점의 근거(과거 빈도)가 거의 모두 사라진다. 로컬 브라우저 QA에서도 같은 모습이 나온다. **[추정]**
- `model-validation-status.json`에는 `marketLean` 블록이 없다(최상위 키 목록에서 확인). `leanValidation`이 'NOT_RUN'을 돌려주므로 화면에는 "이 개수로 한 달 방향을 정하는 규칙은 아직 과거 검증 결과가 없어 방향을 붙이지 않습니다"(market-lean.js:55)가 나온다. 오늘 실제로는 검증을 돌렸고 **실패**했다(scratch `lean-risk/risk-result.json` verdict.pass=false, held-out CI [−1.31, 23.9]). 문구가 "검증 전"이라 사실보다 약하게 말한다. **[실측]** 판정이 게시되면 :58의 "기준을 통과하지 못해" 문구로 바뀐다.

아래 감사는 산출물이 스탬프를 다시 받았다고 보고(정상 상태) 읽었다. 지금 꺼져 있는 곳에는 "(현재 꺼짐)"을 붙였다.

---

## 1. 화면·AI별 다섯 요소 커버리지

범례: **G** = 있고 근거 있음(표본·기저율이 붙은 과거 빈도 또는 실제 계산) · **U** = 있으나 근거 없음(규칙이나 문구로 주장할 뿐 검증 없음) · **–** = 없음. 화면과 라우트의 대응은 src/ui/navigation/route-hubs.js:5-17 **[실측]**.

| 화면 | 가능성 | 손익비 | 기회비용 | 틀렸을 때 | 우위 구간 |
|---|---|---|---|---|---|
| 오늘 (home·briefing·news) | **U** 6개 지표 판정 "혼조"(today-verdict.json: 양호1·중립3·부담2)와 heroLine "지수를 받치던 주도주가 함께 약해지고 있습니다". 상태일 뿐 빈도 없음 | – | – (가이드는 v59.51에 시장 상태로 이동, market-regime.js:658-668) | – | – (기울기는 시장 상태로 이동, session-lean.js:151-152) |
| 시장 상태 (signal·breadth·sentiment) | **G** 갈래별 과거 빈도(사례 수·기저율, analogs.js:196-216), VIX 구간 오른 비율과 nEff(stress-outcomes.js:85), 나스닥 조정 8/40(correction-base-rates.js:60), 가격 온도 구간 결과(market-temperature.js:187-189). (현재 꺼짐: 처음 셋) | **U→부분 G** VIX 구간 평균 ± 범위와 "나쁜 쪽 10%"(stress-outcomes.js:98), 온도 "하위 10% 결과". 이익 크기 대 손실 크기 비율은 없음 | **U** 갈래별 "대응별 득실" 문장과 SOFR 수준(macro-crossroads.js:462, :298-306). 같은 사례에서 현금이 실제로 번 값은 없음 | **U** "틀렸다는 신호"(narrative-cards.js:69 → market-narratives.js:43), 가이드 "이 판단이 빗나갈 때의 기회비용"(market-guide.js:94-101). 틀렸을 때 과거에 얼마를 잃었는지는 없음 | **U** 기울기는 개수만 표시(market-lean.js:185-186). 가이드 "비용이 작은 쪽: 보유 유지"(scenario-state.json guide.robust='hold')는 규칙표 집계이며 확률이 아님(market-guide.js:181) |
| 매크로 (macro·fxbond) | – 자산 상태와 상관(macro-board.js:1197 표본 표기)만. 갈래 지도는 시장 상태로 이동(market-regime.js:662-667) | – | – | – | – |
| 기술적 분석 (charts, 지수 차트) | **U** "RSI 30 이하 … 단기 반등이 자주 나오는 자리", "과열권이라 숨 고르기가 나오기 쉽습니다"(market-charts.js:118-119). 빈도·표본 없음 | **부분 G** 지지·저항 후보까지 거리 %(market-charts.js:120-121). ATR 단위 아님, 비율 없음 | – | – | – |
| 테마·섹터 (themes·theme-detail) | **G** 대표 ETF 같은 단계 과거 기록(지수 초과 기준, frequencyText; theme-playbook.js:238) (현재 꺼짐) | **부분 G** 중앙값과 "가운데 절반"(사례 10개 이상일 때, analogs.js:215) | **U** 단계×선택지 문장(theme-playbook.js:78-86) — 대부분 문장이며, 숫자로 된 기회비용은 지수 초과 기준(지수 보유 대비)일 때만 있음 | **U/G** 구조 가설과 "논리가 깨지는 신호"(theme-playbook-view.js:364). 조정 깊이 조건(depthOk, theme-playbook.js:104-109)은 측정값 | **U** 단계별 "비용이 작은 쪽"(FAVOURED 표, theme-playbook.js:48-57). 과거 기록이 평소와 구별되지 않으면 "뚜렷한 우위가 아니라 시나리오가 맞을 때의 비교"를 붙임(theme-playbook-view.js:382) |
| 스크리너 | **G(부정)** "순위와 이후 수익률의 관계가 확인되지 않았습니다"(validation-tab.js:161) | **부분** 50일선 거리 ÷ ADR "과확장" 배수(setup-profile.js:64-66). 하방 대 상방 비교 없음 | – | – | – |
| 종목 (ticker·technical 차트·fundamental) | **G** 이 종목의 과거 돌파: 사례 수, 오른 비율, 같은 기간 기준선, 중앙값, "피벗 아래 종가가 나온 비율"(setup-coach.js:125-170). 10건 미만이면 개수만 | **G(사용자 입력)** 내 계획 점검: 위험 폭(ADR 배수), 위험 1 대비 보상, 본전 승률, 손절 시 손실액과 자본 비중(stock-chart-coach.js:272-288; chart-strategies.js:134-137). 앱 스스로 계산한 레벨 기준 손익비는 없음 | – (지수 대비 강도만) | **U/G** 방식별 "계획 무효"(chart-strategies.js:95-125, 문헌 규칙), 논지 "틀렸다는 신호"(stock-lens-cards.js:318), 역DCF "깨지는 신호"(fiscal-read.js:600). 돌파 실패율(backBelowShare)은 측정값 | **U** "조건이 모두 맞는 방식은 …", "기다리는 것도 계획입니다"(stock-chart-strategies.js:25-27). 방식별 과거 성과 없음 |
| 포트폴리오 | **G** VaR·CVaR·MDD를 표본 수와 함께(portfolio-risk-metrics.js:88-110) | **G(사용자 입력)** 계획 점검(portfolio-plan-check.js:12-20) | **G** 지수 대비 3개월 차이를 섹터·종목·환율·현금으로 분해, "현금 효과"(portfolio-read.js:42-43). 백테스트 랩 벤치마크 CAGR(portfolio-backtest-lab.js:69-77) | – 국면(VIX 구간 등)별 예상 손실 없음 | – |
| 리서치 라이브러리 | **U(일반론)** 기저율·기대값·파산 위험 개념(concept-core.js 기대값 정의, concept-stories.json), J3 포지션 사이징, J4 손실과 생존 | **U** 기대값 예시(lesson-library.json:3237-3240) | **U** "기다림도 선택이다" — 현금 이자 수준 대입(lessons.js:46-55) | **U** "'틀렸다'의 기준을 먼저 정하기" — 중심 갈래의 invalidation 첫 줄 대입(lessons.js:88-93) | **U** "나눠서 들어가기" — 갈래 규칙표에서 stage가 favored인 곳을 셈(lessons.js:73-86) |
| AI (채팅·시장 읽기 프로듀서) | **G/U** 갈래 블록에 과거 빈도·표본·기저율(macro-crossroads.js:630), 기울기 블록은 개수만(market-lean.js:205), scenario_record 도구(market-tools.js:59-74). 시장 읽기 프롬프트는 "축 상태"도 가능성 근거로 허용(market-analysis-prompt.mjs:49) | – 주가 레벨 질문일 때만 ATR·레벨 지도가 들어감(choosing-blocks.js:106). 시나리오 이익 대 손실 크기는 지시에도 입력에도 없음 | **U** 선택지별 기회비용(answer-modes.js:32, 문장 입력) | **U** "이 읽기가 빗나가는 조건"(macro-crossroads.js:630), 무효화 신호 요구(request-pipeline.js:503) | **U** decision 모드가 "분할 매수하기 좋은 구간" 같은 판단을 요구(answer-modes.js:32). 근거로 "조건 충족 수"를 인정 |

한 줄 요약 **[추정]**: 근거 있는 **가능성**과 사용자 입력 기반 **손익비**는 강하다. 시장·테마 수준의 **손익비**, 숫자로 된 **기회비용**, **틀렸을 때의 과거 비용**은 화면 어디에도 숫자로 없다. **우위 구간**은 검증되지 않은 규칙표(FAVOURED, branch.favored)에서만 나온다.

---

## 2. 화면 사이의 모순과 표본 없이 쓰인 방향어

1. **같은 VIX 40+ 행이 두 화면에서 다르게 판정된다 [실측]**. stress-outcomes.json panic band 21d nEff 9.9. 시장 상태 카드는 `evidenceStrength(nEff, {approx:true})`로 10으로 반올림해(stress-outcomes.js:17; evidence-strength.js:12) 평균과 오른 비율을 "참고"로 보여 준다. 시장 기울기는 `Math.floor`로 9로 내려(market-lean.js:73-74) "과거 사례 9개뿐이라 비율을 내지 않습니다"를 쓴다. evidence-strength.js:5의 주석("rounded once, and that number is both judged and shown")과 market-lean.js:73의 주석("Floored")이 서로 다르다. 문서와 코드가 어긋나는 사례다.
2. **AI는 우위 구간을 말하라는 지시와 개수를 방향으로 바꾸지 말라는 지시를 함께 받는다 [실측]**. decision 모드(answer-modes.js:32)는 "분할 매수하기 좋은 구간 / 매수가 부담스러운 구간"을 판단하고 근거로 "조건 충족 수"를 대라고 한다. 같은 답변에 들어갈 수 있는 기울기 블록(market-lean.js:205)은 "개수를 오를 쪽·내릴 쪽이나 사는 쪽·피하는 쪽 판단으로 바꿔 말하지 않는다"고 한다. 시장 읽기 프로듀서도 "축 상태"를 말로 된 가능성의 근거로 허용한다(market-analysis-prompt.mjs:49). 오늘 백테스트는 6개 축 개수가 21거래일 방향을 예측하지 못한다고 보였다(매수 쪽 65.4% 대 기준 65.0%). 그러니 AI가 개수로 우위 구간을 말하면 근거보다 강하게 말하는 셈이다. **[추정]**
3. **시장 상태 안에서 기울기와 가이드가 엇갈린다 [실측+추정]**. 같은 화면에서 기울기는 방향어 없이 개수만 보인다. 가이드는 "핵심 조건을 갖춘 시나리오들에 유리하다고 가장 많이 적힌 선택은 '보유 유지'"를 헤드라인으로 쓰고(scenario-state.json guide.headline), avoid에 "'관망' — '성장 재가속' 시나리오로 가면 손해가 큰 선택입니다"를 둔다. 근거인 중심 갈래 reflation의 과거 기록은 73건 중 41건 상승(56%, 기준 64%), 중앙값 +1.0%, p25 −1.2, p75 +2.7이다(scenario-outcomes.json branches.reflation). 기준보다 낮지만 표본 오차 안이라 pastConflict는 걸리지 않는다(macro-crossroads.js:426-435: 2SE 여유 약 11%p **[추정 계산]**). "손해가 큰"은 빈도나 크기 없이 쓰인 방향어다.
4. **표본 없이 쓰인 방향어 [실측]**:
   - market-charts.js:118 "RSI … 과매도권이라, 단기 반등이 자주 나오는 자리", :119 "과열권이라 숨 고르기가 나오기 쉽습니다" — 빈도·표본 없음.
   - macro-crossroads.js의 갈래별 favoredWhy: "…경향이 있습니다", "되돌림 폭이 컸던 구간"(:368) — 과거 표현을 쓰지만 연결된 측정이 없음. 화면에서는 "비용이 작은 쪽"(choice-words.js)으로만 표시되고, 비용 가설이라는 꼬리표("비용 가설 — 과거 성과로 검증한 우위 아님")는 AI 문맥에만 있다(:630). 화면 카드(macro-crossroads.js:266, :306)에는 없음.
   - chart-strategies.js:123 "실패가 잦은 방식이라" — 이 종목이나 전체 표본의 실패율이 붙지 않음.
   - lessons.js:70 no-chasing live 문구 "양호가 N개입니다 — 좋은 소식이 가격에 많이 들어간 때일 수 있습니다" — 개수를 방향 쪽으로 읽음(말투는 약함).
5. **같은 기록이 두 갈래 결론을 반대로 받친다 [실측+추정]**. volshock("VIX 30 이상", 69건)은 49건 상승(71%), 중앙값 +2.6, p25 −0.9이고 favored는 ['stage','wait']다. 오늘 위험 백테스트에서는 VIX 30+일 때 21거래일 안에 −5% 낙폭이 39.2%(39건)였다. 화면의 갈래 카드는 상승 빈도만 보여 주고 중간 낙폭은 보여 주지 않는다. "더 나은 확률과 이익, 그러나 더 큰 중간 손실"이라는 정직한 그림의 절반이 빠져 있다.
6. **나스닥 조정 기저율이 지금 상황보다 낮은 숫자를 보인다 [실측+추정]**. correction-base-rates.js:60은 무조건부 비율 "40번 중 8번이 -20%까지"와 빠른 조정 32번 중 4번을 쓴다. 지금 열린 조정은 빠른 조정이고 가장 깊은 종가가 −11.9%다(corrections.open). 같은 events에서 이미 −11.9%까지 간 조정만 세면 18번 중 8번, 빠른 조정만 세면 12번 중 4번이다 **[추정 계산, events 배열 기준]**. 깊이를 조건으로 넣으면 "약세장으로 이어질 수 있는 정도"가 화면의 숫자보다 높다(20% → 33~44%, 두 수치 모두 표본 10~29개라 참고).
7. **기울기 쪽 문서와 코드의 어긋남 [실측]**: session-lean.js:118-120은 "덜 불리한 선택 줄은 보이지 않는다(R724)"라고 하는데, market-lean.js:135·184·207은 방향이 말해질 때 여전히 `choices`를 만들어 AI 문맥에 넣는다. 지금은 검증 판정이 없어 이 경로가 실행되지 않지만, 판정이 통과하면 화면에서 지운 선택지가 AI에는 다시 들어간다.

---

## 3. 인벤토리 (file:line, 문자열·템플릿, 요소, 근거 상태)

### 시나리오·플레이북
- src/domain/market/regime/macro-crossroads.js:50-55 `CHOICES` 관망(현금, 단기채)/분할 접근/보유 유지/방어 전환 — 모든 화면과 AI가 공유하는 선택지 이름. **[실측]**
- macro-crossroads.js:287-393 갈래별 `choices`(선택지마다 기회비용 문장), `favored`, `favoredWhy`, `costly`. 예: :288 reheat favored ['wait','defend'] "기다림의 비용(놓친 상승 − 현금 이자)이 작고…". 기회비용·우위. **근거 없음(규칙 문장)**. :391 volshock stage "위 과거 빈도와 신용 지표로 확인합니다" — 문장에서 과거 빈도를 가리킴. **[실측]**
- macro-crossroads.js:252-273 `BRANCH_NOTES.invalidation` — 틀렸을 때(조건). 화면은 narrative-cards.js:69 → market-narratives.js:43 "틀렸다는 신호", AI는 :630 "이 읽기가 빗나가는 조건". 틀렸을 때 잃은 크기는 없음. **[실측]**
- macro-crossroads.js:462 `현금성 자산의 이자(SOFR x.xx%, M/D)`를 wait 문장에 대입 — 기회비용의 현금 쪽이지만 수준(연율)만 있고 기간 수익은 없음. **[실측]**
- macro-crossroads.js:426-445 `pastConflict`/`pastBridge` "과거 표본과 어긋남 — … 결론은 '…'이 실제로 이어질 때의 비용 기준입니다" — 규칙표 우위와 빈도가 어긋날 때 표시. 근거 있음(2SE). **[실측]**
- src/domain/scenarios/analogs.js:12-24 `BRANCH_ANALOGS`(시장 움직임 대용 정의), :196-216 `frequencyText` 템플릿 "…서로 겹치지 않는 사례 N번 중 M번은 이후 20거래일 동안 S&P 500이 올랐습니다 (중앙값 +x%, 가운데 절반 a~b). 비슷한 때 s%, 같은 기록 전체 거래일에서는 b%가…". 기저율과 구별되지 않으면(:213) "이 조건만으로는 방향을 말할 수 없습니다". 가능성과 손익비 일부. **근거 있음(사례 67~139)**. **[실측]**
- src/domain/scenarios/theme-playbook.js:48-57 `FAVOURED`(단계×바람 → 선택), :58-75 `WHY`, :78-86 `CHOICE_TEXT`(단계별 선택지 기회비용). 예: pullback.stage "나눠 들어가면 바닥을 맞히지 않아도 되지만, 하락이 길어지면 평균 가격도 함께 내려갑니다 — 구조 가설이 깨지는 신호가 중단 조건입니다". 우위·기회비용·틀렸을 때. **근거 없음**. **[실측]**
- theme-playbook.js:174-184 단계 조건 개수, :191-199 deep/shakyPullback이면 favored를 wait로 강제 — 측정 조건이 우위를 막는 장치. **[실측]**
- theme-playbook.js:236-240 `past`, `pastInformative`. theme-playbook-view.js:382 "뚜렷한 우위가 아니라 시나리오가 맞을 때의 비교입니다"(informative=false일 때만). informative=null(표본 부족, 한국 테마)이면 꼬리표 없이 우위가 나간다. **[실측]**
- src/domain/guide/market-guide.js:79-118 선택지 집계(favored 클러스터 − costly 클러스터), "robust" 선택, `costIfWrong`, pursue/avoid 목록. :181 "'비용이 작은 쪽'은 각 시나리오에 적힌 비용 비교를 센 것이며, 확률이나 따라 하라는 지시가 아닙니다." 현재 값: robust='hold', avoid "'관망' — '성장 재가속' 시나리오로 가면 손해가 큰 선택입니다"(scenario-state.json). 우위·틀렸을 때. **근거 없음(규칙표 집계)**. **[실측]**

### 과거 빈도·기저율
- src/ui/components/stress-outcomes.js:85 행 "평균 ±범위, 오른 비율 x%, 사례 약 N개(· 참고)", :98 "…평균 x% 움직였고 y%는 올랐습니다. 나쁜 쪽 10%는 z% 이하였습니다." 가능성과 하방 꼬리. 근거: stress-outcomes.json(1990-01-02~2026-11-10, 9,283일, nEff: calm 141, normal 136.8, elevated 87, high 41.2, stress 25.1, panic 9.9). (현재 꺼짐) **[실측]**
- src/domain/scenarios/correction-base-rates.js:60-76 "1986년 이후 나스닥 종합 7% 이상 조정 40번 중 8번이 -20%까지 갔습니다", "빠른 조정은 32번 중 4번". 정의 문장 "판정 점수에는 넣지 않습니다". 가능성. 근거 있음(40건). (현재 꺼짐) **[실측]**
- src/ui/components/market-temperature.js:187-189 "평균 x ±y%p, 오른 비율 z%, 하위 10% 결과 w, 겹치지 않는 N번(작은 표본)". 현재 S&P 500 state='none'. cold h21: n44, mean −0.07, median 1.04, p10 −9.69, hit 61 / 전체 h21: mean 0.8, median 1.25, p10 −4.48, hit 64. **[실측]**
- src/domain/market/regime/market-lean.js:71-88 `frequencyEvidence` 템플릿 "…21거래일 뒤 상승 x% (평소 y%, 표본 N회) — 평소와 구분되지 않음/참고만". :139 "1990년 이후 S&P 500은 21거래일(약 한 달) 뒤 N%의 경우 올라 있었습니다. 이것이 기본값입니다." 가능성. 근거 있음. **[실측]**
- src/domain/technical/setup-coach.js:125-170 `pastBreakouts` "불러온 N거래일 안에 겹치지 않는 돌파 사례 k건: 20거래일 뒤 오른 비율 a%(같은 기간 모든 20거래일 구간 기준 b%), 중앙값 c(기준 d), 그 사이 피벗 아래 종가가 나온 비율 e%". 가능성·손익비(중앙값)·틀렸을 때(실패율). 근거 있음(종목별, 보통 10건 미만이면 개수만). **[실측]**
- src/ai/tools/market-tools.js:59-74 `scenario_record` — 갈래와 테마 기록을 frequencyText로 돌려줌. VIX 구간과 조정 기저율용 도구는 없음(src/ai 전체 grep에서 stress-outcomes/corrections 참조 0건). **[실측]**

### 레벨 지도·손익비
- src/ui/components/stock-chart-coach.js:390-391 "가장 가까운 저항 후보는 +x% 위 P(종류), 지지 후보는 −y% 아래 Q(종류)입니다", :184-195 표의 "변동폭 N배", 반응 횟수. :221 "ATR(14) P(종가의 x%) … ATR의 1~2배 거리를 손절 폭으로 씁니다." 손익비의 재료. 측정값(일봉). **[실측]**
- stock-chart-coach.js:277-288 내 계획 점검 "진입가~손절가 위험 폭 x% (일평균 변동폭의 y배)", "위험 1 대비 보상 r배", rewardRiskFacts "손익비 r : 1이면 10번 중 약 k번 이상(승률 b% 이상) 맞아야 비용 전 본전입니다"(chart-strategies.js:134-137), "투입 금액 기준 손절가 도달 시 손실 약 L, 전체 자본의 p%". 손익비·틀렸을 때. 근거: 사용자 입력의 계산. **[실측]**
- src/domain/technical/chart-strategies.js:93-125 방식별 stop/target/invalidation 규칙 문장 — 틀렸을 때. 근거: 문헌(lens.source). 성과 없음. **[실측]**
- src/domain/technical/market-charts.js:116-121 지수 지지·저항 후보 거리 %. :118-119 RSI 방향 문장(근거 없음). **[실측]**
- src/domain/screener/setup-profile.js:64-66 50일선 거리 ÷ ADR "under 2 near, 4+ extended, 7+ stretched". 부담 쪽 신호. 기준 대역이며 성과 검증 없음. **[실측]**
- src/ui/components/portfolio-plan-check.js:12-20 "위험 폭 −x%", "위험 1 대비 보상 r배", "손절 가격에 닿으면 손실액 L (전체 자본의 p%)". **[실측]**

### 포트폴리오 위험
- src/ui/components/portfolio-risk-metrics.js:88-110 VaR95/CVaR95/VaR99(표본이 얇으면 "표본 최악일"), MDD, 표본 수. 틀렸을 때의 크기(과거 표본 기준). **[실측]**
- src/ui/components/portfolio-read.js:42-43 "현금 x% — 지수에 투자됐다면 얻었을 수익률만큼이 현금 효과". 기회비용, 실제 계산. **[실측]**

### 원칙·지식
- src/domain/guide/lessons.js:33-99 survive-first("-50%를 메우려면 +100%"), waiting-is-a-choice(현금 이자 대입), staged-entry, know-when-wrong(invalidation 첫 줄 대입), size-by-loss(변동성 축 부담일 때 "같은 크기라도 평소보다 흔들림이 큽니다"), :184-196 past-repeats·count-not-probability. **[실측]** size-by-loss의 변동성 연결은 오늘 위험 백테스트(위험 신호는 VIX 구간이 모두 설명)와 방향이 맞는다. **[추정]**
- public-data/principles/lesson-library.json J3 "포지션 사이징", J4 "손실과 생존", :3237-3240 기대값 예시. src/domain/knowledge/concept-core.js 기대값 정의 "60% 확률로 +10%, 40% 확률로 −20%면 기대값은 … −2%". concept-stories.json 기저율, "기대값이 플러스여도 한 번의 손실이 파산을 부를 만큼 크다면…". 어휘 수(principles·knowledge·guide·knowledge 모듈): 기대값 14, 기저율 5, 파산 위험 10, 기회비용 71, 손익비 0, 본전 승률 0, 켈리 0. **[실측]** 라이브러리에는 "손익비"라는 말이 없다. 차트 코치(chart-strategies.js:140-145 RR_GUIDE)에만 있다.

### AI 지시
- src/ai/response/answer-modes.js:32 decision 모드 — 구간 판단, "현재 근거가 어느 쪽을 얼마나 지지하는지(조건 충족 수·시장 가격 방향·과거 빈도와 표본 수)", 선택지별 기회비용, 비용이 작은 쪽, 무효화 신호, 체크리스트. 손익비(이익 크기 대 손실 크기)와 틀렸을 때의 과거 비용은 요구하지 않음. **[실측]**
- src/ai/response/request-pipeline.js:503 "가격 범위·무효화 수준·손절 기준·포트폴리오 비중은 시나리오와 계산 입력으로 분석할 수 있다 … (예: '현금 보유가 우위인 상황', …)"; :509 "보정 모델 … 없으면 Bull/Base/Bear·상승/하락 확률을 숫자(%)로 만들거나 추정하지 마라". **[실측]**
- scripts/lib/market-analysis-prompt.mjs:49 conduct — "현금·방어 우위 / 분할 접근 우위 / 판단 보류", 말로 된 가능성의 근거로 "조건 충족 n/m · 시장 가격 방향 · 축 상태 · 표본 수가 있는 과거 빈도". **[실측]**
- macro-crossroads.js:630 AI 갈래 줄 "이 시나리오에서 비용이 작은 쪽(비용 가설 — 과거 성과로 검증한 우위 아님)"; :638 "조건 충족 수는 가능성이 아니라 개수다 … %·확률 숫자를 만들지 마라". **[실측]**
- market-lean.js:204-205 기울기 문맥 머리말(위 2번 모순). **[실측]**

---

## 4. 데이터로 할 수 있는 것 — 지금 산출물만으로

evidence-strength.js: n<10 개수만 / 10~29 숫자 + "참고" / 30+ 숫자. 아래 "판정"은 이 규칙을 겹치지 않는 사례 수에 적용한 것이다.

| 수치 | 원천 산출물·필드 | 표본 | 판정 |
|---|---|---|---|
| 갈래별 20거래일 이익 대 손실(p75 ÷ |p25|)과 중앙값 | scenario-outcomes.json `branches.<id>.{n,up,median,p25,p75,horizon,baseUpPct}` | 67~139 (reheat 139, softland 87, slowdown 94, oilshock 67, creditstress 70, dollarsurge 101, reflation 73, volshock 69, aibust 73, fiscalsteep 83) | **표시 가능**. 예: reflation +2.7/−1.2 = 2.3배, 중앙값 +1.0. volshock +6.0/−0.9 = 6.7배, 중앙값 +2.6 **[추정 계산]** |
| 갈래별 63거래일 같은 값 | `branches.<id>.h63.{n,up,median,p25,p75}` | 36~88 (volshock 36, oilshock 44, creditstress 44) | 표시 가능(전부 30 이상). volshock h63 p25 +0.9, p75 +11.3 |
| 갈래별 기대값(평균) | 없음 — branches에 `mean`이 없음 | — | **불가**. 중앙값과 사분위만 있으므로 "기대값"이라고 쓰면 안 됨(브리프의 가정 정정) **[실측]** |
| 기준(아무 날) 사분위 — 갈래 이익 대 손실을 비교할 기준 | scenario-outcomes에는 `baseUpPct`만. stress-outcomes `all.21.{mean,median,p10,p90}`(p25/p75 없음) | 9,262일, nEff 441 | **부분**. 기준 p25/p75가 어디에도 없어서 갈래 IQR을 기준 IQR과 맞댈 수 없음 → 프로듀서에 필드 2개 추가가 필요 **[실측]** |
| VIX 구간별 한 달 평균·중앙값·오른 비율·p10/p90 | stress-outcomes.json `bands[].horizons.21.{mean,median,hitRate,p10,p90,nEff}` | nEff 141 / 136.8 / 87 / 41.2 / 25.1 / 9.9 | <15·15~20·20~25·25~30 표시 가능. 30~40 참고. 40+ 개수만(그러나 2번 모순 참고) |
| VIX 구간별 21거래일 안 −5% 낙폭 확률·낙폭 중앙값·하위 5% 수익 | scratch `lean-risk/risk-result.json` `horizons.h21.all.vixBand.<band>.{cases,pDD5,mddMedian,ret5th,retMean,retMedian}` — **public-data에 없음** | <15: 98, 15~20: 130, 20~25: 99, 25~30: 59, 30+: 39 (2008-03~2026-11) | 수치는 모두 표본 30 이상이라 표시 가능. 다만 지금은 게시된 산출물이 아니므로 **프로듀서로 승격하기 전에는 표시 불가** **[실측]** |
| 오늘 해당 구간(VIX 19.3, 11/13 종가 → 15~20) | 위 두 원천 | 130 / nEff 136.8 | 한 달 오른 비율 63.2%(평소 63.9%), 중앙값 +1.19%, p10 −4.46%. −5% 낙폭 15.4%(평소 17.8%) **[실측]** |
| 나스닥 7% 조정 → 약세장 기저율 | scenario-outcomes `corrections.{n,bear,fastN,fastBear,events[[peak,trough%,fast,bear]],open}` | 40 / 32 | 표시 가능. 깊이 조건부(이미 −11.9%): 18건 중 8, 빠른 조정 12건 중 4 → **참고** **[추정 계산]** |
| 약세장이 안 된 조정의 바닥 깊이(분할 접근의 중간 손실) | 같은 `events` | 비약세 32: 중앙값 −10.0%, p25 −13.1%, 최저 −18.2. 약세 8: 중앙값 −31.6% | 표시 가능(32) / 약세 쪽은 개수만(8) **[추정 계산]** |
| 현금 쪽 기회비용(같은 사례 기간 현금 수익) | macro-history.json `long.series.fedFunds`(월별, 1990-01~2026-10, 442개). `series.sofr`는 2025-10-17부터 일별 267개, `series.dgs3mo`는 47개뿐 | 각 사례 날짜에 그 달 fedFunds × 20/252 | **계산 가능**(새 원천 불필요). 지금 3.88% → 20거래일 약 +0.31% **[추정]**. 장기 일별 현금 금리는 없으므로 월 평균 근사라고 밝혀야 함 |
| 지수 쪽 기회비용(테마) | scenario-outcomes `themes.<id>.<stage>` — 코드는 지수 초과 수익(`outcome:'excess'`, analogs.js:148,169)을 내지만, 지금 파일에는 `outcome`·`fingerprint`가 없음 | 단계별 0~91 | 재생성 뒤 가능. 대부분 10~29 → 참고, 상당수 <10 → 개수만 |
| 가격 온도 구간 결과 | market-temperature.json `markets.<m>.outcomes.{cold,hot,all}.{h21,h63}.{n,mean,median,p10,hitRate,se}` | spx cold h21 44, hot 65 | 표시 가능. **역발상 근거가 아님**: cold 뒤 21일 평균 −0.07%, p10 −9.69%(평소 0.8%, −4.48%) |
| 종목 손익비(가장 가까운 저항 거리 ÷ 지지 거리, ADR 단위) | 브라우저 레벨 지도(일봉에서 계산; `levels.above[0].pct/adrMultiple`, `levels.below[0]`) | 종목별 1개 값(빈도 아님) | 거리로는 표시 가능. "손익비"라고 부르면 사용자의 진입·손절을 앱이 정하는 셈이 됨(R724). "위로 a배·아래로 b배"로만 |
| 스크리너 행 단위 거리 | screener.json 행 `adrPct, pctSma50, pctSma200, pctFrom52wHigh, pctFrom52wLow, rsi` (1,157행) | — | 거리로 표시 가능. 레벨이 아니라 이동평균·52주 끝값이므로 지지·저항이라고 부르면 안 됨 |
| 종목 돌파 성과 | 브라우저 일봉(setup-coach.js pastBreakouts) | 종목마다. 보통 10건 미만 | 대부분 개수만 |
| 6개 축 개수 → 방향 | scratch `lean/market-lean-backtest.json` | held-out 높음 48·낮음 41 | **방향어 불가**(검증 실패). 위험 쪽 차이는 VIX 구간으로 설명됨(`withinVolatilityStrata`, `vixBand`) |

**역발상 판단의 정직한 근거 [실측 수치, 해석은 추정]**. 21거래일 기준 VIX 25~30은 59건, 평균 +2.36%, 중앙값 +3.52%, −5% 낙폭 25.9%, 하위 5% −7.17%다. VIX 30+는 39건, 평균 +1.77%, 중앙값 +3.19%, −5% 낙폭 39.2%, 하위 5% −16.1%다. 기준은 223건, 평균 +0.90%, 중앙값 +1.50%, −5% 낙폭 17.8%, 하위 5% −7.08%다. 스트레스 구간의 장기 표(1990~)도 30~40에서 오른 비율 74.2%, 중앙값 +3.55%(nEff 25 → 참고)다. 갈래 기록 volshock은 69건 중 71% 상승이다.
→ "분할 매수하기 좋은 구간"을 정직하게 말할 수 있는 형태는 이것이다. **VIX가 높은 구간 뒤 한 달은 평소보다 오른 경우와 중앙값이 컸지만, 그 사이 −5% 넘게 빠진 경우도 평소의 2배 안팎이었다.** 확률과 이익이 나아지는 대신 중간 손실이 커지는 구간이므로, 나눠 들어가는 이유(중간 손실을 견딜 수 있는 크기)와 같이 써야 한다. 가격 온도 "차가움"은 이 형태를 받치지 않는다(평균 −0.07%).
→ 지금(VIX 19.3, 15~20 구간)은 어느 쪽 우위도 근거가 없다. 오른 비율 63.2% 대 63.9%, 낙폭 확률 15.4% 대 17.8%다.

---

## 5. 빈칸 — 독자에게 주는 가치 순

공통 방향: **하나의 판단 틀 객체**를 domain에서 만들어 화면과 AI가 함께 쓴다.
`{ likelihood: {rate, base, n, strength, informative}, payoff: {median, p25, p75, tail, drawdown?}, opportunity: {cash, index?}, wrong: {conditions[], cost: {p25|p10|mdd, n}}, favoured: {side, ground: 'measured'|'cost-hypothesis', why} }`
지금 가장 가까운 것은 `buildMacroCrossroads` items다(macro-crossroads.js:479-490). conditions, past(n·up·median·p25·p75·baseUpPct), choices, favored/favoredWhy, pastConflict, invalidation을 이미 한 객체에 갖고 있다. 빠진 것은 payoff 비율, 현금 쪽 숫자, wrong.cost, `favoured.ground` 구분이다. theme-playbook의 themeRow(theme-playbook.js:223-243)도 같은 모양(favored, favoredWhy, choices, past, pastInformative, breaks)이라 같은 틀로 바꿀 수 있다. **[실측+추정]**
소유 모듈 제안: `src/domain/scenarios/decision-frame.js`(순수 함수: 과거 기록 + 현금 시계열 → frame, evidence-strength로 억제). 갈래와 테마 행 빌더가 이를 호출하고, `src/ui/components/decision-frame-view.js` 하나가 그린다(macro-crossroads 카드, theme-playbook 카드, market-narratives가 공유). AI는 `render…Context`가 같은 frame을 한 줄로 직렬화한다. 구조 우선 원칙상 기존 세 렌더러에 각각 붙이지 말고 이 한 곳으로 모은 뒤 바꾸기를 권한다. **[추정]**

1. **스탬프 없는 산출물 때문에 근거가 꺼지는 문제(0번)** — 무엇: push와 첫 refresh 사이에 과거 빈도가 모두 사라짐. 방법: 통합 패스에서 Actions의 `SCENARIO_OUTCOMES_FORCE`/`STRESS_FORCE` 실행을 push 바로 뒤에 두거나, 리더가 스탬프 없는 이전 정의 파일을 "이전 정의(참고)" 꼬리표로 보여 줌. 그러나 후자는 스탬프 도입의 목적에 반하므로 전자를 권함 **[추정]**. 주장하지 말 것: 꺼진 동안 "기록 없음"을 "근거 없음"으로 바꿔 말하기.
2. **"틀렸을 때 얼마나 잃었나"를 숫자로** — 무엇: 갈래·VIX 구간·조정 쪽에 중간 낙폭이 없음. 데이터: risk-result.json의 `pDD5`·`mddMedian`·`ret5th`(VIX 구간, 39~130건) → build-stress-outcomes.mjs가 같은 계산을 band마다 내도록 승격(새 원천 불필요, ^GSPC 일봉만). 갈래에는 같은 스캔에서 사례마다 20거래일 최저 종가를 기록해 `mdd` 필드 추가(analogs.js summarise). 조정 쪽은 `events` 바닥 분포로 지금 계산 가능. 소유: 프로듀서 + decision-frame.wrong.cost. 렌더: decision-frame-view. 주장하지 말 것: 손절 가격, "이 정도 빠지면 판다".
3. **우위의 근거 종류를 화면에 표시** — 무엇: "비용이 작은 쪽"이 검증된 것인지 규칙표 문장인지 화면 카드에서 구분되지 않음(AI에만 "비용 가설" 꼬리표가 있음). 방법: frame.favoured.ground = 'cost-hypothesis'(FAVOURED/branch.favored)이면 카드 꼬리표에 같은 문구를 표시. pastInformative가 null(표본 부족)일 때도 theme 카드에 꼬리표가 붙도록 :382 조건을 바꿈. 소유: choice-words.js에 단어 하나, decision-frame-view. 주장하지 말 것: 규칙표 결론을 "과거에 더 나았다"로 바꿔 말하기.
4. **손익비(사분위 비율)와 현금 비교를 갈래 카드에** — 무엇: frequencyText에 중앙값과 가운데 절반은 있지만 이익 쪽과 손실 쪽을 맞댄 문장이 없고, 현금이 같은 기간 번 값도 없음. 데이터: branches p25/p75/median(67~139건), long.fedFunds(442개월). 프로듀서가 사례마다 그 달 fedFunds×h/252를 더해 `cashMedian`을 쓰거나, 리더가 사례 날짜 없이 현재 금리로 근사(근사라고 밝힘). 기준 IQR 비교를 위해 프로듀서가 `baseP25`·`baseP75`를 추가. 소유: build-scenario-outcomes.mjs + decision-frame.payoff/opportunity. 주장하지 말 것: 기대값(평균이 없음), "x배 유리".
5. **AI 지시를 오늘 증거에 맞추기** — 무엇: decision 모드와 시장 읽기 프롬프트가 조건 개수와 축 상태를 우위와 가능성의 근거로 허용함(2번 모순). 방법: 두 프롬프트에서 근거 목록을 "표본 수가 있는 과거 빈도(기저율과 함께)·시장 가격 방향"으로 줄이고, 개수는 "상태"로만 쓰게 함. AI에 VIX 구간과 조정 기저율 블록(decision-frame 직렬화)을 주고, scenario_record가 stress 구간과 corrections도 돌려주게 함(market-tools.js:59). 주장하지 말 것: 개수로 "매수가 부담스러운 구간".
6. **조정 기저율을 깊이 조건부로** — 무엇: 지금 −11.9%까지 간 조정에 무조건부 8/40을 보여 줌(2번 6). 방법: correctionReading이 `open.troughPct` 이하까지 갔던 사례만 다시 셈(18건 중 8, 빠른 조정 12건 중 4 → 참고). 비약세 사례의 바닥 분포(중앙값 −10%, p25 −13.1%)를 "약세장이 아니었던 조정은 보통 여기서 끝났다"로. 소유: correction-base-rates.js. 주장하지 말 것: "바닥 근처", 약세장 확률 %.
7. **증거 강도 반올림 통일** — 무엇: VIX 40+ 행을 두 화면이 다르게 판정. 방법: market-lean.js:73의 floor를 evidenceStrength(approx)로 바꾸거나 evidence-strength.js:5의 규칙을 floor로 바꿈. 한쪽으로 정해야 함. 소유: evidence-strength.js.
8. **지수 차트 방향 문장에 빈도를 붙이거나 지우기** — 무엇: market-charts.js:118-119. 방법: 지수 일봉 히스토리(스트레스 프로듀서의 ^GSPC)로 "RSI 30 이하 뒤 5/20거래일" 빈도를 내거나, 그 전까지는 상태만 남김. 주장하지 말 것: "반등이 자주 나오는 자리".
9. **종목 레벨 거리 비율(앱 계산)** — 무엇: 가장 가까운 저항과 지지까지 ADR 배수는 표에 있지만 둘을 맞댄 한 줄이 없음. 방법: priceLevelSection 머리 문장에 "위 저항 후보까지 변동폭 a배, 아래 지지 후보까지 b배". 소유: stock-chart-coach.js(이미 levels.above[0].adrMultiple 보유). 주장하지 말 것: 이를 손익비나 진입·손절로 부르기(R724).

---

## 6. 가장 강한 표현 셋과 약화시키는 곳 셋

**강한 셋 [실측]**
1. 종목 차트 "내 계획 점검"(stock-chart-coach.js:272-288 + chart-strategies.js:134-145): 위험 폭(변동폭 배수), 위험 1 대비 보상, 본전 승률, 손절 시 손실액과 자본 비중, 경로상 레벨을 모두 보여 주고 앱은 가격을 고르지 않는다. "작게 지고 크게 이기기"가 가장 구체적으로 구현된 곳이다.
2. 갈래 과거 빈도 문장과 어긋남 표시(analogs.js:196-216, macro-crossroads.js:426-445): 겹치지 않는 사례 수, 같은 기록의 기저율, 중앙값과 가운데 절반, 기저율과 구별되지 않으면 "방향을 말할 수 없습니다", 규칙표 결론과 반대면 "과거 표본과 어긋남". 확률적 사고의 핵심인 기저율 대비를 지킨다.
3. 이 종목의 과거 돌파(setup-coach.js:125-170): 같은 종목 기준선 대비 오른 비율과 중앙값, 그리고 "피벗 아래 종가가 나온 비율"(틀렸던 빈도)을 함께 보이고, 10건 미만이면 개수만 쓴다.

**약화시키는 셋**
1. 근거가 꺼진 산출물(0번) **[실측]**: 이 배치를 그대로 push하면 다음 refresh까지 VIX 구간·조정 기저율·장기 갈래 빈도·테마 단계 기록이 모두 사라지고, 화면에는 규칙표의 "비용이 작은 쪽"만 남는다 **[추정]**.
2. 화면의 "비용이 작은 쪽"과 가이드 avoid "손해가 큰 선택"(macro-crossroads.js:266,306; market-guide.js:118) **[실측]**: 규칙표 문장인데 화면 카드에는 비용 가설이라는 꼬리표가 없다. 지금 중심 갈래(reflation 56% 대 기준 64%)의 과거 기록은 '보유 유지'를 받치지 않는다(표본 오차 안).
3. AI 지시가 조건 개수와 축 상태를 우위·가능성의 근거로 허용(answer-modes.js:32, market-analysis-prompt.mjs:49) **[실측]**: 오늘 백테스트로 무너진 근거가 AI 답변에서 "분할 매수하기 좋은 구간" 같은 문장의 근거로 다시 쓰일 수 있다 **[추정]**.

---

## 7. 문서와 코드의 어긋남 (CLAUDE.md 규칙에 따라 기록)

- evidence-strength.js:5 "approx … rounded once" ↔ market-lean.js:73 "Floored". 같은 nEff 9.9를 다르게 판정한다.
- session-lean.js:118-120 "덜 불리한 선택 줄은 보이지 않는다(R724)" ↔ market-lean.js:184·207은 방향이 말해질 때 choices를 AI 문맥에 넣는다.
- RULES R724(v58.75) "기준별 충족 개수와 값(가능성·등급 아님)" ↔ AGENTS "Judgement allowed (2026-11-12)"와 answer-modes.js:32 "구간 판단". AGENTS가 더 새로운 정본이지만, 개수를 우위의 근거로 쓰라는 프롬프트는 오늘 백테스트와 맞지 않는다(정책 결함이 아니라 근거 결함).
- 브리프의 가정 "scenario-outcomes branches → 기대값 도출 가능"은 맞지 않다: branches에 `mean`이 없다(중앙값·사분위만).
- backtests.md(같은 폴더)는 커밋본 테마 기록에 `outcome` 필드가 없고 절대 수익 기준이라고 적었다. 지금 파일은 `basis:'relative-banded'`, `benchmark:'rsp'`를 갖지만 여전히 `outcome`과 `fingerprint`가 없다(11-14 14:31Z 커밋). 어떤 정의로 계산된 숫자인지 파일만으로는 확정할 수 없고, 리더는 쓰지 않는다.

## 찾지 못한 것 (찾아본 곳)
- VIX 구간 낙폭 확률(pDD5 등)의 게시본: src/, public-data/, architecture/ 전체 grep 0건(scripts/backtest-market-lean-risk.mjs에만 있음).
- 매크로 화면의 판단 틀: macro-chapters.js·macro-board.js grep에서 빈도·기회비용·우위 표현 없음(지도는 시장 상태로 이동).
- 포트폴리오의 국면별 손실 추정: portfolio-risk-metrics.js, portfolio-read.js, portfolio-backtest-lab.js에서 VIX나 국면 연결 없음.
- 리서치 라이브러리의 "손익비" 항목: principles·knowledge·guide·knowledge 모듈에서 0건.
