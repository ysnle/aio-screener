// P1462–P1469 (v57.19 takeover review): executable negative controls for the meaning fixes.
import { readFileSync } from 'node:fs';
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
const rows = { AAA: { sym: 'AAA', ret3m: 10, sector: 'Technology' }, XLK: { sym: 'XLK', ret3m: 6 }, '000001.KS': { sym: '000001.KS', ret3m: -12, sector: 'Technology' } };
const market = (symbol) => (/\.KS$/.test(symbol) ? { ret3m: -15, label: '코스피' } : { ret3m: 3, label: 'S&P 500(SPY)' });
const attribution = buildAttribution({ holdings: [{ symbol: 'AAA', value: 600, convertedFrom: 'USD' }, { symbol: '000001.KS', value: 200 }], cash: 200, baseCurrency: 'KRW', rowFor: (s) => rows[s], marketReturnFor: market, usdkrwReturnPct: 2 });
const excessSum = attribution.excess.reduce((sum, part) => sum + part.pct, 0);
if (!attribution.available || !near(excessSum, attribution.excessPct) || !near(attribution.totalPct, 4.92) || !near(attribution.blendedPct, -1.5)) fail(`P1466 attribution identity broken: ${JSON.stringify(attribution.excess)} total ${attribution.totalPct}`);
if (attribution.components.find((c) => c.id === 'sector').pct !== 1.8 || attribution.excess.find((c) => c.id === 'cash').pct !== 0.3) fail('P1466 sector/cash components drifted');
if (!near(fxReturnInto('KRW', 'USD', 2), 1 / 1.02 - 1, 1e-9) || fxReturnInto('EUR', 'KRW', 2) !== null) fail('P1466 FX conversion must invert KRW→USD and refuse unknown pairs');
const noFx = buildAttribution({ holdings: [{ symbol: 'AAA', value: 100, convertedFrom: 'USD' }], baseCurrency: 'KRW', rowFor: (s) => rows[s], marketReturnFor: market, usdkrwReturnPct: null });
if (noFx.available || noFx.skipped[0]?.reason !== 'no-fx') fail('P1466 a converted holding without an FX return must be skipped, not counted at 0');
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
if (!/termPremium10:\s+\{ id: 'THREEFYTP10'/.test(read('scripts/fetch-data.mjs')) || !/Kim-Wright/.test(read('src/ui/components/macro-board.js'))) fail('P1469 term premium series or model label missing');

console.log(JSON.stringify({ ok: true, checks: ['P1462', 'P1463', 'P1464', 'P1466', 'P1467', 'P1468', 'P1469'] }));
