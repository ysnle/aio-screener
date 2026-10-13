# 급변 장세 반영·통합 개선 — 작업자 공통 지시서 (2026-10-13, v57.52)

소유자 요청: "현재 급변하는 시장 상황과 혼란스러운 정세를 잘 따라가는지, 지속적으로 유연하게 반영·통합하는지 전체 세밀하게 확인해서 개선".

## 점검 결과 요약
점검 3건의 결론이다.
- **갱신 경로**
  - refresh-data는 GitHub 예약 실행 도달률이 11%다. 실제 갱신 간격은 중앙값 4h, 최대 13h다.
  - 30분 Worker dispatch는 `redirect:'error'` TypeError 때문에 한 번도 실행되지 않았다. 조정자가 이미 고쳤다(P1718, worker/data-plane.js).
- **해설·판정**
  - marketAnalysis 발행률은 63%다. 오늘 실패는 날짜·시각 숫자를 SPX 값으로 읽은 검증기 오탐이다.
  - 판정은 미국 5·20·50·200일 창에 고정돼 있다. 그래서 코스피 1일 −5.46%가 판정·헤드라인·시나리오·AI 헤더에 닿지 않는다.
- **뉴스:** 08:00 KST 마감 창이라 한국 장중 사건이 다음 날까지 0건이다.
- **실시간 값 오류**
  - 한국 종목·코스닥의 실시간 등락률이 한 세션 어긋난 전일종가로 계산된다: 005930 −6.6~−7.4% 대 실제 −5.58%, ^KQ11 −6.19% 대 실제 −1.43%.
  - 원/달러가 여러 화면에서 10/9에 고정돼 있다.
- **화면 간 통합:** 같은 날을 화면마다 다르게 말한다. 기준일이 다른 값을 한 문장에서 비교하고, 유가 5일 반등이 20일 '하락'에 가려진다.

scratchpad(점검 증거): `C:\Users\zmfhd\AppData\Local\Temp\claude\C--Projects-AIO\6dabf95e-eaf2-4f68-b9fd-fc8e999848d1\scratchpad\` (`shock\` 스크린샷·innerText, `shock-*.mjs` 재현 스크립트)

## 공통 규칙 (v57.51 지시서와 동일)
- 로컬 main에서 작업한다.
- 조정자만 하는 일: 커밋·push·버전 범프·record-fix.
- 데이터 생산 스크립트(`scripts/fetch-*`, `build-*`, `refresh-*`, `sync-*`)는 실행하지 않는다. export 함수를 fixture로 검증한다.
- 수정 방식
  - 소유 파일·구간만 정확한 문자열 Edit로 고친다. 파일 전체 재작성, Python, node heredoc은 금지다.
  - 수정한 JS는 `node --check`를 통과해야 한다.
  - 새 단언 라벨에는 P 번호를 붙인다(P1718~P1730 범위, 아래 배정).
- 소유자 원칙
  - 종가 기준.
  - 매매·비중·타이밍 지시 금지.
  - 근거 없는 등급·신호 금지.
  - 이모지 금지.
  - 본문에 제공자명·URL 금지(hover와 접힌 데이터 출처에만).
  - 한 섹션 = 시각 1개 + 짧은 읽기(3~5줄) + 접힌 상세.
  - 뉴스는 큐레이션이다(원천을 무작정 늘리지 않음).
  - AI는 공용 Worker, 월 $20.
  - 원천이 의심스러우면 값을 만들지 말고 보류(fail-closed)한다.
- 끝나면 관련 gate를 돌린다(`node scripts/qa-runner.mjs --list`).
  - 자기 구간 단언은 고친다.
  - 공용 gate 실패는 보고만 한다.

## 조정자 결정
- **장중 속보 칸(N14):**
  - 08:00 완료 묶음은 그대로 둔다(정본).
  - 그 위에 별도 `newsIntraday` 칸을 추가한다.
    - 08:00 이후 기사만, tier1·2 원천만, 최대 6건, 기존 큐레이션 필터와 중복 제거를 적용한다.
    - 화면 라벨은 '08:00 이후 장중 속보 · 잠정'이다.
    - 다음 08:00 묶음에 들어간 기사는 칸에서 빠진다.
  - 소유자의 이번 요청("급변 정세를 따라가라")에 근거한 결정이다. 정본 창은 바꾸지 않는다.
- **marketAnalysis**
  - 검증 사유를 넣어 1회 재생성한다.
  - 그래도 차단되면 12시간 이내 직전 검증본을 'HH:MM 기준 직전 검증본'으로 표시한다. 그보다 오래됐으면 기존 대기 문구를 쓴다.
  - 거절된 원문은 Actions 실행 로그에만 400자까지 남긴다(공개 산출물에는 남기지 않음).
- **fast data plane 브라우저 사용(`fastQuotes.enabled`):** 원천 권리 검토 전이라 바꾸지 않는다. 소유자 결정 사항이다.
- **한국 충격 표시**
  - 미국 6축 판정 규칙은 바꾸지 않는다.
  - 기록 백분위 기반 서술(근거 있는 문장)과 브리핑 가중치로 올린다. 새 등급이나 배지는 만들지 않는다.

## 소유 표
| 작업자 | 소유 | P 배정 |
|---|---|---|
| R1 생산자 | scripts/fetch-data.mjs(marketAnalysis 생성·검증·프롬프트, 뉴스 수집·newsIntraday, history 환율 열), scripts/lib/market-analysis-numbers.mjs, scripts/build-market-snapshot.mjs(BZ=F 등 심볼), scripts/fetch-telegram-digest.mjs·scripts/lib/telegram-*(어조·태그 분류), src/data/contracts/page-timeline.js(정책 문구만) | P1719 해설 검증기·재시도·직전본, P1720 장중 속보 칸 생산, P1721 환율·브렌트 최신성, P1722 텔레그램 어조·태그 |
| R2 판정·통합 | src/domain/briefing/**, src/domain/market/**(sector-map 제외), src/domain/themes/group-strength.js(한국 테마 대형주 기여 문장만), src/ui/components/market-regime.js·daily-loop.js·korea-participation.js·breadth-board.js·home-kpi-trend.js·macro-board.js·rates-fx 관련, src/ui/navigation/page-flow.js(또는 page-flow가 있는 위치), index.html의 홈·시장 상태 문구 | P1723 한국 충격 서술·브리핑 가중치, P1724 직전 종가 대비 변화 KRX 비교·notCompared 표시, P1725 기준일 섞임(원/달러·한국 축 칩·브리핑 비교), P1726 유가 단기 병기·브렌트 이상치 보류, P1727 시나리오 부합 정의·원화 보합권·다음 단계 링크 |
| R3 실시간·AI·뉴스 화면 | js/aio-data.js의 실시간 시세 구간(약 :14900-15050)과 뉴스 surface(약 :11300-11520), src/ui/pages/entity.js 히어로 등락률, src/ui/pages/news.js·src/domain/news/**(화면 쪽), js/aio-chat.js, src/ai/**(market-content 등 맥락), src/ui/pages/ai*.js 패널 | P1728 한국 실시간 등락률 전일종가 검증, P1729 AI 맥락(collectMarketInputs·KOSPI 헤더·3흐름·뉴스 창 명시·장중 칸·패널 기준 시각), P1730 장중 속보 칸 화면 |

## 보고 형식 (한국어)
- 표: `항목 | 처리(완료/부분/보류) | 변경 file:line | 확인(fixture·재현·gate)`.
- 다른 작업자 구간에 대한 요청.
- 배포 후 확인할 것.
