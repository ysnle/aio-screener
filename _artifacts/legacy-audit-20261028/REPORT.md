# js/ 레거시 감사 — 사용자 피해 순위 (2026-10-28, v59.42)

읽기 전용 감사다. 코드·원장·생성물은 고치지 않았고 git도 쓰지 않았다. 이 문서는 이관 계획이며, 이 세션에서 코드를 옮기지 않는다.

## 처리 상황 (같은 날, 소유자 승인 뒤 이 세션에서)

소유자가 "빠른 수정 + 죽은 코드" 범위와 FRED 덮어쓰기 삭제를 승인해 아래를 처리했다. 원장에는 P2118~P2121과 R731, 정리 1건으로 기록했다(v59.42). 커밋·푸시는 하지 않았다. 브라우저 그룹을 포함한 affected QA(`qa-runner affected`)는 pass 140, cached 14, fail 0이었다.

| 항목 | 결과 |
|---|---|
| 1위 AI 하루 20회 브라우저 제한 | 삭제. 배지는 Worker `ai.client` 남은 횟수를 보여준다 (P2118) |
| 3위 `_syncYahooToFred` | 삭제 (P2119) |
| 7위 부팅 중 `updateDataStatus` | `typeof`로 확인 후 호출. 규칙 R731과 CI 검사 추가 (P2120) |
| 9위 한국 시총 칸 | `_enrichMarketCap`과 늘 비어 있던 열을 삭제 (P2121) |
| 6위 일부 | 예전 포트폴리오 표의 손실 부호와 등락 없음 색 (P2121). 행 생성 삭제·관심목록 단일 저장소는 남음 |
| R 키 | Ctrl/Cmd/Alt가 없을 때만 시세 새로고침 (P2121) |
| 죽은 코드 | 도식 9종과 빌더, 옵션 체인, `DATE_ENGINE.krxStatus`, 디버그 로그 함수, `_aioFetchLiveQuotes`, 빈 테마 상수 3개, `loadSidebarApiKey` 삭제 |

### 2차 배치 (2026-10-29, 원장 P2129~P2133과 정리 1건)

| 항목 | 결과 |
|---|---|
| 죽은 코드 2차 | 채팅 칩, 대화 기록 창, 머리말 주입기, `chatAppendMsg`, `_aioApplyEventFreshnessGate`, `calcLiveRS`, `_aioVixPercentile`·`vixRegime`, `_aioToggleWhiteSpace`, `applyTextSurfaceHygiene` 삭제. 붙잡던 검사는 동작·부재 검사로 바꿈 |
| 6위 포트폴리오 | 예전 행 생성기 삭제(진입마다 '(시세 미수신)' 행이 0.7~1.4초 보였다). 관심 종목은 `src/data/watchlist-store.js` 하나로 쓰며 tickers 없는 목록이 더는 지워지지 않음 (P2129) |
| 5위 현재성 가드 | DOM 쓰기 퇴역. 18개 화면 전후 글자 수 동일, 남은 효과였던 시장 심리 문단의 잘못된 툴팁 제거. 배너 갱신은 유지 (P2130) |
| 2위 AI 질문 단서 | `src/ai/intent/question-cues.js`로 이전, 영어는 단어 단위. 39개 질문 중 한국어 변화 0건 (P2131) |
| 4위 시장 판단 엔진 | 대체 분석 문장이 시장 상태 종합 판정을 따름, '?' 라벨·정책 정규식·선택 목록 이스케이프 (P2132). 엔진 자체의 riskScore 등은 감사용으로 남음 |
| 10위 재무 보고서 | 없는 EPS의 $0.00·가짜 Beat/Miss·0 막대, 순부채 0 처리, 동종 기업·업종 이스케이프 (P2133). 렌더러의 src 이전은 하지 않음 |
| 8위 텔레그램 | news-pipeline 세션이 맡음. 머리말 'N건'과 채널명 이스케이프 위치를 그 세션에 전달 |

남은 것:
- 스케줄러가 부르는 빈 함수 `fetchBreadthData`, `fetchAllFredData`(후자는 API 상태 칸에 FRED를 주기적으로 '오류'로 올린다).
- `renderDataQualityBadge`(테스트만 부름), 결정 헤더.
- 대화 기록 켜기/끄기는 지운 대화 기록 창이 유일한 UI였다. 지금은 켤 방법이 없다 — 제품 결정이 필요하다.
- 10위 렌더러 약 1,300줄의 src 이전, 4위 `computeMarketState`의 남은 자체 판정 필드 정리.

## 범위와 방법

- 대상: `js/` 10개 파일 3.86 MB. 각 항목은 파일 전체가 아니라 기능 묶음(cluster)이다. 뉴스 선별 코드(`js/aio-data.js`)는 news-pipeline 세션이 옮기는 중이라 뺐다.
- 줄 번호: 감사 도중 news-pipeline 세션이 `js/aio-data.js`를 11,214줄에서 8,436줄로 줄였다. 이 문서의 `aio-data.js` 줄 번호는 지금(8,436줄) 기준으로 다시 찾은 값이다. 다른 파일은 감사 시작 때와 같다.
- 수집: 함수 1,020개의 목록을 만들고, 각 함수를 누가 부르는지(js·index.html·src·테스트·CI)와 postmortem에 몇 번 나오는지 셌다. 파일 묶음별로 읽기 전용 에이전트 4개(Opus, medium)가 분석했다. 순위 1~10의 핵심 주장은 코드에서 직접 다시 확인했다(아래 "직접 확인" 표시).
- postmortem 한계: `BUG-POSTMORTEM.md`는 압축본이라 함수 이름을 거의 인용하지 않는다(`aio-core.js:<줄>` 인용은 10건, 모두 옛 줄 번호). 그래서 "결함 이력" 칸은 해당 영역의 제목·키워드가 맞는 항목 수다. **0건이면 과거에 안전했다는 뜻이 아니라 아직 기록된 적 없는 결함**이라는 뜻이다. 상위 1·3·5·8번이 여기에 해당한다.
- 피해 순위 기준: (틀린 값·문장이 화면에 나오는가) × (몇 화면·얼마나 자주) × (AGENTS 결정 위반 여부). 이관 비용은 같은 피해일 때만 순위를 가른다.

냄새(smell) 표기: **S1** 부분 문자열 키워드 매칭 · **S2** 한 일에 규칙 두 개 · **S3** 필터 전에 센 행 · **S4** 바깥 문자열을 이스케이프 없이 innerHTML에 넣음 · **S5** 설치 전 window 전역 호출 · **S6** 숫자·시각 대체값.

## 상위 10

| # | 레거시 영역 (위치) | 하는 일 · 화면 | src 소유자 | 결함 이력 | 냄새 (근거) | 죽은 코드 | 이관 비용 | 권고 |
|---|---|---|---|---|---|---|---|---|
| 1 | **AI 하루 20회 브라우저 제한** `js/aio-ui.js:105-416` | 질문별 모델 선택, localStorage 쿼터, 배지, 초과 확인창. AI 패널이 있는 8화면 전부 | 없음. 실제 한도는 Worker가 소유(`cloudflare-worker-proxy.js:673` 브라우저당 150회) | P855 (1건). 이번 결함은 미기록 | S2: `aio-ui.js:212` `dailyQueryLimit: 20`, `:362-375` 초과 확인창 vs Worker 150. Worker의 `remainingToday`는 아무도 읽지 않는다. 실제 전송 `aio-chat.js:4116-4119`가 `consumeLLMQuery()`를 기다린다(직접 확인). S1: `:197-198` 경계 없는 `/and\|also…/`, `/if\|when/` | 주석의 Haiku/Sonnet 설명이 낡음. `luna-medium`(`:116`)은 반환되지 않음 | S | **delete** — 브라우저 쿼터·확인창을 없애고 Worker의 남은 횟수만 표시. AGENTS "AI는 항상 사용"과 충돌 |
| 2 | **AI 질문 라우팅 키워드** `js/aio-chat.js:2482-3704`, `js/aio-core.js:4410-4991`, `:10115-10140` | 질문 의도·답 형식·뉴스/텔레그램 문맥·웹검색 여부 결정. 모든 AI 답변 | 부분: `src/ai/intent/taxonomy.js`, `src/ai/orchestrator/question-planner.js`(`aio-chat.js:2992`에서 사용) | 영역 5건 P1655, P1616, P1543, P898, P897. 같은 계열 P2116·P2114 | S1(직접 확인): `aio-chat.js:3029` `buy\|sell\|hold\|exit\|target`("buyback", "household", "existing"), `:3030` `per\|pbr\|roe`("performance"·"super" → 간단 답 형식으로 바뀜), `:3185` 텔레그램 티커 `indexOf`(한 글자 티커), `:3188` 키워드 `'엔'`("엔비디아"), `aio-core.js:10117` `now\|rate\|fed\|news`("know", "federal" → 웹검색을 써 월 $20 예산 소모), `aio-core.js:4920-4921`. S6: `aio-chat.js:2627-2645` `rev\|\|0` → 매출총이익률 0.0% | `_fetchDeepCompareData` 이후 FMP 분기 `aio-chat.js:~2578-2790` 도달 불가. `_autoNavigatePage` 결과 키 불일치(`:3147` `nav.target` vs `:3580` `page`) | M | **move** — src 의도 계층 하나로 합치고 단어 경계·토큰 매칭으로. 죽은 분기는 먼저 delete |
| 3 | **장중 값을 FRED 공식 값으로 덮기** `js/aio-data.js:7871` `_syncYahooToFred` | Yahoo `^TNX/^FVX/^TYX/^VIX` 장중 값을 `_fredData[DGS10…]`과 MacroStore에 검증 없이 써 넣음. 거시·금리 | 없음. 소비자 `src/ui/pages/market.js:207-209`는 이 값을 `FRED:<id>` 출처로 표시 | 0건(미기록) | S2: 장중 시세 경로와 공식 종가 경로가 한 칸을 같이 씀(직접 확인). S6: 이전 FRED 값이 없으면 `prevValue = yahooVal`이라 변화가 0으로 보임 | — | S | **delete** — 장중 값은 시세 칸에만 둔다. AGENTS "종가 기준"·출처 정직성 위반 |
| 4 | **두 번째 시장 판단 엔진** `js/aio-core.js:2363-3245` `computeMarketState` | risk·cyclePhase·actionPlan, regime 경고, 시장 분석 sink, 상단 시세 배지. AI 채팅(`aio-chat.js:2053,2409`), 홈 행동 계획(`src/ui/components/home-action-plan.js:10-11`) | 중복: `src/ui/components/market-regime.js`, `src/domain/briefing/market-read.js` | 9건 P1753, P1326, P1288, P1122, P852, P759 | S2: `src/app/bootstrap.js:463-464`(v57.50 C09)에 스크리너는 '위험회피', 시장 상태는 '혼조'로 갈린 사례가 적혀 있다. 스크리너만 고쳤고 AI·홈은 아직 레거시를 읽는다(직접 확인). S1: `:2673` `/(fed\|fomc\|rate\|…)/i`("corporate"). S4: `:3203` 포트폴리오 `p.ticker`를 `<option>`에 그대로 넣음. S3(추정): `:3076` "시세 N종"이 전체 수 | — | M | **move** — AI와 홈이 src 판정을 읽게 한 뒤 엔진 delete |
| 5 | **현재성 가드·텍스트 위생 계층** `js/aio-core.js:15024-16852` | 페이지 계약, 증거 매트릭스, `applyTextSurfaceHygiene`(부팅), `applyMarketCurrentnessGuard`(`:16708`, 시세가 올 때마다와 페이지 표시 때마다 실행) | 없음 | 2건 P1076, P841 | S1(직접 확인): `:15040-15050` id 부분 일치 선택자. `[id*="thesis"]`가 native `sentiment-synthesis`(`index.html:4057`, `src/ui/components/sentiment-board.js:215`)에 걸려 '혼합 출처' 표식을 붙인다. `:16752-16758`은 180자 이하 native 문장을 바꿀 수 있다(예외 검사가 요소 자신만 봄, `:16744`). sink마다 레이아웃 읽기(`:16719,16742`) | 감사 함수 7개가 테스트 전용(getPageContracts, runAuditRegistry 등) | M | **delete** — 가드를 은퇴시키고, 쓸 감사만 `aio-qa-audits.js`로 move |
| 6 | **포트폴리오 이중 규칙** `js/aio-workspace.js:382-1776`, `js/aio-ui.js:3460-3722` | 진입 폼, 예전 표 렌더, 가격 갱신, 관심목록 CRUD, 벤치마크 그래프. 포트폴리오, 종목(관심 추가) | 중복: `src/ui/pages/portfolio.js:505-514`(표), `src/data/watchlist-store.js:9-29`(관심목록), `src/ui/components/trade-journal.js:20`(통화) | 약 30건 P2099, P2095, P2094, P2070, P1455, P1280, P1187 | 손실 부호 누락(직접 확인): `ws:786` `pnlSign`이 손실이면 `''`, `:800` `Math.abs(pnl)`. S6: `:779` 일간 등락이 없으면 0 → 초록색. S2: 원화 판정 규칙 3개(`ws:588` 6자리=원화, `:944-947` `.KS/.KQ`만, trade-journal.js:20). 관심목록 쓰는 곳 2개(직접 확인): `ws:1498`은 `tickers` 없는 목록을 버리고 다음 저장에서 지운다. src `watchlist-store.js:26`은 고쳐서 남긴다. S3: `ui:3645` 벤치마크가 필터 전에 비중을 더함, `:3633` 통화 환산 없음 | `renderPortfolio` 행 생성은 native 표가 떠 있으면 버려짐 | M | **delete** 예전 행 생성. **move** 관심목록은 watchlist-store만 쓰게, 통화 규칙 하나로, 벤치마크는 portfolio.js로 |
| 7 | **부팅 중 설치 전 전역 호출** (여러 파일) | v59.x에서 src로 옮긴 함수가 `window.X`로 설치되기 전에 js/가 부름. 부팅(모든 화면) | 설치자: `src/app/compatibility-globals.js:94` → `src/ui/components/data-status-surface.js:250-253` | SW 영역 4건 P1901, P899, P784, P782. 이번 부팅 오류는 미기록 | S5(직접 확인): `aio-data.js:3010` 로드 시 `_querySWVersion()` → 응답 콜백 `:2987` `updateDataStatus()`. 설치는 `bootstrap.js:96`, 정적 모듈 그래프 평가 뒤라 그사이 SW 응답이 오면 `updateDataStatus is not defined`. 같은 계열: `aio-data.js:6474,6478,6497,6506` `updateDataStatusError`, `:8245` `setTimeout(autoUpdateMA, 5000)` → `fetchViaProxy`, `aio-core.js:10528,10539`(클릭 시). 스캔 결과 src가 설치하는 전역을 js/가 방어 없이 부르는 곳이 109곳(대부분 부팅 뒤 실행이라 안전). 같은 파일에서 `_reportApiOk`는 `typeof`로 방어하고 바로 옆 호출은 방어하지 않아 규칙이 섞여 있다 | — | S | **move** SW 버전 조회를 src/app로. 그 전에 `typeof` 방어 한 줄. 부팅 경로 호출을 막는 CI 게이트 제안 |
| 8 | **텔레그램 메모 연결** `js/aio-data.js:1280-1788` | 다이제스트 정규화, `SCREENER_DB.memo`에 메모 기록, 피드 렌더. 오늘(market-news), AI 스크리너 답(`src/ai/context/screener-query.js:294`) | 부분: `src/data/server-data-loader.js`, `src/data/providers/telegram-direct.js` | 21건(텔레그램 제목) P2040, P2016, P1776, P1711, P1544, P1503 | S1: `:1388` `_aioTelegramTextNames` 2자 이상 회사명을 본문 부분 문자열로 매칭 → 다른 회사 글이 그 종목 메모가 되고 AI가 "메모:"로 인용. S3: 머리말 "N건"이 상한을 자른 뒤 셈(`:~1711,1732`). S4: 채널명 미이스케이프(`:~1744`). S6: `:~1403` `Number(item.score\|\|0)\|\|0` | — | M | **move** — news-pipeline 세션과 같은 경계라 그쪽 작업이 끝난 뒤 이어서. `:1388` 매칭부터 고침 |
| 9 | **테마 데이터·폭 계산, 한국 테마** `js/aio-pages.js:456-1230`, `js/aio-kr-data.js:1-1181` | THEME_MAP/SUB_THEMES, `getThemePerf`, `calcSectorBreadth`, `showThemeDetail`(payload 다리), RRG 이력, 한국 테마 UI, `KR_STOCK_DB`. 테마·섹터, 종목 링크 | 부분: `src/ui/pages/themes.js`가 렌더, `src/domain/themes/kr-themes.js`, `bootstrap.js:390-398`이 전역을 읽음 | 약 24건 P2064, P1934, P1743, P1614, P1588, P1417, P1972, P1684 | S2: 상승 비율 규칙 두 개. `pages:792-796`은 값 없는 등락을 하락으로 치고 60% 커버리지를 요구한다. `themes.js:1642-1645`는 유한값만 쓴다. 라벨 `themes.js:1189`는 셈한 수가 아니라 전체 leader 수. 고장(직접 확인): `kr-data:666` `KR_STOCK_DB.length`인데 `:682`는 객체라 시총이 한 번도 기록되지 않아 테마 상세 시총 칸이 늘 "—". S2: `kr-data:229-256` 라벨 표가 src와 이중 | `calcLiveRS`(`pages:697`), `SUB_THEME_INSIGHTS`, `THEME_NARRATIVES(_META)` 정의만 있음. `THEME_INSIGHTS`는 빈 객체 | L(core·data·kr-data·src AI 문맥이 공유) | **move** 데이터를 src/domain/themes로. `_enrichMarketCap` 고치거나 delete. 죽은 상수 delete |
| 10 | **재무 보고서 렌더러** `js/aio-ui.js:1840-3117` (+ `js/aio-core.js:6460-8458` 재무 fetcher) | 헤더·SEC·재무제표·밸류에이션·동종·실적·다기간 렌더러 13개. 종목(fundamental) | 부분: `src/ui/components/fundamental-search.js:56-74,256`이 window 전역으로 이 렌더러들을 부름 | 렌더러 약 1건. fetcher P1961, P1538 | S6: `ui:2955-2956` EPS 없으면 `$0.00`, `:2952` 예상치 없으면 "Beat +0.0%", `:3048-3049` 차트가 0을 그림, `core:7107` `fin.netDebt \|\| 0` → EV/EBITDA가 진짜 비율처럼 나옴. S4: `ui:2625` 동종 심볼, `:2033` `p.sector` 미이스케이프 | — | L(약 1,280줄) | **move** 렌더러를 하나씩 fundamental-search 소유로. 대체값부터 "—"로 |

## 11~15위 (다음 후보)

| 영역 | 근거 | 권고 |
|---|---|---|
| 시세 적용·신선도 `js/aio-data.js:6647-7814` | S6 `:7599` 시각이 없으면 `\|\| now` → 나이 0이라 절대 stale로 표시되지 않음. 한국 종목도 미국 세션으로 판정(`:7593-7597`). `:6314` 세션 중 25%(한국 30%) 넘는 변동은 거부하고 옛 값 유지 | move: 한국 확인 경로부터 src/domain/market |
| 세션 시계·달력 사본 `js/aio-core.js:11637-12296`, `:13240-14452` | postmortem 22건으로 영역 중 가장 많다(P2100은 사본 4개를 고쳐야 했음). 한국 장 규칙 두 개: `:11650` 마감까지 장중 vs `:14104` 마감 30분 전부터 '시간외'(직접 확인). 다만 `DATE_ENGINE.krxStatus`는 호출자가 없어 지금은 잠복 | delete 죽은 krxStatus·currentWeekRange. DATE_ENGINE은 `src/domain/market/market-calendar.js`를 가리키게 |
| 심리 지표 fetcher `js/aio-data.js:8112-8436` | S6 시각 없음 → now(4곳)라 오래된 스냅샷이 신선해 보임. S2 put/call 경계 1.2/0.9/0.7 vs src 1.1/0.7(`src/domain/rules/thresholds.js:100`, 읽는 곳 없어 잠복). `autoUpdateMA` 두 번 예약(`:8245`과 `refresh-scheduler.js:218`) | move: src/data/providers/sentiment |
| 스크리너 별칭 덮어쓰기 `src/app/bootstrap.js:575` + `js/aio-data.js:1789-2107` | bootstrap이 `readAliases`를 직접 넘겨 `src/ui/pages/screener.js:2723`의 기본 병합(`mergeThemeAliases`, v57.50 I10)이 실행되지 않음(직접 확인). 테마 페이지의 "스크리너에서 보기" 링크가 손으로 쓴 별칭에만 의존 | move 별칭 표를 src/domain/screener로, bootstrap 덮어쓰기 제거 |
| 기술 지표 사본 `js/aio-core.js:12297-13239` | S2: 평평한 시계열이면 RSI가 100(`:12381`)인데 src는 50(`src/ui/components/stock-chart.js:39`). 신선도 10분(`:13018`) vs 15분(`:14562`) | move: src/domain/technical, RSI 하나로 |

## 지워도 사용자가 못 느끼는 죽은 코드 (한 번에 delete 배치)

모두 호출자가 없거나 결과를 아무도 읽지 않는다. 테스트·CI 문자열 고정(pin)은 같이 지워야 한다.

- `js/aio-ui.js:1177-1839` 도식 엔진. factor-radar만 살아 있고 나머지 sink id(`vis-briefing-*`, `vis-macro-*` 등)는 index.html과 src 어디에도 없음. `renderDataQualityBadge`(`:1128`).
- `js/aio-data.js:2313-2346` 옵션 체인(`fetchOptionSentiment` 호출 0, AGENTS 옵션 퇴역). CI 고정 문자열 `scripts/ci-runtime-contract-check.mjs:1110`도 같이 지움. `fetchBreadthData`(`:2684`)와 `fetchAllFredData`(`:2502`)는 아무것도 하지 않는데 `refresh-scheduler.js:212-213`이 아직 예약한다. `vixRegime`(`:6661`), `_aioVixPercentile`(`:6647`)도 대상.
- `js/aio-chat.js:3727-3754` 헤더 기록 버튼 주입기(대상 `.acp-header` 없음), `chatAppendMsg`/`chatRenderChips`(`:1143,1130`, 대상 id 없음), FMP 분기 `~2578-2790`. `js/aio-workspace.js:1858-1914` `openChatHistory`, `:1705-1770` `CHAT_DEFAULT_CHIPS`, `:20-21` `getApiKey`/`loadSidebarApiKey` 껍데기.
- `js/aio-core.js` 쪽:
  - 호출자 없음: `DATE_ENGINE.krxStatus`·`currentWeekRange`(`:14097,14111`), `_snap.num`(`:13807`), `_aioFetchLiveQuotes`(`:2099`), `_enableDebugLog`·`_disableDebugLog`(`:10489,10497`).
  - 대상 요소가 없어 아무것도 안 하는 `_aioApplyEventFreshnessGate`(`:5514`). 부팅 때 4번 돈다.
  - 개발 모드에서만 보이는데 부팅 때 16개 화면을 모두 그리는 결정 헤더(`:3246-4409`).
  - 테스트 전용 `window.AIO` export 19개.
- `js/aio-pages.js:697` `calcLiveRS`, 테마 상수 3개.

## 그대로 둘 것 (leave)

| 영역 | 이유 |
|---|---|
| 라우팅·버스 `js/aio-core.js:16853-17397` (`showPage`, `showTicker`) | postmortem 21건이지만 확인된 냄새가 없다. native 라우터가 생길 때까지 둔다 |
| 금고·암호화 저장소 `js/aio-core.js:10278-11636`, `js/aio-workspace.js:81-381` | 저장된 데이터와 KDF 이관이 걸려 비용 L이다. 지금은 `:10528,10539` 방어만 한다 |
| `DATA_SNAPSHOT` 리터럴 `js/aio-core.js:13476` | `/data-refresh`와 스크립트가 쓰고 파싱한다. 죽은 멤버만 지운다 |
| `chatSendUnified` `js/aio-chat.js:3995-4757` | 테스트 참조가 76개다. 2번(라우팅)과 transport를 먼저 떼어 낸다 |
| 화면 셸 부팅 `js/aio-ui.js:12-104, 430-1046` | 순서에 민감하다. 라우트 초기화를 맨 마지막에 옮긴다. 다만 `:3453` R 키가 Ctrl/Cmd를 확인하지 않아 Ctrl+R 새로고침을 막는 건 따로 한 줄로 고칠 만하다(직접 확인) |
| `js/aio-tests.js` 718 KB, `js/aio-qa-audits.js` 327 KB | 운영 페이지가 싣지 않는다. 라이브에서는 Pages 산출물에서 빠져 404가 나고 잡힌다(`public-artifact-manifest.json:44,56`). 사용자 피해는 없다. `tests/browser/`로 옮기는 건 정리 작업이다(참조 19곳) |
| `js/aio-glossary.js` | 순수 데이터다. ESM 데이터 모듈로 바꾸는 비용 S, 피해 없음 |

## 반복 결함 클래스별 분포 (상위 10 기준)

- **S1 부분 문자열 매칭**: 2, 4, 5, 8(+1, 셸 감시기 `aio-ui.js:3332`). 뉴스 밖에도 AI 라우팅과 텔레그램 메모가 같은 계열이다. 이관할 때 공용 단어 경계 매처(`aio-core.js:1143` `_wordHit`가 이미 있음) 하나로 모으는 게 가장 싼 예방이다.
- **S2 규칙 두 개**: 1, 3, 4, 6, 9. 대부분 "src로 옮겼지만 js 쪽을 지우지 않음" 형태다. AGENTS의 "이관하면 교체된 코드는 지운다"가 지켜지지 않은 자리다.
- **S5 설치 전 전역**: 7. v59.16~59.41 이관이 만든 새 클래스다. 이관이 계속될수록 늘어난다.
- **S6 대체값**: 2, 6, 10과 11~15위의 시각 대체값. "값 없음"이 0·지금 시각으로 바뀌어 진짜처럼 보인다.

## 문서와 코드가 어긋난 곳

- `_context/CODE-MAP.md`의 `js/aio-core.js`(`~367`), `js/aio-data.js`(`~436`), `js/aio-ui.js`(`~485`) 줄 번호가 모두 낡았다.
  - core는 23,704줄까지 인용하지만 실제는 17,397줄이다.
  - data는 `fetchLiveQuotes`를 13212줄로 적었지만 지금은 5992줄이다.
  - ui는 5,723줄로 적었지만 실제는 3,839줄이다.
- `SCREENER_DB`는 881행이 아니라 1,141행이다. `LLM_MODELS`는 Claude가 아니라 gpt-6-luna다.
- 이제 그 파일에 없는 함수들이 CODE-MAP에 남아 있다:
  - 옮겨감: `computeTradingScore` → `src/app/score-entry-points.js`, `REFRESH_SCHEDULE` → `src/app/refresh-scheduler.js`.
  - 없어짐: `renderSellPressurePanel`, `classifyMarketRegime`, `chartDataGate`, `vixToPercentile`.
- `route-owners.json`은 19개 라우트가 모두 native 렌더라고 적는다. 그런데 레거시만 쓰는 DOM이 남아 있다. 그 결함 판정은 각 항목 아래와 같다.
  - `#mp-*` 펄스 바(`aio-pages.js:21-247`): 시장 상태 fallback 경계 60/30이 기준 경계 `aio-core.js:13845`의 40/55와 다르다(S2).
  - `#earnings-calendar-body`(`aio-pages.js:250-455`): 상태 줄의 건수가 보이는 주가 아니라 스냅샷 전체다(S3, `:314`).
  - `fund-rpt-*` 재무 섹션: 10위.
  - `pf-benchmark-chart`: 6위.

## 권장 순서

1. 작은 비용으로 피해를 바로 없애는 것(각 S): 1위 브라우저 쿼터 delete, 3위 `_syncYahooToFred` delete, 7위 SW 조회 방어와 이관, `aio-ui.js:3453` R 키, 9위 `_enrichMarketCap`.
2. 죽은 코드 delete 배치 하나. 동작 변화가 없어 리뷰가 쉽고 `js/`가 줄어든다.
3. 2위 AI 라우팅과 4위 시장 판단 엔진. 둘 다 AI 답변 품질과 직결되고 src 소유자가 이미 있다.
4. 5위 현재성 가드 은퇴, 6위 포트폴리오 정리.
5. 8위 텔레그램(news-pipeline 세션이 끝난 뒤), 9·10위의 큰 이관.

각 단계는 AGENTS 변경 흐름대로 `record-fix`로 기록하고, 고친 결함 클래스마다 실행 게이트를 붙인다. 예: js/에서 src 설치 전역을 방어 없이 부르면 실패, 키워드 매처는 단어 경계 필수.

## 증거 파일

스크래치 경로 `C:\Users\zmfhd\AppData\Local\Temp\claude\C--Projects-AIO\0286b566-b920-43e7-bc51-4d7504ca9603\scratchpad\`:
- `inv.json`: 함수 1,020개의 참조·postmortem 수.
- `globals.mjs`: 설치 전 전역 스캔.
- `aioexp.json`: `window.AIO` export 222개의 참조 수.
- `core.txt`, `glob.mjs`, `dead.mjs`, `pm.mjs`.

이 경로는 세션 전용이라 오래 보존되지 않는다.
