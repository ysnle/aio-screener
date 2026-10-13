// P1661 (owner 2026-10-12, option 나): "what happened after days like today" replaces the retired composite score.
// One visual (forward one-month result per VIX band, today's band marked), a short reading, and a fold that
// teaches how to read the table and why the old score was dropped. Hidden until the producer has published.
import { refreshSharedArtifact, STRESS_OUTCOMES } from '../../data/shared-artifacts.js';
import { stressBandOf } from '../../domain/signal/stress-outcomes.js';
import { buildCloseSeries, closeBasis } from '../../domain/briefing/market-read.js';
import { RULES } from '../../domain/rules/thresholds.js';

function el(doc, tag, text, className) {
  const node = doc.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}
const pct = (value, digits = 1) => (Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%` : '—');

export function renderStressOutcomes({ documentRef: doc, root, anchor }) {
  if (!doc || !anchor) return;
  let section = doc.getElementById('regime-stress-outcomes');
  if (!section) {
    section = el(doc, 'section', null, 'briefing-block regime-stress-outcomes');
    section.id = 'regime-stress-outcomes';
    section.hidden = true;
    anchor.insertAdjacentElement('afterend', section);
  }
  const paint = (payload) => {
    if (payload?.status !== 'current' || !Array.isArray(payload.bands) || !payload.bands.length) { section.hidden = true; return; }
    const history = root?._aioHistory || [];
    const vix = buildCloseSeries(history, 'vix', { through: closeBasis(history) }).at(-1) || null;
    const current = vix ? stressBandOf(vix.value) : null;
    const month = (band) => band.horizons?.['21'] || band.horizons?.[21] || {};
    const quarter = (band) => band.horizons?.['63'] || band.horizons?.[63] || {};
    const rows = payload.bands.filter((band) => month(band).n > 0);
    const scale = Math.max(...rows.map((band) => Math.abs(month(band).mean || 0)), 0.5);
    const from = String(payload.from || '').slice(0, 4);
    const all = payload.all?.['21'] || payload.all?.[21] || {};

    const chart = el(doc, 'div', null, 'stress-bars');
    chart.setAttribute('role', 'list');
    for (const band of rows) {
      const stats = month(band);
      const row = el(doc, 'div', null, `stress-bar-row${band.id === current?.id ? ' is-current' : ''}`);
      row.setAttribute('role', 'listitem');
      const bar = el(doc, 'span', null, `stress-bar ${stats.mean >= 0 ? 'is-up' : 'is-down'}`);
      bar.style.width = `${Math.max(2, Math.round((Math.abs(stats.mean || 0) / scale) * 100))}%`;
      const track = el(doc, 'span', null, 'stress-bar-track');
      track.append(bar);
      // T14 (expert review 2026-10-13): the number of separate band episodes is on screen, not only in the hover.
      row.append(el(doc, 'span', `${band.label}${band.id === current?.id ? ' · 지금' : ''}`, 'stress-bar-label'), track,
        el(doc, 'span', `${pct(stats.mean)} · 오른 비율 ${stats.hitRate ?? '—'}% · ${band.episodes}개 구간`, 'stress-bar-value'));
      row.title = `${band.label}: ${stats.n.toLocaleString('en-US')}거래일 · 구간 진입 ${band.episodes}회(겹치는 표본) · 나쁜 10% ${pct(stats.p10)}`;
      chart.append(row);
    }

    const cur = current ? payload.bands.find((band) => band.id === current.id) : null;
    const curStats = cur ? month(cur) : null;
    const reading = cur && curStats?.n
      ? `${Number(vix.date.slice(5, 7))}/${Number(vix.date.slice(8, 10))} 종가 VIX ${vix.value.toFixed(1)}은 ${cur.label} 구간입니다. ${from}년 이후 이 구간에 있던 날(서로 떨어진 ${cur.episodes}개 구간) 뒤 한 달 동안 S&P 500은 평균 ${pct(curStats.mean)} 움직였고 ${curStats.hitRate}%는 올랐습니다. 나쁜 쪽 10%는 ${pct(curStats.p10)} 이하였습니다. 전체 평균은 ${pct(all.mean)}입니다. 과거의 분포일 뿐 이번 달의 예측은 아닙니다.`
      : `${from}년 이후 VIX 구간별로 그 뒤 한 달 동안 S&P 500이 실제로 어떻게 움직였는지입니다. 오늘의 VIX 종가가 없어 현재 구간은 표시하지 않습니다.`;

    const deep = el(doc, 'details', null, 'regime-axis-details regime-axis-deep');
    deep.append(el(doc, 'summary', '더 깊이 보기 · 이 표를 읽는 법과 원리'));
    deep.append(el(doc, 'h4', '불안한 구간 뒤의 결과를 읽는 원리'), el(doc, 'p', '변동성이 높을 때 투자자들은 위험을 떠안는 대가로 더 큰 기대수익을 요구합니다(위험 프리미엄). 그래서 공포가 가격을 먼저 끌어내린 구간 뒤에 반등이 컸던 시기가 있었는지 표의 평균으로 확인합니다. 어느 쪽이었는지는 표가 말하며, 같은 구간의 나쁜 10% 손실 폭도 함께 봐야 결과의 폭을 읽을 수 있습니다.'));
    deep.append(el(doc, 'h4', '숫자를 믿을 수 있는 정도'), el(doc, 'p', '연속된 날은 뒤 한 달이 서로 겹치므로 거래일 수만큼 독립적인 사례가 있는 것이 아닙니다. 막대 옆의 구간 수는 그 VIX 구간에 따로 들어간 횟수이며, 그 수도 완전히 독립된 사례라는 뜻은 아닙니다. VIX 30 이상은 독립 구간이 적어 평균이 몇 번의 위기에 크게 좌우됩니다. 수익률은 배당을 뺀 가격 기준입니다.'));
    const table = el(doc, 'dl', null, 'regime-evidence');
    for (const band of rows) table.append(el(doc, 'dt', `${band.label} · 석 달 뒤`), el(doc, 'dd', `평균 ${pct(quarter(band).mean)} · 오른 비율 ${quarter(band).hitRate ?? '—'}% · 나쁜 10% ${pct(quarter(band).p10)}`));
    deep.append(el(doc, 'h4', '석 달 뒤 결과'), table);
    deep.append(el(doc, 'h4', '예전 0~100 점수 대신 이 표를 쓰는 이유'), el(doc, 'p', '예전 시장 점수는 2016~2026년 검증에서 점수가 높을수록 오히려 이후 수익률이 낮았고(한 달 기준 순위상관 -0.17), 급락장에서는 관계가 반대로 기우는 경향도 보였습니다. 점수를 거꾸로 쓰면 바로 그런 위기 때 틀릴 수 있어, 점수를 만들지 않고 실제로 있었던 결과의 분포를 그대로 보여줍니다.'));

    // T14: the title names the one thing that was matched (VIX), and the bands are said to differ from the judgement bands.
    section.replaceChildren(el(doc, 'h2', 'VIX가 비슷했던 날, 그 뒤 실제로는', 'briefing-h2'),
      el(doc, 'p', `변동성(VIX) 구간별 S&P 500 한 달 뒤 평균 · ${from}~${String(payload.to || '').slice(0, 4)}`, 'regime-chart-caption'), chart, el(doc, 'p', reading, 'regime-read'),
      el(doc, 'p', `이 표의 VIX 구간(${payload.bands.map((band) => band.label.replace(/^VIX /, '')).join(' · ')})은 과거 결과를 나누는 구간이라, 시장 상태 변동성 축의 판정 기준(${RULES.volatility.calmBelow} · ${RULES.volatility.stressAt} · ${RULES.volatility.highAt})과 다릅니다.`, 'regime-chart-caption'), deep);
    section.title = `출처: ${payload.source || 'Yahoo Finance'}`;
    section.hidden = false;
  };
  paint(root?.[STRESS_OUTCOMES.key]);
  refreshSharedArtifact(root, STRESS_OUTCOMES).then(({ payload, changed }) => { if (changed) paint(payload); }).catch(() => {});
}
