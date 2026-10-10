// 리서치 라이브러리 · 분석 노트. A note reads like a feature: the scene that raises the issue, the
// story of how it works (numbers woven in), the numbers traced once more in a small table, the case
// where things run the other way, and where to look next. Source checking is done by us in the data
// and gates, not shown to the reader (owner direction 2026-10-05).
import { PATHS, LESSONS, FRAME_VARIABLES, FRAME_EXTRA_SOURCES } from '../../domain/knowledge/learning-core.js';
import { applySafeExternalLink } from './safe-external-link.js';
import { CONCEPT_CORE } from '../../domain/knowledge/concept-core.js';

const conceptById = new Map(CONCEPT_CORE.map((concept) => [concept.id, concept]));

function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

const STYLE = `
.af-article{max-width:760px}
.af-kicker{font-size:11px;color:var(--text-muted);margin:0 0 6px;letter-spacing:.03em}
.af-issue{font-family:var(--font-display);font-size:22px;font-weight:600;color:var(--text-primary);margin:0 0 14px;line-height:1.35}
.af-lead{font-size:15px;line-height:1.75;color:var(--text-primary);margin:0 0 18px}
.af-prose p{font-size:14px;line-height:1.8;color:var(--text-secondary);margin:0 0 12px}
.af-section{font-size:12px;font-weight:700;color:var(--text-primary);margin:24px 0 8px;letter-spacing:.02em}
.af-flow{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0 14px}
.af-flow-step{font-size:12px;padding:6px 10px;border:1px solid var(--border-subtle);border-radius:3px;background:var(--surface-2);color:var(--text-primary)}
.af-flow-arrow{font-size:12px;color:var(--text-muted)}
.af-stack{display:flex;flex-direction:column;gap:4px;margin:6px 0 10px}
.af-stack-layer{border:1px solid var(--border-subtle);border-radius:3px;padding:7px 10px;background:var(--surface-2);font-size:13px;color:var(--text-secondary)}
.af-stack-layer strong{color:var(--text-primary);margin-right:8px}
.af-links{margin:0 0 6px;padding-left:18px;font-size:13px;line-height:1.6;color:var(--text-secondary)}
.af-bars{display:grid;gap:6px;margin:6px 0 14px;max-width:520px}
.af-bar-row{display:grid;grid-template-columns:150px 1fr 64px;gap:8px;align-items:center;font-size:12px;color:var(--text-secondary)}
.af-bar-track{position:relative;height:10px;background:var(--surface-2);border-radius:2px}
.af-bar-fill{position:absolute;top:0;bottom:0;background:var(--accent);opacity:.75;border-radius:2px}
.af-bar-fill.is-neg{background:var(--data-red)}
.af-bar-value{text-align:right;font-variant-numeric:tabular-nums;color:var(--text-primary)}
.af-calc{border:1px solid var(--border-subtle);border-radius:4px;padding:12px 14px;background:var(--surface-1);margin:4px 0 6px}
.af-calc dl{display:grid;grid-template-columns:64px 1fr;gap:5px 12px;margin:0;font-size:13px;line-height:1.55}
.af-calc dt{color:var(--text-muted)}
.af-calc dd{margin:0;color:var(--text-primary);font-variant-numeric:tabular-nums}
.af-twist{font-size:14px;line-height:1.8;color:var(--text-secondary);margin:0;padding:12px 14px;border-left:3px solid var(--border-subtle);background:var(--surface-1)}
.af-stages{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:8px 0 4px}
.af-stage{border:1px solid var(--border-subtle);border-radius:8px;padding:10px;background:var(--surface-1)}
.af-stage-title{margin:0 0 6px;font-size:12px;color:var(--text-secondary)}
.af-stage-node{display:block;width:100%;text-align:left;margin:4px 0;padding:6px 8px;border:1px solid var(--border-subtle);border-radius:4px;background:var(--surface-0,transparent);color:var(--text-primary);font-size:13px;cursor:pointer}
.af-stage-node.is-active{border-color:var(--accent);font-weight:600}
.af-links{margin:6px 0;padding-left:18px;font-size:14px;line-height:1.8}
.af-tag{margin-left:8px;font-size:11px;color:var(--text-secondary);border:1px solid var(--border-subtle);border-radius:3px;padding:0 4px}
.af-definition{margin:16px 0;padding:12px 16px;border:1px solid var(--border-subtle);border-radius:8px;background:var(--surface-1)}
.af-definition strong{display:block;font-size:12px;letter-spacing:.04em;color:var(--text-secondary);margin-bottom:4px}
.af-definition p{margin:0;font-size:14px;line-height:1.8;color:var(--text-primary)}
.af-model{display:grid;grid-template-columns:80px 1fr;gap:5px 12px;font-size:13px;line-height:1.55;margin:0 0 6px;padding:12px 14px;border:1px solid var(--border-subtle);border-radius:4px}
.af-model dt{color:var(--text-muted)}
.af-model dd{margin:0;color:var(--text-primary)}
.af-channel{display:inline-block;font-size:11px;padding:2px 8px;margin:0 4px 4px 0;border:1px solid var(--border-subtle);border-radius:3px;color:var(--text-muted)}
.af-channel.is-on{border-color:var(--accent);color:var(--text-primary);font-weight:700}
.af-concept{margin:0 0 8px}
.af-concept summary{cursor:pointer;font-size:13px;color:var(--text-primary);font-weight:600}
.af-concept p{font-size:12px;line-height:1.6;color:var(--text-secondary);margin:4px 0 0}
.af-route{display:block;width:100%;text-align:left;border:0;background:none;padding:5px 0;cursor:pointer}
.af-route strong{display:block;font-size:13px;color:var(--text-primary);text-decoration:underline;text-underline-offset:2px}
.af-route span{display:block;font-size:12px;color:var(--text-muted);line-height:1.45;margin-top:1px}
.af-route.is-current strong{text-decoration:none;color:var(--text-muted)}
.af-terms{display:grid;grid-template-columns:118px 1fr;gap:5px 12px;margin:18px 0 0;padding:10px 0 0;border-top:1px solid var(--border-subtle);font-size:13px;line-height:1.6}
.af-terms dt{color:var(--text-muted)}
.af-terms dd{margin:0;color:var(--text-secondary)}
.af-term-link{border:0;background:none;padding:0;font:inherit;color:var(--text-primary);text-decoration:underline;text-underline-offset:2px;cursor:pointer}
.af-table{margin:14px 0 6px}
.af-table table{border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}
.af-table caption{caption-side:top;text-align:left;font-size:12px;color:var(--text-muted);padding:0 0 6px}
.af-table th,.af-table td{border:1px solid var(--border-subtle);padding:5px 10px;text-align:right}
.af-table th:first-child{text-align:left}
.af-table thead th{background:var(--surface-2);color:var(--text-primary)}
.af-branches{display:grid;gap:8px;margin:6px 0 14px}.af-branch{border-left:3px solid var(--border-subtle);padding:4px 0 4px 10px}.af-branch-when{font-size:12px;font-weight:700;color:var(--text-primary);margin:0 0 4px}.af-branch .af-flow{margin:0 0 4px}.af-branch-check{font-size:12px;color:var(--text-secondary);margin:0}
.af-forces{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:6px 0 8px;max-width:640px}
.af-force{border:1px solid var(--border-subtle);border-radius:4px;padding:9px 11px;background:var(--surface-1)}
.af-force strong{display:block;font-size:12px;color:var(--text-muted);margin-bottom:4px}
.af-force ul{margin:0;padding-left:16px;font-size:13px;line-height:1.6;color:var(--text-primary)}
.af-force-sum{max-width:640px;font-size:13px;line-height:1.6;padding:8px 11px;border:1px solid var(--accent);border-radius:4px;color:var(--text-primary)}
.af-formula{font-size:13px;padding:8px 12px;border:1px solid var(--border-subtle);border-radius:4px;background:var(--surface-1);font-variant-numeric:tabular-nums;max-width:640px;line-height:1.7}
.af-basis{margin:22px 0 0;border-top:1px solid var(--border-subtle);padding-top:10px}
.af-basis summary{cursor:pointer;font-size:12px;font-weight:700;color:var(--text-secondary)}
.af-basis ul{margin:8px 0 0;padding-left:18px;font-size:12px;line-height:1.65;color:var(--text-secondary)}
.af-basis a{color:var(--text-primary)}
`;

export function ensureFrameStyle(doc) {
  if (!doc?.head || doc.getElementById('aio-analysis-frames-style')) return;
  const style = doc.createElement('style');
  style.id = 'aio-analysis-frames-style';
  style.textContent = STYLE;
  doc.head.appendChild(style);
}

function figure(doc, spec) {
  if (!spec) return null;
  if (spec.kind === 'flow') {
    const box = el(doc, 'div', 'af-flow');
    box.setAttribute('role', 'list');
    spec.steps.forEach((step, index) => {
      if (index) box.appendChild(el(doc, 'span', 'af-flow-arrow', '→'));
      const node = el(doc, 'span', 'af-flow-step', step);
      node.setAttribute('role', 'listitem');
      box.appendChild(node);
    });
    return box;
  }
  if (spec.kind === 'stack') {
    const wrap = el(doc, 'div');
    const box = el(doc, 'div', 'af-stack');
    for (const layer of spec.layers) {
      const row = el(doc, 'div', 'af-stack-layer');
      row.append(el(doc, 'strong', null, layer.label), doc.createTextNode(layer.note));
      box.appendChild(row);
    }
    wrap.appendChild(box);
    if (spec.links?.length) {
      const list = el(doc, 'ul', 'af-links');
      spec.links.forEach((link) => list.appendChild(el(doc, 'li', null, link)));
      wrap.appendChild(list);
    }
    return wrap;
  }
  // Opposing forces summed into one result (Codex review 2026-10-05): a single arrow chain hid the
  // counter-case inside the reverse paragraph; the forces put it in the mechanism itself.
  if (spec.kind === 'forces') {
    const wrap = el(doc, 'div');
    const grid = el(doc, 'div', 'af-forces');
    [['낮추는 힘', spec.lower], ['높이는 힘', spec.raise]].forEach(([label, items]) => {
      const box = el(doc, 'div', 'af-force');
      const list = el(doc, 'ul');
      items.forEach((item) => list.appendChild(el(doc, 'li', null, item)));
      box.append(el(doc, 'strong', null, label), list);
      grid.appendChild(box);
    });
    wrap.append(grid, el(doc, 'p', 'af-force-sum', `${spec.sum} → ${spec.effect}`));
    return wrap;
  }
  // Codex browser audit H65: alternative outcomes drawn as one arrow chain read as a fixed sequence of
  // events. Branches state the condition, the path and the indicator that would show it is not happening.
  if (spec.kind === 'branches') {
    const wrap = el(doc, 'div', 'af-branches');
    for (const branch of spec.branches) {
      const box = el(doc, 'div', 'af-branch');
      box.appendChild(el(doc, 'p', 'af-branch-when', `조건 · ${branch.when}`));
      box.appendChild(figure(doc, { kind: 'flow', steps: branch.steps }));
      if (branch.check) box.appendChild(el(doc, 'p', 'af-branch-check', `반증 신호 · ${branch.check}`));
      wrap.appendChild(box);
    }
    return wrap;
  }
  if (spec.kind === 'formula') return el(doc, 'p', 'af-formula', spec.text);
  if (spec.kind === 'bars') {
    const box = el(doc, 'div', 'af-bars');
    const max = Math.max(...spec.bars.map((bar) => Math.abs(bar.value)), 1);
    const hasNeg = spec.bars.some((bar) => bar.value < 0);
    for (const bar of spec.bars) {
      const row = el(doc, 'div', 'af-bar-row');
      const track = el(doc, 'div', 'af-bar-track');
      const fill = el(doc, 'span', `af-bar-fill${bar.value < 0 ? ' is-neg' : ''}`);
      const width = Math.abs(bar.value) / max * (hasNeg ? 50 : 100);
      fill.style.width = `${width.toFixed(1)}%`;
      fill.style.left = hasNeg ? (bar.value < 0 ? `${(50 - width).toFixed(1)}%` : '50%') : '0';
      track.appendChild(fill);
      row.append(el(doc, 'span', null, bar.label), track, el(doc, 'span', 'af-bar-value', `${bar.value > 0 && hasNeg ? '+' : ''}${bar.value}${bar.unit || '%'}`));
      box.appendChild(row);
    }
    return box;
  }
  return null;
}

export function renderFrameArticle(doc, lesson) {
  ensureFrameStyle(doc);
  const article = el(doc, 'article', 'af-article');
  article.dataset.analysisFrame = lesson.id;
  article.append(el(doc, 'p', 'af-kicker', PATHS.find((path) => path.id === lesson.path)?.title || '분석 노트'), el(doc, 'h2', 'af-issue', lesson.issue), el(doc, 'p', 'af-lead', lesson.answer));
  if (lesson.model) {
    article.appendChild(el(doc, 'h3', 'af-section', '이 사업의 뼈대'));
    const dl = el(doc, 'dl', 'af-model');
    [['무엇을 파나', lesson.model.makes], ['누가 내나', lesson.model.payer], ['어디에 드나', lesson.model.cost], ['무엇이 바꾸나', lesson.model.driver]].forEach(([k, v]) => dl.append(el(doc, 'dt', null, k), el(doc, 'dd', null, v)));
    article.appendChild(dl);
  }
  const prose = el(doc, 'div', 'af-prose');
  lesson.mechanism.forEach((paragraph) => prose.appendChild(el(doc, 'p', null, paragraph)));
  article.appendChild(prose);
  const fig = figure(doc, lesson.figure);
  if (fig) article.append(el(doc, 'h3', 'af-section', '흐름으로 보면'), fig);
  if (lesson.example) {
    article.appendChild(el(doc, 'h3', 'af-section', '숫자로 따라가 보면'));
    const calc = el(doc, 'div', 'af-calc');
    const dl = el(doc, 'dl');
    dl.append(el(doc, 'dt', null, '전제'), el(doc, 'dd', null, lesson.example.inputs.join(' · ')));
    lesson.example.steps.forEach((step, index) => dl.append(el(doc, 'dt', null, index ? '' : '계산'), el(doc, 'dd', null, step)));
    dl.append(el(doc, 'dt', null, '결과'), el(doc, 'dd', null, lesson.example.result));
    calc.appendChild(dl);
    article.appendChild(calc);
  }
  article.append(el(doc, 'h3', 'af-section', '반대로 흘러가는 경우'), el(doc, 'p', 'af-twist', lesson.reverse));
  const basis = renderBasis(doc, {
    sources: [...(lesson.sources || []), ...(FRAME_EXTRA_SOURCES[lesson.id] || [])],
    assumptions: lesson.example ? ['‘숫자로 따라가 보면’에서 연도와 지수·금리 이름이 붙은 값은 실제 관측치이고, 나머지는 구조를 보여 주기 위한 설명용 가정이며 특정 회사의 실제 수치가 아니다. 관측치가 함께 움직였다는 사실은 그 원인을 증명하지 않는다.'] : []
  });
  if (basis) article.appendChild(basis);
  return article;
}

// One folded place at the end of a document for the evidence behind it (Codex review 2026-10-05):
// the original sources, what each supports, and which numbers are illustrative. Kept off the reading
// surface until opened.
export function renderBasis(doc, { sources = [], assumptions = [], asOf = null } = {}) {
  const items = sources.filter((source) => source?.url || source?.label);
  if (!items.length && !assumptions.length && !asOf) return null;
  const box = el(doc, 'details', 'af-basis');
  box.dataset.researchBasis = 'true';
  box.appendChild(el(doc, 'summary', null, '근거와 가정 보기'));
  const list = el(doc, 'ul');
  for (const source of items) {
    const li = el(doc, 'li');
    const link = el(doc, 'a', null, source.label || source.url);
    if (source.url) applySafeExternalLink(link, source.url);
    li.appendChild(link);
    if (source.supports) li.appendChild(doc.createTextNode(` — ${source.supports}`));
    list.appendChild(li);
  }
  if (!items.length) list.appendChild(el(doc, 'li', null, '원자료 링크 없이 정의와 계산으로 확인하는 내용이다.'));
  assumptions.forEach((text) => list.appendChild(el(doc, 'li', null, text)));
  if (asOf) list.appendChild(el(doc, 'li', null, `검토 기준일 ${asOf}`));
  box.appendChild(list);
  return box;
}

// 연결 column for a note: where it lands in a company's numbers, the screens to open next, the concepts it uses.
export function renderFrameConnections(doc, lesson, { onNavigate, onConcept, block }) {
  const nodes = [];
  const variables = FRAME_VARIABLES[lesson.id] || [];
  if (variables.length) {
    const box = block('확인할 변수');
    variables.forEach((name) => box.appendChild(el(doc, 'span', 'af-channel is-on', name)));
    nodes.push(box);
  }
  if (lesson.indicators?.length) {
    const next = block('실제 데이터에서 확인');
    for (const indicator of lesson.indicators) {
      const link = el(doc, 'button', 'af-route');
      link.type = 'button';
      link.dataset.afRoute = indicator.route;
      link.append(el(doc, 'strong', null, indicator.routeLabel), el(doc, 'span', null, indicator.label));
      link.addEventListener('click', () => onNavigate?.({ routeId: indicator.route, routeLabel: indicator.routeLabel, metric: indicator.label }));
      next.appendChild(link);
    }
    nodes.push(next);
  }
  const concepts = (lesson.concepts || []).map((id) => conceptById.get(id)).filter(Boolean);
  if (concepts.length) {
    const box = block('먼저 알아둘 개념');
    for (const concept of concepts) {
      const link = el(doc, 'button', 'af-route');
      link.type = 'button';
      link.dataset.conceptId = concept.id;
      link.append(el(doc, 'strong', null, concept.term), el(doc, 'span', null, concept.def.length > 70 ? `${concept.def.slice(0, 70)}…` : concept.def));
      link.addEventListener('click', () => onConcept?.(concept.id));
      box.appendChild(link);
    }
    nodes.push(box);
  }
  // Notes that apply the same concepts elsewhere — the place to test whether the reading generalises.
  const shared = LESSONS.filter((other) => other.id !== lesson.id && (other.concepts || []).some((id) => (lesson.concepts || []).includes(id))).slice(0, 4);
  if (shared.length) {
    const box = block('같은 원리를 쓰는 다른 노트');
    for (const other of shared) {
      const link = el(doc, 'button', 'af-route');
      link.type = 'button';
      link.dataset.principlesAction = 'frame';
      link.dataset.principlesValue = other.id;
      link.append(el(doc, 'strong', null, other.model ? other.title : other.issue.split(' — ')[0]));
      box.appendChild(link);
    }
    nodes.push(box);
  }
  return nodes;
}
