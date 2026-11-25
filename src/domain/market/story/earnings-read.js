// The opening's earnings line: the S&P 500's price beside the direction of its earnings estimates. The session lines say
// what the price did and the diagnosis says what kind of fall it is; neither says whether the earnings the price rests on
// moved. The index-earnings stage (indices/index-earnings.js) already counts every member's four-week estimate
// revisions and the forward multiple, so this reads that model and sets it against the fall from the high. Revision
// counts follow price with a lag, which is why the line names the turn that would change the reading.
import { claim, say, sayJoin, NOTHING } from '../../shared/claim.js';
import { revisionTiltOf } from '../indices/index-earnings.js';
import { GICS_KO } from '../../content/sector-words.js';
import { EARNINGS_READ_WORDS, EARNINGS_TILT_WORDS } from '../../content/earnings-read-words.js';

// The sector the leaders of this market sit in; its own counts follow the index's when it has enough members.
export const EARNINGS_LEAD_SECTOR = 'Information Technology';

const revisions = (subject, asOf, up, down) => say('상향 {u}건·하향 {d}건', {
  u: claim({ subject, measure: 'revisionsUp4w', asOf, figures: [{ value: up, unit: 'level', digits: 0, basis: 'up4w', label: '4주 상향' }] }),
  d: claim({ subject, measure: 'revisionsDown4w', asOf, figures: [{ value: down, unit: 'level', digits: 0, basis: 'down4w', label: '4주 하향' }] }) });

/**
 * { tilt, side, word, said } or null when the index's revision breadth is withheld (too little of the index covered).
 * @param {object} input
 * @param {object} input.earnings  buildIndexEarnings() result
 * @param {object} input.spx       the opening's S&P 500 row (its fall from the high as a claim)
 * @param {object} [input.diagnosis] diagnoseFall() result — a diagnosed fall is the 'fall' side
 * @param {(row: object) => object} input.fallSaid the opening's own "고점(M/D) 대비 x%" phrase
 */
export function earningsReadOf({ earnings = null, spx = null, diagnosis = null, fallSaid = null } = {}) {
  const tilt = earnings?.available ? revisionTiltOf(earnings.breadth) : null;
  if (!tilt || !spx?.claims?.fall || typeof fallSaid !== 'function') return null;
  const asOf = earnings.asOf;
  const side = diagnosis && diagnosis.state !== 'none' ? 'fall' : 'hold';
  const lead = (earnings.sectors || []).find((row) => row.sector === EARNINGS_LEAD_SECTOR);
  const sector = lead ? say('({lab} {r})', { lab: GICS_KO[lead.sector] || lead.sector, r: revisions(`sector:${lead.sector}`, asOf, lead.up, lead.down) }) : NOTHING;
  const pe = earnings.forwardPe != null
    ? say(', 선행 PER {pe}', { pe: claim({ subject: 'spx', measure: 'forwardPe', asOf, figures: [{ value: earnings.forwardPe, unit: 'x', basis: 'forwardPe', label: '선행 PER' }] }) })
    : NOTHING;
  const figures = say('S&P 500 {fall}, 최근 4주 이익 전망 수정은 {r}{sector}{pe}.', { fall: fallSaid(spx), r: revisions('spx', asOf, earnings.up, earnings.down), sector, pe });
  const meaning = EARNINGS_READ_WORDS[`${side}:${tilt}`];
  return { tilt, side, word: EARNINGS_TILT_WORDS[tilt], said: sayJoin([figures, meaning ? say(meaning) : NOTHING], ' ') };
}
