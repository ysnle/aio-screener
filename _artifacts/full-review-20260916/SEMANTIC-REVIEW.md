# AIO Screener — 전체 코드 의미(Semantic) 검토 리포트

| 항목 | 값 |
|---|---|
| 검토 ID | `full-review-20260916` / semantic pass |
| 검토 기준 SHA | `9fccf5ff3af4d038c356fe408dd5a7756fc91d44` (main, v54.97) |
| 검토 일시 | 2026-09-16 (KST) |
| 적용 규범 | `_context/RULES.md:2011-2028` **R219** ("Audit/gate is not semantic review") |
| 방법 | R219 4단계 경로 추적 + 병렬 6개 표면 심층 판독 + 주담당자 교차 검증 |
| 증거 등급 | 정적 판독 + 기존 저장 산출물/캡처 대조 (브라우저·서버 런 **미실행**) |
| 코드 변경 | **없음** (본 리포트 파일 추가만) |

## R219가 요구하는 경로

```text
user request/intent -> affected function(s) and criteria
affected function(s) -> downstream consumer(s)
downstream consumer(s) -> visible page/chat/report output
visible output -> market/domain meaning, currentness, source confidence, user action risk
```

R219의 핵심 주장: "감사 함수가 존재한다는 것, 객체가 기대한 shape을 가진다는 것, 커버리지 비율이 높다는 것, 사이드바 행/DOM 마커가 있다는 것은 완료의 근거가 아니다." 본 리포트는 이 기준으로 **의미가 어긋나는 지점**만 기록한다.

## 0. 측정된 의미 검토 경계 (사실)

| 항목 | 값 | 출처 |
|---|---|---|
| 현재 라인 의미검토율 | **6.89%** (10,838 / 157,206) | `ci-semantic-review-check.mjs` 실행 출력 |
| 역사 전환 의미검토율 | 12.93% (596 / 4,611) | 同上 |
| `releaseCertified` | **false** (게이트가 false를 요구 = fail-closed) | `scripts/ci-semantic-review-check.mjs:68` |
| 완전 검토 파일 | 118 / 427 code-config files | `coverage-summary.json` |
| 레저 기준시각 | `asOf 2026-09-12T15:14:32Z`, `scopeHead 6ef2561d` (**HEAD 아님**) | 同上 |
| 레저 신선도 게이트 | **없음** (값이 범위 내인지만 검사) | `ci-semantic-review-check.mjs:66-73` |

**핵심 사실: 의미 검토가 0줄인 표면이 런타임의 대부분이다.**

| 파일 | 라인 | 의미검토 라인 |
|---|---:|---:|
| `index.html` | 28,283 | **0** |
| `js/aio-core.js` | 27,755 | **0** |
| `js/aio-data.js` | 16,472 | **0** |
| `js/aio-tests.js` | 9,253 | **0** |
| `js/aio-chat.js` | 7,921 | **0** |
| `js/aio-ui.js` | 4,343 | **0** |
| `cloudflare-worker-proxy.js` | 724 | **0** |
| `src/ui/pages/portfolio.js` | 367 | 17 |
| `src/ui/pages/atlas.js` | 1,694 | 1,521 (미완) |

즉 그동안의 semantic ledger는 `src/**` 코어 모듈에 집중되어 있고, **사용자가 실제로 보는 레거시 셸은 의미 검토가 전무**하다. 본 검토는 그 미검토 영역을 대상으로 했다.

이 사실 자체는 리포지토리가 **은폐하지 않고 선언**하고 있다(건강 신호): `RULES.md:16`(R594), `CHANGELOG.md:12`, `_context/QA-CHECKLIST.md:15,73`(QA-EXHAUST-05/37), `_context/INDEX.md:67`, `_context/BUG-POSTMORTEM.md:26-27`(P1072), `architecture/product-charter.json:114`.

**레저 자체의 결함(신규)**
- [LOW] `coverage-summary.json`이 **삭제된 스크립트 2건**(`scripts/ci-knowledge-quantitative-example.mjs`, `scripts/ci-second-pass-baseline.mjs`)을 `currentLines: 0`으로 아직 포함한다. 두 파일은 `_artifacts/qa-efficiency-20260905/REPORT.md:11`에서 삭제되었다고 기록되어 있고 현재 디스크에 없다.
- [MEDIUM] 레저의 `asOf`/`scopeHead`가 HEAD와 다르며 이를 검증하는 게이트가 없다 → 6.89%가 현재 리비전 기준값인지 보증되지 않는다.

---

## 1. BLOCKER

### B1. NFP 전월대비 델타가 항상 "0"으로 표시 (단위 이중 환산) — **주담당자 검증 완료**

- **증상**: 매크로 KPI의 NFP MoM 델타가 `+0K vs 전월`(또는 `-0K`)로 표시. 실제 신규고용 +141K가 0으로 보인다.
- **R219 경로**: FRED `PAYEMS`(mom_diff, 천명) → `data.json.macro.nfpDelta` → loader → `DATA_SNAPSHOT._nfpDelta` → `_aioRenderDeltas` → `#nfp-delta-tag`.
- **근거(검증)**:
  - 쓰기: `js/aio-data.js:5562-5563` — `if (typeof d.macro[k + 'Delta'] === 'number') window.DATA_SNAPSHOT['_' + k + 'Delta'] = d.macro[k + 'Delta'];` (동적 키이므로 리터럴 grep에 잡히지 않음)
  - 값: `public-data/data.json:157` `"nfpDelta": 141` (천명 단위, `scripts/fetch-data.mjs:74` 주석 `PAYEMS … kind:'mom_diff' // 천명 단위`)
  - 렌더: `js/aio-data.js:6015` `snap._nfpDelta != null ? snap._nfpDelta / 1000 : null` + suffix `'K vs 전월'`, decimals 0
  - 산술: `141 / 1000 = 0.141` → `toFixed(0)` → `"0"`
  - 같은 함수의 다른 델타는 나누지 않는다(`:6011-6018`는 `pp` 단위 그대로) → `/1000`이 유일한 이상치.
- **수정안**: `js/aio-data.js:6015`의 `/1000` 제거(또는 서버 델타를 인원 단위로 통일). `applyFredToUI`(`js/aio-data.js:3134-3135`)는 이미 천명 단위를 그대로 `K`로 렌더하므로 두 경로 규칙이 상충한다.

### B2. 공개 모드에서 뉴스 staleness 경고가 CSS로 차단된다 — **주담당자 검증 완료**

- **증상**: 뉴스가 4시간+ 경과해도 사용자에게 경고가 보이지 않는다. 반면 헤더는 "**45분 자동 갱신** · 자동 한국어 번역"을 상시 주장한다.
- **R219 경로**: 뉴스 현재성 의도 → `fetchAllNews`(interval 정의 `js/aio-data.js:3685`) → `#news-stale-banner` 세팅(`js/aio-data.js:6369`) → **단계 ③에서 사용자 도달 차단**.
- **근거(검증)**:
  - `index.html:4971` `body:not(.aio-dev-mode) #news-stale-banner,` — 공개 모드에서 숨기는 목록에 포함
  - `index.html:11820` 배너 요소 자체도 `style="display:none;…"`
  - JS는 표시를 시도한다(`js/aio-data.js:6369`, `:12501`) → 계산·세팅은 되지만 CSS가 덮는다
  - 헤더 주장: `index.html:11781, 11829, 11831`; 자체 툴팁이 모순을 인정(`index.html:6385`: "cron 정의는 30분 주기이나 실제 발화는 환경상 1~4시간 소요될 수 있음")
  - 저장된 실측 캡처: `_artifacts/desktop-browser-audit/report.json:1449`에 "뉴스 데이터가 4시간 이상 경과했습니다" + "주기: 45분 자동 갱신" 동시 표기
- **수정안**: 공개 모드에서도 stale 배너를 노출(최소 1줄 요약). 헤더의 "45분 자동 갱신"은 "정의 주기 45분 · 실제 발화 지연 가능"으로 하향하고, 표시는 아티팩트 `generatedAt` 기준으로.

---

## 2. HIGH

### H1. AI 차단 게이트가 연구 열화 경로에서 `blocked:false`로 강제 해제 → 차단된 답변 아래에 실행 카드 재부착 — **주담당자 검증 완료**

- **증상**: 본문이 "수치 확인 필요 — 현재 수치를 출처와 대조하지 못해 표시하지 않았습니다"인데 그 아래에 금액 시뮬레이션·알람 등록·Maker-Checker 카드가 붙는다.
- **근거(검증)**: `js/aio-chat.js:6808-6815`가 `Object.assign` **사본**의 `blocked`를 `false`로 덮어쓰고, 바로 아래 `:6836`의 `if (_publicGate && _publicGate.blocked === true) { …return; }` 조기 반환이 무력화된다. 그 코드의 주석(`:6833-6835`)이 **스스로 그 불변식을 선언**하고 있다: "a blocked answer must not regain actionable meaning through recommendation/chart/post-processing cards."
- **발생 조건**: `_researchRequiredForChat && !_researchEvidenceReady`(리서치 필수 질문 + 웹리서치 미준비: 키 없음/타임아웃/Worker 429) **이면서** 파이프라인이 claim 차단을 낸 경우.
- **수정안**: `:6810`에서 `blocked`를 건드리지 말고 `degraded`만 설정하거나, `:6836` 검사를 `_publicGate.blocked === true || _pageDoneResult.blocked === true`로 변경.

### H2. `currentSensitive` 단일 축 → 수치·현재성 가드가 흔한 질문 형태에서 전부 OFF

- **증상**: `"삼성전자 실적 어때?"`, `"AAPL PER 얼마야?"`, `"AAPL 밸류에이션 분석해줘"`, `"삼성전자 목표가 어떻게 봐?"`, `"반도체 섹터 어때?"` → 답변 산문의 수치가 검증 없이 표시되고 미검증 고지도 없다.
- **꺼지는 가드(전부 `currentSensitive` 단일 조건)**: 산문 수치 스트립(`js/aio-chat.js:239,250,302,304,306`), claim drop(`:268,274`), market-session 한계 고지(`:430-432`), 수치 미검증 고지(`:436-437`), `validateAnswerPlan`의 `untracked_numeric_content`(`src/ai/response/claim-ledger.js:76`).
- **원인**: `src/ai/intent/taxonomy.js:105-109` — `inherentlyCurrent`가 `주가|시세|가격|현재가|price|quote`류만 인식하고(실적·밸류에이션·PER·EPS·목표가 미등재), `TICKER_PATTERN`(`:48`)이 라틴 대문자만 인식해 **한글 종목명이 티커로 잡히지 않는다**. 그런데 `js/aio-chat.js:6267-6277`의 퍼지 해석은 `삼성전자→005930.KS`를 해석해 실시간 시세/재무를 **실제로 주입**한다 → 데이터는 들어오는데 가드만 꺼지는 조합.
- **부수 불일치**: `src/ai/research/decision.js:65`는 `동향`을 CURRENT로 보는데 taxonomy는 아니라서, 같은 질문이 두 축에서 다르게 분류된다.
- **수정안**: ① `inherentlyCurrent`에 실적/멀티플/목표가 어휘 추가, ② 퍼지 해석 결과를 `hasTicker`에 반영, ③ 두 축이 다르면 **더 넓은 쪽**을 채택.

### H3. Equity/Index PCR이 관측값이 아니라 합성값 — **주담당자 검증 완료**

- **증상**: technical OPEX/Gamma 패널의 `Index PCR`이 실제 관측 0.96이 아니라 합성 1.10으로 표시된다(= total×1.18).
- **근거(검증)**:
  - 실제 값은 디스크에 존재: `public-data/data.json:1875-1876`(`indexPutCall 0.96`, `equityPutCall 0.67`)
  - 서버 로더가 payload로 전달: `js/aio-data.js:5776-5783`(`equityPutCall`, `indexPutCall`, `sourceKind:'T1_OFFICIAL'`)
  - `_aioUpdatePutCallDom`은 전체 payload를 `window._lastPutCallPayload`에 보존(`:16017`)하고 `DATA_SNAPSHOT.pcr`만 기록(`:16015`) — **`DATA_SNAPSHOT.equityPutCall/indexPutCall`에 쓰는 코드는 없다**(초기 리터럴 `null`만 존재, `js/aio-core.js:22457`)
  - 소비 경로는 `fetchOptionSentiment`(`:2706-2712`) → `fetchPutCallRatios`(`:2692-2702`)이고 여기서 `snap.equityPutCall || snap.equityPcr`를 읽으므로 항상 NaN → 합성 발화: `:2699-2700` `equity = total*0.72`, `index = total*1.18`
  - 소비: `js/aio-ui.js:1846-1847` → `calcOpexGammaRisk`(`js/aio-core.js:20760-20767`) → OPEX/Gamma 패널(`js/aio-ui.js:1750`)
  - `estimated` 플래그(`:2701`)는 `equity!==null||index!==null`이라 합성 후 **항상 true** → 판별 기능이 없고 UI에도 전달되지 않는다.
- **파급**: `js/aio-core.js:20767`의 `indexPutCall > 1.0 && equityPutCall < 0.6` 임계는 합성값(1.10 > 1.0)에서는 성립하고 실제값(0.96 < 1.0)에서는 성립하지 않는다. 현 표본은 equity 0.67 ≥ 0.6이라 플래그가 발화하지 않지만, **임계 비교가 합성값으로 구동된다**.
- **수정안**: `_aioUpdatePutCallDom`에서 `DATA_SNAPSHOT.equityPutCall/indexPutCall`(또는 `_lastPutCallPayload`)를 보존하고 `fetchPutCallRatios`가 이를 우선 사용. 합성 시 라벨에 `추정` 표기.

### H4. 엔캐리 패널 라벨 "미일 정책금리 차"가 실제로는 미 10Y − 한국 기준금리 — **주담당자 검증 완료**

- **증상**: fxbond carry-unwind 패널이 `미일 정책금리 차 X%p (BOJ 수동 확인값 기준)`로 표기하지만 계산은 미국 **10Y 수익률** − **한국 BOK 정책금리**다. 국가쌍과 기준이 둘 다 다르다.
- **근거(검증)**: `js/aio-data.js:16245` `var rateDiff = parseFloat(tnx) - bokRate;` / 입력은 `:16225` `DATA_SNAPSHOT.bokRate`, 누락 목록에도 `'BOK 정책금리'`(`:16233`) / 라벨 `:16264` `'미일 정책금리 차 … (BOJ 수동 확인값 기준)'`, `:16239`, `:16266`.
- **파급**: 점수 규칙 `:16254`가 이 값에 직접 의존한다. 미10Y(≈4.2) − BOK(≈2.5) ≈ 1.7%p는 `<2.5 → +20`(최대 위험 가산)인데, 실제 미일 정책금리차(≈3.7%p)면 `+5`다 → **위험 점수가 라벨과 반대로 움직인다**.
- **수정안**: 라벨을 실제 입력(`미 10Y − 한국 기준금리`)에 맞추거나, 진짜 BOJ/미국 정책금리를 입력으로 사용.

### H5. 공급 리서치 provenance 렌더러가 죽은 코드였다 — **[수정 완료 · 분류 정정]**

- **초기 판정(정정 대상)**: "12개 페이지가 `createSuppliedMaterialBridge`를 mount하지만 화면에는 숨김 `<aside>` 안 한 문장뿐이므로 **출처가 사용자에게 도달하지 않는 결함**"이라고 HIGH로 분류했다. 근거는 내부 렌더러 이름 `renderClaimLedger|renderMediaAudit|renderSourceTimeline|renderNathanThreads`의 **호출부 0건**이었다.
- **정정**: 숨김은 결함이 아니라 **의도된 설계**다. `src/ui/knowledge/supplied-material-bridge.js:252-255`의 주석이 "External material is consumed by the internal knowledge/protocol layer; it is not a second user-facing research page or a raw-link index."라고 명시하고 `dataset.integrationMode = 'internal-protocol-only'`로 경계를 고정한다. 내가 "표시되어야 하는데 죽었다"로 오독한 것이고, 실제로는 **"표시되지 않아야 하는데 그 죽은 렌더러를 게이트가 렌더 증거로 단언하고 있었다"**가 결함이었다.
- **실제 결함(v54.98 P1077/R601에서 수정)**: `ci-research-flow-contract-check.mjs`가 같은 파일에 **모순된 두 계약**을 동시에 걸고 있었다 — `:160`은 "숨김 프로토콜 메타데이터, 표시 패널 아님"을, `:123`·`:146`은 "감사·시계열 정렬·claim 원장을 렌더한다"를 요구했다. 후자는 호출되지 않는 함수 안의 문자열로만 충족됐다.
- **조치**: 죽은 렌더러 7종과 전용 헬퍼를 삭제(~230줄). `:123`은 프로토콜 메타데이터 존재 + 렌더러 **부재**를, `:146`은 claim 원장이 내부 API(`getSuppliedMaterialClaims`·`SUPPLIED_MATERIAL_CLAIM_IDS`)로만 도달함을 단언한다.
- **검증**: `ci-research-flow-contract-check.mjs` PASS 66 assertions, browser-knowledge 6/6, browser-surface 3/3.
- **남은 것**: 공급 자료 provenance는 설계대로 사용자 화면에 나타나지 않는다. 노출이 필요해지면 `internal-protocol-only` 경계를 먼저 바꾸고 표시 계약을 새로 작성해야 한다.

> **H6~H11 상태 정정 (2026-09-16, v54.98 P1078/R602): 수정 완료.**
> - **H6/H7 (스크리너 등급)**: `rankGrade()`를 단일 등급 함수로 도입, 등급 셀은 `rankGrade(visibleRank(row))`를 사용 → rejected/unavailable 행은 `—`. 랭크 필터 라벨도 같은 함수에서 파생(`syncRankFilterLabels`)하고 정적 옵션을 실제 경계 `40 (D)·50 (C)·65 (B)·80 (A)`로 교정.
> - **H8 (breadth 참여도 enum)**: native 렌더러가 legacy와 동일한 한국어 매핑(`광범위 참여/중립/쏠림 장세`, `확대/위축/보합`)과 색을 사용.
> - **H9 (시장 폭 시그널 라벨)**: 실제 기저에 맞춰 `(상승/하락 비율)`로 교정 — `architecture/route-owners.json:674`의 P803 계약(native=advance ratio)과 정합.
> - **H10 (technical 마켓 폭)**: 라벨을 `섹터 ETF 상승 비율`로 교정(값 자체는 그대로, 코드 주석이 이미 인정하던 정의).
> - **H11 (MACD 기저)**: 히스토그램(`macd − signal`)을 단일 기저로 통일하고 1자리·부호 표기를 두 writer가 공유. 제공자가 히스토그램을 주지 않아 라인으로 폴백할 때는 title에 `히스토그램 아님`을 명시.
> - 검증: `tools/probe-screener-grade.mjs` 전체 PASS(순수 함수 + DOM), `affected` 112 PASS + 8 CACHED / 0 FAIL.

### H6. 스크리너 '등급' 셀이 순위를 숨긴 행에도 등급을 계산한다

- **증상**: 같은 행에서 순위는 `조건 미충족`인데 등급은 `A`. 사용자는 근거 없는 알파벳 등급을 관측값으로 읽는다.
- **근거**: `src/ui/pages/screener.js:302`는 `row.rank`로 직접 등급을 계산하며 `screenStatus==='rejected'`를 검사하지 않는다. 순위는 `:222,247-248`에서 `visibleRank`로 rejected/unavailable 시 `조건 미충족`이 된다. 거부행도 `rank`를 보유(`src/domain/screener/screen-engine.js:161`), 자체 픽스처에도 `{sym:'REJECTED', rank:99, screenStatus:'rejected'}`(`scripts/ci-desktop-continuity-check.mjs:48`).
- **수정안**: grade도 `visibleRank(row)`를 사용.

### H7. 같은 페이지에서 "등급"이 두 정의로 동작한다 (필터 라벨 vs 등급 컬럼)

- **증상**: 필터 `60 (B)`를 고르면 결과 행 등급은 `C`, `70 (B+)`는 `B`, `40 (C등급)`은 `D`.
- **근거**: `index.html:12166-12167`(40=C등급·50=C+·60=B·70=B+·80=A등급) vs `src/ui/pages/screener.js:302`(≥80 A·≥65 B·≥50 C·≥35 D·else F).
- **수정안**: 필터 라벨을 실제 매핑에 맞추거나 등급 체계를 단일 함수로 통일.

### H8. breadth '시장 참여도'에 내부 enum이 그대로 노출

- **증상**: `broad · rising` / `narrow` / `neutral · flat`이 화면에 그대로 표시(legacy 경로는 `광범위 참여 · 확대` 한국어).
- **근거**: `src/ui/pages/market.js:941-945`(raw level/direction 삽입) · enum 정의 `src/domain/market/breadth.js:65-71` · 한국어 매핑이 legacy에 존재(`js/aio-ui.js:84-87`).
- **수정안**: native 렌더러에서 legacy와 동일 매핑 상수 공유.

### H9. 라벨 '시장 폭 시그널 (RSP/SPY)'가 두 정의·스케일을 표시

- **증상**: native 렌더 시 advance ratio(0.55/0.45 경계)에서 파생되는데 라벨은 `(RSP/SPY)`; legacy 렌더 시엔 RSP−SPY 등락률(±0.5%p 경계). 같은 DOM·같은 라벨·다른 basis.
- **근거**: 라벨 `index.html:7442-7443` · native `src/ui/pages/market.js:906-921` vs legacy `js/aio-data.js:3583,3609-3615`.
- **수정안**: 라벨을 실제 basis로 교정하거나 계산을 단일화.

### H10. technical '마켓 폭' 게이지 = 당일 섹터 ETF 상승 비율 (다른 정의)

- **증상**: `마켓 폭` 옆 숫자가 시장 전체 50일선 상회율이 아니라 11개 섹터 ETF 중 상승 비율. 정의 차이는 툴팁에만 있음.
- **근거**: 라벨 `index.html:8179-8182` · 계산 `index.html:24845-24859`(`above50ma = secUp/secTot`), 코드 주석이 차이를 자인.
- **수정안**: 라벨을 `섹터 ETF 상승 비율`로.

### H11. technical MACD 카드가 writer에 따라 'MACD 라인'과 '히스토그램'을 같은 셀에 쓴다

- **증상**: 같은 카드가 시점에 따라 MACD 라인(zero-line) 또는 MACD−signal 히스토그램. 부제 `시그널선 대비 추세 방향`은 후자만 참.
- **근거**: `js/aio-data.js:4990-4994`(`data.macd.values[0].macd`) vs `index.html:15883-15886,15897-15898`(`snapshot.macd.hist`, `js/aio-core.js:20252` `hist: macd - sig`). 스케줄러(15분)와 페이지 진입이 서로 다른 writer를 실행.
- **수정안**: 하나로 고정하고 단위·부제 일치.

### H12. 홈 topbar 배지가 지연 가능 소스를 "실시간"으로 라벨링

- **증상**: `● 실시간 14:32 (42개)`. 같은 앱이 같은 출처를 "Yahoo Finance API — 15분 지연 가능"(`index.html:9726`)·"일부 무료 시세는 지연 가능"(`index.html:11147`)이라 명시한다. AI 답변 경로는 "실시간"을 "live 우선/source 확인"으로 **치환**한다(`js/aio-chat.js:1473-1489`) → 규칙이 표면마다 다르다.
- **근거**: `js/aio-core.js:4561`, `js/aio-data.js:13785` vs `js/aio-core.js:4475`(같은 앱이 90초~5분을 '지연'으로 판정).
- **수정안**: 배지를 "수신 시각 + source kind"로 통일.

### H13. 같은 카드 블록 안에서 "실시간"과 "15분 지연 가능"이 동시 표기

- **증상**: fxbond FX 상세 헤더 `주요 통화쌍 실시간 · 달러인덱스(DXY)` 바로 옆에 `Yahoo Finance API — 15분 지연 가능`.
- **근거**: `index.html:9723` vs `index.html:9726` — 동일 컨테이너(`index.html:9719-9728`), 공개 모드 숨김 목록에 없음.
- **수정안**: `:9723`의 "실시간" 삭제.

### H14. 브리핑 '시장 분석' 시각 표기가 관측시각이 아니라 렌더 시각

- **증상**: 헤더 기본값은 "08:00 KST 생성 · 서버 데이터 기준"(`index.html:7888`)인데 렌더 후 "화면 갱신 · 14:32"(`js/aio-core.js:27373`)로 바뀐다. 본문은 S&P/VIX/WTI/10Y/KRW 실측가를 인용하므로 사용자는 그 가격이 14:32 기준이라고 오독한다. spx 미수신이면 lead는 "생성 중"인데 ts만 계속 갱신된다.
- **수정안**: ts를 `관측 기준: {asOf} ({sourceKind})`로.

### H15. 브리핑 참고 아카이브에 구체 목표주가·수혜종목 추천문

- **증상**: `NVDA: … $250 단기 목표`, `메모리 연쇄 수혜: SKH·MU·SNDK 동반 상승 촉매`, `AI PC 교체 사이클 재가속 신호`가 `#briefing-static-archive` 토글에서 노출.
- **근거**: `index.html:8057,8058,8059,8046`; 라벨 `index.html:8027,8030,8084`. 정적 HTML이라 스크립트가 생성하지 않는다.
- **수정안**: 목표가·종목명 제거 또는 "당시 보도 인용(현재 유효성 미검증)" + 관측시각·출처 부착.

---

## 3. MEDIUM

### 데이터·파생 (`js/aio-data.js`)
- [M] **동일 "서버 데이터 나이"를 3개 규칙으로 판정** — topbar 60/180분(`:6415-6420`), 공유 readiness 180/360분(`:6609-6610`), 뉴스 stale 60분(`:6371`). 주말에는 `liveCoreEligible` true인데 배지는 🔴.
- [M] **screener breadth 승격 창 96시간(4일)** — `:15149` `ageHours <= 96` → `:15154` `status:'verified_current'`. 같은 파일의 배지 임계(3~6h)와 수십 배 차이. 그런데 UI 문구는 "현재 관측"을 무조건 표기(`js/aio-ui.js:64`, `src/ui/pages/market.js:888`).
- [M] **F&G freshnessClock이 delayed 소스를 'fetch'로 계산** — `:15821` `sourceKind === 'delayed' ? 'observation' : 'fetch'`인데 서버는 `'T3_PUBLIC_DELAYED'`(`:5766`)를 넘긴다.
- [M] **스케줄러 coverage 기본값 100** — `:3859` `cfg._coverage ?? 100` → 미보고 태스크를 "완전"으로 승격(`js/aio-core.js:25097`).
- [M] **클라이언트 FRED write-back이 소스 한정자를 갱신하지 않음** — `:3144-3161`은 값만 갱신하고 `_src`/`_freshness`는 갱신하지 않아, 서버 경로(`:5540-5544`)와 비대칭.
- [M] **'상승/하락 비율' 카드가 두 규칙으로 채워짐** — 전 종목 breadth(`:15143-15144`) vs Alpha Vantage top gainers/losers 비율(`:3566-3570`, 구성상 ≈50%). 같은 라벨·같은 sink.
- [LOW] 날짜 없는 뉴스 백스톱에 `kst-0800-completed-24h` 정책 라벨 부여(`:6332`).
- [LOW] 분산 추천 랭킹에 중립 기본 `rank=50` 사용(`:16400`) — 표시는 `퀀트 N/A`로 정직하나 순위 계산에 합성값이 섞임.

### 감사·게이트 의미 (`js/aio-core.js`, 103개 감사 함수 중 31개 심층 열람)
- [HIGH] **`getPageContractAudit`의 검사가 사실상 공허** — `:25260-25289`가 먼저 `applyPageContractCompatibility()`를 호출하고 그 함수가 프로파일/refresh map/deep audit/sequential registry를 **자동 생성**(`:25211,25217-25223,25228-25233,25237-25247`)하므로 `missing*`가 항상 빈 배열 → status는 `missingDom`만 반영. 계약이 비어 있어도 통과.
- [HIGH] **"16/20 페이지" 커버리지를 완전성으로 보고** — `AIO.PAGE_DEEP_AUDIT_SYSTEMS` 키 16(`:16116-16134`), `runAllPageDeepAudits`는 그 키만 순회(`:16191`). 라우트 진실원은 20(`:24846-24851`). `market-news/screener/principles/masters/atlas` 5개 라우트는 심층 감사 0건.
- [HIGH] **`AIO_PAGE_SEQUENTIAL_AUDIT_REGISTRY`가 stale** — `home lineRange 'L3948~4400+'`(`:9803`) vs 실제 `index.html:6368`; `portfolio 'L8739~9512'`(`:10116`) vs `:11080`; `guide`(`:10267`) vs `:12311`. 퇴역 라우트 5개(`kr-*`, `:10183-10264`)가 `done`으로 잔존(레지스트리의 REMOVED와 모순, `:26848`). `theme-detail`도 페이지로 잔존(`:10099`)하나 실제로는 `#themes` 패널로 퇴역(`:27535-27542`). self-note "21-route"(`:10295`) vs 현행 20.
- [HIGH] **현재성 판정이 날짜 블랙리스트에 고정** — `getPageUXAudit` `staleRe`(`:7491-7492`)가 `VIX Spot 18.36`, `5/2` 같은 리터럴만 탐지 → 다른 stale 값은 통과(fail-open), 정상 값은 오탐. `getDeepReviewAudit`(`:7780`)은 `2025-…`를 stale로 간주 → 2026년 실제 stale 미탐. `getComprehensiveSurfaceIntegrityAudit`(`:15938`)는 `2026-0[1-5]-`만 → 6월 이후 미탐.
- [MEDIUM] `getPageSequentialAuditStatus`가 축 문자열만 검사(`:10299-10306`), contract-derived 페이지는 영구 `partial`(1키, `:25245`) → status 항상 warn.
- [MEDIUM] `getEssenceAlignmentAudit`의 `institutionalScore`가 DOM 개수·coveragePct 조립(`:8115-8122`).
- [MEDIUM] `getAuditRegistryAudit`가 `audits.length >= 8`만 검사하고 `run()`을 호출하지 않음(`:26268-26277`).
- [MEDIUM] `buildAICoverageExposureReport`가 coverage 0%여도 PASS(`:1098-1112`).
- [MEDIUM] `getPagePurposeRatioAudit` 레지스트리가 라우트 12/20만 덮고 나머지는 무소리 skip(`:14149-14165`, `:14175`).
- [MEDIUM] 의사결정 헤더 배지의 basis 불일치 — `_aioDecisionAsOf`/`_aioDecisionConfidence`(`:5143-5150`, `:5131-5140`)가 enum에서 "실시간 연결"/"신뢰도 84%"를 파생. `getPageEvidenceCurrentnessAudit`(`:7172`)은 `unavailable > live` 역전만 검출하고 **snapshot 우세 케이스는 미검출**.
- [MEDIUM] `_aioPageBus.register`의 첫 인자가 페이지 스코프가 아님(`:1707-1727`) — 핸들러가 전역 등록되어 모든 전환에 반응(자체 필터는 `:4299` 1건뿐).
- [LOW] `getRouteIAAudit.hashNavigation`이 등록 플래그만 검사(`:26883`) — `popSrc`는 `"false"/"true"`라 해시를 포함할 수 없다.
- [LOW] `showPage` market-pulse-bar 목록에 도달 불가 id `glossary`(`:27612`, overlay임).
- [INFO] 감사 분류(심층 열람 31건): **SHAPE-ONLY 16건** / SEMANTIC 15건. SHAPE-ONLY 목록: `getAIStreamAudit:1059`, `buildAICoverageExposureReport:1077`, `evaluateAICoverageBias:1114`, `evaluateHumanChatCertification:1128`, `getArchitectureGovernanceAudit:1314`, `getPageUXAudit:7489`, `getFullSurfaceAudit:7547`, `getDeepReviewAudit:7718`, `getEssenceAlignmentAudit:8053`, `getPageSequentialAuditStatus:10719`, `getPagePurposeRatioAudit:14168`, `getScenarioFreshnessAudit:14213`, `getPageDeclutterAudit:16786`, `getPageContractAudit:25260`, `getAuditRegistryAudit:26268`, `_aioRunNamedAuditForPage/runAllPageDeepAudits:16136/16189`.
- [INFO] 레지스트리 `findings[].fixedIn`이 현재 코드와 모순 — `:9874`/`:10023`은 scenario 마커가 "구현됨"이라 하지만 실제는 stub(`:14204-14211`)이고 `js/aio-tests.js:1504`가 `[data-scenario-key]` **0건**을 단언한다.

### AI 답변 표면 (`js/aio-chat.js`)
- [M] **차단된 답변에 "주입 근거 확인됨" 신뢰 배지** — `_aioBuildAIResponseDisclosure`가 `meta.actionGate`를 전혀 쓰지 않고 quote row만 본다(`:530-559`, 특히 `:545-551`). 호출부는 `actionGate`를 넘기지만 사장 파라미터(`:6830`). 역방향으로 quote row 없는 정성 답변은 항상 `확인 필요`로 낙인된다.
- [M] **"기준시각"이 행별이 아니라 최신 1건** — `:543` `sort(b-a)[0]`, 나이 상한 없음(미래만 차단 `:549`).
- [M] **claim 추적 라인이 raw UTC ISO + tier 없이 렌더** — `src/ai/response/renderer.js:18-20`; 같은 답변 disclosure는 KST 포맷(`:517-527`)이라 혼재. `sourceKind`/`status` 미노출 → `reference` 통과 행과 LIVE가 같은 모양.
- [M] **수치 탐지 정규식 공백** — `억/조` 스케일어가 숫자와 단위 사이에 끼면 불일치(`:228`), `EPS`가 metric 목록에 없음(동일 정규식이 `claim-ledger.js:76`에도 있음).
- [M] **Worker 다운/무키 재시도 경로가 "❓ 알 수 없는 오류"로 분류** — notice 문자열이 분류기(`:7359-7375`)의 어떤 패턴에도 안 걸림(`:2053-2057`). `RATE_LIMIT` 안내문(`:1984`)은 이 reason을 생성하는 곳이 없어 **도달 불가**.
- [M] **가격 환각 HARD STOP이 전역 상태** — `_liveStatusCS`가 `window._liveData` 전체를 보고(`:6075-6087`), `미수신`은 quote가 하나도 없을 때만 성립 → 다른 종목 캐시가 있으면 미주입 종목에 대해 발화하지 않음(`:6585-6594`).
- [M] **비정형 답변 + currentness 토큰 없음 → 고지 0건** — `:438-444`가 `/(현재|지금|오늘|현시점|방금|as of)/`를 요구하므로 `"AAPL PER은 약 32.5배입니다"`는 스트립·고지 모두 미발화.
- [LOW] `_aioApplyAIActionGate`는 항상 `{blocked:false, reasons:['conditional-trade-analysis']}` 반환(`:572-577`) — 이름·계약과 불일치.
- [LOW] `'as-of timestamp'`가 `required_axes`에 항상 포함되나 `has` 맵에 키가 없어 누락 보고 불가(`:4337`, `:4353-4360`).
- [LOW] 답변 표면에 하드코딩 환율 1380원/달러(`:5347-5369`)와 시나리오 승수(`pct*2.5`, `pct*8`, `:5385-5397`).
- [LOW] claim asOf **밀리초 완전일치** 요구 → 날짜만 쓴 정상 claim이 `evidence-content-mismatch`로 드롭(`:279-288`).
- [LOW] unit 정규화 불일치 — evidence registry는 대문자화(`js/aio-core.js:464`)하나 claim은 모델 문자열 보존(`claim-ledger.js:24`).

### 서사·현재성 표면 (`index.html` narrative)
- [M] **홈 "오늘의 시장" '마지막 갱신'=렌더 시각** — `js/aio-data.js:15572` `const ts = new Date()`. '시장 분위기'도 S&P ±0.5% 단일 임계(`:15582`).
- [M] **홈 헤더 부제가 해소되지 않는 placeholder로 고정** — `js/aio-ui.js:277`의 실시간/정적 구분 문구가 같은 핸들러 `:722`에서 즉시 덮어써져 최종 텍스트가 "…KST · 시세·뉴스 상태 확인 중"이 된다(해소 writer 없음).
- [M] **시장 뉴스 리스크 카운트 기본값이 "0 · 리스크 없음" (false all-clear)** — `index.html:11792` 정적 기본값 `0` + `리스크 없음`(라벨 색은 `var(--data-red)`). writer는 `js/aio-data.js:6285-6288`. 미수신/실패 시 "무위험"으로 보인다.
- [M] **"캐시 갱신" 시각이 관측시각 대신 렌더 시각으로 폴백** — `js/aio-data.js:6290-6295`(`generatedAt ? … : new Date()`, kind 폴백 `'직접 수집'`).
- [M] **pre-hydration 정적 기본값이 실제 판정처럼 보임** — `18 /100 · 극단 공포`(`index.html:7643-7649`), AAII `36.1/44.9`(`:7726-7727`), Put/Call `1.08`(`:7732`), 곡선/매크로 결론 문구(`:8891,8894,9570,9616`). 브라우저 런 미실행으로 **지속 노출 여부는 추론**.
- [M] **뉴스 감성 임계가 컴포넌트 내에서 3중 불일치** — 툴팁 ±0.5/±0.8(`index.html:7764`) vs 범례 50/40(`:7773-7776`) vs 색 임계 55/45(`js/aio-data.js:12553`) vs y축 0~100(`:12572`).
- [M] **포트폴리오 "현재 시세 기준"과 "장중 실시간 · 지연 가능" 동시 노출** — `index.html:11082` vs `:11147`. `today`가 `#pf-daily-pct` 템플릿에 하드코딩(`src/ui/pages/portfolio.js:108`)되어 외부 라벨 '오늘'과 중복.
- [M] **투자심리 인트로가 역발상 프레임을 지시형으로 제시** — `F&G 25↓ = 극단 공포(역발상 프레임 주목 구간)`(`index.html:7607`), `300bp↓=안정(바닥 확인)`(`:7718`).
- [LOW] portfolio 리스크 카드의 정적 권고 문구(`index.html:11203,11213,11218,11246,11330`).
- [LOW] macro 인터커넥션 맵의 인과 단정(`index.html:8926,8946,8970,8987`).
- [LOW] Vault·PIN 문구 불일치 — `4자리`(`:11125`) vs `4자리 이상`(`:6179,6182`); 포트폴리오도 같은 Vault로 암호화된다는 사실이 사이드바 라벨에 없음(`:6176`).
- [INFO] `js/aio-data.js:15571` `fg` 폴백값 `35`는 사용처 없는 dead 값.
- [INFO] `_breadth200` 별칭 함정(`js/aio-data.js:15168` = `above20`): 소비자 라벨이 모두 20SMA로 맞춰져 **표시 오류는 없음**. 실제 200SMA(`:15170`)는 소비자 0건.

### 수치 표면 (`index.html` quant) — 추가
- [M] 스크리너 백테스트 IC 패널이 `status=PARTIAL`(관측 6일)·`readiness BLOCKED`를 감추고 IC에만 등급색 부여(`src/ui/pages/screener.js:489-528` vs `public-data/screener.json`).
- [M] `#tech-indicators-live[data-stale]` 마커에 **소비자 0건** → 이전 심볼/이전 fetch 값이 stale 표시 없이 남는다(설정 `js/aio-data.js:4976,5016`).
- [M] '상대 상태' 칩이 1M 결측 시 `ret3m/3` 프록시로 의사결정형 판정(`screener.js:125-140`), 화면에 프록시 표기 없음.
- [LOW] `#screener-factor-diagnostics[data-decision-eligible="false"]` 소비자 0건(동일 노드 텍스트에 고지는 있음).
- [INFO] 같은 지표의 라벨 4종(rank: `순위`/`상대 점수`/`최소 rank`/`상위 20%`, signal: `시그널`/`구조 분류`/`기존 편집 분류`) — 정적 th는 렌더 시 registry로 교체됨.
- [INFO] JS 미실행 시 bar 기하가 값을 암시(정적 `68%/75%/52%` 등, `index.html:7388,7404,7420,7506,7510,7514,8171-8173`).

### 선언된 미검토 모듈
- [HIGH] `scripts/ci-research-flow-contract-check.mjs`의 경계 검증이 **거의 전부 문자열 포함 검사** — `:123`/`:146`이 단언하는 문자열(`자료 감사`, `claim-level 분석 원장`)이 **죽은 함수 안에만** 존재하므로, provenance가 0건 노출되는 현재 상태에서도 통과한다. `:160`은 `section.hidden = true` 문자열만, `:138/150/151`은 레지스트리 리터럴 수치를 그대로 단언, `:101`은 특정 문구만 금지(다른 권유 문구면 통과), `:139-140`은 `REFERENCE` 문자열 포함만 확인(as-of 없는 경계도 통과).
- [MEDIUM] **portfolio 표의 숫자에 기준이 없다** — `현재가` 셀에 관측시각·live/stored 구분이 없고(`src/ui/pages/portfolio.js:220-238`), 표 라벨은 `portfolio-state`로 고정(`:173`)인데 `src/domain/portfolio/surface.js:228`은 `portfolio-state+live-quote`를 구분한다. 폴백 가격(`surface.js:132` `firstPositive(livePrice, holding?.price)`)은 관측시각이 없고(`src/data/providers/portfolio.js:25`), 그 가격으로 목표가 상승여력 %를 계산해 표시한다.
- [MEDIUM] **음수 현금(마진)이 "데이터 없음(—)"으로 표시** — `src/domain/portfolio/surface.js:202` `cashValue >= 0 ? cashValue : null` → 현금 카드 `—`, `totalAssets`도 null(`:203`). "부채 없음"으로 오독 가능.
- [MEDIUM] **Atlas 커버리지 갭 = 사용자가 읽는 문장 그 자체** — 미검토 구간은 `atlas.js` 528–608(`FOUNDATION_LESSON_GUIDES`·`FOUNDATION_TEACHING_FRAME` 문장 전체)와 801–891(`ATLAS_CONCEPT_GUIDES` 본문). 리뷰 경계가 **객체 리터럴 중간(795–800)에서 끊겨** 있어, 코드가 아니라 내용이 미검토임을 보여준다. 각 개념 문장에 출처·기준일이 없다.
- [MEDIUM] `scripts/lib/refresh-continuity.mjs:2-4`의 `isObservedNumber`가 `Number([])===0`을 통과 → 빈 배열이 "관측됨"으로 집계될 수 있다(파서가 실패 시 `[]`를 넣는지는 미확인 → 추론).
- [LOW] `scripts/build-13f-reference-ticker-index.mjs:78`의 `reviewedAt`이 운영자 env(`MASTERS_REVIEW_DATE`)로 임의 주입 가능하고, `:85` `generatedAt`은 이 인덱스 생성 시각이 아니다. 화면에는 crosswalk 기준일이 없다(`src/ui/pages/masters.js:198-233`).
- [MEDIUM] `scripts/fetch-data.mjs:3455` `meta.symbolsOk = quotes.length`는 수집 건강도인데 공개 아티팩트 quotes는 P715부터 빈 배열(`:3617-3620`) → "게시된 시세 78건"으로 오독 가능. 게이트가 이 의미를 단언하지 않는다.

---

## 4. 게이트 자체의 의미 결함 (R219의 직접 대상)

- [MEDIUM] **`ci-semantic-review-check.mjs`는 커버리지 미달을 실패로 만들지 않는다** — 커버리지 관련 `check()`는 "ledger가 존재하고 `releaseCertified:false`이며 값이 0~100 범위"만 단언한다(`:66-73`). 6.89%는 경고 출력(`:74,110`)일 뿐이며 exit code에 영향이 없다. 이는 P1072/R594의 **의도된 설계**(자동 PASS를 사람 검토로 승격하지 않음)이지만, 결과적으로 의미검토 미완료가 CI pass/fail에 **가시적이지 않다**.
- [INFO] 위 게이트의 audit 품질 단언은 **개수 기반**이다 — `:60` "audit-like assert 라벨 ≥50, shape/coverage유형 ≥50". 개수를 세는 것은 R219가 지적하는 바로 그 함정("coverage percentage is high")의 다른 형태다.
- [INFO] `scripts/ci-runtime-contract-check.mjs:497`은 `data-scr-sort="ret1m"` 등 **DOM 마커 존재**만 확인. `js/aio-tests.js:7190`은 `등급|grade` th 존재만, `T75`(`aio-tests.js:573-574`)는 `_aioChartRegistry`가 object인지만 단언.
- **결과**: 본 리포트의 등급/순위 불일치(H6·H7), MACD 기저 불일치(H11), breadth 라벨/basis 불일치(H8~H10), NFP 단위(B1), PCR 합성(H3), 엔캐리 라벨(H4)은 **어떤 게이트도 단언하지 않는다.**

---

## 5. 확정 vs 추론

**주담당자가 코드로 직접 검증한 항목(확정)**: B1(NFP), B2(뉴스 stale 배너 CSS 차단), H1(chat 차단 게이트 해제), H3(PCR 합성), H4(엔캐리 라벨), H5(브리지 렌더러 호출부 0건), H6/H7(등급), H8~H11, H12~H14.

**에이전트 보고 중 브라우저 런이 있어야 확정되는 항목(추론)**: pre-hydration 정적 기본값의 지속 노출, 홈 부제 회귀 여부, 포트폴리오 일일변동이 상시 `—`인지, `refresh-continuity`의 `[]` 경로 실제 발생, 모델이 실제로 계약을 위반하는 빈도, REFERENCE tier 행이 실제 답변에 결합되는 빈도.

**정정**: `#news-risk-label`의 기본 라벨 색은 에이전트가 "초록"이라 했으나 실제 코드는 `color:var(--data-red)`(`index.html:11792`)이다. false all-clear라는 실질 결론은 유지된다.

---

## 6. 정상으로 확인된 것 (의미 검증 통과)

- **증거·현재성 계약이 실제로 의미를 강제하는 곳**: `src/data/contracts/evidence.js`(fail-closed), `_aioEvidenceCanPublish`의 typed numeric claim 결합(`js/aio-chat.js:260-301` — value/unit/metric/entity/scale 동등 + asOf 일치 + 교차검증), 인용 필터(`:309-311`, `:217-225`).
- **데이터 파이프라인 fail-closed**: `_marketCyclePublished` 승격 게이트가 시도 시각을 관측 시각으로 승격하지 못하게 방어(`js/aio-data.js:5402-5412,5493-5517`); LKG에 `reference-only` 부여(`:5543,5552`); 뉴스 백스톱이 `pubDate` 결측을 `now`로 조작하지 않음(`:6319-6322`); `fetch-data.mjs:3562-3565` quote 커버리지 미달 시 throw; `scripts/lib/refresh-continuity.mjs:14-16`이 시도가 이전 성공 시각을 갱신하지 않음.
- **스크리너 계약**: 필드 레지스트리 단위/포맷 일치(`percent`/`currency`/`USD_bn`/`score`), STALE/LAST_GOOD/CONFLICT를 표시 허용·계산 차단 + 셀 주석(`src/ui/pages/screener.js:411-422`), provenance `reference-only` + 검증 BLOCKED 상시 노출(`:811-842`), conditional-evidence fail-closed(`:536-573`), 백테스트 무데이터 시 "0을 관측값으로 해석하지 않음"(`:495-505`).
- **breadth 생산자 게이트**: schema/coverage(≥85%,≥300)/observed(≤96h)/values 4조건을 모두 통과해야 `verified_current`(`js/aio-data.js:15146-15164`); `getCurrentBreadthEvidence`는 유한 ts+source 없으면 unavailable(`js/aio-core.js:22898-22900`); NYSE 52주 신고/신저가는 `해당 없음`+`수동 갱신·실시간 미연결` 명시.
- **technical/portfolio 결측 처리**: 미수신 시 점수 `—`·판정 보류·"결측값을 0%·중립값으로 대체하지 않습니다"(`src/ui/pages/analysis.js:152-173`); `src/domain/portfolio/surface.js`가 결측을 0으로 만들지 않고 결정등급 인용이 아니면 가격을 폐기(`:166,200,204,210`), `allowedUse:'reference-only'`·`promotionBlocked:true`.
- **AI 오류 경로**: HTTP 401/429/5xx/네트워크 4종이 구분되고 전부 오류 박스로 표시되어 답변으로 위장되지 않음(`js/aio-chat.js:7376-7386`); 파이프라인/게이트 모듈 부재 시 fail-closed(`:70-76,352-353`).
- **감사 중 의미를 실제로 검증하는 15건**: `getTypedProvenanceAudit`, `getPageEvidenceCurrentnessAudit`, `getMarketCurrentnessAudit`, `getDataFreshnessAudit`, `getTradingDecisionLogicAudit`, `getRouteIAAudit`, `getSourceAdapterAudit`, `getInlineThresholdTableAudit`, `getShellAssetIntegrityAudit`, `getContentTruthAudit`, `getTextSurfaceAudit` 등.
- **sound 판정**: `scripts/ci-data-continuity-check.mjs:213-215,236-238`(실제 파서·원자적 쓰기를 실행하는 음성통제), `scripts/ci-proxy-continuity-check.mjs`(VM 실행 + 음성통제), `scripts/build-13f-reference-ticker-index.mjs:96,99-100`(`verifiedTickerRows:0`·미매핑 공개·경계 명시), `src/domain/knowledge/principles-edge-semantics.js`, `atlas.js:629,906`·`lesson.js:32`의 경계 문구.

## 7. 미검토 경계 (정직한 한계)

- 브라우저·서버 **런 미실행**: 런타임 DOM 실측 없음. R219의 4단계 중 3단계(consumer→visible output)를 코드/저장 산출물로 추적했으나 **실제 렌더 확인은 아니다**.
- 심층 열람 범위: `js/aio-core.js` 감사 31/103건, `js/aio-chat.js` 답변 경로 구간, `js/aio-data.js` 약 1,900줄, `index.html`의 screener/breadth/technical/signal + 서사 표면. **미열람**: `index.html` 인라인 스크립트 20380-24351·24355-27500 대부분과 sentiment/briefing/fundamental/themes/ticker/portfolio/macro/fxbond 페이지 본문, `js/aio-chat.js`의 비답변 구간(660-2695, 2755-4260, 4699-5120, 7420-7921), `scripts/fetch-data.mjs` 나머지 약 3,200줄, `cloudflare-worker-proxy.js` 724줄, `js/aio-tests.js` 9,253줄.
- 본 검토는 **의미 검토율을 인증하지 않는다**. `releaseCertified=false`는 그대로이며, 이 리포트는 미검토 영역에 대한 표본 심층 검토 결과다.

## 8. 권고 우선순위

**P0 (사용자 오정보 직접 발생)**
1. B1 NFP `/1000` 제거 — 오늘 바로 틀린 숫자를 보여주는 유일한 항목.
2. B2 뉴스 stale 배너 공개 모드 노출 + 헤더 주장 하향.
3. H1 chat 차단 게이트 override 제거.
4. H3 PCR: `DATA_SNAPSHOT.equityPutCall/indexPutCall` 보존.
5. H4 엔캐리 라벨/입력 정합(위험 점수가 반대로 움직임).

**P1 (계약·게이트 의미)**
6. H2 `currentSensitive` 축 확장(한글 종목명·실적·멀티플).
7. H5·`ci-research-flow-contract-check`를 렌더 노드 단언으로 승격.
8. H6~H11 수치 표면 정의 단일화(등급 함수 1개, breadth basis 1개, MACD writer 1개).
9. H12~H14 "실시간"/시각 표기를 관측시각+source 기준으로 통일.
10. `js/aio-core.js`의 공허한 계약 감사(자동 채움)와 stale 레지스트리 정리.

**P2 (구조)**
11. `ci-semantic-review-check.mjs`에 레저 신선도(`asOf` vs HEAD)와 삭제 파일 검사를 추가.
12. 감사 함수의 SHAPE-ONLY 16건에 의미 동반 검사 또는 명시적 백로그 등록(R219 Required).
13. `coverage-summary.json` 재생성으로 6.89% 기준선을 현 HEAD에 고정.

---

## 부록 — 재현 명령

```text
node scripts/ci-semantic-review-check.mjs
node -e "const j=require('./_artifacts/exhaustive-audit-20260831/coverage-summary.json');console.log(j.currentSemanticallyReviewedLines,j.codeConfigCurrentLines,j.releaseCertified)"
node _artifacts/full-review-20260916/tools/sweep-browser-gates.mjs _artifacts/full-review-20260916/browser-gate-sweep.json
grep -n "_nfpDelta" -r js/ public-data/
grep -n "news-stale-banner" index.html js/aio-data.js
grep -n "renderClaimLedger\|renderMediaAudit" -r .
```

기계 판독용 증거: `_artifacts/full-review-20260916/evidence.json` (`semanticReview` 절).
구조·CI 리뷰 본문: `_artifacts/full-review-20260916/REPORT.md`.
브라우저 게이트 전수 스윕 원시 결과: `_artifacts/full-review-20260916/browser-gate-sweep.json`.
