# 용어 사전

용어 사전 is a modal dictionary (`#glossary-modal`, role dialog) of investment terms with category chips and a live search over term, alias and definition. It is an overlay, not a route.

## Sub-features

- `glossary-open` — resets search and category, draws chips (`전체 N` + groups + `기타`), lists all terms (`.aio-glossary-item`), titles `투자 용어 사전 · N개`, focuses `#glossary-search`.
- `glossary-category` — `#glossary-cats button[data-action=_aioGlossaryCat]` sets `aria-pressed=true` and narrows the list.
- `glossary-search` — `#glossary-search` filters within the selected group; a group with 0 hits falls back to 전체 with a status note.
- `glossary-close` — × (`용어 사전 닫기`) or Escape; focus returns to the opener.

## How to get to it (user POV)

- Sidebar 리서치 › 용어 사전.
- Buttons on the 도움말 page; Ctrl+K when the page has no visible search box.

## Driving it with verify-aio

Preconditions:

- Doctor OK.

- **Open.** Click sidebar `용어 사전`. Modal visible; ≥10 items; focus in `#glossary-search`.
- **Category.** Click the second chip; exactly one chip `aria-pressed=true`; fewer items.
- **Search.** Fill `PER`; body contains `PER`.
- **Close.** Press Escape; modal hidden.
- **Proof.** `drive glossary` evidence folder.

## Gotchas

- Opening through a registered overlay route can rewrite the hash to `#guide` first; do not assert an unchanged hash.
- There is no backdrop-click close.
