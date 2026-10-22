# 스크리너 계산·정규화·문장 조건 의미 재검토

MODE: review | VERDICT: FAIL (검토 범위의 보완 필요) | REF: `7e2411432f6ca0e5f02528b209b013bf5f7ff2dc` (v58.59)

의도는 순위·조건·통계가 실제 입력의 의미를 보존하는지 확인하는 것이다. 완료 기준은 전문 읽기 원장과 조건별 양성/음성 대조를 남기는 것이다. 가장 중요한 위험은 계산 성공과 설명의 타당성을 같은 것으로 취급하는 것이다. 제품 수정은 없으며 아래 제안은 반영 전 검토 결과다.

## 확인한 보완

### SCR01 — [PRE-EXISTING][ACT ON][P2] NOT 내부 가격 변화가 계산 입력 식별자에 빠진다 (기존 C03)

`src/domain/screener/screen-engine.js:163–169`의 walker는 children만 순회하고 평가기의 not.child(:77–79)를 순회하지 않는다. 공개 `runScreen`을 실행하면 NOT(price.close ≥ 50), 가격40→60에서 passed→rejected이고 resultHash도 달라지지만 calculationInputId는 같다. 직접 range는 식별자가 달라지고 가격을 읽지 않는 rank 조건은 그대로인 대조도 확인했다. 현재 기본 preset은 NOT를 사용하지 않으므로 모든 일반 실행이 잘못됐다는 뜻은 아니다. 계약·재생·저장 화면이 허용하는 AST 경계의 기존 결함이다. 최소 보완은 공통 walker가 child도 순회하도록 하는 것이다.

### SCR02 — [PRE-EXISTING][ACT ON][P2] 정보가 없는 상수 열을 독립 신호로 센다 (기존 C04)

`factor-overlap.js:73`의 Spearman null→0 치환과 대각1 때문에 30개 동일값 두 열이 상관0·독립 신호2개로 설명된다. 상수1열+변동1열도2개다. 같은 방향으로 변동하는 두 열 대조는 상관1·독립1개다. 입력이 정상적으로 분산된 경우까지 잘못됐다고 판정하지 않았다. 변동 없는 열을 제외하거나 수치를 보류하고 이유를 밝히는 것이 최소 대안이다. 참여비율은 상관행렬의 유효 차원 지표이며, 이를 통계적 독립이나 독립된 투자 근거의 증명으로 표현하는 문구도 약하게 해야 한다. 후자는 수치 오류와 구별한 설명 개선 의견이다.

### SCR03 — [PRE-EXISTING][ACT ON][P2] 합법적인 valuationPrice가 정규화에서 유실된다 (기존 C06 / F-FIN-01)

`src/data/normalize/screener.js:123` 부근 whitelist가 `_valuationPePrice`와 `_valuationPbPrice`는 보존하지만 provider가 발행하는 `_valuationPrice`는 버린다. `consensusView`는 이 키를 우선 읽는다. 실제 순수 모듈에 종가100·예상EPS5·과거EPS−1을 넣으면 정규화 전 Forward PER20, 후 view=null이다. `_valuationPePrice=100` 대조는20을 유지하고 가격 자체가 없는 대조는 원래 null이다. provider의 실제 필드 연결은 `src/data/providers/screener.js:603–605`, 소비는 `consensus-read.js:34`에서 대조했다(해당 provider 전체를 새 FULL로 세지 않음). 과거 실제 artifact7종목 증거는 기존 FINANCIAL 문서에 보존하고 이번 합성 실행과 합산하지 않았다. 최소 대안은 canonical 가격을 정규화/관련 소비자에서 보존하는 것이다.

### SCR04 — [PRE-EXISTING][ACT ON][P2] 문장 조건이 논리 연결과 엄격한 경계를 바꾼다

`custom-conditions.js:189`의 FILLER가 **또는**을 지운 뒤 `matchesConditions`(:136)의 every가 AND로 평가한다. `PER 20 이하 또는 ROE 15% 이상`은 unknown 없이 두 조건으로 바뀌어 PE10/ROE5를 탈락시킨다. 정상 AND 문장은 같은 결과이며 이는 대조군이다. 또한 `PER 20 미만`을 `pe ≤ 20`, `ROE 15% 초과`를 `roe ≥ 15`로 바꾸므로 정확히 경계인20/15가 통과한다. `PER 20 이상`은 반대 pe-max를 먼저 만들고 '이상'을 unknown으로 남긴다. 이 경우 caller가 이름·업종 검색에 unknown을 넣는다는 점을 감안해 '완전히 이해했다고 조용히 표시한다'고 확대하지 않았다.

실제 caller `src/ui/components/screener-custom.js:146–153`는 인식한 조건을 즉시 commit하고 입력 원문을 지운다. **배포 v58.60 실브라우저**에서 위 OR 문장을 입력하자 AND 칩 두 개·전체 유니버스 결합125종목/다른 필터 적용 후56종목으로 표시됐고, 원문 재해석 경고는 없었다. `PER 20 미만`은 'PER 20배 이하' 칩으로 표시됐다. 실제 경계값 종목의 live 통과 여부는 측정하지 않았고 pure fixture만 확인했다. 표본 수는 당시 배포 데이터의 관측값이지 반복 보장 수치가 아니다. [OR DOM](./browser-or.snapshot.txt), [원시 관측](./browser-or.json), [화면](./browser-or.png), [미만 DOM](./browser-strict.snapshot.txt)을 따른다. footer 버전 관측은 배포 파일 전체의 바이트 인증이 아니다. 임시 조건은 UI의 모두 지우기로 정리해 조건 없음904개 상태를 확인했다. 저장/AI 전송은 하지 않았다.

최소 대안은 OR·부정·미지원 비교 연산자를 지원하지 않는 입력으로 명확히 되돌려 주고 기존 조건을 바꾸지 않는 것이다. OR AST나 자연어 AI를 새로 도입할 필요는 없다. '미만/초과'를 허용하려면 정확한 경계 연산을 저장·표시·평가 전체에 보존해야 한다. 조건이 AND라는 안내가 있다는 것은 반론이지만, 문장 파서가 반대 논리를 성공 처리하고 원문을 지우는 행위까지 정당화하지 않는다.

### SCR05 — [CONSIDER][잠복 계약] 조건부 통계의 READY는 독립 표본/비중첩을 보장하지 않는다

`conditional-evidence.js:211–228`은 lineage 통과 행을 그대로 세며 같은 sessionId/instrumentId의 반복이나 결과 창 중첩을 제거하지 않는다. 같은 과거 관측1개를30번 전달하면 READY·30/30·100%, 단일1개 대조는 LOW_SAMPLE_BLOCKED다. 현재 호출 검색에서 evaluator의 외부 소비자는 `scripts/ci-conditional-evidence-contract.mjs`만 확인됐다. **이 수치가 현재 live UI에 표시된다는 finding으로 세지 않는다.** 향후 연결할 때 producer의 표본 단위/비중첩 계약과 같은 history의 기준 빈도가 필요하다. RIGHTS/CALENDAR lineage가 CURRENT_CANDIDATE인 것만으로 연구 표본의 독립성·효과를 인증할 수 없다. 무턱대고 sessionId 단독 중복 제거를 하면 서로 다른 종목의 정상 표본도 버릴 수 있으므로 outcome window/instrument까지 포함한 정의를 먼저 정해야 한다.

## 전문별 구조·결정 평가

- `factor-weights`: unpromoted 모델의 고정 중립 비중, promotion+parity+review 조건을 모두 요구하는 전환은 유지할 가치가 있다. 중립 raw 비중 합0.92 자체를 오류로 세지 않았다. 실제 ranking의 정규화와 다른 층이다. 손으로 정한 동적 비중은 연구 제안이며 성과 우위를 검증한 사실이 아니다.
- `model-fingerprint`: ranking/validation/population identity를 나누고 canonical 키 정렬을 하는 것은 유익하다. 4자리 반올림 identity의 충돌 가능성은 이론적 후보로만 보았고 현재 도달하는 잘못된 재사용은 재현하지 않아 새 finding으로 만들지 않았다.
- `candidate-record`: 같은 identity의 forward 기록을 비중첩으로 선별하고 미국 IC 표본을 따로 요구한다. 최소12개와 t≥2는 운영 검토의 기준일 수 있으나 종목 선택의 검증된 우위·인과·다중 비교 통제까지 보장하지 않는다. 허위 승격 반례는 이번 범위에서 확인하지 않았다.
- `row-presentation`: factor vocabulary 통합·80% computability·미산출 rank 보류는 유지한다. 근거의 가용률은 그 근거가 맞거나 예측력이 있다는 뜻은 아니다. 함수 길이만으로 분리할 필요는 없다.
- `screener-read`: 상위집단 최소 표본과 업종 쏠림, 회전/모멘텀 중복 근거 경고는 유익하다. 도메인 요약을 UI마다 다시 계산하는 것보다 단일 결과를 소비하는 방향이 낫다. 기존 IC-t의 다른 통계 소비(A11)는 별도 미해결로 유지한다.
- `setup-profile`: 이진 조건 묶음과 설명은 연구 상태로 한정해야 한다. winner/climax/회복 등 경험 규칙의 이름이 예측 성과를 인증하지 않는다. 대규모 가중치 재설계보다 입력 날짜·표본·결측 보존이 먼저다. 현재 수치로 이 임계값이 최선이라는 실증은 없다.
- `custom-conditions`/UI: 사람이 선택한 필터, 조건별 분모·가용성·전체표의 다른 필터를 설명하는 방식은 유지한다. 자연어가 의미를 바꾸는 SCR04를 먼저 보완한다. UI module 세션 상태가 저장 설계와 맞는지 보았고 이 범위에서 새로운 저장/복원 결함은 확정하지 않았다.
- `conditional-evidence`/`evidence-lineage`: 순수 계산과 수집/권리 판단 분리, provenance 결측 fail-closed는 바람직하다. lineage 검증·표본 집계·투자적 유효성을 별도 단계로 유지해야 한다. 현재 READY라는 이름을 전체 연구 타당성 PASS로 설명하면 안 된다.
- `screen-engine`/normalize/consensus: data-only AST, unknown을 별도로 보존하는 평가, 순위 없는 통과 행과 동점 순위를 구별하는 것은 유지한다. replay 의미와 입력 identity의 정확성은 SCR01처럼 실제 mutation으로 검증해야 한다. whitelist는 producer가 더한 필드를 조용히 유실시키기 쉬워 consumer까지의 보존 fixture가 필요하다.

## 근거·한계

[읽기 원장](./screener-reading.tsv)의14개는 전문을 직접 읽었다. imports17개를 pinned cache에 복사해 실행한 것은17개 전문 읽기가 아니다. [probe](./screener-probe.mjs), [결과](./screener-probe-result.json)는 pinned 모듈과 합성 입력으로 실행했고 모든 의존파일17개의 현재 SHA가 fixed REF와 일치했다. 과거 은퇴한 regime 모듈을 참조하는 옛 probe를 수정·복원하지 않고 필요한 반례만 새 helper로 재검증했다.

브라우저는 배포 v58.60의 맞춤 조건 두 입력에만 한정한다. 최신 dirty v58.62 전체·다른 route·모든 지식·실제 AI·공급자 수집·성과 검증을 인증하지 않는다. 제품 수정·commit/push/deploy 없음. 모델 독립성은 같은 모델의 분리된 문맥 수준으로 제한된다.
