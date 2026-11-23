import { refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { correctionReading } from '../../domain/scenarios/correction-base-rates.js';
import { buildCloseSeries, closeBasis } from '../../domain/briefing/market-read.js';
import { el } from './dom.js';
import { SCENARIO_OUTCOMES } from '../../data/artifact-registry.js';
import { currentScenarioOutcomes, outcomeRecordNote } from '../../domain/scenarios/outcome-fingerprints.js';

export function renderCorrectionBaseRate({ documentRef: doc, root, host, onLoad = null }) {
  if (!doc || !host) return null;
  const published = root?.[SCENARIO_OUTCOMES.key] || null;
  const rates = currentScenarioOutcomes(published)?.corrections || null;
  if (!rates) {
    if (root && !root.__aioCorrectionRequested) {
      root.__aioCorrectionRequested = true;
      refreshSharedArtifact(root, SCENARIO_OUTCOMES).then(({ changed }) => { if (changed && typeof onLoad === 'function') onLoad(); })
        .catch(() => { root.__aioCorrectionFailed = true; if (typeof onLoad === 'function') onLoad(); });
    }
    // A record withheld for another definition stamp, or a load that failed, stays on the card as one
    // status line with the file's last date; before the first load the card is not drawn.
    const restamped = !!published?.corrections;
    if (!restamped && !(published || root?.__aioCorrectionFailed)) return null;
    const box = el(doc, 'section', null, 'mk-correction');
    box.dataset.correctionBase = 'pending';
    box.append(el(doc, 'h4', '나스닥 조정 뒤 약세장 기록'), el(doc, 'p', outcomeRecordNote(published, { restamped }), 'regime-read'));
    host.append(box);
    return box;
  }
  const history = root?._aioHistory || [];
  const series = buildCloseSeries(history, 'nasdaq', { through: closeBasis(history) });
  const last = series.at(-1);
  const reading = correctionReading(rates, { close: last?.value, closeDate: last?.date, recordClose: Math.max(...series.map((point) => point.value)), series });
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
