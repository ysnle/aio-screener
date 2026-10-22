# 고정 셸 전문 감사 — 2026-10-22

MODE: review · VERDICT: PASS+NOTES(현행 delta) · 전문 상태: FULL

신규 확정 발견 **0건**. 기존 **C13**의 차트 fallback 결측→0 반례는 고정본과 현행 모두에서 다시 재현했다. A01–A27이나 C13을 신규 발견으로 등록하지 않는다. 이 판정은 전체 제품 정상·접근성 준수·배포 상태의 인증이 아니다.

## 읽기 경계와 재현성

- 기준 REF: `7e2411432f6ca0e5f02528b209b013bf5f7ff2dc`(v58.59).
- `index.html` Git blob: `b98994a205c84bb7a357d301dd965009d032dcd1`.
- 기준 SHA-256: `13e44cc8bf13b6d788b1cdb99504265ada4b2f1b49186e7ea40b36d54542ff22`.
- 현행 v58.62 SHA-256: `60e1d8d885e8b1bfaf632e105c93acb4e43b8c39fa5983136836e226d47f6227`.
- 원문 512,419바이트, LF 7,229개. 마지막 빈 split 행까지 **1–7230**을 읽었다. CSS·HTML 주석·표시 문구·세 classic inline JS를 포함한다. 최초 1–1000 출력의 잘린 364–484는 별도 원문 출력으로 메웠다. 그 외 출력 구간은 잘림 없이 읽었다. `shell-reading.tsv`와 `shell-probe-source-receipt.json`에 연속 구간·해시를 남긴다.
- 현행은 고정본 전문 + **전체 diff**로 대조했다. 바뀐 것은 14줄의 `58.59`→`58.62` 치환뿐이다: 10, 33–39, 7074–7076, 7082, 7133, 7141. 비버전 변경은 0이다. 초기 메시지의 12곳 집계는 이 기계 대조로 14줄로 정정한다.
- caller는 해당 구간만 읽었다. caller의 파일 전체를 전문으로 승격하지 않는다. 읽기 전용으로 기존 dirty 상태·version.json·CURRENT-STATE와 통합 HANDOFF/FINDINGS-HISTORY를 확인했다. QA baseline·producer·build·generate·동기화·버전 변경은 수행하지 않았다.

## 검증된 기존 반례

### C13 — PRE-EXISTING / medium / 기존 발견 지속

위치: `index.html:6961–6967`, `6991–7001`(고정본과 현행 동일).

트리거는 실제 coordinator로 `new Chart()`를 만든 뒤 primary와 secondary script의 error를 순서대로 발생시키는 것이다. `Number(null)`이 0이므로 `[10,null,20]`과 `[10,0,20]`이 완전히 같은 세 점 `(12,80) → (160,142) → (308,18)`으로 그려졌다. `[10,15,20]` 양성 대조는 가운데 점 `(160,80)`으로 달랐다. 별도 경고 문구가 있어도 결측을 실측 0으로 바꾼 차트 의미는 회복되지 않는다.

근거: [실행 helper](./shell-probe-chart.mjs), [VM 관측](./shell-probe-chart-result.json). 고정/현행의 classic inline JS 각 3개가 `vm.Script` 구문 검사를 통과했고, 양쪽 모두 `missingEqualsZero=true`다. canvas·DOM·타이머·외부 script 요청은 stub이다. 실제 네트워크 실패나 브라우저 화면을 측정한 결과로 올리지 않는다.

caller 경계: `js/aio-ui.js:2309–2315`의 재무 시리즈는 누락 필드를 null로 보존하고 `2374–2383`에서 Chart로 전달한다. `js/aio-chat.js:5136–5138`에 호출이 있다. 다만 현행 native 종목 경로에서 이 legacy 분기까지 실제로 도달한 사용자 세션은 이번에 확인하지 않았다. 일반 종목 가격 차트는 `src/ui/pages/entity.js:433`, 일반 포트폴리오 비중 차트는 `src/ui/pages/portfolio.js:659`에서 같은 shell Chart constructor를 소비하지만, 이 두 경로에서 null 입력이 실제로 생긴다는 주장은 하지 않는다. 즉 **라이브러리 반례 지속은 입증**, 일반 사용자 null 입력의 현재 도달성은 미인증이다.

작은 대안은 fallback에서도 null·날짜 간극을 보존하거나, 차트 종류·축·단위를 보존할 수 없는 경우 간이선을 그리지 않고 차트 보류와 기존 수치 근거를 보이는 것이다. 대규모 차트 시스템 교체가 필요한 문제는 아니다.

## 반증·미확정 후보

| 후보 | 실제 대조와 판단 |
|---|---|
| PIN/자체 서버 DIV는 키보드로 열 수 없다 | **DISMISSED**. `index.html:3698,3726`만 보면 role/tabindex가 없으나 `js/aio-core.js:1718–1733`이 data-action을 정규화하고 `1818–1826`이 Enter/Space를 처리한다. `js/aio-ui.js:970–979`의 로컬 처리도 있다. 함수 존재만 보고 실패로 등록하지 않았다. |
| 테마 상세 빈 닫기 버튼은 보이지 않는다 | **DISMISSED**. `index.html:5101,5127`은 비어 있으나 `src/ui/styles/regime-quality.css:341–342`가 `:empty::before`의 ‘닫기’와 44px 폭을 제공한다. 해당 CSS의 실제 로딩·브라우저 픽셀은 별도 검증 범위다. |
| skip-link가 route hash를 main-content로 바꾼다 | **DISMISSED**. `index.html:3586`만으로 결론내리지 않았다. `src/app/bootstrap.js:885–893`이 기본 이동을 막고 main에 tabindex와 focus를 주며, `912–914`는 과거 hash를 정리한다. |
| R:R·장기 백테스트가 일반 화면에서 매매 지시를 제공한다 | **DISMISSED(일반 노출 주장)**. `index.html:5581,5624`는 data-user-fold 없는 advanced details이며 `3096–3121`에서 일반 사용자에게 숨긴다. 개발자 모드 내용의 적절성은 이번 신규 일반 노출 결함으로 세지 않는다. |
| 시스템 자가 진단·공개 사용 상태가 기본 화면을 어지럽힌다 | **DISMISSED(기본 노출 주장)**. `.aio-audit-widget`는 `2727–2728`, 공개 준비 상태는 `2941–2952`에서 개발자 모드에 한정된다. |
| secondary CDN도 응답 이벤트 없이 멈추면 앱의 fallback 종결 시한이 없다 | **NOTED / 정적 한계**. `6956`의 5초 타이머는 secondary 요청만 시작하고, `6947`에는 자체 종결 타이머가 없다. 무이벤트 stub에서 fallback=false/instanceReal=false였다. 실제 브라우저의 네트워크 timeout까지 기다린 결과나 사용자 장애 빈도는 미측정이다. 별도 확정 결함 수에 넣지 않았다. |

## 구조·UI 의미와 리팩토링 경계

셸은 8개 주 메뉴를 정적으로 제공하고(3606–3625), 19개 page host와 안정된 id를 유지한다. 시장 상태·거시·종목 등 핵심 화면은 수신 전 ‘판정 대기’와 ‘—’를 쓰며, 실제 결론은 native renderer가 채운다. 숨긴 market analysis와 action item을 현재 사용자 콘텐츠로 계산하지 않았다(3904,3997). 동적 숫자·날짜·배지를 셸 placeholder만으로 인증하지 않는다.

CSS는 기본 토큰(44–244), 동일 선택자 재정의, dark-theme(2594–2627), 후반 `:root !important`(2788–2822), 일반/개발자 노출 정책(3094–3159)이 겹친다. 중복 자체를 새 결함으로 세지는 않는다. 추후 CSS를 옮길 때 파일만 분리하고 소스 순서를 바꾸면 결과가 달라질 수 있으므로 **토큰 선언과 최종 override를 함께 대조**하는 작은 단위가 적절하다. phone/tablet의 최종 결과는 별도 responsive.css와 ESM 장식까지 포함해 브라우저에서 확인해야 한다.

남은 세 inline JS의 책임은 작고 분리 가능하다. boot status(3551–3583)는 DOM 준비 후 닫히는 배너이며 시장 데이터 완료를 보증하지 않는다. briefing 날짜(4131–4152)는 renderer가 closeDate를 주면 그 날짜를 명명한다. chart coordinator(6890–7067)는 DeferredChart의 동기 constructor 형태·defaults 쓰기·destroy·지연 materialization을 외부 caller에 제공한다. 외부 모듈로 옮길 때는 이 계약과 **defer 순서**를 유지하는 것이 우선이다(33–35,7074–7082). Chart를 단순 Promise API로 바꾸면 기존 동기 caller가 깨질 수 있다.

정적 DOM을 줄이려면 ‘숨김=죽은 코드’로 판정하지 말아야 한다. legacy sink/id, fallback, developer-only 콘텐츠와 공개 user fold는 서로 다른 계약이다. 현재 index 한 파일을 8개 페이지 모듈로 일괄 재작성하는 제안은 하지 않는다. 먼저 chart coordinator 같은 경계가 명확한 조각과 CSS 최종 cascade를 각각 보존하면서 이동하는 편이 가족·친구 5명 규모에 비해 비용이 작다.

## 검사와 한계

실행: `git diff <REF> -- index.html` 전체 읽기, byte SHA-256/고정 blob 기록, 모든 변경줄의 버전 치환 동등성(14줄), 순수 VM inline 구문 3/3×2, C13 결측/0/유효값 대조. 초기 hash 수집의 git maxBuffer 초과는 4MB 한도로 재실행해 해소했다. 이 실패를 제품 결함으로 세지 않는다.

미실행: 실제 desktop/phone/tablet 브라우저, 스크린리더, CDN/network, 실제 AI·외부 전송, producer와 제품 gate. 반응형·접근성의 정적 계약을 읽었지만 통과 인증은 하지 않는다. cstack review/rubric을 적용했으며 이 셸 분담의 독립성은 **limited(단일 에이전트)**다. root의 재검토를 대체하지 않는다.

제품 파일 수정·버전 변경·Git 상태 변경·commit/push/deploy는 없었다. 작성물은 이 보고서, 읽기 원장, shell-probe-*뿐이다.
