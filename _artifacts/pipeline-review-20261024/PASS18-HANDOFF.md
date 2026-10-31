# PASS18 — 거시·테마 의미 계약과 잔여 신규 파일

2026-10-29. 주 담당자가 직접 읽고 검토했다. 제품 수정, 생산자 실행, 외부 요청, commit/push/deploy 없음. 순수 함수 반례는 `reproduce-pass18.mjs` → `pass18-reproductions.json`으로 재현했으며 exit 0. 실제 운영 발생 빈도와 브라우저 표시를 검증했다는 뜻은 아니다.

## 판독 범위

본문 전체: `src/domain/macro/`의 indicators, treasury-curve, taylor-rule, liquidity-growth, long-history, cross-asset-relations, macro-signals, rates-fx, macro-read 9개; `src/domain/themes/`의 rrg, kr-themes, group-strength, ai-capex-flow 4개; `scripts/producer/macro-history.mjs`; 신규 `src/domain/market/move-attribution.js`. 합계 15개. themes 나머지 두 파일은 PASS17 판독 기록에 있다.

부분 소비자 추적: macro-board의 거시/금리/자산관계 연결, themes.js:434 한국 테마 렌더, macro-crossroads의 물가·정책 입력과 조건. 이 소비자 파일 전체를 읽었다고 세지 않는다. move-attribution이 현 인벤토리에 존재하므로 PASS17의 시장 도메인30개는 당시 판독 집합이며 현재 전체 파일 수로 고정하면 안 된다.

## 확정된 계산·표현 불일치

### P18-INFLATION-01 — 하나의 지표로 ‘두 지표 모두’ 조건 충족

`macro-signals.js:93–105`는 하나만 공개돼도 그 방향을 사용하고 `single:true`를 반환한다. macro-read와 macro-crossroads의 조건 소비자는 방향을 쓰면서 두 물가지표가 모두 같은 방향이라는 조건의 결측 여부를 보존하지 않는다. PCE pace=1, yoy=3, CPI 없음 → down/single=true → softland 첫 조건 true 재현. 단일 지표 방향 자체는 명시된 설계지만 이를 두 지표 교차 확인으로 승격하는 것은 다른 의미다.

개편: 관측 방향과 조건 충족을 분리하고, 조건별 필수 지표 집합을 선언한다. 둘 다 요구하면 missing으로 보류하거나 조건 문구를 실제 관측 집합에 맞춘다. 회귀: PCE만/CPI만/양쪽 동일/상반/한쪽 보합, 단위와 관측월 다른 경우. met-count에 unknown을 넣지 않는다.

### P18-CURVE-01 — 과거 공식 스프레드가 최신 수익률 곡선을 뒤집음

`rates-fx.js:264–267`은 5개 만기 날짜가 같으면 sameCut으로 표시하지만 `t10y2y`의 날짜를 확인하지 않고 우선한다. 10월28일 2Y=4%, 10Y=5%와 1월1일 공식 spread=-1을 주면 최신 날짜/sameCut=true/‘역전’이 동시에 출력된다. macro-board에서 buildRatesFx를 사용한다. sameCut의 날짜 집합은 빈 날짜를 제거하므로 일부 만기 날짜 누락도 별도 취약점이다.

개편: 모든 leg와 spread의 기준일을 함께 검증하고 같은 날 공식 spread만 우선한다. 그렇지 않으면 동일 날짜 leg 차이를 사용하거나 보류한다. treasury-curve와 중복된 곡선 계산을 단일 계약으로 묶는다. 회귀: 일치/불일치/누락/미래 날짜 및 공식값과 leg 계산 충돌. 구체 UI 영향은 브라우저 미실행.

### P18-RELATIONS-01 — 관측 불가를 ‘평소 관계’로 표현하고 서로 다른 기간 비교

`cross-asset-relations.js`는 자산별 독립 20거래일 변화에서 공통 시작/끝을 요구하지 않는다. SPX/TNX 끝9월11일, 금 끝8월7일, WTI/TLT/DXY 없음으로도 available=true와 ‘유가·금리·주식·장기채·금·달러는 평소 관계에서 크게 벗어나지 않았습니다’를 반환했다. 단순 through 상한은 실제 관측 끝을 일치시키지 않는다. macro-board:1208 및 macro-crossroads 소비 경로 확인.

개편: 관계별 필요한 pair, 동일 기간, 관측 가능 여부를 반환한다. 미관측 관계와 검사했지만 기준 미달인 관계를 구분한다. 전체 정상 문장은 필요한 모든 관계를 실제 검사한 경우에만 사용. 회귀: 자산 결측, 오래된 마지막값, 중간 거래일 누락, 혼합 시장 휴일, 동일 기간 정상/이상.

### P18-KRTHEME-01 — 발견한 행 수를 측정 표본으로 세고 오래된 값을 최신 날짜로 승격

`kr-themes.js:67–96`은 found.length로 3종목 기준을 통과시키고 수익률은 유효값만 median한다. stale/동일 세션을 검사하지 않고 basis는 found 날짜 최대다. 오래된 stale 1종목 ret1m=50 + 최신2종목 ret1m=null → usable에 포함, covered=3, ret1m=50, basis=10월28일. themes.js:434 이후는 usable을 막대로 렌더하고 전체 최신 종가 chip과 covered/members를 붙인다. 4테마 미만이면 문장은 순위 보류지만 막대에는 여전히 들어간다.

US group-strength는 stale/동일세션/작은표본을 별도로 처리하므로 ‘두 지역 동일 규칙’ 주석도 현재 코드와 다르다(US headline 최소4, KR usable 최소3). 개편: 발견/측정/동일기준일/탈락 수를 분리하고 metric별 유효 표본으로 최소 기준을 적용. 오래된 값은 별도 날짜 참고로 유지. 지역별 기준 차이가 의도라면 설명하고 동일 규칙이라고 쓰지 않는다. 회귀: 3행 중1측정, 혼합일자, stale, 전부결측, 각 return창 표본 차이, 실제 렌더 chip/분모.

### P18-LONG-01 — 재시도 날짜가 미완성 월평균을 완성시킴

`collectMacroLongHistory`는 실패 시 기존 관측을 stale:true로 보존하면서 외부 generatedAt을 갱신한다. `long-history.js:25`는 이 외부 날짜로 미완성 월을 제외한다. 동일 9월 중간 관측을 둔 채 generatedAt만9월15일→10월1일로 변경하면 마지막 비교월이8월→9월로 바뀐다. stale는 true로 남으므로 ‘최신으로 표기’ 결함이 아니라 **미완성 월을 완성 월평균으로 해석**하는 결함이다.

개편: 시리즈별 수집 성공일·관측 종료일·마감된 집계월을 저장하고 fallback 시 그대로 보존한다. 회귀: 월 경계에서 실패/성공/부분 성공, 전체 실패, 휴일, 캐시 재사용. 본 fixture는 소비자 반례이고 생산자 fallback은 소스 추적으로 확인했다.

### P18-POLICY-01 — 소비자가 읽는 정책 하단 이력이 생산 목록에 없음

`macro-crossroads.js:185`는 history.fedTargetLower를 읽고 없으면 upper−0.25로 대체한다. `scripts/producer/macro-history.mjs:37` 목록에는 upper만 있다. snapshot에는 lower가 있어도 이 함수가 history에서 읽는 계약을 채우지 않는다. 정상 생산 경로에서도 하단 실제 관측 대신 가정으로 돌아가는 정적 연결 불일치다.

개편: 실제 하단 시리즈를 생산 계약에 포함하고 두 관측일을 맞추거나, 동일 기준일 snapshot의 공식 범위를 명시적으로 넘긴다. 없는 범위는 미확인 처리. 회귀: 25bp가 아닌 폭, 하단 누락/지연, 상하단 역전, snapshot/history 혼합일자. 특정 실제 정책 범위를 주장하지 않는다.

### P18-FX-01 — 환율 하락률의 부호 반전은 역수 수익률과 같지 않음

`rates-fx.js:343–354`는 yenStrength=-USDJPY change20을 ‘엔화 가치’라고 부른다. 수학적으로 USDJPY 100→80은 −20%지만 역수의 변화는 +25%다. 이 코드는 +20%라고 설명한다. 기준 룰이 USDJPY 하락률인지 엔화 역수 상승률인지도 분리해야 한다.

개편: 기존 룰을 보존하려면 ‘USDJPY 하락률’로 명명하거나 실제 역수 수익률을 계산하되 룰의 입력 정의도 명시적으로 변경한다. 회귀: 상승/하락/0변화/3% 근처 양쪽 경계. 실제 운영 값의 발생 여부나 규칙 변경의 승인까지 주장하지 않는다.

## 방어 후보 및 정상 계약

- treasury-curve null 5Y/20Y → curve.points에는0, fiveY 필드는null인 자기모순 재현. curve.points의 실제 렌더 소비는 아직 확인되지 않아 화면에0%가 보인다고 단정하지 않는다. 공통 null 검사로 모든 표현의 계약을 맞추고 API regression 추가 제안.
- liquidity-growth null TGA → net liquidity6900bn 반례. 그러나 현재 FRED 생산 파서는 null을 NaN으로 제거하므로 정상 생산으로 도달한다고 확인하지 않았다. 소비자 경계 보강 후보로 분류.
- group-strength는 같은 날짜의 유효 구성원만 남기고 작은 표본을 headline 순위에서 제외한다. 방향 순위와 단기 가격 움직임을 recentMove로 구분한다. 다른 창의 표본 수, themeSummary의 현재성, ties 순위 일관성은 소비자 연결 추가 검증 필요.
- rrg는 계산과 trail에서 배열 길이가 다를 때 tail 정렬 차이가 있다. 실제 생산 입력의 날짜 정렬 계약과 함께 확인하기 전 확정 이슈로 승격하지 않는다.
- Taylor/거시 시리즈 stale·publication cadence 전달, 역전 종료 이력의 최소 관측 수, 시리즈 정렬/중복, 유동성 설계 소스 누락 시 카드 생략은 추가 소비자 검증 대상.
- AI_CAPEX_FLOW 비중 합계100, 층/테마 연결과 REFERENCE/asOf를 명시한다. 원본 리서치 수치 대조는 이 패스에서 하지 않았고 출처 사실성 인증이 아니다.
- move-attribution은 같은 sessionDate return만 허용하고 가격 기여와 원인을 주석에서 구분한다. weightBasis를 전달하지만 시점/커버리지 검사는 없다. null return의 Number 변환, 종료 후1시간 뉴스 포함, current weight×return의 추정 성격, KR weight row 유효성은 생산자·실제 caller 연결 검증 대상으로 남긴다. 신규 파일은 직접 전체 판독했으나 운영 인증 아님.

## 실행 증거와 범위

`node .../reproduce-pass18.mjs` exit0. 감사 문서/fixture 범위 affected 실행은 syntax 등11개 cached, qa-runner-behavior 실패: `scripts/ci-qa-runner-behavior-check.mjs:57` 임시 cache/last-run.json ENOENT. run=`2026-10-29T13-01-48-200Z-26660-4mwd9v`. 원인 전체가 sandbox라고 단정하지 않는다. 이전 실패를 무시해 PASS로 기록하지 않았고 제품/QA 코드 수정도 하지 않았다. PASS17 affected에는 아직 본 PASS18 문서가 없었으므로 이 문서까지 검증했다고 확대하지 않는다.

전체 감사 진행 중. 직접 판독/정적 연결/로컬 반례/브라우저/운영 증거를 구분한다. 다음 영역은 종목·재무·뉴스·포트폴리오 등 남은 본문과 생산자·화면·workflow 연결이며, 재개 승인을 기다리는 중간 종료점이 아니다.
