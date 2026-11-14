# Design Review Checklist

Use for any change a user can see. Each item comes from an owner decision or a confirmed past defect; check it on the changed screen, or name it as not applicable in the QA report.

## Reader and story

- [ ] A beginner can say what the section means in one sentence after reading it; jargon has a plain gloss or a glossary link.
- [ ] Each section is one visual, a short reading of 3 to 5 lines (about 130 to 230 Korean characters) and folded details. Never text only or chart only.
- [ ] The page reads as one logic flow, with a bridge sentence from each section to the next. How-to prose is cut; analysis and connection text stay.
- [ ] The text says what to check and under which condition, never a buy, sell, size, stop or target instruction.

## Copy that should exist

Walk each new or changed string down these in order; stop at the first that fires and cut the clause (cut the element when nothing is left). Read the string beside its label, value and button, never alone. Report as `file:line`, the current string, the rewrite or `cut`, and the rung.

- [ ] It answers something the reader would have wondered about unprompted; it does not plant a question.
- [ ] It says something the label, field or value beside it does not already say (a bare number keeps its unit).
- [ ] It describes a behaviour, not a failure that was ruled out: no caption about a fixed bug, no defence of a design decision, no "may look wrong but is not".
- [ ] What survives is a consequence at the moment of choosing, a scope fact the reader cannot see, what an empty state means and what to do next, or a unit. A string needed only in a rare state lives in that state.

## Truth on screen

- [ ] Every number shows its as-of date or session ("10/9 미국 정규장 종가 기준"); missing inputs say 미수신 or 보류 instead of a placeholder value.
- [ ] Provider names and URLs stay off the main view; they live in the hover title and the folded 데이터 출처 section.
- [ ] A score or grade without validated predictive power is labeled as a description, not a forecast.
- [ ] The Korean and US sessions are not mixed in one sentence without naming each session.

## Visual and interaction

- [ ] No emoji or emoticons; word cues only (`ci-control-char-check`).
- [ ] Ivory and dark themes both use tokens; text contrast meets WCAG AA (4.5:1 body, 3:1 large and UI).
- [ ] Works at 375px (phone), 768px (iPad) and desktop: no horizontal page scroll, tap targets at least 44px, nothing hidden behind the keyboard.
- [ ] Interactive and titled values are reachable by keyboard with a visible focus ring; charts have a text alternative.
- [ ] Every AI question goes through the one top AI panel; no inline chat box is added to a page.

## Phone

Device emulation does not reproduce these; say which were checked on hardware and which only from code.

- [ ] Hover styles sit inside `@media (hover: hover)`; press feedback comes from `:active`, on every input type.
- [ ] Inputs are 16px on coarse pointers (iOS zooms below that); zoom is never disabled.
- [ ] Fixed bars and sheets pad with `env(safe-area-inset-*)`; app-height boxes use `dvh`; inner scrollers set `overscroll-behavior: contain`.
- [ ] Capability is read from `(hover)`, `(pointer)` and `env()`, never from the user agent or the width alone.

## Worst-case data

A block that looks right with today's data is checked with the realistic worst value of every field it renders, entered through the data (fixture or `public-data` shape), not by editing markup.

- [ ] Long and short: a 30-character Korean company name and a one-letter ticker; a seven-digit price and `0`; an empty list, a list of one, and the longest real list.
- [ ] Missing: `null`, an absent optional field and a stale date each show their own state, never `NaN`, `undefined`, an orphaned dash or an empty line.
- [ ] Text columns can shrink (`min-width: 0`), fixed boxes cannot (`flex-shrink: 0`), and figures the reader compares are never truncated.
- [ ] Checked at 320px, at 200% zoom and in the dark theme. Report as: field, worst value, what happens, fix (`file:line`); list what held up too.

## Motion

- [ ] It has a purpose (feedback, where something came from, a state change, avoiding a jump) and the reader meets it at most occasionally. Keyboard-triggered actions and anything seen tens of times a day do not animate.
- [ ] Only `transform` and `opacity` move; properties are named (no `transition: all`); entrances use `--ease-standard`, never `ease-in`; 150–200ms, sheets and the drawer up to 250ms; nothing starts from `scale(0)`.
- [ ] Reduced motion keeps the state change and drops the travel.

## Corrections become rules

An owner correction on look, wording or behaviour is written down where the next change will meet it: a ratchet or gate when a violation can be matched in code, otherwise one line with its reason in `_context/DESIGN-TOKENS.md` (look) or `AGENTS.md` (product). Write the rule at the level of a class of component, with the owner's words and date, never a reason the owner did not give.
