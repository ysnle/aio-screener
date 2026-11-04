# 용어 사전

용어 사전 is a modal dictionary (`#glossary-modal`, role dialog) of investment terms with category chips. Searching is the command search's 용어 scope (v59.70, D4): `#glossary-search-open` opens it, and a picked term reopens the glossary on that entry. It is an overlay, not a route.

## Sub-features

- `glossary-open` — `openGlossary()` resets the category, draws chips (`전체 N` + groups + `기타`), lists all terms (`.aio-glossary-item`), titles `투자 용어 사전, N개`, focuses `#glossary-search-open`; `openGlossary(term)` lists that term's matches with the first entry open (focus on its summary) and a `전체 용어 보기` button. Entries are single-open `<details>`; an open entry lists `이 개념이 쓰이는 화면` buttons.
- `glossary-category` — `#glossary-cats button[data-action=_aioGlossaryCat]` sets `aria-pressed=true` and narrows the list.
- `glossary-search` — `#glossary-search-open` → command search 용어 scope (glossary terms first, then research notes); Enter on a term calls `openGlossary(term)`. A category chip keeps the shown term; a group with 0 hits falls back to 전체 with a status note.
- `glossary-close` — × (`용어 사전 닫기`) or Escape; focus returns to the opener.

## How to get to it (user POV)

- Sidebar 리서치 › 용어 사전.
- Buttons on the 도움말 page; a term picked in the command search (Ctrl/⌘K); a term mark's `용어 사전에서 보기`.

## Driving it with verify-aio

Preconditions:

- Doctor OK.

- **Open.** Click sidebar `용어 사전`. Modal visible; ≥10 items; focus on `#glossary-search-open`.
- **Category.** Click the second chip; exactly one chip `aria-pressed=true`; fewer items.
- **Search.** Click `#glossary-search-open`, fill `PER`, Enter on the first term row; the open entry's term contains `PER`.
- **Close.** Press Escape; modal hidden.
- **Proof.** `drive glossary` evidence folder.

## Gotchas

- Opening through a registered overlay route can rewrite the hash to `#guide` first; do not assert an unchanged hash.
- A click on the dimmed backdrop also closes it (`src/ui/components/shell-overlays.js`).
