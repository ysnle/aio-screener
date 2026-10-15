// Numeric helper shared by scripts/fetch-data.mjs and the pure blocks split out of it (v57.62).
// One definition so the producer and its lib modules round identically. v57.81: that definition lives with the
// shared price-factor math (src/domain/screener/price-factors.js), so the browser rounds the same way too.
export { round } from '../../src/domain/screener/price-factors.js';
