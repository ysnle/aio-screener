// P1462–P1469 (v57.19 takeover review): executable negative controls for the meaning fixes.
import { readFileSync } from 'node:fs';
import { readProducerSource } from './lib/producer-source.mjs'; // v57.62: fetch-data.mjs + the lib modules split out of it
import { liveScreenerModelFingerprint, buildRankingIdentity } from '../src/domain/screener/model-fingerprint.js';
import { SCREENER_COLUMN_REGISTRY } from '../src/ui/pages/screener.js';
import { buildAttribution, fxReturnInto } from '../src/domain/portfolio/attribution.js';
import { buildPortfolioRead } from '../src/domain/portfolio/portfolio-read.js';
import { buildPeerRead, fiscalMetrics } from '../src/domain/fundamental/peer-read.js';
import { measureFactorOverlap, overlapSentence } from '../src/domain/screener/factor-overlap.js';

const fail = (message) => { throw new Error(`[review-integrity] ${message}`); };
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const near = (a, b, eps = 0.011) => Math.abs(a - b) <= eps;

// P1462: current/prior 13F periods carry the reference lane's composition chain; the gate refuses a
// silent omission instead of skipping those periods.
const reference = read('scripts/collect-13f-reference.mjs');
const historyRows = read('scripts/collect-13f-history-rows.mjs');
const mastersGate = read('scripts/ci-masters-contract-check.mjs');
if (!/priorAmendmentSemantics: priorBundle \? amendmentSemanticsOf\(priorBundle\)/.test(reference)) fail('P1462 reference lane must publish the prior quarter chain');
if (!/verification\?\.priorAmendmentSemantics/.test(historyRows) || !/compositionSource = 'REFERENCE_LANE'/.test(historyRows)) fail('P1462 history rows must carry the reference-lane chain');
if (/!\['IMPORTED_CURRENT', 'IMPORTED_PRIOR'\]\.includes\(period\.rowImportStatus\)/.test(mastersGate) || !/REFERENCE_LANE_UNSTATED/.test(mastersGate)) fail('P1462 masters gate must check current/prior periods, not skip them');

// P1463: the validation identity follows the weights the screen ranks with.
const fpDefault = liveScreenerModelFingerprint();
if (liveScreenerModelFingerprint({ momentum: 0.369863, trend: 0.273973, lowvol: 0.219178, kalman: 0.136986 }) !== fpDefault) fail('P1463 applied default weights must match the default identity');
if (liveScreenerModelFingerprint({ momentum: 0.6, trend: 0.1, lowvol: 0.1, kalman: 0.2 }) === fpDefault) fail('P1463 a profile with other weights must not read as the validated model');
if (!/liveScreenerModelFingerprint\(metadata\?\.ranking\?\.appliedFactorWeights\)/.test(read('src/ui/pages/screener.js'))) fail('P1463 the 검증 view must pass the applied weights');
if (buildRankingIdentity({ appliedFactorWeights: { momentum: 0.5, trend: 0.5 }, activeFactors: ['trend', 'momentum'] }) !== buildRankingIdentity({ appliedFactorWeights: { trend: 0.5, momentum: 0.5 }, activeFactors: ['momentum', 'trend'] })) fail('P1465 ranking identity must be order-independent');

// P1464: the percentile column is not called a score.
const rankColumn = SCREENER_COLUMN_REGISTRY.find((column) => column.key === 'rank');
if (rankColumn?.label !== '백분위' || /상대 점수/.test(read('src/ui/pages/screener.js'))) fail('P1464 rank column must read 백분위, not 상대 점수');

// P1466: attribution identity R − B = sector + stock + fx + cash, and FX inversion.
const rows = { AAA: { sym: 'AAA', ret3m: 10, sector: 'Technology', factorSessionDate: '2026-10-12' }, XLK: { sym: 'XLK', ret3m: 6 }, '000001.KS': { sym: '000001.KS', ret3m: -12, sector: 'Technology', factorSessionDate: '2026-10-12' } };
const market = (symbol) => (/\.KS$/.test(symbol) ? { ret3m: -15, label: '코스피', asOf: '2026-10-12' } : { ret3m: 3, label: 'S&P 500(SPY)', asOf: '2026-10-12' });
const attribution = buildAttribution({ holdings: [{ symbol: 'AAA', value: 600, convertedFrom: 'USD' }, { symbol: '000001.KS', value: 200 }], cash: 200, baseCurrency: 'KRW', rowFor: (s) => rows[s], marketReturnFor: market, usdkrwReturnPct: 2 });
const excessSum = attribution.excess.reduce((sum, part) => sum + part.pct, 0);
if (!attribution.available || !near(excessSum, attribution.excessPct) || !near(attribution.totalPct, 4.92) || !near(attribution.blendedPct, -1.5)) fail(`P1466 attribution identity broken: ${JSON.stringify(attribution.excess)} total ${attribution.totalPct}`);
if (attribution.components.find((c) => c.id === 'sector').pct !== 1.8 || attribution.excess.find((c) => c.id === 'cash').pct !== 0.3) fail('P1466 sector/cash components drifted');
if (!near(fxReturnInto('KRW', 'USD', 2), 1 / 1.02 - 1, 1e-9) || fxReturnInto('EUR', 'KRW', 2) !== null) fail('P1466 FX conversion must invert KRW→USD and refuse unknown pairs');
const noFx = buildAttribution({ holdings: [{ symbol: 'AAA', value: 100, convertedFrom: 'USD' }], baseCurrency: 'KRW', rowFor: (s) => rows[s], marketReturnFor: market, usdkrwReturnPct: null });
if (noFx.available || noFx.skipped[0]?.reason !== 'no-fx') fail('P1466 a converted holding without an FX return must be skipped, not counted at 0');
// P1681 (X08): an undated index (or stock) close cannot be shown to match — the holding is held out, not assumed aligned.
const undated = buildAttribution({ holdings: [{ symbol: 'AAA', value: 100 }], rowFor: (s) => rows[s], marketReturnFor: () => ({ ret3m: 3, label: 'S&P 500(SPY)', asOf: null }) });
if (undated.available || undated.skipped[0]?.reason !== 'basis-mismatch') fail('P1681 an undated benchmark close must hold the holding out of attribution');
const held = buildPortfolioRead({ surface: { currencyState: 'mixed-without-conversion', declaredCurrencies: ['USD', 'KRW'], rows: [] } });
if (held.available !== false) fail('P1449 mixed currencies without rates must still hold the read');
const book = buildPortfolioRead({ surface: { rows: [{ symbol: 'AAA', value: 600, convertedFrom: 'USD' }, { symbol: '000001.KS', value: 200 }], cash: 200, baseCurrency: 'KRW' }, rows: Object.values(rows), marketReturnFor: market, usdkrwReturnPct: 2 });
const relative = book.points.find((point) => point.id === 'relative')?.text || '';
if (!/환율·현금 포함/.test(relative) || !/차이의 구성: 섹터 \+1\.8%p/.test(relative)) fail(`P1466 the 지수 대비 sentence must come from the attribution: ${relative}`);

// P1467: peers use the same definitions, a 12-month fiscal window and a minimum count.
const series = (rev, ni, eq, end = '2025-12-31') => [{ periodEnd: '2024-12-31', revenue: 100, netIncome: 10, equity: eq }, { periodEnd: end, revenue: rev, netIncome: ni, equity: eq }];
const book2 = { ME: series(130, 20, 100), P1: series(105, 5, 100), P2: series(110, 8, 100), P3: series(101, 2, 100), P4: series(120, 12, 100), P5: series(90, -3, 100), OLD: series(500, 200, 100, '2023-06-30') };
const metrics = fiscalMetrics(book2.ME);
if (!near(metrics.growth, 30) || !near(metrics.margin, 20 / 130 * 100) || !near(metrics.roe, 20)) fail('P1467 fiscal metrics definitions drifted');
const peer = buildPeerRead({ symbol: 'ME', sector: 'Technology', peers: Object.keys(book2), seriesFor: (s) => book2[s] });
if (!peer.available || peer.peers !== 5 || peer.rows.find((r) => r.id === 'growth').percentile !== 100) fail(`P1467 peer read must exclude stale fiscal years and rank on growth: ${JSON.stringify(peer)}`);
if (buildPeerRead({ symbol: 'ME', sector: 'Technology', peers: ['P1', 'P2'], seriesFor: (s) => book2[s] }).available) fail('P1467 too few peers must not produce a comparison');

// P1468: overlap is measured — identical factors collapse to one signal, independent ones do not.
const synthetic = Array.from({ length: 60 }, (_, i) => ({ _z_momentum: i, _z_trend: i * 2 + 1, _z_lowvol: (i * 37) % 61, _z_kalman: (i * 17) % 59 }));
const overlap = measureFactorOverlap(synthetic, ['momentum', 'trend', 'lowvol', 'kalman']);
if (!overlap || overlap.pairs[0].label !== '모멘텀–추세' || overlap.pairs[0].rho !== 1 || !(overlap.effective > 2 && overlap.effective < 3.2)) fail(`P1468 overlap measurement drifted: ${JSON.stringify(overlap)}`);
if (!/독립된 신호 약/.test(overlapSentence(overlap)) || measureFactorOverlap(synthetic.slice(0, 10), ['momentum', 'trend'])) fail('P1468 overlap sentence or minimum sample drifted');

// P1469: the term premium comes from the official FRED series and is named by its model.
if (!/termPremium10:\s+\{ id: 'THREEFYTP10'/.test(readProducerSource()) || !/Kim-Wright/.test(read('src/ui/components/macro-board.js'))) fail('P1469 term premium series or model label missing');

// v57.48 expert review (portfolio · 13F · research). Hypothetical holdings only.
{
  const { derivePortfolioSurface } = await import('../src/domain/portfolio/surface.js');
  const { derivePortfolioChecks } = await import('../src/domain/portfolio/checks.js');
  const { portfolioRowsForAI } = await import('../src/domain/portfolio/portfolio-read.js');
  const { assessAccountPerformance } = await import('../src/domain/portfolio/risk.js');
  const now = Date.parse('2026-10-13T12:00:00Z');
  const legs = [{ from: 'USD', to: 'KRW', rate: 1400, observedAt: '2026-10-13T06:00:00Z' }];
  // #1: a quote without a currency falls back to the listing currency on the cost axis too — $2,000 → $2,440 is +22%, not +333%.
  const us = derivePortfolioSurface({ state: { readState: 'ready', baseCurrency: 'KRW', cashCurrency: 'KRW', cash: 0, fxLegs: legs, holdings: [{ symbol: 'AAA', shares: 10, avgCost: 200, price: 244 }] }, now });
  if (!(us.totalPnlPct > 21.9 && us.totalPnlPct < 22.1)) fail(`#1 undeclared US cost must convert from the listing currency (+22.0%), got ${us.totalPnlPct}`);
  // #10: a held-out holding does not inflate the cash share — cash ÷ (whole book + cash), and R − B still sums.
  const partial = buildAttribution({ holdings: [{ symbol: 'AAA', value: 600 }], holdingsValue: 800, cash: 200, rowFor: (s) => rows[s], marketReturnFor: market });
  const partialSum = partial.excess.reduce((sum, part) => sum + part.pct, 0);
  if (partial.cashSharePct !== 20 || !near(partialSum, partial.excessPct)) fail(`#10 cash share must use the whole book (20%), got ${partial.cashSharePct}; identity ${partialSum} vs ${partial.excessPct}`);
  // #22: a converted holding whose close differs from the USD/KRW close has its FX effect held, not mixed.
  const fxStale = buildAttribution({ holdings: [{ symbol: 'AAA', value: 600, convertedFrom: 'USD' }], baseCurrency: 'KRW', rowFor: (s) => rows[s], marketReturnFor: market, usdkrwReturnPct: 2, usdkrwAsOf: '2026-10-09' });
  if (fxStale.available || fxStale.skipped[0]?.reason !== 'fx-basis-mismatch') fail('#22 a USD/KRW close on another date must hold the FX effect');
  const fxSame = buildAttribution({ holdings: [{ symbol: 'AAA', value: 600, convertedFrom: 'USD' }], baseCurrency: 'KRW', rowFor: (s) => rows[s], marketReturnFor: market, usdkrwReturnPct: 2, usdkrwAsOf: '2026-10-12' });
  if (!fxSame.available || fxSame.fxAsOf !== '2026-10-12') fail('#22 a matching USD/KRW close must keep the FX effect and carry its date');
  // #18/#25: the 10/15/25% bands are internal — 10~25% is 참고, only above 25% is 주의; product names stay out of body text.
  const book18 = (top) => derivePortfolioChecks({ surface: { currencyState: 'declared-single', baseCurrency: 'USD', totalAssets: 100, positionValue: 100, rows: [{ symbol: 'AAA', value: top, currency: 'USD' }, ...Array.from({ length: 4 }, (_, i) => ({ symbol: `F${i}`, value: (100 - top) / 4, currency: 'USD' }))] } }).checks.find((check) => check.id === 'single-holding');
  if (book18(20).status !== 'info' || book18(26).status !== 'attention' || !/내부 구간/.test(book18(20).basis)) fail('#18 single-holding bands must read 내부 구간 · 10~25% 참고 · 25% 초과 주의');
  const checks25 = derivePortfolioChecks({ surface: { currencyState: 'declared-single', baseCurrency: 'USD', totalAssets: 100, positionValue: 100, rows: [{ symbol: 'AAA', value: 100, currency: 'USD' }] } }).checks;
  if (checks25.some((check) => /Ghostfolio/.test(`${check.detail} ${check.basis}`)) || !/\d{4}-\d{2}-\d{2}/.test(checks25.find((check) => check.id === 'region').detail)) fail('#25 product names belong in the hover source and the 65~69% band needs its date');
  // #12: the AI rows carry ticker·sector·weight·return in the base currency with the date — no amounts.
  const ai = portfolioRowsForAI(us, { sectorOf: () => 'Technology' });
  if (!ai.available || ai.baseCurrency !== 'KRW' || ai.rows[0].allocationPct !== 100 || ai.rows[0].returnPct !== 22 || 'value' in ai.rows[0] || 'cost' in ai.rows[0]) fail(`#12 portfolio AI rows wrong: ${JSON.stringify(ai)}`);
  if (portfolioRowsForAI({ currencyState: 'mixed-without-conversion', rows: [] }).available) fail('#12 an unconverted mix must not produce AI weights');
  // #6: TWR is period-cumulative, MWR annualized — the result names both units and the panel prints them.
  const coverage = Object.fromEntries(['trades', 'deposits-withdrawals', 'dividends-splits', 'fees-taxes', 'fx', 'valuation-cuts'].map((name) => [name, true]));
  const perf = assessAccountPerformance({ ledger: { currency: 'USD', dayCount: 'actual-365', flowTiming: 'end-of-period', coverage, transactions: [{ date: '2026-03-01', kind: 'trade', amount: 0 }], valuations: [{ date: '2026-01-01', amount: 100 }, { date: '2027-01-01', amount: 121 }] } });
  if (perf.status !== 'ready' || perf.units?.twr !== 'period-cumulative' || perf.units?.mwr !== 'annualized-irr') fail(`#6 account performance must name the TWR/MWR units: ${perf.status} ${JSON.stringify(perf.units)}`);
  const workspace = read('js/aio-workspace.js');
  if (!/TWR\(기간 누적\)/.test(workspace) || !/MWR\(연율\)/.test(workspace)) fail('#6 the ledger panel must label TWR(기간 누적) and MWR(연율)');
  // #8/#17/#16: thin 99% sample reads 표본 최악일 with the tail count; no Sharpe/MDD grades; internal codes folded.
  if (!/표본 최악일/.test(workspace) || !/thin99 = !\(n >= 100\)/.test(workspace)) fail('#8 a sub-100-day 99% VaR must read 표본 최악일');
  if (/'우수' : v >= 1 \? '양호'|'위험' : v >= 0\.15 \? '주의'/.test(workspace)) fail('#17 3-month Sharpe/MDD must not carry grades');
  if (/'경로 ' \+ est\.exposureHistoryMode/.test(workspace) || !/<summary>계산 식별자<\/summary>/.test(workspace)) fail('#16 internal path codes must not be printed in the panel body');
  // #2/#3: technical risk and the legacy diagnosis read the surface's base-currency values; no cost stand-in, no `$` hard-coding.
  const krData = read('js/aio-kr-data.js');
  if (/value: price != null \? price \* p\.qty/.test(workspace) || !/_aioPortfolioSurface/.test(workspace)) fail('#2 technical-risk weights must come from the base-currency surface');
  if (/\(d \? d\.price : p\.cost\)/.test(krData) || /현재 \$' \+ curPrice/.test(krData) || /일부 이익 실현 고려|리밸런싱 검토/.test(krData)) fail('#3/#5 the diagnosis must not value at cost, hard-code $, or instruct');
  // #9: a split (shares ×23.35, value ×0.99) is held as a split suspect; a real half-sale with a price rise is not.
  const { displayActionOf } = await import('../src/ui/pages/masters.js');
  if (displayActionOf({ action: 'INCREASED', shares: 2335, priorShares: 100, value: 99, priorValue: 100 }) !== 'SPLIT_SUSPECT') fail('#9 a split must not read as 증가');
  if (displayActionOf({ action: 'REDUCED', shares: 48, priorShares: 100, value: 63, priorValue: 100 }) !== 'REDUCED') fail('#9 a real reduction with a price rise must stay 감소');
  // #15: the glossary carries the portfolio/13F terms.
  const glossary = read('js/aio-glossary.js');
  if (!['VaR (Value at Risk)', '최대낙폭(MDD)', 'TWR(시간가중수익률)', 'MWR(금액가중수익률)', '13F (기관 보유 공시)', 'CUSIP', 'ROIC (투하자본이익률)'].every((term) => glossary.includes(`{term:'${term}'`))) fail('#15 glossary must define VaR·MDD·TWR·MWR·13F·CUSIP·ROIC');
}

// v57.81 (analysis audit 2026-10-15, data of 10/14-10/15): the portfolio market read.
{
  const regime = { available: true, overall: '혼조', counts: { favorable: 2, neutral: 2, burden: 2 }, axes: [{ id: 'breadth', state: 'burden' }] };
  const krRecord = { date: '2026-10-15', d1: -7.57, d5: -18.4, rec1: { n: 252, pct: 2 }, rec5: { n: 252, pct: 0 }, tail1: 2, tail5: 0, tail: 0, extreme: true };
  const krRows = [{ sym: '005930.KS', sector: 'Technology', pctSma50: -19.4, pctSma200: -10.09, adrPct: 4 }, { sym: '000660.KS', sector: 'Technology', pctSma50: -25.62, pctSma200: -14.36, adrPct: 5 }, { sym: 'QQQ', sector: 'ETF', pctSma50: 0.38, pctSma200: 8.37, adrPct: 1.04 }];
  const krBook = buildPortfolioRead({ surface: { rows: [{ symbol: '005930.KS', value: 40 }, { symbol: '000660.KS', value: 30 }, { symbol: 'QQQ', value: 30 }] }, rows: krRows, regime, krRecord });
  const market = krBook.points.find((point) => point.id === 'market');
  if (!market || /극단적이지 않아/.test(market.text) || !/한국 보유\(평가액의 70%\)/.test(market.text) || !/코스피 10\/15 하루 -7\.6%, 5거래일 -18\.4%로 최근 252거래일 기록에서/.test(market.text) || market.tone !== 'burden' || !/^미국 시장 상태\(6개 지표\)는/.test(market.text)) fail(`v57.81 a 70%-KR book on 10/15 gets the KR line, the US-labelled tally and no "극단적이지 않아": ${market?.text}`);
  if (!/한국 보유가 평가액의 70%/.test(krBook.headline) || !/미국 시장 상태는 '혼조'/.test(krBook.headline)) fail(`v57.81 the headline names the US state and the Korean part: ${krBook.headline}`);
  const trend = krBook.points.find((point) => point.id === 'trend');
  if (krBook.trendMix.find((row) => row.state === 'near').pct !== 30 || krBook.trendMix.find((row) => row.state === 'up').pct !== 0) fail(`v57.81 QQQ at +0.38% vs its 50-day line reads 선 근처, not 오르는 흐름: ${JSON.stringify(krBook.trendMix)}`);
  if (/미국 보유 중 하락 추세/.test(trend.text) || !/선 근처라 판정 보류/.test(krBook.headline)) fail(`v57.81 the US breadth clause covers only US holdings (KRX names in a downtrend are not "시장 폭" exposure): ${trend.text}`);
  // v57.83 codex audit F08: "미국 보유 중 X%" is measured on the US holdings with a trend read — US 50 all down beside
  // KR 50 all up is 100%, not 50%.
  const mixed = buildPortfolioRead({ surface: { rows: [{ symbol: 'AAPL', value: 50 }, { symbol: '005930.KS', value: 50 }] }, rows: [{ sym: 'AAPL', pctSma50: -10, pctSma200: -10 }, { sym: '005930.KS', pctSma50: 10, pctSma200: 10 }], regime });
  if (!/미국 보유 중 하락 추세 종목\(100%\)/.test(mixed.points.find((point) => point.id === 'trend').text)) fail(`v57.83 the US clause uses the US denominator: ${mixed.points.find((point) => point.id === 'trend').text}`);
  // Contradiction: '부담 우세' (burden 3 · favourable 1) can never be read as a calm environment.
  const heavy = buildPortfolioRead({ surface: { rows: [{ symbol: 'QQQ', value: 100 }] }, rows: krRows, regime: { ...regime, overall: '부담 우세', counts: { favorable: 1, neutral: 2, burden: 3 } } });
  const heavyMarket = heavy.points.find((point) => point.id === 'market');
  if (/극단적이지 않아/.test(heavyMarket.text) || heavyMarket.tone !== 'burden' || /한국 보유/.test(heavyMarket.text)) fail(`v57.81 the market sentence follows regime.overall: ${heavyMarket.text}`);
  // Clean case: a holding well above both lines stays 상승 추세.
  const clean = buildPortfolioRead({ surface: { rows: [{ symbol: 'MSFT', value: 100 }] }, rows: [{ sym: 'MSFT', sector: 'Technology', pctSma50: 5.95, pctSma200: 23.1, adrPct: 1.6 }], regime });
  if (clean.trendMix.find((row) => row.state === 'up').pct !== 100) fail('v57.81 clean: MSFT 5.95% above its 50-day line is still 상승 추세');
  // Rotation: XLK in the neutral band (RS-Ratio 100.33) and falling 4.5% against the S&P 500 in 5 sessions is held, not 선도.
  const rs = Array.from({ length: 60 }, (_, i) => ({ sessionDate: `d${i}`, value: 100 + Math.sin(i / 3) * 0.6 }));
  rs.push(...[100.4, 99.2, 98.0, 96.9, 95.9].map((value, i) => ({ sessionDate: `e${i}`, value })));
  const rotationRows = [{ sym: 'MSFT', sector: 'Technology', pctSma50: 5.95, pctSma200: 23.1 }];
  const xlkHeld = buildPortfolioRead({ surface: { rows: [{ symbol: 'MSFT', value: 100 }] }, rows: rotationRows, rotation: { XLK: { quadrant: 'Leading', rsRatio: 100.33, rsMomentum: 102.02, relativeStrength: rs } } });
  const rotation = xlkHeld.points.find((point) => point.id === 'rotation');
  if (!/0%가 시장보다 강해지는 '선도' 섹터/.test(rotation.text) || !/판정을 보류합니다/.test(rotation.text) || rotation.tone !== 'neutral' || xlkHeld.sectorMix[0].quadrant.label !== '판정 보류(경계)') fail(`v57.81 a quadrant inside the RRG band is 판정 보류, kept out of the tone: ${rotation.text}`);
  const xlkClear = buildPortfolioRead({ surface: { rows: [{ symbol: 'MSFT', value: 100 }] }, rows: rotationRows, rotation: { XLK: { quadrant: 'Leading', rsRatio: 105, rsMomentum: 103, relativeStrength: rs.slice(0, 60) } } });
  if (!/100%가 시장보다 강해지는 '선도' 섹터/.test(xlkClear.points.find((point) => point.id === 'rotation').text)) fail('v57.81 clean: a clear 선도 point without a recent reversal still reads 선도');
}

console.log(JSON.stringify({ ok: true, checks: ['P1462', 'P1463', 'P1464', 'P1466', 'P1467', 'P1468', 'P1469', 'v57.48-review-1·2·3·6·8·9·10·12·15·16·17·18·22·25', 'v57.81-portfolio-read'] }));
