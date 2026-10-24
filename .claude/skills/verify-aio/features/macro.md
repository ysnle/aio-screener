# 거시와 금리

거시와 금리 places the economy on a growth/inflation quadrant with the next major release and how macro moves stocks, and shows the Treasury curve, spreads, real rates and the dollar/won/yen on the rates tab.

## Sub-features

- `macro-next` — `#macro-next-release` (`다음 주요 발표: …`; `… 계산 중` while loading).
- `macro-regime` — quadrant `#macro-regime`, six impact cards `#macro-axes`, chain `#macro-chain` (oil→inflation→Fed→rates→valuation).
- `macro-board` — official indicators with 24-month trends `#macro-board`; oil/gold `#macro-commodities`.
- `rates-yields` — five tenors `#rates-yields .rates-yield` (2/5/10/20/30y) with `%` and `bp`, basis `#rates-basis`.
- `rates-curve` — `#rates-curve`, `#rates-spreads`, levels `#rates-levels`, axes `#rates-axes`.
- `rates-fx` — `#rates-fx-grid` (USD index, USDKRW, USDJPY, 10y); `그 밖의 통화` shows `시세 대기` locally.

## How to get to it (user POV)

- Sidebar 시장 › 거시와 금리.
- Hub tabs 거시 경제 / 금리와 환율.
- Deep links `#macro`, `#fxbond`.

## Driving it with verify-aio

Preconditions:

- Doctor OK.

- **Open.** Click sidebar `거시와 금리`. `page-macro` active; tabs exactly `거시 경제,금리와 환율`.
- **Next release.** `#macro-next-release` leaves `계산 중` and matches `/다음 주요 발표/`.
- **Regime.** `#macro-regime` and `#macro-axes` have children; `#macro-board` has children.
- **Rates.** Tab `금리와 환율` → `page-fxbond`; 5 `#rates-yields .rates-yield`, text has `%` and `bp`; `#rates-basis` matches `/종가|고시/`.
- **Curve.** `#rates-curve` and `#rates-spreads` real text.
- **FX.** ≥4 `#rates-fx-grid` cards.
- **Proof.** `drive macro` evidence folder.

## Gotchas

- Treasury yields are the official daily fixing, a day behind the market close; the basis line says so.
- There is no `#macro-rates` element; rates live on `#page-fxbond` as `#rates-*`.
