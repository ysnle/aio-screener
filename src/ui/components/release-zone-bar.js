// v59.69: a release on its bands — good / neutral / burden / bad segments at their numeric edges and a pin at the latest
// value (release-zones.js owns the cut points and what each band means; the meaning stays on the hover).
import { el } from './dom.js';
import { releaseZones, RELEASE_ZONE_IDS } from '../../domain/macro/release-zones.js';
import { signedText } from '../../domain/shared/number.js';

const valueText = (zone, value) => (zone.unit === '천 명'
  ? `${value > 0 ? '+' : ''}${(value / 10).toFixed(1)}만`
  : signedText(value, zone.digits, zone.unit));
const edgeText = (zone, value) => (zone.unit === '천 명' ? `${(value / 10).toFixed(1).replace(/\.0$/, '')}만` : `${value}`);

export function releaseZoneBar(doc, zone, { compact = false } = {}) {
  const box = el(doc, 'div', null, `zone-bar${compact ? ' is-compact' : ''}`);
  const [lo, hi] = zone.range;
  const at = (value) => Math.max(0, Math.min(100, (value - lo) / (hi - lo) * 100));
  const latest = zone.latest;
  const track = el(doc, 'div', null, 'zone-bar__track');
  track.setAttribute('role', 'img');
  track.setAttribute('aria-label', `${zone.measure}${latest ? ` ${valueText(zone, latest.value)}, ${latest.label}` : ''}`);
  if (latest) track.title = `${zone.measure} ${valueText(zone, latest.value)} — ${latest.read}`;
  for (const band of zone.bands) {
    const seg = el(doc, 'span', null, `zone-bar__band is-${band.tone}${latest?.label === band.label ? ' is-now' : ''}`);
    const width = at(band.to) - at(band.from);
    seg.style.width = `${width.toFixed(2)}%`;
    if (width >= 12) seg.append(el(doc, 'span', band.label, 'zone-bar__label'));
    track.append(seg);
  }
  if (latest) {
    const pin = el(doc, 'span', valueText(zone, latest.value), 'zone-bar__pin');
    const left = at(latest.value);
    pin.style.left = `${left.toFixed(2)}%`;
    if (left > 85) pin.classList.add('is-end'); else if (left < 15) pin.classList.add('is-start');
    track.append(pin);
  }
  const edges = el(doc, 'div', null, 'zone-bar__edges');
  edges.setAttribute('aria-hidden', 'true');
  for (const band of zone.bands.slice(0, -1)) {
    const tick = el(doc, 'span', edgeText(zone, band.to), 'zone-bar__edge');
    tick.style.left = `${at(band.to).toFixed(2)}%`;
    edges.append(tick);
  }
  box.append(track, edges);
  return box;
}

/** 매크로: the four scheduled releases, each on its bands. */
export function renderReleaseGuide(doc, root) {
  const host = doc.getElementById('macro-release-guide');
  if (!host) return;
  const macroHistory = root?._aioMacroHistory || null;
  const zones = RELEASE_ZONE_IDS.map((id) => releaseZones(id, macroHistory)).filter((zone) => zone?.latest);
  const section = host.closest('section');
  if (section) section.hidden = !zones.length;
  host.replaceChildren(...zones.map((zone) => {
    const row = el(doc, 'div', null, 'release-guide__row');
    const name = el(doc, 'span', zone.name, 'release-guide__name');
    name.append(el(doc, 'span', zone.latest.label, `release-guide__state is-${zone.latest.tone}`));
    row.append(name, releaseZoneBar(doc, zone));
    return row;
  }));
}
