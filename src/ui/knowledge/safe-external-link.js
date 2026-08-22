export function safeExternalHref(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function applySafeExternalLink(anchor, value, { invalidLabel = '출처 확인 필요' } = {}) {
  const href = safeExternalHref(value);
  if (!href) {
    anchor.removeAttribute('href');
    anchor.removeAttribute('target');
    anchor.removeAttribute('rel');
    anchor.setAttribute('aria-disabled', 'true');
    anchor.dataset.externalLinkState = 'invalid';
    if (!anchor.textContent?.trim()) anchor.textContent = invalidLabel;
    return false;
  }
  anchor.href = href;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.removeAttribute('aria-disabled');
  anchor.dataset.externalLinkState = 'safe';
  return true;
}
