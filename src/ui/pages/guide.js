import { createResourceBag } from '../../app/lifecycle.js';
import { deriveTradingScoreComponents } from '../../domain/signal/trading-score.js';
import { CAPABILITY_MANIFEST_VERSION, auditCapabilityClaims } from '../../domain/content/capability-manifest.js';

function closestAction(element, selector) {
  return element?.closest?.(selector) || null;
}

function openAncestors(element) {
  let node = element?.parentElement || null;
  while (node) {
    if (node.tagName === 'DETAILS') node.open = true;
    if (node.matches?.('.aio-explain, .explain-section')) node.classList.add('is-open');
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
  label.textContent = match.label || `검색 결과 ${index + 1}`;
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
  let nextId = 0;
  let node;
  while ((node = walker.nextNode())) {
    const text = String(node.nodeValue || '').trim();
    if (text.length <= 2 || !text.toLowerCase().includes(normalized)) continue;
    if (result.contains(node) || node.parentElement?.closest?.('script, style, template, [hidden], [aria-hidden="true"]')) continue;
    // Match the paragraph rather than jumping to the whole page's nearest id.
    const element = node.parentElement?.closest?.('p, li, td, dd, dt, h2, h3, h4') || node.parentElement;
    if (!element || seen.has(element)) continue;
    if (!element.id) {
      while (documentRef.getElementById(`guide-match-${nextId}`)) nextId++;
      element.id = `guide-match-${nextId++}`;
    }
    seen.add(element);
    const container = element.closest?.('.explain-section, .aio-explain, section, article') || element;
    const labelElement = container.querySelector?.('.explain-label, .aio-explain-trigger-label span:last-child, h2, h3');
    const offset = Math.max(0, text.toLowerCase().indexOf(normalized) - 25);
    matches.push({ element, label: labelElement?.textContent?.trim()?.slice(0, 60) || '', text: text.slice(offset, offset + 100) });
    if (matches.length >= 10) break;
  }
  if (!matches.length) {
    const empty = documentRef.createElement('span');
    empty.style.color = 'var(--data-amber)';
    empty.textContent = `“${keyword}” 검색 결과가 없습니다.`;
    result.appendChild(empty);
  } else {
    const summary = documentRef.createElement('strong');
    summary.style.color = 'var(--data-green)';
    summary.textContent = `${matches.length === 10 ? '최대 ' : ''}${matches.length}건 · 선택하면 해당 내용으로 이동합니다.`;
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
      const result = documentRef?.getElementById('guide-search-result');
      result?.setAttribute('role', 'status');
      result?.setAttribute('aria-live', 'polite');
      if (!guidePage) return () => bag.dispose();
      const scoreExplanation = guidePage.querySelector('#guide-score-components');
      if (scoreExplanation) scoreExplanation.textContent = `${deriveTradingScoreComponents().map(({ label, weight }) => `${label} ${weight}%`).join(' · ')}. 필수 입력이 부족하면 종합 판정을 보류합니다. 가중 합산 뒤 보정이 적용될 수 있으며 점수는 매매 승인이나 수익 확률이 아닙니다.`;
      guidePage.dataset.aioArchitectureRoute = 'guide';
      guidePage.dataset.aioArchitectureRenderer = 'native';
      guidePage.dataset.aioCapabilityManifest = CAPABILITY_MANIFEST_VERSION;
      const capabilityAudit = auditCapabilityClaims({ documentRef: guidePage });
      guidePage.dataset.aioCapabilityAudit = capabilityAudit.ok ? 'pass' : 'blocked';
      const capabilityStatus = documentRef?.getElementById('guide-capability-status');
      if (capabilityStatus) {
        capabilityStatus.dataset.aioCapabilityStatus = capabilityAudit.ok ? 'pass' : 'blocked';
        capabilityStatus.textContent = capabilityAudit.ok
          ? `기능 범위 검증 통과 · ${capabilityAudit.checkedCount}/${capabilityAudit.capabilityCount} 항목`
          : `기능 범위 확인 필요 · ${capabilityAudit.issues.length}건`;
      }
      const jump = (targetId) => {
        const target = documentRef.getElementById(targetId);
        if (!target) return searchGuide(documentRef, guidePage, result, String(targetId || '').replace(/^guide-/, ''), jump);
        openAncestors(target);
        target.classList?.add('is-open');
        target.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
        if (!target.hasAttribute('tabindex')) {
          target.setAttribute('tabindex', '-1');
          target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
        }
        target.focus?.({ preventScroll: true });
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
      input?.addEventListener('keydown', onInputKeydown);
      guidePage.addEventListener('click', onTriggerClick);
      bag.add(() => input?.removeEventListener('keydown', onInputKeydown));
      bag.add(() => guidePage.removeEventListener('click', onTriggerClick));
      bag.add(() => {
        if (guidePage.dataset.aioArchitectureRoute === 'guide') delete guidePage.dataset.aioArchitectureRoute;
        if (guidePage.dataset.aioArchitectureRenderer === 'native') delete guidePage.dataset.aioArchitectureRenderer;
        delete guidePage.dataset.aioCapabilityManifest;
        delete guidePage.dataset.aioCapabilityAudit;
        if (capabilityStatus) {
          delete capabilityStatus.dataset.aioCapabilityStatus;
          capabilityStatus.textContent = '기능 범위 검증 대기';
        }
      });
      return () => bag.dispose();
    }
  };
}
