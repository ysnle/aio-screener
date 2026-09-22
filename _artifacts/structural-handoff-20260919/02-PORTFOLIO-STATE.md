# 02 — 포트폴리오의 빈 상태·현금·평가 가능 상태를 분리하기

기획·설계·집필: Astra · 2026-09-19 · 상태: 제한된 범위의 구현 핸드오프

> 2026-09-20 상태 변경: 다른 작업의 `e55eef47`이 portfolio surface v3를 구현했다. 아래 v2 문제를 현재 미해결로 그대로 사용하지 않는다. 현재 결과와 잔여 인수 경계는 `RECHECK-20260920.md`를 우선한다.

## 1. 목적과 범위

개인 보유 정보를 읽는 상태와 시세를 평가하는 상태를 분리한다. 이 패키지는 회계 플랫폼 재설계, 거래내역 원장, 세금·배당·다중통화 수익률 시스템을 만들자는 제안이 아니다. 현재 지원하는 보유 수량·단가·현금·시세를 **정확한 상태와 분모로 보여주도록** 보강한다.

기존 AES-GCM Vault 경로를 유지한다. `src/app/bootstrap.js:370–373`은 runtime reader를 통해 기존 Vault를 읽고 추가 plaintext 저장소를 만들지 않도록 명시한다. 이번 감사는 개인 데이터를 읽거나 저장하지 않았으며, 합성 상태만 사용했다.

## 2. 실제 데이터 흐름

```text
기존 Vault / getPortfolioState / getPortfolioData
  → src/data/runtime-readers.js readPortfolio
  → src/data/providers/portfolio.js
  → src/data/normalize/portfolio.js
  → portfolio slice
  → src/domain/portfolio/surface.js derivePortfolioSurface
  → src/ui/pages/portfolio.js
```

UI render는 slice 이외에 `root._liveData`도 별도로 읽는다(`portfolio.js:314–326` 부근). 따라서 단순히 holdings state만 정규화하는 것으로 전체 valuation의 재현성이 확보되는 것은 아니다. 이 의존은 후속 분리 대상이며, 이번 작은 수정에서 live quote 검증을 제거하지 않는다.

## 3. 확정된 문제와 제한적 위험

### P01 — 현금만 보유한 상태가 총자산 미수신으로 표시된다

**우선순위 P2 / 순수 함수 및 실제 page module의 합성 DOM 실행으로 확인.**

입력 `holdings: [], cash: 10000, status: 'empty'`를 normalize→domain으로 실행한 결과:

| 필드 | 실제 결과 | 의도할 결과: 정상 로드된 현금 전용 계정 |
|---|---:|---:|
| cash | 10,000 | 10,000 |
| positionValue | null | 0 |
| totalAssets | null | 10,000 |
| cashPct | null | 100 |
| holdingCount | 0 | 0 |

동일 합성 state를 실제 `createPortfolioPage`에 주입해 렌더하면 `현금 $10,000`, `총 자산 —`, `포트폴리오 등록 후 자동 계산됩니다`, `포트폴리오가 비어 있습니다`가 함께 나온다(`core-runtime.json`). 이는 실제 입력 저장·Vault 잠금/해제까지 실행한 E2E는 아니다.

원인은 `src/domain/portfolio/surface.js:200–203`이다. rows가 없으면 positionValue를 무조건 null로 두고, totalAssets는 positionValue가 있을 때만 계산한다. cash는 독립적으로 지원되며 HTML에 `pf-cash-input`도 있다(`index.html:11244`). **빈 배열이 의도적으로 비어 있다는 증거가 있는 경우**와 아직 저장소를 읽지 못한 경우를 구분해야 한다.

### P02 — 일부 평가 불가 상태도 current가 될 수 있다

**우선순위 P2 / 합성 함수 실행 및 코드 확인.**

가격이 있는 AAA와 가격이 없는 BBB를 함께 입력했을 때 positionValue/totalAssets/totalPnl은 null로 안전하게 보류됐다. 이 동작은 유지한다. 그러나 `status`는 `current`로 남았다(`portfolio-domain.json`). provider/normalizer는 holdings 존재를 current로 취급하고 domain은 계산 불가일 때 그 status를 재사용한다(`surface.js:229–235`).

현재 status는 “보유 입력 있음”과 “평가 가능/현재 시세” 중 무엇을 뜻하는지 모호하다. 실제 UI는 별도의 reference-only 문구를 사용하므로 이 값 하나만으로 사용자에게 거래 승인이 표시된다고 주장하지 않는다. 다만 상위 소비자가 current를 valuation readiness로 해석할 위험이 있다.

### P03 — 보유 종목 비중과 자산 비중의 분모가 다르다

**우선순위 P2 / 계산은 의도될 수 있으나 라벨 의미 보강 필요.**

domain의 sectorBreakdown은 현금을 포함한 totalAssets를 분모로 쓴다(`surface.js:218–224`). holdings 표와 도넛은 positionValue를 분모로 쓴다(`portfolio.js:250` 부근과 `renderPortfolioChart`). 현금 100 + 주식 100이면 표의 해당 주식 비중은 100%, 전체 자산 기준은 50%다.

이것은 산술 오류라고 단정하지 않는다. 둘 다 유효한 분석이다. 하지만 헤더 `비중`만으로는 분모가 드러나지 않는다. 표는 `주식 내 비중`, 전체 자산 배분은 `현금 포함 자산 비중`으로 표현을 구분하고 계산 결과에도 basis를 남겨야 한다.

### P04 — 선택적 저장소 fallback은 재연결 전에 정리 필요

**우선순위 P3 / 합성 provider 경로에서 확인, 현재 bootstrap에는 repository 인자를 전달하지 않음.**

`src/data/providers/portfolio.js:11`은 stored.holdings가 빈 배열이면 runtime.holdings로 fallback한다. 저장소에서 명시적으로 비운 배열과 저장소 값 부재를 구별하지 않는다. 또한 stored price를 유지하더라도 quoteObservedAt은 live 값 또는 null로 덮는다(`:24–29`).

이는 현재 사용자의 삭제 종목이 복원된다는 재현이 아니다. 현재 wiring은 repository를 연결하지 않으므로 해당 경로의 즉시 사용자 영향은 확인되지 않았다. 향후 repository를 켜거나 data plane을 이전하기 전에 제거/명세화할 계약 부채로 남긴다. 지원하지 않는 추상화라면 유지 대신 삭제하는 편이 더 작을 수 있다.

## 4. 목표 상태 모델

제안: 하나의 `status`가 모든 뜻을 대신하지 않게 한다. 기존 slice를 확장하고 데이터 저장 경로는 추가하지 않는다.

```ts
type PortfolioReadState = 'loading' | 'locked' | 'ready' | 'failed';
type PortfolioValuationState = 'empty' | 'cash-only' | 'complete' | 'partial' | 'unavailable';
type PortfolioPresentation = {
  readState: PortfolioReadState;
  valuationState: PortfolioValuationState;
  holdingsKnown: boolean;
  cashKnown: boolean;
  valuedHoldingCount: number;
  holdingCount: number;
  positionValue: number | null;
  totalAssets: number | null;
  asOf: string | null;           // 평가 관측 시각, 저장시각과 분리
  allowedUse: 'reference';
};
```

불변식:

- 정상 읽기 완료 + 명시적 빈 holdings → positionValue 0. locked/loading/failed는 동일하게 0으로 바꾸지 않는다.
- cash가 알려져 있고 positions 평가가 완결된 경우만 totalAssets를 계산한다.
- cash-only에서는 총자산=현금, 노출=0%, 현금비중=100%다. 총자산 0이면 비중 분모가 0이므로 비율은 `해당 없음`으로 표시한다.
- 일부 시세가 없으면 부분 평가 합계를 총자산으로 표시하지 않는다. 원하면 `평가 확인분`을 별도 이름으로 제공하되 총자산과 구분한다.
- 원가를 현재가로 대체하지 않는다. 참고/지연 시세를 보여주는 경우에도 관측일과 상태를 표시한다.
- 저장시각·가격 관측시각·최근 화면 갱신시각을 바꾸어 사용하지 않는다.
- 모든 값은 현재 제품의 reference-only 경계를 유지한다. 이 개편으로 decisionEligible을 true로 바꾸지 않는다.

## 5. 사용자 흐름

| 상태 | 주요 표시 | 다음 행동 |
|---|---|---|
| 첫 방문/읽기 전 | 불러오는 중 또는 저장된 포트폴리오 없음 | 필요 시 초기 입력 |
| Vault 잠김 | 잠금 해제 필요, 금액 숨김 | 잠금 해제 |
| 현금만 있음 | 총자산·현금 일치, 주식 보유 없음, 노출 0% | 종목 추가 또는 현금 수정 |
| 알려진 0자산 | 총자산 $0, 비중 해당 없음 | 입력 추가 |
| 일부 시세 실패 | 평가 보류 n/m, 성공한 행은 관측값 유지 | 해당 시세 재시도 |
| 참고 시세 완결 | 참고 평가액과 가장 오래된 유효 관측 시각 | 출처 확인 |
| 저장소 읽기 실패 | 읽기 실패, 기존 입력 유무를 단정하지 않음 | 재시도/지원되는 복구 |

## 6. 구현 작업 패키지

### W02-A — 입력 존재와 평가 상태 분리

소유: runtime reader의 portfolio 부분, provider, normalize, slice, domain.

Vault 인터페이스가 실제로 어떤 읽기/잠금 상태를 제공하는지 먼저 확인한다. 그것이 없으면 빈 배열만 보고 ready를 추정하지 말고 읽기 성공을 구분하는 최소 envelope를 만든다. 숫자 변환 helper는 null/빈 문자열/boolean 정책을 명시한다. cash-only와 known zero를 지원하되 unknown은 그대로 null을 보존한다.

### W02-B — 하나의 평가 ViewModel로 UI 투영

소유: `src/ui/pages/portfolio.js` 및 대응 HTML.

hero, status, empty row, 섹터 배분, holdings table, chart legend가 같은 valuationState를 쓰도록 맞춘다. 렌더 중 `_liveData`를 직접 읽는 부분은 selector/domain 호출 경계로 전달하여 합성 입력 재현이 가능하게 한다. chart를 만들 수 없는 것과 평가값이 없는 것을 구분한다. 직접 window 접근을 제거하려고 quote의 provenance 검증을 약화하지 않는다.

### W02-C — 분모와 개인정보 문구 확인

table/chart/sector의 weight basis를 명시한다. 별도로 현재 `서버 전송 없음` 문구가 AI 분석 요청 등 다른 기능에도 정확한지 실제 전송 payload와 대조한다. 이번 조사에서 외부 전송 사실을 확인하지 않았으므로 문구를 바로 거짓이라고 단정하지 않는다. 이 확인은 AI 패키지와 연결한다.

## 7. 인수조건

1. cash-only $10,000을 저장→재로드→잠금 해제한 실제 동선에서 총자산 $10,000과 주식 미보유가 함께 표시된다.
2. 마지막 종목 삭제 후 현금이 남아 있으면 cash-only로 전환된다. 삭제 전 holdings가 fallback으로 되살아나지 않는다.
3. locked/failed storage에서 totalAssets가 $0으로 보이지 않는다.
4. 유효한 0자산과 미입력 null을 구별한다. 비율의 NaN/Infinity가 없다.
5. 2종목 중 1종목 시세 실패 시 totalAssets/총손익 보류를 유지하고 n/m 평가 상태를 보여준다.
6. 현금 100/주식 100에서 주식 내 비중 100%와 전체자산 비중 50%가 분모 라벨로 구별된다.
7. 과거 시세→새 시세→원천 실패 순서에서 관측일/출처/수치가 동일 envelope로 이동한다.
8. 손익·현금·메모가 허가 없는 추가 저장소에 복제되지 않는다. 기존 Vault 호환성 확인은 별도 실제 브라우저 증거로 보고한다.

현재 확보한 증거는 `portfolio-domain.json`의 5가지 합성 사례와 `core-runtime.json`의 실제 renderer 주입 결과다. Vault 저장·복구·암호화·AI 전송·실제 개인 데이터는 미검증이다.

## 8. 구현 에이전트 요청

> 현재 portfolio surface v3와 위 인수조건을 대조하고 미충족 경계만 보강한다. W02-A/B를 역사적 v2 처방 그대로 재구현하지 않는다. 저장·잠금·복구는 11의 durable 상태/통화와 함께 검증한다. W02-C 전송 문구는 실제 payload 조사 후 판단한다. 저장소 교체 필요성은 19의 계약·migration 기준으로 결정하며 자동 커밋·푸시·배포하지 않는다.
