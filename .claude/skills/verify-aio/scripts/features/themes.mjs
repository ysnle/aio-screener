// Map: features/themes.md
import { openFromNav, expectText, expectCount, activePage, visibleText } from '../lib/drive.mjs';

const CHIP = '#page-themes [data-action="showThemeDetail"][data-arg]';

export default {
  title: '테마와 섹터 (범위 전환 · 상세 패널 · 목록 복귀 · 종목 연결)',
  steps: [
    ['nav 테마와 섹터', (p) => openFromNav(p, '테마와 섹터', 'page-themes')],
    ['섹터 회전 판정 + 사분면 카드', async (p) => ({ ...(await expectCount(p, '#rrg-quadrant-cards > *', 1)), ...(await expectCount(p, CHIP, 1)) })],
    ['범위 서브섹터 → 11섹터', async (p) => {
      const pill = (arg) => `#rrg-view-tabs [data-action="setRRGView"][data-arg="${arg}"]`;
      // Codex audit F12: the pill turns active before the rAF/250ms repaint, so wait for the chip set itself to change.
      const chips = () => p.$$eval(CHIP, (n) => n.map((x) => x.dataset.arg).join(','));
      const changedFrom = (prev) => p.waitForFunction(({ sel, prev }) => [...document.querySelectorAll(sel)].map((x) => x.dataset.arg).join(',') !== prev, { sel: CHIP, prev }, { timeout: 8000 });
      const initial = await chips();
      await p.click(pill('subsectors'));
      await p.waitForFunction((s) => document.querySelector(s)?.classList.contains('active'), pill('subsectors'), { timeout: 8000 });
      await changedFrom(initial).catch(() => {}); // already on subsectors: the set may legitimately stay
      const sub = await chips();
      await p.click(pill('sectors'));
      await p.waitForFunction((s) => document.querySelector(s)?.classList.contains('active'), pill('sectors'), { timeout: 8000 });
      await changedFrom(sub);
      const sectors = await chips();
      if (sub === sectors) throw new Error('scope toggle did not change the chip set');
      return { subsectorChips: sub.split(',').length, sectorChips: sectors.split(',').length };
    }],
    ['세부 테마 순위 기본 1주 → 1일 → 첫 테마 구성 종목 비교', async (p) => {
      // v59.70: the ranking, the sector bars and the hero open on the same window (1주).
      const pressed = await p.$eval('#theme-strength-board .theme-strength-periods button[aria-pressed="true"]', (n) => n.textContent.trim());
      const bars = await p.$eval('#sector-perf-tabs button[aria-pressed="true"]', (n) => n.textContent.trim());
      const hero = await p.$eval('#rrg-rotation-read', (n) => n.textContent);
      if (pressed !== '1주' || bars !== '1주' || !hero.includes('1주,')) throw new Error(`default window differs: ranking ${pressed}, bars ${bars}, hero ${hero.slice(0, 40)}`);
      // v59.70: one ranked bar list per window; a row opens its members (bar, gap to median, equal-weight share).
      const tab = p.locator('#theme-strength-board .theme-strength-periods button', { hasText: '1일' });
      if (await tab.isEnabled()) await tab.click();
      const row = p.locator('#theme-strength-board .tsr-row').first();
      await row.click();
      await p.waitForFunction(() => document.querySelector('#theme-strength-board .tsr-row')?.getAttribute('aria-expanded') === 'true', null, { timeout: 8000 });
      const members = await p.$$eval('#theme-strength-board .tsr-member-table tbody tr', (n) => n.length);
      if (!members) throw new Error('member comparison opened empty');
      return { members, rows: await p.$$eval('#theme-strength-board .tsr-row', (n) => n.length) };
    }],
    ['섹터 막대 고점 근처 → 1주 복귀, AI 공급망 층별 PER', async (p) => {
      // v59.70 (X bookmarks #2, #7): the metric tab draws 11 share bars and dates the card chip on the screener session;
      // 1주 brings the period bars back. The layer PER fold lists the covered layers with two multiples each.
      await p.click('#sector-perf-tabs button[data-period="near52"]');
      await p.waitForFunction(() => document.getElementById('sector-perf-bars')?.dataset.metric === 'near52', null, { timeout: 8000 });
      const shares = await p.$$eval('#sector-perf-bars .thp-perf-bar--share', (n) => n.length);
      const hero = await p.$eval('#rrg-rotation-read', (n) => n.textContent);
      if (shares < 6 || !hero.includes('52주 고점')) throw new Error(`고점 근처 drew ${shares} bars, hero ${hero.slice(0, 40)}`);
      await p.click('#sector-perf-tabs button[data-period="1w"]');
      await p.waitForFunction(() => !document.getElementById('sector-perf-bars')?.dataset.metric, null, { timeout: 8000 });
      const fold = p.locator('#themes-ai-chain details.ai-chain-per');
      await fold.waitFor({ state: 'attached', timeout: 20000 });
      await fold.locator('summary').click();
      const layers = await p.$$eval('#themes-ai-chain .ai-chain-per__row', (n) => n.map((row) => row.getAttribute('aria-label')));
      if (!layers.length || !layers.every((label) => /지난 4분기 [\d.]+배 → 다음 4분기 [\d.]+배/.test(label))) throw new Error(`layer PER rows: ${layers.slice(0, 2).join(' | ')}`);
      return { shares, layers: layers.length };
    }],
    ['S&P 500 지도 → 구성 종목 확인', async (p) => {
      // 2026-11-02: #sector-map is an open section; #sector-map-fold now holds only the day's splits and is hidden without them.
      // 2026-10-13: the map paints after the screener rows land; the tile detail line names the member.
      await p.waitForFunction(() => document.querySelectorAll('#sector-map .sector-map-tile').length > 50, null, { timeout: 20000 });
      const tiles = await p.$$eval('#sector-map .sector-map-tile', (n) => n.length);
      const tile = p.locator('#sector-map .sector-map-tile[data-sym]').first();
      const sym = await tile.getAttribute('data-sym');
      await tile.click();
      const detail = await visibleText(p, '#sector-map .sector-map-detail');
      if (!detail.startsWith(sym)) throw new Error(`tile detail did not name ${sym}: ${detail.slice(0, 80)}`);
      return { tiles, sym, detail: detail.slice(0, 90) };
    }],
    ['AI 설비투자 흐름 펼치기 → 설명과 근거', async (p) => {
      await p.locator('#ai-capex-fold > summary').click();
      return expectText(p, '#ai-capex-flow', { min: 80 });
    }],
    ['첫 테마 열기 → 같은 화면 안 상세 패널', async (p) => {
      // v57.76: the quadrant chips sit in the 사분면별 섹터 fold under the scatter chart.
      // v59.70: the sector card opens on its bars (등락); the scatter and its fold are the 회전 view.
      await p.locator('#themes-verdict-tabs [data-view="rrg"]').click();
      await p.locator('#rrg-quadrant-fold > summary').click();
      const t = p.locator(CHIP).first();
      const arg = await t.getAttribute('data-arg');
      // The fold repaints its chips once it opens; click() scrolls and retries on the re-resolved locator, where
      // scrollIntoViewIfNeeded held the detached first paint.
      await t.click();
      await p.waitForFunction(() => { const el = document.querySelector('#theme-detail-panel'); return !!el && el.offsetParent !== null && el.innerText.trim().length > 100; }, null, { timeout: 15000 });
      return { themeId: arg, activePage: await activePage(p), panel: (await visibleText(p, '#theme-detail-panel')).slice(0, 120) };
    }],
    ['테마 목록으로 (상세 닫힘 · 선택한 칩으로 스크롤 복귀)', async (p) => {
      const arg = await p.locator(CHIP).first().getAttribute('data-arg');
      await p.getByRole('button', { name: '← 테마 목록으로', exact: true }).click();
      await p.waitForFunction((id) => { const el = document.querySelector(`#page-themes [data-action="showThemeDetail"][data-arg="${id}"]`); if (!el) return false; const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }, arg, { timeout: 8000 });
      if (await p.locator('#theme-detail-panel').isVisible()) throw new Error('theme detail stayed open after returning to its list');
      return { chipInViewport: arg, detailClosed: true };
    }],
    ['목록에서 같은 테마 다시 열기 → 구성 종목 화면', async (p) => {
      await p.locator(CHIP).first().click();
      await p.waitForSelector('#theme-detail-panel', { state: 'visible' });
      const chip = p.locator('#theme-detail-panel [data-action="showTicker"][data-arg]:visible').first();
      const sym = await chip.getAttribute('data-arg');
      // v59.84: the panel repaints once its rows arrive; scrollIntoViewIfNeeded failed on the detached first paint, while
      // click() scrolls and retries on the re-resolved locator.
      await chip.click();
      await p.waitForFunction(() => document.querySelector('.page.active')?.id === 'page-ticker', null, { timeout: 15000 });
      return { symbol: sym, ...(await expectText(p, '#ticker-hero-name', { pattern: new RegExp(sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })) };
    }]
  ]
};
