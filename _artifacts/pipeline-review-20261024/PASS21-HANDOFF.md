# PASS21 — 신규 실적·FOMC 요약과 AI 공급망 흐름

2026-10-30 v59.44 직접 판독. 제품 수정 없음. 전체 판독: scripts/fetch-event-briefs.mjs, .github/workflows/event-briefs.yml, src/domain/briefing/{event-briefs,ai-chain-flow}.js, src/ui/components/{event-briefs,ai-chain-flow}.js, src/data/event-artifacts.js. src/domain/market/move-attribution.js는 PASS18 이후 변경본 전체 재판독. 총8경로. 7개 순수/메모리 주입 반례 reproduce-pass21.mjs exit0, pass21-reproductions.json. liveSources 호출·외부 요청·public-data 쓰기 없음.

## P21-NUMBER-01 — 숫자 토큰 존재는 단위·방향·회계 의미 검증이 아님

verifyQuotedItems는 인용문이 원문 substring인지, 본문 숫자 토큰이 원문/인용문에 존재하는지만 확인한다. “Revenue declined 5 percent to $5 million”을 인용하며 value=$5 billion/text=매출이 5% 증가라고 쓴 항목이 kept다. NUMBER_RE는 부호도 의미로 비교하지 않는다. 화면의 “숫자는 원문에서 확인된 것만 싣습니다”는 숫자열 확인의 실제 보증 수준보다 넓게 읽힌다. 원문 매출/이익 항목 바꿔쓰기나 현재/전년 열 바꿔쓰기 역시 이 검증으로 막을 수 없다.

개편: amount/currency/unit/sign/metric/period/accountingBasis를 구조화하여 인용 위치와 결합한다. 원문 값 표시는 파싱된 값에서 조립하고 AI에는 연결 설명을 맡긴다. 원문 quote 유지 자체는 유익하므로 보존한다. 회귀: million↔billion, 증가↔감소, 손실 부호, 전년↔당기, GAAP↔조정, 서로 다른 숫자가 우연히 같은 경우. 이 반례는 모델이 실제로 해당 오류를 생성했다는 증거가 아니다.

## P21-AMOUNT-01 — 하나의 금액이라는 계약과 실제 parser 범위 불일치

parseUsdAmount('$5 bn')=5, '$5 million to $6 million'=5,000,000. 주석은 하나의 금액으로 읽힐 때만 비교한다고 하지만 regex는 첫 금액만 뽑는다. assembleEarningsSections는 이를 컨센서스와 비교한다. 단위가 생략된 축약과 범위값의 실제 원문 빈도는 미측정. 개편: 전체 문자열 문법을 검증하고 알 수 없는 단위/범위는 비교 보류. billion/million/bn/m, 음수·괄호, 통화·기간·단위 분리, 범위와 다중 수치를 회귀 검증.

## P21-EPS-01 — GAAP가 quote에만 있으면 조정 예상치와 비교

isGaapOnlyFigure는 label/text만 확인한다. quote='GAAP diluted EPS was $2.', label='희석 EPS', value='$2', estimate4이면 -50% 예상 대비를 붙인다. source는 GAAP라고 명시하지만 AI 요약 라벨이 생략하면 P2138 보호를 통과한다. UI는 figure.estimate를 그대로 예상 대비로 표시한다.

개편: quote까지 포함하는 단순 문자열 보강보다 원문에서 accountingBasis를 구조화하고 예상치 basis와 정확히 일치할 때만 비교한다. basis 미확인은 비교 보류. 통화·split·분기까지 같은 비교 계약에 포함. GAAP만/Non-GAAP만/둘 다 있는 원문과 모델 라벨 생략을 회귀 검증.

## P21-EVIDENCE-01 — 검색 근거 URL의 허용 도메인만 검사

acceptPoints는 URL host allowlist와 sourceText 숫자 존재를 검사한다. 숫자 없는 “경영진이 사업 철수를 확정” 문장 + 허용 도메인의 존재 미확인 경로는 원문='Revenue stable.'이어도 통과한다. 검색 결과 URL과 응답 annotation 결합, 기사 실제 내용·발행일·발행자 일치는 여기서 검사하지 않는다. 기자회견/콜의 수치는 해당 기사 대신 성명/실적 원문으로 검사하므로 실제 기자회견에만 나온 숫자는 반대로 탈락할 수 있다. 숫자가 없는 reasons를 요청하는 경로에서는 숫자 검증이 근거 검증 역할을 거의 못 한다.

개편: 생성 항목을 실제 검색 tool 결과와 citation에 결합하고 출처별 원문 또는 인용 구간·날짜를 보존. 공식 실적 숫자와 보도 기반 원인 설명의 검증 계약을 분리. UI는 보도 기준을 이미 표시하지만 콜 points의 개별 URL은 렌더링하지 않고 reasons URL만 노출한다. 콜/녹취록도 항목별 확인 가능한 링크 제공. 회귀: 허용 host의 임의 경로, 무관한 기사, 숫자 없는 반대 주장, 기사의 새 숫자, 실제 tool citation 없는 응답.

## P21-PROVISIONAL-01 — 제공처 actuals 정정이 기존 provisional에 반영되지 않음

buildEventBriefs는 calendar-symbol-date가 이미 있으면 provisionalBrief를 다시 만들지 않는다. 메모리 주입 2회 실행에서 매출1b→2b/EPS1→2로 calendar를 바꿔도 기존 $1b/$1이 유지되었다. SEC 요약이 나오기 전 값이 계속 바뀔 수 있는 상태인데 첫 값을 고정한다.

개편: provisional은 매 실행 최신 provider row로 교체하되 reaction/reasons가 어느 입력 revision에 근거하는지 보존·재평가한다. calendar actual 취소/누락과 통화·basis 변경도 포함. 미래 calendar actuals를 막는 상한 검사가 없고 Number.isFinite에 맞지 않는 string actuals는 빈 figures를 만들 수 있는 별도 boundary 후보.

## P21-TIME-01 — 종목 선택기는 미래·pending 항목도 최근 요약으로 선택

latestBriefFor는 now-published<=100일만 검사한다. 2099년 pending 한 건을 2026년 실행에서 반환한다. home selector는 pending 제외와 미래1시간 상한을 적용하므로 두 화면이 다르다. paintTickerBrief가 이 결과를 바로 최근 실적 요약으로 렌더링한다. 미래 오염 방어와 pending 표시 정책을 공통화하고, pending은 날짜 있는 대기 상태로 별도 표시하는 방안을 제안한다.

SEC acceptedAt가 없으면 filingDate+'T00:00:00Z'를 만들지만 publishedDateOnly를 붙이지 않는다. releaseSession은 이를 전날 ET로 변환한다(10/29UTC→10/28ET 재현). 날짜만 있는 US 공시를 전날 발표로 해석하여 기준 종가/첫 반응일을 잘못 고를 가능성. DART는 date-only를 명시하지만 해당 날짜 종가를 첫 반응으로 가정한다. 공시 시각 미확인 상태에서 발표 후 수익률을 단정하지 않는 공통 계약이 필요하다. releaseSession은 US16시/KR15:30 고정이며 특별장·단축장은 달력과 결합되어 있지 않다.

## P21-LIFECYCLE-01 — 정정·재시도·정착 상태 추가 위험

- SEC exhibit 미수신 또는 6-K 판독 불충분이면 skippedFilings에 영구(최근200개) 기록한다. 일시적 null과 확실한 비실적 문서를 구분해야 한다. 재시도 가능 실패는 nextRetryAt와 원인을 남긴다.
- DART 주석은 정정이 원본을 대체한다고 하지만 새 rcpNo는 새 id로 Map에 추가되고 이전 brief 제거/대체 연결이 없다. 최신 한 건 선택과 보존 목록의 중복 의미를 분리해야 한다.
- FOMC 성명은 source가 있고 pending이 아니면 재수집·hash 비교하지 않는다. 원문 정정 반영 계약 미비. changes는 현재 quote 존재만 확인하므로 실제 직전 문장과 달라졌는지 검증하지 않는다.
- FOMC transcript 시도 횟수는 callPoints 없는 실패에서 증가하지 않는 경로가 있고 presser가 callPoints를 재조립하며 transcriptAttempts를 버릴 수 있다. 하루20분 cadence와 함께 실패 재시도 상한 상태전이 검증 필요.
- withCallPoints는 최대2회 검색 후 partial에 머물지만 화면은 계속 “아직 정리 전”이다. exhausted/일시실패/정책상 미수집을 구분해야 한다.
- 반응 방향 재검색은 redone 한 번 후 다시 반전하면 기존 reasons를 유지한다. 첫 세션 기준인지 최신누적 기준인지도 화면(누적 포함)과 reasons(reactionPct 첫 세션)의 의미가 다르다. 원인 주장의 기준 시점을 명시해야 한다.
- 과거 reaction.settled는 가격 정정·split 이후 재산정하지 않는다. raw close 사용은 split 경계 확인 필요. 상태/실행시각과 원문 revision을 분리하여 재계산 조건 정의.

## P21-WORKFLOW-01 — 변경 없는 실행의 상태가 commit을 유발할 수 있음

workflow는 generatedAt 한 줄만 바뀐 diff를 제외한다. producer는 최초실행 후 source status가 idle↔statement-ok처럼 달라질 수 있고, prices.checkedAt를 새로 쓰므로 source 문서가 같아도 commit이 생긴다. 반응 추적 중 가격 변화는 의도된 갱신이나 단순 checkedAt 변경도 commit될 수 있다. 주석 “새 문서/대기 콜 없으면 AI/commit 없음”은 reasons·가격 추적·메타 상태 흐름을 포괄하지 못한다. semantic payload hash와 observation status를 나누고 변경 없음 예제를 회귀 검증할 것.

push 경쟁 후 rebase 뒤 재생산/콘텐츠 재검증 없이 push하는 형태는 기존 감사의 일반 문제와 동일. 이 workflow만의 새 문제로 중복 집계하지 않는다. 비용은 shared Worker를 통하므로 로컬 추정 costLedger가 실제 예산 강제라는 주장은 하지 않는다. retained briefs에서 합산하므로 provisional 제거 시 해당 AI 비용이 합계에서 빠질 수 있다. 지출 청구서가 아닌 추정이라는 계약 유지.

## P21-CHAIN-01 — 공급망 그룹의 일별/월별 수익률 기준일 미검사

aiChainFlow는 US 형태와 ret1d/ret1m 존재만 검사한다. 같은 날짜인지·ret1m history가 같은 창인지·stale 여부를 검사하지 않는다. UI는 global metadata.factorSessionDateByMarket.US를 전체 그룹의 “지난 거래일/종가 기준”으로 붙인다. 일부 행이 과거라면 서로 다른 창의 중앙값이 최신 단일일자로 보일 수 있다. minMembers=3은 날짜 일치/전체 하위테마 대비 coverage를 보증하지 않는다. 정상 upstream 강제가 있는지 추가 연결 검증 전까지 경계 후보로 둔다.

개편: factorSessionDate를 그룹 공통 기준에 맞추고 유효/전체 구성원과 기간별 coverage를 함께 보존. 빠진 데이터 때문에 단일 테마가 사라지는 경우 없음/지연 표시 고려. 5일 값은 1일/1개월 통과 멤버 중 일부만 있어도 산출(현재 UI에는 미표시). 같은 표본 또는 기간별 n을 명시. 정렬·중앙값·동률은 정상적인 서술통계이며 매매점수로 취급하지 않는다.

## 재판독: move-attribution

변경본은 Telegram 정확한 ticker 외에 태그5개 이하·opening120자 기업명 조건을 보강하고 기사 우선순위를 올렸다. 같은 세션 factorSessionDate 확인과 기여도/원인 구분 주석은 유지된다. datedItemFor의 brief 우선 경로는 pending/provisional/status를 검사하지 않아 미확인 요약을 실적 발표로 부를 후보. news 경로도 reportVerification을 공유하지 않는다. 전일 또는 현재 weight×수익률 중 어느 지수기여 근사인지 weightBasis로 한계를 설명해야 한다. source read 재검증 완료이지 실측 지수 기여도 인증은 아니다.

## 검증 한계

실제 AI 응답·공시/검색 결과의 정확성·배포 작동·브라우저 렌더링은 이번 pass에서 미검증. 보조 함수 반례는 명시하고 운영 빈도는 추정하지 않았다. 제품/데이터 개선 미실행, commit/push/deploy 없음. 전체 저장소의 나머지 경로 감사는 계속 남아 있다.
