import { SCREENER_CONTRACT_VERSION, createScreenDefinition, stableHash, validateScreenDefinition } from '../../data/contracts/screener.js';

export const SAVED_SCREEN_SCHEMA_VERSION = 2;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function migrateSavedScreen(value = {}, fromVersion = 1) {
  let current = clone(value) || {};
  if (fromVersion < 2) {
    current = {
      ...current,
      schemaVersion: SAVED_SCREEN_SCHEMA_VERSION,
      definition: current.definition || current
    };
  }
  const definition = createScreenDefinition({ ...(current.definition || {}), screenId: current.definition?.screenId || `saved-${stableHash(current.definition || current)}` });
  return Object.freeze({ schemaVersion: SAVED_SCREEN_SCHEMA_VERSION, savedId: String(current.savedId || `saved-${definition.screenId}`), label: String(current.label || definition.name), definition });
}

export function createSavedScreen(input = {}) {
  const definition = input.definition?.schemaVersion === SCREENER_CONTRACT_VERSION ? input.definition : createScreenDefinition(input.definition || input);
  const validation = validateScreenDefinition(definition);
  if (!validation.ok) throw new Error(`SAVED_SCREEN_INVALID:${validation.errors.join(',')}`);
  return migrateSavedScreen({ ...input, definition }, SAVED_SCREEN_SCHEMA_VERSION);
}

export function createSavedScreenCollection(values = []) {
  const screens = (Array.isArray(values) ? values : []).map((value) => createSavedScreen(value));
  const seen = new Set();
  const unique = screens.filter((screen) => {
    if (seen.has(screen.definition.screenId)) return false;
    seen.add(screen.definition.screenId);
    return true;
  });
  return Object.freeze(unique);
}

export function exportSavedScreen(screen) {
  const saved = createSavedScreen(screen);
  // Only the definition is exported. Credentials/provider keys are not part
  // of ScreenDefinition and therefore cannot leak into a share payload.
  return JSON.stringify({ schemaVersion: SAVED_SCREEN_SCHEMA_VERSION, savedId: saved.savedId, label: saved.label, definition: saved.definition });
}

export function importSavedScreen(serialized) {
  if (typeof serialized !== 'string' || serialized.length > 200_000) throw new Error('SAVED_SCREEN_PAYLOAD_INVALID');
  let parsed;
  try { parsed = JSON.parse(serialized); } catch (_) { throw new Error('SAVED_SCREEN_JSON_INVALID'); }
  return createSavedScreen(migrateSavedScreen(parsed, Number(parsed.schemaVersion || 1)));
}

function base64UrlEncode(text) {
  if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(text))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return Buffer.from(text, 'utf8').toString('base64url');
}

function base64UrlDecode(text) {
  if (typeof atob === 'function') return decodeURIComponent(escape(atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - text.length % 4) % 4))));
  return Buffer.from(text, 'base64url').toString('utf8');
}

export function encodeScreenSharePayload(screen) { return `scr1.${base64UrlEncode(exportSavedScreen(screen))}`; }
export function decodeScreenSharePayload(payload) {
  const value = String(payload || '');
  if (!value.startsWith('scr1.')) throw new Error('SCREEN_SHARE_VERSION_UNSUPPORTED');
  return importSavedScreen(base64UrlDecode(value.slice(5)));
}

export function findSavedScreen(screens, screenId) {
  return (Array.isArray(screens) ? screens : []).find((screen) => screen.definition?.screenId === screenId || screen.savedId === screenId) || null;
}

