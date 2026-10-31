// v58.80 (owner 2026-10-25): "평소 관계와 어긋난 곳". Oil, rates, stocks, long bonds, gold and the dollar are tied together;
// the 거시 asset card read their 60-session stock–bond correlation and a fixed paragraph, so a month where yields fell while
// stocks fell, oil rose and gold fell (10/23: 10Y −19bp, S&P 500 −1.5%, SMH −13.1%, TLT +2.5%, WTI +9.2%, gold −6.7%) was
// never told as one story. Each usual relation is tested on the same 20 sessions; only pairs whose two legs both pass their
// line and move against the usual direction are named, with the leg that led the move. Tendencies, not laws or forecasts.
import { buildCloseSeries, sessionPointBack } from '../market/close-series.js';
import { RULES } from '../rules/thresholds.js';
import { signedText } from '../shared/number.js';

const C = RULES.crossAsset;
// Story order: where the money went (havens), then what rates did for stocks, then what drove rates.
const ORDER = ['stocks-bonds-down', 'risk-off-gold-down', 'risk-off-dollar-down', 'rates-down-stocks-down', 'rates-up-stocks-up', 'oil-up-rates-down', 'oil-down-rates-up'];
const pct = (value) => signedText(value, 1, '%');
// A size beside a verb (올랐다·내렸다) carries no sign.
const size = (value) => `${Math.abs(value).toFixed(1)}%`;
const bpSize = (value) => `${Math.abs(Math.round(value * 100))}bp`;

export function crossAssetMoves(history = [], { through = null, window = C.window } = {}) {
  const change = (field, points = false) => {
    const series = buildCloseSeries(history, field, { through });
    const last = series.at(-1);
    const back = last ? sessionPointBack(series, window) : null;
    if (!back?.value) return null;
    return { value: points ? last.value - back.value : (last.value / back.value - 1) * 100, from: back.date, to: last.date };
  };
  return { window, spx: change('spx'), smh: change('smh'), tnx: change('tnx', true), tlt: change('tlt'), wti: change('wti'), gold: change('gold'), dxy: change('dxy'), vix: change('vix') };
}

// The assets the all-clear sentence names, in its order.
const CLEAR_NAMES = [['wti', '유가'], ['tnx', '금리'], ['spx', '주식'], ['tlt', '장기채'], ['gold', '금'], ['dxy', '달러']];

export function buildCrossAssetRelations(history = [], options = {}) {
  const raw = crossAssetMoves(history, options);
  // v59.45 (P18-RELATIONS-01): a relation compares the same 20 sessions — a move whose window ends on another session than
  // the S&P 500's (an asset whose record stopped earlier) is left out, not compared with it.
  const anchor = raw.spx?.to || null;
  const m = Object.fromEntries(Object.entries(raw).map(([key, move]) => [key, key === 'window' || move == null || move.to === anchor ? move : null]));
  const v = (key) => m[key]?.value ?? null;
  const spx = v('spx'), smh = v('smh'), tnx = v('tnx'), tlt = v('tlt'), wti = v('wti'), gold = v('gold'), dxy = v('dxy'), vix = v('vix');
  const known = (...values) => values.every((value) => value != null);
  const breaks = [];
  const add = (id, text) => breaks.push({ id, text });
  // Oil feeds inflation expectations, so oil and yields usually move together.
  if (known(wti, tnx) && wti >= C.oil20dPct && tnx * 100 <= -C.rate20dBp) add('oil-up-rates-down', `유가가 ${size(wti)} 올랐는데 10년물 금리는 ${bpSize(tnx)} 내렸습니다 — 물가보다 성장 걱정이 금리를 이끕니다.`);
  else if (known(wti, tnx) && wti <= -C.oil20dPct && tnx * 100 >= C.rate20dBp) add('oil-down-rates-up', `유가가 ${size(wti)} 내렸는데 10년물 금리는 ${bpSize(tnx)} 올랐습니다 — 국채 공급·기간 프리미엄 같은 물가 밖 요인 쪽입니다.`);
  // Lower yields usually support stock valuations; higher yields weigh on them.
  if (known(tnx, spx) && tnx * 100 <= -C.rate20dBp && spx <= -C.stock20dPct) add('rates-down-stocks-down', `금리가 내렸는데도 주식은 받쳐지지 않았습니다 — 할인율 효과보다 이익 걱정이 큽니다.`);
  else if (known(tnx, spx) && tnx * 100 >= C.rate20dBp && spx >= C.stock20dPct) add('rates-up-stocks-up', `금리가 ${bpSize(tnx)} 올랐는데도 S&P 500은 ${size(spx)} 올랐습니다 — 금리 부담보다 성장 기대가 큽니다.`);
  // Long bonds usually cushion a stock fall; falling together means the cushion failed.
  const stocksDown = known(spx) && spx <= -C.stock20dPct;
  const riskOff = stocksDown || (known(vix) && vix >= C.vixRise20dPct);
  if (stocksDown && known(tlt) && tlt <= -C.bond20dPct) add('stocks-bonds-down', `주식과 장기채가 함께 내렸습니다(장기채 ${pct(tlt)}) — 채권이 완충이 되지 못한, 물가·금리 충격 쪽 모양입니다.`);
  // Risk-off usually lifts the havens; a falling haven narrows where the money went.
  const bondHaven = stocksDown && known(tlt) && tlt >= C.bond20dPct;
  if (riskOff && known(gold) && gold <= -C.gold20dPct) add('risk-off-gold-down', `그런데 금은 ${size(gold)} 내렸습니다 — ${bondHaven ? '돈은 안전자산 전반이 아니라 미국 국채로 갔습니다' : '안전자산 수요가 넓게 번지지 않았습니다'}.`);
  if (riskOff && known(dxy) && dxy <= -C.dollar20dPct) add('risk-off-dollar-down', `위험 회피인데 달러는 ${size(dxy)} 약해졌습니다 — 미국 안의 걱정이 더 큰 쪽일 수 있습니다.`);

  const driver = known(smh, spx) && spx < 0 && smh - spx <= -C.semisLeadPp ? `하락은 반도체가 이끌었습니다(반도체 ETF ${pct(smh)}, S&P 500 ${pct(spx)})`
    : known(smh, spx) && spx > 0 && smh - spx >= C.semisLeadPp ? `상승은 반도체가 이끌었습니다(반도체 ETF ${pct(smh)}, S&P 500 ${pct(spx)})` : null;
  const flow = bondHaven ? `장기채가 ${size(tlt)} 올라 주식 하락을 받쳤습니다` : null;
  const lead = [driver, flow].filter(Boolean).join('. ');
  const asOf = m.spx?.to || m.tnx?.to || null;
  const available = known(spx, tnx);
  const reading = !available ? null
    : breaks.length ? `최근 ${m.window}거래일 ${lead ? `${lead}. ` : ''}${[...breaks].sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id)).slice(0, 3).map((item) => item.text).join(' ')}`
      : `최근 ${m.window}거래일 ${lead ? `${lead}. ` : ''}${clearSentence(m)}`;
  return { available, asOf, window: m.window, moves: m, driver, flow, breaks, reading };
}

// Only the assets actually checked are said to be within their usual relations; the unchecked are named as such.
function clearSentence(m) {
  const checked = CLEAR_NAMES.filter(([key]) => m[key]?.value != null).map(([, name]) => name);
  const missing = CLEAR_NAMES.filter(([key]) => m[key]?.value == null).map(([, name]) => name);
  return `${checked.join('·')}${missing.length ? '' : '는'}${missing.length ? ` 사이에서는 평소 관계에서 크게 벗어난 곳이 없습니다(${missing.join('·')}는 같은 기간 기록이 없어 확인하지 못함).` : ' 평소 관계에서 크게 벗어나지 않았습니다.'}`;
}
