# Company profile v2 — one connected story (owner feedback 2026-10-28)

The owner read v1 and said the parts felt separate and hard to take in. AI relevance and the AI value chain were too
thin, competition was weak, revenue structure was weak, and governance can be shorter. v2 tells one story in this
order, each step leading into the next:

technology and moat → what the company designs → who makes it (in-house, foundry, contract manufacturers, partners) →
who it sells to and through which channel → how the money flows in (pricing and billing model) → how much it earns
(revenue, margins, cash) → what it does with the money (R&D, capex, acquisitions, buybacks, dividends) → where it sits
in the AI value chain → who it competes with in each arena and how it plans to win → roadmap and vision (what it
will do next) → what to watch and how a trader uses it.

Do not label anything "전문가가 보는 것" or similar. Write plainly to the reader. Each `text` field is 2 to 4 Korean
sentences that connect to the step before it. Keep v1 rules: every number dated and sourced; nothing from memory;
unknown values are null and listed in `unverified`; no trade instructions (no entry, stop, target, size or timing).

Write `profiles-v2/<SYMBOL>.json`. Reuse what v1 (`profiles/<SYMBOL>.json`) already sourced; keep its source ids and
add new ones after the last id.

```json
{
  "symbol": "NVDA", "name": "NVIDIA Corporation", "researchedAt": "2026-10-28", "fiscalYearEnd": "late January",
  "oneLine": "One Korean sentence a newcomer remembers: what it is and why it matters now.",
  "sources": [{ "id": "s1", "kind": "10-K|10-Q|8-K|earnings-release|ir-site|call-transcript|proxy|investor-day|news|other", "title": "...", "url": "https://...", "publisher": "...", "date": "YYYY-MM-DD" }],

  "moat": { "sources": ["the 2-4 roots of its advantage: e.g. CUDA software ecosystem, NVLink interconnect, scale purchasing of HBM"], "text": "...", "src": [] },
  "design": { "text": "what it designs or offers, grouped the way the company reports it", "src": [] },
  "make": { "model": "fabless|in-house manufacturing|mixed|service|financial|asset-owner", "partners": ["named manufacturers or key suppliers with their role, e.g. 'TSMC — 4N/3N wafers and CoWoS packaging'"], "text": "...", "src": [] },
  "sell": { "customers": ["customer types and named large customers if disclosed"], "channel": "direct / OEM / distributors / app store / branches ...", "concentration": "largest customer shares if disclosed", "text": "...", "src": [] },
  "moneyFlow": {
    "steps": [{ "from": "Hyperscalers", "to": "NVIDIA", "what": "GPU systems purchase, paid per unit" }],
    "pricing": "how it charges: per unit, subscription, usage, take rate, spread, premium, membership fee ...",
    "text": "...", "src": []
  },
  "earnings": {
    "period": "FY2026",
    "revenue": { "value": 0, "unit": "USD bn", "yoy": 0 },
    "grossMargin": 0, "operatingMargin": 0, "netMargin": 0,
    "operatingCashFlow": { "value": 0, "unit": "USD bn" }, "freeCashFlow": { "value": 0, "unit": "USD bn" },
    "segments": [{ "name": "...", "revenue": 0, "unit": "USD bn", "share": 0, "yoy": 0, "operatingMargin": null, "src": [] }],
    "industryMetric": [{ "name": "the metric this industry is judged by (NII, CET1, AFFO/share, comparable sales, RPO, backlog, realized price...)", "value": "...", "src": [] }],
    "text": "how much it earns and where the profit concentrates", "src": []
  },
  "useOfCash": {
    "period": "FY2026",
    "items": [{ "use": "R&D|capex|acquisitions|buybacks|dividends|debt repayment|customer financing|other", "label": "short Korean name, required when use is other or customer financing (e.g. '비상장 AI 기업 지분 투자')", "value": 0, "unit": "USD bn", "src": [] }],
    "text": "where the money goes and what that says about priorities", "src": []
  },
  "aiChain": {
    "layer": "one of: chips-compute|memory|networking|semicap-foundry|power-energy|cooling-electrical|data-center-real-estate|cloud-infrastructure|models-platforms|software-applications|devices|ai-adopter|ai-exposed|limited",
    "position": "where exactly it sits and what it supplies to whom in the AI build-out",
    "dependsOn": ["upstream layers or companies it needs"],
    "sellsTo": ["downstream layers or companies that buy from it"],
    "aiRevenue": "disclosed AI-related revenue, orders or share with period, or null",
    "upside": "how AI growth reaches its income statement",
    "risk": "how AI could hurt it (substitution, capex cuts, disruption)",
    "text": "...", "src": []
  },
  "competition": {
    "arenas": [{ "arena": "e.g. AI accelerators", "rivals": ["AMD", "Google TPU (in-house)", "Broadcom custom ASIC"], "position": "leader|challenger|niche|follower", "share": "disclosed or credible share with source, or null", "src": [] }],
    "edge": "why it wins now", "threats": "what could take share",
    "text": "...", "src": []
  },
  "strategy": {
    "goal": "what the company says it is aiming for (stated targets, TAM claims)",
    "roadmap": [{ "when": "2026 H2 / FY2028 / 2027", "what": "product, capacity, market or financial milestone", "src": [] }],
    "vision": "the long-run picture management describes",
    "text": "...", "src": []
  },
  "governance": { "line": "one Korean sentence: who leads, control structure, capital-return stance", "src": [] },
  "guidance": { "latest": [{ "period": "...", "metric": "...", "value": "...", "givenOn": "YYYY-MM-DD", "src": [] }], "style": "quarterly|annual|none", "track": "how it has landed vs its guide", "src": [] },
  "estimates": { "text": "consensus direction and level with date, or null", "src": [] },
  "watch": {
    "confirms": ["observable facts that would show the story is working"],
    "breaks": ["observable facts that would show it is breaking"],
    "keyNumbers": [{ "name": "metric", "why": "one clause" }]
  },
  "trading": {
    "calendar": [{ "date": "YYYY-MM-DD or window", "event": "...", "src": [] }],
    "reaction": "what usually moves the stock on its reports",
    "conditions": ["conditions a trader checks, never an order"]
  },
  "unverified": ["..."],
  "confidence": "high|medium|low with one reason"
}
```

Money-flow steps: 3 to 6 arrows that a reader can follow from the end customer to the company's revenue line (and,
for platforms, to partners it pays). Use real names where disclosed.
