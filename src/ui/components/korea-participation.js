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
  host.replaceChildren(el(doc,'h2','한국 종목의 참여도와 강한 테마'));
  if(model.session?.text){const lead=el(doc,'p',model.session.text);lead.className='flow-lead';host.append(lead);}
  host.append(el(doc,'p',model.headline));
  if(!model.available){host.hidden=true;return model;}host.hidden=false;
  host.append(el(doc,'p',`${model.date} 한국 종가 · ${model.delayed?'지연':'참고'} · 수집 ${model.observed}/${model.population}개 표본`));
  const metrics=el(doc,'dl');metrics.className='regime-kr-metrics';
  for(const [label,value] of [['50일선 위',model.breadth50],['200일선 위',model.breadth200]]) if(value.pct!=null)metrics.append(el(doc,'dt',label),el(doc,'dd',`${value.pct.toFixed(1)}% (${value.above}/${value.count}개)`));
  if(model.returns.ret1m!=null)metrics.append(el(doc,'dt','1개월 수익률 중앙값'),el(doc,'dd',`${model.returns.ret1m.toFixed(1)}%`));host.append(metrics);
  if(model.groups.length){host.append(el(doc,'h3','한국 테마 표본 · 3개월 수익률 중앙값'));const list=el(doc,'ul');
    for(const group of model.groups){const item=el(doc,'li');item.append(el(doc,'strong',`${group.themeName} ${group.ret3m>=0?'+':''}${group.ret3m.toFixed(1)}% · ${group.members}/${group.listed}개`));
      // P1651: beginners read company names, not 096770.KS codes; the exact registry name only (no guessing), code in the tooltip.
      const nameOf=member=>root.KR_STOCK_DB?.[String(member.sym||'').slice(0,6)]?.name||member.name||member.sym;
      const codes=el(doc,'div',group.constituents.map(nameOf).join(' · '));codes.title=group.constituents.map(member=>`${nameOf(member)} ${member.sym}`).join('\n');codes.className='regime-kr-tickers';item.append(codes);
      // P1723: the equal-weight median can hide the largest names; one line when they moved apart from it.
      const heavy=heavyweightLine(group,nameOf);if(heavy){const note=el(doc,'p',heavy);note.className='regime-kr-heavy';item.append(note);}
      list.append(item);}host.append(list);}
  const watch=el(doc,'details');watch.append(el(doc,'summary','다음에 관찰할 연결'),...model.watch.map(text=>el(doc,'p',text)));host.append(watch);
  const basis=el(doc,'details');basis.append(el(doc,'summary','표본·미수집 자료'),el(doc,'p',`한국 수집 종목의 동일 기준일 표본입니다. 늦거나 기준일이 없는 ${model.excluded}개는 제외합니다. 신고가·수급 숫자를 역산하지 않습니다.`),el(doc,'p',`아직 연결되지 않은 자료: ${model.missing.join(' · ')}`));host.append(basis);
  return model;
}
