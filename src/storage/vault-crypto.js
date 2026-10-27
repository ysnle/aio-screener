// v59.30 (roadmap 11, vault): the AioVault cryptography as pure functions — PBKDF2-SHA256 key derivation, AES-GCM
// encryption and decryption of one value, and the stored envelope ('aio_enc::' + base64 of v2 [magic4|iv12|salt16|ct]
// or v1 [iv12|salt16|ct]). The vault object itself stays the lexical `const _AioVault` in js/aio-core.js (P1350: it is
// not a window property); its methods call these through window._aioVaultCrypto and keep their generation checks.
// The KDF version, iteration counts and magic stay declared in js/aio-core.js and are passed in.
export async function deriveVaultKey(pin, salt, iterations) {
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

/** Resolves to { iv, ciphertext } for one plaintext under `key`, with a fresh 12-byte IV. */
export async function encryptVaultBytes(key, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
  return { iv, ciphertext };
}

/** The v2 stored form of one encrypted value. */
export function packVaultEnvelope(magic, iv, salt, ciphertext) {
  const buf = new Uint8Array(4 + 12 + 16 + ciphertext.byteLength);
  buf.set(magic, 0); buf.set(iv, 4); buf.set(salt, 16); buf.set(new Uint8Array(ciphertext), 32);
  return 'aio_enc::' + btoa(String.fromCharCode.apply(null, buf));
}

/** { isV2, iv, ciphertext } for a stored value; throws on a value that is not base64. */
export function parseVaultEnvelope(stored, magic) {
  const raw = atob(stored.slice(9));
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  const isV2 = buf.length >= 36 && magic.every((value, index) => buf[index] === value);
  return { isV2, iv: isV2 ? buf.slice(4, 16) : buf.slice(0, 12), ciphertext: isV2 ? buf.slice(32) : buf.slice(28) };
}

export async function decryptVaultBytes(key, iv, ciphertext) {
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext));
}

export function installVaultCrypto(window = globalThis) {
  window._aioVaultCrypto = Object.freeze({ deriveVaultKey, encryptVaultBytes, packVaultEnvelope, parseVaultEnvelope, decryptVaultBytes });
  return window;
}
