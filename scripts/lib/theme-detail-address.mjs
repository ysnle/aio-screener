// v59.70 (fix-r1-theme): `theme-detail` without a theme opens the theme list (an id-less detail means nothing, and the
// old THEME_MAP[0] fallback opened 방산 for every old link). A gate that checks the detail opens it the way a user's
// link does: a hash change to the old detail address with a real theme id from the page's own THEME_MAP. The router
// reads it (popstate), opens that theme and writes #themes?theme=<id>; the gate's own navigate to the route follows.
export async function addressThemeDetail(page) {
  const id = await page.evaluate(() => {
    const themeId = Array.isArray(window.THEME_MAP) ? String(window.THEME_MAP[0]?.id || '') : '';
    if (!themeId) return null;
    const target = `#theme-detail/${encodeURIComponent(themeId)}`;
    if (location.hash === target) history.replaceState(history.state ?? null, '', `${location.pathname}${location.search}#`);
    location.hash = target;
    return themeId;
  });
  if (id) await page.waitForFunction((themeId) => location.hash === `#themes?theme=${themeId}`, id, { timeout: 15000 });
  return id;
}
