// v59.51 (content audit): the 기업 요약 card was a second summary of the stock (the fiscal headline, the tab links, the
// classification and a three-line fundamentals list that '이 종목의 지금' and 재무 공시 already show). What stays: the
// company model the AI panel reads (root.__aioCompanyAnalysis), the 시총·PER line under the price, the ticker's event brief,
// and the observations list as a closed expert fold.
import { buildCompanyAnalysis } from '../../domain/entity/company-analysis.js';
import { businessProfileFor } from '../../domain/entity/business-profiles.js';
import { parseFiscalHistory, requestFiscalHistory, dartLink } from './fiscal-read.js';
import { koreanThemeGroups } from '../../domain/market/korea-participation.js';
import { refreshSharedArtifact, SCENARIO_STATE } from '../../data/shared-artifacts.js';
import { KR_FUNDAMENTALS, krFundamentalPoints } from '../../domain/entity/kr-fundamentals.js';
import { consensusView, peMultipleText } from '../../domain/fundamental/consensus-read.js';
import { requestConsensusEstimates, consensusRowFor } from '../../data/consensus-estimates.js';
import { readRowNumber } from '../../data/contracts/screener.js';
const mdOf = (date) => { const m = String(date || '').match(/^\d{4}-(\d{2})-(\d{2})/); return m ? `${Number(m[1])}/${Number(m[2])}` : ''; };
// v57.55 review (8m, semi-expert panel): the numbers a reader looks for first, on one line, each with its own date. US
// listings only (Korean listings have their own OpenDART block); a value that is not there is left out, never estimated.
export function keyMetricsLine(row, consensus, earnings = [], today = new Date().toISOString().slice(0, 10), schedule = null) {
  if (!row) return null;
  const parts = [];
  const close = mdOf(row.factorSessionDate);
  const mcap = readRowNumber(row, 'mcap', 'display'), pe = readRowNumber(row, 'pe', 'display');
  const cap = mcap != null && mcap > 0 ? mcap : Number(row.referenceMarketCap?.billions) > 0 ? Number(row.referenceMarketCap.billions) : null;
  // v58.80 (first-users F33): $4.61T / $95B read as English units to a Korean reader; the same 조/억 달러 as the calendar.
  if (cap) parts.push(`시총 약 ${cap >= 1000 ? `${Number((cap / 1000).toFixed(2))}조 달러` : `${Math.round(cap * 10).toLocaleString('en-US')}억 달러`}${close ? `(${close} 종가)` : ''}`);
  const view = consensusView(row, consensus);
  if (view?.trailingPe != null) parts.push(`직전 4개 분기 PER ${peMultipleText(view.trailingPe)}(조정 EPS)`);
  else if (pe != null && pe > 0) parts.push(row._valuationPeEarningsBasis === 'ttm' && row._valuationPeEarningsThrough ? `최근 4개 분기 PER ${peMultipleText(pe)}(공시 순이익, ${String(row._valuationPeEarningsThrough).slice(0, 7)} 분기까지)` : `최근 회계연도 PER ${peMultipleText(pe)}`);
  if (view?.fwdPe != null) parts.push(`Forward PER ${peMultipleText(view.fwdPe)}(예상치 ${mdOf(view.asOf)})`);
  const symbol = String(row.sym || row.symbol || '').toUpperCase();
  const next = (Array.isArray(earnings) ? earnings : []).filter((item) => String(item?.symbol || '').toUpperCase() === symbol && String(item?.date || '') >= today).sort((a, b) => String(a.date).localeCompare(String(b.date)))[0];
  // v58.75 (persona review): the schedule read (next date with session count, or the last report and "미확정") when loaded.
  if (schedule?.text) parts.push(schedule.text);
  else if (next) parts.push(`다음 실적 발표 ${mdOf(next.date)}`);
  return parts.length ? parts.join(', ') : null;
}

function element(doc, tag, text, className) { const node=doc.createElement(tag); if (text != null) node.textContent=text; if (className) node.className=className; return node; }
// P1624: this renderer reads existing issuer-keyed caches only; no provider or paid calls.
export function renderCompanyAnalysis({ documentRef:doc, root=globalThis, state, fundamentalsState=null }) {
  const host=doc?.getElementById('ticker-company-analysis'); if (!host) return null;
  host._aioCompanyArgs={state,fundamentalsState}; // late repaints use the latest route state (see renderStockRead)
  const id=String(state?.id || root?._currentTickerId || '').trim().toUpperCase();
  const valuationNode=doc.getElementById('ticker-hero-valuation');
  if (valuationNode && valuationNode.dataset.symbol!==id) { valuationNode.dataset.symbol=id; valuationNode.textContent=''; valuationNode.hidden=true; }
  if (!id) { host.hidden=true; host.replaceChildren(); root.__aioCompanyAnalysis=null; return null; }
  // First-users run 4 (breaker #11): a symbol the US listing refused has no company to summarise (it read '다음 실적 일정 미확정').
  if (root?._aioOnDemandSymbol?.(id)?.status === 'not-listed') { host.hidden=true; host.replaceChildren(); delete host.dataset.signature; root.__aioCompanyAnalysis=null; return null; }
  // P1654: Korean listings read OpenDART annual accounts (loaded once per TTL; re-render when a new copy arrives).
  // 2026-10-14 audit #5: the theme stage rows (scenario-state.json) are read here too, not only after 거시 opened them.
  refreshSharedArtifact(root, SCENARIO_STATE).then(({ changed }) => { if (changed && root?._currentTickerId === id) renderCompanyAnalysis({documentRef:doc,root,...host._aioCompanyArgs}); }).catch(() => {});
  if (/\.K[SQ]$/.test(id)) refreshSharedArtifact(root, KR_FUNDAMENTALS).then(({ changed }) => { if (changed && root?._currentTickerId === id) renderCompanyAnalysis({documentRef:doc,root,...host._aioCompanyArgs}); }).catch(() => {});
  requestFiscalHistory(root, () => {
    if (root?._currentTickerId === id && doc.getElementById('page-ticker')?.classList.contains('active')) renderCompanyAnalysis({documentRef:doc,root,...host._aioCompanyArgs});
  }, 'company');
  let rows=[]; try { rows=root?._aioGetCanonicalScreenerRows?.() || []; } catch (_) {}
  // v57.81: an out-of-universe US listing reads its on-demand row and SEC record (same formulas, computed on request).
  const onDemand=!/\.K[SQ]$/.test(id) && typeof root?._aioOnDemandSymbol==='function' ? root._aioOnDemandSymbol(id) : null;
  const row=rows.find(item=>String(item.sym || item.symbol || '').toUpperCase()===id) || (onDemand?.status==='ready' ? onDemand.row : null);
  const candidate=root?._aioEntitySummaries?.[id];
  const summary=candidate?.symbol===id ? candidate : null;
  const profile=businessProfileFor(id,row || {},summary || {});
  const fundamentals=state?.id===id && state?.fundamentals?.symbol?.toUpperCase()===id ? state.fundamentals : onDemand?.sec?.symbol===id ? onDemand.sec : null;
  const history=root?._aioSecFiscalHistory?.[id];
  const model=buildCompanyAnalysis({symbol:id,row,rows,summary,profile,fundamentals,fiscalHistory:typeof history==='string' ? parseFiscalHistory(history) : Array.isArray(history) ? history : [],themes:[...(root?.THEME_MAP || []),...koreanThemeGroups(root?.KR_THEME_MAP||{},rows)],onDemand:onDemand?.status==='ready' ? onDemand : null});
  root.__aioCompanyAnalysis = model;
  // P1630: the page re-renders on every quote tick. An unchanged model keeps its DOM so open
  // details and keyboard focus survive; a changed model restores both after rebuilding.
  let keys = null;
  if (!/\.K[SQ]$/.test(id)) {
    requestConsensusEstimates(root, () => { if (root?._currentTickerId === id) renderCompanyAnalysis({documentRef:doc,root,...host._aioCompanyArgs}); });
    // v59.51: the next report date is in '이 종목에서 계속 볼 것'; the line under the price carries the valuation only.
    keys = keyMetricsLine(row, consensusRowFor(root, id), []);
  }
  // v59.51: the 시총·PER line sits under the price (one home for the valuation numbers).
  const valuation=doc.getElementById('ticker-hero-valuation');
  if (valuation) { if (valuation.textContent!==(keys || '')) valuation.textContent=keys || ''; valuation.hidden=!keys; }
  // v59.42: the latest FOMC-day / earnings brief of this symbol sits under the summary (its own element and signature).
  import('./event-briefs.js').then(({ paintTickerBrief }) => {
    if (root?._currentTickerId && root._currentTickerId !== id) return;
    paintTickerBrief(doc, root, id, host, () => { if (root?._currentTickerId === id) paintTickerBrief(doc, root, id, host, null); });
  }).catch(() => {});
  // Expert fold: what the company model flags for a closer look (filings, coverage, classification gaps). An unchanged
  // list keeps its DOM so the fold's open state survives quote ticks.
  // A Korean listing's OpenDART annual accounts have no other home on the stock pages (재무 공시 links DART only), so they
  // stay here as the second expert fold.
  const kr=model.financial.status==='kr-disclosure-required' ? krFundamentalPoints(root?._aioKrFundamentals?.companies?.[id]) : null;
  const fund = model.identity.assetType==='ETF' || model.identity.assetType==='INDEX';
  const signature=JSON.stringify([id, fund, model.risks.map((risk) => risk.text), kr]);
  if (host.dataset.signature===signature && host.childElementCount) return model;
  host.dataset.signature=signature; host.dataset.model=model.modelVersion; host.dataset.symbol=id;
  const opened=new Set([...host.querySelectorAll('details[open]')].map((node) => node.className));
  // The AI hand-off stays on the face: a full company (or fund) primer the page itself does not write.
  const ask=element(doc,'button',fund ? 'AI로 상품 분석' : 'AI로 기업 분석'); ask.type='button'; ask.className='aio-btn-table';
  ask.addEventListener('click',()=>{
    const panel=doc.getElementById('ai-panel');if(!panel?.classList.contains('open'))root.toggleAIPanel?.();
    const input=doc.getElementById('ai-panel-inp');if(input&&fund){input.value=`${id} 상품을 설명해줘. ① 무엇을 추종하는지(지수와 방식) ② 상위 구성 종목과 섹터 비중 ③ 총보수 ④ 최근 1년 수익률과 같은 기간 S&P 500 비교 ⑤ 비슷한 상품과의 차이. 웹검색으로 운용사 자료를 확인하고 각 숫자에 날짜를 붙여줘.`;input.focus();return;}
    if(input){input.value=`${id} 기업 프라이머를 만들어줘. ① 무엇을 하는 회사인지와 사업부문 ② 최근 3~4개 회계연도와 최근 12개월 매출·이익률·현금흐름 추이 ③ 밸류체인 위치·경쟁사·차별점 ④ 비교 기업 대비 밸류에이션 배수 ⑤ 자본 구조와 부채 ⑥ 다음 실적에서 확인할 숫자(다음 분기 가이던스 높이, 이익률 방향, 이익의 현금 전환) ⑦ 최근 촉매·뉴스 흐름과 위험. 기존 자료로 부족한 정보는 필요하면 웹검색으로 공식 출처를 확인하고, 매매 지시 없이 가능성과 확인 조건으로 정리해줘.`;input.focus();}
  });
  const folds=[ask];
  if (kr) {
    const fold=element(doc,'details',null,'company-analysis-kr'); fold.open=opened.has('company-analysis-kr');
    fold.append(element(doc,'summary','한국 공시(DART) 주요 계정 — 매출, 이익률, 기간'));
    const list=element(doc,'ul'); for (const point of kr.points) list.append(element(doc,'li',`${point.title}: ${point.text}`)); fold.append(list);
    for (const line of kr.basisLines || []) fold.append(element(doc,'p',line));
    const link=dartLink(doc, root?._aioKrFundamentals?.companies?.[id]); if (link) fold.append(link);
    folds.push(fold);
  }
  if (model.risks.length) {
    const fold=element(doc,'details',null,'company-analysis-observations'); fold.open=opened.has('company-analysis-observations');
    fold.append(element(doc,'summary',`더 확인할 점 ${model.risks.length}가지`));
    const list=element(doc,'ul'); for (const risk of model.risks) list.append(element(doc,'li',risk.text)); fold.append(list);
    folds.push(fold);
  }
  host.hidden=false; host.replaceChildren(...folds);
  return model;
}
