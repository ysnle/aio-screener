# 쟁점과 이면 — drafting brief (2026-11-07)

The owner (lee) asked that the 종목 analysis go past "what the company does and how much it earns" (anything a web
search returns) to **how the company and its market actually work: where money and technology flow, what the market
is arguing about, and the structures underneath that a quick read misses.** Each researched company story in
`public-data/company-profiles/<SYMBOL>.json` gets two new fields. You draft them for the symbols you are assigned.

## Hard rules

- **Use only facts already in that symbol's profile file.** Every claim must be backed by the profile's own `sources`
  (cite their ids, e.g. `["s3","s7"]`). Do not browse, do not recall numbers from memory, do not add sources. If the
  profile does not support a point, leave it out. Numbers you write must appear in the profile with the same period.
- Korean prose, plain, professional, direct. No hype, no "전문가가 보는", no question chips, no quiz tone. A rhetorical
  question is allowed only inside a longer sentence of prose, never as a heading or as `question`.
- No trade instructions: no entry, stop, target price, position size, timing, "사세요/파세요/비중".
- Do not claim a causal link between price moves and news. Do not invent a market consensus: describe the two
  readings as readings ("~라고 보는 쪽은 … 근거로 든다"), grounded in profile facts.
- Name other companies exactly as the profile names them.

## Output

Write one file per symbol: `_artifacts/company-debate-20261107/drafts/<SYMBOL>.json` (file name = symbol, e.g.
`000660.KS.json`). Never edit `public-data/`. Shape:

```json
{
  "symbol": "NVDA",
  "debate": {
    "question": "One Korean statement (not a question) naming the single issue the stock's next year turns on, e.g. 'AI 데이터센터 매출이 2027년에도 공급 제약 안에서 늘어날 수 있는가가 아니라, 고객의 설비투자 여력이 그 속도를 받쳐 주는가' — keep it under 70 characters if you can, statement form ending in 다/가 is fine but no '?'.",
    "bull": { "text": "2-3 sentences: the reading that the story holds, with the concrete facts it rests on.", "src": ["s1"] },
    "bear": { "text": "2-3 sentences: the reading that it breaks, with the concrete facts it rests on.", "src": ["s7"] },
    "decides": [ { "when": "date or period as the profile gives it (e.g. '2026-11 중순 (회사 미확정)', 'Q4 FY2027 실적')", "what": "the observable fact that would tip the debate", "src": ["s11"] } ]
  },
  "underTheHood": [
    { "title": "short Korean noun phrase (<= 20 chars)", "text": "2-3 sentences on a structure most readers miss", "src": ["s3"] }
  ]
}
```

- `decides`: 1-3 items, each tied to something the profile dates or schedules (calendar, guidance period, roadmap).
- `underTheHood`: 2-4 items. Good subjects: who ultimately pays and how far the end demand is from this company;
  circular money (a supplier financing or investing in its own customer); purchase / supply commitments and their size
  versus revenue; customer or supplier concentration; the lag between orders, capacity and revenue; where pricing power
  sits along the chain and why; accounting choices that change the picture (depreciation life, non-GAAP vs GAAP,
  cumulative vs single quarter, managed basis); regulatory or export dependence; a segment that funds another.
  Each item must say *why it matters for reading the numbers*, not just restate a fact.
- Bull and bear must both be real and specific to this company. Do not mirror each other word for word.

## Check

After writing, run `node scripts/ci-company-debate-draft-check.mjs <your symbols...>` if it exists; otherwise make sure
the JSON parses (`node -e "JSON.parse(require('fs').readFileSync(p))"`) and that every `src` id exists in that profile's
`sources`. Report one line per symbol: done / skipped (why).
