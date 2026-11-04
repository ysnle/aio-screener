// One opener for a theme link. A KRX listing's theme ids come from KR_THEME_MAP and open the Korean theme detail;
// every other id opens the US THEME_MAP detail. Routing by id alone sent a Korean stock's theme links to
// showThemeDetail, which opened the US theme where the ids collide (defense, crypto, quantum, space) and did
// nothing for the rest.
import { themeMarketOf } from '../../domain/scenarios/theme-stage.js';

// v59.70: the old #theme-detail address (#theme-detail/<id>, ?theme=<id> or ?id=<id>) names a US THEME_MAP theme.
// resolveInitialRoute ignored the id and fell back to the first theme, so every old link opened 방산. A retired or
// unknown id opens the theme list (themeId null); other query keys (knowledgeNode) are not an id.
const THEME_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

/** { themeId } for an old #theme-detail address, null for any other address. */
export function legacyThemeDetailTarget(hash, themeIds = null) {
  const match = String(hash || '').match(/^#theme-detail(?:\/([^?]*))?(?:\?(.*))?$/);
  if (!match) return null;
  const params = new URLSearchParams(match[2] || '');
  let raw = match[1] || params.get('theme') || params.get('id') || '';
  try { raw = decodeURIComponent(raw); } catch (_) { /* keep the raw id */ }
  const id = String(raw).trim();
  const known = !themeIds || (themeIds instanceof Set ? themeIds.has(id) : themeIds.includes(id));
  const themeId = id && THEME_ID.test(id) && known ? id : null;
  return { requested: true, named: !!id, themeId, unknown: !!id && !themeId };
}

/**
 * Applies an old #theme-detail address to the pending theme: the address's id wins, a retired or unknown id clears it
 * (the list opens). The classic showPage('theme-detail') rewrites the address to #themes before this module runs, so it
 * leaves the original in root._aioThemeDetailHash; that copy is read once.
 */
export function applyLegacyThemeDetailAddress(root, hash = root?.location?.hash) {
  const saved = root?._aioThemeDetailHash;
  if (saved != null) { try { delete root._aioThemeDetailHash; } catch (_) { /* frozen root */ } }
  const themeIds = Array.isArray(root?.THEME_MAP) ? root.THEME_MAP.map((theme) => String(theme?.id || '')) : null;
  const target = legacyThemeDetailTarget(saved || hash, themeIds);
  if (!target?.named) return target;
  try { if (target.themeId) root._aioOpenThemeDetailOnThemes = target.themeId; else delete root._aioOpenThemeDetailOnThemes; } catch (_) { /* frozen root */ }
  return target;
}

export function openThemeDetail(root, themeId, { symbol = '', market = null } = {}) {
  if ((market || themeMarketOf(symbol)) === 'KR') {
    return typeof root?.openKrThemeDetail === 'function' ? root.openKrThemeDetail(themeId) !== false : false;
  }
  if (typeof root?.showThemeDetail !== 'function') return false;
  root.showThemeDetail(themeId);
  return true;
}
