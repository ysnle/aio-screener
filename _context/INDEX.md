---
verified_by: agent
last_verified: 2026-06-04
confidence: high
auto_refresh: true
target_version: v50.4
---

# _context Index

This folder is the active project knowledge base for AIO. It should describe the current GitHub-deployed structure first, then local Claude worktree exceptions only when they affect routing.

## Active Documents

| Document | Role | Refresh trigger |
|---|---|---|
| `CLAUDE.md` | Project structure, Git-tracked skills, hook caveats, context loop | Structure or workflow changes |
| `RULES.md` | Master rules for versioning, edits, QA, safety, deployment | New recurring failure or process rule |
| `BUG-POSTMORTEM.md` | Bug history and P-number recurrence tracking | Bug fix |
| `QA-CHECKLIST.md` | Manual/automated QA checklist | QA finding or new risky surface |
| `KNOWLEDGE-BASE.md` | Research, market frameworks, integration memory | `/integrate` or insight capture |
| `CODE-MAP.md` | Current `index.html` and `js/*.js` line map | Large edit or module movement |
| `WORKTREE-AUDIT.md` | GitHub/live/worktree routing and unpublished work inventory | Worktree merge, deploy, or audit |
| `DEEP-QA-2026-05-05.md` | Three-area deep QA: UI/rendering, API pipeline, page-level logic | Deep QA run or live/local parity change |
| `OPERATIONS-AUDIT-2026-05-06.md` | Operational sustainability audit: version/cache/SW/API health | Runtime or deployment hardening |
| `DATA-PIPELINE-AUDIT-2026-05-06.md` | End-to-end data pipeline map: source, transport, store, analysis, render | API/source, analysis, or render pipeline changes |
| `ARCHITECTURE-AUDIT-2026-05-10.md` | v49.3 architecture-audit reinforcement summary | Data/function/risk layer changes |
| `DATA-FRESHNESS-AUDIT-2026-05-10.md` | v49.4 freshness policy / auto-refresh reinforcement summary | Freshness policy/source/stale criteria changes |
| `GATE-BASELINE-2026-06-04.md` | v50.4 evidence deployment gate + unit-test 실측 기준선 (env-dependent vs code-internal 분리) | 게이트/테스트 재측정, 운영 baseline 추가 시 |
| `CHAT-DATA-AUDIT-2026-06-04.md` | v50.8 AI 채팅 데이터 출처 전수 감사 baseline (fetch 파이프라인·시장맥락 주입·재사용·dead code 실측) | 채팅 데이터 경로/컨텍스트 변경 시 |
| `FRONTEND-UX-AUDIT-2026-06-05.md` | v50.12 21페이지 라이브 프론트엔드/UX audit (클러터·중복 / 초보자 직관성·위계). 측정+audit 근거, P0/P1/P2 백로그 | UI/UX 시정·페이지 구조 변경 시 |
| `OPUS-HANDOFF-STRUCTURAL-AUDIT-2026-06-10.md` | v50.23 구조 전수 감사 (백엔드/프론트/데이터/UX/자동운영 실측) + Opus 작업 백로그 WO-1~14. cron 미발화·ATH 레짐 버그(aio-data.js:12303)·stale 내러티브 구조 등 P0 5건 | WO 항목 완료/구조 변경 시 |
| `INDEX.md` | This index | Any `_context` document add/remove |

> 14개 `_context/*.md` 활성. 추가로 루트에 `EVIDENCE-DEBT.md`(v50.x evidence-first 부채 대장)가 있으며 `_context` 밖이지만 evidence 게이트의 SSOT다.

## Current Deployment Baseline

- **GitHub baseline (source of truth)**: `origin/main` at `638de8f` (`v50.4`, 2026-06-03)
- **Claude worktree**: `claude/hungry-euler-8d3b20` — origin/main(v50.4) 머지 동기 완료(2026-06-04). v48.13 → v50.4.
- **Codex integration source**: `.codex/worktrees/540d/AIO` (v48.13→v50.4 evidence-first 작업 원본)
- **Live site**: `https://ysnle.github.io/aio-screener/`
- **게이트 실측 baseline**: `GATE-BASELINE-2026-06-04.md` 참조. 헤드리스 측정 결과 단위테스트 673/692 pass(19 fail), 배포 게이트 `fail`(deployable=false, evidence 1737 pass / 1992 warn / 201 block, unclassified·needs_evidence 0). block 다수는 환경 의존(라이브 데이터 부재); 코드 내재 신호는 text-surface block 45 + trading logic proxy. **운영(키+네트워크) baseline 재측정은 미완**.
- **Primary source of truth**: GitHub `origin/main` plus live asset parity, not stale local worktrees.

## Current File Structure

```text
AIO/
├── index.html
├── version.json
├── manifest.json
├── sw.js
├── js/
│   ├── aio-core.js
│   ├── aio-data.js
│   ├── aio-ui.js
│   ├── aio-chat.js
│   ├── aio-tests.js
│   └── aio-glossary.js
├── CHANGELOG.md
├── CLAUDE.md
├── api_setup_guide.html
├── cloudflare-worker-proxy.js
├── _context/
└── .claude/
    └── skills/
```

## Backlink Map

- `RULES.md` links recurring failures to enforceable rules.
- `BUG-POSTMORTEM.md` records bug causes and promotes repeated patterns into rules.
- `QA-CHECKLIST.md` turns rules and bugs into runnable checks.
- `CODE-MAP.md` prevents partial patches from targeting stale line ranges.
- `WORKTREE-AUDIT.md` prevents confusing unpublished Claude worktree changes with deployed GitHub state.
- `DEEP-QA-2026-05-05.md` records the latest local-vs-live deep QA matrix.
- `OPERATIONS-AUDIT-2026-05-06.md` records runtime/cache/API self-operation checks for deployed operations.
- `DATA-PIPELINE-AUDIT-2026-05-06.md` records source-to-render data lineage and release QA commands.
- `ARCHITECTURE-AUDIT-2026-05-10.md` / `DATA-FRESHNESS-AUDIT-2026-05-10.md` record the v49.3/v49.4 reinforcement summaries that the v50.x evidence layer builds on.

## Maintenance Rule

When a new `_context` document is added or removed, update this file and `_context/CLAUDE.md` in the same change.

## Workflow Compaction

- Current active gates: R219 semantic review and R220 workflow compaction.
- Run `node scripts/ci-semantic-review-check.mjs` when audit/readiness/page/AI/data/trading gates change.
- Run `node scripts/ci-workflow-compaction-check.mjs` when `_context`, `CLAUDE.md`, QA, postmortem, or skill guidance changes.
- Treat `BUG-POSTMORTEM.md`, `RULES.md`, and `QA-CHECKLIST.md` as archives plus active gates. Do not expand them without checking whether older guidance can be removed, merged, compressed, or moved into a reference.
- Root `.agents/skills/*/SKILL.md` files are compaction candidates when they exceed 300 lines or 15KB; prefer concise SKILL.md routing plus `references/` and scripts.
