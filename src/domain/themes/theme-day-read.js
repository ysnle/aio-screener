// ADR-0003 S4: the three one-day readings on a theme's detail panel — the day's move band, the spread between its
// strongest and weakest member, and the share of members up — judged here; the panel renders the text and the tone.
// Each names only the one-day window it measured; momentum, flow, cause and structure claims need their own
// evidence. The lines are this panel's own one-day bands (not published standards). They stay in this route-only module
// rather than the boot-time RULES table because only the theme detail route reads them.
import { finiteNumber as finite } from '../shared/number.js';

export const THEME_DAY_LINES = Object.freeze({
  strongUpPct: 3, upPct: 1, flatPct: 1, downPct: 2, // move bands: +3 · +1 · symmetric flat (-1, +1) · -1 · -2
  spreadWidePp: 5, spreadMixedPp: 2,
  breadthBroadPct: 70, breadthMixedPct: 50
});
const L = THEME_DAY_LINES;

/** The day's move band: { tone: 'muted'|'neutral'|'caution', text }, with a symmetric flat band. */
export function themeDayMoveRead(pctInput) {
  const pct = finite(pctInput);
  if (pct == null) return { tone: 'muted', text: '시세 대기 — 구성종목 가격이 확인되면 당일 등락을 표시합니다.' };
  const text = pct >= L.strongUpPct ? `당일 +${L.strongUpPct}% 이상 — 관측된 당일 등락 구간입니다. 과열·추세 지속은 별도 기간 근거가 필요합니다.`
    : pct >= L.upPct ? `당일 +${L.upPct}% 이상 — 관측된 당일 등락 구간입니다. 시계열 모멘텀·자금 유입은 별도 근거가 필요합니다.`
      : pct > -L.flatPct ? '당일 보합 — 관측된 당일 등락 구간입니다. 방향은 추가 가격·거래량으로 확인합니다.'
        : pct > -L.downPct ? `당일 -${L.flatPct}% 이하 — 관측된 당일 등락 구간입니다. 원인(수급·로테이션)은 별도 근거가 필요합니다.`
          : `당일 -${L.downPct}% 이하 — 관측된 당일 등락 구간입니다. 시계열 하락·구조 훼손은 별도 기간 근거가 필요합니다.`;
  return { tone: pct > -L.flatPct ? 'neutral' : 'caution', text };
}

/** The member spread (strongest minus weakest one-day change, in %p) and its level sentence. */
export function themeSpreadRead(spread) {
  const level = spread > L.spreadWidePp ? '매우 큼 — 구성 종목 간 당일 등락 차가 큽니다.' : spread > L.spreadMixedPp ? '보통 — 테마 전체 움직임과 종목별 차이가 함께 있습니다.' : '좁음 — 구성 종목의 당일 등락이 비슷합니다.';
  return { spread, text: `등락 편차 ${spread.toFixed(1)}%p (${level})` };
}

/** The share of members up today: { tone: 'muted'|'favorable'|'neutral'|'caution', text }; `basis` names the denominator. */
export function themeBreadthRead(breadthInput, basis = '') {
  const breadth = finite(breadthInput);
  if (breadth == null) return { tone: 'muted', text: '시세 대기 — 충분한 구성종목 가격이 확인되면 당일 가격 참여 폭을 계산합니다.' };
  if (breadth >= L.breadthBroadPct) return { tone: 'favorable', text: `상승 종목 ${breadth}%${basis}, 당일 가격 참여 폭 우수 — 관측된 당일 가격 참여이며 자금 유입·거래 주체의 증거가 아닙니다.` };
  if (breadth >= L.breadthMixedPct) return { tone: 'neutral', text: `상승 종목 ${breadth}%${basis}, 당일 가격 참여 폭 보통 — 일부 종목 중심인지 선별이 필요합니다.` };
  return { tone: 'caution', text: `상승 종목 ${breadth}%${basis}, 당일 가격 참여 폭 취약 — 관측된 당일 가격 참여이며 추세 단정이 아닙니다.` };
}
