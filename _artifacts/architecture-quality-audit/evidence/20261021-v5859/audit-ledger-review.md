> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# 감사 원장 오인증 경계 검토

읽기 전용 검토 결과: **검토 당시 집계에는 FULL 계승 근거가 확인되지 않는 7행이 있었다.** 그 외 미독·부분 읽기는 대체로 보존되며, UI의 INHERITED_FULL과 legacy core의 FULL_SOURCE_READ 추가 처리는 receipts의 의미와 맞는다. 이 독립 검토자는 assembler·원장·다른 담당 파일을 수정하지 않았다.

root 후속 처리: diff receipt의 base hash와 이전 FULL 근거 확인을 assembler에 추가했다. 7행은 DIFF_ONLY로 정정했고, market-read/entity stock-read 2개만 담당자가 실제 전문을 추가 읽어 별도 domain-complete-reading.tsv로 보완했다. 나머지5개는 FULL로 승격하지 않았다. 아래 표는 발견 당시 스냅샷이며 최신 집계는 coverage.json을 따른다. 새 checkout 차이는 고정 SHA 읽기 증거와 분리해 기록한다.

대상 snapshot은 coverage.json의 `observedAt: 2026-10-21T08:26:17.077Z`, REF `7e2411432f6ca0e5f02528b209b013bf5f7ff2dc`이다. assemble.mjs, 현재/이전21 reading-ledger.json, 두 source-inventory.json, 이전 producer/interpretation/legacy-current receipts, 현재 UI/domain/legacy-core receipts를 대조했다. root-reading.tsv·tooling-reading.tsv는 관측 시점에 없었다. 이후 동료 결과가 추가되거나 재집계되면 이 snapshot의 숫자는 최신을 뜻하지 않는다.

## 수정이 필요한 오인증

assemble.mjs는 현재 receipt의 상태가 `FULL_DIFF_REVIEW`이면 이전 기준본이 FULL로 읽혔는지 확인하지 않고 `FULL_BASE_PLUS_DIFF_REVIEW`로 승격한다. diff 전체를 읽은 증거는 기준본 전체를 읽은 증거를 대신하지 못한다. 현재 다음 7행은 reason도 “d36bb256→고정 REF 전체 diff 의미 검토; 주변 caller는 별도 PARTIAL”이라고만 되어 있다.

| 경로 | 이전21 원장 상태 | 현재 원장 상태 |
|---|---|---|
| scripts/lib/factors.mjs | NOT_SEMANTICALLY_REVIEWED | FULL_BASE_PLUS_DIFF_REVIEW |
| scripts/lib/macro-sources.mjs | PARTIAL_PRIOR_READ | FULL_BASE_PLUS_DIFF_REVIEW |
| scripts/lib/market-analysis-numbers.mjs | CHANGED_REVIEW_REQUIRED | FULL_BASE_PLUS_DIFF_REVIEW |
| scripts/lib/market-analysis-validate.mjs | CHANGED_REVIEW_REQUIRED | FULL_BASE_PLUS_DIFF_REVIEW |
| src/domain/briefing/daily-diff.js | CHANGED_REVIEW_REQUIRED | FULL_BASE_PLUS_DIFF_REVIEW |
| src/domain/briefing/market-read.js | PARTIAL_CURRENT_REVIEW | FULL_BASE_PLUS_DIFF_REVIEW |
| src/domain/entity/stock-read.js | NOT_SEMANTICALLY_REVIEWED | FULL_BASE_PLUS_DIFF_REVIEW |

이전 producer-reading.tsv·interpretation-reading.tsv·legacy-current-reading.tsv의 해시 일치 FULL/FULL_DIFF_REVIEW 보완 증거도 위 7행에는 없다. 이전 financial-delta-reading.tsv의 market-read.js도 PARTIAL로 명시되어 있다. 현재 receipt의 baseSha256은 이전 source-inventory 해시와 맞지만 **내용 동일성은 읽기 완전성 증거가 아니다**.

안전한 처리는 기준 FULL 증거가 없는 FULL_DIFF_REVIEW를 `DIFF_ONLY_REVIEW` 또는 PARTIAL로 남기는 것이다. 담당자가 이번에 전체 현재 파일을 실제로 읽었다면 그 전문 읽기 범위/근거를 별도 receipt에 보완한 뒤 FULL_CURRENT로 집계하면 된다. 이 검토는 해당 담당자가 실제로 읽지 않았다고 단정하지 않으며, 현재 원장의 FULL 인증을 지지하는 증거가 부족하다는 판정이다.

## 보존된 경계

- 현재 UI 31행의 current hash 및 기재된 base hash는 source-inventory와 모두 일치했다. 12개 BASE_PLUS_DIFF에는 이전 UI FULL/FULL_DIFF_REVIEW 계승이 있으며, 15개 INHERITED_FULL은 동일 SHA를 `REUSED_FULL_STATIC_REVIEW`로 남긴다. 이번 전문 재독으로 부풀리지 않는다. 4개 FULL은 UI 담당자가 이번 전문을 읽었다는 receipt와 맞는다.
- legacy-core-reading의 FULL_SOURCE_READ는 새로 읽은 후반과 기준 `[0,544000)` 부분+전체 diff/unchanged equality 계승을 합친 증거이다. assemble이 이를 FULL_BASE_PLUS_DIFF_REVIEW로 넣는 것은 현재 파일을 이번에 모두 새로 읽었다는 뜻으로 오인하지 않게 한다. receipt에 겹침·truncation 복구 구간도 명시되어 있다. 이 검토에서 해당 100만 자를 다시 읽었다고 주장하지 않는다.
- 이전 producer/interpretation/legacy-current receipts를 보완할 때 이전 source-inventory와 해시를 먼저 맞추고, 현재도 같을 때만 재사용하는 경계가 있다. 현재 producer HASH_REUSED_PRIOR_REVIEW는 이전 FULL을 유지하며 새 전문으로 승격하지 않는다.
- receipt의 PARTIAL이 기존 같은-SHA FULL 증거를 덮어쓰지 않는 것은 더 강한 기존 증거를 보존하는 처리이며 과대 승격이 아니다. 반대로 근거가 없는 부분 읽기는 PARTIAL_PRIOR_READ/PARTIAL_CURRENT_REVIEW로 남는다.
- coverage는 IN_PROGRESS이며 469개 경로를 미독/부분/변경 필요 목록에 보존한다. sourceDrift와 receiptMismatch는 관측 snapshot에서 빈 배열이다. 이 검토의 별도 read-only 대조에서도 현재 receipts의 current/base 해시 불일치는 없었다. 미독 목록의 정확한 숫자는 위 7행을 낮추거나 후속 receipts가 도착하면 바뀐다.
- REUSED_CANONICAL_MIRROR 13 및 REUSED_PRIOR_STATIC_REVIEW 17은 FULL 상태와 구분되어 있다. 이들을 전문 의미검토 수로 합쳐 인증하면 안 된다. 정적 읽기 원장은 브라우저/실행/라이브 검증 상태를 대신하지 않는다.

## 추후 실수 방지

assembler가 현재 receipt를 처리할 때에는 current hash뿐 아니라 diff receipt의 base hash와 기준 FULL 증거 상태도 함께 검증하는 편이 안전하다. `FULL_DIFF_REVIEW`라는 이름만으로 기준 전문 존재를 가정하지 않아야 한다. `FULL_SOURCE_READ`는 실제 receipt가 합성 읽기인지 현재 전문 재독인지 그 이유를 유지해야 한다. 지금 파서가 이 상태를 base+diff로 분류하는 것은 해당 legacy receipt에는 보수적으로 정확하다.

검토 시작/집계 대조 당시 지문:

- assemble.mjs: `6360c4d4154c5563c58b16d529b18ef0b0ed5d13eb53d85b43f5b7b756accae5`
- coverage.json: `1731b993985933fe67ab51a974ae63e51c6d7d88e1cb57e4e8d17138745e15ef`
- reading-ledger.json: `1dd2194e71945f0eb7f5d8b42700e7dda85ec052fbdefa935c3e6071b7d384ea`
- domain-reading.tsv: `3e5c33e2d9a0e7d64a49e090817f76a84f530830280d13cd46a68e98e981e237`
- ui-reading.tsv: `bf827721f861874736ac1ddef3a636b351f03f12282a9338f8f38b690ee2fe0c`

제품·producer·외부 API·유료 AI 실행 및 Git mutation 없음. assembler도 실행하지 않았다. 이 보고서는 기존 집계의 의미 경계 감사이며 전체 소스의 새로운 전문 인증이 아니다.
