---
verified_by: agent
last_verified: 2026-04-11
confidence: high
latest_version: v46.5
latest_P_number: P81
next_P_number: P82
total_entries: 81
---

# AIO Screener — 버그 사후 분석 로그 (Bug Postmortem)

> 모든 버그 수정 후 여기에 기록. QA/점검 작업 전 반드시 읽고 기존 패턴 확인.
> 최신 항목이 위에 오도록 역순 기록.
>
> **역참조 태그**: 각 버그 항목에 `violated_rule: R{N}` 태그를 기록하여 규칙→버그 역추적 가능.
> `/knowledge-lint` L7 단계에서 "R5 위반 3회 → 규칙 강화 필요" 같은 빈도 분석 자동 수행.

---

## 문서 관리 원칙

### P 번호 체계
- **P 번호 = 패턴 번호** (예방 규칙 ID). 동일 근본 원인을 가진 버그는 같은 P 번호로 참조.
- **단조 증가**: 신규 P 번호는 `next_P_number`에서 시작 (현재 **P65**). 한번 부여된 번호는 재사용 금지.
- **P 번호 재강화**: 같은 패턴이 재발해도 번호는 유지. "P25 재강화" / "P25 강화" 같은 표현으로 body에 기록.
- **날짜 구분 원칙**: 과거 중복 P 번호(P26~P33 일부 충돌 존재)는 "날짜 + 버전"으로 구분해서 참조.

### 버그 추가 절차
1. frontmatter의 `next_P_number` 확인 → 해당 번호로 버그 body 작성
2. body 작성 후 frontmatter 업데이트:
   - `last_verified: YYYY-MM-DD` (오늘)
   - `latest_version: v{N}.{M}` (수정된 버전)
   - `latest_P_number: P{사용한 번호}`
   - `next_P_number: P{사용한 번호+1}`
   - `total_entries: {이전값+1}`
3. 아래 "최근 P 번호 인덱스"에 1줄 추가 (P41 이후만 관리)
4. `CHANGELOG.md`에 대응 항목 추가 (동일 세션에 필수)

### 버그 body 필수 필드
```markdown
### BUG-{N}: {한 줄 요약} ({HIGH|MEDIUM|LOW|CRITICAL})
- **violated_rule**: R{N} 또는 "신규 P{N}"
- **증상**: 사용자가 본 현상 (화면/콘솔/동작)
- **근본 원인**: 코드/데이터/구조 레벨 원인 (단순 "X 수정" 아님)
- **수정**: 변경 파일 + 라인 번호 + 핵심 diff
- **예방**: P{N} — 재발 방지 규칙 (짧고 명확하게)
```

---

## 최근 P 번호 인덱스 (P41~P68)

> P1~P40은 하단 "패턴 요약" 테이블 참조. P41 이후는 누적 관리.

| P | 도입 버전 | 날짜 | 패턴 요약 |
|---|-----------|------|-----------|
| P41 | v42.1 | 2026-04-05 | 뉴스 표시 컴포넌트 최소 5요소(제목/설명/요약/소스/시간) 렌더링 |
| P42 | v42.1 | 2026-04-05 | 지표 중복 표시 방지 — 동일 데이터 여러 섹션 시 한쪽만 표시 |
| P43 | v42.1 | 2026-04-05 | stale DOM reference — `getElementById` 결과 null이면 HTML에 해당 ID 실재 확인 |
| P44 | v42.4 | 2026-04-06 | bar 요소에 `querySelector('div')` 전에 해당 요소 자체가 bar인지 확인 |
| P45 | v42.4 | 2026-04-06 | HTML `data-snap="X"` 추가 시 `applyDataSnapshot()` map에 동일 키 존재 확인 |
| P46 | v42.4 | 2026-04-06 | Dead Static HTML — 동적 데이터 표시 요소에 반드시 ID 부여 + update 함수 쌍 구현 |
| P47 | v42.4 | 2026-04-06 | raw Canvas 2D 차트는 `clearRect()` + 상태 리셋, `destroyPageCharts()` 케이스 필수 |
| P48 | v42.4 | 2026-04-06 | DATA_SNAPSHOT 갱신 시 브레드쓰 배열(bpLabels/bhLabels/bp*) 동시 갱신 체크리스트 |
| P49 | v42.4 | 2026-04-06 | 하드코딩 데이터 2일 기준 stale 표시 (`getDataAge()` days > 1) |
| P50 | v42.3 | 2026-04-06 | flex/grid 컨테이너 내 텍스트 셀에 `flex:1;min-width:0` 필수 |
| P51 | v42.3 | 2026-04-06 | 페이지 init 함수 호출 전 해당 canvas/DOM 실재 확인, 교차 호출 금지 |
| P52 | v42.5 | 2026-04-06 | TECH_KW/MACRO_KW 키워드 추가 시 len < 3 체크 + 기존 배열 더 긴 동의어 존재 확인 |
| P53 | v42.5 | 2026-04-06 | 홈 요약 수치에 R15 적용 필수. `?.` + `\|\| 숫자` 조합 금지 |
| P54 | v42.5 | 2026-04-06 | 3단계 score 임계값 고정: 홈(90+) / 브리핑(45+) / 피드(30+) |
| P55 | v42.5 | 2026-04-06 | font-size CSS class 정의도 11px 이상 확인. inline override는 class 미포함 |
| P56 | v42.6 | 2026-04-06 | init 함수 내 cleanup 루프 중복 금지 ("생성 → 즉시 destroy" 패턴 검출) |
| P57 | v42.6 | 2026-04-06 | 고정 `repeat(N,1fr)` 그리드 mobile 375px 오버플로 확인 — 6열 이상 auto-fit/minmax |
| P58 | v42.7 | 2026-04-06 | applyDataSnapshot map 키 추가 시 HTML에 `data-snap="해당키"` 실재 확인 |
| P59 | v42.7 | 2026-04-06 | API 응답 의존 전역 변수는 정적 폴백(DATA_SNAPSHOT)으로 초기화 필수 |
| P60 | v42.7 | 2026-04-06 | 복수 페이지 동일 데이터 표시 시 각 페이지 liveQuotes 리스너에 공통 update 함수 연결 |
| P61 | v44.6 | 2026-04-08 | DATA_SNAPSHOT 수치 갱신 후 하드코딩 서술 텍스트(코멘트/섹션/시나리오) 정합성 체크 병행 |
| P62 | v44.6 | 2026-04-08 | "이 함수는 X를 표현할 수 없다" 판단 시 WARN 방치 금지 — 구조 확장으로 해결 |
| P63 | v44.6 | 2026-04-08 | 모든 setInterval 반환값은 `window._xxxInterval` 변수 저장. setInterval/clearInterval 수 일치 |
| P64 | v44.9 | 2026-04-09 | SCREENER_DB 신규 종목 추가 시 KNOWN_TICKERS 알파벳순 동시 등록 |
| P65 | v45.6 | 2026-04-09 | 홈 섹터 브리핑 완전 하드코딩 → 실시간 _liveData 섹터 ETF 기반 동적 생성으로 교체 |
| P66 | v45.6 | 2026-04-09 | macro Pro CHAT_CONTEXTS 시나리오 수치가 이벤트 이전 극점에 고착 → _liveSnap() 실시간 주입 |
| P67 | v45.6 | 2026-04-09 | signal VIX "—" 영구 정체 → quotes 미수신 시 _liveData/DATA_SNAPSHOT 폴백 체인 |
| P68 | v45.6 | 2026-04-09 | data-refresh 스킬에 한국장 수급/테마(H4~H5) + 24h 뉴스 WebSearch(I그룹) 구조적 보강 |
| P69 | v46.2 | 2026-04-10 | CHAT_CONTEXTS signal/breadth/sentiment/theme-detail 미정의 → silent failure. _aiCtxMap/Chips 미매핑. commands wrapper 4개 누락 |
| P70 | v46.3 | 2026-04-10 | Stooq 폴백 지수 매핑 오류: ^GSPC→SPY(spy.us) 매핑 시 ETF 가격($680)이 지수(6800)에 주입되어 10배 괴리. pct도 시가 대비로 계산(전일 대비 아님). 지수/선물 스킵 리스트 분리 + chartPreviousClose 우선으로 수정 |
| P71 | v46.3 | 2026-04-10 | Stooq 선물 심볼 미지원: ES=F/NQ=F/YM=F가 esf.us/nqf.us/ymf.us로 변환되어 Stooq에서 N/D 반환. `sym.includes('=F')` 가드 추가. 원자재 선물(CL=F/GC=F 등)은 명시 매핑(cl.f/gc.f)으로 별도 처리 |
| P72 | v46.4 | 2026-04-11 | 트레이딩 스코어 폴백값이 3월 전쟁 피크 기준(F&G=18, breadth=27.1, PCR=1.21)으로 고정 → DATA_SNAPSHOT._fallback 단일 진실 원천 신설. 24곳 참조 통일 |
| P73 | v46.4 | 2026-04-11 | 브리핑 캘린더 요일 전부 오류(4/10=목→금, 4/13=일→월 등) + PPI 4/11 토요일 + 워시 청문회 4/16→4/13. 14곳 일괄 수정 |
| P74 | v46.4 | 2026-04-11 | .page overflow-x:hidden → CSS 명세에 의해 overflow-y 자동 auto 변환 → .page가 스크롤 컨테이너화 → .content 스크롤과 충돌. themes 페이지 마우스 휠 무반응. overflow-x:hidden 제거로 해결 |
| P75 | v46.4 | 2026-04-11 | FOMC 일정 5/5-6 → 4/28-29 오류. eventDates + DATA_SNAPSHOT.fomc + 한국거시 캘린더 + 시스템 프롬프트 14곳 동시 수정 |
| P76 | v46.4 | 2026-04-11 | 브레드쓰 폴백값 불일치: 시그널 페이지(68/75/46) vs 브레드쓰 페이지(35/32/27.6). 차트 배열 마지막 값과 정렬. 색상/배지/해석 텍스트 동시 갱신 |
| P77 | v46.5 | 2026-04-11 | 번역 배치 분리자(§§§) 실패 시 8건 전부 null 반환. 개별 1건씩 재시도 폴백 추가. Google Translate가 구분자를 번역/변형하면 전체 배치 손실 |
| P78 | v46.5 | 2026-04-11 | 테마 히트맵/세분화 테마 renderThemeHeatmap()/renderSubThemesGrid()에서 _liveData<5이면 500ms 후 무한 재시도. 프록시 전면 장애 시 CPU 100% + 영구 "로딩 중". 최대 60회(30초) 제한 추가 |
| P79 | v46.5 | 2026-04-11 | Brent 원유 $— 표시. brentPrice = brent.price \|\| 0에서 DATA_SNAPSHOT.brent 폴백 누락. WTI도 동일 패턴 수정 |
| P80 | v46.5 | 2026-04-11 | getTopicBadge()에 healthcare/shipbuilding/space/quantum 4개 토픽 배지 누락. TOPIC_KEYWORDS에는 있지만 배지 map에 없어 'general'로 폴백. 4개 배지 추가 |
| P81 | v46.5 | 2026-04-11 | 10+페이지 "로딩 중" 영구 고정. 프록시 전면 장애 시 signal/sentiment/fxbond/themes/options/kr-* 등 10개 페이지에서 "로딩 중..."이 영구 표시. 글로벌 워치독(60초 활성/75초 비활성) 추가 |
| P65 | v45.5 | 2026-04-09 | 토글/모드 변수는 렌더 함수 내부에서 실제로 분기 사용되는지 grep 검증 (UI에 버튼만 wired된 dead toggle 방지) |
| P66 | v45.5 | 2026-04-09 | 데이터 미수신 상태에서 "로딩" 텍스트 영구 정체 금지 — 폴백 데이터 우선 사용, 그래도 없으면 "대기/—"로 명시 |
| P67 | v45.5 | 2026-04-09 | 같은 동급 컴포넌트(pulse-seg/카드)는 동일 자식 구조 유지. 한쪽만 자식 누락 시 시각 정렬 깨짐 |

---

## 바이너리 Self-Eval (/knowledge-lint L7에서 자동 체크)

문서 건강성 판정. 각 항목 **명시적으로 yes/no** 답변.

| # | 평가 항목 | 기준 |
|---|-----------|------|
| **BP1** | frontmatter 최신성 | `last_verified` 날짜가 최근 버그 수정일(body 최상단 날짜)과 일치하는가? |
| **BP2** | P 번호 연속성 | `next_P_number`가 body 최신 P 번호 + 1과 일치하는가? |
| **BP3** | 신규 P 인덱스 등록 | body에 추가된 모든 P41+ 번호가 위 "최근 P 번호 인덱스"에 등록되었는가? |
| **BP4** | violated_rule 태그 | 최근 5개 버그 항목 모두 `violated_rule` 필드가 있는가? (R번호 또는 "신규 P{N}") |
| **BP5** | CHANGELOG 쌍대 | 버그 수정일 기준 CHANGELOG.md에 대응 버전 항목이 존재하는가? |
| **BP6** | 중복 검출 | 같은 증상의 버그가 이미 기록되어 있는지 확인했는가? (반복 버그는 기존 항목 update) |

### 판정 규칙
- **전부 yes** → 문서 건강 ✓
- **1~2개 no** → WARN, 다음 `/knowledge-lint` 세션에서 정비
- **3개 이상 no** → FAIL, 즉시 정비 (frontmatter 갱신, 인덱스 재동기화)

---

## [2026-04-09] v45.5 -- 표면 점검의 사각지대 3건 (마켓 펄스 정렬·RRG 로딩·섹터 1주 토글)

### BUG-1: 섹터 1일/1주 토글 — `_sectorPerfMode` 변수 미사용 (HIGH)
- **violated_rule**: 신규 P65
- **증상**: 섹터 ETF 퍼포먼스 카드의 1일/1주 탭이 wired up 되어 있고 클릭 시 active 클래스도 토글됨. 그러나 1주 클릭해도 표시 데이터는 1일과 100% 동일. 즉 사용자에게 보이는 두 모드의 결과가 똑같음.
- **근본 원인**: `renderSectorPerfBars()`가 `var chg = d && d.pct != null ? d.pct : null` 한 줄로 끝남. `_sectorPerfMode === '1w'` 분기 없음. 1주용 데이터 소스(주간 수익률) 자체가 미구현. 토글 함수 `setSectorPerfMode()`는 변수만 갱신하고 아무 효과 없음 — dead toggle.
- **수정**: index.html L34297~34480
  - `_sectorWeeklyCache` 객체 + `_sectorWeeklyFetching` 플래그 + `_SECTOR_PCT_FALLBACK` (정적 daily 폴백)
  - `_fetchOneSectorWeekly(sym)`: Yahoo Finance `range=5d&interval=1d` → `fetchViaProxy()` → `_parseYFChartResponse()` → 5일 first/last close로 수익률 계산
  - `fetchSectorWeeklyPerf()`: 동시 4개 제한 큐, 누락 섹터만 retry 가능, 완료 시 자동 재렌더
  - `renderSectorPerfBars()`: `isWeekly` 분기 추가. 1주는 캐시 → live daily → static fallback 순. 1일은 live → static fallback
  - `setSectorPerfMode('1w')`: 미보유 섹터 자동 fetch
  - themes 페이지 진입 시 백그라운드 프리페치
- **예방**: P65 — UI 토글/모드 추가 시 렌더 함수 내부에서 해당 변수가 실제로 분기 사용되는지 grep 검증. "wired up = 작동"이 아님. QA 시 토글 클릭 → 결과 비교 필수.

### BUG-2: 마켓 펄스 바 — 매크로 segment 정렬 + 로딩 영구 정체 (MEDIUM)
- **violated_rule**: 신규 P66 + P67
- **증상**:
  1. 매크로 segment의 "PULLBACK"/"CORRECTION" 텍스트가 다른 segment의 라벨("매매자제"/"건강")보다 시각적으로 훨씬 크게 표시 → 4 segment 정렬 깨짐
  2. 시장폭/심리 segment가 데이터 미수신 시 "—로딩" 상태로 영구 정체 (수십초 후에도 동일)
- **근본 원인**:
  1. HTML L2226~2229의 매크로 segment가 `<span class="ps-val">`(11px/800)에만 텍스트를 표시하고 `<span class="ps-status">`(8px/600) 누락. 다른 3개 segment는 ps-val + ps-status 둘 다 가짐. CSS는 둘을 의도적으로 다른 크기로 정의했기에, 매크로만 ps-val 큰 글씨 → 정렬 깨짐.
  2. `updateMarketPulse()` L32887~32898에서 `if (bVal !== null && !isNaN(bVal))` 조건 안에서만 텍스트 갱신 → 데이터 미수신 시 초기 "로딩" 텍스트가 영구히 남음. `_breadth200`/`_lastFG`가 다른 페이지에서만 채워지는 변수라 홈에서 즉시 불가.
- **수정**: index.html L2226~2230 + L32870~32940
  - HTML: 매크로 segment에 `mp-macro-icon`(ps-val ●) + `mp-macro-val`(ps-status 텍스트) 분리
  - JS: 시장폭 폴백 → `calcSectorBreadth(11섹터)` (즉시 계산 가능), 심리 폴백 → `DATA_SNAPSHOT.fg`, 매크로 → 아이콘+텍스트 동시 갱신. 모든 segment에서 데이터 없으면 "대기"로 명시 표시
- **예방**: P66 — 데이터 미수신 시 "로딩" 영구 정체 금지. 폴백 데이터 우선, 없으면 "대기/—" 명시. P67 — 같은 동급 컴포넌트는 동일 자식 구조 유지. QA-CHECKLIST 마켓 펄스 항목에 "4 segment 모두 ps-val + ps-status 동일 구조" 체크 추가.

### BUG-3: RRG 차트 — 로딩 상태 표시 부재 (LOW)
- **violated_rule**: R8 (차트 텍스트 폴백)
- **증상**: themes 페이지 첫 진입 시 RRG 차트에 4분면 배경만 보이고 섹터 점이 전혀 없음. 사용자가 "차트 안 나옴"으로 오인 (실제로는 시세 로딩 중).
- **근본 원인**: `drawRRG()` L34151에서 `Object.keys(ld).length < 10`이면 즉시 return + setTimeout retry. retry 중 `rrg-chart-status` 텍스트 미설정 → 사용자가 진행 상태 모름. 또한 < 10 조건이 너무 추상적, 실제로 필요한 건 SPY 존재 여부.
- **수정**: index.html L34151~34164
  - 게이트 조건을 `!ld['SPY']`로 단순화 (SPY 없으면 calcLiveRS 동작 불가)
  - retry 중 status 텍스트에 "시세 로딩 중... (N개 수신)" 표시
  - 최대 대기 30초 → 20초로 단축, 실패 시 "시세 연결 지연 — 잠시 후 자동 갱신됩니다"
- **예방**: R8 강화 — 모든 동적 차트는 로딩 상태에서도 사용자가 인지 가능한 텍스트 표시. 빈 캔버스 + 무 표시 = 결함.

---

## [2026-04-09] v44.9 -- /bug-fix SCREENER_DB 신규 종목 KNOWN_TICKERS 미등록 (1건)

### BUG-1: SCREENER_DB 신규 종목 KNOWN_TICKERS 누락 — 뉴스 티커 배지 미작동 (MEDIUM)
- **violated_rule**: R10 (종목코드 3중 검증) + 신규 P64
- **증상**: v44.8에서 SCREENER_DB에 추가된 KEX·NVT·MTZ·SEI·LBRT 5종목이 KNOWN_TICKERS Set에 미등록. 뉴스 피드에서 해당 종목 관련 기사에 티커 배지가 표시되지 않음. `extractTickers()` 함수가 KNOWN_TICKERS를 참조하여 티커 매칭하므로 등록 누락 시 뉴스-종목 연결 완전 차단.
- **근본 원인**: SCREENER_DB에 종목 추가 시 KNOWN_TICKERS 동시 등록 규칙이 체크리스트에 없었음. 두 배열이 별개 위치(SCREENER_DB ~L10500, KNOWN_TICKERS ~L13777)에 있어 하나만 수정하고 다른 하나를 놓치는 패턴.
- **수정**: KEX·LBRT·MTZ·NVT·SEI를 KNOWN_TICKERS에 알파벳순 삽입 (L13808·13809·13815·13817·13825).
- **예방**: P64 — SCREENER_DB에 신규 종목 추가 시 KNOWN_TICKERS에도 반드시 동시 등록. QA-CHECKLIST 3F 단계에 "KNOWN_TICKERS 등록 여부" 항목 추가.

---

## [2026-04-08] v44.6 -- /post-edit-qa 이란 휴전 이벤트-드리븐 정합성 QA (6건 + 구조 개선 3건)

### BUG-1: 이란 휴전 후 하드코딩 텍스트 6곳 역방향 (HIGH)
- **violated_rule**: R21 (데이터 경과일 관리) + 신규 P61
- **증상**: WTI -15% 휴전 합의 이후에도 스크리너 내 6곳이 "이란전쟁發 유가급등", "수요가 무너지고 있다", "이란 제재 해제 진행중(◐)" 등 전쟁 피크 서술 유지. 사용자가 현재 시장 상황을 오독할 수 있음.
- **근본 원인**: DATA_SNAPSHOT 수치(wti, brent, gold)는 이벤트 발생 즉시 갱신되나, static HTML 서술 텍스트(코멘트·섹션 제목·옵션 상태·시나리오 조건)는 별도 갱신 루틴이 없어 이전 이벤트 맥락 그대로 잔존.
- **수정**: 6곳 텍스트 현실 반영: 한국 물가 코멘트·수입 코멘트·수요파괴 섹션 제목·JPM 6옵션·시나리오 A 조건·CP1 지정학 카드 detail + 미터바.
- **예방**: P61 — DATA_SNAPSHOT 수치 갱신(data-refresh) 후 반드시 텍스트 서술 정합성 체크 병행. `/bug-fix` 스킬 Gotcha #7 + 이벤트-드리븐 체크리스트 신설.

### BUG-2: generateMacroStoryline() 지정학 맥락 부재 (구조적 공백)
- **violated_rule**: R26 (기술 인사이트 환류) + 신규 P62
- **증상**: 매크로 스토리라인이 "WTI $95.5 = 경고 수준"이라고만 표시하고 왜 이 가격인지(미-이란 2주 휴전, 재교전 리스크) 맥락 전무. 이벤트-드리븐 장세에서 수치만 보여줌.
- **근본 원인**: 함수가 순수 실시간 수치(VIX·WTI·TNX) 기반 분기만 있고 "이 수치가 형성된 이유"를 서술하는 지정학 챕터 없음. "구조적 한계"로 오판하여 WARN으로 방치.
- **수정**: WTI 8%+ 급변 OR VIX 25+ && WTI 85+ 시 자동 감지하는 지정학 챕터 신설(L26952~26989). live pct 우선 + DATA_SNAPSHOT.wtiPct 폴백. 급락/급등/지속 3분기 내러티브.
- **예방**: P62 — "이 함수는 X를 표현할 수 없다"는 판단이 나오면 WARN 방치 금지. 구조를 확장해서 해결. `/bug-fix` 스킬 Gotcha #8 신설.

### BUG-3: 전역 setInterval 익명 등록 — 추적 불가 (MEDIUM)
- **violated_rule**: 신규 P63
- **증상**: `setInterval` 13개 중 2개(DATE_ENGINE, checkPriceAlerts)가 반환값 미저장. DevTools에서 콘솔 clearInterval 불가, 누수 의심 시 식별 불가.
- **근본 원인**: 전역 타이머를 "어차피 영구 실행"으로 간주해 변수 등록 생략.
- **수정**: `window._dateEngineInterval`, `window._globalUpdateInterval`으로 명명 등록. setInterval/clearInterval 수 11/11 완벽 균형.
- **예방**: P63 — 모든 setInterval 반환값은 `window._xxxInterval` 변수에 저장. `grep -c 'setInterval' == grep -c 'clearInterval'` 이 수치가 같아야 함.

---

## [2026-04-06] v42.7 -- 심층 QA 에이전트 FAIL/WARN 3건 (3건)

### BUG-1: fomc-next 데드코드 (map + DOMContentLoaded)
- **violated_rule**: R9 (Dead Page 방지)
- **증상**: `applyDataSnapshot()` map에 `'fomc-next'` 키가 있으나 HTML에 `data-snap="fomc-next"` 요소 없음. DOMContentLoaded에서도 `querySelector('[data-snap="fomc-next"]')` 쿼리하지만 항상 null → 무음 실패.
- **근본 원인**: 경제 캘린더 다음 FOMC 날짜 표시 기능이 기획되었으나 HTML 바인딩 없이 JS만 구현된 상태. `if (fomcEl)` 가드로 런타임 에러는 없지만 데드코드.
- **수정**: map에서 `'fomc-next'` 키 제거, DOMContentLoaded에서 `fomcEl` 블록 제거.
- **예방**: P58 — applyDataSnapshot map 키 추가 시 반드시 HTML에 `data-snap="해당키"` 요소 존재 확인.

### BUG-2: _lastFG 초기값 없음 — API 응답 전 FG 의존 컴포넌트 오작동
- **violated_rule**: R4 (전역 변수 초기화 순서)
- **증상**: `fetchFearGreed()` API 응답 전 AI 분석 채팅, 매매 점수, 심리 페이지 상태값이 모두 18(극단공포) 고정. `DATA_SNAPSHOT.fg = 12`인데 다른 값 반환.
- **근본 원인**: `window._lastFG`가 `fetchFearGreed()` 콜백에서 처음 설정됨. 그전에는 `window._lastFG || 18` 폴백값 18 사용.
- **수정**: `applyDataSnapshot()` 직후 `window._lastFG = DATA_SNAPSHOT.fg || 18` 초기화 추가.
- **예방**: P59 — API 응답 의존 전역 변수는 정적 폴백(DATA_SNAPSHOT)으로 초기화 필수. API 응답 전 `undefined` 상태 방지.

### BUG-3: signal 페이지 breadth 바 항상 하드코딩 초기값
- **violated_rule**: R9 (Dead Page 방지)
- **증상**: signal 페이지의 "시장 폭" 바(5SMA/20SMA/50SMA 위 비율)가 breadth 페이지 방문 전까지 항상 하드코딩 초기값(35%, 32%, 27.6%) 표시.
- **근본 원인**: `updateBreadthBars()`는 `initBreadthPage()` 내에서만 호출됨. signal 페이지의 `aio:liveQuotes` 리스너에 연결 없음.
- **수정**: signal 페이지 `aio:liveQuotes` 리스너에 `updateBreadthBars()` 추가.
- **예방**: P60 — 복수 페이지에서 동일 데이터 표시 시 각 페이지의 liveQuotes 리스너에 공통 업데이트 함수 연결.

---

## [2026-04-06] v42.6 -- initSentimentPage 중복 cleanup 루프 + macro 모바일 overflow (2건)

### BUG-1: AAII/PC 차트 blank (sentimentPage 중복 cleanup)
- **violated_rule**: R9 (Dead Page 방지)
- **증상**: 투자 심리 페이지 진입 시 AAII(미국 개인투자자 설문) 및 P/C(풋콜비율) 차트가 빈 canvas로 표시. 데이터는 있으나 렌더 없음.
- **근본 원인**: `initSentimentPage()` 내부 실행 순서 문제. `initSentimentCharts()`로 AAII+PC 생성 후, 동일 함수 중반의 두 번째 `Object.keys(sentPageCharts).forEach(destroy)` 루프가 방금 만든 AAII+PC를 재destroy. VIX/NAAIM/II/HY는 그 뒤에 생성되므로 영향 없음. AAII+PC는 destroy 후 재생성 없음.
- **수정**: 두 번째 중복 cleanup 루프(L19304~19309) 제거. 첫 번째 루프가 이미 pre-existing 차트를 모두 처리.
- **예방**: P56 — init 함수 내 cleanup 루프 중복 금지. "생성 → 즉시 destroy" 패턴은 코드 리뷰에서 반드시 검출.

### BUG-2: macro 페이지 외환·채권 그리드 모바일 overflow
- **violated_rule**: R5 (CSS overflow 3중 방어)
- **증상**: 모바일(375px) macro 페이지에서 외환·채권 요약 섹션이 수평으로 overflow → 페이지 전체 가로 스크롤 발생.
- **근본 원인**: `grid-template-columns:repeat(6,1fr)` — 6개 고정 컬럼이 좁은 컨테이너(~329px)에서 ~55px/col로 축소. `mfx-cell` 내 USD/KRW 등 4-5자 레이블이 셀 너비 초과.
- **수정**: `repeat(6,1fr)` → `repeat(auto-fit,minmax(85px,1fr))`. 모바일: 3열×2행, 데스크톱: 6열 1행.
- **예방**: P57 — 고정 repeat(N,1fr) 그리드는 mobile 375px에서 N×min-content > container width 여부 확인 필수. 6열 이상은 auto-fit/minmax 검토.

---

## [2026-04-06] v42.5 -- 미커버 영역 전수 QA: 뉴스 키워드 / R15 패턴 / 보안 / 접근성 / 성능 (9건)

### BUG-1: TECH_KW '팹' 1글자 키워드 R17 위반 (HIGH)
- **violated_rule**: R17 (키워드 길이 제한)
- **증상**: `'팹'` 단독 1글자 키워드가 TECH_KW에 존재. 한 글자 매칭으로 "팹리스", "팹레스", "테라팹" 외 모든 '팹' 포함 문자열에 오탐 가능.
- **근본 원인**: v31.8 한국 반도체 키워드 추가 시 '웨이퍼','실리콘','팹','가동률','수율' 목록에 단독 1글자 추가.
- **수정**: `'팹'` → `'팹리스'` 교체.
- **예방**: P52 — TECH_KW/MACRO_KW 키워드 추가 시 len < 3 체크. 1글자 단독 한글 키워드 절대 금지.

### BUG-2: MACRO_KW 중복 2글자 키워드 — 긴 버전 이미 존재 (MEDIUM)
- **violated_rule**: R17
- **증상**: `'봉쇄'`(해상봉쇄 존재), `'물가'`(소비자물가/생산자물가/근원물가 존재), `'고용'`(고용지표/신규고용/비농업고용 존재) — 더 긴 동의어가 이미 배열에 있어 2글자 버전 중복.
- **수정**: 3개 제거. `'긴축'` → `'긴축정책'`, `'피봇'` → `'금리피봇'` 확장.
- **예방**: P52 보강 — 새 키워드 추가 시 기존 배열에 더 긴 동의어 존재 여부 확인. 2글자 추가 전 `grep '기존키워드'` 선행.

### BUG-3: d.pct || 0 패턴 5건 R15 위반 (MEDIUM)
- **violated_rule**: R15 (데이터 미수신 vs 0% 구분)
- **증상**: AI 채팅 컨텍스트 빌드 함수 5곳에서 `d.pct || 0` 패턴 사용. `pct === null`(미수신)과 `pct === 0`(실제 보합)을 구분하지 못해 미수신 데이터를 "0% 변동"으로 표시 가능.
- **근본 원인**: AI 컨텍스트 빌드 함수는 UI 렌더 아님에도 동일 패턴 적용.
- **수정**: `(d.pct != null) ? d.pct : 0` 명시적 null 체크 5건 적용.
- **예방**: R15 재확인 — `|| 0` 패턴은 JS에서 `0`도 falsy이므로 실제 0%를 0으로 대체. 항상 `!= null` 체크 사용.

### BUG-4: spx.pct?.toFixed(2) || '0.00' R15 위반 (MEDIUM)
- **violated_rule**: R15
- **증상**: 홈 요약 텍스트(`summarytxt`)에서 `spx.pct` 미수신 시 `'0.00'` 폴백으로 "S&P 500 +0.00%" 표시 — 데이터 미수신인지 실제 보합인지 구분 불가.
- **수정**: `spx.pct != null ? spx.pct.toFixed(2) : '—'` + summarytxt에서 `'—'` 분기 처리.
- **예방**: P53 — 홈 요약 텍스트 등 사용자에게 직접 표시되는 수치에 R15 적용 필수. `?.` 옵셔널 체이닝 + `|| 숫자` 조합 금지.

### BUG-5: 브리핑 score 임계값 40 — R22 기준 45 불일치 (MEDIUM)
- **violated_rule**: R22 (뉴스 계층적 선별)
- **증상**: 데일리 브리핑이 score 40+ 뉴스를 포함. R22는 브리핑 기준을 45+로 규정.
- **수정**: `>= 40` → `>= 45`.
- **예방**: P54 — 3단계 score 임계값 홈(90+) / 브리핑(45+) / 피드(30+) 고정. 변경 시 R22 명시 확인 필수.

### BUG-6: e.message innerHTML 직접 삽입 — XSS 이론적 위험 (LOW)
- **violated_rule**: 신규 (보안)
- **증상**: 브리핑 catch 블록에서 `e.message` 미이스케이프 HTML 삽입. JS Error.message가 fetch 응답 등 외부 문자열 포함 시 이론적 XSS 가능.
- **수정**: `escHtml(e.message || '알 수 없는 오류')` 적용.
- **예방**: P26 재확인 — catch 블록의 `e.message` 포함, 모든 런타임 문자열이 innerHTML에 들어갈 때 escHtml 필수.

### BUG-7: CSS class font-size:8px P37 위반 — inline override 미적용 (MEDIUM)
- **violated_rule**: 신규 (접근성 P37)
- **증상**: `.kr-badge`, `.kr-tag`, `.tac-score-label`, `.tac-radar-table th`, `.tac-heat-badge` CSS class 정의에 8px. 기존 `[style*="font-size:8px"]` override는 inline style만 대상 → class 기반은 미적용.
- **수정**: 해당 5개 CSS class 정의를 8px → 11px 직접 변경.
- **예방**: P55 — font-size 설정 시 CSS class 정의도 11px 이상 확인. inline override는 class 기반 규칙 미포함.

### BUG-8: destroyPageCharts KR 페이지 4개 케이스 없음 (MEDIUM)
- **violated_rule**: R9 (Dead Page 방지 — 메모리 누수)
- **증상**: `kr-home`, `kr-supply`, `kr-themes`, `kr-macro` 페이지 이탈 시 Chart.js canvas 미정리 가능성. `kr-technical`만 명시적 정리 있음.
- **수정**: 4개 페이지에 `#page-{id} canvas` 전체 순회 정리 케이스 추가.
- **예방**: P47 보강 — 새 페이지 추가 시 `destroyPageCharts()` 케이스 동시 추가. KR 페이지군은 별도 케이스 필수.

---

## [2026-04-06] v42.4 -- 전수 QA 수정: Dead DOM / breadth / macro / RRG / mobile (7건)

### BUG-5: breadth-bar querySelector('div') null — 게이지 항상 50% 고정 (HIGH)
- **violated_rule**: R9 (Dead Page 방지)
- **증상**: technical 페이지 "시장 건강도" 섹션의 마켓 폭(50MA 위 비율) 게이지가 항상 50% 고정값 표시. 실시간 데이터 연결 안 됨.
- **근본 원인**: `breadthEl.querySelector('div').style.width` — `#breadth-bar` 요소 자체가 bar이며 자식 div 없음. `querySelector('div')` = null. `if (breadthEl && breadthEl.querySelector('div'))` 가드가 null 방지하지만 업데이트 자체도 실행 안 됨.
- **수정**: `if (breadthEl) breadthEl.style.width = above50ma + '%'` 직접 적용.
- **예방**: P44 — bar 요소에서 `querySelector('div')`로 자식 div를 찾기 전, 해당 요소 자체가 bar인지 확인. `el.style.width` 직접 설정이 기본 패턴; 내부 wrapper div가 있을 때만 querySelector 사용.

### BUG-6: applyDataSnapshot map 4개 키 누락 — macro 카드 4개 영구 고정값 (HIGH)
- **violated_rule**: R21 (데이터 경과일 관리)
- **증상**: macro 페이지 소비·고용·주택 카드 4개(소매판매, 임금상승, 소비자심리, 주택착공) 값이 HTML 하드코딩 고정값(+0.6%, 3.8%, 104.7, 1.42M)으로 영구 표시. DATA_SNAPSHOT 갱신에도 화면 변경 없음.
- **근본 원인**: HTML에 `data-snap="retail-sales"` 등 4개 선언되어 있으나 `applyDataSnapshot()`의 map 객체에 해당 키-값 쌍 없음. map 누락 키는 무음 처리(no-op).
- **수정**: map에 `'retail-sales'`, `'wage-growth'`, `'cons-conf'`, `'housing'` 4개 키-값 쌍 추가.
- **예방**: P45 — HTML에 `data-snap="X"` 속성 추가 시 `applyDataSnapshot()` map에 동일 키 `'X'` 존재 여부 즉시 확인. 신규 `data-snap` 추가는 map 수정 없이 효과 없음.

### BUG-7: signal 페이지 브레드쓰 바 6행 Dead Static HTML — 초기값 영구 고정 (HIGH)
- **violated_rule**: R9 (Dead Page 방지)
- **증상**: 시장 폭 섹션의 5SMA/20SMA/50SMA/McClellan/Weinstein 행이 항상 초기 하드코딩 값 표시 (4/1 기준 고정). 실시간 데이터 반영 안 됨.
- **근본 원인**: 브레드쓰 바 HTML 행에 ID 없어 JS 업데이트 불가. `initBreadthPage()`가 `window._breadth*` 전역 변수를 설정하지만 이를 DOM에 반영하는 함수 없음 (Dead Static HTML 패턴).
- **수정**: 5SMA/20SMA/50SMA 행에 ID 부여(`bb-5sma-bar`/`bb-5sma-val`/`bb-5sma-badge` 등) + `updateBreadthBars()` 함수 신설 + `initBreadthPage()` 끝에서 호출.
- **예방**: P46 — 동적 데이터를 표시하는 HTML 요소에 반드시 ID 부여. `window._xxx` 전역 변수 설정 후 DOM 반영 함수(`update*()`) 호출까지 한 쌍으로 구현. 단독 전역 변수 설정은 Dead Static HTML 위험 신호.

### BUG-8: breadth 페이지 NDX 카드 하드코딩 고정값 (HIGH)
- **violated_rule**: R9 (Dead Page 방지)
- **증상**: breadth 페이지 "나스닥 구성주 현황" 카드의 5일선/20일선/50일선 값이 항상 하드코딩(33.4%, 23.2%, 27.6%) 고정. BUG-7과 동일 원인.
- **근본 원인**: `bp-ndx5-val`/`bp-ndx20-val`/`bp-ndx50-val` ID 없음 → JS 업데이트 불가.
- **수정**: ID 부여 + `updateBreadthBars()`에서 `window._breadthNDX5/20/50` 전역 캐시 읽어 동기 갱신. `initBreadthPage()`에서 NDX 전역 캐시 추가 설정.
- **예방**: P46 (위와 동일) — Dead Static HTML 패턴.

### BUG-9: destroyPageCharts themes 케이스 누락 — RRG canvas 잔상 가능성 (MEDIUM)
- **violated_rule**: R9 (Dead Page 방지)
- **증상**: themes 페이지 이탈 후 재진입 시 RRG canvas에 이전 그리기 잔상 가능성.
- **근본 원인**: `destroyPageCharts()`에 `themes` 케이스 없음. `drawRRG()`가 raw Canvas 2D API 사용 — Chart.js destroy와 달리 `clearRect` 없이 재그리면 잔상.
- **수정**: `destroyPageCharts`에 themes 케이스 추가 — `rrg-canvas.getContext('2d').clearRect(0,0,w,h)` + `_rrgRetry = 0` 리셋.
- **예방**: P47 — raw Canvas 2D API 사용 차트는 Chart.js `destroy()` 대신 `clearRect()` + 상태 변수 리셋으로 정리. `destroyPageCharts()`에 해당 케이스 누락 없이 추가.

### BUG-10: bpLabels/bhLabels 6주 이상 구식 — 브레드쓰 차트 R21 위반 (HIGH)
- **violated_rule**: R21 (데이터 경과일 관리)
- **증상**: 브레드쓰 차트(bp/bh)가 2/20~3/19 범위 데이터만 표시. 현재(4월 초) 기준 6주 괴리. DATA_SNAPSHOT은 최신인데 차트 레이블만 구식.
- **근본 원인**: DATA_SNAPSHOT 갱신 시 브레드쓰 배열(`bpLabels`, `bhLabels`, `bpSPX*`, `bpNDX*`, `bhSPX*`, `bhNDX*`) 미갱신. 두 데이터소스 갱신 주기 불일치.
- **수정**: `bpLabels`/`bhLabels` → 3/6~4/2 (20거래일), 모든 브레드쓰 배열 교체.
- **예방**: P48 — DATA_SNAPSHOT 날짜 갱신 시 브레드쓰 배열도 동시 갱신 체크리스트 항목. 두 소스 날짜 범위가 2주 이상 괴리 시 경고.

### BUG-11: getDataAge() 임계값 너무 관대 — stale 경고 미표시 (MEDIUM)
- **violated_rule**: R21 (데이터 경과일 관리)
- **증상**: DATA_SNAPSHOT이 2일 경과했음에도 breadth/sentiment 페이지 stale 배지 미표시. 사용자가 구식 데이터를 최신으로 오인 가능.
- **근본 원인**: `getDataAge()` stale 조건 `days > 3` — 4일 이상만 stale 처리.
- **수정**: `days > 1` (2일 이상 stale)로 변경.
- **예방**: P49 — 하드코딩 데이터(DATA_SNAPSHOT)는 2일 기준 stale 표시. 실시간 API 데이터는 별도 freshness 체크.

---

## [2026-04-06] v42.3 -- 전수 QA 수정: 브레드쓰 바 레이아웃 / Dead Section / fxbond (4건)

### BUG-1: .bb-label 텍스트 overflow — bar와 겹침 (MEDIUM)
- **violated_rule**: R7 (한국어 텍스트 레이아웃)
- **증상**: signal 페이지 브레드쓰 바 섹션에서 "20SMA Up", "50SMA Up" 레이블이 120px 컬럼을 벗어나 bar와 겹침.
- **근본 원인**: v31.9에서 `font-size:11px` + `min-width:110px` 추가했으나 컬럼 폭(120px) 대비 초과. 한국어 레이블 "20SMA 상위"가 더 길어 오버플로.
- **수정**: `font-size:8px` 복원, `min-width` 제거, `text-overflow:ellipsis` 추가.
- **예방**: P43 기존 항목 보강 — 바 레이아웃에서 레이블 컬럼은 고정폭 유지, font-size 변경 시 오버플로 재확인.

### BUG-2: Pattern Scanner Signal/Momentum 항상 "—" — Dead Section (HIGH)
- **violated_rule**: R9 (Dead Page 방지)
- **증상**: signal 페이지 Pattern Scanner 섹션의 Signal/Momentum 컬럼이 항상 "—" 표시. 어떤 데이터도 반영 안 됨.
- **근본 원인**: DOM ID(`ps-xle-signal` 등)는 선언되어 있으나 JS 업데이트 함수 존재하지 않음. 사용자 요청 없이 임의로 추가한 Dead Section.
- **수정**: Pattern Scanner 섹션 전체 제거.
- **예방**: P46 보강 — UI 섹션 추가 시 JS 업데이트 함수 없으면 Dead Section. 함수 없는 섹션 추가 금지.

### BUG-3: Portfolio 배분 카드 텍스트 겹침 (MEDIUM)
- **violated_rule**: R7 (한국어 텍스트 레이아웃)
- **증상**: 포트폴리오 배분 카드에서 종목명/비중/등락률 텍스트가 겹쳐 보임.
- **근본 원인**: grid 레이아웃 내 텍스트 셀에 `flex:1;min-width:0` 없음. 긴 종목명이 컨테이너를 초과.
- **수정**: 수평 flex 레이아웃으로 재구성, `flex:1;min-width:0` 적용.
- **예방**: P50 — flex/grid 컨테이너 내 텍스트 셀에 `flex:1;min-width:0` 필수. 한국어/긴 종목명 오버플로 방어.

### BUG-4: fxbond 페이지 initYieldCurveChart() silent failure (MEDIUM)
- **violated_rule**: R4 (동적 DOM 삽입 주의)
- **증상**: fxbond 페이지 진입 시 콘솔 에러 없으나 수익률 곡선 차트가 초기화 안 됨.
- **근본 원인**: `updateFxBondPage` wrapper에서 `initYieldCurveChart()` 호출하는데, 이 함수는 macro 페이지의 canvas ID 참조 — fxbond 페이지에는 해당 canvas 없음. null 체크 없어 조용히 실패.
- **수정**: `updateFxBondPage` wrapper에서 `initYieldCurveChart()` 호출 제거.
- **예방**: P51 — 페이지 초기화 함수 호출 전 해당 canvas/DOM이 현재 페이지에 실재하는지 확인. 다른 페이지의 DOM ID를 참조하는 init 함수 교차 호출 금지.

---

## [2026-04-05] v42.1 -- 시장 뉴스 desc/summary 누락 + 브리핑 포맷 미흡 + 리스크 모니터 중복 (3건)

### BUG-1: 카테고리별 뉴스 뷰에 desc/summary 미표시 (MEDIUM)
- **violated_rule**: 신규 (렌더링 누락)
- **증상**: 시장 뉴스 → 카테고리별 탭에서 헤드라인(제목)만 표시되고, 설명(desc)과 요약(summary)이 보이지 않음.
- **근본 원인**: `_renderTopicSection()`에서 `displayTitle`만 렌더링. `getDisplayDesc()`/`getDisplaySummary()` 호출 및 HTML 삽입 코드 누락.
- **수정**: `_renderTopicSection()`에 `displayDesc`/`displaySummary` 변수 추가 + 설명(10px)과 요약(9px italic) HTML div 삽입.
- **예방**: P40 — 새 뉴스 렌더러 추가 시 기존 렌더러(`_renderTopicSection`/`_renderBriefingBullet`)의 표시 항목(제목/설명/요약/소스/시간)을 체크리스트로 확인.

### BUG-2: 데일리 브리핑이 단순 불릿 목록 — 분석/해석 부재 (MEDIUM)
- **violated_rule**: 신규 (UX 기대 불일치)
- **증상**: 데일리 브리핑이 점(·) + 제목만 나열하는 형태로, 시장 뉴스와 차별화 없음. 사용자가 기대하는 분석/해석/설명 없음.
- **근본 원인**: `_renderBriefingBullet()`이 단순 dot+title 형태. `_renderBriefingSection()` 헤더도 최소 스타일.
- **수정**: `_renderBriefingBullet()`을 아티클 카드 형태로 재작성 (border-left 3px + 제목 볼드 + 센티먼트 배지 + 설명 + 요약 + 소스/시간). `_renderBriefingSection()` 헤더에 아이콘/건수 배지 추가.
- **예방**: P41 — 뉴스 표시 컴포넌트는 최소 5요소(제목/설명/요약/소스/시간) 렌더링. 새 뷰 추가 시 기존 뷰와 정보 밀도 비교.

### BUG-3: updateRallyQualityVerdict() stale DOM 참조 — 항상 "로딩 대기" (MEDIUM)
- **violated_rule**: 신규 (stale DOM reference)
- **증상**: 시장폭 페이지의 랠리 품질 판별이 항상 "시장폭 데이터 로딩 대기 중..." 표시. `updateMarketPulse()` 시장폭 세그먼트도 항상 "—" 표시.
- **근본 원인**: `bb-5sma-val`/`bb-20sma-val`/`bb-50sma-val` DOM ID가 HTML에 없음 (v38.9에서 함수 작성 시 DOM 구조와 불일치). `bp-5sma-pct`도 v42.1에서 존재하지 않는 ID 참조.
- **수정**: (1) `initBreadthPage()`에서 `window._breadth5`/`window._breadth50` 전역 캐싱 추가 (2) `updateRallyQualityVerdict()`와 시그널 바텀프로세스가 전역 변수에서 읽도록 수정 (3) `updateMarketPulse()`도 `window._breadth200` 직접 읽기로 수정.
- **예방**: P43 — DOM ID 참조 신규 추가 시 `grep 'id="해당ID"' index.html`로 HTML에 실재 확인 필수. getElementById 결과가 항상 null이면 stale reference.

### REFACTOR: 리스크 모니터 중복 지표 정리 (13셀→8셀)
- **violated_rule**: 신규 (정보 중복)
- **증상**: 시그널 페이지 리스크 모니터에 VIX, DXY, HYG, TNX, F&G가 스냅카드/홈KPI/FX채권과 중복 표시 — 정보 과부하.
- **수정**: VIX/DXY(display:none), HYG/TNX/F&G(hidden div)으로 숨김. RSP/SPY를 row1으로 이동. JS getElementById용 DOM은 hidden으로 유지하여 런타임 에러 방지.
- **예방**: P42 — 지표 추가 시 동일 데이터가 다른 섹션에 이미 표시되는지 확인. 중복 시 한쪽만 표시하고 크로스링크로 연결.

---

## [2026-04-06] v41.7 -- 전수 QA: FX 반전 누락 + KNOWN_TICKERS 유실 + insight-box 교차 (3건)

### BUG-1: CADUSD=X/CHFUSD=X FX_INVERTED 누락 — PriceStore 300+ 경고 (HIGH)
- **violated_rule**: 신규 (데이터 정합성)
- **증상**: 콘솔에 PriceStore 50% jump 경고 300건+. Yahoo가 USD/CAD(1.39) 반환 vs open.er-api가 CAD/USD(0.72) 반환 — 값 충돌.
- **근본 원인**: `FX_INVERTED` 배열에 `CADUSD=X`, `CHFUSD=X`가 누락되어 open.er-api 경로에서 반전 처리 안 됨. 동시에 Yahoo에서도 같은 심볼 fetch하여 반전 안 된 값이 PriceStore에 먼저 등록.
- **수정**: (1) FX_INVERTED에 CADUSD=X, CHFUSD=X 추가 (2) Yahoo fetch 목록과 chart batch에서 CADUSD=X, CHFUSD=X 제거 — UI에 표시하지 않는 심볼이므로 FX API 단일 경로만 유지.
- **예방**: P29 — FX 심볼 추가 시 반드시 3경로(Yahoo, open.er-api, chart batch) 일관성 확인. FX_INVERTED와 표시 여부(카드 UI) 동기 점검.

### BUG-2: KNOWN_TICKERS Set 생성자 — 20개 핵심 심볼 유실 (CRITICAL)
- **violated_rule**: 신규 (JS 언어 함정)
- **증상**: ^GSPC, ^VIX, BTC-USD 등 20개 주요 지수/암호화폐가 KNOWN_TICKERS에서 누락 — 스크리너 필터링 및 종목 검증 실패 가능.
- **근본 원인**: `new Set([...items], extra1, extra2)` — Set 생성자는 첫 번째 인자(iterable)만 사용, 나머지 무시. `]` 뒤에 20개 항목이 위치하여 조용히 유실.
- **수정**: 20개 항목을 `]` 안으로 이동 + 중복 4개(BIIB, CLSK, MP, QBTS) 제거 → 795개 유니크.
- **예방**: P30 — 대형 배열/Set 리터럴 수정 시 닫는 괄호 위치 반드시 확인. `KNOWN_TICKERS.size` 로그로 기대 크기 검증.

### BUG-3: insight-box 텍스트 4페이지 교차 배치 (MEDIUM)
- **violated_rule**: 신규 (콘텐츠 정합성)
- **증상**: market-news에 glossary 텍스트, options에 market-news 텍스트, theme-detail에 options 텍스트, ticker에 education 텍스트가 표시됨.
- **근본 원인**: 대량 insight-box 추가 시 복사-붙여넣기 과정에서 텍스트가 교차 배치됨.
- **수정**: 4개 페이지 insight-box 텍스트를 각 페이지 맥락에 맞게 교정.
- **예방**: P31 — 대량 반복 요소 추가 시 각 인스턴스의 콘텐츠가 해당 페이지와 일치하는지 개별 확인 필수.

---

## [2026-04-06] v41.4~v41.6 -- 전수 S급 감사: 보안/접근성/안정성/Dead Code (다영역)

### BUG-1: XSS — 사용자 입력 ticker가 innerHTML에 비이스케이프 삽입 (CRITICAL)
- **violated_rule**: 신규 (보안)
- **증상**: `analyzeTickerDeep`/`analyzeKrTickerDeep`에서 사용자가 입력한 ticker가 `escHtml()` 없이 innerHTML에 삽입 -- XSS 공격 벡터.
- **근본 원인**: 사용자 입력을 신뢰하고 직접 DOM에 삽입. `updateFail`/`updateProgress`/`showDataError`/`updateDataStatusError`도 동일 패턴.
- **수정**: 모든 사용자/외부 데이터 innerHTML 경로에 `escHtml()` 적용 (6곳).
- **예방**: P26 — innerHTML에 외부 데이터 삽입 시 반드시 `escHtml()` 래핑. 코드 리뷰 시 `innerHTML =` + 변수 조합을 grep 대상으로 추가.

### BUG-2: 좀비 타이머 — signal 페이지 이탈 시 sigRefreshTimer 미해제 (HIGH)
- **violated_rule**: R9 (Dead Page 방지)
- **증상**: signal 페이지에서 다른 페이지로 이동해도 `sigRefreshTimer`와 `window._refreshSignalInterval`이 계속 실행 -- 메모리 누수 + 불필요한 API 호출.
- **근본 원인**: `destroyPageCharts('signal')` 블록에 해당 타이머 해제 코드 누락.
- **수정**: signal destroy 블록에 `clearInterval(sigRefreshTimer)` + `clearInterval(window._refreshSignalInterval)` 추가.
- **예방**: P27 — `setInterval` 추가 시 반드시 `destroyPageCharts`에 대응 `clearInterval` 추가. 페이지별 타이머 목록 관리.

### BUG-3: R15 위반 — Yahoo/CoinGecko 시세 수집에서 `_pct || 0` 패턴 3건 (HIGH)
- **violated_rule**: R15
- **증상**: 실제 0% 변동 종목이 null(미수신)과 구분 불가 -- 트레이딩 스코어, 시장 분위기 왜곡.
- **근본 원인**: v40.6에서 대량 수정했으나 fetchLiveQuotes 내 Yahoo/pre-post/CoinGecko 3곳 누락.
- **수정**: `_pct || 0` -> `_pct != null ? _pct : null`.
- **예방**: P25 재강화. `|| 0` grep 주기적 실행.

### BUG-4: R17 위반 — MACRO_KW에 'QE'/'QT' 2글자 키워드 (MEDIUM)
- **violated_rule**: R17
- **증상**: "QE" 포함 비금융 텍스트에서 매크로 뉴스로 오분류 가능.
- **근본 원인**: 약어를 그대로 키워드에 추가. full form은 이미 존재.
- **수정**: MACRO_KW에서 'QE','QT' 제거.
- **예방**: R17 -- 3글자 미만 단독 키워드 추가 금지.

### BUG-5: fundamental 페이지 재진입 Dead Page — _fundInitDone 미리셋 (MEDIUM)
- **violated_rule**: R9
- **증상**: fundamental 페이지 방문 -> 다른 페이지 -> 다시 fundamental 시 빈 페이지.
- **근본 원인**: `destroyPageCharts` fundamental 블록에 `_fundInitDone = false` 리셋 누락.
- **수정**: fundamental destroy 블록에 `_fundInitDone = false` 추가.
- **예방**: P28 — init 가드 패턴 사용 시 반드시 destroy에서 플래그 리셋. R9 재확인.

### CLEANUP: Dead Code 대량 제거 (~400줄)
- 19개 미사용 함수 + 6개 미사용 변수 + 1개 중복 IIFE 제거.
- 전수 grep으로 호출처 0건 확인 후 삭제.
- **예방**: 기능 제거 시 관련 함수/변수도 함께 정리. 주기적 dead code 스캔.

---

## [2026-04-05] v41.1 -- 예방 수정: 유니버설 셀렉터 스크롤바 (1건)

### BUG-1: `*` 유니버설 셀렉터에 scrollbar-width 적용 (PREVENTIVE)
- **violated_rule**: 신규 (CSS 성능)
- **증상**: 직접적 시각 버그 없으나, `* { scrollbar-width: thin; }` 규칙이 DOM 전체 37,000+ 요소에 적용되어 잠재적 렌더링 성능 저하.
- **근본 원인**: Firefox 스크롤바 폴백 추가 시 `*` 셀렉터 사용. `scrollbar-width`는 스크롤 가능 요소에만 유효하므로 `html`로 충분.
- **수정**: `* { scrollbar-width: thin; ... }` -> `html { scrollbar-width: thin; ... }`
- **예방**: CSS 프로퍼티 추가 시 최소 범위 셀렉터 사용. `*` 셀렉터는 리셋(box-sizing) 외 사용 금지.

---

## [2026-04-05] v40.6 — 전수 QA: TDZ 크래시 + 안티패턴 + 데이터 정합성 (20건 수정)

### BUG-1: oilPrice TDZ ReferenceError (CRITICAL)
- **violated_rule**: 신규 (JS TDZ)
- **증상**: `computeTradingScore()` 호출 시 매번 `ReferenceError: Cannot access 'oilPrice' before initialization` — 16+ 콘솔 에러/로드.
- **근본 원인**: `const oilPrice = _ldSafe('CL=F','price') || 0`이 L30797에 선언되었지만 L30768에서 먼저 참조 (TDZ).
- **수정**: 선언을 L30694 (`const tnx` 직후)로 이동, 기존 위치의 중복 선언 삭제.
- **예방**: `const` 변수는 반드시 첫 사용 전에 선언. `computeTradingScore()` 수정 시 변수 선언 순서 확인.

### BUG-2: .pct||0 안티패턴 잔존 9건 + abv50||48 3건 (R15 위반)
- **violated_rule**: R15
- **증상**: null(미수신) 데이터가 0%(보합)으로 처리되어 M7 리더십 카운트, 섹터 분석, XLF/Gold 시그널, 트레이딩 스코어 왜곡.
- **근본 원인**: v38.4/v39.2에서 대량 수정했으나 일부 누락 + `breadthData.abv50||48` 동일 패턴.
- **수정**: 전수 grep → 9건 `d.pct != null ? d.pct : 0` + 3건 `abv50 != null ? abv50 : 28`.
- **예방**: P25 규칙 재확인. `|| 숫자` 폴백은 0이 유효값인 모든 곳에서 사용 금지.

### BUG-3: 데이터 이중 표시 불일치 6건
- **증상**: 동일 데이터가 home sidebar vs 전용 페이지에서 다른 값 표시 (브레드쓰 5/20/50SMA, AAII 날짜, VKOSPI, 전일종가 날짜).
- **근본 원인**: 하드코딩 데이터가 여러 곳에 산재하며, 업데이트 시 일부만 갱신.
- **수정**: 모든 이중 표시 지점을 동일 값으로 동기화.
- **예방**: 데이터 업데이트 시 grep으로 해당 값이 나타나는 모든 위치를 확인.

### BUG-4: KR_STOCK_DB 품질 이슈 4건
- 비상장 종목(엘앤피코스메틱) 포함, themes:[] 고아 엔트리, 잘못된 mcap/price, 부적절한 테마 분류.
- **수정**: 비상장 제거, construction 테마 부여+섹션 이동, mcap/price 최신화, 과잉 테마 제거.

---

## [2026-04-03] v39.2 — 전수 QA + 뉴스 파이프라인 + 전 페이지 심층 개선: 12대 문제 발견 및 수정

### BUG-1: P25 `.pct || 0` 패턴 25곳 재발 (CRITICAL)
- **violated_rule**: R15
- **증상**: 데이터 미수신(null) 종목이 UI에 "+0.00%"로 표시. AI 분석(CHAT_CONTEXT)에도 "0.00%"가 주입되어 분석 왜곡.
- **근본 원인**: v38.4에서 65곳을 수정했으나 이후 코드에서 동일 패턴이 재삽입됨. 특히 22101(AI분석), 23684(비교데이터), 25102(수집), 32705(브레드스 카운트)가 위험.
- **수정**: 25곳 전수 → `d.pct != null ? d.pct : 0` 또는 `d.pct != null ? d.pct : null` 패턴으로 전환.
- **예방 규칙 P25 강화**: 신규 코드 작성 시 `.pct || 0` 패턴 절대 사용 금지. grep으로 정기 체크.

### BUG-2: popstate 핸들러에서 `aio:pageShown` 이벤트 미발송 (CRITICAL)
- **violated_rule**: R9
- **증상**: 브라우저 뒤로가기 시 screener/portfolio/korea/fundamental/themes/options 등 12개 페이지가 초기화되지 않음 (빈 화면/차트 미렌더링).
- **근본 원인**: `showPage()`는 `aio:pageShown` 이벤트를 발송하지만, popstate 핸들러에서는 직접 DOM 조작만 하고 이벤트를 발송하지 않았음. 12개 페이지가 이 이벤트에 의존하여 lazy-init 수행.
- **수정**: popstate 핸들러에 `document.dispatchEvent(new CustomEvent('aio:pageShown', { detail: id }))` 추가.
- **예방 규칙 P31**: popstate 핸들러 수정 시 반드시 showPage()와 동일한 이벤트 발송 확인.

### BUG-3: TECH_KW에 3글자 미만 키워드 7개 재발 (P28)
- **violated_rule**: R17
- **증상**: TECH_KW에 `'V'`(1자), `'EV'`, `'MA'`, `'SQ'`, `'ZS'`, `'PL'`, `'1X'`(각 2자) — 비금융 텍스트 오탐 위험.
- **근본 원인**: 종목 풀네임 옆에 티커 약자를 나열하는 패턴 (`'Visa','V','Mastercard','MA'`). R17 규칙은 있었으나 기존 코드 미정리.
- **수정**: V/MA/SQ/ZS/PL 제거(풀네임 유지), EV→'electric vehicle', 1X→'1X Technologies'.
- **예방 규칙 P28 강화**: TECH_KW/MED_KW 변경 시 `grep -oP "'[^']{1,2}'" index.html` 실행하여 2글자 이하 확인.

### BUG-4: native `confirm()` 6곳 잔존
- **증상**: 모바일에서 브라우저 기본 confirm 다이얼로그 표시 → UX 불일치.
- **근본 원인**: `showConfirmModal()` 커스텀 모달이 도입(v38.3)되었으나 기존 6곳 미전환.
- **수정**: 20192(LLM한도), 20971(게시판삭제), 21212(PIN초기화), 21246(포트폴리오중복), 21454(CSV임포트), 24934(채팅삭제) → 모두 `showConfirmModal()` 콜백 방식으로 전환.
- **예방 규칙 P32**: `confirm(` 패턴 신규 사용 금지. 반드시 `showConfirmModal()` 사용.

### BUG-5: ARM 티커 뉴스 오탐 (CRITICAL -- 사용자 보고)
- **violated_rule**: R16, R17
- **증상**: 철강 뉴스 등 ARM과 무관한 기사에 $ARM 티커가 표시됨.
- **근본 원인 2가지**:
  1. KR_TICKER_MAP에 `'arm': 'ARM'` → `text.toLowerCase().includes('arm')` = "arms", "armed" 등 모든 텍스트에서 매칭.
  2. `_isTickerContextValid`의 finWords에 `'market'`, `'trade'` 등 광범위 단어 → 거의 모든 뉴스가 문맥 검증 통과.
- **수정**:
  1. KR_TICKER_MAP: `'arm'` → `'arm holdings'`
  2. `_TICKER_WORD_OVERLAP` Set 신규 — ARM/ON/IT/ALL/RUN 등 영단어 겹침 티커는 `$ARM` 또는 `(ARM)` 형태만 허용
  3. finWords에서 광범위 단어(market/trade/rise/fall) 제거 → 금융 전용 단어만 유지
- **예방 규칙 P33**: 영어 일반 단어와 겹치는 티커(3글자 이하)는 `_TICKER_WORD_OVERLAP`에 등록. KR_TICKER_MAP에 영문 소문자 3글자 이하 키 추가 시 `includes()` 오탐 검증 필수.

### BUG-6: 클릭베이트/투자 스팸 뉴스 유입 (사용자 보고)
- **violated_rule**: R14
- **증상**: "이 주식만 사면 10배" 같은 저품질 기사가 뉴스 피드에 표시됨.
- **근본 원인**: NEWS_BLACKLIST_KW에 투자 스팸 패턴 미포함. scoreItem에 클릭베이트 감지 로직 없음.
- **수정**:
  1. `_CLICKBAIT_RE` 정규식 — 60+ 패턴 즉시 차단(score=0)
  2. NEWS_BLACKLIST_KW에 한국어 투자 스팸 40+개 + 영문 30+개 추가
- **예방 규칙 P34**: 뉴스 품질 이슈 보고 시 소거법 적용 — 블랙리스트 키워드 추가가 허용 목록보다 효과적.

### BUG-7: fetch `{timeout:8000}` 비표준 옵션 (WARNING)
- **증상**: Yahoo Chart fetch에서 `{timeout:8000}` 옵션이 무시되어 무한 대기 가능.
- **근본 원인**: `fetch()` Web API 표준에 `timeout` 옵션이 없음. 코드 작성자가 비표준 옵션을 사용.
- **수정**: `AbortController` + `setTimeout` 8초로 교체.
- **예방 규칙 P35**: 외부 fetch에 타임아웃 적용 시 반드시 `AbortController` 또는 `withTimeout()` 사용. `{timeout:N}` 옵션은 fetch 표준 아님.

### BUG-8: extractTickers RegExp 매 호출 재생성 (성능)
- **증상**: 뉴스 80개 × 800+ 티커 = 64,000+ RegExp 객체 매번 재생성.
- **근본 원인**: `KNOWN_TICKERS.forEach()` 내부에서 `new RegExp(...)` 호출.
- **수정**: `_tickerRegexCache` + `_getTickerRegex()` 도입 — 1회 컴파일 후 캐시.
- **예방 규칙 P36**: 반복문 내부에서 `new RegExp()` 금지. 함수 밖에서 캐시하거나 전역 변수에 저장.

### BUG-9: KNOWN_TICKERS에 SUB_THEMES 27개 종목 누락
- **증상**: 테마 분석 페이지에 표시되는 종목(S, UAL, CCI, PLUG, DKNG 등)이 뉴스 티커 매칭에서 제외.
- **근본 원인**: SUB_THEMES에 종목을 추가하면서 KNOWN_TICKERS에는 추가하지 않음.
- **수정**: 27개 종목 일괄 추가.
- **예방 규칙 P37**: SUB_THEMES에 새 종목 추가 시 반드시 KNOWN_TICKERS에도 포함 확인.

### BUG-10: _context/CLAUDE.md 버전 미동기화 (WARNING)
- **증상**: index.html은 v39.1인데 _context/CLAUDE.md는 v39.0으로 미반영.
- **근본 원인**: 버전 동기화 6곳 중 `_context/CLAUDE.md`가 루트 `CLAUDE.md`와 별도 파일임에도 같이 업데이트되지 않음.
- **수정**: v39.2로 동기화.
- **예방 규칙**: R1의 6곳에 이미 포함. 실행 시 grep 명령 반드시 양쪽 CLAUDE.md 확인.

### BUG-11: console.log 72개 프로덕션 잔존 (코드 품질)
- **증상**: 브라우저 콘솔에 `[AIO v20]`, `[AIO v21]` 등 디버그 로그 상시 출력.
- **근본 원인**: 개발 중 삽입된 console.log가 프로덕션에 제거되지 않음.
- **수정**: 프로덕션 console.log 무음 가드 — `[AIO` 접두사 로그를 `?debug` 또는 `localStorage.aio_debug=1` 시에만 출력.
- **예방 규칙 P38**: 신규 console.log 추가 시 `[AIO` 접두사 사용. 프로덕션에서는 자동 무음 처리됨.

### BUG-12: computeTradingScore 교차변수 미반영 (개선)
- **증상**: VIX 25+ & DXY 107+ & TNX 4.5+ & 유가 $100+ 동시 악화에도 스코어가 충분히 낮아지지 않음. 추세↑+시장폭↓(소수 주도 위험 상승)에 경고 없음.
- **근본 원인**: 5대 컴포넌트가 독립적으로 계산되어 교차 영향 미반영.
- **수정**: (1) 3개+ 매크로 리스크 동시 악화 = 퍼펙트스톰 패널티(-10p) (2) 추세-시장폭 다이버전스 자동 감지.
- **예방 규칙 P39**: 스코어 알고리즘 변경 시 반드시 "교차변수" 영향 검토. 단독 변수 보정만으로는 복합 리스크 반영 불가.

---

## [2026-04-04] v39.3~v40.4 — 심층 개선 세션: 10대 문제 발견 및 수정

### 문제 1: 한국 테마 HTML-JS 데이터 불일치 (v40.0)
- **증상**: KR_THEME_MAP의 종목 비중을 수정해도 HTML 카드의 pill-wt 비중은 옛날 값 그대로 표시. 23개 중 3개만 일치, 20개 불일치.
- **근본 원인**: 종목 데이터가 KR_THEME_MAP(JS)과 HTML 카드(정적) 2곳에 중복 관리. 한쪽만 수정하면 다른 쪽이 어긋남.
- **수정**: 정적 HTML 카드 390줄 삭제 → `renderKrThemeCardsFromMap()` 동적 생성으로 전환. KR_THEME_MAP이 Single Source of Truth.
- **예방 규칙 P31**: 데이터와 UI가 2곳에서 관리되면 반드시 한쪽을 제거하고 단일 원천(Single Source of Truth)으로 통합. 데이터 변경 시 UI 자동 반영 보장.

### 문제 2: 두나무(035200) 비상장 주식 추가 오류 (v39.9)
- **증상**: crypto 테마에 두나무(업비트) 추가 → 비상장 주식이라 Yahoo Finance에서 시세 수신 불가.
- **근본 원인**: 종목 추가 시 상장 여부 확인 절차 없음. "한국 1위 거래소"라는 사업적 중요성만 보고 추가.
- **수정**: 두나무 제거, 상장 종목만으로 crypto 테마 재구성.
- **예방 규칙 P32**: 종목 추가 시 반드시 상장 여부 확인 (KOSPI .KS / KOSDAQ .KQ). 비상장·장외 주식 추가 금지.

### 문제 3: robot 테마 현대차 중복 (v39.9)
- **증상**: 현대차(005380)가 auto 테마(28%)와 robot 테마(12%)에 동시 존재. 두 테마 동시 보유 시 의도치 않은 40% 집중.
- **근본 원인**: 보스턴다이내믹스(현대차 자회사)를 robot 테마에 반영하려다 모회사를 직접 넣음.
- **수정**: robot에서 현대차 제거. auto에서 "보스턴다이내믹스" 커버.
- **예방 규칙 P33**: 동일 종목의 테마 간 중복 배치 금지. 자회사는 모회사 테마에서 커버.

### 문제 4: 테마 종목 비중 임의 배분 (v39.9)
- **증상**: 반도체 삼성+하이닉스 = 56%로 설정됐지만 실제 시총 비중은 70%+. 로봇 테마에서 대장주(레인보우)와 후발주 비중이 균등.
- **근본 원인**: 비중 설정 시 시총/독과점/ETF 구성을 체계적으로 참조하지 않고 감으로 배분.
- **수정**: 23개 테마 전체 비중 재조정 — 시총, 독과점, 대장주, ETF 구성 모두 반영.
- **예방 규칙 P34**: 테마 종목 비중은 (1) 시총 비례 (2) 독과점 구조 반영 (3) 대장주/주도주 비중 상향 (4) ETF 구성 크로스체크. 임의 배분 금지.

### 문제 5: 포트폴리오 도넛 차트 하드코딩 모의 데이터 (v39.7)
- **증상**: 포트폴리오 도넛이 항상 "50% Cash, 30% Balanced, 12% Growth, 8% Alt" 고정 표시. 실제 보유 종목과 무관.
- **근본 원인**: `drawPortfolioDonut()`이 정적 배열로 그리도록 구현. 실제 포지션 데이터 연결 안 됨.
- **수정**: `drawPositionDonut()` 신규 — 실제 포지션 기반 동적 도넛 + 범례 + 섹터 브레이크다운 + 현금 포지션.
- **예방 규칙 P35**: 데모/모의 데이터는 반드시 `[DEMO]` 라벨 표시하거나, 실제 데이터 연결이 완료되면 제거. 사용자에게 실제 데이터로 오인되면 안 됨.

### 문제 6: 핵심 인사이트 바 정보 과부하 (v40.1)
- **증상**: 전 페이지 상단 인사이트 바가 3~5줄 긴 설명인데, 접힌 상태에서 "..."로 잘려 읽을 수 없음. 초보자가 어떤 정보를 봐야 하는지 모름.
- **근본 원인**: 인사이트 바가 "교육용 상세 설명"과 "핵심 한 줄 요약" 역할을 동시에 하려고 함.
- **수정**: 21개 인사이트 바 전부 핵심 한 문장으로 교체.
- **예방 규칙 P36**: UI 텍스트는 "핵심 한 줄" + "상세는 토글/AI 채팅"으로 분리. 접힌 상태에서 핵심 메시지가 완전히 읽혀야 함.

### 문제 7: 인라인 7-8px 글자 크기 가독성 문제 (v40.2)
- **증상**: 매크로 인터커넥션 맵, 환율채권 분석 등에서 7-8px 글자가 약 597곳. 읽기 어려움.
- **근본 원인**: 초기 버전에서 "공간 절약"을 위해 극소 글자 사용. 이후 누적.
- **수정**: CSS override 강화 — 인라인 7-8px→11px, 9-11px→12px 자동 확대.
- **예방 규칙 P37**: 인라인 font-size 11px 미만 사용 금지. CSS override가 자동 보정하지만, 신규 코드에서 7-8px 사용하면 의도와 다른 크기로 표시됨.

### 문제 8: 사이드바 글씨 선명도 부족 (v40.2)
- **증상**: 사이드바 메뉴 글씨가 어두운 배경에서 흐릿하게 보임.
- **근본 원인**: color가 `var(--text-secondary)` = #94a3b8 (어두움), font-weight 500 (얇음).
- **수정**: color #cbd5e1 (밝게), font-size 13px, weight 600.

### 문제 9: TradingView 차트 빈 화면 — 자동 로드 미연결 (v40.2)
- **증상**: technical/kr-technical 페이지 진입 시 TradingView 영역이 검은 빈 화면.
- **근본 원인**: `loadTVChart()` 함수는 존재하지만, 페이지 초기화 시 자동 호출되지 않음. 사용자가 수동으로 "차트 로드" 버튼을 눌러야 함.
- **수정**: `initKoreaTechnical()`과 technical 페이지 init에서 iframe 없으면 자동 `loadTVChart()` 호출.

### 문제 10: AI 채팅 패널 산재 — 공간 낭비 + 유기적 연결 불가 (v40.4)
- **증상**: 9개 페이지에 각각 AI 채팅 패널이 있어 페이지 공간 차지. 기업 분석하면서 차트 질문하려면 페이지 이동 필요.
- **근본 원인**: 페이지별 독립 채팅 아키텍처. 크로스 페이지 대화 불가.
- **수정**: 오른쪽 슬라이드 사이드바로 통합. 페이지 전환 시 맥락 자동 전환 + 대화 이력 유지.
- **예방 규칙 P38**: 전역적으로 사용되는 기능(AI 채팅, 알림 등)은 페이지별 복제가 아닌 글로벌 컴포넌트로 구현.

---

## [2026-04-04] v40.4 — 데이터 최신화 + 뉴스 선별 + UI 6대 결함 수정

- **증상 1**: 모든 차트(VIX/NAAIM/AAII/브레드쓰)가 3/19~3/27 기준 하드코딩 데이터로 고정. 2주+ 경과한 데이터가 현재 데이터인 것처럼 표시.
- **증상 2**: ASML 등 외국 기업 검색 시 재무 데이터 전부 N/A 표시.
- **증상 3**: 사이드바 닫을 때 화면 비율 깨짐 (왼쪽 텍스트 잘림).
- **증상 4**: 홈 핵심뉴스가 API 수집 완료까지 "수집 중" 로딩 스피너만 표시.
- **증상 5**: 데일리 브리핑이 시간순으로만 나열 — 중요도 선별 없이 잡뉴스 포함.
- **증상 6**: 시장 뉴스 80건 제한으로 스크롤이 막힘. 비시장 정치/시사 뉴스 유입.
- **근본 원인**:
  1. 차트 데이터가 정적 배열로 하드코딩되어 있고, API 동적 전환 미구현
  2. SEC XBRL 파싱이 10-K만 필터 — 20-F(외국발행인 양식) 미대응. IFRS 미대응.
  3. `.sidebar.collapsed`에 min-width/padding/border 잔여값
  4. `renderHomeFeed()`가 뉴스 수집 완료 후에만 호출됨 (정적 뉴스 개념 부재)
  5. 브리핑 score 임계값 없음 → 24h 내 모든 뉴스 시간순 나열
  6. scoreItem()에 5대 우선 토픽(매크로/지정학/주식/외환/채권) 부스트 없음. 비시장 정치 뉴스 감점 로직 없음.
- **놓친 이유**: 기존 QA가 코드 구문/런타임 에러 위주 — 데이터 최신성·뉴스 품질·선별 체계 점검 항목 부재.
- **수정 내용**:
  1. VIX/HYG/SPY/QQQ 차트 → Yahoo Finance API 동적 전환 (`_refreshSentimentChartData`, `_refreshBreadthPriceChart`)
  2. NAAIM/AAII/브레드쓰% 수동 최신화 (4/1 기준)
  3. DATA_SNAPSHOT 전면 업데이트 (3/27→4/3 기준, VKOSPI 28.5→58.86)
  4. 날만 데이터 경고 UI (`getDataAge()` + `renderStaleWarning()`)
  5. SEC 파싱: 20-F/20-F/A + ifrs-full 폴백 추가
  6. sidebar collapsed CSS: min-width:0, padding:0, border:none
  7. 홈 핵심뉴스 → 정적 큐레이션 (`HOME_WEEKLY_NEWS`, DOMContentLoaded에서 즉시 표시)
  8. 브리핑: score 45+ 임계값 + 20건 초과 시 score 우선 선별 → 시간순 재정렬
  9. 시장 뉴스: score 30+ 임계값 + 150건 상한 + 48h
  10. scoreItem(): 5대 토픽 부스트(+5~15) + 비시장 정치 감점(-25)
- **예방 규칙 P31**: 하드코딩 차트 데이터는 반드시 `_updated` 날짜와 함께 관리. 3일+ 경과 시 경고 배지 표시. 동적 전환 가능한 데이터는 API로 자동 교체하고 하드코딩은 폴백으로만 유지.
- **예방 규칙 P32**: 뉴스 3곳(홈/브리핑/시장)의 선별 체계는 반드시 계층적이어야 함: 홈(정적 큐레이션) > 브리핑(score 45+, 20건, score 우선 선별) > 시장(score 30+, 150건, 광범위). 브리핑은 정보 전달성(score 우선), 시장은 최신성(시간순) 우선.
- **예방 규칙 P33**: 외국 기업(ADR) 재무 데이터 파싱 시 10-K뿐 아니라 20-F(외국발행인)도 반드시 포함. IFRS 회계기준(`ifrs-full`)도 us-gaap 폴백으로 지원.
- **QA 체크리스트 추가 항목**:
  - [ ] 하드코딩 차트 데이터 경과일 3일 이내인지 (DATA_SNAPSHOT._updated)
  - [ ] ASML/TSM 등 ADR 기업 검색 시 재무 데이터 N/A 아닌지
  - [ ] 브리핑 뉴스에 비시장 정치/시사 뉴스 유입 안 되는지
  - [ ] 시장 뉴스 스크롤이 끝까지 가능한지 (건수 제한 확인)

---

## [2026-04-02] v39.0 — 텔레그램 채널 스크래핑/뉴스 선별 5대 결함 수정
- **violated_rule**: R16, R17, R18

- **증상 1**: WalterBloomberg 텔레그램 채널이 rsshub에서 403 차단되어 수집 0건.
- **증상 2**: FirstSquawk/FinancialJuice 채널의 t.me/s/ 공개 미리보기가 비활성화되어 7개 프록시 모두 실패, 불필요한 시간 소모.
- **증상 3**: `fetchAllNews`의 60초 isFetching 안전장치가 80개 소스 로딩 시간(약 90~120초)보다 짧아 강제 리셋 반복.
- **증상 4**: TECH_KW에 `'S'` (SentinelOne 티커) 한 글자가 있어 모든 텍스트에서 오탐 매칭 → "약물 운전" 같은 비금융 기사 통과.
- **증상 5**: `isTelegramMsgRelevant` 필터가 광범위 키워드(`market`, `space`, `시장` 등) 1개만 매칭되면 통과 → 잡뉴스 유입.
- **근본 원인**: (1) rsshub 서비스 변경으로 특정 채널 403 차단 (2) Telegram 채널 설정 변경으로 공개 미리보기 비활성화 (3) 소스 수 증가에 비해 타임아웃 미조정 (4) 단일 문자 키워드 QA 부재 (5) 관련성 필터 임계값 미설정
- **수정**:
  1. `_TG_DIRECT_ONLY` 목록으로 rsshub 차단 채널은 CF Worker 직접 스크래핑 우선 (rsshub 순회 스킵)
  2. `_TG_UNAVAILABLE` 목록으로 비활성 채널 즉시 스킵
  3. isFetching 안전장치 60초→180초로 확장
  4. TECH_KW에서 `'S'` 단독 키워드 제거
  5. `_TG_BROAD_KW` 도입 — 광범위 키워드만 1개 매칭 시 불통과, 2개 이상 또는 구체적 키워드 필요
  6. `NEWS_BLACKLIST_KW`에 한국어 셀럽/비금융 키워드 추가 ('카다시안', '약물 운전' 등)
  7. scoreItem에 핵심 인물 발언/인터뷰 부스트(+15) 추가
  8. 정렬 버킷 15분→30분 확장 + score 차이 15점 이상이면 score 우선 정렬
- **예방 규칙 P28**: TECH_KW/MACRO_KW에 새 키워드 추가 시 3글자 미만은 금지. 티커 매칭은 extractTickers에서 word boundary(`\b`)로 처리해야 함.
- **예방 규칙 P29**: 텔레그램 채널 추가 시 t.me/s/{slug}로 공개 미리보기 확인 필수. 메시지 DOM이 없으면 `_TG_UNAVAILABLE`에 등록.
- **예방 규칙 P30**: 뉴스 티커 표시는 토픽 기반 — macro/geopolitics/policy/fed/rates/trade 토픽이면 티커 숨김. `isCompanyNews()`를 티커 표시 판단에 쓰지 말 것 (토픽 분류가 부정확할 수 있음).

---

## [2026-03-31] v38.4d — 분석 함수 품질 전수 점검: D/C등급 3대 결함 수정

- **증상 1**: PEG 분석이 고가주를 항상 "저PEG 저평가"로, 저가주를 "고PEG 고평가"로 판정. EPS 금액과 EPS 성장률을 혼동.
- **증상 2**: Weinstein Stage가 매일 바뀜 (어제 Stage2 → 오늘 Stage4). 실제 Stage 전환은 수주~수개월 단위.
- **증상 3**: BB 스퀴즈가 "오늘 변동 적음"만으로 발동하며, 94.1% 승률이라는 출처 불명 통계 표시.
- **근본 원인**: 일간 스냅샷 데이터만으로 장기 기술지표를 "흉내"낸 구현. 데이터 한계를 인정하지 않고 마치 정확한 지표인 것처럼 표시.
- **수정**: Weinstein→6개 복합지표, MTF→타임프레임별 고유지표, BB→"저변동성 압축"으로 정직화, PEG→올바른 공식
- **예방 규칙 P27**: 재무 비율/기술지표 구현 시 (1) 원전 정의 확인 (2) 분자/분모 단위 일치 (3) 필요 데이터 확보 여부 (4) 근사치면 "추정" 명시

---

## [2026-03-31] v38.5 — PEG 비율 계산 공식 오류 수정 + 펀더멘털 분석 깊이 강화

- **증상**: `_generateFundamentalAnalysis()`의 PEG 분석 블록이 완전히 잘못된 값을 출력. 예: NVDA PE 35.2, EPS $4.90 → PEG = 35.2 / max(4.90, 1) = 7.18로 표시되지만, 실제 PEG = PE / EPS성장률(%) = 35.2 / 72 = 0.49여야 함.
- **근본 원인**: PEG 공식이 `i.pe / Math.max(i.eps, 1)`로 구현되어 있었음. `i.eps`는 EPS 절대 금액($4.90 등)이지 EPS 성장률(%)이 아님. PEG = P/E / EPS Growth Rate(%)인데 분모가 완전히 틀림. 결과적으로 EPS 금액이 큰 종목(META $23.49)은 PEG가 낮게, 작은 종목(TSLA $1.08)은 PEG가 높게 나오는 역전 현상 발생.
- **수정 내용**:
  1. `FUND_FALLBACK`에 `epsGrowth` 필드 추가 (YoY EPS 성장률 %)
  2. PEG 계산을 `i.pe / i.epsGrowth`로 올바르게 수정
  3. PEG 해석 4단계: < 0 (수익 감소), < 1 (저평가), 1~2 (적정), > 2 (고평가)
  4. EPS 성장률 데이터 없는 종목은 "PEG 데이터 부족" 별도 표시
  5. 밸류에이션 트랩 경고 로직 추가 (저PE + 하락 + 저ROE/EPS 감소 조합)
  6. 성장-수익성 매트릭스 추가 (고성장+고마진 / 고성장+저마진 / 저성장+고마진 / 저성장+저마진)
  7. 섹터별 밸류에이션 비교에 표준편차 기반 z-score 판단 추가
- **예방 규칙**:
  - **P27**: PEG 비율 공식은 반드시 `P/E ÷ EPS 성장률(%)`. EPS 절대 금액($)을 분모에 사용 금지. 재무 비율 계산 시 분자/분모 단위 일치 여부 반드시 검증.
  - FUND_FALLBACK에 새 재무 지표 추가 시 단위(%, $, 배수) 주석 명기.

---

## [2026-03-31] v38.4 — QA 전수 점검: P25 `.pct || 0` 65개 일괄 수정 + P24 children 보호 보강

- **증상**: 데이터 미수신(pct=null/undefined) 종목이 UI에 "+0.00%"로 표시되어 실제 0% 변동과 구분 불가. AI 프롬프트에도 "0.00%"가 주입되어 분석 왜곡.
- **근본 원인**: `d.pct || 0` 패턴이 프로젝트 전체 65개 이상 산재. JavaScript의 `||` 연산자는 `0`도 falsy로 취급하므로, pct가 실제 0인 경우와 null/undefined인 경우를 구분할 수 없음.
- **수정 내용**:
  - **Category A (19개, UI 직접 표시)**: `d.pct != null ? d.pct : null` + 데이터 없음 시 "—" 표시, AI에는 "등락률 N/A" 전달
  - **Category B (22개, 계산 로직)**: `(d.pct != null ? d.pct : 0)` — null 명시 체크
  - **Category C (24개, 저위험)**: 유지 — 비교 연산/색상 결정에서 0이 적절한 기본값
  - **P24 보강**: L12114(screener tbody), L26837(kr-supply)에서 `[data-live-price]` 벌크 업데이트 시 `el.children.length > 0` 체크 추가
  - **insight-box 오버플로우**: collapsed 상태에서 `padding-right: 32px` 추가하여 `::after` 화살표와 텍스트 겹침 방지
- **예방 규칙**:
  - **P25 강화**: `.pct || 0` 패턴 신규 사용 절대 금지. 반드시 `d.pct != null ? d.pct : (기본값)` 사용. UI 표시 시 null이면 "—" 렌더링.
  - **P24 강화**: `[data-live-price]` 셀렉터로 벌크 업데이트하는 새 코드 작성 시, 반드시 `el.children.length > 0` 체크 포함.
- **추가 발견**: div 불균형 15개 보고 → `grep -c` vs `grep -o` 차이로 인한 착시 (실제 3,685:3,685 완벽 균형). 향후 div 균형 점검 시 `grep -o '<div' | wc -l` 사용.

---

## [2026-03-29] v38.3 — briefing-static-archive 초과 닫힘 태그로 전체 DOM 구조 붕괴 (P26 신규)

- **증상**: 환율·채권 등 모든 페이지 상단에 빈 둥근 막대 표시, "환율·채권" 제목 레이아웃 비율 이상, 전체적인 글자·화면 비율 불일치
- **근본 원인**: Line 3465에 불필요한 `</div>` 1개 존재. `briefing-static-archive` 내부의 `dynamic-briefing-content` div가 닫힌 직후 초과 `</div>`가 `briefing-static-archive`를 조기 닫음.
  - 연쇄 효과: (1) Line 3588의 `</div>`가 `page-briefing`을 닫음 (2) Line 3611의 `</div>`가 `main-content`를 닫음 (3) 이후 17개 페이지(technical~guide)가 `main-content` 밖 `.main`의 직접 자식으로 배치됨 (4) `chat-briefing`이 `main-content`의 직접 자식으로 남아 항상 표시됨 → 40px 빈 막대
- **놓친 이유**: 33,800줄 단일 파일에서 `</div>` 1개 초과를 육안으로 발견 불가. HTML 파서가 자동 복구하면서 에러 없이 렌더링되어 콘솔에서도 감지 안 됨.
- **수정 내용**: Line 3465의 초과 `</div>` 제거
- **예방 규칙**:
  - **P26**: 대규모 HTML 수정(섹션 추가/삭제) 후 반드시 `awk` 등으로 해당 블록의 `<div>`/`</div>` 균형 검증. `grep -c '<div' && grep -c '</div'` 최소 체크.
  - DOM 구조 이상 시 `document.getElementById('x').parentElement.id`로 실제 부모 확인 — HTML 소스와 브라우저 DOM이 다를 수 있음

---

## [2026-03-29] v38.3 — 세분화 테마 0% 표시 버그 + 클릭 핸들러/심층 분석 미구현 (P25 신규)

- **증상 1**: 세분화 테마(SUB_THEMES) 카드에서 데이터 미수신 종목이 +0.0%로 표시되어, 실제 0% 변동과 구분 불가
- **근본 원인**: `renderSubThemesGrid()` 내 대장주 표시에서 `var tc = d ? (d.pct || 0) : 0;` 패턴 사용. `d.pct || 0`은 pct가 null/undefined일 때뿐 아니라 **진짜 0**일 때도 0을 반환하여 구분 불가. 더 심각한 건 데이터가 아예 없는 종목(d는 있지만 price/pct가 null)도 0%로 표시.
- **수정**: `var hasData = d && d.price != null && d.pct != null;` → `tc === null ? '—' : formatted` 패턴. showThemeDetail()의 서브테마 종목 표시에도 동일 적용.
- **증상 2**: 세분화 테마 카드에 onclick 핸들러 없음, 심층 분석 패널(showSubThemeDetail) 미구현
- **수정**: `showSubThemeDetail(subThemeId)` 함수 신규 구현(~100줄), `#sub-theme-detail-panel` HTML 추가, 카드에 onclick+cursor:pointer 추가, aio:liveQuotes에 패널 자동 갱신 추가
- **예방 규칙**:
  - **P25**: `d.pct || 0` 패턴은 "데이터 없음"과 "진짜 0%"를 구분할 수 없으므로 금지. 반드시 `d && d.pct != null` 명시적 null 체크 사용.
  - 새 UI 섹션 추가 시, 반드시 (1) 클릭/인터랙션 핸들러 구현 여부, (2) aio:liveQuotes 자동 갱신 연결 여부를 점검.

---

## [2026-03-29] v38.3 — 4-보고서 전수 점검 대규모 수정 (P24 확장 + A5~A10 + B1~B6)

- **수정 항목 14건**:
  1. **A6 (CRITICAL)**: `generateMacroStoryline()` 내 `var ld` 선언 누락 → ReferenceError → try/catch로 무시 → "생성 중…" 영구 표시
  2. **A7 (P24 확장)**: 3개 벌크 `[data-live-price]` 업데이트를 `el.children.length > 0` 일반 보호로 강화. `.pill-price` 외에 `.kr-etf-price`, 기타 복합 요소도 보호
  3. **A9**: `_showKrSupplyFallbackNotice()`에서 `kr-supply-analysis-text` 미처리 → fetch 실패 시 "로딩 중…" 영구 표시
  4. **A10**: BZ=F(Brent)를 PRIORITY_SYMS에 추가, orphaned `macro-spread-value` 요소 JS 연결
  5. **B1**: 아시아경제(all.xml=404+비금융혼입), 이데일리(edaily_news.xml=리다이렉트) 브라우저 실테스트 후 제거
  6. **B2**: `_KR_BROAD_KW` 임계값 2→3 상향
  7. **B3**: 한국 Tier 3 소스 score -5 감점
  8. **B4**: NEWS_BLACKLIST_KW에 보험/카드/CSR/인사/법원/군사/생활경제 ~30키워드 추가
  9. **B5**: `_nonFinPatterns`에 한국어 비금융 정규식 10개 추가
  10. **B6**: RSS `parseXml()`에 HTML entity 이중 인코딩 해제 (`_decodeEntities`)
  11. **H6**: fundamental 카드 "(참고용 데이터)" 라벨을 라이브 데이터 유무에 따라 동적 변경
- **예방 규칙**: P24를 일반화 — `el.children.length > 0`이면 `textContent` 직접 설정 금지, 전용 업데이트 함수에 위임

---

## [2026-03-30] v38.2 — KR 테마 카드 종목명 소실 (pill DOM 파괴) (P24 신규)

- **증상**: KR 테마 페이지에서 모든 종목 pill이 가격 숫자만 표시하고 종목명·비중·등락률이 보이지 않음.
- **근본 원인**: `data-live-price` 속성을 가진 모든 DOM 요소에 대해 `el.textContent = price`로 벌크 업데이트하는 코드 3곳이 있었음. `.kr-ticker-pill`도 `data-live-price` 속성을 갖고 있어, pill 내부의 자식 span들(`.pill-name`, `.pill-wt`, `.pill-price`, `.pill-pct`)이 `textContent` 설정으로 모두 삭제됨.
- **놓친 이유**: `data-live-price` 글로벌 셀렉터가 KR 테마의 pill 컨테이너까지 매칭된다는 것을 인지하지 못함. pill은 자식 span에 데이터를 분리 저장하는 구조인데, 벌크 업데이트는 단순 텍스트 노드로 취급.
- **수정 내용**: 3곳의 벌크 업데이트에서 `var _pp = el.querySelector('.pill-price'); if (_pp) { _pp.textContent = fmt; } else { el.textContent = fmt; }` 패턴 적용
- **예방 규칙**:
  - **P24**: `[data-live-price]` 글로벌 셀렉터로 DOM을 업데이트할 때, 자식 요소가 있는 복합 구조(pill, card 등)의 경우 `textContent`나 `innerHTML`로 전체를 덮어쓰면 안 됨. 반드시 자식 스팬 존재 여부를 확인하고 타겟팅.
  - 새 `data-live-*` 속성 추가 시, 기존 벌크 업데이트 로직과의 충돌 여부 점검 필수.
- **QA 체크리스트 추가**: KR 테마 pill에 종목명·비중·등락률이 모두 표시되는지 확인 (최초 로드 + 실시간 갱신 후)

---

## [2026-03-30] v38.1 — flex column min-height 버그로 전체 페이지 스크롤 불가 (P2 재발 + P23 신규)

- **증상**: 모든 페이지에서 세로 스크롤이 동작하지 않음.
- **근본 원인 (P23 — flex min-height)**:
  1. `.main`과 `.content`가 flex column 레이아웃에서 `min-height: auto` (기본값)를 가짐
  2. flex column 아이템은 기본적으로 콘텐츠 높이 이하로 축소되지 않음 → `.content`가 콘텐츠만큼 커짐
  3. `overflow-y: auto`는 요소가 콘텐츠보다 작을 때만 스크롤바 생성 → 요소가 항상 콘텐츠만큼 크면 스크롤바 미생성
  4. `.main`의 `overflow: hidden`이 넘친 부분을 잘라내므로, 하단이 보이지 않고 스크롤도 안 됨
- **부가 원인 (P2 반복)**:
  1. `.insight-box.box-collapsed`에 `white-space:nowrap` + `max-width` 미설정 → 수평 오버플로우
  2. `.content`/`.page`에 `overflow-x:hidden` 미설정
- **수정 내용**:
  1. **핵심**: `.main`과 `.content`에 `min-height: 0` 추가 → flex 아이템이 콘텐츠보다 작아질 수 있게 하여 스크롤 활성화
  2. `.content`/`.page`/`.page.active`에 `overflow-x: hidden`
  3. `.insight-box`에 `max-width:100%; overflow-wrap:break-word`
- **예방 규칙**: **P23 (신규)** — flex column 레이아웃에서 overflow 스크롤을 사용하는 아이템은 반드시 `min-height: 0` 필수
- **패턴**: P23 신규 + P2 반복

---

## [2026-03-30] CHAT_CONTEXTS 이원화 선언 후 미적용 + 시장 키워드 누락 (P22)

- **증상**: v37.2에서 이원화(종가/실시간) 원칙 선언 후, 실제로는 home + Pro overrides 6개에만 적용. 12개 기본 컨텍스트(signal, breadth, sentiment, briefing, fundamental, themes, guide, screener, options, portfolio, fxbond, technical/macro)가 미적용 상태. 추가로 2026년 핵심 시장 키워드(CPO, 유리기판, agentic AI, Golden Dome, 800V, 휴머노이드 등) 대부분 누락.
- **근본 원인**: 피처 선언과 실제 적용 범위의 괴리. v37.2에서 `_closeSnap()` 함수를 만들고 home + Pro contexts에 적용했으나, 나머지 12개 기본 컨텍스트 적용을 "후속 작업"으로 미룬 채 버전을 올림. 키워드는 v37.4에서 메가캡 테크/AI에만 집중하고 2026년 신규 트렌드(첨단패키징, 방산, EV, 바이오) 확장 누락.
- **놓친 이유**:
  1. 적용 대상 전체 목록(18개 컨텍스트) 대비 완료 체크리스트 미작성
  2. v37.2 릴리즈 시 "전체 적용 완료"로 오인 — 실제로는 6/18만 완료
  3. 키워드 확장 시 현재 시장 트렌드 체계적 스캔 미실시
- **수정 (v37.5)**: 12개 기본 컨텍스트에 `_closeSnap()` 추가, briefing 뉴스 이중주입 제거, 지정학 블록 3개 컨텍스트 확산, 관세/무역전쟁 키워드 보강
- **수정 (v37.6)**: TECH_KW ~255→~340+(CPO, glass substrate, BSPDN, agentic AI, sovereign AI, custom silicon, InfiniBand, NVLink, liquid cooling, humanoid, 800V, RISC-V 등), MED_KW +Golden Dome/방산/800V/GLP-1, TOPIC_KEYWORDS semi·defense·energy 대폭 확장
- **패턴**: **P22 — 피처 선언-적용 괴리 (Declared but Partially Applied)**. 새 원칙/패턴을 선언할 때 적용 대상 전체 목록을 체크리스트화하고, 하나라도 미적용 시 버전 올리지 않는다. 키워드 확장 시 시장 트렌드 체계적 스캔 필수.
- **예방 규칙**: (1) 아키텍처 변경 선언 시 영향 범위 전수 목록 작성 → 100% 적용 확인 후 릴리즈. (2) 키워드 확장 시 "반도체·AI·방산·에너지·EV·바이오·매크로" 7대 섹터 체크. (3) QA-CHECKLIST R13(이원화 필수), R14(키워드 현행화) 신규 룰 추가 완료.

---

## [2026-03-28] v35.7 감사 보고서 16개 이슈 통합 (P21)

- **증상**: DATA_SNAPSHOT US 데이터 1일 지연(3/26), FALLBACK_QUOTES 1주 지연(3/20)+중복 49개, kr-supply 수급 모순, PRIORITY_SYMS 한국 84.5% 미커버
- **근본 원인**: 감사 보고서(v35.7)에서 식별한 Critical 5 + High 6 + Medium 5 이슈
- **수정 방법**: v35.7 업로드 파일에서 수정된 데이터 섹션을 현재 작업 파일에 병합. DATE_ENGINE, fetchKrNaverQuotes 등 기존 아키텍처 변경 보존하면서 데이터 계층만 교체
- **수정 범위**: DATA_SNAPSHOT (15개 필드), FALLBACK_QUOTES (전체 교체 350+개), kr-supply HTML (6개 투자자 수치), PRIORITY_SYMS (한국 +107종목, S&P +25종목), HTML 폴백값 (VIX, S&P, BTC, TNX, VKOSPI 등 10+개소)
- **예방**: 주기적 감사 보고서 기반 데이터 검증, DATA_SNAPSHOT과 FALLBACK_QUOTES 일관성 체크 자동화 필요

---

## [2026-03-28] SCREENER_DB sym 필드 중복으로 JS 문법 오류 (P20)

- **증상**: index.html 전체 스크립트 블록이 "Unexpected string" JS 문법 오류로 동작 불가
- **근본 원인**: 코스맥스/코스맥스BTI 분리 수정 중 `sym:'044820.KQ','192820.KQ'`로 두 값을 하나의 속성에 나열 → 유효하지 않은 JS 문법
- **놓친 이유**: 이전 세션에서 수정 후 JS 문법 검증 미실행. 개별 속성값 수정에서 객체 전체 문법까지 검증하지 않음.
- **수정 내용**: 중복 sym을 개별 SCREENER_DB 항목 2개로 분리 (044820 코스맥스BTI + 192820 코스맥스)
- **예방 규칙**: SCREENER_DB/KR_STOCK_DB 수정 후 반드시 `new Function(code)` 문법 검증 수행. 객체 속성에 다중 값 입력 금지.
- **QA 체크리스트 추가**: 코드 수정 후 전체 스크립트 블록 JS 문법 검증 필수 (기존 R4 보강)

---

## [2026-03-28] 한국 종목 데이터 무결성 전면 오류 3건 (CRITICAL)

### 버그 1: 레인보우로보틱스 종목코드 269620→277810 불일치

- **증상**: KR_STOCK_DB에 `269620`으로 등록된 레인보우로보틱스가 Yahoo Finance에서 `60,000원`(엉뚱한 회사 "Syswork Co.")으로 반환. 실제 레인보우로보틱스(277810)는 `567,000원`으로 약 10배 차이.
- **근본 원인**: 최초 종목 코드 입력 시 **외부 소스 교차 검증 없이** 코드를 입력. 269620은 코스닥에 실재하는 다른 회사(시스웍)의 코드. 레인보우로보틱스의 실제 코드는 277810.KQ.
- **놓친 이유**:
  1. 종목 추가 시 "코드→Yahoo API 응답 회사명 일치 여부" 검증 절차가 **존재하지 않았음**
  2. Yahoo Finance API가 잘못된 코드에도 정상 가격을 반환 → 에러가 아닌 "잘못된 정상 응답"이라 발각 어려움
  3. FALLBACK_QUOTES의 가격(175,400원)이 실제 레인보우 가격대와 비슷해서 눈에 띄지 않음
  4. QA-CHECKLIST에 **"종목코드↔회사명 매핑 검증"** 항목이 전무
- **영향 범위**: 11개소(HTML pill, SCREENER_DB, KR_STOCK_DB, KR_THEME_MAP, FALLBACK_QUOTES, alias배열, KOSDAQ_SET, 실시간 API 호출)
- **수정**: 전체 269620→277810 일괄 치환, price/mcap 갱신
- **패턴**: **P17 — 종목코드 미검증 입력 (Phantom Ticker)**. 코드를 수동 입력할 때 Yahoo/거래소 공식 매핑을 교차 확인하지 않으면, 다른 회사의 데이터가 조용히 들어온다.

### 버그 2: 294870 "두나무"로 표기 → 실제는 HDC현대산업개발 (비상장 기업 코드 오배정)

- **증상**: crypto 테마에서 "두나무(업비트)"가 40% 비중을 차지하는데, 실제로 표시되는 가격(20,750원)은 HDC현대산업개발(건설주)의 가격. 크립토 테마 수익률이 건설 섹터 움직임에 연동되는 치명적 오류.
- **근본 원인**: **두나무는 비상장 기업**이므로 코스닥/코스피에 종목코드가 없음. 294870은 HDC현대산업개발의 KOSPI 코드. 최초 등록 시 "업비트 운영사 = 두나무 = 상장사"라고 잘못 가정하고, 검증 없이 코드를 할당.
- **놓친 이유**:
  1. "두나무"가 비상장이라는 사실을 확인하지 않음 — 웹 검색이나 거래소 조회 미실시
  2. Yahoo Finance 294870.KQ가 가격을 반환하므로 "상장사 맞다"고 오인 (실제로는 HDC현대산업개발의 데이터)
  3. crypto 테마의 수익률 변동이 "크립토 시장이 원래 변동성이 크니까"로 합리화될 수 있어 이상 탐지 어려움
  4. QA에 **"종목의 상장 여부 확인"** 절차 없음
- **영향 범위**: KR_STOCK_DB, KR_THEME_MAP(crypto 테마 40%), HTML pill, SCREENER_DB, alias배열, KOSDAQ_SET
- **수정**: 294870→HDC현대산업개발로 정정, crypto 테마에서 제거 후 3종목 재분배(위메이드40/카카오35/갤럭시아25)
- **패턴**: **P18 — 비상장 기업을 상장 코드에 매핑 (Ghost Stock)**. 비상장 기업의 이름을 상장 코드에 붙이면 전혀 다른 회사의 데이터가 해당 이름으로 표시된다.

### 버그 3: 044820 "코스맥스" 표기 → 실제는 코스맥스BTI (자회사)

- **증상**: K-뷰티 테마에서 "코스맥스(ODM 1위)"로 14% 비중 배정. 실제 044820은 자회사 코스맥스BTI(원료)이며, ODM 본사 코스맥스는 192820.KQ. 가격도 10배+ 차이(코스맥스 147,700 vs 코스맥스BTI 9,520).
- **근본 원인**: 네이버/다음 증권에서 "코스맥스" 검색 시 044820(코스맥스BTI)과 192820(코스맥스)가 모두 나오는데, 첫 번째 결과를 본사로 오인하고 코드 할당. **회사명이 유사한 모자회사(parent-subsidiary) 구분 실패**.
- **놓친 이유**:
  1. 검색 결과의 첫 항목을 무비판적으로 채택 — 정식 회사명 전체("코스맥스비티아이" vs "코스맥스") 미확인
  2. Yahoo Finance에서 044820.KQ의 공식 이름 "Cosmax BTI Inc"을 확인하지 않음
  3. 가격 범위 검증 없음 — ODM 1위 코스맥스가 9,520원짜리 소형주라는 비합리성을 놓침
  4. QA에 **"유사 이름 모자회사 구분 확인"** 절차 없음
- **영향 범위**: KR_STOCK_DB, KR_THEME_MAP(kbeauty), HTML pill, SCREENER_DB, alias배열
- **수정**: 044820 이름→코스맥스BTI, 192820 코스맥스 본사 신규 추가, kbeauty 테마 대표 192820으로 교체

### 공통 근본 원인 분석

**왜 이 3건 모두 발생했는가:**

이 3건은 모두 동일한 근본 원인을 공유한다 — **종목 데이터 입력 시 외부 소스 교차 검증(cross-validation) 절차가 전무**. 구체적으로:

1. **"코드 입력 = 신뢰"**: 종목코드를 DB에 넣으면 그 순간부터 코드가 "진실"이 됨. Yahoo API가 해당 코드에 가격을 반환하면 "정상"으로 간주. 실제로 **어떤 회사의 데이터인지** 확인하는 절차가 없음.
2. **"이름 표기 = 검증"**: DB에 이름을 적으면 그것이 검증 완료로 취급됨. 실제 거래소 공식 종목명과 대조하는 단계가 없음.
3. **"가격 반환 = 상장 확인"**: Yahoo/네이버에서 가격이 나오면 "상장사 맞다"고 가정. 비상장/다른회사 가능성을 고려하지 않음.
4. **테마별 수익률 합리성 검증 부재**: crypto 테마가 건설주 데이터로 계산되어도, 결과값 자체가 "숫자"이므로 이상 탐지 안 됨.

**왜 기존 QA에서 못 잡았는가:**

- QA-CHECKLIST v3는 **UI 렌더링, 차트, 콘솔 에러, 네비게이션**에 집중. 204개 항목 중 **"데이터 원본의 정확성"**을 검증하는 항목이 0개.
- "수치가 0이 아니면 PASS" 로직으로는 **잘못된 회사의 정상 데이터**를 감지할 수 없음.
- BUG-POSTMORTEM의 16개 패턴(P1~P16) 중 **"종목코드 매핑 오류"** 패턴이 없었음.

### 신규 패턴 등록

| # | 패턴 | 심각도 |
|---|------|--------|
| P17 | Phantom Ticker — 종목코드 미검증 입력으로 다른 회사 데이터 유입 | 매우 높음 |
| P18 | Ghost Stock — 비상장 기업을 상장 코드에 매핑 | 매우 높음 |
| P19 | Parent-Sub Confusion — 유사 이름 모자회사 구분 실패 | 높음 |

### 예방 규칙 (R10~R12 신설)

- **R10. 종목코드 입력 시 3중 검증 필수**: (1) Yahoo Finance quote 페이지에서 공식 회사명 확인, (2) 회사명이 DB 등록명과 일치하는지 대조, (3) 가격/시총 범위가 해당 기업 규모와 합리적인지 확인
- **R11. 비상장 여부 선확인**: 신규 종목 추가 전 해당 기업이 KOSPI/KOSDAQ에 상장되어 있는지 거래소(KRX) 또는 금융포털에서 확인. "비상장"/"장외거래" 표기 시 코드 할당 금지.
- **R12. 유사 이름 모자회사 구분**: 검색 시 동일/유사 이름이 복수 나오면, 각각의 정식 종목명·코드·시총을 대조하여 본사/자회사 구분 후 올바른 코드 선택.

---

## [2026-03-29] v35.2 — FMP 데이터 정확도 전수 조사 (CRITICAL 4건 + MEDIUM 6건)

- **증상**: 기업 분석에서 실적/밸류에이션 데이터가 부정확하다는 사용자 보고.
- **근본 원인 (10건)**:
  1. **[CRITICAL] TTM vs Annual 불일치**: 심층 분석이 `v3/ratios/`(연간)와 `v3/key-metrics/`(연간)를 호출하면서 프롬프트/UI에 "TTM"으로 표시. 퀵뷰는 `v3/ratios-ttm/`을 올바르게 사용.
  2. **[CRITICAL] 기관 투자자 계산 오류**: `(shares × value) / shares` = 그냥 `value`. 의미론적 오류.
  3. **[CRITICAL] EV/Sales = P/S 잘못 대입**: `priceToSalesRatioTTM`을 `evToRev`에 할당. P/S ≠ EV/Sales.
  4. **[CRITICAL] FRED 0값 소실**: `parseFloat("0") || null = null` — 정상 0값이 누락됨.
  5. **[MEDIUM] % 변화율 0% 덮어쓰기**: `!pct || pct === 0` 조건이 정상 0%를 재계산.
  6. **[MEDIUM] CAGR 라벨 오류**: `rev3yCagr`라 했지만 실제 2년 간격 (0.5 지수).
  7. **[MEDIUM] CAGR NaN**: 음수 매출 시 `Math.pow(음수, 0.5)` = NaN.
  8. **[MEDIUM] DCF upside 타입 오류**: `.toFixed()` 후 문자열로 비교, `Math.abs(string)` 호출.
  9. **[MEDIUM] 배당수익률 fallback**: `price || 1` — 가격 없을 때 비정상적 배당률.
  10. **[MEDIUM] deep-compare key-metrics TTM 누락**: `_fetchDeepCompareData`에서 ratios는 TTM, metrics는 annual.
- **패턴**: **P15** — API 엔드포인트 선택과 데이터 라벨 사이의 불일치. 코드 복제 시 원본(퀵뷰 TTM)과 복제본(심층분석 annual) 간 동기화 실패.
- **패턴**: **P16** — JavaScript falsy 값(0, "") 처리 실수. `|| null`, `|| 1`, `!val` 조건에서 정상 0/빈문자열 소실.
- **예방 규칙**: (1) FMP 엔드포인트 선택 시 `-ttm` 접미사 명시 확인. (2) `|| null` 대신 `isNaN()` 또는 `== null` 사용. (3) 프롬프트/UI의 데이터 라벨과 실제 API 엔드포인트 교차 검증.
- **QA 체크리스트 추가**: 9B-1 "데이터 정확도 검증" 섹션 10개 항목.

---

## [2026-03-25] v33.5 — 텔레그램 CJK 최소길이 필터 오탐 (P14)

- **증상**: `isTelegramMsgRelevant('日銀が利上げを検討中、株式市場に影響')` 가 `false` 반환. '利上げ','日銀','市場' 키워드가 모두 배열에 존재하지만 매칭 실패.
- **근본 원인**: `text.length < 20` 최소길이 필터가 18자 일본어 문장을 차단. CJK 문자는 Latin 문자보다 정보밀도가 높아 18자도 완전한 뉴스 문장임.
- **수정**: 최소길이를 20→12로 하향. 12자는 CJK/Latin 모두 의미 있는 최소 메시지 길이.
- **교훈**: 문자열 길이 기반 필터는 언어별 정보밀도 차이를 고려해야 함. 다국어(특히 CJK) 지원 시 Latin 기준 하드코딩 금지.
- **재발 방지**: QA v3 Stage 7(뉴스)에 CJK 텍스트 단위 테스트 항목 포함.

---

## [2026-03-25] v33.3 — 텔레그램 '무료' 스팸 키워드 오탐

- **증상**: bornlupin 채널의 "오픈클로 무료 소프트웨어 AI 에이전트 수요 폭증" 같은 정당한 금융 뉴스가 차단됨.
- **근본 원인**: `spamKW`에 '무료'가 단독으로 포함되어, '무료 리포트', '무료 소프트웨어', '무료 API' 등 금융 맥락의 표현 전부 차단.
- **수정**: '무료' 단독 → '무료 이벤트','무료 참여','무료 가입','무료 체험','무료 쿠폰','무료 배송' 복합 패턴으로 구체화. '가입' 단독도 제거 (ETF 가입 증가 등).
- **패턴**: P11 — 스팸 필터의 단독 키워드가 정당한 콘텐츠와 충돌. 스팸 키워드는 가능한 복합 패턴으로 구체화할 것.

---

## [2026-03-25] v33.3 — 우주/항공우주 키워드 전무 → NASA/SpaceX 뉴스 100% 차단

- **증상**: SpaceX/Boeing/NASA 관련 뉴스가 텔레그램 필터에서 전부 차단됨.
- **근본 원인**: `relevantKW`에 space, rocket, satellite, NASA, SpaceX, Boeing 등 우주/항공 키워드가 단 하나도 없었음.
- **수정**: 영문 18개 + 한국어 19개 우주/항공우주 키워드 추가.
- **패턴**: P12 — 새로운 섹터/테마 부상 시 relevantKW 업데이트 필요. 정기적으로 채널 실제 포스트와 필터 결과 대조 필요.

---

## [2026-03-25] v33.1 — SEC EDGAR CORS 실패 + API 반환값 불일치 + 재무카드 폴백 부재

- **증상**: 기업 분석 탭에서 SEC 데이터 로드 실패, 재무 카드 전부 $0.00/N/A.
- **근본 원인**: (1) `data.sec.gov/api/xbrl/companyfacts` CORS 미지원 → `fetchViaProxy()` 폴백 없었음. (2) `fetchSECFinancials`가 `{ticker, cik, revenues}` 반환하지만 `_parseSECFinancials`는 `{facts: {'us-gaap': ...}}` 기대 → 항상 null 반환. (3) `_renderFundFinancials`에 SEC 데이터 폴백 없음.
- **수정**: (1) CORS 프록시 폴백 추가. (2) raw XBRL 데이터 반환으로 변경. (3) SEC 기반 재무 지표 계산 폴백 추가.
- **패턴**: P13 — API 함수와 파서 함수 간 반환값/기대값 불일치. 함수 수정 시 호출자와 피호출자 양쪽의 인터페이스 확인 필수.

---

## [2026-03-25] v32.1 — 초보자 모드 폐지 시 localStorage 마이그레이션

- **증상**: 기존 사용자가 `aio_beginner=1` 상태로 방문 시, 새 코드에서 `aio_beginner` 키를 읽지 않으므로 잔류 데이터 발생.
- **근본 원인**: `toggleBeginnerMode()` 제거 시 `aio_beginner` localStorage 키 정리 미수행.
- **수정**: `setAnalysisLevel()` 초기화 블록에서 `aio_beginner` 키 존재 시 삭제하는 마이그레이션 로직 추가.
- **패턴**: P10 — 기능 제거 시 관련 localStorage/sessionStorage 키 정리 필수.

---

## [2026-03-25] v32 — 한국 기술 분석 페이지 DOM target 불일치 (예방 수정)

- **증상**: `analyzeKrTickerDeep()`가 `#ticker-analysis-result`를 target으로 사용 → 한국 기술 분석 페이지(`page-kr-technical`)의 실제 결과 div는 `#kr-ticker-analysis-result`.
- **근본 원인**: US 분석 함수(`analyzeTickerDeep`)를 복제하여 KR 버전을 만들 때, target element ID를 한국 페이지용으로 변경하지 않음.
- **수정**: `analyzeKrTickerDeep()`의 target을 `#kr-ticker-analysis-result`로 변경, fallback으로 `#ticker-analysis-result` 유지.
- **패턴**: 함수 복제 시 target element ID 미변경 — 복제 기반 함수는 모든 DOM 참조를 교차 확인 필수.

---

## [2026-03-25] v31.10 — OPTIONS 페이지 전체 하드코딩 (Dead Page)

- **증상**: 옵션 분석 페이지의 모든 수치(VIX 26.78, VVIX 126.28, IV Rank 72, GEX -12.8B, Greeks, 스큐 등)가 하드코딩. init 함수 없음, pageShown/liveQuotes 리스너 없음.
- **근본 원인**: OPTIONS 페이지가 정적 HTML로만 구성. `initOptionsPage()` 부재. 무료 API로 옵션 전용 데이터(IV surface, Greeks, GEX) 가져올 수 없는 구조적 한계 미고려.
- **수정**: `initOptionsPage()` 함수 + pageShown/liveQuotes 리스너 추가. VIX/VVIX 실시간 연동. 나머지는 "참고용" 고지 배너 표시.
- **패턴**: P9 — 페이지 HTML만 존재하고 초기화/이벤트 리스너가 없는 "Dead Page"

---

## [2026-03-25] v31.10 — PORTFOLIO 페이지 첫 진입 시 빈 화면

- **증상**: 포트폴리오 페이지 첫 진입 시 빈 화면. liveQuotes 갱신(60초) 후에야 렌더링.
- **근본 원인**: `aio:pageShown` 리스너 미등록. liveQuotes만 있어 첫 진입 시 renderPortfolio() 미호출.
- **수정**: pageShown 리스너 추가 → portfolio 진입 시 즉시 renderPortfolio() 호출.
- **패턴**: P9 동일.

---

## [2026-03-25] v31.9 — 홈 AAII 심리 카드 빈 화면 (차트 미렌더링)

- **증상**: 홈 페이지의 AAII 투자심리 카드에 차트가 빈 캔버스로 표시됨. 데이터는 정상 로드되었으나 시각적으로 빈 카드.
- **근본 원인**:
  1. `initSentimentCharts()`가 DOMContentLoaded에서 호출되나, Chart.js CDN 로드가 느릴 경우 `Chart`가 undefined → 차트 생성 실패
  2. 실패 시 에러가 try-catch에 의해 조용히 무시됨 → 재시도 메커니즘 없음
  3. 캔버스 아래 텍스트 폴백이 없어 차트 실패 시 카드 전체가 빈 상태
- **놓친 이유**:
  - CDN이 빠를 때는 정상 작동 → 간헐적 재현
  - 홈 페이지의 AAII 카드는 미니 프리뷰용이라 QA 시 sentiment 페이지만 확인하는 경향
  - 기존 QA에 "CDN 지연 시 차트 렌더링 실패" 시나리오 없었음
- **수정 내용**:
  1. 캔버스 아래에 bear%/bull%/signal 텍스트 폴백 추가 → 차트 실패해도 수치 표시
  2. 2초 딜레이 후 `sentPageCharts['aaii']` 존재 여부 체크 → 없으면 재시도
  3. 텍스트 폴백 값이 차트 데이터 로드 시 동적 업데이트
- **예방 규칙**: 차트 의존 카드에는 반드시 텍스트 폴백 제공. CDN 지연 대비 retry 메커니즘 필수.
- **QA 체크리스트 추가**: "홈 페이지 AAII 카드에 수치 텍스트가 표시되는지 확인 (차트 없이도)"

---

## [2026-03-25] v31.9 — Market Breadth 배지 텍스트가 바 차트와 겹침

- **증상**: Market Breadth 섹션에서 "베어 다이버전스" 등 긴 한국어 배지 텍스트가 바 차트 영역을 침범하여 겹침. 텍스트가 차트 위에 표시되어 가독성 심각 저하.
- **근본 원인**:
  1. `grid-template-columns: 110px 1fr 52px 72px` — 배지 컬럼(72px)이 한국어 텍스트 폭(~96px)보다 좁음
  2. `white-space: nowrap` 없이 텍스트가 줄바꿈되거나, nowrap인데 overflow 처리 없어 인접 컬럼 침범
  3. 한국어 텍스트는 같은 글자 수 대비 라틴 문자의 ~1.5배 폭 → 영문 기준 설계된 컬럼에서 오버플로우
- **놓친 이유**:
  - 영문 데이터("Bearish Divergence" 등)로 개발/테스트 → 한국어 번역 후 폭 미검증
  - grid 셀에 `overflow: hidden` + `text-overflow: ellipsis` 미적용
  - 기존 QA에 "한국어 텍스트 폭이 고정폭 컬럼을 초과하는지" 검증 항목 없었음
- **수정 내용**:
  1. grid 컬럼 조정: `110px 1fr 52px 72px` → `120px 1fr 44px 80px`
  2. `.bb-badge`에 `white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:80px`
  3. "베어 다이버전스" → "베어 다이버" 약어 적용 (배지 공간 내 수용)
  4. 768px/480px 반응형 브레이크포인트에서 컬럼 추가 축소
- **예방 규칙**: **P7** — 고정폭 CSS grid 컬럼은 한국어 텍스트 최대 폭(글자수 × ~14px)을 기준으로 설계. `text-overflow: ellipsis` 필수 적용.
- **QA 체크리스트 추가**: "모든 고정폭 grid 셀에서 한국어 텍스트가 넘치거나 인접 셀을 침범하지 않는지 확인"

---

## [2026-03-25] v31.5 — 데이터 파이프라인 불필요 실패 요청 대량 발생

- **증상**: 페이지 로딩 시 콘솔에 503/429 에러 100건 이상 발생. RSS2JSON 429 rate limit, Yahoo Finance 직접 호출 503, FRED 직접 호출 503. CF Worker가 설정되어 있음에도 모든 API가 먼저 직접 호출을 시도하여 실패 후에야 CF Worker로 폴백.
- **근본 원인**:
  1. RSS2JSON: CF Worker가 XML 파싱 가능한데도, rss2json을 항상 우선 시도 → 429 rate limit
  2. FRED: `fetchFredSeries()`가 직접 호출(CORS 차단됨)을 먼저 시도 → 503 → CF Worker 폴백
  3. Yahoo Finance: 매 심볼(100+)마다 직접 fetch 시도 → 503 → CF Worker 폴백 (심볼당 1건 낭비)
  4. Staleness 배너: `DATA_SNAPSHOT._updated`가 30시간 전이면 실시간 데이터 수신 후에도 경고 배너 미해제
- **놓친 이유**:
  - CF Worker 도입(v30 시점) 후 기존 폴백 로직을 CF Worker 우선으로 리팩토링하지 않음
  - 직접 호출의 CORS 차단이 "예상된 실패"로 방치됨 — 성능 영향 미인식
  - rss2json free tier 한도(10req/min)를 CF Worker 대체 가능 시점에서 미제거
- **수정 내용**:
  1. RSS2JSON: `_hasCfWorker` 플래그로 CF Worker 존재 시 rss2json 완전 건너뜀
  2. FRED: `fetchFredSeries()` 내부에 CF Worker 우선 호출 추가 (1차 CF → 2차 직접 → 3차 CORS 프록시)
  3. Yahoo: `_skipDirect` 플래그로 CF Worker 존재 시 직접 호출 건너뜀 → 즉시 CF Worker 사용
  4. Staleness: 12초 후 `_quoteTimestamps` 확인, 120초 이내 데이터 있으면 배너 자동 숨김
- **예방 규칙**: **P6** — 새 인프라(CF Worker 등) 도입 시, 기존 폴백 체인의 우선순위를 반드시 재배치
- **QA 체크리스트 추가**: "CF Worker 설정 시 직접 호출 503/429가 콘솔에 발생하지 않는지 확인"

---

## [2026-03-25] v31.2 — 시그널 페이지 빈 여백 공간

- **증상**: 시그널 페이지 "종합 거래 점수" 게이지 오른쪽에 거대한 빈 공간. "[현금 확보]" 배너가 1줄인데 영역이 게이지 높이만큼 세로로 늘어남.
- **근본 원인**: JS에서 `signal-advice` 배너를 동적 생성할 때, `scoreCard.after(adviceEl)` 로 삽입 → 삽입 위치가 `grid-template-columns: 200px 1fr` **grid 컨테이너 내부**였음 → 배너가 grid의 1fr 칸에 들어가면서 왼쪽 200px 게이지 높이에 맞춰 세로로 스트레칭됨.
- **놓친 이유**:
  - `closest('[style*="display"]')` 선택자가 어느 부모를 잡는지 실제 DOM에서 미확인
  - 동적 삽입 코드가 grid/flex 컨테이너 안에 들어가는지 **정적 분석만으로는 파악 어려움**
  - 기존 QA 체크리스트에 "동적 DOM 삽입 위치의 부모 레이아웃 확인" 항목 없었음
- **수정 내용**: grid 바깥에 전용 `<div id="signal-advice-container">` 생성 → JS에서 해당 컨테이너에 innerHTML로 배너 렌더링
- **예방 규칙**: **R4** — JS에서 동적 DOM 삽입 시, 삽입 대상의 부모가 flex/grid 컨테이너인지 반드시 확인
- **QA 체크리스트 추가**: "동적 생성 요소가 grid/flex 레이아웃을 깨뜨리지 않는지 확인"

---

## [2026-03-25] v31.1 — AI 챗 응답 가로 텍스트 (세로가 아닌 가로로 표시)

- **증상**: 포트폴리오 AI 분석 등 채팅에서 LLM 응답이 세로가 아닌 가로(컬럼)로 표시됨. 텍스트가 좁은 컬럼들로 쪼개져 위→아래가 아닌 좌→우로 읽혀야 하는 형태.
- **근본 원인**:
  1. 시스템 프롬프트에서 테이블 금지 규칙이 있었으나, Claude가 때때로 무시하고 markdown 테이블 생성
  2. `renderMarkdownLight`가 해당 테이블을 `<table>` 로 충실히 렌더링
  3. 테이블 컬럼이 6개 이상인 경우 좁은 `.acp-bubble` 안에서 각 셀이 극단적으로 좁아짐
  4. `.chat-tbl th`에 `white-space:nowrap` → 셀이 줄바꿈 불가 → 테이블이 컨테이너보다 넓어짐
  5. `.aio-chat`에 `overflow:hidden` → 넘친 부분 잘림
  6. 모든 채팅 메시지 영역에 하단 여백(padding-bottom) 부족 → 마지막 메시지가 입력창에 가려짐
- **놓친 이유**:
  - LLM 응답은 비결정적 → 특정 질문에서만 테이블 생성 → 단순 코드 리뷰로 발견 불가
  - `.chat-tbl th`의 `white-space:nowrap`이 원래 헤더 가독성을 위한 것이었으나 부작용 미고려
  - 기존 QA에 "LLM이 금지된 포맷을 사용할 때의 방어 렌더링" 테스트 없었음
- **수정 내용**:
  1. `.acp-bubble`에 `overflow-x:auto; white-space:normal` 추가
  2. `.chat-tbl th/td`에 `white-space:normal; word-break:break-word; max-width:200px`
  3. `renderMarkdownLight`에서 5컬럼 초과 테이블 → 카드형 리스트 자동 변환
  4. 시스템 프롬프트에 대체 포맷 3가지 구체적 명시
  5. 모든 채팅 영역(`acp-messages`, `chat-signal-msgs`, `chat-fxbond-msgs`, `chat-screener-msgs`)에 padding-bottom 추가
- **예방 규칙**: **R5** (overflow 3중 방어), **R6** (LLM 응답 렌더링 안전장치)
- **QA 체크리스트 추가**: "AI 채팅에서 긴 테이블/복잡한 마크다운 응답 시 렌더링 깨짐 없는지 확인"

---

## [2026-03-25] v31 — 버전 불일치 (v30.15 표기인데 실제 파일 없음)

- **증상**: v30.15를 올렸다고 했는데 실제 파일이 존재하지 않음. title/badge만 v30.15로 바꿨고, 파일 내용은 v30.13과 동일.
- **근본 원인**: 코드 내용 변경 없이 title/badge의 버전 번호만 올림. 실제 versioned 파일(aio_ui_prototype_v30_15.html) 미생성.
- **놓친 이유**: 버전 동기화를 체크하는 절차가 없었음. "title 수정 = 새 버전"이라는 잘못된 관행.
- **수정 내용**: 버전 체계 변경 (소수점 1자리 한정) + 4곳 동기화 검증 절차 도입
- **예방 규칙**: **R1** (버전 동기화 4곳 확인), **R2** (버전 체계)

---

## [2026-04-05] v41.8 -- 3건 감사 리포트 반영: 종목 품질 수정 + 테마 가중치 재분배 + CSS 그리드 정렬

### Bug 1: streaming 서브테마 weights PARA->PSKY 키 불일치
- **증상**: PSKY 티커는 tickers 배열에 있으나 weights에는 PARA 키 잔존 -> PSKY 가중치 0% 처리
- **근본 원인**: Paramount->Skydance 합병으로 PARA->PSKY 티커 변경 시 tickers만 업데이트, weights 키 미변경
- **놓친 이유**: tickers와 weights를 별도 객체로 관리하므로 한쪽만 수정해도 JS 에러 미발생
- **수정 내용**: `weights:{...PARA:10}` -> `weights:{...PSKY:10}`
- **예방 규칙**: 티커 변경 시 tickers/weights/leaders 3곳 동시 검증 필수
- **violated_rule**: 신규 (Data Consistency -- ticker rename propagation)

### Bug 2: KR 종목 pill CSS Grid 열 불일치 (display:none 자식)
- **증상**: 종목 pill에서 이름/가중치/가격/등락률 열이 뒤죽박죽 정렬
- **근본 원인**: `.kr-ticker-pill` grid-template-columns가 `auto 1fr auto auto`인데, 첫째 자식 `.pill-code`가 `display:none` -> grid에 참여하지 않아 pill-name이 auto 열에 배치되어 정렬 파괴
- **놓친 이유**: display:none 자식이 grid 배치에서 제외되는 CSS 사양을 간과
- **수정 내용**: grid를 `1fr auto auto auto`로 변경 + `::before` pseudo-element로 가중치 비례 배경 바 추가 + pill-price/pill-pct에 min-width 지정
- **예방 규칙**: CSS Grid에서 `display:none` 자식은 열 배치에서 완전히 제외됨. grid 설계 시 숨김 자식 고려 필수
- **violated_rule**: R4 (동적 DOM/display 상태가 레이아웃에 미치는 영향)

### 종목 품질 수정 (감사 리포트 기반)
- **SSNLF 제거** (memory, foundry): OTC ADR, 극히 낮은 유동성, 시세 수신 불안정. 비중 MU/STX/WDC 재분배
- **LCID 제거** (ev_auto): Altman Z-Score -3.10, 역방향 주식분할, 순이익률 -290%. 5개 quick-access 배열에서도 제거
- **STEM 제거** (hydrogen_ess): NYSE 상장유지기준 미달, 파산확률 84%. FLNC(Fluence Energy) 대체 추가
- **U 제거** (gaming): Runtime Fee 논란, 개발자 신뢰 상실, 수익성 미확보
- **BTBT/HUT/APLD 제거** (neocloud): 실질 AI 매출 미미, 자금 부족 우려
- **PLUG w:28->25, FCEL w:24->15** (hydrogen_ess): BE w:35로 비중 확대
- **SEDG w:16->8** (solar_renew): 유럽 인버터 재고 과잉, 적자 전환
- **photonics_kr 12->4종목**: 시총 200억 미만 초소형주 8개 제거, 쏠리드/케이엠더블유/RFHIC/오이솔루션만 유지
- **crypto 카카오 w:30->15**: 크립토 매출 비중 극소, 위메이드 w:25->35 승격
- **KR_STOCK_DB theme 배열 6건 수정**: POSCO홀딩스, LG화학, 한화솔루션, 현대글로비스, 리가켐바이오, SK이노베이션

### 분석 로직 개선
- **SPY ATH 동적 추적**: 하드코딩 640 -> localStorage 기반 동적 갱신
- **calcCompositePerf 가중치 폴백**: sqrt(price) -> SCREENER_DB mcap 기반 (정확도 향상)

---

## 패턴 요약 (자주 반복되는 근본 원인)

| # | 패턴 | 발생 횟수 | 심각도 |
|---|------|----------|--------|
| P1 | 동적 DOM 삽입이 grid/flex 레이아웃 파괴 | 1 | 높음 |
| P2 | overflow 미설정으로 콘텐츠 넘침/잘림 | 2+ | 높음 |
| P3 | LLM 비결정적 출력에 대한 방어 렌더링 부족 | 1 | 중간 |
| P4 | 버전 표기와 실제 내용 불일치 | 2+ | 높음 |
| P5 | 코드 변경 후 브라우저 실제 확인 미실시 | 다수 | 높음 |
| P6 | 새 인프라 도입 후 기존 폴백 우선순위 미재배치 | 1 | 높음 |
| P7 | 고정폭 grid 컬럼이 한국어 텍스트 폭 미수용 | 1 | 중간 |
| P8 | CDN 지연 시 차트 렌더링 실패 + 텍스트 폴백 부재 | 1 | 중간 |
| P9 | 페이지 HTML만 존재, init 함수/이벤트 리스너 누락 (Dead Page) | 2 | 높음 |
| P15 | API 엔드포인트 선택과 데이터 라벨 불일치 (TTM vs Annual) | 3+ | 높음 |
| P16 | JS falsy 값(0, "") 처리 실수 (`\|\| null`, `!val` 등) | 3+ | 중간 |
| P17 | Phantom Ticker — 종목코드 미검증 입력으로 다른 회사 데이터 유입 | 1 | 매우 높음 |
| P18 | Ghost Stock — 비상장 기업을 상장 코드에 매핑 | 1 | 매우 높음 |
| P19 | Parent-Sub Confusion — 유사 이름 모자회사 구분 실패 | 1 | 높음 |
| P20 | 미정의 변수 참조 — 리팩토링 시 변수명 변경 누락 (qqq→ld['QQQ']) | 1 | 높음 |
| P23 | flex column에서 min-height:0 누락 → overflow 스크롤 미작동 | 1 | 매우 높음 |
| P39 | 티커 rename 시 tickers/weights/leaders 부분 전파 | 1 | 높음 |
| P40 | CSS Grid display:none 자식이 열 배치에서 제외되어 정렬 파괴 | 1 | 높음 |
| P41 | 상폐위험/파산위험/유동성부족 종목 미제거 (SSNLF/LCID/STEM) | 1 | 중간 |
