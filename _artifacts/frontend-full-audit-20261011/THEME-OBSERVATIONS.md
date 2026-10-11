# THEME-OBSERVATIONS — AIO Screener `#themes` / `#theme-detail`

- 실행: 2026-10-11 (일) · 마지막 미국장 2026-10-09 (금) 종가 기준
- 방법: Node+Playwright 스크립트 1개(`scratchpad/theme-audit.mjs`) 1회 실행, 라우트당 렌더 대기 5초, 대화형 브라우징 없음
- 스크린샷(2장): `_artifacts/frontend-full-audit-20261011/theme-themes.png`, `.../theme-theme-detail.png`
- 원본 캡처: `scratchpad/theme-run.json`(DOM 추출), `scratchpad/expected.json`(데이터 기대값)
- 등급: **A=0 · B=2 · C=3 · D=4 (총 9)**

## 데이터 기준(basis)

| 소스 | 경로 | 값 |
| --- | --- | --- |
| 회전 아티팩트 | `public-data/data.json:rotationHistory` | rrg.v2, `latestCompletedSession=2026-10-09`, `status=CURRENT`, 31 심볼 |
| 시장 스냅샷 | `public-data/market-snapshot.json` | quotes 16건 = 지수/변동성/FX/금리/원자재/크립토 · **섹터 필드 없음** |
| 스크리너 | `public-data/screener.json:data[SYMBOL]` | 3개월/1개월 흐름·브레드스 |
| 히스토리 | `public-data/history.json` | array(420), RRG 네이티브 계산 입력 |
| 라이브 시세 | — | `meta.quotesPublished=false`, `quotePolicy=client-direct-fetch-only(P715)` → 브라우저 직접 수신 필요 |

## 발견

### THEME-B1 · B · `#themes` — 같은 테마, 다른 라벨
- 위치: RRG 칩 `XLV 헬스케어 +1.58%` → 상세 패널 헤더 `헬스케어/제약 · XLV`
- expected: 테마 id=healthcare의 라벨은 단일 소스여야 함 — `window.THEME_MAP[healthcare].name = '헬스케어/제약'`
- actual: 칩은 `헬스케어`, 패널은 `헬스케어/제약`. 동일 패턴 XLP(칩 `필수소비` ↔ 정의 `필수소비재`)
- 수정: sectors/themes 정의 라벨 통합 또는 칩에 정식 라벨·ETF를 title로 노출 · 확신도 중간

### THEME-B2 · B · `#themes` 상세 패널 — 기준일 두 개가 설명 없이 병기
- 위치: `#theme-detail-native-summary` provenance 행 `시세 관측 · AIO 참고 테마 분류 · 구성 기준 2026-10-10`
- expected: 가격 basis는 `rotationHistory.latestCompletedSession=2026-10-09`; 구성 기준은 세션 또는 분류 버전으로 표기
- actual: `2026-10-10`은 **토요일(비거래일)** 이며 아티팩트 생성일(`data.json:meta.artifactGeneratedAt=2026-10-10T15:23:15Z`)과 동일 → 독자가 가격 기준일을 10/10으로 오독
- 수정: `가격: 2026-10-09 미국 종가 · 분류: 2026-10-10`처럼 basis를 이름 붙여 분리 · 확신도 중간

### THEME-C1 · C · `#themes` — 섹터 성과 바에 기준일 없음
- 위치: `#sector-perf-bars`(11행) + `#sector-perf-analysis` 문장
- expected: `data.json:rotationHistory.items[SYM].dailyPct` / `sessionDate=2026-10-09`
- actual: 바·요약문 어디에도 날짜 없음(`1일 가격 성과`). 페이지 내 유일한 날짜 표기는 별도 블록인 하위 테마 순위의 `10/9 미국 종가 기준`, 사분면 범례는 `완료 종가, 30거래일 이상`
- 수정: 섹션 헤더에 `10/9 미국 정규장 종가 기준`(동적) 배지 · 확신도 높음

### THEME-C2 · C · `#themes` 상세 — 상태칩 `시세 관측` vs 전 필드 `시세 대기`
- 위치: provenance 첫 항목 + 대장주 26종목/브레드스/스프레드/벤치마크
- expected: 라이브 시세 0건(`quotesPublished=false`) 상태에서는 `완료 종가 기준`이라고 말해야 함
- actual: `시세 관측` 단정, 같은 패널의 모든 가격 필드는 `가격 대기 / 등락률 대기 / 시세 대기`
- 수정: produced-rotation 기반일 때 `완료 종가 기준(10/9)` + `라이브 시세 대기` 칩 분리 · 확신도 중간

### THEME-C3 · C · `#themes` — 한국 테마 블록 기준일 없음
- 위치: `#kr-themes-summary` = `한국 시장 — 국내 테마 (KRX 28개 중 28개 테마를 완료 종가로 비교)`
- expected: KR 완료 세션 명시 (참고: `market-snapshot.json:market.index.kospi.observedAt=2026-10-08` — KR 지표 기준일이 10/9가 아님)
- actual: 날짜 없이 `완료 종가`만 표기, 미국 기준(10/9)과의 세션 차이 정보 없음
- 수정: `KR 10/9 · US 10/9` 형태 병기 · 확신도 중간

### THEME-D1 · D · `#theme-detail` 딥링크가 상세 화면을 렌더하지 않음
- actual: 해시 `#theme-detail`에서 표시 페이지 = `page-themes`, `page-theme-detail`은 `display:none`, h1 없음. 상세 패널은 직전 세션 선택(`healthcare`) 상태를 유지 → URL이 내용을 결정하지 못함
- expected: URL로 결정되는 상세 화면 또는 명시적 안내
- 수정: `#theme-detail/<themeId>` 파라미터화, 선택 없으면 선택 안내 상태 렌더 · 확신도 중간
- caveat: 같은 문서 hash 내비게이션으로 검증(콜드 로드 미검증 — 하단 blocked 참조)

### THEME-D2 · D · 상세 패널에 닫기 컨트롤 부재
- actual: `#theme-detail-panel` 내 유일한 버튼은 `← 선택한 목록으로`. `data-action*=close` / `.theme-detail-close` 검색 0건 → `aio:themeDetailClosed`를 발생시키는 UI가 없음
- 대체 검증: 에너지 → 헬스케어 재선택 시 **잔상 없음**(이전 테마 라벨·수치 잔존 0, `data-current-theme=healthcare`로 갱신)
- 수정: 패널 헤더 X 버튼 + 이벤트 연결, 복귀 링크는 스크롤 복귀용으로 유지 · 확신도 중간

### THEME-D3 · D · 당일 선도 섹터 XLK(기술)는 상세로 이어지지 않음
- actual: XLK 칩은 `summary-only`(점선) → 클릭 시 하위 테마 순위로 스크롤. 상세 제공 10/11
- 근거: `src/ui/pages/themes.js:resolveThemeDetailId` — `THEME_MAP`에 etf/compositeBase=`XLK`인 테마가 없어 null
- 수정: 기술 섹터 상세(또는 XLK 하위 테마 상위 5) 제공 · 확신도 높음(의도된 동작이나 사용자 경로 단절)

### THEME-D4 · D · 숨은 레거시 상세 페이지에 상태 배지 잔존
- actual: DOM에 `판단 보류 · 데이터: 미수신 · 공통컷 지연 10/10/08:00 KST · 시점 불일치` 텍스트가 남아 있으나 같은 URL의 네이티브 패널은 10/9 데이터를 정상 표시 → 문구 충돌
- 수정: 배지 제거 또는 실상태 연결(`live 시세 미수신 · 완료 종가 10/9 표시 중`) · 확신도 중간

## 확인 포인트 결과

1. **섹터 성과 바 ↔ market-snapshot 섹터 값·기준일 — 대조 불가(BLOCKED), 대체 근거로 전수 일치.** `market-snapshot.json`에 섹터 데이터 없음(`sectorKeys=[]`). 대신 `data.json:rotationHistory.items[*].dailyPct`(2026-10-09)와 대조 → XLRE 1.86 · XLV 1.58 · XLY 1.02 · XLF 0.92 · XLU 0.83 · XLK 0.51 · XLI 0.50 · XLB 0.32 · XLP 0.01 · XLE -0.25 · XLC -1.51 (오차 0, 11/11). 사분면 배지도 11/11 일치(선도 XLK·XLE, 약화 XLV, 후행 8).
2. **카드 → 상세 동일 테마 — PASS.** `XLE/energy` → `에너지 · XLE -0.25%`; `XLV/healthcare` → `헬스케어/제약 · XLV +1.58%`. 테마 id·ETF·등락률 일치, 불일치 0건 → **A 없음**.
3. **상태칩 — 부분 불일치.** `#theme-cycle-pill` `선도·개선 2/11 · 약화·후행 9/11` = rotation 사분면 집계와 정확히 일치, `#rrg-chart-status` `선도:2 개선:0 약화:1 후행:8 · 약세 주도` 동일. 단 provenance `시세 관측` 충돌(THEME-C2), KR 기준일 미표기(THEME-C3).
4. **`#theme-detail` 딥링크 — 부분 실패.** 테마 대시보드가 렌더되고 상세 페이지는 hidden, 패널은 세션 상태 의존(THEME-D1·D4).
5. **수치·날짜 대조 — `#themes` 값 10/10 일치, 기준일 표기 부분 결손.** 일치: 섹터 11값 · pill 2/11·9/11 · rrg 2/0/1/8 · 하위 테마 `10/9 미국 종가 기준`(= `latestCompletedSession`). 결손: 섹터 바 기준일(C1) · KR 기준일(C3) · 구성 기준일(B2). `#theme-detail`: XLV +1.58%(=rotation), 리더 `LLY·JNJ·ABBV·MRK`(= `THEME_MAP[healthcare].leaders`), 7개 서브테마 구성 종목, flow 3개월 `+26.8% ~ -5.5%` — 가격·브레드스·벤치마크는 `시세 대기`(라이브 차단, 결함 아님).

## 콘솔

로컬 기원 콘솔 에러·pageerror **0건**. 수집 30건은 모두 `net::ERR_FAILED` — 감사에서 의도적으로 차단한 외부 CDN(pretendard, fonts.googleapis, chart.js, lightweight-charts, dompurify)이다.

## Blocked

- **(1) 시장 스냅샷 섹터 값 대조** — 대상 파일에 섹터 데이터가 없음 → 회전 아티팩트로 대체 검증.
- **닫기 후 재선택 잔상** — 닫기 컨트롤 부재로 그 경로는 미실행, 재선택 경로로 대체(잔상 없음).
- **구성종목·브레드스·벤치마크 수치** — `data.json.quotes` 비어 있고 오프호스트 요청 차단(545건) → 전 필드 `시세 대기`.
- **`#theme-detail` 콜드 로드** — 동일 문서 hash 내비게이션만 검증.
- **3개월/1개월 히스토리 지표 원천 대조** — screener 파이프라인 산출물 의존(3개 파일 범위 밖), 하위 테마 블록의 `10/9` 표기 일치만 확인.
