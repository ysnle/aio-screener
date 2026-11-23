import { buildCompanyAnalysis } from '../../domain/entity/company-analysis.js';
import { businessProfileFor } from '../../domain/entity/business-profiles.js';
import { requestFiscalHistory, issuerSic, debtBasisFor } from './fiscal-read.js';
import { parseFiscalHistory } from '../../domain/fundamental/fiscal-read.js';
import { koreanThemeGroups } from '../../domain/market/korea/korea-participation.js';
import { refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { consensusView, peMultipleText } from '../../domain/fundamental/consensus-read.js';
import { requestConsensusEstimates, consensusRowFor } from '../../data/consensus-estimates.js';
import { readRowNumber } from '../../data/contracts/screener.js';
import { dividendYieldText } from '../../domain/screener/dividend-text.js';
import { KR_FUNDAMENTALS, SCENARIO_STATE } from '../../data/artifact-registry.js';
const mdOf = (date) => { const m = String(date || '').match(/^\d{4}-(\d{2})-(\d{2})/); return m ? `${Number(m[1])}/${Number(m[2])}` : ''; };
export function keyMetricsLine(row, consensus, earnings = [], today = new Date().toISOString().slice(0, 10), schedule = null) {
  if (!row) return null;
  const parts = [];
  const close = mdOf(row.factorSessionDate);
  const mcap = readRowNumber(row, 'mcap', 'display'), pe = readRowNumber(row, 'pe', 'display');
  const cap = mcap != null && mcap > 0 ? mcap : Number(row.referenceMarketCap?.billions) > 0 ? Number(row.referenceMarketCap.billions) : null;
  if (cap) parts.push(`시총 약 ${cap >= 1000 ? `${Number((cap / 1000).toFixed(2))}조 달러` : `${Math.round(cap * 10).toLocaleString('en-US')}억 달러`}${close ? `(${close} 종가)` : ''}`);
  const view = consensusView(row, consensus);
  if (view?.trailingPe != null) parts.push(`직전 4개 분기 PER ${peMultipleText(view.trailingPe)}(조정 EPS)`);
  else if (pe != null && pe > 0) parts.push(row._valuationPeEarningsBasis === 'ttm' && row._valuationPeEarningsThrough ? `최근 4개 분기 PER ${peMultipleText(pe)}(공시 순이익, ${String(row._valuationPeEarningsThrough).slice(0, 7)} 분기까지)` : `최근 회계연도 PER ${peMultipleText(pe)}`);
  if (view?.fwdPe != null) parts.push(`Forward PER ${peMultipleText(view.fwdPe)}(예상치 ${mdOf(view.asOf)})`);
  const dividend = dividendYieldText(row);
  if (dividend) parts.push(dividend);
  const symbol = String(row.sym || row.symbol || '').toUpperCase();
  const next = (Array.isArray(earnings) ? earnings : []).filter((item) => String(item?.symbol || '').toUpperCase() === symbol && String(item?.date || '') >= today).sort((a, b) => String(a.date).localeCompare(String(b.date)))[0];
  if (schedule?.text) parts.push(schedule.text);
  else if (next) parts.push(`다음 실적 발표 ${mdOf(next.date)}`);
  return parts.length ? parts.join(', ') : null;
}

export function renderCompanyAnalysis({ documentRef: doc, root = globalThis, state }) {
  if (!root) return null;
  root.__aioCompanyArgs = { state };
  const id = String(state?.id || root?._currentTickerId || '').trim().toUpperCase();
  const again = () => { if (root?._currentTickerId === id && doc.getElementById('page-ticker')?.classList.contains('active')) renderCompanyAnalysis({ documentRef: doc, root, ...root.__aioCompanyArgs }); };
  const valuation = doc?.getElementById('ticker-hero-valuation');
  if (valuation && valuation.dataset.symbol !== id) { valuation.dataset.symbol = id; valuation.textContent = ''; valuation.hidden = true; }
  if (!id || root?._aioOnDemandSymbol?.(id)?.status === 'not-listed') { root.__aioCompanyAnalysis = null; return null; }
  refreshSharedArtifact(root, SCENARIO_STATE).then(({ changed }) => { if (changed) again(); }).catch(() => {});
  if (/\.K[SQ]$/.test(id)) refreshSharedArtifact(root, KR_FUNDAMENTALS).then(({ changed }) => { if (changed) again(); }).catch(() => {});
  requestFiscalHistory(root, again, 'company');
  let rows = []; try { rows = root?._aioGetCanonicalScreenerRows?.() || []; } catch (_) { rows = []; }
  const onDemand = !/\.K[SQ]$/.test(id) && typeof root?._aioOnDemandSymbol === 'function' ? root._aioOnDemandSymbol(id) : null;
  const row = rows.find((item) => String(item.sym || item.symbol || '').toUpperCase() === id) || (onDemand?.status === 'ready' ? onDemand.row : null);
  const candidate = root?._aioEntitySummaries?.[id];
  const summary = candidate?.symbol === id ? candidate : null;
  const profile = businessProfileFor(id, row || {}, summary || {});
  const fundamentals = state?.id === id && state?.fundamentals?.symbol?.toUpperCase() === id ? state.fundamentals : onDemand?.sec?.symbol === id ? onDemand.sec : null;
  const history = root?._aioSecFiscalHistory?.[id];
  const model = buildCompanyAnalysis({ symbol: id, row, rows, summary, profile, fundamentals, fiscalHistory: typeof history === 'string' ? parseFiscalHistory(history) : Array.isArray(history) ? history : [], themes: [...(root?.THEME_MAP || []), ...koreanThemeGroups(root?.KR_THEME_MAP || {}, rows)], onDemand: onDemand?.status === 'ready' ? onDemand : null, sic: issuerSic(root, id), debtBasis: debtBasisFor(root, id) });
  root.__aioCompanyAnalysis = model;
  let keys = null;
  if (!/\.K[SQ]$/.test(id)) {
    requestConsensusEstimates(root, again);
    keys = keyMetricsLine(row, consensusRowFor(root, id), []);
  }
  if (valuation) { if (valuation.textContent !== (keys || '')) valuation.textContent = keys || ''; valuation.hidden = !keys; }
  return model;
}

/** The AI hand-off: a company (or fund) primer the page itself does not write, sent to the shared AI panel. */
export function companyAskButton(doc, root, id, { fund = false } = {}) {
  const ask = doc.createElement('button');
  ask.type = 'button';
  ask.className = 'aio-btn-table';
  ask.textContent = fund ? 'AI로 상품 분석' : 'AI로 기업 분석';
  ask.addEventListener('click', () => {
    const panel = doc.getElementById('ai-panel'); if (!panel?.classList.contains('open')) root.toggleAIPanel?.();
    const input = doc.getElementById('ai-panel-inp'); if (!input) return;
    input.value = fund
      ? `${id} 상품을 설명해줘. ① 무엇을 추종하는지(지수와 방식) ② 상위 구성 종목과 섹터 비중 ③ 총보수 ④ 최근 1년 수익률과 같은 기간 S&P 500 비교 ⑤ 비슷한 상품과의 차이. 웹검색으로 운용사 자료를 확인하고 각 숫자에 날짜를 붙여줘.`
      : `${id} 기업 프라이머를 만들어줘. ① 무엇을 하는 회사인지와 사업부문 ② 최근 3~4개 회계연도와 최근 12개월 매출·이익률·현금흐름 추이 ③ 밸류체인 위치·경쟁사·차별점 ④ 비교 기업 대비 밸류에이션 배수 ⑤ 자본 구조와 부채 ⑥ 다음 실적에서 확인할 숫자(다음 분기 가이던스 높이, 이익률 방향, 이익의 현금 전환) ⑦ 최근 촉매·뉴스 흐름과 위험. 기존 자료로 부족한 정보는 필요하면 웹검색으로 공식 출처를 확인하고, 매매 지시 없이 가능성과 확인 조건으로 정리해줘.`;
    input.focus();
  });
  return ask;
}
