// v59.42: news scoring, exclusion and selection — the one owner, moved from js/aio-data.js (scoreItem, classifyTopic,
// getSentimentFromText, isUnverifiedClaim, calcNewsImpactVector, the surface contracts and buildNewsSurfaceModel).
// Every keyword list goes through keyword-match.js, so a list can no longer pick its own rule (P2116 'nfl' in
// 'inflation', 'tax' in 'taxi', '핵' in '핵심'). Pure: what the classic code read from window comes in through `env`
// (src/app/news-selection-entry-points.js builds it). Formulas and thresholds are unchanged.
import { keywordHit, keywordMatcher, matchedKeywords, countKeywords } from './keyword-match.js';
import { keywordMayMatch, textPairs } from './keyword-prefilter.js';
import { classifyNewsTextStance } from './scoring.js';
import { reportIsUnconfirmed } from './report-verification.js';
import { MACRO_KW, TECH_KW, MED_KW, ANALYST_KW, NEWS_BLACKLIST_KW, TOPIC_KEYWORDS, FINANCE_RELEVANCE_KW } from './selection-keywords.js';

// Verb lists keep their tenses ('surged', 'plunged'), as the news stance model does.
const VERB_FORMS = { suffix: '(?:s|es|d|ed|ing)' };

export const isBlacklistedNewsText = keywordMatcher(NEWS_BLACKLIST_KW);

/** Sentiment of a headline: bull / bear / warn / neut (the news stance model in scoring.js). */
export function newsTextSentiment(text) {
  return classifyNewsTextStance(text);
}

/* ── v42.9: 미확인 소식통 감지 — 익명 소식통·교차검증 없는 기사 탐지 ── */
const UNVERIFIED_CLAIM_KW = [
  'sources say', 'sources said', 'sources told', 'source told',
  'people familiar', 'sources familiar', 'officials familiar',
  'according to people', 'people with knowledge', 'sources close to',
  'who asked not to be', 'who declined to be', 'speaking anonymously', 'speaking on condition',
  'unconfirmed report', 'unconfirmed claim',
  '소식통에 따르면', '소식통에 의하면', '익명의 관계자', '복수의 관계자',
  '복수의 소식통', '사정에 정통한', '알려진 바에 따르면'
];
const hasUnverifiedClaim = keywordMatcher(UNVERIFIED_CLAIM_KW);
// v59.45 (pipeline review P20-VERIFY-01): the shared report rule (rumour, chatter, anonymous source) and the producer's
// own 'unconfirmed' label decide too, so a headline the news bundle calls a rumour is never verified-current here.
export function isUnverifiedClaim(item) {
  if (item && String(item.verification || '').toLowerCase() === 'unconfirmed') return true;
  const text = (item.title || '') + ' ' + (item.desc || '') + ' ' + (item.summary || '') + ' ' + (item.translated || '');
  return hasUnverifiedClaim(text) || reportIsUnconfirmed(text);
}

/* ── classifyTopic(): 뉴스 토픽 분류 ── */
export function classifyTopic(item) {
  const text = ((item.title || '') + ' ' + (item.desc || '')).toLowerCase();
  let bestTopic = 'general';
  let bestScore = 0;
  Object.entries(TOPIC_KEYWORDS).forEach(([topic, keywords]) => {
    const hits = keywords.filter((kw) => keywordHit(text, kw)).length; // P1428: 'AI' not inside 'said', 'Meta' not inside 'metal'
    if (hits > bestScore) {
      bestScore = hits;
      bestTopic = topic;
    }
  });
  // P563/R254: 소스 제공 topics 태그는 우리 TOPIC_KEYWORDS 어휘에 실제로 있는 값이고 자체 매칭이 0건일 때만 채택한다.
  // 그렇지 않으면 정직하게 'general'로 둔다 (SCOTUS 기사가 소스의 넓은 'AI Policy' 분류만으로 반도체·AI가 되던 문제).
  if (bestScore === 0 && item.topics && item.topics.length > 0 && Object.prototype.hasOwnProperty.call(TOPIC_KEYWORDS, item.topics[0])) {
    bestTopic = item.topics[0];
  }
  return bestTopic;
}

const IMPACT_FACTORS = [
  ['RATES_INFLATION', 25, ['fed', 'fomc', 'rate', 'yield', 'inflation', 'cpi', 'pce', 'goolsbee', 'musalem', 'wash', '금리', '물가', '인플레', '연준']],
  ['AI_INFRA_SEMI', 22, ['gpu', 'semiconductor', 'hbm', 'ai infrastructure', 'inference', 'token', 'data center', 'nebius', 'eigen', '반도체', '추론', '데이터센터']],
  ['POLICY_TRADE', 20, ['tariff', 'trade', 'export control', 'sanction', '관세', '수출통제', '제재']],
  ['EARNINGS', 18, ['earnings', 'guidance', 'revenue', 'margin', '실적', '가이던스']],
  ['ENERGY', 14, ['oil', 'crude', 'energy', '원유', '에너지']],
];
const MOMENTUM_UP_KW = ['breakout', 'new high', 'melt-up', 'melt up', 'meltup', 'rally', 'surge', '신고가', '돌파', '급등'];
const DOWNSIDE_RISK_KW = ['sell-off', 'sell off', 'selloff', 'breakdown', 'below', 'plunge', '급락', '이탈', '붕괴'];
const EXIT_RISK_KW = ['overheat', 'mania', 'climax', 'bubble', '과열', '버블', '헤지', 'trim'];

export function calcNewsImpactVector(item, env = {}) {
  item = item || {};
  const text = ((item.title || '') + ' ' + (item.desc || '') + ' ' + (item.summary || '')).toLowerCase();
  const topic = item.topic || classifyTopic(item);
  const sent = newsTextSentiment(text);
  let tickers = [];
  try { tickers = env.extractTickers ? env.extractTickers(item) : (item.tickers || []); } catch (e) { tickers = item.tickers || []; }
  let factor = 'GENERAL';
  let urgency = 20;
  let technicalImpact = 'NEUTRAL';
  const portfolioImpact = tickers.length ? 'CHECK_POSITION_EXPOSURE' : 'BROAD_MARKET';
  const hit = IMPACT_FACTORS.find(([, , keywords]) => keywords.some((kw) => keywordHit(text, kw)));
  if (hit) { factor = hit[0]; urgency += hit[1]; }
  if (MOMENTUM_UP_KW.some((kw) => keywordHit(text, kw, VERB_FORMS))) technicalImpact = 'MOMENTUM_UP';
  if (DOWNSIDE_RISK_KW.some((kw) => keywordHit(text, kw, VERB_FORMS))) technicalImpact = 'DOWNSIDE_RISK';
  if (EXIT_RISK_KW.some((kw) => keywordHit(text, kw, VERB_FORMS))) technicalImpact = 'EXIT_RISK';
  if (sent === 'bear' || sent === 'warn') urgency += 10;
  if (item.tier === 1) urgency += 10;
  urgency = Math.max(0, Math.min(100, urgency));
  return { tickerImpact: tickers.slice(0, 8), factor, technicalImpact, portfolioImpact, urgency, sentiment: sent, topic };
}

/* ── scoreItem(): 뉴스 중요도 스코어링 (0~100+) ────────────────
   기관 리서치 데스크 기준: 1) 키워드 매칭 (매크로 > 테크 > 실적 > 분석) 2) 소스 신뢰도 (Tier 가중치)
   3) 신선도 (시간 감쇄) 4) 티커 언급 부스트 5) 중복/스팸 패널티 */
const PREMIUM_SOURCES = ['Reuters','Bloomberg','WSJ','CNBC','MarketWatch','FT Markets','S&P Global','Barrons',
  'CNN','NYT','BBC','Seeking Alpha','Yahoo Finance','Investing.com','Benzinga','The Block','Defense One',
  'Nikkei Asia','SCMP','AP Business','Nasdaq','Forbes','Business Insider','Morningstar','The Economist',
  'Kitco','DL News','CoinDesk','SemiAnalysis','TrendForce','Digitimes','EE Times'];
// v34.1c: 시장을 주도하는 핵심 종목에 대한 뉴스를 우선 노출
const MEGA_TICKERS = new Set([
  // US Mega Cap (시총 $500B+)
  'AAPL','MSFT','NVDA','GOOGL','GOOG','AMZN','META','TSLA','BRK.B','AVGO',
  'LLY','JPM','V','UNH','MA','XOM','COST','HD','PG','JNJ',
  // US 주도주/테마 대장주
  'AMD','SMCI','ARM','PLTR','MRVL','MU','QCOM','INTC','TSM','ASML',
  'COIN','MSTR','SQ','CRWD','SNOW','NET','DDOG','ZS','PANW',
  'LMT','RTX','NOC','GD','BA','HII','LHX',
  // 핵심 ETF/지수
  'SPY','QQQ','DIA','IWM','SOXX','SMH','XLE','XLF','XLK','GLD','TLT','VIX',
  // 한국 대장주
  '삼성전자','SK하이닉스','현대차','LG에너지솔루션','삼성바이오로직스','POSCO홀딩스',
  'NAVER','카카오','셀트리온','기아','한화에어로스페이스',
]);
const LARGE_TICKERS = new Set([
  'ORCL','CRM','ADBE','NOW','UBER','ABNB','SHOP','SQ','RBLX',
  'NKE','DIS','NFLX','PYPL','BABA','PDD','JD','SE','GRAB',
  'CVX','COP','SLB','OXY','DVN','HAL','MPC','VLO','PSX',
  'GS','MS','C','BAC','WFC','AXP','BLK','SCHW','ICE',
  'PFE','MRK','ABBV','TMO','ABT','ISRG','REGN','MRNA','VRTX',
  'CAT','DE','GE','HON','MMM','UNP','UPS','FDX',
  'WMT','TGT','LOW','MCD','SBUX','CMG','YUM',
  'DELL','HPE','WDC','STX','ON','MCHP','TXN','ADI','KLAC','LRCX','AMAT',
]);
const URGENT_KW = ['crash','surge','plunge','soar','spike','collapse','record high','record low',
  '급등','급락','폭락','폭등','사상최고','사상최저','긴급','속보','breaking'];
// v39.0: 시장 영향력 있는 인물의 발언·인터뷰·연설은 높은 중요도
const KEY_FIGURES = ['powell','yellen','lagarde','jensen huang','tim cook','elon musk',
  'satya nadella','lisa su','altman','sam altman','dario amodei','greg brockman','demis hassabis','ilya sutskever',
  'buffett','dimon','dalio','ackman','druckenmiller',
  'trump','biden','xi jinping','putin',
  'mark zuckerberg','sundar pichai','andy jassy','pat gelsinger','sanjay mehrotra',
  'lloyd austin','austin','jake sullivan',
  '파월','옐런','젠슨 황','일론 머스크','올트먼','샘 올트먼','다리오 아모데이','버핏','트럼프','시진핑','푸틴',
  '사티아 나델라','리사 수','마크 저커버그','순다르 피차이','팻 겔싱어','앤디 재시','산제이 메흐로트라'];
const SPEECH_KW = ['says','said','interview','speech','remarks','testimony','hearing',
  'conference','keynote','told','warns','expects','sees','calls for','announces',
  '발언','인터뷰','연설','기자회견','증언','청문','담화','언급','경고','전망','선언'];
// v40.4: 5대 우선 토픽 (매크로/지정학/주식/외환/채권) — 시장에 직접 영향
const PRIORITY_KW = [
  // 매크로/경제
  'gdp','cpi','ppi','pce','employment','unemployment','payroll','fomc','fed fund','rate cut','rate hike',
  'inflation','deflation','recession','soft landing','hard landing','stagflation',
  '경제성장','물가','고용','실업','금리','인플레이션','디플레이션','경기침체','스태그플레이션',
  // 지정학
  'tariff','sanction','embargo','trade war','export control','chip ban','liberation day',
  'iran','ukraine','taiwan strait','south china sea','nato','missile','nuclear',
  '관세','제재','무역전쟁','수출규제','전쟁','미사일','핵',
  // 주식/시장
  'earnings','revenue','eps','guidance','buyback','dividend','ipo','spac','m&a','acquisition',
  'bull market','bear market','correction','crash','rally','breakout','all-time high',
  '실적','매출','순이익','자사주','배당','상장','인수','합병','폭락','폭등','사상최고',
  // 외환
  'dollar','yen','euro','yuan','won','currency','forex','exchange rate','dxy',
  '달러','엔화','유로','위안','원화','환율',
  // 채권/금리
  'treasury','yield','bond','credit spread','yield curve','inversion',
  '국채','수익률','채권','크레딧 스프레드','수익률 곡선',
  // v48.18 (integrate 2026-04-18): AI 인프라 공급 가시성
  'mtia','meta mtia','tpu roadmap','lta','long-term agreement','custom silicon',
  'vera rubin','rubin cpx','nvlink fusion','cx9','blackwell ultra',
  // 메모리 패러다임
  'hbf','high bandwidth flash','hbm+hbf','inference memory','3계층 메모리',
  '메모리 lta','메모리 슈퍼사이클','hbm 점유',
  // DC 규제 + 전력
  'data center ban','dc moratorium','maine dc','grid connection delay','data center regulation',
  '데이터센터 금지','전력망 부하','온사이트 발전','wartsila','34sg engine',
  // 머스크 테라팹 + 장비주
  'terafab','테라팹','applied materials','tokyo electron','lam research',
  // Google 2026 이벤트
  'google cloud next','google i/o','marketing live','brandcast','ask maps','gemini 3.5',
  // AI 보안 표준화
  'glasswing','project glasswing','openai tac','trust access for cyber','gpt-5.4 cyber',
  // 위성 통신
  'globalstar','amazon leo','project kuiper','d2d','direct-to-device','low earth orbit',
  // 자산배분/로테이션
  'data dependence','forward guidance failure','2% inflation target','mid-inflation',
  '중물가','데이터 디펜던스','이익 확산','quality rotation',
  // v50.15 (텔레그램 통합): 최신 AI 인프라/메모리/소버린 AI 토픽
  'ai factory','ai 팩토리','sovereign ai','소버린 ai','socamm','vera cpu','vera rubin','kyber',
  'hbm4','hbm4e','hbm5','lpddr6','agentic ai','에이전트 ai','physical ai','피지컬 ai',
  'memory shortage','메모리 부족','dram shortage','asic','tpu','positioning unwind','포지셔닝 청산',
  'rate cut withdrawn','금리인하 철회','memory super-cycle','메모리 슈퍼사이클','data center power','데이터센터 전력',
  'hormuz','호르무즈','red sea','홍해','houthi','후티','lng fid','exaone','blackwell','rubin',
];
// v40.4: 정치/시사 키워드가 있지만 시장 연관 키워드가 없으면 대폭 감점
const POLITICS_ONLY_KW = ['election','vote','poll','campaign','congress','senate','legislation','bill passed',
  '선거','투표','여론조사','국회','국정감사','법안','탄핵','청문회','대통령실','비서실',
  'supreme court','abortion','immigration','gun control','death penalty',
  '이민','총기','사형','낙태','인권','시위','집회','데모'];
// v46.6: "대통령 AI 보조금 발표", "반도체 규제 완화" 같은 금융영향 정책 뉴스는 정치 감점에서 뺀다
const POLICY_KW = ['보조금','규제','정책','세금','감세','증세','관세','수출규제','수출통제',
  'subsidy','regulation','policy','tax','tariff','export control','sanction','stimulus',
  'antitrust','legislation','executive order','행정명령','법안'];
const SPAM_KW = ['sponsored','advertisement','promoted','partner content','editorial','opinion piece'];
// v39.2: 클릭베이트/투자 스팸 감지 — 소거법 (패턴 매칭 즉시 차단)
const CLICKBAIT_RE = /(\d+배|\d+x\b|텐배거|대박주|급등주|폭등 예고|급등 임박|10x|100x|next tesla|next nvidia|must buy|guaranteed return|millionaire|get rich|won't believe|don't miss|last chance|놓치면 후회|지금이 마지막|마지막 기회|수익률 보장|원금 보장|100% 수익|이 주식만|이 종목만|반드시 사야|무조건 사야|리딩방|시크릿|비밀 종목|숨겨진 종목|아무도 모르는|전문가만 아는|삼성 잡는|애플 잡는|엔비디아 잡는|best stock.?to buy|stocks? to buy now|hidden gem|secret stock|penny stock|easy money|yolo stock|to the moon|explosive growth potential)/i;
// 광범위 한국어 키워드('기업','수출','에너지' 등)만으로 통과한 경우 — 지방정부 보도자료 패턴
const KR_BROAD_KW = ['기업','수출','수입','에너지','산업','경제','금융','은행','시장','무역'];
// v31.8: 제목에 금융과 전혀 무관한 패턴이 있으면 차단
const NON_FINANCE_TITLE_PATTERNS = [
  /how to (?:cook|bake|clean|fix|decorate|style|dress)/,
  /best (?:phones|laptops|tablets|headphones|cameras|shows|movies|songs|books|games|apps|gifts|deals)/,
  /top \d+ (?:tips|tricks|ways|things|reasons|places|destinations|recipes)/,
  /review[:\s]|unboxing|hands[- ]on|first look/,
  /(?:wedding|birthday|anniversary|holiday|christmas|halloween|valentine)/,
  // v34.1b: 한국 지방정부 기사 패턴 (제목에서 지자체가 주어)
  /^(?:울주군|울산시|강원도|전남도|경남도|충남도|충북도|경북도|전북도|제주도|합천군|산청군|나주시|정선군|영월군|태백시|양양군|횡성군|평창군)/,
  /(?:군|시|도),\s*(?:올해|내년|금년|이번|신규|지역|도내|관내)/,
  // 한국 업무협약/행사/모집 패턴
  /업무협약|양해각서|mou\s*체결|협약식|체결식/,
  /선착순\s*모집|참가자\s*모집|수강생\s*모집/,
  /일자리\s*(?:창출|사업|대책|계획)|공공근로/,
  // 한국 인사/임명 패턴
  /\[인사\]|인사이동|보직변경|전보발령/,
  /(?:사장|원장|이사장|회장)\s*(?:\d+연임|취임|퇴임|이취임)/,
  // 영문 순수 비금융 패턴 (정치 제거 — 무역/관세/금융정책과 공존 가능하므로)
  /(?:governor|mayor)\s+(?:signs|vetoes|declares)\s+(?!.*(?:tax|budget|tariff|trade))/,
  // v38.3 B5: 한국어 비금융 패턴 추가
  /오늘의?\s*날씨|기상\s*(?:청|특보)|(?:폭우|폭설|한파|폭염)\s*(?:주의보|경보)/,
  /(?:축구|야구|농구|배구|골프)\s*(?:결과|경기|시즌|감독)/,
  /건강\s*(?:관리|검진|보험|증진)|의료\s*(?:봉사|지원|서비스)/,
  /입학\s*(?:식|설명회)|졸업\s*(?:식|축하)|학교\s*(?:폭력|급식|운영)/,
  /교통\s*(?:사고|정체|통제|우회)|도로\s*(?:공사|정비|개통)/,
  /(?:실종|수색|구조|신원)\s*(?:아동|노인|신고|확인)/,
  /(?:보이스피싱|전화사기|스미싱|피싱)\s*(?:피해|주의|예방)/,
  /(?:동물원|수족관|놀이공원|워터파크)\s*(?:개장|입장|이벤트)/,
  /(?:결혼|돌잔치|장례|제사|명절)\s*(?:준비|비용|선물)/,
  /(?:미용|피부|성형|다이어트|헬스)\s*(?:클리닉|시술|관리)/,
];

// v46.6: 키워드 길이 가중치 — 영문: 1글자=0.3, 2글자=0.6, 3-4글자=1.0, 5글자+=1.3 / CJK: 1글자=0.5, 2글자=0.9, 3글자+=1.0
function keywordWeight(kw) {
  const l = kw.length;
  if (/[가-힯一-鿿぀-ヿ]/.test(kw)) return l <= 1 ? 0.5 : l <= 2 ? 0.9 : 1.0;
  return l <= 1 ? 0.3 : l <= 2 ? 0.6 : l <= 4 ? 1.0 : 1.3;
}
// 제목 발견 시 1.5배 가중 — 제목 키워드가 본문보다 핵심 토픽임
function weightedHits(list, title, desc, pairs) {
  let hits = 0;
  list.forEach((kw) => {
    if (!keywordMayMatch(kw, pairs)) return;
    if (keywordHit(title, kw)) hits += keywordWeight(kw) * 1.5;
    else if (keywordHit(desc, kw)) hits += keywordWeight(kw);
  });
  return hits;
}

// v59.45 (pipeline review P20-CACHE-01): the key carries every input of the cached (time-free) part — a richer summary,
// a new tier or country is a new entry — and the freshness points are added on each call, so a long-open tab no longer
// keeps a five-day-old article at its first-hour score.
function scoreCacheKey(item) {
  return [item.title || '', item.source || '', item.pubDate || '', item.desc || '', item.tier ?? '', item.country || '', item.verification || ''].join('|');
}
function freshnessPoints(item, env) {
  if (!item.pubDate) return 0;
  const ageH = ((env.now ? env.now() : Date.now()) - new Date(item.pubDate).getTime()) / 3600000;
  if (ageH <= 1) return 20;
  if (ageH <= 6) return 12;
  if (ageH <= 24) return 5;
  if (ageH <= 72) return 0;
  return -Math.min((ageH - 72) / 24, 15); // 3일 이후: 하루당 -1, 최대 -15
}

/**
 * Importance score of one article (0–100+); sets item._tickerMentions, item._scoreReasons, item.impactVector and,
 * for an excluded article, item._blacklisted. env: { extractTickers(item), now(), cache: { get, set } }.
 */
export function scoreItem(item, env = {}) {
  const cache = env.cache || null;
  const extractTickers = env.extractTickers || ((i) => i.tickers || []);
  // `rest` is the score without the freshness points (null for an excluded article, which always scores 0).
  const put = (score, rest = null) => {
    if (item && !item.impactVector) item.impactVector = calcNewsImpactVector(item, env);
    if (cache) cache.set(scoreCacheKey(item), { s: score, rest, tm: item._tickerMentions || 0, bl: !!item._blacklisted, sr: item._scoreReasons || [] });
    return score;
  };
  // A row scored again starts unexcluded; only this scoring sets the flag (a stale flag must not outlive a changed row).
  if (item) delete item._blacklisted;
  if (cache) {
    const cached = cache.get(scoreCacheKey(item));
    if (cached !== null && cached !== undefined) {
      item._tickerMentions = cached.tm;
      if (cached.bl) item._blacklisted = true;
      item._scoreReasons = cached.sr || [];
      item.impactVector = calcNewsImpactVector(item, env);
      return cached.bl || !Number.isFinite(cached.rest) ? cached.s : Math.max(0, Math.round(cached.rest + freshnessPoints(item, env)));
    }
  }

  let score = 0;
  const scoreReasons = [];
  const text = ((item.title || '') + ' ' + (item.desc || '')).toLowerCase();

  // ── 1. 키워드 매칭 점수 (v42.5: 제목 가중치 + 키워드 길이 가중치) ──
  const titleLow = (item.title || '').toLowerCase();
  const descLow = (item.desc || '').toLowerCase();
  const pairs = textPairs(titleLow + '\n' + descLow); // P1901: keywords whose first letters are absent are skipped
  const macroHits = weightedHits(MACRO_KW, titleLow, descLow, pairs);
  const techHits = weightedHits(TECH_KW, titleLow, descLow, pairs);
  const medHits = weightedHits(MED_KW, titleLow, descLow, pairs);
  const analystHits = weightedHits(ANALYST_KW, titleLow, descLow, pairs);

  // v30.12 P2: 로그 스케일 + 밀도 기반 점수 (키워드 나열 역전 방지)
  score += Math.min(Math.round(Math.log2(macroHits + 1) * 16), 40);   // 1→16, 2→25, 4→32, 8→40
  score += Math.min(Math.round(Math.log2(techHits + 1) * 12), 30);    // 1→12, 2→19, 4→24
  score += Math.min(Math.round(Math.log2(medHits + 1) * 6), 15);      // 1→6, 2→10, 4→12
  // v43.4: 애널리스트 소폭 보너스 (목표주가/등급 변경은 투자 정보), 최대 +3
  score += Math.min(analystHits, 1) * 3;

  // v30.12: 키워드 밀도 보너스 — 짧은 텍스트에 핵심 키워드 집중 = 높은 점수
  const totalHits = macroHits + techHits + medHits;
  const wordCount = text.split(/\s+/).length;
  if (wordCount > 0 && totalHits > 0) {
    const density = totalHits / wordCount;
    if (density > 0.15) score += 5;
    else if (density > 0.05) score += 2;
  }

  // ── 2. 소스 신뢰도 가중치 ──
  score += ({ 1: 15, 2: 8, 3: 3 })[item.tier] || 0;
  if (PREMIUM_SOURCES.some((s) => (item.source || '').includes(s))) score += 5;
  // v34.1c: US Tier1 외신 최우선, 한국은 콘텐츠 품질로만 판단
  if (item.country === 'us' && item.tier === 1) score += 12;
  else if (item.country !== 'kr' && item.tier === 1) score += 8;
  else if (item.country !== 'kr' && item.tier === 2) score += 4;
  if (item.country === 'kr' && item.tier === 2) score += 3; // v46.6: US 편향 완화
  if (item.country === 'kr' && item.tier === 3) score -= 5; // v38.3 B3: 비금융 기사 유입 가능성 높은 소스
  if ((item.source || '').includes('구글뉴스')) score += 4; // v29.1

  // ── 3. 신선도 감쇄 (freshnessPoints; not cached) ──
  const freshness = freshnessPoints(item, env);
  score += freshness;

  // ── 4. 티커 언급 부스트 (v30.12: 오탐 방지 — extractTickers 재사용) ──
  const foundTickers = extractTickers(item);
  const tickerMentions = foundTickers.length;
  const titleText = (item.title || '');
  foundTickers.forEach((ticker) => {
    const re = new RegExp('\\b' + ticker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
    score += re.test(titleText) ? 4 : 2;
  });
  item._tickerMentions = tickerMentions;
  const finRelevance = macroHits + techHits + medHits + tickerMentions;
  if (foundTickers.length > 0) {
    const hasMega = foundTickers.some((t) => MEGA_TICKERS.has(t));
    const hasLarge = foundTickers.some((t) => LARGE_TICKERS.has(t));
    if (hasMega) score += 8;
    else if (hasLarge) score += 4;
    if (analystHits > 0) { // v43.4: 대형주 목표주가·등급 변경 — 시장 임팩트
      if (hasMega) score += 10;
      else if (hasLarge) score += 5;
    }
  }

  // ── 5. 감정 강도 부스트 (극단적 표현) ──
  score += 3 * countKeywords(text, URGENT_KW, VERB_FORMS);
  // ── 5b. v39.0: 핵심 인물 발언/인터뷰 부스트 ──
  const hasKeyFigure = KEY_FIGURES.some((kw) => keywordHit(text, kw));
  if (hasKeyFigure) {
    score += 8;
    if (SPEECH_KW.some((kw) => keywordHit(text, kw))) score += 7;
  }
  // ── 5c. v40.4: 5대 우선 토픽 부스트 ──
  const priorityHits = countKeywords(text, PRIORITY_KW);
  if (priorityHits >= 3) score += 15;
  else if (priorityHits >= 1) score += 5;
  // ── 5d. v40.4/v46.6: 비시장 정치/시사 뉴스 강력 감점 (정책/규제 키워드는 예외) ──
  const politicsHits = countKeywords(text, POLITICS_ONLY_KW);
  const hasPolicyKW = POLICY_KW.some((kw) => keywordHit(text, kw));
  if (politicsHits > 0 && priorityHits === 0 && finRelevance <= 1.5 && !hasPolicyKW) score -= 25;

  // ── 6. 중복/스팸 패널티 ──
  score -= 20 * countKeywords(text, SPAM_KW);
  if (CLICKBAIT_RE.test(text)) {
    item._blacklisted = true;
    return put(0);
  }

  // ── v34.1c: 3단계 뉴스 선별 — 주식/금융 키워드가 함께 있으면 통과(정치 기사여도), 전혀 없으면 차단(어떤 소스여도)
  // STEP 1: 하드 블랙리스트 — 금융 관련성이 충분하면(finRelevance >= 3) 감점만 하고 통과 ("아파트 REIT 투자")
  if (isBlacklistedNewsText(text)) {
    if (finRelevance >= 3) score -= 10;
    else {
      item._blacklisted = true;
      return 0;
    }
  }
  // STEP 2: 금융 관련성 게이트 — v42.5: 가중치 히트 < 0.5 (짧은 키워드 1개 단독 히트 = 차단)
  if (finRelevance < 0.5) {
    const finKwMatches = matchedKeywords(text, FINANCE_RELEVANCE_KW);
    if (finKwMatches.length === 0) {
      item._blacklisted = true;
      return 0;
    }
    const allBroad = finKwMatches.every((kw) => KR_BROAD_KW.includes(kw));
    if (allBroad && finKwMatches.length <= 3) { // v38.3 B2: 광범위 KW 3개까지도 차단
      item._blacklisted = true;
      return 0;
    }
    score -= (allBroad ? 20 : 10);
  }
  const titleLower = (item.title || '').toLowerCase();
  if (NON_FINANCE_TITLE_PATTERNS.some((pat) => pat.test(titleLower))) {
    item._blacklisted = true;
    return put(0);
  }

  if (macroHits > 0) scoreReasons.push('macroHits=' + Math.round(macroHits * 10) / 10);
  if (techHits > 0) scoreReasons.push('techHits=' + Math.round(techHits * 10) / 10);
  if (medHits > 0) scoreReasons.push('medHits=' + Math.round(medHits * 10) / 10);
  if (analystHits > 0) scoreReasons.push('analystHits=' + Math.round(analystHits * 10) / 10);
  if (item.tier != null) scoreReasons.push('tier=' + item.tier);
  if (foundTickers.length) scoreReasons.push('tickers=' + foundTickers.slice(0, 5).join(','));
  if (priorityHits > 0) scoreReasons.push('priorityHits=' + priorityHits);
  if (hasKeyFigure) scoreReasons.push('keyFigure');
  if (isUnverifiedClaim(item)) {
    score -= 8;
    scoreReasons.push('unverified=-8');
  }
  if ((item.title || '').length < 15) { // 너무 짧은 제목 (스팸 가능성)
    score -= 10;
    scoreReasons.push('shortTitle=-10');
  }
  item._scoreReasons = scoreReasons.slice(0, 10);
  return put(Math.max(0, Math.round(score)), score - freshness);
}

/* ── 화면별 선별 (v50.2: home / briefing / market-news 공용 계약 + 분석 화면 토픽 줄) ── */
export const NEWS_TOPIC_GROUP_ORDER = [
  { key:'macro',     label:'거시·경제',       icon:'' },
  { key:'geo',       label:'국제 정치·지정학',  icon:'' },
  { key:'market-note',label:'시장 노트',         icon:'' },
  { key:'equity',    label:'주식·시장',         icon:'' },
  { key:'semi',      label:'반도체·AI',         icon:'' },
  { key:'ai-policy', label:'AI 정책·규제',       icon:'' },
  { key:'optical',   label:'광학·인터커넥트',    icon:'' },
  { key:'power',     label:'전력·그리드',        icon:'' },
  { key:'memory',    label:'메모리',             icon:'' },
  { key:'materials', label:'소재·부품',          icon:'' },
  { key:'earnings',  label:'실적·기업',         icon:'' },
  { key:'energy',    label:'원자재·에너지',     icon:'' },
  { key:'bond',      label:'채권·금리',         icon:'' },
  { key:'credit',    label:'크레딧·자금조달',   icon:'' },
  { key:'fx',        label:'외환·통화',         icon:'' },
  { key:'crypto',    label:'암호화폐',          icon:'' },
  { key:'defense',   label:'방산·우주',         icon:'' },
  { key:'healthcare',label:'헬스케어·바이오',   icon:'' },
  { key:'shipbuilding',label:'조선·해운',       icon:'' },
  { key:'quantum',   label:'양자컴퓨팅',        icon:'' },
  { key:'analyst',   label:'애널리스트',        icon:'' },
  { key:'space',     label:'우주·위성',         icon:'' },
  { key:'general',   label:'기타 뉴스',         icon:'' }
];

export const NEWS_SURFACE_CONTRACTS = {
  home: {
    surfaceId: 'home',
    role: 'core-market-judgment',
    newsCyclePolicy: 'kst-0800-completed-24h',
    anchor: '08:00 KST',
    windowHours: 24,
    maxItems: 4, minCount: 4, maxPerTopic: 1, // P1380: one 71-point item used to satisfy the cascade and fill the whole surface
    minScoreCascade: [90, 70, 50],
    excludedTopics: ['analyst'],
    staleStaticPolicy: 'reference-only',
    sortMode: 'market-impact'
  },
  briefing: {
    surfaceId: 'briefing',
    role: 'kst-0800-24h-decision-briefing',
    newsCyclePolicy: 'kst-0800-completed-24h',
    anchor: '08:00 KST',
    windowHours: 24,
    maxItems: 40,
    minScore: 45,
    aiPolicy: 'verified-current-only',
    reviewPolicy: 'secondary-stale-unverified-to-review'
  },
  'market-news': {
    surfaceId: 'market-news',
    role: 'kst-0800-24h-exploration-and-filtering',
    newsCyclePolicy: 'kst-0800-completed-24h',
    anchor: '08:00 KST',
    windowHours: 24,
    maxItems: 150,
    minScore: 30,
    allowFilters: true,
    sortMode: 'ui'
  },
  // v50.41: 분석 페이지를 같은 뉴스 캐시에 토픽 필터로 연결 — topics는 classifyTopic 실존 키만 쓴다.
  macro:       { surfaceId: 'macro',       role: 'analysis-page-topic-strip', newsCyclePolicy: 'kst-0800-completed-24h', anchor: '08:00 KST', windowHours: 24, maxItems: 6, minScore: 35, topics: ['macro','geo','market-note','credit','ai-policy','power','energy'], sortMode: 'score' },
  fxbond:      { surfaceId: 'fxbond',      role: 'analysis-page-topic-strip', newsCyclePolicy: 'kst-0800-completed-24h', anchor: '08:00 KST', windowHours: 24, maxItems: 6, minScore: 35, topics: ['macro','geo','market-note','credit','bond','fx','fxbond'],        sortMode: 'score' },
  technical:   { surfaceId: 'technical',   role: 'analysis-page-topic-strip', newsCyclePolicy: 'kst-0800-completed-24h', anchor: '08:00 KST', windowHours: 24, maxItems: 6, minScore: 35, topics: ['semi','optical','power','memory','materials','market-note'], sortMode: 'score' },
  themes:      { surfaceId: 'themes',      role: 'analysis-page-topic-strip', newsCyclePolicy: 'kst-0800-completed-24h', anchor: '08:00 KST', windowHours: 24, maxItems: 8, minScore: 35, topics: ['semi','optical','power','memory','materials','ai-policy','credit','energy','space','crypto','equity'], sortMode: 'score' },
  sentiment:   { surfaceId: 'sentiment',   role: 'analysis-page-topic-strip', newsCyclePolicy: 'kst-0800-completed-24h', anchor: '08:00 KST', windowHours: 24, maxItems: 6, minScore: 35, topics: ['macro','geo','market-note','credit','crypto','equity','ai-policy'], sortMode: 'score' },
  signal:      { surfaceId: 'signal',      role: 'analysis-page-topic-strip', newsCyclePolicy: 'kst-0800-completed-24h', anchor: '08:00 KST', windowHours: 24, maxItems: 6, minScore: 35, topics: ['macro','geo','market-note','credit','semi','optical','power','memory'], sortMode: 'score' },
  fundamental: { surfaceId: 'fundamental', role: 'analysis-page-topic-strip', newsCyclePolicy: 'kst-0800-completed-24h', anchor: '08:00 KST', windowHours: 24, maxItems: 8, minScore: 35, topics: ['earnings','equity','analyst','semi','optical','power','memory','materials','ai-policy','credit'], sortMode: 'score' },
  breadth:     { surfaceId: 'breadth',     role: 'analysis-page-topic-strip', newsCyclePolicy: 'kst-0800-completed-24h', anchor: '08:00 KST', windowHours: 24, maxItems: 6, minScore: 35, topics: ['semi','macro','market-note','credit','equity','crypto','memory'], sortMode: 'score' }
};

export function newsPubMs(item) {
  const raw = item && (item.pubDate || item.eventTime || item.publishedAt || item.observedAt);
  const t = raw ? new Date(raw).getTime() : 0;
  return isNaN(t) ? 0 : t;
}

export function newsSourceTier(item) {
  if (item && item.tier != null && isFinite(Number(item.tier))) return Number(item.tier);
  const src = String(item && item.source || '');
  // v59.45 (pipeline review P20-TIER-01): whole names only — "Software News" is not FT, "Investinghub" not Investing.com.
  if (/\b(?:Reuters|Bloomberg|Associated Press|AP News|Financial Times|Wall Street Journal|WSJ)\b/i.test(src) || /\bFT\b/.test(src)) return 1;
  if (/\b(?:CNBC|MarketWatch|Barron's|Barrons?|Yahoo Finance|Investing\.com|Seeking Alpha|Economist|NYT|Nikkei|Yonhap|Naver)\b/i.test(src)) return 2;
  if (/^TG\s|Telegram/i.test(src) || item && (item._tgChannel || item.tgSlug)) return 4;
  return 3;
}

function newsTopicLabel(topic) {
  const row = NEWS_TOPIC_GROUP_ORDER.find((t) => t.key === topic);
  return row ? row.label : (topic || 'general');
}

function newsId(item) {
  const seed = String(item && (item.link || item.guid || item.title || '') || '') + '|' + String(item && item.source || '') + '|' + String(item && item.pubDate || '');
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  return 'news-' + Math.abs(h);
}

/** The dedupe key of an article: the story key when stories.js is wired in, else its identifying fields. */
export function newsDedupeKey(item, env = {}) {
  return env.stories ? env.stories.key(item) : JSON.stringify([item.source, item.link || item.guid, item.title, item.desc, item.pubDate]);
}

/** Excluded by the blacklist: scored as excluded, or a listed keyword in the title, the displayed title or the body. */
export function isNewsBlacklisted(item, env = {}) {
  if (!item || item._blacklisted) return true;
  let shown = '';
  try { shown = env.displayTitle ? env.displayTitle(item) || '' : ''; } catch (_) { shown = ''; }
  return isBlacklistedNewsText((item.title || '') + ' ' + shown + ' ' + (item.desc || ''));
}

/** Company news: a ticker and a company topic (v46.9 covers every TOPIC_KEYWORDS topic). */
export function isCompanyNews(item, env = {}) {
  const companyTopics = ['equity','earnings','semi','analyst','defense','healthcare','shipbuilding','space','quantum','crypto'];
  const marketOnlyTopics = ['macro','geo','bond','fx']; // 시장 전용 토픽 (티커 있어도 기업 뉴스 아님)
  const tickers = env.displayTickers ? env.displayTickers(item) : (item.tickers || []);
  if (marketOnlyTopics.indexOf(item.topic) !== -1) return false;
  if (tickers.length > 0 && companyTopics.indexOf(item.topic) !== -1) return true;
  if (tickers.length > 0 && item.topic === 'energy') return true; // XOM, CVX 등 에너지 기업
  if (tickers.length > 0 && item.topic === 'general') return true;
  if (item.topic === 'earnings' || item.topic === 'analyst') return true;
  return false;
}

export function newsVerificationStatus(item, ageHours, contract) {
  const tier = newsSourceTier(item);
  const stale = !isFinite(ageHours) || ageHours > (contract.windowHours || 48);
  const tg = !!(item && (item._tgChannel || item.tgSlug || /^TG\s/i.test(item.source || '')));
  let unverified = false;
  try { unverified = isUnverifiedClaim(item); } catch (_) {}
  if (stale) return 'stale';
  if (unverified) return 'unverified';
  if (tg || tier >= 4) return 'secondary-only';
  // A reputable publisher authenticates the source, not an absent article body. Headline-only RSS rows remain useful
  // for discovery but cannot become verified narrative/causal evidence or an AI-summary input without a summary.
  if (String(item && item.contentDepth || '').toLowerCase() === 'headline-only') return 'headline-only';
  if (tier <= 2) return 'verified-current';
  return 'current';
}

/** The news cycle a contract reads: explicit opts, the published server cut, or the client's own KST 08:00 cycle. */
export function newsCycleWindow(contract, opts = {}, env = {}) {
  if (opts.windowStart != null && opts.windowEnd != null) {
    return { start: opts.windowStart, end: opts.windowEnd, anchorDate: opts.anchorDate || '' };
  }
  const meta = (env.serverMeta && env.serverMeta()) || {};
  if (contract && contract.newsCyclePolicy === 'kst-0800-completed-24h' && meta.newsCycleStart && meta.newsCycleEnd) {
    const smStart = new Date(meta.newsCycleStart).getTime();
    const smEnd = new Date(meta.newsCycleEnd).getTime();
    const smGeneratedMs = meta.generatedAt ? new Date(meta.generatedAt).getTime() : NaN;
    const smAgeH = isFinite(smGeneratedMs) ? ((env.now ? env.now() : Date.now()) - smGeneratedMs) / 3600000 : Infinity;
    const cutSlaHours = 12;
    let sharedCut = null;
    try { sharedCut = env.sharedCut ? env.sharedCut() : null; } catch (_) {}
    // A fresh generatedAt is only the refresh attempt clock. The news window may use the shared cut only after the
    // market cycle itself was published; otherwise a failed publish/LKG snapshot could relabel old headlines as current.
    const publishedCycle = meta.marketCyclePublished === true && meta.marketSnapshotPublished === true && meta.cycleStatus === 'PUBLISHED';
    const serverCutFresh = publishedCycle && (sharedCut
      ? sharedCut.usable === true
      : meta.liveCoreEligible === true && isFinite(smAgeH) && smAgeH >= 0 && smAgeH <= cutSlaHours);
    if (isFinite(smStart) && isFinite(smEnd) && smEnd > smStart && serverCutFresh) {
      return { start: smStart, end: smEnd, anchorDate: meta.newsCycleLabel || '' };
    }
  }
  const bw = contract && contract.newsCyclePolicy === 'kst-0800-completed-24h' && env.briefingWindow ? env.briefingWindow() : null;
  if (!bw) return null;
  return { start: bw.start, end: bw.end, anchorDate: bw.anchorDate ? bw.anchorDate.toISOString().slice(0, 10) : '' };
}

function inclusionReason(row, surfaceId) {
  const topic = newsTopicLabel(row.topic);
  const tier = row.sourceTier ? ('Tier ' + row.sourceTier) : 'source';
  if (surfaceId === 'home') return 'Score ' + row.score + ', ' + topic + ', ' + tier;
  if (surfaceId === 'briefing') return '08:00 KST 24h, Score ' + row.score + ', ' + row.verificationStatus;
  return 'Score ' + row.score + ', ' + topic + ', ' + row.verificationStatus;
}

export function normalizeNewsItem(surfaceId, item, contract, nowMs, cycleWindow, env = {}) {
  const pubMs = newsPubMs(item);
  const futurePublication = pubMs > nowMs + 5 * 60 * 1000;
  const ageHours = pubMs && !futurePublication ? Math.max(0, Math.round((nowMs - pubMs) / 3600000 * 10) / 10) : Infinity;
  let inNewsCycle = !!(cycleWindow && pubMs && pubMs >= cycleWindow.start && pubMs < cycleWindow.end);
  const itemCycleStart = item && item.newsCycleStart ? new Date(item.newsCycleStart).getTime() : 0;
  const itemCycleEnd = item && item.newsCycleEnd ? new Date(item.newsCycleEnd).getTime() : 0;
  const serverCycleTrusted = !!(item && item._serverBackstop && item.newsCyclePolicy === contract.newsCyclePolicy && isFinite(itemCycleStart) && isFinite(itemCycleEnd) && itemCycleEnd > itemCycleStart && nowMs - itemCycleEnd <= (contract.windowHours || 24) * 3600000
    // v59.45 (pipeline review P20-TIME-01): a completed cycle has ended; one that ends in the future is not trusted.
    && itemCycleEnd <= nowMs + 5 * 60 * 1000); // P1403: only the latest cycle (an older one restored a 43h-old headline as current)
  if (!inNewsCycle && serverCycleTrusted && pubMs && !futurePublication && pubMs >= itemCycleStart && pubMs < itemCycleEnd) inNewsCycle = true;
  const statusAgeHours = inNewsCycle && !futurePublication && contract.newsCyclePolicy === 'kst-0800-completed-24h' ? Math.min(ageHours, contract.windowHours || 24) : ageHours;
  let tickers = [];
  try { tickers = env.displayTickers ? env.displayTickers(item) : (item.tickers || []); } catch (_) { tickers = item && item.tickers || []; }
  const row = Object.assign({}, item || {});
  row.newsId = row.newsId || newsId(item);
  row.title = row.title || '';
  row.source = row.source || '';
  row.pubDate = row.pubDate || null;
  row.ageHours = ageHours;
  row.newsCyclePolicy = row.newsCyclePolicy || contract.newsCyclePolicy || null;
  if (cycleWindow && contract.newsCyclePolicy === 'kst-0800-completed-24h') {
    row.newsCycleStart = row.newsCycleStart || new Date(cycleWindow.start).toISOString();
    row.newsCycleEnd = row.newsCycleEnd || new Date(cycleWindow.end).toISOString();
    row.inNewsCycle = inNewsCycle;
  }
  row.serverCycleTrusted = serverCycleTrusted;
  const cut = env.sharedCut ? env.sharedCut() : null;
  row.marketCutStatus = (cut && cut.status) || 'unknown';
  row.score = Number(row.score || 0);
  row.topic = row.topic || 'general';
  row.tickers = Array.isArray(tickers) ? tickers : [];
  const bodyText = String(row.summary || row.desc || row.description || '').trim();
  row.contentDepth = row.contentDepth || (bodyText.length >= 40 ? 'summary' : 'headline-only');
  row.sourceTier = newsSourceTier(row);
  row.verificationStatus = newsVerificationStatus(row, statusAgeHours, contract);
  row.staleStatus = row.verificationStatus === 'stale' ? 'stale' : 'current-window';
  row.sourcePolicy = surfaceId === 'briefing' ? contract.aiPolicy : 'surface-contract';
  row.inclusionReason = inclusionReason(row, surfaceId);
  row.eligibleForAi = !futurePublication && row.contentDepth !== 'headline-only'
    && (row.verificationStatus === 'verified-current' || (row.verificationStatus === 'current' && row.sourceTier <= 2));
  const windowHours = Number(contract.windowHours || 48);
  const withinWindow = !futurePublication && (inNewsCycle || (isFinite(ageHours) && ageHours <= windowHours));
  const currentStatus = row.verificationStatus !== 'stale'
    && row.verificationStatus !== 'unverified'
    && row.verificationStatus !== 'secondary-only'
    && withinWindow;
  row.currentEvidence = {
    observedAt: pubMs && !futurePublication ? new Date(pubMs).toISOString() : null,
    fetchedAt: row.newsFetchedAt || row.serverGeneratedAt || null,
    ageHours: isFinite(ageHours) ? ageHours : null,
    inNewsCycle,
    withinWindow,
    current: currentStatus,
    verificationStatus: row.verificationStatus,
    eligibleForAi: row.eligibleForAi,
    reason: futurePublication ? 'publication-time-in-future' : !pubMs ? 'publication-time-missing' : !withinWindow ? 'publication-outside-current-window' : row.verificationStatus
  };
  return row;
}

function applyNewsFilterOptions(rows, opts, env) {
  const controls = (env.controls && env.controls()) || {};
  let filtered = rows;
  const cf = String(opts.countryFilter || controls.countryFilter || 'all').toLowerCase();
  if (cf && cf !== 'all') {
    if (cf === 'asia') {
      const ASIA_COUNTRIES = ['jp','cn','hk','tw','sg','in','qa'];
      filtered = filtered.filter((i) => ASIA_COUNTRIES.indexOf(String(i.country || '').toLowerCase()) !== -1);
    } else if (cf === 'eu') {
      filtered = filtered.filter((i) => ['eu','uk'].indexOf(String(i.country || '').toLowerCase()) !== -1);
    } else if (cf === 'tg') {
      // v59.45 (R2-02): the producer stores the channel slug ('fastdesk') in _tgChannel; any truthy value is a channel row.
      filtered = filtered.filter((i) => !!i._tgChannel || /^TG\s/i.test(i.source || '') || !!i.tgSlug);
    } else {
      filtered = filtered.filter((i) => String(i.country || '').toLowerCase() === cf);
    }
  }
  const tf = opts.topicFilter || controls.topicFilter || 'all';
  // v57.77: 'company' (기업 chip) is the one distinct filter the retired type tabs carried — a named company is the subject.
  if (tf === 'company') filtered = filtered.filter((i) => isCompanyNews(i, env));
  else if (tf && tf !== 'all') filtered = filtered.filter((i) => i.topic === tf || (i.topics && i.topics.indexOf(tf) >= 0));
  return filtered;
}

function newsEmptyReason(surfaceId, stats) {
  if (!stats.inputCount) return 'no-input-news';
  if (!stats.withinWindowCount) return 'all-news-outside-time-window';
  if (!stats.afterScoreCount) return 'below-score-threshold-or-policy-excluded';
  if (surfaceId === 'market-news') return 'filters-removed-all-eligible-news';
  return 'no-verified-current-news-for-surface-policy';
}

/**
 * What one news surface shows from `items`. env: { displayTickers, displayTitle, stories: { key, group, isRevision },
 * controls(), serverMeta(), sharedCut(), briefingWindow(), lastFetch(), now() }.
 */
export function buildNewsSurfaceModel(surfaceId, items, opts = {}, env = {}) {
  const contract = NEWS_SURFACE_CONTRACTS[surfaceId];
  if (!contract) throw new Error('Unknown news surface: ' + surfaceId);
  const stories = env.stories || null;
  const isRevision = (row) => !!(stories && stories.isRevision(row));
  const dedupeKey = (row) => newsDedupeKey(row, env);
  const nowMs = Number(opts.nowMs || (env.now ? env.now() : Date.now()));
  const cycleWindow = newsCycleWindow(contract, opts, env);
  const input = Array.isArray(items) ? items : [];
  const normalized = input.filter((i) => !isNewsBlacklisted(i, env))
    .map((i) => normalizeNewsItem(surfaceId, i, contract, nowMs, cycleWindow, env));
  let windowRows = normalized.filter((row) => {
    if (cycleWindow) {
      const t = newsPubMs(row);
      return row.inNewsCycle || (t >= cycleWindow.start && t < cycleWindow.end);
    }
    return row.ageHours <= (contract.windowHours || 48);
  });
  // P1164/B03: 오늘 창에 든 건수와 창 밖에 남은 과거 수집분을 분리해 보존한다 ('오늘 자료 미확보 · 이전 수집분 N건').
  const outOfWindowCount = normalized.length - windowRows.length;
  if (surfaceId === 'home') windowRows = windowRows.filter((i) => contract.excludedTopics.indexOf(i.topic) === -1);
  if (surfaceId === 'market-news') windowRows = applyNewsFilterOptions(windowRows, opts, env);
  // v50.41: 분석 페이지 토픽 필터 (contract.topics) — 같은 캐시에서 페이지별 관련 토픽만
  if (contract.topics && contract.topics.length) windowRows = windowRows.filter((i) => contract.topics.indexOf(i.topic) >= 0);

  let scored = windowRows;
  if (contract.minScoreCascade) {
    // P2115: count what can still be shown — one row per dedupe key and at most maxPerTopic per topic. Counting raw rows
    // let four 90-point stories on one topic stop the cascade, and the topic cap then left a single headline on home.
    const showable = (rows) => {
      if (!contract.maxPerTopic) return rows.length;
      const keys = {}, perTopic = {};
      return rows.filter((i) => {
        const key = dedupeKey(i) || i.newsId, topic = i.topic || 'other';
        if (keys[key]) return false;
        keys[key] = true;
        perTopic[topic] = (perTopic[topic] || 0) + 1;
        return perTopic[topic] <= contract.maxPerTopic;
      }).length;
    };
    scored = [];
    contract.minScoreCascade.some((th) => {
      scored = windowRows.filter((i) => i.score >= th);
      return showable(scored) >= Math.min(contract.minCount || 1, showable(windowRows));
    });
  } else {
    scored = windowRows.filter((i) => i.score >= (contract.minScore || 0));
  }

  // P1601: explicit corrections survive score selection and remain individually reachable.
  windowRows.filter(isRevision).forEach((row) => { if (scored.indexOf(row) < 0) scored.push(row); });
  if (stories) {
    const selectedKeys = new Set(scored.map(dedupeKey));
    scored = stories.group(windowRows).filter((story) => story.storyArticles.some((row) => selectedKeys.has(dedupeKey(row)))).flatMap((story) => story.storyArticles);
  }
  let duplicateRemoved = 0;
  const seen = {};
  let deduped = [];
  scored.forEach((row) => {
    const key = dedupeKey(row) || row.newsId;
    if (seen[key]) { duplicateRemoved++; return; }
    seen[key] = true;
    deduped.push(row);
  });

  if (surfaceId === 'home') {
    deduped.forEach((i) => {
      i._surfaceScore = i.score + (['macro','geo','bond','fx','energy'].indexOf(i.topic) >= 0 ? 20 : 0) + (i.sourceTier <= 2 ? 8 : 0);
      i.inclusionReason = inclusionReason(i, surfaceId);
    });
    deduped.sort((a, b) => (b._surfaceScore || 0) - (a._surfaceScore || 0));
  } else if (surfaceId === 'market-news' && (opts.sortMode || ((env.controls && env.controls()) || {}).sortMode || 'time') === 'time') {
    deduped.sort((a, b) => {
      const ta = newsPubMs(a), tb = newsPubMs(b);
      const bucketA = Math.floor(ta / 1800000), bucketB = Math.floor(tb / 1800000);
      if (bucketA !== bucketB) return bucketB - bucketA;
      return (b.score || 0) - (a.score || 0);
    });
  } else {
    deduped.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  if (contract.maxPerTopic) {
    const perTopic = {};
    deduped = deduped.filter((i) => { const t = i.topic || 'other'; perTopic[t] = (perTopic[t] || 0) + 1; return perTopic[t] <= contract.maxPerTopic || isRevision(i); });
  }
  const visible = deduped.slice(0, contract.maxItems || deduped.length);
  deduped.filter(isRevision).forEach((i) => { if (visible.indexOf(i) < 0) visible.push(i); });
  const reviewItems = surfaceId === 'briefing' ? deduped.filter((i) => !i.eligibleForAi) : [];
  const aiItems = surfaceId === 'briefing' ? visible.filter((i) => i.eligibleForAi) : visible;
  const latestPubMs = visible.reduce((max, i) => Math.max(max, newsPubMs(i)), 0);
  const sourceSet = {};
  visible.forEach((i) => { sourceSet[i.source || 'unknown'] = true; });
  const stats = {
    inputCount: input.length,
    normalizedCount: normalized.length,
    withinWindowCount: windowRows.length,
    outOfWindowCount,
    afterScoreCount: scored.length,
    visibleCount: visible.length,
    duplicateRemoved
  };
  return {
    surfaceId,
    contract,
    items: visible,
    eligibleItems: deduped,
    aiItems,
    reviewItems: reviewItems.slice(0, 12),
    visibleCount: visible.length,
    eligibleCount: deduped.length,
    staleCount: normalized.filter((i) => i.staleStatus === 'stale').length,
    unverifiedCount: visible.filter((i) => i.verificationStatus === 'unverified' || i.verificationStatus === 'secondary-only').length,
    duplicateRemoved,
    sourceCount: Object.keys(sourceSet).length,
    lastFetch: (env.lastFetch && env.lastFetch()) || null,
    latestPubDate: latestPubMs ? new Date(latestPubMs).toISOString() : null,
    newsCycle: cycleWindow ? { start: new Date(cycleWindow.start).toISOString(), end: new Date(cycleWindow.end).toISOString(), anchorDate: cycleWindow.anchorDate || '' } : null,
    cacheKey: surfaceId + '|' + (cycleWindow && cycleWindow.anchorDate || opts.anchorDate || '') + '|' + visible.map((i) => i.newsId).join(',') + '|' + (latestPubMs || 0),
    emptyReason: visible.length ? null : newsEmptyReason(surfaceId, stats),
    outOfWindowCount,
    stats,
    generatedAt: new Date(nowMs).toISOString()
  };
}

/** Score buckets, topics, sources, tiers and per-surface eligibility of `items` (the 뉴스 선별 audit). */
export function newsSelectionAudit(items, env = {}) {
  const sourceItems = Array.isArray(items) ? items : [];
  const nowMs = typeof env.now === 'function' ? env.now() : Date.now();
  const audit = {
    generatedAt: new Date().toISOString(),
    checked: sourceItems.length,
    scoreBuckets: { gte90: 0, gte70: 0, gte50: 0, gte30: 0, lt30: 0 },
    topics: {},
    sources: {},
    tiers: {},
    verification: { 'verified-current': 0, current: 0, 'headline-only': 0, 'secondary-only': 0, unverified: 0, stale: 0 }, // newsVerificationStatus names
    homeEligible: 0,
    briefingEligible: 0,
    marketNewsEligible: 0,
    scoreReasons: {},
  };
  sourceItems.forEach((item) => {
    let score = Number(item && item.score);
    if (!isFinite(score)) {
      try { score = scoreItem(item, env); } catch (_) { score = 0; }
    }
    const topic = item && (item.topic || classifyTopic(item)) || 'general';
    const source = String(item && item.source || 'unknown');
    const tier = String(newsSourceTier(item));
    // v59.42: the row's age against the 뉴스 page window (it was passed none, so every row counted as stale).
    const ageHours = (nowMs - newsPubMs(item)) / 3600000;
    const status = newsVerificationStatus(item, ageHours, NEWS_SURFACE_CONTRACTS['market-news']);
    const reasons = Array.isArray(item && item._scoreReasons) ? item._scoreReasons : [];
    if (score >= 90) audit.scoreBuckets.gte90++;
    else if (score >= 70) audit.scoreBuckets.gte70++;
    else if (score >= 50) audit.scoreBuckets.gte50++;
    else if (score >= 30) audit.scoreBuckets.gte30++;
    else audit.scoreBuckets.lt30++;
    audit.topics[topic] = (audit.topics[topic] || 0) + 1;
    audit.sources[source] = (audit.sources[source] || 0) + 1;
    audit.tiers[tier] = (audit.tiers[tier] || 0) + 1;
    audit.verification[status] = (audit.verification[status] || 0) + 1;
    reasons.slice(0, 5).forEach((reason) => { audit.scoreReasons[reason] = (audit.scoreReasons[reason] || 0) + 1; });
  });
  // Eligibility is counted only when the caller passes buildSurface (see src/app/news-selection-entry-points.js).
  const build = env.buildSurface;
  if (build) {
    try { audit.homeEligible = build('home', sourceItems, {}).items.length; } catch (_) {}
    try { audit.briefingEligible = build('briefing', sourceItems, {}).items.length; } catch (_) {}
    try { audit.marketNewsEligible = build('market-news', sourceItems, {}).items.length; } catch (_) {}
  }
  return audit;
}

// v59.42 coverage pass: how well a Telegram post answers an AI-chat question (js/aio-chat.js ranks the digest's broad
// items with it). The tickers, tags and shared topic words compare under the one keyword rule; '엔' stands alone or as
// 엔화/엔저/엔고, so '엔비디아' is not the yen.
const TELEGRAM_QUERY_KW = ['반도체', '메모리', 'mlcc', '금리', '코스피', 'ai', 'etf', '목표주가', '달러', '엔', '엔화', '엔저', '엔고', '상향', '하향'];
export function telegramItemQueryRelevance(item, query) {
  const q = String(query || '').toLowerCase();
  const text = String((item && (item.text || item.summary)) || '').toLowerCase();
  let rel = 0;
  for (const ticker of Array.isArray(item && item.tickers) ? item.tickers : []) if (ticker && keywordHit(q, String(ticker).toLowerCase())) rel += 4;
  for (const tag of Array.isArray(item && item.tags) ? item.tags : []) if (tag && keywordHit(q, String(tag).toLowerCase())) rel += 2;
  for (const kw of TELEGRAM_QUERY_KW) if (keywordHit(q, kw) && keywordHit(text, kw)) rel += 1;
  return rel;
}
