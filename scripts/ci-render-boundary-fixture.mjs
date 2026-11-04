#!/usr/bin/env node
// v59.70 (render hotfix 2026-11-04): the two render defects the 02:54Z data exposed, held at their boundaries so the next
// data day cannot bring them back. (1) A gauge value that rounds to zero prints no sign — dxy20 0.03 read '+0.0%' in the
// caption and the aria-label (browser-rendered-copy-lint); 0.04, -0.04 and 0.05 at one digit. (2) SVG labels that would
// print on top of each other move vertically apart (svg-label-dodge.js) — two value labels with no value difference at
// one point, and the rates-curve case of a value label on the axis floor label (1개월 4.03 on 3.9%). Node only, a minimal
// SVG document; fails on the code before the fix (the old valueText; no dodge module).
import { gaugeBar } from '../src/ui/components/gauge-bar.js';
import { boxesOverlap, dodgeSvgLabels, labelBox } from '../src/ui/components/svg-label-dodge.js';

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

function node(tag) {
  const attrs = {};
  return {
    tag, children: [], textContent: '', className: '',
    setAttribute(key, value) { attrs[key] = String(value); },
    getAttribute(key) { return Object.hasOwn(attrs, key) ? attrs[key] : null; },
    append(...parts) { this.children.push(...parts.filter(Boolean)); },
    appendChild(part) { this.children.push(part); return part; }
  };
}
const doc = { createElementNS: (_ns, tag) => node(tag), createElement: (tag) => node(tag) };
const gauge = (value, min) => gaugeBar(doc, { label: '달러 지수 20일 변화', value, min, max: 3, digits: 1, unit: '%', bands: [{ from: min, to: 0, tone: 'favorable' }, { from: 0, to: 3, tone: 'burden' }] });
const texts = (wrap) => ({ caption: wrap.children.find((child) => child.className === 'macro-gauge-caption')?.textContent || '', aria: wrap.children.find((child) => child.tag === 'svg')?.getAttribute('aria-label') || '' });

// (1) Signed scale (min < 0): zero after rounding has no sign; a value that rounds away from zero keeps it.
for (const [value, shown] of [[0.04, '0.0%'], [-0.04, '0.0%'], [0.03, '0.0%'], [0.05, '+0.1%'], [-0.05, '-0.1%'], [0, '0.0%'], [1.24, '+1.2%']]) {
  const { caption, aria } = texts(gauge(value, -3));
  check(caption === `달러 지수 20일 변화, ${shown}`, `v59.70 gauge ${value}: caption '${caption}', want '${shown}'`);
  check(aria.startsWith(`달러 지수 20일 변화: ${shown},`), `v59.70 gauge ${value}: aria-label '${aria}', want '${shown}'`);
}
// Unsigned scale (min >= 0): no '+', and a tiny negative reading is not '-0.0'.
for (const [value, shown] of [[0.04, '0.0%'], [-0.04, '0.0%'], [2.5, '2.5%']]) {
  const { caption } = texts(gauge(value, 0));
  check(caption === `달러 지수 20일 변화, ${shown}`, `v59.70 unsigned gauge ${value}: caption '${caption}', want '${shown}'`);
}

// (2) Label dodge. A label at x/y with an anchor, 12-unit type.
const label = (text, x, y, anchor = 'middle') => { const t = node('text'); t.textContent = text; t.setAttribute('x', x); t.setAttribute('y', y); t.setAttribute('text-anchor', anchor); return t; };
const clear = (all) => all.every((a, i) => all.every((b, j) => i === j || !boxesOverlap(labelBox(a, 12), labelBox(b, 12))));
// Two value labels with no value difference, at the same point.
const twins = [label('4.03', 54, 120), label('4.03', 54, 120)];
check(dodgeSvgLabels({ movable: twins }) === 1 && clear(twins), `v59.70 equal values: ${twins.map((t) => t.getAttribute('y')).join(', ')} still overlap`);
// The 11/3 rates curve: the 1개월 value label above its point on the 3.9% axis label, the 1개월 tenor label below.
const axis = label('3.9%', 48, 122, 'end');
const tenor = label('1개월', 54, 144);
const value = label('4.03', 54, 118);
check(boxesOverlap(labelBox(value, 12), labelBox(axis, 12)), 'v59.70 fixture: the value label starts on the axis label');
dodgeSvgLabels({ fixed: [axis, tenor], movable: [value] });
check(clear([axis, tenor, value]), `v59.70 rates curve: 4.03 at y=${value.getAttribute('y')} still meets 3.9% or 1개월`);
check(Math.abs(Number(value.getAttribute('y')) - 118) < 30, `v59.70 rates curve: 4.03 moved ${Number(value.getAttribute('y')) - 118} units, more than it needs`);
// A label already clear is not moved; a document without attributes (unit-test fakes) is left as drawn.
const lone = label('5.32', 300, 40);
check(dodgeSvgLabels({ fixed: [axis], movable: [lone] }) === 0 && lone.getAttribute('y') === '40', 'v59.70 a clear label stays');
check(dodgeSvgLabels({ movable: [{ textContent: 'x' }] }) === 0, 'v59.70 a node without attributes is skipped');

if (failures.length) {
  console.error(`v59.70 render boundary fixture FAIL (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('v59.70 render boundary fixture PASS: zero-rounding gauge values print no sign (caption + aria), equal and axis-floor labels dodge vertically.');
