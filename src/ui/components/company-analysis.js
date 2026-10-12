import { buildCompanyAnalysis } from '../../domain/entity/company-analysis.js';
import { businessProfileFor } from '../../domain/entity/business-profiles.js';
import { parseFiscalHistory, requestFiscalHistory } from './fiscal-read.js';
import { formatScreenerPrice, MARKET_LABELS } from '../../domain/screener/market-scope.js';
import { koreanThemeGroups } from '../../domain/market/korea-participation.js';

const pct = value => value == null ? '자료 없음' : `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
function element(doc, tag, text, className) { const node=doc.createElement(tag); if (text != null) node.textContent=text; if (className) node.className=className; return node; }
function detail(doc, title, lines, sourceUrl = null, source = null) {
  const box=element(doc,'details',null,'company-analysis-details'); box.append(element(doc,'summary',title));
  for (const line of lines.filter(Boolean)) box.append(element(doc,'p',line));
  if (sourceUrl) { const link=element(doc,'a',source || '원문 확인'); link.href=sourceUrl; link.target='_blank'; link.rel='noopener noreferrer'; box.append(link); }
  return box;
}
function card(doc, title, status) {
  const section=element(doc,'section',null,'company-analysis-card'); const heading=element(doc,'div',null,'company-analysis-card-heading');
  heading.append(element(doc,'h3',title), element(doc,'span',status,'company-analysis-status')); section.append(heading); return section;
}

// P1624: this renderer reads existing issuer-keyed caches only; no provider or paid calls.
export function renderCompanyAnalysis({ documentRef:doc, root=globalThis, state }) {
  const host=doc?.getElementById('ticker-company-analysis'); if (!host) return null;
  const id=String(state?.id || root?._currentTickerId || '').trim().toUpperCase();
  if (!id) { host.hidden=true; host.replaceChildren(); root.__aioCompanyAnalysis=null; return null; }
  requestFiscalHistory(root, () => {
    if (root?._currentTickerId === id && doc.getElementById('page-ticker')?.classList.contains('active')) renderCompanyAnalysis({documentRef:doc,root,state});
  });
  let rows=[]; try { rows=root?._aioGetCanonicalScreenerRows?.() || []; } catch (_) {}
  const row=rows.find(item=>String(item.sym || item.symbol || '').toUpperCase()===id) || null;
  const candidate=root?._aioEntitySummaries?.[id];
  const summary=candidate?.symbol===id ? candidate : null;
  const profile=businessProfileFor(id,row || {},summary || {});
  const fundamentals=state?.id===id && state?.fundamentals?.symbol?.toUpperCase()===id ? state.fundamentals : null;
  const history=root?._aioSecFiscalHistory?.[id];
  const model=buildCompanyAnalysis({symbol:id,row,rows,summary,profile,fundamentals,fiscalHistory:typeof history==='string' ? parseFiscalHistory(history) : Array.isArray(history) ? history : [],themes:[...(root?.THEME_MAP || []),...koreanThemeGroups(root?.KR_THEME_MAP||{},rows)]});
  root.__aioCompanyAnalysis = model;
  // P1630: the page re-renders on every quote tick. An unchanged model keeps its DOM so open
  // details and keyboard focus survive; a changed model restores both after rebuilding.
  const signature=JSON.stringify(model);
  if (host.dataset.signature===signature && host.childElementCount) return model;
  const wasOpen=host.querySelector('.company-analysis-expanded')?.open||false;
  const observationsOpen=host.querySelector('.company-analysis-observations')?.open||false;
  const focused=host.contains(doc.activeElement) ? doc.activeElement.textContent : null;
  host.hidden=false; host.classList.add('company-analysis'); host.dataset.model=model.modelVersion; host.dataset.symbol=id;
  host.replaceChildren(element(doc,'h2','기업 요약','briefing-h2'), element(doc,'p',model.headline,'company-analysis-lead'));
  const ask=element(doc,'button','AI로 기업 분석'); ask.type='button'; ask.className='aio-btn-table';
  ask.addEventListener('click',()=>{
    const panel=doc.getElementById('ai-panel');if(!panel?.classList.contains('open'))root.toggleAIPanel?.();
    const input=doc.getElementById('ai-panel-inp');if(input){input.value=`${id} 기업을 분석해줘. 사업 모델·경쟁력·실적·현금흐름·위험과 앞으로 확인할 조건을 연결해서 설명하고, 기존 자료로 부족한 사업 정보는 필요하면 웹검색으로 공식 출처를 확인해줘.`;input.focus();}
  });host.append(ask);
  const expanded=element(doc,'details',null,'company-analysis-expanded');expanded.open=wasOpen;expanded.append(element(doc,'summary','기업 분석 근거 보기'));
  const grid=element(doc,'div',null,'company-analysis-grid');
  const identity=card(doc,'무엇을 하는 기업·종목인가','참고');
  const meta=model.identity;
  identity.append(element(doc,'p',`${meta.name} (${id}) · ${MARKET_LABELS[meta.market] || '시장 미확인'} · ${meta.assetType==='ETF' ? '상장지수펀드(ETF)' : meta.assetType==='INDEX' ? '지수' : meta.assetType==='STOCK' ? '상장 기업' : '유형 미확인'}`,'company-analysis-identity'));
  if (model.business.description) identity.append(element(doc,'p',model.business.description));
  if (meta.sector || meta.industry) identity.append(element(doc,'p',[meta.sector ? `섹터 ${meta.sector}` : null,meta.industry ? `산업 ${meta.industry}` : null].filter(Boolean).join(' · '),'company-analysis-meta'));
  if (model.associations.length) {
    const themes=element(doc,'div',null,'company-analysis-themes');
    for (const theme of model.associations) { const button=element(doc,'button',`${theme.name}${theme.subThemes.length ? ` · ${theme.subThemes.join(' / ')}` : ''}`); button.type='button'; button.addEventListener('click',()=>root?.showThemeDetail?.(theme.id)); themes.append(button); }
    identity.append(element(doc,'p','연결된 테마 · AIO 분류','company-analysis-meta'), themes);
  }
  identity.append(detail(doc,'사업·분류 근거',[`종목 등록 ${meta.registered ? '확인' : '미등록'} · 유형 검증 ${meta.verification}`,meta.currency ? `거래 통화 ${meta.currency}` : '거래 통화 미확인',model.associations.length ? '테마는 AIO의 투자 분류이며 실제 사업부문 매출 비중을 뜻하지 않습니다.' : null],model.business.sourceUrl,model.business.source));
  grid.append(identity);
  const financial=card(doc,'실적·현금·재무 구조',model.financial.status==='reference' ? '참고' : model.financial.status==='not-applicable' ? '기업 재무 대상 아님' : '자료 없음');
  if (model.financial.fiscal.available) {
    const points=model.financial.fiscal.points.filter(point=>['growth','margin','cash','roe','debt','shares','single'].includes(point.id)).slice(0,4);
    const list=element(doc,'ul'); for (const point of points) { const li=element(doc,'li'); li.append(element(doc,'strong',`${point.title} `),element(doc,'span',point.text)); list.append(li); } financial.append(list);
    financial.append(detail(doc,'재무 기간·원문',[`연간 회계연도 말 ${model.financial.periodEnd || '미확인'}`,model.financial.filedAt ? `제출 ${model.financial.filedAt}` : '제출 시각 미확인',`${model.financial.source} · 주가 수익률 기간과 직접 동일시하지 않습니다.`],model.financial.sourceUrl,'SEC 공시 원문'));
  } else financial.append(element(doc,'p',model.financial.status==='not-applicable' ? 'ETF·지수는 사업회사 매출·순이익·ROE로 분석하지 않습니다. 추종 대상·구성·비용은 해당 상품 자료에서 확인합니다.' : model.financial.status==='kr-disclosure-required' ? '한국 종목의 재무는 한국 공시 기준으로 확인해야 합니다. SEC 달러 공시를 이 종목의 재무로 가져오지 않습니다.' : '동일 기업의 검증된 연간 공시 자료가 없습니다. 이전에 보던 기업의 재무나 다른 기간의 숫자를 대신 표시하지 않습니다.'));
  grid.append(financial);
  const evidence=model.marketEvidence;
  const price=card(doc,'주가·추세·상대 위치',evidence.status==='delayed' ? '지연' : evidence.status==='reference' || model.price.value!=null ? '참고' : '자료 없음');
  if (model.price.value!=null) price.append(element(doc,'p',`${formatScreenerPrice(model.price.value,model.price.currency)} · ${model.price.observedAt}`,'company-analysis-price'));
  const facts=element(doc,'ul');
  if (evidence.returns.ret3m!=null) facts.append(element(doc,'li',`3개월 수익률 ${pct(evidence.returns.ret3m)}${evidence.relative ? ` · 같은 시장 ${evidence.relative.peers}개 중 ${evidence.relative.rank}번째` : ''}`));
  if (evidence.pctSma50!=null) facts.append(element(doc,'li',`50일선 대비 ${pct(evidence.pctSma50)}`));
  if (evidence.pctSma200!=null) facts.append(element(doc,'li',`200일선 대비 ${pct(evidence.pctSma200)}`));
  if (evidence.compositeRank!=null) facts.append(element(doc,'li',`선택 팩터 비중의 시장 내 백분위 ${evidence.compositeRank} · 수익률 순위와 다름`));
  if (!facts.children.length) facts.append(element(doc,'li','완료 종가 기준의 비교 자료가 없습니다.'));
  price.append(facts,detail(doc,'주가·비교 기준',[evidence.asOf ? `${evidence.asOf} 완료 종가 기준의 수익률·이동평균 거리` : '수익률 기준일 미확인','3개월 순서는 같은 시장·같은 종가 기준일·3개월 수익률이 있는 종목끼리 비교합니다. 동률은 공동 순위입니다.','관측 시세와 종가 기준 팩터는 서로 다른 시점일 수 있습니다.','백분위는 현재 자료의 상대 위치이며 기업의 가치나 향후 상승 확률이 아닙니다.']));
  grid.append(price); expanded.append(grid); host.append(expanded);
  if (model.risks.length) { const observations=element(doc,'details',null,'company-analysis-observations'); observations.append(element(doc,'summary',`추가로 확인할 관측 ${model.risks.length}개`)); const list=element(doc,'ul'); for (const risk of model.risks) list.append(element(doc,'li',risk.text)); observations.append(list); observations.open=observationsOpen; host.append(observations); }
  host.dataset.signature=signature;
  if (focused) [...host.querySelectorAll('button,summary,a')].find(node=>node.textContent===focused)?.focus();
  return model;
}
