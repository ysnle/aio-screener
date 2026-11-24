// v59.68 (owner 2026-11-03, "경중" and "visual elements"): a story's weight drawn beside its title — a bar the length of its
// market-day materiality (0–100, the ledger's own rank measure: move against its volatility, index weight, source tier)
// and the lead fact's direction. The bar orders the day at a glance; it is a ranking, never a forecast.
import { el } from './dom.js';

export function storyWeight(doc, story) {
  const weight = Math.max(0, Math.min(100, Math.round(Number(story?.materiality) || 0)));
  const box = el(doc, 'span', null, `story-weight is-${story?.rank || 'minor'}`);
  box.setAttribute('role', 'img');
  const label = `시장 영향 ${weight}/100`;
  box.setAttribute('aria-label', label);
  box.title = `${label} (평소 변동 대비 크기, 지수 비중, 보도 등급으로 매긴 순위)`;
  const bar = el(doc, 'span', null, 'story-weight__bar');
  bar.style.setProperty('--w', `${weight}%`);
  box.append(bar);
  const up = story?.direction > 0;
  if (story?.direction) box.append(el(doc, 'span', up ? '▲' : '▼', `story-weight__dir is-${up ? 'up' : 'down'}`));
  return box;
}
