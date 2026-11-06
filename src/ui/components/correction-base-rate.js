// v59.70 (X bookmarks #1): the 추세 row's base rate — how many Nasdaq Composite 7% corrections since 1986 went on to a
// bear market. One dot per past correction (filled = it reached -20%), the count as "N번 중 N번" and its definition.
// It is context for the trend axis, not an input to it: the verdict and its score never read it.
import { refreshSharedArtifact, SCENARIO_OUTCOMES } from '../../data/shared-artifacts.js';
import { correctionReading } from '../../domain/scenarios/correction-base-rates.js';
import { buildCloseSeries, closeBasis } from '../../domain/briefing/market-read.js';
import { el } from './dom.js';

export function renderCorrectionBaseRate({ documentRef: doc, root, host, onLoad = null }) {
  if (!doc || !host) return null;
  const rates = root?.[SCENARIO_OUTCOMES.key]?.corrections || null;
  if (!rates) {
    if (root && !root.__aioCorrectionRequested) {
      root.__aioCorrectionRequested = true;
      refreshSharedArtifact(root, SCENARIO_OUTCOMES).then(({ changed }) => { if (changed && typeof onLoad === 'function') onLoad(); }).catch(() => {});
    }
    return null;
  }
  const history = root?._aioHistory || [];
  const series = buildCloseSeries(history, 'nasdaq', { through: closeBasis(history) });
  const last = series.at(-1);
  const reading = correctionReading(rates, { close: last?.value, closeDate: last?.date, recordClose: Math.max(...series.map((point) => point.value)) });
  if (!reading) return null;
  const box = el(doc, 'section', null, 'mk-correction');
  box.dataset.correctionBase = '';
  box.append(el(doc, 'h4', reading.lead), el(doc, 'p', reading.text, 'regime-read'));
  const dots = el(doc, 'div', null, 'mk-correction__dots');
  dots.setAttribute('role', 'img');
  dots.setAttribute('aria-label', `${rates.n}번의 조정 가운데 ${rates.bear}번이 약세장`);
  for (const [peakDate, troughPct, fast, bear] of rates.events || []) {
    const dot = el(doc, 'span', null, `mk-correction__dot${bear ? ' is-bear' : ''}${fast ? ' is-fast' : ''}`);
    dot.title = `${peakDate.slice(0, 7).replace('-', '년 ')}월 고점, 가장 깊은 종가 ${troughPct.toFixed(1)}%${fast ? ', 빠른 조정' : ''}`;
    dots.append(dot);
  }
  box.append(dots, el(doc, 'p', reading.definition, 'mk-correction__def'));
  host.append(box);
  return box;
}
