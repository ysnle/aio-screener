// Map: features/themes.md
import { openFromNav, expectText, expectCount, activePage, visibleText } from '../lib/drive.mjs';

const CHIP = '#page-themes [data-action="showThemeDetail"][data-arg]';

export default {
  title: '테마 · 섹터 (범위 전환 · 상세 패널 · 목록 복귀 · 종목 연결)',
  steps: [
    ['nav 테마 · 섹터', (p) => openFromNav(p, '테마 · 섹터', 'page-themes')],
    ['섹터 회전 판정 + 사분면 카드', async (p) => ({ ...(await expectCount(p, '#rrg-quadrant-cards > *', 1)), ...(await expectCount(p, CHIP, 1)) })],
    ['범위 서브섹터 → 11섹터', async (p) => {
      const pill = (arg) => `#rrg-view-tabs [data-action="setRRGView"][data-arg="${arg}"]`;
      await p.click(pill('subsectors'));
      await p.waitForFunction((s) => document.querySelector(s)?.classList.contains('active'), pill('subsectors'), { timeout: 8000 });
      const sub = await p.$$eval(CHIP, (n) => n.map((x) => x.dataset.arg).join(','));
      await p.click(pill('sectors'));
      await p.waitForFunction((s) => document.querySelector(s)?.classList.contains('active'), pill('sectors'), { timeout: 8000 });
      const sectors = await p.$$eval(CHIP, (n) => n.map((x) => x.dataset.arg).join(','));
      if (sub === sectors) throw new Error('scope toggle did not change the chip set');
      return { subsectorChips: sub.split(',').length, sectorChips: sectors.split(',').length };
    }],
    ['S&P 500 지도 → 타일 두 번 눌러 종목 화면 진입 준비', async (p) => {
      // 2026-10-13: the map paints after the screener rows land; the tile detail line names the member.
      await p.waitForFunction(() => document.querySelectorAll('#sector-map .sector-map-tile').length > 50, null, { timeout: 20000 });
      const tiles = await p.$$eval('#sector-map .sector-map-tile', (n) => n.length);
      const tile = p.locator('#sector-map .sector-map-tile[data-sym]').first();
      const sym = await tile.getAttribute('data-sym');
      await tile.scrollIntoViewIfNeeded();
      await tile.click();
      const detail = await visibleText(p, '#sector-map .sector-map-detail');
      if (!detail.startsWith(sym)) throw new Error(`tile detail did not name ${sym}: ${detail.slice(0, 80)}`);
      return { tiles, sym, basis: (await visibleText(p, '#sector-map .sector-map-basis')).slice(0, 90) };
    }],
    ['첫 테마 열기 → 같은 화면 안 상세 패널', async (p) => {
      const t = p.locator(CHIP).first();
      const arg = await t.getAttribute('data-arg');
      await t.scrollIntoViewIfNeeded();
      await t.click();
      await p.waitForFunction(() => { const el = document.querySelector('#theme-detail-panel'); return !!el && el.offsetParent !== null && el.innerText.trim().length > 100; }, null, { timeout: 15000 });
      return { themeId: arg, activePage: await activePage(p), panel: (await visibleText(p, '#theme-detail-panel')).slice(0, 120) };
    }],
    ['선택한 목록으로 (칩으로 스크롤 복귀, 패널 유지)', async (p) => {
      const arg = await p.locator(CHIP).first().getAttribute('data-arg');
      await p.click('#theme-detail-panel :text("선택한 목록으로")');
      await p.waitForFunction((id) => { const el = document.querySelector(`#page-themes [data-action="showThemeDetail"][data-arg="${id}"]`); if (!el) return false; const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }, arg, { timeout: 8000 });
      return { chipInViewport: arg };
    }],
    ['상세의 종목 칩 → 종목 화면', async (p) => {
      const chip = p.locator('#theme-detail-panel [data-action="showTicker"][data-arg]').first();
      const sym = await chip.getAttribute('data-arg');
      await chip.scrollIntoViewIfNeeded();
      await chip.click();
      await p.waitForFunction(() => document.querySelector('.page.active')?.id === 'page-ticker', null, { timeout: 15000 });
      return { symbol: sym, ...(await expectText(p, '#ticker-hero-name', { pattern: new RegExp(sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })) };
    }]
  ]
};
