# 1차 통합본 화면 검수 — 2026-11-04

대상: worktree `.claude/worktrees/integration-20261104`, HEAD `140ba22c`. 이 worktree의 파일은 고치지 않았다.
기준: `_artifacts/orchestration-20261104/QUALITY-BAR.md` 9항.
범위: 20 라우트 × {데스크톱 1440×900, 아이패드 768×1024, 휴대폰 390×844} × {라이트, 다크} = 120페이지. 페이지마다 앱 스크롤러를 구간별로 찍고, 접기를 모두 연 상태로 한 번 더 찍었다. 오버레이(AI 패널 열기·닫기, 용어 사전, 단축키 도움말, 휴대폰·아이패드 메뉴)와 용어 hover는 따로 찍었다.
도구: scratchpad `screen-audit.mjs`가 자동 후보를 냈고(296건, `audit-integration/AUTO-CANDIDATES.md`), 스크린샷은 사람 눈으로 봤다.

스크린샷 경로의 `$A`는 `C:\Users\zmfhd\AppData\Local\Temp\claude\C--Projects-AIO\4c66393c-d3a2-43fc-9002-a19153fd36ee\scratchpad\audit-integration`, `$Z`는 같은 scratchpad의 `zoom`이다.

## 본 범위와 못 본 범위

- 눈으로 본 것
  - 휴대폰 라이트: 20개 라우트 전 구간.
  - 휴대폰 다크: 시장 상태·매크로·금리와 환율·테마·뉴스·스크리너 첫 4구간.
  - 데스크톱 라이트·다크: 전 라우트 첫 4구간(축소 시트).
  - 아이패드 라이트: 오늘·시장 상태·매크로·금리와 환율·뉴스·테마·스크리너·포트폴리오 첫 3구간.
  - 오버레이 전부, 용어 hover(매크로 데스크톱 라이트·휴대폰 다크).
- 자동 판정만 한 것: 나머지 구간 전부(대비·잘림·가로 넘침·고아 줄·이모지·부호·undefined 계열). 고아 줄 후보 148건은 flex 줄 안의 오탐이 많아, 눈으로 확인한 것만 아래에 올렸다.
- 못 본 것
  - 전환 애니메이션과 `prefers-reduced-motion`(검수는 reduce로 실행).
  - 키보드만으로 전체 조작(포커스 표시는 화면당 8개 표본만 확인).
  - 라이브 데이터 상태. 로컬 public-data를 썼다.
- 환경 탓(결함 아님)
  - 외부 요청을 막아 SPY·종목 차트가 '시세를 받아오지 못했습니다'로 나온다.
  - AI 패널에 '지금은 답변할 수 없음'이 뜬다.
  - 콘솔에 `net::ERR_FAILED`·`proxy-primary warn→error`가 찍힌다.
  - 페이지 오류(pageerror)는 0건이었다.
  - 탭 3회 왕복의 차이는 첫 바퀴에 접기가 열려 있던 탓이고, 2~3바퀴는 같았다.

## 결함 목록

우선순위: 상 = 읽을 수 없거나 화면이 깨짐 · 중 = 숫자 불일치·원칙 위반 · 하 = 다듬기. 소유는 파일을 바꾼 세션이나 그 영역을 맡은 세션이다(git log 기준).

| # | 우선 | 화면 | 뷰포트 / 테마 | 스크린샷 | 문제 | 소유 |
|---|---|---|---|---|---|---|
| 1 | 상 | 뉴스 '뉴스가 모이는 곳', 금리와 환율 '원화는 왜 움직였나' | 휴대폰(≤743) 라이트·다크 | `$A\phone-light\market-news__phone__light__01~03.png`, `fxbond__phone__light__03~06.png` | 해석 문단이 폭 4px 열에 한 글자씩 세로로 쌓여 화면 3~4개 높이를 차지한다. 원인 [확인]: `src/ui/styles/responsive.css:696`의 휴대폰 1열 규칙(명시도 1,1,0)이 `:680`의 2열 규칙(`:is(…) :is(…)`, 1,2,0)을 이기지 못한다. 그래서 `minmax(220px,300px) 1fr`가 390px 화면에도 그대로 적용된다. 7a5277d3(11/01)부터 있었고 main에도 같은 규칙이 있다(회귀 아님) | ui-states (responsive) |
| 2 | 상 | 뉴스 '시간대별 시황'(접기 안 헤드라인 목록) | 데스크톱·아이패드·휴대폰 다크 | `$Z\news-slot-dark.png` | 헤드라인 링크가 브라우저 기본 파란색(대비 1.85)이다. 목록 점이 카드 밖 왼쪽 여백에 찍히고, 시각과 제목 사이 간격이 없다('11:43미 중간선거…'). 회차 머리도 붙어 있다('12:00 회차11/4 06:00~12:00헤드라인 6건'). `market-timeline.js`·`v2-today.css`의 스타일이 다크에서 빠진 것으로 보인다 [추정] | ui-states (tokens) |
| 3 | 상 | 테마 'AI 설비투자 100달러의 흐름' 띠 | 데스크톱·아이패드 다크 | `$Z\capex-dark.png` | 띠 색이 밝은 형광 청록·살구색이고 그 위 흰 라벨의 대비가 1.82~1.90이다. 카드 제목 '$50 / $100'이 두 줄로 깨지고, '시설·건설'도 줄이 갈린다 | theme-sector (theme-strength.js, regime-quality.css) |
| 4 | 중 | 뉴스 '시간대별 시황'·'전체 뉴스'·'시장 신호 — 지표·목표주가·실적' | 전 뷰포트 | `$A\phone-light\market-news__phone__light__07.png` | 접힌 상태의 카드가 제목과 가는 선만 있는 빈 카드로 보인다. 펼침 표시(▶/⌄)가 없어 누를 수 있는지 알 수 없다 | ui-states |
| 5 | 중 | HY 스프레드 20일 변화 (알려짐 + 추가) | 전 뷰포트 | `$A\phone-light\signal__phone__light__03,06.png`, `sentiment__phone__light__00.png`, `macro__phone__light__05.png` | 같은 지표가 **+31bp(심리·매크로 신용 장)·+34bp(시장 상태 표)·+40bp(시장 상태 '금리와 신용')·+25bp(시장 상태 문단, 기간 불명)**으로 나온다. 같은 카드 안에서도 수준이 343bp와 346bp로 다르다. 알려진 +32/+34보다 범위가 넓다 | data-refactor |
| 6 | 중 | 미 10년물 20거래일 변화 | 매크로·금리와 환율 | `$A\phone-light\macro__phone__light__02,05.png`, `fxbond__phone__light__00.png` | 매크로 6요인은 '-32bp', 금리 장은 '10년 5.31 → 4.91% (10/5→11/2, -40bp)', 곡선 장은 10년 4.95%(11/3)다. 시작값 5.31%와 곡선의 1개월 전 값도 맞지 않아 보인다 [추정] | data-refactor |
| 7 | 중 | 나스닥 하루 변화 | 오늘·브리핑 | `$A\phone-light\home__phone__light__00.png`, `briefing__phone__light__00,03.png` | 오늘 카드의 '나스닥 100'에만 하루 등락률이 없다(나머지 셋은 있다). 브리핑 첫 문단은 '나스닥100 -0.7%', 같은 화면 등락 표는 '나스닥 종합 +0.8%'로 방향이 반대다 | data-refactor |
| 8 | 중 | 유가 하루 변화 | 오늘·브리핑·매크로 | `$A\phone-light\home__phone__light__01.png`, `briefing__phone__light__03.png` | 오늘의 핵심은 'WTI -7.7%, 브렌트 -8.7%', 같은 화면 시세 칩은 'WTI -0.44 (-0.46%)', 브리핑 등락 표는 'WTI —(1일 없음), -3.8%'다. 기준일 표시가 없어 셋이 다른 날이라는 것을 알 수 없다 | data-refactor |
| 9 | 중 | 시장 상태 '다음 주 판단을 바꿀 일정' | 전 뷰포트 | `$A\phone-light\signal__phone__light__01.png` | 1번 항목이 '11/3(화) 미국 중간선거'다. 11/4 화면에서 이미 지난 일정이 '다음 주' 목록 맨 위에 있다 | data-refactor |
| 10 | 중 | 시장 상태 판정 표 'AI·반도체 집중' 행 | 전 뷰포트 | `$A\phone-light\signal__phone__light__03.png`, `$A\tablet-light\signal__tablet__light__02.png` | '확인 불가 · 최신 관측 없음 · — · —'로 값이 없는 행이 판정 표에 그대로 있다(원천 없는 위젯). 새로 넣은 행이므로 데이터가 생길 때까지 숨기거나, 공용 빈 상태를 써야 한다 | data-refactor |
| 11 | 중 | 브리핑 '지난 24시간' 이야기 목록 | 휴대폰·데스크톱 | `$A\phone-light\briefing__phone__light__00.png` | 둘째 항목에 제목과 본문이 없고 무게 막대와 '▶ 관련 보도 1건'만 있다 | ui-states / 브리핑 소유 미정 |
| 12 | 중 | 오늘의 핵심·뉴스 | 전 뷰포트 | `$A\phone-light\home__phone__light__01.png` | 영문 헤드라인이 번역 없이 나온다('Nvidia Stock And 2 US Growth Stocks Facing A Treasury Yield Reset', 'AMD forecast eases AI spending fears…'). 같은 기사가 뉴스 화면에서는 한국어 제목이다 | data-refactor (뉴스 선택) |
| 13 | 중 | 오늘 시세 칩 줄 | 전 뷰포트 | `$A\phone-light\home__phone__light__01.png` | 모든 칩의 값과 변화 사이에 정체 모를 '◦' 점이 있다('4.95 ◦ ▲+5.8bp'). '공포·탐욕 19 극단 공포 전일 0'은 전일 값이 0인지 변화가 0인지 모호하고, 심리 화면도 '전일 0, 5일 -14'로 같다 | ui-states |
| 14 | 중 | 기술적 분석 지수 차트 | 전 뷰포트 | `$A\phone-light\charts__phone__light__00~03.png` | 세로축에 천 단위 쉼표가 없고('40000', '27192'), 둥근 눈금 사이에 의미 표시 없는 값(27192·7483·504·2747·5594·645)이 섞여 있다. 오른쪽 끝 '50일선' 라벨이 가격선과 겹친다 | ui-states (차트) |
| 15 | 중 | 테마 섹터 1주 / S&P 500 지도 / 시나리오 문단 | 전 뷰포트 | `$A\phone-light\themes__phone__light__00,02,06.png` | 머리말 '주도 단계 테마 · 1개월 헬스케어 +7.0%'와 '테마 시나리오' 문단 '최근 1개월 가장 오른 곳이 필수소비재(+10.2%)'가 같은 1개월 1위를 다르게 말한다(분류 기준이 다르다면 화면에 그 차이가 없다). 시나리오 문단은 20px 굵은 글씨 7줄이라 짧은 해석 원칙을 넘는다 | theme-sector |
| 16 | 중 | 스크리너 대상 수 | 데스크톱·휴대폰 | `$A\desktop-light\screener__desktop__light__00.png`, `$A\phone-light\screener__phone__light__00.png` | 한 화면에 '920종목 중 914종목 계산', '균형 통과 333종목', 상세 패널 '전체 170위 / 823'이 함께 나온다. 분모 넷이 무엇인지 화면에서 이어지지 않는다 | 스크리너 (소유 없음 → 2차 C 묶음) |
| 17 | 중 | 종목 개요(선택 전) '스크리너 순위 상위, 미국' | 휴대폰·데스크톱 | `$A\phone-light\ticker__phone__light__00.png` | 버튼이 ROP·ACN·PAYC·RRC·APPN인데, 스크리너 표의 1~5위는 NVDA·AAPL·MSFT·LLY·WMT다. '상위'의 기준이 다르다 | 종목 (소유 없음 → 2차 D 묶음) |
| 18 | 중 | 재무 공시(종목 선택 전) | 전 뷰포트 | `$A\phone-light\fundamental__phone__light__00.png` | 화면에 '종목 선택 전' 알약과 빈 'SEC 연간 공시 요약' 접기만 있다. 공용 빈 상태(`renderDataState`)와 종목 고르기 행동이 없다 | ui-states |
| 19 | 중 | 교과서 말투 잔재 | 전 뷰포트 | 뉴스 `$Z\news-slot-dark.png`(다음에 볼 것), `$A\phone-light\atlas__phone__light__02.png`, `principles__phone__light__03.png`, 접기 `principles__desktop__dark__open__02.png` | 문구: '다음에 볼 것: …확인해야 합니다/살펴봐야 합니다'(실적 요약), '이 분야를 읽는 순서'·'이 분야를 읽는 핵심은'(산업 지도), '먼저 알아둘 개념'(개념·분석), '…국면을 읽는 방법'(개념 목록 2곳), '세는 법'(뉴스 접기), '차트 읽기'(기술적 분석 6곳) | ui-states (문구) / 2차 E 묶음 |
| 20 | 중 | 포트폴리오(빈 상태) | 전 뷰포트 | `$A\phone-light\portfolio__phone__light__00.png` | 머리의 '종목 추가'와 빈 상태의 '첫 종목 추가'가 같은 동작으로 겹친다. '▶ 보안' 접기가 제목 위에 홀로 떠 있다 | ui-states / 2차 D 묶음 |
| 21 | 하 | 매크로·브리핑 발표 띠 | 휴대폰·데스크톱 | `$A\phone-light\macro__phone__light__00,10.png`, `briefing__phone__light__03.png` | 현재값 세로선이 라벨 글자를 가른다('끈|적함'). 고용 띠 눈금이 '5만7.5만'으로 붙는다. '조금 높음' 잘림은 알려진 항목 | ui-states (release-zone-bar) |
| 22 | 하 | 시장 상태 '지표를 같이 놓고 보면' 사분면 | 휴대폰 | `$A\phone-light\signal__phone__light__06.png` | '금리와 신용' 칸의 현재 위치 점이 라벨 '성장 걱정' 글자 위에 찍힌다 | data-refactor |
| 23 | 하 | 테마 플레이북 산점도 | 휴대폰 | `$A\phone-light\themes__phone__light__07.png` | 축 제목 '긴 추세, 지수 대비 (6개월) →'가 사분면 라벨 '추세 속 조정'과 겹친다. 점 라벨 '크립토 긴 추세 -39.0%p'가 축 근처에 걸친다 | theme-sector |
| 24 | 하 | 테마 S&P 500 지도 섹터 라벨 | 휴대폰 | `$A\phone-light\themes__phone__light__02.png` | '산업재 +0…', '필수소비재…', '에너지 …'가 말줄임으로 잘린다 | theme-sector |
| 25 | 하 | 대비 AA 미달(라이트) | 데스크톱·아이패드·휴대폰 라이트 | `$A\desktop-light\signal__desktop__light__01.png`, `macro__desktop__light__01.png`, `technical__desktop__light__open__00.png`, `guide__desktop__light__open__01.png` | 칩과 보조 글자의 대비가 기준에 못 미친다. `.sx-chip`·`.regime-state`·`.macro-tally-chip` '양호/부담' 4.21~4.25, `.xr-tag`·`.xr-choice-flag` 4.21, `.briefing-event-when` 4.25, `.kr-index-move` '하루 -3.6%' 3.21, `.kr-badge` '한국' 3.81, 도움말 초록 라벨 4.13, 스크리너 '검증 보기 ›' 4.25 | ui-states (tokens) |
| 26 | 하 | 포커스 표시 | 전 화면 표본 | `$A\…\report.json` focusMissing | 용어 표시(`.aio-term`, tabindex=0)와 `<summary>`, 매크로 '근거' 버튼은 포커스해도 outline이나 box-shadow가 없다. 화면당 8개 표본 중 48개 화면에서 걸렸다. 프로그램 포커스로 잰 값이라 키보드로 다시 확인해야 한다 [추정] | ui-states |
| 27 | 하 | 용어 hover 팝오버 위치 | 데스크톱 | `$Z\term-macro-desktop-light.png` | 팝오버가 용어보다 왼쪽(사이드바 위)으로 치우쳐 뜬다 | ui-states (term-marks.js) |
| 28 | 하 | 대가 보유 종목 막대 라벨 | 휴대폰 | `$A\phone-light\masters__phone__light__01.png` | 'AXP, American Expres…', 'GOOGL, Alphabet Inc. …' 등 회사 이름이 잘린다. 티커만 두고 이름은 hover로 옮기면 된다 | 2차 E 묶음 |
| 29 | 하 | 스크리너 검증 안내 띠 | 휴대폰 | `$A\phone-light\screener__phone__light__00.png` | '과거 검증으로는 아직 효과를 판단할 수 없습니다 — 순위는 확인할 …'이 잘려 끝 문장이 안 보인다 | 2차 C 묶음 |
| 30 | 하 | 개념·분석 카드 줄 | 휴대폰 | `$A\phone-light\principles__phone__light__00.png` | 둘째 카드('중급 · 돈과 …')가 오른쪽 끝에서 잘린다. 가로 스크롤 표시가 없다(자동 판정 off-right, 오른쪽 556~781px) | 2차 E 묶음 |
| 31 | 하 | 실적 요약 상표 기호 | 전 뷰포트 (접기 안) | `$A\desktop-light\market-news__desktop__light__open__03.png` | 'Scorpio™', 'PCIe®', 'Leo Smart Memory Controller™'의 ™·®가 이모지 게이트 범주(Extended_Pictographic)에 걸린다. 일부 기기에서는 이모지 글리프로 보일 수 있다 | 뉴스 event-briefs 생산기 |
| 32 | 하 | 브리핑 머리 | 휴대폰 | `$A\phone-light\briefing__phone__light__00.png` | 날짜 줄과 제목 사이에 '오늘' 한 단어가 따로 떠 있다(뉴스·시장 폭·투자 심리·금리와 환율도 '시장 상태'·'매크로' 같은 상위 이름이 같은 자리에 있다). 보조 라벨이다 | ui-states |
| 33 | 하 | 오늘 '크게 움직인 종목' | 전 뷰포트 | `$A\phone-light\home__phone__light__02.png` | 미국 대형주 사이에 일본 종목 '285A.T -15.8%'가 섞여 있다(미국 우선) | data-refactor |
| 34 | 하 | 휴대폰 단축키 도움말 | 휴대폰 | `$A\phone-light\overlay-shortcut-help__phone__light.png` | 키보드가 없는 휴대폰에서도 '?'로 키보드 단축키 표가 열린다(실제로 열리는 경로는 확인하지 않았다) | ui-states |
| 35 | 하 | 차트 날짜 축 형식 | 금리와 환율 vs 기술적 분석·시장 폭 | `$A\phone-light\fxbond__phone__light__01.png`, `charts__phone__light__00.png` | 같은 앱에서 날짜 축이 '25.10 / 26.11'과 '26년 1월 / 7월' 두 가지로 쓰인다 | ui-states (차트) |
| 36 | 하 | '거시' 단어 | 매크로 머리말·도움말·용어 사전 분류 | `$A\phone-light\macro__phone__light__00.png`, `guide__phone__light__00.png`, `overlay-glossary__phone__light.png` | 화면 이름은 '매크로'인데 본문 머리말 '거시 6요인', 도움말 '심리·거시·금리', 용어 분류 '거시·금리·외환 131'이 남아 있다. 화면 이름이 아닌 일반 낱말이라 소유자 결정 범위 안인지 확인이 필요하다 | 소유자 확인 |

## 알려진 항목 (오케스트레이터 목록)

| 항목 | 이번 검수 |
|---|---|
| 주소 없는 `theme-detail`이 테마 목록으로 열림 | 재현됨 (`$A\phone-light\theme-detail__phone__light__00.png` = 테마 목록과 같음) |
| 휴대폰 매크로 '지금 숫자' 값 열 3줄 | 따로 찾아보지 않음 |
| 매크로 발표 띠 '조금 높음' 390 잘림 | 재현됨. 뉴스 '주요 발표 요약'에서도 같음 (#21) |
| HY 20일 +32/+34bp | 재현됨. +31·+40·+25bp까지 있음 (#5) |
| `page-sources.js:26` '풋/콜 비율: Cboe' | 접힌 '데이터 출처'는 열어 확인하지 않음 |
| 판정 밖 SMH | 재현됨: 오늘 카드 '반도체 SMH', 브리핑 '반도체(SMH)', 실적 요약 '반도체(SMH) -2.7%', 기술적 분석 '반도체(SMH)', 'SMH 차트 열기', 시장 상태 포커스 표본 'SMH' |
| freshness 원장 첫 refresh 전 'unknown' | 헤더 배지는 '11/3 종가 기준'으로 보임. 'unknown' 글자는 화면에서 못 봄 |

## 소유별 요약

- **ui-states** — 결함 18건.
  - 상: #1 휴대폰 2열 규칙, #2 다크 시황 링크.
  - 중: #4 빈 카드 접기, #11, #13, #14, #18, #19, #20.
  - 하: #21, #25~27, #32, #34, #35.
- **data-refactor** — 결함 10건.
  - 중: #5 HY, #6 10년물, #7 나스닥, #8 유가, #9 지난 일정, #10 AI·반도체 빈 행, #12 영문 제목.
  - 하: #22, #33.
- **theme-sector** — 결함 4건.
  - 상: #3 설비투자 띠.
  - 중: #15.
  - 하: #23, #24.
- **2차 배치(소유 없음)** — 결함 5건.
  - 중: #16 스크리너 분모, #17 종목 상위 목록.
  - 하: #28~#30.
- **기타** — #31 뉴스 생산기, #36 소유자 확인.
