# AIO Screener — Route Group 4 Audit: Portfolio, Principles, Atlas, Masters, AI Chat, Glossary

Audited 2026-09-27. Live site: https://ysnle.github.io/aio-screener/ (tab-5, closed after audit).
Local source: C:\projects\AIO (paths below are absolute; line numbers from the read at audit time).

## 0. Version / freshness caveat (IMPORTANT — unverified which build is "current")

- `version.json` fetched directly (outside the app's service worker) returned **v56.58**, built 2026-09-27T21:10 KST, note: "legacy F-52 표본 gate와 live-core strict lineage 보강".
- The live app itself (loaded through its service worker, `sw.js`, active at `https://ysnle.github.io/aio-screener/sw.js`) served **v56.33**, built 2026-09-24T22:44 KST, note: "P1204 Masters canonical index staging 누락과 refresh fail-fast publication 수정; actual Git index blob gate 추가" — i.e. a fix specifically about **Masters data publication** landed after v56.33.
- `index.html` in the local repo references `?v=56.58` for all scripts, confirming the deployed source is ahead of what the service worker was still serving to this session.
- **This means the Masters-page bug documented below (all 7 headline managers stuck on "준비 중"/PENDING while the underlying JSON already has verified rows) may already be fixed in v56.58.** Flagging as unverified-against-latest; re-check after the SW cache updates or with a hard cache-bust.
- Per the coordinator's note, another session may be deploying concurrently, which is consistent with this drift.

---

## 1. Portfolio (`#portfolio`)

Source: `src/ui/pages/portfolio.js` (424 lines), domain: `src/domain/portfolio/surface.js` (not read line-by-line this pass), storage key: `localStorage['aio_portfolio_data']` (confirmed live), IndexedDB `AIOScreenerDB` unrelated (only a `news` object store).

### Purpose / first-screen clarity
Clear single-sentence purpose banner: "보유 자산 · 수신 시세 기준 손익 · 리밸런싱 — 시세 지연/출처를 별도 표시하며 로컬 저장, 서버 전송 없음". Empty state is a genuinely good pattern: a centered card says "포트폴리오가 비어 있습니다", a one-line instruction, a single "첫 종목 추가" CTA, and a privacy note ("데이터는 브라우저에만 저장되며 서버로 전송되지 않습니다. PIN 설정 후 저장 시 AES-256 암호화.") — this is exactly what a beginner needs on first visit. Verdict: KEEP.

### Add/edit/remove flow (live-tested)
Tested live: clicked "종목 추가" → inline form appears with ticker/qty/avg-cost/target/cost-currency/memo fields (`portfolio.js` is not the field-render owner — the entry form is a legacy/index.html surface, but the resulting native table row-render is owned by `portfolio.js:191-307`). Added AAPL qty 1 @ $150 (test-only, per constraints) — row appeared immediately with correct qty/cost, "현재가"/"손익"/"수익률" as "—" (fail-closed, no live quote — appropriate).

**Finding — inconsistent price source on same page (unverified severity, real observed behavior):** After adding AAPL, the table row showed 현재가 "—" (native surface pipeline: `portfolio.js:196-201`, `derivePortfolioSurface`, fed by `root._liveData`), but a separate card lower on the page, "보유 종목 AI 차트 분석" (legacy-owned, not in `portfolio.js`), rendered **AAPL $341.07** with MA5/20/50 and 20-day support/resistance from a different data path. A beginner comparing the two would reasonably wonder why the table says "no price" while the card 200px below shows a specific number. This is a genuine two-owner data race consistent with the file's own comment at `portfolio.js:7-15` ("highest-severity contested container… whichever writer runs last wins"). Verdict: FIX (at minimum, make the table's price pipeline consume the same live-quote source the AI-chart card uses, or explain the discrepancy in the empty-price cell's title attribute).

**Finding — delete confirmation likely blocks automated interaction (low confidence, real observed behavior):** Clicking "AAPL 삭제" in the row (`data-action="_aioRemovePosition"`, `portfolio.js:293-303`) produced no visible DOM change across two attempts and no console error — consistent with a native `confirm()` dialog that a scripted click cannot dismiss. Cleanup for this audit was done directly via `localStorage.removeItem('aio_portfolio_data')` (confirmed portfolio reset to empty on reload) rather than via the UI button, because the UI path did not visibly complete. **Unverified**: whether a real user's click+native-confirm-OK flow works fine (very likely yes) — flagging only because an agent/automation-style interaction stalled silently with no error surfaced, which is also a mild real-world risk if `confirm()` is ever blocked by a browser dialog-suppression setting.

### Currency handling (KRW/USD)
Genuinely sophisticated for a free single-person project: `portfolio.js:127-142` distinguishes `converted-with-declared-rates`, `mixed-without-conversion` (blocks the total rather than guessing), and `declared-single`; per-row cost/price currency is rendered with its own code prefix (`portfolio.js:253-267`, comment at :253 references bugfix LC-45 — a real regression where every row was mislabeled `$` regardless of declared currency). This is above what most free retail screeners do, and it correctly refuses to silently sum KRW+USD. Verdict: KEEP — but the *entry form* only has a free-text "원가 통화 3자리 코드" field with no currency picker/validation visible in the interactive tree (`textbox "원가 통화 3자리 코드 (예: USD, KRW)"`), so a family member who types "usd" lowercase or "원" must guess the right format. Minor FIX: normalize/validate on blur with inline feedback.

### Metrics shown — meaningful for a family investor?
Hero: 총 자산 가치, 총 손익, 현금, 노출 규칙 (VIX-based cap) — all fail-closed to "—" rather than 0, which is correct (0 would falsely read as "no risk"). Risk panel (below): Sharpe, Beta vs SPY, Max Drawdown, Drift-vs-target, all explicitly labeled **"교육 예시 기준 — 정책·기간 미설정 (사용자 설정 아님)"** ("teaching-example basis, not a user setting") when the user hasn't declared a measurement policy. This is an unusually honest design choice — most portfolio tools would just show a plausible-looking number. For a beginner this is *slightly* confusing (why show a metric that says it's not real?) but for a family member making real trading decisions it correctly prevents false confidence. Verdict: KEEP the fail-closed behavior; FIX the beginner confusion by collapsing the whole risk panel behind "고급 설정 열기" until the user opts in, rather than showing five dash-filled metrics with disclaimers by default.

### Backup/export/import clarity
"내보내기"/"가져오기" buttons present in the header (not deeply tested to avoid a real file-system prompt/side effect). Text elsewhere in the app ("포트폴리오 데이터도 로컬 저장이므로 정기적으로 백업하세요") reinforces the message but only appears in a help/FAQ area, not next to the export button itself. FIX: put a one-line "마지막 백업: N일 전" or a periodic backup nudge near the export button, since localStorage-only storage genuinely can be lost (browser data clear, private mode, device change) and the F AQ text elsewhere (found via search) already says as much.

### Vault/PIN UX (inspect-only, not tested with real values)
Found via search: "API 키 암호화" and PIN-related copy exist in a settings surface separate from the portfolio page; portfolio's own empty-state text promises "PIN 설정 후 저장 시 AES-256 암호화" but PIN setup itself is not surfaced *on* the portfolio page — a user must find it elsewhere first. FIX/MERGE: link directly from the portfolio empty-state or hero to wherever PIN setup lives, since the promise is made here but the action is elsewhere.

### Mobile
At 375×812, header collapses to hamburger menus (`메뉴 열기` ×2) and the AI-beta toggle remains visible; portfolio heading/종목 추가/내보내기/시세 갱신/전체 삭제 all present as top-level interactive elements with no obvious overflow in the interactive-element read. Not screenshot-verified pixel-by-pixel (pane compositing was unavailable in this session — see note below); layout structure read via accessibility tree looks reasonable. **Unverified**: visual table overflow behavior on a 9-column holdings table at 375px width — a 9-column table (종목/수량/매수단가/현재가/손익/수익률/목표가/비중/관리) is very likely to require horizontal scroll on mobile; this should be spot-checked visually in a follow-up session with pane display enabled.

### Portfolio element inventory (selected)
| element | shows | source | freshness/correct | beginner | trader | verdict |
|---|---|---|---|---|---|---|
| 총 자산 가치 hero | total account value, fails to "—" | `portfolio.js:59-80` | correct (fail-closed) | clear | clear | KEEP |
| 통화 note | declares mixed/converted/single currency state | `portfolio.js:127-142` | correct, unusually rigorous | needs a tooltip | clear | KEEP |
| 리스크 분석 panel (Sharpe/Beta/MaxDD/Drift) | 5 metrics, all disclaimered when policy unset | legacy (not in portfolio.js) | correct but confusing by default | confusing | fine | FIX (collapse by default) |
| AI 차트 분석 card | per-holding MA5/20/50 + live price | legacy, separate data path from table | **inconsistent with table's own price cell** | confusing | confusing | FIX |
| 종목 관리 (차트/수정/삭제) | row actions | `portfolio.js:290-304` | delete unverifiable via automated click | fine | fine | KEEP w/ FIX (confirm UX) |

---

## 2. Principles (`#principles`) — 시장 원리 / "세상을 움직이는 원리"

Source: `src/ui/pages/principles.js` (1507 lines; read to line 235 plus in-app content). Data: `public-data/principles/{chapters,lesson-library,narrative-journey,node-guides,reference-curriculum}.json`.

### Purpose / first-screen clarity
Very strong. The page states its own pedagogy directly: "먼저 이야기를 따라가고, 낯선 개념이 나올 때만 개념 지도와 심화 원고를 펼치세요" (follow the story first, open the concept map only when a term is unfamiliar). Four tabs: 이어 읽기 (story), 개념 지도 (concept map), 관계 지도 (relationship map), 선택 학습 / 참고 자료실 (reference library). This is a genuine curriculum structure, not just a glossary dump.

### Curriculum / "what to learn first" (task a)
**Yes — a clear, sequenced 12-chapter narrative exists**, grouped into 6 parts:
1. 돈은 왜 삶의 선택권인가 (money as optionality / purchasing power)
2. 시간의 가격이 경제를 움직인다 (interest rates)
3. 채권과 달러 위에서 자본이 이동한다 (bonds/dollar)
4. 경제는 기업의 숫자로 번역된다 (company fundamentals)
5. AI는 디지털 이야기이면서 물리적 투자다 (AI physical bottlenecks)
6. 마지막 질문은 무엇을 소유할 것인가이다 (market rationality, risk/survival)

Each chapter has: a framing question, a short narrative, an explicit "이 장의 흐름" (4-step flow diagram), a "그래서 기업과 주식시장에서는" (so-what for investing) sentence, a reflective question, prev/next navigation, a bookmark star, and a personal-notes field saved to the browser. This is a well-designed self-study path — better than most free tools aimed at the same audience.

### Sample lesson evaluations (2 of the 10 required — read in full; remainder assessed structurally from source, see note)
1. **Chapter 1 — "돈은 숫자가 아니라 미래의 선택권이다"** (money = future optionality). Accuracy: sound, standard economics framing (money as deferred consumption / optionality), no factual claims that need sourcing. Depth: appropriate for a true beginner. Clarity: very clear, concrete ("통장에 찍힌 숫자가 그대로여도 내가 살 수 있는 집, 쉴 수 있는 시간… 줄어들 수 있다"). Korean writing quality: natural, non-translated-sounding. Examples: uses everyday reasoning rather than fabricated numbers (good — avoids false precision). Connects to live data: not in this chapter (appropriately — it's foundational, not a market read). Citation/review status: footer says "원고 검증 상태 · 사람 검수 진행 중" (human review in progress) — an honest, visible caveat. Verdict: KEEP.
2. **Chapter 9 — "돈은 빠르지만 공장과 전력망은 느리다"** (capital moves fast, factories/grids don't). Accuracy: sound conceptually (capital velocity vs physical capacity constraints in AI infra) — this is a synthesis/framing claim, not a factual data claim, so it doesn't need a citation the way a number would. Depth: 심화-appropriate, introduces bottleneck economics without oversimplifying ("병목은 희소성과 가격 결정력을 만들 수 있다. 하지만 높은 가격이 영구적인 초과이익을 보장하지는 않는다"). Clarity: strong, uses a concrete "AI 가치사슬에서 병목 추적" deep-link into Atlas. Connects to live data: structurally (via the deep-link button into Atlas nodes) but **not directly inside this chapter** — no ticker, price, or CAPEX number is shown here, which is appropriate for a conceptual chapter but means "apply immediately" requires a second click. Verdict: KEEP.
3–10. Not read in full text due to volume, but every lesson node in `RAW_CATALOG.lessons` / `MARKET_EXPANSION.lessons` / `SYSTEMS_EXPANSION.lessons` (principles.js:81-89, 135-149, 197-205) follows the same schema: `title/level/summary/body/nodeIds/route/routeLabel` — i.e. **every lesson explicitly names a live route to open next** (e.g. `route: 'fxbond', routeLabel: '환율·채권 화면 열기'`), which is a real learn→apply bridge at the data-model level, even where the prose itself stays conceptual. This is a structurally sound pattern; spot-checked 2 lessons live confirm the prose matches the schema's intent. **Unverified**: whether all ~20+ lessons in the source and the ~112 "심화 레슨" mentioned live ("개념 60개 · 학습 경로 8개 · 심화 레슨 112개") are equally well-written — only 2 were read end-to-end.

### "관계 지도" (relationship map) tab — sampled live
Extremely rigorous format per concept-relation card: **정의 (definition) / 작동 경로 (mechanism) / 확인할 자료 (what evidence to check) / 무효화·반대 경로 (falsification / counter-scenario) / 핵심 질문 (key question)**, each tagged with linked `principles:` node IDs and an "AI 시대 지식 지도에서 이어 읽기" deep-link to Atlas. The explicit "무효화·반대 경로" field — stating under what conditions the claim does NOT hold — is genuinely uncommon in retail-facing financial education and is a strong differentiator versus typical "here's what X means" glossary content. Verdict: KEEP, and this pattern should arguably be the template other surfaces (Masters, Atlas) borrow more of.

### Live-data connection (task b, "learn and apply")
Structural bridge exists (routeLabel deep-links + the `atlas-arrival-context`/`principles-arrival-context` "이어 읽던 이야기로 돌아가기" round-trip pattern seen in both `principles.js` and `atlas.js`), but within the story chapters themselves, no live number, price, or current reading is embedded — the connection is "read the concept, then click through to the specialist page for current data," never blended into a single view. This is a reasonable design choice (keeps evergreen content from going stale) but means "적용" (apply) is always a second step, not inline.

### Verdict + redesign note
Best-built learning surface in the audited group. Two concrete redesign suggestions: (1) surface the "무효화·반대 경로" framing more prominently — right now it's inside a click-to-expand relationship card, but it's the single most differentiating piece of content on the page. (2) Add a literal "지금 이 페이지에서 확인해보기" mini-widget at the end of relevant chapters (e.g. chapter 9 could show *today's* VIX or a live macro figure, not just a link) to close the learn→apply loop without leaving the page.

---

## 3. Atlas (`#atlas`) — "AI 시대 지식 지도"

Source: `src/ui/pages/atlas.js` (1710 lines; read to line 453 plus in-app content). Data: `public-data/atlas/*.json` (foundations, domain-guides, domain-claim-ledger, taxonomy-node-coverage, player-product-registry, deep-taxonomy, current-evidence-ledger, etc.) — a large, multi-file content system.

### Purpose / first-screen clarity
States purpose clearly: "AI는 모델 하나로 움직이지 않습니다… 기초에서 출발해 병목이 다음 산업으로 어떻게 전달되고 마지막에 매출·마진·현금흐름으로 번역되는지 따라가세요." Four tabs mirroring Principles: 학습 지도 (foundations), 관계 지도, 산업·가치사슬, 근거 자료실.

### Curriculum structure (task a/d)
`FOUNDATION_TRACKS` (`atlas.js:51-59`) defines **AI-0 through AI-6**, an explicit duration-labeled track: AI-0 (분류/용어, "기초"), AI-1 (15분, "AI가 무엇인가"), AI-2 (30분, "물리 인프라"), AI-3 (World Model/Agent, "심화"), AI-4 (45분, "경제·산업·자본"), AI-5 (제품화, "시각화와 route 연결"), AI-6 (품질 게이트, "검증과 접근성"). This is a genuinely well-thought-out onboarding sequence with time estimates, which most of the competing surfaces (Masters especially) lack. Below that sits a much larger **taxonomy** (`TAXONOMY_NODE_LABELS`, ~100+ nodes covering cloud/compute/memory/foundry/packaging/network/AIDC/power/physical-AI/defense/space/applications/resources/policy/capital-markets/future-tech) organized into **L0–L6 layers** (수요/문제 → 산업 domain → sector → subsector → product → player → KPI/status).

**Risk (task d — navigable or overwhelming?):** The taxonomy is large — well over 100 named nodes across ~19 domains, each with its own status badge (`DESIGN_ONLY`, `REVIEWED_CANDIDATE`, `PARTIAL`, `PRIMARY`, `AUTHORED_REFERENCE`, etc., `ATLAS_STATUS_LABELS` at `atlas.js:342-351`). For a family member who is not already AI-infrastructure-literate, arriving directly at the taxonomy/relationship-map tabs (rather than the guided AI-0→AI-6 track) would likely feel overwhelming — dozens of unfamiliar terms (CPO, HBM, chiplet, ABF substrate) with no obvious "start here" unless the user notices the separate Foundations tab first. Verdict: the *content* is KEEP-quality; the *information architecture* is a FIX — the guided track should probably be the default landing tab rather than one of four equally-weighted tabs.

### Sample content evaluation (structural, live-sampled)
Sampled the "관계 지도" tab live (same card format as Principles: 정의/작동 경로/확인할 자료/무효화·반대 경로/핵심 질문). Read 5 cards end-to-end:
- "챗봇에서 에이전트로: 생산성의 단위" — accurate framing of agentic workflows vs single-turn generation, correctly separates "model does more steps" from "net productivity," explicit counter-scenario about review/security overhead. No fabricated numbers.
- "학습에서 추론으로: 효율과 수요의 반동" — this is a correct articulation of Jevons-paradox-style reasoning for AI inference costs (cheaper inference can increase total compute/power demand) without using the term "Jevons paradox" or citing a study, which is fine since it's framed as a reasoning tool, not a factual claim.
- "GPU가 아닌 시스템 처리량" — correctly frames memory/interconnect/bandwidth as co-equal bottlenecks to raw FLOPS; consistent with how the industry actually discusses AI system design.
- "전력은 컴퓨트의 외부 조건이 아니다" — accurate and well-argued: power/cooling/grid interconnect genuinely gate deployable compute, a widely-cited real constraint (e.g. grid interconnection queues).
- "AI CAPEX와 신용시장" — correctly separates CAPEX funded by balance-sheet cash vs debt/customer-prepay/project-finance, and asks who bears residual/credit risk — sophisticated for a retail-facing product.

All five nodes cite a real institutional source in the underlying node metadata (Stanford HAI, NVIDIA, DOE, JEDEC, TSMC, SEC EDGAR, Federal Reserve, IEA — see `atlas.js:49-60`), each tagged with a status (`REVIEWED_CANDIDATE`/`PARTIAL`) rather than presented as fully verified — an honest signal. Korean quality: consistently high across all 5, no translation artifacts. Depth: 심화-level throughout — **this content assumes the reader already did the Principles/AI-0-2 primer**; it does not stand alone for a true beginner. Verdict: KEEP content; sequencing/discoverability is the fix (see above).

### Reachability from where concepts appear (task c) — **tested, and this is the report's most actionable finding**
On the live **Technical Analysis** page (`#technical`), searched the rendered DOM for glossary/tooltip hooks (`[data-term]`, `.glossary-term`, `.aio-glossary-term`, `[data-glossary]`) around the many inline occurrences of "RSI", "MACD", etc. (20 matches found for "RSI" alone, including a live label "RSI (14)"). **Result: 0 elements with any glossary-linking attribute.** Cross-checked in source: `index.html:13210-13261` shows the glossary is a **single global modal** (`#glossary-modal`) with its own search box, populated from `js/aio-glossary.js`'s flat `GLOSSARY` array (422 lines, ~150+ terms including a genuinely good RSI entry — see below), reachable only via a dedicated sidebar "용어 사전" page/floating button — **not via inline click-through from the term as it appears in context**. So: clicking "RSI" where it appears on the Technical page does **not** jump to its definition; the user must separately open the glossary page and search "RSI" manually. This fails task-criterion (c) as currently built, despite the glossary content itself being solid.
  - The RSI entry itself, for reference (`js/aio-glossary.js:60`): "상대강도지수(0~100). 70=과매수, 30=과매도. RSI 다이버전스(가격↑+RSI↓)가 더 강력한 반전 신호. → 차트분석 페이지에서 확인." — accurate, concise, appropriately hedged (no promise of predictive reliability).
  - Glossary quality more broadly is notably careful about overclaiming: e.g. the 헤드앤숄더 entry explicitly says "'신뢰도 89%' 같은 패턴 확률은 매매 근거로 쓰지 않습니다" (pattern-confidence percentages are not used as trading justification) and the VIX entry says numeric bands are "교육용 대략적 밴드일 뿐… 매매 신호가 아닙니다." This is a real, consistent editorial discipline across the glossary (see also entries for OAS/HY spread, Sahm Rule, DXY, NAAIM — all correctly caveat historical-pattern claims rather than presenting them as rules). Verdict: glossary content KEEP; inline reachability FIX (this is the single highest-leverage learning-UX fix available in this audit: wire `data-term` spans around known glossary headwords in rendered pages, e.g. on Technical/Macro/FX pages, opening the existing modal pre-filtered to that term).

### Verdict + redesign
Content quality and sourcing discipline: strong. Two fixes: (1) make the guided AI-0→AI-6 track the default entry point instead of one of four equal tabs; (2) wire glossary terms inline (see above) — this single change would also benefit Principles, Macro, Technical, and FX/Bond pages simultaneously since it's a shared component (`js/aio-glossary.js`).

---

## 4. Masters (`#masters`) — "대가의 포트폴리오" / SEC 13F

Source: `src/ui/pages/masters.js` (1317 lines; read to line 679). Data: `public-data/masters/{filings,holdings-summary,security-master,security-master-reference,history-index,manager-catalog,manager-row-previews,filing-discovery,manager-principles,ticker-index-reference}.json`.

### Purpose / first-screen clarity — strong copy, but see the bug below
Excellent framing: "13F는 실시간 매매 화면이 아니라 분기 말에 남은 기관의 흔적을 복원하는 기록입니다… 마지막에는 공시가 보여주지 않는 현금·공매도·해외자산과 제출 시차를 남겨, 보유 변화가 곧 매매 신호라는 오해를 막습니다." This directly and correctly addresses task-criterion (e): the staleness/lag of 13F data is stated up front, not buried. A dedicated "공시를 읽는 순서" (how to read a filing) 4-step guide is rendered per manager (`masters.js:258-279`): 책임자·전략 → 공시 기준일 → 변화 원장 → 현재 검증 ("현재 가격·실적·밸류에이션·유동성은 전문 분석 화면에서 별도로 대조합니다" — explicitly tells the user to cross-check current price elsewhere, i.e. it does not let 13F staleness masquerade as a live signal). Verdict on the *design intent*: KEEP, genuinely good risk communication.

### **Critical live finding — the 7 headline managers show "PENDING" while their real data exists and is verified**
Live-tested by fetching the app's own already-loaded JSON directly via JS console (not a network issue — both `manager-catalog.json` and `holdings-summary.json` returned HTTP 200):
- The UI's hard-coded `MASTER_REGISTRY` (`masters.js:21-29`) lists exactly 7 managers (Buffett/Berkshire, Druckenmiller/Duquesne, Fisher, Ackman/Pershing Square, Tepper/Appaloosa, Klarman/Baupost, Burry/Scion), all seeded with `status: 'PENDING'` as a literal fallback default in the source.
- Live-rendered page showed **every one of these 7** as "준비 중" (in preparation) / "전체 행 대사 대기" (full-row reconciliation pending) / "확인 필요" (needs confirmation) — i.e., a family member opening Masters today and clicking "Warren Buffett" sees no actual holdings, just "행 데이터 연결 대기" (row data connection pending).
- But directly querying the fetched `holdings-summary.json` in the browser console showed **all 7 IDs present with `status: 'VERIFIED_ROWS'` and real row counts**: Berkshire 89 rows, Duquesne 95, Fisher 1037, Pershing Square 11, Appaloosa 27, Baupost 23, Scion 8 — for report period 2026-06-30 (`latestAvailablePeriod`). The broader catalog (37 managers total, including BlackRock with 49,968 parsed rows and full reconciliation) is also fully populated.
- **Conclusion: this is very likely a client-side rendering/merge bug** (the `buildManagerRegistry` merge at `masters.js:84-120` presumably isn't reaching these specific 7 seed entries with the fetched catalog override, or a stale cached JS bundle in the service worker isn't matching the current JSON schema — see the Section 0 version-drift note: v56.33's own changelog entry is literally about a Masters "canonical index staging" fix, and v56.58 is already live server-side).
- **This is the single most consequential finding in the Masters audit**: as observed, the answer to "what can a family investor actually learn/do with Masters today" is effectively **nothing for the 7 famous, headline-relevant managers** — the exact ones a family member would open the page to see — even though the backend clearly has the data. Less-famous managers reached via the broader catalog (not surfaced as cards by default) do work. **Flagging as unverified against the newest deploy (v56.58)** per the Section 0 caveat — this may already be fixed; needs a re-check with a hard-refreshed service worker.

### 13F/45-day lag clarity (task e)
Handled well in copy (see above) and via explicit `freshnessStatus`/`STALE_REFERENCE` badges in the source (`masters.js:66-82` status-label map includes "최신성 지연 참고" = "stale reference for currency"). The page also explicitly separates 13F (quarterly institutional equity holdings) from 13D/G (beneficial-ownership events) rather than conflating them (`createOwnershipEvents`, `masters.js:440-465`), and explicitly states what 13F does *not* capture: "13F에 없는 공매도·현금·비공개 자산·일부 파생상품은 이 화면의 보유 행으로 추정하지 않습니다." This is more rigorous than most consumer-facing 13F trackers. Verdict: KEEP (design), currently undermined in practice by the rendering bug above.

### Ticker/CUSIP reverse-lookup
A "REFERENCE-ONLY TICKER LOOKUP" section lets a user search a ticker/CUSIP to find which managers reported it — explicitly labeled reference-only, with a stated boundary ("tickerReference is not SEC-provided… 검증 security master·corporate-action review·현재 가격과 결합되기 전에는 기관 흐름 신호를 만들지 않습니다"). Good caution; not fully tested live (would need an actual populated crosswalk to verify UX, which live-rendered as "참조용 티커 원장을 불러오는 중입니다" — still loading/empty in this session, consistent with the same bug pattern above).

### Masters element inventory (selected)
| element | shows | source | freshness/correct | beginner | trader | verdict |
|---|---|---|---|---|---|---|
| 7 manager cards | headline manager summary | `masters.js:21-29,146-165` | **shows PENDING despite verified backend data** | misleading (looks "not ready yet") | misleading | FIX (bug) |
| "공시를 읽는 순서" 4-step guide | how to read a 13F responsibly | `masters.js:258-279` | correct, well-written | clear | clear | KEEP |
| 13D/G ownership events | separate from 13F holdings | `masters.js:440-465` | correct, well-caveated | needs the distinction explained once more prominently | clear | KEEP |
| Ticker/CUSIP lookup | reverse lookup ticker→managers | `masters.js:173-256` | reference-only, correctly labeled | fine | fine (once populated) | KEEP once data loads |

---

## 5. AI Chat UI (inspect-only — no messages sent)

Entry points found live: a persistent "AI 베타 열기/닫기" toggle in the header, present on every page tested (Portfolio, Technical, etc.), and contextual prompts embedded in specialist pages (e.g. on 시장 폭: "시장 폭에 대한 질문이 있으신가요? AI 베타 교육·리서치 보조와 대화해보세요.").

Panel content (read-only inspection of `complementary "AI 베타 교육·리서치 보조 채팅 패널"`):
- Label: "AI 베타" with a "BETA · 교육/리서치 보조" badge — clear beta labeling.
- Disclosure line, verbatim: "AI 베타 · 읽기 전용 리서치 · 투자·법률·세무 조건부 분석과 수치 시나리오를 제공합니다. 불법 실행 절차·주문 실행·확정적 보장은 제외합니다." (read-only research; provides conditional analysis and numeric scenarios; explicitly excludes illegal execution procedures, order execution, or guaranteed outcomes). This is good, appropriately scoped disclosure directly in the panel, not buried in a ToS.
- Input textbox placeholder: "교육·리서치 질문을 입력하세요..." (reinforces education/research framing at the point of input).
- Single "전송" (send) button — no visible model-selection dropdown or per-message source/evidence panel in the *empty* pre-conversation state (consistent with the memory note that this is a shared-key, single-model setup rather than user-selectable).
- **Not tested**: what an actual answer's evidence/source/as-of presentation looks like, since sending a message was out of scope for this audit. **Unverified**: whether citations/as-of stamps appear post-response — could not inspect without sending a message, which the task explicitly disallows.
- Key-setup UI found elsewhere on the page (not AI-chat-specific): "API 키 암호화", "확장 API 키 설정", Finnhub/Google-CSE key fields — these are for market-data providers, not the AI chat itself, consistent with the shared-Claude-key architecture noted in project memory (`project_api_cost_structure.md`: "FMP 무료 티어 사용, Claude만 유료 과금").

Verdict: the entry point and disclosure are well-designed and appropriately conservative for a family-shared, real-money-adjacent tool. The pre-send state gives no way to preview how evidence/sourcing will be shown, which is a real audit gap (not a product gap) — a follow-up pass that is *permitted* to send a message would be needed to evaluate the actual answer-quality/evidence-presentation criteria.

---

## 6. Glossary (`js/aio-glossary.js`, cross-page)

422 lines (read to line 236), ~150+ terms across cat: 기초/기술적분석/경제/외환/채권/매크로/옵션 (and more categories past line 236, not fully read this pass — **unverified**: full term count and whether later categories, e.g. 심화/옵션 deep terms, maintain the same quality bar; the ~150 terms actually read are consistently good).

Editorial quality is the standout: this glossary was clearly revised (see header comment `js/aio-glossary.js:1-7`, referencing "LC-58," "LC-66~71," "LC-57/72/81" fix numbers) specifically to **remove overclaiming** — converting "X causes Y" or bare probability claims into explicitly hedged, source-aware language. Concrete examples read live:
- OAS/HY 스프레드: warns that "300/400/500bp 같은 구간 해석은 교육용 참고일 뿐 보편적 위기 임계값이 아니며" and that "OAS" and plain yield-spread are different definitions often confused.
- 이중 항목 통합: "맥스 페인" and "맥스페인" previously duplicated, now merged with an alias field — a real dedup fix.
- ITM/OTM entry explicitly corrects a common misconception (ITM/OTM is about intrinsic value, not profit/loss) with a worked numeric example.
- Sahm Rule, NBER recession dating, Fed's PCE-vs-CPI target, DXY's 100-baseline meaning — each entry states the **actual official definition** rather than a popularized simplification, while still being readable.

As established in Section 3, the structural gap is **not the content but the reachability**: this rich, well-maintained glossary is a standalone modal/page, not wired to inline terms where they appear (0 `data-term`-style hooks found on the live Technical page). Verdict: KEEP content as-is; FIX reachability (single highest-leverage change identified in this whole audit — see Atlas section).

---

## Cross-cutting learning-experience assessment (tasks a–e)

**(a) Clear curriculum/path?** Yes for Principles (12-chapter narrative with a stated read order) and Atlas (AI-0→AI-6 track with time estimates), but neither is the default first thing a user sees on those pages — both compete with 3 other equally-weighted tabs (concept map / relationship map / reference library), and Atlas's guided track in particular is easy to miss. Masters has no comparable "how do 13F filings work, step by step" onboarding beyond the excellent-but-page-scoped 4-step "공시를 읽는 순서" panel. Portfolio has no learning content of its own (appropriately — it's a workbench, not a lesson).

**(b) 10-lesson sample — accuracy/depth/clarity/Korean quality/examples/apply/citation.** 7 lessons read end-to-end across Principles (2 full chapters) and Atlas (5 relationship-map cards), all judged accurate (no unsupported factual/numeric claims found), appropriately depth-tiered (입문 vs 심화), clearly written in natural Korean, and consistently honest about review status ("사람 검수 진행 중", `REVIEWED_CANDIDATE`/`PARTIAL` status badges rather than false certainty). The remaining ~3 of the 10 were assessed structurally from the source schema (every lesson node carries a `route`/`routeLabel` deep-link) rather than read in full prose — **flagging this as a partial sample**, not a full 10-lesson read, due to the sheer content volume (112 심화 레슨 claimed live, 1507-line and 1710-line page-source files each backed by many more JSON content files not all read this pass).

**(c) Reachable from where concepts appear?** **No, currently** — tested and confirmed on the Technical page: zero inline glossary hooks. This is the clearest, most actionable, and most confidently-verified finding in this audit.

**(d) Atlas navigable or overwhelming?** Content is high quality but the taxonomy (100+ nodes, L0-L6, ~19 domains) risks overwhelming a true beginner who doesn't start from the AI-0 track — and the AI-0 track isn't the default view.

**(e) Masters/13F — learnable, and is the lag clear?** The lag/staleness messaging is excellent and clearly stated. But **live-tested right now, the page delivers essentially zero actual content for the 7 headline managers a family member would open it to see**, despite verified backend data existing — this is a bug, not a design gap, and (per Section 0) may already be fixed server-side in v56.58.

---

## Redesign proposal: coherent "learn → apply → track" experience

1. **Fix the single highest-leverage gap: inline glossary reachability.** Wire `data-term`/`data-glossary` spans around recognized headwords (RSI, MACD, VIX, PER, OAS, etc.) wherever they render across Technical/Macro/FX/Screener pages, opening the existing `#glossary-modal` pre-filtered to that term (the modal, search, and content already exist and are good — this is a wiring change, not new content). This alone converts every specialist page into a "learn-on-demand" surface without new writing.
2. **Make the guided track the default landing state on Atlas and (optionally) Principles.** Currently both pages present 4 equally-weighted tabs; a first-time visitor (or anyone without a saved "학습 기록") should land on 학습 지도/이어 읽기 by default, with concept/relationship maps demoted to "더 보기" for users who already know what they're looking for.
3. **Fix (or re-verify against v56.58) the Masters headline-manager rendering bug**, since it currently blocks the page's entire practical value for the audience most likely to open it (a beginner curious "what is Buffett holding").
4. **Resolve the Portfolio table-vs-AI-chart price inconsistency** — a single holding should never show "—" in one place and a specific number 200px away; either unify the data source or explicitly explain the difference (e.g. "차트는 지연 시세, 표는 실시간 확인 대기" as an inline note).
5. **Close the learn→apply loop with a small live widget inside relevant Principles/Atlas chapters** (e.g., today's VIX or a live macro reading rendered directly in the chapter that discusses it, not only a "열기" deep-link), so "apply" doesn't always require leaving the lesson.
6. **Add a one-line backup nudge next to Portfolio's 내보내기 button** ("마지막 백업: N일 전" or similar), since the app's own copy elsewhere already warns that browser-local storage can be lost.
7. **Collapse Portfolio's disclaimer-heavy risk-metrics panel behind an explicit opt-in** rather than showing five dash-filled, caveated numbers to every user by default — this keeps the (correct, valuable) fail-closed behavior while reducing beginner confusion.

## Verification notes / what could not be fully confirmed this pass
- Screenshots: the Browser pane's screenshot/compositing was unavailable in this session ("Browser pane is not displayed"); all findings above were verified via `get_page_text`, `read_page` (accessibility tree), `find`, `read_network_requests`, `read_console_messages`, and direct JS console inspection (`javascript_tool`) instead of pixel screenshots. Mobile layout was checked structurally (375×812 accessibility tree) but not visually — table-overflow behavior on Portfolio's 9-column holdings table at mobile width is flagged unverified above.
- Only 7 of the requested 10 lessons were read as full prose; the remainder were assessed via the content schema.
- AI chat post-response evidence/citation presentation could not be evaluated (no messages sent, per constraints).
- The Masters bug and the version-drift (v56.33-served vs v56.58-published) are both flagged as **time-sensitive / re-verify** given a concurrent deployment may be in progress.
- Test portfolio position (AAPL, qty 1) was added and removed before ending the session; confirmed via `localStorage.getItem('aio_portfolio_data') === null` and a full page reload showing the empty state again. Browser tab (tab-5) was closed at the end of the audit.
