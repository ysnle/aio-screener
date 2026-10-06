import { createResourceBag } from '../../app/lifecycle.js';
import { GUIDE_SCREEN_TEXT } from '../../domain/content/guide-screens.js';
import { ROUTE_HUBS } from '../navigation/route-hubs.js';
import { RULES } from '../../domain/rules/thresholds.js';
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

// P1428: the 화면 안내 is drawn from ROUTE_HUBS (the menu's own table) so it cannot describe retired screens.
function renderScreenCards(documentRef) {
  const host = documentRef?.getElementById('guide-screen-cards');
  if (!host) return;
  host.replaceChildren(...ROUTE_HUBS.map((hub) => {
    const text = GUIDE_SCREEN_TEXT[hub.id] || {};
    const card = documentRef.createElement('article');
    card.className = 'guide-screen';
    card.dataset.hub = hub.id;
    const title = documentRef.createElement('h3');
    title.className = 'guide-screen-title';
    title.textContent = hub.label;
    const question = documentRef.createElement('p');
    question.className = 'guide-screen-question';
    question.textContent = text.question || '';
    const tabs = documentRef.createElement('div');
    tabs.className = 'guide-screen-tabs';
    hub.routes.filter((route) => route.tab !== false).forEach((route) => {
      const button = documentRef.createElement('button');
      button.type = 'button';
      button.className = 'aio-btn-table';
      button.dataset.action = 'showPage';
      button.dataset.arg = route.id;
      button.textContent = route.label;
      tabs.append(button);
    });
    card.append(title, question, tabs);
    return card;
  }));
}

// P1428 + owner 2026-10-04: the guide's judgement section is the rule table itself, generated from the
// registry every verdict uses — numbers a user can check against the screen, not prose about them.
// Codex review 2026-10-05: every 부담 rule fires on any one condition, so those cells join with 또는;
// a "·" there read as "all of these" (HY 324bp + 5일 +44bp looked like it should not be 부담).
const anyOf = (text) => text.replace(/ · /g, ' 또는 ');
export function guideRuleRows(R = RULES) {
  return guideRuleRowsRaw(R).map(([area, metric, favorable, burden, basis]) => [area, metric, favorable, burden === '—' ? burden : anyOf(burden), basis]);
}

function guideRuleRowsRaw(R) {
  return [
    ['시장 상태', '추세 (S&P 500)', `오르는 ${R.trend.maShort}일선 위 · ${R.trend.maShort}일선 > ${R.trend.maLong}일선`, `${R.trend.maLong}일선 아래 또는 하락하는 ${R.trend.maShort}일선 아래`, '이동평균 추세'],
    ['시장 상태', `시장 폭 (${R.trend.maShort}·${R.trend.maLong}일선 위 종목 비율)`, `둘 다 ${R.breadth.broadAtLeast}% 이상`, `하나라도 ${R.breadth.weakBelow}% 미만`, '참여 폭'],
    ['시장 상태', '변동성 (VIX · VIX/3개월)', `VIX ${R.volatility.calmBelow} 미만 · 비율 ${R.volatility.calmRatioBelow} 미만`, `VIX ${R.volatility.stressAt} 이상 · 비율 ${R.volatility.invertedRatioAt} 이상 · 5일 +${R.volatility.spike5dPct}%`, '기간 구조 역전'],
    ['시장 상태 · 금리', '10년물 20일 변화', `−${R.rates.move20dBp}bp 이하`, `+${R.rates.move20dBp}bp 이상 · 1년 범위 ${R.rates.rangeHighAt * 100}% 위에서 상승`, '할인율'],
    ['시장 상태 · 신용', '하이일드 스프레드 (ICE BofA)', `${R.credit.tightBelowBp}bp 미만 · 5일 축소`, `${R.credit.stressAtBp}bp 이상 · 5일 +${R.credit.widen5dBp}bp`, '신용 스트레스'],
    ['시장 상태', '유가 · 달러 (20일)', `WTI ${R.oil.fall20dPct}% 이하 · 달러 하락`, `WTI +${R.oil.rise20dPct}% · 1년 범위 ${R.oil.rangeHighAt * 100}% · 달러 +${R.dollar.rise20dPct}%`, '물가·금융 여건'],
    ['한국 참고', '원/달러 · 엔/달러 (20일)', `원/달러 −${R.fx.krwMove20dPct}% 이하`, `원/달러 +${R.fx.krwMove20dPct}% · 엔 ${R.fx.yenRally20dPct}% 이상 강세`, '2024년 8월 엔 캐리 청산'],
    ['거시 · 성장', 'Sahm 지표 · 일자리 3개월 평균', `Sahm ${R.growth.sahmWatchAt}%p 미만 · ${R.growth.payrollSolidK / 10}만 명 이상`, `Sahm ${R.growth.sahmRecessionAt}%p 이상 · 3개월 평균 감소`, 'Sahm (2019)'],
    ['거시 · 물가', '근원 PCE (전년 대비 · 3개월 속도)', `${R.inflation.nearTargetPct}% 이하 · 속도 둔화`, `${R.inflation.missPct}% 이상 · 속도 +${R.inflation.reaccelPp}%p 재가속`, `FOMC 목표 ${R.inflation.targetPct}%`],
    ['거시 · 정책', '2년물 − 기준금리 · 실질 기준금리', `−${R.policy.pricedMovePp}%p 이하`, `+${R.policy.pricedMovePp}%p 이상 · 실질 ${R.policy.restrictiveRealPct}% 이상`, 'FOMC 장기 금리 전망'],
    ['투자 심리', 'CNN 공포·탐욕', '—', '—', `극단 공포 <${R.fearGreed.extremeFearBelow} · 공포 <${R.fearGreed.fearBelow} · 탐욕 >${R.fearGreed.greedAbove} · 극단 탐욕 >${R.fearGreed.extremeGreedAbove}`]
  ];
}

function renderRulesTable(documentRef) {
  const body = documentRef?.getElementById('guide-rules-table');
  if (!body) return;
  body.replaceChildren(...guideRuleRows().map((cells) => {
    const tr = documentRef.createElement('tr');
    cells.forEach((cell, index) => {
      const td = documentRef.createElement('td');
      td.textContent = cell;
      if (index === 2) td.className = 'is-favorable';
      if (index === 3) td.className = 'is-burden';
      tr.append(td);
    });
    return tr;
  }));
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
      renderScreenCards(documentRef);
      renderRulesTable(documentRef);
      guidePage.dataset.aioArchitectureRoute = 'guide';
      guidePage.dataset.aioArchitectureRenderer = 'native';
      guidePage.dataset.aioCapabilityManifest = CAPABILITY_MANIFEST_VERSION;
      const capabilityAudit = auditCapabilityClaims({ documentRef: guidePage });
      guidePage.dataset.aioCapabilityAudit = capabilityAudit.ok ? 'pass' : 'blocked';
      const capabilityStatus = documentRef?.getElementById('guide-capability-status');
      if (capabilityStatus) {
        capabilityStatus.dataset.aioCapabilityStatus = capabilityAudit.ok ? 'pass' : 'blocked';
        // P1428: a passing content audit is not shown as '검증 통과 n/n' (it read as a quality certificate);
        // only a failure surfaces, as an operator note.
        capabilityStatus.hidden = capabilityAudit.ok;
        capabilityStatus.textContent = capabilityAudit.ok ? '' : `안내 문구 점검 필요 · ${capabilityAudit.issues.length}건`;
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
          capabilityStatus.textContent = '';
          capabilityStatus.hidden = true;
        }
      });
      return () => bag.dispose();
    }
  };
}
