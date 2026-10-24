// v58.75: completed-session and Yahoo-payload bar helpers, split from stock-chart.js so boot-time readers do not load
// the chart module (Lightweight Charts wiring, levels, coach) just to trim a live bar.
// P1428 (Codex review): during the session Yahoo's last daily bar is still moving; it was analysed and
// labelled 종가. A bar dated today in the exchange's zone is kept only after the close (+20 minutes for the
// official print); the regular-session end comes from the payload when present (16:00 by default).
export function completedBars(bars, payload, nowMs = Date.now()) {
  if (!bars.length) return { bars, droppedLive: false };
  const tz = payload?.meta?.exchangeTimezoneName || 'America/New_York';
  const today = new Date(nowMs).toLocaleDateString('en-CA', { timeZone: tz });
  const last = bars[bars.length - 1];
  if (last.time !== today) return { bars, droppedLive: false };
  const end = Number(payload?.meta?.currentTradingPeriod?.regular?.end) * 1000;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(nowMs)).map((p) => [p.type, p.value]));
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  const closeMinutes = tz === 'Asia/Seoul' ? 15 * 60 + 30 : tz === 'America/New_York' ? 16 * 60 : null;
  const closed = Number.isFinite(end) && end > 0 ? nowMs >= end + 20 * 60000 : closeMinutes != null && minutes >= closeMinutes + 20;
  return closed ? { bars, droppedLive: false } : { bars: bars.slice(0, -1), droppedLive: true };
}

export function barsFromYahoo(payload) {
  if (!payload || !Array.isArray(payload.timestamps)) return [];
  const tz = payload.meta?.exchangeTimezoneName || 'America/New_York';
  return payload.timestamps.map((ts, i) => ({
    time: new Date(ts * 1000).toLocaleDateString('en-CA', { timeZone: tz }),
    open: payload.opens?.[i], high: payload.highs?.[i], low: payload.lows?.[i], close: payload.closes?.[i], volume: payload.volumes?.[i]
  })).filter((bar) => [bar.open, bar.high, bar.low, bar.close].every((v) => typeof v === 'number' && Number.isFinite(v) && v > 0));
}
