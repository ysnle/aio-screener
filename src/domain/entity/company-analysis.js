// P1624: one issuer model for every registered symbol; no example-symbol branches.
import { buildFiscalRead, isLendingFinancial } from '../fundamental/fiscal-read.js';
import { deriveSecReport } from '../fundamental/sec-report.js';
import { resolveInstrument, INSTRUMENT_REGISTRY } from '../market/instrument-registry.js';
import { screenerMarket, marketRows, MARKET_POPULATION_POLICY } from '../screener/market-scope.js';
import { fieldValueForPurpose } from '../../data/contracts/screener.js';
import { latestCompletedUsSession, latestCompletedKrSession } from '../market/market-calendar.js';
import { outOfUniverseContext } from './out-of-universe-read.js';
import { signedText, finiteNumber as finite } from '../shared/number.js';
import { safeSourceUrl } from './business-profiles.js';
import { isIsoDay } from '../shared/session-date.js';

export const COMPANY_ANALYSIS_MODEL_VERSION = 'company-analysis.v1';
export function companyAnalysisContext(model) {
  if(!model?.available)return '';
  return `현재 선택 기업 ${model.symbol}. ${model.headline}\n정체성: ${model.identity.market||'시장 미확인'} / ${model.identity.assetType||'유형 미확인'} / ${model.identity.sector||'섹터 미확인'}${model.identity.industry ? ` (산업분류: ${model.identity.industry})` : ''}.\n사업: ${model.business.description || '내부 사업 설명 미수집. 필요하면 공식 회사 소개·공시의 사업부문을 웹검색으로 확인하고 추정하지 말 것.'}\n연결 테마: ${model.associations.map(item=>item.name).join(', ')||'없음'} (사업부문 매출 비중이 아님).\n재무: ${model.financial.periodEnd||'미확인'} 회계연도. ${model.financial.fiscal.points.map(item=>`${item.title}: ${item.text}`).join(' ')}\n관찰: ${model.risks.map(item=>item.text).join(' ')||'추가 관측 없음'}. 미수집 자료는 없음으로 알리고 출처·관측일을 분리할 것.${model.outOfUniverse?.context ? `\n${model.outOfUniverse.context}` : ''}`;
}
const sym = value => String(value || '').trim().toUpperCase();
const validDate = value => isIsoDay(value || '') && Number.isFinite(Date.parse(value));
const safeUrl = safeSourceUrl;
const signed = value => `${signedText(value, 1)}%`;
const fact = (row, field, key) => row?.fieldReadiness ? finite(fieldValueForPurpose(row, field, 'display')) : finite(row?.[key]);

export function buildCompanyAnalysis({ symbol, row = null, summary = null, profile = null, fundamentals = null, fiscalHistory = [], rows = [], themes = [], registry = INSTRUMENT_REGISTRY, nowMs = Date.now(), onDemand = null } = {}) {
  const id = sym(symbol);
  if (!id) return { modelVersion: COMPANY_ANALYSIS_MODEL_VERSION, available: false, symbol: null };
  const matchedRow = row && sym(row.sym || row.symbol) === id ? row : null;
  const matchedSummary = summary && sym(summary.symbol) === id ? summary : null;
  const market = matchedRow ? screenerMarket(matchedRow) : matchedSummary ? screenerMarket({ sym: id, market: matchedSummary.market }) : /\.K[QS]$/.test(id) ? 'KR' : null;
  const resolved = resolveInstrument({ symbol: id, market, publishedName: matchedRow?.name || matchedSummary?.name, registry });
  const currency = matchedRow?.instrumentRef?.currency || matchedRow?.currency || matchedSummary?.currency || resolved.currency || null;
  const rawType = String(matchedSummary?.instrumentType || matchedRow?.instrumentRef?.assetType || resolved.assetType || '').toUpperCase();
  const assetType = rawType === 'EQUITY' ? 'STOCK' : rawType || null;
  const isCompany = !['ETF','FUND','INDEX','MUTUALFUND'].includes(assetType);
  const name = matchedRow?.name || matchedSummary?.name || id;
  // A description is usable only when its own identity and source are supplied.
  const business = profile && sym(profile.symbol) === id && typeof profile.description === 'string' && profile.description.trim() && safeUrl(profile.sourceUrl)
    ? { description: profile.description.trim(), source: profile.source || '사업 설명 출처', sourceUrl: safeUrl(profile.sourceUrl), status: 'reference' }
    : { description: null, source: null, sourceUrl: null, status: 'missing' };
  const associations = [];
  for (const theme of Array.isArray(themes) ? themes : []) {
    const subThemes = (theme.subThemes || []).filter(sub => (sub.tickers || []).some(ticker => sym(ticker) === id));
    const themeName = theme.nameKr || theme.name || theme.id;
    // v57.54: a KR theme group's only sub-theme carries the group's own name ("반도체 / HBM · 반도체 / HBM") — a sub-theme
    // equal to its theme is not repeated, and one theme id is listed once.
    if ((subThemes.length || (theme.leaders || []).some(ticker => sym(ticker) === id)) && !associations.some(item => item.id === theme.id)) associations.push({ id: theme.id, name: themeName, subThemes: [...new Set(subThemes.map(sub => sub.name))].filter(sub => sub && sub !== themeName) });
  }
  const lastSession = market === 'KR' ? latestCompletedKrSession(nowMs) : market === 'US' ? latestCompletedUsSession(nowMs, { requirePrevious: false }) : null;
  const sessionDate = matchedRow?.factorSessionDate;
  const completedBasis = validDate(sessionDate) && !!lastSession?.date && sessionDate <= lastSession.date;
  const currentFactors = completedBasis && sessionDate === lastSession.date;
  const price = finite(matchedSummary?.quote?.price);
  const priceAt = matchedSummary?.quote?.observedAt || null;
  const priceMs = Date.parse(priceAt || '');
  const usablePrice = price > 0 && Number.isFinite(priceMs) && priceMs <= nowMs ? price : null;
  const returns = Object.fromEntries([['ret1m','price.ret1m'],['ret3m','price.ret3m'],['ret6m','price.ret6m']].map(([key, field]) => [key, completedBasis ? fact(matchedRow, field, key) : null]));
  const pctSma50 = completedBasis ? fact(matchedRow, 'price.pctSma50', 'pctSma50') : null;
  const pctSma200 = completedBasis ? fact(matchedRow, 'price.pctSma200', 'pctSma200') : null;
  const peers = marketRows(rows, market).filter(peer => peer.factorSessionDate === sessionDate && finite(fact(peer, 'price.ret3m', 'ret3m')) != null);
  const relative = completedBasis && returns.ret3m != null && peers.some(peer => sym(peer.sym || peer.symbol) === id)
    ? { window: '3개월', rank: peers.filter(peer => fact(peer, 'price.ret3m', 'ret3m') > returns.ret3m).length + 1, peers: peers.length, value: returns.ret3m, asOf: sessionDate }
    : null;
  const compositeRank = matchedRow?.populationPolicy === MARKET_POPULATION_POLICY && currentFactors && matchedRow.rankingEligibility === 'eligible' ? finite(matchedRow.rank) : null;
  const matchedFundamentals = fundamentals && sym(fundamentals.symbol) === id && isCompany && market !== 'KR' ? fundamentals : null;
  const filingAt = matchedFundamentals?.acceptedAt || matchedFundamentals?.filedAt;
  const filingMs = Date.parse(filingAt || '');
  const report = matchedFundamentals ? deriveSecReport(matchedFundamentals) : null;
  const officialFiling = matchedFundamentals?.sourceTier === 'official-regulator' || matchedFundamentals?.sourceKind === 'T1_OFFICIAL';
  const usableFundamentals = matchedFundamentals && officialFiling && matchedFundamentals.periodType === 'FY' && validDate(matchedFundamentals.observedAt)
    && Date.parse(matchedFundamentals.observedAt) <= nowMs && Number.isFinite(filingMs) && filingMs <= nowMs && report?.status === 'current' ? matchedFundamentals : null;
  const annualHistory = usableFundamentals ? (Array.isArray(fiscalHistory) ? fiscalHistory : []).filter(year => validDate(year.periodEnd) && Date.parse(year.periodEnd) <= nowMs && (!year.symbol || sym(year.symbol) === id)) : [];
  const fiscal = buildFiscalRead({ symbol: id, fundamentals: usableFundamentals ? { ...usableFundamentals, fiscalHistory: annualHistory } : null, row: matchedRow });
  const risks = [];
  const latest = fiscal.latest;
  if (finite(latest?.netIncome) < 0) risks.push({ id:'loss', text:`${latest.periodEnd} 연간 공시는 순손실입니다. 매출 성장과 순이익을 구분해서 확인합니다.` });
  if (fiscal.lastGrowth != null && fiscal.lastGrowth < 0) risks.push({ id:'revenue', text:`최근 회계연도 매출은 전년 대비 ${signed(fiscal.lastGrowth)}입니다.` });
  if (finite(latest?.equity) < 0) risks.push({ id:'equity', text:'공시 자기자본이 음수입니다. 일반적인 양(+)의 자기자본 ROE 해석을 적용하지 않습니다.' });
  if (finite(latest?.operatingCashFlow) < 0 && !isLendingFinancial(matchedRow?.symbol || resolved?.symbol, matchedRow?.sector)) risks.push({ id:'cash', text:'최근 회계연도 영업현금흐름은 유출입니다. 원인과 다음 공시에서의 변화를 확인할 지점입니다.' });
  // v58.74 (text audit): the 50-day distance is the summary reading right above this list (with its own near-line rule),
  // so the list keeps only the observations that reading lacks.
  // v57.81: an on-demand row (out-of-universe listing) is not a registered universe row.
  const identity = { registered: !!matchedRow && !matchedRow.onDemand, verification: resolved.verification, name, market, currency, assetType, sector: matchedRow?.sector || null, industry: matchedRow?.industry || matchedSummary?.industry || null, source: matchedRow?.identitySource || matchedSummary?.sourceUrl || null };
  const financialStatus = !isCompany ? 'not-applicable' : market === 'KR' ? 'kr-disclosure-required' : fiscal.available ? 'reference' : 'missing';
  // 2026-10-13 review S11: '이 종목의 지금' above already shows the factor rank; a second rank over a different
  // denominator (3-month return among same-session peers) read as a contradiction, so the headline keeps the return.
  const priceStatement = returns.ret3m != null ? `3개월 수익률 ${signed(returns.ret3m)}` : '확정 종가 기준의 수익률 자료가 없습니다';
  const headline = `${name} — ${priceStatement}${fiscal.headline ? ` / 연간 공시 ${fiscal.headline}` : ''}`;
  return { modelVersion: COMPANY_ANALYSIS_MODEL_VERSION, available: true, symbol:id, headline, identity, business, associations,
    price: { value:usablePrice, currency, observedAt:usablePrice != null ? priceAt : null, source:matchedSummary?.quote?.source || null, status:usablePrice != null ? 'reference' : 'missing' },
    marketEvidence: { asOf:completedBasis ? sessionDate : null, status:currentFactors ? 'reference' : completedBasis ? 'delayed' : 'missing', returns, pctSma50, pctSma200, relative, compositeRank },
    financial: { status:financialStatus, fiscal, source:usableFundamentals?.source || 'SEC EDGAR companyfacts', periodEnd:usableFundamentals?.observedAt || null, filedAt:usableFundamentals?.filedAt || null, sourceUrl:report?.filingUrl || null }, risks,
    outOfUniverse: onDemand && sym(onDemand.symbol) === id ? { computedAt: onDemand.computedAt || null, context: outOfUniverseContext(onDemand) } : null };
}
