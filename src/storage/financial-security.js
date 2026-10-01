// P1350: shared Vault authentication, financial-section migration and AI input semantics.
export const VERIFY_KEY = 'aio_vault_verify_v1';
const VERIFY_TEXT = 'AIO Vault authenticated v1';
export const PERSONAL_KEYS = Object.freeze(['aio_portfolio_data', 'aio_portfolio_ledger', 'aio_portfolio_fx_legs']);
const encrypted = (value) => typeof value === 'string' && value.startsWith('aio_enc::');
const cancelled = () => new Error('vault-operation-cancelled');
const generationOf = (vault) => Number.isSafeInteger(vault._generation) ? vault._generation : 0;
function assertCurrent(vault, generation) {
  if (generationOf(vault) !== generation) throw cancelled();
}

export async function authenticateVault(vault, pin, { storage, saltStorage, sensitiveKeys = [] } = {}) {
  vault.lock();
  const generation = generationOf(vault);
  vault._authenticating = true;
  let existing, verify;
  try {
    existing = saltStorage.getItem('aio_vault_salt');
    verify = storage.getItem(VERIFY_KEY);
    const ciphertexts = sensitiveKeys.map((key) => storage.getItem(key)).filter(encrypted);
    if (existing && !verify && !ciphertexts.length) throw new Error('vault-auth-evidence-missing');
    if (existing) {
      vault._salt = Uint8Array.from(atob(existing), (char) => char.charCodeAt(0));
      if (vault._salt.length !== 16) throw new Error('vault-salt-invalid');
    } else {
      if (verify || ciphertexts.length) throw new Error('vault-salt-missing');
      vault._salt = crypto.getRandomValues(new Uint8Array(16));
    }
    const derivedKey = await vault.deriveKey(pin, vault._salt, 310000);
    assertCurrent(vault, generation);
    vault._derivedKey = derivedKey;
    const legacyDerivedKey = await vault.deriveKey(pin, vault._salt, 100000);
    assertCurrent(vault, generation);
    vault._legacyDerivedKey = legacyDerivedKey;
    if (verify) {
      if (!encrypted(verify)) throw new Error('vault-auth-failed');
      const authenticated = await vault.decrypt(verify);
      assertCurrent(vault, generation);
      if (authenticated !== VERIFY_TEXT) throw new Error('vault-auth-failed');
    }
    for (const raw of ciphertexts) {
      const decrypted = await vault.decrypt(raw);
      assertCurrent(vault, generation);
      if (decrypted === null) throw new Error('vault-auth-failed');
    }
    if (!verify) {
      const sentinel = await vault.encrypt(VERIFY_TEXT);
      assertCurrent(vault, generation);
      storage.setItem(VERIFY_KEY, sentinel);
      if (storage.getItem(VERIFY_KEY) !== sentinel) throw new Error('vault-auth-persist-failed');
    }
    if (!existing) {
      const salt = btoa(String.fromCharCode(...vault._salt));
      saltStorage.setItem('aio_vault_salt', salt);
      if (saltStorage.getItem('aio_vault_salt') !== salt) throw new Error('vault-salt-persist-failed');
    }
    vault._pin = pin;
    vault._authenticating = false;
    return true;
  } catch (error) {
    // P1350: a cancelled authentication must not write the old origin or lock a newer unlock.
    if (generationOf(vault) !== generation) throw cancelled();
    if (!existing && !verify) { try { storage.removeItem(VERIFY_KEY); saltStorage.removeItem('aio_vault_salt'); } catch (_) {} }
    vault.lock();
    throw error;
  }
}

export async function migrateVault(vault, { storage, sensitiveKeys = [], personalOptedOut = false } = {}) {
  if (!vault.isUnlocked()) throw new Error('vault-locked');
  const generation = generationOf(vault);
  const originals = {}, replacements = {};
  try {
    for (const key of sensitiveKeys) {
      if (personalOptedOut && PERSONAL_KEYS.includes(key)) continue;
      const value = storage.getItem(key);
      if (value && !encrypted(value)) originals[key] = value;
    }
    for (const [key, value] of Object.entries(originals)) {
      const replacement = await vault.encrypt(value);
      assertCurrent(vault, generation);
      if (!encrypted(replacement)) throw new Error('vault-migration-encryption-failed');
      replacements[key] = replacement;
    }
    for (const [key, value] of Object.entries(originals)) {
      storage.setItem(key, replacements[key]);
      const decrypted = await vault.decrypt(storage.getItem(key));
      assertCurrent(vault, generation);
      if (decrypted !== value) throw new Error('vault-migration-verification-failed');
    }
    Object.assign(vault._keyRuntime, originals);
  } catch (error) {
    // Cancellation leaves any already-encrypted private section protected; it never restores plaintext after a mode switch.
    if (generationOf(vault) !== generation) throw cancelled();
    for (const [key, value] of Object.entries(originals)) { try { storage.setItem(key, value); } catch (_) {} }
    vault.lock();
    throw error;
  }
}

export async function restorePortfolioVault(vault, { storage, readDecrypted } = {}) {
  if (!vault.isUnlocked()) throw new Error('vault-locked');
  const generation = generationOf(vault);
  const restored = {};
  for (const key of PERSONAL_KEYS) {
    const raw = storage.getItem(key);
    if (!raw) continue;
    const value = encrypted(raw) ? await readDecrypted(key, null) : raw;
    assertCurrent(vault, generation);
    if (encrypted(raw) && !value) throw new Error('vault-auth-failed');
    restored[key] = value;
  }
  Object.assign(vault._keyRuntime, restored);
}

function finite(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function redactPortfolioForAI(positions, { liveData = {}, now = Date.now(), maxAgeMs = 7 * 86400000 } = {}) {
  const rows = Array.isArray(positions) ? positions.filter((row) => row?.ticker) : [];
  const observations = rows.map((row) => {
    const quote = liveData[row.ticker] || {};
    const price = finite(quote.price), qty = finite(row.qty), cost = finite(row.cost);
    const currency = String(quote.currency || quote.quoteCurrency || '').trim().toUpperCase();
    // Retrieval time cannot stand in for the price's observation time.
    const rawTime = quote.observedAt || quote.asOf;
    const calendar = typeof rawTime === 'string' && rawTime.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/);
    const calendarMs = calendar ? Date.UTC(Number(calendar[1]), Number(calendar[2]) - 1, Number(calendar[3])) : NaN;
    const validCalendar = Number.isFinite(calendarMs) && new Date(calendarMs).toISOString().slice(0, 10) === rawTime.slice(0, 10);
    const time = validCalendar ? Date.parse(rawTime) : NaN;
    const validAge = Number.isFinite(now) && Number.isFinite(maxAgeMs) && maxAgeMs >= 0
      && Number.isFinite(time) && time <= now && now - time <= maxAgeMs;
    const date = validAge ? new Date(time).toISOString().slice(0, 10) : null;
    const usable = quote.stale !== true && !/^(?:stale|failed|missing|blocked|unknown)$/i.test(String(quote.status || ''))
      && price != null && price > 0 && qty != null && qty > 0 && /^[A-Z]{3}$/.test(currency) && date != null;
    const costCurrency = String(row.costCurrency || '').trim().toUpperCase();
    const rawReturn = usable && cost != null && cost > 0 && costCurrency === currency ? (price - cost) / cost * 100 : null;
    return { quote, price, qty, currency, date, value: usable ? price * qty : null,
      returnPct: Number.isFinite(rawReturn) ? Number(rawReturn.toFixed(1)) : null };
  });
  const complete = observations.length > 0 && observations.every((item) => item.value != null && Number.isFinite(item.value))
    && new Set(observations.map((item) => item.currency)).size === 1 && new Set(observations.map((item) => item.date)).size === 1;
  const total = complete ? observations.reduce((sum, item) => sum + item.value, 0) : null;
  return rows.map((row, index) => ({ ticker: String(row.ticker).toUpperCase().slice(0, 16),
    sector: String(row.sector || row.industry || 'unknown').slice(0, 48),
    allocationPct: total > 0 && Number.isFinite(total) ? Number((observations[index].value / total * 100).toFixed(1)) : null,
    returnPct: observations[index].returnPct }));
}
