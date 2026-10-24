# 포트폴리오

포트폴리오 lets the user record holdings that stay only in this browser (plain JSON, or AES-encrypted after a PIN), see weights and P&L, edit or delete them, and export or import a backup. Unrecognized tickers are refused.

## Sub-features

- `pf-entry` — `종목 추가` (`data-action=_aioTogglePortfolioEntry`) or `첫 종목 추가` opens `#pf-entry-section.is-open`.
- `pf-add` — ticker/qty/cost (+ target, memo, cost currency) → `추가 / 업데이트`; toast `<T> 포지션 추가 완료, 브라우저에 저장됨`; row in `#pf-holdings-table-section`.
- `pf-reject` — unknown ticker toast `"<T>" 검증되지 않은 티커라 저장하지 않았습니다…`; nothing stored.
- `pf-persist` — `localStorage['aio_portfolio_data']` = `[{ticker,qty,cost,target,memo,costCurrency,addedAt,updatedAt}]`; with a PIN unlocked the value starts `aio_enc::`.
- `pf-delete` — row button `[data-action=_aioRemovePosition][data-arg=<T>]` (label `삭제`, aria-label `<T> 삭제`; the row also has `차트` and `수정`) → `#aio-confirm-modal` (`#aio-confirm-title` = `<T> 포지션 삭제`) → `#aio-confirm-ok`; 전체 삭제 (`clearAllPositions`) also confirms.
- `pf-backup` — 내보내기 / 가져오기 (`_aioTriggerPortfolioImport`); PIN 설정/변경 (`setupPortfolioPin`).
- `pf-empty` — `포트폴리오가 비어 있습니다` with `첫 종목 추가`.

## How to get to it (user POV)

- Sidebar 내 투자 › 포트폴리오.
- Deep link `#portfolio`.

## Driving it with verify-aio

Preconditions:

- Doctor OK; fresh browser context (empty storage, the driver default).

- **Open.** Click sidebar `포트폴리오`. Empty state shown.
- **Form.** Click `종목 추가`; `#pf-add-ticker` visible.
- **Reject.** `ZZZZQ` ×1 @10 → `검증되지 않은 티커` toast; storage has no `ZZZZQ`.
- **Add.** `MSFT` ×3 @400 → toast `MSFT 포지션 추가 완료, 브라우저에 저장됨`; row shows `MSFT`.
- **Stored.** `aio_portfolio_data` parses to a row `{ticker:'MSFT',qty:3,cost:400}`.
- **Reload.** Reload, reopen: `MSFT` still listed.
- **Delete.** Click the row's `삭제` (`data-arg=MSFT`) → confirm → row gone, storage without `MSFT`.
- **Proof.** `drive portfolio` evidence folder.

## Gotchas

- The form is `display:none` until opened; `fill` times out otherwise.
- The native table (src/ui/pages/portfolio.js) owns the rows; the legacy `<T> 포지션 삭제` button in js/aio-workspace.js is not rendered.
- Toasts have no id/role and vanish after ~2.4 s; match their text right after the click.
- The drive's context is discarded, so nothing leaks into the user's real browser. Export/import and PIN are not driven (file dialogs, PIN prompt).
