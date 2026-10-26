import { FAMILY_CODE_MIN_LENGTH, FAMILY_CODE_STORAGE_KEY, normalizeFamilyCode } from '../../domain/connections/family-code.js';

// Same shape the Worker accepts (12+ characters, no spaces or commas); loaded with the form, not at boot.
export function saveFamilyCode(storage, value) {
  const code = normalizeFamilyCode(value);
  if (code.length < FAMILY_CODE_MIN_LENGTH || code.length > 128 || /[\s,]/.test(code)) return { ok: false, reason: 'invalid' };
  try { storage.setItem(FAMILY_CODE_STORAGE_KEY, code); return { ok: true, code }; } catch { return { ok: false, reason: 'storage' }; }
}

// The code-entry form under a "family code required" chat notice. Built with DOM APIs (no HTML strings).
export function attachFamilyCodeForm(container, { documentRef, storage, onSaved } = {}) {
  if (!container || !documentRef?.createElement) return null;
  const form = documentRef.createElement('form');
  form.className = 'aio-family-code-form';
  const input = documentRef.createElement('input');
  input.type = 'password'; input.autocomplete = 'off'; input.spellcheck = false;
  input.setAttribute('aria-label', '가족 코드');
  input.placeholder = '가족 코드';
  const button = documentRef.createElement('button');
  button.type = 'submit'; button.textContent = '코드 저장';
  const status = documentRef.createElement('div');
  status.setAttribute('role', 'status');
  form.append(input, button, status);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const saved = saveFamilyCode(storage, input.value);
    if (!saved.ok) {
      status.textContent = saved.reason === 'storage' ? '이 브라우저에 저장하지 못했습니다. 개인 정보 보호 모드인지 확인해 주세요.' : '코드를 다시 확인해 주세요. 받은 코드를 공백 없이 그대로 넣어 주세요.';
      return;
    }
    input.value = '';
    status.textContent = '저장했습니다. 질문을 다시 보내 주세요.';
    onSaved?.(saved.code);
  });
  container.appendChild(form);
  return form;
}
