import { buildKoreaParticipation } from '../../domain/market/korea-participation.js';
import { koreaMoveRecord } from '../../domain/briefing/market-read.js';
import { heavyweightLine } from '../../domain/themes/group-strength.js';
import { el } from './dom.js';
// v57.78 perf: an optional `store` supplies the native screener rows in place (same rule as scenario-outlook: a
// non-empty native set wins, an empty one defers to the bridge, which owns the pre-publication fallback).
function participationRows(root,store){
  let nativeRows=null;try{nativeRows=store?.getState?.()?.screener?.rows;}catch(_){nativeRows=null;}
  return (Array.isArray(nativeRows)&&nativeRows.length?nativeRows:root._aioGetCanonicalScreenerRows?.())||[];
}
export function renderKoreaParticipation({documentRef:doc,root,store=null}) {
  const board=doc.getElementById('regime-board-kr');if(!board)return;
  let host=doc.getElementById('regime-kr-participation');
  if(!host){host=el(doc,'section');host.id='regime-kr-participation';host.className='regime-kr-participation';board.after(host);}
  const rows=participationRows(root,store);
  // P1723: the KOSPI 1-/5-session change (same KRX close record as 시장 상태) goes beside the sample's own medians.
  const kr=koreaMoveRecord(root._aioHistory||[],{now:Date.now()});
  const model=buildKoreaParticipation({rows,themes:root.KR_THEME_MAP||{},index:kr?{date:kr.date,d1:kr.d1,d5:kr.d5}:null});root.__aioKoreaParticipation=model;
  // v57.81: the list is ranked by 3-month return, some of it negative and falling over the month — it is named by its window
  // (3개월 수익률 상위), with the 1-month return beside each theme, never as 강한 테마.
  const title=el(doc,'h2','한국 종목의 참여도와 3개월 수익률 상위 테마');title.prepend(el(doc,'span','한국','sx-chip sx-chip--sm kr-market-chip'));host.replaceChildren(title);
  if(model.session?.text){const lead=el(doc,'p',model.session.text);lead.className='flow-lead';host.append(lead);}
  host.append(el(doc,'p',model.headline));
  if(!model.available){host.hidden=true;return model;}host.hidden=false;
  host.append(el(doc,'p',`${model.date} 한국 종가 · ${model.delayed?'지연':'참고'} · ${model.observed === model.population ? `AIO 추적 종목(한국) ${model.population}개 모두` : `AIO 추적 종목(한국) ${model.population}개 중 ${model.observed}개`}`));
  const metrics=el(doc,'dl');metrics.className='regime-kr-metrics';
  for(const [label,value] of [['50일선 위',model.breadth50],['200일선 위',model.breadth200]]) if(value.pct!=null)metrics.append(el(doc,'dt',label),el(doc,'dd',`${value.pct.toFixed(1)}% (${value.above}/${value.count}개)`));
  if(model.returns.ret1m!=null)metrics.append(el(doc,'dt','1개월 수익률 중앙값'),el(doc,'dd',`${model.returns.ret1m.toFixed(1)}%`));host.append(metrics);
  if(model.groups.length){host.append(el(doc,'h3','3개월 수익률 상위 한국 테마 · 표본 중앙값'));const list=el(doc,'ul');
    for(const group of model.groups){const item=el(doc,'li');const pc=v=>`${v>=0?'+':''}${v.toFixed(1)}%`;const turned=group.ret1m!=null&&Math.sign(group.ret1m)!==Math.sign(group.ret3m)&&group.ret1m!==0;
      item.append(el(doc,'strong',`${group.themeName} 3개월 ${pc(group.ret3m)} · 1개월 ${group.ret1m==null?'미확인':pc(group.ret1m)} · ${group.members}/${group.listed}개`));if(turned){const note=el(doc,'p',`최근 1개월은 3개월과 반대 방향(${group.ret1m<0?'하락':'상승'})입니다.`);note.className='regime-kr-heavy';item.append(note);}
      // P1651: beginners read company names, not 096770.KS codes; the exact registry name only (no guessing), code in the tooltip.
      const nameOf=member=>root.KR_STOCK_DB?.[String(member.sym||'').slice(0,6)]?.name||member.name||member.sym;
      const codes=el(doc,'div',group.constituents.map(nameOf).join(' · '));codes.title=group.constituents.map(member=>`${nameOf(member)} ${member.sym}`).join('\n');codes.className='regime-kr-tickers';item.append(codes);
      // P1723: the equal-weight median can hide the largest names; one line when they moved apart from it.
      const heavy=heavyweightLine(group,nameOf);if(heavy){const note=el(doc,'p',heavy);note.className='regime-kr-heavy';item.append(note);}
      list.append(item);}host.append(list);}
  const watch=el(doc,'details');watch.append(el(doc,'summary','다음에 관찰할 연결'),...model.watch.map(text=>el(doc,'p',text)));host.append(watch);
  const basis=el(doc,'details');basis.append(el(doc,'summary','표본 기준과 빠진 자료'),el(doc,'p',`AIO 추적 종목(한국) 가운데 같은 기준일에 종가가 있는 표본입니다. 늦거나 기준일이 없는 ${model.excluded}개는 제외합니다. 신고가·수급 숫자를 역산하지 않습니다.`),el(doc,'p',`아직 연결되지 않은 자료: ${model.missing.join(' · ')}`));host.append(basis);
  return model;
}
