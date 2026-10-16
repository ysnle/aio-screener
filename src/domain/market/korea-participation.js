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
// v57.81 (analysis audit 2026-10-15): 10/15 read "코스피 -7.6% vs 표본 중앙값 -6.5%(-3% 이하 175개 · 하락 221개)" with no
// reading — the gap was inside the ±2%p tilt band — although 92% of the sample fell. How far a move spread is its own
// reading: SPREAD_SHARE of the sample moving one way, or BIG_MOVE_SHARE moving 3% or more, is a move across the sample.
// The 5-session gap is read by the same rules (spread first, then where the size sat).
export const SPREAD_SHARE = 0.8;
export const BIG_MOVE_SHARE = 0.5;
function moveCounts(values) {
  return { count:values.length, median:median(values), down3:values.filter(v=>v<=-3).length, up3:values.filter(v=>v>=3).length, falling:values.filter(v=>v<0).length, rising:values.filter(v=>v>0).length };
}
function spreadWord(counts) {
  if (!counts.count) return null;
  if (counts.falling/counts.count >= SPREAD_SHARE || counts.down3/counts.count >= BIG_MOVE_SHARE) return { dir:'down', share:Math.round(counts.falling/counts.count*100) };
  if (counts.rising/counts.count >= SPREAD_SHARE || counts.up3/counts.count >= BIG_MOVE_SHARE) return { dir:'up', share:Math.round(counts.rising/counts.count*100) };
  return null;
}
function gapReading(indexMove, counts, { lead = '' } = {}) {
  const spread = spreadWord(counts);
  const gap = indexMove - counts.median;
  // v57.88 (screen audit): the gap is read with the index direction — on 10/16 KOSPI +2.0% against a +4.6% median read
  // '지수 하락 폭이 … 하락이 몰렸습니다'. Four cases: the index moved more or less than the median, up or down.
  const more = spread ? '더 ' : '';
  const size = Math.abs(indexMove) < 1.5 ? ''
    : indexMove < 0 && gap <= -2 ? `지수 하락 폭이 표본 중앙값보다 훨씬 커 시가총액이 큰 종목에 하락이 ${more}몰렸습니다`
    : indexMove < 0 && gap >= 2 ? '지수 하락 폭이 표본 중앙값보다 훨씬 작아 시가총액이 큰 종목은 덜 내리고 중소형 종목이 더 내렸습니다'
    : indexMove > 0 && gap >= 2 ? `지수 상승 폭이 표본 중앙값보다 훨씬 커 시가총액이 큰 종목에 상승이 ${more}몰렸습니다`
    : indexMove > 0 && gap <= -2 ? '지수 상승 폭이 표본 중앙값보다 훨씬 작아 시가총액이 큰 종목은 덜 오르고 중소형 종목이 더 올랐습니다'
      : !spread && Math.abs(gap) < 1 ? '표본 종목 전반이 지수와 비슷하게 움직였습니다' : '';
  const spreadText = spread ? `${lead}표본의 ${spread.share}%가 ${spread.dir==='down'?'내려':'올라'} 표본 전반으로 번진 ${spread.dir==='down'?'하락':'상승'}입니다` : '';
  return [spreadText, size].filter(Boolean).join(' — ');
}
function sessionRead({ observed, date, index }) {
  const values = key => observed.map(row => finite(row[key])).filter(v => v!=null);
  const day = moveCounts(values('ret1d')), week5 = moveCounts(values('ret5d'));
  const out = { count:day.count, ret1d:day.median, ret5d:week5.median, down3:day.down3, up3:day.up3, falling:day.falling, falling5:week5.falling, down3_5:week5.down3, spread:spreadWord(day)?.dir || null, spread5:spreadWord(week5)?.dir || null, text:null };
  if (out.ret1d==null || out.count<20) return out;
  const md = `${Number(date.slice(5,7))}/${Number(date.slice(8,10))}`;
  // v57.88: an up day counts the up side (+3% 이상 · 상승), a down or flat day the down side.
  const sample = `AIO 추적 종목(한국) ${out.count}개 하루 수익률 중앙값 ${sgn(out.ret1d)}${out.ret1d > 0 ? `(+3% 이상 ${out.up3}개 · 상승 ${day.rising}개)` : `(-3% 이하 ${out.down3}개 · 하락 ${out.falling}개)`}`;
  const same = index?.date===date && finite(index?.d1)!=null;
  if (!same) { const spread = spreadWord(day); out.text = `${md} ${sample}${spread ? ` — 표본의 ${spread.share}%가 ${spread.dir==='down'?'내려 표본 전반으로 번진 하락':'올라 표본 전반으로 번진 상승'}입니다` : ''}.`; return out; }
  const dayRead = gapReading(index.d1, day);
  const weekRead = finite(index.d5)!=null && week5.median!=null && week5.count>=20 ? gapReading(index.d5, week5) : '';
  const week = finite(index.d5)!=null && out.ret5d!=null ? ` 5거래일은 지수 ${sgn(index.d5)} · 표본 중앙값 ${sgn(out.ret5d)}${weekRead ? `로, ${weekRead}` : '입니다'}.` : '';
  out.text = `코스피 ${md} ${sgn(index.d1)} vs ${sample}${dayRead ? ` — ${dayRead}` : ''}.${week}`;
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
    : `AIO 추적 종목(한국) ${observed.length}개 중 50일선 위 ${breadth50.pct.toFixed(1)}%${returns.ret3m!=null ? ` · 3개월 수익률 중앙값 ${returns.ret3m>=0?'+':''}${returns.ret3m.toFixed(1)}%` : ''}.`;
  const session=date ? sessionRead({observed,date,index}) : null;
  return {available:!!date,date,latestDate:latest?.date||null,delayed:date!==latest?.date,population:population.length,observed:observed.length,excluded:population.length-observed.length,breadth50,breadth200,returns,groups,headline,session,
    watch:['코스피·코스닥 방향과 50·200일선 위 종목 비율이 함께 개선되는지 확인합니다. 지수만 오르면 소수 종목 집중 가능성을 점검합니다.',
      '원화 움직임과 3개월 수익률 상위 한국 테마의 최근 1개월 수익률을 함께 봅니다. 환율만으로 외국인 순매수·순매도를 추정하지 않습니다.',
      '지수와 참여 종목이 함께 약해지면 보유 기업의 실적·유동성·투자 논지를 다시 확인합니다.'],
    missing:['외국인·기관 순매수','한국 기업 공시 재무','전 거래소 전체 종목 시장 폭']};
}
export function koreaParticipationContext(model) {
  return model?.available ? `한국 시장 표본 · ${model.date} KRX 확정 종가. ${model.session?.text ? `${model.session.text} ` : ''}${model.headline} 200일선 위 ${model.breadth200.pct==null?'미확인':model.breadth200.pct.toFixed(1)+'%'}. 모집단 ${model.observed}/${model.population}. 전 시장 지표가 아니며 미수집 수급/공시를 추정하지 않는다. 관찰: ${model.watch.join(' ')}` : '';
}
