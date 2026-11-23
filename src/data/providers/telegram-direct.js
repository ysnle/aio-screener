import { keywordMatcher, matchedKeywords } from '../../domain/news/keyword-match.js';
import { isBlacklistedNewsText } from '../../domain/news/selection.js';

export function installTelegramCollector(window = globalThis) {
  // ── 텔레그램 메시지 관련성 필터 (주식/매크로/기관 리포트 선별) ────
  let tgExclude = null;
  function isTelegramMsgRelevant(text) {
    if (!text || text.length < 12) return false;
    const t = text.toLowerCase();
    const spamKW = ['광고','sponsored','ad ','join ','subscribe','홍보','이벤트 참여','click here',
      'giveaway','airdrop','free tokens','sign up','telegram bot','promo code','referral',
      '경품','추첨','텔레그램 봇','프로모션','레퍼럴',
      '무료 이벤트','무료 참여','무료 가입','무료 체험','무료 쿠폰','무료 배송'];
    const tgBlackKW = ['recipe','workout','dating','celebrity','movie review','game review',
      'horoscope','astrology','meme coin','shitcoin','pump signal','buy signal guaranteed',
      '연예','아이돌','드라마','맛집','운동법','별자리','밈코인','펌핑','100배'];
    tgExclude ||= keywordMatcher([...spamKW, ...tgBlackKW]);
    if (tgExclude(t) || isBlacklistedNewsText(t)) return false;
    const _TG_BROAD_KW = new Set(['space','market','report','note','stock','share','investment',
      'spending','cost','profit','launch','trade','bond','credit','flow','sector',
      '시장','기업','산업','경제','금융','수출','수입','에너지','투자']);
    // 관련성 키워드 (최소 1개 이상 포함해야 통과)
    const relevantKW = [
      // 영문 매크로/시장
      'fed','fomc','cpi','ppi','gdp','inflation','rate cut','rate hike','treasury','yield',
      'earnings','revenue','guidance','forecast','outlook','estimate','target','upgrade','downgrade',
      'tariff','trade war','sanction','geopolitical','recession','employment','payroll','jobs',
      'bull','bear','rally','sell-off','selloff','correction','volatility','vix',
      // 영문 섹터/산업
      'semiconductor','chip','ai ','artificial intelligence','nvidia','tsmc','samsung','apple','google',
      'amazon','microsoft','meta','tesla','bitcoin','crypto','oil','gold','commodity',
      'ipo','m&a','merger','acquisition','buyback','dividend',
      // 기관/리포트
      'goldman','morgan stanley','jpmorgan','barclays','citi','nomura','ubs','deutsche',
      'raymond james','wedbush','piper sandler','jefferies','bernstein','stifel',
      'report','research','note','analyst','rating','pt ','price target',
      'trump','biden','powell','yellen','lagarde','jensen huang','tim cook','elon musk',
      'altman','buffett','dimon','dalio','ackman','druckenmiller',
      'bond','credit','spread','duration','curve','inversion','steepening','flattening',
      'dollar','dxy','yen','euro','yuan','won','currency','forex','fx',
      'central bank','ecb','boj','boe','pboc','bok','monetary','fiscal',
      'pmi','ism','consumer confidence','retail sales','industrial production',
      'housing','permits','durable goods','trade balance','current account',
      'stock','share','equity','market cap','valuation','multiple','pe ratio',
      'profit','margin','ebitda','fcf','cash flow','balance sheet',
      'capex','investment','spending','cost cut','restructuring','layoff',
      'insider','13f','sec','filing','proxy','activist',
      'defense','military','weapon','arms','nuclear','uranium',
      'spacex','nasa','boeing','lockheed','northrop','raytheon','rocket lab','satellite','orbit',
      'launch','aerospace','space force','starship','falcon','pentagon','darpa','space','rocket',
      'battery','lithium','ev ','electric vehicle','solar','wind','hydrogen',
      'biotech','pharma','fda','clinical','pipeline','drug',
      'shipbuilding','shipping','freight','logistics','container',
      'short interest','options','futures','derivatives','hedge','swap',
      'dark pool','market maker','gamma','delta','theta',
      'breadth','advance','decline','new high','new low',
      'flow','inflow','outflow','rotation','sector',
      // 한국어
      '금리','인플레','기준금리','연준','실적','매출','가이던스','전망','목표가','상향','하향',
      '반도체','ai','엔비디아','삼성','애플','테슬라','비트코인','원유','금값',
      '관세','무역','제재','고용','실업','경기','침체','호황',
      '리포트','보고서','애널리스트','증권사','투자의견',
      '급등','급락','폭등','폭락','신고가','신저가','속보',
      '채권','국채','회사채','크레딧','스프레드','금통위','한국은행','통화정책',
      '환율','원달러','엔화','위안화','달러인덱스',
      '주식','주가','시장','코스피','코스닥','나스닥','다우',
      '영업이익','순이익','컨센서스','어닝','배당','자사주',
      '외국인','기관','수급','공매도','대차','신용',
      '방산','군수','조선','원전','2차전지','바이오','신약',
      '우주','로켓','위성','달 탐사','항공우주','발사체','궤도','스페이스','보잉',
      '록히드','레이시온','노스롭','한화에어로','NASA','펜타곤','방위비','국방부','스타링크',
      '트럼프','바이든','파월','옐런','젠슨 황','일론 머스크','올트먼','버핏','네타냐후','시진핑','푸틴',
      '오픈AI','데이터센터','클라우드','서버','GPU','HBM',
      '목표 주가','강력 매수','매수의견','비중확대',
      '수출','수입','무역수지','경상수지','PMI',
      '부양책','긴축','양적완화','테이퍼링','피봇',
      '日銀','金利','半導体','決算','為替','円安','円高','株価','市場',
      '利上げ','利下げ','景気','株式','投資','企業','収益','配当','防衛','宇宙','ロケット','衛星','原発','原子力',
    ];
    const matchedKW = matchedKeywords(t, relevantKW);
    if (matchedKW.length === 0) return false;
    // 매칭된 키워드 중 구체적(비광범위) 키워드가 1개 이상이면 통과
    const hasSpecificKW = matchedKW.some(kw => !_TG_BROAD_KW.has(kw));
    if (hasSpecificKW) return true;
    // 광범위 키워드만 매칭된 경우: 2개 이상이어야 통과
    return matchedKW.length >= 2;
  }

  async function fetchTelegramDirect(channelSlug, sourceName) {
    const tgUrl = `https://t.me/s/${channelSlug}`;
    let lastErr = null;
      try {
        const raw = await fetchViaProxy(tgUrl, { parseText:true, timeout:4000, totalTimeout:12000,
          accept: function(body) { return typeof body === 'string' && /tgme_widget_message_wrap|data-post=/.test(body); } });
        const parser = new DOMParser();
        const doc = parser.parseFromString(raw, 'text/html');
        const msgs = doc.querySelectorAll('.tgme_widget_message_wrap');
        if (!msgs.length) {
          // Telegram DOM 구조 변경 대비: 대체 셀렉터 시도
          const altMsgs = doc.querySelectorAll('[class*="message_wrap"], [data-post]');
          if (!altMsgs.length) {
            throw new Error('Telegram message markup unavailable');
          }
        }
        const msgEls = msgs.length ? msgs : doc.querySelectorAll('[class*="message_wrap"], [data-post]');
        const items = [];
        msgEls.forEach(wrap => {
          const textEl = wrap.querySelector('.tgme_widget_message_text, [class*="message_text"]');
          const dateEl = wrap.querySelector('time');
          const linkEl = wrap.querySelector('.tgme_widget_message_date, [class*="message_date"]');
          if (!textEl) return;
          const fullText = (textEl.innerText || textEl.textContent || '').trim();
          if (!fullText) return;
          // 관련성 필터: 주식/매크로/기관 리포트 관련 메시지만 선별
          if (!isTelegramMsgRelevant(fullText)) return;
          const title = fullText.slice(0, 200);
          // 원문 출처 추출 (채널명 대신 실제 외신사/기관명 사용)
          const originalSrc = extractOriginalSource(fullText);
          const displaySource = originalSrc
            ? `${originalSrc} (TG)`
            : `${sourceName}`;
          items.push({
            title,
            desc: fullText.slice(0, 280),
            link: linkEl ? (linkEl.getAttribute('href') || tgUrl) : tgUrl,
            pubDate: dateEl ? dateEl.getAttribute('datetime') : null,
            source: displaySource,
            feed: sourceName,
            tier: 1,
            flag: '',
            _tgChannel: channelSlug,
            _pipeline: 'telegram-fast-secondary',
            _verification: 'secondary-source',
          });
        });
        if (items.length) {
          console.log(`[AIO TG] ${sourceName}: ${items.length}건 수집`);
          return items.reverse(); // 최신 순
        }
      } catch(e) {
        lastErr = e;
        _debugWarn(`[AIO TG] ${sourceName} 수집 실패:`, e.message || e);
      }
    if (lastErr) _aioLog('warn', 'fetch', sourceName + ': 자료 연결 실패 ' + (lastErr.message || ''));
    return [];
  }

  window.isTelegramMsgRelevant = isTelegramMsgRelevant;
  window.fetchTelegramDirect = fetchTelegramDirect;
  return window;
}
