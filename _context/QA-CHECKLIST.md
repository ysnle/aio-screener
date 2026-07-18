---
verified_by: agent (Fable 5)
last_verified: 2026-07-18
confidence: high
version: v4.1
checklist_version: v53.11
latest_P_covered: P732
# 2026-07-18 통합/압축: 검증 완료된 버전별 원장(v34.x~v53.4)을 §6 압축 원장으로 축약, 퇴역 표면(KR 독립 5페이지 등) 항목 제거.
# 각 버전 원장의 원문 전체 체크박스는 git 히스토리(이 파일의 2026-07-18 이전 리비전) 참조.
---

# AIO Screener — QA 체크리스트 v4.0

> **핵심 원칙**: 코드 수정 → "고쳤다" 선언 금지. **게이트/브라우저에서 직접 확인한 증거**가 있어야 완료.
> 반복 요청 분석 최다 빈도 #1: "코드 고쳤다면서 브라우저에서 안 되잖아" — 이 체크리스트의 존재 이유.
> 테스트 그린만으로 안심 금지 — assert되지 않는 경로의 버그(P678 클래스)는 스위트가 못 잡는다.

---

## §0. QA 게이트 실행 절차 (현행 — 2026-07-18 기준, 라우트 17개 체제)

수정 후 아래를 순서대로 실행한다. **전부 PASS**여야 배포 가능(사용자 명시 승인 시).

### 정적 게이트 (15종, `node scripts/<이름>.mjs`)

```
ci-control-char-check      ci-worker-anthropic-check   ci-version-check
ci-release-revision-check  ci-data-lineage-audit       ci-static-data-contract-check
ci-structural-check        ci-ux-default-path-check    ci-runtime-contract-check
ci-data-pipeline-contract-check  ci-semantic-review-check  ci-workflow-compaction-check
ci-skill-contract-check    ci-doc-currency-check       ci-knowledge-lint-check
```

- JS 문법: `node --check js/aio-{core,data,ui,chat,tests,glossary}.js` + 변경된 `scripts/*.mjs`
- **Windows 로컬 함정 (2026-07-18 실측)**: `ci-data-lineage-audit`의 data.json 신선도 FAIL은 로컬 체크아웃이 낡은 것일 수 있음 — 원격 크론 확인(`gh run list --workflow=refresh-data.yml`) 후 `git pull` 먼저. `ci-data-pipeline-contract-check`의 screener-universe drift는 CRLF 아티팩트일 수 있음 — `node scripts/sync-screener-universe.mjs` 재생성 후 diff 0이면 내용 드리프트 아님.

### 브라우저 게이트 (6종, Playwright/Chromium)

| 게이트 | 명령 | 기준 |
|--------|------|------|
| 헤드리스 전체 테스트 | `node scripts/ci-headless-tests.mjs` | 1101/1101 PASS (skip-list 밖 실패 0) |
| 부팅 성능 | `node scripts/ci-boot-interaction-check.mjs` | FCP ≤2.5s · 첫 라우트 ≤2s · long task ≤2.5s |
| viewport 매트릭스 | `AIO_VIEWPORT_FULL_INIT=1 node scripts/ci-viewport-matrix-check.mjs` | 17라우트×4뷰포트=68/68 · overflow 0px · tinyText 0 · jsErrors 0 |
| critical-10 표면 | `node scripts/ci-critical10-human-surface-check.mjs` | 10 routes pass · consoleErrors 0 |
| 포트폴리오 Vault E2E | `node scripts/ci-portfolio-vault-e2e.mjs` | PFE2-01~08 PASS |
| 접근성 매트릭스 | `node scripts/ci-accessibility-matrix-check.mjs` | 17 routes pass · consoleErrors 0 |

### 최근 실측 기준선 (2026-07-18, v53.11, AR-07 data plane + AR-06 inference + typed navigation facade)

정적 15종 전부 PASS(data-lineage WARN 1: SEC 93/655=14.2%) · 헤드리스 1101/1101 · boot FCP 1556ms/route 1162ms/max long task 611ms · critical10 10/10(consoleErrors 0) · a11y 17/17(consoleErrors 0) · FULL_INIT viewport 68/68(4개 viewport shard, overflow 0px, tinyText 0, jsErrors 0) · vault E2E 8/8 PASS. 부팅 수치는 단일 로컬 실행의 변동값이므로 P728의 인과 성능 향상 근거로 사용하지 않는다. 로컬 Chromium은 외부망 차단 상태로 실행했으며 live Pages/Worker/provider 응답은 이 기준선에 포함하지 않는다.

추가 AR gate: `ci-architecture-contract-check.mjs` PASS(17 routes, legacy coupling baseline no increase) · `ci-architecture-browser-check.mjs` PASS(ESM boot, blocked sentiment, document-targeted pageShown, sentiment→home→sentiment dispose/mount, unexpected browser errors 0).

AR-07/06 추가 로컬 계약: Tier 0 market snapshot 16/16 published fixture PASS · Worker Cron/KV/R2 contract PASS · operations status `OPERATOR_REQUIRED`/durable `CURRENT` 명시 · 22-category reconciliation `MATCH 3 / PARTIAL 13 / BLOCKED 6` · WebSearch inferred claim high-confidence two-source gate PASS · typed `showPage`/`AIO_ARCH.navigate` facade Chromium PASS. Cloudflare credentials/resource IDs와 7-day soak은 외부 운영자 대기 상태다.
Standalone worker security gate also exits deterministically after PASS (`ci-worker-anthropic-check.mjs`, exit code 0).

---

## §1. 열린 항목 (Open Backlog)

- [x] **HYG 달러 가격 임계 신용 판정** — 2026-07-18 P726에서 5개 표면 전부 FRED HY OAS(`window._hySpreadBp`)로 일원화 완료(`_tempLive`/`updateRiskMonitor`/`generateFxBondCommentary`/`_aioRenderCarryUnwindRisk`/AI 채팅 fxbond 컨텍스트). Playwright 실측(missing+populated 양쪽 상태)으로 검증. **부수 발견(미해결)**: `generateFxBondCommentary()`의 대상 DOM(`#bond-dc-credit` 등 `bond-dc-*`/`fx-dc-*` 9개 id)이 v52.71 컴프 리디자인 이후 HTML에서 전부 제거된 고아 코드 — 로직은 고쳤지만 현재 화면에 렌더되지 않음(R341 대상, 아래 신규 항목 참조).
- [x] **`Number.isFinite(Number(...))` null→0 통과 가능성** — 2026-07-18 P726에서 18곳 전수 개별 판정, 14곳 실버그로 확인·수정(가장 심각: `calcKrHealthScore`가 자신의 R340 준수 주석과 모순, `updateWSAnalysis`가 결측 시 가짜 Stage 4 발화, 2s10s 브릿지가 10Y값을 스프레드로 오기록). 4곳은 이미 안전(`valid()` 헬퍼, T683/T241/T187)해 미수정.
- [x] **R309 양쪽-빈 삼항 잔재** — js/aio-data.js:3503 FRED YoY "+" 부호 복원. T765 하드코딩 기대값도 함께 수정(자기 자신이 버그를 정답으로 단언하던 사례).
- [x] **`updateFxDynamicComments()`/`generateFxBondCommentary()` 고아 코드** — 2026-07-18 P727에서 구 함수·sink·호출·wrapper를 제거했다. 현재 DOM에 남은 `fxbond-risk-pill`/`yc-inversion-badge`/Cross-Asset Matrix는 `updateFxBondPage()` 단일 경로에 통합했고 runtime contract가 회귀를 차단한다. pageShown당 무효 DOM 조회 24회, quote 갱신당 16회 제거.
- [x] **quote batch 전역 DOM 중복·퇴역 KR investor fanout** — 2026-07-18 P728에서 종목별 전역 lineage scan을 batch 마지막 1회로 defer하고, 전체 price/chg 중복 rewrite를 제거했다. 단건 갱신은 symbol-target annotation을 사용한다. 삭제된 KR 투자자 TOP10 표용 최대 24개 요청은 공유 로더에서 제거했고, runtime audit은 canonical 수급 evidence를 검사한다.
- [x] **AR-01~06 ESM compatibility observer** — 2026-07-18 P729에서 typed store/evidence/freshness/domain/AI policy/lifecycle router와 sentiment 첫 vertical slice를 연결했다. `document` target의 문자열 `aio:pageShown` payload를 실제 Chromium에서 검증하고 route 왕복 dispose/mount를 blocking gate로 고정했다. 전체 legacy cutover는 AR-09 잔여로 `MIGRATION_IN_PROGRESS`를 유지한다.
- [ ] SEC fundamentals 누적 커버리지 80% 도달(현재 91/655=13.9%)과 screener universe 갱신 — 외부 Actions 실행/시간 필요 (P708/P710 계열).
- [ ] AI 채팅 라이브 실문답 재검증 (P629/P645) — Worker 서버키 또는 개인키 필요. "분산 설계 안내문"의 억제 개수가 0이 아닌 실값 표시 확인.
- [ ] GitHub Pages/Worker 라이브 AI 응답·실제 모델 출력 품질·live provider 데이터 권리/legal 승인·multi-user 검증 — WP-AI 시리즈(P690~P701) 공통 미검증 잔여.
- [ ] 키보드/스크린리더 실사(자동화 불가), 장시간 리소스 누수 계측 — DEFERRED-BLOCKS B9.
- [ ] technical 페이지 통합 KR 캔들(구 kr-technical): 존재하지 않는 종목코드 입력 시 `Naver 시세 수신 실패` 폴백 문구 실브라우저 확인 — 코드 경로는 존재(index.html:27046), 실조작 미확인.

---

## §2. 최상위 바이너리 판정 (QC1~QC10)

수정 후 `/qa` 또는 `/post-edit-qa` 실행 시 **반드시** 명시적 yes/no 답변.

| # | 게이트 | 기준 |
|---|--------|------|
| **QC1** | 구조 무결성 | div 열림/닫힘 일치 AND 버전 7곳 동기화(R1) AND 콘솔 ERROR 0건 |
| **QC2** | Dead Page 없음 | **17개 라우트** 전부 3초 이내 콘텐츠 렌더 + 차트 canvas에 픽셀 존재 |
| **QC3** | 데이터 정합성 (R15) | `d.pct \|\| 0` 패턴 0건 AND 결측은 명시적 null/`—` (R342) |
| **QC4** | 네비게이션 사이클 | A→B→A / popstate / 해시 직접 접근 모두 정상 재렌더 |
| **QC5** | 뉴스 필터 규칙 (R16/R17/R22) | 매크로 뉴스 ETF 티커 0 + 3글자 미만 단독 키워드 0 + score 임계값 준수 |
| **QC6** | Dead Static HTML (P46/P58) | applyDataSnapshot map ↔ HTML `data-snap` 양방향 1:1 매칭 |
| **QC7** | 과거 버그 재발 없음 | BUG-POSTMORTEM "반복 버그 클래스" 표 grep 재발 0건 |
| **QC8** | 이벤트 정합성 (P61) | 대형 시장 이벤트 후 하드코딩 서술 텍스트가 현재 상황과 일치 |
| **QC9** | CDN SRI 완결성 (R34/P140) | `grep -c 'integrity=' index.html` ≥ 3 AND crossorigin 동반 |
| **QC10** | setInterval ID 저장 (R9/P141) | raw setInterval 없이 타이머 레지스트리/clearInterval 짝 확인 |

**판정 규칙**: 전부 yes → PASS. 1~2개 no → 해당 단계만 재실행 후 재판정(최대 2회). 3개+ no → 작업 중단·사용자 에스컬레이션.
**바이너리 원칙**: "대체로 통과" 금지 · WARN은 실패로 승격 · "미확인"은 no로 간주.

---

## §3. 핵심 절차 (수정 유형별)

### 3-0. 수정 전 스코프 매핑
수정 함수명 / 호출처(grep) / 접근 전역 변수 / 영향 페이지·DOM ID / 데이터 소스를 먼저 기록.
코드 경로 4종 확인: showPage() init · popstate · 타이머/자동갱신 · DOMContentLoaded.

### 3-1. 브라우저 런타임 (스킵 시 완료 선언 불가)
- 영향 페이지 각각: 3초 내 렌더 · 차트 픽셀 존재·비율 정상 · 수치 실값(0.00%/`—`/NaN=FAIL) · 변화율 현실적
- 네비게이션: 사이드바 A→B→A · 뒤로가기(popstate) · 해시 직접 접근 · F5 유지
- 시간 경과: 30~45초 대기 → 자동 갱신 후 차트 유지, "—"→실값 전환
- 콘솔 ERROR 0건 ("is not defined" / "Cannot read properties of null" / "Chart already initialized" 즉시 FAIL)
- API 파싱 수정 시: Network 탭에서 실제 응답 필드 존재 확인(가정 금지) — 없으면 수동 계산/폴백 필수

### 3-2. 정적 분석 (수정 유형별 필수 체크)
- **차트**: getElementById의 캔버스 ID가 올바른 page-* div 안에 존재하는지 grep
- **init 가드**: `if (xxxInitialized) return` → destroy에서 리셋 존재. init 함수 내 cleanup 루프 2회 이상 금지(P56)
- **데이터 폴백**: `_ldSafe()` 사용 · `if (val)`에서 0이 버려지지 않는지 · null 가드는 `typeof v === 'number' && isFinite(v)` (P715 — `Number.isFinite(Number(v))`는 null 통과)
- **applyDataSnapshot**: map 키 추가/제거 시 HTML `data-snap` 요소 양방향 동시 반영(P58)
- **이벤트 핸들러**: showPage/popstate/aio:liveQuotes 세 경로 모두 배선. 크로스페이지 공유 함수는 각 페이지 리스너에 연결(P60)
- **전역 변수**: API 콜백에서만 set되는 전역은 초기 read 시점 가드(P59)
- **종목 데이터**: SCREENER_DB 신규 sym → KNOWN_TICKERS 동시 등록(P64) · 회사명/상장 여부/모자회사 3중 검증(R10~R12) · 테마 가중치 합=100 · 중복 코드 0
- **일괄 치환/스윕 후 (R309)**: ① `aria-label` 없는 빈 `<button></button>` 전수 검색 ② `? '' : ''` 양쪽-빈 삼항 전수 검색 ③ JS 문자열 리터럴 내 마커 파괴 여부
- **`:root` 토큰 작업 시**: `grep -n "^:root"` 로 중복 오버라이드 블록(소스 후순위가 이김) 먼저 확인 — v52.62 함정

### 3-3. 시각/레이아웃
- 캔버스 width/height vs CSS 비율 일치 · 축 라벨 잘림 없음 · 주요 수치 3개 외부 소스 교차검증
- 390px/768px: 고정 `repeat(N,1fr)` N≥6 그리드 overflow 확인 · 스크롤 컨테이너 padding-bottom 16px+
- `document.querySelectorAll('[style*="repeat("]')` overflow 자동 탐지 스니펫 활용
- 페이지·문서 가로 overflow 0px (viewport 게이트가 상시 차단)

### 3-4. AI 채팅 (per-page + unified 공통)
- 입력→전송→스트리밍 표시→후속질문 칩 생성·클릭 동작 · API 키 없으면 안내(무한 로딩 금지)
- 페이지 컨텍스트 정합: 각 페이지 질문 시 해당 페이지 실데이터 인용(학습 데이터 가격 인용 금지)
- 응답 완료 후 DOM 구조: `.acp-msg.ai` 안에 `.acp-bubble` 존재 · 직접 자식 ≤5 · scrollWidth ≤ offsetWidth (v34.1 가로 렌더링 클래스)
- 매매 지시 문형 금지(P714): `grep -nE "매수하세요|매도하세요|진입하세요|헤지 필수" index.html js/*.js` → 안전 픽스처 외 0건
- 공통 응답 pipeline 경유(P691) · action gate 차단 전 원문이 history/chips에 저장되지 않음(P690)

### 3-5. 뉴스 엔진
- 연예/스포츠/부동산 뉴스 0 · 토픽/국가/TG 필터 동작 · 한국어 번역 제목(getDisplayTitle)
- 매크로/지정학 뉴스에 ETF 티커 배지 금지 · 크로스채널 중복(word-bag) 게이트 유지
- 뉴스 사이클 라벨 "08:00 KST 완료 24h" (rolling 48h 금지, R238)

### 3-6. 포트폴리오/워치리스트
- CRUD + localStorage 유지(새로고침 후) · 손익 계산식 정확 · Vault 암호화 경유(P661) — vault E2E 게이트가 상시 검증
- 삭제류는 커스텀 모달(native confirm 금지) · 포트폴리오→AI 프롬프트에 실보유 반영(명시 opt-in 필드 경계, P694)

### 3-7. 기업 분석(fundamental)
- 티커 검색 → 8초 총 예산 내 부분 성공/명시적 실패 종료(P705) · FMP 키 없어도 SEC+Yahoo 동작
- TTM/Annual 뱃지 구분 · Gross Margin >100% 금지 · Market Cap N/A 금지(라이브 가격 존재 시)

### 3-8. 접근성/보안/타이머
- canvas role="img"+aria-label · 최소 font-size 9px(8px 이하 FAIL) · 대비 4.5:1 · 색각 보조 클래스
- innerHTML에 외부 데이터 삽입 시 escHtml()/safeHtml() · alert()/confirm() 금지 · 민감 localStorage는 Vault/safeLS
- setInterval은 `_aioTimerRegistry` 경유 · destroy에 clearInterval 짝

### 3-9. 이벤트-드리븐 시장 정합성 (대형 이벤트/DATA_SNAPSHOT 갱신 직후)
- 유가·지정학·금리 서술 텍스트가 현재 방향과 일치(역방향 잔존 grep: `grep -n "이란전쟁\|전쟁 발발\|수요가 무너지고" index.html`)
- 값이 바뀌면 소비 표면 전체 grep 갱신(P713 BOK 사례) · 미래 특정일 등호 단언 금지(`grep "=== '20" js/aio-tests.js`)

---

## §4. 부록: 반복 실패 방지 특별 체크 (2회+ 반복 패턴)

| 패턴 | 확인법 |
|------|--------|
| 함수 존재하지만 호출 안 됨 | grep 호출 지점 + 브라우저 breakpoint. 읽기 코드 존재≠필드 존재 — 쓰기 지점 grep 실증(P724) |
| 이중 표면/그림자 구현 | 동일 지표 소비 표면 grep 전수(`abv50`, `hyg`, `DATA_SNAPSHOT.vkospi` 등) — 함수 단위 수정 금지(P713) |
| 동일 산출물 이중 write | 출력 경로 write 사이트 전수 grep + write 헬퍼·read-back 단언(P719) |
| init 가드 미리셋 / 이중 cleanup | destroy flag=false · init 내 destroy 루프 1회만(P56) |
| API 필드 가정 | Network 탭 실제 응답 확인 |
| popstate/showPage 한 경로만 수정 | 두 경로 모두 테스트 |
| 채팅 가로 렌더링 | `.acp-msg.ai` 내 `.acp-bubble` 존재 + 자식 수 DOM 검사 |
| `.pct \|\| 0` 재도입 (P25/R15) | `grep -n '\.pct ||' ` → 신규 0건, `!= null ?` 사용 |
| div 균형 오판 | `grep -o '<div' \| wc -l` (grep -c는 줄당 1 카운트) |
| data-live-price 벌크 자식 파괴 (P24) | `el.children.length > 0` 체크 유지 |
| 시점 관측값 리터럴 단언 (R279) | 날짜/시장값/데이터 상태를 영구 등호로 고정 금지 — 구조 속성으로 재작성(P627/P715/P720/P722) |
| 테스트가 artifact 내용 의존 | push 전 "현재 origin artifact"와 "차기 producer 산출물" 양쪽 실행(P722) |
| 스윕/일괄 치환 부작용 (R309) | 빈 버튼·양쪽-빈 삼항·문자열 마커 전수 검색(P678/P680) |
| "이미 됐다" 자기평가 | 과거 확인 기록을 재검증 없이 신뢰 금지(P631/P687/P688) |
| var/const hoist 충돌 | 모듈 전체 parse 실패 유발(P311/P525) — `node --check` 필수 |
| 고정 열 그리드 모바일 overflow (P57) | `repeat(N,1fr)` N≥6 → auto-fit/minmax |
| Dead Page | page-* div마다 init·pageShown·liveQuotes 3종 확인 |

---

## §5. 페이지별 핵심 검증 매트릭스 (17 라우트 체제, v53.7)

| 라우트 | 필수 확인 | FAIL 조건 |
|--------|----------|-----------|
| home | 시세카드 변화율, 스프레드, 뉴스, 결론 헤더=게이지 점수 | 변화율 0.00%, 스프레드 `—`, 점수 불일치(P553) |
| signal | 점수 게이지, 서브 바, 시나리오 | 게이지 `—`, 바 0 |
| breadth | SMA 바 3개, 차트, McClellan | 바 0, 빈 차트, 큰 숫자↔문장 모순(P562) |
| sentiment | F&G 게이지(단일값), AAII, P/C | 같은 카드 F&G 2값(P570), 빈 차트 |
| briefing | 다이제스트, 일정, F&G=타 페이지 동일값 | 영구 [번역 대기](P554), F&G 이중값 |
| technical | 지표, 지지/저항, **KR 통합 섹션(kr-integrated-*) 캔들** | 지표 `—`, KRX 오류 모달, y축 압축 |
| macro | yieldCurve, 온도, 일정(미래만), **KR 통합 섹션** | 빈 차트, 과거 일정 "발표 전" 잔존 |
| fxbond | 커브 차트, 스프레드, 캐리 배지 | 빈 차트, HY 이중값(P625) |
| themes | RRG(일봉 수화, P721), 사이클 칩=본문, **KR 통합 섹션** | RRG 영구 보류, 칩↔본문 모순(P606) |
| fundamental | 검색→부분성공/명시실패, TTM 뱃지 | 8초+ 무한 로딩, GM>100% |
| screener | 12행 점진 공개, 실가격, 관측형 라벨 | 첫 진입 빈 테이블(P522), BUY/SELL raw enum |
| ticker | 종목 개요(52주/수익률, P723/P724), 미보유 시 P&L 미표시 | 가짜 데모 P&L(P620), 52주 영구 결측 |
| portfolio | 보유→리스크→배분 순서, 빈 상태 CTA | 첫 진입 빈 화면, 평문 저장(P661) |
| market-news | 12개 점진 공개, 중복 없음 | 크로스채널 중복(P621) |
| options | VIX/VVIX 실값 + reference-only 고지 | 하드코딩 잔존, 고지 부재 |
| guide / theme-detail | 검색+아코디언 / 실제 테마명 브레드크럼 | 브레드크럼 `—`(P622) |

※ KR 독립 5페이지(kr-home/kr-supply/kr-themes/kr-macro/kr-technical)는 **v53.7에서 퇴역** — kr-themes/macro/technical은 themes/macro/technical 내 접힌 "한국 시장" 섹션(`kr-integrated-*`)으로 이관, kr-home/kr-supply 삭제. 구 KR 페이지 대상 체크 항목은 무효.

---

## §6. 버전별 검증 원장 (압축 — 원문 체크리스트는 git 히스토리)

| 버전 | 검증 주제 (P) | 상태 |
|------|--------------|------|
| v53.6~53.7 | ticker 종목 개요 + 52주 필드 보존(P723/P724) · KR 5페이지 통합(P725) — 헤드리스 1101 + viewport 68/68 + 리다이렉트 실브라우저 | ✅ |
| v53.5 | P719~P722: 발행 계약 read-back·감사 토큰·RRG 일봉 수화·테스트 양방향 불변식 | ✅ |
| v53.4 | 정적·하드코딩 22카테고리 계약(P717) + 퇴역 소비자 null 포맷(P718) — 실Chromium 무외부망 console 0 | ✅ |
| v53.3 | 퇴역 수직 제거 + 공개 artifact 5-script allowlist(P716) | ✅ |
| v53.2 | 소수 공유 배치: TG summary-only·quotes 미발행·null 코어전·관측형 라벨(P715) | ✅ |
| v53.1 | 시스템 발화 지시 제거·면책 도달·연구 라벨(P714) | ✅ (단 HYG 잔존 3함수 §1 참조) |
| v53.0 | fail-closed 이중 표면·날짜핀 부패·BOK 정합(P713) | ✅ |
| v52.99 | 22페이지 현재시장·파생결론 무결성 — 합성 금지·판정 보류(P712/R340) | ✅ |
| v52.94~52.97 | BLS 공식 evidence·22-route 계약·lineage/freshness 감사·TG 전수 커버리지(P708~P711) | ✅ 로컬 (SEC 80%는 §1 open) |
| v52.87~52.90 | 시안 기본 경로 재구축·상태 여정(P702~P705) — 40/40면 + 14 상태 계약 | ✅ |
| v52.74~52.86 | 부팅 성능 게이트(P689) + WP-AI1~20 계약(P690~P701) | ✅ 로컬 (라이브 모델/권리 검증은 §1 open) |
| v52.68~52.73 | 13개 시안 화면 전체 구조 재구축(P681~P688) | ✅ |
| v52.62~52.67 | 아이보리 리디자인 P1~P2 + R309 신설(P678~P680) | ✅ |
| v52.27~52.61 | FABLE UI/UX V0~V4·EF Batch·WO-0~8·H2 (P642~P677) | ✅ (WO-2/3 음의 상관은 제품 결정 보류) |
| v52.5~52.26 | FABLE 라이브 감사 P0~P6 전체 + 2026-07-08 라이브 일괄 검증 원장 | ✅ (당시 ❌였던 프록시 SPOF/VKOSPI는 P643/P658/P713에서 해소·게이트화) |
| v51.83 이하 | XSS·score parity·데이터 파이프라인·근본수정 registry·유니버스 감사 등 | ✅ 완료 — 원문은 git 히스토리, 재발은 QC7+반복 클래스 grep으로 차단 |

---

## §7. 게이트↔문서 계약 마커 (CI 게이트가 이 문서에서 직접 grep하는 항목 — 삭제 금지)

- **P513-Q1**: audit/게이트 그린만으로 완료 선언 금지 — `ci-semantic-review-check.mjs`가 의미 검토(semantic review)를 별도 강제. shape/coverage audit은 의미 검증의 대체물이 아니다 (R219).
- **P514-Q1**: workflow/skill 문서 append-only 비대화 방지 — `ci-workflow-compaction-check.mjs`가 governed ledger(RULES/QA-CHECKLIST/BUG-POSTMORTEM) 외 대형 컨텍스트 파일을 경고 (R220).
- **P517**: 데이터 파이프라인 source→consumer 전체 계약 — `ci-data-pipeline-contract-check.mjs` (R222).
- **P529**: 기본 경로 UX 노이즈/빈 트랙 차단 — `ci-ux-default-path-check.mjs` (R228).
- **P531**: 뉴스 셀프-주입 소스 품질·신선도 게이트 (R230).
- **P532**: operator note 첫 화면 우선 배치 + Signal 접힘(fold) 회귀 게이트 (R228).
- **P534**: visual hierarchy refresh 계층 게이트 (R231).
- **P535**: 스크리너 Kalman log-scale 생성·버전 병합 + 매매 문구 완화 게이트 (R232).
