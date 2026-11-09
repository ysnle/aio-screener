// v59.55 (owner 11/1; eight since v59.64): 매크로's chapters (domain/macro/macro-chapters.js), right under the quadrant and the six
// factors. Each card is one question: a small two-sided bar picture, the latest numbers, what they mean for stocks, the
// next release, the condition that changes the read, and one fold with the numbers behind it.
import { buildMacroChapters } from '../../domain/macro/macro-chapters.js';
import { markFrame } from './section-frame.js';
import { el } from './dom.js';
import { refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { MARKET_DAY } from '../../data/artifact-registry.js';

function miniBars(doc, viz) {
  const box = el(doc, 'figure', null, 'mx-ch__viz');
  const max = Math.max(...viz.points.map((point) => Math.abs(point.value)), 0.0001);
  const hasNegative = viz.points.some((point) => point.value < 0);
  const plot = el(doc, 'div', null, `mx-ch__plot${hasNegative ? ' has-negative' : ''}`);
  plot.setAttribute('role', 'img');
  plot.setAttribute('aria-label', `${viz.caption}: ${viz.points.map((point) => `${point.x} ${point.value.toFixed(2)}`).join(', ')}`);
  for (const point of viz.points) {
    const col = el(doc, 'div', null, 'mx-ch__col');
    const digits = viz.unit === '%' ? (Math.abs(point.value) < 1 ? 2 : 1) : 0;
    const value = el(doc, 'span', `${point.value > 0 ? '+' : ''}${point.value.toFixed(digits)}`, 'mx-ch__val');
    const up = el(doc, 'span', null, 'mx-ch__half is-up'); const down = el(doc, 'span', null, 'mx-ch__half is-down');
    const bar = el(doc, 'span', null, `mx-ch__bar${point.hot ? ' is-hot' : ''}${point.value < 0 ? ' is-neg' : ''}`);
    bar.style.height = `${Math.max(3, Math.abs(point.value) / max * 100).toFixed(1)}%`;
    (point.value < 0 ? down : up).append(bar);
    col.append(value, up, down, el(doc, 'span', point.x, 'mx-ch__x'));
    plot.append(col);
  }
  box.append(plot, el(doc, 'figcaption', viz.caption, 'mx-ch__cap'));
  return box;
}

// v59.70 (X bookmarks #4): credit tiers in their own recorded range — the 10~90th percentile band, the median tick and
// today's dot, each row on its own scale (CCC sits near 9%, investment grade under 1%).
function rangeBands(doc, model) {
  const box = el(doc, 'figure', null, 'mx-ch__range');
  box.setAttribute('role', 'img');
  box.setAttribute('aria-label', `${model.label || '스프레드 기록 범위'}, ${model.since}: ${model.ranges.map((range) => `${range.label} ${range.display ? range.now.toFixed(1) : `${range.now.toFixed(2)}%`} (기록의 ${range.pct}% 위치)`).join(', ')}`);
  for (const range of model.ranges) {
    const span = range.max - range.min || 1;
    const at = (value) => `${((value - range.min) / span * 100).toFixed(1)}%`;
    const row = el(doc, 'div', null, 'mx-ch__range-row');
    const track = el(doc, 'span', null, 'mx-ch__range-track');
    const band = el(doc, 'span', null, 'mx-ch__range-band');
    band.style.left = at(range.p10); band.style.width = `${((range.p90 - range.p10) / span * 100).toFixed(1)}%`;
    const mid = el(doc, 'span', null, 'mx-ch__range-mid'); mid.style.left = at(range.p50);
    const dot = el(doc, 'span', null, 'mx-ch__range-dot'); dot.style.left = at(range.now);
    track.append(band, mid, dot);
    row.append(el(doc, 'span', range.label, 'mx-ch__range-label'), track, el(doc, 'span', range.display || `${range.now.toFixed(2)}% · ${range.pct}%`, 'mx-ch__range-val'));
    box.append(row);
  }
  box.append(el(doc, 'figcaption', `${model.since} 기록, 띠는 하위 10%~상위 10%, 세로선은 중앙값`, 'mx-ch__cap'));
  return box;
}

function chapterCard(doc, chapter) {
  const card = el(doc, 'article', null, 'mx-ch');
  card.dataset.chapter = chapter.id;
  const head = el(doc, 'div', null, 'mx-ch__head');
  head.append(el(doc, 'h3', chapter.title, 'mx-ch__title'), el(doc, 'span', chapter.question, 'mx-ch__q'));
  const body = el(doc, 'div', null, 'mx-ch__body');
  const text = el(doc, 'div', null, 'mx-ch__text');
  text.append(el(doc, 'p', chapter.now, 'mx-ch__now'), el(doc, 'p', chapter.mean, 'mx-ch__mean'));
  // v59.64: today's move of this chapter's gauges and what moved with it (market-day ledger).
  if (chapter.today?.text) {
    const today = el(doc, 'p', null, `mx-ch__today is-${chapter.today.rank}`);
    today.append(el(doc, 'strong', '오늘 '), doc.createTextNode(chapter.today.text));
    text.append(today);
  }
  body.append(miniBars(doc, chapter.viz), text);
  const next = el(doc, 'dl', null, 'mx-ch__next');
  next.append(el(doc, 'dt', '다음 발표'), el(doc, 'dd', chapter.next), el(doc, 'dt', '바뀌는 조건'), el(doc, 'dd', chapter.flip));
  const fold = el(doc, 'details', null, 'sx-disclosure mx-ch__more');
  const rows = el(doc, 'dl', null, 'mx-ch__detail');
  for (const [label, value] of chapter.detail) rows.append(el(doc, 'dt', label), el(doc, 'dd', value));
  if (chapter.today?.report) rows.append(el(doc, 'dt', '관련 보도'), el(doc, 'dd', `${chapter.today.report.title} (${chapter.today.report.date.slice(5).replace('-', '/')})`));
  fold.append(el(doc, 'summary', '숫자 더 보기'));
  if (chapter.ranges) fold.append(el(doc, 'p', chapter.ranges.line, 'mx-ch__range-line'), rangeBands(doc, chapter.ranges));
  fold.append(rows);
  card.append(head, body, next, fold);
  return card;
}

export function renderMacroChapters({ documentRef: doc, root, events = [] }) {
  const top = doc?.querySelector?.('#page-macro .mk-macro-top');
  if (!top) return null;
  let section = doc.getElementById('macro-chapters');
  const day = root?.[MARKET_DAY.key] || null;
  if (root && !day) refreshSharedArtifact(root, MARKET_DAY).then(({ changed }) => { if (changed) renderMacroChapters({ documentRef: doc, root, events }); }).catch(() => {});
  const model = buildMacroChapters({ macroHistory: root?._aioMacroHistory || null, history: root?._aioHistory || [], events, day });
  if (!model.available) { section?.remove(); return null; }
  const key = [root?._aioMacroHistory?.generatedAt, day?.generatedAt, (root?._aioHistory || []).at?.(-1)?.date, events.map((event) => `${event.id}:${event.date}`).join(',')].join('|');
  if (section?.dataset.signature === key) return section;
  const open = new Set([...(section?.querySelectorAll('.mx-ch__more[open]') || [])].map((node) => node.closest('.mx-ch')?.dataset.chapter));
  if (!section) {
    section = el(doc, 'section', null, 'briefing-block macro-section mx-chapters');
    section.id = 'macro-chapters';
    section.setAttribute('aria-labelledby', 'macro-chapters-title');
    top.after(section);
  }
  const grid = el(doc, 'div', null, 'mx-chapters__grid');
  for (const chapter of model.chapters) {
    const card = chapterCard(doc, chapter);
    if (open.has(chapter.id)) card.querySelector('.mx-ch__more').open = true;
    grid.append(card);
  }
  const title = el(doc, 'h2', '주제별로 보기 — 물가 · 고용 · 금리 · 신용 · 유가 · 금과 은 · 달러 · 변동성 · 성장', 'briefing-h2');
  title.id = 'macro-chapters-title';
  section.replaceChildren(title, grid);
  markFrame(section, 'macro.chapters');
  section.dataset.signature = key;
  return section;
}
