// v59.07 (roadmap item 11, legacy decomposition 7/8): the chapter layout moved here from js/aio-core.js
// (_aioPolishRemainingPages, v52.89 P704). The hero leads, the quick-start section follows, every other direct section
// is folded into a closed details.aio-guide-chapter titled by its own label, and the public policy note goes last. It
// runs once per page (data-guide-chapters) and is not undone on unmount, as before. src/ui/pages/guide.js calls it on
// mount; window._aioOrganizeGuideChapters (src/app/legacy-screen-bridges.js) lets the T869 headless test lay it out.
export function organizeGuideChapters(documentRef, page) {
  if (page.dataset.guideChapters === '1') return;
  page.dataset.guideChapters = '1';
  const directSections = () => Array.from(page.children).filter((el) => el.classList?.contains('aio-section'));
  const sectionLabel = (section) => {
    const label = section.querySelector('.aio-section-label, .page-title, .widget-title');
    return ((label && label.textContent) || '추가 정보').replace(/\s+/g, ' ').trim();
  };
  const sections = directSections();
  const quick = sections[0];
  const hero = sections.find((section) => !!section.querySelector('.page-title'));
  if (hero) page.insertBefore(hero, page.firstChild);
  if (quick && hero) hero.insertAdjacentElement('afterend', quick);
  directSections().filter((section) => section !== hero && section !== quick).forEach((section) => {
    const details = documentRef.createElement('details');
    details.className = 'aio-guide-chapter';
    const summary = documentRef.createElement('summary');
    summary.textContent = sectionLabel(section);
    details.appendChild(summary);
    page.insertBefore(details, section);
    details.appendChild(section);
  });
  const policy = documentRef.getElementById('guide-public-policy');
  if (policy) page.appendChild(policy);
}
