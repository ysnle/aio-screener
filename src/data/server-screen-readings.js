// The per-screen AI reading gate (public-data/data.json `screenReadings`, scripts/producer/screen-readings.mjs).
// The boot loader keeps the raw block (window._aioScreenReadings, src/data/server-data-loader.js); this route-side reader
// admits one screen's reading only when the producer verified it, its text is within the face's size and its basis is a
// close date. Anything else is no reading: the screen shows its facts alone.
import { isIsoDay } from '../domain/shared/session-date.js';

export const SCREEN_READING_SCHEMA = 'screen-readings.v1';
const MAX_CHARS = 520; // reading-core.js READING_MAX_CHARS: at most two blocks of 130–230 characters (kept literal: this reader is on the signal route)
const MIN_CHARS = 60;

/** { text, blocks, basis, generatedAt } for `screen`, or null. A reading is one or two blocks split by a blank line. */
export function serverScreenReading(root, screen) {
  const block = root?._aioScreenReadings;
  if (!block || block.schemaVersion !== SCREEN_READING_SCHEMA || !block.readings || typeof block.readings !== 'object') return null;
  const reading = block.readings[screen];
  if (!reading || reading.status !== 'verified' || typeof reading.text !== 'string') return null;
  const text = reading.text.trim();
  const blocks = text.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  const size = blocks.join(' ').length;
  if (size < MIN_CHARS || size > MAX_CHARS || blocks.length > 2) return null;
  if (!isIsoDay(reading.basis)) return null;
  return { text, blocks, basis: reading.basis, generatedAt: reading.generatedAt || null };
}
