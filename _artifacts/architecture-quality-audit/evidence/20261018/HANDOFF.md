> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# 코드베이스 구조·품질·리팩토링 감사 — 진행본

기준은 로컬 v57.98, HEAD `8baf2f0f072e6da8d70cb086e5dbb4fba799165b`다. 제품 소스·버전·운영 데이터는 수정하지 않았다. 커밋·푸시·배포·로컬 producer·유료 AI 호출은 하지 않았다. 이번 감사의 새 산출물은 이 폴더에만 있다. 이전 감사의 dirty 변경은 이 작업 소유가 아니다.

**현재 결론:** native ESM·도메인 순수 함수·화면 수명주기로 옮긴 방향은 유지할 만하다. 우선 개선 대상은 폴더 수나 함수 길이가 아니라, 계층 사이에서 날짜·결측·권한·입력 identity가 달라지는 경계와 이를 놓치는 검증 oracle다. 전면 재작성이나 새 프레임워크가 필요하다는 근거는 없다.

이 문서는 전체 전문 검토 완료 보고가 아니다. 현재 파일별 상태와 정확한 숫자는 [coverage.json](./coverage.json), [783행 읽기 원장](./reading-ledger.tsv)을 따른다. 구조 인벤토리·syntax parse·부분 읽기·전문 의미 검토·동일 hash 이전 검토 재사용·격리 실행·실브라우저·라이브는 서로 다르다.

## 먼저 고칠 구체적 문제

[REPRODUCED.md](./REPRODUCED.md)에 실제 소스 모듈/함수로 재현한 C01~C14와 원시 결과·양성 대조군을 기록했다. 현재 제일 우선할 것은 다음이다.

1. **오래된 금리 자료에서 공유 국면 모델 예외(C12).** `unknown`으로 보류해야 할 축에서 null.yearPosition을 읽는다. 오늘/시장 상태의 직접 caller와 AI context가 이 모델을 공유한다. 실제 배포 발생 빈도는 미확인이다.
2. **검사 대상이 빠지는 QA(C02/C10/C14).** cache 입력 누락, hidden 텍스트 assertion, JS391개를 빼고 PASS하는 CSP collector다. 제품을 고친 뒤에도 이 oracle가 그대로면 회귀를 놓칠 수 있다. CSP 누락을 실제 보안 침해로 확대하지 않는다.
3. **설명과 계산의 의미 손실(C03/C04/C06~C08/C11/C13).** NOT 조건의 입력 ID, 상수 팩터 독립정보, 가격 필드 손실, 빈 순이익0%, 다른 날짜의 상대수익률, 금리 하락의 상승부담 설명, fallback의 가짜0점이다.
4. **검색 clear race(C01), SW 캐시 소유권(C09).** 명확한 경계 수정과 대조 fixture로 좁게 해결할 수 있다.
5. **미연결 모델의 hold 시계(C05).** 격리 재현은 됐지만 현재 제품 caller는 확인되지 않았다. 화면 장애와 잠복 모델 결함의 우선순위를 같게 두지 않는다.

## 계층별 구조 판정

| 영역 | 유지할 점 | 개선 방향·한계 |
|---|---|---|
| 앱/라우터/상태 | 취소·역순 정리·늦은 mount 정리, 얇은 commands/selectors | app lifetime와 start/stop 범위 명시. 원본 데이터 writer와 native renderer 소유권 구분. [기반46개](./FOUNDATIONS.md) |
| 데이터/계약 | canonical evidence evaluator, 공유 artifact TTL·in-flight·null 보류, producer/consumer 경계 | runtime/screener의 복제된 권한 판정·가격 whitelist·종가/live quote 혼합·영구 성공 캐시 개선. [107개](./DATA-AI.md) |
| 도메인/통계 | 순수 계산과 주입 clock, 실제 evidence·missing 상태 | 부호/표본/기간/입력 identity를 대칭 fixture로 검증. 도메인 미완독 항목은 원장에 남김 |
| UI/시각화 | 도메인 모델과 DOM 분리, 공통 날짜/근거, 차트의 ticket 기반 race 방어 | async 입력을 render signature에 모두 결속, unavailable 상태를 숨기지 않기, 키보드 동등 경로, 같은 날짜·null 표현. [UI](./UI.md) |
| AI/Worker | Secrets, 원자 월예산, dispatch 이후 미완료 예약 보존, typed claim publication | relay의 공급자 호출 count 예외 release, AI context→UI collector import를 좁게 분리. 현재 T3로 차단된 권한 경로는 잠재 문제로 별도 표시 |
| 빌드/배포/SW | staged bundle, source hash manifest, CI-attested SHA 경계 | source 성공과 실제 배포 bundle/SW 성공은 별개. 이번 esbuild 미설치로 bundle 실행은 미검증. 타 앱 cache 삭제는 좁혀야 함 |
| QA/운영 도구 | risk-derived runner, 실패 배치 보존, no-cache 릴리스 경계, SEC hash 결속·labelled skip | 입력 closure·행동 oracle·SKIP 집계·단일 실패 원인 negative fixture 강화. [도구](./TOOLING.md), [CI 조사](./TOOLING-CI-1.md) |
| 지식/정책/문서 | 구조 reference와 검증된 시장값 구분, 이전 전수 의미 검토의 같은 hash 재사용 | 분량/문자 pin은 편집 보조다. 근거 적합성·검산·사용자 이해의 인증이 아니다. 이전 정책·콘텐츠 감사와 연결하며 이번 코드 전문 읽기 수에 JSON 전편을 합산하지 않음 |

## 규모·의존성 측정의 올바른 해석

- tracked 1차 소스783개·216,020 split-line slots. generated agent mirror14개를 제외하면 물리적 정본769개다. 이 수치는 전문 의미 검토 완료 수가 아니다. market/knowledge JSON과 과거 audit 산출물은 별도 데이터 범위다.
- JS/MJS749개 syntax parse 오류0. index의 실행 가능한 inline script3개도 별도로 parse했다. CSS/HTML/YAML/Python 전체의 문법·실행 검증을 뜻하지 않는다.
- bootstrap에서 알려진 src module357개·edge942개, 정적 boot 연결256개, 상대 import 미해소0·정적 순환0. literal dynamic import만 추적한다. global 문자열 caller나 runtime 순환을 완전 인증하지 않는다.
- 정적 boot 연결의 원문은2,909,130 bytes다. **배포 다운로드 용량이 아니다.** esbuild tree shaking/minify·gzip·실브라우저 네트워크를 측정하기 전에는 이를 현재 로딩 지연으로 단정하지 않는다.
- bootstrap 비도달23개는 Node gate/실험/외부 consumer를 확인할 조사 목록이다. dead code 삭제 목록으로 사용하지 않는다.

원본은 [structural-analysis.json](./structural-analysis.json), [module-graph.json](./module-graph.json), [source-inventory.json](./source-inventory.json)에 있다.

## 권하는 리팩토링 순서

**1차: 의미를 고정하는 작은 수정.** C12 예외와 C14/C02/C10 oracle를 먼저 보완하고, 각 결함의 재현 입력·정상 대조·반대 부호·결측을 묶는다. 실제 source를 실행하는 기존 fixture에 추가하면 충분한 경우가 많다. 새 테스트 framework나 범용 validation DSL은 필요하지 않다.

**2차: 공통 불변식만 단일화.** 날짜/값/단위/출처/허용 용도의 tuple은 정규화에서 누락되지 않게 한다. display/reference/current claim/decision은 서로 다른 목적이므로 하나의 boolean canUse로 합치지 않는다. 그 안에서 권한 거부·정상 시각·미래 관측 배제 같은 공통 불변식만 정본 helper를 공유한다. AST 순회도 evaluator와 identity collector가 같은 node 종류를 다루도록 한다.

**3차: 실제 소비 경계에 맞춘 이동.** AI와 UI가 함께 쓰는 root collector만 data adapter/selector로 옮긴다. native route 하나의 입력 writer→정규화→state→renderer를 끝까지 추적하고 대체한 legacy writer만 삭제한다. 사용하지 않는 generic repository를 살리기 위한 대규모 이관은 권하지 않는다.

**4차: 측정 후 부팅/배포 최적화.** 실제 staged bundle을 확보해 initial chunk bytes·parse/evaluate·첫 route usable·route 재진입 자원 수를 먼저 잰다. 화면 지연 import가 있어도 공통 collector가 UI를 정적 import하면 boot에 연결될 수 있다. 해당 연결을 끊었을 때 실제 chunk·사용 가능 시각이 줄어드는지 확인한다. 파일을 더 나누는 것 자체를 성공 지표로 두지 않는다.

**5차: 운영 원칙 간소화.** 가족·친구 약5명 무료 운영 범위에 맞게 형식적인 SaaS 절차를 신규 blocker로 늘리지 않는다. 필요한 기준은 Secrets/공유 예산/실제 수집일·결측/issuer identity/계산 정합성/복구 가능성이다. 오래된 규칙·marker를 더 추가하기보다 동일한 실패를 검출하는 가장 작은 실행 계약을 유지한다.

## 계속 읽을 범위

UI/domain/CI 독자가 전문 검토를 이어가는 중이다. 일시적인 계정 사용 한도로 중단된 뒤 재개했으며 저장된 개별 읽기 증거만 집계한다. 아직 전체 legacy10개, 나머지 tooling, index markup/CSS, 설정/보조 도구 등 미완료가 남아 있다. [reading-ledger.tsv](./reading-ledger.tsv)의 NOT_SEMANTICALLY_REVIEWED/PARTIAL_READ를 다음 작업 목록으로 사용한다. 미완독을 구조 스캔이나 이전 자동 PASS로 채우지 않는다.

이전 감사에서 워크플로13개 전문과 v57.98 diff를 검토한 결과는 최신 SHA가 같은 경우에만 재사용했다. W01/W02/W05의 일부 잔여와 해소된 항목은 [최신 이전 판정](../../../exhaustive-quality-audit-20261016/LATEST-STATUS-v57.98.md)을 따른다. 이번에는 Actions/Cloudflare 계정·배포를 실행하지 않았다. 실브라우저/라이브 전체 재점검도 이번 코드 감사에서 새로 수행하지 않았다.
