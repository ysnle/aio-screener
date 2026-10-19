// 2026-10-19 cadence redesign: view model for the briefing's 시간대별 시황 (data.json `marketTimeline`, producer
// scripts/lib/market-timeline.mjs). Slots end at 06:00 · 12:00 · 18:00 · 24:00 KST and are sealed once; the screen lists
// the in-progress slot first, then the sealed ones newest first grouped by KST day, so a missed slot stays readable.
const HOUR = 3600000;
const SLOT_MS = 6 * HOUR;
const KST_OFFSET_MS = 9 * HOUR;
// A sealed slot normally lands within ~30 min of its end; past this the screen says the newest slot is late.
const OVERDUE_MS = 2 * HOUR;

const kstDate = (ms) => new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10);
export const kstClock = (ms) => new Date(ms + KST_OFFSET_MS).toISOString().slice(11, 16);
const monthDay = (date) => `${+date.slice(5, 7)}/${+date.slice(8, 10)}`;
export const latestSlotEnd = (ms) => Math.floor((ms - 3 * HOUR) / SLOT_MS) * SLOT_MS + 3 * HOUR;

export function formatSlotMove(move) {
  const change = Number(move?.change);
  if (!Number.isFinite(change)) return null;
  const sign = change > 0 ? '+' : change < 0 ? '−' : '';
  return { label: String(move.label || ''), text: `${sign}${Math.abs(change).toFixed(2)}${move.changeUnit === 'bp' ? 'bp' : '%'}`, direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat' };
}

function headlineRow(row, nowMs) {
  const publishedMs = Date.parse(row?.publishedAt || '');
  if (!row?.title || !Number.isFinite(publishedMs)) return null;
  const sameDay = kstDate(publishedMs) === kstDate(nowMs);
  return {
    title: String(row.titleKo || row.title), originalTitle: row.titleKo ? String(row.title) : null, link: row.link || null,
    source: row.source || null, publishedMs, time: sameDay ? kstClock(publishedMs) : `${monthDay(kstDate(publishedMs))} ${kstClock(publishedMs)}`,
    unconfirmed: row.verification === 'unconfirmed',
  };
}

function slotView(slot, nowMs) {
  const endMs = Date.parse(slot?.end || '');
  const startMs = Date.parse(slot?.start || '');
  if (!Number.isFinite(endMs) || !Number.isFinite(startMs)) return null;
  const sealedMs = Date.parse(slot.sealedAt || '');
  return {
    id: String(slot.id || slot.end), startMs, endMs, kstDate: kstDate(startMs), label: String(slot.label || ''), endLabel: String(slot.endLabel || kstClock(endMs)),
    sealedAt: Number.isFinite(sealedMs) ? kstClock(sealedMs) : null, late: slot.late === true,
    summary: slot.summary?.text ? String(slot.summary.text) : null, summarySource: slot.summary?.source === 'shared-model' ? 'ai' : 'rule',
    moves: (Array.isArray(slot.moves) ? slot.moves : []).map(formatSlotMove).filter(Boolean).slice(0, 6),
    headlines: (Array.isArray(slot.headlines) ? slot.headlines : []).map((row) => headlineRow(row, nowMs)).filter(Boolean),
    newsUnavailable: slot.newsStatus === 'unavailable', marksMissing: !slot.marks,
  };
}

export function buildMarketTimelineView(timeline, nowMs = Date.now()) {
  if (!timeline || timeline.schemaVersion !== 'market-timeline.v1' || !Array.isArray(timeline.slots)) return { available: false, groups: [], current: null };
  const slots = timeline.slots.map((slot) => slotView(slot, nowMs)).filter((slot) => slot && slot.endMs <= nowMs + 15 * 60000)
    .sort((a, b) => b.endMs - a.endMs);
  const today = kstDate(nowMs);
  const yesterday = kstDate(nowMs - 24 * HOUR);
  const groups = [];
  for (const slot of slots) {
    let group = groups.find((row) => row.date === slot.kstDate);
    if (!group) {
      group = { date: slot.kstDate, label: slot.kstDate === today ? `오늘 ${monthDay(slot.kstDate)}` : slot.kstDate === yesterday ? `어제 ${monthDay(slot.kstDate)}` : monthDay(slot.kstDate), slots: [] };
      groups.push(group);
    }
    group.slots.push(slot);
  }
  const currentEnd = Date.parse(timeline.current?.end || '');
  const current = Number.isFinite(currentEnd) && currentEnd > nowMs && currentEnd - nowMs <= SLOT_MS ? {
    label: String(timeline.current.label || ''), endLabel: String(timeline.current.endLabel || kstClock(currentEnd)),
    headlines: (Array.isArray(timeline.current.headlines) ? timeline.current.headlines : []).map((row) => headlineRow(row, nowMs)).filter(Boolean),
    updatedAt: Number.isFinite(Date.parse(timeline.current.updatedAt || '')) ? kstClock(Date.parse(timeline.current.updatedAt)) : null,
  } : null;
  const expectedEnd = latestSlotEnd(nowMs);
  const overdue = nowMs - expectedEnd > OVERDUE_MS && !(slots[0] && slots[0].endMs >= expectedEnd);
  return { available: slots.length > 0 || !!current, groups, current, overdue, expectedEndLabel: kstClock(expectedEnd) === '00:00' ? '24:00' : kstClock(expectedEnd) };
}
