# 실제 화면·대표 입력·AI 결과 — 4차 기록

2026-10-12 KST. Chrome의 새 로컬 리뷰 origin `127.0.0.1:8948`을 사용했다. 기존 사용자 배포 탭·보유 데이터·키를 수정하지 않았다. 페이지를 실제 열고 읽고 입력/전송했다. AI 생성 답변은 0건이다.

## 직접 열린 화면과 측정

Desktop 실제 viewport1920×945. 각 route의 visible text/scroll height를 읽었다. 아래 높이는 당시 관측이며 고정 예산이나 영구 상태가 아니다.

|route|보이는 글자|페이지높이px|관측|
|---|---:|---:|---|
|home|2959|2761|혼조3우호/3부담,집중유지4/4,sector11행|
|briefing|2192|1851|10/9종가,변화→해석→확인,7일일정|
|market-news|5742|4009|8시cutoff24h,5중요사건,영어기사다수|
|signal|6128|5472|레이더상대위치와절대신용판정혼동가능|
|breadth|2391|2153|811개동일비중·ETF혼합명시|
|sentiment|1356|1251|CNN과자체합산공존|
|macro|4705|3875|성장/물가방향vs수준설명,근원물가이름부족|
|fxbond|2043|2446|curve/real/breakeven/FX기간분리|
|themes|3900|3177|daily등락vsRRG설명존재|
|theme-detail|5209|4585|themes host상세panel로표시(독립activepage와구분)|
|screener|3051|2557|US806rank,803조건대상,현재모델검증보류|
|portfolio|595|924|빈상태—KPI/개인정보안내반복|
|ticker(AAPL)|2196|2876|회사요약/stockread/legacy팩터반복|
|technical(AAPL)|454|876|8주기control,시세미수신typed오류|
|fundamental(AAPL)|2501|2207|6FY매출/이익graph,annualsource날짜|
|principles|2379|1248|서가394편,노트/칼럼수차이|
|masters|3111|1594|13F보고분기/제출일·법인보유설명|
|atlas|1088|1248|산업흐름/수익구조,live관측block미연결|
|guide|1720|1683|8개사용자질문·판정정의|

당시 desktop의가로overflow는모두0,보이는0크기canvas는없었다. 이것은모든차트의정상값수신·모든동작·가독성PASS가아니다. localprovider차트는미수신이많았다.

## 대표 종목·필터 입력

실제AAPL/NVDA/삼성전자/005930/247540/GOOG/0059300/999999/애플리케이션결과는 [ENTITY-FINDINGS](./ENTITY-FINDINGS.md)에표로기록했다. 정상요약의미국·한국신원과재무대체금지는확인했으며현재가는대체로미수신이다.

차트직접검색005930은raw005930일봉/hub로표시되어요약005930.KS와다름(E06). 이때원래999999.KS요약·재무유지라는'시장비교차트'안내도나왔다. 사용자입력이한국회사인데시장비교로처리되는이유를설명하지못한다.

스크리너의주식시장선택을실제키보드로미국→한국전환했다. 미국813모집단/806rank/327표시에서한국180/0rank/0표시로바뀌었다. 미국과한국검증분리는유지됐지만왜180종목이모두데이터부족인지,최신한국완료세션부족인지는대표안내에서명확하지않았다. 화면위'팩터세션2026-10-09'는미국날짜가남았다. [ENTITY gate report](./browser-gates/entity/browser-report.json)의6조합실패와일치한다.

실제보유개인자료는없고,테스트포트폴리오는offline함수의AAPL10/삼성90같은가상평가액을사용했다. 실제PIN생성·저장·백업이동은하지않았다. 암호화gate과실제개인금융자료검증은별도경계다.

## 숫자 근거 카드(P1643)의 추가 문제

|ID|검증·영향|권고|
|---|---|---|
|U01·P2|`value-basis.js:45~53,93~103`:일반title/data-basis의focusin만받고비초점요소에진입점없음. 실제signal의18개설명대상(12SVGtext+6section)이모두tabIndex<0.|필요한숫자에작고명시적focusable근거button;section전부tabstop추가는피한다. Tab/Enter/Escape와touch검사.|
|U02·P2|`value-basis.js:27,68~76`:data-stale-after-hours를검사하지만src/ui/index검색에서이속성을실제생산하는caller0.6개regimecard도parent관측attribute없음. '모든숫자시점/지연통일'은부분구현.|typed관측/source/currentness를공통card메타에서소비. 임의hour상한추가보다session/cadence기준.|
|U03·P2|`value-basis.js:14~18`:date-only를모두21:00Z로가정,UTC문자열시각은slice해timezone표시없이관측이라출력.한국종가/US서머타임의관측경과가틀릴수있음.|date-only는기준일로만표시하거나venue-awareclose사용;timestamp는KST/timezone명시.|
|U04·P2|`value-basis.js:56~62,64~89`:newanchor에show시oldaria-describedby정리없음,hide는기존description을통째로삭제. **static**,실제스크린리더반례미실증.|이전anchor정리·기존describedby보존/복원,focus이동/cleanupfixture.|
|U05·P3|sameanchor면showearlyreturn.값/title/관측시점이갱신되어도열린card본문은그대로일수있음. **static**.|관측revision변화/재open에서내용갱신.비활성route의분리anchor/resize/scroll상태도확인.|

## AI 질문: 모든19route의 실제 지원·전송 상태

17route에서질문입력·전송을실제로시도했고모두공용AI미준비안내와입력보존을확인했다. masters/guide는입력·전송이disabled이며'AI분석은주요분석페이지에서사용'안내다. 19번정상답변PASS가아니다. masters/guide의현재지원정책을늘리는제품결정도하지않았다.

|route|실제입력한대표질문·검증목적|결과|
|---|---|---|
|home|추세우호/시장폭부담을3문장,숫자기준일/모르는근거구분|미준비,입력보존|
|briefing|분배일/금리/금/소형주변화vs해석·비교기간|동일|
|market-news|중요뉴스원출처·발표시점vs수집시각|동일|
|signal|국면과3시나리오조건수·빠진근거|동일|
|breadth|811개/35%가S&P전체인가,ETF/리더십/분배일구분|동일|
|sentiment|CNNvs자체지수·stale혼합|동일|
|macro|성장/물가둔화vs물가부담,근원PCE/CPI,방향/수준|동일|
|fxbond|명목/실질/기대물가/CCC-B,관측일,원·엔방향|동일|
|ticker|AAPL수익률vs팩터순위,SEC기간·결측현금흐름|동일|
|technical|추세/3가격흐름,volume누락·진행봉·보류|동일|
|fundamental|AAPLannual/quarter·평균자본ROE·FCF결측|동일(당시화면005930인교차질문)|
|themes|XLREdaily상승vsRRG후행·기간/구성근거|동일|
|theme-detail|선택테마구성원·basis,선택없음/혼합시점추정금지|동일|
|screener|US/KR직접비교·모집단/비중/결측/현재검증|동일|
|portfolio|빈포트폴리오,AAPL/삼성예시통화·비중·보안/전송|동일|
|principles|은행신용→물가→주식,정적원리vs현재관측·반례|동일|
|atlas|HBM/광인터커넥트의역할/수익,확인관계vs가능성|동일|
|masters|13F보고/제출일·현금/공매도사각지대(질문계획)|disabled,입력불가|
|guide|가족용동선·판정보류·검증/AI전송(질문계획)|disabled,입력불가|

질문의원문은작업중도구기록에있고위표는목적을압축했다. 서버상생성답변·인용·grounding·실제usage가없으므로답변정확성/비용정산은미검증이다. 생성API를우회하거나개인키를쓰지않았다.

배포URL `https://ysnle.github.io/aio-screener/#home`방문은자동승인검토서비스가429/retry-limit으로거절했다. 위험판정이아닌검토서비스오류다. 다른브라우저·rawrequest·기존사용자탭으로우회하지않았다. 배포AI답변실증을마치려면정상승인상태에서별도재개해야한다.

## 브라우저 gate의 현재 결과

- [responsive report](./browser-gates/responsive/report.json):19routes×3viewport PASS. drawer/theme/AIinput/overflow를검증했다. 실기기Safari와모든문구의이해를인증하지않는다.
- [entity report](./browser-gates/entity/browser-report.json):3viewport×2theme중6개한국모집단조건FAIL. 다른AEHR합성시세·손실재무·3시나리오layout은실행됐다. 원래Claude35+19산출물은바이트보존했고새근거를이폴더에복사했다.
- 스크린샷일부는첫방문고지가보이는상태다. dim/overlay를콘텐츠의본래명암결함으로단정하지않는다. 도형overflowPASS와읽기품질은구분한다.
- 모바일에서문장단위줄바꿈이많고signal첫viewport는결론/교차설명으로차트까지보이지않는다. 기능오류는아니지만3초시각목표의제품WARN이다.

## 다음 실제사용 검증의 종료 조건

공용AI연결복구후동일질문세트를재사용해(1)화면entity/route/basis일치,(2)인용원문/발표일,(3)null을추정하지않음,(4)변화/조건수정확성,(5)특정매매지시·가짜확률없음,(6)첫사용자가짧게이해가능,(7)실제공용budgetusage를따로확인한다. 현재결과를정상AI품질PASS로승격하지않는다.
