// The 뉴스 filter panel's model: which region, topic group and entities each article belongs to, the live count of every
// chip, and the articles that pass the reader's choices. Pure — the page hands in how an article's issuers, shown
// title and extracted fact are read (the same resolvers the cards use), so a count and the card it counts never disagree.
import { keywordMatcher } from './keyword-match.js';
import { newsTopicOf } from './stories.js';

export const FEED_ENTITY_LIMIT = 12;

// The producer's country codes; anything else stays out of every region chip (it is still under 전체).
const ASIA = new Set(['jp', 'cn', 'hk', 'tw', 'sg', 'in', 'qa']);
const EUROPE = new Set(['eu', 'uk']);
export const FEED_REGIONS = Object.freeze([
  { key: 'us', label: '미국' }, { key: 'kr', label: '한국' }, { key: 'asia', label: '아시아' }, { key: 'eu', label: '유럽' }, { key: 'global', label: '글로벌' }
]);

// Topic groups over the row topics (the producer's feed topics and classifyTopic's keys). 'general' is unclassified and
// belongs to no group. The card's topic chip prints the same label, so a chip and a card never name a topic differently.
export const FEED_TOPICS = Object.freeze([
  { key: 'macro', label: '매크로', topics: ['macro', 'market-note'] },
  { key: 'semi', label: '반도체·AI', topics: ['semi', 'memory', 'optical', 'power'] },
  { key: 'earnings', label: '실적', topics: ['earnings', 'analyst'] },
  { key: 'energy', label: '에너지', topics: ['energy'] },
  { key: 'rates', label: '채권·환율', topics: ['fxbond', 'bond', 'fx', 'credit'] },
  { key: 'policy', label: '지정학·정책', topics: ['geo', 'ai-policy', 'defense'] },
  { key: 'equity', label: '주식', topics: ['equity', 'kr'] },
  { key: 'metals', label: '원자재', topics: ['metals', 'materials'] },
  { key: 'crypto', label: '크립토', topics: ['crypto'] },
  { key: 'sector', label: '업종', topics: ['healthcare', 'shipbuilding', 'space', 'quantum'] }
]);
const GROUP_OF_TOPIC = new Map(FEED_TOPICS.flatMap((group) => group.topics.map((topic) => [topic, group])));

// Subjects that are not a company: a headline names them in words. Each keyword list goes through the one news keyword
// rule (keyword-match.js), so 'fed' does not hit 'federal' and '금리' hits '금리가'.
export const FEED_KEYWORDS = Object.freeze([
  { id: 'fed', label: '연준', words: ['fed', 'fomc', 'powell', '연준', '파월'] },
  { id: 'inflation', label: '물가', words: ['inflation', 'cpi', 'pce', '물가', '인플레이션'] },
  { id: 'jobs', label: '고용', words: ['payrolls', 'jobless', 'unemployment', 'jobs report', '고용', '실업'] },
  { id: 'tariff', label: '관세', words: ['tariff', '관세'] },
  { id: 'ai', label: 'AI', words: ['ai', 'artificial intelligence', '인공지능'] },
  { id: 'memory', label: '메모리', words: ['memory', 'hbm', 'dram', 'nand', '메모리', '디램', '낸드'] },
  { id: 'datacenter', label: '데이터센터', words: ['data center', 'datacenter', '데이터센터'] },
  { id: 'oil', label: '유가', words: ['oil', 'crude', 'opec', 'brent', 'wti', '유가', '원유'] },
  { id: 'gold', label: '금', words: ['gold', '금값', '금 가격'] },
  { id: 'treasury', label: '국채', words: ['treasury', 'treasuries', 'bond yield', '국채'] },
  { id: 'currency', label: '환율', words: ['dollar', 'yen', 'currency', '환율', '원화', '엔화'] }, // '달러' is mostly an amount unit in Korean headlines
  { id: 'bitcoin', label: '비트코인', words: ['bitcoin', 'btc', '비트코인', '가상자산'] }
].map((row) => Object.freeze({ ...row, hit: keywordMatcher(row.words) })));

export const EMPTY_FEED_FILTER = Object.freeze({ region: 'all', topic: 'all', entity: 'all', figure: false, mine: false, query: '' });

const lower = (value) => String(value ?? '').toLowerCase();

export function regionOf(item) {
  const country = lower(item?.country);
  if (country === 'us' || country === 'kr' || country === 'global') return country;
  if (ASIA.has(country)) return 'asia';
  if (EUROPE.has(country)) return 'eu';
  return '';
}

/** The topic group key of an article (its shown topic), or '' for an unclassified one. */
export function topicGroupOf(item, shownTitle = '') {
  return GROUP_OF_TOPIC.get(newsTopicOf(item, shownTitle))?.key || '';
}
export const topicGroupLabel = (key) => FEED_TOPICS.find((group) => group.key === key)?.label || '';

/** A handed-over topic (a group key or a row topic such as 'geo') as a group key, or '' when it names none. */
export function topicGroupFor(value) {
  const key = String(value || '').trim();
  if (FEED_TOPICS.some((group) => group.key === key)) return key;
  return GROUP_OF_TOPIC.get(key)?.key || '';
}

export const tickerEntityKey = (symbol) => `T:${String(symbol || '').trim().toUpperCase()}`;

/**
 * An article's entities: its resolved issuers (registry topic keys such as GE_VRN are not symbols and stay out), then
 * the fixed keywords its headline names. `shown` is the page's reading of the article ({ title, issuers }).
 */
export function feedEntitiesOf(item, shown = {}) {
  const issuers = [...new Set((Array.isArray(shown.issuers) ? shown.issuers : []).map((symbol) => String(symbol).trim().toUpperCase()).filter((symbol) => symbol && !symbol.includes('_')))];
  const text = lower(`${item?.title || ''} ${item?.titleKo || ''} ${shown.title || ''} ${item?.desc || ''}`);
  return [
    // A listed code with an exchange suffix (005930.KS) reads by its registry name when the page supplies one.
    ...issuers.map((symbol) => ({ key: tickerEntityKey(symbol), label: (/\.[A-Z]{1,3}$/.test(symbol) && shown.names?.[symbol]) || symbol, kind: 'ticker' })),
    ...FEED_KEYWORDS.filter((row) => row.hit(text)).map((row) => ({ key: `K:${row.id}`, label: row.label, kind: 'keyword' }))
  ];
}

/**
 * One row per article: { item, key, region, topic, entities: [{ key, label, kind }], entityKeys, fact, mine, haystack }.
 * `read(item)` returns { title, original, issuers, fact } for that article; `mine` is the set of watched or held symbols.
 */
export function describeFeedRows(items, { read = () => ({}), mine = new Set(), keyOf = (item) => item?.newsId || item?.link || item?.title } = {}) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const shown = read(item) || {};
    const entities = feedEntitiesOf(item, shown);
    const symbols = new Set(entities.filter((entity) => entity.kind === 'ticker').map((entity) => entity.key.slice(2)));
    return {
      item,
      key: keyOf(item),
      region: regionOf(item),
      topic: topicGroupOf(item, shown.title),
      entities,
      entityKeys: new Set(entities.map((entity) => entity.key)),
      fact: shown.fact || null,
      mine: [...symbols].some((symbol) => mine.has(symbol)),
      haystack: lower([item?.title, item?.titleKo, shown.title, shown.original, item?.source, ...entities.map((entity) => entity.label)].filter(Boolean).join(' '))
    };
  });
}

const DIMENSIONS = Object.freeze({
  region: (row, value) => row.region === value,
  topic: (row, value) => row.topic === value,
  entity: (row, value) => row.entityKeys.has(value),
  figure: (row) => row.fact?.kind === '수치',
  mine: (row) => row.mine,
  query: (row, value) => lower(value).split(/\s+/).filter(Boolean).every((word) => row.haystack.includes(word))
});
const inactive = (value) => value == null || value === false || value === '' || value === 'all';

/** The filter with only known keys and plain values (a stale or foreign state object reads as no filter). */
export function normalizeFeedFilter(filter = {}) {
  const pick = (key) => (typeof filter?.[key] === typeof EMPTY_FEED_FILTER[key] ? filter[key] : EMPTY_FEED_FILTER[key]);
  return { region: pick('region') || 'all', topic: pick('topic') || 'all', entity: pick('entity') || 'all', figure: !!pick('figure'), mine: !!pick('mine'), query: String(pick('query')).trim().slice(0, 80) };
}

export const isFeedFiltered = (filter) => Object.entries(normalizeFeedFilter(filter)).some(([, value]) => !inactive(value));

function passes(row, filter, skip = null) {
  for (const [name, test] of Object.entries(DIMENSIONS)) {
    if (name === skip || inactive(filter[name])) continue;
    if (!test(row, filter[name])) return false;
  }
  return true;
}

/** The rows that pass every choice of `filter`. */
export function applyFeedFilter(rows, filter) {
  const active = normalizeFeedFilter(filter);
  return (Array.isArray(rows) ? rows : []).filter((row) => passes(row, active));
}

/**
 * Every chip's live count. A chip counts the articles that would show if it were pressed with the other rows' choices
 * kept, so the counts of one row add up to its 전체 chip (an article without a region or topic is under 전체 only).
 * A chip with no article is left out unless it is the pressed one, which stays so the reader can release it.
 * Returns { region, topic, entity: [{ key, label, count, pressed, kind? }], figure, mine: { count, pressed } }.
 */
export function feedFacets(rows, filter, { entityLimit = FEED_ENTITY_LIMIT } = {}) {
  const active = normalizeFeedFilter(filter);
  const list = Array.isArray(rows) ? rows : [];
  const without = (name) => list.filter((row) => passes(row, active, name));
  const choices = (name, options, valueOf) => {
    const pool = without(name);
    const counted = options.map((option) => ({ key: option.key, label: option.label, count: pool.filter((row) => valueOf(row) === option.key).length, pressed: active[name] === option.key }));
    return [{ key: 'all', label: '전체', count: pool.length, pressed: active[name] === 'all' }, ...counted.filter((chip) => chip.count > 0 || chip.pressed)];
  };
  const entityPool = without('entity');
  const counts = new Map();
  for (const row of entityPool) for (const entity of row.entities) {
    const seen = counts.get(entity.key) || { key: entity.key, label: entity.label, kind: entity.kind, count: 0 };
    seen.count += 1;
    counts.set(entity.key, seen);
  }
  const ranked = [...counts.values()].sort((a, b) => b.count - a.count || (a.kind === b.kind ? 0 : a.kind === 'ticker' ? -1 : 1) || a.label.localeCompare(b.label));
  const entity = ranked.slice(0, entityLimit);
  if (active.entity !== 'all' && !entity.some((chip) => chip.key === active.entity)) {
    const pressed = counts.get(active.entity);
    const label = pressed?.label || active.entity.replace(/^[TK]:/, '');
    entity.push({ key: active.entity, label, kind: active.entity.startsWith('T:') ? 'ticker' : 'keyword', count: pressed?.count || 0 });
  }
  const toggle = (name) => ({ count: without(name).filter((row) => DIMENSIONS[name](row)).length, pressed: active[name] });
  return {
    region: choices('region', FEED_REGIONS, (row) => row.region),
    topic: choices('topic', FEED_TOPICS, (row) => row.topic),
    entity: [{ key: 'all', label: '전체', count: entityPool.length, pressed: active.entity === 'all' }, ...entity.map((chip) => ({ ...chip, pressed: chip.key === active.entity }))],
    figure: toggle('figure'),
    mine: toggle('mine')
  };
}

/** The three tiles over the shown rows: articles, articles with an extracted fact, and those whose fact is a figure. */
export function feedTiles(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return { articles: list.length, withFact: list.filter((row) => row.fact).length, withFigure: list.filter((row) => row.fact?.kind === '수치').length };
}
