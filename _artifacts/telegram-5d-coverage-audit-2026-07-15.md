# Telegram 3채널 5일 전수 감사 — 2026-07-15

## 범위와 완전성

- 기준 구간: 2026-07-11 00:00 KST ~ 2026-07-15 17:53 KST
- 수집 방식: 로그인된 Telegram Web DOM에서 채널 끝까지 반복 스크롤, `data-mid` 중복 제거, KST timestamp 기준 절단
- 총 관측: 546건

| 채널 | 7/11 | 7/12 | 7/13 | 7/14 | 7/15 | 합계 | 첫/마지막 관측 |
|---|---:|---:|---:|---:|---:|---:|---|
| aetherjapanresearch | 9 | 14 | 31 | 39 | 13 | 106 | 7/11 00:36 ~ 7/15 17:31 |
| insidertracking | 76 | 49 | 72 | 79 | 69 | 345 | 7/11 06:02 ~ 7/15 17:53 |
| bornlupin | 9 | 6 | 33 | 28 | 19 | 95 | 7/11 05:42 ~ 7/15 17:40 |

## 채널별 핵심 정보와 기존 반영 상태

| 채널 | 5일 핵심 축 | 기존 스크리너 반영 | 판정 |
|---|---|---|---|
| Aether Japan Research | 메모리/HBM/DRAM, TSMC·ASML·Nanya, 일본 반도체 장비/포지셔닝, AI CAPEX, 기업 실적/리포트 | `semi`, `equity`, `macro`, `power`와 주요 대형주 memo는 일부 반영. 일본·실적·수급의 독립 분류와 폭넓은 종목 연결은 부족 | 부분 반영 |
| Insider Tracking | 내부자 매매, XLK 임원 공개시장 매수, 지정학/호르무즈·유가, AI 전력망/데이터센터, 암호자산, 거시·수급 | 지정학·거시·전력·암호는 반영. `insider`, `flows`, `earnings`, `healthcare` 태그가 없어 페이지별 의미 분리가 안 됨 | 부분 반영 |
| BornLupin | 한국/미국 반도체·메모리, SK하이닉스·삼성, AI 인프라, 실적/목표가, 포지셔닝 | 한국시장·반도체·주요 티커는 비교적 양호. 동적 티커 사전이 26개 수준이라 중소형/헬스케어/일본 종목 memo 연결 누락 | 부분 반영 |

교차 채널 공통 핵심은 ① AI 메모리/HBM 공급 제약과 CAPEX 지속성의 양면 논쟁, ② 높은 밸류에이션·레버리지 ETF·변동성 축소에 따른 포지션 위험, ③ 호르무즈/유가→인플레이션·금리 경로, ④ 데이터센터 전력·냉각·그리드 병목, ⑤ GLP-1/경구 비만약, ⑥ 내부자 공개시장 매수였다. 공개 시장 기사도 반도체 이익 성장과 동시에 밸류에이션·AI CAPEX 지속성 논쟁, 호르무즈발 유가 위험을 확인해 방향성은 상충하지 않았다.

## 기존 자동 산출물과의 정량 대조

`public-data/telegram-digest.json`의 5일 구간에서 UI/chat에 보존된 고득점 원문 합집합은 254건이었다.

| 채널 | 브라우저 실제 관측 | 기존 보존 원문 | 보존률 |
|---|---:|---:|---:|
| aetherjapanresearch | 106 | 57 | 53.8% |
| insidertracking | 345 | 122 | 35.4% |
| bornlupin | 95 | 75 | 78.9% |
| 합계 | 546 | 254 | 46.5% |

이는 모든 게시물을 화면에 노출해야 한다는 뜻이 아니라, 기존 `count`가 전체 관측 수처럼 보이면서 실제로는 capped `topItems`/`broadItems`의 재병합 수를 세었다는 lineage 문제다. 낮은 점수 게시물은 ID·태그조차 보존되지 않아 누락량과 채널별 커버리지를 감사할 수 없었다.

## 22개 페이지 전수 판정과 보강 경로

| 페이지 | 필요한 Telegram 정보 | 수정 전 | 수정 후 소비 계약 |
|---|---|---|---|
| home | 시장 핵심·한국·거시·반도체 | 부분 | feed/chat 매핑 |
| signal | 실적·수급·내부자·거시 | 부족 | feed/chat 매핑 |
| breadth | 수급·리스크온/오프·신용 | 부분 | feed/chat 매핑 |
| sentiment | 레버리지·옵션·내부자·암호 | 부족 | feed/chat 매핑 |
| briefing | 전 주제 요약 | stale 7/3 narrative | 동적 narrative |
| technical | 반도체·전력·수급·실적 | 부분 | feed/chat 매핑 |
| macro | 금리·물가·유가·일본 | 부분 | feed/chat 매핑 |
| fxbond | 금리·신용·유가·엔/일본 | 부분 | feed/chat 매핑 |
| fundamental | 실적·기업·헬스케어·내부자 | 부족 | feed/chat 매핑 |
| themes | AI 인프라·메모리·전력·헬스케어 | 부분 | feed/chat 매핑 |
| theme-detail | 개별 테마 근거 | 부분 | feed/chat 매핑 |
| portfolio | 보유종목 촉매·내부자·수급 | pageMap 누락 | ticker memo/chat |
| ticker | 개별종목 최신 촉매 | pageMap 누락 | ticker memo/chat |
| market-news | 전체 최신 원문 | 일부 보존 | feed/chat 매핑 |
| options | 감마·옵션·변동성·수급 | pageMap 누락 | chat 매핑 |
| screener | 종목별 실적·내부자·공급망 | pageMap만 일부 | ticker memo/chat |
| kr-home | 한국 핵심·수급 | 부분 | feed/chat 매핑 |
| kr-supply | 외국인/기관·레버리지 | 부분 | feed/chat 매핑 |
| kr-themes | 한국 반도체·전력·헬스케어 | pageMap 누락 | feed/chat 매핑 |
| kr-macro | 한국·일본·글로벌 거시 | 부분 | feed/chat 매핑 |
| kr-technical | 한국 차트·수급 촉매 | 부분 | feed/chat 매핑 |
| guide | 투자 뉴스 데이터 불필요 | 미정의 | 명시적 `not-applicable` |

일부 미국 페이지의 독립 Telegram 카드는 현 디자인에서 중복 정보면으로 숨겨져 있다. 이번 수정은 그 카드를 무조건 되살리지 않고, page map·chat context·종목 memo의 소비 경로와 `getTelegramPageCoverageAudit()` 감사 결과를 일치시키는 방식이다.

## 근본 원인과 구조적 수정

1. `lastPostId` 증분 수집과 capped 원문 재병합 때문에 전체 관측 lineage가 사라짐
   - 전체 기간의 경량 `observedItems`(ID/channel/time/score/tags/tickers/hasText)를 별도 보존
   - `count`, 채널 count, text 적격 수, high/broad signal 수, selected payload 보존률을 분리
   - 구형 artifact 전환 기간은 `legacy-partial`과 완전성 도달 예정시각을 표시하고, 완전 수집으로 가장하지 않음
2. `count`/채널 count 의미가 증분 fetch 수와 기간 전체 수 사이에서 혼재
   - `freshCount`, `count`, `eligibleTextCount`, `selectedCount`를 분리
3. 정적 2026-07-03 테마·촉매·카테고리·pageMap이 동적 원문보다 우선
   - producer가 현재 원문에서 narrative를 매 주기 생성
   - 구형 artifact에는 runtime이 현재 `broadItems`에서 narrative/pageMap을 재생성
4. 26개 수준 하드코딩 티커 맵
   - `SCREENER_DB` 종목명/심볼을 읽는 동적 alias 사전 추가, 기존 고신뢰 별칭 유지
5. 분류 체계 누락
   - `insider`, `earnings`, `flows`, `healthcare`, `japan`을 1급 태그로 추가
6. 페이지 계약 불완전
   - 22개 전 페이지 map, 22개 route coverage audit, guide의 명시적 비적용 상태 추가
7. 공개 미러 전 채널 실패 시 성공 산출물 덮어쓰기 위험
   - 이전 성공 digest의 `generatedAt`과 본문을 보존하고 `attemptedAt`/실패 상태만 갱신

## 데이터 신선도 부수 감사

- 동적 `public-data/data.json` 핵심 시세/뉴스는 2026-07-15 기준 정상.
- 정적 `DATA_SNAPSHOT` fallback은 2026-07-03으로 뒤처져 있으나 live producer가 정상일 때 판단값으로 승격되지 않는 reference fallback이다.
- AAII/NAAIM/II/Put-Call/VIX/HY/breadth 정적 차트 seed는 대체로 2026-06-03~06-05에서 멈춰 있다. 동적 소스가 우선하지만 장애 시 시각화 reference가 낡으므로 `DEGRADED_REFERENCE`로 취급해야 한다.
- 이번 범위에서는 검증되지 않은 Telegram 값을 가격·금리·매매신호 숫자로 직접 승격하지 않았다. Telegram은 계속 `REFERENCE/secondary` 입력이다.

## 외부 장애

로그인 브라우저 전수 수집은 성공했으나 Node의 Telegram 공개 미러 재수집은 3채널 모두 네트워크 실패했다. 기존 정상 `public-data/telegram-digest.json`은 복구해 보존했으며, 새 producer 계약은 다음 성공 주기부터 경량 전체 lineage를 누적한다.
