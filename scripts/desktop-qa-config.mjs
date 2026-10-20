// P1618: desktop regression matrix stays intact; responsive acceptance is separate.
export const DESKTOP_QA_VIEWPORTS = Object.freeze([
  Object.freeze({ name: 'desktop1280', width: 1280, height: 900 }),
  Object.freeze({ name: 'desktop1440', width: 1440, height: 1000 }),
  Object.freeze({ name: 'desktop1920', width: 1920, height: 1080 }),
]);

export const DESKTOP_PRIMARY_VIEWPORT = DESKTOP_QA_VIEWPORTS[1];
export const DESKTOP_QA_SCOPE = 'desktop-and-responsive';
export const RESPONSIVE_QA_VIEWPORTS = Object.freeze([
  Object.freeze({ name: 'phone390', width: 390, height: 844 }),
  Object.freeze({ name: 'tablet768', width: 768, height: 1024 }),
  Object.freeze({ name: 'tablet1024', width: 1024, height: 768 }),
  Object.freeze({ name: 'tablet1180', width: 1180, height: 820 }), // v58.54: current iPads in landscape (fixed sidebar)
]);
