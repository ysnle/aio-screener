// v58.81 (owner 2026-10-26): "지금 어느 장이 열려 있고, 한국장 마감과 미국 장전 시세가 서로 어떻게 이어지는가".
// The verdict is fixed to the last completed US close (R670); this model sits beside it and reads the clock and the
// published snapshot (Tier-0 quotes plus the evidence-only rows: futures, semis, Nikkei, Hang Seng). It never feeds the
// six-axis tally. The Korean session is explained as candidate drivers each checked against the same day's numbers —
// US cue, Asia together, the won, Korea-only — so the reader sees several links at once instead of one cause.
import { latestCompletedUsSession, nyParts, resolveMarketCalendarSession, usWeekendClosed } from './market-calendar.js';
import { signedText } from '../shared/number.js';

export const SESSION_BRIDGE_VERSION = 'session-bridge.v1';
const MINUTE = 60000;
const KST_OFFSET_MS = 9 * 60 * MINUTE;
// A move smaller than this is read as flat; a Korea move this much larger than every outside cue is called Korea-led.
export const BRIDGE_RULES = Object.freeze({ movePct: 0.5, koreaExcessPct: 1.0, kosdaqGapPct: 1.5, fxPct: 0.5, fxFlatPct: 0.3, oilPct: 1.5, futuresPct: 0.2, staleMin: 60 });

const kstParts = (ms) => { const d = new Date(ms + KST_OFFSET_MS); return { date: d.toISOString().slice(0, 10), minute: d.getUTCHours() * 60 + d.getUTCMinutes() }; };
const kstClock = (ms) => new Date(ms + KST_OFFSET_MS).toISOString().slice(11, 16);
const md = (date) => { const [, m, d] = String(date || '').split('-').map(Number); return m && d ? `${m}/${d}` : ''; };
const minuteOf = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const afterText = (min) => min < 60 ? `${min}분 후` : `${Math.floor(min / 60)}시간${min % 60 ? ` ${min % 60}분` : ''} 후`;
const ageText = (min) => min < 60 ? `${min}분 전` : min < 1440 ? `${Math.floor(min / 60)}시간 전` : `${Math.floor(min / 1440)}일 전`;
const pct = (value) => signedText(value, 1, '%');

function nextOpenDate(market, fromDate) {
  let cursor = fromDate;
  for (let i = 0; i < 10; i += 1) {
    cursor = new Date(Date.parse(`${cursor}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
    const session = resolveMarketCalendarSession({ market, date: cursor });
    if (session.status === 'unknown') return null;
    if (session.status === 'open') return cursor;
  }
  return null;
}

/** Which part of each market's day `nowMs` falls in (calendar-aware; DST follows America/New_York). */
export function marketClock(nowMs = Date.now()) {
  const ny = nyParts(nowMs);
  const usDay = resolveMarketCalendarSession({ market: 'US', date: ny.date });
  let us;
  if (usDay.status === 'unknown') us = { phase: 'unknown', label: '미국 거래 일정 미확인' };
  else if (usDay.status === 'closed') {
    const next = nextOpenDate('US', ny.date);
    us = { phase: 'closed', label: usDay.reason === 'holiday' ? '미국 휴장일' : '미국 주말 휴장', futuresOpen: !usWeekendClosed(nowMs), nextOpen: next };
  } else {
    const close = minuteOf(usDay.close);
    const openMs = nowMs + (570 - ny.minute) * MINUTE;
    const closeMs = nowMs + (close - ny.minute) * MINUTE;
    if (ny.minute < 240) us = { phase: 'overnight', label: '미국 장 시작 전(선물만 거래)', openMs, opensIn: 570 - ny.minute };
    else if (ny.minute < 570) us = { phase: 'pre', label: '미국 프리마켓', openMs, opensIn: 570 - ny.minute };
    else if (ny.minute < close) us = { phase: 'regular', label: usDay.halfDay ? '미국 정규장(조기 폐장일)' : '미국 정규장', closeMs, closesIn: close - ny.minute };
    else if (ny.minute < 1200) us = { phase: 'post', label: '미국 애프터마켓', closeMs };
    // CME stops from 17:00 ET Friday to the 18:00 ET Sunday reopen (v58.74 usWeekendClosed).
    else us = { phase: 'overnight', label: usWeekendClosed(nowMs) ? '미국 장 마감(선물 주말 휴장)' : '미국 장 마감 후(선물만 거래)' };
  }
  const kst = kstParts(nowMs);
  const krDay = resolveMarketCalendarSession({ market: 'KR', date: kst.date });
  let kr;
  if (krDay.status === 'unknown') kr = { phase: 'unknown', label: '한국 거래 일정 미확인' };
  else if (krDay.status === 'closed') kr = { phase: 'closed', label: krDay.reason === 'holiday' ? '한국 휴장일' : '한국 주말 휴장', nextOpen: nextOpenDate('KR', kst.date) };
  else {
    const close = minuteOf(krDay.close);
    if (kst.minute < 540) kr = { phase: 'before', label: '한국장 개장 전', opensIn: 540 - kst.minute };
    else if (kst.minute < close) kr = { phase: 'regular', label: '한국 정규장', closesIn: close - kst.minute };
    // P1533: the close is final 30 minutes after 15:30 (closing auction and publication).
    else if (kst.minute < close + 30) kr = { phase: 'closing', label: '한국장 마감 직후(종가 확정 대기)' };
    else kr = { phase: 'closed-today', label: '한국장 마감', nextOpen: nextOpenDate('KR', kst.date) };
  }
  return { nowMs, kstDate: kst.date, kstTime: kstClock(nowMs), us, kr };
}

function clockLine(clock) {
  const { us } = clock;
  const usText = us.phase === 'pre' || (us.phase === 'overnight' && us.openMs)
    ? `${us.label}, 정규장 개장 ${kstClock(us.openMs)} KST(${afterText(us.opensIn)})`
    : us.phase === 'regular' ? `${us.label}, 마감 ${kstClock(us.closeMs)} KST(${afterText(us.closesIn)})`
      : us.phase === 'closed' ? `${us.label}${us.futuresOpen ? '(선물은 거래 중)' : ''}${us.nextOpen ? `, 다음 정규장 ${md(us.nextOpen)}` : ''}` : us.label;
  return `지금 ${clock.kstTime} KST — ${usText} · ${clock.kr.label}`;
}

function quoteMap(snapshot) {
  const rows = [...(snapshot?.quotes || []), ...(snapshot?.evidenceQuotes || [])];
  return new Map(rows.filter((row) => row?.instrumentId && Number.isFinite(row.value)).map((row) => [row.instrumentId, row]));
}

function reading(quotes, id, nowMs) {
  const row = quotes.get(id);
  if (!row) return null;
  const observedMs = Date.parse(row.observedAt || '');
  const change = Number.isFinite(row.changePct) ? row.changePct : null;
  return { id, value: row.value, change, observedAt: row.observedAt || null, ageMin: Number.isFinite(observedMs) ? Math.max(0, Math.round((nowMs - observedMs) / MINUTE)) : null };
}

const sideOf = (value, threshold = BRIDGE_RULES.movePct) => value == null ? null : value >= threshold ? 1 : value <= -threshold ? -1 : 0;

/** Candidate drivers of the latest Korean session, each checked against the same day's numbers. */
export function koreaLinks({ kospi, kosdaq, nasdaq: nasdaqRow, semis, nikkei: nikkeiRow, hangseng: hangsengRow, usdkrw: usdkrwRow }) {
  if (kospi?.change == null) return [];
  // Only cues the Korean session could have traded on: the US session completed before the KOSPI observation, and Asia
  // rows of the same KST date. A US session that ran after the Korean close (06:00 KST next morning) is not a cause.
  const kospiMs = Date.parse(kospi.observedAt || '');
  const usBefore = Number.isFinite(kospiMs) ? latestCompletedUsSession(kospiMs, { requirePrevious: false })?.date : null;
  const nasdaq = nasdaqRow?.observedAt && usBefore && nyParts(Date.parse(nasdaqRow.observedAt)).date === usBefore ? nasdaqRow : null;
  const krDate = Number.isFinite(kospiMs) ? kstParts(kospiMs).date : null;
  const sameDay = (row) => (row?.observedAt && kstParts(Date.parse(row.observedAt)).date === krDate ? row : null);
  // The won trades around the clock: only a reading of the same KST date as the Korean session is a candidate.
  const nikkei = sameDay(nikkeiRow), hangseng = sameDay(hangsengRow), usdkrw = sameDay(usdkrwRow);
  const kr = kospi.change;
  const krSide = sideOf(kr);
  const links = [];
  // 1. The previous US session (the Korean morning trades on it).
  if (nasdaq?.change != null) {
    const usSide = sideOf(nasdaq.change);
    const verdict = krSide === 0 ? 'unknown' : usSide === krSide ? 'supports' : 'against';
    links.push({ id: 'us', label: '직전 미국장', verdict, evidence: `나스닥 ${pct(nasdaq.change)}${semis?.change != null ? `, 반도체 ETF ${pct(semis.change)}` : ''}`,
      text: verdict === 'supports' ? '같은 방향이라 미국장 흐름이 이어진 몫이 있습니다.' : verdict === 'against' ? (usSide === 0 ? '미국장 변화가 작아 이 움직임을 설명하지 못합니다.' : '미국장과 반대 방향이라 미국발로 보기 어렵습니다.') : '한국 변화가 작아 비교하지 않습니다.' });
  }
  // 2. Asia on the same day.
  const asia = [['닛케이', nikkei], ['항셍', hangseng]].filter(([, row]) => row?.change != null);
  if (asia.length) {
    const same = asia.filter(([, row]) => sideOf(row.change) === krSide && krSide !== 0).length;
    const verdict = krSide === 0 ? 'unknown' : same === asia.length ? 'supports' : same ? 'partial' : 'against';
    links.push({ id: 'asia', label: '아시아 동반', verdict, evidence: asia.map(([name, row]) => `${name} ${pct(row.change)}`).join(', '),
      text: verdict === 'supports' ? '아시아 증시가 함께 움직여 지역 공통 요인의 몫이 있습니다.' : verdict === 'partial' ? '아시아 일부만 같은 방향이라 공통 요인은 일부입니다.' : verdict === 'against' ? '아시아는 같은 방향이 아니어서 지역 공통 요인으로 보기 어렵습니다.' : '한국 변화가 작아 비교하지 않습니다.' });
  }
  // 3. The won. USDKRW up = the won weaker; a weaker won with falling stocks is the foreign-selling channel.
  if (usdkrw?.change != null) {
    const fx = usdkrw.change;
    const verdict = krSide === -1 && fx >= BRIDGE_RULES.fxPct ? 'supports' : krSide === 1 && fx <= -BRIDGE_RULES.fxPct ? 'supports' : Math.abs(fx) < BRIDGE_RULES.fxFlatPct ? 'against' : 'unknown';
    links.push({ id: 'fx', label: '원화 환율', verdict, evidence: `원/달러 ${usdkrw.value.toLocaleString('en-US', { maximumFractionDigits: 1 })}원 (${pct(fx)})`,
      text: verdict === 'supports' ? (fx > 0 ? '원화 약세가 함께 나와 외국인 매도 압력과 같은 방향입니다.' : '원화 강세가 함께 나와 외국인 매수 흐름과 같은 방향입니다.')
        : verdict === 'against' ? '환율은 거의 그대로라 환율발 움직임으로 볼 근거는 약합니다.' : '환율 변화가 주가와 같은 방향의 압력으로 읽히지 않습니다.' });
  }
  // 4. Korea-only: larger than every outside cue, and the KOSDAQ apart from the KOSPI.
  const outside = [nasdaq?.change, ...asia.map(([, row]) => row.change)].filter((value) => value != null).map(Math.abs);
  if (outside.length && krSide !== 0) {
    // The larger of the two Korean indexes is compared: a KOSDAQ fall twice the KOSPI's is itself a Korea-only signal.
    const excess = Math.max(Math.abs(kr), Math.abs(kosdaq?.change ?? 0)) - Math.max(...outside);
    const gap = kosdaq?.change != null ? kosdaq.change - kr : null;
    const verdict = excess >= BRIDGE_RULES.koreaExcessPct ? 'supports' : 'against';
    const gapText = gap != null && Math.abs(gap) >= BRIDGE_RULES.kosdaqGapPct ? ` 코스닥이 코스피보다 ${Math.abs(gap).toFixed(1)}%p ${gap < 0 ? '더 빠져' : '더 올라'} 중소형·테마주 쪽 움직임이 컸습니다.` : '';
    links.push({ id: 'local', label: '한국 고유 요인', verdict, evidence: `코스피 ${pct(kr)}${kosdaq?.change != null ? `, 코스닥 ${pct(kosdaq.change)}` : ''}`,
      text: (verdict === 'supports' ? `바깥 신호보다 ${excess.toFixed(1)}%p 더 움직여 국내 수급·업종·개별 소식의 몫이 큽니다.` : '바깥 신호와 비슷한 크기라 국내 요인만으로 볼 필요는 적습니다.') + gapText });
  }
  return links;
}

/**
 * @param {object} input { nowMs, snapshot } — snapshot is the published market snapshot (quotes + evidenceQuotes)
 * @returns the clock, the readings it used with their age, the Korea links and the next-link lines
 */
export function buildSessionBridge({ nowMs = Date.now(), snapshot = null } = {}) {
  const clock = marketClock(nowMs);
  const quotes = quoteMap(snapshot);
  const read = (id) => reading(quotes, id, nowMs);
  const r = { es: read('ES=F'), nq: read('NQ=F'), kospi: read('^KS11'), kosdaq: read('^KQ11'), nasdaq: read('^IXIC'), semis: read('SMH'), nikkei: read('^N225'), hangseng: read('^HSI'), usdkrw: read('KRW=X'), wti: read('CL=F'), vix: read('^VIX') };
  const lines = [];
  // Korea's latest session (date in KST) with its candidate drivers.
  const krDate = r.kospi?.observedAt ? kstParts(Date.parse(r.kospi.observedAt)).date : null;
  const links = koreaLinks(r);
  const supported = links.filter((link) => link.verdict === 'supports').map((link) => link.label);
  const krLive = clock.kr.phase === 'regular' && krDate === clock.kstDate;
  const koreaHead = r.kospi?.change != null ? `한국장 ${md(krDate)} ${krLive ? `진행 중(${kstClock(Date.parse(r.kospi.observedAt))} 관측)` : '마감'} 코스피 ${pct(r.kospi.change)}${r.kosdaq?.change != null ? `, 코스닥 ${pct(r.kosdaq.change)}` : ''}` : null;
  const koreaRead = !links.length ? null : supported.length ? `맞아떨어지는 근거: ${supported.join(' · ')}${supported.length > 1 ? ' — 한 가지 원인이 아니라 여러 요인이 겹친 날입니다' : ''}.`
    : '확인한 바깥 요인 어느 것도 크게 맞지 않아 원인을 하나로 단정하지 않습니다.';
  // Futures since the previous settlement — the market-implied direction into the US open.
  const futures = [['S&P 500 선물', r.es], ['나스닥 100 선물', r.nq]].filter(([, row]) => row?.change != null);
  const ages = futures.map(([, row]) => row.ageMin);
  const futuresAge = futures.length && ages.every((age) => age != null) ? Math.max(...ages) : null;
  const futuresLive = !usWeekendClosed(nowMs);
  // A row without an observation time is not presented as fresh.
  const futuresStale = futuresLive && futures.length > 0 && (futuresAge == null || futuresAge > BRIDGE_RULES.staleMin);
  const futuresLine = futures.length ? `${futures.map(([name, row]) => `${name} ${signedText(row.change, 2, '%')}`).join(', ')} (직전 정산 대비${futuresAge != null ? `, ${ageText(futuresAge)} 관측` : ', 관측 시각 없음'}${futuresStale ? ' — 갱신 지연, 지금 값과 다를 수 있음' : ''})` : null;
  if (futuresLine) lines.push(futuresLine);
  // How the Korean close and the US futures relate, and what decides the next Korean session.
  const krSide = sideOf(r.kospi?.change, 1);
  const fSide = sideOf(r.nq?.change ?? r.es?.change, BRIDGE_RULES.futuresPct);
  let next = null;
  // Only between the Korean close and tonight's US open: the Korean session must be newer than the last completed US
  // close, and the US regular session must still be ahead today (not a weekend, holiday or a session already run).
  const lastUs = latestCompletedUsSession(nowMs, { requirePrevious: false });
  const krAfterUs = r.kospi?.observedAt && lastUs ? Date.parse(r.kospi.observedAt) > lastUs.closeMs : false;
  const beforeOpen = clock.us.phase === 'pre' || (clock.us.phase === 'overnight' && clock.us.openMs != null);
  if (krSide && fSide != null && krAfterUs && beforeOpen) {
    next = krSide === -1 && fSide === 1 ? '한국은 내렸지만 미국 선물은 오르는 쪽이라, 한국 하락이 미국으로 번지는 신호는 아직 없습니다. 다음 한국장은 오늘 밤 미국 정규장 결과가 다시 기준이 됩니다.'
      : krSide === 1 && fSide === -1 ? '한국은 올랐지만 미국 선물은 내리는 쪽이라, 다음 한국장 전에 미국 정규장이 이 상승을 지켜 주는지 확인할 차례입니다.'
        : krSide === fSide ? `한국장과 미국 선물이 같은 ${krSide < 0 ? '약세' : '강세'} 쪽이라 같은 방향 압력이 이어지는지 미국 정규장 첫 30분이 확인 구간입니다.`
          : '미국 선물 변화가 작아 한국장 흐름을 미국이 이어 받을지는 정규장에서 확인합니다.';
  }
  // Oil → inflation/rates chain when oil moved enough to matter for the rates read.
  const oil = r.wti?.change != null && Math.abs(r.wti.change) >= BRIDGE_RULES.oilPct
    ? `유가(WTI) ${pct(r.wti.change)} — ${r.wti.change < 0 ? '물가·금리 부담을 덜어 주는 쪽' : '물가·금리 부담을 키우는 쪽'}이라 금리와 성장주 흐름을 같이 봅니다.` : null;
  const snapshotAgeMin = Number.isFinite(Date.parse(snapshot?.generatedAt || '')) ? Math.max(0, Math.round((nowMs - Date.parse(snapshot.generatedAt)) / MINUTE)) : null;
  return {
    schemaVersion: SESSION_BRIDGE_VERSION,
    available: !!(koreaHead || futuresLine),
    clock,
    clockLine: clockLine(clock),
    koreaHead, koreaRead, links,
    futuresLine, futuresStale, next, oil,
    snapshotAgeMin,
    readings: r
  };
}

export function renderSessionBridgeContext(model) {
  if (!model?.available) return '';
  return [
    `[장 시계와 연결 점검, ${SESSION_BRIDGE_VERSION}] ${model.clockLine}. 판정(6개 지표)은 직전 미국 종가 기준이고, 아래는 그 뒤 시세의 연결 점검입니다(매매 지시 아님).`,
    model.koreaHead ? `${model.koreaHead}. ${model.koreaRead || ''}` : '',
    ...model.links.map((link) => `- ${link.label}(${link.verdict === 'supports' ? '근거 맞음' : link.verdict === 'partial' ? '일부 맞음' : link.verdict === 'against' ? '근거 약함' : '판단 보류'}): ${link.evidence}. ${link.text}`),
    model.futuresLine ? `미국 선물: ${model.futuresLine}` : '',
    model.next || '', model.oil || ''
  ].filter(Boolean).join('\n');
}
