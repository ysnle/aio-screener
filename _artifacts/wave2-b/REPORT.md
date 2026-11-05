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
| L4 (D6) | 뉴스 번역 | 오케스트레이터 결정: 브라우저 경로 없음, 생산 단계 번역 뒤 클라이언트 번역 코드 삭제(B 마지막 단위, 시점 통보 대기) |
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
