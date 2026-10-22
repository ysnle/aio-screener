> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# 두 domain 파일 전문 보완 감사

MODE: review | VERDICT: PASS+NOTES | REF: 7e2411432f6ca0e5f02528b209b013bf5f7ff2dc

이번 두 파일 전문에서 새 ACT ON 0건. 기존 domain delta의 D59-01/02는 이 판정으로 해소되지 않는다. 전문 읽기와 고정 입력의 조건 경계 확인에 한정하며, 브라우저·실제 다음 거래일 재판정·저장소 전체 인증이 아니다. Independence: limited(동일 모델 팀).

## 범위와 원장 정정

`src/domain/briefing/market-read.js`, `src/domain/entity/stock-read.js`를 고정 git show 원문으로 처음부터 끝까지 직접 읽었다. market-read는 날짜·세션·결측 정규화→관측 stats→조건별 read→주도주 확인/hysteresis→6개 축 rule→flipDistanceSearch→표시문과 전체 판정 흐름, stock-read는 공시/issuer 일치→이동평균/52주 위치→상대수익률→ADR 거리/RSI→섹터·테마→시장/보유·순위→facts 전달을 추적했다. 각 SHA256와 줄 수는 별도 domain-complete-reading.tsv의 FULL 2개다.

앞선 domain-reading.tsv의 전체 diff 표시는 전문 기반을 뜻하지 않았지만 FULL_DIFF_REVIEW 이름은 이를 과장할 여지가 있었다. 이전 FULL 기반이 없는 7개(factors, macro-sources, market-analysis-numbers, market-analysis-validate, daily-diff, market-read, entity/stock-read)를 최초 delta 원장에서 DIFF_ONLY로 정정했다. 이 보고서가 후자의 두 파일만 FULL로 새로 보완하며 나머지 5개를 승격하지 않는다. 최초 보고서 수치도 FULL5/FULL_DIFF_REVIEW8/DIFF_ONLY7/HASH_REUSED62/PARTIAL10으로 정정했다.

## 현재 home 3개 조건 대조

고정 public-data/data.json/history.json/macro-history.json과 명시한 review clock=2026-10-21T03:00Z로 buildMarketRegime을 실행했다. 기준은 2026-10-20 미국 종가, leadershipBreak=true, 추세=중립이었다. 실제 daily-loop.js의 heroFlipRows 함수 구간을 별도 VM 모듈로 평가해 같은 선택 순서를 사용했다.

| 순서 | 현재→표시 목적 상태 | 실제 내부 threshold | threshold 양옆의 실제 axis rule 반환 | 정렬 기준 |
|---|---|---:|---|---:|
| 1 추세 | 중립→부담 | S&P 500 7704.2672(50일선) | 바로 아래 부담 / 정확히 같음 중립 / 바로 위 중립 | 평균 하루 변동폭 0.2배 |
| 2 변동성 | 중립→양호 | VIX 16.797(5거래일 +10%) | 바로 아래 양호 / 정확히 같음 중립 / 바로 위 중립 | 0.7배 |
| 3 달러·원자재 | 중립→부담 | WTI 104.049(20거래일 +10%) | 바로 아래 중립 / 정확히 같음 부담 / 바로 위 부담 | 1.3배 |

세 후보 모두 needsMore=false, also=[]라 미표시된 추가 조건은 없다. 표시상 7704 /16.80 /104.05로 반올림하며 내부 판정은 위 원값을 사용한다. 해당 순간 다른 입력을 고정한 rule에서 표시 방향으로 임계선을 넘을 때 실제 상태가 바뀌는 것을 실행했다. 가까운 순은 절대 % 크기나 달성 확률이 아니라 최근 20세션 평균 절대 일변동폭으로 정규화한 순서이며, 현재 3개 선택은 그 계약과 일치한다.

home의 “S&P가 50일선 아래 마감하면 추세 부담”은 `trendAt`의 leadership.break && gap50<0 분기와 직접 일치한다. 현재 주도주 이탈이 없으면 같은 분기는 작동하지 않으므로 이 문장을 모든 장세의 일반 규칙으로 인증하지 않는다. 현재 input의 leadershipBreak=true인 사실이 전제다.

또한 이 거리는 코드에 명시된 것처럼 오늘의 이동평균·5/20세션 기준값·연간 범위와 latch를 고정한 민감도다. 실제 다음 거래일에는 이동평균과 rolling 기준점, 주도주 확인 등이 함께 바뀌므로 같은 한 숫자만으로 다음 날 전체 buildMarketRegime 결과가 반드시 바뀐다는 예측으로 읽으면 안 된다. 이번 실행은 동결된 현재 rule의 경계 정합성을 검증했고 다음 거래일 미래 결과는 검증하지 않았다.

## 종목 요약과 FY 추가 확인

domain/entity/stock-read.js는 FY label을 만들지 않는다. 새 facts는 row의 pct50/pct200/ADR/RSI/ret1m와 factorSessionDate/priceDate를 그대로 전달한다. root가 브라우저에서 관측한 LDOS “네 가지 확인” FY2026은 UI helper 경계이며 이 domain 전문에서 별도 substring 원인을 찾았다고 주장하지 않는다. 신규 analysis-read의 FY helper 오류(D59-02)와 같은 클래스의 UI 생성 지점을 함께 고치는 것이 적절하다.

상대수익률/sector rotation은 원래의 ADR·relative band·최근 5세션 반대 방향 보류를 읽었다. 이 파일의 기존 ranking 문장·issuer별 공시 원문·모든 조합에 대한 새 fixture sweep은 수행하지 않았다. 기존 보고서의 finding을 이번 두 파일 FULL만으로 자동 해소하지 않는다.

## 실행과 안전 경계

`node --experimental-vm-modules _artifacts/architecture-quality-audit-20261021-v5859/domain-complete-probe.mjs` → exit0. 격리 VM이 고정 Git 상대 dependency만 연결한다. market-read의 flipDistanceSearch 시작점에 spec capture 한 줄만 삽입해 실제 stateAt closure를 관찰했고 판정 코드는 바꾸지 않았다. top3 각 threshold exact/below/above를 실행한 원값과 home helper 선택 결과는 domain-complete-result.json에 있다. 이 계측은 제품 파일을 쓰지 않는다.

본 보고서, 별도 전문 원장과 probe/result만 추가했다. 최초 delta 원장은 과장 방지 상태 정정만 했다. 제품·데이터·Git mutation·producer 실행·네트워크·유료 AI·commit/push/deploy 없음.
