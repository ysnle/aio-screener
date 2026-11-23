import { latestCompletedUsSession } from './market-calendar.js';

export const US_CORE_SYMBOLS = Object.freeze(['^GSPC', '^IXIC', '^DJI', '^VIX', 'SPY', 'QQQ']);

const LIVE_MAX_MS = 20 * 60000;
const DELAYED_MAX_MS = 90 * 60000;

function kstParts(ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
  return { md: `${Number(p.month)}/${Number(p.day)}`, hm: `${p.hour}:${p.minute}` };
}

const result = (state, badge, detail, title) => Object.freeze({ state, badge, detail, title });

function mdOf(date) {
  const [, month, day] = String(date).split('-').map(Number);
  return `${month}/${day}`;
}

/**
 * @param {{ observations: Array<{symbol:string, observedMs:number}>, nowMs?: number, session?: object|null }} input
 */
export function describeQuoteCurrentness({ observations = [], nowMs = Date.now(), session, durableCount } = {}) {
  const basis = session === undefined ? latestCompletedUsSession(nowMs) : session;
  const us = observations.filter((row) => US_CORE_SYMBOLS.includes(row?.symbol) && Number.isFinite(row?.observedMs) && row.observedMs <= nowMs + 60000);
  const count = observations.filter((row) => Number.isFinite(row?.observedMs)).length;
  if (!us.length) {
    return result('none', '미수신', '시각 확인된 시세 없음', '시각이 확인된 미국 핵심 지수 시세가 없습니다.');
  }
  const newestMs = Math.max(...us.map((row) => row.observedMs));
  const ageMs = nowMs - newestMs;
  const at = kstParts(newestMs);
  const durable = Number.isFinite(durableCount) && durableCount > 0 ? durableCount : null;
  const suffix = durable != null
    ? `, 시세 ${durable}종` + (count ? `, 실시간 관측 ${count}종` : '')
    : (count ? `, 시세 ${count}종` : '');
  if (basis?.inSession) {
    if (ageMs <= LIVE_MAX_MS) return result('live', 'LIVE', `${at.hm} 기준${suffix}`, `미국 정규장 중, 최신 관측 ${at.md} ${at.hm} KST`);
    if (ageMs <= DELAYED_MAX_MS) return result('delayed', '지연', `${Math.round(ageMs / 60000)}분 전${suffix}`, `미국 정규장 중, 최신 관측 ${at.md} ${at.hm} KST`);
  } else if (basis && newestMs >= basis.closeMs - 5 * 60000) {
    return result('close', '종가', `${mdOf(basis.date)} 마감${suffix}`, `미국 정규장 마감, ${mdOf(basis.date)} 종가 기준 (최신 관측 ${at.md} ${at.hm} KST)`);
  }
  return result('stale', '지난 시세', `${at.md} ${at.hm}${suffix}`, `최신 관측이 ${basis?.inSession ? '90분 이상 지났습니다' : `${basis ? mdOf(basis.date) + ' 종가보다 오래됐습니다' : '거래 캘린더로 확인되지 않습니다'}`}, 증권사 앱에서 현재가를 확인하세요.`);
}
