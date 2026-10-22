# v57.98 재대조 — 2026-10-17

기준 HEAD `8baf2f0f072e6da8d70cb086e5dbb4fba799165b`. 앞선 FINANCIAL/CONTENT/GOVERNANCE/WORKFLOWS와 TSV는 v57.90~91의 읽기 기록이다. 아래 현행 판정을 우선한다. 병행 작업자가 v57.92~98에서 구현을 변경했다. 이 감사는 제품 코드·정책·버전을 수정하거나 commit/push/deploy하지 않았다.

## 금융 반례 E01–E08

실제 순수 모듈을 import한 [최신 결과](./financial-counterexamples-v57.98.json)와 최초 결과를 비교했다. 이는 합성 입력 재현이며 실제 계좌·SEC 공급자에서 발생했다는 인증은 아니다.

| ID | 최신 판정 | 확인한 변화 |
|---|---|---|
| E01 | 반례 해소 | 비용 통화와 가격 통화가 맞지 않으면 PnL을 null로 보류한다. |
| E02 | 반례 해소 | 현금 수익률 0%와 10% 가정의 estimateId가 달라진다. 실제 캐시 오사용이 있었다고 주장하지 않는다. |
| E03 | 반례 해소 | 현금이 미해소된 invested_sleeve에서 daily/buy-and-hold 모두 10%,10%를 발행한다. |
| E04 | 반례 해소 | FX 이력 없으면 local-currency-per-holding/false, 있으면 KRW-incl-fx/true다. |
| E05 | 반례 해소 | 연간·분기 EPS 배열 순서를 바꿔도 암묵 주식수100·PE10으로 같다. |
| E06 | 반례 해소 | -90% 하루를 넣어 VaR가 그대로여도 CVaR bootstrap 상대폭1.669·민감도0.564로 CVaR만 held다. backtest.js도 두 인증을 별도로 표시한다. 이는 예측력 인증이 아니라 선언한 표본 안정성 검사다. |
| E07 | 반례 해소 | V의 은행 peer FCF 비교는 유효 n0·중앙값 null로 보류한다. |
| E08 | 반례 해소, 정적 UI 연결 확인 | 희소 평가 사이 입금의 10% 결과를 time-weighted-boundary-approximation으로 구분한다. js/aio-workspace.js:993~996은 twrExact=false일 때 ‘실제 계좌 성과 TWR(기간 누적, 근사)’와 입출금 경계·경고를 표시한다. 실제 DOM 계좌 입력은 실행하지 않았다. AI 경로는 이 TWR 자체를 전달하지 않으므로 AI 정확 TWR 오전달 증거도 없다. |

## 워크플로·운영

v57.91→98 diff와 현재 호출 스크립트를 읽었다. Actions 실행·장애 주입·배포는 하지 않았다.

| ID | 최신 판정 | 잔여 / 해소 근거 |
|---|---|---|
| W01 | 일부 개선 | deploy-ai-proxy.yml:220~230은 같은 설정 재시도를 추가했다. 226의 넓은 auth/permission 판정은 일반 오류 두 번 뒤 AI binding 제거로 이어질 수 있다. AI binding 원인이라는 증거가 충분한 경우로 좁힐 필요가 있다. |
| W02 | 일부 개선 | 브라우저 유료 smoke는 예산·일일·rate-limit 429를 구분한다. automation smoke 308~309는 모든 non200을 실패로 보고 322 rollback으로 이어진다. 첫 호출 후 cap 도달 같은 정상 통제가 배포 장애로 해석될 수 있다. legacy-month-spend-unknown도 앞 whitelist에 없다. |
| W03 | 정적 해소 | refresh-data.yml:486~498에서 성공 poll/commit 뒤 marker/cache를 저장한다. cache best-effort의 재poll 가능성과 허위 성공 표시는 구분한다. |
| W04 | 정적 해소 | operations-alert concurrency가 workflow별이라 다른 감시 대상끼리 취소하지 않는다. 동일 workflow pending 교체는 별도 동작이다. |
| W05 | 유지 / 설계 절충 | dispatch 시 main HEAD B와 release_sha A가 다르면 head_sha 필터와 Pages expected SHA가 어긋날 수 있다. 미인증 배포 증거가 아니라 유효 SHA 전달·수렴 지연 위험이다. |
| W06 | 정적 해소 | ensure-live-convergence.mjs:214~215는 settled 실패에 exit1, pending/cancelled는 별도다. |

Pages v57.97 배포 시 esbuild 번들링은 코드만 읽었다. localhost의 native ESM 성공을 배포 번들·캐시·서비스워커 성공으로 승격하지 않는다.

## 규칙·작업 체계

G01은 부분 개선이다. trim-pr의 “core and rules with a current body”는 RULES 서두의 “핵심 색인 밖은 이력”과 여전히 해석이 갈린다. 현재 본문 유무가 현재 강제력을 뜻하지 않도록 단일 기준을 사용해야 한다. G02 런타임 caller 기준, G03 R265 복구, G04 version-up/record-fix 역할, G05 integrate CODE-MAP 경로, G06 mirror 산출물 예외는 정적으로 해소됐다.

새 AGENTS의 가족용 범위는 타당하다. 정식 사용자 연구·공개베타 서명·SLO 인증·공급자별 라이선스 감사는 권고이며 완료 차단 조건이 아니다. 공개 저장소의 비밀키, 공유 AI 예산 상한, 발표일·stale/null·정확한 종목 식별·개인 매매지시 제한은 유지할 가치가 있다. 범위를 줄였다고 출처와 무관한 fact를 붙이거나 계산을 과장해도 된다는 뜻은 아니다.

R718의 분야 고유어/명시적 글ID 연결과 evidenceAttached 명명은 방향이 맞다. 다만 현행 동음어 잔여가 있으므로 금지 토큰 목록만으로 의미 정합을 보장할 수 없다. 명시적 unit/fact 매핑과 정상·오매칭 사례를 함께 다루는 편이 단순하고 검증 가능하다. R719의 예측 방향 일치·반대 방향·경쟁 설명 구분도 개선이다. 방향 일치는 원인 지지의 필요 조건으로 쓰되 충분 조건으로 올리지 않고, 시간창·메커니즘·대체 설명이 남는다는 경계를 유지한다. R717의50MB는 운영 여유 기준이며 데이터 정확성·전체 다운로드 절감의 인증이 아니다.

## 현행 연구 근거 455개

전수 읽기 시작/종료 묶음 SHA256 `5dc2fc7a57b94e49ad9308ad2a688459990d48a6943e12670404bfda32d0d9e9`. 파일명 정렬+NUL+원시 바이트 기준이다. 43 fact 전문도 재독했다. RESEARCHED227/IN_PROGRESS52/REQUIRED176이며 semanticReview는 모두 REQUIRED다. 근거 첨부 상태를 의미 검증 완료로 해석하지 않는다.

Q1~Q5 상당 부분은 455개에 동일한 연구 지시 템플릿이다. 연구 계획으로 적절하지만 실제 주제별 논증·반증 변수의 완성품으로 쓰면 안 된다. 134개 unit의 283회 fact 참조는 dossier selectedSources 밖의 source를 쓴다. 전역 registry에서 해소되므로 끊어진 링크가 아니라 dossier 내부 추적 간극이다.

현행 의미 불일치: tokenomics에 언어모델 attention, 전기 변압기에 Attention Is All You Need, D6 중립금리에 silicon doping, 구매력에 데이터센터 PUE, 로켓 물리에 PUE, C2/ISR/전자전에 연준 금융안정 설명. 추가로 E7 엔캐리→ASML EUV, ETF NAV 바스켓→CPI 바구니도 연결을 교정해야 한다. 출처의 권위와 해당 주장을 뒷받침하는 능력은 별개다. 해당 dossier의 semanticReview REQUIRED는 정직하지만 잘못된 첨부를 정당화하지 않는다.

capacity-and-yield의 r-star 오연결 제거·IN_PROGRESS 하향은 확인했다. data-quality/dedup, backprop/1986논문, claim-source/W3C 등 이전 후보 다수도 수정됐다. 현행 남은 문제와 섞지 않는다.

## 새 worked112개

inputs/steps/result/limit 전편을 읽고 검산했다. 원문 SHA256 `15ad0bc9dcbad8f498263eae0af92ca310301bbfd5f2fb3926171d7f6132fc23`. 순수 산술의 확정 오류는 찾지 못했으나 설명은 보완해야 한다.

* K12: 전년비2.5%와 월간 속도 연율3.7%의 차이는 단위만이 아니라 관측창과 반복 가정이다.
* H1: 고정 주문장 평균 체결가10,035원은 실제 상한이 아니다. 호가 취소 뒤에는 더 높을 수 있다.
* A1: 연간 회계이익 차이100억을 자본가치 증가100억처럼 쓰지 않는다. 수명·현금흐름·회수·잔존가치가 필요하다.
* L7: 매출111억 감소−소재10억 절감=손익101억 감소는 다른 비용이 모두 같다는 전제가 필요하다.
* F4: 부품 단가15% 상승을 재고에도 적용하면 추가 재고는 약204.2억이다. 167억은 가격 효과를 제외한 근사라고 한정해야 한다.
* M11: 최초 추가 허용이익1억을 매년 일정하다고 하려면 rate base·자본구조 유지가 필요하다.

CAPEX/감가상각, EPS/PER, 수율, PUE, 환율 예제의 제시 산식은 가정 안에서 정합했다. 합성 세율 대입을 실제 현행 과세표준 인증으로 세지 않았다.

## 기존 용어280개

280개 def·72개 수치 출처 행을 전편 읽었다. canonical core89/story89/screen45와의 merge 대조는 관련 항목에 한정하며 중복을 전수 신규 검토로 세지 않는다. 13F의 45일 신고기한과 최대 정보연령 혼동, NAAIM 0~100% 한정, ZBT 10일 EMA 누락, 풋콜패리티의 유럽형·동일조건·배당 전제 누락, 시장 축7개 명칭을6개로 셈, 옵션 만기손익과 만기 전 매매손익·Vega 1%p를 우선 교정한다.

현행 실제 시장 화면은 ‘달러·원자재’를 한 축으로 묶어 6개를 표시했다. 따라서 구현의 축 개수 결함으로 확대하지 않고 용어 정의의 불일치로 기록한다. legacy MDD 정의는 양호하며 추가 screen-term의 같은 이름이 merge에서 실제 채택되는지는 별도 확인한다. 교육적 손절·사이징 예시는 곧바로 개인화 지시라고 판정하지 않고 제품 행동범위와의 편집 정합 후보로 둔다.

공식 선택 대조: [SEC 13F FAQ](https://www.sec.gov/rules-regulations/staff-guidance/frequently-asked-questions-about-form-13f), [NAAIM 설명](https://naaim.org/programs/naaim-exposure-index/), [CFA 풋콜패리티](https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/option-replication-using-put-call-parity). 나머지 모든 법규·역사 수치 원문을 인증한 것은 아니다.
