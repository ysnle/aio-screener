// v57.81 (analysis audit 2026-10-15): the two Korean index cards disagreed — 시장 상태 read "최근 21개 한국 거래일
// -21.0%" with no day figure, the chart tab "하루 -7.6%, 20거래일 -19.6%" with no rarity — while the briefing called the
// same day a record. Both cards now read one record per index: the 1- and 5-session change and, when it sits in the
// tail (KR_SHOCK_TAIL_PCT), its position in AIO's own record. KOSPI is the briefing's koreaMoveRecord itself; KOSDAQ is
// measured by the same rule (exact KRX session spans, the last 252 changes). One month is KR_MONTH_SESSIONS everywhere.
import { koreaMoveRecord, koreaRecordText, krSessionThrough, KR_SHOCK_TAIL_PCT } from '../briefing/market-read.js';
import { RULES } from '../rules/thresholds.js';
import { buildCloseSeries, recordPercentile } from './close-series.js';
import { countOpenSessionsBetween } from './market-calendar.js';
import { signedText } from '../shared/number.js';

export const KR_MONTH_SESSIONS = 20;
const signed = (value) => `${signedText(value, 1)}%`;

/** { date, d1, d5, rec1, rec5, tail1, tail5, tail, extreme } for a KRX index field, or null under two closes. */
export function krIndexMoveRecord(history = [], field = 'kospi', { now = Date.now() } = {}) {
  if (field === 'kospi') return koreaMoveRecord(history, { now });
  const series = buildCloseSeries(history, field, { through: krSessionThrough(now) });
  if (series.length < 2) return null;
  const changes = (n) => {
    const out = [];
    for (let index = n; index < series.length; index += 1) {
      if (countOpenSessionsBetween(series[index - n].date, series[index].date, 'KR') === n) out.push({ date: series[index].date, value: (series[index].value / series[index - n].value - 1) * 100 });
    }
    return out;
  };
  const last = series[series.length - 1];
  const one = changes(1), five = changes(5);
  const latest = (list) => (list.at(-1)?.date === last.date ? list.at(-1).value : null);
  const d1 = latest(one), d5 = latest(five);
  const rec1 = d1 == null ? null : recordPercentile(one, d1);
  const rec5 = d5 == null ? null : recordPercentile(five, d5);
  const tailOf = (rec) => (rec?.pct == null ? null : Math.min(rec.pct, 100 - rec.pct));
  const tails = [tailOf(rec1), tailOf(rec5)].filter((value) => value != null);
  const tail = tails.length ? Math.min(...tails) : null;
  return { date: last.date, d1, d5, rec1, rec5, tail1: tailOf(rec1), tail5: tailOf(rec5), tail, extreme: tail != null && tail <= KR_SHOCK_TAIL_PCT };
}

/** "하루 -7.6% · 5거래일 -18.4%(최근 252거래일 기록에서 하루 하위 2%·5거래일 최저)" — record only in the tail. */
export function krIndexMoveText(record) {
  if (!record || record.d1 == null) return '';
  const rare = koreaRecordText(record, { maxTail: KR_SHOCK_TAIL_PCT });
  return `하루 ${signed(record.d1)}${record.d5 != null ? `, 5거래일 ${signed(record.d5)}` : ''}${rare ? `(${rare})` : ''}`;
}

/**
 * The clause the 오늘 Korea line adds when the KOSPI session should be read apart from the US tally: a move rare in AIO's
 * own KOSPI record (1- or 5-session, outer KR_SHOCK_TAIL_PCT) on the shown session is named with that record; otherwise
 * a 5-session change of at least RULES.briefing.krSeparate5dPct either way. '' when neither holds.
 */
export function krSeparateCheckTone(history, kospi, { now = Date.now() } = {}) {
  if (!kospi) return '';
  const record = koreaMoveRecord(history, { now });
  const rare = record?.extreme && record.date === kospi.date ? koreaRecordText(record, { maxTail: KR_SHOCK_TAIL_PCT }) : '';
  if (rare) return ` — 코스피 변화가 ${rare}라 미국장과 따로 확인할 구간입니다.`;
  if (kospi.d5 == null || Math.abs(kospi.d5) < RULES.briefing.krSeparate5dPct) return '';
  return kospi.d5 < 0 ? ' — 5거래일 낙폭이 커 미국장과 따로 확인할 구간입니다.' : ' — 5거래일 상승 폭이 커 미국장과 따로 확인할 구간입니다.';
}
