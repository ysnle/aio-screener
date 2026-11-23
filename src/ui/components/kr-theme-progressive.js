export function ensureKrThemeProgressive({ documentRef = globalThis.document } = {}) {
  const container = documentRef?.getElementById?.('kr-theme-container');
  if (!container || documentRef.getElementById('kr-theme-more')) return;
  container.classList.add('aio-theme-progressive');
  const button = documentRef.createElement('button');
  button.id = 'kr-theme-more';
  button.className = 'aio-btn-table aio-comp-more';
  button.type = 'button';
  button.textContent = '테마 더 보기';
  button.addEventListener('click', () => {
    const expanded = container.classList.toggle('is-expanded');
    button.textContent = expanded ? '핵심 테마만 보기' : '테마 더 보기';
  });
  container.insertAdjacentElement('afterend', button);
}
