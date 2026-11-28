// The topics a headline's own words name, one table for the ledger (facts.js, a headline's wordTopics) and the cause
// model (day-cause.js, the variable one clause of a headline cites).
export const WORD_TOPICS = Object.freeze([
  ['rates', /\b(?:fed|fomc|powell|treasury yields?|bond yields?|rate cuts?|rate hikes?)\b|금리|국채/i],
  ['inflation', /\b(?:inflation|cpi|pce|ppi)\b|물가/i], ['jobs', /\b(?:payrolls?|jobs report|unemployment|jobless)\b|고용|실업/i],
  ['energy', /\b(?:oil|crude|opec|brent|wti|natural gas)\b|(?<![가-힣])유가(?!증권)|원유/i], ['metals', /\b(?:gold|silver|copper)\b|금값|은값|구리/i],
  ['credit', /\b(?:credit spreads?|junk bonds?|high yield|private credit|defaults?)\b|신용|회사채/i],
  ['ai-semis', /\b(?:ai|chips?|semiconductors?|nvidia|data cent(?:er|re)s?|hbm|gpu)\b|반도체|인공지능/i],
  ['politics', /\b(?:midterms?|elections?|congress|senate|tariffs?|shutdown)\b|선거|관세/i],
  ['deal', /\b(?:acquir(?:e|es|ed|ing)|acquisition|merger|takeover|buyout|all-stock)\b|인수|합병/i],
  ['earnings', /\b(?:earnings|quarterly results|guidance|revenue)\b|실적|가이던스/i], ['fx', /\b(?:dollar index|strong dollar|weak dollar|greenback|yen|yuan|currenc(?:y|ies))\b|환율|달러(?:화|지수|인덱스|\s?강세|\s?약세)|엔화|원화/i],
  ['korea', /\b(?:kospi|kosdaq|korea|samsung|sk hynix)\b|코스피|코스닥|삼성|하이닉스/i], ['crypto', /\b(?:bitcoin|crypto|ether(?:eum)?)\b|비트코인/i]
]);
