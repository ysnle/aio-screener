// Expect cases for news scoring and selection (v59.42): what 오늘 (home), 브리핑 and 시장 뉴스 pick from one fixed feed,
// each article's score, topic and exclusion, and the one keyword rule every list uses. A change to a keyword list, a
// weight or a surface contract shows up here as a diff of the picked headlines.
export const suite = { name: 'news-selection', source: 'src/domain/news/selection.js' };

const NOW = Date.parse('2026-10-27T00:00:00Z');
const WINDOW = { windowStart: Date.parse('2026-10-25T23:00:00Z'), windowEnd: Date.parse('2026-10-26T23:00:00Z'), anchorDate: '2026-10-27' };
const at = (hoursBeforeNow) => new Date(NOW - hoursBeforeNow * 3600000).toISOString();
const body = (text) => text + ' The report gives enough context for the summary depth check.';

// Headlines from the 2026-10-27 local feed plus constructed rows for each rule; scores are computed, never given.
const FEED = [
  { title: 'Stocks Rise Pre-Bell as Traders Await Fed Policy Decision, Inflation Report, Big Tech Earnings', desc: body('Futures firmed before the FOMC decision.'), source: 'Investing.com', tier: 2, country: 'us', pubDate: at(5) },
  { title: 'Wall St banks, Blackstone line up $63 billion to finance Broadcom AI chips for Anthropic', desc: body('The financing covers custom AI chips.'), source: 'Reuters', tier: 1, country: 'us', pubDate: at(4), tickers: ['AVGO'] },
  { title: 'Treasury Yields Little Changed, French Bonds Outperform', desc: body('Bond markets steadied ahead of the Fed.'), source: 'WSJ', tier: 1, country: 'us', pubDate: at(6) },
  { title: 'Gold Futures Pick Up As Oil Prices Pull Back', desc: body('Crude eased after supply talks.'), source: 'Reuters', tier: 1, country: 'us', pubDate: at(7) },
  { title: 'Iran Seeks to Curb Inflation, Expand Food Subsidies Amid US Sanctions', desc: body('Sanctions keep pressure on prices.'), source: 'Bloomberg', tier: 1, country: 'us', pubDate: at(8) },
  { title: 'Stocks making the biggest moves midday: Lockheed, JetBlue, CoreWeave, Surgery Partners & more', desc: body('Shares moved on earnings.'), source: 'CNBC', tier: 2, country: 'us', pubDate: at(9), tickers: ['LMT', 'CRWV'] },
  { title: 'Trend hedge funds saw worst week since 2024 as AI stocks fell, Goldman says', desc: '', source: 'Reuters', tier: 1, country: 'us', pubDate: at(10) },
  { title: 'Investors Flee India Small-Caps as Margin Calls Come Knocking', desc: '', source: 'Bloomberg', tier: 1, country: 'us', pubDate: at(11) },
  { title: 'Rambus falls despite earnings beat on muted guidance outlook', desc: body('Revenue beat estimates.'), source: 'Seeking Alpha', tier: 2, country: 'us', pubDate: at(12) },
  { title: 'Rosenblatt raises RingCentral stock price target on guidance boost', desc: '', source: 'Investing.com', tier: 3, country: 'us', pubDate: at(12) },
  { title: '반도체는 버티는데 증시는 휘청…코스닥 1%대 급락', desc: '', source: '연합뉴스', tier: 2, country: 'kr', pubDate: at(13), tickers: ['KOSDAQ'] },
  { title: 'SK하이닉스 내일 3분기 실적공개…주주환원 카드 나오나', desc: '', source: '한국경제', tier: 2, country: 'kr', pubDate: at(14), tickers: ['$SK하이닉스'] },
  // P2116: 'nfl' used to sit inside 'inflation' and drop this headline.
  { title: 'Inflation expectations ease as core prices cool for a third month', desc: body('CPI and PCE readings softened.'), source: 'Reuters', tier: 1, country: 'us', pubDate: at(3) },
  // v59.42: 'tax' (policy exemption) no longer sits inside 'taxi'; 'surge' no longer inside 'Surgery'.
  { title: 'Taxi drivers rally at city hall over new permits', desc: '', source: 'Local Wire', tier: 3, country: 'us', pubDate: at(3) },
  // v59.42: '핵' (priority) no longer sits inside '핵심'.
  { title: '핵심 인재 채용 박람회 열려', desc: '', source: '지역신문', tier: 3, country: 'kr', pubDate: at(3) },
  // Exclusion: blacklist, clickbait, sports, crypto price prediction.
  { title: 'NFL ratings slip again as streaming deal looms', desc: '', source: 'ESPN', tier: 3, country: 'us', pubDate: at(2) },
  { title: 'Dogecoin price prediction: could reach $1 by 2027', desc: '', source: 'Crypto Blog', tier: 3, country: 'us', pubDate: at(2) },
  { title: 'Next 100x AI stock to buy before it explodes', desc: '', source: 'Promo Site', tier: 3, country: 'us', pubDate: at(2) },
  // Verification: Telegram is secondary-only, anonymous sourcing is unverified, a headline without body stays out of AI.
  { title: 'Fed officials weigh slower balance sheet runoff', desc: body('Channel note on the FOMC minutes.'), source: 'TG Macro Desk', tier: 4, country: 'us', pubDate: at(4), _tgChannel: true },
  { title: 'Nvidia nears supply deal, people familiar with the matter say', desc: body('Sources said the GPU deal is near.'), source: 'Bloomberg', tier: 1, country: 'us', pubDate: at(4), tickers: ['NVDA'] },
  { title: 'Oil jumps as OPEC+ signals deeper output cuts', desc: '', source: 'Reuters', tier: 1, country: 'us', pubDate: at(2) },
  // Outside the 08:00 window: kept out of every surface.
  { title: 'Fed holds rates steady, signals patience on cuts', desc: body('An older cycle.'), source: 'Reuters', tier: 1, country: 'us', pubDate: at(40) },
].map((item, index) => ({ ...item, link: `https://example.test/news/${index}` }));

const env = (stories) => ({
  extractTickers: (item) => item.tickers || [],
  displayTickers: (item) => item.tickers || [],
  displayTitle: (item) => item.title,
  stories,
  controls: () => ({}),
  now: () => NOW,
});

export default async function cases({ load }) {
  const selection = await load(suite.source);
  const { keywordHit } = await load('src/domain/news/keyword-match.js');
  const { newsArticleKey, groupNewsStories, isNewsRevision } = await load('src/domain/news/stories.js');
  const context = env({ key: newsArticleKey, group: groupNewsStories, isRevision: isNewsRevision });

  const scored = FEED.map((raw) => {
    const item = { ...raw };
    item.score = selection.scoreItem(item, context);
    item.topic = selection.classifyTopic(item);
    return item;
  });
  const out = [];
  out.push({
    name: 'scores-topics-exclusions',
    input: { now: new Date(NOW).toISOString(), articles: FEED.length },
    output: scored.map((item) => `${item._blacklisted ? 'excluded' : String(item.score).padStart(3)} | ${item.topic.padEnd(9)} | ${selection.newsTextSentiment(item.title + ' ' + (item.desc || '')).padEnd(4)} | ${item.title}${item._scoreReasons && item._scoreReasons.length ? `\n      ${item._scoreReasons.join(', ')}` : ''}`).join('\n'),
  });
  // The client feed drops excluded and topic-less rows before any surface (js/aio-data.js fetchAllNews).
  const feed = scored.filter((item) => !item._blacklisted && item.topic !== 'general');
  const show = (model) => [
    ...model.items.map((item) => `${String(item.score).padStart(3)} | ${item.topic.padEnd(9)} | ${item.verificationStatus.padEnd(16)} | ${item.title}`),
    `-- visible ${model.visibleCount}, eligible ${model.eligibleCount}, empty ${model.emptyReason || '-'}`,
    ...(model.aiItems && model.surfaceId === 'briefing' ? [`-- AI summary set: ${model.aiItems.length}, review: ${model.reviewItems.length}`] : []),
  ].join('\n');
  const surfaces = [
    ['surface-home', 'home', {}],
    ['surface-briefing', 'briefing', {}],
    ['surface-market-news', 'market-news', { countryFilter: 'all', topicFilter: 'all', sortMode: 'score' }],
    ['surface-market-news-korea', 'market-news', { countryFilter: 'kr', topicFilter: 'all', sortMode: 'score' }],
    ['surface-market-news-company', 'market-news', { countryFilter: 'all', topicFilter: 'company', sortMode: 'score' }],
    ['surface-technical-strip', 'technical', {}],
  ];
  for (const [name, surfaceId, opts] of surfaces) {
    const model = selection.buildNewsSurfaceModel(surfaceId, feed.map((item) => ({ ...item })), { nowMs: NOW, ...WINDOW, ...opts }, context);
    out.push({ name, input: { surfaceId, opts }, output: show(model) });
  }
  // P2115: five 90-point macro stories must not stop the home cascade at one headline.
  const crowded = ['Core prices ease for third month', 'Treasury yields jump after CPI', 'Powell signals patience on cuts', 'Payrolls beat forecasts in October', 'Dollar firms on hawkish Fed minutes']
    .map((title, k) => ({ title, source: 'Reuters', tier: 1, country: 'us', topic: 'macro', score: 95 - k, pubDate: at(3), link: `https://example.test/macro-${k}` }))
    .concat([['energy', 'Oil supply cut lifts crude'], ['geo', 'Border talks stall again'], ['earnings', 'Chipmaker beats revenue guide']].map(([topic, title], k) => ({ title, source: 'Reuters', tier: 1, country: 'us', topic, score: 80 - k, pubDate: at(3), link: `https://example.test/${topic}-${k}` })));
  out.push({ name: 'home-crowded-topic', input: crowded.map((item) => `${item.score} ${item.topic} ${item.title}`), output: show(selection.buildNewsSurfaceModel('home', crowded, { nowMs: NOW, ...WINDOW }, context)) });

  const rule = [
    ['inflation report', 'nfl'], ['taxi drivers', 'tax'], ['new taxes on chips', 'tax'], ['ai chips rally', 'chip'], ['surgery partners', 'surge'],
    ['shares surged', 'surge'], ['could reach $100', 'could reach $'], ['real  estate', 'real estate'], ['s&p 500 closes higher', 's&p'],
    ['금리가 오른다', '금리'], ['금리 상승', '금'], ['금 가격 상승', '금'], ['핵심 인재', '핵'], ['북한 핵 실험', '핵'], ['밈주식 열풍', '밈'], ['ai반도체 수출', 'ai'],
  ];
  out.push({
    name: 'keyword-rule',
    input: 'text  ⟵  keyword (plural default; "verb" = -s/-es/-d/-ed/-ing)',
    output: rule.map(([text, keyword]) => `${keywordHit(text, keyword) ? 'hit ' : 'miss'}${keyword === 'surge' ? ` / verb ${keywordHit(text, keyword, { suffix: '(?:s|es|d|ed|ing)' }) ? 'hit ' : 'miss'}` : ''} | ${keyword.padEnd(14)} | ${text}`).join('\n'),
  });
  return out;
}
