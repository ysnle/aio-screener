# 공통 셸

The shell is what every screen shares: the command search (Ctrl/⌘K or the topbar 검색: one box for stocks, screens, terms and the guide), the topbar 도움말 that opens the product guide, the sidebar dark/light switch that is remembered across visits, and route deep links that open the right screen with its hub tab selected.

## Sub-features

- `shell-help` — `#topbar-help-btn` opens `page-guide` (사용 설명서) and its three folded chapters; its `#guide-search-open` opens the command search's 도움말 scope, and a picked row focuses that paragraph.
- `shell-command-search` — v59.70 (D4): Ctrl/⌘K (inside inputs too) or `#topbar-search-btn` opens `<dialog id="aio-command-search">`: `#aio-command-input` (combobox), scope buttons `[data-cmd-scope]` (전체·종목·화면·용어·도움말), `#aio-command-results` (listbox, rows `[role=option][data-kind=stock|typed|screen|term|research|guide]`), `#aio-command-status`. ↑/↓ move, Enter opens (not while IME composes), Esc closes and returns focus. `/` focuses the screener's `#scr-text-search` on 스크리너, else opens the command search. A typed symbol the listing does not have is refused in the status line (`…목록에 없는 기호입니다`), never guessed. Phones (≤700 px) get a full-screen sheet.
- `shell-theme` — `.sidebar #sidebar-theme-btn` toggles `body.dark-theme`; `#sidebar-theme-label` names the next action (`라이트 모드로 전환` / `다크 모드로 전환`); `localStorage['aio_theme']` restores it on reload.
- `shell-deeplink` — `index.html#<route>` opens that route; the hub tab for it is the active one.
- Not driven yet (2026-11-02 source audit): `?` or the sidebar `단축키 보기 (?)` opens `#kbd-shortcuts-modal`; keys 1-9 switch screens, R refreshes, Esc closes help → glossary → AI in that order (`src/ui/navigation/screen-shortcuts.js`, table `SHELL_KEY_BINDINGS`). Below 1024 px the bottom bar `#aio-tabbar` (오늘·시장·스크리너·종목·더보기) is a second way in; 더보기 opens the drawer, whose backdrop `메뉴 닫기` and Esc close it (`src/ui/components/responsive-shell.js`). With no saved theme the theme follows `prefers-color-scheme`.

## How to get to it (user POV)

- Topbar `검색` (magnifier only on phones) or Ctrl/⌘K; topbar `도움말`; sidebar bottom theme button; any shared `#route` link.

## Driving it with verify-aio

Preconditions:

- Doctor OK.

- **Help.** Click `#topbar-help-btn`. `page-guide` active; three folded help chapters present (the old screen cards are retired).
- **Guide search.** Click `#guide-search-open`, fill `시장 폭`, wait for a `data-kind=guide` row, Enter; focus lands on a guide paragraph containing `시장 폭`.
- **Ctrl+K → NVDA → 종목 개요.** Ctrl+K, type `NVDA`, Enter on the first row; `page-ticker` active and `_currentTickerId` = `NVDA`.
- **시장 폭 → 화면.** Ctrl+K, scope `화면`, fill `시장 폭`, Enter; `page-breadth` active.
- **하이일드 → 용어.** Ctrl+K, scope `용어`, fill `하이일드`, Enter; the glossary opens on an entry containing `하이일드`; Esc closes it.
- **Theme.** Click the sidebar theme button; `body.dark-theme` flips and the label names the next action.
- **Persist.** Reload; the theme is the same; flip it back.
- **Deep link.** Open `index.html#fxbond`; `page-fxbond` active and the `금리와 환율` hub tab is the current one.
- **Proof.** `drive shell` evidence folder.

## Gotchas

- The drive restores the original theme, but its browser context is discarded anyway.
- The legacy topbar `#theme-toggle` is hidden; drive the sidebar button users see.
