# AI 도우미 패널

The AI 도우미 is one right-side panel for education and research questions, answered by the shared GPT-6 Luna Worker with automatic web search. It takes its context and suggestion chips from the active page, checks the Worker before any paid call, and keeps the question when the Worker is unavailable.

## Sub-features

- `ai-open` — `#topbar-ai-btn` (`aria-expanded=true`, text `AI 닫기` while open; its aria-label stays `AI 도우미 열기/닫기`; the header × `.ai-ph-close` also closes) opens `#ai-panel` (`aria-hidden=false`, not inert). Pages outside the context map disable the input with `AI 분석은 주요 분석 페이지에서 사용할 수 있습니다.`
- `ai-chips` — `#ai-panel-chips .ai-chip`; a chip fills **and sends** (a paid request when the Worker is reachable).
- `ai-send` — 전송 or Enter in `#ai-panel-inp`. Each send first calls the free `/health`; only a healthy Worker gets the paid `/openai` call.
- `ai-degraded` — unhealthy Worker: one AI bubble `공용 AI 연결이 현재 응답할 준비가 되지 않았습니다…`, no user bubble, input text kept, the AI status reads `AI 연결 안 됨, 잠시 뒤 다시 시도` (short form `연결 안 됨`).
- `ai-close` — ×, the topbar button, or Escape.

## How to get to it (user POV)

- Topbar `AI 도우미` on a supported page (오늘 is one).
- The sidebar footer AI block is operator-only (`.llm-panel.aio-operator-control`); users see availability in the panel itself. Every screen also has an `AI에게 묻기` row (`button.q-chip[data-action=_aioAskInPanel]`).

## Driving it with verify-aio

Preconditions:

- Doctor OK; start on 오늘 (default page).

- **Open.** Click `#topbar-ai-btn`; panel open, not inert.
- **Chips.** ≥1 `#ai-panel-chips .ai-chip` (not clicked: a chip sends).
- **Send.** Fill `PER이 뭐야?`, press Enter. On 127.0.0.1: the degraded bubble appears, the input still holds the question, and zero `/openai` requests were made. On a reachable Worker the answer is checked only with `--send-ai`.
- **Close.** Press Escape; `aria-hidden=true`.
- **Proof.** `drive ai-panel` evidence folder.

## Gotchas

- A real answer spends the shared monthly AI budget ($20 incl. web search); `--send-ai` only when the answer itself is under test, and only on the Pages origin.
- The degraded path costs nothing locally because `/health` fails before `/openai`.
