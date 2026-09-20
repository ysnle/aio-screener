# 01 — 수치·해석·신뢰 상태를 같은 관측에 연결하기

기획·설계·집필: Astra · 2026-09-19 · 상태: 구현 핸드오프 초안, 코드 변경 없음

> 2026-09-20 상태 변경: 다른 작업의 `e55eef47`이 W01/W01-C를 구현했다. 아래 발견·줄번호는 v55.21 기준 기록이다. 현재 재검증은 `RECHECK-20260920.md`를 우선하며 같은 수정을 중복 구현하지 않는다.

## 1. 이번 패키지의 결론

첫 개편 단위는 **sentiment의 수치 카드와 복합 판단을 하나의 상태 projection으로 합치는 것**이다. 그 다음 같은 계약을 home의 시장 상태 배지에 적용한다. 화면별 native 전환 수보다 사용자에게 같은 시점·같은 관측·같은 허용 용도를 설명하는지가 우선이다.

현 구조의 장점도 보존해야 한다. ESM 수치 카드는 결측을 보류로 표시하고 출처/허용 용도 속성을 갖는다. 시장 점수도 필수 입력이 없을 때 숫자를 만들지 않는다. 문제는 해당 방어가 페이지의 다른 설명과 배지까지 하나의 계약으로 이어지지 않는 데 있다.

## 2. 확인한 사실

### S01 — Put/Call 카드와 복합 판단이 서로 다른 값을 말한다

**우선순위: P1 / 로컬 브라우저 재현 + 코드 경로 확인.**

외부 API를 차단한 로컬 화면에서 sentiment의 Put/Call 카드는 `0.79`, 복합 판단은 `P/C비율 1.08 — 풋 우세 구간`을 표시했다. 카드에서는 중립이라고 표시한다. 숫자의 반올림 차이가 아니라 해석 구간까지 달라진다. 이 환경에서 어느 값이 실제 시장의 진실인지 인증하는 것이 아니라, **같은 지표를 같은 화면이 다르게 설명한다는 문제**다.

현재 경로:

| 역할 | 코드 근거 | 의미 |
|---|---|---|
| 초기 HTML | `index.html:7741` | `pc-score-big`에 관측 증거 없는 초기 숫자 `1.08`이 들어 있다 |
| 현재 관측 읽기 | `src/data/runtime-readers.js:174` | payload → runtime ratio → snapshot 순서로 Put/Call 관측을 만든다 |
| native 카드 | `src/ui/pages/sentiment.js:265` | state의 `sentiment.putCall`을 카드와 needle에 표시한다 |
| legacy 설명 | `js/aio-kr-data.js:3097` | state가 아니라 `fg-score-big`, `pc-score-big`의 DOM 텍스트와 `_liveData`를 읽어 문장을 만든다 |
| 별도 타이머 | `js/aio-data.js:15908`, `15916`, `15922` | 외부 데이터 흐름에서 200ms 타이머로 설명 갱신을 예약한다 |
| 구독 분리 | `src/ui/pages/sentiment.js:272`, `299` | native는 복합 판단 writer를 갖지 않고 state 구독으로 카드/차트만 갱신한다 |

**구조적 원인:** 서로 다른 DOM을 쓰기 때문에 double-writer 검사는 통과할 수 있다. 그러나 하나의 의미 단위가 서로 다른 갱신 주기와 입력 경계를 갖는다. 따라서 DOM writer 교집합 0은 의미 정합성 완료 조건이 아니다. 첫 브라우저 순회만으로 모든 정상 네트워크 시나리오에서 항상 재현된다고 주장하지 않는다.

**후속 반증 확인:** home에서 sentiment로 직접 진입한 별도 실행에서는 1.2초·6.2초·16.2초 관찰 모두 카드/설명이 `0.79`로 일치했다. 따라서 상시 불일치가 아니라 **라우트 방문·비동기 갱신 순서에 의존하는 재현 사례**로 취급한다. 최초 전체 순회 결과는 `browser-routes.json`, 후속 결과는 `sentiment-followup.json`에 보존한다. 구현 fixture는 두 순서를 모두 고정해야 한다.

사용자 영향: 같은 화면에서 중립과 풋 우세를 함께 읽고 어느 해석이 최신인지 알 수 없다. 이후 AI 문맥이 DOM이나 별도 globals를 읽으면 모순이 다른 기능으로 전달될 수 있으나, AI 전달 여부는 이 패키지에서 미검증이다.

### S02 — home의 보류 상태와 상승 추세 배지는 서로 다른 판단 기준을 숨긴다

**우선순위: P1 / 로컬 화면 관찰 + 정적 경로 확인.**

외부 공급자 차단 조건에서 home의 주 점수는 `판정 보류 — 필수 입력 미수신`인데 상단에는 녹색 `상승 추세` 배지가 남는다. 두 값이 논리적으로 반드시 모순인 것은 아니다. 종합 점수와 ATH 대비 위치는 서로 다른 지표이기 때문이다. 문제는 후자를 현재 시장의 일반적인 추세 판단처럼 읽게 한다는 것이다.

`js/aio-data.js:15647`부터 legacy는 S&P 가격과 ATH 간 거리를 계산하고 `-5/-10/-20%` 구간으로 `UPTREND/PULLBACK/CORRECTION/DOWNTREND`를 정한다. `15653`의 입력 부재 분기에서는 상세 regime만 보류로 바꾸고 반환하며, 아래 `15687`의 `home-risk-regime-badge` 갱신에는 도달하지 않는다. 따라서 이미 그려진 배지를 동일 전환에서 초기화하지 않는 경로도 존재한다. 실제 값 제거 후 배지 잔존은 별도 fixture로 인수 검증할 항목이다.

이 분류는 가격 이력의 기울기나 이동평균 추세를 직접 측정하는 모델이 아니다. 가격 수준이 ATH 근처라는 사실과 상승 추세라는 주장을 분리해야 한다. 또한 snapshot fallback을 사용한 참고 관측인지 배지에서 알 수 있어야 한다.

### S03 — 브라우저에 보이는 상태 설명이 데이터 복구 행동까지 이어지지 않는다

**우선순위: P2 / 장애 조건 UX 관찰.**

technical은 OHLCV 미수신, themes는 RRG 증거 부족, fundamental은 SEC 미수신을 비교적 구체적으로 알린다. 이는 유지할 동작이다. 그러나 여러 화면의 `수신 대기`와 home의 `시세·뉴스 상태 확인 중`은 이번 외부 차단 순회에서 공급자 실패·마지막 성공·사용자 재시도 조건을 충분히 구별하지 않았다. 짧은 순회이므로 무한 대기 결함으로 확정하지 않는다.

개선 목표는 모든 보류 상태에 버튼을 붙이는 것이 아니다. 사용자가 해결할 수 있는 실패만 재시도를 제공하고, 연구용 또는 원천 자체가 없는 상태는 필요한 근거를 설명해야 한다. timeout 후 상태가 어떻게 수렴하는지는 후속 복구 테스트로 측정한다.

### S04 — 결측 점수가 설명에서 0점으로 변환된다

**우선순위: P1 / 로컬 브라우저 관찰 + 정확한 변환 경로 확인.**

후속 sentiment 실행에서 `시장 환경 연동` 문장은 `트레이딩 스코어 0/100 — 현재 입력상 환경 점수가 낮습니다`라고 표시했다. 같은 외부 차단 조건의 실제 runtime에서 `computeTradingScore().total`은 `null`이었다(`core-runtime.json`).

`js/aio-kr-data.js:3241`은 `Number(tsRead2 && tsRead2.total)`을 호출하므로 `Number(null) === 0`이 된다. 이후 finite 검사로는 이를 거를 수 없다. native signal domain은 `src/domain/signal/trading-score.js:291`에서 null을 보류/NO_ACTION으로 처리한다. 결측을 낮은 점수로 해석하는 소비 경계가 남아 있는 것이다.

이는 값 부족과 악화된 시장 상태를 혼동시키는 확정 경로다. W01-A에서 null-preserving numeric 읽기를 사용하고 점수의 availability/근거 상태를 함께 전달해야 한다. null을 먼저 0으로 바꾼 뒤 출처 배지만 추가하는 수정은 불충분하다.

## 3. 목표 계약 — 페이지의 의미 단위를 한 번에 투영

아래는 구현 방향을 고정하기 위한 제안 타입이며 현재 API가 아니다. 기존 evidence envelope에 맞춰 확장하고 같은 이름의 별도 저장소를 만들지 않는다.

```ts
type MetricPresentation = {
  metricId: string;
  value: number | null;
  unit: string;
  evidenceId: string | null;
  observedAt: string | null;
  sourceLabel: string;
  freshness: 'current' | 'stale' | 'unknown';
  allowedUse: 'reference' | 'decision' | 'none';
  availability: 'ready' | 'partial' | 'missing' | 'failed';
};

type SentimentViewModel = {
  revision: string;              // canonical input revision / stable fingerprint
  metrics: MetricPresentation[];
  narratives: {
    claimId: string;
    inputMetricIds: string[];
    inputEvidenceIds: string[];
    text: string;
    status: 'reference' | 'withheld';
  }[];
};
```

`freshness`, `availability`, `allowedUse`는 한 개의 `status` 문자열로 합치지 않는다. 예를 들어 새로 수집한 참고값은 available/current이면서도 decision 허용은 아닐 수 있다. 화면에 보여줄 수 있는 값인지와 종합 판단에 사용할 수 있는 값인지도 분리한다.

카드와 해설은 동일 ViewModel revision으로 렌더한다. 설명 생성 함수는 DOM, `window`, 네트워크, 시간 조회를 하지 않는다. 현재 시각이 필요하면 명시 인자로 받는다. 서술은 문장과 사용한 근거 ID를 반환하고 UI는 이를 표기한다. F&G·VIX·P/C가 서로 다른 관측일이면 종합 결론을 만들기 전에 호환성 정책을 적용한다.

## 4. 사용자에게 보여줄 결과

- Put/Call: `0.79 · CBOE 총계 · [관측일] · 참고값`과 같은 카드 정보를 사용한다. 세부 출처가 없으면 출처 확인 대기라고 표시한다.
- 복합 판단: 카드와 같은 `0.79`에 근거한 문장만 표시한다. 입력이 모자라면 해당 문장을 보류하고 사용 가능한 개별 사실은 남긴다.
- home: ATH 거리만 계산했다면 `고점 대비 -x.x% · 참고 관측`으로 이름을 좁힌다. 별도 추세 모델을 유지하려면 그 모델의 입력·관측일·보류 정책을 명시한다. 이 패키지는 새 추세 알고리즘 도입을 요구하지 않는다.
- 보류: `현재 판단 보류` + `누락된 입력` + `마지막 확인 시각/상태`를 제공한다. 사용자에게 불필요한 내부 함수명이나 native/legacy 용어는 노출하지 않는다.

## 5. 구현 작업 순서와 소유권

### W01-A: sentiment 설명의 순수 도메인화

대상: `src/domain/sentiment/metrics.js`와 필요시 같은 디렉터리의 narrative 모듈. 기존 설명의 임계값과 교육적 경계를 목록으로 옮기고, 새로 정확성이 입증되지 않은 문장은 관측 사실 또는 확인 질문으로 줄인다. `spyChg` 결측을 0으로 보간하는 기존 경로(`js/aio-kr-data.js:3134` 부근)는 값 없음과 보합을 분리한다. 정책/표현 변경은 단순 이동과 따로 리뷰한다.

### W01-B: 하나의 렌더·구독 경계로 cutover

대상: `src/ui/pages/sentiment.js`, `js/aio-kr-data.js`, `js/aio-data.js`, `index.html`, `architecture/route-owners.json`.

1. state/evidence에서 ViewModel을 만들고 카드·needle·복합 판단이 같은 revision을 쓰도록 연결한다.
2. 초기 HTML의 시장 숫자를 근거 없는 초기값 대신 placeholder로 바꾼다.
3. `_generateSentimentAnalysis`와 관련 action-guide의 실제 호출·export·읽기 소비자를 조사한다.
4. native writer를 켜는 동일 변경에서 경쟁 legacy writer와 별도 갱신 타이머를 제거하거나 명시적인 단일 adapter로 바꾼다. legacy 설명과 native 설명을 동시에 활성화하지 않는다.
5. narrative owner를 근거에 맞게 갱신한다. 차트·데이터·부팅 전부 native라고 확대 표기하지 않는다.

### W01-C: home regime 표시 계약 정렬

대상: `src/ui/pages/analysis.js`, home selector/domain, `js/aio-data.js`의 regime writer, 관련 HTML.

ATH 거리와 종합 점수의 의미를 분리한다. 입력이 사라질 때 배지·설명·색상·evidence 속성을 함께 초기화한다. 배지의 writer를 옮길 경우 기존 consumer와 `_aioRefreshActionPlan` 등 후속 호출을 삭제하지 않도록 먼저 추적한다. 이 패키지에서 전체 home legacy 함수를 일괄 삭제하지 않는다.

## 6. 인수조건 — 구조 검사와 의미 검사를 모두 수행

| 시나리오 | 요구 결과 | 증거 수준 |
|---|---|---|
| 초기 진입 → snapshot `0.79` | 카드와 설명의 수치·구간·근거 ID 일치; 초기 `1.08` 설명 노출 없음 | 합성 + 로컬 브라우저 |
| 새 관측 `1.21` 도착 | 카드와 설명 모두 같은 revision으로 이동 | 런타임 |
| P/C 삭제, F&G/VIX만 존재 | P/C 문장 보류; 이전 P/C 결론 잔존 없음 | 런타임 + DOM |
| 오래된 참고값 | 값은 참고로 표시 가능; 현재 복합 판단으로 승격하지 않음 | 도메인 + DOM |
| 서로 다른 관측일/종류 | 통합 결론 제한과 그 이유 표시 | 의미 fixture |
| SPY 등락 결측 vs 0% | 두 입력을 구별하고 보합으로 보간하지 않음 | 도메인 |
| 시장 점수 `null` vs 실제 `0` | null은 연동 보류, 유효한 0만 0점; 낮은 점수 문구가 결측에 붙지 않음 | 도메인 + 브라우저 |
| home 정상 → ATH/가격 소실 | 배지·설명·색상 모두 보류로 전환 | DOM |
| sentiment 이탈 후 늦은 응답 | inactive page에 stale revision 쓰기 없음; 재진입은 최신 state 사용 | lifecycle/browser |
| 외부 차단 후 회복 | 재시도 범위 제한, 최신 성공 관측으로 일관 수렴 | browser fixture |

회귀 게이트는 문자열 존재 검사만 추가하지 않는다. 같은 ViewModel revision으로 렌더된 사용자 가시 값과 문장의 근거를 직접 비교한다. 정상/결측/late response 최소 fixture를 작성한 뒤 관련 affected 게이트를 실행한다.

## 7. 범위 밖과 미검증

- Put/Call 원천값의 외부 사실 확인, 옵션 통계의 시장 전체 정확성은 미검증.
- threshold 모델의 예측력·투자 적합성은 승인하지 않는다.
- home 전체 서술, 20개 라우트의 모든 숨은 패널, AI 답변과의 동기화는 후속 패키지.
- 실제 구현·P 항목·버전 변경·커밋·배포는 아직 없다.

## 8. 구현 에이전트에 전달할 요청

> `01-SURFACE-CONSISTENCY.md`의 W01-A/B부터 구현하라. 기존 dirty 변경을 보존하고 현재 함수/소비자를 다시 확인한다. 우선 sentiment 카드와 설명의 같은 입력/같은 revision을 보장하고 legacy 설명 writer의 제거까지 완료한다. W01-C는 별도 변경 단위로 다룬다. 합성·로컬 브라우저 증거를 구분하고 live 검증이나 전체 native 완료를 주장하지 않는다. 자동 커밋·푸시·배포하지 않는다.
