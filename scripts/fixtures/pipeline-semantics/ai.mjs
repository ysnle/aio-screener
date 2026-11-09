// scripts/fixtures/pipeline-semantics/ai.mjs — v59.45 pipeline review regressions (AI publication, action gate, tickers, research floor, chat screener, intent)
import assert from 'node:assert/strict';

const EVENT = '연준이 금리를 인하했고 신용 스트레스도 해소됐다.';
const priceRow = { evidenceId: 'audit-price', status: 'reference', source: 'audit-price-provider', asOf: '2026-10-27',
  metric: 'price', entity: 'AAPL', value: 100, unit: 'USD', allowedUse: 'reference' };
const textClaim = (text, extra = {}) => ({ claimId: 'c1', type: 'text', text, source: 'audit-price-provider', asOf: '2026-10-27',
  evidenceIds: ['audit-price'], status: 'verified', ...extra });

const gate = async (load) => {
  const { installAIRequestPipeline } = await load('src/ai/response/request-pipeline.js');
  const root = {};
  installAIRequestPipeline(root, {});
  return root._aioApplyAIActionGate;
};

const researchPlan = async (load, { minimumIndependentSources = 1, minimumPrimarySources = 1 } = {}) => {
  const { createResearchPlan } = await load('src/ai/research/plan.js');
  const decision = { requirement: 'REQUIRED', sourcePolicyId: 'company-primary', currentSensitive: true, maxResearchBudget: 2,
    minimumIndependentSources, minimumPrimarySources, decidedAt: '2026-10-28T12:00:00Z' };
  const questionPlan = { queryId: 'audit-q', query: 'AAPL latest earnings', market: 'US',
    entities: { entities: [{ symbol: 'AAPL', verified: true, market: 'US' }] }, researchDecision: decision };
  questionPlan.researchPlan = createResearchPlan({ questionPlan, decision, now: decision.decidedAt });
  return questionPlan;
};
const at = '2026-10-28T10:00:00Z';

export const cases = [
  { id: 'v59.52', name: 'chat sector and theme cues match words, not retail containing AI or a lowercase pronoun it', run: async ({ load }) => {
    const { runScreenerQuery, detectSectorQuery } = await load('src/ai/context/screener-query.js');
    const rows = [{ sym: 'NVDA', sector: 'Technology' }, { sym: 'WMT', sector: 'Consumer' }];
    assert.equal(detectSectorQuery('find retail companies', { rows }), null);
    assert.equal(runScreenerQuery('find it', { rows }), null);
    const retail = runScreenerQuery('best retail stocks', { rows, aliases: { ai: ['NVDA'] } });
    assert.ok(!retail.criteria.some((label) => /^테마=|^섹터=/.test(label)));
    assert.equal(runScreenerQuery('AI 종목', { rows, aliases: { ai: ['NVDA'] } }).rows[0].sym, 'NVDA');
    assert.equal(detectSectorQuery('find IT companies', { rows }).stocks[0].sym, 'NVDA');
    assert.equal(detectSectorQuery('find financials', { rows: [{ sym: 'JPM', sector: 'Financials' }] }).stocks[0].sym, 'JPM');
  } },
  { id: 'v59.54', name: 'the screener prompt prints the live quote by its own time, not by the stored close readiness', run: async ({ load }) => {
    const { runScreenerQuery, formatScreenerResultPrompt } = await load('src/ai/context/screener-query.js');
    const row = (sym, close) => ({ sym, name: sym, sector: 'Technology', signal: 'WATCH', rsi: 30, mcap: 500, price: 90,
      fieldReadiness: { fields: { 'price.close': { status: close }, 'price.rsi14': { status: 'CURRENT' }, 'valuation.marketCap': { status: 'CURRENT' } } } });
    const live = { AAA: { price: 101, pct: 1, observedAt: '2026-10-31T20:00:00Z' }, BBB: { price: 102, pct: 1, observedAt: '2026-10-31T20:00:00Z' } };
    const prompt = formatScreenerResultPrompt(runScreenerQuery('RSI 40 이하 종목', { rows: [row('AAA', 'MISSING'), row('BBB', 'STALE')], live }));
    assert.match(prompt, /AAA[^\n]*가격 \$101\.00 \(관측 2026-10-31T20:00:00Z\)/);
    assert.doesNotMatch(prompt, /price: STALE/);
  } },
  { id: 'v59.52', name: 'a broad stock ask creates a comparison sample without an invented recommendation score', run: async ({ load }) => {
    const { runScreenerQuery, formatScreenerResultPrompt } = await load('src/ai/context/screener-query.js');
    const rows = Array.from({ length: 24 }, (_, i) => ({ sym: `X${i}`, sector: `Sector${i % 6}`, signal: 'WATCH', rsi: 50, mcap: 20 }));
    const first = runScreenerQuery('종목 추천해줘', { rows, recentTickers: ['X0', 'X1'] });
    const changed = runScreenerQuery('종목 추천해줘', { rows: rows.map((row, i) => ({ ...row, rsi: i % 2 ? 10 : 90, mcap: i + 1, signal: 'BUY' })),
      live: Object.fromEntries(rows.map((row, i) => [row.sym, { pct: i % 2 ? 5 : -5 }])), recentTickers: ['X0', 'X1'] });
    assert.equal(first.purpose, 'comparison');
    assert.deepEqual(first.rows.map((row) => row.sym), changed.rows.map((row) => row.sym));
    const reordered = runScreenerQuery('종목 추천해줘', { rows: [...rows].reverse().map((row, i) => ({ ...row, rank: i })), recentTickers: ['X0', 'X1'] });
    assert.deepEqual(first.rows.map((row) => row.sym), reordered.rows.map((row) => row.sym));
    assert.ok(first.diversity.sectorCount >= 4);
    // v59.54: the order is day-seeded, so another day draws another sample, and no day hands every question the A-names.
    const dayA = runScreenerQuery('종목 추천해줘', { rows, sampleDay: '2026-11-01' }), dayB = runScreenerQuery('종목 추천해줘', { rows, sampleDay: '2026-11-02' });
    assert.deepEqual(dayA.rows.map((row) => row.sym), runScreenerQuery('종목 추천해줘', { rows: [...rows].reverse(), sampleDay: '2026-11-01' }).rows.map((row) => row.sym));
    assert.notDeepEqual(dayA.rows.map((row) => row.sym), dayB.rows.map((row) => row.sym));
    assert.ok(first.rows.every((row) => !['X0', 'X1'].includes(row.sym) && !('diversityScore' in row)));
    const prompt = formatScreenerResultPrompt(first);
    assert.doesNotMatch(prompt, /3~5개.*(?:골라|선택)|분산점수/);
    assert.match(prompt, /종목을 대신 고르지/);
  } },
  { id: 'v59.52', name: 'a queued chat draft stays visible after a failed script load and retries once', run: async ({ load }) => {
    const { installChatLoader } = await load('src/app/chat-loader.js');
    const scripts = [], input = { value: '보내려던 질문' };
    const doc = { readyState: 'complete', querySelector: () => null, getElementById: () => input,
      createElement: () => ({}), head: { appendChild: (script) => scripts.push(script) } };
    const root = { navigator: {}, requestIdleCallback: () => {}, AIO: {} };
    installChatLoader(root, doc);
    root.chatSendUnified(); root.chatSendUnified();
    assert.equal(input.value, '보내려던 질문');
    scripts[0].onerror();
    await Promise.resolve();
    assert.equal(input.value, '보내려던 질문');
    root.chatSendUnified();
    assert.equal(scripts.length, 2);
    const sent = [];
    root.chatSendUnified = () => { sent.push(input.value); input.value = ''; };
    scripts[1].onload();
    await root.AIO.loadChat();
    assert.deepEqual(sent, ['보내려던 질문']);
  } },
  { id: 'v59.52', name: 'chat screener filters and comparison labels respect canonical readiness and keep reference dates', run: async ({ load }) => {
    const { runScreenerQuery, formatScreenerResultPrompt, buildDiversifiedRecommendationRows, detectSectorQuery } = await load('src/ai/context/screener-query.js');
    const row = (status) => ({ sym: 'AAPL', name: 'Apple', sector: 'Technology', signal: 'WATCH', rsi: 25, mcap: 2, ret3m: 15, factorSessionDate: '2026-10-28',
      fieldReadiness: { fields: Object.fromEntries(['price.rsi14', 'valuation.marketCap', 'price.ret3m'].map((key) => [key, { status }])) } });
    for (const status of ['MISSING', 'UNSUPPORTED', 'BLOCKED_RIGHTS', 'STALE', 'LAST_GOOD', 'CONFLICT']) {
      assert.equal(runScreenerQuery('rsi 30 미만', { rows: [row(status)] }).totalMatched, 0, status);
      assert.equal(runScreenerQuery('소형주', { rows: [row(status)] }).totalMatched, 0, status);
      const sampled = buildDiversifiedRecommendationRows([row(status)], {}).rows[0];
      assert.equal(sampled.capBucket, 'unknown', status);
    }
    const allowed = runScreenerQuery('rsi 30 미만', { rows: [row('CURRENT')] });
    assert.equal(allowed.totalMatched, 1);
    assert.match(formatScreenerResultPrompt(allowed), /RSI 25/);
    const blocked = runScreenerQuery('기술주 찾아줘', { rows: [row('BLOCKED_RIGHTS')] });
    assert.doesNotMatch(formatScreenerResultPrompt(blocked), /RSI 25|시총 \$2B|3M \+15/);
    const stale = runScreenerQuery('기술주 찾아줘', { rows: [row('STALE')] });
    assert.match(formatScreenerResultPrompt(stale), /2026-10-28/);
    assert.match(formatScreenerResultPrompt(stale), /STALE/);
    const sectors = detectSectorQuery('기술주 찾아줘', { rows: [{ ...row('STALE'), mcap: 999 }, { ...row('CURRENT'), sym: 'MSFT' }] });
    assert.equal(sectors.stocks[0].sym, 'MSFT');
  } },
  { id: 'P11-AI-01', name: '가격 근거에 묶인 text claim의 무관한 현재 사건 문장은 공개하지 않는다', run: async ({ load }) => {
      const { createAnswerPlan } = await load('src/ai/response/claim-ledger.js');
      const { buildPublishableAnswerPlan } = await load('src/ai/response/publication.js');
      const { renderAnswerPlan } = await load('src/ai/response/renderer.js');
      const out = buildPublishableAnswerPlan(createAnswerPlan({ summary: EVENT, claims: [textClaim(EVENT)] }), [priceRow], true);
      assert.equal(out.plan.claims.claims.length, 0);
      assert.ok(out.droppedClaims.some((d) => d.reasons.includes('current-event-unverified')));
      assert.doesNotMatch(renderAnswerPlan(out.plan), /연준이 금리를 인하/);
  } },
  { id: 'P11-AI-01', name: '근거가 주체를 말하는 사건 text claim은 남고 수치와 다른 제목으로 표시된다', run: async ({ load }) => {
      const { createAnswerPlan } = await load('src/ai/response/claim-ledger.js');
      const { buildPublishableAnswerPlan } = await load('src/ai/response/publication.js');
      const { renderAnswerPlan } = await load('src/ai/response/renderer.js');
      const sentence = 'AAPL 주가가 실적 발표 뒤 상승했다.';
      const out = buildPublishableAnswerPlan(createAnswerPlan({ claims: [textClaim(sentence)] }), [priceRow], true);
      assert.equal(out.plan.claims.claims.length, 1);
      const text = renderAnswerPlan(out.plan);
      assert.match(text, /출처가 달린 해석/);
      assert.doesNotMatch(text, /확인된 수치/);
  } },
  { id: 'P11-AI-02', name: '인용 뒤에 이어진 새 매매 지시는 인용 예외로 면제되지 않는다', run: async ({ load }) => {
      const apply = await gate(load);
      const out = apply('오닐은 추세를 따라야 한다고 봤습니다 그래서 NVDA를 매수하세요.');
      assert.ok(out.replacedSentences > 0);
      assert.doesNotMatch(out.text, /NVDA를 매수하세요/);
      assert.ok(apply('NVDA를 매수하세요 오닐도 그렇게 한다고 봤습니다.').replacedSentences > 0);
  } },
  { id: 'P11-AI-02', name: '과거 규칙·이유 설명과 부정 지시는 그대로 둔다', run: async ({ load }) => {
      const apply = await gate(load);
      for (const sentence of ['오닐은 8% 하락하면 손절해야 한다고 봤습니다.', '손절해야 한다는 것이 오닐의 원칙입니다.',
        '분할 매수를 권장하는 이유는 평균 단가 위험을 줄이기 위해서입니다.', '매수를 추천하지 않습니다.',
        'He said that you should sell losers quickly.']) {
        assert.equal(apply(sentence).reasons.length, 0, sentence);
      }
      assert.ok(apply('손절은 177.50달러에서 하세요.').replacedSentences > 0);
  } },
  { id: 'P11-ENTITY-01', name: 'BRK.B 질문은 잘린 BRK 없이 BRK-B 하나만 고른다', run: async ({ load }) => {
      const { extractTickers } = await load('src/ai/entity/extract-tickers.js');
      const { resolveEntities } = await load('src/ai/entity/resolver.js');
      const { resolveChatTickers } = await load('src/ai/entity/chat-tickers.js');
      const query = 'BRK.B 실적 분석';
      const root = { AIO_TICKER_NAME_REGISTRY: { entries: { 'BRK-B': { en: 'Berkshire Hathaway Class B' } } } };
      const picked = resolveChatTickers({ query, questionPlan: { entities: resolveEntities(query, { root }) }, companiesOnly: true });
      assert.deepEqual([...picked], ['BRK-B']);
      assert.deepEqual(extractTickers('$BF.B 와 AAPL'), ['BF-B', 'AAPL']);
      assert.deepEqual(extractTickers('U.S. 경기와 IT-A 등급'), []);
  } },
  { id: 'S6-TICKER-01', name: 'v59.88 질문 티커는 한 해석기: 별명은 다른 종목과 함께 읽고, 한글 이름에 붙은 영문 접두는 티커가 아니다', run: async ({ load }) => {
      const { resolveEntities } = await load('src/ai/entity/resolver.js');
      const { resolveChatTickers } = await load('src/ai/entity/chat-tickers.js');
      const root = { KR_STOCK_DB: { '000660': { name: 'SK하이닉스', market: 'KOSPI' }, '051910': { name: 'LG화학', market: 'KOSPI' } } };
      const pick = (query, companiesOnly = true) => [...resolveChatTickers({ query, questionPlan: { entities: resolveEntities(query, { root }) }, companiesOnly })];
      const planSymbols = (query) => resolveEntities(query, { root }).entities.map((e) => e.symbol);
      assert.deepEqual(pick('암드 vs 엔비디아'), ['NVDA', 'AMD']);
      assert.deepEqual(pick('SK하이닉스 전망'), ['000660.KS']);
      assert.deepEqual(pick('LG화학 전망'), ['051910.KS']);
      assert.deepEqual(planSymbols('SK하이닉스 전망'), ['000660.KS']);
      assert.deepEqual(planSymbols('WTI 전망'), []);
      assert.deepEqual(planSymbols('멀티에셋 PM의 관점'), []);
      assert.deepEqual(planSymbols('$TSLA 숏'), ['TSLA']);
      assert.deepEqual(pick('AMD주가 어때'), ['AMD']);
      assert.deepEqual(pick('엔비는?'), ['NVDA']);
      assert.deepEqual(pick('원달러 환율', false), ['KRW=X']);
      assert.deepEqual(pick('원달러 환율'), []);
      for (const q of ['금일 시장', '마크롱 발언', '메타버스 관련주', '애플리케이션 시장']) assert.deepEqual(pick(q, false), [], q);
  } },
  { id: 'S6-TICKER-02', name: 'v59.88 뉴스 기사 티커 읽기는 레거시 단어 관문을 그대로 지킨다 (P1428·P1449·P1550·P1592)', run: async ({ load }) => {
      const { articleTickers } = await load('src/domain/news/article-tickers.js');
      const lists = { knownTickers: new Set(['NVDA', 'COO', 'SNOW', 'ARM', 'MS', 'INTC']), nameMap: { 델: 'DELL', intel: 'INTC', 'morgan stanley': 'MS', 엔비디아: 'NVDA' } };
      const read = (title) => articleTickers({ title }, lists);
      assert.deepEqual(read('Former FTX COO joins'), []);
      assert.deepEqual(read('$COO shares jump'), ['COO']);
      assert.deepEqual(read('Snow storm hits; SNOW weather'), []);
      assert.deepEqual(read('SNOW stock surges on revenue'), ['SNOW']);
      assert.deepEqual(read('ARM designs a chip'), []);
      assert.deepEqual(read('Arm Holdings (ARM) earnings beat'), ['ARM']);
      assert.deepEqual(read('Artificial Intelligence boom'), []);
      assert.deepEqual(read('모델 업데이트'), []);
      assert.deepEqual(read('델이 서버 신제품을 발표'), ['DELL']);
      assert.deepEqual(read('Markets wobble, Morgan Stanley says'), []);
      assert.deepEqual(read('엔비디아 실적 발표'), ['NVDA']);
  } },
  { id: 'P12-RESEARCH-01', name: '기업 1차 출처 계획에서 Nasdaq 기사는 1차 출처로 세지 않는다', run: async ({ load }) => {
      const { evaluateResearchEvidenceFloor } = await load('src/ai/research/evidence.js');
      const questionPlan = await researchPlan(load);
      const nasdaq = evaluateResearchEvidenceFloor({ questionPlan, nativeCitations: [{ url: 'https://www.nasdaq.com/articles/audit-fixture', queryId: 'audit-q', publishedAt: at }] });
      assert.equal(nasdaq.primarySourceCount, 0);
      assert.equal(nasdaq.currentClaimsAllowed, false);
      const sec = evaluateResearchEvidenceFloor({ questionPlan, nativeCitations: [{ url: 'https://www.sec.gov/audit-fixture', queryId: 'audit-q', publishedAt: at }] });
      assert.equal(sec.primarySourceCount, 1);
      assert.equal(sec.currentClaimsAllowed, true);
  } },
  { id: 'P12-RESEARCH-02', name: '요청 결속이 없는 출처는 현재 주장 최소치를 채우지 않는다', run: async ({ load }) => {
      const { evaluateResearchEvidenceFloor } = await load('src/ai/research/evidence.js');
      const questionPlan = await researchPlan(load, { minimumIndependentSources: 2 });
      const mixed = evaluateResearchEvidenceFloor({ questionPlan, nativeCitations: [
        { url: 'https://www.sec.gov/audit-fixture', queryId: 'audit-q', publishedAt: at },
        { url: 'https://www.reuters.com/audit-fixture', publishedAt: at }] });
      assert.equal(mixed.evidenceBinding.status, 'PARTIAL');
      assert.equal(mixed.bindingVerified, false);
      assert.equal(mixed.currentClaimsAllowed, false);
      const both = evaluateResearchEvidenceFloor({ questionPlan, nativeCitations: [
        { url: 'https://www.sec.gov/audit-fixture', queryId: 'audit-q', publishedAt: at },
        { url: 'https://www.reuters.com/audit-fixture', queryId: 'audit-q', publishedAt: at }] });
      assert.equal(both.currentClaimsAllowed, true);
  } },
  { id: 'P12-RESEARCH-02', name: '결속된 문서만으로 최소치를 채우면 결속 없는 참고 자료가 있어도 확인된다', run: async ({ load }) => {
      const { evaluateResearchEvidenceFloor } = await load('src/ai/research/evidence.js');
      const questionPlan = await researchPlan(load);
      const out = evaluateResearchEvidenceFloor({ questionPlan, nativeCitations: [
        { url: 'https://www.sec.gov/audit-fixture', queryId: 'audit-q', publishedAt: at },
        { url: 'https://www.reuters.com/audit-fixture', publishedAt: at }] });
      assert.equal(out.bindingVerified, true);
      assert.equal(out.currentClaimsAllowed, true);
  } },
  { id: 'P12-RESEARCH-03', name: '실제 질문 계획의 종목 구조로 다른 종목 출처를 거른다', run: async ({ load }) => {
      const { evaluateResearchEvidenceFloor } = await load('src/ai/research/evidence.js');
      const questionPlan = await researchPlan(load);
      const wrong = evaluateResearchEvidenceFloor({ questionPlan, nativeCitations: [{ url: 'https://www.sec.gov/audit-fixture', queryId: 'audit-q', entity: 'MSFT', publishedAt: at }] });
      assert.equal(wrong.evidenceBinding.status, 'MISMATCHED_ENTITY');
      assert.equal(wrong.currentClaimsAllowed, false);
      const compare = { ...questionPlan, entities: { entities: [{ symbol: 'AAPL', verified: true, market: 'US' }, { symbol: 'MSFT', verified: true, market: 'US' }] } };
      const ok = evaluateResearchEvidenceFloor({ questionPlan: compare, nativeCitations: [{ url: 'https://www.sec.gov/audit-fixture', queryId: 'audit-q', entity: 'MSFT', publishedAt: at }] });
      assert.equal(ok.evidenceBinding.status, 'BOUND');
  } },
  { id: 'P13-SCREEN-01', name: '한국 종목 가격은 원화로, 통화를 모르면 달러로 쓰지 않는다', run: async ({ load }) => {
      const { buildScreenerAiContext } = await load('src/ai/context/screener-query.js');
      const kr = buildScreenerAiContext('반도체 후보', [], {
        rows: [{ sym: '005930.KS', name: '삼성전자', sector: '반도체', mcap: 300, rsi: 50, rank: 60 }],
        live: { '005930.KS': { price: 70000, pct: 1, currency: 'KRW', observedAt: '2026-10-27T06:30:00Z' } }, rankAsOf: '2026-10-27' });
      assert.doesNotMatch(kr.prompt, /\$70000/);
      assert.match(kr.prompt, /₩70,000 \(관측 2026-10-27T06:30:00Z\)/);
      assert.equal(kr.result.rows[0].currency, 'KRW');
      const other = buildScreenerAiContext('반도체 후보', [], { rows: [{ sym: 'ASML.AS', name: 'ASML', sector: '반도체', mcap: 300 }], live: { 'ASML.AS': { price: 600 } } });
      assert.match(other.prompt, /600\.00 \(통화 미확인\)/);
      const us = buildScreenerAiContext('반도체 후보', [], { rows: [{ sym: 'NVDA', name: 'NVIDIA', sector: '반도체', mcap: 4000 }], live: { NVDA: { price: 180.5 } } });
      assert.match(us.prompt, /\$180\.50/);
  } },
  { id: 'P13-SCREEN-02', name: '시총이 없거나 0인 종목을 소형주로 고르지 않는다', run: async ({ load }) => {
      const { runScreenerQuery } = await load('src/ai/context/screener-query.js');
      const out = runScreenerQuery('소형주 후보', { rows: [{ sym: 'MISSING', mcap: null }, { sym: 'ZERO', mcap: 0 }, { sym: 'NAN', mcap: NaN },
        { sym: 'NEG', mcap: -1 }, { sym: 'SMALL', mcap: 2 }, { sym: 'EDGE', mcap: 10 }, { sym: 'LARGE', mcap: 100 }] });
      assert.deepEqual(out.rows.map((row) => row.sym), ['SMALL']);
      assert.equal(out.mcapUnknown, 4);
  } },
  { id: 'P13-SCREEN-03', name: '미만·초과는 경계값을 빼고 이하·이상은 넣는다', run: async ({ load }) => {
      const { runScreenerQuery } = await load('src/ai/context/screener-query.js');
      const rows = [{ sym: 'R29', rsi: 29 }, { sym: 'R30', rsi: 30 }, { sym: 'R70', rsi: 70 }, { sym: 'R71', rsi: 71 }, { sym: 'NONE', rsi: null }];
      const pick = (q) => new Set(runScreenerQuery(q, { rows }).rows.map((row) => row.sym));
      assert.deepEqual(pick('rsi 30 미만'), new Set(['R29']));
      assert.deepEqual(pick('rsi 30 이하'), new Set(['R29', 'R30']));
      assert.deepEqual(pick('rsi 70 초과'), new Set(['R71']));
      assert.deepEqual(pick('rsi 70 이상'), new Set(['R70', 'R71']));
      assert.deepEqual(pick('below rsi 30'), new Set(['R29']));
      assert.deepEqual(pick('rsi 30 이상 70 미만'), new Set(['R30']));
      assert.deepEqual(runScreenerQuery('rsi 30 미만', { rows }).criteria, ['RSI<30']);
  } },
  { id: 'R4-01', name: '영문 단어 속 IV·이란(국가)으로 옵션·용어 질문이 되지 않는다', run: async ({ load }) => {
      const { classifyQuestionIntent } = await load('src/ai/intent/taxonomy.js');
      for (const q of ['AAPL dividend 얼마야?', 'What drives MSFT revenue?', 'KO 배당 성향 positive?']) {
        assert.notEqual(classifyQuestionIntent(q).primary, 'OPTIONS_ANALYSIS', q);
      }
      const iran = classifyQuestionIntent('이란 사태 이후 시장 상황');
      assert.equal(iran.primary, 'MARKET_STATUS');
      assert.equal(iran.currentSensitive, true);
      assert.equal(classifyQuestionIntent('PER이란 무엇인가요?').primary, 'EDUCATION');
      assert.equal(classifyQuestionIntent('NVDA IV 수준').primary, 'OPTIONS_ANALYSIS');
      assert.equal(classifyQuestionIntent('I know the basics').currentSensitive, false);
      const { createResearchDecision } = await load('src/ai/research/decision.js');
      const { createQuestionPlan } = await load('src/ai/orchestrator/question-planner.js');
      const now = '2026-10-28T12:00:00Z';
      const know = createResearchDecision({ questionPlan: createQuestionPlan({ query: 'I know what a moat is', now }), now });
      assert.equal(know.currentSensitive, false);
      const today = createResearchDecision({ questionPlan: createQuestionPlan({ query: 'market today', now }), now });
      assert.equal(today.currentSensitive, true);
  } },
  { id: 'P12-CAND-PRINCIPLES', name: '오래된 정적 파일 안내가 기준일별 최신성 규칙과 부딪히지 않는다', run: async ({ load }) => {
      const { buildAnswerPrinciples } = await load('src/ai/response/answer-principles.js');
      const text = buildAnswerPrinciples({ today: '2026-10-31', snapAgeHours: 96 });
      assert.doesNotMatch(text, /정적 수치를 현재값으로 인용하지 마라/);
      assert.match(text, /기준일이 지난 수치/);
  } },
  { id: 'P13-CAND-PRICE', name: '저가 종목에서 "3개월"·"2배"를 사용자가 말한 가격으로 읽지 않는다', run: async ({ load }) => {
      const { priceLevelContext } = await load('src/ai/context/choosing-blocks.js');
      const map = { symbol: 'LOW', asOf: '2026-10-30', close: 3, adrPct: 5, atr: 0.2, supportCandidates: [], resistanceCandidates: [], note: '레벨 없음' };
      assert.doesNotMatch(priceLevelContext(map, '3개월 뒤 2배 가능?'), /사용자가 말한/);
      assert.match(priceLevelContext(map, '3.5달러에서 어때?'), /사용자가 말한 3\.50/);
  } },
  { id: 'P13-CAND-THEME', name: '종가 기준일이 다른 구성 종목을 한 순위로 섞지 않는다', run: async ({ load }) => {
      const { focusedThemeContext } = await load('src/ai/context/choosing-blocks.js');
      const root = { THEME_MAP: [{ id: 'optics', nameKr: '광통신', leaders: ['AAA', 'OLD'] }] };
      const rows = [{ sym: 'AAA', ret1m: 5, factorSessionDate: '2026-10-30' }, { sym: 'OLD', ret1m: 40, factorSessionDate: '2026-09-30' }];
      const text = focusedThemeContext({ root, query: '광통신 테마 어때', rows });
      assert.doesNotMatch(text, /OLD/);
      assert.match(text, /수익률 있는 1\/2종목, 종가 기준일 2026-10-30/);
  } },
  { id: 'P11-OPTIONS-INTENT', name: '옵션 질문은 아무 도구도 주지 않는 options 근거를 요구하지 않는다', run: async ({ load }) => {
    const { createQuestionPlan } = await load('src/ai/orchestrator/question-planner.js');
    const plan = createQuestionPlan({ query: 'SPY 옵션 IV와 GEX 분석', now: '2026-10-30T15:00:00Z' });
    assert.ok(plan.intent.intents.includes('OPTIONS_ANALYSIS'));
    assert.ok(!plan.requiredEvidence.includes('options'));
    assert.ok(plan.requiredEvidence.includes('market-snapshot'));
    assert.ok(!plan.capabilityPlan.requiredTools.includes('options'));
  } },
];
