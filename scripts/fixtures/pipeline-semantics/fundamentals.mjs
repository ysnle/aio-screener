// scripts/fixtures/pipeline-semantics/fundamentals.mjs — v59.45 pipeline review regressions (SEC·DART 재무, 13F, 종목 렌즈·기업 설명, 요청 시 계산, 종목 근거 카드)
import assert from 'node:assert/strict';

const NOW = Date.parse('2026-10-29T00:00:00Z');

// Minimal DOM for the story renderer: elements keep children and text, nothing else.
function stubDocument() {
  const node = (tag) => ({ tag, children: [], textContent: '', className: '', style: {}, dataset: {},
    get childNodes() { return this.children; }, get childElementCount() { return this.children.length; },
    setAttribute() {}, append(...items) { this.children.push(...items); }, appendChild(item) { this.children.push(item); return item; } });
  return { createElement: node, createTextNode: (text) => ({ tag: '#text', children: [], textContent: text }) };
}
const textOf = (item) => `${item.textContent || ''} ${(item.children || []).map(textOf).join(' ')}`;

export const cases = [
  { id: 'P3-DATA-08', name: 'DART의 정의되지 않은 오류(900)는 미공시가 아니라 실패로 남아 이전 재무가 이어진다', run: async ({ load }) => {
      const dart = await load('scripts/fetch-dart-fundamentals.mjs');
      assert.equal(dart.dartReportOutcome({ status: '900', message: 'x' }), 'failed');
      assert.equal(dart.dartReportOutcome({ status: '013' }), 'absent');
      assert.equal(dart.dartReportOutcome({ status: '020' }), 'fatal');
      assert.equal(dart.dartReportOutcome({ status: '000', list: [{ account_nm: '매출액' }] }), 'found');
      const previous = { count: 2, generatedAt: '2026-10-20T00:00:00Z', companies: { '005930.KS': { fiscalYear: 2025 }, '000660.KS': { fiscalYear: 2025 } } };
      const merged = dart.mergeWithPrevious({ '005930.KS': { fiscalYear: 2025 } }, [{ sym: '000660.KS', reason: `DART status 900` }], previous);
      assert.ok(merged.companies['000660.KS'], 'a failed read keeps the previous filing');
      assert.equal(merged.count, 2);
  } },
  { id: 'P3-RUNTIME-02', name: '같은 행 수·같은 날짜로 구성이 바뀌면 요청 시 계산 캐시가 이전 판정을 돌려주지 않는다', run: async ({ load }) => {
      const { createOnDemandSymbolReader } = await load('src/data/on-demand-symbol.js');
      let rows = [{ sym: 'TEST', factorSessionDate: '2026-10-29' }];
      let listingChecks = 0;
      const reader = createOnDemandSymbolReader({ universeRows: () => rows, isListed: async () => { listingChecks += 1; return { listed: false }; }, fetchChart: async () => null, now: () => NOW });
      assert.equal((await reader.load('TEST')).status, 'in-universe');
      rows = [{ sym: 'OTHER', factorSessionDate: '2026-10-29' }];
      assert.equal(reader.peek('TEST'), null, 'peek does not hand out a record read against the old universe');
      const second = await reader.load('TEST');
      assert.equal(second.status, 'not-listed');
      assert.equal(listingChecks, 1);
  } },
  { id: 'P25-CACHE-01', name: '같은 날 같은 종목 구성이라도 값이 정정되면 다시 읽고, 읽는 도중 바뀐 유니버스를 새 기준으로 표시하지 않는다', run: async ({ load }) => {
      const { createOnDemandSymbolReader, universeFingerprint } = await load('src/data/on-demand-symbol.js');
      const a = [{ sym: 'AAA', factorSessionDate: '2026-10-29', ret3m: 5 }];
      const b = [{ sym: 'AAA', factorSessionDate: '2026-10-29', ret3m: 7 }];
      assert.notEqual(universeFingerprint(a), universeFingerprint(b), 'a same-day value correction changes the identity');
      assert.equal(universeFingerprint([{ sym: 'B' }, { sym: 'A' }]), universeFingerprint([{ sym: 'A' }, { sym: 'B' }]), 'row order is not identity');
      // The universe changes while the listing check is pending: the record keeps the key of the rows it read.
      let rows = [{ sym: 'ZZZ', factorSessionDate: '2026-10-29' }];
      let release;
      const reader = createOnDemandSymbolReader({ universeRows: () => rows, isListed: () => new Promise((resolve) => { release = () => resolve({ listed: false }); }), fetchChart: async () => null, now: () => NOW });
      const pending = reader.load('TEST');
      await new Promise((resolve) => setTimeout(resolve, 0));
      rows = [{ sym: 'TEST', factorSessionDate: '2026-10-29' }];
      release();
      assert.equal((await pending).status, 'not-listed');
      assert.equal((await reader.load('TEST')).status, 'not-listed', 'not-listed is retried only after its own wait');
  } },
  { id: 'P25-READ-01', name: '세 기간 수익률이 지수와 같으면 모든 기간 뒤졌다고 쓰지 않는다', run: async ({ load }) => {
      const { buildStockRead } = await load('src/domain/entity/stock-read.js');
      const read = buildStockRead({ symbol: 'TEST', row: { sym: 'TEST', ret1m: 5, ret3m: 10, ret6m: 20 }, benchmark: { ret1m: 5, ret3m: 10, ret6m: 20 } });
      const relative = read.points.find((point) => point.id === 'relative');
      assert.doesNotMatch(relative.text, /뒤졌습니다/);
      assert.match(relative.text, /모든 기간에서 지수와 비슷했습니다/);
      const ahead = buildStockRead({ symbol: 'TEST', row: { sym: 'TEST', ret1m: 15, ret3m: 30, ret6m: 20 }, benchmark: { ret1m: 5, ret3m: 10, ret6m: 20 } }).points.find((point) => point.id === 'relative');
      assert.match(ahead.text, /3개 기간 중 2개 앞섬, 1개 비슷/);
  } },
  { id: 'P25-STORY-01', name: '연구일이 없거나 실적 달력이 비어 있으면 최신으로 인증하지 않는다', run: async ({ load }) => {
      const { storyFreshness } = await load('src/domain/entity/company-story.js');
      assert.equal(storyFreshness({ symbol: 'TEST' }, [{ symbol: 'X', date: '2026-10-01' }], '2026-10-30').state, 'unknown');
      assert.equal(storyFreshness({ symbol: 'TEST', researchedAt: '2020-01-01' }, [], '2026-10-30').state, 'unknown');
      assert.equal(storyFreshness({ symbol: 'TEST', researchedAt: '2026-10-28' }, [{ symbol: 'OTHER', date: '2026-10-29' }], '2026-10-30').state, 'current');
  } },
  { id: 'P25-STORY-02', name: '같은 연구일이라도 기간·내용 해시가 다른 색인 행이면 저장된 기업 설명을 그대로 쓰지 않는다', run: async ({ load }) => {
      const { storyMatchesEntry } = await load('src/data/company-profiles.js');
      const story = { symbol: 'AAA', researchedAt: '2026-10-28' };
      const entry = { symbol: 'AAA', file: 'AAA.json', researchedAt: '2026-10-28', period: '3Q26' };
      assert.equal(storyMatchesEntry(story, entry, { ...entry }), true);
      assert.equal(storyMatchesEntry(story, { ...entry, period: '3Q26 정정' }, { ...entry }), false);
      assert.equal(storyMatchesEntry(story, { ...entry, contentHash: 'b' }, { ...entry, contentHash: 'a' }), false);
  } },
  { id: 'P25-STORY-03', name: '100만 달러는 0억 달러가 아니고, 비중 미상(null)은 0%로 그리지 않으며, 지난 일정은 다가오는 일정이 아니다', run: async ({ load }) => {
      const { moneyText } = await load('src/domain/entity/company-story.js');
      assert.equal(moneyText(1, 'USD mn'), '100만 달러');
      assert.equal(moneyText(0.05, 'KRW bn'), '5,000만 원');
      assert.equal(moneyText(850, 'USD mn'), '8.5억 달러');
      const { renderCompanyStory } = await load('src/ui/components/company-story.js');
      const doc = stubDocument();
      const host = doc.createElement('section');
      renderCompanyStory(doc, host, { profile: { symbol: 'AAA', oneLine: 'x', researchedAt: '2026-10-28', sources: [{ title: 's', date: '2026-10-28' }],
        earnings: { revenue: { value: 100, unit: 'USD bn' }, segments: [{ name: '서버', revenue: 40, unit: 'USD bn', share: null }, { name: '기기', revenue: 30, unit: 'USD bn' }] },
        trading: { calendar: [{ date: '2020-01-02', event: '지난 행사' }, { date: '2099-01-02', event: '먼 행사' }] } }, earnings: [] });
      const text = textOf(host);
      assert.doesNotMatch(text, /서버 \S+ \S+, 0%/, 'an unknown share prints no percentage');
      assert.match(text, /300억 달러, 30%/, 'an omitted share reads against company revenue, not the listed segments');
      assert.doesNotMatch(text, /지난 행사/);
      assert.match(text, /먼 행사/);
  } },
  { id: 'P25-READ-02', name: '가중치 0·모델 실패·사유 미상을 모두 유효값 80% 부족으로 설명하지 않는다', run: async ({ load }) => {
      const { buildOutOfUniverseRead } = await load('src/domain/entity/out-of-universe-read.js');
      const base = { symbol: 'TEST', status: 'ready', computedAt: '2026-10-29T00:00:00Z' };
      const input = (extra) => ({ key: 'size', label: '규모', active: false, usable: false, present: ['mcap'], missing: [], blockedReasons: [], ...extra });
      const weightZero = buildOutOfUniverseRead({ ...base, placement: { rank: null, unavailableReason: 'model-unavailable', inputs: [input({ inactiveReason: '기본 모델 가중 0 — 기본 순위에 쓰지 않음' })] } });
      assert.doesNotMatch(weightZero.inputs[0].detail, /80%/);
      assert.match(weightZero.inputs[0].detail, /가중치가 0/);
      assert.doesNotMatch(weightZero.lines[0], /80%/);
      const unknown = buildOutOfUniverseRead({ ...base, placement: { rank: null, inputs: [input({})] } });
      assert.doesNotMatch(unknown.inputs[0].detail, /80%/);
      const coverage = buildOutOfUniverseRead({ ...base, placement: { rank: null, unavailableReason: 'insufficient-row-factor-coverage', inputs: [input({ inactiveReason: '모멘텀 유효값 커버리지 80% 미만 (40.0%)' })] } });
      assert.match(coverage.inputs[0].detail, /80%/);
      assert.match(coverage.lines[0], /80% 이상/);
  } },
  { id: 'P25-TICKER-01', name: '명시한 .KQ 접미사도 6자리 단축코드로 같은 발행사 이름을 붙인다(단축코드는 시장 간 고유)', run: async ({ load }) => {
      const { tickerDisplayName } = await load('src/domain/entity/ticker-symbol.js');
      assert.equal(tickerDisplayName('005930.KS', { krStockDb: { '005930': { name: '삼성전자' } } }), '삼성전자');
  } },
  { id: 'P25-SOURCE-01', name: '자격 정보가 든 https 링크는 사업 설명 출처로 인정하지 않는다(기업 분석과 같은 규칙)', run: async ({ load }) => {
      const { businessProfileFor } = await load('src/domain/entity/business-profiles.js');
      const profile = (sourceUrl) => businessProfileFor('AAA', {}, { businessProfile: { symbol: 'AAA', description: 'x', sourceUrl } }).descriptionStatus;
      assert.equal(profile('https://user:pw@example.com/a'), 'unavailable');
      assert.equal(profile('https://'), 'unavailable');
      assert.equal(profile('https://example.com/a'), 'sourced');
  } },
  { id: 'P19-PERIOD-01', name: '종목 렌즈는 빠진 회계연도를 건너뛴 두 해를 전년 비교로 쓰지 않는다', run: async ({ load }) => {
      const { buildLensRead } = await load('src/domain/fundamental/stock-lens.js');
      const history = [{ periodEnd: '2022-12-31', revenue: 100, netIncome: 10, equity: 100 }, { periodEnd: '2025-12-31', revenue: 200, netIncome: 20, equity: 100 }];
      const lens = buildLensRead({ history, lens: { id: 'general' } });
      assert.equal(lens.rows.find((row) => row.id === 'revenueGrowth').value, null);
      assert.equal(lens.rows.find((row) => row.id === 'roe').value, null, 'average-equity ROE needs the adjacent year');
      const adjacent = buildLensRead({ history: [{ periodEnd: '2024-12-31', revenue: 100 }, { periodEnd: '2025-12-31', revenue: 130 }], lens: { id: 'general' } });
      assert.match(adjacent.rows.find((row) => row.id === 'revenueGrowth').value, /\+30\.0%/);
  } },
  { id: 'P19-QUARTER-01', name: '빠진 분기를 건너뛴 세 분기를 연속 추세로 읽지 않는다', run: async ({ load }) => {
      const { buildQuarterRead } = await load('src/domain/fundamental/quarter-read.js');
      const q = (periodEnd, revenue) => ({ periodEnd, revenue, netIncome: 1 });
      const gap = buildQuarterRead([q('2024-03-31', 100), q('2024-06-30', 100), q('2024-09-30', 100), q('2024-12-31', 100), q('2025-03-31', 110), q('2025-09-30', 130), q('2025-12-31', 150)]);
      assert.doesNotMatch(gap.headline, /빨라졌습니다|느려졌습니다|유지됩니다|들쭉날쭉/);
      const run = buildQuarterRead([q('2024-06-30', 100), q('2024-09-30', 100), q('2024-12-31', 100), q('2025-06-30', 110), q('2025-09-30', 130), q('2025-12-31', 150)]);
      assert.match(run.headline, /빨라졌습니다/);
  } },
  { id: 'P19-PEER-01', name: '모두 같은 값이면 1위·강점이 아니라 공동 순위·중립이다', run: async ({ load }) => {
      const { buildPeerStrengths } = await load('src/domain/fundamental/stock-lens.js');
      const ties = buildPeerStrengths([{ self: true, growth: 10 }, { growth: 10 }, { growth: 10 }, { growth: 10 }]);
      assert.equal(ties.strengths.length, 0);
      assert.equal(ties.weaknesses.length, 0);
      assert.match(ties.facts[0].text, /공동 1위/);
  } },
  { id: 'P19-DCF-01', name: '오래된 종가나 규모가 맞지 않는 주식 수로 지금 가격의 역DCF를 만들지 않는다', run: async ({ load }) => {
      const { reverseDcfInputs } = await load('src/domain/fundamental/analysis-read.js');
      const history = [{ periodEnd: '2025-12-31', operatingCashFlow: 100, capex: 10 }];
      const fundamentals = { sharesOutstanding: 10, sharesObservedAt: '2026-02-01' };
      assert.notEqual(reverseDcfInputs({ history, fundamentals, close: { value: 100, date: '1990-01-01' }, nowMs: NOW }).state, 'ready');
      assert.notEqual(reverseDcfInputs({ history, fundamentals, close: { value: 100, date: '2026-11-30' }, nowMs: NOW }).state, 'ready', 'a future close is not current');
      assert.notEqual(reverseDcfInputs({ history, fundamentals: { ...fundamentals, sharesCheck: 'scale-mismatch' }, close: { value: 100, date: '2026-10-28' }, nowMs: NOW }).state, 'ready');
      assert.equal(reverseDcfInputs({ history, fundamentals, close: { value: 100, date: '2026-10-28' }, nowMs: NOW }).state, 'ready');
  } },
  { id: 'P19-FISCAL-01', name: '매출 보합을 감소로, 순이익·영업현금 0을 손실·유출로 쓰지 않는다', run: async ({ load }) => {
      const { buildFiscalRead } = await load('src/domain/fundamental/fiscal-read.js');
      const flat = buildFiscalRead({ symbol: 'TEST', fundamentals: { symbol: 'TEST', fiscalHistory: [{ periodEnd: '2024-12-31', revenue: 100, netIncome: 0, equity: 100, operatingCashFlow: 0 }, { periodEnd: '2025-12-31', revenue: 100, netIncome: 0, equity: 100, operatingCashFlow: 0 }] }, now: NOW });
      assert.doesNotMatch(flat.points.find((point) => point.id === 'growth').text, /줄었습니다/);
      assert.doesNotMatch(flat.points.find((point) => point.id === 'cash').text, /순손실|유출/);
      const shares = buildFiscalRead({ symbol: 'TEST', fundamentals: { symbol: 'TEST', fiscalHistory: [{ periodEnd: '2021-12-31', revenue: 100, shares: 100 }, { periodEnd: '2025-12-31', revenue: 110, shares: 90 }] }, now: NOW });
      assert.match(shares.points.find((point) => point.id === 'shares').text, /^4년 동안/, 'years are the span of the dates, not the row count');
  } },
  { id: 'P19-CONSENSUS-01', name: '고점 대비 위치만으로 가격 방향을 정하지 않고, 미래 날짜 종가는 현재 가격이 아니다', run: async ({ load }) => {
      const { buildConsensusPoint, consensusView } = await load('src/domain/fundamental/consensus-read.js');
      const estimate = { asOf: '2026-10-28', fwd: { eps: 10, from: '2026-12', to: '2027-09', up4w: 3, down4w: 0 }, trailing: { eps: 10 } };
      const point = buildConsensusPoint({ valuationPrice: 100, factorSessionDate: '2026-10-28', pctFrom52wHigh: -20, ret1m: 20 }, estimate, { now: NOW });
      assert.doesNotMatch(point.text, /반대 방향/);
      assert.match(point.text, /같은 방향/);
      assert.equal(consensusView({ valuationPrice: 100, factorSessionDate: '2026-11-20' }, estimate, { now: NOW }), null);
      const missing = buildConsensusPoint({ valuationPrice: 100, factorSessionDate: '2026-10-28' }, { ...estimate, fwd: { eps: 10, from: '2026-12', to: '2027-09' } }, { now: NOW });
      assert.doesNotMatch(missing.text, /변경 없음/, 'uncollected revision counts are not "no change"');
  } },
  { id: 'P19-CASH-01', name: '한쪽만 공시된 자사주·배당은 확인된 항목 합으로, 직전 해는 인접 회계연도만 쓴다', run: async ({ load }) => {
      const { buildMarginCashRead } = await load('src/domain/fundamental/analysis-read.js');
      const read = buildMarginCashRead([{ periodEnd: '2022-12-31', capitalChain: true, revenue: 90, grossProfit: 30 }, { periodEnd: '2025-12-31', capitalChain: true, revenue: 100, cash: 50, longTermDebt: 10, buybacks: 20, dividends: null, operatingCashFlow: 100, capex: 10, grossProfit: 40 }]);
      assert.equal(read.capital.returned, 20);
      assert.equal(read.capital.returnedBasis, 'buybacks-only');
      assert.equal(read.cash.debtBasis, 'long-term');
      assert.equal(read.priorLabel, null, 'FY2022 is not the year before FY2025');
      const { buildLensRead } = await load('src/domain/fundamental/stock-lens.js');
      const lens = buildLensRead({ lens: { id: 'internet' }, history: [], marginCash: read });
      assert.match(lens.rows.find((row) => row.id === 'shareholderReturn').value, /확인된 자사주 매입\(배당 자료 없음\)/);
  } },
  { id: 'P19-PIT-01', name: '시점 재무 선택은 통화를 보존하고 EUR 이익에 USD 가격을 나누지 않는다', run: async ({ load }) => {
      const { selectSecFundamentalsAsOf } = await load('src/domain/fundamental/sec-report.js');
      const obs = (value) => ({ value, periodStart: '2025-01-01', periodEnd: '2025-12-31', filedAt: '2026-02-01', form: '20-F' });
      const out = selectSecFundamentalsAsOf({ symbol: 'TEST', reportingCurrency: 'EUR', form: '20-F', pit: { currency: 'EUR', observations: { revenue: [obs(1000)], netIncome: [obs(100)], equity: [obs(500)], sharesOutstanding: [obs(100)] } } }, '2026-10-28', { priceAsOf: 100 });
      assert.equal(out.reportingCurrency, 'EUR');
      assert.equal(out.pe, undefined);
      assert.equal(out.pb, undefined);
      assert.equal(out.margin, 10, 'same-currency ratios stay');
  } },
  { id: 'P19-FUTURE-01', name: '미래 회계연도·미래 공시 시각의 SEC 행은 CURRENT가 아니다', run: async ({ load }) => {
      const { secFundamentalRowFields } = await load('src/domain/fundamental/sec-row-fields.js');
      const future = secFundamentalRowFields({ observedAt: '2099-12-31', filedAt: '2100-02-01', roe: 20 }, { factorSessionDate: '2026-10-28', nowMs: NOW });
      assert.notEqual(future.fundamentalQuality.status, 'CURRENT');
      const current = secFundamentalRowFields({ observedAt: '2025-12-31', filedAt: '2026-02-01', roe: 20 }, { factorSessionDate: '2026-10-28', nowMs: NOW });
      assert.equal(current.fundamentalQuality.status, 'CURRENT');
  } },
  { id: 'P5-SEC-01', name: '은행의 순이자+비이자 합성 매출이 재무제표 패널에도 같은 값으로 나온다', run: async ({ load }) => {
      const { parseSecStatements } = await load('src/domain/fundamental/sec-statements.js');
      const fy = (val) => ({ start: '2025-01-01', end: '2025-12-31', val, form: '10-K', fp: 'FY', filed: '2026-02-10', accn: '0000000001-26-000001' });
      const facts = { cik: 1, facts: { 'us-gaap': { InterestIncomeExpenseNet: { units: { USD: [fy(80)] } }, NoninterestIncome: { units: { USD: [fy(20)] } }, NetIncomeLoss: { units: { USD: [fy(10)] } } } } };
      assert.deepEqual(parseSecStatements(facts, { symbol: 'X' }).revenue.map((row) => row.val), [100]);
  } },
  { id: 'P5-DATA-11', name: 'Nasdaq 재무 상태가 정상(N)으로 돌아오면 이전 D 경고를 지운다', run: async ({ load }) => {
      const { buildExtendedUniverse, parseNasdaqListed } = await load('scripts/lib/extended-universe.mjs');
      const previous = { universe: [{ sym: 'TEST', membership: ['NASDAQ'], nasdaqFinancialStatus: 'D' }] };
      const build = (status) => buildExtendedUniverse({ nasdaq: parseNasdaqListed(`Symbol|Security Name|Test Issue|ETF|Financial Status\nTEST|Test - Common Stock|N|N|${status}\n`), previous, floors: { nasdaq: 1, r2000: 1 }, now: '2026-10-26T00:00:00Z' });
      assert.equal(build('N').payload.universe[0].nasdaqFinancialStatus, undefined);
      assert.equal(build('E').payload.universe[0].nasdaqFinancialStatus, 'E');
  } },
  { id: 'P5-SEC-02', name: '원본+신규행 13F 정정에서 원본 행은 원본 신고의 링크·제출일을 가진다', run: async ({ load }) => {
      const { composeAmendmentChain, composedRowSource } = await load('scripts/lib/13f-compose.mjs');
      const filing = (accession, isAmendment, filedAt) => ({ accession, form: isAmendment ? '13F-HR/A' : '13F-HR', isAmendment, periodOfReport: '2026-06-30', filedAt, informationTableHtml: `https://fixture.invalid/${accession}` });
      const added = filing('added', true, '2026-08-02');
      const composed = composeAmendmentChain([{ filing: filing('original', false, '2026-08-01'), cover: {}, rows: [{ cusip: '1', value: 1, shares: 1 }] }, { filing: added, cover: { amendmentType: 'NEW HOLDINGS' }, rows: [{ cusip: '2', value: 2, shares: 2 }] }]);
      assert.deepEqual(composedRowSource(composed.rowProvenance, 0, added), { filedAt: '2026-08-01', sourceUrl: 'https://fixture.invalid/original', accession: 'original', role: 'ORIGINAL' });
      assert.equal(composedRowSource(composed.rowProvenance, 1, added).sourceUrl, 'https://fixture.invalid/added');
  } },
  { id: 'R3-07', name: '실적 공시 본문 변환은 &amp;를 한 번만 풀고 BMP 밖 문자를 깨뜨리지 않는다', run: async ({ load }) => {
      const { htmlToText } = await load('scripts/lib/sec-results-filings.mjs');
      assert.equal(htmlToText('&amp;#36;5'), '&#36;5');
      assert.equal(htmlToText('&amp;lt;b'), '&lt;b');
      assert.equal(htmlToText('A &amp; B &#36;5'), 'A & B $5');
      assert.equal(htmlToText('&#128512;'), String.fromCodePoint(128512));
  } },
  { id: 'R1-04', name: '미래 날짜나 아직 진행 중인 거래일의 관측을 최신 거래일로 표시하지 않는다', run: async ({ load }) => {
      const { basisAge } = await load('src/ui/components/value-basis.js');
      const future = basisAge('2026-11-04', Date.parse('2026-10-31T12:00:00Z'));
      assert.notEqual(future.age, '최신 거래일');
      assert.equal(future.stale, null);
      const open = basisAge('2026-10-30', Date.parse('2026-10-30T15:00:00Z'));
      assert.notEqual(open.age, '최신 거래일');
      assert.equal(basisAge('2026-10-29', Date.parse('2026-10-30T15:00:00Z')).age, '최신 거래일');
      assert.equal(basisAge('2026-11-04T00:00:00Z', Date.parse('2026-10-31T12:00:00Z')).stale, null, 'a future instant is not "fresh"');
  } },
  { id: 'PILOT-NUM-01', name: '공용 숫자 읽기는 빈 값·불리언·배열을 0이 아니라 없음으로 읽고, 빈 설비투자를 설비투자 0%로 만들지 않는다', run: async ({ load }) => {
      const { readNumber, finiteNumber, isFiniteNumber } = await load('src/domain/shared/number.js');
      for (const missing of [null, undefined, '', '  ', false, true, [], [5], {}, NaN, Infinity, 'abc']) assert.equal(readNumber(missing), null, `readNumber(${JSON.stringify(missing)})`);
      assert.equal(readNumber('1.5'), 1.5);
      assert.equal(readNumber(0), 0);
      assert.equal(finiteNumber('1.5'), null);
      assert.equal(isFiniteNumber(0), true);
      const { cashMetrics } = await load('src/domain/fundamental/cash-metrics.js');
      const year = { periodEnd: '2026-06-30', revenue: 100, operatingCashFlow: 30, capex: '' };
      assert.equal(cashMetrics([year], { nowMs: NOW }), null, 'a blank capex is unreadable, not 0% capex');
      assert.equal(cashMetrics([{ ...year, capex: 10 }], { nowMs: NOW }).fcfMargin, 20);
  } },
  { id: 'PILOT-DATE-01', name: '같은 종가 행 고르기는 가장 최근 종가의 행만 남기고, 날짜를 읽을 수 없는 행은 세지 않는다', run: async ({ load }) => {
      const { isoDay, stampDay, latestSessionRows, isIsoDay, hasLeadingIsoDay } = await load('src/domain/shared/session-date.js');
      // the boolean forms replace RegExp#test one for one: same result, same coercion
      for (const value of ['2026-10-30', '2026-10-30T20:00:00Z', '2026-10-30 09:00', '10/30', '', null, undefined, 20261030]) {
        assert.equal(isIsoDay(value), /^\d{4}-\d{2}-\d{2}$/.test(value == null ? '' : String(value)), `isIsoDay(${value})`);
        assert.equal(hasLeadingIsoDay(value), /^\d{4}-\d{2}-\d{2}/.test(value == null ? '' : String(value)), `hasLeadingIsoDay(${value})`);
      }
      assert.equal(isoDay('2026-10-30'), '2026-10-30');
      assert.equal(isoDay('2026-10-30T20:00:00Z'), null);
      assert.equal(stampDay('2026-10-30T20:00:00Z'), '2026-10-30');
      assert.equal(stampDay('2026-10-30garbage'), null);
      const out = latestSessionRows([{ factorSessionDate: '2026-10-29' }, { factorSessionDate: '2026-10-30' }, { factorSessionDate: 'n/a' }, {}, { factorSessionDate: '2026-10-30' }]);
      assert.equal(out.basis, '2026-10-30');
      assert.equal(out.rows.length, 2);
      assert.equal(out.older, 1);
      assert.deepEqual(latestSessionRows([]), { basis: null, rows: [], older: 0 });
  } }
];
