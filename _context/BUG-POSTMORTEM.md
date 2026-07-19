---
verified_by: agent (Fable 5)
last_verified: 2026-07-19
confidence: high
latest_version: v53.13
latest_P_number: P734
next_P_number: P735
total_entries: 508 (P1~P733, 결번 존재 — 상세 27건 + 압축 원장)
# 2026-07-18 통합/압축: P703 이하 전 엔트리를 압축 원장(한 줄)·시대 블록으로 축약. 각 엔트리의 원문 전문(motivation/root_cause/fix/prevention/verification)은 git 히스토리(이 파일의 2026-07-18 이전 리비전)에서 열람.
# P725 = v53.7 KR 5페이지 통합(기능 작업, CHANGELOG 기록 — 버그 아님). P617~P619/P650/P670/P710/P723 등 일부 번호는 결번 또는 비버그 작업.
---

## 문서 관리 원칙

- **P번호 단조 증가** — `next_P_number`부터 사용, 재사용 금지. 기능 작업은 CHANGELOG에만 기록(버그 아님).
- **필수 필드**: motivation / symptom·reproduction / root_cause / fix / violated_rule / prevention / verification.
- **3회 반복 클래스는 RULES.md 승격** (R25). 아래 "반복 버그 클래스" 표에서 재발 횟수를 추적한다.
- **압축 원장 항목의 상세**: git 히스토리 참조 (`git log --oneline -- _context/BUG-POSTMORTEM.md` → 2026-07-18 이전 리비전).
- 코드 확인 없이 추측으로 원인을 단정하지 않는다. "고쳤다" 선언은 브라우저/게이트 증거가 있어야 한다.

## 반복 버그 클래스 (재발 추적 — R25 승격 원장)

| 클래스 | 대표 P | 상태/게이트 |
|--------|--------|------------|
| 이중 표면·그림자 구현 드리프트 (동일 판정의 중복 구현 중 한쪽만 수정) | P276 P492 P605 P606 P625 P713 P719 | ci-structural(그림자 선언), "동일 지표 소비 표면 grep 전수" 원칙 |
| 생산자-소비자 파이프 단절 (인프라·필드만 만들고 소비 경로 미연결) | P239 P548 P652 P664 P721 P724 | "읽기 코드 존재≠필드 존재 — 쓰기 지점 grep 실증" 원칙 |
| 관측 시점 리터럴 부패 (달력 회전·시장값 회전·데이터 상태 영구 단언) | P604 P627 P713(T884) P715('1,508') P720('5/5') P722 | R279 계열. `grep "=== '20"` 스윕, 감사 토큰에 비숫자 컨텍스트 의무 |
| fail-closed 위반 (결측·정적·합성값의 현재 판정 승격) | P635 P649 P706 P712 P713 P717 P718 | R340~R342, ci-static-data-contract 22카테고리 |
| 매매 지시·과신 라벨 발화 (정적 UI 포함) | P490 P512 P535 P714 P720 | P714 관측형 전환 + 지시 문형 grep |
| HYG 달러 가격 임계로 신용 판정 | P576 P713 P714 P726(5표면 전부 해소) | **R343 승격 완료** — `grep -E "hyg\s*[<>]"` QA §0/§4 상시 편입 |
| silent fail (실패를 삼키고 정상처럼 보임) | P352 P410 P415 P523 P546 P565 P707 | 실패 상태 명시 렌더 + lineage 게이트 |
| XSS/이스케이프 누락 | P433~P438 P558 P566 P567 | escHtml/safeHtml 스윕, runtime contract |
| 일괄 치환·스윕 부작용 (sed/이모지 제거가 코드 파괴) | PR-P135 P678 P680 | R309 — 스윕 후 빈 버튼·양쪽-빈 삼항 전수 검색 |
| init 가드·cleanup 라이프사이클 | P56 P484 P568 | QA 3B 단계, 타이머 레지스트리 |
| 인코딩/mojibake 파손 | P507계열 P583 P596 P660 | ci-control-char-check (baseline) |
| 테스트가 artifact 내용에 의존 (데이터 상태 바뀌면 CI RED) | P648 P677 P709 P720 P722 | "가용/불가용 양쪽 분기 검증" 원칙, push 전 이중 artifact 실행 |
| 자기평가 오류 ("이미 됐다" 무검증 주장) | P631 P687 P688 | "기존 확인 기록 재검증 없이 신뢰 금지" (memory/feedback) |

## 2026-07-18 전수 재검증 (통합 시점 스냅샷)

이 문서 통합 시점에 라이브 코드(v53.7, main aa696df + 최신 데이터 커밋) 기준으로 전체 게이트와 대표 재발 패턴을 재실행했다.

**게이트 (전부 PASS)**: 정적 15종(control-char·worker-anthropic·version·release-revision·data-lineage·static-data·structural·ux-default-path·runtime·data-pipeline·semantic·workflow-compaction·skill·doc-currency·knowledge-lint) · JS 문법 6모듈 · 헤드리스 1101/1101 · boot budget(route 1149ms) · critical10 10/10(consoleErrors 0) · a11y 17/17 · viewport FULL_INIT 68/68(overflow 0px·jsErrors 0) · portfolio vault E2E.
- data-lineage 최초 FAIL(data.json 13.99h)은 로컬 체크아웃이 낡았던 것 — pull 후 PASS(WARN 1건 = SEC 커버리지 91/655, 기존 외부 조건). 원격 refresh-data 크론은 매시 정상.
- data-pipeline 최초 FAIL(screener-universe drift)은 Windows CRLF 아티팩트 — 내용 diff 0, LF 재생성 후 PASS.

**표본 재발 검사 (PASS)**: 매매지시 문형 0건(안전 픽스처 제외) · `.pct||0` 0건 · alert() 0건 · SRI 3건 · T859 NFP 금요일 앵커 PASS · null-score `typeof==='number'&&isFinite` 가드 존재 · P719 `toPublicPayload`+read-back 존재 · P724 52주 필드 보존 존재 · P721 `hydrateRRGDailyHistory` 존재 · P713 `_vkospiLiveOk` 게이트 존재.

**잔존 발견 (미수정 — QA-CHECKLIST 열린 항목으로 이관)**:
1. **HYG 달러 임계 신용 판정 3함수 잔존** — `_tempLive`(index.html ~16053/16068: `hyg>88?60:...`, `vix>30&&hyg<78`), `updateRiskMonitor`(~20492: 78/75 밴드 라벨), `generateFxBondCommentary`(~21739: `hyg<75` → "안전자산 피신 권고" **처방형 문구 포함**). P576/P713/P714가 3회 수정한 클래스의 4번째 표면 — P713 스윕이 computeTradingScore/Weinstein/MTF 경로만 커버. R341 승격 및 FRED HY OAS 일원화 필요.
2. **`Number.isFinite(Number(...))` 18곳 잔존** — P715 함정 패턴(`Number(null)===0`). null 선차단·파싱 목적 사용은 안전하나 index.html 14986/14994/16379/26537 등 ~5곳은 null→0 통과 가능성 미분석(개별 판정 필요).
3. **R309 양쪽-빈 삼항 1건** — js/aio-data.js:3503 `(yoy >= 0 ? '' : '')` — 이모지 스윕 잔재, 양수 부호 표기만 소실(cosmetic).

---

# 상세 엔트리 (P704~P728 · v52.89~v53.9)

## P731 - v53.11 - WebSearch inferred-claim validator가 optional range와 camelCase numeric sink를 처리하지 못했다
- **motivation**: AR-06 WebSearch claim contract를 fixture로 실행하면서 검색 결과를 숫자형 current claim으로 승격시키지 않는 경계를 blocking gate로 추가했다.
- **symptom/reproduction**: `range`가 생략된 claim이 `null.min` 접근으로 예외를 냈고, validator의 underscore 중심 정규식이 `currentValue`를 exact numeric field로 차단하지 못했다.
- **root_cause**: 선택 필드 정규화가 `undefined` 기본값만 처리했고, 금지 필드 탐지가 camelCase를 계약 키로 열거하지 않았다.
- **fix**: null-safe range normalizer와 명시적 `value/currentValue/exactValue/numericValue` 금지 키 집합을 추가했다. valid two-source/high-confidence, one-source rejection, numeric sink rejection을 CI fixture로 고정했다.
- **violated_rule**: R347의 inferred claim fail-closed contract.
- **prevention**: optional input은 null과 undefined 양쪽을 fixture로 검증하고, security/claim sink 키는 naming convention 정규식만으로 판정하지 않는다.
- **verification**: `ci-inference-contract-check.mjs`, `ci-architecture-contract-check.mjs`, Chromium architecture browser check PASS.

## P734 - v53.13 - reload 후 Portfolio Vault 잠금 화면과 RSS news backstop이 회귀했다
- **motivation**: v53.12 배포 후 실제 downstream CI에서 보호 데이터 경계와 뉴스 freshness gate를 끝까지 닫는다.
- **symptom/reproduction**: `ci-portfolio-vault-e2e.mjs`의 `PFE2-05 reload_requires_unlock`가 `false`였고, refresh run `29670423595`는 `news=0`을 발행해 후속 CI `29670464804`의 22-category news gate를 실패시켰다.
- **root_cause**: hard reload 뒤 `renderPortfolio()`가 초기 active route에서 재호출되지 않아 `isPortfolioLocked()`는 true여도 lock surface가 `display:none`으로 남았다. RSS fetch는 단일 시도와 `when:2d` provider window에만 의존했다.
- **fix**: active portfolio route의 DOMContentLoaded 초기 렌더를 보강하고, RSS fetch retry와 `when:7d` provider backstop을 추가하되 canonical 08:00 KST cycle filtering을 유지했다.
- **violated_rule**: R350.
- **prevention**: Vault E2E reload gate와 data-pipeline RSS contract를 blocking checks로 유지한다.
- **verification**: local Vault E2E 8/8 PASS, data pipeline contract PASS, `node --check scripts/fetch-data.mjs` PASS. Downstream CI/Pages evidence follows deployment.

## P733 - v53.12 - refresh-data ESM summary에 CommonJS require가 남아 있었다
- **motivation**: P732 이후 workflow heredoc의 실제 실행 경로까지 검증해 자동 data commit 회귀를 닫는다.
- **symptom/reproduction**: refresh run `29668165189`는 quote 78/78 수집 후 `Pipeline status summary`에서 `ReferenceError: require is not defined`로 실패했고, watchdog run `29666589823`는 public-data stale을 보고했다.
- **root_cause**: `refresh-data.yml`가 `node --input-type=module -`로 실행하면서 `const fs = require('fs')`를 사용했다. summary 실패로 data commit 단계가 skip되었다.
- **fix**: `import fs from 'node:fs'`로 교체하고 module heredoc 내부 `require()`를 거부하는 data-pipeline contract gate를 추가했다.
- **violated_rule**: R348/R349.
- **prevention**: local workflow contract/control-character check 후 수동 refresh가 commit step까지 도달하는지 확인한다.
- **verification**: local contract/control-character checks PASS; downstream workflow evidence is recorded after deployment.

## P732 - v53.11 - data-watchdog와 refresh workflow의 ESM heredoc가 CommonJS parser/runtime에 남아 있었다
- **motivation**: AR-07 snapshot/operations/reconciliation checks를 workflow에 추가한 뒤 실제 `ci-data-pipeline-contract-check.mjs`를 실행했다.
- **symptom/reproduction**: `node - <<'NODE'` heredoc 안의 `import fs from 'node:fs'`가 local contract parser에서 `Cannot use import statement outside a module`로 실패했고, GitHub runner에서도 동일한 command shape가 실행될 수 있었다.
- **root_cause**: workflow command와 CI heredoc syntax checker가 module mode를 별도 계약으로 취급하지 않았다.
- **fix**: import를 포함한 refresh/watchdog heredoc를 `node --input-type=module -`로 통일하고, CI checker가 module heredoc를 Node `--check`로 검사하도록 수정했다.
- **violated_rule**: workflow syntax gate는 실제 실행 mode와 같은 parser를 사용해야 한다는 운영 계약.
- **prevention**: 모든 workflow heredoc는 import/top-level await 유무에 맞는 module mode를 명시하고, syntax gate가 command flag를 보존한다.
- **verification**: `ci-control-char-check.mjs`, `ci-data-pipeline-contract-check.mjs`, full `.mjs` syntax sweep PASS.

## P730 - v53.10 - Worker 보안 게이트가 PASS 출력 후 Node 프로세스를 종료하지 않았다
- **motivation**: 전체 CI 게이트를 실제 종료 code까지 확인하는 과정에서 `ci-worker-anthropic-check.mjs`가 성공 문구를 출력한 뒤에도 세션을 유지했다.
- **symptom/reproduction**: `node scripts/ci-worker-anthropic-check.mjs`가 모든 assertion PASS 문구를 출력하지만 process가 자연 종료되지 않아 CI step이 hang될 수 있었다. 외부 provider가 아니라 mock Worker 요청 뒤 남은 undici handle이 원인 후보였다.
- **root_cause**: async `main()` 성공 경로가 결과를 출력한 뒤 명시적으로 종료하지 않았고, 테스트가 만든 비동기/네트워크 리소스의 event-loop 생존을 gate가 보장하지 않았다.
- **fix**: 성공 출력 직후 `process.exit(0)`을 호출해 모든 검증이 await된 뒤 gate가 결정적으로 종료되도록 했다. 실패 경로의 `process.exit(1)`는 유지했다.
- **violated_rule**: CI/QA 실행은 PASS 문구뿐 아니라 종료 code와 종료 시점까지 검증해야 한다는 실행 gate 원칙.
- **prevention**: 모든 standalone CI contract script는 성공·실패 양쪽에서 유한 시간 안에 종료하고, 테스트 후 `exit code 0/1`을 확인한다.
- **verification**: 수정 후 동일 명령을 subprocess로 실행해 PASS 출력과 exit code 0을 확인했으며, 기존 전체 정적/브라우저 gate와 architecture gate는 계속 PASS했다.

## P729 - v53.9 - ESM 호환 observer가 legacy pageShown 이벤트를 수신하지 못했다
- **motivation**: AR-01~06 첫 ESM vertical slice를 실제 legacy shell과 연결하면서 route lifecycle 계약을 Chromium에서 검증했다.
- **symptom/reproduction**: 브라우저에서 새 `AIO_ARCH`는 부팅됐지만 `showPage('sentiment')` 후 `page-sentiment[data-aio-architecture-route]`가 생성되지 않고 `router.active()`가 비어 있었다. 새 observer가 `window`에 이벤트를 듣고, `event.detail`을 객체로만 읽는 상태에서 `document`가 발사한 문자열 detail을 놓쳤다.
- **root_cause**: legacy `_firePageShown()`은 `document.dispatchEvent(new CustomEvent('aio:pageShown', { detail: id }))`를 사용한다. 호환 facade와 lifecycle router가 실제 EventTarget과 payload shape를 계약으로 정규화하지 않아 producer-consumer event boundary가 단절됐다.
- **fix**: `src/legacy/compatibility-facade.js`가 `document`를 event target으로 선택하고, `src/app/router.js`/`src/app/bootstrap.js`가 문자열 또는 객체 detail을 모두 route ID로 정규화하도록 수정했다. `ci-architecture-browser-check.mjs`에 offline 부팅·sentiment mount·home dispose·sentiment 재진입 회귀 여정을 추가했다.
- **violated_rule**: R346(legacy event adapter는 실제 EventTarget과 payload shape를 boundary에서 정규화해야 함).
- **prevention**: 신규 compatibility adapter는 이벤트 emitter 검색(`dispatchEvent`)과 listener target을 함께 확인하고, 실제 `detail` shape를 Chromium fixture에서 검증한다. observer가 실패해도 legacy shell을 소유권자로 유지한다.
- **verification**: Playwright 로컬 서버·외부망 차단에서 `AIO_ARCH` 부팅, 결측 sentiment의 `blocked` 상태, sentiment→home→sentiment route 왕복과 dispose/mount를 확인했고 예상 밖 browser error 0건. 기존 headless 1101/1101 PASS 및 architecture contract PASS.

## P728 - v53.9 - quote batch가 종목마다 전역 DOM을 스캔하고 퇴역 KR 표가 네트워크 fanout을 남겼다
- **motivation**: 1차가 fxbond 고아 경로에 한정됐음을 명확히 한 뒤, 2차로 전체 부팅·DOM·이벤트·데이터 갱신 경로를 다시 계측했다.
- **symptom/reproduction**: `applyLiveQuotes()`는 각 quote의 `PriceStore.set()`마다 7,843-node 문서에서 lineage selector를 전수 조회한 뒤, per-symbol price/chg 반영, 전체 price/chg bulk rewrite, `applyLiveDataToDom()` 전체 bind를 연속 실행했다. 또한 v53.7 KR 전용 페이지 삭제 후에도 `fetchKrDynamicData()`가 더 이상 존재하지 않는 투자자 TOP10 표를 위해 최대 24개 Naver 종목 요청을 실행했다. 구 KR runtime audit은 삭제된 5개 DOM을 missing issue로 보고했다.
- **root_cause**: Store의 단건 안정성 로직과 batch renderer의 책임이 분리되지 않았고, 후속 canonical binder가 추가된 뒤 이전 bulk pass를 제거하지 않았다. KR 페이지 통합은 route·DOM을 제거했지만 공유 loader·audit 소비자 계약까지 수직 정리하지 못했다.
- **fix**: batch 내부 `PriceStore.set()`은 DOM annotation을 defer하고 마지막 `applyLiveDataToDom()` 1회가 공통 DOM·lineage를 소유하게 했다. 중복 bulk rewrite 2개를 삭제하고, 단건 annotation은 symbol-target selector 및 `data-live-field`를 지원하게 했다. 공유 KR loader에서 `fetchKrInvestorTop10()` 호출을 제거하고 runtime audit을 `_krCurrentSupplyEvidence`의 유효성·나이 기반으로 전환했다.
- **violated_rule**: R344의 퇴역 소비자 수직 제거 범위에 scheduler/network fanout과 runtime audit을 끝까지 포함하지 못했고, 고빈도 batch에 canonical DOM owner가 없었다.
- **prevention**: R345와 runtime contract에 batch defer·중복 bulk 부재·target lineage·퇴역 fanout 미호출·evidence audit을 고정했다. headless T383/T863도 삭제된 DOM 계약이 아니라 현재 evidence 계약을 검사한다.
- **verification**: JS 문법, 정적 15종(runtime/structural/doc-currency 포함), `git diff --check`를 통과했다(data-lineage FAIL 0, 기존 SEC 93/655=14.2% WARN 1). 로컬 Chromium은 headless 1101/1101, boot FCP 1556ms·route 1162ms·max long task 611ms, critical10 10/10, accessibility 17/17, FULL_INIT viewport 68/68을 4개 shard로 검증(overflow/tinyText/jsErrors 0), portfolio vault 8/8을 통과했다. 커밋·배포는 수행하지 않았다.

## P727 - v53.8 - 퇴역 fxbond 해설 경로가 무효 DOM 조회와 비등록 timer 폴백을 남겼다
- **motivation**: 성능·품질 우선 리팩터링에서 P726이 부수 발견으로 남긴 fxbond 고아 코드와 QC10 timer lifecycle을 실제 실행 경로 기준으로 닫았다.
- **symptom/reproduction**: `fx-dc-*`/`bond-dc-*` 8개 sink는 HTML에 없는데 `updateFxDynamicComments()`와 `generateFxBondCommentary()`가 fxbond pageShown과 `aio:liveQuotes`마다 실행됐다. pageShown은 첫 함수를 중복 호출해 진입당 무효 DOM 조회 24회, quote 갱신당 16회를 만들었다. `aio-chat.js` 알림 폴링도 registry 부재 시 이름 없는 raw `setInterval`을 생성했다.
- **root_cause**: v52.71 리디자인이 HTML만 `cam-*`/`carry-*`로 교체하고 구 함수·호출·wrapper를 수직 제거하지 않았다. `generateFxBondCommentary()` 안의 살아 있는 두 상태 배지 때문에 함수 전체가 필요한 것처럼 보였고, canonical `updateFxBondPage()`와 legacy wrapper가 병존했다. timer도 core-before-chat 로드 계약이 있는데 불필요한 fallback을 남겼다.
- **fix**: 두 고아 함수와 모든 호출·monkey-patch wrapper를 제거했다. 살아 있는 `fxbond-risk-pill`, `yc-inversion-badge`, `updateCrossAssetMatrix()` 갱신은 `updateFxBondPage()`에 직접 통합했다. 알림 polling은 `_aioRegisterTimer('alerts-check', ...)`만 사용한다.
- **violated_rule**: R341의 퇴역 경로 완전 제거와 QA QC10의 timer registry 원칙을 구현 경로 끝까지 적용하지 못했다.
- **prevention**: R344와 runtime contract에 고아 함수/DOM sink 부재, canonical updater 직접 연결, raw interval 부재를 이진 게이트로 추가했다. UI 교체 시 DOM만이 아니라 선언→호출→wrapper→event hook을 한 번에 grep한다.
- **verification**: JS 6모듈과 변경 MJS 문법, 정적 15종 게이트, 고아 함수·sink·raw interval 0건을 확인했다. 로컬 Chromium은 headless 1101/1101, boot FCP 504ms·route 153ms, critical10 10/10, accessibility 17/17, FULL_INIT viewport 68/68(overflow/tinyText/jsErrors 0), portfolio vault 8/8을 통과했다. 커밋·배포는 수행하지 않았다.

## P726 - v53.7 - HYG 달러 가격 임계 신용 판정이 5번째 표면까지 잔존했고, 그중 하나는 대상 DOM 자체가 없는 고아 코드였다

- **motivation**: 직전 QA 문서 통합 세션에서 열린 항목으로 남겨둔 "HYG 달러 가격 임계 신용 판정 3함수 잔존"(P576/P713/P714 클래스)을 실제로 수정하기 위해 재확인.
- **symptom/reproduction**: 최초 식별된 3곳(`_tempLive`/`computeEconomicTemperature`, `updateRiskMonitor`, `generateFxBondCommentary`) 수정 후 저장소 전체를 `grep -nE "hyg\s*[<>]=?\s*[0-9]{2}"`로 재스윕한 결과 4번째(`js/aio-data.js`의 `_aioRenderCarryUnwindRisk`, 엔캐리 언와인드 리스크 프록시)와 5번째(`js/aio-chat.js`의 fxbond AI 채팅 컨텍스트) 표면을 추가로 발견. 5곳 모두 수정 후 Playwright로 로컬 서버(uncommitted 워킹트리)를 직접 열어 실측한 결과, `generateFxBondCommentary()`가 쓰는 `#bond-dc-credit`/`#bond-dc-implication`/`#bond-dc-curve`/`#bond-dc-10y`/`fx-dc-*` DOM이 index.html 어디에도 존재하지 않음을 확인 — 이 함수와 형제 함수 `updateFxDynamicComments()`는 매 fxbond 페이지 진입·라이브 갱신마다 실행되지만 전부 조용히 no-op이었다.
- **root_cause**: (1) `computeTradingScore`(P576)와 Weinstein/MTF(P713)만 HY OAS로 수정되고, 동일 신용지표를 별도로 재계산하는 4개 함수(경제 온도계·Risk Monitor 위젯+Composite 서브스코어·FX/Bond 해설·엔캐리 프록시)와 AI 채팅 컨텍스트 1곳이 R25 "동일 지표 소비 표면 grep 전수" 원칙 없이 개별 수정되며 누락됨 — 매 회 "3곳 다 고쳤다"는 판단이 반복적으로 틀렸던 이유. (2) `generateFxBondCommentary()`의 대상 DOM은 v52.71 아이보리 컴프 리디자인(index.html:8826 주석 "기존 cam-*/carry-jpy 재사용")이 `bond-dc-*`/`fx-dc-*` 위젯을 `cam-*`/`carry-*` 구조로 완전히 대체하면서 HTML만 교체되고 구 JS 함수·호출부는 제거되지 않은 R341급 고아 코드 — 코드 리딩만으로는 "이중 표면이 라이브에서 어느 쪽이 이기는가"를 실제와 다르게 추론했다(둘 다 dead였음, 실측 전에는 몰랐음).
- **fix**: 5개 표면 전부 `window._hySpreadBp`(FRED HY OAS bp) 단일 소스로 전환, 임계값은 기존 Weinstein/MTF와 동일한 350/450/550bp로 통일. `generateFxBondCommentary()`의 "안전자산 피신 권고" 등 처방형 문구는 관측형으로 전환(P714 원칙). `Risk Monitor`의 `#rm-hyg-bar`는 `((650-oasBp)/400)*100` 역방향 맵으로 재계산(낮은 bp=안정=풀바 유지, 기존 시각 관례 보존). 이 과정에서 발견한 R309 잔재(`js/aio-data.js:3503`, FRED YoY 카드 "+" 부호 소실)와 `Number.isFinite(Number(x))`형 null→0 통과 취약점 18곳(그중 14곳 실버그로 판정)도 같은 세션에서 함께 닫음(각각 별도 root_cause — 상세는 이 항목 하단 병기).
- **violated_rule**: R25(이중/다중 표면 grep 전수 없이 "고쳤다" 선언 — 3회 이상 반복돼 R341 승격 대상), R341(퇴역 UI의 JS 수직 경로 미제거).
- **prevention**: HYG 관련 재발 방지는 QA-CHECKLIST에 `grep -E "hyg\s*[<>]"` 전수 스윕을 상시 항목으로 편입(완료). 코드 리딩만으로 "어느 표면이 라이브에서 이기는가"를 판단하지 않고, DOM 타겟 존재 여부를 실브라우저(Playwright, 외부망 차단+mock 데이터 주입)로 직접 확인하는 절차를 표준화 — 이번 건에서 실제로 오판을 잡아냈다.
- **verification**: JS 문법 6모듈 전체 통과, 정적 게이트 15종 전체 PASS. 로컬 Playwright(uncommitted 워킹트리, 외부망 차단)로 (a) 결측 상태에서 `온도계="—"`/`rm-hyg-status="미수신"`/`carry-hyg-risk="—"` 정상 표시, (b) `window._hySpreadBp=387`(주의 구간) 주입 후 재호출 시 `rm-hyg-status="주의"`·`rm-hyg-bar="65.75%"`(공식 검산 일치)·`temp-score="60"`(내역에 "HY OAS 387bp(50점)" 정상 표기)·`carry-verdict`에 HY OAS 반영 확인, (c) console/page error 0(net::ERR_FAILED는 의도적 외부망 차단에 의한 것). 헤드리스 `AIO.runTests()`는 이번 수정이 유발한 T765(FRED YoY 카드 텍스트 하드코딩 기대값)를 잡아내 함께 수정 — 1101/1101 PASS. 배포·커밋은 사용자 지시 전 미수행.

### 병기 — 같은 세션 부수 수정 (Number.isFinite(Number()) null→0, R309)

- **calcKrHealthScore**(index.html): 함수 3줄 위 자신의 주석("P712/R340: 결측을 0으로 중립화하지 않는다")과 직접 모순 — KOSPI/KOSDAQ pct가 null이면 `Number(null)=0`이 `isFinite` 통과해 "라이브 수신됨"으로 오판정, `kospiPct=0`이 `-1<0` 버킷에 걸려 실제로 -5점을 만들어냈다(가장 심각한 사례).
- **updateWSAnalysis**(js/aio-ui.js): `!Number.isFinite(Number(breadth))` 부정 가드가 null을 통과시켜 "판정 보류" 대신 breadth=0 취급으로 Weinstein Stage 최하단(약세) 판정과 조언 문구를 발화— 자기 자신의 에러 메시지("Stage 판정 보류")를 무력화.
- **fetchYFChart 2s10s 브릿지**(js/aio-data.js:16309): `window._live2Y` null 시 `y2=0`이 되어 `spread10y2y = y10 - 0 = 10년물 그 자체`(예: +430bp)가 스프레드로 오기록될 수 있었음 — 커브 역전 판정을 오염시킬 수 있는 경로.
- **evaluateKrThemeQuoteCoverage**(index.html): `d.pct` null인 종목을 "관측됨"으로 카운트해 커버리지 게이트(0.6/0.7 임계) 자체를 무력화할 수 있었음.
- 나머지 9곳(SR Levels, 사이클 입력 표시, evidence bundle asOf, external-source-state count/expected, breadth advances/declines 등)은 개별적으로 낮거나 중간 심각도 — 상세는 diff 참조. 4곳(`js/aio-core.js:20923`의 `valid()` 헬퍼, `js/aio-tests.js` T683/T241/T187)은 이미 `== null ||` 사전 차단이 있어 안전 — 수정 불필요로 확인 후 유지.
- **prevention**: `Number.isFinite(Number(v))` 단독 사용 금지 — `v != null && Number.isFinite(Number(v))` 또는 `typeof v === 'number' && isFinite(v)`(P715 원칙과 동일 클래스). 검출: `grep -n "Number.isFinite(Number(" index.html js/*.js` 후 인접 `!= null`/`== null` 부재 여부 개별 확인.

## P704~P724 (v52.89~v53.6) — 이하 상세 엔트리

## P724 - v53.6 - Yahoo v7 quote의 52주/거래량 확장 필드를 _liveData에 쓰는 코드가 저장소에 0곳 — 이를 1순위 소스로 읽는 UI가 영구 결측이었다

- **motivation**: P723(ticker 종목 개요 신설) 구현 중 52주 범위 행의 데이터 소스를 `_liveData[sym].fiftyTwoWeekHigh`로 배선하기 전, 이 필드가 실제로 채워지는지 전수 추적(EF-10 "fetch 없는 정적 슬롯" 재발 방지 절차).
- **symptom/reproduction**: `grep fiftyTwoWeek` 전수 — 쓰기는 `_yfBatch` 생성부(aio-data.js)의 로컬 객체뿐, `window._liveData`에 도달하는 경로 없음. fundamental 가격 포지션 카드(aio-ui.js:3021)의 "1순위: _liveData(Yahoo v7/quote)" 읽기는 항상 미스 → 항상 2순위 finnhubMetrics로 폴백(Finnhub 실패 시 카드 공백). 실브라우저 검증에서도 NVDA `_liveData`에 52주 필드 부재 확인.
- **root_cause**: `applyLiveQuotes()`가 시세를 `PriceStore.set()`(price/pct/메타만 저장)으로 넘기고, 확장 필드는 prevClose 2종만 명시 보존(v36.7)했음 — v48.6에서 52주/거래량 필드를 quote에 추가하고 소비자(fundamental 카드)까지 만들었지만 보존 단계를 빠뜨려 "생산-소비 사이 파이프 단절"이 2개월 이상 잠복.
- **fix**: `applyLiveQuotes()`의 기존 prevClose 보존 블록과 동일 패턴으로 7개 확장 필드(52주 고저·당일 고저·거래량·평균거래량 2종)를 수신 시에만 `_liveData`에 복사(합성/폴백 없음). ticker 종목 개요(P723)와 fundamental 카드가 동일 경로를 공유.
- **violated_rule**: R25 계열(인프라 추가 시 소비자까지 경로 연결) — P721(RRG)과 같은 "생산자-소비자 파이프 단절" 클래스.
- **prevention**: 새 UI가 `_liveData`의 비표준 필드를 읽을 때는 그 필드의 쓰기 지점을 grep으로 먼저 실증한다(읽기 코드의 존재는 필드 존재의 증거가 아님 — 본 건이 반례).
- **verification**: 로컬 실브라우저(Playwright)에서 ticker 종목 개요 렌더 + 헤드리스 1101/1101 PASS.

## P722 - v53.5 - v53.3/53.4 신규 테스트 3건이 "데이터 없음"을 영구 불변식으로 단언해 push 시 CI RED를 예약해 두고 있었다

- **motivation**: v53.3~v53.5 push 전 사전 검증 — 리베이스 직후 봇의 최신 data.json(quotes 77, P719 수정 전 producer 산출물) 기준으로 헤드리스를 재실행.
- **symptom/reproduction**: 로컬 artifact(quotes=[])로는 1101/1101 green이던 스위트가 봇 artifact로는 T324/T376/T786 3건 실패. 그대로 push했으면 다음 크론(P719 수정판 발행) 전까지 main CI RED 윈도우 발생 — 사용자가 보고한 "run failed 이메일"을 하루 더 만들 뻔.
- **root_cause**: 세 테스트 모두 quotes=[] 로컬 환경에서 작성되며 "그 환경에서의 관측 상태"(breadth5sma 숫자 존재 / regime available:false / ATH floor null)를 영구 불변식으로 고정 — P720(감사 리터럴 vs 실값)과 대칭인 "테스트 vs artifact 내용" 데이터 의존 클래스. 구현 함수들은 양쪽 상태 모두 올바르게 동작했고 테스트만 틀렸음.
- **fix**: 3건을 형태 불변식으로 재작성 — T324: 스키마 존재+null 또는 유효 0-100, T376: fail-closed 계약 양방향(미수신→판정 필드 null, 수신→유효 레짐+유한 점수), T786: 상수 floor 부재(null 또는 관측 유래 양수)+하드코딩 부재 검사 복원(기존 코드가 계산해놓고 버리던 t786ok 사용).
- **violated_rule**: R279 계열(관측 시점 상태를 영구 등호 단언) — 날짜(R279)·숫자 시드(P626)·이제 "결측 상태" 자체까지 3번째 변형. 규칙 승격: "테스트 불변식은 데이터 가용성 상태와 무관하게 참이어야 한다(가용/불가용 양쪽을 명시적으로 분기 검증)".
- **prevention**: artifact 내용에 의존할 수 있는 테스트는 push 전 "현재 origin artifact"와 "차기 producer 산출물 형태" 양쪽으로 돌린다(이번에 실제로 잡음). 신규 fail-closed 테스트는 available true/false 두 상태의 계약을 모두 서술한다.
- **verification**: 봇 artifact(quotes 77)와 quotes=[] 형태 양쪽에서 헤드리스 1101/1101 PASS.

## P721 - v53.5 - RRG가 세션 내 틱 누적에 의존해 모든 신규 방문자에게 영구 판정 보류였다

- **motivation**: 사용자 요청("각 페이지 핵심 정보가 나오는지 확인") — 22페이지 렌더 감사를 라이브/로컬 이중 실측한 결과 themes 페이지 RRG가 라이브에서 "사이클 판정 보류 · 근거 0/11"로 전면 공백.
- **symptom/reproduction**: 라이브 v53.2 themes 진입 시 RRG 사분면 카드·사이클 pill 전부 보류. 원인 추적: `calcLiveRS()`가 요구하는 `_priceHistory`(>20 샘플)는 `collectPriceHistory()`가 30초 틱마다 세션 내 메모리에 push하는 구조 — 새 방문자는 10분+ 체류 전까지, 리로드 시엔 다시 0부터. 사실상 전 방문자 영구 보류.
- **root_cause**: RRG는 일봉/주봉 종가 기반(13wk MA) 지표인데 데이터 소스를 세션 틱 누적으로 설계(v27.2 잔재). v52.98이 정적 RRG 시드를 제거(fail-closed)하면서 대체 실데이터 경로를 연결하지 않아 "정직한 영구 공백"이 됨 — v50.15 VKOSPI 미니차트(P641)와 동일 클래스.
- **fix**: `hydrateRRGDailyHistory()` 신설 — 기존 검증된 클라 경로(fetchViaProxy+_parseYFChartResponse, fetchSentimentHistory 패턴)로 SPY+11섹터 ETF의 실제 6개월 일봉 종가를 배치 3개 동시·배치별 점진 재렌더로 수화. `_priceHistoryDaily` 마커로 틱 push의 일봉 오염 차단(혼합 금지). `calcLiveRS`/`renderRRGQuadrantCards`의 불필요한 라이브 틱 선행 게이트를 일봉 우선으로 완화(틱 없어도 일봉으로 판정, pct는 마지막 2개 종가 파생). 실패 심볼은 채우지 않고 보류 유지(추측 금지). 부수: kr-home KOSPI/KOSDAQ 변화폭 HTML 정적 리터럴(▲200.86/▼28.05) 제거 + `data-live-kr-change` 숫자 리터럴 금지 게이트 추가(기존 62행 패턴이 속성명 불일치로 미커버).
- **violated_rule**: R25(인프라 교체 시 소비자 경로까지 연결 — v52.98이 시드 제거만 하고 실데이터 경로 미연결), 카테고리 20(정적 시장값 리터럴).
- **prevention**: fail-closed로 시드를 제거할 때는 "정직한 공백"이 영구 상태인지(대체 실데이터 경로 존재 여부)를 함께 판정한다. 클라이언트 누적 기반 시각화는 첫 방문자 관점(누적 0)에서 검증한다.
- **verification**: 로컬 실브라우저(시세 차단 환경)에서 themes 진입 → 12심볼 일봉 100개 수화 → RRG 근거 11/11, 사분면 카드 실분류 렌더 확인(exit 0). 정적 계약 게이트 22/22 + 신규 패턴 3방향 단위검증(회귀 잡힘/JS 템플릿 무시/정상 통과).

## P720 - v53.5 - critical10 감사의 맨몸 날짜 토큰이 정상 체크리스트 "5/5"와 충돌해 간헐 CI RED를 만들었다

- **motivation**: 사용자가 "run failed 이메일이 종종 온다"고 보고 — 2026-07-16 12:10Z/14:24Z CI 실패(T173) 2건을 조사.
- **symptom/reproduction**: 데이터 갱신 커밋에서만 T173이 간헐 실패 후 다음 갱신에서 자연 복구. 실패 커밋(e603a583)의 data.json/telegram-digest.json을 현재 코드에 얹어 실브라우저 재현 — signal 페이지 실행 체크리스트가 그날 5개 조건을 전부 충족해 "5/5 (충족)"을 렌더했고, `staleTokenRe`의 맨몸 `5\/5` 토큰이 이를 2026-05월 정적 잔재로 오인.
- **root_cause**: 4~5월 정적 스냅샷 잔재 검출용 토큰 중 `5/4|5/5|5/8|5/9`가 컨텍스트 없는 2문자 날짜 패턴이라 "n/5 점수" 등 정상 동적 텍스트와 구조적으로 충돌 — P715의 '1,508' 리터럴과 동일 클래스(감사 리터럴 vs 라이브 실값 충돌). 시장 상태(체크리스트 충족 수)에 따라 CI가 갈리는 간헐성.
- **fix**: 맨몸 날짜 토큰 4개 제거(감지 대상이던 정적 잔재는 v53.4 정적 데이터 계약 22카테고리가 원천 차단). 컨텍스트 있는 토큰(VIX Spot 18.36, 이란 재협상 등)은 유지. 부수: 같은 체크리스트의 시스템 발화형 판정 라벨("진입 검토 가능/진입 자제" 2곳)을 P714 정합 관측형("조건 대부분/일부 충족·미충족 다수")으로 전환.
- **violated_rule**: R25 반복(P715와 동일 클래스 3회째 — 감사 리터럴에 시장 실값과 충돌 가능한 짧은 숫자/날짜 패턴 금지를 규칙 승격 후보로).
- **prevention**: 감사용 stale 토큰은 최소 1개 비숫자 컨텍스트 단어를 포함해야 한다. 간헐 CI 실패는 "데이터 내용 의존 단언" 여부를 최우선 가설로 조사한다.
- **verification**: 실패 당시 데이터 재현 하네스에서 수정 전 issueCount 1("5/5" 매칭 문맥 실증) → 수정 후 issueCount 0. 전체 헤드리스는 배치 최종 게이트에서 확인.

## P719 - v53.5 - data.json 발행 계약(P715 quotes 스트립)이 meta 후기록 재기록에 덮여 라이브에서 무효였다

- **motivation**: REMAINING-WORK B3(배포 후 첫 크론 산출물 검증) — v53.2 배포 후 refresh-data 크론이 patched producer로 재생성한 라이브 아티팩트 3종을 curl로 대사했다.
- **symptom/reproduction**: `https://ysnle.github.io/aio-screener/public-data/data.json`(generatedAt 2026-07-17T01:12Z, 배포 훨씬 이후)에 quotes 77건이 원시 시세 그대로 발행되고 `meta.quotesPublished`는 undefined. 같은 배치의 telegram-digest(summary-only)·screener.json(price 0건)은 계약 준수 — data.json만 위반.
- **root_cause**: `fetch-data.mjs` main()이 P715 스트립을 적용한 `publicData`를 한 번 쓰고(1761행), 그 뒤 screener 상태(fmpHasKey 등)를 `data.meta`에 후기록한 다음 "재기록" 단계(1809행)에서 **스트립 안 된 원본 `data`를 그대로 다시 써서** 첫 발행을 덮어썼다. P715 구현 시 OUT에 쓰는 두 번째 write 사이트를 놓친 것 — 로컬 게이트는 producer를 실행하지 않아 잡지 못했고, 위반은 라이브 크론 첫 실행에서야 드러났다.
- **fix**: 발행 페이로드 생성을 `toPublicPayload()` 헬퍼로 일원화해 두 write 모두 경유시키고, 마지막 발행본을 디스크에서 read-back해 quotes=[]·quotesPublished:false를 단언하는 계약 검증을 main() 끝에 추가(위반 시 throw → git 커밋 전에 워크플로 fail).
- **violated_rule**: R25(같은 파일 내 이중 write 사이트 전수 확인 없이 한 곳만 패치). P712~P714의 "이중 표면 드리프트" 패턴의 producer 판 — 동일 산출물에 쓰는 모든 write 경로를 grep 전수로 닫아야 한다.
- **prevention**: 발행 계약을 바꿀 때는 해당 출력 경로(OUT 등)에 대한 write 사이트를 전수 grep하고, 가능하면 계약을 write 시점 헬퍼+read-back 단언으로 코드화해 "패치 누락"이 조용히 살아남지 못하게 한다. 다음 크론 실행 후 라이브 재확인 필요(후속 검증 항목).
- **verification**: `node --check` PASS. read-back 게이트는 다음 refresh-data 크론 실행에서 실동작(위반 재발 시 워크플로 RED). 라이브 재확인은 배포+크론 도래 후 curl로 수행 예정.

## P718 - v53.4 - 공급자 퇴역 뒤 남은 시나리오 소비자가 null 확률을 숫자로 포맷했다

- **motivation**: 정적 시나리오 확률 생산자를 제거한 뒤 실제 Chromium에서 거시 페이지를 열어, 결측 상태가 화면과 콘솔에서 안전하게 처리되는지 확인했다.
- **symptom/reproduction**: 외부 네트워크를 차단한 실제 브라우저에서 거시 페이지 진입 시 legacy `updateDynamicScenarios()`가 공급자 없는 `null` 확률에 `.toFixed()`를 호출해 콘솔 오류를 냈다. 단위 테스트는 퇴역 생산자와 정적 확률 부재만 검사해 남은 소비자 경로를 실행하지 못했다.
- **root_cause**: 정적 확률 레지스트리와 데이터 생산자는 제거했지만, 인라인 DOM 갱신 함수·호출부·빈 시나리오 DOM이 수직 경로로 함께 제거되지 않았다. 결측을 숫자로 강제 포맷하는 소비자 계약도 남아 있었다.
- **fix**: `updateDynamicScenarios()` 선언, 모든 호출, 빈 시나리오 확률 DOM을 수직 제거하고 공급자 미연결 상태는 `data-scenario-provider-state="unavailable"`로 명시했다. T1040과 정적 데이터 계약은 provider-required 정책과 퇴역 소비자 부재를 함께 검사하도록 갱신했다.
- **violated_rule**: R341의 퇴역 경로 완전 제거와 R342의 결측 숫자 포맷 금지 원칙을 생산자 쪽에만 적용하고 실제 route 소비자까지 닫지 못했다.
- **prevention**: 데이터 생산자·레지스트리를 퇴역할 때 선언→호출→DOM sink→테스트를 한 묶음으로 제거한다. provider-required 출력은 유효한 공급자 응답 전까지 숫자·확률을 렌더하지 않으며, 실제 Chromium route 검증에서 console error 0을 필수로 한다.
- **verification**: 호출·선언 잔존 0, 정적 데이터 계약 22/22, runtime/structural/semantic 계약, Chromium headless 1101/1101을 통과했다. 실제 Chromium critical-10은 10/10·consoleErrors 0, 접근성은 22/22·consoleErrors 0이었다. B1 재현, B2 직접 원인, B3 인접 소비자, B4 문서·규칙, B5 자동 회귀, B6 실제 브라우저까지 모두 닫았다. 커밋·배포는 수행하지 않았다.

## P717 - v53.4 - 정적 시드와 현재형 서술이 데이터 생산자처럼 분산되어 결측을 숨겼다

- **motivation**: 스크리너 전체 코드와 화면의 고정 수치·텍스트를 전수 조사하고, 최신화로 해결할 항목과 구조적으로 런타임화할 항목을 구분해 정리했다.
- **root_cause**: 시세·심리·거시·시장폭·RRG·시나리오·이벤트·한국시장·LLM 비용까지 서로 다른 시기에 추가된 정적 폴백과 현재형 문장이 DOM, `DATA_SNAPSHOT`, 페이지별 채팅 override, 차트 seed, 스크리너 memo에 흩어져 있었다. 공급자 실패 시 이 값들이 명시적 결측 대신 정상 데이터처럼 보였고, 테스트와 CI도 오래된 상수의 존재를 계약으로 고정했다.
- **fix**: 변동 데이터는 런타임 artifact/공급자만 허용하고 미수신은 explicit null과 `—`로 닫았다. `AIO_MANUAL_REFERENCE`에는 공식 일정·정책만 출처·기준일·reference-only 용도와 함께 남겼다. SCREENER_DB는 873개 식별자만 보관하고 signal/memo/mcap/rsi는 런타임 병합으로 제한했다. 정적 quote/FRED/RRG/감정/차트/시나리오/이벤트/현재 narrative/LLM 가격·환율 폴백과 중복 채팅 context를 제거했다. 22개 데이터 카테고리를 검사하는 `ci-static-data-contract-check.mjs`를 CI에 추가하고 스크리너 유니버스를 재생성했다.
- **violated_rule**: R340의 fail-closed 원칙이 파생 결론에는 적용됐지만, 화면 초기값·현재형 텍스트·AI context·비용표·테스트 fixture까지 하나의 데이터 표면으로 묶이지 않았다.
- **prevention**: R342로 변동 수치·현재형 서술·확률·공급자 가격은 runtime-only, 공식 수동값은 provenance 필수, 결측은 explicit unavailable로 강제한다. 22개 카테고리 계약과 DOM numeric seed 탐지, synthetic fallback 금지, identity-only screener 계약을 CI에서 차단한다.
- **verification**: 정적 데이터 계약 22/22, runtime/structural/data-lineage 계약, JS 구문 검사, Chromium headless 1101/1101을 통과했다. 스크리너 유니버스는 873건으로 재동기화됐고 live-core lineage 실패는 0건이다. SEC 비표준/해외종목 커버리지 부족은 숫자로 보완하지 않고 reference 경고로 유지했다. 커밋·배포는 수행하지 않았다.

## P716 - v53.3 - 퇴역 기능을 비활성 코드로 보존하고 테스트 번들을 공개 배포한 구조가 코드와 사이트를 함께 비대화했다

- **motivation**: 사용자 요청으로 스크리너에 들어가는 전체 코드를 검토하고 중복·불용·도달 불가 코드와 공개 배포 구성을 정리했다.
- **root_cause**: 이전 수정들이 feedback board, 구형 macro narrative, breadth history chart, legacy indicator를 완전히 제거하지 않고 `return`, inert stub, 숨김 CSS, 호환 wrapper 형태로 남겼다. 테스트도 퇴역 구현의 부재가 아니라 “호출해도 아무 일 없음”을 확인해 잔존을 정당화했다. 동시에 Pages staging이 `js/*.js`를 복사하고 service worker가 `aio-tests.js`까지 shell asset으로 캐시해 CI 전용 약 680KB 번들을 사용자에게 배포했다.
- **fix**: 퇴역 기능의 DOM·CSS·상태·함수·호출·테스트를 수직 경로 단위로 제거하고, 현재 renderer 계약에 맞춰 회귀 테스트를 갱신했다. 선언만 있고 참조가 없는 named function을 차단하는 structural gate를 추가했다. Pages manifest·CI staging·service worker를 5개 runtime script 명시 허용목록으로 통일하고 테스트 번들을 제외했다. 총 diff는 코드·배포·문서 포함 순감소 1,300줄 이상이다.
- **violated_rule**: R220의 compactness 원칙과 공개 artifact 최소화 계약이 퇴역 경로·CI 전용 자산까지 확장되지 않았다.
- **prevention**: R341에 퇴역 수직 경로 완전 제거, declaration-only function 금지, Pages runtime allowlist와 service-worker 정합을 승격했다. `ci-structural-check.mjs`와 `ci-release-revision-check.mjs`가 재유입을 차단한다.
- **verification**: JS/MJS 38개 문법 검사, 정적 계약 14개, Chromium headless 1100/1100, boot interaction, critical-10, portfolio vault 8/8, accessibility 22/22, FULL_INIT viewport 22×4=88/88(overflow 0, JS error 0)을 통과했다. 커밋·배포는 수행하지 않았다.

## P715 - v53.2 - 서버 백스톱 제거가 null 코어전 함정·오탐 리터럴·hue 결합 테스트를 연쇄로 드러냈다

- **motivation**: 사용자 결정("지인 소수 공유 준비", 8건 AskUserQuestion 확정)에 따라 TG digest 요약화·KR 정지 위젯 정리·스크리너 enum/price·data.json 시세 발행 중단·IA 재편을 일괄 실행했다.
- **root_cause**: ① `computeMarketHealth`의 fail-closed null score를 3개 소비처가 무가드 문자열화("null점") — 서버 시세 백스톱이 있는 동안은 score가 항상 유한해 잠복. ② 1차 가드를 `Number.isFinite(Number(v))`로 작성 — **`Number(null)===0`이라 null이 통과**하는 코어전 함정으로 가드가 무력(프로브 실측으로 확정). ③ critical10 감사 staleTokenRe의 `1,508` 리터럴이 과거 하드코드 검출용이었으나 라이브 USD/KRW가 1,508원을 지나는 순간 오탐(2026-07-16 실측 — 날짜핀 부패와 동족인 "시장값 회전 부패"). ④ T458이 '과열 override(≥70)' 회귀 의도를 amber 색상 hue로 검증 — 공유 팔레트가 40~69에도 amber를 쓰므로 US above20=52.5 아티팩트에서 오검출. ⑤ 하네스는 외부 요청 전면 차단+loadTests 경로인데 초기 프로브가 이를 재현하지 않아 원인 특정이 지연됨.
- **fix**: `typeof score === 'number' && isFinite(score)` 가드 3곳(ec-score/바닥 체크리스트/기술 채팅 컨텍스트), staleTokenRe에서 시장값-충돌 리터럴 제거(타깃 가드 T175 전담), T458을 override 경계 검증으로 재작성, 하네스 동일조건 프로브(route.abort+loadTests) 확립.
- **violated_rule**: R340(결측의 문자열 승격 — 이번엔 'null' 리터럴), R25(P713 날짜핀과 동족의 "외부값 회전 시 부패하는 리터럴 단언" 2번째 클래스), 신규 함정: truthy/finite 가드에서 Number() 선코어전 금지.
- **prevention**: (a) null 가능 수치의 표시 가드는 반드시 `typeof v === 'number' && isFinite(v)` — `Number.isFinite(Number(v))`는 null/''/false를 통과시킴. 검출: `grep -n "Number.isFinite(Number(" js/ index.html`. (b) 감사/테스트 리터럴에 시장 실값과 충돌 가능한 숫자 금지(가격·지수·환율 리터럴은 요소-타깃 단언으로). (c) 헤드리스 재현은 반드시 하네스 동일 조건(외부 차단·loadTests)으로.
- **verification**: 하네스 동일조건 프로브로 "null점" 2건 실측→수정→소멸 확인, 헤드리스 1100/1100 + 전 게이트 재실행(상세 CHANGELOG v53.2). TG 아티팩트 85% 축소·screener price 846행 제거·data.json quotes 0건을 validator/lineage로 확인. 배포·커밋 미수행.

## P714 - v53.1 - 정적 UI가 AI 게이트가 차단하는 매매·배분 지시를 20여 곳에서 발화하고 있었다

- **motivation**: 사용자 요청으로 최근 작업분이 아닌 시스템 전체(설계·아키텍처·알고리즘·데이터·UI/UX·운영·제품성)를 기관/펀드 관점에서 전수 진단했고, 발견 이슈 중 코드 실행 가능분을 일괄 개선했다.
- **root_cause**: ① v52.75~86에서 AI 채팅에는 "구체 매수·매도·비중·손절·목표가" 차단 게이트를 정교하게 구축했지만, 동일 문형을 발화하는 **정적 UI 표면은 게이트 범위 밖**이었다 — `AIO_ACTION_RULES`(VIX→"포지션 X%로 축소·풋옵션 헤지 필수", F&G→"역발상 매수/차익실현"), 옵션 "권장 전략", home/signal 결론 바 "선별매수·분할 진입 검토"(v52.91 라벨 완화가 이 표면을 누락), 점수 범례 "0~40=현금 확보", MTF/VIX/breadth "행동 가이드" 등. 입력(VIX/F&G 절대 밴드)의 예측력은 검증된 적 없고 유사 입력 조합(WO-2)은 음의 상관이 실측된 상태였다. ② `computeTradingScore` macro 축의 `hyg<76` 달러 고정 임계 — 같은 함수 40줄 아래 주석이 스스로 "HYG 가격은 듀레이션 오염" 이라고 설명하면서 위쪽 코드는 그대로였고, P713(Weinstein/MTF)과 동일 클래스의 마지막 잔존이었다. ③ 면책 고지가 guide `<details>`에 접혀 있어 지시형 문구 대비 실질 도달률이 0에 가까웠다. ④ typed-claim 게이트는 envelope 미제출 시 검증 자체가 스킵되는 옵트인 구조인데 사용자에게 그 구별이 표시되지 않았다.
- **fix**: 시스템 발화형 지시 20여 곳을 프레임워크 귀속 관측형으로 전환(sizePct는 데이터로만 유지·렌더 금지, 출처 귀속 교육 서술과 안전 테스트 픽스처는 보존), `hyg<76` 제거(신용은 FRED HY OAS 실측 블록으로 일원화), 첫 방문 비차단 면책 바 신설(localStorage 1회 확인), 스크리너 kalman 컬럼 (연구) 라벨, AI not-structured+현재성 수치 응답에 "자동 검증 미통과" 비차단 고지, T221 관측형 재작성.
- **violated_rule**: R340 계열(검증 안 된 입력의 판정 승격 — 이번엔 값이 아니라 '지시문'이 승격 대상이었음), R25(P713과 동일 클래스 `hyg` 임계의 3번째 표면 — Weinstein/MTF/score), WP-AI0의 경계 정의(게이트가 "AI 응답"만 대상이라 정적 UI가 사각).
- **prevention**: (a) 매매 지시 문형 게이트는 발화 주체(AI/정적)와 무관하게 적용한다 — 회귀 검출: `grep -nE "매수하세요|매도하세요|진입하세요|축소하세요|하세요.*포지션|포지션.*%.*(축소|확대)|헤지 (필수|하세요)" index.html js/*.js`(안전 픽스처·부정문 제외). (b) 달러 가격 고정 임계로 신용/스프레드를 판정하는 패턴 금지는 이제 3회 반복 — RULES 승격 요건 충족(R341 후보): `HYG.*[<>]\s*[0-9]{2}` 계열 grep을 QA에 편입. (c) 면책·공시 문구를 수정할 때는 그 공시와 모순되는 라벨이 남아있는지 결론 바/범례/가이드 전 표면을 함께 grep한다.
- **verification**: 변경 JS 5종 node --check + index.html 인라인 12블록 전수 파스 + 헤드리스 전체 + runtime/structural/ux/critical10/a11y/vault/viewport(FULL_INIT) 게이트 재실행(결과는 CHANGELOG v53.1). 배포·커밋은 별도 지시 전 미수행.

## P713 - v53.0 - fail-closed 전수 스윕이 이중 구현 표면을 놓쳤고, 날짜 하드코딩 테스트가 이벤트 당일 CI를 죽였다

- **motivation**: 사용자 요청으로 v52.73~v52.99 Codex 작업분(커밋 +7,834줄, 미커밋 +2,061줄)을 금융 전문가 관점에서 전수 리뷰했다. CHANGELOG 주장과 실제 코드의 정합성을 diff·구현 정독·게이트 실행·라이브 CI 실측으로 대조했다.
- **root_cause**: ① P712/v52.98이 "Weinstein Stage·MTF는 관측 이력 없으면 판정 보류"를 aio-core.js marketState 경로에만 적용하고, index.html의 별도 구현 `updateWeinsteinStage()`/`updateMTF()`(호출부 살아있는 라이브 경로)를 놓쳤다 — 임의 폴백(abv50=28, 20SMA=57)과 HYG 달러 고정 가격밴드($80/76/72) 신용 판정, "매수 금지! 현금이 최고의 포지션" 처방 문구가 잔존(이중 표면 드리프트 재발). ② VKOSPI 시드 주석은 "live 성공값만 current evidence로 허용"이라 선언했지만 소비처(kr-supply 배너+채팅 컨텍스트 5곳)는 게이트 없이 시드를 현재값처럼 사용. ③ T884가 '2026-07-16'을 하드코딩해 금통위 당일 캘린더 auto-advance와 충돌 — origin/main CI가 이벤트 당일 결정론적으로 RED가 됐고, runtime contract의 BOK/FOMC 날짜 핀 2건도 동일 클래스(FOMC 핀은 7/29에 부패 예정이었음). ④ 스코어 공시 "예측력 아직 검증되지 않음"은 WO-2 실측(유의한 음의 상관)을 과소 공시.
- **fix**: 두 함수 evidence-gate 교체(50SMA 폭 미수신 시 Weinstein 판정 보류·MTF 축 제외), HYG 가격밴드→FRED HY OAS(350/450/550bp) 교체+미수신 시 축 제외, 처방 문구 프레임워크 귀속형 전환, `_vkospiLiveOk` 플래그로 소비처 6곳 게이트, T884·runtime contract 날짜 핀 3건을 rot-proof 정합성 검증으로 재설계(BOK 공식 일정 7/16→8/27 반영), 스코어 공시에 음의 상관 실측 명시, 잔여 매매 권유 문구 5곳 관측형 전환, debug.log untrack.
- **violated_rule**: R340(파생 결론의 결측 대체 금지 — 이중 구현까지 전수 강제 실패), R276 계열(동일 판정의 이중 표면), R3·R25(날짜 하드코딩 단언은 P604 auto-advance 버그와 같은 "달력 회전 부패" 계열인데 테스트/계약에서 재발).
- **prevention**: (a) fail-closed 스윕은 함수 단위가 아니라 **동일 지표를 소비하는 모든 호출 표면의 grep 전수**(예: `abv50`, `hygPrice >`, `DATA_SNAPSHOT.vkospi`)로 완료를 판정한다. (b) 테스트·CI 계약에 미래 특정일을 등호로 고정하는 단언 금지 — 유효성(ISO 파싱)+표면 간 정합(등호는 소스 상수끼리만)으로 작성한다. 위반 검출: `grep -n "=== '20[0-9][0-9]-" js/aio-tests.js`. (c) 시드 정책 주석("판정에 사용 안 함")을 달 때는 소비처 grep 결과를 주석에 병기한다.
- **verification**: 워킹트리 헤드리스 1099/1100(유일 실패가 T884 당일 부패임을 실측 확인) → 수정 후 전체 재실행 + runtime contract + structural + version 게이트. BOK 2026 일정은 한국은행 공식 페이지·복수 언론으로 확인(2/26·4/10·5/28·7/16·8/27·10/22·11/26). 리뷰 도중 실제로 7/16 금통위가 열려 만장일치 2.50%→2.75% 인상(3년6개월 만)이 확정됐음을 WebSearch 복수 소스(Newspim·파이낸셜뉴스·이투데이)로 교차 확인 — DATA_SNAPSHOT 시드·currentTopic·정적 HTML 3곳·히스토리 표·이슈 카드·폴백 리터럴 4곳·KR 건강점수를 실제 결과로 동기화(이 자체가 R340 "결측/정적값의 현재 판정 승격 금지" 원칙의 정상 사례 — 값이 바뀐 즉시 소비 표면 전체를 갱신). 배포·커밋은 이 시점까지 수행하지 않았다.

## P712 - v52.99 - 결측·정적·합성 데이터가 현재 시장 판정으로 승격됐다

- **motivation**: Telegram digest 주입 여부를 넘어 22개 페이지의 모든 가시 텍스트·숫자·차트·판정 문구를 현재 시장 및 공식 원천과 비교했다.
- **root_cause**: 미국채 만기 필드가 혼용돼 `^TNX` 10년물이 2년물 슬롯을 덮었고, 일부 화면은 5년물에 계수를 곱해 2년물을 합성했다. 기술 페이지는 OHLCV 실패 시 당일 등락률로 RSI·MACD·Stage를 추정했고, 종목 차트와 시장폭 차트는 난수 시계열을 만들었다. RRG는 과거 섹터 시드, McClellan은 50일선 상회율 역산, HY OAS는 HYG 가격 임의 변환을 사용했다. 과거 일정·설문·한국 테마 촉매와 결측 수급/VKOSPI도 현재 결론으로 승격됐다.
- **fix**: 만기별 금리를 명시적 canonical curve evidence로 분리하고 2s10s는 관측 2Y·10Y로만 산출한다. 기술지표·Weinstein Stage·멀티타임프레임·ticker/breadth 차트·RRG·McClellan·HY OAS는 필요한 관측 이력이 없으면 판정 보류한다. 공식 미래 일정은 snapshot 일정에서 동적 생성하고, AAII·NAAIM·한국 촉매·수출 자료는 기준일과 reference-only 용도를 표시한다. 한국 테마·시장건강도는 coverage와 현재 수급/VKOSPI가 부족하면 점수·등급을 만들지 않는다. 후속 전수 렌더에서 발견한 엔캐리 프록시의 하드코딩 입력, 이동평균 시각 없는 시장 레짐, OHLCV 없는 라운드 지지·저항, 비정규화 RSP/SPY 집중도, 출처 없는 한국 공매도 수치도 현재 결론에서 제거하거나 보류 처리했다.
- **violated_rule**: R301/R332의 currentness·lineage gate를 개별 값에는 적용했지만, 파생 결론과 시각화가 필수 입력 결측을 중립값·정적값·합성값으로 대체하는 경로까지 강제하지 못했다.
- **prevention**: R340과 T1024~T1027·T1037~T1039·갱신 T874, runtime contract가 만기 의미 분리, 합성 금리 금지, 결측 시 엔캐리 프록시 보류, 현재 OHLCV 없는 레짐/지지저항 보류, 비정규화 가격비율의 시장폭 결론 금지를 검사한다. 페이지 전수 semantic inventory와 CI에 합성 시계열·RRG seed·HYG→OAS·과거 일정의 현재 판정 재유입 금지를 추가한다.
- **verification**: BLS CPI, BEA PCE, Fed/BOK 일정, FRED 2s10s, Cboe put/call, NAAIM 공식값과 `public-data/data.json`을 대조했다. 22개 route semantic render, runtime/data-pipeline contract, Chromium headless, 접근성 22/22 및 viewport 88/88을 통과했다. Telegram/공식 원천과 22개 페이지 비교 결과는 `_artifacts/page-content-market-audit-2026-07-15.md`에 기록한다. 배포·커밋은 수행하지 않았다.

## P711 - v52.97 - Telegram 증분 digest가 전체 관측 커버리지와 최신 narrative를 동시에 잃었다

- **motivation**: 로그인된 Telegram Web에서 Aether Japan Research, Insider Tracking, BornLupin의 최근 5일 게시물 546건을 끝까지 수집해 스크리너의 페이지·종목·채팅 반영 상태와 전수 대조했다.
- **root_cause**: `lastPostId` 증분 수집은 capped `topItems`/`broadItems`만 다음 주기로 넘겨 저점수 게시물의 ID·태그 lineage를 소실했고, `count`와 채널 count가 전체 기간이 아니라 이번 fetch/보존 pool 규모를 나타냈다. producer는 themes/catalysts/categories/pageMap을 만들지 않았고 runtime normalizer는 동적 원문을 받으면서도 2026-07-03 정적 narrative를 유지했다. 분류기는 insider/earnings/flows/healthcare/japan이 없고 티커 추출도 소수 하드코딩 목록에 갇혀 있었다. 공개 미러 전면 실패 시 full scan은 빈 digest를 쓸 수 있었다.
- **fix**: 전체 기간 경량 `observedItems`와 capped 본문 payload를 분리하고 count/fresh/text-eligible/selected/coverage 의미를 명시했다. 현재 원문 기반 narrative·22-page map을 producer와 구형-artifact runtime fallback에서 재생성한다. 5개 태그와 22-route 소비 계약, SCREENER_DB 동적 alias 사전, page coverage audit을 추가했다. 전 채널 실패 시 이전 성공 digest 본문과 `generatedAt`을 보존하고 `attemptedAt`/실패 상태만 갱신한다.
- **violated_rule**: R215의 digest→화면→스크리너→채팅 환류를 원문 배열 존재 여부로만 판단했고 R262의 self-throttle을 전체 기간 lineage와 독립적으로 설계하지 않았다. R338의 timestamp 의미 분리도 count/coverage 의미까지 확장하지 않았다.
- **prevention**: R339, T830~T831, data/runtime contract가 전체 관측 lineage, capped payload 보존률, 동적 narrative 치환, 22-page map, expanded tags/ticker aliases, 실패 시 마지막 정상 digest 보존을 검사한다.
- **verification**: Telegram Web 546건(106/345/95) 대 기존 5일 보존 원문 254건(57/122/75)을 대조했다. syntax, version/data/runtime/structural/semantic/knowledge 계약과 Chromium headless 1084/1084, 접근성 22 routes, viewport 22×4=88, portfolio E2E 8/8을 통과했다. 공개 미러 Node 재수집은 3채널 모두 네트워크 실패해 기존 정상 artifact를 복구·보존했으며 이 실패를 성공 수집으로 승격하지 않았다. 전체 결과는 `_artifacts/telegram-5d-coverage-audit-2026-07-15.md`에 기록했다.

## P709 · v52.94 · Automated refresh exposed stale fallback-parity and producer-fixture assertions

- **motivation**: The post-refresh CI run `29388582785` passed 1082/1084 headless checks but exposed two data-dependent regressions before Pages deployment: T686 treated the dated `_fallback` mirror as live parity data, and T1022 could not simulate a disconnected screener when a direct server artifact was present.
- **root_cause**: `getSnapshotFallbackConsistencyAudit()` reported numeric drift without declaring the fallback's reference-only date semantics, while `_aioProducerState()` only applied `_aioScreenerLoadState` when direct artifact metadata was absent. The test suite therefore encoded stale assumptions about both reference data and fixture isolation.
- **fix**: The snapshot audit now exposes `fallbackAsOf`, `snapshotAsOf`, `referenceOnly`, and `parityRequired`; T686 accepts zero drift or explicit dated reference-only evidence. Explicit screener load-state fixtures now override direct artifact metadata, while normal runtime behavior preserves direct metadata when no fixture status exists.
- **violated_rule**: R308 enforcement gap; promoted to R337 for fixture precedence and explicit fallback-drift semantics.
- **prevention**: Added the R308/T686 runtime contract check, updated T686/T1022, and added the QA checklist closure. The test must be rerun after artifact refresh because the failure depends on the current snapshot/fallback relationship.
- **verification**: Local `node --check` and targeted runtime contract/headless tests after the patch; final Actions CI and Pages deployment must pass before release closure.

## P708 · v52.93 · 무료 대체 계획이 실행 workflow·행 lineage·공식 Put/Call 경로 없이 부분 완료로 남음

- **motivation**: `INSTITUTIONAL-DATA-READINESS-HANDOFF-2026-07-12.md`와 `DATA-SOURCE-REPLACEMENT-PLAN-2026-07-14.md`를 v52.92 실제 코드와 대조했다. `SCREENER_ONLY` 함수는 있었지만 workflow가 없었고, 새 validator가 현재 screener row의 `observedAt` 누락을 재현했다. Cboe CDN은 실제 403이었으며 client proxy 실패가 snapshot으로 되돌아가는 구조였다.
- **root_cause**: 대체 공급자 registry와 CLI 진입점 존재를 운영 연결과 혼동했고, 계약 검사는 artifact top-level `factorObservedAt`/breadth만 확인해 row lineage를 검사하지 않았다. Put/Call은 공식 HTML에 값이 있어도 오래된 CDN JSON과 공용 proxy를 계속 주경로로 사용했다. direct-run guard 5곳도 `process.argv[1]`이 항상 있다고 가정해 정상 import 환경에서 충돌했다. 지식 린트는 git-tracked 파일만 열거해 새 문서를 커밋 전에는 잘못된 orphan으로 판정했다.
- **fix**: 6시간 `refresh-screener.yml`, publish 전 `validate-screener-artifact.mjs`, 846개 row별 observation/source/use fields, 무료 SEC bounded companyfacts artifact, Cboe official delayed server ingest, 80% fundamentals coverage gate, free-plan-only dependency states를 추가했다. direct-run guard 5곳은 빈 argv를 안전하게 처리하고, 지식 린트는 non-ignored 신규 `_context/*.md`도 양쪽 문서 표와 대조한다.
- **violated_rule**: R333의 “구현 완료 분리”를 workflow/row/publish 수준까지 실행하지 못함. R334로 승격.
- **prevention**: data-pipeline/runtime contract가 독립 workflow, SEC/Cboe fixture, row lineage, semantic validator, free-only 상태를 검사한다. knowledge lint는 staged 여부와 무관하게 신규 지식 문서와 `INDEX.md`/`_context/CLAUDE.md` 양쪽 표를 검사한다. validator grep: `rg -n "validate-screener-artifact|observedAt|research-relative-ranking-only" .github/workflows/refresh-screener.yml scripts/fetch-data.mjs scripts/validate-screener-artifact.mjs`.
- **verification**: 새 screener 실제 생성 `846/870`, validator PASS, US 706/725·KR 140/145 breadth coverage 80%+, Cboe 공식 live page `total 0.93/index 1.01/equity 0.62/asOf 2026-07-14` 파서 PASS, SEC normalization fixture PASS. SEC live collection은 monitored contact를 담은 `SEC_USER_AGENT` 미등록으로 의도적으로 미검증/차단.


## P707 - v52.92 - 외부 수집 전면 실패가 마지막 정상 data.json을 빈 산출물로 덮어썼다

- **motivation**: 전체 데이터 자동 최신화의 남은 구조 문제와 외부 의존별 대체 API를 검증하는 과정에서 로컬 수집을 실행했다.
- **root_cause**: `fetch-data.mjs`가 핵심 시세 커버리지 50% 게이트를 파일 기록 뒤에 검사했다. 네트워크가 차단되자 77/77 실패 결과를 먼저 `public-data/data.json`에 기록한 뒤 종료해 마지막 정상값 보존 원칙을 위반했다. 전체 파이프라인과 870종목 스크리너 갱신도 하나의 실행 경로라, 스크리너만 안전하게 재생성할 수 없었다.
- **fix**: 핵심 시세 커버리지 검사를 첫 `writeFile(OUT)` 앞으로 이동해 실패 시 기존 파일을 보존한다. `enrichScreener()`를 export하고 `SCREENER_ONLY=1` 직접 실행 경로를 추가했다. 외부 의존 15개 카테고리를 구현/승인/라이선스/수동 상태로 분해한 `getExternalDependencyAudit()`와 대체 계획 문서를 추가했다.
- **violated_rule**: R332의 `attemptedAt`/`lastSuccessfulAt` 분리와 마지막 정상값 보존을 producer artifact publish 단계까지 적용하지 않았다.
- **prevention**: R333, data-pipeline contract, runtime LIVE3-11~12가 쓰기 전 커버리지 게이트, 독립 스크리너 경로, 외부 공급자 상태·권리·cadence 레지스트리를 검사한다.
- **verification**: 독립 외부 수집으로 스크리너 847/870, 미국 707/725, 한국 140/145를 생성했다. 관측시각은 미국 2026-07-14T12:00:10Z, 한국 2026-07-14T00:00:00Z이며 브레드쓰 커버리지는 각각 97.5%, 96.6%다. 복구된 핵심 `data.json`은 77/77 시세, F&G 44, FRED 19, 뉴스 40을 유지한다. Browser 플러그인은 호출 중단으로 검증 수단에서 제외했다.

## P706 - v52.91 - 파일 갱신 성공과 개별 관측 최신성을 혼용해 일부 정적·실패 데이터를 현재 판단처럼 보였다

- **motivation**: 20개 사용자 표면을 실브라우저로 읽고 조작하면서 개별 데이터가 실제 외부 자동수집·갱신 이력을 갖는지, 현재 시장과 맞는지, 알고리즘 입력으로 유효한지 3차 전수 진단했다.
- **root_cause**: 공용 `generatedAt`/fetch 성공을 개별 관측시각과 같은 의미로 사용했다. 그 결과 6월 26일 시장폭이 최근 일반 fetch 시각을 빌려 점수에 들어가고, Telegram 전 채널 실패도 새 `generatedAt`을 써 성공처럼 보였으며, 한국 수급 누락 문자열은 `Number()`를 거쳐 0/매도 방향으로 렌더됐다. 브리핑은 SPY를 S&P 500으로 부르고 존재하지 않는 `chgPct`를 읽었다. 점수 백테스트가 통계적으로 유의하지 않은데도 Buy/매수 밴드가 행동 허가처럼 보였고 비밀키 실값이 password input DOM에 복원됐다.
- **fix**: 시세 producer/consumer에 `regularMarketTime`→`observedAt`, `marketState`, 거래소 시간대를 보존했다. 지표별 freshness budget과 decision-evidence gate를 적용해 미검증 breadth/PCR/AAII를 판단에서 격리했다. Telegram은 `attemptedAt`/`lastSuccessfulAt`/`collectionStatus`를 분리하고 전부 실패하면 성공시각을 유지한다. 한국 수급은 형식화 숫자만 파싱하고 누락 시 값·막대·방향 라벨·기관/프로그램 정적 표를 모두 중립화하며, 한국 지수 소스가 0.75% 이상 충돌하면 오래된 Naver 덮어쓰기를 거부한다. 브리핑은 `^GSPC.price/pct`를 사용하고, 실패한 client F&G가 최신 서버 관측값을 정적 seed로 덮지 않게 했다. 점수 표현·용어사전 기대값·API 키 DOM 보관도 바로잡았다.
- **violated_rule**: R301의 개별 currentness envelope를 F&G에만 엄격히 적용하고 다른 데이터군의 파일 freshness·관측 freshness·수집 실패 의미까지 일반화하지 않았다.
- **prevention**: R332와 LIVE3-01~10이 비밀키 DOM, TDZ, 오래된 breadth, S&P 브리핑, 한국 수급 missingness, 한국 지수 소스 충돌, Telegram 성공시각, 비예측 점수 문구, 거래 관측시각 보존, 실패한 client F&G의 서버 관측값 보존을 검사한다. 22개 데이터 범주별로 source/observed/fetched/status/decision permission을 별도 기록한다.
- **verification**: `public-data/data.json`은 2026-07-14T10:25:27Z 기준 시세 77/77, F&G 44, FRED 19개, 뉴스 40개·8소스를 기록했다. S&P 500 7,515.34(-0.79%), Nasdaq 25,873.18(-1.55%), KOSPI 6,856.83(+0.73%), KOSDAQ 783.98(-1.92%)를 당일 외부 자료와 대조했다. 로컬 Chromium 19 primary+용어사전의 데스크톱·모바일 40렌더에서 pageerror 0을 확인했다. 별도 20초 후 currentness 재검증에서 F&G 44/`cnn-via-github-actions`/VALID 유지, 한국 수급 6값 `—`, 기관·프로그램 표 미수신 상태를 확인했다. Telegram·한국 수급·FMP·breadth/PCR/AAII는 성공으로 승격하지 않고 제한 상태로 남겼다.

## P705 - v52.90 - 시안 구조 검사는 통과했지만 비동기·빈 상태·닫힌 상태의 실제 사용자 여정이 분리돼 있었다

- **motivation**: 20개 사용자 표면의 1차 전수 진단 뒤 실제 사용자가 기다리고, 펼치고, 닫고, 데이터 실패를 만나는 흐름까지 2차로 확인해 구조적 문제를 모두 개선해 달라는 요청이 있었다.
- **root_cause**: 시안 계약과 기존 T869는 초기/최종 DOM의 섹션 수와 기본 노출 밀도를 잘 검사했지만, 외부 요청이 응답하지 않는 기업 분석, 서버 캐시로만 채워진 뉴스 헤더, 잘못된 컨테이너에 놓인 더보기, 닫힌 오프스크린 AI 포커스, 포트폴리오 0건, 한국 수급 실패처럼 `loaded/empty/degraded/closed` 상태 전환의 소유권과 종료 시간을 하나의 사용자 여정으로 검증하지 않았다. 한국 종목 수급은 100+30 연쇄 요청을 허용했고 테마 메모는 최초 요약 뒤 라이브 갱신 함수가 다시 전체 문장을 주입했다.
- **fix**: 기업 분석에 8초 총 예산과 병렬·부분 성공 렌더를 적용하고 0개 소스를 완료로 표시하던 상태를 명시적 실패로 바꿨다. 뉴스 취득 경로를 `_aioUpdateNewsSummaryFromItems()`로 통합하고 더보기를 시장 뉴스 피드로 이동했다. AI 패널은 닫힘 시 `inert`/`aria-hidden`/`aria-expanded`/포커스를 함께 전환한다. 국내 테마는 5종목·260자 기본 밀도를 라이브 갱신 뒤에도 유지하고, 한국 수급은 24개 직접 요청·종목별 프록시 재순회 제거·in-flight+10분 회로·단일 실패 설명으로 바꿨다. 포트폴리오 빈 상태, 브리핑 상단 시장 동인의 영어 원문, 모바일 조작 영역도 실제 상태 기준으로 보강했다.
- **violated_rule**: R329의 최종 렌더 계약을 섹션 노출 여부 위주로 해석했고 R330의 정보 위계를 네트워크 실패·0건·오프스크린 포커스까지 확장하지 않았다.
- **prevention**: R331과 T1015~T1020, runtime contract G2가 페이지 소유권, 제한시간, 단일 뉴스 상태, AI 포커스 경계, 테마 밀도, 빈 포트폴리오, 한국 수급 요청 상한, 브리핑 제목을 함께 검사한다. 표준 정적 게이트와 별도로 로컬 Chromium에서 20개 사용자 표면의 데스크톱/모바일 및 상태 전환 여정을 실행한다.
- **verification**: 최종 변경 모듈 syntax와 정적 12게이트, runtime contract G2, 기본 경로 UX, diff whitespace를 통과했다. Chromium headless **1081/1081 PASS**, 내부 22라우트×4뷰포트 **88/88 PASS**(overflow 0px·tiny text 0·JS error 0), 접근성 22라우트, 핵심 10면, 포트폴리오 vault 8/8을 통과했다. 별도 실제 사용자 여정은 19 메뉴+용어사전의 데스크톱/모바일 **40/40면**과 14개 상태 계약을 통과했으며 pageerror 0, 기업 분석 무응답 5.3초 수렴, 뉴스 12→24개 공개, 한국 수급 실패 대상 요청 26건·중복 경고 0건을 확인했다. 부팅은 FCP 1.07초·첫 라우트 1.40초였다.

## P704 - v52.89 - 사용자 페이지 20개와 내부 QA 라우트 22개를 혼용했고 남은 7면은 시안 정보 위계가 확장되지 않았다

- **motivation**: 13개 시안면은 정리됐지만 사용설명서·용어사전·한국 5면은 긴 기존 구조가 남았고, 검증 결과의 `22 routes`를 사용자 페이지 수처럼 설명해 실제 메뉴 구조를 오해하게 했다.
- **root_cause**: 라우트 계약은 이미 19개 `NAV_ROUTE`, 2개 `DERIVED_VIEW`, 1개 `REFERENCE`, 1개 `OVERLAY`를 구분했지만 UI 개수와 QA 순회 개수를 같은 용어로 보고했다. 시안 확장도 핵심 13면에만 적용해 교육·한국 시장 표면의 밀도 계약이 없었다.
- **fix**: 19개 메뉴 페이지와 용어사전 오버레이를 20개 사용자 표면으로 명시했다. 사용설명서는 검색+장별 아코디언, 용어사전은 267개 항목의 넓은 검색 모달, 국내 테마는 3개 우선 노출+더보기, 한국 홈/매크로는 핵심과 추가 탐색 분리, 수급/기술은 중복 뉴스·페이지 내 용어 설명을 통합 제거했다.
- **violated_rule**: R329의 최종 화면 정보 위계 계약을 13면에만 한정했고, 내부 구현 용어를 사용자 정보구조 설명에 그대로 사용했다.
- **prevention**: R330과 T869가 19 primary + 2 derived + 1 reference + 1 overlay 분류와 남은 7면의 점진 공개 구조를 함께 검사한다. viewport 스크립트에도 22가 내부 QA 라우트 수임을 명시한다.
- **verification**: 남은 7면을 로컬 Chromium 1440×900·390×844로 각각 렌더링해 pageerror 0을 확인했고 용어사전 267개 항목을 검증했다. 사용설명서 기본 높이 6,727→1,079px, 한국 홈 3,262→1,168px, 한국 매크로 4,985→1,803px로 축소됐다. syntax와 11개 정적 게이트, headless **1075/1075 PASS**, 내부 22라우트×4뷰포트 **88/88 PASS**(overflow 0px, JS error 0), 접근성 22 내부 라우트, 핵심 10면, 포트폴리오 vault E2E 8/8을 통과했다.


---

# 압축 원장 (P703 이하 — 원문 전문은 git 히스토리)

## P642~P703 · v52.27~v52.88 (FABLE UI/UX → WP-AI 계약 → 시안 재구축)

- P703 · v52.88 · 정적 시안 정리가 런타임 주입·무제한 목록·기존 재배치 로직까지 제어하지 못함 (R329)
- P702 · v52.87 · 시안을 기본 구조가 아닌 기존 화면 위 장식층으로 적용 — "접어두기"를 "정리 완료"로 취급 (R328)
- P701 · v52.86 · tool mutation·데이터 권리가 registry 게이트 없이 암묵적 (WP-AI19/20)
- P700 · v52.85 · coverage bias·human 사용성 인증이 바이너리 게이트가 아니었음 (WP-AI17/18)
- P699 · v52.84 · model replay·요청 격리에 release/finalization 계약 부재 (WP-AI15/16)
- P698 · v52.83 · retrieval poisoning 품질·금융 conduct legal-review 상태 부재 (WP-AI13/14)
- P697 · v52.82 · 요청 lifecycle·금융 산술이 강제 가능한 계약이 아니었음 (WP-AI11/12, CalculationEvidence)
- P696 · v52.81 · AI 운영/벤치마크/피드백에 단일 로컬 release 계약 부재 (WP-AI8~10)
- P695 · v52.80 · 자동 발행물에 공통 publish fallback 부재 + 페이지 계약에 AI projection 부재 (WP-AI6/7)
- P694 · v52.79 · 외부 데이터·포트폴리오 AI가 action boundary를 무계약 통과 (WP-AI4/5)
- P693 · v52.78 · 연구자료 전량 주입 — intent retrieval·결정론적 context budget 부재 (WP-AI3)
- P692 · v52.77 · typed claim/evidence 검증이 공유 AI 응답 경계에 부재 (WP-AI2)
- P691 · v52.76 · AI 공개 진입점들이 공통 요청/응답 계약 없이 완료·재시도·자동 콘텐츠를 각자 처리 (WP-AI1)
- P690 · v52.75 · 응답 검증이 경고-only, 자동 시장분석이 생성 성공만으로 렌더 — 공개 안전 경계 우회
- P689 · v52.74 · 일반 방문자 부팅이 배포·공유 준비도 전체 감사를 반복 실행 — 초기 페이지 전환 수 초 정지
- P688 · v52.73 · "이미 comp-compliant, 폴리싱만" 자기평가 오류 2회째 — 3페이지 전부 실제 구조 재구축 필요(사용자 직접 지적)
- P687 · v52.72 · 6페이지 "comp-compliant" 재검증 결과 최소 3페이지 오판 + 자체 콘텐츠 소실 버그 2건
- P686 · v52.70 · macro 재구축: 여는 div 삭제/닫는 div 잔존 + 재설계가 제거한 data-snap sink를 요구하는 테스트 충돌
- P685 · v52.70 · technical 재구축: CSS-var-alpha-suffix 클래스 3건 추가 + 전체 컨테이너 치환이 신규 지표 카드를 매 로드 삭제
- P684 · v52.68 · sentiment 재구축: JS 함수의 DOM-shape 의존(wrapper+sibling strong) 보존 필요
- P683 · v52.67 · breadth는 comp 재구축이 아예 미착수였음 + 라이브 호출 UI 함수에 네온 hex·영문 라벨 잔존
- P682 · v52.66 · briefing 스팟체크에서 독립 실버그 6건 (색 스윕 누락·영문 라벨 3·디버그 문자열 노출·dead 참조로 일정 섹션 영구 공백)
- P681 · v52.65 · signal 점수/레짐 섹션이 리디자인 이전 레거시 구조 + 부수 렌더 버그 3건
- P680 · v52.64 · 이모지 제거 후 U+FE0F 고아 variation-selector가 보이지 않는 무명 버튼 생성 — R309 2번째 사례
- P679 · v52.63 · style/id 속성 안 curly quote가 page-breadth getElementById를 조용히 파괴 (기존재)
- P678 · v52.62 · 이모지 일괄 제거 스크립트가 JS 문자열 내 조건 마커를 파괴 — "바닥 확인" 항상 5/5 (R309 신설)
- P677 · v52.60 · T830이 유효한 stale fallback 스냅샷을 거부 — fallback은 방향성·명시적 degraded로 검증 (R308)
- P676 · v52.59 · H2 2차 게이트: 접근성 폰트 계약·route settle 오탐·typed provenance·공개 artifact 종결
- P675 · v52.58 · CDN 소실 시 breadth 초기화가 partial Chart stub 상태로 레지스트리 접근
- P674 · v52.57 · 서드파티 CDN 장애가 리로드 후 로컬 부팅 큐 정지 가능
- P673 · v52.56 · 노트북 차트 고유폭 + silent 외부 피드 실패가 실제 사용자 상태 은폐
- P672 · v52.55 · 만료된 이벤트 서사·입력 결측 레짐이 점수 provenance 수정 후에도 현재형으로 들림
- P671 · v52.55 · F&G 다중 currentness 경로 — 라이브 스트립과 stale 합성값 불일치, stale 값의 점수 유입 가능
- P669 · v52.54 · CODE-MAP 파일 크기 표 무재검증 드리프트(최대 484줄) — ci-doc-currency 게이트 신설 (WO-8)
- P668 · v52.53 · 전역 read/write 인벤토리: timer/chart/page 어댑터는 기존재(갭은 채택률), snapshot adapter 부재, localStorage 직접 146 vs safeLS 8 (WO-7)
- P667 · v52.52 · viewport 게이트가 FULL_INIT=0 report-only — technical SVG 라벨-값 겹침 놓침 → 배포 차단 게이트 승격 (WO-4)
- P666 · v52.51 · lowvol 서브팩터 10년/120종목 백테스트 유의미 음의 상관, composite 전 구간 무의미 (WO-3, 코드 무변경·제품 결정 보류)
- P665 · v52.50 · 스코어 vol+trend+macro(가중 55%) 10년 백테스트 통계적 유의미 음의 상관 (WO-2, 코드 무변경·제품 결정 보류)
- P664 · v52.49 · evidenceAudit: 13개 실입력 중 6개 미등록 + 등록분도 화면 미반영 — 병합 연결 (WO-6)
- P663 · v52.48 · main 브랜치 무보호 + hooks 절대경로 전체 무력화 + auto-commit 과수집 + 버전 정규식 버그 (WO-5)
- P662 · v52.47 · /anthropic 프록시가 방어 전부 우회·호출자 인증 없음·KV 미바인딩 시 캡 무제한 — 계층형 강화+fail-closed (WO-1B)
- P661 · v52.46 · 포트폴리오 "AES-256 암호화" UI 주장 거짓 + PIN 잠금 게이트가 호출부 0건 고아 함수 (WO-1A)
- P660 · v52.45 · data-watchdog.yml mojibake 파손으로 워치독 사망 + 저장소 9,639건 mojibake 발견(7,486 복구) + ci-control-char 게이트 신설 (WO-0)
- P659 · v52.44 · Worker /anthropic anycast 403 자동 재시도 — 채팅·번역·브리핑 3함수 4호출부 (B8 완화, 근본은 CF 리전 미고정)
- P658 · v52.43 · kr-supply 진짜 원인은 프록시 차단이 아니라 404(부재 엔드포인트) + BOK 금통위 날짜 자체 오류 (EF Batch 4)
- P657 · v52.42 · 라벨·번역 정직화 5건 — 시드 시각구분·수급 라벨 모순·소스명 가드·F&G 델타 소스·기준일 배지 (EF Batch 3)
- P656 · v52.41 · 라이브 재검증 결과 발견 절반이 원 진단과 다른 실제 원인·규모 (EF Batch 2)
- P655 · v52.40 · technical/breadth/briefing이 표면마다 다른 값·미래 시각·asOf 없는 서술 (EF Batch 1)
- P654 · v52.39 · 22페이지 교육 레이어(핵심 개념·근본 원리·실전 적용) 공통 부재 → AIO_PAGE_FUNDAMENTALS 신설 (R291)
- P653 · v52.38 · 운영 구조 격차 5건 — 라이브 전용 회귀 재검증 부재·실브라우저 QA 티어 비공식·knowledge-lint 무강제 등
- P652 · v52.37 · Telegram market-note·credit/funding 신호가 수집 후 일부 페이지 표면에서 누락
- P651 · v52.36 · Telegram 최신 뉴스가 페이지별 시장 본질/라이브 감시로 충분히 미연결
- P649 · v52.34 · V0/V1 "완료" 후 잔존 — 브리핑 F&G 3번째 소스 + VKOSPI 실패 UI 부재
- P648 · v52.33 · quote가 DATA_SNAPSHOT.vix만 갱신하고 _fallback.vix stale → T686 배포 차단
- P647 · v52.32 · viewport matrix가 topbar 잘림·SVG 텍스트 기하를 아직 실패시키지 못했음
- P646 · v52.31 · breadth 색상 의미가 렌더러별 분산 — 공포 32%가 비적색 게이지 가능
- P645 · v52.30 · AI 채팅 preflight가 개인키만 인정 — Worker 서버키 모드 미인식
- P644 · v52.29 · 프록시 순서에 누적 성공 증거 부재·quote 카운트 라벨 모호·중복 뉴스 카드 미게이트
- P643 · v52.28 · 프록시 HTML 차단 페이지를 JSON 성공으로 취급·KR 실패에도 대기 UI 생존·값 슬롯 typed state 부재
- P642 · v52.27 · showThemeDetail 유효 데이터 크래시(P0)·theme-detail 고아 라우트·브리핑 F&G 이중 소스·KR 캔들 냉시동 공백 (FABLE V0)

## P553~P641 · v51.82~v52.26 (전면 감사 → FABLE 라이브 감사 시대)

- P641 · v52.26 · VKOSPI 미니차트가 하드코딩 한 달 전 20포인트 배열 — localStorage 누적으로 교체
- P640 · v52.25 · kr-technical 설명문에 제거된 TradingView 잔존 문구
- P639 · v52.25 · 티커 체크리스트 "시장" 점수는 별개 지표인데 라벨 공유로 자기모순처럼 보임 — 라벨 명확화
- P638 · v52.24 · 배포 Worker가 리포 /anthropic 라우트보다 구버전 — 운영자 재배포+시크릿 추가로 당일 해소
- P637 · v52.24 · Claude 번역 실패가 기계번역(Google) 대신 일반 템플릿으로 직행
- P636 · v52.24 · KOSPI/KOSDAQ 전일종가가 미국 휴장 인접 주간 1세션 stale — Naver 파생값 sticky 우선
- P635 · v52.24 · VKOSPI 폴백 시드에 라이브와 동일한 단정 "(정상)" 라벨 → "(폴백·정상 추정)"
- P634 · v52.24 · VIX 기간구조가 live VIX vs stale 시드 VIX9D 비교 — 실제 콘탱고를 패닉 백워데이션 오판
- P633 · v52.23 · 라이브 QA: 사용자 노출 placeholder·raw 소스 라벨·페이지별 모바일 overflow
- P632 · v52.22 · 헤드리스 green이지만 report-only + full-surface 감사가 제거된 brief 기대 + 내부 구현 노출
- P631 · v52.20 · 로드맵 항목이 이미 해소돼 있었음(자기 진단 오류 정정) + VCP server/client parity 게이트 추가
- P630 · v52.20 · 헤드리스 스킵리스트 전량 해소 (899/922→922/922)
- P629 · v52.20 · 추천 다양성 "최근 반복 감점 개수" 카운터가 항상 0
- P628 · v52.20 · signal 섹션 재배치 함수가 작성 시점부터 silent dead code (parentElement 등식 불성립)
- P627 · v52.20 · 스킵리스트 8건이 전부 R279 클래스 — 시점 관측값의 영구 리터럴 단언을 구조 속성 단언으로 재작성
- P626 · v52.19 · index.html의 dead `fetchKrDynamicData` 중복 선언 삭제 + 고아 KR fetcher 5개 개별 endpoint 검증 + 그림자 선언 CI 게이트 (R280)
- P625 · v52.18 · HY 스프레드가 같은 페이지 로드에서 독립 드리프트된 하드코딩 2값 — 단일 출처 위반
- P624 · v52.18 · technical "SPY 포지셔닝" 카드 영구 기본값(3M 0.0%/RSI 50.0) — 데이터 소스 미배선
- P623 · v52.18 · 스크리너 가격 컬럼 90% "—" — 서버가 이미 가진 데이터 미사용
- P622 · v52.18 · theme-detail 브레드크럼 영구 "—" + ETF 표 NVDA "Self" 오라벨
- P621 · v52.17 · 크로스채널 중복 뉴스(같은 실화·다른 채널 라벨)가 3중 dedup 통과 — word-bag 2차 필터
- P620 · v52.16 · ticker cockpit이 포트폴리오 미보유 방문자에게 가짜 P&L 데모 데이터 노출 + 자체 폴백을 파괴하는 DOM 버그
- P616 · v52.15 · 홈 경고 pill 11개 연속 노출 → 1줄 요약+펼치기 (사용자 3안 중 확정)
- P615 · v52.14 · 모바일 390px topbar 우측 버튼 클러스터 잘림
- P614 · v52.14 · 운영자 노트에 "N일 경과" 배지 부재
- P613 · v52.14 · AI 패널 빈 상태 인사 부재 + 페이지 자동 프롬프트가 이동 후 공유 입력창에 잔류
- P612 · v52.14 · 페이지 전환마다 마우스 사용자에게 파란 포커스 링 노출
- P611 · v52.14 · PUBLIC STATUS 카드가 영문 내부 감사 로그 문자열을 방문자에게 노출
- P610 · v52.13 · kr-technical TradingView KRX 하드 브레이크 → Naver 일봉+Chart.js 자체 캔들로 대체
- P609 · v52.12 · "30분마다 자동 갱신" tooltip이 실제 크론 실발화(1~4h)와 불일치
- P608 · v52.11 · briefing 헤더 단어 중간 잘림 — 무말줄임 slice 4곳을 단어경계+'…'로
- P607 · v52.10 · briefing/signal F&G가 어디서도 할당 안 되는 전역 참조 — 영구 "—" (→ window._lastFG)
- P606 · v52.9 · themes 사이클 칩과 본문 판정이 독립 계산 — 실제 모순 발생 (단일 소스 구독)
- P605 · v52.8 · VKOSPI 실시간 fetch가 후행 로드 파일의 중복 선언에 밀려 영구 dead code — 27.00 고정 (R280)
- P604 · v52.7 · MACRO_CALENDAR auto-advance가 요일-고정 발표일(NFP)을 불가능한 요일로 밀음 (R279)
- P603 · v52.6 · 9개 표면 뉴스 번역 사각 — 페이지 스트립/브리핑이 자체 선택 항목의 번역을 미요청 (R245)
- P602 · v52.5 · workflow_run 체크아웃이 트리거 시작 커밋 고정 — 매 봇 사이클이 이전 사이클 트리 검증·배포 (R278)
- P601 · v52.4 · Pages deploy 1회 재시도 — 별개로 보이던 "Run failed" 이메일 2건의 공통 근본
- P600 · v52.3 · marketState 구독 모델 성숙도 검토 + 신규 코드 규율 R276 신설 (Phase 3 완료)
- P599 · v52.2 · computeTradingScore 검증 하네스 구축 (인프라만, 표본 부족 명시)
- P598 · v52.1 · telegram-digest 중복 items 필드 제거 (~46% 감량)
- P597 · v52.0 · 코어 모듈 4종+glossary defer 전환 완료
- P596 · v51.99 · bump-version.mjs가 매 범프마다 _context/CLAUDE.md의 히스토리 버전 참조를 조용히 파괴
- P595 · v51.99 · eager 모듈 심볼 참조 22건 가드 + CHAT_CONTEXTS 소유권 위험 수정 (defer 선행)
- P594 · v51.98 · 스코어 알고리즘 index.html→aio-core.js 이관 (바이트 수준 동작 불변 증명)
- P593 · v51.97 · FRED 확장 시 다른 방법론 지표가 기존 라벨 아래 조용히 교체
- P592 · v51.96 · /data-refresh 전수에서 독립 실드리프트 3건 적발 (기계적 숫자 갱신이면 놓쳤을 것)
- P591 · v51.95 · 30분 데이터 커밋이 CI 미트리거 — 라이브 ~19h 조용한 stale
- P590 · v51.94 · 서버 스크리너 유니버스를 JS 소스 텍스트 문자열 검색으로 추출 (취약)
- P589 · v51.92 · 진단서의 Stooq 폴백 권고가 실제로는 PoW 챌린지 차단으로 불가
- P588 · v51.91 · 900+ 브라우저 테스트 스위트에 CI job 부재 — 사람이 콘솔 열어야 회귀 발견
- P587 · v51.91 · 배당 미조정 종가로 모멘텀/추세 팩터 구조적 과소평가
- P586 · v51.91 · 백테스트 패널이 라이브 composite 검증처럼 표시 — 실제는 고정가중 4팩터 부분집합
- P585 · v51.91 · HY-spread 매핑이 아무도 읽지 않는 합성 FRED id에 기록
- P584 · v51.91 · 서버 Cutler RSI vs 클라이언트 Wilder RSI — 같은 "RSI(14)" 라벨, 다른 숫자
- P583 · v51.90 · _context/CLAUDE.md 이중 인코딩 파손 + CODE-MAP 60버전 stale
- P582 · v51.90 · OneDrive 동기화 충돌로 로컬 .git 파손 (loose objects 2.4GiB)
- P581 · v51.89 · value 팩터가 자연 스케일 상이한 3배수를 비정규화 평균 — 사실상 단일 팩터로 붕괴
- P580 · v51.89 · size 팩터 부호가 학술 SMB 정의와 정반대
- P579 · v51.88 · MACD histogram 앞 8값 isFinite(null) 함정 오염
- P578 · v51.88 · Bollinger 표준편차 분모 모집단 이탈
- P577 · v51.88 · 주봉 청킹 앞-앵커로 최신 1~4일 누락
- P576 · v51.88 · 신용 스트레스 입력이 FRED OAS 실측 대신 듀레이션 오염 HYG 근사 우선 ★반복 클래스 기점
- P575 · v51.87 · OPEX 날짜가 UTC+ 시간대에서 하루 앞당겨짐
- P574 · v51.86 · Sortino 하방편차 분모 비표준 — ~46% 과소평가
- P573 · v51.85 · 개인 FRED 키가 서드파티 CORS 프록시로 평문 전송 가능
- P572 · v51.84 · [skip ci] 데이터 커밋이 CI-gated 배포 이후 라이브 미도달
- P571 · v51.83 · TG scraper self-throttle 부재 — 30분마다 14일 전체 재탐색
- P570 · v51.83 · sentiment 같은 카드에 서로 다른 F&G 2값
- P569 · v51.83 · _aioRenderOperatorNote 3중 정의 (2개 영구 dead)
- P568 · v51.83 · breadth 캔버스 재방문마다 mouseleave 리스너 누수
- P567 · v51.83 · 전역 채팅 패널에 per-page 채팅의 DOMPurify 계층 부재
- P566 · v51.83 · 티커 최근 검색 저장 self-XSS (입력 검증·이스케이프 부재)
- P565 · v51.83 · FRED per-series 실패 완전 silent
- P564 · v51.83 · refresh-data push가 pull/rebase 없이 — 실제 race 발생 이력
- P563 · v51.83 · 오태그 뉴스가 AI 브리핑에서 조작처럼 들리는 섹터 분석 유발
- P562 · v51.83 · breadth 50SMA 큰 숫자가 자기 바/문장과 모순
- P561 · v51.83 · KR 홈 "상위 상승"에 -3.40% 종목
- P560 · v51.83 · fundamental 불가능/자기모순 재무 표시 (독립 근본원인 4건)
- P559 · v51.83 · P553 점수 불일치 클래스 signal 재발 (타이밍 아닌 모드 불일치)
- P558 · v51.83 · Telegram 피드 XSS — 외부 원문 innerHTML 원시 삽입 9페이지
- P557 · v51.82 · GitHub Pages가 CI 결과와 무관 배포 — 깨진 push가 라이브行 (build_type workflow 전환)
- P556 · v51.82 · "jsDelivr CDN 실패" 경고가 사실상 매 로드 오탐
- P555 · v51.82 · CI 33% 실패가 선행 버전 동기화 파손을 무관 커밋들이 상속한 것
- P554 · v51.82 · 홈 "핵심 뉴스"가 자기가 부스트한 항목에서 영구 [번역 대기]
- P553 · v51.82 · 홈 결론 헤더 vs 점수 게이지 숫자 불일치 (스코어 캐시 부재)

## P464~P551 · v49.101~v51.81 (evidence 계약·페이지 currentness 시대)

- P551 · v51.76 · 공개 준비도가 콘솔 감사로만 존재 — 홈 가시 표면화 (R239)
- P550 · v51.75 · 정적 `● LIVE`·rolling 48h 라벨 잔존 (R238)
- P549 · v51.74 · 페이지 currentness 과대표현 + 뉴스 윈도 라벨 드리프트 (R238)
- P548 · v51.71 · calcTechnicalSnapshot 신규 필드가 UI/AI/아티팩트 소비 경로 부분 미연결 (R235)
- P547 · v51.66 · 카테고리별 데이터 기준 시각 추적 부재 — 시간적 비일관성 노출 불가
- P546 · v51.65 · FMP 403/401 플랜 오류 silent — 밸류/퀄리티 팩터 미반영
- P545 · v51.64 · 주말 수집 시 chartPreviousClose로 주간 변동률을 일간으로 오표시
- P544 · v51.63 · DATA_SNAPSHOT *Pct에 주간 변동률 오기입
- P543 · v51.63 · 8개 지수 프로퍼티가 주석 안에 묻혀 미정의
- P535~P542 · v51.44~v51.47 · 스크리너/백테스트 정밀화 6건 — Kalman raw scale·측정노이즈 하드코딩, Bollinger 모집단 분산, stageEstimate Stage2/3 미구분, COMP_W dead key, FAILED_RETEST 미발화, Minervini 설명>계산, watchdog 48h 게이트 부재
- P534 · v51.43 · 시각 위계가 구 터미널 컨셉 잔존 (visual refresh)
- P533 · v51.42 · 라이브 기본 경로 unsafe toFixed (→ _aioSafeFixed)
- P532 · v51.40 · 운영자 노트가 첫 화면 결정 흐름 아래 매몰
- P526~P531 · v51.30 · Maker-Checker 광역 추천 누락·R1 게이트 실패, placeholder 노트·macro overflow, 모바일 폭 누수, 빈 그리드 트랙·접힘 노이즈, workflow summary 문법 파손, 뉴스 랭킹 약체 선정
- P525 · v51.30 · var _SECTOR_KEYWORDS가 const와 충돌 — chatSend 파일 전체 미실행
- P522~P524 · v51.08 · 스크리너 첫 진입 빈 테이블 · CORS 실패 시 뉴스 캐시 빈 배열 덮어쓰기 · krDynamic 스케줄러 세션 전체 silent no-op
- P513 · v50.89 · audit-only 완료 패턴이 semantic gap 은폐 → semantic review 게이트 신설 (R219)
- P514 · v50.89 · workflow helpers/skills가 append-only 메모리로 비대화 → compaction 게이트 신설 (R220)
- P515~P521 · v50.90~v50.98 · T번호 중복/dead·TG memo overlay 미갱신·source-to-consumer CI 계약 부재(P517/R222)·번역 저하·cachebuster 은폐·한국어 rewrite 표면 부재·서버 뉴스 최신순 선정
- P500~P512 · v50.55~v50.88 · 감사 정적 추정 혼재(오탐/은폐)·계약/KST/KR 카드 진실 원천 분열·scope/복합 sink 게이트·채팅 과수렴/과억제/다양성·통합 답변 계약·TG digest 소비 루프·fold 취약 선택자·runtime contract drift·notes without gates·매매 문구 과신
- P482~P499 · v50.9~v50.24 · 동기함수 .catch(silent reject)·_breadth200 폴백 오라벨·sentiment lazy-init 빈 차트·yield curve 영구 대기·themes 정적 진단 모순·스토리라인 전제 역방향·CP stale 읽기·50SMA readout 모순·미로딩 기본값 75·exit trigger 라벨 과장·F&G 페이지간 정반대 결론·breadth verdict 부호 버그·kr-technical undefined 렌더 2건·VaR 이중부호·존재하지 않는 패널 자동전송·SPX ATH 하드코딩 오표시·가상 태스크 참조 no-op
- P481 · v50.6 · breadth participation이 200일선 사유화 (5/20/50만 보는데 200 표시+로직 잔존)
- P464~P480 · v49.101~v50.4 · 근본 규칙 수립 시대 — 중앙 refresh state(R188)·페이지 프로파일 union(R189)·가시 표면 전수 freshness(R190/R193)·강제 fresh preflight(R191/R192)·DataTruthGate(R195)·교차 소스 검증(R196)·DOM 바인딩 검증(R194)·현재 시장 대조(R197~R199)·21페이지 evidence 계약+배포 게이트(R200)·뉴스/텍스트/캘린더 계약(R203~R205)

## P316~P463 · v49.57~v49.97 (AI 채팅 심층 보강·전수 감사 시대 — 시대 요약)

개별 원문은 git 히스토리 참조. 주요 계보:
- **환각 차단**: 시세 실패 시 가격 인용 HARD STOP(P406/P432), 학습 데이터 자기 인용 차단(P397), 날짜 토큰 stale 검출(P403), ABSOLUTE RULES 후처리 검증(P401), 세션 시각 헤더(P388)
- **silent fail 정직화**: dynamicTickerLookup 폴백 체인(P352/P415), chatSend silent return 5경로(P410), callClaude 실패 안내(P411), Promise.all 타임아웃(P321), QuotaExceeded(P424)
- **커버리지/레지스트리**: TICKER_NAME_REGISTRY 47→152+(P316/P339/P428), CIK_MAP 확장(P408계열), CHAT_CONTEXTS DOM 매트릭스 16 부재 발견(P400/P420), options/ticker/market-news/home 컨텍스트 누락(P319/P325/P391/P398)
- **XSS/코드 위생**: escHtml 누락 표면(P433/P434), 정규식 인젝션(P434), var hoist 충돌(P438, P311 클래스), KR 코드 다중 위치 cross-check(P441)
- **fundamental 15기준**: 9/15 학습 의존 발견(P272)→SEC/Wiki 무료 API(P273)→registry+가용성 배지(P275~P281)
- **cell-level 전수**: 구조가 아닌 "값" 정확성 검증(P451/P452), WebSearch 값 상식 검증(P453), DATA_SNAPSHOT stale 스윕(P454~P456), 본체↔_fallback drift 가드(P459), pull-only audit의 push 레이어(P461), on-enter 갱신(P463)
- **운영**: manifest.json 삭제로 SW 캐시 전체 마비(P310 CRITICAL), aio-data.js parse 실패(P311 CRITICAL), API 키 단일 저장소 위험(P312), Claude 키 미입력 silent fail(P329)

## P213~P315 · v49.22~v49.49 (근본수정 registry 시대 — 시대 요약)

- 임계값·라벨 단일 출처(THRESHOLD_REGISTRY/SCORE_SCALES, P220/P224~P228), 가중치 공개(P229), 사이클 동적화(P233), ACTION_RULES/PAGE_PURPOSE(P234~P236), 시나리오 시간 의존(P237), 지정학 단일 출처(P259)
- **메타 패턴 P239**: "인프라만 추가하고 페이지 적용 누락"(R73) — P240~P251에서 23개 항목 페이지 적용으로 상환
- 정적 콘텐츠 lifecycle(P253, Jensen 58일), KOSPI 인라인 괴리(P252), data-snap 바인딩(P258), 페이지 sequential audit 도입(P282~P293), data-action 미정의 핸들러 탐지(P291), LIVE_SYMBOLS coverage(P317/P318 2차 세트)
- ※ P316~P319는 번호 중복 2세트 존재(v49.48~49와 v49.57~58) — 당시 넘버링 실수, 본 원장에서는 병기로만 기록

## P1~P212 · v31~v49.21 (구형 포맷 시대 — 시대 요약)

구형 "BUG-N" 포맷·P41~P144 인덱스는 git 히스토리 참조. 현재도 유효한 핵심 패턴은 QA-CHECKLIST 부록 "반복 실패 방지 특별 체크"와 RULES.md에 흡수됨:
- P24 벌크 data-live-price 자식 파괴 (children.length 체크) · P25 `.pct||0` 금지 (R15) · P28 3글자 미만 키워드 오탐 (R17)
- P41~P68: v42 시대 QA 발굴 — P56 init 이중 cleanup·P57 고정 그리드 모바일 overflow·P58 applyDataSnapshot map↔HTML 역방향·P59 API 의존 전역 초기화 순서·P60 크로스페이지 공유 함수 연결·P61~P63 이벤트 후 텍스트 정합·P64 KNOWN_TICKERS 동시 등록
- P106~P110 UX 실전성 (결론 바·fb-estimated) · P126~P131 아키텍처 감사 (DOM 폴백 불일치·이벤트 중복 dispatch·prompt() 금지·스트리밍 truncation·프록시 cooldown)
- PR-P132~P138 예방적 리팩토링 — onclick 인라인 253건 제거·staleness 감지·sed 치환 범위(3회 재발)·주장-실체 불일치 Hook·canvas CSS var
- P139 scroll-chaining 전 페이지 스크롤 불가 · P140~P143 CDN SRI(R34)·setInterval ID(R9)·R15 재발·_lastFetch 키 불일치 · P144 포트폴리오 벤치마크 커버리지
