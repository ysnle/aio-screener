// A cached or weekly artifact is kept or read by comparing what defined it with what defines it now: the parameters and
// the source text of the functions that compute it, so any change to them changes the stamp with nothing to bump by hand.
// Pure and synchronous, so the producer (Node) and the screen (browser) get the same value from the same module source.
const canonical = (value) => {
  if (typeof value === 'function') return `fn:${String(value).replace(/\s+/g, ' ').trim()}`; // line endings and indentation do not count
  if (typeof value === 'number') return String(value); // Infinity stays 'Infinity' (JSON would write null)
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value ?? null);
};

// FNV-1a and a djb2 variant side by side: a 64-bit-wide stamp without a crypto API.
function hash64(text) {
  let a = 0x811c9dc5, b = 5381;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = (Math.imul(b, 33) ^ code) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

/** `<name>:<16 hex>` over the canonical form of `spec` (objects with sorted keys, functions by their source text). */
export const definitionFingerprint = (name, spec) => `${name}:${hash64(canonical(spec))}`;
