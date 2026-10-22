# Root 산출물 독립 재검토

MODE: review · VERDICT: PASS+NOTES · 수정이 필요한 구체 문제 **0건**.

`SCREENER.md`, `screener-probe.mjs`, `screener-probe-result.json`, `screener-receipts.mjs`, `tools/continue-review.mjs`를 읽고 SCR04의 실제 parser/evaluator와 UI commit 구간을 대조했다. 제품·브라우저·네트워크·producer를 실행하지 않았으며 이 파일만 작성했다.

- **SCR04 주장은 근거와 일치한다.** `custom-conditions.js:184`의 FILLER가 ‘또는’을 없애며 `matchesConditions:138`은 every로 결합한다. 기록된 PE10/ROE5 반례는 OR에서는 통과해야 하나 false이고, AND 대조도 false다. ‘미만/초과’를 inclusive 조건으로 만드는 rule과 경계 PE20/ROE15의 true도 일치한다. `screener-custom.js:146–153`은 인식 조건을 commit하고 원문을 지운다. unknown이 있는 ‘PER 20 이상’은 별도 검색/안내가 있다는 반론까지 본문이 보존해 조용한 완전 이해로 과장하지 않았다.
- **브라우저 주장의 경계가 적절하다.** 저장된 OR JSON/DOM에서 AND 칩, 전체 결합125개, 다른 필터 후56개, footer v58.60을 확인했다. 미만 DOM은 ‘이하’ 칩을 확인한다. 본문은 정확히 경계인 실제 종목의 live 통과를 주장하지 않고 synthetic fixture와 구별한다. 이번 검토자가 그 브라우저 동작을 재실행한 것은 아니다.
- **14 FULL과 17 dependency가 구별된다.** 읽기 원장14행은14개 고유 경로이며 고정 blob의 SHA-256·전체 행 범위와 모두 맞았다. probe 결과의 dependency17개도 고유17개이고 기록된 fixed/current SHA 차이는0이다. dependency 복사를 전문 읽기로 올리지 않는다는 설명이 명시돼 있다. 읽기 영수증은 사람/에이전트의 전문 읽기 선언이며 해시 검사만으로 의미 검토를 자동 입증하지 않는다는 한계도 유지한다.
- **helper의 의도된 쓰기 범위·증거 집계가 맞는다.** probe는 pinned cache와 자기 JSON만 쓰며 외부 fetch를 거부한다. receipts는 고정/현행 SHA가 다르면 중단한다. continue-review는 고정REF의 FULL/FULL_DIRECT만 수락하고 해시·행 범위·중복을 확인하며 PARTIAL/WORKTREE를 제외한다. 현재 네 원장을 읽기 전용으로 대조한 결과 수락 대상28개에 중복·baseline SHA 불일치는 없었다. 이 helper는 원장을 다시 쓰므로 본 검토에서 실행하지 않았다. fetch 교체 자체를 OS 수준 네트워크 격리라고 인증하지 않는다.

SCR01–03은 기존 발견 재확인, SCR05는 현재 live UI 호출을 입증하지 않은 잠복 계약으로 분리되어 있어 발견 수·사용자 영향의 과장을 확인하지 못했다. 보고서가 명시한 고정소스/현행동일SHA/과거 배포 DOM/합성 실행의 구분을 그대로 유지하면 된다.

독립성: 동일 모델의 별도 에이전트 문맥으로 **limited**. 이번 판단은 저장된 재현 결과와 소스의 독립 대조이며 probe·브라우저 재실행이나14파일 전체의 두 번째 의미 전수검토는 아니다.
