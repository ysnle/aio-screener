// The per-screen AI reading gate (public-data/data.json `screenReadings`, scripts/producer/screen-readings.mjs).
// The boot loader keeps the raw block (window._aioScreenReadings, src/data/server-data-loader.js); this route-side reader
// admits one screen's reading only when the producer verified it, its text is within the face's size and its basis is a
// close date. Anything else is no reading: the screen shows its facts alone.
import { isIsoDay } from '../domain/shared/session-date.js';
import { readingLimitsOf } from '../ai/reading/reading-limits.js';
import { stripPublisherAttribution } from '../domain/content/publisher-attribution.js';

export const SCREEN_READING_SCHEMA = 'screen-readings.v1';
const MIN_CHARS = 60;

/** { text, blocks, basis, generatedAt } for `screen`, or null. A reading is blocks split by a blank line, within the screen's limits (reading-limits.js). */
export function serverScreenReading(root, screen) {
  const block = root?._aioScreenReadings;
  if (!block || block.schemaVersion !== SCREEN_READING_SCHEMA || !block.readings || typeof block.readings !== 'object') return null;
  const reading = block.readings[screen];
  if (!reading || reading.status !== 'verified' || typeof reading.text !== 'string') return null;
  // A reading published before the producer took publishers out of its attributions gets the same repair here.
  const text = stripPublisherAttribution(reading.text.trim()).text.trim();
  const blocks = text.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  const size = blocks.join(' ').length;
  const limits = readingLimitsOf(screen);
  if (size < MIN_CHARS || size > limits.chars || blocks.length > limits.blocks) return null;
  if (!isIsoDay(reading.basis)) return null;
  return { text, blocks, basis: reading.basis, generatedAt: reading.generatedAt || null };
}
