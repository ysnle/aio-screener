# Claude 재검토·처리 결과 (2026-11-08, v59.79)

기준: origin/main `c6ddb8b6`(v59.78)으로 fast-forward한 뒤 작업했다. 이 폴더에 새로 들어온 Codex 후속 문서 11개(FOLLOWUP-20261108-NEW·MEMORY·BREADTH·FUNDING, FOLLOWUP-AI-FUNDING·ANET-MODULES·BOOKMARKS-MORE·CREDIT-BOOKMARK·HARDWARE-VISUALS·LEADERS-23-CHARTS·SEMICONDUCTOR-CHARTS)와 핸드오프 3개(CLAUDE-RESPONSE-20261107, COMPANY-RESEARCH-HANDOFF, HANDOFF-REVIEW-20261106)를 읽고, 문서가 가리킨 코드·데이터를 HEAD에서 다시 확인했다. 핸드오프의 숫자는 증거로 쓰지 않았다. 아래 "직접 확인"은 이번 세션에서 1차 원천을 다시 연 것이다.

## 직접 다시 확인한 1차 원천

| 항목 | 확인 결과 |
|---|---|
| Marvell–Lumentum 합병 (회사 보도자료) | 2026-11-02 발표. Lumentum 1주당 Marvell 4.500주, 전량 주식. 완전희석 기준 기존 Marvell 주주 약 67%, Lumentum 주주 약 33% 예상. 양사 주주·규제 승인 뒤 2028년 상반기 완료 예정. |
| Marvell 8-K (Google 워런트) | 보고일 2026-08-18. 최대 58,970,907주, 행사가 206.58달러. 1,360,867주는 첫해 분기별 기간 기준, 나머지는 Google 맞춤형 칩 구매 매출 5억 달러마다 240분의 1씩 FY2033까지 확정. 2033-08-18까지 행사 가능. |
| FRED 11/02 | 3~5년 투자등급 유효수익률 5.53%, 국채 3년 4.65%·5년 4.70% → 평균 4.675%, 차이 85.5bp. 투자등급 OAS 0.94%(94bp). |
| Intel 3분기 사업부 (AIO INTC 기업 이해, 회사 발표 기준) | CCPG 8.1 + DCAI 7.3 + Foundry 6.7 + 기타 0.7 − 내부거래 6.3 = 165억 달러. Codex 문서의 "세 사업부 합 − 6.3" 식은 기타 부문이 빠져 15.8이 되므로 그대로 옮기지 않았다. |
| Marvell FY2026 FCF | AIO MRVL 기업 이해에 이미 영업현금흐름 17.505억 − 설비투자 3.541억 = 13.96억 달러로 들어 있다(Codex 수용 조건 (a)는 이미 충족). |
| X 게시 시각 | 새 출처 9건의 시각을 status ID에서 직접 계산했다. 문서의 KST 표기와 모두 일치. |

## 처리 (v59.79, P2293 + change-only 항목)

| 자료·지적 | 처분 | 반영 위치와 근거 |
|---|---|---|
| Marvell 분석(pdicarlotrader) — Lumentum·Google 희석 | **반영** | `public-data/company-profiles/MRVL.json`에 출처 s14·s15, 지배구조 줄, 약세 논거(합병 완료 시 기존 주주 약 67%, 워런트는 매출과 함께 확정되는 구조), 반증 조건(승인 지연·무산), 결정 일정(2028 상반기 예정), 미확인 항목 2개를 추가하고 조사일을 11-08로 갱신. 합병은 "예정"으로만 적고 합병 후 숫자를 현재 숫자와 섞지 않았다. 새 기업 화면을 만들지 않고 기존 기업 이해를 확장. |
| 같은 글의 FCF 17.23억 | **버림(불일치 기록)** | 10-K로 재현되지 않음. 새 패킷 출처 확인 항목에 UNVERIFIED로 남기고, 분석 틀 `segment-sum-consolidated`의 사례로만 씀. |
| 같은 글의 Morningstar 적정가·전고점 70%·기관 매수 구간 | **버림** | 분모·표본 미공개, 가격별 거래량으로 매수 주체를 알 수 없음. 패킷 `declined`에 기록. |
| 데이터센터 수요(dons_korea) | **리서치 반영** | 새 분석 틀 `delay-or-demand-loss`(가동 연도만 밀렸나, 주문·설비투자·계약 잔고가 줄었나). 처음 넣은 `ai-infra-stage-gap`(발표·착공·전력·가동·현금)은 10/28 `data-center-stages`와 중복이라 재설계했다. 86GW·"지연이지 취소 아님"은 작성자 주장으로 UNVERIFIED. 시장 상태에 시간축 카드를 새로 만드는 안은 **보류** — 착공·가동 GW를 AIO가 받는 무료 원천이 없어 지금 만들면 원천 없는 수치가 된다. Census 건설지출(월별, 데이터센터 세부 항목) 수집은 후속 과제로 남김. |
| 주 20주선(colu_farmer) | **기존 구조로 닫음 + 리서치 반영** | 기술적 분석에는 이미 30주선 단계(Weinstein)와 주봉·일봉 방향이 있다. 20주선을 별도로 추가하지 않는다(같은 일을 하는 화면이 있음). "완성된 주봉과 진행 중인 주의 값 구분"은 `case-chart-timing` 레슨에 넣었다. 현재 `weeklyCloses`는 진행 중인 주의 마지막 종가를 그 주 값으로 쓰는데, 이는 차트 관례상 진행 봉이라 결함으로 보지 않았다. |
| 주도주 이미지 23장(damipov 11/06) | **리서치 반영** | 새 분석 틀 `case-chart-timing`. NFLX 2003·NVDA 2016·ZM 2020의 사건일 뒤 실적 표시, QQQ 그림과 나스닥 종합 계산 원천 차이, BIDU/BKNG 표기 불일치를 확인 항목으로 기록. 종목 추천·성공률로 바꾸지 않음. |
| AI 자금조달 1부·2부·11/06 후속(damipov) | **리서치 반영** | 새 분석 틀 `exposure-cap-policy-line`(최대 한도·정책 목표·기준일). NVIDIA 보증 최대 1,050억·Nebius 구매 보장 최대 150억은 한도이지 손실이 아님, SoftBank LTV 13%는 6/30 값, 25%는 회사 목표이지 계약 조건이 아님. 실시간 LTV 역산은 **버림**. 기존 `commitment-present-value`·`ai-infra-credit-ladder`와 겹치지 않는 부분(숫자의 종류 구분)만 새 틀로 둠. |
| 머니플로우 인용 원문(blazingbees 10/29) | **리서치 반영** | `case-chart-timing`의 출처. 16:00·18:58 EDT 스냅샷과 분할 전 SNDK 가격을 별개 관측으로 기록. PCE 원인 주장은 UNVERIFIED. |
| FTD 이미지·댓글 정정(BREADTH) | **기존 레슨 수정** | `packet-20261102` FTD 레슨이 "큰 자금이 다시 사기 시작했다는 흔적"이라고 매수 주체를 단정하던 문장을 관측 서술로 고침. 작성자 도해도 +1.25%를 명시한다는 점, 본문(50일선 위 200일선)과 도해(종가 > 50일 > 200일)의 순서 차이, AI 재렌더링을 반론에 추가. 시장 상태 화면의 FTD 문장(`rally-attempt.js`)은 규칙은 맞지만 "주도주가 신고가로 따라 나와야 힘이 있습니다", "이 신호의 힘을 가릅니다"가 방법의 가정을 사실처럼 써서 "다음 확인점"으로 고침(2차 독해에서 발견). 출처의 2026-04 날짜(3/30 저점, 4/8 +2.80%는 거래량 미달, 4/14 11일째 +1.96%)는 AIO 이력으로 그대로 재현돼 VERIFIED 확인 항목을 추가. 피벗 종가/장중 분리, 베이스 자동 필터는 정의가 확정되지 않아 **보류**. |
| 신용 북마크(JunDo1050) 심층 | **기존 패킷 보강 + 화면 문구 수정** | `packet-20261104` 신용 출처에 FRED 재계산(85.5bp, OAS 94bp, 근사치는 OAS가 아님, 150bp는 경험칙) 확인 항목 추가. 시장 상태 신용 줄(`market-story.js`)과 매크로 신용 장(`macro-chapters.js`)의 "위기 신호가 오면 여기서 시작됩니다"는 표본 검증 없는 선행 단정이라 "가장 약한 기업의 조달 비용부터 오르는 모습이고, 이 확대가 하이일드 전체로 번지는지가 다음 관찰점입니다"로, "더 벌어지면 … 번집니다"는 "번질 수 있습니다"로 고침. 기업별 만기·변동금리 표는 공시 추출 경로가 없어 **보류**. |
| 메모리 사이클 표지·댓글(chamath) | **기존 반영 확인으로 닫음** | `packet-20261030`의 256% 확인 항목이 이미 "매출"로 적혀 있다(이익으로 치환하지 않음). 새 분석 틀 `segment-sum-consolidated`에 매출 증가율 ≠ 이익 증가율 사례로 추가. 유료 연구 본문은 미열람 그대로. |
| Intel·Sandisk 이미지(HARDWARE-VISUALS) | **기존 반영 확인으로 닫음 + 리서치 반영** | INTC 기업 이해에 이미 부문 표(내부거래 −6.3을 음수 부문으로)와 외부 4.11억 달러(일회성 프로그램 포함)가 있고, SNDK 기업 이해에 8대1 분할 일정과 분할 전 기준 주석이 있다. 분할 주식 수 보정은 P2220(v59.70)에 있음. 내부거래 사례는 `segment-sum-consolidated` 레슨에 넣음. |
| 반도체 이미지 12장(WonhaengL) | **기존 반영 확인으로 닫음** | `packet-20261102`·`packet-20261104`의 `growth-acceleration-peak`·`cycle-top-two-clocks`가 증가율과 그 변화폭(pp), 가속도 시계와 부호 시계를 이미 다룬다. WSTS 월별 수집은 공식 발표 경로·이용 조건 미확인으로 **보류**. |
| Arista(ANET-MODULES) | **기존 반영 확인으로 닫음** | ANET 기업 이해는 11/07 조사본(3분기 매출 36.6억, +58.5%)이다. 2027 마진 49%는 원문 미대조라 넣지 않는다는 Codex 판단과 같음. |
| MSFT Azure 정의 변경(BATCH-20261106-CLOUD) | **반영** | Microsoft FY2027 Q1 지표표를 직접 열어 재작성 기준 Azure 성장률 FY2026 Q4 42% → FY2027 Q1 48%(고정환율 48%)를 확인. MSFT 기업 이해의 "새 보고 부문" 항목에 같은 기준 비교와 최초 발표 43%의 정의 차이를 추가(출처 s18). |
| MRVL "Google 거래 최대 1,200억 달러"(이미지 직접 열람) | **반영(성격 정정)** | 워런트 조건(5억 달러마다 240분의 1)의 산수로, 전량 확정에 필요한 누적 매출 상한이지 전망이 아님. MRVL 지배구조 줄에 그렇게 적음. |
| 모듈 경계 글(_khrus) | **닫음(에이전트 작업 방식)** | 같은 원칙이 이미 `/deepen` 스킬로 들어와 있다. 제품 변경 없음. |
| 경계 도달과 반응(Wyckoff), 레버리지 시간축(Trader_Jesse) | **기존 반영 확인으로 닫음** | 두 글 모두 `packet-20261102`에 이미 있다. 경계 타임라인 UI는 정의(경계 설정 시점·재시험 판정)가 없어 **보류**. |

## 이전 핸드오프의 열린 항목

| 항목 (출처) | 처분 | 근거 |
|---|---|---|
| 발표 전 기대치 취득 시각 capturedAt (CLAUDE-RESPONSE-20261107 #2, COMPANY-RESEARCH §1) | **닫음** | `scripts/fetch-event-briefs.mjs`가 이미 estimate마다 `seenBeforeReportAt`(달력에서 마지막으로 본 시각)를 찍는다. 같은 일을 하는 필드가 있으므로 새 필드를 만들지 않음. |
| reaction-read의 '유지'·하향/하회·SMH 오적용 (COMPANY-RESEARCH §1) | **닫음** | v59.70(P2219)에서 처리됨. HEAD에서 그대로 유지. |
| 사건·주장·반론·정정 원장 (NARRATIVE-SYSTEM) | **보류 유지** | 이번 자료도 같은 설계를 반복 제안하지만 저장·비용·정정 원천이 정해지지 않았다. 분석 틀의 지지·반대·미확인 구분으로 리서치 쪽에서만 반영. |
| 시장 폭 '이평선 상승 중이면서 위', 공매도 잔고 | **보류 유지** | 원천·비용 미확인. |
| 9개 화면 직접 진입·모바일 실측 (HANDOFF-REVIEW 5) | **부분** | 이번에 바뀐 화면(시장 상태 신용 줄, 매크로 신용 장, MRVL 기업 이해, 리서치 라이브러리 새 레슨 4개)만 브라우저로 확인. |

## 문서와 코드의 어긋남

- FOLLOWUP-20261108-NEW 수용 조건 (a)(FCF 13.964억 표시)는 이미 충족돼 있다. MRVL 기업 이해가 10-28 조사부터 13.96억을 썼다.
- FOLLOWUP-HARDWARE-VISUALS의 Intel 식은 "기타 부문 0.7"이 빠져 연결 매출과 맞지 않는다. 코드(INTC 기업 이해)는 맞다.
- FOLLOWUP-CREDIT-BOOKMARK가 지목한 "위기 신호가 오면 여기서 시작됩니다"는 `market-story.js`뿐 아니라 `macro-chapters.js`에도 같은 문장이 있었다. 둘 다 고침.
- 리서치 레슨의 화면 링크에 `entity` route는 없다(종목은 `ticker`). 새 패킷은 `ticker`를 쓴다.

## 남은 일

1. Census 건설지출(데이터센터 세부 항목) 월별 수집: 무료 공식 원천이라 `delay-or-demand-loss`·`data-center-stages`의 건설 숫자를 원천 있는 값으로 채울 수 있는 유일한 후보. 생산자·갱신 주기·수정치 처리 설계가 필요.
2. Google 워런트의 확정 주식 수는 다음 10-Q에서 확인.
3. Lumentum 합병 주주총회 일정이 공지되면 MRVL 결정 일정 갱신.
4. X 원문의 나머지 이미지·댓글·인용(각 FOLLOWUP 문서의 "남은 범위")과 10월 이후 저장분 전수 여부는 여전히 미확인.

## 2차 직접 독해 (소유자 지시: 모든 자료를 직접 다시 읽고 구조 파악)

핵심 요소·구조 지도: [STRUCTURE-MAP-20261108.md](STRUCTURE-MAP-20261108.md).

**직접 읽은 파일 67개 + 원문 스레드 8건·이미지 55장**

- 이 폴더 55개(이 응답 문서와 구조 지도 제외): README, SOURCE-REVIEW-LEDGER, READING-NOTES, SELL-OFF-20261105-HANDOFF, BATCH-INTEGRATION-MATRIX, design-draft, NARRATIVE-SYSTEM-HANDOFF, NARRATIVE-UX-HANDOFF, SCREEN-REDESIGN-HANDOFF, OCTOBER-SYNTHESIS-HANDOFF, HANDOFF-REVIEW-20261106, CLAUDE-RESPONSE-20261107, COMPANY-RESEARCH-HANDOFF, LENS-PLAN-20261107, BATCH-AI-FUNDING, BATCH-SEMIS-SUPPLY, BATCH-MARKET-BREADTH, BATCH-MACRO-OPTIONS, BATCH-COMPANY-EXAMPLES, BATCH-20261106-CLOUD, BATCH-20261106-EARNINGS, BATCH-20261106-HARDWARE, CONTINUED-A~G(7), ADDITIONAL-SOURCES, PROCESS-SOURCES, RAOUL-PAL-CHART-REVIEW, NEW-20261107-READING-AND-HANDOFF, NEW-20261107-BACKTEST, NEW-20261107-STATE-MACHINES, NEW-20261107-ARCHIVE-START·THEME·REPORTS·EARNINGS·LATER·BREADTH(6), FOLLOWUP-ARCHIVE-54-63·64-70·71-79(3), FOLLOWUP-20261108-BREADTH·FUNDING·MEMORY·NEW(4), FOLLOWUP-AI-FUNDING, FOLLOWUP-ANET-MODULES, FOLLOWUP-BOOKMARKS-MORE, FOLLOWUP-CREDIT-BOOKMARK, FOLLOWUP-HARDWARE-VISUALS, FOLLOWUP-LEADERS-23-CHARTS, FOLLOWUP-SEMICONDUCTOR-CHARTS.
- 이전 북마크 폴더 12개: 20261016 owner-proposals, agent-materials-review(판정 표 앞부분과 적용 요약·제안 절), 20261018 README, 20261028 README, 20261030 README, digest.md(앞부분 5건만), 20261101 README, 20261101-offtopic README, 20261102 README·reading-notes, 20261104 README·PACKET.
- 원문: 11/08 새 출처 8건을 fxtwitter `/2/thread/<id>`로 작성자 이어쓰기·인용까지 읽고, 첨부 이미지 55장(MRVL 14, 주도주 23, 자금조달 1·2부 10, SoftBank 2, blazingbees 3, colu_farmer 2, dons_korea 1)을 모두 열었다. 영상은 없었다.
- 코드·데이터 재확인: MRVL·MSFT·AMZN 기업 이해, `rally-attempt.js`와 `history.json`의 2026-03~04 행, `macro-chapters.js` 신용 기준(11/04 제안 #3은 v59.70에서 처리됨), 각 패킷의 출처 ID 중복.

**이전 반영과 달라진 판단**

1. `ai-infra-stage-gap` → `delay-or-demand-loss`: 10/28 노트와 중복이라 재설계.
2. FTD 출처: CONSISTENT만 있던 것에 AIO 이력 재현(VERIFIED)을 추가.
3. blazingbees 10/29 글은 10/30 원장에서 이미 읽은 글이다. 패킷 감사에 `alsoInEarlierLedger`로 표시.
4. 반등 시도 화면 문장 두 곳: 지난 반영에서 "손대지 않음"으로 둔 판단을 뒤집어 고침.
5. MRVL 1,200억 달러: 거래 규모가 아니라 워런트 확정 상한.
6. MSFT Azure: 정의 변경 메모만 있던 것을 같은 기준 숫자(42%→48%)로 보강.

**읽지 못한 것**: 10/30 digest.md 뒷부분(10/30 패킷이 이미 반영한 원문), agent-materials-review의 판정 표 중간 행(에이전트 실무 자료), 4막 글의 미열람 인용·표지(각 FOLLOWUP 문서에 기록된 그대로).
