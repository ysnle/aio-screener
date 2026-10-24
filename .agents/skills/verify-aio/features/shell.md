# 공통 셸

The shell is what every screen shares: the topbar 도움말 that opens the product guide, the sidebar dark/light switch that is remembered across visits, and route deep links that open the right screen with its hub tab selected.

## Sub-features

- `shell-help` — `#topbar-help-btn` opens `page-guide` (사용 설명서) with screen cards `#guide-screen-cards` and a search `#guide-search-input` → `#guide-search-result`.
- `shell-theme` — `.sidebar #sidebar-theme-btn` toggles `body.dark-theme`; `#sidebar-theme-label` names the next action (`라이트 모드로 전환` / `다크 모드로 전환`); `localStorage['aio_theme']` restores it on reload.
- `shell-deeplink` — `index.html#<route>` opens that route; the hub tab for it is the active one.

## How to get to it (user POV)

- Topbar `도움말`; sidebar bottom theme button; any shared `#route` link.

## Driving it with verify-aio

Preconditions:

- Doctor OK.

- **Help.** Click `#topbar-help-btn`. `page-guide` active; screen cards present.
- **Guide search.** Fill `시장 폭`, Enter; `#guide-search-result` mentions `시장 폭`.
- **Theme.** Click the sidebar theme button; `body.dark-theme` flips and the label names the next action.
- **Persist.** Reload; the theme is the same; flip it back.
- **Deep link.** Open `index.html#fxbond`; `page-fxbond` active and the `금리와 환율` hub tab is the current one.
- **Proof.** `drive shell` evidence folder.

## Gotchas

- The drive restores the original theme, but its browser context is discarded anyway.
- The legacy topbar `#theme-toggle` is hidden; drive the sidebar button users see.
