export const NEWS_CLAIM_MODEL_VERSION = 'news-claim.v1';

export function deriveNewsClaim({ title = '', source = null, url = null, observedAt = null, inputVersion = 'unknown' } = {}) {
  const safeTitle = String(title || '').trim();
  return Object.freeze({ modelVersion: NEWS_CLAIM_MODEL_VERSION, inputVersion, status: safeTitle && source ? 'current' : 'partial', claim: safeTitle || null, source: source || null, url: /^https:\/\//i.test(String(url || '')) ? String(url) : null, observedAt: observedAt || null });
}
