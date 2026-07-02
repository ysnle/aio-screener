---
verified_by: agent (Fable 5 — 정적 실측 + git 실측 + 파이프라인/알고리즘 코드 정독)
audit_date: 2026-07-02
target_version: v51.90
confidence: high (모든 수치 실측. 추정치는 "추정" 명기. 진단 전용 — 코드 무수정)
purpose: Sonnet 5 작업 세션 핸드오프 — 아키텍처·자동화/최신화·알고리즘 3축 시스템 뼈대 진단. 이 문서만으로 cold start 작업 가능.
---

# AIO Screener 시스템 뼈대 진단 (Fable 5, 2026-07-02)

> 요청 범위: **진단만** (아키텍처 / 자동화·최신화 / 알고리즘 — 전체 시스템 구조와 뼈대 중심).
> 실제 보강·개선은 Sonnet 5 세션이 §7 로드맵 순서로 진행한다.
> 개별 버그 사냥이 아니라 **구조적·설계적 리스크**에 집중했다. (개별 버그는 프로젝트의 기존
> postmortem→gate 루프가 이미 잘 잡고 있음 — v51.83~51.90에서 실증.)

---

## 0. 총평 (Executive Summary)

**거버넌스·감사 레이어는 이례적으로 성숙**하다. postmortem(P581)→룰(R268)→CI 게이트(9종)→워치독의 폐쇄 루프,
증거 기반 배포 게이트, 22페이지 계약, 900+ 런타임 테스트. 2026-06-10 OPUS-HANDOFF 감사의 P0 5건(C1~C5)은
전부 해소됐다(cron+워치독, ATH 버그, 내러티브 레짐 스탬프, refresh map, CI-게이트 배포).

그러나 **뼈대 수준에서 3계층의 구조적 리스크**가 누적돼 있다:

| 계층 | 핵심 리스크 | 심각도 |
|---|---|---|
| **A. 코드 아키텍처** | 95K줄 모놀리스 + 전역상태 ~3,400참조 + 전 스크립트 동기 로딩 + 핵심 알고리즘이 index.html 인라인에 잔존(모듈이 인라인을 역참조) | 중~높음 (성장 한계 접근) |
| **B. 자동화/운영** | **로컬 git 저장소 병듦(OneDrive 충돌, loose object 2.4GiB)** · Yahoo 비공식 API 단일 의존 · 매크로 일부 수동(WebSearch) 갱신 잔존 · CI가 900+ 브라우저 테스트를 실행 못함 | **P0 1건 포함** |
| **C. 알고리즘** | 서버↔클라 이중 구현 드리프트(RSI 공식이 서로 다름 확정) · 백테스트가 검증하는 모델 ≠ 라이브 랭킹 모델 · 핵심 매매점수(computeTradingScore)는 검증 하네스 자체가 없음 | 중간 (정합성·신뢰성) |

한 줄 결론: **"기록·감사 시스템"은 기관급인데, "실행 기반(저장소·로딩·단일구현·검증)"이 그 무게를 못 따라가기 시작한 시점.**

---

## 1. 시스템 뼈대 지도 (as-is)

```
[수집층: GitHub Actions]                       [전달층: 저장소/CDN]           [실행층: 브라우저 SPA]
 refresh-data.yml (cron 17,47분 = 30분 주기)    public-data/                   index.html 32,065줄 (2.3MB)
  └ fetch-data.mjs (1,183줄)                     ├ data.json      62KB          ├ 인라인 CSS ~5,600줄
    ├ Yahoo v8 chart ×77심볼 (quotes)            ├ history.json   41KB (420d)   ├ 22페이지 DOM 상주 (~11K노드)
    ├ FRED 7시리즈 (키)                          ├ screener.json  275KB         ├ 인라인 runtime (computeTradingScore 등)
    ├ CNN F&G (비공식)                           ├ telegram-digest 2.4MB        └ js/ 6모듈 60,777줄 (3.98MB)
    ├ Google News RSS 7피드+per-ticker           └ operator-note   1.2KB           core 23,830 / data 17,535 /
    ├ 스크리너 881심볼 1y enrich (6h 스로틀)                                        chat 6,877 / ui 5,239 /
    │  └ FMP(키) value/quality + VCP + 백테스트   [배포: CI validate→Pages]          tests 6,982(lazy) / glossary 314
    └ Anthropic LLM 분석 (haiku-4-5/sonnet-4-6)   ci.yml 9종 게이트 통과 시만
  fetch-telegram-digest.mjs (RSSHub 3채널)                                     [보조 인프라]
 data-watchdog.yml (매시 23분: repo+LIVE 이중검사)                              sw.js (Network-First SW)
                                                                               cloudflare-worker-proxy.js (키 은닉 프록시)
[지식·거버넌스층: _context/ + .claude/skills]
 RULES 249KB(R268) · BUG-POSTMORTEM 667KB(P581) · QA 151KB · CHANGELOG 1.37MB · CODE-MAP(→v50.60 stale)
 skills 7종(+wrapper 9) · /data-refresh = 22카테고리 staleness table 기반 반자동 갱신 루프
```

데이터 흐름 요약: 시세·매크로·뉴스·스크리너 팩터는 **자동**(30분/6h) → 클라가 `_aioLoadServerData`로 소비.
ISM·소비자신뢰·AAII·한국 CPI/PMI/수급·GPU/DRAM 시세 등 **fetch 함수가 없는 카테고리는
/data-refresh 스킬(LLM 세션 + WebSearch)이 DATA_SNAPSHOT 리터럴(aio-core.js:18620~18898)을 수동 편집** — v51.90에서 WebSearch 12건 실행.

---

## 2. 이전 구조 감사(2026-06-10) 대비 변화

| 6/10 P0 | 현재 상태 |
|---|---|
| C1 cron 0회 발화·감시 0 | ✅ 해소 — offset cron(17,47) + 워치독(repo+라이브 이중, P572 교훈 반영) |
| C2 ATH 레짐 버그 | ✅ 해소 |
| C3 "숫자는 자동, 내러티브는 수동" | ⚠️ **부분 해소** — 레짐 스탬프·staleness 경고·BLOCKED 규율은 도입. 그러나 매크로/KR 다수 카테고리의 **취득 자체는 여전히 수동**(§4-B2) |
| C4 refresh map 유령 task | ✅ 해소 |
| C5 배포 게이트 무강제 | ✅ 해소 — CI validate가 Pages 배포를 게이트(P557/R248) |
| 장기 백로그(당시 명시) | ⬜ **미착수 그대로**: script defer(WO-9 후반), index.html 모듈 분리, `!important` 325개, innerHTML 211건 점검, 홈 IA 재설계(WO-11) |

---

## 3. A. 아키텍처 진단

### A1. 모놀리스 성장 한계 [중요]
- 실측: index.html 32,065줄(2.3MB) + js 6모듈 60,777줄(3.98MB) = **클라 코드 ~95K줄, raw ~6.3MB**.
  6/10 감사 대비 raw +~0.8MB(당시 5.5MB). gzip 전송 추정 ~1.7MB(당시 실측 1.53MB).
- 22페이지 전체가 DOM 상주(당시 실측 10,998노드) — 페이지 전환은 display 토글. 저사양/모바일 렌더러 부하.
- 여기에 **telegram-digest.json 2.4MB를 부팅 시 로드**(aio-data.js:1197, 시간 단위 캐시버스터) — 부팅 페이로드의 단일 최대 항목.
- 진단: 지금의 "CODE-MAP 기반 부분 패치" 운영은 유지 가능하지만, **성장률(한 달에 수천 줄)이 유지되면
  CODE-MAP 재스캔 주기·에이전트 컨텍스트 예산·부팅 성능이 동시에 한계에 닿는다.** 분리 1순위는 코드보다
  **데이터**(SCREENER_DB 881행, DATA_SNAPSHOT, CHAT_CONTEXTS를 JSON 아티팩트로) — 리스크가 코드 분리보다 훨씬 낮다.

### A2. 스크립트 로딩 전략 [중요 — 알려진 미해결(WO-9)]
- `aio-core/data/ui`(index.html:12461~12463), `aio-chat`(15938), `glossary`(28557) **전부 동기 `<script>` — HTML 파서 블로킹**. defer는 CDN 3개(Chart.js/DOMPurify/lightweight-charts)뿐.
- 결과: 12461행 시점에 ~2.9MB JS 다운로드+파싱이 끝나야 나머지 ~19,600줄 HTML이 파싱됨. 6/10 실측 DOMContentLoaded 2.47s(로컬) — 프로덕션 콜드는 그 이상.
- SW는 shell을 `cache: 'no-store'` Network-First로 받으므로(sw.js:136) **재방문에도 항상 풀 다운로드**(오프라인 폴백용으로만 캐시 사용). 대역폭 절약 없음 — 신선도 우선 설계의 대가.
- 완화 가능 경로(진단만): core→data→ui→chat 순서 의존을 유지한 채 `defer`는 순서 보장됨(스펙상 defer는 문서 순서 실행) — WO-9가 미룬 "로드 순서 위험"은 인라인 블록(12465~, 13660 사이)이 모듈 심볼을 파스타임에 참조하는지가 진짜 관건. 인라인 블록의 심볼 참조 감사가 선행 과제.

### A3. 모듈 경계 역전 — 핵심 로직이 인라인에 잔존 [중요]
- **`computeTradingScore`(매매점수 — 이 앱의 중심 알고리즘)가 index.html:22771 인라인 블록에 정의.**
  `classifyMarketRegime`(23008), `computeExecutionWindow`(22946), `getScoreAdvice`(22937)도 동일.
- 소비자는 모듈 쪽: aio-core.js:3786, aio-data.js:5583/15669/16252, aio-ui.js:3630 등이
  `typeof computeTradingScore === 'function'` 방어 호출 — **모듈이 인라인 HTML 코드에 역의존**.
  로딩 순서가 바뀌면(예: WO-9 defer 적용) 조용히 폴백 경로로 빠지는 구조적 함정.
- CODE-MAP에도 이 함수들의 위치가 등재돼 있지 않음(§A6과 결합해 탐색 비용 증가).

### A4. 전역 상태 산개 [구조적 원인 — 증상은 반복 수정 중]
- 실측 `window.` 참조: aio-core 1,835 / aio-data 704 / aio-chat 277 / aio-ui 205 / index.html 350 = **~3,371**.
- 시장 상태의 소유자가 최소 6곳: `DATA_SNAPSHOT`(정적 리터럴) / `window._liveData` / `window._fredData` /
  `MacroStore` / `safeLS(localStorage)` / DOM 자체. 사이에 브릿지 3종(`_LIVE_SNAP_MAP`, `_syncYahooToFred`, `applyDataSnapshot`).
- P553(같은 화면 두 점수), P559(모드별 캐시 미스매치), P576(측정값이 DOM에만 저장) — 전부 이 산개가 낳은
  동일 클래스. 각각 TTL 캐시·모드 키·전역 저장으로 봉합했지만 **"단일 스토어 + 파생 구독" 구조가 없는 한 재발 클래스는 열려 있음**.
- v50.42~51의 `aio:marketStateUpdated` 구독 확산이 올바른 방향 — 미완(구독자 전수 이전이 안 됨).

### A5. DOM-as-database 잔재
- computeTradingScore 최후 폴백이 `document.getElementById('hy-spread-val').textContent` 파싱(index.html:22906) — R266("측정값을 소비 가능한 전역에 저장")의 정신에 어긋나는 마지막 잔재. 낮은 우선순위지만 정리 대상.

### A6. 지식·거버넌스 시스템 자체의 비대화 [중요 — 복리 루프의 역설]
- 실측: CHANGELOG 1.37MB · BUG-POSTMORTEM 667KB(P1~P581) · RULES 249KB(R1~R268) · QA-CHECKLIST 151KB · KNOWLEDGE-BASE 71KB.
- compaction 게이트(ci-workflow-compaction-check.mjs)는 존재하나 **위 5개는 `governedLargeContextNames`로 면제**(>100KB 경고 대상에서 제외) — "관리되는 장부"라는 명분이지만 상한이 없다. 에이전트의 "관련 P/R만 읽기"는 grep 의존이고, RULES는 최신순 prepend라 그나마 낫지만 CHANGELOG는 이미 단일 파일로서 실용 한계.
- **CODE-MAP.md가 v50.60(6/16) 기준 — 현재 v51.90과 60버전 차이.** 실측 불일치 확인: CODE-MAP의 `LLM_MODELS | aio-ui.js:1439`는 현재 KST 날짜 유틸 코드. 자체 규칙("±500줄 리팩토링 시 재스캔") 위반 상태. **에이전트 내비게이션의 1차 도구가 오지도(誤地圖)** — 이후 UI 전면 개편(v51.48~51)을 겪고도 미재스캔.
- **`_context/CLAUDE.md`가 디스크상 이중 인코딩 손상(mojibake)** — hexdump로 확인(UTF-8 한글이 CP949 왕복 파손된 바이트 + `?` 치환 문자). 루트 CLAUDE.md가 "상세 문서"로 가리키는 허브 문서가 **읽을 수 없는 상태**. 매 세션 에이전트가 이 파일을 읽도록 계약돼 있음(WORKFLOW-GOVERNANCE preflight).
- INDEX.md도 baseline이 v50.4(638de8f, 6/3)로 stale.
- 문서 drift 추가 사례: 루트 CLAUDE.md/커밋 메시지의 "2시간마다 데이터 갱신" vs 실제 cron 30분(refresh-data.yml:9).

### A7. 저장소·실행 환경 [P0 — 유일한 즉시 조치 대상]
- **로컬 git 객체 저장소가 병들어 있다. 실측**(`git count-objects -vH`):
  - loose objects **20,503개 / 2.40GiB** (pack은 19개 / 30MiB뿐 — 정상이라면 loose는 수백 개 수준)
  - **gc/repack 실패 잔해 `tmp_obj_*` 370개 / 103MiB** — gc가 반복 실패 중이라는 직접 증거
  - `du .git`이 2분 타임아웃(파일 수 과다 + OneDrive 온디맨드 다운로드)
- 원인 구조: **저장소가 OneDrive 동기화 폴더 안**(`OneDrive\문서\Claude\Projects\AIO`) + 30분마다 데이터 커밋 pull(최근 500커밋 중 `data:` 커밋 200개=40%, telegram-digest 2.4MB가 최근 20커밋 중 10회 변경) → 객체 대량 생성 → OneDrive가 .git 내부 파일을 잠그거나 동기화하는 사이 git 쓰기 충돌 → gc 중단 → tmp_obj 누적. **2.4GiB가 클라우드로 동기화되며 디스크·대역폭 낭비 + 저장소 손상 위험.**
- 리모트(GitHub) 쪽도 커밋의 40%가 데이터 커밋 — 히스토리 비대화 진행(클론 크기·CI 체크아웃 시간에 점진 영향).

### A8. 보안 표면 (현황 확인 — 대체로 양호)
- 최근 시정 이력 우수: XSS 구조 수정(P558/566/567 — DOMPurify), 키 유출 egress 차단(P573/R264), 프록시 캐시 민감 URL 제외(sw.js:47).
- 잔존 백로그(기존 문서에 이미 등재): innerHTML 211건 수동 점검(DEFERRED-BLOCKS §2), CSP 부재(GitHub Pages 헤더 불가 — `<meta http-equiv>` CSP는 검토 가능하나 인라인 스크립트 대량이라 실효 제한).
- API 키는 클라 localStorage AES + CF Worker 서버키 라우팅 병행 — 구조 자체는 정적 호스팅 제약 내 최선에 가까움.

---

## 4. B. 자동화/최신화(데이터 파이프라인) 진단

### B1. 소스 의존성 — Yahoo 단일 장애점 [중요]
- 시세(77) + 히스토리(420d) + **스크리너 881심볼 1y**(팩터·VCP·백테스트 입력 전부)가 **Yahoo 비공식 v8 chart API 하나**에서 나옴. 폴백은 query1↔query2 호스트 스왑뿐(fetch-data.mjs:90) — 같은 서비스의 같은 차단 정책 안.
- Actions 러너 IP 차단은 이미 상수적 위협(코드 주석 실증: "차단/레이트리밋이 호스트마다 다르게"). Yahoo가 스키마 변경/차단 강화 시 **시세·팩터·백테스트가 동시 정지**.
- CNN F&G도 비공식(브라우저 위장 헤더). 공식 계약 소스는 FRED뿐. 클라 쪽은 Twelve Data 폴백이 있으나(fetchOHLCVWithFallback) 서버엔 대체 프로바이더 계층이 없음.
- quote 품질 게이트 자체는 견고(변동폭 tolerance 검증 + verify-retry + 50% 실패 시 exit 1 — fetch-data.mjs:141~155, 1176).

### B2. "최신화"의 이원 구조 — 자동 vs 수동의 경계 [구조 핵심]
- 자동(30분): 시세/F&G/FRED 7시리즈/뉴스/텔레그램. 자동(6h): 스크리너 팩터+FMP+VCP+백테스트+티커뉴스.
- **수동(/data-refresh 스킬 = LLM 세션 + WebSearch)**: ISM·소비자신뢰·AAII·한국 CPI/PMI/수출·한국 일별 수급/신용잔고·GPU/DRAM 스팟 등 — CODE-MAP §5도 "C계층 fetch 함수 0건·수동 갱신"으로 자인. DATA_SNAPSHOT 리터럴이 이들의 저장소.
- 평가: staleness table·`_fieldTs`·amber 경고·BLOCKED 규율(v51.66~90)로 **"수동임을 정직하게 드러내는" 체계는 완성됨**. 그러나 취득 자동화의 다음 후보가 문서화돼 있지 않다. 실제로 FRED에 존재하는 시리즈가 여럿(예: UMCSENT 소비자심리, MANEMP/NAPM류 대체 지표, 한국 CPI는 FRED `KORCPIALLMINMEI`) — **FRED_SERIES 7종에서 확장하는 것만으로 수동 카테고리 일부를 자동층으로 이관 가능**(진단: 확장 대상 목록화가 선행 과제).
- 위험: 수동 카테고리는 운영자(=사용자)가 /data-refresh를 돌리는 빈도에 신선도가 종속 — 자동화 시스템 안의 **인간 크론**.

### B3. 갱신·배포 주기의 부수효과
- 30분 cron × 매 커밋 full CI(9 게이트) + Pages 배포 = **하루 최대 ~48 배포**. 현재는 동작하나: Actions 소비 증가, 배포 큐 경합, git 히스토리 비대(§A7), CDN 캐시 무효화 빈발.
- telegram-digest.json(2.4MB)이 30분마다 재생성·재커밋(최근 20커밋 중 10회 변경 실측) — **git 객체 증가의 주범**. 콘텐츠 diff 대비 파일 재직렬화(타임스탬프·순서)로 인한 불필요 변경 여부 확인 가치 있음.
- GitHub 정책 리스크: public repo의 scheduled workflow는 **60일 무활동 시 자동 비활성** — 현재는 데이터 커밋이 활동을 유지해주는 순환 구조라 실위험 낮음, 단 데이터 커밋이 멈추는 장애가 60일 지속되면 cron도 함께 죽는 이중 실패 모드만 인지.

### B4. 감시·알림
- 워치독은 P572 교훈(저장소만 보고 라이브를 안 봄)을 반영해 이중 검사 — 설계 우수.
- 알림 채널이 **GitHub 실패 이메일 단일** — 운영자가 이메일을 놓치면 무소식. 텔레그램 봇 알림(이미 텔레그램 파이프라인 보유)으로의 확장이 자연스러운 다음 단계(진단만).

### B5. CI의 구조적 갭 — 900+ 테스트가 CI 밖 [중요]
- aio-tests.js(6,982줄, T1~T845+)는 **브라우저 콘솔 수동 실행 전용**. ci.yml은 `node --check`(구문) + 정적 계약 검사 8종만 — ci.yml 주석 스스로 이 한계를 자인.
- 결과: 런타임 회귀(렌더·상태·계약 위반)는 배포 게이트를 **통과**하고 라이브에서 발견됨. GATE-BASELINE(6/4)의 헤드리스 측정(673/692)이 1회성으로 끝났고 상설화되지 않음.
- 진단: Playwright/puppeteer로 `AIO.loadTests() → AIO.runTests()`를 실행하는 CI job이 게이트 체계의 마지막 빈 칸. (데이터 fetch 없는 정적 서빙 + 시드 data.json으로 네트워크 의존 테스트는 skip 마킹하는 설계가 필요 — GATE-BASELINE의 env-dependent 분류가 그대로 재사용 가능.)

### B6. 파이프라인 결합의 취약점 — 소스코드 정규식 파싱
- `getScreenerSymbols()`(fetch-data.mjs:593~605)가 **js/aio-data.js 소스 텍스트에서 `var SCREENER_DB`를 찾아 정규식으로 심볼 추출**. 종료 탐지가 `'\n];'` 문자열. 클라 파일 포맷/들여쓰기 변경 시 조용히 0심볼 → screener.json 미갱신(워치독 48h 후에야 포착).
- 진단: 유니버스를 별도 JSON(예: public-data/universe.json 또는 scripts/universe.json)으로 승격하고 클라·서버가 공유하는 게 정도(§A1 데이터 분리와 동일 방향).

### B7. LLM 통합 현황 (검증 완료)
- 서버(genMarketAnalysis, fetch-data.mjs:1041): 기본 `claude-haiku-4-5`, 승격(VIX≥25/위기뉴스/강제) `claude-sonnet-4-6` — **둘 다 현행 유효 모델 ID**(2026-07 기준 확인). sonnet-4-6은 전세대(현행 `claude-sonnet-5`, 인트로 가격 $2/$10 적용 중) — 교체는 선택 사항이지 결함 아님.
- 클라(aio-ui.js LLM 설정): `claude-haiku-4-5-20251001`, `claude-sonnet-4-6` — 서버와 정합.
- 구조 노트: 모델 ID가 서버 1곳+클라 3곳에 하드코딩 — 단일 레지스트리 없음(모델 세대 교체 시 R1류 동기화 누락 위험).

### B8. history.json 축적 정책
- 420일 cap — 52주 지표(IV Rank·VIX 퍼센타일)에는 충분. **장기 백테스트·사이클 분석으로 확장하려면 상한 재설계 필요**(연 단위 아카이브 파일 분리 등). F&G 히스토리는 백필 불가(무료 과거 소스 없음)라 라이브 축적만 — 이미 인지된 제약.

---

## 5. C. 알고리즘 진단

### C1. 서버↔클라 이중 구현 드리프트 [중요 — 실측 확정 1건 포함]
- **RSI 공식이 서로 다르다(확정)**: 서버 `_rsi14`(fetch-data.mjs:625)는 **Cutler식**(최근 14봉 단순평균 1패스). 클라 `_calcRSILast`(aio-core.js:16586)는 **Wilder식**(초기 평균 후 전체 시리즈 지수 스무딩). 같은 "RSI(14)" 라벨로 **screener.json의 rsi와 티커 상세/기술 페이지의 RSI가 다른 값** — 추세장에서 수 포인트 괴리 가능. 어느 쪽이 표준인지(Wilder가 업계 표준, R265의 "명명된 방법론 정합" 원칙)를 정하고 단일화 필요.
- VCP: `_calcVCPServer`(fetch-data.mjs:847) vs `_calcVCP`(aio-core.js:16716) 병렬 구현 — 현재는 의도적 대응이지만 파라미터(스윙 N=4, 수축 깊이 1~45% 등)가 두 곳에 하드코딩돼 한쪽만 튜닝되는 드리프트 경로.
- SMA/수익률/변동성 헬퍼도 양쪽 각자 구현. **근본 원인: 브라우저(스크립트 태그)와 Node(ESM) 간 공유 모듈 구조 부재.** 단일 소스(공유 .mjs + 클라 번들 또는 파리티 계약 테스트) 중 택일이 필요.

### C2. 백테스트가 검증하는 모델 ≠ 운용 모델 [중요]
- 서버 `backtestFactors`(fetch-data.mjs:703): **4팩터 고정 가중**(mom .35/trend .25/lowvol .25/kalman .15), 리밸 시점 6개(21d fwd), Spearman IC + 분위 스프레드.
- 라이브 랭킹 `_aioComputeFactorRanks`(aio-data.js:15905): **7팩터**(+size/value/quality) × **레짐 적응 가중**(`_aioFactorWeights`) × 섹터 상대 z-score(소표본 블렌드) × winsorize.
- 즉 스크리너 페이지의 "백테스트 IC" 패널은 **실제 랭킹 모델의 검증이 아니다**(v51.89도 자인: "서버 백테스트는 size/value 미포함"). 사용자에게 검증된 것처럼 보이는 표면과 실제 검증 범위의 괴리 — 신뢰성 이슈.
- 부가: IC가 매회 재계산·미저장(시계열 추적 없음), 시점 6개는 통계적 검정력 낮음(참고치 수준임을 UI가 밝히는지 확인 필요). look-ahead는 v51.88에서 clean 확정 — 그 부분은 건전.

### C3. computeTradingScore — 검증 하네스 부재 [구조 핵심]
- 5개 서브스코어(변동성/모멘텀/추세/시장폭/매크로, 가중 25/25/20/20/10) + 7종 보정(PCR·AAII·교차리스크·다이버전스·HY·유가·뉴스감성) — **전부 손튜닝 계단함수. 어떤 백테스트/IC/적중률 검증도 없음.** 스크리너 팩터에는 IC 검증을 만들어놓고 정작 홈 화면의 중심 지표는 무검증.
- 재료는 이미 있음: history.json(SPX/VIX/F&G/TNX/breadth 대용 420일)로 "과거 각 일자의 점수 재구성 vs forward 5/21일 SPX 수익률" 하네스 구축 가능 — 진단: **이것이 알고리즘 신뢰성에서 가장 leverage 큰 미착수 작업.**
- 부수 설계 노트(수정 여부는 검증 후 판단): ① 모멘텀 축이 F&G(심리) 프록시 — 라벨과 실체 불일치, ② `breadth200` 변수명이 실제로는 20SMA above %(레거시, 주석으로만 해명), ③ 계단함수 경계에서 점수 불연속(VIX 21.99→22.01에 volScore 62→42) — 표시 안정성 위해 히스테리시스/선형 보간 검토 여지, ④ 최후 폴백의 DOM 파싱(§A5).

### C4. HY 스프레드 근사식 이원화 + 죽은 쓰기 의심
- 같은 양(HY OAS)에 **서로 다른 근사식 2개**: index.html:22905 `(100-HYG)×15bp` vs aio-data.js:16042 `_YAHOO_FRED_MAP` `(82.5-HYG)×0.8+2.4`(%). P576/R266이 전자의 우선순위는 고쳤지만 후자는 그대로.
- 후자가 주입하는 `_fredData['_HY_PROXY']`는 **grep 전수에서 소비처 0건** — 죽은 쓰기 의심(동적 키 접근 가능성만 배제하면 삭제 대상). Sonnet 세션에서 소비 경로 확정 후 단일화 필요.

### C5. `_syncYahooToFred` 브릿지의 신선도 혼합
- FRED가 1일 초과 stale이면 Yahoo 실시간으로 `_fredData`를 덮어씀(aio-data.js:16045~) — 의도는 정당(지연 보정)하나, ① VIXCLS(종가 지표)에 장중값 주입 = 의미 변화, ② `T10Y2Y = 실시간 ^TNX − stale DGS2`(16096) — **신선도가 다른 두 값의 스프레드**로 곡선 역전 오판 여지. `_source` 라벨은 남기므로 표시층에서 구분 가능한지가 관건(확인 필요).

### C6. 알려진 미해결 설계부채 (v51.88 관찰 보고 잔존분 — 재확인)
- **종가 배당 미조정**: Yahoo chart `close`(비조정) 사용, `adjclose` 미요청 — 모멘텀/추세/백테스트가 고배당주(XLU/KO류)에 구조적 불리. 스크리너 랭킹 공정성 이슈로는 리스트 중 가장 실질적.
- 주봉 컨텍스트 = 끝앵커 5봉 청킹(수정됨)이지만 여전히 **달력 주 경계 무시**(공휴일 주 왜곡).
- Fibonacci 방향 무구분(상승/하락 스윙 동일 처리).
- (size/value는 v51.89에서 해소 — 부호·스케일 정정 완료.)

### C7. 팩터 엔진 자체 평가 (양호 — 기록)
- `_aioComputeFactorRanks`: 섹터 상대 z(소표본 섹터·유니버스 비례 블렌드), winsorize ±3σ, present-팩터 가중 재정규화, 레짐 lerp 블렌드(이진 아님) — **설계 품질 높음.** kalman(log-가격 상태공간, R을 자산 변동성으로 동적화, velConf 신뢰도 가중)도 정성적으로 건전.
- 뉴스 스코어링(서버 scoreServerNewsItem)의 티어·최신성·클릭베이트 필터 체계도 합리적. 다만 우선순위 정규식이 영어 중심 — KR 피드 3슬롯의 스코어링 실효는 낮을 것(확인 필요).

---

## 6. 리스크 매트릭스 (요약)

| # | 발견 | 축 | 심각도 | 근거 위치 |
|---|---|---|---|---|
| A7 | 로컬 git loose 2.4GiB + gc 실패 잔해 370개 (OneDrive 충돌) | 운영 | **P0** | `git count-objects` 실측 |
| A6a | `_context/CLAUDE.md` 인코딩 파손 — 허브 문서 판독 불가 | 거버넌스 | P0(수정 쉬움) | hexdump 실측 |
| A6b | CODE-MAP v50.60 stale(60버전) — 오지도 상태 | 거버넌스 | P1 | LLM_MODELS 라인 불일치 실측 |
| C1 | RSI 서버(Cutler)↔클라(Wilder) 공식 상이 | 알고리즘 | P1 | fetch-data.mjs:625 vs aio-core.js:16586 |
| B5 | 900+ 테스트 CI 미실행(수동 콘솔 전용) | 자동화 | P1 | ci.yml 주석 자인 |
| A3 | computeTradingScore 등 인라인 잔존 + 모듈 역의존 | 아키텍처 | P1 | index.html:22771 |
| C3 | 매매점수 검증 하네스 부재 | 알고리즘 | P1 | — |
| C2 | 백테스트(4팩터)≠라이브(7팩터 레짐) | 알고리즘 | P1 | fetch-data.mjs:707 vs aio-data.js:15961 |
| B1 | Yahoo 단일 의존(서버 대체 소스 0) | 자동화 | P1(발생 시 P0) | fetch-data.mjs:90 |
| B6 | 유니버스=클라 소스 정규식 파싱 | 자동화 | P2 | fetch-data.mjs:593 |
| C4 | HY 근사식 2원화 + `_HY_PROXY` 죽은 쓰기 의심 | 알고리즘 | P2 | aio-data.js:16042 |
| C6 | 배당 미조정 종가(팩터 편향) | 알고리즘 | P2 | fetchHistory — adjclose 미사용 |
| A2 | 전 스크립트 동기 로딩(WO-9 잔존) | 아키텍처 | P2 | index.html:12461 |
| A1/B3 | telegram-digest 2.4MB 부팅 로드 + 30분 재커밋 | 양쪽 | P2 | aio-data.js:1197 |
| B2 | 매크로 일부 수동 갱신(인간 크론) — FRED 확장 여지 | 자동화 | P2 | FRED_SERIES 7종 |
| B4 | 알림 채널 이메일 단일 | 자동화 | P3 | data-watchdog.yml |
| C5 | Yahoo→FRED 브릿지 신선도 혼합 스프레드 | 알고리즘 | P3 | aio-data.js:16096 |
| A4 | 전역 상태 ~3,400 참조(재발 클래스 개방) | 아키텍처 | P3(만성) | 실측 |

---

## 7. Sonnet 5 작업 로드맵 (권장 순서 — 진단자 제안)

각 항목은 독립 커밋 가능 단위. R1(버전 동기화 `node scripts/bump-version.mjs`) · R3(P번호 기록) · CODE-MAP 재스캔 규칙 준수 전제.

### Phase 0 — 안정성 (코드 무관, 즉시)
1. **[A7] 로컬 저장소 복구**: `git gc --aggressive --prune=now` + tmp_obj 정리. 그 후 **운영자 결정 필요**: 리포를 OneDrive 밖으로 이전(권장 — 예: `C:\Projects\AIO`) 또는 최소한 `.git`의 OneDrive 제외 설정. ⚠️ 경로 이전은 로컬 스킬/세션 참조에 영향 — 운영자 확인 후 실행.
2. **[A6a] `_context/CLAUDE.md` 재작성**(UTF-8 정상본) — 내용은 루트 CLAUDE.md·INDEX.md에서 재구성 가능.
3. **[A6b] CODE-MAP v51.90 재스캔** + INDEX.md baseline 갱신 + "2시간↔30분" 문서 drift 정정.

### Phase 1 — 정합성 (알고리즘 신뢰)
4. **[C1] RSI 단일화**: Wilder 기준으로 서버 `_rsi14` 교체(또는 명시적으로 다른 지표로 리네이밍) + 파리티 계약 테스트(동일 closes 입력 → 허용 오차 내 일치)를 ci-data-pipeline-contract-check에 추가.
5. **[C4] HY 스프레드 단일 경로**: `_HY_PROXY` 소비처 확정 → 죽었으면 제거, 살았으면 R266 우선순위 적용 + 근사식 1개로 통일.
6. **[C2] 백테스트-라이브 정렬**: backtestFactors에 size(가격 파생 가능)·value/quality(FMP 존재 시) 추가 + 레짐 가중 대신 "NEUTRAL 가중" 명시 라벨. IC 결과를 history 축적(시계열)으로 저장. UI에 "검증 범위" 정직 표기.
7. **[C6] adjclose 전환 검토**: fetchHistory에 `events=div|split` 또는 adjclose 필드 요청 → 팩터·백테스트 입력만 조정 종가로(차트 표시는 raw 유지 가능). 스크리너 랭킹 변화 폭 실측 후 적용 판단.

### Phase 2 — 자동화 완결
8. **[B5] CI 헤드리스 테스트 job**: Playwright로 로컬 서빙 → `AIO.loadTests(); AIO.runTests()` → env-dependent 테스트는 GATE-BASELINE 분류로 skip 마킹. validate job에 추가(배포 게이트 편입은 flaky 안정화 후).
9. **[B6] 유니버스 데이터 승격**: SCREENER_DB 심볼·섹터·시총을 JSON 아티팩트로 분리, 서버 정규식 파싱 제거, 클라는 부팅 시 로드(§A1 데이터 분리의 1보).
10. **[B2] FRED 시리즈 확장**: UMCSENT(소비자심리)·한국 CPI 등 FRED 존재 시리즈를 FRED_SERIES에 추가 → 해당 카테고리를 수동층에서 자동층으로 이관. /data-refresh 스킬 inventory 갱신.
11. **[B1] 서버 시세 폴백 계층**: Yahoo 실패율 임계 초과 시 Stooq(무키)/Twelve Data(클라와 동일) 폴백 — quotes 코어 심볼만이라도. + **[B4]** 워치독 실패 시 텔레그램 알림 스텝.

### Phase 3 — 구조 진화 (큰 단위, 각각 별도 계획 수립 후)
12. **[A3] 인라인 핵심 로직 모듈 이관**: computeTradingScore/classifyMarketRegime/computeExecutionWindow → aio-core.js(또는 신규 aio-score.js). DOM 폴백 제거. 캐시버스터·CODE-MAP 동반 갱신.
13. **[A2] defer 전환**: 인라인 블록의 파스타임 모듈 심볼 참조 전수 감사 → 전부 이벤트 이후 참조로 확인되면 5개 스크립트 defer + 회귀 테스트.
14. **[A1/B3] 페이로드 다이어트**: telegram-digest를 요약본(부팅용 ~100KB)/전체(온디맨드) 분리. DATA_SNAPSHOT·CHAT_CONTEXTS 데이터 외부화 검토.
15. **[C3] 매매점수 검증 하네스**: history.json 기반 점수 재구성 백테스트(vs forward SPX) — 결과에 따라 가중·계단 경계 재튜닝(이건 별도 리서치 과제).
16. **[A4] 상태 단일화 장기전**: marketState 구독 모델로 소비자 이전 완결(v50.42 방향 지속) — 신규 코드부터 강제하는 RULES 추가 검토.

### 명시적 비권장 (진단자 의견)
- index.html 전면 분해/프레임워크 도입 — 회귀 리스크 대비 이득 낮음. 현 CODE-MAP 운영 유지가 합리적. 분리는 **데이터부터**.
- 거버넌스 문서의 공격적 삭제 — 복리 루프의 자산. 아카이브 분할(연/버전 단위 파일)이면 충분.

---

## 8. 부록: 이번 진단에서 실측한 수치 원본

- 줄 수: index.html 32,065 / aio-core 23,830 / aio-data 17,535 / aio-chat 6,877 / aio-tests 6,982 / aio-ui 5,239 / aio-glossary 314 / fetch-data.mjs 1,183 / sw.js 233 / CF worker 335 — 합계 94,907
- `window.` 참조: core 1,835 / data 704 / chat 277 / ui 205 / index 350
- SCREENER_DB `sym:` 881건 · DATA_SNAPSHOT aio-core.js:18620~18898 · RULES 헤딩 267개(R268까지)
- git: 커밋 598개, 최근 500 중 data: 200 · loose 20,503개/2.40GiB · garbage(tmp_obj) 370개/103.63MiB · size-pack 30.05MiB
- 문서: CHANGELOG 1,369KB / BUG-POSTMORTEM 667KB / RULES 249KB / QA 151KB / KNOWLEDGE-BASE 71KB
- 자동화: cron `17,47 * * * *`(30분) / 워치독 `23 * * * *` / 스크리너 자가 스로틀 6h / history cap 420d / telegram-digest 2.4MB(최근 20커밋 중 10회 변경)
- 모델 ID(2026-07-02 유효성 확인): 서버 haiku-4-5·sonnet-4-6(둘 다 활성, sonnet-4-6은 전세대 — 현행 sonnet-5), 클라 동일 계열
