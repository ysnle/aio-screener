> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# Macro / Market source audit

MODE: review | REF df6f0b33abd1c15c268d818efcbfc3c5547ed9b0 | v58.20
VERDICT: PASS+NOTES (전문 읽기 완료; 제품 전체·실브라우저·최신HEAD 인증 아님)
확정: PRE-EXISTING warning 3건. 추가 NOTED 1건. 검토자 current_financial_review, correctness/root-cause lens; independence limited(동일 모델 팀).

## 동결 경계와 원장

- 직접 전문 검토 FULL 25개, root 전문 검토 ROOT_REUSE 2개(benchmarks.js/session-time.js), 소유 범위 PARTIAL/NOT_READ 0개. 파일별 SHA256·범위·판정은 macro-market-reading.tsv에 기록했다.
- 검토 중 workspace가 v58.50 / HEAD 143f4c6e2b954754f6df1bad7b5d07bcd54d2955로 바뀌었다. 새 index-earnings.js/market-timeline.js와 이후 변경의 품질은 이번 보고 범위에 포함하지 않는다. 대상은 최초 df6f0b33의 27개 파일뿐이다.
- 초기 원장 SHA256 27개는 모두 `git show df6f0b33:<path>` 원문의 SHA256와 일치했다. 이후 혼입을 확인한 page-flow/regime-scenarios/macro-crossroads 앞부분은 `git diff df6f0b33 --unified=0`의 변경 블록을 확인하고 삭제된 원문 행을 다시 읽어 고정 원문과 맞췄다. 원문 동일 구간은 재사용했고, macro-crossroads 236~530은 git show 원문을 읽었다. 최신 추가 행은 판단에서 제외했다. 최종 고정 원문 hash 불일치 0개.
- 실행 반례는 `git show df6f0b33`의 모듈과 상대 import 의존성 16개를 재귀적으로 메모리 data URL로 바꿔 import했다. 제품 파일·의존성 파일을 쓰거나 새 checkout을 만들지 않았다. 최신 HEAD의 함수가 섞인 최초 탐색 실행은 확정 근거에서 제외하고 아래 동결 재실행 결과를 사용했다.
- 이전 감사의 finding/이유를 의도적으로 로드하지 않았다. caller를 찾는 넓은 git grep에서 과거 감사 경로의 unrelated 두 줄이 우연히 출력됐으나 후보 발굴·판정에 사용하지 않았다.

## M01 — [PRE-EXISTING][warning] 목표금리 상단만 도착하면 거시 읽기 전체가 예외로 중단됨

- 위치: `src/domain/macro/macro-read.js:283`.
- Trigger: macro.fedTargetUpper는 숫자이고 fedTargetLower는 null/누락인 부분 입력. policyPricing은 mid=null과 정책축 unknown을 올바르게 정하지만 evidence 생성은 upper만 검사한 뒤 lower.toFixed를 호출한다.
- Failure: `Cannot read properties of null (reading 'toFixed')`. 고용·물가 등 정상 입력까지 포함한 buildMacroRead 전체가 반환되지 않는다. 상단/하단을 모두 기다리는 정상 unknown 상태가 될 수 있었던 화면이 멈춘다.
- 실행 proof: 동결 모듈 closure로 `buildMacroRead({macro:{fedTargetUpper:5}})` → 위 TypeError. 대조군 `{fedTargetUpper:5,fedTargetLower:4.75}`와 `{}` → 정상 반환, policy.state=unknown. 현행 기입된 artifact에 한쪽만 실제 누락되었다고 주장하지 않는다.
- Caller chain: 공식 입력은 `scripts/lib/macro-sources.mjs`의 필드별 수집/유지(DFEDTARL/DFEDTARU는 별도 series) → root._aioServerMacro → `src/ui/components/macro-board.js:467,592`, `src/ui/components/macro-crossroads.js:26` → buildMacroRead. 해당 호출부에 lower/upper 쌍 검증은 없다. publish gate가 일부 부분 입력을 막을 수 있지만 public 함수와 렌더 caller는 partial macro를 받는 계약이다. 실제 브라우저 장애 재현은 하지 않았다.
- 최소 대안: evidence의 범위 문자열은 upper와 lower 둘 다 있을 때만 만들고, 한쪽뿐이면 누락 상태를 유지한다. 새 추상화/공급자 변경은 필요 없다. 상단만/하단만/둘 다 없는 입력에서 전체 거시 read가 반환되는 회귀를 확인한다.

## M02 — [PRE-EXISTING][warning] 기간 프리미엄이 없어도 '오르지 않음' 조건을 충족시킴

- 위치: `src/domain/market/macro-crossroads.js:297` (`reflation`의 세 번째 조건). 연관 helper는 197행 rose.
- Trigger: tnx20와 curve20는 측정되어 각각 밴드 밖 상승인데 termPremium20가 null. `rose(null)`은 null을 반환하지만 `!rose(...)`가 true가 된다.
- Failure: 성장 기대형 금리 상승을 기간 프리미엄 상승과 구별할 자료가 없는데, 검증한 것으로 계산한다. 알려진 조건 수와 충족 수를 모두 늘리고 중심 시나리오·기회비용 문장까지 연결된다.
- 동결 실행 proof: `buildMacroCrossroads({signals:{payroll3:250,payrollPrior3:200,retailYoy:4,tnx20:0.5,curve20:0.3,termPremium20:null,breadth:'favorable',bands:{tnx20:0.1,curve20:0.1,termPremium20:0.1}}})` → leadId=reflation, reflation.met=4, known=4, fit='조건 충족 4/4', 세 번째 조건 true. termPremium20=0 대조군도4/4; termPremium20=0.5 대조군은3/4/조건false. null이 측정된0과 똑같이 취급됨을 실제 모듈에서 확인했다.
- Caller chain: `seriesOf(macroHistory,'termPremium10')` → changeOver(...,20)가 기록 부족시 null → buildScenarioSignals.termPremium20 → BRANCHES.reflation.conditions[2] → buildMacroCrossroads 406~413 known/met → 442~495 ranking/headline → 화면/AI 시나리오. producer 없이 fixture로 실제 계산 경로를 실행했다. 모든 macro series가 있어야 이 화면을 렌더한다는 guard는 없다.
- 반론: 기간 프리미엄이 항상 완비된 현재 데이터에서는 가려진다. 그러나 이미 코드가 기록 부족을 null로 표현하므로 null은 허용 입력이며 '확인 불가'여야 한다. 단순 임의 외부입력 문제가 아니다.
- 최소 대안: 기간 프리미엄까지 존재하는지를 all 조건에 포함하거나, 명시적으로 null을 전파한다. 반증은 null 입력의 known=3, 해당 조건=null이며 4/4로 읽히지 않는 것이다.

## M03 — [PRE-EXISTING][warning] 세부 테마가 전부 소표본이면 대표 비교 보류를 우회함

- 위치: `src/domain/market/page-flow.js:305` (headline 없을 때 mine으로 fallback), 결과 문장 318행.
- Trigger: 같은 themeId의 두 개 이상 하위 그룹에 3개월 수익률이 있지만 전부 smallSample=true. headline 필터는 전부 제외하지만 이후 `headline.length ? headline : mine`이 그대로 되살린다.
- Failure: 참고로만 남겨야 할 2~3종목 그룹을 '3개월 기준 가장 강한 곳/가장 약한 곳'으로 대표 비교한다. 행 옆의 참고 표기는 남지만 상단 비교 결론이 소표본 보류 의도와 어긋난다.
- 동결 소스 실행 proof: groups=[{themeId:'a',name:'One',smallSample:true,ret3m:20},{themeId:'a',name:'Two',smallSample:true,ret3m:-5}] → read='3개월 기준 가장 강한 곳은 One(+20.0%), 가장 약한 곳은 Two(-5.0%)입니다.'
- Caller chain: `buildGroupStrength`는 최소 2종목 그룹을 보존하고 4종목 미만을 smallSample로 발행(`src/domain/themes/group-strength.js:74~97`) → `src/ui/pages/themes.js:615~620`가 전체 groups를 themeDetailFlow로 전달 → 626행이 flow.read를 바로 렌더한다. 별도 headline-coverage guard가 없다. 작은 그룹은 테이블에 남는 정당한 입력이며, 공급자 일부 누락으로 큰 그룹이 소표본이 되어도 같은 경로다.
- 현재 artifact 반론/발현 범위: 동결 THEME_MAP + 동결 screener.json을 실제 buildGroupStrength에 넣은 89그룹에서 전부 소표본인 테마는0개였다. 따라서 현재 정적 데이터에서 문장이 발생했다고 보고하지 않는다. 입력조건 반례·실제 caller 경로로 확인한 기존 결함이며 실브라우저 재현은 하지 않았다.
- 최소 대안: rows의 참고 fallback은 보존하면서 strongest/weakest를 만드는 후보는 headline에서만 선택한다. headline에 두 그룹이 없으면 대표 비교 한 문장을 생략하거나 표본 부족을 말한다. 테마 기능 제거·새 분석모형은 필요 없다.

## NOTED / 기각·측정 제한

- `src/domain/macro/treasury-curve.js:152`: atomicPoints가 Number(null)을 유한한0으로 받아 누락된 만기를0% point로 만든다. 동결 소스 입력 dgs2=4,dgs5=null,dgs10=4.2,dgs20=null,dgs30=4.5는 points의5Y/20Y를0으로 반환한다. 그러나 현재 코드 검색에서 curve.points를 수치 표/차트에 소비하는 경로를 입증하지 못했다(getUsTreasuryCurveEvidence는 모델 전체만 반환). 실제 사용자 손상 finding으로 승격하지 않는다. 향후 숫자 consumer를 붙이기 전에 finiteOrNull/clampYield를 일관되게 적용하면 된다.
- fixed 2026/2027 휴장표 자체를 외부 공표 원문과 재대조하지 않았다. US/KR 독립 세션, DST/half-day, unknown-year fail-closed 및 관측창 계산의 코드 구조는 전문 검토했다. 공식 캘린더의 신규 변경·2028 준비 상태를 인증하지 않는다.
- 명목/실질/기대인플레는 날짜 정렬 여부와 bp/%p 변환을 읽었고, 서로 다른 시계열/기간을 인과로 단정하지 않는 설명을 확인했다. 경기·유가·신용 전달 경향의 실증적 예측력이나 보유 비중 선택의 성과 우위를 검증한 것은 아니다.
- breadth/radar/sector-map의 범위·분모·부분 관측·동일 close·기록 수와 raw daily bar의 세션 의미를 확인했다. 조건 충족 수를 확률로 인증하지 않았고 내부 정렬 likelihood 값만으로 버그를 만들지 않았다.
- 월별 부족 구간, producer의 누락 형태, 휴장 이후 복구 등에 대해 전 조합 테스트를 실행한 것은 아니다. 전문 읽기와 위3개 격리 반례/1개 NOTED를 구분한다. 브라우저/네트워크/producer/성능 benchmark/전 QA는 수행하지 않았다.

## 최소 구조 정리 의견

공통 close-series/session helpers를 현재 도메인들이 이미 함께 사용하므로 대규모 재작성보다 null/unknown을 합성 조건에서도 그대로 유지하는 세 군데 수정이 우선이다. 과도한 파일 분할이나 이름 정리는 이번 finding이 아니다. product/producer 수정 없음. 산출물 MACRO-MARKET.md/macro-market-reading.tsv 외 파일 생성·수정 없음. commit/push/deploy 없음.
