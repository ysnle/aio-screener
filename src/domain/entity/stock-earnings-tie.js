// 종목 머리의 이익 전망 줄: the stock's price move set beside its earnings outlook — the four-week estimate revisions, the
// expected change of the next four quarters' EPS over the last four, whether the month's price moved with or against
// those revisions, and the next report date. The consensus row is read through consensusView (its age, basis-gap and
// coverage rules) and the price-against-revisions judgement is consensus-read.js priceVersusRevisions, the same one the
// 재무 흐름 consensus point prints; the date is leader-earnings.js nextEarnings. A missing part is left out. Pure.
import { claim, say, sayJoin, NOTHING } from '../shared/claim.js';
import { consensusView, priceVersusRevisions } from '../fundamental/consensus-read.js';
import { nextEarnings, whenText } from '../briefing/leader-earnings.js';

// By the existing judgement's two directions (price, revisions).
const MEANINGS = Object.freeze({
  'down|up': '주가는 내렸지만 전망은 올라가는 중이라, 내린 것은 이익이 아니라 주가에 붙는 값입니다.',
  'down|down': '주가와 이익 전망이 함께 내려가는 중입니다.',
  'up|down': '주가는 올랐는데 전망은 내려가는 중이라, 값 부담이 커지는 쪽입니다.',
  'up|up': '주가와 이익 전망이 함께 올라가는 중입니다.'
});

/**
 * The line, or null when there is no fresh consensus row or nothing left to say.
 * @param {{ symbol: string, row: object, estimate: object|null, calendar?: object|null, nowMs?: number }} input
 *   `row`: the stock's screener row; `estimate`: its consensus-estimates.json row; `calendar`: earnings-calendar.json.
 * @returns {{ text: string, claims: object[] }|null}
 */
export function stockEarningsTie({ symbol, row, estimate, calendar = null, nowMs = Date.now() } = {}) {
  const sym = String(symbol || '').toUpperCase();
  if (!sym) return null;
  const view = consensusView(row, estimate, { now: nowMs });
  if (!view) return null;
  const subject = `consensus:${sym}`;
  const count = (measure, value, basis, label) => claim({ subject, measure, asOf: view.asOf, figures: [{ value, unit: 'level', digits: 0, basis, label }] });
  // No revision either way reads as that, not as two zero counts (the 재무 흐름 point says the same).
  const revisions = !view.revisionsKnown ? NOTHING
    : !view.up4w && !view.down4w ? say('최근 4주 추정치 수정 없음')
    : say('최근 4주 상향 {u}건·하향 {d}건', { u: count('revisionsUp4w', view.up4w, 'up4w', '4주 상향'), d: count('revisionsDown4w', view.down4w, 'down4w', '4주 하향') });
  const growth = view.growth != null
    ? say('향후 4개 분기 EPS 예상은 직전 4개 분기보다 {g}', { g: claim({ subject, measure: 'growth', asOf: view.asOf, figures: [{ value: view.growth, unit: 'pct', digits: 0, basis: 'growth', label: '예상 이익' }] }) })
    : NOTHING;
  const outlook = sayJoin([revisions, growth], ', ');
  const { revDir, priceDir } = priceVersusRevisions(row, view);
  const meaning = view.revisionsKnown && MEANINGS[`${priceDir}|${revDir}`] ? say(MEANINGS[`${priceDir}|${revDir}`]) : NOTHING;
  const next = nextEarnings(calendar, sym, { nowMs });
  const date = next ? say('다음 실적 {when}.', { when: whenText(next) }) : NOTHING;
  const said = sayJoin([outlook.text ? say('이익 전망: {o}.', { o: outlook }) : NOTHING, meaning, date], ' ');
  return said.text ? said : null;
}
