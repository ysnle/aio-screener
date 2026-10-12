import { buildKoreaParticipation } from '../../domain/market/korea-participation.js';
const el=(doc,tag,text)=>{const node=doc.createElement(tag);if(text!=null)node.textContent=text;return node;};
export function renderKoreaParticipation({documentRef:doc,root}) {
  const board=doc.getElementById('regime-board-kr');if(!board)return;
  let host=doc.getElementById('regime-kr-participation');
  if(!host){host=el(doc,'section');host.id='regime-kr-participation';host.className='regime-kr-participation';board.after(host);}
  const rows=root._aioGetCanonicalScreenerRows?.()||[];
  const model=buildKoreaParticipation({rows,themes:root.KR_THEME_MAP||{}});root.__aioKoreaParticipation=model;
  host.replaceChildren(el(doc,'h2','한국 종목의 참여도와 강한 테마'),el(doc,'p',model.headline));
  if(!model.available){host.hidden=true;return model;}host.hidden=false;
  host.append(el(doc,'p',`${model.date} 한국 종가 · ${model.delayed?'지연':'참고'} · 수집 ${model.observed}/${model.population}개 표본`));
  const metrics=el(doc,'dl');metrics.className='regime-kr-metrics';
  for(const [label,value] of [['50일선 위',model.breadth50],['200일선 위',model.breadth200]]) if(value.pct!=null)metrics.append(el(doc,'dt',label),el(doc,'dd',`${value.pct.toFixed(1)}% (${value.above}/${value.count}개)`));
  if(model.returns.ret1m!=null)metrics.append(el(doc,'dt','1개월 수익률 중앙값'),el(doc,'dd',`${model.returns.ret1m.toFixed(1)}%`));host.append(metrics);
  if(model.groups.length){host.append(el(doc,'h3','한국 테마 표본 · 3개월 수익률 중앙값'));const list=el(doc,'ul');
    for(const group of model.groups){const item=el(doc,'li');item.append(el(doc,'strong',`${group.themeName} ${group.ret3m>=0?'+':''}${group.ret3m.toFixed(1)}% · ${group.members}/${group.listed}개`));
      const codes=el(doc,'div',group.constituents.map(member=>member.sym).join(' · '));codes.className='regime-kr-tickers';item.append(codes);list.append(item);}host.append(list);}
  const watch=el(doc,'details');watch.append(el(doc,'summary','다음에 관찰할 연결'),...model.watch.map(text=>el(doc,'p',text)));host.append(watch);
  const basis=el(doc,'details');basis.append(el(doc,'summary','표본·미수집 자료'),el(doc,'p',`한국 수집 종목의 동일 기준일 표본입니다. 늦거나 기준일이 없는 ${model.excluded}개는 제외합니다. 신고가·수급 숫자를 역산하지 않습니다.`),el(doc,'p',`아직 연결되지 않은 자료: ${model.missing.join(' · ')}`));host.append(basis);
  return model;
}
