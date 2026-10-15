// v57.54 (owner X packet 2026-10-14, image 3): per-market price temperature on the sentiment screen — the first gauge
// here for KOSPI, KOSDAQ and Nikkei. One visual (five component rank bars + the index with its extreme spells shaded),
// a short reading with the past-spell evidence, and a fold with the method. D02: no average score and no band.
// Hidden until the producer (scripts/build-market-temperature.mjs) has published.
import { MARKET_TEMPERATURE, refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { TEMPERATURE_COMPONENTS, TEMPERATURE_MARKETS, TEMPERATURE_RULES } from '../../domain/sentiment/market-temperature.js';
import { createTrendChart } from './trend-chart.js';
import { el } from './dom.js';

// A value that rounds to zero prints without a sign ('-0.0%' read as a fall).
const pct = (value, digits = 1) => { if (!Number.isFinite(value)) return '—'; const text = Math.abs(value).toFixed(digits); return Number(text) === 0 ? `${text}%` : `${value > 0 ? '+' : '−'}${text}%`; };
const md = (date) => (date ? `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}` : '—');
const STATE_LABEL = { cold: '과도한 냉각', hot: '과도한 과열', none: '보통 범위' };

// v57.54 review: a market whose fetch failed keeps yesterday's body in the artifact (payload.retained), so the
// "now" lead must not name it. A body more than a week behind the newest market is treated the same way.
export function staleMarketIds(payload, markets) {
  const newest = Math.max(...markets.map((item) => Date.parse(item.asOf)).filter(Number.isFinite));
  const retained = new Set(Array.isArray(payload?.retained) ? payload.retained : []);
  return new Set(markets.filter((item) => retained.has(item.id) || newest - Date.parse(item.asOf) > 7 * 86400000).map((item) => item.id));
}

export function temperatureStateText(market, rules = TEMPERATURE_RULES) {
  const scores = (market.components || []).map((row) => row.score).filter(Number.isFinite);
  const total = TEMPERATURE_COMPONENTS.length;
  if (market.state === 'cold') return `${total}개 요소 중 ${market.cold}개가 최근 3년 하위 ${rules.coldAtOrBelow}% — 과도한 냉각 ${market.streak}거래일째`;
  if (market.state === 'hot') return `${total}개 요소 중 ${market.hot}개가 최근 3년 상위 ${100 - rules.hotAtOrAbove}% — 과도한 과열 ${market.streak}거래일째`;
  return `보통 범위${scores.length ? ` — 다섯 요소 순위 ${Math.round(Math.min(...scores))}~${Math.round(Math.max(...scores))}` : ''}${market.cold || market.hot ? `(하위 ${rules.coldAtOrBelow}% ${market.cold}개 · 상위 ${100 - rules.hotAtOrAbove}% ${market.hot}개)` : ''}`;
}

// The 63-session result after past first days of the same spell, against any day; the ± is two standard errors
// (cluster starts are independent samples; the all-days baseline uses n/63 windows, the stress-outcomes D08 rule).
export function temperatureEvidence(market, state = market.state) {
  const from = String(market.from || '').slice(0, 4);
  const spell = market.outcomes?.[state]?.h63;
  const all = market.outcomes?.all?.h63;
  const label = STATE_LABEL[state];
  if (!spell?.n || spell.n < 5 || !all?.n) return `${from}년 이후 ${label} 구간이 시작된 사례가 ${spell?.n || 0}회뿐이라 그 뒤 결과를 요약하지 않습니다.`;
  const half = 2 * (spell.se || 0), allHalf = 2 * (all.se || 0);
  const overlap = spell.mean - half <= all.mean + allHalf && all.mean - allHalf <= spell.mean + half;
  return `${from}년 이후 ${label} 구간이 시작된 첫날 ${spell.n}회 뒤 석 달(63거래일) 동안 평균 ${pct(spell.mean)} ±${half.toFixed(1)}%p, 오른 비율 ${spell.hitRate}%, 하위 10% 결과 ${pct(spell.p10)}였습니다. 아무 날에나 시작한 석 달은 평균 ${pct(all.mean)} ±${allHalf.toFixed(1)}%p라 ${overlap ? '두 범위가 겹쳐 평균 차이는 구별되지 않습니다' : '두 범위가 겹치지 않습니다'}. 과거의 분포이지 이번 석 달의 예측은 아닙니다.`;
}

export function extremeSpans(history = [], rules = TEMPERATURE_RULES) {
  const spans = [];
  let open = null;
  for (const [date, , cold, hot] of history) {
    const tone = cold >= rules.extremeMinComponents ? 'cold' : hot >= rules.extremeMinComponents ? 'hot' : null;
    if (open && open.tone === tone) { open.end = date; continue; }
    if (open) spans.push(open);
    open = tone ? { start: date, end: date, tone } : null;
  }
  if (open) spans.push(open);
  return spans;
}

function componentBars(doc, market, rules) {
  const list = el(doc, 'div', null, 'temp-bars');
  list.setAttribute('role', 'list');
  for (const row of market.components || []) {
    const def = TEMPERATURE_COMPONENTS.find((item) => item.id === row.id);
    const item = el(doc, 'div', null, 'temp-bar-row');
    item.setAttribute('role', 'listitem');
    const tone = row.score <= rules.coldAtOrBelow ? ' is-cold' : row.score >= rules.hotAtOrAbove ? ' is-hot' : '';
    const track = el(doc, 'span', null, 'temp-bar-track');
    const fill = el(doc, 'span', null, `temp-bar${tone}`);
    fill.style.width = `${Math.max(2, Math.round(row.score || 0))}%`;
    track.append(fill);
    item.append(el(doc, 'span', row.label, 'temp-bar-label'), track, el(doc, 'span', Number.isFinite(row.score) ? `${Math.round(row.score)}${tone ? (tone === ' is-cold' ? ' · 하위 10%' : ' · 상위 10%') : ''}` : '—', 'temp-bar-value'));
    if (def) item.title = `${def.label}: ${def.basis} · 최근 3년(756거래일) 안에서의 순위`;
    list.append(item);
  }
  return list;
}

export function renderMarketTemperature({ documentRef: doc, root, anchor }) {
  if (!doc || !anchor) return;
  let section = doc.getElementById('sentiment-temperature');
  if (!section) {
    section = el(doc, 'section', null, 'briefing-block market-temperature');
    section.id = 'sentiment-temperature';
    section.hidden = true;
    anchor.insertAdjacentElement('afterend', section);
  }
  let selected = null;
  const paint = (payload) => {
    // Display order and region come from the domain list (US first), whatever order the artifact was written in.
    const markets = TEMPERATURE_MARKETS.map((def) => (payload?.markets?.[def.id] ? { ...payload.markets[def.id], id: def.id, label: def.label, region: def.region } : null))
      .filter((market) => market?.asOf && Array.isArray(market.components));
    if (payload?.status !== 'current' || !markets.length) { section.hidden = true; return; }
    const rules = { ...TEMPERATURE_RULES, ...(payload.rules || {}) };
    if (!markets.some((market) => market.id === selected)) selected = markets[0].id; // the S&P 500 when published
    const market = markets.find((item) => item.id === selected);

    // The tiles already carry each market's state; the lead names only the markets in an extreme spell (US first).
    const stale = staleMarketIds(payload, markets);
    const extreme = markets.filter((item) => item.state !== 'none' && !stale.has(item.id)).map((item) => `${item.label}(${STATE_LABEL[item.state]} ${item.streak}거래일째)`);
    const lead = `각 지수의 가격이 최근 3년 안에서 얼마나 차갑거나 뜨거운지입니다 — 위 카드가 미국 투자자의 설문·옵션·신용을 본다면 이 표는 가격 자체를 봅니다. ${extreme.length ? `지금 과열·냉각 구간: ${extreme.join(', ')}.` : '지금 과열·냉각 구간에 있는 지수는 없습니다.'}`;

    // The first thing a reader sees: one tile per market (state, streak, the five component ranks as a tiny bar
    // fingerprint). A tile is the selector for the detail below.
    const tabs = el(doc, 'div', null, 'temp-tiles');
    tabs.setAttribute('role', 'group');
    tabs.setAttribute('aria-label', '지수 선택');
    const groups = {};
    for (const item of markets) {
      const region = item.region === 'us' ? 'us' : 'sub';
      if (!groups[region]) {
        const box = el(doc, 'div', null, `temp-group is-${region}`);
        groups[region] = el(doc, 'div', null, 'temp-group-grid');
        box.append(el(doc, 'span', region === 'us' ? '미국' : '한국 · 일본 (보조)', 'temp-tiles-group'), groups[region]);
        tabs.append(box);
      }
      const button = el(doc, 'button', null, `temp-tile is-${item.state}${region === 'sub' ? ' is-sub' : ''}${stale.has(item.id) ? ' is-stale' : ''}${item.id === selected ? ' is-selected' : ''}`);
      button.type = 'button';
      button.dataset.market = item.id;
      button.setAttribute('aria-pressed', String(item.id === selected));
      const spark = el(doc, 'span', null, 'temp-tile-spark');
      spark.setAttribute('aria-hidden', 'true');
      for (const row of item.components || []) {
        const bar = el(doc, 'span', null, `temp-tile-bar${row.score <= rules.coldAtOrBelow ? ' is-cold' : row.score >= rules.hotAtOrAbove ? ' is-hot' : ''}`);
        bar.style.height = `${Math.max(12, Math.round(row.score || 0))}%`;
        spark.append(bar);
      }
      button.append(el(doc, 'span', item.label, 'temp-tile-name'),
        el(doc, 'span', stale.has(item.id) ? '갱신 지연' : item.state === 'none' ? '보통 범위' : `${STATE_LABEL[item.state]} ${item.streak}일째`, 'temp-tile-state'),
        spark,
        el(doc, 'span', `${md(item.asOf)} 종가 ${pct(item.change1d, 1)}`, 'temp-tile-meta'));
      button.setAttribute('aria-label', `${item.label}: ${temperatureStateText(item, rules)}`);
      // Repainting replaces the buttons, so keyboard focus moves to the new tile for the same market.
      button.addEventListener('click', () => { selected = item.id; paint(payload); section.querySelector(`.temp-tile[data-market="${item.id}"]`)?.focus(); });
      groups[region].append(button);
    }

    const head = el(doc, 'div', null, 'temp-head');
    head.append(el(doc, 'strong', `${market.label} ${Number(market.close).toLocaleString('en-US', { maximumFractionDigits: 2 })}`, 'temp-head-value'),
      el(doc, 'span', `${md(market.asOf)} 종가 · 전일 대비 ${pct(market.change1d, 2)}`, 'basis-chip'));
    if (stale.has(market.id)) head.append(el(doc, 'span', `갱신 지연 · ${md(market.asOf)} 값`, 'regime-state is-watch'));
    else if (market.state !== 'none') head.append(el(doc, 'span', `${STATE_LABEL[market.state]} ${market.streak}거래일째`, `regime-state is-${market.state === 'cold' ? 'risk' : 'watch'}`));

    const series = (market.history || []).map(([date, close]) => ({ date, value: close }));
    const chart = createTrendChart(doc, { series, spans: extremeSpans(market.history, rules), label: `${market.label} 2년 종가와 과열·냉각 구간`, format: (value) => Math.round(value).toLocaleString('en-US') });
    const past = [market.week && `1주 전(${md(market.week.date)}) ${market.week.cold}·${market.week.hot}개`, market.month && `1달 전(${md(market.month.date)}) ${market.month.cold}·${market.month.hot}개`].filter(Boolean).join(', ');
    const gapLine = market.gaps?.length ? ` ${market.gaps.map(md).join(', ')} 종가가 원천에 비어 있어 그날은 빼고 계산했습니다.` : '';
    const reading = `${temperatureStateText(market, rules)}. ${past ? `하위·상위 10% 요소 수는 ${past}였습니다. ` : ''}${market.state !== 'none' ? temperatureEvidence(market) : ''}${gapLine}`.trim();

    const deep = el(doc, 'details', null, 'regime-axis-details regime-axis-deep');
    deep.append(el(doc, 'summary', '더 깊이 보기 · 온도를 재는 방법과 과거 결과'));
    deep.append(el(doc, 'h4', '다섯 요소와 과열·냉각 구간의 정의'), el(doc, 'p', `${TEMPERATURE_COMPONENTS.map((item) => `${item.label}(${item.basis})`).join(', ')}를 각각 그 지수의 최근 3년(756거래일) 안에서 순위로 바꿨습니다. 높을수록 뜨거운 쪽입니다. 다섯 개 중 ${rules.extremeMinComponents}개 이상이 동시에 하위 ${rules.coldAtOrBelow}%면 과도한 냉각, 상위 ${100 - rules.hotAtOrAbove}%면 과도한 과열입니다. 서로 다른 쪽을 가리키는 요소를 평균해 한 점수로 만들지 않습니다 — 평균은 차가운 요소와 뜨거운 요소가 상쇄된 50을 '중립'으로 보이게 하기 때문입니다.`));
    deep.append(el(doc, 'h4', '외부 온도계와의 관계'), el(doc, 'p', '시장 심리 온도계를 공개하는 곳들은 계산식을 밝히지 않아 같은 값을 만들 수 없습니다. 이 표는 가격만으로 다시 만든 AIO의 계산이라 거래대금·신용잔고·수급은 들어 있지 않고, 같은 날 비교에서 방향은 대체로 비슷하지만 값은 다릅니다. 신용잔고 반대매매나 외국인 매도처럼 가격 밖의 압력은 이 표에 잡히지 않으니 뉴스와 거래소 공시로 따로 확인해야 합니다.'));
    const table = el(doc, 'dl', null, 'regime-evidence');
    for (const item of markets) {
      for (const state of ['cold', 'hot']) {
        const h = item.outcomes?.[state]?.h63;
        if (!h?.n) continue;
        table.append(el(doc, 'dt', `${item.label} · ${STATE_LABEL[state]} 첫날 뒤 석 달`), el(doc, 'dd', `평균 ${pct(h.mean)} ±${(2 * (h.se || 0)).toFixed(1)}%p · 오른 비율 ${h.hitRate}% · 하위 10% 결과 ${pct(h.p10)} · ${h.n}회`));
      }
      const all = item.outcomes?.all?.h63;
      if (all?.n) table.append(el(doc, 'dt', `${item.label} · 아무 날 뒤 석 달`), el(doc, 'dd', `평균 ${pct(all.mean)} ±${(2 * (all.se || 0)).toFixed(1)}%p · 오른 비율 ${all.hitRate}%`));
    }
    deep.append(el(doc, 'h4', '과거 결과 (가격 수익률, 배당 제외)'), el(doc, 'p', `같은 구간 안에서 ${rules.clusterGapSessions}거래일 안에 다시 들어온 날은 하나의 구간으로 묶고, 구간이 시작된 첫날만 표본으로 셉니다. ±는 표준오차의 2배입니다. 과도한 냉각 뒤 평균이 높아 보여도 범위가 겹치면 '바닥 신호'로 읽을 근거는 없습니다.`), table);

    const body = el(doc, 'div', null, 'temp-body');
    const plot = el(doc, 'div', null, 'temp-plot');
    const legend = el(doc, 'p', null, 'regime-chart-caption temp-legend');
    legend.append(el(doc, 'span', `${market.label} 2년 종가`), el(doc, 'span', '과도한 냉각', 'temp-swatch is-cold'), el(doc, 'span', '과도한 과열', 'temp-swatch is-hot'));
    plot.append(legend, chart);
    body.append(componentBars(doc, market, rules), plot);
    section.replaceChildren(el(doc, 'h2', '지수별 가격 온도 (참고)', 'briefing-h2'), el(doc, 'p', lead, 'regime-read'), tabs, head, body, el(doc, 'p', reading, 'regime-read'), deep);
    section.title = `출처: ${payload.source || 'Yahoo Finance'}`; // T22: provider names in the hover
    section.hidden = false;
  };
  paint(root?.[MARKET_TEMPERATURE.key]);
  refreshSharedArtifact(root, MARKET_TEMPERATURE).then(({ payload, changed }) => { if (changed) paint(payload); }).catch(() => {});
}
