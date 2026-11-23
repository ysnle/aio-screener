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
