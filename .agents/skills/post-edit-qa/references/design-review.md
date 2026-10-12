# Design Review Checklist

Use for any change a user can see. Each item comes from an owner decision or a confirmed past defect; check it on the changed screen, or name it as not applicable in the QA report.

## Reader and story

- [ ] A beginner can say what the section means in one sentence after reading it; jargon has a plain gloss or a glossary link.
- [ ] Each section is one visual, a short reading of 3 to 5 lines (about 130 to 230 Korean characters) and folded details. Never text only or chart only.
- [ ] The page reads as one logic flow, with a bridge sentence from each section to the next. How-to prose is cut; analysis and connection text stay.
- [ ] The text says what to check and under which condition, never a buy, sell, size, stop or target instruction.

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
