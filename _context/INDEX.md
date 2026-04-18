---
verified_by: agent
last_verified: 2026-04-18
confidence: high
auto_refresh: true
target_version: v48.14
---

# _context/ 지식 베이스 인덱스

> **목적**: _context/ 폴더 내 모든 문서의 역할, 상태, 연결 관계를 한눈에 파악.
> **갱신 주기**: `/knowledge-lint` 실행 시 자동 갱신 (L6 단계).
> **마지막 갱신**: 2026-04-18 (v48.14) — 월가 기관 수준 아키텍처 전면 보강 + 테마 DB 확장 + P126~P131 + 16개 신규 인프라.

---

## 핵심 문서 (매 작업 전 필독)

| 문서 | 역할 | 갱신일 | 신뢰도 |
|------|------|--------|--------|
| [RULES.md](RULES.md) | 마스터 룰 R1~R31 — 모든 작업의 최상위 규칙 | 2026-04-18 | high |
| [BUG-POSTMORTEM.md](BUG-POSTMORTEM.md) | 버그 사후 분석 P1~P131 — 예방 규칙(P) 원천 | 2026-04-18 | high |
| [QA-CHECKLIST.md](QA-CHECKLIST.md) | 실행 가능한 QA 체크리스트 v3.3 — 브라우저 검증 포함 | 2026-04-18 | high |
| [CLAUDE.md](CLAUDE.md) | _context/ 컨텍스트 — 파일 구조 / Hook / 문서 역할 | 2026-04-18 | high |
| [KNOWLEDGE-BASE.md](KNOWLEDGE-BASE.md) | 기술 인사이트 축적 — AI인프라 패러다임, SW Shock 포함 | 2026-04-11 | high |
| [CODE-MAP.md](CODE-MAP.md) | **index.html ~44,400줄 line 범위 맵 — 부분 읽기 가이드** | 2026-04-18 | high |

## 세션 인수인계 문서

| 문서 | 역할 | 갱신일 |
|------|------|--------|
| [NEXT-SESSION-v48.14.md](NEXT-SESSION-v48.14.md) | v48.14 → v48.15 세션 이어받기 노트 (P2 후속 + 장기 로드맵) | 2026-04-18 |
| [INDEX.md](INDEX.md) | 이 파일 — 지식 베이스 자동 인덱스 | 2026-04-18 |

## archive-reports/ (44+건, 아카이브 전용)

과거 버전별 리포트·레퍼런스·감사 문서. 참조 전용, 활성 워크플로우에서 제외.

**카테고리 요약:**
- **감사/점검 (v27~v34.4)**: AUDIT_INDEX, AUDIT_QUICK_REFERENCE, AUDIT_REPORT_v27, CRITICAL_FIXES_CHECKLIST, COMPLETE_IMPLEMENTATION_VERIFICATION_LIST, UX-AUDIT-v34.4
- **QA 분석 (v30.13)**: QA-CHECKLIST-v2-archive, QA-FAILURE-ANALYSIS-v30.13d, BROWSER-QA-REPORT-v30.13, BROWSER-QA-REPORT-v30.13-deploy
- **세션 분석**: CHAT_WORK_ANALYSIS, REPEAT-REQUEST-ANALYSIS
- **파이프라인 설계**: QUOTE_PIPELINE, NEWS_FILTERING, TRANSLATION_PIPELINE, CORS_PROXY, AIO_데이터_파이프라인_설계서
- **보안**: XSS_DEFENSE, API_KEY_ENCRYPTION
- **성능**: PERFORMANCE_OPTIMIZATION, MEMORY_LEAK_FIX, TIMER_COLLISION
- **접근성**: WCAG_ACCESSIBILITY
- **레퍼런스 (통합 원천)**: AIO_콘텐츠_업그레이드, AIO_매크로_시그널, AIO_UI_디자인, AIO_시스템프롬프트_초안

과거 리포트가 필요할 때만 `_context/archive-reports/` 에서 직접 참조.

---

## 문서 간 연결 관계 (Backlink Map)

```
RULES.md (R1~R26)
  ├── BUG-POSTMORTEM.md → 예방 규칙(P)이 R로 승격
  ├── QA-CHECKLIST.md → 각 R에 대응하는 검증 항목
  ├── KNOWLEDGE-BASE.md → 기술 인사이트가 새 규칙의 근거
  ├── CODE-MAP.md → 규칙 위반 위치를 line 번호로 역추적
  └── working-rules.md → 운영 규칙 보충

BUG-POSTMORTEM.md
  ├── violated_rule: R{N} → 어떤 규칙이 위반되었는지 역추적
  ├── RULES.md → P번호 → R번호 매핑
  ├── CODE-MAP.md → 버그 발생 line 범위 참조
  └── KNOWLEDGE-BASE.md → 반복 패턴이 인사이트로 승격

CODE-MAP.md (NEW, v45.5)
  ├── index.html → 부분 읽기 라인 범위
  ├── BUG-POSTMORTEM.md → 버그 발생 함수/라인 위치
  └── 상태 라이프사이클 버그 패턴 요약

KNOWLEDGE-BASE.md
  ├── BUG-POSTMORTEM.md → 버그에서 추출한 기술 교훈
  ├── RULES.md → 인사이트가 규칙으로 승격 가능
  └── 외부 → 대화 중 발견한 API/브라우저/라이브러리 동작
```

---

## Karpathy Second Brain 패턴 (v46.2 강화)

_context/ = AI 관리 위키. 3계층 복리 루프로 동작:

```
사용자 원본 투입 → AI 작업 → 산출물 → 위키 환류 → 다음 작업이 더 정확
```

### 복리 환류 경로 (반드시 준수)

| 작업 유형 | 산출물 | 환류 대상 |
|-----------|--------|----------|
| 버그 수정 | P번호 패턴 | BUG-POSTMORTEM → 3회 반복 시 RULES 승격 |
| /integrate | 투자 프레임워크 | CHAT_CONTEXTS + SCREENER_DB + TECH_KW/MACRO_KW |
| /qa 발견 | 검증 항목 | QA-CHECKLIST 추가 |
| /data-refresh | 데이터 갱신 | DATA_SNAPSHOT + 하드코딩 텍스트 정합성 |
| 기술 인사이트 | API/브라우저 동작 | KNOWLEDGE-BASE (R26) |
| /knowledge-lint | 불일치/누락 | INDEX.md 갱신 + RULES 강화 |
| 코드 리팩토링 | line 변경 ±500+ | CODE-MAP 재스캔 |

### 에러 복리 방지 (Karpathy 교훈)

> "When outputs get filed back, errors compound too." — @HFloyd

잘못된 판단이 위키에 환류되면 다음 판단도 오염된다:
- **방지책 1**: `/knowledge-lint` 주기적 실행 (주 1회+)
- **방지책 2**: 코드 확인 없이 추측 판단 금지 (P68 한국 네이버 API 오판 교훈)
- **방지책 3**: `verified_by: agent` vs `verified_by: human` 구분 → 사용자 검증 전 낮은 신뢰도

### 구조 요약

- **루트**: 활성 문서 9건
- **archive-reports/**: stale 문서 아카이브 (참조 전용)
- **백링크**: `violated_rule: R{N}`, `예방 규칙 P{N}` 역참조
- **Frontmatter**: `verified_by` / `last_verified` / `confidence` / `target_version`
- **린팅**: `/knowledge-lint` 7단계 (L1~L7), **건강 점검 주기: 주 1회+**

새 문서 추가 시 이 INDEX.md에 행 추가 + 백링크 맵 업데이트 (R24).
