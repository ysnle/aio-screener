// P1628: Korean participation is derived from its own dated, completed-session sample.
import { marketRows } from '../screener/market-scope.js';
import { latestCompletedKrSession, resolveMarketCalendarSession } from './market-calendar.js';
import { buildGroupStrength, median } from '../themes/group-strength.js';
import { fieldValueForPurpose } from '../../data/contracts/screener.js';
import { KR_THEME_LABELS } from '../themes/kr-themes.js';
const finite = v => typeof v === 'number' && Number.isFinite(v) ? v : null;
const read = (row,key) => row.fieldReadiness ? finite(fieldValueForPurpose(row, `price.${key}`, 'display')) : finite(row[key]);
export function koreanThemeGroups(map = {}, rows = []) {
  const ids = new Map(marketRows(rows,'KR').map(row => [String(row.sym).replace(/\.K[QS]$/, ''), row.sym]));
  return Object.entries(map).map(([id,members]) => ({ id, nameKr:KR_THEME_LABELS[id]||id, subThemes:[{ name:KR_THEME_LABELS[id]||id,
    tickers:(Array.isArray(members) ? members : []).map(member => ids.get(String(member.code || member.sym || '').replace(/\.K[QS]$/, ''))).filter(Boolean) }] }));
}
// P1723: the index's own 1- and 5-session change beside the same-session sample's median and the count of members down
// 3% or more. A cap-weighted index far below the equal-weight median says the move sat in the largest names; the
// sentence states the numbers and that reading, nothing about flows (net buying is not collected).
const sgn = v => `${v>=0?'+':''}${v.toFixed(1)}%`;
function sessionRead({ observed, date, index }) {
  const values = key => observed.map(row => finite(row[key])).filter(v => v!=null);
  const d1 = values('ret1d'), d5 = values('ret5d');
  const out = { count:d1.length, ret1d:median(d1), ret5d:median(d5), down3:d1.filter(v=>v<=-3).length, up3:d1.filter(v=>v>=3).length, falling:d1.filter(v=>v<0).length, text:null };
  if (out.ret1d==null || out.count<20) return out;
  const md = `${Number(date.slice(5,7))}/${Number(date.slice(8,10))}`;
  const sample = `한국 수집 표본 ${out.count}개 하루 수익률 중앙값 ${sgn(out.ret1d)}(-3% 이하 ${out.down3}개 · 하락 ${out.falling}개)`;
  const same = index?.date===date && finite(index?.d1)!=null;
  if (!same) { out.text = `${md} ${sample}.`; return out; }
  const gap = index.d1 - out.ret1d;
  const tilt = Math.abs(index.d1) < 1.5 ? '' : gap <= -2 ? ' — 지수 하락 폭이 표본 중앙값보다 훨씬 커 시가총액이 큰 종목에 하락이 몰린 것으로 보입니다'
    : gap >= 2 ? ' — 지수 상승 폭이 표본 중앙값보다 훨씬 커 시가총액이 큰 종목에 상승이 몰린 것으로 보입니다'
      : Math.abs(gap) < 1 ? ' — 표본 종목 전반이 지수와 비슷하게 움직였습니다' : '';
  const week = finite(index.d5)!=null && out.ret5d!=null ? ` 5거래일은 지수 ${sgn(index.d5)} · 표본 중앙값 ${sgn(out.ret5d)}입니다.` : '';
  out.text = `코스피 ${md} ${sgn(index.d1)} vs ${sample}${tilt}.${week}`;
  return out;
}
export function buildKoreaParticipation({ rows=[], themes={}, nowMs=Date.now(), index=null }={}) {
  const population=marketRows(rows,'KR'), latest=latestCompletedKrSession(nowMs);
  const valid=population.filter(row => row.factorSessionDate <= latest?.date && resolveMarketCalendarSession({market:'KR',date:row.factorSessionDate}).status==='open');
  const date=valid.map(row=>row.factorSessionDate).sort().at(-1) || null;
  const observed=valid.filter(row=>row.factorSessionDate===date);
  const ratio=key => { const values=observed.map(row=>read(row,key)).filter(v=>v!=null); return {count:values.length, above:values.filter(v=>v>0).length, pct:values.length ? values.filter(v=>v>0).length/values.length*100 : null}; };
  const breadth50=ratio('pctSma50'), breadth200=ratio('pctSma200');
  const returns=Object.fromEntries(['ret1m','ret3m'].map(key=>[key,median(observed.map(row=>read(row,key)).filter(v=>v!=null))]));
  const typed=observed.map(row=>({...row,...Object.fromEntries(['ret1m','ret3m','ret6m','pctSma50'].map(key=>[key,read(row,key)]))}));
  const groups=buildGroupStrength({rows:typed,themes:koreanThemeGroups(themes,typed),market:'KR'}).groups.filter(g=>g.ret3m!=null).slice(0,5);
  const headline=!date ? '한국 종가 표본의 기준일을 확인하지 못했습니다.' : breadth50.pct == null ? '한국 표본의 이동평균 자료가 부족합니다.'
    : `한국 수집 표본 ${observed.length}개 중 50일선 위 ${breadth50.pct.toFixed(1)}%${returns.ret3m!=null ? ` · 3개월 수익률 중앙값 ${returns.ret3m>=0?'+':''}${returns.ret3m.toFixed(1)}%` : ''}.`;
  const session=date ? sessionRead({observed,date,index}) : null;
  return {available:!!date,date,latestDate:latest?.date||null,delayed:date!==latest?.date,population:population.length,observed:observed.length,excluded:population.length-observed.length,breadth50,breadth200,returns,groups,headline,session,
    watch:['코스피·코스닥 방향과 50·200일선 위 종목 비율이 함께 개선되는지 확인합니다. 지수만 오르면 소수 종목 집중 가능성을 점검합니다.',
      '원화 움직임과 강한 한국 테마의 수익률을 함께 봅니다. 환율만으로 외국인 순매수·순매도를 추정하지 않습니다.',
      '지수와 참여 종목이 함께 약해지면 보유 기업의 실적·유동성·투자 논지를 다시 확인합니다.'],
    missing:['외국인·기관 순매수','한국 기업 공시 재무','전 거래소 전체 종목 시장 폭']};
}
export function koreaParticipationContext(model) {
  return model?.available ? `한국 시장 표본 · ${model.date} KRX 완료 종가. ${model.session?.text ? `${model.session.text} ` : ''}${model.headline} 200일선 위 ${model.breadth200.pct==null?'미확인':model.breadth200.pct.toFixed(1)+'%'}. 모집단 ${model.observed}/${model.population}. 전 시장 지표가 아니며 미수집 수급/공시를 추정하지 않는다. 관찰: ${model.watch.join(' ')}` : '';
}
