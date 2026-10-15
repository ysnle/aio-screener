// P1661 (owner 2026-10-12, option 나): "what happened after days like today" replaces the retired composite score.
// One visual (forward one-month result per VIX band, today's band marked), a short reading, and a fold that
// teaches how to read the table and why the old score was dropped. Hidden until the producer has published.
import { refreshSharedArtifact, STRESS_OUTCOMES } from '../../data/shared-artifacts.js';
import { CLUSTER_GAP_SESSIONS, stressBandOf } from '../../domain/signal/stress-outcomes.js';
import { buildCloseSeries, closeBasis } from '../../domain/briefing/market-read.js';
import { RULES } from '../../domain/rules/thresholds.js';
import { el } from './dom.js';

const pct = (value, digits = 1) => (Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%` : '—');
const Z10 = 1.2816; // standard normal 10th percentile

// v57.50 D08: the uncertainty of a band's mean. Overlapping h-session windows give about n/h independent windows, so
// the standard error is sd / sqrt(n/h) and the shown range is ±2 standard errors. An artifact published before the
// producer carried sd/se is read with sd ≈ (median − p10) / 1.2816 and marked approximate.
export function meanRange(stats = {}, horizon = 21) {
  const n = Number(stats.n);
  const mean = Number(stats.mean);
  if (!Number.isFinite(n) || n < 2 || !Number.isFinite(mean)) return null;
  let se = Number.isFinite(stats.se) ? stats.se : null;
  let approx = false;
  if (se == null) {
    const sd = Number.isFinite(stats.sd) ? stats.sd : Number.isFinite(stats.median) && Number.isFinite(stats.p10) ? (stats.median - stats.p10) / Z10 : null;
    if (!Number.isFinite(sd) || sd <= 0) return null;
    se = sd / Math.sqrt(Math.max(1, n / horizon));
    approx = !Number.isFinite(stats.sd);
  }
  const half = 2 * se;
  return { mean, half, low: mean - half, high: mean + half, nEff: n / horizon, approx };
}
const overlaps = (a, b) => a && b && a.low <= b.high && b.low <= a.high;
// D07: the cluster count when the producer published it; before that, the non-overlapping-window count n/h.
export function spellText(band, stats, horizon = 21) {
  if (Number.isFinite(band?.clusters)) return `진입 군집 ${band.clusters}회(${CLUSTER_GAP_SESSIONS}세션 간격)`;
  return Number.isFinite(stats?.n) ? `겹치지 않는 ${horizon === 63 ? '석 달' : '한 달'} 약 ${Math.max(1, Math.round(stats.n / horizon))}개` : '';
}

// v57.76: the table matches days on VIX only, so it is a fold inside the 변동성 card (host) instead of a separate
// page section after the board with no bridge. A repaint of the board moves the existing fold into the new card,
// so an open fold stays open.
const STRESS_TITLE = '과거 빈도 — VIX가 비슷했던 날, 그 뒤 한 달';
export function renderStressOutcomes({ documentRef: doc, root, host }) {
  if (!doc || !host) return;
  let section = doc.getElementById('regime-stress-outcomes');
  if (!section) {
    section = el(doc, 'details', null, 'regime-axis-details regime-stress-outcomes');
    section.id = 'regime-stress-outcomes';
    section.hidden = true;
  }
  if (section.parentElement !== host) host.append(section);
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
      // T14 (expert review 2026-10-13): the sample behind each bar is on screen, not only in the hover.
      // v57.50 D07/D08: separate spells (re-entries within 21 sessions merged) and the ± range of the mean.
      const range = meanRange(stats, 21);
      row.append(el(doc, 'span', `${band.label}${band.id === current?.id ? ' · 지금' : ''}`, 'stress-bar-label'), track,
        el(doc, 'span', `${pct(stats.mean)}${range ? ` ±${range.half.toFixed(1)}%p` : ''} · 오른 비율 ${stats.hitRate ?? '—'}% · ${spellText(band, stats, 21)}`, 'stress-bar-value'));
      row.title = `${band.label}: ${stats.n.toLocaleString('en-US')}거래일 · 연속 구간 ${band.episodes}회${Number.isFinite(band.shortRuns) ? `(그중 3일 이하 ${band.shortRuns}회)` : ''} · 평균 범위는 겹치지 않는 한 달 약 ${Math.round(stats.n / 21)}개 기준 표준오차의 2배${range?.approx ? '(분위수로 근사)' : ''} · 하위 10% 결과 ${pct(stats.p10)}`;
      chart.append(row);
    }

    const cur = current ? payload.bands.find((band) => band.id === current.id) : null;
    const curStats = cur ? month(cur) : null;
    const allRange = meanRange(all, 21);
    const curRange = curStats ? meanRange(curStats, 21) : null;
    const curVsAll = curRange && allRange ? (overlaps(curRange, allRange) ? ` 이 구간 평균의 범위(±${curRange.half.toFixed(1)}%p)가 전체 평균 ${pct(all.mean)}의 범위와 겹쳐, 평균 차이는 구별되지 않습니다.` : ` 이 구간 평균의 범위(±${curRange.half.toFixed(1)}%p)는 전체 평균 ${pct(all.mean)}의 범위와 겹치지 않습니다.`) : ` 전체 평균은 ${pct(all.mean)}입니다.`;
    const reading = cur && curStats?.n
      ? `${Number(vix.date.slice(5, 7))}/${Number(vix.date.slice(8, 10))} 종가 VIX ${vix.value.toFixed(1)}은 ${cur.label} 구간입니다. ${from}년 이후 이 구간에 있던 날(${spellText(cur, curStats, 21)}) 뒤 한 달 동안 S&P 500은 평균 ${pct(curStats.mean)} 움직였고 ${curStats.hitRate}%는 올랐습니다. 나쁜 쪽 10%는 ${pct(curStats.p10)} 이하였습니다.${curVsAll} 과거의 분포일 뿐 이번 달의 예측은 아닙니다.`
      : `${from}년 이후 VIX 구간별로 그 뒤 한 달 동안 S&P 500이 실제로 어떻게 움직였는지입니다. 오늘의 VIX 종가가 없어 현재 구간은 표시하지 않습니다.`;
    // D08: name the bands whose mean range clears the overall range; when none does, the table shows no distinguishable gap.
    const distinct = allRange ? rows.filter((band) => { const r = meanRange(month(band), 21); return r && !overlaps(r, allRange); }).map((band) => band.label) : [];
    const distinctLine = !allRange ? '' : distinct.length
      ? ` 지금 표에서 평균의 범위가 전체 평균의 범위와 겹치지 않는 구간은 ${distinct.join(' · ')}뿐이고, 나머지 구간 사이의 평균 차이는 구별되지 않습니다.`
      : ' 지금 표에서는 어느 구간도 평균의 범위가 전체 평균의 범위와 갈리지 않아, 구간 사이의 평균 차이는 구별되지 않습니다.';

    const deep = el(doc, 'details', null, 'regime-axis-details regime-axis-deep');
    deep.append(el(doc, 'summary', '더 깊이 보기 · 이 표를 읽는 법과 원리'));
    deep.append(el(doc, 'h4', '불안한 구간 뒤의 결과를 읽는 원리'), el(doc, 'p', `변동성이 높을 때 투자자가 위험을 떠안는 대가로 더 큰 기대수익을 요구한다는 설명(위험 프리미엄)이 있습니다. 다만 이 표의 평균 차이가 그 증거가 되려면 구간 평균의 범위(±)가 서로 겹치지 않아야 합니다.${distinctLine} 같은 구간의 하위 10% 결과 손실 폭도 함께 봐야 결과의 폭을 읽을 수 있습니다.`));
    deep.append(el(doc, 'h4', '숫자를 믿을 수 있는 정도'), el(doc, 'p', `연속된 날은 뒤 한 달이 서로 겹치므로 거래일 수만큼 독립적인 사례가 있는 것이 아닙니다. 평균 옆의 ±는 겹치지 않는 한 달 수(거래일 ÷ 21)로 계산한 표준오차의 2배입니다. ${rows.some((band) => Number.isFinite(band.clusters)) ? `경계 근처에서 하루이틀 빠졌다 돌아온 진입은 ${CLUSTER_GAP_SESSIONS}세션 안의 재진입이면 하나의 군집으로 셉니다. ` : '경계 근처에서 하루이틀 빠졌다 돌아오는 진입이 많아, 진입 횟수 대신 겹치지 않는 한 달 수를 표본으로 적었습니다. '}VIX 30 이상은 표본이 적어 평균이 몇 번의 위기에 크게 좌우됩니다. 수익률은 배당을 뺀 가격 기준입니다.`));
    const table = el(doc, 'dl', null, 'regime-evidence');
    for (const band of rows) { const q = quarter(band); const qr = meanRange(q, 63); table.append(el(doc, 'dt', `${band.label} · 석 달 뒤`), el(doc, 'dd', `평균 ${pct(q.mean)}${qr ? ` ±${qr.half.toFixed(1)}%p` : ''} · 오른 비율 ${q.hitRate ?? '—'}% · 하위 10% 결과 ${pct(q.p10)}`)); }
    deep.append(el(doc, 'h4', '석 달 뒤 결과'), table);
    // P1745: the retired-score history paragraph was a changelog, not analysis — removed from the screen.

    // T14: the title names the one thing that was matched (VIX), and the bands are said to differ from the judgement bands.
    // v57.76: the fold summary is the title; the first line bridges from this card's VIX level to the table.
    section.replaceChildren(el(doc, 'summary', STRESS_TITLE),
      el(doc, 'p', '위 VIX 수준과 비슷했던 날에서 시작한 과거의 한 달이 실제로 어떻게 끝났는지입니다.', 'regime-read'),
      el(doc, 'p', `변동성(VIX) 구간별 S&P 500 한 달 뒤 평균 · ${from}~${String(payload.to || '').slice(0, 4)}`, 'regime-chart-caption'), chart, el(doc, 'p', reading, 'regime-read'),
      el(doc, 'p', `이 표의 VIX 구간(${payload.bands.map((band) => band.label.replace(/^VIX /, '')).join(' · ')})은 과거 결과를 나누는 구간이라, 시장 상태 변동성 축의 판정 기준(${RULES.volatility.calmBelow} · ${RULES.volatility.stressAt} · ${RULES.volatility.highAt})과 다릅니다.`, 'regime-chart-caption'), deep);
    section.title = `출처: ${payload.source || 'Yahoo Finance'}`;
    section.hidden = false;
  };
  paint(root?.[STRESS_OUTCOMES.key]);
  refreshSharedArtifact(root, STRESS_OUTCOMES).then(({ payload, changed }) => { if (changed) paint(payload); }).catch(() => {});
}
