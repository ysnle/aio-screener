// P1462–P1469 (v57.19 takeover review): executable negative controls for the meaning fixes.
import { readFileSync } from 'node:fs';
import { readProducerSource } from './lib/producer-source.mjs'; // v57.62: fetch-data.mjs + the lib modules split out of it
import { liveScreenerModelFingerprint, buildRankingIdentity } from '../src/domain/screener/model-fingerprint.js';
import { SCREENER_COLUMN_REGISTRY } from '../src/ui/pages/screener.js';
import { buildAttribution, fxReturnInto } from '../src/domain/portfolio/attribution.js';
import { buildPortfolioRead } from '../src/domain/portfolio/portfolio-read.js';
import { buildPeerRead, fiscalMetrics } from '../src/domain/fundamental/peer-read.js';
import { measureFactorOverlap, overlapSentence } from '../src/domain/screener/factor-overlap.js';
import { derivePortfolioSurface } from '../src/domain/portfolio/surface.js';
import { createCompositionSnapshot, deriveRiskEstimate, assessAccountPerformance } from '../src/domain/portfolio/risk.js';
import { assembleRiskEstimateInput } from '../src/ui/panels/portfolio-risk-input.js';
import { normalizeSecCompanyFacts } from '../src/domain/fundamental/sec-normalize.js';
import { deriveVarStability } from '../src/domain/portfolio/return-stats.js';
import { _calcDailyReturns } from '../src/domain/portfolio/backtest.js';
import { deriveConcentrationRisk } from '../src/domain/portfolio/concentration.js';
import { rangeExtremesOf } from '../src/domain/technical/definitions.js';
import { shareClassTag } from '../src/ui/pages/masters.js';

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
if (!attribution.available || !near(excessSum, attribution.excessPct) || !near(attribution.totalPct, 3.95) || !near(attribution.blendedPct, -2.37)) fail(`P1466 attribution identity broken: ${JSON.stringify(attribution.excess)} total ${attribution.totalPct}`);
// Portfolio audit 2026-10-17: weights are start-of-window values (today's value ÷ its 3-month base-currency growth).
if (attribution.components.find((c) => c.id === 'sector').pct !== 1.67 || attribution.excess.find((c) => c.id === 'cash').pct !== 0.49) fail('P1466 sector/cash components drifted');
const lookAhead = buildAttribution({ holdings: [{ symbol: 'AAA', value: 200 }, { symbol: 'BBB', value: 100 }], rowFor: (s) => ({ AAA: { ret3m: 100, factorSessionDate: '2026-10-12' }, BBB: { ret3m: 0, factorSessionDate: '2026-10-12' } })[s], marketReturnFor: market });
if (!near(lookAhead.totalPct, 50)) fail(`portfolio audit 2026-10-17 today's quantities went 200 → 300 (+50%), not the end-weighted +66.7%: ${lookAhead.totalPct}`);
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
if (!/환율 포함, 현금은 수익률 0%로 계산/.test(relative) || !/차이의 구성: 섹터 \+1\.7%p/.test(relative)) fail(`P1466 the 지수 대비 sentence must come from the attribution: ${relative}`);

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
if (!/겹치지 않는 정보 약/.test(overlapSentence(overlap)) || measureFactorOverlap(synthetic.slice(0, 10), ['momentum', 'trend'])) fail('P1468 overlap sentence or minimum sample drifted');

// P1469: the term premium comes from the official FRED series and is named by its model.
if (!/termPremium10:\s+\{ id: 'THREEFYTP10'/.test(readProducerSource()) || !/Kim-Wright/.test(read('src/ui/components/macro-board.js'))) fail('P1469 term premium series or model label missing');

// v57.48 expert review (portfolio, 13F, research). Hypothetical holdings only.
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
  if (book18(20).status !== 'info' || book18(26).status !== 'attention' || !/내부 구간/.test(book18(20).basis)) fail('#18 single-holding bands must read 내부 구간, 10~25% 참고, 25% 초과 주의');
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
  const workspace = read('js/aio-workspace.js') + read('src/ui/components/portfolio-risk-metrics.js'); // v59.05: risk panel moved to src/
  if (!/TWR\(기간 누적/.test(workspace) || !/MWR\(연율\)/.test(workspace)) fail('#6 the ledger panel must label TWR(기간 누적) and MWR(연율)');
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
  // Contradiction: '부담 우세' (burden 3, favourable 1) can never be read as a calm environment.
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
  if (!/0%가 시장보다 강해지는 '선도' 섹터/.test(rotation.text) || !/판정을 보류합니다/.test(rotation.text) || rotation.tone !== 'neutral' || xlkHeld.sectorMix[0].quadrant.label !== '판정 보류(기준선 부근)') fail(`v57.81 a quadrant inside the RRG band is 판정 보류, kept out of the tone: ${rotation.text}`);
  const xlkClear = buildPortfolioRead({ surface: { rows: [{ symbol: 'MSFT', value: 100 }] }, rows: rotationRows, rotation: { XLK: { quadrant: 'Leading', rsRatio: 105, rsMomentum: 103, relativeStrength: rs.slice(0, 60) } } });
  if (!/100%가 시장보다 강해지는 '선도' 섹터/.test(xlkClear.points.find((point) => point.id === 'rotation').text)) fail('v57.81 clean: a clear 선도 point without a recent reversal still reads 선도');
}

// v57.92 exhaustive audit E01–E08: synthetic counterexamples that passed the earlier fixtures.
{
  const now = Date.parse('2026-10-16T13:00:00Z');
  // E01: a KRW cost on an undeclared US quote is a unit conflict (listing fallback), not a -99.9% loss.
  const e01 = derivePortfolioSurface({ now, state: { readState: 'ready', baseCurrency: 'USD', cash: 0, holdings: [{ symbol: 'AAA', shares: 1, price: 100, avgCost: 140000, costCurrency: 'KRW' }] } });
  if (e01.totalPnl != null || e01.costCurrencyState !== 'cost-price-mismatch-held') fail(`E01 KRW cost on a USD-listed quote must hold P&L: ${e01.totalPnl} ${e01.costCurrencyState}`);
  const snapshot = createCompositionSnapshot({ members: [{ ticker: 'AAA', qty: 1, price: 100 }], cash: { amount: 25, currency: 'USD' }, baseCurrency: 'USD', asOf: new Date(now).toISOString(), weightBasis: 'whole_account' });
  const risk = (extra) => deriveRiskEstimate({ snapshot, returnsMap: { AAA: [0.1, 0.1] }, exposureHistoryMode: 'current_composition_retrospective', ...extra });
  // E02: the cash rate that changed the account path is part of the identity.
  const cash0 = risk({ cashReturn: { mode: 'explicit_assumption', annualRate: 0 } });
  const cash10 = risk({ cashReturn: { mode: 'explicit_assumption', annualRate: 0.1 } });
  if (cash0.publishedReturns[0] === cash10.publishedReturns[0] || cash0.estimateId === cash10.estimateId) fail('E02 different cash rates must give different returns and different estimateIds');
  // E03: the invested sleeve of an 80% stock / 20% cash target is the stock's own return, every bar and every policy.
  for (const policy of ['daily', 'buy-and-hold']) {
    const sleeve = risk({ exposureHistoryMode: 'fixed_target_weight_strategy', targetWeights: { AAA: 0.8 }, rebalancePolicy: policy }).investedSleeveReturns;
    if (!sleeve.every((value) => near(value, 0.1, 1e-9))) fail(`E03 ${policy} sleeve must be [0.1,0.1]: ${JSON.stringify(sleeve)}`);
  }
  // E04: one USD holding in a KRW account is a foreign holding — local return without FX history is labelled.
  const dates = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-12'];
  const fxInput = { positions: [{ ticker: 'AAA', qty: 1, currency: 'USD' }], priceEvidenceMap: { AAA: { value: 100, allowedUse: true, ts: now, source: 'fixture' } }, historyMap: { AAA: Object.fromEntries(dates.map((day, i) => [day, 100 + i])) }, validTickers: ['AAA'], commonDates: dates, cashValue: 0, declarations: { baseCurrency: 'KRW' }, fxLegs: [{ from: 'USD', to: 'KRW', rate: 1400, observedAt: new Date(now).toISOString(), source: 'fixture' }], nowIso: new Date(now).toISOString() };
  const noFx = assembleRiskEstimateInput(fxInput);
  const withFx = assembleRiskEstimateInput({ ...fxInput, fxHistory: dates.map((date, i) => ({ date, value: 1300 + i * 20 })) });
  if (noFx.fxIncluded !== false || noFx.returnCurrencyBasis !== 'local-currency-per-holding') fail(`E04 USD-only/KRW-base without FX history: ${noFx.returnCurrencyBasis}/${noFx.fxIncluded}`);
  if (withFx.fxIncluded !== true || withFx.returnCurrencyBasis !== 'KRW-incl-fx') fail(`E04 USD-only/KRW-base with FX history: ${withFx.returnCurrencyBasis}/${withFx.fxIncluded}`);
  // Portfolio audit 2026-10-17: two lots of one ticker add up (AAA 1 + 9 shares beside BBB 10 at $100 is 50/50, not 64/36).
  const lots = assembleRiskEstimateInput({ ...fxInput, positions: [{ ticker: 'AAA', qty: 1, currency: 'USD' }, { ticker: 'AAA', qty: 9, currency: 'USD' }, { ticker: 'BBB', qty: 10, currency: 'USD' }], priceEvidenceMap: { AAA: fxInput.priceEvidenceMap.AAA, BBB: fxInput.priceEvidenceMap.AAA }, historyMap: { AAA: fxInput.historyMap.AAA, BBB: fxInput.historyMap.AAA }, validTickers: ['AAA', 'BBB'], declarations: { baseCurrency: 'USD' }, fxLegs: [] });
  const lotWeight = (lots.snapshot?.members || []).filter((m) => m.ticker === 'AAA').reduce((sum, m) => sum + m.resolvedWeight, 0);
  if (!near(lotWeight, 0.5, 1e-9)) fail(`portfolio audit 2026-10-17 lots of one ticker must sum to its weight (0.5), got ${lotWeight}`);
  const shortCash = risk({ cashReturn: { mode: 'observed_cash_series', series: [0.0001] } });
  if ((shortCash.wholeAccountReturns || []).some((value) => !Number.isFinite(value))) fail('portfolio audit 2026-10-17 a cash series shorter than the member series must hold the account path, not publish NaN');
  const holiday = _calcDailyReturns([101, 90], ['2024-05-24', '2024-05-28']);
  if (holiday.length !== 1 || !near(holiday[0], 90 / 101 - 1, 1e-12)) fail(`portfolio audit 2026-10-17 a return across a holiday (Fri → Tue) is kept: ${JSON.stringify(holiday)}`);
  if (deriveConcentrationRisk({ positions: [{ ticker: 'A', price: 10 }] }).heldItems[0]?.reason !== 'quantity-unavailable') fail('portfolio audit 2026-10-17 a missing quantity is held, not valued at 0');
  // E05: a Q4 EPS in the same 10-K (fp=FY, same end) cannot set the annual share count, whatever the row order.
  const annual = { start: '2025-01-01', end: '2025-12-31', filed: '2026-02-15', form: '10-K', fp: 'FY', fy: 2025, accn: 'fixture' };
  const sec = (eps) => normalizeSecCompanyFacts('AAA', { cik: 1, facts: { 'us-gaap': { Revenues: { units: { USD: [{ ...annual, val: 1000 }] } }, NetIncomeLoss: { units: { USD: [{ ...annual, val: 100 }] } }, EarningsPerShareDiluted: { units: { 'USD/shares': eps } } } } }, 10);
  const eA = { ...annual, val: 1 }, eQ = { ...annual, start: '2025-10-01', val: 0.2 };
  if (sec([eQ, eA]).pe !== 10 || sec([eA, eQ]).pe !== 10) fail(`E05 P/E must use the annual EPS in either order: ${sec([eQ, eA]).pe}/${sec([eA, eQ]).pe}`);
  // E06: the "VaR/CVaR certified" claim covers CVaR — one -90% day that moves only CVaR holds it.
  const baseTail = Array.from({ length: 100 }, (_, i) => (i % 3 === 0 ? -0.02 : 0.01));
  const steady = deriveVarStability({ returns: baseTail, order: 'chronological' });
  if (steady.certification !== 'certified' || steady.cvarCertification !== 'certified') fail('E06 control: the steady sample certifies both VaR and CVaR');
  const outlier = deriveVarStability({ returns: [-0.9, ...baseTail.slice(1)], order: 'chronological' });
  if (outlier.cvarCertification !== 'held' || !outlier.cvarCertificationReasons.some((reason) => /^cvar-/.test(reason))) fail(`E06 a CVaR-only tail shock must hold CVaR certification: ${outlier.cvarCertificationReasons}`);
  // E07: lending peers leave the FCF-margin comparison set on the peer side too.
  const series = (ocf) => [{ periodEnd: '2024-12-31', revenue: 100, equity: 100 }, { periodEnd: '2025-12-31', revenue: 100, equity: 100, netIncome: 10, operatingCashFlow: ocf, capex: 0 }];
  const visa = buildPeerRead({ symbol: 'V', sector: 'Financials', peers: ['JPM', 'BAC', 'C', 'WFC', 'GS'], seriesFor: (t) => series(t === 'V' ? 20 : 50) });
  const fcf = visa.rows?.find((row) => row.id === 'fcfMargin');
  if (fcf && fcf.percentile != null) fail(`E07 Visa FCF margin must not be ranked against banks: percentile ${fcf.percentile}`);
  // E08: a flow between valuations makes the TWR a boundary approximation, and it says so.
  const coverage = Object.fromEntries(['trades', 'deposits-withdrawals', 'dividends-splits', 'fees-taxes', 'fx', 'valuation-cuts'].map((key) => [key, true]));
  const perf = (marks) => assessAccountPerformance({ ledger: { currency: 'USD', dayCount: 'actual-365', flowTiming: 'end-of-period', coverage, transactions: [{ date: '2026-06-30', kind: 'deposit', amount: 50 }], valuations: marks } });
  const sparse = perf([{ date: '2026-01-01', amount: 100 }, { date: '2027-01-01', amount: 160 }]);
  const dense = perf([{ date: '2026-01-01', amount: 100 }, { date: '2026-06-30', amount: 150 }, { date: '2027-01-01', amount: 160 }]);
  if (sparse.twrExact !== false || !sparse.warnings.some((text) => /근사치/.test(text))) fail('E08 sparse valuations must mark the TWR as an approximation');
  if (dense.twrExact !== true || !near(dense.twr, 0.066667, 1e-5)) fail(`E08 a valuation on the flow date gives the exact chain: ${dense.twr}`);
}

// v57.92 internal review M02 + audit K01 + masters share class.
{
  // M02: a full-year range needs a year of real bars, not a year-long array of empty rows.
  const empty = Array(239).fill(null);
  const sparse = rangeExtremesOf([...empty, 10], [...empty, 9]);
  if (!sparse || sparse.fullYear !== false) fail(`M02 239 empty rows + 1 bar must not be a 52-week range: ${JSON.stringify(sparse)}`);
  const year = Array.from({ length: 252 }, (_, i) => 10 + (i % 5));
  if (rangeExtremesOf(year, year.map((v) => v - 1))?.fullYear !== true) fail('M02 252 real bars are a full-year range');
  const gap = year.map((v, i) => (i === 100 ? null : v));
  if (rangeExtremesOf(gap, gap.map((v) => (v == null ? null : v - 1)))?.fullYear !== true) fail('M02 one interior gap keeps a full-year range');
  // K01: generic words (yield, quality, policy, memory) must not attach macro facts to AI/hardware foundations.
  const evidence = (id) => JSON.parse(read(`public-data/knowledge/articles/atlas-foundations/${id}.json`)).article.researchEvidence.map((fact) => fact.factId);
  const crossed = [['capacity-and-yield', /fred|nyfed/], ['data-quality', /bls:cpi/], ['post-training', /fed:|nyfed/], ['evaluation', /sec:/], ['parameter-vs-external-memory', /tsmc|micron/]]
    .filter(([id, pattern]) => evidence(id).some((factId) => pattern.test(factId)));
  if (crossed.length) fail(`K01 cross-domain evidence attached: ${crossed.map(([id]) => id).join(', ')}`);
  // Masters: two share classes of one issuer read apart.
  if (shareClassTag('CAP STK CL A') !== 'A주' || shareClassTag('CAP STK CL C') !== 'C주' || shareClassTag('COM') !== null || shareClassTag('CLASS B COM') !== 'B주') fail('masters share-class tag');
}

// v58.77 pipeline pass-2: retained Cboe value is not this run's success; FMP query keeps one '?'; dossier facts by whole word.
{
  const { planeFresh } = await import('./producer/source-planes.mjs');
  if (planeFresh('putCall', { fetchedAt: '2026-10-23T21:00Z', status: 'stale-reference', failureReason: 'HTTP 503', totalPutCall: 0.9 })) fail('P2-DATA-06 a retained put/call value counted as fresh');
  if (!planeFresh('putCall', { fetchedAt: '2026-10-24T21:00Z', status: 'current-reference', totalPutCall: 0.9 })) fail('P2-DATA-06 a current put/call read must stay fresh');
  if (/prior\.putCall\?\.asOf/.test(read('scripts/producer/source-planes.mjs')) && !/prior\.putCall\?\.totalPutCall != null/.test(read('scripts/producer/source-planes.mjs'))) fail('P2-DATA-06 null totalPutCall must not be retained as 0');
  if (!/endpoint\.includes\('\?'\) \? '&' : '\?'/.test(read('scripts/producer/screener.mjs'))) fail('P2-DATA-07 FMP endpoint with a query must append apikey with &');
  const dossierFacts = (id) => JSON.parse(read(`public-data/knowledge/research-dossiers/${id}.json`)).researchFactIds || [];
  const wrong = [['atlas-foundation_evaluation', /sec:/], ['principles_evaluation', /sec:/]].filter(([id, pattern]) => dossierFacts(id).some((f) => pattern.test(f)));
  if (wrong.length) fail(`P2-KNOW-02 substring evidence attached: ${wrong.map(([id]) => id).join(', ')}`);
  const kept = [['principles_power-cooling', 'fact:doe:pue'], ['principles_inflation-deflation', 'fact:bls:cpi'], ['product_micron-hbm-family', 'fact:micron:hbm2e']].filter(([id, fact]) => !dossierFacts(id).includes(fact));
  if (kept.length) fail(`P2-KNOW-02 whole-word evidence lost: ${kept.map(([id]) => id).join(', ')}`);
}

console.log(JSON.stringify({ ok: true, checks: ['v58.77-pass2-P2-DATA-06-07-KNOW-02', 'P1462', 'P1463', 'P1464', 'P1466', 'P1467', 'P1468', 'P1469', 'v57.48-review-1·2·3·6·8·9·10·12·15·16·17·18·22·25', 'v57.81-portfolio-read', 'v57.92-E01-E08', 'v57.92-M02-K01-masters'] }));
