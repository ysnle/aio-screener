---
updated: 2026-06-14
version_context: v50.42 → v50.50 (배포 시점)
purpose: "별도 세션 필요"라고 넘긴 작업의 진짜 정체를 한 곳에 정리. 대부분은 세션과 무관하게 진행 가능했고, 실제 막힌 것은 데이터·시간·운영자 결정 4종뿐임을 명확히 한다.
---

# 미뤄둔 작업 / 진짜 블록 현황 (Deferred & Blocked)

## 0. "별도 세션 필요"의 진실 (2026-06-13 사용자 지적 대응)

사용자: *"별도의 세션이 필요하다고 하는데 지금 여기 세션과 무슨 차이가 있길래 그래? 여기서 진행하면 안 되는 거야?"*

**정직한 답**: 기술적으로 이 세션과 다른 세션은 **차이가 없다** — 같은 코드·도구·권한. "별도 세션"은 대부분 두 가지의 완곡어였다:
1. **세션 컨텍스트 예산** — 매우 긴 세션에서 큰 작업을 컨텍스트 끊김 직전에 시작하면 하다 마는 위험. → 안전한 분할 문제이지 능력 문제 아님. **여기서 단계별 커밋으로 가능.**
2. **라이브 앱 회귀 통제** — 대규모 변경(84곳 마이그레이션·DOM 대이동·게이트 67건)은 단계별 검증 필요. → **여기서 단계별로 하면 됨.**

→ 따라서 §2(진행 가능) 항목은 "별도 세션"이 아니라 **예산이 허락하는 만큼 여기서** 진행한다.

---

## 1. 진짜 블록 (여기서도 불가 — 데이터·시간·운영자 결정)

| # | 항목 | 블록 사유 | 해제 조건 | 비고 |
|---|------|-----------|-----------|------|
| B1 | KR 정적 스냅샷 de-stale (KOSPI inline · kr-home/kr-supply/kr-macro/kr-technical 정적값) | 무료 자동 KR breadth/신용잔고/수급 데이터 소스 없음. 추측 입력 금지(R15/R183). | KR 데이터 소스 확보(유료 API or 수동 입력 파이프라인) | DATA_SNAPSHOT KR 필드 일부만 갱신 가능, breadth류는 불가 |
| B2 | 미확보 시세 필드 (ETH·KOSDAQ·DXY·글로벌지수·5월 CPI) | WebSearch 미확보 시 추측 생성 금지(R15/R183) | `scripts/fetch-data.mjs` SYMBOLS에 추가 후 cron 1회 (DXY/일부는 v50.40에서 추가 → 다음 cron 반영) | 코드는 준비, 데이터 도착 대기 |
| B3 | jensen 인터뷰 84일 아카이브 콘텐츠 | 대체할 신규 분석 자료 없음 | 신규 인터뷰/리서치 자료 통합(/integrate) | `#jensen-interview-stale-days`(index.html:5671)가 경과일 동적 표시 中 — 기능은 정상, 콘텐츠만 stale |
| B4 | WO-7 차트 history 재배선 (IV Rank·F&G 추이·VIX 퍼센타일 실데이터 전환) | `public-data/history.json` 20~60일 누적 필요 (물리적 시간) | 시간 경과 → 코드가 자동 전환 (`_aioHistorySeries`/`_aioVixPercentile` 준비됨) | 생산자(fetch-data.mjs append)·소비자 레이어 완료. 누적만 대기 |
| B5 | WO-10 Claude 키 서버화 (Cloudflare Worker Anthropic 프록시) | 운영자 결정 + Worker secret 배포 필요 | 운영자가 기존 데이터 Worker에 Anthropic 프록시 확장 | `cloudflare-worker-proxy.js` 소스 복원됨(v50.27). 데이터 Worker는 이미 동작 中 |
| B6 | cron 발화 신뢰성 최종 검증 | GitHub Actions 로그를 시간에 걸쳐 관찰해야 확인 | 시간 경과 + Actions run 이력 3회+ green | WO-1(워치독 `data-watchdog.yml`)로 stale 감지 장치는 배포됨 |

> 핵심: B1·B2·B3 = **데이터 없음**, B4·B6 = **시간 필요**, B5 = **운영자 결정**. 코드로 해결되는 게 아니다.

---

## 2. 진행 가능 (여기서/다음에 코드로 해결 — "별도 세션" 아님)

OPUS-HANDOFF WO 백로그 + v50.33/34 페이지 잔여 + v50.42 후속에서 도출. v50.43 plan(`fluttering-stirring-squid.md`)의 클러스터 1~3에 해당.

| 항목 | 출처 | 상태 |
|------|------|------|
| home 결론 3중복 통합 (conclusion-bar + trading verdict + action-item + 정적 설명) | v50.33 잔여 | v50.43 C1 진행 |
| breadth 차트 6행 통합·압축 (카드+현재+히스토리 3중) | v50.33 잔여 (v50.34는 접기 토글만) | v50.43 C1 진행 |
| marketState 광범위 소비자 구독 이전 (채팅 헤더·내러티브·페이지 배너) | v50.42 후속 | v50.43 C2 진행 |
| 중복 재계산 제거 (같은 틱 `_aioRegimeNow`/`getCycleFromMacro`) | v50.42 후속 | v50.43 C2 진행 |
| WO-14 배포 게이트 블록 67건 (signal 31·fxbond 16·themes 12) pass/reference 분류 | OPUS-HANDOFF | v50.43 C3 진행 |
| WO-13 audit 통폐합 (critical-10 5세대 → v50.0 게이트 단일) | OPUS-HANDOFF | v50.43 C3 진행 |
| WO-12 문서 다이어트 (루트 CLAUDE.md 슬림화 + 아카이브) | OPUS-HANDOFF | v50.43 C3 진행 |

### 장기·낮은 우선순위 (진행 가능하나 별도 패스 권장)
- `!important` 325개 CSS 변수 리팩토링 (specificity 정리)
- innerHTML XSS 211건 수동 점검 (대부분 정적 HTML + escHtml 적용 — DOMPurify 게이트로 일부 커버됨)
- index.html 29K줄 페이지 단위 모듈 분리 (CODE-MAP 의존 작업 한계 완화)
- WO-9 script `defer` 적용 (로드 순서 의존성 검증 필요 — core→data→ui→chat)
- WO-11 전면 홈 IA 재설계 (UX 검토 동반 — 초보자 시작 패널은 v50.26 완료, 전면 재조립은 미완)

---

## 3. 다음 세션 작업 목록 (2026-06-14 정리 — v50.50 배포 후)

> v50.42~50 누적 배포 완료 시점 기준. 우선순위 순. 각 항목은 **여기서/다음에 코드로 진행 가능**하며, 진짜 블록(§1)은 별도 표기.

### 우선순위 A — 구조 정합 (코드, 즉시 가능)
| # | 작업 | 근거/위치 | 비고 |
|---|------|-----------|------|
| A1 | **KR stale-days 2-writer 통합** | aio-core.js:2086/2148 `STATIC_CONTENT_LIFECYCLE` "N일 경과" vs index.html:21089 `data-snap-date` "D+N일" — 서로 다른 기준일로 숫자 불일치 위험 | v50.49에서 일반화 시도했으나 **두 경로 통합이 선결**이라 revert. 단일 기준일·단일 포맷터로 합친 뒤 stale 라벨 일반화 |
| A2 | **breadth 차트 통합·압축 (C1B)** | v50.34 접기 토글(`_aioBreadthDetailToggle`)만 적용. 문서엔 추가 통합 언급 있으나 현 코드와 어긋남 | 카드+현재+히스토리 3중 표현 중복 — doc/code 재대조 후 실제 통합 |
| A3 | **marketState 소비자 구독 확산 잔여** | v50.42~44에서 home action·채팅 헤더·4 렌더러 전환 완료. 잔여 내러티브 렌더러/페이지 배너 일부 | `aio:marketStateUpdated` 미구독 소비자 마저 이전 (선순환 완결) |

### 우선순위 B — 운영 정리 (분량 큼, 단계적)
| # | 작업 | 근거 | 비고 |
|---|------|------|------|
| B-WO13 | audit 통폐합 (critical-10 5세대 → v50.0 evidence 게이트 단일) | OPUS-HANDOFF | orphan audit 정리 |
| B-WO14 | 배포 게이트 블록 67건 (signal 31·fxbond 16·themes 12) pass/reference 분류 | OPUS-HANDOFF | 대부분 reference-only 재분류로 해소 예상 |
| B-WO12 | 문서 다이어트 (루트 CLAUDE.md 슬림화 + 아카이브) | OPUS-HANDOFF | 현 루트 CLAUDE.md 비대 — note 아카이브 이전 |

### 우선순위 C — sink 확산 (선택적)
| # | 작업 | 근거 | 비고 |
|---|------|------|------|
| C1 | breadth/sentiment에 `[data-market-analysis-sink]` 확산 | v50.47 잔여 | **주의**: breadth 랠리품질·sentiment 복합판단은 **이미 도메인 렌더러 보유**(aio-ui.js:754 등) → 일반 sink가 덮어쓰면 부적절. 도메인 렌더러 리팩토링 동반해야 안전 |

### 진짜 블록 (§1 재참조 — 코드로 해결 불가)
- B1 KR 정적 데이터 (소스 없음) · B2 미확보 시세 필드 (데이터 도착 대기) · B3 jensen 84일 (신규 자료 필요)
- B4 차트 history 누적 (시간) · B5 Claude 키 서버화 (운영자 결정) · B6 cron 신뢰성 검증 (시간)

### UX 관련 정직 메모 (v50.50 라이브 검증 결론)
에이전트 정적 UX 감사(`PAGE-UX-AUDIT-2026-06-13.md`)의 "빈 껍데기/고장" ★항목 **대부분이 거짓 양성**이었음 — 라이브 직접 점검 결과 macro 스토리라인·온도계(61)·kr-themes(28카드)·kr-macro/kr-technical 모두 정상 렌더, options nav 이미 제거됨, sentiment/breadth verdict 렌더러 보유. **유일한 실증 모순**(home 매매 카드 라벨 vs 결론바)만 v50.50에서 시정. 남은 UX는 버그가 아닌 **주관적 밀도**(긴 페이지=충실 콘텐츠) — 사용자 지목 시 선별 진행. 무차별 "간소화"는 콘텐츠 손실 위험이므로 지양.
