// Numeric helper shared by scripts/fetch-data.mjs and the pure blocks split out of it (v57.62).
// One definition so the producer and its lib modules round identically.
export const round = (v, d) => (typeof v === 'number' && isFinite(v)) ? Number(v.toFixed(d)) : null;
