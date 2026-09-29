// P1326/R671 (F-56): one vocabulary for "how current are the prices on screen".
// The header used to say "실시간 11:05" with the *current clock* whenever any row came from
// the live proxy — even when every observation was last night's US close. Currentness is a
// property of the observations and the US session calendar, never of the fetch time.
//
//   live    실시간 HH:MM   US regular session open and the newest US observation ≤ 20 min old
//   delayed 지연 N분        session open, newest observation 20–90 min old
//   close   종가 M/D        session closed and the newest observation is the latest completed close
//   stale   지난 시세 M/D   anything older than that basis
//   none    시세 미수신      no timestamped US observation
import { latestCompletedUsSession } from '../../ai/time/market-session.js';

export const QUOTE_CURRENTNESS_VERSION = 'quote-currentness.v1';
export const US_CORE_SYMBOLS = Object.freeze(['^GSPC', '^IXIC', '^DJI', '^VIX', 'SPY', 'QQQ']);

const LIVE_MAX_MS = 20 * 60000;
const DELAYED_MAX_MS = 90 * 60000;

function kstParts(ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
  return { md: `${Number(p.month)}/${Number(p.day)}`, hm: `${p.hour}:${p.minute}` };
}

function mdOf(date) {
  const [, month, day] = String(date).split('-').map(Number);
  return `${month}/${day}`;
}

/**
 * @param {{ observations: Array<{symbol:string, observedMs:number}>, nowMs?: number, session?: object|null }} input
 */
export function describeQuoteCurrentness({ observations = [], nowMs = Date.now(), session } = {}) {
  const basis = session === undefined ? latestCompletedUsSession(nowMs) : session;
  const us = observations.filter((row) => US_CORE_SYMBOLS.includes(row?.symbol) && Number.isFinite(row?.observedMs) && row.observedMs <= nowMs + 60000);
  const count = observations.filter((row) => Number.isFinite(row?.observedMs)).length;
  if (!us.length) {
    return Object.freeze({ version: QUOTE_CURRENTNESS_VERSION, state: 'none', badge: '미수신', text: '시세 미수신', detail: '시각 확인된 시세 없음', title: '시각이 확인된 미국 핵심 지수 시세가 없습니다.', count, newestMs: null });
  }
  const newestMs = Math.max(...us.map((row) => row.observedMs));
  const ageMs = nowMs - newestMs;
  const at = kstParts(newestMs);
  const suffix = count ? ` · ${count}개` : '';
  if (basis?.inSession) {
    if (ageMs <= LIVE_MAX_MS) return Object.freeze({ version: QUOTE_CURRENTNESS_VERSION, state: 'live', badge: 'LIVE', text: `실시간 ${at.hm}${suffix}`, detail: `${at.hm} 기준${suffix}`, title: `미국 정규장 중 · 최신 관측 ${at.md} ${at.hm} KST`, count, newestMs });
    if (ageMs <= DELAYED_MAX_MS) return Object.freeze({ version: QUOTE_CURRENTNESS_VERSION, state: 'delayed', badge: '지연', text: `지연 ${Math.round(ageMs / 60000)}분${suffix}`, detail: `${Math.round(ageMs / 60000)}분 전${suffix}`, title: `미국 정규장 중 · 최신 관측 ${at.md} ${at.hm} KST`, count, newestMs });
  } else if (basis && newestMs >= basis.closeMs - 5 * 60000) {
    return Object.freeze({ version: QUOTE_CURRENTNESS_VERSION, state: 'close', badge: '종가', text: `미국 종가 ${mdOf(basis.date)}${suffix}`, detail: `${mdOf(basis.date)} 마감${suffix}`, title: `미국 정규장 마감 · ${mdOf(basis.date)} 종가 기준 (최신 관측 ${at.md} ${at.hm} KST)`, count, newestMs });
  }
  return Object.freeze({ version: QUOTE_CURRENTNESS_VERSION, state: 'stale', badge: '지난 시세', text: `지난 시세 ${at.md} ${at.hm}${suffix}`, detail: `${at.md} ${at.hm}${suffix}`, title: `최신 관측이 ${basis?.inSession ? '90분 이상 지났습니다' : `${basis ? mdOf(basis.date) + ' 종가보다 오래됐습니다' : '거래 캘린더로 확인되지 않습니다'}`} · 증권사 앱에서 현재가를 확인하세요.`, count, newestMs });
}
