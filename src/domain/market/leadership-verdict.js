// v58.68 (owner 2026-10-23): the market verdict is the US market as a whole (six conventional axes), and the AI and
// semiconductor leaders only reached it through one condition on the trend axis. On 10/22 SOXX fell 6.8% and the median
// semiconductor 7% while the Dow and the Russell 2000 closed flat and 57% of US names rose — the whole-market label
// '다소 부담' was right and still hid the day. The leadership area gets its own verdict line beside it: the same
// leadership-break test (market-read leadershipBreakOf), the size of the latest session in the leaders, and how many US
// names closed at a recent low. It describes the leaders; it does not change the six-axis count.
import { buildCloseSeries } from './close-series.js';
import { countOpenSessionsBetween } from './market-calendar.js';
import { shortDate } from '../content/date-labels.js';
import { RULES } from '../rules/thresholds.js';

const signed = (value, digits = 1) => value == null || !Number.isFinite(value) ? null : `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(digits)}%`;
const pct = (now, then) => Number.isFinite(now) && Number.isFinite(then) && then !== 0 ? (now / then - 1) * 100 : null;

/** The latest completed session's change, only when the previous point is the previous session (a gap is unknown). */
export function sessionMove(history, field, through = null) {
  const series = buildCloseSeries(history, field, { through });
  if (series.length < 2) return null;
  const last = series[series.length - 1], prior = series[series.length - 2];
  if (countOpenSessionsBetween(prior.date, last.date, 'US') !== 1) return { date: last.date, change: null, gapFrom: prior.date };
  return { date: last.date, change: pct(last.value, prior.value), gapFrom: null };
}

/** Count of a breadth signal on the basis session with its eligible denominator (history fieldMeta). */
function breadthCount(history, field, basis) {
  const row = (Array.isArray(history) ? history : []).find((item) => item?.date === basis);
  const value = Number(row?.[field]);
  const eligible = Number(row?.fieldMeta?.[field]?.eligible);
  if (!Number.isFinite(value) || !Number.isFinite(eligible) || eligible <= 0) return null;
  return { value, eligible, share: value / eligible * 100 };
}

export const LEADERSHIP_STATE_LABELS = Object.freeze({ break: '이탈', weak: '약세', holding: '유지', unknown: '확인 중' });

/**
 * @param {{ history?: object[], leadership?: object, smh?: object|null, basis?: string|null }} input
 *   leadership — market-read leadershipBreakOf result; smh — the SMH series stats (value, d5, ma50, yearMax).
 */
export function buildLeadershipVerdict({ history = [], leadership = null, smh = null, basis = null } = {}) {
  if (!leadership?.available) return { available: false, state: 'unknown', label: LEADERSHIP_STATE_LABELS.unknown, line: null, evidence: [] };
  const rule = RULES.leadership;
  const semis = sessionMove(history, 'smh', basis);
  const ndx = sessionMove(history, 'ndx', basis);
  const shock = (semis?.change != null && semis.change <= -rule.shockSemis1dPct) || (ndx?.change != null && ndx.change <= -rule.shockNdx1dPct);
  const state = leadership.state || 'unknown';
  const label = `${LEADERSHIP_STATE_LABELS[state] || LEADERSHIP_STATE_LABELS.unknown}${shock ? ' · 급락일' : ''}`;
  // A missing previous session (the 10/21 refresh outage; Yahoo's index bars also lack 10/21) leaves the day out — one note
  // at the end says so instead of repeating it on every item.
  const withName = (name, move, rest) => {
    const dayText = move?.change != null ? `${shortDate(move.date)} ${signed(move.change)}` : '';
    const body = [dayText, rest].filter(Boolean).join(' · ');
    return body ? `${name} ${body}` : null;
  };
  const gap = [semis, ndx].find((move) => move?.gapFrom);
  const semisPosition = smh ? [
    smh.d5 ? `5거래일 ${signed(pct(smh.value, smh.d5))}` : null,
    smh.ma50 ? `50일선 ${signed(pct(smh.value, smh.ma50))}` : null,
    smh.yearMax ? `1년 고점 대비 ${signed(pct(smh.value, smh.yearMax))}` : null
  ].filter(Boolean).join(' · ') : '';
  const low20 = basis ? breadthCount(history, 'breadthLow20', basis) : null;
  const low63 = basis ? breadthCount(history, 'breadthLow63', basis) : null;
  const evidence = [
    withName('반도체(SMH)', semis, semisPosition),
    withName('나스닥 100', ndx, leadership.drop5 != null ? `5거래일 ${signed(leadership.drop5)}` : ''),
    low20 ? `미국 종목 20거래일 종가 신저가 ${low20.value}개(${Math.round(low20.share)}%)${low63 ? ` · 3개월 ${low63.value}개` : ''}` : null,
    gap ? `직전 세션 기록이 없어 ${shortDate(gap.date)} 하루 변화는 일부 생략` : null
  ].filter(Boolean);
  const read = state === 'break'
    ? (shock ? '주도주가 하루에 크게 밀렸고 시장 전반의 확인 신호도 붙어, 주도 영역의 이탈로 봅니다. 전체 판정은 지수·시장 폭·변동성 등 여섯 지표로 따로 냅니다.'
      : '주도주의 약세에 시장 전반의 확인 신호가 붙어 주도 영역의 이탈로 봅니다.')
    : state === 'weak' ? (shock ? '주도주가 하루에 크게 밀렸지만 시장 전반으로 번진 확인 신호는 아직 부족합니다.' : '주도주가 약해졌지만 시장 전반으로 번진 확인 신호는 아직 부족합니다.')
      : state === 'holding' ? (shock ? '하루 낙폭은 컸지만 주도주의 추세는 아직 무너지지 않았습니다.' : '주도주가 지수를 받치는 흐름이 유지되고 있습니다.')
        : '주도 영역의 상태를 판정할 기록이 부족합니다.';
  return { available: true, state, shock, label, read, evidence, line: evidence.join(' · '), date: semis?.date || ndx?.date || leadership.date || null,
    semis1d: semis?.change ?? null, ndx1d: ndx?.change ?? null, low20: low20?.value ?? null, low20Eligible: low20?.eligible ?? null };
}

