# AIO Screener ??_context/ ?„ë¡œ?íŠ¸ ì»¨í…?¤íŠ¸

> ë£¨íŠ¸ `CLAUDE.md` = ?ˆë? ê·œì¹™ + ?‘ì—… ê·œì¹™. ???Œì¼ = ?Œì¼ êµ¬ì¡° + Hook + Skills + ë³µë¦¬ ë£¨í”„.

- **?„ì¬ ë²„ì „**: v50.99
- **?„ì²´ ë²„ì „ ?´ë ¥ ??`CHANGELOG.md`** (?ì„¸ ë³€ê²??´ë ¥???¨ì¼ ì¶œì²˜). ???Œì¼?€ êµ¬ì¡°Â·HookÂ·SkillsÂ·ë³µë¦¬ ë£¨í”„ë§?? ì??˜ë©°, ë²„ì „ë³?ë³€ê²??¸íŠ¸?????´ìƒ ì¤‘ë³µ ë³´ê??˜ì? ?ŠëŠ”??(WO-12 ë¬¸ì„œ ?¤ì´?´íŠ¸ ???´ì „ `## vXX note` ?„ì ë¶„ì? CHANGELOG.md?????ì„¸??ë³´ì¡´??.

## _context/ ë¬¸ì„œ (17ê°?Git-tracked ?œì„±)

| ë¬¸ì„œ | ??•  | ê°±ì‹  ?¸ë¦¬ê±?|
|------|------|-----------|
| CLAUDE.md | ???Œì¼: êµ¬ì¡°, hooks, skills, ë³µë¦¬ ë£¨í”„ | êµ¬ì¡° ?ëŠ” ?Œí¬?Œë¡œ ë³€ê²???|
| WORKFLOW-GOVERNANCE.md | Agent preflight, postmortem-to-gate, skill/self-operation closure contract | Workflow, skill, or CI gate change |
| RULES.md | ë§ˆìŠ¤??ë£?R1~R217 | ??ê·œì¹™/?¨í„´ ë°œê²¬ ??|
| BUG-POSTMORTEM.md | ë²„ê·¸ ?¬í›„ ë¶„ì„ P1~P509 (R25 ??°¸ì¡? | ë²„ê·¸ ?˜ì • ??|
| QA-CHECKLIST.md | QA 14?°ì–´ ì²´í¬ë¦¬ìŠ¤??v3.7 | /qa ë°œê²¬ ??|
| KNOWLEDGE-BASE.md | ê¸°ìˆ  ?¸ì‚¬?´íŠ¸ ì¶•ì  (R26) | ?¸ì‚¬?´íŠ¸ ë°œê²¬ ??|
| CODE-MAP.md | index.html + js ëª¨ë“ˆ line ë²”ìœ„ ë§?| ë¦¬íŒ©? ë§ Â±500ì¤?|
| INDEX.md | ì§€??ë² ì´???¸ë±??+ ë°±ë§??(R24) | /knowledge-lint L6 |
| WORKTREE-AUDIT.md | GitHub/live/worktree ?¼ìš°??+ ë¯¸ë°°???‘ì—… ?¸ë²¤? ë¦¬ | ?Œí¬?¸ë¦¬ ë³‘í•©/ë°°í¬/ê°ì‚¬ |
| DEEP-QA-2026-05-05.md | UI/API/?˜ì´ì§€ ë¡œì§ ?¬ì¸µ QA ê²°ê³¼ | ?¬ì¸µ QA ?ëŠ” live/local parity ë³€ê²?|
| OPERATIONS-AUDIT-2026-05-06.md | ?´ì˜ ì§€?ì„±/?ì²´ ì§„ë‹¨/ìºì‹œ ?Œì „ ?ê? | ?°í????ëŠ” ë°°í¬ ?´ì˜??ë³€ê²?|
| DATA-PIPELINE-AUDIT-2026-05-06.md | API/?ŒìŠ¤ë¶€???Œë” sinkê¹Œì? ?°ì´???Œì´?„ë¼???ˆì´??ë§?| API/ë¶„ì„/?Œë” ?Œì´?„ë¼??ë³€ê²?|
| ARCHITECTURE-AUDIT-2026-05-10.md | v49.3 ?„ìˆ˜ê°ì‚¬ ë³´ê³ ??ê¸°ë°˜ ?„í‚¤?ì²˜ ë³´ê°• ?”ì•½ | ?°ì´???¨ìˆ˜/ë¦¬ìŠ¤???ˆì´??ë³€ê²?|
| DATA-FRESHNESS-AUDIT-2026-05-10.md | v49.4 ?°ì´??ìµœì‹ ???ë™ ê°±ì‹  ë³´ê°• ?”ì•½ | freshness policy/source/stale ê¸°ì? ë³€ê²?|
| GATE-BASELINE-2026-06-04.md | v50.4 evidence ê²Œì´???¨ìœ„?ŒìŠ¤???¤ì¸¡ ê¸°ì???| ê²Œì´???ŒìŠ¤???¬ì¸¡????|
| CHAT-DATA-AUDIT-2026-06-04.md | v50.8 AI ì±„íŒ… ?°ì´??ì¶œì²˜ ?„ìˆ˜ ê°ì‚¬ baseline | ì±„íŒ… ?°ì´??ê²½ë¡œ/ì»¨í…?¤íŠ¸ ë³€ê²???|
| FRONTEND-UX-AUDIT-2026-06-05.md | v50.12 21?˜ì´ì§€ ?¼ì´ë¸??„ë¡ ?¸ì—”??UX audit (?´ëŸ¬?°Â·ì¤‘ë³?ì§ê??±Â·ìœ„ê³? + P0/P1/P2 ë°±ë¡œê·?| UI/UX ?œì •Â·?˜ì´ì§€ êµ¬ì¡° ë³€ê²???|
| OPUS-HANDOFF-STRUCTURAL-AUDIT-2026-06-10.md | v50.23 êµ¬ì¡° ?„ìˆ˜ ê°ì‚¬ ?¤ì¸¡ + Opus ?‘ì—… ë°±ë¡œê·?WO-1~14 (cron ë¯¸ë°œ?”Â·ATH ?ˆì§ ë²„ê·¸Â·stale ?´ëŸ¬?°ë¸Œ êµ¬ì¡° ??P0 5ê±? | WO ??ª© ?„ë£Œ/êµ¬ì¡° ë³€ê²???|
| DEFERRED-BLOCKS.md | ë¯¸ë¤„???‘ì—… / ì§„ì§œ ë¸”ë¡ ?„í™© (?°ì´?°Â·ì‹œê°„Â·ìš´?ì ê²°ì •) + ?¤ìŒ ?¸ì…˜ ?‘ì—… ëª©ë¡ | ë¸”ë¡ ?´ì œ/?‘ì—… ì°©ìˆ˜ ??|

## ?Œì¼ êµ¬ì¡°

```
AIO/
?œâ??€ index.html Â· version.json Â· manifest.json Â· sw.js
?œâ??€ js/
??  ?œâ??€ aio-core.js Â· aio-data.js Â· aio-ui.js Â· aio-chat.js Â· aio-tests.js Â· aio-glossary.js
?œâ??€ CHANGELOG.md Â· CLAUDE.md Â· api_setup_guide.html Â· cloudflare-worker-proxy.js
?œâ??€ _context/           ??Git-tracked ?„í‚¤ (??ë¬¸ì„œ ??ì°¸ì¡°)
?œâ??€ .claude/
??  ?”â??€ skills/         ??Git-tracked 3ê°? bug-fix Â· data-refresh Â· integrate
```

> ì°¸ê³ : ?¼ë? Claude ë¡œì»¬ ?Œí¬?¸ë¦¬??`.claude/commands`, `.claude/hooks`, ì¶”ê? skills/agentsë¥?ë³„ë„ ?´ì˜ ?Œì¼ë¡?ë³´ìœ ?????ˆë‹¤. GitHub ë°°í¬ ê¸°ì? ?ê??€ Git-tracked ?Œì¼???°ì„ ?œë‹¤.

## Commands ??Skills (R27: ???¤í‚¬ ??wrapper ?™ì‹œ ?ì„±)

| `/command` | skill | eval |
|------------|-------|------|
| `/deploy` | ?¸ë¼??| ??|
| `/qa` | post-edit-qa | T1~T14, Q1~Q7 |
| `/bug-fix` | bug-fix | B1~B6 |
| `/integrate` | integrate | E1~E9 |
| `/data-refresh` | data-refresh | D1~D8 |
| `/session-save` | ?¸ë¼??| S1~S6 |
| `/knowledge-lint` | knowledge-lint | L1~L7 |
| `/version-up` | ?¸ë¼??| ??|
| `/autoresearch` | autoresearch | ??|

## Hook ?œìŠ¤??
GitHub-tracked v49.1 ?µí•©ë³¸ì—??hooksê°€ ?¬í•¨?˜ì–´ ?ˆì? ?Šë‹¤. Claude ë¡œì»¬ ?´ì˜ ?Œí¬?¸ë¦¬??hooksê°€ ?ˆì„ ?Œë§Œ ?„ë˜ ?ˆì´?´ë? ?ìš©?œë‹¤.

| Hook | ?€?´ë° | ??•  |
|------|--------|------|
| `protect-files.sh` | PreToolUse | ë°±ì—…/?„ì¹´?´ë¸Œ ??–´?°ê¸° ì°¨ë‹¨ |
| `block-dangerous.sh` | PreToolUse | rm -rf, force push ì°¨ë‹¨ |
| `validate-edit.sh` | PostToolUse | div ?´ë¦¼/?«í˜ ê· í˜• ê²€ì¦?|
| `check-antipatterns.sh` | PostToolUse | alert()/confirm(), d.pct\|\|0, ê·¹ì†Œ ?°íŠ¸ ê°ì? |
| `check-version-sync.sh` | PostToolUse | R1 ë²„ì „ 6ê³??™ê¸°???ë™ ê²€ì¦?(index.htmlÂ·APP_VERSIONÂ·version.jsonÂ·CLAUDE.md) |
| `auto-commit-on-stop.sh` | Stop | ?¸ì…˜ ì¢…ë£Œ ??ë¯¸ì»¤ë°?ë³€ê²½ì‚¬??WIP ?ë™ ?€??|

## ë³µë¦¬ ë£¨í”„ (Karpathy Second Brain)

```
?ë³¸ ?¬ì… ???‘ì—… ???°ì¶œë¬???_context/ ?˜ë¥˜ ???¤ìŒ ?‘ì—… ?•í™•?„â†‘
```

| ?‘ì—… | ?˜ë¥˜ ?€??|
|------|----------|
| ë²„ê·¸ ?˜ì • | POSTMORTEM ??3??ë°˜ë³µ ??RULES ?¹ê²© |
| /integrate | CHAT_CONTEXTS + SCREENER_DB + KW + KNOWLEDGE-BASE(E9) |
| /qa | QA-CHECKLIST ??ª© ì¶”ê? |
| /data-refresh | DATA_SNAPSHOT + ?ìŠ¤???•í•©??|
| ?¸ì‚¬?´íŠ¸ | KNOWLEDGE-BASE (R26) |
| /knowledge-lint | INDEX.md + violated_rule ë¹ˆë„ |

**?ëŸ¬ ë³µë¦¬ ë°©ì?**: ì¶”ì¸¡ ?ë‹¨ ê¸ˆì?(P68) + /knowledge-lint ì£?1?? + verified_by agent/human êµ¬ë¶„
