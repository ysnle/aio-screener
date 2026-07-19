import { createResourceBag } from '../../app/lifecycle.js';

function closestAction(element, selector) {
  return element?.closest?.(selector) || null;
}

function openAncestors(element) {
  let node = element?.parentElement || null;
  while (node) {
    if (node.tagName === 'DETAILS') node.open = true;
    node = node.parentElement;
  }
}

function createResultItem(documentRef, match, index, onJump) {
  const button = documentRef.createElement('button');
  button.type = 'button';
  button.dataset.guideTarget = match.element.id;
  button.style.cssText = 'display:block;width:100%;margin-top:4px;padding:4px 8px;background:var(--surface-3);border:0;border-radius:4px;cursor:pointer;text-align:left;color:var(--text-primary);';
  const label = documentRef.createElement('strong');
  label.style.color = 'var(--data-cyan)';
  label.textContent = match.label || `Result ${index + 1}`;
  const excerpt = documentRef.createElement('span');
  excerpt.style.cssText = 'color:var(--text-muted);margin-left:6px;';
  excerpt.textContent = `${match.text}...`;
  button.append(label, excerpt);
  button.addEventListener('click', () => onJump(match.element.id));
  return button;
}

function searchGuide(documentRef, guidePage, result, keyword, onJump) {
  if (!result) return;
  const normalized = String(keyword || '').trim().toLowerCase();
  result.replaceChildren();
  if (!normalized) {
    result.style.display = 'none';
    return;
  }
  const matches = [];
  const seen = new Set();
  const walker = documentRef.createTreeWalker(guidePage, 4);
  let node;
  while ((node = walker.nextNode())) {
    const text = String(node.nodeValue || '').trim();
    if (text.length <= 2 || !text.toLowerCase().includes(normalized)) continue;
    const element = node.parentElement?.closest?.('.explain-section, .aio-explain, [id]') || node.parentElement;
    if (!element || seen.has(element)) continue;
    if (!element.id) element.id = `guide-match-${matches.length}`;
    seen.add(element);
    const labelElement = element.querySelector?.('.explain-label, .aio-explain-trigger-label span:last-child, h2, h3');
    matches.push({ element, label: labelElement?.textContent?.trim()?.slice(0, 60) || '', text: text.slice(0, 80) });
    if (matches.length >= 10) break;
  }
  if (!matches.length) {
    const empty = documentRef.createElement('span');
    empty.style.color = 'var(--data-amber)';
    empty.textContent = `No results for "${keyword}"`;
    result.appendChild(empty);
  } else {
    const summary = documentRef.createElement('strong');
    summary.style.color = 'var(--data-green)';
    summary.textContent = `${matches.length} result(s) found - click to jump:`;
    result.appendChild(summary);
    matches.forEach((match, index) => result.appendChild(createResultItem(documentRef, match, index, onJump)));
  }
  result.style.display = 'block';
}

export function createGuidePage({ documentRef } = {}) {
  return {
    route: 'guide',
    mount() {
      const bag = createResourceBag();
      const guidePage = documentRef?.getElementById('page-guide');
      const input = documentRef?.getElementById('guide-search-input');
      const trigger = documentRef?.querySelector?.('[data-action="_aioGuideSearchTrigger"]');
      const result = documentRef?.getElementById('guide-search-result');
      if (!guidePage) return () => bag.dispose();
      guidePage.dataset.aioArchitectureRoute = 'guide';
      guidePage.dataset.aioArchitectureRenderer = 'native';
      const jump = (targetId) => {
        const target = documentRef.getElementById(targetId);
        if (!target) return searchGuide(documentRef, guidePage, result, String(targetId || '').replace(/^guide-/, ''), jump);
        openAncestors(target);
        target.classList?.add('is-open');
        target.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      };
      const onSearch = () => searchGuide(documentRef, guidePage, result, input?.value, jump);
      const onTriggerClick = (event) => {
        const action = closestAction(event.target, '[data-action]');
        if (!action || !guidePage.contains(action)) return;
        const name = action.getAttribute('data-action');
        if (name !== '_aioGuideSearchTrigger' && name !== '_aioGuideJump') return;
        event.preventDefault();
        event.stopPropagation();
        if (name === '_aioGuideSearchTrigger') onSearch();
        else jump(action.getAttribute('data-arg'));
      };
      const onInputKeydown = (event) => { if (event.key === 'Enter') onSearch(); };
      trigger?.addEventListener('click', onSearch);
      input?.addEventListener('keydown', onInputKeydown);
      guidePage.addEventListener('click', onTriggerClick);
      bag.add(() => trigger?.removeEventListener('click', onSearch));
      bag.add(() => input?.removeEventListener('keydown', onInputKeydown));
      bag.add(() => guidePage.removeEventListener('click', onTriggerClick));
      bag.add(() => {
        if (guidePage.dataset.aioArchitectureRoute === 'guide') delete guidePage.dataset.aioArchitectureRoute;
        if (guidePage.dataset.aioArchitectureRenderer === 'native') delete guidePage.dataset.aioArchitectureRenderer;
      });
      return () => bag.dispose();
    }
  };
}
