import { buildKoreaParticipation } from '../../domain/market/korea-participation.js';
import { koreaMoveRecord } from '../../domain/briefing/market-read.js';
import { heavyweightLine } from '../../domain/themes/group-strength.js';
import { el } from './dom.js';
import { refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { buildKrInvestorFlowView, formatEok, KR_INVESTOR_FLOWS } from '../../domain/market/kr-investor-flows.js';
import { shortDate } from '../../domain/content/date-labels.js';
// v57.78 perf: an optional `store` supplies the native screener rows in place (same rule as scenario-outlook: a
// non-empty native set wins, an empty one defers to the bridge, which owns the pre-publication fallback).
function participationRows(root,store){
  let nativeRows=null;try{nativeRows=store?.getState?.()?.screener?.rows;}catch(_){nativeRows=null;}
  return (Array.isArray(nativeRows)&&nativeRows.length?nativeRows:root._aioGetCanonicalScreenerRows?.())||[];
}
// v58.55: once the investor-flow card has data, the sample's missing list names only the investor types still absent.
function missingWithFlows(missing,flows){
  if(flows?.state!=='ok')return missing;
  return missing.flatMap(item=>item!=='외국인·기관 순매수'?[item]:flows.missing.length?[`${flows.missing.join('·')} 순매수`]:[]);
}
export function renderKoreaParticipation({documentRef:doc,root,store=null}) {
  const board=doc.getElementById('regime-board-kr');if(!board)return;
  let host=doc.getElementById('regime-kr-participation');
  if(!host){host=el(doc,'section');host.id='regime-kr-participation';host.className='regime-kr-participation';board.after(host);}
  renderKrInvestorFlows({documentRef:doc,root,before:host}); // v58.55 개편 v2 (5n)
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
  host.append(el(doc,'p',`${model.date} 한국 종가, ${model.delayed?'지연':'참고'}, ${model.observed === model.population ? `AIO 추적 종목(한국) ${model.population}개 모두` : `AIO 추적 종목(한국) ${model.population}개 중 ${model.observed}개`}`));
  const metrics=el(doc,'dl');metrics.className='regime-kr-metrics';
  for(const [label,value] of [['50일선 위',model.breadth50],['200일선 위',model.breadth200]]) if(value.pct!=null)metrics.append(el(doc,'dt',label),el(doc,'dd',`${value.pct.toFixed(1)}% (${value.above}/${value.count}개)`));
  if(model.returns.ret1m!=null)metrics.append(el(doc,'dt','1개월 수익률 중앙값'),el(doc,'dd',`${model.returns.ret1m.toFixed(1)}%`));host.append(metrics);
  if(model.groups.length){host.append(el(doc,'h3','3개월 수익률 상위 한국 테마, 표본 중앙값'));const turnedCount=model.groups.filter(group=>group.ret1m!=null&&group.ret1m!==0&&Math.sign(group.ret1m)!==Math.sign(group.ret3m)).length;if(turnedCount)host.append(el(doc,'p',`${model.groups.length}개 중 ${turnedCount}개는 최근 1개월 방향이 3개월과 반대입니다.`,'regime-kr-heavy'));const list=el(doc,'ul');
    for(const group of model.groups){const item=el(doc,'li');const pc=v=>`${v>=0?'+':''}${v.toFixed(1)}%`;const turned=group.ret1m!=null&&Math.sign(group.ret1m)!==Math.sign(group.ret3m)&&group.ret1m!==0;
      item.append(el(doc,'strong',`${group.themeName} 3개월 ${pc(group.ret3m)}, 1개월 ${group.ret1m==null?'미확인':pc(group.ret1m)}, ${group.members}/${group.listed}개`));if(turned){const note=el(doc,'p',`1개월 ${group.ret1m<0?'하락':'상승'} 반전`);note.className='regime-kr-heavy';item.append(note);}
      // P1651: beginners read company names, not 096770.KS codes; the exact registry name only (no guessing), code in the tooltip.
      const nameOf=member=>root.KR_STOCK_DB?.[String(member.sym||'').slice(0,6)]?.name||member.name||member.sym;
      const codes=el(doc,'div',group.constituents.map(nameOf).join(', '));codes.title=group.constituents.map(member=>`${nameOf(member)} ${member.sym}`).join('\n');codes.className='regime-kr-tickers';item.append(codes);
      // P1723: the equal-weight median can hide the largest names; one line when they moved apart from it.
      const heavy=heavyweightLine(group,nameOf);if(heavy){const note=el(doc,'p',heavy);note.className='regime-kr-heavy';item.append(note);}
      list.append(item);}host.append(list);}
  const watch=el(doc,'details');watch.append(el(doc,'summary','다음에 관찰할 연결'),...model.watch.map(text=>el(doc,'p',text)));host.append(watch);
  const basis=el(doc,'details');basis.append(el(doc,'summary','표본 기준과 빠진 자료'),el(doc,'p',`AIO 추적 종목(한국) 가운데 같은 기준일에 종가가 있는 표본입니다. ${model.excluded ? `늦거나 기준일이 없는 ${model.excluded}개는 제외합니다. ` : ''}신고가·수급 숫자를 역산하지 않습니다.`),el(doc,'p',`아직 연결되지 않은 자료: ${missingWithFlows(model.missing,root.__aioKrInvestorFlowView).join(', ')||'없음'}`));host.append(basis);
  return model;
}

// v58.55 개편 v2 (5n) 투자자별 순매수: the latest session's net purchase per investor type (diverging bars on one scale per
// market, Korean colours: net buying red, net selling blue) and each published series' last 20 sessions with 5-/20-session
// sums. Source: public-data/kr-investor-flows.json (Bank of Korea ECOS). Until the first collection the card says so.
const KR_FLOW_SOURCE_NOTE = '한국거래소 정보데이터시스템의 투자자별 자료는 거래소의 사전 허락 없이 복제·재배포할 수 없어 쓰지 않습니다.';
const tone = (value) => value > 0 ? 'kr-up' : value < 0 ? 'kr-down' : '';
function flowMarket(doc, market) {
  const box = el(doc, 'div', null, 'kr-flows-market');
  box.dataset.market = market.id;
  const head = el(doc, 'div', null, 'kr-flows-market-head');
  head.append(el(doc, 'strong', market.label), el(doc, 'span', `억 원, ${shortDate(market.date)}${market.stale ? ', 지연' : ''}`, 'kr-flows-unit'));
  box.append(head);
  // One scale per market: the largest single-session amount among the drawn series' last 20 sessions, so the bar says how
  // big today is against the recent month even when the source publishes one investor type only.
  const max = Math.max(1, ...market.rows.map((row) => Math.abs(row.value ?? 0)), ...market.trends.flatMap((trend) => trend.points.map((p) => Math.abs(p.value))));
  for (const row of market.rows) {
    const line = el(doc, 'div', null, 'kr-flow-row');
    const track = el(doc, 'div', null, 'kr-flow-track');
    if (row.value != null && row.value !== 0) {
      const fill = el(doc, 'span', null, `kr-flow-fill ${row.value > 0 ? 'is-up' : 'is-down'}`);
      fill.style.width = `${(Math.abs(row.value) / max * 50).toFixed(1)}%`;
      track.append(fill);
    }
    line.append(el(doc, 'span', row.label, 'kr-flow-label'), track, el(doc, 'b', row.value == null ? `— (${shortDate(row.date)}까지)` : formatEok(row.value), `kr-flow-value ${tone(row.value)}`.trim()));
    box.append(line);
  }
  for (const trend of market.trends) {
    const wrap = el(doc, 'div', null, 'kr-flow-trend');
    wrap.append(el(doc, 'span', `${trend.label} 최근 ${trend.sessions}거래일`, 'kr-flow-trend-title'));
    const cols = el(doc, 'div', null, 'kr-flow-cols');
    cols.setAttribute('role', 'img');
    cols.setAttribute('aria-label', `${market.label} ${trend.label} 순매수 최근 ${trend.sessions}거래일: ${trend.points.map((p) => `${shortDate(p.date)} ${formatEok(p.value)}`).join(', ')}`);
    const peak = Math.max(1, ...trend.points.map((p) => Math.abs(p.value)));
    for (const point of trend.points) {
      const col = el(doc, 'span', null, `kr-flow-col ${point.value >= 0 ? 'is-up' : 'is-down'}`);
      col.style.height = `${Math.max(2, Math.abs(point.value) / peak * 50).toFixed(1)}%`;
      col.title = `${shortDate(point.date)} ${formatEok(point.value)} 원`;
      cols.append(col);
    }
    const sums = el(doc, 'p', null, 'kr-flow-sums');
    const part = (label, value) => { const span = el(doc, 'span', `${label} ${value == null ? '—' : formatEok(value)}`, tone(value)); return span; };
    sums.append(part('5거래일 합계', trend.sum5), el(doc, 'span', ', '), part(`${trend.sessions}거래일 합계`, trend.sum20));
    wrap.append(cols, sums);
    box.append(wrap);
  }
  return box;
}

export function renderKrInvestorFlows({ documentRef: doc, root, before = null, nowMs = Date.now() } = {}) {
  const board = doc?.getElementById?.('regime-board-kr');
  if (!board) return null;
  let host = doc.getElementById('regime-kr-flows');
  if (!host) {
    host = el(doc, 'section', null, 'kr-flows');
    host.id = 'regime-kr-flows';
    host.setAttribute('aria-labelledby', 'regime-kr-flows-title');
    if (before) before.before(host); else board.after(host);
  }
  if (!root.__aioKrFlowsRequested) {
    root.__aioKrFlowsRequested = true;
    // v58.55 review: a failed fetch is its own state (불러오지 못함), never read as 수집 전.
    const done = (payload, changed) => {
      root.__aioKrFlowsRequested = false;
      const before = root.__aioKrFlowsLoad;
      root.__aioKrFlowsLoad = payload ? 'loaded' : 'failed';
      if (changed || before !== root.__aioKrFlowsLoad) renderKrInvestorFlows({ documentRef: doc, root });
    };
    refreshSharedArtifact(root, KR_INVESTOR_FLOWS).then(({ payload, changed }) => done(payload, changed)).catch(() => done(root[KR_INVESTOR_FLOWS.key] || null, false));
  }
  const view = buildKrInvestorFlowView(root[KR_INVESTOR_FLOWS.key] || null, { nowMs, loadState: root.__aioKrFlowsLoad || 'loading' });
  root.__aioKrInvestorFlowView = view;
  const key = view.state === 'ok' ? `ok|${view.generatedAt}|${view.markets.map((m) => m.date).join(',')}` : `${view.state}|${view.reason || ''}`;
  if (host.dataset.krFlowsKey === key) return view;
  host.dataset.krFlowsKey = key;
  const head = el(doc, 'div', null, 'kr-flows-head');
  // v58.56 (re-audit #15): plain words for the reader — what is shown (외국인 순매수), who publishes it (한국은행), and
  // why 개인·기관 are absent (no public source) — instead of pipeline terms (ECOS, 수집 주기, 출처 항목).
  const foreignOnly = view.state !== 'ok' || (view.missing.includes('개인') && view.missing.includes('기관'));
  const title = el(doc, 'h3', foreignOnly ? '외국인 순매수' : '투자자별 순매수');
  title.id = 'regime-kr-flows-title';
  head.append(title);
  if (view.state !== 'ok') {
    host.removeAttribute('data-observed-at');
    const text = view.state === 'loading' ? '외국인 순매수를 불러오는 중입니다.'
      : view.state === 'pending' ? '코스피·코스닥 외국인 순매수(한국은행 발표)가 들어오면 날짜와 함께 여기에 보여 드립니다. 개인·기관은 공개 출처가 없어 표시하지 않습니다.'
      : view.reason === 'fetch-failed' ? '외국인 순매수를 불러오지 못했습니다. 잠시 뒤 다시 시도합니다.'
      : '이번에는 한국은행 자료에서 외국인 순매수를 찾지 못해 비워 둡니다.';
    // v58.75 (persona review): before the first collection the card was a heading over an empty slot; it is one line now.
    if (view.state === 'pending') { host.replaceChildren(el(doc, 'p', '아직 수집하지 않는 자료: 코스피·코스닥 외국인 순매수(한국은행 발표, 들어오면 날짜와 함께 이 자리에 표시). 개인·기관은 공개 출처가 없어 표시하지 않습니다.', 'kr-flows-empty')); return view; }
    host.replaceChildren(head, el(doc, 'p', text, 'kr-flows-empty'));
    return view;
  }
  const latest = view.markets.map((m) => m.date).sort().at(-1);
  head.append(el(doc, 'span', `${shortDate(latest)}, 한국은행`, 'basis-chip'));
  host.setAttribute('data-observed-at', latest);
  host.setAttribute('data-source-kind', 'official-statistics');
  const grid = el(doc, 'div', null, 'kr-flows-grid');
  grid.append(...view.markets.map((market) => flowMarket(doc, market)));
  const nodes = [head, grid];
  if (view.missing.length) nodes.push(el(doc, 'p', `${view.missing.join('·')}은 공개 출처 없음`, 'kr-flows-note'));
  const basis = el(doc, 'details', null, 'kr-flows-basis');
  basis.append(el(doc, 'summary', '읽는 법과 출처'),
    el(doc, 'p', '순매수는 그날 산 금액에서 판 금액을 뺀 값입니다. +는 순매수(빨강), −는 순매도(파랑)이며, 막대 길이는 같은 시장의 최근 20거래일 가운데 가장 큰 하루와 비교한 크기입니다.'),
    el(doc, 'p', '한국 증시는 외국인 보유 비중이 높아 원화가 약할 때 외국인 순매도가 지수 하락과 함께 나타나는 일이 잦습니다. 하루 수급은 다음 날 방향을 말해 주지 않습니다.'),
    el(doc, 'p', `출처: ${view.source}, 한국거래소 집계를 한국은행이 게시한 값, 단위 억 원.`),
    ...(view.missing.length ? [el(doc, 'p', `${view.missing.join('·')} 순매수가 없는 이유: ${KR_FLOW_SOURCE_NOTE}`)] : []));
  nodes.push(basis);
  host.replaceChildren(...nodes);
  return view;
}
