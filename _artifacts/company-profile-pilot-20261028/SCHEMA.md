# Company profile pilot — schema (2026-10-28)

Owner request (2026-10-28): every company gets a short description plus business model, revenue structure, product
portfolio, value chain, demand and supply chain, competition, governance and AI relevance; forward estimates and
guidance; what a professional watches; and how the reading is used in actual trading. Sources: company IR site,
filings (10-K/10-Q/8-K, proxy), earnings releases and call materials, and cited web research.

Product rules that bind the profile (AGENTS.md): no invented numbers, every number dated and sourced, no ticker
guessing, no grades, and no personal trade instruction (no entry, stop, target, size or timing). The trading section
teaches how a professional uses the facts: conditions, levels to watch, event reactions, what confirms or breaks the
thesis.

One JSON file per symbol, `profiles/<SYMBOL>.json`:

```json
{
  "symbol": "NVDA", "name": "NVIDIA Corporation", "researchedAt": "2026-10-28", "fiscalYearEnd": "late January",
  "sources": [{ "id": "s1", "kind": "10-K|10-Q|8-K|earnings-release|ir-site|call-transcript|proxy|news|other", "title": "...", "url": "https://...", "publisher": "...", "date": "YYYY-MM-DD" }],
  "overview": { "text": "2-3 Korean sentences: what it sells, to whom, how it earns.", "src": ["s1"] },
  "businessModel": { "text": "...", "src": [] },
  "revenueStructure": { "period": "FY2026", "segments": [{ "name": "...", "revenue": 0, "unit": "USD bn", "share": 0, "yoy": 0, "src": [] }], "recurringShare": "text or null", "geography": "text or null", "text": "...", "src": [] },
  "productPortfolio": [{ "name": "...", "role": "...", "src": [] }],
  "valueChain": { "position": "upstream|midstream|downstream|platform|service", "suppliers": ["..."], "customers": ["..."], "concentration": "largest customer share if disclosed", "text": "...", "src": [] },
  "demandSupply": { "demandDrivers": ["..."], "supplyConstraints": ["..."], "text": "...", "src": [] },
  "competition": { "peers": ["TICKER"], "moat": "...", "threats": "...", "src": [] },
  "governance": { "ceo": "name, since YYYY", "control": "founder/dual-class/widely held", "insiderOwnership": "text or null", "capitalReturn": "buyback/dividend facts", "notes": "...", "src": [] },
  "aiRelevance": { "role": "direct-supplier|infrastructure-enabler|platform|adopter|exposed-to-disruption|limited", "text": "...", "evidence": "the disclosed number or statement", "src": [] },
  "guidance": { "latest": [{ "period": "Q4 FY2026", "metric": "revenue", "value": "range or point as stated", "givenOn": "YYYY-MM-DD", "src": [] }], "style": "quarterly|annual|none", "text": "how the company guides and how it has landed vs its guide", "src": [] },
  "estimates": { "text": "consensus direction and level if found with a date, else null", "src": [] },
  "expertLens": { "keyMetrics": [{ "metric": "...", "why": "..." }], "valuationFrame": "how professionals value this kind of business", "thesisChecks": ["..."], "breakSignals": ["..."] },
  "tradingUse": { "catalysts": [{ "date": "YYYY-MM-DD or window", "event": "...", "src": [] }], "eventReaction": "what usually moves the stock on its reports (guide vs print, a KPI)", "watchConditions": ["observable conditions a trader checks, never an order"], "src": [] },
  "unverified": ["anything that could not be sourced"],
  "confidence": "high|medium|low with one reason"
}
```

Rules for writers: Korean prose, short (each `text` at most about 3 sentences). Every claim carries `src` ids that
exist in `sources`. Prefer primary sources (filings, the company's own release or IR page) over news. A value that was
not found is null and listed in `unverified` — never filled from memory.
