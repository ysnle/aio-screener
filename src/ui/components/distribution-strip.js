// v58.75 (persona review): the S&P 500 distribution-day strip on 시장 상태 — the 25-session count over its last 25
// sessions. A lazy chunk loaded by market-regime.js after the first paint (boot budget).
import { buildCloseSeries } from '../../domain/briefing/market-read.js';
import { RULES } from '../../domain/rules/thresholds.js';
import { el } from './dom.js';
import { shortDate } from '../../domain/content/date-labels.js';

// v58.75 (persona review): the 25-session distribution-day count over its last 25 sessions, always on the face of 시장 상태
// (it was only an evidence row) — bars at or above the leadership confirmation line (RULES.leadership) take the burden tone.
export function distributionStrip(doc, history, through) {
  const series = buildCloseSeries(history || [], 'distributionDays', { through: through || null }).slice(-25);
  if (series.length < 5) return null;
  const at = RULES.leadership.distributionDaysAt;
  const top = Math.max(at + 2, ...series.map((point) => point.value));
  const last = series.at(-1);
  // The peak uses the leadership confirmation window, the same "최근 5거래일 중 최대" the trend axis prints.
  const recent = series.slice(-(RULES.leadership.confirmWindowSessions || 5));
  const peak = recent.reduce((best, point) => (point.value >= best.value ? point : best), recent[0]);
  const part = el(doc, 'div', null, 'leaders-line__part leaders-line__dist');
  // v58.80 run-5 (owner: "사용자가 잘 활용할 수 있을까?"): the face led with an expert term and 25 bars a newcomer could not
  // read. It now answers one question in plain words — are heavy-selling days piling up, and how close is that to the
  // line the leadership verdict counts — with one gauge; the 25-session bars stay one fold down for whoever wants them.
  const five = series.length > 5 ? series[series.length - 6] : null;
  const turn = five == null ? '' : last.value > five.value ? `, 5거래일 전 ${five.value}일에서 늘어남` : last.value < five.value ? `, 5거래일 전 ${five.value}일에서 줄어듦` : ', 5거래일 전과 같음';
  const plain = last.value >= at
    ? `경고 기준(${at}일) 이상입니다 — 지수가 버티는 동안에도 큰 매도가 이어졌다는 흔적이라, 주도 영역 이탈을 확인하는 신호 하나로 셉니다.`
    : last.value >= at - 1
      ? `경고 기준(${at}일)에 하루 모자랍니다${peak.value >= at ? `(${shortDate(peak.date)}에는 ${peak.value}일로 기준에 닿았음)` : ''}.`
      : `경고 기준(${at}일)보다 적어, 큰 매도가 몰리는 흔적은 아직 뚜렷하지 않습니다.`;
  const head = el(doc, 'div', null, 'leaders-line__head');
  head.append(el(doc, 'span', '큰 매도가 몰린 날 (분배일)', 'leaders-line__label'),
    el(doc, 'span', `최근 25거래일 중 ${last.value}일${turn}`, `leaders-line__state${last.value >= at ? ' is-burden' : ''}`),
    el(doc, 'span', plain, 'leaders-line__read'));
  // One gauge: the count against the warning line (the scale ends a little past the line or the highest recent count).
  const NSG = 'http://www.w3.org/2000/svg';
  const scale = Math.max(at + 2, ...series.map((point) => point.value));
  const gauge = doc.createElementNS(NSG, 'svg');
  gauge.setAttribute('class', 'leaders-line__dist-gauge');
  gauge.setAttribute('viewBox', `0 0 ${scale * 20} 12`);
  gauge.setAttribute('preserveAspectRatio', 'none');
  gauge.setAttribute('width', '100%');
  gauge.setAttribute('height', '12');
  gauge.setAttribute('role', 'img');
  gauge.setAttribute('aria-label', `분배일 ${last.value}일, 경고 기준 ${at}일`);
  const rect = (x, w, cls) => { const node = doc.createElementNS(NSG, 'rect'); for (const [key, value] of [['x', x], ['y', 2], ['width', w], ['height', 8], ['rx', 4], ['fill', 'currentColor'], ['class', cls]]) node.setAttribute(key, String(value)); return node; };
  const mark = doc.createElementNS(NSG, 'line');
  for (const [key, value] of [['x1', at * 20], ['x2', at * 20], ['y1', 0], ['y2', 12], ['stroke', 'currentColor'], ['stroke-width', '2'], ['vector-effect', 'non-scaling-stroke'], ['class', 'sh-muted-note']]) mark.setAttribute(key, String(value));
  gauge.append(rect(0, scale * 20, 'leaders-line__dist-track'), rect(0, Math.max(4, last.value * 20), last.value >= at ? 'sh-red-note' : 'sh-muted-note'), mark);
  const scaleRow = el(doc, 'div', null, 'leaders-line__dist-scale');
  scaleRow.append(el(doc, 'span', '0일'), el(doc, 'span', `경고 ${at}일`), el(doc, 'span', `${scale}일`));
  scaleRow.lastChild.previousSibling.style.left = `${(at / scale * 100).toFixed(1)}%`;
  // SVG presentation attributes (no inline style; src/ holds zero): fill follows the text colour of an existing class —
  // 'sh-red-note' (data red, a judgement colour — not the falling-price blue) at or above the line, 'sh-muted-note' below it.
  const NS = 'http://www.w3.org/2000/svg';
  // v58.80 run-5 (breaker #4, skeptic #13): at 28px counts 4–7 differed by 3–4px and read as one height; the bars start
  // at zero (a count), so the strip is taller instead of cutting the axis.
  const H = 48, W = series.length * 6;
  const bars = doc.createElementNS(NS, 'svg');
  bars.setAttribute('class', 'leaders-line__dist-bars');
  bars.setAttribute('viewBox', `0 0 ${W} ${H}`);
  bars.setAttribute('preserveAspectRatio', 'none');
  bars.setAttribute('width', '100%');
  bars.setAttribute('height', String(H));
  bars.setAttribute('role', 'img');
  bars.setAttribute('aria-label', `분배일 수 ${shortDate(series[0].date)}부터 ${shortDate(last.date)}까지: ${series.map((point) => point.value).join(', ')}일, 기준 ${at}일`);
  series.forEach((point, i) => {
    const h = Math.max(2, Math.round(point.value / top * H));
    const rect = doc.createElementNS(NS, 'rect');
    rect.setAttribute('x', String(i * 6 + 0.5));
    rect.setAttribute('y', String(H - h));
    rect.setAttribute('width', '5');
    rect.setAttribute('height', String(h));
    rect.setAttribute('fill', 'currentColor');
    rect.setAttribute('class', point.value >= at ? 'sh-red-note' : 'sh-muted-note');
    const tip = doc.createElementNS(NS, 'title');
    tip.textContent = `${shortDate(point.date)} ${point.value}일`;
    rect.append(tip);
    bars.append(rect);
  });
  const line = doc.createElementNS(NS, 'line');
  const y = String(H - Math.round(at / top * H));
  for (const [key, value] of [['x1', '0'], ['x2', String(W)], ['y1', y], ['y2', y], ['stroke', 'currentColor'], ['stroke-dasharray', '2 2'], ['stroke-width', '1'], ['vector-effect', 'non-scaling-stroke'], ['class', 'sh-muted-note']]) line.setAttribute(key, value);
  bars.append(line);
  const fold = el(doc, 'details', null, 'leaders-line__dist-fold');
  fold.append(el(doc, 'summary', '지난 25거래일 추이와 계산 방법'), bars,
    el(doc, 'div', `분배일은 S&P 500이 전날보다 거래량이 늘면서 0.2% 이상 내린 날입니다. 막대 하나가 하루이고, 높이는 그날까지 25거래일 동안의 분배일 수입니다. 붉은 막대는 ${at}일 이상인 날, 점선이 ${at}일 기준입니다.`, 'leaders-line__evidence'));
  part.append(head, gauge, scaleRow, fold);
  part.title = '분배일 수는 근거로만 쓰며 추세 판정 규칙은 바꾸지 않습니다. 주도 영역 이탈의 확인 신호 하나로 셉니다.';
  return part;
}
