# AIO Screener — _context/ 프로젝트 컨텍스트

> 루트 `CLAUDE.md` = 절대 규칙 + 작업 규칙. 이 파일 = 파일 구조 + Hook + Skills + 복리 루프.

- **현재 버전**: v50.1

## v50.1 hotfix note
- Trading/decision-use outputs now have a dedicated evidence gate. Use `AIO.getTradingDecisionInputEvidence()` for SPX/SPY/VIX/10Y/HYG/DXY/WTI input currentness and `AIO.getTradingDecisionLogicAudit()` for stale fallback/proxy logic review before trusting market score, regime, execution window, Weinstein stage, ticker entry checklist, or options IV Rank.

## v50.0 hotfix note

- Added the evidence-first 21-page contract foundation. `AIO_PAGE_CONTRACTS` is now the single runtime contract for all route pages, compatibility maps are derived from it, `EvidenceStore` classifies every live/snapshot/chart/table/form/numeric/narrative item with an evidenceId, and `AIO.runEvidenceDeploymentGate()` replaces representative critical-10 checks as the deployment-facing gate. AI chat receives EvidenceStore context and post-answer numeric/date evidence reference auditing.

## v49.112 hotfix note

- Added a full critical-10 content evidence matrix. Every live cell, snapshot cell, snap date, chart-like element, static numeric text, and market narrative across the 10 US pages is classified as pass/warn/block/needs_evidence. External references can be passed in to compare actual observed market values against visible page prices, so checks are not limited to representative samples or internal self-audits.

## v49.111 hotfix note

- Added critical-10 market situation deep auditing. The app now inventories live cells, snapshot cells, snap dates, chart-like elements, static numeric text, and market narrative text across the 10 US pages, then compares visible values and narratives against the current quote/truth/cross-source reference snapshot and derived market regime. `refreshCritical10MarketSituationAudit()` can fetch, cross-check, rebind, and re-audit in one pass.

## v49.110 hotfix note

- Added critical-10 market surface auditing. Comprehensive page freshness and ops readiness now inspect the actual visible market cells across the comprehensive 5 plus market-analysis 5 pages, warning on missing live sources, missing DOM bindings, truth-blocked/reference-only values, stale refresh tasks, and stale snap dates before any page can report OK.

## v49.109 hotfix note

- Added multi-source quote cross-validation. Quote values are recorded by source family and compared across Yahoo/Naver/Stooq/Finnhub/FMP/CoinGecko/FX where available. Independent live-source mismatches block trading-use data, delayed/EOD mismatches warn, and AI chat preflight receives `cross=<status>/<count>` for detected stock tickers.

## v49.108 hotfix note

- Added DataTruthGate for trading-safety data validation. Live quote data must pass source allow-list, timestamp/age, sanity range, and price-vs-previous-close percent-change coherence checks before it can remain decision-usable. DOM sinks receive `data-truth-*` attrs, truth-blocked values are forced to `reference-only`, and AI chat preflight receives truth status/issues.

## v49.107 hotfix note

- Critical-10 freshness is now the operating unit for the US market pages: comprehensive 5 plus market-analysis 5. Manual refresh, page-enter refresh, and AI freshness preflight use that symbol universe, then explicitly apply and verify every `data-live-price/chg/pct/field` DOM sink so a successful fetch is not treated as a successful visible update until the screen binding audit passes.

## v49.106 hotfix note

- AI chat now injects an answer coverage/current-data contract. It expands response modes across decision, comparison, valuation, earnings, technical, portfolio-risk, macro, catalyst, data-validation, and beginner explanation intents, and forbids current numeric claims from Claude/model memory unless an injected prompt data block supplies them.

## v49.105 hotfix note

- AI stock-answer freshness now treats `forceFresh` as strict: bypass `_chatTickerCache`, bypass `_liveData` immediate cache returns, bypass `ensureFreshDataForUse` minGap throttle, and re-attempt per-ticker quote lookup before prompt assembly.

## _context/ 문서 (13개 Git-tracked 활성)

| 문서 | 역할 | 갱신 트리거 |
|------|------|-----------|
| CLAUDE.md | 이 파일: 구조, hooks, skills, 복리 루프 | 구조 또는 워크플로 변경 시 |
| RULES.md | 마스터 룰 R1~R29 | 새 규칙/패턴 발견 시 |
| BUG-POSTMORTEM.md | 버그 사후 분석 P1~P293 (R25 역참조) | 버그 수정 후 |
| QA-CHECKLIST.md | QA 14티어 체크리스트 v3.3 | /qa 발견 시 |
| KNOWLEDGE-BASE.md | 기술 인사이트 축적 (R26) | 인사이트 발견 시 |
| CODE-MAP.md | index.html + js 모듈 line 범위 맵 | 리팩토링 ±500줄 |
| INDEX.md | 지식 베이스 인덱스 + 백링크 (R24) | /knowledge-lint L6 |
| WORKTREE-AUDIT.md | GitHub/live/worktree 라우팅 + 미배포 작업 인벤토리 | 워크트리 병합/배포/감사 |
| DEEP-QA-2026-05-05.md | UI/API/페이지 로직 심층 QA 결과 | 심층 QA 또는 live/local parity 변경 |
| OPERATIONS-AUDIT-2026-05-06.md | 운영 지속성/자체 진단/캐시 회전 점검 | 런타임 또는 배포 운영성 변경 |
| DATA-PIPELINE-AUDIT-2026-05-06.md | API/소스부터 렌더 sink까지 데이터 파이프라인 레이어 맵 | API/분석/렌더 파이프라인 변경 |
| ARCHITECTURE-AUDIT-2026-05-10.md | v49.3 전수감사 보고서 기반 아키텍처 보강 요약 | 데이터/함수/리스크 레이어 변경 |
| DATA-FRESHNESS-AUDIT-2026-05-10.md | v49.4 데이터 최신성/자동 갱신 보강 요약 | freshness policy/source/stale 기준 변경 |

## 파일 구조

```
AIO/
├── index.html · version.json · manifest.json · sw.js
├── js/
│   ├── aio-core.js · aio-data.js · aio-ui.js · aio-chat.js · aio-tests.js · aio-glossary.js
├── CHANGELOG.md · CLAUDE.md · api_setup_guide.html · cloudflare-worker-proxy.js
├── _context/           ← Git-tracked 위키 (위 11개 문서)
├── .claude/
│   └── skills/         ← Git-tracked 3개: bug-fix · data-refresh · integrate
```

> 참고: 일부 Claude 로컬 워크트리는 `.claude/commands`, `.claude/hooks`, 추가 skills/agents를 별도 운영 파일로 보유할 수 있다. GitHub 배포 기준 점검은 Git-tracked 파일을 우선한다.

## Commands ↔ Skills (R27: 새 스킬 시 wrapper 동시 생성)

| `/command` | skill | eval |
|------------|-------|------|
| `/deploy` | 인라인 | — |
| `/qa` | post-edit-qa | T1~T14, Q1~Q7 |
| `/bug-fix` | bug-fix | B1~B6 |
| `/integrate` | integrate | E1~E9 |
| `/data-refresh` | data-refresh | D1~D8 |
| `/session-save` | 인라인 | S1~S6 |
| `/knowledge-lint` | knowledge-lint | L1~L7 |
| `/version-up` | 인라인 | — |
| `/autoresearch` | autoresearch | — |

## Hook 시스템

GitHub-tracked v49.1 통합본에는 hooks가 포함되어 있지 않다. Claude 로컬 운영 워크트리에 hooks가 있을 때만 아래 레이어를 적용한다.

| Hook | 타이밍 | 역할 |
|------|--------|------|
| `protect-files.sh` | PreToolUse | 백업/아카이브 덮어쓰기 차단 |
| `block-dangerous.sh` | PreToolUse | rm -rf, force push 차단 |
| `validate-edit.sh` | PostToolUse | div 열림/닫힘 균형 검증 |
| `check-antipatterns.sh` | PostToolUse | alert()/confirm(), d.pct\|\|0, 극소 폰트 감지 |
| `check-version-sync.sh` | PostToolUse | R1 버전 6곳 동기화 자동 검증 (index.html·APP_VERSION·version.json·CLAUDE.md) |
| `auto-commit-on-stop.sh` | Stop | 세션 종료 시 미커밋 변경사항 WIP 자동 저장 |

## 복리 루프 (Karpathy Second Brain)

```
원본 투입 → 작업 → 산출물 → _context/ 환류 → 다음 작업 정확도↑
```

| 작업 | 환류 대상 |
|------|----------|
| 버그 수정 | POSTMORTEM → 3회 반복 시 RULES 승격 |
| /integrate | CHAT_CONTEXTS + SCREENER_DB + KW + KNOWLEDGE-BASE(E9) |
| /qa | QA-CHECKLIST 항목 추가 |
| /data-refresh | DATA_SNAPSHOT + 텍스트 정합성 |
| 인사이트 | KNOWLEDGE-BASE (R26) |
| /knowledge-lint | INDEX.md + violated_rule 빈도 |

**에러 복리 방지**: 추측 판단 금지(P68) + /knowledge-lint 주 1회+ + verified_by agent/human 구분
