# v57.50 심층·통합 검토 반영 — 작업자 공통 지시서 (2026-10-13)

소유자 요청: "각 기능/콘텐츠/내용들의 이면과 의미, 심층적인 요소까지 모두 검토하고 개선 작업 … 각각의 콘텐츠/기능/내용들끼리 유기적으로 연결되고 통합되는지까지 확인하고 점검해서 똑같이 구조적 개선 및 퀄리티 보강".
검토 원본(읽기 전용 에이전트 3명, 실제 public-data로 재현): C01–C25(표면 간 일관성), I01–I29(연결·흐름), D01–D24(지표의 이면·방법론). 각 항목 원문은 작업 지시 프롬프트에 있다.

## 공통 규칙 (위반 시 되돌림)
- 로컬 `C:\Projects\AIO` main에서 작업한다. 커밋·푸시·배포·버전 범프·record-fix·generate-workspace-state는 금지한다(조정자가 한다).
- 데이터 생산 스크립트(`scripts/fetch-*`, `build-*`, `refresh-*`, `sync-*`) 실행과 AI 요청은 금지한다.
- **소유 파일만 수정한다.** 다른 작업자 파일에 수정이 필요하면 고치지 말고 보고서에 "요청: 파일·변경"으로 적는다.
- 소유자 UI 원칙:
  - 이모지 금지.
  - 본문에 제공자명·URL 금지(hover와 접힌 데이터 출처만 허용).
  - 섹션마다 그림 1개 + 짧은 읽기 3~5줄 + 접힌 세부.
  - 사용법 문장은 최소로 하고, 분석을 잇는 연결 문장은 유지한다.
  - 원천 없는 위젯·근거 없는 등급·매매/비중/타이밍 지시 금지. 종가 기준. 티커 추정 금지.
- 캔들 색(상승 빨강·하락 파랑)은 소유자 결정(P1634)이며 차트 캔들에만 쓴다. 그 밖의 방향 표시(막대·표·지도)는 `--data-green/--data-red`(상승 초록·하락 빨강)를 쓴다.
- 부분 패치만 한다(전면 재작성 금지). 기존 함수와 데이터를 잇는 것이 우선이며, 새 위젯 추가는 금지한다.
- Windows: Python은 `newline=''`, node heredoc 금지(Edit 도구 사용). 수정한 JS마다 `node --check <file>`을 실행한다.
- 끝나면 소유 파일과 관련된 gate를 직접 돌린다(`node scripts/qa-runner.mjs --list`로 찾거나 해당 `scripts/ci-*.mjs`).
  - 의도된 변경 때문에 실패하는 gate 단언이 **자기 소유 파일만** 다룬다면 고치고, 고친 줄을 보고한다.
  - 공용 gate라면 보고만 한다.

## 조정자가 이미 만든 공용 부품 (그대로 쓴다)
- `creditState({hyBp, hy5, hy20, pcr})` — `src/domain/briefing/market-read.js` export.
  - 반환값: 'favorable' | 'neutral' | 'burden' | 'unknown'.
  - 모든 "신용 안정/경계" 판단은 이 함수만 쓴다. 'favorable'일 때만 "안정"이다.
- `RULES.technical.rsi = {overbought:70, oversold:30, climax:80}` — `src/domain/rules/thresholds.js`.
- `renderKnowledgeArrival({documentRef, root, routeId})` — `src/ui/components/knowledge-arrival.js`.
  - 리서치 문서에서 넘어온 맥락(확인 대상·돌아가기)을 `#page-<routeId>`에 표시한다.
  - 페이지 mount와 route 재진입 때 한 번씩 호출한다.

## 조정자 결정 (소유자가 위임한 결정)
- **D02 자체 심리 종합 0~100:** 근거 없는 종합 등급이므로 점수와 구간 라벨(극단적 공포~탐욕)을 쓰지 않는다. 요소별 1년 백분위를 나란히 보여 주고, 요소 간 차이(최저·최고 요소)를 한 줄로 쓴다. CNN 공식 F&G 표시는 유지한다.
- **D05 분배일:** '경고 구간' 단정을 빼고 "AIO 기록 n일 중 백분위"로 쓴다.
- **D06·D09·D10·D14(가중치·축 기저율·기준선):** 모델 변경은 후보 검증 기록 없이 하지 않는다. 설명 문구 정정만 한다.
- **D15 테마 그룹:** 4종목 미만 그룹은 순위표 머리(1위·최하위 문장)에서 빼고 '표본 n종목 · 참고'로 표시한다.
- **D16·D17 거시 사분면:**
  - 물가 방향은 |3개월 연율 − 전년 대비| < `RULES.inflation.reaccelPp`이면 '방향 보류'.
  - 성장은 기준값과의 차이가 기준의 절반 미만이면 '근소(경계)'로 표시하고 사분면을 확정하지 않는다.
- **D19 심리 색:** 심리 수준(F&G·풋/콜·AAII)은 좋음·나쁨 색 없이 중립 톤으로 표시한다. 신용 축만 tone을 유지한다.
- **D20 시장 폭:** 40/60 판정 옆에 AIO 자체 기록 백분위와 기록 일수를 쓴다. 기록이 252일 미만이면 '잠정'으로 표시한다.
- **I06·I07·I20(복기 위치·관심종목 저장소·AI 대화 이력):** 사용자 저장 데이터를 옮기는 작업이므로 이번에는 하지 않는다. 보고서에 권고안으로만 남긴다.
- **I10:** 스크리너 테마 별칭에 `THEME_MAP` 구성 종목을 합집합으로 더한다. 수동 별칭은 남긴다.
- **I19:** 소유자가 넣은 참고 자료이므로 위치는 유지한다.
- **C25:** '나스닥'은 '나스닥 100' 또는 '나스닥 종합'으로 명시한다. 홈 섹터 막대 색은 `--data-green/red`로 쓴다.

## 파일 소유
| 작업자 | 소유 파일 |
|---|---|
| W1 시장 판독·흐름 | src/domain/briefing/market-read.js, src/domain/market/{scenario-outlook,page-flow,regime-radar,breadth,regime-scenarios}.js, src/ui/components/{market-regime,regime-radar,home-kpi-trend,briefing-read}.js, src/ui/styles/regime-quality.css |
| W2 심리·스트레스·용어 | src/domain/sentiment/**, src/ui/components/{sentiment-board,stress-outcomes}.js, src/ui/pages/sentiment.js, src/domain/signal/stress-outcomes.js, src/domain/market/health.js, js/aio-glossary.js |
| W3 레거시·AI·생산자 | js/aio-chat.js, js/aio-core.js, js/aio-workspace.js, js/aio-data.js, js/aio-ui.js, js/aio-pages.js, js/aio-kr-data.js, js/aio-tests.js, scripts/fetch-data.mjs, src/domain/signal/trading-score.js, src/data/runtime-readers.js, src/ai/**, src/app/bootstrap.js |
| W4 종목·스크리너·테마 | src/domain/entity/**, src/ui/pages/{screener,themes,masters,news,entity}.js, src/domain/screener/**, src/ui/components/{screener-validation,screener-read,theme-strength}.js, src/data/providers/themes.js, src/domain/themes/**, src/domain/technical/**, src/domain/fundamental/** |
| W5 거시·포트폴리오·index.html | src/domain/macro/**, src/ui/components/macro-board.js, src/ui/pages/{market,portfolio}.js, src/domain/portfolio/**, src/ui/components/portfolio*.js, index.html |
| W6 학습 연결·라우터 | src/app/{router,routes,knowledge-route-state,research-handoff}*.js, src/ui/pages/analysis.js, src/ui/components/deep-dive.js, src/domain/content/**, src/domain/knowledge/**, src/ui/knowledge/**, public-data/knowledge/route-targets.json 생성 원천(생성기 실행은 금지, 원천만 수정 후 보고) |

## 보고 형식 (한국어, 짧게)
`항목ID | 처리(완료/부분/보류) | 변경 file:line | 확인 방법(node 재현·gate)` 표를 쓴다. 이어서 다른 작업자 파일에 대한 "요청" 목록, 실패했거나 고친 gate 목록을 쓴다.
