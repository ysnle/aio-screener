// Keep drafts through bookmark changes and asynchronous page re-renders.
// They are session-local and never sent to a provider.
const draftsByLearning = new WeakMap();

function element(documentRef, tag, className, text = '') {
  const node = documentRef.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function createKnowledgeLearningControls(documentRef, { learning, itemId, label = '선택한 학습 항목', onChange = () => {} } = {}) {
  const snapshot = learning?.snapshot?.() || { bookmarks: [], notes: {} };
  const bookmarked = Boolean(itemId && snapshot.bookmarks?.includes(itemId));
  const savedNote = itemId ? snapshot.notes?.[itemId]?.value || '' : '';
  let drafts = null;
  if (learning && typeof learning === 'object') {
    drafts = draftsByLearning.get(learning);
    if (!drafts) { drafts = new Map(); draftsByLearning.set(learning, drafts); }
  }
  const section = element(documentRef, 'section', 'knowledge-learning-controls');
  section.setAttribute('aria-label', '학습 기록');
  const header = element(documentRef, 'div', 'knowledge-learning-controls-header');
  header.append(element(documentRef, 'strong', 'knowledge-learning-controls-title', '내 학습 기록'), element(documentRef, 'span', 'knowledge-learning-controls-label', label));
  const bookmark = element(documentRef, 'button', `knowledge-learning-bookmark${bookmarked ? ' is-active' : ''}`, bookmarked ? '★ 북마크됨' : '☆ 북마크');
  bookmark.type = 'button';
  bookmark.setAttribute('aria-pressed', bookmarked ? 'true' : 'false');
  bookmark.disabled = !itemId;
  bookmark.addEventListener('click', () => {
    learning?.toggleBookmark?.(itemId);
    onChange();
  });
  header.appendChild(bookmark);
  const noteLabel = element(documentRef, 'label', 'knowledge-learning-note-label', '개인 메모');
  const textarea = element(documentRef, 'textarea', 'knowledge-learning-note');
  textarea.value = drafts?.get(itemId) ?? savedNote;
  textarea.addEventListener('input', () => {
    if (!itemId || !drafts) return;
    if (drafts.size >= 100 && !drafts.has(itemId)) drafts.delete(drafts.keys().next().value);
    drafts.set(itemId, textarea.value);
  });
  textarea.placeholder = '이 개념에서 기억할 점이나 다음 확인 항목';
  textarea.setAttribute('aria-label', `${label} 개인 메모`);
  textarea.maxLength = 1000;
  textarea.disabled = !itemId;
  noteLabel.appendChild(textarea);
  const save = element(documentRef, 'button', 'knowledge-learning-note-save', '메모 저장');
  save.type = 'button';
  save.disabled = !itemId;
  save.addEventListener('click', () => {
    learning?.setNote?.(itemId, textarea.value);
    drafts?.delete(itemId);
    onChange();
  });
  const status = element(documentRef, 'p', 'knowledge-learning-save-status',
    snapshot.persistence === 'memory-only' ? '브라우저 저장소를 사용할 수 없어 기록은 현재 화면 세션에만 유지됩니다. 중요한 메모는 별도로 복사해 주세요.'
      : snapshot.persistence === 'saved' ? '이 브라우저에 저장되었습니다.' : '저장한 기록은 이 브라우저에 보관됩니다.');
  status.setAttribute('role', 'status');
  section.append(header, noteLabel, save, status);
  return section;
}
