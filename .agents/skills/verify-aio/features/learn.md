# 리서치 라이브러리

리서치 라이브러리 is the reading shelf: 개념·분석 (notes, concepts, lessons, columns), 산업 지도 (industry maps) and 대가 보유 종목 (manager holdings). The driver reads these titles from `RESEARCH_PAGES` (src/ui/knowledge/research-shell.js), so a rename does not need a driver edit. Every tab shares one research shell with a page title, a library-wide search, the 서가 shelf, and a TOC → document → 연결 layout.

## Sub-features

- `learn-shell` — `.rl-shell[data-research-page=<route>] h1.rl-title` names the tab; shelf `details.rl-shelf > summary` = `서가` + `N편 · K개 컬렉션 · T개 주제 [· R편 읽음]` on every tab (intentional).
- `learn-shelf` — inside `.rl-shelf`: collection chips `.rl-shelf-chip` (`전체` + one per collection with a tone swatch, count in a `span`, `aria-pressed`), sort segments `.rl-shelf-seg` (주제/제목/안 읽은 글), spines `button.rl-spine` packed into `.rl-shelf-tier` rows over `.rl-shelf-plank` (first 3 tiers, then `N편 더 보기`; arrow keys move focus; `.is-read` + ribbon = opened in this browser; hover/focus shows `.rl-shelf-tip`), and the book card `.rl-book` (cover + `h3`, `읽기`, `AI에게 이 글 묻기`, close `×`) (P1674).
- `learn-search` — `input[aria-label="리서치 라이브러리 통합 검색"]` (≥2 chars, 120 ms debounce) → up to 12 `.rl-result[data-research-result]`.
- `learn-open` — TOC group heads are `[data-principles-action=group]` (expand/collapse); a document item `[data-principles-action=frame]` (`.rl-nav-sub`) opens its document in `.rl-main` and becomes `aria-pressed=true`/`.is-active`; chapters show `h2.rl-doc-title`.
- `learn-masters` — manager items `.rl-nav-item[data-masters-action]`, ticker/CUSIP lookup, filing view tabs.

## How to get to it (user POV)

- Sidebar 리서치 › 리서치 라이브러리.
- Hub tabs 개념·분석 / 산업 지도 / 대가 보유 종목.
- Deep links `#principles`, `#atlas`, `#masters`. The product guide is topbar `도움말` (see shell.md).

## Driving it with verify-aio

Preconditions:

- Doctor OK.

- **Open.** Click sidebar `리서치 라이브러리`. `page-principles`; tabs exactly the three RESEARCH_PAGES titles.
- **Title + shelf.** `h1.rl-title` = the principles title (`개념·분석`); shelf summary matches `/컬렉션/`.
- **Search.** Fill `ROIC`; ≥1 result.
- **Open a document.** Esc, click the first non-active `frame` TOC item; `.rl-main` changes and that item is active.
- **Shelf.** Open the shelf, click chip `칼럼`: spine count equals the chip's count. Click the first spine: the card `h3` matches the spine label. Click `읽기`: the URL gains `chapter=`.
- **Atlas.** Tab `산업 지도` → title `산업 지도`.
- **Masters.** Tab `대가 보유 종목` → title `대가 보유 종목`; ≥1 manager TOC item.
- **Proof.** `drive learn` evidence folder.

## Gotchas

- The same shelf on all three tabs is by design; prove the tab by its `h1.rl-title`, not page text.
- The shelf opens on the open document's collection (or the tab's first one) unless a chip was picked this session; drive the chip explicitly.
- `AI에게 이 글 묻기` and the selection button `선택한 문장 AI에게 묻기` only fill `#ai-panel-inp`; never press send in verification (shared $20 AI budget).
- A failed index load renders a retry item `다시 불러오기` in the TOC; it must not count as content.
