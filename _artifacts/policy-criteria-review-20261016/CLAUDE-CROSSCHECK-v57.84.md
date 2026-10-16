# Claude 교차검증 · 개선 보고 (v57.84, 2026-10-16)

Codex가 작성한 `REVIEW.md`·`product/data/engineering-review.md`·`rule-dispositions.md`·`open-qa-review.md`를 코드·데이터와 직접 대조했다. 소유자 결정, Codex 판단, Claude의 과거 작업(v57.83 포함) 모두 같은 기준으로 봤다. 로컬 작업이며 commit·push·deploy는 하지 않았다.

## 1. Codex 주장 판정

| 주장 | 판정 | 근거 / 조치 |
|---|---|---|
| C1 원장 파서가 `## R<n>.`만 읽어 공백 번호가 부풀려짐 | **동의 (확인)** | 동결된 65개 중 실제 공백은 R111·R113·R136·R137·R171 다섯 개. 추가 발견: R230·R301이 각각 두 규칙에 중복 사용됨. → 파서 3형태 지원, 중복 검사, R709·R710 재번호 (P1855/R711) |
| C2 의미 검토 게이트의 하한과 인증 불가 구조 | **동의** | 얕은 테스트 50개 하한은 정리를 실패로 만든다. → 보고 전용, 증거 있는 인증만 허용 (P1856) |
| C3 AGENTS 32행 "어느 쪽이 더 나은지" vs R697/R698 | **부분 동의** | 문장은 실제로 모순이었다. 다만 시나리오별 유리한 선택(`macro-crossroads.js` `favored`)은 소유자가 결정해 현재 화면에 나가는 기능이라 코드는 건드리지 않았다. 문구만 "조건부 설명, 지시 아님, 개인 보유 대상 아님"으로 정리했다. 기능 자체를 유지할지는 소유자 결정(아래 4절) |
| AGENTS 35행 `sync-*` 금지 vs 62행 `sync-agent-*` 요구 | **동의** | 프로듀서를 이름이 아닌 효과로 정의 |
| 13F "다음 분기" 신선도 | **동의 (명확화)** | 분기 말 + 45일 제출 기한 기준. 보유 내역은 설계상 최대 약 4.5개월 묵음 |
| "원천 없는 위젯 숨김" | **동의** | 실패한 원천을 숨기면 결측이 안 보인다. 설계상 원천이 없는 위젯만 제거하고, 실패한 원천은 '없음'으로 표시 |
| `/assumptions` 무조건 정지가 배치를 막는다 (E09) | **반대** | 사용자가 직접 부르는 명령의 정지는 의도된 설계다. 범위만 한 줄 명확화 |
| R617 "반증 가능한 오류만 차단" vs R590 UNVERIFIED | **동의 (경계 추가)** | UNVERIFIED는 차단이 아니라 근거 등급이다 → R617 (8) |
| R613 "1차 출처가 살아 있으면 stale 해제" | **동의** | 휴일·발행 지연을 현재값으로 속인다. 관측 시각·발행 주기 기준으로 개정 |
| R614 비율 100% 상한 | **부분 동의** | 부분/전체 비율에만 적용, 성장률·배수는 이름으로 구분 |
| R156 Promise.any 의무 | **동의** | 첫 *유효* 결과. 유료·한도 원천은 순차, 동시 요청은 제한된 hedge로만 |
| R292 지역 차단 자동 재시도 | **동의 + 추가 결함** | 재시도는 P1421에서 이미 없어져 규칙 본문이 낡아 있었다. 추가로 분류 정규식이 일반 'forbidden' 403(Origin forbidden)을 지역 차단으로 오분류함 → P1857 |
| R230 `Number(...)` 정규화 | **동의** | `Number(null)`은 0이다. null을 보존하는 검사로 개정(R709로 재번호) |
| R554 헤드라인만 있는 뉴스를 AI 근거에서 제외 | **반대 (유지)** | 본문 없는 헤드라인은 근거 품질이 낮다. 권리와 무관하게 보수적인 쪽이 맞다 |
| 0–100 매매 점수가 아직 판정으로 쓰임 | **부분 동의** | 점수는 계산되지만 숫자는 화면에 나오지 않는다(`score-delta-tag` 요소가 없어 죽은 코드). 등급 문구는 예측 검증이 'established'일 때만 나오며 현재는 항상 '시장환경 관찰'. 위반은 아니고 정리 대상 |
| pricedMovePp "25bp 1회 반영" | **동의 (주석만)** | 화면 문구는 이미 '경로 이상/이하'로 중립적이다. 2년물은 기간 프리미엄을 포함한 방향 대리 지표라고 주석 정정 |
| 개연성 높음/중간/낮음 | **이미 해소** | 화면에는 "조건 충족 n/m"으로 나온다. `likelihood`는 내부 정렬 키와 data 속성으로만 쓰임 |
| 44px를 AA로 주장 | **이미 해소** | 현재 규칙은 목표 24px(AA 2.5.8), 주 내비게이션만 44px |
| 폐기 후보 5개 (R173·R292·R369·R383·R426) | **R173 폐기, R292 역사(대체됨), R369 역사, R383 개정, R426 검토 중** | R426은 모든 라우트에 판단 헤더를 두라는 의무가 8화면 정리와 맞지 않는다. 다만 어느 라우트에 둘지는 정보구조 결정이라 소유자에게 남김 |
| 사용자 검증 5명·90%·5% | **동의 (Codex보다 더 나아감)** | 5명이면 오해 1건이 이미 20%다. 이 규모는 문제 발견용이지 비율 추정용이 아님을 계약에 명시 |
| 열린 QA 186행 | **일부 반영** | 합격선이 잘못된 4행을 개정했다(V5731-20/21/22, MACRO-HISTORY-LIVE-01). 체크 상태는 바꾸지 않음. 나머지 '조건부 유지/중복 통합'은 판정만 하고 재작성하지 않음 |

## 2. Codex가 놓친 부분 (Claude 추가)

1. **FRED HY 스프레드의 권리.** FRED 시리즈 페이지에 ICE 고지가 있다: 어떤 형태로든 복제하려면 ICE의 사전 서면 허가가 필요하고, 2026년 4월부터 FRED는 3년치만 제공한다. 그런데 등록부는 이 시리즈를 '정부 공식 중계(T1)'로만 표시했다. → 소유자(ICE)와 권리 조건을 등록부·운영 상태에 표기했다. 등급은 정확도, 권리는 별도 축.
2. **R620 분해 게이트는 줄 수만 셌다.** Claude가 v57.83에서 선언을 한 줄로 합쳐 통과시킨 것이 바로 그 우회다. → 공백 제외 문자 수 래칫 추가 (P1858/R712)
3. **`text-pin-ok` 예외와 `--write`는 스스로 승인하는 통로였다.** → 예외 개수 동결, 증가 기록 거부
4. **R708 급변 재생 검사의 의미.** 이 검사는 판정끼리의 일관성 회귀 검사이지 예측력 검증이 아니다. 기준점 재생 구간은 합성 경로다. 규칙과 출력에 이 구분을 표기했다. 다만 Codex가 이 검사를 "동어반복"으로 본 것에는 반대한다. 실제로 200일선 아래에서 추세 82점이 나오던 모순을 잡아냈다.
5. **주도주 'weak' 상태와 매매 점수 가중치 자체도 검증되지 않은 판단이다.** 표기는 유지하되 R697 예측 검증의 대상으로 남긴다.

## 3. 바꾼 것 (v57.84)

- 게이트 (P1855–P1858, R711·R712):
  - 원장 파서와 중복 번호 검사
  - 의미 검토 게이트
  - AI 403 분류
  - 분해 문자 수 래칫
  - 텍스트 핀 예외 동결
- AGENTS:
  - 32행 선택지 문구
  - 33행 13F
  - 35행 프로듀서 정의
  - 39행 위젯 표시
  - 65행 push 절차
- RULES:
  - R617·R613·R614·R156·R292·R708 개정
  - R173·R369·R383·R426 처분 표시
- 기타:
  - QA 4행 개정
  - `/assumptions` 범위 명확화
  - data-refresh 스킬 프로듀서 문구
  - 금리 경로 주석
  - ICE 권리 표기
  - 사용자 검증 통계 근거
  - 급변 재생 출력 라벨

## 4. 소유자 결정이 필요한 것

1. **시나리오별 '유리한 선택'(`favored`)을 유지할지.** 소유자가 정한 기능이다. 예측 검증 없이 선택을 추천하는 것은 R697 취지와 긴장이 있다. 권고: 유지하되 "이 시나리오에서는 X의 비용이 작다"는 조건 설명형 문장으로만 쓴다(현재 문구가 대체로 이미 그렇다).
2. **판단 헤더를 어느 라우트에 둘지 (R426).**
3. **규제·절차 완화 범위** (2026-10-16 요청). 아래 문안을 AGENTS.md "Product decisions"에 넣는 것을 제안한다. 자동 모드에서 에이전트 지시문을 고치는 변경이 차단되어 직접 반영하지 않았다.

> - **Compliance scope (owner 2026-10-16):** an unpaid tool for family and friends, not a licensed screener or advisory service. Regulatory and certification procedures written for a public paid service (formal user studies, public-beta sign-off, 30-day SLO certification, per-provider license review as a feature blocker) are advisory, never blockers; provider terms are noted, attributed and respected in spirit (no bulk resale, no paywall bypass), not audited. What stays: secrets and the AI budget cap, data honesty (dates, stale/missing states, no invented numbers), no ticker guessing, and the quality rule that an unvalidated score is not shown as a verdict — those protect the readers, not a regulator. The site and repository are publicly reachable, so anything published is visible beyond the family.

## 5. 운영자 후속

- Cloudflare Worker Smart Placement(또는 placement hint): 지역 403의 정당한 해법
- SMH 일별 열: push 후 Actions 백필이 필요함(history.json에 아직 0행)
- v57.83·v57.84 모두 로컬 미푸시
