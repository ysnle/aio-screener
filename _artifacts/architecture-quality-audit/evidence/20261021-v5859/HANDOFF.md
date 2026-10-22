> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# 전체 품질 감사 — 통합 핸드오프

MODE: review | VERDICT: 확인된 결함 있음 / 전수 의미 검토는 IN_PROGRESS
주 기준: `7e2411432f6ca0e5f02528b209b013bf5f7ff2dc`, v58.59. 추가 변경: v58.60 `659ffbad252f9eeacfa49a6ad1b895df87f66597`. 2026-10-21 KST.

이번 인계자료는 확보한 코드 검토·격리 재현·실브라우저·규칙 자체의 평가를 통합한 체크포인트다. **전체를 빠짐없이 완독했다는 완료 보고가 아니다.** 고정 실행/설정 소스850개 중 전문 근거405개(이번 기준 직접71, 기준전문+전체변경22, 동일SHA 전문 계승312), 동일 생성본13개, 부분/변경분/미독432개다. 직전 체크포인트의 미완료484개에서52개를 추가 해소했다. 지식 본문·데이터셋별 의미 검토는 이850개 밖의 별도 범위다. 현재 파일별 상태와 남은 목록은 coverage.json/reading-ledger.tsv에서 확인한다.

제품 코드를 수정하는 작업이 아니라, 구조·품질·정책·의미를 검토해 근거와 대안을 기록하는 작업이다. 제품/운영 데이터 수정, commit/push/deploy 및 로컬 producer 실행은 하지 않았다. 이전 dirty 변경은 이 작업 소유가 아니다.

## 우선 판단

대규모 분할 자체보다 **법인 일치, 결측·날짜·통화 보존, 설명 강도, 검증 oracle**가 우선이다. [이전 통합 인계](../20261021/HANDOFF.md)의 모든 항목이 최신에서도 미수정이라는 뜻은 아니다. 최신 검토는 source SHA별로 계승하거나 다시 확인한다. 전체 완독·전체 QA·배포 인증은 아직 아니다.

첫 보완 묶음은 법인 검증, 기간을 창작하는 수익률 fallback, 명백한 매매 지시의 응답 경계, 실패를 해소한 것처럼 만드는 QA 캐시다. 이어 FY 공통화/계좌 분모·통화/기여 방향과 inspector·키보드 검색을 보완할 근거가 있다. 프레임워크 전환·레거시 전면 이전보다 실제 오류가 반복된 경계를 좁게 고치는 편이 근거가 있다. 자세한 판단은 [구조·정책 자체의 평가](./DECISION-QUALITY.md)에 적었다.

## 통합 발견 목록

같은 원인의 여러 반례는 묶었다. 기존 버그를 개편 작성자의 신규 책임으로 돌리지 않으며, 가상 입력의 실행과 배포 발생을 구별한다. 아래는 이 체크포인트에서 우선 추적할 묶음이며 과거 보고서의 모든 finding을 최신 재현으로 승격한 총계가 아니다.

| 묶음 | 문제·사용자 영향 | 근거 / 최소 보완 |
|---|---|---|
| A01 법인 | HWM에 HPE 공시가 AI 인용 근거로 수락된다. AAOI/AFRM 매핑도 공식적으로 다른 법인이다. | 실제 core+chat VM, [공식 대조](./OFFICIAL-CROSSCHECK.md). 공통 issuer 정본과 응답 identity 검증. |
| A02 금리 결측 | 오래된 금리 입력에서 null.yearPosition 예외로 공유 해석을 만들지 못한다. | market-reading-result.json. 일부 입력 없음이 전체 예외로 번지지 않게 보류 상태를 반환. |
| A03 금리 설명 | 실질금리 ±20bp의 원인 설명이 같은 상승 부담으로 나온다. | 실제 반대 부호 fixture. 방향별 근거 문장을 대조. |
| A04 일정 날짜 | KST08시의 월 실적이 화 열에 들어가고 금 실적이 사라진다. | legacy-latest-repro.json의08/09시 대조. 날짜-only/시장 시간대 계약 통일. |
| A05 한국 결측 | 시세 미수신이+0.00%와 ‘하락0개>상승0개’ 진단으로 바뀐다. | 최신 고정 renderer VM, 과거 v58.50 실제 화면은 별도 증거. 결측을0으로 만들지 않음. |
| A06 QA cache | 의존 모듈을 바꿔도 gate fingerprint가 같다. | cache-identity-result.json, 정적20개 등록 후보. import closure/명시 입력의 완전성 검사. |
| A07 DuPont | ROE 하락을 상쇄한 이익률 상승을 하락 원인으로 설명한다. | [domain 반례](./DOMAIN-DELTA.md). 기여/상쇄 부호 구분. |
| A08 회계연도 | LDOS 같은 공시가 FY2025/2026으로 동시에 표시된다. | 최신 실제 화면+SEC, [BROWSER](./BROWSER.md). domain/UI/R&D 축의 직접 substring을 함께 정리. |
| A09 섹터 분모 | 주식500/채권500에서 Technology50%를 ‘주식 평가액의50%’라고 설명한다(실제 주식 부분100%). | [UI 반례](./UI-DELTA.md). 분모 명칭 또는 계산 대상을 일치. |
| A10 계좌 β | 주식100/현금9900 계좌에 보유 부분 β1을 ‘이 계좌 평균1%’라고 설명한다. 동일 현재비중 기준 계좌 β0.01이다. 기준통화 FX 반례도 같은 클래스다. | 실제 surface+stress 함수 실행. 현금/환율 포함 기준으로 계산하거나 현금 제외 보유 부분으로 명명. |
| A11 통계 대상 | IC의 t로 상하위 수익률 차이에 판단 가능/긍정색을 붙인다. | 같은12×100개 수익률에서 IC t61408.78, 차이 t1.12121. 해당 차이 자체의 통계 사용. |
| A12 inspector | 조건 전환 뒤 표 NVDA249위/근거308위가 함께 남는다. 행을 다시 누르면249위로 정상화된다. | 실제 v58.59 Pages. [양성 대조](./browser-inspector-positive-control.json). 현재 결과에서 선택 근거 재도출. |
| A13 검색 접근 | HBM 검색 후 Tab으로 결과에 가면180ms 뒤 숨김/BODY focus가 된다. | 실제 v58.59 Pages. 결과 영역 밖으로 focus가 나가는 경우만 닫음. |
| A14 규칙 보존 | 최고 R719 블록을 지워도 R-gap 검사가 놓친다. | [실제 검사 구간 VM](./tooling-review.md). 이전 defined-ID 집합/최고 기준과 비교. 전체CI 우회 성공이라는 주장은 아님. |
| A15 응답 지시 | 같은 문장의 부정절 때문에 명백한 매수 지시가 그대로 통과한다. 영어 지시도 검출하지 못한다. | [CHAT-1](./REMAINING-CHAT.md). 부정의 적용 대상을 행동별로 판정하고 교육 설명과 대조. 실제 모델의 생성 발생은 미측정. |
| A16 연결 대기 | health 내부12초/외부7.5초라 정상8.5초 응답도 첫 전송은 timeout이 된다. | CHAT-2 실제 route/task·축소 타이머. timeout·성공·취소의 수명 일치. |
| A17 오류 안내 | route 예외 cleanup이 abort한 뒤 안내 조건을 검사해 실패 안내0회가 된다. | CHAT-3 실제 release/예외 분기. cleanup 전에 사용자 취소 여부를 보존. |
| A18 근거 기준일 | pipeline이 반환한 종가 날짜를 disclosure에 넘기지 않아 검증된 종가도 미확인으로 표시한다. | CHAT-4 실제 완료 호출문/소비 함수. 게시 claim의 날짜와 개수 전달. |
| A19 저장 거절 | localStorage 거절이 최상위 예외로 뒤 키보드·검색 action 초기화를 끊는다. | [UI-SHELL-1](./REMAINING-UI.md). 거절/허용 전체 파일 VM 대조. 방문 기록 실패만 격리. |
| A20 기간 창작 | 보유 이력 요청 실패 시 누적 원가 손익을 선형으로 만들어30일 수익률·Alpha로 출력한다. | UI-SHELL-2: 이력0%에서+100%/Alpha100%p. 확보하지 못한 기간은 보류하고 비교 가능 범위를 명명. |
| A21 수집 완료 | main 충돌로 미게시한 SEC poll에도 완료 marker를 저장해 재실행 daily lane을 건너뛴다. | [WF01](./REMAINING-WORKFLOWS.md). 실제 조건과 age48→0 반례. 정상 no-change와 충돌을 구별. |
| A22 조사 커버리지 |455행을 유지하면서 A2단원이 빠지고454개 고유단위가 되어도 해당 gate가 통과한다. | [GV01](./REMAINING-GOVERNANCE.md). unitId/contentUnitId 집합의 일대일 대조. 전체CI 우회 주장은 아님. |
| A23 원고 중복 | seed 충돌1을 계산하고도 해당 uniqueness gate가 통과한다. | GV02. 공유 seed 허용 정책을 정하거나 정확 중복을 실패와 연결. 의미적 독창성 인증과 구별. |
| A24 완료 금지 | 미해결이 있을 때 완료 금지라는 검사가 미해결0 입력도 무조건 거부한다. | GV03. 해당 조건의 VM 반례이며 세부 운영 증거를 인증하지 않음. 증거에 따른 정상 전이를 허용. |
| A25 실패 캐시 | 동일 입력 PASS→no-cache FAIL→rerun-failed가 실행0회/CACHED로 실패 배치를 삭제한다. | [QR01](./REMAINING-QA-RUNNER.md). 실패 시 성공 cache 폐기, 실패 이후 실제 PASS를 요구. |
| A26 빈 재시도 | 실패 gate ID가 manifest에서 사라지면 retry0개/exit0으로 끝난다(실패 배치는 보존). | QR02. 해석하지 못한 ID를 명시하고 nonzero 종료. |
| A27 버전 문법 | bump/CI가 허용하는 canonical v59를 필수 record-fix가 거부한다. | [WTO01](./REMAINING-WORKSPACE-TOOLS.md). 공통 canonical 문법과 major-only 양성 대조. 현재 v58.62 실패라는 주장은 아님. |

CONSIDER로 남긴 항목: 시총 오름차순의 # 의미, 휴대폰 첫 화면의 차트 배치,1년 차트365일 문턱, regex gate의 literal/alias/multiline 범위, stale 문서의 개수 예산과 경로 집합 차이, 작은 SEC 크기 여유. 실제 caller/주기 확인이 끝나지 않은 후보는 actionable로 합산하지 않았다.

## 최신 코드에서 주 담당자가 재실행한 반례

1. **HWM→HPE 공시 오연결.** `js/aio-core.js`의 CIK_MAP은 HWM을 HPE의 CIK0001645590으로 보낸다. 실제 함수에 HPE 응답을 주면 ticker HWM/available true로 반환하며, 실제 chat consumer는 HPE 공시를 인용하라는 문장으로 넘긴다. [고정 최신 SHA 실행 결과](./legacy-core-hwm-repro.json). Howmet의 공식 CIK는0000004281이고,0001645590은 Hewlett Packard Enterprise다([Howmet SEC 공시](https://www.sec.gov/Archives/edgar/data/4281/000000428126000025/0000004281-26-000025-index.htm), [HPE SEC 공시](https://www.sec.gov/Archives/edgar/data/1645590/000164559026000072/0001645590-26-000072-index.htm)). 합성 공시 응답 fixture이며 실제 AI 답변은 호출하지 않았다. 최소 보완은 정본 issuer registry 사용과 응답 CIK/등록 ticker 검증이다. 매핑 한 줄만 바꾸면 같은 클래스의 재발은 막지 못한다.
2. **공유 시장 모델 금리 결측 예외와 방향 설명.** 날짜가 뒤처진 금리 이력에서 null.yearPosition 예외가 남는다. 실질금리 -20bp와 +20bp의 원인 설명도 같은 ‘상승 부담 지속’이다. [실제 최신 모듈·반대 부호 대조](./market-reading-result.json). 실제 배포 발생 빈도는 측정하지 않았다.
3. **KST 오전 실적 일정 오배치.** 08:00 KST에서 월19 실적이 화20 열에 들어가고 금23 실적이 사라진다. 09:00 대조군은 정상이다. [고정 최신 실제 renderer 실행](./legacy-latest-repro.json). UTC 비교 날짜와 로컬 열 제목을 같은 날짜-only 계약으로 맞춰야 한다.
4. **한국 시세 미수신 상세의 가짜0/진단.** 미수신을 +0.00% 및 ‘하락0개가 상승0개보다 많다’로 바꾼다. 위 legacy 결과에 재현했다. v58.50 실제 브라우저 증거는 별도20폴더에 있으며 최신 브라우저 발생으로 승격하지 않는다.
5. **QA cache 의존 누락.** 현행 data-continuity gate에서 price-factors 의존 소스만 바꿔도 fingerprint는 같다. gate 본문을 바꾼 양성 대조는 달라진다. [최신 runner의 실제 함수 실행](./cache-identity-result.json). CI no-cache 결과나 전체20개 gate의 실제 오판 발생을 의미하지 않는다.

## 구조·실측

최신 구문 분석은 JS/MJS792개 오류0, 알려진 ESM bootstrap 연결392개다. 이것은 전문 의미 검토 완료 수가 아니다. [구조 분석](./structural-analysis.json).

처음으로 현 환경에서 lockfile의 esbuild를 사용할 수 있어 `node scripts/ci-boot-bundle-budget-check.mjs`를 실행했다. **PASS: 정적 boot42개 출력, minified raw1,496,044 bytes, gzip544,662 bytes**(예산1,500,000/548,000). 이는 ESM boot 출력의 크기이며 classic scripts·CSS·HTML·데이터를 합친 전체 초기 다운로드 또는 실제 paint 시간은 아니다. 예산 여유가 작다는 사실만으로 앱이 느리다고 판단하지 않는다. 사용자에게 실제 보이는 첫 화면과 브라우저 네트워크/수명주기 측정은 구별한다.

## 정책·기준의 의미 검토

사용자 가치 우선 지시를 적용한다. 기존 결정·게이트는 소유자와 이전 에이전트의 작업물이며 정답으로 가정하지 않는다. 규칙이 필요한 동작을 막으면 목적과 현재 근거를 먼저 재검토한다. 단지 ‘기존 데이터가 없다’는 이유로 기능을 없애자는 결론은 내리지 않고 무료 공식 자료의 수집 가능성을 먼저 확인한다. 비밀·공유 예산·지어낸 값 금지·ticker 추정 금지·매매 지시 금지는 보호장치로 유지한다.

[v58.52 해석 검토](../20261021/INTERPRETATION.md)의 핵심은 관측→관례→비용 가설→실증의 층위를 지키는 것이다. 같은 유가 분기 서술을 복제한 것만으로 집계 선택이 보유 유지에서 관망으로 바뀐다. 이는 분기 개수가 최소 기대비용을 증명하지 못함을 보여 준다. 일반적 조건부 선택지는 유지할 수 있으며, ‘비용이 작은 쪽’이라는 해석 강도를 집계가 실제 말해 주는 범위로 줄이는 대안이 가장 작다.

이익수익률−실질 국채금리의 ERP 수식 자체는 오류로 판정하지 않았다. Fed도 유사한 값을 대략적인 위험보상 proxy로 사용한다([Fed Asset Valuations](https://www.federalreserve.gov/publications/may-2021-asset-valuations.htm)). 실제 초과수익 보장과 관측 대용지표를 구별하는 설명은 보완할 만하다.

## 검토 범위와 진행 상태

현재 원장은 [coverage.json](./coverage.json), [파일별 읽기 원장](./reading-ledger.tsv)이다. 같은 SHA의 과거 전문 검토 재사용, 기준 전문+전체 변경 검토, 이번 전문, 부분/미독을 구별한다. 독립성은 동일 모델의 새 맥락 검토이므로 limited다.

완료한 담당 범위: [legacy core 전문](./LEGACY-CORE.md), [UI/pages/knowledge 변경과4개 카드 전문](./UI-DELTA.md), [domain·producer 변경](./DOMAIN-DELTA.md), [시장/종목 domain 전문 보완](./domain-complete.md), [CI/규칙 도구5개 전문](./tooling-review.md), [root UI컴포넌트2개 전문](./ROOT-FOLLOWUP.md). core100만자 검토는 과거 연속 prefix+전체diff+동일 구간 대조+새 후반 읽기의 합성 근거이며 이번에 처음부터 모두 재독했다는 뜻은 아니다.

원장 자체의 독립 대조에서 근거 없는 FULL 승격7개를 바로잡았다. 그중2개는 실제 전문을 추가 읽어 보완했고5개는 변경분 검토로 남겼다. [감사 원장 검토](./audit-ledger-review.md). source/receipt SHA 불일치0이며, 새 checkout 차이는 별도로 기록한다.

이번 계속 작업에서53개 파일을 실제 전문으로 추가 읽었다. 그중 이미 전문 계승 상태였던1개를 제외해 미완료52개를 해소했다. [chat6183줄](./REMAINING-CHAT.md), [공통UI4382줄](./REMAINING-UI.md), [workflow13개](./REMAINING-WORKFLOWS.md), [workspace도구6개·helper4개](./REMAINING-WORKSPACE-TOOLS.md), [QA runner·behavior2개](./REMAINING-QA-RUNNER.md), [지식·운영 도구26개](./REMAINING-GOVERNANCE.md)를 보완했다. root가 새 probe5묶음을 직접 다시 실행했고 root의 governance3반례는 다른 두 검토자가 독립 대조했다. 독립성은 같은 모델의 별도 맥락 수준이다. [현재 소스 대조](./remaining-target-current-identity.json)에서도53개 모두 같은 SHA였다(2026-10-21T14:03Z). 이 관측은 다른 최신 변경 파일이나 전체v58.62를 인증하지 않는다.

남은432개에는 다수 CI/도구, 전체 HTML/CSS 의미 검토와 일부 변경 파일이 포함된다. 기존52의 UI·금융·해석·producer와 이전 날짜별 상세 자료도 범위·SHA를 따라 보존한다. 같은 SHA의 정적 읽기가 모든 상태 실행/브라우저 성공을 뜻하지 않는다.

실브라우저는 v58.59 실제 Pages의 주 메뉴8개 경로, LDOS 실제 DCF, 데스크톱 inspector 전환, 키보드 검색, 휴대폰과 태블릿 배치 일부를 새로 확인했다. 태블릿 Enter→dialog→Escape→원래 행 focus 복원도 확인했다. [브라우저 상세와 한계](./BROWSER.md). 이전 v58.50/52의18route 등은 그 날짜의 별도 증거다. 실제 기기 전수·모든 오류 상태·전체 접근성 인증은 아니다.

## 최신 변경과 검증 마감

[v58.60 추가 차이와 격리 실행](./LATEST-DELTA-v5860.md)을 읽는다. 최신 고정 data.json의 marketAnalysis는 verified이므로 과거 blocked를 현재 상태로 계속 보고하지 않는다. projection/provider의 날짜 복원과 prompt label 정규화는 직접 실행했다. 이후 병행 작업의 미커밋 변경은 workingTreeDrift에 별도로 남기며 자동 검토 완료로 세지 않는다.

계속 작업 중 작업 트리 버전은v58.61→58.62로 바뀌었지만 HEAD는v58.60이다. 뉴스 슬롯/한국 좌석/매체 우선순위와 SMH·선물·아시아 evidence 연결 등 선택4개 파일의 현재 변경분을 따로 읽고 SHA를 [작업 트리 delta](./remaining-working-delta.json)에 기록했다. 이 검토를 v58.62 전체 제품 또는 새 producer/배포 인증으로 세지 않는다. 이번에는 실브라우저를 새로 구동하지 않았고 위 v58.59 증거를 보존했다.

감사 산출물의 구문/선택된 preflight 결과와 정확한 명령은 [검증 마감](./VALIDATION.md)에 정리한다. 이것은 전체 제품 QA·배포 인증이 아니다. 제품·운영 데이터 수정이나 commit/push/deploy를 이 감사가 수행하지 않았다. 확인된 제품 결함은 해결 제안으로 남아 있다.

선택된 preflight는 최초13통과/1실패 후 실패1개만 workspace 임시 경로에서 재실행해 통과했다. 최초 실패도 기록에 남겼다. 감사 helper 구문30개와 이후 추가 helper의 별도 검사, 문서 링크/줄바꿈 점검은 산출물 검증이며 발견한 제품 결함이 해결됐다는 뜻은 아니다.

이번 계속 작업의 신규 마감은 감사 소유38개 경로만 명시해 affected --no-cache를 실행했고 preflight14 PASS/0FAIL/0SKIP이었다. 이전 최초 실패 기록을 덮어쓰지 않고 [별도 실행 결과](./remaining-closeout.json)와 로그에 보존했다. 제품 결함13건은 여전히 수정 제안이며, 반례 재현 probe의 성공을 제품 정상 PASS로 표시하지 않는다.

마지막 독립 대조에서 새6개 TSV53고유 경로의 고정blob/inventory/원장 SHA 일치,850행 중복0, 이전353→현재405의 순증52와 새 발견13건의 증거 경계를 확인했다. 이 대조는 각 담당자의 실제 완독 과정을 다시 인증한 것이 아니라 receipt와 소스·통합 주장 간의 정합성 확인이다. 산출물 helper41개 구문 오류0, 로컬 Markdown 링크 누락0, 고정 SHA 불일치0이었다.
