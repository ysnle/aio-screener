# 2차 묶음 B — 레거시 코어 (2026-11-04)

브랜치 `wave2-b-legacy` (기준 `integration-20261104` 727912a7). push·bump 안 함. 기록은 `_artifacts/pending-records/wave2-b/01-legacy-core-wave2.json` (v59.70, change-only).

## 한 것

| 단위 | 내용 | 상태 |
|---|---|---|
| L1 (D2) | dev 판정 헤더 렌더러·AI 버튼·CSS 삭제. 부수 효과(epoch 도장, 액션 허브·밀집 컨트롤 접기)는 `_aioRefreshPageSurface`로 유지. epoch 브라우저 게이트는 페이지 속성으로 확인 | 완료 |
| L2 | 텔레그램 피드: 사용자 모드에서 빈 칸에 쓰기 0 | 완료 |
| L3 | 오늘의 질문·서버 데이터 나이 배지 → `src/ui/components/home-status-surface.js`, 로더 → `src/data/operator-note.js` (그대로 이동) | 완료. quota 배지(`aio-ui.js updateQuotaBadge`)는 B 소유 파일 밖이라 안 함 |
| P2 | QA 전용 감사 19개(약 52K 문자) → `js/aio-qa-audits.js`. 새 게이트 `ci-qa-surface-boundary`(기준선에서 실패 확인) | 부분: 계획의 62+6개 중 공개 경로가 부르거나 IIFE 클로저를 공유하는 40개는 남김(목록은 게이트에) |
| P3 | `js/aio-glossary.js` 지연 로드(`src/app/classic-loader.js`) | 부분: aio-workspace(showToast·getApiKey·포트폴리오 리더)와 aio-kr-data(KR_STOCK_DB·KR_THEME_MAP을 부팅 중 entity/screener가 읽음)는 R622 위험으로 안 함 |
| DOM1 | 닫힌 접기 본문 지연 생성(`lazy-fold.js`): 시장 상태 시나리오와 가이드, 매크로 지표 묶음, 테마 단계 표, 뉴스 발표 요약 접기 | 완료 |
| L7 | 저장소 전체에서 참조 0인 함수 5개 삭제(2.9K 문자) | 완료(엄격 기준에 걸린 것은 이것뿐) |
| L0 | `scripts/ci-legacy-writer-probe.mjs` + `architecture/legacy-writer-allowlist.json`(13종/6라우트), route-owners narrativeOwner 7개 라우트 native로 재분류 | 완료 |
| L4 (D6) | 브라우저 뉴스 번역 삭제: `_gtBatchTranslate`(무료 Google 번역), `freeTranslateNews`, `autoTranslateNews`(공용 AI 번역), 지연 큐, `localEnrichSingle`, `_tcPut`·`_tcSaveToStorage`, 뉴스 화면의 `requestShownTranslations`, `#translate-status`. 표시는 생산 단계 `titleKo`가 먼저, `titleKoFailed`면 원문 + '원문' 표시(카드·속보 줄). 새 게이트 `browser-translation-retired`(옛 코드에서 실패 확인) | 완료(D의 9ac5e618 계약 기준). Worker 쪽 `ALLOWED_DOMAINS`의 translate 호스트는 B 파일 밖이라 남김(proxy-continuity가 클라이언트 미러와 같아야 함) |
| L5 (D5) | 한국 통합 블록: 기술 화면 `#kr-integrated-technical`(코스피·코스닥 추세 카드, 한국 종목 입력, dev 텔레그램)과 매크로 화면 `#kr-integrated-macro`(기준금리·금통위·물가·수출·원/달러 1년 범위, 기준일 배지) 퇴역. 기준금리·다음 금통위·물가·수출은 시장 상태 한국 보드의 카드 하나(`src/domain/market/korea-policy.js`), 코스피·코스닥·원/달러는 보드의 기존 카드가 맡는다. 같이 지운 것: `renderKrIndexTrends` 호출, `renderKoreaWon`, `macro-next-release.js`(기준일 배지), `analyzeKrTickerDeep`, `_aioKrTickerSubmit` | 부분: 테마 화면 `#kr-integrated-themes`는 남김 — 한국 테마 단계 표·확정 종가 테마 흐름(native)·종목/스크리너에서 여는 한국 테마 상세가 그 안에 있고, 장중 레거시 블록을 걷으려면 `src/ui/pages/themes.js`(B 소유 밖)도 고쳐야 한다 |
| 포트폴리오 잔여 | `_aioRRPopulateSelect`·`_updateVaultStatus` → `src/ui/components/portfolio-shell-controls.js`(그대로 이동), `aio-workspace.js:758` 빈 상태 목록과 T1019가 `pf-benchmark-section`을 더 이상 부르지 않음 | 완료 |

## 측정

부팅 바이트(배포 번들, `build-pages-bundle.mjs` 같은 빌더로 두 트리):

| | 전 (727912a7) | 후 | 차이 |
|---|---|---|---|
| 클래식 부팅 스크립트 raw | 1,225,679 | 1,071,897 | −153,782 |
| 클래식 부팅 스크립트 gzip | 405,967 | 351,768 | −54,199 |
| aio-core.js raw | 591,564 | 550,074 | −41,490 |
| aio-data.js raw | 314,606 | 309,171 | −5,435 |
| aio-glossary.js (부팅에서 빠짐) | 106,744 | 0 | −106,744 |
| ESM 부팅 세트 raw / gzip | 1,609,748 / 595,887 | 1,614,429 / 597,640 | +4,681 / +1,753 (옮긴 바이트) |

DOM 노드(데스크톱 1440, 라이트, 12초 뒤, 같은 public-data):

| 화면 | 전체 전 → 후 | 페이지 안 전 → 후 |
|---|---|---|
| 오늘 | 2,461 → 2,192 | 235 → 219 |
| 시장 상태 | 4,991 → 3,524 | 2,729 → 1,515 |
| 매크로 | 4,132 → 3,378 | 1,937 → 1,437 |
| 테마 | 9,878 → 7,237 | 7,678 → 5,293 |
| 뉴스 | 4,885 → 3,109 | 2,651 → 1,124 |

## 화면 동일성 (QUALITY-BAR)

`cmp/diff.json`: 5개 화면 × 1440/768/390 × 라이트/다크, 지연 접기를 연 상태 + 용어 사전 열기. 기준선과 이 브랜치를 같은 데이터로 찍어 픽셀 차이(RGB 합 >24)를 셌다. 결과: 31건 중 28건 0픽셀, 뉴스 데스크톱 라이트·다크 각 16픽셀(0.001%, 상대 시각 글자), 뉴스 태블릿은 0픽셀(본문 글자 수 2자 차이, 상대 시각). 용어 사전은 지연 로드 뒤에도 440개 그대로. 대표 비교 `shots/folds-before-after.png`. 시간 기준선 차이 외 화면 변화 없음.

레거시 writer(L0 probe, 19개 라우트, 1440): 남은 것은 home 4, briefing 1, macro 2, portfolio 2, market-news 4 — 나머지 14개 라우트는 0. route-owners narrativeOwner 재분류(signal·breadth·technical·fundamental·themes·ticker·screener → native)는 operations-status.json(라이브 프로듀서 산출물)과 architecture manifest까지 바꿔야 해서 이번에는 하지 않았다.

## 열린 것

- D6: 클라이언트 번역 코드(`freeTranslateNews`·`autoTranslateNews`·`_gtBatchTranslate`)는 그대로 둔다. data-refactor가 표시 헤드라인 전부를 산출물에 한국어로 넣은 뒤 지운다.
- L5: index.html kr-integrated-* 마크업 퇴역은 index.html 소유자 결정이 필요하다.
- boot-budget: 한도를 1,618,000 / 599,000으로 임시로 올렸다(D5 카드 +0.5 KB 포함)(옮긴 바이트, 사유는 `boot-budget.json`). A가 P1 뒤 다시 내린다.
- P3 요청(A): GLOBAL_SCRIPTS를 부팅/지연으로 나누는 일. 이번에 지연된 것은 `js/aio-glossary.js`, 이전부터 지연이던 것은 `js/aio-chat.js`.

## D5 전후 (2026-11-06, 같은 public-data, 12초 뒤)

| | 전 (c0a23a5b) | 후 |
|---|---|---|
| 시장 상태 한국 보드 카드 | 코스피·코스닥·원/달러 | + 한국 금리·물가·수출 (기준금리 3.00%, 8/27 결정, 다음 금통위 2026-11-26, 수출 10월 잠정 1,153억 달러 +93.7%·명절 주석) — 전 매크로 접기의 값과 같음 |
| 문서 전체 DOM 노드(데스크톱) 시장 상태 / 매크로 / 기술 | 3,449 / 3,356 / 2,127 | 3,324 / 3,225 / 1,938 |
| index.html | | −206줄 |

스크린샷: `shots/d5/signal-kr-desktop__before.png`·`__after.png`(보드), `shots/d5/macro-kr-fold__before.png`(퇴역한 매크로 접기), 원값 `shots/d5/before.json`·`after.json`. 보드의 다른 세 카드 글자는 전후 같다.

레거시 writer probe(D5·포트폴리오 잔여 뒤): 13 → 9 (macro 2 → 0, portfolio 2 → 0). 남은 것 home 4, briefing 1, market-news 4.

게이트(D5 커밋 시점, 2026-11-06): contracts 132/136 — 실패 4개(reconciliation·data-lineage·data-refresh·나이 기준)는 기준선 c0a23a5b에서도 실패하는 벽시계 데이터 나이. 헤드리스 1088/1090 — T552·T924는 기준선에서도 실패(T552의 데이터 페이지 수는 4 → 3, 매크로의 마지막 data-snap 칸이 빠져서). architecture·responsive·vault·reference-adoption 브라우저 게이트 통과, legacy-writer probe 통과.

## D6 전후 (2026-11-06, 같은 public-data)

`js/aio-data.js` −553줄(501,573 → 471,530 B raw). 뉴스 화면(데스크톱·폰): 헤드라인 12개 중 한국어 12개로 전후 같음, 첫 다섯 제목 글자 같음, 번역 요청 0건(전후 모두 오프라인), `#translate-status` 칸만 사라짐. 현재 산출물에는 `titleKoFailed` 행이 없어 '원문' 표시는 단위 검사(untranslatedMark)와 T889b(getDisplayTitle)로 확인했다. 스크린샷 `shots/d6/news-*__before.png`·`__after.png`, 원값 `shots/d6/news-facts.json`.

게이트(D6): contracts — 기준선과 같은 벽시계 실패만(reconciliation·data-lineage·data-refresh). 헤드리스 1089/1091(T552·T924 기준선 실패), ai-chat-public-route 통과, browser-translation-retired 통과, legacy-writer probe 9 → 8(market-news `freeTranslateNews` 빠짐).

## 통합(5687a55f) 뒤 잔여 3건 (2026-11-06)

1. 헤드리스 T552·T924: 원인은 L1(dev 판정 헤더 삭제). 헤더의 AI 버튼이 라우트마다 `data-arg=<page>`와 데이터 표지를 실어, 내비 항목이 없는 허브 하위 라우트(briefing·market-news·masters·atlas)와 데이터 페이지 수 감사를 통과시키고 있었다. 감사를 결정에 맞춤: 내비 항목은 `[data-action=showPage][data-arg]` 또는 허브의 `data-hub-routes`, 데이터 페이지는 표지 또는 페이지 epoch 도장(`data-market-revision`). 헤드리스 1091/1091.
2. ESM 부팅 예산(A 한도 1,572,000/585,000, 올리지 않음): 1,572,432/585,790 → 1,550,152/576,630 (여유 21,848 raw / 8,370 gzip). `korea-policy.js`(시장 상태 한국 보드 카드, 닫힌 접기 안)와 `operator-note.js`(첫 호출 때) 지연 로드, 그리고 용어 사전 화면 용어 병합(`screen-term-additions.js`, 약 21 KB)을 용어 사전과 함께 불러오게 바꿨다(P3 뒤 이 모듈은 GLOSSARY가 도착한 뒤에만 쓰인다; classic-loader는 병합이 끝난 뒤 `aio:glossaryReady`를 보낸다). 첫 화면: 5개 화면 × 3 뷰포트 × 라이트·다크 + 용어 사전 열기 31건 모두 0픽셀 차이, 본문 글자 수 같음(`shots/post-int/diff.json`). 한국 보드 '한국 금리·물가·수출' 카드는 지연 뒤에도 같은 값.
   - 주의: browser-boot의 부팅 뒤 지연 JS(6.5초, 한도 350,000)는 통합 기준선에서 이미 359,433로 넘고, 이 변경으로 382,568이 된다 — 같은 바이트가 부팅 세트에서 부팅 뒤로 옮겨진 것(총 다운로드는 같음). 자동화 브라우저는 용어 사전을 바로 불러오기 때문이다. 두 예산의 배분은 A 소유자 판단.
3. 한국 테마 접기(`#kr-integrated-themes`)는 옮기지 않는다. 종목 화면(`stock-read.js` → `openKrThemeDetail`), 테마 상세 내비(`navigation/theme-detail.js`), 스크리너 검증 탭(`screener/validation-tab.js`의 테마 앵커), 테마 마운트 뒤 상세 열기(`themes.js` `_aioOpenKrThemeDetailOnThemes`), 확정 종가 테마 읽기와 상세(`themes/sectors.js` `kr-themes-artifact-read`·`kr-theme-close-detail`)가 모두 테마 라우트의 수명주기에 묶여 있어, 시장 상태로 옮기면 이 링크들이 깨진다.

게이트: affected 프로필 — 실패 5개(scenario-guidance-fixture·data-refresh·browser-boot·artifact-budget·browser-secondary-text-budget) 모두 통합 기준선 5687a55f에서도 실패. 헤드리스 1091/1091, 부팅 예산 통과, 래칫 통과.

## 부팅 뒤 지연 예산 (7c20a830 위, 2026-11-06)

browser-boot 부팅 뒤 지연 JS(6.5초, 한도 350,000, 올리지 않음): 371,757(통합) → **347,713**. ESM 부팅 1,557,163 / 579,785 (A 한도 1,572,000 / 585,000 안).
- 화면 용어 49개 가운데 화면의 용어 표시(TERM_MARKS)가 쓰는 15개를 `src/domain/knowledge/screen-term-marked.js`(부팅 세트)로 옮겼다. 나머지 34개(`screen-term-additions.js`, 순서는 색인 참조로 원래 그대로)는 실제 사용 때 불러온다 — 용어 사전이나 명령 검색을 열 때, 용어 표시에 마우스를 올리거나 포커스할 때, 용어 사전 버튼을 가리키거나 포커스할 때. 불러오면 GLOSSARY를 도착 때 사본에서 원래 순서(전체 추가 → 개념 병합 → 지연 용어)로 다시 만든다.
- korea-policy: 한국 시장 접기를 열 때 불러온다(닫힌 채 시작). operator-note: 부팅 때 홈 카드가 쓰므로 부팅 세트로 되돌렸다(0.8 KB).
- 측정(전 7c20a830 / 후): 용어 표시 9개 라우트 전부 같음(`term-marks__*.json`); 첫 화면 31건 0픽셀·글자 수 같음(`first-screen-diff.json`); 팝오버 첫 열기(클릭) 2 ms / 2 ms; 용어 사전 첫 열기(사용자 경로: 버튼 가리킨 뒤 클릭) 중앙값 201 ms / 203 ms, 항목 440 / 440, GLOSSARY 내용 해시 같음(`popover-glossary__*.json`). 가리키지 않고 바로 `openGlossary()`를 부르면 126 → 198 ms(청크 로드).

게이트(affected): 실패 4개(scenario-guidance-fixture·reconciliation·data-lineage·data-refresh) 모두 7c20a830에서도 실패. browser-boot 통과.
