import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const port = 8898;
const server = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((ok, fail) => {
  const t = setTimeout(ok, 1800);
  server.stdout.on('data', d => { if (String(d).includes('AIO local server')) { clearTimeout(t); ok(); } });
  server.on('error', fail);
});

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route('**/*', r => r.request().url().startsWith(`http://127.0.0.1:${port}/`) ? r.continue() : r.abort());
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.AIO && window.CHAT_CONTEXTS && typeof window.updateAIPanelContext === 'function', { timeout: 30000 });

  const report = await page.evaluate(() => {
    const routes = ['home','signal','breadth','sentiment','briefing','market-news','technical','screener','ticker','portfolio','themes','theme-detail','macro','fxbond','fundamental','options','kr-home','kr-supply','kr-themes','kr-macro','kr-technical','guide'];
    const map = {home:'home',signal:'signal',breadth:'breadth',sentiment:'sentiment',briefing:'briefing','market-news':'market-news',technical:'technical',screener:'screener',ticker:'ticker',portfolio:'portfolio',themes:'themes','theme-detail':'theme-detail',macro:'macro',fxbond:'fxbond',fundamental:'fundamental',options:'options','kr-home':'kr-home','kr-supply':'kr-supply','kr-themes':'kr-themes','kr-macro':'kr-macro','kr-technical':'kr-tech'};
    const requirements = {
      home: [['regime','국면|레짐|market state'],['crossAsset','VIX.*(DXY|10Y|금리)|DXY.*VIX'],['breadth','breadth|브레드'],['news','뉴스|news'],['action','행동|액션|action']],
      signal: [['score','스코어|점수|score'],['breadth','브레드|breadth'],['execution','진입|실행|execution|lockout'],['risk','손절|리스크|risk']],
      breadth: [['participation','시장폭|브레드|breadth'],['ma','20.*50.*200|이동평균|SMA'],['divergence','다이버전스|괴리|divergence'],['action','확인|행동|action']],
      sentiment: [['fg','F&G|공포.*탐욕'],['vix','VIX'],['positioning','AAII|NAAIM|put.?call|PCR'],['action','행동|대응|action']],
      briefing: [['news','뉴스|news'],['macro','매크로|macro'],['schedule','일정|calendar|release'],['action','행동|action']],
      'market-news': [['source','출처|source'],['age','시간|기준일|fetched|age'],['impact','영향|impact'],['verification','검증|교차확인|verify']],
      technical: [['ohlcv','OHLCV|거래량'],['indicators','RSI.*MACD|MACD.*RSI'],['trend','추세|Stage|이동평균'],['levels','지지|저항|support|resistance'],['risk','손절|무효화|risk']],
      screener: [['universe','유니버스|universe'],['factor','팩터|factor'],['rank','랭크|순위|rank'],['coverage','결측|coverage|가용'],['validation','백테스트|검증|validation']],
      ticker: [['quote','현재가|시세|price|quote'],['technical','RSI|MACD|추세'],['fundamental','재무|밸류|valuation'],['event','뉴스|어닝|SEC|event'],['risk','리스크|무효화|손절']],
      portfolio: [['holdings','보유|포트폴리오|position'],['weight','비중|weight|allocation'],['risk','상관|drawdown|VaR|리스크'],['suitability','투자기간|손실 감내|risk tolerance|목적'],['action','리밸런싱|축소|헤지|action']],
      themes: [['rotation','RRG|로테이션|rotation'],['leader','리더|주도주|leader'],['breadth','브레드|breadth'],['regime','국면|사이클|regime']],
      'theme-detail': [['selected','선택.*테마|현재.*테마|theme detail'],['leader','리더|주도주|leader'],['catalyst','촉매|카탈리스트|catalyst'],['risk','리스크|무효화|risk']],
      macro: [['inflation','CPI|PCE|인플레'],['labor','NFP|실업|고용'],['growth','GDP|PMI|성장'],['rates','Fed|FOMC|금리'],['calendar','일정|release|calendar']],
      fxbond: [['curve','수익률곡선|yield curve|2Y|10Y'],['fx','DXY|USD.KRW|환율'],['credit','HYG|스프레드|credit'],['carry','캐리|carry'],['action','행동|전략|action']],
      fundamental: [['filing','SEC|10-K|8-K'],['financials','매출|마진|현금흐름|financial'],['valuation','PER|PBR|EV.EBITDA|밸류'],['earnings','어닝|실적|earnings'],['confidence','신뢰|confidence|한계']],
      options: [['chain','옵션체인|option chain|행사가'],['iv','IV|내재변동성'],['greeks','Delta|Gamma|Theta|그릭'],['positioning','GEX|open interest|미결제'],['risk','손실|리스크|만기']],
      'kr-home': [['index','KOSPI|KOSDAQ'],['flow','외국인|기관|수급'],['fx','원.달러|KRW'],['regime','국면|레짐|시장']],
      'kr-supply': [['flow','외국인|기관|개인|수급'],['program','프로그램|선물'],['fx','원.달러|환율'],['action','확인|대응|action']],
      'kr-themes': [['theme','테마'],['leader','주도주|대장주|리더'],['flow','수급|외국인|기관'],['export','수출|반도체|방산|조선']],
      'kr-macro': [['bok','한국은행|한은|BOK'],['inflation','CPI|물가'],['exports','수출|무역'],['fx','원.달러|환율'],['calendar','일정|금통위|release']],
      'kr-technical': [['ohlcv','OHLCV|거래량'],['indicators','RSI|MACD|이동평균'],['trend','추세|Stage'],['levels','지지|저항'],['risk','손절|무효화|리스크']]
    };
    const normalize = s => String(s || '');
    const rows = [];
    for (const route of routes) {
      const ctxId = map[route] || null;
      let prompt = '', promptError = '';
      const ctx = ctxId && window.CHAT_CONTEXTS[ctxId];
      try { if (ctx) prompt = normalize(typeof ctx.system === 'function' ? ctx.system() : ctx.system); } catch (e) { promptError = e.message; }
      window.updateAIPanelContext(route);
      const activeCtx = window._aiCurrentCtx;
      const disabled = !!document.getElementById('ai-panel-inp')?.disabled;
      const chips = Array.from(document.querySelectorAll('#ai-panel-chips .ai-chip')).map(x => x.textContent.trim());
      const req = requirements[route] || [];
      const checks = req.map(([axis, pattern]) => ({ axis, pass: new RegExp(pattern, 'i').test(prompt) }));
      const staleDates = prompt.match(/202[0-5][-.년/]\s*\d{1,2}(?:[-.월/]\s*\d{1,2})?/g) || [];
      const actionTerms = (prompt.match(/매수|매도|손절|목표가|비중|추가매수|buy|sell|stop|target/gi) || []).length;
      rows.push({ route, ctxId, ctxExists: !!ctx, activeCtx, enabled: !disabled, promptError, promptChars: prompt.length, requiredPass: checks.filter(x=>x.pass).length, requiredTotal: checks.length, missingAxes: checks.filter(x=>!x.pass).map(x=>x.axis), chipCount: chips.length, chips, staleDateTokenCount: staleDates.length, staleDateSamples: [...new Set(staleDates)].slice(0,6), actionTerms });
    }
    const texts = {};
    Object.keys(window.CHAT_CONTEXTS).forEach(id => { try { texts[id] = normalize(typeof window.CHAT_CONTEXTS[id].system === 'function' ? window.CHAT_CONTEXTS[id].system() : window.CHAT_CONTEXTS[id].system); } catch {} });
    return {
      generatedAt: new Date().toISOString(),
      rows,
      totals: {
        routes: rows.length,
        enabled: rows.filter(r=>r.enabled).length,
        missingContext: rows.filter(r=>r.ctxId && !r.ctxExists).map(r=>r.route),
        promptErrors: rows.filter(r=>r.promptError).map(r=>r.route),
        allAxesPass: rows.filter(r=>r.requiredTotal && r.requiredPass===r.requiredTotal).length,
        routesWithMissingAxes: rows.filter(r=>r.missingAxes.length).map(r=>({route:r.route,missing:r.missingAxes})),
        zeroChips: rows.filter(r=>r.ctxId && r.chipCount===0).map(r=>r.route),
        themesAndDetailIdentical: texts.themes === texts['theme-detail']
      }
    };
  });
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  server.kill();
}
