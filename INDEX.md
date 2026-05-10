---
verified_by: codex
last_verified: 2026-05-09
confidence: high
auto_refresh: true
target_version: v49.1
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
| `INDEX.md` | This index | Any `_context` document add/remove |

## Current Deployment Baseline

- **Last observed live version**: v48.79 (browser QA, 2026-05-05)
- **Local integration branch version**: v49.1
- **Claude integration source**: `.claude/worktrees/brave-curie-5c8b22` (`v49.1`, integrated 2026-05-09)
- **GitHub baseline**: local tracking `origin/main` is `4f165f0` (`v48.80`); remote refresh was attempted on 2026-05-07 but blocked by local worktree permission/sandbox limits
- **Live site**: `https://ysnle.github.io/aio-screener/`
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

## Maintenance Rule

When a new `_context` document is added or removed, update this file and `_context/CLAUDE.md` in the same change.
