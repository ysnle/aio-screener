// The per-screen AI reading gate (public-data/data.json `screenReadings`, scripts/producer/screen-readings.mjs).
// The boot loader keeps the raw block (window._aioScreenReadings, src/data/server-data-loader.js); this route-side reader
// admits one screen's reading only when the producer verified it, its text is within the face's size and its basis is a
// close date. Anything else is no reading: the screen shows its facts alone.
import { isIsoDay } from '../domain/shared/session-date.js';

export const SCREEN_READING_SCHEMA = 'screen-readings.v1';
const MAX_CHARS = 400;
const MIN_CHARS = 60;

/** { text, basis, generatedAt } for `screen`, or null. */
export function serverScreenReading(root, screen) {
  const block = root?._aioScreenReadings;
  if (!block || block.schemaVersion !== SCREEN_READING_SCHEMA || !block.readings || typeof block.readings !== 'object') return null;
  const reading = block.readings[screen];
  if (!reading || reading.status !== 'verified' || typeof reading.text !== 'string') return null;
  const text = reading.text.trim();
  if (text.length < MIN_CHARS || text.length > MAX_CHARS) return null;
  if (!isIsoDay(reading.basis)) return null;
  return { text, basis: reading.basis, generatedAt: reading.generatedAt || null };
}
