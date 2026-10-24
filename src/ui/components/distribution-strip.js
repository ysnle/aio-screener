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
  const head = el(doc, 'div', null, 'leaders-line__head');
  head.append(el(doc, 'span', 'S&P 500 분배일 (25거래일 누적)', 'leaders-line__label'),
    el(doc, 'span', `현재 ${last.value}회`, `leaders-line__state${last.value >= at ? ' is-burden' : ''}`),
    el(doc, 'span', `${peak.value > last.value ? `최근 ${recent.length}거래일 중 최대 ${peak.value}회(${shortDate(peak.date)}), ` : ''}확인 신호 기준 ${at}회`, 'leaders-line__read'));
  // SVG presentation attributes (no inline style; src/ holds zero): fill follows the text colour of an existing class —
  // 'pnl neg' (data red) at or above the line, 'sh-muted-note' below it.
  const NS = 'http://www.w3.org/2000/svg';
  const H = 28, W = series.length * 6;
  const bars = doc.createElementNS(NS, 'svg');
  bars.setAttribute('class', 'leaders-line__dist-bars');
  bars.setAttribute('viewBox', `0 0 ${W} ${H}`);
  bars.setAttribute('preserveAspectRatio', 'none');
  bars.setAttribute('width', '100%');
  bars.setAttribute('height', String(H));
  bars.setAttribute('role', 'img');
  bars.setAttribute('aria-label', `분배일 수 ${shortDate(series[0].date)}부터 ${shortDate(last.date)}까지: ${series.map((point) => point.value).join(', ')}회, 기준 ${at}회`);
  series.forEach((point, i) => {
    const h = Math.max(2, Math.round(point.value / top * H));
    const rect = doc.createElementNS(NS, 'rect');
    rect.setAttribute('x', String(i * 6 + 0.5));
    rect.setAttribute('y', String(H - h));
    rect.setAttribute('width', '5');
    rect.setAttribute('height', String(h));
    rect.setAttribute('fill', 'currentColor');
    rect.setAttribute('class', point.value >= at ? 'pnl neg' : 'sh-muted-note');
    const tip = doc.createElementNS(NS, 'title');
    tip.textContent = `${shortDate(point.date)} ${point.value}회`;
    rect.append(tip);
    bars.append(rect);
  });
  const line = doc.createElementNS(NS, 'line');
  const y = String(H - Math.round(at / top * H));
  for (const [key, value] of [['x1', '0'], ['x2', String(W)], ['y1', y], ['y2', y], ['stroke', 'currentColor'], ['stroke-dasharray', '2 2'], ['stroke-width', '1'], ['vector-effect', 'non-scaling-stroke'], ['class', 'sh-muted-note']]) line.setAttribute(key, value);
  bars.append(line);
  part.append(head, bars, el(doc, 'div', `막대 하나가 하루, 높이는 그날까지 25거래일 동안의 분배일 수(0.2% 이상 하락 + 거래량 증가). 붉은 막대는 ${at}회 이상인 날, 점선이 ${at}회 기준입니다.`, 'leaders-line__evidence'));
  part.title = '분배일 수는 근거로만 쓰며 추세 판정 규칙은 바꾸지 않습니다. 주도 영역 이탈의 확인 신호 하나로 셉니다.';
  return part;
}
