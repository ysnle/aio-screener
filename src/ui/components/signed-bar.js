// v59.55 (C3): one two-sided bar for every signed comparison — the briefing's asset moves, a stock against its index
// (종목 and the screener's why panel), the validation spread and the portfolio's gap to the index. Five screens each
// computed their own scale, zero line and colours; the zero line, the shared max-abs scale and the colour rule live here.
//
// Tones: 'dir' follows the printed sign (rising red, falling blue, 0.0 grey), 'bench' is the comparison index in light
// ink, 'flat' is a move with no good or bad side (rates in bp, the dollar), 'verdict' is 양호/부담 (green/amber).

// The largest absolute value on one shared scale, never below `floor` so a quiet day does not fill the track.
export function signedScale(values, floor = 1) {
  return Math.max(floor, ...values.filter((value) => Number.isFinite(value)).map((value) => Math.abs(value)));
}

function toneClass(value, tone, digits) {
  if (tone === 'bench' || tone === 'flat') return `is-${tone}`;
  const shown = Number(value.toFixed(digits));
  if (tone === 'verdict') return shown >= 0 ? 'is-good' : 'is-burden';
  return shown > 0 ? 'is-up' : shown < 0 ? 'is-down' : 'is-flat';
}

// One fill: half the track is `max`; a non-zero value keeps a sliver so it is never mistaken for a missing one.
export function signedFill(doc, value, max, { tone = 'dir', digits = 1, className = '' } = {}) {
  const fill = doc.createElement('span');
  fill.className = `signed-fill ${toneClass(value, tone, digits)}${className ? ` ${className}` : ''}`;
  const width = value ? Math.max(0.6, Math.min(50, Math.abs(value) / max * 50)) : 0;
  fill.style.width = `${width.toFixed(2)}%`;
  fill.style.left = `${(value < 0 ? 50 - width : 50).toFixed(2)}%`;
  fill.dataset.sign = value < 0 ? 'down' : value > 0 ? 'up' : 'zero'; // the side of the zero line, whatever the tone
  return fill;
}

// A track with the zero line and its fills (one, or a 1-day bar over a 5-day bar).
export function signedTrack(doc, fills, className = '') {
  const track = doc.createElement('span');
  track.className = `signed-track${className ? ` ${className}` : ''}`;
  track.append(...fills);
  return track;
}

export function signedBar(doc, value, max, options = {}) {
  return signedTrack(doc, [signedFill(doc, value, max, options)], options.trackClass || '');
}
