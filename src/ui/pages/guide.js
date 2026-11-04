import { createResourceBag } from '../../app/lifecycle.js';
import { organizeGuideChapters } from '../components/guide-chapters.js';
import { RULES } from '../../domain/rules/thresholds.js';
import { MACRO_SIGNAL_RULES } from '../../domain/macro/macro-signals.js';
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

// v59.70 (wave2-f S23): the guide's own search box left for the one command search (src/ui/navigation/command-search.js),
// which lists guide paragraphs as one of its groups. The walk that found them stays here, beside the page it reads.
/** Up to `limit` guide paragraphs containing `keyword`: { id, label, text } (each paragraph gets an id to jump to). */
export function findGuideMatches(documentRef, keyword, limit = 10) {
  const guidePage = documentRef?.getElementById?.('page-guide');
  const normalized = String(keyword || '').trim().toLowerCase();
  if (!guidePage || normalized.length < 2) return [];
  const matches = [];
  const seen = new Set();
  const walker = documentRef.createTreeWalker(guidePage, 4);
  let nextId = 0;
  let node;
  while ((node = walker.nextNode())) {
    const text = String(node.nodeValue || '').trim();
    if (text.length <= 2 || !text.toLowerCase().includes(normalized)) continue;
    if (node.parentElement?.closest?.('script, style, template, [hidden], [aria-hidden="true"]')) continue;
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
    matches.push({ id: element.id, label: labelElement?.textContent?.trim()?.slice(0, 60) || '도움말', text: text.slice(offset, offset + 100) });
    if (matches.length >= limit) break;
  }
  return matches;
}

/** Opens the folds around a guide element, scrolls to it and moves focus there. */
export function jumpToGuide(documentRef, targetId) {
  const target = documentRef?.getElementById?.(targetId);
  if (!target) return false;
  openAncestors(target);
  target.classList?.add('is-open');
  target.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  if (!target.hasAttribute('tabindex')) {
    target.setAttribute('tabindex', '-1');
    target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
  }
  target.focus?.({ preventScroll: true });
  return true;
}

// P1428 + owner 2026-10-04: the guide's judgement section is the rule table itself, generated from the
// registry every verdict uses — numbers a user can check against the screen, not prose about them.
// Codex review 2026-10-05: every 부담 rule fires on any one condition, so those cells join with 또는;
// a "·" there read as "all of these" (HY 324bp + 5일 +44bp looked like it should not be 부담).
// Owner 2026-10-23: the cells list conditions with commas, so a burden cell turns its top-level commas (not those inside
// parentheses) into 또는.
const anyOf = (text) => { let depth = 0; let out = ''; for (let i = 0; i < text.length; i += 1) { const c = text[i]; depth += c === '(' ? 1 : c === ')' ? -1 : 0; if (!depth && (text.startsWith(', ', i) || text.startsWith(' · ', i))) { out += ' 또는 '; i += text[i] === ',' ? 1 : 2; } else out += c; } return out; };
export function guideRuleRows(R = RULES) {
  return guideRuleRowsRaw(R).map(([area, metric, favorable, burden, basis]) => [area, metric, favorable, burden === '—' ? burden : anyOf(burden), basis]);
}

function guideRuleRowsRaw(R, levelBufferPp = MACRO_SIGNAL_RULES.inflationLevelBufferPp) {
  return [
    ['시장 상태', '추세 (S&P 500)', `오르는 ${R.trend.maShort}일선보다 ${R.trend.bufferPct}% 이상 위, ${R.trend.maShort}일선 > ${R.trend.maLong}일선 (한 번 양호면 ${R.trend.maShort}일선 아래로 마감하기 전까지 유지, 그 밖의 ±${R.trend.bufferPct}% 안은 중립)`, `${R.trend.maLong}일선보다 ${R.trend.bufferPct}% 넘게 아래, 하락하는 ${R.trend.maShort}일선보다 ${R.trend.bufferPct}% 넘게 아래, 주도 영역 이탈(SOXX가 5거래일 -${R.leadership.proxyDrop5dPct}% 이상 또는 ${R.trend.maShort}일선보다 ${R.leadership.proxyBufferPct}% 넘게 아래 + 신저가 우위·분배일 등 확인 신호)`, '이동평균 추세'], // v58.74 (audit): 10/23 read 부담 by the leadership rule the table left out
    ['시장 상태', `시장 폭 (${R.trend.maShort}·${R.trend.maLong}일선 위 종목 비율)`, `둘 다 ${R.breadth.broadAtLeast}% 이상`, `하나라도 ${R.breadth.weakBelow}% 미만`, '참여 폭'],
    ['시장 상태', '변동성 (VIX, VIX÷3개월 VIX)', `VIX ${R.volatility.calmBelow - R.volatility.calmBufferPt} 미만(또는 ${R.volatility.calmBelow} 미만이면서 5일 상승 없음), 비율 ${R.volatility.calmRatioBelow} 미만`, `VIX ${R.volatility.stressAt} 이상, 비율 ${R.volatility.invertedRatioAt} 이상, 5일 +${R.volatility.spike5dPct}%`, '기간 구조 역전'],
    ['시장 상태, 금리', '10년물 20일 변화', `-${R.rates.move20dBp}bp 이하`, `+${R.rates.move20dBp}bp 이상, 1년 범위 ${R.rates.rangeHighAt * 100}% 위에서 상승`, '할인율'],
    ['시장 상태, 신용', '하이일드 스프레드 (ICE BofA)', `${R.credit.tightBelowBp}bp 미만, 5일 축소`, `${R.credit.stressAtBp}bp 이상, 5일 +${R.credit.widen5dBp}bp, 20일 확대 폭이 자체 기록 상위 ${100 - R.credit.stress20dPct}%(20일 +${R.credit.widen20dBp}bp 밑으로 줄 때까지 유지)`, '신용 스트레스'],
    ['시장 상태', '유가, 달러 (20일)', `WTI ${R.oil.fall20dPct}% 이하, 달러 하락`, `WTI +${R.oil.rise20dPct}%, 1년 범위 ${R.oil.rangeHighAt * 100}%, 달러 +${R.dollar.rise20dPct + R.dollar.bufferPct}%(1년 범위 ${R.dollar.rangeHighAt * 100}% 위면 +${R.dollar.rise20dPct}%)`, '물가·금융 여건'],
    ['한국 참고', '원/달러, 엔/달러 (20일)', `원/달러 -${R.fx.krwMove20dPct}% 이하`, `원/달러 +${R.fx.krwMove20dPct}%, 엔 ${R.fx.yenRally20dPct}% 이상 강세`, '2024년 8월 엔 캐리 청산'],
    ['거시, 성장', 'Sahm 지표, 일자리 3개월 평균', `Sahm ${R.growth.sahmWatchAt}%p 미만, ${R.growth.payrollSolidK / 10}만 명 이상`, `Sahm ${R.growth.sahmRecessionAt}%p 이상, 3개월 평균 감소`, 'Sahm (2019)'],
    // v58.75 (persona review): the row said "3% 이상 부담"; the axis (macro-read inflationAxis) needs 3% + the level buffer, or a
    // re-acceleration that core PCE and core CPI agree on from 2.5% — derived from the same constants.
    ['거시, 물가', '근원 PCE (전년 대비), 근원 PCE·CPI 3개월 속도', `${R.inflation.nearTargetPct}% 이하, 3개월 속도가 1년치 이하, 근원 PCE·CPI 어느 쪽도 재가속 아님`, `${(R.inflation.missPct + levelBufferPp).toFixed(1)}% 이상(${R.inflation.missPct}% 선 + ${levelBufferPp}%p), ${R.inflation.nearTargetPct}% 이상에서 근원 PCE·CPI가 함께 재가속(3개월 속도가 1년치보다 ${R.inflation.reaccelPp}%p 이상 빠름, 한쪽만이면 엇갈림)`, `FOMC 목표 ${R.inflation.targetPct}%`],
    ['거시, 정책', '2년물 − 기준금리, 실질 기준금리', `-${R.policy.pricedMovePp}%p 이하`, `+${R.policy.pricedMovePp}%p 이상, 실질 ${R.policy.restrictiveRealPct}% 이상`, 'FOMC 장기 금리 전망'],
    ['투자 심리', 'CNN 공포·탐욕 (참고 지표)', '판정에 넣지 않음', '판정에 넣지 않음', `참고 구간: 극단 공포 <${R.fearGreed.extremeFearBelow}, 공포 <${R.fearGreed.fearBelow}, 탐욕 >${R.fearGreed.greedAbove}, 극단 탐욕 >${R.fearGreed.extremeGreedAbove}`]
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

export function createGuidePage({ documentRef, root = documentRef?.defaultView || globalThis } = {}) {
  return {
    route: 'guide',
    mount() {
      const bag = createResourceBag();
      const guidePage = documentRef?.getElementById('page-guide');
      if (!guidePage) return () => bag.dispose();
      organizeGuideChapters(documentRef, guidePage);
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
        capabilityStatus.textContent = capabilityAudit.ok ? '' : `안내 문구 점검 필요, ${capabilityAudit.issues.length}건`;
      }
      // A jump button whose section is not on the page opens the command search on its name instead.
      const jump = (targetId) => jumpToGuide(documentRef, targetId) || root?._aioOpenCommandSearch?.({ scope: 'guide', query: String(targetId || '').replace(/^guide-/, '') });
      const onTriggerClick = (event) => {
        const action = closestAction(event.target, '[data-action]');
        if (!action || !guidePage.contains(action) || action.getAttribute('data-action') !== '_aioGuideJump') return;
        event.preventDefault();
        event.stopPropagation();
        jump(action.getAttribute('data-arg'));
      };
      guidePage.addEventListener('click', onTriggerClick);
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
