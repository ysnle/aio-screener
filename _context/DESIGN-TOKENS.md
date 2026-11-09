# Design tokens — role vocabulary (v59.88)

Canonical definitions live in the `index.html` `:root` block (inline, because the first paint waits only for the HTML
and the one preloaded stylesheet — index.html F01 note). This file explains the vocabulary; it does not define values.
Adopted from the principles of [meta/astryx](https://github.com/meta/astryx) (MIT): token names describe a role,
consumers use the role, and a ratchet stops drift. Astryx's palette (blue accent, cool greys, categorical colours),
extra type steps and React/StyleX code were deliberately **not** adopted — the ivory ink/paper palette, the three colour
families (judgement green/amber/red, direction `--dir-up`/`--dir-down`) and the four type sizes are owner decisions.

## Shape — radius follows role
| Token | Value | Role |
|---|---|---|
| `--radius-inner` | 4px | table cell, inline tag, code |
| `--radius-element` | 8px | button, input, select, segmented control, table row tint |
| `--radius-container` | 12px | card, panel, banner, sheet, dialog |
| `--radius-full` | 999px | chip, status pill, track, round icon button |

Nested corners are concentric: inner = outer − gap (a segment inside an 8px track with 2px padding is
`calc(var(--radius-element) - 2px)`). `--radius-sm/md/lg/xl/2xl/pill` and `--radius` are aliases kept for old rules.

## Control rhythm
`--size-element-sm` 28 · `--size-element-md` 32 · `--size-element-lg` 36. Controls in one row share one height
(topbar, screener filter bar: md; segments and chips: sm). Touch layouts (≤1023px) keep `--size-target-touch` 44px.

## Focus, motion
One ring: `--focus-outline-width` 2px, `--focus-outline-color` (ink), `--focus-outline-offset` 3px — a state ring,
never an elevation shadow. Motion: `--ease-standard` `cubic-bezier(0.24, 1, 0.4, 1)` for entrances and moves,
`--ease-exit` for exits; durations stay 150–200ms (owner 2026-11-04). `--ease-out` aliases `--ease-standard`.

## Status
A status never rides on colour alone: the warning banner (`.sx-banner`) carries a glyph in `--data-amber`.
Quiet in-flow surfaces for persistent notes; strong fills only for compact or urgent labels.

## Table density
From 1024px the screener table row is 40px with a hairline between rows; touch layouts keep taller rows.

## Ratchet
`scripts/ci-design-token-ratchet-check.mjs` freezes, per stylesheet, literal px radii, font sizes outside
12·14·18·28 and `!important` flags (`_context/design-token-baseline.json`). Counts may only shrink.

## Next (not yet done)
- Colour roles in the astryx grammar (`--color-background-*`, `--color-text-*`, status strong/muted/text/on-) need the
  three colour definition sites (`:root`, the v51.43 `:root !important` block, `body.dark-theme`) merged into one first.
- Retire the ivory-hairline layer that `soft-ui.css` repaints with `!important`, screen by screen.
