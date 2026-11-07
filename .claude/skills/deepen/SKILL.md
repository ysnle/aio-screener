---
name: deepen
description: Find and carry out deepening opportunities in AIO — modules whose interface is nearly as large as their implementation, decisions spread across many call sites, globals that callers must use in the right order. Use when the user asks to deepen modules, simplify interfaces, reduce globals or call-site knowledge, review a fix for structural depth, or before a bug fix that would add a new global or entry point.
---

## AIO Skill Operating Contract

Follow `.claude/skills/_shared/operating-contract.md`; reuse it if already read. Product decisions stay with `AGENTS.md`; this skill decides where a seam goes, never what the product shows.

## Reference Loading Map

- Vocabulary and method adapted from mattpocock/skills `codebase-design` and `DEEPENING.md` (MIT). Read nothing else to start.
- Hot spots: `git log --oneline -60 -- js src` and `_context/STATE-MACHINES.md` findings (several came from missing owners).
- Placement: `_context/CODE-MAP.md` for the range you read; `src/` modules over growth in `js/` (decomposition ratchet).

## Vocabulary (use these words exactly)

- **Module**: anything with an interface and an implementation (a function, a `src/` file, a `window` global group).
- **Interface**: everything a caller must know — signature, invariants, call order, error and empty shapes, globals it must set or read. In AIO, every `window._aio*` a caller touches is interface.
- **Depth**: behaviour a caller gets per unit of interface it learns. Deep = small interface, a lot behind it.
- **Seam**: where the interface lives and behaviour can change without editing callers (`fetchLiveQuotes` stayed the seam when `src/data/quote-demand.js` took the requests behind it).
- **Adapter**: what fills a seam (the provider fetch in `js/aio-data.js`, the offline stand-in in a gate).
- **Leverage** (callers) and **locality** (one place to change, fix and test).

## Survey

1. Scope by change frequency: start from files that recent commits keep touching, or the area the user named.
2. Look for friction: a decision checked at many call sites; globals that must be set, read and cleared in order; a fix that added entry points; tests that cut a function out of a classic script or pin source text because nothing has an interface to test.
3. **Deletion test** for each suspect: delete the module in your head. Complexity that reappears across N callers means it earns its keep; complexity that just moves means it is a pass-through.
4. Classify each dependency: in-process (merge and test directly), local stand-in, owned remote (port + in-memory adapter), true external (inject; offline adapter in the gate). **One adapter is a hypothetical seam, two is a real one**; do not add a port without the second adapter.
5. Report candidates ranked Strong / Worth exploring / Speculative: files, problem, the module after, what is deleted, which findings it closes. Ask before carrying one out unless the user already chose.

## Carry out

- Keep the existing seam name when callers are many; move behaviour behind it. No full rewrite (AGENTS): one module, callers moved one by one.
- **Replace, don't layer**: tests go to the new interface; delete gates that tested the shallow pieces, and source pins that only existed because no interface did.
- Close with: the deleted globals and entry points, the regression cases at the interface (each fails on the old code), and doc updates where a doc described the old shape.
