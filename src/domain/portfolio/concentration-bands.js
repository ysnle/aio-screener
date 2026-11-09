// ADR-0003 S4: the concentration bands every portfolio surface states (점검 card, criteria list, exposure panel, sector
// card), on RULES.portfolio. One holding and one sector are read here; a screen receives the band word and the basis
// text, never the number. Kept apart from concentration.js (the boot-time penalty ladder) so the boot set does not carry
// the band sentences the 포트폴리오 route alone renders.
import { RULES } from '../rules/thresholds.js';
import { readNumber as finite } from '../shared/number.js';

const BANDS = RULES.portfolio;
const [REFERENCE_PCT, SECOND_PCT, ATTENTION_PCT] = BANDS.holdingPct;

export const HOLDING_BAND_BASIS = `${REFERENCE_PCT}~${ATTENTION_PCT}% 참고, ${ATTENTION_PCT}% 초과 주의`;
export const SECTOR_BAND_NOTE = `내부 구간 ${BANDS.sectorOver}% 초과`;
export const HOLDING_LINE_PCT = ATTENTION_PCT;
export const SECTOR_LINE_PCT = BANDS.sectorOver;

/** One holding's share (percent of the invested part): 'attention' above the line, 'info' above the first tier, else 'ok'. */
export function holdingBand(pct) {
  const value = finite(pct);
  if (value == null) return null;
  return value > ATTENTION_PCT ? 'attention' : value > REFERENCE_PCT ? 'info' : 'ok';
}

/** The tier sentence for a single-holding share (strictly above each tier, as the 점검 card has always said it). */
export function holdingTierText(pct) {
  return pct > ATTENTION_PCT ? `한 종목이 투자금의 ${ATTENTION_PCT}%를 넘습니다 — 이 종목 하나의 급락이 계좌 전체를 좌우할 수 있는 수준입니다.`
    : pct > SECOND_PCT ? `한 종목이 ${SECOND_PCT}%를 넘습니다(참고 구간).` : pct > REFERENCE_PCT ? `한 종목이 ${REFERENCE_PCT}%를 넘습니다(참고 구간).`
      : `가장 큰 종목도 투자금의 ${REFERENCE_PCT}% 이하입니다.`;
}

/** One sector's share (percent): 'over' the line, 'near' it, or 'within'. */
export function sectorBand(pct) {
  const value = finite(pct);
  if (value == null) return null;
  return value > BANDS.sectorOver ? 'over' : value > BANDS.sectorNear ? 'near' : 'within';
}
