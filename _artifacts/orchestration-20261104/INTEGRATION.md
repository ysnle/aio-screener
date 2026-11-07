# 통합 체크리스트 — 2026-11-04 오케스트레이션 배치 (v59.70)

오케스트레이터가 관리한다. 하위 세션 보고에서 통합 때 할 일만 모은다.

## 브랜치

| 세션 | 브랜치 |
|---|---|
| actions-reliability | `refs/heads/claude/actions-reliability-103060` |
| theme-sector | `refs/heads/claude/theme-sector-86e4f9` |
| ui-states | `refs/heads/claude/ui-states-f0308e` |
| data-refactor | `refs/heads/data-refactor` (커밋 전) |

커밋: theme-sector 완료 eccbd5d5·506f2ab8·3712305b (records 01~10, QA 103 pass) / actions-reliability 69f83d4e·06ffecb8·4c571994(I8 라이브 단언 ADVISORY, qa-pipeline.json 183 gates)·a4df0f1b(제어문자 advisory 훅, R11 rotation-detail.json 워크플로) / theme-sector eccbd5d5 (+40511edc 제어문자 cherry-pick) / ui-states 97c58be9 (제어문자) + c6191ee5 (완료, QA 145 pass, matrix 96장 bad 0, pending P2219). 세 브랜치의 reaction-read.js 수정은 바이트 동일 — 하나만 남긴다.

## 통합 순서와 할 일

**방침(소유자 2026-11-04): 1차·2차 전체를 끝낸 뒤 커밋·push 한 번.** 조기 push 없음. 1차 통합 브랜치 `integration-20261104`(actions-reliability 담당) → 2차 묶음은 그 위에서 → 최종 통합 → 독립 리뷰 → 전체 QA → bump-version·apply-pending-records → 한 번 push(오케스트레이터). 그 전까지 라이브는 v59.68에 머문다(데이터 봇 커밋은 쌓이나 attest 실패로 배포 안 됨).

0. 조기 push 완료: 432ac3eb → origin/main (05414add..432ac3eb, 오케스트레이터 세션, 소유자 "여기서 push"). 이전 메모: auto mode 분류기가 actions-reliability 세션의 push를 거부. 준비된 커밋 432ac3eb (`.claude/worktrees/early-push-69f83d4e`, origin/main 05414add 위, preflight 12/12). 통합 때 actions-reliability 브랜치는 origin/main 위로 rebase(69f83d4e 자동 생략). 원래 메모(소유자 승인 2026-11-04): actions-reliability 69f83d4e만 origin/main 위로 — 라이브 정지 (A) telegram 'deal' 종류 semantics + (B) reaction-read 0x08 해소. 통합 때 이 변경과 다른 브랜치의 같은 수정(97c58be9, 40511edc)이 중복되지 않게 정리.

1. ui-states `97c58be9` (reaction-read.js 0x08 제어문자 수정) — 한 번만 반영. 다른 브랜치가 cherry-pick했으면 중복 확인.
2. actions-reliability 병합 → `src/data/freshness.js` (`readArtifactFreshness`) 확정.
3. ui-states 병합 → `src/ui/components/freshness-badge.js`의 import를 `../../data/freshness.js`로 바꾸고 `src/data/freshness-fallback.js` 삭제.
4. theme-sector: `session-lag.js` 기준일 → `readArtifactFreshness`, 칩 → `freshnessBadge`, 빈 상태 → `renderDataState`, above50Pct 2곳 → `breadthCounts`. R11 trail 파일 경로를 actions-reliability의 `refresh-data.yml` 커밋 목록·신선도 ledger에 넣었는지 확인.
5. data-refactor 병합 → `pages-deploy.yml` 배포 제외 블록과 actions-reliability 변경 충돌 확인.
6. `_artifacts/pending-records/*/` → `node scripts/apply-pending-records.mjs --dry-run` 후 v59.70 기록.
7. `bump-version 59.70` → `generate-workspace-state --write` → qa-runner affected (백그라운드).
8. 독립 리뷰(cstack review) → 소유자에게 push 확인.

## 공용 계약

- 신선도: aio-freshness.v1 — producedAt · checkedAt · basisSession{US,KR} · expectedEveryMinutes · staleAfterMinutes · workflow · producer · lastAttempt{at,status,error}; `public-data/freshness/<workflow>.json`.
- 상태: `renderDataState`/`dataState` (+ `timeoutMs`, 기본 20000).
- 배지: `freshnessBadge(doc, freshness, { market, degraded })`.
- 강등: data.json 레코드 `allowedUse: 'reference-only'` + `allowedUseDeclared` · `allowedUseDegradedBy`.
- data.json `policyRates.fed`: + decision · decisionDate · changePp · previousUpper.
- regime: + `watchAxes` [sentiment, leadership] (axes와 같은 모양; axes·counts·overall 불변). market-story STORY_SESSIONS 15 → `MARKET_WINDOWS.week`(5).
- 겹침: `src/ui/components/market-regime.js` — ui-states(import 1줄 + historyWaitText 2줄)와 data-refactor(표 렌더·AXIS_* 항목). 다른 줄이라 자동 병합 예상, 통합 때 확인.
- kr-investor-flows.json: 원천 Naver, investors + individual·institution, 최상위 allowedUse, statCode 제거; 실패 시 이전 유지 + stale('지연').
- 겹침: `src/ui/components/korea-participation.js` — ui-states(pending 숨김, 안내 문구 삭제)와 data-refactor(출처 칩·source-kind·기준 문단 → view 필드). 통합 때 '한국은행' 하드코딩이 남지 않았는지 확인.

## 통합 뒤 2차 배치

- `_artifacts/perf-legacy-plan-20261104/PLAN.md` (coverage-audit 세션이 설계): 성능 TARGET_MISS, 레거시 서술 경계, 스크리너·종목·포트폴리오·리서치·전역 검색.
- 문서·스킬: CODE-MAP 재스캔(knowledge-lint 46일 실패 해소), "8화면" 표기 정리. verify-aio charts·9 screens는 ui-states에서 완료.
- 2차 묶음 배정안(새 세션 시작이 원격에서 막혀 유휴 세션 재사용, 통합된 main으로 동기화 뒤 시작):
  A 부팅·측정 → actions-reliability / B 레거시 코어 → coverage-audit(EnterWorktree) / C 스크리너 → theme-sector / D 종목·포트폴리오 → data-refactor / E 리서치 콘텐츠 → data-refactor 뒤 또는 데스크톱 앱에서 새 세션 / F 검색·셸 → ui-states.
- 2차 소유자 결정 D1~D8: PLAN.md §5 — 소유자 "권장안대로 모든 작업 진행"(2026-11-04): D1 AI corpus·aio-chat은 AI 버튼 hover·focus 때 받기 / D2 dev 판정 헤더 삭제 / D3 스크리너 JSON 불러오기·저장 dev 전용 / D4 Ctrl+K → 명령 검색, 표 필터 `/` / D5 한국 통합 블록 → 시장 상태 한국 보드로 모으고 나머지 퇴역 / D6 뉴스 번역 Worker(Workers AI) 이전 / D7 4단계 측정 뒤 결정 / D8 리서치 본문 `content/research/*.json` 이전 동의.
- 소스 push CI 구조 변경 승인: liveData:content·knowledge-lint 날짜 → push CI ADVISORY, 차단은 프로듀서 push 전·watchdog (actions-reliability). auto mode 분류기가 [CI Bypass]로 거부 — 소유자가 actions-reliability 세션에서 직접 승인해야 함(오케스트레이터가 대신 하지 않음).
- 통합 사전 병합(389806b6 위, 버림): AR(c3082fc5)·ui-states 충돌 0, theme-sector는 `_context/CURRENT-STATE.md`만 → `checkout --ours` + `generate-workspace-state --write`. reaction-read 0x08 0개, rotation-detail 줄 1개씩.
- CODE-MAP 재검증 push 완료: 389806b6 (9da5c8ba..389806b6).
- 보류(가능성 낮음, CLAUDE.md 경계 사례 규칙): observationSessionState가 개장 전 관측값을 그날 세션으로 셈 — model-check 대상, 소유자 동의 뒤.

## data-refactor 완료 보고 (미커밋, worktree `data-refactor`)

- 전 항목 완료, affected 166 PASS / 3 FAIL(벽시계·CODE-MAP), model-check history-session·narrative PASS, records 7건(P2219 R5, P2220 이월값).
- 통합 때: korea-participation loading·failed·unavailable 문구 '한국은행 자료' → renderDataState; reaction-read는 `cherry-pick -n 97c58be9`이 작업 트리에만 있음; decomp ratchet 감소(aio-core −70) `--write` 고정 여부 결정.
- 워크플로 변경 2건(refresh-screener BOK→Naver, research-backtest 검증 게이트) → actions-reliability.
- 조기 push 432ac3eb CI 41761300575 실패: data-lineage·data-refresh(13.6h SLA, 정지 탓) + knowledge-lint(CODE-MAP 46d).

## data-refactor putCall 퇴역 (미커밋 → 커밋 요청)

- 통합 때: `cherry-pick 97c58be9` 작업트리분 정리 / reconciliation-status.json 병합 뒤 재생성 / 임시 코드 2개 삭제(market-read `alignments.pcr = alignInput(null, basis)`, RULES.credit.putCallHedgeAt·putCallOptimismBelow — ui-states sentiment-board.js 카드 삭제와 함께) / Worker 재배포(cdn.cboe.com 허용 목록 제거) / AGENTS.md 무료 원천 목록 CBOE 제거를 OWNER-DECISIONS에 기록 / trading score v6 골든 재기준(bull 79→82).
- 남은 것: SOXX 전환(결정됨, 처리 대기).

## x-bookmarks dc5a42fc (`claude/x-bookmarks-285c89`)

- 25건 전부, 판단 틀 4개, 21영역 대조, 구현 제안 12건(PACKET.md §4). 1차 통합에 포함.
- 제안 배정: #2·#7 → theme-sector(지금) / #5 → data-refactor(SOXX와 함께) / #1·#3·#4·#6·#8·#11 → data-refactor(2차) / #10 → 2차 charts / #9 안 함(새 수집 필요, 낮음) / #12 한국 장중 문장 안 함(미국 우선, 소유자 결정 전).
- actions-reliability 구조 변경 28dfc451(소유자 직접 승인): CI contract 전체 AIO_QA_ORIGIN=ci, liveData·knowledge-lint 날짜 ADVISORY, watchdog twin 4, R634 재작성, contracts 136/136. 브라우저 fixture(AIO_BROWSER_DATA_ROOT) + watchdog 브라우저 → 2차 A.
- 2차 E(리서치 콘텐츠) → x-bookmarks 세션 재사용.
- theme-sector 6095f1cc: #2 '고점 근처' 지표 탭(11섹터, S&P 500 GICS, 5% 안 비율), #7 층별 후행·선행 PER 접기(14층, 커버 부족 2층 제외). 기록 12·13. `.news-sort-btn:disabled`는 ui-states 병합으로 해소(ui-states.css:32).
- x-bookmarks 658c3b29: 새 노트 문구 수정, 제안 12건에 화면 한 줄.
- coverage-audit: 검수 하네스 준비(scratchpad `run-audit.sh <worktree> integration`, 120페이지, 약 20분).
- data-refactor 79209cf6 (`refs/heads/data-refactor`): SOXX 대리 전환(5일 낙폭 6%, 50일 완충 2%, 동일가중 지연 7pp, aibust 10pp, 급락일 4.5%), X #5, put/call 잔존 정리, 화면 점검. 20거래일 비교: 종합 10/13 하루만 변함. records 9건 dry-run OK. reaction-read 변경 포함(97c58be9 cherry-pick은 빈 변경).
- **push 직후 refresh-data 수동 dispatch** — 첫 refresh 전까지 SOXX history가 비어 AI 행 '확인 불가'·leadershipCap 빠짐.
- ui-states a4b1b481(딥링크 5354fdc8, 게이지 부호·SVG 라벨 f059f381·4b213204, 품질 a4b1b481).
- 1차 통합 시작 신호 보냄 → actions-reliability (5개 브랜치). ui-states 끝은 83c76100(정정 전달). hotfix-render 기록은 ui-states 브랜치에 있음; `hotfix-render-20261104` 브랜치·worktree는 미커밋 동일 바이트 — 최종 정리 때 삭제.
- 남은 화면 문제(ui-states 보고): 휴대폰 매크로 '지금 숫자' 값 열이 좁아 3줄 접힘 → 검수 목록에.

## 1차 통합 결과 (integration-20261104 140ba22c, origin/main 8f324ec7 기준)

- contracts 137/2, browser 29/5. 충돌은 data-refactor(fetch-data.mjs 등)만, 해결. session-lag 미연결(원장 행에 기준 세션 없음). 빈 freshness 원장 2개 추가(404 제거).
- 결함: theme-detail id 없음 → 목록(게이트 5개 갱신, 텍스트 예산 확인) + THEME_PLAYBOOK_VERSION → theme-sector `fix-r1-theme` / boot-budget +3.7KB raw → 사유 기록하고 임시 상향, 2차 A P1 뒤 원래 한도로 되돌림(actions-reliability).
- Worker: cloudflare-worker-proxy.js cdn.cboe.com 제거 → 최종 push 뒤 Deploy AI proxy.
- pending records 36건 → v59.70, P2219~ 중복 없음.
- 화면 전수 검수 시작 → coverage-audit.

## 2차 배치 진행 (기준 integration-20261104 140ba22c)

| 묶음 | 세션 | 브랜치 | 상태 |
|---|---|---|---|
| A 부팅·측정 + 브라우저 fixture | actions-reliability | wave2-a-boot | P1 완료(6.5초 JS 3.92→3.04MB), P0, P4 1단계(boot 1,610→1,563KB, 한도 1,572,000/585,000로 복귀). fixture A′: 고정 SHA의 배포 매니페스트 파일 + 시계 이동 + 스키마 지문 게이트 + watchdog-browser |
| B 레거시 코어 | coverage-audit | wave2-b-legacy | 시작 |
| C 스크리너 | theme-sector | wave2-c-screener | 58eabba5(검수 6건 완료) + AI 패널→조건 연결, 죽은 CSS, themes.js 분할 |
| D 종목·포트폴리오 + 데이터 후속 | data-refactor | wave2-d-entity | 5e0e0923, QA 분류 + 검수 결함 |
| E 리서치 콘텐츠 | x-bookmarks | wave2-e-research | 2bb5fa47, 검수 결함 3건 |
| F 검색·셸 | ui-states | wave2-f-search | 1edd18ad, 검수 결함 |

- 사고(theme-sector worktree, 되돌림): `apply-pending-records.mjs --help`가 실제 적용 실행 → A에 기록·버전 스크립트 인자 안전장치 배정. **최종 기록 전 반드시 반영 확인.**
- A 추가: bootstrap 자료 실패 즉시 오류 상태. E 추가: masters.js 1,644줄 → 1,200 아래.
- fix-r1 통합 완료: integration-20261104 **ff35bf0f** — contracts 139/0, browser 6그룹 전부 green. A는 ff35bf0f에서 시작(+ 브라우저 게이트 고정 포트 → 포트 0).
- D6 결정(오케스트레이터): 브라우저용 번역 경로를 만들지 않는다. data-refactor가 생산 단계에서 모든 헤드라인을 한국어로 번역해 넣는다(#12 확대). 그 변경이 2차 통합에 들어오면 B가 클라이언트 번역 코드를 지운다. Worker 변경은 없다.
- 화면 검수(140ba22c): 36건(상 3·중 17·하 16) → `REVIEW-ASSIGN.md`. fix-r1-theme·fix-r1-boot → 통합 브랜치에 병합 지시.

- 계약(E→F): `searchKnowledgeIndex(index, query, limit=8)` · `loadKnowledgeIndex(fetchFn?)` → `{entries}` · `KNOWLEDGE_INDEX_URL`. learning-core 정적 import 제거.

## 1차 통합 뒤 수정 목록 (검수 결과와 함께 배정)

- ui-states: `page-sources.js:26` '풋/콜 비율: Cboe' 삭제 / 매크로 발표 띠 '조금 높음' 390 잘림 / 한국 수급 대기 문구('한국은행 발표', '개인·기관 공개 출처 없음') — ui-states 브랜치에서 이미 삭제, 병합 결과 확인.
- data-refactor: '연결해서 보면' HY 20거래일 +32bp vs 신용 행 '20일 +34bp' — 같은 지표 다른 창, 단일 출처로.
- 권고(소유자 "권장안대로"): 판정 밖에 남은 SMH(홈 반도체 게이지, index-levels 차트, day-account, cross-asset, reaction-read, market-flow 성장 묶음)도 SOXX로 통일 — 2차 data-refactor.

## 배포 교착 2단계 (03:00Z)

- 389806b6 push CI 실패: browser-surface(gauge-bar.js:63 '+0.0%' negative-zero, dxy20≈0.03)와 browser-viewport(fxbond svg 라벨 겹침 3.9% / 4.03, desktop 3종). 02:54Z 새 데이터에서 처음 드러남.
- 핫픽스 → ui-states, `hotfix-render-20261104`(origin/main 기준) → 오케스트레이터 push(소유자 승인 필요).

## ui-states 후속 be797a9e

- 풋/콜 화면 퇴역(심리 카드 5→4, 용어·출처·AI 제안 정리), S9 국채 곡선 라벨, S14 차트 실패 문구, S24 `frameSection({contract:'story'})` + 게이트. S3·S2는 근거 있어 미수정. QA 140 pass.
- 잔여 pcr(market-read.js·composite-fear-greed.js:121·cross-readings.js) → data-refactor. `#technical/AAPL` 딥링크 결함 → ui-states (aio-core showPage·resolveInitialRoute는 theme-sector bd4f89b0과 겹침 주의).

## 배포 교착 (2026-11-04 03:00Z)

- 9da5c8ba(데이터 02:54Z)는 attest 실패: 소스 432ac3eb의 full push CI가 red(data 나이 + CODE-MAP 46d). 재실행으로는 풀리지 않음.
- 해소 커밋: `refs/heads/claude/codemap-reverify-20261104` 1f77315f (CODE-MAP 실측 재작성 + CONTEXT-CATALOG, knowledge-lint OK, preflight·workspace 12/12). push 전 origin/main 위로 다시 올릴 것, 9da5c8ba 기준 14:54Z까지 data SLA 통과.
- actions-reliability 브랜치 rebase 완료: 466072c0·072e4bbd·9f3c2fda·c7fff283 (69f83d4e 자동 생략).
- 구조 권고(소유자 결정 대기): 소스 push CI에서도 liveData:content 게이트와 knowledge-lint 날짜 기준을 ADVISORY로, 차단은 프로듀서 push 전·watchdog에서.

## 결정 기록 (2026-11-04)

- putCall: Cboe 수집 중단·사이트에서 제거(약관) — data-refactor(프로듀서·데이터·이력), ui-states(화면).
- 한국 UAM·우주·양자 퇴역 유지.
- 'AI 주도' 대리 NDX → SOXX(소유자 변경, SMH 아님; 지연 기준은 SOXX·SMH 변동성 비교로 재산정), SOX는 데이터만 — data-refactor.
- x-bookmarks 세션(local_07840efc, 브랜치 x-bookmarks): /i/history 북마크 → 지식·AI 문맥·리서치 콘텐츠. 다른 소유 영역은 구현 제안으로만.

## 열린 질문

- 해결: checkedAt은 data.json과 같은 커밋으로 나가 커밋·배포 수가 늘지 않음 (actions-reliability, (a) 감수).
- actions-reliability: 11/3 12:56Z 이후 라이브 data.json 정지 — 원인과 조기 push 필요 여부.
- 결정: 테마 구성 3건 권고안대로 (2026-11-04) — theme-sector 반영 완료. 확인 필요: 한국 UAM·우주도 최소 3종목 규칙으로 퇴역(28→25, 되돌림은 js/aio-kr-data.js 한 커밋).
- `.news-sort-btn:disabled`는 ui-states c6191ee5(ui-states.css:32)에 있음.
- 후속 결함(기존): 옛 `#theme-detail/<id>` 주소가 어느 테마든 defense로 감 → theme-sector bd4f89b0으로 수정(classic showPage·resolveInitialRoute의 THEME_MAP[0] 대체, 전수 게이트, 기록 11).
- 소유자: putCall(Cboe 403, 대체 원천 없음) 처리, Claude 훅 control-char advisory 승인.
- data-refactor: 'AI 주도' NDX→SOX 전환 — 20거래일 판정 차이 보고 후 소유자 결정.
