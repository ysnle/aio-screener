// The one hysteresis every judgement rule uses (the market axes and the 매크로 inflation speed): over dated points,
// on from the first point where enter() holds, off again only where exit() holds. A value hovering at a line keeps the
// state it last crossed into until it leaves the band between the two lines.
export function latchedState(points = [], enter, exit) {
  let on = false, since = null;
  for (const point of points) {
    if (enter(point)) { if (!on) since = point.date; on = true; }
    else if (on && exit(point)) { on = false; since = null; }
  }
  return { on, since };
}
