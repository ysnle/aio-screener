// How long a reading may be on its face: blocks of 130–230 characters, at most two, with room for a long proper name. The
// 시장 상태 reading chains five steps (the session, where it gathered, whether it spread, whether the other markets confirm,
// what keeps a rebound going), which two blocks cannot hold, so that screen alone takes a third. One table for the
// producer's validator (reading-core.js) and the screen's gate (src/data/server-screen-readings.js), so the two never
// admit different sizes. Pure and tiny: the gate is on the signal route.
export const READING_LIMITS = Object.freeze({ blocks: 2, chars: 520 });
export const SCREEN_READING_LIMITS = Object.freeze({ signal: Object.freeze({ blocks: 3, chars: 760 }) });

/** { blocks, chars } for a screen id (a per-subject reading or an unknown screen takes the shared limits). */
export const readingLimitsOf = (screen) => SCREEN_READING_LIMITS[screen] || READING_LIMITS;
