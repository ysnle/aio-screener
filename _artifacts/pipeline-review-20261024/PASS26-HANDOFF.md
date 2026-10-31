# PASS26 — 일일 변화·내 종목·일정·이벤트 해석

2026-10-31 KST. 직접 전체 판독 7파일: src/domain/briefing/{daily-diff,event-guide,schedule,scheduled-events,evidence-text,headline-terms,regime-pulse}.js. 소비자 부분 판독: src/ui/components/daily-loop.js 130–200, briefing-read.js 82–157, market-read.js 413–482/968–987. 부분 파일은 이번 FULL 목록에 포함하지 않는다.

`node _artifacts/pipeline-review-20261024/reproduce-pass26.mjs`: exit0, 7개 반례 묶음, 네트워크 없음. 상세 출력 pass26-reproductions.json. 제품 수정 없음.

## P26-NAMES-01 — 이동평균 없는 종목을 '대부분 위'라고 요약

buildMyNames는 notes가 하나라도 있으면 measured에 포함한다. RSI만 있는2종목, pctSma50 전부 미확인, breadthState=burden이면 '내 종목 대부분은 아직50일선 위'를 출력한다. 아래 개수0을 위 개수로 뒤집는 오류다. 실제 daily-loop caller는 행을 그대로 넘기며 summary를 직접 표시한다. 동일 함수는 sma50=0을 '위'로, raw70미만 RSI를 반올림해서70으로 표시할 수 있어 다른 종목 화면의 소수1자리 기준과도 다르다.

개편: ma50Observed/above/below/on/unknown을 명시하고 MA 관측 종목만 분모로 삼되 전체 coverage를 표시. 50일선 이외의 notes 유무로 분모를 만들지 않는다. 원자료 sessionDate/fieldReadiness를 전달해 지연된 기술지표를 현재 시세와 구분. 회귀: 전체누락, 일부누락, 동률, raw69.9/70, 다른 지표만 존재.

## P26-NAMES-02 — 미확인 등락이 표시 순서에 관여

daySignalled=false면 attention의 당일등락 가점은 막지만 최종 sort tie-break는 abs(dayPct)를 무조건 사용한다. 100% 미확인 quote가2% 미확인 quote보다 앞서는 반례. UI가 앞8개만 표시해 동점 집단에서는 실제 노출 범위가 바뀐다. 오래된/기준미확인 등락을 'rank attention에 안 쓴다'는 P1579 주석과 다르다. 숫자는 회색으로 남기더라도 정렬에는 검증된 값만 사용하고 나머지는 고정 순서. row 기술값도 오래됐을 때 attention을 움직이는지 함께 검수.

## P26-EVENT-01 — 같은 실적 일정에 서로 다른 시계 사용

schedule은 ET↔UTC의 DST를 Intl로 변환하나 eventPreviews는 bmo12:00Z/amc20:05Z, earningsReactionCases는 open13:30Z를 고정한다. 겨울12/1 14:00Z 보고를 당일9:30ET 개장 전이 아닌 것으로 제외하는 함수 반례. 겨울 bmo는 같은 now에 schedule에 남고 preview에서는 사라지는 반례. 이 결론은 외부 발표 시각의 사실검증이 아니라 저장소 내부 시간 변환과의 불일치다.

reaction의 직전 개장 계산도 월요일이면3일/그 외1일이라 휴장 다음날은 실제 직전 거래일을 놓친다. 게시글 전송시각을 발표시각 대신 쓰므로 지연 재전송이나 오래된 실적 재소개도 가격반응 사례로 오인할 수 있다. 티커별 첫 signal을 채택하며 분기/정정/일관된 우선순위 대조가 없다. channel 신호의 상회/하회는 관측된 사례이고, 해당 수익률의 원인을 입증하지 않는다.

개편: market-calendar의 실제 개장/직전 session과 같은 report event id를 공통 계약으로 사용. 시간 미정은 구간으로 전달하고 임의8:00/16:05를 실제 시각처럼 필터 기준으로 승격하지 않는다. BMO는 passed에9:30을 쓰지만6시간 유지 필터는8:00을 써 내부 기준도 다르다. AMC/unknown은16:05가 지나면 시각 경과로 분류하므로 실제 미확정성과 구분. 회귀: DST전후, 휴일/조기폐장, 장중dmh, 발표연기, 게시지연, actual만 존재.

## P26-NULL-01 — 없는 실적·반응을0으로 표시

- earningsReactionCases의 Number.isFinite(Number(row.ret1d))는 null을0으로 받아 '움직임0' 사례를 만든다. fixture 재현. caller는 동일 session의 canonical rows를 그대로 넘기므로 이 함수 앞에 별도 null 차단은 없다. producer가 해당 null을 만들 수 있는지까지 운영 재현한 것은 아니다.
- schedule EPS actual은 ''를0으로 바꿔 received와 EPS0.00을 출력한다. estimate에는 빈 문자열 guard가 있지만 actual에는 없다. fixture 재현. revenue만 발표된 경우는 반대로 actual 미수신으로 남는다. week.reported도 epsActual!=null만 보므로 빈 문자열/부적합 값과 매출-only를 잘못 구분할 수 있다.
- formatUsdRevenue는 Infinity를 양수로 허용한다. 숫자 입력의 finite 계약을 통일할 것. 원래 zero revenue를 의도적으로 숨기는 정책도 '0과미확인'을 명확히 구분할 필요.

## P26-WEEK-01 — 일정별 중복 제거·통화·완료 기준 분산

buildEarningsWeek는 동일 티커/날짜/hour 두 행을2건으로 센다(재현). schedule에는 부분 dedup이 있으나 hour가 unknown→bmo로 보완되면 서로 다른 행이고 revenueActual만 추가된 정정은 우선하지 않는다. week renderer는 total/SP500/mine을 그대로 사용한다. 공통 event identity, 최신 수정 우선과 출처 충돌 기록 제안.

week/preview의 revenue는 무조건 달러 포맷, EPS는 통화 생략, schedule만 currency를 부분 표시한다. artifact의 통화 정규화 계약을 공통 적용해야 한다. market value로 정렬할 때 여러 통화가 섞이면 raw mcap 비교가 의미 없다. 현재 US names 필터가 있는 preview/schedule과 전체 calendar를 받는 week의 범위는 다르므로 US-only 가정으로 묶지 않는다. corpus 통화 혼재 여부는 잔여 확인.

## 기타 의미·정합성 후보

- daily changes는 양쪽이 모두 unknown인 축을 flips에서 빼지만 headline은 '지표 판정이 그대로'라고 말한다. 비교 가능 축 수를 밝히고 전부 미확인이면 판정 불가로 분리. 큰 변동이 없다는 결론도 missing measures와 함께 표시 필요.
- previousRegime WeakMap key에 sessions가 없어 같은 history/asOf/macroHistory로1일 후5일 요청하면 첫 값이 재사용된다. 현재 UI caller는 기본5일만 사용하므로 지금 화면의 확정 문제로 확대하지 않는다. macroHistory를 asOf로 자르는 부분은 있으나 수정된 최신 역사자료라 실제 당시 공개자료 빈티지를 입증하지 않는다. now를 과거로 전달하지 않아 KR축은 현재 KRX 기준으로 정렬되어 과거와 비교할 때 영향 가능. credit 양호를 partial로 표시하는 보호 유지.
- newsImpactChain은 주제 단어만으로 선두/대안 중 먼저 맞는 시나리오에 연결한다. '물가 급락'도 선두reheat라면 같은 체인을 받을 수 있다. 주제 연결과 시나리오를 강화하는 방향 증거를 구분. facts를 새로 추정하지 않는 점은 정상이나 제목의 부정/예상/실제 차이는 판독하지 않는다.
- todayChecks는 passed를 보지만 received를 따로 제외하지 않는다. eps actual이 예정 placeholder 전에 도착한 일정은 이미 발표됐는데 '오늘·내일 확인'으로 남을 수 있다. 순서는 caller가 정렬한다고 가정하며 macro 우선은 의도된 편집 정책이다.
- scheduled events expiresAt은 장기 만료일이지만 activeScheduledEvents는 atKst+6시간에 숨긴다. 개표가 여러 날 이어지는 사건은 expiresAt까지 유지된다는 의미가 아니다. registry source는 제목 문자열뿐이고 reviewedAt 미래/실재날짜/중복 id/공식 URL을 gate가 보장하지 않는다. 여기 기록된 선거 날짜 자체의 외부 사실검증은 이번 로컬 감사 범위에서 수행하지 않았다.
- marketStructureEvents는 fomcDecisions 배열일 때만 schedule에 포함된다. null이면 선거·휴일·만기도 함께 빠진다. 의사록21일 후/월물 만기 규칙은 예외를 별도 override할 구조가 없다. days가 길어도 월물 생성은 현재·다음2개월뿐. 실제사용 horizon은 짧아 일반 화면 문제로 과장하지 않는다.
- stripEvidenceIds는 근거 id와 기술적 문자열을 정규식으로 제거한다. ordinary bracket의 소문자 dotted/hyphen 문자열도 ID형과 같으면 제거될 수 있다. 근거를 숨기는 처리는 구조화된 citation token 단계로 옮기는 안을 제안. headline-terms도 제목에 earnings 하나가 있으면 다른 문맥의 '수익'을 전역 치환하므로 번역상의 의미 변형 후보. 원문과 번역을 함께 보존한다.
- regimePulse는 overall과 축 개수 표시를 재사용하여 폐기된 점수를 되살리지 않는 정상 경로. 단 counts가 없으면0으로 표현하므로 summary schema 보장이 전제다.

## 다음 검증과 상태

새 반례들은 함수 수준이다. daily-loop/briefing-read 소비부 연결까지 확인한 범위와 producer 데이터 발생 여부를 구분했다. 실제 화면·외부 원문·배포 상태 검증 아님. 전체 감사는 진행 중이며 제품/생성 데이터 수정, commit/push/deploy 없음.
