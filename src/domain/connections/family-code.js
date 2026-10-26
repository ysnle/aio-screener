// v58.82 (owner 2026-10-26): a person's shared-AI family code, kept in this browser and sent only to the AIO Worker.
export const FAMILY_CODE_STORAGE_KEY = 'aio_family_code';
export const FAMILY_CODE_MIN_LENGTH = 12;

export function normalizeFamilyCode(value) {
  return String(value ?? '').normalize('NFKC').trim();
}

export function readFamilyCode(storage) {
  try { return normalizeFamilyCode(storage?.getItem(FAMILY_CODE_STORAGE_KEY)); } catch { return ''; }
}
