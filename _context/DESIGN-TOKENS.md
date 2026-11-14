# Design tokens — role vocabulary (v59.88, revised v60.06)

Canonical definitions live in the `index.html` `:root` block (inline, because the first paint waits only for the HTML
and the one preloaded stylesheet — index.html F01 note). This file explains the vocabulary; it does not define values.
Adopted from the principles of [meta/astryx](https://github.com/meta/astryx) (MIT): token names describe a role,
consumers use the role, and a ratchet stops drift. Astryx's palette (blue accent, cool greys, categorical colours),
extra type steps and React/StyleX code were deliberately **not** adopted — the ivory ink/paper palette, the three colour
families (judgement green/amber/red, direction `--dir-up`/`--dir-down`) and the four type sizes are owner decisions.

## Type — reading and label (v60.06)
Four sizes: 12 · 14 · 18 · 28. A sentence a reader reads uses `--fs-reading` (14px) with `--lh-reading` (1.65); labels,
dates, chips and table figures stay 12px. A rule that sizes a reading class names `var(--fs-reading)`; classes that
inherit their size, and class-less `p`/`li` inside `.page`, are covered by one rule in `ui-states.css` §7. Weights stop
at 600: hierarchy comes from size and colour (stylesheets only — CSS injected from `research-shell.js` and
`analysis-frames.js` still carries 700). Text of 16px or less has no negative letter-spacing. On coarse pointers below 1024px
`--fs-reading` is 16px (astryx mobile-typography DR1: the reading base is at least the input minimum); labels stay 12px.

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
(topbar, screener filter bar: md; segments: sm). Chips are 28px, small chips and the as-of chip 24px with 8px inline
padding (no token). Shared `soft-ui.css` primitives sit on a 4px grid (card inline padding 24px, 16px on phones).
Touch targets follow the pointer, not the width: `(pointer: coarse)` layouts keep `--size-target-touch` 44px.

## Focus, motion
One ring: `--focus-outline-width` 2px, `--focus-outline-color` (ink) — a state ring, never an elevation shadow. The
offset is `--focus-outline-offset` 3px by default, 2px on buttons, inputs and nav items, 1px inside a segmented track. Motion: `--ease-standard` `cubic-bezier(0.24, 1, 0.4, 1)` for entrances and moves,
`--ease-exit` for exits (defined, not yet used); durations stay 150–200ms (owner 2026-11-04) except the navigation
drawer (250ms). `--ease-out` aliases `--ease-standard`.

## Status
A status never rides on colour alone: the warning banner (`.sx-banner`) carries a glyph in `--data-amber`.
Quiet in-flow surfaces for persistent notes; strong fills only for compact or urgent labels.

## Table density
From 1024px the screener table row is 40px with a hairline between rows; touch layouts keep taller rows (AIO's own
value; astryx gives no row height). A selected row carries a 1px `--text-secondary` outline as well as its tint, so the
selection reads without colour.

## Ratchet
`scripts/ci-design-token-ratchet-check.mjs` freezes, per stylesheet, literal px radii, font sizes outside
12·14·18·28 and `!important` flags (`_context/design-token-baseline.json`). Counts may only shrink. The ratchet is
AIO's own rule; astryx's theme-tokens INV7 is about generated projections, not consumer literals.

## Colour roles (astryx grammar, ivory values)
One definition in the `index.html` `:root, body` block; `body.dark-theme` restates only the roles whose Radix step
differs (body, card, overlay, ink, status text, direction). Declaring on `body` too matters: a `var()` inside a custom
property resolves where it is declared, so the roles re-resolve against the dark Radix scale on body.
Consumers name the role (v60.07, `node scripts/codemod-color-roles.mjs`): 3,590 uses of old aliases were rewritten and 39 alias definitions removed. The aliases still defined (`--text-primary/-secondary/-muted/-dim`, `--border`, `--border-subtle`, `--bg-surface`, `--data-green/amber/red`, `--dir-up/down`, `--accent`, `--data-cyan/purple`, `--green`, `--red`) are read by name in scripts or tests; new code uses the role.
| Role | Light → dark | Old names (aliases) |
|---|---|---|
| `--color-background-body` / `-surface` / `-card` / `-emphasized` | gold-2 / gold-2 / gold-1 / gold-3 → gold-1 / gold-2 / gold-2 / gold-3 | `--bg-base`, `--bg-surface`, `--bg-card`, `--bg-input`, `--bg-elevated` |
| `--color-overlay`, `--color-overlay-hover`, `--color-overlay-pressed` | scrim, hover wash, press wash | `--bg-overlay`, `--bg-hover` |
| `--color-text-primary` / `-secondary` | gold-12 / gold-11 | `--text-primary`, `--text-secondary`, `--text-muted`, `--text-dim` |
| `--color-border` / `-emphasized` / `-muted` | gold-7 / 8 / 6 | `--border`, `--border-strong`, `--border-subtle` |
| `--color-accent` / `-muted` | ink, no brand hue | `--accent*` |
| `--color-text-success/warning/error` | ¾ step 11 + ¼ step 12 → step 11 | `--data-green/amber/red` |
| `--color-success/warning/error-muted`, `--color-success`, `--color-error` | step 3 fills, step 9 solids | `--data-*-soft`, `--sx-good/warn/down-bg` |
| `--color-data-up/down` (+ `-emphasized`, `-muted`) | red / blue (Korean convention) | `--dir-up/down*` |
Retired hues (`--data-cyan/magenta/purple/blue`, `--cyan`, …) alias the ink. Before v59.88 the same values were written in
three places (`:root`, a v51.43 `:root !important` copy, and a 77-line `body.dark-theme` restatement) plus a light
override in soft-ui.css; a full-page pixel comparison of eight routes in both themes showed no colour change.

## Component states (astryx user-states, Button, Table, Toast)
- Press: an enabled button, unselected segment or unselected hub tab paints `--color-overlay-pressed` over its resting
  fill (a background-image wash, so the fill keeps its identity); buttons also settle to `scale(0.98)` (AIO's own
  addition, not from astryx). The selected
  segment keeps its surface. Disabled buttons sit at opacity 0.5 and never take the wash.
- Tables: header labels semibold in `--color-text-secondary`; row hover is a flat `--color-overlay-hover` wash.
- Hover: every `:hover` rule in `src/ui/styles` sits inside `@media (hover: hover)` (v60.06), so a tap leaves no stuck
  highlight. In the inline `index.html` layer the same holds except six rules whose selector list mixes hover and
  non-hover selectors.
- Toast: inverted surface with container corners (it is a transient overlay, not a chip).
- Every stylesheet's 4/8/12/999px corners now name their role (580 declarations); 13px text moved to 12px (66).

## !important retirement (v59.89)
Flags were removed only where the browser showed they change nothing: each flag was switched off on its own on every
route (1440/820/390, light and dark, four screener states) and kept if any computed value moved. Two kinds of flags
stay on purpose: flags on properties that JS changes after load (display, visibility, position, overflow, opacity,
z-index, transform, height), and pairs where two rules each look redundant only because the other one is there.
Screener column minimums live in the column registry (`src/ui/pages/screener/model.js`), not in CSS overrides.
Result: 1,202 → 709 (index.html 217 of them).

## Cascade layers (v59.90)
`@layer legacy` holds the pre-soft-ui shell CSS: the first `<style>` block in index.html, `legacy-*.css` and
`shell-static.css` (imported with `layer(legacy)` in responsive.css). Every other stylesheet is unlayered, so it beats
the legacy layer by layer order, whatever the selector specificity. New rules never need `!important` to beat legacy CSS.
An important flag inside a lower layer would beat every unlayered important flag, so the legacy layer holds no flags.
The flags it had sit, unlayered, in `legacy-important-shell.css` (from index.html, imported first) and
`legacy-important-files.css` (from the legacy files, imported right after them). That keeps the order they had. These two
files are the debt list: delete a declaration, or move the rule that needs it into its screen stylesheet.
The AI panel `<style>` block at the end of index.html stays unlayered.

## Next
- `legacy-important-*.css` went from 224 to 115 flags in v59.91. Rules whose selector names a class or id that no HTML, JS or
  data file writes were deleted, and repeated `[style*=font-size]` rules were merged. What is left falls into three groups:
  utility guards that must out-rank inline styles written by JS (`[hidden]`, `.sr-only`, `*[hidden]` load-more wraps,
  dev-mode visibility, print, reduced motion); rules that still decide what the screen looks like (nav item radius and
  hover, `.q-chip` padding, `[style*="font-size:12px"]`); and rules for elements that only appear after an interaction
  (AI panel `.acp-*`, tooltips, glossary, KR theme cards). Remove the last group only with a probe that opens those states.
- A probe that only renders routes misses hover and post-click inline styles. Before removing a flag, check hover/pressed
  pairs and any JS that writes `.style` on the element.
- Most of soft-ui's remaining flags beat those files or inline styles set by JS. Retire them file by file.

## Breakpoints (v60.06)
600 · 743/744 · 1023/1024 · 1100 · 1279/1280, plus 1439/1440 and 1599/1600 for wide layouts. 743/744 is the phone and
tablet boundary (iPad mini portrait is 744). 380, 480, 520 and 900 remain as single-component exceptions. JavaScript reads
1023 and 1279 (`responsive-shell.js`) and 1023 (`screener/inspector.js`).

## Behaviours (v60.05–v60.06)
Keyboard, focus and dismissal contracts live in `src/ui/behaviors/`, not in each widget:
- `layers.js` — one stack per document. Escape closes the top layer; a press outside closes the layers it is outside
  of (touch decides on the tap's click, scrollbars are ignored); Tab stays in the nearest modal layer; a modal makes the
  page inert and lifts that flag from a layer opened above it. Dialogs, sheets, the drawer, the AI overlay, the command
  search, popovers and tooltips register here (`window._aioModalTrap`, `window._aioOpenLayer`, `popover.js`).
- `roving.js` — one tab stop with arrow keys, Home and End for tab lists, radio groups, toolbars and any `role=group`
  made only of `aria-pressed` buttons. Tabs that open a screen use manual activation.
- `listbox.js` — a search field over options (`aria-activedescendant` after an arrow key). The command search keeps
  its own implementation.
- `announce.js` — two live regions created at install; `window._aioAnnounce(text)`.
- `toast.js` — the bottom message: 2.5–9 s by length, waits under the pointer, failures announced assertively.
- `components/page-outline.js` — section jumps under the title of long screens (`OUTLINE_ROUTES`), current section marked.
roving, announce, toast and the outline load in one chunk after boot (`src/app/after-boot.js`).
Not covered yet: focus return when the opener was `<body>` (Safari), scroll lock behind modals, tooltip entry delay.

## Unreferenced rules
`node scripts/prune-unreferenced-css.mjs` lists style rules whose required class or id is written nowhere in the markup or
scripts (whole, or as the prefix of a name built at runtime); `--write` removes them. v60.06 removed 460 rules (51 KB).

