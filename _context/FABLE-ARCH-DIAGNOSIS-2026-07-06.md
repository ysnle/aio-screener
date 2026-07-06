---
verified_by: agent (Fable 5 — 정적 전수 실측 + git 실측 + 07-02 진단 코드 대조 + 헤드리스 스위트 1회 실행)
audit_date: 2026-07-06
target_version: v52.18 (HEAD 5d54f39, working tree clean)
confidence: high — 단 §0 커버리지 표의 "문서 인용/미검증" 항목은 그 등급대로만 신뢰할 것
purpose: Sonnet 5 작업 세션 인수인계 — 2026-07-06 전수 아키텍처 진단(7축 스코어카드) + 우선순위 로드맵 Phase 0~4. 이 문서만으로 cold start 가능.
---

# AIO Screener 전수 아키텍처 진단 + Sonnet 5 인수인계 (Fable 5, 2026-07-06)

> `FABLE-SYSTEM-DIAGNOSIS-2026-07-02.md`(v51.90)의 후속. 07-02 로드맵 Phase 0~3의 실행 결과를
> **코드로 대조 검증**했고(§2), 남은 리스크를 v52.18 기준으로 재서열화했다(§5). 실행은 §6 로드맵 순서.
> 개별 버그 사냥이 아니라 구조 진단이다 — 개별 버그는 기존 postmortem→rule→gate 루프가 담당(P604~P616에서 재실증).

---

## 0. 진단 방법·커버리지 (정직표)

"전수 진단"의 정확한 범위. 아래 등급 구분을 그대로 신뢰 등급으로 쓸 것.

**A. 직접 실측 (신뢰 높음)**
- 파일 전수 규모/구성: index.html 32,011줄(2.32MB) + js 6모듈 61,270줄 + sw.js 233줄, gzip 실측(§3)
- 정독한 파일: `sw.js` 전문, `.github/workflows/` 3종 전문, `version.json`, `_context/CODE-MAP.md` 전문, `_context/CLAUDE.md` 전문, `_context/INDEX.md` 전문, `FABLE-SYSTEM-DIAGNOSIS-2026-07-02.md` 전문, `scripts/ci-structural-check.mjs`, `scripts/ci-headless-tests.mjs` 헤드, `package.json`, BUG-POSTMORTEM §P605~P608
- 패턴 전수 카운트: `window.`/`innerHTML`/`getElementById`/`localStorage`/`setTimeout`/`fetch(`/`!important`/함수 선언(파일별)
- **index.html↔js 모듈 간 최상위(컬럼0) 동명 함수 선언 전수 대조** → 충돌 1건 확정(§4-A)
- git 실측: 커밋 666(작성자 분포 포함), pack 12.21MiB, loose 656개/78.49MiB, garbage 0, 파일별 변경 빈도
- 07-02 진단 8개 항목의 해소 여부를 문서가 아닌 **코드에서** 재확인(§2)
- R1 버전 동기화 스팟 체크(title/badge/APP_VERSION/version.json/sw.js = v52.18 일치)

**B. 런타임 실측 (이번 세션 1회)**
- `node scripts/ci-headless-tests.mjs` 직접 실행(외부 네트워크 차단, seed-fallback 상태): **899/922 pass — 실패 23건 전원 skip-list 기등재, 예상 밖 회귀 0건**. CLAUDE.md의 v52.18 기록(899/922)과 정확히 재현 일치 — skip-list는 정확하며(과대 아님), 게이트 승격의 선행 과제는 이 23건 자체의 triage다(§6 Phase 2-6)

**C. 문서 인용 (중간 — 이번에 재측정 안 함, 출처 명기)**
- 로컬 load ~8.5s / DOMContentLoaded ~350ms (CODE-MAP v52.0 실측 기록)
- 상주 DOM ~11K노드 (OPUS-HANDOFF 2026-06-10 실측; 이번엔 정적 `<div>` 3,911개만 재실측)
- cron 명목 30분 vs 실발화 1~4h (P609 실측 기록)

**D. 미검증 (이번 진단 범위 밖 — "전수"에 포함 안 됨)**
- 실브라우저 시각 렌더링(Chrome 미연결 — CLAUDE.md의 QA-CHECKLIST 잔여 항목과 동일 상태)
- 라이브 사이트 실응답/실성능 (워치독이 상시 감시 중인 영역)
- RULES.md 273KB·QA-CHECKLIST 159KB의 내용 수준 정합성(`/knowledge-lint` 영역)
- aio-chat.js LLM 프롬프트/키 취급 로직 정독 (CHAT-DATA-AUDIT-2026-06-04가 최신 baseline)
- 접근성 실측(accessibility-auditor 에이전트 영역), 페이지별 비즈니스 로직의 금융적 정확성
- KR orphan fetcher 5건(§6 Phase 0-2)의 소생 타당성, cloudflare-worker-proxy 실배포 여부

---

## 1. 총평 + 스코어카드

**"운영·거버넌스는 기관급(A-), 실행 기반(코드 구조·전달 성능)은 C대 — 그리고 그 격차를 시스템이 스스로 알고 있고 갚는 속도가 빠르다."** 07-02 진단의 P0/P1 대부분이 4일 만에 실제 해소됐음을 코드로 확인(§2). 남은 것은 대부분 단발 수정이 아닌 방향성 있는 점진 이전이 필요한 만성 클래스.

| 축 | 등급 | 한 줄 근거 |
|---|---|---|
| 데이터 파이프라인·운영 | **A-** | repo+LIVE 이중 워치독, CI 게이트 배포, deploy retry, push rebase retry. 잔여: Yahoo 스크리너 단일의존, 알림 이메일 단일, 인간 크론 |
| 거버넌스·지식 시스템 | **A-** | P625·R280·9게이트·훅6·스킬 폐쇄 루프. 잔여: 2.8MB 비대 + 지도 drift 실사례(§4-G) |
| 품질·테스트 | **B** | 922 헤드리스 상설 + 이번 런 899/922 재현·예상 밖 회귀 0. 잔여: report-only(게이트 아님), skip-list 23건 미해소, 시각 회귀 0건 |
| 알고리즘 정합성 | **B-** | C1(RSI)·C4(HY)·C6(adjclose) 해소 실측. 잔여: C2(백테스트≠라이브), C3(중심지표 표본 부족) |
| 보안 | **B-** | SRI+DOMPurify+egress가드+Jekyll 제외 재현. 잔여: CSP 부재(구조 제약), innerHTML 419, 공개 프록시 무결성 |
| 코드 아키텍처 | **C+** | 93K줄 모놀리스, 전역 ~3,400참조, 로드순서 alias 역참조, 그림자 선언 1건 잔존(§4-A) |
| 성능·전달 | **C** | 매 방문 ~2.1MB gzip 풀 재다운로드(신선도 우선 의도 설계), digest 431KB 부팅, !important 512(증가 추세) |

---

## 2. 07-02 진단 대비 — 해소 확인 (문서 아닌 코드로 대조)

| 07-02 항목 | 판정 | 확인 근거 (2026-07-06 실측) |
|---|---|---|
| A7 로컬 git/OneDrive 병듦 (P0) | ✅ 해소 | 리포 `C:\Projects\AIO` 이전, garbage 0, pack 12.21MiB. loose 656개/78MB는 gc 1회감(§6 Phase 0-3) |
| A2 전 스크립트 동기 로딩 | ✅ 해소 | 5개 모듈 전부 `defer`(index.html:12496-12498, 15985, 28380) + CDN 3종 SRI(`integrity`)(12420-12424) |
| A3 핵심 알고리즘 인라인 잔존 | ✅ 해소 | computeTradingScore → js/aio-core.js:20068 (v51.98) |
| A6a `_context/CLAUDE.md` 인코딩 파손 | ✅ 해소 | 정상 UTF-8 재작성본 정독 확인 |
| A6b CODE-MAP 60버전 stale | ✅ 해소(단 §4-G 참조) | v51.90 재스캔본 존재. 이미 v52.18과 28버전 차 — line 앵커는 "grep 재확인" 원칙 유지 |
| C1 RSI 서버(Cutler)↔클라(Wilder) | ✅ 해소 | fetch-data.mjs:686 주석 — v51.91/P584/R265에서 Wilder 단일화. **CODE-MAP:124·260은 아직 "미해결"로 표기 — 문서 drift(§6 Phase 0-4)** |
| C6 배당 미조정 종가 | ✅ 해소 | fetch-data.mjs:539~546 adjclose 사용 |
| C4 HY 근사식 2원화 | ✅ 해소 | v52.18/P5m "HY 스프레드 소스 불일치" (version.json note) |
| B5 922 테스트 CI 미실행 | ✅ 해소(부분) | ci.yml `headless-tests` job 상설 — 단 `continue-on-error: true` report-only, deploy `needs` 미편입(§6 Phase 2) |
| B6 유니버스 정규식 파싱 | ✅ 해소 | public-data/screener-universe.json + sync-screener-universe.mjs + CI drift 검증 |
| B2 FRED 확장 | ✅ 부분 | v51.97에서 3시리즈 추가(HOUST/RSAFS/CES0500000003). 수동층 잔존은 §4-C |
| B1 Yahoo 단일 의존 | ⚠️ 부분 | 코어 ETF 20종만 Twelve Data 폴백 — **스크리너 881심볼은 여전히 Yahoo 단일** |
| C3 매매점수 검증 하네스 | ⚠️ 부분 | backtest-trading-score.mjs 구축(v52.2) — F&G 히스토리 24/201일, `statisticallyMeaningful: false` 자인. **시간이 해결하는 항목 — 착수 금지**(§6 Phase 3-2) |
| C2 백테스트≠라이브 모델 | ⬜ 미착수 | 서버 4팩터 고정가중 vs 라이브 7팩터 레짐 적응 — 그대로(§6 Phase 3-1) |
| A4 전역 상태 산개 | ⬜ 만성 | `window.` 참조 ~3,400(테스트 제외) — 구독 모델 이전 미완(§6 Phase 4-3) |

추가로 이번 기간의 CI 엔지니어링 성숙 사례(코드로 확인): R272(`GITHUB_TOKEN` push가 후속 워크플로를 안 울리는 함정 → `workflow_run` 체인), P602/R278(`workflow_run.head_sha`가 이전 사이클 트리를 가리키는 함정 → `head_branch` 체크아웃), Pages 배포 25% 간헐 실패의 in-place retry(ci.yml:207-219), push race의 rebase retry(refresh-data.yml:102-114).

---

## 3. 시스템 스냅샷 (2026-07-06 실측)

- **규모**: 클라 ~93K줄. 함수: index.html 최상위(컬럼0) 293 + core 363 + data 321 + ui 163 + chat 93 (+tests 90)
- **전송(gzip 실측)**: index.html 618KB + 모듈(core/data/ui/chat/glossary) 1,031KB + telegram-digest.json 431KB ≈ **부팅 ~2.1MB** (+CDN 3종, aio-tests.js 134KB는 lazy). sw.js:136 shell `no-store` Network-First → **재방문에도 매번 풀 다운로드**(신선도 우선 의도 설계 — 변경 비권장 §7)
- **DOM**: 정적 `<div>` 3,911개, 22 route 페이지 전체 상주
- **상태/표면**: `window.` core 1,862/data 711/chat 280/ui 207/index 332 ≈ 3,400(tests 1,084 별도) · `innerHTML` 419(tests 제외) · `getElementById` ~1,300 · `!important` **512**(6/10 감사 325 → +57%) · `var` 4,305 vs `const` 174(aio-core, ES5 관용구)
- **git**: 666커밋 = 데이터봇 240 + 인간 227 + 세션봇 199 (**66% 자동화**). 최근 30일 412커밋. 최다 변경: index.html 334회
- **거버넌스 텍스트**: CHANGELOG 1,425KB + BUG-POSTMORTEM 837KB(P625) + RULES 274KB(R280) + QA 159KB + KB 71KB ≈ **2.8MB — 앱 gzip 전송량(2.1MB)보다 무겁다**
- **외부 의존**: CDN 3종(chart.js@4.4.0/dompurify@3.0.9/lightweight-charts@4.2.0, 버전 고정+SRI) · 공개 CORS 프록시 4+종(allorigins/corsproxy.io/codetabs/cors.lol 등) · Yahoo(비공식)/FRED/FMP/Finnhub/Naver/RSSHub/Anthropic
- **테스트**: 헤드리스 922종 — 이번 실측 **916 pass / 실패 6건 전부 skip-list 기등재, 예상 밖 회귀 0**

---

## 4. 축별 발견 (잔존 리스크만 — 해소분은 §2)

### A. 코드 아키텍처 (C+) — 문제는 크기가 아니라 "경계 없음"

- **[유일 P1] 그림자 선언 1건 잔존**: 최상위 동명 함수 전수 대조 결과 `fetchKrDynamicData`가 index.html:20374와 js/aio-data.js:13321에 이중 선언(defer 실행 순서상 후자가 항상 승리 — P605/R280에서 실증·규칙화된 클래스). index.html 사본과 그것만이 호출하던 orphan 5함수(`fetchKrTradingVolume`/`fetchKrInvestorTop10`/`fetchKrWeeklySupply`/`fetchKrShortSelling`/`fetchKrBreadthData`)는 v51.08/P524 이후 도달 불능 사문. P605가 의도적으로 최소범위(VKOSPI만 복구)로 남겨둔 후속 과제. **R280은 사람 규칙일 뿐 기계 게이트가 없다** — §6 Phase 0-1이 봉쇄.
- 모듈은 파일 분리이지 의존성 경계가 아님: 전역 window 공유 + aio-chat.js가 aio-ui/aio-data 심볼 7개를 로드순서 의존 alias로 역참조(CODE-MAP §3 자인).
- 상태 소유자 6곳(DATA_SNAPSHOT/`_liveData`/`_fredData`/MacroStore/safeLS/DOM) — P553/P559/P576/P607(phantom global)의 공통 뿌리. `aio:marketStateUpdated` 구독 이전 미완.
- 빌드 스텝 부재 = 린트/타입체크 전무. `node --check`+자작 게이트 9종이 대체 중 — 게이트를 계속 손으로 만들어야 하는 비용이 실가격.
- `_esc` 계열 이스케이프 헬퍼 3중 구현(index.html:13247·aio-data.js:5818·aio-ui.js:3167 — 스코프 분리라 충돌은 아니나 XSS 방어 로직의 단일 소스 부재).

### B. 성능·전달 (C)

- 부팅 ~2.1MB gzip 매 방문 재다운로드. 최대 단일 항목 = **telegram-digest.json(raw 1.32MB/gzip 431KB), aio-data.js:1199에서 시간 단위 캐시버스터로 부팅 로드** → §6 Phase 1-1.
- `!important` 512건 증가 추세 — CSS 특이성 경쟁 진행 신호 → §6 Phase 4-2 ratchet.
- defer 전환 후에도 로컬 load ~8.5s(문서 인용) — 추가 개선은 페이로드 다이어트가 유일한 지렛대.

### C. 데이터 파이프라인·운영 (A-)

- git-as-database + Pages-as-CDN: 무료·이력·원자 배포. 데이터 커밋 27%(182/666) 누적 — pack 12MB로 아직 건강, 1~2년 스케일에서만 분리 검토(§7 비권장 참조).
- 명목 cron 30분 vs 실발화 1~4h(GitHub best-effort, P609에서 UI 문구까지 정정) — 워치독 max age 240min과 정합.
- 잔존: 스크리너 881심볼 Yahoo 단일(B1) · 수동 갱신층 = 인간 크론(ISM/AAII/KR 지표, fetch 함수 0건) · 장애 알림 GitHub 이메일 단일(B4).

### D. 알고리즘 정합성 (B-)

- **C2 잔존**: 스크리너 "백테스트 IC" 패널이 검증하는 모델(서버 `backtestFactors`, 4팩터 고정가중 — fetch-data.mjs:703대, grep 재확인)과 실제 랭킹(`_aioComputeFactorRanks`, 7팩터×레짐 가중)이 다름 — 검증된 것처럼 보이는 표면 vs 실검증 범위의 괴리.
- **C3**: computeTradingScore 하네스는 존재하나 표본 부족(`statisticallyMeaningful: false`) — **코드 작업 아님, 데이터 축적 대기**.
- VCP 서버(`_calcVCPServer`)/클라(`_calcVCP`) 병렬 구현 — 파라미터 드리프트 경로만 감시 필요(§6 Phase 3-3).

### E. 품질·테스트 (B)

- 헤드리스 상설은 진전이나 `continue-on-error: true` + deploy `needs` 미편입 = **게이트가 아니라 계기판**. ci.yml:109-117 주석이 승격 조건(skip-list 소진) 명시.
- 이번 실측 899/922로 skip-list 23건의 **정확성은 재현 확인**(전원 여전히 실패, 목록 밖 실패 0). 승격의 선행 과제는 23건 자체의 triage — 실측 출력 기준 대략 3계층: ① 시드 drift류(T324/T325/T684/T685 DATA_SNAPSHOT 수치, T759 캘린더, T829/T830 digest 날짜 — `/data-refresh` 영역), ② 잠재 실결함(T491/T512/T557 로딩 문구 2건, T608 diagnose 안내, T781 font<10px 9건, T834), ③ 테스트 자체 stale 의심(T762가 v50.5 포맷 기대 — v52.18에서 영구 실패 구조) → §6 Phase 2-6.
- 시각 회귀 0건 — "실브라우저 시각 확인 잔여"가 세션마다 반복 기록되는 구조 원인 → §6 Phase 2-3.

### F. 보안 (B-)

- 양호: CDN SRI, DOMPurify, 민감 URL 캐시 금지(sw.js:47), egress 가드(R264), Pages 전환 시 Jekyll dot/underscore 제외 정확 재현(ci.yml:179-183, `_context` 비노출 유지), GitHub Secrets.
- 열림: CSP 부재(인라인 대량이라 meta CSP 실효 제한 — 정적 호스팅 구조 제약, 수용된 리스크) · innerHTML 419건 수동 점검 백로그(DEFERRED-BLOCKS) · **공개 CORS 프록시는 응답 변조 가능한 제3자** — cross-source 검증(R196)이 실질 완화 장치 · 클라 API 키(AES+localStorage)는 XSS 성공 시 유출이라는 본질 한계(정적 호스팅 내 합리적 최선).

### G. 거버넌스·지식 시스템 (A-) — 최대 자산이자 관리 대상

- **지도 drift 실사례(이번 발견)**: CODE-MAP:124·260은 "C1 RSI 미해결"로 표기하나 실제 코드는 v51.91에서 해소(fetch-data.mjs:686). v51.90 스캔 직후 수정분 미반영 — 수동 지도는 A- 거버넌스에서도 며칠 만에 낡는다. 해소 시 참조 문서 동반 갱신 원칙 필요(§6 Phase 0-4).
- CHANGELOG 1.43MB 단일 파일 — 실용 한계. 거버넌스 5대 문서는 compaction 게이트 면제(`governedLargeContextNames`)라 상한 없음 → §6 Phase 4-1.
- INDEX.md 배포 baseline(d6902a1/v51.90)·파일구조(manifest.json 실존 안 함) 등 소규모 drift — 본 인수인계에서 일부 정정됨.

---

## 5. 리스크 매트릭스 (v52.18 잔존분)

| # | 발견 | 축 | 심각도 | 근거 |
|---|---|---|---|---|
| A-1 | `fetchKrDynamicData` 그림자 선언 + orphan 5함수 사문 + R280 기계 게이트 부재 | 아키텍처 | **P1** | index.html:20374 vs aio-data.js:13321, P605 |
| E-1 | skip-list 23건 미해소(시드 drift·잠재 결함·stale 테스트 혼재) — 헤드리스 게이트 승격 차단 요인 | 품질 | P2 | 이번 실측 899/922 재현 |
| B-1 | telegram-digest 431KB gzip 부팅 로드 | 성능 | P3(하향 — 조사 완료, §6 Phase 1 참조) | aio-data.js:1199 — 2026-07-06: 85%가 실사용 다이제스트 브리핑 데이터로 확인, 순수 정리로 해결 불가 |
| E-2 | 시각 회귀 테스트 0건 — "실브라우저 확인 잔여" 반복 | 품질 | P2 | CLAUDE.md 반복 기록 |
| D-1 | C2 백테스트≠라이브 랭킹 모델 | 알고리즘 | P2 | fetch-data.mjs backtestFactors vs _aioComputeFactorRanks |
| G-1 | CODE-MAP "C1 미해결" 표기 등 지도 drift | 거버넌스 | P2(수정 쉬움) | CODE-MAP:124·260 |
| C-1 | 스크리너 881심볼 Yahoo 단일 의존 | 파이프라인 | P2(발생 시 P0) | fetch-data.mjs |
| G-2 | CHANGELOG 1.43MB + 거버넌스 상한 부재 | 거버넌스 | P3 | 실측 |
| B-2 | !important 512 증가 추세 | 성능/CSS | P3 | 실측(325→512) |
| C-2 | 워치독 알림 이메일 단일 | 운영 | P3 | data-watchdog.yml |
| A-2 | 전역 상태 ~3,400 참조(만성) | 아키텍처 | P3(만성) | 실측 |
| F-1 | innerHTML 419건 수동 점검 백로그 | 보안 | P3(기존 등재) | DEFERRED-BLOCKS |
| — | 로컬 loose object 656개/78MB | 하우스키핑 | P3(1명령) | git count-objects |

---

## 6. Sonnet 5 로드맵 (권장 순서 — 각 항목 독립 커밋 단위)

공통 계약: 코드 변경 시 R1(`node scripts/bump-version.mjs <버전>`) · 버그류 R3(P번호) · 검증은 "로컬 8게이트(`node scripts/ci-*.mjs` 중 headless 제외 전부) green + `node scripts/ci-headless-tests.mjs` 회귀 0" — P605~P608의 검증 패턴 그대로. index.html 수정 전 CODE-MAP line 앵커는 반드시 `grep -n` 재확인(28버전 경과).

### Phase 0 — P1 봉쇄 + 하우스키핑 (1세션 분량)

1. **[A-1a] R280 기계 게이트**: `scripts/ci-structural-check.mjs`에 검사 추가(기존 `check(label, cond)` 패턴). 구현 스케치: index.html과 js/aio-core·data·ui·chat·glossary.js에서 `^(async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(` 컬럼0 선언을 추출 → index.html 세트 ∩ 모듈 세트가 공집합이어야 pass(0-2 완료 전까지 `fetchKrDynamicData` 1건 허용목록). IIFE 내부 선언은 컬럼0이 아니므로 자연 제외. 수용 기준: 게이트 green + 고의 중복 주입 시 fail 확인 후 원복.
2. **[A-1b] 그림자 사본 정리**: index.html:20374 `fetchKrDynamicData` 사본 삭제(이미 도달 불능 — 런타임 무변화 저위험) + orphan 5함수 각각 판정: 정의를 살릴 가치(kr-supply 페이지 데이터 공백을 실제로 메우는가)가 있으면 aio-data.js 승자 사본에 **검증 후** 편입, 아니면 삭제. P605 scope note가 "미검증 상태" 경고 — 소생은 각 fetcher의 엔드포인트 실응답 확인 후에만. 신규 P번호 + R280 갱신.
3. **[하우스키핑] `git gc`** (loose 656개/78MB — 1명령, 안전).
4. **[G-1] 문서 drift 정정**: CODE-MAP:124·260 "C1 미해결"→"v51.91 해소(fetch-data.mjs:686)" · CODE-MAP:107 "검증 하네스 없음"→"v52.2 하네스 존재·표본 부족" · INDEX.md 잔여 drift(GATE baseline 수치 등) 일괄. + **재발 방지 한 줄 규칙 검토**: "진단 문서의 '미해결' 표기를 해소하는 커밋은 해당 표기 문서를 같은 커밋에서 갱신한다."

### Phase 1 — 전달 성능

5. ~~**[B-1] telegram-digest 분리**~~ — **2026-07-06 조사 결과 원안 기각(전제 오류로 실행 안 함)**. 원안은 "부팅은 요약본, 별도 '텔레그램 뷰' 방문 시 전체 lazy load"를 가정했으나, 실제 소비 구조를 전수 추적한 결과 그런 lazy-load 가능한 별도 뷰 자체가 없다 — `_aioLoadServerTelegramDigest()`는 부팅 시 1회 실행되고, 그 결과가 (a) `_aioInjectAllTelegramFeeds()`로 홈 포함 다수 페이지의 피드 슬롯에 **즉시** 렌더, (b) `_aioApplyTelegramDigestToScreenerDb()`로 SCREENER_DB 메모에 즉시 병합, (c) `js/aio-chat.js:3850~`에서 LLM 채팅 컨텍스트로 즉시 주입된다 — 전부 부팅 직후 필요. 더 결정적으로: `broadItems`(400건 cap, 파일의 실질 대용량 부분)의 **56%(202/360건)가 `_aioGetTgDigestPosts()`(aio-data.js:9351)가 명시적으로 찾는 "digest-like" 포스트(`━━━━` 구분자 포함 OR 800자 초과)이며, 이 202건이 broadItems 텍스트 총량의 85%(360KB/422KB, 실측)를 차지**한다 — `_aioRenderTgDigestBrief()`가 이 포스트들의 **전체 텍스트**에서 이모지 섹션헤더+불릿을 파싱해 "주간 다이제스트 브리핑" UI를 만드므로, 이 텍스트를 자르면 그 기능이 조용히 깨진다(카드 피드용 헤드라인 120자/본문 100자 추출과는 별개의, 전체 텍스트가 필요한 소비처). 자르기 안전한 "일반"(non-digest-like) 포스트만 남기고 실측해보면 전체 158건/61.9KB뿐이라, 이마저 300자로 강제 절삭해도 절감분은 ~22.5KB(파일 전체 1.3MB의 ~1.7%)에 그친다 — 복잡도·회귀위험 대비 무의미. **결론: 이 파일의 부피는 대부분 wasteful bloat가 아니라 이미 출시된 기능(다이제스트 브리핑)의 실사용 데이터다.** 향후 이 항목을 다시 열 경우 "무엇을 줄일까"가 아니라 "다이제스트 브리핑 기능 자체의 스코프(400건 cap, 채널당 120건 cap 등)를 줄일지"부터 제품 결정으로 물어야 한다(코드 정리가 아닌 기능 축소 결정이므로 사용자 승인 필요) — 순수 엔지니어링 정리로 해결되는 항목이 아님이 확인됨.

### Phase 2 — 게이트 승격 (품질)

6. **[E-1] skip-list 23건 triage**: GATE-BASELINE-2026-07-03 분류법 재사용, 이번 런 출력 기준 3계층으로 — ① 시드 drift류(T324/T325/T684/T685/T759/T829/T830)는 `/data-refresh`로 해소 가능 여부 확인, ② 잠재 실결함(T491/T512/T557 로딩 문구·T608·T781 font<10px 9건·T834 등)은 개별 수정(각각 P번호), ③ stale 테스트 의심(T762 v50.5 포맷 기대 등)은 테스트 자체를 현행 계약으로 갱신. 각 처리 후 skip-list에서 제거, GATE-BASELINE 문서 갱신.
7. **[E-1b] 게이트 편입**: skip-list가 "전 항목 사유 명시" 상태가 되면 ci.yml `headless-tests`의 `continue-on-error` 제거 + deploy `needs: [validate, headless-tests]` 편입. ci.yml:109-117 주석의 자체 조건 준수. flaky 관찰 1주 후 확정.
8. **[E-2] 시각 스모크**: ci-headless-tests.mjs 인프라 재사용 — 22 route 각각 `showPage()` 후 스크린샷을 CI 아티팩트로 업로드(report-only, 비교 없이 육안 확인용부터 시작). "실브라우저 시각 확인 잔여" 반복 항목의 구조적 해소 1보.

### Phase 3 — 알고리즘 정직성

9. **[D-1/C2] 백테스트-라이브 정렬**: 최소범위 우선 — UI에 "백테스트는 4팩터 고정가중 기준(라이브 랭킹은 7팩터 레짐 적응)" 정직 라벨. 팩터 추가 정렬(size/value/quality + NEUTRAL 가중 라벨)은 그 다음 단계로 분리 판단.
10. **[C3] 착수 금지 확인만**: score-backtest-history.json 누적 대기(매 사이클 자동 적재 중). forward-5d n≥30 도달 시 재평가 — 그 전에 가중/경계 재튜닝 금지(P599).
11. **[D-VCP] 파리티 감시**: `ci-data-pipeline-contract-check.mjs`에 서버/클라 VCP 핵심 파라미터(스윙 N, 수축 깊이 범위) 동일성 텍스트 계약 추가 — 구현 통합은 하지 않음(§7).

### Phase 4 — 만성 클래스 (장기, 각각 별도 계획 후)

12. **[G-2] CHANGELOG 연도 분할**(CHANGELOG-2026H1.md 등) + governedLargeContextNames에 상한(ratchet) 정책 — 복리 루프 훼손 없이 비용 절단.
13. **[B-2] !important ratchet**: ci-structural-check에 "현재 512 초과 금지" 카운트 게이트(증가만 차단, 감소는 자유).
14. **[A-2] 전역 상태 장기전**: 신규 코드 marketState 구독 강제(R276 확대 적용) 지속 — 일괄 이전 시도 금지.
15. **[C-1/B1·B4 옵션]** 스크리너 Yahoo 폴백 확장(미검증 스코프 — 07-02에서 의도 제외한 이력 존중, 착수 시 별도 검증 계획 필수) · 워치독 실패 텔레그램 알림(기존 파이프라인 재사용).

### §7 명시적 비권장 (07-02 진단과 동일 결론 유지)

- **프레임워크 도입/index.html 전면 분해** — 회귀 리스크 대비 이득 낮음. CODE-MAP 기반 부분 패치 운영이 실측상 감당 중. 분리는 코드보다 데이터부터(Phase 1-1이 그 1보).
- **SW 신선도 전략(no-store) 변경** — 매매 판단 앱에서 stale shell이 더 큰 리스크. 의도된 트레이드오프.
- **거버넌스 문서 공격적 삭제** — 복리 루프의 자산. 분할·상한(Phase 4-12)이면 충분.
- **git 데이터 커밋 히스토리 재작성/분리** — pack 12MB로 건강. 1~2년 후 재평가.

---

## 8. 부록: 실측 원본 수치 (2026-07-06)

- 줄 수: index.html 32,011 / aio-core 24,169 / aio-data 17,660 / aio-chat 6,886 / aio-tests 6,997 / aio-ui 5,244 / aio-glossary 314 / sw.js 233 / fetch-data.mjs 1,358
- gzip: index.html 618,434B / 모듈5종 1,031,495B / aio-tests 134,433B / telegram-digest 430,844B
- `window.` 참조: core 1,862 / data 711 / chat 280 / ui 207 / index 332 (tests 1,084)
- innerHTML: index 169 / core 104 / data 59 / ui 50 / chat 37 (+tests 6) · getElementById 합계 ~1,300 · `!important` 512
- 함수 선언: index(컬럼0) 293 / core 363 / data 321 / ui 163 / chat 93 · **컬럼0 동명 충돌: `fetchKrDynamicData` 1건뿐(전수 대조)**
- `<script>` 태그 21개(모듈 5 defer + CDN 3 SRI defer + 인라인 ~11블록 + 기타) · `<div>` 3,911
- git: 커밋 666(데이터봇 240/인간 227/세션봇 199), `data: refresh` 182, 최근 30일 412, pack 12.21MiB, loose 656개/78.49MiB, garbage 0
- 문서: CHANGELOG 1,425,140B / BUG-POSTMORTEM 837,346B(P625) / RULES 273,761B(R280) / QA-CHECKLIST 159,158B / KNOWLEDGE-BASE 71,287B / _context 총 2.3MB
- 워크플로: refresh cron `17,47 * * * *`(실발화 1~4h) / watchdog `23 * * * *`(repo 240min + LIVE 360min) / CI validate 11스텝 + headless(report-only) + deploy(retry 1회)
- 헤드리스(이번 세션, v52.18, 외부망 차단): **899 pass / 23 fail(전원 skip-list 기등재) / 예상 밖 회귀 0** — v52.8~v52.18 기록과 정확히 재현 일치. 실패 23건 목록·사유는 이번 런 출력 기준 §4-E 참조
- 버전 동기화 스팟: title(index:10)·badge(index:5244)·APP_VERSION(aio-core:17709)·version.json·sw.js:8 = v52.18 일치
