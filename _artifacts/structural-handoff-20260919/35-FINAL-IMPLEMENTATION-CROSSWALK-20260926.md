# 핸드오프 00–34 구현 교차점검 — 2026-09-26

**현행성:** 2026-09-27 로컬 v56.54·공개 Pages v56.33·원격 refresh 실패와 새 코드 보강은 [36 라이브/원격 재대조](36-LIVE-REMOTE-RECONCILIATION-20260927.md)에 기록했다. 아래 130 PASS는 v56.53 당시의 로컬 자동 검사다. **v56.55 배치(P1278~P1282)**는 00 행의 E0 원자 전환 커밋 계약과 11/E0 P-A·P-C·P-D·P-E reader 행을 로컬에서 닫았다(S-D·E3 배분 정책은 이미 닫혀 있음을 확인·기록) — 표의 각 행에 반영되지 않은 과거 잔여 문장은 이 문장을 우선한다.

기준: 코드 `cd4d8ca7`에서 시작해 로컬 v56.53 작업 트리까지 확인했다. 문서의 설계·과거 로컬 실행·현재 체크인 산출물·브라우저·실배포는 다른 증거다. 이 표의 `코드 반영`은 해당 목적의 일부 또는 명시 범위 구현을 뜻하며, 패키지 전체의 금융 정확도·사용성·원격 출시는 뜻하지 않는다. 현재 작업은 미커밋이고 이 문서 작성 중 원격 배포는 하지 않았다.

## 문서별 대조

| 문서 | 현재 코드/계약에서 확인한 범위 | 남은 인수·주의 |
|---|---|---|
| 00 핵심 구조 | 라우트 20개와 native lifecycle/renderer/data owner가 레지스트리에 있고 일부 중복 writer가 퇴역했다. 같은 라우트 `viewState` 커밋과 mount 실패 롤백의 커밋 계약은 v56.55 P1278·P1279로 닫혔다(esm fixture 고정). | 잔여는 생산자·소비자 끝단이다 — viewState를 실제 전송하는 수직 왕복(QA-E0-VIEWSTATE-PRODUCER)과 효과 선행 순서의 완전 역전(QA-E0-SHELL-EFFECT-ORDER, chart native 회수 선행)은 열림. |
| 01 화면 정합 | null/0·sentiment/home의 특정 반증을 P1143/P1164가 차단했다. | UI·AI·저장 sink를 같은 입력/시간으로 대조하고 전환 브라우저 흐름을 확인해야 한다. |
| 02 포트폴리오 상태 | cash-only·평가 상태의 특정 반증이 차단됐다. | 가격 실패·잠금·복원·실제 저장/통화 전체 수명주기는 미인수. |
| 03 데이터 계약 | tier coverage·metricId·valueKind·시간/출처 전달의 일부는 P1145/P1178/P1183 등으로 보강됐다. | 행별 sourceKind/권리 allowlist, 실제 발행 loader→UI/freshness 끝단은 열림. |
| 04 콘텐츠 의미 | C01/C02의 일부 과거 반증 차단. | manager 전체와 preview의 분모, 직접 원문 의미 검수는 미완. |
| 05 AI 근거 | P1244가 분류/응답 감사를, P1245가 요청별 citation/tool 오류 소유권을 분리했다. | A01–A04, 실공급자 겹친 요청·역순·취소 trace, 자유문장 entailment는 열림. |
| 06 운영/검증 | P1242 schedule-only SLO·P1256 도메인 receipt·P1265 QA run/candidate identity 구현. | 30일 원격 window, SW 세대·산출물→소비자, 실제 live 도달은 별도. |
| 07 스크리너 모델 | math/identity/preview fixture 확대; E2 S-C/S-E/S-F는 P1238–P1241에서 코드/fixture 경계를 구현했다. | 6 preset 양성·음성, frozen run의 같은 데이터 컷 사용자 브라우저 인수와 성능 독립 검토 필요. |
| 08 시장 점수/곡선 | null·2s10s 단위/같은 컷 오류의 특정 경계 차단; v56.53 테마 breadth50 부족 시 국면 보류. | 시장 health/FX/carry의 행동 라벨·예측력·원천 관측 인수는 별도. |
| 09 SEC PIT/뉴스 | 시간·operand·lineage 일부 반증 차단; v56.53 뉴스 요약 단일 owner와 본문 적격성/피드 주제 구분. | restatement, PIT universe, 뉴스 원문 entailment와 SEC 원행 값 대사는 열림. |
| 10 기술/테마 | P1249/P1250/P1253 패턴/SKEW/차트 모델 구분, P1257/60 숨김·퇴역 정리, P1267 과도한 섹터 prose 축소. | 기업행동·4h/1d·RRG 현재성·성능 독립 연구 및 실제 사용자 화면 인수. |
| 11 포트폴리오 저장/통화 | P1187–96/1246–47/1259 FX 코드 경로와 기준 통화 수익률 구현; P1262 로컬 producer 실측. | **현재 체크인** history 420행 중 `usdkrw` 0행, data `providerCrossChecks.fx` 없음. 최신 data commit `fc75c775`(01:35Z)이 FX producer 포함 코드 `cd4d8ca7`(05:31Z)보다 앞선다. 정식 refresh→발행→화면은 미인수. |
| 12 사용자 추론 화면 | preview/execute/rank/Why fixture와 UI 설명 보강. | 20 라우트 공통 의미·보류/재진입/저장/replay를 실제 사용자 과업으로 재확인해야 한다. |
| 13 의미 구조/학습 | 공통 result·learning의 목표 계약은 문서화됐다. | UI·차트·AI·학습의 같은 result identity와 이해도 시험은 설계 단계. |
| 14 기술 전략 | 캔들/주봉/VCP 모델명과 관측·행동 문구의 일부 정직성 보강. | 전략 유효성·수익/비용·표본 밖 성능은 독립 연구 전까지 주장 불가. |
| 15 종목/관측 시간 | P1179/P1184로 producer→reader 시간·basis 판정 일부 보강. | MIC/ADR/corporate actions, 부분 세션, availableAt·PIT 실데이터/UI 인수. |
| 16 제품 우선 데이터 | 목적·데이터/제공자/비용/권리 선택 framework. | 사용자 지연·비용·권리/과업 실증 미측정. |
| 17 자동화/전달 | O04 P1242·O06 P1256 구현; P1270 producer 후보 hash→promotion→staged/commit 결속 로컬 추가. | O07 exact source SHA→manifest→실제 consumer, 원격 도착률/CI 시간/배포 수렴은 미인수. |
| 18 검색→검증 | candidate→verification→publication 구조 설계. | 검색 문서를 정형 수치로 승격하는 수직 경로와 권리/원전 대사는 미구현. |
| 19 결정/이행 | 선택·롤백 원칙의 설계 기록. | 목적·권리·storage/publication 선택의 실제 사용/운영 검증 필요. |
| 20 범위/인수 | 20 라우트와 라우트 밖 범위를 열거한다. | 완료율 또는 콘텐츠 전수 인증표가 아니다. |
| 21 라이브/로컬 의미 | v56.01 당시 B01–04 브라우저 증거, P1164/65 일부 후속 차단. | 현 SHA의 screen·AI·storage sink 재 trace 필요. |
| 22 성과/위험 | P1182/88/90/91/1200/1203/1258 계산·입력·위험 일부 구현. | 계좌 수명주기, 위험 설명, 사용자 인수는 별도. |
| 23 배분 기준 | 명시 0/null/exclude·start basis 등 합성 계약 구현. | 저장·헤더 기준·실제 화면/라이브 인수는 열림. |
| 24 독립 재검토 | v56.15의 R24-01~08 발견 원문. | 현재 상태 정본은 후속 P와 이 문서; 과거 발견을 현 결함으로 자동 승격 금지. |
| 25 발견 상태 | v56.49까지 누적 부분 갱신. | E2·FX/테마/용어집 옛 OPEN 표기를 이 문서와 P1260~71로 정정했다. 각 역사 행은 보존한다. |
| 26 실행·인수 | E0–E7 작업 카드와 삭제/통합 조건은 유효. | v56.23/32 재개 목록은 이력이다. E6 A01–04, E7 C1–C7와 수직 사용자 과업은 열림. |
| 27 코드/라이브 의미 | v56.23까지 20 라우트 표본/LC01–16. | 현재 배포·데이터 컷에서 다시 실행해야 한다. |
| 28 페이지별 사용자 감사 | v56.33 화면/본문/좁은 폭 감사. | 전 사용자 과업·원문/금융 숫자·접근성/모바일 인증은 아니다. |
| 29 2차 콘텐츠 | LC54–73 일부는 P1248–55·P1257/59 등으로 수정. | 전 preset/원문/데이터 컷/수익 성능의 나머지는 열림. |
| 30 Atlas/Guide/포트폴리오 | Guide 점수 5구간 문구를 v56.53에서 정합, 테마 퇴역 P1260. | Atlas 층별 placement 이동/직접 출처, PIN 저장 복구, 320/768/a11y는 미인수. |
| 31 Principles/Masters | P1261 용어집 수치 출처 레지스트리/문구 검수. | Principles 원고 112개 원전·8경로, Masters SEC amount/unit oracle·기관 행 대사 열림. |
| 32 외부 자료/차트/뉴스 | 링크·이미지의 설계 요소 분류와 위험 경계. | X 일부 원문/전체 스레드 불가; 그림을 금융 정답 데이터로 쓰지 않는다. E6-C5 실제 원전·권리·AI E2E 열림. |
| 33 새 SHA 20 라우트 | `v56.33` 두 SHA에서 대표 방문·LC91–95 기록. | QQQ/순위/뉴스/SEC/RRG를 동일 새 SHA·데이터 컷으로 재인수해야 한다. |
| 34 QA 효율 | P1265가 런 identity/후보 결속/중복 등록을 구현, P1270이 refresh 반복 promotion 검사를 후보 동일성으로 교체했다. | CI 시작 비용 p50/p95·원격 실패율/절감률(P1-5), 20분 수렴 지표(P2-6) 미측정. |

## 문서/환경의 실제 경계

### 로컬 검증 기록

- 첫 v56.52 `full --no-cache`는 106 PASS/1 FAIL/23 SKIP이었다. 유일한 `data-plane` 실패는 P1266 fixture가 실네트워크를 호출한 오류였고 단독 재실행으로 차단했다. 당시 브라우저 SKIP을 통과로 세지 않는다.
- v56.53 `affected --session final-structural-rebased-20260926`는 작업 파일을 선택해 core/data/knowledge/workspace/cloudflare와 로컬 브라우저를 실행했다. `decomposition`·`domain-parity`·`reconciliation` 실패는 각각 공식 ratchet 갱신·뉴스 헤드라인 의도적 보류 계약·reconciliation producer 재생성 후 `rerun-failed` 3/3 PASS로 닫았다.
- 이어진 브라우저 배치는 architecture/atlas/principles/masters/vertical/learning/SA02~04/screener 갱신 등은 PASS였다. 실패 9건 중 7건은 제한된 실행의 저장소 내부 보고서/스크린샷 쓰기 `EPERM`, 2건은 옛 headless assertion(T785/T1016)과 숨김 file input의 뷰포트 오탐이었다. 수리 후 승인된 로컬 실행에서 **정확한 실패 배치 9/9 PASS**. 20라우트×desktop 3폭 60 조합은 overflow 0/JS errors 0이다. 별도 실제 사용자 테스트와 원격 live 인증으로 승격하지 않는다.
- `ci-qa-pipeline-contract`, candidate self-test, `ci-operations-status`, `ci-version`, `ci-reconciliation`, `ci-domain-parity`, `ci-decomp-hotspot`, 문법 412파일과 headless skip-list 밖 실패 0을 확인했다. 정식 원격 CI·배포 결과는 아직 없다.
- 이후 현재 로컬 v56.53 트리에서 `qa-runner full --no-cache`를 다시 완주했다: **130 PASS / 0 FAIL / 0 SKIP / 0 cached**(2026-09-26T09:36:12Z 시작, 191.3초). 정적·데이터·지식·작업공간·Worker 계약과 headless, 실제 로컬 Chromium의 20라우트 구조/사용자 경로/soak/뷰포트/접근성 감사가 모두 실행됐다. 첫 전수 시도에서 `aio-tests.js` +10행 decomp 래칫이 멈춘 것은 T785/T1016 회귀 관찰 증가를 P1267에 기록하고 공식 갱신한 뒤 `rerun-failed` PASS, 이어진 이 전수 실행으로 닫았다. 로컬 자동 검사의 PASS는 사람의 콘텐츠 이해도나 현재 원격 배포의 PASS를 뜻하지 않는다.

- README·25·26·E0 map·FUNCTION-REVIEW에는 후속 P 구현 이전의 큐가 남아 있다. 이 문서는 상태 색인이고 원 설계/재현은 각 문서에 보존한다. README/25/26/34의 상단 현행성 안내를 갱신했다.
- 로컬 v56.53 작업 트리는 아직 커밋되지 않았다. 2026-09-26 새 Chrome 탭에서 공개 Pages `#home`을 직접 재확인했고 화면 제목·본문 모두 `v56.33`이었다. 공개 `/deployment.json`의 `sourceSha`는 `fc75c775467001af6c1781cfc150c286b5a14806`, `appRevision`은 `v56.33`, `deployedAt`은 `2026-09-26T01:41:02.613Z`다. 즉 지금 로컬 변경의 실배포 증거는 없다. 라이브 홈은 필수 점수 입력 부족으로 판정을 보류했고, 뉴스 하이라이트에는 헤드라인 기준 요약이 남아 있어 로컬 P1268의 본문 적격성 보류가 아직 배포되지 않았음을 보여준다. 이 방문은 홈 한 화면과 배포 메타데이터의 표본이며 현 버전 20라우트 전수·AI·저장·모바일 인증은 아니다.
- 로컬에서 `public-data/operations-status.json`은 durable 16/16과 그 산출 시각 기준 freshness를 기록하지만 전체 `OPERATOR_REQUIRED`; browser plane `UNKNOWN`. fast quote의 공개 설정은 권리 검토 false/soak 0/7로 비활성이며 P1271 후 기능 가용성은 `UNAVAILABLE`이다. FRED 성공 branch는 최신 체크인 data.json의 true/true/true로 갱신됐으나 운영자 권리·live는 별도다.
- 체크인 reconciliation은 `PARTIAL`이며 `commodities-fx`의 spot/settlement basis와 FX 이력/공식 대조가 닫히지 않았다. public beta readiness는 route soak, 현 revision boot 성능, 수동 접근성, 30일 SLO, live SHA/headers, 제공자 권리 등 때문에 `BLOCKED_UNTIL_OPERATOR_CRITERIA_CLOSE`다.
- 로컬 QA 기본 `.cache/aio-qa` 쓰기는 `EPERM`이 재현돼 `AIO_QA_CACHE_DIR`을 OS 임시 경로로 격리했다. `build-operations-status`의 readiness 원자 쓰기도 제한된 실행에서는 `EPERM`이었으나 승인된 저장소 내부 producer 실행으로 완료했다. 실패 시도는 PASS로 계산하지 않는다.
- QA-AI-A05-STREAM은 실 Anthropic 키/실공급자 trace가 없어 VM/stub 이상 증거가 없고, QA-CRED-02~04·14는 실제 relay·BOK/KOSIS·fast plane/배포 권한이 필요하다. QA-CONTENT-37의 실사용자 이해도는 기계 게이트로 대체할 수 없다. 이 조건들이 닫히기 전 전체 구현/실배포 인증을 선언하지 않는다.
