// The transient message at the bottom of the screen. It stays long enough to read (longer for longer text), waits while
// the pointer or focus is on it, and a failure is announced at once instead of politely.
export const TOAST_MIN_MS = 2500;
export const TOAST_MAX_MS = 9000;
const FAILURE = /실패|못했|오류|없습니다|초과|차단|잘못|거부|확인해 주세요|다시 시도/;

export function toastDuration(text) {
  return Math.max(TOAST_MIN_MS, Math.min(TOAST_MAX_MS, String(text || '').length * 70));
}
export const toastPriority = (text) => (FAILURE.test(String(text || '')) ? 'assertive' : 'polite');

export function installToast({ root = globalThis, documentRef = root?.document } = {}) {
  if (!documentRef?.body) return;
  // window.showToast (js/aio-workspace.js) stays the entry and hands over here once this module has loaded.
  root._aioToast = (message) => {
    const text = String(message == null ? '' : message).replace(/\S{33,}/g, (word) => `${word.slice(0, 24)}…`).slice(0, 320);
    if (!text) return;
    const toast = documentRef.createElement('div');
    toast.className = 'aio-toast wsl-toast';
    toast.textContent = text;
    documentRef.body.appendChild(toast);
    root._aioAnnounce?.(text, { priority: toastPriority(text) });
    root.requestAnimationFrame(() => { toast.style.opacity = '1'; });
    let timer = 0;
    const leave = () => { toast.style.opacity = '0'; root.setTimeout(() => toast.remove(), 400); };
    const wait = () => { timer = root.setTimeout(leave, toastDuration(text)); };
    toast.addEventListener('pointerenter', () => root.clearTimeout(timer));
    toast.addEventListener('pointerleave', wait);
    wait();
  };
}
