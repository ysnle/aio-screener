// Product QA scope: AIO is desktop-only by product decision.
// Keep legacy responsive CSS/DOM for compatibility, but do not add or gate
// future work against phone/tablet viewports.
export const DESKTOP_QA_VIEWPORTS = Object.freeze([
  Object.freeze({ name: 'desktop1280', width: 1280, height: 900 }),
  Object.freeze({ name: 'desktop1440', width: 1440, height: 1000 }),
  Object.freeze({ name: 'desktop1920', width: 1920, height: 1080 }),
]);

export const DESKTOP_PRIMARY_VIEWPORT = DESKTOP_QA_VIEWPORTS[1];
export const DESKTOP_QA_SCOPE = 'desktop-only';
